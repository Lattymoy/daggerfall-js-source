// ═══════════════════════════════════════════════════════════════════
// DW-B: WaterSurfaceManager.BuildSurfaceMesh (Iliac Puddle No More 1.2.2,
// jet082) - the sea's own surface over one streamed pixel: flat, at the
// sea's height plus SurfaceRenderYOffset, drawn twice by the host (the
// top from above, the underside from below - DW-C's programs).
//
// WHICH CELLS. 128 x 128, a terrain tile each:
//   - a tile the cap CLIPPED (its corners on the sea), or ANY water tile
//     of the pixel's MapData (the mod's own tile read - see
//     deepWaterClassification.js on its transposition; where it differs
//     it adds a quad under raised ground, which the depth test hides);
//   - else, a cell whose heights dip to the beach line (visually wet),
//     when the bake calls it shore, or one of four quarter-points is
//     water by the pixel's own heights or by the bake;
//   - grown along the pixel's edges toward a neighbour with water (the
//     first visually wet cell within 32 of the edge, flooded 4-connected
//     through visually wet cells);
//   - feathered four cells out (8-connected) through visually wet or
//     baked-shore cells.
// Then either one quad for a fully submerged pure-ocean pixel, or the
// cells merged into rectangles (a row's run, grown down while every row
// matches). The Animated Water bridge's uniform vertex grid is not taken:
// the port's water look (render/waterSurface.js, the enhanced lane's
// WATER1, the animated water this host has) moves no vertices.
// ═══════════════════════════════════════════════════════════════════

import {
  mapDataHasWater, mapDataFullySubmerged, cellContainsWaterTile, isCellVisuallyWet,
  isLocalPointWater, isLocalPointPureWaterTile,
} from './deepWaterClassification.js';
import { shouldClipPromotedWaterTexel } from './deepWaterCap.js';
import { WORLD_MAP_TILE_DIM } from './terrainTiles.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const SURFACE_GRID_RESOLUTION = 128;
const SHORELINE_SEED_SCAN_CELLS = 32;
const SHORELINE_SURFACE_FEATHER_CELLS = 4;
/** SurfaceRenderYOffset: the surface's height over the sea's own. */
export const SURFACE_RENDER_Y_OFFSET = 0.03;
const TILE_WORLD_SIZE = 819.2;

/** ShouldHaveSurface: the pixel has water, or the bake gives it or a cardinal neighbour sea. */
export function shouldHaveSurface(mapPixelX, mapPixelY, mapData, bake) {
  if (mapDataHasWater(mapData)) return true;
  if (!bake || !bake.loaded) return false;
  return bake.mapPixelOrCardinalNeighborHasWaterCells(mapPixelX, mapPixelY);
}

/** IsFullWaterTile. */
function isFullWaterTile(mapPixelX, mapPixelY, mapData, bake, hasOwnWater) {
  if (!hasOwnWater) return false;
  if (!bake || !bake.loaded) return true;
  if (!bake.mapPixelHasWaterCells(mapPixelX, mapPixelY) || bake.mapPixelHasLandCells(mapPixelX, mapPixelY)) return false;
  return mapDataFullySubmerged(mapData);
}

/**
 * BuildSurfaceMesh.
 * @param {object} p
 * @param {number} p.mapPixelX
 * @param {number} p.mapPixelY
 * @param {object} p.mapData - {samples, tilemap}
 * @param {Uint8Array} p.tilemapBytes - the pixel's converted tilemap (DFU's TileMap .a), unpatched
 * @param {?object} p.tile - the pixel's DeepWaterTileData
 * @param {?object} p.bake
 * @returns {?{positions: Float32Array, uvs: Float32Array, indices: Uint32Array, cells: ?Uint8Array}} pixel-local, y 0 (the host lifts it)
 */
export function buildSurfaceMesh({ mapPixelX, mapPixelY, mapData, tilemapBytes, tile, bake }) {
  const num = SURFACE_GRID_RESOLUTION;
  const x = TILE_WORLD_SIZE, z = TILE_WORLD_SIZE;
  const flag2 = mapDataHasWater(mapData);
  const flag3 = !!bake && bake.loaded && bake.mapPixelHasWaterCells(mapPixelX, mapPixelY);
  const positions = [], uvs = [], indices = [];
  if (isFullWaterTile(mapPixelX, mapPixelY, mapData, bake, flag2)) {
    appendSurfaceQuad(0, 1, 0, 1, x, z, positions, uvs, indices);
    return finish(positions, uvs, indices, null);
  }
  const cells = new Uint8Array(num * num);
  if (flag2 || flag3) {
    for (let i = 0; i < num; i++) for (let j = 0; j < num; j++) if (isSurfaceCellWater({ mapPixelX, mapPixelY, mapData, tilemapBytes, tile, bake }, j, i, num)) cells[i * num + j] = 1;
  }
  addNeighborWaterConnectedShoreline({ mapPixelX, mapPixelY, mapData, tile, bake }, cells, num);
  addLocalShorelineFeather({ mapPixelX, mapPixelY, mapData, bake }, cells, num);
  const used = new Uint8Array(num * num);
  for (let k = 0; k < num; k++) {
    for (let l = 0; l < num; l++) {
      if (!cells[k * num + l] || used[k * num + l]) continue;
      let m = 1;
      while (l + m < num && cells[k * num + l + m] && !used[k * num + l + m]) m++;
      let num2 = 1, flag5 = true;
      while (k + num2 < num && flag5) {
        for (let n = l; n < l + m; n++) {
          if (!cells[(k + num2) * num + n] || used[(k + num2) * num + n]) { flag5 = false; break; }
        }
        if (flag5) num2++;
      }
      for (let a = k; a < k + num2; a++) for (let b = l; b < l + m; b++) used[a * num + b] = 1;
      appendSurfaceQuad(l / num, (l + m) / num, k / num, (k + num2) / num, x, z, positions, uvs, indices);
    }
  }
  if (positions.length === 0) return null;
  return finish(positions, uvs, indices, cells);
}

function finish(positions, uvs, indices, cells) {
  return { positions: Float32Array.from(positions), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices), cells };
}

/** AppendSurfaceQuad: two triangles, Unity's winding (0, 2, 1), (0, 3, 2). */
function appendSurfaceQuad(fracX0, fracX1, fracZ0, fracZ1, sizeX, sizeZ, positions, uvs, indices) {
  const num = fracX0 * sizeX, num2 = fracX1 * sizeX, num3 = fracZ0 * sizeZ, num4 = fracZ1 * sizeZ;
  const count = positions.length / 3;
  positions.push(num, 0, num3, num2, 0, num3, num2, 0, num4, num, 0, num4);
  uvs.push(fracX0, fracZ0, fracX1, fracZ0, fracX1, fracZ1, fracX0, fracZ1);
  indices.push(count, count + 2, count + 1, count, count + 3, count + 2);
}

/** IsSurfaceCellWater. */
function isSurfaceCellWater(ctx, cellX, cellZ, resolution) {
  const { mapData } = ctx;
  if (cellContainsPromotedClippedWaterTile(ctx, cellX, cellZ, resolution) || cellContainsWaterTile(mapData, cellX, cellZ, resolution)) return true;
  if (!isCellVisuallyWet(mapData, cellX, cellZ, resolution)) return false;
  if (isBakedShoreSurfaceCell(ctx, cellX, cellZ, resolution)) return true;
  const num = cellX / resolution, num2 = (cellX + 1) / resolution, num3 = cellZ / resolution, num4 = (cellZ + 1) / resolution;
  if (!isSurfaceSampleWater(ctx, lerp(num, num2, 0.25), lerp(num3, num4, 0.25))
    && !isSurfaceSampleWater(ctx, lerp(num, num2, 0.75), lerp(num3, num4, 0.25))
    && !isSurfaceSampleWater(ctx, lerp(num, num2, 0.25), lerp(num3, num4, 0.75))) {
    return isSurfaceSampleWater(ctx, lerp(num, num2, 0.75), lerp(num3, num4, 0.75));
  }
  return true;
}

function isBakedSurfaceWater(ctx, fracX, fracZ) {
  return !!ctx.bake && ctx.bake.loaded && ctx.bake.isWaterAt(ctx.mapPixelX, ctx.mapPixelY, fracX, fracZ);
}

/** CellContainsPromotedClippedWaterTile: over the TileMap - z * dim + x, not transposed. */
function cellContainsPromotedClippedWaterTile(ctx, cellX, cellZ, resolution) {
  const tm = ctx.tilemapBytes;
  if (!tm || resolution <= 0) return false;
  const num = WORLD_MAP_TILE_DIM;
  const num2 = clampInt(Math.trunc((cellX * num) / resolution), 0, num - 1);
  const num3 = clampInt(Math.trunc(((cellX + 1) * num - 1) / resolution), 0, num - 1);
  const num4 = clampInt(Math.trunc((cellZ * num) / resolution), 0, num - 1);
  const num5 = clampInt(Math.trunc(((cellZ + 1) * num - 1) / resolution), 0, num - 1);
  for (let i = num4; i <= num5; i++) for (let j = num2; j <= num3; j++) if (shouldClipPromotedWaterTexel(ctx.mapData, tm[i * num + j], j, i, num)) return true;
  return false;
}

/** IsSurfaceSampleWater. */
function isSurfaceSampleWater(ctx, fracX, fracZ) {
  const { mapData, tile } = ctx;
  if (isLocalPointWater(mapData, fracX, fracZ)) return true;
  if (!tile || !tile.isOceanConnected || !tile.hasDistanceField) return false;
  if (isLocalPointPureWaterTile(mapData, fracX, fracZ)) return tile.isBakedWater(fracX * TILE_WORLD_SIZE, fracZ * TILE_WORLD_SIZE);
  return false;
}

/** IsBakedShoreSurfaceCell: the centre or any quarter-point of the cell is sea in the bake. */
function isBakedShoreSurfaceCell(ctx, cellX, cellZ, resolution) {
  if (!ctx.bake || !ctx.bake.loaded || resolution <= 0) return false;
  const num = cellX / resolution, num2 = (cellX + 1) / resolution, num3 = cellZ / resolution, num4 = (cellZ + 1) / resolution;
  if (!isBakedSurfaceWater(ctx, lerp(num, num2, 0.5), lerp(num3, num4, 0.5))
    && !isBakedSurfaceWater(ctx, lerp(num, num2, 0.25), lerp(num3, num4, 0.25))
    && !isBakedSurfaceWater(ctx, lerp(num, num2, 0.75), lerp(num3, num4, 0.25))
    && !isBakedSurfaceWater(ctx, lerp(num, num2, 0.25), lerp(num3, num4, 0.75))) {
    return isBakedSurfaceWater(ctx, lerp(num, num2, 0.75), lerp(num3, num4, 0.75));
  }
  return true;
}

/** AddNeighborWaterConnectedShoreline. */
function addNeighborWaterConnectedShoreline(ctx, cells, n) {
  const { bake, tile, mapData, mapPixelX, mapPixelY } = ctx;
  if (!bake || !bake.loaded) return;
  if (!tile || !tile.isOceanConnected) return;
  const neighborHasWater = (x, y) => bake.mapPixelHasWaterCells(x, y) || bake.mapPixelHasFineWaterCells(x, y);
  const flag = neighborHasWater(mapPixelX - 1, mapPixelY);
  const flag2 = neighborHasWater(mapPixelX + 1, mapPixelY);
  const flag3 = neighborHasWater(mapPixelX, mapPixelY - 1);
  const flag4 = neighborHasWater(mapPixelX, mapPixelY + 1);
  if (!flag && !flag2 && !flag3 && !flag4) return;
  const visited = new Uint8Array(n * n);
  const queue = [];
  let qh = 0;
  const enqueueShoreCell = (x, z) => {
    if (x >= 0 && z >= 0 && x < n && z < n && !visited[z * n + x]) {
      visited[z * n + x] = 1;
      if (isCellVisuallyWet(mapData, x, z, n)) queue.push((z << 16) | x);
    }
  };
  const enqueueFirstSubmergedShoreCell = (startX, stepX, startZ, stepZ) => {
    const num = Math.min(SHORELINE_SEED_SCAN_CELLS, n);
    for (let i = 0; i < num; i++) {
      const x = startX + stepX * i, z = startZ + stepZ * i;
      if (!(x >= 0 && z >= 0 && x < n && z < n)) break;
      if (isCellVisuallyWet(mapData, x, z, n)) { enqueueShoreCell(x, z); break; }
    }
  };
  // West, east, then the pixel's z = 0 row for mapPixelY - 1 and z = n - 1 for mapPixelY + 1 - the C#'s pairing.
  if (flag) for (let i = 0; i < n; i++) enqueueFirstSubmergedShoreCell(0, 1, i, 0);
  if (flag2) for (let j = 0; j < n; j++) enqueueFirstSubmergedShoreCell(n - 1, -1, j, 0);
  if (flag3) for (let k = 0; k < n; k++) enqueueFirstSubmergedShoreCell(k, 0, 0, 1);
  if (flag4) for (let l = 0; l < n; l++) enqueueFirstSubmergedShoreCell(l, 0, n - 1, -1);
  while (qh < queue.length) {
    const v = queue[qh++];
    const x = v & 0xffff, z = v >> 16;
    cells[z * n + x] = 1;
    enqueueShoreCell(x - 1, z);
    enqueueShoreCell(x + 1, z);
    enqueueShoreCell(x, z - 1);
    enqueueShoreCell(x, z + 1);
  }
}

/** AddLocalShorelineFeather: four cells out, 8-connected, through visually wet or baked-shore cells. */
function addLocalShorelineFeather(ctx, cells, n) {
  const depth = new Int32Array(n * n);
  const queue = [];
  let qh = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (cells[i * n + j]) { depth[i * n + j] = 1; queue.push((i << 16) | j); }
  while (qh < queue.length) {
    const v = queue[qh++];
    const x = v & 0xffff, z = v >> 16;
    const d = depth[z * n + x];
    if (d > SHORELINE_SURFACE_FEATHER_CELLS) continue;
    for (let k = -1; k <= 1; k++) {
      for (let l = -1; l <= 1; l++) {
        if (l === 0 && k === 0) continue;
        const x2 = x + l, z2 = z + k;
        if (x2 >= 0 && z2 >= 0 && x2 < n && z2 < n && depth[z2 * n + x2] === 0) {
          depth[z2 * n + x2] = d + 1;
          if (isCellVisuallyWet(ctx.mapData, x2, z2, n) || isBakedShoreSurfaceCell(ctx, x2, z2, n)) {
            cells[z2 * n + x2] = 1;
            queue.push((z2 << 16) | x2);
          }
        }
      }
    }
  }
}
