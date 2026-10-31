// @ts-check
// WG2 (bible/03-World/World-2-Canon.md, "Fields"): A RASTER FIELD over world pixels - elevation, rainfall, soil and the
// rest. A grid of `w` x `h` cells, `res` cells to a world pixel, its cell (0, 0) at world pixel (x0, y0); cell (i, j)
// covers [x0 + i / res, x0 + (i + 1) / res). Coordinates are the world's (Bay pixels, negative west and north of it).
import { fnv1a } from '../../formats/fnv1a.js';

/** @typedef {{ x0: number, y0: number, res: number }} FieldFrame */

export class Field {
  /** @param {number} w @param {number} h @param {FieldFrame} frame @param {Float64ArrayConstructor|Float32ArrayConstructor|Int16ArrayConstructor|Uint8ArrayConstructor|Int32ArrayConstructor} [Ctor] */
  constructor(w, h, frame, Ctor = Float64Array) {
    if (!(Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0)) throw new Error(`field: bad size ${w} x ${h}`);
    this.w = w;
    this.h = h;
    this.x0 = frame.x0;
    this.y0 = frame.y0;
    this.res = frame.res;
    this.data = new Ctor(w * h);
  }
  /** The frame, to make a sibling on the same grid. @returns {FieldFrame} */
  get frame() { return { x0: this.x0, y0: this.y0, res: this.res }; }
  /** A field of the same grid. @param {any} [Ctor] */
  like(Ctor = Float64Array) { return new Field(this.w, this.h, this.frame, Ctor); }
  clone() {
    const f = new Field(this.w, this.h, this.frame, /** @type {any} */ (this.data.constructor));
    f.data.set(/** @type {any} */ (this.data));
    return f;
  }
  /** A cell's value, its index clamped to the grid. @param {number} i @param {number} j */
  get(i, j) {
    const x = i < 0 ? 0 : i >= this.w ? this.w - 1 : i, y = j < 0 ? 0 : j >= this.h ? this.h - 1 : j;
    return this.data[y * this.w + x];
  }
  /** @param {number} i @param {number} j @param {number} v */
  set(i, j, v) { this.data[j * this.w + i] = v; }
  /** Is the world point inside the grid? @param {number} wx @param {number} wy */
  covers(wx, wy) {
    const i = (wx - this.x0) * this.res, j = (wy - this.y0) * this.res;
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }
  /** The cell a world point is in, clamped. @param {number} wx @param {number} wy @returns {[number, number]} */
  cellOf(wx, wy) {
    const i = Math.floor((wx - this.x0) * this.res), j = Math.floor((wy - this.y0) * this.res);
    return [i < 0 ? 0 : i >= this.w ? this.w - 1 : i, j < 0 ? 0 : j >= this.h ? this.h - 1 : j];
  }
  /** Bilinear between cell centres at a world point. @param {number} wx @param {number} wy */
  at(wx, wy) {
    const fx = (wx - this.x0) * this.res - 0.5, fy = (wy - this.y0) * this.res - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const a = this.get(i, j) + (this.get(i + 1, j) - this.get(i, j)) * tx;
    const b = this.get(i, j + 1) + (this.get(i + 1, j + 1) - this.get(i, j + 1)) * tx;
    return a + (b - a) * ty;
  }
  /** Catmull-Rom between cell centres at a world point: smooth slopes across cells, for the ground a body stands on.
   *  @param {number} wx @param {number} wy */
  cubicAt(wx, wy) {
    const fx = (wx - this.x0) * this.res - 0.5, fy = (wy - this.y0) * this.res - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const row = (r) => catmull(this.get(i - 1, r), this.get(i, r), this.get(i + 1, r), this.get(i + 2, r), tx);
    return catmull(row(j - 1), row(j), row(j + 1), row(j + 2), ty);
  }
  /** The least and greatest value. */
  range() {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < this.data.length; k++) { const v = this.data[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
    return [lo, hi];
  }
}

/** Catmull-Rom through p1..p2 at t. */
export function catmull(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

/** The eight neighbours' offsets, D8's order (east, then clockwise), and their distances in cells. */
export const D8X = Int8Array.of(1, 1, 0, -1, -1, -1, 0, 1);
export const D8Y = Int8Array.of(0, 1, 1, 1, 0, -1, -1, -1);
export const D8L = Float64Array.of(1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2);

/** FNV-1a over a field's bytes: its print, for the stage's key and the pins. @param {Field} f */
export function fieldPrint(f) {
  return fnv1a(new Uint8Array(f.data.buffer, f.data.byteOffset, f.data.byteLength)).toString(16).padStart(8, '0');
}
