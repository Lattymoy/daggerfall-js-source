// @ts-check
// WG2 A PROVINCE IN TILES (bible/03-World/World-2-Canon.md, "Tiles"): a province too large for one bake is cut on ONE
// lattice over the world (tile x tile world pixels, anchored at the Bay's corner, so two provinces' tiles never disagree)
// into the tiles that hold its land; each tile is baked over its core grown by `overlap` each way, and where two tiles
// overlap the seam crossfades them (regionSampler.js weight: a partition of unity). The canon and the continent are
// world-wide, so the geology and the rivers that cross a seam come in from the same canon on both sides.
import { canonTheatre, worldToPicture, pictureToWorld } from './canon.js';

/** A tile's side and the overlap each way by default, world pixels; the tiles' grain, cells a pixel. */
export const TILE_SPAN = 128;
export const OVERLAP = 12;
export const TILE_RES = 2;

/**
 * The tiles of a theatre's land as region specs: `<key>-<i>-<j>` over the lattice cell (i, j), its rect the core grown by
 * the overlap, `tiling` the tiling's name, `blend` the overlap, `core` the lattice cell. A tile holds land when any of
 * its core's sample points (8 a side) stands on the theatre's authored land.
 * @param {import('./canon.js').Fit} fit @param {number} theatre @param {string} key
 * @param {{ tile?: number, overlap?: number, res?: number, seed: number, steps?: number }} o
 */
export function provinceTiles(fit, theatre, key, o) {
  const tile = o.tile ?? TILE_SPAN, overlap = o.overlap ?? OVERLAP, res = o.res ?? TILE_RES;
  // the province's bounds: its land on the picture's grid, in world pixels
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let py = 0; py < 200; py += 0.5) for (let px = 0; px < 320; px += 0.5) {
    if (canonTheatre(px, py) !== theatre) continue;
    const [x, y] = pictureToWorld(fit, px, py);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const out = [];
  if (!(x1 > x0)) return out;
  for (let j = Math.floor(y0 / tile); j <= Math.floor(y1 / tile); j++) for (let i = Math.floor(x0 / tile); i <= Math.floor(x1 / tile); i++) {
    const core = { x: i * tile, y: j * tile, w: tile, h: tile };
    let land = false;
    for (let b = 0; b < 8 && !land; b++) for (let a = 0; a < 8 && !land; a++) land = canonTheatre(...worldToPicture(fit, core.x + (a + 0.5) * tile / 8, core.y + (b + 0.5) * tile / 8)) === theatre;
    if (!land) continue;
    out.push({ id: `${key.toLowerCase()}-${i}-${j}`, rect: { x: core.x - overlap, y: core.y - overlap, w: tile + 2 * overlap, h: tile + 2 * overlap },
      res, seed: o.seed, fit, springs: [], erosion: { steps: o.steps ?? 80 }, tiling: key.toLowerCase(), blend: overlap, core });
  }
  return out;
}
