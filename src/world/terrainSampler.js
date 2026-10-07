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
// world height = sample * MaxTerrainHeight * TerrainScale (1.25, the game
// scene's - STREAMING_TERRAIN_SCALE below; TERRAIN-SCALE1); pixel
// (X, Y) sits at (xdif * 819.2, 0, -ydif * 819.2) - map Y runs south.

import { perlinNoise } from './perlin.js';
import { GLOBAL_SCALE } from './meshReader.js';

export const HEIGHTMAP_DIMENSION = 129; // TerrainSampler.defaultHeightmapDimension
export const MAX_TERRAIN_HEIGHT = 1539;
export const DEFAULT_TERRAIN_SCALE = 1.5; // TerrainHelper.defaultTerrainScale - the StreamingWorld PREFAB's own value
/** TERRAIN-SCALE1 (2026-09-23): THE SCALE THE GAME STREAMS AT. DaggerfallUnityGame.unity overrides the
 *  StreamingWorld prefab instance's TerrainScale to 1.25 - the scene's one StreamingWorld, the one
 *  GameManager.StreamingWorld names, at v0.11.0-beta, v1.0.0, v1.1.1 and master - and no script writes it at run
 *  time. StreamingWorld hands it to every terrain it streams (StreamingWorld.cs:1209, :1243 ->
 *  terrainData.size.y = MaxTerrainHeight * TerrainScale, DaggerfallTerrain.cs:307) and to the nature layout (:1271),
 *  and a location stands on the terrain it samples (:1185). The port read the prefab's 1.5 until World of
 *  Daggerfall's AUDIT BRANCH found the override (the mod reads StreamingWorld.TerrainScale, and its author's
 *  commented-out constant is 1539 * 1.25 = 1923.75): every hill stood a fifth taller than DFU's. Every height the
 *  streamed world draws, collides with or stands things on reads THIS. */
export const STREAMING_TERRAIN_SCALE = 1.25;
export const WORLD_MAP_TERRAIN_DIM = 32768; // MapsFile.WorldMapTerrainDim
export const TERRAIN_SIZE = WORLD_MAP_TERRAIN_DIM * GLOBAL_SCALE; // 819.2
const MAX_MAP_PIXEL_Y = 500; // MapsFile.MaxMapPixelY

// AUDIT EV F-DOC7: exported - the overworld relief and the far ring
// build their macro heights on this exact term, and each carrying a
// private copy of the 8 is how the ring would silently diverge from
// the streamed law it claims to share.
export const BASE_HEIGHT_SCALE = 8;
/** LANDFORM2: exported - the landforms grade a road to the kernel's own macro height, and a second literal of this 4
 *  is how the two would part (Home.md, ONE DFU MEMBER, ONE EXPORT). */
export const NOISE_MAP_SCALE = 4;
const EXTRA_NOISE_SCALE = 10;
// WATER-AUDIT (2026-09-08): THE REFERENCE'S FLOATS. `3.4f * baseHeightScale`
// is 27.200000762939453 in C#, not the double 27.2 - and the tile job's
// ocean compare is float32's (terrainTiles.js generateTileData), so the
// one constant every reader shares is the float, or the port carries
// two values of "the ocean elevation". The beach's 40 is exact either way.
export const SCALED_OCEAN_ELEVATION = Math.fround(3.4 * BASE_HEIGHT_SCALE);
export const SCALED_BEACH_ELEVATION = Math.fround(5.0 * BASE_HEIGHT_SCALE);

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
 * EV4: the per-sample kernel for one world map pixel, factored from
 * generateSamples so a NEIGHBOR pixel's edge rows can be computed
 * without generating its whole 129x129 grid (the ghost rows that make
 * chunk-edge normals true central differences). The window reads
 * happen once here; the returned closure is the loop body of
 * generateSamples verbatim - same reads, same arithmetic, same order,
 * so the sampler's numeric pins hold through the refactor.
 * `groundNoise` false leaves out the extra ground-noise term (never negative), so every sample is at
 * or under the real one - a strict LOWER bound for less than half the cost (spawnedDungeons.js's
 * dry-ground gate); the default is the reference's kernel, unchanged.
 * LANDFORM1: `landform` is world/landforms.js's createLandforms - the port's own terrain, the Features row
 * `landforms` - asked once for this pixel's shaper, which takes every sample over the beach line with the parts it is
 * made of. null (the default, and every classic caller) is DFU's kernel, the same arithmetic in the same order.
 * @returns {(x: number, y: number) => number} normalized sample.
 */
export function sampleKernel(woods, mapPixelX, mapPixelY, hDim = HEIGHTMAP_DIMENSION, groundNoise = true, landform = null) {
  const { base, noise } = kernelTerms(woods, mapPixelX, mapPixelY, hDim);
  const shape = landform ? landform.pixel(mapPixelX, mapPixelY) : null;

  return (x, y) => {
    {
      let scaledHeight = 0;

      // Bicubic sample small height map for base terrain elevation.
      const baseHeight = base(x, y);
      scaledHeight += baseHeight * BASE_HEIGHT_SCALE;

      // Bicubic sample large height map for noise mask over terrain features.
      const noiseHeight = noise(x, y);
      scaledHeight += noiseHeight * NOISE_MAP_SCALE;

      // Additional noise mask for small terrain features at ground level.
      let ground = 0;
      if (groundNoise) {
        const noisex = mapPixelX * (hDim - 1) + x;
        const noisey = (MAX_MAP_PIXEL_Y - mapPixelY) * (hDim - 1) + y;
        const lowFreq = getNoise(noisex, noisey, 0.3, 0.5, 0.5, 1);
        const highFreq = getNoise(noisex, noisey, 0.9, 0.5, 0.5, 1);
        ground = (lowFreq * highFreq) * EXTRA_NOISE_SCALE;
        scaledHeight += ground;
      }

      // Clamp lower values to ocean elevation.
      if (scaledHeight < SCALED_OCEAN_ELEVATION) scaledHeight = SCALED_OCEAN_ELEVATION;

      // LANDFORM1: the shaped ground has no ceiling at 1 - a mountain the landforms raise stands over the
      // reference's normalising height rather than flattening against it. The shaper is handed DFU's height as DFU
      // stands it, clamped at its ceiling (landforms.js THE CEILING: WOODS.WLD's one glitch byte is the only ground over it).
      if (shape) return Math.max(0, shape(x, y, scaledHeight < MAX_TERRAIN_HEIGHT ? scaledHeight : MAX_TERRAIN_HEIGHT, baseHeight * BASE_HEIGHT_SCALE, ground) / MAX_TERRAIN_HEIGHT);
      return Math.min(1, Math.max(0, scaledHeight / MAX_TERRAIN_HEIGHT));
    }
  };
}

/**
 * The kernel's two bicubic terms for one map pixel, its window reads done once - the small heightmap's (`base`, in
 * WOODS bytes, before BASE_HEIGHT_SCALE) and the large heightmap's (`noise`, before NOISE_MAP_SCALE), each answering
 * any (x, y) in the pixel's sample space, a fraction between samples included. sampleKernel is built on these two and
 * nothing else; LANDFORM2's path profiles read the same two at points along a road (world/landforms.js), so the macro
 * height a road bed is graded to is the kernel's own, never a second copy of DFU's interpolation.
 * @returns {{ base: (x: number, y: number) => number, noise: (x: number, y: number) => number }}
 */
export function kernelTerms(woods, mapPixelX, mapPixelY, hDim = HEIGHTMAP_DIMENSION) {
  // Divisor ensures continuous 0-1 range of height samples.
  const div = (hDim - 1) / 3;
  const sd = 4;
  const shm = woods.getHeightMapValuesRange1Dim(mapPixelX - 2, mapPixelY - 2, sd);
  const lhm = woods.getLargeHeightMapValuesRange(mapPixelX - 1, mapPixelY, 3);
  const ld = 9;
  const shmAt = (r, c) => shm[r + c * sd]; // JobA.Idx
  const lhmAt = (r, c) => lhm[r + c * ld];

  const base = (x, y) => {
    const sfracx = x / (hDim - 1);
    const sfracy = y / (hDim - 1);
    const x1 = cubicInterpolator(shmAt(0, 3), shmAt(1, 3), shmAt(2, 3), shmAt(3, 3), sfracx);
    const x2 = cubicInterpolator(shmAt(0, 2), shmAt(1, 2), shmAt(2, 2), shmAt(3, 2), sfracx);
    const x3 = cubicInterpolator(shmAt(0, 1), shmAt(1, 1), shmAt(2, 1), shmAt(3, 1), sfracx);
    const x4 = cubicInterpolator(shmAt(0, 0), shmAt(1, 0), shmAt(2, 0), shmAt(3, 0), sfracx);
    return cubicInterpolator(x1, x2, x3, x4, sfracy);
  };
  const noise = (x, y) => {
    const rx = x / div;
    const ry = y / div;
    const ix = Math.floor(rx);
    const iy = Math.floor(ry);
    const fracx = (x - ix * div) / div;
    const fracy = (y - iy * div) / div;
    const x1 = cubicInterpolator(lhmAt(ix, iy + 0), lhmAt(ix + 1, iy + 0), lhmAt(ix + 2, iy + 0), lhmAt(ix + 3, iy + 0), fracx);
    const x2 = cubicInterpolator(lhmAt(ix, iy + 1), lhmAt(ix + 1, iy + 1), lhmAt(ix + 2, iy + 1), lhmAt(ix + 3, iy + 1), fracx);
    const x3 = cubicInterpolator(lhmAt(ix, iy + 2), lhmAt(ix + 1, iy + 2), lhmAt(ix + 2, iy + 2), lhmAt(ix + 3, iy + 2), fracx);
    const x4 = cubicInterpolator(lhmAt(ix, iy + 3), lhmAt(ix + 1, iy + 3), lhmAt(ix + 2, iy + 3), lhmAt(ix + 3, iy + 3), fracx);
    return cubicInterpolator(x1, x2, x3, x4, fracy);
  };
  return { base, noise };
}

/**
 * Generate the height samples for one world map pixel.
 * @param {object} woods - loaded WoodsFile.
 * @param {number} mapPixelX
 * @param {number} mapPixelY
 * @param {number} hDim - heightmap dimension (default 129).
 * @param {?object} [landform] - LANDFORM1: world/landforms.js's createLandforms, or null for DFU's kernel.
 * @returns {Float32Array} normalized samples; sample(x, y) = out[x * hDim + y].
 */
export function generateSamples(woods, mapPixelX, mapPixelY, hDim = HEIGHTMAP_DIMENSION, landform = null) {
  const kernel = sampleKernel(woods, mapPixelX, mapPixelY, hDim, true, landform);
  const data = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) {
    for (let y = 0; y < hDim; y++) {
      data[x * hDim + y] = kernel(x, y);
    }
  }
  return data;
}

/**
 * EV4: a sampler that answers OUT-OF-RANGE coordinates from the
 * correct NEIGHBOR pixel's kernel, for the ghost rows that make
 * chunk-edge normals central differences. The mapping is the
 * continuity law the sampler already guarantees (shared edges:
 * x=0 of pixel px equals x=128 of px-1; y=0 of py equals y=128 of
 * py+1 - map Y runs south), so x=-1 reads the west pixel's x=127
 * and x=129 reads the east pixel's x=1, and likewise for y. Neighbor
 * kernels build lazily - a pixel build pays only for the edges it
 * actually asks about. RAW samples: a neighbor's location blending is
 * not reflected here, so a normal at the seam of a blended pixel can
 * differ slightly from the neighbor's own - strictly better than the
 * one-sided difference it replaces, and recorded in the EV arc.
 * LANDFORM1: a neighbour's kernel takes the same `landform` the pixel was built with - the landforms are a pure
 * function of world position, so the ghost row IS the neighbour's shaped ground, and a seam's normals agree.
 * @returns {(x: number, y: number) => number} normalized sample.
 */
export function ghostSampler(woods, mapPixelX, mapPixelY, hDim = HEIGHTMAP_DIMENSION, landform = null) {
  const span = hDim - 1;
  const kernels = new Map();
  const kernelAt = (dx, dy) => {
    const key = `${dx},${dy}`;
    let k = kernels.get(key);
    if (!k) kernels.set(key, k = sampleKernel(woods, mapPixelX + dx, mapPixelY + dy, hDim, true, landform));
    return k;
  };
  return (x, y) => {
    let dx = 0, dy = 0;
    if (x < 0) { dx = -1; x += span; } else if (x > span) { dx = 1; x -= span; }
    if (y < 0) { dy = 1; y += span; } else if (y > span) { dy = -1; y -= span; }
    return kernelAt(dx, dy)(x, y);
  };
}
