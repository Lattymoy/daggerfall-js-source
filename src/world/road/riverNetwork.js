// @ts-check
// THE BAY'S RIVERS AND STREAMS, our own law. The land drains: every pixel's water runs to the sea or off the map's
// edge by the least climb (a priority flood over the heights), and a pixel that gathers the water of `riverArea`
// pixels carries a river, of `streamArea` a stream. A byte of WOODS.WLD is 8 m, so a terrace drains along the folds of
// a smooth noise under one byte (`relief`). Pure and in one order: every client draws the same rivers from the same
// heights. Basic Roads' compass (roadNetwork.js DIR_DELTA): each step's two pixels carry the bit toward the other, as
// the roads' do.
import { DIR_DELTA } from './roadNetwork.js';

export const RIVER_DIALS = Object.freeze({
  riverArea: 5000,   // pixels a river drains, at least (a pixel is 0.67 km2)
  streamArea: 1500,  // pixels a stream drains, at least
  relief: 0.9,       // the noise under a byte a flat drains by - less than one byte, so no water climbs a step
  reliefPx: 10,      // the noise's lattice, pixels
  pond: 40,          // water in fewer pixels than this is a pond a river runs through, not a sea it ends in
});

/** A lattice point's hash, 0..1 - integer arithmetic, the same on every client. */
function hash(ix, iy) {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ 0x1b873593;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
/** Smooth value noise, 0..1, on a lattice `px` pixels wide. */
export function reliefNoise(x, y, px) {
  const fx = x / px, fy = y / px, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Water in components of fewer than `pond` pixels (8-connected) - a pond the drainage runs through. */
function pondsOf(water, W, H, pond) {
  const comp = new Int32Array(W * H).fill(-1), sizes = [], stack = [];
  for (let s = 0; s < comp.length; s++) {
    if (!water[s] || comp[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    comp[s] = id;
    stack.push(s);
    while (stack.length) {
      const c = /** @type {number} */ (stack.pop()), x = c % W, y = (c - x) / W;
      n++;
      for (const [, dx, dy] of DIR_DELTA) {
        const nx = x + dx, ny = y + dy, q = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && water[q] && comp[q] < 0) { comp[q] = id; stack.push(q); }
      }
    }
    sizes.push(n);
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < out.length; i++) if (water[i] && sizes[comp[i]] < pond) out[i] = 1;
  return out;
}

/**
 * THE BAY'S RIVERS AND STREAMS over a W x H grid of height bytes (`water` 1 where the ground is the sea's).
 * @param {{ heights: Uint8Array, water: Uint8Array, W: number, H: number, dials?: Partial<typeof RIVER_DIALS> }} o
 * @returns {{ rivers: Uint8Array, streams: Uint8Array, stats: { riverPixels: number, streamPixels: number, mouths:
 * number, edges: number, ponds: number } }}
 */
export function buildRiverNetwork({ heights, water, W, H, dials = {} }) {
  const d = { ...RIVER_DIALS, ...dials }, N = W * H;
  const pond = pondsOf(water, W, H, d.pond);
  const sea = (i) => water[i] === 1 && pond[i] === 0;
  const e = new Float64Array(N);
  for (let i = 0; i < N; i++) e[i] = heights[i] + d.relief * reliefNoise(i % W, Math.floor(i / W), d.reliefPx);
  // the flood: a binary heap on (level, own height, index) - the lowest unflooded pixel next, ties the same everywhere
  const key = new Float64Array(N), tie = new Float64Array(N), val = new Int32Array(N);
  let size = 0;
  const less = (a, b) => key[a] < key[b] || (key[a] === key[b] && (tie[a] < tie[b] || (tie[a] === tie[b] && val[a] < val[b])));
  const swap = (a, b) => { const k = key[a], t = tie[a], v = val[a]; key[a] = key[b]; tie[a] = tie[b]; val[a] = val[b]; key[b] = k; tie[b] = t; val[b] = v; };
  const push = (k, v) => {
    let i = size++;
    key[i] = k; tie[i] = e[v]; val[i] = v;
    while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; }
  };
  const pop = () => {
    const v = val[0];
    if (--size) {
      key[0] = key[size]; tie[0] = tie[size]; val[0] = val[size];
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < size && less(l, m)) m = l;
        if (r < size && less(r, m)) m = r;
        if (m === i) break;
        swap(i, m); i = m;
      }
    }
    return v;
  };
  // the outlets: the sea, and the map's edge (the land goes on past it)
  const down = new Int32Array(N).fill(-1), seen = new Uint8Array(N), level = new Float64Array(N), order = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i - x) / W;
    if (sea(i)) { seen[i] = 1; level[i] = -1; push(-1, i); } else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { seen[i] = 1; level[i] = e[i]; push(e[i], i); }
  }
  let n = 0;
  while (size) {
    const c = pop(), x = c % W, y = (c - x) / W;
    if (!sea(c)) order[n++] = c;
    for (const [, dx, dy] of DIR_DELTA) {
      const nx = x + dx, ny = y + dy, q = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[q]) continue;
      seen[q] = 1;
      down[q] = c;
      level[q] = Math.max(e[q], level[c]);
      push(level[q], q);
    }
  }
  // the water each pixel gathers: itself and all that drains through it (children after parents in the flood's order)
  const area = new Float64Array(N);
  for (let k = n - 1; k >= 0; k--) { const i = order[k]; area[i] += 1; if (down[i] >= 0 && !sea(down[i])) area[down[i]] += area[i]; }
  const rivers = new Uint8Array(N), streams = new Uint8Array(N);
  const stats = { riverPixels: 0, streamPixels: 0, mouths: 0, edges: 0, ponds: 0 };
  for (let k = 0; k < n; k++) {
    const i = order[k], j = down[i];
    const mask = area[i] >= d.riverArea ? rivers : area[i] >= d.streamArea ? streams : null;
    if (!mask) continue;
    if (j < 0) { if (mask === rivers) stats.edges++; continue; }   // off the map's edge: it ends in its last pixel
    const x = i % W, y = (i - x) / W, dx = (j % W) - x, dy = (j - (j % W)) / W - y;
    const k8 = DIR_DELTA.findIndex(([, ex, ey]) => ex === dx && ey === dy);
    mask[i] |= DIR_DELTA[k8][0];
    mask[j] |= DIR_DELTA[(k8 + 4) % 8][0];
    if (sea(j) && mask === rivers) stats.mouths++;
  }
  for (let i = 0; i < N; i++) { if (rivers[i]) stats.riverPixels++; if (streams[i]) stats.streamPixels++; if (pond[i]) stats.ponds++; }
  return { rivers, streams, stats };
}

/** RIVER-FORDS' price on the Bay's own channels (roadLand.js RIVER_FORD): a road crosses a river or a stream once, square
 *  to it, and never runs along it. Painted widths: a river two tiles of water (12.8 m), a stream one (6.4 m).
 *  @param {Uint8Array} rivers @param {Uint8Array} streams @param {{ cost: number, perM: number }} ford */
export function riverPrices(rivers, streams, ford) {
  const out = new Float32Array(rivers.length);
  for (let i = 0; i < out.length; i++) out[i] = rivers[i] ? ford.cost + ford.perM * 12.8 : streams[i] ? ford.cost + ford.perM * 6.4 : 0;
  return out;
}
