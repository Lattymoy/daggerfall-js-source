// Nature flat scatter for one wilderness map pixel.
// 1:1 translation of Daggerfall Unity's DefaultTerrainNature.LayoutNature
// (MIT, Daggerfall Workshop). Verbatim rules:
//   - Location rects (when present: rect.x > 0 && rect.y > 0) expand by
//     natureClearance 4 and exclude scatter inside (Rect.Contains:
//     min-inclusive, max-exclusive).
//   - elevationScale = clamp(rawWoodsByte / 128, 0.4, 1.0); Desert
//     climates scale all chances by 0.25.
//   - Per tile: skip if steepness > 50 degrees; roll against
//     chanceOnDirt 0.2 / chanceOnGrass 0.9 / chanceOnStone 0.05 (scaled);
//     any other tile record never scatters. Skip below the beach line
//     (tile-corner height * maxTerrainHeight, unscaled).
//   - Placed flats sit at (x * 6.4, sampledHeight - steepness / 70,
//     y * 6.4) - sunk slightly into slopes - with record in [1, 32).
//     Batch billboards anchor at centre-bottom (base), matching our
//     renderer batches.
// DEPARTURE (same Port-Ledger A row as the Perlin substitution):
// DFU seeds UnityEngine.Random with TerrainHelper.MakeTerrainKey - an
// engine-internal PRNG not in DFU source. We seed our byte-exact
// Unity.Mathematics Random port (umRandom.js) with the same verbatim
// key; the scatter is deterministic per pixel with the same statistics,
// but concrete positions differ from DFU. Pins pin OUR scatter.
// Presentation substitutions (our terrain is not a Unity Terrain
// object): steepness comes from central-difference gradients of the
// scaled heightfield at the tile corner; SampleHeight reduces to the
// exact corner sample because DFU's sample point x * heightmapScale *
// (hDim - 1) / tDim lands on integer sample coordinates.

import { UMRandom } from '../formats/umRandom.js';
import {
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE,
  TERRAIN_SIZE, SCALED_BEACH_ELEVATION,
} from './terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from './terrainTiles.js';

const MAX_STEEPNESS = 50;
const SLOPE_SINK_RATIO = 70;
const BASE_CHANCE_ON_DIRT = 0.2;
const BASE_CHANCE_ON_GRASS = 0.9;
const BASE_CHANCE_ON_STONE = 0.05;
const NATURE_CLEARANCE = 4;
const CLIMATE_TYPE_DESERT = 0; // DFLocation.ClimateBaseType.Desert

/** Verbatim TerrainHelper.MakeTerrainKey: ((short)y << 16) + (short)x. */
export function makeTerrainKey(mapPixelX, mapPixelY) {
  return (((mapPixelY << 16) >> 16) << 16) + ((mapPixelX << 16) >> 16);
}

/**
 * Scatter nature flats for one map pixel.
 * @param {Float32Array} heightmapData - generateSamples output (post-blend
 *   when a location is present); sample(x, y) = data[x * hDim + y].
 * @param {Uint8Array} tilemapData - 128x128 tile bytes (y * dim + x).
 * @param {object} opts
 * @param {number} opts.mapPixelX
 * @param {number} opts.mapPixelY
 * @param {number} opts.rawWorldHeight - WOODS byte for the pixel.
 * @param {number} opts.climateType - ClimateBaseType (0 Desert).
 * @param {{xMin,xMax,yMin,yMax}|null} opts.locationRect - tile space.
 * @returns {Array<{record:number,x:number,y:number,z:number}>} base
 *   positions in pixel-local world units.
 */
export function layoutNature(heightmapData, tilemapData, opts) {
  const hDim = HEIGHTMAP_DIMENSION;
  const tDim = WORLD_MAP_TILE_DIM;
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const cell = TERRAIN_SIZE / (hDim - 1);
  const at = (x, y) => heightmapData[x * hDim + y] * worldHeight;

  // Expand the location rect by the nature clearance when present.
  let rect = null;
  if (opts.locationRect && opts.locationRect.xMin > 0 && opts.locationRect.yMin > 0) {
    rect = {
      xMin: opts.locationRect.xMin - NATURE_CLEARANCE,
      xMax: opts.locationRect.xMax + NATURE_CLEARANCE,
      yMin: opts.locationRect.yMin - NATURE_CLEARANCE,
      yMax: opts.locationRect.yMax + NATURE_CLEARANCE,
    };
  }

  let elevationScale = opts.rawWorldHeight / 128;
  elevationScale = Math.min(1.0, Math.max(0.4, elevationScale));
  const climateScale = opts.climateType === CLIMATE_TYPE_DESERT ? 0.25 : 1.0;
  const chanceOnDirt = BASE_CHANCE_ON_DIRT * elevationScale * climateScale;
  const chanceOnGrass = BASE_CHANCE_ON_GRASS * elevationScale * climateScale;
  const chanceOnStone = BASE_CHANCE_ON_STONE * elevationScale * climateScale;

  // DFU: Random.InitState(MakeTerrainKey(x, y)) - our seeded substitute.
  const seed = makeTerrainKey(opts.mapPixelX, opts.mapPixelY) >>> 0;
  const rng = new UMRandom(seed === 0 ? 0x6e624eb7 : seed);

  const scale = TERRAIN_SIZE / tDim; // heightmapScale.x * (hDim - 1) / tDim
  const beachLine = SCALED_BEACH_ELEVATION;

  // Steepness in degrees from central-difference gradients at a corner.
  const steepnessAt = (x, y) => {
    const hl = at(Math.max(0, x - 1), y);
    const hr = at(Math.min(hDim - 1, x + 1), y);
    const hd = at(x, Math.max(0, y - 1));
    const hu = at(x, Math.min(hDim - 1, y + 1));
    const dx = (hr - hl) / (2 * cell);
    const dz = (hu - hd) / (2 * cell);
    return Math.atan(Math.hypot(dx, dz)) * (180 / Math.PI);
  };

  const flats = [];
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const steepness = steepnessAt(x, y);
      if (steepness > MAX_STEEPNESS) continue;
      // Rect.Contains: min-inclusive, max-exclusive.
      if (rect && x >= rect.xMin && x < rect.xMax && y >= rect.yMin && y < rect.yMax) continue;

      const tile = tilemapData[y * tDim + x] & 0x3f;
      if (tile === 1) {
        if (rng.nextFloatRange(0, 1) > chanceOnDirt) continue;
      } else if (tile === 2) {
        if (rng.nextFloatRange(0, 1) > chanceOnGrass) continue;
      } else if (tile === 3) {
        if (rng.nextFloatRange(0, 1) > chanceOnStone) continue;
      } else {
        continue;
      }

      const hx = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (x / tDim))));
      const hy = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (y / tDim))));
      // x & y swapped in heightmap, verbatim; unscaled height vs beach.
      const height = heightmapData[hy + hx * hDim] * MAX_TERRAIN_HEIGHT;
      if (height < beachLine) continue;

      const record = rng.nextIntRange(1, 32);
      flats.push({
        record,
        x: x * scale,
        y: at(x, y) - steepness / SLOPE_SINK_RATIO,
        z: y * scale,
      });
    }
  }
  return flats;
}
