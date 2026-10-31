// @ts-check
// ═══════════════════════════════════════════════════════════════════
// VOYAGER1 (2026-10-26, bible/03-World/Roads.md VOYAGER1) - THE LAND'S LAW, every route's: what a step costs (the grade,
// the height, the shore, a ford, the land's grain) and the land it is read off. The builder (world/road/roadNetwork.js)
// takes it as its `terrain` - landForRoutes' answer, its own `step` - and never imports it: the account Worker, which
// bundles the builder, carries none of this (.github/workflows/account-deploy.yml). OWN-WORK2: the Bay's roads take it
// too (world/roadsProducer.js), so one law lays Tamriel's roads.
// ═══════════════════════════════════════════════════════════════════
import { DIR_DELTA, MAP_W as MAP_WIDTH } from './roadNetwork.js';

/**
 * VOYAGER1 (2026-10-26, KPbICA's spec: "Roads should rely on landscape and should not be just 100km straights. Roads
 * should circle around rivers, on the shoreline, around tall mountains and not through all this"; bible/03-World/Roads.md
 * VOYAGER1): THE LAND'S LAW (world/tamrielRoads.js hands it as `terrain`, and OWN-WORK2's Bay build,
 * world/roadsProducer.js). Every step of a route pays:
 *  - its length (1, or the square root of 2 on a diagonal);
 *  - THE GRADE, squared: 1 + gradeCost x (rise per pixel)^2 on the land's height smoothed over SMOOTH_R pixels about
 *    each (the lattice's +-2 a pixel is the ground's texture, not a hill: read raw, a climb dial priced it as one and a
 *    route wandered on it), the same up and down - a road is walked both ways. A byte a pixel is about a 1% grade (8 m
 *    over 819), so 4% doubles a step and 8% is five of it: a road goes round a steep rise and takes the valley or the
 *    pass, and a long climb is laid across the slope;
 *  - THE HEIGHT: 1 + highCost per byte above highAbove - between two ways up, the lower col;
 *  - THE SHORE: land beside water (a lake's, a river's, the sea's) costs shoreCost of itself - the flat strip a road
 *    follows round a lake or along a river rather than over the hills behind it;
 *  - A CROSSING: a water pixel a ford or a bridge spans (`terrain.ford` - a run of water no wider than FORD_SPAN with
 *    land both sides) is passed at fordCost a step, so a road crosses a river once, where it must, and later roads take
 *    the same crossing (the road discount); wider water stays refused;
 *  - the turn and the road discount as the Bay's (ROADS 14, ROADS 1).
 * Sums, products and Math.sqrt alone - the same on every client.
 */
export const VOYAGER_DIALS = Object.freeze({
  gradeCost: 1 / 16,      // per (byte a pixel)^2: 4% doubles a step, 8% is five of it
  highCost: 0.03,         // per byte above highAbove
  highAbove: 40,          // the height a step starts to pay for being high
  shoreCost: 0.85,        // a step onto land beside water
  fordCost: 12,           // a step onto water a ford spans, on top of its length
  smoothR: 2,             // the grade is read on the height averaged over (2r + 1)^2 pixels
  grainCost: 2.5,         // the land's grain (landGrain): a step on a rough patch's heart costs this much more
  widenAbove: 2,          // a route dearer than this many times its straight length asks the wider box (route)
});
/** VOYAGER1: the widest run of water a road crosses, pixels (a river; a lake's narrows). */
export const FORD_SPAN = 2;
/** VOYAGER1: the land's grain's lattice, pixels - about ten kilometres from one rough patch to the next. */
export const GRAIN_PX = 10;
/** VOYAGER1: the grain's patches - where the lattice's field runs over the first, eased in to whole at the second. */
export const GRAIN_EDGE = Object.freeze([0.5, 0.65]);
/** A lattice point's hash, 0..1 - integer arithmetic, the same on every client. */
function grainHash(ix, iy) {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967295;
}
/**
 * VOYAGER1: THE LAND'S GRAIN at a pixel past the Bay, 0..1 - what a map pixel's one height cannot say of 819 m of
 * ground: the woods, the fens, the broken ground a road-builder goes round on a plain. ROUGH PATCHES: a smooth field
 * (the lattice's hashes every GRAIN_PX pixels, eased between - value noise) taken where it runs over GRAIN_EDGE's first
 * and eased in to whole at its second - patches some kilometres across, whole over a quarter of the land and nought over
 * half. Measured on a plain (2026-10-26, routes 50 to 115 km): an even field of any strength leaves a least-cost road
 * ruler-straight (sinuosity 1.06, 80% of its length in straight stretches of 25 km and more, the longest 106 km - the
 * cheapest way through an even field is straight at any scale), where patches it goes round bend it (grainCost 2.5:
 * sinuosity 1.14, 40%, the longest 61 km). Only ever a cost, so no route is drawn cheaper than its length.
 * @param {number} x @param {number} y Bay pixels
 */
export function landGrain(x, y) {
  const fx = x / GRAIN_PX, fy = y / GRAIN_PX, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = grainHash(ix, iy), b = grainHash(ix + 1, iy), c = grainHash(ix, iy + 1), d = grainHash(ix + 1, iy + 1);
  const v = (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy - GRAIN_EDGE[0]) / (GRAIN_EDGE[1] - GRAIN_EDGE[0]);
  const t = v < 0 ? 0 : v > 1 ? 1 : v;
  return t * t * (3 - 2 * t);
}

/**
 * VOYAGER1: THE LAND A ROUTE IS COSTED ON over a W x H grid - `heights` the ground's bytes, `water` 1 where it is water
 * (and `keep` 1 where no road goes at all - the Bay's own pixels, a capital's): the heights averaged over a (2r + 1)^2
 * box (integer sums; the edge's box clipped), the shore (land with water among its eight neighbours) and the fords
 * (water on a run of no more than FORD_SPAN pixels, along a row, a column or a diagonal, with land a road walks at both
 * ends).
 * `grainOf(u, v)` the land's grain at a cell (landGrain at the pixel the cell stands for), none without it. ROAD-LOOK:
 * `still` 1 where the water is a lake's - water as any (its shore the shore's), never a ford: no road wades a lake.
 * @param {Uint8Array} heights @param {Uint8Array} water @param {?Uint8Array} keep @param {number} W @param {number} H
 * @param {Partial<Record<keyof typeof VOYAGER_DIALS, number>>} [dials] @param {?((u: number, v: number) => number)} [grainOf]
 * @param {?Uint8Array} [still]
 * @returns {{ height: Float32Array, shore: Uint8Array, ford: Uint8Array, grain: ?Float32Array, river: ?Float32Array, d: Record<keyof typeof VOYAGER_DIALS, number>, step: typeof landStep }}
 *   the builder's `terrain` whole: the land, its dials (VOYAGER_DIALS with `d`'s own) and its step
 */
export function landForRoutes(heights, water, keep, W, H, dials = VOYAGER_DIALS, grainOf = null, still = null) {
  const d = { ...VOYAGER_DIALS, ...dials };
  const r = d.smoothR;
  // a summed-area table: each box mean exact in integers
  const sum = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) { row += heights[y * W + x]; sum[(y + 1) * (W + 1) + x + 1] = sum[y * (W + 1) + x + 1] + row; }
  }
  const height = new Float32Array(W * H), shore = new Uint8Array(W * H), ford = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
      const s = sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0];
      height[y * W + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  const dry = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !water[y * W + x] && !(keep && keep[y * W + x]);
  const wet = (x, y) => x >= 0 && y >= 0 && x < W && y < H && water[y * W + x] === 1 && !(keep && keep[y * W + x]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!water[i]) {
        for (const [, dx, dy] of DIR_DELTA) if (wet(x + dx, y + dy)) { shore[i] = 1; break; }
        continue;
      }
      if (!wet(x, y) || (still && still[i])) continue;   // ROAD-LOOK: a lake's water is never a ford's
      // a ford: along some axis, the water through this pixel runs no more than FORD_SPAN with land at both ends
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        let a = 1, b = 1;
        while (a <= FORD_SPAN && wet(x - dx * a, y - dy * a)) a++;
        while (b <= FORD_SPAN && wet(x + dx * b, y + dy * b)) b++;
        if (a + b - 1 <= FORD_SPAN && dry(x - dx * a, y - dy * a) && dry(x + dx * b, y + dy * b)) { ford[i] = 1; break; }
      }
    }
  }
  let grain = null;
  if (grainOf) {
    grain = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!water[y * W + x]) grain[y * W + x] = grainOf(x, y);
  }
  return { height, shore, ford, grain, river: /** @type {?Float32Array} */ (null), d, step: landStep };
}

/** RIVER-FORDS (AUDIT RELEASE R1-3, the owner: "Take care of exclusions and gaps"; `03-World/Roads.md` RIVER-FORDS): A CARVED
 *  RIVER'S CHANNEL IS A FORD. CYRODIIL-WATERS carves its rivers narrower than a pixel inside the kernel, so the pixels'
 *  bytes carry none and the roads crossed them anywhere, along them too, priced as dry ground. Now a step onto a channel's
 *  pixel (world/tamriel/tamrielWaters.js riverRaster, the router's question) - or a diagonal between two, through the
 *  channel's corner - pays `cost` a step and `perM` more for each metre of the channel's width there: a road crosses a
 *  river once, square to it, where it is narrowest, and never runs along it. */
export const RIVER_FORD = Object.freeze({ cost: 12, perM: 0.05 });
/** A region's channels as the router prices them: each pixel's crossing price a step (0 none), off a riverRaster.
 *  @param {{ dir: Uint8Array, width: Uint16Array }} raster */
export function riverFords(raster) {
  const out = new Float32Array(raster.dir.length);
  for (let i = 0; i < out.length; i++) if (raster.dir[i]) out[i] = RIVER_FORD.cost + RIVER_FORD.perM * raster.width[i];
  return out;
}

/**
 * VOYAGER1: ONE STEP'S PRICE BY THE LAND'S LAW (VOYAGER_DIALS) - from (cx, cy) to its neighbour (nx, ny), `len` long:
 * the grade squared on the smoothed height, the height over `highAbove`, the shore's price, a ford's crossing. The road
 * discount and the turn are the caller's.
 * @param {{ height: Float32Array, shore: Uint8Array, ford: Uint8Array, grain?: ?Float32Array, river?: ?Float32Array, d: Record<keyof typeof VOYAGER_DIALS, number> }} t landForRoutes'
 */
export function landStep(t, cx, cy, nx, ny, len) {
  const D = t.d, i = ny * MAP_WIDTH + nx, hn = t.height[i];
  const g = (hn - t.height[cy * MAP_WIDTH + cx]) / len;
  let c = len * (1 + D.gradeCost * g * g);
  if (hn > D.highAbove) c *= 1 + (hn - D.highAbove) * D.highCost;
  if (t.shore[i]) c *= D.shoreCost;
  if (t.grain) c *= 1 + D.grainCost * t.grain[i];
  if (t.ford[i]) c += len * D.fordCost;
  // RIVER-FORDS: a carved channel crossed - onto its pixel, or through its corner between two of them
  if (t.river) { const r = t.river[i] || (cx !== nx && cy !== ny ? Math.min(t.river[cy * MAP_WIDTH + nx], t.river[ny * MAP_WIDTH + cx]) : 0); if (r) c += len * r; }
  return c;
}
