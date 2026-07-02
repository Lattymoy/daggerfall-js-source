// Terrain height sampling: a 129x129 heightmap per world map pixel.
// 1:1 translation of Daggerfall Unity's DefaultTerrainSampler.cs
// GenerateSamplesJob and TerrainHelper.CubicInterpolator / GetNoise (MIT,
// Daggerfall Workshop) - DFU's default sampler, run sequentially instead
// of the Unity jobs system. Verbatim:
//   - Base elevation: bicubic over a 4x4 small-heightmap window read at
//     (mx - 2, my - 2), rows sampled in INVERTED Y order (3, 2, 1, 0),
//     scaled by baseHeightScale 8.
//   - Feature noise: bicubic over the 9x9 large-heightmap window read at
//     (mx - 1, my), cell-local fractions, scaled by noiseMapScale 4.
//   - Extra ground noise: GetNoise(nx, ny, 0.3, 0.5, 0.5, 1) *
//     GetNoise(nx, ny, 0.9, 0.5, 0.5, 1) * 10 with nx = mx*(dim-1)+x and
//     ny = (MaxMapPixelY(500) - my)*(dim-1)+y. The Perlin source is our
//     documented departure (see perlin.js).
//   - Floor at scaledOceanElevation 27.2; sample = clamp01(h / 1539).
//   - Sample layout matches DFU's job indexing: sample(x, y) sits at
//     data[x * dim + y].
// World scale (StreamingWorld/DaggerfallTerrain, verbatim): one map pixel
// spans WorldMapTerrainDim(32768) * GlobalScale = 819.2 world units;
// world height = sample * MaxTerrainHeight * TerrainScale(1.5); pixel
// (X, Y) sits at (xdif * 819.2, 0, -ydif * 819.2) - map Y runs south.

import { perlinNoise } from './perlin.js';
import { GLOBAL_SCALE } from './meshReader.js';

export const HEIGHTMAP_DIMENSION = 129; // TerrainSampler.defaultHeightmapDimension
export const MAX_TERRAIN_HEIGHT = 1539;
export const DEFAULT_TERRAIN_SCALE = 1.5; // TerrainHelper.defaultTerrainScale
export const WORLD_MAP_TERRAIN_DIM = 32768; // MapsFile.WorldMapTerrainDim
export const TERRAIN_SIZE = WORLD_MAP_TERRAIN_DIM * GLOBAL_SCALE; // 819.2
const MAX_MAP_PIXEL_Y = 500; // MapsFile.MaxMapPixelY

const BASE_HEIGHT_SCALE = 8;
const NOISE_MAP_SCALE = 4;
const EXTRA_NOISE_SCALE = 10;
export const SCALED_OCEAN_ELEVATION = 3.4 * BASE_HEIGHT_SCALE;
export const SCALED_BEACH_ELEVATION = 5.0 * BASE_HEIGHT_SCALE;

/** Verbatim TerrainHelper.CubicInterpolator. */
export function cubicInterpolator(v0, v1, v2, v3, frac) {
  const A = (v3 - v2) - (v0 - v1);
  const B = (v0 - v1) - A;
  const C = v2 - v0;
  const D = v1;
  return A * (frac * frac * frac) + B * (frac * frac) + C * frac + D;
}

/** Verbatim TerrainHelper.GetNoise over our Perlin. */
export function getNoise(x, y, frequency, amplitude, persistance, octaves, seed = 0) {
  let finalValue = 0;
  for (let i = 0; i < octaves; i++) {
    finalValue += perlinNoise(seed + x * frequency, seed + y * frequency) * amplitude;
    frequency *= 2.0;
    amplitude *= persistance;
  }
  return Math.min(1, Math.max(0, finalValue));
}

/**
 * Generate the height samples for one world map pixel.
 * @param {object} woods - loaded WoodsFile.
 * @param {number} mapPixelX
 * @param {number} mapPixelY
 * @param {number} hDim - heightmap dimension (default 129).
 * @returns {Float32Array} normalized samples; sample(x, y) = out[x * hDim + y].
 */
export function generateSamples(woods, mapPixelX, mapPixelY, hDim = HEIGHTMAP_DIMENSION) {
  // Divisor ensures continuous 0-1 range of height samples.
  const div = (hDim - 1) / 3;
  const sd = 4;
  const shm = woods.getHeightMapValuesRange1Dim(mapPixelX - 2, mapPixelY - 2, sd);
  const lhm = woods.getLargeHeightMapValuesRange(mapPixelX - 1, mapPixelY, 3);
  const ld = 9;
  const shmAt = (r, c) => shm[r + c * sd]; // JobA.Idx
  const lhmAt = (r, c) => lhm[r + c * ld];

  const data = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) {
    for (let y = 0; y < hDim; y++) {
      const rx = x / div;
      const ry = y / div;
      const ix = Math.floor(rx);
      const iy = Math.floor(ry);
      const sfracx = x / (hDim - 1);
      const sfracy = y / (hDim - 1);
      const fracx = (x - ix * div) / div;
      const fracy = (y - iy * div) / div;
      let scaledHeight = 0;

      // Bicubic sample small height map for base terrain elevation.
      let x1 = cubicInterpolator(shmAt(0, 3), shmAt(1, 3), shmAt(2, 3), shmAt(3, 3), sfracx);
      let x2 = cubicInterpolator(shmAt(0, 2), shmAt(1, 2), shmAt(2, 2), shmAt(3, 2), sfracx);
      let x3 = cubicInterpolator(shmAt(0, 1), shmAt(1, 1), shmAt(2, 1), shmAt(3, 1), sfracx);
      let x4 = cubicInterpolator(shmAt(0, 0), shmAt(1, 0), shmAt(2, 0), shmAt(3, 0), sfracx);
      const baseHeight = cubicInterpolator(x1, x2, x3, x4, sfracy);
      scaledHeight += baseHeight * BASE_HEIGHT_SCALE;

      // Bicubic sample large height map for noise mask over terrain features.
      x1 = cubicInterpolator(lhmAt(ix, iy + 0), lhmAt(ix + 1, iy + 0), lhmAt(ix + 2, iy + 0), lhmAt(ix + 3, iy + 0), fracx);
      x2 = cubicInterpolator(lhmAt(ix, iy + 1), lhmAt(ix + 1, iy + 1), lhmAt(ix + 2, iy + 1), lhmAt(ix + 3, iy + 1), fracx);
      x3 = cubicInterpolator(lhmAt(ix, iy + 2), lhmAt(ix + 1, iy + 2), lhmAt(ix + 2, iy + 2), lhmAt(ix + 3, iy + 2), fracx);
      x4 = cubicInterpolator(lhmAt(ix, iy + 3), lhmAt(ix + 1, iy + 3), lhmAt(ix + 2, iy + 3), lhmAt(ix + 3, iy + 3), fracx);
      const noiseHeight = cubicInterpolator(x1, x2, x3, x4, fracy);
      scaledHeight += noiseHeight * NOISE_MAP_SCALE;

      // Additional noise mask for small terrain features at ground level.
      const noisex = mapPixelX * (hDim - 1) + x;
      const noisey = (MAX_MAP_PIXEL_Y - mapPixelY) * (hDim - 1) + y;
      const lowFreq = getNoise(noisex, noisey, 0.3, 0.5, 0.5, 1);
      const highFreq = getNoise(noisex, noisey, 0.9, 0.5, 0.5, 1);
      scaledHeight += (lowFreq * highFreq) * EXTRA_NOISE_SCALE;

      // Clamp lower values to ocean elevation.
      if (scaledHeight < SCALED_OCEAN_ELEVATION) scaledHeight = SCALED_OCEAN_ELEVATION;

      data[x * hDim + y] = Math.min(1, Math.max(0, scaledHeight / MAX_TERRAIN_HEIGHT));
    }
  }
  return data;
}
