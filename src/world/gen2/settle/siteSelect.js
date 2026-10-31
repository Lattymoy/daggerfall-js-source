// @ts-check
// WG2 SETTLEMENT 2.0 (bible/03-World/World-2-Canon.md, "Where towns stand"): A SITE'S WORTH for each kind of
// settlement (data/settlementTypes.json `suit`): level ground, water near, fertile soil, ore near, high ground over its
// neighbourhood (defence), low ground, wet ground, dry air - each 0..1, weighed by the type. A fishing village favours
// the water, a mining town the ore, a fortress the heights. The candidates are the best sites a type's spacing apart.
import { distanceTo, prominence } from '../gridOps.js';
import { WATER } from '../hydrology.js';
import { clamp } from '../exact.js';
import { typeOf, RAYS } from './settlementGen.js';
import { BLEND_PX } from '../regionSampler.js';

const _fields = new WeakMap();
/** The sampler's site fields, made once: distance to a lake's cells (cells; the rivers are measured on their courses), prominence (m). */
function fieldsOf(S) {
  let f = _fields.get(S);
  if (!f) {
    const w = S.fields.water;
    f = { water: distanceTo(w, (k) => !!(w.data[k] & WATER.lake)), prom: prominence(S.fields.elev, 3 * S.header.res) };
    _fields.set(S, f);
  }
  return f;
}

/** Metres from a world point to the nearest open water the bake drew: a river's course, a lake's cell, a spring.
 *  @param {import('../regionSampler.js').RegionSampler} S @param {number} x @param {number} y */
export function waterDistM(S, x, y) {
  let best = Infinity;
  for (const r of S.header.rivers) for (let i = 0; i + 1 < r.pts.length; i++) {
    const [ax, ay, , , aw] = r.pts[i], [bx, by] = r.pts[i + 1], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const dx = x - ax - vx * t, dy = y - ay - vy * t, d = Math.sqrt(dx * dx + dy * dy) * 819.2 - aw / 2;
    if (d < best) best = d;
  }
  for (const sp of S.header.springs ?? []) best = Math.min(best, Math.sqrt((sp.x - x) * (sp.x - x) + (sp.y - y) * (sp.y - y)) * 819.2);
  const f = fieldsOf(S), [i, j] = S.fields.elev.cellOf(x, y);
  return Math.max(0, Math.min(best, f.water.get(i, j) * (819.2 / S.header.res)));
}

/** Is open water within `reach` metres, found as the generator finds its shore - sixteen rays out, a step at a time,
 *  water or a channel's bank? @param {import('../regionSampler.js').RegionSampler} S @param {number} x @param {number} y @param {number} reach */
export function waterWithin(S, x, y, reach) {
  for (let k = 0; k < 48; k += 3) {
    const [dx, dy] = RAYS[k];
    for (let s = 6; s <= reach; s += 6) {
      const px = x + (dx * s) / 819.2, py = y + (dy * s) / 819.2;
      if (S.waterAt(px, py)) return true;
      const c = S.channel(px, py);
      if (c && c.d < c.half + 3) return true;
    }
  }
  return false;
}

/** What a world point is worth, need by need (0..1 each). @param {import('../regionSampler.js').RegionSampler} S @param {number} x @param {number} y */
export function siteNeeds(S, x, y) {
  const f = fieldsOf(S), [i, j] = S.fields.elev.cellOf(x, y), e = /** @type {any} */ (S.env(x, y));
  const waterM = waterDistM(S, x, y);
  let ore = Infinity;
  for (const r of S.header.resources) if (r.kind === 'ore') ore = Math.min(ore, Math.sqrt((r.x - x) * (r.x - x) + (r.y - y) * (r.y - y)) * 819.2);
  const [lo, hi] = S.fields.elev.range();
  return {
    flat: clamp(1 - S.slopeAt(x, y) / 0.12, 0, 1),
    water: clamp(1 - waterM / 1500, 0, 1),
    fertile: clamp(e.fertility, 0, 1),
    ore: clamp(1 - ore / 3000, 0, 1),
    defense: clamp(f.prom.get(i, j) / 120, 0, 1),
    low: clamp(1 - (e.elev - lo) / (hi - lo + 1), 0, 1),
    wet: e.water & WATER.wetland ? 1 : 0,
    dry: clamp(1 - e.precip / 500, 0, 1),
  };
}

/** A site's score for a type: its needs weighed, nothing where the ground is water or the region's edge band.
 *  @param {import('../regionSampler.js').RegionSampler} S @param {string} type @param {number} x @param {number} y */
export function siteScore(S, type, x, y) {
  const t = typeOf(type);
  if (!t || S.weight(x, y) < 1 || !S.owns(x - BLEND_PX, y) || S.waterAt(x, y)) return -Infinity;
  if (t.docks && (waterDistM(S, x, y) > t.radius * 0.6 || !waterWithin(S, x, y, t.radius * 0.6))) return -Infinity;   // a water town stands on its water
  const n = siteNeeds(S, x, y);
  let v = 0;
  for (const [k, wgt] of Object.entries(t.suit)) v += wgt * /** @type {any} */ (n)[k];
  return v;
}

/** The best sites for a type, a lattice `step` world pixels apart, each its type's spacing from the last; best first.
 *  @param {import('../regionSampler.js').RegionSampler} S @param {string} type @param {{ step?: number, count?: number }} [o] */
export function siteCandidates(S, type, o = {}) {
  const t = typeOf(type), step = o.step ?? 2, r = S.rect, all = [];
  for (let y = r.y + BLEND_PX + 1; y < r.y + r.h - BLEND_PX - 1; y += step) for (let x = r.x + BLEND_PX + 1; x < r.x + r.w - BLEND_PX - 1; x += step) {
    const v = siteScore(S, type, x + 0.5, y + 0.5);
    if (v > -Infinity) all.push({ x: x + 0.5, y: y + 0.5, v });
  }
  all.sort((a, b) => b.v - a.v || a.y - b.y || a.x - b.x);
  const out = [], gap = /** @type {any} */ (t).spacing / 819.2;
  for (const c of all) {
    if (out.length >= (o.count ?? 8)) break;
    if (out.some((p) => (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y) < gap * gap)) continue;
    out.push(c);
  }
  return out;
}
