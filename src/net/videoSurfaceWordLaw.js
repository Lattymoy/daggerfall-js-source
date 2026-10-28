// @ts-check
// VIDEO1 — video word law, both ends. Signed order from the account service;
// hub fans `{t:'video', l:[[mapId, buildingKey, pieceId, revision], ...]}`.

import { tokenGate } from './wire.js';
import { homeMapIdOk, homeBuildingKeyOk } from './homeLaw.js';

/** Same shape as decorLaw DECOR_ID_RE — local so the relay graph does not take in decorLaw. */
const VIDEO_PIECE_ID_RE = /^[A-Za-z0-9_-]{1,24}$/;

export const VIDEO_ORDER_HZ_MAX = 4;
export const VIDEO_FAN_MS = 250;
export const VIDEO_WORDS_MAX = 64;
export const VIDEO_IN_HZ_MAX = 8;
/** Welcome field: hub hears video orders. */
export const VIDEO_WELCOME_FIELD = 'vd';

export const videoGate = (/** @type {any} */ bucket, /** @type {number} */ nowMs) => tokenGate(bucket, nowMs, VIDEO_ORDER_HZ_MAX);
export const videoInGate = (/** @type {any} */ bucket, /** @type {number} */ nowMs) => tokenGate(bucket, nowMs, VIDEO_IN_HZ_MAX);

/** One word `[mapId, buildingKey, pieceId, revision]` or null. */
export function validVideoWord(/** @type {unknown} */ w) {
  if (!Array.isArray(w) || w.length !== 4) return null;
  const [m, b, id, rev] = w;
  if (!homeMapIdOk(m) || !homeBuildingKeyOk(b)) return null;
  if (typeof id !== 'string' || !VIDEO_PIECE_ID_RE.test(id)) return null;
  if (!Number.isSafeInteger(rev) || rev < 1) return null;
  return [m, b, id, rev];
}

export function validVideoFrame(/** @type {any} */ m) {
  if (!m || !Array.isArray(m.l) || !m.l.length || m.l.length > VIDEO_WORDS_MAX) return null;
  const words = m.l.map(validVideoWord);
  return words.every(Boolean) ? words : null;
}
