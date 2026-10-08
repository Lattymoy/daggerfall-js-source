// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL1 (2026-10-08, bible/03-World/Tamriel.md) - THE GEOGRAPHY: the whole of Tamriel, authored, on the picture
// grid of world/tamrielFrame.js (320 x 200, Daggerfall's own Tamriel picture's grid; 15.36 km a unit).
//
// THIS IS OURS, AND IT IS DAGGERFALL'S TAMRIEL. The outlines below are drawn by hand from the lore map of
// Daggerfall's day - the continent CreateCharRaceSelect shows (nine provinces, SUMURSET spelled the game's way, the
// Imperial Province for the heart of it) - and not traced off TMAP00I0, which is game data and never ships (the
// Port-Doctrine's RENDER rule; ui/introMap.js is the precedent: authored geography, no raster of the game's). Where
// the lore maps of later games moved a coast, the 1996 shape is kept, because it is the one the Bay's own data joins.
//
// ONE VERTEX, MANY RINGS. Every province is a ring (or rings - an island is a ring of its own) of NAMED vertices, and
// a border is the run of vertices two rings share, spelled in each. That is what makes the topology checkable: an edge
// in ONE ring is coast, an edge in TWO is a border between the two provinces, an edge in three is a mistake, and
// test/tamriel.test.js holds the table to it (`classifyEdges`). The coast is drawn from the rings; the borders from
// BORDERS, the same vertices, so the two cannot disagree.
//
// THE BAY IS A HOLE. The Iliac Bay's own ground (the rectangle bayPictureRect names, about x 46..99, y 52..79 here) is
// WOODS.WLD's, and nothing authored is drawn inside it (ui/tamrielInk.js clips the chains to its edge and joins them
// to the Bay's own coast). The vertices inside the rectangle below (c70..c77, the inlet's rough shape) exist so the
// rings CLOSE and a point-in-province answer is right for the raster; they are never inked.
//
// Coordinates: x east, y south, picture units. Fractions are fine.
// ═══════════════════════════════════════════════════════════════════

import { segmentDistance } from './segment.js';   // a point's distance to a segment - ONE home, a module that imports nothing (the terrain worker reads this one)

/** @typedef {{ x: number, y: number }} Pt */

/** The vertex table. `c` is the mainland's outer coast, in order; `j` the inland junctions where three provinces
 *  meet; `b` the vertices along a border between two; `v`, `s`, `a` the islands. */
export const V = Object.freeze({
  // ── the outer coast, clockwise on the screen (y down): from the Bay's north crossing, north up High Rock's west
  //    coast, east along the Sea of Ghosts, down the Padomaic coast, west along the southern seas, north up
  //    Hammerfell's west coast to the Bay's south crossing, then the inlet itself (inside the Bay's rectangle)
  c01: [60, 52],   // High Rock's coast enters the Bay's rectangle through its north edge
  c02: [56, 47], c03: [50, 42], c04: [46, 36], c05: [49, 31], c06: [56, 28],
  c07: [66, 26], c08: [76, 28], c09: [84, 25], c10: [94, 27], c11: [104, 24], c12: [114, 26],
  c13: [118, 24],   // High Rock / Skyrim, at the sea
  c14: [128, 21], c15: [138, 23], c16: [150, 19], c17: [162, 22], c18: [174, 18], c19: [186, 22], c20: [198, 20],
  c21: [206, 24],   // Skyrim / Morrowind, at the sea
  c22: [222, 24], c23: [226, 34], c24: [232, 46], c25: [240, 56],   // the Inner Sea's west shore
  c26: [254, 60], c27: [268, 56],   // its south shore
  c28: [278, 44], c29: [284, 30], c30: [290, 22],   // its east shore, up to the north-east cape
  c31: [298, 30], c32: [302, 46], c33: [299, 62], c34: [296, 78], c35: [292, 92],   // the Padomaic coast
  c36: [288, 106],   // Morrowind / Black Marsh, at the sea
  c37: [284, 120], c38: [278, 134], c39: [268, 148], c40: [258, 162], c41: [246, 174],
  c42: [234, 180],   // the southern tip
  c43: [222, 176], c44: [214, 166], c45: [212, 160], c46: [206, 148],   // Topal Bay's east shore
  c47: [203, 140],   // Cyrodiil / Black Marsh, at the bay's head
  c48: [196, 142],   // Cyrodiil / Elsweyr, at the bay's head
  c49: [190, 152], c50: [184, 164], c51: [176, 172], c52: [164, 178], c53: [150, 178],
  c54: [142, 172],   // Elsweyr / Valenwood, at the sea
  c55: [134, 176], c56: [122, 180], c57: [108, 178], c58: [96, 172], c59: [84, 162], c60: [80, 148], c61: [84, 134],
  c62: [92, 120],   // Valenwood / Hammerfell, at the Strid's mouth
  c63: [80, 118], c64: [66, 116], c65: [54, 112], c66: [46, 104],   // Hammerfell's south coast, to the cape
  c67: [42, 92], c68: [43, 82],
  c69: [46, 74],   // Hammerfell's coast enters the Bay's rectangle through its west edge
  c70: [54, 73], c71: [66, 71], c72: [78, 68], c73: [90, 66],   // the inlet's south shore (never inked)
  c74: [94, 62],   // the head of the Bay - High Rock / Hammerfell, at the water
  c75: [86, 59], c76: [74, 58], c77: [62, 56],   // the inlet's north shore (never inked)
  // ── the junctions
  j_hr_hf_sk: [116, 60], j_hf_sk_cy: [128, 78], j_sk_cy_mw: [204, 64], j_cy_mw_bm: [236, 104],
  j_cy_el_vw: [150, 128], j_cy_vw_hf: [122, 112],
  // ── the borders' own vertices
  b_hrhf1: [100, 62], b_hrhf2: [108, 61],
  b_hrsk1: [118, 34], b_hrsk2: [116, 46],
  b_hfsk1: [122, 68],
  b_skcy1: [142, 76], b_skcy2: [160, 72], b_skcy3: [178, 68], b_skcy4: [192, 66],
  b_skmw1: [208, 36], b_skmw2: [206, 50],
  b_cymw1: [212, 76], b_cymw2: [222, 88],
  b_mwbm1: [252, 104], b_mwbm2: [270, 106],
  b_cybm1: [226, 116], b_cybm2: [214, 128],
  b_cyel1: [186, 134], b_cyel2: [172, 130], b_cyel3: [160, 128],
  b_elvw1: [146, 144], b_elvw2: [144, 158],
  b_cyvw1: [138, 122],
  b_cyhf1: [130, 90], b_cyhf2: [126, 102],
  b_hfvw1: [108, 116],
  // ── Vvardenfell, in Morrowind's Inner Sea
  v1: [236, 36], v2: [246, 28], v3: [262, 30], v4: [272, 40], v5: [266, 50], v6: [252, 54], v7: [240, 48],
  // ── Sumurset Isle, and Auridon beside it
  s1: [36, 128], s2: [48, 124], s3: [60, 132], s4: [62, 148], s5: [56, 164], s6: [44, 172], s7: [34, 160], s8: [30, 142],
  a1: [64, 120], a2: [72, 116], a3: [74, 128], a4: [66, 132],
});

/** The mainland's outer coast, closed (the first vertex is not repeated). */
export const COAST = Object.freeze([
  'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10', 'c11', 'c12', 'c13',
  'c14', 'c15', 'c16', 'c17', 'c18', 'c19', 'c20', 'c21',
  'c22', 'c23', 'c24', 'c25', 'c26', 'c27', 'c28', 'c29', 'c30', 'c31', 'c32', 'c33', 'c34', 'c35', 'c36',
  'c37', 'c38', 'c39', 'c40', 'c41', 'c42', 'c43', 'c44', 'c45', 'c46', 'c47', 'c48',
  'c49', 'c50', 'c51', 'c52', 'c53', 'c54',
  'c55', 'c56', 'c57', 'c58', 'c59', 'c60', 'c61', 'c62',
  'c63', 'c64', 'c65', 'c66', 'c67', 'c68', 'c69',
  'c70', 'c71', 'c72', 'c73', 'c74', 'c75', 'c76', 'c77',
]);

/** The island coasts, each closed. */
export const ISLANDS = Object.freeze({
  vvardenfell: Object.freeze(['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']),
  sumurset: Object.freeze(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']),
  auridon: Object.freeze(['a1', 'a2', 'a3', 'a4']),
});

/** The borders, each a run of vertices from one end to the other; `between` names the two provinces. A border's
 *  ends are a junction or a coast vertex. */
export const BORDERS = Object.freeze({
  hr_hf: Object.freeze({ between: ['HighRock', 'Hammerfell'], run: ['c74', 'b_hrhf1', 'b_hrhf2', 'j_hr_hf_sk'] }),
  hr_sk: Object.freeze({ between: ['HighRock', 'Skyrim'], run: ['c13', 'b_hrsk1', 'b_hrsk2', 'j_hr_hf_sk'] }),
  hf_sk: Object.freeze({ between: ['Hammerfell', 'Skyrim'], run: ['j_hr_hf_sk', 'b_hfsk1', 'j_hf_sk_cy'] }),
  sk_cy: Object.freeze({ between: ['Skyrim', 'Imperial'], run: ['j_hf_sk_cy', 'b_skcy1', 'b_skcy2', 'b_skcy3', 'b_skcy4', 'j_sk_cy_mw'] }),
  sk_mw: Object.freeze({ between: ['Skyrim', 'Morrowind'], run: ['c21', 'b_skmw1', 'b_skmw2', 'j_sk_cy_mw'] }),
  cy_mw: Object.freeze({ between: ['Imperial', 'Morrowind'], run: ['j_sk_cy_mw', 'b_cymw1', 'b_cymw2', 'j_cy_mw_bm'] }),
  mw_bm: Object.freeze({ between: ['Morrowind', 'BlackMarsh'], run: ['j_cy_mw_bm', 'b_mwbm1', 'b_mwbm2', 'c36'] }),
  cy_bm: Object.freeze({ between: ['Imperial', 'BlackMarsh'], run: ['j_cy_mw_bm', 'b_cybm1', 'b_cybm2', 'c47'] }),
  cy_el: Object.freeze({ between: ['Imperial', 'Elsweyr'], run: ['c48', 'b_cyel1', 'b_cyel2', 'b_cyel3', 'j_cy_el_vw'] }),
  el_vw: Object.freeze({ between: ['Elsweyr', 'Valenwood'], run: ['j_cy_el_vw', 'b_elvw1', 'b_elvw2', 'c54'] }),
  cy_vw: Object.freeze({ between: ['Imperial', 'Valenwood'], run: ['j_cy_el_vw', 'b_cyvw1', 'j_cy_vw_hf'] }),
  cy_hf: Object.freeze({ between: ['Imperial', 'Hammerfell'], run: ['j_hf_sk_cy', 'b_cyhf1', 'b_cyhf2', 'j_cy_vw_hf'] }),
  hf_vw: Object.freeze({ between: ['Hammerfell', 'Valenwood'], run: ['j_cy_vw_hf', 'b_hfvw1', 'c62'] }),
});

/** The run of the outer coast from one vertex to another, inclusive, in the coast's own order (wrapping). */
export function coastRun(from, to) {
  const i = COAST.indexOf(from), j = COAST.indexOf(to);
  if (i < 0 || j < 0) throw new Error(`coastRun: ${from} or ${to} is not on the coast`);
  const out = [];
  for (let k = i; ; k = (k + 1) % COAST.length) { out.push(COAST[k]); if (k === j) break; }
  return out;
}
const rev = (names) => names.slice().reverse();
/** Join runs that share their end vertices, dropping the repeat at each join and a closing repeat at the end. */
function ring(...runs) {
  const out = [];
  for (const r of runs) for (const n of r) if (out[out.length - 1] !== n) out.push(n);
  if (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
  return Object.freeze(out);
}
const B = (k) => BORDERS[k].run;

/**
 * THE NINE PROVINCES. `key` is TAMRIEL2's race word where there is one and `Imperial` for the ninth
 * (ui/provinceMap.js INERT_REGION); `name` is the picture's own label, SUMURSET and all (its PROVINCE_NAMES);
 * `climate` is the CLIMATE.PAK value the raster lays on the province's ground (formats/mapsTables.js CLIMATES);
 * `label` where the name sits; `rings` the land.
 */
export const PROVINCES = Object.freeze([
  Object.freeze({
    key: 'HighRock', name: 'High Rock', race: 'Breton', climate: 231, label: [82, 38],
    rings: Object.freeze([ring(coastRun('c01', 'c13'), B('hr_sk'), rev(B('hr_hf')), coastRun('c74', 'c77'))]),
  }),
  Object.freeze({
    key: 'Hammerfell', name: 'Hammerfell', race: 'Redguard', climate: 224, label: [84, 96],
    rings: Object.freeze([ring(coastRun('c62', 'c74'), B('hr_hf').slice(1), B('hf_sk'), B('cy_hf'), B('hf_vw'))]),
  }),
  Object.freeze({
    key: 'Skyrim', name: 'Skyrim', race: 'Nord', climate: 226, label: [166, 48],
    rings: Object.freeze([ring(coastRun('c13', 'c21'), B('sk_mw'), rev(B('sk_cy')), rev(B('hf_sk')), rev(B('hr_sk')))]),
  }),
  Object.freeze({
    key: 'Morrowind', name: 'Morrowind', race: 'DarkElf', climate: 230, label: [262, 82],
    rings: Object.freeze([ring(coastRun('c21', 'c36'), rev(B('mw_bm')), rev(B('cy_mw')), rev(B('sk_mw'))), ISLANDS.vvardenfell]),
  }),
  Object.freeze({
    key: 'Imperial', name: 'Imperial Province', race: null, climate: 231, label: [172, 124],
    rings: Object.freeze([ring(B('sk_cy'), B('cy_mw'), B('cy_bm'), coastRun('c47', 'c48'), B('cy_el'), B('cy_vw'), rev(B('cy_hf')))]),
  }),
  Object.freeze({
    key: 'BlackMarsh', name: 'Black Marsh', race: 'Argonian', climate: 228, label: [250, 140],
    rings: Object.freeze([ring(coastRun('c36', 'c47'), rev(B('cy_bm')), B('mw_bm'))]),
  }),
  Object.freeze({
    key: 'Elsweyr', name: 'Elsweyr', race: 'Khajiit', climate: 225, label: [170, 156],
    rings: Object.freeze([ring(coastRun('c48', 'c54'), rev(B('el_vw')), rev(B('cy_el')))]),
  }),
  Object.freeze({
    key: 'Valenwood', name: 'Valenwood', race: 'WoodElf', climate: 227, label: [112, 160],
    rings: Object.freeze([ring(coastRun('c54', 'c62'), rev(B('hf_vw')), rev(B('cy_vw')), B('el_vw'))]),
  }),
  Object.freeze({
    key: 'Sumurset', name: 'Sumurset Isle', race: 'HighElf', climate: 229, label: [44, 146],
    rings: Object.freeze([ISLANDS.sumurset, ISLANDS.auridon]),
  }),
]);

/** The mountains: a spine (picture units) and a half-width `w`; `gain` how high the raster lifts the ridge
 *  (1 = the snowline). The Wrothgarians and the Dragontails begin inside the Bay's rectangle, where WOODS.WLD
 *  already stands them; only their reach past its edge is drawn. */
export const MOUNTAIN_RANGES = Object.freeze([
  Object.freeze({ name: 'Wrothgarian Mountains', w: 4, gain: 1.0, pts: [[96, 58], [108, 54], [116, 50]] }),
  Object.freeze({ name: 'Dragontail Mountains', w: 4, gain: 0.95, pts: [[90, 74], [104, 80], [116, 90]] }),
  Object.freeze({ name: 'Druadach Mountains', w: 3, gain: 0.9, pts: [[114, 30], [116, 44], [118, 58]] }),
  Object.freeze({ name: 'The Reach', w: 3, gain: 0.7, pts: [[124, 34], [134, 46]] }),
  Object.freeze({ name: 'Throat of the World', w: 4, gain: 1.0, pts: [[150, 36], [164, 42], [176, 40]] }),
  Object.freeze({ name: 'Jerall Mountains', w: 3.5, gain: 1.0, pts: [[134, 78], [160, 74], [184, 70], [200, 66]] }),
  Object.freeze({ name: 'Velothi Mountains', w: 3, gain: 0.9, pts: [[208, 28], [210, 44], [206, 58]] }),
  Object.freeze({ name: 'Valus Mountains', w: 3, gain: 0.9, pts: [[206, 68], [216, 82], [226, 96]] }),
  Object.freeze({ name: 'Colovian Highlands', w: 3, gain: 0.6, pts: [[132, 92], [140, 104]] }),
  Object.freeze({ name: 'Red Mountain', w: 4, gain: 1.0, pts: [[250, 38], [256, 42]] }),
  Object.freeze({ name: 'Eton Nir', w: 3, gain: 0.8, pts: [[46, 144], [50, 150]] }),
  Object.freeze({ name: 'Tenmar Hills', w: 2.5, gain: 0.4, pts: [[156, 140], [170, 146]] }),
]);

/** The great rivers, source to mouth. The Bjoulsae is the Bay's own and stands in WOODS.WLD. */
export const RIVERS = Object.freeze([
  Object.freeze({ name: 'Niben', pts: [[178, 92], [186, 104], [194, 118], [198, 132], [200, 140]] }),
  Object.freeze({ name: 'White River', pts: [[156, 46], [166, 40], [178, 34], [186, 24]] }),
  Object.freeze({ name: 'Karth', pts: [[128, 44], [132, 32], [136, 24]] }),
  Object.freeze({ name: 'Strid', pts: [[130, 120], [112, 118], [96, 120]] }),
  Object.freeze({ name: 'Xylo', pts: [[144, 150], [140, 166], [138, 176]] }),
  Object.freeze({ name: 'Thir', pts: [[236, 92], [252, 84], [268, 74], [296, 78]] }),
]);

/** The seas, where their names sit. */
export const SEAS = Object.freeze([
  Object.freeze({ name: 'Eltheric Ocean', at: [22, 88] }),
  Object.freeze({ name: 'Sea of Ghosts', at: [170, 10] }),
  Object.freeze({ name: 'Padomaic Ocean', at: [298, 126] }),
  Object.freeze({ name: 'Abecean Sea', at: [72, 150] }),
  Object.freeze({ name: 'Topal Bay', at: [200, 157] }),
  Object.freeze({ name: 'Inner Sea', at: [259, 57] }),
]);

/** The cities beyond the Bay - each province's capital and its great towns, as the lore of Daggerfall's day names
 *  them. A city INSIDE the Bay's rectangle (Daggerfall, Sentinel, Wayrest and the rest) is MAPS.BSA's and is not here.
 *  `capital` marks the seat the continent shows at any zoom. */
/** @type {ReadonlyArray<Readonly<{ name: string, province: string, at: number[], capital?: boolean }>>} */
export const CITIES = Object.freeze([
  // High Rock, north of the Bay
  { name: 'Northpoint', province: 'HighRock', at: [62, 30] },
  { name: 'Farrun', province: 'HighRock', at: [84, 28] },
  { name: 'Jehanna', province: 'HighRock', at: [104, 28] },
  { name: 'Shornhelm', province: 'HighRock', at: [96, 40] },
  { name: 'Evermore', province: 'HighRock', at: [104, 58] },
  // Hammerfell, south and east of the Bay
  { name: 'Hegathe', province: 'Hammerfell', at: [50, 100], capital: true },
  { name: 'Elinhir', province: 'Hammerfell', at: [124, 86] },
  { name: 'Dragonstar', province: 'Hammerfell', at: [112, 70] },
  { name: 'Skaven', province: 'Hammerfell', at: [92, 92] },
  { name: 'Taneth', province: 'Hammerfell', at: [80, 113] },
  { name: 'Gilane', province: 'Hammerfell', at: [66, 110] },
  { name: 'Rihad', province: 'Hammerfell', at: [90, 116] },
  // Skyrim
  { name: 'Solitude', province: 'Skyrim', at: [136, 26], capital: true },
  { name: 'Windhelm', province: 'Skyrim', at: [186, 26] },
  { name: 'Whiterun', province: 'Skyrim', at: [160, 44] },
  { name: 'Riften', province: 'Skyrim', at: [190, 62] },
  { name: 'Winterhold', province: 'Skyrim', at: [178, 22] },
  { name: 'Markarth', province: 'Skyrim', at: [124, 48] },
  { name: 'Falkreath', province: 'Skyrim', at: [156, 66] },
  { name: 'Dawnstar', province: 'Skyrim', at: [156, 22] },
  { name: 'Morthal', province: 'Skyrim', at: [142, 36] },
  // Morrowind
  { name: 'Mournhold', province: 'Morrowind', at: [250, 92], capital: true },
  { name: 'Blacklight', province: 'Morrowind', at: [216, 30] },
  { name: 'Necrom', province: 'Morrowind', at: [296, 60] },
  { name: 'Ebonheart', province: 'Morrowind', at: [248, 62] },
  { name: 'Tear', province: 'Morrowind', at: [280, 100] },
  { name: "Ald'ruhn", province: 'Morrowind', at: [246, 40] },
  { name: 'Vivec', province: 'Morrowind', at: [252, 49] },
  // the Imperial Province
  { name: 'Imperial City', province: 'Imperial', at: [178, 96], capital: true },
  { name: 'Anvil', province: 'Imperial', at: [138, 112] },
  { name: 'Kvatch', province: 'Imperial', at: [148, 108] },
  { name: 'Skingrad', province: 'Imperial', at: [156, 102] },
  { name: 'Chorrol', province: 'Imperial', at: [158, 88] },
  { name: 'Bruma', province: 'Imperial', at: [170, 78] },
  { name: 'Cheydinhal', province: 'Imperial', at: [200, 90] },
  { name: 'Bravil', province: 'Imperial', at: [194, 118] },
  { name: 'Leyawiin', province: 'Imperial', at: [200, 136] },
  // Black Marsh
  { name: 'Helstrom', province: 'BlackMarsh', at: [254, 128], capital: true },
  { name: 'Stormhold', province: 'BlackMarsh', at: [232, 114] },
  { name: 'Gideon', province: 'BlackMarsh', at: [214, 134] },
  { name: 'Blackrose', province: 'BlackMarsh', at: [244, 150] },
  { name: 'Lilmoth', province: 'BlackMarsh', at: [254, 158] },
  { name: 'Soulrest', province: 'BlackMarsh', at: [232, 170] },
  { name: 'Archon', province: 'BlackMarsh', at: [278, 124] },
  { name: 'Thorn', province: 'BlackMarsh', at: [280, 108] },
  // Elsweyr
  { name: 'Torval', province: 'Elsweyr', at: [156, 168], capital: true },
  { name: 'Senchal', province: 'Elsweyr', at: [178, 168] },
  { name: 'Riverhold', province: 'Elsweyr', at: [158, 134] },
  { name: 'Dune', province: 'Elsweyr', at: [154, 150] },
  { name: 'Rimmen', province: 'Elsweyr', at: [184, 134] },
  { name: 'Orcrest', province: 'Elsweyr', at: [170, 140] },
  { name: 'Corinthe', province: 'Elsweyr', at: [166, 152] },
  // Valenwood
  { name: 'Falinesti', province: 'Valenwood', at: [118, 150], capital: true },
  { name: 'Elden Root', province: 'Valenwood', at: [132, 160] },
  { name: 'Silvenar', province: 'Valenwood', at: [140, 136] },
  { name: 'Haven', province: 'Valenwood', at: [124, 176] },
  { name: 'Woodhearth', province: 'Valenwood', at: [90, 160] },
  { name: 'Southpoint', province: 'Valenwood', at: [112, 176] },
  { name: 'Arenthia', province: 'Valenwood', at: [136, 132] },
  // Sumurset Isle
  { name: 'Alinor', province: 'Sumurset', at: [38, 154], capital: true },
  { name: 'Cloudrest', province: 'Sumurset', at: [56, 138] },
  { name: 'Dusk', province: 'Sumurset', at: [52, 162] },
  { name: 'Lillandril', province: 'Sumurset', at: [36, 134] },
  { name: 'Shimmerene', province: 'Sumurset', at: [46, 128] },
  { name: 'Sunhold', province: 'Sumurset', at: [50, 166] },
  { name: 'Firsthold', province: 'Sumurset', at: [68, 120] },
  { name: 'Skywatch', province: 'Sumurset', at: [70, 128] },
].map((c) => Object.freeze(c)));

// ── THE TOPOLOGY ─────────────────────────────────────────────────

/** A vertex's point. Throws on a name the table lacks - a misspelt ring is a hole in the continent. */
export function pt(name) {
  const p = V[name];
  if (!p) throw new Error(`tamrielGeography: no vertex ${name}`);
  return { x: p[0], y: p[1] };
}
/** A run of names as points. */
export const pts = (names) => names.map(pt);
/** A ring as points, CLOSED (the first point repeated last) - the shape a chain painter and a scanline fill want. */
export const closedRing = (names) => { const r = pts(names); r.push({ ...r[0] }); return r; };

/** A province by its key, or null. */
export const provinceByKey = (key) => PROVINCES.find((p) => p.key === key) ?? null;

/**
 * Every edge of every ring, classified: the undirected edge `a|b` with the keys of the provinces whose rings carry
 * it. An edge of ONE ring is coast, of TWO a border; anything else is an authoring error, and the pins say so.
 * @returns {{ coast: Map<string, string>, border: Map<string, string[]>, bad: string[] }}
 */
export function classifyEdges(provinces = PROVINCES) {
  /** @type {Map<string, string[]>} */
  const owners = new Map();
  for (const p of provinces) {
    for (const r of p.rings) {
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!owners.has(k)) owners.set(k, []);
        owners.get(k).push(p.key);
      }
    }
  }
  const coast = new Map(), border = new Map(), bad = [];
  for (const [k, o] of owners) {
    if (o.length === 1) coast.set(k, o[0]);
    else if (o.length === 2 && o[0] !== o[1]) border.set(k, o);
    else bad.push(`${k}: ${o.join(',')}`);
  }
  return { coast, border, bad };
}

/** Point in a closed ring (even-odd), picture units. */
export function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Each province's rings as points, built once. */
let _provinceRings = null;
export function provinceRings() {
  if (!_provinceRings) _provinceRings = PROVINCES.map((p) => ({ key: p.key, name: p.name, rings: p.rings.map((r) => pts(r)) }));
  return _provinceRings;
}
/** The province under a picture-grid point, or null at sea. */
export function provinceAt(x, y) {
  for (const p of provinceRings()) for (const r of p.rings) if (inRing(r, x, y)) return p;
  return null;
}
/** The sea nearest a picture-grid point - the open water is named by its nearest name. */
export function seaAt(x, y) {
  let best = null, bd = Infinity;
  for (const s of SEAS) {
    const d = Math.hypot(s.at[0] - x, s.at[1] - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
/** The coast's edges as point pairs, built once: every edge of one ring (classifyEdges' coast), the islands' too. */
let _coastEdges = null;
export function coastEdges() {
  if (!_coastEdges) {
    _coastEdges = [];
    for (const k of classifyEdges().coast.keys()) { const [a, b] = k.split('|'); _coastEdges.push([pt(a), pt(b)]); }
  }
  return _coastEdges;
}
/** How far a picture-grid point stands from the nearest coast, picture units (15.36 km each). */
export function coastDistance(x, y) {
  let best = Infinity;
  for (const [a, b] of coastEdges()) { const d = segmentDistance(x, y, a.x, a.y, b.x, b.y); if (d < best) best = d; }
  return best;
}
/** The mountains' lift at a picture-grid point: the strongest range whose band holds it, 0..1 (its gain at the
 *  spine, nothing at the band's edge); 0 off every band. */
export function rangeLift(x, y) {
  let lift = 0;
  for (const rg of MOUNTAIN_RANGES) {
    let d = Infinity;
    for (let i = 0; i + 1 < rg.pts.length; i++) {
      const dd = segmentDistance(x, y, rg.pts[i][0], rg.pts[i][1], rg.pts[i + 1][0], rg.pts[i + 1][1]);
      if (dd < d) d = dd;
    }
    if (d < rg.w) lift = Math.max(lift, rg.gain * (1 - d / rg.w));
  }
  return lift;
}

/** The bounds of the authored land on the picture grid - the probe and the pins read them. */
export function landBounds() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of PROVINCES) for (const r of p.rings) for (const n of r) {
    const q = pt(n);
    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
  }
  return { x0, y0, x1, y1 };
}
