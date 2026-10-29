// @ts-check
// YC4 (2026-10-29, bible/11-Multiplayer/Yard-Cells.md section 14.4) - A HOME CELL THAT MOVED, SAID TO EVERY PAGE
// ONLINE. The relay's half; the law both ends read is src/net/homeCellWordLaw.js. YC2's yard push (yardWords.js) with
// its own kind, meter and owed words: the service signs a HOME CELL ORDER for each cell a home write moved, the acting
// client carries it, and the hub checks the signature with the key it already holds. IN THE HUB ALONE, as the yards.
// THE FAN IS METERED BY THE SECOND: each cell's highest verified version, said as one frame at most each
// HOME_CELL_FAN_MS. Nothing is stored or said on a welcome: a page that joins, or lost its socket, asks its cells anyway.

import { isSocialRoom } from '../../src/net/wire.js';
import { verifyOrder } from '../../src/net/identityToken.js';
import { homeCellGate, HOME_CELL_FAN_MS, HOME_CELL_WORDS_MAX } from '../../src/net/homeCellWordLaw.js';

/**
 * A carried `{t:'hcell', order}`: metered first (AUDIT 68), junk outside the hub, dropped silently if it does not verify.
 * @param {any} room the relay's Room
 * @param {any} ws
 * @param {any} a
 * @param {{ order: string }} m
 * @param {number} now
 */
export async function takeHomeCellOrder(room, ws, a, m, now) {
  if (!room._spend(ws, now, homeCellGate, 'hcbucket', 'hcdrops', 'too many home cell orders')) return;
  if (!isSocialRoom(a.key)) {
    room._junk(ws);
    return;
  }
  await room._loadKey();
  if (!room._verifyKey) return;
  const verified = await verifyOrder(m.order, room._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'hcell' });
  if (!verified.ok) return;
  oweHomeCellWord(room, [verified.claims.m, verified.claims.c, verified.claims.v], now);
}

/** @typedef {[number, number, number]} HomeCellWord `[m, c, v]`: town `m`'s home cell `c` at version `v`. */

/**
 * A verified word owed to the next fan - the highest version of its cell kept - and the fan armed.
 * @param {any} room
 * @param {HomeCellWord} word
 * @param {number} now
 */
export function oweHomeCellWord(room, word, now) {
  const owed = room._homeCellOwed ??= new Map();
  const key = `${word[0]}:${word[1]}`;
  if ((owed.get(key)?.[2] ?? 0) >= word[2]) return;
  owed.set(key, word);
  armHomeCellFan(room, now);
}

/**
 * The next fan, at HOME_CELL_FAN_MS past the last one.
 * @param {any} room
 * @param {number} now
 */
function armHomeCellFan(room, now) {
  if (room._homeCellT) return;
  const wait = Math.max(0, (room._homeCellAt ?? -Infinity) + HOME_CELL_FAN_MS - now);
  room._homeCellT = setTimeout(() => {
    room._homeCellT = null;
    homeCellFan(room, Date.now());
  }, wait);
}

/**
 * The owed words said to everyone in the hub, HOME_CELL_WORDS_MAX a frame; what is left waits for the next second.
 * @param {any} room
 * @param {number} now
 */
export function homeCellFan(room, now) {
  const owed = room._homeCellOwed;
  if (!owed?.size) return;
  /** @type {HomeCellWord[]} */
  const words = [];
  for (const [key, word] of owed) {
    if (words.length >= HOME_CELL_WORDS_MAX) break;
    words.push(word);
    owed.delete(key);
  }
  room._homeCellAt = now;
  const said = JSON.stringify({ t: 'hcell', l: words });
  for (const [other, attachment] of [...room._all()]) {
    if (attachment.id) room._send(other, said);   // everyone in the hub, the carrier included
  }
  if (owed.size) armHomeCellFan(room, now);
}
