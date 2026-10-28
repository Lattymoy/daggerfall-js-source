// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT RELEASE R2-6 (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md) - WHERE A NEW VAMPIRE WAKES: the crypt's
// map pixel the turn's transfer lands on (VampirismInfection's GetRandomCemetery, then the respawn into its dungeon -
// scenes/world.js transferToCemeteryArm, which this module answers for; HOST-SPLIT: the host asks, the law is here).
//   - ON THE BAY: DFU's own - a cemetery of the current region's MAPS.BSA rows, drawn (systems/infection.js
//     randomCemeteryLocationIndex); a region with none answers null, the host's skip where DFU throws.
//   - PAST THE BAY: the province's own (world/worldWide/worldCemetery.js cemeteryPastBay - the player's area, WW1's
//     district, as the region; else the nearest of the districts about it), and where no lair stands at all the nearest
//     of the Bay's own - never skipped.
// The isles past the Veil are the host's own skip before this is asked (AUDIT CAPTAIN'S SEA P4).
// ═══════════════════════════════════════════════════════════════════
import { randomCemeteryLocationIndex } from '../systems/infection.js';
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { inBay } from '../world/tamriel/tamrielFrame.js';
import { cemeteryPastBay, nearestBayCemetery } from '../world/worldWide/worldCemetery.js';

/**
 * The crypt's map pixel for a vampire turned at `at`, or null (a Bay region with no cemetery: DFU's throw, the host's skip).
 * Positional, so the host's call is one statement and no object's entries (test/scenes/hostceiling.test.js counts them).
 * @param {{ x: number, y: number }} at @param {number} regionIndex @param {any} maps @param {any} places
 * @param {() => number} [roll] @returns {{ x: number, y: number }|null}
 */
export function vampireCryptPixel(at, regionIndex, maps, places, roll = Math.random) {
  if (!inBay(at.x, at.y)) {
    const c = (places ? cemeteryPastBay(places, at.x, at.y, roll) : null) ?? nearestBayCemetery(maps, at.x, at.y);
    return c ? { x: c.px, y: c.py } : null;
  }
  const mapTable = maps.getRegion(regionIndex)?.mapTable ?? [];
  const idx = randomCemeteryLocationIndex(mapTable, roll);
  return idx == null ? null : longitudeLatitudeToMapPixel(mapTable[idx].longitude, mapTable[idx].latitude);
}
