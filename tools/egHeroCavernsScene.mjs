// THE OBLIVION CAVERNS, THE HERO PASSAGE - the Broken Galleries' first hero fragment, its scene written from numbers.
//
//     node tools/egHeroCavernsScene.mjs [--out=src/assets/egfrags/source/egheroCaverns.fbx]
//
// EG-HERO (2026-10-13, Mac: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2 and 11.6).
// The hero fragments the page said Mac authors in Blender are the port's to author, in code: this scene is written from
// numbers alone (no game data, no third-party art, no trigonometry - tools/egHeroKit.mjs's tables and hash noise), as
// tools/egRefFragScene.mjs writes the reference, through the same writer (writeRefFragFbx), and tools/bakeEgHeroCaverns.mjs
// bakes the .fbx it writes through tools/fragBake.mjs like any export of Mac's. Re-run it and the same bytes come out
// (test/tooling/eghero_galleries.test.js holds it to them).
//
// THE PLACE (section 11.2's row): the Deadlands' lava tubes under the torn halls. A floating mass of basalt, its underside
// torn and hanging into the void, bored through by a lava tube - not a box: an elliptical bore 8.5 m across and 7.7 m to its
// crown, its walls pushed OUTWARD by noise (never inward, never the floor) with a lava bench along each wall. Its mouth and
// its exit are the Battlemages' own marble portals set into the rock. Inside: a flagged fight floor under hanging basalt
// columns, a FIRE FALL pouring from a glowing fissure across the vault at the chasm's lip, the chasm itself - the tube's
// floor gone into a magma lake 4.8 m down, the vault over it broken open onto the burning sky and crossed by one surviving
// rib of rock - crossed on the planks of a CHAINED BRIDGE that fell (three ledges slung on chains from the vault and the
// rib; the bridge's anchor posts at both lips trailing its broken chains), then a far fight floor with a MAGMA CHANNEL
// cut along its west wall, fed by a spout under a sluice gate and spilling into the lake, a basalt kerb with THE EDGE LINE
// along its lip. An alcove behind a false wall in the east wall holds a page of the Annals.
//
// THE ENVELOPE - the code-built Caverns passage's (net/eliteGates/egFragLaw.js egFragPassage, the default kit; net/eliteGates/egLaw.js EG_CAVE):
//   the mouth 6 m wide and 5.2 m high (halfW 300, height 520) at the foot of the mouth (0, 0, 0), the floor at Z 0;
//   28 m long (len 2800): one exit, 6 m by 5.2 m, its floor at Z 0 (yB 0), at Y 28;
//   a chasm from Y 8 to Y 21 (the kit's 9-19, its 10 m widened to 13 m for a real crossing) crossed on three ledges, the
//   kit's piece (EG_FRAG_PIECES.caverns);
//   the box: X -7.6 to 7.6 (the rock mass), Y 0 to 28, Z -9.9 (the underside's tip) to 10.5 (the mass's crown) - the
//   frame's box in centimetres is the law half's `box`.
// THE LAW: two fight floors (Y 0-8 and Y 21-28, their corners notched round the bridge's posts), two ceilings at 5.2 m,
// a fire fall (a lane across the passage), falling basalt (two discs r 2.5 on the near floor), a magma surge (a 4 m lane
// along the channel over the far floor), three ledges THE TIMED SOLVER proves, a ten-node walk graph that never crosses the
// chasm, Lurkers, the Low Road's niche, the sluice's engine, the hazards' sources, the alcove, three lights and the collider's
// proxy (the inner envelope: floors, wall planes, the vault's two planes, the posts - never the drawn rock).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { RINGS, r4, unit, fbm2, hash01, flat, facing, block, cells, shell, lathe, sweep, newell } from './egHeroKit.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

/** Where the scene is committed. */
export const HERO_CAVERNS_FBX = 'src/assets/egfrags/source/egheroCaverns.fbx';
/** The scene's own seed (its noise). */
const SEED = 0xca7e5;
/** The passage's length (m), the chasm's lips, the opening onto the sky over it, the ceilings' height. */
const LEN = 28, LIP_N = 8, LIP_F = 21, SKY0 = 11.2, SKY1 = 18.2, CEIL = 5.2;
/** THE BORE: an ellipse through the floor's edges (+-3, 0) on its chord 45 degrees under its centre - half-width TA, centre
 *  TC up, half-height TB: its crown 7.73 m over the floor, never under 6.37 m over the floor's whole width. */
const TA = 3 / 0.707106781, TC = 3.2, TB = 3.2 / 0.707106781;
/** How far the noise pushes the bore's walls out (m, at most), the lava bench's step out over its height. */
const PUSH = 0.85, BENCH = 0.35;
/** The rock round the bore (m): the mass's least thickness over its widest push. */
const SKIN = 2.0;
/** The alcove's doorway in the east wall: its middle along Y, its half-width, its height (world/eliteGates/egHall.js NICHE: 2 m by
 *  2.6 m, its niche 3 m deep from the wall's inner face), the portal's jambs and lintel round it. */
const DOOR = Object.freeze({ y: 4.4, hw: 1.0, h: 2.6, jamb: 0.35, deep: 3.0 });

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** A plane distance, Math.sqrt alone. */
const len2 = (a, b) => Math.sqrt(a * a + b * b);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The bore's half-width at height z (its east wall), and its height over x. */
const boreX = (z) => TA * Math.sqrt(Math.max(0, 1 - ((z - TC) / TB) * ((z - TC) / TB)));
const boreZ = (x) => TC + TB * Math.sqrt(Math.max(0, 1 - (x / TA) * (x / TA)));
/** THE BORE'S PROFILE, east floor edge (i 0) over the crown (i 13) to the west's (i 26): the walls by height (a row at the
 *  bench and one at the doorway's head), the vault by breadth. [x, z] each, and how far along it each lies (m). */
const EAST = [...[0, 0.55, 1.15, 1.7, 2.1, 2.6, 3.2, 3.9, 4.7, 5.5].map((z) => [boreX(z), z]), ...[2.9, 2.0, 1.0].map((x) => [x, boreZ(x)])];
const PROFILE = Object.freeze([...EAST, [0, TC + TB], ...EAST.slice().reverse().map(([x, z]) => [-x, z])].map((p) => Object.freeze([r4(p[0]), r4(p[1])])));
const NP = PROFILE.length - 1;   // 26 cells
const ARC = (() => { let s = 0; return PROFILE.map((p, i) => (i ? (s += len2(p[0] - PROFILE[i - 1][0], p[1] - PROFILE[i - 1][1])) : 0)); })();
/** The bore's outward normal at a profile point (the ellipse's - (x/a^2, (z-c)/b^2)), in the X-Z plane. */
const boreOut = ([x, z]) => { const n = unit([x / (TA * TA), 0, (z - TC) / (TB * TB)]); return [n[0], n[2]]; };
/** THE ROWS along the course (m): every 0.9 m or so, and a row at every edge something meets - the doorway's jambs, the
 *  chasm's lips, the sky's opening, the channel's head, the portals' backs. */
const ROWS = (() => {
  const at = new Set([0, 0.7, 1.0, 7.0, 7.5, LIP_N, LIP_F, SKY0, SKY1, 25.8, 26.4, 27.0, 27.3, LEN, DOOR.y - DOOR.hw - DOOR.jamb, DOOR.y - DOOR.hw, DOOR.y + DOOR.hw, DOOR.y + DOOR.hw + DOOR.jamb]);
  const out = [...at].sort((a, b) => a - b), rows = [];
  for (let k = 0; k + 1 < out.length; k++) { const a = out[k], b = out[k + 1], n = Math.max(1, Math.round((b - a) / 0.9)); for (let q = 0; q < n; q++) rows.push(r4(a + ((b - a) * q) / n)); }
  rows.push(LEN);
  return Object.freeze(rows);
})();
const NR = ROWS.length - 1;

/** ROOT's basalt: the dark band of the record's own rock (world/eliteGates/egBandArt.js rootArt - its works, rows 87-98 between the
 *  gold seam and the void's haze, v 0.235-0.32 as the renderer reads v up), walked out and back so a long face never leaves
 *  it; a leg every 0.55 m. */
const ROCK_V0 = 0.235, ROCK_V1 = 0.32;
const rockV = (s) => { const t = Math.abs(s) / 0.55, k = Math.floor(t), f = t - k; return ROCK_V0 + (ROCK_V1 - ROCK_V0) * (k % 2 === 0 ? f : 1 - f); };
/** A rock face's UV: along it (u, a tile every 2 m) and the basalt band (v). */
const rockUv = (u, s) => [u / 2, rockV(s)];

/** How hard the noise pushes a bore point at (Y, x, z): nothing at the floor's edge, at the portals (the first and last
 *  1.0 m - the marble stands on the bore's own ellipse) or at the doorway's portal (its jambs and lintel meet the ellipse). */
function pushWeight(Y, x, z) {
  const ends = Math.min(clamp01((Y - 1.0) / 1.5), clamp01((LEN - 1.0 - Y) / 1.5));
  let door = 1;
  if (x > 0) { const dY = Math.max(0, Math.abs(Y - DOOR.y) - DOOR.hw - DOOR.jamb), dz = Math.max(0, z - DOOR.h - 0.8); door = Math.min(1, Math.sqrt(dY * dY + dz * dz) / 1.5); }
  return Math.min(ends, door, clamp01(z / 1.0));
}
/** A bore point: profile point i at row j, pushed out. */
function borePoint(i, j) {
  const Y = ROWS[j], [x, z] = PROFILE[i], w = pushWeight(Y, x, z), [nx, nz] = boreOut([x, z]);
  const d = w * (PUSH * (0.15 + 0.85 * fbm2(SEED, Y * 0.42, ARC[i] * 0.5)) + BENCH * clamp01((z - 1.7) / 0.4));
  return [x + nx * d, Y, z + nz * d];
}
/** The mass's outer skin over the bore: the profile point pushed SKIN out and bulged by a slow noise. */
function hullPoint(i, j) {
  const Y = ROWS[j], [x, z] = PROFILE[i], [nx, nz] = boreOut([x, z]);
  const mid = (Y - LEN / 2) / (LEN / 2);
  const d = SKIN + PUSH + BENCH + 1.4 * (1 - mid * mid) + 2.2 * fbm2(SEED + 7, Y * 0.13, ARC[i] * 0.2) + 1.1 * fbm2(SEED + 9, Y * 0.45, ARC[i] * 0.5) * clamp01(z / 2);
  return [x + nx * d, Y, z + nz * d];
}
/** THE UNDERSIDE: the mass's lower skin from the west's waist (the skin's last column) down to its tip and up to the east's
 *  (its first) - UNDER_N points between, each side bowed out from the straight line waist-to-tip, so it never folds back
 *  over the waist however the skin bulges. The tip hangs deepest under the chasm (12.6 m), shallower at the cliffs (9 m). */
const UNDER_N = 9;
function underPoint(k, j) {
  const Y = ROWS[j], mid = (Y - LEN / 2) / (LEN / 2), deep = 9.0 + 3.6 * (1 - mid * mid);
  const tip = [0.7 * (fbm2(SEED + 13, Y * 0.3, 0) - 0.5), Y, -deep + 0.8 * fbm2(SEED + 17, Y * 0.25, 0)];
  const half = (UNDER_N - 1) / 2;
  if (k === half) return tip;
  const west = k < half, waist = hullPoint(west ? NP : 0, j), t = west ? (k + 1) / (half + 1) : (UNDER_N - k) / (half + 1);
  const dx = tip[0] - waist[0], dz = tip[2] - waist[2], l = len2(dx, dz), o = west ? [dz / l, -dx / l] : [-dz / l, dx / l];
  const bow = 4 * t * (1 - t) * (1.1 + 0.9 * fbm2(SEED + 11, Y * 0.2, k * 0.7));
  return [waist[0] + dx * t + o[0] * bow, Y, waist[2] + dz * t + o[1] * bow];
}
/** THE OPENING ONTO THE BURNING SKY: the vault's cells taken out over the chasm - a slot about the crown, widest at its
 *  middle, ragged by a hash, never lower than the walls' 4.7 m row. */
function skyHole(i, j) {
  const Y = (ROWS[j] + ROWS[j + 1]) / 2;
  if (Y < SKY0 || Y > SKY1) return false;
  const u = (Y - (SKY0 + SKY1) / 2) / ((SKY1 - SKY0) / 2), hw = Math.min(5, Math.floor(1.6 + 3.6 * (1 - u * u) + 1.4 * hash01(SEED + 3, j)));
  return i >= 13 - hw && i < 13 + hw;
}
/** THE DOORWAY: the bore's cells the alcove's portal frames (its east wall, the floor to 2.6 m, the doorway's 2 m). */
const doorCut = (i, j) => i < 5 && ROWS[j] >= DOOR.y - DOOR.hw - 1e-9 && ROWS[j + 1] <= DOOR.y + DOOR.hw + 1e-9;
/** THE FIRE FALL'S FISSURE: the cells of the vault glowing over the fall's line (Y 7.0-7.4), the crown down to the bench. */
const FALL_Y0 = 6.6, FALL_Y1 = 7.8;
const fissure = (i, j) => ROWS[j] >= 7.0 - 1e-9 && ROWS[j + 1] <= 7.6 + 1e-9 && i >= 4 + Math.floor(2 * hash01(SEED + 5, 0)) && i < NP - 4 - Math.floor(2 * hash01(SEED + 5, 1)) && hash01(SEED + 5, i, j) > 0.12;

/** A CHAIN on mesh `m` from `a` to `b` (Blender's metres): links `pitch` apart along it, each a flat bar w wide and t thick,
 *  every other turned a quarter about the chain - a ring's look at a fraction of its faces. */
function chain(m, a, b, mat, { pitch = 0.36, w = 0.14, t = 0.05 } = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]), t0 = unit(d);
  const up0 = Math.abs(t0[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const e1 = unit([t0[1] * up0[2] - t0[2] * up0[1], t0[2] * up0[0] - t0[0] * up0[2], t0[0] * up0[1] - t0[1] * up0[0]]);
  const e2 = [t0[1] * e1[2] - t0[2] * e1[1], t0[2] * e1[0] - t0[0] * e1[2], t0[0] * e1[1] - t0[1] * e1[0]];
  const n = Math.max(1, Math.round(L / pitch));
  for (let k = 0; k < n; k++) {
    const c = lerp3(a, b, (k + 0.5) / n), [u, v] = k % 2 === 0 ? [e1, e2] : [e2, e1], h = (L / n) * 0.62;
    const P = (su, sv, st) => [0, 1, 2].map((q) => c[q] + u[q] * su * (w / 2) + v[q] * sv * (t / 2) + t0[q] * st * h);
    const C = [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)];
    for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]) flat(m, f.map((q) => C[q]), mat);
  }
  return m;
}
/** A HANGING BASALT COLUMN: a hexagonal prism from its tip at z0 up into the vault at z1 (root's basalt, hard-edged as
 *  basalt splits). */
function basaltColumn(m, x, y, r, z0, z1, mat) {
  const hex = [0, 2, 4, 6, 8, 10].map((k) => RINGS[12][k]);
  for (let k = 0; k < 6; k++) {
    const [c0, s0] = hex[k], [c1, s1] = hex[(k + 1) % 6];
    const u0 = k * r, u1 = (k + 1) * r;
    flat(m, [[x + r * c0, y + r * s0, z0], [x + r * c1, y + r * s1, z0], [x + r * c1, y + r * s1, z1], [x + r * c0, y + r * s0, z1]], mat, (p, n, c) => rockUv(c === 1 || c === 2 ? u1 : u0, p[2]));
  }
  flat(m, hex.map(([c, s]) => [x + r * c, y + r * s, z0]).reverse(), mat, (p) => [p[0] / 2, rockV(p[1])]);
  return m;
}

/** A BASALT SPUR hanging from the mass: a hexagonal column from its top at z1 (in the rock) tapering to a point at z0. */
function basaltSpur(m, x, y, r, z0, z1, mat) {
  const hex = [0, 2, 4, 6, 8, 10].map((k) => RINGS[12][k]), mid = z0 + (z1 - z0) * 0.35, rm = r * 0.55;
  for (let k = 0; k < 6; k++) {
    const [c0, s0] = hex[k], [c1, s1] = hex[(k + 1) % 6], u0 = k * r, u1 = (k + 1) * r;
    flat(m, [[x + rm * c0, y + rm * s0, mid], [x + rm * c1, y + rm * s1, mid], [x + r * c1, y + r * s1, z1], [x + r * c0, y + r * s0, z1]], mat, (p, n, c) => rockUv(c === 1 || c === 2 ? u1 : u0, p[2]));
    flat(m, [[x, y, z0], [x + rm * c1, y + rm * s1, mid], [x + rm * c0, y + rm * s0, mid]], mat, (p, n, c) => rockUv(c === 1 ? u1 : u0, p[2]));
  }
  return m;
}

/** THE COURSE (the bridge's planks that fell, the kit's ledges): each `[label, x, y0, y1, top]` - its middle across, its
 *  near and far ends along the course, its top (m); 2.6 m wide. The gaps 1.7, 1.8, 1.8 and 1.7 m, the middle plank 0.25 m
 *  under the first and the last 0.3 m over it (each inside THE SPAN BUILD's reach - net/eliteGates/egSpanLaw.js egJumpReach). */
const PLANKS = Object.freeze([['a', 0.5, 9.7, 11.7, -0.2], ['b', -0.5, 13.5, 15.5, -0.45], ['c', 0.4, 17.3, 19.3, -0.15]]);
const PLANK_W = 2.6;
/** The bridge's anchor posts at the lips: [x, y] each (a post r 0.35), and the floors' corners notched round them -
 *  [x0, y0, x1, y1] each, the proxy's box over each. */
const POSTS = Object.freeze([[2.55, 7.55], [-2.55, 7.55], [2.55, 21.45], [-1.45, 21.45]]);
const POST_R = 0.35;
const NOTCHES = Object.freeze([[2.15, 7.15, 3, 8], [-3, 7.15, -2.15, 8], [2.15, 21, 3, 21.85], [-1.8, 21, -1.1, 21.85]]);
/** The rib of rock left across the opening: its path over the slot (m). */
const RIB = Object.freeze([[4.9, 14.6, 4.4], [3.7, 14.4, 6.4], [2.0, 14.7, 7.6], [0, 14.5, 8.0], [-2.1, 14.3, 7.5], [-3.8, 14.6, 6.3], [-4.9, 14.5, 4.3]]);

/**
 * THE CAVERNS HERO'S SCENE: every object, art and marker, in Blender's scene (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function heroCavernsScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  // ══ THE ART, in the Galleries' dress (world/eliteGates/egBandArt.js EG_DRESS by name) ═════════════════════════════════════════
  // ── THE BORE AND THE MASS: one shell, broken open over the chasm (the rims the rock's thickness round the slot)
  const rock = add(refFragMesh('Bore', ['root', 'molten']));
  shell(rock, {
    cols: NP, rows: NR, inner: borePoint, outer: hullPoint, hole: skyHole, cut: doorCut,
    matIn: (i, j) => (fissure(i, j) ? 1 : 0), matOut: () => 0, matRim: 0,
    uvIn: (i, j, p) => rockUv(p[1], ARC[i]), uvOut: (i, j, p) => rockUv(p[1], ARC[i] * 1.4),
    uvRim: (p, n) => (Math.abs(n[2]) > 0.7 ? [p[0] / 2, rockV(p[1])] : [p[1] / 2 + p[0] / 2, rockV(p[2])]),
  });
  // the underside: from the west's waist (the skin's last column) round under to the east's (its first), torn and hanging
  // - root as the record paints an underside, its lip at the waist (v 1, the renderer's v up) to its tip (v 0)
  const under = add(refFragMesh('Underside', ['root']));
  const UC = UNDER_N + 1;
  const underAt = (k, j) => (k === 0 ? hullPoint(NP, j) : k === UC ? hullPoint(0, j) : underPoint(k - 1, j));
  const UARC = (() => { let s = 0; const pts = [0, ...Array.from({ length: UNDER_N }, (_, k) => k + 1), UC].map((k) => underAt(k, Math.floor(NR / 2))); return pts.map((p, k) => (k ? (s += len2(p[0] - pts[k - 1][0], p[2] - pts[k - 1][2])) : 0)); })();
  const UHALF = UARC[UARC.length - 1] / 2;
  for (let j = 0; j < NR; j++) {
    for (let k = 0; k < UC; k++) {
      const q = [[k, j], [k + 1, j], [k + 1, j + 1], [k, j + 1]].reverse();   // wound to face out and down
      const P = q.map(([a, b]) => underAt(a, b).map(r4));
      const n = newell(P);
      under.face(P, 0, q.map(([a, b]) => [n, [r4(ROWS[b] / 2.5), r4(0.32 - (0.3 * Math.min(UARC[a], 2 * UHALF - UARC[a])) / UHALF)]]));
    }
  }
  // ── THE TORN HALL OVER THE TUBE: two slabs of the Galleries' flagged floor fallen across the mass's crown (lying on its
  // curve - their edges overhang it), the stumps of its colonnade standing on them, a drum where it rolled
  const ruin = add(refFragMesh('Torn_Hall', ['floor', 'root', 'pillar', 'brass']));
  const R12 = RINGS[12];
  for (const [y0, y1, x0, x1, cols] of [[1.4, 9.2, -3.0, 3.4, [[-1.5, 3.2, 2.9], [2.0, 7.4, 1.3]]], [19.8, 26.4, -3.4, 2.6, [[-1.9, 24.8, 4.6]]]]) {
    let top = -Infinity;
    for (let j = 0; j <= NR; j++) if (ROWS[j] >= y0 - 0.6 && ROWS[j] <= y1 + 0.6) for (let i = 0; i <= NP; i++) { const p = hullPoint(i, j); if (p[0] >= x0 - 0.6 && p[0] <= x1 + 0.6) top = Math.max(top, p[2]); }
    top = r4(top + 0.15);
    const bot = r4(top - 0.65), xs = [x0, (x0 + x1) / 2, x1], ys = [y0, (y0 + y1) / 2, y1];
    cells(ruin, xs, ys, top, () => true, 0);
    cells(ruin, xs, ys, bot, () => true, 1, { down: true, uvOf: (p) => [p[0] / 2, rockV(p[1])] });
    const lipUv = (p, n) => [(Math.abs(n[0]) > 0.7 ? p[1] : p[0]) / 2, r4(1 - ((top - p[2]) / 0.65) * 0.5)];
    facing(ruin, [[x0, y0, bot], [x1, y0, bot], [x1, y0, top], [x0, y0, top]], [0, -1, 0], 1, lipUv);
    facing(ruin, [[x0, y1, bot], [x1, y1, bot], [x1, y1, top], [x0, y1, top]], [0, 1, 0], 1, lipUv);
    facing(ruin, [[x0, y0, bot], [x0, y1, bot], [x0, y1, top], [x0, y0, top]], [-1, 0, 0], 1, lipUv);
    facing(ruin, [[x1, y0, bot], [x1, y1, bot], [x1, y1, top], [x1, y0, top]], [1, 0, 0], 1, lipUv);
    for (const [cx, cy, h] of cols) {
      lathe(ruin, cx, cy, [[0.72, top], [0.72, top + 0.28], [0.56, top + 0.36], [0.5, top + h]], 12, 2);
      if (h > 3) lathe(ruin, cx, cy, [[0.5, top + h], [0.62, top + h + 0.3], [0.82, top + h + 0.5], [0.82, top + h + 0.72]], 12, 3);
    }
    // a drum fallen beside the first stump, lying across the slab
    const [dx, dy] = cols[0], r = 0.5;
    sweep(ruin, [[dx + 1.0, dy - 1.5, top + r], [dx + 1.0, dy - 0.3, top + r]], R12.map(([c, s]) => [r * c, r * s]), 2);
  }
  // the basalt spurs hanging from it: columns of the rock's own split, embedded in the skin, their tips 2-5 m below
  for (let q = 0; q < 16; q++) {
    const k = 1 + Math.floor(7 * hash01(SEED + 29, q)), j = 2 + Math.floor((NR - 4) * hash01(SEED + 31, q)), p = underPoint(k, j);
    basaltSpur(under, p[0], p[1], 0.45 + 0.45 * hash01(SEED + 37, q), r4(p[2] - 2.5 - 3.5 * hash01(SEED + 41, q)), r4(p[2] + 0.9), 0);
  }
  // ── THE CLIFFS round the mouth and the exit: the bore's ring and the floor's edge out to the skin's ring, in three
  // crags stepped back into the rock (never out past the mouth or the exit)
  const cliff = add(refFragMesh('Cliffs', ['root']));
  for (const [j, dir] of [[0, 1], [NR, -1]]) {
    const Y0 = ROWS[j];
    const inner = [...PROFILE.map((_, i) => borePoint(i, j)), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => [-3 + 0.6 * k, Y0, 0])];
    const outer = [...PROFILE.map((_, i) => hullPoint(i, j)), ...Array.from({ length: UNDER_N }, (_, k) => underPoint(k, j))];
    const N = inner.length, rings = [inner];
    for (const t of [0.34, 0.68]) rings.push(inner.map((p, k) => { const q = lerp3(p, outer[k], t); q[1] = Y0 + dir * (0.12 + 0.6 * fbm2(SEED + 19 + j, k * 0.6, t * 3)); return q; }));
    rings.push(outer);
    for (let r = 0; r + 1 < rings.length; r++) {
      for (let k = 0; k < N; k++) {
        facing(cliff, [rings[r][k], rings[r][(k + 1) % N], rings[r + 1][(k + 1) % N], rings[r + 1][k]], [0, -dir, 0], 0, (p) => [p[0] / 2, rockV(p[2] + p[1])]);
      }
    }
  }
  // ── THE BASIN under the chasm: its walls from the floor's edge down past the lake, the torn lips of both floors, the
  // lake, the channel's spill
  const BZ = [0, -0.55, -1.0, -1.9, -3.0, -4.1, -5.0], BX = [0, 0.15, 0.35, 0.6, 0.7, 0.55, 0.3];
  const brow = ROWS.map((Y, j) => [Y, j]).filter(([Y]) => Y >= LIP_N - 1e-9 && Y <= LIP_F + 1e-9);
  const basinAt = (s, k, Y) => { const w = k === 0 ? 0 : 0.5 * fbm2(SEED + 23 + s, Y * 0.5, k * 0.8); return [s * (3 + BX[k] + w), Y, BZ[k]]; };
  const basin = add(refFragMesh('Basin', ['root', 'molten']));
  for (const s of [1, -1]) {
    for (let b = 0; b + 1 < brow.length; b++) {
      for (let k = 0; k + 1 < BZ.length; k++) {
        const Ya = brow[b][0], Yb = brow[b + 1][0];
        facing(basin, [basinAt(s, k, Ya), basinAt(s, k, Yb), basinAt(s, k + 1, Yb), basinAt(s, k + 1, Ya)], [-s, 0, 0], 0, (p) => rockUv(p[1], -p[2] + (s > 0 ? 0 : 0.6)));
      }
    }
  }
  // the lips: each floor's torn edge down the basin - the record's own lip and courses at the top (the Battlemages'
  // masonry under the flags), its basalt below
  const LIPV = [1.0, 0.86, 0.75, 0.53, 0.3, 0.2, 0.13];
  for (const [Y, face] of [[LIP_N, 1], [LIP_F, -1]]) {
    for (let k = 0; k + 1 < BZ.length; k++) {
      const W0 = basinAt(-1, k, Y), E0 = basinAt(1, k, Y), W1 = basinAt(-1, k + 1, Y), E1 = basinAt(1, k + 1, Y);
      // the far lip's top band is open where the channel ends - its lava spills over the sill at the magma's height
      const q = face < 0 && k === 0 ? [[-1.8, Y, 0], E0, E1, [-1.8, Y, BZ[1]]] : [W0, E0, E1, W1];
      facing(basin, q, [0, face, 0], 0, (p) => [p[0] / 2, r4(LIPV[k] + ((LIPV[k + 1] - LIPV[k]) * (p[2] - BZ[k])) / (BZ[k + 1] - BZ[k]))]);
    }
  }
  // the lake, 4.8 m down; the channel's lava falling into it down the far lip
  cells(basin, [-4, -2, 0, 2, 4], [LIP_N, 10.6, 13.2, 15.8, 18.4, LIP_F], -4.8, () => true, 1, { uvOf: (p) => [p[0] / 4, p[1] / 4] });
  facing(basin, [[-3, LIP_F - 0.02, -4.8], [-1.8, LIP_F - 0.02, -4.8], [-1.8, LIP_F - 0.02, -0.55], [-3, LIP_F - 0.02, -0.55]], [0, -1, 0], 1, (p) => [p[0] / 2, p[2] / 3]);
  // ── THE FLOORS: the near flags (Y 0-8), the far (Y 21-28) round the channel and its kerb
  const FX = [-3, -2.4, -1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8, 2.4, 3];
  const floors = add(refFragMesh('Floors', ['floor', 'root']));
  cells(floors, FX, [0, 1, 2, 3, 4, 5, 6, 7, LIP_N], 0);
  const FARY = [LIP_F, 22, 23, 24, 25, 25.8, 26.4, 27, LEN];
  const kerbOf = (x0, y0) => !(x0 >= -1.2 - 1e-9 || y0 >= 26.4 - 1e-9) && (x0 >= -1.8 - 1e-9 || y0 >= 25.8 - 1e-9);
  cells(floors, FX, FARY, 0, (x0, y0) => x0 >= -1.2 - 1e-9 || y0 >= 26.4 - 1e-9, 0);
  cells(floors, FX, FARY, 0, kerbOf, 1, { uvOf: (p) => [p[0] / 2, rockV(p[1])] });
  // the channel: its walls (the record's lip at their tops), the magma 0.55 m down
  const chan = add(refFragMesh('Channel', ['root', 'molten']));
  facing(chan, [[-1.8, LIP_F, 0], [-1.8, LIP_F, -0.75], [-1.8, 25.8, -0.75], [-1.8, 25.8, 0]], [-1, 0, 0], 0, (p) => [p[1] / 2, r4(1 + p[2] * 0.25)]);
  facing(chan, [[-3, 25.8, 0], [-3, 25.8, -0.75], [-3, LIP_F, -0.75], [-3, LIP_F, 0]], [1, 0, 0], 0, (p) => [p[1] / 2, r4(1 + p[2] * 0.25)]);
  facing(chan, [[-3, 25.8, 0], [-1.8, 25.8, 0], [-1.8, 25.8, -0.75], [-3, 25.8, -0.75]], [0, -1, 0], 0, (p) => [p[0] / 2, r4(1 + p[2] * 0.25)]);
  cells(chan, [-3, -2.4, -1.8], [LIP_F - 0.02, 22.6, 24.2, 25.8], -0.55, () => true, 1, { uvOf: (p) => [p[0] / 2, p[1] / 2] });
  // ── THE EDGE LINE (section 25.3) on every rim a member could fall from: both lips, the kerb's and the channel head's
  const edge = add(refFragMesh('Edge_Lines', ['edge']));
  const E = 0.012, EW = 0.12;
  cells(edge, [-2.15, 2.15], [LIP_N - EW, LIP_N], E);
  cells(edge, [-1.1, 2.15], [LIP_F, LIP_F + EW], E);
  cells(edge, [-1.8, -1.8 + EW], [21.85, 25.8], E);
  cells(edge, [-3, -1.8, -1.8 + EW], [25.8, 25.8 + EW], E);
  // ── THE PORTALS: the Battlemages' marble set into the bore at its mouth and its exit (pillar ashlar, a gold-leaf course),
  // the tympanum over each lintel filling the bore's ellipse; the doorway's portal in the east wall and its niche
  const port = add(refFragMesh('Portals', ['pillar', 'brass', 'floor']));
  const ashlar = (p, n) => (Math.abs(n[0]) > 0.7 ? [p[1] / 2, p[2] / 2] : Math.abs(n[2]) > 0.7 ? [p[0] / 2, p[1] / 2] : [p[0] / 2, p[2] / 2]);
  for (const [y0, y1] of [[0, 0.7], [LEN - 0.7, LEN]]) {
    block(port, 3.0, y0, 0, 4.4, y1, CEIL, 0, ashlar);
    block(port, -4.4, y0, 0, -3.0, y1, CEIL, 0, ashlar);
    block(port, -4.4, y0, CEIL, 4.4, y1, CEIL + 0.9, 0, ashlar);
    // the tympanum: the bore's ellipse over the lintel, a slab of ashlar front and back
    const top = PROFILE.filter(([, z]) => z > CEIL + 0.9 + 1e-9);
    const edgeX = boreX(CEIL + 0.9);
    const ring = [[edgeX, CEIL + 0.9], ...top, [-edgeX, CEIL + 0.9]];
    facing(port, ring.map(([x, z]) => [x, y0, z]), [0, -1, 0], 0, ashlar);
    facing(port, ring.map(([x, z]) => [x, y1, z]), [0, 1, 0], 0, ashlar);
  }
  // the doorway: jambs and lintel from the wall's inner face (X 3) into the rock past the bore; the niche behind
  const dy0 = DOOR.y - DOOR.hw, dy1 = DOOR.y + DOOR.hw, dx1 = 3 + DOOR.deep;
  block(port, 3.0, dy0 - DOOR.jamb, 0, 4.7, dy0, DOOR.h + 0.8, 0, ashlar, ['-z']);
  block(port, 3.0, dy1, 0, 4.7, dy1 + DOOR.jamb, DOOR.h + 0.8, 0, ashlar, ['-z']);
  block(port, 3.0, dy0, DOOR.h, 4.7, dy1, DOOR.h + 0.8, 0, ashlar, ['-y', '+y']);
  facing(port, [[3.0, dy0, 0], [dx1, dy0, 0], [dx1, dy1, 0], [3.0, dy1, 0]], [0, 0, 1], 2);   // the niche's floor
  facing(port, [[dx1, dy0, 0], [dx1, dy0, DOOR.h], [dx1, dy1, DOOR.h], [dx1, dy1, 0]], [-1, 0, 0], 0, ashlar);   // its back, facing in
  facing(port, [[4.7, dy0, 0], [dx1, dy0, 0], [dx1, dy0, DOOR.h], [4.7, dy0, DOOR.h]], [0, 1, 0], 0, ashlar);   // its sides past the jambs
  facing(port, [[4.7, dy1, 0], [4.7, dy1, DOOR.h], [dx1, dy1, DOOR.h], [dx1, dy1, 0]], [0, -1, 0], 0, ashlar);
  facing(port, [[4.7, dy0, DOOR.h], [dx1, dy0, DOOR.h], [dx1, dy1, DOOR.h], [4.7, dy1, DOOR.h]], [0, 0, -1], 0, ashlar);   // its lid
  // ── THE CHAINED BRIDGE THAT FELL: its posts at both lips (gold leaf on a marble foot), each plank slung on two chains
  // from the vault and the rib, the posts trailing the bridge's broken chains into the chasm
  const metal = add(refFragMesh('Bridge_Chains', ['brass', 'pillar']));
  for (const [x, y] of POSTS) {
    lathe(metal, x, y, [[POST_R, -0.6], [POST_R, 0.25], [POST_R * 0.8, 0.32], [POST_R * 0.8, 1.15], [POST_R * 1.05, 1.25], [POST_R * 0.55, 1.42]], 8, 0, { top: true });
  }
  for (const [, x, y0, y1, top] of PLANKS) {
    const ym = (y0 + y1) / 2, anchorZ = (ax) => (ym > SKY0 && ym < SKY1 ? 7.4 : boreZ(ax) + 0.9);
    for (const s of [-1, 1]) {
      const ex = x + s * (PLANK_W / 2 - 0.15), ax = x + s * (PLANK_W / 2 + 0.4);
      chain(metal, [ex, ym, top + 0.02], [ax, ym, anchorZ(ax)], 0);
    }
  }
  for (const [x, y] of POSTS) {
    const dir = y < LEN / 2 ? 1 : -1, sx = x > 0 ? -0.15 : 0.15;
    chain(metal, [x, y + dir * 0.2, 1.25], [x + sx, y + dir * 1.1, 0.1], 0);
    chain(metal, [x + sx, y + dir * 1.1, 0.1], [x + 2 * sx, y + dir * 1.5, -1.7], 0);
  }
  // ── THE RIB of rock across the opening, the middle plank's chains hung from it
  const rib = add(refFragMesh('Rib', ['root']));
  sweep(rib, RIB, [[0.75, -0.45], [0.6, 0.3], [0.05, 0.62], [-0.55, 0.38], [-0.72, -0.3], [-0.1, -0.6]], 0);
  // ── THE HANGING BASALT over the near floor (the falling basalt's own): clusters of hexagonal columns, every tip above
  // the ceiling (5.2 m) and well clear of a jumper
  const basalt = add(refFragMesh('Hanging_Basalt', ['root']));
  for (const [cx, cy] of [[0.8, 2.7], [-0.9, 5.2]]) {
    for (let k = 0; k < 4; k++) {
      const a = RINGS[8][(k * 3 + (cx > 0 ? 0 : 1)) % 8], rr = 0.45 + 0.35 * (k % 2), x = cx + a[0] * rr, y = cy + a[1] * rr;
      basaltColumn(basalt, x, y, 0.22 + 0.06 * (k % 3), Math.max(CEIL + 0.9, boreZ(x) - 1.6 + 0.35 * k), boreZ(x) + PUSH + 0.15, 0);
    }
  }
  // ── THE SPOUT AND THE SLUICE over the channel's head: a glowing tongue down the west wall into the channel, under a
  // gold-leaf sluice gate in its frame
  const spout = add(refFragMesh('Sluice', ['molten', 'brass', 'pillar']));
  facing(spout, [[-3.02, 24.95, -0.55], [-3.02, 25.75, -0.55], [-3.3, 25.65, 1.7], [-3.3, 25.05, 1.7]], [1, 0, 0], 0, (p) => [p[1] / 2, p[2] / 2]);
  block(spout, -3.9, 24.6, 1.7, -3.05, 24.85, 3.4, 2, (p, n) => (Math.abs(n[0]) > 0.7 ? [p[1] / 2, p[2] / 2] : [p[0] / 2, p[2] / 2]));
  block(spout, -3.9, 25.85, 1.7, -3.05, 26.1, 3.4, 2, (p, n) => (Math.abs(n[0]) > 0.7 ? [p[1] / 2, p[2] / 2] : [p[0] / 2, p[2] / 2]));
  block(spout, -3.75, 24.85, 1.95, -3.12, 25.85, 2.85, 1, (p, n) => (Math.abs(n[0]) > 0.7 ? [p[1] / 2, p[2] / 2] : [p[0] / 2, p[2] / 2]));
  block(spout, -3.9, 24.6, 3.4, -3.05, 26.1, 3.7, 2, (p, n) => (Math.abs(n[0]) > 0.7 ? [p[1] / 2, p[2] / 2] : [p[0] / 2, p[2] / 2]));

  // ══ THE LAW, as named markers ═══════════════════════════════════════════════════════════════════════════════════════
  add(refFragMesh('socket.in')).across(-3, 3, 0, 0, CEIL);
  add(refFragMesh('socket.out.main')).across(-3, 3, LEN, 0, CEIL, 0, true);
  // the near fight floor, its lip corners notched round the bridge's posts
  cells(add(refFragMesh('floor.fight.near')), [-3, -2.15, 2.15, 3], [0, 7.15, LIP_N], 0, (x0, y0) => y0 < 7.15 || (x0 > -2.2 && x0 < 2.1));
  // the far fight floor: round the channel and its kerb's head, notched round its two posts
  cells(add(refFragMesh('floor.fight.far')), [-3, -1.8, -1.1, 2.15, 3], [LIP_F, 21.85, 25.8, LEN], 0, (x0, y0) => (y0 >= 25.8 - 1e-9) || (y0 >= 21.85 - 1e-9 ? x0 >= -1.8 - 1e-9 : x0 >= -1.1 - 1e-9 && x0 < 2.1));
  add(refFragMesh('ceil.near')).level(-3, 0, 3, LIP_N, CEIL, 0, true);
  add(refFragMesh('ceil.far')).level(-3, LIP_F, 3, LEN, CEIL, 0, true);
  add(refFragMesh('open.mouth')).box(-3.1, 0, -0.05, 3.1, 0.05, 0.05);
  add(refFragMesh('open.exit')).box(-3.1, LEN - 0.05, -0.05, 3.1, LEN, 0.05);
  add(refFragMesh('open.lipnear')).box(-2.2, LIP_N - 0.05, -0.05, 2.2, LIP_N + 0.05, 0.05);
  add(refFragMesh('open.lipfar')).box(-1.15, LIP_F - 0.05, -0.05, 2.2, LIP_F + 0.05, 0.05);
  add(refFragMesh('open.kerb')).box(-1.85, 21.8, -0.05, -1.75, 25.85, 0.05);
  add(refFragMesh('open.head')).box(-3.05, 25.75, -0.05, -1.75, 25.85, 0.05);
  // the walk graph: five nodes a floor, never across the chasm (the legion walks, it does not jump)
  const N = { nm: [0, 0.9], nc: [0.2, 4.0], nw: [-2.1, 5.8], ne: [2.1, 2.2], nl: [0, 7.2], fl: [0.5, 21.9], fc: [0.9, 24.4], fe: [2.2, 25.4], fx: [0, 27.3], fh: [-2.1, 27.0] };
  for (const [k, [x, y]] of Object.entries(N)) add(refFragMesh(`node.${k}`)).disc(x, y, 0, 0.5);
  for (const [a, b] of [['nm', 'nc'], ['nm', 'ne'], ['nc', 'ne'], ['nc', 'nw'], ['nc', 'nl'], ['nw', 'nl'], ['fl', 'fc'], ['fc', 'fe'], ['fc', 'fx'], ['fe', 'fx'], ['fx', 'fh'], ['fc', 'fh']]) add(refFragMesh(`edge.${a}${b}`)).strip([...N[a], 0], [...N[b], 0], 0.2);
  const cube = (name, x, y, z, s = 0.3) => add(refFragMesh(name)).box(x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  cube('anchor.lurker.near', 2.4, 1.4, 0);
  cube('anchor.lurker.far', 2.3, 27.1, 0);
  cube('anchor.niche.mage', 2.4, 24.2, 0);
  cube('anchor.engine.sluice', -2.0, 26.9, 0);
  cube('anchor.hazard.spout', -2.7, 26.1, 0);
  cube('anchor.hazard.fissure', 0, 7.2, 0);
  // the hazards, each in its kind's shape (net/eliteGates/egFragLaw.js EG_HAZARD_SHAPES): the fall's lane across the passage, the
  // basalt's two discs (one size), the surge's 4 m lane along the channel over the far floor
  add(refFragMesh('hazard.fall.curtain.ph1200')).level(-3, FALL_Y0, 3, FALL_Y1, 0);
  add(refFragMesh('hazard.basalt.columns.ph3100')).disc(0.8, 2.7, 0, 2.5).disc(-0.9, 5.2, 0, 2.5);
  add(refFragMesh('hazard.surge.channel.ph5300')).level(-2.6, 21.4, 1.4, 27.4, 0);
  // the inner course: the bridge's fallen planks, each a box whose top is the plank's
  for (const [k, x, y0, y1, top] of PLANKS) add(refFragMesh(`course.ledge.${k}`)).box(x - PLANK_W / 2, y0, top - 0.6, x + PLANK_W / 2, y1, top);
  add(refFragMesh('alcove.seam.page.east')).box(3.0, dy0, 0, 5.4, dy1, DOOR.h);
  cube('light.band.near', 0, 4.2, 4.1, 0.2);
  cube('light.lava.chasm', 0, 14.5, -2.9, 0.2);
  cube('light.band.far', 0.6, 24.6, 4.1, 0.2);
  // THE COLLIDER'S PROXY: the inner envelope - the floors (whole, the posts standing on them), the posts, the wall planes
  // at X +-3 (down the basin over the chasm), the vault's two planes at the ceilings, the channel's inner wall; never the
  // drawn rock, which stands outside every one of them
  const proxy = add(refFragMesh('collider.proxy'));
  proxy.level(-3, 0, 3, LIP_N, 0).level(-1.8, LIP_F, 3, 25.8, 0).level(-3, 25.8, 3, LEN, 0)
    .along(-3, 0, LIP_N, 0, CEIL, 0, true).along(3, 0, LIP_N, 0, CEIL)
    .along(-3, LIP_N, LIP_F, -5, CEIL, 0, true).along(3, LIP_N, LIP_F, -5, CEIL)
    .along(-3, LIP_F, LEN, 0, CEIL, 0, true).along(3, LIP_F, LEN, 0, CEIL)
    .level(-3, 0, 3, LIP_N, CEIL, 0, true).level(-3, LIP_F, 3, LEN, CEIL, 0, true)
    .along(-1.8, LIP_F, 25.8, -0.75, 0, 0, true)
    .across(-3, 3, LIP_N, -5, 0, 0, true).across(-3, 3, LIP_F, -5, 0);
  for (const [x0, y0, x1, y1] of NOTCHES) proxy.box(x0, y0, 0, x1, y1, 1.42);
  return out;
}

/** THE FILE: the scene written as the reference is (tools/egRefFragScene.mjs writeRefFragFbx - Blender's exporter's
 *  layout, the port's writer named). */
export const writeHeroCavernsFbx = (scene = heroCavernsScene()) => writeRefFragFbx(scene);

if (isMain(import.meta.url)) {
  const out = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, HERO_CAVERNS_FBX));
  const bytes = writeHeroCavernsFbx();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  console.log(`${out}: ${heroCavernsScene().length} objects, ${bytes.length} bytes`);
}
