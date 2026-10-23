// THE DWARVEN PISTOLET'S MORROWIND MODEL, built part by part (PISTOLET-MODEL, 2026-10-22; bible/05-Combat/Dwarven-Pistolet.md).
//
// The owner, of the first Morrowind model (the inventory sprite extruded a block deep): "Uhhh can you make an actual 3d
// model and texture it. This is bad". So this is a modelled flintlock: every part lofted from its own cross-sections -
// an octagonal steel barrel with a muzzle swell, brass bands and bosses, a ramrod in its pipes, a rounded brass lock with
// a teal enamel medallion on each side, the pan, the frizzen and a curled hammer holding its flint, a brass trigger guard
// and trigger, and a teal grip raked back to a flared brass butt - read off the owner's own first-person frames
// (public/art/pistol-frames.png: the steel barrel ringed in brass, the brass lock and its curl, the teal grip in brass
// filigree, the dotted brass butt).
//
// Each surface is its own island in a 256x256 atlas (the Thunderlock's size, tools/bakeThunderlock.mjs), packed at one
// texel density, and the texture is PAINTED texel by texel from the surface it covers (meshTexture.mjs bakeAttributes: the
// texel's place, its normal, its occlusion): brass with its Dwemer engraving, brushed steel, teal enamel with the brass
// scrollwork, the dark bore. The Sunken Sovereign's is the same paint in gold leaf.
//
// THE FRAME is the one the arm already holds (src/characters/ownModels/ownWeaponModels.js PISTOL_GRIP_ATTITUDE): +Y the
// barrel, +Z up, +X the gun's right, the grip raked GRIP_RAKE degrees back from square to the barrel, its middle - where
// the fist closes - at the origin. Morrowind units (tools/bakeThunderlock.mjs MW_UNITS_PER_METRE). Deterministic: the same
// code bakes the same bytes; test/systems/pistolet.test.js re-runs it against what ships.
import { vertexAO, bakeAttributes, dilate, valueNoise } from './meshTexture.mjs';

/** The atlas's size: the Thunderlock's, a hero weapon's in Morrowind's own budget. */
export const TEX_SIZE = 256;
/** The grip's rake, degrees back from square to the barrel - ownWeaponModels.js PISTOL_GRIP_RAKE, the turn the arm's fist
 *  gives it. */
export const GRIP_RAKE = 12;
/** The texels between two islands: room for the mips to blur without bleeding one part into the next. */
const PAD = 3;

const DEG = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

/** The mesh as it grows: vertices carry their island and their place in it (world units), packed into UVs at the end. */
function builder() {
  const P = [], N = [], S = [], I = [], islands = [];
  return {
    P, N, S, I, islands,
    island(w, h, mat, name) { islands.push({ w, h, mat, name }); return islands.length - 1; },
    vert(p, n, s, t, isl) { P.push(p); N.push(unit(n)); S.push([s, t, isl]); return P.length - 1; },
    /** A triangle wound so its face points along `out` - every part's outside is the outside, whatever its frame. */
    tri(a, b, c, out) {
      const n = cross(sub(P[b], P[a]), sub(P[c], P[a]));
      if (dot(n, out) < 0) I.push(a, c, b); else I.push(a, b, c);
    },
  };
}

/** A superellipse (p 2 an ellipse, higher ever boxier), `n` points from `phase`. */
const rounded = (n, p = 2, phase = 0) => Array.from({ length: n }, (_, k) => {
  const a = phase + (2 * Math.PI * k) / n, c = Math.cos(a), s = Math.sin(a);
  return [Math.sign(c) * Math.abs(c) ** (2 / p), Math.sign(s) * Math.abs(s) ** (2 / p)];
});

/**
 * A LOFT: rings of a profile through `rings` ({ c centre, u, v the section's axes, ru, rv its half-sizes }), joined side
 * by side, capped. `flat` gives each facet its own normal (the barrel's octagon); otherwise the rings are smooth. One island
 * for the sides (the widest ring's girth by the length along the centres), one for each cap.
 */
function loft(B, mat, name, rings, { profile, flat = false, caps = [true, true], capMat = mat } = {}) {
  const n = profile.length;
  const pts = rings.map((r) => profile.map(([px, py]) => add(r.c, add(mul(r.u, r.ru * px), mul(r.v, r.rv * py)))));
  const nrmAt = (r, [px, py]) => add(mul(r.u, px / Math.max(r.ru, 1e-6)), mul(r.v, py / Math.max(r.rv, 1e-6)));
  const girth = pts.map((ring) => ring.reduce((L, p, k) => L + len(sub(ring[(k + 1) % n], p)), 0));
  const W = Math.max(...girth);
  const along = [0];
  for (let i = 1; i < rings.length; i++) along.push(along[i - 1] + len(sub(rings[i].c, rings[i - 1].c)));
  const H = along[along.length - 1];
  const isl = B.island(W, H, mat, name);
  const sAt = (k) => (k / n) * W;
  for (let i = 0; i + 1 < rings.length; i++) {
    if (flat) {
      for (let k = 0; k < n; k++) {
        const a = pts[i][k], b = pts[i][(k + 1) % n], c = pts[i + 1][(k + 1) % n], d = pts[i + 1][k];
        const mid = mul(add(add(a, b), add(c, d)), 0.25);
        const out = sub(mid, mul(add(rings[i].c, rings[i + 1].c), 0.5));
        const fn = unit(cross(sub(b, a), sub(d, a)));
        const fo = dot(fn, out) < 0 ? mul(fn, -1) : fn;
        const ia = B.vert(a, fo, sAt(k), along[i], isl), ib = B.vert(b, fo, sAt(k + 1), along[i], isl);
        const ic = B.vert(c, fo, sAt(k + 1), along[i + 1], isl), id = B.vert(d, fo, sAt(k), along[i + 1], isl);
        B.tri(ia, ib, ic, fo); B.tri(ia, ic, id, fo);
      }
    }
  }
  if (!flat) {
    const idx = rings.map((r, i) => Array.from({ length: n + 1 }, (_, k) => B.vert(pts[i][k % n], nrmAt(r, profile[k % n]), sAt(k), along[i], isl)));
    for (let i = 0; i + 1 < rings.length; i++) {
      for (let k = 0; k < n; k++) {
        const a = idx[i][k], b = idx[i][k + 1], c = idx[i + 1][k + 1], d = idx[i + 1][k];
        const out = add(add(B.N[a], B.N[b]), add(B.N[c], B.N[d]));
        B.tri(a, b, c, out); B.tri(a, c, d, out);
      }
    }
  }
  // the caps: a fan over each end ring, facing out along the loft
  [0, rings.length - 1].forEach((i, end) => {
    if (!caps[end]) return;
    const r = rings[i];
    const T = rings.length > 1 ? unit(sub(rings[end ? i : 1].c, rings[end ? i - 1 : 0].c)) : cross(r.u, r.v);
    const out = end ? T : mul(T, -1);
    const ci = B.island(2 * r.ru, 2 * r.rv, capMat, `${name}:cap${end}`);
    const centre = B.vert(r.c, out, r.ru, r.rv, ci);
    const ring = profile.map(([px, py], k) => B.vert(pts[i][k], out, r.ru + px * r.ru, r.rv + py * r.rv, ci));
    for (let k = 0; k < n; k++) B.tri(centre, ring[k], ring[(k + 1) % n], out);
  });
}

/** Rings along a straight axis: `stations` [[along, ru, rv]...] from `origin` along `dir`, the section axes u, v. */
const straight = (origin, dir, u, v, stations) => stations.map(([d, ru, rv]) => ({ c: add(origin, mul(dir, d)), u, v, ru, rv }));

/** Rings along a path in the gun's own plane (x fixed): the section's u is +X, its v the path's in-plane normal. */
function sweep(path, sizes) {
  return path.map((c, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const T = unit(sub(b, a));
    const v = unit(cross(X, T));
    const [ru, rv] = sizes(i / (path.length - 1));
    return { c, u: X, v, ru, rv };
  });
}

/** The barrel's line: its axis height and its radius at a point along it. */
const BORE_Z = 6.35;
const barrelR = (y) => 1.0 - 0.1 * Math.max(0, Math.min(1, (y - 4) / 12.4));

/** THE MODEL - the mesh in the port's shape (tools/fbxMesh.mjs's) and its islands, packed into the atlas. */
export function buildPistolet() {
  const B = builder();
  const oct = rounded(8, 2, Math.PI / 8);
  const round12 = rounded(12), round16 = rounded(16), round8 = rounded(8), hex = rounded(6, 2, Math.PI / 6);
  const boxy = rounded(16, 4.5);
  const at = (y, z = BORE_Z, x = 0) => [x, y, z];

  // THE BARREL - octagonal steel, tapering to the muzzle; the swell at its end and the bore a dark disc
  loft(B, 'steel', 'barrel', straight(at(4.0), Y, X, Z, [[0, 1.0, 1.0], [12.4, 0.9, 0.9]]), { profile: oct, flat: true, caps: [false, false] });
  loft(B, 'steel', 'muzzle', straight(at(16.2), Y, X, Z, [[0, 0.92, 0.92], [0.3, 1.14, 1.14], [1.25, 1.14, 1.14], [1.45, 1.04, 1.04]]), { profile: oct, flat: true, caps: [false, true], capMat: 'bore' });
  // the breech's brass reinforce and the three bands
  loft(B, 'brass', 'reinforce', straight(at(3.6), Y, X, Z, [[0, 1.16, 1.16], [2.4, 1.16, 1.16], [2.8, 1.06, 1.06]]), { profile: oct, flat: true, caps: [false, false] });
  for (const [k, y] of [8.0, 11.3, 14.6].entries()) {
    const r = barrelR(y) + 0.13;
    loft(B, 'brass', `band${k}`, straight(at(y), Y, X, Z, [[0, r, r], [0.6, r, r]]), { profile: oct, flat: true, caps: [true, true] });
  }
  // the steel bosses along the barrel's top
  for (const [k, y] of [6.9, 9.65, 12.95].entries()) {
    const top = BORE_Z + barrelR(y) - 0.04;
    loft(B, 'steel', `boss${k}`, straight([0, y, top], Z, X, Y, [[0, 0.36, 0.36], [0.24, 0.36, 0.36], [0.42, 0.26, 0.26]]), { profile: hex, caps: [false, true] });
  }
  // the ramrod under the barrel, its brass tip and its two pipes
  const rodZ = BORE_Z - 1.0 - 0.27;
  loft(B, 'steel', 'ramrod', straight([0, 4.6, rodZ], Y, X, Z, [[0, 0.19, 0.19], [11.2, 0.19, 0.19]]), { profile: round8, caps: [false, false] });
  loft(B, 'brass', 'rodtip', straight([0, 15.8, rodZ], Y, X, Z, [[0, 0.27, 0.27], [0.4, 0.27, 0.27], [0.5, 0.18, 0.18]]), { profile: round8 });
  for (const [k, y] of [7.2, 12.6].entries()) {
    loft(B, 'brass', `pipe${k}`, straight([0, y, rodZ], Y, X, Z, [[0, 0.37, 0.37], [0.6, 0.37, 0.37]]), { profile: round8 });
  }

  // THE LOCK - a rounded brass block under the breech, its tang running back over the grip
  const lockZ = 5.65;
  loft(B, 'brass', 'lock', straight([0, -1.9, lockZ], Y, X, Z, [
    [0, 0.58, 0.85], [0.5, 0.9, 1.3], [1.0, 0.98, 1.45], [4.8, 0.98, 1.45], [5.8, 0.9, 1.2], [6.2, 0.72, 0.98],
  ]), { profile: boxy });
  // the belly under the barrel that carries the guard's front
  loft(B, 'brass', 'belly', straight([0, 4.0, 4.65], Y, X, Z, [[0, 0.56, 0.46], [2.7, 0.46, 0.4], [3.1, 0.22, 0.22]]), { profile: boxy });
  // a teal medallion in a brass bezel, on each side of the lock
  for (const side of [1, -1]) {
    const c = [side * 0.8, 1.25, lockZ + 0.05];
    loft(B, 'brass', `bezel${side > 0 ? 'R' : 'L'}`, straight(c, mul(X, side), Y, Z, [[0, 1.24, 1.24], [0.22, 1.24, 1.24], [0.3, 1.13, 1.13]]), { profile: round16, caps: [false, true] });
    loft(B, 'teal', `medallion${side > 0 ? 'R' : 'L'}`, straight(add(c, [side * 0.24, 0, 0]), mul(X, side), Y, Z, [[0, 0.96, 0.96], [0.1, 0.96, 0.96]]), { profile: round16, caps: [false, true] });
  }
  // the pan and the frizzen, on the lock's right before the hammer
  loft(B, 'brass', 'pan', straight([0.7, 2.6, 7.1], Y, X, Z, [[0, 0.34, 0.17], [0.95, 0.34, 0.17]]), { profile: boxy });
  loft(B, 'brass', 'frizzen', sweep([[0.7, 3.35, 7.1], [0.7, 3.3, 7.8], [0.7, 3.05, 8.5]], (f) => [0.32, 0.15 - 0.03 * f]), { profile: boxy });
  // THE HAMMER - the brass curl that rises behind the breech and comes forward to hold the flint
  loft(B, 'brass', 'hammer', sweep([
    [0.7, 0.6, 6.9], [0.7, 0.15, 7.8], [0.7, -0.5, 8.65], [0.7, -1.05, 9.45], [0.7, -0.95, 10.15], [0.7, -0.35, 10.5], [0.7, 0.3, 10.4],
  ], (f) => [0.24, 0.56 - 0.28 * f]), { profile: boxy });
  loft(B, 'brass', 'jaw', straight([0.7, 0.25, 9.95], Y, X, Z, [[0, 0.24, 0.36], [0.8, 0.24, 0.36]]), { profile: boxy });
  loft(B, 'flint', 'flint', straight([0.7, 1.05, 9.95], Y, X, Z, [[0, 0.18, 0.25], [0.6, 0.15, 0.2]]), { profile: boxy });

  // THE TRIGGER GUARD and the trigger, under the lock in front of the grip
  loft(B, 'brass', 'guard', sweep([
    [0, 6.6, 4.35], [0, 6.45, 3.4], [0, 5.75, 2.4], [0, 4.5, 1.9], [0, 3.3, 2.05], [0, 2.55, 2.75], [0, 2.35, 3.5],
  ], () => [0.2, 0.23]), { profile: boxy });
  loft(B, 'steel', 'trigger', sweep([[0, 4.4, 4.3], [0, 4.25, 3.55], [0, 3.9, 3.0], [0, 3.45, 2.75]], (f) => [0.12, 0.19 - 0.08 * f]), { profile: boxy });

  // THE GRIP - teal, raked GRIP_RAKE back, swelling to the butt; its middle the origin, where the fist closes
  const r = GRIP_RAKE * DEG;
  const g = [0, Math.sin(r), Math.cos(r)];          // up the grip, toward the lock
  const f = [0, Math.cos(r), -Math.sin(r)];         // the grip's front
  const gripRing = (s, depth, width, bulge = 0) => ({ c: add(mul(g, s), mul(f, bulge)), u: X, v: f, ru: width, rv: depth });
  loft(B, 'teal', 'grip', [
    gripRing(5.2, 1.3, 0.84), gripRing(3.6, 1.34, 0.86, -0.04), gripRing(1.8, 1.38, 0.9, -0.08),
    gripRing(0, 1.42, 0.93, -0.1), gripRing(-1.8, 1.5, 0.97, -0.12), gripRing(-3.4, 1.6, 1.02, -0.12), gripRing(-4.0, 1.64, 1.04, -0.11),
  ], { profile: rounded(16, 2.6), caps: [false, false] });
  // a brass wrist band where the grip meets the lock
  loft(B, 'brass', 'wrist', [gripRing(3.25, 1.44, 0.96, -0.03), gripRing(3.8, 1.42, 0.94, -0.03)], { profile: rounded(16, 2.6) });
  // THE BUTT - a flared brass cap, closing to a rounded end
  loft(B, 'brass', 'butt', [
    gripRing(-3.9, 1.65, 1.05, -0.11), gripRing(-4.35, 1.84, 1.17, -0.12), gripRing(-4.95, 1.8, 1.14, -0.12),
    gripRing(-5.45, 1.38, 0.9, -0.1), gripRing(-5.75, 0.72, 0.48, -0.08),
  ], { profile: rounded(16, 2.6), caps: [false, true] });

  return pack(B);
}

/** Pack every island into the atlas at the one density that fits (a shelf packer, tallest first), and turn each vertex's
 *  place in its island into its UV (V up - the port's mesh convention, tools/fbxMesh.mjs's; nifWrite.mjs turns it down). */
function pack(B) {
  const order = B.islands.map((s, i) => i).sort((a, b) => B.islands[b].h - B.islands[a].h || B.islands[b].w - B.islands[a].w || a - b);
  const tryScale = (k) => {
    const rects = [];
    let x = PAD, y = PAD, rowH = 0;
    for (const i of order) {
      const w = Math.ceil(B.islands[i].w * k) + 1, h = Math.ceil(B.islands[i].h * k) + 1;
      if (x + w + PAD > TEX_SIZE) { x = PAD; y += rowH + PAD; rowH = 0; }
      if (w + 2 * PAD > TEX_SIZE || y + h + PAD > TEX_SIZE) return null;
      rects[i] = { x, y, w, h };
      x += w + PAD; rowH = Math.max(rowH, h);
    }
    return rects;
  };
  let lo = 1, hi = 64;
  for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (tryScale(mid)) lo = mid; else hi = mid; }
  const scale = Math.floor(lo * 100) / 100;
  const rects = tryScale(scale);
  const islands = B.islands.map((s, i) => ({ ...s, ...rects[i] }));
  const edge = TEX_SIZE - 1;
  const positions = [], normals = [], uvs = [];
  B.P.forEach((p, i) => {
    positions.push(p[0], p[1], p[2]);
    normals.push(B.N[i][0], B.N[i][1], B.N[i][2]);
    const [s, t, isl] = B.S[i], rc = islands[isl];
    uvs.push((rc.x + s * scale) / edge, 1 - (rc.y + t * scale) / edge);
  });
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], positions[i + a]); max[a] = Math.max(max[a], positions[i + a]); }
  const mesh = { name: 'Dwarven_Pistolet', positions, normals, uvs, indices: B.I.slice(), bounds: { min, max } };
  return { mesh, islands, scale };
}

// ── the paint ───────────────────────────────────────────────────────

/** The palettes, sRGB: each material's shadow, body and light, and the scrollwork's brass. The gilded set is the Sunken
 *  Sovereign's - every metal gold leaf, the enamel a deep gold under brighter scrolls. */
export const PALETTE = Object.freeze({
  plain: Object.freeze({
    brass: [[92, 60, 20], [176, 128, 52], [236, 196, 112]],
    steel: [[64, 68, 74], [140, 145, 152], [210, 214, 218]],
    teal: [[18, 66, 64], [44, 124, 118], [104, 178, 168]],
    flint: [[60, 58, 54], [104, 100, 94], [150, 146, 138]],
    bore: [[10, 9, 8], [22, 20, 18], [40, 38, 34]],
    scroll: [196, 150, 64],
  }),
  gilded: Object.freeze({
    brass: [[118, 78, 18], [214, 164, 62], [252, 222, 138]],
    steel: [[132, 102, 44], [218, 186, 108], [252, 234, 174]],
    teal: [[84, 52, 12], [150, 102, 32], [208, 160, 72]],
    flint: [[90, 74, 44], [150, 128, 84], [204, 184, 132]],
    bore: [[16, 12, 6], [30, 24, 14], [52, 42, 24]],
    scroll: [252, 214, 120],
  }),
});

const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ramp = ([lo, mid, hi], k) => (k < 0.5 ? mix(lo, mid, k * 2) : mix(mid, hi, (k - 0.5) * 2));
const fract = (v) => v - Math.floor(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** One texel's colour: its material's ramp lit by the surface (a light from above and the near side), its occlusion, the
 *  material's grain, and the engraving its island carries. (s, t) its place in its island, in model units. */
function shade(mat, name, s, t, isl, k, p, n, ao, pal) {
  const grain = valueNoise(p[0] * 2.3 + 11, p[1] * 2.3, p[2] * 2.3);
  const light = clamp01(0.5 + 0.24 * n[2] + 0.06 * n[0] + 0.1 * (grain - 0.5));
  let c;
  if (mat === 'steel') {
    const brushed = valueNoise(s * 0.7 + 3, t * 9, k * 7.1);
    c = ramp(pal.steel, clamp01(light + 0.16 * (brushed - 0.5)));
  } else if (mat === 'teal' && name.startsWith('medallion') && !name.includes(':')) {
    // THE MEDALLION'S EMBLEM: the face is the cap; the rim keeps the enamel
    c = ramp(pal.teal, clamp01(light * 0.9));
  } else if (mat === 'teal' && name.startsWith('medallion')) {
    // a Dwemer wheel in brass on the enamel: two rings, eight spokes between them, a boss at the centre
    const u = s - isl.w / 2, v = t - isl.h / 2, rr = Math.hypot(u, v) / (isl.w / 2), a = Math.atan2(v, u);
    c = ramp(pal.teal, clamp01(light * 0.9));
    const ring = Math.abs(rr - 0.8) < 0.11 || Math.abs(rr - 0.44) < 0.1;
    const spoke = rr > 0.44 && rr < 0.8 && Math.abs(Math.sin(a * 2)) < 0.3;
    if (ring || spoke || rr < 0.2) c = mix(pal.scroll, ramp(pal.brass, light), 0.3);
  } else if (mat === 'teal') {
    const mottle = valueNoise(p[0] * 4, p[1] * 4, p[2] * 4);
    c = ramp(pal.teal, clamp01(light * 0.9 + 0.12 * (mottle - 0.5)));
    // the brass scrollwork - two interleaved vines, each with a dark line along it
    const v1 = Math.abs(Math.sin(1.7 * s + 1.25 * Math.sin(1.15 * t + 0.4)));
    const v2 = Math.abs(Math.sin(1.7 * s - 1.25 * Math.sin(1.15 * t + 2.1) + 1.57));
    const curl = Math.min(v1, v2);
    if (curl < 0.12) c = mix(pal.scroll, ramp(pal.brass, light), 0.35);
    else if (curl < 0.2) c = mix(c, pal.teal[0], 0.55);
  } else if (mat === 'bore') {
    const rr = Math.hypot(s - isl.w / 2, t - isl.h / 2) / (isl.w / 2);
    c = rr < 0.62 ? ramp(pal.bore, 0.3) : rr < 0.72 ? ramp(pal.steel, 0.15) : ramp(pal.steel, light);
  } else if (mat === 'flint') {
    c = ramp(pal.flint, clamp01(light + 0.3 * (grain - 0.5)));
  } else {
    c = ramp(pal.brass, light);
    // DWEMER ENGRAVING: a groove ringing each brass part near its ends, and on the lock and the butt a key pattern of
    // stepped lines; a bright raised dot - a rivet - at each key's corner
    const ends = t < 0.07 || t > isl.h - 0.07;
    let groove = ends;
    if (name === 'lock' || name === 'butt' || name === 'reinforce') {
      const gs = fract(s / 1.6), gt = fract(t / 1.6);
      const key = (gs < 0.05 && gt > 0.2) || (gt < 0.05 && gs < 0.8) || (Math.abs(gs - 0.45) < 0.035 && gt > 0.3 && gt < 0.75) || (Math.abs(gt - 0.75) < 0.035 && gs > 0.45 && gs < 0.8);
      groove = groove || key;
      if (Math.hypot(gs - 0.88, gt - 0.12) < 0.06) c = ramp(pal.brass, clamp01(light + 0.35));
    }
    if (groove) c = mix(c, pal.brass[0], 0.62);
  }
  const occlusion = 0.38 + 0.62 * clamp01(ao) ** 0.85;
  return [c[0] * occlusion, c[1] * occlusion, c[2] * occlusion];
}

/** The occlusion of every vertex, once per model (the slow part of the bake; both paints share it). */
export const occlusionOf = (model) => vertexAO(model.mesh, { rays: 24 });

/** THE TEXTURE - the atlas painted from the model's own surface. `gilded` for the Sunken Sovereign's. */
export function paintPistolet(model, { gilded = false, ao = occlusionOf(model) } = {}) {
  const pal = gilded ? PALETTE.gilded : PALETTE.plain;
  const size = TEX_SIZE;
  const { pos, nrm, occ, covered } = bakeAttributes(model.mesh, size, ao);
  const islandAt = (x, y) => {
    let best = -1, bd = Infinity;
    model.islands.forEach((rc, i) => {
      const dx = Math.max(rc.x - x, 0, x - (rc.x + rc.w)), dy = Math.max(rc.y - y, 0, y - (rc.y + rc.h));
      const d = dx + dy;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!covered[i]) continue;
      const k = islandAt(x + 0.5, y + 0.5), rc = model.islands[k];
      const s = (x + 0.5 - rc.x) / model.scale, t = (y + 0.5 - rc.y) / model.scale;
      const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      const n = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      const c = shade(rc.mat, rc.name, s, t, rc, k, p, [n[0] / nl, n[1] / nl, n[2] / nl], occ[i], pal);
      data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2]; data[i * 4 + 3] = 255;
    }
  }
  dilate(data, covered, size, 6);
  for (let i = 0; i < size * size; i++) if (!data[i * 4 + 3]) { data[i * 4] = pal.brass[1][0]; data[i * 4 + 1] = pal.brass[1][1]; data[i * 4 + 2] = pal.brass[1][2]; data[i * 4 + 3] = 255; }
  return { width: size, height: size, data: Uint8Array.from(data) };
}
