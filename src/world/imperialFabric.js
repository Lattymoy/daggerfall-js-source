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
// BLD) - beside Daggerfall's own blocks along each district's avenue and round its heart (world/imperialCity.js tradeCell).
//
// EACH DISTRICT ITS OWN STREETS (`IMPERIAL_STYLES`), and each its NEIGHBOURHOODS - five rings out from the palace wall and
// two halves either side of its avenue, the middle ring its heart's alone - each its own frame of streets off its own seed,
// so no two read alike: the Market District a grid of dense arcaded blocks round open squares; the Arena District rings
// and spokes round the arena and round circuses of its own; the Arboretum a park of groves, lawns, paths and ponds with
// villas at its edges; the Temple District long processional blocks on its avenue's axis, plazas on the axis; Talos Plaza
// spokes and rings round its dragon and round each neighbourhood's own circus; the Elven Gardens winding lanes on a
// warped grid with canals and garden courts; the Waterfront warehouses in rows to the quay.
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
//   - a way up from the street: a stack of crates, a shed and a lean-to, each top at most a vault (PARKOUR_VAULT_MAX)
//     over the one below, to the lowest roof of its block - and down again the same way, each drop under the fall's
//     hurt (PARKOUR_SAFE_DROP);
//   - a ledge along a street front at LEDGE_Y - the lip a wall-run at Climbing 0 reaches - and balconies over it;
//   - every flat roof's parapet a vault's height, and every pitched roof under PARKOUR_TOP_MIN_NY's steepest top.
// The collider is the model's own mesh (scenes/pixelBuild.js files every placed model), so every face drawn is solid.
//
// Pure: a cell's buildings are worked from its row and column and the plan (world/imperialCity.js), the same on every
// client; the cells' layouts are kept a few hundred at a time (an LRU) and worked again on demand.
import { hash32, BLOCK_M } from './spawnedDungeons.js';
import {
  IMPERIAL, IMPERIAL_SECTORS, IMPERIAL_CELLS, polar, imperialBearing, imperialLand, imperialDistrictAt, imperialGeo, pointSeg,
  segRect, rectPoint, rectRadii, imperialCell, imperialClassic, districtHeart, imperialRoadsNear, imperialRoadAt,
} from './imperialCity.js';
import { PARKOUR_REACH_MIN, PARKOUR_AIR_REACH, PARKOUR_RUNLEAP_DIST_MIN, PARKOUR_SAFE_DROP, PARKOUR_VAULT_MAX } from '../player/parkour.js';
import { JUMP_SPEED, GRAVITY } from '../player/motor.js';

const HALF = IMPERIAL_CELLS / 2, B = BLOCK_M;
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
/** A way up's steps, metres each - none over a vault. */
export const STACK_STEP = 1.2;

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
  'Market District': Object.freeze({ frame: 'grid', P: [40, 56], Q: [40, 56], streets: [[7, 5], [ALLEY, 3], [10, 1]], depth: [9, 12], front: [5, 8.5], k: [4, 8], gable: 0.55, pitch: 32, walls: ['facadeOchre', 'facadeBrick', 'facadeWhite'], ground: ['groundArcade', 'groundShop'], roof: 'terracotta', square: 7, court: 'yard' }),
  'Arena District': Object.freeze({ frame: 'polar', P: [44, 64], Q: [52, 70], streets: [[7, 4], [ALLEY, 2], [11, 1]], depth: [10, 13], front: [6, 10], k: [3, 7], gable: 0.7, pitch: 30, walls: ['facadeTimber', 'facadeBrick', 'facadeOchre'], ground: ['groundShop', 'groundShop'], roof: 'terracotta', square: 0, court: 'yard' }),
  'Arboretum': Object.freeze({ frame: 'park', P: [70, 90], Q: [70, 90], streets: [[6, 1]], depth: [12, 16], front: [10, 16], k: [3, 5], gable: 0.3, pitch: 28, walls: ['facadeWhite', 'facadeStone'], ground: ['groundArcade', 'groundArcade'], roof: 'blueSlate', square: 0, court: 'garden' }),
  'Temple District': Object.freeze({ frame: 'axial', P: [76, 104], Q: [44, 58], streets: [[8, 5], [ALLEY, 2], [12, 2]], depth: [11, 14], front: [7, 11], k: [5, 10], gable: 0.4, pitch: 34, walls: ['facadeStone', 'facadeWhite'], ground: ['groundArcade', 'groundArcade'], roof: 'roof', square: 4, court: 'yard' }),
  'Talos Plaza District': Object.freeze({ frame: 'polar', P: [48, 62], Q: [58, 74], streets: [[9, 4], [ALLEY, 1], [13, 2]], depth: [11, 13], front: [7, 10], k: [6, 8], gable: 0.25, pitch: 30, walls: ['facadeStone', 'facadeStone', 'facadeWhite'], ground: ['groundShop', 'groundArcade'], roof: 'roof', square: 0, court: 'yard' }),
  'Elven Gardens District': Object.freeze({ frame: 'organic', P: [56, 78], Q: [56, 78], streets: [[5, 4], [ALLEY, 3], [8, 1], [10, 1]], depth: [9, 12], front: [6, 11], k: [3, 6], gable: 0.5, pitch: 36, walls: ['facadeWhite', 'facadeStone'], ground: ['groundArcade', 'groundShop'], roof: 'blueSlate', square: 0, court: 'garden' }),
  'Waterfront District': Object.freeze({ frame: 'docks', P: [64, 84], Q: [24, 30], streets: [[10, 4], [ALLEY, 2], [8, 2], [14, 1]], depth: [12, 14], front: [12, 20], k: [3, 5], gable: 0.85, pitch: 26, walls: ['facadeTimber', 'facadeBrick'], ground: ['groundShop', 'groundShop'], roof: 'roof', square: 0, court: 'yard' }),
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
  for (const [v, w] of list) { if (t < w) return v; t -= w; }
  return list[list.length - 1][0];
}

/**
 * THE NEIGHBOURHOOD A POINT IS IN (the city's metres), or null - none in Green Emperor Way, on City Isle, in the Prison's
 * grounds or the University's, past the lake. Each its district, its ring and half, its style, and its own frame of
 * streets (`frame`): its kind, its origin, its turn, its blocks' sides and its seed - the heart's its landmark's.
 */
export function hoodAt(x, z) {
  const d = imperialDistrictAt(x, z);
  const style = d ? IMPERIAL_STYLES[d] : null;
  if (!style) return null;
  const r = Math.hypot(x, z), b = imperialBearing(x, z);
  let di, ring, half;
  if (d === 'Waterfront District') {
    di = 6; ring = r < DOCK_RINGS[1] ? 0 : 1; half = b < 180 ? 0 : 1;
  } else {
    di = IMPERIAL_SECTORS.findIndex(([n]) => n === d);
    ring = 0;
    while (ring < HOOD_RINGS.length - 2 && r >= HOOD_RINGS[ring + 1]) ring++;
    half = ring === HEART_RING ? 4 : Math.min(3, Math.floor((b - IMPERIAL_SECTORS[di][1]) / 15));
  }
  const key = di * 100 + ring * 10 + half;
  let h = _hoods.get(key);
  if (!h) { h = makeHood(key, d, di, ring, half, style); _hoods.set(key, h); }
  return h;
}

/** A neighbourhood's own frame and its own numbers, off its key. */
function makeHood(key, d, di, ring, half, style) {
  const I = IMPERIAL, heart = ring === HEART_RING && di < 6;
  const sector = di < 6 ? IMPERIAL_SECTORS[di][1] : 158;
  const mid = di < 6 ? sector + (heart ? 30 : 7.5 + 15 * half) : (half === 0 ? 170 : 190);
  const rings = di < 6 ? HOOD_RINGS : DOCK_RINGS;
  const rMid = (rings[ring] + rings[ring + 1]) / 2;
  // the frame's kind: the district's own; the Arena District's rings and the Talos Plaza's spokes round their heart and round
  // a circus a neighbourhood of theirs stands, its others a grid; the Elven Gardens' warped; the Arboretum's park
  let kind = style.frame;
  // its middle: the heart's landmark; an axial frame's on its avenue (its line through its middle the avenue), others the
  // neighbourhood's own middle
  const centre = heart ? districtHeart(d) : kind === 'axial' ? polar(sector + 30, rMid) : polar(mid, rMid);
  if (kind === 'polar' && !heart && u01(key, 1) < (d === 'Arena District' ? 0.5 : 0.35)) kind = 'grid';
  if (kind === 'park' && (ring === 0 || ring === 4)) kind = 'grid';   // the Arboretum's villas, by the palace wall and the city wall
  const radial = (mid * Math.PI) / 180;   // the bearing out, as the frame's turn: x east, z south
  const towards = Math.atan2(-Math.cos(radial), Math.sin(radial));
  const turn = kind === 'axial' ? towards : kind === 'docks' ? towards : towards + [0, 0.26, -0.26, 0.52, 0.79][Math.floor(u01(key, 2) * 5)];
  const scale = span(0.86, 1.14, key, 3);
  const P = [style.P[0] * scale, style.P[1] * scale], Q = [style.Q[0] * scale, style.Q[1] * scale];
  const kShift = Math.floor(u01(key, 4) * 3) - 1;
  const k = [Math.max(2, style.k[0] + kShift), Math.max(3, style.k[1] + kShift)];
  // a polar frame's rings start clear of its middle: the arena's cell, Talos's plaza, a circus's own
  const polarR0 = d === 'Arena District' && heart ? B * 0.75 + 10 : d === 'Talos Plaza District' && heart ? I.statue.plaza + 12 : span(30, 46, key, 5);
  // a polar heart's spokes: an even count, two of them its avenue (in to the palace gate, out to the city gate)
  const spokes = kind === 'polar' ? 2 * Math.round(span(9, 14, key, 6)) : 0;
  const spoke0 = kind === 'polar' ? (heart ? towards : u01(key, 11) * 0.3) : 0;
  return Object.freeze({
    key, district: d, ring, half, heart, style, kind, centre, turn, P, Q, k, polarR0, spokes, spoke0,
    warp: kind === 'organic' ? span(9, 16, key, 7) : 0, warpL: kind === 'organic' ? span(70, 110, key, 8) : 1,
    gable: Math.min(0.95, Math.max(0.05, style.gable + (u01(key, 9) - 0.5) * 0.3)),
    seed: hash32(SALT, key, 77),
  });
}

// ---------------------------------------------------------------- the frames

/** A frame's coordinates of a point, and a point of its coordinates. Grid-like frames: (u, v) along and across its turn
 *  (the organic one warped on top); polar: (angle, radius) about its centre. */
function toFrame(h, x, z) {
  const dx = x - h.centre[0], dz = z - h.centre[1];
  if (h.kind === 'polar') return [Math.atan2(dz, dx), Math.hypot(dx, dz)];
  const c = Math.cos(h.turn), s = Math.sin(h.turn);
  return [dx * c + dz * s, -dx * s + dz * c];
}
export function fromFrame(h, u, v) {
  if (h.kind === 'polar') return [h.centre[0] + Math.cos(u) * v, h.centre[1] + Math.sin(u) * v];
  let a = u, b = v;
  if (h.kind === 'organic') { a = u + h.warp * Math.sin(v / h.warpL + (h.seed & 255)); b = v + h.warp * Math.sin(u / h.warpL + ((h.seed >>> 8) & 255)); }
  const c = Math.cos(h.turn), s = Math.sin(h.turn);
  return [h.centre[0] + a * c - b * s, h.centre[1] + a * s + b * c];
}
/** A frame's street lines along one axis: the i-th's middle and width - a lattice jittered a fifth of its pitch, each
 *  line's width the style's pick off its hash; a polar frame's spokes evenly turned, its rings out from its middle. */
function lineOf(h, axis, i) {
  const st = h.style;
  if (h.kind === 'polar' && axis === 0) {
    const n = h.spokes, a = (i * 2 * Math.PI) / n + h.spoke0;
    // a heart's spokes 0 and n/2 its avenue, the avenue's width
    if (h.heart && (((i % n) + n) % n) % (n / 2) === 0) return { at: a, w: IMPERIAL.avenue.w + 6 };
    return { at: a, w: weighted(st.streets, h.key, 12, i) };
  }
  if (h.kind === 'polar' && axis === 1) {
    if (i < 0) return { at: -1e9, w: 0 };
    const pitch = (h.Q[0] + h.Q[1]) / 2, at = h.polarR0 + i * pitch + (i > 0 ? (u01(h.key, 13, i) - 0.5) * pitch * 0.3 : 0);
    return { at, w: i === 0 ? 9 : weighted(st.streets, h.key, 14, i) };
  }
  const R = axis === 0 ? h.P : h.Q, pitch = (R[0] + R[1]) / 2;
  // the axial frame's line through its middle is its avenue (the Temple District's processional way): on the axis, its width
  if (h.kind === 'axial' && axis === 1 && i === 0) return { at: 0, w: IMPERIAL.avenue.w + 6 };
  const at = i * pitch + (u01(h.key, 15 + axis, i) - 0.5) * (R[1] - R[0]);
  return { at, w: weighted(st.streets, h.key, 17 + axis, i) };
}
/** The index range of a frame's lines a span of frame coordinates crosses (and one past either side). */
function lineRange(h, axis, lo, hi) {
  if (h.kind === 'polar' && axis === 0) {
    const n = h.spokes, step = (2 * Math.PI) / n;
    return [Math.floor(lo / step) - 1, Math.ceil(hi / step) + 1];
  }
  if (h.kind === 'polar' && axis === 1) {
    const pitch = (h.Q[0] + h.Q[1]) / 2;
    return [Math.max(0, Math.floor((lo - h.polarR0) / pitch) - 1), Math.max(0, Math.ceil((hi - h.polarR0) / pitch) + 1)];
  }
  const R = axis === 0 ? h.P : h.Q, pitch = (R[0] + R[1]) / 2;
  return [Math.floor(lo / pitch) - 1, Math.ceil(hi / pitch) + 1];
}

// ---------------------------------------------------------------- what keeps the fabric off

/** The clear widths, metres: past a wall, a road's kerb, a landmark's ground; the street kept round each of Daggerfall's
 *  blocks. */
export const CLEAR = Object.freeze({ palace: 20, cityWall: 14, districtWall: 10, road: 3, way: 4, gate: 24, classic: 5, temple: 26, statue: 6, divines: 14, pool: 14, market: 4, arena: 8, bridgeHead: 60, quay: 26 });
const _clear = new Map();
/**
 * WHAT KEEPS A CELL'S FABRIC CLEAR - a test of a point (the city's metres) that asks only what stands near the cell
 * (r, c): water, the Palace District, the walls and their feet, the city's roads (its avenues, its radials, its rings -
 * imperialRoadAt), the ways and the bridge's head, the landmarks' grounds, the arena's cell, the Prison's and the
 * University's grounds, the Waterfront's quay, City Isle's green, and Daggerfall's own blocks with a street round each
 * (CLEAR). Made once a cell (an LRU).
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
  const I = IMPERIAL, g = imperialGeo(), C = CLEAR, M = 2;
  const x0 = (c - HALF) * B - M, z0 = (r - HALF) * B - M, x1 = x0 + B + 2 * M, z1 = z0 + B + 2 * M;
  const near = (p, d) => rectPoint(x0, z0, x1, z1, p) < d;
  const [rmin, rmax] = rectRadii(x0, z0, x1, z1);
  /** @type {Array<(x: number, z: number, rr: number) => boolean>} */
  const tests = [];
  if (rmin < I.palaceWall.r + C.palace) tests.push((x, z, rr) => rr < I.palaceWall.r + C.palace);
  const cw = I.cityWall.thick / 2 + I.cityWall.towerR + C.cityWall;
  if (rmin < I.cityWall.r + cw && rmax > I.cityWall.r - cw) tests.push((x, z, rr) => Math.abs(rr - I.cityWall.r) < cw);
  if (rmax > I.isle - 40) tests.push((x, z) => !imperialLand(x, z));
  if (rmax > I.cityWall.r) {
    tests.push((x, z, rr) => rr >= I.cityWall.r && (imperialDistrictAt(x, z) !== 'Waterfront District' || rr > I.waterfront.r1 - C.quay));
    for (const [a, b] of g.ways) if (segRect(a, b, x0, z0, x1, z1, I.causeway / 2 + C.way) < I.causeway / 2 + C.way) tests.push((x, z) => pointSeg(x, z, a, b) < I.causeway / 2 + C.way);
  }
  if (rmin < I.cityWall.r) {
    for (const [a, b] of g.walls) if (segRect(a, b, x0, z0, x1, z1, I.districtWall.thick / 2 + C.districtWall) < I.districtWall.thick / 2 + C.districtWall) tests.push((x, z) => pointSeg(x, z, a, b) < I.districtWall.thick / 2 + C.districtWall);
    const roads = imperialRoadsNear(x0, z0, x1, z1, C.road);
    if (roads) tests.push((x, z) => imperialRoadAt(x, z, C.road, roads) !== null);
  }
  const T = I.temple, tw = T.w / 2 + T.towerS + C.temple, tl = T.l / 2 + T.towerS + C.temple, [tx, tz] = g.temple;
  if (x1 > tx - tw && x0 < tx + tw && z1 > tz - tl && z0 < tz + tl) tests.push((x, z) => Math.abs(x - tx) < tw && Math.abs(z - tz) < tl);
  for (const [p, d] of [[g.statue, I.statue.plaza + C.statue], [g.divines, I.divines.court + C.divines], [g.pool, I.pool.r0 + C.pool], [g.bridge[0], C.bridgeHead]]) {
    if (near(p, d)) tests.push((x, z) => Math.hypot(x - p[0], z - p[1]) < d);
  }
  for (const p of g.wallGates) if (near(p, C.gate)) tests.push((x, z) => Math.hypot(x - p[0], z - p[1]) < C.gate);
  for (const [p, hw] of [[g.market, I.market.half + C.market], [g.arena, B / 2 + C.arena]]) {
    if (x1 > p[0] - hw && x0 < p[0] + hw && z1 > p[1] - hw && z0 < p[1] + hw) tests.push((x, z) => Math.abs(x - p[0]) < hw && Math.abs(z - p[1]) < hw);
  }
  // Daggerfall's blocks round the cell, each with its street
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!imperialClassic(imperialCell(r + dr, c + dc))) continue;
    const ax = (c + dc - HALF) * B - C.classic, az = (r + dr - HALF) * B - C.classic, bx = ax + B + 2 * C.classic, bz = az + B + 2 * C.classic;
    tests.push((x, z) => x > ax && x < bx && z > az && z < bz);
  }
  return (x, z) => { const rr = Math.hypot(x, z); for (const f of tests) if (f(x, z, rr)) return true; return false; };
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
 *   ledge: boolean, balcony: number, tower: boolean, key: number, sw: number[] }} Plot */

/** A street line's middle and half-width, either side of a block, as the block's own bounds along an axis. */
function blockBounds(h, axis, i) {
  const a = lineOf(h, axis, i), b = lineOf(h, axis, i + 1);
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
  if (p) { _blocks.delete(key); _blocks.set(key, p); return p; }
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
    const a0 = U.lo + U.wLo / 2 / Math.max(r, 1), a1 = U.hi - U.wHi / 2 / Math.max(r, 1);
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
  let at = 0, n = 0;
  while (len - at > lo * 1.5) { const w = Math.min(span(lo, hi, ...k, n++), len - at - lo * 0.5); out.push([at, at + w]); at += w; }
  if (len - at > 0.5) { if (out.length) out[out.length - 1][1] = len; else out.push([0, len]); }
  return out;
}

/**
 * A FRAME BLOCK'S BUILDINGS: the block between street lines (i, i + 1) and (j, j + 1) of a neighbourhood's frame - ringed
 * by buildings on its four streets round a court where it is wide enough, else a row through it; or none, a square (the
 * style's one in so many) or the park. Each building's height a walk round the ring in half storeys, at most one off the
 * one before (ROOF_STEP); its roof flat or pitched by the neighbourhood's share; its pictures the style's.
 * @returns {{ plots: Plot[], court: number[][] | null, square: boolean, park: boolean, corners: number[][], yards?: Array<{ a: number[], b: number[] }>, sheds?: number[][], wells?: number[][], deadEnds?: Array<{ a: number[], b: number[] }> }}
 */
function makeBlock(h, i, j) {
  const U = blockBounds(h, 0, i), V = blockBounds(h, 1, j);
  const [Ls, Lt] = blockLengths(h, U, V);
  const corners = [blockPoint(h, U, V, 0, 0), blockPoint(h, U, V, 1, 0), blockPoint(h, U, V, 1, 1), blockPoint(h, U, V, 0, 1)];
  const st = h.style, seed = hash32(h.seed, i, j);
  const empty = { plots: [], court: null, square: false, park: false, corners };
  if (!(Ls > 8 && Lt > 8)) return empty;
  if (h.kind === 'park' && !(u01(seed, 1) < 0.08)) return { ...empty, park: true };   // the Arboretum: a villa in a dozen of its blocks
  if (st.square && seed % st.square === 0) return { ...empty, square: true };
  const D = span(st.depth[0], st.depth[1], seed, 2);
  const P = (s, t) => blockPoint(h, U, V, s / Ls, t / Lt);
  /** @type {Array<{ s0: number, s1: number, t0: number, t1: number, out: number }>} */
  const rects = [];
  const solid = Ls < 2 * D + 6 || Lt < 2 * D + 6;
  if (solid) {
    // a row through the block along its longer side, each building its whole depth: both long sides on a street
    if (Ls >= Lt) for (const [a, b] of pieces(Ls, st.front[0], st.front[1], seed, 3)) rects.push({ s0: a, s1: b, t0: 0, t1: Lt, out: 0b0101 | (a === 0 ? 0b1000 : 0) | (b >= Ls - 1e-6 ? 0b0010 : 0) });
    else for (const [a, b] of pieces(Lt, st.front[0], st.front[1], seed, 3)) rects.push({ s0: 0, s1: Ls, t0: a, t1: b, out: 0b1010 | (a === 0 ? 0b0001 : 0) | (b >= Lt - 1e-6 ? 0b0100 : 0) });
  } else {
    // the ring: the four corners, then each side's run between them - in order round the block (south, east, north, west);
    // the north and west runs laid from their own corner back (a piece [a, b] of the run stands at Ls - D - b .. Ls - D -
    // a), so each building's neighbour in the order is its neighbour on the ground
    const sides = [
      () => { rects.push({ s0: 0, s1: D, t0: 0, t1: D, out: 0b1001 }); for (const [a, b] of pieces(Ls - 2 * D, st.front[0], st.front[1], seed, 4)) rects.push({ s0: D + a, s1: D + b, t0: 0, t1: D, out: 0b0001 }); },
      () => { rects.push({ s0: Ls - D, s1: Ls, t0: 0, t1: D, out: 0b0011 }); for (const [a, b] of pieces(Lt - 2 * D, st.front[0], st.front[1], seed, 5)) rects.push({ s0: Ls - D, s1: Ls, t0: D + a, t1: D + b, out: 0b0010 }); },
      () => { rects.push({ s0: Ls - D, s1: Ls, t0: Lt - D, t1: Lt, out: 0b0110 }); for (const [a, b] of pieces(Ls - 2 * D, st.front[0], st.front[1], seed, 6)) rects.push({ s0: Ls - D - b, s1: Ls - D - a, t0: Lt - D, t1: Lt, out: 0b0100 }); },
      () => { rects.push({ s0: 0, s1: D, t0: Lt - D, t1: Lt, out: 0b1100 }); for (const [a, b] of pieces(Lt - 2 * D, st.front[0], st.front[1], seed, 7)) rects.push({ s0: 0, s1: D, t0: Lt - D - b, t1: Lt - D - a, out: 0b1000 }); },
    ];
    for (const f of sides) f();
  }
  // THE HEIGHT WALK round the ring (or along the row): each at most one half storey off the one before; a tower now and
  // then, two storeys over its neighbours - a climb of its own
  const [k0, k1] = h.k;
  let k = k0 + Math.floor(u01(seed, 8) * (k1 - k0 + 1));
  const ks = rects.map((_, n) => { if (n > 0) { const step = Math.floor(u01(seed, 9, n) * 3) - 1; k = Math.min(k1, Math.max(k0, k + step)); } return k; });
  // the ring closes: walk the last ones back toward the first, so the wrap is a step too
  if (!solid) for (let n = ks.length - 1; n > 0 && Math.abs(ks[n] - ks[(n + 1) % ks.length]) > 1; n--) ks[n] = ks[(n + 1) % ks.length] + Math.sign(ks[n] - ks[(n + 1) % ks.length]);
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
    const ridgeAlongS = (rc.s1 - rc.s0) >= (rc.t1 - rc.t0);
    const ridge = gable ? eave + (across / 2) * Math.tan((st.pitch * Math.PI) / 180) : eave;
    return /** @type {Plot} */ ({
      q, out: rc.out, sw: lineW.map((w, e) => (rc.out & (1 << e) ? w : 0)), h: eave, roof: gable ? (ridgeAlongS ? 'gableS' : 'gableT') : 'flat', ridge,
      wall: st.walls[pk % st.walls.length], ground: st.ground[(pk >>> 4) % st.ground.length], roofTex: tower ? 'roof' : st.roof,
      ledge: (pk >>> 8) % 3 !== 0, balcony: (pk >>> 12) % 5 === 0 ? 1 + ((pk >>> 16) % 2) : 0, tower, key: pk,
    });
  });
  const court = solid ? null : [P(D, D), P(Ls - D, D), P(Ls - D, Lt - D), P(D, Lt - D)];
  // IC-GRAND (the coordinator's review of the renders: "Courtyards should be courtyard-sized (yards, gardens, sheds, wells,
  // trees)"): A WIDE COURT BUILT IN - a court BACK.min or more across both ways stands a back range in its middle (the house
  // behind the house, a workshop, a coach house), BACK.gap in from the ring all round - the yards round it - split across
  // its longer way into pieces near BACK.len long, BACK.lane apart; a storey or two under the ring's lowest, its own roof
  const cw = Ls - 2 * D, ct = Lt - 2 * D;
  /** @type {number[][]} the back range's rectangles, [s0, s1, t0, t1] */
  const backs = [];
  if (court && Math.min(cw, ct) >= BACK.min) {
    const s0 = D + BACK.gap, s1 = Ls - D - BACK.gap, t0 = D + BACK.gap, t1 = Lt - D - BACK.gap, alongS = s1 - s0 >= t1 - t0;
    const len = alongS ? s1 - s0 : t1 - t0, n = Math.max(1, Math.round(len / BACK.len)), piece = (len - (n - 1) * BACK.lane) / n;
    for (let k = 0; k < n; k++) {
      const a = (alongS ? s0 : t0) + k * (piece + BACK.lane), b = a + piece;
      backs.push(alongS ? [a, b, t0, t1] : [s0, s1, a, b]);
    }
  }
  const low = Math.max(h.k[0] - 1, 2, Math.min(...ks) - 2);
  backs.forEach(([s0, s1, t0, t1], n) => {
    const q = [P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)], pk = hash32(seed, 26, n), eave = low * (STOREY / 2);
    const gable = u01(pk, 1) < Math.max(0.5, h.gable), ridgeAlongS = s1 - s0 >= t1 - t0, across = Math.min(s1 - s0, t1 - t0);
    plots.push(/** @type {Plot} */ ({
      q, out: 0, sw: [0, 0, 0, 0], h: eave, roof: gable ? (ridgeAlongS ? 'gableS' : 'gableT') : 'flat', ridge: gable ? eave + (across / 2) * Math.tan((st.pitch * Math.PI) / 180) : eave,
      wall: st.walls[pk % st.walls.length], ground: st.ground[0], roofTex: st.roof, ledge: false, balcony: 0, tower: false, key: pk, back: true,
    }));
  });
  // THE YARDS: a court parted into backyards by garden walls (YARD_WALL high - a jump and a catch from the ground, FABRIC_LAWS.stepReach; a walk along the
  // top): one wall across a narrow court, a cross of them in a wide one; a shed in one yard in three. IC-GRAND: round a back
  // range, the cross from the ring to its faces; a well in one court in two, in the corner across from the shed's
  /** @type {Array<{ a: number[], b: number[] }>} */
  const yards = [];
  if (court && backs.length) {
    const [bs0, , bt0] = backs[0], bs1 = backs[backs.length - 1][1], bt1 = backs[backs.length - 1][3];
    yards.push({ a: P(Ls / 2, D), b: P(Ls / 2, bt0) }, { a: P(Ls / 2, bt1), b: P(Ls / 2, Lt - D) }, { a: P(D, Lt / 2), b: P(bs0, Lt / 2) }, { a: P(bs1, Lt / 2), b: P(Ls - D, Lt / 2) });
  } else if (court) {
    if (cw > 14) yards.push({ a: P(Ls / 2, D), b: P(Ls / 2, Lt - D) });
    if (ct > 14 && (cw <= 14 || u01(seed, 21) < 0.6)) yards.push({ a: P(D, Lt / 2), b: P(Ls - D, Lt / 2) });
  }
  const sheds = court && u01(seed, 22) < 0.34 ? [P(D + 3.5, D + 3.5)] : [];
  const wells = court && cw > 9 && ct > 9 && u01(seed, 24) < 0.5 ? [P(Ls - D - 3, Lt - D - 3)] : [];
  // DEAD ENDS: an alley closed at one of its ends by a wall across it from a corner of the block (one alley end in three)
  /** @type {Array<{ a: number[], b: number[] }>} */
  const deadEnds = [];
  const cornerAt = [[0, 0], [Ls, 0], [Ls, Lt], [0, Lt]];
  for (let e = 0; e < 4; e++) {
    if (lineW[e] > ALLEY + 0.01 || hash32(seed, 23, e) % 3 !== 0) continue;
    // the alley along edge e, closed at the block's corner e: a wall from the corner out across the alley
    const [cs, ct2] = cornerAt[e], out = lineW[e] + 0.6;
    const dir = e === 0 ? [0, -1] : e === 1 ? [1, 0] : e === 2 ? [0, 1] : [-1, 0];
    deadEnds.push({ a: P(cs, ct2), b: P(cs + dir[0] * out, ct2 + dir[1] * out) });
  }
  return { plots, court, square: false, park: false, corners, yards, sheds, wells, deadEnds };
}
/** A garden wall's height (a vault's), its thickness; a backyard shed's height and side. */
export const YARD_WALL = Object.freeze({ h: 1.8, t: 0.4 });
export const SHED = Object.freeze({ h: 2.4, w: 4 });
/** IC-GRAND: a court's back range - the least a court is across both ways before one stands in it, how far in from the ring
 *  it stands (its yards), a piece's length, the lane between two. */
export const BACK = Object.freeze({ min: 30, gap: 9, len: 24, lane: 5 });
/** IC-GRAND: a yard's well - its kerb's radius and height, its posts' and its little roof's height. */
export const WELL = Object.freeze({ r: 0.9, h: 0.9, roofH: 2.8 });
/** IC-GRAND: a square's fountain - its basin's radius and its column's height. */
export const SQUARE_FOUNTAIN = Object.freeze({ r: 3.2, h: 3.6 });
/** A street's kinds by its width: an alley, a lane, a side street, a main street (its pavements). */
export const streetKind = (w) => (w <= ALLEY + 0.01 ? 'alley' : w < 7 ? 'lane' : w < 10 ? 'side' : 'main');
/** A main street's pavement: its width out from the fronts, its kerb's height (a step: under motor.js STEP_OFFSET). */
export const PAVEMENT = Object.freeze({ w: 2.2, h: 0.15 });

// ---------------------------------------------------------------- a cell's layout

/** @typedef {{ r: number, c: number, plots: Plot[], near: Plot[], courts: number[][][], squares: number[][][], parks: number[][][],
 *   canals: number[][][], yards: any[], sheds: number[][], wells: number[][], fountains: number[][], deadEnds: any[], bridges: any[], stacks: any[], statues: number[][],
 *   ground: { yards: any[], deadEnds: any[], sheds: number[][], wells: number[][], fountains: number[][], statues: number[][] },
 *   grid: Map<number, Plot[]>, hoods: any[] }} CellLayout */
const _cells = new Map();
/** How many cells' layouts are kept. */
export const FABRIC_CELL_KEEP = 512;
/** The point-in-quad test (a convex quad, either winding). */
export function inQuad(q, x, z) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) & 3], cr = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (cr !== 0) { const sg = cr > 0 ? 1 : -1; if (sign && sg !== sign) return false; sign = sg; }
  }
  return true;
}
export const centroid = (q) => [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
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
  const key = r * IMPERIAL_CELLS + c;
  let L = _cells.get(key);
  if (L) { _cells.delete(key); _cells.set(key, L); return L; }
  L = makeCell(r, c);
  _cells.set(key, L);
  if (_cells.size > FABRIC_CELL_KEEP) _cells.delete(_cells.keys().next().value);
  return L;
}
/** The frame blocks of a neighbourhood a rectangle of the city's metres touches. */
function blocksOver(h, x0, z0, x1, z1) {
  const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [(x0 + x1) / 2, (z0 + z1) / 2]].map(([x, z]) => toFrame(h, x, z));
  const out = [];
  if (h.kind === 'polar') {
    // unwrap the angles about the middle point's; a rectangle over the frame's middle sees every spoke
    const am = pts[4][0], as = pts.map(([a]) => am + Math.atan2(Math.sin(a - am), Math.cos(a - am)));
    const rs = pts.map(([, rr]) => rr), inside = Math.hypot(h.centre[0] - (x0 + x1) / 2, h.centre[1] - (z0 + z1) / 2) < Math.hypot(x1 - x0, z1 - z0);
    const [i0, i1] = inside ? [0, h.spokes] : lineRange(h, 0, Math.min(...as) - h.spoke0, Math.max(...as) - h.spoke0);
    const [j0, j1] = lineRange(h, 1, inside ? 0 : Math.min(...rs), Math.max(...rs));
    const seen = new Set();
    for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) { const ii = ((i % h.spokes) + h.spokes) % h.spokes; if (!seen.has(ii * 4096 + j)) { seen.add(ii * 4096 + j); out.push([ii, j]); } }
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
    for (const v of [...p.q, centroid(p.q)]) if (fabricKeptClear(v[0], v[1]) || hoodAt(v[0], v[1])?.key !== h.key) { ok = false; break; }
    Object.defineProperty(P, '_kept', { value: ok, enumerable: false });
  }
  return P._kept;
}
/** Is a piece of the fabric (a court, a wall, a statue) clear - its points all clear and its neighbourhood's. */
const clearPts = (h, pts) => pts.every((v) => !fabricKeptClear(v[0], v[1]) && hoodAt(v[0], v[1])?.key === h.key);
const MARGIN = 24;
function makeCell(r, c) {
  const x0 = (c - HALF) * B, z0 = (r - HALF) * B, x1 = x0 + B, z1 = z0 + B;
  /** @type {CellLayout} */
  const L = { r, c, plots: [], near: [], courts: [], squares: [], parks: [], canals: [], yards: [], sheds: [], wells: [], fountains: [], deadEnds: [], bridges: [], stacks: [], statues: [], grid: new Map(), hoods: [],
    ground: { yards: [], deadEnds: [], sheds: [], wells: [], fountains: [], statues: [] } };
  const cell = imperialCell(r, c);
  if (!cell || !/^I[0-9a-z]{4}$/.test(cell)) return L;   // the lake, the open shore, the arena, Daggerfall's blocks: none
  const hoods = new Map();
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    const h = hoodAt(x0 - MARGIN + ((B + 2 * MARGIN) * i) / 4, z0 - MARGIN + ((B + 2 * MARGIN) * j) / 4);
    if (h) hoods.set(h.key, h);
  }
  L.hoods = [...hoods.values()];
  const inCell = (p) => p[0] >= x0 && p[0] < x1 && p[1] >= z0 && p[1] < z1;
  const nearCell = (q) => q.some((p) => p[0] >= x0 - 2 && p[0] <= x1 + 2 && p[1] >= z0 - 2 && p[1] <= z1 + 2) || inQuad(q, (x0 + x1) / 2, (z0 + z1) / 2);
  for (const h of hoods.values()) {
    for (const [i, j] of blocksOver(h, x0 - MARGIN, z0 - MARGIN, x1 + MARGIN, z1 + MARGIN)) {
      const blk = blockPlots(h, i, j);
      for (const p of blk.plots) {
        if (!nearCell(p.q) || !keptPlot(h, p)) continue;
        L.near.push(p);
        if (inCell(centroid(p.q))) L.plots.push(p);
      }
      const mine = inCell(centroid(blk.corners));
      if (blk.court && nearCell(blk.court)) L.courts.push(blk.court);
      if (blk.square && nearCell(blk.corners)) {
        L.squares.push(blk.corners);
        // IC-GRAND (the review: "large empty lots ... made squares with something in them"): a fountain at its middle
        const m = centroid(blk.corners), f = SQUARE_FOUNTAIN.r + 2;
        if (clearPts(h, [m, [m[0] + f, m[1]], [m[0] - f, m[1]], [m[0], m[1] + f], [m[0], m[1] - f]])) { L.ground.fountains.push(m); if (mine) L.fountains.push(m); }
      }
      if (blk.park && nearCell(blk.corners)) { L.parks.push(blk.corners); const st = parkStatueOf(h, i, j, blk); if (st) { L.ground.statues.push(st); if (mine) L.statues.push(st); } }
      if (h.kind === 'organic' && nearCell(blk.corners)) canalOf(h, i, j, blk, L);
      // IC-GRAND: a near block's garden walls, dead ends, sheds and wells close the cell's ground where they stand in it
      // (the ground's own list); the block whose middle stands in the cell draws them (a piece across a cell's edge closed
      // on both sides, drawn once)
      if (!mine && !nearCell(blk.corners)) continue;
      const G = L.ground;
      for (const y of blk.yards ?? []) if (clearPts(h, [y.a, y.b])) { G.yards.push(y); if (mine) L.yards.push(y); }
      for (const s of blk.sheds ?? []) if (clearPts(h, [s])) { G.sheds.push(s); if (mine) L.sheds.push(s); }
      for (const w of blk.wells ?? []) if (clearPts(h, [w])) { G.wells.push(w); if (mine) L.wells.push(w); }
      for (const d of blk.deadEnds ?? []) if (clearPts(h, [d.a, d.b])) { G.deadEnds.push(d); if (mine) L.deadEnds.push(d); }
      if (mine && blk.plots.length) waysOf(h, i, j, blk, L);
    }
  }
  // the buckets: every building near the cell under each 8 m square it covers
  for (const p of L.near) {
    const xs = p.q.map((v) => v[0]), zs = p.q.map((v) => v[1]);
    for (let bx = Math.floor(Math.min(...xs) / BUCKET); bx <= Math.floor(Math.max(...xs) / BUCKET); bx++) for (let bz = Math.floor(Math.min(...zs) / BUCKET); bz <= Math.floor(Math.max(...zs) / BUCKET); bz++) {
      const k = bucketKey(bx, bz);
      let list = L.grid.get(k);
      if (!list) L.grid.set(k, list = []);
      list.push(p);
    }
  }
  return L;
}
/** THE ELVEN GARDENS' CANALS: a block's south street, one line in three, is water - its banks the blocks' fronts. */
function canalOf(h, i, j, blk, L) {
  if (hash32(h.seed, 31, j) % 3 !== 0) return;
  const [a, b] = [blk.corners[0], blk.corners[1]], w = lineOf(h, 1, j).w;
  if (w <= ALLEY + 0.01) return;   // an alley is no canal
  const n = outwardOf(blk.corners, 0), o = [n[0] * (w - 0.4), n[1] * (w - 0.4)];
  const q = [[a[0], a[1]], [b[0], b[1]], [b[0] + o[0], b[1] + o[1]], [a[0] + o[0], a[1] + o[1]]];
  if (clearPts(h, q)) L.canals.push(q);
}
/** THE ARBORETUM'S STATUES (the team's spec: "a giant park district with statues and yards"): at a park block's middle,
 *  one block in three, a statue on its plinth (world/imperialFabricModels.js) - its middle, or null. */
function parkStatueOf(h, i, j, blk) {
  if (hash32(h.seed, 51, i, j) % 3 !== 0) return null;
  const m = centroid(blk.corners);
  return clearPts(h, [m, [m[0] + 6, m[1]], [m[0] - 6, m[1]], [m[0], m[1] + 6], [m[0], m[1] - 6]]) ? m : null;
}
/**
 * THE WAYS ON AND OFF THE ROOFS of a block whose middle stands in the cell: on a street front of its lowest building a way
 * up (a stack of crates, a shed and a lean-to, each STACK_STEP over the one below), and over its streets to the next block
 * a bridge from a flat roof to a flat roof within a step of it across a street too wide to leap.
 */
function waysOf(h, i, j, blk, L) {
  const seed = hash32(h.seed, 41, i, j);
  const kept = blk.plots.filter((p) => keptPlot(h, p));
  const fronts = kept.filter((p) => p.out);
  if (fronts.length) {
    const p = fronts.reduce((a, b) => (b.h < a.h ? b : a));
    const e = [0, 1, 2, 3].find((k) => (p.out & (1 << k)) && p.sw[k] >= 5) ?? -1;
    if (e >= 0) {
      const a = p.q[e], b = p.q[(e + 1) & 3], wall = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (wall > 4 && p.h > STACK_STEP * 2) {
        // a stair of crates and sheds along the front, each STACK_STEP over the last and STACK_RUN along: its top within a
        // vault of the roof's edge - a flat roof's parapet, a pitched roof's eave
        const t = [(b[0] - a[0]) / wall, (b[1] - a[1]) / wall], n = outwardOf(p.q, e), top = p.h + (p.roof === 'flat' ? PARAPET : 0);
        const steps = Math.max(1, Math.ceil((top - PARKOUR_VAULT_MAX) / STACK_STEP)), len = steps * STACK_RUN;
        const at = [a[0] + t[0] * (wall / 2 - len / 2), a[1] + t[1] * (wall / 2 - len / 2)];
        const far = [at[0] + t[0] * len + n[0] * STACK_DEPTH, at[1] + t[1] * len + n[1] * STACK_DEPTH];
        if (clearPts(h, [[at[0] + n[0] * STACK_DEPTH, at[1] + n[1] * STACK_DEPTH], far])) L.stacks.push({ at, t, n, steps, len, top, seed });
      }
    }
  }
  // bridges: from this block's flat-roofed fronts across the street to the far block's, one front in four
  for (const p of kept) {
    if (p.roof !== 'flat' || p.tower) continue;
    for (let e = 0; e < 4; e++) {
      if (!(p.out & (1 << e)) || p.sw[e] <= ALLEY + 0.01 || hash32(seed, 43, p.key, e) % 4 !== 0) continue;
      const a = p.q[e], b = p.q[(e + 1) & 3], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = outwardOf(p.q, e);
      for (let d = 1; d <= 18; d += 0.5) {
        const fx = m[0] + n[0] * d, fz = m[1] + n[1] * d, h2 = hoodAt(fx, fz);
        if (!h2 || fabricKeptClear(fx, fz)) break;   // over a road, a wall, a landmark: no bridge
        const far = plotAtIn(h2, fx, fz);
        if (!far) continue;
        if (far !== p && far.key > p.key && far.roof === 'flat' && !far.tower && Math.abs(far.h - p.h) <= ROOF_STEP && d > ALLEY + 0.5) {
          L.bridges.push({ from: m, n, len: d, y: Math.min(p.h, far.h), width: 2.4, seed: hash32(seed, p.key, e) });
        }
        break;
      }
    }
  }
}
/** The building of a neighbourhood standing over a point, or null - its frame's block there. */
function plotAtIn(h, x, z) {
  for (const [i, j] of blocksOver(h, x - 0.5, z - 0.5, x + 0.5, z + 0.5)) for (const p of blockPlots(h, i, j).plots) if (inQuad(p.q, x, z)) return keptPlot(h, p) ? p : null;
  return null;
}
/** An edge's outward unit normal (in the ground's plane), away from the quad's middle. */
export function outwardOf(q, e) {
  const a = q[e], b = q[(e + 1) & 3], m = centroid(q);
  let n = [b[1] - a[1], -(b[0] - a[0])];
  const l = Math.hypot(n[0], n[1]) || 1;
  n = [n[0] / l, n[1] / l];
  const mx = (a[0] + b[0]) / 2 - m[0], mz = (a[1] + b[1]) / 2 - m[1];
  return n[0] * mx + n[1] * mz < 0 ? [-n[0], -n[1]] : n;
}

// ---------------------------------------------------------------- the ground's laws (the fabric's)

/** What the fabric lays at a point, by code: none, a building, a court, a square, the park, a canal, a street, a park's
 *  path, a way up, a garden wall or a dead end's wall, a statue. */
export const GROUND = Object.freeze({ none: 0, building: 1, court: 2, square: 3, park: 4, canal: 5, street: 6, path: 7, stack: 8, wall: 9, statue: 10 });
/** How far a way up stands out from its wall. */
export const STACK_DEPTH = 1.4;
/** The park's paths: a lattice of lanes, each wandering, every 64 m. */
function parkPath(x, z) {
  const w = 3.2, p = 64, ox = x + 9 * Math.sin(z / 47), oz = z + 9 * Math.sin(x / 53);
  return Math.abs((((ox % p) + p) % p) - p / 2) < w / 2 || Math.abs((((oz % p) + p) % p) - p / 2) < w / 2;
}
/** A segment's distance test, (x, z) within `d` of a-b. */
const nearSeg = (x, z, a, b, d) => pointSeg(x, z, a, b) < d;
/**
 * WHAT THE FABRIC LAYS AT A POINT of a cell's layout (GROUND's code): what keeps it clear none; a building; a garden wall or
 * a dead end's wall; a way up's stack; a statue; a canal; a court, a square, the park (its path); else a street.
 */
export function fabricGroundIn(L, x, z) {
  const hoodHere = L.hoods.length === 1 ? L.hoods[0] : hoodAt(x, z);
  if (!hoodHere || fabricKeptClear(x, z)) return GROUND.none;
  for (const p of L.grid.get(bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET))) ?? []) if (inQuad(p.q, x, z)) return GROUND.building;
  const G = L.ground;   // IC-GRAND: every near block's, not the cell's own alone
  for (const w of G.yards) if (nearSeg(x, z, w.a, w.b, YARD_WALL.t / 2 + 0.3)) return GROUND.wall;
  for (const w of G.deadEnds) if (nearSeg(x, z, w.a, w.b, 0.6)) return GROUND.wall;
  for (const s of G.sheds) if (Math.abs(x - s[0]) < SHED.w / 2 + 0.2 && Math.abs(z - s[1]) < SHED.w / 2 + 0.2) return GROUND.wall;
  for (const w of G.wells) if (Math.hypot(x - w[0], z - w[1]) < WELL.r + 0.3) return GROUND.wall;   // IC-GRAND: a yard's well
  for (const s of L.stacks) {
    const dx = x - s.at[0], dz = z - s.at[1], along = dx * s.t[0] + dz * s.t[1], out = dx * s.n[0] + dz * s.n[1];
    if (along > -0.3 && along < s.len + 0.3 && out > -0.2 && out < STACK_DEPTH + 0.3) return GROUND.stack;
  }
  for (const s of G.statues) if (Math.hypot(x - s[0], z - s[1]) < STATUE.plinth / 2 + 0.6) return GROUND.statue;
  for (const f of G.fountains) if (Math.hypot(x - f[0], z - f[1]) < SQUARE_FOUNTAIN.r + 0.3) return GROUND.statue;   // IC-GRAND: a square's fountain
  for (const q of L.canals) if (inQuad(q, x, z)) return GROUND.canal;
  for (const q of L.courts) if (inQuad(q, x, z)) return GROUND.court;
  for (const q of L.squares) if (inQuad(q, x, z)) return GROUND.square;
  for (const q of L.parks) if (inQuad(q, x, z)) return parkPath(x, z) ? GROUND.path : GROUND.park;
  return hoodHere.kind === 'park' ? (parkPath(x, z) ? GROUND.path : GROUND.park) : GROUND.street;
}
/** A way up's step's run along its wall. */
export const STACK_RUN = 1.0;
/** A park statue's plinth, its height, and the figure on it. */
export const STATUE = Object.freeze({ plinth: 3.2, plinthH: 2.2, figure: 5.4 });
/** The cell a point is in. */
const cellOf = (x, z) => fabricCell(Math.floor(z / B + HALF), Math.floor(x / B + HALF));
/** What the fabric lays at a point (the city's metres) - its cell's layout's (fabricGroundIn). */
export const fabricGroundAt = (x, z) => fabricGroundIn(cellOf(x, z), x, z);
/** The building over a point, or null. */
export function fabricPlotAt(x, z) {
  const L = cellOf(x, z);
  for (const p of L.grid.get(bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET))) ?? []) if (inQuad(p.q, x, z)) return p;
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
/** Is a ground code shut to the city's walkers: a building, a court (no street reaches it), a wall, a stack, a statue, a
 *  canal. */
export const fabricClosedOf = (g) => g === GROUND.building || g === GROUND.court || g === GROUND.wall || g === GROUND.stack || g === GROUND.statue || g === GROUND.canal;
/** A tree of the fabric for a ground code at a tile's centre, or -1: a garden court's one in five, the park's groves (one
 *  in three where its grove noise stands, one in forty elsewhere), never on a path. IC-GRAND (the review: "planted
 *  (gardens, orchards in the Elven Gardens/Arboretum)"): a stone yard's one in eleven; an orchard - a tree every other tile
 *  each way, in rows - in the park's ground and the Elven Gardens' garden courts where the orchards' patches stand
 *  (one ORCHARD.patch square in three). */
export function fabricTreeOf(g, x, z, trees) {
  const hh = hash32(SALT, Math.floor(x), Math.floor(z), 19), pick = trees[(hh >>> 3) % trees.length];
  const orchard = () => hash32(SALT, Math.floor(x / ORCHARD.patch), Math.floor(z / ORCHARD.patch), 29) % 3 === 0;
  const row = () => Math.floor(x / ORCHARD.tile) % 2 === 0 && Math.floor(z / ORCHARD.tile) % 2 === 0;
  if (g === GROUND.court) {
    const hood = hoodAt(x, z), garden = hood?.style.court === 'garden';
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
export function _resetFabric() { _cells.clear(); _blocks.clear(); _hoods.clear(); _clear.clear(); }
/** The movement's numbers the fabric is laid to, for the pins: the reach a step is under, the leap an alley is under, the
 *  fall a drop is under, the vault a step of a way up and a parapet are under. */
export const FABRIC_LAWS = Object.freeze({ stepReach: PARKOUR_REACH_MIN + PARKOUR_AIR_REACH + JUMP_RISE, leapMin: PARKOUR_RUNLEAP_DIST_MIN, safeDrop: PARKOUR_SAFE_DROP, vault: PARKOUR_VAULT_MAX });

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
  const [x0, z0, x1, z1] = rect, out = [], hoods = new Map();
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const h = hoodAt(x0 + ((x1 - x0) * i) / 8, z0 + ((z1 - z0) * j) / 8); if (h) hoods.set(h.key, h); }
  for (const h of hoods.values()) {
    for (const [i, j] of blocksOver(h, x0, z0, x1, z1)) {
      const blk = blockPlots(h, i, j), m = centroid(blk.corners);
      if (!blk.plots.length || m[0] < x0 || m[0] >= x1 || m[1] < z0 || m[1] >= z1) continue;
      if (!clearPts(h, [...blk.corners, m])) continue;
      const hs = blk.plots.map((p) => p.h).sort((a, b) => a - b), mid = hs[Math.floor(hs.length / 2)];
      const gable = blk.plots.filter((p) => p.roof !== 'flat').length * 2 > blk.plots.length;
      const st = h.style;
      if (blk.court) {
        // the ring as four runs between the block's outer corners and its court's
        const C = blk.corners, K = blk.court;
        for (let e = 0; e < 4; e++) out.push({ q: [C[e], C[(e + 1) & 3], K[(e + 1) & 3], K[e]], h: mid, gable, wall: st.walls[0], roofTex: st.roof });
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
  const L = fabricCell(r, c), x0 = (c - HALF) * B, z0 = (r - HALF) * B, x1 = x0 + B, z1 = z0 + B, out = [], STEP = 4;
  const inCell = (p) => p[0] >= x0 && p[0] < x1 && p[1] >= z0 && p[1] < z1;
  for (const h of L.hoods) {
    if (h.kind === 'park') continue;
    const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => toFrame(h, x, z));
    for (const axis of [0, 1]) {
      const other = 1 - axis;
      let lo, hi;
      if (h.kind === 'polar') {
        const am = pts[0][0], as = pts.map(([a]) => am + Math.atan2(Math.sin(a - am), Math.cos(a - am)));
        [lo, hi] = axis === 0 ? [Math.min(...as) - h.spoke0, Math.max(...as) - h.spoke0] : [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
      } else [lo, hi] = [Math.min(...pts.map((p) => p[axis])) - (h.warp ?? 0), Math.max(...pts.map((p) => p[axis])) + (h.warp ?? 0)];
      const [i0, i1] = lineRange(h, axis, lo, hi);
      // the other coordinate's span over the cell
      const os = pts.map((p) => p[other]);
      for (let i = i0; i <= i1; i++) {
        const line = lineOf(h, axis, i);
        if (!(line.w > ALLEY + 0.01)) continue;
        let run = null;
        const emit = () => { if (run && run.n > 1) out.push({ a: run.a, b: run.b, w: line.w, kind: streetKind(line.w), hood: h.key, axis, line: i }); run = null; };
        const [oLo, oHi] = h.kind === 'polar' && axis === 1
          ? (() => { const am = pts[0][0], as = pts.map(([a]) => am + Math.atan2(Math.sin(a - am), Math.cos(a - am))); return [Math.min(...as), Math.max(...as)]; })()
          : [Math.min(...os) - (h.warp ?? 0), Math.max(...os) + (h.warp ?? 0)];
        const steps = h.kind === 'polar' && axis === 1 ? Math.ceil(((oHi - oLo) * Math.max(1, line.at)) / STEP) : Math.ceil((oHi - oLo) / STEP);
        for (let k = 0; k <= steps; k++) {
          const o = oLo + ((oHi - oLo) * k) / Math.max(1, steps);
          const p = axis === 0 ? fromFrame(h, line.at, o) : fromFrame(h, o, line.at);
          const ok = inCell(p) && hoodAt(p[0], p[1])?.key === h.key && fabricGroundIn(L, p[0], p[1]) === GROUND.street;
          if (ok) { if (!run) run = { a: p, b: p, n: 1 }; else { run.b = p; run.n++; } } else emit();
        }
        emit();
      }
    }
  }
  return out;
}
