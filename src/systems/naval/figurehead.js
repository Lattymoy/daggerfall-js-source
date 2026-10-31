// @ts-check
// FIGUREHEAD (2026-10-30, the owner: "Ship figurehead customizations"; bible/03-World/Naval-Refit.md FIGUREHEAD) - A
// SHIP'S FIGUREHEAD: the law. A carving her captain chooses from the Fleet page, free, stood at her stem and seen by every
// player who sights her. The port's own: Daggerfall has no sea, and Come Sail Away's boats carry none. Pure.
//
// The carvings are Tamriel's: Akatosh's dragon, the Maormer's sea serpent, the Covenant's lion, the Dominion's eagle,
// Skyrim's wolf, a crowned maiden, the Steed's horse and the Iliac Bay's own dreugh. A carving's place in FIGUREHEADS is
// its number on the boats' word (systems/comeSailAway/comeSailAwayWire.js `h`) and in the save - never renumbered.
import { liveryPartsOf, PAINT_MAX } from './shipLivery.js';

/** The carvings, index 1 up (0 is none - her stem as built). */
export const FIGUREHEADS = Object.freeze([null, 'dragon', 'serpent', 'lion', 'eagle', 'wolf', 'maiden', 'horse', 'dreugh']);
/** The most a carving's number is. */
export const FIGUREHEAD_MAX = FIGUREHEADS.length - 1;

/** Whether a hull's stem takes a carving (HULL_NAMES' order): the port's three ships and the Large Galley's tall stem.
 *  The Rowboat's stem stands a hand over the water - a carving there would trail in it. */
export const figureheadHull = (hull) => hull === 1 || hull === 2 || hull === 3 || hull === 4;

/**
 * A carving through its door: its number (0 none), or null for a value that is no carving - the whole refused, as the
 * flag's and the paint's doors refuse. With `hull`, a hull that takes none is none.
 * @param {unknown} raw @param {number} [hull]
 */
export function figureheadOf(raw, hull) {
  if (raw == null) return 0;
  if (!Number.isInteger(raw) || /** @type {number} */ (raw) < 0 || /** @type {number} */ (raw) > FIGUREHEAD_MAX) return null;
  return hull != null && !figureheadHull(hull) ? 0 : /** @type {number} */ (raw);
}
/** The word's number as a carving: a number the door refuses is none, never a reason to drop the word. */
export const figureheadOfCode = (n) => figureheadOf(n) ?? 0;
/** A carving's id ('dragon'), or null for none. */
export const figureheadId = (n) => FIGUREHEADS[figureheadOfCode(n)] ?? null;

/** The paint a carving wears: her livery's accent (shipLivery.js liveryCode's second nibble) on a hull that takes one,
 *  else 0 - gilt as built. */
export function carvingPaint(hull, liveryCode) {
  if (!liveryPartsOf(hull).includes('accent')) return 0;
  const accent = ((liveryCode | 0) >> 4) & 15;
  return accent <= PAINT_MAX ? accent : 0;
}
/** The same off a livery as the ledger keeps it (shipLivery.js liveryOf's `{ accent }`; null as built). */
export const liveryCarvingPaint = (hull, livery) => carvingPaint(hull, ((livery?.accent | 0) & 15) << 4);
