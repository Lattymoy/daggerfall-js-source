// @ts-check
// SD7b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE UNMOORED STEPS, MADE -
// the meshes the course's steps are and the triangles they stand in the collider as, and the checkpoints B and C. Pure:
// the scene (scenes/sdSteps.js) uploads them, stands each step where the law (world/sdSteps.js) puts it, and moves it.
//
//   A STEP is a box in its OWN frame - its top's centre the origin, the dungeon's axes (the realm's frame is the dungeon's
//     moved, never turned) - so one mesh serves every step of a kind, each drawn and each collider bucket moved by a
//     translation alone. Its top, its four sides and its underside are all in the collider: a body that jumps short meets
//     a side and slides down it, and a riser's face is a wall for the run up it.
//   THE CHECKPOINTS B and C - islands as the first step is (A, world/sdHall.js), at their heights.
//   THE BREATH'S STREAKS (AUDIT SD II) - brass light blowing across the Crumble, the Warp's breath seen (buildBreathModel).
//
// SD-LOOK S9 (2026-10-09, bible/11-Multiplayer/Super-Dungeons-Look.md section 8): EVERY STEP SHOWS WHAT IT WILL DO NEXT.
// Nothing here is larger than the law: every step's mesh stands inside its collider's box (stepBox, stepTris untouched).
//   THE STEPS bevelled, one atlas a kind (world/sdStepsArt.js) - a chamfer round the top and the foot, the gold line under
//     the rim, about 36 triangles, one draw; a riser's face set back SD_RACK.out so its rack of eleven brass teeth (like
//     rungs) stands proud of the face and inside the box, its lip the course's brightest gold.
//   THE BEAT'S DISSOLVE (buildBeatDissolve): the plate cut into its own texel-sized cells and kept by the ordered dither -
//     a stage a share, swapped in as the draw's mesh while it goes and comes (the mesh program has no screen-door a dynamic
//     draw can ask for: the dither is the plate's own pixels).
//   THE DRIFT'S PENDULUMS (buildPendulum): two rods from the deck's eyelets up SD_PENDULUM.len to a gear, in the
//     pendulum's own frame (its pivot the origin); the scene turns it by asin(dx / len) - the rods lean with the law's
//     own swing - while the deck keeps the law's pure translation (an 18 m pendulum rises 0.1 m at full swing).
//   THE CRUMBLE'S CHUNKS (buildCrumbleChunks): its box split into four prisms along the art's own two main cracks
//     (SD_CRUMBLE_CRACKS), each in a frame of its own about its middle, to fall and to fly back; and its grit.
//   THE WAYSTONES (A, B, C) and THE VANE (on C, the Hollow's Ending's sign on its fin).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { realmToDungeon } from '../net/sdBrain.js';
import { faces } from './gateModel.js';
import { realmIsland, packRealmFaces, SD_REALM_FLOOR_RECORD, SD_ISLAND_SIDES } from './sdRealm.js';
import { SD_HALL_GLOW_RECORD, SD_HALL_EMBLEM_RECORD } from './sdHallArt.js';
import { SD_STEPS_RECORD, SD_STEPS_ATLAS, SD_RISER_ATLAS, SD_PARTS_ATLAS, SD_STEP_BEVEL, SD_STEP_LINE, SD_CRUMBLE_CRACKS } from './sdStepsArt.js';
import { BAYER4 } from './sdPixelKit.js';
import { SD_STEP_THICK, SD_DRIFT_SIZE, SD_BEAT_SIZE, SD_CRUMBLE_SIZE, SD_RISER_H, SD_CHECKPOINTS, SD_COURSE_END, SD_GUST_EVERY, SD_GUST_WARN, SD_GUST_FOR, gustAt } from './sdSteps.js';
import { SD_ENDINGS } from '../net/sdMarks.js';

/** The kinds of step, in the order their meshes are made. */
export const SD_STEP_KINDS = Object.freeze(['drift', 'beat', 'riser', 'crumble']);
/** A step's box, its own frame: across (x), along (z), and how far below its top it reaches. */
export function stepBox(kind) {
  const size = kind === 'drift' ? SD_DRIFT_SIZE : kind === 'crumble' ? SD_CRUMBLE_SIZE : SD_BEAT_SIZE;
  return { w: size.w, d: size.d, h: kind === 'riser' ? SD_RISER_H + SD_STEP_THICK : SD_STEP_THICK };
}
/** What each kind wears - SD-LOOK S9: one atlas, its top, sides, rim and underside in one record. */
export const SD_STEP_WEAR = Object.freeze({
  drift: Object.freeze({ atlas: SD_STEPS_RECORD.drift }),
  beat: Object.freeze({ atlas: SD_STEPS_RECORD.beat[0] }),
  riser: Object.freeze({ atlas: SD_STEPS_RECORD.riser }),
  crumble: Object.freeze({ atlas: SD_STEPS_RECORD.crumble[0] }),
});

/** The box's eight corners, its own frame: 0-3 its top (x-z-, x+z-, x+z+, x-z+), 4-7 under them. */
function corners({ w, d, h }) {
  const x = w / 2, z = d / 2;
  return [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, -h, -z], [x, -h, -z], [x, -h, z], [-x, -h, z]];
}
/** The box's faces by its corners, each wound to face out ((b - a) x (c - a) outward, world/gateModel.js faces' own):
 *  the top, the underside, and the sides facing -z (the way in), +x, +z, -x. */
const TOP = [0, 3, 2, 1], UNDER = [4, 5, 6, 7];
const SIDES = Object.freeze([[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);

/** An atlas cell's corners in uv - a quarter texel in, so NEAREST never reads its neighbour at the seam.
 *  @param {{ w: number, h: number }} A @param {ReadonlyArray<number>} c */
const cellUv = (A, c) => [(c[0] + 0.25) / A.w, (c[1] + 0.25) / A.h, (c[0] + c[2] - 0.25) / A.w, (c[1] + c[3] - 0.25) / A.h];
/** A quad of `f` split into `nu` x `nv` cells (bilinear, its winding kept), each kept where `keep(iu, iv)` says. */
function cells(f, rec, a, b, c, d, ua, ub, uc, ud, nu = 1, nv = 1, keep = null) {
  const at = (P, s, t) => [0, 1, 2].map((k) => P[0][k] * (1 - s) * (1 - t) + P[1][k] * s * (1 - t) + P[2][k] * s * t + P[3][k] * (1 - s) * t);
  const uv = (s, t) => [0, 1].map((k) => ua[k] * (1 - s) * (1 - t) + ub[k] * s * (1 - t) + uc[k] * s * t + ud[k] * (1 - s) * t);
  const P = [a, b, c, d];
  for (let iv = 0; iv < nv; iv++) for (let iu = 0; iu < nu; iu++) {
    if (keep && !keep(iu, iv)) continue;
    const s0 = iu / nu, s1 = (iu + 1) / nu, t0 = iv / nv, t1 = (iv + 1) / nv;
    f.quad(rec, at(P, s0, t0), at(P, s1, t0), at(P, s1, t1), at(P, s0, t1), uv(s0, t0), uv(s1, t0), uv(s1, t1), uv(s0, t1));
  }
}
/**
 * A BEVELLED BOX of the atlas `A` (record `rec`): its top inset by the chamfer, the chamfer down to the gold line, the line,
 * the side, the foot's chamfer and the underside - each band its own cell. `z0` sets its -z face back (a riser's, for its
 * rack). `cell` (m) and `keep(face, iu, iv)` cut every face into cells and keep some (the Beat's dissolve).
 */
function bevelledBox(f, rec, A, { w, d, h }, { z0 = 0, cell = 0, keep = null } = {}) {
  const b = SD_STEP_BEVEL, x = w / 2, zf = d / 2, zn = -d / 2 + z0;
  const ring = (y, i) => [[-x + i, y, zn + i], [x - i, y, zn + i], [x - i, y, zf - i], [-x + i, y, zf - i]];
  const L = [ring(0, b), ring(-b, 0), ring(-b - SD_STEP_LINE, 0), ring(-h + b, 0), ring(-h, b)];
  const T = cellUv(A, A.top), U = cellUv(A, A.under);
  let face = 0;
  const n = (len) => (cell > 0 ? Math.max(1, Math.round(len / cell)) : 1);
  const kf = (k) => (keep ? (iu, iv) => keep(k, iu, iv) : null);
  const t0 = L[0];
  cells(f, rec, t0[0], t0[3], t0[2], t0[1], [T[0], T[1]], [T[0], T[3]], [T[2], T[3]], [T[2], T[1]], n(zf - zn), n(w), keep ? (iu, iv) => keep(face, iv, iu) : null);
  face++;
  const band = (up, lo, C) => {
    const c = cellUv(A, C);
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
      const len = Math.hypot(up[j][0] - up[i][0], up[j][2] - up[i][2]) || Math.hypot(lo[j][0] - lo[i][0], lo[j][2] - lo[i][2]);
      cells(f, rec, up[i], up[j], lo[j], lo[i], [c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]], n(len), n(Math.abs(up[i][1] - lo[i][1]) + 0.001), kf(face++));
    }
  };
  band(L[0], L[1], A.bevel);
  band(L[1], L[2], A.line);
  band(L[2], L[3], A.side);
  band(L[3], L[4], A.bevel);
  const u = L[4];
  cells(f, rec, u[0], u[1], u[2], u[3], [U[0], U[1]], [U[2], U[1]], [U[2], U[3]], [U[0], U[3]], n(w), n(zf - zn), kf(face));
}
/** A RISER'S RACK: eleven brass teeth up its face like rungs (visual only), each `w` across and `h` tall at the face,
 *  standing `out` proud of the face set back by as much - inside the box - every SD_RACK.pitch from its foot up. */
export const SD_RACK = Object.freeze({ n: 11, w: 0.9, h: 0.12, out: 0.05, pitch: 0.19, from: 0.1 });
function rack(f, rec, A, d) {
  const z1 = -d / 2 + SD_RACK.out, z0 = -d / 2, c = cellUv(A, A.bevel), x = SD_RACK.w / 2;
  const UV = [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]];
  for (let k = 0; k < SD_RACK.n; k++) {
    const y = -SD_RISER_H + SD_RACK.from + k * SD_RACK.pitch, hb = SD_RACK.h / 2, hf = SD_RACK.h / 4;
    const bl = [-x, y - hb, z1], br = [x, y - hb, z1], tl = [-x, y + hb, z1], tr = [x, y + hb, z1];
    const fl = [-x, y - hf, z0], fr = [x, y - hf, z0], gl = [-x, y + hf, z0], gr = [x, y + hf, z0];
    f.quad(rec, gl, gr, fr, fl, ...UV);   // its face, out to -z
    f.quad(rec, tl, tr, gr, gl, ...UV);   // its top, sloping back
    f.quad(rec, fl, fr, br, bl, ...UV);   // its underside
    f.quad(rec, gr, tr, br, fr, ...UV);   // its +x end
    f.quad(rec, fl, bl, tl, gl, ...UV);   // its -x end
  }
}
/** ONE STEP of `kind`, a mesh in its own frame (renderer.createMesh's model shape) - one sub-mesh, its kind's atlas. */
export function buildStepModel(kind) {
  const f = faces(), box = stepBox(kind), rec = SD_STEP_WEAR[kind].atlas;
  if (kind === 'riser') { bevelledBox(f, rec, SD_RISER_ATLAS, box, { z0: SD_RACK.out }); rack(f, rec, SD_RISER_ATLAS, box.d); } else bevelledBox(f, rec, SD_STEPS_ATLAS, box);
  return packRealmFaces(f);
}
/** THE BEAT'S DISSOLVE: the share of its cells each stage keeps (of 16), and a cell's side (m - three texels). */
export const SD_BEAT_DISSOLVE = Object.freeze({ keep: Object.freeze([12, 8, 4, 2]), cell: 0.135 });
/** A Beat step keeping `keep` of every 16 of its cells - the ordered dither (world/sdPixelKit.js BAYER4) on each face's
 *  own grid, a face's pattern moved from the next's. */
export function buildBeatDissolve(keep) {
  const f = faces();
  bevelledBox(f, SD_STEP_WEAR.beat.atlas, SD_STEPS_ATLAS, stepBox('beat'), { cell: SD_BEAT_DISSOLVE.cell, keep: (face, iu, iv) => BAYER4[(((iv + face * 3) & 3) << 2) | ((iu + face * 5) & 3)] < keep });
  return packRealmFaces(f);
}
/** ONE STEP's triangles for the collider, its own frame: `{ positions, indices }` - the top, the sides, the underside. */
export function stepTris(kind) {
  const c = corners(stepBox(kind));
  const positions = new Float32Array(c.flat()), indices = [];
  for (const [a, b, e, g] of [TOP, UNDER, ...SIDES]) indices.push(a, b, e, a, e, g);
  return { positions, indices };
}
/** The law's own box, as the ghost pass outlines it: its twelve edges, its own frame (`[[a, b], ...]`). */
export function stepEdges(kind) {
  const c = corners(stepBox(kind));
  return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].map(([a, b]) => [c[a], c[b]]);
}

/** A bar of square section `s` from `a` to `b` (its four long faces, each wound out), wearing `cell` of the parts. */
function bar(f, rec, a, b, s, cell) {
  const P = SD_PARTS_ATLAS, c = cellUv(P, cell), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  const t = d.map((v) => v / L), up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const n1 = norm(cross(t, up)), n2 = cross(n1, t);
  const off = (p, u, v) => [p[0] + (n1[0] * u + n2[0] * v) * s / 2, p[1] + (n1[1] * u + n2[1] * v) * s / 2, p[2] + (n1[2] * u + n2[2] * v) * s / 2];
  const ring = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const [u0, v0] = ring[k], [u1, v1] = ring[(k + 1) % 4];
    f.quad(rec, off(a, u0, v0), off(b, u0, v0), off(b, u1, v1), off(a, u1, v1), [c[0], c[1]], [c[0], c[3]], [c[2], c[3]], [c[2], c[1]]);
  }
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** THE DRIFT'S PENDULUM: its rods' length to the deck's top, how far into the deck they reach, their section and where
 *  they meet the deck and the gear (m, either side of its middle), the gear's radius, its teeth and its thickness. */
export const SD_PENDULUM = Object.freeze({ len: 18, into: 0.3, rod: 0.07, foot: 1.2, head: 0.5, gear: 1.4, teeth: 16, gearD: 0.2 });
/** A pendulum's lean at a step's sideways offset `dx` from its rest (the law's stepAt): asin(dx / len) - turning +x up. */
export const pendulumAngle = (dx) => Math.asin(Math.max(-1, Math.min(1, dx / SD_PENDULUM.len)));
/** ONE PENDULUM, its own frame (its pivot the origin, the deck's rest SD_PENDULUM.len under it): the gear facing along z
 *  and its two rods down to the deck's eyelets. About 280 triangles; one mesh serves all eight. */
export function buildPendulum() {
  const f = faces(), P = SD_PENDULUM, rec = SD_STEPS_RECORD.parts, A = SD_PARTS_ATLAS;
  const n = P.teeth * 2, root = P.gear * 0.86, hub = P.gear * 0.22, z0 = -P.gearD / 2, z1 = P.gearD / 2, g = cellUv(A, A.gear), r = cellUv(A, A.rim);
  const gu = (x, y) => [g[0] + (g[2] - g[0]) * (0.5 + x / (2 * P.gear)), g[1] + (g[3] - g[1]) * (0.5 + y / (2 * P.gear))];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, R = i % 2 ? root : P.gear;
    const p = (a, rr, z) => [Math.cos(a) * rr, Math.sin(a) * rr, z];
    const q = (a, rr) => gu(Math.cos(a) * rr, Math.sin(a) * rr);
    f.quad(rec, p(a0, hub, z0), p(a1, hub, z0), p(a1, R, z0), p(a0, R, z0), q(a0, hub), q(a1, hub), q(a1, R), q(a0, R));   // its face to -z
    f.quad(rec, p(a0, R, z1), p(a1, R, z1), p(a1, hub, z1), p(a0, hub, z1), q(a0, R), q(a1, R), q(a1, hub), q(a0, hub));   // and to +z
    f.quad(rec, p(a0, R, z0), p(a1, R, z0), p(a1, R, z1), p(a0, R, z1), [r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]);   // its rim
    const b = ((i + 1) / n) * Math.PI * 2, R0 = i % 2 ? root : P.gear, R1 = i % 2 ? P.gear : root;
    f.quad(rec, p(b, R0, z0), p(b, R1, z0), p(b, R1, z1), p(b, R0, z1), [r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]);   // a tooth's flank
  }
  for (const s of [-1, 1]) bar(f, rec, [s * P.head, 0, 0], [s * P.foot, -P.len - P.into, 0], P.rod, A.rod);
  return packRealmFaces(f);
}

/** THE CRUMBLE'S FOUR CHUNKS: each a prism of its box between its two main cracks (world/sdStepsArt.js SD_CRUMBLE_CRACKS)
 *  - `{ model, at, poly }`: its mesh in a frame of its own about `at` (its middle, the step's own frame), and its outline
 *  on the top (x, z). Its top wears the Crumble's widest stage where it lay; its outer sides the sides; its broken faces
 *  and its foot the underside. */
export function buildCrumbleChunks() {
  const { at, across, along } = SD_CRUMBLE_CRACKS, W = SD_CRUMBLE_SIZE.w / 2, D = SD_CRUMBLE_SIZE.d / 2, H = SD_STEP_THICK;
  const k = across.findIndex((p) => p === at || (p[0] === at[0] && p[1] === at[1])), j = along.findIndex((p) => p[0] === at[0] && p[1] === at[1]);
  const xNeg = across.slice(0, k + 1).reverse(), xPos = across.slice(k), zNeg = along.slice(0, j + 1).reverse(), zPos = along.slice(j);
  const regions = [[zPos, [W, D], xPos], [xNeg, [-W, D], zPos], [zNeg, [-W, -D], xNeg], [xPos, [W, -D], zNeg]];
  const rec = SD_STEPS_RECORD.crumble[3], A = SD_STEPS_ATLAS, T = cellUv(A, A.top), S = cellUv(A, A.side), U = cellUv(A, A.under);
  const tw = SD_CRUMBLE_SIZE.w - 2 * SD_STEP_BEVEL, td = SD_CRUMBLE_SIZE.d - 2 * SD_STEP_BEVEL, cl = (v) => Math.max(0, Math.min(1, v));
  const topUv = (x, z) => [T[0] + (T[2] - T[0]) * cl(x / tw + 0.5), T[1] + (T[3] - T[1]) * cl(z / td + 0.5)];
  return regions.map(([a, corner, b]) => {
    let poly = [...a, corner, ...b.slice(1).reverse()].map((p) => [p[0], p[1]]);
    // wound clockwise in (x, z) - so a fan's faces turn up (+y) under faces()' winding
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p[0] * q[1] - q[0] * p[1]; }
    if (area > 0) poly = poly.reverse();
    let cx = 0, cz = 0;
    for (const p of poly) { cx += p[0]; cz += p[1]; }
    cx /= poly.length; cz /= poly.length;
    const mid = [cx, -H / 2, cz], o = (x, y, z) => [x - mid[0], y - mid[1], z - mid[2]];
    const f = faces();
    for (const [p, q, r] of earClip(poly)) {
      f.tri(rec, o(p[0], 0, p[1]), o(q[0], 0, q[1]), o(r[0], 0, r[1]), topUv(p[0], p[1]), topUv(q[0], q[1]), topUv(r[0], r[1]));
      f.tri(rec, o(r[0], -H, r[1]), o(q[0], -H, q[1]), o(p[0], -H, p[1]), [U[0], U[1]], [U[2], U[1]], [U[2], U[3]]);
    }
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const outer = (Math.abs(p[0]) === W && Math.abs(q[0]) === W && p[0] === q[0]) || (Math.abs(p[1]) === D && Math.abs(q[1]) === D && p[1] === q[1]);
      const c = outer ? S : U;
      f.quad(rec, o(q[0], 0, q[1]), o(p[0], 0, p[1]), o(p[0], -H, p[1]), o(q[0], -H, q[1]), [c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]);
    }
    return { model: packRealmFaces(f), at: Object.freeze(mid), poly: Object.freeze(poly.map((p) => Object.freeze(p))) };
  });
}
/** A simple polygon wound clockwise in (x, z), cut into triangles wound the same way (ear clipping: a corner that turns
 *  clockwise and holds no other corner is cut off, until three are left). */
function earClip(poly) {
  const cw = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0;
  const inside = (p, a, b, c) => cw(a, b, p) && cw(b, c, p) && cw(c, a, p);
  const v = poly.slice(), out = [];
  for (let guard = 0; v.length > 3 && guard < 256; guard++) {
    for (let i = 0; i < v.length; i++) {
      const a = v[(i + v.length - 1) % v.length], b = v[i], c = v[(i + 1) % v.length];
      if (!cw(a, b, c) || v.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push([a, b, c]); v.splice(i, 1);
      break;
    }
  }
  out.push([v[0], v[1], v[2]]);
  return out;
}
/** THE GRIT a shaking Crumble pours from its underside: specks in a column under it, repeating every SD_GRIT.period
 *  down (the scene scrolls it), the topmost hidden in the stone - and how fast it pours (m/s). */
export const SD_GRIT = Object.freeze({ n: 42, period: 0.5, depth: 3.2, speed: 2.4, speck: 0.05, half: 1.0 });
export function buildGritModel(seed = 0x5d95) {
  const f = faces(), rec = SD_STEPS_RECORD.parts, c = cellUv(SD_PARTS_ATLAS, SD_PARTS_ATLAS.grit);
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const per = Math.round(SD_GRIT.n / ((SD_GRIT.depth + SD_GRIT.period) / SD_GRIT.period)), lay = [];
  for (let k = 0; k < per; k++) lay.push([(rnd() * 2 - 1) * SD_GRIT.half, rnd() * SD_GRIT.period, (rnd() * 2 - 1) * SD_GRIT.half]);
  const UV = [[c[0], c[1]], [c[2], c[1]], [(c[0] + c[2]) / 2, c[3]]];
  for (let y0 = -SD_STEP_THICK + SD_GRIT.period; y0 > -SD_STEP_THICK - SD_GRIT.depth; y0 -= SD_GRIT.period) {
    for (const [x, dy, z] of lay) {
      const e = SD_GRIT.speck, y = y0 - dy, P = [[x, y + e, z], [x - e, y - e, z - e], [x + e, y - e, z - e], [x, y - e, z + e]];
      for (const [a, b, d] of [[0, 2, 1], [0, 3, 2], [0, 1, 3], [1, 2, 3]]) f.tri(rec, P[a], P[b], P[d], ...UV);
    }
  }
  return packRealmFaces(f);
}

/** THE WAYSTONES: one on each checkpoint (A the first step, B, C), beside the landing - the realm's frame, its foot. */
export const SD_WAYSTONES = Object.freeze(SD_CHECKPOINTS.map((c) => Object.freeze([c.x - 1.9, c.y, c.z + 0.4])));
/** A WAYSTONE, its own frame (its foot the origin): an Ending-stone in miniature - a plinth, a tapering shaft with the
 *  Hour's rune on every face (lit gold, or dark: the draw's remap), a brass cap. */
export const SD_WAYSTONE = Object.freeze({ base: 0.5, baseH: 0.12, shaft: 0.3, top: 0.24, h: 0.85, cap: 0.18 });
export function buildWaystoneModel() {
  const f = faces(), W = SD_WAYSTONE, rec = SD_STEPS_RECORD.parts, P = SD_PARTS_ATLAS;
  const box = (hw0, hw1, y0, y1, cell, ends) => {
    const c = cellUv(P, cell), r0 = [[-hw0, y0, -hw0], [hw0, y0, -hw0], [hw0, y0, hw0], [-hw0, y0, hw0]], r1 = [[-hw1, y1, -hw1], [hw1, y1, -hw1], [hw1, y1, hw1], [-hw1, y1, hw1]];
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0]]) f.quad(rec, r1[i], r1[j], r0[j], r0[i], [c[0], c[3]], [c[2], c[3]], [c[2], c[1]], [c[0], c[1]]);   // its rune drawn y up (row 0 the foot)
    if (ends) f.quad(rec, r1[0], r1[3], r1[2], r1[1], [c[0], c[1]], [c[0], c[3]], [c[2], c[3]], [c[2], c[1]]);
  };
  box(W.base / 2, W.base / 2, 0, W.baseH, P.stone, true);
  box(W.shaft / 2, W.top / 2, W.baseH, W.baseH + W.h, P.rune, false);
  const c = cellUv(P, P.cap), y0 = W.baseH + W.h, s = W.top / 2 + 0.03, apex = [0, y0 + W.cap, 0], r = [[-s, y0, -s], [s, y0, -s], [s, y0, s], [-s, y0, s]];
  for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0]]) f.tri(rec, r[j], r[i], apex, [c[2], c[1]], [c[0], c[1]], [(c[0] + c[2]) / 2, c[3]]);
  return packRealmFaces(f);
}

/** THE VANE on C (the realm's frame, its post's foot), its height, how long it takes to swing to the push's way and to
 *  swing back, and its arrow (m). */
export const SD_VANE = Object.freeze({ at: Object.freeze([SD_CHECKPOINTS[2].x + 1.6, SD_CHECKPOINTS[2].y, SD_CHECKPOINTS[2].z + 1.4]), h: 2.4, swing: 0.25, back: 0.8, arm: 1.0, fin: 0.7, head: 0.55, post: 0.09 });
const _vaneGust = { push: 0, warn: false };
/**
 * THE VANE'S YAW at the realm's second `io[0]`, written to `io[1]` (0 down the course, +z; a quarter turn +x -
 * world/sdRemnantModel.js remnantMatrix's sense): from the instant a gust's wind rises (SD_GUST_WARN before it) it swings,
 * eased over SD_VANE.swing, to point the way that gust will push (the law's own gustAt) and holds through the gust; then
 * eases back over SD_VANE.back. Smooth - it warns of danger. Pure, and makes nothing (AUDIT SD II L2 F9: its numbers in
 * and out through `io`, never a double handed across a call).
 */
export function vaneYawInto(io) {
  const t = io[0], n = Math.floor((t + SD_GUST_WARN) / SD_GUST_EVERY), u = t + SD_GUST_WARN - n * SD_GUST_EVERY, span = SD_GUST_WARN + SD_GUST_FOR;
  const dir = gustAt(n * SD_GUST_EVERY + SD_GUST_FOR / 2, _vaneGust).push > 0 ? 1 : -1;
  const k = u < span ? u / SD_VANE.swing : (u - span) / SD_VANE.back, e = k < 0 ? 0 : k > 1 ? 1 : k, w = e * e * (3 - 2 * e);
  io[1] = dir * (Math.PI / 2) * (u < span ? w : 1 - w);
}
/** The vane's yaw at `t` (vaneYawInto's, for a caller with a number in hand). */
export const vaneYawAt = (t) => { const io = new Float64Array(2); io[0] = t; vaneYawInto(io); return io[1]; };

/** THE VANE, its own frame (its post's foot the origin, the arrow along +z at its top): a brass post, the arrow's shaft and
 *  head, and its fin wearing the Hollow's Ending's sign (world/sdHallArt.js's emblem - `ending` an id of net/sdMarks.js
 *  SD_ENDINGS; none: plain brass) - every flat part both ways. */
export function buildVaneModel(ending = null) {
  const f = faces(), V = SD_VANE, rec = SD_STEPS_RECORD.parts, P = SD_PARTS_ATLAS, i = SD_ENDINGS.findIndex((E) => E.id === ending);
  bar(f, rec, [0, 0, 0], [0, V.h + 0.1, 0], V.post, P.rod);
  bar(f, rec, [0, V.h, -V.arm], [0, V.h, V.arm], 0.06, P.rod);
  const q = cellUv(P, P.vane), y = V.h, hw = V.head * 0.45, tip = [0, y, V.arm + V.head], lo = [0, y - hw, V.arm], hi = [0, y + hw, V.arm];
  f.tri(rec, lo, hi, tip, [q[0], q[1]], [q[0], q[3]], [q[2], q[1]]); f.tri(rec, tip, hi, lo, [q[2], q[1]], [q[0], q[3]], [q[0], q[1]]);   // the head, both ways
  const zf = -V.arm, zb = -V.arm + V.fin, yl = y - V.fin * 0.45, yh = y + V.fin * 0.55;
  // its fin: the sign the right way round from either side (facing +z, +x is on the right - the camera's one mirror)
  const fr = i >= 0 ? SD_HALL_EMBLEM_RECORD + i : rec, u0 = i >= 0 ? 0 : q[0], u1 = i >= 0 ? 1 : q[2], v0 = i >= 0 ? 0 : q[1], v1 = i >= 0 ? 1 : q[3];
  f.quad(fr, [0, yl, zf], [0, yl, zb], [0, yh, zb], [0, yh, zf], [u1, v0], [u0, v0], [u0, v1], [u1, v1]);   // seen from -x
  f.quad(fr, [0, yh, zf], [0, yh, zb], [0, yl, zb], [0, yl, zf], [u0, v1], [u1, v1], [u1, v0], [u0, v0]);   // seen from +x
  return packRealmFaces(f);
}

/** THE CHECKPOINTS B and C, one mesh in the dungeon's frame: islands at their heights. */
export function buildChecksModel() {
  const f = faces();
  for (const [k, c] of SD_CHECKPOINTS.entries()) if (k > 0) realmIsland(f, c.x, c.z, c.r, SD_REALM_FLOOR_RECORD, { y: c.y, lean: k === 1 ? 1 : -1.5 });
  return packRealmFaces(f);
}
/** Their floors, for the collider (the dungeon's frame): a disc each, at its height. */
export function checkFloorTris() {
  const out = [];
  for (const [k, { x: cx, y, z: cz, r }] of SD_CHECKPOINTS.entries()) {
    if (k === 0) continue;   // A is the first step, the hall's (world/sdHall.js hallFloorTris)
    for (let j = 0; j < SD_ISLAND_SIDES; j++) {
      const a0 = (j / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((j + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
      out.push(...realmToDungeon(cx, y, cz), ...realmToDungeon(cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r), ...realmToDungeon(cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r));
    }
  }
  return new Float32Array(out);
}

/** AUDIT SD II (L2 F18): THE BREATH'S STREAKS - how many, how far either side of the course's line they lie, how far the
 *  breath carries them over its two seconds (scenes/sdSteps.js), and each one's length and its head's thickness. */
export const SD_BREATH = Object.freeze({ n: 64, halfX: 10, sweep: 10, len: 1.4, thick: 0.04 });
/**
 * THE WARP'S BREATH SEEN: SD_BREATH.n streaks of brass light (the hands' glow, as the Beat's sides wear it) over the
 * Crumble - from C's far edge to the course's end, each at the course's height there or a little over it - one mesh in
 * the REALM's frame (x 0 the course's line; the draw's matrix stands it at SD_REALM_ORIGIN, moves it across, and turns it
 * by x's sign the way the breath blows). Each a streak tapering from its head (toward +x) to its tail, upright and lying flat, every face both ways - a
 * player sees it from the side, from above, and as the mirror turns it. The same streaks every boot.
 */
export function buildBreathModel() {
  const f = faces(), C = SD_CHECKPOINTS[2], z0 = C.z + C.r, z1 = SD_COURSE_END;
  let seed = 0x5db7;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rec = SD_HALL_GLOW_RECORD.brass, UV = [[0, 0], [0, 1], [1, 1], [1, 0]];
  const both = (a, b, c, d) => { f.quad(rec, a, b, c, d, ...UV); f.quad(rec, d, c, b, a, ...UV); };
  for (let k = 0; k < SD_BREATH.n; k++) {
    const x = (rnd() * 2 - 1) * SD_BREATH.halfX, z = z0 + rnd() * (z1 - z0);
    const y = C.y * (1 - (z - z0) / (z1 - z0)) - 0.4 + rnd() * 2.6;   // about the course's height there
    const half = (SD_BREATH.len * (0.6 + 0.4 * rnd())) / 2, t = SD_BREATH.thick, tail = t * 0.2;
    both([x - half, y - tail, z], [x - half, y + tail, z], [x + half, y + t, z], [x + half, y - t, z]);   // upright
    both([x - half, y, z + tail], [x - half, y, z - tail], [x + half, y, z - t], [x + half, y, z + t]);   // lying flat
  }
  return packRealmFaces(f);
}
