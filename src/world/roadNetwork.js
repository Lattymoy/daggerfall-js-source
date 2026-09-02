// ROADS 1: THE NETWORK IS OURS.
//
// Mac, 2026-09-01: "recreate it using it as a resource and avoiding the
// legal stuff altogether... be as faithful as possible without crossing
// the line." The resource is Hazelnut's Basic Roads (MIT code; hand-
// authored path data of unstated license). THE LINE: its DESIGN is free
// to learn from and is credited here as prior art; its DATA - which
// pixels carry a road and where each leaves - is authored work and none
// of it enters this port. Every byte this module emits is derived from
// the player's own MAPS.BSA and WOODS.WLD at runtime.
//
// WHAT IS KEPT FROM THE DESIGN, because it is what makes roads work:
//   - one byte per map pixel on the 1000x500 world, an 8-direction
//     compass mask of the edges a path leaves through (N=128 clockwise
//     to NW=1). A rose is the natural encoding and this layout means
//     any tool speaking it reads ours; the LAYOUT is not the data.
//   - two grades: ROADS join the settlements that matter, TRACKS reach
//     the rest. The painter draws them differently.
//   - a path is a chain of neighbouring pixels; the mask on each end of
//     a step is the direction of the other, so junctions are free.
//
// WHAT IS OURS: the graph and the routes. Settlements come from the map
// table; the graph is nearest-neighbour edges plus a spanning tree so
// every road-grade town is reachable; each edge is routed across the
// pixel grid by A* over the small heightmap, refusing water and paying
// for climb, so roads follow valleys the way a road-builder would. It
// will be straighter and worse-judged than a hand-drawn network at
// first. That is iteration on our own thing, and the cost function is
// the dial.
//
// PURE. No archive access here: the caller hands in the settlements and
// two samplers, which is what makes this pinnable on a synthetic map in
// a container with no game data.

import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';

// The world's size comes from the one place that owns it.
export { MAP_WIDTH as MAP_W, MAP_HEIGHT as MAP_H };

/** The compass mask. Map Y runs SOUTH (mapsFile: y = 499 - lat/128), so
 *  N is (x, y-1). Kept as one table with its deltas so the encoder and
 *  the painter cannot disagree about which bit is which. */
export const DIR = Object.freeze({
  N: 128, NE: 64, E: 32, SE: 16, S: 8, SW: 4, W: 2, NW: 1,
});
export const DIR_DELTA = Object.freeze([
  [DIR.N, 0, -1], [DIR.NE, 1, -1], [DIR.E, 1, 0], [DIR.SE, 1, 1],
  [DIR.S, 0, 1], [DIR.SW, -1, 1], [DIR.W, -1, 0], [DIR.NW, -1, -1],
]);
const OPPOSITE = Object.freeze({
  [DIR.N]: DIR.S, [DIR.NE]: DIR.SW, [DIR.E]: DIR.W, [DIR.SE]: DIR.NW,
  [DIR.S]: DIR.N, [DIR.SW]: DIR.NE, [DIR.W]: DIR.E, [DIR.NW]: DIR.SE,
});

/** Which settlements get which grade. Cities and hamlets are the
 *  ROAD-grade nodes - Daggerfall's walled cities and its market towns.
 *  Villages, farms, taverns and temples are TRACK-grade: they hang off
 *  the road network by a dirt track to the nearest road node. Dungeons,
 *  graveyards, covens, cults and the player's ship get nothing, which
 *  is a choice: a road to a labyrinth tells the player where it is. */
export const ROAD_TYPES = Object.freeze(new Set([
  LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet,
]));
export const TRACK_TYPES = Object.freeze(new Set([
  LOCATION_TYPES.TownVillage, LOCATION_TYPES.Tavern, LOCATION_TYPES.ReligionTemple,
]));
// AUDIT ROADS F1: HomeFarms and HomeWealthy were track-grade in the
// first draft. Farms are the single most numerous location type on the
// map - thousands of them - and a dirt track to every one blankets the
// countryside and costs a thousand A* runs at boot. A farm sits in the
// fields it works; the track stops at the village. Wealthy homes are
// estates off the road, likewise. Both are deliberately NOT here and
// this comment is the reason, so the next reader does not "complete"
// the set.

/** THE DIALS. All of them, in one place, because "the roads climb that
 *  mountain" is a cost-function complaint and the answer should be one
 *  number away. */
export const ROAD_DIALS = Object.freeze({
  neighbours: 3,          // k-nearest edges per road node
  roadReach: 70,          // max pixel distance for a road edge
  trackReach: 40,         // max pixel distance for a track to its road node
  climbCost: 40,          // per unit of small-heightmap rise, per step (percent)
  descentCost: 10,        // downhill is cheaper but not free (percent)
  highCost: 0.08,         // per unit of height above `highAbove`, per step
  highAbove: 40,          // small-heightmap value where terrain starts to cost
  roadDiscount: 0.5,      // stepping onto an existing road costs half - roads merge
  turnCost: 0.7,          // per 45 degrees of heading change, per step (ROADS 5)
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * @param {object} p
 * @param {Array<{x:number,y:number,type:number}>} p.locations - map pixels.
 * @param {(x:number,y:number)=>number} p.heightAt - small heightmap value.
 * @param {(x:number,y:number)=>boolean} p.isWater - impassable.
 * @param {object} [p.dials]
 * @returns {{ roads: Uint8Array, tracks: Uint8Array, stats: object }}
 */
export function buildRoadNetwork({ locations, heightAt, isWater, dials = {} }) {
  const d = { ...ROAD_DIALS, ...dials };
  const roads = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  const tracks = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);

  const roadNodes = locations.filter((l) => ROAD_TYPES.has(l.type) && inMap(l));
  const trackNodes = locations.filter((l) => TRACK_TYPES.has(l.type) && inMap(l));

  // THE ROAD GRAPH: k-nearest within reach, then a spanning tree over
  // ALL road nodes so nothing is stranded - the tree may add long
  // edges, and that is the point; a town with no road is a bug.
  const edges = new Map();   // "i,j" i<j -> [i,j]
  const addEdge = (i, j) => { if (i !== j) edges.set(i < j ? `${i},${j}` : `${j},${i}`, i < j ? [i, j] : [j, i]); };
  for (let i = 0; i < roadNodes.length; i++) {
    const near = roadNodes.map((n, j) => ({ j, dd: dist(roadNodes[i], n) }))
      .filter((o) => o.j !== i && o.dd <= d.roadReach)
      .sort((a, b) => a.dd - b.dd).slice(0, d.neighbours);
    for (const o of near) addEdge(i, o.j);
  }
  for (const [i, j] of kruskal(roadNodes)) addEdge(i, j);

  // ROUTE the road edges, shortest first, so later routes find and
  // merge into earlier ones through the discount.
  const routed = [...edges.values()].sort((a, b) => dist(roadNodes[a[0]], roadNodes[a[1]]) - dist(roadNodes[b[0]], roadNodes[b[1]]));
  // AUDIT 45 F7: `unrouted` is a LIST of the pairs that found no path,
  // each end as {x, y, region}, so the boot log can say WHICH town has
  // no road rather than how many do. `stats.unrouted` stays a count for
  // the log line; `stats.unroutedPairs` carries the names.
  const stats = { roadNodes: roadNodes.length, trackNodes: trackNodes.length, roadEdges: routed.length, trackEdges: 0, unrouted: 0, unroutedPairs: [] };
  const miss = (a, b) => { stats.unrouted++; stats.unroutedPairs.push([{ x: a.x, y: a.y, region: a.region }, { x: b.x, y: b.y, region: b.region }]); };
  for (const [i, j] of routed) {
    const path = route(roadNodes[i], roadNodes[j], { heightAt, isWater, existing: roads, d });
    if (path) stamp(roads, path); else miss(roadNodes[i], roadNodes[j]);
  }

  // TRACKS: each track node to its nearest road NODE within reach (not
  // the nearest road pixel - a track that joins mid-road is fine, but
  // aiming at a town keeps tracks reading as "the way to town").
  // AUDIT ROADS F6: a track stops on ANY path, road or track, and gets
  // the merge discount on both - two villages a mile apart share the
  // last mile instead of wearing parallel ruts. `paths` is the union,
  // kept in step as each track lands.
  const paths = new Uint8Array(roads);
  for (const t of trackNodes) {
    let best = null; let bd = Infinity;
    for (const r of roadNodes) { const dd = dist(t, r); if (dd < bd) { bd = dd; best = r; } }
    if (!best || bd > d.trackReach) continue;
    const path = route(t, best, { heightAt, isWater, existing: paths, d, stopOn: paths });
    if (path) { stamp(tracks, path); stamp(paths, path); stats.trackEdges++; } else miss(t, best);
  }
  return { roads, tracks, stats };
}

function inMap(l) { return l.x >= 0 && l.x < MAP_WIDTH && l.y >= 0 && l.y < MAP_HEIGHT; }

/** Kruskal over the complete graph of road nodes - O(n^2 log n) edges,
 *  fine for the few hundred towns Daggerfall has. */
function kruskal(nodes) {
  const all = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) all.push([dist(nodes[i], nodes[j]), i, j]);
  all.sort((a, b) => a[0] - b[0]);
  const parent = nodes.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const out = [];
  for (const [, i, j] of all) { const a = find(i), b = find(j); if (a !== b) { parent[a] = b; out.push([i, j]); } }
  return out;
}

/** Write a path's steps into a mask array: each end of a step gets the
 *  bit toward the other. */
export function stamp(mask, path) {
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k], b = path[k + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const step = DIR_DELTA.find(([, ex, ey]) => ex === dx && ey === dy);
    if (!step) throw new Error(`stamp: non-adjacent step (${a.x},${a.y})->(${b.x},${b.y})`);
    mask[a.y * MAP_WIDTH + a.x] |= step[0];
    mask[b.y * MAP_WIDTH + b.x] |= OPPOSITE[step[0]];
  }
}

/**
 * A* on the pixel grid, 8-connected. Cost: step length x (1 + climb or
 * descent x height cost), water refused, existing road half price so
 * routes converge. `stopOn` lets a track end the moment it touches the
 * road network rather than walking into town beside it. Bounded to the
 * endpoints' box plus a margin so a 500k-cell grid is never scanned.
 */
export function route(from, to, opts) {
  // A caller's dial object may predate a dial; missing ones take the
  // default rather than poisoning the cost with NaN (ROADS 5 found the
  // pins' own dials doing exactly that).
  opts = { ...opts, d: { ...ROAD_DIALS, ...(opts.d ?? {}) } };
  // THE BOX GROWS ON FAILURE. A bay or a range taller than the margin
  // walls the search in and A* reports no route, so the first answer is
  // tried in a tight box for speed and widened twice before giving up.
  // The pin puts a lake across the whole first box.
  for (const margin of [12, 40, 120]) {
    const p = routeInBox(from, to, opts, margin);
    if (p) return p;
  }
  return null;
}

/**
 * ROADS 5 (Mac, first real-data look: "the roads are extremely jagged"):
 * THE STATE IS THE CELL AND THE HEADING. Plain A* on an 8-connected grid
 * draws a 1-in-10 slope as nine E steps and one NE, over and over, and
 * the painter turns every one of those changes into a 135-degree kink
 * at a pixel centre - a staircase, which is what Mac saw. A road-builder
 * lays STRAIGHT STRETCHES and turns rarely, so each step now pays
 * turnCost per 45 degrees of heading change, and the search carries
 * the heading in its state (cell x 8) so the price is paid where the
 * turn happens. The result prefers "E for a while, then NE for a while"
 * to alternating, which is the same length and far fewer corners.
 */
function routeInBox(from, to, { heightAt, isWater, existing, d, stopOn = null }, margin) {
  const x0 = Math.max(0, Math.min(from.x, to.x) - margin), x1 = Math.min(MAP_WIDTH - 1, Math.max(from.x, to.x) + margin);
  const y0 = Math.max(0, Math.min(from.y, to.y) - margin), y1 = Math.min(MAP_HEIGHT - 1, Math.max(from.y, to.y) + margin);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cells = bw * bh;
  const idx = (x, y) => (y - y0) * bw + (x - x0);
  // state = cell * 8 + heading; heading 8 = "no heading yet" lives on the start alone
  const g = new Float32Array(cells * 8).fill(Infinity);
  const came = new Int32Array(cells * 8).fill(-1);
  const closed = new Uint8Array(cells * 8);
  const turnOf = (a, b) => (a < 0 ? 0 : Math.min((a - b + 8) % 8, (b - a + 8) % 8));
  // AUDIT ROADS F3: the cheapest step is a discounted one onto an
  // existing path, so the heuristic is scaled by the discount to stay
  // admissible - an overestimating h makes A* skip the merge it exists
  // to find, and the routes stop converging on shared roads.
  const h = (x, y) => Math.hypot(x - to.x, y - to.y) * d.roadDiscount;
  const open = new MinHeap();
  const sc = idx(from.x, from.y);
  // the start has no heading: seed every heading at 0 so the first step is free to choose
  for (let k = 0; k < 8; k++) { g[sc * 8 + k] = 0; open.push(h(from.x, from.y), sc * 8 + k); }
  const goal = idx(to.x, to.y);
  let end = -1;
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cell = (cur / 8) | 0, heading = cur % 8;
    const cx = x0 + (cell % bw), cy = y0 + Math.floor(cell / bw);
    if (cell === goal || (stopOn && cell !== sc && stopOn[cy * MAP_WIDTH + cx] !== 0)) { end = cur; break; }
    const hc = heightAt(cx, cy);
    const atStart = cell === sc;
    for (let k = 0; k < 8; k++) {
      const [, dx, dy] = DIR_DELTA[k];
      const nx = cx + dx, ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const ni = idx(nx, ny) * 8 + k;
      if (closed[ni] || isWater(nx, ny)) continue;
      const hn = heightAt(nx, ny);
      const rise = hn - hc;
      let cost = (dx && dy) ? Math.SQRT2 : 1;
      cost *= 1 + (rise > 0 ? rise * d.climbCost : -rise * d.descentCost) * 0.01;
      if (hn > d.highAbove) cost *= 1 + (hn - d.highAbove) * d.highCost;
      if (existing[ny * MAP_WIDTH + nx]) cost *= d.roadDiscount;
      if (!atStart) cost += turnOf(heading, k) * d.turnCost;
      const ng = g[cur] + cost;
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; open.push(ng + h(nx, ny), ni); }
    }
  }
  if (end < 0) return null;
  const path = [];
  for (let c = end; c >= 0; c = came[c]) {
    const cell = (c / 8) | 0;
    const pt = { x: x0 + (cell % bw), y: y0 + Math.floor(cell / bw) };
    if (!path.length || path[path.length - 1].x !== pt.x || path[path.length - 1].y !== pt.y) path.push(pt);
  }
  return path.reverse();
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v; const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
}
