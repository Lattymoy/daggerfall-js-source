// @ts-check
// LW-DRY (2026-10-05, bible/06-Systems/Living-World.md LW-DRY): IS THE GROUND DRY - the terrain's own samples (the
// sampler's kernel, terrainSampler.js sampleKernel, the samples a pixel is built from) read against the tile job's own
// water compare (terrainTiles.js sampleHeight and isWaterHeight: a sample at or under the ocean's elevation is WATER, and
// a tile with a water corner shows the water). Pure in the height map, which every client holds alike, so every client
// finds the same ground dry. Not read: a location's flattening (terrainGen.js blendLocationTerrain) - the ground beside
// a town is the kernel's; and the Rivers and Streams mod's painted water, which a player switches on for themselves.
import { sampleKernel, HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { sampleHeight, isWaterHeight } from './terrainTiles.js';

/**
 * Whether the terrain cell under a point of map pixel (`px`, `py`) is dry at all four of its corners - no water shows on
 * its tile. `fx` is the point's fraction east across the pixel, `fz` north: the sample grid's own x and y (x 0 the west
 * edge, y 0 the south - terrainSampler.js ghostSampler's continuity law; the gate's ground reads it so). The last
 * `keep` pixels' kernels are kept: a walk along a way reads a pixel many times.
 * @param {any} woods - the loaded WoodsFile
 * @param {number} [keep]
 * @returns {(px: number, py: number, fx: number, fz: number) => boolean}
 */
export function createDryGround(woods, keep = 8) {
  const span = HEIGHTMAP_DIMENSION - 1;
  /** @type {Map<number, (x: number, y: number) => number>} */
  const kernels = new Map();
  /** a sample as the pixel stores it (float32), its height the tile job's */
  const wet = (/** @type {(x: number, y: number) => number} */ k, /** @type {number} */ x, /** @type {number} */ y) => isWaterHeight(sampleHeight(Math.fround(k(x, y))));
  return (px, py, fx, fz) => {
    const key = py * 1000 + px;
    let k = kernels.get(key);
    if (!k) {
      if (kernels.size >= keep) kernels.delete(/** @type {number} */ (kernels.keys().next().value));
      kernels.set(key, k = sampleKernel(woods, px, py));
    }
    const x0 = Math.min(span - 1, Math.max(0, Math.floor(fx * span))), y0 = Math.min(span - 1, Math.max(0, Math.floor(fz * span)));
    return !wet(k, x0, y0) && !wet(k, x0 + 1, y0) && !wet(k, x0, y0 + 1) && !wet(k, x0 + 1, y0 + 1);
  };
}
