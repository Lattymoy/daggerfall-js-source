// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOST-SPOILS - THE LOST AND FOUND, THE SERVICE'S SIDE.
//
// The owner: "I want to utilize the mailbox as a way to obtain lost
// items/loot if not picked up from a boss" - asked, "Mail the
// leftovers". The law (what a send is, its words, its bounds) is
// src/net/lostLaw.js. This file is the one route's work: a floor's
// leftovers, each an item, written as pieces of the server's post
// (server_post, 0093) to the account that left them, from the Lost and
// Found - each claimed from the mailbox as any gift is (post.js
// claimPost), charged to the wealth budget as a floor's piece is.
//
// ═══ UNDER A KILL THE SERVICE RECORDED ═════════════════════════════
//
// The client rolls the spoils; the service never did, and cannot (the
// roll reads the player's mods and prefs as well as the seed). What the
// service can say is that a fall it was shown happened, to this account,
// and paid: the receipt the relay signed made the kill's row here
// (accounts.js claimGate, sds.js claimSd, egEconomy.js egRedoubtPay - a
// Redoubt paid, never one taken twice in a week, which pays its gold
// alone), and a send names that kill. No row, no pieces (`lost-no-kill`
// - the client asks again: the receipt's own claim may still be on its
// way). A row older than LOST_WINDOW_S takes none (`lost-spent`).
//
// ═══ ONCE A PIECE ══════════════════════════════════════════════════
//
// A piece's batch is its kill and its place in the spoils as rolled
// (lostLaw.js lostBatchOf), under server_post's one-a-batch index: a
// send asked again - its answer lost, the device restarted - writes
// nothing it wrote before, and what it already wrote is answered as sent
// before any other check, so a send that landed is never refused later
// (past the window, past the account's bound) into a second copy in the
// pack. A place is under LOST_INDEX_MAX, so no kill holds more.
// ═══════════════════════════════════════════════════════════════════
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { LOST_BATCH, LOST_WINDOW_S, LOST_WAITING_MAX, lostKillOf, lostBatchOf, lostPiecesOf } from '../../src/net/lostLaw.js';

/** Who the Lost and Found's pieces are from, as the box shows them (src/net/postLaw.js postHead's 40). */
export const LOST_SENDER = 'Lost and Found';
/** THE WORDS a piece is written with, by where it was left: its subject (within the post's 80) and its body (its 1,200). */
const words = (/** @type {string} */ subject, /** @type {string} */ where) => Object.freeze({
  subject,
  body: [`You went without taking this from ${where}. It was gathered up and kept for you here.`, '', 'Claim it and it goes into the pack of the online character you are playing.', '', `- ${LOST_SENDER}`].join('\n'),
});
export const LOST_WORDS = Object.freeze({
  gate: words('Left in the Burning Court', 'the floor of the Burning Court'),
  sd: words('Left at the Last Moment', 'the arena floor of the Last Moment'),
  eg: words('Left at a Redoubt', 'beside a Redoubt\'s beacon in the Battlespire'),
});

/** The kill's row for this account, as the service recorded it: its `at`, or null. A Redoubt's only where it paid. */
async function killAt(db, account, kill) {
  const row = kill.kind === 'gate'
    ? await db.prepare('SELECT at FROM gate_kills WHERE day = ?1 AND account = ?2').bind(kill.day, account).first()
    : kill.kind === 'sd'
      ? await db.prepare('SELECT at FROM sd_kills WHERE slot = ?1 AND account = ?2').bind(kill.slot, account).first()
      : await db.prepare('SELECT at FROM eg_redoubts WHERE b = ?1 AND account = ?2 AND w = ?3 AND paid = 1').bind(kill.b, account, kill.w).first();
  return Number.isSafeInteger(row?.at) ? row.at : null;
}

/**
 * A FLOOR'S LEFTOVERS INTO THE POST: `{ day, pieces: [{ i, item }] }` - `day` the spoils pool's key for the receipt
 * (lostLaw.js lostKillOf), each piece its place and its item. Answers `{ ok, sent, kept }` (`sent` written now, `kept`
 * every piece asked, now or before), or a refusal: `lost-pieces` (not a send's shape), `lost-item` (an item the law
 * refuses - `i` which), `lost-no-kill`, `lost-spent`, `lost-full` (the account's waiting pieces past LOST_WAITING_MAX).
 * @param {{ db: any, nowS: number }} ctx @param {any} reader the session's player row
 * @param {{ day?: unknown, pieces?: unknown }} body
 */
export async function mailLostSpoils({ db, nowS }, reader, { day, pieces } = {}) {
  const kill = lostKillOf(day);
  if (!kill) return { error: 'lost-pieces' };
  const asked = lostPiecesOf(pieces);
  if ('error' in asked) return asked;
  for (const p of asked.pieces) if (itemFindings(p.item).length) return { error: 'lost-item', i: p.i };
  // WHAT IS ALREADY THERE is sent, whatever else is so now - asked first, so a send that landed is never refused later
  const batches = asked.pieces.map((p) => lostBatchOf(kill, p.i));
  const { results: had = [] } = await db.prepare('SELECT batch FROM server_post WHERE to_id = ?1 AND batch IN (SELECT value FROM json_each(?2))')
    .bind(reader.id, JSON.stringify(batches)).all();
  const there = new Set(had.map((r) => r.batch));
  const fresh = asked.pieces.filter((p, k) => !there.has(batches[k]));
  if (!fresh.length) return { ok: true, sent: 0, kept: asked.pieces.length };
  const at = await killAt(db, reader.id, kill);
  if (at == null) return { error: 'lost-no-kill' };
  if (at < nowS - LOST_WINDOW_S) return { error: 'lost-spent' };
  const waiting = await db.prepare("SELECT COUNT(*) AS n FROM server_post WHERE to_id = ?1 AND substr(batch, 1, ?2) = ?3 AND claimed_at IS NULL")
    .bind(reader.id, LOST_BATCH.length, LOST_BATCH).first();
  if ((Number(waiting?.n) || 0) + fresh.length > LOST_WAITING_MAX) return { error: 'lost-full' };
  const { subject, body } = LOST_WORDS[kill.kind];
  // ONE BATCH: every piece of the send, or none - and each once (INSERT OR IGNORE over the one-a-batch index: two sends at
  // once write each piece once between them)
  await db.batch(fresh.map((p) => db.prepare(`INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at)
    VALUES (lower(hex(randomblob(12))), ?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(reader.id, lostBatchOf(kill, p.i), LOST_SENDER, subject, body, JSON.stringify(p.item), nowS)));
  return { ok: true, sent: fresh.length, kept: asked.pieces.length };
}
