// @ts-check
// YARD-CELL YC2 (2026-10-27, bible/11-Multiplayer/Yard-Cells.md section 3.6) - THE YARD WORD'S LAW, both ends'.
// A decor write that moved a yard answers with a signed YARD ORDER (net/identityToken.js mintYardOrder). The acting
// client carries it to the hub as `{t:'yard', order}`; the hub checks it and fans what it verified, at most one frame
// each YARD_FAN_MS, as `{t:'yard', l:[[m, c, v], ...]}` - town `m`'s cell `c` stands at version `v` now, the highest
// version of the second kept for a cell. A page acts on a word only by asking the service for that cell, so a word can
// make a page ask, never put its yards wrong. Pure: no clock, no DOM, no network.

import { tokenGate } from './wire.js';
import { homeMapIdOk, HOME_KEY_MAX } from './homeLaw.js';

/** How often a carrier's yard orders are heard at the hub, a second - a decorator's quick placements, each one a
 *  write the service rate-limits on its own. */
export const YARD_ORDER_HZ_MAX = 2;
/** The hub's fan of yard words: one frame at most each YARD_FAN_MS. */
export const YARD_FAN_MS = 1000;
/** The most words one frame carries - a second's writes over every town; more go in the next frame. */
export const YARD_WORDS_MAX = 256;
/** How often a page hears the hub's yard frames, a second - twice the hub's fan, for its jitter. */
export const YARD_IN_HZ_MAX = 2;
/** The hub's welcome field that says it hears yard orders. A client carries one only to a hub that said it, so no
 *  build sends an older relay a frame type it would close the socket on. */
export const YARD_WELCOME_FIELD = 'yd';

/** A carrier's yard orders at the hub, YARD_ORDER_HZ_MAX a second (metered before the signature is asked). */
export const yardGate = (/** @type {any} */ bucket, /** @type {number} */ nowMs) => tokenGate(bucket, nowMs, YARD_ORDER_HZ_MAX);
/** A page's intake of the hub's yard frames. */
export const yardInGate = (/** @type {any} */ bucket, /** @type {number} */ nowMs) => tokenGate(bucket, nowMs, YARD_IN_HZ_MAX);

/** The widest cell (net/yardCellLaw.js YARD_CELL_MAX), read off homeLaw.js alone so the relay's graph does not take
 *  in decorLaw.js. */
const CELL_MAX = Math.floor(HOME_KEY_MAX / 256);

/** One word `[m, c, v]`, checked - or null. */
export function validYardWord(/** @type {unknown} */ w) {
  if (!Array.isArray(w) || w.length !== 3) return null;
  const [m, c, v] = w;
  if (!homeMapIdOk(m)) return null;
  if (!Number.isSafeInteger(c) || c < 0 || c > CELL_MAX) return null;
  if (!Number.isSafeInteger(v) || v <= 0) return null;
  return [m, c, v];
}

/** A hub frame's words, every one checked - or null for a frame that is not one. */
export function validYardFrame(/** @type {any} */ m) {
  if (!m || !Array.isArray(m.l) || !m.l.length || m.l.length > YARD_WORDS_MAX) return null;
  const words = m.l.map(validYardWord);
  return words.every(Boolean) ? words : null;
}
