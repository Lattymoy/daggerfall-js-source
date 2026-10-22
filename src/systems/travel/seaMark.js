// @ts-check
// FIELD BUGS 2026-10-21d PASSAGE-IN (Harlander, the Discord's #bug-reports, "Booked ocean passage ...": "Fast travel gets
// stuck on docks and tries to path up onto land"): WHERE A SAILED LEG IS AIMED. The planner reads one heightmap byte a
// map pixel (travelRoute.js routeGround: water at WATER_BYTE or under), and OWS2 aims a leg sailed into a pixel at its
// middle quarter (travelOptions.js SEA_LEG_LO / SEA_LEG_SIZE - the autopilot's rect, and the journey's hand steering at
// its centre: world.js tvSeaMark). But the boat floats on the GROUND THE GAME BUILT for that pixel - its 128 tiles a
// side (Come Sail Away's nodes) - and near a coast the heightmap's water is that ground's land: Wayrest's approach
// (859,246) is 13% water and its middle quarter none, Daggerfall's (207,215) none at all, Sentinel's (397,341) 34% and
// its middle none. Measured on the real map, 80 of the 527 sailed legs of 56 voyages to those three ports were aimed where
// the built ground was land - she ran at the shore until "no way on", or aground, beside the docks.
//
// The mark is the pixel's middle where it floats her, as ever; where it does not, the nearest water to it that does - a
// block of 5 by 5 tiles (32 m, room for her hull) - on the built ground.
// AUDIT FB1021d PS-1: and the two this first left aimed at land. A pixel NOT BUILT yet (the host's reader answers null -
// world.js tvSeaWaterAt) is SEA_LEG_UNBUILT: a leg folds a straight run, so the pixel it is aimed into can stand past the
// ground built about her (TerrainDistance 3) when it begins - 23 of the 55 legs the mark moved - and Travel Options aims
// it again once that ground is built. A pixel built where nowhere floats her is SEA_LEG_DRY - 25 of the 527 sailed legs,
// 14 of them into Daggerfall's approach (207,215), which has no water at all - and the leg is passed: she makes for the
// next (the landfall's own run in, where it is the last at sea).

import { MP_WORLD_UNITS, T_SIZE as TILE } from './travelPaths.js';

/** A map pixel's tiles, the built ground's 128 a side (travelPaths.js: MPworldUnits over TSize). */
export const PIXEL_TILES = MP_WORLD_UNITS / TILE;
/** Half the block of water a mark must stand in, in tiles: 5 by 5 - 32 m. */
export const MARK_BLOCK_HALF = 2;
/** A leg's pixel whose ground is not built yet - aimed at its middle, and again once it is. */
export const SEA_LEG_UNBUILT = Object.freeze({ unbuilt: true });
/** A leg's pixel built where nowhere floats her - the leg is passed. */
export const SEA_LEG_DRY = Object.freeze({ dry: true });

/**
 * The point a leg sailed into a map pixel is aimed at, in native units - or null where its middle floats her (the
 * middle quarter stands), SEA_LEG_UNBUILT where its ground is not built yet, SEA_LEG_DRY where nothing in it floats her.
 * @param {{ x: number, z: number }} origin - the pixel's corner (travelPaths.js mapPixelWorldOrigin)
 * @param {((x: number, z: number) => boolean | null) | null | undefined} waterAt - the built ground's water, native
 *  units: null where no ground is built
 * @returns {{ x: number, z: number } | typeof SEA_LEG_UNBUILT | typeof SEA_LEG_DRY | null}
 */
export function seaLegMark(origin, waterAt) {
  if (typeof waterAt !== 'function') return null;
  const floats = (/** @type {number} */ x, /** @type {number} */ z) => {
    for (let a = -MARK_BLOCK_HALF; a <= MARK_BLOCK_HALF; a++) for (let b = -MARK_BLOCK_HALF; b <= MARK_BLOCK_HALF; b++) if (!waterAt(x + a * TILE, z + b * TILE)) return false;
    return true;
  };
  const mid = PIXEL_TILES / 2;
  const at = (/** @type {number} */ i, /** @type {number} */ j) => ({ x: origin.x + (i + 0.5) * TILE, z: origin.z + (j + 0.5) * TILE });
  const centre = { x: origin.x + MP_WORLD_UNITS / 2, z: origin.z + MP_WORLD_UNITS / 2 };
  if (waterAt(centre.x, centre.z) === null) return SEA_LEG_UNBUILT;
  if (floats(centre.x, centre.z)) return null;
  const lo = MARK_BLOCK_HALF, hi = PIXEL_TILES - 1 - MARK_BLOCK_HALF;
  /** @type {{ x: number, z: number } | null} */
  let best = null, bestD = Infinity;
  // ring by ring out from the middle; a ring wholly farther than the nearest found ends the walk
  for (let r = 0; r <= mid; r++) {
    if ((r - 1) * TILE > bestD) break;
    for (let i = mid - 1 - r; i <= mid + r; i++) {
      for (let j = mid - 1 - r; j <= mid + r; j++) {
        const onRing = i === mid - 1 - r || i === mid + r || j === mid - 1 - r || j === mid + r;
        if (!onRing || i < lo || i > hi || j < lo || j > hi) continue;
        const p = at(i, j), d = Math.hypot(p.x - centre.x, p.z - centre.z);
        if (d < bestD && floats(p.x, p.z)) { best = p; bestD = d; }
      }
    }
  }
  return best ?? SEA_LEG_DRY;
}
