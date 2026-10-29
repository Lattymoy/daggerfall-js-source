// @ts-check
// YC4 (2026-10-29, bible/11-Multiplayer/Yard-Cells.md section 14.4) - THE HOME CELL WORD'S LAW, both ends'.
// A home write that moved a cell answers with signed HOME CELL ORDERS (net/identityToken.js mintHomeCellOrder). The
// acting client carries each to the hub as `{t:'hcell', order}`; the hub checks it and fans what it verified, at most
// one frame each HOME_CELL_FAN_MS, as `{t:'hcell', l:[[m, c, v], ...]}` - town `m`'s home cell `c` stands at version
// `v` now, the highest version of the second kept for a cell. A page acts on a word only by asking the service for
// that cell, so a word can make a page ask, never put its homes wrong. Pure: no clock, no DOM, no network.

import { tokenGate } from './wire.js';
import { homeMapIdOk, HOME_KEY_MAX } from './homeLaw.js';

/** How often a carrier's home cell orders are heard at the hub, a second. An arena move carries two at once; every
 *  write behind one is a route the service rate-limits on its own. */
export const HOME_CELL_ORDER_HZ_MAX = 2;
/** The hub's fan of home cell words: one frame at most each HOME_CELL_FAN_MS. */
export const HOME_CELL_FAN_MS = 1000;
/** The most words one frame carries - a second's writes over every town; more go in the next frame. */
export const HOME_CELL_WORDS_MAX = 256;
/** How often a page hears the hub's home cell frames, a second - twice the hub's fan, for its jitter. */
export const HOME_CELL_IN_HZ_MAX = 2;
/** The hub's welcome field that says it hears home cell orders. A client carries one only to a hub that said it, so
 *  no build sends an older relay a frame type it would close the socket on. */
export const HOME_CELL_WELCOME_FIELD = 'hc';

/** A carrier's home cell orders at the hub, HOME_CELL_ORDER_HZ_MAX a second (metered before the signature is asked). */
export const homeCellGate = (/** @type {any} */ bucket, /** @type {number} */ nowMs) => tokenGate(bucket, nowMs, HOME_CELL_ORDER_HZ_MAX);
/** A page's intake of the hub's home cell frames. */
export const homeCellInGate = (/** @type {any} */ bucket, /** @type {number} */ nowMs) => tokenGate(bucket, nowMs, HOME_CELL_IN_HZ_MAX);

/** The widest cell (net/yardCellLaw.js YARD_CELL_MAX), read off homeLaw.js alone so the relay's graph does not take
 *  in decorLaw.js. */
const CELL_MAX = Math.floor(HOME_KEY_MAX / 256);

/**
 * One word `[m, c, v]`, checked - or null.
 * @param {unknown} w
 * @returns {[number, number, number] | null}
 */
export function validHomeCellWord(w) {
  if (!Array.isArray(w) || w.length !== 3) return null;
  const [m, c, v] = w;
  if (!homeMapIdOk(m)) return null;
  if (!Number.isSafeInteger(c) || c < 0 || c > CELL_MAX) return null;
  if (!Number.isSafeInteger(v) || v <= 0) return null;
  return [m, c, v];
}

/**
 * A hub frame's words, every one checked - or null for a frame that is not one.
 * @param {any} m
 * @returns {Array<[number, number, number]> | null}
 */
export function validHomeCellFrame(m) {
  if (!m || !Array.isArray(m.l) || !m.l.length || m.l.length > HOME_CELL_WORDS_MAX) return null;
  const words = m.l.map(validHomeCellWord);
  return words.every(Boolean) ? words : null;
}
