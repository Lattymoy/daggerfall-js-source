// @ts-check
// WG2 A TOWN'S PADS (bible/03-World/World-2-Canon.md, "Buildings"): the ground a terraced building is cut and filled to -
// an oriented rectangle of its footprint grown by PAD_MARGIN_M at its level, falling back to the land over
// PAD_FALLOFF_M (the retaining wall stands there). One law for the generator that lays them and the sampler that stands
// the streamed ground on them, so the building and its ground agree on every thread.
import { TERRAIN_SIZE, HEIGHTMAP_DIMENSION } from '../terrain/terrainSampler.js';

export const PAD_MARGIN_M = 0.5;
export const PAD_FALLOFF_M = 1;

/** @typedef {{ at: number[], dir: number[], size: number[], level: number }} Pad at: world pixels; dir: its door's facing; size: metres */

/** The ground at a world point with a pad on it: `h` where the pad does not reach. @param {Pad} p @param {number} x @param {number} y @param {number} h */
export function padAt(p, x, y, h) {
  const dx = (x - p.at[0]) * TERRAIN_SIZE, dy = (y - p.at[1]) * TERRAIN_SIZE;
  const u = Math.abs(-p.dir[1] * dx + p.dir[0] * dy) - p.size[0] / 2, v = Math.abs(p.dir[0] * dx + p.dir[1] * dy) - p.size[1] / 2;
  if (u <= 0 && v <= 0) return p.level;
  const eu = u > 0 ? u : 0, ev = v > 0 ? v : 0, e = Math.sqrt(eu * eu + ev * ev);
  if (e >= PAD_FALLOFF_M) return h;
  const t = e / PAD_FALLOFF_M, s = t * t * (3 - 2 * t);
  return p.level + (h - p.level) * s;
}
/** The pad's reach in world pixels from its centre (for an index). @param {Pad} p */
export const padReach = (p) => (Math.sqrt(p.size[0] * p.size[0] + p.size[1] * p.size[1]) / 2 + PAD_FALLOFF_M) / TERRAIN_SIZE;

/** The stream's nodes a world pixel (the kernel's near grid, 6.4 m apart). */
export const DRAWN_NODES = HEIGHTMAP_DIMENSION - 1;
/** THE GROUND AS THE STREAM DRAWS IT at a world point: `h` read at the four nodes of its quad and laid as the kernel's two
 *  triangles (terrain/terrainSurface.js surfaceHeightAt, the diagonal (i, j)-(i + 1, j + 1)). A pad narrower than a quad
 *  is not drawn whole, so a door is judged here. @param {(x: number, y: number) => number} h @param {number} x @param {number} y */
export function drawnAt(h, x, y) {
  const px = Math.floor(x), py = Math.floor(y), n = DRAWN_NODES, lx = (x - px) * n, lz = (py + 1 - y) * n;
  const i = Math.max(0, Math.min(n - 1, Math.floor(lx))), j = Math.max(0, Math.min(n - 1, Math.floor(lz))), ax = lx - i, az = lz - j;
  const at = (a, b) => h(px + a / n, py + 1 - b / n), h00 = at(i, j), h11 = at(i + 1, j + 1);
  if (az >= ax) { const h01 = at(i, j + 1); return h00 + az * (h01 - h00) + ax * (h11 - h01); }
  const h10 = at(i + 1, j);
  return h00 + ax * (h10 - h00) + az * (h11 - h10);
}
