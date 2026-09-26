// ═══════════════════════════════════════════════════════════════════
// DW-B (2026-09-25): ONE STREAMED PIXEL'S DEEP WATERS, WHOLE. What
// Iliac Puddle No More 1.2.2 (jet082) does when DFU promotes a terrain,
// in its own order and as data:
//
//   DeepWaterFloorBuilder.HandlePromoteCore - the tile data; no ocean
//     connection, no bake or no carved cell is RemoveFloor (no floor,
//     and the cap Restored: nothing clipped, nothing hidden); else the
//     hole mask, the floor with its walls, then UpdateTerrainCapRenderer
//     (the pure-ocean hide, or the water texels' clip and repaint);
//   WaterSurfaceManager.HandlePromoteCore - with Spawn Water Surfaces on
//     and ShouldHaveSurface, the surface mesh over the same tile data.
//
// Pure: the Deep Waters worker runs it (deepWatersWorker.js), and this
// thread when no worker can (deepWatersClient.js) - the same function,
// the same answer. Everything the C# reaches for through Unity is an
// argument: the pixel's own MapPixelData (heights and raw tiles), its
// converted TileMap (the cap patches it), the 3 x 3 climates around it
// (all DeepWaterTileData ever reads), the four neighbours' heights where
// they are streamed (DeepWaterTerrainLookup's answer to the floor's
// shore fit a meter past the edge), and the two settings the geometry
// reads (Water Depth, Spawn Water Surfaces).
// ═══════════════════════════════════════════════════════════════════

import { SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION, STREAMING_TERRAIN_SCALE } from './terrainSampler.js';
import { DeepWaterTileData } from './deepWaterTileData.js';
import { computeHoleMask, buildFloorMesh, TILE_WORLD_SIZE } from './deepWaterFloor.js';
import { capDecision } from './deepWaterCap.js';
import { buildSurfaceMesh, shouldHaveSurface } from './deepWaterSurface.js';

const f32 = Math.fround;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

/** terrainData.size.y: MaxTerrainHeight at the game scene's terrain scale (TERRAIN-SCALE1). */
export const DW_TERRAIN_HEIGHT = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
/** OceanElevation / MaxTerrainHeight * terrainData.size.y: the sea's pixel-local height (34 m). */
export const DW_OCEAN_LOCAL_Y = f32(f32(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT) * DW_TERRAIN_HEIGHT);
/** DeepWaterTerrainLookup.SnapshotEntryContains' slack past a terrain's edge. */
const LOOKUP_SLACK = 0.25;

/**
 * The bilinear read SampleNearbyVanillaWorldY makes of ONE terrain's
 * heights at a local point - the fraction clamped to the terrain, rows
 * from z, columns from x (heightmapSamples[z, x] = samples[x * 129 + z]).
 */
export function terrainLocalY(samples, lx, lz, terrainHeight = DW_TERRAIN_HEIGHT) {
  const n = HEIGHTMAP_DIMENSION;
  const num3 = clamp01(lx / TILE_WORLD_SIZE) * (n - 1);
  const num4 = clamp01(lz / TILE_WORLD_SIZE) * (n - 1);
  const num5 = clampInt(Math.floor(num3), 0, n - 2);
  const num6 = clampInt(Math.floor(num4), 0, n - 2);
  const num7 = num3 - num5, num8 = num4 - num6;
  const at = (row, col) => samples[col * n + row];
  const num9 = lerp(at(num6, num5), at(num6, num5 + 1), num7);
  const num10 = lerp(at(num6 + 1, num5), at(num6 + 1, num5 + 1), num7);
  return lerp(num9, num10, num8) * terrainHeight;
}

/**
 * DeepWaterTerrainLookup.TryGetByWorldPosition + SampleNearbyVanillaWorldY,
 * pixel-local: this pixel's own heights for a point on it (its footprint
 * and the lookup's quarter-meter slack), else the cardinal neighbour the
 * point falls on - its heights at its own local point - or null where that
 * neighbour is not streamed. Every terrain of a streamed world stands at
 * the same height, so a neighbour's local Y is this pixel's.
 * @param {Float32Array} samples - this pixel's
 * @param {{w?: ?Float32Array, e?: ?Float32Array, s?: ?Float32Array, n?: ?Float32Array}} neighbours - west (px - 1), east (px + 1), south (py + 1), north (py - 1)
 */
export function nearbyLocalYReader(samples, neighbours = {}, terrainHeight = DW_TERRAIN_HEIGHT) {
  const size = TILE_WORLD_SIZE;
  return (lx, lz) => {
    if (!Number.isFinite(lx) || !Number.isFinite(lz)) return null;
    const inX = lx >= -LOOKUP_SLACK && lx <= size + LOOKUP_SLACK;
    const inZ = lz >= -LOOKUP_SLACK && lz <= size + LOOKUP_SLACK;
    if (inX && inZ) return terrainLocalY(samples, lx, lz, terrainHeight);
    const dx = lx < 0 ? -1 : lx > size ? 1 : 0;
    const dz = lz < 0 ? -1 : lz > size ? 1 : 0;
    if (dx !== 0 && dz !== 0) return null;   // the floor's probes are a meter along one axis: a corner is never asked
    const other = dx < 0 ? neighbours.w : dx > 0 ? neighbours.e : dz < 0 ? neighbours.s : neighbours.n;
    if (!other) return null;
    return terrainLocalY(other, lx - dx * size, lz - dz * size, terrainHeight);
  };
}

/**
 * HandlePromoteCore, floor then surface.
 * @param {object} job
 * @param {number} job.px
 * @param {number} job.py
 * @param {Float32Array} job.samples - the streamed heights (x * 129 + z)
 * @param {Uint8Array} job.tilemap - the raw 128 x 128 tilemap (y * 128 + x)
 * @param {Uint8Array} job.tilemapBytes - the converted TileMap the texture holds
 * @param {ArrayLike<number>} job.climates - MapsFile climates of the 3 x 3 around the pixel, rows north to south ((dy + 1) * 3 + dx + 1), the map-clamped reads
 * @param {object} [job.neighbours] - nearbyLocalYReader's
 * @param {?number} job.waterDepth - the Water Depth setting
 * @param {boolean} job.spawnSurfaces - the Spawn Water Surfaces setting
 * @param {object} bake - a DeepWatersBake (loaded)
 * @returns {{px: number, py: number, ocean: boolean, fallback: boolean, biomeClimateIndex: number,
 *   holes: ?Uint8Array, floor: ?object, cap: {hide: boolean, tilemap: ?Uint8Array}, surface: ?object, planes: Array}}
 */
export function buildDeepWatersPixel(job, bake) {
  const { px, py, samples, tilemap, tilemapBytes, climates, waterDepth } = job;
  const mapData = { samples, tilemap };
  // ClimateAtPixel reads only the 3 x 3: the pixel's own neighbourhood, map-clamped (IsValid-guarded where the C# guards)
  const climateAt = (x, y) => climates[clampInt(y - py + 1, 0, 2) * 3 + clampInt(x - px + 1, 0, 2)];
  prepareBake(bake, px, py);
  const tile = new DeepWaterTileData({ mapPixelX: px, mapPixelY: py, mapData, climateIndex: climates[4], climateAt, bake });
  let holes = null, floor = null;
  let cap = { hide: false, tilemap: null };
  if (tile.isOceanConnected && tile.hasDistanceField) {
    const mask = computeHoleMask(mapData, tile, bake);
    if (mask && mask.any) {
      holes = mask.holes;
      floor = buildFloorMesh({
        mapData, tile, holes, oceanLocalY: DW_OCEAN_LOCAL_Y, terrainHeight: DW_TERRAIN_HEIGHT, waterDepth,
        nearbyLocalY: nearbyLocalYReader(samples, job.neighbours ?? {}),
      });
      cap = capDecision(px, py, mapData, tilemapBytes, bake);
    }
  }
  const surface = job.spawnSurfaces && shouldHaveSurface(px, py, mapData, bake)
    ? buildSurfaceMesh({ mapPixelX: px, mapPixelY: py, mapData, tilemapBytes, tile, bake })
    : null;
  return {
    px, py,
    ocean: tile.isOceanConnected, fallback: tile.usesLocalWaterFallback, biomeClimateIndex: tile.biomeClimateIndex,
    holes, floor, cap, surface,
    planes: typeof bake?.exportPlanes === 'function' ? bake.exportPlanes(px, py) : [],
  };
}

function prepareBake(bake, px, py) {
  if (bake && typeof bake.prepare === 'function') bake.prepare(px, py);
}

/** Every ArrayBuffer a result owns, for a transfer list. */
export function deepWatersPixelTransfers(result) {
  const out = new Set();
  const add = (a) => { if (a && a.buffer instanceof ArrayBuffer) out.add(a.buffer); };
  add(result.holes);
  if (result.floor) for (const k of ['positions', 'colors', 'uvs', 'indices', 'vertexLocalY', 'floorQuadWater']) add(result.floor[k]);
  add(result.cap?.tilemap);
  if (result.surface) for (const k of ['positions', 'uvs', 'indices', 'cells']) add(result.surface[k]);
  for (const r of result.planes ?? []) { add(r.fine); add(r.dist); add(r.edge); }
  return [...out];
}
