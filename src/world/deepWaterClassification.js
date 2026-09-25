// ═══════════════════════════════════════════════════════════════════
// DW-B (2026-09-25): DeepWaterWaterClassification.cs (Iliac Puddle No
// More 1.2.2, jet082) - which part of a streamed pixel is water, asked
// of the pixel's own MapPixelData. Member for member, float for float.
//
// THE MAPDATA THE MOD READS, AS DFU HOLDS IT. Two arrays, and they do not
// share an index order (DaggerfallTerrain.CompleteMapPixelDataUpdate):
//   heightmapSamples[y, x]  - Row/Col of the job's x * dim + y layout, so
//                             [a, b] = samples[b * 129 + a] in the port's
//                             Float32Array (y north, x east);
//   tilemapSamples[x, y]    - the same Row/Col over the tile job's
//                             x + y * dim layout, so [a, b] = the tile at
//                             x = a, y = b: the port's raw tilemap
//                             [b * 128 + a], its 0xFF location sentinel
//                             back to record 0 as DFU restores it.
// DFU's own TerrainNature reads tilemapSamples[x, y]. The mod indexes it
// [z, x] - with the row from fracZ, as it indexes the heights - so every
// tile it reads here is the tile TRANSPOSED across the pixel's diagonal.
// The port keeps the mod's reads exactly (bible/03-World/Deep-Waters.md,
// "The tile reads"): where they land differently from the heights, the
// only thing they add is a water-surface quad at sea level under ground
// that stands above it, which nothing sees.
//
// `mapData` here is {samples, tilemap}: the pixel's streamed heights
// (terrainGen's, after the location blend, the roads and World of
// Daggerfall) and its RAW 128 x 128 tilemap (y * 128 + x) - what DFU's
// MapPixelData holds when DaggerfallTerrain.OnPromoteTerrainData fires.
// ═══════════════════════════════════════════════════════════════════

import { SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from './terrainTiles.js';
import { roundToInt } from '../systems/mathf.js';
import { WATER_THRESHOLD } from './deepWatersBake.js';

const f32 = Math.fround;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** TryGetWaterThreshold: OceanElevation / MaxTerrainHeight + 1E-05f. */
export const DW_WATER_THRESHOLD = WATER_THRESHOLD;
/** TryGetCarveWaterThreshold: (OceanElevation + CarveWaterHeadroomMeters 0.25) / MaxTerrainHeight. */
export const DW_CARVE_THRESHOLD = f32(f32(SCALED_OCEAN_ELEVATION + f32(0.25)) / MAX_TERRAIN_HEIGHT);
/** TryGetVisualWaterThreshold: BeachElevation / MaxTerrainHeight. */
export const DW_VISUAL_THRESHOLD = f32(SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT);

const H_LEN = HEIGHTMAP_DIMENSION;   // heightmapSamples.GetLength(0) and (1)
const T_LEN = WORLD_MAP_TILE_DIM;    // tilemapSamples.GetLength(0) and (1)

/** heightmapSamples[a, b]. */
export const heightSample = (mapData, a, b) => mapData.samples[b * H_LEN + a];
/** tilemapSamples[a, b] - the tile at x = a, y = b, DFU's 0xFF restored to 0. */
export function tileSample(mapData, a, b) {
  const t = mapData.tilemap[b * T_LEN + a];
  return t === 0xff ? 0 : t;
}

/** TileValueContainsWater: records 0, 5, 6, 7 and 48 (tile & 0x3F). */
export function tileValueContainsWater(tile) {
  const n = tile & 0x3f;
  return n === 0 || n === 5 || n === 6 || n === 7 || n === 48;
}

/** MapDataHasWater. */
export function mapDataHasWater(mapData) {
  if (tilemapHasWater(mapData, true)) return true;
  return heightmapHasWater(mapData);
}

/** MapDataFullySubmerged. */
export function mapDataFullySubmerged(mapData) {
  return heightmapFullyBelowThreshold(mapData, DW_WATER_THRESHOLD);
}

/** IsLocalPointWater. */
export function isLocalPointWater(mapData, fracX, fracZ) {
  const t = DW_CARVE_THRESHOLD;
  if (tilemapPointHasWater(mapData, fracX, fracZ, t)) return true;
  return heightmapPointBelowThreshold(mapData, fracX, fracZ, t);
}

/** CellContainsWaterTile. */
export function cellContainsWaterTile(mapData, cellX, cellY, cellResolution) {
  if (!mapData.tilemap || cellResolution <= 0) return false;
  const length = T_LEN, length2 = T_LEN;
  const num = clampInt(Math.trunc((cellX * length2) / cellResolution), 0, length2 - 1);
  const num2 = clampInt(Math.trunc(((cellX + 1) * length2 - 1) / cellResolution), 0, length2 - 1);
  const num3 = clampInt(Math.trunc((cellY * length) / cellResolution), 0, length - 1);
  const num4 = clampInt(Math.trunc(((cellY + 1) * length - 1) / cellResolution), 0, length - 1);
  for (let i = num3; i <= num4; i++) {
    for (let j = num; j <= num2; j++) if (tileValueContainsWater(tileSample(mapData, i, j))) return true;
  }
  return false;
}

/** IsLocalPointPureWaterTile. */
export function isLocalPointPureWaterTile(mapData, fracX, fracZ) {
  if (!mapData.tilemap) return false;
  const length = T_LEN, length2 = T_LEN;
  const num = clampInt(Math.floor(f32(clamp01(f32(fracX)) * length2)), 0, length2 - 1);
  const num2 = clampInt(Math.floor(f32(clamp01(f32(fracZ)) * length)), 0, length - 1);
  return (tileSample(mapData, num2, num) & 0x3f) === 0;
}

/** IsCellPartiallySubmerged. */
export function isCellPartiallySubmerged(mapData, cellX, cellY, cellResolution) {
  return heightmapCellBelowThreshold(mapData, cellX, cellY, cellResolution, DW_WATER_THRESHOLD);
}

/** IsCellVisuallyWet. */
export function isCellVisuallyWet(mapData, cellX, cellY, cellResolution) {
  return heightmapCellBelowThreshold(mapData, cellX, cellY, cellResolution, DW_VISUAL_THRESHOLD);
}

/** TilemapHasWater(tilemap, heights): a water tile whose cell dips to the beach line. */
function tilemapHasWater(mapData, withHeights) {
  if (!mapData.tilemap) return false;
  const length = T_LEN, length2 = T_LEN;
  const flag = withHeights && !!mapData.samples;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length2; j++) {
      if (tileValueContainsWater(tileSample(mapData, i, j)) && (!flag || heightmapCellBelowThreshold(mapData, j, i, length2, DW_VISUAL_THRESHOLD))) return true;
    }
  }
  return false;
}

/** TilemapPointHasWater. */
function tilemapPointHasWater(mapData, fracX, fracZ, lowTerrainThreshold) {
  if (!mapData.tilemap) return false;
  const length = T_LEN, length2 = T_LEN;
  const num = clampInt(Math.floor(f32(clamp01(f32(fracX)) * length2)), 0, length2 - 1);
  const num2 = clampInt(Math.floor(f32(clamp01(f32(fracZ)) * length)), 0, length - 1);
  if (!tileValueContainsWater(tileSample(mapData, num2, num))) return false;
  if (mapData.samples) return heightmapPointBelowThreshold(mapData, fracX, fracZ, lowTerrainThreshold);
  return true;
}

/** HeightmapHasWater. */
function heightmapHasWater(mapData) {
  if (!mapData.samples) return false;
  const s = mapData.samples, t = DW_WATER_THRESHOLD;
  for (let i = 0; i < s.length; i++) if (s[i] <= t) return true;
  return false;
}

/** HeightmapFullyBelowThreshold. */
function heightmapFullyBelowThreshold(mapData, threshold) {
  if (!mapData.samples) return false;
  const s = mapData.samples;
  for (let i = 0; i < s.length; i++) if (s[i] > threshold) return false;
  return s.length > 0;
}

/** HeightmapPointBelowThreshold. */
export function heightmapPointBelowThreshold(mapData, fracX, fracZ, threshold) {
  if (!mapData.samples) return false;
  const length = H_LEN, length2 = H_LEN;
  const num = clampInt(roundToInt(f32(clamp01(f32(fracX)) * (length2 - 1))), 0, length2 - 1);
  const num2 = clampInt(roundToInt(f32(clamp01(f32(fracZ)) * (length - 1))), 0, length - 1);
  return heightSample(mapData, num2, num) <= threshold;
}

/** HeightmapCellBelowThreshold. */
export function heightmapCellBelowThreshold(mapData, cellX, cellY, cellResolution, threshold) {
  if (!mapData.samples || cellResolution <= 0) return false;
  const length = H_LEN, length2 = H_LEN;
  const num = clampInt(Math.floor(f32(f32(cellX * (length2 - 1)) / cellResolution)), 0, length2 - 1);
  const num2 = clampInt(Math.ceil(f32(f32((cellX + 1) * (length2 - 1)) / cellResolution)), 0, length2 - 1);
  const num3 = clampInt(Math.floor(f32(f32(cellY * (length - 1)) / cellResolution)), 0, length - 1);
  const num4 = clampInt(Math.ceil(f32(f32((cellY + 1) * (length - 1)) / cellResolution)), 0, length - 1);
  for (let i = num3; i <= num4; i++) {
    for (let j = num; j <= num2; j++) if (heightSample(mapData, i, j) <= threshold) return true;
  }
  return false;
}
