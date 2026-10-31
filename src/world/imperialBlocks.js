// @ts-check
// IC-GRAND (2026-10-26, bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY'S BLOCKS, NEAR AND FAR: the city's
// own blocks a cell each (its ground, its walls, its walkers' grid, its trees, its models and its arrivals) and the far
// view of every cell, both answered by law when a pixel's build first reads them (a family on the world-data door,
// formats/worldData/worldDataReplacement.js registerPortBlockFamily - forty thousand cells register nothing up front), and
// the models they place (world/customModels.js registerCustomModelFamily: a cell's fabric, a slice's skyline).
//
// NEAR AND FAR (the owner, at 20 km: "only near blocks get full detail, with a far LOD/impostor for the rest of the city"):
// a slice of the city within NEAR_RING pixels of the player's is built near - every own block's fabric whole and solid
// (world/imperialFabricModels.js fabricCellModel; IC-PROPS: no block of Daggerfall's trade among them since 2026-10-27), its
// walkers' grid and its trees; every other slice the stream holds is built far (imperialFarView) - its ground's stone and
// grass and water, its landmarks' parts, and its skyline (skylineModel: its blocks as masses), no person, no tree but the
// lawns', no door, nothing solid but its landmarks. The location the index
// holds is the near one always (its buildings, its quests, its map); the build reads the view its distance wants, and the
// stream builds a slice again when the player comes near it or leaves it (scenes/tamrielSweepsHost.js
// sweepImperialViews, with a ring of slack so a walk along a pixel's edge does not build it again and again).
//
// Pure: every law here is the plan's and the fabric's (world/imperialCity.js, world/imperialFabric.js); the door's own
// writers (portBlockJson, miscModelAt, startMarkerAt) and the landmarks' footprint are handed in by its install
// (world/capitalModels.js installCapitals), so this module stands below world/tamrielCapitals.js.
import { BLOCK_M } from './spawnedDungeons.js';
import {
  IMPERIAL,
  IMPERIAL_CELLS,
  IMPERIAL_SPAN,
  imperialCode,
  imperialCodeCell,
  imperialSlicePlan,
  imperialTile,
  imperialClosed,
  imperialTree,
  imperialDistrictAt,
  IMPERIAL_TREES,
  IMPERIAL_SLICE_PARTS,
  imperialFarPartId,
  IMPERIAL_ARENA_CODE,
  imperialCellRect,
  rectRadii,
  imperialLand,
  imperialRoadsNear,
  imperialRoadAt,
  imperialGeo,
  pointSeg,
  imperialBearing,
} from './imperialCity.js';
import { fabricCell, fabricGroundIn, fabricTileOf, fabricClosedOf, fabricTreeOf, GROUND } from './imperialFabric.js';
import { fabricCellModel, fabricCellHasModel, skylineModel } from './imperialFabricModels.js';
import { fabricCellLamps, FABRIC_LAMPS } from './imperialFabricLights.js';

const HALF = IMPERIAL_CELLS / 2,
  B = BLOCK_M,
  TILE = B / 16,
  AUTO = B / 64;
const b36 = (n) => n.toString(36).padStart(2, '0');

// ---------------------------------------------------------------- the names and the numbers

/** The blocks' fixed indices (formats/worldData/worldDataReplacement.js: past every fixed one in the tree - the capitals'
 *  run from 901000, the town outline's 906000, TS4's walled towns' 1,000,000 plus twenty bits of a map id, to 2,048,575):
 *  a cell's own block, its far view's, the plan's ring of lake. FOUND (IC-GRAND's perf pass): the own blocks stood at
 *  2,000,000 - a walled town's index for a map id's low bits over 1,000,000 was one of theirs. */
export const IMPERIAL_BLOCK_INDEX = Object.freeze({ own: 2_060_000, far: 2_100_000, lake: 2_200_000 });
/** The models' ids (world/customModels.js families): a cell's fabric, a slice's skyline - past TS4's town walls'
 *  (world/townWalls.js townWallModelId: 3,000,000 plus twenty bits of a map id, to 4,048,575) and the towns' fabric's
 *  (world/urban/townFabricStand.js, from 5,000,000). FOUND (IC-GRAND's perf pass): they stood at 3,000,000 and
 *  3,100,000, inside the town walls' run - a walled town whose map id's low twenty bits fell under 40,000 would have drawn
 *  its wall in a cell of the city's (a model registered alone is asked before a family's). */
export const IMPERIAL_FABRIC_MODEL = 7_000_000;
export const IMPERIAL_SKYLINE_MODEL = 7_100_000;
/** How many slices out from the player's are built near; the slack before a near slice is built far again. */
export const NEAR_RING = 1;
export const NEAR_SLACK = 1;
/** A cell's own block's name (TESA11's: `TESA<code>.RMB`), its far view's (`TESAK<row><column>.RMB`), and its ring lake's
 *  (world/tamrielCapitals.js capitalLakeName's: `TESLIC<row><column>.RMB`). */
export const imperialOwnName = (r, c) => `TESA${imperialCode(r, c)}.RMB`;
export const imperialFarName = (r, c) => `TESAK${b36(r)}${b36(c)}.RMB`;
export const imperialLakeName = (r, c) => `TESLIC${b36(r)}${b36(c)}.RMB`;
/** @type {ReadonlyArray<[RegExp, 'own' | 'far' | 'lake']>} */
const PATTERNS = Object.freeze([
  [/^TESAI([0-9a-z]{2})([0-9a-z]{2})\.RMB$/, 'own'],
  [/^TESAK([0-9a-z]{2})([0-9a-z]{2})\.RMB$/, 'far'],
  [/^TESLIC([0-9a-z]{2})([0-9a-z]{2})\.RMB$/, 'lake'],
]);
/** A name's kind and cell, or null for none of the city's. */
export function imperialBlockOf(name) {
  for (const [re, kind] of PATTERNS) {
    const m = re.exec(name);
    if (!m) continue;
    const r = parseInt(m[1], 36),
      c = parseInt(m[2], 36);
    if (r < IMPERIAL_CELLS && c < IMPERIAL_CELLS) return { kind, r, c };
  }
  return null;
}
/** A block's fixed index, or -1. */
export function imperialBlockIndex(name) {
  const b = imperialBlockOf(name);
  return b ? IMPERIAL_BLOCK_INDEX[b.kind] + b.r * IMPERIAL_CELLS + b.c : -1;
}
/** The name at a fixed index, or null. */
export function imperialBlockName(index) {
  for (const [kind, base] of Object.entries(IMPERIAL_BLOCK_INDEX)) {
    const k = index - base;
    if (k < 0 || k >= IMPERIAL_CELLS * IMPERIAL_CELLS) continue;
    const r = Math.floor(k / IMPERIAL_CELLS),
      c = k % IMPERIAL_CELLS;
    return kind === 'own' ? imperialOwnName(r, c) : kind === 'far' ? imperialFarName(r, c) : imperialLakeName(r, c);
  }
  return null;
}
/** A cell's fabric model's id, and a slice's skyline's. */
export const imperialFabricModelId = (r, c) => IMPERIAL_FABRIC_MODEL + r * IMPERIAL_CELLS + c;
export const imperialSkylineId = (s) => IMPERIAL_SKYLINE_MODEL + s;

// ---------------------------------------------------------------- the carriers

/** A slice's carrier: the first of its own cells in the plan's order (rows north to south) - [r, c], or null. The centre's
 *  is the anchor's (world/tamrielCapitals.js capitalCarrier), worked there. */
export function imperialSliceCarrier(s) {
  const plan = imperialSlicePlan(s),
    sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) if (imperialCodeCell(plan[i][j])) return [sy * 8 + i, sx * 8 + j];
  return null;
}
/** The anchor's cell (the centre slice's carrier): the first own cell whose square has the plan's middle on it. */
export function imperialAnchorCarrier() {
  for (const [r, c] of [
    [HALF - 1, HALF - 1],
    [HALF - 1, HALF],
    [HALF, HALF - 1],
    [HALF, HALF],
  ])
    if (imperialCodeCell(imperialSlicePlan(Math.floor(r / 8) * IMPERIAL_SPAN + Math.floor(c / 8))[r % 8][c % 8]))
      return [r, c];
  return null;
}
/** A cell's slice. */
export const sliceOfCell = (r, c) => Math.floor(r / 8) * IMPERIAL_SPAN + Math.floor(c / 8);
/** Is a cell its slice's carrier (the centre slice's the anchor's). */
export function isCarrier(r, c) {
  const s = sliceOfCell(r, c),
    centre = (IMPERIAL_SPAN * IMPERIAL_SPAN - 1) / 2;
  const k = s === centre ? imperialAnchorCarrier() : imperialSliceCarrier(s);
  return !!k && k[0] === r && k[1] === c;
}

// ---------------------------------------------------------------- the laws

/** Does a cell stand clear of every landmark's ground law but the roads' - inside the districts, off the walls, the isle's
 *  shore, the lake and the landmarks (the laws' own reach and a margin) - so its ground is the roads' and the fabric's
 *  alone. */
function plainCell(r, c) {
  const I = IMPERIAL,
    [x0, z0, x1, z1] = imperialCellRect(r, c),
    [rmin, rmax] = rectRadii(x0, z0, x1, z1),
    g = imperialGeo();
  if (rmin < I.palaceWall.r + 20 || rmax > I.cityWall.r - 30) return false;
  const near = (p, d) => Math.max(x0 - p[0], 0, p[0] - x1) ** 2 + Math.max(z0 - p[1], 0, p[1] - z1) ** 2 < d * d;
  if (
    near(g.temple, Math.hypot(I.temple.w, I.temple.l) / 2 + 10) ||
    near(g.statue, I.statue.plaza + 10) ||
    near(g.divines, I.divines.court + 10) ||
    near(g.pool, I.pool.r0 + 10)
  )
    return false;
  return true;
}
/**
 * A CELL'S OWN LAWS, near (anchor metres, x east, z south): its tile - the landmarks' where they lay one (imperialTile),
 * else the fabric's (fabricTileOf), else the district's stone (the park's grass); closed - the landmarks' insides, the
 * fabric's buildings, courts, walls and canals, and where the landmarks' faces stand (`footprint`); its trees - the
 * lawns', the courts' and the park's, off the models' feet.
 * @param {number} r @param {number} c @param {((x: number, z: number) => boolean) | null} footprint
 */
export function imperialOwnLaws(r, c, footprint = null) {
  const L = fabricCell(r, c),
    plain = plainCell(r, c);
  const [x0, z0, x1, z1] = imperialCellRect(r, c),
    roads = plain ? imperialRoadsNear(x0, z0, x1, z1, 1) : null;
  const ground = (x, z) => fabricGroundIn(L, x, z);
  const landTile = (x, z) => (plain ? (roads && imperialRoadAt(x, z, 0, roads) ? 3 : -1) : imperialTile(x, z));
  const fallback = (x, z) => {
    const d = imperialDistrictAt(x, z);
    return d === 'Arboretum' || d === 'City Isle' ? 2 : 3;
  };
  return {
    tile: (x, z) => {
      const t = landTile(x, z);
      if (t >= 0) return t;
      const f = fabricTileOf(ground(x, z), x, z);
      return f >= 0 ? f : fallback(x, z);
    },
    closed: (x, z) => (!plain && imperialClosed(x, z)) || fabricClosedOf(ground(x, z)) || !!footprint?.(x, z),
    tree: (x, z) => {
      if (footprint?.(x, z)) return -1;
      const t = plain ? -1 : imperialTree(x, z);
      if (t >= 0) return t;
      return landTile(x, z) >= 0 ? -1 : fabricTreeOf(ground(x, z), x, z, IMPERIAL_TREES);
    },
  };
}
/** A cell's far laws: its tile (the landmarks', else the district's stone or the park's grass) and the lawns' trees -
 *  nothing closed (no walker stands in a far slice). */
export function imperialFarLaws(r, c) {
  const plain = plainCell(r, c);
  const [x0, z0, x1, z1] = imperialCellRect(r, c),
    roads = plain ? imperialRoadsNear(x0, z0, x1, z1, 1) : null;
  return {
    tile: (x, z) => {
      const t = plain ? (roads && imperialRoadAt(x, z, 0, roads) ? 3 : -1) : imperialTile(x, z);
      if (t >= 0) return t;
      const d = imperialDistrictAt(x, z);
      return d === 'Arboretum' || d === 'City Isle' ? 2 : 3;
    },
    closed: () => false,
    tree: (x, z) => (plain ? -1 : imperialTree(x, z)),
  };
}

// ---------------------------------------------------------------- the arrivals

/** AUDIT TESA II C7: IS A POINT OPEN GROUND an arrival may stand on - the city's own (no classic block), land, off every
 *  solid, wall, building, court and way over water by a body's margin (the cell's own laws, world/imperialFabric.js
 *  among them). */
export function imperialOpenAt(x, z, lawsOf = imperialOwnLaws) {
  const r = Math.floor(z / B + HALF),
    c = Math.floor(x / B + HALF);
  if (r < 0 || c < 0 || r >= IMPERIAL_CELLS || c >= IMPERIAL_CELLS) return false;
  const cell = imperialSlicePlan(sliceOfCell(r, c))[r % 8][c % 8];
  if (!imperialCodeCell(cell)) return false;
  const I = IMPERIAL,
    rr = Math.hypot(x, z),
    pw = I.palaceWall,
    cw = I.cityWall,
    g = imperialGeo();
  if (Math.abs(rr - pw.r) < pw.thick / 2 + pw.towerR + 6 || Math.abs(rr - cw.r) < cw.thick / 2 + cw.watchR + 6)
    return false;
  if (
    Math.abs(x - g.temple[0]) < I.temple.w / 2 + I.temple.towerS + 6 &&
    Math.abs(z - g.temple[1]) < I.temple.l / 2 + I.temple.towerS + 6
  )
    return false;
  if (
    Math.hypot(x - g.statue[0], z - g.statue[1]) < I.statue.plinth + 6 ||
    Math.hypot(x - g.divines[0], z - g.divines[1]) < I.divines.court + 6
  )
    return false;
  if (Math.hypot(x - g.pool[0], z - g.pool[1]) < I.pool.r0 + 6) return false;
  for (const [cc, h, t] of [
    [g.prison, I.prison.half, I.prison.tower],
    [g.uni, I.university.half, I.university.tower * 2],
  ]) {
    if (Math.abs(Math.max(Math.abs(x - cc[0]), Math.abs(z - cc[1])) - h) < t / 2 + 6) return false;
  }
  if (
    Math.hypot(x - g.prison[0], z - g.prison[1]) < I.prison.bastionR + 6 ||
    Math.hypot(x - g.uniTower[0], z - g.uniTower[1]) < I.university.spireR + 6
  )
    return false;
  if (Math.abs(x - g.uniHall[0]) < I.university.hall / 2 + 6 && Math.abs(z - g.uniHall[1]) < I.university.hall / 2 + 6)
    return false;
  const W = I.waterfront,
    bb = imperialBearing(x, z);
  if (bb >= W.b0 - 2 && bb <= W.b1 + 2 && rr > W.r1 - 8) return false;
  if (pointSeg(x, z, g.bridge[0], g.bridge[1]) < I.bridge.w / 2 + 6) return false;
  if (g.walls.some(([a, b]) => pointSeg(x, z, a, b) < I.districtWall.thick / 2 + 6)) return false;
  const laws = lawsOf(r, c);
  for (const [dx, dz] of [
    [0, 0],
    [4, 0],
    [-4, 0],
    [0, 4],
    [0, -4],
  ]) {
    if (!imperialLand(x + dx, z + dz) || imperialTile(x + dx, z + dz) === 0 || imperialClosed(x + dx, z + dz))
      return false;
    if (Math.floor((z + dz) / B + HALF) === r && Math.floor((x + dx) / B + HALF) === c && laws.closed(x + dx, z + dz))
      return false;
  }
  return true;
}
const _markers = new Map();
/** AUDIT TESA II C7: EVERY SLICE'S START MARKERS - on a 25.6 m lattice of the slice's open ground, inside the city wall
 *  where the slice has any (each side's, else the rest of its ground), the nearest to each of its four sides' middles; worked the first time its carrier is built, that
 *  slice's alone. The anchor's metres. IC-GRAND: each side's nearest asked first and the search stopped at the first open
 *  one (the same picks as testing the whole lattice), a cell's laws made once for all its points - a slice's markers in a
 *  few dozen asks, not a thousand. */
export const imperialSliceMarkers = (s) => {
  let m = _markers.get(s);
  if (!m) _markers.set(s, (m = sliceMarkersOf(s)));
  return m;
};
function sliceMarkersOf(s) {
  const S = 8 * B,
    x0 = (s % IMPERIAL_SPAN) * S - HALF * B,
    z0 = Math.floor(s / IMPERIAL_SPAN) * S - HALF * B,
    lattice = [];
  for (let z = z0 + 12.8; z < z0 + S; z += 25.6) for (let x = x0 + 12.8; x < x0 + S; x += 25.6) lattice.push([x, z]);
  const laws = new Map(),
    lawsOf = (r, c) => {
      const k = r * IMPERIAL_CELLS + c;
      if (!laws.has(k)) laws.set(k, imperialOwnLaws(r, c));
      return laws.get(k);
    };
  const known = new Map(),
    open = (p) => {
      if (!known.has(p)) known.set(p, imperialOpenAt(p[0], p[1], lawsOf));
      return known.get(p);
    };
  const sides = [
    [x0 + S / 2, z0],
    [x0 + S / 2, z0 + S],
    [x0 + S, z0 + S / 2],
    [x0, z0 + S / 2],
  ];
  const nearest = (from, m, picks) =>
    from
      .filter((p) => !picks.includes(p))
      .sort((a, b) => Math.hypot(a[0] - m[0], a[1] - m[1]) - Math.hypot(b[0] - m[0], b[1] - m[1]))
      .find(open);
  const inside = lattice.filter(([x, z]) => Math.hypot(x, z) < IMPERIAL.cityWall.r);
  // inside the wall first; a side with no open ground left inside takes the slice's other open ground (IC-GRAND: at
  // twenty-five pixels a slice across the city wall may hold a sliver inside it, one open point, and an arrival there
  // stood at its edge)
  const picks = [];
  for (const side of sides) {
    const best = nearest(inside, side, picks) ?? nearest(lattice, side, picks);
    if (best) picks.push(best);
  }
  return Object.freeze(picks.map((p) => Object.freeze(p)));
}

// ---------------------------------------------------------------- the blocks themselves

/**
 * THE CITY'S BLOCK OF A NAME, as the door's JSON - its own block near, its far view, its ring lake - or null for none of
 * the city's. `deps` its install's: the door's writers (world/tamrielCapitals.js portBlockJson, miscModelAt,
 * startMarkerAt), the rim's test of a cell's own metres (`rim(r, c, x, z)` - inCapitalRim's), the landmarks' footprint
 * of a slice (`footprintOf(s)`, anchor metres), the anchor's own markers (the centre slice's) and the slices' others'.
 * @param {string} name
 * @param {{ portBlockJson: Function, miscModelAt: Function, startMarkerAt: Function, rim: (r: number, c: number, x: number, z: number) => boolean,
 *   footprintOf: (s: number) => ((x: number, z: number) => boolean) | null, anchorMarkers: number[][], noGround: number }} deps
 */
export function imperialBlockJson(name, deps) {
  const b = imperialBlockOf(name);
  if (!b) return null;
  const { r, c, kind } = b;
  const at = [(HALF - c) * B, (r + 1 - HALF) * B]; // the anchor in the block's own metres
  const anchorOf = (x, z) => imperialAnchorOf(r, c, x, z);
  const rimmed = (laws) => ({
    tile: (x, z) => (deps.rim(r, c, x, z) ? deps.noGround : laws.tile(...anchorOf(x, z))),
    closed: (x, z) => deps.rim(r, c, x, z) || laws.closed(...anchorOf(x, z)),
    tree: (x, z) => (deps.rim(r, c, x, z) ? -1 : laws.tree(...anchorOf(x, z))),
  });
  if (kind === 'lake') {
    const s = sliceOfCell(r, c),
      fp = deps.footprintOf(s);
    return deps.portBlockJson(name, rimmed({ tile: () => 0, closed: (x, z) => !!fp?.(x, z), tree: () => -1 }));
  }
  const s = sliceOfCell(r, c),
    carrier = isCarrier(r, c),
    centre = (IMPERIAL_SPAN * IMPERIAL_SPAN - 1) / 2;
  const parts = carrier ? IMPERIAL_SLICE_PARTS[s] : [];
  if (kind === 'far') {
    // IC-TOWER-LOD: the tower and the palace coarse, as the far ring stands them (imperialFarPartId)
    const models = [...parts.map(imperialFarPartId), ...(carrier ? [imperialSkylineId(s)] : [])].map((id) =>
      deps.miscModelAt(id, at[0], at[1]),
    );
    return deps.portBlockJson(name, { ...rimmed(imperialFarLaws(r, c)), closed: () => false, models });
  }
  const fp = deps.footprintOf(s);
  const laws = imperialOwnLaws(r, c, fp);
  const own = fabricCellHasModel(r, c) ? [imperialFabricModelId(r, c)] : [];
  const models = [...parts, ...own].map((id) => deps.miscModelAt(id, at[0], at[1]));
  const markers = carrier ? (s === centre ? deps.anchorMarkers : imperialSliceMarkers(s)) : [];
  // BLD: the cell's street lamps - Daggerfall's own light flats (world/imperialFabricLights.js), by its flat record law
  const lamps = fabricCellLamps(r, c).map(({ at: [x, z], record }) => ({
    ...deps.startMarkerAt(at[0] + x, at[1] - z),
    TextureArchive: FABRIC_LAMPS.archive,
    TextureRecord: record,
  }));
  return deps.portBlockJson(name, {
    ...rimmed(laws),
    models,
    flats: [...markers.map(([dx, dz]) => deps.startMarkerAt(at[0] + dx, at[1] - dz)), ...lamps],
  });
}

/** A POINT OF CELL (r, c)'s OWN BLOCK (its own metres: x east, z north from its south-west) in the anchor's metres - the one
 *  sum every block's laws are asked through (imperialBlockJson), so a reader of them asks the same point to the last bit
 *  (IC-PROPS: world/imperialYards.js - a law hashed on a metre's floor reads a tile's middle on its edge otherwise). */
export const imperialAnchorOf = (r, c, x, z) => [(c - HALF) * B + x, (r + 1 - HALF) * B - z];
/** A cell's block name in the view a slice is built in: near - its own block, the arena's, the lake's (IC-PROPS: no block of
 *  Daggerfall's kinds since 2026-10-27 - world/imperialCity.js cellOf); far - its far view for every cell but the lake, the
 *  open shore and the arena. `near` the location's own name for the cell. */
export function imperialViewName(r, c, near, far) {
  if (!far) return near;
  const cell = imperialSlicePlan(sliceOfCell(r, c))[r % 8][c % 8];
  if (cell === 'L' || cell === 'O' || cell === IMPERIAL_ARENA_CODE) return near;
  return imperialFarName(r, c);
}
/** The models' families' builds: a cell's fabric (near, solid), a slice's skyline (far, no collider). */
export function imperialModelBuild(id) {
  if (id >= IMPERIAL_FABRIC_MODEL && id < IMPERIAL_FABRIC_MODEL + IMPERIAL_CELLS * IMPERIAL_CELLS) {
    const k = id - IMPERIAL_FABRIC_MODEL;
    return fabricCellModel(Math.floor(k / IMPERIAL_CELLS), k % IMPERIAL_CELLS);
  }
  if (id >= IMPERIAL_SKYLINE_MODEL && id < IMPERIAL_SKYLINE_MODEL + IMPERIAL_SPAN * IMPERIAL_SPAN)
    return skylineModel(id - IMPERIAL_SKYLINE_MODEL);
  return null;
}
/** Does a model id belong to the fabric's family, or the skyline's. */
export const isFabricModelId = (id) =>
  id >= IMPERIAL_FABRIC_MODEL && id < IMPERIAL_FABRIC_MODEL + IMPERIAL_CELLS * IMPERIAL_CELLS;
export const isSkylineId = (id) =>
  id >= IMPERIAL_SKYLINE_MODEL && id < IMPERIAL_SKYLINE_MODEL + IMPERIAL_SPAN * IMPERIAL_SPAN;
/** The tile and automap grid's measures, for the pins. */
export const IMPERIAL_GRID = Object.freeze({ TILE, AUTO });
export { GROUND };
