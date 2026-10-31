// @ts-check
// AUDIT SEA PATHS O3 (2026-10-31, bible/01-Overview/audits/Audit-Sea-Paths.md) - THE KERNEL'S SEA AT A POINT. The world's
// lanes and raiders are laid on map pixels, and a pixel's square can hold land its four corner bytes never show: the
// kernel bends its ground through the 4 x 4 window about it (a lane's leg ran 307 m over it, a raider stood 225 m in).
// This answers the ground the game builds: the pixel's kernel (terrainSampler.js sampleKernel, with the landforms the
// world's own reader shapes) asked at the corner of its 129 x 129 grid nearest the point, water at the ocean's height
// or under - generateTileData's own law, the tiles' corners (99.3% of a coast's tiles agree; the rest its beach's
// transition). One sampler a pixel, kept KERNEL_SEA_PIXELS deep. Native units: 32768 a pixel, z north.
import { sampleKernel, HEIGHTMAP_DIMENSION, SCALED_OCEAN_ELEVATION } from '../terrain/terrainSampler.js';
import { isWaterHeight, sampleHeight } from '../terrain/terrainTiles.js';
import { createLandforms, groundTopOf } from '../landforms.js';
import { rumareSeaPixel } from '../rumareWaters.js';   // RUMARE-WATER: the Imperial City's lake, the sea's by its own stamp

const NP = 32768;
/** The pixels whose kernels are kept at once. */
export const KERNEL_SEA_PIXELS = 4096;

/**
 * The kernel's sea at a native point - `(x, z) => boolean` over the reader `woodsOf()` hands (made again when it is
 * another, as the world's reader is rebound past the Bay). No reader: every point the sea (nothing to refuse it with).
 * @param {() => any} woodsOf
 */
export function createKernelSea(woodsOf) {
  let woods = null, landform = null;
  const kernels = new Map();
  return (/** @type {number} */ x, /** @type {number} */ z) => {
    const w = woodsOf();
    if (!w) return true;
    if (w !== woods) { woods = w; landform = createLandforms({ woods: w }); kernels.clear(); }
    const px = Math.floor(x / NP), row = Math.floor(z / NP), py = 499 - row, key = `${px},${py}`;
    if (rumareSeaPixel(px, py)) return true;   // its ground stamped the sea's (world/rumareWaters.js), past the kernel's word
    let k = kernels.get(key);
    if (!k) {
      if (kernels.size >= KERNEL_SEA_PIXELS) kernels.clear();
      // a pixel whose DFU ground is bounded at the sea (landforms.js groundTopOf) is the sea whole - the landforms lift no
      // ground that low (reliefLift's zero; none of 12,658 such pixels held land, sampled under them)
      k = groundTopOf(w, px, py, null) <= SCALED_OCEAN_ELEVATION ? true : sampleKernel(w, px, py, HEIGHTMAP_DIMENSION, true, landform);
      kernels.set(key, k);
    }
    if (k === true) return true;
    const c = Math.round(((HEIGHTMAP_DIMENSION - 1) * (x - px * NP)) / NP), r = Math.round(((HEIGHTMAP_DIMENSION - 1) * (z - row * NP)) / NP);
    return isWaterHeight(sampleHeight(Math.fround(k(c, r))));
  };
}

/** How often (native units) a leg is asked of the kernel's sea: a sixty-fourth of a pixel, 12.8 m. */
export const KERNEL_SEA_STEP = NP / 64;

/**
 * Whether the kernel's sea (`sea`) holds the line between two native points, asked every KERNEL_SEA_STEP - or the first
 * point it does not (`{ x, z }`). `skipA`/`skipB` leave an end unasked (a way's own roadstead). Null `sea`: true.
 * @param {{ x: number, z: number }} a @param {{ x: number, z: number }} b
 * @param {((x: number, z: number) => boolean) | null | undefined} sea
 * @returns {true | { x: number, z: number }}
 */
export function kernelLine(a, b, sea, skipA = false, skipB = false) {
  if (!sea) return true;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / KERNEL_SEA_STEP));
  for (let i = skipA ? 1 : 0; i <= (skipB ? n - 1 : n); i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    if (!sea(x, z)) return { x, z };
  }
  return true;
}
