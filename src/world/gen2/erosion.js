// @ts-check
// WG2 EROSION (bible/03-World/World-2-Arc.md, Phase 2; offline only - a client never runs it, WG-4). Stream power with
// an implicit step (Braun and Willett 2013, n = 1): a river cuts in proportion to the square root of the rain it
// gathers and its slope, softer rock faster; what it cuts is carried down and laid where the slope can no longer carry
// it (fans and flood plains); a slope steeper than its rock can stand slides (thermal erosion). The region's edge holds
// its height. Every pass walks the drainage order, so the result is the same on any machine.
import { route, hollowsOf } from './drainage.js';
import { ROCKS } from './tables.js';
import { D8X, D8Y, D8L } from './field.js';

/** Years a step. */
export const DT = 2000;
/** The stream's erodibility for k = 1 (shale), per year, for metres of square-rooted rain-area. */
export const K_BASE = 3.2e-6;
/** The land's rise where the uplift is whole, metres a year. */
export const UPLIFT_RATE = 1.5e-4;
/** What a stream can carry, as a share of what it could cut on the same slope. */
export const CARRY = 1.2;
/** Thermal passes a step, and the share of a slope's excess moved a pass. */
export const SLIDE_PASSES = 2;
export const SLIDE_SHARE = 0.2;
/** A rock's talus (data/rocks.json, a slope's) read at a region cell's breadth: a face that stands at 50 degrees over
 *  ten metres does not over four hundred. */
export const TALUS_SCALE = 0.55;
/** The most a cell is built up a step, metres - a fan grows, it never dams its own stream in one step. */
export const LAY_MAX = 0.5;
/** The share of rain a river from beyond the region carries as water: its discharge is read back as the rain that made
 *  it, the measure the stream's power is taken in. */
export const INFLOW_RUNOFF = 0.3;

/**
 * Work a region's land. `elev` in metres (not changed); answers the worked land, the sediment the water laid on each
 * cell (metres, for the soils), what slid onto it from the slope above (`fallen`) and the depth cut from it.
 * @param {import('./field.js').Field} elev @param {import('./field.js').Field} rock @param {import('./field.js').Field} uplift
 * @param {import('./field.js').Field} precip mm a year @param {number} cellM
 * @param {{ steps?: number, k?: number, isSea?: (k: number) => boolean, inflow?: Float64Array|null }} [o] inflow: m3/s a cell from past the edge
 */
export function erode(elev, rock, uplift, precip, cellM, o = {}) {
  const steps = o.steps ?? 80, kScale = o.k ?? 1, isSea = o.isSea ?? (() => false), inflow = o.inflow ?? null;
  const { w, h: H } = elev, n = w * H, area = cellM * cellM;
  const h = Float64Array.from(elev.data), deposit = new Float64Array(n), cut = new Float64Array(n), fallen = new Float64Array(n);
  const K = new Float64Array(n), talus = new Float64Array(n), rain = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = ROCKS[rock.data[k]];
    K[k] = K_BASE * kScale * r.k;
    talus[k] = r.talus * TALUS_SCALE;
    rain[k] = area * (precip.data[k] / 1000) + (inflow ? (inflow[k] * 31557600) / INFLOW_RUNOFF : 0);
  }
  const edge = (k) => { const i = k % w, j = (k / w) | 0; return i === 0 || j === 0 || i === w - 1 || j === H - 1 || isSea(k); };
  const surf = { w, h: H, data: h };
  const Q = new Float64Array(n), qs = new Float64Array(n), eroded = new Float64Array(n), delta = new Float64Array(n);
  for (let s = 0; s < steps; s++) {
    const rt = route(/** @type {any} */ (surf), cellM, isSea);
    // the rain gathered, upstream first
    Q.set(rain);
    for (let o2 = n - 1; o2 >= 0; o2--) { const k = rt.order[o2], r = rt.rcv[k]; if (r >= 0) Q[r] += Q[k]; }
    // the cut, downstream first: each cell solved against its receiver's new height
    for (let o2 = 0; o2 < n; o2++) {
      const k = rt.order[o2], r = rt.rcv[k];
      eroded[k] = 0;
      if (r < 0 || edge(k)) continue;
      const up = DT * UPLIFT_RATE * uplift.data[k];
      if (rt.filled[k] > h[k] + 1e-6) { h[k] += up; continue; }   // under a lake: no stream cuts
      const f = (DT * K[k] * Math.sqrt(Q[k])) / rt.dist[k];
      const next = (h[k] + up + f * h[r]) / (1 + f);
      eroded[k] = Math.max(0, h[k] + up - next);
      h[k] = next;
    }
    // the load, upstream first: what a cell cuts joins what reaches it; past what its slope carries, it is laid down;
    // a lake keeps all it is given and lays it evenly over its floor, to its brim
    qs.fill(0);
    const pools = hollowsOf(rt, /** @type {any} */ (surf)), poolOf = new Int32Array(n).fill(-1), held = new Float64Array(pools.length);
    pools.forEach((p, i) => { for (const c of p.cells) poolOf[c] = i; });
    for (let o2 = n - 1; o2 >= 0; o2--) {
      const k = rt.order[o2], r = rt.rcv[k];
      qs[k] += eroded[k] * area;
      cut[k] += eroded[k];
      if (r < 0) continue;
      if (poolOf[k] >= 0) { held[poolOf[k]] += qs[k]; qs[k] = 0; continue; }
      const slope = Math.max(0, h[k] - h[r]) / rt.dist[k];
      const carry = CARRY * DT * K[k] * Math.sqrt(Q[k]) * slope * area;
      if (qs[k] > carry) {
        const lay = Math.min((qs[k] - carry) * 0.5 / area, LAY_MAX);
        h[k] += lay; deposit[k] += lay; qs[k] -= lay * area;
      }
      qs[r] += qs[k];
    }
    pools.forEach((p, i) => {
      const lay = held[i] / (p.cells.length * area);
      for (const c of p.cells) { const add = Math.min(lay, rt.filled[c] - h[c]); h[c] += add; deposit[c] += add; }
    });
    // the slides: a slope past its rock's talus gives a share of its excess to the cell below (both read before either moves)
    for (let p = 0; p < SLIDE_PASSES; p++) {
      delta.fill(0);
      for (let k = 0; k < n; k++) {
        if (edge(k)) continue;
        const i = k % w, j = (k / w) | 0;
        for (let d = 0; d < 8; d++) {
          const nk = (j + D8Y[d]) * w + i + D8X[d], l = D8L[d] * cellM, drop = h[k] - h[nk], excess = drop - talus[k] * l;
          if (excess > 0) { const m = SLIDE_SHARE * excess / 8; delta[k] -= m; delta[nk] += m; }
        }
      }
      for (let k = 0; k < n; k++) if (!edge(k)) { h[k] += delta[k]; if (delta[k] > 0) fallen[k] += delta[k]; }
    }
  }
  const out = elev.like(), dep = elev.like(), cutF = elev.like(), fell = elev.like();
  out.data.set(h); dep.data.set(deposit); cutF.data.set(cut); fell.data.set(fallen);
  return { elev: out, deposit: dep, cut: cutF, fallen: fell };
}
