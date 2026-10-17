// THE OBLIVION CAVERNS, DEEP - the Havoc Wellhead's hero chamber of the magma tide, a scene written from numbers alone.
//
//     node tools/egHeroDeepCavernsScene.mjs [--out=src/assets/egfrags/source/egheroDeepCaverns.fbx]
//
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2, 11.4
// and 11.6). The Wellhead's own magma caverns, wider, brighter, the magma higher: a basalt shelf barely over a lake of
// magma under a vaulted cavern, two dry ledges 2.5 m up on its east and west, lava falling down its walls, basalt columns
// standing out of the lake. Written on the authoring kit (tools/egHeroKit.mjs) and the reference's mesh and writer
// (tools/egRefFragScene.mjs refFragMesh, writeRefFragFbx) - no game data, no third-party art, no trigonometry - and committed
// as the .fbx tools/fragBake.mjs bakes (tools/bakeEgHeroDeepCaverns.mjs). Re-run it and the same bytes come out
// (test/tooling/eghero_wellhead.test.js holds it to them).
//
// THE ENVELOPE - net/eliteGates/egFragLaw.js egFragChamber('deep', r, R) as the halls call it (the court disc it stands in for):
//   frame      1 unit 1 m, Z up, the course along +Y; the mouth at Y 0 centred on X 0, the exit at Y 36
//   fight      the low floor a circle of R 16 m (the Deepway's chamber, net/eliteGates/egLaw.js `deepway`: R 1600) about (0, 18), the
//              magma lake 0.8 m under its kerbed rim; THE MAGMA TIDE (`tide`, a disc of r 16 over it - section 11.2: the low
//              floor floods 15 s in 60, told 5 s ahead); the two dry floors (play `balcony` - egFragChamber's deep balconies
//              250 cm up, from R - 3 m to R + 3.5 m, here two, east and west, each on two stairs): no point of the low
//              floor more than 24 m from a stair (24/6.975 + 1.5 = 4.95 s, inside the tide's 5 s tell - farthest 14.5 m)
//   mouth      the court's bridge (BRIDGE_HALF 200): a gate 4 m wide and 6 m high through the cavern's face, 2 m deep; the
//              exit the same at the far end, at the mouth's height
//   headroom   the clamp's ceiling 9 m over the low floor and the ledges (a chamber's 6 m over the ledges' 2.5), 6 m in the
//              gates; the cavern drawn over it to 16 m and pushed out by noise
//   box        X -27.5 to 27.2, Y 0 to 36, Z -15.2 to 22.0 (the rock's keel to its crown)
// THE PLACE: the cavern's walls and vault of rough basalt, coursed where the lake laps them and dark at the crown; four lava
// falls into the lake; six basalt columns and stumps out of the magma; stalactites; the low floor's plates in a kerb of dressed
// stone, THE EDGE LINE round every open rim; the ledges' rock rising from the lake; their stairs; the Sluice's gate on the
// lake's edge (the kit's engine); the gates' iron frames in the cavern's face; a niche in the south gate's wall (the alcove).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';
import { RINGS, r4, unit, hash01, fbm2, grid, lathe, planeFace, boxFaces, walkEdge, levelDisc, ringBand, ringWall, levelPolygon, rockFaceLoops, rockFace, rockHull, outlineLoops } from './egHeroKit.mjs';

/** Where the scene is committed. */
export const HERO_DEEP_CAVERNS_FBX = 'src/assets/egfrags/source/egheroDeepCaverns.fbx';
/** THE ENVELOPE (m): the floor's middle and radius, the length; the gates (half-width, height, depth); the ledges (front
 *  and back radii, height) and their stairs' run; the kerb; the lake; the clamp's ceilings; the cavern's walls (half-width
 *  at the gates and its swell, their height and the vault's rise). */
export const DEEP_CAVERNS = Object.freeze({
  cy: 18, R: 16, len: 36, gate: 2, gateH: 6, gateD: 2, ledgeR: 13, ledgeBack: 19.5, ledgeH: 2.5, stair: 4.6, kerb: 0.6,
  lake: -0.8, ceil: 9, wallW: 9, wallSwell: 12, wallH: 8, wallHSwell: 3, rise: 2, riseSwell: 3, foot: -1.6,
});
const C = DEEP_CAVERNS;
const SEED = 0xd3e9;
const D = Object.freeze(['floor', 'brass', 'root', 'arena', 'cobble', 'edge', 'molten', 'pillar']);
const [FLOOR, IRON, ROCK, ARENA, , EDGE, MOLTEN, ASHLAR] = [0, 1, 2, 3, 4, 5, 6, 7];

/** A point at radius r on bearing i of the 32-ring about the floor's middle ([x, y]). */
const P = (r, i) => { const [c, s] = RINGS[32][((i % 32) + 32) % 32]; return [r4(r * c), r4(C.cy + r * s)]; };
/** Where the chord from ring bearing i to j at radius R meets x = xg: its y. */
function chordY(i, j, xg) { const [a, b] = [P(C.R, i), P(C.R, j)]; return r4(a[1] + ((b[1] - a[1]) * (xg - a[0])) / (b[0] - a[0])); }
const GY = Object.freeze({ south: chordY(23, 24, -C.gate), north: chordY(7, 8, C.gate) });
/** A stair on a ledge's chord from bearing i to i + 1 (r ledgeR): its top corners, its foot corners and its axis inward. */
function stairOf(i) {
  const a = P(C.ledgeR, i), b = P(C.ledgeR, i + 1), u = unit([a[0] + b[0], a[1] + b[1] - 2 * C.cy, 0]);
  const foot = (p) => [r4(p[0] - u[0] * C.stair), r4(p[1] - u[1] * C.stair)];
  return { top: [a, b], foot: [foot(a), foot(b)], u: [u[0], u[1]] };
}
/** The ledges, east (bearing 0) and west (16): their two stairs each, on the chords either side of their middle two. */
const LEDGES = Object.freeze([0, 16].map((m) => Object.freeze({ m, stairs: [stairOf(m - 2), stairOf(m + 1)] })));
/** The cavern's swell at y: nought at its gates' inner faces (y 2 and 34), one at its middle. */
const swell = (y) => { const t = (y - C.cy) / (C.cy - C.gateD); return t * t >= 1 ? 0 : Math.sqrt(1 - t * t); };
const wallW = (y) => C.wallW + C.wallSwell * swell(y), wallH = (y) => C.wallH + C.wallHSwell * swell(y), riseAt = (y) => C.rise + C.riseSwell * swell(y);

/**
 * A FLOOR'S OUTLINE WITH ITS EDGES' KINDS: corners `[[x, y, kind], ...]` counter-clockwise, each corner's kind its edge's to
 * the next - `o` open over a fall (THE EDGE LINE on it), `r` open onto a ramp, `w` a wall, `n` running on into another
 * floor. The low floor, counter-clockwise: the circle, the gates' tabs, the ledges' notches round their stairs.
 */
export function deepLowFloor() {
  const out = [], o = (p, k) => out.push([p[0], p[1], k]);
  /** a ledge's notch: from the rim in to its front, round its two stairs' feet, out again (the walls of its rock) */
  const notch = ({ m, stairs: [s0, s1] }) => {
    o(P(C.R, m - 2), 'w'); o(P(C.ledgeR, m - 2), 'w'); o(s0.foot[0], 'r'); o(s0.foot[1], 'w');
    o(P(C.ledgeR, m - 1), 'w'); o(P(C.ledgeR, m), 'w'); o(P(C.ledgeR, m + 1), 'w'); o(s1.foot[0], 'r'); o(s1.foot[1], 'w'); o(P(C.ledgeR, m + 2), 'w');
  };
  for (let i = 2; i <= 7; i++) o(P(C.R, i), 'o');
  o([C.gate, GY.north], 'o'); o([C.gate, C.len - C.gateD], 'n'); o([-C.gate, C.len - C.gateD], 'o'); o([-C.gate, GY.north], 'o');
  for (let i = 9; i <= 13; i++) o(P(C.R, i), 'o');
  notch(LEDGES[1]);
  for (let i = 18; i <= 23; i++) o(P(C.R, i), 'o');
  o([-C.gate, GY.south], 'o'); o([-C.gate, C.gateD], 'n'); o([C.gate, C.gateD], 'o'); o([C.gate, GY.south], 'o');
  for (let i = 25; i <= 29; i++) o(P(C.R, i), 'o');
  notch(LEDGES[0]);
  return out;
}
/** A LEDGE's outline (z ledgeH), counter-clockwise: its back against the cavern's wall, its sides and front over the low
 *  floor or the lake, its stairs' tops. */
export function deepLedge(L) {
  const m = L.m, out = [];
  for (let i = m - 2; i < m + 2; i++) out.push([...P(C.ledgeBack, i), 'w']);
  out.push([...P(C.ledgeBack, m + 2), 'o'], [...P(C.ledgeR, m + 2), 'r'], [...P(C.ledgeR, m + 1), 'o'], [...P(C.ledgeR, m), 'o'], [...P(C.ledgeR, m - 1), 'r'], [...P(C.ledgeR, m - 2), 'o']);
  return out;
}
/** The gates' floors (traversal, z 0): the south's from the mouth to the low floor, the north's to the exit. */
export const deepGate = (south) => (south
  ? [[-C.gate, 0, 'o'], [C.gate, 0, 'w'], [C.gate, C.gateD, 'n'], [-C.gate, C.gateD, 'w']]
  : [[-C.gate, C.len - C.gateD, 'n'], [C.gate, C.len - C.gateD, 'w'], [C.gate, C.len, 'o'], [-C.gate, C.len, 'w']]);
const plan = (poly) => poly.map(([x, y]) => [x, y]);

/** THE CAVERN'S PROFILE at y ([x, z] from the east wall's foot up over the vault to the west's): walls to wallH, the vault
 *  over them on the 32-ring. */
function profile(y) {
  const W = wallW(y), Hw = wallH(y), Hd = riseAt(y), out = [];
  for (const z of [C.foot, 1.2, 4.4, 7.0]) out.push([W, z]);
  for (let k = 0; k <= 16; k++) { const [c, s] = RINGS[32][k]; out.push([W * c, Hw + Hd * s]); }
  for (const z of [7.0, 4.4, 1.2, C.foot]) out.push([-W, z]);
  return out;
}
/** A STAIR's steps (the ramp through their nosings), its sides and the gold on each tread's open ends. */
function steps(m, st, edges, n) {
  const [a, b] = st.top, run = C.stair / n, rise = C.ledgeH / n, u = st.u, side = unit([b[0] - a[0], b[1] - a[1], 0]);
  const pt = (p, d, z) => [p[0] - u[0] * d, p[1] - u[1] * d, z];
  for (let k = 1; k <= n; k++) {
    const z = rise * (k - 1), d0 = C.stair - run * k, d1 = C.stair - run * (k - 1);
    if (k > 1) planeFace(m, [pt(a, d0, z), pt(b, d0, z), pt(b, d1, z), pt(a, d1, z)], FLOOR, { want: [0, 0, 1] });
    planeFace(m, [pt(a, d0, z), pt(b, d0, z), pt(b, d0, z + rise), pt(a, d0, z + rise)], ASHLAR, { want: [-u[0], -u[1], 0] });
    for (const [p, sg] of [[a, -1], [b, 1]]) {
      if (k > 1) planeFace(m, [pt(p, d0, 0), pt(p, d1, 0), pt(p, d1, z), pt(p, d0, z)], ASHLAR, { want: [sg * side[0], sg * side[1], 0] });
      const q = [p[0] - sg * side[0] * 0.1, p[1] - sg * side[1] * 0.1];
      planeFace(edges, [pt(p, d0, z + 0.012), pt(p, d1, z + 0.012), pt(q, d1, z + 0.012), pt(q, d0, z + 0.012)], EDGE, { want: [0, 0, 1] });
    }
  }
}
/** The open edges of an outline (deepLowFloor's kinds) at height z: an `open` marker over each, and THE EDGE LINE inset
 *  along each fall (`o`). */
function openEdges(add, edges, poly, z, label) {
  poly.forEach((p, k) => {
    const q = poly[(k + 1) % poly.length], kind = p[2];
    if (kind !== 'o' && kind !== 'r') return;
    boxFaces(add(refFragMesh(`open.${label}${k}`)), Math.min(p[0], q[0]) - 0.05, Math.max(0, Math.min(p[1], q[1]) - 0.05), z - 0.05, Math.max(p[0], q[0]) + 0.05, Math.min(C.len, Math.max(p[1], q[1]) + 0.05), z + 0.05);
    if (kind !== 'o') return;
    const d = unit([q[0] - p[0], q[1] - p[1], 0]), n = [-d[1] * 0.12, d[0] * 0.12];
    planeFace(edges, [[p[0], p[1], z + 0.012], [q[0], q[1], z + 0.012], [q[0] + n[0], q[1] + n[1], z + 0.012], [p[0] + n[0], p[1] + n[1], z + 0.012]], EDGE, { want: [0, 0, 1] });
  });
}

/**
 * THE DEEP CAVERNS' SCENE: every object, art and marker, in Blender's scene (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function heroDeepCavernsScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  const R = C.R, L = C.len, G = C.gate, HL = C.ledgeH, y0 = C.gateD, y1 = L - C.gateD;
  const low = deepLowFloor(), ledges = LEDGES.map((l) => deepLedge(l));

  // ── THE ART, in the Wellhead's dress
  // the low floor: the courts' plates in rings, its kerb of dressed stone round the rim, the gates' flags
  const floor = add(refFragMesh('Low_Floor', D));
  planeFace(floor, RINGS[32].map(([c, s]) => [4.5 * c, C.cy + 4.5 * s, 0]), ARENA);
  ringBand(floor, 0, C.cy, 4.5, 8.85, 0, 32, 0, 32, ARENA);
  ringBand(floor, 0, C.cy, 8.85, 9.15, 0, 32, 0, 32, IRON);   // the tide's gauge, an iron ring at 9 m
  ringBand(floor, 0, C.cy, 9.15, C.ledgeR, 0, 32, 0, 32, ARENA);
  for (const [a, b] of [[2, 14], [18, 30]]) { ringBand(floor, 0, C.cy, C.ledgeR, R - C.kerb, 0, 32, a, b, ARENA); ringBand(floor, 0, C.cy, R - C.kerb, R, 0, 32, a, b, ASHLAR); }
  for (const [ya, yb, sg] of [[0, y0, -1], [L, y1, 1]]) {
    planeFace(floor, [[-G, ya, 0], [G, ya, 0], [G, yb, 0], [-G, yb, 0]], FLOOR, { want: [0, 0, 1] });
    const ych = sg > 0 ? GY.north : GY.south;   // the rim's chords dip to the gate: the slivers between it and the gate's floor
    for (const s of [-1, 1]) planeFace(floor, [[0, yb, 0], [s * G, yb, 0], [s * G, ych, 0]], ASHLAR, { want: [0, 0, 1] });
  }
  // the shelf's rim down to the lake, under the kerb
  ringWall(floor, 0, C.cy, R, C.foot, 0, 32, 2, 7, ROCK); ringWall(floor, 0, C.cy, R, C.foot, 0, 32, 9, 14, ROCK);
  ringWall(floor, 0, C.cy, R, C.foot, 0, 32, 18, 23, ROCK); ringWall(floor, 0, C.cy, R, C.foot, 0, 32, 25, 30, ROCK);
  for (const [i, xg, gy] of [[7, G, GY.north], [9, -G, GY.north], [23, -G, GY.south], [25, G, GY.south]]) {
    const p = P(R, i);
    planeFace(floor, [[p[0], p[1], C.foot], [xg, gy, C.foot], [xg, gy, 0], [p[0], p[1], 0]], ROCK, { want: [p[0] + xg, p[1] + gy - 2 * C.cy, 0] });
    planeFace(floor, [[xg, gy, C.foot], [xg, gy > C.cy ? y1 : y0, C.foot], [xg, gy > C.cy ? y1 : y0, 0], [xg, gy, 0]], ROCK, { want: [xg, 0, 0] });
  }
  // THE EDGE LINE: every open rim (deepLowFloor's falls, the ledges', the gates' mouth and exit) and the stairs' treads
  const edges = add(refFragMesh('Edge_Lines', D));
  // THE LEDGES: their plates, their rock out of the lake and up to the wall, their stairs
  const rock = add(refFragMesh('Ledges', D));
  for (const [li, L0] of LEDGES.entries()) {
    const m = L0.m;
    levelPolygon(rock, plan(ledges[li]), HL, ARENA);
    for (let i = m - 2; i < m + 2; i++) { const [a, b] = [P(C.ledgeBack, i), P(C.ledgeBack, i + 1)], [c, d] = [P(23.5, i), P(23.5, i + 1)]; planeFace(rock, [[a[0], a[1], HL], [b[0], b[1], HL], [d[0], d[1], HL], [c[0], c[1], HL]], ROCK, { want: [0, 0, 1] }); }
    for (const [i, sg] of [[m - 2, -1], [m + 2, 1]]) {
      const [c, s] = RINGS[32][((i % 32) + 32) % 32], want = [-s * sg, c * sg, 0];
      const [a, b, e] = [P(C.ledgeR, i), P(R, i), P(23.5, i)];
      planeFace(rock, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HL], [a[0], a[1], HL]], ASHLAR, { want });
      planeFace(rock, [[b[0], b[1], C.foot], [e[0], e[1], C.foot], [e[0], e[1], HL], [b[0], b[1], HL]], ROCK, { want });
    }
    for (const [i, j] of [[m - 1, m], [m, m + 1]]) { const [a, b] = [P(C.ledgeR, i), P(C.ledgeR, j)]; planeFace(rock, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HL], [a[0], a[1], HL]], ASHLAR, { want: [-(a[0] + b[0]), 2 * C.cy - a[1] - b[1], 0] }); }
    for (const st of L0.stairs) steps(rock, st, edges, 8);
  }
  openEdges(add, edges, low, 0, 'low');
  ledges.forEach((l, k) => openEdges(add, edges, l, HL, k ? 'west' : 'east'));
  openEdges(add, edges, deepGate(true), 0, 'gatesouth');
  openEdges(add, edges, deepGate(false), 0, 'gatenorth');
  // the magma lake, 0.8 m under the rim, lapping the cavern's walls; the lava falls down the walls into it and the glow at
  // their feet
  const lake = add(refFragMesh('Lake', D));
  const ys = [y0, 3, 4.5, 6.5, 9, 11.5, 14, 16.5, 19.5, 22, 24.5, 27, 29.5, 31.5, 33, y1];
  grid(lake, 12, ys.length - 1, (i, j) => { const w = wallW(ys[j]) + 0.6; return [-w + (2 * w * i) / 12, ys[j], C.lake + 0.06 * (fbm2(SEED + 9, i * 0.7, j * 0.7) - 0.5)]; }, MOLTEN, { uv: (i, j, p) => [p[0] * 0.25, p[1] * 0.25] });
  for (const [s, y, w] of [[1, 6.5, 1.2], [-1, 6.5, 1.2], [1, 29.5, 1.2], [-1, 29.5, 1.2], [1, 3.6, 0.7], [-1, 32.4, 0.7]]) {
    const x = s * (wallW(y) - 0.05), top = wallH(y) - 0.3;
    planeFace(lake, [[x, y - w, C.lake], [x, y + w, C.lake], [x, y + w * 0.7, top], [x, y - w * 0.7, top]], MOLTEN, { want: [-s, 0, 0], uv: (p) => [p[1] * 0.5, p[2] * 0.25] });
    levelDisc(lake, x - s * w, y, C.lake + 0.04, w, 12, MOLTEN);
  }
  // THE CAVERN: its walls and vault of rough basalt from gate to gate, pushed out by noise (nought at its ends, where the
  // gates' faces meet it), coursed where the lake laps it and dark at its crown
  const cave = add(refFragMesh('Cavern', D));
  const prof = profile(0), np = prof.length;
  grid(cave, np - 1, ys.length - 1, (i, j) => {
    const y = ys[j], pr = profile(y), [x, z] = pr[i], e = j === 0 || j === ys.length - 1 ? 0 : 1;
    const a = pr[Math.max(0, i - 1)], b = pr[Math.min(np - 1, i + 1)], n = unit([b[1] - a[1], -(b[0] - a[0]), 0]);   // the profile's normal, out
    const d = e * (i < 4 || i > np - 5 ? 1.2 : 1.0) * fbm2(SEED + 1, i * 0.6, y * 0.4, 4);
    return [x + n[0] * d, y, z + n[1] * d];
  }, ROCK, { uv: (i, j, p) => [p[1] * 0.25, Math.max(0.42, 0.94 - (0.52 * (p[2] - C.lake)) / 17)] });   // the root's courses, never its welded band
  // the gates' inner faces where the cavern ends, round each gate (outlineLoops - the cavern's own end profile its outline)
  const gateRect = [[-G, 0], [G, 0], [G, C.gateH], [-G, C.gateH]];
  for (const [y, w] of [[y0, [0, 1, 0]], [y1, [0, -1, 0]]]) { const [ia, oa] = outlineLoops(0, 3, gateRect, profile(y)); rockFace(cave, y, ia, oa, ROCK, w); }
  // the columns and stumps of basalt standing out of the lake, and stalactites over it
  for (const [i, r, h] of [[5, 17.6, 14], [11, 17.6, 14], [21, 17.6, 14], [27, 17.6, 14], [3, 19, 4.2], [13, 19, 3.1], [19, 19, 3.6], [29, 19, 4.8]]) {
    const [x, y] = P(r, i), tall = h > 10;
    lathe(cave, x, y, tall ? [[1.3, C.foot], [0.95, -0.4], [0.78, 2.5], [0.72, 6], [0.82, 9.5], [1.25, h]] : [[1.1, C.foot], [0.85, -0.3], [0.7, h - 0.8], [0.45, h]], 12, ROCK, { top: !tall });
  }
  for (let k = 0; k < 10; k++) {
    const y = 6 + 24 * hash01(SEED, k, 1), w = wallW(y) * (0.25 + 0.6 * hash01(SEED, k, 2)) * (hash01(SEED, k, 3) < 0.5 ? -1 : 1);
    const zt = wallH(y) + riseAt(y) * 0.5;
    lathe(cave, w, y, [[0.05, 9.6 + hash01(SEED, k, 4)], [0.35, zt - 0.6], [0.55, zt + 1.6]], 8, ROCK, { top: false });
  }
  // THE GATES: their iron frames and gables in the cavern's face, their passages through it, the face itself round them
  // (rockFaceLoops - the rock mass's end ring), the alcove's niche in the south passage's east wall
  const gates = add(refFragMesh('Gates', D));
  const PORTAL = [[-2.5, -1.0], [2.5, -1.0], [2.5, 6.5], [0, 8.4], [-2.5, 6.5]], FC = [0, 3], MASS = { a: 13, up: 11, down: 10 };
  const niche = { y0: 0.2, y1: 1.8, d: 2.2, h: 2.6 };
  for (const [y, fy, yi] of [[0, -1, y0], [L, 1, y1]]) {
    const want = [0, fy, 0];
    const [ia, oa] = rockFaceLoops(FC[0], FC[1], PORTAL, MASS.a, MASS.up, MASS.down);
    rockFace(gates, y, ia, oa, ROCK, want);
    const q = (x0, z0, x1, z1, mat) => planeFace(gates, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], mat, { want });
    q(-2.5, -1.0, -G, 6.5, IRON); q(G, -1.0, 2.5, 6.5, IRON); q(-G, C.gateH, G, 6.5, IRON); q(-G, -1.0, G, 0, ASHLAR);
    planeFace(gates, [[-2.5, y, 6.5], [2.5, y, 6.5], [0, y, 8.4]], ASHLAR, { want });
    for (const s of [-1, 1]) {
      if (s > 0 && fy < 0) {   // the niche's opening in the south passage's east wall
        for (const [ya, yb, za, zb] of [[0, niche.y0, 0, C.gateH], [niche.y0, niche.y1, niche.h, C.gateH], [niche.y1, y0, 0, C.gateH]]) planeFace(gates, [[G, ya, za], [G, yb, za], [G, yb, zb], [G, ya, zb]], ASHLAR, { want: [-1, 0, 0] });
        const nx = G + niche.d;
        planeFace(gates, [[G, niche.y0, 0], [nx, niche.y0, 0], [nx, niche.y1, 0], [G, niche.y1, 0]], FLOOR, { want: [0, 0, 1] });
        planeFace(gates, [[nx, niche.y0, 0], [nx, niche.y1, 0], [nx, niche.y1, niche.h], [nx, niche.y0, niche.h]], ASHLAR, { want: [-1, 0, 0] });
        for (const [yy, w] of [[niche.y0, 1], [niche.y1, -1]]) planeFace(gates, [[G, yy, 0], [nx, yy, 0], [nx, yy, niche.h], [G, yy, niche.h]], ASHLAR, { want: [0, w, 0] });
        planeFace(gates, [[G, niche.y0, niche.h], [nx, niche.y0, niche.h], [nx, niche.y1, niche.h], [G, niche.y1, niche.h]], ROCK, { want: [0, 0, -1] });
        lathe(gates, nx - 0.5, (niche.y0 + niche.y1) / 2, [[0.25, 0], [0.18, 0.6], [0.35, 0.75], [0.4, 0.95]], 8, ASHLAR, { top: false });
        levelDisc(gates, nx - 0.5, (niche.y0 + niche.y1) / 2, 0.88, 0.37, 8, MOLTEN);
      } else planeFace(gates, [[s * G, Math.min(y, yi), 0], [s * G, Math.max(y, yi), 0], [s * G, Math.max(y, yi), C.gateH], [s * G, Math.min(y, yi), C.gateH]], ASHLAR, { want: [-s, 0, 0] });
    }
    planeFace(gates, [[-G, Math.min(y, yi), C.gateH], [G, Math.min(y, yi), C.gateH], [G, Math.max(y, yi), C.gateH], [-G, Math.max(y, yi), C.gateH]], IRON, { want: [0, 0, -1] });
  }
  // THE SLUICE (the kit's engine): an iron gate on the lake's edge by the north-west, its wheel and its frame
  const [sx, sy] = P(17.4, 11), [sc, ss] = RINGS[32][11];
  for (const k of [-1, 1]) boxFaces(gates, sx - ss * k * 1.2 - 0.12, sy + sc * k * 1.2 - 0.12, C.foot, sx - ss * k * 1.2 + 0.12, sy + sc * k * 1.2 + 0.12, 3.4, IRON, { skip: '-z' });
  boxFaces(gates, sx - 1.3, sy - 0.12, 3.2, sx + 1.3, sy + 0.12, 3.5, IRON);
  ringWall(gates, sx, sy, 0.9, 0.1, 3.0, 12, 0, 12, IRON);
  levelDisc(gates, sx, sy, 3.0, 0.9, 12, IRON);
  // the rock mass's hull from gate to gate: its flanks and crown swelling round the cavern, its torn keel
  const [, , dirs] = rockFaceLoops(FC[0], FC[1], PORTAL, MASS.a, MASS.up, MASS.down);
  const st = [0, 1.5, 3.5, 6, 9, 12, 15, 18, 21, 24, 27, 30, 32.5, 34.5, L], last = st.length - 1;
  const bh = (y) => { const t = (y - C.cy) / C.cy; return Math.sqrt(Math.max(0, 1 - t * t)); };
  rockHull(add(refFragMesh('Hull', D)), FC[0], FC[1], dirs, st, (j) => [MASS.a + 13 * bh(st[j]), MASS.up + 7 * bh(st[j]), MASS.down + 4 * bh(st[j])],
    (k, j) => (j === 0 || j === last ? 0 : (dirs[k][1] < -0.5 ? 1.5 + 3.5 * fbm2(SEED + 3, k * 0.7, st[j] * 0.4, 4) : 0.4 + 1.5 * fbm2(SEED + 3, k * 0.7, st[j] * 0.4, 4))), ROCK);

  // ── THE LAW, as named markers
  planeFace(add(refFragMesh('socket.in')), [[-G, 0, 0], [G, 0, 0], [G, 0, C.gateH], [-G, 0, C.gateH]], 0, { want: [0, -1, 0] });
  planeFace(add(refFragMesh('socket.out.main')), [[-G, L, 0], [G, L, 0], [G, L, C.gateH], [-G, L, C.gateH]], 0, { want: [0, 1, 0] });
  levelPolygon(add(refFragMesh('floor.gatesouth')), plan(deepGate(true)), 0);
  levelPolygon(add(refFragMesh('floor.gatenorth')), plan(deepGate(false)), 0);
  levelPolygon(add(refFragMesh('floor.fight.low')), plan(low), 0);
  levelPolygon(add(refFragMesh('floor.fight.east')), plan(ledges[0]), HL);
  levelPolygon(add(refFragMesh('floor.fight.west')), plan(ledges[1]), HL);
  for (const [k, L0] of LEDGES.entries()) for (const [j, s] of L0.stairs.entries()) planeFace(add(refFragMesh(`ramp.${k ? 'west' : 'east'}${j ? 'north' : 'south'}`)), [[...s.top[0], HL], [...s.top[1], HL], [...s.foot[1], 0], [...s.foot[0], 0]], 0, { want: [0, 0, 1] });
  planeFace(add(refFragMesh('ceil.cavern')), [[-23, 0, C.ceil], [23, 0, C.ceil], [23, L, C.ceil], [-23, L, C.ceil]], 0, { want: [0, 0, -1] });
  planeFace(add(refFragMesh('ceil.gatesouth')), [[-G, 0, C.gateH], [G, 0, C.gateH], [G, y0, C.gateH], [-G, y0, C.gateH]], 0, { want: [0, 0, -1] });
  planeFace(add(refFragMesh('ceil.gatenorth')), [[-G, y1, C.gateH], [G, y1, C.gateH], [G, L, C.gateH], [-G, L, C.gateH]], 0, { want: [0, 0, -1] });
  const foot = (s, d) => [r4(s.u[0] * d), r4(C.cy + s.u[1] * d)];
  const N = { mouth: [0, 1.0, 0], south: [0, 6, 0], centre: [0, C.cy, 0], north: [0, 30, 0], exit: [0, 35, 0], ne: [...P(9, 4), 0], nw: [...P(9, 12), 0], sw: [...P(9, 20), 0], se: [...P(9, 28), 0] };
  for (const [k, L0] of LEDGES.entries()) {
    const side = k ? 'west' : 'east';
    N[side] = [...P(17, L0.m), HL];
    L0.stairs.forEach((s, j) => { N[`${side}foot${j}`] = [...foot(s, 7.6), 0]; N[`${side}top${j}`] = [...foot(s, 14.6), HL]; });
  }
  for (const [k, p] of Object.entries(N)) levelDisc(add(refFragMesh(`node.${k}`)), p[0], p[1], p[2], 0.5);
  const E = [['mouth', 'south'], ['south', 'centre'], ['centre', 'north'], ['north', 'exit'], ['south', 'se'], ['south', 'sw'], ['north', 'ne'], ['north', 'nw'], ['se', 'centre'], ['sw', 'centre'], ['ne', 'centre'], ['nw', 'centre']];
  for (const side of ['east', 'west']) for (const j of [0, 1]) E.push(['centre', `${side}foot${j}`], [`${side}foot${j}`, `${side}top${j}`], [`${side}top${j}`, side]);
  for (const [a, b] of E) walkEdge(add(refFragMesh(`edge.${a}-${b}`)), N[a], N[b], 0.2);
  const cube = (name, [x, y], z, s = 0.3) => boxFaces(add(refFragMesh(name)), x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  for (const [k, i] of [['a', 4], ['b', 6], ['c', 12], ['d', 20], ['e', 28]]) cube(`anchor.rift.${k}`, P(12, i), 0);
  cube('anchor.caster.east', P(17, 1), HL);
  cube('anchor.caster.west', P(17, 15), HL);
  for (const [k, i] of [['north', 7], ['south', 23], ['west', 10]]) cube(`anchor.lurker.${k}`, P(14.5, i), 0);
  cube('anchor.engine.sluice', P(14.6, 11), 0);
  // THE SIGNATURE: the magma tide over the whole low floor - a disc of r 16 about its middle (its law's 60 s, 5 s told, 15 s
  // up), the ledges and the gates dry
  levelDisc(add(refFragMesh('hazard.tide.pool.ph12000')), 0, C.cy, 0, R, 32);
  boxFaces(add(refFragMesh('alcove.seam.lumen.gate')), G + 0.1, niche.y0, 0, G + niche.d, niche.y1, niche.h);
  cube('light.lava.fallse', [wallW(6.5) - 2.5, 6.5], 5.5, 0.2);
  cube('light.lava.fallnw', [-(wallW(29.5) - 2.5), 29.5], 5.5, 0.2);
  cube('light.band.east', P(16.5, 0), 6.8, 0.2);
  cube('light.band.west', P(16.5, 16), 6.8, 0.2);
  // THE COLLIDER'S PROXY: the floors, ledges and stairs, the ledges' faces, the gates' passages and the niche, the cavern's
  // walls as planes and the clamp's own ceiling over them - never the drawn mesh
  const PX = add(refFragMesh('collider.proxy'));
  levelPolygon(PX, plan(low), 0); levelPolygon(PX, plan(deepGate(true)), 0); levelPolygon(PX, plan(deepGate(false)), 0);
  for (const l of ledges) levelPolygon(PX, plan(l), HL);
  for (const L0 of LEDGES) {
    for (const s of L0.stairs) {
      planeFace(PX, [[...s.top[0], HL], [...s.top[1], HL], [...s.foot[1], 0], [...s.foot[0], 0]], 0, { want: [0, 0, 1] });
      for (const k of [0, 1]) planeFace(PX, [[...s.top[k], 0], [...s.foot[k], 0], [...s.top[k], HL]], 0);
    }
    const m = L0.m;
    for (const [i, j] of [[m - 1, m], [m, m + 1]]) { const [a, b] = [P(C.ledgeR, i), P(C.ledgeR, j)]; planeFace(PX, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HL], [a[0], a[1], HL]], 0); }
    for (const i of [m - 2, m + 2]) { const [a, b] = [P(C.ledgeR, i), P(R, i)]; planeFace(PX, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HL], [a[0], a[1], HL]], 0); }
  }
  for (const [ya, yb] of [[0, y0], [y1, L]]) {
    for (const s of [-1, 1]) {
      if (s > 0 && ya === 0) {
        for (const [a, b, za] of [[0, niche.y0, 0], [niche.y0, niche.y1, niche.h], [niche.y1, y0, 0]]) planeFace(PX, [[G, a, za], [G, b, za], [G, b, C.gateH], [G, a, C.gateH]], 0);
        const nx = G + niche.d;
        boxFaces(PX, G, niche.y0, 0, nx, niche.y1, niche.h, 0, { skip: '-x' });
      } else planeFace(PX, [[s * G, ya, 0], [s * G, yb, 0], [s * G, yb, C.gateH], [s * G, ya, C.gateH]], 0);
    }
    planeFace(PX, [[-G, ya, C.gateH], [G, ya, C.gateH], [G, yb, C.gateH], [-G, yb, C.gateH]], 0, { want: [0, 0, -1] });
  }
  for (let j = 0; j + 1 < ys.length; j++) for (const s of [-1, 1]) planeFace(PX, [[s * wallW(ys[j]), ys[j], C.foot], [s * wallW(ys[j + 1]), ys[j + 1], C.foot], [s * wallW(ys[j + 1]), ys[j + 1], C.ceil], [s * wallW(ys[j]), ys[j], C.ceil]], 0, { want: [-s, 0, 0] });
  for (const y of [y0, y1]) planeFace(PX, [[-wallW(y), y, C.gateH], [wallW(y), y, C.gateH], [wallW(y), y, C.ceil], [-wallW(y), y, C.ceil]], 0);
  planeFace(PX, [[-21, y0, C.ceil], [21, y0, C.ceil], [21, y1, C.ceil], [-21, y1, C.ceil]], 0, { want: [0, 0, -1] });
  return out;
}

/** THE FILE: the scene written as the reference is (tools/egRefFragScene.mjs writeRefFragFbx - Blender's exporter's way). */
export const writeHeroDeepCavernsFbx = (scene = heroDeepCavernsScene()) => writeRefFragFbx(scene);

if (isMain(import.meta.url)) {
  const outPath = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, HERO_DEEP_CAVERNS_FBX));
  const bytes = writeHeroDeepCavernsFbx();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  console.log(`${outPath}: ${heroDeepCavernsScene().length} objects, ${bytes.length} bytes`);
}
