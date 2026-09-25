// DS1 (2026-09-25): THE PIECES DETAILED SHIPS BORROWS, STOOD IN BY THE PORT.
//
// Detailed Ships 1.0.0 declares Ninelan's *Daggerfall Expanded Textures*
// (DET) 1.2.0 a required peer dependency: its two ship records place ten
// DET models and twenty-seven DET flat records, none of which Daggerfall
// or Detailed Ships itself carries. DET is not part of this port, and Mac
// chose (2026-09-25, asked outright) to "build your own": so every one of
// those pieces is the PORT'S OWN stand-in, made for the place the author
// put it - never a copy of DET, which the port has never seen.
//
// What each piece is was read off its placements, in the port's own
// renders of the two ships (bible `03-World/Detailed-Ships.md` keeps the
// table): two rope-thin segments carry a flag above the small ship's
// crow's nest, and the same piece scaled 13.8 along its length runs from
// that masthead to the rail - so it is line, and laid on its side across
// the stern it is the stern's rails of line; three thicker segments stand
// one on another on the stern castle with a lantern at the top - a staff;
// the large ship flies two pennants at its masthead and a third from a
// staff at the stern; four pieces hang from the mess deck's ceiling beams
// and one over the berths - lanterns; one stands on the captain's floor -
// a sea chest; one in the armory - a weapon rack.
// The flats: three far out on the water, at the waterline - dolphins (the
// author's readme: "You may even spot a dolphin jumping out of the sea");
// one on the small ship's floor - the ship's cat; the rest are the
// stores, the galley and the captain's instruments, stood in by
// Daggerfall's own sprites of the same things.
//
// The models are built here, in metres in Unity's frame (dfMeshToModel's
// shape), and textured with CLASSIC textures - the very ones the classic
// ship's own rigging, planking and sails wear (0_77, 67_x, 116_4) - so
// they come out of the player's ARENA2 like every other model. The flats
// are the player's own records (formats/derivedTexture.js), sized as the
// record sizes itself, except the dolphins, which are the port's own
// drawing (below), made in code.

import { registerCustomModel } from './customModels.js';
import { addVendorTextures } from '../systems/textureReplacement.js';
import { buildDerivedPicture } from '../formats/derivedTexture.js';

// ---- the classic textures the stand-ins wear -----------------------------
const ROPE = [0, 77];        // #453f2a - the classic ship's rigging colour (model 910 wears it)
const IRON = [0, 79];        // #322d22 - the darkest of that ramp, for bands, chains and frames
const GLOW = [0, 10];        // #ffc556 - a lamp's lit glass
const WOOD = [67, 0];        // the ship's own planking
const WOOD_DARK = [67, 8];   // a darker plank of the same set
const CLOTH = [116, 4];      // the sail the classic ship flies

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
    const g = this._group(tex);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    const verts = flip ? [[a, ua], [c, uc], [b, ub]] : [[a, ua], [b, ub], [c, uc]];
    const base = g.positions.length / 3;
    for (const [p, uv] of verts) { g.positions.push(p[0], p[1], p[2]); g.normals.push(n[0], n[1], n[2]); g.uvs.push(uv[0], uv[1]); }
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
/** The length of the rope and ladder pieces: the author stacks them 85 units apart up a mast. */
export const DET_SEGMENT_UNITS = 85;

/** The ten models, by the DET id the author names. Origins sit where the placements say:
 *  a column piece at its foot, a hanging piece at its hook, a floor piece on the floor. */
export const DET_MODELS = Object.freeze({
  // Rope, a segment long: the halyard up the mainmast (two, a block on top), stays when scaled along
  // its length, rope run across the stern when laid on its side.
  45081: () => { const m = new MeshBuilder(); m.cylinderY(ROPE, [0, 0, 0], 0.035, DET_SEGMENT_UNITS * U, 6, 0.4); return m.build(); },
  // A staff, a segment long: three stand one on another on the small ship's stern castle, a lantern at the top.
  45110: () => { const m = new MeshBuilder(); m.cylinderY(WOOD, [0, 0, 0], 0.05, DET_SEGMENT_UNITS * U, 6, 0.6); return m.build(); },
  // A flag at the head of the mainmast's topmast (two rope-thin segments carry it above the crow's nest).
  45121: () => {
    const m = new MeshBuilder();
    m.box(WOOD_DARK, [0, 0.04, 0], [0.07, 0.08, 0.07], 4);
    m.sheet(CLOTH, [0.02, 0.1, 0], [0.62, 0.12, 0], [0.62, 0.48, 0], [0.02, 0.5, 0], [0, 0, 1], [[0, 0], [1, 0], [1, -1], [0, -1]]);
    m.cylinderY(ROPE, [0, 0.08, 0], 0.012, 0.44, 4, 0.4, false);
    return m.build();
  },
  // The stern lantern at the head of the staff (the author scales it 1.4): a bracket, a cage, the lit glass.
  45164: () => {
    const m = new MeshBuilder();
    m.box(IRON, [0, 0.03, 0], [0.26, 0.06, 0.26]);
    m.box(GLOW, [0, 0.24, 0], [0.2, 0.36, 0.2]);
    for (const [x, z] of [[-0.11, -0.11], [0.11, -0.11], [0.11, 0.11], [-0.11, 0.11]]) m.box(IRON, [x, 0.24, z], [0.03, 0.38, 0.03]);
    m.box(IRON, [0, 0.45, 0], [0.26, 0.05, 0.26]);
    m.box(IRON, [0, 0.52, 0], [0.12, 0.09, 0.12]);
    m.box(IRON, [0, 0.6, 0], [0.03, 0.08, 0.03]);
    return m.build();
  },
  // A pennant, flown from its hoist at the origin (the large ship's masthead flies two at scale 2).
  45161: () => {
    const m = new MeshBuilder();
    const h = 0.45, l = 0.9;
    m.sheet(CLOTH, [0, 0, 0], [l * 0.5, h * 0.2, 0.04], [l * 0.5, h * 0.8, 0.04], [0, h, 0], [0, 0, 1], [[0, 0], [0.5, -0.2], [0.5, -0.8], [0, -1]]);
    for (const n of [[0, 0, 1], [0, 0, -1]]) m.tri(CLOTH, [l * 0.5, h * 0.2, 0.04], [l, h * 0.5, 0], [l * 0.5, h * 0.8, 0.04], n, [0.5, -0.2], [1, -0.5], [0.5, -0.8]);
    return m.build();
  },
  // The ensign staff at the stern, the pennant flying from its head.
  45082: () => { const m = new MeshBuilder(); m.cylinderY(WOOD, [0, 0, 0], 0.045, 2.1, 6, 0.6); m.box(WOOD_DARK, [0, 2.13, 0], [0.1, 0.07, 0.1], 4); return m.build(); },
  // A lantern on a short chain from a ceiling beam (the mess deck hangs four).
  45162: () => {
    const m = new MeshBuilder();
    m.box(IRON, [0, -0.12, 0], [0.02, 0.24, 0.02]);
    m.box(IRON, [0, -0.26, 0], [0.2, 0.04, 0.2]);
    m.box(GLOW, [0, -0.41, 0], [0.16, 0.26, 0.16]);
    m.box(IRON, [0, -0.56, 0], [0.2, 0.04, 0.2]);
    for (const [x, z] of [[-0.09, -0.09], [0.09, -0.09], [0.09, 0.09], [-0.09, 0.09]]) m.box(IRON, [x, -0.41, z], [0.025, 0.28, 0.025]);
    return m.build();
  },
  // A lantern over the berths - the same hook, a caged round lamp.
  45145: () => {
    const m = new MeshBuilder();
    m.box(IRON, [0, -0.15, 0], [0.02, 0.3, 0.02]);
    m.cylinderY(GLOW, [0, -0.62, 0], 0.11, 0.3, 8, 0.3);
    m.cylinderY(IRON, [0, -0.34, 0], 0.14, 0.03, 8, 0.3);
    m.cylinderY(IRON, [0, -0.66, 0], 0.14, 0.04, 8, 0.3);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; m.box(IRON, [Math.cos(a) * 0.12, -0.47, Math.sin(a) * 0.12], [0.02, 0.3, 0.02]); }
    return m.build();
  },
  // The captain's sea chest, lengthwise on its own X (the author turns it a quarter).
  45190: () => {
    const m = new MeshBuilder();
    m.box(WOOD, [0, 0.22, 0], [0.9, 0.44, 0.5], 2);
    m.box(WOOD_DARK, [0, 0.49, 0], [0.92, 0.1, 0.52], 2);
    for (const x of [-0.3, 0.3]) m.box(IRON, [x, 0.28, 0], [0.05, 0.56, 0.54]);
    m.box(IRON, [0, 0.4, 0.265], [0.08, 0.1, 0.02]);
    return m.build();
  },
  // A weapon rack for the armory: two posts, two rails, the spears between.
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

// ---- the flats ---------------------------------------------------------------

/** The DET flat records the author places, stood in by the player's own
 *  sprite of the same kind: [classic archive, record]. By place: the
 *  galley and stores (10021, 10027), the captain's instruments (10025),
 *  the ship's cat (10010). */
export const DET_FLAT_STAND_INS = Object.freeze({
  10010: Object.freeze({ 38: [201, 8] }),   // on the small ship's lower deck: a cat
  10021: Object.freeze({
    5: [205, 12], 9: [205, 2], 12: [218, 4], 13: [218, 0], 16: [205, 4], 17: [213, 0], 22: [200, 1], 27: [205, 30],
  }),
  10025: Object.freeze({ 0: [208, 0], 3: [208, 4] }),   // a globe; a telescope on its tripod (one stands on the large ship's deck)
  10027: Object.freeze({
    0: [211, 3], 3: [205, 21], 4: [205, 22], 5: [205, 23], 6: [205, 17], 7: [205, 18], 8: [205, 24], 9: [205, 25],
    10: [205, 0], 11: [200, 1], 12: [205, 30], 13: [218, 4], 14: [204, 7],
  }),
});

/** The dolphins, the port's own drawing: three poses of one leap (the
 *  author places 10009's records 29, 30 and 31 far out on the water - the
 *  small ship's at the waterline, the large ship's with their feet 1.4 m
 *  under it, so the picture is TALL and the animal rides its upper part:
 *  wherever the author set it, what shows above the sea is a dolphin
 *  breaking the surface). */
export const DET_DOLPHIN_RECORDS = Object.freeze([29, 30, 31]);
const DOLPHIN = { w: 40, h: 56, body: [96, 110, 128], back: [58, 70, 88], belly: [196, 206, 214], eye: [20, 22, 26] };

/** A dolphin in pose `k` (0 rising, 1 at the top of its arc, 2 going back in), top-down RGBA:
 *  a silhouette round a bowed spine - thick behind the head, tapering to a beak and to the
 *  tail stock - shaded dark on the back and pale on the belly, with its dorsal fin, its
 *  flukes and a one-pixel outline. */
export function drawDolphin(k) {
  const { w, h } = DOLPHIN;
  const data = new Uint8Array(w * h * 4);
  const tilt = [-0.62, 0, 0.62][k];
  const cx = w / 2, cy = 15, len = 30;
  const cs = Math.cos(tilt), sn = Math.sin(tilt);
  // body frame: u along the spine (0 tail .. 1 beak), v across it (negative = back)
  const toBody = (x, y) => {
    const dx = x - cx, dy = y - cy;
    const bx = dx * cs + dy * sn, by = -dx * sn + dy * cs;
    return [bx / len + 0.5, by + Math.sin(Math.min(1, Math.max(0, bx / len + 0.5)) * Math.PI) * 2.6];
  };
  const halfWidth = (u) => {
    if (u < 0 || u > 1) return -1;
    if (u > 0.9) return 1.2 + (1 - u) * 8;            // the beak
    if (u > 0.78) return 4.2 - (u - 0.78) * 16;       // the melon falling to the beak
    if (u < 0.2) return 0.9 + u * 16;                 // the tail stock
    return 4.2;
  };
  const inside = (x, y) => {
    const [u, v] = toBody(x, y);
    const hw = halfWidth(u);
    if (hw > 0 && Math.abs(v) <= hw) return v / hw;                                           // the body: v/hw in -1..1
    if (u > 0.42 && u < 0.62 && v < 0 && -v < hw + (0.62 - u) * 30 - Math.abs(u - 0.5) * 20) return -1;   // the dorsal fin, back side
    if (u > -0.1 && u < 0.04 && Math.abs(v) < 1 + (0.04 - u) * 45) return -0.6;               // the flukes
    return null;
  };
  const set = (x, y, c) => { const i = (y * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const q = inside(x + 0.5, y + 0.5);
      if (q === null) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inside(x + 0.5 + a, y + 0.5 + b) === null);
      set(x, y, edge ? DOLPHIN.back.map((c) => c * 0.7) : q < -0.25 ? DOLPHIN.back : q > 0.4 ? DOLPHIN.belly : DOLPHIN.body);
    }
  }
  // a pixel with one opaque neighbour or none is a sampling sliver of the silhouette's edge - cleared
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] !== 0;
  const slivers = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (opaque(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => opaque(x + a, y + b)).length <= 1) slivers.push((y * w + x) * 4);
  for (const i of slivers) data[i + 3] = 0;
  // the eye, just behind the melon, above the line of the mouth
  const eu = 0.8, ev = -1.2;
  const bx = (eu - 0.5) * len, by = ev - Math.sin(eu * Math.PI) * 2.6;
  const ex = Math.round(cx + bx * cs - by * sn), ey = Math.round(cy + bx * sn + by * cs);
  if (ex >= 0 && ey >= 0 && ex < w && ey < h) set(ex, ey, DOLPHIN.eye);
  return { width: w, height: h, data };
}
/** The dolphins' size: a bottlenose's two metres across the drawing's 32-pixel body (the record scale DFU grows a sprite by). */
export const DOLPHIN_SCALE = Object.freeze({ width: 384, height: 384 });

let _installed = false;
/** Once: the ten models on the model door and the flats on the texture door, all behind `isOn`
 *  (Detailed Ships' own switch - the stand-ins exist for it and for nothing else). */
export function installDetStandIns(isOn) {
  if (_installed) return 0;
  _installed = true;
  for (const [id, build] of Object.entries(DET_MODELS)) registerCustomModel(Number(id), build, isOn);
  const entries = [];
  for (const [archive, records] of Object.entries(DET_FLAT_STAND_INS)) {
    for (const [record, from] of Object.entries(records)) {
      entries.push({
        archive: Number(archive), record: Number(record), fileName: `det-stand-in-${archive}_${record}`, standIn: true, gate: isOn,
        build: async (ctx) => {
          const pic = await buildDerivedPicture({ from }, ctx.classicRgba);
          return { ...pic, scale: (await ctx.classicScale?.(from[0], from[1])) ?? null };   // sized as the classic sprite sizes itself
        },
      });
    }
  }
  for (const [k, record] of DET_DOLPHIN_RECORDS.entries()) {
    entries.push({ archive: 10009, record, fileName: `det-stand-in-10009_${record}`, standIn: true, gate: isOn, build: async () => ({ ...drawDolphin(k), scale: DOLPHIN_SCALE }) });
  }
  return addVendorTextures(entries);
}
/** Test seam. */
export function _resetDetStandIns() { _installed = false; }
