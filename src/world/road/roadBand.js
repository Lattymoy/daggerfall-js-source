// @ts-check
// ═══════════════════════════════════════════════════════════════════
// VERGE1's BAND, ONE HOME FOR BOTH THREADS (JUNGLE-ROADSIDE, 2026-10-23; bible/03-World/Roads.md VERGE1): the band Basic
// Roads paints a road or a track as - two tiles wide about the line from a map pixel's centre to the edge or corner its
// compass bit names - and the room a point has beside it, measured as a disc to a segment. Moved here whole out of
// world/road/roadVerge.js, which re-exports it; it reads the network by Basic Roads' own port (world/road/pathData.js
// pathsDataPoint - AUDIT JUNGLE-ROADSIDE DOC-2: no second reader), so the terrain worker, which reaches world/ and
// formats/ alone (TAMRIEL2-WORKER), stands the jungle's roadside pairs off the very band VERGE1 keeps a flat off
// (world/jungle/jungleRoadside.js).
// ═══════════════════════════════════════════════════════════════════
import { pathsDataPoint, MP_WORLD_UNITS, N, NE, E, SE, S, SW, W, NW } from './pathData.js';
import { MAP_W, MAP_H } from './roadNetwork.js';
import { PATH_HALF_WIDTH, UNITS_PER_METRE } from './roadClearance.js';

/** A path's half width (m): Basic Roads paints a road or a track two tiles wide about its line. */
export const PATH_HALF_M = PATH_HALF_WIDTH / UNITS_PER_METRE;
/** A map pixel (m). */
const PIXEL_M = MP_WORLD_UNITS / UNITS_PER_METRE;
const HALF_M = PIXEL_M / 2;
/** Each compass bit's arm: from the pixel's centre to the edge or corner it names, in half pixels (x east, z north). */
export const ARMS = Object.freeze([[N, 0, 1], [NE, 1, 1], [E, 1, 0], [SE, 1, -1], [S, 0, -1], [SW, -1, -1], [W, -1, 0], [NW, -1, 1]]);

/**
 * THE ROOM BESIDE THE ROAD: how far (m) a pixel-local point - x east, z north, from the pixel's south-west corner, the
 * frame the nature flats and roadClearance.js share - stands from the nearest edge of a road's or a track's band, in its
 * own pixel or any other a band within `reach` of it runs through; `reach` when none comes nearer, 0 on one.
 * @param {object|null} net terrainGen.roads() - null answers `reach` (nothing is painted)
 * @param {number} px @param {number} py the pixel @param {number} x @param {number} z @param {number} reach (m)
 */
export function roadRoom(net, px, py, x, z, reach) {
  if (!net || !(reach > 0)) return Math.max(0, reach);
  const g = PATH_HALF_M + reach;
  // only the map's pixels are asked (OW-WOD-LAG's law, roadClearance.js): none past its edges has a road
  const ix0 = Math.max(-px, Math.floor((x - g) / PIXEL_M)), ix1 = Math.min(MAP_W - 1 - px, Math.floor((x + g) / PIXEL_M));
  const iz0 = Math.max(py - (MAP_H - 1), Math.floor((z - g) / PIXEL_M)), iz1 = Math.min(py, Math.floor((z + g) / PIXEL_M));
  let room = reach;
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const bits = pathsDataPoint(net, px + ix, py - iz);   // north (+z) is the row above: py - 1
      if (!bits) continue;
      const qx = x - (ix * PIXEL_M + HALF_M), qz = z - (iz * PIXEL_M + HALF_M);   // the point from that pixel's centre
      for (const [bit, sx, sz] of ARMS) {
        if (!(bits & bit)) continue;
        const ex = sx * HALF_M, ez = sz * HALF_M;
        const t = Math.min(1, Math.max(0, (qx * ex + qz * ez) / (ex * ex + ez * ez)));
        const d = Math.hypot(qx - t * ex, qz - t * ez) - PATH_HALF_M;
        if (d < room) room = Math.max(0, d);
      }
    }
  }
  return room;
}
