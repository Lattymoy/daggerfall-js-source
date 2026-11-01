// @ts-check
// THE CANONICAL GEOGRAPHY a bake reads - only what the repository owns,
// so a bake ships and every machine makes it again: the provinces' authored rings, the ranges' spines and the great
// rivers (world/tamriel/tamrielGeography.js), and the owner's relief (tamrielReliefData.js, loaded by canonReady) unmasked. The player's
// traced picture is never read (WG-3): a raster made from it is game data. The fit that lays the picture on the world
// is the manifest's, recorded from the freeware's own files, so the bake's pixels are the world's.
import { PROVINCES, MOUNTAIN_RANGES, RIVERS, pts } from '../tamriel/tamrielGeography.js';
import { PROVINCE_OF_ID } from '../tamriel/tamrielLand.js';
import { RELIEF_SCALE, decodeRelief } from '../tamriel/tamrielRelief.js';
import { fnv1a } from '../../formats/fnv1a.js';

/** @typedef {{ ox: number, oy: number, ppu: number }} Fit Bay pixel (0, 0) at picture (ox / ppu, oy / ppu) */

/** A world pixel point on the picture's grid. @param {Fit} fit @param {number} x @param {number} y @returns {[number, number]} */
export const worldToPicture = (fit, x, y) => [(x + fit.ox) / fit.ppu, (y + fit.oy) / fit.ppu];
/** A picture point in world pixels. @param {Fit} fit @param {number} px @param {number} py @returns {[number, number]} */
export const pictureToWorld = (fit, px, py) => [px * fit.ppu - fit.ox, py * fit.ppu - fit.oy];

/** The squared distance from a point to a segment - exact (no Math.hypot, which each engine rounds its own way). */
export function segmentD2(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const dx = px - (ax + vx * t), dy = py - (ay + vy * t);
  return dx * dx + dy * dy;
}

const THEATRE_OF_KEY = new Map(Object.entries(PROVINCE_OF_ID).map(([id, key]) => [key, Number(id)]));
/** @type {{ theatre: number, rings: {x: number, y: number}[][], box: number[] }[]|null} */
let _rings = null;
function rings() {
  if (_rings) return _rings;
  _rings = PROVINCES.map((p) => {
    const rs = p.rings.map((r) => pts(r));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rs) for (const q of r) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    return { theatre: /** @type {number} */ (THEATRE_OF_KEY.get(p.key)), rings: rs, box: [x0, y0, x1, y1] };
  });
  return _rings;
}
/** Even-odd point in ring, with the ring's last point joined to its first. */
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** The theatre (1..9) whose authored land holds a picture point, 0 at sea. @param {number} px @param {number} py */
export function canonTheatre(px, py) {
  for (const p of rings()) {
    if (px < p.box[0] || px > p.box[2] || py < p.box[1] || py > p.box[3]) continue;
    for (const r of p.rings) if (inRing(r, px, py)) return p.theatre;
  }
  return 0;
}

/** @type {any} */
let _data = null;
/** Load the owner's relief - its own chunk, never a static import (tamrielrelief.test.js) - before a bake reads the canon. */
export async function canonReady() {
  _data ??= (await import('../tamriel/tamrielReliefData.js')).RELIEF_DATA;
  return _data;
}
const reliefData = () => {
  if (!_data) throw new Error('wg2: await canonReady() before reading the canon');
  return _data;
};
/** @type {Uint8Array|null} */
let _relief = null;
/** The owner's relief, unmasked: its cells, WOODS bytes, RELIEF_SCALE cells a picture unit. */
export const reliefCells = () => (_relief ??= decodeRelief(reliefData()));
/** The relief at a picture point, bilinear between cell centres, WOODS bytes. @param {number} px @param {number} py */
export function canonRelief(px, py) {
  const c = reliefCells(), w = reliefData().w, h = reliefData().h, s = RELIEF_SCALE;
  const fx = px * s - 0.5, fy = py * s - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  const at = (a, b) => c[(b < 0 ? 0 : b >= h ? h - 1 : b) * w + (a < 0 ? 0 : a >= w ? w - 1 : a)];
  const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx, bot = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
  return top + (bot - top) * ty;
}

/** The ranges' spines and the rivers' courses as segments, picture units. */
const segsOf = (polys) => polys.flatMap((p, k) => p.pts.slice(1).map((b, i) => ({ k, ax: p.pts[i][0], ay: p.pts[i][1], bx: b[0], by: b[1] })));
const RANGE_SEGS = segsOf(MOUNTAIN_RANGES);
const RIVER_SEGS = segsOf(RIVERS);

/** The strongest range at a picture point: its index, its lift (gain at the spine to 0 at the band's edge, the
 *  authored tent of tamrielGeography.js rangeLift) and the distance to its spine in units.
 *  @param {number} px @param {number} py @returns {{ range: number, lift: number, d: number }} */
export function canonRange(px, py) {
  let range = -1, lift = 0, d = Infinity;
  for (const s of RANGE_SEGS) {
    const rg = MOUNTAIN_RANGES[s.k], d2 = segmentD2(px, py, s.ax, s.ay, s.bx, s.by);
    if (d2 >= rg.w * rg.w) continue;
    const dd = Math.sqrt(d2), l = rg.gain * (1 - dd / rg.w);
    if (l > lift) { lift = l; range = s.k; d = dd; }
  }
  return { range, lift, d };
}
/** The distance to the nearest authored great river's course, picture units (Infinity past `reach`).
 *  @param {number} px @param {number} py @param {number} reach */
export function canonRiverDistance(px, py, reach) {
  let best = reach * reach;
  for (const s of RIVER_SEGS) { const d2 = segmentD2(px, py, s.ax, s.ay, s.bx, s.by); if (d2 < best) best = d2; }
  return best < reach * reach ? Math.sqrt(best) : Infinity;
}

/** The canon's print: what a bake read, so a change to the authored geography or the relief moves every key. */
export function canonPrint() {
  const s = JSON.stringify([PROVINCES.map((p) => [p.key, p.rings]), MOUNTAIN_RANGES, RIVERS, reliefData().scale, reliefData().cells]);
  return fnv1a(new TextEncoder().encode(s)).toString(16).padStart(8, '0');
}
