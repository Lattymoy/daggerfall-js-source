// @ts-check
// VIDEO1 — hub half of video surface fanout. Law: src/net/videoSurfaceWordLaw.js.
import { isSocialRoom } from '../../src/net/wire.js';
import { verifyOrder } from '../../src/net/identityToken.js';
import { videoGate, VIDEO_FAN_MS, VIDEO_WORDS_MAX } from '../../src/net/videoSurfaceWordLaw.js';

/**
 * Carried `{t:'video', order}`: meter, verify, owe a word for the next fan.
 * @param {any} room
 */
export async function takeVideoOrder(room, ws, a, m, now) {
  if (!room._spend(ws, now, videoGate, 'vdbucket', 'vddrops', 'too many video orders')) return;
  if (!isSocialRoom(a.key)) { room._junk(ws); return; }
  await room._loadKey();
  if (!room._verifyKey) return;
  const r = await verifyOrder(m.order, room._verifyKey, {
    subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'video',
  });
  if (!r.ok) return;
  const { vm, vb, vs, vr } = r.claims;
  oweVideoWord(room, [vm, vb, vs, vr], now);
}

export function oweVideoWord(/** @type {any} */ room, /** @type {any[]} */ word, /** @type {number} */ now) {
  const owed = room._videoOwed ??= new Map();
  const key = `${word[0]}:${word[1]}:${word[2]}`;
  if ((owed.get(key)?.[3] ?? 0) >= word[3]) return;
  owed.set(key, word);
  armVideoFan(room, now);
}

function armVideoFan(/** @type {any} */ room, /** @type {number} */ now) {
  if (room._videoT) return;
  const wait = Math.max(0, (room._videoAt ?? -Infinity) + VIDEO_FAN_MS - now);
  room._videoT = setTimeout(() => {
    room._videoT = null;
    videoFan(room, Date.now());
  }, wait);
}

export function videoFan(/** @type {any} */ room, /** @type {number} */ now) {
  const owed = room._videoOwed;
  if (!owed?.size) return;
  const words = [];
  for (const [key, word] of owed) {
    if (words.length >= VIDEO_WORDS_MAX) break;
    words.push(word);
    owed.delete(key);
  }
  room._videoAt = now;
  const said = JSON.stringify({ t: 'video', l: words });
  for (const [other, b] of [...room._all()]) if (b.id) room._send(other, said);
  if (owed.size) armVideoFan(room, now);
}
