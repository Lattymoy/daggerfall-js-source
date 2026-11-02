// @ts-check
// YARD-CELL YC2 (2026-10-27, bible/11-Multiplayer/Yard-Cells.md section 3.6) - A YARD THAT MOVED, SAID TO EVERY PAGE
// ONLINE. The relay's half; the law both ends read is src/net/yardWordLaw.js. The account service signs a YARD ORDER for
// each decor write that moved a cell (identityToken.js mintYardOrder) and the acting client carries it; the hub checks
// the signature with the key it already holds (MOD1's law, as QUEST-HOME's home arm). IN THE HUB ALONE: every online
// player holds a socket to it, and a player near a town's edge can stand in the next pixel's room.
// THE FAN IS METERED BY THE SECOND: each cell's highest verified version, said as one frame at most each YARD_FAN_MS.
// Nothing is stored or said on a welcome: a page that joins, or lost its socket, asks its cells anyway.

import { isSocialRoom } from '../../src/net/wire.js';
import { verifyOrder } from '../../src/net/identityToken.js';
import { yardGate, YARD_FAN_MS, YARD_WORDS_MAX } from '../../src/net/yardWordLaw.js';

/**
 * A carried `{t:'yard', order}` (wire.js parseClient), on socket `ws` whose attachment is `a`: metered before the
 * signature is asked (AUDIT 68), refused outside the hub, dropped silently when it does not verify (the mute arm's way).
 * @param {any} room the relay's Room
 */
export async function takeYardOrder(room, ws, a, m, now) {
  if (!room._spend(ws, now, yardGate, 'ydbucket', 'yddrops', 'too many yard orders')) return;
  if (!isSocialRoom(a.key)) {
    room._junk(ws);
    return;
  }
  await room._loadKey();
  if (!room._verifyKey) return;
  const r = await verifyOrder(m.order, room._verifyKey, {
    subtle: crypto.subtle,
    nowS: Math.floor(now / 1000),
    kind: 'yard',
  });
  if (!r.ok) return;
  oweYardWord(room, [r.claims.m, r.claims.c, r.claims.v], now);
}

/** A verified word owed to the next fan - the highest version of its cell kept - and the fan armed. */
export function oweYardWord(/** @type {any} */ room, /** @type {number[]} */ word, /** @type {number} */ now) {
  const owed = (room._yardOwed ??= new Map());
  const key = `${word[0]}:${word[1]}`;
  if ((owed.get(key)?.[2] ?? 0) >= word[2]) return;
  owed.set(key, word);
  armYardFan(room, now);
}

function armYardFan(/** @type {any} */ room, /** @type {number} */ now) {
  if (room._yardT) return;
  const wait = Math.max(0, (room._yardAt ?? -Infinity) + YARD_FAN_MS - now);
  room._yardT = setTimeout(() => {
    room._yardT = null;
    yardFan(room, Date.now());
  }, wait);
}

/** The owed words said to everyone in the hub, YARD_WORDS_MAX a frame; what is left waits for the next second. */
export function yardFan(/** @type {any} */ room, /** @type {number} */ now) {
  const owed = room._yardOwed;
  if (!owed?.size) return;
  const words = [];
  for (const [key, word] of owed) {
    if (words.length >= YARD_WORDS_MAX) break;
    words.push(word);
    owed.delete(key);
  }
  room._yardAt = now;
  const said = JSON.stringify({ t: 'yard', l: words });
  for (const [other, b] of [...room._all()]) if (b.id) room._send(other, said); // everyone in the hub, the carrier included
  if (owed.size) armYardFan(room, now);
}
