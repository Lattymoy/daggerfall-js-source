// @ts-check
// MERCHANT-YARDS (2026-10-10): WHERE A TOWN'S TWO YARDS STAND - the Stable and the Wagon Yard (systems/merchantYards.js)
// on the town's own open ground, read off its layout alone, so every client stands each on one spot.
//
// THE GROUND: the town's navgrid (world/city/cityNavigation.js, DFU's CityNavigation carve - every automap byte a building,
// a tree or a lamp draws is closed, the water with it; always the enhanced lane's water table, as LEFAY1's monument
// reads it, so the classic lane's shallows are never ground), and over it what the caller measured of the town's
// blocks: every BUILDING's box kept BUILDING_CLEAR_M away (a home's yard lot is its box and HOME-YARD's YARD_MARGIN,
// 6 m, round it - scenes/homeYards.js - and a guild hall's is the same: no yard stands on a lot a player may decorate,
// nor before anyone's door), every other model's box (a wall, a well, a fence, a stall, a mod's carriage) PROP_CLEAR_M
// away, and every flat (a tree, a lamp, a sign, a person) FLAT_CLEAR_M round its foot. A block that holds a palace is
// left whole (a yard in a castle's court is no street's). LEFAY1's monument keeps its own ground.
//
// THE PLACE: a yard is a rectangle (YARD_FOOT, metres, its front its +z - the gate's side), turned to one of the four
// axes. Its own ground must be open and off every road and path (the street stays clear - FB1001 ROAD-LOT's law for a
// yard); a ring of YARD_PAD_M round it open too, a road allowed there - a yard stands BESIDE a street. Ties to the lower
// row, then the lower column, then the lower turn. The Stable is placed first, then the Wagon Yard on what is left,
// YARD_GAP_M clear of it.
//
// IC-PROPS (2026-10-27, the owner: "Random placements on the wagon/other vendors all over the Imperial city", then "the
// issues I mentioned for the imperial city for stables/doors/etc are a world wide issue. They have no logical
// placements"; bible/03-World/Merchant-Yards.md IC-PROPS): EACH KIND WHERE IT BELONGS, ON THE TOWN'S OWN OPEN GROUND. Every
// yard stood nearest the middle of the town's grid on any open cell its road law did not know for a way: measured over
// 270 towns, a third of the Bay's stables in a house's garden and a fifth across a street, eight in ten in the town's
// inner half; past the Bay, four city-states in five stood theirs on the open land the outline leaves, wherever it lay;
// every capital's on its own plaza. So (yardLaw, from townGroundOf; yardSitesOn):
//   - NO YARD STANDS ON A WAY (`shut`: Daggerfall's road tiles and the painted paths - already the roads - and where
//     URBANIZER planned the town, its main and side streets, pavements and alleys), nor on any cell but the town's own
//     blocks' (`town`), the open land its outline leaves within EDGE_LAND_CELLS of them (`edgeLand` - by a gate), or a
//     capital's own open paving with SQUARE_MARGIN clear all round it (`square` - a plaza); its ring may be a way. NOR IN A
//     HOUSE'S GARDEN (`garden`: a piece of open grass a house backs onto, URBANIZER's FABRIC.yard law; its planned yards)
//     while the town has room anywhere else (YARD_LAW_STEPS - a town that stood a yard stands one still).
//   - ITS FRONT faces a way (`street`): a place that does always wins over one that does not (YARD_FRONT_COST).
//   - THE STABLE stands at the town's EDGE BY A ROAD OR A GATE, open ground for its horses: nearest an EXIT (exitField - a
//     way where it crosses the town's edge), on the town's own ground or the open land just past it.
//   - THE WAGON YARD and THE JOINERY stand on a street's side or a square's, nearest the middle: on the town's own ground or
//     a capital's plaza - and where the town has no room left inside, by an exit as the Stable stands.
//   - A CAPITAL THAT NAMES ITS OWN (`ways.fixed` - the Imperial City's gate yards, world/imperialYards.js) stands those and
//     no other: the law places none on its slices.
//
// A town with no room for one stands none of it (said once, in the console), never a yard over a house, a road or a lot.
//
// Pure: no renderer, no GL, no clock. Not a DFU member. Ledger A (MERCHANT-YARDS).
//
// IC-STUTTER (2026-10-27, the owner: "Traveling in the Imperial City at x60 presents really bad stuttering"; bible/03-World/
// Arena-Provinces.md IC-STUTTER): EVERY PASS A STEP AT A TIME. A city of eight blocks a side is a grid of 512 by 512 cells,
// and every near slice of the Imperial City is one: its measures (two thousand placed models' boxes), its ground and its
// yards' search (four turns over every cell, a yard a pass) ran in one task of the pixel's build, 0.2-0.4 s of the page's
// thread on each - at x60 several a second. Each pass is a generator (`...Steps`) that yields between blocks and between
// bands of rows; the host walks it through the build's breather (world/puddleMask.js stepsBreathing - OW-HITCH's), and
// every function below keeps its name and its answer, run to its end (stepsDone): the same work in the same order, the
// same sites. IC-PROPS x IC-STUTTER: the yards' law of a town (yardLaw - its fabric's ways, its edge land, its gardens),
// a ground's exits' field and each yard's place by the law's steps are passes over the same grid, stepped the same way.
import { stepsDone } from '../puddleMask.js'; // IC-STUTTER: OW-HITCH's runner, the one export
import { CityNavigation, NAV_CELL, NAV_CELLS_PER_BLOCK } from '../city/cityNavigation.js';
import { trs, multiply } from '../mat4.js'; // AUDIT MERCHANT-YARDS R2: the blocks' measures, here where they are pinned
import { staticBuildingBox, staticBuildingWorldAabb } from '../staticBuildings.js';
import { localAabb, transformedAabb } from '../../render/frustum.js';
import { ROAD_WEIGHT } from '../city/cityNavigation.js';
import { YARD_KIND_ORDER, CRAFT_YARD_ORDER } from '../../systems/merchantYards.js';
import { FABRIC, FABRIC_KIND, isPortCell } from '../urban/townFabric.js'; // IC-PROPS: a house's garden by URBANIZER's law, its plan's ways, the town's own blocks

/** Each yard's ground, metres: half its width (x) and half its depth (z) - its fence and the apron before its gate
 *  where its sign and its keeper stand (world/merchantYards/merchantYardModels.js lays both out inside it). */
export const YARD_FOOT = Object.freeze({
  stable: Object.freeze({ hx: 7, hz: 5.75 }),
  transport: Object.freeze({ hx: 9, hz: 6.75 }),
  carpenter: Object.freeze({ hx: 7, hz: 6 }), // CARP-YARD: the joinery, 14 m by 12
});
/** The ring round a yard that must be open ground too (a road allowed), metres. */
export const YARD_PAD_M = NAV_CELL;
/** How far a yard keeps from a building's box: HOME-YARD's lot margin (scenes/homeYards.js YARD_MARGIN). */
export const BUILDING_CLEAR_M = 6;
/** How far from any other model's box, and round a flat's foot, metres. */
export const PROP_CLEAR_M = 1;
export const FLAT_CLEAR_M = 0.8;
/** How far apart the two yards stand, metres. */
export const YARD_GAP_M = 3;
/** How deep before a yard's front a road is looked for, cells; what facing none costs, cells of distance. */
export const FRONT_ROAD_CELLS = 2;
export const NO_ROAD_COST = 12;
/** The ground LEFAY1's monument keeps (its clear disc and a margin), metres. */
export const MONUMENT_KEEP_M = 8;
/** IC-PROPS: what a yard's front facing no street costs, cells - more than any town is across, so a yard that opens onto
 *  a street always wins over one that does not (NO_ROAD_COST, 12, stays the ports' - world/portSites.js). */
export const YARD_FRONT_COST = 65536;
/** IC-PROPS: how near the town's edge a street cell is where a way leaves the town (an exit the Stable stands by), cells. */
export const EXIT_REACH = 2;
/** IC-PROPS: how far past the town's own blocks a yard may stand on the open land its outline leaves (by a gate), cells. */
export const EDGE_LAND_CELLS = 32;
/** IC-PROPS: how much open ground a yard on a capital's paving keeps all round it (it stands in a plaza, never across a
 *  street), cells. */
export const SQUARE_MARGIN = 4;

/** The four turns: a yard's front (+z in its frame) along +z, +x, -z, -x of the town - its yaw, degrees, as
 *  world/mat4.js trs turns it (ryDeg: +90 takes +z to +x). */
export const YARD_TURNS = Object.freeze([0, 90, 180, 270]);

/** A cell grid's summed-area table: `sum(x0, y0, x1, y1)` over cells x0..x1-1, y0..y1-1 (clipped to the grid).
 *  SHIPYARDS: world/portSites.js places the port's two on it too. */
export function summed(w, h, at) {
  const S = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += at(x, y);
      S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row;
    }
  }
  return (x0, y0, x1, y1) => {
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(w, x1);
    y1 = Math.min(h, y1);
    if (x1 <= x0 || y1 <= y0) return 0;
    return S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0];
  };
}

/** A yard's cell spans for a turn: [across x, across z]. Pure. */
export function yardSpans(kind, turn) {
  const F = YARD_FOOT[kind];
  const sx = turn % 2 ? F.hz : F.hx,
    sz = turn % 2 ? F.hx : F.hz;
  return [Math.ceil((2 * sx) / NAV_CELL - 1e-9), Math.ceil((2 * sz) / NAV_CELL - 1e-9)];
}

/**
 * THE GRID THE YARDS ARE PLACED ON: `blocked` 1 where a yard may not stand (closed, water, a building's or a prop's
 * clearance, a flat's, a palace's block, the monument's), `road` 1 on a road or a path. Pure.
 * @param {{width: number, height: number, weightAt: (gx: number, gy: number) => number}} nav
 * @param {YardMeasures} [measures]
 *   `buildings`/`props` boxes [x0, z0, x1, z1] in the location frame (metres), `flats` [x, z] feet, `closedBlocks`
 *   [bx, by], `keep` discs [x, z, r] kept clear
 * @returns {YardGround}
 */
export const yardGround = (nav, measures = {}) => stepsDone(yardGroundSteps(nav, measures));
/** @typedef {{buildings?: number[][], props?: number[][], flats?: number[][], closedBlocks?: number[][], keep?: number[][]}} YardMeasures */
/** @typedef {{width: number, height: number, blocked: Uint8Array, road: Uint8Array}} YardGround */
/** IC-STUTTER: yardGround a band of rows and a few hundred boxes at a time.
 *  @param {{width: number, height: number, weightAt: (gx: number, gy: number) => number}} nav @param {YardMeasures} [measures]
 *  @returns {Generator<void, YardGround, void>} */
export function* yardGroundSteps(nav, { buildings = [], props = [], flats = [], closedBlocks = [], keep = [] } = {}) {
  const W = nav.width,
    H = nav.height;
  const blocked = new Uint8Array(W * H),
    road = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) {
    if (gy && gy % YARD_ROWS_A_STEP === 0) yield;
    for (let gx = 0; gx < W; gx++) {
      const w = nav.weightAt(gx, gy),
        i = gy * W + gx;
      if (!(w > 0)) blocked[i] = 1;
      else if (w === ROAD_WEIGHT) road[i] = 1;
    }
  }
  // a box grown by `pad` closes every cell whose centre is in it
  const closeBox = (b, pad) => {
    if (!Array.isArray(b) || b.length < 4 || !b.every(Number.isFinite)) return;
    const gx0 = Math.max(0, Math.ceil((b[0] - pad) / NAV_CELL - 0.5)),
      gx1 = Math.min(W - 1, Math.floor((b[2] + pad) / NAV_CELL - 0.5));
    const gy0 = Math.max(0, Math.ceil((b[1] - pad) / NAV_CELL - 0.5)),
      gy1 = Math.min(H - 1, Math.floor((b[3] + pad) / NAV_CELL - 0.5));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) blocked[gy * W + gx] = 1;
  };
  const closeDisc = (x, z, r) => {
    if (![x, z, r].every(Number.isFinite)) return;
    const gx0 = Math.max(0, Math.floor((x - r) / NAV_CELL)),
      gx1 = Math.min(W - 1, Math.floor((x + r) / NAV_CELL));
    const gy0 = Math.max(0, Math.floor((z - r) / NAV_CELL)),
      gy1 = Math.min(H - 1, Math.floor((z + r) / NAV_CELL));
    const reach = (r + NAV_CELL / 2) ** 2;
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++) {
        // AUDIT MERCHANT-YARDS G2: squared, never Math.hypot - ECMA-262 lets each engine approximate it, and two browsers
        // closing one cell differently stood a yard in two places
        const dx = (gx + 0.5) * NAV_CELL - x,
          dz = (gy + 0.5) * NAV_CELL - z;
        if (dx * dx + dz * dz <= reach) blocked[gy * W + gx] = 1;
      }
  };
  yield;
  for (const b of buildings) closeBox(b, BUILDING_CLEAR_M);
  yield;
  for (const b of props) closeBox(b, PROP_CLEAR_M);
  yield;
  for (const f of flats) closeDisc(f[0], f[1], FLAT_CLEAR_M);
  for (const k of keep) closeDisc(k[0], k[1], k[2]);
  for (const [bx, by] of closedBlocks) {
    closeBox(
      [
        bx * NAV_CELLS_PER_BLOCK * NAV_CELL,
        by * NAV_CELLS_PER_BLOCK * NAV_CELL,
        (bx + 1) * NAV_CELLS_PER_BLOCK * NAV_CELL,
        (by + 1) * NAV_CELLS_PER_BLOCK * NAV_CELL,
      ],
      0,
    );
  }
  return { width: W, height: H, blocked, road };
}

/** IC-STUTTER: the rows of a pass between two steps - a 512-cell city's grid in sixteen. */
export const YARD_ROWS_A_STEP = 32;

/** The cells a yard's front looks onto, FRONT_ROAD_CELLS deep: [x0, y0, x1, y1). Pure. SHIPYARDS: and a port place's. */
export function frontStrip(gx, gy, nx, nz, turn) {
  const d = FRONT_ROAD_CELLS;
  if (turn === 0) return [gx, gy + nz, gx + nx, gy + nz + d];
  if (turn === 1) return [gx + nx, gy, gx + nx + d, gy + nz];
  if (turn === 2) return [gx, gy - d, gx + nx, gy];
  return [gx - d, gy, gx, gy + nz];
}

/**
 * IC-PROPS: A GROUND'S EXITS' FIELD - each cell's distance (chamfer, 3 a step and 4 a diagonal - integers, the same on
 * every engine) to the nearest EXIT: a way (`g.street`, else the roads) within EXIT_REACH of the town's EDGE - a cell of
 * its own ground (`g.town`, else every cell) beside one that is not, or on the grid's border: where a way leaves the town,
 * a gate. Where the town has none, the distance to the edge itself. Made once a ground (`g.toExit`). Pure.
 * @param {any} g @returns {Int32Array}
 */
export const exitField = (g) => stepsDone(exitFieldSteps(g));
/** IC-PROPS x IC-STUTTER: exitField a band of rows at a time. @param {any} g @returns {Generator<void, Int32Array, void>} */
export function* exitFieldSteps(g) {
  if (g.toExit) return g.toExit;
  const W = g.width,
    H = g.height,
    n = W * H,
    street = g.street ?? g.road,
    town = g.town,
    INF = 0x3fffffff;
  const own = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (!town || town[y * W + x] === 1);
  const edge = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    if (y && y % YARD_ROWS_A_STEP === 0) yield;
    for (let x = 0; x < W; x++) {
      if (!own(x, y)) continue;
      if (!own(x - 1, y) || !own(x + 1, y) || !own(x, y - 1) || !own(x, y + 1)) edge[y * W + x] = 1;
    }
  }
  const near = yield* chamferSteps(W, H, edge, INF);
  const seeds = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++)
    if (street[i] && near[i] <= 3 * EXIT_REACH) {
      seeds[i] = 1;
      any = true;
    }
  g.toExit = any ? yield* chamferSteps(W, H, seeds, INF) : near;
  return g.toExit;
}
/** A two-pass chamfer distance (3 orthogonal, 4 diagonal) from the cells `seed` marks - YARD_ROWS_A_STEP rows a step
 *  (IC-STUTTER). Pure. */
function* chamferSteps(W, H, seed, INF) {
  const d = new Int32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? 0 : INF;
  for (let y = 0; y < H; y++) {
    if (y && y % YARD_ROWS_A_STEP === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 3);
        if (x > 0) v = Math.min(v, d[i - W - 1] + 4);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    if (H - 1 - y && (H - 1 - y) % YARD_ROWS_A_STEP === 0) yield;
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 3);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + W - 1] + 4);
      }
      d[i] = v;
    }
  }
  return d;
}

/**
 * ONE YARD'S PLACE on the ground (yardGround's): the best fit, or null. `x`, `z` its middle in the location frame
 * (metres from its origin), `yaw` its turn (degrees), and its cells. Pure.
 * IC-PROPS (the header): its own cells never the yards' shut ground (`g.shut`), the open land past the town (`g.edgeLand`)
 * only where `edge` lets it, a house's garden (`g.garden`) only where `garden` does, a capital's paving (`g.square`) only
 * where `square` does and with SQUARE_MARGIN open round it;
 * a front onto no way (`g.street`, else the roads) costs YARD_FRONT_COST; nearest an exit (exitField) where `byExit` - the
 * Stable's - else nearest the middle. With no law laid (a bare yardGround) the Stable still keeps to the edge.
 * @param {{width: number, height: number, blocked: Uint8Array, road: Uint8Array, shut?: Uint8Array, street?: Uint8Array,
 *   edgeLand?: Uint8Array, square?: Uint8Array}} g @param {string} kind
 * @param {{ edge?: boolean, square?: boolean, byExit?: boolean, garden?: boolean }} [o]
 */
export const yardSite = (g, kind, o = {}) => stepsDone(yardSiteSteps(g, kind, o));
/** IC-STUTTER: yardSite a band of rows of a turn at a time - the same places weighed in the same order.
 *  @param {any} g @param {string} kind @param {{ edge?: boolean, square?: boolean, byExit?: boolean, garden?: boolean }} [o] */
export function* yardSiteSteps(
  g,
  kind,
  { edge = kind === 'stable', square = kind !== 'stable', byExit = kind === 'stable', garden = false } = {},
) {
  if (!g || !YARD_FOOT[kind]) return null;
  const { width: W, height: H } = g;
  const closed = summed(W, H, (x, y) => g.blocked[y * W + x]);
  const roads = summed(W, H, (x, y) => g.road[y * W + x]);
  const shut = g.shut,
    land = g.edgeLand,
    paving = g.square,
    ways = g.street,
    gardens = g.garden;
  const own = shut
    ? summed(W, H, (x, y) =>
        shut[y * W + x] ||
        (!edge && land?.[y * W + x]) ||
        (!square && paving?.[y * W + x]) ||
        (!garden && gardens?.[y * W + x])
          ? 1
          : 0,
      )
    : null;
  const plaza = paving && square ? summed(W, H, (x, y) => paving[y * W + x]) : null;
  const street = ways ? summed(W, H, (x, y) => ways[y * W + x]) : roads;
  yield;
  const toExit = byExit ? yield* exitFieldSteps(g) : null;
  const pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9),
    m = Math.max(pad, SQUARE_MARGIN);
  const mx = W / 2,
    my = H / 2;
  let best = null,
    bestScore = Infinity;
  for (let turn = 0; turn < 4; turn++) {
    const [nx, nz] = yardSpans(kind, turn);
    for (let gy = pad; gy + nz + pad <= H; gy++) {
      if ((gy - pad) % YARD_ROWS_A_STEP === YARD_ROWS_A_STEP - 1) yield;
      for (let gx = pad; gx + nx + pad <= W; gx++) {
        const cx = gx + nx / 2,
          cy = gy + nz / 2;
        // AUDIT MERCHANT-YARDS G2: Math.sqrt of an exact sum (half-cells squared), the same on every engine - Math.hypot
        // is approximated per engine, and put genuine ties (3.5, 3) and (4.5, 1) a rounding apart. IC-PROPS: by an exit,
        // its exit's (an integer chamfer, a third a cell)
        const d = toExit
          ? toExit[Math.floor(cy) * W + Math.floor(cx)] / 3
          : Math.sqrt((cx - mx) * (cx - mx) + (cy - my) * (cy - my));
        if (d > bestScore) continue; // facing a way only lowers the score to d: a place already further cannot win (one as far may tie, and ties go by the rule below)
        if (closed(gx - pad, gy - pad, gx + nx + pad, gy + nz + pad) !== 0) continue;
        if (roads(gx, gy, gx + nx, gy + nz) !== 0) continue;
        if (own && own(gx, gy, gx + nx, gy + nz) !== 0) continue; // IC-PROPS: never a way, a garden or ground not its kind's
        if (plaza && plaza(gx, gy, gx + nx, gy + nz) !== 0 && closed(gx - m, gy - m, gx + nx + m, gy + nz + m) !== 0)
          continue; // IC-PROPS: on paving, a plaza's middle
        const s = frontStrip(gx, gy, nx, nz, turn);
        const score = d + (street(s[0], s[1], s[2], s[3]) > 0 ? 0 : YARD_FRONT_COST);
        if (
          score < bestScore ||
          (score === bestScore &&
            best &&
            (gy < best.gy || (gy === best.gy && (gx < best.gx || (gx === best.gx && turn < best.turn)))))
        ) {
          bestScore = score;
          best = { gx, gy, nx, nz, turn };
        }
      }
    }
  }
  if (!best) return null;
  return {
    kind,
    turn: best.turn,
    yaw: YARD_TURNS[best.turn],
    x: (best.gx + best.nx / 2) * NAV_CELL,
    z: (best.gy + best.nz / 2) * NAV_CELL,
    gx: best.gx,
    gy: best.gy,
    nx: best.nx,
    nz: best.nz,
  };
}
/** IC-PROPS: a kind's place by the law, each step taken only where the town has no room left for the one before it: its own
 *  ground (the Stable's by an exit, its edge land with it; the Wagon Yard's and the joinery's nearest the middle, a plaza
 *  with it); the Wagon Yard and the joinery by an exit on the open land past the town, as the Stable stands; and last, a
 *  house's garden with the rest (YARD_LAW_STEPS) - so no town that stood a yard before stands none now. */
export const YARD_LAW_STEPS = Object.freeze([
  {},
  { edge: true, byExit: true },
  { edge: true, garden: true, square: true },
]);
function* lawSiteSteps(g, kind) {
  for (const [i, o] of YARD_LAW_STEPS.entries()) {
    if (i === 1 && kind === 'stable') continue; // the Stable's first step is already by an exit, its edge land with it
    const s = yield* yardSiteSteps(g, kind, o); // the Stable's edge and exit its own (yardSite's defaults)
    if (s) return s;
  }
  return null;
}

/** IC-PROPS: a kind's site among the ones a capital names for this ground (`g.fixed`, world/imperialYards.js), or null -
 *  never one over ground the ground has closed since (a yard placed before it). @param {any} g @param {string} kind */
function fixedSite(g, kind) {
  const s = g.fixed.find((t) => t.kind === kind);
  if (!s) return null;
  for (let gy = s.gy; gy < s.gy + s.nz; gy++)
    for (let gx = s.gx; gx < s.gx + s.nx; gx++)
      if (gx < 0 || gy < 0 || gx >= g.width || gy >= g.height || g.blocked[gy * g.width + gx]) return null;
  return {
    kind,
    turn: s.turn,
    yaw: YARD_TURNS[s.turn],
    x: (s.gx + s.nx / 2) * NAV_CELL,
    z: (s.gy + s.nz / 2) * NAV_CELL,
    gx: s.gx,
    gy: s.gy,
    nx: s.nx,
    nz: s.nz,
  };
}

/** Close a placed yard's ground and YARD_GAP_M round it on the placing grid (the next yard stands clear of it).
 *  SHIPYARDS: the port's two are placed on what the yards left, and close theirs the same way. */
export function closeSite(g, s) {
  const gap = Math.ceil(YARD_GAP_M / NAV_CELL - 1e-9);
  for (let gy = Math.max(0, s.gy - gap); gy < Math.min(g.height, s.gy + s.nz + gap); gy++) {
    for (let gx = Math.max(0, s.gx - gap); gx < Math.min(g.width, s.gx + s.nx + gap); gx++)
      g.blocked[gy * g.width + gx] = 1;
  }
}

/** BOTH YARDS on a ground, in YARD_KIND_ORDER: each placed on what the last left. Answers the sites found (none, one or
 *  both). Pure (it closes `g` as it goes - a ground is placed on once). */
export const yardSitesOn = (g) => stepsDone(yardSitesSteps(g));
/** IC-STUTTER: yardSitesOn a step at a time. @param {any} g */
export function* yardSitesSteps(g) {
  const place = function* (order) {
    const out = [];
    for (const kind of order) {
      const s = g.fixed ? fixedSite(g, kind) : yield* lawSiteSteps(g, kind); // IC-PROPS: a capital that names its own stands those
      if (!s) continue;
      out.push(s);
      closeSite(g, s);
    }
    return out;
  };
  // IC-PROPS: a Stable at the edge can take the one room a cramped town has for its Wagon Yard - where the order stands
  // fewer than both, the Wagon Yard is placed first on the same ground, and the order that stands more is kept (the first
  // on a tie), the sites in YARD_KIND_ORDER either way
  const was = Uint8Array.from(g.blocked),
    toExit = g.toExit;
  const out = yield* place(YARD_KIND_ORDER);
  if (out.length >= YARD_KIND_ORDER.length || g.fixed) return out;
  const kept = Uint8Array.from(g.blocked);
  g.blocked.set(was);
  g.toExit = toExit;
  const other = yield* place([...YARD_KIND_ORDER].reverse());
  if (other.length > out.length) return YARD_KIND_ORDER.flatMap((k) => other.filter((t) => t.kind === k));
  g.blocked.set(kept);
  return out;
}

/** FB1028 YARDS: a yard's place still good on a ground - its own cells on no road, no way and nothing shut, and its pad
 *  round it (YARD_PAD_M) clear of every closed cell: the wall's, a house's, the ground's edge. @param {any} g @param {any} s */
export function siteFits(g, s, gained = null) {
  const pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9),
    W = g.width;
  for (let y = s.gy - pad; y < s.gy + s.nz + pad; y++)
    for (let x = s.gx - pad; x < s.gx + s.nx + pad; x++) {
      const own = x >= s.gx && y >= s.gy && x < s.gx + s.nx && y < s.gy + s.nz;
      // AUDIT FB1028 B5: a cell only the wall's growth since #1184 closed (`gained`) breaks its own ground, not its pad
      if (x < 0 || y < 0 || x >= W || y >= g.height || (g.blocked[y * W + x] && (own || !gained?.[y * W + x])))
        return false;
      if (own && (g.road[y * W + x] || g.shut?.[y * W + x])) return false;
    }
  return true;
}

/**
 * FB1028 YARDS (the owner: a yard keeps its #1184 place unless that place is broken): THE YARDS KEPT, AND THE BROKEN ONES
 * PLACED AGAIN. `sites` were placed on #1184's ground; `g` is the ground as it stands now (the new wall and roads). A yard
 * whose place no longer fits it (siteFits) is placed again by its kind's law (lawSiteSteps) on `g`, every kept yard's and
 * `ports`' ground closed first - so none overlaps another. A port's place is kept as it is. @param {any} g
 * @param {any[]} sites @param {any[]} ports @returns {Generator<void, any[], void>}
 */
export function* keptSitesSteps(g, sites, ports = [], gained = null) {
  const broken = sites.filter((s) => YARD_FOOT[s.kind] && !siteFits(g, s, gained));
  if (!broken.length) return sites;
  for (const s of [...sites, ...ports]) if (!broken.includes(s)) closeSite(g, s);
  const out = [];
  for (const s of sites) {
    if (!broken.includes(s)) {
      out.push(s);
      continue;
    }
    const t = yield* lawSiteSteps(g, s.kind);
    if (t) {
      out.push(t);
      closeSite(g, t);
    }
  }
  return out;
}

/** FB1028 YARDS: keptSitesSteps on the town's ground as it stands now (`now` its shut, townGroundSteps' ground).
 *  @param {any} yl @param {any} measures @param {any} now @param {any} ways @param {any[]} sites @param {any[]} ports */
export function* keptTownSitesSteps(yl, measures, now, ways, sites, ports) {
  const g = yield* townGroundSteps(yl, measures?.now ? { ...measures.now, keep: measures.keep } : measures, now, ways); // FB1028 YARDS Y1: the gates' things as they stand
  if (!g) return sites;
  let gained = now?.gained?.() ?? null;
  // FB1028 YARDS Y1: and the cells only the gates' things closed since #1184 (stood clear of the grown towers) - as B5's
  // growth, a kept yard's pad may touch them, never its own ground
  const was = measures?.now ? yield* townGroundSteps(yl, measures, now, ways) : null;
  if (was) gained = g.blocked.map((v, i) => ((v && !was.blocked[i]) || gained?.[i] ? 1 : 0));
  return yield* keptSitesSteps(g, sites, ports, gained);
}

/** CARP-YARD: THE PROFESSIONS' YARDS on a ground, in CRAFT_YARD_ORDER, each on what the last left - placed by the host
 *  AFTER the two yards and a port town's places (scenes/world.js townPlacesFor), so none of theirs moves. Pure (it closes
 *  `g` as it goes). */
export const craftYardSitesOn = (g) => stepsDone(craftYardSitesSteps(g));
/** IC-STUTTER: craftYardSitesOn a step at a time. @param {any} g */
export function* craftYardSitesSteps(g) {
  const out = [];
  for (const kind of CRAFT_YARD_ORDER) {
    const s = g.fixed ? fixedSite(g, kind) : yield* lawSiteSteps(g, kind); // IC-PROPS
    if (!s) continue;
    out.push(s);
    closeSite(g, s);
  }
  return out;
}

/**
 * The yards of a laid-out location (world/locationLayout.js layoutLocation's `{width, height, blocks}`): its navgrid
 * carved on the enhanced lane's water table, its blocks' measures over it (`measures`, yardGround's), then
 * yardSitesOn. Pure.
 * @param {{width: number, height: number, blocks: any[]}} loc @param {Parameters<typeof yardGround>[1]} [measures]
 */
export function yardSitesOf(loc, measures = {}) {
  const g = townGroundOf(loc, measures);
  return g ? yardSitesOn(g) : [];
}
/**
 * SHIPYARDS (2026-10-11): A LAID-OUT TOWN'S PLACING GROUND - its navgrid carved on the enhanced lane's water table, its
 * blocks' measures over it (yardGround's) - or null for a layout with no blocks. The one ground a town's yards are placed
 * on (yardSitesOf), and the port's two after them (world/portSites.js portSitesOn: on what the yards left). Pure.
 * @param {{width: number, height: number, blocks: any[]}} loc @param {Parameters<typeof yardGround>[1]} [measures]
 */
export const townGroundOf = (loc, measures = {}, shut = null, ways = null) =>
  stepsDone(townGroundSteps(loc, measures, shut, ways));
/** IC-STUTTER: townGroundOf a block at a time, then yardGround's steps and the yards' law's. @param {{width: number, height: number, blocks: any[]}} loc
 *  @param {YardMeasures} [measures] @param {?((nav: any) => void)} [shut] @param {?{ plan?: any, fixed?: any[] | null }} [ways]
 *  @returns {Generator<void, ?YardGround, void>} */
export function* townGroundSteps(loc, measures = {}, shut = null, ways = null) {
  if (!loc?.blocks?.length || !(loc.width > 0) || !(loc.height > 0)) return null;
  const nav = new CityNavigation(loc.width, loc.height);
  for (const b of loc.blocks) {
    const fld = b.dfBlock?.rmbBlock?.fldHeader;
    if (!fld?.autoMapData || !fld.groundData?.groundTiles) continue;
    const tiles = fld.groundData.groundTiles;
    nav.setBlockData(b.x, b.y, fld.autoMapData, (tx, ty) => tiles[tx][ty].textureRecord, { enhancedWater: true });
    yield;
  }
  shut?.(nav); // TS7: the town's own ground, off its wall (world/townWalls.js townWalkShut)
  const g = yield* yardGroundSteps(nav, measures);
  yield* yardLawSteps(g, loc, nav, ways); // IC-PROPS: the yards' own ground, the town's streets and its edge
  return g;
}

/** The town map's bytes that are a building's (a building type's plus one - URBANIZER's fabricGrid reads them so). */
const isHouseByte = (a) => a >= 1 && a <= 23;
/** IC-PROPS: the open land a town's outline leaves (world/townOutline.js TOWN_OUTLINE_BLOCK) and its wall's carrier
 *  (world/townWalls.js townWallBlockName) - the land just past the town; a capital's own blocks (TESA - its plazas, courts
 *  and streets, world/tamrielCapitals.js); every other port cell (gardens, lakes) is neither. */
const isEdgeLandBlock = (name) => /^TES(AOPEN|W)/i.test(String(name ?? ''));
const isCapitalOwnBlock = (name) => /^TESA/i.test(String(name ?? '')) && !isEdgeLandBlock(name);
/**
 * IC-PROPS: THE YARDS' LAW OF A LAID-OUT TOWN on its placing ground (the header's IC-PROPS): `g.town` its own blocks' cells;
 * `g.shut` the cells no yard's own ground takes - the ways (where URBANIZER planned the town - `ways.plan`, world/urban/townFabric.js
 * - its main and side streets, pavements and alleys; the roads and paths are the ground's `road` already) and every cell
 * that is none of the town's, its edge land's or a plaza's; `g.garden` a house's garden (a piece of open grass of
 * FABRIC.yard's size touching a house along FABRIC.yardTouch cell edges; the plan's yards) - the law's last step;
 * `g.edgeLand` the open land past the town
 * within EDGE_LAND_CELLS of it; `g.square` a capital's own open paving; `g.street` the ways a yard's front opens onto (the
 * roads and paths, the plan's streets); `g.fixed` a capital's own sites (`ways.fixed`). Pure (it writes `g`).
 * @param {any} g @param {{width: number, height: number, blocks: any[]}} loc @param {any} nav
 * @param {?{ plan?: any, fixed?: any[] | null }} ways
 */
export const yardLaw = (g, loc, nav, ways = null) => stepsDone(yardLawSteps(g, loc, nav, ways));
/** IC-STUTTER: yardLaw a block, a band of rows or a garden's flood at a time. @param {any} g @param {any} loc @param {any} nav
 *  @param {?{ plan?: any, fixed?: any[] | null }} [ways] */
export function* yardLawSteps(g, loc, nav, ways = null) {
  const W = g.width,
    H = g.height,
    n = W * H,
    C = NAV_CELLS_PER_BLOCK;
  const shut = new Uint8Array(n),
    street = Uint8Array.from(g.road),
    town = new Uint8Array(n),
    land = new Uint8Array(n),
    square = new Uint8Array(n);
  const grass = new Uint8Array(n),
    house = new Uint8Array(n),
    garden = new Uint8Array(n);
  const open = (i) => nav.grid[i] >> 4 > 0;
  for (const b of loc.blocks) {
    yield;
    const fld = b.dfBlock?.rmbBlock?.fldHeader,
      tiles = fld?.groundData?.groundTiles,
      auto = fld?.autoMapData;
    const name = b.blockName ?? b.dfBlock?.name,
      port = isPortCell(name),
      edgeLand = port && isEdgeLandBlock(name),
      plaza = port && isCapitalOwnBlock(name);
    for (let ay = 0; ay < C; ay++) {
      for (let ax = 0; ax < C; ax++) {
        const i = (b.y * C + (C - 1 - ay)) * W + b.x * C + ax; // the walk grid's own flip (CityNavigation.setBlockData)
        if (port) {
          if (edgeLand && open(i)) land[i] = 1;
          else if (plaza && open(i)) square[i] = 1;
          continue;
        }
        town[i] = 1;
        if (auto && isHouseByte(auto[ay * C + ax])) house[i] = 1;
        if (((tiles?.[ax >> 2]?.[ay >> 2]?.textureRecord ?? -1) & 0x3f) === 2 && open(i)) grass[i] = 1;
      }
    }
  }
  // the edge land: only within EDGE_LAND_CELLS of the town's own ground
  let anyTown = false;
  for (let i = 0; i < n; i++)
    if (town[i]) {
      anyTown = true;
      break;
    }
  if (anyTown) {
    const near = yield* chamferSteps(W, H, town, 0x3fffffff);
    for (let i = 0; i < n; i++) if (land[i] && near[i] > 3 * EDGE_LAND_CELLS) land[i] = 0;
  } else land.fill(0);
  yield;
  for (let i = 0; i < n; i++) if (!town[i] && !land[i] && !square[i]) shut[i] = 1;
  // a house's garden: each piece of open grass (four-connected), FABRIC.yard[0] to FABRIC.yard[1] cells, touching a house
  // along FABRIC.yardTouch cell edges at the least - URBANIZER's yard, read as its plan reads it
  const seen = new Uint8Array(n),
    stack = [];
  for (let i0 = 0; i0 < n; i0++) {
    if (i0 && i0 % (YARD_ROWS_A_STEP * W) === 0) yield;
    if (!grass[i0] || seen[i0]) continue;
    const cells = [];
    let touch = 0;
    seen[i0] = 1;
    stack.push(i0);
    while (stack.length) {
      const i = /** @type {number} */ (stack.pop()),
        x = i % W,
        y = (i - x) / W;
      cells.push(i);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (house[j]) touch++;
        if (grass[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (cells.length >= FABRIC.yard[0] && cells.length <= FABRIC.yard[1] && touch >= FABRIC.yardTouch)
      for (const i of cells) garden[i] = 1;
  }
  // the town's fabric where it is planned: its ways and its yards (URBANIZER, past the Bay)
  yield;
  const plan = ways?.plan,
    K = FABRIC_KIND;
  if (plan?.kind && plan.W === W && plan.H === H) {
    for (let i = 0; i < n; i++) {
      const k = plan.kind[i];
      if (k === K.main || k === K.pave || k === K.side) {
        shut[i] = 1;
        street[i] = 1;
      } else if (k === K.alley) shut[i] = 1;
      else if (k === K.yard) garden[i] = 1;
    }
  }
  Object.assign(g, {
    town,
    shut,
    garden,
    street,
    edgeLand: land,
    square,
    toExit: null,
    fixed: Array.isArray(ways?.fixed) ? ways.fixed : null,
  });
  return g;
}

/**
 * AUDIT MERCHANT-YARDS R2 (the host measured these itself, and nothing pinned a line of it): WHAT A TOWN'S BLOCKS PUT IN
 * A YARD'S WAY, off its layout (layoutLocation's) - yardGround's `buildings`, `props`, `flats` and `closedBlocks`, each
 * in the location frame. Pure; the caller hands the measures:
 *   boxOf(modelIdNum, matrix) -> [x0, z0, x1, z1] | null  a placed model's box (placedModelBox below)
 *   fieldOf(modelIdNum) -> spec | null                   AUDIT G1: a field of flats (world/flatFields.js - the town mods'
 *                                                        crops: no mesh, and sown only with a nature archive), closed as
 *                                                        the ground its plants are sown over (fieldRect)
 *   millBox(matrix) -> [x0, z0, x1, z1] | null           a mill's body (a building - its sails turn over the street)
 *   flatsOf(block) -> [{ x, z }]                         the block's flats in its own frame - AUDIT G4: every one, the
 *                                                        editor's markers too (a start marker in a yard put the traveller
 *                                                        down inside its paddock)
 *   closedBlock(block) -> boolean                        a block left whole (a palace's court, the colosseum's)
 * A model with a recordIndex is a building's (BUILDING_CLEAR_M); any other a prop (PROP_CLEAR_M).
 * @param {any} yl
 * @param {{boxOf?: (id: number, at: ArrayLike<number>) => (number[]|null), fieldOf?: (id: number) => any, millBox?: (at: ArrayLike<number>) => (number[]|null),
 *   flatsOf?: (block: any) => any[], closedBlock?: (block: any) => boolean}} [measure]
 */
export const yardMeasuresOf = (yl, measure = {}) => stepsDone(yardMeasuresSteps(yl, measure));
/** IC-STUTTER: yardMeasuresOf a block at a time. @param {any} yl
 *  @param {{boxOf?: (id: number, at: ArrayLike<number>) => (number[]|null), fieldOf?: (id: number) => any, millBox?: (at: ArrayLike<number>) => (number[]|null),
 *   flatsOf?: (block: any) => any[], closedBlock?: (block: any) => boolean}} [measure] */
export function* yardMeasuresSteps(
  yl,
  {
    boxOf = () => null,
    fieldOf = () => null,
    millBox = () => null,
    flatsOf = () => [],
    closedBlock = () => false,
  } = {},
) {
  const one = (b) => {
    const buildings = [],
      props = [],
      flats = [],
      closedBlocks = [],
      origin = trs(b.originX, 0, b.originZ, 0, 0, 0);
    if (closedBlock(b)) closedBlocks.push([b.x, b.y]);
    for (const m of b.layout?.models ?? []) {
      const at = multiply(origin, m.matrix);
      const field = fieldOf(m.modelIdNum);
      if (field) {
        props.push(fieldRect(field, at));
        continue;
      }
      const box = boxOf(m.modelIdNum, at);
      if (box) (m.recordIndex != null ? buildings : props).push(box);
    }
    for (const w of b.layout?.windmills ?? []) {
      const box = millBox(multiply(origin, w.matrix));
      if (box) buildings.push(box);
    }
    for (const fl of flatsOf(b) ?? []) flats.push([b.originX + fl.x, b.originZ + fl.z]);
    return { buildings, props, flats, closedBlocks };
  };
  const all = (list) => ({
    buildings: list.flatMap((m) => m.buildings),
    props: list.flatMap((m) => m.props),
    flats: list.flatMap((m) => m.flats),
    closedBlocks: list.flatMap((m) => m.closedBlocks),
  });
  const was = [];
  for (const b of yl?.blocks ?? []) {
    yield;
    was.push(one(b));
  }
  if (!yl?.now) return all(was);
  // FB1028 YARDS Y1: a layout with its carrier as #1184 laid it (world/townWalls.js townWallYardLayout) - and the town's
  // as it stands, `now`, for keptTownSitesSteps; a block the two share measured once
  const now = [];
  for (const [i, b] of (yl.now.blocks ?? []).entries()) {
    yield;
    now.push(b === yl.blocks[i] ? was[i] : one(b));
  }
  return { ...all(was), now: all(now) };
}
/** AUDIT MERCHANT-YARDS G1: the ground a field of flats sows over, [x0, z0, x1, z1] - round the misc model's own point
 *  (`at`, its turn never read), half its range each way (flatFields.js sowField's `trunc(range / 2)`) and its noise.
 *  @param {any} spec @param {ArrayLike<number>} at */
export function fieldRect(spec, at) {
  const n = Number.isFinite(spec?.noise) ? spec.noise : 0;
  const hx = Math.trunc((spec?.rangeX ?? 0) / 2) + n,
    hz = Math.trunc((spec?.rangeZ ?? 0) / 2) + n;
  return [at[12] - hx, at[14] - hz, at[12] + hx, at[14] + hz];
}
/** AUDIT MERCHANT-YARDS G1: A PLACED MODEL'S BOX under `at`, [x0, z0, x1, z1] - a registered model's own geometry first
 *  (`custom(id)` its positions: the town mods' boulders, stalls, walls and domes, which no ARCH3D record holds and which
 *  were measured as nothing), else its ARCH3D size (`classic(id)`, the DaggerfallStaticBuildings box, inflated as DFU's)
 *  - or null where neither knows it. `cache` keeps a model's local box.
 *  @param {number} id @param {ArrayLike<number>} at
 *  @param {{custom?: (id: number) => (ArrayLike<number>|null), classic?: (id: number) => any, cache?: Map<number, number[]>|null}} [measure] */
export function placedModelBox(id, at, { custom = () => null, classic = () => null, cache = null } = {}) {
  const p = custom(id);
  if (p?.length) {
    let box = cache?.get(id);
    if (!box) {
      box = localAabb(p);
      cache?.set(id, box);
    }
    const w = transformedAabb(box, at);
    return [w[0], w[2], w[3], w[5]];
  }
  const sz = classic(id);
  if (!sz) return null;
  const { min, max } = staticBuildingWorldAabb(staticBuildingBox(sz), at);
  return [min[0], min[2], max[0], max[2]];
}

/** Close the yards' own ground on the wandering people's navgrid, so they walk round them (the gate's gap is no road
 *  of theirs). Answers how many cells it closed. */
export function carveYards(nav, sites) {
  if (!nav?.grid) return 0;
  let n = 0;
  for (const s of sites ?? []) {
    for (let gy = s.gy; gy < s.gy + s.nz; gy++)
      for (let gx = s.gx; gx < s.gx + s.nx; gx++) {
        if (!nav.inBounds(gx, gy)) continue;
        const i = gy * nav.width + gx;
        if (nav.grid[i] !== 0) {
          nav.grid[i] = 0;
          n++;
        }
      }
  }
  return n;
}
