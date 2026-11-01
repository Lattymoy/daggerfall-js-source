// @ts-check
// TESA11 (2026-10-13, the owner: "the imperial city needs to be much larger and be split into distinct districts with the
// tower very large. The entire city also needs to be lore accurate to daggerfall"; asked, "3x3 pixels" and "Canon layout,
// DF era"; bible/03-World/Arena-Provinces.md TESA11) - THE IMPERIAL CITY OVER SEVERAL PIXELS. Daggerfall's engine stands
// one location on a pixel, eight blocks a side at most; the city stands on `IMPERIAL_SPAN` a side, each pixel's eight-by-
// eight slice of one plan its own location, named for its district (`imperialSliceName`), and every slice flattened to
// the centre's ground (world/terrain/terrainGen.js flattenAt) so they meet level. TS5 stood it on seven pixels; IC-GRAND
// (2026-10-26, the owner: "Imperial city needs to be larger. Im thinking 10km", then "Lets do 20km";
// bible/03-World/Arena-Provinces.md IC-GRAND) on twenty-five: 20.48 km across.
//
// THE LAYOUT IS THE CITY'S CANON - the wheel the later games mapped, in Daggerfall's day (3E 405, the reign of Uriel
// Septim VII): City Isle in Lake Rumare; at its heart the Imperial Palace in the White-Gold Tower on Green Emperor Way,
// the emperors' tombs round it, inside the palace wall; round that, within the city wall, the six districts on their
// sectors (bearings clockwise from north) - the Market District to the north-east, the Arena District east, the Arboretum
// south-east, the Temple District south-west, Talos Plaza west, the Elven Gardens north-west - each walled from the next
// with gates between, a great watch tower where its walls meet the city's; outside the walls on the isle the Prison
// District (the Imperial Prison and the Legion's headquarters on the isle's north-eastern shore), the Arcane University
// south-east, and the Waterfront on the lake's south shore (no source the port can read gives its compass; recorded as
// the port's placing); Talos Bridge west over the lake. In the Arboretum, the city's park, the statues of the Nine
// Divines round Talos's at their middle (TESA-LORE). IC-GRAND: each district its grand avenue, out from its palace gate
// through its own heart to its own gate in the city wall; its heart its landmark (the Market's great square, the Arena
// District's arena - Daggerfall's own, Kamer's colosseum block (world/arena/arenaCity.js ARENA_BLOCK), the Arboretum's
// Divines, the Temple of the One, Talos's dragon, the Elven Gardens' pool); its streets and its buildings its own
// (world/imperialFabric.js) - IC-PROPS: its trade's too (world/imperialFabricBuildings.js DISTRICT_TRADE), where
// Daggerfall's blocks of it stood along its avenue and round its heart until 2026-10-27. No game data, and no other game's
// level: shapes and a layout of the port's own on the city's canon.
//
// A PLAN OF ITS OWN MEASURES: every cell of the IMPERIAL_CELLS-square grid is decided from the metres about the city's
// middle (its anchor, the centre pixel's middle): the lake where the cell holds no land; open ground past the lake's far
// shore; Daggerfall's arena in its one cell; else a block of the city's own (`I<row><column>`, base 36), its ground, its
// walls, its streets and its buildings the city's laws (IC-PROPS: no other block of Daggerfall's - cellOf). IC-GRAND: the plan is worked a slice
// at a time, the first time a slice is asked (`imperialSlicePlan`) - 40,000 cells made at the module's load were seconds.
// No landmark stands over a block of Daggerfall's (AUDIT-TESA A6-3's law, pinned on every vertex - the arena's, now).
import { hash32, BLOCK_M } from './blockHash.js'; // RUMARE-WATER: the leaf, so the workers reading the plan (world/rumareWaters.js) reach world/ alone

/** Pixels a side, and the plan's cells a side (eight a pixel) - its anchor the middle grid point. TS5 (the owner: "7x7
 *  pixels"): seven; IC-GRAND (the owner: "Lets do 20km"): twenty-five, 20.48 km - an odd span keeps a centre pixel, the
 *  tower's, and the plan's anchor that pixel's middle (24 would be 19.66 km, its middle a pixel corner). */
export const IMPERIAL_SPAN = 25;
export const IMPERIAL_CELLS = 8 * IMPERIAL_SPAN;
const HALF = IMPERIAL_CELLS / 2;
/** The hash's salt (its own, the plan's picks). */
const SALT = 0x1c11;

/** THE CITY'S MEASURES, metres from its middle (x east, z south; a bearing clockwise from north). IC-GRAND: the wheel at
 *  twenty-five pixels - the city wall 6.9 km out (TS5's 1950), the palace wall 2.3 km, the isle 7.9 km, Lake Rumare's far
 *  shore 10 km; the walls thicker and (the team's spec, forwarded by the owner: "Walls should be higher. Like 35-40
 *  meters") 38 m tall; the White Tower slim (the same spec: "500m+ height, like 150-200m diameter in the foundation and
 *  like 60-70m diameter in the shaft"); the Temple of the One and the compounds larger, the arena Daggerfall's own. */
export const IMPERIAL = Object.freeze({
  /** The White-Gold Tower. IC-GRAND, the owner (2026-10-26): "the imperial city tower model needs to be much larger and
   *  taller like this with the surrounding gate have large pillars like the image shows" - over the team's spec (a shaft
   *  60-70 m across, 500 m and more: 760 m) and TESA11's octagon: ROUND (`sides` faces), TS5's 1360 m to its gilt spire's
   *  tip; out of the palace's rotunda (`plinthR` round - 320 m across - and `plinthH` high, under its low dome `domeH`, an
   *  arcade of `arches` round its wall and `domes` little domes on its rim); its shaft 144 m across at its foot and 108 m
   *  at its gallery, FLUTED (`flutes` ribs, `flute` deep) in TIERS of `tier` metres ringed by cornices (`cornice` out,
   *  every other a gilt balcony); its gallery, its crown (fluted, crenellated, `crownR0` to `crownR1`) and its spire;
   *  its door a man's. */
  tower: Object.freeze({
    sides: 48,
    plinthR: 160,
    plinthH: 56,
    domeH: 44,
    arches: 24,
    domes: 12,
    domeR: 12,
    shaftR0: 72,
    shaftR1: 54,
    shaftTop: 1090,
    tier: 126,
    cornice: 3.5,
    flutes: 48,
    flute: 0.045,
    galleryR: 70,
    galleryTop: 1120,
    crownR0: 54,
    crownR1: 46,
    crownTop: 1210,
    spireTop: 1360,
    door: 8,
  }),
  /** The tower's plaza of stone, Green Emperor Way's ring road, and the emperors' tombs. IC-GRAND (the coordinator's review
   *  of the renders: "the emperors' tombs as real monuments along the way"): each a marble mausoleum on its podium, `w`
   *  square and `h` to its cornice, its portico of `columns` toward the Way and a paved walk (`walk` wide) out to it - on
   *  the Way's inner verge, its forecourt between (TESA11's sixteen-metre tombs stood on the lawns 1.4 km out). */
  plaza: 300,
  way: Object.freeze({ r0: 2140, r1: 2180 }),
  tombs: Object.freeze({ r: 2080, n: 24, w: 26, h: 18, podium: 3, columns: 6, walk: 10 }),
  /** IC-GRAND (the same review: "the palace at the tower's foot"): THE IMPERIAL PALACE round the tower's plaza - a ring of
   *  `sides` marble wings between `r0` and `r1` (their inner and outer faces' distances from the middle), `h` to their
   *  eaves under roofs of slate, a gate `gate` wide and `gateH` high through each wing that faces a palace gate; the
   *  owner's "large pillars": a great round pillar-tower (`pavilionR` round, to `pavilionH` - well over the wings,
   *  crenellated) at each corner and either side of each gate; a paved terrace `terrace` round it. */
  palace: Object.freeze({
    r0: 312,
    r1: 352,
    h: 24,
    sides: 12,
    gate: 26,
    gateH: 16,
    pavilionR: 16,
    pavilionH: 64,
    terrace: 16,
  }),
  /** IC-GRAND (the same review: "Green Emperor Way's gardens and paths ... trees and statuary"): THE PALACE GARDENS - a
   *  paved path out from the palace's terrace to the Way every `every` degrees (`path` wide; those on a district's bearing
   *  run on through its palace gate), ring walks round the tower (`walks`, `walk` wide), a fountain where a path crosses a
   *  walk (its basin `fountainR`, a paved round `round` past it), the emperors' statues along every path (`statueEvery`
   *  apart, `statueOff` out from its middle on either side) and its rows of trees beyond them (`rowOff` out, a tree every
   *  `rowEvery`), groves between. */
  gardens: Object.freeze({
    every: 30,
    path: 14,
    walks: Object.freeze([900, 1500]),
    walk: 8,
    fountainR: 9,
    round: 6,
    statueEvery: 160,
    statueOff: 9.5,
    rowOff: 16,
    rowEvery: 12.8,
  }),
  /** The palace wall round the Palace District, a gate to each district (its sector's middle, its avenue's head). */
  palaceWall: Object.freeze({ r: 2300, thick: 8, h: 20, towerR: 8, towerH: 30, gate: 16, gateH: 13, sides: 360 }),
  /** The city wall, a tower every `towerEvery` degrees, its gates (`gates`: bearings - each district's avenue's, the
   *  Prison's, the University's and the Waterfront's); TESA-LORE: its watch towers (`watchR`, `watchH`) where the district
   *  walls meet it. */
  cityWall: Object.freeze({
    r: 6900,
    thick: 14,
    h: 38,
    towerR: 16,
    towerH: 52,
    gate: 24,
    gateH: 22,
    towerEvery: 2,
    gates: Object.freeze([30, 45, 90, 135, 150, 195, 210, 270, 330]),
    watchR: 26,
    watchH: 100,
  }),
  /** IC-GRAND, THE ROADS (the team's spec: "Roads should circle around the White Tower with wide long straights every" -
   *  its sentence cut there, read as ring roads round the tower joined by radial avenues at regular intervals): round the
   *  tower Green Emperor Way inside the palace wall and three ring roads in the districts (`rings`, `ring` wide - each
   *  district wall's three gates on them), and out from the palace wall to the city wall a straight road every fifteen
   *  degrees - each district's grand avenue at its sector's middle (`avenue` wide), a radial either side of it at its
   *  quarters (`radial` wide; the district walls the sixths between). */
  roads: Object.freeze({
    rings: Object.freeze([3450, 4600, 5750]),
    ring: 20,
    radials: Object.freeze([15, 45]),
    radial: 16,
  }),
  /** The walls between the districts, from the palace wall to the city wall at each sector's edge, a gate at each of
   *  `gates` (a share of its length). */
  districtWall: Object.freeze({ thick: 6, h: 16, gate: 16, gateH: 12, gates: Object.freeze([0.25, 0.5, 0.75]) }),
  /** City Isle's shore round the city wall, and Lake Rumare's far shore round the isle (the land past it its own). */
  isle: 7900,
  lake: 10000, // AUDIT TESA II C1 at IC-GRAND's scale: its far shore and the bridge's landing short of the rim's inner edge (10,169.6 m: the plan's half less CAPITAL_RIM_M) and inside the city's own blocks (10,137.6 m: AUDIT-TESA A6-3, none in the land's)
  /** RUMARE-WATER (bible/03-World/Tamriel.md RUMARE-WATER): the Waterfront's mouth - the lake south through its far shore
   *  to the span's edge, `mouth` metres either side of the city's middle line: the Waterfront canal's three pixels
   *  (world/tamriel/tamrielGeography.js WATERFRONT_CANAL's `half` and a half, pinned equal), so the lake meets it. */
  mouth: 1228.8,
  /** The districts' grand avenues: from each palace gate out along its sector's middle to the city wall, `w` wide. */
  avenue: Object.freeze({ w: 30 }),
  /** Each district's heart, on its avenue `r` out (the Temple District's the Temple of the One's). */
  heart: 4600,
  /** The landmarks. IC-GRAND: the Arena District's arena is Daggerfall's (world/arena/arenaCity.js) - its block in the
   *  cell under (`b`, `r`) - where TESA11's Colosseum of the port's own stood. */
  arena: Object.freeze({ b: 90, r: 4600 }),
  temple: Object.freeze({ b: 210, r: 4400, w: 60, l: 130, h: 36, domeR: 24, towerS: 14, towerH: 66 }),
  statue: Object.freeze({ b: 270, r: 4600, plinth: 22, plaza: 110 }),
  prison: Object.freeze({ b: 45, r: 7400, half: 300, h: 22, tower: 18, bastionR: 30, bastionH: 100 }),
  university: Object.freeze({ b: 135, r: 7500, half: 340, h: 16, tower: 14, spireR: 24, spireH: 220, hall: 90 }),
  waterfront: Object.freeze({
    b0: 158,
    b1: 202,
    r1: 8100,
    piers: Object.freeze(Array.from({ length: 21 }, (_, i) => 160 + i * 2)),
    pierTo: 8450,
    pierW: 10,
    deck: 1.2,
    lightR: 8,
    lightH: 36,
  }), // AUDIT TESA II C1: the piers short of the rim
  bridge: Object.freeze({ b: 270, w: 24, deck: 8, parapet: 1.2, pier: 32, landing: 40 }), // AUDIT TESA II C1: its deck down to its far shore over its last `landing` metres
  /** TESA-LORE: the Arboretum's statues of the Nine Divines - eight on their plinths in a ring facing Talos's at the middle
   *  of a round paved court, at the Arboretum's heart. */
  divines: Object.freeze({
    b: 150,
    r: 4600,
    court: 70,
    ring: 40,
    plinth: 3.6,
    plinthH: 2.6,
    figure: 6.5,
    talosPlinth: 9,
    talosPlinthH: 5.4,
    talos: 11,
  }),
  /** IC-GRAND: the Elven Gardens' heart - a round pool, its kerb and its isle of trees. */
  pool: Object.freeze({ b: 330, r: 4600, r0: 70, kerb: 1.2 }),
  /** IC-GRAND: the Market's heart - its great square, paved, its stalls in rows. */
  market: Object.freeze({ b: 30, r: 4600, half: 90 }),
  causeway: 30,
});

/** THE DISTRICTS ON THEIR SECTORS inside the city wall: each its name and the bearing its sector begins at (60 degrees a
 *  sector, clockwise). */
/** @type {ReadonlyArray<readonly [string, number]>} */
export const IMPERIAL_SECTORS = Object.freeze(
  /** @type {Array<readonly [string, number]>} */ (
    [
      ['Market District', 0],
      ['Arena District', 60],
      ['Arboretum', 120],
      ['Temple District', 180],
      ['Talos Plaza District', 240],
      ['Elven Gardens District', 300],
    ].map((e) => Object.freeze(e))
  ),
);
/** TS5 (the owner: "with the outskirt locations being circular also"): how far from the city's centre pixel, Bay pixels, a
 *  town past the Bay is of its outskirts - laid round (world/townOutline.js ROUND_OUTLINE): the city's own, and as far
 *  again on every side. */
export const IMPERIAL_OUTSKIRTS = 2 * IMPERIAL_SPAN;
/** The landmarks' model ids (world/customModels.js) - TS5: each drawn whole and carried in parts, a part a slice
 *  (IMPERIAL_PARTS). IC-GRAND: the Colosseum's 910205 retired with it (Daggerfall's arena stands in its stead). */
export const IMPERIAL_MODELS = Object.freeze({
  whiteGoldTower: 910200,
  palaceWall: 910201,
  tombs: 910202,
  cityWall: 910203,
  districtWalls: 910204,
  templeOfTheOne: 910206,
  talosStatue: 910207,
  prison: 910208,
  university: 910209,
  waterfront: 910210,
  talosBridge: 910211,
  nineDivines: 910212, // TESA-LORE
  imperialPalace: 910213,
  palaceGardens: 910214, // IC-GRAND: the palace at the tower's foot, Green Emperor Way's gardens
});

// ---------------------------------------------------------------- the geometry

const rad = (d) => (d * Math.PI) / 180;
/** TS5: the land past Lake Rumare's ring - the lake's far shore, no district of the city's (the land's own ground). */
const SHORE = 'Rumare Shore';
/** IC-GRAND: the district inside the palace wall (TESA11's "Green Emperor Way", the name of its ring road now). */
export const PALACE = 'Palace District';
/** A bearing (degrees clockwise from north) and a distance to the metres (x east, z south).
 * @param {number} b @param {number} r @returns {[number, number]} */
export const polar = (b, r) => [r * Math.sin(rad(b)), -r * Math.cos(rad(b))];
/** The bearing of a point, [0, 360). */
export const imperialBearing = (x, z) => {
  const b = (Math.atan2(x, -z) * 180) / Math.PI;
  return b < 0 ? b + 360 : b;
};
/** @param {number} x @param {number} z @param {number[]} c @param {number} h */
const inBox = (x, z, c, h) => Math.abs(x - c[0]) <= h && Math.abs(z - c[1]) <= h;
/** A rectangle's nearest and farthest distances from the middle. */
export function rectRadii(x0, z0, x1, z1) {
  const nx = x0 > 0 ? x0 : x1 < 0 ? x1 : 0,
    nz = z0 > 0 ? z0 : z1 < 0 ? z1 : 0;
  return [Math.hypot(nx, nz), Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)), Math.max(Math.abs(z0), Math.abs(z1)))];
}
/** A point's distance to a segment.
 * @param {number} px @param {number} pz @param {number[]} a @param {number[]} b */
export function pointSeg(px, pz, a, b) {
  const [ax, az] = a,
    [bx, bz] = b,
    dx = bx - ax,
    dz = bz - az,
    l2 = dx * dx + dz * dz,
    t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
/** A segment's distance to a rectangle (0 where it crosses it) - TS5: or, where its box lies `cap` or farther off the
 *  rectangle, that box's distance (no nearer than the segment's; the plan asks most segments from afar).
 * @param {number[]} a @param {number[]} b @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {number} [cap] */
export function segRect(a, b, x0, z0, x1, z1, cap = Infinity) {
  const box = Math.hypot(
    Math.max(0, x0 - Math.max(a[0], b[0]), Math.min(a[0], b[0]) - x1),
    Math.max(0, z0 - Math.max(a[1], b[1]), Math.min(a[1], b[1]) - z1),
  );
  if (box >= cap) return box;
  const inside = (/** @type {number[]} */ p) => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1;
  if (inside(a) || inside(b)) return 0;
  /** @type {number[][][]} */
  const edges = [
    [
      [x0, z0],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
    [
      [x1, z1],
      [x0, z1],
    ],
    [
      [x0, z1],
      [x0, z0],
    ],
  ];
  const cross = (
    /** @type {number[]} */ p,
    /** @type {number[]} */ q,
    /** @type {number[]} */ r,
    /** @type {number[]} */ s,
  ) => {
    const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    if (!d) return false;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d,
      u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  if (edges.some(([r, s]) => cross(a, b, r, s))) return 0;
  return Math.min(
    ...[
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].map(([x, z]) => pointSeg(x, z, a, b)),
    ...edges.flatMap(([r, s]) => [pointSeg(a[0], a[1], r, s), pointSeg(b[0], b[1], r, s)]),
  );
}
/** A rectangle's distance to a point.
 * @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {ReadonlyArray<number>} p */
export const rectPoint = (x0, z0, x1, z1, p) =>
  Math.hypot(Math.max(x0 - p[0], 0, p[0] - x1), Math.max(z0 - p[1], 0, p[1] - z1));
/** Two squares' overlap (the second centred at c, half h).
 * @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {number[]} c @param {number} h */
const rectBox = (x0, z0, x1, z1, c, h) => x1 >= c[0] - h && x0 <= c[0] + h && z1 >= c[1] - h && z0 <= c[1] + h;

/** The district walls' lines: at each sector's edge, from the palace wall to the city wall. */
export const districtWallLines = (I = IMPERIAL) =>
  IMPERIAL_SECTORS.map(([, b]) => [polar(b, I.palaceWall.r), polar(b, I.cityWall.r)]);
/** IC-GRAND: each district wall's gates - their middles, the share `I.districtWall.gates` of the way out along it. */
export const districtWallGates = (I = IMPERIAL) =>
  districtWallLines(I).flatMap(([a, b]) =>
    I.districtWall.gates.map((t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]),
  );
/** IC-GRAND: THE GRAND AVENUES - one a district, along its sector's middle from its palace gate to its city gate. */
export const avenueLines = (I = IMPERIAL) =>
  IMPERIAL_SECTORS.map(([, b]) => [polar(b + 30, I.palaceWall.r), polar(b + 30, I.cityWall.r)]);
/**
 * IC-GRAND: THE CITY'S ROADS - every one a stone way kept clear of buildings: the six avenues and the twelve radials (each
 * `{ kind, b, w }`, a bearing out from the palace wall to the city wall), the three ring roads (`{ kind: 'ring', r, w }`)
 * and Green Emperor Way (`{ kind: 'way', r, w }`, inside the palace wall). The sewers' mains run under them
 * (world/imperialSewers.js).
 */
export const imperialRoads = (I = IMPERIAL) =>
  Object.freeze([
    ...IMPERIAL_SECTORS.map(([, b]) => Object.freeze({ kind: 'avenue', b: b + 30, w: I.avenue.w })),
    ...IMPERIAL_SECTORS.flatMap(([, b]) =>
      I.roads.radials.map((o) => Object.freeze({ kind: 'radial', b: b + o, w: I.roads.radial })),
    ),
    ...I.roads.rings.map((r) => Object.freeze({ kind: 'ring', r, w: I.roads.ring })),
    Object.freeze({ kind: 'way', r: (I.way.r0 + I.way.r1) / 2, w: I.way.r1 - I.way.r0 }),
  ]);
const _roads = new WeakMap();
const roadsOf = (I) => {
  let r = _roads.get(I);
  if (!r) _roads.set(I, (r = imperialRoads(I)));
  return r;
};
/** A point's distance to a road's middle line (the city's metres): a radial's from the palace wall to the city wall, a
 *  ring's round the middle. */
export function roadDistance(x, z, road, I = IMPERIAL) {
  const rr = Math.hypot(x, z);
  if (road.kind === 'ring' || road.kind === 'way') return Math.abs(rr - road.r);
  if (rr < I.palaceWall.r || rr > I.cityWall.r) return Infinity;
  const db = ((((imperialBearing(x, z) - road.b) % 360) + 540) % 360) - 180;
  return Math.abs(db) >= 90 ? Infinity : rr * Math.sin((Math.abs(db) * Math.PI) / 180);
}
/** The roads a rectangle of the plan comes within `pad` metres of (their widths' halves added), or null for none. */
export function imperialRoadsNear(x0, z0, x1, z1, pad = 0, I = IMPERIAL) {
  const [rmin, rmax] = rectRadii(x0, z0, x1, z1),
    out = [];
  const corners = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
      [(x0 + x1) / 2, (z0 + z1) / 2],
    ],
    diag = Math.hypot(x1 - x0, z1 - z0);
  for (const road of roadsOf(I)) {
    const reach = road.w / 2 + pad;
    if (road.kind === 'ring' || road.kind === 'way') {
      if (rmin < road.r + reach && rmax > road.r - reach) out.push(road);
      continue;
    }
    if (rmax < I.palaceWall.r || rmin > I.cityWall.r) continue;
    if (
      Math.min(
        ...corners.map(([x, z]) => {
          const rr = Math.hypot(x, z),
            db = Math.abs(((((imperialBearing(x, z) - road.b) % 360) + 540) % 360) - 180);
          return db >= 90 ? Infinity : rr * Math.sin((db * Math.PI) / 180);
        }),
      ) <
      reach + diag
    )
      out.push(road);
  }
  return out.length ? out : null;
}
/** THE ROAD AT A POINT, its `pad` past its kerb - the first of `roads` (imperialRoadsNear's, or all) whose width holds it -
 *  or null. */
export function imperialRoadAt(x, z, pad = 0, roads = null, I = IMPERIAL) {
  for (const road of roads ?? roadsOf(I)) if (roadDistance(x, z, road, I) < road.w / 2 + pad) return road;
  return null;
}
/** IC-GRAND: each district's heart, on its avenue - the Temple District's the Temple of the One's. */
export const districtHeart = (d, I = IMPERIAL) => {
  const s = IMPERIAL_SECTORS.find(([n]) => n === d);
  if (!s) return null;
  return d === 'Temple District' ? polar(I.temple.b, I.temple.r) : polar(s[1] + 30, I.heart);
};
/** TESA-LORE: the watch towers' feet - where each district wall meets the city wall. */
export const watchTowersAt = (I = IMPERIAL) => IMPERIAL_SECTORS.map(([, b]) => polar(b, I.cityWall.r));
/** TESA-LORE: the Divines' court's middle, and each of the eight's plinth about it (the first on the court's bearing out,
 *  then round) - Talos's at the middle. */
export const divinesAt = (I = IMPERIAL) => polar(I.divines.b, I.divines.r);
export const divinePlinths = (I = IMPERIAL) => {
  const [x, z] = divinesAt(I);
  return Array.from({ length: 8 }, (_, i) => {
    const [dx, dz] = polar(I.divines.b + 22.5 + i * 45, I.divines.ring);
    return /** @type {[number, number]} */ ([x + dx, z + dz]);
  });
};
/** AUDIT TESA II C3: THE COMPOUNDS' GATES (world/capitalImperial.js compound's), each [its side - 0 north, 1 east, 2 south,
 *  3 west - and the distance along it from the run's start: the north's its east end, the east's its south end, the
 *  south's its west end, the west's its north end]: the Prison's in the middle of its south side; the University's two
 *  near its north-west corner on its north and west sides, where the way from the city comes. */
export const prisonGates = (P = IMPERIAL.prison) => [
  [2, P.half],
  [3, P.half],
];
export const universityGates = (U = IMPERIAL.university) => [
  [0, U.half * 1.65],
  [3, U.half * 0.35],
];
/** A square compound's gate about (x, z), `half` from its middle: its [x, z] `out` metres beyond its curtain's line.
 * @param {number[]} c @param {number} half @param {number[]} g @param {number} [out] @returns {number[]} */
export const compoundGateAt = ([x, z], half, [side, along], out = 2) =>
  side === 0
    ? [x + half - along, z - half - out]
    : side === 1
      ? [x + half + out, z + half - along]
      : side === 2
        ? [x - half + along, z + half + out]
        : [x - half - out, z - half + along];
export const prisonGateAt = (I = IMPERIAL) =>
  compoundGateAt(polar(I.prison.b, I.prison.r), I.prison.half, prisonGates(I.prison)[0]);
export const universityGatesAt = (I = IMPERIAL) =>
  universityGates(I.university).map((g) => compoundGateAt(polar(I.university.b, I.university.r), I.university.half, g));
/** IC-GRAND: the Waterfront's gate in the city wall - the Temple District's radial's (the sector's edge, 180, is the South
 *  Watch Tower's). */
export const WATERFRONT_GATE = 195;
/** The stone ways from the city's gates out over the isle: to the Prison, the University and the Waterfront. AUDIT TESA II
 *  C3: each to its compound's gate. IC-GRAND: the Prison's from its own gate (45), the Waterfront's from its gate
 *  (WATERFRONT_GATE) to its quay. */
export const causewayLines = (I = IMPERIAL) => [
  [polar(I.prison.b, I.cityWall.r), prisonGateAt(I)],
  ...universityGatesAt(I).map((g) => [polar(I.university.b, I.cityWall.r), g]),
  [polar(WATERFRONT_GATE, I.cityWall.r), polar(WATERFRONT_GATE, I.waterfront.r1 - 30)],
];
/** Talos Bridge's line: from the west gate over the isle and the lake to its far shore and its landing - AUDIT TESA II C1:
 *  never into the rim; the bridge comes down on the city's own block before it (AUDIT-TESA A6-3: no landmark in the
 *  land's). */
export const bridgeLine = (I = IMPERIAL) => [
  polar(I.bridge.b, I.cityWall.r),
  polar(I.bridge.b, I.lake + I.bridge.landing),
];

/** AUDIT BAY-LEFT F1: the Prison's and the University's centres (polar's own), made once a plan - imperialLand is asked at
 *  every vertex of the city's lake (world/rumareWaters.js rumareSeaGrid). @type {WeakMap<object, number[][]>} */
const _landCompounds = new WeakMap();
const landCompounds = (I) => {
  let c = _landCompounds.get(I);
  if (!c) _landCompounds.set(I, (c = [polar(I.prison.b, I.prison.r), polar(I.university.b, I.university.r)]));
  return c;
};
/** IS A POINT LAND - City Isle: within its shore, the Prison's and the University's grounds, or the Waterfront's quay; TS5:
 *  and the far shore past Lake Rumare's ring, RUMARE-WATER but the Waterfront's mouth through it. */
export function imperialLand(x, z, I = IMPERIAL) {
  const r = Math.hypot(x, z);
  if (r >= I.lake && z > 0 && Math.abs(x) < I.mouth) return false; // RUMARE-WATER: the Waterfront's mouth, through the far shore
  if (r <= I.isle || r >= I.lake) return true;
  const [prison, university] = landCompounds(I);
  if (inBox(x, z, prison, I.prison.half + 24)) return true;
  if (inBox(x, z, university, I.university.half + 24)) return true;
  const b = imperialBearing(x, z);
  return b >= I.waterfront.b0 && b <= I.waterfront.b1 && r <= I.waterfront.r1;
}
/** THE DISTRICT A POINT STANDS IN: the Palace District inside the palace wall (IC-GRAND, the team's spec: "Palace District
 *  (Green Emperor Way)" - the way its ring road), a sector's district inside the city wall,
 *  the Prison's, the University's or the Waterfront's grounds outside it (IC-GRAND: the Waterfront from the city wall to
 *  its quay, its sector's whole), the rest of the isle City Isle, TS5 the land past the lake Rumare Shore (no district of
 *  the city's) - or null (the lake). */
export function imperialDistrictAt(x, z, I = IMPERIAL) {
  const r = Math.hypot(x, z);
  if (r < I.palaceWall.r) return PALACE;
  if (r < I.cityWall.r) {
    const b = imperialBearing(x, z);
    return IMPERIAL_SECTORS[Math.min(5, Math.floor(b / 60))][0];
  }
  if (inBox(x, z, polar(I.prison.b, I.prison.r), I.prison.half + 24)) return 'Prison District';
  if (inBox(x, z, polar(I.university.b, I.university.r), I.university.half + 24)) return 'Arcane University';
  if (!imperialLand(x, z, I)) return null;
  if (r >= I.lake) return SHORE;
  const b = imperialBearing(x, z);
  return b >= I.waterfront.b0 && b <= I.waterfront.b1 ? 'Waterfront District' : 'City Isle';
}
/** TS5: a city's walls' and ways' lines, made once a measures (the plan asks them of every cell). */
const _lines = new WeakMap();
const linesOf = (I) => {
  let l = _lines.get(I);
  if (!l) {
    l = { district: districtWallLines(I), ways: [...causewayLines(I), bridgeLine(I)], avenues: avenueLines(I) };
    _lines.set(I, l);
  }
  return l;
};
/** IC-GRAND: the arena's cell (its row and column of the plan) - the cell under its point, Daggerfall's arena block there. */
export const imperialArenaCell = (I = IMPERIAL) => {
  const [x, z] = polar(I.arena.b, I.arena.r);
  return [Math.floor(z / BLOCK_M + HALF), Math.floor(x / BLOCK_M + HALF)];
};
/** The arena block's cell's middle, the city's metres. */
export const imperialArenaAt = (I = IMPERIAL) => {
  const [r, c] = imperialArenaCell(I);
  return [(c - HALF + 0.5) * BLOCK_M, (r - HALF + 0.5) * BLOCK_M];
};
/**
 * WHERE THE CITY'S OWN STANDS, by a rectangle of the plan (x0, z0)-(x1, z1): Green Emperor Way to its wall; the city wall's
 * band and its towers (TESA-LORE: its watch towers within it); the district walls; the stone ways and Talos Bridge;
 * IC-GRAND: the grand avenues; the Temple of the One, Talos Plaza's statue, the Divines' court (TESA-LORE), the Market's
 * square and the Elven Gardens' pool; the Prison's grounds; the University's wall, its tower and its hall; the
 * Waterfront's quay and piers - each with the margin its towers and its walkers want. A cell any of them touches is no
 * block of Daggerfall's.
 */
export function imperialReserved(x0, z0, x1, z1, I = IMPERIAL) {
  const [rmin, rmax] = rectRadii(x0, z0, x1, z1);
  const pw = I.palaceWall,
    cw = I.cityWall;
  if (rmin < pw.r + pw.thick / 2 + pw.towerR + 2) return true;
  const m = cw.thick / 2 + cw.watchR + 2;
  if (rmin < cw.r + m && rmax > cw.r - m) return true;
  const lines = linesOf(I);
  if (
    lines.district.some(
      ([a, b]) => segRect(a, b, x0, z0, x1, z1, I.districtWall.thick / 2 + 3) < I.districtWall.thick / 2 + 3,
    )
  )
    return true;
  // IC-GRAND: the roads - a radial's segment from the palace wall to the city wall, a ring's annulus
  if (rmax > pw.r && rmin < cw.r)
    for (const road of roadsOf(I)) {
      const reach = road.w / 2 + 4;
      if (road.kind === 'ring') {
        if (rmin < road.r + reach && rmax > road.r - reach) return true;
      } else if (
        road.kind !== 'way' &&
        segRect(polar(road.b, pw.r), polar(road.b, cw.r), x0, z0, x1, z1, reach) < reach
      )
        return true;
    }
  if (rectPoint(x0, z0, x1, z1, divinesAt(I)) < I.divines.court + 4) return true; // TESA-LORE: the Divines' court
  if (
    lines.ways.some(
      ([a, b], i) =>
        segRect(a, b, x0, z0, x1, z1, (i === 3 ? I.bridge.w : I.causeway) / 2 + 4) <
        (i === 3 ? I.bridge.w : I.causeway) / 2 + 4,
    )
  )
    return true;
  const T = I.temple;
  if (rectPoint(x0, z0, x1, z1, polar(T.b, T.r)) < Math.hypot(T.w / 2 + T.towerS, T.l / 2 + T.towerS) + 6) return true;
  if (rectPoint(x0, z0, x1, z1, polar(I.statue.b, I.statue.r)) < I.statue.plaza + 4) return true;
  if (rectPoint(x0, z0, x1, z1, polar(I.pool.b, I.pool.r)) < I.pool.r0 + 8) return true; // IC-GRAND: the Elven Gardens' pool
  if (rectBox(x0, z0, x1, z1, polar(I.market.b, I.market.r), I.market.half)) return true; // IC-GRAND: the Market's square
  if (rectBox(x0, z0, x1, z1, polar(I.prison.b, I.prison.r), I.prison.half + 24)) return true;
  const U = I.university,
    uc = polar(U.b, U.r),
    um = U.tower + 4;
  const inner = U.half - um;
  if (
    rectBox(x0, z0, x1, z1, uc, U.half + um) &&
    !(x0 >= uc[0] - inner && x1 <= uc[0] + inner && z0 >= uc[1] - inner && z1 <= uc[1] + inner)
  )
    return true;
  if (
    rectPoint(x0, z0, x1, z1, universityTowerAt(I)) < U.spireR + 6 ||
    rectPoint(x0, z0, x1, z1, universityHallAt(I)) < U.hall / 2 + 6
  )
    return true;
  const W = I.waterfront,
    b0 = imperialBearing((x0 + x1) / 2, (z0 + z1) / 2);
  if (rmax > W.r1 - 40 && rmin < W.pierTo + 6 && b0 >= W.b0 - 4 && b0 <= W.b1 + 4) return true;
  return false;
}
/** The University's tower (its compound's north-east corner, inside its wall) and its domed hall (the south-west). */
export const universityTowerAt = (I = IMPERIAL) => {
  const [x, z] = polar(I.university.b, I.university.r);
  return [x + I.university.half * 0.55, z - I.university.half * 0.55];
};
export const universityHallAt = (I = IMPERIAL) => {
  const [x, z] = polar(I.university.b, I.university.r);
  return [x - I.university.half * 0.5, z + I.university.half * 0.5];
};
/** The emperors' tombs on their ring: the i-th's middle (the first at 22.5 degrees, then evenly round) - IC-GRAND: each
 *  facing out to Green Emperor Way, two either side of every garden path's end. */
export const tombAt = (i, I = IMPERIAL) => polar(22.5 + i * (360 / I.tombs.n), I.tombs.r);
/** IC-GRAND: a point in a tomb's own frame - [out toward the Way, along the ring clockwise] from its middle. */
export const tombFrame = (x, z, i, I = IMPERIAL) => {
  const b = rad(22.5 + i * (360 / I.tombs.n)),
    [tx, tz] = tombAt(i, I),
    dx = x - tx,
    dz = z - tz;
  return [dx * Math.sin(b) - dz * Math.cos(b), dx * Math.cos(b) + dz * Math.sin(b)];
};
/** IC-GRAND: the tomb nearest a point by its bearing (they stand hundreds of metres apart on their ring). */
export const nearestTomb = (x, z, I = IMPERIAL) =>
  ((Math.round((imperialBearing(x, z) - 22.5) / (360 / I.tombs.n)) % I.tombs.n) + I.tombs.n) % I.tombs.n;
/** IC-GRAND: THE PALACE'S CORNERS - its pavilions' middles, on its wings' outer corners (standing out past them), a
 *  corner between each two wings (the first at half a wing's bearing). */
export const palaceCorners = (I = IMPERIAL) => {
  const P = I.palace,
    n = P.sides,
    rc = P.r1 / Math.cos(Math.PI / n);
  return Array.from({ length: n }, (_, k) => polar(180 / n + (k * 360) / n, rc));
};
/** IC-GRAND: THE PALACE'S PILLAR-TOWERS (the owner's "large pillars") - one on each outer corner, and one either side of
 *  each gate on its wing's middle line, its drum's edge at the gate's. */
export const palacePillars = (I = IMPERIAL) => {
  const P = I.palace,
    rm = (P.r0 + P.r1) / 2,
    off = P.gate / 2 + P.pavilionR;
  return [
    ...palaceCorners(I),
    ...palaceGates().flatMap((g) => {
      const [ux, uz] = polar(g, 1),
        [cx, cz] = polar(g, rm);
      return [1, -1].map((sd) => [cx - uz * off * sd, cz + ux * off * sd]);
    }),
  ];
};
/** IC-GRAND: the palace's gates - the bearings of the wings a palace gate faces (each district's avenue's). */
export const palaceGates = () => IMPERIAL_SECTORS.map(([, b]) => b + 30);
/** IC-GRAND: is a point inside the palace's walls - a wing (but its gate's passage) or a pavilion. */
export function inPalace(x, z, I = IMPERIAL) {
  const P = I.palace,
    r = Math.hypot(x, z);
  if (r < P.r0 - 1 || r > P.r1 / Math.cos(Math.PI / P.sides) + P.pavilionR + 1) return false;
  const step = 360 / P.sides,
    b = imperialBearing(x, z),
    mid = Math.round(b / step) * step,
    d = rad(b - mid);
  const across = r * Math.cos(d),
    along = r * Math.sin(d);
  for (const [cx, cz] of palacePillars(I)) if (Math.hypot(x - cx, z - cz) < P.pavilionR + 0.5) return true;
  if (across < P.r0 - 0.5 || across > P.r1 + 0.5) return false;
  return !(
    palaceGates().some((g) => Math.abs((((mid - g) % 360) + 360) % 360) < 1e-6) && Math.abs(along) < P.gate / 2 - 0.5
  );
}
/** IC-GRAND: the garden paths' bearings - one every `gardens.every` degrees from north. */
export const gardenPaths = (I = IMPERIAL) =>
  Array.from({ length: Math.round(360 / I.gardens.every) }, (_, k) => k * I.gardens.every);
/** IC-GRAND: a point's distance across the nearest garden path's middle line, and that path's bearing - Infinity off
 *  their run (from the palace's terrace to the Way). */
export function gardenPathDistance(x, z, I = IMPERIAL) {
  const r = Math.hypot(x, z),
    G = I.gardens,
    b = imperialBearing(x, z),
    pb = (Math.round(b / G.every) * G.every) % 360;
  if (r < I.palace.r1 || r > I.way.r0) return [Infinity, pb];
  return [Math.abs(r * Math.sin(rad(b - pb))), pb];
}
/** IC-GRAND: THE FOUNTAINS - one where each garden path crosses each ring walk. */
export const palaceFountains = (I = IMPERIAL) => I.gardens.walks.flatMap((w) => gardenPaths(I).map((b) => polar(b, w)));
/** IC-GRAND: THE EMPERORS' STATUES - along every garden path, `statueEvery` apart from the palace's terrace (60 m out) to
 *  short of the Way, `statueOff` out on either side, each `[x, z, fx, fz]` facing the path; none on a fountain's round. */
const statuesFrom = (I = IMPERIAL) => I.palace.r1 + I.palace.terrace + 60;
/** Does a statue stand `r` out along its path (short of the Way, off a fountain's round)? */
const statueStands = (r, I = IMPERIAL) =>
  r < I.way.r0 - 40 && !I.gardens.walks.some((w) => Math.abs(r - w) < I.gardens.fountainR + I.gardens.round + 6);
export function palaceStatues(I = IMPERIAL) {
  const G = I.gardens,
    out = [];
  for (const b of gardenPaths(I)) {
    const [ux, uz] = polar(b, 1),
      nx = -uz,
      nz = ux;
    for (let r = statuesFrom(I); r < I.way.r0 - 40; r += G.statueEvery) {
      if (!statueStands(r, I)) continue;
      for (const side of [1, -1])
        out.push([ux * r + nx * G.statueOff * side, uz * r + nz * G.statueOff * side, -nx * side, -nz * side]);
    }
  }
  return out;
}
/** The prison's Bastion (the compound's middle). */
export const prisonAt = (I = IMPERIAL) => polar(I.prison.b, I.prison.r);
/** AUDIT TESA II C5: THE CITY'S FIXED POINTS, worked once a set of measures. */
const _geo = new WeakMap();
export function imperialGeo(I = IMPERIAL) {
  let g = _geo.get(I);
  if (!g) {
    g = Object.freeze({
      tombs: Array.from({ length: I.tombs.n }, (_, i) => tombAt(i, I)),
      temple: polar(I.temple.b, I.temple.r),
      statue: polar(I.statue.b, I.statue.r),
      pool: polar(I.pool.b, I.pool.r),
      market: polar(I.market.b, I.market.r),
      divines: divinesAt(I),
      plinths: divinePlinths(I),
      prison: prisonAt(I),
      uni: polar(I.university.b, I.university.r),
      uniTower: universityTowerAt(I),
      uniHall: universityHallAt(I),
      ways: [...causewayLines(I), bridgeLine(I)],
      bridge: bridgeLine(I),
      walls: districtWallLines(I),
      avenues: avenueLines(I),
      wallGates: districtWallGates(I),
      arena: imperialArenaAt(I),
      fountains: palaceFountains(I),
      statues: palaceStatues(I), // IC-GRAND: the palace gardens'
    });
    _geo.set(I, g);
  }
  return g;
}

// ---------------------------------------------------------------- the plan

/** A cell's own code and its block's name: `I` and its row and column in base 36 - TS5: two characters each. */
export const imperialCode = (r, c) => `I${r.toString(36).padStart(2, '0')}${c.toString(36).padStart(2, '0')}`;
/** A code's row and column, or null for no own cell's code. */
export const imperialCodeCell = (code) =>
  /^I[0-9a-z]{4}$/.test(code) ? [parseInt(code.slice(1, 3), 36), parseInt(code.slice(3, 5), 36)] : null;
/** IC-GRAND: the arena's cell's code - Daggerfall's arena block (world/arena/arenaCity.js ARENA_BLOCK) stands there. */
export const IMPERIAL_ARENA_CODE = 'ARENA';
const B = BLOCK_M;
/** A cell's square, the city's metres. */
export const imperialCellRect = (r, c) => [(c - HALF) * B, (r - HALF) * B, (c - HALF + 1) * B, (r - HALF + 1) * B];
/** How much of a cell is land: 0 none, 1 some (a shore), 2 all - over a 5 x 5 of its points. */
function landShare(x0, z0, I = IMPERIAL) {
  let n = 0;
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++) if (imperialLand(x0 + (i + 0.5) * (B / 5), z0 + (j + 0.5) * (B / 5), I)) n++;
  return n === 0 ? 0 : n === 25 ? 2 : 1;
}
/** One cell of the plan: 'L' the lake, 'O' (TS5) open ground past it, the arena's (IC-GRAND), or an own block's code. Pure in
 *  its row and column. IC-GRAND: a cell of the lake a landmark crosses - Talos Bridge, the Waterfront's piers - an own
 *  block, so a slice of open lake the bridge runs over has a carrier for its part (and its own laws the deck's footprint
 *  over the water). IC-PROPS (2026-10-27, the owner: "Old daggerfall city layout placements are in imperial city"): no
 *  cell is one of Daggerfall's city blocks any more - 671 of them stood among the city's own (each district's trade along
 *  its avenue, round its heart and scattered: a Daggerfall town's square of houses, garden walls, hedges and props dropped
 *  into the grand plan); every district's trade - its shops, temples, guild halls, banks and libraries - is the fabric's
 *  own buildings now (world/imperialFabricBuildings.js DISTRICT_TRADE), entered as theirs were. Daggerfall's arena alone
 *  stays in its cell: the grand plan names it (IC-GRAND). */
function cellOf(r, c, I = IMPERIAL) {
  if (r < 0 || c < 0 || r >= IMPERIAL_CELLS || c >= IMPERIAL_CELLS) return null;
  const [x0, z0, x1, z1] = imperialCellRect(r, c),
    xm = (x0 + x1) / 2,
    zm = (z0 + z1) / 2;
  const land = landShare(x0, z0, I);
  if (land === 0) return imperialReserved(x0, z0, x1, z1, I) ? imperialCode(r, c) : 'L';
  const d = imperialDistrictAt(xm, zm, I);
  if (land === 2 && d === SHORE) return 'O'; // TS5: the far shore wholly - open ground, the land's own
  const [ar, ac] = imperialArenaCell(I);
  if (r === ar && c === ac) return IMPERIAL_ARENA_CODE;
  return imperialCode(r, c);
}
/** The plan's slices, each its eight rows of eight cells - worked the first time a slice is asked (IC-GRAND). */
const _slices = new Map();
/** A SLICE'S PLAN: its 8 x 8 of the plan's cells, rows north to south. @param {number} s */
export function imperialSlicePlan(s) {
  let p = _slices.get(s);
  if (!p) {
    const sx = s % IMPERIAL_SPAN,
      sy = Math.floor(s / IMPERIAL_SPAN);
    p = Object.freeze(
      Array.from({ length: 8 }, (_, i) =>
        Object.freeze(Array.from({ length: 8 }, (_, j) => cellOf(sy * 8 + i, sx * 8 + j))),
      ),
    );
    _slices.set(s, p);
  }
  return p;
}
/** ONE CELL OF THE PLAN - its slice's, worked with it. @param {number} r @param {number} c */
export function imperialCell(r, c) {
  if (r < 0 || c < 0 || r >= IMPERIAL_CELLS || c >= IMPERIAL_CELLS) return null;
  return imperialSlicePlan(Math.floor(r / 8) * IMPERIAL_SPAN + Math.floor(c / 8))[r % 8][c % 8];
}
/** Is a cell's code one of Daggerfall's blocks' kinds (not the lake, the open ground, the arena or an own block)? */
export const imperialClassic = (cell) =>
  !!cell && cell !== 'L' && cell !== 'O' && cell !== IMPERIAL_ARENA_CODE && !/^I[0-9a-z]{4}$/.test(cell);
/** The district a cell is of (its middle's), or null. */
export const imperialCellDistrict = (r, c) => imperialDistrictAt((c - HALF + 0.5) * B, (r - HALF + 0.5) * B);
/** IC-GRAND: the districts, by cell (x, y) of the plan, as a law - the names its streets answer to (TESA11's lists, a
 *  plan of forty thousand cells answered by its metres). */
export const imperialDistrictOfCell = (x, y) => {
  const d = imperialCellDistrict(y, x);
  return d === SHORE ? null : d;
};

// ---------------------------------------------------------------- the ground's laws (the landmarks')

/** The tile at a point, the landmarks' and the walls' own: the lake's water, the stone of the plaza, of Green Emperor Way,
 *  of the walls' feet, the Divines' court (TESA-LORE), the city's roads (IC-GRAND) and the ways; the Elven Gardens' pool's
 *  water; the grass of the lawns and the isle - or -1 where the city's streets and buildings say (world/imperialFabric.js).
 *  Water 0, sand 1, grass 2, stone 3; TS5 the land past the far shore's sand its own (OPEN_TILE). */
export function imperialTile(x, z, I = IMPERIAL) {
  if (!imperialLand(x, z, I)) return 0;
  const r = Math.hypot(x, z);
  if (r >= I.lake) return r < I.lake + 10 ? 1 : OPEN_TILE; // TS5: the far shore's sand, then the land's own
  if (r < I.plaza || (r >= I.way.r0 && r <= I.way.r1)) return 3;
  if (r < I.palaceWall.r - 6) return palaceGround(x, z, r, I);
  if (Math.abs(r - I.palaceWall.r) <= 10 || Math.abs(r - I.cityWall.r) <= 18) return 3;
  const G = imperialGeo(I); // AUDIT TESA II C5
  if (Math.hypot(x - G.pool[0], z - G.pool[1]) < I.pool.r0) return 0; // IC-GRAND: the Elven Gardens' pool
  if (Math.hypot(x - G.divines[0], z - G.divines[1]) < I.divines.court) return 3; // TESA-LORE: the Divines' court
  if (G.ways.some(([a, b]) => pointSeg(x, z, a, b) <= I.causeway / 2)) return 3;
  if (r < I.cityWall.r && imperialRoadAt(x, z, 0, null, I)) return 3; // IC-GRAND: the roads
  const d = imperialDistrictAt(x, z, I);
  if (d === 'City Isle' || d === 'Prison District') return 2;
  return -1;
}
/** IC-GRAND: THE PALACE DISTRICT'S GROUND inside Green Emperor Way - stone under the palace and its terrace, the garden
 *  paths, the ring walks, the fountains' rounds, the tombs' podiums and their walks out to the Way; grass the rest. */
function palaceGround(x, z, r, I = IMPERIAL) {
  const G = I.gardens;
  if (r < I.palace.r1 / Math.cos(Math.PI / I.palace.sides) + I.palace.pavilionR + I.palace.terrace) return 3;
  if (r > I.way.r1) return 2;
  if (gardenPathDistance(x, z, I)[0] < G.path / 2) return 3;
  for (const w of G.walks) {
    if (Math.abs(r - w) < G.walk / 2) return 3;
    if (Math.abs(r - w) < G.fountainR + G.round)
      for (const b of gardenPaths(I)) {
        const [fx, fz] = polar(b, w);
        if (Math.hypot(x - fx, z - fz) < G.fountainR + G.round) return 3;
      }
  }
  const T = I.tombs;
  if (r > T.r - T.w && r < I.way.r0 + 1) {
    const [f, s] = tombFrame(x, z, nearestTomb(x, z, I), I);
    if (Math.abs(s) < T.w / 2 + T.podium && f > -T.w / 2 - T.podium && f < T.w / 2 + T.podium) return 3; // the podium
    if (Math.abs(s) < T.walk / 2 && f >= 0) return 3; // its walk out to the Way
  }
  return 2;
}
/** The closed ground at a point, the landmarks' (the walkers' navgrid; world/capitalModels.js capitalFootprint closes every
 *  face that stands): the solids' insides - the tower's plinth, the tombs, the Temple, the statue's plinth, the Divines'
 *  plinths (TESA-LORE), the Bastion, the University's tower and hall, IC-GRAND the Elven Gardens' pool. */
export function imperialClosed(x, z, I = IMPERIAL) {
  const r = Math.hypot(x, z);
  if (r < I.tower.plinthR + 1) return true;
  const G = imperialGeo(I); // AUDIT TESA II C5: the points worked once, each ring of them asked only near its own radius
  // IC-GRAND: the nearest tomb's podium, in its own frame (turned to face the Way)
  if (Math.abs(r - I.tombs.r) < I.tombs.w) {
    const [f, s] = tombFrame(x, z, nearestTomb(x, z, I), I);
    if (Math.abs(f) < I.tombs.w / 2 + I.tombs.podium && Math.abs(s) < I.tombs.w / 2 + I.tombs.podium) return true;
  }
  if (r < I.palaceWall.r && palaceClosed(x, z, r, G, I)) return true; // IC-GRAND: the palace, the fountains, the statues
  const T = I.temple,
    [tx, tz] = G.temple;
  if (Math.abs(x - tx) < T.w / 2 + 0.5 && Math.abs(z - tz) < T.l / 2 + 0.5) return true;
  const [sx, sz] = G.statue;
  if (Math.abs(x - sx) < I.statue.plinth / 2 + 0.5 && Math.abs(z - sz) < I.statue.plinth / 2 + 0.5) return true;
  // TESA-LORE: the Divines' plinths, Talos's at the middle
  const D = I.divines,
    [ax, az] = G.divines;
  if (Math.abs(x - ax) < D.talosPlinth / 2 + 1.5 && Math.abs(z - az) < D.talosPlinth / 2 + 1.5) return true;
  if (Math.abs(x - ax) < D.court && Math.abs(z - az) < D.court)
    for (const [px, pz] of G.plinths)
      if (Math.abs(x - px) < D.plinth / 2 + 0.5 && Math.abs(z - pz) < D.plinth / 2 + 0.5) return true;
  if (Math.hypot(x - G.pool[0], z - G.pool[1]) < I.pool.r0) return true; // IC-GRAND: the pool - its water no walker's
  const [px, pz] = G.prison;
  if (Math.hypot(x - px, z - pz) < I.prison.bastionR + 1) return true;
  const [ux, uz] = G.uniTower,
    [hx, hz] = G.uniHall;
  if (
    Math.hypot(x - ux, z - uz) < I.university.spireR + 1 ||
    (Math.abs(x - hx) < I.university.hall / 2 + 0.5 && Math.abs(z - hz) < I.university.hall / 2 + 0.5)
  )
    return true;
  return false;
}
/** IC-GRAND: the Palace District's closed ground - the palace's wings and pavilions, the fountains' basins, the statues'
 *  plinths (each asked only near its own ring or its own row). */
function palaceClosed(x, z, r, G, I = IMPERIAL) {
  if (r < I.palace.r1 / Math.cos(Math.PI / I.palace.sides) + I.palace.pavilionR + 1 && inPalace(x, z, I)) return true;
  const F = I.gardens;
  if (F.walks.some((w) => Math.abs(r - w) < F.fountainR + 1))
    for (const [fx, fz] of G.fountains) if (Math.hypot(x - fx, z - fz) < F.fountainR + 0.5) return true;
  return statueAt(x, z, I);
}
/** IC-GRAND: is a point on an emperor's statue's plinth - in its path's frame, the nearest of its row's (palaceStatues). */
function statueAt(x, z, I = IMPERIAL) {
  const G = I.gardens,
    [dp, pb] = gardenPathDistance(x, z, I),
    lim = STATUE_PLINTH / 2 + 0.5;
  if (Math.abs(dp - G.statueOff) >= lim) return false;
  const along = Math.hypot(x, z) * Math.cos(rad(imperialBearing(x, z) - pb)),
    r0 = statuesFrom(I),
    k = Math.round((along - r0) / G.statueEvery),
    rk = r0 + k * G.statueEvery;
  return k >= 0 && statueStands(rk, I) && Math.abs(along - rk) < lim;
}
/** IC-GRAND: an emperor's statue's plinth, a side, and its height and its figure's (world/capitalImperial.js). */
export const STATUE_PLINTH = 2.8;
/** TS5: a tile record no stamp lays (world/terrain/terrainTiles.js GROUND_RECORD_LIMIT 56 and up) - the land's own. */
export const OPEN_TILE = 63;
/** The climate's own trees (scenery records - world/tamrielCapitals.js's gardens'). */
export const IMPERIAL_TREES = Object.freeze([12, 15, 16, 18]);
/** A tree at a tile's centre, the landmarks' lawns' - or -1: the isle's one in ten; IC-GRAND, the Palace District's
 *  gardens (palaceTree) - grass alone, clear of the tombs and the palace (the city's courts and its park are
 *  world/imperialFabric.js's). */
export function imperialTree(x, z, I = IMPERIAL) {
  if (imperialTile(x, z, I) !== 2) return -1;
  const r = Math.hypot(x, z),
    d = imperialDistrictAt(x, z, I);
  const h = hash32(SALT, Math.floor(x), Math.floor(z), 9),
    pick = IMPERIAL_TREES[(h >>> 3) % IMPERIAL_TREES.length];
  if (d === PALACE) return palaceTree(x, z, r, h, I) ? pick : -1;
  return d === 'City Isle' && h % 10 === 0 ? pick : -1;
}
/** IC-GRAND: THE PALACE GARDENS' TREES - a row either side of every garden path `rowOff` out (a tree every `rowEvery`
 *  along it) and either side of each ring walk; groves in the lawns between (one tile in three where the grove noise
 *  stands); a lone tree one in forty elsewhere - none within a tomb's width of their ring, nor round the palace. */
function palaceTree(x, z, r, h, I = IMPERIAL) {
  const G = I.gardens,
    half = 3.2;
  if (
    r < I.palace.r1 + I.palace.pavilionR * 2 + I.palace.terrace + 20 ||
    r > I.way.r0 - 4 ||
    Math.abs(r - I.tombs.r) < I.tombs.w
  )
    return false;
  const [dp, pb] = gardenPathDistance(x, z, I);
  if (Math.abs(dp - G.rowOff) < half)
    return Math.floor(Math.abs(r * Math.cos(rad(imperialBearing(x, z) - pb))) / G.rowEvery) % 2 === 0;
  for (const w of G.walks)
    if (Math.abs(Math.abs(r - w) - G.rowOff) < half)
      return dp > G.path && Math.floor((imperialBearing(x, z) * rad(1) * w) / G.rowEvery) % 2 === 0;
  if (dp < G.rowOff + half || G.walks.some((w) => Math.abs(r - w) < G.rowOff + half)) return false; // the verges kept open
  const grove = Math.sin(x / 83) * Math.sin(z / 79) + Math.sin((x - z) / 131) * 0.5;
  return grove > 0.7 ? h % 3 === 0 : h % 40 === 0;
}

// ---------------------------------------------------------------- TS5: the slices' names and the landmarks' parts

/** A slice's square of the plan in the city's metres (x east, z south): [x0, z0, x1, z1]. @param {number} s */
export const imperialSliceRect = (s) => {
  const sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN);
  return /** @type {[number, number, number, number]} */ ([
    (sx * 8 - HALF) * B,
    (sy * 8 - HALF) * B,
    ((sx + 1) * 8 - HALF) * B,
    ((sy + 1) * 8 - HALF) * B,
  ]);
};
/** The districts a slice may be named for (a sector's, the Prison's, the University's, the Waterfront's; IC-GRAND: the Palace
 *  District's - never City Isle's), and the least of its cells one must hold. */
const NAMED_DISTRICTS = Object.freeze([
  ...IMPERIAL_SECTORS.map(([d]) => d),
  'Prison District',
  'Arcane University',
  'Waterfront District',
  PALACE,
]);
const NAMED_LEAST = 8;
/** The slices' names, each worked when first asked. */
const _names = new Map();
/**
 * A SLICE'S NAME (its index sy * IMPERIAL_SPAN + sx from the north-west) - the location a pixel stands, its loading
 * screen's and its quests': the centre the city's own name; else the district of NAMED_DISTRICTS that holds the most of
 * its cells (NAMED_LEAST at the least), else City Isle, Lake Rumare or Rumare Shore, whichever holds the most. A district
 * over several slices names each of them. IC-GRAND: worked when first asked (625 slices).
 * @param {number} s
 */
export function imperialSliceName(s) {
  if (_names.has(s)) return _names.get(s);
  const n = IMPERIAL_SPAN,
    centre = (n * n - 1) / 2;
  let name;
  if (s === centre) name = 'Imperial City';
  else {
    const sx = s % n,
      sy = Math.floor(s / n),
      count = new Map();
    for (let r = sy * 8; r < sy * 8 + 8; r++)
      for (let c = sx * 8; c < sx * 8 + 8; c++) {
        const d = imperialDistrictAt((c - HALF + 0.5) * B, (r - HALF + 0.5) * B) ?? 'Lake Rumare';
        count.set(d, (count.get(d) ?? 0) + 1);
      }
    let best = null;
    for (const d of NAMED_DISTRICTS)
      if ((count.get(d) ?? 0) >= NAMED_LEAST && (count.get(d) ?? 0) > (best ? count.get(best) : 0)) best = d;
    if (!best)
      for (const d of ['City Isle', 'Lake Rumare', SHORE])
        if ((count.get(d) ?? 0) > (best ? count.get(best) : 0)) best = d;
    name = best ?? 'Lake Rumare';
  }
  _names.set(s, name);
  return name;
}

/** How far a point is from a rectangle's nearest and farthest (TS5: a ring's test). */
const ringTouches = (x0, z0, x1, z1, r, m) => {
  const [lo, hi] = rectRadii(x0, z0, x1, z1);
  return lo < r + m && hi > r - m;
};
/**
 * TS5: WHERE EACH LANDMARK STANDS - a test of a rectangle of the plan (x0, z0)-(x1, z1), the city's metres, generous by
 * its towers and margins: a slice whose square it touches carries the landmark's part in it (IMPERIAL_PARTS).
 * @type {Readonly<Record<number, (x0: number, z0: number, x1: number, z1: number) => boolean>>}
 */
const EXTENTS = Object.freeze({
  [IMPERIAL_MODELS.whiteGoldTower]: (x0, z0, x1, z1) => rectPoint(x0, z0, x1, z1, [0, 0]) < IMPERIAL.tower.plinthR + 6,
  [IMPERIAL_MODELS.palaceWall]: (x0, z0, x1, z1) =>
    ringTouches(x0, z0, x1, z1, IMPERIAL.palaceWall.r, IMPERIAL.palaceWall.thick + IMPERIAL.palaceWall.towerR * 3 + 6),
  [IMPERIAL_MODELS.tombs]: (x0, z0, x1, z1) =>
    ringTouches(x0, z0, x1, z1, IMPERIAL.tombs.r, IMPERIAL.tombs.w * 1.5 + 6),
  [IMPERIAL_MODELS.cityWall]: (x0, z0, x1, z1) =>
    ringTouches(
      x0,
      z0,
      x1,
      z1,
      IMPERIAL.cityWall.r,
      IMPERIAL.cityWall.thick + Math.max(IMPERIAL.cityWall.towerR, IMPERIAL.cityWall.watchR) * 1.5 + 8,
    ),
  [IMPERIAL_MODELS.districtWalls]: (x0, z0, x1, z1) =>
    districtWallLines().some(
      ([a, b]) => segRect(a, b, x0, z0, x1, z1, IMPERIAL.districtWall.thick + 6) < IMPERIAL.districtWall.thick + 6,
    ),
  [IMPERIAL_MODELS.templeOfTheOne]: (x0, z0, x1, z1) =>
    rectPoint(x0, z0, x1, z1, polar(IMPERIAL.temple.b, IMPERIAL.temple.r)) <
    Math.hypot(IMPERIAL.temple.w, IMPERIAL.temple.l) / 2 + IMPERIAL.temple.towerS + 8,
  [IMPERIAL_MODELS.talosStatue]: (x0, z0, x1, z1) =>
    rectPoint(x0, z0, x1, z1, polar(IMPERIAL.statue.b, IMPERIAL.statue.r)) < IMPERIAL.statue.plaza + 8,
  [IMPERIAL_MODELS.prison]: (x0, z0, x1, z1) =>
    rectBox(x0, z0, x1, z1, prisonAt(), IMPERIAL.prison.half + IMPERIAL.prison.tower + 8),
  [IMPERIAL_MODELS.university]: (x0, z0, x1, z1) =>
    rectBox(
      x0,
      z0,
      x1,
      z1,
      polar(IMPERIAL.university.b, IMPERIAL.university.r),
      IMPERIAL.university.half + IMPERIAL.university.spireR + 8,
    ),
  [IMPERIAL_MODELS.waterfront]: (x0, z0, x1, z1) => {
    const W = IMPERIAL.waterfront;
    for (let i = 0; i <= 16; i++)
      for (let j = 0; j <= 16; j++) {
        const x = x0 + ((x1 - x0) * i) / 16,
          z = z0 + ((z1 - z0) * j) / 16,
          r = Math.hypot(x, z),
          b = imperialBearing(x, z);
        if (r > W.r1 - 12 && r < W.pierTo + 12 && b > W.b0 - 3 && b < W.b1 + 3) return true;
      }
    return false;
  },
  [IMPERIAL_MODELS.talosBridge]: (x0, z0, x1, z1) => {
    const [a, b] = bridgeLine();
    return segRect(a, b, x0, z0, x1, z1, IMPERIAL.bridge.w + 6) < IMPERIAL.bridge.w + 6;
  },
  [IMPERIAL_MODELS.nineDivines]: (x0, z0, x1, z1) =>
    rectPoint(x0, z0, x1, z1, divinesAt()) < IMPERIAL.divines.court + 8,
  // IC-GRAND: the palace round the tower's plaza; the gardens' fountains and statues where they stand
  [IMPERIAL_MODELS.imperialPalace]: (x0, z0, x1, z1) =>
    rectPoint(x0, z0, x1, z1, [0, 0]) <
    IMPERIAL.palace.r1 / Math.cos(Math.PI / IMPERIAL.palace.sides) + IMPERIAL.palace.pavilionR + 6,
  [IMPERIAL_MODELS.palaceGardens]: (x0, z0, x1, z1) =>
    imperialGeo().fountains.some((p) => rectPoint(x0, z0, x1, z1, p) < IMPERIAL.gardens.fountainR + 4) ||
    imperialGeo().statues.some((p) => rectPoint(x0, z0, x1, z1, p) < STATUE_PLINTH + 2),
});
/** A part's model id: the landmark's slot (its id less the first's) and its slice - IC-GRAND: 1,024 a slot (TS5's 64 held
 *  forty-nine slices; a slot holds 625 now). */
export const IMPERIAL_PART_SLOT = 1024;
export const imperialPartId = (base, s) => 920000 + (base - IMPERIAL_MODELS.whiteGoldTower) * IMPERIAL_PART_SLOT + s;
/**
 * TS5: THE LANDMARKS' PARTS - each landmark (IMPERIAL_MODELS) drawn whole, carried in parts: one for each slice whose square
 * it touches (EXTENTS), the part its triangles whose middles stand in the slice (world/capitalModels.js) - so a slice built
 * draws what stands in it whatever the land view's distance.
 */
export const IMPERIAL_PARTS = Object.freeze(
  Object.values(IMPERIAL_MODELS).flatMap((base) =>
    Array.from({ length: IMPERIAL_SPAN ** 2 }, (_, s) => s)
      .filter((s) => EXTENTS[base](...imperialSliceRect(s)))
      .map((s) => Object.freeze({ id: imperialPartId(base, s), base, s })),
  ),
);
/** Each part's slice, by its id (world/tamrielCapitals.js capitalModelCarriers: the first of its slice's own blocks). */
export const IMPERIAL_CARRY = Object.freeze(Object.fromEntries(IMPERIAL_PARTS.map((p) => [p.id, p.s])));
/** IC-GRAND: each slice's parts, by slice. */
export const IMPERIAL_SLICE_PARTS = Object.freeze(
  Array.from({ length: IMPERIAL_SPAN ** 2 }, (_, s) =>
    Object.freeze(IMPERIAL_PARTS.filter((p) => p.s === s).map((p) => p.id)),
  ),
);

// ---------------------------------------------------------------- IC-TOWER-LOD: the tower and the palace drawn coarse

/** The landmarks a far view stands coarse (IC-TOWER-LOD): the tower (7.7k triangles whole) and the palace (15.6k).
 *  @type {ReadonlyArray<number>} */
export const IMPERIAL_LOD_BASES = Object.freeze([IMPERIAL_MODELS.whiteGoldTower, IMPERIAL_MODELS.imperialPalace]);
/** A coarse landmark's part's model id - past the parts' (920,000 to 935,000). */
export const imperialLodPartId = (base, s) => 940000 + (base - IMPERIAL_MODELS.whiteGoldTower) * IMPERIAL_PART_SLOT + s;
/** The coarse parts: each of the tower's and the palace's parts again, coarse (`of` the part it stands for). */
export const IMPERIAL_LOD_PARTS = Object.freeze(
  IMPERIAL_PARTS.filter((p) => IMPERIAL_LOD_BASES.includes(p.base)).map((p) =>
    Object.freeze({ id: imperialLodPartId(p.base, p.s), base: p.base, s: p.s, of: p.id }),
  ),
);
const _farPart = new Map(IMPERIAL_LOD_PARTS.map((p) => [p.of, p.id]));
/** A part as a far view stands it: the coarse one for the tower's and the palace's, else itself. @param {number} id */
export const imperialFarPartId = (id) => _farPart.get(id) ?? id;
/**
 * IC-TOWER-LOD: THE TOWER DRAWN COARSE - its prisms, each `{ n, r0, y0, r1, y1, mat, cap }` (n sides about its axis, from
 * radius r0 at y0 to r1 at y1, marble or gold, its top closed where `cap`): the rotunda, its dome, the shaft in bands of
 * two tiers each ringed by a gilt band, the gallery, the crown and the spire. One list for the far ring's silhouette
 * (world/imperialImpostor.js) and a far view's model (world/capitalImperial.js buildImperialTowerLod), so the stream
 * taking the tower over from the horizon changes nothing of its shape (the owner, 2026-10-26: "Weird pop in issues in
 * the city when moving").
 * @param {any} [T]
 */
export function imperialTowerLod(T = IMPERIAL.tower) {
  const foot = T.plinthH + T.domeH * 0.6,
    rAt = (/** @type {number} */ y) => T.shaftR0 + (T.shaftR1 - T.shaftR0) * ((y - foot) / (T.shaftTop - foot));
  const out = [
    { n: 16, r0: T.plinthR, y0: 0, r1: T.plinthR, y1: T.plinthH, mat: 'marble', cap: true },
    { n: 16, r0: T.plinthR, y0: T.plinthH, r1: T.shaftR0, y1: T.plinthH + T.domeH, mat: 'marble', cap: false },
  ];
  for (let y = foot; y < T.shaftTop - 1; y += 2 * T.tier) {
    const y1 = Math.min(T.shaftTop, y + 2 * T.tier);
    out.push({ n: 12, r0: rAt(y), y0: y, r1: rAt(y1), y1, mat: 'marble', cap: false });
    if (y1 < T.shaftTop)
      out.push({
        n: 12,
        r0: rAt(y1) + T.cornice * 2,
        y0: y1 - 3,
        r1: rAt(y1) + T.cornice * 2,
        y1,
        mat: 'gold',
        cap: false,
      });
  }
  out.push({ n: 12, r0: T.galleryR, y0: T.shaftTop, r1: T.galleryR, y1: T.galleryTop, mat: 'marble', cap: true });
  out.push({ n: 12, r0: T.crownR0, y0: T.galleryTop, r1: T.crownR1, y1: T.crownTop, mat: 'marble', cap: true });
  out.push({ n: 12, r0: T.crownR1 * 0.55, y0: T.crownTop, r1: 0, y1: T.spireTop, mat: 'gold', cap: false });
  return out;
}
/**
 * IC-TOWER-LOD: THE PALACE DRAWN COARSE - its wings as runs `{ a, b, t, h, mat }` (from [x, z] a to b, t thick, h tall:
 * the marble range and its slate roof's band over it) round the ring's middle, and its pillar-towers as prisms (`x`, `z`
 * their axis). One list for the far ring's silhouette and a far view's model, as the tower's.
 * @param {any} [I]
 */
export function imperialPalaceLod(I = IMPERIAL) {
  const PL = I.palace,
    wc = palaceCorners(I).map((_, k) =>
      polar(180 / PL.sides + (k * 360) / PL.sides, (PL.r0 + PL.r1) / 2 / Math.cos(Math.PI / PL.sides)),
    );
  /** @type {Array<{ a: number[], b: number[], t: number, h: number, mat: string }>} */
  const runs = [];
  wc.forEach((a, k) => {
    const b = wc[(k + 1) % wc.length];
    runs.push(
      { a, b, t: PL.r1 - PL.r0, h: PL.h, mat: 'marble' },
      { a, b, t: (PL.r1 - PL.r0) * 0.5, h: PL.h + 6, mat: 'slate' },
    );
  });
  const prisms = palacePillars(I).map(([x, z]) => ({
    x,
    z,
    n: 8,
    r0: PL.pavilionR,
    y0: 0,
    r1: PL.pavilionR,
    y1: PL.pavilionH + 2,
    mat: 'marble',
    cap: true,
  }));
  return { runs, prisms };
}
