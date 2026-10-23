// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-BOUNTY (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected"; bible/03-World/
// Eltheric-Ocean.md SEA-BOUNTY) - A FREEPORT'S BOUNTY BOARD ON THE OPEN SEA'S KILLERS, the service's half. The law is both
// ends' (src/net/sea/seaBountyLaw.js); the tables migrations/0146_sea_bounty.sql's.
//
//   THE KILL (seaKillSteps): a fall the relay refereed in a room of the open sea (its receipt's `m` - src/net/wire.js
//     seaRoomOf) at another player's hand, written in the fall's OWN batch (wild.js wildFall) - so once, by its remains'
//     id, whichever tab brings it first: every bounty standing on the fallen is claimed by it, and their sum owed to the
//     killer's character (the receipt's `kc`). A receipt of an older relay names neither the room nor the character, and
//     is no kill at sea.
//   BOARD (/v1/sea/bounty/board): the wanted captains - a kill at sea within SEA_WANTED_DAYS, or a bounty standing - by
//     their bounty, then their kills; the gold owed the asking character, and the bounty on its own head.
//   POST (/v1/sea/bounty/post): gold off the poster's record (payFromSave, the wallet's own order - and `outbound`: a held
//     record hands no value to another player) onto a wanted captain's head, in one batch with its row; a request asked
//     twice is one post.
//   COLLECT (/v1/sea/bounty/collect): every owed sum of the asking character's paid into its record (creditSave, the
//     region's bank as a market's gold is) and turned paid, in one batch - each row exactly once (mustChange). Its posts on
//     heads gone (deleted, or dead SEA_REFUND_AFTER_S) are written owed back to it first (AUDIT SEA VENTURES B4).
//
// GOLD IS NEVER MADE HERE: an owed sum is the posts its fall claimed, and a post left its poster's record in its own
// batch. Not a DFU member: Daggerfall Unity has no players to hunt.
// ═══════════════════════════════════════════════════════════════════
import { realmActFirst, prepareRealmRecord, mustChange, dropIfUnnamed, recordMovedOf, dropObjects } from './realm.js';
import { payFromSave, creditSave } from '../../src/net/realm/realmGoldLaw.js';
import { regionOk } from '../../src/net/nodeLaw.js';
import { seaRoomOf } from '../../src/net/wire.js';
import { REALM_CHARACTER_RE } from '../../src/net/identityToken.js';
import { SEA_WANTED_DAYS, SEA_BOARD_MAX, SEA_BOUNTY_RID_RE, seaBountyGoldOk } from '../../src/net/sea/seaBountyLaw.js';

const DAY_S = 86_400;
/** The most owed sums one collect pays (a captain owed more collects again). */
export const SEA_COLLECT_ROWS = 64;
/** AUDIT SEA VENTURES B4: A POST ON A HEAD NO LONGER LIVING goes back to its poster - a head deleted, or dead this long
 *  (s): a fall that ended it is carried within its receipt's hour and claims it first (seaKillSteps). Each post is written
 *  owed to its poster's own character (`back:` its id) and marked claimed by it, in one batch - the poster's collect pays
 *  it as an owed bounty. Before this the gold stood on the gone head for good. */
export const SEA_REFUND_AFTER_S = 2 * 3600;
const GONE_HEAD = 'NOT EXISTS (SELECT 1 FROM realm_characters c WHERE c.id = sea_bounties.target_char AND (c.dead_at IS NULL OR c.dead_at > ?3))';
/** The posts of `poster`'s character `posterChar` on heads gone, written owed back to it (seaBountyCollect runs them). */
export const seaRefundSteps = (/** @type {any} */ db, /** @type {string} */ poster, /** @type {string} */ posterChar, /** @type {number} */ nowS) => [
  db.prepare(`INSERT OR IGNORE INTO sea_bounty_owed (r, killer, killer_char, target_char, gold, at) SELECT 'back:' || id, poster, poster_char, target_char, gold, ?4
    FROM sea_bounties WHERE poster = ?1 AND poster_char = ?2 AND claimed_r IS NULL AND ${GONE_HEAD}`).bind(poster, posterChar, nowS - SEA_REFUND_AFTER_S, nowS),
  db.prepare(`UPDATE sea_bounties SET claimed_r = 'back:' || id WHERE poster = ?1 AND poster_char = ?2 AND claimed_r IS NULL AND ${GONE_HEAD}`).bind(poster, posterChar, nowS - SEA_REFUND_AFTER_S),
];
/** AUDIT SEA VENTURES B5: what has ended is kept this long (s) - a bounty claimed, a sum paid, a prize collected or
 *  returned - and then swept (the service's hourly clock - cron.js `sea`). */
export const SEA_ENDED_KEEP_S = 30 * DAY_S;
/** The sea's sweeps, each `[sql, cutoff]` - a delete a page at a time (cron.js rounds): a kill at sea past the Wanted
 *  window, a wreck past its receipt's hour (a second asking is answered the first's - seaWreck.js), what has ended past
 *  SEA_ENDED_KEEP_S. A bounty standing, a sum owed and a prize held are never swept. */
export const seaSweeps = (/** @type {number} */ nowS) => /** @type {[string, number][]} */ ([
  ['DELETE FROM sea_kills WHERE r IN (SELECT r FROM sea_kills WHERE at < ?1 LIMIT ?2)', nowS - SEA_WANTED_DAYS * DAY_S],
  ['DELETE FROM sea_wrecks WHERE r IN (SELECT r FROM sea_wrecks WHERE at < ?1 LIMIT ?2)', nowS - 2 * 3600],
  ['DELETE FROM sea_bounties WHERE id IN (SELECT id FROM sea_bounties WHERE claimed_r IS NOT NULL AND at < ?1 LIMIT ?2)', nowS - SEA_ENDED_KEEP_S],
  ['DELETE FROM sea_bounty_owed WHERE r IN (SELECT r FROM sea_bounty_owed WHERE paid_at IS NOT NULL AND paid_at < ?1 LIMIT ?2)', nowS - SEA_ENDED_KEEP_S],
  ["DELETE FROM sea_prizes WHERE rowid IN (SELECT rowid FROM sea_prizes WHERE state != 'held' AND ended_at < ?1 LIMIT ?2)", nowS - SEA_ENDED_KEEP_S],
]);
/** A post's id: twenty hex digits from the service's own randomness. */
const postIdOf = (rand) => { const b = new Uint8Array(10); rand(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
/** The gold standing on a captain's head. */
const standing = async (db, target) => Number((await db.prepare('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounties WHERE target_char = ?1 AND claimed_r IS NULL').bind(target).first())?.n ?? 0);

/**
 * THE KILL AT SEA - the steps for a fall's own batch (wild.js wildFall), or none: `claims` the fall's verified receipt
 * (`{ r, f, c, k, kc, m }`), `nowS` the service's clock. A fall at another's hand, in a room of the open sea, with both
 * characters named: every bounty standing on the fallen claimed by it (only while no kill of this fall is written - a
 * fall asked again claims nothing), the kill written once, and the sum claimed owed to the killer's character.
 * @param {any} db @param {any} claims @param {number} nowS
 */
export function seaKillSteps(db, claims, nowS) {
  const { r, f, c, k, kc, m } = claims ?? {};
  if (!k || !c || typeof kc !== 'string' || !REALM_CHARACTER_RE.test(kc) || !seaRoomOf(m)) return [];
  return [
    db.prepare('UPDATE sea_bounties SET claimed_r = ?1 WHERE target_char = ?2 AND claimed_r IS NULL AND NOT EXISTS (SELECT 1 FROM sea_kills WHERE r = ?1)').bind(r, c),
    db.prepare('INSERT OR IGNORE INTO sea_kills (r, killer, killer_char, victim, victim_char, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(r, k, kc, f, c, nowS),
    db.prepare('INSERT OR IGNORE INTO sea_bounty_owed (r, killer, killer_char, target_char, gold, at) SELECT ?1, ?2, ?3, ?4, SUM(gold), ?5 FROM sea_bounties WHERE claimed_r = ?1 HAVING SUM(gold) > 0')
      .bind(r, k, kc, c, nowS),
  ];
}

/**
 * BOARD: `{ character? }` - `{ wanted: [{ char, name, kills, bounty }], owed, mine, prizes, back }`: the wanted captains (a
 * kill at sea within SEA_WANTED_DAYS, or a bounty standing; a living character), the largest bounty first, then the most
 * kills, at most SEA_BOARD_MAX; the gold owed the asking character and the bounty on its own head (0 without one); SHIP-PVP
 * (seaWreck.js): the pieces of wrecks it boarded held for it to collect (`prizes`), and its own hold's held past their
 * hold, its to reclaim (`back`).
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaBountyBoard(ctx, player, body) {
  const { db, nowS } = ctx;
  const since = nowS - SEA_WANTED_DAYS * DAY_S;
  const rows = await db.prepare(`SELECT w.ch AS ch, rc.name AS name, COALESCE(k.n, 0) AS kills, COALESCE(b.gold, 0) AS bounty FROM (
      SELECT killer_char AS ch FROM sea_kills WHERE at >= ?1 UNION SELECT target_char FROM sea_bounties WHERE claimed_r IS NULL
    ) w
    JOIN realm_characters rc ON rc.id = w.ch AND rc.dead_at IS NULL
    LEFT JOIN (SELECT killer_char, COUNT(*) AS n FROM sea_kills WHERE at >= ?1 GROUP BY killer_char) k ON k.killer_char = w.ch
    LEFT JOIN (SELECT target_char, SUM(gold) AS gold FROM sea_bounties WHERE claimed_r IS NULL GROUP BY target_char) b ON b.target_char = w.ch
    ORDER BY bounty DESC, kills DESC, rc.name LIMIT ?2`).bind(since, SEA_BOARD_MAX).all();
  const character = typeof body?.character === 'string' && REALM_CHARACTER_RE.test(body.character) ? body.character : null;
  const owed = character ? Number((await db.prepare('SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounty_owed WHERE killer = ?1 AND killer_char = ?2 AND paid_at IS NULL').bind(player.id, character).first())?.n ?? 0) : 0;
  // AUDIT SEA VENTURES B4: and its posts on heads gone, to be written owed back to it by its collect
  const refund = character ? Number((await db.prepare(`SELECT COALESCE(SUM(gold), 0) AS n FROM sea_bounties WHERE poster = ?1 AND poster_char = ?2 AND claimed_r IS NULL AND ${GONE_HEAD}`)
    .bind(player.id, character, nowS - SEA_REFUND_AFTER_S).first())?.n ?? 0) : 0;
  const [pr, bk] = character ? await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM sea_prizes WHERE killer = ?1 AND killer_char = ?2 AND state = 'held' AND until_s > ?3").bind(player.id, character, nowS),
    db.prepare("SELECT COUNT(*) AS n FROM sea_prizes WHERE victim = ?1 AND victim_char = ?2 AND state = 'held' AND until_s <= ?3").bind(player.id, character, nowS),
  ]) : [null, null];
  return {
    wanted: (rows.results ?? []).map((x) => ({ char: x.ch, name: x.name, kills: Number(x.kills), bounty: Number(x.bounty) })),
    owed, refund, mine: character ? await standing(db, character) : 0,
    prizes: Number(pr?.results?.[0]?.n ?? 0), back: Number(bk?.results?.[0]?.n ?? 0),
  };
}

/**
 * POST: `{ character, realm, region, target, gold, rid }` - `gold` (SEA_BOUNTY_MIN to SEA_BOUNTY_MAX) off the realm
 * character's record onto wanted captain `target`'s head. Answers `{ ok, id, gold, bounty, realm: { seq } }` - `bounty` the
 * gold standing on that head now; a request asked again answers its post again (`repeat`), no gold moving twice.
 * Refused: 'sea-bounty-realm' (no realm character), 'bad-rid', 'bad-region', 'sea-bounty-gold', 'sea-bounty-target',
 * 'sea-bounty-self' (one's own head, or another character of one's own account), 'sea-bounty-not-wanted', 'realm-gold'.
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaBountyPost(ctx, player, { character, realm = null, region, target, gold, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, first
  if (side.error) return side;
  if (!side.at) return { error: 'sea-bounty-realm' };
  if (typeof rid !== 'string' || !SEA_BOUNTY_RID_RE.test(rid)) return { error: 'bad-rid' };
  const prior = await db.prepare('SELECT id, target_char, gold FROM sea_bounties WHERE poster = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return { ok: true, repeat: true, id: prior.id, gold: Number(prior.gold), bounty: await standing(db, prior.target_char) };
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!seaBountyGoldOk(gold)) return { error: 'sea-bounty-gold' };
  if (typeof target !== 'string' || !REALM_CHARACTER_RE.test(target)) return { error: 'sea-bounty-target' };
  const wanted = await db.prepare(`SELECT player FROM realm_characters WHERE id = ?1 AND dead_at IS NULL AND (
      EXISTS (SELECT 1 FROM sea_kills WHERE killer_char = ?1 AND at >= ?2) OR EXISTS (SELECT 1 FROM sea_bounties WHERE target_char = ?1 AND claimed_r IS NULL))`)
    .bind(target, nowS - SEA_WANTED_DAYS * DAY_S).first();
  if (!wanted) return { error: 'sea-bounty-not-wanted' };
  if (wanted.player === player.id) return { error: 'sea-bounty-self' };   // a head of one's own account: a bounty one's own hand could collect
  const id = postIdOf(rand);
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (payFromSave(save, gold, region) ? null : 'realm-gold'), { outbound: true });
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare('INSERT INTO sea_bounties (id, poster, poster_char, rid, target_char, gold, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(id, player.id, character, rid, target, gold, nowS),
    ]);
  } catch {
    await dropIfUnnamed(db, ctx.bucket, player.id, side.at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    return { error: 'sea-bounty-failed' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, id, gold, bounty: await standing(db, target), realm: { seq: prep.seq } };
}

/**
 * COLLECT: `{ character, realm, region }` - every sum owed the realm character (the oldest SEA_COLLECT_ROWS) paid into its
 * record (the bank of `region`, as a market's gold is collected) and turned paid, in one batch. Answers `{ ok, gold,
 * realm: { seq } }`; nothing owed answers `{ ok, gold: 0 }` and moves nothing.
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaBountyCollect(ctx, player, { character, realm = null, region } = {}) {
  const { db, nowS } = ctx;
  const side = await realmActFirst(db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'sea-bounty-realm' };
  if (!regionOk(region)) return { error: 'bad-region' };
  await db.batch(seaRefundSteps(db, player.id, character, nowS));   // AUDIT SEA VENTURES B4: its posts on heads gone, owed back to it first
  const rows = (await db.prepare('SELECT r, gold FROM sea_bounty_owed WHERE killer = ?1 AND killer_char = ?2 AND paid_at IS NULL ORDER BY at, r LIMIT ?3').bind(player.id, character, SEA_COLLECT_ROWS).all()).results ?? [];
  const gold = rows.reduce((n, x) => n + Number(x.gold), 0);
  if (!rows.length || !(gold > 0)) return { ok: true, gold: 0 };
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => (creditSave(save, gold, { bank: region }) ? null : 'bad-gold'));
  if (prep.error) return prep;
  const rs = rows.map((x) => x.r);
  const settle = db.prepare(`UPDATE sea_bounty_owed SET paid_at = ?3 WHERE killer = ?1 AND killer_char = ?2 AND paid_at IS NULL AND r IN (${rs.map((_, i) => `?${i + 4}`).join(', ')})`)
    .bind(player.id, character, nowS, ...rs);
  try {
    await db.batch([...prep.steps, settle, mustChange(db, rs.length)]);   // every row this collect read, once - another collect that landed first fails it whole
  } catch {
    await dropIfUnnamed(db, ctx.bucket, player.id, side.at.id, prep.key);
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    return { error: 'sea-bounty-failed' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, gold, realm: { seq: prep.seq } };
}
