// WG2 HYDROLOGY (bible/03-World/World-2-Canon.md, "Water"): rivers, lakes, falls, wetlands and the water table from
// the worked land and the climate. Rain less what the warmth takes runs down the drainage; a closed hollow fills to
// where its evaporation meets its inflow - brimful and spilling in a wet land, a terminal lake or a salt flat in a
// dry one. A river's surface never rises downstream (each cell's is at most every donor's), and its bed sits under it.
import { Field, D8X, D8Y } from './field.js';
import { route, hollowsOf } from './drainage.js';
import { clamp } from './exact.js';
import { riverWidth, riverDepth, riverCourse } from './riverLaw.js';

export { riverWidth, riverDepth, riverCourse };

/** Seconds a year. */
const YEAR_S = 31557600;
/** Least discharge a river carries, m3/s. */
export const RIVER_Q = 0.25;
/** A hollow deeper than this holds water, metres. */
export const LAKE_DEPTH = 1.5;
/** A hollow smaller than this many cells is the ground's own roughness, not a basin. */
export const HOLLOW_CELLS = 4;
/** A drop along a river this tall over a cell at this slope is a fall; a smaller steep drop is rapids. */
export const FALL_DROP = 6;
export const FALL_SLOPE = 0.1;
export const RAPIDS_DROP = 2;
/** The share of a dry river's water lost a kilometre (to sand and air) where the rain is under DRY_MM. */
export const DRY_LOSS = 0.02;
export const DRY_MM = 400;
/** A flood plain reaches this many world pixels from its river along the drainage. */
export const FLOOD_CELLS = 3;
/** A channel drains at least this many square kilometres (a wet land does not cut a channel in every hollow). */
export const RIVER_KM2 = 20;

/** Water flags a cell carries (the `water` field). */
export const WATER = Object.freeze({ river: 1, lake: 2, wetland: 4, floodplain: 8, spring: 16, playa: 32, fall: 64 });

/** Evaporation from open water and the land's own (potential), metres a year, from the mean air. @param {number} t */
export const evaporation = (t) => clamp(0.35 + 0.075 * t, 0.2, 2.6);
/** The rain that runs off, metres a year, for rain `p` and the warmth's evaporation `e` (both metres a year): p^3 / (p^2 +
 *  e^2) - a dry land sheds a few hundredths of its storms, a wet one most of its rain (Budyko's shape, exact). */
export const runoff = (p, e) => (p * p * p) / (p * p + e * e);

/**
 * @param {import('./geology.js').RegionSpec} spec @param {Field} elev worked land, metres @param {ReturnType<import('./climate.js').climate>} air
 * @param {number} cellM @param {{ isSea?: (k: number) => boolean, inflow?: Float64Array, wet?: Field }} [o]
 *   inflow: m3/s entering each cell from upstream past the region; wet: the province's share of flat land that holds water
 */
export function hydrology(spec, elev, air, cellM, o = {}) {
  const { w, h: H } = elev, n = w * H, area = cellM * cellM, isSea = o.isSea ?? (() => false);
  const rt = route(elev, cellM, isSea);
  // the water each cell gives: the rain that runs off, springs, and what flows in past the region's edge
  const own = new Float64Array(n);
  for (let k = 0; k < n; k++) own[k] = (runoff(air.precip.data[k] / 1000, evaporation(air.temp.data[k])) * area) / YEAR_S + (o.inflow?.[k] ?? 0);
  const springs = [];
  for (const s of spec.springs ?? []) {
    const k = cellIndex(elev, s.x, s.y);
    if (k >= 0) { own[k] += s.flow; springs.push({ ...s, cell: k }); }
  }
  // the hollows that hold water: deeper than LAKE_DEPTH and wider than the ground's roughness
  const hollows = hollowsOf(rt, elev).filter((hw) => hw.deep > LAKE_DEPTH && hw.cells.length >= HOLLOW_CELLS);
  const outletOf = new Map(hollows.map((hw) => [hw.outlet, hw]));
  // the water down the drainage, upstream first: a dry land's rivers lose water; a hollow's balance is struck at its outlet
  const Q = Float64Array.from(own), lakeId = new Field(w, H, elev.frame, Uint16Array), lakes = [];
  for (let o2 = n - 1; o2 >= 0; o2--) {
    const k = rt.order[o2], r = rt.rcv[k];
    const hw = outletOf.get(k);
    if (hw) {
      const evap = evaporation(air.temp.data[k]);
      const inflowYr = Q[k] * YEAR_S, cells = hw.cells.slice().sort((a, b) => elev.data[a] - elev.data[b] || a - b);
      const full = cells.length * area * evap;
      let level, kept;
      if (inflowYr >= full) { level = rt.filled[hw.outlet]; kept = cells.filter((c) => elev.data[c] < level); Q[k] = (inflowYr - full) / YEAR_S; }
      else {
        const nWet = Math.floor(inflowYr / (area * evap));
        kept = cells.slice(0, nWet);
        level = nWet ? Math.min(rt.filled[hw.outlet], elev.data[cells[Math.min(nWet, cells.length - 1)]]) : elev.data[cells[0]];
        Q[k] = 0;
      }
      const dry = kept.length === 0, terminal = Q[k] === 0;
      const lake = { id: lakes.length + 1, level, cells: kept.length, hollow: cells.length, inflow: inflowYr / YEAR_S, outflow: Q[k],
        kind: dry ? 'playa' : terminal ? 'terminal' : kept.length * area < 4e5 ? 'pond' : 'lake', x: 0, y: 0, floor: elev.data[cells[0]] };
      const at = kept.length ? kept : [cells[0]];
      let sx = 0, sy = 0;
      for (const c of at) { lakeId.data[c] = lake.id; sx += c % w; sy += (c / w) | 0; }
      lake.x = elev.x0 + (sx / at.length + 0.5) / elev.res; lake.y = elev.y0 + (sy / at.length + 0.5) / elev.res;
      lakes.push(lake);
    }
    if (r < 0) continue;
    const dry = air.precip.data[k] < DRY_MM ? DRY_LOSS * (rt.dist[k] / 1000) * (1 - air.precip.data[k] / DRY_MM) : 0;
    Q[r] += Q[k] * (1 - dry);
  }
  // the rivers' cells, and each one's surface: at most every river cell that drains to it, at most its own ground
  const water = new Field(w, H, elev.frame, Uint8Array), S = new Float64Array(n).fill(Infinity), order = new Uint8Array(n);
  const cellsKm2 = area / 1e6, drained = new Float64Array(n).fill(cellsKm2);
  for (let o2 = n - 1; o2 >= 0; o2--) { const k = rt.order[o2], r = rt.rcv[k]; if (r >= 0) drained[r] += drained[k]; }
  const isRiver = (k) => Q[k] >= RIVER_Q && drained[k] >= RIVER_KM2 && !lakeId.data[k];
  for (let o2 = n - 1; o2 >= 0; o2--) {
    const k = rt.order[o2];
    if (lakeId.data[k]) water.data[k] |= lakes[lakeId.data[k] - 1].kind === 'playa' ? WATER.playa : WATER.lake;
    if (!isRiver(k)) continue;
    water.data[k] |= WATER.river;
    S[k] = Math.min(S[k], elev.data[k]);
    if (!order[k]) order[k] = 1;
    const r = rt.rcv[k];
    if (r >= 0) {
      S[r] = Math.min(S[r], S[k]);
      order[r] = order[r] === order[k] ? order[k] + 1 : Math.max(order[r], order[k]);
    }
  }
  for (const s of springs) water.data[s.cell] |= WATER.spring;
  const rivers = traceRivers(elev, rt, Q, S, order, isRiver, lakeId);
  const falls = [];
  for (let k = 0; k < n; k++) {
    const r = rt.rcv[k];
    if (!(water.data[k] & WATER.river) || r < 0 || !(S[r] < Infinity)) continue;
    const drop = S[k] - S[r], slope = drop / rt.dist[k];
    if (drop >= FALL_DROP && slope >= FALL_SLOPE) { water.data[k] |= WATER.fall; falls.push({ x: cx(elev, k, r), y: cy(elev, k, r), drop, q: Q[k], kind: 'fall' }); }
    else if (drop >= RAPIDS_DROP && slope >= FALL_SLOPE * 0.3) falls.push({ x: cx(elev, k, r), y: cy(elev, k, r), drop, q: Q[k], kind: 'rapids' });
  }
  // the valley floor under a river stands at its water (the channel itself is carved by the vector river, WG-6)
  const carved = elev.clone();
  for (let k = 0; k < n; k++) if (water.data[k] & WATER.river) carved.data[k] = Math.min(carved.data[k], S[k] + 0.5);
  // height above the nearest water down the drainage, and that water's depth (for the flood plain), downstream first
  const hand = elev.like(), chanH = new Float64Array(n), chanD = new Float64Array(n), chanN = new Int32Array(n);
  for (let o2 = 0; o2 < n; o2++) {
    const k = rt.order[o2], r = rt.rcv[k], lk = lakeId.data[k];
    if (water.data[k] & WATER.river) { chanH[k] = S[k]; chanD[k] = riverDepth(Q[k]); chanN[k] = 0; }
    else if (lk) { chanH[k] = lakes[lk - 1].level; chanD[k] = 0; chanN[k] = 0; }
    else if (r >= 0) { chanH[k] = chanH[r]; chanD[k] = chanD[r]; chanN[k] = chanN[r] + 1; }
    else { chanH[k] = carved.data[k]; chanD[k] = 0; chanN[k] = 0; }
    hand.data[k] = Math.max(0, carved.data[k] - chanH[k]);
  }
  const table = elev.like(), discharge = elev.like();
  for (let k = 0; k < n; k++) {
    discharge.data[k] = Q[k];
    const p = air.precip.data[k], slope = slopeAtCell(carved, k, cellM), wet = o.wet?.data[k] ?? 0.2;
    const flood = chanD[k] > 0 && chanN[k] <= FLOOD_CELLS * elev.res && hand.data[k] <= 1 + 2 * chanD[k] && slope < 0.04 && !(water.data[k] & (WATER.river | WATER.lake));
    if (flood) water.data[k] |= WATER.floodplain;
    const soggy = slope < 0.025 && !(water.data[k] & WATER.lake) && (hand.data[k] < 1.2 * (0.5 + wet) * (p / 600) || (wet >= 0.5 && hand.data[k] < 3 * wet));
    if (soggy && p > 500) water.data[k] |= WATER.wetland;
    table.data[k] = water.data[k] & (WATER.wetland | WATER.lake | WATER.river) ? 0 : clamp(hand.data[k] * (p < DRY_MM ? 1 : 0.55), 0, 80);
  }
  return { elev: carved, water, lakeId, lakes, rivers, falls, springs, discharge, hand, table, surface: S };
}

/** The cell a world point falls in, -1 outside. @param {Field} f */
function cellIndex(f, x, y) {
  if (!f.covers(x, y)) return -1;
  const [i, j] = f.cellOf(x, y);
  return j * f.w + i;
}
const cx = (f, a, b) => f.x0 + ((a % f.w) + (b % f.w) + 1) / (2 * f.res);
const cy = (f, a, b) => f.y0 + (((a / f.w) | 0) + ((b / f.w) | 0) + 1) / (2 * f.res);
function slopeAtCell(f, k, cellM) {
  const i = k % f.w, j = (k / f.w) | 0;
  const gx = (f.get(i + 1, j) - f.get(i - 1, j)) / (2 * cellM), gy = (f.get(i, j + 1) - f.get(i, j - 1)) / (2 * cellM);
  return Math.sqrt(gx * gx + gy * gy);
}

/**
 * The rivers as courses: from each source (a river cell no river cell drains into) down to where it ends - another
 * river (a junction), a lake, the region's edge or the sand. Each point: world pixel x, y, discharge q, width, depth
 * and surface s (metres); a course's surface never rises. Chaikin-smoothed twice, its ends kept.
 */
function traceRivers(elev, rt, Q, S, order, isRiver, lakeId) {
  const { w } = elev, n = w * elev.h, fed = new Uint8Array(n), taken = new Int32Array(n).fill(-1), rivers = [];
  for (let k = 0; k < n; k++) { const r = rt.rcv[k]; if (r >= 0 && isRiver(k) && isRiver(r)) fed[r] = 1; }
  // sources in drainage order from upstream, so a longer stem is traced before the tributaries that join it
  for (let o2 = n - 1; o2 >= 0; o2--) {
    const src = rt.order[o2];
    if (!isRiver(src) || fed[src]) continue;
    const cells = [];
    let k = src, into = 'edge';
    for (;;) {
      if (taken[k] >= 0) { into = `river:${taken[k]}`; cells.push(k); break; }
      cells.push(k);
      taken[k] = rivers.length + 1;
      const r = rt.rcv[k];
      if (r < 0) { into = 'edge'; break; }
      if (lakeId.data[r]) { into = `lake:${lakeId.data[r]}`; cells.push(r); break; }
      if (!isRiver(r)) { into = 'sink'; break; }
      k = r;
    }
    const raw = cells.map((c) => ({ x: elev.x0 + ((c % w) + 0.5) / elev.res, y: elev.y0 + (((c / w) | 0) + 0.5) / elev.res, q: Q[c], s: S[c] < Infinity ? S[c] : elev.data[c] }));
    for (let i = 1; i < raw.length; i++) raw[i].s = Math.min(raw[i].s, raw[i - 1].s);
    rivers.push({ id: rivers.length + 1, order: order[cells[cells.length - 1]] || 1, into, raw, pts: riverCourse(raw), length: cells.length });
  }
  return rivers;
}
