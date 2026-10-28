// @ts-check
// MERCHANT-YARDS (2026-10-10): WHAT A TOWN'S TWO YARDS ARE MADE OF - the port's own geometry, in each yard's own frame
// (y up from its ground, its front - its gate's side, the street's - along +z, x across), worn in the port's own art
// (world/merchantYards/merchantYardArt.js, YARD_ARCHIVE). Every face is wound outward (the world pass culls the back), and the
// collider is the same triangles. Nothing of Daggerfall's is read.
//
// THE STABLE (YARD_FOOT.stable, 14 m by 11.5): a post-and-two-rail paddock fence round trodden earth; across its back a
// shingled lean-to of upright boards, three stalls under it - bales stacked in one, a manger in the next, a pile of hay
// in the last; a water trough along the paddock's side; at its front a GATE ARCH, two tall posts and a beam over the
// way in, the yard's signboard hung from the beam on iron rods (high enough to walk under); a hitching rail on the
// apron outside. Three horses stand in the paddock and the stablemaster inside the gate (the host's - `points`).
//
// THE WAGON YARD (YARD_FOOT.transport, 18 m by 13.5): a low post-and-rail fence on three sides round packed gravel, its
// front open wide for a team; across its back a wainwright's shed - a workbench, two wheels leant on the wall, a stack
// of planks, a barrel; and on the apron a SIGNPOST, its arm over the street, the signboard hung from it. A Small Cart,
// an Open Wagon and a Caravan stand drawn up in the gravel and the wagonwright at the gate (the host's - `points`).
//
// CARP-YARD (2026-10-12): THE JOINERY (YARD_FOOT.carpenter, 14 m by 12): a low post-and-rail fence round a sawdust
// floor, a GATE ARCH at its front with the JOINERY board hung from its beam; across its back a shingled workshop, open to
// the yard - THE WORKBENCH in its middle (Carpentry's station: legs, a top, a shelf under it, a vise at its front corner,
// a plane, a mallet and offcuts on it) under a tool board on the back wall (a hand saw, a hammer, a square, three
// chisels); a timber rack of three shelves of planks in its left bay; in its right a chair half made, a finished chest
// and a barrel of dowels. In the yard a pile of five logs, two sawhorses with a plank across them, a chopping block with
// an axe in it, a stack of sawn planks drying on bearers with stickers between its layers; and by the gate the
// carpenter's work on show - a table with a chair at each end, and a bench. The carpenter stands inside the gate (the
// host's - `points`).
//
// SHIPYARDS (2026-10-11): the face kit below is the port's too - world/shipyardModel.js and world/lighthouseModel.js
// build with it (YARD_MESH_KIT, at this file's end), under the port's own pictures (world/portArt.js).
//
// Pure: no renderer, no GL, no clock. Not a DFU member. Ledger A (MERCHANT-YARDS).
import { YARD_ARCHIVE, YARD_REC } from './merchantYardArt.js';
import { YARD_FOOT } from './merchantYardSites.js';

/** Metres of a material one tile of its picture covers. */
export const YARD_TILE_M = 1.2;
/** How far a post, a wall or a footing is sunk below the ground (a gentle slope never shows light under it). */
export const YARD_SINK = 0.3;
/** The ground's own floor stands this far over the ground (over the terrain, never in it). */
export const YARD_FLOOR_Y = 0.025;
/** A signboard: its width, its height, its thickness (world/merchantYards/merchantYardArt.js SIGN_ART_W x SIGN_ART_H is its picture). */
export const SIGN_BOARD = Object.freeze({ w: 1.6, h: 0.7, t: 0.06 });

/** The Stable's fence, gate and sheds, metres in its frame. */
export const STABLE_YARD = Object.freeze({
  fence: Object.freeze({ x0: -6.5, x1: 6.5, z0: -5.75, z1: 4.25, h: 1.35, rails: Object.freeze([0.55, 1.1]) }),
  gate: Object.freeze({ half: 1.6, postH: 3.5, beamY: 3.3 }),
  shed: Object.freeze({ z0: -5.75, z1: -2.55, backH: 3.2, frontH: 2.55 }),
  /** the three horses: [x, z, forward x, forward z] in the paddock */
  horses: Object.freeze([[-3.8, 1.0, 0.8, 0.6], [0.2, -1.0, -0.2, -1], [3.4, 0.6, -0.6, 0.8]].map((h) => Object.freeze(h))),
  /** the stablemaster: inside the gate */
  keeper: Object.freeze([2.2, 3.5]),
});
/** The Wagon Yard's fence, opening, shed, signpost and the three wagons' places, metres in its frame. */
export const WAGON_YARD = Object.freeze({
  fence: Object.freeze({ x0: -8.5, x1: 8.5, z0: -6.75, z1: 5.25, h: 1.1, rails: Object.freeze([0.5, 0.95]) }),
  opening: 6.2,
  shed: Object.freeze({ z0: -6.75, z1: -4.35, backH: 3.0, frontH: 2.5 }),
  post: Object.freeze({ x: -7.6, z: 6.15, h: 3.6, armY: 3.3, armTo: -5.4 }),   // its board's foot over a walker's head
  /** each wagon on show: its kind (systems/wagon/wagonKinds.js) and the middle of its ground, [x, z] - the host centres the
   *  wagon's own box there, its front to the street */
  wagons: Object.freeze([['cart', -5.6, 0.4], ['openWagon', 0, 0.4], ['caravan', 5.6, 0.4]].map((w) => Object.freeze(w))),
  /** the wagonwright: at the opening, beside the signpost */
  keeper: Object.freeze([-5.2, 5.7]),
});

/** CARP-YARD: the Joinery's fence, gate, workshop and yard, metres in its frame. */
export const CARPENTER_YARD = Object.freeze({
  fence: Object.freeze({ x0: -6.5, x1: 6.5, z1: 4.5, h: 1.1, rails: Object.freeze([0.5, 0.95]) }),
  gate: Object.freeze({ half: 1.8, postH: 3.5, beamY: 3.3 }),
  shop: Object.freeze({ z0: -6, z1: -2.6, backH: 3.3, frontH: 2.7 }),
  /** THE WORKBENCH - Carpentry's station: its top's box [x0, y0, z0, x1, y1, z1] */
  bench: Object.freeze([-1.7, 0.88, -5.6, 1.7, 0.98, -4.85]),
  /** the carpenter: inside the gate, beside the way in */
  keeper: Object.freeze([-2.6, 3.1]),
});

/** @param {number[]} a @param {number[]} b */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {number[]} a @param {number[]} b */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {number[]} a */
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** @param {number[]} a @param {number[]} b */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A flat-shaded face builder, by picture (world/lefayMonument.js faces' law: a triangle's normal is cross(b - a,
 *  c - a), and that is its outside). `quad` takes the face's outward normal and winds it so. */
function faces() {
  /** @type {Map<number, {p: number[], n: number[], uv: number[], hung: boolean[]}>} */
  const byRec = new Map();
  let hanging = false;   // FIELD BUGS 2026-10-25i SIGN-PASS: whether the faces laid now hang (a signboard's) - each triangle's mark in its group's `hung`
  const tri = (rec, a, b, c, ua, ub, uc) => {
    let g = byRec.get(rec);
    if (!g) byRec.set(rec, g = { p: [], n: [], uv: [], hung: [] });
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const [v, u] of [[a, ua], [b, ub], [c, uc]]) { g.p.push(v[0], v[1], v[2]); g.n.push(n[0], n[1], n[2]); g.uv.push(u[0], u[1]); }
    g.hung.push(hanging);
  };
  /** a, b, c, d round the face (either way), `out` its outward normal; uvs beside them. */
  const quad = (rec, a, b, c, d, ua, ub, uc, ud, out) => {
    if (dot(cross(sub(b, a), sub(c, a)), out) < 0) { tri(rec, a, d, c, ua, ud, uc); tri(rec, a, c, b, ua, uc, ub); return; }
    tri(rec, a, b, c, ua, ub, uc); tri(rec, a, c, d, ua, uc, ud);
  };
  /** SIGN-PASS: the faces laid from here, until it is said again, hang - drawn, met by rays, no body's (assemble's `sight`) */
  const hang = (/** @type {boolean} */ on) => { hanging = on; };
  return { tri, quad, byRec, hang };
}

/** The picture's place for a point on a face looking along `n`: the two axes across the face, a tile every YARD_TILE_M.
 *  A side face runs its u along the face and its v down (row 0 is up). */
function uvOf(p, n) {
  const T = YARD_TILE_M;
  if (Math.abs(n[1]) > 0.7) return [p[0] / T, p[2] / T];
  if (Math.abs(n[0]) > Math.abs(n[2])) return [p[2] / T, -p[1] / T];
  return [p[0] / T, -p[1] / T];
}

/**
 * A hexahedron from its eight corners - [x0z0, x1z0, x1z1, x0z1] at its foot, then the same four at its top - each face
 * worn in `rec` (or `top` for the top face), its uvs off the world's axes (uvOf). A box is its axis-aligned case.
 * `under` adds its foot (a piece seen from below).
 */
function hexa(f, rec, c, { top = rec, under = false, uv = uvOf } = {}) {
  const [a0, b0, c0, d0, a1, b1, c1, d1] = c;
  const mid = c.reduce((m, p) => [m[0] + p[0] / 8, m[1] + p[1] / 8, m[2] + p[2] / 8], [0, 0, 0]);
  const face = (r, p, q, s, t) => {
    const fm = [(p[0] + q[0] + s[0] + t[0]) / 4, (p[1] + q[1] + s[1] + t[1]) / 4, (p[2] + q[2] + s[2] + t[2]) / 4];
    const out = norm(sub(fm, mid));
    let n = norm(cross(sub(q, p), sub(s, p)));
    if (dot(n, out) < 0) n = [-n[0], -n[1], -n[2]];
    f.quad(r, p, q, s, t, uv(p, n), uv(q, n), uv(s, n), uv(t, n), out);
  };
  face(rec, a0, b0, b1, a1);   // the -z side
  face(rec, b0, c0, c1, b1);   // +x
  face(rec, c0, d0, d1, c1);   // +z
  face(rec, d0, a0, a1, d1);   // -x
  face(top, a1, b1, c1, d1);   // top
  if (under) face(rec, a0, b0, c0, d0);
}
/** An axis-aligned box. */
const box = (f, rec, x0, y0, z0, x1, y1, z1, o = {}) => hexa(f, rec, [
  [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
], o);
/** A post: a square of side `s` about (x, z), from the sunk foot to `h`. */
const post = (f, x, z, h, s = 0.16, rec = YARD_REC.wood) => box(f, rec, x - s / 2, -YARD_SINK, z - s / 2, x + s / 2, h, z + s / 2);

/** A FENCE RUN from (x0, z0) to (x1, z1) along one axis: a post at each end and every `step` or less between, and a rail
 *  at each height of `rails` from post to post. */
function fenceRun(f, x0, z0, x1, z1, { h, rails, step = 2.2, s = 0.16, rail = [0.08, 0.14], ends = true }) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / step));
  const at = (k) => [x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n];
  for (let k = ends ? 0 : 1; k <= (ends ? n : n - 1); k++) { const [x, z] = at(k); post(f, x, z, h, s); }
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const [t, hh] = rail;
  for (const y of rails) {
    if (alongX) box(f, YARD_REC.wood, Math.min(x0, x1), y - hh / 2, z0 - t / 2, Math.max(x0, x1), y + hh / 2, z0 + t / 2, { under: true });
    else box(f, YARD_REC.wood, x0 - t / 2, y - hh / 2, Math.min(z0, z1), x0 + t / 2, y + hh / 2, Math.max(z0, z1), { under: true });
  }
}

/** The ground's own floor over x0..x1, z0..z1 at YARD_FLOOR_Y, in `rec`. */
function floor(f, rec, x0, z0, x1, z1) {
  const y = YARD_FLOOR_Y, up = [0, 1, 0];
  const P = (x, z) => [x, y, z], U = (x, z) => [x / YARD_TILE_M, z / YARD_TILE_M];
  f.quad(rec, P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1), U(x0, z0), U(x1, z0), U(x1, z1), U(x0, z1), up);
}

/** A LEAN-TO across the yard's back: its back wall of boards, its two side walls up to the roof's slope, its front
 *  posts (at `posts` x), its roof of shingles from over the back to over the front, and its stall walls (at `stalls`
 *  x, `stallH` high). */
function leanTo(f, { x0, x1, z0, z1, backH, frontH, posts, stalls = [], stallH = 1.4, stallTo = z1 - 0.6 }) {
  const W = 0.15, slope = (z) => backH + ((frontH - backH) * (z - z0)) / (z1 - z0);
  box(f, YARD_REC.plank, x0, -YARD_SINK, z0, x1, backH, z0 + W);   // the back wall
  for (const [a, b] of [[x0, x0 + W], [x1 - W, x1]]) {   // the side walls, their tops along the roof
    hexa(f, YARD_REC.plank, [
      [a, -YARD_SINK, z0 + W], [b, -YARD_SINK, z0 + W], [b, -YARD_SINK, z1], [a, -YARD_SINK, z1],
      [a, slope(z0 + W), z0 + W], [b, slope(z0 + W), z0 + W], [b, slope(z1), z1], [a, slope(z1), z1],
    ]);
  }
  for (const x of posts) post(f, x, z1 - 0.1, slope(z1 - 0.1), 0.18);
  for (const x of stalls) box(f, YARD_REC.plank, x - 0.04, 0, z0 + W, x + 0.04, stallH, stallTo);
  // the roof: a slab from past the back wall to past the front posts, eaves overhanging the sides
  const o = 0.3, t = 0.12, zb = z0 - 0.2, zf = z1 + 0.35, yb = slope(zb) + 0.12, yf = slope(zf) + 0.12;
  hexa(f, YARD_REC.plank, [
    [x0 - o, yb - t, zb], [x1 + o, yb - t, zb], [x1 + o, yf - t, zf], [x0 - o, yf - t, zf],
    [x0 - o, yb, zb], [x1 + o, yb, zb], [x1 + o, yf, zf], [x0 - o, yf, zf],
  ], { top: YARD_REC.shingle, under: true, uv: (p, n) => (n[1] > 0.7 ? [p[0] / YARD_TILE_M, (p[2] - zb) / YARD_TILE_M] : uvOf(p, n)) });
}

/** A SIGNBOARD hung square to the yard's front at (x, yMid, z): its two faces the yard's picture (`rec`) - the back's
 *  turned so it reads from behind as well - its edges plain wood, and two iron rods from its top to `hangTo`.
 *  FIELD BUGS 2026-10-25i SIGN-PASS: it HANGS - drawn, met by every ray, no body's (assemble's `sight`): a gate's board 2.4 m up, under its
 *  beam over the way in, stood inside a rider's 2.6 m capsule (player/motor.js RIDE_HEIGHT), and no horse or wagon could
 *  be ridden in under it; the beam over it, at 3.3 m, stays the wall it is. */
function signboard(f, rec, x, yMid, z, hangTo) {
  f.hang(true);
  const { w, h, t } = SIGN_BOARD, x0 = x - w / 2, x1 = x + w / 2, y0 = yMid - h / 2, y1 = yMid + h / 2, z0 = z - t / 2, z1 = z + t / 2;
  // the front (+z): its top-left, seen from the street, at the picture's top-left. The world is left-handed - an eye
  // looking along +z has +x on its RIGHT (world/mat4.js THE HANDEDNESS LAW) - so from the street, looking along -z,
  // +x is on the viewer's LEFT and the picture's left edge is at x1
  f.quad(rec, [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 1]);
  // the back (-z): seen from inside the yard, looking along +z, +x is on the viewer's RIGHT: its left edge at x0
  f.quad(rec, [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, -1]);
  const e = [0, 0], g = [0.1, 1];
  f.quad(YARD_REC.wood, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], e, g, g, e, [0, 1, 0]);
  f.quad(YARD_REC.wood, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], e, g, g, e, [0, -1, 0]);
  f.quad(YARD_REC.wood, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], e, g, g, e, [-1, 0, 0]);
  f.quad(YARD_REC.wood, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], e, g, g, e, [1, 0, 0]);
  for (const rx of [x0 + 0.12, x1 - 0.12]) box(f, YARD_REC.iron, rx - 0.015, y1, z - 0.015, rx + 0.015, hangTo, z + 0.015);
  f.hang(false);
}

/** A WHEEL of `spokes` spokes, radius `r`, its middle at `c`, standing in the x-y plane (its axle along z) and leant
 *  `lean` radians back from upright, its top toward -z (a wall behind it): an iron tyre, a wooden felloe, the spokes and
 *  a hub - each a prism, all `half` thick each side of its plane. */
function wheel(f, c, r, lean, { spokes = 10, half = 0.05 } = {}) {
  const cl = Math.cos(lean), sl = Math.sin(lean);
  // the wheel's plane: across it u (along x), up it v (along y); w along its axle (z) - turned about x by the lean
  const P = (u, v, w) => [c[0] + u, c[1] + v * cl + w * sl, c[2] - v * sl + w * cl];
  const ring = (rec, r0, r1, n = 16) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, b = ((k + 1) / n) * Math.PI * 2;
      const pts = (rr, ang, x) => P(Math.cos(ang) * rr, Math.sin(ang) * rr, x);
      hexa(f, rec, [pts(r0, a, -half), pts(r1, a, -half), pts(r1, b, -half), pts(r0, b, -half), pts(r0, a, half), pts(r1, a, half), pts(r1, b, half), pts(r0, b, half)]);
    }
  };
  ring(YARD_REC.iron, r - 0.04, r);
  ring(YARD_REC.wood, r - 0.12, r - 0.04);
  ring(YARD_REC.iron, 0.04, 0.12, 8);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2, s = 0.025;
    const along = [Math.cos(a), Math.sin(a)], across = [-Math.sin(a), Math.cos(a)];
    const at = (rr, w, x) => P(along[0] * rr + across[0] * w, along[1] * rr + across[1] * w, x);
    hexa(f, YARD_REC.wood, [at(0.12, -s, -half / 2), at(r - 0.12, -s, -half / 2), at(r - 0.12, s, -half / 2), at(0.12, s, -half / 2),
      at(0.12, -s, half / 2), at(r - 0.12, -s, half / 2), at(r - 0.12, s, half / 2), at(0.12, s, half / 2)]);
  }
}

/** A prism about y at (x, z): `sides` faces from radius r0 at y0 to r1 at y1, its top capped in `top`. */
function drum(f, rec, x, z, sides, r0, r1, y0, y1, top = rec) {
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2, b = ((k + 1) / sides) * Math.PI * 2;
    const p = (r, ang, y) => [x + Math.cos(ang) * r, y, z + Math.sin(ang) * r];
    const out = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    const v = (y1 - y0) / YARD_TILE_M, u = ((r0 + r1) * Math.PI) / sides / YARD_TILE_M;
    f.quad(rec, p(r0, a, y0), p(r0, b, y0), p(r1, b, y1), p(r1, a, y1), [0, v], [u, v], [u, 0], [0, 0], out);
    if (r1 > 0) f.tri(top, [x, y1, z], p(r1, b, y1), p(r1, a, y1), [0.5, 0.5], [0.5 + Math.cos(b) * 0.4, 0.5 + Math.sin(b) * 0.4], [0.5 + Math.cos(a) * 0.4, 0.5 + Math.sin(a) * 0.4]);
  }
}

/** CARP-YARD: A LOG lying along z from z0 to z1, its axis at (x, yc), radius r: `sides` faces of bark (its furrows
 *  along the log - the picture's u along z) and its two sawn ends in end grain, their rings about the picture's middle. */
function logZ(f, x, yc, z0, z1, r, sides = 9) {
  const p = (a, z) => [x + Math.cos(a) * r, yc + Math.sin(a) * r, z];
  const T = YARD_TILE_M, round = (2 * Math.PI * r) / sides / T;
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2, b = ((k + 1) / sides) * Math.PI * 2, m = (a + b) / 2;
    f.quad(YARD_REC.bark, p(a, z0), p(b, z0), p(b, z1), p(a, z1), [z0 / T, k * round], [z0 / T, (k + 1) * round], [z1 / T, (k + 1) * round], [z1 / T, k * round], [Math.cos(m), Math.sin(m), 0]);
    const ua = [0.5 + Math.cos(a) * 0.48, 0.5 - Math.sin(a) * 0.48], ub = [0.5 + Math.cos(b) * 0.48, 0.5 - Math.sin(b) * 0.48];
    f.tri(YARD_REC.endgrain, [x, yc, z1], p(a, z1), p(b, z1), [0.5, 0.5], ua, ub);   // +z: its normal cross(a - c, b - c) along +z
    f.tri(YARD_REC.endgrain, [x, yc, z0], p(b, z0), p(a, z0), [0.5, 0.5], ub, ua);
  }
}
/** CARP-YARD: A BEAM of square section `half` each side, from P to Q (a sawhorse's splayed leg, an axe's handle). */
function beam(f, rec, P, Q, half) {
  const d = norm(sub(Q, P)), ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(d, ref)), v = cross(d, u);
  const at = (o, su, sv) => [o[0] + (u[0] * su + v[0] * sv) * half, o[1] + (u[1] * su + v[1] * sv) * half, o[2] + (u[2] * su + v[2] * sv) * half];
  hexa(f, rec, [at(P, -1, -1), at(P, 1, -1), at(P, 1, 1), at(P, -1, 1), at(Q, -1, -1), at(Q, 1, -1), at(Q, 1, 1), at(Q, -1, 1)], { under: true });
}
/** CARP-YARD: a TABLE, a CHAIR or a BENCH - its top (or seat) of `w` across x by `d` along z at `y`, on four legs; a
 *  chair's two back legs carried up `back` over the seat with a top rail between them (`back` 0: none), its back to
 *  `backZ` (-1 toward -z, +1 toward +z); `rail` false leaves the back legs bare (a chair half made). */
function furniture(f, x, z, w, d, y, { t = 0.05, leg = 0.05, back = 0, backZ = -1, rail = true, rec = YARD_REC.plank, top = YARD_REC.wood } = {}) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  box(f, rec, x0, y - t, z0, x1, y, z1, { top, under: true });
  for (const [lx, lz] of [[x0 + leg, z0 + leg], [x1 - leg, z0 + leg], [x1 - leg, z1 - leg], [x0 + leg, z1 - leg]]) {
    const tall = back > 0 && Math.sign(lz - z) === backZ;
    box(f, YARD_REC.wood, lx - leg / 2, 0, lz - leg / 2, lx + leg / 2, tall ? y + back : y - t, lz + leg / 2);
  }
  if (back > 0 && rail) { const bz = backZ < 0 ? z0 + leg : z1 - leg; box(f, YARD_REC.wood, x0 + leg / 2, y + back - 0.08, bz - leg / 2, x1 - leg / 2, y + back - 0.02, bz + leg / 2); }
}

/** The faces gathered by picture into renderer.createMesh's model shape (world/lefayMonument.js assemble's) - SHIPYARDS:
 *  under `archive` (the port's models wear world/portArt.js PORT_ARCHIVE, the yards' materials at the yards' records). */
function assemble(f, archive = YARD_ARCHIVE) {
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  const sight = new Uint8Array(count / 3);   // SIGN-PASS: a mark a triangle - 1 for a hung signboard's, a ray's and no body's (collider.js addMesh's `sight`)
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec), n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    for (let k = 0; k < n / 3; k++) sight[v / 3 + k] = g.hung[k] ? 1 : 0;
    subMeshes.push({ textureArchive: archive, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes, sight };
}

/** THE STABLE, in its own frame: renderer.createMesh's model shape (and the collider's). Pure. */
export function buildStableModel() {
  const f = faces(), F = STABLE_YARD.fence, G = STABLE_YARD.gate, S = STABLE_YARD.shed;
  floor(f, YARD_REC.dirt, F.x0 + 0.05, S.z0 + 0.15, F.x1 - 0.05, F.z1 - 0.05);
  leanTo(f, { x0: F.x0, x1: F.x1, z0: S.z0, z1: S.z1, backH: S.backH, frontH: S.frontH, posts: [F.x0 + 0.1, -2.15, 2.15, F.x1 - 0.1], stalls: [-2.15, 2.15] });
  // the paddock: its two sides from the shed's front to the front, and the front either side of the gate
  const fence = { h: F.h, rails: F.rails };
  fenceRun(f, F.x0, S.z1, F.x0, F.z1, fence);
  fenceRun(f, F.x1, S.z1, F.x1, F.z1, fence);
  fenceRun(f, F.x0, F.z1, -G.half, F.z1, { ...fence, ends: false });
  fenceRun(f, G.half, F.z1, F.x1, F.z1, { ...fence, ends: false });
  // the gate arch: its two posts, the beam over the way in, the signboard hung from the beam
  for (const x of [-G.half, G.half]) post(f, x, F.z1, G.postH, 0.24);
  box(f, YARD_REC.wood, -G.half - 0.35, G.beamY, F.z1 - 0.12, G.half + 0.35, G.beamY + 0.22, F.z1 + 0.12, { under: true });
  signboard(f, YARD_REC.signStable, 0, G.beamY - 0.2 - SIGN_BOARD.h / 2, F.z1, G.beamY);
  // under the lean-to: bales in the left stall, a manger in the middle one, a pile in the right
  for (const [x, y] of [[-5.2, 0], [-4.05, 0], [-4.62, 0.5]]) box(f, YARD_REC.hay, x - 0.5, y, S.z0 + 0.35, x + 0.5, y + 0.5, S.z0 + 0.95);
  box(f, YARD_REC.plank, -1.6, 0.6, S.z0 + 0.15, 1.6, 1.0, S.z0 + 0.7, { top: YARD_REC.hay, under: true });
  drum(f, YARD_REC.hay, 4.3, -4.3, 7, 1.0, 0.25, 0, 0.85);
  // the trough along the paddock's right side: its sides of boards, the water in it
  const tx0 = 5.25, tx1 = 6.05, tz0 = -1.2, tz1 = 1.4, th = 0.6, w = 0.06;
  box(f, YARD_REC.plank, tx0, 0, tz0, tx1, 0.12, tz1);   // its bottom
  box(f, YARD_REC.plank, tx0, 0, tz0, tx0 + w, th, tz1);
  box(f, YARD_REC.plank, tx1 - w, 0, tz0, tx1, th, tz1);
  box(f, YARD_REC.plank, tx0, 0, tz0, tx1, th, tz0 + w);
  box(f, YARD_REC.plank, tx0, 0, tz1 - w, tx1, th, tz1);
  f.quad(YARD_REC.water, [tx0 + w, 0.48, tz0 + w], [tx1 - w, 0.48, tz0 + w], [tx1 - w, 0.48, tz1 - w], [tx0 + w, 0.48, tz1 - w], [0, 0], [1, 0], [1, 2], [0, 2], [0, 1, 0]);
  // the hitching rail on the apron, beside the gate
  fenceRun(f, 3.0, YARD_FOOT.stable.hz - 0.55, 5.6, YARD_FOOT.stable.hz - 0.55, { h: 1.1, rails: [1.0], s: 0.14 });
  return assemble(f);
}

/** THE WAGON YARD, in its own frame: renderer.createMesh's model shape (and the collider's). The wagons on show are
 *  the host's (Mac's own wagons, drawn as a driven one is). Pure. */
export function buildTransportModel() {
  const f = faces(), F = WAGON_YARD.fence, S = WAGON_YARD.shed, P = WAGON_YARD.post;
  floor(f, YARD_REC.gravel, F.x0 + 0.05, S.z0 + 0.15, F.x1 - 0.05, F.z1 - 0.05);
  leanTo(f, { x0: F.x0, x1: F.x1, z0: S.z0, z1: S.z1, backH: S.backH, frontH: S.frontH, posts: [F.x0 + 0.1, -2.8, 2.8, F.x1 - 0.1] });
  const fence = { h: F.h, rails: F.rails, step: 2.4 };
  fenceRun(f, F.x0, S.z1, F.x0, F.z1, fence);
  fenceRun(f, F.x1, S.z1, F.x1, F.z1, fence);
  fenceRun(f, F.x0, F.z1, -WAGON_YARD.opening, F.z1, { ...fence, ends: false });
  fenceRun(f, WAGON_YARD.opening, F.z1, F.x1, F.z1, { ...fence, ends: false });
  for (const x of [-WAGON_YARD.opening, WAGON_YARD.opening]) post(f, x, F.z1, 1.6, 0.22);   // the opening's two gateposts
  // the wainwright's shed: a workbench, two wheels leant on the back wall, a stack of planks, a barrel
  box(f, YARD_REC.plank, -7.7, 0, S.z0 + 0.3, -5.5, 0.85, S.z0 + 1.05, { top: YARD_REC.wood });
  wheel(f, [-3.9, 0.62, S.z0 + 0.42], 0.6, 0.18);
  wheel(f, [-2.2, 0.62, S.z0 + 0.42], 0.6, 0.22, { spokes: 12 });
  for (let k = 0; k < 4; k++) box(f, YARD_REC.wood, 1.8, k * 0.1, S.z0 + 0.3 + (k % 2) * 0.05, 5.0, k * 0.1 + 0.09, S.z0 + 0.95 + (k % 2) * 0.05);
  drum(f, YARD_REC.plank, 6.9, S.z0 + 0.7, 10, 0.36, 0.36, 0, 0.95, YARD_REC.wood);
  // the signpost on the apron: its post, its arm out over the street, the signboard hung from the arm
  post(f, P.x, P.z, P.h, 0.22);
  box(f, YARD_REC.wood, P.x, P.armY, P.z - 0.08, P.armTo, P.armY + 0.16, P.z + 0.08, { under: true });
  box(f, YARD_REC.wood, P.x + 0.1, P.armY - 0.5, P.z - 0.05, P.x + 0.2, P.armY, P.z + 0.05);   // its brace
  signboard(f, YARD_REC.signTransport, (P.x + P.armTo) / 2 + 0.1, P.armY - 0.25 - SIGN_BOARD.h / 2, P.z, P.armY);
  return assemble(f);
}

/** CARP-YARD: THE JOINERY, in its own frame: renderer.createMesh's model shape (and the collider's). The carpenter is the
 *  host's. Pure. */
export function buildCarpenterModel() {
  const f = faces(), F = CARPENTER_YARD.fence, G = CARPENTER_YARD.gate, S = CARPENTER_YARD.shop, B = CARPENTER_YARD.bench;
  floor(f, YARD_REC.shavings, F.x0 + 0.05, S.z0 + 0.15, F.x1 - 0.05, F.z1 - 0.05);
  leanTo(f, { x0: F.x0, x1: F.x1, z0: S.z0, z1: S.z1, backH: S.backH, frontH: S.frontH, posts: [F.x0 + 0.1, -2.4, 2.4, F.x1 - 0.1] });
  const fence = { h: F.h, rails: F.rails };
  fenceRun(f, F.x0, S.z1, F.x0, F.z1, fence);
  fenceRun(f, F.x1, S.z1, F.x1, F.z1, fence);
  fenceRun(f, F.x0, F.z1, -G.half, F.z1, { ...fence, ends: false });
  fenceRun(f, G.half, F.z1, F.x1, F.z1, { ...fence, ends: false });
  // the gate arch: its two posts, the beam over the way in, the JOINERY board hung from the beam
  for (const x of [-G.half, G.half]) post(f, x, F.z1, G.postH, 0.24);
  box(f, YARD_REC.wood, -G.half - 0.35, G.beamY, F.z1 - 0.12, G.half + 0.35, G.beamY + 0.22, F.z1 + 0.12, { under: true });
  signboard(f, YARD_REC.signCarpenter, 0, G.beamY - 0.2 - SIGN_BOARD.h / 2, F.z1, G.beamY);
  // THE WORKBENCH: its top, four legs, a shelf under it, the vise at its front left corner; on it a plane, a mallet and
  // two offcuts
  const [bx0, by0, bz0, bx1, by1, bz1] = B;
  box(f, YARD_REC.plank, bx0, by0, bz0, bx1, by1, bz1, { top: YARD_REC.wood, under: true });
  for (const [lx, lz] of [[bx0 + 0.1, bz0 + 0.1], [bx1 - 0.1, bz0 + 0.1], [bx1 - 0.1, bz1 - 0.1], [bx0 + 0.1, bz1 - 0.1]]) box(f, YARD_REC.wood, lx - 0.06, 0, lz - 0.06, lx + 0.06, by0, lz + 0.06);
  box(f, YARD_REC.plank, bx0 + 0.16, 0.22, bz0 + 0.04, bx1 - 0.16, 0.27, bz1 - 0.04, { under: true });
  box(f, YARD_REC.wood, bx0 + 0.08, 0.66, bz1, bx0 + 0.38, by1 + 0.04, bz1 + 0.14, { under: true });   // the vise's jaw
  box(f, YARD_REC.iron, bx0 + 0.2, 0.74, bz1 + 0.14, bx0 + 0.26, 0.8, bz1 + 0.34, { under: true });   // its screw
  box(f, YARD_REC.wood, 0.3, by1, -5.32, 0.64, by1 + 0.08, -5.22);   // the plane
  box(f, YARD_REC.iron, 0.44, by1 + 0.08, -5.3, 0.48, by1 + 0.12, -5.24);   // its iron
  box(f, YARD_REC.wood, -0.86, by1, -5.42, -0.66, by1 + 0.12, -5.28);   // the mallet's head
  box(f, YARD_REC.wood, -0.78, by1 + 0.03, -5.28, -0.74, by1 + 0.07, -4.98);   // its handle
  box(f, YARD_REC.plank, 0.9, by1, -5.1, 1.4, by1 + 0.03, -4.95);   // two offcuts
  box(f, YARD_REC.plank, 1.0, by1 + 0.03, -5.3, 1.35, by1 + 0.06, -5.18);
  // THE TOOL BOARD on the back wall, over the bench: a hand saw, a hammer, a square and three chisels hung on it
  const wz = S.z0 + 0.15, tz = wz + 0.05;
  box(f, YARD_REC.plank, -1.6, 1.35, wz, 1.6, 2.15, tz);
  box(f, YARD_REC.iron, -1.3, 1.62, tz, -0.5, 1.84, tz + 0.02);   // the saw's blade
  box(f, YARD_REC.wood, -1.48, 1.56, tz, -1.28, 1.9, tz + 0.04);   // its handle
  box(f, YARD_REC.wood, -0.2, 1.5, tz, -0.15, 1.92, tz + 0.04);   // the hammer's handle
  box(f, YARD_REC.iron, -0.3, 1.92, tz, -0.05, 2.0, tz + 0.05);   // its head
  box(f, YARD_REC.iron, 0.3, 1.55, tz, 0.8, 1.6, tz + 0.02);   // the square's blade
  box(f, YARD_REC.iron, 0.3, 1.6, tz, 0.35, 1.95, tz + 0.02);   // its stock
  for (const cx of [1.0, 1.17, 1.34]) {   // the chisels: a handle over a blade
    box(f, YARD_REC.wood, cx - 0.03, 1.75, tz, cx + 0.03, 1.95, tz + 0.04);
    box(f, YARD_REC.iron, cx - 0.015, 1.55, tz, cx + 0.015, 1.75, tz + 0.02);
  }
  // THE TIMBER RACK in the left bay: two uprights and three shelves, planks stacked on each
  for (const x of [-6.1, -3.0]) post(f, x, -5.5, 2.2, 0.12);
  for (const [k, y] of [0.6, 1.2, 1.8].entries()) {
    box(f, YARD_REC.plank, -6.14, y - 0.04, wz, -2.96, y, -5.2, { top: YARD_REC.wood, under: true });
    box(f, YARD_REC.wood, -5.9 + k * 0.1, y, wz + 0.05, -3.3, y + 0.06, -5.32, { under: true });
    box(f, YARD_REC.wood, -5.8, y + 0.06, wz + 0.08, -3.5 - k * 0.15, y + 0.12, -5.4, { under: true });
  }
  // the right bay: a chair half made (its back legs up, no back yet), a finished chest, a barrel of dowels
  furniture(f, 4.2, -4.0, 0.44, 0.44, 0.46, { back: 0.46, backZ: -1, rail: false });
  box(f, YARD_REC.plank, 2.9, 0, -5.75, 3.8, 0.55, -5.2, { top: YARD_REC.wood });   // the chest
  box(f, YARD_REC.iron, 3.3, 0.38, -5.2, 3.4, 0.5, -5.18);   // its hasp
  drum(f, YARD_REC.plank, 5.6, -5.25, 10, 0.32, 0.32, 0, 0.8, YARD_REC.wood);   // the barrel
  for (const [dx, dz] of [[-0.1, -0.05], [0.05, 0.08], [0.12, -0.1], [-0.05, 0.12]]) box(f, YARD_REC.wood, 5.6 + dx - 0.02, 0.8, -5.25 + dz - 0.02, 5.6 + dx + 0.02, 1.12, -5.25 + dz + 0.02);   // its dowels
  // THE LOG PILE: three logs on the ground, two in the grooves over them
  const R = 0.28, LZ0 = -1.8, LZ1 = 0.6, up = Math.sqrt((2 * R) ** 2 - (R + 0.02) ** 2);
  for (const x of [-5.6, -5.0, -4.4]) logZ(f, x, R, LZ0, LZ1, R);
  for (const x of [-5.3, -4.7]) logZ(f, x, R + up, LZ0 + 0.15, LZ1 - 0.1, R);
  // TWO SAWHORSES, their beams along x, and a plank laid across them along z
  for (const z of [-0.5, 0.9]) {
    box(f, YARD_REC.wood, -2.9, 0.68, z - 0.05, -1.5, 0.78, z + 0.05, { under: true });
    for (const x of [-2.75, -1.65]) for (const s of [-1, 1]) beam(f, YARD_REC.wood, [x, 0.05 - YARD_SINK, z + s * 0.32], [x, 0.7, z + s * 0.03], 0.035);   // its splayed legs, their tilted corners kept over the sunk depth
  }
  box(f, YARD_REC.plank, -2.36, 0.78, -1.0, -2.04, 0.83, 1.5, { top: YARD_REC.wood, under: true });
  // THE CHOPPING BLOCK, and the axe stuck in it
  drum(f, YARD_REC.bark, 0.9, 0.0, 9, 0.32, 0.3, 0, 0.55, YARD_REC.endgrain);
  box(f, YARD_REC.iron, 0.82, 0.47, -0.02, 1.02, 0.6, 0.02, { under: true });   // its head, bitten into the block
  beam(f, YARD_REC.wood, [0.98, 0.56, 0], [1.32, 1.08, 0], 0.025);   // its handle
  // THE PLANK STACK drying on two bearers, sticks between its layers
  for (const x of [2.9, 5.5]) box(f, YARD_REC.wood, x - 0.08, 0, -1.85, x + 0.08, 0.15, -0.15);
  for (let k = 0; k < 5; k++) {
    const y = 0.15 + k * 0.11;
    for (let j = 0; j < 4; j++) box(f, YARD_REC.plank, 2.6, y, -1.8 + j * 0.4, 5.8, y + 0.06, -1.5 + j * 0.4, { top: YARD_REC.wood, under: true });
    if (k < 4) for (const x of [2.8, 4.2, 5.6]) box(f, YARD_REC.wood, x - 0.025, y + 0.06, -1.82, x + 0.025, y + 0.11, -0.18);
  }
  // THE WORK ON SHOW by the gate: a table with a chair at each end, and a bench
  furniture(f, 4.1, 2.65, 1.4, 0.9, 0.76, { t: 0.05, leg: 0.06 });
  furniture(f, 2.95, 2.65, 0.42, 0.42, 0.45, { back: 0.5, backZ: -1 });
  furniture(f, 5.25, 2.65, 0.42, 0.42, 0.45, { back: 0.5, backZ: 1 });
  furniture(f, -4.5, 3.2, 1.6, 0.34, 0.46, { leg: 0.06 });
  return assemble(f);
}

/** A yard's model by kind. */
export const buildYardModel = (kind) => (kind === 'transport' ? buildTransportModel() : kind === 'carpenter' ? buildCarpenterModel() : buildStableModel());

/** Where a yard's signboard hangs - its box in the yard's frame [x0, y0, z0, x1, y1, z1], grown a little (the eye's
 *  box: a press on the sign reads it). */
export function signBoxOf(kind) {
  const { w, h } = SIGN_BOARD, grow = 0.1;
  if (kind === 'carpenter') {   // CARP-YARD: hung from the gate's beam, as the Stable's
    const G = CARPENTER_YARD.gate, z = CARPENTER_YARD.fence.z1, y = G.beamY - 0.2 - h / 2;
    return [-w / 2 - grow, y - h / 2 - grow, z - 0.15, w / 2 + grow, y + h / 2 + grow, z + 0.15];
  }
  if (kind === 'transport') {
    const P = WAGON_YARD.post, x = (P.x + P.armTo) / 2 + 0.1, y = P.armY - 0.25 - h / 2;
    return [x - w / 2 - grow, y - h / 2 - grow, P.z - 0.15, x + w / 2 + grow, y + h / 2 + grow, P.z + 0.15];
  }
  const G = STABLE_YARD.gate, z = STABLE_YARD.fence.z1, y = G.beamY - 0.2 - h / 2;
  return [-w / 2 - grow, y - h / 2 - grow, z - 0.15, w / 2 + grow, y + h / 2 + grow, z + 0.15];
}
/** CARP-YARD: the joinery's workbench as the eye's box [x0, y0, z0, x1, y1, z1] - its top down to the floor, a little
 *  over it (a press on the bench works it). */
export const benchBoxOf = () => { const B = CARPENTER_YARD.bench; return [B[0] - 0.05, 0, B[2] - 0.05, B[3] + 0.05, B[4] + 0.15, B[5] + 0.4]; };
/** The keeper's place [x, z] and, for the Stable, its horses; for the Wagon Yard, its wagons on show; CARP-YARD: for the
 *  joinery, its workbench's box (`bench`). */
export const yardPoints = (kind) => (kind === 'transport'
  ? { keeper: WAGON_YARD.keeper, horses: [], wagons: WAGON_YARD.wagons, bench: null }
  : kind === 'carpenter' ? { keeper: CARPENTER_YARD.keeper, horses: [], wagons: [], bench: benchBoxOf() }
    : { keeper: STABLE_YARD.keeper, horses: STABLE_YARD.horses, wagons: [], bench: null });

/** SHIPYARDS (2026-10-11): THE YARDS' FACE KIT, ONE DOOR - world/shipyardModel.js and world/lighthouseModel.js build the
 *  port's places with it (the faces, a face's UVs, a hexahedron, a box, a post, a fence run, a floor, a lean-to, a
 *  signboard, a wheel, a drum, and assemble under an archive). One object, so no helper's name is declared twice across
 *  the port's modules (test/systems/talk/audit24_onehome.test.js). */
export const YARD_MESH_KIT = Object.freeze({ faces, uvOf, hexa, box, post, fenceRun, floor, leanTo, signboard, wheel, drum, assemble });
