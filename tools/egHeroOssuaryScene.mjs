// THE OSSUARY - the Soul Cairn's hero passage, written from numbers: the vaults of the dead.
//
//     node tools/egHeroOssuaryScene.mjs [--out=src/assets/egfrags/source/egheroOssuary.fbx]
//
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2,
// 11.6 and the EG-HERO (the Soul Cairn) record). Section 11.2's row is the brief: "the vaults of the dead: ribcage bridges,
// skull pillars, soul-gem niches where Binders stand", its signature "bone bridges that crumble (the Crumble's law);
// soul-wisps drifting a fixed path, which tether a member on a fight floor". The scene is written as the reference is
// (tools/egRefFragScene.mjs refFragMesh and writeRefFragFbx - Blender's export, the port's writer by name) with the hero
// kit's shapes (tools/egHeroKit.mjs RINGS, fbm2, grid, lathe, sweep): no game data, no third-party art, no trigonometry -
// every number IEEE arithmetic, so the test writes the same bytes again. tools/bakeEgHeroOssuary.mjs bakes it.
//
// THE ENVELOPE (net/eliteGates/egFragLaw.js egFragPassage('ossuary') - where a hall lays the code-built one, it can lay this):
//   a passage 28 m along Blender's +Y, its floor 6 m across (x -3..3) at Z 0, 5.6 m of headroom (the kit's `height` 560:
//   the ceiling clamp's plane); the mouth (socket.in) 6 m by 5.6 m at Y 0, the one exit (socket.out.main) the same at
//   Y 28, at the mouth's height (the kit's yB 0); a near fight floor Y 0..9 (zA 900) and a far one Y 19..28 (zB 1900),
//   the chasm between them crossed on three bone bridges (EG_FRAG_PIECES.ossuary, EG_STEP.bone's 2.6 m across, 2.4 m
//   deep - the Crumble's 0.7 s holds a 2.4 m crossing at the span build's 5.47 m/s with its 0.15 s of slack, 0.59 s),
//   70 cm apart; a soul-wisp over each fight floor (the kit's two: 9 s and 11 s). Nothing stands behind the mouth or
//   past the exit; the drawn rock pushes outward from that envelope, never in, never on the floor.
//
// THE PLACE: a nave of slate under a segmental barrel vault (springing at 5.9 m, its crown 7.94 m) ribbed in bone over
// each pair of SKULL PILLARS - octagonal piers girt with two bulging courses of skulls - with burial bays between them,
// their plinths and shelves set with skulls; four bays hold the SOUL-GEMS where Binders stand (`anchor.caster`), one the
// SOUL-BELL (the kit's engine, `anchor.engine`), one a sealed loculus (the alcove: a page of the Annals), one the
// Battlemage's niche. Over the chasm the RIBCAGE of something vast arches out of its walls across the bridges to a bone
// sternum under the vault - the ribcage bridge the bones are the spine of - and soul-light pools 9 m down. The whole a
// block of slate hung in the void: a bone portal at each end in a recessed facade, its root hanging below.
//
// Every walkable rim wears THE EDGE LINE (section 25.3): the mouth's, both chasm lips', the exit's.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { RINGS, r4, fbm2, hash01, grid, lathe, sweep, onSide, boxOn, faceTo, octahedron, cuts, walkStrip } from './egHeroKit.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

/** Where the scene is committed. */
export const OSSUARY_FBX = 'src/assets/egfrags/source/egheroOssuary.fbx';

/**
 * THE ENVELOPE AND THE PLACE'S NUMBERS (metres, Blender's frame: X across, Y along the course, Z up; the foot of the mouth
 * at the origin). `W` the floor's half width, `LEN` its length, `ZA`/`ZB` the chasm's lips, `CEIL` the ceiling clamp's
 * plane (the kit's height), `SPRING` where the vault springs, `WALL` the drawn walls' plane, `PX` the pillars' line,
 * `BACK` the bays' back walls, `PLINTH` the bays' sill, `SOFFIT` their head, `DEEP` the chasm's soul-light, `PILLARS` each
 * floor's piers along Y, `BONES` the bridges' near and far edges, their width and depth.
 */
export const OSSUARY = Object.freeze({
  W: 3, LEN: 28, ZA: 9, ZB: 19, CEIL: 5.6, SPRING: 5.9, WALL: 3.05, PX: 3.6, BACK: 4.35, PLINTH: 0.9, SOFFIT: 3.95, DEEP: -9,
  PILLARS: Object.freeze([Object.freeze([0.6, 4.5, 8.4]), Object.freeze([19.6, 23.5, 27.4])]),
  BONES: Object.freeze([Object.freeze([9.7, 12.1]), Object.freeze([12.8, 15.2]), Object.freeze([15.9, 18.3])]), BONE_W: 2.6,
  HOLE: Object.freeze([10, 18]),
});
const { W, LEN, ZA, ZB, CEIL, SPRING, WALL, PX, BACK, PLINTH, SOFFIT, DEEP } = OSSUARY;
const [HOLE0, HOLE1] = OSSUARY.HOLE;

// ── the vault's arch: a segmental barrel through both springs, RINGS[32]'s corners from 157.5 to 22.5 degrees (thirteen,
// 11.25 apart), so it springs at WALL and SPRING exactly
const R32 = RINGS[32];
/** The arch's unit corners [c, s] (x = R c, z = ZC + R s), west to east. */
const ARCH = Object.freeze(Array.from({ length: 13 }, (_, k) => R32[14 - k]));
const AR = WALL / R32[2][0];                // its radius (3.3013)
const ZC = SPRING - AR * R32[2][1];          // its centre's height (4.6366)
/** The arch's crown (7.938). */
export const OSSUARY_CROWN = r4(ZC + AR);

// ── the dress records by name (world/eliteGates/egBandArt.js EG_DRESS) - the slot each mesh lists them in
const SLATE = ['root'], ASHLAR = ['pillar'], BONE = ['brass'], SOUL = ['molten'], GOLD = ['edge'];

// ── noise, always outward
const SEED = 0x0551;
/** How far the walls stand out from their plane at (Y, Z): fbm, nought on the plinth's course (Z 0..0.9) and at the
 *  vault's spring (the arch meets them exactly), nought at the mouth and the exit (the portals meet them exactly), and the
 *  chasm widening as it falls. */
function wallOut(y, z) {
  const g = z <= -0.8 ? 1 : z < 0 ? -z / 0.8 : z <= PLINTH ? 0 : z < PLINTH + 0.6 ? (z - PLINTH) / 0.6 : z <= SPRING - 0.6 ? 1 : z < SPRING ? (SPRING - z) / 0.6 : 0;
  const ends = Math.max(0, Math.min(1, y / 1.2, (LEN - y) / 1.2));
  return 0.38 * fbm2(SEED, y * 0.55, z * 0.7) * g * ends + (z < 0 ? -0.12 * z : 0);
}
/** The walls' x at (Y, Z), east (west is its mirror). */
const wallX = (y, z) => WALL + wallOut(y, z);
/** How far the vault stands out (along its radius) at arch corner i and Y: nought at its springs, at the portals and at
 *  its broken edge over the chasm. */
const vaultOut = (i, y) => (i === 0 || i === 12 ? 0 : 0.22 * fbm2(SEED + 7, y * 0.5, i * 0.9) * Math.max(0, Math.min(1, y / 1.5, (LEN - y) / 1.5, (Math.abs(y - HOLE0) - 0.9) / 0.6, (Math.abs(y - HOLE1) - 0.9) / 0.6)));
/** THE VAULT BROKEN over the chasm: how far its edge stands back from the hole at arch corner k (0..12) at the hole's near
 *  (e 0) or far (e 1) end - nought at its springs - and the roof's over the slot (its corners 4..8). */
const brkVault = (k, e) => (k === 0 || k === 12 ? 0 : 0.85 * hash01(SEED + 41, k, e));
const brkRoof = (k, e) => (k < 4 || k > 8 ? 0 : 0.6 * hash01(SEED + 43, k, e));

// ── the rows the walls are cut at (shared by every surface that meets another, so their edges meet vertex to vertex)
const LOW = cuts([PLINTH, SOFFIT], 0.8);               // a bay's height
const UP = cuts([SOFFIT, SPRING], 0.7);                // over the bays to the spring
const DOWN = cuts([DEEP - 0.3, -0.8, 0], 1.4);         // the chasm's walls under the floor's level

/**
 * THE SIDE WALLS OF ONE FLOOR (Y y0..y1, piers at `P`), east (`s` 1) or west (-1): the plinth's course (0..PLINTH) and its
 * sill, the bays between the first and last pier (their back walls BACK out, their ends and heads), the wall either side
 * of them, and the wall over them to the spring - every surface out from WALL, never in.
 */
function floorWalls(m, s, y0, y1, P) {
  const M = onSide(m, s), pa = P[0], pb = P[P.length - 1], s0 = y0 > 0 ? y0 : FAC, s1 = y1 < LEN ? y1 : LEN - FAC;
  // the plinth's face, the whole floor's length, and its sill to the facades
  M.face([[WALL, y1, 0], [WALL, y0, 0], [WALL, y0, PLINTH], [WALL, y1, PLINTH]], 0);
  M.face([[WALL, s0, PLINTH], [BACK + 0.45, s0, PLINTH], [BACK + 0.45, s1, PLINTH], [WALL, s1, PLINTH]], 0);
  // the wall either side of the bays, to the bays' head
  const flank = (ya, yb) => { const ys = cuts([ya, yb], 0.5); grid(M, ys.length - 1, LOW.length - 1, (i, j) => [wallX(ys[i], LOW[j]), ys[i], LOW[j]], 0, { flip: true }); };
  if (pa > y0) flank(y0, pa);
  if (y1 > pb) flank(pb, y1);
  // the bays' back walls: one rough face from the first pier to the last (the piers stand before its joins)
  const ys = cuts([pa, pb], 0.5);
  grid(M, ys.length - 1, LOW.length - 1, (i, j) => [BACK + 0.4 * fbm2(SEED + 3, ys[i] * 0.8, LOW[j] * 0.8), ys[i], LOW[j]], 0, { flip: true });
  // the bays' ends (behind the first and the last pier) and their head
  M.face([[BACK + 0.45, pa, PLINTH], [WALL, pa, PLINTH], [WALL, pa, SOFFIT], [BACK + 0.45, pa, SOFFIT]], 0);
  M.face([[WALL, pb, PLINTH], [BACK + 0.45, pb, PLINTH], [BACK + 0.45, pb, SOFFIT], [WALL, pb, SOFFIT]], 0);
  M.face([[WALL, pa, SOFFIT], [BACK + 0.45, pa, SOFFIT], [BACK + 0.45, pb, SOFFIT], [WALL, pb, SOFFIT]].reverse(), 0);
  // the wall over the bays to the vault's spring
  const ya = cuts([y0, y1], 0.5);
  grid(M, ya.length - 1, UP.length - 1, (i, j) => [wallX(ya[i], UP[j]), ya[i], UP[j]], 0, { flip: true });
}

/** A SKULL PILLAR at (x, y): an octagonal pier on the sill, girt with two bulging courses of skulls, its capital under the
 *  vault's rib. */
function skullPillar(m, x, y) {
  return lathe(m, x, y, [[0.56, PLINTH], [0.56, PLINTH + 0.3], [0.46, PLINTH + 0.42], [0.46, 1.85], [0.56, 2.15], [0.46, 2.45], [0.56, 2.75], [0.46, 3.05],
    [0.46, 4.55], [0.56, 4.75], [0.56, 5.15], [0.46, 5.3], [0.46, SPRING]], 8);
}
/** A SKULL at (x, y) on a ledge at z: a lump of bone, its crown narrower than its jaw. */
const skull = (m, x, y, z, k) => lathe(m, x, y, [[0.13, z], [0.09, z + 0.19]].map(([r, h]) => [r * (0.9 + 0.2 * k), h]), 8);
/** A row of skulls along Y from ya to yb at x on a ledge at z. */
function skullRow(m, x, ya, yb, z, seed) {
  const n = Math.max(1, Math.floor((yb - ya) / 0.5));
  for (let k = 0; k < n; k++) { const h = hash01(seed, k); skull(m, r4(x + 0.06 * (h - 0.5)), r4(ya + ((k + 0.5) * (yb - ya)) / n), z, h); }
}

/** THE SOUL-BELL (section 11.10, the Ossuary's engine) hung at (x, y) from a bone yoke under a bay's head. */
function soulBell(bone, x, y) {
  const top = SOFFIT - 0.25, h = 1.3;
  lathe(bone, x, y, [[0.55, top - h], [0.53, top - h + 0.1], [0.43, top - h + 0.32], [0.37, top - h + 0.7], [0.35, top - h + 1.0], [0.27, top - h + 1.2], [0.12, top]], 16, 0, { foot: true });
  boxOn(bone, x - 0.07, y - 0.5, top, x + 0.07, y + 0.5, SOFFIT, 0);
}

// ── THE BLOCK (the passage's outside): its cross-section's loops, each fifteen corners counter-clockwise seen from the
// mouth (x right, z up) - the portal's opening, the portal's band, the block's outline - and its root's profile
/** The facades stand FAC in from the mouth and the exit, the portals' band FRAME wide proud of them, its foot FD under the
 *  floor; the block's sides SX out, its foot SBOT, its roof's eaves SROOF and its hump SHUMP over them. */
const FAC = 0.5, FRAME = 0.7, FD = 0.7, SX = 5.4, SBOT = -1.6, SROOF = 8.4, SHUMP = 0.9;
const FX = r4((AR + FRAME) * R32[2][0]);
const OPEN = [[WALL, -FD], ...ARCH.map((_, i) => ARCH[12 - i]).map(([c, sn]) => [AR * c, ZC + AR * sn]), [-WALL, -FD]];
const BAND = [[FX, -FD], ...ARCH.map((_, i) => ARCH[12 - i]).map(([c, sn]) => [(AR + FRAME) * c, ZC + (AR + FRAME) * sn]), [-FX, -FD]];
/** The roof's corner over the arch's corner k (x at the block's side for its springs, 0 over its crown). */
const roofAt = (k) => { const x = (SX * ARCH[k][0]) / R32[2][0]; return [x, SROOF + SHUMP * (1 - (x / SX) * (x / SX))]; };
const OUTLINE = [[SX, SBOT], ...ARCH.map((_, i) => roofAt(12 - i)), [-SX, SBOT]];
/** The root's profile, west to east through its keel. */
const ROOT_PROFILE = [[-SX, SBOT], [-5.35, -5], [-5.2, -9], [-4.7, -11.4], [-3.5, -13.2], [-1.8, -14.2], [0, -14.6], [1.8, -14.2], [3.5, -13.2], [4.7, -11.4], [5.2, -9], [5.35, -5], [SX, SBOT]];
/** The roof's hump over x. */
const hump = (x) => SROOF + SHUMP * (1 - (x / SX) * (x / SX));
/** THE BROKEN EDGE over the chasm: how far the roof's edge falls at its corner k (0..12, west to east) at the hole's near
 *  (e 0) or far (e 1) edge - only over the slot (k 4..8), the roof beyond it whole - and how far the slot's wall top falls
 *  at Y on side s (nought at the hole's ends). */
const jagEnd = (k, e) => (k < 4 || k > 8 ? 0 : -0.75 * hash01(SEED + 31, k, e));
const jagSide = (y, s) => -0.9 * fbm2(SEED + 33 + s, y * 0.9, 0.5) * Math.min(1, (y - HOLE0) * 2, (HOLE1 - y) * 2);
/** THE BLOCK: its sides and roof (`rock`'s ashlar), its root (`rock`'s slate), its facades (`face`), its portals and its
 *  buttresses (`bone`'s bone, `face`'s ashlar); the roof broken open over the chasm, its edge fallen. */
function blockOf(rock, face, bone) {
  const ys = cuts([FAC, LEN - FAC], 3.4), ends = (y) => Math.max(0, Math.min(1, (y - FAC) / 2, (LEN - FAC - y) / 2));
  // the sides, out from SX
  const zs = cuts([SBOT, SROOF], 1.7);
  for (const s of [-1, 1]) grid(onSide(rock, s), ys.length - 1, zs.length - 1, (i, j) => [SX + (j === 0 || j === zs.length - 1 ? 0 : 0.55 * fbm2(SEED + 21, ys[i] * 0.4, zs[j] * 0.5) * ends(ys[i])), ys[i], zs[j]], 0);
  // the roof, humped and rough, either side of the hole; its broken edges and the vault's end there
  for (const [a, b, e] of [[FAC, HOLE0, 0], [HOLE1, LEN - FAC, 1]]) {
    const ry = cuts([a, b], 2.4), fade = (y) => Math.max(0, Math.min(1, (y - a) / 1.5, (b - y) / 1.5));
    const sgn = e === 0 ? -1 : 1, hole = e === 0 ? HOLE0 : HOLE1;
    grid(rock, 12, ry.length - 1, (i, j) => {
      const [x, z] = roofAt(i), edge = e === 0 ? j === ry.length - 1 : j === 0;
      return [x, edge ? hole + sgn * brkRoof(i, e) : ry[j], z + (edge ? jagEnd(i, e) : i === 0 || i === 12 ? 0 : 0.5 * fbm2(SEED + 23, x * 0.5, ry[j] * 0.4) * fade(ry[j]))];
    }, 0);
    const bot = (k) => [AR * ARCH[k][0], hole + sgn * brkVault(k, e), ZC + AR * ARCH[k][1]], top = (k) => { const [x, z] = roofAt(k); return [x, hole + sgn * brkRoof(k, e), z + jagEnd(k, e)]; };
    for (let k = 0; k < 12; k++) {
      faceTo(rock, [bot(k), bot(k + 1), top(k + 1)], [0, -sgn, 0], 0);
      faceTo(rock, [bot(k), top(k + 1), top(k)], [0, -sgn, 0], 0);
    }
  }
  // over the hole: the roof's two strips beyond the slot, the slot's walls up from the spring to its fallen top
  const hy = cuts([HOLE0, HOLE1], 1.0);
  for (const s of [-1, 1]) {
    const M = onSide(rock, s), xs = [WALL, ...[9, 10, 11, 12].map((k) => roofAt(k)[0])];
    grid(M, xs.length - 1, hy.length - 1, (i, j) => {
      const ends2 = j === 0 || j === hy.length - 1, k = s > 0 ? 8 + i : 4 - i;
      return [xs[i], hy[j], hump(xs[i]) + (i === 0 ? jagSide(hy[j], s) : ends2 ? jagEnd(k, j === 0 ? 0 : 1) : 0)];
    }, 0);
    const top = (y) => hump(WALL) + jagSide(y, s), rows = [0, 0.25, 0.5, 0.75, 1];
    grid(M, hy.length - 1, rows.length - 1, (i, j) => [WALL, hy[i], SPRING + rows[j] * (top(hy[i]) - SPRING)], 0, { flip: true });
  }
  // the buttresses, one behind each pier
  for (const P of OSSUARY.PILLARS) for (const y of P) for (const s of [-1, 1]) {
    const F = onSide(face, s);
    boxOn(F, SX - 0.1, y - 0.5, SBOT, SX + 0.95, y + 0.5, 3.2, 0);
    boxOn(F, SX - 0.1, y - 0.38, 3.2, SX + 0.55, y + 0.38, 7.7, 0);
  }
  // the root, its picture from its lip (v 0) to its tip (v 1)
  const run = [0];
  for (let i = 1; i < ROOT_PROFILE.length; i++) { const a = ROOT_PROFILE[i - 1], b = ROOT_PROFILE[i]; run.push(run[i - 1] + Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]))); }
  const half = run[6];
  grid(rock, 12, ys.length - 1, (i, j) => {
    const [x, z] = ROOT_PROFILE[i], d = Math.sqrt(x * x + (z - SBOT + 3) * (z - SBOT + 3)), p = i === 0 || i === 12 ? 0 : 0.8 * fbm2(SEED + 25, x * 0.4 + ys[j] * 0.3, z * 0.3) * ends(ys[j]);
    return [x + (p * x) / d, ys[j], z + (p * (z - SBOT + 3)) / d];
  }, 1, { flip: true, uv: (i, j) => [r4(ys[j] / 7.25), r4(1 - Math.abs(run[i] - half) / half)] });
  // each end: the facade (the band's loop to the block's), the root's cap, the portal's band, its outer side, the step
  for (const [y, yb, want] of [[0, FAC, -1], [LEN, LEN - FAC, 1]]) {
    for (let i = 0; i < 15; i++) {
      const j = (i + 1) % 15, a = BAND[i], b = BAND[j];
      faceTo(face, [[a[0], yb, a[1]], [OUTLINE[i][0], yb, OUTLINE[i][1]], [OUTLINE[j][0], yb, OUTLINE[j][1]], [b[0], yb, b[1]]], [0, want, 0], 0);
      faceTo(bone, [[a[0], y, a[1]], [a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], y, b[1]]], [b[1] - a[1], 0, a[0] - b[0]], 0);
      if (i < 14) faceTo(bone, [[OPEN[i][0], y, OPEN[i][1]], [a[0], y, a[1]], [b[0], y, b[1]], [OPEN[j][0], y, OPEN[j][1]]], [0, want, 0], 0);
    }
    faceTo(rock, ROOT_PROFILE.map(([x, z]) => [x, yb, z]), [0, want, 0], 1);
    faceTo(face, [[-WALL, y, -FD], [WALL, y, -FD], [WALL, y, 0], [-WALL, y, 0]], [0, want, 0], 0);
  }
}

/**
 * THE SCENE: every object, art and marker, in Blender's frame (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function ossuaryScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };

  // ═══ THE ART ═══════════════════════════════════════════════════════════════════════════════════════════════════════
  // ── the fight floors: slate flags, a runner of bone chips down the middle, flat (blows land on them)
  const floors = add(refFragMesh('Floors', ['floor', 'cobble']));
  for (const [y0, y1] of [[0, ZA], [ZB, LEN]]) floors.level(-WALL, y0, -1, y1, 0, 0).level(-1, y0, 1, y1, 0, 1).level(1, y0, WALL, y1, 0, 0);
  // ── THE EDGE LINE on every walkable rim: the mouth's, each chasm lip's, the exit's
  const gold = add(refFragMesh('Edge_Lines', GOLD));
  for (const [a, b] of [[0, 0.15], [ZA - 0.15, ZA], [ZB, ZB + 0.15], [LEN - 0.15, LEN]]) gold.level(-WALL, a, WALL, b, 0.01);

  // ── the walls: each floor's, both sides; the chasm's below and above the floor's level
  const walls = add(refFragMesh('Walls', [...ASHLAR, ...SLATE]));
  for (const s of [-1, 1]) {
    floorWalls(walls, s, 0, ZA, OSSUARY.PILLARS[0]);
    floorWalls(walls, s, ZB, LEN, OSSUARY.PILLARS[1]);
    const M = onSide(walls, s), ys = cuts([ZA, ZB], 1.0), yl = cuts([ZA - 1.6, ZA, ZB, ZB + 1.6], 1.0), up = [0, ...LOW, ...UP.slice(1)];
    grid(M, yl.length - 1, DOWN.length - 1, (i, j) => [wallX(yl[i], DOWN[j]), yl[i], DOWN[j]], 1, { flip: true, uv: (i, j) => [r4(yl[i] / 4.65), r4(Math.min(1, -DOWN[j] / (0.3 - DEEP)))] });
    grid(M, ys.length - 1, up.length - 1, (i, j) => [wallX(ys[i], up[j]), ys[i], up[j]], 0, { flip: true });
  }
  // ── the chasm's lips under each floor, undercut as they fall, and its soul-light far below
  const lips = add(refFragMesh('Chasm', [...SLATE, ...SOUL]));
  for (const [y, dir] of [[ZA, -1], [ZB, 1]]) {
    const xs = cuts([-4.7, 4.7], 0.94), zs = cuts([DEEP - 0.3, -3, -1, 0], 1.2).reverse();
    grid(lips, xs.length - 1, zs.length - 1, (i, j) => [xs[i], y + dir * (0.1 * -zs[j] + 0.5 * fbm2(SEED + 11, xs[i] * 0.7, zs[j] * 0.6) * Math.min(1, -zs[j])), zs[j]], 0,
      { flip: dir > 0, uv: (i, j) => [r4(xs[i] / 4.65), r4(Math.min(1, -zs[j] / (0.3 - DEEP)))] });
  }
  lips.level(-4.7, ZA - 1.4, 4.7, ZB + 1.4, DEEP, 1);

  // ── the vault: the barrel, its outward roughness, the bone ribs over each pair of piers
  const vault = add(refFragMesh('Vault', ASHLAR));
  for (const [vy, e] of [[cuts([0, ZA, HOLE0], 1.0), 0], [cuts([HOLE1, ZB, LEN], 1.0), 1]]) {
    grid(vault, 12, vy.length - 1, (i, j) => {
      const y = e === 0 && j === vy.length - 1 ? HOLE0 - brkVault(i, 0) : e === 1 && j === 0 ? HOLE1 + brkVault(i, 1) : vy[j], r = AR + vaultOut(i, y);
      return [r * ARCH[i][0], y, ZC + r * ARCH[i][1]];
    }, 0, { flip: true });
  }
  const ribs = add(refFragMesh('Vault_Ribs', BONE));
  const RIB = [[0.18, -0.14], [0.18, 0.14], [-0.18, 0.14], [-0.18, -0.14]];
  for (const P of OSSUARY.PILLARS) for (const y of P) {
    const path = [[PX * -1, y, SPRING - 0.05], ...ARCH.map(([c, sn]) => [(AR - 0.12) * c, y, ZC + (AR - 0.12) * sn]), [PX, y, SPRING - 0.05]].map((p) => p.map(r4));
    sweep(ribs, path, RIB, 0);
  }
  // ── the skull pillars
  const piers = add(refFragMesh('Skull_Pillars', BONE));
  for (const P of OSSUARY.PILLARS) for (const y of P) for (const s of [-1, 1]) skullPillar(onSide(piers, s), PX, y);

  // ── the bays: skulls on each sill and shelf; the soul-gems, the soul-bell, the sealed loculus, the Battlemage's niche
  const bays = add(refFragMesh('Bays', [...BONE, ...ASHLAR]));
  const souls = add(refFragMesh('Soul_Gems', SOUL));
  /** each bay by its floor, its side and its place: what it holds */
  const HOLDS = { 'n-1-0': 'niche', 'n-1-1': 'gem', 'n1-0': 'gem', 'n1-1': 'skulls', 'f-1-0': 'gem', 'f-1-1': 'loculus', 'f1-0': 'bell', 'f1-1': 'gem' };
  OSSUARY.PILLARS.forEach((P, fi) => {
    for (const s of [-1, 1]) {
      const B = onSide(bays, s), G = onSide(souls, s);
      for (let k = 0; k + 1 < P.length; k++) {
        const ya = P[k] + 0.55, yb = P[k + 1] - 0.55, ym = (P[k] + P[k + 1]) / 2, what = HOLDS[`${fi ? 'f' : 'n'}${s}-${k}`], seed = fi * 100 + (s + 1) * 10 + k;
        // the sill's front row of skulls, every bay but the bell's and the loculus's
        if (what !== 'bell' && what !== 'loculus') skullRow(B, 3.5, ya, yb, PLINTH, seed);
        if (what === 'bell') { soulBell(B, 3.85, ym); continue; }
        // the shelf, and what stands on it
        boxOn(B, 3.3, ya - 0.1, 2.33, BACK + 0.45, yb + 0.1, 2.45, 1);
        if (what === 'gem') {
          octahedron(G, 3.85, ym, 2.78, 0.17, 0.3, 0);
          faceTo(G, RINGS[8].map(([c, sn]) => [4.3, ym + 0.46 * c, 2.95 + 0.46 * sn]), [-1, 0, 0], 0);   // its halo on the wall behind
          skullRow(B, 3.62, ya, ym - 0.45, 2.45, seed + 5); skullRow(B, 3.62, ym + 0.45, yb, 2.45, seed + 6);
        } else if (what === 'loculus') {
          boxOn(B, 3.95, ym - 0.55, PLINTH, 4.3, ym + 0.55, 2.33, 1);     // the sealed slab, behind it a page of the Annals
          skullRow(B, 3.62, ya, yb, 2.45, seed + 5);
        } else if (what === 'niche') {
          boxOn(B, 3.4, ym - 0.5, PLINTH, 4.2, ym + 0.5, 1.5, 1);          // the Battlemage's bier
          skullRow(B, 3.62, ya, yb, 2.45, seed + 5);
        } else skullRow(B, 3.62, ya, yb, 2.45, seed + 5);
      }
    }
  });

  // ── THE RIBCAGE over the chasm: five pairs of ribs out of its walls, over the bridges, to a bone sternum
  const cage = add(refFragMesh('Ribcage', BONE));
  const CAGE = [[3.6, -4.2], [3.15, -2.3], [2.85, -0.3], [2.62, 1.7], [2.45, 3.4], [2.22, 4.7], [1.8, 5.85], [1.05, 6.62], [0, 6.95]];
  const BAR = [[0.2, 0], [0.1, 0.12], [-0.1, 0.12], [-0.2, 0], [-0.1, -0.12], [0.1, -0.12]];
  for (let k = 0; k < 5; k++) {
    const y = ZA + 1.05 + k * 1.975, lean = 0.12 * (hash01(SEED, k) - 0.5);
    for (const s of [-1, 1]) sweep(onSide(cage, s), CAGE.map(([x, z], i) => [r4(x), r4(y + lean * (i / 8) - 0.85 * ((8 - i) / 8) * ((8 - i) / 8)), r4(z + (i > 5 ? 0.04 * k : 0))]), BAR, 0);
  }
  sweep(cage, [[0, ZA + 0.3, 7.02], [0, ZA + 3, 7.14], [0, ZB - 3, 7.18], [0, ZB - 0.9, 7.06]], [[0.24, 0], [0.13, 0.11], [-0.13, 0.11], [-0.24, 0], [-0.13, -0.13], [0.13, -0.13]], 0);

  // ── THE BLOCK: the slate the passage is cut in - its sides, its roof, its root hanging into the void, a recessed
  // facade at each end and a bone portal proud of it (nothing behind the mouth or past the exit)
  blockOf(add(refFragMesh('Block', [...ASHLAR, ...SLATE])), add(refFragMesh('Facades', ASHLAR)), add(refFragMesh('Portals', BONE)));

  // ═══ THE LAW, as named markers ═════════════════════════════════════════════════════════════════════════════════════
  add(refFragMesh('socket.in')).across(-W, W, 0, 0, CEIL);
  add(refFragMesh('socket.out.main')).across(-W, W, LEN, 0, CEIL, 0, true);
  add(refFragMesh('floor.fight.near')).level(-W, 0, W, ZA, 0);
  add(refFragMesh('floor.fight.far')).level(-W, ZB, W, LEN, 0);
  add(refFragMesh('ceil.near')).level(-W, 0, W, ZA, CEIL, 0, true);
  add(refFragMesh('ceil.far')).level(-W, ZB, W, LEN, CEIL, 0, true);
  add(refFragMesh('open.mouth')).box(-W - 0.1, 0, -0.05, W + 0.1, 0.05, 0.05);
  add(refFragMesh('open.lipnear')).box(-W - 0.1, ZA - 0.05, -0.05, W + 0.1, ZA + 0.05, 0.05);
  add(refFragMesh('open.lipfar')).box(-W - 0.1, ZB - 0.05, -0.05, W + 0.1, ZB + 0.05, 0.05);
  add(refFragMesh('open.exit')).box(-W - 0.1, LEN - 0.05, -0.05, W + 0.1, LEN, 0.05);
  // the walk graph: each floor's spine and its cross, never over the chasm (the legion walks, it does not jump)
  const N = { mouth: [0, 0.8, 0], nave: [0, 4.5, 0], lipnear: [0, 8.2, 0], westnear: [-2.2, 4.5, 0], eastnear: [2.2, 4.5, 0],
    lipfar: [0, 19.8, 0], navefar: [0, 23.5, 0], exit: [0, 27.2, 0], westfar: [-2.2, 23.5, 0], eastfar: [2.2, 23.5, 0] };
  for (const [k, p] of Object.entries(N)) add(refFragMesh(`node.${k}`)).disc(p[0], p[1], p[2], 0.5);
  for (const [k, a, b] of [['mouthnave', 'mouth', 'nave'], ['navelip', 'nave', 'lipnear'], ['westnave', 'westnear', 'nave'], ['naveeast', 'nave', 'eastnear'],
    ['lipnavefar', 'lipfar', 'navefar'], ['naveexit', 'navefar', 'exit'], ['westfar', 'westfar', 'navefar'], ['eastfar', 'navefar', 'eastfar']]) walkStrip(add(refFragMesh(`edge.${k}`)), N[a], N[b]);
  const cube = (name, x, y, z, s = 0.3) => add(refFragMesh(name)).box(x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  // the Binders' places before the soul-gems, the Lurkers in the piers' shadow, the Battlemage's niche, the soul-bell
  cube('anchor.caster.gemnearwest', -2.4, 6.45, 0);
  cube('anchor.caster.gemneareast', 2.4, 2.55, 0);
  cube('anchor.caster.gemfarwest', -2.4, 21.55, 0);
  cube('anchor.caster.gemfareast', 2.4, 25.45, 0);
  cube('anchor.lurker.near', 2.5, 8.1, 0);
  cube('anchor.lurker.far', -2.5, 27.3, 0);
  cube('anchor.niche.bier', -2.4, 2.55, 0);
  cube('anchor.engine.soulbell', 2.3, 21.55, 0);
  cube('anchor.hazard.wispnear', 0, 4.5, 0.9);
  cube('anchor.hazard.wispfar', 0, 23.5, 0.9);
  // the soul-wisps: each a figure of eight over its fight floor (section 11.2 - they tether only there)
  add(refFragMesh('hazard.wisp.near.per9000.ph4500')).level(-2, 1.5, 2, 7.5, 1.2);
  add(refFragMesh('hazard.wisp.far.per11000.ph5500')).level(-2, 20.5, 2, 26.5, 1.2);
  // the bone bridges: the Crumble's law in the Ossuary's dress (net/eliteGates/egSpanLaw.js `bone`)
  ['a', 'b', 'c'].forEach((k, i) => { const [y0, y1] = OSSUARY.BONES[i]; add(refFragMesh(`course.bone.${k}`)).box(-OSSUARY.BONE_W / 2, y0, -0.6, OSSUARY.BONE_W / 2, y1, 0); });
  // the alcove: the sealed loculus of the far floor's west bay (a page of the Annals behind a false wall)
  add(refFragMesh('alcove.seam.page.loculus')).box(-4.2, 24.95, PLINTH, -3.4, 25.95, 2.45);
  cube('light.band.near', 0, 4.5, 4.6, 0.2);
  cube('light.band.chasm', 0, 14, -3.2, 0.2);
  cube('light.band.far', 0, 23.5, 4.6, 0.2);
  // the collider's proxy: the floors, the walls' plane, the chasm's lips, the vault as two planes (never the drawn mesh)
  const gab = 5.62, crown = 7.2;
  add(refFragMesh('collider.proxy'))
    .level(-W, 0, W, ZA, 0).level(-W, ZB, W, LEN, 0)
    .along(-W, 0, LEN, DEEP, gab, 0, true).along(W, 0, LEN, DEEP, gab)
    .across(-W, W, ZA, DEEP, 0, 0, true).across(-W, W, ZB, DEEP, 0)
    .face([[-W, 0, gab], [-W, HOLE0, gab], [0, HOLE0, crown], [0, 0, crown]]).face([[W, HOLE0, gab], [W, 0, gab], [0, 0, crown], [0, HOLE0, crown]])
    .face([[-W, HOLE1, gab], [-W, LEN, gab], [0, LEN, crown], [0, HOLE1, crown]]).face([[W, LEN, gab], [W, HOLE1, gab], [0, HOLE1, crown], [0, LEN, crown]]);
  return out;
}

/** The scene written as Blender's exporter writes one (tools/egRefFragScene.mjs writeRefFragFbx) - its bytes. */
export const writeOssuaryFbx = () => writeRefFragFbx(ossuaryScene());

if (isMain(import.meta.url)) {
  const out = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, OSSUARY_FBX));
  const bytes = writeOssuaryFbx();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  console.log(`${out}: ${ossuaryScene().length} objects, ${bytes.length} bytes`);
}
