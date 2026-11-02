// @ts-check
// FB1029 BRIDGE-ENDS (AUDIT FB1029 A2; bible/01-Overview/bugs/Field-Bugs-2026-10-29b.md) - A CAPITAL'S WORKS SHUT TO ITS
// WALKERS. The walkers stand on the terrain (scenes/pixelBuild.js personGroundY), and a landmark's walkable top over
// Daggerfall's own blocks left their automaps' cells open under it: Alinor's bridges' abutments were road, the cheapest
// ground, and the town's people walked a metre sunk in the stone. Each rect here is closed on the slice's navgrid.
import { CAPITALS, capitalDims, capitalCentre, BLOCK_M } from './tamrielCapitals.js';
import { alinorAbutments } from './capitalAlinor.js';
import { NAV_CELL } from './city/cityNavigation.js';

/** Each capital's rects ([x0, z0, x1, z1], its anchor's metres, z south) its walkers keep off. */
const SHUT = Object.freeze({ alinor: () => alinorAbutments() });

/** @param {any} cap a CAPITALS entry @returns {Array<number[]>} */
export const capitalWalkShut = (cap) => SHUT[cap?.key]?.() ?? [];

/**
 * Close a capital slice's walkers' cells under its works (capitalWalkShut): `nav` the slice's navgrid in the location's
 * frame (x east, z north, cells of NAV_CELL - world/city/cityNavigation.js), `dfLocation` the slice as built (its
 * `capital`, as world/tamrielCapitals.js capitalBlockLift reads it). Answers how many cells it closed.
 * @param {any} nav @param {any} dfLocation
 */
export function carveCapitalWalks(nav, dfLocation) {
  const cap = dfLocation?.capital ? CAPITALS[dfLocation.capital.k] : null;
  const rects = capitalWalkShut(cap);
  if (!nav?.grid || !rects.length) return 0;
  const D = capitalDims(cap),
    s = dfLocation.capital.s ?? capitalCentre(cap),
    h = dfLocation.exterior?.exteriorData?.height ?? 8;
  const ox = (cap.anchor[0] - (s % D.w) * 8) * BLOCK_M,
    oz = (Math.floor(s / D.w) * 8 + h - cap.anchor[1]) * BLOCK_M;
  const lo = (v) => Math.floor(v / NAV_CELL + 1e-6),
    hi = (v) => Math.ceil(v / NAV_CELL - 1e-6); // a rect's edge on a cell's line closes no cell past it
  let n = 0;
  for (const [x0, z0, x1, z1] of rects) {
    for (let gy = lo(oz - z1); gy < hi(oz - z0); gy++) {
      for (let gx = lo(x0 + ox); gx < hi(x1 + ox); gx++) {
        if (!nav.inBounds(gx, gy)) continue;
        const i = gy * nav.width + gx;
        if (nav.grid[i] !== 0) {
          nav.grid[i] = 0;
          n++;
        }
      }
    }
  }
  return n;
}
