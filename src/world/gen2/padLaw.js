// @ts-check
// WG2 A TOWN'S PADS (bible/03-World/World-2-Canon.md, "Buildings"): the ground a terraced building is cut and filled to -
// an oriented rectangle of its footprint grown by PAD_MARGIN_M at its level, falling back to the land over
// PAD_FALLOFF_M (the retaining wall stands there). One law for the generator that lays them and the sampler that stands
// the streamed ground on them, so the building and its ground agree on every thread.
import { TERRAIN_SIZE } from '../terrain/terrainSampler.js';

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
