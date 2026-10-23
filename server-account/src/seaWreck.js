// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - broadsides
// between captains, a ship wrecked and boarded, her hold a prize; bible/03-World/Eltheric-Ocean.md SHIP-PVP) - A WRECK AT
// SEA, the service's half. The relay referees the guns and signs the wreck (src/net/sea/seaRef.js, net/wild/wildReceipt.js
// `n1`); the prize's law is both ends' (src/net/sea/seaPrizeLaw.js); the tables migrations/0148_sea_wreck.sql's.
//
//   THE WRECK (/v1/sea/wreck): its receipt, carried by the wrecked captain's own tab (where its record stands - the act's
//     lease), or by its killer's once SEA_WRECK_GRACE_S has passed (the record seized, as a fall's is - wild.js). Once a
//     wreck (its id): BOARDED (`b` 1), her hold's share (seaPrizePlaces - never a piece the ledger keeps back, nor any while
//     the judge holds the record: a held record hands no value to another player) taken off the record into the
//     service's hands (`sea_prizes`), in one batch with the wreck's row; boarded or not, a KILL AT SEA for the bounty board
//     (seaBounty.js seaKillSteps - the bounties on the wrecked captain claimed for her killer's character).
//   COLLECT (/v1/sea/prize/collect): every prize held for the asking character, into its record, each once (mustChange).
//   RECLAIM (/v1/sea/prize/reclaim): a prize its killer left SEA_PRIZE_HOLD_S, back into the wrecked captain's record, once.
//
// No piece is made or lost here: a prize is pieces a record held, held by the service until one of the two takes them.
// Not a DFU member: Daggerfall Unity has no players to wreck.
// ═══════════════════════════════════════════════════════════════════
import { verifySeaWreck, SEA_WRECK_GRACE_S } from '../../src/net/wild/wildReceipt.js';
import { prepareRealmRecord, seizeRealmRecord, realmActFirst, realmAtOf, recordMovedOf, mustChange, dropIfUnnamed, dropObjects, realmSaveTextOf, holdRefusal } from './realm.js';
import { piecesBarred, knownCopySteps } from './ledger.js';
import { ledgerKeyOf } from './judge.js';
import { seaKillSteps } from './seaBounty.js';
import { giveTradeGoods } from '../../src/net/realm/realmTradeLaw.js';
import { seaHoldOf, seaPrizePlaces, takeSeaPrize, seaPrizeTook, SEA_PRIZE_HOLD_S } from '../../src/net/sea/seaPrizeLaw.js';

/** The most held prizes one collect or reclaim moves (a captain owed more collects again). */
export const SEA_PRIZE_ROWS = 32;
const parse = (/** @type {any} */ t) => { try { return JSON.parse(t); } catch { return null; } };

/**
 * /v1/sea/wreck - A WRECK BROUGHT: `body.receipt` the relay's `n1`, `body.realm` where the wrecked captain's record stands
 * (its own tab's; none from its killer). Answers `{ r, b, took, n, realm? }` - `took` the pieces the prize took as her game
 * finds them again (seaPrizeTook - by their marks, never their places), `n` how many, `realm.seq` where the record stands
 * now (the wrecked captain's own act, when it moved). A wreck brought before answers again (`again`) - its `took` only to
 * her tab standing BEFORE the take (its first answer lost, or her killer's seize landed under it): a tab that joined the
 * record since holds none of it, and took it out twice; and where it stands while the record is still that tab's. Or
 * `{ error }`: 'no-gate-key', 'receipt' (with `why`), 'not-yours', 'grace', 'no-realm-character', 'no-data', the record's
 * own words.
 * @param {any} ctx @param {any} player @param {any} body @param {{ gateKey: CryptoKey | null }} keys @param {boolean} [again]
 */
export async function seaWreck(ctx, player, body, { gateKey }, again = false) {
  if (!gateKey) return { error: 'no-gate-key' };
  const v = await verifySeaWreck(body?.receipt, gateKey, { subtle: ctx.subtle, nowS: ctx.nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (player.id !== c.f && player.id !== c.k) return { error: 'not-yours' };
  const seize = player.id === c.k;
  const at = seize ? null : realmAtOf(body?.realm);
  if (!seize && (!at || at.id !== c.c)) return { error: at ? 'not-yours' : 'no-realm-character' };
  // once a wreck: a second asking is the first's answer - her killer's too, within her grace (AUDIT SEA VENTURES E3: his
  // prize waits for her own carry, never for the grace that keeps his seize back)
  const had = await ctx.db.prepare('SELECT boarded, took, seq FROM sea_wrecks WHERE r = ?1').bind(c.r).first();
  if (!had && seize && ctx.nowS < c.i + SEA_WRECK_GRACE_S) return { error: 'grace' };
  if (had) {
    const took = parse(had.took) ?? [];
    const before = !!at && took.length > 0 && Number.isSafeInteger(had.seq) && at.seq < had.seq;   // her tab, from before the take
    const now = before ? await ctx.db.prepare('SELECT seq, lease FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(c.c, c.f).first() : null;
    return { r: c.r, b: had.boarded, took: before ? took : [], n: took.length, again: true, ...(now && now.lease === at?.lease ? { realm: { seq: now.seq } } : {}) };
  }
  const row = await ctx.db.prepare('SELECT obj, held, judged_seq FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL').bind(c.c, c.f).first();
  if (!row?.obj || !ctx.bucket) return { error: 'no-realm-character' };
  // the prize: boarded, and the record free to hand it on - the ledger's word on her hold's pieces asked first
  let barred = new Set();
  const prize = c.b === 1 && !holdRefusal(row);
  if (prize) {
    let stored = null;
    try { stored = JSON.parse(/** @type {string} */ (await realmSaveTextOf(await ctx.bucket.get(row.obj)))); } catch { stored = null; }
    if (!stored || typeof stored !== 'object') return { error: 'no-data' };
    barred = await piecesBarred(ctx.db, c.c, (seaHoldOf(stored, c.u) ?? []).map(ledgerKeyOf).filter((k) => k != null));
  }
  const keep = (/** @type {any} */ it) => { const k = ledgerKeyOf(it); return k != null && barred.has(k); };
  /** @type {any[]} */ let taken = [];
  /** @type {Set<string>} */ const escrow = new Set();
  const change = (/** @type {any} */ save) => {
    taken = takeSeaPrize(save, c.u, seaPrizePlaces(seaHoldOf(save, c.u) ?? [], keep)) ?? [];
    for (const it of taken) { const k = ledgerKeyOf(it); if (k != null) escrow.add(k); }
    return null;
  };
  const moved = prize ? (seize ? await seizeRealmRecord(ctx, c.f, c.c, change, { escrow }) : await prepareRealmRecord(ctx, c.f, /** @type {any} */ (at), change, { escrow })) : null;
  if (moved?.error) return moved;
  if (moved && !taken.length) await dropIfUnnamed(ctx.db, ctx.bucket, c.f, c.c, moved.key);   // nothing to take: the move is never made - nor its object kept
  const took = seaPrizeTook(taken);
  const steps = [
    ...(moved && taken.length ? moved.steps : []),
    // AUDIT SEA VENTURES B2: each piece the prize took is written down as her own copy (ledger.js knownCopySteps, as a
    // fall's dropped pieces are - wild.js): a game that kept a crafted piece in its hold held it again as the craft's
    // owner, and her killer's became the locked copy. A reclaim's entry takes the row away again (ledger.js ledgerMoves).
    ...knownCopySteps(ctx.db, c.c, [...escrow], ctx.nowS),
    ctx.db.prepare('INSERT INTO sea_wrecks (r, victim, victim_char, killer, killer_char, boat, boarded, took, seq, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)')
      .bind(c.r, c.f, c.c, c.k, c.kc, c.u, c.b, JSON.stringify(took), moved && taken.length ? moved.seq : null, ctx.nowS),
    ...taken.map((it, i) => ctx.db.prepare("INSERT INTO sea_prizes (r, i, victim, victim_char, killer, killer_char, rec, at, until_s, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'held')")
      .bind(c.r, i, c.f, c.c, c.k, c.kc, JSON.stringify(it), ctx.nowS, ctx.nowS + SEA_PRIZE_HOLD_S)),
    // SEA-BOUNTY: a wreck at another captain's guns is a kill at sea - in the batch that writes the wreck, or neither lands
    ...seaKillSteps(ctx.db, { r: c.r, f: c.f, c: c.c, k: c.k, kc: c.kc, m: c.m }, ctx.nowS),
  ];
  try { await ctx.db.batch(steps); } catch (e) {
    if (moved && taken.length) await dropIfUnnamed(ctx.db, ctx.bucket, c.f, c.c, moved.key);
    const now = await ctx.db.prepare('SELECT 1 AS x FROM sea_wrecks WHERE r = ?1').bind(c.r).first();
    if (now && !again) return seaWreck(ctx, player, body, { gateKey }, true);   // another asking landed it first: its answer
    if (at) { const m = await recordMovedOf(ctx.db, c.f, at); if (m) return m; }
    else if (moved && taken.length) return { error: 'seq' };   // AUDIT SEA VENTURES B7: her record moved under the seize (her own checkpoint first) - asked again, it lands
    throw e;
  }
  if (moved && taken.length) await dropObjects(ctx.bucket, [moved.prev]);
  return { r: c.r, b: c.b, took, n: taken.length, ...(moved && taken.length && !seize ? { realm: { seq: moved.seq } } : {}) };
}

/**
 * ONE END OF A WRECK'S PRIZES ON A RECORD: the rows read (each `{ r, i, rec }`) into it (`at`, `playerId`'s), each moved
 * from 'held' to `state` in the same batch - exactly these rows, or none. Answers `{ ok, items, realm }`.
 * @param {any} ctx @param {string} playerId @param {any} at @param {any[]} rows @param {'collected' | 'returned'} state
 */
async function endPrizes(ctx, playerId, at, rows, state) {
  const items = rows.map((x) => parse(x.rec)).filter((it) => it && typeof it === 'object');
  if (items.length !== rows.length) return { error: 'sea-prize-moved' };   // a row no piece: nothing moves
  const prep = await prepareRealmRecord(ctx, playerId, at, (save) => { giveTradeGoods(save, items, 0); return null; });
  if (prep.error) return prep;
  const which = rows.map((_, k) => `(r = ?${2 * k + 4} AND i = ?${2 * k + 5})`).join(' OR ');
  const settle = ctx.db.prepare(`UPDATE sea_prizes SET state = ?1, to_char = ?2, ended_at = ?3 WHERE state = 'held' AND (${which})`)
    .bind(state, at.id, ctx.nowS, ...rows.flatMap((x) => [x.r, x.i]));
  try {
    await ctx.db.batch([...prep.steps, settle, mustChange(ctx.db, rows.length)]);   // every row read, once - another end that landed first fails it whole
  } catch {
    await dropIfUnnamed(ctx.db, ctx.bucket, playerId, at.id, prep.key);
    const moved = await recordMovedOf(ctx.db, playerId, at);
    if (moved) return moved;
    return { error: 'sea-prize-moved' };
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return { ok: true, items, realm: { seq: prep.seq } };
}

/**
 * /v1/sea/prize/collect - THE KILLER'S PRIZES: `{ character, realm }` - every prize held for this character (its killer's,
 * still within its hold) into its record, once. Answers `{ ok, items, realm }`; nothing held answers `{ ok, items: [] }`.
 * Refused: 'sea-prize-realm' (no realm character), 'sea-prize-moved', the record's own words.
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaPrizeCollect(ctx, player, { character, realm = null } = {}) {
  const side = await realmActFirst(ctx.db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'sea-prize-realm' };
  const rows = (await ctx.db.prepare("SELECT r, i, rec FROM sea_prizes WHERE killer = ?1 AND killer_char = ?2 AND state = 'held' AND until_s > ?3 ORDER BY at, r, i LIMIT ?4")
    .bind(player.id, character, ctx.nowS, SEA_PRIZE_ROWS).all()).results ?? [];
  if (!rows.length) return { ok: true, items: [] };
  return endPrizes(ctx, player.id, side.at, rows, 'collected');
}

/**
 * /v1/sea/prize/reclaim - A WRECKED CAPTAIN'S GOODS BACK: `{ character, realm }` - every prize of this character's hold its
 * killer left SEA_PRIZE_HOLD_S, back into its record, once. Answers `{ ok, items, realm }`; none due answers `{ ok, items:
 * [] }`. Refused as a collect is.
 * @param {any} ctx @param {any} player @param {any} body
 */
export async function seaPrizeReclaim(ctx, player, { character, realm = null } = {}) {
  const side = await realmActFirst(ctx.db, player.id, character, realm);
  if (side.error) return side;
  if (!side.at) return { error: 'sea-prize-realm' };
  const rows = (await ctx.db.prepare("SELECT r, i, rec FROM sea_prizes WHERE victim = ?1 AND victim_char = ?2 AND state = 'held' AND until_s <= ?3 ORDER BY at, r, i LIMIT ?4")
    .bind(player.id, character, ctx.nowS, SEA_PRIZE_ROWS).all()).results ?? [];
  if (!rows.length) return { ok: true, items: [] };
  return endPrizes(ctx, player.id, side.at, rows, 'returned');
}
