// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CRAFT-WRITS (2026-10-22, the Discord's #feature-feedback, "Crafting seems unrewarding"; the owner: "Why dont you
// actually build this instead of handing me a small fix?"): THE GUILDS' ASKS OF A CRAFTER, as the service keeps them.
// The law - what is asked, of whom, for what - is src/net/craftWritLaw.js; the record bible/06-Systems/Professions-Arc.md
// section 49.
//
//   craftWritBoard   the Work tab's read (/v1/writs/list, beside the Court's): the account's three writs of the UTC day,
//                    posted on the first read of the day by any of its realm characters (AUDIT CRAFT-WRITS E1), each with
//                    what the reading character holds toward it - a potion writ its witnessed brews not yet given to a
//                    writ, a dish or kit writ the pieces of its own make that may go
//   deliverCraftWrit /v1/writs/craft { character, id, rid, realm, pieces? }: the writ filled whole, in ONE batch - the
//                    goods out of the realm record (prepareRealmRecord, guarded), the decision (the writ open and the
//                    account's, today's, the account under its three, the balance with room, the goods witnessed), the
//                    pieces' rows gone, the pay struck (`craft-writ`, a mint), the XP to the craft's track under the
//                    crafter's limit, the Renown to the character, and the guild's standing on its Roll (a hall writ's
//                    statements, CHAP2a) while the Chapters are the account's
//   sweepCraftWrits  the hour's clock (cron.js): an unfilled writ the day after its own - a filled one stays, the brews it
//                    took counted by it
// ═══════════════════════════════════════════════════════════════════

import { mintId, overRate } from './accounts.js';
import { asks, shut, trackView, trackRow, craftCapSql, renownAnswer } from './professions.js';
import { marksOpenFor, balanceOf } from './marks.js';
import { prepareRealmRecord, realmActFirst, recordMovedOf, mustChange, dropObjects, dropIfUnnamed } from './realm.js';
import { chaptersOpenFor } from './npcRoll.js';
import { renownHeldSql } from './renownTracks.js';
import { utcDay, MARKS_MAX } from '../../src/net/marksLaw.js';
import { RENOWN_XP_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import { PROF_OPS_MAX, PROF_OPS_WINDOW_S, rankOfXp } from '../../src/net/professionLaw.js';
import { HALL_WRIT_REP } from '../../src/net/npcChapterLaw.js';
import { MAX_REPUTATION } from '../../src/systems/guild/guildFactions.js';
import { COOKING_RECIPES } from '../../src/net/recipeLaw.js';
import { craftWritsFor, craftWritId, CRAFT_WRIT_ID_RE, CRAFT_WRITS_PER_DAY, CRAFT_WRIT_SLOTS, craftProductOf, takeCraftGoods } from '../../src/net/craftWritLaw.js';

const DAY_S = 86_400;
/** The pieces a dish or kit writ's card names, at most, newest first - a writ asks three. AUDIT CRAFT-WRITS S3: a piece's
 *  row outlives the piece (a dish eaten, a kit spent), so the list is the newest made - the oldest twenty were a seasoned
 *  cook's long-eaten dinners, and the dishes in the pack were never named. */
export const CRAFT_PIECES_SHOWN = 60;

/** The recipes whose pieces answer a dish or kit writ: a dish either herb's, a kit its own. */
const recipesOf = (/** @type {string} */ product) => {
  const p = craftProductOf(product);
  if (!p || p.kind === 'potion') return [];
  return p.kind === 'dish' ? COOKING_RECIPES.filter((r) => r.product === p.id).map((r) => r.id) : [p.key];
};

/** SQL: the potions of `potion` a character's WITNESSED brews made (migration 0145 - none of a cauldron's units loose)
 *  that no crafting writ it filled has taken yet. `p`, `c` the player's and the character's SQL; `potion` the recipe's name's,
 *  `product` the writ's - BOUND, never a column: AUDIT CRAFT-WRITS S1 - written as `craft_writs.product` inside the
 *  decision's UPDATE, SQLite read it as the subquery's own row's, and every writ the character had filled, of any
 *  product, was taken from its brews. */
export const brewedLeftSql = (p, c, potion, product) => `(COALESCE((SELECT SUM(count) FROM prof_brews WHERE player = ${p} AND char_id = ${c} AND potion = ${potion} AND witnessed = 1), 0)
  - COALESCE((SELECT SUM(qty) FROM craft_writs WHERE player = ${p} AND filled_char = ${c} AND product = ${product} AND filled_at IS NOT NULL), 0))`;

/** SQL: a crafted piece (`pv`, a provenance's SQL) that may fill a writ - the account's (a sold one is its buyer's), this
 *  character's make (`c` - a piece bought on the market keeps its maker's), never walled to gold (a loose-made piece's
 *  mark, AUDIT BAG-CRAFT A1), of an answering recipe (`recipes`, a JSON array's SQL), on no listing, auction, road or
 *  home, nor on its way back. AUDIT CRAFT-WRITS T2: `bought_with` 'marks' is a piece made of goods bought for silver too
 *  (AUDIT PROF-541 B7) - every Repair Kit's Cured Leather the smith's counter sells - so only gold's wall refuses. */
const pieceOkSql = (p, c, pv, recipes) => `EXISTS (SELECT 1 FROM products pk WHERE pk.provenance = ${pv} AND pk.owner = ${p} AND pk.char_id = ${c}
    AND pk.listed = 0 AND pk.bought_with IS NOT 'gold' AND pk.recipe IN (SELECT value FROM json_each(${recipes}))
    AND EXISTS (SELECT 1 FROM prof_crafts cr WHERE cr.player = ${p} AND (cr.provenance = pk.provenance OR cr.provenance2 = pk.provenance))
    AND NOT EXISTS (SELECT 1 FROM market_listings WHERE provenance = pk.provenance AND state = 'open')
    AND NOT EXISTS (SELECT 1 FROM market_auctions WHERE provenance = pk.provenance AND state = 'open')
    AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = pk.provenance AND collected = 0)
    AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE player = ${p} AND collected = 0 AND item IS NOT NULL AND json_extract(item, '$.provenance') = pk.provenance)
    AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = pk.provenance))`;   // AUDIT CRAFT-WRITS S2: its own alias (`pk`) - the board's outer `pr` named here made the check its own piece's

/** The ranks the day's draw reads: the account's best crafter's - the most Provisioning and Smithing any living realm
 *  character of it holds, and whether one has smithed at all (E1: the writs are the account's). */
async function ranksOf(db, player) {
  const { results = [] } = await db.prepare(`SELECT t.profession, MAX(t.xp) AS xp FROM prof_tracks t JOIN realm_characters c ON c.id = t.char_id AND c.player = t.player AND c.dead_at IS NULL
    WHERE t.player = ?1 AND t.profession IN ('provisioning', 'smithing') GROUP BY t.profession`).bind(player).all();
  const xp = Object.fromEntries(results.map((r) => [r.profession, Number(r.xp) || 0]));
  return { provisioning: rankOfXp(xp.provisioning ?? 0), smithing: rankOfXp(xp.smithing ?? 0), smithed: (xp.smithing ?? 0) > 0 };
}

/** THE ACCOUNT'S WRITS FOR THE DAY, written down on the first read of it by a living realm character of the account's
 *  (`character` - the board asks first), its best crafter's ranks as they stand then (craftWritLaw.js craftWritsFor - the
 *  account's dice), under that character's id. A later read, by any of its characters, finds them standing. */
async function postCraftWrits(db, player, character, day) {
  const had = await db.prepare('SELECT COUNT(*) AS n FROM craft_writs WHERE day = ?1 AND player = ?2').bind(day, player).first();
  if (Number(had?.n ?? 0) >= CRAFT_WRIT_SLOTS) return;
  const writs = craftWritsFor(day, player, await ranksOf(db, player));
  if (!writs.length) return;
  await db.batch(writs.map((w) => db.prepare(`INSERT OR IGNORE INTO craft_writs (id, player, owner, day, slot, product, faction, tier, qty, pay, xp, renown, track, expires_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`)
    .bind(craftWritId(day, character, w.slot), player, character, day, w.slot, w.product, w.faction, w.tier, w.qty, w.pay, w.xp, w.renown, w.track, (day + 1) * DAY_S)));
}

/** The account's crafting writs filled on a UTC day - the allowance's count. */
const craftWritsToday = async (db, player, day) => Number((await db.prepare('SELECT COUNT(*) AS n FROM craft_writs WHERE player = ?1 AND day = ?2 AND filled_at IS NOT NULL')
  .bind(player, day).first())?.n ?? 0);

/** A writ as the Work tab reads it, with what `character` holds toward it: `brewed` a potion writ's witnessed brews not
 *  yet given, `pieces` a dish or kit writ's pieces of its make that may go (their provenance ids). */
async function craftWritView(db, player, row, character) {
  const p = craftProductOf(row.product);
  const view = {
    id: row.id, product: row.product, kind: p?.kind ?? null, tier: Number(row.tier), faction: Number(row.faction), qty: Number(row.qty),
    pay: Number(row.pay), xp: Number(row.xp), renown: Number(row.renown), track: row.track, expiresAt: Number(row.expires_at),
    state: row.filled_at != null ? 'mine' : 'open',
  };
  if (row.filled_at != null || !p) return view;
  if (p.kind === 'potion') {
    const r = await db.prepare(`SELECT ${brewedLeftSql('?1', '?2', '?3', '?4')} AS n`).bind(player, character, p.id, row.product).first();
    return { ...view, brewed: Math.max(0, Number(r?.n ?? 0)) };
  }
  const { results = [] } = await db.prepare(`SELECT pr.provenance FROM products pr WHERE pr.owner = ?1 AND pr.char_id = ?2 AND pr.recipe IN (SELECT value FROM json_each(?3))
    AND ${pieceOkSql('?1', '?2', 'pr.provenance', '?3')} ORDER BY pr.made_at DESC, pr.rowid DESC LIMIT ?4`).bind(player, character, JSON.stringify(recipesOf(row.product)), CRAFT_PIECES_SHOWN).all();
  return { ...view, pieces: results.map((x) => String(x.provenance)) };
}

/**
 * THE WORK TAB'S CRAFTING WRITS (`crafts`, beside the Court's writs on /v1/writs/list): the account's three of the UTC
 * day, posted on this read where none stand, as `character` holds toward them, and the account's day - `{ writs, today:
 * { filled, max } }`. None while the professions or the Marks are not the account's, nor for a character that is no
 * living realm character of it.
 */
export async function craftWritBoard({ db, nowS }, player, env, { character } = {}) {
  const day = utcDay(nowS);
  const none = { crafts: { writs: [], today: { filled: 0, max: CRAFT_WRITS_PER_DAY } } };
  if (asks(player, { character, needRid: false }) || shut(player, env) || !marksOpenFor(player, env)) return none;
  if (!(await db.prepare('SELECT 1 FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(character, player.id).first())) return none;
  await postCraftWrits(db, player.id, character, day);
  const { results = [] } = await db.prepare('SELECT * FROM craft_writs WHERE day = ?1 AND player = ?2 ORDER BY slot').bind(day, player.id).all();
  return { crafts: { writs: await Promise.all(results.map((r) => craftWritView(db, player.id, r, character))), today: { filled: await craftWritsToday(db, player.id, day), max: CRAFT_WRITS_PER_DAY } } };
}

/** A delivery's answer, read back from its row. */
async function craftAnswer(db, player, row, nowS, extra = {}) {
  return {
    ok: true, ...extra, writ: await craftWritView(db, player.id, row, row.filled_char), pay: Number(row.pay), xp: Number(row.xp_given ?? 0),
    balance: await balanceOf(db, player.id),
    track: trackView(await trackRow(db, player.id, row.filled_char, row.track), row.track, nowS),
    today: { filled: await craftWritsToday(db, player.id, Number(row.day)), max: CRAFT_WRITS_PER_DAY },
  };
}

/**
 * A CRAFTING WRIT FILLED: `{ character, id, rid, realm, pieces }` - `pieces` a dish or kit writ's provenance ids, its
 * count exactly. Asked of the realm record first (realm.js realmActFirst - a lost answer is read by where it stands);
 * refused: a writ that is not this account's (`no-writ`), gone with its day (`writ-expired`), filled already
 * (`craft-writ-filled`), the day's three
 * filled (`craft-writ-cap`), a balance with no room (`marks-full`), too few witnessed brews (`craft-unbrewed`), pieces that
 * are not of the character's own unsold make or not the writ's (`craft-pieces`), goods the record does not hold loose
 * (`craft-goods-gone`). Filled once: asked again, its row answers (`repeat`).
 */
export async function deliverCraftWrit(ctx, player, env, { character, id, rid, realm = null, pieces = null } = {}) {
  const { db, nowS, rand, bucket } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'realm-needed' };   // a crafting writ is a realm character's - its goods are its record's
  const prior = await db.prepare('SELECT * FROM craft_writs WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return craftAnswer(db, player, prior, nowS, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  const w = typeof id === 'string' && CRAFT_WRIT_ID_RE.test(id) ? await db.prepare('SELECT * FROM craft_writs WHERE id = ?1').bind(id).first() : null;
  if (!w || w.player !== player.id) return { error: 'no-writ' };   // E1: the account's - any of its characters fills it
  // AUDIT CRAFT-WRITS S4: filled before under another request - REFUSED, never the Court writ's `repeat` (AUDIT 29 A16): a
  // realm act's `ok` tells the client its goods left the record, and here nothing moved (a lost answer of the fill that
  // did is the realm act's own `seq`, asked where the record stands before this line)
  if (w.filled_at != null) return { error: 'craft-writ-filled' };
  const day = utcDay(nowS);
  if (Number(w.day) !== day || Number(w.expires_at) <= nowS) return { error: 'writ-expired' };
  const p = craftProductOf(w.product);
  if (!p) return { error: 'no-writ' };
  const qty = Number(w.qty);
  const goods = p.kind === 'potion' ? null : pieces;
  if (goods !== null && (!Array.isArray(goods) || goods.length !== qty || new Set(goods).size !== qty)) return { error: 'craft-pieces' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  // THE RECORD'S OWN GOODS, out of it in the fill's own batch (GUARDED: no fill, nothing out) - INT3's outbound hold:
  // silver comes of them
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (takeCraftGoods(save, { product: w.product, qty }, goods) ? null : 'craft-goods-gone'), { outbound: true });
  if (prep.error) return prep;
  const nonce = mintId(rand);
  const cap = craftCapSql('?1', '?2', w.track);
  const filled = 'EXISTS (SELECT 1 FROM craft_writs WHERE id = ?5 AND n = ?6)';
  // the goods witnessed: a potion writ's count in the character's brews not yet given (?11 its product, bound - S1); a
  // piece writ's every piece its own (?11 the answering recipes)
  const goodsOk = p.kind === 'potion'
    ? `${brewedLeftSql('?1', '?2', '?10', '?11')} >= craft_writs.qty`
    : `(SELECT COUNT(*) FROM json_each(?10) g WHERE ${pieceOkSql('?1', '?2', 'g.value', '?11')}) = craft_writs.qty`;
  const batch = [
    ...prep.steps,
    // THE DECISION: the writ open and the account's, today's; the account under its three; the balance with room for
    // the pay; the goods witnessed - and the XP what the craft's track can take under the crafter's limit; its filler
    // this character
    db.prepare(`UPDATE craft_writs SET filled_at = ?3, filled_char = ?2, rid = ?4, n = ?6, goods = ?12,
        xp_given = MAX(0, MIN(xp, ${cap} - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = craft_writs.track), 0)))
      WHERE id = ?5 AND player = ?1 AND filled_at IS NULL AND day = ?7 AND expires_at > ?3
        AND NOT EXISTS (SELECT 1 FROM craft_writs WHERE player = ?1 AND rid = ?4)
        AND (SELECT COUNT(*) FROM craft_writs WHERE player = ?1 AND day = ?7 AND filled_at IS NOT NULL) < ?8
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + craft_writs.pay <= ?9
        AND ${goodsOk}`)
      .bind(player.id, character, nowS, rid, id, nonce, day, CRAFT_WRITS_PER_DAY, MARKS_MAX, p.kind === 'potion' ? p.id : JSON.stringify(goods),
        p.kind === 'potion' ? w.product : JSON.stringify(recipesOf(w.product)), goods ? JSON.stringify(goods) : null),
    mustChange(db),   // no fill, no goods out of the record - the record's step rolls back with it
    // a dish's or a kit's pieces gone with it, as a disenchant's
    db.prepare(`DELETE FROM products WHERE provenance IN (SELECT value FROM json_each((SELECT goods FROM craft_writs WHERE id = ?1 AND n = ?2)))`).bind(id, nonce),
    // the pay, struck - the ledger's trigger credits the balance
    db.prepare(`INSERT OR IGNORE INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'account', ?1, 'craft-writ', pay, day, ?2, ?1, product, 'craft:' || id FROM craft_writs WHERE id = ?3 AND n = ?4`)
      .bind(player.id, nowS, id, nonce),
    // the XP the decision credited, to the craft's track, under the crafter's limit
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, track, MIN(${cap}, xp_given), ?3 FROM craft_writs WHERE id = ?4 AND n = ?5 AND xp_given > 0
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MAX(prof_tracks.xp, MIN(${cap}, prof_tracks.xp + excluded.xp)), updated_at = excluded.updated_at`)
      .bind(player.id, character, nowS, id, nonce),
    // the Renown to the character - its track made where it has none, under RENOWN_TRACKS_MAX (the Court writ's own two)
    db.prepare(`UPDATE renown_tracks SET xp = MIN(?7, xp + (SELECT renown FROM craft_writs WHERE id = ?5 AND n = ?6)), updated_at = ?3
      WHERE player = ?1 AND char_id = ?2 AND ${filled}`).bind(player.id, character, nowS, rid, id, nonce, RENOWN_XP_MAX),
    db.prepare(`INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at)
      SELECT ?1, ?2, NULL, MIN(?7, renown), NULL, ?3, ?3 FROM craft_writs WHERE id = ?5 AND n = ?6 AND renown > 0
        AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2)
        AND ${renownHeldSql('?1')} < ?8`).bind(player.id, character, nowS, rid, id, nonce, RENOWN_XP_MAX, RENOWN_TRACKS_MAX),
    // THE GUILD REMEMBERS - HALL_WRIT_REP to the asking guild on the character's Roll, where it keeps the guild (a hall
    // writ's statements, CHAP2a: the Roll's head moved under this fill's tag, and only while the character stands)
    ...(chaptersOpenFor(player, env) ? [
      db.prepare(`UPDATE npc_roll_heads SET seq = seq + 1, tag = ?3, updated_at = ?4 WHERE char_id = ?2 AND player = ?1 AND EXISTS (SELECT 1 FROM craft_writs WHERE id = ?5 AND n = ?3)
        AND EXISTS (SELECT 1 FROM realm_characters WHERE id = ?2 AND player = ?1 AND dead_at IS NULL)`)
        .bind(player.id, character, nonce, nowS, id),
      db.prepare(`UPDATE npc_roll SET rep = MIN(?4, rep + ?3), owed = MAX(0, MIN(owed, ?4 - MIN(?4, rep + ?3)))
        WHERE char_id = ?2 AND player = ?1 AND faction_id = (SELECT faction FROM craft_writs WHERE id = ?5 AND n = ?6)
          AND EXISTS (SELECT 1 FROM npc_roll_heads WHERE char_id = ?2 AND tag = ?6)`)
        .bind(player.id, character, HALL_WRIT_REP, MAX_REPUTATION, id, nonce),
    ] : []),
  ];
  const before = Number((await db.prepare('SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).first())?.xp ?? 0);
  try {
    await db.batch(batch);
    await dropObjects(bucket, [prep.prev]);
  } catch {
    await dropIfUnnamed(db, bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed keeps its save
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved && !(moved.error === 'seq' && moved.seq === prep.seq)) return moved;
  }
  const now = await db.prepare('SELECT * FROM craft_writs WHERE id = ?1').bind(id).first();
  if (now?.n === nonce) {
    const after = Number((await db.prepare('SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).first())?.xp ?? before);
    return craftAnswer(db, player, now, nowS, { realm: { seq: prep.seq }, renown: renownAnswer(character, before, after) });
  }
  // AUDIT CRAFT-WRITS S5: the same request id raced over another writ - that one is this request (deliverWrit's own read)
  const byRid = await db.prepare('SELECT * FROM craft_writs WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (byRid) return craftAnswer(db, player, byRid, nowS, { repeat: true });
  if (now?.filled_at != null) return { error: 'craft-writ-filled' };
  if (Number(now?.expires_at ?? 0) <= nowS) return { error: 'writ-expired' };
  if ((await craftWritsToday(db, player.id, day)) >= CRAFT_WRITS_PER_DAY) return { error: 'craft-writ-cap' };
  if ((await balanceOf(db, player.id)) + Number(w.pay) > MARKS_MAX) return { error: 'marks-full' };
  return { error: p.kind === 'potion' ? 'craft-unbrewed' : 'craft-pieces' };
}

/** THE HOUR'S SWEEP (cron.js): an unfilled writ the day after its own, `limit` at once; a filled one stays - a potion
 *  writ's brews are counted by it. Answers how many went. */
export async function sweepCraftWrits(db, nowS, limit = 500) {
  const r = await db.prepare('DELETE FROM craft_writs WHERE id IN (SELECT id FROM craft_writs WHERE filled_at IS NULL AND expires_at < ?1 LIMIT ?2)')
    .bind(nowS - DAY_S, limit).run();
  return Number(r?.meta?.changes ?? 0);
}
