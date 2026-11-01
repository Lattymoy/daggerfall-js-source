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

import { perlinNoise } from '../perlin.js';
import { UMRandom } from '../../formats/umRandom.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from './terrainSampler.js';
import { worldDataDoor } from '../../formats/worldData/worldDataDoor.js';   // BOOT-RECTS: whether a layout pin stands where a walk reads
import { townTiles, townFieldTiles, townShapeField, townRound, tileDistance, shapeFieldDistance, isWallCarrier, TOWN_SHAPE, WALL_ROUND, RING } from '../townShape.js';   // TOWN-SHAPES: a town's ground its own outline

/** MeshReader.cs:487: an RMB ground record at or past this is a random marker, not a tile of the set (the tileset has
 *  56 records). AUDIT WATER-NEXT m8: ONE home - the stamp below, rmbLayout.js buildGroundTilemap, the fixed town's
 *  tilemap (scenes/exterior.js) and PUDDLE-DRY (puddleDry.js) each carried their own 56. */
export const GROUND_RECORD_LIMIT = 56;

export const WORLD_MAP_TILE_DIM = 128; // MapsFile.WorldMapTileDim
const TILE_DATA_DIM = WORLD_MAP_TILE_DIM + 1;
const MAX_WORLD_TILE_COORD_Z = 64000; // MapsFile.MaxWorldTileCoordZ
const RMB_TILES_PER_BLOCK = 16;
const RMB_TILES_PER_TERRAIN = 128;
/** The beach line's +/- jitter, metres (GenerateTileDataJob's nextFloatRange): dirt stands up to
 *  SCALED_BEACH_ELEVATION + BEACH_JITTER. Exported for the spawned dungeons' dry-ground gate. */
export const BEACH_JITTER = 1.5;

const SEED = 417028; // Use same seed to ensure continuous tiles
/** The tile data's ground classes (GenerateTileDataJob's): water, dirt, grass, stone - JUNGLE-TRAILS
 *  (world/jungle/jungleTrails.js) paints its corners dirt over the land. */
export const WATER = 0;
export const DIRT = 1;
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

/** AssignTilesJob's march for one tile, from its four corners' tileData (b0 its (0,0), b1 (1,0), b2 (0,1), b3 (1,1)) -
 *  the raw tile byte. AUDIT WATER-NEXT F2: exported, so the water's bed can read a neighbour's tiles across a seam by
 *  the same law (world/water/waterBed.js bedHalo). */
export function marchTile(b0, b1, b2, b3) {
  const shape = (b0 & 1) | ((b1 & 1) << 1) | ((b2 & 1) << 2) | ((b3 & 1) << 3);
  const ring = (b0 + b1 + b2 + b3) >> 2;
  return LOOKUP_TABLE[shape | (ring << 4)];
}

/**
 * WATER1's arithmetic, one home (LW-DRY, 2026-10-05: the living world's dry ground reads it too - world/dryGround.js).
 * A stored sample's height is the reference's float: the sampler's float32 sample times MaxTerrainHeight, rounded back
 * to a float as C# does (see generateTileData); at or under the ocean's elevation it is WATER.
 * @param {number} sample - a normalized height sample as stored (float32)
 */
export const sampleHeight = (sample) => Math.fround(sample * MAX_TERRAIN_HEIGHT);
/** @param {number} height - a sample's height (`sampleHeight`) */
export const isWaterHeight = (height) => height <= SCALED_OCEAN_ELEVATION;

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
    //
    // WATER1 (2026-09-08): THE COMPARE IS FLOAT32'S, AS DFU'S IS. The
    // sampler clamps the sea to SCALED_OCEAN_ELEVATION and stores
    // scaledHeight / MaxTerrainHeight in a Float32Array; this job
    // multiplies it back. In C# every step is a float: 27.2f / 1539f *
    // 1539f rounds BACK to 27.2f and `<=` holds. In JS the product is a
    // double - fround(27.2 / 1539) * 1539 = 27.20000077 - and against
    // the double 27.2 the compare FAILED for every clamped sea sample:
    // through this job an open ocean was 0 water corners in 16641
    // (test/world/terrain/terrain.test.js pins the flat-sea case), and every ocean
    // tile the port ever drew was the beach band's dirt. The height is
    // rounded to float32 and compared against the reference's float32
    // thresholds (terrainSampler.js: the constants are the floats), which
    // is the arithmetic the reference does.
    tileData[index] = tileDataAt(sampleHeight(heightmapData[hy + hx * hDim]), x, y, mapPixelX, mapPixelY);
  }
  return tileData;
}

/**
 * GenerateTileDataJob's body for one corner (x, y) of a pixel's 129x129 grid, from its sample's height (`sampleHeight`).
 * AUDIT WATER-NEXT F2: lifted out of the loop above (the loop calls it, unchanged), so a neighbour's corner is classified
 * by the same law, its own index's jitter and its own latitude (world/water/waterBed.js bedHalo).
 */
export function tileDataAt(height, x, y, mapPixelX, mapPixelY) {
  if (isWaterHeight(height)) return WATER;
  // A little +/- randomness so the beach line isn't too regular.
  const jitter = UMRandom.createFromIndex((x + y * TILE_DATA_DIM) >>> 0).nextFloatRange(-BEACH_JITTER, BEACH_JITTER);
  if (height <= Math.fround(SCALED_BEACH_ELEVATION + jitter)) return DIRT;
  const latitude = mapPixelX * WORLD_MAP_TILE_DIM + x;
  const longitude = MAX_WORLD_TILE_COORD_Z - mapPixelY * WORLD_MAP_TILE_DIM + y;
  return getWeightedRecord(noiseWeight(latitude, longitude));
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
      tilemapData[index] = marchTile(tileData[tdIdx], tileData[tdIdx + 1], tileData[tdIdx + tdDim], tileData[tdIdx + tdDim + 1]);
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
 * LANDFORM4: the rect setLocationTiles can stamp at most - the location's whole block grid from its tile origin, with
 * setLocationTiles' own clearance - read off the map table alone (no BLOCKS.BSA), so every thread derives the same one.
 * setLocationTiles' rect is the stamped tiles' and lies inside it.
 * @param {object} dfLocation - MapsFile location (hasExterior).
 * @returns {{xMin,xMax,yMin,yMax}} tile space.
 */
export function locationFootprintRect(dfLocation) {
  const o = getLocationTerrainTileOrigin(dfLocation);
  const { width, height } = dfLocation.exterior.exteriorData;
  const c = dfLocation.mapTableData.locationType === LOCATION_TYPE_TOWN_CITY ? 3 : 2;
  return { xMin: o.x - c, xMax: o.x + width * RMB_TILES_PER_BLOCK - 1 + c, yMin: o.y - c, yMax: o.y + height * RMB_TILES_PER_BLOCK - 1 + c };
}

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
  // each block read once, for the outline and the stamp alike
  const blockAt = [];
  for (let blockY = 0; blockY < height; blockY++) {
    for (let blockX = 0; blockX < width; blockX++) {
      const name = blocksFile.checkName(mapsFile.getRmbBlockName(dfLocation, blockX, blockY));
      const blockIndex = isWallCarrier(name) ? -1 : blocksFile.getBlockIndex(name);   // TS7: a wall's carrier never read here - open ground that shapes none, its wall made when it is laid out
      blockAt.push(blockIndex === -1 ? null : blocksFile.getBlock(blockIndex));
    }
  }
  // TOWN-SHAPES (departure from TerrainHelper.SetLocationTiles; bible/03-World/Town-Shapes.md): only the tiles of the
  // town's own outline are stamped - the rest of its blocks' ground is the land's
  const shape = locationShapeField(dfLocation, (bx, by) => (isWallCarrier(blockAt[by * width + bx]?.name) ? null : blockAt[by * width + bx]?.rmbBlock ?? null), tilePos);   // TS4: a wall's carrier shapes none
  for (let blockY = 0; blockY < height; blockY++) {
    for (let blockX = 0; blockX < width; blockX++) {
      const block = blockAt[blockY * width + blockX];
      if (!block) continue;
      const groundTiles = block.rmbBlock.fldHeader.groundData.groundTiles;
      for (let tileY = 0; tileY < RMB_TILES_PER_BLOCK; tileY++) {
        for (let tileX = 0; tileX < RMB_TILES_PER_BLOCK; tileX++) {
          const tile = groundTiles[tileX][(RMB_TILES_PER_BLOCK - 1) - tileY];
          const xpos = tilePos.x + blockX * RMB_TILES_PER_BLOCK + tileX;
          const ypos = tilePos.y + blockY * RMB_TILES_PER_BLOCK + tileY;
          if (tile.textureRecord < GROUND_RECORD_LIMIT && (!shape || shape[xpos + ypos * WORLD_MAP_TILE_DIM])) {
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
  // AUDIT TESA II C1 (a departure from DFU's SetLocationTiles, bible/03-World/Arena-Provinces.md TESA10): a capital's rim
  // (world/tamrielCapitals.js inCapitalRim - its outer tiles no ground of its own) begins where its ground ends, with no
  // clearance past it: the land's own ground blends from the city's to the neighbour's over the whole rim, where DFU's
  // three tiles would stand a strip of the land's own at the city's height (at a shore capital's sea floor, water). A side
  // whose ground meets the pixel's edge - a seam between the capital's own slices - keeps DFU's clearance, and the two meet
  // level. TS5: by the slice's sides (`capital.rim`), not by where its stamped ground ends - the open land past the round
  // lake (the plan's `O`, the land's own tiles, none stamped) is flattened and blended as the city's ground beside it, so a
  // slice of it meets its neighbours level (a corner slice of the Imperial City has no stamped ground at all).
  if (dfLocation.capital) {
    const lo = (v) => (v > 0 ? v : v - extraClearance), hi = (v) => (v < WORLD_MAP_TILE_DIM - 1 ? v + 1 : v + extraClearance);
    const rim = dfLocation.capital.rim, D = WORLD_MAP_TILE_DIM;
    if (rim) return { xMin: rim.W || lo(0), xMax: rim.E ? D - rim.E : hi(D - 1), yMin: rim.S || lo(0), yMax: rim.N ? D - rim.N : hi(D - 1) };
    return { xMin: lo(xmin), xMax: hi(xmax), yMin: lo(ymin), yMax: hi(ymax) };
  }
  return {
    xMin: xmin - extraClearance,
    xMax: xmax + extraClearance,
    yMin: ymin - extraClearance,
    yMax: ymax + extraClearance,
    ...(shape ? { shape } : {}),   // TOWN-SHAPES: the outline the ground follows (blendLocationTerrain), the rect its bounds
  };
}

/** TOWN-SHAPES: the tiles about a town's grid its outline may reach into - its whole margin and wander, and one more. */
const SHAPE_PAD = Math.ceil(TOWN_SHAPE.margin + TOWN_SHAPE.wander) + 1;
/**
 * TOWN-SHAPES (bible/03-World/Town-Shapes.md): A LOCATION'S OUTLINE over its pixel's 128 x 128 tiles - world/townShape.js
 * townShapeField over its grid (world/townShape.js townTiles: each block's town-map bytes, its misc models and flats -
 * `rmbOf(bx, by)` a block's RMB half, or null), laid at its tile origin - TS4: a walled city past the Bay's over its
 * round, its apron its own - or null for a location the port stands whole: a capital (its own plan's,
 * world/tamrielCapitals.js), a grid with no block read.
 * @param {any} dfLocation @param {(bx: number, by: number) => any} rmbOf @param {{x: number, y: number}} [tilePos]
 * @returns {?Uint8Array} townShapeField's codes in the pixel's tiles (index x + y * 128), 0 outside
 */
export function locationShapeField(dfLocation, rmbOf, tilePos = getLocationTerrainTileOrigin(dfLocation)) {
  const basis = locationOutlineBasis(dfLocation, rmbOf, tilePos);
  if (!basis) return null;
  const out = outlineOfBasis(basis, (dfLocation.mapTableData?.mapId ?? 0) >>> 0);
  // AUDIT TESA III E1-4: the outline's basis rides on it (never posted - a typed array's own property), so a reader that
  // stands the same grid under another map id (the Eltheric isles' clones of a template, etherWatersBake.js) draws that
  // one's outline off it
  Object.defineProperty(out, 'basis', { value: basis });
  return out;
}

/**
 * AUDIT TESA III E1-4: AN OUTLINE'S BASIS - what locationShapeField draws its outline from before its seed: the grid's
 * occupied tiles (townTiles) on the outline's padded box (SHAPE_PAD tiles each side - its margin wanders out past the
 * blocks' squares), whether it stands on a walled round (TS4), and where the box lies in the pixel's tiles; and what
 * setLocationTiles' rect is cut from under it (`stamp`: the grid's tiles of a ground record it stamps - under
 * GROUND_RECORD_LIMIT - on the same box; `clear` its clearance, the location's type's). FB1028: `fields` the tiles its
 * fields of flats are sown over on the same box (townFieldTiles), or null. null where locationShapeField answers none.
 * @returns {?{ padded: Uint8Array, stamp: Uint8Array, fields: ?Uint8Array, PW: number, PH: number, walled: boolean, x0: number, y0: number, clear: number }}
 */
export function locationOutlineBasis(dfLocation, rmbOf, tilePos = getLocationTerrainTileOrigin(dfLocation)) {
  if (!dfLocation?.exterior?.exteriorData || dfLocation.capital || dfLocation.settle2) return null;   // A World 2.0 town stands whole on its own ground
  const { width, height } = dfLocation.exterior.exteriorData;
  const T = RMB_TILES_PER_BLOCK, W = width * T, H = height * T;
  const blockAt = [];
  for (let by = 0; by < height; by++) for (let bx = 0; bx < width; bx++) blockAt.push(rmbOf(bx, by) ?? null);
  if (!blockAt.some(Boolean)) return null;
  const occ = townTiles(width, height, (bx, by) => blockAt[by * width + bx]);
  const PW = W + 2 * SHAPE_PAD, PH = H + 2 * SHAPE_PAD, padded = new Uint8Array(PW * PH), stamp = new Uint8Array(PW * PH);
  for (let y = 0; y < H; y++) padded.set(occ.subarray(y * W, y * W + W), (y + SHAPE_PAD) * PW + SHAPE_PAD);
  for (let by = 0; by < height; by++) for (let bx = 0; bx < width; bx++) {
    const ground = blockAt[by * width + bx]?.fldHeader?.groundData?.groundTiles;
    if (!ground) continue;
    for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
      if (ground[tx][(T - 1) - ty].textureRecord < GROUND_RECORD_LIMIT) stamp[(by * T + ty + SHAPE_PAD) * PW + bx * T + tx + SHAPE_PAD] = 1;
    }
  }
  // TS4: a walled city past the Bay (world/townWalls.js) stands on its round - its wall's line and all inside it - and its
  // apron is its own ground
  return { padded, stamp, fields: townFieldTiles(width, height, (bx, by) => blockAt[by * width + bx], SHAPE_PAD), PW, PH, walled: !!dfLocation.outline?.walled, x0: tilePos.x - SHAPE_PAD, y0: tilePos.y - SHAPE_PAD,
    clear: dfLocation.mapTableData?.locationType === LOCATION_TYPE_TOWN_CITY ? 3 : 2 };
}

/** AUDIT TESA III E1-4: the rect setLocationTiles cuts under an outline (`shape`, outlineOfBasis') - its stamped tiles'
 *  bounds, the clearance past them, the outline with it. */
export function rectOfBasis(basis, shape) {
  const { stamp, PW, PH, x0, y0, clear } = basis, D = WORLD_MAP_TILE_DIM;
  let xmin = Infinity, ymin = Infinity, xmax = 0, ymax = 0;
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    if (!stamp[y * PW + x]) continue;
    const px = x0 + x, py = y0 + y;
    if (px < 0 || py < 0 || px >= D || py >= D || !shape[px + py * D]) continue;
    if (px < xmin) xmin = px; if (px > xmax) xmax = px; if (py < ymin) ymin = py; if (py > ymax) ymax = py;
  }
  return { xMin: xmin - clear, xMax: xmax + clear, yMin: ymin - clear, yMax: ymax + clear, shape };
}

/** AUDIT TESA III E1-4: the outline a basis stands under a map id (`seed`) - townShapeField over its box, laid in the
 *  pixel's 128 x 128 tiles (index x + y * 128), 0 outside. locationShapeField is this under the location's own id. */
export function outlineOfBasis(basis, seed) {
  const { padded, fields, PW, PH, walled, x0, y0 } = basis;
  const occ = walled ? townRound(padded, PW, PH).inside : padded;
  // FB1028 CROP-GROUND: a field's plants stand on the plane - its tiles the town's (after the round: a wall reads none)
  const field = townShapeField(fields ? occ.map((v, i) => v | fields[i]) : occ, PW, PH, seed >>> 0, walled ? { core: WALL_ROUND.apron } : {});
  const out = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const px = x0 + x, py = y0 + y;
    if (px >= 0 && px < WORLD_MAP_TILE_DIM && py >= 0 && py < WORLD_MAP_TILE_DIM) out[px + py * WORLD_MAP_TILE_DIM] = field[y * PW + x];
  }
  return out;
}

/**
 * TOWN-SHAPES: A TOWN'S GROUND ON ITS LAND - its outline (`shape`, locationShapeField's) less every tile of its margin past
 * TOWN_SHAPE.seaMargin of a building whose land holds water (`ground`, the pixel's samples before any blend, column-major)
 * - a shore town meets the sea where the shore is - or that lies nearer the pixel's edge than its ease needs (FB1028).
 * Kept on the shape for the ground it was asked of.
 * @param {Uint8Array} shape @param {ArrayLike<number>} ground @param {number} [hDim]
 * @returns {Uint8Array} 1 a tile of the town's ground (index x + y * 128)
 */
export function townGroundMask(shape, ground, hDim = HEIGHTMAP_DIMENSION) {
  const memo = /** @type {any} */ (shape);
  if (memo._ground === ground && memo._mask) return memo._mask;
  const D = WORLD_MAP_TILE_DIM, mask = new Uint8Array(D * D);
  const at = (x, y) => ground[Math.min(y, hDim - 1) + Math.min(x, hDim - 1) * hDim];
  const wet = (x, y) => isWaterHeight(sampleHeight(at(x, y)));
  let sum = 0, n = 0;
  for (let i = 0; i < D * D; i++) if (shape[i] && !wet(i % D, (i - (i % D)) / D)) { sum += at(i % D, (i - (i % D)) / D); n++; }
  const level = n ? sum / n : 0, grade = shapeGrade(hDim);
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const v = shape[x + y * D];
    if (!v) continue;
    // FB1028: a margin's tile in the band the ease needs to the edge's own ground - its nearest side's sample
    const e = Math.min(x, y, D - 1 - x, D - 1 - y), side = e === x ? at(0, y) : e === D - 1 - x ? at(hDim - 1, y) : e === y ? at(x, 0) : at(x, hDim - 1);
    const edge = e < Math.max(SHAPE_EDGE_TILES, Math.abs(level - side) / grade);
    mask[x + y * D] = shapeFieldDistance(v) <= TOWN_SHAPE.seaMargin || !(edge || wet(x, y) || wet(x + 1, y + 1)) ? 1 : 0;
  }
  memo._ground = ground; memo._mask = mask;
  return mask;
}
/** TOWN-SHAPES: how far past a town's outline its ground eases back to the land's at the least, in samples (a tile's
 *  side) - 77 m. */
export const SHAPE_BLEND_TILES = 12;
/** FB1028: the ease's grade on the mean, metres a metre (1.5 times it at its steepest) - a town far over its sea or its
 *  hillside eases back as far as it needs to rise no faster. */
export const SHAPE_GRADE = 0.6;
/** TOWN-SHAPES: the band at a pixel's edge a town's margin keeps off at the least (FB1028), in samples - its edge the
 *  land's own, as DFU's ramp keeps it, so a neighbour pixel's ground meets it. */
export const SHAPE_EDGE_TILES = 4;
/** FB1028: SHAPE_GRADE as a sample's rise in the kernel's normalized heights (a sample 6.4 m, a unit 1539 x 1.25 m). */
export const shapeGrade = (hDim) => SHAPE_GRADE * (TERRAIN_SIZE / (hDim - 1)) / (MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE);
const smooth = (t) => t * t * (3 - 2 * t);
/** AUDIT FB1028 A3: the most the ease keeps of the land's departure `d` samples out, in grades - a smooth cone: 32/3 of
 *  the smoothstep to nine samples (4/3 of the grade at its steepest), then one grade a sample. */
const easeCone = (d) => (d < 9 ? (32 / 3) * smooth(d / SHAPE_BLEND_TILES) : d);
/** AUDIT FB1028 A3 (round 2): the metres over the sea a sample under its town fades from FB1028's ease into the cone -
 *  the cone in a port's sea kept it low further out, and the ground past a jetty's end stood over its deck. */
const SHAPE_SHORE_M = 10;
/** TOWN-SHAPES: the least a town stands at - a step over the beach, so a shore town's ground is dry land. */
const SHAPE_FLOOR = Math.fround((SCALED_BEACH_ELEVATION + 1) / MAX_TERRAIN_HEIGHT);

/**
 * TOWN-SHAPES (departure from BlendLocationTerrainJob; bible/03-World/Town-Shapes.md): A TOWN'S GROUND FLATTENED TO ITS OWN
 * OUTLINE at the mean of the land it stands on (never the sea's; a step over the beach at the least), the rest eased back.
 * FB1028: the ease runs SHAPE_BLEND_TILES, or as far as SHAPE_GRADE needs, the sea's too, and never past its share of the
 * way to the pixel's edge. Its reach is read on `ground` alone, so every blend of the pixel eases alike. Answers its height.
 * @param {Float32Array} heightmapData mutated in place @param {Uint8Array} shape locationShapeField's
 * @param {ArrayLike<number>} ground the pixel's samples before the blend (the water's and the mean's reading)
 * @param {number} hDim @param {boolean} diff `heightmapData` a difference of grounds (landforms.js landformLiftField), never floored
 * @param {?ArrayLike<number>} [levelOf] ACROSS-EDGE: the samples its height is read off - `heightmapData` before the meets */
function blendShapedTerrain(heightmapData, shape, ground, hDim, diff, levelOf = null) {
  const st = townStanding(levelOf ?? heightmapData, shape, ground, hDim, diff);
  if (!st) return null;
  const { target, level, dist, stood } = st, grade = shapeGrade(hDim);
  for (let y = 0; y < hDim; y++) {
    for (let x = 0; x < hDim; x++) {
      const idx = y + x * hDim, d = dist[y * hDim + x], e = Math.min(x, y, hDim - 1 - x, hDim - 1 - y);
      if (e === 0) continue;   // the pixel's edge the land's own, so a neighbour's ground meets it
      // AUDIT FB1028 A3: the land keeps the least of its departure x the smoothstep and the cone, which never falls as it
      // stands further off; the sea and its shore's first SHAPE_SHORE_M fade to FB1028's reach off its own depth, so a sea
      // rises to its quay as before. The two agree to 41 m
      const off = Math.abs(level - ground[idx]);
      const cone = Math.min(smooth(Math.min(1, d / SHAPE_BLEND_TILES)), off > 0 ? easeCone(d) * grade / off : 1);
      const shore = Math.min(1, Math.max(0, (sampleHeight(ground[idx]) - SCALED_OCEAN_ELEVATION) * STREAMING_TERRAIN_SCALE / SHAPE_SHORE_M));
      const kept = cone * shore + (1 - shore) * (1 - smooth(Math.max(0, 1 - d / Math.max(SHAPE_BLEND_TILES, off / grade))));
      // its share of the way to the edge - AUDIT FB1028 A2: in the band the seam needs, from the town's last stood sample
      // (across the core's margin at the most), so the seam's run eases its margin there too
      const side = e === x ? ground[y] : e === hDim - 1 - x ? ground[y + (hDim - 1) * hDim] : e === y ? ground[x * hDim] : ground[hDim - 1 + x * hDim];
      const band = Math.max(SHAPE_EDGE_TILES, Math.abs(level - side) / grade);
      const run = Math.min(stood[y * hDim + x], d + TOWN_SHAPE.seaMargin + 1, Math.max(d, band - e));
      const s = run > 0 ? Math.min(1 - kept, e / (e + run)) : 1;
      if (s > 0) heightmapData[idx] = heightmapData[idx] + (target - heightmapData[idx]) * s;
    }
  }
  return target;
}
/**
 * ACROSS-EDGE (FB1029): A SHAPED TOWN'S STANDING - the samples its ground touches (`inside`, y * hDim + x), the height
 * blendShapedTerrain flattens `S` to (`target`), the level the ease reads its reach off over `ground` (`level`), and each
 * sample's distance to its ground (`dist`) and to the samples its buildings stand on (`stood`). null on no land.
 * @param {ArrayLike<number>} S @param {Uint8Array} shape @param {ArrayLike<number>} ground @param {number} [hDim] @param {boolean} [diff]
 */
export function townStanding(S, shape, ground, hDim = HEIGHTMAP_DIMENSION, diff = false) {
  const D = WORLD_MAP_TILE_DIM, mask = townGroundMask(shape, ground, hDim);
  const inside = new Uint8Array(hDim * hDim);
  for (let y = 0; y < hDim; y++) for (let x = 0; x < hDim; x++) {
    let on = 0;
    for (let dy = -1; dy <= 0 && !on; dy++) for (let dx = -1; dx <= 0 && !on; dx++) {
      const tx = x + dx, ty = y + dy;
      if (tx >= 0 && ty >= 0 && tx < D && ty < D && mask[tx + ty * D]) on = 1;
    }
    inside[y * hDim + x] = on;
  }
  let sum = 0, n = 0;
  for (let y = 0; y < hDim; y++) for (let x = 0; x < hDim; x++) {
    const idx = y + x * hDim;
    if (inside[y * hDim + x] && !isWaterHeight(sampleHeight(ground[idx]))) { sum += S[idx]; n++; }
  }
  if (!n) return null;
  const target = diff ? Math.fround(sum / n) : Math.max(Math.fround(sum / n), SHAPE_FLOOR);
  const dist = tileDistance(inside, hDim, hDim);
  // FB1028: the level the ease reads its reach off - `ground`'s own over the same land
  let gsum = 0;
  for (let y = 0; y < hDim; y++) for (let x = 0; x < hDim; x++) if (inside[y * hDim + x] && !isWaterHeight(sampleHeight(ground[y + x * hDim]))) gsum += ground[y + x * hDim];
  return { mask, inside, target, level: gsum / n, dist, stood: tileDistance(stoodSamples(shape, mask, hDim), hDim, hDim) };
}
/** AUDIT FB1028 A2: the samples a building, a model, a flat or a crop stands on - the corners of the town's tiles within
 *  a tile of one (a model's foot overhangs its own: Aldwall Rock's 323 by a tile) - kept at the level. Index y * hDim + x. */
function stoodSamples(shape, mask, hDim) {
  const D = WORLD_MAP_TILE_DIM, out = new Uint8Array(hDim * hDim);
  for (let ty = 0; ty < D; ty++) for (let tx = 0; tx < D; tx++) {
    if (!mask[tx + ty * D] || shapeFieldDistance(shape[tx + ty * D]) > 1) continue;
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) if (ty + dy < hDim && tx + dx < hDim) out[(ty + dy) * hDim + tx + dx] = 1;
  }
  return out;
}
/** TOWN-SHAPES: a town's tiles its outline took off its stamped ground (townGroundMask: the sea's) given back to the land -
 *  a tile setLocationTiles stamped there cleared, so the land's own tiles are laid. */
export function unstampOffShape(tilemapData, shape, mask) {
  for (let i = 0; i < mask.length; i++) if (shape[i] && !mask[i]) tilemapData[i] = 0;
}
/** TOWN-SHAPES: the ring a road paves round a town (the mod's "Paint roads around locations", roadPainter.js): the tiles off
 *  its ground within two and a half of it - its outline's, where the rect's padding was (RING.road). TS9 (2026-10-26, the
 *  owner: "Roads around the city arent properly blended when they are angled"): where the outline runs at an angle the
 *  ring's edges stood as stairs of whole tiles. Each step is blended with the road's own diagonal edge, as a diagonal
 *  road's flanks are: a tile off the ring and off the town's ground with the ring on two sides at a corner and neither on
 *  the other two (a step's notch, outside) takes a half tile with its road toward that corner, and a ring tile with the
 *  town's ground on two sides at a corner and the ring on the other two (a step's corner, inside) takes one with its road
 *  away from it - so a 45-degree stair is one straight edge. */
export function townRoadRing(mask) {
  const D = WORLD_MAP_TILE_DIM, dist = tileDistance(mask, D, D), ring = new Uint8Array(D * D);
  for (let i = 0; i < ring.length; i++) ring[i] = !mask[i] && dist[i] <= 2.5 ? RING.road : 0;
  const on = (a, x, y) => x >= 0 && y >= 0 && x < D && y < D && a[y * D + x] !== 0;
  const isRing = (x, y) => on(ring, x, y) && ring[y * D + x] === RING.road, isTown = (x, y) => on(mask, x, y);
  // a corner by its two sides (y north): [north or south, east or west, its code]
  const corners = [[1, -1, RING.NW], [1, 1, RING.NE], [-1, 1, RING.SE], [-1, -1, RING.SW]];
  const half = new Uint8Array(D * D);
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const i = y * D + x;
    for (const [ny, ex, code] of corners) {
      const sides = (f) => [f(x, y + ny), f(x + ex, y)], others = (f) => [f(x, y - ny), f(x - ex, y)];
      if (!ring[i] && !mask[i] && sides(isRing).every(Boolean) && !others(isRing).some(Boolean) && !others(isTown).some(Boolean)) half[i] = code;
      else if (ring[i] && sides(isTown).every(Boolean) && others(isRing).every(Boolean)) half[i] = corners[(corners.findIndex((c) => c[2] === code) + 2) % 4][2];
    }
  }
  for (let i = 0; i < ring.length; i++) if (half[i]) ring[i] = half[i];
  return ring;
}

/**
 * BOOT-RECTS (2026-10-20, bible/07-Rendering/Performance-Priority.md BOOT-RECTS): SetLocationTiles' RECT FOR MANY
 * LOCATIONS IN ONE WALK - the boot's two: the Eltheric isles' templates (etherWatersBake.js etherPlaceRects, 7,538 of
 * them) and the Bay's coastal towns for Deep Waters (deepWatersClient.js deepWatersLocationRects). BlocksFile keeps ONE
 * parsed block (autoDiscard, as BlocksFile.cs:32), so a walk parsed a block again - and dried its puddles again
 * (puddleDry.js) - every time its name came round: the isles' templates name 384 blocks. The walk keeps each block's
 * ground tiles, the one thing SetLocationTiles reads of it, for itself. A block reads alike at every location the
 * world-data door reads it at, save where a layout pin stands (worldDataReplacement.js pinnedHere): a location with one,
 * or one the door cannot place (no integer indices - its blocks read in the last place's context), reads through as it
 * always did. `as` lays fields over every location read (the isles' templates are read as a clone of them is).
 * Answers `(dfLocation) => rect`; the tilemap is the walk's own scratch, never read.
 * @param {object} mapsFile @param {object} blocksFile @param {object|null} [as]
 * @returns {(dfLocation: object) => {xMin: number, xMax: number, yMin: number, yMax: number}}
 */
let keptGroundTiles = (_walk, _index, read) => read();   // FIRST-VISIT: `(walk, index, read) => the block parts the rect reads`, installed by groundTilesKept.js so no worker reaches the store
export function setGroundTilesKeeper(fn) { keptGroundTiles = typeof fn === 'function' ? fn : (_walk, _index, read) => read(); }
export function locationRectReader(mapsFile, blocksFile, as = null) {
  /** @type {Map<number, object|null>} block index -> its ground tiles, as getBlock serves them */
  const ground = new Map();
  const walk = as ? JSON.stringify(as) : '';   // FIRST-VISIT: the walk's name in the kept record
  const shared = {
    checkName: (name) => blocksFile.checkName(name),
    getBlockIndex: (name) => blocksFile.getBlockIndex(name),
    getBlock: (index) => {
      let b = ground.get(index);
      if (b === undefined) {
        // TOWN-SHAPES: the outline reads the town-map bytes and the misc models' and flats' places beside the ground tiles.
        // FIRST-VISIT: all four are kept across launches by the block's NAME, not index (a pack's added block takes its index in meeting order)
        const part = keptGroundTiles(walk, blocksFile.getBlockName?.(index) ?? index, () => {
          const rmb = blocksFile.getBlock(index)?.rmbBlock, groundTiles = rmb?.fldHeader?.groundData?.groundTiles;
          return groundTiles ? { groundTiles, autoMapData: rmb.fldHeader.autoMapData, misc3dObjectRecords: rmb.misc3dObjectRecords, miscFlatObjectRecords: rmb.miscFlatObjectRecords } : null;
        });
        b = part ? { rmbBlock: { fldHeader: { groundData: { groundTiles: part.groundTiles }, autoMapData: part.autoMapData }, misc3dObjectRecords: part.misc3dObjectRecords, miscFlatObjectRecords: part.miscFlatObjectRecords } } : blocksFile.getBlock(index);   // a block with none fails SetLocationTiles as it did
        ground.set(index, b);
      }
      return b;
    },
  };
  const scratch = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM);
  return (dfLocation) => {
    const loc = as ? { ...dfLocation, ...as } : dfLocation;
    const door = worldDataDoor();
    const own = door !== null && (!Number.isInteger(loc.regionIndex) || !Number.isInteger(loc.locationIndex) || (door.locationPinned?.(loc.regionIndex, loc.locationIndex) ?? true));
    return setLocationTiles(loc, mapsFile, own ? blocksFile : shared, scratch.fill(0));
  };
}

/** Verbatim TerrainHelper.BilinearInterpolator. */
export function bilinearInterpolator(valx0y0, valx0y1, valx1y0, valx1y1, u, v) {
  return (1 - u) * ((1 - v) * valx0y0 + v * valx0y1) +
    u * ((1 - v) * valx1y0 + v * valx1y1);
}

/** CalcAvgMaxHeightJob: [avg, max] over normalized samples. DFU seeds max
 * with float.MinValue; 0 is equivalent since samples are clamp01 >= 0. */
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
export function blendLocationTerrain(heightmapData, avgHeight, locationRect, hDim = HEIGHTMAP_DIMENSION, ground = heightmapData, diff = false, levelOf = null) {
  // TOWN-SHAPES: a town with an outline is flattened to it (blendShapedTerrain) - the height it stands at answered
  if (locationRect?.shape && hDim === HEIGHTMAP_DIMENSION) {
    const target = blendShapedTerrain(heightmapData, locationRect.shape, ground === heightmapData ? Float32Array.from(ground) : ground, hDim, diff, levelOf);
    if (target !== null) return target;
  }
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
  return avgHeight;
}
