// Terrain tile texturing + location integration for one map pixel.
// 1:1 translation of Daggerfall Unity's DefaultTerrainTexturing and the
// TerrainHelper location paths (MIT, Daggerfall Workshop). Verbatim:
//   - GenerateTileData classifies a 129x129 corner grid: water at/below
//     the ocean elevation; dirt (beach) at/below the beach elevation
//     +/- a random jitter in [-1.5, 1.5) drawn from
//     Unity.Mathematics.Random.CreateFromIndex(index) - byte-exact via
//     umRandom.js; otherwise a lat/long Perlin weight (seed 417028, 3
//     octaves 0.05/0.9/0.4, clamped to [-1, 1]) picks dirt (< 0.5),
//     stone (> 0.95) or grass. The Perlin source is the ledgered
//     departure (perlin.js).
//   - AssignTiles runs marching squares over the corner grid: shape from
//     the four corner LSBs, ring from their average, lookupTable[shape |
//     ring << 4]; cells already holding location tiles (non-zero) are
//     skipped. The 64-entry lookup encodes Daggerfall ground records
//     0-55 with rotate (+64) and flip (+128), exactly the RMB tile
//     bitfield layout.
//   - SetLocationTiles stamps every RMB ground tile of the location into
//     the pixel tilemap at the centred tile origin (GroundTiles read
//     [x][15 - y] as everywhere), record 56+ markers skipped, zero
//     bitfields stored as 0xFF so AssignTiles cannot overwrite them
//     (record 0 = water); the tracked bounds +2 clearance (+3 for
//     TownCity) become the locationRect. Custom 1x1 CUST-prefix
//     locations pin the origin to (72, 55).
//   - CalcAvgMaxHeight + BlendLocationTerrain flatten the rect to the
//     pixel's average height and lerp the surrounding blend space by
//     edge-scaled strengths (bilinear in the corners).
// Sample layout everywhere matches DFU's job indexing (see
// terrainSampler.js): value(x, y) = data[x * dim + y] for the heightmap;
// the tilemap and tileData grids are row-major (index = y * dim + x).

import { perlinNoise } from './perlin.js';
import { UMRandom } from '../formats/umRandom.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION } from './terrainSampler.js';

export const WORLD_MAP_TILE_DIM = 128; // MapsFile.WorldMapTileDim
const TILE_DATA_DIM = WORLD_MAP_TILE_DIM + 1;
const MAX_WORLD_TILE_COORD_Z = 64000; // MapsFile.MaxWorldTileCoordZ
const RMB_TILES_PER_BLOCK = 16;
const RMB_TILES_PER_TERRAIN = 128;

const SEED = 417028; // Use same seed to ensure continuous tiles
const WATER = 0;
const DIRT = 1;
const GRASS = 2;
const STONE = 3;

// Local GetNoise variant, verbatim: clamp to [-1, 1], not clamp01.
function getNoiseClamped(x, y, frequency, amplitude, persistance, octaves, seed) {
  let finalValue = 0;
  for (let i = 0; i < octaves; i++) {
    finalValue += perlinNoise(seed + x * frequency, seed + y * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= persistance;
  }
  return Math.min(1, Math.max(-1, finalValue));
}

function noiseWeight(worldX, worldY) {
  return getNoiseClamped(worldX, worldY, 0.05, 0.9, 0.4, 3, SEED);
}

function getWeightedRecord(weight, lowerGrassSpread = 0.5, upperGrassSpread = 0.95) {
  if (weight < lowerGrassSpread) return DIRT;
  if (weight > upperGrassSpread) return STONE;
  return GRASS;
}

// MakeLookup: Daggerfall tile byte - record 0-55, rotate +64, flip +128.
function makeLookup(index, rotate, flip) {
  if (index > 55) throw new Error('Index out of range. Valid range 0-55');
  if (rotate) index += 64;
  if (flip) index += 128;
  return index;
}

function addLookupRange(table, baseStart, baseEnd, shapeStart, saddleIndex, reverse, offset) {
  if (reverse) {
    // high > low
    table[offset] = makeLookup(baseStart, false, false);
    table[offset + 1] = makeLookup(shapeStart + 2, true, true);
    table[offset + 2] = makeLookup(shapeStart + 2, false, false);
    table[offset + 3] = makeLookup(shapeStart + 1, true, true);
    table[offset + 4] = makeLookup(shapeStart + 2, false, true);
    table[offset + 5] = makeLookup(shapeStart + 1, false, true);
    table[offset + 6] = makeLookup(saddleIndex, true, false); // d
    table[offset + 7] = makeLookup(shapeStart, true, true);
    table[offset + 8] = makeLookup(shapeStart + 2, true, false);
    table[offset + 9] = makeLookup(saddleIndex, false, false); // d
    table[offset + 10] = makeLookup(shapeStart + 1, false, false);
    table[offset + 11] = makeLookup(shapeStart, false, false);
    table[offset + 12] = makeLookup(shapeStart + 1, true, false);
    table[offset + 13] = makeLookup(shapeStart, false, true);
    table[offset + 14] = makeLookup(shapeStart, true, false);
    table[offset + 15] = makeLookup(baseEnd, false, false);
  } else {
    // low > high
    table[offset] = makeLookup(baseStart, false, false);
    table[offset + 1] = makeLookup(shapeStart, true, false);
    table[offset + 2] = makeLookup(shapeStart, false, true);
    table[offset + 3] = makeLookup(shapeStart + 1, true, false);
    table[offset + 4] = makeLookup(shapeStart, false, false);
    table[offset + 5] = makeLookup(shapeStart + 1, false, false);
    table[offset + 6] = makeLookup(saddleIndex, false, false); // d
    table[offset + 7] = makeLookup(shapeStart + 2, true, false);
    table[offset + 8] = makeLookup(shapeStart, true, true);
    table[offset + 9] = makeLookup(saddleIndex, true, false); // d
    table[offset + 10] = makeLookup(shapeStart + 1, false, true);
    table[offset + 11] = makeLookup(shapeStart + 2, false, true);
    table[offset + 12] = makeLookup(shapeStart + 1, true, true);
    table[offset + 13] = makeLookup(shapeStart + 2, false, false);
    table[offset + 14] = makeLookup(shapeStart + 2, true, true);
    table[offset + 15] = makeLookup(baseEnd, false, false);
  }
}

export function createLookupTable() {
  const table = new Uint8Array(64);
  addLookupRange(table, 0, 1, 5, 48, false, 0);
  addLookupRange(table, 2, 1, 10, 51, true, 16);
  addLookupRange(table, 2, 3, 15, 53, false, 32);
  addLookupRange(table, 3, 3, 15, 53, true, 48);
  return table;
}

const LOOKUP_TABLE = createLookupTable();

/**
 * GenerateTileDataJob, sequential: classify the 129x129 corner grid.
 * @param {Float32Array} heightmapData - generateSamples output.
 * @param {number} mapPixelX
 * @param {number} mapPixelY
 * @returns {Uint8Array} tileData, index = y * TILE_DATA_DIM + x.
 */
export function generateTileData(heightmapData, mapPixelX, mapPixelY, hDim = HEIGHTMAP_DIMENSION) {
  const tdDim = TILE_DATA_DIM;
  const tileData = new Uint8Array(tdDim * tdDim);
  for (let index = 0; index < tileData.length; index++) {
    const x = index % tdDim; // JobA.Row
    const y = Math.trunc(index / tdDim); // JobA.Col

    // Height sample for ocean and beach tiles.
    const hx = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (x / tdDim))));
    const hy = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (y / tdDim))));
    // x & y swapped in heightmap for TerrainData.SetHeights().
    const height = heightmapData[hy + hx * hDim] * MAX_TERRAIN_HEIGHT;

    if (height <= SCALED_OCEAN_ELEVATION) {
      tileData[index] = WATER;
      continue;
    }
    // A little +/- randomness so the beach line isn't too regular.
    const jitter = UMRandom.createFromIndex(index >>> 0).nextFloatRange(-1.5, 1.5);
    if (height <= SCALED_BEACH_ELEVATION + jitter) {
      tileData[index] = DIRT;
      continue;
    }

    const latitude = mapPixelX * WORLD_MAP_TILE_DIM + x;
    const longitude = MAX_WORLD_TILE_COORD_Z - mapPixelY * WORLD_MAP_TILE_DIM + y;
    tileData[index] = getWeightedRecord(noiseWeight(latitude, longitude));
  }
  return tileData;
}

/**
 * AssignTilesJob, sequential: marching-squares transitions into the pixel
 * tilemap. Cells already holding location tiles (non-zero) are skipped.
 * @param {Uint8Array} tileData - generateTileData output.
 * @param {Uint8Array} tilemapData - 128x128 tile bytes, mutated in place.
 * @param {boolean} march
 */
export function assignTiles(tileData, tilemapData, march = true) {
  const tdDim = TILE_DATA_DIM;
  const tDim = WORLD_MAP_TILE_DIM;
  for (let index = 0; index < tDim * tDim; index++) {
    const x = index % tDim; // JobA.Row
    const y = Math.trunc(index / tDim); // JobA.Col
    // Do nothing if in location rect as texture already set (0xFF if zero).
    if (tilemapData[index] !== 0) continue;
    if (march) {
      const tdIdx = x + y * tdDim; // JobA.Idx(x, y, tdDim)
      const b0 = tileData[tdIdx];
      const b1 = tileData[tdIdx + 1];
      const b2 = tileData[tdIdx + tdDim];
      const b3 = tileData[tdIdx + tdDim + 1];
      const shape = (b0 & 1) | ((b1 & 1) << 1) | ((b2 & 1) << 2) | ((b3 & 1) << 3);
      const ring = (b0 + b1 + b2 + b3) >> 2;
      tilemapData[index] = LOOKUP_TABLE[shape | (ring << 4)];
    } else {
      tilemapData[index] = tileData[x + y * tdDim];
    }
  }
}

/** Verbatim TerrainHelper.GetLocationTerrainTileOrigin (centred). */
export function getLocationTerrainTileOrigin(dfLocation) {
  const width = dfLocation.exterior.exteriorData.width;
  const height = dfLocation.exterior.exteriorData.height;
  const result = {
    x: Math.trunc((RMB_TILES_PER_TERRAIN - width * RMB_TILES_PER_BLOCK) / 2),
    y: Math.trunc((RMB_TILES_PER_TERRAIN - height * RMB_TILES_PER_BLOCK) / 2),
  };
  // Custom 1x1 CUST-prefix location position.
  if (width === 1 && height === 1 &&
      dfLocation.exterior.exteriorData.blockNames[0].startsWith('CUST')) {
    result.x = 72;
    result.y = 55;
  }
  return result;
}

const LOCATION_TYPE_TOWN_CITY = 0; // DFRegion.LocationTypes.TownCity

/**
 * Verbatim TerrainHelper.SetLocationTiles: stamp the location's RMB ground
 * tiles into the pixel tilemap and compute the location rect.
 * @param {object} dfLocation - MapsFile location (hasExterior).
 * @param {object} mapsFile - for block name resolution.
 * @param {object} blocksFile - loaded BlocksFile.
 * @param {Uint8Array} tilemapData - 128x128, mutated.
 * @returns {{xMin,xMax,yMin,yMax}} locationRect in tile space.
 */
export function setLocationTiles(dfLocation, mapsFile, blocksFile, tilemapData) {
  const tilePos = getLocationTerrainTileOrigin(dfLocation);
  let xmin = Infinity, ymin = Infinity, xmax = 0, ymax = 0;
  const width = dfLocation.exterior.exteriorData.width;
  const height = dfLocation.exterior.exteriorData.height;
  for (let blockY = 0; blockY < height; blockY++) {
    for (let blockX = 0; blockX < width; blockX++) {
      const blockName = blocksFile.checkName(mapsFile.getRmbBlockName(dfLocation, blockX, blockY));
      const blockIndex = blocksFile.getBlockIndex(blockName);
      if (blockIndex === -1) continue;
      const block = blocksFile.getBlock(blockIndex);
      const groundTiles = block.rmbBlock.fldHeader.groundData.groundTiles;
      for (let tileY = 0; tileY < RMB_TILES_PER_BLOCK; tileY++) {
        for (let tileX = 0; tileX < RMB_TILES_PER_BLOCK; tileX++) {
          const tile = groundTiles[tileX][(RMB_TILES_PER_BLOCK - 1) - tileY];
          const xpos = tilePos.x + blockX * RMB_TILES_PER_BLOCK + tileX;
          const ypos = tilePos.y + blockY * RMB_TILES_PER_BLOCK + tileY;
          if (tile.textureRecord < 56) {
            if (xpos < xmin) xmin = xpos;
            if (xpos > xmax) xmax = xpos;
            if (ypos < ymin) ymin = ypos;
            if (ypos > ymax) ymax = ypos;
            // Zeros stored as 0xFF so AssignTiles doesn't overwrite.
            tilemapData[xpos + ypos * WORLD_MAP_TILE_DIM] =
              tile.tileBitfield === 0 ? 0xff : tile.tileBitfield;
          }
        }
      }
    }
  }
  const extraClearance = dfLocation.mapTableData.locationType === LOCATION_TYPE_TOWN_CITY ? 3 : 2;
  return {
    xMin: xmin - extraClearance,
    xMax: xmax + extraClearance,
    yMin: ymin - extraClearance,
    yMax: ymax + extraClearance,
  };
}

/** Verbatim TerrainHelper.BilinearInterpolator. */
export function bilinearInterpolator(valx0y0, valx0y1, valx1y0, valx1y1, u, v) {
  return (1 - u) * ((1 - v) * valx0y0 + v * valx0y1) +
    u * ((1 - v) * valx1y0 + v * valx1y1);
}

/** CalcAvgMaxHeightJob: [avg, max] over normalized samples. */
export function calcAvgMaxHeight(heightmapData) {
  let avg = 0;
  let max = 0;
  for (let i = 0; i < heightmapData.length; i++) {
    const h = heightmapData[i];
    avg += h;
    if (h > max) max = h;
  }
  return [avg / heightmapData.length, max];
}

/**
 * Verbatim BlendLocationTerrainJob: flatten the location rect to the
 * average height and blend the surrounding space.
 * @param {Float32Array} heightmapData - mutated in place.
 * @param {number} avgHeight - normalized average from calcAvgMaxHeight.
 * @param {{xMin,xMax,yMin,yMax}} locationRect - tile space.
 */
export function blendLocationTerrain(heightmapData, avgHeight, locationRect, hDim = HEIGHTMAP_DIMENSION) {
  const xMin = locationRect.xMin / WORLD_MAP_TILE_DIM;
  const xMax = locationRect.xMax / WORLD_MAP_TILE_DIM;
  const yMin = locationRect.yMin / WORLD_MAP_TILE_DIM;
  const yMax = locationRect.yMax / WORLD_MAP_TILE_DIM;
  const leftScale = 1 / xMin;
  const rightScale = 1 / (1 - xMax);
  const topScale = 1 / yMin;
  const bottomScale = 1 / (1 - yMax);
  let strength = 0;
  const targetHeight = avgHeight;
  for (let y = 0; y < hDim; y++) {
    const v = y / (hDim - 1);
    const insideY = v >= yMin && v <= yMax;
    for (let x = 0; x < hDim; x++) {
      const u = x / (hDim - 1);
      const insideX = u >= xMin && u <= xMax;
      if (insideX || insideY) {
        if (insideY && u <= xMin) strength = u * leftScale;
        else if (insideY && u >= xMax) strength = (1 - u) * rightScale;
        else if (insideX && v <= yMin) strength = v * topScale;
        else if (insideX && v >= yMax) strength = (1 - v) * bottomScale;
      } else {
        let xs = 0, ys = 0;
        if (u <= xMin) xs = u * leftScale; else if (u >= xMax) xs = (1 - u) * rightScale;
        if (v <= yMin) ys = v * topScale; else if (v >= yMax) ys = (1 - v) * bottomScale;
        strength = bilinearInterpolator(0, 0, 0, 1, xs, ys);
      }
      const idx = y + x * hDim; // JobA.Idx(y, x, hDim) - heightmap layout
      const height = heightmapData[idx];
      heightmapData[idx] = (insideX && insideY)
        ? targetHeight
        : height + (targetHeight - height) * strength;
    }
  }
}
