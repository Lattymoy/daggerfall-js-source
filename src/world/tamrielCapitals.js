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
// WHERE: the capital's point on Daggerfall's map of Tamriel (world/tamriel/tamrielGeography.js CITIES - TAMRIEL1's, the port's own
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
// blocks; every slice flattened to the centre's ground (world/terrain/terrainGen.js flattenAt); Arena's place of its name pinned
// to the centre and no other place on the rest (world/arenaPlaces.js standArenaPixels' `reserved`); its landmarks each
// carried by its own slice (`carry`: a model's slice, the first of its own blocks there).
//
// THE BUILDINGS ARE THE BLOCKS' OWN (capitalBuildings): Daggerfall names, staffs and serves a building off its location's
// list, drawn by type in grid order (systems/talk/talkTopics.js drawNamedBuildings); a capital's list is each block's own
// records in that order (its guild's faction, its temple's, its shop's quality) under name seeds of the capital's, so every
// building draws its own record and is named afresh.
//
// SOLITUDE (SOLITUDE_PLAN): a city on the shore of the Sea of Ghosts where the Karth meets it - the sea along the
// grid's north row, the river down its west two columns, the city walled on the land between them with fields south of
// its wall; in the river's mouth a sea stack with the Blue Palace on it, and the great arch from the stack to a terrace
// inside the city's west wall - the palace at the arch's tip, above the Karth, where the Avenues end; Castle Dour and the
// Emperor's Tower just within the main gate in the city's south-east, the Temple of the Divines on its grounds
// (TESA-LORE); the docks on the quay below the north wall - and round them its districts, Daggerfall's city blocks again.
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
import { capitalCastleDungeon, CASTLE_DUNGEON_TYPE } from './capitalCastles.js';   // WW7-4
import { pictureToBay, tamrielFit, inBay } from './tamriel/tamrielFrame.js';
import { provinceKeyBeyondBay, tamrielLandVersion, canalAt } from './tamriel/tamrielLand.js';   // NIBEN-SEA: the Waterfront's canal
import { CITIES } from './tamriel/tamrielGeography.js';   // AUDIT TESA II C15: a capital's point TAMRIEL1's city's, one home
import { tamrielHeightByte } from './tamriel/tamrielGround.js';   // AUDIT TESA II (lane R's R2): a gate the roads can reach
import { WATER_BYTE } from './roadsProducer.js';
import { IMPERIAL, IMPERIAL_MODELS, IMPERIAL_CARRY, IMPERIAL_SPAN, IMPERIAL_CELLS, IMPERIAL_PARTS, IMPERIAL_OUTSKIRTS, IMPERIAL_ARENA_CODE, imperialSlicePlan, imperialSliceName, imperialDistrictOfCell, imperialCodeCell, imperialCell } from './imperialCity.js';   // TESA11: the Imperial City over nine pixels; TS5 over forty-nine; IC-GRAND over 625, its plan a slice at a time
import { imperialSliceMarkers, imperialOwnName, imperialAnchorCarrier, imperialSliceCarrier, imperialViewName, imperialBlockOf, NEAR_RING, NEAR_SLACK } from './imperialBlocks.js';   // IC-GRAND: its blocks a family, near and far
import { ARENA_BLOCK } from './arena/arenaCity.js';   // IC-GRAND: Daggerfall's arena in the Arena District
import { TOWN_OUTLINE_BLOCK } from './townOutline.js';   // TS5: the open ground past the Imperial City's lake
import { unwalledLocation } from './townShape.js';   // TS7: a Bay city's own grid
import {
  MOURNHOLD_PLAN, MOURNHOLD_DISTRICTS, MOURNHOLD_BLOCKS, ALINOR_PLAN, ALINOR_DISTRICTS, ALINOR_BLOCKS, FALINESTI_PLAN, FALINESTI_DISTRICTS,
  FALINESTI_BLOCKS, TORVAL_PLAN, TORVAL_DISTRICTS, TORVAL_BLOCKS, HELSTROM_PLAN, HELSTROM_DISTRICTS, HELSTROM_BLOCKS, CAPITAL_RIM_M, CAPITAL_RIM_TILES,
  ALINOR_HARBOUR, TORVAL_DOCKS, districtAt,
} from './capitalPlans.js';

// The capitals' lane and the test of a map id (AUDIT RELEASE R2-9: a module of their own, the deeds' to read)
import { CAPITAL_LANE, isCapitalPlaceId } from './capitalLane.js';
export { CAPITAL_LANE, isCapitalPlaceId };
/** The location indices count down from here, past the lairs' (-40,000,000 and down 2^19). */
export const CAPITAL_INDEX_BASE = 41000000;
/** The hash's salt. */
export const CAPITAL_SALT = 0xca9c;
/** The port blocks' fixed indices (formats/worldData/worldDataReplacement.js registerPortBlock: past any BSA; the arena's 900100;
 *  AUDIT-TESA: past the Shadow Realm's 900200 too - world/superDungeon/sdRealm.js SD_REALM_BLOCK_INDEX). AUDIT TESA II C13: and
 *  past every other fixed block index in the tree - 900400 was the Sky-Ketch's (world/ketch/ketchShip.js KT_SHIP_BLOCK_INDEX),
 *  so its first block and the lake answered one number; test/world/audittesa2c_capitals.test.js sweeps every fixed index
 *  against the capitals' run. */
export const CAPITAL_BLOCK_INDEX = 901000;
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
  alinorPalace: 910130, alinorHarbour: 910132, alinorWall: 910133, alinorBridges: 910134,   // TESA-LORE: the Crystal Tower's 910131 retired with it
  grahtOak: 910140,
  manePalace: 910150, twoMoonsTemple: 910151, torvalQuay: 910152, torvalWall: 910153, maneEstate: 910154,   // TESA-LORE: the estate
  xanmeer: 910160, hist: 910161, helstromWalks: 910162, palisade: 910163,
});
/** BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 31 - C6): IS A MODEL ONE OF A CAPITAL'S
 *  LANDMARKS - a CAPITAL_MODELS model, or an Imperial City part its slices carry (IMPERIAL_PARTS). Its FOOTPRINT is its
 *  blocks' own: every block it stands over closes its automap where its faces stand (capitalPortBlocks' `footprint`,
 *  world/capitalModels.js capitalFootprint and imperialSliceFootprint - a wall to the walkers, not ground to cross), so the
 *  town's yards and its port's places read it there (scenes/world.js townPlacesFor) and never by its box: a ring wall's
 *  box is the whole city, and closed every yard and the harbour's shipyard off a capital's ground but its rim's strips. */
const LANDMARK_IDS = new Set([...Object.values(CAPITAL_MODELS), ...IMPERIAL_PARTS.map((p) => p.id)]);
/** @param {number} id */
export const isCapitalLandmark = (id) => LANDMARK_IDS.has(id);
/** RMB geometry: a block's side in its own units and in metres, its ground tiles, its automap cells. */
export const RMB_UNITS = 4096;
export { BLOCK_M };   // a block's side, metres (world/spawnedDungeons.js's: the terrain's eighth)
const TILE_M = BLOCK_M / 16, AUTO_M = BLOCK_M / 64;
export { CAPITAL_RIM_M, CAPITAL_RIM_TILES };
/** AUDIT TESA II C1: a tile no ground of the location's - the record DFU's own wall blocks lay on their outer tiles (63,
 *  flipped and turned: world/terrain/terrainTiles.js setLocationTiles keeps the land's own tile there and leaves it out of
 *  the location's rect, so Daggerfall's blend reaches it). */
export const CAPITAL_NO_GROUND = 0xff;

/** IC-GRAND: A CAPITAL'S PLAN, ASKED - its rows and columns, a cell, an own block of a cell's code: a plan of its own rows
 *  (every capital but one), or (the Imperial City's, forty thousand cells) its `cells` a side and its laws (`cellAt`,
 *  `ownBlock`), worked a slice at a time. */
export const planRows = (cap) => cap.plan?.length ?? cap.cells;
export const planCols = (cap) => cap.plan?.[0]?.length ?? cap.cells;
export const planCell = (cap, r, c) => (cap.plan ? cap.plan[r]?.[c] ?? null : cap.cellAt(r, c));
export const ownBlockOf = (cap, cell) => (cap.ownBlock ? cap.ownBlock(cell) : Object.hasOwn(cap.blocks ?? {}, cell) ? cap.blocks[cell] : null);
/** IC-GRAND: the Imperial City's own block of a cell's code - its own (`TESA<code>.RMB`), or Daggerfall's arena's block in the
 *  Arena District - or null. */
const imperialOwnBlock = (cell) => {
  if (cell === IMPERIAL_ARENA_CODE) return ARENA_OWN;
  const rc = imperialCodeCell(cell);
  return rc ? { name: imperialOwnName(rc[0], rc[1]) } : null;
};
const ARENA_OWN = Object.freeze({ name: ARENA_BLOCK, external: true });
/** A plan's cells: 'L' the lake, 'G' a garden, a code of the capital's own blocks, else a classic block's kind (its
 *  name's first four letters). Rows north to south (as a map reads - the grid's rows the other way), cells west to east
 *  (its x). */

/** SOLITUDE'S MEASURES, metres from its anchor (the grid point (2, 3): the city's west edge, level with the arch) - x
 *  east, z south: the sea stack, the arch (its deck from the stack's top to the terrace's, its opening between its
 *  springs over the river), the terrace and its ramp, the Blue Palace on the stack, the walls, Castle Dour, the keep and
 *  the Emperor's Tower, the quay and the docks. AUDIT-TESA A6-3: the walls and their towers clear of the city's blocks (they
 *  stood up to 2 m into a house's block on the north, south and west). TESA-LORE: Castle Dour "just within the city's main
 *  gate" (UESP's Solitude) - its square on the four blocks east of the south gate's lane, a gate to that lane (west) and
 *  one to the city (north), where it stood in the east, 200 m from any gate. */
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
  // AUDIT TESA II C1: the east wall in from the rim (it stood 10 m from the pixel's edge, on the land's slope now); C10: the
  // main gate on its lane between the tavern's block and Castle Dour's west curtain (it opened onto the tavern, 11 m in)
  wall: Object.freeze({
    west: -7, north: -108, east: 530, south: 416, thick: 5, h: 14, tower: 10, towerH: 20, gate: 10, gateH: 9,
    northGate: 250, southGate: 318.4, archGap: 17,
    along: Object.freeze({ north: Object.freeze([100, 430]), south: Object.freeze([120, 470]), west: Object.freeze([150, 290]), east: Object.freeze([40, 170, 300]) }),
  }),
  castle: Object.freeze({ x: 4 * BLOCK_M, z: 3 * BLOCK_M, half: 80, thick: 4, h: 16, tower: 12, towerH: 26, gate: 10, gateH: 9 }),
  keep: Object.freeze({ dx: 26, dz: 24, w: 36, d: 44, h: 28, roof: 11 }),
  emperorsTower: Object.freeze({ dx: -30, dz: -30, s: 12, h: 56, roof: 14 }),
  quay: Object.freeze({ x0: BLOCK_M, x1: 4 * BLOCK_M }),
  docks: Object.freeze({ edge: -1.5 * BLOCK_M, piers: Object.freeze([140, 216]), pierTo: -230, pierW: 7, deck: 1.4, warehouse: Object.freeze({ x: 330, z: -130, w: 52, d: 18, h: 9, roof: 6 }) }),   // AUDIT TESA II C15: BLOCK_M's
});
/** Solitude's closed cells: the terrace and its ramp, the north wall's band (its gate open), the warehouse, Castle
 *  Dour's curtain (its gates open - TESA-LORE: west and north), its towers, its keep and the Emperor's Tower, and the east
 *  wall's band. */
function solitudeClosed(dx, dz) {
  const S = SOLITUDE, W = S.wall, L = S.landing, C = S.castle, half = W.thick / 2 + 0.5;
  if (dx >= 0 && dx < L.rampTo && Math.abs(dz) < L.w / 2) return true;
  if (Math.abs(dz - W.north) < half && Math.abs(dx - W.northGate) > W.gate / 2) return true;
  if (Math.abs(dx - W.east) < half && dz > W.north && dz < W.south) return true;
  const H = S.docks.warehouse;
  if (Math.abs(dx - H.x) < H.w / 2 && Math.abs(dz - H.z) < H.d / 2) return true;
  const cx = dx - C.x, cz = dz - C.z, r = Math.max(Math.abs(cx), Math.abs(cz));
  if (Math.abs(r - C.half) < C.thick / 2 + 0.5 && !(cx < 0 && Math.abs(cz) < C.gate / 2) && !(cz < 0 && Math.abs(cx) < C.gate / 2)) return true;
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
  'L L GRVE BOOK ARMR BANK TEMP G',
  'L L RESI FIGH PAWN D0 D1 G',
  'L L RESI RESI TVRN D2 D3 G',
  'L L G G G G G G',
].map((r) => Object.freeze(r.split(' '))));
/** Solitude's districts, by cell (x, y). TESA-LORE: the Bards College and the Hall of the Dead are the Avenues' (UESP:
 *  "the Bard's College, the Hall of the Dead and the Blue Palace" in the Avenues, the palace at their end), the Hall of
 *  the Dead beside the palace's terrace; Castle Dour's square by the main gate and the Temple of the Divines on its
 *  grounds. */
export const SOLITUDE_DISTRICTS = Object.freeze({
  'Blue Palace': Object.freeze([[2, 2], [2, 3]]),
  'Solitude Docks': Object.freeze([[3, 1], [4, 1], [5, 1]]),
  'The Avenues District': Object.freeze([[3, 2], [4, 2], [5, 2], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4]]),
  'Castle Dour District': Object.freeze([[5, 5], [6, 5], [5, 6], [6, 6], [6, 4]]),
  'The Well District': Object.freeze([[6, 2], [6, 3], [5, 4], [2, 5], [3, 5], [4, 5], [2, 6], [3, 6], [4, 6]]),
});

/** The capitals the port builds, in their ordinal order: the name (Arena's and TAMRIEL1's), the province, the point on
 *  the picture (world/tamriel/tamrielGeography.js CITIES), whether it stands on the shore, the plan and its districts, its
 *  anchor, its start markers (AUDIT-TESA A6-1: the anchor's metres, on its own open ground - a plaza, a terrace, a
 *  quay), its own blocks and its models; its tag (AUDIT-TESA A6-2: its gardens' names, capitalGardenName); and (TESA11) its
 *  span in pixels, its slices' names and the slice each of its models is carried by - one pixel, its name and its carrier
 *  where it has none. */
/** AUDIT TESA II C15: TAMRIEL1's point of a capital's city (world/tamriel/tamrielGeography.js CITIES), its one home. */
const cityAt = (name) => Object.freeze([...(CITIES.find((c) => c.name === name && c.capital)?.at ?? [0, 0])]);
/** A capital's entry, its point its city's (`at`, cityAt). */
const capital = (o) => Object.freeze({ ...o, at: cityAt(o.name) });
/** AUDIT TESA II C2: a shore capital whose harbour faces the south - its land pixel and the sea pixel off it (the plan's
 *  last eight rows), the land its own. */
const SEA_SOUTH = Object.freeze({ w: 1, h: 2, mx: 0, my: 0, sea: Object.freeze([1]) });
export const CAPITALS = Object.freeze([
  capital({ key: 'imperial-city', tag: 'IC', name: 'Imperial City', province: 'Imperial', shore: false, plan: null, districtOf: imperialDistrictOfCell,
    // IC-GRAND: its plan asked a cell and a slice at a time (`cells` a side), its own blocks a family on the door (world/imperialBlocks.js)
    cells: IMPERIAL_CELLS, cellAt: imperialCell, slicePlan: imperialSlicePlan, ownBlock: imperialOwnBlock, family: true,
    span: IMPERIAL_SPAN, sliceName: imperialSliceName, carry: IMPERIAL_CARRY,   // TESA11: nine pixels, each slice its district's; TS5: forty-nine, each landmark carried in parts; IC-GRAND: 625
    sliceMarkers: imperialSliceMarkers,   // AUDIT TESA II C7: every slice its own start markers (each worked when first read)
    gates: Object.freeze(['W']),   // TESA14: Talos Bridge, west to the mainland
    harbour: Object.freeze([(IMPERIAL_SPAN - 1) / 2, Math.floor(IMPERIAL.waterfront.pierTo / 819.2 + IMPERIAL_SPAN / 2)]),   // NIBEN-SEA: its harbour; RUMARE-WATER: the Waterfront's own slice, its quay and its piers' ends, the lake's way to the canal open (capitalCanalOpen)
    anchor: Object.freeze([IMPERIAL_SPAN * 4, IMPERIAL_SPAN * 4]), markers: Object.freeze([[220, 0], [-220, 0], [0, 220], [0, -220]]), blocks: null, models: Object.freeze(IMPERIAL_PARTS.map((p) => p.id)), drawn: Object.freeze(Object.values(IMPERIAL_MODELS)) }),   // TS5: its markers on the plaza round the tower; its landmarks' parts the slices' models, the whole ones drawn once
  capital({ key: 'solitude', tag: 'SO', name: 'Solitude', province: 'Skyrim', shore: true, plan: SOLITUDE_PLAN, districts: SOLITUDE_DISTRICTS,
    sea: Object.freeze(['N', 'W']),   // AUDIT TESA II C9: the plan's water - the Sea of Ghosts north, the Karth west
    gates: Object.freeze(['S']),   // TESA14: the main gate south (the north gate is the docks')
    anchor: Object.freeze([2, 3]), markers: Object.freeze([[90, -60], [90, 60], [200, -130]]), blocks: SOLITUDE_BLOCKS, models: Object.freeze([CAPITAL_MODELS.solitudeArch, CAPITAL_MODELS.bluePalace, CAPITAL_MODELS.solitudeWall, CAPITAL_MODELS.castleDour, CAPITAL_MODELS.solitudeDocks]) }),
  capital({ key: 'mournhold', tag: 'MH', name: 'Mournhold', province: 'Morrowind', shore: false, plan: MOURNHOLD_PLAN, districts: MOURNHOLD_DISTRICTS,
    gates: Object.freeze(['N', 'E', 'S', 'W']),   // TESA14: a gate in each side of its wall
    anchor: Object.freeze([4, 4]), markers: Object.freeze([[0, 120], [-50, 205], [50, 205], [0, -110]]), blocks: MOURNHOLD_BLOCKS, models: Object.freeze([CAPITAL_MODELS.mournholdPlaza, CAPITAL_MODELS.highFane, CAPITAL_MODELS.mournholdPalace, CAPITAL_MODELS.greatBazaar, CAPITAL_MODELS.mournholdWall]) }),   // TESA-LORE: the markers off the palace at the middle - the plaza's ways and the courtyard
  capital({ key: 'alinor', tag: 'AL', name: 'Alinor', province: 'Sumurset', shore: true, plan: ALINOR_PLAN, districts: ALINOR_DISTRICTS,
    sea: Object.freeze(['S']), dims: SEA_SOUTH, sliceNames: Object.freeze([null, ALINOR_HARBOUR]), sliceMarkers: Object.freeze({ 1: Object.freeze([[100, 440], [-100, 440]]) }),   // AUDIT TESA II C2: over its harbour's sea
    gates: Object.freeze(['N', 'E', 'W']),   // TESA14: its three landward sides (the harbour south)
    anchor: Object.freeze([4, 2]), markers: Object.freeze([[0, 99], [100, 440], [-100, 440], [-200, 440]]), blocks: ALINOR_BLOCKS, models: Object.freeze([CAPITAL_MODELS.alinorPalace, CAPITAL_MODELS.alinorHarbour, CAPITAL_MODELS.alinorWall, CAPITAL_MODELS.alinorBridges]) }),   // TESA-LORE: the markers at the stair's foot and on the quay
  capital({ key: 'falinesti', tag: 'FA', name: 'Falinesti', province: 'Valenwood', shore: false, plan: FALINESTI_PLAN, districts: FALINESTI_DISTRICTS,
    gates: Object.freeze(['N', 'E', 'S', 'W']),   // TESA14: no wall but the forest
    anchor: Object.freeze([4, 4]), markers: Object.freeze([[80, 0], [-80, 0], [0, 80], [0, -80]]), blocks: FALINESTI_BLOCKS, models: Object.freeze([CAPITAL_MODELS.grahtOak]) }),
  capital({ key: 'torval', tag: 'TO', name: 'Torval', province: 'Elsweyr', shore: true, plan: TORVAL_PLAN, districts: TORVAL_DISTRICTS,
    sea: Object.freeze(['S']), dims: SEA_SOUTH, sliceNames: Object.freeze([null, TORVAL_DOCKS]), sliceMarkers: Object.freeze({ 1: Object.freeze([[100, 340], [-100, 340]]) }),   // AUDIT TESA II C2: over Topal Bay
    gates: Object.freeze(['N', 'E', 'W']),   // TESA14: its landward sides (the quay on Topal Bay, south)
    anchor: Object.freeze([4, 3]), markers: Object.freeze([[0, 20], [-60, 20], [60, 20], [100, 340]]), blocks: TORVAL_BLOCKS, models: Object.freeze([CAPITAL_MODELS.manePalace, CAPITAL_MODELS.twoMoonsTemple, CAPITAL_MODELS.torvalQuay, CAPITAL_MODELS.torvalWall, CAPITAL_MODELS.maneEstate]) }),
  capital({ key: 'helstrom', tag: 'HE', name: 'Helstrom', province: 'BlackMarsh', shore: false, plan: HELSTROM_PLAN, districts: HELSTROM_DISTRICTS,
    gates: Object.freeze(['N', 'S']),   // TESA14: the palisade's north and south gates
    anchor: Object.freeze([4, 3]), markers: Object.freeze([[70, 0], [-70, 0], [0, 70], [0, -70]]), blocks: HELSTROM_BLOCKS, models: Object.freeze([CAPITAL_MODELS.xanmeer, CAPITAL_MODELS.hist, CAPITAL_MODELS.helstromWalks, CAPITAL_MODELS.palisade]) }),
]);

/** A capital's map id, its location index, and whether a map id is a capital's - TESA11: each slice's, by its ordinal (0
 *  the centre's - the capital's own - then the others in their order, sixteen ordinals apart). */
export const capitalPlaceId = (k, so = 0) => ((CAPITAL_LANE << 20) | 0x80000 | (k + 16 * so)) >>> 0;
export const capitalLocationIndex = (k, so = 0) => -(CAPITAL_INDEX_BASE + k + 16 * so);
/** TESA11: a capital's span in pixels, its centre slice's index, and a slice's ordinal (the centre 0, the rest 1 on).
 *  AUDIT TESA II C2: A CAPITAL'S SLICES (`capitalDims`) - `w` x `h` pixels, its own slice (its name, its pin, the ground
 *  every slice is flattened to) at (`mx`, `my`), `sea` the slices that are its harbour's sea: TESA11's square about its
 *  centre (the Imperial City's three), a south-facing shore capital its land and the sea pixel off it, the rest one pixel.
 *  `capitalSpan` the span's side, TESA11's. */
export function capitalDims(cap) {
  if (cap?.dims) return cap.dims;
  const n = cap?.span ?? 1, c = (n - 1) / 2;
  return { w: n, h: n, mx: c, my: c };
}
export const capitalSpan = (cap) => capitalDims(cap).w;
export const capitalCentre = (cap) => { const D = capitalDims(cap); return D.my * D.w + D.mx; };
export const capitalSliceOrdinal = (cap, s) => { const c = capitalCentre(cap); return s === c ? 0 : 1 + (s < c ? s : s - 1); };
/** TESA11: a slice's name - the centre's the capital's. */
export const capitalSliceName = (cap, s) => (s === capitalCentre(cap) ? cap.name : (cap.sliceName ? cap.sliceName(s) : cap.sliceNames?.[s]) ?? cap.name);
/** AUDIT TESA II C2: is a capital's slice its harbour's sea (its plan's eight rows all water but the sea's own block). */
const isSeaSlice = (cap, s) => (capitalDims(cap).sea ?? []).includes(s);

/** How far, Bay pixels, a capital looks from its point for its own province's land - however far the picture's coast
 *  lies from TAMRIEL1's point (world/arenaPlaces.js SHORE_REACH's). */
export const CAPITAL_REACH = 320;
/** Is a pixel past the Bay the sea - no province's land under its centre (world/tamriel/tamrielLand.js: the trace's, or the
 *  authored shape's where none is set). */
const seaAt = (bx, by) => !inBay(bx, by) && provinceKeyBeyondBay(bx, by) === null;
/**
 * AUDIT TESA II C9: THE HEIGHTS A SIDE OF A SPAN IS LAID FROM. Daggerfall's ground over a pixel is a patch from its
 * north-west neighbour's height (its north-west corner) to its own (its south-east corner) - world/terrain/terrainSampler.js
 * kernelTerms, its window from (px - 2, py - 2) - so the span (x0, y0) w x h's north edge reads the row above it from
 * the column before it, its west edge the column before it from the row above it, its south edge its own last row and
 * its east edge its own last column, each from the corner before. A side is the sea where every one is.
 * @returns {Array<[number, number]>}
 */
export function spanSideBytes(x0, y0, w, h, side) {
  const out = [];
  if (side === 'N' || side === 'S') { const y = side === 'N' ? y0 - 1 : y0 + h - 1; for (let x = x0 - 1; x <= x0 + w - 1; x++) out.push([x, y]); }
  else { const x = side === 'W' ? x0 - 1 : x0 + w - 1; for (let y = y0 - 1; y <= y0 + h - 1; y++) out.push([x, y]); }
  return out;
}
/**
 * A CAPITAL'S PIXEL on the live fit and the land: the nearest pixel to its picture point's centre - ring by ring out to
 * CAPITAL_REACH, in each ring the nearest centre - whose centre is its own province's land past the Bay; or null where
 * none is in reach. The point itself where it is. TESA11: a capital over several pixels - the centre's, every pixel of
 * its span its province's land. AUDIT TESA II C2/C9: a shore capital's sea slices the sea, and every side its plan's water
 * faces (`sea`) the sea along its whole edge (spanSideBytes) - so the harbour meets the sea at the span's edge, where
 * "one of its eight the sea" stood it with its harbour on land (a diagonal) on the authored shape.
 */
export function capitalPixel(cap) {
  const [x, y] = pictureToBay(cap.at[0] + 0.5, cap.at[1] + 0.5);
  const D = capitalDims(cap);
  const land = (bx, by) => !inBay(bx, by) && provinceKeyBeyondBay(bx, by) === cap.province;
  const ok = (bx, by) => {
    for (let sy = 0; sy < D.h; sy++) for (let sx = 0; sx < D.w; sx++) {
      const px = bx + sx - D.mx, py = by + sy - D.my;
      if (isSeaSlice(cap, sy * D.w + sx) ? !seaAt(px, py) : !land(px, py)) return false;
    }
    const wet = (side) => spanSideBytes(bx - D.mx, by - D.my, D.w, D.h, side).every(([px, py]) => seaAt(px, py));
    return cap.sea ? cap.sea.every(wet) : !cap.shore || ['N', 'S', 'W', 'E'].some(wet);   // a shore capital of no plan's side: any side the sea
  };
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
    // TESA11: every slice of a capital over several pixels, each its index (sy * w + sx) and its place in the span
    _onPixel.pixels.forEach((p, k) => {
      if (!p) return;
      const cap = CAPITALS[k], D = capitalDims(cap);
      for (let sy = 0; sy < D.h; sy++) for (let sx = 0; sx < D.w; sx++) {
        const key = `${p.px + sx - D.mx},${p.py + sy - D.my}`;
        if (!_onPixel.byPixel.has(key)) _onPixel.byPixel.set(key, Object.freeze({ cap, k, s: sy * D.w + sx, slice: Object.freeze([sx, sy]), centre: p }));
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
/** AUDIT TESA II (lane R's R2): how far, pixels, a gate walks out from its side for ground the roads can reach. */
export const CAPITAL_GATE_REACH = 4;
/** The roads' land (world/tamrielRoads.js buildTamrielRegion: a byte over WATER_BYTE is ground it walks) past the Bay and
 *  off every capital's pixels. */
const gateGround = (x, y) => !inBay(x, y) && tamrielHeightByte(x, y) > WATER_BYTE && !capitalOnPixel(x, y);
const _unroutable = new Set();
/**
 * TESA14: WHERE THE ROADS COME TO A CAPITAL - for each of its gates (CAPITALS `gates`, its plan's gates and bridges), the
 * pixel just outside its span at the side's middle (AUDIT TESA II C2: its own slice's row or column), and the step from it
 * into the city: a road ends there, at the city's edge, never across its own pixels - a lake, a harbour, a canal
 * (world/tamrielRoads.js). AUDIT TESA II (lane R's R2): the first pixel out from there, within CAPITAL_GATE_REACH, that is ground the
 * roads walk with a neighbour of such ground off the city (4-connected: Solitude's gate and the city stood an islet of
 * three among the shore's beach-line bytes, and no road reached it); a side with none in reach stands no gate, and a
 * capital with none is said once a land. None for a capital with no pixel on the live fit and land.
 * @param {number} k the capital's ordinal
 * @param {{ walkable?: (x: number, y: number) => boolean }} [o] the roads' ground (the host's own, else the land's bytes)
 * @returns {Array<{ x: number, y: number, into: readonly number[], side: string }>}
 */
export function capitalGates(k, { walkable = gateGround } = {}) {
  const cap = CAPITALS[k], at = capitalPixels().pixels[k];
  if (!cap || !at) return [];
  const D = capitalDims(cap), out = [];
  for (const side of cap.gates ?? []) {
    const [dx, dy] = GATE_STEPS[side], base = [at.px + (dx > 0 ? D.w - D.mx : dx < 0 ? -D.mx - 1 : 0), at.py + (dy > 0 ? D.h - D.my : dy < 0 ? -D.my - 1 : 0)];
    for (let t = 0; t < CAPITAL_GATE_REACH; t++) {
      const x = base[0] + dx * t, y = base[1] + dy * t;
      if (!walkable(x, y)) continue;
      if (!Object.values(GATE_STEPS).some(([sx, sy]) => walkable(x + sx, y + sy))) continue;
      out.push({ x, y, into: Object.freeze([-dx, -dy]), side });
      break;
    }
  }
  const key = `${k}|${tamrielLandVersion()}`;
  if (!out.length && (cap.gates ?? []).length && !_unroutable.has(key)) { _unroutable.add(key); console.warn(`[capitals] ${cap.name}: no gate the roads can reach within ${CAPITAL_GATE_REACH} pixels of its sides`); }
  return out;
}
/** NIBEN-SEA: A CAPITAL'S HARBOUR - the slice its port stands on: its `harbour` (the Imperial City's: RUMARE-WATER the
 *  Waterfront's own slice on the middle line, its quay and the ends of its piers over the lake), else its centre (a shore
 *  capital's own slice, TESA10b). */
export const capitalHarbourSlice = (cap) => (cap.harbour ? cap.harbour[1] * capitalDims(cap).w + cap.harbour[0] : capitalCentre(cap));
/** NIBEN-SEA: whether a capital's harbour meets its canal (world/tamriel/tamrielLand.js waterfrontCanal) - RUMARE-WATER: the
 *  pixel past its span's south edge in its harbour's column the canal's, the city's lake joined to it through the
 *  Waterfront's mouth (world/imperialCity.js IMPERIAL.mouth) - on the live fit and land. @param {number} k */
export function capitalCanalOpen(k) {
  const cap = CAPITALS[k], at = capitalPixels().pixels[k];
  if (!cap?.harbour || !at) return false;
  const D = capitalDims(cap);
  return canalAt(at.px + cap.harbour[0] - D.mx, at.py + D.h - D.my);
}
/** BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 31 - C6): A CAPITAL SLICE'S PORT WORD - its
 *  harbour's slice (capitalHarbourSlice) where the place of its name pinned on its centre is a port (`pinPort`, TESA6's
 *  coastal word) or its harbour meets its canal (capitalCanalOpen): the registry's row (world/pastBayRows.js) and the
 *  slice's own PortTownAndUnknown byte (synthesizeCapitalLocation), one law - so the harbour the sea's systems call a port
 *  stands its shipyard, crew hall, lighthouse and Docks and its bank sells a ship (scenes/pixelBuild.js portTown).
 *  @param {number} k @param {number} s @param {unknown} pinPort */
export const capitalSlicePort = (k, s, pinPort) => !!CAPITALS[k] && s === capitalHarbourSlice(CAPITALS[k]) && (!!pinPort || capitalCanalOpen(k));
/** TS5: a capital's centre pixel on the live fit and land, or null. @param {number} k */
export const capitalCentrePixel = (k) => capitalPixels().pixels[k] ?? null;
/** TS5: whether a Bay pixel is of the Imperial City's outskirts (world/imperialCity.js IMPERIAL_OUTSKIRTS from its centre
 *  pixel, its own pixels aside) - a town there laid round (world/townOutline.js ROUND_OUTLINE). */
export function imperialOutskirts(px, py) {
  const at = capitalCentrePixel(0);
  if (!at) return false;
  const d = Math.max(Math.abs(px - at.px), Math.abs(py - at.py));
  return d > (IMPERIAL_SPAN - 1) / 2 && Math.hypot(px - at.px, py - at.py) <= IMPERIAL_OUTSKIRTS;
}
/** TESA14: a capital's own pixels on the live fit and land - every slice of its span - or none. */
export function capitalSpanPixels(k) {
  const cap = CAPITALS[k], at = capitalPixels().pixels[k];
  if (!cap || !at) return [];
  const D = capitalDims(cap), out = [];
  for (let sy = 0; sy < D.h; sy++) for (let sx = 0; sx < D.w; sx++) out.push({ x: at.px + sx - D.mx, y: at.py + sy - D.my });
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
  return [...(rows ?? [])].map(unwalledLocation).filter((l) => l?.mapTableData?.locationType === LOCATION_TYPES.TownCity && l.exterior?.exteriorData && !l.hasDungeon   // TS7: as it was read
    && !l.spawned && !l.ether && !l.arena && !l.country && !l.capital && !isMain(id(l))).sort((a, b) => id(a) - id(b))[0] ?? null;
}

/** The classic city blocks by kind: every name a city of the game's rows lays, grouped by its first four letters,
 *  each group sorted - no wall, no palace (a palace stands its own castle). */
export function cityBlockNames(rows) {
  const out = new Map();
  for (const l of rows ?? []) {
    if (l?.mapTableData?.locationType !== LOCATION_TYPES.TownCity) continue;
    for (const n of unwalledLocation(l).exterior?.exteriorData?.blockNames ?? []) {   // TS7: the city's own grid
      const kind = String(n).slice(0, 4);
      if (kind === 'WALL' || kind === 'PALA') continue;
      if (!out.has(kind)) out.set(kind, new Set());
      out.get(kind).add(n);
    }
  }
  return new Map([...out].map(([k, s]) => [k, [...s].sort()]));
}

/** A capital's own block of a `kind` at its plan's (cx, r) - TESA11: base 36, a 24-cell plan's rows and columns one
 *  character each; TS5: two past 36 cells. */
const capitalCellName = (kind) => (cap, cx, r) => { const w = planRows(cap) > 36 ? 2 : 1; return `TES${kind}${cap.tag}${r.toString(36).padStart(w, '0')}${cx.toString(36).padStart(w, '0')}.RMB`; };
/** AUDIT-TESA A6-2: a capital's garden at its plan's (cx, r) - a block of its own, so the walls a capital's models raise
 *  over it close its ground and keep its trees off them (capitalPortBlocks' `footprint`). */
export const capitalGardenName = capitalCellName('G');
/** AUDIT TESA II C1: is the plan's cell (cx, r) on its outer ring - the only cells the rim reaches (it is under a block). */
export const onCapitalRing = (cap, cx, r) => r === 0 || cx === 0 || r === planRows(cap) - 1 || cx === planCols(cap) - 1;
/** AUDIT TESA II C1: a capital's lake or sea at its plan's outer ring - a block of its own, so its rim leaves the land's
 *  own ground there (the shared lake laid water to the pixel's edge). */
export const capitalLakeName = capitalCellName('L');
/** AUDIT TESA II C1: IS A POINT OF THE PLAN IN ITS RIM (`x` east and `z` south of the plan's north-west corner, metres) -
 *  within CAPITAL_RIM_M of its outer edge: the span's outer sides, never a seam between its own slices. */
export const inCapitalRim = (cap, x, z) => x < CAPITAL_RIM_M || z < CAPITAL_RIM_M || x > planCols(cap) * BLOCK_M - CAPITAL_RIM_M || z > planRows(cap) * BLOCK_M - CAPITAL_RIM_M;

/** TESA11: the kinds a cell falls back to where the game's cities lay none of its own (a release short of one). */
const FALLBACK_KINDS = Object.freeze(['RESI', 'GENR']);
/** A plan's block names in the grid's order (row by row from the SOUTH - the plan's last row first): the port's own for
 *  its lake, TS5 its open ground past the lake (the land's own), its gardens (the capital's own, capitalGardenName) and the capital's own blocks (`own`, the capital's `blocks`), a classic block of each other
 *  cell's kind off the cell's hash (its plan column and row) - the kind's fallbacks where it has none, null where they
 *  have none either. TESA11: `at` the plan's cell the given plan's first cell is (a slice's), the hash and the gardens
 *  the whole plan's. */
export function capitalBlockNames(plan, k, names, own = CAPITALS[k] ? (cell) => ownBlockOf(CAPITALS[k], cell) : {}, at = [0, 0]) {
  const out = [], [x0, r0] = at;
  // IC-GRAND: `own` a capital's blocks by code, or its law of a code (the Imperial City's)
  const ownOf = typeof own === 'function' ? own : (cell) => (Object.hasOwn(own ?? {}, cell) ? own[cell] : null);
  for (let r = plan.length - 1; r >= 0; r--) {
    for (let x = 0; x < plan[r].length; x++) {
      const cell = plan[r][x], mine = ownOf(cell);
      if (cell === 'L') out.push(CAPITALS[k] && onCapitalRing(CAPITALS[k], x0 + x, r0 + r) ? capitalLakeName(CAPITALS[k], x0 + x, r0 + r) : CAPITAL_BLOCKS.lake);   // AUDIT TESA II C1: its rim's
      else if (cell === 'O') out.push(TOWN_OUTLINE_BLOCK);   // TS5: open ground - the land's own (world/townOutline.js)
      else if (cell === 'G') out.push(CAPITALS[k] ? capitalGardenName(CAPITALS[k], x0 + x, r0 + r) : CAPITAL_BLOCKS.garden);   // AUDIT-TESA A6-2: its own
      else if (mine) out.push(mine.name);
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
 *  (world/terrain/terrainTiles.js setLocationTiles `[x][15 - y]`, world/city/cityNavigation.js setBlockData `63 - y`). */
export const tileCentre = (tx, ty) => [(tx + 0.5) * TILE_M, (15 - ty + 0.5) * TILE_M];
export const autoCentre = (ax, ay) => [(ax + 0.5) * AUTO_M, (63 - ay + 0.5) * AUTO_M];

/** AUDIT-TESA A6-5: a closed automap cell's byte - in no quarter and no show-all byte (ui/town/townQuarters.js quarterOf,
 *  isShowAllByte): the walkers' navgrid shut there (world/city/cityNavigation.js: any byte but 0), the town map painting none
 *  - a wall's byte 1 was BuildingType 0 + 1, an alchemist's, drawn and pressed as a shop. */
export const CAPITAL_CLOSED_BYTE = 0xfe;
/** A block of the port's own in DFU's world-data JSON (formats/worldData/worldDataReplacement.js blockFromJson): its ground tiles
 *  (`tile(x, z)` - a record, by the tile centre's metres), its trees (`tree(x, z)` - a scenery record or -1), its automap
 *  (`closed(x, z)`), its misc models and (AUDIT-TESA A6-1) its flats.
 * @param {string} name
 * @param {{ tile: (x: number, z: number) => number, tree?: (x: number, z: number) => number, closed?: (x: number, z: number) => boolean, models?: any[], flats?: any[] }} o */
export function portBlockJson(name, { tile, tree = () => -1, closed = () => false, models = [], flats = [] }) {
  const GroundTiles = [], GroundScenery = [], AutoMapData = [];
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      const [x, z] = tileCentre(tx, ty), t = tile(x, z);
      GroundTiles.push({ TileBitfield: t === CAPITAL_NO_GROUND ? CAPITAL_NO_GROUND : t & 0x3f });   // AUDIT TESA II C1: no ground of its own
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
  if (cap.family) { const k = imperialAnchorCarrier(); return k ? planCell(cap, k[0], k[1]) : null; }   // IC-GRAND: worked by its own law
  const [ax, ar] = cap.anchor;
  for (let r = 0; r < cap.plan.length; r++) {
    for (let cx = 0; cx < cap.plan[r].length; cx++) {
      const cell = cap.plan[r][cx];
      if (Object.hasOwn(cap.blocks, cell) && cx <= ax && ax <= cx + 1 && r <= ar && ar <= r + 1) return cell;
    }
  }
  return null;
}
/** TESA11: each slice's carrier - the first of its own blocks in the plan's order, the centre's the anchor's
 *  (capitalCarrier) - by slice index. IC-GRAND: the Imperial City's, of the slices its landmarks stand in (a slice of no
 *  landmark carries nothing but its fabric's own, world/imperialBlocks.js). */
export function capitalSliceCarriers(cap) {
  const D = capitalDims(cap), first = new Map([[capitalCentre(cap), capitalCarrier(cap)]]);   // the centre's the anchor's
  if (cap.family) {
    for (const s of new Set(Object.values(cap.carry ?? {}))) if (!first.has(s)) { const k = imperialSliceCarrier(s); if (k) first.set(s, planCell(cap, k[0], k[1])); }
    return first;
  }
  cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
    const s = Math.floor(r / 8) * D.w + Math.floor(cx / 8);
    if (Object.hasOwn(cap.blocks, cell) && !first.has(s)) first.set(s, cell);
  }));
  return first;
}
/** TESA11: the own block each of a capital's models is carried by - its slice's (`carry`), else the anchor's
 *  (capitalCarrier) - by model id. */
export function capitalModelCarriers(cap) {
  const out = new Map(), anchor = capitalCarrier(cap), first = capitalSliceCarriers(cap);
  for (const id of cap.models) out.set(id, cap.carry && Object.hasOwn(cap.carry, id) ? first.get(cap.carry[id]) ?? anchor : anchor);
  return out;
}
/** AUDIT TESA II C7: a slice's start markers (the anchor's metres) - the capital's own for its own slice, its
 *  `sliceMarkers` for the rest (a list by slice, or a law answering one). */
export function capitalSliceMarkers(cap, s) {
  if (s === capitalCentre(cap)) return cap.markers ?? [];
  return (typeof cap.sliceMarkers === 'function' ? cap.sliceMarkers(s) : cap.sliceMarkers?.[s]) ?? [];
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
 * garden's grass and trees at its plan's cells; then (AUDIT TESA II C1) each capital's lake at its plan's outer ring.
 * `footprint(cap)` (world/capitalModels.js capitalFootprint) answers where the capital's models stand - `(x, z) =>
 * boolean`, the anchor's metres - and every one of its blocks closes its automap there, its gardens' trees kept off it: a
 * wall the models raise over a garden or an own block is a wall to the walkers too (world/city/cityNavigation.js), not
 * ground to cross. AUDIT TESA II C1: every one of a capital's own blocks, gardens and ring lakes lays no ground in its rim
 * (inCapitalRim: CAPITAL_NO_GROUND, closed, treeless), so Daggerfall's blend meets the land there; C7: every slice's
 * carrier its own start markers (capitalSliceMarkers). Each block's JSON is built when it is first read - `make`, which
 * the world-data door is handed and keeps nothing of (AUDIT TESA II C8: the JSON was kept beside the block it was read
 * into, 15 MiB for the Imperial City), and `json`, a getter that keeps its own for the pins - the footprint with it: a
 * capital's models are built when one of its blocks is.
 * @param {{ footprint?: (cap: any) => ((x: number, z: number) => boolean) | null }} [o]
 * @returns {Array<{ name: string, index: number, make: () => any, json: any }>}
 */
export function capitalPortBlocks({ footprint = null } = {}) {
  const out = [];
  const lazy = (name, index, make) => { let json = null; out.push({ name, index, make, get json() { return (json ??= make()); } }); };
  out.push({ name: CAPITAL_BLOCKS.lake, index: CAPITAL_BLOCK_INDEX, json: portBlockJson(CAPITAL_BLOCKS.lake, { tile: () => 0 }) });
  out.push({ name: CAPITAL_BLOCKS.garden, index: CAPITAL_BLOCK_INDEX + 1, json: portBlockJson(CAPITAL_BLOCKS.garden, { tile: () => 2, tree: gardenTree }) });
  const stands = new Map();
  const standsOf = (cap) => { if (!stands.has(cap.key)) stands.set(cap.key, footprint?.(cap) ?? null); return stands.get(cap.key); };
  /** AUDIT TESA II C1: a block's laws of its own metres at the plan's (cx, r), its rim's none - no ground, closed, no tree. */
  const rimmed = (cap, cx, r, { tile, closed, tree = null }) => {
    const rim = (x, z) => inCapitalRim(cap, cx * BLOCK_M + x, (r + 1) * BLOCK_M - z);
    return {
      tile: (x, z) => (rim(x, z) ? CAPITAL_NO_GROUND : tile(x, z)),
      closed: (x, z) => rim(x, z) || closed(x, z),
      ...(tree ? { tree: (x, z) => (rim(x, z) ? -1 : tree(x, z)) } : {}),
    };
  };
  for (const cap of CAPITALS) {
    if (cap.family) continue;   // IC-GRAND: the Imperial City's blocks are a family on the door (world/imperialBlocks.js, world/capitalModels.js installCapitals)
    const carriers = capitalModelCarriers(cap), slices = capitalSliceCarriers(cap), D = capitalDims(cap);
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
      const own = Object.hasOwn(cap.blocks, cell) ? cap.blocks[cell] : null;
      if (!own) return;
      // the anchor in the block's own metres: where anchorMetres answers (0, 0)
      const at = [(cap.anchor[0] - cx) * BLOCK_M, (r + 1 - cap.anchor[1]) * BLOCK_M], s = Math.floor(r / 8) * D.w + Math.floor(cx / 8);
      lazy(own.name, CAPITAL_BLOCK_INDEX + out.length, () => {
        const under = standsOf(cap), on = (x, z) => !!under?.(...anchorMetres(cap, cx, r, x, z));
        return portBlockJson(own.name, {
          ...rimmed(cap, cx, r, {
            tile: (x, z) => own.tile(...anchorMetres(cap, cx, r, x, z)),
            closed: (x, z) => { const [dx, dz] = anchorMetres(cap, cx, r, x, z); return own.closed(dx, dz) || !!under?.(dx, dz); },
            // TESA11: a block's own trees where its law plants them, off the models' feet as a garden's are
            tree: own.tree ? (x, z) => (TILE_CELLS.some(([a, b]) => on(x + a, z + b)) ? -1 : own.tree(...anchorMetres(cap, cx, r, x, z))) : null,
          }),
          // TESA11: the models its slice carries, each on the first of the slice's own blocks
          models: cap.models.filter((id) => carriers.get(id) === cell).map((id) => miscModelAt(id, at[0], at[1])),
          // AUDIT-TESA A6-1: its start markers with them, the anchor's metres (z south) to the block's (z north) - AUDIT TESA
          // II C7: every slice's carrier its slice's
          flats: slices.get(s) === cell ? capitalSliceMarkers(cap, s).map(([dx, dz]) => startMarkerAt(at[0] + dx, at[1] - dz)) : [],
        });
      });
    }));
  }
  for (const cap of CAPITALS) {
    if (cap.family) continue;
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
      if (cell !== 'G') return;
      const name = capitalGardenName(cap, cx, r);
      lazy(name, CAPITAL_BLOCK_INDEX + out.length, () => {
        const under = standsOf(cap), on = (x, z) => !!under?.(...anchorMetres(cap, cx, r, x, z));
        return portBlockJson(name, rimmed(cap, cx, r, { tile: () => 2, tree: (x, z) => (TILE_CELLS.some(([a, b]) => on(x + a, z + b)) ? -1 : gardenTree(x, z)), closed: on }));
      });
    }));
  }
  // AUDIT TESA II C1: each capital's lake and sea at its plan's outer ring, its own - its rim the land's
  for (const cap of CAPITALS) {
    if (cap.family) continue;
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
      if (cell !== 'L' || !onCapitalRing(cap, cx, r)) return;
      const name = capitalLakeName(cap, cx, r);
      lazy(name, CAPITAL_BLOCK_INDEX + out.length, () => {
        const under = standsOf(cap), on = (x, z) => !!under?.(...anchorMetres(cap, cx, r, x, z));
        return portBlockJson(name, rimmed(cap, cx, r, { tile: () => 0, closed: on }));
      });
    }));
  }
  return out;
}

// ---------------------------------------------------------------- the location

/** AUDIT-TESA A6-4: the kinds of Daggerfall's city blocks that can carry a canal or a quay's water (CUST - a town on the
 *  water's), and how many water tiles (record 0) make a block wet. */
const WET_KINDS = Object.freeze(['CUST']);
/** AUDIT RELEASE R2-5f: dryKinds' answer, kept a names list. @type {WeakMap<Map<string, string[]>, Map<string, string[]>>} */
const _dryKept = new WeakMap();
const WET_TILES = 8;
/** AUDIT-TESA A6-4: AN INLAND CAPITAL'S BLOCKS - each wet kind's list (`names`) kept to its dry blocks (`blockOf(name)`'s
 *  ground holds fewer than WET_TILES water tiles), so no canal runs out of a city on no water (Mournhold's did); the
 *  list whole where none of it is dry. */
export function dryKinds(names, blockOf) {
  if (!names) return names;
  // AUDIT RELEASE R2-5f: kept a names list - every inland slice asked it again, each wet kind's every block read again
  // (BlocksFile keeps one block at a time): 17 of a slice's 20 ms (measured on the freeware). The blocks a name serves are
  // the session's (the world-data door is latched for the game), so the answer is too.
  const kept = _dryKept.get(names);
  if (kept) return kept;
  const out = new Map(names);
  _dryKept.set(names, out);
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
 * flattened to (`capital.flattenAt`). AUDIT TESA II C2: a shore capital's every slice flattened to the sea's floor
 * (`flattenAt.sea`, world/terrain/terrainGen.js) - its harbour's water the sea's own height, where it stood the city's
 * average, 16 to 59 m over the sea beside it.
 * @param {{ cap: any, k: number, s?: number }} at capitalOnPixel's
 * BAY-LEFT-SEA: its PortTownAndUnknown byte its port word (capitalSlicePort - `pinPort` whether the place pinned on its
 * centre is a port).
 * @param {{ base: any, names: Map<string, string[]>, blockOf: (name: string) => any, px: number, py: number,
 *   where?: { regionIndex?: number, regionName?: string, politic?: number, climate?: any }, arena?: any, pinPort?: boolean }} ctx
 */
export function synthesizeCapitalLocation({ cap, k, s = capitalCentre(cap) }, ctx) {
  // TESA11: a capital over several pixels - the slice's eight-by-eight of the plan, its hash and its gardens the plan's
  const D = capitalDims(cap), sx = s % D.w, sy = Math.floor(s / D.w), so = capitalSliceOrdinal(cap, s), many = D.w * D.h > 1;
  const plan = cap.slicePlan ? cap.slicePlan(s) : many ? cap.plan.slice(sy * 8, sy * 8 + 8).map((row) => row.slice(sx * 8, sx * 8 + 8)) : cap.plan;   // IC-GRAND: its slice's, asked
  const width = plan[0].length, height = plan.length;
  const blockNames = capitalBlockNames(plan, k, cap.shore ? ctx.names : dryKinds(ctx.names, ctx.blockOf), (cell) => ownBlockOf(cap, cell), many ? [sx * 8, sy * 8] : [0, 0]);   // AUDIT-TESA A6-4
  if (!blockNames || !ctx.base) return null;
  const mapId = capitalPlaceId(k, so);
  const ll = mapPixelToLongitudeLatitude(ctx.px, ctx.py);
  // IC-GRAND: a family's own blocks hold no building - never read (built) for the list
  const buildings = capitalBuildings(blockNames, cap.family ? (name) => (imperialBlockOf(name) ? null : ctx.blockOf(name)) : ctx.blockOf, k, mapId, 64 * so);
  const castle = so === 0 ? capitalCastleDungeon(k, mapId) : null;   // WW7-4: the centre's - the capital's own - its castle's halls
  const where = ctx.where ?? {};
  const base = ctx.base;
  // RUMARE-WATER (world/terrain/capitalSea.js): at the sea a shore capital, and the Imperial City where its canal stands;
  // a seam with the capital's sea slice water on both its sides
  const sea = cap.shore || capitalCanalOpen(k), seaEdges = sea && D.sea ? seaEdgesOf(D, sx, sy) : null;
  const flattenAt = many || cap.shore ? Object.freeze({ px: ctx.px - (sx - D.mx), py: ctx.py - (sy - D.my), ...(sea ? { sea: true } : {}), ...(seaEdges ? { seaEdges } : {}) }) : null;
  return {
    ...base,
    name: capitalSliceName(cap, s),
    regionIndex: where.regionIndex ?? base.regionIndex,
    regionName: where.regionName ?? base.regionName,
    politic: where.politic ?? base.politic,
    climate: where.climate ?? base.climate,
    locationIndex: capitalLocationIndex(k, so),
    hasDungeon: !!castle,
    dungeon: castle,
    mapTableData: { ...base.mapTableData, mapId, locationType: LOCATION_TYPES.TownCity, longitude: ll.x, latitude: ll.y, ...(castle ? { dungeonType: CASTLE_DUNGEON_TYPE } : {}) },
    exterior: {
      ...base.exterior,
      buildings,
      exteriorData: { ...base.exterior?.exteriorData, width, height, blockNames, blockIndex: null, blockNumber: null, blockCharacter: null, locationId: mapId, mapId, portTownAndUnknown: capitalSlicePort(k, s, ctx.pinPort) ? 1 : 0, buildingCount: buildings.length },   // BAY-LEFT-SEA: its harbour's port word
      ...(base.exterior?.recordElement ? { recordElement: { ...base.exterior.recordElement, header: { ...base.exterior.recordElement.header, locationId: mapId } } } : {}),
    },
    // TESA11: its slice, and (over several pixels) the centre pixel every slice's ground is flattened to; TS5 x AUDIT TESA
    // II C1: its rim's tiles on each side (0 on a side its own slice shares - terrainTiles.js setLocationTiles' rect)
    capital: Object.freeze({ key: cap.key, k, s, ...(flattenAt ? { flattenAt } : {}), rim: Object.freeze({ W: sx === 0 ? CAPITAL_RIM_TILES : 0, E: sx === D.w - 1 ? CAPITAL_RIM_TILES : 0, N: sy === 0 ? CAPITAL_RIM_TILES : 0, S: sy === D.h - 1 ? CAPITAL_RIM_TILES : 0 }) }),
    ...(ctx.arena ? { arena: ctx.arena } : {}),
  };
}

/** RUMARE-WATER: a slice's sides shared with its capital's sea slice - or every inner side of a sea slice's own - each side
 *  water on both its slices (world/terrain/capitalSea.js capitalSeaGround's `seaEdges`); null where none is. */
function seaEdgesOf(D, sx, sy) {
  const sea = (x, y) => x >= 0 && y >= 0 && x < D.w && y < D.h && D.sea.includes(y * D.w + x);
  const own = sea(sx, sy), side = (x, y) => x >= 0 && y >= 0 && x < D.w && y < D.h && (own || sea(x, y));
  const e = { N: side(sx, sy - 1), E: side(sx + 1, sy), S: side(sx, sy + 1), W: side(sx - 1, sy) };
  return e.N || e.E || e.S || e.W ? Object.freeze(e) : null;
}

/** The district a cell of a capital's grid belongs to, or null - IC-GRAND: the Imperial City's by its law. */
export function capitalDistrict(cap, x, y) {
  return cap?.districtOf ? cap.districtOf(x, y) : districtAt(cap?.districts, x, y);
}

// ---------------------------------------------------------------- IC-GRAND: near and far

/** IC-GRAND: is a capital's slice on (px, py) built near, the player on `current` - within NEAR_RING (world/imperialBlocks.js)
 *  of the player's pixel; `was` the view it stands in (a near one keeps near NEAR_SLACK further). Only a family capital's
 *  slices are ever far. */
export function capitalNear(px, py, current, was = null) {
  const d = Math.max(Math.abs(px - (current?.x ?? px)), Math.abs(py - (current?.y ?? py)));
  return d <= NEAR_RING || (was === 'near' && d <= NEAR_RING + NEAR_SLACK);
}
const _views = new WeakMap();
/**
 * IC-GRAND: THE LOCATION A PIXEL IS BUILT AS - a family capital's slice far from the player (capitalNear) its far view: every
 * cell but the lake's, the open shore's and the arena's its far block (world/imperialBlocks.js imperialViewName), no
 * building, no dungeon, `capital.lod` 'far' - the index's location untouched (its buildings, its quests, its map are the
 * near one's); every other location as it is (a near slice's `capital.lod` reads 'near' through capitalViewOf).
 * @param {any} loc @param {number} px @param {number} py @param {{ x: number, y: number } | null} current
 */
export function capitalBuildView(loc, px, py, current) {
  const cap = loc?.capital ? CAPITALS[loc.capital.k] : null;
  if (!cap?.family || capitalNear(px, py, current)) return loc;
  let v = _views.get(loc);
  if (!v) {
    const ed = loc.exterior.exteriorData, D = capitalDims(cap), s = loc.capital.s, sx = s % D.w, sy = Math.floor(s / D.w);
    // the grid's order: rows from the south (capitalBlockNames') - grid row y is the slice's plan row (7 - y)
    const blockNames = ed.blockNames.map((near, i) => imperialViewName(sy * 8 + (7 - Math.floor(i / 8)), sx * 8 + (i % 8), near, true));
    v = Object.freeze({
      ...loc, hasDungeon: false, dungeon: null,
      exterior: { ...loc.exterior, buildings: [], exteriorData: { ...ed, blockNames, buildingCount: 0 } },
      capital: Object.freeze({ ...loc.capital, lod: 'far' }),
    });
    _views.set(loc, v);
  }
  return v;
}
/** IC-GRAND: the view a built location stands in - 'far', 'near' (a family capital's slice built near), or null (none of a
 *  family capital's). */
export const capitalViewOf = (loc) => (loc?.capital && CAPITALS[loc.capital.k]?.family ? loc.capital.lod ?? 'near' : null);
