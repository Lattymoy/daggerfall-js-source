// THE MIST STAIR - the Soul Cairn's hero shaft, written from numbers: stairs wound down a pit of mist.
//
//     node tools/egHeroMistStairScene.mjs [--out=src/assets/egfrags/source/egheroMistStair.fbx]
//
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2,
// 11.6 and the EG-HERO (the Soul Cairn) record). Section 11.2's row is the brief: "stairs wound down a pit of mist", its
// signature "mist surges: a rising band that hides the depth below a line for 3 s. It never hides footing: edge lines and
// inner platforms draw over it, and it stops 0.3 m below any landing within one jump" - the band is the hall's own pass
// (world/eliteGates/egLook.js egMistSheets, from this scene's `hazard.mist` line); this scene gives it a pit to rise in. Written as
// the reference is (tools/egRefFragScene.mjs refFragMesh and writeRefFragFbx) with the hero kit's shapes
// (tools/egHeroKit.mjs): no game data, no third-party art, no trigonometry. tools/bakeEgHeroMistStair.mjs bakes it.
//
// THE ENVELOPE (net/eliteGates/egFragLaw.js egFragShaft('mist') - where a hall lays the code-built shaft, it can lay this): a shaft
// 33 m along Blender's +Y and 8 m across (x -4..4, the kit's halfW 400); its rim Y 0..3 at Z 0 (EG_SHAFT_RIM_CM) under
// 6.5 m of vault (EG_SHAFT_HEIGHT_CM), the mouth (socket.in) 8 m by 6.5 m; four flights down (the kit's three or four, each
// EG_SHAFT_FLIGHT_CM 0.9 m under the last - THE ENVELOPE's step down - 2.6 m apart, the kit's 2.4-2.8; ledges 2.4 m by
// 2 m, EG_STEP.ledge's, swinging from side to side 1.5 m off the line), a Drop of 4 m (EG_SHAFT_DROP_CM's 3-4.5) onto its
// 6 m walled landing (the Drop's own, scenes/eliteGates/egSpan.js), and the foot Y 30..33 (EG_SHAFT_FOOT_CM) at Z -7.6, the exit
// (socket.out.main) 8 m by 4.6 m in its tunnel; the mist's line 3 m under the foot (the kit's yB - 300). Blows land on
// none of it: its floors are traversal ground. Nothing stands behind the mouth or past the exit; the drawn rock pushes
// outward from that envelope, never in, never on the floor.
//
// THE PLACE: from a vaulted threshold the shaft opens into an oval pit 13 m across at its widest, its slate walls falling
// 14 m to a pool of soul-light; the four flights stand on stone piers rising out of the deep, each strutted to its wall,
// and round the walls wind the stubs of an older stair - down the west wall from the rim, back along the east wall into
// the mist - while a ring of soul-crystals marks the mist's own line. At the foot a low tunnel leads on. The whole a crag
// of slate hung in the void, a bone portal at each end in its recessed face, its root hanging below.
//
// Every walkable rim wears THE EDGE LINE (section 25.3): the mouth's, the pit's lip, the foot's two (the flights and the
// landing are the span's own pieces, edged by their own set, scenes/eliteGates/egSpan.js).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { RINGS, r4, fbm2, hash01, grid, lathe, sweep, onSide, boxOn, faceTo, octahedron, cuts, walkStrip } from './egHeroKit.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

/** Where the scene is committed. */
export const MIST_STAIR_FBX = 'src/assets/egfrags/source/egheroMistStair.fbx';

/**
 * THE ENVELOPE AND THE PLACE'S NUMBERS (metres, Blender's frame: X across, Y along the course, Z up; the foot of the mouth
 * at the origin). `W` the envelope's half width, `WALL` the drawn walls' plane, `RIM` the rim's far edge, `HEIGHT` the
 * rim's vault (the ceiling clamp's plane), `FLIGHTS` each ledge's x, its near and far edge and its top, `LEDGE_W` their
 * width, `DROP` the landing's near and far edge, `FOOT` (YB) the landing's and the foot's height, `LEN` the exit, `TUNNEL`
 * the foot's tunnel (its ceiling clamp over the foot), `MIST` the mist's line, `POOL` the soul-light at the pit's bottom,
 * `TOP` the pit's rim against the void.
 */
export const MIST_STAIR = Object.freeze({
  W: 4, WALL: 4.05, RIM: 3, HEIGHT: 6.5, LEDGE_W: 2.4,
  FLIGHTS: Object.freeze([[-1.5, 5.6, 7.6, -0.9], [1.5, 10.2, 12.2, -1.8], [-1.5, 14.8, 16.8, -2.7], [1.5, 19.4, 21.4, -3.6]].map((f) => Object.freeze(f))),
  DROP: Object.freeze([24, 30]), FOOT: -7.6, LEN: 33, TUNNEL: 4.6, MIST: -10.6, POOL: -14, TOP: 9,
});
const { W, WALL, RIM, HEIGHT, FOOT, LEN, MIST, POOL, TOP } = MIST_STAIR;
const [DROP0, DROP1] = MIST_STAIR.DROP;
/** The far end of the pit (behind the Drop's own far wall, scenes/eliteGates/egSpan.js DROP_WALL_T 0.3 thick at the landing's edge). */
const FAR = DROP1 + 0.32;
/** The pit's floor of rock under its pool. */
const BED = POOL - 0.4;

// ── the two vaults: segmental, RINGS[32]'s corners from 135 to 45 degrees (nine, 11.25 apart), springing at WALL
const R32 = RINGS[32];
const ARCH = Object.freeze(Array.from({ length: 9 }, (_, k) => R32[12 - k]));
const AR = WALL / R32[4][0];                       // the radius (5.7276)
const RIM_SPRING = 6.6, FOOT_SPRING = FOOT + MIST_STAIR.TUNNEL + 0.1;
const RIM_ZC = RIM_SPRING - AR * R32[4][1], FOOT_ZC = FOOT_SPRING - AR * R32[4][1];
/** The arch's corner k (0..8, west to east) of the vault centred at height zc, `out` beyond its radius. */
const archAt = (k, zc, out = 0) => [(AR + out) * ARCH[k][0], zc + (AR + out) * ARCH[k][1]];

// ── the dress records by name (world/eliteGates/egBandArt.js EG_DRESS)
const SLATE = ['root'], ASHLAR = ['pillar'], BONE = ['brass'], SOUL = ['molten'], GOLD = ['edge'];

// ── the pit's plan, and noise always outward
const SEED = 0x0715;
/** How far the pit's walls bow out from the envelope at Y: an oval, nought where it meets the rim and the foot. */
const bow = (y) => { const t = (y - 16.5) / 13.5; return t <= -1 || t >= 1 ? 0 : 2.4 * Math.sqrt(1 - t * t); };
/** The rough of the walls at (Y, Z): fbm, nought on the rim's plinth (Z 0..0.6), at the vaults' springs, at the portals,
 *  where the pit meets the tunnels (Y 3 and FAR above the floors), and at the pit's rim (its top's own line). */
function rough(y, z, ends = true) {
  const gz = z >= 0 && z <= 0.6 ? 0 : z > 0.6 && z < 1.2 ? (z - 0.6) / 0.6 : 1;
  const gy = ends ? Math.max(0, Math.min(1, y / 1.2, (LEN - y) / 1.2)) : 1;
  return 0.45 * fbm2(SEED, y * 0.5, z * 0.55) * gz * gy;
}
/** The pit's rim at Y on side s: its jagged top against the void, TOP at its ends. */
const topAt = (y, s) => TOP - 1.5 * fbm2(SEED + 9 + s, y * 0.45, 3) * Math.max(0, Math.min(1, (y - RIM) / 2, (FAR - y) / 2));

/**
 * THE SCENE: every object, art and marker, in Blender's frame (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function mistStairScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };

  // ═══ THE ART ═══════════════════════════════════════════════════════════════════════════════════════════════════════
  // ── the floors: the rim's and the foot's slate flags, a runner of bone chips down the middle; THE EDGE LINE on their rims
  const floors = add(refFragMesh('Floors', ['floor', 'cobble']));
  for (const [y0, y1, z] of [[0, RIM, 0], [DROP1, LEN, FOOT]]) floors.level(-WALL, y0, -1, y1, z, 0).level(-1, y0, 1, y1, z, 1).level(1, y0, WALL, y1, z, 0);
  const gold = add(refFragMesh('Edge_Lines', GOLD));
  for (const [a, b, z] of [[0, 0.15, 0], [RIM - 0.15, RIM, 0], [DROP1, DROP1 + 0.15, FOOT], [LEN - 0.15, LEN, FOOT]]) gold.level(-WALL, a, WALL, b, z + 0.01);

  // ── the tunnels: the rim's walls and vault, the foot's - a plinth course, then rough to the spring
  const walls = add(refFragMesh('Walls', [...ASHLAR, ...SLATE]));
  for (const [y0, y1, z0, spring, zc] of [[0, RIM, 0, RIM_SPRING, RIM_ZC], [DROP1, LEN, FOOT, FOOT_SPRING, FOOT_ZC]]) {
    const ys = cuts([y0, y1], 0.75), zs = cuts([z0, z0 + 0.6, spring - 0.6, spring], 0.8), fade = (y) => Math.max(0, Math.min(1, (y - y0) / 0.75, (y1 - y) / 0.75));
    for (const s of [-1, 1]) grid(onSide(walls, s), ys.length - 1, zs.length - 1, (i, j) => [WALL + (j === zs.length - 1 ? 0 : rough(ys[i], zs[j] - z0) * fade(ys[i])), ys[i], zs[j]], 0, { flip: true });
    grid(walls, 8, ys.length - 1, (i, j) => { const [x, z] = archAt(i, zc, i === 0 || i === 8 ? 0 : 0.18 * fbm2(SEED + 5, ys[j] * 0.6, i) * fade(ys[j])); return [x, ys[j], z]; }, 0, { flip: true });
  }

  // ── THE PIT: its oval walls, each side one face from under the rim to under the foot, the deep to its jagged rim
  const LINED = cuts([MIST, FOOT - 0.5, 0, 6, TOP], 1.5), RAW = cuts([BED - 0.3, MIST], 1.5), cols = 26;
  const pitAt = (rows, s) => (i, j) => {
    const z = rows[j], y0 = z < -0.5 ? RIM - 1.6 : RIM, y1 = z < FOOT - 0.5 ? FAR + 1.6 : FAR, y = y0 + ((y1 - y0) * i) / cols, top = rows === LINED && j === rows.length - 1;
    const zz = top ? topAt(y, s) : z, end = (y <= RIM || y >= FAR) && z >= -0.5 ? 0 : 1;
    return [WALL + bow(y) + (top ? 0 : rough(y, zz, false) * end), y, zz];
  };
  for (const s of [-1, 1]) {
    grid(onSide(walls, s), cols, LINED.length - 1, pitAt(LINED, s), 0, { flip: true });
    grid(onSide(walls, s), cols, RAW.length - 1, pitAt(RAW, s), 1, { flip: true, uv: (i, j, p) => [r4(p[1] / 2.05), r4((MIST - p[2]) / (MIST - BED + 0.3))] });
  }
  // the pit's ends: under the rim and under the foot (each undercut as it falls), over the rim's vault and over the foot's
  const lips = add(refFragMesh('Pit_Ends', [...SLATE, ...ASHLAR]));
  for (const [y, dir, z0] of [[RIM, -1, 0], [FAR, 1, FOOT]]) {
    const xs = cuts([-5.2, 5.2], 1.04), at = (zs) => (i, j) => [xs[i], y + dir * (0.08 * (z0 - zs[j]) + 0.5 * fbm2(SEED + 11 + dir, xs[i] * 0.7, zs[j] * 0.6) * Math.min(1, z0 - zs[j])), zs[j]];
    const lined = cuts([MIST, z0], 1.4).reverse(), raw = cuts([BED - 0.3, MIST], 1.4).reverse();
    grid(lips, xs.length - 1, lined.length - 1, at(lined), 1, { flip: dir > 0 });
    grid(lips, xs.length - 1, raw.length - 1, at(raw), 0, { flip: dir > 0, uv: (i, j) => [r4(xs[i] / 2.05), r4((MIST - raw[j]) / (MIST - BED + 0.3))] });
  }
  for (const [y, zc, want] of [[RIM, RIM_ZC, 1], [FAR, FOOT_ZC, -1]]) {
    for (let k = 0; k < 8; k++) {
      const a = archAt(k, zc), b = archAt(k + 1, zc), ta = (WALL * ARCH[k][0]) / R32[4][0], tb = (WALL * ARCH[k + 1][0]) / R32[4][0];
      faceTo(lips, [[a[0], y, a[1]], [b[0], y, b[1]], [tb, y, TOP], [ta, y, TOP]], [0, want, 0], 1);
    }
  }
  // the pool of soul-light at the bottom, under the mist
  const rimOf = [RIM - 1.6, RIM, 5, 8, 12, 16.5, 21, 25, 28, FAR, FAR + 1.6];
  faceTo(add(refFragMesh('Pool', SOUL)), [...rimOf.map((y) => [WALL + bow(y) + 0.6, y, POOL]), ...rimOf.slice().reverse().map((y) => [0 - (WALL + bow(y) + 0.6), y, POOL])], [0, 0, 1], 0);
  // ── THE FLIGHTS' PIERS out of the deep, each strutted to its wall (the flights themselves the span's own pieces)
  const piers = add(refFragMesh('Piers', [...ASHLAR, ...BONE]));
  MIST_STAIR.FLIGHTS.forEach(([x, y0, y1, top], q) => {
    const y = (y0 + y1) / 2, s = x < 0 ? -1 : 1, cap = top - 0.6;
    lathe(piers, x, y, [[0.78, BED], [0.66, BED + 2.2], [0.56, cap - 2.6], [0.62, cap - 1.7], [0.94, cap - 0.6], [0.94, cap]], 12);
    const wx = s * (WALL + bow(y) + 0.3), x0 = x + s * 0.7;
    sweep(piers, [[x0, y, cap - 0.45], [(x0 + wx) / 2, y, cap - 0.75 - 0.1 * q], [wx, y, cap - 1.9]].map((p) => p.map(r4)), [[0.3, -0.22], [0.3, 0.22], [-0.3, 0.22], [-0.3, -0.22]], 0);
    // a bone band round the pier's neck
    lathe(piers, x, y, [[0.66, cap - 1.95], [0.72, cap - 1.85], [0.66, cap - 1.75]], 12, 1, { top: false });
  });
  // ── THE OLD STAIR wound round the pit: its broken treads down the west wall from the rim, back along the east into the mist
  const stair = add(refFragMesh('Old_Stair', ASHLAR));
  for (const [s, ya, za, yb, zb] of [[-1, 4.6, 1.6, 28.6, -6.9], [1, 28.6, -7.4, 4.6, -13.2]]) {
    const n = 20;
    for (let k = 0; k < n; k++) {
      const y = ya + ((yb - ya) * k) / (n - 1), z = za + ((zb - za) * k) / (n - 1), w = WALL + bow(y) + rough(y, z, false);
      if (bow(y) < 0.45) continue;
      boxOn(onSide(stair, s), Math.max(W + 0.03, w - 0.42), y - 0.42, z - 0.2, w + 0.3, y + 0.42, z, 0);
    }
  }
  // ── THE MIST'S BAND: soul-crystals round the walls at its line
  const souls = add(refFragMesh('Soul_Crystals', SOUL));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 12; k++) {
      const y = RIM + 1.6 + k * 2.15 + 0.6 * hash01(SEED + 3, k, s), z = MIST + 1.1 + 0.6 * hash01(SEED + 4, k, s), h = 0.35 + 0.25 * hash01(SEED + 5, k, s);
      octahedron(onSide(souls, s), WALL + bow(y) + rough(y, z, false) - 0.05, y, z, 0.16 + 0.06 * hash01(SEED + 6, k, s), h, 0);
    }
  }

  // ── THE CRAG: the slate the shaft is cut in - its sides bowed with the pit, its top round the pit's rim, its roofs over the
  // tunnels, its root hanging into the void, a recessed face at each end and a bone portal proud of it
  crag(add(refFragMesh('Crag', [...ASHLAR, ...SLATE])), add(refFragMesh('Portals', BONE)));

  // ═══ THE LAW, as named markers ═════════════════════════════════════════════════════════════════════════════════════
  add(refFragMesh('socket.in')).across(-W, W, 0, 0, HEIGHT);
  add(refFragMesh('socket.out.main')).across(-W, W, LEN, FOOT, FOOT + MIST_STAIR.TUNNEL, 0, true);
  add(refFragMesh('floor.rim')).level(-W, 0, W, RIM, 0);
  add(refFragMesh('floor.foot')).level(-W, DROP1, W, LEN, FOOT);
  add(refFragMesh('ceil.rim')).level(-W, 0, W, RIM, HEIGHT, 0, true);
  add(refFragMesh('ceil.foot')).level(-W, DROP1, W, LEN, FOOT + MIST_STAIR.TUNNEL, 0, true);
  add(refFragMesh('open.mouth')).box(-W - 0.1, 0, -0.05, W + 0.1, 0.05, 0.05);
  add(refFragMesh('open.lip')).box(-W - 0.1, RIM - 0.05, -0.05, W + 0.1, RIM + 0.05, 0.05);
  add(refFragMesh('open.landing')).box(-W - 0.1, DROP1 - 0.05, FOOT - 0.05, W + 0.1, DROP1 + 0.05, FOOT + 0.05);
  add(refFragMesh('open.exit')).box(-W - 0.1, LEN - 0.05, FOOT - 0.05, W + 0.1, LEN, FOOT + 0.05);
  // the walk graph: the rim's and the foot's, never down the pit (the legion walks, it does not jump)
  const N = { rim: [0, 1.5, 0], rimwest: [-2.6, 1.5, 0], rimeast: [2.6, 1.5, 0], foot: [0, 31.5, FOOT], footwest: [-2.6, 31.5, FOOT], footeast: [2.6, 31.5, FOOT] };
  for (const [k, p] of Object.entries(N)) add(refFragMesh(`node.${k}`)).disc(p[0], p[1], p[2], 0.5);
  for (const [k, a, b] of [['rimwest', 'rimwest', 'rim'], ['rimeast', 'rim', 'rimeast'], ['footwest', 'footwest', 'foot'], ['footeast', 'foot', 'footeast']]) walkStrip(add(refFragMesh(`edge.${k}`)), N[a], N[b]);
  // where the mist is told from: the pit's deep
  add(refFragMesh('anchor.hazard.deep')).box(-0.15, 16.35, POOL, 0.15, 16.65, POOL + 0.3);
  // the mist surge: its line 3 m under the foot (section 11.2 - sight, never harm; it never hides footing)
  add(refFragMesh('hazard.mist.sea.ph6000')).level(-W, RIM, W, DROP1, MIST);
  // the four flights and the Drop's landing (net/eliteGates/egSpanLaw.js `ledge` and `drop` - the span's own pieces)
  MIST_STAIR.FLIGHTS.forEach(([x, y0, y1, top], q) => add(refFragMesh(`course.ledge.${'abcd'[q]}`)).box(x - MIST_STAIR.LEDGE_W / 2, y0, top - 0.6, x + MIST_STAIR.LEDGE_W / 2, y1, top));
  add(refFragMesh('course.drop.landing')).box(-3, DROP0, FOOT - 0.6, 3, DROP1, FOOT);
  // the alcove: a sealed niche in the rim's east wall (lumen behind a false wall)
  add(refFragMesh('alcove.seam.lumen.rim')).box(4.15, 1.0, 0.6, 4.95, 2.0, 2.2);
  const cube = (name, x, y, z, s = 0.2) => add(refFragMesh(name)).box(x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  cube('light.band.rim', 0, 1.5, 4.4);
  cube('light.band.pit', 0, 12.5, 1.2);
  cube('light.band.foot', 0, 31.5, FOOT + 3.2);
  cube('light.band.deep', 0, 16.5, POOL + 1.4);
  // the collider's proxy: the rim and the foot, the shaft's walls' plane, the pit's ends, the two ceilings (never the drawn mesh)
  add(refFragMesh('collider.proxy'))
    .level(-W, 0, W, RIM, 0).level(-W, DROP1, W, LEN, FOOT)
    .along(-W, 0, LEN, BED, HEIGHT, 0, true).along(W, 0, LEN, BED, HEIGHT)
    .across(-W, W, RIM, BED, 0, 0, true).across(-W, W, DROP1, BED, FOOT).across(-W, W, DROP1, FOOT + MIST_STAIR.TUNNEL, HEIGHT)
    .level(-W, 0, W, RIM, HEIGHT, 0, true).level(-W, DROP1, W, LEN, FOOT + MIST_STAIR.TUNNEL, 0, true);
  return out;
}

// ── THE CRAG (the shaft's outside): each end's loops, eleven corners counter-clockwise seen from the mouth (x right, z up)
/** The faces stand FAC in from the mouth and the exit, the portals' band FRAME wide proud of them, its foot FD under its
 *  floor; the crag's sides SX out (bowing with the pit), its foot SBOT, its top TOP; its root's keel KEEL. */
const FAC = 0.5, FRAME = 0.7, FD = 0.7, SX = 5.4, SBOT = BED - 0.9, KEEL = SBOT - 5.5;
/** The crag's side at Y: SX, bowing out round the pit. */
const sideAt = (y) => { const t = (y - 16.5) / 14.5; return SX + (t <= -1 || t >= 1 ? 0 : 2.3 * Math.sqrt(1 - t * t)); };
/** The root's profile at scale 1, west to east through its keel. */
const KEEL_PROFILE = [[-1, SBOT], [-0.99, SBOT - 1.2], [-0.95, SBOT - 2.4], [-0.86, SBOT - 3.5], [-0.66, SBOT - 4.5], [-0.34, SBOT - 5.2], [0, KEEL], [0.34, SBOT - 5.2], [0.66, SBOT - 4.5], [0.86, SBOT - 3.5], [0.95, SBOT - 2.4], [0.99, SBOT - 1.2], [1, SBOT]];
/** THE CRAG: its sides, its top round the pit's rim, its roofs over the tunnels (`rock`'s ashlar), its root (`rock`'s
 *  slate), its faces and portals' bands (`bone`). */
function crag(rock, bone) {
  const ys = cuts([FAC, LEN - FAC], 2.2), ends = (y) => Math.max(0, Math.min(1, (y - FAC) / 1.5, (LEN - FAC - y) / 1.5));
  const zs = cuts([SBOT, TOP], 2.0);
  for (const s of [-1, 1]) {
    // the side, out from its bow
    grid(onSide(rock, s), ys.length - 1, zs.length - 1, (i, j) => [sideAt(ys[i]) + (j === 0 || j === zs.length - 1 ? 0 : 1.1 * fbm2(SEED + 21 + s, ys[i] * 0.3, zs[j] * 0.35) * ends(ys[i])), ys[i], zs[j]], 1,
      { uv: (i, j) => [r4(ys[i] / 8), r4((0.7 * (TOP - zs[j])) / (TOP - SBOT))] });
    // its top: from the pit's jagged rim out to the side, over the pit (the tunnels' roofs either end)
    const ty = cuts([RIM, FAR], 1.0386);
    grid(onSide(rock, s), 2, ty.length - 1, (i, j) => { const y = ty[j], x0 = WALL + bow(y), x1 = sideAt(y); return [x0 + ((x1 - x0) * i) / 2, y, i === 0 ? topAt(y, s) : TOP]; }, 0, { flip: true });
  }
  // the roofs over the tunnels
  for (const [y0, y1] of [[FAC, RIM], [FAR, LEN - FAC]]) faceTo(rock, [[-sideAt(y0), y0, TOP], [sideAt(y0), y0, TOP], [sideAt(y1), y1, TOP], [-sideAt(y1), y1, TOP]], [0, 0, 1], 0);
  // the root, its picture from its lip (v 0) to its tip (v 1)
  const run = [0];
  for (let i = 1; i < KEEL_PROFILE.length; i++) { const a = KEEL_PROFILE[i - 1], b = KEEL_PROFILE[i]; run.push(run[i - 1] + Math.sqrt((b[0] - a[0]) * SX * (b[0] - a[0]) * SX + (b[1] - a[1]) * (b[1] - a[1]))); }
  const half = run[6];
  grid(rock, 12, ys.length - 1, (i, j) => {
    const [u, z] = KEEL_PROFILE[i], y = ys[j], x = u * sideAt(y), p = i === 0 || i === 12 ? 0 : 0.8 * fbm2(SEED + 25, x * 0.4 + y * 0.3, z * 0.3) * ends(y);
    const d = Math.sqrt(x * x + (z - SBOT + 3) * (z - SBOT + 3));
    return [x + (p * x) / d, y, z + (p * (z - SBOT + 3)) / d];
  }, 1, { flip: true, uv: (i, j) => [r4(ys[j] / 8), r4(0.7 + 0.3 * (1 - Math.abs(run[i] - half) / half))] });
  // each end: the face (the band's loop to the crag's), the root's cap, the portal's band, its outer side, its step
  for (const [y, yb, want, z0, zc] of [[0, FAC, -1, 0, RIM_ZC], [LEN, LEN - FAC, 1, FOOT, FOOT_ZC]]) {
    const open = [[WALL, z0 - FD], ...ARCH.map((_, i) => archAt(8 - i, zc)), [-WALL, z0 - FD]];
    const fx = archAt(8, zc, FRAME)[0], band = [[fx, z0 - FD], ...ARCH.map((_, i) => archAt(8 - i, zc, FRAME)), [-fx, z0 - FD]];
    const outline = [[SX, SBOT], ...ARCH.map((_, i) => [(SX * ARCH[8 - i][0]) / R32[4][0], TOP]), [-SX, SBOT]];
    for (let i = 0; i < 11; i++) {
      const j = (i + 1) % 11, a = band[i], b = band[j];
      faceTo(rock, [[a[0], yb, a[1]], [outline[i][0], yb, outline[i][1]], [outline[j][0], yb, outline[j][1]], [b[0], yb, b[1]]], [0, want, 0], 0);
      faceTo(bone, [[a[0], y, a[1]], [a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], y, b[1]]], [b[1] - a[1], 0, a[0] - b[0]], 0);
      if (i < 10) faceTo(bone, [[open[i][0], y, open[i][1]], [a[0], y, a[1]], [b[0], y, b[1]], [open[j][0], y, open[j][1]]], [0, want, 0], 0);
    }
    faceTo(rock, KEEL_PROFILE.map(([u, z]) => [u * SX, yb, z]), [0, want, 0], 1);
    faceTo(rock, [[-WALL, y, z0 - FD], [WALL, y, z0 - FD], [WALL, y, z0], [-WALL, y, z0]], [0, want, 0], 0);
  }
}

/** The scene written as Blender's exporter writes one (tools/egRefFragScene.mjs writeRefFragFbx) - its bytes. */
export const writeMistStairFbx = () => writeRefFragFbx(mistStairScene());

if (isMain(import.meta.url)) {
  const out = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, MIST_STAIR_FBX));
  const bytes = writeMistStairFbx();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  console.log(`${out}: ${mistStairScene().length} objects, ${bytes.length} bytes`);
}
