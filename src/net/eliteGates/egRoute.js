// @ts-check
// THE ASCENT (LAW 9, 2026-10-16, Mac: "Something that isnt just a straight line from point A to point B";
// bible/11-Multiplayer/Elite-Gates-Ascent.md section 1): THE ROUTE - the law's one measure of progress through a hall.
//
//   The arc measured a company's progress through a hall by z: every hall ran along +z from its arrival plate to its door,
//   so the toll's road still ahead, THE FAIR TRAIL's furthest point (`far`) and its cast-back's "back", the Divers' next
//   island, the Captive's chains along the course, the Low Road's pick by x past the fork and `egInHall` (a strip about
//   the line, 0 to the hall's length) were each a reading of z. LAW 9's halls turn, double back, climb and cross over
//   themselves, so z says nothing there: the spec carries THE ROUTE (`spec.route` - its ways as a graph in the hall's frame,
//   metres: `nodes` [x, y, z], `links` { a, b, kind, road, len }, `main` the node path from the arrival plate to the door),
//   and every reader of progress reads it here.
//
//   THE MEASURE. A point's progress on a road is the progress of the route's NEAREST POINT to it - every link of every
//   road, BY HEIGHT TOO: a metre of height weighs EG_ROUTE_Y_WEIGHT metres of plan (a metre under a way EG_ROUTE_UNDER_X
//   times that), so a body on a bridge crossing 6 m over the way it came along reads the bridge, never the floor under it,
//   a body leaping on that floor reads its floor, and a body on a broad floor under a gallery reads its floor (with no
//   height said, plan alone). On the road's own path (road 0 `main`; road 1 the main with THE FORK's other way taken
//   wherever the route lays one) it is the walked length (`len`) from the arrival plate; a link off the path (the other
//   road's way, a side way) reads the path's progress between the places it leaves and rejoins it, in proportion to the
//   walk, and a side way that ends reads the place it leaves from. Before the arrival plate and past the door the road's
//   first and last links run on (a point behind the plate reads less than nothing, as its z did).
//   LAWS 4-8 have no `spec.route`: theirs is THE COURSE'S LINE - one link from the hall's origin along +z, open at both
//   ends - and its measure IS z, by the same arithmetic (the unit way (0, 0, 1): x and y weigh nothing, z once), so every
//   number a law 4-8 hall made stays the number it was; their road pick stays THE FORK's (past the fork's z, on the Low
//   Road's side of the midpoint in x) and their bound the strip of 120 m about the line from 0 to the hall's length.
//
// Pure (a spec in, numbers out; each route compiled once and kept by its own object, every reader answering without a new
// array - the relay reads it on every pose). In the relay's bundle (net/eliteGates/egLaw.js, net/eliteGates/egFair.js, net/eliteGates/egBrain.js,
// net/eliteGates/egLegion.js), the client's and the swap's worker's (world/eliteGates/egRuin.js - a Brink's thirds). Not a DFU member. Ledger A
// (ELITE-GATES).

/** A link's kinds (section 1): flat ground, a stair or a ramp, a climb pitch, a Drop (one way, a to b), a span's course, a
 *  bridge. */
export const EG_ROUTE_KINDS = Object.freeze(['walk', 'stair', 'climb', 'drop', 'span', 'bridge']);
/** The roads: 0 the main way, 1 THE FORK's other proven way, 2 a side way (never proven, never required). */
export const EG_ROUTE_ROADS = Object.freeze({ main: 0, fork: 1, side: 2 });
/** A metre of height weighs this many of plan in the nearest point (floors stacked stand at least 4 m apart - section 2 -
 *  so a floor under another is 16 m off it to the measure, past the half-width of any floor the law lays). */
export const EG_ROUTE_Y_WEIGHT = 4;
/** ...and a metre UNDER a way this many times that: a body stands on a floor or leaps over it, never under its top (the
 *  walk graph's band - 0.5 m under, 3.0 m over), so between floors 6 m apart it reads the lower to 4 m over it, past any
 *  leap's height. */
export const EG_ROUTE_UNDER_X = 2;
/** LAW 9's hall bound (section 7, metres about its origin): x within +-`x`, z from `z0` to `z1` (EG_HALL_LEN_MAX - pinned
 *  equal; the wire's GATE_COURT_BOUND, 160, about it). */
export const EG_ROUTE_BOUND = Object.freeze({ x: 150, z0: -10, z1: 158 });
/** Laws 4-8's strip about the course's line (m): a member is in a hall within it, 0 to the hall's length, `pad` about. */
export const EG_LINE_HALF_X = 120;
/** A link off the road being measured weighs this many times its length when its path is found (THE FORK's way is taken
 *  wherever one is laid). */
const OFF_ROAD_X = 1000;

// ── THE ROUTE, COMPILED ───────────────────────────────────────────────────────────────────────────────────────
/**
 * @typedef {{ route: any, n: number, ok: Uint8Array, road: Uint8Array, open: Uint8Array,
 *   ax: Float64Array, ay: Float64Array, az: Float64Array, ux: Float64Array, uy: Float64Array, uz: Float64Array, g: Float64Array,
 *   pux: Float64Array, puz: Float64Array, gp: Float64Array, dirX: Float64Array, dirZ: Float64Array,
 *   m: Float64Array[], k: Float64Array[], kp: Float64Array[], cum: Float64Array[], paths: number[][], ways: number[][] }} Compiled
 */
/** @type {WeakMap<object, Compiled>} */
const _byRoute = new WeakMap();
/** @type {WeakMap<object, Compiled>} */
const _byLine = new WeakMap();
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

/** THE COURSE'S LINE of a law 4-8 hall: its origin along +z (its length the hall's, 1 m where none is said). */
function lineOf(spec) {
  const L = fin(spec?.len) && spec.len > 0 ? spec.len : 1;
  return { nodes: [[0, 0, 0], [0, 0, L]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: L }], main: [0, 1] };
}
const pt = (R, i) => R.nodes[i];
const geoLen = (A, B) => Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
/** A link's walked length: its own `len`, else its length in space. */
const walked = (R, l) => (fin(l.len) && l.len >= 0 ? l.len : geoLen(pt(R, l.a), pt(R, l.b)));
/** Is `R` a route this module can read (its nodes points, its links joining two of them, its main path two at least)? */
function readable(R) {
  if (!R || typeof R !== 'object' || !Array.isArray(R.nodes) || !Array.isArray(R.links) || !Array.isArray(R.main) || R.nodes.length < 2 || !R.links.length || R.main.length < 2) return false;
  if (!R.nodes.every((p) => Array.isArray(p) && p.length >= 3 && fin(p[0]) && fin(p[1]) && fin(p[2]))) return false;
  const N = R.nodes.length, ix = (i) => Number.isInteger(i) && i >= 0 && i < N;
  return R.links.every((l) => l && ix(l.a) && ix(l.b)) && R.main.every(ix);
}

/** The cheapest way from `src` to `dst` over the links `use` allows (`cost` each; a Drop a to b only) - the nodes and the
 *  links taken, or null. A route is tens of nodes: the plain O(N^2) search. */
function cheapest(R, src, dst, use, cost) {
  const N = R.nodes.length, d = new Float64Array(N).fill(Infinity), via = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  d[src] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || u === dst) break;
    done[u] = 1;
    R.links.forEach((l, j) => {
      if (!use(l)) return;
      const v = l.a === u ? l.b : l.b === u && l.kind !== 'drop' ? l.a : -1;
      if (v < 0 || done[v]) return;
      const nd = d[u] + cost(l);
      if (nd < d[v]) { d[v] = nd; via[v] = j; }
    });
  }
  if (!(d[dst] < Infinity)) return null;
  const nodes = [dst], links = [];
  for (let v = dst; v !== src;) { const j = via[v], l = R.links[j]; links.unshift(j); v = l.a === v ? l.b : l.a; nodes.unshift(v); }
  return { nodes, links };
}
/** Road `r`'s path from the arrival plate to the door: road 0 the spec's `main` (each step the cheapest main-way link
 *  between its two nodes), road 1 the main with THE FORK's other way taken wherever one is laid - or null. */
function pathOf(R, r) {
  const src = R.main[0], dst = R.main[R.main.length - 1];
  if (r === 0) {
    const links = [];
    for (let i = 1; i < R.main.length; i++) {
      const u = R.main[i - 1], v = R.main[i];
      let best = -1, bk = Infinity;
      R.links.forEach((l, j) => {
        if (!((l.a === u && l.b === v) || (l.b === u && l.a === v && l.kind !== 'drop'))) return;
        const k = ((l.road ?? 0) === 0 ? 0 : 1e9) + walked(R, l);   // the main way's own link first, then the shortest
        if (k < bk) { best = j; bk = k; }
      });
      if (best < 0) return cheapest(R, src, dst, (l) => (l.road ?? 0) !== 2, (l) => walked(R, l) * ((l.road ?? 0) === 0 ? 1 : OFF_ROAD_X));
      links.push(best);
    }
    return { nodes: [...R.main], links };
  }
  return cheapest(R, src, dst, (l) => (l.road ?? 0) === 0 || (l.road ?? 0) === r, (l) => walked(R, l) * ((l.road ?? 0) === r ? 1 : OFF_ROAD_X));
}
/**
 * Each node's progress on a road whose path is `P` (`cum` its walked length at each of its nodes): its own on the path; off
 * it, between the least and the most of the path's places its off-path ways reach, in proportion to the walk to each (a
 * side way that comes back), or the one it leaves from (a side way that ends); NaN for a node no way joins to the path.
 */
function progressOf(R, P, cum) {
  const N = R.nodes.length, out = new Float64Array(N).fill(NaN), onPath = new Uint8Array(R.links.length), place = new Uint8Array(N);
  for (const j of P.links) onPath[j] = 1;
  P.nodes.forEach((n, i) => { if (!place[n]) { place[n] = 1; out[n] = cum[i]; } });
  for (let n = 0; n < N; n++) {
    if (!Number.isNaN(out[n])) continue;
    // the walk from `n` over the off-path links (either way), stopping at the path's places
    const d = new Float64Array(N).fill(Infinity), done = new Uint8Array(N);
    d[n] = 0;
    let lo = -1, hi = -1;
    for (;;) {
      let u = -1;
      for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0) break;
      done[u] = 1;
      if (place[u]) {
        if (lo < 0 || out[u] < out[lo]) lo = u;
        if (hi < 0 || out[u] > out[hi]) hi = u;
        continue;
      }
      R.links.forEach((l, j) => {
        if (onPath[j]) return;
        const v = l.a === u ? l.b : l.b === u ? l.a : -1;
        if (v < 0 || done[v]) return;
        const nd = d[u] + walked(R, l);
        if (nd < d[v]) d[v] = nd;
      });
    }
    if (lo < 0) continue;
    const wl = d[lo], wh = d[hi];
    out[n] = lo === hi || out[lo] === out[hi] || !(wl + wh > 0) ? out[lo] : out[lo] + ((out[hi] - out[lo]) * wl) / (wl + wh);
  }
  return out;
}
/** THE ROUTE COMPILED for the measure: each link's foot and unit way in the measure's space (height times
 *  EG_ROUTE_Y_WEIGHT) and in plan, its progress at either end on roads 0 and 1, its way of travel in plan. */
function compile(R, line) {
  const n = R.links.length, f = () => new Float64Array(n);
  const C = /** @type {Compiled} */ ({ route: null, n, ok: new Uint8Array(n), road: new Uint8Array(n), open: new Uint8Array(n),
    ax: f(), ay: f(), az: f(), ux: f(), uy: f(), uz: f(), g: f(), pux: f(), puz: f(), gp: f(), dirX: f(), dirZ: f(),
    m: [], k: [], kp: [], cum: [], paths: [], ways: [] });
  const W = EG_ROUTE_Y_WEIGHT, src = R.main[0], dst = R.main[R.main.length - 1];
  R.links.forEach((l, i) => {
    const A = pt(R, l.a), B = pt(R, l.b), dx = B[0] - A[0], dy = (B[1] - A[1]) * W, dz = B[2] - A[2];
    const g = Math.sqrt(dx * dx + dy * dy + dz * dz), gp = Math.sqrt(dx * dx + dz * dz);
    C.ax[i] = A[0]; C.ay[i] = A[1] * W; C.az[i] = A[2];
    if (g > 0) { C.ux[i] = dx / g; C.uy[i] = dy / g; C.uz[i] = dz / g; }
    if (gp > 0) { C.pux[i] = dx / gp; C.puz[i] = dz / gp; }
    C.g[i] = g; C.gp[i] = gp;
    C.road[i] = Math.max(0, Math.min(2, (l.road ?? 0) | 0));
    C.open[i] = (l.a === src || l.a === dst ? 1 : 0) | (l.b === src || l.b === dst ? 2 : 0);
  });
  for (const r of [0, 1]) {
    const P = pathOf(R, r) ?? pathOf(R, 0) ?? { nodes: [src, dst], links: [] };
    const cum = new Float64Array(P.nodes.length);
    P.links.forEach((j, i) => { cum[i + 1] = cum[i] + walked(R, R.links[j]); });
    const at = progressOf(R, P, cum), m = new Float64Array(2 * n), k = f(), kp = f();
    R.links.forEach((l, i) => {
      m[2 * i] = at[l.a]; m[2 * i + 1] = at[l.b];
      const dm = at[l.b] - at[l.a];
      k[i] = C.g[i] > 0 ? dm / C.g[i] : 0; kp[i] = C.gp[i] > 0 ? dm / C.gp[i] : 0;
    });
    C.m.push(m); C.k.push(k); C.kp.push(kp); C.cum.push(cum); C.paths.push(P.nodes); C.ways.push(P.links);
  }
  // a link is the route's while both its ends are joined to the main way; its way of travel is toward the door on road 0
  const m0 = C.m[0];
  for (let i = 0; i < n; i++) {
    C.ok[i] = Number.isNaN(m0[2 * i]) || Number.isNaN(m0[2 * i + 1]) ? 0 : 1;
    if (C.gp[i] > 1e-6) { const s = m0[2 * i + 1] < m0[2 * i] ? -1 : 1; C.dirX[i] = s * C.pux[i]; C.dirZ[i] = s * C.puz[i]; }
  }
  // a link with no way in plan (a climb's face) travels as the next link on from its far end does (else the one before it)
  for (let i = 0; i < n; i++) {
    if (C.gp[i] > 1e-6) continue;
    const l = R.links[i], up = m0[2 * i + 1] >= m0[2 * i] ? l.b : l.a, down = up === l.b ? l.a : l.b;
    const from = (node) => R.links.findIndex((q, j) => j !== i && C.gp[j] > 1e-6 && (q.a === node || q.b === node));
    const j = from(up) >= 0 ? from(up) : from(down);
    if (j >= 0) { C.dirX[i] = C.dirX[j]; C.dirZ[i] = C.dirZ[j]; } else C.dirZ[i] = 1;
  }
  const fz = (a) => Object.freeze([...a]);
  C.route = Object.freeze({ nodes: R.nodes, links: R.links, main: R.main, paths: Object.freeze(C.paths.map(fz)), ways: Object.freeze(C.ways.map(fz)),
    len: Object.freeze([C.cum[0][C.cum[0].length - 1], C.cum[1][C.cum[1].length - 1]]), line: line ? 1 : 0 });
  return C;
}
/** THE COURSE'S LINE shared by every spec this module is handed without one (a null, a fixture with no fields). */
let _bare = /** @type {Compiled|null} */ (null);
/** The compiled route of hall `spec`: LAW 9's (`spec.route`, kept by the route's own object) or the course's line (kept by
 *  the spec's). */
function compiled(spec) {
  const R = spec && typeof spec === 'object' ? spec.route : null;
  if (R && typeof R === 'object') {
    let C = _byRoute.get(R);
    if (!C && readable(R)) { C = compile(R, false); _byRoute.set(R, C); }
    if (C) return C;
  }
  if (!spec || typeof spec !== 'object') return (_bare ??= compile(lineOf(null), true));
  let C = _byLine.get(spec);
  if (!C) { C = compile(lineOf(spec), true); _byLine.set(spec, C); }
  return C;
}

// ── THE NEAREST POINT ────────────────────────────────────────────────────────────────────────────────────────
// the answer of the last search, read before the next (no reader holds it across a call)
let _i = -1, _s = 0, _d2 = Infinity, _plan = false;
/** The route's nearest link to (x, y, z) - `y` not finite: plan alone - and the point's reach along it (unclamped, metres of
 *  the measure's space); a tie goes to the lower road. */
function nearest(C, x, y, z) {
  const plan = !fin(y), Y = plan ? 0 : y * EG_ROUTE_Y_WEIGHT;
  let best = -1, bd = Infinity, bs = 0;
  for (let i = 0; i < C.n; i++) {
    if (!C.ok[i]) continue;
    const ax = C.ax[i], az = C.az[i];
    let s, d2;
    if (plan) {
      const G = C.gp[i], ux = C.pux[i], uz = C.puz[i];
      s = (x - ax) * ux + (z - az) * uz;
      const sc = s < 0 ? 0 : s > G ? G : s, ex = x - (ax + ux * sc), ez = z - (az + uz * sc);
      d2 = ex * ex + ez * ez;
    } else {
      const G = C.g[i], ay = C.ay[i], ux = C.ux[i], uy = C.uy[i], uz = C.uz[i];
      s = (x - ax) * ux + (Y - ay) * uy + (z - az) * uz;
      const sc = s < 0 ? 0 : s > G ? G : s, ex = x - (ax + ux * sc), ez = z - (az + uz * sc);
      let ey = Y - (ay + uy * sc);
      if (ey < 0) ey *= EG_ROUTE_UNDER_X;
      d2 = ex * ex + ey * ey + ez * ez;
    }
    if (best < 0 || d2 < bd || (d2 === bd && C.road[i] < C.road[best])) { best = i; bd = d2; bs = s; }
  }
  _i = best; _s = bs; _d2 = bd; _plan = plan;
}
/** The progress on road `r` of the last search's point (its road's first and last links run on past their ends). */
function alongLast(C, r) {
  const i = _i, R = r === 1 ? 1 : 0;
  if (i < 0) return NaN;
  const G = _plan ? C.gp[i] : C.g[i], o = C.open[i];
  const s = _s < 0 && !(o & 1) ? 0 : _s > G && !(o & 2) ? G : _s;
  return C.m[R][2 * i] + s * (_plan ? C.kp[R][i] : C.k[R][i]);
}
const xOf = (p) => (Array.isArray(p) ? p[0] : p?.x), yOf = (p) => (Array.isArray(p) ? p[1] : p?.y), zOf = (p) => (Array.isArray(p) ? p[2] : p?.z);

// ── THE READERS ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE ROUTE of hall `spec` (frozen, kept): `{ nodes, links, main, paths, ways, len, line }` - LAW 9's own (`spec.route`), or
 * for a law 4-8 hall THE COURSE'S LINE (`line` 1: its origin to its length along +z, open at both ends). `paths` road 0's
 * and road 1's node paths from the arrival plate to the door (road 1 the main where the hall lays no other way), `ways` the
 * links each takes, in order, `len` their walked lengths (m).
 * @param {any} spec
 */
export const egRouteOf = (spec) => compiled(spec).route;
/**
 * A POINT'S PROGRESS along road `road` of hall `spec` (m from the arrival plate, the hall's own frame): the progress of the
 * route's nearest point to it, by height too (EG_ROUTE_Y_WEIGHT; `y` not finite - plan alone). Laws 4-8: exactly its z.
 * The no-array form of egRouteAlong. Pure.
 * @param {any} spec @param {number} x @param {number|undefined} y @param {number} z @param {number} [road]
 */
export function egRouteAlongAt(spec, x, y, z, road = 0) {
  const C = compiled(spec);
  nearest(C, x, y, z);
  return alongLast(C, road);
}
/**
 * A POINT'S PROGRESS along road `road` (0 the main way, 1 THE FORK's other; a side way's reads the main's) - `p` a point
 * `[x, y, z]` or anything that stands at `{ x, y, z }` (a pose, a disc, an island), the hall's own frame. Pure.
 * @param {any} spec @param {any} p @param {number} [road]
 */
export const egRouteAlong = (spec, p, road = 0) => egRouteAlongAt(spec, xOf(p), yOf(p), zOf(p), road);
/**
 * THE ROUTE'S NEAREST POINT to `p` (by height too): `{ i, road, kind, x, y, z, d, along }` - the link's number, its road and
 * kind, the point on it (m, the hall's frame), the distance to it in the measure's space and the main way's progress there.
 * Written into `out` when given. Pure.
 * @param {any} spec @param {any} p @param {any} [out]
 */
export function egRouteNear(spec, p, out = {}) {
  const C = compiled(spec);
  nearest(C, xOf(p), yOf(p), zOf(p));
  const i = _i, along = alongLast(C, 0);
  if (i < 0) return Object.assign(out, { i: -1, road: 0, kind: '', x: NaN, y: NaN, z: NaN, d: NaN, along: NaN });
  const l = C.route.links[i], G = _plan ? C.gp[i] : C.g[i], sc = _s < 0 ? 0 : _s > G ? G : _s, t = G > 0 ? sc / G : 0;
  const A = C.route.nodes[l.a], B = C.route.nodes[l.b];
  out.i = i; out.road = C.road[i]; out.kind = l.kind ?? 'walk';
  out.x = A[0] + (B[0] - A[0]) * t; out.y = A[1] + (B[1] - A[1]) * t; out.z = A[2] + (B[2] - A[2]) * t;
  out.d = Math.sqrt(_d2); out.along = along;
  return out;
}
/**
 * THE ROAD A BODY IS ON at `p` (0 the main way, 1 THE FORK's other, 2 a side way): LAW 9 - the road of the route's nearest
 * link, by height too; laws 4-8 - THE FORK's pick: 1 past the fork's z on the Low Road's side of the midpoint in x, else 0.
 * Pure.
 * @param {any} spec @param {any} p
 */
export const egRouteRoad = (spec, p) => egRouteRoadAt(spec, xOf(p), yOf(p), zOf(p));
/** egRouteRoad's no-array form. @param {any} spec @param {number} x @param {number|undefined} y @param {number} z */
export function egRouteRoadAt(spec, x, y, z) {
  const C = compiled(spec);
  if (C.route.line) { const F = spec?.fork; return F && z >= F.z && x >= (F.lowX + F.x) / 2 ? 1 : 0; }
  nearest(C, x, y, z);
  return _i < 0 ? 0 : C.road[_i];
}
/**
 * THE POINT `s` m ALONG road `road`'s path from the arrival plate (`[x, y, z]`, the hall's frame - written into `out`): on
 * the link that holds that progress, run on past the path's ends. Pure.
 * @param {any} spec @param {number} s @param {number} [road] @param {number[]} [out]
 */
export function egRouteAt(spec, s, road = 0, out = [0, 0, 0]) {
  const C = compiled(spec), r = road === 1 ? 1 : 0, P = C.paths[r], cum = C.cum[r], N = C.route.nodes;
  let i = 0;
  while (i < P.length - 2 && s > cum[i + 1]) i++;
  const A = N[P[i]], B = N[P[i + 1]], L = cum[i + 1] - cum[i], t = L > 0 ? (s - cum[i]) / L : 0;
  out[0] = A[0] + (B[0] - A[0]) * t; out[1] = A[1] + (B[1] - A[1]) * t; out[2] = A[2] + (B[2] - A[2]) * t;
  return out;
}
/** A road's walked length from the arrival plate to the door (m - laws 4-8: the hall's length). */
export const egRouteLen = (spec, road = 0) => compiled(spec).route.len[road === 1 ? 1 : 0];
/**
 * AHEAD OF A BODY at `p` along the route: `ahead` m along the way of travel of its nearest link (in plan, toward the door)
 * and `side` m across it (+x of a way along +z, -x of one back along -z) - `[x, z]` written into `out`. Laws 4-8: exactly
 * (x + side, z + ahead).
 * Pure.
 * @param {any} spec @param {any} p @param {number} ahead @param {number} side @param {number[]} [out]
 */
export function egRouteAhead(spec, p, ahead, side, out = [0, 0]) {
  const C = compiled(spec), x = xOf(p), z = zOf(p);
  nearest(C, x, yOf(p), z);
  const dx = _i < 0 ? 0 : C.dirX[_i], dz = _i < 0 ? 1 : C.dirZ[_i];
  out[0] = x + side * dz + ahead * dx;
  out[1] = z + side * -dx + ahead * dz;
  return out;
}
/**
 * IS THE SPIRE-FRAME POINT (sx, z) WITHIN HALL `spec`'s ground at all, `pad` m about - a member is in a hall when their
 * pose is (net/eliteGates/egLaw.js egInHall): LAW 9 its bound (EG_ROUTE_BOUND, section 7), laws 4-8 their strip (EG_LINE_HALF_X about
 * the line, 0 to the hall's length). Pure.
 * @param {any} spec @param {number} sx @param {number} z @param {number} [pad]
 */
export function egRouteInHall(spec, sx, z, pad = 40) {
  if (!compiled(spec).route.line) return Math.abs(sx - spec.x0) <= EG_ROUTE_BOUND.x + pad && z >= EG_ROUTE_BOUND.z0 - pad && z <= EG_ROUTE_BOUND.z1 + pad;
  return Math.abs(sx - spec.x0) <= EG_LINE_HALF_X + pad && z >= -pad && z <= spec.len + pad;
}
