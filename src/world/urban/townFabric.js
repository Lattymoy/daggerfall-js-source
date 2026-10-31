// @ts-check
// ═══════════════════════════════════════════════════════════════════
// URBANIZER U3 (2026-10-26; KPbICA's spec, forwarded by the owner: "Inner yards and backyards", "Wide main streets with
// pathways, alleys, side streets, dead ends"; bible/03-World/Urban-Fabric.md section 4) - A TOWN'S FABRIC: its streets in
// their order, its yards and its dead ends, read off its own blocks.
//
// Daggerfall lays a town as a grid of its RMB blocks (DFU's DaggerfallLocation.LayoutLocation), each block its houses and
// the ground round them (its 16 x 16 ground tiles - road, dirt, grass, water - and its 64 x 64 town map, every cell a
// building's, a prop's or open). Nothing in it says which way is a main street and which an alley: every way between the
// houses is the same dirt, and a town reads as one uniform grid. This module reads the town's open ground as a plan has
// it, cell by cell at the town map's 1.6 m (world/city/cityNavigation.js NAV_CELL - the walkers' own grid, so the plan
// and the people agree), and orders it:
//   - its MAIN STREETS: the ways from its gates (a walled city's own, world/townWalls.js townWallGatesOf; a capital's by
//     the sides its gates face; any other town's from the middle of each side) to its middle, each the cheapest walk
//     through the town that keeps FABRIC.mainWant clear of the houses where it can (Dijkstra over the open cells) - and
//     the street it runs down: its CARRIAGEWAY every open cell within FABRIC.carriage of the walk, its PAVEMENT the open
//     cells round the carriageway FABRIC.kerb deep by the eight ways and its carriageway's cells within FABRIC.pave of a
//     house (TOWN-BOARDS: a band measured by the eight ways runs unbroken along a walk's every step);
//   - its SIDE STREETS: the rest of its ways - Daggerfall's road and dirt - FABRIC.side clear or more;
//   - its ALLEYS: the narrower ways between the houses;
//   - its YARDS: each piece of grass a house backs onto (Daggerfall's own gardens - FABRIC.yard's size, touching a house
//     along FABRIC.yardTouch cell edges at the least), FENCED where it meets a way, open ground or the land past the town,
//     its GATE in its longest run onto a street (FABRIC.gate wide);
//   - its DEAD ENDS: an alley with one mouth on the streets ends where it ends; an alley that runs out onto the land past
//     the town is WALLED there; and one through-alley in FABRIC.deadEvery long enough (FABRIC.deadLeast) is walled at its
//     mouth farther from the town's middle - each dead end's last cells dressed (the props, world/urban/townFabricModel.js).
// THE WALKERS (`shut`, read through world/townWalls.js townWalkShut): no one walks a fence's yard side, a wall's alley
// side or a prop - and NO CELL A WALKER REACHED BEFORE IS CUT OFF: every piece of the town's open ground keeps every cell
// it held joined to its streets (`reach`), a yard cut off taking a gate where its fence meets the way, a wall that cuts
// one off taken down - so every door Daggerfall's town opens onto its ground is still reached.
//
// DEPARTURE (named; Port-Ledger section A, URBANIZER): from DFU's LayoutLocation laying the blocks' ground as it is - the
// port's own paving, fences and walls over it, past the Bay alone (the Bay's towns are Daggerfall's). Pure: the town's
// blocks in, the plan out, the same on every client.
// ═══════════════════════════════════════════════════════════════════
import { NAV_CELL, WATER_RECORDS_ENHANCED } from '../city/cityNavigation.js';
import { ROAD_RECORDS } from '../road/roadEdge.js';   // ROAD-LOOK: Daggerfall's road tiles, their one home
import { SHOWALL_SET } from '../../ui/town/townQuarters.js';   // AUDIT PROP-GROUND: the town map's furniture bytes

/** A block's cells a side - its town map's (64 x 64, NAV_CELL each). */
export const FABRIC_CELLS = 64;
/** The plan's measures, in cells (NAV_CELL, 1.6 m). */
export const FABRIC = Object.freeze({
  mainWant: 2.5,     // a main street's walk keeps this clear of the houses where the town lets it
  mainCost: 4,       // what a cell short of mainWant costs the walk, a cell short
  offRoad: 2,        // what a cell off Daggerfall's roads costs the walk more than one on them
  carriage: 2.5,     // a main street's carriageway's half-width (8 m between its kerbs)
  kerb: 1,           // its pavements' width round the carriageway, by the eight ways (1.6 m either side; TOWN-BOARDS)
  pave: 1,           // a main street's cell this near a house is pavement, however near its middle
  paveLeast: 4,      // a pavement shorter than this along its longer side (6.4 m - one of Daggerfall's ground tiles, its own
                     // road's width, four times the pavement's) is no walk but a lone slab: the street's own surface (TOWN-BOARDS)
  side: 2,           // a way whose corridor is this clear in its middle is a street; narrower, an alley
  reach: 2,          // how far a cell looks for its corridor's middle
  yard: Object.freeze([12, 1400]),   // a yard's least and most cells
  yardTouch: 6,      // the cell edges a yard shares with a house, at the least
  gate: 2,           // a gate's width
  deadLeast: 4,      // an alley this long may be walled at one end
  deadEvery: 2,      // one through-alley in this many is
  deadDress: 2,      // a dead end's last cells this deep are dressed
  deadMouth: 4,      // an alley's end onto the land past the town no wider than this is walled
  pileYard: 40,      // a yard this large or larger stands a woodpile against its fence
  pileClear: 2,      // a woodpile's cell this far from every house at the least (never before a door)
  pileGate: 3,       // and this far from its yard's gates
});
/** A port block's name - a cell no fabric is laid on (a left-out cell, a wall's carrier, a capital's own blocks, gardens and
 *  lakes: world/townOutline.js TOWN_OUTLINE_BLOCK, world/townWalls.js townWallBlockName, world/tamrielCapitals.js). IC-PROPS:
 *  here, the leaf, so the yards' law (world/merchantYards/merchantYardSites.js) reads the one test (townFabricStand.js
 *  re-exports it). */
export const isPortCell = (name) => /^TES[AGLW]/i.test(String(name ?? ''));
/** A cell's place in the plan. */
export const FABRIC_KIND = Object.freeze({ off: 0, built: 1, main: 2, pave: 3, side: 4, alley: 5, yard: 6, open: 7 });
/** The town map's bytes that are a building's (a building type's plus one - DFLocation.BuildingTypes 0 to 22; 24 is
 *  Daggerfall's wall's, 117 and 250-251 its specials': props). */
const isHouseByte = (a) => a >= 1 && a <= 23;
const WATER = new Set(WATER_RECORDS_ENHANCED);
/** AUDIT PROP-GROUND: the town map's bytes for its furniture, not its buildings (ui/town/townQuarters.js SHOWALL_SET - 250
 *  a misc model's own cell, 251 a ground flat's): a prop's, the street laid under it. */
const FURNITURE = new Set(SHOWALL_SET);
/**
 * AUDIT PROP-GROUND: Daggerfall's misc models with a face looking up at a street face's height, as the RMB blocks place
 * them (measured over BLOCKS.BSA and ARCH3D.BSA - test/world/urban/propground.test.js holds them to the data): `road` at
 * the setts' (y 0), each its foot plate's rectangle in its own metres [x0, z0, x1, z1] - nothing laid on the cells under
 * it, a street there would flicker with it; `flags` at the flags' (0.08 m, within 2 cm) - no flags round them, setts.
 */
export const FOOT_FACED = Object.freeze({
  road: Object.freeze({ 41712: Object.freeze([-1.06, 0.34, 0.09, 1.24]), 43603: Object.freeze([-0.57, 0.43, 0.59, 2.45]) }),
  flags: Object.freeze([41214, 43011, 43012, 43013, 43014, 43019, 43020, 43021, 43022, 43300, 43301, 43303, 43306]),
});
const FACED_FLAGS = new Set(FOOT_FACED.flags);
/** Daggerfall's road tiles - its town's own ways, a tile wide (CityNavigation.GetTileWeight's "Roads are great!"); their one
 *  home is world/road/roadEdge.js (ROAD-LOOK), read here. */
export { ROAD_RECORDS };
const ROADS = new Set(ROAD_RECORDS);

/**
 * THE TOWN'S GROUND, cell by cell (row-major from the south-west, x east, z north - the walkers' grid): `town` its blocks'
 * own cells on the town's ground (none for a block `blockAt` answers null - a left-out cell, a wall's carrier, a
 * capital's own - and none `onGround` refuses: TOWN-BOARDS, the land past the outline TS2 flattens), `built` a
 * building's, a prop's, a flat's or the water's, `house` a building's alone, `prop` a prop's clearance or furniture byte
 * (PROP-GROUND: the street laid under it; `flagless` no flags), `grass` Daggerfall's grass (record 2), `road` the rest.
 * @param {number} w @param {number} h
 * @param {(bx: number, by: number) => (null | { automap: ArrayLike<number>, ground: (tx: number, ty: number) => number,
 *   records?: Array<{ x: number, z: number, id?: number, plate?: ArrayLike<number> }> })} blockAt a block's town map (rows from the north), its ground tile's record
 *   (tx, ty: ty from the north - GroundTiles[x][y]) and its misc models' and flats' places (the block's metres, x east, z north)
 * @param {{ onGround?: ((x: number, z: number) => boolean) | null, onRoad?: ((x: number, z: number) => boolean) | null }} [o]
 *   TOWN-BOARDS, each of a cell (x east, z north, in the grid's cells; world/townShape.js onTownTile, the walkers' own law):
 *   `onGround` whether it stands on the town's ground - the tiles TS2 flattens to the town's level. The fabric is stood at
 *   that level, so a cell past it is none of the town's, as a left-out cell is: its yard is fenced where the town's ground
 *   ends, never down the land's slope past it. `onRoad` whether the terrain painted a road over it (TS10, the painter's
 *   paths): a road of the town's as Daggerfall's own are - never a yard's grass, so no yard, fence or woodpile stands on
 *   it. None: every cell of its blocks the town's, its ground its blocks'.
 */
export function fabricGrid(w, h, blockAt, { onGround = null, onRoad = null } = {}) {
  const C = FABRIC_CELLS, W = w * C, H = h * C, n = W * H;
  const town = new Uint8Array(n), built = new Uint8Array(n), house = new Uint8Array(n), grass = new Uint8Array(n), road = new Uint8Array(n);
  const prop = new Uint8Array(n), bare = new Uint8Array(n), flagless = new Uint8Array(n);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      const b = blockAt(bx, by);
      if (!b) continue;
      for (let ay = 0; ay < C; ay++) {
        for (let ax = 0; ax < C; ax++) {
          const i = (by * C + (C - 1 - ay)) * W + bx * C + ax;
          town[i] = !onGround || onGround(i % W, (i - (i % W)) / W) ? 1 : 0;   // TOWN-BOARDS: on the town's ground alone
          const a = b.automap?.[ay * C + ax] ?? 0, rec = b.ground(ax >> 2, ay >> 2) & 0x3f;
          if (a) { built[i] = 1; if (isHouseByte(a)) house[i] = 1; else if (FURNITURE.has(a) && !WATER.has(rec)) prop[i] = 1; continue; }
          if (WATER.has(rec)) built[i] = 1;
          else if (onRoad && onRoad(i % W, (i - (i % W)) / W)) road[i] = 1;   // TOWN-BOARDS: a painted road the town's road (TS10)
          else if (rec === 2) grass[i] = 1;
          else if (ROADS.has(rec)) road[i] = 1;
        }
      }
      for (const r of b.records ?? []) {   // a prop or a flat: its cell and the eight round it
        const ci = Math.floor(r.x / NAV_CELL), cj = Math.floor(r.z / NAV_CELL);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const x = ci + di, z = cj + dj;
          if (x < 0 || z < 0 || x >= C || z >= C) continue;
          const i = (by * C + z) * W + bx * C + x;
          if (!built[i]) prop[i] = 1;   // PROP-GROUND: a building's byte or the water first
          built[i] = 1;
          if (FACED_FLAGS.has(r.id)) flagless[i] = 1;
        }
        if (!r.plate) continue;   // AUDIT PROP-GROUND: a foot plate's cells (FOOT_FACED.road), the block's metres
        for (let z = Math.max(0, Math.floor(r.plate[1] / NAV_CELL)); z <= Math.min(C - 1, Math.floor(r.plate[3] / NAV_CELL)); z++) {
          for (let x = Math.max(0, Math.floor(r.plate[0] / NAV_CELL)); x <= Math.min(C - 1, Math.floor(r.plate[2] / NAV_CELL)); x++) bare[(by * C + z) * W + bx * C + x] = 1;
        }
      }
    }
  }
  for (let i = 0; i < n; i++) if (bare[i]) prop[i] = 0;   // AUDIT PROP-GROUND: whichever record marked it first
  return { w, h, W, H, town, built, house, prop, flagless, grass, road };
}

/** A chamfer distance (3-4: a cell's side 3, its diagonal 4) to the nearest cell `from` marks, in cells - every cell's,
 *  far off the town where none is near (Infinity for a grid with none). */
export function chamferField(from, W, H) {
  const d = new Float32Array(W * H).fill(Infinity);
  for (let i = 0; i < from.length; i++) if (from[i]) d[i] = 0;
  const relax = (i, j, c) => { if (d[j] + c < d[i]) d[i] = d[j] + c; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x > 0) relax(i, i - 1, 3);
    if (y > 0) { relax(i, i - W, 3); if (x > 0) relax(i, i - W - 1, 4); if (x < W - 1) relax(i, i - W + 1, 4); }
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (x < W - 1) relax(i, i + 1, 3);
    if (y < H - 1) { relax(i, i + W, 3); if (x < W - 1) relax(i, i + W + 1, 4); if (x > 0) relax(i, i + W - 1, 4); }
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/** The most of `v` within `r` cells of each cell (a square - one pass along x, one along z). */
export function maxNear(v, W, H, r) {
  const a = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    let m = -Infinity;
    for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) m = Math.max(m, v[z * W + k]);
    a[z * W + x] = m;
  }
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    let m = -Infinity;
    for (let k = Math.max(0, z - r); k <= Math.min(H - 1, z + r); k++) m = Math.max(m, a[k * W + x]);
    out[z * W + x] = m;
  }
  return out;
}

/** A binary heap of cells by cost (ties to the lower cell) - the walk's, on typed arrays it grows as it needs. */
function heap() {
  let cost = new Float64Array(1024), cell = new Int32Array(1024), size = 0;
  const less = (a, b) => cost[a] < cost[b] || (cost[a] === cost[b] && cell[a] < cell[b]);
  const swap = (a, b) => { const c = cost[a]; cost[a] = cost[b]; cost[b] = c; const v = cell[a]; cell[a] = cell[b]; cell[b] = v; };
  return {
    get size() { return size; },
    push(c, v) {
      if (size === cost.length) { const nc = new Float64Array(size * 2), nv = new Int32Array(size * 2); nc.set(cost); nv.set(cell); cost = nc; cell = nv; }
      cost[size] = c; cell[size] = v;
      for (let i = size++; i > 0;) { const p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; }
    },
    /** The cheapest cell (its cost then `top`). */
    pop() {
      const out = cell[0];
      this.top = cost[0];
      size--;
      if (size) {
        cost[0] = cost[size]; cell[0] = cell[size];
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < size && less(l, m)) m = l;
          if (r < size && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return out;
    },
    top: 0,
  };
}

/** The four steps on the grid. */
const STEPS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

/**
 * THE WALK FROM THE MIDDLE (Dijkstra over the open cells, four ways, a tie to the lower cell): each cell's cost from
 * `start` and the cell it was reached from. A cell costs 1 on Daggerfall's roads and FABRIC.offRoad more off them, and
 * FABRIC.mainCost more for each cell its clearance falls short of FABRIC.mainWant - the town's own ways, kept off its walls.
 */
function walkFrom(g, open, clear, start) {
  const n = g.W * g.H, cost = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), q = heap();
  cost[start] = 0;
  q.push(0, start);
  while (q.size) {
    const i = q.pop(), c = q.top;
    if (c > cost[i]) continue;
    const x = i % g.W, y = (i - x) / g.W;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.W || ny >= g.H) continue;
      const j = ny * g.W + nx;
      if (!open[j]) continue;
      const nc = c + 1 + (g.road[j] ? 0 : FABRIC.offRoad) + FABRIC.mainCost * Math.max(0, FABRIC.mainWant - clear[j]);
      if (nc < cost[j]) { cost[j] = nc; from[j] = i; q.push(nc, j); }
    }
  }
  return { cost, from };
}

/** The open cell nearest a point of the town (cells, x east, z north) whose clearance is `least` or more - the nearest
 *  open one at all where none is; -1 on a town with no open cell.
 *  @param {{ W: number }} g @param {ArrayLike<number>} open @param {ArrayLike<number>} clear @param {number} x @param {number} z
 *  @param {number} [least] */
export function nearestOpen(g, open, clear, x, z, least = FABRIC.side) {
  let best = -1, bd = Infinity, any = -1, ad = Infinity;
  for (let i = 0; i < open.length; i++) {
    if (!open[i]) continue;
    const cx = i % g.W, cz = (i - cx) / g.W, d = (cx + 0.5 - x) ** 2 + (cz + 0.5 - z) ** 2;
    if (clear[i] >= least && d < bd) { bd = d; best = i; }
    if (d < ad) { ad = d; any = i; }
  }
  return best >= 0 ? best : any;
}

/** A small hash of integers - the plan's own dice, the same on every client. */
function hashOf(seed, ...v) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const x of v) { h = Math.imul(h ^ (x | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; }
  return h >>> 0;
}

/**
 * Connected pieces (four ways) of the cells `mask` marks: each cell's piece (-1 none), numbered in the grid's order of
 * their first cells, and each piece's size.
 * @param {number} W @param {number} H @param {ArrayLike<number>} mask
 */
export function labelPieces(W, H, mask) {
  const n = W * H, id = new Int32Array(n).fill(-1), stack = new Int32Array(n), sizes = [];
  for (let s = 0; s < n; s++) {
    if (!mask[s] || id[s] >= 0) continue;
    const k = sizes.length;
    let top = 0, size = 0;
    stack[top++] = s;
    id[s] = k;
    while (top) {
      const i = stack[--top], x = i % W;
      size++;
      if (x > 0 && mask[i - 1] && id[i - 1] < 0) { id[i - 1] = k; stack[top++] = i - 1; }
      if (x < W - 1 && mask[i + 1] && id[i + 1] < 0) { id[i + 1] = k; stack[top++] = i + 1; }
      if (i >= W && mask[i - W] && id[i - W] < 0) { id[i - W] = k; stack[top++] = i - W; }
      if (i + W < n && mask[i + W] && id[i + W] < 0) { id[i + W] = k; stack[top++] = i + W; }
    }
    sizes.push(size);
  }
  return { id, sizes };
}
/** Connected pieces of the cells `inSet` holds, each its cells in the grid's order. */
function pieces(g, inSet) {
  const mask = new Uint8Array(g.W * g.H);
  for (let i = 0; i < mask.length; i++) if (inSet(i)) mask[i] = 1;
  const { id, sizes } = labelPieces(g.W, g.H, mask), list = sizes.map(() => []);
  for (let i = 0; i < id.length; i++) if (id[i] >= 0) list[id[i]].push(i);
  return { id, list };
}

/** An edge between a cell and its neighbour across one of the four steps: `inner` the cell whose side it closes (a
 *  yard's, an alley's), `outer` the other (-1 past the grid). */
const edgeOf = (inner, outer, dir) => ({ inner, outer, dir });

/**
 * A TOWN'S PLAN (the module's header): `kind` each cell's FABRIC_KIND, `under` a prop's cell's surface (propGround);
 * `fences` and `walls` the edges a yard's fence and a dead end's wall close (each `{ inner, outer, dir }`, dir the step
 * from inner to outer), `gates` the fence edges left open; `dead` each dead end's dressed cells; `shut` the cells no
 * walker treads; `paths` each main street's walk; `ends` and `centre` the cells they run between; `counts`.
 * @param {ReturnType<typeof fabricGrid>} g
 * @param {{ ends?: Array<[number, number]>, centre?: [number, number], seed?: number, mains?: boolean, outWalls?: boolean }} [o]
 *   `ends` the main streets' ends and `centre` the town's middle (cells, x east, z north; the grid's middle where none),
 *   `mains` whether the town has main streets at all (a village has none), `seed` its dice (its map id), `outWalls` whether
 *   an alley's end onto the cells past its blocks is walled (a capital's are its own plazas and grounds: never)
 */
export function fabricPlan(g, o = {}) {
  const steps = planSteps(g, o);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}
/**
 * TOWN-BOARDS: THE PAVEMENT IS A WALK. Two pavements that meet at a corner alone across the street's ground - a street
 * squeezed between two houses' corners, the pavement before both fronts all but filling the neck; a pavement turning
 * round a house's corner - are joined there: of the two cells between them the carriageway's (else the open ground's)
 * is the pavement's. Then a pavement shorter than FABRIC.paveLeast along its longer side is no walk but a lone slab - a
 * flag on its own in the stone styles, a board alone on the forest floor in the planks' - and is not laid: its cells are
 * the street's own surface, the carriageway's where it meets it (the setts, or the forest floor between the planks'
 * boardwalks), else no street's (the town's own ground, read on by the ways and the yards). It is never joined through a
 * prop's ground (fabricGrid), no walk's (its street propGround's). Last, a piece of the carriageway no walk runs down
 * (`walk`) and as short - a cell or two of setts the houses' pavements closed round - is the pavement's where it meets it
 * (its patch in the flags, its hole in the boardwalk), else no street's. In place over `kind`, on the cells `may` allows.
 * @param {{ W: number, H: number }} g @param {Uint8Array} kind @param {?ArrayLike<number>} [walk] the main streets' walks
 * @param {((i: number) => boolean) | null} [may] AUDIT PROP-GROUND: the cells it may change (all where none)
 */
export function paveWalks(g, kind, walk = null, may = null) {
  const K = FABRIC_KIND, isPave = (i) => kind[i] === K.pave, can = (i) => !may || may(i);
  /** A piece's extent along its longer side, and whether a cell of it is beside one of kind `k` (four ways). */
  const reach = (cells, k) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, meets = false;
    for (const i of cells) {
      const x = i % g.W, z = (i - x) / g.W;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      for (const j of [x > 0 ? i - 1 : -1, x < g.W - 1 ? i + 1 : -1, i - g.W, i + g.W]) if (j >= 0 && j < kind.length && kind[j] === k) meets = true;
    }
    return { long: Math.max(x1 - x0, z1 - z0) + 1 >= FABRIC.paveLeast, meets };
  };
  for (let joined = true; joined;) {
    joined = false;
    for (let z = 0; z + 1 < g.H; z++) {
      for (let x = 0; x + 1 < g.W; x++) {
        const a = z * g.W + x, b = a + 1, c = a + g.W, d = c + 1;
        const between = isPave(a) && isPave(d) && !isPave(b) && !isPave(c) ? [b, c] : isPave(b) && isPave(c) && !isPave(a) && !isPave(d) ? [a, d] : null;
        if (!between) continue;
        const fill = between.find((i) => can(i) && kind[i] === K.main) ?? between.find((i) => can(i) && kind[i] === K.open);
        if (fill === undefined) continue;   // two buildings' or props' corners between them: no ground to join on
        kind[fill] = K.pave;
        joined = true;
      }
    }
  }
  for (const cells of pieces(g, isPave).list) {
    const { long, meets } = reach(cells, K.main);
    if (long) continue;
    for (const i of cells) if (can(i)) kind[i] = meets ? K.main : K.open;
  }
  if (!walk) return;
  for (const cells of pieces(g, (i) => kind[i] === K.main).list) {
    if (cells.some((i) => walk[i])) continue;
    const { long, meets } = reach(cells, K.pave);
    if (long) continue;
    for (const i of cells) if (can(i)) kind[i] = meets ? K.pave : K.open;
  }
}

/** fabricPlan's steps: it yields between them (a host breathes there - its fields, its main streets, its yards, its dead
 *  ends, its walkers) and returns the plan. @param {ReturnType<typeof fabricGrid>} g @param {Parameters<typeof fabricPlan>[1]} [o] */
export function* planSteps(g, { ends = [], centre = null, seed = 0, mains = true, outWalls = true } = {}) {
  const n = g.W * g.H, K = FABRIC_KIND;
  const open = new Uint8Array(n);
  for (let i = 0; i < n; i++) open[i] = g.town[i] && !g.built[i] ? 1 : 0;
  const clear = chamferField(g.built, g.W, g.H), nearHouse = chamferField(g.house, g.W, g.H);
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) kind[i] = !g.town[i] ? K.off : g.built[i] ? K.built : K.open;

  yield;
  // ---- the main streets
  const paths = [], endCells = [];
  let centreCell = -1;
  /** @type {?Uint8Array} */
  let onWalk = null;   // AUDIT PROP-GROUND: the walks, read again under the props
  if (mains && open.some((v) => v)) {
    const [cx, cz] = centre ?? [g.W / 2, g.H / 2];
    centreCell = nearestOpen(g, open, clear, cx, cz, FABRIC.mainWant);
    const walk = walkFrom(g, open, clear, centreCell);
    for (const [ex, ez] of ends) {
      const e = nearestOpen(g, open, clear, ex, ez);
      if (e < 0 || !Number.isFinite(walk.cost[e]) || endCells.includes(e)) continue;
      endCells.push(e);
      const path = [];
      for (let i = e; i >= 0; i = walk.from[i]) path.push(i);
      paths.push(path);   // from its end to the middle
    }
    // the street: its carriageway every open cell within FABRIC.carriage of the walk; its pavements the open cells round the
    // carriageway FABRIC.kerb deep by the eight ways (beside it or across its corner), and its carriageway wherever a house
    // stands beside it. TOWN-BOARDS: the pavement had been the cells between FABRIC.carriage and 3.5 of the walk in straight
    // lines - a band a cell wide, which along a walk's every step (four ways, a staircase wherever the street runs aslant)
    // met its next cell at a corner alone: a pavement of single flags apart, a boardwalk of single boards on the forest
    // floor (the planks' styles lay no carriageway between them) - 31,419 of the 40,052 pieces under four cells over every
    // hamlet past the Bay (tools/townBoardsSweep.mjs). A ring by the eight ways runs on round every step, side by side.
    const fromWalk = new Float32Array(n).fill(Infinity), r = Math.ceil(FABRIC.carriage);
    for (const path of paths) {
      for (const p of path) {
        const px = p % g.W, pz = (p - px) / g.W;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          const x = px + dx, z = pz + dz, d = Math.hypot(dx, dz);
          if (d > FABRIC.carriage || x < 0 || z < 0 || x >= g.W || z >= g.H) continue;
          const i = z * g.W + x;
          if (open[i] && d < fromWalk[i]) fromWalk[i] = d;
        }
      }
    }
    // TOWN-BOARDS 2: the carriageway is the street's own - reached from the walk without crossing a building or a prop; a
    // cell within FABRIC.carriage of it in a straight line past a building's or a prop's corner is no street's (it was a
    // patch of setts on its own beyond them)
    onWalk = new Uint8Array(n);
    for (const path of paths) for (const p of path) onWalk[p] = 1;
    const near = labelPieces(g.W, g.H, Uint8Array.from(fromWalk, (d) => (d <= FABRIC.carriage ? 1 : 0))), reached = new Set();
    for (let i = 0; i < n; i++) if (onWalk[i] && near.id[i] >= 0) reached.add(near.id[i]);
    const carriageway = Uint8Array.from(near.id, (k) => (k >= 0 && reached.has(k) ? 1 : 0));
    const round = maxNear(carriageway, g.W, g.H, FABRIC.kerb);   // the carriageway and its ring, by the eight ways
    for (let i = 0; i < n; i++) if (open[i] && round[i]) kind[i] = carriageway[i] && nearHouse[i] > FABRIC.pave ? K.main : K.pave;
    paveWalks(g, kind, onWalk);
  }

  yield;
  // ---- the side streets, the alleys and the yards
  // a way's width is its corridor's, not its cell's: the most clearance within FABRIC.reach of a cell (a street's margin by
  // a house is the street's, a lane between two houses no wider than its middle is an alley)
  const wide = maxNear(clear, g.W, g.H, FABRIC.reach);
  for (let i = 0; i < n; i++) if (kind[i] === K.open && (g.road[i] || (!g.grass[i] && wide[i] < FABRIC.side))) kind[i] = g.road[i] ? K.side : K.alley;
  const yardOf = new Int32Array(n).fill(-1), yards = [];
  const grassPieces = pieces(g, (i) => kind[i] === K.open && !!g.grass[i]);
  grassPieces.list.forEach((cells) => {
    if (cells.length < FABRIC.yard[0] || cells.length > FABRIC.yard[1]) return;
    let touch = 0;
    for (const i of cells) { const x = i % g.W, y = (i - x) / g.W; for (const [dx, dy] of STEPS) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < g.W && ny < g.H && g.house[ny * g.W + nx]) touch++; } }
    if (touch < FABRIC.yardTouch) return;
    const k = yards.length;
    yards.push({ cells, fence: [], gates: [] });
    for (const i of cells) { kind[i] = K.yard; yardOf[i] = k; }
  });
  const isWay = (j) => kind[j] === K.main || kind[j] === K.pave || kind[j] === K.side || kind[j] === K.alley;
  // a yard's fence: every edge from its grass to a way, to open ground no yard took or to the land past the town (never to a
  // house, a prop or the water - its own wall); its runs straight along the grid, a gate in each long enough
  yards.forEach((y) => {
    for (const i of y.cells) {
      const x = i % g.W, z = (i - x) / g.W;
      STEPS.forEach(([dx, dz], dir) => {
        const nx = x + dx, nz = z + dz, out = nx < 0 || nz < 0 || nx >= g.W || nz >= g.H;
        const j = out ? -1 : nz * g.W + nx;
        if (out || kind[j] === K.off || isWay(j) || kind[j] === K.open) y.fence.push(edgeOf(i, j, dir));   // (two yards never touch: each is a whole piece of the grass)
      });
    }
    // its gate: in its run with the most edges onto a main or a side street (else onto open ground a walker crosses - never
    // onto the land past the town), at the middle of those edges - the walkers' reach (below) opens more where a part of it
    // is cut off
    const runs = edgeRuns(g, y.fence).filter((run) => run.length >= FABRIC.gate);
    const street = (e) => e.outer >= 0 && (kind[e.outer] === K.main || kind[e.outer] === K.pave || kind[e.outer] === K.side);
    const walked = (e) => e.outer >= 0 && kind[e.outer] !== K.off;
    const score = (run) => run.filter(street).length * 1024 + run.filter(walked).length;
    const best = runs.filter((run) => run.some(walked)).sort((a, b) => score(b) - score(a))[0];
    if (best) {
      const toward = best.filter(street).length ? best.filter(street) : best.filter(walked), mid = toward[Math.floor(toward.length / 2)];
      const at = best.indexOf(mid), from = Math.max(0, Math.min(best.length - FABRIC.gate, at - Math.floor(FABRIC.gate / 2)));
      for (let k = from; k < from + FABRIC.gate; k++) y.gates.push(best[k]);
    }
  });

  yield;
  // ---- the dead ends: the alleys' pieces, their mouths on the streets and their ends on the land past the town
  const walls = [], dead = [];
  const alleys = pieces(g, (i) => kind[i] === K.alley);
  const isStreet = (j) => kind[j] === K.main || kind[j] === K.pave || kind[j] === K.side || kind[j] === K.open;   // a street, or the open ground a walker crosses
  alleys.list.forEach((cells, k) => {
    if (cells.length < FABRIC.deadLeast) return;   // a gap between two houses, no way of its own
    const mouths = [], outs = [];
    for (const i of cells) {
      const x = i % g.W, z = (i - x) / g.W;
      STEPS.forEach(([dx, dz], dir) => {
        const nx = x + dx, nz = z + dz, out = nx < 0 || nz < 0 || nx >= g.W || nz >= g.H, j = out ? -1 : nz * g.W + nx;
        if (out || kind[j] === K.off) outs.push(edgeOf(i, j, dir));
        else if (isStreet(j)) mouths.push(edgeOf(i, j, dir));
      });
    }
    const mouthRuns = edgeGroups(g, mouths);
    if (!mouthRuns.length) return;   // an alley no street reaches is a yard's own way
    let closed = null;
    const outRuns = edgeGroups(g, outs);
    if (outWalls && outRuns.length === 1 && outRuns[0].length <= FABRIC.deadMouth) closed = outs;   // it runs out of the town at its end: walled there
    else if (!outs.length && mouthRuns.length >= 2 && cells.length >= FABRIC.deadLeast && hashOf(seed, k, cells.length) % FABRIC.deadEvery === 0) {
      // a through-alley walled at its mouth farther from the town's middle
      const cx = centreCell >= 0 ? centreCell % g.W : g.W / 2, cz = centreCell >= 0 ? (centreCell - (centreCell % g.W)) / g.W : g.H / 2;
      const far = (run) => Math.max(...run.map((e) => ((e.inner % g.W) - cx) ** 2 + ((e.inner - (e.inner % g.W)) / g.W - cz) ** 2));
      closed = mouthRuns.slice().sort((a, b) => far(b) - far(a) || a[0].inner - b[0].inner)[0];
    }
    if (closed) walls.push({ alley: k, edges: closed });
    if (closed || mouthRuns.length === 1) {
      // its end: the cells farthest from its open mouths, FABRIC.deadDress deep
      const open = closed ? mouthRuns.filter((r) => r !== closed) : mouthRuns;
      const depth = alleyDepth(g, cells, alleys.id, k, open.flat());
      const most = Math.max(...depth.values());
      if (most >= FABRIC.deadDress + 2) dead.push({ alley: k, walled: !!closed, cells: [...depth].filter(([, d]) => d > most - FABRIC.deadDress).map(([i]) => i).sort((a, b) => a - b) });
    }
  });

  yield;
  // ---- the walkers: shut a fence's yard side but its gates, a wall's alley side; then keep every cell reached - each piece
  // of the town's open ground the shut cut off is joined back to its streets through the first shut cell between them
  // (a fence's: a gate there; a wall's: the wall comes down), until none is cut off
  const shut = new Uint8Array(n);
  const shutAll = () => {
    shut.fill(0);
    for (const y of yards) { const gs = new Set(y.gates); for (const e of y.fence) if (!gs.has(e)) shut[e.inner] = 1; }
    for (const wl of walls) for (const e of wl.edges) shut[e.inner] = 1;
  };
  shutAll();
  const before = labelPieces(g.W, g.H, open).id;
  /** A cell's four neighbours on the grid. */
  const neighbours = (c) => { const x = c % g.W, out = []; if (x > 0) out.push(c - 1); if (x < g.W - 1) out.push(c + 1); if (c >= g.W) out.push(c - g.W); if (c + g.W < n) out.push(c + g.W); return out; };
  for (let guard = 0; guard <= 2 * (yards.length + walls.length) + 2; guard++) {
    const { after, own } = reachOf(g, open, shut, before);
    const stray = (a) => a >= 0 && own[a] === 0;
    const joined = new Set();
    let moved = false;
    const joins = (c) => {   // the stray pieces beside a shut cell, if a piece of the streets is beside it too
      const ids = neighbours(c).map((j) => after[j]);
      return ids.some((a) => a >= 0 && own[a] === 1) ? ids.filter((a) => stray(a) && !joined.has(a)) : [];
    };
    yards.forEach((y) => {
      const gs = new Set(y.gates);
      for (const e of y.fence) {
        if (gs.has(e)) continue;
        const ids = joins(e.inner);
        if (!ids.length) continue;
        y.gates.push(e); gs.add(e); moved = true;
        for (const a of ids) joined.add(a);
      }
    });
    for (let k = walls.length - 1; k >= 0; k--) {
      const ids = walls[k].edges.flatMap((e) => joins(e.inner));
      if (!ids.length) continue;
      walls.splice(k, 1); moved = true;
      for (const a of ids) joined.add(a);
    }
    if (!moved) {
      // no shut cell stands between a stray and its streets alone (two shut cells side by side, a fence's and a wall's):
      // every shut cell beside a stray opens - its fence a gate, its wall down - and the next pass joins what is left
      for (let c = 0; c < n; c++) {
        if (!shut[c] || !neighbours(c).some((j) => stray(after[j]))) continue;
        for (const y of yards) for (const e of y.fence) if (e.inner === c && !y.gates.includes(e)) { y.gates.push(e); moved = true; }
        for (let k = walls.length - 1; k >= 0; k--) if (walls[k].edges.some((e) => e.inner === c)) { walls.splice(k, 1); moved = true; }
      }
    }
    if (!moved) break;
    shutAll();
  }
  const fences = [], gates = [];
  for (const y of yards) { const gs = new Set(y.gates); for (const e of y.fence) (gs.has(e) ? gates : fences).push(e); }
  // ---- the yards' woodpiles: in a yard of FABRIC.pileYard cells or more, one against its fence - a cell beside a fence
  // edge, clear of every house by FABRIC.pileClear (never before a door) and of its gates by FABRIC.pileGate, its other
  // three sides and their corners open ground no one is shut from (so no walker's way is cut), the first such in the
  // grid's order off the town's dice
  const props = [];
  const walkable = (j) => j >= 0 && j < n && open[j] === 1 && !shut[j];
  yards.forEach((y, k) => {
    if (y.cells.length < FABRIC.pileYard) return;
    const gateCells = y.gates.map((e) => e.inner);
    const spots = [];
    for (const e of y.fence) {
      const c = e.inner;
      if (!shut[c] || nearHouse[c] < FABRIC.pileClear || gateCells.some((q) => Math.abs((q % g.W) - (c % g.W)) + Math.abs(Math.floor(q / g.W) - Math.floor(c / g.W)) < FABRIC.pileGate)) continue;
      // the fence behind it (dir e.dir); the cell before it into the yard and that cell's two along the fence open ground no
      // one is shut from, so its neighbours along the fence still meet round it
      const [dx, dz] = STEPS[e.dir], x = c % g.W, z = (c - x) / g.W;
      const at = (ix, iz) => (ix < 0 || iz < 0 || ix >= g.W || iz >= g.H ? -1 : iz * g.W + ix);
      if (![at(x - dx, z - dz), at(x - dx + dz, z - dz + dx), at(x - dx - dz, z - dz - dx)].every(walkable)) continue;
      spots.push({ cell: c, dir: e.dir });
    }
    if (!spots.length) return;
    const pick = spots[hashOf(seed, k, 7) % spots.length];
    props.push({ kind: 'woodpile', cell: pick.cell, dir: pick.dir });
  });
  const counts = { main: 0, pave: 0, side: 0, alley: 0, yard: 0, yards: yards.length, fences: fences.length, gates: gates.length, walls: walls.reduce((s, wl) => s + wl.edges.length, 0), dead: 0, props: props.length, shut: 0 };
  for (let i = 0; i < n; i++) {
    if (kind[i] === K.main) counts.main++; else if (kind[i] === K.pave) counts.pave++; else if (kind[i] === K.side) counts.side++;
    else if (kind[i] === K.alley) counts.alley++; else if (kind[i] === K.yard) counts.yard++;
    if (shut[i]) counts.shut++;
  }
  const deadEnds = dead.filter((d) => !d.walled || walls.some((wl) => wl.alley === d.alley)).map((d) => d.cells);
  counts.dead = deadEnds.length;
  yield;
  const under = propGround(g, kind, { walk: onWalk, nearHouse });
  return { W: g.W, H: g.H, kind, under, fences, gates, walls: walls.flatMap((wl) => wl.edges), dead: deadEnds, props, shut, paths, ends: endCells, centre: centreCell, counts };
}

/** PROP-GROUND's choice among a cell's neighbours' surfaces, tied: a street's face before none, the setts and cobbles (the
 *  ground's own level) before the flags. */
const UNDER_ORDER = Object.freeze([FABRIC_KIND.main, FABRIC_KIND.side, FABRIC_KIND.pave, 0]);
/**
 * PROP-GROUND (the owner, 2026-10-30: "props still sit on old textures"): THE STREET UNDER A PROP. Its cells (fabricGrid
 * `prop`) stay built in `kind`; each takes the surface of the nearest ground outside them (a walk four ways; the most
 * common face one step nearer, a tie by UNDER_ORDER), 0 Daggerfall's own. A house, the water or a foot plate is no
 * source. AUDIT PROP-GROUND: then the street's lines through it (propLines) and its own laws over them (propLaws).
 * @param {{ W: number, H: number, prop?: ArrayLike<number>, flagless?: ArrayLike<number>, house?: ArrayLike<number> }} g
 * @param {Uint8Array} kind @param {{ walk?: ?ArrayLike<number>, nearHouse?: ?ArrayLike<number> }} [o]
 */
export function propGround(g, kind, { walk = null, nearHouse = null } = {}) {
  const n = g.W * g.H, K = FABRIC_KIND, under = new Uint8Array(n), depth = new Int32Array(n).fill(-1);
  if (!g.prop) return under;
  const isProp = (i) => kind[i] === K.built && g.prop[i] === 1;
  const near = (i) => { const x = i % g.W, out = []; if (x > 0) out.push(i - 1); if (x < g.W - 1) out.push(i + 1); if (i >= g.W) out.push(i - g.W); if (i + g.W < n) out.push(i + g.W); return out; };
  const pick = (faces) => {
    const count = new Map();
    for (const f of faces) count.set(f, (count.get(f) ?? 0) + 1);
    let best = 0, most = 0;
    for (const f of UNDER_ORDER) if ((count.get(f) ?? 0) > most) { best = f; most = count.get(f); }
    return best;
  };
  let layer = [];
  for (let i = 0; i < n; i++) {
    if (!isProp(i)) continue;
    const faces = near(i).filter((j) => kind[j] !== K.built).map((j) => faceOf(kind[j]));
    if (faces.length) { depth[i] = 1; under[i] = pick(faces); layer.push(i); }
  }
  for (let d = 2; layer.length; d++) {
    const next = [];
    for (const i of layer) for (const j of near(i)) if (isProp(j) && depth[j] < 0) { depth[j] = d; next.push(j); }
    for (const j of next) under[j] = pick(near(j).filter((k) => depth[k] === d - 1).map((k) => under[k]));
    layer = next;
  }
  propLines(g, kind, under, isProp);
  propLaws(g, kind, under, isProp, walk, nearHouse ?? chamferField(g.house ?? new Uint8Array(n), g.W, g.H));
  return under;
}
/** A kind's face under a prop: a street's (main, pave, side) or none (0). */
const faceOf = (k) => (k === FABRIC_KIND.main || k === FABRIC_KIND.pave || k === FABRIC_KIND.side ? k : 0);

/**
 * AUDIT PROP-GROUND: THE STREET'S LINES THROUGH A PROP. From each of its cells, along its row and its column through the
 * prop's ground to the first cell past it either way: where both ends are one face (a building, the grid's edge or the
 * land past the town no end), the street runs on through the cell with it - the shorter such line where row and column
 * disagree, the nearest ground's (propGround) where they tie or neither holds. A pavement's line and a carriageway's run
 * on through a lamp or a sign that stands across them, whichever side of it is nearer.
 */
function propLines(g, kind, under, isProp) {
  const n = g.W * g.H, K = FABRIC_KIND, out = Uint8Array.from(under);
  /** The face past the prop's ground from cell i along a step, and how far: null where no face ends it. */
  const end = (i, dx, dz) => {
    let x = i % g.W, z = (i - x) / g.W, d = 0;
    for (;;) {
      x += dx; z += dz; d++;
      if (x < 0 || z < 0 || x >= g.W || z >= g.H) return null;
      const j = z * g.W + x;
      if (isProp(j)) continue;
      return kind[j] === K.built || kind[j] === K.off ? null : { face: faceOf(kind[j]), d };
    }
  };
  const line = (i, dx, dz) => { const a = end(i, dx, dz), b = end(i, -dx, -dz); return a && b && a.face === b.face ? { face: a.face, span: a.d + b.d } : null; };
  for (let i = 0; i < n; i++) {
    if (!isProp(i)) continue;
    const row = line(i, 1, 0), col = line(i, 0, 1);
    let pick = row ?? col;
    if (row && col && row.face !== col.face) pick = row.span === col.span ? null : row.span < col.span ? row : col;
    if (pick) out[i] = pick.face;
  }
  under.set(out);
}

/**
 * AUDIT PROP-GROUND: THE STREET'S LAWS UNDER THE PROPS, on the cells propGround laid (`under`, in place), a flagless
 * cell's never flags: (1) the setts keep their kerb - a cell of setts beside other ground by the eight ways (FABRIC.kerb),
 * or within FABRIC.pave of a house, is the pavement's; (2) the pavement's ring - a cell not setts or flags beside the
 * setts by the eight ways is the pavement's; (3) paveWalks over the street as laid, on these cells alone: no lone slab,
 * no island of setts. The laws of planSteps' main streets, so a prop's street reads as the street round it.
 */
function propLaws(g, kind, under, isProp, walk, nearHouse) {
  const n = g.W * g.H, K = FABRIC_KIND, flagless = (i) => !!g.flagless?.[i];
  for (let i = 0; i < n; i++) if (isProp(i) && flagless(i) && under[i] === K.pave) under[i] = K.main;
  const may = (i) => isProp(i) && !flagless(i);
  const eff = Uint8Array.from(kind, (k, i) => (isProp(i) ? under[i] || K.open : k));
  const other = maxNear(Uint8Array.from(eff, (k) => (k && k !== K.main && k !== K.pave && k !== K.built ? 1 : 0)), g.W, g.H, FABRIC.kerb);
  for (let i = 0; i < n; i++) if (may(i) && eff[i] === K.main && (other[i] || nearHouse[i] <= FABRIC.pave)) eff[i] = K.pave;
  const ring = maxNear(Uint8Array.from(eff, (k) => (k === K.main ? 1 : 0)), g.W, g.H, FABRIC.kerb);
  for (let i = 0; i < n; i++) if (may(i) && eff[i] !== K.main && eff[i] !== K.pave && ring[i]) eff[i] = K.pave;
  paveWalks(g, eff, walk, may);
  // a slab it lays down that meets no setts is the ground round it: cobbles where they lie on as many of its sides as the
  // bare ground does (four ways, no building)
  for (let i = 0; i < n; i++) {
    if (!isProp(i)) continue;
    if (eff[i] !== K.open) { under[i] = eff[i]; continue; }
    const x = i % g.W, sides = [x > 0 ? i - 1 : -1, x < g.W - 1 ? i + 1 : -1, i - g.W, i + g.W].filter((j) => j >= 0 && j < n && eff[j] !== K.built && eff[j] !== K.off);
    const cob = sides.filter((j) => eff[j] === K.side).length;
    under[i] = cob && cob >= sides.filter((j) => eff[j] !== K.side && eff[j] !== K.main && eff[j] !== K.pave).length ? K.side : 0;
  }
}

/** An edge's line: the axis it runs along and where - a step east or west closes a cell's side along z (a line of
 *  constant x), north or south along x. */
const edgeLine = (g, e) => {
  const x = e.inner % g.W, z = (e.inner - x) / g.W, [dx, dz] = STEPS[e.dir];
  return dx ? { along: 'z', at: dx > 0 ? x + 1 : x, pos: z } : { along: 'x', at: dz > 0 ? z + 1 : z, pos: x };
};
/** A set of edges as runs: each straight line of edges side by side, the same way out, in order along it. */
export function edgeRuns(g, edges) {
  const byLine = new Map();
  for (const e of edges) {
    const L = edgeLine(g, e), key = `${L.along}|${L.at}|${e.dir}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key).push({ e, pos: L.pos });
  }
  const runs = [];
  for (const key of [...byLine.keys()].sort()) {
    const list = byLine.get(key).sort((a, b) => a.pos - b.pos);
    let run = [list[0].e];
    for (let k = 1; k < list.length; k++) {
      if (list[k].pos === list[k - 1].pos + 1) run.push(list[k].e);
      else { runs.push(run); run = [list[k].e]; }
    }
    runs.push(run);
  }
  return runs;
}
/** A set of edges as groups of touching ones (an alley's mouth onto a street, however it turns): edges whose inner cells
 *  are the same or side by side, in the order of their first edges. */
function edgeGroups(g, edges) {
  const byCell = new Map();
  for (const e of edges) { if (!byCell.has(e.inner)) byCell.set(e.inner, []); byCell.get(e.inner).push(e); }
  const seen = new Set(), out = [];
  for (const e of edges) {
    if (seen.has(e.inner)) continue;
    const group = [], cells = [e.inner];
    seen.add(e.inner);
    for (let q = 0; q < cells.length; q++) {
      const c = cells[q], x = c % g.W;
      group.push(...byCell.get(c));
      for (const j of [x > 0 ? c - 1 : -1, x < g.W - 1 ? c + 1 : -1, c - g.W, c + g.W]) if (j >= 0 && byCell.has(j) && !seen.has(j)) { seen.add(j); cells.push(j); }
    }
    out.push(group);
  }
  return out;
}
/** An alley's cells' distance (steps within it) from the cells its open mouths leave from. */
function alleyDepth(g, cells, id, k, mouths) {
  const depth = new Map(), q = [];
  for (const e of mouths) if (!depth.has(e.inner)) { depth.set(e.inner, 0); q.push(e.inner); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % g.W, z = (i - x) / g.W;
    for (const [dx, dz] of STEPS) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= g.W || nz >= g.H) continue;
      const j = nz * g.W + nx;
      if (id[j] === k && !depth.has(j)) { depth.set(j, depth.get(i) + 1); q.push(j); }
    }
  }
  for (const i of cells) if (!depth.has(i)) depth.set(i, 0);
  return depth;
}
/**
 * THE TOWN'S PIECES AFTER A SHUT: shutting cells only ever splits a piece of the open ground, so each piece after it lies
 * in one piece before it; of a piece before, the greatest piece after it (a tie to the first in the grid's order) is its
 * own - its streets' (`own` 1) - and every other is a stray (`own` 0).
 * @param {{ W: number, H: number }} g @param {Uint8Array} open @param {Uint8Array} shut
 * @param {Int32Array} [before] the open ground's pieces before the shut (labelPieces' ids)
 */
export function reachOf(g, open, shut, before = labelPieces(g.W, g.H, open).id) {
  const n = g.W * g.H, walk = new Uint8Array(n);
  for (let i = 0; i < n; i++) walk[i] = open[i] && !shut[i] ? 1 : 0;
  const { id: after, sizes } = labelPieces(g.W, g.H, walk), best = new Map();
  const ownerOf = new Int32Array(sizes.length).fill(-1);
  for (let i = 0; i < n; i++) if (after[i] >= 0 && ownerOf[after[i]] < 0) ownerOf[after[i]] = before[i];
  sizes.forEach((size, a) => { const b = ownerOf[a], cur = best.get(b); if (cur === undefined || size > sizes[cur]) best.set(b, a); });
  const own = new Uint8Array(sizes.length);
  for (const a of best.values()) own[a] = 1;
  return { after, own };
}
/** THE CELLS A PLAN CUTS OFF (reachOf's strays' cells), in the order of the grid. */
export function cutOff(g, open, shut, before) {
  const { after, own } = reachOf(g, open, shut, before), out = [];
  for (let i = 0; i < after.length; i++) if (after[i] >= 0 && !own[after[i]]) out.push(i);
  return out;
}
