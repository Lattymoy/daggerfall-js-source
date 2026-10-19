// WD3 (2026-10-01): THE PIECES BEAUTIFUL VILLAGES AND BEAUTIFUL CITIES BORROW, STOOD IN BY THE PORT.
//
// The two town mods are world data (src/formats/worldData/worldDataPack.js), and their blocks place pieces of five peer mods
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
import { wrapAngle } from './mat4.js';   // FIELD BUGS 2026-10-13e HILL-SEAT: a pad corner's turn, in one step
import { DOOR_APPROACH_M } from './curatedPlacements.js';   // FIELD BUGS 2026-10-15f TEMPLE-STEPS: a door's approach, HILL-HOUSE's rule
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
/** The picture each of Rosy's small hangings and rugs wears (world/townPictures.js), by id - the one table its builder
 *  and its name in the house decorator (systems/decor/decorMods.js decorModNaming) both read (AUDIT 05b A8). */
export const ROSYS_PICTURES = Object.freeze({
  69467: PICTURE.smallHanging(0), 69468: PICTURE.smallHanging(1), 69469: PICTURE.smallHanging(2), 69471: PICTURE.rug(2), 69472: PICTURE.rug(3),
});
/** Small hangings (69467-69469: two units off a wall, either face out, mostly at half scale) - cloth on a rod. */
function smallHanging(record) {
  const m = new MeshBuilder(), tex = [TOWN_PICTURE_ARCHIVE, record], w = 0.4, h = 0.6, z = 0.004;
  for (const side of [1, -1]) {
    const L = (w / 2) * side, n = [0, 0, side];
    m.quad(tex, [L, 0, z * side], [-L, 0, z * side], [-L, -h, z * side], [L, -h, z * side], n, [[0, 0], [1, 0], [1, -1], [0, -1]]);
  }
  m.cylinderX([67, 0], [-w / 2 - 0.03, 0, 0], 0.012, w + 0.06, 6);
  return m.build();
}
/** A rug (69471 and 69472 are laid as a pair, one of them turned over under the floor): its picture on top. */
function rug(record) {
  const m = new MeshBuilder(), tex = [TOWN_PICTURE_ARCHIVE, record], hw = 0.8, hd = 0.5, t = 0.012;
  m.quad(tex, [hw, t, -hd], [-hw, t, -hd], [-hw, t, hd], [hw, t, hd], [0, 1, 0], [[0, 0], [1, 0], [1, -1], [0, -1]]);
  m.quad([0, 45], [hw, 0, hd], [-hw, 0, hd], [-hw, 0, -hd], [hw, 0, -hd], [0, -1, 0]);
  return m.build();
}
export const ROSYS_PIECES = Object.freeze({
  69467: () => smallHanging(ROSYS_PICTURES[69467]), 69468: () => smallHanging(ROSYS_PICTURES[69468]), 69469: () => smallHanging(ROSYS_PICTURES[69469]),
  69471: () => rug(ROSYS_PICTURES[69471]), 69472: () => rug(ROSYS_PICTURES[69472]),
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
/** The rocks Beautiful Villages and Beautiful Cities scatter round their buildings: each mesh's box as Unity imports it
 *  (x mirrored), in metres at the mesh's own centimetres - [x0, x1, depth below the origin, height above it, z0, z1] -
 *  stood at RMBRP_ROCK_SCALE, below. Each stands in as a boulder of the climate's rock (302_3, swapped by climate) over
 *  that box. FIELD BUGS 2026-10-15f TEMPLE-STEPS: the table was [width, height, depth, length] round the origin, but a
 *  mesh's box sits off its origin, by up to a fifth of its width (53086), which the prefab's scale makes a metre. */
export const RMBRP_ROCKS = Object.freeze({
  53006: [-0.273, 0.263, 0.123, 0.327, -0.308, 0.286], 53012: [-0.431, 0.416, 0.13, 0.278, -0.282, 0.26], 53014: [-0.475, 0.636, 0.001, 0.349, -0.421, 0.561],
  53017: [-0.228, 0.356, 0.003, 0.639, -0.382, 0.483], 53020: [-0.738, 0.82, 0.004, 0.961, -0.562, 0.734], 53023: [-0.814, 0.555, 0.255, 0.523, -0.619, 0.576],
  53029: [-0.356, 0.224, 0.092, 0.167, -0.319, 0.234], 53030: [-0.343, 0.215, 0.069, 0.167, -0.221, 0.203], 53031: [-0.307, 0.219, 0.085, 0.176, -0.236, 0.223],
  53032: [-0.504, 0.506, 0.124, 0.224, -0.553, 0.501], 53033: [-0.333, 0.325, 0.102, 0.119, -0.36, 0.286], 53035: [-0.349, 0.415, 0.09, 0.496, -0.414, 0.404],
  53036: [-0.335, 0.35, 0.103, 0.541, -0.294, 0.318], 53037: [-0.898, 1.076, 0.141, 0.715, -0.788, 0.945], 53038: [-0.93, 0.891, 0.176, 0.468, -0.618, 0.872],
  53039: [-1.194, 1.095, 0.164, 0.658, -0.875, 0.726], 53040: [-1.005, 1.212, 0.189, 0.523, -1.161, 1.346], 53042: [-0.99, 1.04, 0.114, 0.224, -1.176, 1.041],
  53054: [-0.387, 0.505, 0, 0.133, -0.316, 0.252], 53064: [-0.397, 0.396, 0, 0.367, -0.45, 0.401], 53083: [-0.387, 0.387, 0, 0.133, -0.252, 0.252],
  53085: [-0.255, 0.403, 0, 0.136, -0.405, 0.236], 53086: [-1.305, 0.891, 0, 0.56, -0.611, 0.65],
});
/** FIELD BUGS 2026-10-15f TEMPLE-STEPS: the scale each rock's prefab stands its mesh at - the m_LocalScale it sets on the
 *  model's root, which MeshReplacement.ImportCustomGameobject keeps and multiplies the placement's into. The stand-ins
 *  had been the mesh alone: at it, 143 of the 245 rocks the packs lay stood wholly under the ground they were laid on. */
export const RMBRP_ROCK_SCALE = Object.freeze({
  53006: 6, 53012: 5, 53014: 4, 53017: 6, 53020: 4, 53023: 2, 53029: 6, 53030: 8, 53031: 6, 53032: 3, 53033: 4, 53035: 4,
  53036: 6, 53037: 4, 53038: 4, 53039: 4, 53040: 3, 53042: 4, 53054: 8, 53064: 6, 53083: 6, 53085: 8, 53086: 4,
});
const ROCK = [302, 3], GRASS = [302, 2];
/** A rock's boulder: over its mesh's box (RMBRP_ROCKS), at its prefab's scale. */
export function rockMesh(id) {
  const [x0, x1, down, up, z0, z1] = RMBRP_ROCKS[id].map((v) => v * RMBRP_ROCK_SCALE[id]);
  return boulderMesh(x1 - x0, up, down, z1 - z0, Number(id), (x0 + x1) / 2, (z0 + z1) / 2);
}
/** ROCK-SMEAR (FIELD BUGS 2026-10-18f, æther: "Rock missing textures and clipping with the pole. In Ipsmoth."): the
 *  boulder was drawn INSIDE OUT. Its faces took the normal their corners' order gave - 40 of its 48 (its sides and its
 *  underside) looking into the rock - and MeshBuilder winds a face to look along its normal, so under the world's
 *  back-face culling the near side of every rock was culled and the inside of its far side drawn: a hollow grey shell,
 *  and whatever stood in it seen through it. Since TEMPLE-STEPS stood the rocks at their prefab's scale (2-8), that is
 *  a shell up to nine metres across. Each face now looks out of the boulder (boulderMesh's `face`).
 *  And its picture was laid by one plan for every face, the side view (x, -y): one row of the texture across the
 *  underside, every side that faces x squeezed to a sliver - 25 to 75 per cent of each rock's surface stretched past
 *  four to one, a flat grey smear. `boulderUv`: a face's picture laid along the axis its normal `n` leans on most (box
 *  mapping, a repeat a metre), so no face is stretched past 1 : 1/sqrt(3) and a side's rows lie level. */
export const boulderUv = (p, n) => {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [p[0], -p[2]];   // the crown and the underside: from above
  return ax >= az ? [p[2], -p[1]] : [p[0], -p[1]];   // a side: along the axis it faces, its rows level
};
/** A boulder: an eight-sided lump, its rim and crown pushed in and out by a seed, `w` x `l` across round (cx, cz), `up`
 *  above its origin and `down` below - never out past its box (TEMPLE-STEPS: the rim had been pushed out by up to 12%,
 *  half a metre past the pack's own rock at its prefab's scale). Each face dressed by boulderUv (ROCK-SMEAR). */
export function boulderMesh(w, up, down, l, seed, cx = 0, cz = 0) {
  const m = new MeshBuilder(), N = 8;
  let h = seed >>> 0;
  const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (h & 0xffff) / 0xffff; };
  const ring = (y, k) => Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2, r = k * (0.82 + rnd() * 0.18); return [cx + Math.cos(a) * (w / 2) * r, y, cz + Math.sin(a) * (l / 2) * r]; });
  const base = ring(-Math.max(down, 0.05), 0.92), mid = ring(up * 0.45, 1), top = ring(up * 0.85, 0.62), crown = [cx, up, cz], foot = [cx, -Math.max(down, 0.05), cz];
  const face = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const g = [(a[0] + b[0] + c[0]) / 3 - cx, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3 - cz]; const l2 = (n[0] * g[0] + n[1] * g[1] + n[2] * g[2] < 0 ? -1 : 1) * (Math.hypot(...n) || 1), nn = [n[0] / l2, n[1] / l2, n[2] / l2]; m.tri(ROCK, a, b, c, nn, boulderUv(a, nn), boulderUv(b, nn), boulderUv(c, nn)); };   // ROCK-SMEAR: out of the boulder (its origin on the axis), never into it
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
/** The hills' texture coordinates: a plan view in the hill's own frame, a picture every 4 m (hillMesh's - and FIELD BUGS
 *  2026-10-13e HILL-SEAT's pads', in the frame of the hill under them). */
const hillPlanUv = (x, z) => [x / 4, -z / 4];
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
  const uv = (p) => hillPlanUv(p[0], p[2]);
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
 * @returns {?{topAt: (x:number, z:number) => ?number, lay: (mesh:{positions:ArrayLike<number>, indices:ArrayLike<number>}) => void, trianglesIn: (x0:number, z0:number, x1:number, z1:number) => number[][]}}
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
  // FIELD BUGS 2026-10-13e HILL-SEAT: the triangles by the 2 m square their box touches, filed on the first ask after a
  // change - a pad asks the top a few thousand times, and each ask reads the few triangles under it, not the block's all
  const CELL = 2, NONE = [];
  let cells = null, gx = 0, gz = 0, nz = 0;
  const near = (x, z) => {
    if (!cells) {
      gx = Infinity; gz = Infinity;
      let x1 = -Infinity, z1 = -Infinity;
      for (let k = 0; k < tris.length; k += 13) { gx = Math.min(gx, tris[k + 9]); x1 = Math.max(x1, tris[k + 10]); gz = Math.min(gz, tris[k + 11]); z1 = Math.max(z1, tris[k + 12]); }
      nz = Math.floor((z1 - gz) / CELL) + 1;
      cells = new Array((Math.floor((x1 - gx) / CELL) + 1) * nz);
      for (let k = 0; k < tris.length; k += 13) {
        const i1 = Math.floor((tris[k + 10] - gx) / CELL), j0 = Math.floor((tris[k + 11] - gz) / CELL), j1 = Math.floor((tris[k + 12] - gz) / CELL);
        for (let i = Math.floor((tris[k + 9] - gx) / CELL); i <= i1; i++) for (let j = j0; j <= j1; j++) (cells[i * nz + j] ??= []).push(k);
      }
    }
    const i = Math.floor((x - gx) / CELL), j = Math.floor((z - gz) / CELL);
    return i < 0 || j < 0 || j >= nz ? NONE : cells[i * nz + j] ?? NONE;
  };
  if (!tris.length) return null;
  return {
    topAt(x, z) {
      let top = null;
      for (const k of near(x, z)) {
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
    /** FIELD BUGS 2026-10-13e HILL-SEAT: lay a mesh drawn in the block's own frame (blockHillPatch's pads) under the
     *  same top, so whatever reads the seat - TREES-SEATED's flats - stands on it as on the hills. */
    lay(mesh) {
      const p = mesh.positions, ix = mesh.indices;
      for (let t = 0; t + 2 < ix.length; t += 3) {
        const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
        tris.push(p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2],
          Math.min(p[a], p[b], p[c]), Math.max(p[a], p[b], p[c]), Math.min(p[a + 2], p[b + 2], p[c + 2]), Math.max(p[a + 2], p[b + 2], p[c + 2]));
      }
      cells = null;   // filed again on the next ask
    },
    /** HILL-SEAT: the drawn triangles whose boxes meet the box x0..x1, z0..z1, seen from above ([ax, az, bx, bz, cx, cz]
     *  each) - the corners and edges where the top between two samples turns. */
    trianglesIn(x0, z0, x1, z1) {
      const out = [];
      for (let k = 0; k < tris.length; k += 13) {
        if (tris[k + 10] < x0 || tris[k + 9] > x1 || tris[k + 12] < z0 || tris[k + 11] > z1) continue;
        out.push([tris[k], tris[k + 2], tris[k + 3], tris[k + 5], tris[k + 6], tris[k + 8]]);
      }
      return out;
    },
  };
}

/** TREES-SEATED: where a nature flat of a block with a seat stands - on the higher of the ground under it (`groundY`,
 *  the same frame) and the top of the block's drawn hills there. */
export function seatNatureFlat(seat, x, z, groundY) {
  const top = seat ? seat.topAt(x, z) : null;
  return top !== null && top > groundY ? top : groundY;
}

// ---- HILL-SEAT: a hill holds what the author stood on it -----------------------------------------------------------
// FIELD BUGS 2026-10-13e HILL-SEAT (SylviaBun on the Discord: "Some locations have floating houses - Temple of Kynareth
// has floating houses due to terrain modifications", a night screenshot of a house on a grass mound whose crest falls
// away under its front wall, a lit gap under the wall). Beautiful Villages stands about a fifth of Kynareth's temples as
// TEMPASH3 (Ipsham's block), whose houses 127, 129 and 201 and temple 402 the author stood on hill 52758's plateau,
// 4.1-4.2 m up. HILL-SHAPES drew each hill at its measured profile and seated them at their origins, but the profile is
// each cell's MEDIAN, and it falls away towards the plateau's edge - 0.23-0.33 m under the houses' height 5 m out from
// an origin, 0.74-1.24 m 7 m out: a house's far wall hung a metre over the drawn slope. DFU with the pack stands the
// house on the author's own mesh, whose plateau holds it. So a block that stands a model up on a drawn hill lays a PAD
// under it: a flat top HILL_PATCH_SINK under the model's base over its whole footprint and a little past it, and a bank
// falling from that edge until it is under what the block draws there (its hills, or its plane) - in the picture of the
// hill the model stands on, with that hill's own texture coordinates (hillPlanUv in the hill's frame), so where the bank
// meets the hill the grass runs on. The model is not moved, and nothing is raised over its base.
//
// FIELD BUGS 2026-10-15f TEMPLE-STEPS (Discord: "The Akatosh Chantry in Merdale also has some small issues"): A PAD BURIES
// NOTHING THE AUTHOR LEFT IN THE OPEN. A pad is the port's, not the author's - DFU with the pack lays none - and it was
// laid against the hills and the plane alone, blind to the block's other models. Merdale's TEMPASD1 stands its temple's
// four-piece flight (21728) over hill 52458: the pad under a post beside it (43733, 0.25 m square) banked down over the
// flight by up to 1.25 m, the third piece's (it stands on the fourth, stacked under it) over the second's treads; TEMPASF1's
// temple and upper stair banked over its lower stair (40720) by up to 0.7 m, TEMPASH4's temple over its stair's top step
// and the rocks at its foundations' feet. So a pad now leaves in the open every vertex of the block's other models that
// stands over what is drawn under it (hills, or the plane) and every door's approach (its step and DOOR_APPROACH_M
// before it, at its foot, HILL-HOUSE's rule): no pad where its flat top would cover one, and its bank falls steeper where
// it must, to pass HILL_PATCH_SINK under every one - still facing up, its edge still under the ground.

/** HILL-SEAT: how far a model the author stood on a hill may hang over what is drawn under any point of its footprint,
 *  in metres - the bar HILL-SHAPES held a prop's foot to at its origin (test/formats/worldData/fb1005_hills.test.js), held now under the
 *  whole footprint: three times the 2 classic units (0.05 m) a town's own models stand over their ground (GroundOffset,
 *  the block's frame over the levelled terrain), the hair the pad's own top keeps under a base (HILL_PATCH_SINK). */
export const HILL_SEAT_TOLERANCE = 0.15;
/** HILL-SEAT: a model whose base is under this stands on the block's plane, not up a hill (fb1005_hills' sweep's bar). */
export const HILL_SEAT_PLANE = 0.5;
/** HILL-SEAT: a model whose base is more than this over every drawn top under its footprint was hung there by its
 *  author, not stood - HILL-SHAPES' metre (no model stood on a hill hangs one over the stand-in at its middle). */
export const HILL_SEAT_STAND = 1;
/** HILL-SEAT: the pad's top under the model's base - a third of the bar: GroundOffset's 2 classic units, as a town's
 *  models stand over their ground, so the base's own faces and the pad never fight for the depth. */
export const HILL_PATCH_SINK = HILL_SEAT_TOLERANCE / 3;
const HILL_PATCH_MARGIN = 0.25;   // the flat top runs this far past the footprint: a wall's foot is not the bank's edge
const HILL_PATCH_SLOPE = 1;       // the bank falls a metre a metre (45 degrees): the median's fall by a plateau's edge is under half that, so it meets the hill within a few metres and buries nothing farther off
const HILL_PATCH_TOE = 0.25;      // the bank runs on until it is this far under what is drawn there - its edge never in the open
const HILL_PATCH_STEP = 0.25;     // the bank's march out
const HILL_PATCH_GRID = 1;        // the gap's samples inside a footprint, past the exact ones (footprintSamples)
const HILL_PATCH_RAY = 1;         // a bank's rays along a footprint's edge
const HILL_PATCH_FAN = Math.PI / 6;   // and round its corners, 30 degrees apart at most
const HILL_PATCH_STEEPEST = 8;    // TEMPLE-STEPS: the steepest a yielding bank falls (8 m a metre, 83 degrees); a pad that needs more lays nothing
const HILL_PATCH_ROUNDS = 8;      // TEMPLE-STEPS: and the rounds its rays are steepened in, before it lays nothing

/** HILL-SEAT: the convex hull of points [x, z], counter-clockwise (x across, z up the page) - Andrew's monotone chain. */
function hullXZ(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 1e-9) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 1e-9) upper.pop();
    upper.push(p[i]);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/** HILL-SEAT: whether [x, z] stands in a counter-clockwise convex polygon, its edge included. */
function inHull(h, x, z) {
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false;
  }
  return true;
}
/** HILL-SEAT: a placed model's footprint as it is drawn - its lowest vertex (`base`) and the hull of its vertices seen
 *  from above (`hull`), in the block's frame. Read off the mesh the host draws (its CPU copy), so the footprint is the
 *  house's own walls, eaves and steps under its own turn, not a box round them. */
function modelFootprint(positions, m) {
  let base = Infinity;
  const pts = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    base = Math.min(base, m[1] * x + m[5] * y + m[9] * z + m[13]);
    pts.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[2] * x + m[6] * y + m[10] * z + m[14]]);
  }
  return { base, hull: hullXZ(pts) };
}
/** HILL-SEAT: where a footprint's gap is read. The drawn top is a plane in each triangle, so over the footprint it is
 *  lowest at one of the footprint's corners, a corner of the top inside it, or a point where an edge of the top crosses
 *  an edge of the footprint - every one of them is read; and, for where two hills' tops cross, on a grid of
 *  HILL_PATCH_GRID inside. */
function footprintSamples(seat, hull) {
  const out = hull.slice(), n = hull.length;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of hull) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (const t of seat.trianglesIn(x0, z0, x1, z1)) {
    for (let v = 0; v < 6; v += 2) {
      const px = t[v], pz = t[v + 1], rx = t[(v + 2) % 6] - px, rz = t[(v + 3) % 6] - pz;
      if (inHull(hull, px, pz)) out.push([px, pz]);
      for (let i = 0; i < n; i++) {
        const [ax, az] = hull[i], sx = hull[(i + 1) % n][0] - ax, sz = hull[(i + 1) % n][1] - az;
        const den = rx * sz - rz * sx;
        if (Math.abs(den) < 1e-12) continue;   // parallel: its ends are read
        const s = ((ax - px) * sz - (az - pz) * sx) / den, u = ((ax - px) * rz - (az - pz) * rx) / den;
        if (s >= 0 && s <= 1 && u >= 0 && u <= 1) out.push([px + rx * s, pz + rz * s]);
      }
    }
  }
  for (let x = x0 + HILL_PATCH_GRID / 2; x < x1; x += HILL_PATCH_GRID) for (let z = z0 + HILL_PATCH_GRID / 2; z < z1; z += HILL_PATCH_GRID) if (inHull(hull, x, z)) out.push([x, z]);
  return out;
}
/** HILL-SEAT: the texture coordinates of a point of the block's frame in the frame of the hill placed by `m` (the
 *  inverse of its matrix, which may turn and scale), as hillMesh gives its own. */
function hillUvAt(m) {
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g) || 1;
  return (p) => {
    const x = p[0] - m[12], y = p[1] - m[13], z = p[2] - m[14];
    return hillPlanUv(((e * i - f * h) * x + (c * h - b * i) * y + (b * f - c * e) * z) / det, ((d * h - e * g) * x + (b * g - a * h) * y + (a * e - b * d) * z) / det);
  };
}
/** HILL-SEAT x TEMPLE-STEPS: how far [x, z] stands outside a counter-clockwise convex polygon - 0 inside it. */
function outsideHull(h, x, z) {
  if (inHull(h, x, z)) return 0;
  let best = Infinity;
  for (let i = 0; i < h.length; i++) best = Math.min(best, segmentDistance(x, z, h[i], h[(i + 1) % h.length]));
  return best;
}
/** TEMPLE-STEPS: a point's distance to the segment a-b, seen from above. */
function segmentDistance(x, z, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
  const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)) : 0;
  return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
}

/** FIELD BUGS 2026-10-15f TEMPLE-STEPS: a door's approach in the block's frame - the middle of its foot (`foot`), the way
 *  out of it, level (`out`, the door record's own normal: the way DFU's exit lands a player), and half its width along
 *  the wall (`half`). `door` a door record of the mesh (meshReader's vert0-2 and normal, the model's own space), `m` the
 *  placement's matrix. */
export function doorApproach(door, m) {
  const at = (x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  const v0 = door.vert0, v2 = door.vert2, footY = Math.min(v0.y, door.vert1.y, v2.y);
  const cx = (v0.x + v2.x) / 2, cz = (v0.z + v2.z) / 2;
  const foot = at(cx, footY, cz), tip = at(cx + door.normal.x, footY, cz + door.normal.z);
  const ox = tip[0] - foot[0], oz = tip[2] - foot[2], l = Math.hypot(ox, oz) || 1;
  const a = at(v0.x, footY, v0.z), b = at(v2.x, footY, v2.z);
  return { foot, out: [ox / l, 0, oz / l], half: Math.hypot(b[0] - a[0], b[2] - a[2]) / 2 };
}
/** TEMPLE-STEPS: the approach's points on the ground, [x, z, k] each - its step (k = 0) and every `step` metres out to
 *  DOOR_APPROACH_M, at its middle and a hand's breadth in from each jamb. */
export function doorApproachPoints({ foot, out, half }, step = HILL_PATCH_STEP) {
  const side = Math.max(half - 0.1, 0), pts = [];
  for (let k = 0; k <= DOOR_APPROACH_M + 1e-9; k += step) {
    for (const s of side ? [-side, 0, side] : [0]) pts.push([foot[0] + out[0] * k - out[2] * s, foot[2] + out[2] * k + out[0] * s, k]);
  }
  return pts;
}

/** TEMPLE-STEPS: what the block's pads must leave in the open, filed by the metre square - every vertex of its models (a
 *  hill aside) standing more than HILL_PATCH_SINK over what `seat` draws under it (its hills, or the plane), and every
 *  door's approach at its foot. Each point [x, y, z, owner]: the model's index, or -1 for a door's approach (a model's own
 *  vertices are its own pad's to sit on; no door's approach is anyone's). */
function openPoints(seat, models, meshOf, drawn) {
  const cells = new Map(), key = (i, j) => `${i},${j}`;
  const add = (x, y, z, owner) => {
    const k = key(Math.floor(x), Math.floor(z));
    let c = cells.get(k);
    if (!c) cells.set(k, (c = []));
    c.push([x, y, z, owner]);
  };
  for (const [owner, placed] of [...(models ?? [])].entries()) {
    if (drawn(placed.modelIdNum)) continue;
    const mesh = meshOf(placed), m = placed.matrix;
    if (!mesh?.positions?.length) continue;
    const p = mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      const x = m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12], y = m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13], z = m[2] * p[i] + m[6] * p[i + 1] + m[10] * p[i + 2] + m[14];
      if (y > Math.max(seat.topAt(x, z) ?? 0, 0) + HILL_PATCH_SINK) add(x, y, z, owner);
    }
    for (const door of mesh.doors ?? []) {
      const a = doorApproach(door, m);
      for (const [x, z] of doorApproachPoints(a)) add(x, a.foot[1], z, -1);
    }
  }
  return {
    /** The points over the box x0..x1, z0..z1 but `owner`'s own. */
    near(x0, z0, x1, z1, owner) {
      const out = [];
      for (let i = Math.floor(x0); i <= Math.floor(x1); i++) for (let j = Math.floor(z0); j <= Math.floor(z1); j++) {
        for (const q of cells.get(key(i, j)) ?? []) if (q[3] !== owner && q[0] >= x0 && q[0] <= x1 && q[2] >= z0 && q[2] <= z1) out.push(q);
      }
      return out;
    },
  };
}

/** HILL-SEAT: one model's pad into `mb` - a flat top at `top` over `hull` grown by HILL_PATCH_MARGIN (its corners
 *  rounded), and a bank out of every point of that edge along its outward normal, falling HILL_PATCH_SLOPE a metre until
 *  it is HILL_PATCH_TOE under what the block draws there (`seat`'s top, or the plane), or under the plane wherever it
 *  is. Each triangle faces up. TEMPLE-STEPS: `open` (openPoints) what it must leave in the open, but `owner`'s own - none
 *  under the flat top (else no pad: answers false), and each bank's ray falls steeper where it must to pass
 *  HILL_PATCH_SINK under every one over it (or, past HILL_PATCH_STEEPEST, no pad). */
function hillPad(mb, seat, hull, top, tex, uvOf, open, owner) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of hull) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (const q of open.near(x0 - HILL_PATCH_MARGIN, z0 - HILL_PATCH_MARGIN, x1 + HILL_PATCH_MARGIN, z1 + HILL_PATCH_MARGIN, owner)) {
    if (q[1] - top < HILL_PATCH_SINK - 1e-4 && outsideHull(hull, q[0], q[2]) <= HILL_PATCH_MARGIN) return false;   // the top would cover what the author left in the open
  }
  const n = hull.length, rays = [];
  const outward = (i) => {
    const [ax, az] = hull[i], [bx, bz] = hull[(i + 1) % n];
    return Math.atan2(ax - bx, bz - az);   // the edge's (dz, -dx), as an angle from +x towards +z
  };
  for (let i = 0; i < n; i++) {
    const [ax, az] = hull[i], [bx, bz] = hull[(i + 1) % n];
    const a0 = outward((i + n - 1) % n);
    const a1 = a0 + wrapAngle(outward(i) - a0);   // the corner's outward turn, (0, pi) on a convex hull - ONCRASH1's one wrap
    const fan = Math.max(1, Math.ceil((a1 - a0) / HILL_PATCH_FAN));
    for (let k = a1 > a0 ? 0 : fan; k <= fan; k++) rays.push([ax, az, a0 + ((a1 - a0) * k) / fan]);
    const along = Math.ceil(Math.hypot(bx - ax, bz - az) / HILL_PATCH_RAY);
    for (let k = 1; k < along; k++) rays.push([ax + ((bx - ax) * k) / along, az + ((bz - az) * k) / along, a1]);
  }
  const under = (x, z) => Math.max(seat.topAt(x, z) ?? 0, 0);   // what the block draws: its hills, or its plane
  const slopes = rays.map(() => HILL_PATCH_SLOPE);   // TEMPLE-STEPS: each ray's own, steeper where it must yield
  const rayOf = ([px, pz, a], s) => {
    const dx = Math.cos(a), dz = Math.sin(a), cx = px + dx * HILL_PATCH_MARGIN, cz = pz + dz * HILL_PATCH_MARGIN;
    const reach = (top + HILL_PATCH_TOE) / s;   // this far out the bank is under the plane
    let d = HILL_PATCH_STEP;
    while (d < reach && top - s * d > under(cx + dx * d, cz + dz * d) - HILL_PATCH_TOE) d += HILL_PATCH_STEP;
    d = Math.min(d, reach);
    return { crest: [cx, top, cz], toe: [cx + dx * d, top - s * d, cz + dz * d] };
  };
  let ring = rays.map((r, i) => rayOf(r, slopes[i]));
  // TEMPLE-STEPS: each bank triangle over something left in the open steepens its two rays, until none is
  for (let round = 0; ; round++) {
    let steeper = false;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length, a = ring[i], b = ring[j];
      for (const [p, q, r] of [[a.crest, b.crest, b.toe], [a.crest, b.toe, a.toe]]) {
        const tx0 = Math.min(p[0], q[0], r[0]), tx1 = Math.max(p[0], q[0], r[0]), tz0 = Math.min(p[2], q[2], r[2]), tz1 = Math.max(p[2], q[2], r[2]);
        const det = (q[2] - r[2]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[2] - r[2]);
        if (Math.abs(det) < 1e-12) continue;
        for (const [x, y, z] of open.near(tx0, tz0, tx1, tz1, owner)) {
          const l1 = ((q[2] - r[2]) * (x - r[0]) + (r[0] - q[0]) * (z - r[2])) / det, l2 = ((r[2] - p[2]) * (x - r[0]) + (p[0] - r[0]) * (z - r[2])) / det;
          if (l1 < -1e-9 || l2 < -1e-9 || l1 + l2 > 1 + 1e-9) continue;
          if (l1 * p[1] + l2 * q[1] + (1 - l1 - l2) * r[1] <= y - HILL_PATCH_SINK) continue;   // the bank passes under it
          const d = segmentDistance(x, z, [a.crest[0], a.crest[2]], [b.crest[0], b.crest[2]]);
          const need = (top - (y - HILL_PATCH_SINK)) / Math.max(d, 1e-6) * 1.01;
          if (d < HILL_PATCH_STEP || need > HILL_PATCH_STEEPEST) return false;   // at the crest: the pad would bury it however its bank fell
          slopes[i] = Math.max(slopes[i], need); slopes[j] = Math.max(slopes[j], need);
          steeper = true;
        }
      }
    }
    if (!steeper) break;
    if (round >= HILL_PATCH_ROUNDS) return false;
    ring = rays.map((r, i) => rayOf(r, slopes[i]));
  }
  const bank = (p, q, r) => {
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(c[0], c[1], c[2]);
    if (len < 1e-9) return;   // two rays out of one corner at one angle
    const s = c[1] < 0 ? -len : len;
    mb.tri(tex, p, q, r, [c[0] / s, c[1] / s, c[2] / s], uvOf(p), uvOf(q), uvOf(r));
  };
  let mx = 0, mz = 0;
  for (const { crest } of ring) { mx += crest[0]; mz += crest[2]; }
  const mid = [mx / ring.length, top, mz / ring.length];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    mb.tri(tex, mid, a.crest, b.crest, [0, 1, 0], uvOf(mid), uvOf(a.crest), uvOf(b.crest));
    bank(a.crest, b.crest, b.toe);
    bank(a.crest, b.toe, a.toe);
  }
  return true;
}

/**
 * HILL-SEAT: THE PADS ONE BLOCK LAYS UNDER WHAT ITS AUTHOR STOOD ON ITS DRAWN HILLS. For each of the block's models (a
 * hill holds itself) whose base stands over the block's plane (HILL_SEAT_PLANE), over a drawn hill, and ON it - the
 * drawn top somewhere under its footprint within HILL_SEAT_STAND of its base (a model hung higher keeps its air) - and
 * which hangs more than HILL_PATCH_SINK over what is drawn anywhere under its footprint: a pad (hillPad), in the picture
 * of the hill under its middle - leaving in the open what the author did (TEMPLE-STEPS: every other model's vertices over
 * the drawn ground, and every door's approach - read off the same meshes, their door records too, so no host hands
 * anything more in), or none. The pads come back as ONE mesh in the block's frame, in a custom model's shape
 * (positions, normals, uvs, indices, subMeshes), and are laid into `seat`, so its top - TREES-SEATED's flats' - answers
 * them as it answers the hills. Null when the block needs none. The one home of both street hosts (scenes/world.js
 * merges it with the pixel's statics and its collider bucket, freed with them; scenes/exterior.js draws and collides it
 * for its fixed city's life).
 * @param {?ReturnType<typeof blockHillSeat>} seat the block's hills as drawn (blockHillSeat), or null - none of ours
 * @param {Iterable<{modelIdNum:number, matrix:ArrayLike<number>}>} models the block's (layoutRmbBlock's)
 * @param {(placed:{modelIdNum:number, matrix:ArrayLike<number>}) => ?{positions:ArrayLike<number>, doors?:Array<any>}} meshOf the mesh the host draws for a placement (its door records with it), or null for one it does not draw
 * @param {(id:number) => ?{positions:ArrayLike<number>, indices:ArrayLike<number>, subMeshes?:Array<{textureArchive:number, textureRecord:number}>}} [drawn] the mesh drawn for a hill (blockHillSeat's)
 * @returns {?{positions:Float32Array, normals:Float32Array, uvs:Float32Array, indices:Uint32Array, subMeshes:Array, doors:Array}}
 */
export function blockHillPatch(seat, models, meshOf, drawn = drawnHillStandIn) {
  if (!seat) return null;
  const hills = [];
  for (const placed of models ?? []) {
    const mesh = drawn(placed.modelIdNum);
    if (mesh) hills.push({ placed, mesh, seat: null });
  }
  const mb = new MeshBuilder(), all = [...(models ?? [])];
  let pads = 0, open = null;
  for (const [owner, placed] of all.entries()) {
    if (drawn(placed.modelIdNum)) continue;   // a hill holds itself
    const mesh = meshOf(placed);
    if (!mesh?.positions?.length) continue;
    const { base, hull } = modelFootprint(mesh.positions, placed.matrix);
    if (hull.length < 3 || base < HILL_SEAT_PLANE) continue;   // on the block's plane
    let mx = 0, mz = 0;
    for (const [x, z] of hull) { mx += x / hull.length; mz += z / hull.length; }
    if (seat.topAt(mx, mz) === null) continue;   // over no drawn hill
    let high = -Infinity, gap = -Infinity;
    for (const [x, z] of footprintSamples(seat, hull)) {
      const t = seat.topAt(x, z);
      if (t !== null && t > high) high = t;
      gap = Math.max(gap, base - Math.max(t ?? 0, 0));
    }
    if (base - high > HILL_SEAT_STAND || gap <= HILL_PATCH_SINK) continue;   // hung over the hill, or held by it already
    let on = null, onTop = -Infinity;   // the hill it stands on: the highest under its middle
    for (const h of hills) {
      const t = (h.seat ??= blockHillSeat([h.placed], drawn))?.topAt(mx, mz) ?? null;
      if (t !== null && t > onTop) { on = h; onTop = t; }
    }
    if (!on) continue;
    const sm = on.mesh.subMeshes?.[0];
    open ??= openPoints(seat, all, meshOf, drawn);   // TEMPLE-STEPS: read once a block lays its first pad, before any pad is laid
    if (hillPad(mb, seat, hull, base - HILL_PATCH_SINK, sm ? [sm.textureArchive, sm.textureRecord] : GRASS, hillUvAt(on.placed.matrix), open, owner)) pads++;
  }
  if (!pads) return null;
  const patch = mb.build();
  seat.lay(patch);
  return patch;
}
/** The pack's market stalls: the awning each wears (its fourth material, a cloth of TEXTURE.049 or 449) on the pack's
 *  stall (RMBRP_STALL_FRAME) at RMBRP_STALL_SCALE - 2.4 m across, 3.7 m along, 3.3 m to the back posts' tops. */
export const RMBRP_STALLS = Object.freeze({
  53100: [49, 5], 53101: [449, 1], 53102: [449, 2], 53103: [449, 3], 53104: [49, 0], 53106: [49, 2], 53107: [49, 3], 53108: [49, 4],
  53109: [49, 5], 53113: [49, 5], 53115: [449, 2], 53117: [49, 0], 53118: [49, 1], 53121: [49, 4], 53122: [49, 5], 53123: [49, 6], 53124: [49, 8],
});
/** FIELD BUGS 2026-10-15f TEMPLE-STEPS: the scale every stall's prefab stands its mesh at (the model root's m_LocalScale,
 *  kept by ImportCustomGameobject). The stand-in had been the mesh at 1, and off its origin by the mesh's width: built
 *  from -0.4 to 2.75 m, where the mesh as Unity imports it (x mirrored, as the docks') runs from -2.76 to 0.43 - its high
 *  back on -x, its counter at the origin. */
export const RMBRP_STALL_SCALE = 0.75;
/** FIELD BUGS 2026-10-16b STALL-SHAPE: THE PACK'S STALL, MEASURED - ext_city_stall001-013 (the mesh of 53099-53112) off
 *  the pack's published FBX (Assets/Meshes/Market), in its metres as Unity imports it (x mirrored), before
 *  RMBRP_STALL_SCALE. Four posts 0.375 m square - `back` and `front` their x, `sides` their z, `tops` the back pair's and
 *  the front pair's; a beam across the back pair and a lintel across the front pair, each [its underside, its top]; the
 *  awning laid from the beam's top down to the lintel's, cloth `valance` deep under each of its sides and over the
 *  beam's face and the lintel's (the lintel's fringe the front's headroom, 2.17 m at the prefab's scale); and a counter
 *  at the front, its top 1.04 m over the origin - where its author lays the goods. The posts stand on the origin (the
 *  pack's run 0.112 under it: its author's stalls stand 0.025 under the street). The outer faces stand where TEMPLE-STEPS
 *  measured the box - the back at -2.75 (the pack's -2.757), the counter's front at 0.4 (0.43), the back posts' tops at
 *  4.4 (4.388), the far side at 2.4 (2.395), never 3 cm off: the box a yard's saved stall is placed by. The stand-in had
 *  been posts 0.12 m thick, a counter 0.75 m high and 0.45 m deep at the front's foot (the author's goods 0.3 m over it,
 *  or off its back over nothing), the awning's low edge at 1.84 m (the pack's lintel 2.26 m) and a bench 0.53 m high
 *  where the stall-keeper stands - 20 of the 30 the author laid stood inside it. */
export const RMBRP_STALL_FRAME = Object.freeze({
  back: Object.freeze([-2.75, -2.382]), front: Object.freeze([-0.257, 0.118]),
  sides: Object.freeze([Object.freeze([-2.48, -2.105]), Object.freeze([2.02, 2.4])]), tops: Object.freeze([4.4, 3.638]),
  beam: Object.freeze([3.76, 4.138]), lintel: Object.freeze([3.01, 3.388]), valance: 0.5,
  counter: Object.freeze({ x: Object.freeze([-1.07, 0.4]), z: Object.freeze([-1.792, 1.708]), top: 1.388 }),
});
/** STALL-SHAPE: the pack's other stall - ext_city_stall014-025, the mesh of every prefab from 53113 on: the same frame
 *  0.2 m further back, 0.206 up and 0.066 across (its posts still on the origin), and no counter - its author lays the
 *  goods on the ground under it, where the stand-in's counter had buried them. */
export const RMBRP_STALL_OPEN_FIRST = 53113;
export const RMBRP_STALL_OPEN_SHIFT = Object.freeze([-0.2, 0.206, 0.066]);
const STALL_WOOD = [67, 1], STALL_FRINGE = [49, 9];   // STALL-SHAPE: the valance the prefab's own (its material 1)
function stall(cloth, open = false) {
  const F = RMBRP_STALL_FRAME, [dx, dy, dz] = open ? RMBRP_STALL_OPEN_SHIFT : [0, 0, 0], m = new MeshBuilder();
  const X = (v) => v + dx, Y = (v) => v + dy, Z = (v) => v + dz;
  const block = (tex, [x0, x1], [y0, y1], [z0, z1]) => m.box(tex, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], 0.5);
  for (const side of F.sides) {
    block(STALL_WOOD, F.back.map(X), [0, Y(F.tops[0])], side.map(Z));
    block(STALL_WOOD, F.front.map(X), [0, Y(F.tops[1])], side.map(Z));
  }
  const near = Z(F.sides[0][0]), far = Z(F.sides[1][1]), inner = [Z(F.sides[0][1]), Z(F.sides[1][0])], v = F.valance;
  const [bx, fx, by, fy] = [X(F.back[1]), X(F.front[0]), Y(F.beam[1]), Y(F.lintel[1])], run = Math.hypot(fx - bx, fy - by);
  block(STALL_WOOD, [X(F.back[0]) + 0.01, bx], F.beam.map(Y), inner);    // the beam and the lintel, each a hair inside its fringe
  block(STALL_WOOD, [fx, X(F.front[1]) - 0.005], F.lintel.map(Y), inner);
  const across = inner[1] - inner[0], hem = [[0, 0], [0, -across], [1, -across], [1, 0]];
  for (const [x, top, nx] of [[X(F.back[0]), by, -1], [X(F.front[1]), fy, 1]]) {
    m.sheet(STALL_FRINGE, [x, top - v, inner[0]], [x, top - v, inner[1]], [x, top, inner[1]], [x, top, inner[0]], [nx, 0, 0], hem);
  }
  // the awning, its normal up its slope, and a valance under each side
  m.sheet(cloth, [bx, by, near], [bx, by, far], [fx, fy, far], [fx, fy, near], [(by - fy) / run, (fx - bx) / run, 0], [[0, 0], [(far - near) / 2, 0], [(far - near) / 2, -run / 2], [0, -run / 2]]);
  for (const [z, nz] of [[near, -1], [far, 1]]) m.sheet(STALL_FRINGE, [bx, by - v, z], [fx, fy - v, z], [fx, fy, z], [bx, by, z], [0, 0, nz], [[0, 0], [0, -run], [1, -run], [1, 0]]);
  if (!open) block(STALL_WOOD, F.counter.x, [0, F.counter.top], F.counter.z);
  const built = m.build();
  for (let i = 0; i < built.positions.length; i++) built.positions[i] *= RMBRP_STALL_SCALE;   // a uniform scale: the normals and the winding hold
  return built;
}
/** FIELD BUGS 2026-10-15f TEMPLE-STEPS: the pack's two stone blocks - the temple's platform (53160, Platform-Temple.fbx)
 *  and the foundation (53170, Foundation 1.fbx) - are one mesh, a box of +-160 x +-80 x +-160 centimetres centred on
 *  its origin, as Unity imports it: each prefab's MeshFilter names the mesh itself, so the FBX node it was exported on,
 *  and that node's Lcl Scaling (125 on the platform's, 250 on the foundation's), is never instanced - only the prefab's
 *  own scale is, which Daggerfall Unity keeps (MeshReplacement.ImportCustomGameobject multiplies it in; DOME_UNIT reads
 *  the domes the same way). The box in centimetres, and each prefab's scale: */
export const RMBRP_BLOCK_CM = Object.freeze([320, 160, 320]);
export const RMBRP_BLOCK_SCALE = Object.freeze({ 53160: 1, 53170: 2 });
const rmbrpBlock = (id, tex) => () => {
  const m = new MeshBuilder(), k = RMBRP_BLOCK_SCALE[id] / 100;
  m.box(tex, [0, 0, 0], RMBRP_BLOCK_CM.map((c) => c * k), 0.5);
  return m.build();
};
/** A temple's platform: a stone landing 3.2 m square and 1.6 m high, centred on its origin - its top the step of the
 *  temple door it stands at, and the foot of the stair below (TEMPASF1). */
const platform = rmbrpBlock(53160, [361, 1]);
/** A building's foundation where the ground falls away: a stone block 6.4 m square and 3.2 m high, centred on its
 *  origin - its top the floor of the two temples Beautiful Villages stands it under (TEMPASF1, TEMPASH4: 1.55-1.6 m over
 *  the origin), the author's stairs and landings against its faces. */
const foundation = rmbrpBlock(53170, [317, 0]);
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
/** A prism of the four (x, y) `corners`, standing from z0 to z1 - its sides wound by the corners' own order, read off
 *  their area. ROCK-SMEAR, found beside it: the sides took "counter-clockwise seen from +z" on trust, and both callers
 *  hand it a clockwise list (the ramp's reversed, the steps' mirrored by dockPoint), so the ramp's deck and both
 *  stringers looked into their prisms - drawn inside out under the world's culling. */
export function prismZ(m, tex, corners, z0, z1) {
  let area = 0;
  for (let i = 0; i < corners.length; i++) { const a = corners[i], b = corners[(i + 1) % corners.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const pts = area < 0 ? [...corners].reverse() : corners;   // counter-clockwise seen from +z: each side's outward normal is its edge turned right
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
  ...Object.fromEntries(Object.keys(RMBRP_ROCKS).map((id) => [id, () => rockMesh(id)])),   // TEMPLE-STEPS: each over its mesh's box, at its prefab's scale
  ...Object.fromEntries(Object.entries(RMBRP_HILLS).map(([id, surface]) => [id, () => hillMesh(RMBRP_HILL_SHAPES[id], surface)])),   // HILL-SHAPES
  ...Object.fromEntries(Object.entries(RMBRP_STALLS).map(([id, cloth]) => [id, () => stall(cloth, Number(id) >= RMBRP_STALL_OPEN_FIRST)])),   // STALL-SHAPE: the pack's two meshes
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
