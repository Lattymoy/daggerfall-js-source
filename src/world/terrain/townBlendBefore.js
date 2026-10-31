// FB1028 TOWN-GROUND (GROUND_FRAME_LAW 4, terrainSampler.js; bible/03-World/Town-Shapes.md "TS2 at FB1028"): TS2'S TOWN
// BLEND BEFORE FB1028, kept for one reader alone - how far DFU's own ground under a record moved when the blend changed
// (world/landforms.js townGroundMovedField). No ground is drawn on it. It is terrainTiles.js's townGroundMask and
// blendShapedTerrain as they stood at 2036a509e, the classic pass's reading (floored, never a difference of grounds).
import { WORLD_MAP_TILE_DIM, isWaterHeight, sampleHeight, outlineOfBasis } from './terrainTiles.js';
import { MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION } from './terrainSampler.js';
import { tileDistance, shapeFieldDistance, TOWN_SHAPE } from '../townShape.js';

const BLEND_TILES = 12,
  EDGE_TILES = 4;
const FLOOR = Math.fround((SCALED_BEACH_ELEVATION + 1) / MAX_TERRAIN_HEIGHT);

/** The outline before FB1028's CROP-GROUND - its fields' tiles left out (`shape.basis`, locationShapeField's), or the
 *  shape as it is where it carries no basis or no fields. @param {any} shape @param {number} seed the map id */
export function shapeBefore(shape, seed) {
  return shape?.basis?.fields ? outlineOfBasis({ ...shape.basis, fields: null }, seed) : shape;
}

/** TS2's town ground before FB1028 (townGroundMask at 2036a509e): the outline's tiles, less those past its sea margin over
 *  water - no edge band. FB1028 YARDS Y2: the yards' ground too, over shapeBefore's outline (terrainGen.js `yardGround`).
 *  @param {Uint8Array} shape @param {ArrayLike<number>} ground @param {number} hDim */
export function townGroundMaskBefore(shape, ground, hDim) {
  const D = WORLD_MAP_TILE_DIM,
    wetAt = (x, y) => isWaterHeight(sampleHeight(ground[Math.min(y, hDim - 1) + Math.min(x, hDim - 1) * hDim]));
  const mask = new Uint8Array(D * D);
  for (let i = 0; i < D * D; i++) {
    const x = i % D,
      y = (i - x) / D;
    if (shape[i])
      mask[i] = shapeFieldDistance(shape[i]) <= TOWN_SHAPE.seaMargin || !(wetAt(x, y) || wetAt(x + 1, y + 1)) ? 1 : 0;
  }
  return mask;
}

/**
 * The blend before FB1028 over `heightmapData` (mutated): the town's ground at its land's mean, eased back over 12
 * samples, the sea past its margin kept, every sample faded out in the pixel's last four. Answers the height it
 * flattened to, or null where the town has no dry ground (DFU's rect blend stood there).
 * @param {Float32Array} heightmapData @param {Uint8Array} shape @param {ArrayLike<number>} ground @param {number} hDim
 */
export function blendShapedBefore(heightmapData, shape, ground, hDim) {
  const D = WORLD_MAP_TILE_DIM,
    mask = townGroundMaskBefore(shape, ground, hDim);
  const inside = new Uint8Array(hDim * hDim);
  const on = (x, y) => x >= 0 && y >= 0 && x < D && y < D && mask[x + y * D] === 1;
  for (let y = 0; y < hDim; y++)
    for (let x = 0; x < hDim; x++)
      inside[y * hDim + x] = on(x, y) || on(x - 1, y) || on(x, y - 1) || on(x - 1, y - 1) ? 1 : 0;
  let sum = 0,
    n = 0;
  for (let y = 0; y < hDim; y++)
    for (let x = 0; x < hDim; x++) {
      const idx = y + x * hDim;
      if (inside[y * hDim + x] && !isWaterHeight(sampleHeight(ground[idx]))) {
        sum += heightmapData[idx];
        n++;
      }
    }
  if (!n) return null;
  const target = Math.max(Math.fround(sum / n), FLOOR),
    dist = tileDistance(inside, hDim, hDim);
  for (let y = 0; y < hDim; y++)
    for (let x = 0; x < hDim; x++) {
      const idx = y + x * hDim,
        d = dist[y * hDim + x];
      const edge = Math.min(1, Math.min(x, y, hDim - 1 - x, hDim - 1 - y) / EDGE_TILES);
      let s = d === 0 ? 1 : Math.max(0, 1 - d / BLEND_TILES);
      s = s * s * (3 - 2 * s);
      if (d > TOWN_SHAPE.seaMargin && isWaterHeight(sampleHeight(ground[idx]))) s = 0;
      s *= edge * edge * (3 - 2 * edge);
      if (s > 0) heightmapData[idx] = heightmapData[idx] + (target - heightmapData[idx]) * s;
    }
  return target;
}
