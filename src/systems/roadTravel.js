// ═══════════════════════════════════════════════════════════════════
// R4 — TRAVELLING BY ROAD.
//
// R1 generated the network, R2 cached it, R3 drew it. This is the
// slice that makes it MATTER: the route the map draws, the minutes the
// law charges, and the path the camera flies are one path, so a road
// that bends around a mountain bends the journey too.
//
// ── WHY THIS IS PRICED BY THE TRAVEL LAW, NOT THE BUILD LAW ──────
//
// systems/roads.js routes on a BUILDER's cost - gradient-dominant,
// because a road engineer cares what it costs to cut a road. A
// traveller does not: they care what the game charges to cross a
// pixel, which is TravelTimeCalculator's own per-pixel term. So this
// module searches on travelPixelMinutes - the same function
// calculateTravelTime charges with, extracted for exactly this reason.
//
// The consequence is the property worth having: THE DRAWN ROUTE AND
// THE CHARGED TIME AGREE, because they are the same arithmetic over
// the same pixels rather than two estimates that happen to be close.
//
// ── THE ECONOMICS ARE CLASSIC'S OWN ──────────────────────────────
//
// walkTravelPath moves px and SOMETIMES py in the same iteration, and
// charges once per iteration - so in classic a diagonal step costs
// exactly what an axis step costs, and its path length is
// max(|dx|, |dy|), the CHEBYSHEV distance. This router charges the
// same way: one pixel entered, one charge, diagonals included. Charging
// by euclidean distance instead would price the road route in units
// the time law does not use, and the drawn route would stop matching
// the bill.
//
// That also gives the heuristic: h = chebyshev x the cheapest pixel
// charge on the map. Admissible, because no route can enter fewer
// pixels than that or pay less for any of them.
//
// ── AND THE GUARANTEE ────────────────────────────────────────────
//
// Classic's path is itself a legal 8-connected walk, so it is a
// MEMBER of the graph this router searches. A least-cost answer is
// therefore never worse than classic - travelling by road cannot cost
// more minutes than travelling classic, whatever the road layout. That
// is a pin, not a hope, and it is the honest answer to "does the
// enhanced skin make travel slower".
// ═══════════════════════════════════════════════════════════════════

import { CLIMATES } from '../formats/mapsFile.js';
import { travelPixelMinutes, walkTravelPath } from './travel.js';
import { DIRS, ROAD_NONE, ROAD_TRACK, ROAD_TRUNK, roadKindAt } from './roads.js';

/**
 * What a road is worth, out of 256, applied to the terrain term.
 *
 * SKIN - classic has no roads, so there is nothing to be faithful to.
 * Indexed by road class, so ROAD_NONE is 256 (no change) and the table
 * can be handed straight to travelPixelMinutes.
 *
 * The shape matters more than the numbers: a trunk road is worth more
 * than a track, and NEITHER may be worth so much that a road route is
 * shorter in minutes than physically crossing the ground is. These are
 * multipliers on an already-cheap term, not a teleport.
 */
export const ROAD_SPEED = Object.freeze([
  256,   // ROAD_NONE - untouched
  192,   // ROAD_TRACK - a quarter faster
  141,   // ROAD_TRUNK - about a 45% saving
]);

/** A network's road class as calculateTravelTime's `roadAt` dep. */
export function roadAtFor(network) {
  if (!network) return null;
  return (x, y) => roadKindAt(network, x, y);
}

/** The cheapest a single pixel can be charged anywhere, for the
 *  heuristic. Computed from the law rather than assumed: whichever
 *  climate and road class is cheapest under these travel options is
 *  the floor, and h may not exceed it. */
export function cheapestPixelMinutes(transportModifier, opts = {}) {
  let low = Infinity;
  for (let c = CLIMATES.Ocean; c <= CLIMATES.HauntedWoodlands; c++) {
    for (const kind of [ROAD_NONE, ROAD_TRACK, ROAD_TRUNK]) {
      const m = travelPixelMinutes(c, transportModifier, { ...opts, roadKind: kind });
      if (m < low) low = m;
    }
  }
  return low;
}

/** Chebyshev distance - classic's own path length, so the number of
 *  pixels any walk must enter is at least this. */
export function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

class Heap {
  constructor(cap = 1024) {
    this.key = new Float64Array(cap);
    this.val = new Int32Array(cap);
    this.n = 0;
  }

  _grow() {
    const k = new Float64Array(this.key.length * 2);
    const v = new Int32Array(this.val.length * 2);
    k.set(this.key); v.set(this.val);
    this.key = k; this.val = v;
  }

  _less(a, b) {
    return this.key[a] !== this.key[b] ? this.key[a] < this.key[b] : this.val[a] < this.val[b];
  }

  _swap(a, b) {
    const k = this.key[a]; this.key[a] = this.key[b]; this.key[b] = k;
    const v = this.val[a]; this.val[a] = this.val[b]; this.val[b] = v;
  }

  push(key, val) {
    if (this.n === this.key.length) this._grow();
    let i = this.n++;
    this.key[i] = key; this.val[i] = val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this._less(i, p)) break;
      this._swap(i, p); i = p;
    }
  }

  pop() {
    const top = this.val[0];
    if (--this.n > 0) {
      this.key[0] = this.key[this.n]; this.val[0] = this.val[this.n];
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

/**
 * The cheapest walk from `start` to `end` in the travel law's own
 * minutes, following road where road is worth following.
 *
 * Returns `{ path, minutes }`. The path is in walkTravelPath's shape -
 * EXCLUDING the start pixel, including the end - so it drops straight
 * into calculateTravelTime's `path` dep and into routePoints, which
 * prepends the anchor itself.
 *
 * `minutes` is the router's OWN accumulated cost, before the
 * speedCautious halving. It is returned so it can be held against what
 * calculateTravelTime bills for the same path: the two must agree, and
 * a router whose internal cost differs from the law's is choosing its
 * route on the wrong arithmetic and picking suboptimal roads. Charging
 * the pixel LEFT rather than the pixel ENTERED is exactly that bug,
 * it only shows at a road's two ends, and nothing caught it until the
 * cost came back out.
 *
 * @param {object} o
 * @param {number} o.width @param {number} o.height - map dimensions
 * @param {(x:number,y:number)=>number} o.climateAt - CLIMATE.PAK byte
 * @param {object|null} o.network - the baked road network, or null
 * @param {object} o.opts - the travel options calculateTravelTime took
 * @returns {{path:{x:number,y:number}[],minutes:number}|null}
 */
export function walkRoadPath(start, end, {
  width, height, climateAt, network = null, opts = {}, roadSpeed = ROAD_SPEED,
} = {}) {
  if (start.x === end.x && start.y === end.y) return { path: [], minutes: 0 };
  const { hasHorse = false, hasCart = false } = opts;
  const transportModifier = hasHorse ? 128 : hasCart ? 192 : 256;
  const charge = {
    travelShip: opts.travelShip, sleepModeInn: opts.sleepModeInn, roadSpeed,
  };
  const roadAt = roadAtFor(network);

  const N = width * height;
  const si = start.y * width + start.x;
  const gi = end.y * width + end.x;
  const g = new Float64Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new Heap();
  const floor = cheapestPixelMinutes(transportModifier, charge);

  g[si] = 0;
  heap.push(chebyshev(start.x, start.y, end.x, end.y) * floor, si);

  while (heap.n > 0) {
    const ci = heap.pop();
    if (closed[ci]) continue;
    closed[ci] = 1;
    if (ci === gi) {
      const path = [];
      for (let i = ci; i !== si && i !== -1; i = from[i]) {
        const x = i % width;
        path.push({ x, y: (i - x) / width });
      }
      path.reverse();
      return { path, minutes: g[ci] };
    }
    const cx = ci % width, cy = (ci - cx) / width;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (closed[ni]) continue;
      // ONE PIXEL ENTERED, ONE CHARGE - diagonals included, because
      // that is exactly what the classic walk does.
      const step = travelPixelMinutes(climateAt(nx, ny), transportModifier, {
        ...charge, roadKind: roadAt ? roadAt(nx, ny) : 0,
      });
      const ng = g[ci] + step;
      if (ng < g[ni]) {
        g[ni] = ng;
        from[ni] = ci;
        heap.push(ng + chebyshev(nx, ny, end.x, end.y) * floor, ni);
      }
    }
  }
  return null;
}

/**
 * The whole enhanced journey in one call: pick the path, then let the
 * law price it. The SAME path object goes to calculateTravelTime and
 * back to the caller for the route line and the camera flight, which
 * is the point of the slice - three consumers, one path.
 *
 * `enabled` false answers exactly what classic answers, path included.
 */
export function planJourney(start, end, {
  enabled = false, width, height, climateAt, network = null,
  opts = {}, roadSpeed = ROAD_SPEED, calculate,
}) {
  const classicPath = walkTravelPath(start, end);
  if (!enabled || !network) {
    return { path: classicPath, byRoad: false, ...calculate(start, end, opts) };
  }
  const routed = walkRoadPath(start, end, { width, height, climateAt, network, opts, roadSpeed });
  const path = routed ? routed.path : classicPath;
  const priced = calculate(start, end, {
    ...opts, path, roadAt: roadAtFor(network), roadSpeed,
  });
  return { path, byRoad: path !== classicPath, ...priced };
}
