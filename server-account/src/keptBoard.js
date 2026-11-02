// @ts-check
// ═══════════════════════════════════════════════════════════════════
// KEPT-BOARD (AUDIT LEAN-READS B1/B10, 2026-10-20; bible/11-Multiplayer/
// Scale-Arc.md AUDIT LEAN-READS) - WHAT A KEPT BOARD'S ROW SAYS OF THE CODE
// THAT KEPT IT, AND HOW LARGE ONE MAY BE.
//
// The yards (decor.js), the region's traders (market.js) and the arena's
// counts (arena.js) are each one row, kept at a version the database
// moves on every write they read. A version says nothing of the reads
// that made the row: a deploy that changes one (a bound raised, a column
// read, an order) served the old deploy's rows until the data moved -
// for a quiet town's yards, never. So each row carries its SHAPE, a hash
// of the reads' own text and the bounds they are built with, and a row of
// another shape is no board: read again, and kept again in this one's.
// ═══════════════════════════════════════════════════════════════════

/** A shape: FNV-1a (32 bits, hex) over the parts - the reads' SQL text and every constant they are built with. */
export function shapeOf(/** @type {(string | number)[]} */ ...parts) {
  let h = 0x811c9dc5;
  const text = parts.map(String).join('\u0001');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The longest a kept board's text may be, in BYTES (a D1 row holds 2,000,000 of them; AUDIT LEAN-READS B10: counted in
 *  UTF-16 units, a board of names past ASCII failed its keep under the cap) - past it the board is read every time. */
export const KEPT_BOARD_MAX_BYTES = 1_500_000;
const encoder = new TextEncoder();
/** Whether a board's text may be kept - and a word in the log, once an isolate a board, where it may not. */
export function keptFits(/** @type {string} */ text, /** @type {string} */ board) {
  if (text.length <= KEPT_BOARD_MAX_BYTES / 3 || encoder.encode(text).length <= KEPT_BOARD_MAX_BYTES) return true;
  keptPast(board, `${text.length} characters`);
  return false;
}
/** A board past the bound, said once an isolate a board - by keptFits, or by a read whose build bounded it in SQL (the
 *  yards: decor.js, AUDIT LEAN-READS 2 B7). */
export function keptPast(/** @type {string} */ board, /** @type {string} */ what) {
  if (toldTooLarge.has(board)) return;
  toldTooLarge.add(board);
  console.warn(`[kept] ${board}: ${what}, past ${KEPT_BOARD_MAX_BYTES} bytes - read every time, as before`);
}
const toldTooLarge = new Set();
