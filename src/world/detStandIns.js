// DAGGERFALL EXPANDED TEXTURES' PIECES THE TOWN MODS PLACE, STOOD IN BY THE PORT (WD3, 2026-10-01).
//
// Beautiful Villages and Beautiful Cities place Ninelan's *Daggerfall Expanded Textures* (DET) models some 75,000
// times - the timbers of every interior's ceiling and fireplace, the chimneys on its roofs, the tapestries on its
// walls - and its flats on tables, shelves and farms. DET is not part of this port. Mac's answer for a peer the port
// lacks (2026-09-25, asked outright) was "build your own", so every piece here is the PORT'S OWN stand-in, never a copy
// of DET, which the port has never seen. What each piece is was read off the RMB Resource Pack's DET catalogue (which
// names each id - `Pillar - Wood`, `Chimney - Stackable Flue`, `Kynareth`, `Decorative`) and off the placements.
//
// The models are built here, in metres in Unity's frame (dfMeshToModel's shape), and textured with CLASSIC textures
// (0_77, 67_x, 116_4 and the rest), so they come out of the player's ARENA2 like every other model. The flats are the
// player's own records (formats/derivedTexture.js), sized as the record sizes itself, or the port's own drawings
// (world/standInSprites.js). Each id has ONE stand-in; it answers while any switch it is handed is on
// (`installDetStandIns` OR's them). The models are `DET_MODELS` and `DET_TOWN_MODELS`; the cloth they wear is
// world/townPictures.js.

import { registerCustomModel } from './customModels.js';
import { chestModel, SEA_CHEST_BOX, SEA_CHEST_LOOK } from './chestModel.js';   // CHEST3D: the sea chest is the chest
import { addVendorTextures } from '../systems/textureReplacement.js';
import { buildDerivedPicture } from '../formats/derivedTexture.js';
import { TOWN_PICTURE_ARCHIVE, PICTURE, townPictureEntries } from './townPictures.js';   // WD3: the cloth the tapestries wear
import { STAND_IN_SPRITES } from './standInSprites.js';   // WD3: the flats Daggerfall draws nothing like

// ---- the classic textures the stand-ins wear -----------------------------
const ROPE = [0, 77];        // #453f2a - the classic ship's rigging colour (model 910 wears it)
const IRON = [0, 79];        // #322d22 - the darkest of that ramp, for bands, chains and frames
const WOOD = [67, 0];        // the ship's own planking
const WOOD_DARK = [67, 8];   // a darker plank of the same set
const CLOTH = [116, 4];      // the sail the classic ship flies
// WD3: the towns' pieces
const TIMBER = [67, 14];     // the dark beam a classic interior frames its walls with (3300's posts, 31305's frames)
const STONE = [87, 5];       // the grey block stone of the fireplace's own set (TEXTURE.087)
const FLUE = [317, 0];       // cobbled stone of the city-wall set (17) - swapped by climate like the walls it stands by
const FLUE_TOP = [317, 2];   // the same set's dark slate
const SOOT = [0, 79];        // a flue's mouth
const TERRACOTTA = [0, 36];  // #b47150
const SOIL = [0, 45];        // #4f3f2b
const BARK = [0, 44];        // #5b4326
const HEARTWOOD = [0, 69];   // #ad7f4e - a cut stump's face
const LEAVES = [TOWN_PICTURE_ARCHIVE, PICTURE.leaves];

/** A mesh in dfMeshToModel's shape, grown one face at a time. Every face is
 *  wound so cross(b - a, c - a) points along its normal - the port's front
 *  face (the classic models' own convention, measured). */
export class MeshBuilder {
  constructor() { this.groups = new Map(); }
  _group(tex) {
    const key = `${tex[0]}_${tex[1]}`;
    let g = this.groups.get(key);
    if (!g) { g = { archive: tex[0], record: tex[1], positions: [], normals: [], uvs: [], indices: [] }; this.groups.set(key, g); }
    return g;
  }
  /** One triangle with a normal; the winding is corrected to face along it. */
  tri(tex, a, b, c, n, ua = [0, 0], ub = [1, 0], uc = [1, -1]) {
    // the last picture's group kept: a model lays many faces of one picture in a row (a town's fences, its beds)
    const g = tex === this._lastTex ? this._lastGroup : (this._lastGroup = this._group((this._lastTex = tex)));
    const abX = b[0] - a[0], abY = b[1] - a[1], abZ = b[2] - a[2], acX = c[0] - a[0], acY = c[1] - a[1], acZ = c[2] - a[2];
    const flip = (abY * acZ - abZ * acY) * n[0] + (abZ * acX - abX * acZ) * n[1] + (abX * acY - abY * acX) * n[2] < 0;
    const [second, secondUv, third, thirdUv] = flip ? [c, uc, b, ub] : [b, ub, c, uc];
    const base = g.positions.length / 3;
    g.positions.push(a[0], a[1], a[2], second[0], second[1], second[2], third[0], third[1], third[2]);
    g.normals.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    g.uvs.push(ua[0], ua[1], secondUv[0], secondUv[1], thirdUv[0], thirdUv[1]);
    g.indices.push(base, base + 1, base + 2);
  }
  /** A quad p0-p1-p2-p3 (in order round its edge) facing n; `uv` its four corners. */
  quad(tex, p0, p1, p2, p3, n, uv = [[0, 0], [1, 0], [1, -1], [0, -1]]) {
    this.tri(tex, p0, p1, p2, n, uv[0], uv[1], uv[2]);
    this.tri(tex, p0, p2, p3, n, uv[0], uv[2], uv[3]);
  }
  /** Both faces of a thin sheet (a flag). */
  sheet(tex, p0, p1, p2, p3, n, uv) {
    this.quad(tex, p0, p1, p2, p3, n, uv);
    this.quad(tex, p0, p1, p2, p3, [-n[0], -n[1], -n[2]], uv);
  }
  /** An axis-aligned box centred at c with extents s. */
  box(tex, c, s, uvScale = 1) {
    const [cx, cy, cz] = c, [hx, hy, hz] = [s[0] / 2, s[1] / 2, s[2] / 2];
    const P = (x, y, z) => [cx + x * hx, cy + y * hy, cz + z * hz];
    const u = (w, h) => [[0, 0], [w * uvScale, 0], [w * uvScale, -h * uvScale], [0, -h * uvScale]];
    this.quad(tex, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), [0, 0, 1], u(s[0], s[1]));
    this.quad(tex, P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), [0, 0, -1], u(s[0], s[1]));
    this.quad(tex, P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), [1, 0, 0], u(s[2], s[1]));
    this.quad(tex, P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), [-1, 0, 0], u(s[2], s[1]));
    this.quad(tex, P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), [0, 1, 0], u(s[0], s[2]));
    this.quad(tex, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), [0, -1, 0], u(s[0], s[2]));
  }
  /** A cylinder along +Y from `base`, radius r, height h, `seg` sides, capped. `vRepeat` metres per texture height. */
  cylinderY(tex, base, r, h, seg = 6, vRepeat = 0.5, caps = true) {
    const [bx, by, bz] = base;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const p = (a, y) => [bx + Math.cos(a) * r, by + y, bz + Math.sin(a) * r];
      const n = [Math.cos(am), 0, Math.sin(am)];
      const u0 = i / seg, u1 = (i + 1) / seg, v = -h / vRepeat;
      this.quad(tex, p(a0, 0), p(a1, 0), p(a1, h), p(a0, h), n, [[u0, 0], [u1, 0], [u1, v], [u0, v]]);
      if (caps) {
        this.tri(tex, [bx, by + h, bz], p(a0, h), p(a1, h), [0, 1, 0]);
        this.tri(tex, [bx, by, bz], p(a1, 0), p(a0, 0), [0, -1, 0]);
      }
    }
  }
  /** A cylinder along +X from `base` (a rung, a crossbar). */
  cylinderX(tex, base, r, len, seg = 5) {
    const [bx, by, bz] = base;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const p = (a, x) => [bx + x, by + Math.cos(a) * r, bz + Math.sin(a) * r];
      this.quad(tex, p(a0, 0), p(a1, 0), p(a1, len), p(a0, len), [0, Math.cos(am), Math.sin(am)], [[0, 0], [len * 2, 0], [len * 2, -0.25], [0, -0.25]]);
    }
  }
  build() {
    let nv = 0, ni = 0;
    for (const g of this.groups.values()) { nv += g.positions.length / 3; ni += g.indices.length; }
    const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
    const subMeshes = [];
    let v = 0, i = 0;
    for (const g of this.groups.values()) {
      positions.set(g.positions, v * 3); normals.set(g.normals, v * 3); uvs.set(g.uvs, v * 2);
      for (let k = 0; k < g.indices.length; k++) indices[i + k] = g.indices[k] + v;
      subMeshes.push({ textureArchive: g.archive, textureRecord: g.record, startIndex: i, primitiveCount: g.indices.length / 3 });
      v += g.positions.length / 3; i += g.indices.length;
    }
    return { positions, normals, uvs, indices, subMeshes, doors: [] };
  }
}

const U = 0.025;   // MeshReader.GlobalScale: one classic unit in metres
/** The length of DET's wooden pillar: the towns stack its rafters and mantels 85 units apart. */
export const DET_SEGMENT_UNITS = 85;

/** Ten models, by the DET id the towns name. Origins sit where the placements say:
 *  a column piece at its foot, a hanging piece at its hook, a floor piece on the floor. */
export const DET_MODELS = Object.freeze({
  // DET's 'Pillar - Wood', a segment long, standing on its foot: a squared timber six units thick - the shelf of every
  // town fireplace's mantel (two, laid along it, the lower one half as deep; 10,004 placements).
  45081: () => timber(TIMBER, 6, DET_SEGMENT_UNITS),
  // 'Pillar - Wood' again, eight units: the rafters and tie-beams of a beamed hall (29,249 in the towns, stretched along
  // their length).
  45110: () => timber(TIMBER, 8, DET_SEGMENT_UNITS),
  // DET's 'Wind Wane - Dog': a finial and a vane of cloth on a rod; the towns stand it on high beams.
  45121: () => {
    const m = new MeshBuilder();
    m.box(WOOD_DARK, [0, 0.04, 0], [0.07, 0.08, 0.07], 4);
    m.sheet(CLOTH, [0.02, 0.1, 0], [0.62, 0.12, 0], [0.62, 0.48, 0], [0.02, 0.5, 0], [0, 0, 1], [[0, 0], [1, 0], [1, -1], [0, -1]]);
    m.cylinderY(ROPE, [0, 0.08, 0], 0.012, 0.44, 4, 0.4, false);
    return m.build();
  },
  // DET's decorative tapestries, hung on town walls.
  45164: () => hanging(DET_PICTURES[45164], 0.8, 1.2),
  45161: () => hanging(DET_PICTURES[45161], 0.8, 1.2),
  // A staff, a cap at its head (451 placements in the towns).
  45082: () => { const m = new MeshBuilder(); m.cylinderY(WOOD, [0, 0, 0], 0.045, 2.1, 6, 0.6); m.box(WOOD_DARK, [0, 2.13, 0], [0.1, 0.07, 0.1], 4); return m.build(); },
  // Another decorative tapestry: seventy-two hang on town walls.
  45162: () => hanging(DET_PICTURES[45162], 0.8, 1.2),
  // Kynareth's tapestry, in her temples.
  45145: () => hanging(DET_PICTURES[45145], 1.0, 1.5),
  // A sea chest, lengthwise on its own X - CHEST3D: the owner's chest (world/chestModel.js), its latch to +z.
  45190: () => chestModel(SEA_CHEST_BOX, SEA_CHEST_LOOK),
  // A weapon rack: two posts, two rails, the spears between.
  45191: () => {
    const m = new MeshBuilder();
    for (const x of [-0.55, 0.55]) { m.box(WOOD_DARK, [x, 0.65, 0], [0.08, 1.3, 0.08]); m.box(WOOD_DARK, [x, 0.03, 0], [0.12, 0.06, 0.4]); }
    m.box(WOOD, [0, 1.1, 0], [1.18, 0.07, 0.07]);
    m.box(WOOD, [0, 0.35, 0.06], [1.18, 0.07, 0.07]);
    for (let i = 0; i < 5; i++) {
      const x = -0.4 + i * 0.2;
      m.cylinderY(WOOD, [x, 0.08, 0.06], 0.018, 1.55, 5, 0.6, false);
      m.box(IRON, [x, 1.66, 0.06], [0.04, 0.16, 0.02]);
    }
    return m.build();
  },
});

// ---- WD3: the rest of the towns' pieces --------------------------------------------------------------------------

/** A squared timber `side` units thick and `len` long, standing on its origin, the grain of `tex` along its length. */
function timber(tex, side, len) {
  const m = new MeshBuilder();
  squared(m, tex, tex, (side * U) / 2, (side * U) / 2, 0, len * U, 1.6);
  return m.build();
}
/** The four sides of an upright block (half-widths hx, hz, from y0 to y1) in `tex`, its two ends in `capTex`; the
 *  picture runs along the height every `repeat` metres and once across each face. */
function squared(m, tex, capTex, hx, hz, y0, y1, repeat = 1.6, cx = 0, cz = 0) {
  const P = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  const along = (y1 - y0) / repeat;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % 4];
    const n = i === 0 ? [0, 0, -1] : i === 1 ? [1, 0, 0] : i === 2 ? [0, 0, 1] : [-1, 0, 0];
    m.quad(tex, [cx + ax, y0, cz + az], [cx + bx, y0, cz + bz], [cx + bx, y1, cz + bz], [cx + ax, y1, cz + az], n, [[0, 0], [0, -1], [along, -1], [along, 0]]);
  }
  m.quad(capTex, [cx - hx, y1, cz - hz], [cx + hx, y1, cz - hz], [cx + hx, y1, cz + hz], [cx - hx, y1, cz + hz], [0, 1, 0]);
  m.quad(capTex, [cx - hx, y0, cz + hz], [cx + hx, y0, cz + hz], [cx + hx, y0, cz - hz], [cx - hx, y0, cz - hz], [0, -1, 0]);
}
/** Cloth hung from a rod at the origin: `w` wide, `h` long, the picture the right way round from both faces; a
 *  banner's foot is cut in a swallow-tail. */
function hanging(record, w, h, { banner = false } = {}) {
  const m = new MeshBuilder(), tex = [TOWN_PICTURE_ARCHIVE, record], hw = w / 2, z = 0.004;
  for (const side of [1, -1]) {
    const n = [0, 0, side], zz = z * side, L = hw * side;   // L: the picture's left edge as this face's viewer sees it
    const uv = (x, y) => [(L - x) / (2 * L), y / h];
    const P = (x, y) => [x, y, zz];
    const cut = banner ? h * 0.8 : h;
    m.quad(tex, P(L, 0), P(-L, 0), P(-L, -cut), P(L, -cut), n, [uv(L, 0), uv(-L, 0), uv(-L, -cut), uv(L, -cut)]);
    if (banner) {
      const notch = -cut - (h - cut) * 0.45;
      for (const e of [L, -L]) {
        m.tri(tex, P(e, -cut), P(0, -cut), P(0, notch), n, uv(e, -cut), uv(0, -cut), uv(0, notch));
        m.tri(tex, P(e, -cut), P(0, notch), P(e, -h), n, uv(e, -cut), uv(0, notch), uv(e, -h));
      }
    }
  }
  m.cylinderX(WOOD, [-hw - 0.04, 0, 0], 0.016, w + 0.08, 6);
  return m.build();
}
/** A rug on the floor, its picture on top: `w` by `d` metres, a centimetre thick, the origin under its middle. */
function rugModel(record, w, d) {
  const m = new MeshBuilder(), tex = [TOWN_PICTURE_ARCHIVE, record], hw = w / 2, hd = d / 2, t = 0.012;
  m.quad(tex, [hw, t, -hd], [-hw, t, -hd], [-hw, t, hd], [hw, t, hd], [0, 1, 0], [[0, 0], [1, 0], [1, -1], [0, -1]]);
  squared(m, SOIL, SOIL, hw, hd, 0, t * 0.999, 1.6);
  return m.build();
}
/** A low dome of `rings` bands over a circle of radius r at centre c. */
function dome(m, tex, c, r, hgt, seg = 8, rings = 3) {
  const P = (k, i) => { const a = (i / seg) * Math.PI * 2, t = (k / rings) * (Math.PI / 2); return [c[0] + Math.cos(a) * r * Math.cos(t), c[1] + hgt * Math.sin(t), c[2] + Math.sin(a) * r * Math.cos(t)]; };
  for (let k = 0; k < rings; k++) for (let i = 0; i < seg; i++) {
    const a = P(k, i), b = P(k, i + 1), d = P(k + 1, i), e = P(k + 1, i + 1);
    const mid = [(a[0] + e[0]) / 2 - c[0], (a[1] + e[1]) / 2 - c[1], (a[2] + e[2]) / 2 - c[2]], l = Math.hypot(...mid) || 1;
    const n = [mid[0] / l, mid[1] / l, mid[2] / l];
    if (k === rings - 1) m.tri(tex, a, b, d, n); else m.quad(tex, a, b, e, d, n);
  }
}
/** DET's chimney flue: 53 units square, 114 tall - the step its stacks climb by (3,334 stacks of two and more) - on its
 *  foot; dark at the mouth. */
function flue() { const m = new MeshBuilder(), h = (53 * U) / 2; squared(m, FLUE, SOOT, h, h, 0, 114 * U, 1.6); return m.build(); }
/** DET's chimney topper, on the topmost flue: a corbelled cap, a crown and two pots. */
function flueTopper() {
  const m = new MeshBuilder();
  squared(m, FLUE_TOP, FLUE_TOP, (61 * U) / 2, (61 * U) / 2, 0, 8 * U, 1.6);
  squared(m, FLUE, FLUE_TOP, (45 * U) / 2, (45 * U) / 2, 8 * U, 20 * U, 1.6);
  for (const x of [-9, 9]) { m.cylinderY(TERRACOTTA, [x * U, 20 * U, 0], 5 * U, 14 * U, 8, 0.6, false); m.cylinderY(SOOT, [x * U, 33.5 * U, 0], 3.5 * U, 0.5 * U, 8, 0.6, true); }
  return m.build();
}
/** DET's sloped chimney base: the shoulder a chimney breast stands on - a deep course and a shallower one over it. */
function flueBase() {
  const m = new MeshBuilder();
  squared(m, FLUE, FLUE_TOP, (53 * U) / 2, (80 * U) / 2, 0, 30 * U, 1.6);
  squared(m, FLUE, FLUE_TOP, (53 * U) / 2, (66 * U) / 2, 30 * U, 60 * U, 1.6, 0, -7 * U);
  return m.build();
}
/** A stump of a round log, cut flat. */
function stump() { const m = new MeshBuilder(); m.cylinderY(BARK, [0, 0, 0], 0.2, 0.4, 8, 0.4, false); dome(m, HEARTWOOD, [0, 0.4, 0], 0.2, 0.001, 8, 1); return m.build(); }
/** A clay pot, its earth, a plant over it. */
function flowerPot() {
  const m = new MeshBuilder();
  m.cylinderY(TERRACOTTA, [0, 0, 0], 0.13, 0.22, 8, 0.4, false);
  dome(m, SOIL, [0, 0.2, 0], 0.125, 0.001, 8, 1);
  dome(m, LEAVES, [0, 0.21, 0], 0.18, 0.2, 8, 3);
  return m.build();
}
/** A temple column's drum, 57 units long (the step 45169's stacks climb by), a stone cylinder on its foot. */
function columnDrum() { const m = new MeshBuilder(); m.cylinderY(STONE, [0, 0, 0], 10 * U, 57 * U, 10, 1.2, false); return m.build(); }
/** A column's head: an abacus slab on an echinus. */
function columnHead() {
  const m = new MeshBuilder();
  squared(m, STONE, STONE, 13 * U, 13 * U, 0, 6 * U, 1.6);
  squared(m, STONE, STONE, 17 * U, 17 * U, 6 * U, 12 * U, 1.6);
  return m.build();
}

const DECOR_ORDER = Object.freeze([45134, 45135, 45136, 45137, 45138, 45139, 45140, 45158, 45159, 45160, 45161, 45162, 45163, 45164]);
const decor = (id) => PICTURE.decorative(DECOR_ORDER.indexOf(id));
const REGIONS = Object.freeze([['Glenpoint', 45008, 45044], ['Totambu', 45023, 45059], ['Lainlyn', 45024, 45060], ['Santaki', 45029, 45065], ['Abibon-Gora', 45034, 45070]]);
const DIVINES = Object.freeze(['Akatosh', 'Arkay', 'Dibella', 'Julianos', 'Kynareth', 'Zenithar', 'Mara', 'Stendarr']);
const DIVINE_TAPESTRIES = Object.freeze(DIVINES.map((god) => 45141 + DIVINES.indexOf(god)));   // Kynareth's, 45145, among them
const DIVINE_BANNERS = Object.freeze(DIVINES.map((_god, k) => 45150 + k));

/** THE PICTURE EACH OF DET'S HANGINGS AND RUGS WEARS (world/townPictures.js, TOWN_PICTURE_ARCHIVE), by id - the one table
 *  its builder and its name in the house decorator (systems/decor/decorMods.js decorModNaming) both read. AUDIT 05b A8: the
 *  name was read off the built model - a whole model built to name a piece, and none to be had while its switch was off. */
export const DET_PICTURES = Object.freeze({
  ...Object.fromEntries(REGIONS.flatMap(([name, tapestry, flag]) => [[tapestry, PICTURE.regionTapestry(name)], [flag, PICTURE.regionBanner(name)]])),
  ...Object.fromEntries(DIVINE_TAPESTRIES.map((id, k) => [id, PICTURE.divineTapestry(DIVINES[k])])),
  ...Object.fromEntries(DIVINE_BANNERS.map((id, k) => [id, PICTURE.divineBanner(DIVINES[k])])),
  ...Object.fromEntries(DECOR_ORDER.map((id) => [id, decor(id)])),   // 45161, 45162 and 45164 built in DET_MODELS
  45192: PICTURE.rug(0), 45194: PICTURE.rug(1),
});

/** The rest of the DET models the town mods place, by id, read off the catalogue's names and the placements
 *  (bible `03-World/Beautiful-Towns.md` keeps the table). */
export const DET_TOWN_MODELS = Object.freeze({
  // the regions' tapestries and banners (on house fronts and in halls)
  ...Object.fromEntries(REGIONS.flatMap(([_name, tapestry, flag]) => [
    [tapestry, () => hanging(DET_PICTURES[tapestry], 0.9, 1.35)],
    [flag, () => hanging(DET_PICTURES[flag], 0.6, 1.6, { banner: true })],
  ])),
  // the Eight's tapestries (45141-45148; Kynareth's, 45145, is built in DET_MODELS) and their second set (45150-45157)
  ...Object.fromEntries(DIVINE_TAPESTRIES.filter((id) => id !== 45145).map((id) => [id, () => hanging(DET_PICTURES[id], 1.0, 1.5)])),
  ...Object.fromEntries(DIVINE_BANNERS.map((id) => [id, () => hanging(DET_PICTURES[id], 0.7, 1.8, { banner: true })])),
  // the decorative tapestries
  ...Object.fromEntries(DECOR_ORDER.filter((id) => ![45161, 45162, 45164].includes(id)).map((id) => [id, () => hanging(DET_PICTURES[id], 0.8, 1.2)])),
  // the chimney: its sloped base, the stackable flue, the topper
  45074: flueBase,
  45076: flue,
  45077: flueTopper,
  // the wind vane - a rooster's, as the dog's (45121) stands
  45087: () => DET_MODELS[45121](),
  // the pillars: wood (a third thickness), thin wood, stone (on its side, the hearth before every fireplace)
  45111: () => timber(TIMBER, 10, DET_SEGMENT_UNITS),
  45112: () => timber(TIMBER, 4, DET_SEGMENT_UNITS),
  45113: () => timber(TIMBER, 4, DET_SEGMENT_UNITS),
  45129: () => timber(STONE, 6, DET_SEGMENT_UNITS),
  // a stump; a flower pot
  45114: stump,
  45115: stump,
  45120: flowerPot,
  45122: flowerPot,
  // a temple's column drums and their head
  45169: columnDrum,
  45170: columnHead,
  // two rugs by a bed
  45192: () => rugModel(DET_PICTURES[45192], 1.2, 0.8),
  45194: () => rugModel(DET_PICTURES[45194], 1.2, 0.8),
});

// ---- the flats ---------------------------------------------------------------

/** DET flat records stood in by the player's own sprite of the same kind: [classic archive, record] - the thing DET's
 *  catalogue names it, as the town placements bear out (a large sack on a storeroom floor 138 times, a tiny globe on a
 *  high shelf 200 times). 10021_22 and _27 and 10027_4 to _14 no town places: a removed mod's ships stood them
 *  and the decorator offers them still (systems/decor/decorMods.js DECOR_MOD_KEPT). */
export const DET_FLAT_STAND_INS = Object.freeze({
  10021: Object.freeze({ 13: [218, 0], 17: [213, 0], 22: [200, 1], 27: [205, 30] }),   // broth in its pot; an orange; a goblet; a bucket
  10025: Object.freeze({ 3: [205, 17] }),   // a large sack
  10027: Object.freeze({
    0: [208, 0], 4: [205, 22], 5: [205, 23], 6: [205, 17], 7: [205, 18], 8: [205, 24], 9: [205, 25],
    10: [205, 0], 11: [200, 1], 12: [205, 30], 13: [218, 4], 14: [204, 7],
  }),
});
/** WD3: the DET records whose thing Daggerfall draws nothing like - the port's own sprite (world/standInSprites.js),
 *  by name, and the record scale it stands at (DFU grows a sprite by `1 + scale / 256`; a pixel is 2.5 cm at 0). */
export const DET_FLAT_DRAWINGS = Object.freeze({
  10009: Object.freeze({ 14: ['monkey', 0] }),
  10010: Object.freeze({
    3: ['brownRooster', 0], 4: ['brownChickenPecking', 0], 5: ['brownChicken', 0], 6: ['brownChickenLooking', 0],
    15: ['sheep', 128], 16: ['sheepFront', 128], 17: ['sheepResting', 128],
    22: ['whiteChickenLooking', 0], 23: ['whiteChicken', 0], 24: ['whiteChickenPecking', 0], 25: ['whiteRooster', 0],
    36: ['blackRat', 0], 38: ['brownRat', 0], 40: ['blackRatSitting', 0],
    42: ['dove', 0], 43: ['dovePecking', 0], 44: ['dove', 0], 45: ['doveWing', 0], 46: ['dovePecking', 0],
    47: ['dove', 0], 48: ['doveWing', 0], 49: ['dovePecking', 0], 50: ['dove', 0],
  }),
  10021: Object.freeze({
    0: ['cherries', -128], 1: ['pear', -96], 2: ['plum', -96], 3: ['peach', -96], 4: ['olives', -64],
    5: ['cheeseWheel', -32], 6: ['cheeseWheelCut', -32], 7: ['cheeseSlice', -64], 8: ['cheeseSliceHoles', -64], 9: ['cheeseWheel', -32],
    10: ['softCheese', -64], 11: ['roastPlatter', -32], 12: ['porridge', -64], 14: ['grapes', -96], 15: ['whiteGrapes', -96], 16: ['cabbage', -64],
  }),
  10022: Object.freeze({ 4: ['easel', 64] }),
  10023: Object.freeze({ 0: ['firewood', 0] }),
  10024: Object.freeze({ 0: ['wheatBundle', 64], 1: ['grainPile', 0] }),
  10025: Object.freeze({ 0: ['brokenBottles', -64] }),
  10027: Object.freeze({ 1: ['blockToy', -96], 3: ['rollingPin', -96] }),
});
/** WD3: more DET records whose thing Daggerfall has a sprite of: [archive, record, size] - the
 *  player's own sprite at `size` times the size it stands at itself (a calf is the grazing cow at three fifths). */
export const DET_TOWN_FLATS = Object.freeze({
  10010: Object.freeze({
    18: [201, 3, 1], 19: [201, 4, 0.6], 20: [201, 3, 1.1],                       // a brown cow, a curious calf, a bull
    51: [201, 0, 1], 52: [201, 0, 1],                                          // two brown horses
    73: [201, 9, 1], 74: [201, 10, 1], 75: [201, 9, 1], 76: [201, 10, 1], 77: [201, 9, 1], 78: [201, 10, 1],   // the Great Daenian dogs
  }),
  10024: Object.freeze({ 2: [205, 17, 1] }),        // a sack of grain
  10025: Object.freeze({ 2: [213, 4, 1] }),         // a pine planter
  10028: Object.freeze({ 4: [202, 4, 1] }),         // a statue on its pedestal
});
/** WD3: archives the town mods name by DET's OLD numbers (1010 for 10010, 1021, 1025 - a handful of placements left from
 *  the editor's older catalogue): the same records stand in for them. */
export const DET_OLD_ARCHIVES = Object.freeze({ 1010: 10010, 1021: 10021, 1025: 10025 });


/** A stand-in flat that is the player's own classic record `from` ([archive, record]) at `size` times the size it
 *  stands at itself - its record scale grown, as DFU grows a sprite by `1 + scale / 256`. */
export function classicFlatEntry({ archive, record, from, size = 1, gate, fileName }) {
  return {
    archive, record, fileName, standIn: true, gate,
    build: async (ctx) => {
      const pic = await buildDerivedPicture({ from }, ctx.classicRgba);
      const own = (await ctx.classicScale?.(from[0], from[1])) ?? null;
      if (size === 1) return { ...pic, scale: own };   // sized as the classic sprite sizes itself
      const grow = (s) => Math.round(256 * (size * (1 + (s ?? 0) / 256) - 1));
      return { ...pic, scale: { width: grow(own?.width), height: grow(own?.height) } };
    },
  };
}

let _installed = false;
const _gates = new Set();
/** WD3: on while any switch the pieces were handed is on - the town mods' load. */
export const detStandInsOn = () => { for (const g of _gates) if (g() === true) return true; return false; };
/** The models on the model door and the flats and pictures on the texture door, once, all behind `detStandInsOn`;
 *  every call adds the switch it is handed to the ones that turn them on. */
export function installDetStandIns(isOn) {
  if (typeof isOn === 'function') _gates.add(isOn);
  if (_installed) return 0;
  _installed = true;
  const gate = detStandInsOn;
  for (const [id, build] of Object.entries({ ...DET_MODELS, ...DET_TOWN_MODELS })) registerCustomModel(Number(id), build, gate);
  const entries = [];
  const classic = (archive, record, from, size = 1) => classicFlatEntry({ archive, record, from, size, gate, fileName: `det-stand-in-${archive}_${record}` });
  const drawn = (archive, record, [name, scale]) => ({
    archive, record, fileName: `det-stand-in-${archive}_${record}`, standIn: true, gate,
    build: async () => ({ ...STAND_IN_SPRITES[name](), scale: { width: scale, height: scale } }),
  });
  const each = (table, make) => { for (const [a, recs] of Object.entries(table)) for (const [r, v] of Object.entries(recs)) make(Number(a), Number(r), v); };
  each(DET_FLAT_STAND_INS, (a, r, from) => entries.push(classic(a, r, from)));
  each(DET_FLAT_DRAWINGS, (a, r, spec) => entries.push(drawn(a, r, spec)));
  each(DET_TOWN_FLATS, (a, r, [fa, fr, size]) => entries.push(classic(a, r, [fa, fr], size)));
  for (const [oldArchive, archive] of Object.entries(DET_OLD_ARCHIVES)) {
    for (const e of entries.filter((x) => x.archive === archive)) entries.push({ ...e, archive: Number(oldArchive), fileName: `det-stand-in-${oldArchive}_${e.record}` });
  }
  entries.push(...townPictureEntries(gate));   // WD3: the cloth the tapestries and banners wear, the rugs, the leaves
  return addVendorTextures(entries.map((e) => ({ ...e, yields: true })));   // AUDIT WD3 T2: a player's own DET (or other peer's) picture answers first
}
export function _resetDetStandIns() { _installed = false; _gates.clear(); }
