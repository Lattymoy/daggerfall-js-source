// WD3 (2026-10-01): THE PIECES BEAUTIFUL VILLAGES AND BEAUTIFUL CITIES BORROW, STOOD IN BY THE PORT.
//
// The two town mods are world data (src/formats/worldDataPack.js), and their blocks place pieces of five peer mods
// the port does not carry - Daggerfall Expanded Textures, Diep's Rosy's Resources, New Paintings, the RMB Resource
// Pack and DET's Harvestable Crops - and eighteen beds of their own whose prefabs point at nothing (their meshes and
// textures are Daggerfall's, recoloured). Mac's answer for a peer the port lacks was "Build your own" (DS1), and the
// handover asks it again: "For anything missing I need you to curate, like textures". So each piece here is the
// PORT'S OWN, made for the places the author put it - read off the placements (thousands for most ids: where they
// stand, how they turn, what they stand beside, how far from the wall) and the catalogues' names - never a copy of a
// peer's file, which the port has never had. Daggerfall Unity without the peers draws nothing at all where these
// stand; the port draws its stand-ins.
//
//   - the BEDS (42069-42086): Daggerfall's own beds out of the player's ARCH3D under bedclothes recoloured in code
//     (an alias, world/customModels.js);
//   - the PAINTINGS (Rosy's 69420-69464, New Paintings 79010-79030): Daggerfall's own framed paintings - the six of the
//     Interior_Paintings set (twenty-four pictures across the climates), which the climate swap changes from region to region as it does a classic wall's -
//     on a frame hung where each id hangs;
//   - DET's pieces, shared with Detailed Ships: world/detStandIns.js;
//   - Cliffworms' Items (archive 1210 - his bottles, and the classic pieces he moved there): Detailed Ships' pictures of
//     them, by the same author and carried with his leave, shared (systems/detailedShips.js);
//   - the cloth and the drawn sprites: world/townPictures.js, world/standInSprites.js.
//
// All of it stands behind the town mods' own load (scenes/modWorldData.js installs it when a town pack is opened -
// for the game, or for a save whose towns are pinned to it), and costs a game that has neither mod nothing.

import { registerCustomModel, registerModelAlias } from './customModels.js';
import { addVendorTextures } from '../systems/textureReplacement.js';
import { buildDerivedPicture } from '../formats/derivedTexture.js';
import { installDetStandIns, MeshBuilder } from './detStandIns.js';
import { TOWN_PICTURE_ARCHIVE, PICTURE } from './townPictures.js';
import { registerFlatField } from './flatFields.js';
import { shareDetailedShipsArt } from '../systems/detailedShips.js';   // Cliffworms' Items (archive 1210): his pictures, the towns' too

const U = 0.025;   // MeshReader.GlobalScale: one classic unit in metres

// ---- the beds ---------------------------------------------------------------------------------------------------
export const TOWN_BED_FIRST = 42069;
export const TOWN_BED_COUNT = 18;
/** The port's archive of recoloured bedclothes: record `colour * 3 + cloth`. */
export const TOWN_BED_ARCHIVE = 38201;
/** Daggerfall's three beds, as the eighteen take them: `42069 + 3k` is a 41000, `+ 1` a 41001, `+ 2` a 41002 - read off
 *  the placements, whose origins stand 10, 9 and 41 units over the floor exactly as the three beds' own do. */
export const TOWN_BED_MODELS = Object.freeze([41000, 41001, 41002]);
/** The bedclothes every one of the three wears: TEXTURE.090 records 5 (the cover), 6 (its side) and 7 (its foot). */
export const TOWN_BEDCLOTHS = Object.freeze([5, 6, 7]);
/** The six colours, in the bundle's order (its textures are 5-1B, -1Br, -1G, -1O, -1P, -1Y): the green cloth's hue set
 *  to `hue`, its saturation and value multiplied - measured off the author's recoloured textures, three numbers each
 *  (the pictures themselves are game data, which the port never carries). */
export const TOWN_BED_COLOURS = Object.freeze([
  Object.freeze({ name: 'blue', hue: 213.6, sat: 1.758, val: 1.536 }),
  Object.freeze({ name: 'brown', hue: 28.3, sat: 2.505, val: 1.144 }),
  Object.freeze({ name: 'grey', hue: 0, sat: 0, val: 0.969 }),
  Object.freeze({ name: 'orange', hue: 15.1, sat: 2.596, val: 1.818 }),
  Object.freeze({ name: 'purple', hue: 315.7, sat: 1.023, val: 1.138 }),
  Object.freeze({ name: 'yellow', hue: 50.6, sat: 2.788, val: 1.425 }),
]);
/** A town bed id's classic bed and colour, or null. */
export function townBedOf(id) {
  const k = Number(id) - TOWN_BED_FIRST;
  if (!Number.isInteger(k) || k < 0 || k >= TOWN_BED_COUNT) return null;
  return { model: TOWN_BED_MODELS[k % 3], colour: Math.floor(k / 3) };
}
export const bedclothRecord = (colour, cloth) => colour * 3 + cloth;

const hsvOf = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
};
const rgbOf = (h, s, v) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};
/** The green of Daggerfall's bedclothes (and not the white of the sheet or the brown of the frame they share a picture
 *  with): measured, the cloth's own pixels sit at hue 114-118, saturation 0.32-0.37. */
export const isBedclothGreen = (h, s) => s > 0.18 && h > 70 && h < 170;
/** A classic bedcloth picture (top-down RGBA) in one of the six colours - the green recoloured, all else kept, opaque
 *  (a mesh's material draws no cut-out). */
export function recolourBedcloth(src, colour) {
  const out = new Uint8Array(src.width * src.height * 4);
  for (let i = 0; i < src.width * src.height * 4; i += 4) {
    let r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
    const [h, s, v] = hsvOf(r, g, b);
    if (isBedclothGreen(h, s)) [r, g, b] = rgbOf(colour.hue, Math.min(1, s * colour.sat), Math.min(1, v * colour.val));
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
  }
  return { width: src.width, height: src.height, data: out };
}
const bedRemap = (colour) => Object.fromEntries(TOWN_BEDCLOTHS.map((rec, cloth) => [`90_${rec}`, [TOWN_BED_ARCHIVE, bedclothRecord(colour, cloth)]]));

// ---- the paintings ----------------------------------------------------------------------------------------------
/** Daggerfall's framed paintings: TEXTURE.048's six (the Interior_Paintings set - the climate swap answers 148, 348 or
 *  448 in their regions, twenty-four pictures in all), with their sizes in pixels, a pixel a classic unit. */
export const CLASSIC_PAINTINGS = Object.freeze([[0, 50, 31], [1, 45, 37], [2, 38, 27], [3, 41, 30], [4, 23, 26], [5, 21, 22]]);
/** How each painting id hangs, measured on its placements (every one within two units of a wall):
 *  'V' - upright, facing +Z (no rotation but its turn on the wall);
 *  'Y' - upright in the YZ plane facing -X, turned a quarter in that plane by the author's X rotation (-1536), so its
 *        picture's top lies along +Z ('Yup' - 79011, mostly hung unturned - has it along +Y);
 *  'H' - lying face down, stood up by the X rotation, its top along +Z.
 *  The few placements of a mixed id that turn it the other way (69432, 69445 - 144 of 9,600) hang as its majority does. */
export const TOWN_PAINTINGS = Object.freeze(Object.fromEntries([
  ...[69424, 69426, 69428, 69429, 69431, 69432, 69435, 69436, 69437, 69440, 69441, 69444, 69445, 69446, 69447, 69448, 69449, 69450,
    69451, 69452, 69453, 69454, 69455, 69456, 69457, 69458, 69459, 69460, 69461, 69463, 69464,
    79014, 79016, 79018, 79019, 79021, 79025, 79026, 79027, 79028, 79029, 79030].map((id) => [id, 'V']),
  ...[69420, 69421, 69422, 69423, 69425, 69427, 79010, 79012, 79013, 79015, 79017].map((id) => [id, 'Y']),
  [79011, 'Yup'],
  ...[69430, 69433, 69434, 69462, 79020, 79022, 79023, 79024].map((id) => [id, 'H']),
].sort((a, b) => a[0] - b[0]).map(([id, hang], k) => [id, Object.freeze({ hang, picture: k % 6, mirror: Math.floor(k / 6) % 2 === 1 })])));

const FRAME_BACK = [0, 46];   // #423629 - the back and edges of a frame
/** A painting's model: the classic picture (frame and all) on the face, a thin dark board behind it, the origin at the
 *  middle of the back - two units off the wall, as the placements stand. */
export function paintingModel({ hang, picture, mirror }) {
  const [record, pw, ph] = CLASSIC_PAINTINGS[picture];
  const w = pw * U, h = ph * U, back = 2 * U, m = new MeshBuilder(), tex = [48, record];
  // the face in the model's own frame, built upright facing +Z, then laid as the hang needs
  const u0 = mirror ? 1 : 0, u1 = mirror ? 0 : 1;
  const face = [[w / 2, h / 2, 0], [-w / 2, h / 2, 0], [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0]];   // top-left, top-right, bottom-right, bottom-left from the front
  const uvs = [[u0, 0], [u1, 0], [u1, -1], [u0, -1]];
  // (rotations, never a mirror: the X rotation the author gives a 'Y' or an 'H' piece, (x, y, z) -> (x, z, -y), brings
  // each upright, facing out, its left edge on the viewer's left)
  const lay = hang === 'V' ? (p) => p                         // upright, facing +Z
    : hang === 'Yup' ? ([x, y, z]) => [-z, y, x]             // facing -X, top along +Y
    : hang === 'Y' ? ([x, y, z]) => [-z, -x, y]              // facing -X, top along +Z
    : ([x, y, z]) => [x, -z, y];                             // 'H': facing -Y, top along +Z
  const n = lay([0, 0, 1]);
  const P = face.map(lay);
  m.quad(tex, P[0], P[1], P[2], P[3], n, uvs);
  // the board: the four edges and the back, two units deep behind the face
  const off = (p) => lay([p[0], p[1], -back]);
  const B = face.map(off);
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4], c = B[(i + 1) % 4], d = B[i];
    const mid = lay([(face[i][0] + face[(i + 1) % 4][0]) / 2, (face[i][1] + face[(i + 1) % 4][1]) / 2, 0]), l = Math.hypot(...mid) || 1;
    m.quad(FRAME_BACK, a, b, c, d, [mid[0] / l, mid[1] / l, mid[2] / l]);
  }
  m.quad(FRAME_BACK, B[3], B[2], B[1], B[0], [-n[0], -n[1], -n[2]]);
  return m.build();
}

// ---- Rosy's other pieces -------------------------------------------------------------------------------------------
/** Small hangings (69467-69469: two units off a wall, either face out, mostly at half scale) - cloth on a rod. */
function smallHanging(k) {
  const m = new MeshBuilder(), tex = [TOWN_PICTURE_ARCHIVE, PICTURE.smallHanging(k)], w = 0.4, h = 0.6, z = 0.004;
  for (const side of [1, -1]) {
    const L = (w / 2) * side, n = [0, 0, side];
    m.quad(tex, [L, 0, z * side], [-L, 0, z * side], [-L, -h, z * side], [L, -h, z * side], n, [[0, 0], [1, 0], [1, -1], [0, -1]]);
  }
  m.cylinderX([67, 0], [-w / 2 - 0.03, 0, 0], 0.012, w + 0.06, 6);
  return m.build();
}
/** A rug (69471 and 69472 are laid as a pair, one of them turned over under the floor): its picture on top. */
function rug(k) {
  const m = new MeshBuilder(), tex = [TOWN_PICTURE_ARCHIVE, PICTURE.rug(k)], hw = 0.8, hd = 0.5, t = 0.012;
  m.quad(tex, [hw, t, -hd], [-hw, t, -hd], [-hw, t, hd], [hw, t, hd], [0, 1, 0], [[0, 0], [1, 0], [1, -1], [0, -1]]);
  m.quad([0, 45], [hw, 0, hd], [-hw, 0, hd], [-hw, 0, -hd], [hw, 0, -hd], [0, -1, 0]);
  return m.build();
}
export const ROSYS_PIECES = Object.freeze({
  69467: () => smallHanging(0), 69468: () => smallHanging(1), 69469: () => smallHanging(2),
  69471: () => rug(2), 69472: () => rug(3),
});

// ---- the RMB Resource Pack's crop fields ----------------------------------------------------------------------
/** The four crop prefabs Beautiful Cities lays over its farmland (RMBCropBillboardBatch's own parameters on each:
 *  a grid `rangeX` by `rangeZ` metres, gridDensity 0.25 at the default CropDensity of 10 - a plant every 4 metres -
 *  each nudged up to half a metre; world/flatFields.js sows them). */
export const TOWN_CROP_FIELDS = Object.freeze({
  53211: Object.freeze({ rangeX: 85, rangeZ: 85, spacing: 4, noise: 0.5 }),
  53212: Object.freeze({ rangeX: 35, rangeZ: 85, spacing: 4, noise: 0.5 }),
  53213: Object.freeze({ rangeX: 85, rangeZ: 35, spacing: 4, noise: 0.5 }),
  53214: Object.freeze({ rangeX: 35, rangeZ: 35, spacing: 4, noise: 0.5 }),
});

// ---- the RMB Resource Pack's scene pieces -----------------------------------------------------------------------
/** The rocks Beautiful Villages and Beautiful Cities scatter round their buildings: [width, height above the origin,
 *  depth below it, length] in metres - the pack's own meshes measured (centimetre FBX, as Daggerfall Unity reads the
 *  mesh its prefab names). Each stands in as a boulder of the climate's rock (302_3, swapped by climate). */
export const RMBRP_ROCKS = Object.freeze({
  53006: [0.54, 0.33, 0.12, 0.59], 53012: [0.85, 0.28, 0.13, 0.54], 53014: [1.11, 0.35, 0, 0.98], 53017: [0.58, 0.64, 0, 0.86],
  53020: [1.56, 0.96, 0, 1.3], 53023: [1.37, 0.52, 0.25, 1.19], 53029: [0.58, 0.17, 0.09, 0.55], 53030: [0.56, 0.17, 0.07, 0.42],
  53031: [0.53, 0.18, 0.09, 0.46], 53032: [1.01, 0.22, 0.12, 1.05], 53033: [0.66, 0.12, 0.1, 0.65], 53035: [0.76, 0.41, 0.4, 0.59],
  53036: [0.68, 0.54, 0.1, 0.61], 53037: [1.97, 0.71, 0.14, 1.73], 53038: [1.82, 0.47, 0.18, 1.49], 53039: [2.29, 0.66, 0.16, 1.6],
  53040: [2.22, 0.52, 0.19, 2.51], 53042: [2.03, 0.22, 0.11, 2.22], 53054: [0.89, 0.13, 0, 0.57], 53064: [0.79, 0.37, 0, 0.85],
  53083: [0.77, 0.13, 0, 0.5], 53085: [0.66, 0.14, 0, 0.64], 53086: [2.2, 0.56, 0, 1.26],
});
const ROCK = [302, 3], GRASS = [302, 2];
/** A boulder: an eight-sided lump, its rim and crown pushed in and out by a seed, `w` x `l` across, `up` above its origin
 *  and `down` below. */
export function boulderMesh(w, up, down, l, seed) {
  const m = new MeshBuilder(), N = 8;
  let h = seed >>> 0;
  const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (h & 0xffff) / 0xffff; };
  const ring = (y, k) => Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2, r = k * (0.82 + rnd() * 0.3); return [Math.cos(a) * (w / 2) * r, y, Math.sin(a) * (l / 2) * r]; });
  const base = ring(-Math.max(down, 0.05), 0.92), mid = ring(up * 0.45, 1), top = ring(up * 0.85, 0.62), crown = [0, up, 0], foot = [0, -Math.max(down, 0.05), 0];
  const face = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l2 = Math.hypot(...n) || 1; m.tri(ROCK, a, b, c, [n[0] / l2, n[1] / l2, n[2] / l2], [a[0], -a[1]], [b[0], -b[1]], [c[0], -c[1]]); };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (const [lo, hi] of [[base, mid], [mid, top]]) { face(lo[i], hi[j], hi[i]); face(lo[i], lo[j], hi[j]); }
    face(top[i], crown, top[j]);
    face(base[j], base[i], foot);
  }
  return m.build();
}
/** The pack's hills, by its catalogue's size and surface: [radius, height] in metres and grass or rock. */
export const RMBRP_HILLS = Object.freeze({
  52012: [3, 1.2, 'grass'], 52018: [10, 3.5, 'grass'], 52022: [3, 1.2, 'grass'], 52025: [6, 2.2, 'grass'], 52028: [10, 3.5, 'grass'],
  52035: [6, 2.2, 'grass'], 52058: [10, 3.5, 'grass'], 52458: [10, 1.6, 'grass'], 52463: [3, 0.6, 'rock'], 52508: [10, 1.6, 'grass'],
  52543: [3, 0.6, 'rock'], 52548: [10, 1.6, 'grass'], 52599: [10, 1.6, 'rock'], 52613: [3, 0.6, 'rock'], 52638: [10, 1.6, 'grass'],
  52663: [3, 0.6, 'rock'], 52683: [3, 1.4, 'rock'], 52703: [3, 1.4, 'rock'], 52713: [3, 1.4, 'rock'], 52725: [6, 1, 'grass'],
  52758: [10, 1.6, 'grass'], 52816: [6, 1, 'rock'], 52973: [3, 2, 'rock'],
});
function hill(r, hgt, surface) {
  const m = new MeshBuilder(), tex = surface === 'rock' ? ROCK : GRASS, N = 12, R = 4;
  const P = (k, i) => { const a = (i / N) * Math.PI * 2, t = k / R; const rr = r * Math.cos((t * Math.PI) / 2); return [Math.cos(a) * rr, hgt * Math.sin((t * Math.PI) / 2) - 0.3, Math.sin(a) * rr]; };
  for (let k = 0; k < R; k++) for (let i = 0; i < N; i++) {
    const a = P(k, i), b = P(k, i + 1), c = P(k + 1, i + 1), d = P(k + 1, i);
    const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + r * 0.5, (a[2] + c[2]) / 2], l = Math.hypot(...mid) || 1;
    const uv = (p) => [p[0] / 4, -p[2] / 4];
    if (k === R - 1) m.tri(tex, a, b, d, [mid[0] / l, mid[1] / l, mid[2] / l], uv(a), uv(b), uv(d)); else m.quad(tex, a, b, c, d, [mid[0] / l, mid[1] / l, mid[2] / l], [uv(a), uv(b), uv(c), uv(d)]);
  }
  return m.build();
}
/** The pack's market stalls: the awning each wears (its fourth material, a cloth of TEXTURE.049 or 449) on a stall the
 *  pack's size - 3.2 m across the counter, 4.9 m along it, 4.4 m to the awning's high edge. */
export const RMBRP_STALLS = Object.freeze({
  53100: [49, 5], 53101: [449, 1], 53102: [449, 2], 53103: [449, 3], 53104: [49, 0], 53106: [49, 2], 53107: [49, 3], 53108: [49, 4],
  53109: [49, 5], 53113: [49, 5], 53115: [449, 2], 53117: [49, 0], 53118: [49, 1], 53121: [49, 4], 53122: [49, 5], 53123: [49, 6], 53124: [49, 8],
});
const STALL_WOOD = [67, 1];
function stall(cloth) {
  const m = new MeshBuilder(), x0 = -0.4, x1 = 2.75, z0 = -2.4, z1 = 2.45;
  for (const [x, top] of [[x0 + 0.08, 4.3], [x1 - 0.08, 2.5]]) for (const z of [z0 + 0.08, z1 - 0.08]) m.box(STALL_WOOD, [x, top / 2, z], [0.12, top, 0.12], 0.6);
  m.box(STALL_WOOD, [x1 - 0.35, 0.5, (z0 + z1) / 2], [0.6, 1.0, z1 - z0 - 0.3], 0.6);   // the counter
  m.box(STALL_WOOD, [x0 + 0.5, 0.35, (z0 + z1) / 2], [0.8, 0.7, z1 - z0 - 0.4], 0.6);   // the bench of goods at the back
  const hi = 4.4, lo = 2.45, n = [lo - hi, -(x1 - x0), 0], l = Math.hypot(...n);
  m.sheet(cloth, [x0, hi, z0], [x0, hi, z1], [x1, lo, z1], [x1, lo, z0], [-n[0] / l, -n[1] / l, 0], [[0, 0], [2.5, 0], [2.5, -1.6], [0, -1.6]]);
  return m.build();
}
/** A temple's platform: a stone block four metres square and two high, standing half in the ground. */
function platform() { const m = new MeshBuilder(); m.box([361, 1], [0, 0, 0], [4, 2, 4], 0.5); return m.build(); }
/** A building's foundation where the ground falls away: a stone block sixteen metres square and eight deep. The pack's
 *  own (Foundation 1.fbx, 8 x 4 x 8 m at its prefab's scale of two) stands centred on its origin - four metres above
 *  it - and Beautiful Villages stands it only under two temples (TEMPASF1, TEMPASH4), whose floors are 1.55-1.6 m above
 *  that origin: centred, its top would wall up the temples' front doors (AUDIT WD3 T1). Its top here is the temples'
 *  floor, 1.6 m up, and the rest goes into the ground. */
function foundation() { const m = new MeshBuilder(); m.box([317, 0], [0, -2.4, 0], [16, 8, 16], 0.5); return m.build(); }
/** A tower's dome: a drum and a hemisphere 9.6 m across. */
function domeCap(roof, drum) {
  const m = new MeshBuilder(), r = 4.8, N = 16, R = 5;
  m.cylinderY(drum, [0, -1.2, 0], r, 1.2, N, 2.4, false);
  for (let k = 0; k < R; k++) for (let i = 0; i < N; i++) {
    const P = (kk, ii) => { const a = (ii / N) * Math.PI * 2, t = ((kk / R) * Math.PI) / 2; return [Math.cos(a) * r * Math.cos(t), 3.6 * Math.sin(t), Math.sin(a) * r * Math.cos(t)]; };
    const a = P(k, i), b = P(k, i + 1), c = P(k + 1, i + 1), d = P(k + 1, i), mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], l = Math.hypot(...mid) || 1;
    const uv = (p) => [Math.atan2(p[2], p[0]) * 2, -p[1] / 2];
    if (k === R - 1) m.tri(roof, a, b, d, [mid[0] / l, mid[1] / l, mid[2] / l], uv(a), uv(b), uv(d)); else m.quad(roof, a, b, c, d, [mid[0] / l, mid[1] / l, mid[2] / l], [uv(a), uv(b), uv(c), uv(d)]);
  }
  return m.build();
}
// ---- the RMB Resource Pack's docks --------------------------------------------------------------------------------
/** The pack's dock pieces (Beautiful Villages' waterside blocks - GENRAS00 and 04, RESIAS08, TEMPASH3, TVRNAS06), read off
 *  its meshes: a plank deck a tenth of a unit thick whose top is the piece's origin, five-sided piles from 2.5 units below
 *  it to half a unit above, and the two stairs that meet a deck's end - a ramp falling half a unit over two, or five steps
 *  of a tenth. Every piece at its prefab's scale of 2, in Unity's frame as the meshes import (x mirrored) - which is what
 *  makes the placements meet: GENRAS00's ramps land at the long dock's two ends, TEMPASH3's three flights stand across
 *  the T-dock's wing, twelve metres of steps on its fourteen. Decks are [x0, x1, z0, z1] and piles [x, z], in the mesh's
 *  own units. */
export const DOCK_SCALE = 2;
const DOCK_PLANK = [67, 7], DOCK_PILE = [67, 2];
export const RMBRP_DOCKS = Object.freeze({
  53140: Object.freeze({ decks: [[-1, 1, 1, 5]], piles: [[-1, 1], [1, 1], [-1, 5], [1, 5]] }),
  53141: Object.freeze({ decks: [[-1, 1, 0, 5]], piles: [[-1, 0.1], [1, 0.1], [-1, 2.635], [1, 2.635], [-1, 5], [1, 5]] }),
  53142: Object.freeze({
    decks: [[-1, 1, 0, 5], [-3.5, -1, 3.5, 5], [1, 3.5, 3.5, 5]],
    piles: [[-1, 0.1], [1, 0.1], [-1, 3.5], [1, 3.5], [-1, 5], [1, 5], [-3.5, 3.5], [3.5, 3.5], [-3.5, 5], [3.5, 5]],
  }),
});
const dockPoint = (x, y, z) => [-x * DOCK_SCALE, y * DOCK_SCALE, z * DOCK_SCALE];
function dock({ decks, piles }) {
  const m = new MeshBuilder(), S = DOCK_SCALE;
  for (const [x0, x1, z0, z1] of decks) m.box(DOCK_PLANK, dockPoint((x0 + x1) / 2, -0.05, (z0 + z1) / 2), [(x1 - x0) * S, 0.1 * S, (z1 - z0) * S], 0.5);
  for (const [x, z] of piles) m.cylinderY(DOCK_PILE, dockPoint(x, -2.5, z), 0.15 * S, 3 * S, 5, 1);
  return m.build();
}
/** A prism of the four (x, y) corners `pts`, counter-clockwise seen from +z, standing from z0 to z1. */
function prismZ(m, tex, pts, z0, z1) {
  const at = (p, z) => [p[0], p[1], z];
  m.quad(tex, ...pts.map((p) => at(p, z1)), [0, 0, 1]);
  m.quad(tex, ...[...pts].reverse().map((p) => at(p, z0)), [0, 0, -1]);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1;
    m.quad(tex, at(a, z0), at(b, z0), at(b, z1), at(a, z1), [d[1] / l, -d[0] / l, 0]);
  }
}
/** The ramp (53143): a slab two units square, a fifth thick, its top falling half a unit from the origin's edge. */
function dockRamp() {
  const m = new MeshBuilder(), S = DOCK_SCALE;
  const [ax, ay] = dockPoint(0, 0, 0), [bx, by] = dockPoint(0, -0.2, 0), [cx, cy] = dockPoint(-2, -0.7, 0), [dx, dy] = dockPoint(-2, -0.5, 0);
  prismZ(m, DOCK_PLANK, [[ax, ay], [bx, by], [cx, cy], [dx, dy]].reverse(), -2 * S, 0);
  return m.build();
}
/** The steps (53144): five treads a tenth apart, falling away from the origin's edge, on two stringers. */
function dockSteps() {
  const m = new MeshBuilder(), S = DOCK_SCALE;
  for (let k = 0; k < 5; k++) m.box(DOCK_PLANK, dockPoint(-0.3 * (k + 0.5), -0.1 * k - 0.025, -1), [0.3 * S, 0.05 * S, 2 * S], 0.5);
  for (const [z0, z1] of [[-1.9, -1.7], [-0.3, -0.1]]) {
    const pts = [[0, -0.05], [-1.5, -0.55], [-1.5, -0.6], [0, -0.1]].map(([x, y]) => dockPoint(x, y, 0).slice(0, 2));
    prismZ(m, DOCK_PLANK, pts, z0 * S, z1 * S);
  }
  return m.build();
}

export const RMBRP_PIECES = Object.freeze({
  ...Object.fromEntries(Object.entries(RMBRP_ROCKS).map(([id, [w, up, down, l]]) => [id, () => boulderMesh(w, up, down, l, Number(id))])),
  ...Object.fromEntries(Object.entries(RMBRP_HILLS).map(([id, [r, hgt, surface]]) => [id, () => hill(r, hgt, surface)])),
  ...Object.fromEntries(Object.entries(RMBRP_STALLS).map(([id, cloth]) => [id, () => stall(cloth)])),
  53160: platform,
  53170: foundation,
  53182: () => domeCap([6, 2], [12, 1]), 53187: () => domeCap([6, 2], [38, 1]), 53194: () => domeCap([6, 3], [12, 1]),
  ...Object.fromEntries(Object.entries(RMBRP_DOCKS).map(([id, spec]) => [id, () => dock(spec)])),
  53143: dockRamp, 53144: dockSteps,
});

// ---- the table clutter of archive 56790 ----------------------------------------------------------------------
/** Archive 56790 is no peer's the manifests name and no catalogue lists (4,827 placements: on tables, at 0.75 m, and on
 *  shelves and ledges, 1.75-2.4 m, among the candles and the food). Each record stands in as a piece of Daggerfall's
 *  own clutter of the kind its height says - tableware and books on the tables, jars, potions and books on the shelves
 *  - one record one picture, so a table is set and a shelf is stocked: [archive, record]. */
export const TOWN_CLUTTER = Object.freeze({
  // on tables
  1: [200, 1], 2: [205, 12], 3: [209, 3], 7: [200, 0], 16: [205, 9], 18: [209, 7], 19: [205, 11], 20: [200, 3],
  21: [205, 14], 22: [205, 1], 23: [209, 5], 24: [205, 15], 25: [200, 2],
  // on shelves and ledges
  4: [209, 0], 5: [205, 4], 8: [205, 2], 9: [209, 6], 10: [205, 31], 11: [209, 1], 12: [205, 3], 13: [205, 7], 14: [209, 2],
});
export const TOWN_CLUTTER_ARCHIVE = 56790;

// ---- the temple gardens of archive 10035 ---------------------------------------------------------------------
/** Archive 10035 is in no catalogue either: 151 placements, every one on the ground of three temples (TEMPASD0, TEMPASF0,
 *  TEMPAAE0), in rows of one record each - a temple's garden. Each record stands in as one of Daggerfall's own garden
 *  plants (TEXTURE.301), a plant a row, so the rows are a kitchen and herb garden: cabbages, greens, lavender, yellow and
 *  white flowers, a berry bush. [archive, record]. */
export const TOWN_GARDEN = Object.freeze({ 1: [301, 18], 2: [301, 12], 3: [301, 15], 4: [301, 16], 5: [301, 13], 6: [301, 14], 7: [301, 17] });
export const TOWN_GARDEN_ARCHIVE = 10035;

// ---- install --------------------------------------------------------------------------------------------------------
let _installed = false;
/** Once: everything above on the model and texture doors behind `isOn`, and DET's pieces (shared with Detailed Ships)
 *  with `isOn` among their switches. Answers the pictures registered. */
export function installTownStandIns(isOn = () => true) {
  if (_installed) return 0;
  _installed = true;
  let n = installDetStandIns(isOn);
  shareDetailedShipsArt(isOn);   // the bottles and moved classic pieces of archive 1210 the towns' shelves hold - Detailed Ships' pictures of them
  for (let k = 0; k < TOWN_BED_COUNT; k++) {
    const { model, colour } = townBedOf(TOWN_BED_FIRST + k);
    registerModelAlias(TOWN_BED_FIRST + k, { model, remap: bedRemap(colour) }, isOn);
  }
  for (const [id, spec] of Object.entries(TOWN_PAINTINGS)) registerCustomModel(Number(id), () => paintingModel(spec), isOn);
  for (const [id, build] of Object.entries(ROSYS_PIECES)) registerCustomModel(Number(id), build, isOn);
  for (const [id, spec] of Object.entries(TOWN_CROP_FIELDS)) registerFlatField(Number(id), spec, isOn);
  for (const [id, build] of Object.entries(RMBRP_PIECES)) registerCustomModel(Number(id), build, isOn);
  const cloths = [];
  for (const [colour, c] of TOWN_BED_COLOURS.entries()) {
    for (const [cloth, rec] of TOWN_BEDCLOTHS.entries()) {
      cloths.push({
        archive: TOWN_BED_ARCHIVE, record: bedclothRecord(colour, cloth), fileName: `town-bedcloth-${c.name}-90_${rec}`, standIn: true, gate: isOn,
        build: async (ctx) => recolourBedcloth(await ctx.classicRgba(90, rec), c),
      });
    }
  }
  n += addVendorTextures(cloths.map((e) => ({ ...e, yields: true })));   // AUDIT WD3 T2: a player's own peer picture answers first
  const classicPicture = (archive, name) => ([record, from]) => ({
    archive, record: Number(record), fileName: `town-${name}-${archive}_${record}`, standIn: true, gate: isOn,
    build: async (ctx) => ({ ...(await buildDerivedPicture({ from }, ctx.classicRgba)), scale: (await ctx.classicScale?.(from[0], from[1])) ?? null }),
  });
  n += addVendorTextures(Object.entries(TOWN_CLUTTER).map(classicPicture(TOWN_CLUTTER_ARCHIVE, 'clutter')).map((e) => ({ ...e, yields: true })));
  n += addVendorTextures(Object.entries(TOWN_GARDEN).map(classicPicture(TOWN_GARDEN_ARCHIVE, 'garden')).map((e) => ({ ...e, yields: true })));
  return n;
}
/** Test seam. */
export function _resetTownStandIns() { _installed = false; }
