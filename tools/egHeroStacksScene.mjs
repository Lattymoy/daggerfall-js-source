// THE FALLEN STACKS, THE HERO CHAMBER - the Broken Galleries' second hero fragment, its scene written from numbers.
//
//     node tools/egHeroStacksScene.mjs [--out=src/assets/egfrags/source/egheroStacks.fbx]
//
// EG-HERO (2026-10-13, Mac: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2, 11.4 and
// 11.6). Written from numbers alone (no game data, no third-party art, no trigonometry - tools/egHeroKit.mjs's tables, and
// circles finer than them by halving: a chord's middle pushed out to the circle with Math.sqrt), through the reference's
// writer (tools/egRefFragScene.mjs writeRefFragFbx), and baked by tools/bakeEgHeroStacks.mjs through tools/fragBake.mjs.
// test/tooling/eghero_galleries.test.js writes it again and holds it to the committed bytes.
//
// THE PLACE (section 11.2's row: "an Athenaeum wing fallen on its side ... a broken dome becomes a chamber with two
// balconies"): the Athenaeum's rotunda torn loose into the void - its marble drum lined with gilded stacks, its gilded dome
// broken open onto the burning sky round a ragged rent and its oculus, its reading-room floor (the court's plates and their
// Battlemage-blue inlay) standing alone in the drum over the void, the drum's lower courses torn off below. Two galleries
// survive as BALCONIES east and west (play `balcony`), 3.5 m up against the shelves, each reached by a marble stair that
// fans up from a slot in the floor across the gap; their fronts are parapets (walls - section 25.3: they carry no edge line).
// THE CASCADE is the Stacks' signature: four lanes 4 m deep across the floor, toppling one after another (net/eliteGates/egFragLaw.js
// EG_HAZARDS.cascade - told 1.2 s, 1.5 s apart). The company comes in through the rotunda's portal and crosses the gap on
// two bookcases that fell across it (the kit's ledges - "bookcases become platforms"), and leaves over a bridge to the
// far portal. THE SHELF (net/eliteGates/egFragLaw.js EG_ENGINES.shelf, play `engine`) stands on its plinth at the floor's south-west
// rim; a seam alcove in the east gallery's back wall holds a Vestige shard; the floor of the fallen wing stands on its edge
// beside the portal ("floors become walls").
//
// THE ENVELOPE - the code-built Stacks chamber's (net/eliteGates/egFragLaw.js egFragChamber 'stacks', R the proving court's 14 m - the
// page's own: "one proving court in three is a chamber (the Fallen Stacks' broken dome)", net/eliteGates/egLaw.js `R = 1400`):
//   a fight floor of radius R (14 m) about its middle C = (0, 23.5), the floor at Z 0;
//   its ring wall at R + 9 m (the drum's inner face 22.5 m, its outer 23.5 m); the mouth (6 m by 8 m) on the drum's outer
//   face at Y 0, the exit (6 m by 8 m, its floor at Z 0) on its far face at Y 47;
//   two balconies - the kit's own: east and west (bearings 90 and 270 in the kit's frame), 3.5 m up (its 3-4 m), each a
//   gallery from 15.5 m to 22 m out (its disc's 12-21 m, kept clear of the fight floor's headroom), on its stair (the
//   kit's ramp from R - 7.5 m: here from 6 m out, up 3.5 m);
//   THE SHELF where the kit stands it, by the floor's rim toward the mouth;
//   the box: X -25.5 to 25.5 (the alcove's niche beyond the drum), Y 0 to 47, Z -14 (the floor's root) to 21.4 (the dome).
// THE LAW: three fight floors (the floor, two balconies), two traversal floors (the threshold, the bridge), two ramps, no
// ceiling (the dome is broken: open to the sky), the cascade, two fallen bookcases THE TIMED SOLVER proves, a walk graph that
// climbs the stairs and never crosses the gap, four rifts set round the floor, Casters on both galleries, Lurkers, the
// engine, the alcove, four lights and the collider's proxy.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { RINGS, r4, fbm2, hash01, facing, block, cells, shell } from './egHeroKit.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

/** Where the scene is committed. */
export const HERO_STACKS_FBX = 'src/assets/egfrags/source/egheroStacks.fbx';
const SEED = 0x57ac5;
/** The chamber's middle along Y, the fight floor's radius (the proving court's R), the drum's faces, the length. */
const ZC = 23.5, RF = 14, RI = 22.5, RO = 23.5, LEN = 47;
/** The galleries: their floor's height, their front (the parapet's inner face) and back (the stacks' fronts), their
 *  half-sector (5 steps of 5.625 degrees), the stair's half-sector and its foot. */
const BZ = 3.5, BR0 = 15.5, BR1 = 22.05, BK = 5, SK = 2, SR0 = 6;
/** The doorways: their half-width (the opening's - the floor's is 3 m), their head. */
const DOOR_HW = 3.3, DOOR_H = 8;

const lerp = (a, b, t) => a + (b - a) * t;
/** CIRCLES FINER THAN THE KIT'S: a chord's middle pushed out to the circle (Math.sqrt alone) - 64 and 128 corners. */
const midOf = (a, b) => { const x = a[0] + b[0], y = a[1] + b[1], l = Math.sqrt(x * x + y * y); return [x / l, y / l]; };
const C64 = Object.freeze(Array.from({ length: 64 }, (_, k) => (k % 2 === 0 ? RINGS[32][k / 2] : midOf(RINGS[32][(k - 1) / 2], RINGS[32][((k + 1) / 2) % 32]))));
const C128 = Object.freeze(Array.from({ length: 128 }, (_, k) => (k % 2 === 0 ? C64[k / 2] : midOf(C64[(k - 1) / 2], C64[((k + 1) / 2) % 64]))));
/** A plan point r out at step k of 64 (5.625 degrees each, from +X counter-clockwise), about the middle. */
const at64 = (r, k) => { const c = C64[((k % 64) + 64) % 64]; return [r * c[0], ZC + r * c[1]]; };
/** The drum's column i (64 round, each centred half a step past the floor's corners: col 47 faces the mouth, col 15 the
 *  exit, col 63 the east gallery's middle). */
const colC = (i) => C128[((2 * i + 1) % 128 + 128) % 128];

// ── THE DRUM AND THE DOME: one shell, its profile from the torn foot up the drum and over the dome to the oculus ────────
const DRUM_Z = [-8, -5, -2.5, 0, BZ, 6.1, DOOR_H, 10.5, 12.5];
const R16 = RINGS[16];
/** Inner and outer profile, [r, z] each: the drum's faces, then the dome's (22.5 degrees a row) to the oculus. */
const PROF_IN = Object.freeze([...DRUM_Z.map((z) => [RI, z]), ...[1, 2, 3].map((k) => [RI * R16[k][0], 12.5 + 8.0 * R16[k][1]]), [3.0, 12.5 + 8.0 * Math.sqrt(1 - (3.0 / RI) * (3.0 / RI))]]);
const PROF_OUT = Object.freeze([...DRUM_Z.map((z) => [RO, z]), ...[1, 2, 3].map((k) => [RO * R16[k][0], 12.5 + 9.0 * R16[k][1]]), [3.2, 12.5 + 9.0 * Math.sqrt(1 - (3.2 / RO) * (3.2 / RO))]]);
const NROW = PROF_IN.length - 1, DOME_J = DRUM_Z.length - 1;   // 12 rows; the dome's from row 8
const ARC_IN = (() => { let s = 0; return PROF_IN.map((p, k) => (k ? (s += Math.sqrt((p[0] - PROF_IN[k - 1][0]) * (p[0] - PROF_IN[k - 1][0]) + (p[1] - PROF_IN[k - 1][1]) * (p[1] - PROF_IN[k - 1][1]))) : 0)); })();
const ARC_OUT = (() => { let s = 0; return PROF_OUT.map((p, k) => (k ? (s += Math.sqrt((p[0] - PROF_OUT[k - 1][0]) * (p[0] - PROF_OUT[k - 1][0]) + (p[1] - PROF_OUT[k - 1][1]) * (p[1] - PROF_OUT[k - 1][1]))) : 0)); })();
const drumAt = (P) => (i, j) => { const c = colC(i), [r, z] = P[j]; return [r * c[0], ZC + r * c[1], z]; };
/** Which drum cells are taken out: the two doorways (3 columns, from under the floor to their head), the alcove's (the
 *  east gallery's back, its doorway's 2.6 m), the torn foot (a hash over the lowest two rows) and THE RENT - the dome broken
 *  open from north-east round to north-west, ragged, with the drum's top course gone under its widest part. */
function drumHole(i, j) {
  const door = (c) => i >= c - 1 && i <= c + 1 && j >= 2 && j <= 5;
  if (door(47) || door(15)) return true;
  if (i === 63 && j === 4) return true;
  if (j === 0 && hash01(SEED, i, 0) < 0.45) return true;
  if (j === 1 && hash01(SEED, i, 0) < 0.45 && hash01(SEED, i, 1) < 0.3) return true;
  if (j >= DOME_J - 1) {
    // THE RENTS: the great one about column 6 (east-north-east, over the east gallery - seen from the mouth), a lesser about
    // column 53 (south-east, over the portal - seen from the approach); each column's half-width by row, widest high on the
    // dome, ragged by a hash at its edge
    const rent = (c, ws) => { const d = Math.min(Math.abs(i - c), 64 - Math.abs(i - c)); return d <= ws[j - (DOME_J - 1)] + Math.floor(3 * hash01(SEED + 1 + c, i, j)) - 1; };
    if (rent(6, [1, 5, 8, 10, 13]) || rent(53, [-9, 2, 4, 6, 7])) return true;
  }
  return false;
}
/** The drum's UV: round it (a tile every 2 m of its own face) and up it. */
const CW_IN = 2 * RI * C128[1][1], CW_OUT = 2 * RO * C128[1][1];

/** Step k's direction (of 64, any k). */
const ck = (k) => C64[((k % 64) + 64) % 64];
/** The middle of bay k (between steps k and k+1). */
const bayC = (k) => C128[((2 * k + 1) % 128 + 128) % 128];
/** Is bay k one of a stair's slot (its foot cut out of the floor - east about step 0, west about step 32)? */
const slot = (k) => { const q = ((k % 64) + 64) % 64; return q < SK || q >= 64 - SK || (q >= 32 - SK && q < 32 + SK); };

/** A GILDED STACK on mesh `m`: shelving over bays k0..k1-1 standing against the drum from z0 up `n` shelves of `h` each -
 *  a brass lip and board, a dark recess of books behind (root's works) - its front at BR1, the gallery's back. */
function stacks(m, k0, k1, z0, n, h, mats) {
  const [brass, books] = mats, back = BR1 + 0.38;
  const rowsP = [];
  for (let s = 0; s < n; s++) { const z = z0 + s * h; rowsP.push([BR1, z], [BR1, z + 0.22], [back, z + 0.22], [back, z + h]); }
  rowsP.push([BR1, z0 + n * h], [BR1, z0 + n * h + 0.3]);
  for (let k = k0; k < k1; k++) {
    const c = bayC(k), inward = [-c[0], -c[1], 0];
    for (let q = 0; q + 1 < rowsP.length; q++) {
      const [ra, za] = rowsP[q], [rb, zb] = rowsP[q + 1];
      const A = at64(ra, k), B = at64(ra, k + 1), C = at64(rb, k + 1), D = at64(rb, k);
      const want = ra === rb ? inward : [0, 0, rb > ra ? 1 : -1];
      const isBooks = ra === back && rb === back;
      facing(m, [[A[0], A[1], za], [B[0], B[1], za], [C[0], C[1], zb], [D[0], D[1], zb]], want, isBooks ? books : brass, (p, nn, cc) => [(k - k0 + (cc === 1 || cc === 2 ? 1 : 0)) * 1.1, isBooks ? (p[2] > (za + zb) / 2 ? 0.31 : 0.24) : p[2] / 2]);
    }
  }
  // the uprights: a gilded stile every two bays, flush with the lips, standing proud of the books
  for (let k = k0; k <= k1; k += 2) {
    const d = ck(k), t = [-d[1] * 0.09, d[0] * 0.09], a = at64(BR1, k), b = at64(back, k);
    const pts = [[a[0] - t[0], a[1] - t[1]], [b[0] - t[0], b[1] - t[1]], [b[0] + t[0], b[1] + t[1]], [a[0] + t[0], a[1] + t[1]]];
    const z1 = z0 + n * h + 0.3;
    for (let e = 0; e < 4; e++) { const p = pts[e], q = pts[(e + 1) % 4]; facing(m, [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]], [(p[0] + q[0]) / 2 - (a[0] + b[0]) / 2, (p[1] + q[1]) / 2 - (a[1] + b[1]) / 2, 0], brass); }
  }
  return m;
}
/** A BOOKCASE fallen on its back (a box of brass, its shelves' recesses dark along its long sides): from (x0, y0, z0) to
 *  (x1, y1, z1), `n` shelves across its height on its two faces normal to X. */
function bookcase(m, x0, y0, z0, x1, y1, z1, n, mats) {
  const [brass, books] = mats;
  block(m, x0, y0, z0, x1, y1, z1, brass);
  const h = (z1 - z0) / n;
  for (let s = 0; s < n; s++) {
    const za = z0 + s * h + 0.1, zb = z0 + (s + 1) * h - 0.05;
    for (const [x, dir] of [[x0 - 0.01, -1], [x1 + 0.01, 1]]) facing(m, [[x, y0 + 0.1, za], [x, y1 - 0.1, za], [x, y1 - 0.1, zb], [x, y0 + 0.1, zb]], [dir, 0, 0], books, (p) => [p[1] / 2, p[2] > (za + zb) / 2 ? 0.31 : 0.24]);
  }
  return m;
}
/** A box on mesh `m` in a frame of its own: corners E(u, v, z) for u in [u0, u1], v in [v0, v1], z in [z0, z1] - every
 *  face out. */
function frameBox(m, E, u0, v0, z0, u1, v1, z1, mat) {
  const C = [E(u0, v0, z0), E(u1, v0, z0), E(u1, v1, z0), E(u0, v1, z0), E(u0, v0, z1), E(u1, v0, z1), E(u1, v1, z1), E(u0, v1, z1)];
  const mid3 = E((u0 + u1) / 2, (v0 + v1) / 2, (z0 + z1) / 2);
  for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]) {
    const P = f.map((q) => C[q]), c = [0, 1, 2].map((k) => (P[0][k] + P[2][k]) / 2);
    facing(m, P, [c[0] - mid3[0], c[1] - mid3[1], c[2] - mid3[2]], mat);
  }
  return m;
}

/** THE COURSE: the two bookcases fallen across the gap - `[label, x, y0, y1, top]` (m), 2.6 m wide; the threshold's lip at
 *  Y 1.24 (the drum's inner face at the doorway's jambs), the gaps 1.6, 1.6 and 1.26 m to the floor's front (each inside THE
 *  SPAN BUILD's reach: the first 0.3 m up, the second 0.5 m down, the floor 0.2 m up - net/eliteGates/egSpanLaw.js egJumpReach). */
const SHELVES = Object.freeze([['a', 0.3, 2.84, 4.64, 0.3], ['b', -0.3, 6.24, 8.24, -0.2]]);
const SHELF_W = 2.6, THRESH = 1.24;
/** The cascade's four lanes across the floor: their middles along Y (each 4 m deep, 1.5 m apart). */
const LANES = Object.freeze([ZC - 8.25, ZC - 2.75, ZC + 2.75, ZC + 8.25]);
/** THE SHELF's bearing step (of 64 - south-west, toward the mouth). */
const SHELF_K = 40;
/** The bridge out: where its law begins (inside the floor's rim, so it runs on into it), the far doorway's inner face. */
const BRIDGE_Y = 37.0, DOOR_IN = 45.6;
/** The stair's own frame: the slot's half-angle's tangent, its foot and head along its middle (the chord across the slot
 *  at the floor's slot and at the parapet), its height at xl. */
const STAN = C64[SK][1] / C64[SK][0], SX0 = SR0 * C64[SK][0], SX1 = BR0 * C64[SK][0];
const stairZ = (xl) => (BZ * (xl - SX0)) / (SX1 - SX0);

/**
 * THE STACKS HERO'S SCENE: every object, art and marker, in Blender's scene (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function heroStacksScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  const ashlarUv = (p, n) => (Math.abs(n[2]) > 0.7 ? [p[0] / 2, p[1] / 2] : Math.abs(n[0]) > Math.abs(n[1]) ? [p[1] / 2, p[2] / 2] : [p[0] / 2, p[2] / 2]);
  const UP = [0, 0, 1], DOWN = [0, 0, -1];
  // ══ THE ART ══════════════════════════════════════════════════════════════════════════════════════════════════════
  // ── THE DRUM AND THE DOME: marble ashlar inside and out, the dome gilded outside; the rent's, the doorways' and the torn
  // foot's edges the masonry's own section (root: its lip and courses)
  const rot = add(refFragMesh('Rotunda', ['pillar', 'brass', 'root']));
  const S = shell(rot, {
    cols: 64, rows: NROW, ring: true, inner: drumAt(PROF_IN), outer: drumAt(PROF_OUT), hole: drumHole, flipIn: true,
    matIn: () => 0, matOut: (i, j) => (j >= DOME_J ? 1 : 0), matRim: 2,
    uvIn: (i, j) => [(i * CW_IN) / 2, ARC_IN[j] / 2], uvOut: (i, j) => [(i * CW_OUT) / 2, ARC_OUT[j] / 2],
    uvRim: (p, n) => (Math.abs(n[2]) > 0.7 ? [p[0] / 2, 0.8] : [(p[0] + p[1]) / 2, r4(0.55 + (((p[2] % 2) + 2) % 2) * 0.2)]),
  });
  // the oculus's ring and the torn foot's underside, where their cells stand
  for (let i = 0; i < 64; i++) {
    const i1 = i + 1, d = colC(i);
    if (!drumHole(i, NROW - 1)) facing(rot, [S.inner[NROW][i], S.inner[NROW][i1], S.outer[NROW][i1], S.outer[NROW][i]], [-d[0], -d[1], 0.3], 2, (p) => [(p[0] + p[1]) / 2, 0.85]);
    if (!drumHole(i, 0)) facing(rot, [S.inner[0][i], S.inner[0][i1], S.outer[0][i1], S.outer[0][i]], DOWN, 2, (p) => [(p[0] + p[1]) / 2, 0.3]);
  }
  // ── THE FIGHT FLOOR: the reading room's plates (arena - the band's quietest, so the telegraphs own it), a slot cut for
  // each stair's foot; its rim's torn face and the root hanging under it into the void
  const floor = add(refFragMesh('Reading_Floor', ['arena', 'root']));
  const inner = [];
  for (let k = 0; k < 64; k++) if (!((k > 64 - SK || k < SK) || (k > 32 - SK && k < 32 + SK))) inner.push(at64(SR0, k));
  for (let q = 0; q < inner.length; q++) facing(floor, [[0, ZC, 0], [...inner[q], 0], [...inner[(q + 1) % inner.length], 0]], UP, 0);
  for (let k = 0; k < 64; k++) if (!slot(k)) facing(floor, [[...at64(SR0, k), 0], [...at64(SR0, k + 1), 0], [...at64(RF, k + 1), 0], [...at64(RF, k), 0]], UP, 0);
  const ROOTZ = [-1.1, -6.5, -14], tip = [0.6, ZC - 0.4, ROOTZ[2]];
  for (let k = 0; k < 64; k++) {
    const a = at64(RF, k), b = at64(RF, k + 1), w = (s) => 0.62 * (1 + 0.2 * (fbm2(SEED + 3, s * 0.7, 0) - 0.5)), c = bayC(k);
    const a1 = at64(RF * w(k), k), b1 = at64(RF * w(k + 1), k + 1);
    const u = (cc, one) => (k + (cc === 1 || cc === one ? 1 : 0)) * 0.69;
    facing(floor, [[...a, 0], [...b, 0], [...b, ROOTZ[0]], [...a, ROOTZ[0]]], [c[0], c[1], 0], 1, (p, n, cc) => [u(cc, 2), p[2] > -0.5 ? 1 : 0.78]);
    facing(floor, [[...a, ROOTZ[0]], [...b, ROOTZ[0]], [...b1, ROOTZ[1]], [...a1, ROOTZ[1]]], [c[0], c[1], -0.6], 1, (p, n, cc) => [u(cc, 2), p[2] > -3 ? 0.32 : 0.22]);
    facing(floor, [[...a1, ROOTZ[1]], [...b1, ROOTZ[1]], tip], [c[0], c[1], -0.8], 1, (p, n, cc) => [u(cc, -1), cc === 2 ? 0.02 : 0.22]);
  }
  // ── THE STAIRS: marble flights fanning up from each slot across the gap to the galleries - every nosing on the stair's
  // slope (the ramp the law walks), every tread under it; a gold edge line along each tread's open end
  const stair = add(refFragMesh('Stairs', ['floor', 'pillar', 'root', 'edge']));
  const NS = 14, BOT = -0.7;
  for (const side of [1, -1]) {
    const P = (xl, yl, z) => [side * xl, ZC + yl, z];
    for (let s = 0; s < NS; s++) {
      const a = SX0 + ((SX1 - SX0) * s) / NS, b = SX0 + ((SX1 - SX0) * (s + 1)) / NS, z = stairZ(a), zb = stairZ(b), ha = a * STAN, hb = b * STAN;
      facing(stair, [P(a, -ha, z), P(b, -hb, z), P(b, hb, z), P(a, ha, z)], UP, 0);
      facing(stair, [P(b, -hb, z), P(b, hb, z), P(b, hb, zb), P(b, -hb, zb)], [-side, 0, 0], 1, (p) => [p[1] / 2, p[2] / 2]);
      for (const sy of [-1, 1]) {
        facing(stair, [P(a, sy * ha, BOT), P(b, sy * hb, BOT), P(b, sy * hb, z), P(a, sy * ha, z)], [0, sy, 0], 1, (p) => [p[0] / 2, p[2] / 2]);
        facing(stair, [P(a, sy * ha, z + 0.012), P(b, sy * hb, z + 0.012), P(b, sy * (hb - 0.12), z + 0.012), P(a, sy * (ha - 0.12), z + 0.012)], UP, 3);
      }
      if (b * C64[0][0] > RF * 0.98) facing(stair, [P(a, -ha, BOT), P(b, -hb, BOT), P(b, hb, BOT), P(a, ha, BOT)], DOWN, 2, (p) => [p[0] / 2, 0.3]);
    }
  }
  // ── THE GALLERIES: their floors (marble flags) on slabs from the parapets to the drum, the parapets (walls - they carry no
  // edge line) with gilded copings, the gilded stacks, a bookcase closing each end
  const gal = add(refFragMesh('Galleries', ['floor', 'pillar', 'brass', 'root']));
  for (const kc of [0, 32]) {
    const k0 = kc - BK, k1 = kc + BK;
    for (let k = k0; k < k1; k++) {
      const stairBay = k >= kc - SK && k < kc + SK, inward = [-bayC(k)[0], -bayC(k)[1], 0];
      const fa = stairBay ? stairChord(kc, k) : at64(BR0 - 0.35, k), fb = stairBay ? stairChord(kc, k + 1) : at64(BR0 - 0.35, k + 1), c = at64(RI, k + 1), d = at64(RI, k);
      facing(gal, [[...fa, BZ], [...fb, BZ], [...c, BZ], [...d, BZ]], UP, 0);
      facing(gal, [[...fa, BZ - 0.7], [...fb, BZ - 0.7], [...c, BZ - 0.7], [...d, BZ - 0.7]], DOWN, 3, (p) => [p[0] / 2, 0.3]);
      facing(gal, [[...fa, BZ - 0.7], [...fb, BZ - 0.7], [...fb, BZ], [...fa, BZ]], inward, 1);
      if (!stairBay) {
        const pa = at64(BR0, k), pb = at64(BR0, k + 1);
        facing(gal, [[...fa, BZ], [...fb, BZ], [...fb, BZ + 0.9], [...fa, BZ + 0.9]], inward, 1);
        facing(gal, [[...pa, BZ], [...pb, BZ], [...pb, BZ + 0.9], [...pa, BZ + 0.9]], [-inward[0], -inward[1], 0], 1);
        facing(gal, [[...fa, BZ + 0.9], [...fb, BZ + 0.9], [...pb, BZ + 0.9], [...pa, BZ + 0.9]], UP, 2);
      }
    }
    // the stacks against the drum: five shelves to 12 m - the east gallery's middle two bays left open for the alcove's door
    if (kc === 0) { stacks(gal, k0, kc - 1, BZ, 5, 1.7, [2, 3]); stacks(gal, kc + 1, k1, BZ, 5, 1.7, [2, 3]); }
    else stacks(gal, k0, k1, BZ, 5, 1.7, [2, 3]);
    // a bookcase closing each end of the gallery, standing past its edge
    for (const [ke, o] of [[k0, -1], [k1, 1]]) {
      const d = ck(ke), t = [-d[1] * 0.6 * o, d[0] * 0.6 * o];
      const E = (u, v, z) => [d[0] * u + t[0] * v, ZC + d[1] * u + t[1] * v, z];
      frameBox(gal, E, BR0 - 0.35, 0, BZ - 0.7, RI, 1, BZ + 4.3, 2);
      for (let s = 0; s < 3; s++) for (const [v, sg] of [[-0.01, -1], [1.01, 1]]) {
        facing(gal, [E(BR0 + 0.05, v, BZ + 0.2 + s * 1.35), E(RI - 0.3, v, BZ + 0.2 + s * 1.35), E(RI - 0.3, v, BZ + 1.4 + s * 1.35), E(BR0 + 0.05, v, BZ + 1.4 + s * 1.35)], [sg * t[0], sg * t[1], 0], 3, (p, n, cc) => [cc === 1 || cc === 2 ? 3 : 0, cc >= 2 ? 0.31 : 0.24]);
      }
    }
  }
  // the alcove: its doorway through the drum in the east gallery's middle, its niche built out past the drum
  const niche = add(refFragMesh('Alcove_Niche', ['pillar', 'floor']));
  const h0 = colC(63), h1 = colC(0), nx0 = RO * h0[0] - 0.02, nx1 = 25.5, ny0 = ZC + RO * h0[1], ny1 = ZC + RO * h1[1], nz0 = BZ, nz1 = 6.1;
  facing(niche, [[nx0, ny0, nz0], [nx1, ny0, nz0], [nx1, ny1, nz0], [nx0, ny1, nz0]], UP, 1);
  facing(niche, [[nx1, ny0, nz0], [nx1, ny1, nz0], [nx1, ny1, nz1], [nx1, ny0, nz1]], [-1, 0, 0], 0, ashlarUv);
  facing(niche, [[nx0, ny0, nz0], [nx1, ny0, nz0], [nx1, ny0, nz1], [nx0, ny0, nz1]], [0, 1, 0], 0, ashlarUv);
  facing(niche, [[nx0, ny1, nz0], [nx1, ny1, nz0], [nx1, ny1, nz1], [nx0, ny1, nz1]], [0, -1, 0], 0, ashlarUv);
  facing(niche, [[nx0, ny0, nz1], [nx1, ny0, nz1], [nx1, ny1, nz1], [nx0, ny1, nz1]], DOWN, 0, ashlarUv);
  block(niche, 23.3, ny0 - 0.3, nz0 - 0.4, nx1 + 0.3, ny1 + 0.3, nz1 + 0.4, 0, ashlarUv, ['-x']);
  // ── THE WAY IN AND OUT: the portals' pilasters, gilded capitals and entablatures; the threshold through the mouth and its
  // lip over the gap; the two bookcases fallen across it (the span's own slabs are their tops - this hangs under them); the
  // bridge out over the gap to the far doorway, its sill
  const port = add(refFragMesh('Portals', ['pillar', 'brass', 'floor', 'root', 'cobble']));
  for (const [y0, y1] of [[0, 0.8], [LEN - 0.8, LEN]]) {
    for (const sx of [1, -1]) {
      block(port, sx > 0 ? DOOR_HW : -DOOR_HW - 1.3, y0, 0, sx > 0 ? DOOR_HW + 1.3 : -DOOR_HW, y1, DOOR_H - 0.3, 0, ashlarUv);
      block(port, sx > 0 ? DOOR_HW - 0.1 : -DOOR_HW - 1.4, y0 + 0.1, DOOR_H - 0.3, sx > 0 ? DOOR_HW + 1.4 : -DOOR_HW + 0.1, y1 - 0.1, DOOR_H + 0.2, 1, ashlarUv);
    }
    block(port, -DOOR_HW - 1.6, y0, DOOR_H + 0.2, DOOR_HW + 1.6, y1, DOOR_H + 1.5, 0, ashlarUv);
  }
  cells(port, [-DOOR_HW, -1, 1, DOOR_HW], [0, THRESH], 0, () => true, 2);
  facing(port, [[-DOOR_HW, THRESH, 0], [DOOR_HW, THRESH, 0], [DOOR_HW, THRESH, -2.5], [-DOOR_HW, THRESH, -2.5]], [0, 1, 0], 3, (p) => [p[0] / 2, r4(1 + p[2] * 0.12)]);
  facing(port, [[-DOOR_HW, 0, -2.5], [DOOR_HW, 0, -2.5], [DOOR_HW, THRESH, -2.5], [-DOOR_HW, THRESH, -2.5]], DOWN, 3, (p) => [p[0] / 2, 0.3]);
  facing(port, [[-DOOR_HW, 0, 0], [DOOR_HW, 0, 0], [DOOR_HW, 0, -2.5], [-DOOR_HW, 0, -2.5]], [0, -1, 0], 3, (p) => [p[0] / 2, r4(1 + p[2] * 0.12)]);
  for (const sx of [-1, 1]) facing(port, [[sx * DOOR_HW, 0, 0], [sx * DOOR_HW, THRESH, 0], [sx * DOOR_HW, THRESH, -2.5], [sx * DOOR_HW, 0, -2.5]], [sx, 0, 0], 3, (p) => [p[1] / 2, r4(1 + p[2] * 0.12)]);
  for (const [, x, y0, y1, top] of SHELVES) bookcase(port, x - SHELF_W / 2 + 0.05, y0 + 0.05, top - 1.8, x + SHELF_W / 2 - 0.05, y1 - 0.05, top - 0.55, 3, [1, 3]);
  // the bridge: its near edge on the floor's rim, its walk of tesserae to the far doorway (wider there, the door's own sill)
  const RIM_N = [16, 15, 14, 13].map((k) => at64(RF, k));   // the rim's corners north of the middle, out to the bridge's side
  const rimY = (x) => { const ax = Math.abs(x); let q = 0; while (q < 2 && ax > RIM_N[q + 1][0]) q++; const [a, b] = [RIM_N[q], RIM_N[q + 1]]; return a[1] + ((ax - a[0]) * (b[1] - a[1])) / (b[0] - a[0]); };
  const rimX = [DOOR_HW, RIM_N[2][0], RIM_N[1][0], 0, -RIM_N[1][0], -RIM_N[2][0], -DOOR_HW];
  for (let q = 0; q + 1 < rimX.length; q++) {
    const xa = rimX[q + 1], xb = rimX[q];
    facing(port, [[xa, rimY(xa), 0], [xb, rimY(xb), 0], [xb, 40.2, 0], [xa, 40.2, 0]], UP, 4);
  }
  cells(port, [-DOOR_HW, -1, 1, DOOR_HW], [40.2, 43, DOOR_IN, LEN], 0, () => true, 4);
  for (const sx of [-1, 1]) facing(port, [[sx * DOOR_HW, rimY(DOOR_HW), 0], [sx * DOOR_HW, DOOR_IN, 0], [sx * DOOR_HW, DOOR_IN, -1.1], [sx * DOOR_HW, rimY(DOOR_HW), -1.1]], [sx, 0, 0], 3, (p) => [p[1] / 2, p[2] > -0.5 ? 1 : 0.78]);
  facing(port, [[-DOOR_HW, rimY(DOOR_HW), -1.1], [DOOR_HW, rimY(DOOR_HW), -1.1], [DOOR_HW, DOOR_IN, -1.1], [-DOOR_HW, DOOR_IN, -1.1]], DOWN, 3, (p) => [p[0] / 2, 0.3]);
  facing(port, [[-DOOR_HW, LEN, 0], [DOOR_HW, LEN, 0], [DOOR_HW, LEN, -2.5], [-DOOR_HW, LEN, -2.5]], [0, 1, 0], 3, (p) => [p[0] / 2, r4(1 + p[2] * 0.12)]);
  for (const sx of [-1, 1]) facing(port, [[sx * DOOR_HW, DOOR_IN, 0], [sx * DOOR_HW, LEN, 0], [sx * DOOR_HW, LEN, -2.5], [sx * DOOR_HW, DOOR_IN, -2.5]], [sx, 0, 0], 3, (p) => [p[1] / 2, r4(1 + p[2] * 0.12)]);
  facing(port, [[-DOOR_HW, DOOR_IN, -2.5], [DOOR_HW, DOOR_IN, -2.5], [DOOR_HW, LEN, -2.5], [-DOOR_HW, LEN, -2.5]], DOWN, 3, (p) => [p[0] / 2, 0.3]);
  // ── THE EDGE LINE (section 25.3) on every rim a member could fall from: the floor's (not under the bridge, not the slots'
  // sides the stairs wall), the threshold's lip, the bridge's two sides
  const edge = add(refFragMesh('Edge_Lines', ['edge']));
  for (let k = 0; k < 64; k++) {
    if (slot(k) || (k >= 14 && k <= 17)) continue;
    const a = at64(RF, k), b = at64(RF, k + 1), a1 = at64(RF - 0.12, k), b1 = at64(RF - 0.12, k + 1);
    facing(edge, [[...a, 0.012], [...b, 0.012], [...b1, 0.012], [...a1, 0.012]], UP, 0);
  }
  for (const k of [13, 18]) {
    // the two rim edges the bridge half covers: lined to the bridge's side
    const a = at64(RF, k), b = at64(RF, k + 1), a1 = at64(RF - 0.12, k), b1 = at64(RF - 0.12, k + 1);
    const cut = (p, q) => { const t = (DOOR_HW * Math.sign(p[0]) - p[0]) / (q[0] - p[0]); return [DOOR_HW * Math.sign(p[0]), p[1] + (q[1] - p[1]) * t]; };
    const [p0, p1, q0, q1] = k === 13 ? [a, cut(a, b), a1, cut(a1, b1)] : [cut(b, a), b, cut(b1, a1), b1];
    facing(edge, [[...p0, 0.012], [...p1, 0.012], [...q1, 0.012], [...q0, 0.012]], UP, 0);
  }
  cells(edge, [-DOOR_HW, DOOR_HW], [THRESH - 0.12, THRESH], 0.012);
  for (const sx of [-1, 1]) cells(edge, sx > 0 ? [DOOR_HW - 0.12, DOOR_HW] : [-DOOR_HW, -DOOR_HW + 0.12], [rimY(DOOR_HW), LEN], 0.012);
  // ── THE FALLEN WING, on its edge before the drum's south-west: its floor of flags become a wall toward the approach, its
  // torn back toward the drum
  const wing = add(refFragMesh('Fallen_Wing', ['floor', 'root']));
  const wa = [-11.6, 0.4], wb = [-19.4, 7.2], wl = Math.sqrt((wb[0] - wa[0]) * (wb[0] - wa[0]) + (wb[1] - wa[1]) * (wb[1] - wa[1])), wn = [(wb[1] - wa[1]) / wl, -(wb[0] - wa[0]) / wl];
  const WZ = [[-7, 9.5], [-5.5, 12.4]], W = (p, s, z) => [p[0] + wn[0] * s, p[1] + wn[1] * s, z];
  facing(wing, [W(wa, 0, WZ[0][0]), W(wb, 0, WZ[1][0]), W(wb, 0, WZ[1][1]), W(wa, 0, WZ[0][1])], [-wn[0], -wn[1], 0], 0, (p) => [(p[0] - p[1]) / 2, p[2] / 2]);
  facing(wing, [W(wa, 0.9, WZ[0][0]), W(wb, 0.9, WZ[1][0]), W(wb, 0.9, WZ[1][1]), W(wa, 0.9, WZ[0][1])], [wn[0], wn[1], 0], 1, (p) => [(p[0] - p[1]) / 2, r4(0.24 + (((p[2] % 1) + 1) % 1) * 0.07)]);
  for (const [p, q, want] of [[[wa, WZ[0][1]], [wb, WZ[1][1]], UP], [[wa, WZ[0][0]], [wb, WZ[1][0]], DOWN], [[wa, WZ[0][0]], [wa, WZ[0][1]], [wa[0] - wb[0], wa[1] - wb[1], 0]], [[wb, WZ[1][0]], [wb, WZ[1][1]], [wb[0] - wa[0], wb[1] - wa[1], 0]]]) {
    facing(wing, [W(p[0], 0, p[1]), W(q[0], 0, q[1]), W(q[0], 0.9, q[1]), W(p[0], 0.9, p[1])], want, 1, (pt) => [(pt[0] + pt[1]) / 2, r4(0.9 - (((pt[2] % 1) + 1) % 1) * 0.05)]);
  }
  // ── THE SHELF (the engine): a great bookcase on its plinth past the floor's south-west rim
  const eng = add(refFragMesh('The_Shelf', ['brass', 'root', 'pillar']));
  const ec = at64(RF + 0.9, SHELF_K), en = ck(SHELF_K), et = [-en[1], en[0]];
  const EE = (u, v, z) => [ec[0] + en[0] * u + et[0] * v, ec[1] + en[1] * u + et[1] * v, z];
  frameBox(eng, EE, -0.9, -1.4, -0.9, 0.9, 1.4, 0, 2);
  frameBox(eng, EE, -0.4, -1.2, 0, 0.4, 1.2, 5.6, 0);
  for (let s = 0; s < 4; s++) facing(eng, [EE(-0.41, -1.05, 0.3 + s * 1.35), EE(-0.41, 1.05, 0.3 + s * 1.35), EE(-0.41, 1.05, 1.45 + s * 1.35), EE(-0.41, -1.05, 1.45 + s * 1.35)], [-en[0], -en[1], 0], 1);

  // ══ THE LAW, as named markers ═══════════════════════════════════════════════════════════════════════════════════════
  add(refFragMesh('socket.in')).across(-DOOR_HW, DOOR_HW, 0, 0, DOOR_H);
  add(refFragMesh('socket.out.main')).across(-DOOR_HW, DOOR_HW, LEN, 0, DOOR_H, 0, true);
  // the fight floor: the inner disc's fan and the ring by sector, the stairs' two slots out of it - one outline
  const ff = add(refFragMesh('floor.fight.reading'));
  for (let q = 0; q < inner.length; q++) ff.face([[0, ZC, 0], [...inner[q], 0], [...inner[(q + 1) % inner.length], 0]]);
  for (let k = 0; k < 64; k++) if (!slot(k)) ff.face([[...at64(SR0, k), 0], [...at64(SR0, k + 1), 0], [...at64(RF, k + 1), 0], [...at64(RF, k), 0]]);
  // the galleries: from the parapet (the stair's chord across its slot) back to the stacks - and to the drum in the east
  // gallery's two door bays (each bay's edge split where the stacks' front meets it, so the outline is one loop)
  for (const [kc, name] of [[0, 'east'], [32, 'west']]) {
    const g = add(refFragMesh(`floor.fight.${name}`));
    for (let k = kc - BK; k < kc + BK; k++) {
      const stairBay = k >= kc - SK && k < kc + SK;
      const fa = stairBay ? stairChord(kc, k) : at64(BR0, k), fb = stairBay ? stairChord(kc, k + 1) : at64(BR0, k + 1);
      g.face([[...fa, BZ], [...fb, BZ], [...at64(BR1, k + 1), BZ], [...at64(BR1, k), BZ]]);
      if (name === 'east' && (k === kc - 1 || k === kc)) g.face([[...at64(BR1, k), BZ], [...at64(BR1, k + 1), BZ], [...at64(RI, k + 1), BZ], [...at64(RI, k), BZ]]);
    }
  }
  add(refFragMesh('floor.threshold')).level(-DOOR_HW, 0, DOOR_HW, THRESH, 0);
  add(refFragMesh('floor.bridge')).level(-DOOR_HW, BRIDGE_Y, DOOR_HW, LEN, 0);
  for (const [kc, name] of [[0, 'east'], [32, 'west']]) {
    const a = at64(SR0, kc - SK), b = at64(BR0, kc - SK), c = at64(BR0, kc + SK), d = at64(SR0, kc + SK);
    add(refFragMesh(`ramp.${name}`)).face([[...a, 0], [...b, BZ], [...c, BZ], [...d, 0]]);
  }
  // the open edges: the floor's rim north and south of the slots (never the slots' sides, which the stairs wall), each
  // slot's foot onto its stair and each stair's head onto its gallery, the threshold's mouth and lip, the bridge's sides and
  // the exit (the bridge runs on into the floor at its height on its own)
  add(refFragMesh('open.rimnorth')).box(-14.2, ZC + 2.0, -0.05, 14.2, ZC + 14.2, 0.05);
  add(refFragMesh('open.rimsouth')).box(-14.2, ZC - 14.2, -0.05, 14.2, ZC - 2.0, 0.05);
  for (const [s, name] of [[1, 'east'], [-1, 'west']]) {
    add(refFragMesh(`open.foot${name}`)).box(s > 0 ? 5.75 : -6.05, ZC - 1.3, -0.05, s > 0 ? 6.05 : -5.75, ZC + 1.3, 0.05);
    add(refFragMesh(`open.head${name}`)).box(s > 0 ? 15.1 : -15.6, ZC - 3.1, BZ - 0.05, s > 0 ? 15.6 : -15.1, ZC + 3.1, BZ + 0.05);
  }
  add(refFragMesh('open.mouth')).box(-3.4, 0, -0.05, 3.4, 0.05, 0.05);
  add(refFragMesh('open.lip')).box(-3.4, THRESH - 0.05, -0.05, 3.4, THRESH + 0.05, 0.05);
  add(refFragMesh('open.bridge')).box(-DOOR_HW - 0.1, BRIDGE_Y - 0.05, -0.05, DOOR_HW + 0.1, LEN, 0.05);
  // the walk graph: the floor's middle and a ring of six (never across a slot), up each stair to its gallery; the
  // threshold's own two (never across the gap); out along the bridge
  const N = {
    c: [0, ZC, 0], ...Object.fromEntries([8, 16, 24, 40, 48, 56].map((k) => [`r${k}`, [...at64(9, k), 0]])),
    ef: [6.7, ZC, stairZ(6.7)], em: [10.8, ZC, stairZ(10.8)], eh: [14.9, ZC, stairZ(14.9)], eb: [18.4, ZC, BZ],
    wf: [-6.7, ZC, stairZ(6.7)], wm: [-10.8, ZC, stairZ(10.8)], wh: [-14.9, ZC, stairZ(14.9)], wb: [-18.4, ZC, BZ],
    ta: [-1.6, 0.6, 0], tb: [1.6, 0.6, 0], n: [0, ZC + 12.4, 0], ba: [0, 41.0, 0], bb: [0, 46.2, 0], s: [0, ZC - 12.4, 0],
  };
  for (const [k, p] of Object.entries(N)) add(refFragMesh(`node.${k}`)).disc(p[0], p[1], r4(p[2]), 0.5);
  for (const [a, b] of [['c', 'r8'], ['c', 'r16'], ['c', 'r24'], ['c', 'r40'], ['c', 'r48'], ['c', 'r56'], ['r8', 'r16'], ['r16', 'r24'], ['r40', 'r48'], ['r48', 'r56'],
    ['c', 'ef'], ['ef', 'em'], ['em', 'eh'], ['eh', 'eb'], ['c', 'wf'], ['wf', 'wm'], ['wm', 'wh'], ['wh', 'wb'], ['ta', 'tb'], ['r16', 'n'], ['n', 'ba'], ['ba', 'bb'], ['r48', 's']]) {
    add(refFragMesh(`edge.${a}${b}`)).strip(N[a].map(r4), N[b].map(r4), 0.2);
  }
  const cube = (name, x, y, z, s = 0.3) => add(refFragMesh(name)).box(x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  for (const [k, name] of [[8, 'ne'], [24, 'nw'], [43, 'sw'], [53, 'se']]) cube(`anchor.rift.${name}`, ...at64(11, k), 0);
  cube('anchor.caster.east', 18.6, ZC + 2.2, BZ);
  cube('anchor.caster.west', -18.6, ZC - 2.2, BZ);
  for (const [k, name] of [[17, 'n'], [36, 'w'], [58, 'e']]) cube(`anchor.lurker.${name}`, ...at64(12.8, k), 0);
  cube('anchor.engine.shelf', ...at64(RF - 1.3, SHELF_K), 0);
  cube('anchor.hazard.west', -11.5, LANES[0], 0);
  cube('anchor.hazard.east', 11.5, LANES[3], 0);
  // THE CASCADE: four lanes across the floor, one rectangle each, falling along +Y (the near shelf first)
  const cas = add(refFragMesh('hazard.cascade.shelves.ph600'));
  for (const y of LANES) cas.level(-13, y - 2, 13, y + 2, 0);
  for (const [k, x, y0, y1, top] of SHELVES) add(refFragMesh(`course.ledge.${k}`)).box(x - SHELF_W / 2, y0, top - 0.6, x + SHELF_W / 2, y1, top);
  add(refFragMesh('alcove.seam.shard.east')).box(RI, ZC - 1.0, BZ, 25.5, ZC + 1.0, 6.1);
  cube('light.band.east', 18.4, ZC, 8.6, 0.2);
  cube('light.band.west', -18.4, ZC, 8.6, 0.2);
  cube('light.band.high', 0, ZC, 12.0, 0.2);
  cube('light.band.door', 0, 3.2, 6.5, 0.2);
  // THE COLLIDER'S PROXY: the fight floor as a 32-sided ring, its slots out; the stairs' slopes; the galleries, their
  // parapets' faces; the threshold and the bridge; the drum's inner face as 28 walls (none across either doorway) - never the
  // drawn shelves or the dome
  const px = add(refFragMesh('collider.proxy'));
  const gallery = (k) => { const q = ((k % 64) + 64) % 64; return q >= 64 - BK || q < BK || (q >= 32 - BK && q < 32 + BK); };
  for (let k = 0; k < 64; k += 2) {
    const a = at64(SR0, k), b = at64(SR0, k + 2);
    px.face([[0, ZC, 0], [...a, 0], [...b, 0]]);
    if (!slot(k)) px.face([[...a, 0], [...b, 0], [...at64(RF, k + 2), 0], [...at64(RF, k), 0]]);
    if (k === 14 || k === 16 || k === 46 || k === 48 || (gallery(k) && gallery(k + 1))) continue;
    const w0 = at64(BR1, k), w1 = at64(BR1, k + 2);
    px.face([[...w0, -8], [...w0, 13], [...w1, 13], [...w1, -8]]);
  }
  for (const kc of [0, 32]) {
    // the stair's slope and its two sides down to the floor's slot
    px.face([[...at64(SR0, kc - SK), 0], [...at64(BR0, kc - SK), BZ], [...at64(BR0, kc + SK), BZ], [...at64(SR0, kc + SK), 0]]);
    for (const ks of [kc - SK, kc + SK]) px.face([[...at64(SR0, ks), 0], [...at64(RF, ks), 0], [...at64(RF, ks), stairZ(RF * C64[SK][0])]]);
    // the gallery: its floor, its parapet on its edge, its back (the stacks' fronts - the drum in the alcove's two bays),
    // its two ends
    for (let k = kc - BK; k < kc + BK; k++) {
      const stairBay = k >= kc - SK && k < kc + SK, door = kc === 0 && (k === kc - 1 || k === kc), back = door ? RI : BR1;
      const p0 = stairBay ? stairChord(kc, k) : at64(BR0, k), p1 = stairBay ? stairChord(kc, k + 1) : at64(BR0, k + 1);
      px.face([[...p0, BZ], [...p1, BZ], [...at64(back, k + 1), BZ], [...at64(back, k), BZ]]);
      if (!stairBay) px.face([[...p0, BZ], [...p0, BZ + 0.9], [...p1, BZ + 0.9], [...p1, BZ]]);
      px.face([[...at64(back, k), BZ], [...at64(back, k + 1), BZ], [...at64(back, k + 1), 13], [...at64(back, k), 13]]);
    }
    if (kc === 0) for (const k of [kc - 1, kc + 1]) px.face([[...at64(BR1, k), BZ], [...at64(RI, k), BZ], [...at64(RI, k), 13], [...at64(BR1, k), 13]]);
    for (const k of [kc - BK, kc + BK]) px.face([[...at64(BR0, k), BZ], [...at64(BR1, k), BZ], [...at64(BR1, k), BZ + 4.3], [...at64(BR0, k), BZ + 4.3]]);
  }
  px.level(-DOOR_HW, 0, DOOR_HW, THRESH, 0).level(-DOOR_HW, BRIDGE_Y, DOOR_HW, LEN, 0);
  for (const s of [-1, 1]) px.along(s * DOOR_HW, 0, THRESH, 0, DOOR_H, 0, s > 0);
  return out;
}
/** The stair's head on gallery step kc (0 east, 32 west): the chord across the stair's slot at the parapet's radius, its
 *  point at step k (between kc - SK and kc + SK). */
function stairChord(kc, k) {
  const a = at64(BR0, kc - SK), b = at64(BR0, kc + SK), t = (k - (kc - SK)) / (2 * SK);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/** THE FILE: the scene written as the reference is (tools/egRefFragScene.mjs writeRefFragFbx). */
export const writeHeroStacksFbx = (scene = heroStacksScene()) => writeRefFragFbx(scene);

if (isMain(import.meta.url)) {
  const outPath = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, HERO_STACKS_FBX));
  const bytes = writeHeroStacksFbx();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  console.log(`${outPath}: ${heroStacksScene().length} objects, ${bytes.length} bytes`);
}
