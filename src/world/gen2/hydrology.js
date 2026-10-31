// WG2 HYDROLOGY (bible/03-World/World-2-Canon.md, "Water"): rivers, lakes, falls, wetlands and the water table from
// the worked land and the climate. Rain less what the warmth takes runs down the drainage; a closed hollow fills to
// where its evaporation meets its inflow - brimful and spilling in a wet land, a terminal lake or a salt flat in a
// dry one. A river's surface never rises downstream (each cell's is at most every donor's), and its bed sits under it.
import { Field, D8X, D8Y } from './field.js';
import { routeFlow, hollowsOf } from './drainage.js';
import { clampExact } from './exact.js';
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
export const WATER_KIND = Object.freeze({ river: 1, lake: 2, wetland: 4, floodplain: 8, spring: 16, playa: 32, fall: 64 });

/** Evaporation from open water and the land's own (potential), metres a year, from the mean air. @param {number} t */
export const evaporation = (t) => clampExact(0.35 + 0.075 * t, 0.2, 2.6);
/** The rain that runs off, metres a year, for rain `p` and the warmth's evaporation `e` (both metres a year): p^3 / (p^2 +
 *  e^2) - a dry land sheds a few hundredths of its storms, a wet one most of its rain (Budyko's shape, exact). */
export const runoff = (p, e) => (p * p * p) / (p * p + e * e);

/**
 * @param {import('./geology.js').RegionSpec} spec @param {Field} elev worked land, metres @param {ReturnType<import('./climate.js').climate>} air
 * @param {number} cellM @param {{ isSea?: (k: number) => boolean, inflow?: Float64Array, wet?: Field, forced?: Uint8Array }} [o]
 *   inflow: m3/s entering each cell from upstream past the region; wet: the province's share of flat land that holds water;
 *   forced: cells a designer drew a river through (a river whatever it carries)
 */
export function hydrology(spec, elev, air, cellM, o = {}) {
  const { w, h: H } = elev, n = w * H, area = cellM * cellM, isSea = o.isSea ?? (() => false);
  const rt = routeFlow(elev, cellM, isSea);
  // the water each cell gives: the rain that runs off, springs, and what flows in past the region's edge
  const own = new Float64Array(n);
  for (let k = 0; k < n; k++) own[k] = (runoff(air.precip.data[k] / 1000, evaporation(air.temp.data[k])) * area) / YEAR_S + (o.inflow?.[k] ?? 0);
  const springs = [];
  for (const s of spec.springs ?? []) {
    const k = cellIndex(elev, s.x, s.y);
    if (k >= 0) { own[k] += s.flow; springs.push({ ...s, cell: k }); }
  }
  // the hollows that hold water: deeper than LAKE_DEPTH and wider than the ground's roughness; inside one the water runs
  // down the real ground to its floor and the lake is one node of the network (basinNet), so no river crosses the flood's
  // flat in a straight line
  const hollows = hollowsOf(rt, elev).filter((hw) => hw.deep > LAKE_DEPTH && hw.cells.length >= HOLLOW_CELLS);
  const net = basinNet(rt, elev, hollows, cellM), m = net.rcv.length, up = net.up;
  // the water down the network, upstream first: a dry land's rivers lose water; a hollow's balance is struck at its node
  const Q = new Float64Array(m), lakeId = new Field(w, H, elev.frame, Uint16Array), lakes = [], lakeOf = new Int32Array(hollows.length);
  Q.set(own);
  for (const k of up) {
    const r = net.rcv[k];
    if (k >= n) {
      const hw = hollows[k - n], evap = evaporation(air.temp.data[hw.outlet]);
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
      lakeOf[k - n] = lake.id;
    }
    if (r < 0) continue;
    const p = k < n ? air.precip.data[k] : DRY_MM, dry = p < DRY_MM ? DRY_LOSS * (net.dist[k] / 1000) * (1 - p / DRY_MM) : 0;
    Q[r] += Q[k] * (1 - dry);
  }
  // the rivers' cells, and each one's surface: at most every river cell that drains to it, at most its own ground
  const water = new Field(w, H, elev.frame, Uint8Array), S = new Float64Array(m).fill(Infinity), order = new Uint8Array(m);
  const cellsKm2 = area / 1e6, drained = new Float64Array(m).fill(cellsKm2);
  for (const k of up) { const r = net.rcv[k]; if (r >= 0) drained[r] += drained[k]; }
  const forced = o.forced ?? null;
  const isRiver = (k) => k < n && !lakeId.data[k] && ((Q[k] >= RIVER_Q && drained[k] >= RIVER_KM2) || (!!forced && forced[k] === 1 && Q[k] > 0));
  for (const k of up) {
    if (k >= n) continue;
    if (lakeId.data[k]) water.data[k] |= lakes[lakeId.data[k] - 1].kind === 'playa' ? WATER_KIND.playa : WATER_KIND.lake;
    if (!isRiver(k)) continue;
    water.data[k] |= WATER_KIND.river;
    S[k] = Math.min(S[k], elev.data[k]);
    if (!order[k]) order[k] = 1;
    const r = net.rcv[k];
    if (r >= 0 && r < n) {
      S[r] = Math.min(S[r], S[k]);
      order[r] = order[r] === order[k] ? order[k] + 1 : Math.max(order[r], order[k]);
    }
  }
  for (const s of springs) water.data[s.cell] |= WATER_KIND.spring;
  const rivers = traceRivers(elev, net, Q, S, order, isRiver, lakeId, lakeOf);
  const falls = [];
  for (let k = 0; k < n; k++) {
    const r = net.rcv[k];
    if (!(water.data[k] & WATER_KIND.river) || r < 0 || r >= n || !(S[r] < Infinity)) continue;
    const drop = S[k] - S[r], slope = drop / net.dist[k];
    if (drop >= FALL_DROP && slope >= FALL_SLOPE) { water.data[k] |= WATER_KIND.fall; falls.push({ x: cx(elev, k, r), y: cy(elev, k, r), drop, q: Q[k], kind: 'fall' }); }
    else if (drop >= RAPIDS_DROP && slope >= FALL_SLOPE * 0.3) falls.push({ x: cx(elev, k, r), y: cy(elev, k, r), drop, q: Q[k], kind: 'rapids' });
  }
  // the valley floor under a river stands at its water (the channel itself is carved by the vector river, WG-6)
  const carved = elev.clone();
  for (let k = 0; k < n; k++) if (water.data[k] & WATER_KIND.river) carved.data[k] = Math.min(carved.data[k], S[k] + 0.5);
  // height above the nearest water down the network, and that water's depth (for the flood plain), downstream first
  const hand = elev.like(), chanH = new Float64Array(m), chanD = new Float64Array(m), chanN = new Int32Array(m);
  for (let o2 = up.length - 1; o2 >= 0; o2--) {
    const k = up[o2], r = net.rcv[k], lk = k < n ? lakeId.data[k] : 0;
    if (k >= n) { chanH[k] = lakes[lakeOf[k - n] - 1].level; chanD[k] = 0; chanN[k] = 0; continue; }
    if (water.data[k] & WATER_KIND.river) { chanH[k] = S[k]; chanD[k] = riverDepth(Q[k]); chanN[k] = 0; }
    else if (lk) { chanH[k] = lakes[lk - 1].level; chanD[k] = 0; chanN[k] = 0; }
    else if (r >= 0) { chanH[k] = chanH[r]; chanD[k] = chanD[r]; chanN[k] = chanN[r] + 1; }
    else { chanH[k] = carved.data[k]; chanD[k] = 0; chanN[k] = 0; }
    hand.data[k] = Math.max(0, carved.data[k] - chanH[k]);
  }
  const table = elev.like(), discharge = elev.like();
  for (let k = 0; k < n; k++) {
    discharge.data[k] = Q[k];
    const p = air.precip.data[k], slope = slopeAtCell(carved, k, cellM), wet = o.wet?.data[k] ?? 0.2;
    const flood = chanD[k] > 0 && chanN[k] <= FLOOD_CELLS * elev.res && hand.data[k] <= 1 + 2 * chanD[k] && slope < 0.04 && !(water.data[k] & (WATER_KIND.river | WATER_KIND.lake));
    if (flood) water.data[k] |= WATER_KIND.floodplain;
    const soggy = slope < 0.025 && !(water.data[k] & WATER_KIND.lake) && (hand.data[k] < 1.2 * (0.5 + wet) * (p / 600) || (wet >= 0.5 && hand.data[k] < 3 * wet));
    if (soggy && p > 500) water.data[k] |= WATER_KIND.wetland;
    table.data[k] = water.data[k] & (WATER_KIND.wetland | WATER_KIND.lake | WATER_KIND.river) ? 0 : clampExact(hand.data[k] * (p < DRY_MM ? 1 : 0.55), 0, 80);
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
function traceRivers(elev, net, Q, S, order, isRiver, lakeId, lakeOf) {
  const { w } = elev, n = w * elev.h, fed = new Uint8Array(n), taken = new Int32Array(n).fill(-1), rivers = [];
  for (let k = 0; k < n; k++) { const r = net.rcv[k]; if (r >= 0 && r < n && isRiver(k) && isRiver(r)) fed[r] = 1; }
  // sources upstream first, so a longer stem is traced before the tributaries that join it
  for (const src of net.up) {
    if (!isRiver(src) || fed[src]) continue;
    const cells = [];
    let k = src, into = 'edge';
    for (;;) {
      if (taken[k] >= 0) { into = `river:${taken[k]}`; cells.push(k); break; }
      cells.push(k);
      taken[k] = rivers.length + 1;
      const r = net.rcv[k];
      if (r < 0) { into = 'edge'; break; }
      if (r >= n) { into = `lake:${lakeOf[r - n]}`; break; }
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

/**
 * THE BASIN NETWORK: the flood's receivers, but inside each hollow that holds water the real ground's steepest lower
 * neighbour in the same hollow, a hollow's floor cells draining to its lake node (index n + i), and the node to the
 * spill's receiver. Strictly downhill inside, the flood's order outside: no cycle. `up` is every node upstream first
 * (Kahn's order, ties by index), `dist` the metres to each receiver (0 into a lake node).
 * @param {{ rcv: Int32Array, dist: Float64Array }} rt @param {Field} elev @param {{ cells: number[], outlet: number }[]} hollows @param {number} cellM
 */
export function basinNet(rt, elev, hollows, cellM) {
  const { w, h: H } = elev, n = w * H, m = n + hollows.length, rcv = new Int32Array(m), dist = new Float64Array(m), home = new Int32Array(n).fill(-1);
  rcv.set(rt.rcv); dist.set(rt.dist);
  hollows.forEach((hw, i) => { for (const c of hw.cells) home[c] = i; });
  hollows.forEach((hw, i) => {
    for (const c of hw.cells) {
      const ci = c % w, cj = (c / w) | 0;
      let best = 0, r = n + i, rd = 0;
      for (let d = 0; d < 8; d++) {
        const a = ci + D8X[d], b = cj + D8Y[d];
        if (a < 0 || b < 0 || a >= w || b >= H) continue;
        const nk = b * w + a, l = (d & 1 ? Math.SQRT2 : 1) * cellM, s = (elev.data[c] - elev.data[nk]) / l;
        if (home[nk] === i && s > best) { best = s; r = nk; rd = l; }
      }
      rcv[c] = r; dist[c] = rd;
    }
    rcv[n + i] = rt.rcv[hw.outlet]; dist[n + i] = rt.dist[hw.outlet];
  });
  const indeg = new Int32Array(m), up = new Int32Array(m);
  for (let k = 0; k < m; k++) if (rcv[k] >= 0) indeg[rcv[k]]++;
  let head = 0, tail = 0;
  for (let k = 0; k < m; k++) if (!indeg[k]) up[tail++] = k;
  while (head < tail) { const k = up[head++], r = rcv[k]; if (r >= 0 && --indeg[r] === 0) up[tail++] = r; }
  if (tail !== m) throw new Error(`wg2: the basin network has a cycle (${m - tail} nodes)`);
  return { rcv, dist, up, n };
}
