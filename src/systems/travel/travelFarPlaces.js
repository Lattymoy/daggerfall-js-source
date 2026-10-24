// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV5 - THE FAR PLACES (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-28), choosing between the horizon's town shapes and these: "Edge markers". The view's camera sees half
// a kilometre ahead at its default tilt, and the world past the streamed grid is fog; so the towns a traveller could
// set out for are not drawn on the land - they are MARKED: every discovered settlement beyond the grid, within
// TV_FAR_RANGE map pixels, the nearest TV_FAR_MAX of them, each a plate held at the screen's edge pointing its way
// with its distance under the name, and a click on one is a journey there by the roads (TV2's own).
//
// A settlement is DFU's town trio - a city, a town (TownHamlet) or a village; a dungeon, a temple or a farm is not a
// destination the edge speaks for. Discovered only (travelCheckDiscovered, DFU's own law: an undiscovered place has no
// name to go to). The grid's own places wear TV2's plates on the land; these start where it ends.
//
// PURE: the host hands the index and the discovery test; the list is rebuilt when the traveller's pixel changes.
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES } from '../../formats/mapsFile.js';

/** How far the edge looks for places (map pixels, straight-line - AUDIT DEEP2 F8: a Chebyshev range was a square, and its
 *  corners 28 km off; about 20 km every way now). */
export const TV_FAR_RANGE = 24;
/** The most far places marked at once, the nearest first - the edge is a compass, not a gazetteer. */
export const TV_FAR_MAX = 10;
/** A map pixel's width in kilometres - MapsFile.WorldMapTerrainDim (32768) x GlobalScale, 819.2 m
 *  (world/terrain/terrainSampler.js, render/volumetricClouds.js PIXEL_METRES). */
export const PIXEL_KM = 0.8192;
/** The settlements the edge speaks for. */
export const TV_FAR_TYPES = Object.freeze(new Set([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]));

/** A distance in words: tenths of a kilometre under ten, whole kilometres past it (the tenths would only flicker). */
export function farDistanceText(km) {
  if (!Number.isFinite(km) || km < 0) return '';
  return km < 10 ? `${(Math.round(km * 10) / 10).toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * The world's settlements, once: `{ x, y, loc }` for every location of TV_FAR_TYPES in the host's pixel index (a Map
 * of "x,y" -> the location, world.js locationIndex).
 * @param {Map<string, any>} index
 */
export function settlementPixels(index) {
  const out = [];
  for (const [key, loc] of index ?? []) {
    if (!loc?.name || !TV_FAR_TYPES.has(loc.mapTableData?.locationType)) continue;
    const c = key.indexOf(',');
    out.push({ x: Number(key.slice(0, c)), y: Number(key.slice(c + 1)), loc });
  }
  return out;
}

/**
 * THE FAR PLACES about pixel `at`: the settlements whose pixel lies beyond `near` (the grid's radius, a square - its own
 * places wear plates on the land) and within `range` (a circle), that `summaryOf(x, y)` answers for (discovered: a summary; else null),
 * nearest first, at most `max`. Each `{ key, summary, x, y, d }` - `d` in map pixels.
 * @param {{ at: {x:number,y:number}, near: number, settlements: Array<{x:number,y:number}>,
 *   summaryOf: (x:number, y:number) => any, range?: number, max?: number }} q
 */
export function farPlaces({ at, near, settlements, summaryOf, range = TV_FAR_RANGE, max = TV_FAR_MAX }) {
  const found = [];
  for (const s of settlements ?? []) {
    const dx = s.x - at.x, dy = s.y - at.y;
    const cheb = Math.max(Math.abs(dx), Math.abs(dy));
    if (cheb <= near || Math.hypot(dx, dy) > range) continue;   // beyond the grid's square; within the range's circle
    const summary = summaryOf(s.x, s.y);
    if (!summary) continue;
    found.push({ key: `far:${summary.mapId}`, summary, x: s.x, y: s.y, d: Math.hypot(dx, dy) });
  }
  found.sort((a, b) => a.d - b.d || a.key.localeCompare(b.key));
  return found.slice(0, max);
}
