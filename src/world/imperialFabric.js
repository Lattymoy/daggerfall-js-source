// @ts-check
// IC-GRAND (2026-10-26, the owner: "Each district needs to be distinct with more varying layouts. Its time we also develop
// proper city-like scapes with parkouring opprotunities"; bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL
// CITY'S STREETS AND BUILDINGS: the fabric of its districts, the port's own, between its landmarks and Daggerfall's blocks.
//
// DFU's reference: a city is its MAPS.BSA row's grid of RMB blocks, each block's buildings and streets its own author's
// (RMBLayout). DEPARTURE (named; Port-Ledger section A, IC-GRAND): the Imperial City's own blocks stand streets and
// buildings no block of Daggerfall's carries - laid by district from the metres about the city's middle, so a street runs
// on across the blocks it crosses and a building stands across a block's edge where its street puts it. Its street-front
// buildings are entered as Daggerfall's are - a record, a door, a Daggerfall interior (world/imperialFabricBuildings.js,
// BLD) - IC-PROPS: every district's trade among them, no block of Daggerfall's beside them but the arena's (world/imperialCity.js
// cellOf), and the Arcane University's halls inside its curtain a neighbourhood of their own (UNIVERSITY_GROUNDS).
//
// EACH DISTRICT ITS OWN STREETS (`IMPERIAL_STYLES`), and each its NEIGHBOURHOODS - five rings out from the palace wall and
// two halves either side of its avenue, the middle ring its heart's alone - each its own frame of streets off its own seed,
// so no two read alike: the Market District a grid of dense arcaded blocks round open squares; the Arena District rings
// and spokes round the arena and round circuses of its own; the Arboretum a park of groves, lawns, paths and ponds with
// villas at its edges; the Temple District long processional blocks on its avenue's axis, plazas on the axis; Talos Plaza
// spokes and rings round its dragon and round each neighbourhood's own circus; the Elven Gardens winding lanes on a
// warped grid with canals and garden courts; the Waterfront warehouses in rows to the quay; IC-PROPS, the Arcane University
// a college's quads inside its curtain, garden courts, its two walks in from its gates.
//
// A BLOCK OF STREETS (a frame's cell between its street lines) is ringed by buildings on its streets with a court inside,
// or, too narrow for a court, filled by a row of buildings through it; a building's height a walk round its block, each
// one at most half a storey off the one beside it - so the roofs run on round every block (THE ROOFTOPS, below).
//
// THE ROOFTOPS ARE A WAY - every number below is the player's movement's own (player/parkour.js, player/motor.js), never
// restated:
//   - a roof beside a roof is at most ROOF_STEP higher: the hands' reach from a jump held in the air at Climbing 0
//     (PARKOUR_REACH_MIN + PARKOUR_AIR_REACH over the jump's own rise, JUMP_SPEED^2 / 2 GRAVITY) - so a jump and a
//     catch take every step at any skill, and a mantle from standing at Climbing 17 and up;
//   - an alley between two blocks is ALLEY wide: under the running leap's shortest flight (PARKOUR_RUNLEAP_DIST_MIN) less
//     a stride's run-up, so it is leapt at Jumping 0;
//   - a street too wide to leap is crossed by a bridge from roof to roof where its two sides stand within a step;
//   - a way up from the street: IC-STAIRS - a stone stair along a street front, walked (each riser under the motor's
//     STEP_OFFSET), from the street to a roof of its block - and down again the same way (blockStair, STAIR);
//   - a ledge along a street front at LEDGE_Y - the lip a wall-run at Climbing 0 reaches - and balconies over it;
//   - every flat roof's parapet a vault's height, and every pitched roof under PARKOUR_TOP_MIN_NY's steepest top.
// The collider is the model's own mesh (scenes/pixelBuild.js files every placed model), so every face drawn is solid.
//
// Pure: a cell's buildings are worked from its row and column and the plan (world/imperialCity.js), the same on every
// client; the cells' layouts are kept a few hundred at a time (an LRU) and worked again on demand.
import { hash32, BLOCK_M } from './spawnedDungeons.js';
import {
  IMPERIAL,
  IMPERIAL_SECTORS,
  IMPERIAL_CELLS,
  polar,
  imperialBearing,
  imperialLand,
  imperialDistrictAt,
  imperialGeo,
  pointSeg,
  segRect,
  rectPoint,
  rectRadii,
  imperialCell,
  districtHeart,
  imperialRoadsNear,
  imperialRoadAt,
  universityTowerAt,
  universityHallAt,
  universityGates,
  compoundGateAt,
} from './imperialCity.js';
import {
  PARKOUR_REACH_MIN,
  PARKOUR_AIR_REACH,
  PARKOUR_RUNLEAP_DIST_MIN,
  PARKOUR_SAFE_DROP,
  PARKOUR_VAULT_MAX,
} from '../player/parkour.js';
import { JUMP_SPEED, GRAVITY, CAPSULE_RADIUS } from '../player/motor.js';

const HALF = IMPERIAL_CELLS / 2,
  B = BLOCK_M;
const SALT = 0x1c12;

// ---------------------------------------------------------------- the movement's numbers

/** A plain jump's rise, metres (AcrobatMotor's jump: JUMP_SPEED under GRAVITY). */
export const JUMP_RISE = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
/** THE STEP: how much higher a roof may stand than the roof beside it - the hands' reach in the air at Climbing 0 over a
 *  jump's rise, less a hand's breadth (2.06 m), rounded down to the city's half storey (1.6 m). */
export const ROOF_STEP = 1.6;
/** A storey, and the facades' bay: a picture's 1.6 by 3.2 m (world/imperialArt.js - vanilla's own 64 x 128 wall at its
 *  40 texels a metre), a window a bay. */
export const STOREY = 3.2;
export const BAY = 1.6;
/** THE ALLEY: a lane between two blocks the running leap's shortest flight clears with a stride to spare. */
export const ALLEY = 3.2;
/** The ledge along a street front, over the street: the lip a wall-run reaches at Climbing 0 (its 1 m rise, the hands'
 *  reach over it) less a hand's breadth. */
export const LEDGE_Y = 2.6;
/** A flat roof's parapet - under a vault's height (PARKOUR_VAULT_MAX), over a knee's. */
export const PARAPET = 0.9;
/**
 * IC-STAIRS (the owner's field report, 2026-10-27, item 4: "Minecraft looking staircases in Imperial city need to be
 * completely redesigned") - A WAY UP'S STAIR, metres: the most a riser rises (`rise`: a step the motor takes without a
 * thought - player/motor.js STEP_OFFSET's 0.5 m less than half - and the proportion of a built stair, 2 R + G within
 * Blondel's 0.60-0.66 m), a tread's going (`tread`), the clear width between the wall and the parapet (`width`), the
 * parapet's thickness (`wall`) and its height over the steps' nosings (`rail`, a flat roof's PARAPET's), the most risers
 * a flight climbs before a landing (`flight`), a landing's length along the wall (`landing`), the head landing's
 * (`head`, the roof's opening and the end wall), how far in from its roof's corner the head stands (`end`), how far a
 * step runs into the wall behind it (`into`: a front a hand off the stair's line still meets it - `tol`), the street a
 * stair stands in at the least (`street`: a lane), the ground it shuts beyond its ends (`margin`: a door's surround
 * clear of it, world/imperialFabricBuildings.js FABRIC_DOOR), and the roof its head steps onto - its building that deep
 * behind the head (`roof`), a pitched roof no steeper there than `pitch` degrees (the styles' own run 26 to 36); a flight's
 * waist under its nosings (`waist`), a landing's pier's side (`pier`), and the street left open under the upper flights
 * where they pass `clear` over it (a door's surround and lintel under it - stairGround). Daggerfall's own stairs (ARCH3D, read through the port's
 * reader) rise 0.2 to 0.425 m a step; the city's are a built stair's, so the motor's step-up climbs them as a walk.
 */
export const STAIR = Object.freeze({
  rise: 0.18,
  tread: 0.3,
  width: 1.4,
  wall: 0.3,
  rail: PARAPET,
  flight: 16,
  landing: 1.2,
  head: 1.8,
  end: 0.6,
  into: 0.25,
  tol: 0.2,
  street: 5,
  margin: 0.9,
  roof: 3,
  pitch: 40,
  waist: 0.5,
  pier: 0.6,
  clear: 3,
});

// ---------------------------------------------------------------- the districts' styles

/**
 * THE DISTRICTS' STYLES: each district's frame of streets (`frame` - 'grid', 'axial', 'polar', 'organic', 'park', 'docks'),
 * its blocks' sides (`P` [lo, hi] metres along, `Q` across - a grid's two), its streets (`streets`: [width, weight] -
 * ALLEY the narrowest), its buildings' depth and frontage (`depth`, `front` [lo, hi] metres), their heights in half storeys
 * (`k` [lo, hi]), their roofs (`gable` the share pitched, `pitch` degrees), their walls' and ground floors' pictures and
 * their roofs' (world/capitalShapes.js CAPITAL_ART's names), its squares (`square`: one block in so many left open), and
 * what its courts are (`court`: 'garden' grass and trees, 'yard' stone).
 */
export const IMPERIAL_STYLES = Object.freeze({
  'Market District': Object.freeze({
    frame: 'grid',
    P: [40, 56],
    Q: [40, 56],
    streets: [
      [7, 5],
      [ALLEY, 3],
      [10, 1],
    ],
    depth: [9, 12],
    front: [5, 8.5],
    k: [4, 8],
    gable: 0.55,
    pitch: 32,
    walls: ['facadeOchre', 'facadeBrick', 'facadeWhite'],
    ground: ['groundArcade', 'groundShop'],
    roof: 'terracotta',
    square: 7,
    court: 'yard',
  }),
  'Arena District': Object.freeze({
    frame: 'polar',
    P: [44, 64],
    Q: [52, 70],
    streets: [
      [7, 4],
      [ALLEY, 2],
      [11, 1],
    ],
    depth: [10, 13],
    front: [6, 10],
    k: [3, 7],
    gable: 0.7,
    pitch: 30,
    walls: ['facadeTimber', 'facadeBrick', 'facadeOchre'],
    ground: ['groundShop', 'groundShop'],
    roof: 'terracotta',
    square: 0,
    court: 'yard',
  }),
  'Arboretum': Object.freeze({
    frame: 'park',
    P: [70, 90],
    Q: [70, 90],
    streets: [[6, 1]],
    depth: [12, 16],
    front: [10, 16],
    k: [3, 5],
    gable: 0.3,
    pitch: 28,
    walls: ['facadeWhite', 'facadeStone'],
    ground: ['groundArcade', 'groundArcade'],
    roof: 'blueSlate',
    square: 0,
    court: 'garden',
  }),
  'Temple District': Object.freeze({
    frame: 'axial',
    P: [76, 104],
    Q: [44, 58],
    streets: [
      [8, 5],
      [ALLEY, 2],
      [12, 2],
    ],
    depth: [11, 14],
    front: [7, 11],
    k: [5, 10],
    gable: 0.4,
    pitch: 34,
    walls: ['facadeStone', 'facadeWhite'],
    ground: ['groundArcade', 'groundArcade'],
    roof: 'roof',
    square: 4,
    court: 'yard',
  }),
  'Talos Plaza District': Object.freeze({
    frame: 'polar',
    P: [48, 62],
    Q: [58, 74],
    streets: [
      [9, 4],
      [ALLEY, 1],
      [13, 2],
    ],
    depth: [11, 13],
    front: [7, 10],
    k: [6, 8],
    gable: 0.25,
    pitch: 30,
    walls: ['facadeStone', 'facadeStone', 'facadeWhite'],
    ground: ['groundShop', 'groundArcade'],
    roof: 'roof',
    square: 0,
    court: 'yard',
  }),
  'Elven Gardens District': Object.freeze({
    frame: 'organic',
    P: [56, 78],
    Q: [56, 78],
    streets: [
      [5, 4],
      [ALLEY, 3],
      [8, 1],
      [10, 1],
    ],
    depth: [9, 12],
    front: [6, 11],
    k: [3, 6],
    gable: 0.5,
    pitch: 36,
    walls: ['facadeWhite', 'facadeStone'],
    ground: ['groundArcade', 'groundShop'],
    roof: 'blueSlate',
    square: 0,
    court: 'garden',
  }),
  'Waterfront District': Object.freeze({
    frame: 'docks',
    P: [64, 84],
    Q: [24, 30],
    streets: [
      [10, 4],
      [ALLEY, 2],
      [8, 2],
      [14, 1],
    ],
    depth: [12, 14],
    front: [12, 20],
    k: [3, 5],
    gable: 0.85,
    pitch: 26,
    walls: ['facadeTimber', 'facadeBrick'],
    ground: ['groundShop', 'groundShop'],
    roof: 'roof',
    square: 0,
    court: 'yard',
  }),
  // IC-PROPS: the University's halls - quads round garden courts on broad walks (UNIVERSITY_GROUNDS)
  'Arcane University': Object.freeze({
    frame: 'grid',
    P: [60, 76],
    Q: [60, 76],
    streets: [
      [10, 3],
      [ALLEY, 1],
      [8, 1],
    ],
    depth: [11, 14],
    front: [8, 13],
    k: [5, 9],
    gable: 0.35,
    pitch: 34,
    walls: ['facadeStone', 'facadeWhite'],
    ground: ['groundArcade', 'groundArcade'],
    roof: 'blueSlate',
    square: 5,
    court: 'garden',
  }),
});

// ---------------------------------------------------------------- the neighbourhoods

/** The rings a district is cut into, metres out (the heart's the middle one), and the heart's ring's index - the city's
 *  ring roads at 3450 and 5750 among their edges (world/imperialCity.js IMPERIAL.roads). Each ring but the heart's in
 *  four, between the radials (every fifteen degrees). */
export const HOOD_RINGS = Object.freeze([2300, 3450, 4050, 5150, 5750, 6900]);
export const HEART_RING = 2;
/** The Waterfront's rings, from the city wall to its quay. */
const DOCK_RINGS = Object.freeze([6900, 7500, 8100]);
const _hoods = new Map();
/** A uniform [0, 1) off a hash's integers. */
const u01 = (...k) => hash32(SALT, ...k) / 4294967296;
/** A number in [lo, hi] off a hash. */
const span = (lo, hi, ...k) => lo + (hi - lo) * u01(...k);
/** A pick among `[value, weight]`s off a hash. */
function weighted(list, ...k) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let t = u01(...k) * total;
  for (const [v, w] of list) {
    if (t < w) return v;
    t -= w;
  }
  return list[list.length - 1][0];
}

/** IC-PROPS: THE UNIVERSITY'S NEIGHBOURHOOD'S index (after the six sectors' and the Waterfront's) - one, its frame square to
 *  its curtain about the compound's middle. */
const UNIVERSITY_HOOD = 7;
/**
 * THE NEIGHBOURHOOD A POINT IS IN (the city's metres), or null - none in Green Emperor Way, on City Isle, in the Prison's
 * grounds, past the lake. Each its district, its ring and half, its style, and its own frame of streets (`frame`): its
 * kind, its origin, its turn, its blocks' sides and its seed - the heart's its landmark's. IC-PROPS: the University's
 * grounds one of their own (UNIVERSITY_HOOD), where Daggerfall's Mages Guild blocks stood till 2026-10-27.
 */
export function hoodAt(x, z) {
  const d = imperialDistrictAt(x, z);
  const style = d ? IMPERIAL_STYLES[d] : null;
  if (!style) return null;
  const r = Math.hypot(x, z),
    b = imperialBearing(x, z);
  let di, ring, half;
  if (d === 'Arcane University') {
    di = UNIVERSITY_HOOD;
    ring = 0;
    half = 0;
  } else if (d === 'Waterfront District') {
    di = 6;
    ring = r < DOCK_RINGS[1] ? 0 : 1;
    half = b < 180 ? 0 : 1;
  } else {
    di = IMPERIAL_SECTORS.findIndex(([n]) => n === d);
    ring = 0;
    while (ring < HOOD_RINGS.length - 2 && r >= HOOD_RINGS[ring + 1]) ring++;
    half = ring === HEART_RING ? 4 : Math.min(3, Math.floor((b - IMPERIAL_SECTORS[di][1]) / 15));
  }
  const key = di * 100 + ring * 10 + half;
  let h = _hoods.get(key);
  if (!h) {
    h = makeHood(key, d, di, ring, half, style);
    _hoods.set(key, h);
  }
  return h;
}

/** A neighbourhood's own frame and its own numbers, off its key. */
function makeHood(key, d, di, ring, half, style) {
  const I = IMPERIAL,
    heart = ring === HEART_RING && di < 6,
    uni = di === UNIVERSITY_HOOD;
  const sector = di < 6 ? IMPERIAL_SECTORS[di][1] : 158;
  const mid = di < 6 ? sector + (heart ? 30 : 7.5 + 15 * half) : half === 0 ? 170 : 190;
  const rings = di < 6 ? HOOD_RINGS : DOCK_RINGS;
  const rMid = (rings[ring] + rings[ring + 1]) / 2;
  // the frame's kind: the district's own; the Arena District's rings and the Talos Plaza's spokes round their heart and round
  // a circus a neighbourhood of theirs stands, its others a grid; the Elven Gardens' warped; the Arboretum's park
  let kind = style.frame;
  // its middle: the heart's landmark; an axial frame's on its avenue (its line through its middle the avenue), others the
  // neighbourhood's own middle
  const centre = uni
    ? polar(I.university.b, I.university.r)
    : heart
      ? districtHeart(d)
      : kind === 'axial'
        ? polar(sector + 30, rMid)
        : polar(mid, rMid);
  if (kind === 'polar' && !heart && u01(key, 1) < (d === 'Arena District' ? 0.5 : 0.35)) kind = 'grid';
  if (kind === 'park' && (ring === 0 || ring === 4)) kind = 'grid'; // the Arboretum's villas, by the palace wall and the city wall
  const radial = (mid * Math.PI) / 180; // the bearing out, as the frame's turn: x east, z south
  const towards = Math.atan2(-Math.cos(radial), Math.sin(radial));
  // IC-PROPS: the University's square to its curtain (its walls run east-west and north-south)
  const turn = uni
    ? 0
    : kind === 'axial'
      ? towards
      : kind === 'docks'
        ? towards
        : towards + [0, 0.26, -0.26, 0.52, 0.79][Math.floor(u01(key, 2) * 5)];
  const scale = span(0.86, 1.14, key, 3);
  const P = [style.P[0] * scale, style.P[1] * scale],
    Q = [style.Q[0] * scale, style.Q[1] * scale];
  const kShift = Math.floor(u01(key, 4) * 3) - 1;
  const k = [Math.max(2, style.k[0] + kShift), Math.max(3, style.k[1] + kShift)];
  // a polar frame's rings start clear of its middle: the arena's cell, Talos's plaza, a circus's own
  const polarR0 =
    d === 'Arena District' && heart
      ? B * 0.75 + 10
      : d === 'Talos Plaza District' && heart
        ? I.statue.plaza + 12
        : span(30, 46, key, 5);
  // a polar heart's spokes: an even count, two of them its avenue (in to the palace gate, out to the city gate)
  const spokes = kind === 'polar' ? 2 * Math.round(span(9, 14, key, 6)) : 0;
  const spoke0 = kind === 'polar' ? (heart ? towards : u01(key, 11) * 0.3) : 0;
  return Object.freeze({
    key,
    district: d,
    ring,
    half,
    heart,
    style,
    kind,
    centre,
    turn,
    P,
    Q,
    k,
    polarR0,
    spokes,
    spoke0,
    warp: kind === 'organic' ? span(9, 16, key, 7) : 0,
    warpL: kind === 'organic' ? span(70, 110, key, 8) : 1,
    gable: Math.min(0.95, Math.max(0.05, style.gable + (u01(key, 9) - 0.5) * 0.3)),
    seed: hash32(SALT, key, 77),
  });
}

// ---------------------------------------------------------------- the frames

/** A frame's coordinates of a point, and a point of its coordinates. Grid-like frames: (u, v) along and across its turn
 *  (the organic one warped on top); polar: (angle, radius) about its centre. */
function toFrame(h, x, z) {
  const dx = x - h.centre[0],
    dz = z - h.centre[1];
  if (h.kind === 'polar') return [Math.atan2(dz, dx), Math.hypot(dx, dz)];
  const c = Math.cos(h.turn),
    s = Math.sin(h.turn);
  return [dx * c + dz * s, -dx * s + dz * c];
}
export function fromFrame(h, u, v) {
  if (h.kind === 'polar') return [h.centre[0] + Math.cos(u) * v, h.centre[1] + Math.sin(u) * v];
  let a = u,
    b = v;
  if (h.kind === 'organic') {
    a = u + h.warp * Math.sin(v / h.warpL + (h.seed & 255));
    b = v + h.warp * Math.sin(u / h.warpL + ((h.seed >>> 8) & 255));
  }
  const c = Math.cos(h.turn),
    s = Math.sin(h.turn);
  return [h.centre[0] + a * c - b * s, h.centre[1] + a * s + b * c];
}
/** A frame's street lines along one axis: the i-th's middle and width - a lattice jittered a fifth of its pitch, each
 *  line's width the style's pick off its hash; a polar frame's spokes evenly turned, its rings out from its middle. */
function lineOf(h, axis, i) {
  const st = h.style;
  if (h.kind === 'polar' && axis === 0) {
    const n = h.spokes,
      a = (i * 2 * Math.PI) / n + h.spoke0;
    // a heart's spokes 0 and n/2 its avenue, the avenue's width
    if (h.heart && (((i % n) + n) % n) % (n / 2) === 0) return { at: a, w: IMPERIAL.avenue.w + 6 };
    return { at: a, w: weighted(st.streets, h.key, 12, i) };
  }
  if (h.kind === 'polar' && axis === 1) {
    if (i < 0) return { at: -1e9, w: 0 };
    const pitch = (h.Q[0] + h.Q[1]) / 2,
      at = h.polarR0 + i * pitch + (i > 0 ? (u01(h.key, 13, i) - 0.5) * pitch * 0.3 : 0);
    return { at, w: i === 0 ? 9 : weighted(st.streets, h.key, 14, i) };
  }
  const R = axis === 0 ? h.P : h.Q,
    pitch = (R[0] + R[1]) / 2;
  // the axial frame's line through its middle is its avenue (the Temple District's processional way): on the axis, its width
  if (h.kind === 'axial' && axis === 1 && i === 0) return { at: 0, w: IMPERIAL.avenue.w + 6 };
  const at = i * pitch + (u01(h.key, 15 + axis, i) - 0.5) * (R[1] - R[0]);
  return { at, w: weighted(st.streets, h.key, 17 + axis, i) };
}
/** The index range of a frame's lines a span of frame coordinates crosses (and one past either side). */
function lineRange(h, axis, lo, hi) {
  if (h.kind === 'polar' && axis === 0) {
    const n = h.spokes,
      step = (2 * Math.PI) / n;
    return [Math.floor(lo / step) - 1, Math.ceil(hi / step) + 1];
  }
  if (h.kind === 'polar' && axis === 1) {
    const pitch = (h.Q[0] + h.Q[1]) / 2;
    return [
      Math.max(0, Math.floor((lo - h.polarR0) / pitch) - 1),
      Math.max(0, Math.ceil((hi - h.polarR0) / pitch) + 1),
    ];
  }
  const R = axis === 0 ? h.P : h.Q,
    pitch = (R[0] + R[1]) / 2;
  return [Math.floor(lo / pitch) - 1, Math.ceil(hi / pitch) + 1];
}

// ---------------------------------------------------------------- what keeps the fabric off

/** The clear widths, metres: past a wall, a road's kerb, a landmark's ground. IC-PROPS: the street kept round each of
 *  Daggerfall's blocks gone with them (world/imperialCity.js cellOf); the University's - past its curtain's inner face
 *  (`uniWall`, its corner towers within it), round its tower and its hall (`uniTower`, `uniHall`: their doors' forecourts)
 *  and either side of its two walks (`uniWalk`). */
export const CLEAR = Object.freeze({
  palace: 20,
  cityWall: 14,
  districtWall: 10,
  road: 3,
  way: 4,
  gate: 24,
  temple: 26,
  statue: 6,
  divines: 14,
  pool: 14,
  market: 4,
  arena: 8,
  bridgeHead: 60,
  quay: 26,
  uniWall: 26,
  uniTower: 14,
  uniHall: 14,
  uniWalk: 6,
});
/**
 * IC-PROPS: THE UNIVERSITY'S GROUNDS the fabric stands on - inside its curtain (CLEAR.uniWall in from it, past its corner
 * towers), off its Arch-Mage's tower and its domed hall (their doors' forecourts), and off its TWO WALKS: from each of its
 * gates (world/imperialCity.js universityGates, where the ways from the city come) straight in across the compound to its
 * far wall, CLEAR.uniWalk either side - so each gate opens on a walk and every street of its quads meets one.
 * `in(x, z)` - a point on its grounds; `kept(x, z)` - a point there the fabric keeps clear.
 */
export function universityGrounds(I = IMPERIAL) {
  const U = I.university,
    [cx, cz] = polar(U.b, U.r),
    C = CLEAR,
    inner = U.half - C.uniWall;
  const [tx, tz] = universityTowerAt(I),
    [hx, hz] = universityHallAt(I),
    hh = U.hall / 2 + C.uniHall;
  // the walks: a north gate's runs south (x fixed), a west gate's east (z fixed) - and so on round
  const walks = universityGates(U).map((gate) => {
    const [gx, gz] = compoundGateAt([cx, cz], U.half, gate);
    return gate[0] % 2 === 0 ? { x: gx } : { z: gz };
  });
  const inside = (x, z) => Math.abs(x - cx) < inner && Math.abs(z - cz) < inner;
  return Object.freeze({
    centre: Object.freeze([cx, cz]),
    inner,
    in: inside,
    kept: (x, z) =>
      Math.hypot(x - tx, z - tz) < U.spireR + C.uniTower ||
      (Math.abs(x - hx) < hh && Math.abs(z - hz) < hh) ||
      walks.some(
        (w) => (w.x !== undefined ? Math.abs(x - w.x) : Math.abs(z - /** @type {number} */ (w.z))) < C.uniWalk,
      ),
  });
}
const _clear = new Map();
/**
 * WHAT KEEPS A CELL'S FABRIC CLEAR - a test of a point (the city's metres) that asks only what stands near the cell
 * (r, c): water, the Palace District, the walls and their feet, the city's roads (its avenues, its radials, its rings -
 * imperialRoadAt), the ways and the bridge's head, the landmarks' grounds, the arena's cell, the Prison's grounds, the
 * Waterfront's quay, City Isle's green (CLEAR) - IC-PROPS: and of the University's grounds its curtain, its tower, its
 * hall and its walks (universityGrounds). Made once a cell (an LRU).
 */
function clearTest(r, c) {
  const key = r * IMPERIAL_CELLS + c;
  let t = _clear.get(key);
  if (t) return t;
  t = makeClearTest(r, c);
  _clear.set(key, t);
  if (_clear.size > FABRIC_CELL_KEEP * 2) _clear.delete(_clear.keys().next().value);
  return t;
}
function makeClearTest(r, c) {
  const I = IMPERIAL,
    g = imperialGeo(),
    C = CLEAR,
    M = 2;
  const x0 = (c - HALF) * B - M,
    z0 = (r - HALF) * B - M,
    x1 = x0 + B + 2 * M,
    z1 = z0 + B + 2 * M;
  const near = (p, d) => rectPoint(x0, z0, x1, z1, p) < d;
  const [rmin, rmax] = rectRadii(x0, z0, x1, z1);
  /** @type {Array<(x: number, z: number, rr: number) => boolean>} */
  const tests = [];
  if (rmin < I.palaceWall.r + C.palace) tests.push((x, z, rr) => rr < I.palaceWall.r + C.palace);
  const cw = I.cityWall.thick / 2 + I.cityWall.towerR + C.cityWall;
  if (rmin < I.cityWall.r + cw && rmax > I.cityWall.r - cw) tests.push((x, z, rr) => Math.abs(rr - I.cityWall.r) < cw);
  if (rmax > I.isle - 40) tests.push((x, z) => !imperialLand(x, z));
  if (rmax > I.cityWall.r) {
    // past the city wall: nothing but the Waterfront's and (IC-PROPS) the University's grounds
    const U = universityGrounds(I),
      uni = rectPoint(x0, z0, x1, z1, U.centre) < U.inner * Math.SQRT2;
    tests.push(
      (x, z, rr) =>
        rr >= I.cityWall.r &&
        !(uni && U.in(x, z)) &&
        (imperialDistrictAt(x, z) !== 'Waterfront District' || rr > I.waterfront.r1 - C.quay),
    );
    if (uni) tests.push((x, z) => U.in(x, z) && U.kept(x, z));
    for (const [a, b] of g.ways)
      if (segRect(a, b, x0, z0, x1, z1, I.causeway / 2 + C.way) < I.causeway / 2 + C.way)
        tests.push((x, z) => pointSeg(x, z, a, b) < I.causeway / 2 + C.way);
  }
  if (rmin < I.cityWall.r) {
    for (const [a, b] of g.walls)
      if (
        segRect(a, b, x0, z0, x1, z1, I.districtWall.thick / 2 + C.districtWall) <
        I.districtWall.thick / 2 + C.districtWall
      )
        tests.push((x, z) => pointSeg(x, z, a, b) < I.districtWall.thick / 2 + C.districtWall);
    const roads = imperialRoadsNear(x0, z0, x1, z1, C.road);
    if (roads) tests.push((x, z) => imperialRoadAt(x, z, C.road, roads) !== null);
  }
  const T = I.temple,
    tw = T.w / 2 + T.towerS + C.temple,
    tl = T.l / 2 + T.towerS + C.temple,
    [tx, tz] = g.temple;
  if (x1 > tx - tw && x0 < tx + tw && z1 > tz - tl && z0 < tz + tl)
    tests.push((x, z) => Math.abs(x - tx) < tw && Math.abs(z - tz) < tl);
  for (const [p, d] of [
    [g.statue, I.statue.plaza + C.statue],
    [g.divines, I.divines.court + C.divines],
    [g.pool, I.pool.r0 + C.pool],
    [g.bridge[0], C.bridgeHead],
  ]) {
    if (near(p, d)) tests.push((x, z) => Math.hypot(x - p[0], z - p[1]) < d);
  }
  for (const p of g.wallGates) if (near(p, C.gate)) tests.push((x, z) => Math.hypot(x - p[0], z - p[1]) < C.gate);
  for (const [p, hw] of [
    [g.market, I.market.half + C.market],
    [g.arena, B / 2 + C.arena],
  ]) {
    if (x1 > p[0] - hw && x0 < p[0] + hw && z1 > p[1] - hw && z0 < p[1] + hw)
      tests.push((x, z) => Math.abs(x - p[0]) < hw && Math.abs(z - p[1]) < hw);
  }
  return (x, z) => {
    const rr = Math.hypot(x, z);
    for (const f of tests) if (f(x, z, rr)) return true;
    return false;
  };
}
/** IS A POINT KEPT CLEAR OF THE FABRIC (the city's metres) - its cell's test (clearTest). */
export function fabricKeptClear(x, z) {
  return clearTest(Math.floor(z / B + HALF), Math.floor(x / B + HALF))(x, z);
}

// ---------------------------------------------------------------- the blocks and their buildings

/** A building (a plot): its four corners (the city's metres: x east, z south) in order round it, which of its edges face a
 *  street (`out`, bit i the edge from corner i to i + 1), its eave's height and its roof ('flat', or 'gable' with its ridge
 *  along its edge 0 - `ridge` its height), its pictures, and its features. */
/** @typedef {{ q: number[][], out: number, h: number, roof: string, ridge: number, wall: string, ground: string, roofTex: string,
 *   ledge: boolean, balcony: number, tower: boolean, key: number, sw: number[], back?: boolean }} Plot */

/** A street line's middle and half-width, either side of a block, as the block's own bounds along an axis. */
function blockBounds(h, axis, i) {
  const a = lineOf(h, axis, i),
    b = lineOf(h, axis, i + 1);
  if (h.kind === 'polar' && axis === 0) {
    return { lo: a.at, hi: b.at, wLo: a.w, wHi: b.w, angular: true };
  }
  return { lo: a.at + a.w / 2, hi: b.at - b.w / 2, wLo: a.w, wHi: b.w, angular: false };
}
const _blocks = new Map();
const BLOCK_KEEP = 4096;
/** A frame block's buildings - worked once, kept (an LRU). */
function blockPlots(h, i, j) {
  const key = `${h.key}:${i}:${j}`;
  let p = _blocks.get(key);
  if (p) {
    _blocks.delete(key);
    _blocks.set(key, p);
    return p;
  }
  p = makeBlock(h, i, j);
  _blocks.set(key, p);
  if (_blocks.size > BLOCK_KEEP) _blocks.delete(_blocks.keys().next().value);
  return p;
}
/** A block's corner point (s, t in [0, 1] across it) in the city's metres. */
function blockPoint(h, U, V, s, t) {
  if (h.kind === 'polar') {
    const r = V.lo + (V.hi - V.lo) * t;
    // the spokes' half-widths at this radius, as angles - the street keeps its width all the way out
    const a0 = U.lo + U.wLo / 2 / Math.max(r, 1),
      a1 = U.hi - U.wHi / 2 / Math.max(r, 1);
    return fromFrame(h, a0 + (a1 - a0) * s, r);
  }
  return fromFrame(h, U.lo + (U.hi - U.lo) * s, V.lo + (V.hi - V.lo) * t);
}
/** A block's lengths along its two axes, metres (a polar one's along at its middle ring). */
function blockLengths(h, U, V) {
  if (h.kind === 'polar') {
    const rm = (V.lo + V.hi) / 2;
    return [Math.max(0, (U.hi - U.lo) * rm - (U.wLo + U.wHi) / 2), V.hi - V.lo];
  }
  return [U.hi - U.lo, V.hi - V.lo];
}
/** Pieces of a length, each in [lo, hi] (the last folded into the one before where short), off a hash. */
function pieces(len, lo, hi, ...k) {
  const out = [];
  let at = 0,
    n = 0;
  while (len - at > lo * 1.5) {
    const w = Math.min(span(lo, hi, ...k, n++), len - at - lo * 0.5);
    out.push([at, at + w]);
    at += w;
  }
  if (len - at > 0.5) {
    if (out.length) out[out.length - 1][1] = len;
    else out.push([0, len]);
  }
  return out;
}

/**
 * A FRAME BLOCK'S BUILDINGS: the block between street lines (i, i + 1) and (j, j + 1) of a neighbourhood's frame - ringed
 * by buildings on its four streets round a court where it is wide enough, else a row through it; or none, a square (the
 * style's one in so many) or the park. Each building's height a walk round the ring in half storeys, at most one off the
 * one before (ROOF_STEP); its roof flat or pitched by the neighbourhood's share; its pictures the style's.
 * @returns {{ plots: Plot[], court: number[][] | null, lawn?: number[][] | null, square: boolean, park: boolean, corners: number[][], yards?: Array<{ a: number[], b: number[] }>, sheds?: number[][], wells?: number[][], deadEnds?: Array<{ a: number[], b: number[] }> }}
 */
function makeBlock(h, i, j) {
  const U = blockBounds(h, 0, i),
    V = blockBounds(h, 1, j);
  const [Ls, Lt] = blockLengths(h, U, V);
  const corners = [
    blockPoint(h, U, V, 0, 0),
    blockPoint(h, U, V, 1, 0),
    blockPoint(h, U, V, 1, 1),
    blockPoint(h, U, V, 0, 1),
  ];
  const st = h.style,
    seed = hash32(h.seed, i, j);
  const empty = { plots: [], court: null, square: false, park: false, corners };
  if (!(Ls > 8 && Lt > 8)) return empty;
  if (h.kind === 'park' && !(u01(seed, 1) < 0.08)) return { ...empty, park: true }; // the Arboretum: a villa in a dozen of its blocks
  if (st.square && seed % st.square === 0) return { ...empty, square: true };
  const D = span(st.depth[0], st.depth[1], seed, 2);
  const P = (s, t) => blockPoint(h, U, V, s / Ls, t / Lt);
  /** @type {Array<{ s0: number, s1: number, t0: number, t1: number, out: number }>} */
  const rects = [];
  const solid = Ls < 2 * D + 6 || Lt < 2 * D + 6;
  if (solid) {
    // a row through the block along its longer side, each building its whole depth: both long sides on a street
    if (Ls >= Lt)
      for (const [a, b] of pieces(Ls, st.front[0], st.front[1], seed, 3))
        rects.push({
          s0: a,
          s1: b,
          t0: 0,
          t1: Lt,
          out: 0b0101 | (a === 0 ? 0b1000 : 0) | (b >= Ls - 1e-6 ? 0b0010 : 0),
        });
    else
      for (const [a, b] of pieces(Lt, st.front[0], st.front[1], seed, 3))
        rects.push({
          s0: 0,
          s1: Ls,
          t0: a,
          t1: b,
          out: 0b1010 | (a === 0 ? 0b0001 : 0) | (b >= Lt - 1e-6 ? 0b0100 : 0),
        });
  } else {
    // the ring: the four corners, then each side's run between them - in order round the block (south, east, north, west);
    // the north and west runs laid from their own corner back (a piece [a, b] of the run stands at Ls - D - b .. Ls - D -
    // a), so each building's neighbour in the order is its neighbour on the ground
    const sides = [
      () => {
        rects.push({ s0: 0, s1: D, t0: 0, t1: D, out: 0b1001 });
        for (const [a, b] of pieces(Ls - 2 * D, st.front[0], st.front[1], seed, 4))
          rects.push({ s0: D + a, s1: D + b, t0: 0, t1: D, out: 0b0001 });
      },
      () => {
        rects.push({ s0: Ls - D, s1: Ls, t0: 0, t1: D, out: 0b0011 });
        for (const [a, b] of pieces(Lt - 2 * D, st.front[0], st.front[1], seed, 5))
          rects.push({ s0: Ls - D, s1: Ls, t0: D + a, t1: D + b, out: 0b0010 });
      },
      () => {
        rects.push({ s0: Ls - D, s1: Ls, t0: Lt - D, t1: Lt, out: 0b0110 });
        for (const [a, b] of pieces(Ls - 2 * D, st.front[0], st.front[1], seed, 6))
          rects.push({ s0: Ls - D - b, s1: Ls - D - a, t0: Lt - D, t1: Lt, out: 0b0100 });
      },
      () => {
        rects.push({ s0: 0, s1: D, t0: Lt - D, t1: Lt, out: 0b1100 });
        for (const [a, b] of pieces(Lt - 2 * D, st.front[0], st.front[1], seed, 7))
          rects.push({ s0: 0, s1: D, t0: Lt - D - b, t1: Lt - D - a, out: 0b1000 });
      },
    ];
    for (const f of sides) f();
  }
  // THE HEIGHT WALK round the ring (or along the row): each at most one half storey off the one before; a tower now and
  // then, two storeys over its neighbours - a climb of its own
  const [k0, k1] = h.k;
  let k = k0 + Math.floor(u01(seed, 8) * (k1 - k0 + 1));
  const ks = rects.map((_, n) => {
    if (n > 0) {
      const step = Math.floor(u01(seed, 9, n) * 3) - 1;
      k = Math.min(k1, Math.max(k0, k + step));
    }
    return k;
  });
  // the ring closes: walk the last ones back toward the first, so the wrap is a step too
  if (!solid)
    for (let n = ks.length - 1; n > 0 && Math.abs(ks[n] - ks[(n + 1) % ks.length]) > 1; n--)
      ks[n] = ks[(n + 1) % ks.length] + Math.sign(ks[n] - ks[(n + 1) % ks.length]);
  // the street each edge of a building faces (its width; 0 an inner edge): edge 0 the block's south line, 1 its east, 2 its
  // north, 3 its west
  const lineW = [V.wLo, U.wHi, V.wHi, U.wLo];
  const plots = rects.map((rc, n) => {
    const q = [P(rc.s0, rc.t0), P(rc.s1, rc.t0), P(rc.s1, rc.t1), P(rc.s0, rc.t1)];
    const pk = hash32(seed, 10, n);
    const tower = !solid && rects.length > 6 && pk % 29 === 0;
    const eave = ks[n] * (STOREY / 2) + (tower ? STOREY * 2 : 0);
    const gable = !tower && u01(pk, 1) < h.gable;
    const across = Math.min(rc.s1 - rc.s0, rc.t1 - rc.t0);
    const ridgeAlongS = rc.s1 - rc.s0 >= rc.t1 - rc.t0;
    const ridge = gable ? eave + (across / 2) * Math.tan((st.pitch * Math.PI) / 180) : eave;
    return /** @type {Plot} */ ({
      q,
      out: rc.out,
      sw: lineW.map((w, e) => (rc.out & (1 << e) ? w : 0)),
      h: eave,
      roof: gable ? (ridgeAlongS ? 'gableS' : 'gableT') : 'flat',
      ridge,
      wall: st.walls[pk % st.walls.length],
      ground: st.ground[(pk >>> 4) % st.ground.length],
      roofTex: tower ? 'roof' : st.roof,
      ledge: (pk >>> 8) % 3 !== 0,
      balcony: (pk >>> 12) % 5 === 0 ? 1 + ((pk >>> 16) % 2) : 0,
      tower,
      key: pk,
    });
  });
  const court = solid ? null : [P(D, D), P(Ls - D, D), P(Ls - D, Lt - D), P(D, Lt - D)];
  // AUDIT IC-BACKYARD L3: THE COURT ON THE GROUND reaches the ring's back walls - each edge (a chord) laid out to the
  // farthest the line its houses' back walls stand on bows past it: a polar block's outer houses stand on an arc, an organic
  // one's on a warped line, and the strip between them and the chord read as street inside the ring (a grid's: the court)
  const lawn =
    court &&
    courtGround(court, [
      (f) => P(D + (Ls - 2 * D) * f, D),
      (f) => P(Ls - D, D + (Lt - 2 * D) * f),
      (f) => P(Ls - D - (Ls - 2 * D) * f, Lt - D),
      (f) => P(D, Lt - D - (Lt - 2 * D) * f),
    ]);
  // IC-GRAND (the coordinator's review of the renders: "Courtyards should be courtyard-sized (yards, gardens, sheds, wells,
  // trees)"): A WIDE COURT BUILT IN - a court BACK.min or more across both ways stands a back range in its middle (the house
  // behind the house, a workshop, a coach house), BACK.gap in from the ring all round - the yards round it - split across
  // its longer way into pieces near BACK.len long, BACK.lane apart; a storey or two under the ring's lowest, its own roof
  const cw = Ls - 2 * D,
    ct = Lt - 2 * D;
  /** @type {number[][]} the back range's rectangles, [s0, s1, t0, t1] */
  const backs = [];
  if (court && Math.min(cw, ct) >= BACK.min) {
    const s0 = D + BACK.gap,
      s1 = Ls - D - BACK.gap,
      t0 = D + BACK.gap,
      t1 = Lt - D - BACK.gap,
      alongS = s1 - s0 >= t1 - t0;
    const len = alongS ? s1 - s0 : t1 - t0,
      n = Math.max(1, Math.round(len / BACK.len)),
      piece = (len - (n - 1) * BACK.lane) / n;
    for (let k = 0; k < n; k++) {
      const a = (alongS ? s0 : t0) + k * (piece + BACK.lane),
        b = a + piece;
      backs.push(alongS ? [a, b, t0, t1] : [s0, s1, a, b]);
    }
  }
  const low = Math.max(h.k[0] - 1, 2, Math.min(...ks) - 2);
  backs.forEach(([s0, s1, t0, t1], n) => {
    const q = [P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)],
      pk = hash32(seed, 26, n),
      eave = low * (STOREY / 2);
    const gable = u01(pk, 1) < Math.max(0.5, h.gable),
      ridgeAlongS = s1 - s0 >= t1 - t0,
      across = Math.min(s1 - s0, t1 - t0);
    plots.push(
      /** @type {Plot} */ ({
        q,
        out: 0,
        sw: [0, 0, 0, 0],
        h: eave,
        roof: gable ? (ridgeAlongS ? 'gableS' : 'gableT') : 'flat',
        ridge: gable ? eave + (across / 2) * Math.tan((st.pitch * Math.PI) / 180) : eave,
        wall: st.walls[pk % st.walls.length],
        ground: st.ground[0],
        roofTex: st.roof,
        ledge: false,
        balcony: 0,
        tower: false,
        key: pk,
        back: true,
      }),
    );
  });
  // THE YARDS: a court parted into backyards by garden walls (YARD_WALL high - a jump and a catch from the ground, FABRIC_LAWS.stepReach; a walk along the
  // top): one wall across a narrow court, a cross of them in a wide one; a shed in one yard in three. IC-GRAND: round a back
  // range, the cross from the ring to its faces; a well in one court in two, in the corner across from the shed's
  /** @type {Array<{ a: number[], b: number[] }>} */
  const yards = [];
  if (court && backs.length) {
    const [bs0, , bt0] = backs[0],
      bs1 = backs[backs.length - 1][1],
      bt1 = backs[backs.length - 1][3];
    yards.push(
      { a: P(Ls / 2, D), b: P(Ls / 2, bt0) },
      { a: P(Ls / 2, bt1), b: P(Ls / 2, Lt - D) },
      { a: P(D, Lt / 2), b: P(bs0, Lt / 2) },
      { a: P(bs1, Lt / 2), b: P(Ls - D, Lt / 2) },
    );
  } else if (court) {
    if (cw > 14) yards.push({ a: P(Ls / 2, D), b: P(Ls / 2, Lt - D) });
    if (ct > 14 && (cw <= 14 || u01(seed, 21) < 0.6)) yards.push({ a: P(D, Lt / 2), b: P(Ls - D, Lt / 2) });
  }
  const sheds = court && u01(seed, 22) < 0.34 ? [P(D + 3.5, D + 3.5)] : [];
  const wells = court && cw > 9 && ct > 9 && u01(seed, 24) < 0.5 ? [P(Ls - D - 3, Lt - D - 3)] : [];
  // DEAD ENDS: an alley closed at one of its ends by a wall across it from a corner of the block (one alley end in three)
  /** @type {Array<{ a: number[], b: number[] }>} */
  const deadEnds = [];
  const cornerAt = [
    [0, 0],
    [Ls, 0],
    [Ls, Lt],
    [0, Lt],
  ];
  for (let e = 0; e < 4; e++) {
    if (lineW[e] > ALLEY + 0.01 || hash32(seed, 23, e) % 3 !== 0) continue;
    // the alley along edge e, closed at the block's corner e: a wall from the corner out across the alley
    const [cs, ct2] = cornerAt[e],
      out = lineW[e] + 0.6;
    const dir = e === 0 ? [0, -1] : e === 1 ? [1, 0] : e === 2 ? [0, 1] : [-1, 0];
    deadEnds.push({ a: P(cs, ct2), b: P(cs + dir[0] * out, ct2 + dir[1] * out) });
  }
  return { plots, court, lawn, square: false, park: false, corners, yards, sheds, wells, deadEnds };
}
/** AUDIT IC-BACKYARD L3: a court laid out to its ring - `court` its chords, `side[e](f)` the line its back walls stand on
 *  along edge e (f 0 to 1): each edge moved out by the most that line bows past it, the corners where the moved edges
 *  meet; the court itself where none bows (a grid's). */
function courtGround(court, side) {
  const m = centroid(court),
    lines = [];
  let moved = false;
  for (let e = 0; e < 4; e++) {
    const a = court[e],
      b = court[(e + 1) & 3],
      d = [b[0] - a[0], b[1] - a[1]],
      l = Math.hypot(d[0], d[1]) || 1;
    let n = [d[1] / l, -d[0] / l];
    if (n[0] * ((a[0] + b[0]) / 2 - m[0]) + n[1] * ((a[1] + b[1]) / 2 - m[1]) < 0) n = [-n[0], -n[1]];
    let out = 0;
    for (let k = 1; k < 16; k++) {
      const p = side[e](k / 16);
      out = Math.max(out, (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]);
    }
    if (out > 1e-6) moved = true;
    lines.push({ p: [a[0] + n[0] * out, a[1] + n[1] * out], d });
  }
  if (!moved) return court;
  return lines.map((L1, e) => {
    const L0 = lines[(e + 3) & 3],
      det = L0.d[0] * L1.d[1] - L0.d[1] * L1.d[0];
    const k = ((L1.p[0] - L0.p[0]) * L1.d[1] - (L1.p[1] - L0.p[1]) * L1.d[0]) / det;
    return [L0.p[0] + L0.d[0] * k, L0.p[1] + L0.d[1] * k];
  });
}
/** A garden wall's height (a vault's), its thickness; a backyard shed's height and side. */
export const YARD_WALL = Object.freeze({ h: 1.8, t: 0.4 });
export const SHED = Object.freeze({ h: 2.4, w: 4 });
/** IC-GRAND: a court's back range - the least a court is across both ways before one stands in it, how far in from the ring
 *  it stands (its yards), a piece's length, the lane between two. */
export const BACK = Object.freeze({ min: 30, gap: 9, len: 24, lane: 5 });
/** IC-GRAND: a yard's well - its kerb's radius and height, its posts' and its little roof's height; AUDIT IC-BACKYARD P5:
 *  its roof's eaves past the kerb (along x) and its half-depth either side of the ridge (along z). */
export const WELL = Object.freeze({ r: 0.9, h: 0.9, roofH: 2.8, eave: 0.5, ridge: 0.9 });
/** IC-GRAND: a square's fountain - its basin's radius and its column's height. */
export const SQUARE_FOUNTAIN = Object.freeze({ r: 3.2, h: 3.6 });
/** A street's kinds by its width: an alley, a lane, a side street, a main street (its pavements). */
export const streetKind = (w) => (w <= ALLEY + 0.01 ? 'alley' : w < 7 ? 'lane' : w < 10 ? 'side' : 'main');
/** A main street's pavement: its width out from the fronts, its kerb's height (a step: under motor.js STEP_OFFSET). */
export const PAVEMENT = Object.freeze({ w: 2.2, h: 0.15 });

// ---------------------------------------------------------------- a cell's layout

/** @typedef {{ r: number, c: number, plots: Plot[], near: Plot[], courts: number[][][], squares: number[][][], parks: number[][][],
 *   canals: number[][][], yards: any[], sheds: number[][], wells: number[][], fountains: number[][], deadEnds: any[], bridges: any[], stairs: Stair[], statues: number[][],
 *   ground: { yards: any[], deadEnds: any[], sheds: number[][], wells: number[][], fountains: number[][], statues: number[][], stairs: Stair[] },
 *   nearStairs: Stair[], grid: Map<number, Plot[]>, hoods: any[] }} CellLayout */
const _cells = new Map();
/** How many cells' layouts are kept. */
export const FABRIC_CELL_KEEP = 512;
/** The point-in-quad test (a convex quad, either winding). */
export function inQuad(q, x, z) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) & 3],
      cr = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (cr !== 0) {
      const sg = cr > 0 ? 1 : -1;
      if (sign && sg !== sign) return false;
      sign = sg;
    }
  }
  return true;
}
export const centroid = (q) => [
  (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
  (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
];
const BUCKET = 8;
const bucketKey = (bx, bz) => (bx + 4096) * 8192 + (bz + 4096);

/**
 * A CELL'S LAYOUT (row r, column c of the plan): the buildings whose middles stand in it (`plots` - the cell's model
 * builds them), and those near it whose walls reach into it (`near` - its ground and its walkers' grid read them); the
 * courts, yards, squares, park ground and canals of the blocks over it; the ways up, the bridges, the garden walls, the
 * dead ends and the park's statues whose middles stand in it - each building kept off what keeps the fabric clear
 * (clearTest, at its corners and its middle) and owned by the neighbourhood its middle stands in. Kept (an LRU).
 * @returns {CellLayout}
 */
export function fabricCell(r, c) {
  const L = baseCell(r, c);
  layWays(L);
  return L;
}
/** IC-STAIRS: a cell's layout but its ways up and bridges (makeCell's) - what a way up reads of the cells round it (a door's
 *  ground, what stands in its footprint), so laying one asks no layout whole. Kept with the whole ones (the same object). */
function baseCell(r, c) {
  const key = r * IMPERIAL_CELLS + c;
  let L = _cells.get(key);
  if (L) {
    _cells.delete(key);
    _cells.set(key, L);
    return L;
  }
  L = makeCell(r, c);
  _cells.set(key, L);
  if (_cells.size > FABRIC_CELL_KEEP) _cells.delete(_cells.keys().next().value);
  return L;
}
/** IC-STAIRS: each layout's blocks still to lay their ways up and bridges in it (layWays), until it is asked for whole. */
const _ways = new WeakMap();
/**
 * IC-STAIRS - A CELL'S WAYS UP AND BRIDGES, laid when its layout is first asked for whole: each near block's stair
 * (blockStair - the block's own, the same whichever cell asks) in nearStairs (the plots' cells open a head's parapet over it
 * and keep a front's ledge and balconies off it), its ground shut where it reaches the cell's buildings' reach (MARGIN: a
 * door's bay before a front past the cell's edge is asked of the building's cell), drawn by the cell its own middle
 * stands in (FOUND AT THE SWEEP: its block's middle, a polar frame's far ring's block hundreds of metres long, stood cells
 * away from it); the bridges of the blocks whose middles stand in the cell.
 * @param {CellLayout} L
 */
function layWays(L) {
  const blocks = _ways.get(L);
  if (!blocks) return;
  _ways.delete(L);
  const x0 = (L.c - HALF) * B,
    z0 = (L.r - HALF) * B,
    x1 = x0 + B,
    z1 = z0 + B;
  for (const [h, i, j, blk, mine] of blocks) {
    const stair = boxNear(blk.corners, x0 - 6, z0 - 6, x1 + 6, z1 + 6) ? blockStair(h, i, j, blk) : null;
    if (stair) {
      L.nearStairs.push(stair);
      if (
        stair.box[0] < x1 + MARGIN &&
        stair.box[2] > x0 - MARGIN &&
        stair.box[1] < z1 + MARGIN &&
        stair.box[3] > z0 - MARGIN
      )
        L.ground.stairs.push(stair);
      const m = stairMiddle(stair);
      if (m[0] >= x0 && m[0] < x1 && m[1] >= z0 && m[1] < z1) L.stairs.push(stair);
    }
    if (mine) waysOf(h, i, j, blk, L);
  }
}
/** The frame blocks of a neighbourhood a rectangle of the city's metres touches. */
function blocksOver(h, x0, z0, x1, z1) {
  const pts = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
    [(x0 + x1) / 2, (z0 + z1) / 2],
  ].map(([x, z]) => toFrame(h, x, z));
  const out = [];
  if (h.kind === 'polar') {
    // unwrap the angles about the middle point's; a rectangle over the frame's middle sees every spoke
    const am = pts[4][0],
      as = pts.map(([a]) => am + Math.atan2(Math.sin(a - am), Math.cos(a - am)));
    const rs = pts.map(([, rr]) => rr),
      inside = Math.hypot(h.centre[0] - (x0 + x1) / 2, h.centre[1] - (z0 + z1) / 2) < Math.hypot(x1 - x0, z1 - z0);
    const [i0, i1] = inside ? [0, h.spokes] : lineRange(h, 0, Math.min(...as) - h.spoke0, Math.max(...as) - h.spoke0);
    const [j0, j1] = lineRange(h, 1, inside ? 0 : Math.min(...rs), Math.max(...rs));
    const seen = new Set();
    for (let i = i0; i < i1; i++)
      for (let j = j0; j < j1; j++) {
        const ii = ((i % h.spokes) + h.spokes) % h.spokes;
        if (!seen.has(ii * 4096 + j)) {
          seen.add(ii * 4096 + j);
          out.push([ii, j]);
        }
      }
    return out;
  }
  const W = h.warp ? h.warp + 2 : 0;
  const [i0, i1] = lineRange(h, 0, Math.min(...pts.map((p) => p[0])) - W, Math.max(...pts.map((p) => p[0])) + W);
  const [j0, j1] = lineRange(h, 1, Math.min(...pts.map((p) => p[1])) - W, Math.max(...pts.map((p) => p[1])) + W);
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) out.push([i, j]);
  return out;
}
/** Is a building kept: its corners and its middle clear (fabricKeptClear) and in its own neighbourhood - a memo on it. */
function keptPlot(h, p) {
  const P = /** @type {any} */ (p);
  if (P._kept === undefined) {
    let ok = true;
    for (const v of [...p.q, centroid(p.q)])
      if (fabricKeptClear(v[0], v[1]) || hoodAt(v[0], v[1])?.key !== h.key) {
        ok = false;
        break;
      }
    Object.defineProperty(P, '_kept', { value: ok, enumerable: false });
  }
  return P._kept;
}
/** Is a piece of the fabric (a court, a wall, a statue) clear - its points all clear and its neighbourhood's. */
const clearPts = (h, pts) => pts.every((v) => !fabricKeptClear(v[0], v[1]) && hoodAt(v[0], v[1])?.key === h.key);
const MARGIN = 24;
/** Does a quad's box meet a rectangle. */
const boxNear = (q, x0, z0, x1, z1) =>
  Math.min(...q.map((v) => v[0])) < x1 &&
  Math.max(...q.map((v) => v[0])) > x0 &&
  Math.min(...q.map((v) => v[1])) < z1 &&
  Math.max(...q.map((v) => v[1])) > z0;
function makeCell(r, c) {
  const x0 = (c - HALF) * B,
    z0 = (r - HALF) * B,
    x1 = x0 + B,
    z1 = z0 + B;
  /** @type {CellLayout} */
  const L = {
    r,
    c,
    plots: [],
    near: [],
    courts: [],
    squares: [],
    parks: [],
    canals: [],
    yards: [],
    sheds: [],
    wells: [],
    fountains: [],
    deadEnds: [],
    bridges: [],
    stairs: [],
    statues: [],
    grid: new Map(),
    hoods: [],
    ground: { yards: [], deadEnds: [], sheds: [], wells: [], fountains: [], statues: [], stairs: [] },
    nearStairs: [],
  };
  const cell = imperialCell(r, c);
  if (!cell || !/^I[0-9a-z]{4}$/.test(cell)) return L; // the lake, the open shore, the arena, Daggerfall's blocks: none
  const hoods = new Map();
  for (let i = 0; i <= 4; i++)
    for (let j = 0; j <= 4; j++) {
      const h = hoodAt(x0 - MARGIN + ((B + 2 * MARGIN) * i) / 4, z0 - MARGIN + ((B + 2 * MARGIN) * j) / 4);
      if (h) hoods.set(h.key, h);
    }
  L.hoods = [...hoods.values()];
  const inCell = (p) => p[0] >= x0 && p[0] < x1 && p[1] >= z0 && p[1] < z1;
  const nearCell = (q) =>
    q.some((p) => p[0] >= x0 - 2 && p[0] <= x1 + 2 && p[1] >= z0 - 2 && p[1] <= z1 + 2) ||
    inQuad(q, (x0 + x1) / 2, (z0 + z1) / 2);
  // IC-STAIRS, FOUND AT THE SWEEP (tools/icStairsSweep.mjs): a building is near the cell where its box meets the cell's, 2 m
  // out - it had been near by nearCell's corners, so a building across a cell's corner with no corner of its own near the
  // cell was no building of that cell's ground (fabricPlotAt and the walkers' ground read the street inside it)
  const nearPlot = (q) => boxNear(q, x0 - 2, z0 - 2, x1 + 2, z1 + 2);
  /** @type {any[]} */
  const ways = [];
  for (const h of hoods.values()) {
    for (const [i, j] of blocksOver(h, x0 - MARGIN, z0 - MARGIN, x1 + MARGIN, z1 + MARGIN)) {
      const blk = blockPlots(h, i, j);
      for (const p of blk.plots) {
        if (!nearPlot(p.q) || !keptPlot(h, p)) continue;
        L.near.push(p);
        if (inCell(centroid(p.q))) L.plots.push(p);
      }
      const mine = inCell(centroid(blk.corners));
      // IC-STAIRS, FOUND AT THE SWEEP: a court, a square or the park its own neighbourhood's (its middle in it) - a polar
      // frame's far rings lay blocks hundreds of metres long past their own neighbourhood, whose courts lay `court` over
      // another's streets (no door, no walker there)
      const own = (q) => hoodAt(...centroid(q))?.key === h.key;
      if (blk.court && nearCell(blk.lawn) && own(blk.court)) L.courts.push(blk.lawn); // AUDIT IC-BACKYARD L3: laid out to its ring
      if (blk.square && nearCell(blk.corners) && own(blk.corners)) {
        L.squares.push(blk.corners);
        // IC-GRAND (the review: "large empty lots ... made squares with something in them"): a fountain at its middle
        const m = centroid(blk.corners),
          f = SQUARE_FOUNTAIN.r + 2;
        if (clearPts(h, [m, [m[0] + f, m[1]], [m[0] - f, m[1]], [m[0], m[1] + f], [m[0], m[1] - f]])) {
          L.ground.fountains.push(m);
          if (mine) L.fountains.push(m);
        }
      }
      if (blk.park && nearCell(blk.corners) && own(blk.corners)) {
        L.parks.push(blk.corners);
        const st = parkStatueOf(h, i, j, blk);
        if (st) {
          L.ground.statues.push(st);
          if (mine) L.statues.push(st);
        }
      }
      if (h.kind === 'organic' && nearCell(blk.corners)) canalOf(h, i, j, blk, L);
      // IC-STAIRS: the block's way up and its bridges laid when the cell is asked for whole (layWays)
      if (blk.plots.length) ways.push([h, i, j, blk, mine]);
      // IC-GRAND: a near block's garden walls, dead ends, sheds and wells close the cell's ground where they stand in it
      // (the ground's own list); the block whose middle stands in the cell draws them (a piece across a cell's edge closed
      // on both sides, drawn once)
      // AUDIT IC-BACKYARD L2: and a piece of any block near it whose ground reaches the cell - a long block (a polar far
      // ring's, an oblique one) lays its court in a cell its corners are far from, which read `court` in its sheds and walls
      const whole = mine || nearCell(blk.corners),
        reaches = (a, b, pad) => whole || segRect(a, b, x0, z0, x1, z1) <= pad;
      const G = L.ground;
      for (const y of blk.yards ?? [])
        if (reaches(y.a, y.b, YARD_WALL.t / 2 + 0.3) && clearPts(h, [y.a, y.b])) {
          G.yards.push(y);
          if (mine) L.yards.push(y);
        }
      for (const s of blk.sheds ?? [])
        if (reaches(s, s, (SHED.w / 2 + 0.2) * Math.SQRT2) && clearPts(h, [s])) {
          G.sheds.push(s);
          if (mine) L.sheds.push(s);
        }
      for (const w of blk.wells ?? [])
        if (reaches(w, w, Math.hypot(WELL.r + WELL.eave, WELL.ridge) + 0.3) && clearPts(h, [w])) {
          G.wells.push(w);
          if (mine) L.wells.push(w);
        }
      for (const d of blk.deadEnds ?? [])
        if (reaches(d.a, d.b, 0.6) && clearPts(h, [d.a, d.b])) {
          G.deadEnds.push(d);
          if (mine) L.deadEnds.push(d);
        }
    }
  }
  _ways.set(L, ways);
  // the buckets: every building near the cell under each 8 m square it covers
  for (const p of L.near) {
    const xs = p.q.map((v) => v[0]),
      zs = p.q.map((v) => v[1]);
    for (let bx = Math.floor(Math.min(...xs) / BUCKET); bx <= Math.floor(Math.max(...xs) / BUCKET); bx++)
      for (let bz = Math.floor(Math.min(...zs) / BUCKET); bz <= Math.floor(Math.max(...zs) / BUCKET); bz++) {
        const k = bucketKey(bx, bz);
        let list = L.grid.get(k);
        if (!list) L.grid.set(k, (list = []));
        list.push(p);
      }
  }
  return L;
}
/** THE ELVEN GARDENS' CANALS: a block's south street, one line in three, is water - its banks the blocks' fronts. */
const canalLine = (h, j) => h.kind === 'organic' && hash32(h.seed, 31, j) % 3 === 0 && lineOf(h, 1, j).w > ALLEY + 0.01; // an alley is no canal
function canalOf(h, i, j, blk, L) {
  const q = canalQuad(h, j, blk);
  if (q) L.canals.push(q);
}
/** A block's canal on its south street, or null. */
function canalQuad(h, j, blk) {
  if (!canalLine(h, j)) return null;
  const [a, b] = [blk.corners[0], blk.corners[1]],
    w = lineOf(h, 1, j).w;
  const n = outwardOf(blk.corners, 0),
    o = [n[0] * (w - 0.4), n[1] * (w - 0.4)];
  const q = [
    [a[0], a[1]],
    [b[0], b[1]],
    [b[0] + o[0], b[1] + o[1]],
    [a[0] + o[0], a[1] + o[1]],
  ];
  return clearPts(h, q) ? q : null;
}
/** THE ARBORETUM'S STATUES (the team's spec: "a giant park district with statues and yards"): at a park block's middle,
 *  one block in three, a statue on its plinth (world/imperialFabricModels.js) - its middle, or null. */
function parkStatueOf(h, i, j, blk) {
  if (hash32(h.seed, 51, i, j) % 3 !== 0) return null;
  const m = centroid(blk.corners);
  return clearPts(h, [m, [m[0] + 6, m[1]], [m[0] - 6, m[1]], [m[0], m[1] + 6], [m[0], m[1] - 6]]) ? m : null;
}
/**
 * THE BRIDGES OFF THE ROOFS of a block whose middle stands in the cell: over its streets to the next block a bridge from a
 * flat roof to a flat roof within a step of it across a street too wide to leap - never over a way up's stair (IC-STAIRS:
 * its parapet would stand through the deck), at either end.
 */
function waysOf(h, i, j, blk, L) {
  const seed = hash32(h.seed, 41, i, j);
  const kept = blk.plots.filter((p) => keptPlot(h, p));
  for (const p of kept) {
    if (p.roof !== 'flat' || p.tower) continue;
    for (let e = 0; e < 4; e++) {
      if (!(p.out & (1 << e)) || p.sw[e] <= ALLEY + 0.01 || hash32(seed, 43, p.key, e) % 4 !== 0) continue;
      const a = p.q[e],
        b = p.q[(e + 1) & 3],
        m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        n = outwardOf(p.q, e);
      for (let d = 1; d <= 18; d += 0.5) {
        const fx = m[0] + n[0] * d,
          fz = m[1] + n[1] * d,
          h2 = hoodAt(fx, fz);
        if (!h2 || fabricKeptClear(fx, fz)) break; // over a road, a wall, a landmark: no bridge
        const far = plotAtIn(h2, fx, fz);
        if (!far) continue;
        if (
          far !== p &&
          far.key > p.key &&
          far.roof === 'flat' &&
          !far.tower &&
          Math.abs(far.h - p.h) <= ROOF_STEP &&
          d > ALLEY + 0.5 &&
          !stairOver(h, m[0] + n[0] * 0.5, m[1] + n[1] * 0.5, BRIDGE_W / 2) &&
          !stairOver(h2, m[0] + n[0] * (d - 0.5), m[1] + n[1] * (d - 0.5), BRIDGE_W / 2)
        ) {
          L.bridges.push({
            from: m,
            n,
            len: d,
            y: Math.min(p.h, far.h),
            width: BRIDGE_W,
            seed: hash32(seed, p.key, e),
          });
        }
        break;
      }
    }
  }
}
/** A bridge's deck's width. */
const BRIDGE_W = 2.4;

// ---------------------------------------------------------------- IC-STAIRS: the ways up

/**
 * IC-STAIRS - A STAIR'S PLAN for a climb of `rise` metres: its risers (each STAIR.rise at the most, all alike), its flights
 * (each STAIR.flight risers at the most, the odd ones first) and its length along its wall - a flight of m risers runs
 * m - 1 treads (its last riser steps onto its landing), a landing between two flights, the head landing last.
 * @param {number} rise
 */
export function stairPlan(rise) {
  const n = Math.max(1, Math.ceil(rise / STAIR.rise - 1e-9)),
    nf = Math.ceil(n / STAIR.flight);
  const flights = Array.from({ length: nf }, (_, k) => Math.floor(n / nf) + (k < n % nf ? 1 : 0));
  const len = flights.reduce((a, m) => a + (m - 1) * STAIR.tread, 0) + (nf - 1) * STAIR.landing + STAIR.head;
  return { risers: n, rise: rise / n, flights, len };
}
/** @typedef {{ kind: string, s0: number, s1: number, y: number, m: number }} StairRun */
/** @typedef {{ at: number[], t: number[], n: number[], y0: number, top: number, key: number, edge: number, risers: number,
 *   rise: number, flights: number[], len: number, runs: StairRun[], box: number[] }} Stair */
/**
 * IC-STAIRS - A STAIR'S RUNS along its wall from its foot (metres along `t`): each flight `{ kind: 'flight', s0, s1, y, m }`
 * - its first riser at s0 up from y, its m-th at s1 onto its landing - and each landing, the head's last, `{ kind:
 * 'landing' | 'head', s0, s1, y }` at its height y (the head's its top's).
 * @param {{ y0: number, top: number, rise: number, flights: number[] }} s
 * @returns {StairRun[]}
 */
export function stairRuns(s) {
  const out = [];
  let at = 0,
    y = s.y0,
    n = 0;
  s.flights.forEach((m, k) => {
    const run = (m - 1) * STAIR.tread,
      last = k === s.flights.length - 1,
      l = last ? STAIR.head : STAIR.landing;
    out.push({ kind: 'flight', s0: at, s1: at + run, y, m });
    at += run;
    n += m;
    y = last ? s.top : s.y0 + n * s.rise;
    out.push({ kind: last ? 'head' : 'landing', s0: at, s1: at + l, y, m: 0 });
    at += l;
  });
  return out;
}
/** IC-STAIRS: the height a stair's walk stands at `along` its wall from its foot - a tread's, a landing's, the street's
 *  before it. @param {{ y0: number, rise: number, runs: StairRun[] }} s @param {number} along */
export function stairSurface(s, along) {
  if (along < 0) return s.y0;
  for (const g of s.runs) {
    if (along > g.s1 + 1e-9) continue;
    if (g.kind !== 'flight') return g.y;
    return g.y + Math.min(g.m, Math.floor((along - g.s0) / STAIR.tread + 1e-9) + 1) * s.rise;
  }
  return s.runs[s.runs.length - 1].y;
}
/** IC-STAIRS: a stair's depth out from its wall: its width and its parapet. */
export const STAIR_DEPTH = STAIR.width + STAIR.wall;
/** IC-STAIRS: a stair's middle (the city's metres) - the cell it stands in draws it. */
export const stairMiddle = (s) => [
  s.at[0] + (s.t[0] * s.len) / 2 + (s.n[0] * STAIR_DEPTH) / 2,
  s.at[1] + (s.t[1] * s.len) / 2 + (s.n[1] * STAIR_DEPTH) / 2,
];
/** IC-STAIRS: is a point (the city's metres) on a stair's ground - its footprint, `pad` past its ends. */
export function inStair(s, x, z, pad = STAIR.margin) {
  const dx = x - s.at[0],
    dz = z - s.at[1],
    along = dx * s.t[0] + dz * s.t[1],
    out = dx * s.n[0] + dz * s.n[1];
  return along > -pad && along < s.len + pad && out > -0.2 && out < STAIR_DEPTH + 0.3;
}
/**
 * IC-STAIRS: what a stair lays at a point (the city's metres) - GROUND.stair where it stands (its base, its piers with a
 * metre's room either side, its end wall, its ends' margins), GROUND.under where its upper flights pass STAIR.clear or
 * more over the street (a door's surround and a body under them: world/imperialFabricBuildings.js doorOf stands a door
 * there, the walkers pass), 0 off it.
 */
export function stairGround(s, x, z) {
  if (!inStair(s, x, z)) return 0;
  const dx = x - s.at[0],
    dz = z - s.at[1],
    along = dx * s.t[0] + dz * s.t[1];
  if (along < s.runs[1].s1 || along > s.len - STAIR.wall - 1) return GROUND.stair;
  for (let k = 3; k < s.runs.length; k += 2)
    if (s.runs[k].kind === 'landing' && along > s.runs[k].s0 - 1 && along < s.runs[k].s1 + 1) return GROUND.stair;
  return stairSurface(s, along - 0.5) - STAIR.rise - STAIR.waist >= STAIR.clear ? GROUND.under : GROUND.stair;
}
/** IC-STAIRS: the layout (its first half, baseCell) of the cell a point stands in. */
const baseCellAt = (x, z) => baseCell(Math.floor(z / B + HALF), Math.floor(x / B + HALF));
/** IC-STAIRS: the building a layout holds over a point (fabricPlotAt's, of that layout), or null. */
const plotIn = (L, x, z) =>
  (L.grid.get(bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET))) ?? []).find((p) => inQuad(p.q, x, z)) ?? null;
/** IC-STAIRS: does a building keep a bay for its door beside a stair - a bay of a street front of its (world/
 *  imperialFabricBuildings.js doorOf's: whole bays, BAY each) a door could take with no way up standing (its cell's ground
 *  the street or a square 0.8 and 2 m out, as doorOf reads it) whose surround (STAIR.margin either side of its middle, a
 *  hand out) and the street before it stand on none of the stair's shut ground - or none it could take without the stair
 *  either (FOUND AT THE SWEEP: a court of another neighbourhood laid over the street before every bay). */
function keepsADoor(o, s) {
  const L = baseCellAt(...centroid(o.q)),
    open = (q) => {
      const g = groundIn(L, q[0], q[1], false);
      return g === GROUND.street || g === GROUND.square;
    };
  let any = false;
  for (let e = 0; e < 4; e++) {
    if (!(o.out & (1 << e))) continue;
    const a = o.q[e],
      b = o.q[(e + 1) & 3],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outwardOf(o.q, e),
      t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const bays = Math.max(1, Math.round(len / BAY)),
      bay = len / bays;
    for (let k = 0; k < bays; k++) {
      const m = [a[0] + t[0] * (k + 0.5) * bay, a[1] + t[1] * (k + 0.5) * bay];
      const pts = [
        [-STAIR.margin, 0.3],
        [0, 0.3],
        [STAIR.margin, 0.3],
        [0, 0.8],
        [0, 2],
      ].map(([u, d]) => [m[0] + t[0] * u + n[0] * d, m[1] + t[1] * u + n[1] * d]);
      if (!open(pts[3]) || !open(pts[4])) continue;
      any = true;
      if (!pts.some((q) => stairGround(s, ...q) === GROUND.stair)) return true;
    }
  }
  return !any; // no bay a door could take without it either (the Arboretum's park, a court's spill): the stair takes none
}
/** IC-STAIRS: is a body's way up the street to a stair's foot blocked at a point - a building, a canal, a dead end's or a
 *  garden wall within a body's radius of its face, as the point's cell keeps them. */
function footBlocked(x, z) {
  const C = baseCellAt(x, z),
    near = (w, d) => pointSeg(x, z, w.a, w.b) < d + CAPSULE_RADIUS;
  return (
    !!plotIn(C, x, z) ||
    groundIn(C, x, z, false) === GROUND.canal ||
    C.ground.deadEnds.some((w) => near(w, 0.3)) ||
    C.ground.yards.some((w) => near(w, YARD_WALL.t / 2))
  );
}
/** IC-STAIRS: does anything stand in a stair's footprint (from its wall's line out past its coping, foot to head), as the
 *  cells its box reaches keep it - a building, a dead end's or a garden wall, a shed, a well, a statue, a square's
 *  fountain - or a court, the park's ground or a canal lie under it (FOUND AT THE SWEEP: a dead end's wall run on past
 *  its alley into a foot's first steps; a far ring's court of another neighbourhood over the street). */
function footprintTaken(s) {
  const fr = (v) => {
    const dx = v[0] - s.at[0],
      dz = v[1] - s.at[1];
    return [dx * s.t[0] + dz * s.t[1], dx * s.n[0] + dz * s.n[1]];
  };
  const P = (x, o) => [s.at[0] + s.t[0] * x + s.n[0] * o, s.at[1] + s.t[1] * x + s.n[1] * o],
    out = STAIR_DEPTH + 0.05;
  const near = (v, r) => {
    const [x, o] = fr(v);
    return Math.hypot(Math.max(0, -x, x - s.len), Math.max(0, -o, o - out)) < r;
  };
  const across = (w, r) => segRect(fr(w.a), fr(w.b), 0, 0, s.len, out, r) < r;
  const under = [],
    cells = new Set();
  for (let x = 0; x <= s.len; x += 0.5) for (const o of [0.1, STAIR_DEPTH / 2, STAIR_DEPTH]) under.push(P(x, o));
  for (let x = 0.05; x < s.len; x += 0.25)
    for (const o of [0.25, 0.85, 1.45, STAIR_DEPTH - 0.02]) if (plotIn(baseCellAt(...P(x, o)), ...P(x, o))) return true;
  for (const [x, z] of [
    [s.box[0], s.box[1]],
    [s.box[2], s.box[1]],
    [s.box[0], s.box[3]],
    [s.box[2], s.box[3]],
  ])
    cells.add(baseCellAt(x, z));
  for (const C of cells) {
    const G = C.ground;
    if (G.deadEnds.some((w) => across(w, 0.3 + 0.05)) || G.yards.some((w) => across(w, YARD_WALL.t / 2 + 0.05)))
      return true;
    if (G.sheds.some((v) => near(v, SHED.w * Math.SQRT1_2 + 0.05)) || G.wells.some((v) => near(v, WELL.r + 0.05)))
      return true;
    if (
      G.statues.some((v) => near(v, STATUE.plinth * Math.SQRT1_2 + 0.05)) ||
      G.fountains.some((v) => near(v, SQUARE_FOUNTAIN.r + 0.05))
    )
      return true;
    if ([...C.courts, ...C.parks, ...C.canals].some((q) => under.some((v) => inQuad(q, ...v)))) return true;
  }
  return false;
}
/** IC-STAIRS: does a stair of a neighbourhood's blocks stand at a point - its footprint `pad` past its ends. */
function stairOver(h, x, z, pad) {
  for (const [i, j] of blocksOver(h, x - 4, z - 4, x + 4, z + 4)) {
    const blk = blockPlots(h, i, j),
      s = blk.plots.length ? blockStair(h, i, j, blk) : null;
    if (s && inStair(s, x, z, pad)) return true;
  }
  return false;
}
/**
 * IC-STAIRS - A BLOCK'S WAY UP (the block's own, worked once and kept on it: every cell that asks gets the same): a stone
 * stair along one of its street fronts, from the street to the roof of the lowest building it can reach - the block's
 * buildings with a front on a lane or wider tried lowest first (a tower none: a climb of its own), each front of theirs
 * whose roof's edge a body walks onto (a flat roof's, its parapet opened over the stair's head; a pitched roof's eave -
 * never a gable's end), each way along it in the block's hash's order. The head landing stands STAIR.end in from the
 * front's corner it rises toward, and the flights run back along the street front from it to the foot: every metre of
 * it backed by a front of the block on its line (within STAIR.tol) whose wall stands a rail over its steps (the head's own
 * building's but its opening), the street before it - out past its parapet and on past its ends - clear of what keeps
 * the fabric clear and in its neighbourhood, never in the Elven Gardens' canals, nothing of the blocks in its footprint
 * and no court under it (footprintTaken). Null where no front of the block takes one. Pure: the block's buildings and the
 * plan's clear ground in, the same on every client.
 * @returns {Stair | null}
 */
function blockStair(h, i, j, blk) {
  const B_ = /** @type {any} */ (blk);
  if (B_._stair === undefined)
    Object.defineProperty(B_, '_stair', { value: findStair(h, i, j, blk), enumerable: false });
  return B_._stair;
}
function findStair(h, i, j, blk) {
  const seed = hash32(h.seed, 41, i, j),
    kept = blk.plots.filter((p) => keptPlot(h, p));
  const tries = [];
  for (const p of kept) {
    if (!p.out || p.tower) continue;
    for (let e = 0; e < 4; e++) {
      if (!(p.out & (1 << e)) || p.sw[e] < STAIR.street) continue;
      if (p.roof !== 'flat' && (p.roof === 'gableS') !== (e % 2 === 0)) continue; // a gable's end: no eave to step onto
      if ((e === 0 && canalLine(h, j)) || (e === 2 && canalLine(h, j + 1))) continue; // the Elven Gardens' water
      tries.push({ p, e, k: hash32(seed, 47, p.key, e) });
    }
  }
  tries.sort((u, v) => u.p.h - v.p.h || v.p.sw[v.e] - u.p.sw[u.e] || u.k - v.k);
  for (const { p, e, k } of tries)
    for (const dir of k & 1 ? [1, -1] : [-1, 1]) {
      const s = stairAt(h, kept, p, e, dir);
      if (s) return s;
    }
  return null;
}
/** IC-STAIRS: a stair on building p's front e rising `dir` along it (1 from its corner e toward e + 1), or null. */
function stairAt(h, kept, p, e, dir) {
  const a = p.q[e],
    b = p.q[(e + 1) & 3],
    wall = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (wall < STAIR.head + 2 * STAIR.end) return null;
  const u = [(b[0] - a[0]) / wall, (b[1] - a[1]) / wall],
    t = dir > 0 ? u : [-u[0], -u[1]],
    n = outwardOf(p.q, e),
    corner = dir > 0 ? b : a;
  const y0 = streetKind(p.sw[e]) === 'main' ? PAVEMENT.h : 0,
    plan = stairPlan(p.h - y0),
    back = STAIR.end + plan.len;
  const at = [corner[0] - t[0] * back, corner[1] - t[1] * back];
  const dot = (v, w) => (v[0] - at[0]) * w[0] + (v[1] - at[1]) * w[1];
  const fronts = [];
  for (const o of kept)
    for (let f = 0; f < 4; f++) {
      if (!(o.out & (1 << f))) continue;
      const c0 = o.q[f],
        c1 = o.q[(f + 1) & 3],
        nf = outwardOf(o.q, f);
      if (nf[0] * n[0] + nf[1] * n[1] < 0.98 || Math.abs(dot(c0, n)) > STAIR.tol || Math.abs(dot(c1, n)) > STAIR.tol)
        continue;
      fronts.push([Math.min(dot(c0, t), dot(c1, t)), Math.max(dot(c0, t), dot(c1, t)), o]);
    }
  // a roof to step onto at its head: the building STAIR.roof deep behind it there, a pitched roof's slope over the head no
  // steeper than STAIR.pitch (FOUND AT THE SWEEP: a wedge of a polar frame's narrow end pitches its roof past 60 degrees)
  const head = (x, o) => /** @type {[number, number]} */ ([at[0] + t[0] * x + n[0] * o, at[1] + t[1] * x + n[1] * o]);
  const q = p.q,
    ridge = p.roof === 'gableS' ? [q[3], q[0], q[1], q[2]] : [q[0], q[1], q[2], q[3]];
  const R0 = [(ridge[0][0] + ridge[1][0]) / 2, (ridge[0][1] + ridge[1][1]) / 2],
    R1 = [(ridge[2][0] + ridge[3][0]) / 2, (ridge[2][1] + ridge[3][1]) / 2];
  for (const x of [plan.len - STAIR.head, plan.len - STAIR.wall]) {
    if (!inQuad(p.q, ...head(x, -STAIR.roof))) return null;
    if (p.roof !== 'flat' && p.ridge - p.h > Math.tan((STAIR.pitch * Math.PI) / 180) * pointSeg(...head(x, 0), R0, R1))
      return null;
  }
  const s = { at, t, n, y0, top: p.h, key: p.key, edge: e, ...plan, runs: [], box: [] };
  s.runs = stairRuns(s);
  // its wall: every point of it on a front of the block, standing a rail over its steps (the head's own building's whole)
  for (let x = 0; x <= plan.len + 1e-9; x += 0.25) {
    const y = stairSurface(s, x);
    const on = fronts.filter(([s0, s1]) => x >= s0 - 1e-6 && x <= s1 + 1e-6),
      into = [at[0] + t[0] * x - n[0] * STAIR.into, at[1] + t[1] * x - n[1] * STAIR.into];
    if (!on.length || !on.every(([, , o]) => o === p || o.h >= y + STAIR.rail)) return null;
    if (!on.some(([, , o]) => inQuad(o.q, ...into))) return null; // FOUND AT THE SWEEP: a polar frame's twisted wedge holds no wall there
  }
  // the street before it: clear, its neighbourhood's, out past its parapet and on past its ends
  const span = plan.len + 2 * STAIR.margin,
    k1 = Math.ceil(span);
  for (let k = 0; k <= k1; k++)
    for (const o of [0.4, STAIR_DEPTH + 0.3]) {
      const x = -STAIR.margin + (span * k) / k1,
        px = at[0] + t[0] * x + n[0] * o,
        pz = at[1] + t[1] * x + n[1] * o;
      if (fabricKeptClear(px, pz) || hoodAt(px, pz)?.key !== h.key) return null;
    }
  const P = (x, o) => [at[0] + t[0] * x + n[0] * o, at[1] + t[1] * x + n[1] * o];
  // its foot's approach: a body's way up the street to its first step clear of a dead end's wall across an alley there
  // (FOUND AT THE SWEEP: a wall from the block's corner across the street before a foot shut it in)
  for (const x of [-0.3, -0.9, -1.5]) for (const o of [0.75, 1.05]) if (footBlocked(...P(x, o))) return null;
  const C = [
    P(-STAIR.margin, -0.2),
    P(plan.len + STAIR.margin, -0.2),
    P(plan.len + STAIR.margin, STAIR_DEPTH + 0.3),
    P(-STAIR.margin, STAIR_DEPTH + 0.3),
  ];
  s.box = [
    Math.min(...C.map((c) => c[0])),
    Math.min(...C.map((c) => c[1])),
    Math.max(...C.map((c) => c[0])),
    Math.max(...C.map((c) => c[1])),
  ];
  // nothing in its footprint, no court under it (FOUND AT THE SWEEP: a dead end's wall, run on 0.6 m past its alley along
  // the street front, stood in a foot's first steps; a warped court of the Elven Gardens lay over a street)
  if (footprintTaken(s)) return null;
  // every building it climbs before keeps a bay for its door (FOUND AT THE SWEEP: 4 in 100 of the city's doors had stood
  // where a stair now shuts the street - a base, a landing's pier, its head's end - and the door law found no other bay)
  for (const o of new Set([p, ...fronts.map(([, , q]) => q)])) if (!keepsADoor(o, s)) return null;
  return Object.freeze(s);
}
/** The building of a neighbourhood standing over a point, or null - its frame's block there. */
function plotAtIn(h, x, z) {
  for (const [i, j] of blocksOver(h, x - 0.5, z - 0.5, x + 0.5, z + 0.5))
    for (const p of blockPlots(h, i, j).plots) if (inQuad(p.q, x, z)) return keptPlot(h, p) ? p : null;
  return null;
}
/** An edge's outward unit normal (in the ground's plane), away from the quad's middle. */
export function outwardOf(q, e) {
  const a = q[e],
    b = q[(e + 1) & 3],
    m = centroid(q);
  let n = [b[1] - a[1], -(b[0] - a[0])];
  const l = Math.hypot(n[0], n[1]) || 1;
  n = [n[0] / l, n[1] / l];
  const mx = (a[0] + b[0]) / 2 - m[0],
    mz = (a[1] + b[1]) / 2 - m[1];
  return n[0] * mx + n[1] * mz < 0 ? [-n[0], -n[1]] : n;
}

// ---------------------------------------------------------------- the ground's laws (the fabric's)

/** What the fabric lays at a point, by code: none, a building, a court, a square, the park, a canal, a street, a park's
 *  path, a way up's stair (IC-STAIRS), a garden wall or a dead end's wall, a statue, the street under a stair's upper
 *  flights (IC-STAIRS: open, a door's there, no lamp's). */
export const GROUND = Object.freeze({
  none: 0,
  building: 1,
  court: 2,
  square: 3,
  park: 4,
  canal: 5,
  street: 6,
  path: 7,
  stair: 8,
  wall: 9,
  statue: 10,
  under: 11,
});
/** The park's paths: a lattice of lanes, each wandering, every 64 m. */
function parkPath(x, z) {
  const w = 3.2,
    p = 64,
    ox = x + 9 * Math.sin(z / 47),
    oz = z + 9 * Math.sin(x / 53);
  return Math.abs((((ox % p) + p) % p) - p / 2) < w / 2 || Math.abs((((oz % p) + p) % p) - p / 2) < w / 2;
}
/** A segment's distance test, (x, z) within `d` of a-b. */
const nearSeg = (x, z, a, b, d) => pointSeg(x, z, a, b) < d;
/**
 * WHAT THE FABRIC LAYS AT A POINT of a cell's layout (GROUND's code): what keeps it clear none; a building; a garden wall or
 * a dead end's wall; a way up's stair (IC-STAIRS: every near block's, STAIR.margin past its ends - a door's surround and a
 * lamp clear of it); a statue; a canal; a court, a square, the park (its path); else a street.
 */
export function fabricGroundIn(L, x, z) {
  return groundIn(L, x, z, true);
}
/** What a cell's layout lays at a point - with its ways up (`stairs`), or as though none stood (IC-STAIRS: the ground a way
 *  up is laid on, read by its own law - a door's bays, what stands in its footprint). */
function groundIn(L, x, z, stairs) {
  const hoodHere = L.hoods.length === 1 ? L.hoods[0] : hoodAt(x, z);
  if (!hoodHere || fabricKeptClear(x, z)) return GROUND.none;
  for (const p of L.grid.get(bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET))) ?? [])
    if (inQuad(p.q, x, z)) return GROUND.building;
  const G = L.ground; // IC-GRAND: every near block's, not the cell's own alone
  for (const w of G.yards) if (nearSeg(x, z, w.a, w.b, YARD_WALL.t / 2 + 0.3)) return GROUND.wall;
  for (const w of G.deadEnds) if (nearSeg(x, z, w.a, w.b, 0.6)) return GROUND.wall;
  for (const s of G.sheds)
    if (Math.abs(x - s[0]) < SHED.w / 2 + 0.2 && Math.abs(z - s[1]) < SHED.w / 2 + 0.2) return GROUND.wall;
  for (const w of G.wells) if (Math.hypot(x - w[0], z - w[1]) < WELL.r + 0.3) return GROUND.wall; // IC-GRAND: a yard's well
  let under = false;
  for (const s of stairs ? G.stairs : []) {
    const g = stairGround(s, x, z);
    if (g === GROUND.stair) return g;
    if (g) under = true;
  }
  if (under && hoodHere.kind !== 'park') return GROUND.under; // the street under a stair's upper flights (the Arboretum's ground stays the park's)
  for (const s of G.statues) if (Math.hypot(x - s[0], z - s[1]) < STATUE.plinth / 2 + 0.6) return GROUND.statue;
  for (const f of G.fountains) if (Math.hypot(x - f[0], z - f[1]) < SQUARE_FOUNTAIN.r + 0.3) return GROUND.statue; // IC-GRAND: a square's fountain
  for (const q of L.canals) if (inQuad(q, x, z)) return GROUND.canal;
  for (const q of L.courts) if (inQuad(q, x, z)) return GROUND.court;
  for (const q of L.squares) if (inQuad(q, x, z)) return GROUND.square;
  for (const q of L.parks) if (inQuad(q, x, z)) return parkPath(x, z) ? GROUND.path : GROUND.park;
  return hoodHere.kind === 'park' ? (parkPath(x, z) ? GROUND.path : GROUND.park) : GROUND.street;
}
/** A park statue's plinth, its height, and the figure on it. */
export const STATUE = Object.freeze({ plinth: 3.2, plinthH: 2.2, figure: 5.4 });
/** The cell a point is in. */
const cellOf = (x, z) => fabricCell(Math.floor(z / B + HALF), Math.floor(x / B + HALF));
/** What the fabric lays at a point (the city's metres) - its cell's layout's (fabricGroundIn). */
export const fabricGroundAt = (x, z) => fabricGroundIn(cellOf(x, z), x, z);
/** The building over a point, or null. */
export function fabricPlotAt(x, z) {
  const L = cellOf(x, z);
  for (const p of L.grid.get(bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET))) ?? [])
    if (inQuad(p.q, x, z)) return p;
  return null;
}
/** The fabric's tile for a ground code at a point (world/imperialCity.js imperialTile's records), or -1 for none of its
 *  own: stone under its buildings, its walls, its streets and squares; a garden court's grass, a yard's stone; the park's
 *  grass and its paths' stone; a canal's water. */
export function fabricTileOf(g, x, z) {
  if (g === GROUND.none) return -1;
  if (g === GROUND.canal) return 0;
  if (g === GROUND.park) return 2;
  if (g === GROUND.court) return hoodAt(x, z)?.style.court === 'garden' ? 2 : 3;
  return 3;
}
/** Is a ground code shut to the city's walkers: a building, a court (no street reaches it), a wall, a stair, a statue, a
 *  canal. */
export const fabricClosedOf = (g) =>
  g === GROUND.building ||
  g === GROUND.court ||
  g === GROUND.wall ||
  g === GROUND.stair ||
  g === GROUND.statue ||
  g === GROUND.canal;
/** A tree of the fabric for a ground code at a tile's centre, or -1: a garden court's one in five, the park's groves (one
 *  in three where its grove noise stands, one in forty elsewhere), never on a path. IC-GRAND (the review: "planted
 *  (gardens, orchards in the Elven Gardens/Arboretum)"): a stone yard's one in eleven; an orchard - a tree every other tile
 *  each way, in rows - in the park's ground and the Elven Gardens' garden courts where the orchards' patches stand
 *  (one ORCHARD.patch square in three). */
export function fabricTreeOf(g, x, z, trees) {
  const hh = hash32(SALT, Math.floor(x), Math.floor(z), 19),
    pick = trees[(hh >>> 3) % trees.length];
  const orchard = () => hash32(SALT, Math.floor(x / ORCHARD.patch), Math.floor(z / ORCHARD.patch), 29) % 3 === 0;
  const row = () => Math.floor(x / ORCHARD.tile) % 2 === 0 && Math.floor(z / ORCHARD.tile) % 2 === 0;
  if (g === GROUND.court) {
    const hood = hoodAt(x, z),
      garden = hood?.style.court === 'garden';
    if (garden && hood?.district === 'Elven Gardens District' && orchard()) return row() ? pick : -1;
    return hh % (garden ? 5 : 11) === 0 ? pick : -1;
  }
  if (g === GROUND.park) {
    if (orchard()) return row() ? pick : -1;
    const grove = Math.sin(x / 61) * Math.sin(z / 57) + Math.sin((x + z) / 91) * 0.6;
    return (grove > 0.55 && hh % 3 === 0) || hh % 41 === 0 ? pick : -1;
  }
  return -1;
}
/** IC-GRAND: the orchards' patches (metres a side) and the tile their rows are counted in (a ground tile's 6.4 m). */
export const ORCHARD = Object.freeze({ patch: 96, tile: 6.4 });
/** Test seam: forget every kept layout. */
export function _resetFabric() {
  _cells.clear();
  _blocks.clear();
  _hoods.clear();
  _clear.clear();
}
/** The movement's numbers the fabric is laid to, for the pins: the reach a step is under, the leap an alley is under, the
 *  fall a drop is under, the vault a parapet is under. */
export const FABRIC_LAWS = Object.freeze({
  stepReach: PARKOUR_REACH_MIN + PARKOUR_AIR_REACH + JUMP_RISE,
  leapMin: PARKOUR_RUNLEAP_DIST_MIN,
  safeDrop: PARKOUR_SAFE_DROP,
  vault: PARKOUR_VAULT_MAX,
});

// ---------------------------------------------------------------- far off: the blocks' masses

/**
 * A SLICE'S MASSES, for the far view (world/imperialFabricModels.js skylineModel): every frame block of the slice's
 * neighbourhoods whose middle stands in the slice and whose corners and middle stand clear - its ring of buildings as four
 * runs (or its row as one), each at its buildings' middle height, its roofs' kind the block's most - and none of the
 * buildings' own tests (a slice's hundreds of blocks in milliseconds).
 * @param {number[]} rect the slice's [x0, z0, x1, z1]
 * @returns {Array<{ q: number[][], h: number, gable: boolean, wall: string, roofTex: string }>}
 */
export function fabricMasses(rect) {
  const [x0, z0, x1, z1] = rect,
    out = [],
    hoods = new Map();
  for (let i = 0; i <= 8; i++)
    for (let j = 0; j <= 8; j++) {
      const h = hoodAt(x0 + ((x1 - x0) * i) / 8, z0 + ((z1 - z0) * j) / 8);
      if (h) hoods.set(h.key, h);
    }
  for (const h of hoods.values()) {
    for (const [i, j] of blocksOver(h, x0, z0, x1, z1)) {
      const blk = blockPlots(h, i, j),
        m = centroid(blk.corners);
      if (!blk.plots.length || m[0] < x0 || m[0] >= x1 || m[1] < z0 || m[1] >= z1) continue;
      if (!clearPts(h, [...blk.corners, m])) continue;
      const hs = blk.plots.map((p) => p.h).sort((a, b) => a - b),
        mid = hs[Math.floor(hs.length / 2)];
      const gable = blk.plots.filter((p) => p.roof !== 'flat').length * 2 > blk.plots.length;
      const st = h.style;
      if (blk.court) {
        // the ring as four runs between the block's outer corners and its court's
        const C = blk.corners,
          K = blk.court;
        for (let e = 0; e < 4; e++)
          out.push({
            q: [C[e], C[(e + 1) & 3], K[(e + 1) & 3], K[e]],
            h: mid,
            gable,
            wall: st.walls[0],
            roofTex: st.roof,
          });
      } else out.push({ q: blk.corners, h: mid, gable, wall: st.walls[0], roofTex: st.roof });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the streets themselves

/**
 * A CELL'S STREETS - the middle lines of its neighbourhoods' streets where they run as streets through the cell (`{ a, b,
 * w, kind, hood, axis, line }`: a run's two ends, the city's metres, its width and streetKind; walked every STEP along the
 * line, a run where the ground under it is a street) - the sewers' branches run under them (world/imperialSewers.js).
 */
export function fabricStreetsIn(r, c) {
  const L = fabricCell(r, c),
    x0 = (c - HALF) * B,
    z0 = (r - HALF) * B,
    x1 = x0 + B,
    z1 = z0 + B,
    out = [],
    STEP = 4;
  const inCell = (p) => p[0] >= x0 && p[0] < x1 && p[1] >= z0 && p[1] < z1;
  for (const h of L.hoods) {
    if (h.kind === 'park') continue;
    const pts = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].map(([x, z]) => toFrame(h, x, z));
    for (const axis of [0, 1]) {
      const other = 1 - axis;
      let lo, hi;
      if (h.kind === 'polar') {
        const am = pts[0][0],
          as = pts.map(([a]) => am + Math.atan2(Math.sin(a - am), Math.cos(a - am)));
        [lo, hi] =
          axis === 0
            ? [Math.min(...as) - h.spoke0, Math.max(...as) - h.spoke0]
            : [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
      } else
        [lo, hi] = [
          Math.min(...pts.map((p) => p[axis])) - (h.warp ?? 0),
          Math.max(...pts.map((p) => p[axis])) + (h.warp ?? 0),
        ];
      const [i0, i1] = lineRange(h, axis, lo, hi);
      // the other coordinate's span over the cell
      const os = pts.map((p) => p[other]);
      for (let i = i0; i <= i1; i++) {
        const line = lineOf(h, axis, i);
        if (!(line.w > ALLEY + 0.01)) continue;
        let run = null;
        const emit = () => {
          if (run && run.n > 1)
            out.push({ a: run.a, b: run.b, w: line.w, kind: streetKind(line.w), hood: h.key, axis, line: i });
          run = null;
        };
        const [oLo, oHi] =
          h.kind === 'polar' && axis === 1
            ? (() => {
                const am = pts[0][0],
                  as = pts.map(([a]) => am + Math.atan2(Math.sin(a - am), Math.cos(a - am)));
                return [Math.min(...as), Math.max(...as)];
              })()
            : [Math.min(...os) - (h.warp ?? 0), Math.max(...os) + (h.warp ?? 0)];
        const steps =
          h.kind === 'polar' && axis === 1
            ? Math.ceil(((oHi - oLo) * Math.max(1, line.at)) / STEP)
            : Math.ceil((oHi - oLo) / STEP);
        for (let k = 0; k <= steps; k++) {
          const o = oLo + ((oHi - oLo) * k) / Math.max(1, steps);
          const p = axis === 0 ? fromFrame(h, line.at, o) : fromFrame(h, o, line.at);
          const ok = inCell(p) && hoodAt(p[0], p[1])?.key === h.key && fabricGroundIn(L, p[0], p[1]) === GROUND.street;
          if (ok) {
            if (!run) run = { a: p, b: p, n: 1 };
            else {
              run.b = p;
              run.n++;
            }
          } else emit();
        }
        emit();
      }
    }
  }
  return out;
}
