// @ts-check
// ROAD-DRY (FB1029, bible/01-Overview/bugs/Field-Bugs-2026-10-29c.md; a departure from Basic Roads and DFU,
// Port-Ledger A): Hazelnut's painter paves the sea at the sea's own height, so Deep Waters drew its water over the road.
// A painted paving tile's corners stand at CAPITAL_LAND at the least, a capital's freeboard. Pure and worker-safe.
import { CAPITAL_LAND } from '../terrain/capitalSea.js';
import { DIR } from './roadNetwork.js';

/** The paving records Basic Roads paints (roadPainter.js ROAD_TILES), the rotation and flip bits masked off. */
export const PAVING = Object.freeze(new Set([46, 47, 55]));
/** The edge samples a cardinal arm's two tiles touch where it crosses into the next pixel (roadPainter.js MID_LO..MID_HI). */
export const ARM_EDGE = Object.freeze([63, 64, 65]);

/**
 * Lifts every corner of a painted paving tile (`paths` marks the painter's tiles) to CAPITAL_LAND at the least, outside
 * the location's rect and its ring as smoothRoadHeights keeps off them. The pixel's edge samples are its neighbour's too:
 * they rise only where a cardinal arm crosses into it (`crossings`, roadCrossings'), as both pixels read the same bytes.
 * `samples` x * hDim + y, `tilemap` y * 128 + x. Answers how many samples it raised.
 * @param {Float32Array} samples @param {Uint8Array} tilemap @param {?Uint8Array} paths @param {number} [hDim]
 * @param {?{xMin: number, xMax: number, yMin: number, yMax: number, ring?: ?Uint8Array}} [rect] @param {?{N: boolean, E: boolean, S: boolean, W: boolean}} [crossings]
 */
export function dryRoadHeights(samples, tilemap, paths, hDim = 129, rect = null, crossings = null) {
  const tDim = hDim - 1;
  let n = 0;
  const lift = (k) => {
    if (samples[k] < CAPITAL_LAND) {
      samples[k] = CAPITAL_LAND;
      n++;
    }
  };
  for (let y = 0; paths && y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const i = y * tDim + x;
      if (!paths[i] || !PAVING.has(tilemap[i] & 0x3f)) continue;
      if (rect && x >= rect.xMin && x < rect.xMax && y >= rect.yMin && y < rect.yMax) continue;
      if (rect?.ring?.[i]) continue;
      for (const [cx, cy] of [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1],
      ])
        if (cx > 0 && cy > 0 && cx < tDim && cy < tDim) lift(cx * hDim + cy);
    }
  }
  for (const k of crossings ? ARM_EDGE : []) {
    if (crossings?.N) lift(k * hDim + tDim);
    if (crossings?.S) lift(k * hDim);
    if (crossings?.E) lift(tDim * hDim + k);
    if (crossings?.W) lift(k);
  }
  return n;
}

/** Where a road's cardinal arm crosses the pixel's edges on the Bay: its byte and the neighbour's carry each other's bit
 *  (`byteAt(x, y)` a pixel's road byte, `onBay(x, y)` whether a pixel is the Bay's). Pure. */
export function roadCrossings(px, py, byteAt, onBay) {
  const both = (dx, dy, bit, back) =>
    onBay(px + dx, py + dy) && !!(byteAt(px, py) & bit) && !!(byteAt(px + dx, py + dy) & back);
  return {
    N: both(0, -1, DIR.N, DIR.S),
    S: both(0, 1, DIR.S, DIR.N),
    E: both(1, 0, DIR.E, DIR.W),
    W: both(-1, 0, DIR.W, DIR.E),
  };
}
