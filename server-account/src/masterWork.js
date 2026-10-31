// @ts-check
// MASTER-ART (2026-10-27; bible/06-Systems/Professions-Arc.md section 57): A MASTER'S WORK, AS THE SERVICE DECIDES IT.
// The client says what it asks - the recipe, its three lines, the dye; the service decides the rest in one batch, as
// craftAtAnvil does: the character's Master rank, the day's one work, the recipe's goods (a station's, loose too) and
// the catalysts it counted (own or bought, never loose - src/net/masterLaw.js MASTER_CATALYSTS), the roll's seed and
// the signed record (net/productRecord.js MINT_V_MASTER). EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
import { mintId, overRate } from './accounts.js';
import { dice } from './unitRoll.js';
import { signingKey } from './signing.js';
import {
  profAsks,
  profShut,
  trackRow,
  trackView,
  storeOf,
  workableSql,
  spendableSql,
  workStatements,
  spendStatements,
  silverClothOut,
  provenanceId,
  workHeld,
} from './professions.js';
import { rankOfXp, PROF_OPS_MAX, PROF_OPS_WINDOW_S } from '../../src/net/professionLaw.js';
import { recipeById, recipeOpen, makerMark, dyeOk, MASTERWORK, JUDGED_CLOTH } from '../../src/net/recipeLaw.js';
import { mintProductRecord, MINT_V_MASTER } from '../../src/net/productRecord.js';
import {
  MASTER_RANK,
  MASTER_CATALYSTS,
  masterChoiceRefusal,
  masterTrackOf,
  masterDayOf,
  rollMasterLines,
  masterRecordLines,
  masterLinesOfRecord,
  masterKeyOf,
} from '../../src/net/masterLaw.js';
import { LOOSE_ORIGIN } from '../../src/net/bagLaw.js';

/** Every key a Master's work of `r` spends, and how many of each: `{ key, in, cat }` - the recipe's goods (`in`) and the
 *  catalysts (`cat`), a key both ask (a Pearl jewel's Pearl) in one row. @param {any} r */
export function masterSpends(r) {
  /** @type {Map<string, { key: string, in: number, cat: number }>} */
  const by = new Map();
  for (const i of r.inputs) by.set(i.key, { key: i.key, in: (by.get(i.key)?.in ?? 0) + i.n, cat: 0 });
  for (const c of MASTER_CATALYSTS) {
    const was = by.get(c.key);
    by.set(c.key, { key: c.key, in: was?.in ?? 0, cat: (was?.cat ?? 0) + c.n });
  }
  return [...by.values()];
}

/** A Master's work's answer, read back from its row: the piece (none where it is gone - disenchanted since), its lines
 *  at the values the service rolled (AUDIT HORIZONTAL B1: the row keeps them as the record signs them), and the Stores of
 *  what it spent. */
async function masterAnswer(db, player, row, nowS, extra = {}) {
  const r = recipeById(row.recipe);
  const piece = await db
    .prepare('SELECT provenance, record, maker, marked, dye FROM products WHERE provenance = ?1')
    .bind(row.provenance)
    .first();
  let kept = null;
  try {
    kept = JSON.parse(row.lines);
  } catch {
    kept = null;
  }
  const lines = masterLinesOfRecord(kept);
  const craft = masterTrackOf(r);
  return {
    ok: true,
    ...extra,
    master: true,
    recipe: row.recipe,
    quality: MASTERWORK,
    count: 1,
    seed: Number(row.seed),
    day: Number(row.day),
    maker: piece?.maker ?? null,
    marked: Number(piece?.marked ?? 0) === 1,
    dye: piece?.dye == null ? null : Number(piece.dye),
    xp: 0,
    first: false,
    chosen: lines ? lines.map(masterKeyOf) : null,
    lines,
    pieces: piece ? [{ provenance: piece.provenance, record: piece.record }] : [],
    track: trackView(await trackRow(db, player.id, row.char_id, craft), craft, nowS),
    stores: r ? await Promise.all(masterSpends(r).map((s) => storeOf(db, player.id, row.char_id, s.key))) : [],
  };
}

/**
 * A MASTER'S WORK: `{ character, recipe, lines, name, dye, rid }` - a Legendary piece of `recipe` with the three `lines`
 * chosen (masterLaw.js: `kind` or `kind:param`), its values the service's roll in the Legendary band, a Masterwork with
 * the maker's mark. Refused: a recipe whose piece takes no tier (`prof-master`), lines the piece may not carry
 * (`prof-master-lines`), a dye on anything but a garment (`prof-dye`), a craft not at Master (`prof-rank`), the day's
 * work made (`prof-master-day`), goods or catalysts short (`stores-short`, `stores-gold`, with the `material`). No XP: a
 * Master's track is at its top. Its row is looked for before the switch (AUDIT 28 M2's rule).
 */
export async function masterWork(
  ctx,
  player,
  env,
  { character, recipe: id, lines, name = null, dye = null, rid } = {},
) {
  const { db, nowS, rand, subtle } = ctx;
  const refused = profAsks(player, { character, rid });
  if (refused) return refused;
  const prior = await db
    .prepare('SELECT * FROM prof_masters WHERE player = ?1 AND rid = ?2')
    .bind(player.id, rid)
    .first();
  if (prior) return masterAnswer(db, player, prior, nowS, { repeat: true });
  const closed = profShut(player, env);
  if (closed) return closed;
  const r = recipeById(id);
  if (!r) return { error: 'bad-recipe' };
  const why = masterChoiceRefusal(r, lines);
  if (why === 'recipe') return { error: 'prof-master' };
  if (why) return { error: 'prof-master-lines' };
  if (!dyeOk(r, dye)) return { error: 'prof-dye' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const craft = masterTrackOf(r);
  const track = await trackRow(db, player.id, character, craft);
  const rank = rankOfXp(Number(track?.xp ?? 0));
  if (rank < MASTER_RANK || !recipeOpen(r, rank)) return { error: 'prof-rank' };
  const day = masterDayOf(nowS);
  const maker = makerMark(name);
  const seed = Math.floor(dice(rand) * 4294967296);
  const provenance = provenanceId(rand);
  // AUDIT HORIZONTAL B1: THE ROLL, ONCE - the record and the row keep its values, so no reader rolls today's bands again
  const rolled = rollMasterLines(r, lines, seed);
  if (!rolled) return { error: 'prof-master-lines' };
  const signed = masterRecordLines(rolled);
  const record = await mintProductRecord(
    {
      p: provenance,
      s: player.id,
      h: character,
      r: r.id,
      q: MASTERWORK,
      m: maker,
      c: seed,
      a: maker !== null,
      u: dye ?? null,
      v: MINT_V_MASTER,
      l: signed,
    },
    await signingKey(env, subtle),
    { subtle, nowS },
  );
  const nonce = mintId(rand);
  const spends = masterSpends(r);
  const decided = 'EXISTS (SELECT 1 FROM prof_masters WHERE player = ?1 AND rid = ?5 AND n = ?6)';
  // ?1 player ?2 character ?3 rid ?4 day ?5 recipe ?6 provenance ?7 the lines, signed ?8 seed ?9 now ?10 nonce; from ?11 each
  // key, its goods and its catalysts. A key's goods spend its loose units first (a station's), its catalysts only what
  // the service counted, so the counted units must cover the catalysts and whatever goods the loose ones cannot
  const binds = [player.id, character, rid, day, r.id, provenance, JSON.stringify(signed), seed, nowS, nonce];
  const held = spends.map((s, i) => {
    const [k, n, c] = [`?${11 + 3 * i}`, `?${12 + 3 * i}`, `?${13 + 3 * i}`];
    binds.push(s.key, s.in, s.cat);
    const loose = `COALESCE((SELECT qty FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ${k} AND origin = '${LOOSE_ORIGIN}'), 0)`;
    return `${workableSql('?1', '?2', k)} >= ${n} + ${c} AND ${spendableSql('?1', '?2', k)} >= ${c} + MAX(0, ${n} - ${loose})`;
  });
  // AUDIT PROF-541 B7 and BAG-CRAFT A1, as the craft's: walled to gold where a good it spends held a loose unit, bought
  // where a good or a catalyst held a bought one - read inside the batch, before the spends
  const goods = spends.filter((s) => s.in > 0).map((s) => s.key),
    all = spends.map((s) => s.key);
  const any = (/** @type {string[]} */ keys, /** @type {string} */ origin) =>
    keys
      .map(
        (k) =>
          `COALESCE((SELECT qty FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = '${k.replace(/'/g, "''")}' AND origin = '${origin}'), 0) > 0`,
      )
      .join(' OR ') || '0';
  const marked = maker !== null ? 1 : 0;
  await db.batch([
    // THE DECISION: one a character a day (the row's UNIQUE day), every good and catalyst held as it is spent
    db
      .prepare(
        `INSERT OR IGNORE INTO prof_masters (player, rid, char_id, day, recipe, provenance, lines, seed, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8, ?9, ?10 WHERE ${held.join(' AND ')}`,
      )
      .bind(...binds),
    // the piece: its provenance, this account's, its signed record and its mark
    db
      .prepare(
        `INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, marked, dye, hand, bought_with, loose)
      SELECT ?5, ?1, ?2, ?6, ?7, ?8, ?9, ?10, seed, ?11, at, ?12, ?13, NULL,
        CASE WHEN ${any(goods, LOOSE_ORIGIN)} THEN 'gold' WHEN ${any(all, 'bought')} THEN 'marks' END,
        CASE WHEN ${any(goods, LOOSE_ORIGIN)} THEN 1 ELSE 0 END
      FROM prof_masters WHERE player = ?1 AND rid = ?3 AND n = ?4`,
      )
      .bind(
        player.id,
        character,
        rid,
        nonce,
        provenance,
        maker,
        r.id,
        r.templateIndex,
        r.material,
        MASTERWORK,
        record,
        marked,
        dye ?? null,
      ),
    // the goods out, a station's way (loose first); the catalysts out, bought first (spendStatements)
    ...spends
      .filter((s) => s.in > 0)
      .flatMap((s) =>
        workStatements(db, {
          player: player.id,
          character,
          materialSql: '?3',
          qtySql: '?4',
          guard: decided,
          binds: [s.key, s.in, rid, nonce],
        }),
      ),
    ...spends
      .filter((s) => s.cat > 0)
      .flatMap((s) =>
        spendStatements(db, {
          player: player.id,
          character,
          materialSql: '?3',
          qtySql: '?4',
          guard: decided,
          binds: [s.key, s.cat, rid, nonce],
        }),
      ),
    // WOVEN-PAYS: a cloth's bolts used, off its silver count
    ...spends
      .filter((s) => s.in > 0 && JUDGED_CLOTH.includes(s.key))
      .flatMap((s) =>
        silverClothOut(db, {
          player: player.id,
          character,
          materialSql: '?3',
          qtySql: '?4',
          guard: decided,
          binds: [s.key, s.in, rid, nonce],
        }),
      ),
  ]);
  const made = await db
    .prepare('SELECT * FROM prof_masters WHERE player = ?1 AND rid = ?2')
    .bind(player.id, rid)
    .first();
  if (made?.n === nonce) return masterAnswer(db, player, made, nowS);
  if (made) return masterAnswer(db, player, made, nowS, { repeat: true });
  if (
    await db
      .prepare('SELECT 1 FROM prof_masters WHERE player = ?1 AND char_id = ?2 AND day = ?3')
      .bind(player.id, character, day)
      .first()
  )
    return { error: 'prof-master-day' };
  for (const s of spends) {
    const st = await storeOf(db, player.id, character, s.key);
    const counted = (st.own ?? 0) + (st.bought ?? 0),
      want = s.cat + Math.max(0, s.in - (st[LOOSE_ORIGIN] ?? 0)),
      gold = st.gold ?? 0;
    if (workHeld(st) < s.in + s.cat || counted < want) {
      return {
        error: workHeld(st) + gold >= s.in + s.cat && counted + gold >= want ? 'stores-gold' : 'stores-short',
        material: s.key,
      }; // GOLD-MARKET: gold's units no station spends
    }
  }
  return { error: 'stores-short' };
}
