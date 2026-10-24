// THE FORGE GUT - the Havoc Wellhead's hero passage, a scene written from numbers alone.
//
//     node tools/egHeroForgeGutScene.mjs [--out=src/assets/egfrags/source/egheroForgeGut.fbx]
//
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2 and
// 11.6). Dagon's war-forges: a gut of riveted basalt ringed in iron, its floors forged plates kerbed in dressed stone, a river
// of molten iron far down its chasm, two conveyors and a slag weir across it, drop-hammers hanging in its vault. Written on
// the authoring kit (tools/egHeroKit.mjs) and the reference's mesh and writer (tools/egRefFragScene.mjs refFragMesh,
// writeRefFragFbx) - no game data, no third-party art, no trigonometry - and committed as the .fbx tools/fragBake.mjs bakes
// (tools/bakeEgHeroForgeGut.mjs). Re-run it and the same bytes come out (test/tooling/eghero_wellhead.test.js holds it to them).
//
// THE ENVELOPE - net/eliteGates/egFragLaw.js egFragPassage('forge') from EG_SLAG_LAW (the code-built passage it stands in for):
//   frame      1 unit 1 m, Z up, the course along +Y; the mouth at Y 0 centred on X 0, the exit at Y 31
//   mouth      8.4 m wide (halfW 420), 6.5 m high (height 650) - the code-built passage's floor and vault; the exit the same,
//              at the mouth's height (yB 0)
//   length     31 m (len 2800 + EG_SLAG_STEP.d 300)
//   floors     the near landing Y 0-6.8, the far Y 24.2-31 - fight floors (a passage's landings, section 11.1), 8.4 m wide
//   chasm      Y 6.8-24.2, crossed by the kit's pieces (EG_FRAG_PIECES.forge): two conveyors (Rails 3 x 3 m, 2 m of travel
//              either way, a 6 s cycle, in step) and the cooling slag's crust (EG_SLAG_STEP 4 x 3 m, its two spouts' lanes
//              EG_SLAG_LANE_CM either side), each 2.8 m past what stands before it (the code-built's 3.2 m, drawn in so every
//              window opens wide - THE TIMED SOLVER proves it at every slag phase)
//   headroom   the clamp's ceiling 6.5 m over every floor and every piece (a passage's 3.5 m, a course's 4.5 m); the vault
//              drawn over it to 9.7 m and pushed out by noise
//   box        X -9.9 to 10.3, Z -16.7 to 16.4 (the rock mass's torn keel to its chimneys), Y 0 to 31
// THE PLACE: a portal of ashlar framed in iron at each end, a forge-eye of molten iron over the mouth; ten iron ribs round
// the gut, its walls' ashlar bulging outward, molten channels along both walls' feet behind a dressed kerb; hearth bays in
// the walls (a hearth and an anvil, a rack of blades, the drop-hammer's winch) and the alcove's niche; the conveyors' beds,
// rollers, drums and cog-wheels on iron trestles out of the river; the slag weir under its two crucibles' spouts; the six
// drop-hammers' heads over every spot they strike; THE EDGE LINE on the mouth, both lips and the exit.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { refFragMesh, writeRefFragFbx } from './egRefFragScene.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';
import { RINGS, r4, unit, fbm2, grid, lathe, sweep, planeFace, boxFaces, walkEdge, levelDisc, rockFaceLoops, rockFace, rockHull } from './egHeroKit.mjs';

/** Where the scene is committed. */
export const HERO_FORGE_GUT_FBX = 'src/assets/egfrags/source/egheroForgeGut.fbx';
/** THE ENVELOPE (m): the floor's half-width, the clamp's ceiling, the length, the near landing's end and the far's start,
 *  each piece's place along the course (its near edge to its far edge), and the walls' and the vault's drawn faces. */
export const FORGE_GUT = Object.freeze({
  halfW: 4.2, ceil: 6.5, len: 31, zA: 6.8, zB: 24.2,
  belt1: Object.freeze([9.6, 12.6]), belt2: Object.freeze([15.4, 18.4]), crust: Object.freeze([21.2, 24.2]),
  railAmp: 2, railPer: 6000, wall: 4.55, rise: 3.2, top: 11.5, river: -5.5,
});
const F = FORGE_GUT;
const SEED = 0x7f01;
/** The dress records' slots each art object names (world/eliteGates/egBandArt.js EG_DRESS). */
const D = Object.freeze(['floor', 'brass', 'root', 'arena', 'cobble', 'edge', 'molten', 'pillar']);
const [FLOOR, IRON, ROCK, ARENA, , EDGE, MOLTEN, ASHLAR] = [0, 1, 2, 3, 4, 5, 6, 7];

/** The ashlar's bulge (m, outward only) at (y, z): the walls' noise. */
const bulge = (y, z) => 0.24 * fbm2(SEED, y * 0.55, z * 0.55);
/** The rough rock's push (m, outward only) at (u, v). */
const push = (u, v, k = 1) => 0.9 * k * fbm2(SEED + 7, u * 0.35, v * 0.35);
/** Ring `n`'s corners from i0 to i1 (wrapping). */
const arc = (n, i0, i1) => Array.from({ length: i1 - i0 + 1 }, (_, k) => RINGS[n][(((i0 + k) % n) + n) % n]);

/** An iron RIB round the gut at `y`: its inner face's line `path` ([[x, z], ...] from the east foot over the vault to the
 *  west foot), `d` deep into the rock and `w` along the course - its inner face smooth, its sides hard. */
function rib(m, y, path, d, w, mat) {
  const t = path.map((p, k) => { const a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)]; return unit([b[0] - a[0], 0, b[1] - a[1]]); });
  const inn = t.map((v) => [-v[2], 0, v[0]]);   // the tangent turned a quarter: toward the gut's axis
  const P = (k, dy, out = 0) => [path[k][0] - inn[k][0] * out, y + dy, path[k][1] - inn[k][2] * out];
  let s = 0;
  const v = path.map((p, k) => { if (!k) return 0; const dx = p[0] - path[k - 1][0], dz = p[1] - path[k - 1][1]; return (s += Math.sqrt(dx * dx + dz * dz)); });
  for (let k = 0; k + 1 < path.length; k++) {
    const q = [P(k, -w / 2), P(k, w / 2), P(k + 1, w / 2), P(k + 1, -w / 2)].map((p) => p.map(r4));
    const uv = [[0, v[k] / 2], [w / 2, v[k] / 2], [w / 2, v[k + 1] / 2], [0, v[k + 1] / 2]].map((c) => c.map(r4));
    const nn = [inn[k], inn[k], inn[k + 1], inn[k + 1]];
    const want = inn[k];
    const n0 = [(q[1][1] - q[0][1]) * (q[2][2] - q[0][2]) - (q[1][2] - q[0][2]) * (q[2][1] - q[0][1]), (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]), (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0])];
    const order = n0[0] * want[0] + n0[1] * want[1] + n0[2] * want[2] >= 0 ? [0, 1, 2, 3] : [3, 2, 1, 0];
    m.face(order.map((i) => q[i]), mat, order.map((i) => [nn[i], uv[i]]));
    for (const dy of [-w / 2, w / 2]) planeFace(m, [P(k, dy), P(k + 1, dy), P(k + 1, dy, d), P(k, dy, d)], mat, { want: [0, dy, 0] });
  }
  return m;
}
/** A COG-WHEEL standing across the course at (x, y, z), its face square to X: `teeth` teeth, radius r (the teeth's roots
 *  0.8 of it), `t` thick, a hub of `hub` - each tooth's face a quad from the hub, its rim hard. */
function cog(m, x, y, z, r, teeth, t, hub, mat) {
  const ring = RINGS[teeth * 2 === 24 ? 24 : 16];
  const n = ring.length, rr = (k) => (k % 2 === 0 ? r : r * 0.8);
  for (const [sx, nx] of [[x - t / 2, -1], [x + t / 2, 1]]) {
    for (let k = 0; k < n; k++) {
      const [c0, s0] = ring[k], [c1, s1] = ring[(k + 1) % n];
      planeFace(m, [[sx, y + hub * c0, z + hub * s0], [sx, y + rr(k) * c0, z + rr(k) * s0], [sx, y + rr(k) * c1, z + rr(k) * s1], [sx, y + hub * c1, z + hub * s1]], mat, { want: [nx, 0, 0] });
    }
  }
  for (let k = 0; k < n; k++) {
    const [c0, s0] = ring[k], [c1, s1] = ring[(k + 1) % n], r0 = rr(k);
    planeFace(m, [[x - t / 2, y + r0 * c0, z + r0 * s0], [x + t / 2, y + r0 * c0, z + r0 * s0], [x + t / 2, y + r0 * c1, z + r0 * s1], [x - t / 2, y + r0 * c1, z + r0 * s1]], mat, { want: [0, c0 + c1, s0 + s1] });
  }
  return m;
}
/** A DROP-HAMMER over the spot (x, y): its striking face 0.25 m over the clamp's ceiling, its head, its shaft into the vault
 *  and its two guides. */
function hammer(m, x, y, mat) {
  const z0 = F.ceil + 0.2;
  boxFaces(m, x - 0.85, y - 0.85, z0, x + 0.85, y + 0.85, z0 + 0.3, mat);
  boxFaces(m, x - 1.05, y - 1.05, z0 + 0.3, x + 1.05, y + 1.05, z0 + 1.3, mat);
  boxFaces(m, x - 0.2, y - 0.2, z0 + 1.3, x + 0.2, y + 0.2, F.top - 0.8, mat, { skip: '-z+z' });
  for (const s of [-1, 1]) boxFaces(m, x - 0.1, y + s * 1.3 - 0.1, z0 - 0.05, x + 0.1, y + s * 1.3 + 0.1, F.top - 0.8, mat, { skip: '+z' });
  return m;
}
/** A BAY in the wall on side `s` (1 east, -1 west) from y0 to y1: its floor, its three walls and its lid behind the gut's
 *  wall line - a hearth's, a rack's, the winch's or the alcove's niche. */
function bay(m, s, y0, y1, depth, h, slots) {
  const x0 = s * F.halfW, x1 = s * (F.halfW + depth);
  planeFace(m, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], slots.floor, { want: [0, 0, 1] });
  planeFace(m, [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], slots.wall, { want: [-s, 0, 0] });
  for (const [y, w] of [[y0, 1], [y1, -1]]) planeFace(m, [[x0, y, 0], [x1, y, 0], [x1, y, h], [x0, y, h]], slots.wall, { want: [0, w, 0] });
  planeFace(m, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], slots.lid, { want: [0, 0, -1] });
  return m;
}
/** THE PORTAL'S OUTLINE round the opening ([x, z], counter-clockwise): its iron frame 0.6 m wide over the floor's face, and
 *  the gable over the lintel. THE ROCK MASS's end rings about its middle (FACE_C): the ellipse `a` either way, `up` over and
 *  `down` under it - the hull's ends, where the portals meet it. */
const PORTAL = Object.freeze([[-4.8, -1.2], [4.8, -1.2], [4.8, 7.1], [0, 10.6], [-4.8, 7.1]]);
const FACE_C = Object.freeze([0, 3.25]), MASS = Object.freeze({ a: 7.6, up: 8.25, down: 14.5 });
/** THE FORGE-EYE over the mouth: a diamond (its corners [x, z] - its foot, east, head, west) set 0.35 m into the gable. */
const EYE = Object.freeze([[0, 8.0], [1.2, 8.9], [0, 9.8], [-1.2, 8.9]]);
/** A PORTAL's face at `y` facing `fy` (-1 the mouth, 1 the exit): the rock's face round its outline (faceLoops, faceBand -
 *  the hull's end ring its edge), its iron frame, the floor's face, its gable (the mouth's open where the forge-eye is set)
 *  and its reveal (`depth` into the gut) - the jambs and the lintel's soffit. */
function portal(m, y, fy, depth) {
  const W = F.halfW, H = F.ceil, fr = 0.6, want = [0, fy, 0], yi = y - fy * depth;
  const q = (x0, z0, x1, z1, mat) => planeFace(m, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], mat, { want });
  const [inner, outer] = rockFaceLoops(FACE_C[0], FACE_C[1], PORTAL, MASS.a, MASS.up, MASS.down);
  rockFace(m, y, inner, outer, ASHLAR, want);
  const [A, B, C] = [PORTAL[4], PORTAL[2], PORTAL[3]], Bm = [0, A[1]];
  if (fy < 0) {
    const [dB, dR, dT, dL] = EYE;
    for (const quad of [[A, Bm, dB, dL], [Bm, B, dR, dB], [B, C, dT, dR], [C, A, dL, dT]]) planeFace(m, quad.map(([x, z]) => [x, y, z]), ASHLAR, { want });
  } else planeFace(m, [A, B, C].map(([x, z]) => [x, y, z]), ASHLAR, { want });
  q(-W - fr, -1.2, -W, H + fr, IRON); q(W, -1.2, W + fr, H + fr, IRON); q(-W, H, W, H + fr, IRON);
  q(-W, -1.2, W, 0, ASHLAR);   // the floor's own face under the opening
  for (const s of [-1, 1]) planeFace(m, [[s * W, y, 0], [s * W, yi, 0], [s * W, yi, H], [s * W, y, H]], ASHLAR, { want: [-s, 0, 0] });
  planeFace(m, [[-W, y, H], [W, y, H], [W, yi, H], [-W, yi, H]], IRON, { want: [0, 0, -1] });
  // the reveal's back face, round the opening up to the gut's own profile (its rock hides what stands past it)
  const qi = (x0, z0, x1, z1, mat) => planeFace(m, [[x0, yi, z0], [x1, yi, z0], [x1, yi, z1], [x0, yi, z1]], mat, { want: [0, -fy, 0] });
  qi(-F.wall - 0.6, 0, -W, H, ASHLAR); qi(W, 0, F.wall + 0.6, H, ASHLAR); qi(-F.wall - 0.6, H, F.wall + 0.6, H + F.rise + 1.1, ASHLAR);
  return m;
}

/**
 * THE FORGE GUT'S SCENE: every object, art and marker, in Blender's scene (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function heroForgeGutScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  const W = F.halfW, H = F.ceil, L = F.len, y0w = 1.0, y1w = L - 1.0;
  const bays = [[2.4, 4.4], [26.6, 28.6]];

  // ── THE ART, in the Wellhead's dress
  // the two landings: forged plates (the courts' quiet record - the telegraphs own them) in a kerb of dressed basalt 0.6 m
  // wide (section 11.9: the kerb between the magma and a fight floor), the lip's face under it
  const floors = add(refFragMesh('Landings', D));
  for (const [ya, yb] of [[0, F.zA], [F.zB, L]]) {
    planeFace(floors, [[-W + 0.6, ya + 0.6, 0], [W - 0.6, ya + 0.6, 0], [W - 0.6, yb - 0.6, 0], [-W + 0.6, yb - 0.6, 0]], ARENA);
    for (const [x0, y0, x1, y1] of [[-W, ya, W, ya + 0.6], [-W, yb - 0.6, W, yb], [-W, ya + 0.6, -W + 0.6, yb - 0.6], [W - 0.6, ya + 0.6, W, yb - 0.6]]) planeFace(floors, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], ASHLAR);
    for (const s of [-1, 1]) planeFace(floors, [[s * W, ya, -0.32], [s * W, yb, -0.32], [s * W, yb, 0], [s * W, ya, 0]], ASHLAR, { want: [s, 0, 0] });
  }
  for (const [y, fy] of [[F.zA, 1], [F.zB, -1]]) {
    planeFace(floors, [[-W, y, -1.2], [W, y, -1.2], [W, y, 0], [-W, y, 0]], ASHLAR, { want: [0, fy, 0] });
    planeFace(floors, [[-W - 0.6, y, F.river - 0.2], [W + 0.6, y, F.river - 0.2], [W + 0.6, y, -1.2], [-W - 0.6, y, -1.2]], ROCK, { want: [0, fy, 0] });
  }
  // THE EDGE LINE (section 25.3): the mouth, both lips and the exit - gold, a hair over the kerb
  const edges = add(refFragMesh('Edge_Lines', D));
  for (const [ya, yb] of [[0, 0.12], [F.zA - 0.12, F.zA], [F.zB, F.zB + 0.12], [L - 0.12, L]]) planeFace(edges, [[-W, ya, 0.012], [W, ya, 0.012], [W, yb, 0.012], [-W, yb, 0.012]], EDGE);
  // the molten channels along both walls' feet, under the kerb's side (behind the wall's line: nobody steps in)
  const channels = add(refFragMesh('Channels', D));
  for (const s of [-1, 1]) for (const [ya, yb] of [[y0w, bays[0][0]], [bays[0][1], F.zA], [F.zB, bays[1][0]], [bays[1][1], y1w]]) planeFace(channels, [[s * W, ya, -0.3], [s * (F.wall + 0.05), ya, -0.3], [s * (F.wall + 0.05), yb, -0.3], [s * W, yb, -0.3]], MOLTEN, { want: [0, 0, 1] });
  // the walls: ashlar bulging outward from 4.55 m, broken by the bays; their rough feet down the chasm
  const walls = add(refFragMesh('Walls', D));
  const zRows = [0, 0.55, 1.4, 2.3, 3.2, 4.1, 5.0, 5.8, H], zHigh = [2.6, 3.2, 4.1, 5.0, 5.8, H];
  const runs = [[y0w, bays[0][0], zRows], [bays[0][0], bays[0][1], zHigh], [bays[0][1], bays[1][0], zRows], [bays[1][0], bays[1][1], zHigh], [bays[1][1], y1w, zRows]];
  // one lattice of columns for every wall grid (each whole metre, every run's end and the chasm's lips), so the ashlar and
  // its rough feet meet on shared corners
  const cuts = [...new Set([...Array.from({ length: L + 1 }, (_, k) => k), ...runs.flat().filter((v) => typeof v === 'number'), F.zA, F.zB])].sort((a, b) => a - b);
  const ys = (ya, yb) => cuts.filter((y) => y >= ya && y <= yb);
  for (const s of [-1, 1]) {
    for (const [ya, yb, zs] of runs) {
      const Y = ys(ya, yb);
      grid(walls, Y.length - 1, zs.length - 1, (i, j) => [s * (F.wall + bulge(Y[i], zs[j])), Y[i], zs[j]], ASHLAR, { flip: s > 0, uv: (i, j, p) => [p[1] * 0.5, p[2] * 0.5] });
    }
    const zLow = [F.river - 0.2, -4.2, -2.9, -1.6, -0.6, 0], Y = ys(F.zA, F.zB);
    grid(walls, Y.length - 1, zLow.length - 1, (i, j) => [s * (F.wall + bulge(Y[i], zLow[j]) + (j === zLow.length - 1 ? 0 : push(Y[i], zLow[j], 0.6))), Y[i], zLow[j]], ROCK, { flip: s > 0, uv: (i, j, p) => [p[1] * 0.5, 0.94 + p[2] * 0.09] });   // the root's courses down the chasm, never its welded band
  }
  // the vault: rough rock from the cornice to its crown 3.2 m over it, pushed out by noise, coursed to its crown
  const vault = add(refFragMesh('Vault', D));
  const half = 8, V = arc(32, 0, 16);
  grid(vault, 29, 16, (i, j) => {
    const y = y0w + ((y1w - y0w) * i) / 29, [c, s] = V[j], n = unit([c * F.rise, 0, s * F.wall]), d = push(y, j, 0.3 + 0.7 * s);
    return [F.wall * c + n[0] * d, y, H + F.rise * s + n[2] * d];
  }, ROCK, { flip: true, uv: (i, j, p) => [p[1] * 0.5, 0.94 - (0.52 * Math.min(j, 16 - j)) / half] });   // its courses to the crown
  // the cornice: an iron band along each wall's head, hiding where the ashlar meets the rock
  const iron = add(refFragMesh('Ironwork', D));
  for (const s of [-1, 1]) boxFaces(iron, s * 4.3, y0w, H - 0.22, s * 4.95, y1w, H + 0.32, IRON, { skip: s > 0 ? '+x' : '-x' });
  // ten iron ribs round the gut, every 3.1 m - their feet on the landings, or down to the river over the chasm
  for (let k = 0; k < 10; k++) {
    const y = 1.55 + 3.1 * k, foot = y < F.zA || y > F.zB ? 0 : F.river - 0.2, a = 4.24;
    const path = [[a, foot], ...arc(32, 0, 16).map(([c, s]) => [a * c, H + 2.95 * s]), [-a, foot]];
    rib(iron, y, path, 0.42, 0.5, IRON);
  }
  // the furnace grates between the ribs, high on both walls: molten iron behind two bars in an iron frame, standing proud of
  // the ashlar (and behind the wall's line)
  for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
    const y = 3.1 + 3.1 * k, xg = s * 4.5, xf = s * 4.42, want = [-s, 0, 0];
    planeFace(iron, [[xg, y - 0.55, 4.45], [xg, y + 0.55, 4.45], [xg, y + 0.55, 5.25], [xg, y - 0.55, 5.25]], MOLTEN, { want });
    for (const [ya, yb, za, zb] of [[y - 0.7, y + 0.7, 4.3, 4.45], [y - 0.7, y + 0.7, 5.25, 5.4], [y - 0.7, y - 0.55, 4.45, 5.25], [y + 0.55, y + 0.7, 4.45, 5.25], [y - 0.24, y - 0.14, 4.45, 5.25], [y + 0.14, y + 0.24, 4.45, 5.25]]) planeFace(iron, [[xf, ya, za], [xf, yb, za], [xf, yb, zb], [xf, ya, zb]], IRON, { want });
  }
  // the chains hung from the vault down the chasm beside the conveyors, a link every 0.4 m, each a hook at its foot
  for (const [x, y] of [[-3.0, 8.3], [3.0, 8.9], [-3.1, 14.2], [3.0, 13.6]]) {
    const top = H + F.rise * 0.6, foot = -1.6;
    for (let z = top, k = 0; z > foot; z -= 0.4, k++) {
      const [hx, hy] = k % 2 ? [0.11, 0.035] : [0.035, 0.11];
      boxFaces(iron, x - hx, y - hy, z - 0.46, x + hx, y + hy, z, IRON, { skip: '-z+z' });
    }
    boxFaces(iron, x - 0.05, y - 0.22, foot - 0.5, x + 0.05, y + 0.22, foot - 0.36, IRON);
    boxFaces(iron, x - 0.05, y + 0.12, foot - 0.36, x + 0.05, y + 0.22, foot - 0.12, IRON, { skip: '-z' });
  }
  // the portals: the mouth's and the exit's faces, a metre deep; over the mouth, the forge-eye - a diamond of molten iron
  // set into the ashlar
  const portals = add(refFragMesh('Portals', D));
  portal(portals, 0, -1, y0w);
  portal(portals, L, 1, L - y1w);
  planeFace(portals, EYE.map(([x, z]) => [x, 0.35, z]), MOLTEN, { want: [0, -1, 0] });
  for (let k = 0; k < 4; k++) { const [a, b] = [EYE[k], EYE[(k + 1) % 4]]; planeFace(portals, [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 0.35, b[1]], [a[0], 0.35, a[1]]], IRON, { want: [-(a[0] + b[0]) / 2, 0, EYE[1][1] - (a[1] + b[1]) / 2] }); }
  // the bays: the alcove's niche (east, the near landing), a hearth and its anvil (west), a rack of blades (west, the far
  // landing) and the drop-hammer's winch (east)
  const bayArt = add(refFragMesh('Bays', D));
  for (const s of [-1, 1]) for (const [ya, yb] of bays) bay(bayArt, s, ya, yb, 2.4, 2.6, { floor: FLOOR, wall: ASHLAR, lid: ROCK });
  boxFaces(bayArt, 5.95, 3.1, 0, 6.4, 3.7, 0.9, ASHLAR, { skip: '-z+x' });   // the niche's plinth
  boxFaces(bayArt, -6.4, 2.6, 0, -5.6, 4.2, 0.85, ASHLAR, { skip: '-z-x' });   // the hearth
  planeFace(bayArt, [[-6.35, 2.65, 0.86], [-5.65, 2.65, 0.86], [-5.65, 4.15, 0.86], [-6.35, 4.15, 0.86]], MOLTEN);
  boxFaces(bayArt, -5.25, 3.05, 0, -4.75, 3.75, 0.45, IRON, { skip: '-z' });   // the anvil: its foot, waist and face
  boxFaces(bayArt, -5.15, 3.2, 0.45, -4.85, 3.6, 0.7, IRON, { skip: '-z' });
  boxFaces(bayArt, -5.3, 2.9, 0.7, -4.7, 3.95, 0.95, IRON);
  for (const y of [26.9, 28.3]) boxFaces(bayArt, -6.3, y - 0.08, 0, -6.15, y + 0.08, 2.0, IRON, { skip: '-z' });   // the rack
  for (const z of [0.7, 1.3, 1.9]) boxFaces(bayArt, -6.35, 26.85, z, -6.1, 28.35, z + 0.08, IRON);
  for (let k = 0; k < 5; k++) { const y = 27.05 + k * 0.28; planeFace(bayArt, [[-6.05, y, 0.05], [-6.05, y + 0.12, 0.05], [-6.2, y + 0.12, 1.75], [-6.2, y, 1.75]], IRON, { want: [1, 0, 0.1] }); }
  cog(bayArt, 5.9, 27.6, 1.3, 0.95, 12, 0.22, 0.25, IRON);   // the winch's wheel and its lever
  boxFaces(bayArt, 6.0, 27.5, 0, 6.35, 27.7, 1.3, IRON, { skip: '-z' });
  boxFaces(bayArt, 4.7, 27.52, 1.25, 5.8, 27.68, 1.4, IRON);
  // the river of molten iron down the chasm, crusts of slag riding it
  const river = add(refFragMesh('River', D));
  grid(river, 4, 9, (i, j) => [-F.wall - 0.6 + ((2 * F.wall + 1.2) * i) / 4, F.zA + ((F.zB - F.zA) * j) / 9, F.river], MOLTEN, { uv: (i, j, p) => [p[0] * 0.25, p[1] * 0.25] });
  for (const [x, y, w, d] of [[-2.6, 8.4, 1.4, 0.9], [1.9, 13.2, 1.1, 1.3], [-0.6, 19.5, 1.6, 0.8], [3.0, 22.6, 0.9, 1.0], [-3.2, 15.8, 0.8, 1.1]]) boxFaces(river, x - w / 2, y - d / 2, F.river - 0.1, x + w / 2, y + d / 2, F.river + 0.14, ROCK, { skip: '-z' });
  // THE CONVEYORS' BEDS (the Rails ride over them - each bed's rollers and drums 0.1 m under the platform's slab at its
  // farthest travel): girders, rollers, two drums, a cog-wheel at the drive end, trestles down to the river
  const belts = add(refFragMesh('Conveyors', D));
  const oct = RINGS[8].map(([c, s]) => [0.17 * c, 0.17 * s]), dodec = RINGS[12].map(([c, s]) => [0.3 * c, 0.3 * s]);
  for (const [ya, yb] of [F.belt1, F.belt2]) {
    const yc = (ya + yb) / 2, h = 2.6;
    for (const s of [-1, 1]) boxFaces(belts, s * 1.62, yc - h - 0.3, -1.35, s * 1.84, yc + h + 0.3, -0.8, IRON);
    for (let i = 0; i < 9; i++) sweep(belts, [[-1.62, yc - 2.4 + 0.6 * i, -0.95], [1.62, yc - 2.4 + 0.6 * i, -0.95]], oct, IRON);
    for (const e of [-1, 1]) sweep(belts, [[-1.62, yc + e * h, -0.98], [1.62, yc + e * h, -0.98]], dodec, IRON);
    cog(belts, 2.05, yc + h, -0.98, 0.72, 12, 0.18, 0.22, IRON);
    for (const s of [-1, 1]) for (const e of [-1, 1]) boxFaces(belts, s * 1.73 - 0.13, yc + e * 2.2 - 0.13, F.river, s * 1.73 + 0.13, yc + e * 2.2 + 0.13, -1.35, IRON, { skip: '-z+z' });
    for (const e of [-1, 1]) boxFaces(belts, -1.86, yc + e * 2.2 - 0.1, -3.2, 1.86, yc + e * 2.2 + 0.1, -2.95, IRON);
  }
  // THE SLAG WEIR: an iron beam across the chasm at the crust's near edge; the crucibles on the walls and their spouts over
  // each lane's middle, 6.9 m up, their lips molten
  boxFaces(belts, -F.wall - 0.3, F.crust[0] - 0.42, -1.1, F.wall + 0.3, F.crust[0] - 0.08, -0.7, IRON);
  const spouts = add(refFragMesh('Spouts', D));
  for (const s of [-1, 1]) {
    const y = F.crust[0] + 0.3;
    lathe(spouts, s * 4.05, y, [[0.25, 7.25], [0.7, 7.45], [0.9, 8.0], [0.85, 8.55]], 12, IRON, { top: false, foot: true });
    levelDisc(spouts, s * 4.05, y, 8.42, 0.82, 12, MOLTEN);
    sweep(spouts, [[s * 3.5, y, 7.75], [s * 2.05, y, 7.05]], [[-0.3, -0.22], [0.3, -0.22], [0.3, 0.12], [-0.3, 0.12]], IRON);
    levelDisc(spouts, s * 2.15, y, 6.86, 0.24, 8, MOLTEN);
    boxFaces(spouts, s * 4.6, y - 0.18, 6.9, s * 5.0, y + 0.18, 7.3, IRON, { skip: s > 0 ? '+x' : '-x' });   // its bracket
  }
  // THE DROP-HAMMERS: two over each landing's spots, one over each conveyor's middle (the hammer line)
  const hammers = add(refFragMesh('Hammers', D));
  for (const [x, y] of [[-1.8, 3.4], [1.8, 3.4], [-1.8, 27.6], [1.8, 27.6], [0, 11.1], [0, 16.9]]) hammer(hammers, x, y, IRON);
  // the rock mass's hull from portal to portal: its flanks swelling past them, its crown, its torn keel hanging into the void
  const [, , dirs] = rockFaceLoops(FACE_C[0], FACE_C[1], PORTAL, MASS.a, MASS.up, MASS.down);
  const stations = [0, 1.5, 3.5, 5.5, 7.5, 9.5, 11.5, 13.5, 15.5, 17.5, 19.5, 21.5, 23.5, 25.5, 27.5, 29.5, L], last = stations.length - 1;
  const swell = (j) => (j === 0 || j === last ? 0 : j === 1 || j === last - 1 ? 0.45 : 1);
  const crag = (k, j) => { const d = dirs[k][1], g = fbm2(SEED + 3, k * 0.7, stations[j] * 0.45, 4); return swell(j) * (d < -0.5 ? 1.2 + 4.5 * g * g : d < 0 ? 0.6 + 2.0 * g : 0.4 + 1.6 * g); };
  rockHull(add(refFragMesh('Hull', D)), FACE_C[0], FACE_C[1], dirs, stations, (j) => [MASS.a + 0.5 * swell(j), MASS.up + 0.3 * swell(j), MASS.down + 2.0 * swell(j)], crag, ROCK);
  // the forge's three chimneys out of its crown, iron flues glowing at their mouths
  for (const [x, y, h] of [[-2.6, 8.2, 15.2], [2.3, 15.6, 16.4], [-1.4, 23.4, 14.6]]) {
    lathe(iron, x, y, [[0.75, 10.4], [0.75, h - 1.2], [0.95, h - 0.9], [0.95, h - 0.5], [0.7, h]], 12, IRON, { top: false });
    levelDisc(iron, x, y, h - 0.25, 0.7, 12, MOLTEN);
  }

  // ── THE LAW, as named markers
  planeFace(add(refFragMesh('socket.in')), [[-W, 0, 0], [W, 0, 0], [W, 0, H], [-W, 0, H]], 0, { want: [0, -1, 0] });
  planeFace(add(refFragMesh('socket.out.main')), [[-W, L, 0], [W, L, 0], [W, L, H], [-W, L, H]], 0, { want: [0, 1, 0] });
  planeFace(add(refFragMesh('floor.fight.near')), [[-W, 0, 0], [W, 0, 0], [W, F.zA, 0], [-W, F.zA, 0]]);
  planeFace(add(refFragMesh('floor.fight.far')), [[-W, F.zB, 0], [W, F.zB, 0], [W, L, 0], [-W, L, 0]]);
  planeFace(add(refFragMesh('ceil.vault')), [[-W, 0, H], [W, 0, H], [W, L, H], [-W, L, H]], 0, { want: [0, 0, -1] });
  for (const [name, ya, yb] of [['open.mouth', 0, 0.05], ['open.lipnear', F.zA - 0.05, F.zA + 0.05], ['open.lipfar', F.zB - 0.05, F.zB + 0.05], ['open.exit', L - 0.05, L]]) boxFaces(add(refFragMesh(name)), -W - 0.1, ya, -0.05, W + 0.1, yb, 0.05);
  const N = { mouth: [0, 0.9, 0], nearw: [-2.6, 3.4, 0], neare: [2.6, 3.4, 0], lipnear: [0, 5.9, 0], lipfar: [0, 25.1, 0], farw: [-2.6, 27.6, 0], fare: [2.6, 27.6, 0], exit: [0, 30.1, 0] };
  for (const [k, p] of Object.entries(N)) levelDisc(add(refFragMesh(`node.${k}`)), p[0], p[1], p[2], 0.5);
  for (const [k, a, b] of [['mw', 'mouth', 'nearw'], ['me', 'mouth', 'neare'], ['wl', 'nearw', 'lipnear'], ['el', 'neare', 'lipnear'], ['nwe', 'nearw', 'neare'], ['lw', 'lipfar', 'farw'], ['le', 'lipfar', 'fare'], ['wx', 'farw', 'exit'], ['ex', 'fare', 'exit'], ['fwe', 'farw', 'fare']]) walkEdge(add(refFragMesh(`edge.${k}`)), N[a], N[b], 0.2);
  const cube = (name, x, y, z, s = 0.3) => boxFaces(add(refFragMesh(name)), x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  cube('anchor.lurker.near', 3.4, 1.4, 0);
  cube('anchor.lurker.far', -3.4, 29.8, 0);
  cube('anchor.niche.mage', -3.4, 25.6, 0);
  cube('anchor.engine.winch', 3.4, 27.6, 0);
  cube('anchor.hazard.spoutwest', -3.4, F.zB + 0.8, 0);
  cube('anchor.hazard.spouteast', 3.4, F.zB + 0.8, 0);
  // THE SIGNATURE: the hammers (a disc of r 3, told 1.4 s) over each landing's two spots in turn, and the hammer line over
  // each conveyor's middle; the cooling slag's two lanes, 4 m wide, from the crust's near edge onto 1.5 m of the far landing
  // (EG_SLAG_LIP_CM), the east spout half a cycle behind the west (net/eliteGates/egSpanLaw.js egSlagState)
  const spots = (name, pts) => { const m = add(refFragMesh(name)); for (const [x, y] of pts) levelDisc(m, x, y, 0, 3, 16); };
  spots('hazard.hammer.near', [[-1.8, 3.4], [1.8, 3.4]]);
  spots('hazard.hammer.far.ph3000', [[-1.8, 27.6], [1.8, 27.6]]);
  spots('hazard.hammerline.belts.ph1500', [[0, 11.1], [0, 16.9]]);
  planeFace(add(refFragMesh('hazard.slag.west')), [[-4.05, F.crust[0], 0], [-0.05, F.crust[0], 0], [-0.05, F.crust[1] + 1.5, 0], [-4.05, F.crust[1] + 1.5, 0]]);
  planeFace(add(refFragMesh('hazard.slag.east.ph10000')), [[0.05, F.crust[0], 0], [4.05, F.crust[0], 0], [4.05, F.crust[1] + 1.5, 0], [0.05, F.crust[1] + 1.5, 0]]);
  // THE INNER COURSE: the two conveyors in step, and the slag's crust
  boxFaces(add(refFragMesh(`course.rail.belt1.amp${F.railAmp * 100}.per${F.railPer}`)), -1.5, F.belt1[0], -0.6, 1.5, F.belt1[1], 0);
  boxFaces(add(refFragMesh(`course.rail.belt2.amp${F.railAmp * 100}.per${F.railPer}`)), -1.5, F.belt2[0], -0.6, 1.5, F.belt2[1], 0);
  boxFaces(add(refFragMesh('course.slag.crust')), -2, F.crust[0], -0.6, 2, F.crust[1], 0);
  boxFaces(add(refFragMesh('alcove.seam.shard.east')), W + 0.2, bays[0][0], 0, W + 2.4, bays[0][1], 2.6);
  cube('light.band.near', 0, 3.4, 5.6, 0.2);
  cube('light.band.far', 0, 27.6, 5.6, 0.2);
  cube('light.lava.chasm', 0, 13.5, -3.4, 0.2);
  cube('light.lava.slag', 0, 22.7, 2.2, 0.2);
  // THE COLLIDER'S PROXY: the landings, the walls' line (broken at the niche), the niche, the clamp's ceiling and the lips'
  // faces down the chasm - never the drawn mesh
  const P = add(refFragMesh('collider.proxy'));
  const pq = (pts, want) => planeFace(P, pts, 0, { want });
  pq([[-W, 0, 0], [W, 0, 0], [W, F.zA, 0], [-W, F.zA, 0]], [0, 0, 1]);
  pq([[-W, F.zB, 0], [W, F.zB, 0], [W, L, 0], [-W, L, 0]], [0, 0, 1]);
  const [na, nb] = bays[0], low = F.river - 0.5;
  pq([[-W, 0, low], [-W, L, low], [-W, L, H], [-W, 0, H]], [1, 0, 0]);
  for (const [ya, yb, za] of [[0, na, low], [na, nb, 2.6], [nb, L, low]]) pq([[W, ya, za], [W, yb, za], [W, yb, H], [W, ya, H]], [-1, 0, 0]);
  pq([[W, na, low], [W, nb, low], [W, nb, 0], [W, na, 0]], [-1, 0, 0]);
  pq([[W, na, 0], [W + 2.4, na, 0], [W + 2.4, nb, 0], [W, nb, 0]], [0, 0, 1]);
  pq([[W + 2.4, na, 0], [W + 2.4, nb, 0], [W + 2.4, nb, 2.6], [W + 2.4, na, 2.6]], [-1, 0, 0]);
  pq([[W, na, 0], [W + 2.4, na, 0], [W + 2.4, na, 2.6], [W, na, 2.6]], [0, 1, 0]);
  pq([[W, nb, 0], [W + 2.4, nb, 0], [W + 2.4, nb, 2.6], [W, nb, 2.6]], [0, -1, 0]);
  pq([[W, na, 2.6], [W + 2.4, na, 2.6], [W + 2.4, nb, 2.6], [W, nb, 2.6]], [0, 0, -1]);
  pq([[-W, 0, H], [W, 0, H], [W, L, H], [-W, L, H]], [0, 0, -1]);
  pq([[-W, F.zA, low], [W, F.zA, low], [W, F.zA, 0], [-W, F.zA, 0]], [0, 1, 0]);
  pq([[-W, F.zB, low], [W, F.zB, low], [W, F.zB, 0], [-W, F.zB, 0]], [0, -1, 0]);
  return out;
}

/** THE FILE: the scene written as the reference is (tools/egRefFragScene.mjs writeRefFragFbx - Blender's exporter's way). */
export const writeHeroForgeGutFbx = (scene = heroForgeGutScene()) => writeRefFragFbx(scene);

if (isMain(import.meta.url)) {
  const outPath = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, HERO_FORGE_GUT_FBX));
  const bytes = writeHeroForgeGutFbx();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  console.log(`${outPath}: ${heroForgeGutScene().length} objects, ${bytes.length} bytes`);
}
