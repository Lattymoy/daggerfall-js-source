// THE CLAN PIT - the Havoc Wellhead's hero chamber, a scene written from numbers alone.
//
//     node tools/egHeroClanPitScene.mjs [--out=src/assets/egfrags/source/egheroClanPit.fbx]
//
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2, 11.4
// and 11.6). The Wellhead's arena of honourable fights between clans: a pit sunk in basalt, its two grandstands full of Kyn,
// its two gate towers, the chieftains' dais where the Casters stand, and over the far gate the Honour Horn. Written on the
// authoring kit (tools/egHeroKit.mjs) and the reference's mesh and writer (tools/egRefFragScene.mjs refFragMesh,
// writeRefFragFbx) - no game data, no third-party art, no trigonometry - and committed as the .fbx tools/fragBake.mjs bakes
// (tools/bakeEgHeroClanPit.mjs). Re-run it and the same bytes come out (test/tooling/eghero_wellhead.test.js holds it to them).
//
// THE ENVELOPE - net/eliteGates/egFragLaw.js egFragChamber('clanpit', r, R) as the halls call it (the court disc it stands in for):
//   frame      1 unit 1 m, Z up, the course along +Y; the mouth at Y 0 centred on X 0, the exit at Y 36
//   fight      the pit's floor a circle of R 16 m (the Deepway's chamber, net/eliteGates/egLaw.js `deepway`: R 1600) about (0, 18),
//              open to the burning sky (the kit's reverb, `quarry`); THE HONOUR HORN's ring (r 6 - section 11.2, the hall's
//              `horn` spot at the chamber's middle) set in it in iron
//   mouth      the court's bridge (BRIDGE_HALF 200): a gate 4 m wide and 6 m high through the south tower, onto the pit's
//              floor (it runs on to the mouth); the exit the same through the north tower, at the mouth's height
//   play       `balcony` (section 11.4): the chieftains' dais, a second fight floor 3.2 m up at the pit's east side (R 12 to 19,
//              22.5 degrees either way), on two stairs, where the Casters stand
//   box        X -22.5 to 22.5, Y 0 to 36, Z -14.1 to 12.9 (the rock's torn keel to the Honour Horn's bell)
// THE PLACE: the pit's wall of dressed basalt 3.2 m high; on it, east and west, five tiers of the clans' grandstands rising to
// an iron-railed parapet at 8 m, rows of Kyn standing on every tier and their banners over the top; north and south, the
// gate towers 9.5 m high, battlemented, their faces to the void; the dais and its two stairs, gold at every open rim; four
// braziers where the stands meet the towers; the Honour Horn on the north tower, its bell over the pit; a shrine's niche in
// the west wall (the alcove); the rock's keel hanging into the void. No inner course (EG_FRAG_PIECES names none for the
// kit), no ceiling, no hazard of the place's: the Honour Horn is the hall's spot, the Ashfall the crowd's.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';
import { RINGS, r4, unit, hash01, fbm2, grid, lathe, planeFace, boxFaces, walkEdge, levelDisc, ringBand, ringWall, levelPolygon } from './egHeroKit.mjs';

/** Where the scene is committed. */
export const HERO_CLAN_PIT_FBX = 'src/assets/egfrags/source/egheroClanPit.fbx';
/** THE ENVELOPE (m): the pit's middle, its fight floor's radius, the length; the gates' half-width and height; the dais
 *  (its front's and back's radii, its height) and its stairs' run; the towers' height; the tiers (their foot, depth and
 *  rise, five of them), the parapet's top. */
export const CLAN_PIT = Object.freeze({
  cy: 18, R: 16, len: 36, gate: 2, gateH: 6, daisR: 12, daisBack: 19, daisH: 3.2, stair: 5.6, tower: 9.5,
  tier0: 16, tierD: 1.3, tierH: 0.9, tiers: 5, parapet: 8.0, keel: -13,
});
const C = CLAN_PIT;
const SEED = 0x7c02;
const D = Object.freeze(['floor', 'brass', 'root', 'arena', 'cobble', 'edge', 'molten', 'pillar']);
const [FLOOR, IRON, ROCK, ARENA, COBBLE, EDGE, MOLTEN, ASHLAR] = [0, 1, 2, 3, 4, 5, 6, 7];

/** A point at radius r on bearing i of the 32-ring about the pit's middle ([x, y]). */
const P = (r, i) => { const [c, s] = RINGS[32][((i % 32) + 32) % 32]; return [r4(r * c), r4(C.cy + r * s)]; };
/** The unit direction a fraction f of the way from ring bearing i to i + 1. */
const dirAt = (i, f) => { const [a, b] = [RINGS[32][((i % 32) + 32) % 32], RINGS[32][(((i + 1) % 32) + 32) % 32]], u = unit([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0]); return [u[0], u[1]]; };
const at = (d, r) => [r4(d[0] * r), r4(C.cy + d[1] * r)];
/** Where the chord from ring bearing i to j at radius R meets x = xg (a gate's side): its y. */
function chordY(i, j, xg) { const [a, b] = [P(C.R, i), P(C.R, j)]; return r4(a[1] + ((b[1] - a[1]) * (xg - a[0])) / (b[0] - a[0])); }
const GY = Object.freeze({ south: chordY(23, 24, -C.gate), north: chordY(7, 8, C.gate) });
/** A stair on the dais's chord from bearing i to i + 1 (r daisR): its top corners, its foot corners, its axis (inward
 *  from the chord's middle) - a rectangle on the radial through the chord's middle. */
function stairOf(i) {
  const a = P(C.daisR, i), b = P(C.daisR, i + 1), u = unit([a[0] + b[0], a[1] + b[1] - 2 * C.cy, 0]);
  const foot = (p) => [r4(p[0] - u[0] * C.stair), r4(p[1] - u[1] * C.stair)];
  return { top: [a, b], foot: [foot(a), foot(b)], u: [u[0], u[1]] };
}
const STAIR_S = stairOf(30), STAIR_N = stairOf(1);
/** THE PIT'S FLOOR (fight, z 0), counter-clockwise: the circle, its two gates run out to the mouth and the exit, notched by
 *  the dais's front and its two stairs. */
export function clanArena() {
  const out = [];
  for (let i = 2; i <= 7; i++) out.push(P(C.R, i));
  out.push([C.gate, GY.north], [C.gate, C.len], [-C.gate, C.len], [-C.gate, GY.north]);
  for (let i = 9; i <= 23; i++) out.push(P(C.R, i));
  out.push([-C.gate, GY.south], [-C.gate, 0], [C.gate, 0], [C.gate, GY.south]);
  for (let i = 25; i <= 30; i++) out.push(P(C.R, i));
  out.push(P(C.daisR, 30), STAIR_S.foot[0], STAIR_S.foot[1], P(C.daisR, 31), P(C.daisR, 0), P(C.daisR, 1), STAIR_N.foot[0], STAIR_N.foot[1], P(C.daisR, 2));
  return out;
}
/** THE CHIEFTAINS' DAIS (fight, z daisH), counter-clockwise: its back against the stands, its front over the pit. */
export const clanDais = () => [P(C.R, 30), P(C.daisBack, 31), P(C.daisBack, 0), P(C.daisBack, 1), P(C.R, 2), P(C.daisR, 2), P(C.daisR, 1), P(C.daisR, 0), P(C.daisR, 31), P(C.daisR, 30)];

/** A STAIR's steps (ten, the ramp through their nosings), its sides and the gold along each tread's open ends. */
function steps(m, st, edges) {
  const [a, b] = st.top, n = 10, run = C.stair / n, rise = C.daisH / n, u = st.u;
  const pt = (p, d, z) => [p[0] - u[0] * d, p[1] - u[1] * d, z];
  const side = [unit([b[0] - a[0], b[1] - a[1], 0])];
  for (let k = 1; k <= n; k++) {
    const z = rise * (k - 1), d0 = C.stair - run * k, d1 = C.stair - run * (k - 1);
    if (k > 1) planeFace(m, [pt(a, d0, z), pt(b, d0, z), pt(b, d1, z), pt(a, d1, z)], FLOOR, { want: [0, 0, 1] });
    planeFace(m, [pt(a, d0, z), pt(b, d0, z), pt(b, d0, z + rise), pt(a, d0, z + rise)], ASHLAR, { want: [-u[0], -u[1], 0] });
    for (const [p, sg] of [[a, -1], [b, 1]]) {
      if (k > 1) planeFace(m, [pt(p, d0, 0), pt(p, d1, 0), pt(p, d1, z), pt(p, d0, z)], ASHLAR, { want: [sg * side[0][0], sg * side[0][1], 0] });
      const q = [p[0] - sg * side[0][0] * 0.1, p[1] - sg * side[0][1] * 0.1];
      planeFace(edges, [pt(p, d0, z + 0.012), pt(p, d1, z + 0.012), pt(q, d1, z + 0.012), pt(q, d0, z + 0.012)], EDGE, { want: [0, 0, 1] });
    }
  }
  return m;
}
/** A KYN of the crowd standing at `p` ([x, y]) on a tier at height z, facing the pit along -`u`: a body and a horned head,
 *  their sizes their own (hash). */
function kyn(m, p, z, u, k) {
  const t = [-u[1], u[0]], h = 0.95 + 0.3 * hash01(SEED, k, 1), w = 0.22 + 0.06 * hash01(SEED, k, 2);
  const box = (cw, cd, z0, z1, mat, skip = '') => {
    const c = (sw, sd, zz) => [p[0] + t[0] * sw * cw + u[0] * sd * cd, p[1] + t[1] * sw * cw + u[1] * sd * cd, zz];
    planeFace(m, [c(-1, -1, z0), c(1, -1, z0), c(1, -1, z1), c(-1, -1, z1)], mat, { want: [-u[0], -u[1], 0] });
    if (!skip.includes('b')) planeFace(m, [c(1, 1, z0), c(-1, 1, z0), c(-1, 1, z1), c(1, 1, z1)], mat, { want: [u[0], u[1], 0] });
    planeFace(m, [c(-1, 1, z0), c(-1, -1, z0), c(-1, -1, z1), c(-1, 1, z1)], mat, { want: [-t[0], -t[1], 0] });
    planeFace(m, [c(1, -1, z0), c(1, 1, z0), c(1, 1, z1), c(1, -1, z1)], mat, { want: [t[0], t[1], 0] });
    planeFace(m, [c(-1, -1, z1), c(1, -1, z1), c(1, 1, z1), c(-1, 1, z1)], mat, { want: [0, 0, 1] });
  };
  box(w, 0.16, z, z + h, IRON, 'b');
  box(0.12, 0.12, z + h, z + h + 0.28, COBBLE, 'b');
  for (const s of [-1, 1]) planeFace(m, [[p[0] + t[0] * s * 0.1, p[1] + t[1] * s * 0.1, z + h + 0.2], [p[0] + t[0] * s * 0.3, p[1] + t[1] * s * 0.3, z + h + 0.48], [p[0] + t[0] * s * 0.12, p[1] + t[1] * s * 0.12, z + h + 0.28]], IRON, { want: [-u[0], -u[1], 0] });
}
/** THE PIT'S WALL over ring bearings i0 to i1 (r R) from z0 to z1, every other segment (from `odd`) holding a furnace
 *  grate from gz0 to gz1: molten iron 0.18 m behind the wall's face in an iron reveal, two bars across it. */
function gratedWall(m, i0, i1, z0, z1, gz0, gz1, odd = 0) {
  for (let i = i0; i < i1; i++) {
    if ((i - i0) % 2 !== odd) { ringWall(m, 0, C.cy, C.R, z0, z1, 32, i, i + 1, ASHLAR, { inward: true }); continue; }
    ringWall(m, 0, C.cy, C.R, z0, gz0, 32, i, i + 1, ASHLAR, { inward: true });
    ringWall(m, 0, C.cy, C.R, gz1, z1, 32, i, i + 1, ASHLAR, { inward: true });
    const a = P(C.R, i), b = P(C.R, i + 1), u = unit([a[0] + b[0], a[1] + b[1] - 2 * C.cy, 0]), want = [-u[0], -u[1], 0];
    const lp = (f, d = 0) => [a[0] + (b[0] - a[0]) * f + u[0] * d, a[1] + (b[1] - a[1]) * f + u[1] * d];
    const q = (p0, p1, za, zb, mat, w = want) => planeFace(m, [[p0[0], p0[1], za], [p1[0], p1[1], za], [p1[0], p1[1], zb], [p0[0], p0[1], zb]], mat, { want: w });
    q(lp(0), lp(0.22), gz0, gz1, ASHLAR); q(lp(0.78), lp(1), gz0, gz1, ASHLAR);
    q(lp(0.22, 0.18), lp(0.78, 0.18), gz0, gz1, MOLTEN);
    q(lp(0.22), lp(0.22, 0.18), gz0, gz1, IRON, [b[0] - a[0], b[1] - a[1], 0]); q(lp(0.78, 0.18), lp(0.78), gz0, gz1, IRON, [a[0] - b[0], a[1] - b[1], 0]);
    for (const [z, w] of [[gz0, [0, 0, 1]], [gz1, [0, 0, -1]]]) planeFace(m, [[...lp(0.22), z], [...lp(0.78), z], [...lp(0.78, 0.18), z], [...lp(0.22, 0.18), z]], IRON, { want: w });
    for (const f of [0.41, 0.59]) q(lp(f - 0.025, 0.06), lp(f + 0.025, 0.06), gz0, gz1, IRON);
  }
  return m;
}
/** A TUBE along `path` ([[x, y, z], ...]) whose radius grows by `radii`, on ring n - the Honour Horn: smooth round and
 *  along it, its rings square to the path (their up the world's Z unless the path stands upright). */
function tube(m, path, radii, n, mat) {
  const ring = RINGS[n];
  const frames = path.map((p, k) => {
    const a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)], tt = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const up0 = Math.abs(tt[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
    const rt = unit([tt[1] * up0[2] - tt[2] * up0[1], tt[2] * up0[0] - tt[0] * up0[2], tt[0] * up0[1] - tt[1] * up0[0]]);
    const up = [rt[1] * tt[2] - rt[2] * tt[1], rt[2] * tt[0] - rt[0] * tt[2], rt[0] * tt[1] - rt[1] * tt[0]];
    return { rt, up };
  });
  const pos = (k, i) => [0, 1, 2].map((c) => r4(path[k][c] + (frames[k].rt[c] * ring[i][0] + frames[k].up[c] * ring[i][1]) * radii[k]));
  const nor = (k, i) => unit([0, 1, 2].map((c) => frames[k].rt[c] * ring[i][0] + frames[k].up[c] * ring[i][1]));
  for (let k = 0; k + 1 < path.length; k++) for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n, q = [[k, i1], [k, i], [k + 1, i], [k + 1, i1]];
    m.face(q.map(([a, b]) => pos(a, b)), mat, q.map(([a, b]) => [nor(a, b), [r4(b / n), r4(a / 4)]]));
  }
  return m;
}

/**
 * THE CLAN PIT'S SCENE: every object, art and marker, in Blender's scene (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function heroClanPitScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  const R = C.R, L = C.len, G = C.gate, HD = C.daisH, T = C.tower;
  const tierZ = (k) => HD + C.tierH * k, tierR = (k) => C.tier0 + C.tierD * k;
  const zBox = tierZ(3);   // the chieftains' box's top behind the dais: the fourth tier's height
  const niche = { i: 18, depth: 2.4, h: 2.6 };

  // ── THE ART, in the Wellhead's dress
  // the pit's floor: the courts' plates in rings, the Honour Horn's ring of iron at r 6, a slag border along the wall; the
  // gates' floors of flags
  const floor = add(refFragMesh('Pit_Floor', D));
  planeFace(floor, RINGS[32].map(([c, s]) => [2.5 * c, C.cy + 2.5 * s, 0]), ARENA);
  ringBand(floor, 0, C.cy, 2.5, 5.85, 0, 32, 0, 32, ARENA);
  ringBand(floor, 0, C.cy, 5.85, 6.15, 0, 32, 0, 32, IRON);
  ringBand(floor, 0, C.cy, 6.15, C.daisR, 0, 32, 0, 32, ARENA);
  ringBand(floor, 0, C.cy, C.daisR, 15.2, 0, 32, 2, 30, ARENA);
  ringBand(floor, 0, C.cy, 15.2, R, 0, 32, 2, 30, COBBLE);
  for (const [ya, yb, yc] of [[0, GY.south, P(R, 24)[1]], [L, GY.north, P(R, 8)[1]]]) {
    const w = ya === 0 ? [0, 0, 1] : [0, 0, 1];
    planeFace(floor, [[-G, ya, 0], [0, ya, 0], [0, yc, 0], [-G, yb, 0]], FLOOR, { want: w });
    planeFace(floor, [[0, ya, 0], [G, ya, 0], [G, yb, 0], [0, yc, 0]], FLOOR, { want: w });
  }
  // THE EDGE LINE: the mouth's and the exit's rims, the dais's open front and sides, every stair tread's open ends
  const edges = add(refFragMesh('Edge_Lines', D));
  for (const [ya, yb] of [[0, 0.12], [L - 0.12, L]]) planeFace(edges, [[-G, ya, 0.012], [G, ya, 0.012], [G, yb, 0.012], [-G, yb, 0.012]], EDGE);
  ringBand(edges, 0, C.cy, C.daisR, C.daisR + 0.12, HD + 0.012, 32, 31, 33, EDGE);
  for (const [i, sg] of [[2, -1], [30, 1]]) {
    const [c, s] = RINGS[32][i % 32], t = [-s * sg, c * sg];
    const a = P(C.daisR, i), b = P(R, i);
    planeFace(edges, [[a[0], a[1], HD + 0.012], [b[0], b[1], HD + 0.012], [b[0] + t[0] * 0.12, b[1] + t[1] * 0.12, HD + 0.012], [a[0] + t[0] * 0.12, a[1] + t[1] * 0.12, HD + 0.012]], EDGE, { want: [0, 0, 1] });
  }
  // the pit's wall, dressed basalt 3.2 m high under the stands (broken at the shrine's niche), 9.5 m under the towers
  // (broken by their gates)
  const walls = add(refFragMesh('Pit_Walls', D));
  const iw = { inward: true };
  gratedWall(walls, 2, 4, 0, HD, 1.0, 2.0, 1);
  gratedWall(walls, 28, 30, 0, HD, 1.0, 2.0);
  gratedWall(walls, 12, niche.i, 0, HD, 1.0, 2.0, 1);
  ringWall(walls, 0, C.cy, R, niche.h, HD, 32, niche.i, niche.i + 1, ASHLAR, iw);
  gratedWall(walls, niche.i + 1, 20, 0, HD, 1.0, 2.0);
  for (const [i0, i1, ig, gy, sg] of [[4, 12, 7, GY.north, 1], [20, 28, 23, GY.south, -1]]) {
    gratedWall(walls, i0, ig, 0, T, 6.9, 7.9);
    gratedWall(walls, ig + 2, i1, 0, T, 6.9, 7.9, 1);
    gratedWall(walls, ig, ig + 2, C.gateH, T, 6.9, 7.9, 1);
    const [pa, pb] = [P(R, ig), P(R, ig + 2)];
    for (const [p, xg] of [[pa, sg * G], [pb, -sg * G]]) planeFace(walls, [[p[0], p[1], 0], [xg, gy, 0], [xg, gy, C.gateH], [p[0], p[1], C.gateH]], ASHLAR, { want: [-p[0], C.cy - p[1], 0] });
  }
  // the shrine's niche behind the west wall: its floor, three walls, its lid - and its shrine, a bowl of the band's fire
  const [n0, n1] = [P(R, niche.i), P(R, niche.i + 1)], nu = unit([n0[0] + n1[0], n0[1] + n1[1] - 2 * C.cy, 0]);
  const nb = (p) => [r4(p[0] + nu[0] * niche.depth), r4(p[1] + nu[1] * niche.depth)];
  planeFace(walls, [n0, n1, nb(n1), nb(n0)].map(([x, y]) => [x, y, 0]), FLOOR, { want: [0, 0, 1] });
  planeFace(walls, [nb(n0), nb(n1)].flatMap(([x, y]) => [[x, y, 0]]).concat([[nb(n1)[0], nb(n1)[1], niche.h], [nb(n0)[0], nb(n0)[1], niche.h]]), ASHLAR, { want: [-nu[0], -nu[1], 0] });
  for (const [p, q] of [[n0, nb(n0)], [n1, nb(n1)]]) planeFace(walls, [[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], niche.h], [p[0], p[1], niche.h]], ASHLAR, { want: [p === n0 ? n1[0] - n0[0] : n0[0] - n1[0], p === n0 ? n1[1] - n0[1] : n0[1] - n1[1], 0] });
  planeFace(walls, [n0, n1, nb(n1), nb(n0)].map(([x, y]) => [x, y, niche.h]), ROCK, { want: [0, 0, -1] });
  const sh = [(n0[0] + n1[0]) / 2 + nu[0] * 1.8, (n0[1] + n1[1]) / 2 + nu[1] * 1.8];
  lathe(walls, sh[0], sh[1], [[0.3, 0], [0.22, 0.7], [0.45, 0.85], [0.5, 1.05]], 8, ASHLAR, { top: false });
  levelDisc(walls, sh[0], sh[1], 0.98, 0.46, 8, MOLTEN);
  // THE CHIEFTAINS' DAIS: its plates, its front and sides, its stairs, the box's wall behind it and its top
  const dais = add(refFragMesh('Dais', D));
  levelPolygon(dais, clanDais(), HD, ARENA);
  for (const [i, j] of [[31, 0], [0, 1]]) { const [a, b] = [P(C.daisR, i), P(C.daisR, j)]; planeFace(dais, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HD], [a[0], a[1], HD]], ASHLAR, { want: [-(a[0] + b[0]), 2 * C.cy - a[1] - b[1], 0] }); }
  for (const [i, sg] of [[2, 1], [30, -1]]) { const [c, s] = RINGS[32][i % 32], [a, b] = [P(C.daisR, i), P(R, i)]; planeFace(dais, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HD], [a[0], a[1], HD]], ASHLAR, { want: [-s * sg, c * sg, 0] }); }
  steps(dais, STAIR_S, edges); steps(dais, STAIR_N, edges);
  const back = [P(R, 30), P(C.daisBack, 31), P(C.daisBack, 0), P(C.daisBack, 1), P(R, 2)], bi = [30, 31, 0, 1, 2];
  for (let k = 0; k + 1 < back.length; k++) {
    const [a, b] = [back[k], back[k + 1]];
    planeFace(dais, [[a[0], a[1], HD], [b[0], b[1], HD], [b[0], b[1], zBox], [a[0], a[1], zBox]], ASHLAR, { want: [-(a[0] + b[0]), 2 * C.cy - a[1] - b[1], 0] });
    const [c, d] = [P(tierR(4), bi[k]), P(tierR(4), bi[k + 1])];
    planeFace(dais, [[a[0], a[1], zBox], [b[0], b[1], zBox], [d[0], d[1], zBox], [c[0], c[1], zBox]], FLOOR, { want: [0, 0, 1] });
  }
  // the stands' banners hung on the box's wall behind the dais: the clans' colours (slag and iron)
  for (const k of [1, 2]) {
    const [a, b] = [back[k], back[k + 1]], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t = unit([b[0] - a[0], b[1] - a[1], 0]);
    planeFace(dais, [[m[0] - t[0] * 0.6, m[1] - t[1] * 0.6, HD + 0.5], [m[0] + t[0] * 0.6, m[1] + t[1] * 0.6, HD + 0.5], [m[0] + t[0] * 0.6, m[1] + t[1] * 0.6, zBox - 0.2], [m[0] - t[0] * 0.6, m[1] - t[1] * 0.6, zBox - 0.2]], COBBLE, { want: [-m[0], C.cy - m[1], 0] });
  }
  // THE GRANDSTANDS: five tiers east and west (the dais's sector keeps only the top two), each tread of flags and each riser of
  // ashlar; the parapet; their ends against the towers; the box's ends
  const stands = add(refFragMesh('Stands', D));
  for (const [i0, i1] of [[28, 36], [12, 20]]) {
    for (let k = 0; k < C.tiers; k++) {
      const r0 = tierR(k), r1 = k === C.tiers - 1 ? 22.2 : tierR(k + 1), z = tierZ(k);
      const spans = i0 === 28 && k < 3 ? [[28, 30], [34, 36]] : i0 === 28 && k === 3 ? [[28, 30], [34, 36]] : [[i0, i1]];
      for (const [a, b] of spans) {
        ringBand(stands, 0, C.cy, r0, r1, z, 32, a, b, FLOOR);
        if (k < C.tiers - 1) ringWall(stands, 0, C.cy, r1, z, z + C.tierH, 32, a, b, ASHLAR, iw);
      }
      if (i0 === 28 && k >= 3) { ringBand(stands, 0, C.cy, r0, r1, z, 32, 30, 34, FLOOR); if (k < C.tiers - 1) ringWall(stands, 0, C.cy, r1, z, z + C.tierH, 32, 30, 34, ASHLAR, iw); }
    }
    ringWall(stands, 0, C.cy, 22.2, tierZ(4), C.parapet, 32, i0, i1, ASHLAR, iw);
    ringBand(stands, 0, C.cy, 22.2, 22.5, C.parapet, 32, i0, i1, IRON);
    ringWall(stands, 0, C.cy, 22.5, 0, C.parapet, 32, i0, i1, ASHLAR);
  }
  for (const [i, sg] of [[30, -1], [2, 1]]) {   // the tiers' ends where the dais's box begins
    const [c, s] = RINGS[32][i % 32], want = [-s * sg, c * sg, 0];
    for (let k = 0; k < 3; k++) { const [a, b] = [P(tierR(k), i), P(tierR(k + 1), i)]; planeFace(stands, [[a[0], a[1], tierZ(k)], [b[0], b[1], tierZ(k)], [b[0], b[1], zBox], [a[0], a[1], zBox]], ASHLAR, { want }); }
  }
  // THE GATE TOWERS, north and south: their faces to the pit and to the void, their flanks over the stands, their gates'
  // passages, their battlemented tops; over the north gate THE HONOUR HORN on its frame, its bell over the pit
  const towers = add(refFragMesh('Towers', D));
  const xo = P(22.5, 4)[0];
  for (const [sg, i0, i1, gy, yEnd] of [[1, 4, 12, GY.north, L], [-1, 20, 28, GY.south, 0]]) {
    const want = [0, sg, 0];
    for (const [x0, z0, x1, z1] of [[-xo, 0, -G, T], [G, 0, xo, T], [-G, C.gateH, G, T]]) planeFace(towers, [[x0, yEnd, z0], [x1, yEnd, z0], [x1, yEnd, z1], [x0, yEnd, z1]], ASHLAR, { want });
    for (const [x0, z0, x1, z1] of [[-G - 0.5, 0, -G, C.gateH + 0.5], [G, 0, G + 0.5, C.gateH + 0.5], [-G, C.gateH, G, C.gateH + 0.5]]) planeFace(towers, [[x0, yEnd, z0], [x1, yEnd, z0], [x1, yEnd, z1], [x0, yEnd, z1]], IRON, { want });
    for (const s of [-1, 1]) planeFace(towers, [[s * G, yEnd, 0], [s * G, gy, 0], [s * G, gy, C.gateH], [s * G, yEnd, C.gateH]], ASHLAR, { want: [-s, 0, 0] });
    const yc = P(R, sg > 0 ? 8 : 24)[1];
    planeFace(towers, [[-G, yEnd, C.gateH], [0, yEnd, C.gateH], [0, yc, C.gateH], [-G, gy, C.gateH]], IRON, { want: [0, 0, -1] });
    planeFace(towers, [[0, yEnd, C.gateH], [G, yEnd, C.gateH], [G, gy, C.gateH], [0, yc, C.gateH]], IRON, { want: [0, 0, -1] });
    for (const [i, s] of [[i0, -sg], [i1, sg]]) {   // the flanks over the stands
      const [c, sn] = RINGS[32][i % 32], [a, b] = [P(R, i), P(22.5, i)];
      planeFace(towers, [[a[0], a[1], HD], [b[0], b[1], HD], [b[0], b[1], T], [a[0], a[1], T]], ASHLAR, { want: [sn * s, -c * s, 0] });
      const xs = Math.sign(b[0]);
      planeFace(towers, [[xs * xo, b[1], 0], [xs * xo, yEnd, 0], [xs * xo, yEnd, T], [xs * xo, b[1], T]], ASHLAR, { want: [xs, 0, 0] });
    }
    // the top: strips from the void's face to the pit's edge
    const arcI = [];
    for (let i = i0; i <= i1; i++) arcI.push(i);
    const edge = [P(22.5, i0), ...arcI.map((i) => P(R, i)), P(22.5, i1)];
    for (let k = 0; k + 1 < edge.length; k++) {
      const [a, b] = [edge[k], edge[k + 1]];
      planeFace(towers, [[a[0], a[1], T], [b[0], b[1], T], [b[0], yEnd, T], [a[0], yEnd, T]], ASHLAR, { want: [0, 0, 1] });
    }
    for (let x = -xo + 0.6; x < xo - 0.4; x += 1.7) boxFaces(towers, x, sg > 0 ? L - 0.6 : 0, T, x + 0.85, sg > 0 ? L : 0.6, T + 0.95, ASHLAR, { skip: '-z' });
  }
  const horn = add(refFragMesh('Honour_Horn', D));
  const hp = [[2.7, 35.0, 10.3], [2.1, 35.25, 10.95], [1.2, 35.3, 11.55], [0.2, 35.0, 12.0], [-0.7, 34.4, 12.25], [-1.35, 33.6, 12.3], [-1.75, 32.75, 12.15]];
  tube(horn, hp, [0.11, 0.15, 0.2, 0.27, 0.37, 0.52, 0.78], 12, IRON);
  levelDisc(horn, -1.75, 32.75, 12.15, 0.74, 12, ROCK);
  for (const [x, y] of [[2.5, 35.05], [-1.0, 34.2]]) boxFaces(horn, x - 0.12, y - 0.12, T, x + 0.12, y + 0.12, x > 0 ? 10.4 : 12.0, IRON, { skip: '-z' });
  // the braziers where the stands meet the towers (each lit - the four lights), on the first tier
  const braziers = [[dirAt(3, 0.6), 1], [dirAt(28, 0.4), 1], [dirAt(11, 0.4), 1], [dirAt(19, 0.6), 1]].map(([d]) => at(d, tierR(0) + 0.65));
  for (const [x, y] of braziers) {
    lathe(stands, x, y, [[0.28, HD], [0.2, HD + 0.65], [0.22, HD + 0.9], [0.55, HD + 1.05], [0.62, HD + 1.35]], 8, IRON, { top: false });
    levelDisc(stands, x, y, HD + 1.28, 0.56, 8, MOLTEN);
  }
  // THE CROWD: rows of Kyn on every tier, facing the pit (a few places empty), and the clans' banners over the parapet
  const crowd = add(refFragMesh('Crowd', D));
  let kn = 0;
  for (const [i0, i1] of [[28, 36], [12, 20]]) for (let k = 0; k < C.tiers; k++) for (let i = i0; i < i1; i++) for (let f = 0; f < 3; f++) {
    kn++;
    const ii = i % 32;
    if (i0 === 28 && k < 3 && (ii === 30 || ii === 31 || ii === 0 || ii === 1)) continue;   // the dais and its box
    if (hash01(SEED, kn, 7) < 0.18) continue;
    const d = dirAt(i, (f + 0.5 + 0.3 * (hash01(SEED, kn, 8) - 0.5)) / 3), p = at(d, tierR(k) + 0.62);
    if (braziers.some((b) => (b[0] - p[0]) * (b[0] - p[0]) + (b[1] - p[1]) * (b[1] - p[1]) < 1.4)) continue;
    kyn(crowd, p, tierZ(k), d, kn);
  }
  for (const i of [29, 31, 1, 3, 13, 15, 17, 19]) {
    const d = dirAt(i, 0.5), p = at(d, 22.05), t = [-d[1], d[0]];
    boxFaces(stands, p[0] - 0.07, p[1] - 0.07, tierZ(4), p[0] + 0.07, p[1] + 0.07, 10.6, IRON, { skip: '-z' });
    const q = [p[0] - d[0] * 0.12, p[1] - d[1] * 0.12], bw = [[q[0] - t[0] * 0.55, q[1] - t[1] * 0.55], [q[0] + t[0] * 0.55, q[1] + t[1] * 0.55]];
    planeFace(stands, [[bw[0][0], bw[0][1], 8.7], [bw[1][0], bw[1][1], 8.7], [bw[1][0], bw[1][1], 10.4], [bw[0][0], bw[0][1], 10.4]], COBBLE, { want: [-d[0], -d[1], 0] });
    planeFace(stands, [[bw[1][0], bw[1][1], 8.7], [bw[0][0], bw[0][1], 8.7], [bw[0][0], bw[0][1], 10.4], [bw[1][0], bw[1][1], 10.4]], COBBLE, { want: [d[0], d[1], 0] });
  }
  // the rock's keel: rings from the stands' and the towers' foot down to a torn tip, pushed out by noise
  const rim = [];
  for (let i = 28; i <= 36; i++) rim.push(P(22.5, i));
  rim.push([xo, L], [-xo, L]);
  for (let i = 12; i <= 20; i++) rim.push(P(22.5, i));
  rim.push([-xo, 0], [xo, 0]);
  const zs = [0, -1.2, -3.6, -6.6, -9.8, C.keel], sc = [1, 0.97, 0.86, 0.64, 0.36, 0.07], nr = rim.length;
  grid(add(refFragMesh('Keel', D)), nr, zs.length - 1, (i, j) => {
    const [x, y] = rim[i % nr], dx = x, dy = y - C.cy, e = j === 0 ? 0 : 1, n = fbm2(SEED + 5, (i % nr) * 0.8, j * 0.9, 4);
    const s = sc[j] * (1 + (j >= 2 ? 0.14 * n : 0));   // pushed out below its rim only, inside the box's ends
    return [dx * s, C.cy + dy * s, zs[j] - e * 1.5 * n];
  }, ROCK, { flip: true, uv: (i, j, p) => [r4(((i % nr) / nr) * 12), r4(0.94 * (1 + p[2] / 14.5))] });

  // ── THE LAW, as named markers
  planeFace(add(refFragMesh('socket.in')), [[-G, 0, 0], [G, 0, 0], [G, 0, C.gateH], [-G, 0, C.gateH]], 0, { want: [0, -1, 0] });
  planeFace(add(refFragMesh('socket.out.main')), [[-G, L, 0], [G, L, 0], [G, L, C.gateH], [-G, L, C.gateH]], 0, { want: [0, 1, 0] });
  levelPolygon(add(refFragMesh('floor.fight.pit')), clanArena(), 0);
  levelPolygon(add(refFragMesh('floor.fight.dais')), clanDais(), HD);
  for (const [name, st] of [['ramp.stairsouth', STAIR_S], ['ramp.stairnorth', STAIR_N]]) planeFace(add(refFragMesh(name)), [[...st.top[0], HD], [...st.top[1], HD], [...st.foot[1], 0], [...st.foot[0], 0]], 0, { want: [0, 0, 1] });
  const open = (name, pts, z) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    boxFaces(add(refFragMesh(name)), Math.min(...xs) - 0.05, Math.min(...ys) - 0.05, z - 0.05, Math.max(...xs) + 0.05, Math.max(...ys) + 0.05, z + 0.05);
  };
  boxFaces(add(refFragMesh('open.mouth')), -G - 0.05, 0, -0.05, G + 0.05, 0.05, 0.05);
  boxFaces(add(refFragMesh('open.exit')), -G - 0.05, L - 0.05, -0.05, G + 0.05, L, 0.05);
  open('open.footsouth', STAIR_S.foot, 0);
  open('open.footnorth', STAIR_N.foot, 0);
  open('open.topsouth', STAIR_S.top, HD);
  open('open.topnorth', STAIR_N.top, HD);
  open('open.daisfront', [P(C.daisR, 1), P(C.daisR, 0), P(C.daisR, 31)], HD);
  open('open.daisnorth', [P(C.daisR, 2), P(R, 2)], HD);
  open('open.daissouth', [P(C.daisR, 30), P(R, 30)], HD);
  const N = {
    mouth: [0, 1.0, 0], south: [0, 7, 0], centre: [0, C.cy, 0], north: [0, 29, 0], exit: [0, 35, 0], west: [-10.5, C.cy, 0],
    sw: [...P(9, 20), 0], nw: [...P(9, 12), 0], se: [...P(9, 28), 0], ne: [...P(9, 4), 0],
    footsouth: [r4(STAIR_S.u[0] * 5.6), r4(C.cy + STAIR_S.u[1] * 5.6), 0], footnorth: [r4(STAIR_N.u[0] * 5.6), r4(C.cy + STAIR_N.u[1] * 5.6), 0],
    topsouth: [r4(STAIR_S.u[0] * 13.4), r4(C.cy + STAIR_S.u[1] * 13.4), HD], topnorth: [r4(STAIR_N.u[0] * 13.4), r4(C.cy + STAIR_N.u[1] * 13.4), HD], dais: [16.5, C.cy, HD],
  };
  for (const [k, p] of Object.entries(N)) levelDisc(add(refFragMesh(`node.${k}`)), p[0], p[1], p[2], 0.5);
  for (const [a, b] of [['mouth', 'south'], ['south', 'centre'], ['centre', 'north'], ['north', 'exit'], ['south', 'sw'], ['sw', 'west'], ['west', 'nw'], ['nw', 'north'], ['south', 'se'], ['se', 'centre'], ['north', 'ne'], ['ne', 'centre'], ['centre', 'west'], ['centre', 'footsouth'], ['centre', 'footnorth'], ['footsouth', 'topsouth'], ['footnorth', 'topnorth'], ['topsouth', 'dais'], ['topnorth', 'dais']]) walkEdge(add(refFragMesh(`edge.${a}-${b}`)), N[a], N[b], 0.2);
  const cube = (name, [x, y], z, s = 0.3) => boxFaces(add(refFragMesh(name)), x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  for (const [k, i] of [['a', 6], ['b', 10], ['c', 14], ['d', 21], ['e', 26]]) cube(`anchor.rift.${k}`, P(12.5, i), 0);
  cube('anchor.caster.north', P(16, 1), HD);
  cube('anchor.caster.south', P(16, 31), HD);
  for (const [k, i] of [['north', 7], ['west', 17], ['south', 25]]) cube(`anchor.lurker.${k}`, P(14.5, i), 0);
  {
    const pts = [n0, n1, nb(n1), nb(n0)], xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    boxFaces(add(refFragMesh('alcove.seam.page.shrine')), Math.min(...xs), Math.min(...ys), 0, Math.max(...xs), Math.max(...ys), niche.h);
  }
  braziers.forEach(([x, y], k) => cube(`light.band.brazier${k}`, [x, y], HD + 2.0, 0.2));
  // THE COLLIDER'S PROXY: the pit's floor and the dais, the stairs and their sides, the dais's faces, the pit's wall (broken
  // at the gates and the niche), the gates' passages, the niche, the box's wall and top, the stands' slopes and parapets
  const PX = add(refFragMesh('collider.proxy'));
  levelPolygon(PX, clanArena(), 0);
  levelPolygon(PX, clanDais(), HD);
  for (const st of [STAIR_S, STAIR_N]) {
    planeFace(PX, [[...st.top[0], HD], [...st.top[1], HD], [...st.foot[1], 0], [...st.foot[0], 0]], 0, { want: [0, 0, 1] });
    for (const k of [0, 1]) planeFace(PX, [[...st.top[k], 0], [...st.foot[k], 0], [...st.top[k], HD]], 0, { want: [k ? st.top[1][0] - st.top[0][0] : st.top[0][0] - st.top[1][0], k ? st.top[1][1] - st.top[0][1] : st.top[0][1] - st.top[1][1], 0] });
  }
  const wallQ = (a, b, z0, z1) => planeFace(PX, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], 0, { want: [-(a[0] + b[0]), 2 * C.cy - a[1] - b[1], 0] });
  for (const [i, j] of [[31, 0], [0, 1]]) wallQ(P(C.daisR, i), P(C.daisR, j), 0, HD);
  for (const i of [2, 30]) { const [a, b] = [P(C.daisR, i), P(R, i)]; planeFace(PX, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], HD], [a[0], a[1], HD]], 0); }
  for (let i = 2; i < 30; i++) {
    if (i === 7 || i === 8 || i === 23 || i === 24) continue;
    const tall = (i >= 4 && i < 12) || (i >= 20 && i < 28);
    if (i === niche.i) { wallQ(P(R, i), P(R, i + 1), niche.h, HD); continue; }
    wallQ(P(R, i), P(R, i + 1), 0, tall ? T : HD);
  }
  for (const [ig, gy, sg, yEnd] of [[7, GY.north, 1, L], [23, GY.south, -1, 0]]) {
    wallQ(P(R, ig), P(R, ig + 2), C.gateH, T);
    wallQ(P(R, ig), [sg * G, gy], 0, C.gateH); wallQ([-sg * G, gy], P(R, ig + 2), 0, C.gateH);
    for (const s of [-1, 1]) planeFace(PX, [[s * G, yEnd, 0], [s * G, gy, 0], [s * G, gy, C.gateH], [s * G, yEnd, C.gateH]], 0, { want: [-s, 0, 0] });
    planeFace(PX, [[-G, yEnd, C.gateH], [G, yEnd, C.gateH], [G, gy, C.gateH], [-G, gy, C.gateH]], 0, { want: [0, 0, -1] });
  }
  planeFace(PX, [n0, n1, nb(n1), nb(n0)].map(([x, y]) => [x, y, 0]), 0, { want: [0, 0, 1] });
  planeFace(PX, [nb(n0), nb(n1)].map(([x, y]) => [x, y, 0]).concat([[nb(n1)[0], nb(n1)[1], niche.h], [nb(n0)[0], nb(n0)[1], niche.h]]), 0, { want: [-nu[0], -nu[1], 0] });
  for (const [p, q] of [[n0, nb(n0)], [n1, nb(n1)]]) planeFace(PX, [[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], niche.h], [p[0], p[1], niche.h]], 0);
  planeFace(PX, [n0, n1, nb(n1), nb(n0)].map(([x, y]) => [x, y, niche.h]), 0, { want: [0, 0, -1] });
  for (let k = 0; k + 1 < back.length; k++) { wallQ(back[k], back[k + 1], HD, zBox); const [c, d] = [P(tierR(4), bi[k]), P(tierR(4), bi[k + 1])]; planeFace(PX, [[back[k][0], back[k][1], zBox], [back[k + 1][0], back[k + 1][1], zBox], [d[0], d[1], zBox], [c[0], c[1], zBox]], 0, { want: [0, 0, 1] }); }
  for (const [i0, i1] of [[28, 36], [12, 20]]) for (let i = i0; i < i1; i++) {
    const ii = i % 32;
    if (i0 === 28 && (ii === 30 || ii === 31 || ii === 0 || ii === 1)) continue;
    const [a, b, c, d] = [P(R, i), P(R, i + 1), P(22.2, i + 1), P(22.2, i)];
    planeFace(PX, [[a[0], a[1], HD], [b[0], b[1], HD], [c[0], c[1], tierZ(4)], [d[0], d[1], tierZ(4)]], 0, { want: [0, 0, 1] });
    planeFace(PX, [[d[0], d[1], tierZ(4)], [c[0], c[1], tierZ(4)], [c[0], c[1], C.parapet], [d[0], d[1], C.parapet]], 0);
  }
  return out;
}

/** THE FILE: the scene written as the reference is (tools/egRefFragScene.mjs writeRefFragFbx - Blender's exporter's way). */
export const writeHeroClanPitFbx = (scene = heroClanPitScene()) => writeRefFragFbx(scene);

if (isMain(import.meta.url)) {
  const outPath = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, HERO_CLAN_PIT_FBX));
  const bytes = writeHeroClanPitFbx();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  console.log(`${outPath}: ${heroClanPitScene().length} objects, ${bytes.length} bytes`);
}
