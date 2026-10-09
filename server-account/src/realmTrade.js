// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P2.1 — THE TRADE, SETTLED HERE. Two realm characters' goods
// change hands in one write of both records, or not at all.
//
// Mac: "eliminate duping". The plan is bible/06-Systems/Realm-Arc.md
// section 3; the law both ends read is src/net/realmTradeLaw.js.
//
// ═══ A HALF, THEN THE OTHER ════════════════════════════════════════
//
// When both sides of a trade have confirmed, each checkpoints its save
// as it stands and sends its HALF: the trade's sid, the lease and the
// sequence of that checkpoint, and what it gives and takes. The first
// half waits (REALM_TRADE_TTL_S); the second, if the two describe one
// trade, settles it. Settling reads each record as ITS OWN LAST
// CHECKPOINT left it, takes each side's goods out of it - what the
// record holds, never what a client says - and writes both records one
// sequence on, as new objects, in ONE batch that the guard rolls back
// unless both moved. A side that asks again - a poll, a lost answer -
// is told the outcome, which the row keeps.
//
// ═══ WHAT A MODIFIED CLIENT CAN STILL DO ═══════════════════════════
//
// It can refuse to send its half: then nothing moves. It can checkpoint
// in the middle of a settle: then its record moved on, the batch rolls
// back, and nothing moves. It can write a checkpoint after the trade
// that still holds what it gave - the item-id ledger of phase 3 is what
// catches that copy; this module makes the honest path atomic and every
// dishonest one a refusal or a copy the ledger sees.
// ═══════════════════════════════════════════════════════════════════

import { REALM_ID_RE, LEASE_RE, mintObjectKey, dropObjects, dropIfUnnamed, realmSaveTextOf, holdRefusal, anyDupe } from './realm.js';
import { wealthOf, ownedUids } from './judge.js';   // INT5: the trade's wealth, witnessed; INT4: the ids it moves
import { REALM_TEXT_MAX_BYTES } from '../../src/net/realmSaveCodec.js';   // REALM-GZIP: the text's bound
import { realmTradeHalfOf, halvesAgree, settleRealmTrade, REALM_TRADE_SID_RE, REALM_TRADE_TTL_S } from '../../src/net/realmTradeLaw.js';
import { canon } from '../../src/net/canon.js';

/** A trade half's body: two offers of up to TRADE_ITEMS_MAX records each, wider than any other JSON route (4 KiB). */
export const REALM_TRADE_BODY_MAX = 32 * 1024;
/** How long the service keeps a trade's row after it began - for a side asking again, and for the record. */
export const REALM_TRADE_KEEP_S = 7 * 24 * 3600;

const utf8Bytes = (/** @type {string} */ s) => new TextEncoder().encode(s).byteLength;

/** The outcome, as the side asking reads it - to the HALF THAT MADE IT alone (AUDIT REALM L1-F6): the account, the
 *  character, the sequence it was made at and the half itself, word for word. A sid is the peers' own, so a trade after
 *  it may ask with the same one - and was told the old trade's outcome, and each tab applied the old receipt again (a
 *  dagger given once, received twice), while its own new goods were never given back. Any other half is 'trade-spent'.
 *  @param {any} t @param {string} playerId @param {{ id: string, seq: number, half: any }} asker */
function outcomeFor(t, playerId, { id, seq, half }) {
  const said = canon(half);
  const side = t.a_player === playerId && t.a_char === id && t.a_seq === seq && t.a_half === said ? 'a'
    : t.b_player === playerId && t.b_char === id && t.b_seq === seq && t.b_half === said ? 'b' : null;
  if (!side) return { error: 'trade-spent' };
  if (t.state === 'refused') return { state: 'refused', why: t.why ?? 'refused' };
  let result = null;
  try { result = JSON.parse(t.result); } catch { result = null; }
  const mine = result?.[side];
  return mine ? { state: 'done', seq: mine.seq, items: mine.items, gold: mine.gold } : { error: 'server' };
}

/** A waiting trade refused - once: a refusal the same moment as a settle loses to it, and the row says which won. A
 *  second half that is refused is recorded as the second side (its account, character, sequence and half), so it is
 *  told the outcome as the first is. */
async function refuse(/** @type {any} */ db, /** @type {string} */ sid, /** @type {string} */ why, /** @type {string} */ playerId, /** @type {{ id: string, seq: number, half: any }} */ asker, /** @type {boolean} */ second) {
  await db.prepare("UPDATE realm_trades SET state = 'refused', why = ?, b_player = COALESCE(b_player, ?), b_char = COALESCE(b_char, ?), b_seq = COALESCE(b_seq, ?), b_half = COALESCE(b_half, ?) WHERE sid = ? AND state = 'waiting'")
    .bind(why, second ? playerId : null, second ? asker.id : null, second ? asker.seq : null, second ? canon(asker.half) : null, sid).run();
  const t = await db.prepare('SELECT * FROM realm_trades WHERE sid = ?').bind(sid).first();
  return t ? outcomeFor(t, playerId, asker) : { error: 'server' };
}

/**
 * A HALF OF A TRADE, from the account `playerId` playing `body.id` under `body.lease`, made at the checkpoint
 * `body.seq`. Answers `{ state: 'waiting' }`, `{ state: 'done', seq, items, gold }` - the caller's record is at `seq`
 * now and holds what it received - or `{ state: 'refused', why }`; or `{ error }` for a half that is no half.
 * @param {any} ctx @param {string} playerId @param {any} body
 */
export async function tradeRealm({ db, bucket, rand, nowS }, playerId, body) {
  if (!bucket) return { error: 'no-storage' };
  const { id, lease, seq, sid } = body ?? {};
  if (typeof id !== 'string' || !REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease)) return { error: 'body' };
  if (!Number.isSafeInteger(seq) || seq < 1 || typeof sid !== 'string' || !REALM_TRADE_SID_RE.test(sid)) return { error: 'body' };
  const half = realmTradeHalfOf(body);
  if (!half) return { error: 'body' };

  const asker = { id, seq, half };

  // the caller's record FIRST - its lease (the tab that plays it) - and only THEN the trade (AUDIT REALM L1-F4): a settle
  // lands both records and the trade's row in one batch, so a row read after the record sees any settle that moved it.
  // The row read first let a settle land between the two reads, and the half was told 'seq' - the tab gave its goods
  // back while the realm had moved them, and its next checkpoint wrote them over the settle.
  const row = await db.prepare('SELECT seq, lease, bytes, obj, prev, held, judged_seq, clean_obj FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== lease) return { error: 'lease' };
  // AN OUTCOME IS ANSWERED to the half that made it, whatever the record's sequence now - a settled trade moved it
  let t = await db.prepare('SELECT * FROM realm_trades WHERE sid = ?').bind(sid).first();
  if (t && t.state !== 'waiting') return outcomeFor(t, playerId, asker);
  if (row.seq !== seq || !row.bytes || !row.obj) return { error: 'seq', seq: row.seq };

  if (!t) {
    // THE FIRST HALF waits - and the rows past their keeping go, a cheap sweep on the write that adds one
    await db.prepare('DELETE FROM realm_trades WHERE created_at < ?').bind(nowS - REALM_TRADE_KEEP_S).run();
    // AUDIT REALM2 S5: ONE WAITING HALF A CHARACTER - its new half takes the place of any other it left waiting, in the
    // insert's own batch. Every new sid was a new row, kept a week: one character at one sequence left two hundred
    // halves (5.76 MiB) in a minute, ten gigabytes a day an account. A tab trades one trade at a time.
    const [, put] = await db.batch([
      db.prepare("DELETE FROM realm_trades WHERE a_player = ? AND a_char = ? AND state = 'waiting' AND sid != ?").bind(playerId, id, sid),
      db.prepare(
        "INSERT INTO realm_trades (sid, a_player, a_char, a_lease, a_seq, a_half, state, created_at) VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?)"
        + ' ON CONFLICT (sid) DO NOTHING',
      ).bind(sid, playerId, id, lease, seq, canon(half), nowS),
    ]);
    if (put.meta.changes) return { state: 'waiting' };
    t = await db.prepare('SELECT * FROM realm_trades WHERE sid = ?').bind(sid).first();   // the other half came first, this very moment
    if (!t) return { error: 'server' };
    if (t.state !== 'waiting') return outcomeFor(t, playerId, asker);
  }
  const first = t.a_player === playerId && t.a_char === id;
  // the first side asks again with ITS half, or it is no half of this trade (another of its account's characters too)
  if (first ? t.a_seq !== seq || t.a_half !== canon(half) : t.a_player === playerId) return { error: 'trade-spent' };
  if (nowS - t.created_at > REALM_TRADE_TTL_S) return refuse(db, sid, 'expired', playerId, asker, !first);   // either side learns it
  if (first) return { state: 'waiting' };

  // THE SECOND HALF: the two must be one trade
  let firstHalf = null;
  try { firstHalf = realmTradeHalfOf(JSON.parse(t.a_half)); } catch { firstHalf = null; }
  if (!firstHalf || !halvesAgree(firstHalf, half)) return refuse(db, sid, 'mismatch', playerId, asker, true);
  const other = await db.prepare('SELECT seq, lease, obj, prev, held, judged_seq, clean_obj FROM realm_characters WHERE id = ? AND player = ?').bind(t.a_char, t.a_player).first();
  if (!other || other.lease !== t.a_lease || other.seq !== t.a_seq || !other.obj) return refuse(db, sid, 'moved', playerId, asker, true);
  // INT3: A SIDE THE JUDGE HOLDS GIVES NOTHING - its goods and its gold are what the hold keeps from every other player
  const gives = (/** @type {any} */ h) => h.give.items.length > 0 || h.give.gold > 0;
  if ((gives(firstHalf) && holdRefusal(other)) || (gives(half) && holdRefusal(row))) return refuse(db, sid, 'trade-held', playerId, asker, true);

  // EACH RECORD AS ITS OWN LAST CHECKPOINT LEFT IT
  const [objA, objB] = await Promise.all([bucket.get(other.obj), bucket.get(row.obj)]);
  let saveA = null, saveB = null;
  try { saveA = JSON.parse(await realmSaveTextOf(objA)); saveB = JSON.parse(await realmSaveTextOf(objB)); } catch { saveA = saveB = null; }   // REALM-GZIP: packed or plain
  if (!saveA || !saveB || typeof saveA !== 'object' || typeof saveB !== 'object') return refuse(db, sid, 'no-data', playerId, asker, true);
  const s = settleRealmTrade(saveA, saveB, firstHalf, half);
  if (!s.ok) return refuse(db, sid, s.why ?? 'goods', playerId, asker, true);
  // INT4: a piece the ledger marked a duplicate leaves no record by any route
  const leftOf = (/** @type {any} */ was, /** @type {any} */ now) => { const after = new Set(ownedUids(now)); return ownedUids(was).filter((u) => !after.has(u)); };
  const left = [...leftOf(saveA, s.a), ...leftOf(saveB, s.b)];
  if (left.length && await anyDupe(db, left)) return refuse(db, sid, 'piece-dupe', playerId, asker, true);
  // INT5: what the trade moved, witnessed on both rows - a trade is no gain the budget charges
  const movedA = wealthOf(s.a) - wealthOf(saveA), movedB = wealthOf(s.b) - wealthOf(saveB);
  const textA = JSON.stringify(s.a), textB = JSON.stringify(s.b);
  const bytesA = utf8Bytes(textA), bytesB = utf8Bytes(textB);
  if (bytesA > REALM_TEXT_MAX_BYTES || bytesB > REALM_TEXT_MAX_BYTES) return refuse(db, sid, 'too-large', playerId, asker, true);   // REALM-GZIP: written plain, within the text's bound

  // BOTH RECORDS ONE ON, as new objects - then ONE batch moves both rows to them and seals the trade, or none of it
  const keyA = mintObjectKey(rand, t.a_player, t.a_char, t.a_seq + 1);
  const keyB = mintObjectKey(rand, playerId, id, seq + 1);
  await bucket.put(keyA, textA);
  await bucket.put(keyB, textB);
  const result = JSON.stringify({ a: { seq: t.a_seq + 1, ...s.toA }, b: { seq: seq + 1, ...s.toB } });
  const move = 'UPDATE realm_characters SET seq = ?, bytes = ?, obj = ?, prev = obj, updated_at = ?, witnessed = witnessed + ? WHERE id = ? AND player = ? AND lease = ? AND seq = ?';
  try {
    await db.batch([
      db.prepare(move).bind(t.a_seq + 1, bytesA, keyA, nowS, movedA, t.a_char, t.a_player, t.a_lease, t.a_seq),
      db.prepare(move).bind(seq + 1, bytesB, keyB, nowS, movedB, id, playerId, lease, seq),
      db.prepare("UPDATE realm_trades SET state = 'done', result = ?, b_player = ?, b_char = ?, b_seq = ?, b_half = ? WHERE sid = ? AND state = 'waiting'").bind(result, playerId, id, seq, canon(half), sid),
      // THE GUARD: both records at their new objects under their leases, and this trade sealed by this half - or the
      // insert happens, the CHECK refuses it, and the batch rolls back whole
      db.prepare(
        'INSERT INTO realm_tx_guard (moved, expected) SELECT n, 3 FROM (SELECT'
        + ' (SELECT COUNT(*) FROM realm_characters WHERE (id = ? AND obj = ? AND lease = ?) OR (id = ? AND obj = ? AND lease = ?))'
        + " + (SELECT COUNT(*) FROM realm_trades WHERE sid = ? AND state = 'done' AND b_char = ?) AS n) WHERE n != 3",
      ).bind(t.a_char, keyA, t.a_lease, id, keyB, lease, sid, id),
    ]);
  } catch {
    // a record moved under the settle (a join elsewhere, a checkpoint), or the trade ended the same moment: nothing moved.
    // AUDIT REALM2 S3: OR IT ALL DID, AND THE ANSWER WAS LOST - an object goes only if its row names it nowhere (both rows
    // named the two that were dropped, and both traders' saves were gone); the row then tells the half its outcome.
    await dropIfUnnamed(db, bucket, t.a_player, t.a_char, keyA);
    await dropIfUnnamed(db, bucket, playerId, id, keyB);
    return refuse(db, sid, 'moved', playerId, asker, true);
  }
  // two back now, for both: the one before the trade stays - and (INT6) each one's last clean checkpoint, kept for staff
  await dropObjects(bucket, [other.prev === other.clean_obj ? null : other.prev, row.prev === row.clean_obj ? null : row.prev]);
  return { state: 'done', seq: seq + 1, items: s.toB.items, gold: s.toB.gold };
}
