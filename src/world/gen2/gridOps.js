// @ts-check
// WG2: the grid's shared operations - a priority queue that breaks ties by index (so two machines pop the same cell
// first), a box blur, a chamfer distance and the slope. Exact arithmetic only (exact.js).
import { Field, D8X, D8Y, D8L } from './field.js';

/** A binary min-heap of cell indices keyed by a number; equal keys pop the lower index first. */
export class CellHeap {
  /** @param {number} capacity */
  constructor(capacity) {
    this.keys = new Float64Array(capacity);
    this.ids = new Int32Array(capacity);
    this.size = 0;
  }
  /** @param {number} a @param {number} b */
  less(a, b) { return this.keys[a] < this.keys[b] || (this.keys[a] === this.keys[b] && this.ids[a] < this.ids[b]); }
  /** @param {number} a @param {number} b */
  swap(a, b) {
    const k = this.keys[a]; this.keys[a] = this.keys[b]; this.keys[b] = k;
    const i = this.ids[a]; this.ids[a] = this.ids[b]; this.ids[b] = i;
  }
  /** @param {number} id @param {number} key */
  push(id, key) {
    let n = this.size++;
    this.keys[n] = key; this.ids[n] = id;
    while (n > 0) { const p = (n - 1) >> 1; if (!this.less(n, p)) break; this.swap(n, p); n = p; }
  }
  /** The lowest key's cell; its key is left in `top`. */
  pop() {
    const id = this.ids[0];
    this.top = this.keys[0];
    const last = --this.size;
    if (last > 0) {
      this.keys[0] = this.keys[last]; this.ids[0] = this.ids[last];
      let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1;
        let m = n;
        if (l < last && this.less(l, m)) m = l;
        if (r < last && this.less(r, m)) m = r;
        if (m === n) break;
        this.swap(n, m); n = m;
      }
    }
    return id;
  }
}

/** A box blur of `radius` cells, run `passes` times (three passes come close to a gaussian). @param {Field} f
 *  @param {number} radius @param {number} [passes] */
export function blur(f, radius, passes = 3) {
  const { w, h } = f;
  let src = Float64Array.from(f.data), tmp = new Float64Array(w * h);
  const n = 2 * radius + 1;
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let s = 0;
        for (let d = -radius; d <= radius; d++) { const x = i + d; s += src[j * w + (x < 0 ? 0 : x >= w ? w - 1 : x)]; }
        tmp[j * w + i] = s / n;
      }
    }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let s = 0;
        for (let d = -radius; d <= radius; d++) { const y = j + d; s += tmp[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + i]; }
        src[j * w + i] = s / n;
      }
    }
  }
  const out = f.like(Float64Array);
  out.data.set(src);
  return out;
}

/** The distance in cells from every cell to the nearest cell `mask` marks (chamfer 3-4, within 6% of the true
 *  distance), Infinity with none marked. @param {Field} like @param {(k: number) => boolean} mask */
export function distanceTo(like, mask) {
  const { w, h } = like, d = new Float64Array(w * h);
  for (let k = 0; k < w * h; k++) d[k] = mask(k) ? 0 : Infinity;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    if (i > 0) d[k] = Math.min(d[k], d[k - 1] + 3);
    if (j > 0) {
      d[k] = Math.min(d[k], d[k - w] + 3);
      if (i > 0) d[k] = Math.min(d[k], d[k - w - 1] + 4);
      if (i < w - 1) d[k] = Math.min(d[k], d[k - w + 1] + 4);
    }
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const k = j * w + i;
    if (i < w - 1) d[k] = Math.min(d[k], d[k + 1] + 3);
    if (j < h - 1) {
      d[k] = Math.min(d[k], d[k + w] + 3);
      if (i < w - 1) d[k] = Math.min(d[k], d[k + w + 1] + 4);
      if (i > 0) d[k] = Math.min(d[k], d[k + w - 1] + 4);
    }
  }
  const out = like.like(Float64Array);
  for (let k = 0; k < w * h; k++) out.data[k] = d[k] / 3;
  return out;
}

/** The slope (rise over run) at every cell, central differences. @param {Field} elev metres @param {number} cellM */
export function slopeOf(elev, cellM) {
  const out = elev.like(Float64Array);
  for (let j = 0; j < elev.h; j++) for (let i = 0; i < elev.w; i++) {
    const gx = (elev.get(i + 1, j) - elev.get(i - 1, j)) / (2 * cellM), gy = (elev.get(i, j + 1) - elev.get(i, j - 1)) / (2 * cellM);
    out.data[j * elev.w + i] = Math.sqrt(gx * gx + gy * gy);
  }
  return out;
}

/** How a cell stands over its neighbourhood (`radius` cells): positive on ridges and tops, negative in hollows, metres.
 *  @param {Field} elev @param {number} radius */
export function prominence(elev, radius) {
  const mean = blur(elev, radius, 2), out = elev.like(Float64Array);
  for (let k = 0; k < out.data.length; k++) out.data[k] = elev.data[k] - mean.data[k];
  return out;
}

/** The index of a cell's D8 neighbour `d`, or -1 off the grid. @param {number} w @param {number} h @param {number} k @param {number} d */
export function neighbour(w, h, k, d) {
  const i = (k % w) + D8X[d], j = ((k / w) | 0) + D8Y[d];
  return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i;
}
export { D8L };
