// ═══════════════════════════════════════════════════════════════════
// R1 — THE ROAD NETWORK, GENERATED FROM THE TERRAIN.
//
// Classic Daggerfall has no roads. This is an ENHANCED-ONLY departure
// (Ledger A), and it is generated rather than authored: a least-cost
// routing over the SAME 1000x500 WOODS.WLD heightmap the streamed
// terrain samples and the SAME CLIMATE.PAK bytes the travel calculator
// charges, between the real MAPS.BSA locations. Nothing is vendored
// and no asset ships - a road bends around a mountain because the
// mountain is in the data, not because someone drew it bending.
//
// This module is PURE - typed arrays in, typed arrays out, no DOM, no
// GL, no game data - so a node test can hold the router against its
// laws with synthetic bytes, exactly as ui/overworldModel.js does for
// the relief.
//
// ── WHAT IS LAW AND WHAT IS SKIN ─────────────────────────────────
//
// LAW (systems/travel.js): the per-pixel terrain term is the travel
// calculator's OWN cost numerator - `256 - TERRAIN_MOVEMENT_MODIFIERS[
// CLIMATE_INDICES[climate - Ocean]] + 256`, imported, never restated.
// A road therefore prefers exactly the ground the game already says is
// fast to cross, and the two cannot drift.
//
// LAW (ui/overworldModel.js): whether a pixel is water is the relief's
// own two-sided test (Ocean climate OR the height byte floored out).
// This module does NOT restate it and does NOT import it - `systems/`
// importing `ui/` would drag the whole travel window into a pure
// module - so `isWater` is a REQUIRED injected predicate and the
// caller passes overworldModel.isWaterPixel. The pin drives it with a
// deliberately different predicate to prove nothing is hardcoded.
//
// SKIN (recorded departure, tuned by eye): GRADIENT_WEIGHT,
// ROAD_REUSE_COST, LOOP_FACTOR, HUB_NEIGHBOURS, WANDER. There is no
// source law for these - classic has no roads to be faithful to - so
// they are named constants with stated intent, and the pins assert
// STRUCTURE (a road prefers the gentle detour; a second route merges
// onto the first; exits are symmetric) rather than asserting these
// numbers back at themselves.
//
// ── THE SHAPE OF A NETWORK ───────────────────────────────────────
//
// 1. Hubs (TownCity, TownHamlet) get a k-nearest candidate set.
// 2. Each candidate is routed; a minimum spanning tree over the ROUTED
//    costs is the trunk skeleton - laid cheapest-first, each edge
//    RE-ROUTED against the live field so later trunks merge onto
//    earlier ones instead of running parallel. That convergence is
//    what makes a generated network read as designed.
// 3. Loops: a candidate the finished skeleton forces a long way round
//    gets built direct. A pure MST is a tree, and a tree does not look
//    like a road map.
//    THE TEST HAS TO RE-PRICE, NOT COMPARE COSTS. A reroute over the
//    discounted field can never cost MORE than the same pair over the
//    virgin one, so `reroute.cost > factor * direct` can never fire -
//    an earlier draft did exactly that and built zero loops while
//    looking entirely reasonable. The reroute's PATH is re-priced
//    under snapshot virgin costs instead, which asks what the detour
//    costs on the ground.
// 4. Spurs: every other location Dijkstras to the NEAREST NETWORK
//    PIXEL (multi-target, so no heuristic) and joins as a track.
//
// REFUTED AND REMOVED, recorded so it is not tried again: a bounded
// search window (route inside the pair's inflated bounding box, fall
// back to the whole map on failure). It was written to make the bake
// tractable and measurement killed it - at full Iliac Bay scale it
// saved about half a second of a twenty-six second bake, two per cent,
// while producing a six and a half per cent DIFFERENT network, because
// a box the optimal path leaves does not fail: it quietly returns the
// best path INSIDE the box and the fallback never fires. It was an
// approximation wearing an optimisation's comment, and the heuristic
// was already pruning everything the box would have.
//
// Determinism is a pin, not a hope: locations are sorted by map-pixel
// id before anything is routed, heap ties break on the straight line
// and then on node index, and the same inputs must produce
// byte-identical exit arrays. A bake that is not reproducible cannot
// be cached.
// ═══════════════════════════════════════════════════════════════════

import { CLIMATES, LOCATION_TYPES } from '../formats/mapsFile.js';
import { CLIMATE_INDICES, TERRAIN_MOVEMENT_MODIFIERS } from './travel.js';

// ── ROAD CLASSES ─────────────────────────────────────────────────

export const ROAD_NONE = 0;
export const ROAD_TRACK = 1;
export const ROAD_TRUNK = 2;

/** Which location types anchor the trunk skeleton. Everything else
 *  joins by spur. */
export const HUB_TYPES = Object.freeze([
  LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet,
]);

// ── THE EIGHT EXITS ──────────────────────────────────────────────
//
// Map y runs SOUTH (the port's convention everywhere: scene z = -py,
// so north is +z). Bit order is compass order from north, clockwise,
// so the packed byte reads the way a compass does.

export const DIRS = Object.freeze([
  Object.freeze({ dx: 0, dy: -1, bit: 1, name: 'N' }),
  Object.freeze({ dx: 1, dy: -1, bit: 2, name: 'NE' }),
  Object.freeze({ dx: 1, dy: 0, bit: 4, name: 'E' }),
  Object.freeze({ dx: 1, dy: 1, bit: 8, name: 'SE' }),
  Object.freeze({ dx: 0, dy: 1, bit: 16, name: 'S' }),
  Object.freeze({ dx: -1, dy: 1, bit: 32, name: 'SW' }),
  Object.freeze({ dx: -1, dy: 0, bit: 64, name: 'W' }),
  Object.freeze({ dx: -1, dy: -1, bit: 128, name: 'NW' }),
]);

/** The exit facing back down the same edge. */
export function oppositeDir(i) { return (i + 4) & 7; }

const DIAG = Math.SQRT2;

// ── SKIN CONSTANTS (see the header) ──────────────────────────────

/** Per unit of squared height-byte difference between two pixels. One
 *  height byte is 8 native units over 819.2 per pixel - about a 1%
 *  grade - so a 10-byte step is a 10% grade, and at this weight that
 *  roughly doubles the cost of the step. Squared, so a road takes the
 *  long gentle way rather than the short steep one, which is the whole
 *  reason to route over the heightmap at all. */
export const GRADIENT_WEIGHT = 2.8;

/** What an already-built road costs to travel while ROUTING (not in
 *  game - that is R4's business). Well below the cheapest terrain, so
 *  a later route that touches the network follows it. */
export const ROAD_REUSE_COST = 24;

/** A candidate the finished skeleton forces this many times its own
 *  direct cost to reach is worth building direct. */
export const LOOP_FACTOR = 2.35;

/** Candidate trunk edges per hub before the spanning tree culls. */
export const HUB_NEIGHBOURS = 5;

/** Per-pixel ground jitter, as a fraction of the terrain cost.
 *
 *  CENTRED, not one-sided: ground varies AROUND its climate's nominal
 *  cost rather than only ever being worse than it. One-sided jitter
 *  inflates the whole field by wander/2 and makes the clean terrain
 *  cost a floor nothing reaches - harmless for routing, since only
 *  ratios matter, but it makes every cost in the module a small lie.
 *
 *  Honest about what this is NOT: it was added believing it would fix
 *  axis-locked roads, and measurement refuted that - the diagonal/axis
 *  mix was already at the octile ideal without it and the median
 *  direction-run is 2. What it does buy is real but smaller: over
 *  ground of one climate the field is FLAT, and jitter makes the
 *  ground itself the tie-break rather than the node index. */
export const WANDER = 0.16;
export const WANDER_SEED = 0x9e3779b9;

/** A stable per-pixel hash in [0, 1). Integer mixing only - no
 *  Math.random anywhere near a bake that has to be reproducible. */
export function groundHash(x, y, seed = WANDER_SEED) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// ── THE COST FIELD ───────────────────────────────────────────────

/** The travel calculator's own per-pixel cost numerator, lifted out of
 *  CalculateTravelTime's expression. Higher = slower ground. An
 *  out-of-range climate byte clamps rather than reading past the table
 *  - the calculator would index out of bounds and answer NaN. */
export function terrainStepCost(climate) {
  const raw = climate - CLIMATES.Ocean;
  const i = raw < 0 ? 0 : raw >= CLIMATE_INDICES.length ? CLIMATE_INDICES.length - 1 : raw;
  return 256 - TERRAIN_MOVEMENT_MODIFIERS[CLIMATE_INDICES[i]] + 256;
}

/**
 * The routing substrate: one base cost per map pixel, Infinity where a
 * road cannot go.
 *
 * @param {object} o
 * @param {Uint8Array} o.heightBytes - the WOODS small heightmap, row-major
 * @param {number} o.width @param {number} o.height
 * @param {(x:number,y:number)=>number} o.climateAt - CLIMATE.PAK byte
 * @param {(climate:number,byte:number)=>boolean} o.isWater - REQUIRED;
 *        the one home is ui/overworldModel.isWaterPixel (see header)
 * @returns {{cost:Float32Array,width:number,height:number,minStep:number}}
 */
export function buildCostField({
  heightBytes, width, height, climateAt, isWater,
  wander = WANDER, seed = WANDER_SEED,
}) {
  if (typeof isWater !== 'function') {
    throw new Error('roads.buildCostField: isWater is required - pass overworldModel.isWaterPixel');
  }
  const cost = new Float32Array(width * height);
  let minStep = Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const byte = heightBytes[i];
      const climate = climateAt(x, y);
      if (isWater(climate, byte)) { cost[i] = Infinity; continue; }
      // The floor is read back OUT of the array, never from the double
      // that was just computed: cost is a Float32Array and the store
      // TRUNCATES, so the double sits fractionally ABOVE what routing
      // will see. h = octile x minStep would then overestimate by that
      // hair and A* would quietly stop being admissible - the one
      // property the heuristic exists for.
      cost[i] = terrainStepCost(climate) * (1 + wander * (groundHash(x, y, seed) - 0.5));
      if (cost[i] < minStep) minStep = cost[i];
    }
  }
  if (!isFinite(minStep)) minStep = 1;   // an all-water map still routes (to nothing)
  return { cost, width, height, minStep };
}

// ── THE HEAP ─────────────────────────────────────────────────────

class Heap {
  constructor(cap = 1024) {
    this.key = new Float64Array(cap);
    this.tie = new Float64Array(cap);
    this.val = new Int32Array(cap);
    this.n = 0;
  }

  _grow() {
    const k = new Float64Array(this.key.length * 2);
    const t = new Float64Array(this.tie.length * 2);
    const v = new Int32Array(this.val.length * 2);
    k.set(this.key); t.set(this.tie); v.set(this.val);
    this.key = k; this.tie = t; this.val = v;
  }

  _less(a, b) {
    if (this.key[a] !== this.key[b]) return this.key[a] < this.key[b];
    if (this.tie[a] !== this.tie[b]) return this.tie[a] < this.tie[b];
    return this.val[a] < this.val[b];
  }

  push(key, tie, val) {
    if (this.n === this.key.length) this._grow();
    let i = this.n++;
    this.key[i] = key; this.tie[i] = tie; this.val[i] = val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this._less(i, p)) break;
      this._swap(i, p); i = p;
    }
  }

  _swap(a, b) {
    const k = this.key[a]; this.key[a] = this.key[b]; this.key[b] = k;
    const t = this.tie[a]; this.tie[a] = this.tie[b]; this.tie[b] = t;
    const v = this.val[a]; this.val[a] = this.val[b]; this.val[b] = v;
  }

  pop() {
    const top = this.val[0];
    if (--this.n > 0) {
      this.key[0] = this.key[this.n];
      this.tie[0] = this.tie[this.n];
      this.val[0] = this.val[this.n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.n && this._less(l, m)) m = l;
        if (r < this.n && this._less(r, m)) m = r;
        if (m === i) break;
        this._swap(i, m); i = m;
      }
    }
    return top;
  }
}

// ── THE ROUTER ───────────────────────────────────────────────────

/** Octile distance - the exact shortest 8-connected walk length, so
 *  h = octile x minStep never overestimates and A* stays admissible. */
export function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return (dx > dy ? dx - dy : dy - dx) + DIAG * Math.min(dx, dy);
}

// ── ROUTER SCRATCH (RA1, 2026-08-28) ─────────────────────────────
// routeRoad used to allocate three fresh full-map arrays per call -
// g (Float64, 4MB at the real map), from (Int32, 2MB) and closed
// (Uint8, 0.5MB) - and .fill() two of them. A full bake makes about
// seventeen thousand routeRoad calls (candidates + tree reroutes +
// loop reroutes + ~14,800 spurs), which is ~110GB of allocation churn
// and seconds of pure memset before a single node is expanded. The
// audit that found it: the "stuck on baking roads" boot stall.
//
// The scratch is reused across calls with a GENERATION STAMP instead:
// a cell's g/from are valid only when seen[i] carries this call's
// generation, and closed is its own stamp plane. Nothing is refilled
// between calls, and the results are bit-identical - the determinism
// pin holds because a stale cell reads as the same Infinity/unclosed
// the fresh fill produced. routeRoad never re-enters itself (goalTest
// is a plain predicate), so one shared scratch is safe.
let _scratch = null;
function routerScratch(N) {
  if (_scratch === null || _scratch.g.length !== N) {
    _scratch = {
      g: new Float64Array(N),
      from: new Int32Array(N),
      seen: new Int32Array(N),      // g/from valid where seen[i] === gen
      closedAt: new Int32Array(N),  // closed where closedAt[i] === gen
      gen: 0,
    };
  }
  if (++_scratch.gen === 0x7fffffff) {   // stamp wrap: start the count over clean
    _scratch.seen.fill(0);
    _scratch.closedAt.fill(0);
    _scratch.gen = 1;
  }
  return _scratch;
}

/**
 * Least-cost route from `start` to `goal` (A*) or to the nearest pixel
 * satisfying `goalTest` (Dijkstra - no single target means no
 * admissible heuristic, so h is 0 and it must be 0).
 *
 * The step cost is the MEAN of the two pixels' terrain cost, scaled by
 * the step length, plus the squared height-byte difference at
 * GRADIENT_WEIGHT. Mean rather than destination-only so a road is
 * charged symmetrically and A->B costs what B->A costs.
 *
 * @returns {{path:{x:number,y:number}[],cost:number}|null} - the path
 *          INCLUDES both endpoints; null when no route exists.
 */
export function routeRoad(field, start, goal, {
  heightBytes,
  gradientWeight = GRADIENT_WEIGHT,
  goalTest = null,
  maxExpansions = Infinity,
} = {}) {
  const { cost, width, height, minStep } = field;
  const N = width * height;
  const si = start.y * width + start.x;
  if (!(cost[si] < Infinity)) return null;

  const isGoal = goalTest
    ? (x, y) => goalTest(x, y)
    : (x, y) => x === goal.x && y === goal.y;
  if (!goalTest && !(cost[goal.y * width + goal.x] < Infinity)) return null;
  if (isGoal(start.x, start.y)) return { path: [{ x: start.x, y: start.y }], cost: 0 };

  const { g, from, seen, closedAt, gen } = routerScratch(N);
  const heap = new Heap();

  const h = goalTest ? () => 0 : (x, y) => octile(x, y, goal.x, goal.y) * minStep;
  // THE TIE-BREAK IS THE STRAIGHT LINE, not the node index. Over
  // uniform ground every ordering of a route's diagonal and axis steps
  // costs the same, so A* is free to emit all the diagonals first and
  // all the axis steps after - which draws as two long runs meeting at
  // a hard corner. Breaking equal-f ties on distance from the
  // start-goal line prefers the ordering that hugs the direct line.
  // A TIE break, never a cost: h is untouched and A* stays admissible.
  const cross = goalTest ? () => 0 : (x, y) => {
    const dx = goal.x - start.x, dy = goal.y - start.y;
    return Math.abs((x - start.x) * dy - (y - start.y) * dx);
  };

  g[si] = 0;
  from[si] = -1;
  seen[si] = gen;
  heap.push(h(start.x, start.y), cross(start.x, start.y), si);

  let expansions = 0;
  while (heap.n > 0) {
    const ci = heap.pop();
    if (closedAt[ci] === gen) continue;
    closedAt[ci] = gen;
    const cx = ci % width, cy = (ci - cx) / width;

    if (isGoal(cx, cy)) {
      const path = [];
      for (let i = ci; i !== -1; i = from[i]) {
        const x = i % width;
        path.push({ x, y: (i - x) / width });
      }
      path.reverse();
      return { path, cost: g[ci] };
    }
    if (++expansions > maxExpansions) return null;

    const cc = cost[ci];
    const cb = heightBytes[ci];
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (closedAt[ni] === gen) continue;
      const nc = cost[ni];
      if (!(nc < Infinity)) continue;
      const dh = heightBytes[ni] - cb;
      const len = (DIRS[d].dx !== 0 && DIRS[d].dy !== 0) ? DIAG : 1;
      const step = ((cc + nc) * 0.5) * len + gradientWeight * dh * dh;
      const ng = g[ci] + step;
      // a cell another CALL touched reads as the fresh fill's Infinity
      if (ng < (seen[ni] === gen ? g[ni] : Infinity)) {
        g[ni] = ng;
        from[ni] = ci;
        seen[ni] = gen;
        heap.push(ng + h(nx, ny), cross(nx, ny), ni);
      }
    }
  }
  return null;
}

/**
 * What an existing path would cost under a given cost array - the same
 * step law routeRoad charges, applied to a path it did not choose.
 * The loop test's yardstick: a reroute that follows discounted road
 * has to be re-priced on virgin ground before it can be compared with
 * a virgin route.
 */
export function pathCost(cost, width, path, heightBytes, gradientWeight = GRADIENT_WEIGHT) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const ai = a.y * width + a.x, bi = b.y * width + b.x;
    const dh = heightBytes[bi] - heightBytes[ai];
    const len = (a.x !== b.x && a.y !== b.y) ? DIAG : 1;
    total += ((cost[ai] + cost[bi]) * 0.5) * len + gradientWeight * dh * dh;
  }
  return total;
}

// ── THE PACKED NETWORK ───────────────────────────────────────────

/** An empty network sized to the field. */
export function createNetwork(width, height) {
  return {
    width, height,
    trunkExits: new Uint8Array(width * height),
    trackExits: new Uint8Array(width * height),
    segments: [],
  };
}

/** Link two ADJACENT pixels in both directions. Both halves always - a
 *  one-sided exit is a road you can leave but not enter, and every
 *  consumer (terrain paint, the map polylines, R4's router) reads the
 *  exits from whichever end it happens to stand on. */
export function linkPixels(exits, width, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d = DIRS.findIndex((v) => v.dx === dx && v.dy === dy);
  if (d === -1) throw new Error(`roads.linkPixels: (${ax},${ay})->(${bx},${by}) is not one step`);
  exits[ay * width + ax] |= DIRS[d].bit;
  exits[by * width + bx] |= DIRS[oppositeDir(d)].bit;
  return d;
}

/** Lay a routed path into the network as `kind`, and discount the
 *  field beneath it so later routes merge rather than run parallel. */
export function layPath(network, field, path, kind) {
  const exits = kind === ROAD_TRUNK ? network.trunkExits : network.trackExits;
  for (let i = 1; i < path.length; i++) {
    linkPixels(exits, network.width, path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
  }
  for (const p of path) {
    const i = p.y * field.width + p.x;
    if (field.cost[i] > ROAD_REUSE_COST) field.cost[i] = ROAD_REUSE_COST;
  }
  // minStep must follow the discount down, or h overestimates on every
  // route that touches road and A* stops being admissible.
  if (ROAD_REUSE_COST < field.minStep) field.minStep = ROAD_REUSE_COST;
  network.segments.push({ kind, points: path });
  return network;
}

/** RB1 (2026-08-28): does this network carry ANY road at all? A bake
 *  that completes but lays nothing is a real outcome - readers that
 *  answered no locations, a filter that took them all - and it used to
 *  serialize as a perfectly valid cache entry, so every later boot
 *  read the emptiness back as a hit and the player had no roads for
 *  good, with no door to drop it. */
export function networkHasAnyRoad(network) {
  if (!network) return false;
  const { trunkExits, trackExits } = network;
  for (let i = 0; i < trunkExits.length; i++) {
    if (trunkExits[i] !== 0 || trackExits[i] !== 0) return true;
  }
  return false;
}

/** The exits at one pixel, by class. */
export function roadExitsAt(network, x, y) {
  if (x < 0 || y < 0 || x >= network.width || y >= network.height) {
    return { trunk: 0, track: 0 };
  }
  const i = y * network.width + x;
  return { trunk: network.trunkExits[i], track: network.trackExits[i] };
}

/** ROAD_TRUNK beats ROAD_TRACK beats ROAD_NONE at a shared pixel. The
 *  per-pixel answer terrain painting and the nav weight want; the map
 *  layer traces the exit planes instead and loses nothing. */
export function roadKindAt(network, x, y) {
  const { trunk, track } = roadExitsAt(network, x, y);
  if (trunk) return ROAD_TRUNK;
  if (track) return ROAD_TRACK;
  return ROAD_NONE;
}

export function hasRoad(network, x, y) {
  return roadKindAt(network, x, y) !== ROAD_NONE;
}

// ── THE BUILDER ──────────────────────────────────────────────────

function unionFind(n) {
  const p = new Int32Array(n);
  for (let i = 0; i < n; i++) p[i] = i;
  const find = (a) => { while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; } return a; };
  return {
    find,
    union(a, b) { const ra = find(a), rb = find(b); if (ra === rb) return false; p[ra] = rb; return true; },
  };
}

/** Deterministic order for anything routed: map-pixel id, ascending.
 *  Two locations never share a pixel in MAPS.BSA, so this is a total
 *  order and the bake is reproducible. */
function byPixelId(a, b) { return (a.y * 1000 + a.x) - (b.y * 1000 + b.x); }

/**
 * Build the whole network. See the header for the four stages.
 *
 * @param {object} o
 * @param {ReturnType<buildCostField>} o.field - MUTATED (reuse discount)
 * @param {Uint8Array} o.heightBytes
 * @param {{x:number,y:number,locationType:number}[]} o.locations
 * @param {(p:{phase:string,done:number,total:number})=>void} [o.onProgress]
 * @returns {{network:object,stats:object}}
 */
export function buildRoadNetwork({
  field, heightBytes, locations,
  hubTypes = HUB_TYPES,
  hubNeighbours = HUB_NEIGHBOURS,
  loopFactor = LOOP_FACTOR,
  gradientWeight = GRADIENT_WEIGHT,
  maxExpansions = Infinity,
  onProgress = null,
} = {}) {
  const network = createNetwork(field.width, field.height);
  const opts = { heightBytes, gradientWeight, maxExpansions };
  // The bake is half a minute of work on the real map, so it reports.
  // A silent first boot that looks hung is a bug even when it finishes.
  const report = (phase, done, total) => { if (onProgress) onProgress({ phase, done, total }); };

  const hubSet = new Set(hubTypes);
  const all = [...locations].sort(byPixelId);
  const hubs = all.filter((l) => hubSet.has(l.locationType));
  const spurs = all.filter((l) => !hubSet.has(l.locationType));

  // 1. candidate edges: k nearest hubs, deduped as an undirected pair.
  const seen = new Set();
  const candidates = [];
  for (let a = 0; a < hubs.length; a++) {
    const near = hubs
      .map((h, b) => ({ b, d: (h.x - hubs[a].x) ** 2 + (h.y - hubs[a].y) ** 2 }))
      .filter((v) => v.b !== a)
      .sort((p, q) => p.d - q.d || p.b - q.b)
      .slice(0, hubNeighbours);
    for (const { b } of near) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ a: Math.min(a, b), b: Math.max(a, b) });
    }
  }
  candidates.sort((p, q) => p.a - q.a || p.b - q.b);

  // 2. route every candidate on the VIRGIN field - these costs are the
  //    spanning tree's weights and the loop test's yardstick, so the
  //    virgin costs are snapshot before anything is laid.
  const virgin = Float32Array.from(field.cost);
  let done = 0;
  for (const c of candidates) {
    const r = routeRoad(field, hubs[c.a], hubs[c.b], opts);
    c.direct = r ? r.cost : Infinity;
    c.path = r ? r.path : null;
    report('candidates', ++done, candidates.length);
  }
  const routable = candidates.filter((c) => isFinite(c.direct));

  // 3. minimum spanning tree over the routed costs, laid cheapest
  //    first and RE-ROUTED against the live field so trunks converge.
  const uf = unionFind(hubs.length);
  const tree = [...routable].sort((p, q) => p.direct - q.direct || p.a - q.a || p.b - q.b);
  let trunkLaid = 0;
  const spanning = [];
  for (const c of tree) {
    if (uf.find(c.a) === uf.find(c.b)) continue;   // already joined
    // RC1 (2026-08-28): ROUTE FIRST, then commit. The union used to
    // run before the reroute and `if (!r) continue` came after it, so
    // a reroute that failed against the LIVE field left union-find
    // claiming the two hubs joined with no trunk between them - the
    // tree said connected, the ground said nothing, and every later
    // candidate that would have joined them was skipped as redundant.
    const r = routeRoad(field, hubs[c.a], hubs[c.b], opts);
    if (!r) continue;
    uf.union(c.a, c.b);
    spanning.push(c);
    layPath(network, field, r.path, ROAD_TRUNK);
    report('trunk', ++trunkLaid, Math.max(1, hubs.length - 1));
  }

  // RC1: the candidate graph is the k nearest hubs, which is not
  // guaranteed connected - so what comes out is a spanning FOREST, and
  // a hub in a component of its own is a town no trunk reaches. That
  // used to be silent. Count the components and report them; the spur
  // pass below still joins any hub the forest stranded, because a hub
  // with no road on its pixel is a spur candidate like any other.
  const componentSize = new Map();
  for (let i = 0; i < hubs.length; i++) {
    const r = uf.find(i);
    componentSize.set(r, (componentSize.get(r) ?? 0) + 1);
  }
  const trunkComponents = componentSize.size;
  const strandedHubs = hubs.filter((_, i) => componentSize.get(uf.find(i)) === 1).length;

  // 4. loops. The reroute follows the network (it is cheap to);
  //    re-pricing THAT PATH under the virgin costs asks what the
  //    detour really costs on the ground, which is the comparable
  //    number. Comparing the two COSTS can never fire - see the header.
  const inTree = new Set(spanning.map((c) => `${c.a}:${c.b}`));
  let loopsLaid = 0;
  // RP1 (2026-08-28): this phase used to report ONCE, after it had
  // finished, and with done === total - so the bar sat frozen for the
  // whole of it and then jumped to complete. It is a full reroute per
  // off-tree candidate, which measured as the largest single share of
  // a real bake, and a silent stretch that long is the "stuck on
  // baking roads" complaint RA1 was called in for. Report per
  // CANDIDATE EXAMINED against the count actually examined, not per
  // loop laid: most candidates are rejected, so counting the laid ones
  // would crawl and then jump too.
  const loopCandidates = routable.filter((c) => !inTree.has(`${c.a}:${c.b}`));
  let loopsSeen = 0;
  report('loops', 0, loopCandidates.length);
  for (const c of loopCandidates) {
    const r = routeRoad(field, hubs[c.a], hubs[c.b], opts);
    if (r) {
      const onTheGround = pathCost(virgin, field.width, r.path, heightBytes, gradientWeight);
      // the network already serves it
      if (onTheGround > loopFactor * c.direct) {
        layPath(network, field, c.path, ROAD_TRUNK);
        loopsLaid++;
      }
    }
    report('loops', ++loopsSeen, loopCandidates.length);
  }

  // 5. spurs: every remaining location joins the NEAREST network pixel.
  //
  // RA1: the goal test reads the exit planes DIRECTLY. It is hasRoad's
  // own law - either plane non-zero - but hasRoad goes through
  // roadExitsAt, which allocates a fresh {trunk, track} object, and
  // this predicate runs once per POPPED NODE across ~14,800 spur
  // Dijkstras: millions of throwaway objects inside the bake's hottest
  // loop. Same test, no allocation.
  const { trunkExits, trackExits } = network;
  const w = network.width;
  const spurGoal = (x, y) => (trunkExits[y * w + x] | trackExits[y * w + x]) !== 0;
  let spursLaid = 0, orphans = 0;
  // RC1: EVERY remaining location, which is what the comment above has
  // always said and what the code did not do - it walked `spurs`, the
  // non-hub types only. A hub the trunk forest stranded therefore got
  // no road at all and nothing reported it. The hasRoad guard below
  // already skips anything the trunk pass served, so widening the walk
  // costs nothing for a hub that is already on the network.
  for (const s of all) {
    if (hasRoad(network, s.x, s.y)) continue;
    const r = routeRoad(field, s, null, { ...opts, goalTest: spurGoal });
    if (!r) { orphans++; report('spurs', spursLaid + orphans, spurs.length); continue; }
    layPath(network, field, r.path, ROAD_TRACK);
    spursLaid++;
    report('spurs', spursLaid + orphans, spurs.length);
  }

  return {
    network,
    stats: {
      hubs: hubs.length, spurs: spurs.length,
      candidates: candidates.length, routable: routable.length,
      trunkLaid, loopsLaid, spursLaid, orphans,
      // RC1: 1 means the trunk skeleton is one connected network.
      // Anything higher is a forest, and strandedHubs counts the towns
      // left entirely alone by it.
      trunkComponents, strandedHubs,
    },
  };
}

/** The map layer's draw list from the builder's own record. The CACHED
 *  form traces the exit planes instead (see systems/roadBake.js) -
 *  this exists for the probe and for tests that want build order. */
export function roadPolylines(network) {
  return {
    track: network.segments.filter((s) => s.kind === ROAD_TRACK).map((s) => s.points),
    trunk: network.segments.filter((s) => s.kind === ROAD_TRUNK).map((s) => s.points),
  };
}
