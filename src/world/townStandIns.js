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
//   - the RMB Resource Pack's CITY-WALL PIECE (53210): the middle of Daggerfall's own wall segment out of the player's
//     ARCH3D, closing the gap the author left it at every corner of Beautiful Cities' walls;
//   - DET's pieces, shared with Detailed Ships: world/detStandIns.js;
//   - Cliffworms' Items (archive 1210 - his bottles, and the classic pieces he moved there): Detailed Ships' pictures of
//     them, by the same author and carried with his leave, shared (systems/detailedShips.js);
//   - the cloth and the drawn sprites: world/townPictures.js, world/standInSprites.js.
//
// All of it stands behind the town mods' own load (scenes/modWorldData.js installs it when a town pack is opened -
// for the game, or for a save whose towns are pinned to it), and costs a game that has neither mod nothing.

import { registerCustomModel, registerModelAlias, customModelFor } from './customModels.js';
import { addVendorTextures } from '../systems/textureReplacement.js';
import { buildDerivedPicture } from '../formats/derivedTexture.js';
import { installDetStandIns, MeshBuilder } from './detStandIns.js';
import { TOWN_PICTURE_ARCHIVE, PICTURE } from './townPictures.js';
import { registerFlatField } from './flatFields.js';
import { RMBRP_HILL_SHAPES, SHAPE_BEARINGS, SHAPE_RINGS } from './rmbrpHillShapes.js';   // FIELD BUGS 2026-10-05 HILL-SHAPES: the pack's hills, measured
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
/** The pack's hills and the surface each wears, grass or rock (its prefab's folder). FIELD BUGS 2026-10-05 HILL-SHAPES:
 *  each drawn at its measured shape (rmbrpHillShapes.js) - this table sized them by the catalogue's Small, Medium and
 *  Large ([3 | 6 | 10 m, 0.6-3.5 m high]), a fraction of the pack's own, and what the author stood on a hill hung over
 *  it ("Houses in Ipsham are floating"). */
export const RMBRP_HILLS = Object.freeze({
  52012: 'grass', 52018: 'grass', 52022: 'grass', 52025: 'grass', 52028: 'grass', 52035: 'grass', 52058: 'grass', 52458: 'grass',
  52463: 'rock', 52508: 'grass', 52543: 'rock', 52548: 'grass', 52599: 'rock', 52613: 'rock', 52638: 'grass', 52663: 'rock',
  52683: 'rock', 52703: 'rock', 52713: 'rock', 52725: 'grass', 52758: 'grass', 52816: 'rock', 52973: 'rock',
});
/** HILL-SHAPES: one hill at its measured polar profile - its centre at `top`, SHAPE_RINGS rings out along
 *  SHAPE_BEARINGS bearings to the rim at the mesh's base (under the block's plane, so no edge stands out of the ground);
 *  each triangle faces up along its own normal. */
export function hillMesh(shape, surface) {
  const m = new MeshBuilder(), tex = surface === 'rock' ? ROCK : GRASS, K = SHAPE_BEARINGS, N = SHAPE_RINGS;
  const [cx, cz] = shape.c;
  const P = (k, j) => {
    if (j === 0) return [cx, shape.top, cz];
    const b = k % K, a = (b / K) * Math.PI * 2, r = (shape.reach[b] * j) / N;
    return [cx + Math.cos(a) * r, shape.rings[b][j - 1], cz + Math.sin(a) * r];
  };
  const uv = (p) => [p[0] / 4, -p[2] / 4];
  const face = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1, sgn = n[1] < 0 ? -1 : 1;
    m.tri(tex, a, b, c, [(sgn * n[0]) / l, (sgn * n[1]) / l, (sgn * n[2]) / l], uv(a), uv(b), uv(c));
  };
  for (let j = 1; j <= N; j++) for (let k = 0; k < K; k++) {
    const a = P(k, j), b = P(k + 1, j), c = P(k + 1, j - 1), d = P(k, j - 1);
    if (j === 1) face(a, b, d);
    else { face(a, b, c); face(a, c, d); }
  }
  return m.build();
}

// ---- TREES-SEATED: a block's trees on the hills the port draws ---------------------------------------------------
// TREES-SEATED (FIELD BUGS 2026-10-03b, Rissa on the Discord: "Floating trees in Tamhope"). Six of Beautiful Villages'
// blocks (RESIAS08, TVRNAS00, TVRNAS01, TVRNAS03, TEMPASH3, WEAPAS02) stand TEXTURE.504's trees as misc flats on the
// RMB Resource Pack's hills, at the heights the author read off the pack's own meshes: 130 of them a metre to 13 m over
// the plane. DFU stands each where it is authored (AddMiscBlockFlats reads no terrain and no model) on the pack's hill,
// and draws them floating without the pack. The port's mounds were smaller than the pack's (sized by the catalogue), so
// 121 of the 130 hung more than 1.5 m over the mound or the ground; drawn at the pack's measured shape since FIELD BUGS
// 2026-10-05 HILL-SHAPES, one does. While the port draws a block's hills as these stand-ins, a nature flat of that
// block stands on the top of what is drawn under it - the higher of the ground and the hills (AUDIT FB1005 H4: so the
// dozen the author left on the plane under a hill, which the pack's hill buries, stand on its slope instead); a hill
// the port does not draw as its own (no stand-in on) leaves the block as DFU stands it.

/** The hill the port draws for `id` - its stand-in, while the town mods' stand-ins are on (customModelFor, the door the
 *  pipeline asks before any other: scenes/dataPipeline.js buildGpuMesh) - or null: not a hill, or not drawn as ours. */
export const drawnHillStandIn = (id) => (RMBRP_HILLS[id] ? customModelFor(id) : null);

/**
 * TREES-SEATED: THE TOP OF THE HILLS ONE BLOCK STANDS, AS DRAWN. Each hill stand-in among the block's models
 * (layoutRmbBlock's, in the block's frame), its mesh's triangles laid by its own matrix; `topAt(x, z)` answers the
 * highest of them over that point in the same frame, or null where none is. Null when the block draws no hill of ours.
 * @param {Iterable<{modelIdNum:number, matrix:ArrayLike<number>}>} models
 * @param {(id:number) => ?{positions:ArrayLike<number>, indices:ArrayLike<number>}} [drawn] the mesh drawn for an id
 * @returns {?{topAt: (x:number, z:number) => ?number}}
 */
export function blockHillSeat(models, drawn = drawnHillStandIn) {
  const tris = [];   // per triangle: ax, ay, az, bx, by, bz, cx, cy, cz, minX, maxX, minZ, maxZ
  for (const placed of models ?? []) {
    const mesh = drawn(placed.modelIdNum);
    if (!mesh) continue;
    const m = placed.matrix, p = mesh.positions, w = new Float64Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      w[i] = m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12];
      w[i + 1] = m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13];
      w[i + 2] = m[2] * p[i] + m[6] * p[i + 1] + m[10] * p[i + 2] + m[14];
    }
    const ix = mesh.indices;
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      tris.push(w[a], w[a + 1], w[a + 2], w[b], w[b + 1], w[b + 2], w[c], w[c + 1], w[c + 2],
        Math.min(w[a], w[b], w[c]), Math.max(w[a], w[b], w[c]), Math.min(w[a + 2], w[b + 2], w[c + 2]), Math.max(w[a + 2], w[b + 2], w[c + 2]));
    }
  }
  if (!tris.length) return null;
  return {
    topAt(x, z) {
      let top = null;
      for (let k = 0; k < tris.length; k += 13) {
        if (x < tris[k + 9] || x > tris[k + 10] || z < tris[k + 11] || z > tris[k + 12]) continue;
        const ax = tris[k], az = tris[k + 2], bx = tris[k + 3], bz = tris[k + 5], cx = tris[k + 6], cz = tris[k + 8];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-12) continue;   // a face seen edge-on from above
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        const y = l1 * tris[k + 1] + l2 * tris[k + 4] + l3 * tris[k + 7];
        if (top === null || y > top) top = y;
      }
      return top;
    },
  };
}

/** TREES-SEATED: where a nature flat of a block with a seat stands - on the higher of the ground under it (`groundY`,
 *  the same frame) and the top of the block's drawn hills there. */
export function seatNatureFlat(seat, x, z, groundY) {
  const top = seat ? seat.topAt(x, z) : null;
  return top !== null && top > groundY ? top : groundY;
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
/** FIELD BUGS 2026-10-04d DOMES: the pack's three domes as its own meshes stand them, measured off its published files
 *  (Assets/Meshes/Buildings "HF Dome 03.fbx" for 53182 and 53194, "HF Dome 04.fbx" for 53187): octagons in centimetres,
 *  at their prefabs' scale of 4.6875, which Daggerfall Unity keeps (MeshReplacement.ImportCustomGameobject multiplies a
 *  prefab's own scale in; its turn it overwrites). A drum 4.8 m across stands ON the origin, 3.63 m high; the dome
 *  rises over it to 8.43 m and, on 03, a spire to 10.75 m. The stand-in was a hemisphere 3.6 m high over a drum sunk
 *  1.2 m under the origin - on the gem stores', markets' and pawnshops' roofs the author stands them on, a squat cap
 *  with its drum in the roof, its top 4.8 m (04) to 7.2 m (03's spire) under the pack's. Metres a unit of the meshes: */
export const DOME_UNIT = 0.01 * 4.6875;
/** The meshes' profile, [corner radius, height] in their units: the drum's foot to the dome's crown, both meshes. */
export const DOME_PROFILE = Object.freeze([[102.4, 1.15], [102.4, 77.4], [94.6, 116.6], [72.4, 149.8], [39.2, 172], [19.7, 175.9], [6.4, 179.8]]);
/** 03's spire over the crown. */
export const DOME_SPIRE = Object.freeze([[4.8, 205.4], [0, 229.4]]);
/** Where the meshes change material: their material 2 (the drum and the dome's foot) to 116.6, 1 (the dome) to 179.8, 0
 *  (the spire) over it - each prefab's RuntimeMaterials naming the classic picture of each. */
export const DOME_BANDS = Object.freeze([116.6, 179.8]);
/** A dome: `low`, `high` and `spire` the three bands' pictures; no spire, a crown closed flat. */
function domeModel({ low, high, spire = null }) {
  const m = new MeshBuilder(), N = 8, crown = DOME_PROFILE[DOME_PROFILE.length - 1][1];
  const prof = spire ? [...DOME_PROFILE, ...DOME_SPIRE] : [...DOME_PROFILE, [0, crown]];
  const P = (r, y, a) => [Math.cos(a) * r * DOME_UNIT, y * DOME_UNIT, Math.sin(a) * r * DOME_UNIT];
  for (let k = 0; k + 1 < prof.length; k++) {
    const [r0, y0] = prof[k], [r1, y1] = prof[k + 1];
    const tex = y1 <= DOME_BANDS[0] ? low : y1 <= DOME_BANDS[1] ? high : spire;
    const dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy);   // the profile's slope, turned out
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
      const n = [(Math.cos(am) * dy) / l, -dr / l, (Math.sin(am) * dy) / l];
      const v0 = -y0 * DOME_UNIT / 2, v1 = -y1 * DOME_UNIT / 2, u0 = i / 2, u1 = (i + 1) / 2;
      if (r1 === 0) m.tri(tex, P(r0, y0, a0), P(r0, y0, a1), P(0, y1, 0), n, [u0, v0], [u1, v0], [(u0 + u1) / 2, v1]);
      else m.quad(tex, P(r0, y0, a0), P(r0, y0, a1), P(r1, y1, a1), P(r1, y1, a0), n, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    }
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
  ...Object.fromEntries(Object.entries(RMBRP_HILLS).map(([id, surface]) => [id, () => hillMesh(RMBRP_HILL_SHAPES[id], surface)])),   // HILL-SHAPES
  ...Object.fromEntries(Object.entries(RMBRP_STALLS).map(([id, cloth]) => [id, () => stall(cloth)])),
  53160: platform,
  53170: foundation,
  // FIELD BUGS 2026-10-04d DOMES: 53182's pictures its RuntimeMaterials' three; 53187's names only its dome (38_1), its
  // drum the stand-in's own as before; 53194's names none (the pack's own pictures), its pair the stand-in's as before
  53182: () => domeModel({ low: [12, 1], high: [6, 2], spire: [6, 3] }), 53187: () => domeModel({ low: [38, 1], high: [38, 1] }),
  53194: () => domeModel({ low: [12, 1], high: [6, 3], spire: [6, 3] }),
  ...Object.fromEntries(Object.entries(RMBRP_DOCKS).map(([id, spec]) => [id, () => dock(spec)])),
  53143: dockRamp, 53144: dockSteps,
});

// ---- the RMB Resource Pack's city-wall piece ------------------------------------------------------------------------
/** FIELD BUGS 2026-10-03c (Discord: "missing holes in the out walls of Alik'ra"; "Saw the same thing in Chesterwark").
 *  Beautiful Cities turns its walls round corners of its own - WALLAA12 to WALLAA15, the 112 composites built on them.
 *  Each stands its corner tower (444) where Daggerfall's corners stand it, 64 units in from where the two wall lines
 *  cross, whose edge is where Daggerfall's walls begin, 448 units along each line; but the first wall segment (445) of
 *  each line stands a whole segment out from the tower and begins at 576. The author closes the 128 units between with
 *  the RMB Resource Pack's wall piece, model 53210 - two a corner block, 224 in all - and with nothing standing for it
 *  every turn of every city's wall was a hole wide enough to walk through.
 *  Read off how it is placed (four corners, two lines each, both turns of the piece along a line): its wall stands
 *  on the 445s' own line 128 units along its +z, and fills the gap's 128 units centred 128 along its +x. It stands in as
 *  exactly that, out of the player's own ARCH3D - the middle 128 units of the 445 (Daggerfall's wall, its stone, its
 *  climate) moved onto the piece's line and lifted the one unit the author sank the piece (YPos 1 to the 445s' 0). */
export const CITY_WALL_PIECE = 53210;
export const CITY_WALL_MODEL = 445;
/** In classic units: the gap's middle in the piece's frame (x along the wall, z across it), its length, the lift. */
export const CITY_WALL_FILL = Object.freeze({ x: 128, z: 128, length: 128, lift: 1 });

/** How near a cut plane a vertex stands ON it, in metres: a model's float32 positions put a face meant to lie at
 *  x = 1.6 m at 1.600000023841858, a hair outside the slab (AUDIT CITY-WALL S1). */
const SLICE_ON_PLANE_M = 1e-5;
/** A model's triangles (dfMeshToModel's shape) cut to the slab `x0 <= x <= x1` in metres - each kept part's position,
 *  normal and uv interpolated along its cut edges, its winding kept: the same faces, shorter. A face lying ON a cut is
 *  the slab's own end face when it looks out of the slab (kept: it closes a merlon the cut ends in) and the outside's
 *  face when it looks in (dropped: it would stand over the gap beside the cut). No doors. Answers null when nothing of
 *  the model lies in the slab. */
export function sliceModelX(model, x0, x1) {
  const { positions: P, normals: N, uvs: T, indices: I } = model;
  const vert = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], T[i * 2], T[i * 2 + 1]];
  const snap = (d) => (Math.abs(d) <= SLICE_ON_PLANE_M ? 0 : d);
  const below = (v) => snap(v[0] - x0), above = (v) => snap(x1 - v[0]);
  const clip = (poly, side) => {   // Sutherland-Hodgman against one plane: side(v) >= 0 is kept
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length], da = side(a), db = side(b);
      if (da >= 0) out.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const s = da / (da - db); out.push(a.map((v, j) => v + (b[j] - v) * s)); }
    }
    return out;
  };
  const pos = [], nrm = [], uv = [], idx = [], subMeshes = [];
  const push = (v) => {
    const l = Math.hypot(v[3], v[4], v[5]) || 1;
    pos.push(v[0], v[1], v[2]); nrm.push(v[3] / l, v[4] / l, v[5] / l); uv.push(v[6], v[7]);
    return pos.length / 3 - 1;
  };
  const area2 = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
  };
  for (const sm of model.subMeshes) {
    const start = idx.length;
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const tri = [vert(I[t]), vert(I[t + 1]), vert(I[t + 2])];
      if (tri.every((v) => below(v) === 0) && !(tri[0][3] < 0)) continue;   // on the low cut, looking into the slab
      if (tri.every((v) => above(v) === 0) && !(tri[0][3] > 0)) continue;   // on the high cut, looking into the slab
      const poly = clip(clip(tri, below), above);
      for (let k = 1; k < poly.length - 1; k++) {
        if (area2(poly[0], poly[k], poly[k + 1]) < 1e-12) continue;   // a sliver the cut left on its plane
        idx.push(push(poly[0]), push(poly[k]), push(poly[k + 1]));
      }
    }
    const count = (idx.length - start) / 3;
    if (count) subMeshes.push({ textureArchive: sm.textureArchive, textureRecord: sm.textureRecord, startIndex: start, primitiveCount: count });
  }
  if (!idx.length) return null;
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), uvs: new Float32Array(uv), indices: new Uint32Array(idx), subMeshes, doors: [] };
}

/** The wall piece's stand-in out of the player's own wall segment `wall` (the 445, dfMeshToModel's shape) - null
 *  without it, so nothing is built (or kept) before the pipeline can hand the 445 over. */
export function cityWallFillModel(wall) {
  if (!wall?.positions?.length) return null;
  const half = (CITY_WALL_FILL.length / 2) * U;
  const cut = sliceModelX(wall, -half, half);
  if (!cut) return null;
  const d = [CITY_WALL_FILL.x * U, CITY_WALL_FILL.lift * U, CITY_WALL_FILL.z * U];
  for (let i = 0; i < cut.positions.length; i++) cut.positions[i] += d[i % 3];
  return cut;
}

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
  registerCustomModel(CITY_WALL_PIECE, (ctx) => cityWallFillModel(ctx?.classicModel?.(CITY_WALL_MODEL)), isOn, { needs: [CITY_WALL_MODEL] });
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
