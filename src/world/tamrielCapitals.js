// @ts-check
// TESA10 (2026-10-12, the owner: "Can we redesign each capital city as close to 1:1 with other games. For example,
// oblivion's capital, skyrims solitude, etc"; asked, "You build them yourself. No files needed"; bible/03-World/
// Arena-Provinces.md TESA10) - THE CAPITALS, BUILT BY HAND. A capital past the Bay is no clone of a Bay city: its block
// grid is laid out here, its districts of Daggerfall's own city blocks (the player's BLOCKS.BSA - a house, a shop, a
// guild, a temple, each with its interior and its people) round landmarks of the port's own (world/capitalModels.js: the
// White-Gold Tower, the Imperial City's walls and its bridges), each capital's signature in a layout of its own - never a
// copy of another game's level design. Pure: the world host (scenes/world.js `_locationToBuild`) asks it of a capital's
// pixel before anything else past the Bay, and stands the answer in its index.
//
// WHERE: the capital's point on Daggerfall's map of Tamriel (world/tamrielGeography.js CITIES - TAMRIEL1's, the port's own
// reading of the picture), on the live fit - every client's the same pixel, with Arena attached or not. With Arena
// attached, Arena's place of the capital's name stands on it too (world/arenaPlaces.js standArenaPixels' `pinned`), so its
// roads, its map ink and a portal's end all lead here (TESA-NO-FAST: the map is no journey past the Bay).
//
// THE IMPERIAL CITY (world/imperialCity.js, TESA11): City Isle in Lake Rumare over nine pixels - the White-Gold Tower on
// Green Emperor Way, the six walled districts round it on their sectors, the Prison, the University and the Waterfront
// outside the city wall, Talos Bridge west - each pixel's slice of its 24 x 24 plan a location of its own (`span`).
//
// A CAPITAL OVER SEVERAL PIXELS (`span`, TESA11): its plan is `span` pixels a side, eight cells a pixel; it stands on the
// pixel its search finds (capitalPixel - every one of its pixels its province's land) and the ones about it, each a
// SLICE (its index sy * span + sx from the north-west, the centre its main one) - a location of its own with its own id
// (capitalPlaceId's slice ordinal), its own name (`sliceNames`), the plan's cells under it and the buildings of its
// blocks; every slice flattened to the centre's ground (world/terrainGen.js flattenAt); Arena's place of its name pinned
// to the centre and no other place on the rest (world/arenaPlaces.js standArenaPixels' `reserved`); its landmarks each
// carried by its own slice (`carry`: a model's slice, the first of its own blocks there).
//
// THE BUILDINGS ARE THE BLOCKS' OWN (capitalBuildings): Daggerfall names, staffs and serves a building off its location's
// list, drawn by type in grid order (systems/talkTopics.js drawNamedBuildings); a capital's list is each block's own
// records in that order (its guild's faction, its temple's, its shop's quality) under name seeds of the capital's, so every
// building draws its own record and is named afresh.
//
// SOLITUDE (SOLITUDE_PLAN): a city on the shore of the Sea of Ghosts where the Karth meets it - the sea along the
// grid's north row, the river down its west two columns, the city walled on the land between them with fields south of
// its wall; in the river's mouth a sea stack with the Blue Palace on it, and the great arch from the stack to a terrace
// inside the city's west wall; Castle Dour and the Emperor's Tower in the city's east; the docks on the quay below the
// north wall - and round them its districts, Daggerfall's city blocks again.
//
// A PLAN READS AS A MAP: its first row the north. Daggerfall's block rows run from the south (DFU lays a location's
// block row y at Unity +z, north; the port keeps +z north), so the grid's row y is the plan's row (height - 1 - y)
// (capitalBlockNames); the landmarks are drawn as the map reads too (+z south) and turned into the world's frame where
// they are installed (world/capitalModels.js northward).
//
// A CAPITAL'S OWN BLOCKS (`blocks`, by the plan's cell): blocks of the port's own (capitalPortBlocks) whose ground, trees
// and closed cells are laws of the metres from its ANCHOR - the point its models stand at (`anchor`: a column and a row
// of the plan's lines) - x east, z south; and the first of them whose square has the anchor on it carries its models
// (`models`), every one's origin the anchor on its ground. The lake ('L') and the garden ('G') are every capital's.
//
// THE ID: its own lane (CAPITAL_LANE, after the lairs'), the capital's ordinal in the low 20 with 0x80000; its location
// index its own negative, past the lairs'.
import { mapPixelToLongitudeLatitude, LOCATION_TYPES } from '../formats/mapsFile.js';
import { hash32, BLOCK_M } from './spawnedDungeons.js';
import { pictureToBay, tamrielFit, inBay } from './tamrielFrame.js';
import { provinceKeyBeyondBay, tamrielLandVersion } from './tamrielLand.js';
import { IMPERIAL_CITY_PLAN, IMPERIAL_DISTRICTS, IMPERIAL_BLOCKS, IMPERIAL_MODELS, IMPERIAL_CARRY, IMPERIAL_SLICE_NAMES, IMPERIAL_SPAN } from './imperialCity.js';   // TESA11: the Imperial City over nine pixels
import {
  MOURNHOLD_PLAN, MOURNHOLD_DISTRICTS, MOURNHOLD_BLOCKS, ALINOR_PLAN, ALINOR_DISTRICTS, ALINOR_BLOCKS, FALINESTI_PLAN, FALINESTI_DISTRICTS,
  FALINESTI_BLOCKS, TORVAL_PLAN, TORVAL_DISTRICTS, TORVAL_BLOCKS, HELSTROM_PLAN, HELSTROM_DISTRICTS, HELSTROM_BLOCKS,
} from './capitalPlans.js';

/** The capitals' lane - after the country places' 64 (0x300-0x33f) and the lairs' (0x340). */
export const CAPITAL_LANE = 0x341;
/** The location indices count down from here, past the lairs' (-40,000,000 and down 2^19). */
export const CAPITAL_INDEX_BASE = 41000000;
/** The hash's salt. */
export const CAPITAL_SALT = 0xca9c;
/** The port blocks' fixed indices (formats/worldDataReplacement.js registerPortBlock: past any BSA; the arena's 900100;
 *  AUDIT-TESA: past the Shadow Realm's 900200 too - world/sdRealm.js SD_REALM_BLOCK_INDEX). */
export const CAPITAL_BLOCK_INDEX = 900400;
/** The port's own blocks a capital lays, by name. */
export const CAPITAL_BLOCKS = Object.freeze({
  lake: 'TESALAKE.RMB',
  garden: 'TESAGRDN.RMB',
});
/** The landmarks' model ids (world/customModels.js registerCustomModel) - far past any ARCH3D record. */
export const CAPITAL_MODELS = Object.freeze({
  ...IMPERIAL_MODELS,   // TESA11: the Imperial City's, from 910200
  solitudeArch: 910110, bluePalace: 910111, solitudeWall: 910112, castleDour: 910113, solitudeDocks: 910114,
  mournholdPlaza: 910120, highFane: 910121, mournholdPalace: 910122, greatBazaar: 910123, mournholdWall: 910124,
  alinorPalace: 910130, crystalTower: 910131, alinorHarbour: 910132, alinorWall: 910133,
  grahtOak: 910140,
  manePalace: 910150, twoMoonsTemple: 910151, torvalQuay: 910152, torvalWall: 910153,
  xanmeer: 910160, hist: 910161, helstromWalks: 910162, palisade: 910163,
});
/** RMB geometry: a block's side in its own units and in metres, its ground tiles, its automap cells. */
export const RMB_UNITS = 4096;
export { BLOCK_M };   // a block's side, metres (world/spawnedDungeons.js's: the terrain's eighth)
const TILE_M = 6.4, AUTO_M = 1.6;

export { IMPERIAL_CITY_PLAN, IMPERIAL_DISTRICTS, IMPERIAL_BLOCKS };   // TESA11: world/imperialCity.js's
/** A plan's cells: 'L' the lake, 'G' a garden, a code of the capital's own blocks, else a classic block's kind (its
 *  name's first four letters). Rows north to south (as a map reads - the grid's rows the other way), cells west to east
 *  (its x). */

/** SOLITUDE'S MEASURES, metres from its anchor (the grid point (2, 3): the city's west edge, level with the arch) - x
 *  east, z south: the sea stack, the arch (its deck from the stack's top to the terrace's, its opening between its
 *  springs over the river), the terrace and its ramp, the Blue Palace on the stack, the walls, Castle Dour, the keep and
 *  the Emperor's Tower, the quay and the docks. AUDIT-TESA A6-3: the walls and their towers clear of the city's blocks (they
 *  stood up to 2 m into a house's block on the north, south and west). */
export const SOLITUDE = Object.freeze({
  stack: Object.freeze({ x: -160, z: 0, r: 35, top: 30 }),
  arch: Object.freeze({ from: -128, to: 2, w: 28, topW: 30, topE: 14, springW: -112, springE: -8, crown: 14, parapet: 1.1 }),
  landing: Object.freeze({ x0: -4, x1: 40, w: 34, top: 14, rampTo: 76, rampW: 12 }),
  palace: Object.freeze({
    hall: Object.freeze({ x: -166, z: 0, w: 40, d: 22, h: 14, roof: 10 }),
    wing: Object.freeze({ x: -140, z: 0, w: 12, d: 34, h: 12, roof: 8 }),
    tower: Object.freeze({ s: 11, h: 38, spire: 16 }),
    turret: Object.freeze({ r: 4, h: 28, roof: 10 }),
  }),
  wall: Object.freeze({
    west: -7, north: -108, east: 604, south: 416, thick: 5, h: 14, tower: 10, towerH: 20, gate: 10, gateH: 9,
    northGate: 250, southGate: 300, archGap: 17,
    along: Object.freeze({ north: Object.freeze([100, 430]), south: Object.freeze([120, 470]), west: Object.freeze([150, 290]), east: Object.freeze([40, 170, 300]) }),
  }),
  castle: Object.freeze({ x: 512, z: 204.8, half: 32, thick: 4, h: 14, tower: 10, towerH: 22, gate: 9, gateH: 8 }),
  keep: Object.freeze({ dx: 10, dz: 0, w: 24, d: 28, h: 24, roof: 9 }),
  emperorsTower: Object.freeze({ dx: -16, dz: -18, s: 9, h: 46, roof: 12 }),
  quay: Object.freeze({ x0: 102.4, x1: 409.6 }),
  docks: Object.freeze({ edge: -153.6, piers: Object.freeze([140, 216]), pierTo: -250, pierW: 7, deck: 1.4, warehouse: Object.freeze({ x: 330, z: -130, w: 52, d: 18, h: 9, roof: 6 }) }),
});
/** Solitude's closed cells: the terrace and its ramp, the north wall's band (its gate open), the warehouse, Castle
 *  Dour's curtain (its gate open), its towers, its keep and the Emperor's Tower, and the east wall's band. */
function solitudeClosed(dx, dz) {
  const S = SOLITUDE, W = S.wall, L = S.landing, C = S.castle, half = W.thick / 2 + 0.5;
  if (dx >= 0 && dx < L.rampTo && Math.abs(dz) < L.w / 2) return true;
  if (Math.abs(dz - W.north) < half && Math.abs(dx - W.northGate) > W.gate / 2) return true;
  if (Math.abs(dx - W.east) < half && dz > W.north && dz < W.south) return true;
  const H = S.docks.warehouse;
  if (Math.abs(dx - H.x) < H.w / 2 && Math.abs(dz - H.z) < H.d / 2) return true;
  const cx = dx - C.x, cz = dz - C.z, r = Math.max(Math.abs(cx), Math.abs(cz));
  if (Math.abs(r - C.half) < C.thick / 2 + 0.5 && !(cx < 0 && Math.abs(cz) < C.gate / 2)) return true;
  if (Math.abs(Math.abs(cx) - C.half) < C.tower / 2 && Math.abs(Math.abs(cz) - C.half) < C.tower / 2) return true;
  const K = S.keep, E = S.emperorsTower;
  if (Math.abs(cx - K.dx) < K.w / 2 && Math.abs(cz - K.dz) < K.d / 2) return true;
  return Math.abs(cx - E.dx) < E.s / 2 && Math.abs(cz - E.dz) < E.s / 2;
}
/** Solitude's ground: the quay's stone to its edge and the sea past it, stone everywhere else its own blocks lie. */
const solitudeTile = (dx, dz) => (dz < SOLITUDE.docks.edge ? 0 : 3);
/** Solitude's own blocks: the terrace (two), the quay (three), Castle Dour's square (four). */
export const SOLITUDE_BLOCKS = Object.freeze(Object.fromEntries(['P0', 'P1', 'Q0', 'Q1', 'Q2', 'D0', 'D1', 'D2', 'D3'].map((code) => [code,
  Object.freeze({ name: `TESASO${code}.RMB`, tile: solitudeTile, closed: solitudeClosed })])));
export const SOLITUDE_PLAN = Object.freeze([
  'L L L L L L L L',
  'L L L Q0 Q1 Q2 L L',
  'L L P0 MAGE GENR TVRN RESI G',
  'L L P1 LIBR ALCH GEMS RESI G',
  'L L RESI BOOK ARMR TEMP D0 D1',
  'L L GRVE RESI PAWN RESI D2 D3',
  'L L G RESI TVRN BANK FIGH G',
  'L L G G G G G G',
].map((r) => Object.freeze(r.split(' '))));
/** Solitude's districts, by cell (x, y). */
export const SOLITUDE_DISTRICTS = Object.freeze({
  'Blue Palace': Object.freeze([[2, 2], [2, 3]]),
  'Solitude Docks': Object.freeze([[3, 1], [4, 1], [5, 1]]),
  'The Avenues District': Object.freeze([[3, 2], [4, 2], [5, 2], [4, 3], [5, 3], [4, 4]]),
  'Bards College': Object.freeze([[3, 3]]),
  'Castle Dour District': Object.freeze([[5, 4], [6, 4], [7, 4], [6, 5], [7, 5]]),
  'Hall of the Dead': Object.freeze([[2, 5]]),
  'The Well District': Object.freeze([[6, 2], [6, 3], [2, 4], [3, 4], [3, 5], [4, 5], [5, 5], [3, 6], [4, 6], [5, 6], [6, 6]]),
});

/** The capitals the port builds, in their ordinal order: the name (Arena's and TAMRIEL1's), the province, the point on
 *  the picture (world/tamrielGeography.js CITIES), whether it stands on the shore, the plan and its districts, its
 *  anchor, its start markers (AUDIT-TESA A6-1: the anchor's metres, on its own open ground - a plaza, a terrace, a
 *  quay), its own blocks and its models; its tag (AUDIT-TESA A6-2: its gardens' names, capitalGardenName); and (TESA11) its
 *  span in pixels, its slices' names and the slice each of its models is carried by - one pixel, its name and its carrier
 *  where it has none. */
export const CAPITALS = Object.freeze([
  Object.freeze({ key: 'imperial-city', tag: 'IC', name: 'Imperial City', province: 'Imperial', at: Object.freeze([178, 96]), shore: false, plan: IMPERIAL_CITY_PLAN, districts: IMPERIAL_DISTRICTS,
    span: IMPERIAL_SPAN, sliceNames: IMPERIAL_SLICE_NAMES, carry: IMPERIAL_CARRY,   // TESA11: nine pixels, each slice its district's
    gates: Object.freeze(['W']),   // TESA14: Talos Bridge, west to the mainland
    anchor: Object.freeze([12, 12]), markers: Object.freeze([[150, 0], [-150, 0], [0, 150], [0, -150]]), blocks: IMPERIAL_BLOCKS, models: Object.freeze(Object.values(IMPERIAL_MODELS)) }),
  Object.freeze({ key: 'solitude', tag: 'SO', name: 'Solitude', province: 'Skyrim', at: Object.freeze([136, 26]), shore: true, plan: SOLITUDE_PLAN, districts: SOLITUDE_DISTRICTS,
    gates: Object.freeze(['S']),   // TESA14: the main gate south (the north gate is the docks')
    anchor: Object.freeze([2, 3]), markers: Object.freeze([[90, -60], [90, 60], [200, -130]]), blocks: SOLITUDE_BLOCKS, models: Object.freeze([CAPITAL_MODELS.solitudeArch, CAPITAL_MODELS.bluePalace, CAPITAL_MODELS.solitudeWall, CAPITAL_MODELS.castleDour, CAPITAL_MODELS.solitudeDocks]) }),
  Object.freeze({ key: 'mournhold', tag: 'MH', name: 'Mournhold', province: 'Morrowind', at: Object.freeze([250, 92]), shore: false, plan: MOURNHOLD_PLAN, districts: MOURNHOLD_DISTRICTS,
    gates: Object.freeze(['N', 'E', 'S', 'W']),   // TESA14: a gate in each side of its wall
    anchor: Object.freeze([4, 4]), markers: Object.freeze([[40, 0], [-40, 0], [0, 40], [0, -40]]), blocks: MOURNHOLD_BLOCKS, models: Object.freeze([CAPITAL_MODELS.mournholdPlaza, CAPITAL_MODELS.highFane, CAPITAL_MODELS.mournholdPalace, CAPITAL_MODELS.greatBazaar, CAPITAL_MODELS.mournholdWall]) }),
  Object.freeze({ key: 'alinor', tag: 'AL', name: 'Alinor', province: 'Sumurset', at: Object.freeze([38, 154]), shore: true, plan: ALINOR_PLAN, districts: ALINOR_DISTRICTS,
    gates: Object.freeze(['N', 'E', 'W']),   // TESA14: its three landward sides (the harbour south)
    anchor: Object.freeze([4, 2]), markers: Object.freeze([[0, 60], [-75, -60], [75, -60], [100, 440]]), blocks: ALINOR_BLOCKS, models: Object.freeze([CAPITAL_MODELS.alinorPalace, CAPITAL_MODELS.crystalTower, CAPITAL_MODELS.alinorHarbour, CAPITAL_MODELS.alinorWall]) }),
  Object.freeze({ key: 'falinesti', tag: 'FA', name: 'Falinesti', province: 'Valenwood', at: Object.freeze([118, 150]), shore: false, plan: FALINESTI_PLAN, districts: FALINESTI_DISTRICTS,
    gates: Object.freeze(['N', 'E', 'S', 'W']),   // TESA14: no wall but the forest
    anchor: Object.freeze([4, 4]), markers: Object.freeze([[80, 0], [-80, 0], [0, 80], [0, -80]]), blocks: FALINESTI_BLOCKS, models: Object.freeze([CAPITAL_MODELS.grahtOak]) }),
  Object.freeze({ key: 'torval', tag: 'TO', name: 'Torval', province: 'Elsweyr', at: Object.freeze([156, 168]), shore: true, plan: TORVAL_PLAN, districts: TORVAL_DISTRICTS,
    gates: Object.freeze(['N', 'E', 'W']),   // TESA14: its landward sides (the quay on Topal Bay, south)
    anchor: Object.freeze([4, 3]), markers: Object.freeze([[0, 20], [-60, 20], [60, 20], [100, 340]]), blocks: TORVAL_BLOCKS, models: Object.freeze([CAPITAL_MODELS.manePalace, CAPITAL_MODELS.twoMoonsTemple, CAPITAL_MODELS.torvalQuay, CAPITAL_MODELS.torvalWall]) }),
  Object.freeze({ key: 'helstrom', tag: 'HE', name: 'Helstrom', province: 'BlackMarsh', at: Object.freeze([254, 128]), shore: false, plan: HELSTROM_PLAN, districts: HELSTROM_DISTRICTS,
    gates: Object.freeze(['N', 'S']),   // TESA14: the palisade's north and south gates
    anchor: Object.freeze([4, 3]), markers: Object.freeze([[70, 0], [-70, 0], [0, 70], [0, -70]]), blocks: HELSTROM_BLOCKS, models: Object.freeze([CAPITAL_MODELS.xanmeer, CAPITAL_MODELS.hist, CAPITAL_MODELS.helstromWalks, CAPITAL_MODELS.palisade]) }),
]);

/** A capital's map id, its location index, and whether a map id is a capital's - TESA11: each slice's, by its ordinal (0
 *  the centre's - the capital's own - then the others in their order, sixteen ordinals apart). */
export const capitalPlaceId = (k, so = 0) => ((CAPITAL_LANE << 20) | 0x80000 | (k + 16 * so)) >>> 0;
export const capitalLocationIndex = (k, so = 0) => -(CAPITAL_INDEX_BASE + k + 16 * so);
/** TESA11: a capital's span in pixels, its centre slice's index, and a slice's ordinal (the centre 0, the rest 1 on). */
export const capitalSpan = (cap) => cap?.span ?? 1;
export const capitalCentre = (cap) => (capitalSpan(cap) ** 2 - 1) / 2;
export const capitalSliceOrdinal = (cap, s) => { const c = capitalCentre(cap); return s === c ? 0 : 1 + (s < c ? s : s - 1); };
/** TESA11: a slice's name - the centre's the capital's. */
export const capitalSliceName = (cap, s) => (s === capitalCentre(cap) ? cap.name : cap.sliceNames?.[s] ?? cap.name);
export const isCapitalPlaceId = (id) => ((Number(id) >>> 20) & 0xfff) === CAPITAL_LANE && ((Number(id) >>> 0) & 0x80000) !== 0;

/** How far, Bay pixels, a capital looks from its point for its own province's land - however far the picture's coast
 *  lies from TAMRIEL1's point (world/arenaPlaces.js SHORE_REACH's). */
export const CAPITAL_REACH = 320;
const RING8 = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
/** Is a pixel past the Bay the sea - no province's land under its centre (world/tamrielLand.js: the trace's, or the
 *  authored shape's where none is set). */
const seaAt = (bx, by) => !inBay(bx, by) && provinceKeyBeyondBay(bx, by) === null;
/**
 * A CAPITAL'S PIXEL on the live fit and the land: the nearest pixel to its picture point's centre - ring by ring out to
 * CAPITAL_REACH, in each ring the nearest centre - whose centre is its own province's land past the Bay, and, for a
 * capital on the shore, one of whose eight is the sea; or null where none is in reach. The point itself where it is.
 * TESA11: a capital over several pixels - the centre's, every pixel of its span its province's land.
 */
export function capitalPixel(cap) {
  const [x, y] = pictureToBay(cap.at[0] + 0.5, cap.at[1] + 0.5);
  const one = (bx, by) => !inBay(bx, by) && provinceKeyBeyondBay(bx, by) === cap.province;
  // TESA11: a capital over several pixels wants every one of them its province's land
  const h = (capitalSpan(cap) - 1) / 2;
  const own = h ? (bx, by) => { for (let dy = -h; dy <= h; dy++) for (let dx = -h; dx <= h; dx++) if (!one(bx + dx, by + dy)) return false; return true; } : one;
  const ok = cap.shore ? (bx, by) => own(bx, by) && RING8.some(([dx, dy]) => seaAt(bx + dx, by + dy)) : own;
  const fx = Math.floor(x), fy = Math.floor(y);
  if (ok(fx, fy)) return { px: fx, py: fy };
  for (let r = 1; r <= CAPITAL_REACH; r++) {
    let at = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      // the ring alone - the ones inside it were asked (AUDIT-TESA A4-F5: walked, not skipped: its top and bottom rows
      // whole, its sides their two ends - the same cells in the same order, 8r a ring and never (2r + 1)^2)
      for (let dx = -r; dx <= r; dx += Math.abs(dy) === r ? 1 : 2 * r) {
        const d = Math.hypot(fx + dx + 0.5 - x, fy + dy + 0.5 - y);
        if (d < bd && ok(fx + dx, fy + dy)) { bd = d; at = { px: fx + dx, py: fy + dy }; }
      }
    }
    if (at) return at;
  }
  return null;
}
const _onPixel = { fit: null, land: -1, pixels: [], byPixel: new Map() };
/** Every capital's pixel (or null), kept a fit and a land. */
function capitalPixels() {
  const fit = tamrielFit(), land = tamrielLandVersion();
  if (_onPixel.fit !== fit || _onPixel.land !== land) {
    _onPixel.fit = fit;
    _onPixel.land = land;
    _onPixel.pixels = CAPITALS.map((cap) => capitalPixel(cap));
    _onPixel.byPixel = new Map();
    // TESA11: every slice of a capital over several pixels, each its index (sy * span + sx) and its place in the span
    _onPixel.pixels.forEach((p, k) => {
      if (!p) return;
      const cap = CAPITALS[k], n = capitalSpan(cap), h = (n - 1) / 2;
      for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) {
        const key = `${p.px + sx - h},${p.py + sy - h}`;
        if (!_onPixel.byPixel.has(key)) _onPixel.byPixel.set(key, Object.freeze({ cap, k, s: sy * n + sx, slice: Object.freeze([sx, sy]), centre: p }));
      }
    });
  }
  return _onPixel;
}
/** The capital standing on a Bay pixel, or null - kept a fit and a land: its entry, its ordinal, and (TESA11) the slice
 *  standing there (`s`, `slice`) and its centre's pixel. */
export function capitalOnPixel(px, py) {
  return capitalPixels().byPixel.get(`${px},${py}`) ?? null;
}
/** TESA14: a gate's step out of the capital, by its side. */
export const GATE_STEPS = Object.freeze({ N: Object.freeze([0, -1]), E: Object.freeze([1, 0]), S: Object.freeze([0, 1]), W: Object.freeze([-1, 0]) });
/**
 * TESA14: WHERE THE ROADS COME TO A CAPITAL - for each of its gates (CAPITALS `gates`, its plan's gates and bridges), the
 * pixel just outside its span at the side's middle, and the step from it into the city: a road ends there, at the
 * city's edge, never across its own pixels - a lake, a harbour, a canal (world/tamrielRoads.js). None for a capital with
 * no pixel on the live fit and land.
 * @param {number} k the capital's ordinal @returns {Array<{ x: number, y: number, into: readonly number[], side: string }>}
 */
export function capitalGates(k) {
  const cap = CAPITALS[k], at = capitalPixels().pixels[k];
  if (!cap || !at) return [];
  const h = (capitalSpan(cap) - 1) / 2;
  return (cap.gates ?? []).map((side) => {
    const [dx, dy] = GATE_STEPS[side];
    return { x: at.px + dx * (h + 1), y: at.py + dy * (h + 1), into: Object.freeze([-dx, -dy]), side };
  });
}
/** TESA14: a capital's own pixels on the live fit and land - every slice of its span - or none. */
export function capitalSpanPixels(k) {
  const cap = CAPITALS[k], at = capitalPixels().pixels[k];
  if (!cap || !at) return [];
  const n = capitalSpan(cap), h = (n - 1) / 2, out = [];
  for (let dy = -h; dy <= h; dy++) for (let dx = -h; dx <= h; dx++) out.push({ x: at.px + dx, y: at.py + dy });
  return out;
}
let _standing = false, _version = 0;
/** TESA10d: does a host stand the capitals - the world host with the land past the Bay and the capitals' door open (its
 *  boot says so; Arena attached or not). The map's ink of a capital, and a portal's end there, read it; a change moves the version, so the
 *  ink is made again. */
export function setCapitalsStanding(on) {
  if (!!on === _standing) return;
  _standing = !!on;
  _version++;
}
export const capitalsStanding = () => _standing;
export const capitalsVersion = () => _version;
/** ARENA (world/arenaPlaces.js standArenaPixels' `pinned`): the pixel an Arena place of a capital's name stands on - the
 *  capital's - or null for any other place, or a capital with no pixel. */
export function capitalPin(place) {
  const k = CAPITALS.findIndex((c) => c.name === place?.name && c.province === place?.province);
  return k < 0 ? null : capitalPixels().pixels[k];
}

// ---------------------------------------------------------------- the blocks

/** The city a capital stands on the shape of: the first TownCity of the game's rows in map-id order with an exterior and
 *  no dungeon, never a main-story place nor one the port made - the fields a city carries that a plan does not say.
 * @param {Iterable<any>} rows @param {(mapId: number) => boolean} [isMain] */
export function capitalBase(rows, isMain = () => false) {
  const id = (l) => (l?.mapTableData?.mapId ?? 0) >>> 0;
  return [...(rows ?? [])].filter((l) => l?.mapTableData?.locationType === LOCATION_TYPES.TownCity && l.exterior?.exteriorData && !l.hasDungeon
    && !l.spawned && !l.ether && !l.arena && !l.country && !l.capital && !isMain(id(l))).sort((a, b) => id(a) - id(b))[0] ?? null;
}

/** The classic city blocks by kind: every name a city of the game's rows lays, grouped by its first four letters,
 *  each group sorted - no wall, no palace (a palace stands its own castle). */
export function cityBlockNames(rows) {
  const out = new Map();
  for (const l of rows ?? []) {
    if (l?.mapTableData?.locationType !== LOCATION_TYPES.TownCity) continue;
    for (const n of l.exterior?.exteriorData?.blockNames ?? []) {
      const kind = String(n).slice(0, 4);
      if (kind === 'WALL' || kind === 'PALA') continue;
      if (!out.has(kind)) out.set(kind, new Set());
      out.get(kind).add(n);
    }
  }
  return new Map([...out].map(([k, s]) => [k, [...s].sort()]));
}

/** AUDIT-TESA A6-2: a capital's garden at its plan's (cx, r) - a block of its own, so the walls a capital's models raise
 *  over it close its ground and keep its trees off them (capitalPortBlocks' `footprint`). */
export const capitalGardenName = (cap, cx, r) => `TESG${cap.tag}${r.toString(36)}${cx.toString(36)}.RMB`;   // TESA11: base 36 - a 24-cell plan's rows and columns one character each

/** TESA11: the kinds a cell falls back to where the game's cities lay none of its own (a release short of one). */
const FALLBACK_KINDS = Object.freeze(['RESI', 'GENR']);
/** A plan's block names in the grid's order (row by row from the SOUTH - the plan's last row first): the port's own for
 *  its lake, its gardens (the capital's own, capitalGardenName) and the capital's own blocks (`own`, the capital's `blocks`), a classic block of each other
 *  cell's kind off the cell's hash (its plan column and row) - the kind's fallbacks where it has none, null where they
 *  have none either. TESA11: `at` the plan's cell the given plan's first cell is (a slice's), the hash and the gardens
 *  the whole plan's. */
export function capitalBlockNames(plan, k, names, own = CAPITALS[k]?.blocks ?? {}, at = [0, 0]) {
  const out = [], [x0, r0] = at;
  for (let r = plan.length - 1; r >= 0; r--) {
    for (let x = 0; x < plan[r].length; x++) {
      const cell = plan[r][x];
      if (cell === 'L') out.push(CAPITAL_BLOCKS.lake);
      else if (cell === 'G') out.push(CAPITALS[k] ? capitalGardenName(CAPITALS[k], x0 + x, r0 + r) : CAPITAL_BLOCKS.garden);   // AUDIT-TESA A6-2: its own
      else if (Object.hasOwn(own, cell)) out.push(own[cell].name);
      else {
        const list = [cell, ...FALLBACK_KINDS].map((kind) => names?.get(kind)).find((l) => l?.length);
        if (!list) return null;
        out.push(list[hash32(CAPITAL_SALT, k, x0 + x, r0 + r) % list.length]);
      }
    }
  }
  return out;
}

/** The named building types (world/buildingNames.js NAMED_BUILDING_TYPES): the ones a location's list speaks for. */
const NAMED = new Set([0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
/**
 * THE BUILDINGS: each classic block's own records (its RMB's building data, up to its record count) in grid order, the
 * named ones alone, each under a name seed of the capital's (1 to 65535), its sector the cell and its location id the
 * capital's.
 * TESA11: `seedBase` a slice's (its ordinal's 64 sectors), so no two slices' buildings share a seed.
 * @param {string[]} blockNames @param {(name: string) => any} blockOf @param {number} k @param {number} locationId
 */
export function capitalBuildings(blockNames, blockOf, k, locationId, seedBase = 0) {
  const out = [];
  blockNames.forEach((name, sector) => {
    const fh = blockOf(name)?.rmbBlock?.fldHeader;
    if (!fh) return;
    const n = fh.numBlockDataRecords ?? 0;
    for (let r = 0; r < n; r++) {
      const d = fh.buildingDataList?.[r];
      if (!d || !NAMED.has(d.buildingType)) continue;
      out.push({ ...d, nameSeed: (hash32(CAPITAL_SALT, k, seedBase + sector, r, 7) % 65535) + 1, sector, locationId });
    }
  });
  return out;
}

// ---------------------------------------------------------------- the port blocks

/** A tile's centre and an automap cell's, in the block's own metres (x east, z the grid's y): the stamp flips both rows
 *  (world/terrainTiles.js setLocationTiles `[x][15 - y]`, world/cityNavigation.js setBlockData `63 - y`). */
export const tileCentre = (tx, ty) => [(tx + 0.5) * TILE_M, (15 - ty + 0.5) * TILE_M];
export const autoCentre = (ax, ay) => [(ax + 0.5) * AUTO_M, (63 - ay + 0.5) * AUTO_M];

/** AUDIT-TESA A6-5: a closed automap cell's byte - in no quarter and no show-all byte (ui/townQuarters.js quarterOf,
 *  isShowAllByte): the walkers' navgrid shut there (world/cityNavigation.js: any byte but 0), the town map painting none
 *  - a wall's byte 1 was BuildingType 0 + 1, an alchemist's, drawn and pressed as a shop. */
export const CAPITAL_CLOSED_BYTE = 0xfe;
/** A block of the port's own in DFU's world-data JSON (formats/worldDataReplacement.js blockFromJson): its ground tiles
 *  (`tile(x, z)` - a record, by the tile centre's metres), its trees (`tree(x, z)` - a scenery record or -1), its automap
 *  (`closed(x, z)`), its misc models and (AUDIT-TESA A6-1) its flats.
 * @param {string} name
 * @param {{ tile: (x: number, z: number) => number, tree?: (x: number, z: number) => number, closed?: (x: number, z: number) => boolean, models?: any[], flats?: any[] }} o */
export function portBlockJson(name, { tile, tree = () => -1, closed = () => false, models = [], flats = [] }) {
  const GroundTiles = [], GroundScenery = [], AutoMapData = [];
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      const [x, z] = tileCentre(tx, ty);
      GroundTiles.push({ TileBitfield: tile(x, z) & 0x3f });
      GroundScenery.push({ TextureRecord: tree(x, z) });
    }
  }
  for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) { const [x, z] = autoCentre(ax, ay); AutoMapData.push(closed(x, z) ? CAPITAL_CLOSED_BYTE : 0); }
  return {
    Name: name, Type: 'Rmb', Position: 0,
    RmbBlock: { FldHeader: { GroundData: { GroundTiles, GroundScenery }, AutoMapData, BuildingDataList: [], Name: name }, SubRecords: [], Misc3dObjectRecords: models, MiscFlatObjectRecords: flats },
  };
}
/** AUDIT-TESA A6-1: a START MARKER at a block's metres (x, z) on the ground - the editor's flat (archive 199, record 10:
 *  world/locationEntrance.js locationStartMarkers) an arrival - a portal's, a load's, a respawn's - lands by; DFU's flat record law
 *  (world/rmbFlats.js collectBlockFlats: x * 0.025, z + 4096). */
export const startMarkerAt = (x, z) => ({ Position: 0, XPos: Math.round(x / 0.025), YPos: 0, ZPos: Math.round(z / 0.025) - RMB_UNITS, TextureArchive: 199, TextureRecord: 10, FactionID: 0, Flags: 0 });
/** A misc model at a block's metres (x, z) on the ground, by DFU's own record law (world/rmbLayout.js: x * 0.025,
 *  (-y + PROPS_OFFSET_Y) * 0.025, (z + 4096) * 0.025). */
export const miscModelAt = (id, x, z) => ({ ModelId: String(id), ModelIdNum: id, ObjectType: 0, XPos: Math.round(x / 0.025), YPos: -4, ZPos: Math.round(z / 0.025) - RMB_UNITS, XRotation: 0, YRotation: 0, ZRotation: 0 });

/** A garden's trees: one tile in five off its hash, of the climate's own trees (scenery records 12, 15, 16, 18). */
const GARDEN_TREES = Object.freeze([12, 15, 16, 18]);

/** The code of a capital's own block that carries its models: the first in its plan's order whose square has the
 *  anchor on it (its edge or its corner), or null. */
export function capitalCarrier(cap) {
  const [ax, ar] = cap.anchor;
  for (let r = 0; r < cap.plan.length; r++) {
    for (let cx = 0; cx < cap.plan[r].length; cx++) {
      const cell = cap.plan[r][cx];
      if (Object.hasOwn(cap.blocks, cell) && cx <= ax && ax <= cx + 1 && r <= ar && ar <= r + 1) return cell;
    }
  }
  return null;
}
/** TESA11: the own block each of a capital's models is carried by - its slice's (`carry`: the first of its own blocks in
 *  the slice, in the plan's order; the centre's the anchor's), else the anchor's (capitalCarrier) - by model id. */
export function capitalModelCarriers(cap) {
  const out = new Map(), n = capitalSpan(cap), anchor = capitalCarrier(cap), first = new Map([[capitalCentre(cap), anchor]]);   // the centre's the anchor's
  cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
    const s = Math.floor(r / 8) * n + Math.floor(cx / 8);
    if (Object.hasOwn(cap.blocks, cell) && !first.has(s)) first.set(s, cell);
  }));
  for (const id of cap.models) out.set(id, cap.carry && Object.hasOwn(cap.carry, id) ? first.get(cap.carry[id]) ?? anchor : anchor);
  return out;
}
/** A capital's own block at the plan's (cx, r): the anchor's metres (x east, z south) of its own metres (x east, z
 *  north - the block's, world/rmbLayout.js and tileCentre's). */
export const anchorMetres = (cap, cx, r, x, z) => [(cx - cap.anchor[0]) * BLOCK_M + x, (r + 1 - cap.anchor[1]) * BLOCK_M - z];

/** A garden's tree at a tile's centre (x, z, the block's metres): one in five off its hash, of the climate's own. */
const gardenTree = (x, z) => { const h = hash32(CAPITAL_SALT, Math.floor(x), Math.floor(z), 9); return h % 5 === 0 ? GARDEN_TREES[(h >>> 3) % GARDEN_TREES.length] : -1; };
/** A tile's sixteen automap cells' centres about its centre: a tree stands only where none of them is under a model. */
const TILE_CELLS = Object.freeze([-2.4, -0.8, 0.8, 2.4].flatMap((a) => [-2.4, -0.8, 0.8, 2.4].map((b) => Object.freeze([a, b]))));

/**
 * THE PORT'S BLOCKS: the lake (all water) and the garden (grass and trees), every capital's; then each capital's own
 * (its `blocks`, in its plan's order), their ground, trees and closed cells its laws of the metres from its anchor - and
 * the one capitalCarrier names carrying its models there; then each capital's gardens (AUDIT-TESA A6-2), the shared
 * garden's grass and trees at its plan's cells. `footprint(cap)` (world/capitalModels.js capitalFootprint) answers
 * where the capital's models stand - `(x, z) => boolean`, the anchor's metres - and every one of its blocks closes its
 * automap there, its gardens' trees kept off it: a wall the models raise over a garden or an own block is a wall to the
 * walkers too (world/cityNavigation.js), not ground to cross. Each block's JSON is built when it is first read
 * (`json`, a getter; formats/worldDataReplacement.js registerPortBlock takes it as a function), the footprint with
 * it: a capital's models are built when one of its blocks is.
 * @param {{ footprint?: (cap: any) => ((x: number, z: number) => boolean) | null }} [o]
 * @returns {Array<{ name: string, index: number, json: any }>}
 */
export function capitalPortBlocks({ footprint = null } = {}) {
  const out = [];
  const lazy = (name, index, make) => { let json = null; out.push({ name, index, get json() { return (json ??= make()); } }); };
  out.push({ name: CAPITAL_BLOCKS.lake, index: CAPITAL_BLOCK_INDEX, json: portBlockJson(CAPITAL_BLOCKS.lake, { tile: () => 0 }) });
  out.push({ name: CAPITAL_BLOCKS.garden, index: CAPITAL_BLOCK_INDEX + 1, json: portBlockJson(CAPITAL_BLOCKS.garden, { tile: () => 2, tree: gardenTree }) });
  const stands = new Map();
  const standsOf = (cap) => { if (!stands.has(cap.key)) stands.set(cap.key, footprint?.(cap) ?? null); return stands.get(cap.key); };
  for (const cap of CAPITALS) {
    const carrier = capitalCarrier(cap), carriers = capitalModelCarriers(cap);
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
      const own = Object.hasOwn(cap.blocks, cell) ? cap.blocks[cell] : null;
      if (!own) return;
      // the anchor in the block's own metres: where anchorMetres answers (0, 0)
      const at = [(cap.anchor[0] - cx) * BLOCK_M, (r + 1 - cap.anchor[1]) * BLOCK_M];
      lazy(own.name, CAPITAL_BLOCK_INDEX + out.length, () => {
        const under = standsOf(cap), on = (x, z) => !!under?.(...anchorMetres(cap, cx, r, x, z));
        return portBlockJson(own.name, {
          tile: (x, z) => own.tile(...anchorMetres(cap, cx, r, x, z)),
          closed: (x, z) => { const [dx, dz] = anchorMetres(cap, cx, r, x, z); return own.closed(dx, dz) || !!under?.(dx, dz); },
          // TESA11: a block's own trees where its law plants them, off the models' feet as a garden's are
          ...(own.tree ? { tree: (x, z) => (TILE_CELLS.some(([a, b]) => on(x + a, z + b)) ? -1 : own.tree(...anchorMetres(cap, cx, r, x, z))) } : {}),
          // TESA11: the models its slice carries, each on the first of the slice's own blocks
          models: cap.models.filter((id) => carriers.get(id) === cell).map((id) => miscModelAt(id, at[0], at[1])),
          // AUDIT-TESA A6-1: its start markers with them, the anchor's metres (z south) to the block's (z north)
          flats: cell === carrier ? (cap.markers ?? []).map(([dx, dz]) => startMarkerAt(at[0] + dx, at[1] - dz)) : [],
        });
      });
    }));
  }
  for (const cap of CAPITALS) {
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
      if (cell !== 'G') return;
      const name = capitalGardenName(cap, cx, r);
      lazy(name, CAPITAL_BLOCK_INDEX + out.length, () => {
        const under = standsOf(cap), on = (x, z) => !!under?.(...anchorMetres(cap, cx, r, x, z));
        return portBlockJson(name, { tile: () => 2, tree: (x, z) => (TILE_CELLS.some(([a, b]) => on(x + a, z + b)) ? -1 : gardenTree(x, z)), closed: on });
      });
    }));
  }
  return out;
}

// ---------------------------------------------------------------- the location

/** AUDIT-TESA A6-4: the kinds of Daggerfall's city blocks that can carry a canal or a quay's water (CUST - a town on the
 *  water's), and how many water tiles (record 0) make a block wet. */
const WET_KINDS = Object.freeze(['CUST']);
const WET_TILES = 8;
/** AUDIT-TESA A6-4: AN INLAND CAPITAL'S BLOCKS - each wet kind's list (`names`) kept to its dry blocks (`blockOf(name)`'s
 *  ground holds fewer than WET_TILES water tiles), so no canal runs out of a city on no water (Mournhold's did); the
 *  list whole where none of it is dry. */
export function dryKinds(names, blockOf) {
  if (!names) return names;
  const out = new Map(names);
  for (const kind of WET_KINDS) {
    const list = names.get(kind);
    if (!list?.length) continue;
    const wet = (name) => { let n = 0; for (const col of blockOf(name)?.rmbBlock?.fldHeader?.groundData?.groundTiles ?? []) for (const t of col ?? []) if (t?.textureRecord === 0) n++; return n >= WET_TILES; };
    const dry = list.filter((name) => !wet(name));
    if (dry.length) out.set(kind, dry);
  }
  return out;
}

/**
 * A CAPITAL'S LOCATION: a city of its own on `base`'s shape (a TownCity row of the game's, for the fields a city carries
 * that the plan does not say) - its plan's block grid, its blocks' own buildings, its id, its index, the pixel's longitude
 * and latitude, its name, the region the host says, no dungeon, and `capital` (its key and ordinal). `arena` the Arena
 * place standing on its pixel, where one does (world/arenaPlaces.js; the sweep and the ports read it). Null where a
 * kind of the plan has no block among the game's cities. TESA11: a slice's (`s`, the centre's by default) - its cells of
 * the plan, its name, its id and index by its ordinal, its buildings' seeds its own, and the centre pixel its ground is
 * flattened to (`capital.flattenAt`).
 * @param {{ cap: any, k: number, s?: number }} at capitalOnPixel's
 * @param {{ base: any, names: Map<string, string[]>, blockOf: (name: string) => any, px: number, py: number,
 *   where?: { regionIndex?: number, regionName?: string, politic?: number, climate?: any }, arena?: any }} ctx
 */
export function synthesizeCapitalLocation({ cap, k, s = capitalCentre(cap) }, ctx) {
  // TESA11: a capital over several pixels - the slice's eight-by-eight of the plan, its hash and its gardens the plan's
  const n = capitalSpan(cap), sx = s % n, sy = Math.floor(s / n), so = capitalSliceOrdinal(cap, s);
  const plan = n > 1 ? cap.plan.slice(sy * 8, sy * 8 + 8).map((row) => row.slice(sx * 8, sx * 8 + 8)) : cap.plan;
  const width = plan[0].length, height = plan.length;
  const blockNames = capitalBlockNames(plan, k, cap.shore ? ctx.names : dryKinds(ctx.names, ctx.blockOf), cap.blocks, n > 1 ? [sx * 8, sy * 8] : [0, 0]);   // AUDIT-TESA A6-4
  if (!blockNames || !ctx.base) return null;
  const mapId = capitalPlaceId(k, so);
  const ll = mapPixelToLongitudeLatitude(ctx.px, ctx.py);
  const buildings = capitalBuildings(blockNames, ctx.blockOf, k, mapId, 64 * so);
  const where = ctx.where ?? {};
  const base = ctx.base;
  const h = (n - 1) / 2;
  return {
    ...base,
    name: capitalSliceName(cap, s),
    regionIndex: where.regionIndex ?? base.regionIndex,
    regionName: where.regionName ?? base.regionName,
    politic: where.politic ?? base.politic,
    climate: where.climate ?? base.climate,
    locationIndex: capitalLocationIndex(k, so),
    hasDungeon: false,
    dungeon: null,
    mapTableData: { ...base.mapTableData, mapId, locationType: LOCATION_TYPES.TownCity, longitude: ll.x, latitude: ll.y },
    exterior: {
      ...base.exterior,
      buildings,
      exteriorData: { ...base.exterior?.exteriorData, width, height, blockNames, blockIndex: null, blockNumber: null, blockCharacter: null, locationId: mapId, mapId, portTownAndUnknown: 0, buildingCount: buildings.length },
      ...(base.exterior?.recordElement ? { recordElement: { ...base.exterior.recordElement, header: { ...base.exterior.recordElement.header, locationId: mapId } } } : {}),
    },
    // TESA11: its slice, and (over several pixels) the centre pixel every slice's ground is flattened to
    capital: Object.freeze({ key: cap.key, k, s, ...(n > 1 ? { flattenAt: Object.freeze({ px: ctx.px - (sx - h), py: ctx.py - (sy - h) }) } : {}) }),
    ...(ctx.arena ? { arena: ctx.arena } : {}),
  };
}

/** The district a cell of a capital's grid belongs to, or null. */
export function capitalDistrict(cap, x, y) {
  for (const [name, cells] of Object.entries(cap?.districts ?? {})) if (cells.some(([cx, cy]) => cx === x && cy === y)) return name;
  return null;
}
