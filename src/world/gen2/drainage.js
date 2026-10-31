// @ts-check
// WG2 DRAINAGE (bible/03-World/World-2-Canon.md, "Water"): where each cell's water goes. A priority flood from the
// region's edge and the sea (Barnes, Lehman and Mulla 2014, with an epsilon) fills every closed hollow to its spill,
// so water crosses a lake to its outlet; each cell then drains to its steepest lower neighbour on the filled ground.
// The flood's pop order runs downstream to upstream: the order every pass below walks.
import { Field, D8X, D8Y, D8L } from './field.js';
import { CellHeap } from './gridOps.js';

/** The rise a filled flat gains a cell, metres, so every filled cell has a way down. */
export const EPSILON = 0.001;

/**
 * Route a surface. `filled` is the ground with every hollow brimful (EPSILON-graded), `rcv` each cell's receiver
 * (-1 at an outlet: the region's edge or the sea), `dist` the metres to it, `order` the cells downstream first.
 * @param {Field} h metres @param {number} cellM @param {(k: number) => boolean} [isSea]
 */
export function route(h, cellM, isSea = () => false) {
  const { w, h: H } = h, n = w * H, heap = new CellHeap(n);
  const filled = new Float64Array(n), seen = new Uint8Array(n), order = new Int32Array(n), rcv = new Int32Array(n).fill(-1), dist = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const i = k % w, j = (k / w) | 0;
    if (i === 0 || j === 0 || i === w - 1 || j === H - 1 || isSea(k)) { seen[k] = 1; filled[k] = h.data[k]; heap.push(k, h.data[k]); }
  }
  let o = 0;
  while (heap.size) {
    const c = heap.pop(), fc = filled[c];
    order[o++] = c;
    const ci = c % w, cj = (c / w) | 0;
    for (let d = 0; d < 8; d++) {
      const i = ci + D8X[d], j = cj + D8Y[d];
      if (i < 0 || j < 0 || i >= w || j >= H) continue;
      const nk = j * w + i;
      if (seen[nk]) continue;
      seen[nk] = 1;
      const f = h.data[nk] > fc + EPSILON ? h.data[nk] : fc + EPSILON;
      filled[nk] = f;
      heap.push(nk, f);
    }
  }
  // the steepest way down on the filled ground (the flood's discoverer is lower, so every inner cell has one)
  for (let k = 0; k < n; k++) {
    const i = k % w, j = (k / w) | 0;
    if (i === 0 || j === 0 || i === w - 1 || j === H - 1 || isSea(k)) continue;
    let best = 0, r = -1, rd = 0;
    for (let d = 0; d < 8; d++) {
      const nk = (j + D8Y[d]) * w + i + D8X[d], l = D8L[d] * cellM, s = (filled[k] - filled[nk]) / l;
      if (s > best) { best = s; r = nk; rd = l; }
    }
    rcv[k] = r; dist[k] = rd;
  }
  return { filled, rcv, dist, order };
}

/** Sum `own` down the routing: each cell's total of itself and everything upstream of it. @param {{ rcv: Int32Array, order: Int32Array }} rt
 *  @param {Float64Array} own */
export function accumulate(rt, own) {
  const acc = Float64Array.from(own);
  for (let o = rt.order.length - 1; o >= 0; o--) { const k = rt.order[o], r = rt.rcv[k]; if (r >= 0) acc[r] += acc[k]; }
  return acc;
}

/**
 * The filled flats: each closed hollow the flood brimmed, whole - its cells, its spill (its most downstream cell; every
 * cell of a filled flat drains to it) and its greatest depth.
 * @param {{ filled: Float64Array, order: Int32Array }} rt @param {Field} h
 * @returns {{ cells: number[], outlet: number, deep: number }[]}
 */
export function hollowsOf(rt, h) {
  const { w, h: H } = h, n = w * H, pos = new Int32Array(n), seen = new Uint8Array(n), out = [];
  for (let o = 0; o < n; o++) pos[rt.order[o]] = o;
  const wet = (k) => rt.filled[k] - h.data[k] > 1e-6;
  for (let k = 0; k < n; k++) {
    if (seen[k] || !wet(k)) continue;
    const cells = [k];
    seen[k] = 1;
    let deep = 0, outlet = k;
    for (let c = 0; c < cells.length; c++) {
      const ck = cells[c], ci = ck % w, cj = (ck / w) | 0;
      deep = Math.max(deep, rt.filled[ck] - h.data[ck]);
      if (pos[ck] < pos[outlet]) outlet = ck;
      for (let d = 0; d < 8; d++) {
        const i = ci + D8X[d], j = cj + D8Y[d], nk = j * w + i;
        if (i < 0 || j < 0 || i >= w || j >= H || seen[nk] || !wet(nk)) continue;
        seen[nk] = 1; cells.push(nk);
      }
    }
    out.push({ cells, outlet, deep });
  }
  return out;
}
