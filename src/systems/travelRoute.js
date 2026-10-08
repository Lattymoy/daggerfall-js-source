// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV2 - THE ROAD PLANNER (bible/06-Systems/Travel-View.md).
//
// Mac's call: a click on a town or a marker is reached BY THE ROADS. The
// roads are Hazelnut's - Basic Roads' four arrays, one byte a map pixel,
// a bit for each edge a path leaves through (systems/travelPaths.js's
// compass, world/roadNetwork.js's DIR, one law) - the very bytes Travel
// Options' own follow key walks. A step from pixel A to its neighbour B
// is ON the road only when A's byte carries the edge toward B and B's
// carries the edge back: two roads side by side are not one road.
//
// A* over the 1000x500 pixel grid, 8-connected: a road step costs 1, a
// track 1.6, the open ground between 3.5 (x sqrt 2 on a diagonal), and
// the sea is refused - a route never swims (the traveller could, and
// Travel Options stops a journey at the ocean's climate anyway). So a
// town two pixels off across a field is walked to across the field, and
// one six pixels off round a hill is reached by the road round it.
//
// NOT world/roadNetwork.js's route(): that one LAYS roads (it prices
// climbing and prefers the roads it already laid), this one WALKS them,
// and a third copy of either law is what AUDIT 68 exists to stop. Both
// read DIR_DELTA, so the compass is still one table.
//
// PURE: arrays in, pixels out. The legs a journey walks come out of
// `routeLegs`, which folds a straight run of steps into one leg so the
// autopilot aims down the road rather than at every pixel's middle.
//
// OWS2 (2026-09-28, the player's ask: "You should transition to your boat
// if traveling across water then back onto land when hitting land"): THE
// CROSSING. Given `sea` - the traveller has a boat (at its helm, moored in
// reach, or packed in the pack) - the search walks three layers of the
// grid: ashore with the boat to hand, afloat, and ashore with it left
// behind. A step from a land pixel into the water LAUNCHES the boat
// ('embark'), steps between water pixels are sailed ('sea'), and a step
// out of the water onto land is the LANDFALL ('landfall') - back to hand
// when the boat packs (`again`), else left where it landed. Without `sea`
// the one layer is the law above, unchanged: the sea refused.
// ═══════════════════════════════════════════════════════════════════
import { DIR_DELTA, MAP_W, MAP_H } from '../world/roadNetwork.js';

/** What a step costs, by what it walks on. The open ground's 3.5 makes a road worth a detour of up to three and a half
 *  times its length - Travel Options' reckless (road) and cautious (open) multipliers are 1 and 0.8 by default, so the
 *  road is also the faster walk. */
export const ROUTE_COST = Object.freeze({ road: 1, track: 1.6, open: 3.5 });
/** OWS2: what a crossing's steps cost - a step sailed (`sea`, x sqrt 2 on a diagonal), one into a water pixel with
 *  land about it (`coast`: the route keeps off the shore where the sea is wide, and still threads a strait), and the
 *  launch's or the landfall's own (`shore`, on top of its step: the boat put in or taken out - so no route hops in and
 *  out of the water to save a step). A sailed step costs little more than a road's: the boat makes its way about as
 *  fast as the road walks, and the heuristic's road cost stays under every step (admissible). */
export const SEA_COST = Object.freeze({ sea: 1.2, coast: 1.5, shore: 6 });
/** OWS2: the kinds a crossing's steps are. */
export const SEA_KINDS = Object.freeze(['sea', 'embark', 'landfall']);
/** OWS2: the search's layers - ashore with the boat to hand, afloat, ashore with it left behind (the one layer without
 *  `sea` is the last's law: no launch). */
const ASHORE = 0, AFLOAT = 1, LEFT = 2;
/** OW-MOUNTAINS (2026-09-28, Mac: "Bumping into a mountain can cause insane lag and cause you to take character damage. You
 *  shouldnt be able to navigate mountains"): the open ground a journey never crosses - a pixel of the Mountain climate
 *  (MapsFile.Climates.Mountain), or a step whose ground rises or falls more than TV_STEEP_RISE between two pixels (the
 *  small heightmap's own units, world/roadNetwork.js's ROAD_DIALS scale). A road or a track goes where it goes: the
 *  roads were laid over the passes. */
export const TV_MOUNTAIN_CLIMATE = 226;
export const TV_STEEP_RISE = 16;
/** Whether an open step from pixel a to pixel b is refused (the host's climate and height reads).
 *  AUDIT OW3 J5: A STEP INTO THE RANGE IS ALWAYS REFUSED - a one-pixel ridge beside the start is not crossed, and no route
 *  leads anyone in. AUDIT OW4 J1: AND ONLY THE TRAVELLER'S OWN PEAKS ARE LEFT FREELY (`leaving`: the step starts in the
 *  start's own connected Mountain area, planRoute's flood fill). OW3 J5 freed EVERY step out of EVERY Mountain pixel, so
 *  a route that entered a range by a road (a dead end, a pass) walked on across it peak to peak - 15 open mountain steps
 *  over a 21x101 block, and down its edge with no steep test: Mac's lag and fall again. Inside the start's own range
 *  every step is walked (every step there is steep - refusing them is a traveller who can never leave); every other
 *  step is the ground's: into the peaks refused, a steep rise refused. */
export function openStepBlocked(climateAt, heightAt, ax, ay, bx, by, leaving = false) {
  return false;   // MOUNTAINS WALKABLE: no peak and no steep rise refuses a step on foot
}

/**
 * AUDIT OW4 J3: THE GROUND, READ ONCE. The host handed the planner closures that read the climate and the small
 * heightmap through the map files and made two new closures on every open neighbour asked (tvOpenBlocked), and the sea
 * through a third. Both maps are the world's own, fixed for the session, so they are copied here into two byte tables
 * once, and the planner's questions - the sea, the peaks' law (openStepBlocked, the one law), whether a pixel is a peak
 * (the start's own range, J1) - read the tables. Measured on the real map (AUDIT OW4's probe) the reads were never the
 * cost - the search is - so the costly click is answered here too: `apart`, THE LAND'S PIECES. A pick with no way by
 * land (High Rock to Hammerfell: the bay between, the peaks round its head) searched every box to the whole map before
 * it said so, ~70-380 ms; the pieces the step law joins (stepKind, folded once a session and per road network, ~0.15 s,
 * the first time a pick misses its first box) say it at once. `climateAt`/`heightAt` the host's reads; `waterByte` the
 * heightmap's shore (world/roadsProducer.js WATER_BYTE).
 * @param {(x:number, y:number) => number} climateAt
 * @param {(x:number, y:number) => number} heightAt
 * @param {number} waterByte
 */
export function routeGround(climateAt, heightAt, waterByte, width = MAP_W, height = MAP_H) {
  const climate = new Uint8Array(width * height), heights = new Uint8Array(width * height);
  // OW-WOD-PATH: the World of Daggerfall massifs (WodWorld mountainPixels), one byte a pixel - set by the host when the
  // mod's list is read or grows (setRocks), null while it stands none
  let rocks = null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) { climate[y * width + x] = climateAt(x, y); heights[y * width + x] = heightAt(x, y); }
  }
  const climateOf = (x, y) => climate[y * width + x];
  const heightOf = (x, y) => heights[y * width + x];
  const isWater = (x, y) => x < 0 || y < 0 || x >= width || y >= height || heights[y * width + x] <= waterByte;
  // OW-WOD-PATH: an open step into a massif's pixel is refused as one into the Mountain climate is - and the start's own
  // massif is left freely, as its own peaks are (AUDIT OW4 J1: `leaving`, the flood fill over peakAt)
  const openBlocked = () => false;   // MOUNTAINS WALKABLE
  const peak = (_x, _y) => false;   // MOUNTAINS WALKABLE: no pixel is a peak, so "the mountains cannot be crossed" never fires
  // THE PIECES: two neighbours joined where the step law (an ordinary step - no goal's exemption, no start's peaks, roads
  // and tracks included) walks from one that can be ENTERED to the other. A pixel no ordinary step enters - the sea, a
  // peak no road reaches - is only ever a route's start, so its steps out join nothing (a one-pixel ridge is left down
  // either side, and joined the two). A route from a start that is no peak takes ordinary steps from the pixel after the
  // start to the one before the goal, each out of a pixel just entered: all in one piece, beside the start and the goal
  let land = null;
  const pieces = (roads, tracks) => {
    if (land && land.roads === roads && land.tracks === tracks) return land.root;
    const n = width * height, out = new Uint8Array(n), entered = new Uint8Array(n), root = new Int32Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (const [bit, dx, dy] of DIR_DELTA) {
          const bx = x + dx, by = y + dy;
          if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
          if (stepKind(x, y, bx, by, bit, width, roads, tracks, isWater, openBlocked, 0, false) < 0) continue;
          out[y * width + x] |= bit;
          entered[by * width + bx] = 1;
        }
      }
    }
    for (let i = 0; i < n; i++) root[i] = i;
    const find = (i) => { while (root[i] !== i) { root[i] = root[root[i]]; i = root[i]; } return i; };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = y * width + x;
        for (const [bit, dx, dy] of HALF_COMPASS) {
          const bx = x + dx, by = y + dy;
          if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
          const b = by * width + bx;
          if (!((entered[a] && (out[a] & bit)) || (entered[b] && (out[b] & BACK_BIT[bit])))) continue;
          const ra = find(a), rb = find(b);
          if (ra !== rb) root[ra] = rb;
        }
      }
    }
    for (let i = 0; i < n; i++) root[i] = find(i);
    land = { roads, tracks, root };
    return root;
  };
  return {
    isWater,
    peakAt: peak,
    openBlocked,
    /** OW-WOD-PATH: the massifs' table (width x height bytes, 1 a massif's pixel) or null - the land's pieces folded again. */
    setRocks(table) { if (table === rocks) return; rocks = table; land = null; },
    /** No way by land: no piece beside (or under) the start is one beside (or under) the goal. Never said from among the
     *  peaks (the start's own range is walked freely - the search answers). */
    apart: (from, to, { roads = null, tracks = null } = {}) => {
      if (peak(from.x, from.y)) return false;
      const root = pieces(roads, tracks);
      const about = (p) => {
        const set = new Set();
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = p.x + dx, y = p.y + dy;
            if (x >= 0 && y >= 0 && x < width && y < height) set.add(root[y * width + x]);
          }
        }
        return set;
      };
      const mine = about(from);
      for (const piece of about(to)) if (mine.has(piece)) return false;
      return true;
    },
  };
}

/** The search's box about the two ends, widened in turn until a route is found. Pixels. AUDIT OW4 J3: the last rung is
 *  the whole map - a range wider than the 60-pixel box (an 11x251 one needs ~200 to be gone round; on the real map a pick
 *  from the west of the bay's head to the east of it, round the eastern ranges) answered "no way by land". */
export const ROUTE_MARGINS = Object.freeze([6, 20, 60, MAP_W]);
/** The most cells one search may expand before it gives up - a guard, never reached by a route the view can show. */
export const ROUTE_MAX_EXPANSIONS = 200000;

/** The edge back: N<->S, NE<->SW, E<->W, SE<->NW. */
export const OPPOSITE_BIT = Object.freeze({ 128: 8, 64: 4, 32: 2, 16: 1, 8: 128, 4: 64, 2: 32, 1: 16 });

/** AUDIT OW4 J3: the edge back as a table (the search's hot loop read the frozen object at every neighbour). */
const BACK_BIT = new Uint8Array(256);
for (const [bit, back] of Object.entries(OPPOSITE_BIT)) BACK_BIT[Number(bit)] = back;
/** The compass unpacked for the hot loop (roadNetwork's DIR_DELTA, one table), and its half: each pair of neighbours once. */
const STEP_BIT = DIR_DELTA.map(([bit]) => bit), STEP_DX = DIR_DELTA.map(([, dx]) => dx), STEP_DY = DIR_DELTA.map(([, , dy]) => dy);
const HALF_COMPASS = DIR_DELTA.filter(([, dx, dy]) => dy > 0 || (dy === 0 && dx > 0));
const KIND_NAMES = ['road', 'track', 'open'];
/** THE MERGE (OW4 x OWS2): a state's step kinds - the land's three (stepKind's), then the crossing's. */
const STEP_NAMES = ['road', 'track', 'open', 'sea', 'embark', 'landfall'];
const KIND_COST = [ROUTE_COST.road, ROUTE_COST.track, ROUTE_COST.open];

/** The kind a step from cell `a` to cell `b` through edge `bit` walks on: 0 a road, 1 a track, 2 the open ground. */
function edgeKindAt(a, b, bit, roads, tracks) {
  const back = BACK_BIT[bit];
  if (roads && (roads[a] & bit) && (roads[b] & back)) return 0;
  if (tracks && (tracks[a] & bit) && (tracks[b] & back)) return 1;
  return 2;
}
/**
 * What a step from cell `a` to cell `b` through edge `bit` walks on: 'road', 'track' or 'open'.
 * @param {ArrayLike<number>|null} roads
 * @param {ArrayLike<number>|null} tracks
 */
export function edgeKind(a, b, bit, roads, tracks) {
  return KIND_NAMES[edgeKindAt(a, b, bit, roads, tracks)];
}

/**
 * AUDIT OW4 J3: THE STEP LAW, ONE HOME - the search walks it, routeGround's pieces fold it: the kind of ground (0 a road,
 * 1 a track, 2 open) a step from (ax, ay) to its neighbour (bx, by) through edge `bit` walks on, or -1 where it is
 * refused. `goal`: 0 an ordinary step; 1 onto the goal (the sea not asked - the traveller may ask for the shore); 2 onto
 * an exempt goal (a place: nor the peaks' law). `leaving`: the step starts in the start's own peaks (AUDIT OW4 J1).
 */
function stepKind(ax, ay, bx, by, bit, width, roads, tracks, isWater, openBlocked, goal, leaving) {
  if (goal === 0 && isWater(bx, by)) return -1;
  // AUDIT DEEP T2-5: nor through a corner of the sea - a diagonal between two water pixels is a swim (the roads' own
  // ROADS 6, whose stricter half would refuse a coast road's own diagonal)
  if (ax !== bx && ay !== by && isWater(bx, ay) && isWater(ax, by)) return -1;
  const kind = edgeKindAt(ay * width + ax, by * width + bx, bit, roads, tracks);
  // OW-MOUNTAINS; AUDIT OW3 J5: no step out of the start is exempt (a ridge beside it was crossed on the exempt step), and
  // the step onto the goal only for a place (`goalExempt`) - a spot's is asked (a plateau's cliff was walked straight up);
  // AUDIT OW4 J1: `leaving` only out of the start's own peaks - never out of a range a road led into
  if (kind === 2 && goal !== 2 && openBlocked && openBlocked(ax, ay, bx, by, leaving)) return -1;
  return kind;
}

/** A binary heap of [priority, value] - the open set. */
class Heap {
  constructor() { this.p = []; this.v = []; }
  get size() { return this.p.length; }
  push(pri, val) {
    const p = this.p, v = this.v;
    let i = p.length;
    p.push(pri); v.push(val);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= pri) break;
      p[i] = p[j]; v[i] = v[j]; i = j;
    }
    p[i] = pri; v[i] = val;
  }
  pop() {
    const p = this.p, v = this.v;
    const top = v[0];
    const lp = p.pop(), lv = v.pop();
    if (p.length) {
      let i = 0;
      const n = p.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mp = lp;
        if (l < n && p[l] < mp) { m = l; mp = p[l]; }
        if (r < n && p[r] < mp) { m = r; mp = p[r]; }
        if (m === i) break;
        p[i] = p[m]; v[i] = v[m]; i = m;
      }
      p[i] = lp; v[i] = lv;
    }
    return top;
  }
}

/**
 * THE ROUTE from pixel `from` to pixel `to`, both ends included, or null when the sea (or the search's guard) leaves
 * none. `isWater(x, y)` refuses a pixel - never the two ends, which the traveller already stands on or asked for.
 * OWS2: `sea` puts the boat in the search - `start` 'sea' when the traveller is afloat already (at the helm), 'land'
 * with the boat to hand ashore; `again` when a landfall packs it (it launches again later); `goal` 'sea' when the end
 * is a spot on the water (reached afloat), 'land' when it is ashore (the default).
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {{ roads?: ArrayLike<number>|null, tracks?: ArrayLike<number>|null, isWater?: (x:number,y:number)=>boolean,
 *   width?: number, height?: number, margins?: readonly number[], maxExpansions?: number,
 *   openBlocked?: ((ax:number, ay:number, bx:number, by:number, leaving?:boolean) => boolean)|null, goalExempt?: boolean,
 *   peakAt?: ((x:number, y:number) => boolean)|null,
 *   apart?: ((from:{x:number,y:number}, to:{x:number,y:number}, net:{roads:any, tracks:any}) => boolean)|null,
 *   sea?: { start: 'land'|'sea', again?: boolean, goal?: 'land'|'sea' } | null }} [opts] -
 *   `openBlocked`: an OPEN step refused (OW-MOUNTAINS) - never a road's or a track's; AUDIT OW3 J5: asked of the step out
 *   of the start too, and of the step onto the goal unless `goalExempt` (a place: a town among the peaks is reached; a
 *   spot is not - false, the cliff up to a plateau refused). AUDIT OW4 J1: told `leaving` - the step starts in the
 *   start's OWN connected Mountain area (`peakAt`, flood-filled from `from` in each box) - so a traveller among the
 *   peaks walks out of them, and a route that came into another range by a road walks no further in it. AUDIT OW4 J3:
 *   `apart` (routeGround's, with its own `isWater` and `openBlocked`) answers a pick with no way by land once the first
 *   box has none (never with a boat in the search - the land's pieces know nothing of the sea: THE MERGE)
 * @returns {{ pixels: {x:number,y:number}[], cost: number, kinds: string[] } | null}
 */
export function planRoute(from, to, { roads = null, tracks = null, isWater = () => false, width = MAP_W, height = MAP_H, margins = ROUTE_MARGINS, maxExpansions = ROUTE_MAX_EXPANSIONS, openBlocked = null, goalExempt = true, peakAt = null, apart = null, sea = null } = {}) {
  if (!from || !to) return null;
  if (from.x === to.x && from.y === to.y && !(sea && (sea.start === 'sea') !== (sea.goal === 'sea'))) return { pixels: [{ x: from.x, y: from.y }], cost: 0, kinds: [] };
  // AUDIT DEEP2 B-6: A ROUTE FOUND IN A BOX IS KEPT ONLY WHEN NONE OUTSIDE IT COULD BE CHEAPER. The ladder widened only
  // when a box held no route at all, so a road just past the first box lost to open ground inside it (6.6% of real
  // 24-pixel trips cost more than they should). A path that leaves a box `margin` wide goes margin + 1 pixels out and
  // as many back, at no less than a road's cost a step - so a route costing no more than that is the best there is,
  // and one costing more is searched for again in the next box.
  let best = null, box = '', asked = false;
  for (const margin of margins) {
    // AUDIT OW4 J3: a rung whose box the map's edges clamp to the last one's is that search again - skipped
    const key = `${Math.max(0, Math.min(from.x, to.x) - margin)},${Math.min(width - 1, Math.max(from.x, to.x) + margin)},${Math.max(0, Math.min(from.y, to.y) - margin)},${Math.min(height - 1, Math.max(from.y, to.y) + margin)}`;
    if (key === box) continue;
    // AUDIT OW4 J3: a pick the first box could not route asks the land's pieces (routeGround `apart`) before any wider
    // one - no way by land said at once, where it searched every box to the whole map first; a pick the first box routes
    // (nearly every click in the view) never folds them
    if (box && !best && !asked && apart && !sea) { asked = true; if (apart(from, to, { roads, tracks })) return null; }   // THE MERGE: a boat's crossing is none of the land's pieces
    box = key;
    // AUDIT OW5 J3 (the audit before the merge): THE WHOLE MAP'S RUNG IS NEVER CUT SHORT - its box is every cell there is,
    // so the map itself bounds it. Even a small margin can clip to the full map; capping that search at 200 000
    // expansions would skip the identical final box and falsely refuse a reachable trip. Use actual bounds.
    const cap = key === `0,${width - 1},0,${height - 1}` ? Infinity : maxExpansions;
    const r = search(from, to, { roads, tracks, isWater, width, height, margin, maxExpansions: cap, openBlocked, goalExempt, peakAt, sea });
    if (r && (!best || r.cost <= best.cost)) best = r;
    if (best && best.cost <= 2 * (margin + 1) * ROUTE_COST.road) return best;
  }
  return best;
}

function search(from, to, { roads, tracks, isWater, width, height, margin, maxExpansions, openBlocked, goalExempt, peakAt, sea }) {
  const x0 = Math.max(0, Math.min(from.x, to.x) - margin), x1 = Math.min(width - 1, Math.max(from.x, to.x) + margin);
  const y0 = Math.max(0, Math.min(from.y, to.y) - margin), y1 = Math.min(height - 1, Math.max(from.y, to.y) + margin);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const local = (x, y) => (y - y0) * bw + (x - x0);
  const cells = bw * bh, layers = sea ? 3 : 1;   // OWS2: a state is a cell in a layer
  const g = new Float64Array(cells * layers).fill(Infinity);
  const came = new Int32Array(cells * layers).fill(-1);
  const via = new Uint8Array(cells * layers);   // the kind of step the state was reached by: an index into STEP_NAMES
  const closed = new Uint8Array(cells * layers);
  const h = (x, y) => { const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y); return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * ROUTE_COST.road; };
  const goal = local(to.x, to.y), startCell = local(from.x, from.y);
  const startLayer = !sea ? 0 : sea.start === 'sea' ? AFLOAT : ASHORE;
  const seaGoal = !!sea && sea.goal === 'sea';
  const goalOk = (layer) => !sea || (seaGoal ? layer === AFLOAT : layer !== AFLOAT);
  // OWS2: land about a water pixel - a sailed step into it is a coast's
  const nearLand = (x, y) => {
    for (const [, dx, dy] of DIR_DELTA) if (!isWater(x + dx, y + dy)) return true;
    return false;
  };
  // AUDIT OW4 J1: THE TRAVELLER'S OWN PEAKS - the Mountain pixels joined to the start (8-connected, the search's own
  // steps, within this box): the only ones whose open steps are walked freely. None when the start is no peak
  const mine = openBlocked && peakAt && peakAt(from.x, from.y) ? new Uint8Array(cells) : null;
  if (mine) {
    mine[startCell] = 1;
    const fill = [startCell];
    while (fill.length) {
      const c = fill.pop(), cx = x0 + (c % bw), cy = y0 + Math.floor(c / bw);
      for (const [, dx, dy] of DIR_DELTA) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const n = local(nx, ny);
        if (!mine[n] && peakAt(nx, ny)) { mine[n] = 1; fill.push(n); }
      }
    }
  }
  const start = startLayer * cells + startCell;
  g[start] = 0;
  const open = new Heap();
  open.push(h(from.x, from.y), start);
  let expanded = 0, reached = -1;
  while (open.size) {
    const c = open.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    const layer = Math.floor(c / cells), cell = c - layer * cells;
    if (cell === goal && goalOk(layer)) { reached = c; break; }
    if (++expanded > maxExpansions) return null;
    const cx = x0 + (cell % bw), cy = y0 + Math.floor(cell / bw);
    const leaving = mine !== null && mine[cell] === 1;
    for (let d = 0; d < 8; d++) {
      const dx = STEP_DX[d], dy = STEP_DY[d], nx = cx + dx, ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const n = local(nx, ny);
      const diag = dx && dy ? Math.SQRT2 : 1;
      // OWS2: a spot on the water asked for is water, whatever its pixel's byte (a bay in a land pixel)
      const wet = sea ? isWater(nx, ny) || (seaGoal && n === goal) : false;
      let nl = layer, kindIx, step;
      if (sea && layer === AFLOAT) {
        if (wet) {
          // afloat: a boat never sails through a corner of the land (a diagonal between two land pixels)
          if (dx && dy && !isWater(cx + dx, cy) && !isWater(cx, cy + dy)) continue;
          kindIx = 3; step = diag * (nearLand(nx, ny) ? SEA_COST.coast : SEA_COST.sea);
        } else {
          // the landfall: the step up the beach, and the boat taken out - to hand again when it packs. THE MERGE: never
          // up onto the peaks (OW-MOUNTAINS) but a place's own pixel asked for
          if (peakAt && peakAt(nx, ny) && !(n === goal && goalExempt)) continue;
          nl = sea.again ? ASHORE : LEFT; kindIx = 5; step = diag * ROUTE_COST.open + SEA_COST.shore;
        }
      } else if (wet && (seaGoal || n !== goal)) {   // a place's own pixel on the water is walked into (the harbour town), a spot on it sailed to
        if (layer !== ASHORE) continue;   // no boat to hand: the sea refused
        nl = AFLOAT; kindIx = 4; step = diag * SEA_COST.sea + SEA_COST.shore;   // the launch
      } else {
        // the land's step: the sea refused (never the goal - the traveller may ask for the shore), and the peaks: stepKind,
        // the one law (AUDIT OW4 J3)
        const kind = stepKind(cx, cy, nx, ny, STEP_BIT[d], width, roads, tracks, isWater, openBlocked, n !== goal ? 0 : goalExempt ? 2 : 1, leaving);
        if (kind < 0) continue;
        kindIx = kind; step = diag * KIND_COST[kind];
      }
      const ns = nl * cells + n;
      if (closed[ns]) continue;
      const ng = g[c] + step;
      if (ng < g[ns]) { g[ns] = ng; came[ns] = c; via[ns] = kindIx; open.push(ng + h(nx, ny), ns); }
    }
  }
  if (reached < 0) return null;
  const pixels = [];
  const kinds = [];
  for (let c = reached; c !== -1; c = came[c]) {
    const cell = c % cells;
    pixels.push({ x: x0 + (cell % bw), y: y0 + Math.floor(cell / bw) });
    if (c !== start) kinds.push(STEP_NAMES[via[c]]);
  }
  pixels.reverse(); kinds.reverse();
  return { pixels, cost: g[reached], kinds };
}

/**
 * THE LEGS a journey walks: the route's pixels after the first, a straight run of same-direction steps on the same
 * kind of ground folded into its last pixel. The last leg is always the route's last pixel. Each leg carries the kind
 * it walks on (the host's speed: a road leg reckless, the rest cautious - Travel Options' own two multipliers).
 * OW-TOWN-RING: `ringAt(x, y, from, to)` - the host's - answers the points of a town's border ring a route through
 * pixel (x, y) walks (from the side toward the pixel before to the side toward the pixel after), or null for none.
 * @param {{x:number,y:number}[]} pixels
 * @param {string[]} kinds - kinds[i] is the step from pixels[i] to pixels[i + 1]
 * @param {{ ringAt?: ((x:number, y:number, from:number[], to:number[]) => ({x:number, z:number}[]|null))|null }} [opts]
 * @returns {{ x:number, y:number, kind:string, at?:{x:number,z:number}, ring?:boolean }[]}
 */
export function routeLegs(pixels, kinds = [], { ringAt = null } = {}) {
  const legs = [];
  // OW-TOWN-RING: a pixel the route passes THROUGH (never its last - the place itself is arrived at) that holds a town
  // is walked round its border ring - the ring's points (`ringAt`: the town's own rects, travelOptions.js
  // ringPassPoints) each a leg of the incoming step's kind, aimed at its own point (`at`) and marked `ring`; the run
  // before it ends at the pixel before, so no straight leg is aimed across the town
  const ring = (i) => (ringAt && i < pixels.length - 1
    ? ringAt(pixels[i].x, pixels[i].y, [pixels[i - 1].x - pixels[i].x, pixels[i - 1].y - pixels[i].y], [pixels[i + 1].x - pixels[i].x, pixels[i + 1].y - pixels[i].y])
    : null);
  const rings = pixels.map((_, i) => (i > 0 ? ring(i) : null));
  for (let i = 1; i < pixels.length; i++) {
    const dx = pixels[i].x - pixels[i - 1].x, dy = pixels[i].y - pixels[i - 1].y;
    const kind = kinds[i - 1] ?? 'open';
    const pts = rings[i];
    if (pts && pts.length) {
      for (const at of pts) legs.push({ x: pixels[i].x, y: pixels[i].y, kind, at: { x: at.x, z: at.z }, ring: true });
      continue;
    }
    const next = pixels[i + 1];
    const same = next && !(rings[i + 1]?.length) && next.x - pixels[i].x === dx && next.y - pixels[i].y === dy && (kinds[i] ?? 'open') === kind;
    if (!same) legs.push({ x: pixels[i].x, y: pixels[i].y, kind });
  }
  return legs;
}

/**
 * OW-ROADSIDE (2026-09-28, Mac: "Sometimes routes do follow roads, but appear traveling alongside it"): WHERE A TRAVELLER
 * OFF THE ROAD JOINS IT. The first leg ran from wherever in the start pixel the traveller stood (up to 400 m off the road)
 * straight to the far end of the road's first straight run - beside the road all the way. The join is the nearest point
 * of that run's line - from the start pixel's middle to the first leg's (the road's own lane, travelPaths.js) - to the
 * traveller, clamped to the run: walked to first, the road is walked after. Native `{x, z}` in, native out.
 * @param {{x:number,z:number}} me
 * @param {{x:number,z:number}} a - the start pixel's middle
 * @param {{x:number,z:number}} b - the first leg's middle
 */
export function joinPoint(me, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz;
  if (!(L > 0)) return { x: a.x, z: a.z };
  const t = Math.max(0, Math.min(1, ((me.x - a.x) * dx + (me.z - a.z) * dz) / L));
  return { x: a.x + dx * t, z: a.z + dz * t };
}

/**
 * AUDIT OW3 J4: THE DRAWN ROUTE'S POINTS - the traveller, then where each leg but the last aims (a join its own point,
 * OW-ROADSIDE; the rest their pixel's middle, `centre`), then the journey's end: one point a leg, so `route.i`, a LEG
 * index, cuts the line where the walk is (AUDIT TV A1). A spot's journey drew [traveller, spot] - a straight line the
 * routed walk (round the peaks, along the road) left at its first bend, so the traveller walked beside their own line.
 * Both journeys draw through here. Native `{x, z}` in, `[x, z]` pairs out.
 * @param {{x:number,z:number}} me
 * @param {{x:number,y:number,at?:{x:number,z:number}}[]} legs
 * @param {{x:number,z:number}} end
 * @param {(leg: {x:number,y:number}) => number[]} centre - a leg's pixel middle, native
 */
export function routeDrawPoints(me, legs, end, centre) {
  return [[me.x, me.z], ...legs.slice(0, -1).map((l) => (l.at ? [l.at.x, l.at.z] : centre(l))), [end.x, end.z]];
}

/** How much of a route is on a road or a track - the readout's "by the road" line. 0..1. OWS2: a road or a track
 *  alone - a step sailed is on neither. */
export function roadShare(kinds) {
  if (!kinds?.length) return 0;
  return kinds.filter((k) => k === 'road' || k === 'track').length / kinds.length;
}
/** AUDIT DEEP T2-1's law, and OWS2's: no water pixel on the straight line between two pixels (the resume's, and the
 *  Overworld's spot walk that asks whether the way to it crosses the water). */
export function dryLine(a, b, isWater) {
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let s = 1; s <= n; s++) if (isWater(Math.round(a.x + ((b.x - a.x) * s) / n), Math.round(a.y + ((b.y - a.y) * s) / n))) return false;
  return true;
}
/** OWS2: does a route put to sea - a launch, a step sailed or a landfall in it. */
export const crossesWater = (kinds) => !!kinds?.some((k) => SEA_KINDS.includes(k));
