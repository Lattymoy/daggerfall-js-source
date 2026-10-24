// @ts-check
// TESA11 (2026-10-13, the owner: "the imperial city needs to be much larger and be split into distinct districts with the
// tower very large. The entire city also needs to be lore accurate to daggerfall"; asked, "3x3 pixels" and "Canon layout,
// DF era"; bible/03-World/Arena-Provinces.md TESA11) - THE IMPERIAL CITY OVER NINE PIXELS. Daggerfall's engine stands one
// location on a pixel, eight blocks a side at most; the city stands on nine (`IMPERIAL_SPAN` a side, 2.46 km across), each
// pixel's eight-by-eight slice of one plan its own location, named for its district (`IMPERIAL_SLICE_NAMES`), and every
// slice flattened to the centre's ground (world/terrain/terrainGen.js flattenAt) so they meet level.
//
// THE LAYOUT IS THE CITY'S CANON - the wheel the later games mapped, in Daggerfall's day (3E 405, the reign of Uriel
// Septim VII) and of Daggerfall's own city blocks: City Isle in Lake Rumare; at its heart the Imperial Palace in the
// White-Gold Tower on Green Emperor Way, the emperors' tombs round it, inside the palace wall; round that, within the city
// wall, the six districts on their sectors (bearings clockwise from north) - the Market District to the north-east, the
// Arena District east, the Arboretum south-east, the Temple District south-west, Talos Plaza west, the Elven Gardens
// north-west - each walled from the next with a gate between, a great watch tower where its walls meet the city's (the
// North, North-East, South-East, South, South-West and North-West Watch Towers); outside the walls on the isle the Prison
// District (the Imperial Prison and the Legion's headquarters on the isle's north-eastern shore - TESA-LORE: it stood north of
// north-east, the lore's is north-east), the Arcane University south-east (the Mages Guild's), and the Waterfront on the
// lake's south shore (no source the port can read gives its compass; recorded as the port's placing); Talos Bridge west to
// the mainland. In the Arboretum, the city's park, the statues of the Nine Divines round Talos's at their middle (TESA-LORE). Each district
// is Daggerfall's blocks of its trade (IMPERIAL_MIX) - the Market's shops, the Arena District's Fighters Guild, the Temple
// District's temples, Talos Plaza's and the Elven Gardens' houses, the University's Mages Guild, the Waterfront's Thieves
// Guild - round the port's own landmarks (world/capitalImperial.js). No game data, and no other game's level: shapes and a
// layout of the port's own on the city's canon.
//
// A PLAN OF ITS OWN MEASURES: every cell of the 24 x 24 grid is decided from the metres about the city's middle (its
// anchor, the grid point (12, 12) - the centre pixel's middle): the lake where the cell holds no land; a block of the
// city's own (`I<row><column>`, base 36) where it holds a shore, a wall, a landmark or Green Emperor Way; else one of
// Daggerfall's blocks of its district's mix, off the cell's hash. No landmark stands over a block of Daggerfall's
// (AUDIT-TESA A6-3's law, pinned on every vertex).
import { hash32, BLOCK_M } from './spawnedDungeons.js';

/** Pixels a side, and the plan's cells a side (eight a pixel) - its anchor the middle grid point. */
export const IMPERIAL_SPAN = 3;
export const IMPERIAL_CELLS = 8 * IMPERIAL_SPAN;
const HALF = IMPERIAL_CELLS / 2;
/** The hash's salt (its own, the plan's picks). */
const SALT = 0x1c11;

/** THE CITY'S MEASURES, metres from its middle (x east, z south; a bearing clockwise from north). */
export const IMPERIAL = Object.freeze({
  /** The White-Gold Tower: an octagon throughout, 680 m to its spire's tip. */
  tower: Object.freeze({ plinthR: 86, plinthH: 22, shaftR0: 56, shaftR1: 38, shaftTop: 470, band: 60, galleryR: 62, galleryTop: 494, crownR0: 36, crownR1: 27, crownTop: 548, spireTop: 680, finR: 104, finTop: 340, finThick: 6, door: 8 }),
  /** The tower's plaza of stone, Green Emperor Way's ring road, and the emperors' tombs on its lawns. */
  plaza: 128,
  way: Object.freeze({ r0: 252, r1: 270 }),
  tombs: Object.freeze({ r: 192, n: 8, w: 16, h: 12 }),
  /** The palace wall round Green Emperor Way, a gate to each district (its sector's middle). */
  palaceWall: Object.freeze({ r: 300, thick: 5, h: 14, towerR: 5, towerH: 20, gate: 10, gateH: 9, sides: 72 }),
  /** The city wall, a tower every `towerEvery` degrees, its gates (`gates`: bearings); TESA-LORE: its watch towers (`watchR`,
   *  `watchH`) where the district walls meet it. */
  cityWall: Object.freeze({ r: 900, thick: 9, h: 26, towerR: 12, towerH: 38, gate: 16, gateH: 16, towerEvery: 10, gates: Object.freeze([45, 135, 172, 270]), watchR: 18, watchH: 70 }),
  /** The walls between the districts, from the palace wall to the city wall at each sector's edge, a gate at the middle. */
  districtWall: Object.freeze({ thick: 4, h: 12, gate: 10, gateH: 8 }),
  /** City Isle's shore round the city wall. */
  isle: 1010,
  /** The landmarks. */
  colosseum: Object.freeze({ b: 90, r: 640, rx: 74, rz: 58, h: 38, tiers: 3, floor: Object.freeze([46, 32]) }),
  temple: Object.freeze({ b: 222, r: 680, w: 44, l: 96, h: 28, domeR: 17, towerS: 10, towerH: 48 }),
  statue: Object.freeze({ b: 270, r: 640, plinth: 14, plaza: 46 }),
  prison: Object.freeze({ b: 45, r: 1080, half: 96, h: 16, tower: 12, bastionR: 16, bastionH: 64 }),
  university: Object.freeze({ b: 135, r: 1180, half: 150, h: 12, tower: 9, spireR: 15, spireH: 120, hall: 46 }),
  waterfront: Object.freeze({ b0: 162, b1: 198, r1: 1100, piers: Object.freeze([167, 175, 185, 193]), pierTo: 1190, pierW: 8, deck: 1.2, lightR: 5, lightH: 26 }),
  bridge: Object.freeze({ b: 270, w: 14, deck: 5, parapet: 1.2, pier: 24 }),
  /** TESA-LORE: the Arboretum's statues of the Nine Divines - eight on their plinths in a ring facing Talos's at the middle
   *  of a round paved court, on the sector's middle bearing. */
  divines: Object.freeze({ b: 150, r: 600, court: 46, ring: 28, plinth: 3.6, plinthH: 2.6, figure: 6.5, talosPlinth: 9, talosPlinthH: 5.4, talos: 11 }),
  causeway: 18,
});

/** THE DISTRICTS ON THEIR SECTORS inside the city wall: each its name and the bearing its sector begins at (60 degrees a
 *  sector, clockwise). */
/** @type {ReadonlyArray<readonly [string, number]>} */
export const IMPERIAL_SECTORS = Object.freeze(/** @type {Array<readonly [string, number]>} */ ([
  ['Market District', 0], ['Arena District', 60], ['Arboretum', 120],
  ['Temple District', 180], ['Talos Plaza District', 240], ['Elven Gardens District', 300],
].map((e) => Object.freeze(e))));
/** The nine slices' names, row by row from the north-west (a slice's index sy * 3 + sx): each the district that holds it
 *  most, the centre the city's own name - the location a pixel stands, its loading screen's and its quests'. */
export const IMPERIAL_SLICE_NAMES = Object.freeze([
  'Elven Gardens District', 'Market District', 'Prison District',   // TESA-LORE: the Prison north-east, the Market's north half
  'Talos Plaza District', 'Imperial City', 'Arena District',
  'Temple District', 'Waterfront District', 'Arboretum',
]);
/** EACH DISTRICT'S TRADE: the kinds of Daggerfall's city blocks it lays, one a cell off the cell's hash ('G' a garden of
 *  the city's own). */
export const IMPERIAL_MIX = Object.freeze({
  'Market District': Object.freeze(['GENR', 'GENR', 'ARMR', 'ARMR', 'ALCH', 'GEMS', 'BOOK', 'PAWN', 'BANK', 'TVRN', 'GENR', 'RESI']),
  'Arena District': Object.freeze(['FIGH', 'ARMR', 'TVRN', 'RESI', 'RESI', 'GENR', 'PAWN', 'RESI']),
  'Arboretum': Object.freeze(['G', 'G', 'G', 'G', 'RESI']),
  'Temple District': Object.freeze(['TEMP', 'TEMP', 'TEMP', 'RESI', 'RESI', 'TVRN', 'BOOK', 'LIBR', 'ALCH', 'RESI']),
  'Talos Plaza District': Object.freeze(['RESI', 'RESI', 'RESI', 'RESI', 'TVRN', 'BANK', 'GENR', 'RESI']),
  'Elven Gardens District': Object.freeze(['RESI', 'RESI', 'RESI', 'G', 'TVRN', 'ALCH', 'RESI', 'G']),
  'Waterfront District': Object.freeze(['RESI', 'RESI', 'TVRN', 'PAWN', 'THIE', 'GENR']),
  'Arcane University': Object.freeze(['MAGE', 'LIBR', 'MAGE']),
});
/** The landmarks' model ids (world/customModels.js), and the slice each stands in and is carried by. */
export const IMPERIAL_MODELS = Object.freeze({
  whiteGoldTower: 910200, palaceWall: 910201, tombs: 910202, cityWall: 910203, districtWalls: 910204, colosseum: 910205,
  templeOfTheOne: 910206, talosStatue: 910207, prison: 910208, university: 910209, waterfront: 910210, talosBridge: 910211,
  nineDivines: 910212,   // TESA-LORE
});
export const IMPERIAL_CARRY = Object.freeze({
  [IMPERIAL_MODELS.whiteGoldTower]: 4, [IMPERIAL_MODELS.palaceWall]: 4, [IMPERIAL_MODELS.tombs]: 4, [IMPERIAL_MODELS.cityWall]: 4,
  [IMPERIAL_MODELS.districtWalls]: 4, [IMPERIAL_MODELS.colosseum]: 5, [IMPERIAL_MODELS.templeOfTheOne]: 6, [IMPERIAL_MODELS.talosStatue]: 3,
  [IMPERIAL_MODELS.prison]: 2, [IMPERIAL_MODELS.university]: 8, [IMPERIAL_MODELS.waterfront]: 7, [IMPERIAL_MODELS.talosBridge]: 3,
  [IMPERIAL_MODELS.nineDivines]: 7,   // TESA-LORE: the Prison in the north-east pixel; the Divines in the south one
});

// ---------------------------------------------------------------- the geometry

const rad = (d) => (d * Math.PI) / 180;
/** A bearing (degrees clockwise from north) and a distance to the metres (x east, z south).
 * @param {number} b @param {number} r @returns {[number, number]} */
export const polar = (b, r) => [r * Math.sin(rad(b)), -r * Math.cos(rad(b))];
/** The bearing of a point, [0, 360). */
export const imperialBearing = (x, z) => { const b = (Math.atan2(x, -z) * 180) / Math.PI; return b < 0 ? b + 360 : b; };
/** @param {number} x @param {number} z @param {number[]} c @param {number} h */
const inBox = (x, z, c, h) => Math.abs(x - c[0]) <= h && Math.abs(z - c[1]) <= h;
/** A rectangle's nearest and farthest distances from the middle. */
function rectRadii(x0, z0, x1, z1) {
  const nx = x0 > 0 ? x0 : x1 < 0 ? x1 : 0, nz = z0 > 0 ? z0 : z1 < 0 ? z1 : 0;
  return [Math.hypot(nx, nz), Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)), Math.max(Math.abs(z0), Math.abs(z1)))];
}
/** A point's distance to a segment.
 * @param {number} px @param {number} pz @param {number[]} a @param {number[]} b */
function pointSeg(px, pz, a, b) {
  const [ax, az] = a, [bx, bz] = b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
/** A segment's distance to a rectangle (0 where it crosses it).
 * @param {number[]} a @param {number[]} b @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 */
function segRect(a, b, x0, z0, x1, z1) {
  const inside = (/** @type {number[]} */ p) => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1;
  if (inside(a) || inside(b)) return 0;
  /** @type {number[][][]} */
  const edges = [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]];
  const cross = (/** @type {number[]} */ p, /** @type {number[]} */ q, /** @type {number[]} */ r, /** @type {number[]} */ s) => {
    const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    if (!d) return false;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  if (edges.some(([r, s]) => cross(a, b, r, s))) return 0;
  return Math.min(...[[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => pointSeg(x, z, a, b)), ...edges.flatMap(([r, s]) => [pointSeg(a[0], a[1], r, s), pointSeg(b[0], b[1], r, s)]));
}
/** A rectangle's distance to a point.
 * @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {number[]} p */
const rectPoint = (x0, z0, x1, z1, p) => Math.hypot(Math.max(x0 - p[0], 0, p[0] - x1), Math.max(z0 - p[1], 0, p[1] - z1));
/** Two squares' overlap (the second centred at c, half h).
 * @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {number[]} c @param {number} h */
const rectBox = (x0, z0, x1, z1, c, h) => x1 >= c[0] - h && x0 <= c[0] + h && z1 >= c[1] - h && z0 <= c[1] + h;

/** The district walls' lines: at each sector's edge, from the palace wall to the city wall. */
export const districtWallLines = (I = IMPERIAL) => IMPERIAL_SECTORS.map(([, b]) => [polar(b, I.palaceWall.r), polar(b, I.cityWall.r)]);
/** TESA-LORE: the watch towers' feet - where each district wall meets the city wall. */
export const watchTowersAt = (I = IMPERIAL) => IMPERIAL_SECTORS.map(([, b]) => polar(b, I.cityWall.r));
/** TESA-LORE: the Divines' court's middle, and each of the eight's plinth about it (the first on the court's bearing out,
 *  then round) - Talos's at the middle. */
export const divinesAt = (I = IMPERIAL) => polar(I.divines.b, I.divines.r);
export const divinePlinths = (I = IMPERIAL) => { const [x, z] = divinesAt(I); return Array.from({ length: 8 }, (_, i) => { const [dx, dz] = polar(I.divines.b + 22.5 + i * 45, I.divines.ring); return /** @type {[number, number]} */ ([x + dx, z + dz]); }); };
/** The stone ways from the city's gates out over the isle: to the Prison, the University and the Waterfront. */
export const causewayLines = (I = IMPERIAL) => [
  [polar(I.prison.b, I.cityWall.r), polar(I.prison.b, I.prison.r - I.prison.half)],
  [polar(I.university.b, I.cityWall.r), polar(I.university.b, I.university.r - I.university.half)],
  [polar(172, I.cityWall.r), polar(172, I.waterfront.r1 - 30)],
];
/** Talos Bridge's line: from the west gate to the city's west edge, over the lake. */
export const bridgeLine = (I = IMPERIAL) => [polar(I.bridge.b, I.cityWall.r), [-(HALF * BLOCK_M), 0]];

/** IS A POINT LAND - City Isle: within its shore, the Prison's and the University's grounds, or the Waterfront's. */
export function imperialLand(x, z, I = IMPERIAL) {
  const r = Math.hypot(x, z);
  if (r <= I.isle) return true;
  if (inBox(x, z, polar(I.prison.b, I.prison.r), I.prison.half + 24)) return true;
  if (inBox(x, z, polar(I.university.b, I.university.r), I.university.half + 24)) return true;
  const b = imperialBearing(x, z);
  return b >= I.waterfront.b0 && b <= I.waterfront.b1 && r <= I.waterfront.r1;
}
/** THE DISTRICT A POINT STANDS IN: Green Emperor Way inside the palace wall, a sector's district inside the city wall,
 *  the Prison's, the University's or the Waterfront's grounds outside it, the rest of the isle City Isle - or null (the
 *  lake). */
export function imperialDistrictAt(x, z, I = IMPERIAL) {
  const r = Math.hypot(x, z);
  if (r < I.palaceWall.r) return 'Green Emperor Way';
  if (r < I.cityWall.r) { const b = imperialBearing(x, z); return IMPERIAL_SECTORS[Math.min(5, Math.floor(b / 60))][0]; }
  if (inBox(x, z, polar(I.prison.b, I.prison.r), I.prison.half + 24)) return 'Prison District';
  if (inBox(x, z, polar(I.university.b, I.university.r), I.university.half + 24)) return 'Arcane University';
  if (!imperialLand(x, z, I)) return null;
  const b = imperialBearing(x, z);
  return b >= I.waterfront.b0 && b <= I.waterfront.b1 && r > I.isle - 60 ? 'Waterfront District' : 'City Isle';
}
/**
 * WHERE THE CITY'S OWN STANDS, by a rectangle of the plan (x0, z0)-(x1, z1): Green Emperor Way to its wall; the city wall's
 * band and its towers (TESA-LORE: its watch towers within it); the district walls; the stone ways and Talos Bridge; the Colosseum, the
 * Temple of the One, Talos Plaza's statue, the Divines' court (TESA-LORE); the Prison's grounds; the University's wall, its
 * tower and its hall; the Waterfront's quay and piers -
 * each with the margin its towers and its walkers want. A cell any of them touches is a block of the city's own.
 */
export function imperialReserved(x0, z0, x1, z1, I = IMPERIAL) {
  const [rmin, rmax] = rectRadii(x0, z0, x1, z1);
  const pw = I.palaceWall, cw = I.cityWall;
  if (rmin < pw.r + pw.thick / 2 + pw.towerR + 2) return true;
  const m = cw.thick / 2 + cw.towerR + 2;
  if (rmin < cw.r + m && rmax > cw.r - m) return true;
  if (districtWallLines(I).some(([a, b]) => segRect(a, b, x0, z0, x1, z1) < I.districtWall.thick / 2 + 3)) return true;
  if (rectPoint(x0, z0, x1, z1, divinesAt(I)) < I.divines.court + 4) return true;   // TESA-LORE: the Divines' court
  if ([...causewayLines(I), bridgeLine(I)].some(([a, b], i) => segRect(a, b, x0, z0, x1, z1) < (i === 3 ? I.bridge.w : I.causeway) / 2 + 4)) return true;
  const C = I.colosseum, cc = polar(C.b, C.r);
  if (x1 >= cc[0] - C.rx - 6 && x0 <= cc[0] + C.rx + 6 && z1 >= cc[1] - C.rz - 6 && z0 <= cc[1] + C.rz + 6) return true;
  const T = I.temple;
  if (rectPoint(x0, z0, x1, z1, polar(T.b, T.r)) < Math.hypot(T.w / 2 + T.towerS, T.l / 2 + T.towerS) + 6) return true;
  if (rectPoint(x0, z0, x1, z1, polar(I.statue.b, I.statue.r)) < I.statue.plaza + 4) return true;
  if (rectBox(x0, z0, x1, z1, polar(I.prison.b, I.prison.r), I.prison.half + 24)) return true;
  const U = I.university, uc = polar(U.b, U.r), um = U.tower + 4;
  const inner = U.half - um;
  if (rectBox(x0, z0, x1, z1, uc, U.half + um) && !(x0 >= uc[0] - inner && x1 <= uc[0] + inner && z0 >= uc[1] - inner && z1 <= uc[1] + inner)) return true;
  if (rectPoint(x0, z0, x1, z1, universityTowerAt(I)) < U.spireR + 6 || rectPoint(x0, z0, x1, z1, universityHallAt(I)) < U.hall / 2 + 6) return true;
  const W = I.waterfront, b0 = imperialBearing((x0 + x1) / 2, (z0 + z1) / 2);
  if (rmax > W.r1 - 40 && rmin < W.pierTo + 6 && b0 >= W.b0 - 4 && b0 <= W.b1 + 4) return true;
  return false;
}
/** The University's tower (its compound's north-east corner, inside its wall) and its domed hall (the south-west). */
export const universityTowerAt = (I = IMPERIAL) => { const [x, z] = polar(I.university.b, I.university.r); return [x + I.university.half * 0.55, z - I.university.half * 0.55]; };
export const universityHallAt = (I = IMPERIAL) => { const [x, z] = polar(I.university.b, I.university.r); return [x - I.university.half * 0.5, z + I.university.half * 0.5]; };
/** The prison's Bastion (the compound's middle). */
export const prisonAt = (I = IMPERIAL) => polar(I.prison.b, I.prison.r);

// ---------------------------------------------------------------- the plan

/** A cell's own code and its block's name: `I` and its row and column in base 36. */
export const imperialCode = (r, c) => `I${r.toString(36)}${c.toString(36)}`;
const B = BLOCK_M;
/** How much of a cell is land: 0 none, 1 some (a shore), 2 all - over a 5 x 5 of its points. */
function landShare(x0, z0, I = IMPERIAL) {
  let n = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (imperialLand(x0 + (i + 0.5) * (B / 5), z0 + (j + 0.5) * (B / 5), I)) n++;
  return n === 0 ? 0 : n === 25 ? 2 : 1;
}
/** EACH DISTRICT'S SIGNATURE: the trade it is known by, laid on its first cell of Daggerfall's blocks where the hash laid
 *  none - the Market's general store, the Arena District's Fighters Guild, the Temple District's temple, Talos Plaza's
 *  bank, the Elven Gardens' tavern, the Waterfront's Thieves Guild, the University's Mages Guild. */
export const IMPERIAL_SIGNATURE = Object.freeze({
  'Market District': 'GENR', 'Arena District': 'FIGH', 'Temple District': 'TEMP', 'Talos Plaza District': 'BANK',
  'Elven Gardens District': 'TVRN', 'Waterfront District': 'THIE', 'Arcane University': 'MAGE',
});
/** THE PLAN: 24 rows north to south, each 24 cells west to east. */
export const IMPERIAL_CITY_PLAN = Object.freeze((() => {
  const district = (r, c) => imperialDistrictAt((c - HALF + 0.5) * B, (r - HALF + 0.5) * B);
  const rows = Array.from({ length: IMPERIAL_CELLS }, (_, r) => Array.from({ length: IMPERIAL_CELLS }, (_, c) => {
    const x0 = (c - HALF) * B, z0 = (r - HALF) * B, x1 = x0 + B, z1 = z0 + B;
    const land = landShare(x0, z0);
    if (land === 0) return 'L';
    const mix = IMPERIAL_MIX[district(r, c) ?? ''];
    if (land === 1 || !mix || imperialReserved(x0, z0, x1, z1)) return imperialCode(r, c);
    return mix[hash32(SALT, c, r, 11) % mix.length];
  }));
  for (const [d, kind] of Object.entries(IMPERIAL_SIGNATURE)) {
    const cells = rows.flatMap((row, r) => row.map((cell, c) => [r, c, cell])).filter(([r, c, cell]) => district(r, c) === d && cell !== 'L' && !/^I/.test(cell));
    if (cells.length && !cells.some(([, , cell]) => cell === kind)) rows[cells[0][0]][cells[0][1]] = kind;
  }
  return rows.map((row) => Object.freeze(row));
})());
/** The districts, by cell (x, y) of the plan - the names its streets answer to. */
export const IMPERIAL_DISTRICTS = Object.freeze(Object.fromEntries((() => {
  const out = new Map();
  for (let r = 0; r < IMPERIAL_CELLS; r++) for (let c = 0; c < IMPERIAL_CELLS; c++) {
    const d = imperialDistrictAt((c - HALF + 0.5) * B, (r - HALF + 0.5) * B);
    if (!d) continue;
    if (!out.has(d)) out.set(d, []);
    out.get(d).push(Object.freeze([c, r]));
  }
  return [...out].map(([k, v]) => [k, Object.freeze(v)]);
})()));

// ---------------------------------------------------------------- the ground's laws

/** The tile at a point: the lake's water, the stone of the plaza, of Green Emperor Way, of the walls' feet, the Divines'
 *  court (TESA-LORE), the streets, the ways, the grounds and the quay; the grass of the lawns, the Arboretum and the isle.
 *  Water 0, grass 2, stone 3. */
export function imperialTile(x, z, I = IMPERIAL) {
  if (!imperialLand(x, z, I)) return 0;
  const r = Math.hypot(x, z);
  if (r < I.plaza || (r >= I.way.r0 && r <= I.way.r1)) return 3;
  if (r < I.palaceWall.r - 6) return 2;
  if (Math.abs(r - I.palaceWall.r) <= 8 || Math.abs(r - I.cityWall.r) <= 14) return 3;
  if (Math.hypot(x - divinesAt(I)[0], z - divinesAt(I)[1]) < I.divines.court) return 3;   // TESA-LORE: the Divines' court
  if ([...causewayLines(I), bridgeLine(I)].some(([a, b]) => pointSeg(x, z, a, b) <= I.causeway / 2)) return 3;
  const d = imperialDistrictAt(x, z, I);
  if (d === 'Arboretum' || d === 'City Isle' || d === 'Elven Gardens District') return 2;
  return 3;
}
/** The closed ground at a point (the walkers' navgrid; world/capitalModels.js capitalFootprint closes every face that
 *  stands): the solids' insides - the tower's plinth, the tombs, the Colosseum's stands, the Temple, the statue's plinth,
 *  the Divines' plinths (TESA-LORE), the Bastion, the University's tower and hall. */
export function imperialClosed(x, z, I = IMPERIAL) {
  if (Math.hypot(x, z) < I.tower.plinthR + 1) return true;
  for (let i = 0; i < I.tombs.n; i++) { const [tx, tz] = polar(22.5 + i * (360 / I.tombs.n), I.tombs.r); if (Math.abs(x - tx) < I.tombs.w / 2 + 0.5 && Math.abs(z - tz) < I.tombs.w / 2 + 0.5) return true; }
  const C = I.colosseum, [cx, cz] = polar(C.b, C.r), e = ((x - cx) / C.rx) ** 2 + ((z - cz) / C.rz) ** 2, f = ((x - cx) / C.floor[0]) ** 2 + ((z - cz) / C.floor[1]) ** 2;
  if (e <= 1.02 && f > 1) return !colosseumGate(x - cx, z - cz, C);
  const T = I.temple, [tx, tz] = polar(T.b, T.r);
  if (Math.abs(x - tx) < T.w / 2 + 0.5 && Math.abs(z - tz) < T.l / 2 + 0.5) return true;
  const [sx, sz] = polar(I.statue.b, I.statue.r);
  if (Math.abs(x - sx) < I.statue.plinth / 2 + 0.5 && Math.abs(z - sz) < I.statue.plinth / 2 + 0.5) return true;
  // TESA-LORE: the Divines' plinths, Talos's at the middle
  const D = I.divines, [ax, az] = divinesAt(I);
  if (Math.abs(x - ax) < D.talosPlinth / 2 + 1.5 && Math.abs(z - az) < D.talosPlinth / 2 + 1.5) return true;
  if (divinePlinths(I).some(([px, pz]) => Math.abs(x - px) < D.plinth / 2 + 0.5 && Math.abs(z - pz) < D.plinth / 2 + 0.5)) return true;
  const [px, pz] = prisonAt(I);
  if (Math.hypot(x - px, z - pz) < I.prison.bastionR + 1) return true;
  const [ux, uz] = universityTowerAt(I), [hx, hz] = universityHallAt(I);
  if (Math.hypot(x - ux, z - uz) < I.university.spireR + 1 || (Math.abs(x - hx) < I.university.hall / 2 + 0.5 && Math.abs(z - hz) < I.university.hall / 2 + 0.5)) return true;
  return false;
}
/** The Colosseum's four ways in through its stands - its two axes, 8 m wide. */
export const colosseumGate = (dx, dz, C = IMPERIAL.colosseum) => (Math.abs(dz) < 4 && Math.abs(dx) > C.floor[0] - 2) || (Math.abs(dx) < 4 && Math.abs(dz) > C.floor[1] - 2);
/** The climate's own trees (scenery records - world/tamrielCapitals.js's gardens'). */
const TREES = Object.freeze([12, 15, 16, 18]);
/** A tree at a tile's centre, or -1: on Green Emperor Way's lawns one in seven, the Arboretum's one in four, the isle's
 *  one in ten - grass alone, clear of the tombs and the plaza. */
export function imperialTree(x, z, I = IMPERIAL) {
  if (imperialTile(x, z, I) !== 2) return -1;
  const r = Math.hypot(x, z), d = imperialDistrictAt(x, z, I);
  const every = d === 'Green Emperor Way' ? (r > I.plaza + 10 && Math.abs(r - I.tombs.r) > I.tombs.w ? 7 : 0) : d === 'Arboretum' ? 4 : d === 'City Isle' ? 10 : 0;
  if (!every) return -1;
  const h = hash32(SALT, Math.floor(x), Math.floor(z), 9);
  return h % every === 0 ? TREES[(h >>> 3) % TREES.length] : -1;
}
/** The city's own blocks: one a cell the plan gives a code (imperialCode), each a block of the city's ground laws. */
export const IMPERIAL_BLOCKS = Object.freeze(Object.fromEntries(IMPERIAL_CITY_PLAN.flatMap((row) => row.filter((cell) => /^I[0-9a-n]{2}$/.test(cell)))
  .map((code) => [code, Object.freeze({ name: `TESA${code}.RMB`, tile: (x, z) => imperialTile(x, z), closed: (x, z) => imperialClosed(x, z), tree: (x, z) => imperialTree(x, z) })])));
