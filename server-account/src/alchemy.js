// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF12 (2026-10-02, Mac: "2 and 4"; "lets just finish out everything
// before merge") - ALCHEMY'S BREW AND ENCHANTING'S DISENCHANT, AS THE
// SERVICE KEEPS THEM (bible/06-Systems/Professions-Arc.md 3.3, 4.3, 9.3,
// 37; the law is src/net/alchemyLaw.js, which the client reads too).
//
// TWO DOORS, ONE BOOK (9.3). DFU's own potion maker and item maker stay
// 1:1 and earn nothing online: the service never sees them. What it sees
// is the BREWING ACT - the cauldron's ingredients out of the Stores, DFU's
// own recipe law run on them (POTION_RECIPES and its hash, imported) - and
// DISENCHANTING a piece it minted (its provenance) into Arcane Essence.
//
// The professions' own laws stand (professions.js): a registered
// account's character, the switch, one statement deciding each act
// against the rows as they stand with a fresh nonce, a request asked twice
// answered from its row (`repeat`), bought units spent first, the
// crafter's limit on the XP, every clock an argument.
// ═══════════════════════════════════════════════════════════════════
import { mintId, overRate } from './accounts.js';
import {
  asks, shut, trackView, trackRow, storeOf, spendableSql, spendStatements, seatStepsFor,
} from './professions.js';
import { dice } from './unitRoll.js';   // SILVER-FINDS: the service's dice moved below professions.js and marks.js
import { rankOfXp, specsAt, craftXpCap, STORES_MAX, PROF_OPS_MAX, PROF_OPS_WINDOW_S, ARCANE_ESSENCE, trackOf } from '../../src/net/professionLaw.js';
import { FIRST_CRAFT_XP, recipeById, PROVENANCE_RE } from '../../src/net/recipeLaw.js';
import {
  potionById, brewSpends, brewCount, potentChance, potentPct, potentAble, brewXp, brewFirstPays, DISTILLER,
  piecePoints, essenceOf, disenchantXp, DISENCHANTER,
} from '../../src/net/alchemyLaw.js';
import { prepareRealmRecord, realmActFirst, recordMovedOf, mustChange, dropObjects, dropIfUnnamed } from './realm.js';   // AUDIT PROF-541 B2: a realm character's piece out of its record
import { takeTradeGoods, tradeableRecord } from '../../src/net/realmTradeLaw.js';   // AUDIT PROF-541 B2: as MARKET-ANY's listGood takes a record's piece
import { pieceListable } from '../../src/net/marketLaw.js';   // AUDIT PROF-541 R2-S6: what the market lists is what disenchants

const HERB_RE = /^p[12]:\d+$/;

/** The character's tracks, their ranks, and the choices one stands under now. */
async function tracksOf(db, player, character, profession, nowS) {
  const { results: tracks = [] } = await db.prepare('SELECT * FROM prof_tracks WHERE player = ?1 AND char_id = ?2').bind(player, character).all();
  const ranks = Object.fromEntries(tracks.map((t) => [t.profession, rankOfXp(Number(t.xp))]));
  const craft = trackOf(profession);   // CRAFT3: Alchemy's track Provisioning's
  return { ranks, rank: ranks[craft] ?? 0, specs: specsAt(tracks.find((t) => t.profession === craft), nowS) };
}

// ─── THE BREW (9.3) ──────────────────────────────────────────────────

/** A brew's answer, read back from its row. */
async function brewAnswer(db, player, row, nowS, extra = {}) {
  /** @type {string[]} */
  const keys = (() => { try { const k = JSON.parse(row.keys); return Array.isArray(k) ? k : []; } catch { return []; } })();
  return {
    ok: true, ...extra, potion: row.potion, keys, count: Number(row.count), potent: Number(row.potent), unbruised: Number(row.unbruised),
    steps: Number(row.steps), xp: Number(row.xp), first: Number(row.first) === 1,
    track: trackView(await trackRow(db, player.id, row.char_id, 'alchemy'), 'alchemy', nowS),
    stores: await Promise.all([...new Set(keys)].map((k) => storeOf(db, player.id, row.char_id, k))),
  };
}

/**
 * A BREW: `{ character, potion, keys, seat?, rid }` - one of DFU's twenty (alchemyLaw POTIONS, by its recipe's name),
 * `keys` the cauldron as the Stores hold it (an herb's group the brewer's), which DFU's own law must answer with that very
 * potion (brewSpends: the templates' sorted hash its key - `bad-brew` else); the potion's rank (its price's tier -
 * `prof-rank`). The service cannot see the alchemy station (as it cannot see the forge): the inputs are the Stores' and
 * their units the bound. `seat` the town the station stands in - its holder's members brew there under its Apothecary's
 * steps (professions.js seatStepsFor; alchemyLaw potentChance: +10 a step).
 * POTENT is rolled here, once a brew: the rank's chance (10 at Expert, 20 at Master), +5 an unbruised herb the brew spends
 * (prof_unbruised, its units reckoned against the OWN units spent - bought ones are spent first), a Distiller's +10, the
 * hall's; its share +25, a Master Alchemist's +40. The potions a brew makes: brewCount (1; 2 at Journeyman, a Brewer's 3;
 * 3 at Master - AUDIT PROF-541 R2-S1: one whatever the rank for a potion wholly of the Apothecaries' goods). XP 20 x the potion's tier, +500 the character's first of it (not for one made wholly of the Apothecaries'
 * goods - brewFirstPays), under the crafter's limit. Decided by the brew's own INSERT: every input held (never gold's).
 * Then the unbruised count down by what it reckoned, the inputs out (bought first - the count clamped to the own units
 * left, AUDIT PROF12 A1), the XP in. The potions are the
 * client's to mint on the answer (DFU's own potion, potions.js's key; a Potent one carries its share).
 */
export async function brewAtStation(ctx, player, env, { character, potion: id, keys, rid, seat = null } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const prior = await db.prepare('SELECT * FROM prof_brews WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return brewAnswer(db, player, prior, nowS, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  const potion = potionById(id);
  if (!potion) return { error: 'bad-recipe' };
  const inputs = brewSpends(potion, keys);
  if (!inputs) return { error: 'bad-brew' };   // DFU's law answers no such potion for that cauldron
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const { ranks, rank, specs } = await tracksOf(db, player.id, character, 'alchemy', nowS);
  if (rank < potion.rank) return { error: 'prof-rank' };
  const cap = craftXpCap('alchemy', ranks);
  const steps = await seatStepsFor(db, player.id, character, seat, 'alchemy', nowS);
  // THE UNBRUISED HERBS (4.3): each herb's own units this brew spends (bought ones go first), at most what was picked
  // unbruised
  let unbruised = 0;
  const reckoned = [];
  for (const inp of inputs) {
    if (!HERB_RE.test(inp.key)) continue;
    const st = await storeOf(db, player.id, character, inp.key);
    const ownSpent = Math.max(0, Math.min(inp.n, inp.n - st.bought));
    const row = await db.prepare('SELECT qty FROM prof_unbruised WHERE player = ?1 AND char_id = ?2 AND material = ?3').bind(player.id, character, inp.key).first();
    const u = Math.min(ownSpent, Number(row?.qty ?? 0));
    if (u > 0) { unbruised += u; reckoned.push({ key: inp.key, n: u }); }
  }
  const chance = potentChance(rank, { distiller: specs[50] === DISTILLER, unbruised, steps });
  // AUDIT PROF-541 B3: a Cure of DFU's default magnitude is never Potent (alchemyLaw potentAble: an instant, its chance
  // bypassed as it is drunk) - the die still cast first, so the dice after it fall as they did
  const potent = dice(rand) * 100 < chance && potentAble(potion) ? potentPct(specs[100]) : 0;
  const count = brewCount(rank, specs[50], potion);   // AUDIT PROF-541 R2-S1: the counter's goods alone one potion
  const xp = brewXp(potion, rank, false);
  const nonce = mintId(rand);
  // ?1 player ?2 character ?3 rid ?4 potion ?5 keys ?6 count ?7 potent ?8 unbruised ?9 steps ?10 xp ?11 the first time's
  // ?12 now ?13 nonce; the inputs ?14 on, two a one
  const binds = [player.id, character, rid, potion.id, JSON.stringify(keys), count, potent, unbruised, steps, xp, brewFirstPays(potion) ? FIRST_CRAFT_XP : 0, nowS, nonce];
  const held = [];
  inputs.forEach((inp, i) => {
    binds.push(inp.key, inp.n);
    held.push(`${spendableSql('?1', '?2', `?${14 + 2 * i}`)} >= ?${15 + 2 * i}`);   // GOLD-MARKET: never gold's units
  });
  const decided = 'EXISTS (SELECT 1 FROM prof_brews WHERE player = ?1 AND rid = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION: every input held - and the XP what the track can take under the crafter's limit, the first brew's 500
    // laid on when the character has brewed none of the potion
    db.prepare(`INSERT OR IGNORE INTO prof_brews (player, rid, char_id, potion, keys, count, potent, unbruised, steps, xp, first, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8, ?9,
        MAX(0, MIN(?10 + f * ?11, ${Number(cap)} - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = '${trackOf('alchemy')}'), 0))),
        f, ?12, ?13
      FROM (SELECT CASE WHEN ?11 > 0 AND NOT EXISTS (SELECT 1 FROM prof_brews WHERE player = ?1 AND char_id = ?2 AND potion = ?4) THEN 1 ELSE 0 END AS f)
      WHERE ${held.join(' AND ')}`).bind(...binds),   // AUDIT PROF-541 B6: `first` only where the first time pays (brewFirstPays), as smeltAtForge's
    // the unbruised herbs it reckoned, spent with it - AUDIT PROF12 A1: before the cauldron leaves, so the spends' clamp
    // (professions.js unbruisedClamp: never more than the own units still held) reads the count already lowered
    ...reckoned.map((u) => db.prepare(`UPDATE prof_unbruised SET qty = MAX(0, qty - ?4)
      WHERE player = ?1 AND char_id = ?2 AND material = ?3 AND EXISTS (SELECT 1 FROM prof_brews WHERE player = ?1 AND rid = ?5 AND n = ?6)`)
      .bind(player.id, character, u.key, u.n, rid, nonce)),
    // the cauldron out of the Stores, each bought first
    ...inputs.flatMap((inp) => spendStatements(db, {
      player: player.id, character, materialSql: '?3', qtySql: '?4', guard: decided, binds: [inp.key, inp.n, rid, nonce],
    })),
    // the XP the decision credited, under the crafter's limit
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, '${trackOf('alchemy')}', MIN(?4, xp), ?5 FROM prof_brews WHERE player = ?1 AND rid = ?3 AND n = ?6
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MAX(prof_tracks.xp, MIN(?4, prof_tracks.xp + excluded.xp)), updated_at = excluded.updated_at`)
      .bind(player.id, character, rid, cap, nowS, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM prof_brews WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return brewAnswer(db, player, made, nowS);
  if (made) return brewAnswer(db, player, made, nowS, { repeat: true });
  for (const inp of inputs) {
    const st = await storeOf(db, player.id, character, inp.key);
    if (st.own + st.bought < inp.n) return { error: st.own + st.bought + (st.gold ?? 0) >= inp.n ? 'stores-gold' : 'stores-short', material: inp.key };   // GOLD-MARKET
  }
  return { error: 'stores-short' };
}

// ─── DISENCHANTING (9.3) ─────────────────────────────────────────────

/** A disenchant's answer, read back from its row. */
async function disenchantAnswer(db, player, row, nowS, extra = {}) {
  return {
    ok: true, ...extra, provenance: row.provenance, recipe: row.recipe, points: Number(row.points), essence: Number(row.essence),
    origin: row.origin, xp: Number(row.xp),
    track: trackView(await trackRow(db, player.id, row.char_id, 'enchanting'), 'enchanting', nowS),
    store: await storeOf(db, player.id, row.char_id, ARCANE_ESSENCE.key),
  };
}

/**
 * A DISENCHANT: `{ character, provenance, rid }` - a crafted piece this account holds (its provenance id - "Loot cannot be
 * disenchanted": a save item's Essence would be a pack item entering the Stores, law 3) becomes Arcane Essence, ONE PER 100
 * ENCHANTMENT POINTS IT CARRIED (alchemyLaw piecePoints - its DFU template's budget, a jewel's own, read from the service's
 * own record of it, never the client's word), a Disenchanter's twice (3.3), into the Stores, and is gone: its `products`
 * row deleted in the same batch, so it lists, auctions and answers a commission no more. Refused: no such piece
 * (`prof-no-piece`), another's (`prof-not-yours`), one listed, on the road or standing in a home (`prof-piece-busy`), one
 * whose points make no Essence or of a family the market lists not (`prof-no-essence` - AUDIT PROF-541 R2-S6: arrows, a
 * quiver's stack with no provenance in the pack), a full Stores (`stores-full`). The Essence's origin: OWN where this
 * character made it and nobody bought it (PROF0 7: "Essence from an own provenance item (one this character made, never
 * sold)"), GOLD where it was bought with gold (GOLD-MARKET's wall), else BOUGHT. Enchanting XP: alchemyLaw disenchantXp (5
 * x the PIECE's recipe's tier an Essence before the doubling, quartered more than two tiers below the rank's top, none for a
 * piece made wholly of the counter's goods - AUDIT PROF12 E2), under the crafter's limit. The client takes the piece out of its pack
 * on the answer.
 * AUDIT PROF-541 B2: A REALM CHARACTER'S PIECE LEAVES ITS RECORD IN THE SAME ACT - `realm` where its record stands, asked
 * before any other word (realm.js realmActFirst), and the piece taken out of that record by its provenance (realmTradeLaw
 * takeTradeGoods, as MARKET-ANY's listGood takes one) in the disenchant's own batch, guarded (mustChange - no disenchant,
 * no piece out of the record): a record that does not hold it, or holds it worn or bound, is refused (`prof-piece-gone`) -
 * the maker's record says where the piece is, never the products row (a piece sold to a shop or traded away is still
 * "this account's" there), and a client that kept the piece kept nothing the record holds. An offline character's pack is
 * its own save's: a piece whose row a disenchant of THIS account took already is answered `prof-no-piece` with `why:
 * 'disenchanted'`, so a save that kept it past a lost answer lets it go.
 */
export async function disenchantPiece(ctx, player, env, { character, provenance, rid, realm = null } = {}) {
  const { db, nowS, rand, bucket } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT PROF-541 B2: where the record stands, first
  if (side.error) return side;
  const prior = await db.prepare('SELECT * FROM prof_disenchants WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return disenchantAnswer(db, player, prior, nowS, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (typeof provenance !== 'string' || !PROVENANCE_RE.test(provenance)) return { error: 'bad-piece' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const p = await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!p) return { error: 'prof-no-piece', ...(await db.prepare('SELECT 1 FROM prof_disenchants WHERE player = ?1 AND provenance = ?2').bind(player.id, provenance).first() ? { why: 'disenchanted' } : {}) };   // AUDIT PROF-541 B2
  if (p.owner !== player.id) return { error: 'prof-not-yours' };
  const r = recipeById(p.recipe);
  if (!pieceListable(p.recipe)) return { error: 'prof-no-essence' };   // AUDIT PROF-541 R2-S6: arrows (marketLaw pieceListable) - no piece the pack holds by its record
  const points = piecePoints(r, p.hand == null ? null : Number(p.hand));
  const { ranks, rank, specs } = await tracksOf(db, player.id, character, 'enchanting', nowS);
  const base = essenceOf(points);
  const essence = essenceOf(points, specs[50] === DISENCHANTER);
  if (essence < 1) return { error: 'prof-no-essence' };
  const origin = p.bought_with === 'gold' ? 'gold' : p.char_id === character && p.bought_with == null ? 'own' : 'bought';
  const cap = craftXpCap('enchanting', ranks);
  const xp = disenchantXp(r, rank, base);   // AUDIT PROF12 E2: the piece's recipe's tier, quartered; none for the counter's goods alone
  // AUDIT PROF-541 B2: THE RECORD'S OWN PIECE - a realm character's, out of the record its tab last checkpointed
  const prep = side.at ? await prepareRealmRecord(ctx, player.id, side.at, (save) => {
    const items = Array.isArray(save.items) ? save.items : [];
    const at = items.findIndex((rec) => rec?.provenance === provenance);
    return at >= 0 && tradeableRecord(items[at]) && takeTradeGoods(save, { items: [items[at]], gold: 0 }, [at]) ? null : 'prof-piece-gone';
  }) : null;
  if (prep?.error) return prep;
  const nonce = mintId(rand);
  const decided = 'EXISTS (SELECT 1 FROM prof_disenchants WHERE player = ?1 AND rid = ?2 AND n = ?3)';
  const batch = [
    ...(prep ? prep.steps : []),
    // THE DECISION: the piece this account's, on no listing, no road and in no home, the Essence's room - and the XP what
    // the track can take under the crafter's limit
    db.prepare(`INSERT OR IGNORE INTO prof_disenchants (player, rid, char_id, provenance, recipe, points, essence, origin, xp, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8,
        MAX(0, MIN(?9, ${Number(cap)} - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = 'enchanting'), 0))),
        ?10, ?11
      WHERE EXISTS (SELECT 1 FROM products WHERE provenance = ?4 AND owner = ?1 AND listed = 0)
        AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = ?4 AND collected = 0)
        AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?4)
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?12), 0) + ?7 <= ?13`)
      .bind(player.id, character, rid, provenance, p.recipe, points, essence, origin, xp, nowS, nonce, ARCANE_ESSENCE.key, STORES_MAX),
    ...(prep ? [mustChange(db)] : []),   // AUDIT PROF-541 B2: no disenchant, no piece out of the record - the record's step rolls back with it
    // the piece gone
    db.prepare(`DELETE FROM products WHERE provenance = ?4 AND ${decided}`).bind(player.id, rid, nonce, provenance),
    // the Essence in, of its origin
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, ?4, origin, essence FROM prof_disenchants WHERE player = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(player.id, rid, nonce, ARCANE_ESSENCE.key),
    // the XP the decision credited
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, 'enchanting', MIN(?4, xp), ?5 FROM prof_disenchants WHERE player = ?1 AND rid = ?3 AND n = ?6
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MAX(prof_tracks.xp, MIN(?4, prof_tracks.xp + excluded.xp)), updated_at = excluded.updated_at`)
      .bind(player.id, character, rid, cap, nowS, nonce),
  ];
  if (!prep) await db.batch(batch);
  else {
    try {
      await db.batch(batch);
      await dropObjects(bucket, [prep.prev]);
    } catch {
      await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed keeps its save
      const moved = await recordMovedOf(db, player.id, side.at);
      if (moved && !(moved.error === 'seq' && moved.seq === prep.seq)) return moved;
    }
  }
  const made = await db.prepare('SELECT * FROM prof_disenchants WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return disenchantAnswer(db, player, made, nowS, prep ? { realm: { seq: prep.seq } } : {});
  if (made) return disenchantAnswer(db, player, made, nowS, { repeat: true });
  const now = await db.prepare('SELECT owner, listed FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!now) return { error: 'prof-no-piece' };   // another request took it first
  if (now.owner !== player.id) return { error: 'prof-not-yours' };
  const room = await storeOf(db, player.id, character, ARCANE_ESSENCE.key);
  if (room.own + room.bought + (room.gold ?? 0) + essence > STORES_MAX) return { error: 'stores-full', material: ARCANE_ESSENCE.key };
  return { error: 'prof-piece-busy' };
}
