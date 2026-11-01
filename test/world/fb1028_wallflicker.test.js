// FIELD BUGS 2026-10-28, "Wall Graphics Flicker" (#bug-reports: "The city wall at the entrance of Riften has texture
// flicker"; WALL-FLICKER). A length's end stands in a bend tower's body, the wall's own
// thickness: where the line runs straight through a tower its faces lay in the tower's, both drawn - Riften's gate is
// on a straight run, the tower north of it 154 m2 of faces in one plane. world/townWalls.js clearOfTowers cuts every length
// and gate clear of the bodies; and the town's fabric lays no paving in the plane of a gate's floor (townFabricStand.js).
// Pinned on shapes (no data), and on the game's own pieces at every twentieth walled city on the Bay and past it, at
// Riften, and at four towns whose blocks pave under a gate (ARENA2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as walls from '../../src/world/townWalls.js';
import { bayRoads } from '../bayRoads.mjs';

const { townWallModel, WALL_MODELS, CORNER_TOWER } = walls;
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

// ── shapes ──────────────────────────────────────────────────────

/** Faces (quads, `n` the outward normal) to dfMeshToModel's shape: a submesh a picture. */
function modelOf(faces) {
  const byTex = new Map();
  for (const f of faces) { const k = f.tex.join('/'); if (!byTex.has(k)) byTex.set(k, []); byTex.get(k).push(f); }
  const positions = [], normals = [], uvs = [], subMeshes = [];
  for (const [k, fs] of byTex) {
    const startIndex = positions.length / 3;
    for (const f of fs) for (const i of [0, 1, 2, 0, 2, 3]) { positions.push(...f.q[i]); normals.push(...f.n); uvs.push(i & 1, i >> 1); }
    const [a, r] = k.split('/').map(Number);
    subMeshes.push({ textureArchive: a, textureRecord: r, startIndex, primitiveCount: fs.length * 2 });
  }
  const n = positions.length / 3;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: Uint32Array.from({ length: n }, (_, i) => i), subMeshes };
}
/** Daggerfall's corner tower in outline (ARCH3D 444's measure - test/world/townbends.test.js's): its body, its two stubs, its crown. */
function cornerTower() {
  const faces = [], quad = (a, b, c, d, n, tex = [317, 0]) => faces.push({ q: [a, b, c, d], n, tex });
  const [x0, x1, z0, z1] = CORNER_TOWER.body, C = CORNER_TOWER.crown;
  quad([x0, 0, z0], [x0, 0, z1], [x0, C, z1], [x0, C, z0], [-1, 0, 0]);
  quad([x0, 0, z1], [x1, 0, z1], [x1, C, z1], [x0, C, z1], [0, 0, 1]);
  quad([x1, 6.45, z0], [x1, 6.45, z1], [x1, C, z1], [x1, C, z0], [1, 0, 0]);
  quad([x0, 6.45, z0], [x1, 6.45, z0], [x1, C, z0], [x0, C, z0], [0, 0, -1]);
  quad([x0, 0, -8.35], [x0, 0, z0], [x0, 8.05, z0], [x0, 8.05, -8.35], [-1, 0, 0]);
  quad([x1, 0, z1], [8.4, 0, z1], [8.4, 8.05, z1], [x1, 8.05, z1], [0, 0, 1]);
  quad([-8.4, 14.45, -2.7], [2.8, 14.45, -2.7], [2.8, 14.45, 8.35], [-8.4, 14.45, 8.35], [0, 1, 0]);
  return modelOf(faces);
}
/** A length of wall in outline (445's): its faces 9.6 m apart to its walk at 6.45 m, and at its +x end a turret to 10.85 m
 *  closed at that end; `passage`, a gate's side of its way through at x -8.05 (446's), facing in; `tall`, a mod's top
 *  over the crowns. */
function length({ passage = false, tall = false } = {}) {
  const faces = [], quad = (a, b, c, d, n, tex = [317, 0]) => faces.push({ q: [a, b, c, d], n, tex });
  const H = tall ? 14 : 6.45;
  quad([-12.8, 0, 4.8], [12.8, 0, 4.8], [12.8, H, 4.8], [-12.8, H, 4.8], [0, 0, 1]);
  quad([12.8, 0, -4.8], [-12.8, 0, -4.8], [-12.8, H, -4.8], [12.8, H, -4.8], [0, 0, -1]);
  quad([-12.8, 6.45, 4.8], [12.8, 6.45, 4.8], [12.8, 6.45, -4.8], [-12.8, 6.45, -4.8], [0, 1, 0], [317, 2]);
  quad([6.4, 6.45, 4.8], [12.8, 6.45, 4.8], [12.8, 10.85, 4.8], [6.4, 10.85, 4.8], [0, 0, 1]);
  quad([12.8, 6.45, -4.8], [6.4, 6.45, -4.8], [6.4, 10.85, -4.8], [12.8, 10.85, -4.8], [0, 0, -1]);
  quad([6.4, 10.85, 4.8], [12.8, 10.85, 4.8], [12.8, 10.85, -4.8], [6.4, 10.85, -4.8], [0, 1, 0]);
  quad([6.4, 6.45, -4.8], [6.4, 6.45, 4.8], [6.4, 10.85, 4.8], [6.4, 10.85, -4.8], [-1, 0, 0]);
  quad([12.8, 6.45, 4.8], [12.8, 6.45, -4.8], [12.8, 10.85, -4.8], [12.8, 10.85, 4.8], [1, 0, 0]);
  if (passage) quad([-8.05, 0, 4.8], [-8.05, 0, -4.8], [-8.05, 5, -4.8], [-8.05, 5, 4.8], [1, 0, 0], [317, 1]);
  return modelOf(faces);
}
/** A bend through a tower at the origin facing +z: a length west of it ending in its middle (its turret there), a length
 *  or a gate east of it beginning there, the line turned `deg` degrees (convex), `stretch` the east piece's. AUDIT FB1028:
 *  the tower grown across as wallPieces mints it (`thick`, never under 1 + TOWER_PROUD / 4.8). */
function bend(deg, { east = WALL_MODELS.wall, stretch = 1 } = {}) {
  const f = (deg * Math.PI) / 360, c = Math.cos(f), s = Math.sin(f), L = 12.8;
  return [
    { model: WALL_MODELS.wall, at: /** @type {[number, number]} */ ([-L * c, -L * s]), out: /** @type {[number, number]} */ ([-s, c]), stretch: 1 },
    { model: east, at: /** @type {[number, number]} */ ([L * stretch * c, -L * stretch * s]), out: /** @type {[number, number]} */ ([s, c]), stretch },
    { model: WALL_MODELS.tower, at: /** @type {[number, number]} */ ([0, 0]), out: /** @type {[number, number]} */ ([0, 1]), stretch: 1, thick: (4.8 / c + walls.TOWER_PROUD) / 4.8 },
  ];
}

/** Pieces turned `deg` degrees about the origin. */
const turned = (pieces, deg) => {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180), r = ([x, z]) => /** @type {[number, number]} */ ([x * c - z * s, x * s + z * c]);
  return pieces.map((p) => ({ ...p, at: r(p.at), out: r(p.out) }));
};

// ── the measures ────────────────────────────────────────────────

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A model's triangles: corners, unit normal (the winding's). */
function triangles(m) {
  const out = [];
  for (let t = 0; t + 2 < m.indices.length; t += 3) {
    const q = [0, 1, 2].map((k) => { const i = m.indices[t + k]; return [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]; });
    const n = cross(q[1].map((x, a) => x - q[0][a]), q[2].map((x, a) => x - q[0][a])), l = Math.hypot(...n);
    out.push({ q, n: l ? n.map((x) => x / l) : [0, 0, 0], area: l / 2 });
  }
  return out;
}
/** The part of a convex polygon where `f` is 0 or more. */
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push(a.map((x, k) => x + (b[k] - x) * t)); }
  }
  return out;
}
/** The area where triangle B, facing as A (within 2 degrees), lies over A within `eps` of A's plane - two faces the depth
 *  buffer cannot tell apart. */
function fightArea(A, B, eps) {
  if (dot(A.n, B.n) < Math.cos(Math.PI / 90)) return 0;
  const d = dot(A.n, A.q[0]), hs = B.q.map((p) => dot(A.n, p) - d);
  if (Math.min(...hs) > eps || Math.max(...hs) < -eps) return 0;
  const g = Math.abs(A.n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u0 = cross(g, A.n), lu = Math.hypot(...u0), u = u0.map((x) => x / lu), w = cross(A.n, u);
  let poly = B.q.map((p, i) => [dot(u, p), dot(w, p), hs[i]]);
  const a2 = A.q.map((p) => [dot(u, p), dot(w, p)]), s = Math.sign((a2[1][0] - a2[0][0]) * (a2[2][1] - a2[0][1]) - (a2[1][1] - a2[0][1]) * (a2[2][0] - a2[0][0]));
  for (let i = 0; i < 3 && poly.length > 2; i++) { const a = a2[i], b = a2[(i + 1) % 3]; poly = clip(poly, (p) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]))); }
  poly = clip(clip(poly, (p) => eps - p[2]), (p) => p[2] + eps);
  let area = 0, across = 0;
  for (let i = 0; i < poly.length; i++) {
    area += poly[i][0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * poly[i][1];
    for (const q of poly) across = Math.max(across, Math.hypot(q[0] - poly[i][0], q[1] - poly[i][1]));
  }
  // two faces that only meet along an edge: a sliver of the floats' own, under a millimetre wide
  return Math.abs(area) / 2 < 1e-3 * across ? 0 : Math.abs(area) / 2;
}
/** Every two triangles of a model that fight (fightArea, over a 4 m grid): their area, m2. */
function fights(m, eps) {
  const tris = triangles(m).filter((t) => t.area > 0), cells = new Map();
  tris.forEach((t, i) => {
    const xs = t.q.map((p) => p[0]), zs = t.q.map((p) => p[2]);
    for (let gx = Math.floor(Math.min(...xs) / 4); gx <= Math.floor(Math.max(...xs) / 4); gx++) for (let gz = Math.floor(Math.min(...zs) / 4); gz <= Math.floor(Math.max(...zs) / 4); gz++) {
      const k = `${gx},${gz}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i);
    }
  });
  const seen = new Set();
  let area = 0;
  for (const list of cells.values()) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const key = list[x] * 1048576 + list[y];
    if (seen.has(key)) continue;
    seen.add(key);
    area += Math.max(fightArea(tris[list[x]], tris[list[y]], eps), fightArea(tris[list[y]], tris[list[x]], eps));
  }
  return area;
}
/** The face a ray from `o` along `d` meets first within `far` among `tris`: 1 one turned to it, -1 a back face, 0 none. */
function firstFace(tris, o, d, far) {
  let best = far, face = 0;
  for (const t of tris) {
    const e1 = t.q[1].map((x, a) => x - t.q[0][a]), e2 = t.q[2].map((x, a) => x - t.q[0][a]), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const sv = o.map((x, a) => x - t.q[0][a]), u = dot(sv, h) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(sv, e1), v = dot(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    const tt = dot(e2, q) / det;
    if (tt > 1e-6 && tt < best) { best = tt; face = dot(t.n, d) < 0 ? 1 : -1; }
  }
  return face;
}
/** Rays at each tower - level from both sides of the wall (square to it and 35 degrees off, to the turrets' height, across
 *  the tower and its lengths' ends), and down from above onto its walks: how many meet a back face first (an open end seen)
 *  and how many meet nothing. */
function openings(m, towers) {
  const tris = triangles(m).filter((t) => t.area > 0);
  let back = 0, none = 0;
  const count = (f) => { if (f === -1) back++; if (f === 0) none++; };
  for (const tw of towers) {
    const U = [tw.out[1], 0, -tw.out[0]], O = [tw.out[0], 0, tw.out[1]];
    // every triangle a ray can meet: its box within 40 m of the tower (a ray starts within 15 m of it, 24 m long)
    const near = tris.filter((t) => [0, 2].every((k, j) => Math.min(...t.q.map((p) => p[k])) < tw.at[j] + 40 && Math.max(...t.q.map((p) => p[k])) > tw.at[j] - 40));
    for (const y of [0.5, 4, 7.5, 10.5]) {
      const level = near.filter((t) => Math.min(...t.q.map((p) => p[1])) <= y && Math.max(...t.q.map((p) => p[1])) >= y);   // a level ray meets these alone
      for (const side of [1, -1]) for (let al = -9; al <= 9; al += 1.5) for (const turn of [-0.6, 0, 0.6]) {
        const d = [-side * (O[0] * Math.cos(turn) - O[2] * Math.sin(turn)), 0, -side * (O[0] * Math.sin(turn) + O[2] * Math.cos(turn))];
        count(firstFace(level, [tw.at[0] + U[0] * al + O[0] * side * 9 - d[0] * 3, y, tw.at[1] + U[2] * al + O[2] * side * 9 - d[2] * 3], d, 24));
      }
    }
    for (let al = -12; al <= 12; al += 1.5) for (let ou = -6; ou <= 6; ou += 1.5) count(firstFace(near, [tw.at[0] + U[0] * al + O[0] * ou, 30, tw.at[1] + U[2] * al + O[2] * ou], [0, -1, 0], 40));
  }
  return { back, none };
}
/** The wall as TS8 stood it: each piece's model whole, side by side. */
/** The pieces each made alone, as #1184 made them - FB1028's bend towers not grown across (`thick`); `grown`, as grown. */
const whole = (pieces, classic, grown = false) => {
  const parts = pieces.map(({ thick, ...p }) => townWallModel([grown ? { ...p, thick } : p], classic));
  const n = parts.reduce((s, m) => s + m.positions.length / 3, 0), positions = new Float32Array(n * 3), indices = [];
  let v0 = 0;
  for (const m of parts) { positions.set(m.positions, v0 * 3); for (const i of m.indices) indices.push(i + v0); v0 += m.positions.length / 3; }
  return { positions, indices };
};

// ── the law, on shapes ──────────────────────────────────────────

test('WALL-FLICKER the cut: a length\'s and a gate\'s faces cut clear of a bend tower\'s body - straight through it none of their faces in its sides\' planes (166 m2 were), at a turn of a degree none within 4 cm of them, at a sharp bend no walk on the next one\'s; no opening seen, the tower whole (mutants: no cut; no clearance; the clearance short; out or along unread; the mitre gone or on every face; the side flipped; the tower cut)', () => {
  const tower = cornerTower(), len = length(), gate = length({ passage: true });
  const classic = (id) => (id === WALL_MODELS.tower ? tower : id === WALL_MODELS.gate ? gate : len);
  assert.equal(walls.TOWER_CLEAR, 0.05, 'the clearance: past the depth buffer\'s step at 400 m');
  // straight through a tower: whole, the four half sides in one plane with a length's faces
  const straight = bend(0);
  const was = fights(whole(straight, classic), 1e-3);
  assert.ok(Math.abs(was - (4 * 4.8 * 6.45 + 2 * 4.8 * 4.4)) < 0.01, `whole: each length's faces over half of each of the tower's two sides, the turret's too (${was})`);
  for (const frame of [0, 37]) for (const [deg, what] of [[0, 'straight'], [0.002, 'a hair off straight'], [1, 'a degree'], [3, 'three degrees, the inner face past the grown body'], [8, 'eight degrees'], [50, 'a sharp bend']]) {
    const pieces = turned(bend(deg), frame), m = townWallModel(pieces, classic), now = fights(m, 0.04);
    assert.ok(now < 1e-6, `${what}, the frame turned ${frame}: no two faces within 4 cm over each other (${now} m2)`);
    const b = openings(whole(pieces, classic, true), [pieces[2]]), a = openings(m, [pieces[2]]);
    assert.ok(a.back <= b.back && a.none <= b.none, `${what}, the frame turned ${frame}: no opening seen (${JSON.stringify(b)} whole, ${JSON.stringify(a)} cut)`);
  }
  assert.ok(fights(whole(bend(1), classic), 0.04) > 1, 'a degree, whole: a strip of faces within 4 cm');
  assert.ok(fights(whole(bend(50), classic), 1e-3) > 0.1, 'a sharp bend, whole: the walks over each other');
  // a gate stretched so its way's side stands a centimetre from the tower's: cut too
  const g = bend(1, { east: WALL_MODELS.gate, stretch: 1.012 });
  assert.ok(fights(whole(g, classic), 0.04) > 1 && fights(townWallModel(g, classic), 0.04) < 1e-6, 'the gate\'s way: its side clear of the tower\'s');
  // in the tower's body under its crown, the tower alone: its four sides whole, nothing of a length's
  // PIN MOVED: the body as grown across (`thick`), its two sides along that much wider
  const inBody = (m, th) => triangles(m).filter((t) => t.q.every((p) => Math.abs(p[0]) <= 4.8 + 1e-3 && Math.abs(p[2]) <= 4.8 * th + 1e-3 && p[1] <= CORNER_TOWER.crown + 1e-3)).reduce((s, t) => s + t.area, 0);
  const sides = (th) => 2 * 9.6 * (1 + th) * CORNER_TOWER.crown;
  assert.ok(Math.abs(inBody(townWallModel([straight[2]], classic), straight[2].thick) - sides(straight[2].thick)) < 0.01, 'the tower: its four sides');
  for (const deg of [0, 1, 50]) { const ps = bend(deg), th = ps[2].thick; assert.ok(Math.abs(inBody(townWallModel(ps, classic), th) - sides(th)) < 0.01, `${deg} degrees: the tower whole, nothing else in its body`); }
});

test('WALL-FLICKER what is kept: a part no bend tower reaches handed back as it was; a tower not of 444\'s measure cuts nothing; a mod\'s length over the crowns keeps its top; no sliver (mutants: always rebuilt; the measure unread; the crown unread; slivers kept)', () => {
  const tower = cornerTower(), len = length();
  const classic = (id) => (id === WALL_MODELS.tower ? tower : len);
  const far = { model: WALL_MODELS.wall, at: /** @type {[number, number]} */ ([500, 500]), out: /** @type {[number, number]} */ ([0, 1]), stretch: 1 };
  const alone = townWallModel([far], classic), part = { positions: alone.positions, normals: alone.normals, uvs: alone.uvs, indices: alone.indices, subMeshes: alone.subMeshes };
  assert.equal(walls.clearOfTowers(part, [{ at: [0, 0], out: [0, 1] }]), part, 'no tower near: the same part');
  // a mod's tower, a tenth larger: not a bend's body - nothing cut
  const big = modelOf([{ q: [[-9.24, 0, -9.2], [9.24, 0, -9.2], [9.24, 15, 9.2], [-9.24, 15, 9.2]], n: [0, 0, -1], tex: [317, 0] }]);
  const mod = (id) => (id === WALL_MODELS.tower ? big : len), straight = bend(0);
  const areaIn = (m) => triangles(m).reduce((s, t) => {
    let q = t.q;
    for (const f of [(p) => 4.801 - p[0], (p) => p[0] + 4.801, (p) => 4.801 - p[2], (p) => p[2] + 4.801, (p) => CORNER_TOWER.crown + 1e-3 - p[1]]) q = q.length > 2 ? clip(q, f) : q;
    let a = 0;
    for (let k = 1; k + 1 < q.length; k++) a += Math.hypot(...cross(q[k].map((x, i) => x - q[0][i]), q[k + 1].map((x, i) => x - q[0][i]))) / 2;
    return s + a;
  }, 0);
  const lengthsIn = (of) => areaIn(townWallModel(straight, of)) - areaIn(townWallModel([straight[2]], of));
  assert.ok(lengthsIn(mod) > 50 && Math.abs(lengthsIn(classic)) < 0.5, 'a mod\'s tower: the lengths not cut clear of a 444 body (beside the corner tower, none of them in it)');
  // a mod's taller length: its faces over the crown kept
  const tall = length({ tall: true }), tallOf = (id) => (id === WALL_MODELS.tower ? tower : tall);
  // the area of its upright faces over the crown
  const top = (m) => triangles(m).filter((t) => Math.abs(t.n[1]) < 0.5).reduce((s, t) => {
    const q = clip(t.q, (p) => p[1] - CORNER_TOWER.crown);
    let a = 0;
    for (let k = 1; k + 1 < q.length; k++) a += Math.hypot(...cross(q[k].map((x, i) => x - q[0][i]), q[k + 1].map((x, i) => x - q[0][i]))) / 2;
    return s + a;
  }, 0);
  const tops = [townWallModel(straight, tallOf), townWallModel(straight.slice(0, 2), tallOf), townWallModel([straight[2]], tallOf)].map(top);
  assert.ok(tops[1] > 1 && Math.abs(tops[0] - tops[1] - tops[2]) < 1e-3, `over the crown: as it stood (${tops})`);
  // no sliver: every triangle a twentieth of a millimetre across at the least (twice its area over its longest side)
  const across = (t) => (2 * t.area) / Math.max(...[0, 1, 2].map((k) => Math.hypot(...t.q[(k + 1) % 3].map((x, i) => x - t.q[k][i]))));
  for (const deg of [0, 0.002, 1, 8, 50]) assert.ok(triangles(townWallModel(bend(deg), classic)).every((t) => across(t) > 5e-5), `${deg} degrees: no sliver`);
});

test('WALL-FLICKER a breath at a time: the wall\'s model made WALL_PIECES_A_BREATH pieces between two breaths, the same model (mutants: no breath)', async () => {
  const tower = cornerTower(), len = length({ passage: true }), classic = (id) => (id === WALL_MODELS.tower ? tower : len);
  const pieces = Array.from({ length: 20 }, (_, k) => turned(bend(3 * k), 18 * k).map((p) => ({ ...p, at: /** @type {[number, number]} */ ([p.at[0] + 60 * k, p.at[1]]) }))).flat();
  let breaths = 0;
  const sliced = await walls.townWallModelSliced(pieces, classic, async () => { breaths++; }), m = townWallModel(pieces, classic);
  assert.equal(breaths, Math.floor(pieces.length / walls.WALL_PIECES_A_BREATH), `${breaths} breaths over ${pieces.length} pieces`);
  assert.deepEqual([sliced.positions, sliced.indices, sliced.subMeshes], [m.positions, m.indices, m.subMeshes]);
});

// ── the game's own pieces ───────────────────────────────────────

test('WALL-FLICKER with ARENA2: Daggerfall\'s own pieces at every twentieth walled city on the Bay (TS7, the packs off, Basic Roads\' roads) and past it (a road every way) - whole, faces in one plane in every one; cut, none within 4 cm of each other anywhere; no opening seen at their towers (mutants: no cut; the mitre on every face)', { skip: skipReal, timeout: 900_000 }, async () => {
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { wallBayCity, TOWN_OUTLINE_BLOCK } = await import('../../src/world/townOutline.js');
  const { isWallCarrier } = await import('../../src/world/townShape.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const classic = (id) => { if (!models.has(id)) models.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 64, height: 64 }))); return models.get(id); };
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rmbOf = (n) => (isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? null : blocks.getBlockByName(n)?.rmbBlock ?? null);
  const { roads: roadsB, tracks: tracksB } = bayRoads();   // The Bay's own network
  const all = [];
  let k = 0;
  for (let r = 0; r < 62; r++) {
    const reg = maps.getRegion(r);
    for (let l = 0; reg && l < reg.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.exterior?.exteriorData?.blockNames?.some((x) => /^WALLAA/.test(x)) || !wallBayCity(loc, maps, blocks) || k++ % 20) continue;
      const px = Math.trunc(loc.mapTableData.longitude / 128), py = 499 - Math.trunc(loc.mapTableData.latitude / 128), i = py * 1000 + px;
      all.push([loc.name, walls.townWall(loc, loc.exterior.exteriorData.wallTook, rmbOf, { roads: roadsB[i], tracks: tracksB[i], curved: false }).pieces]);
    }
  }
  const bay = all.length;
  const { openSweep, sweepClone, ROADS_EVERY_WAY } = await import('../../tools/townBoardsSweep.mjs');
  const sw = await openSweep(ARENA2);
  walls.setTownWallPaths(() => ({ roads: ROADS_EVERY_WAY, tracks: 0, curved: true }));
  try {
    for (let j = 0; j < sw.templates['city-state'].length; j += 20) all.push([`past the Bay #${j}`, walls.townWallOf(sweepClone(sw, 'city-state', j)).pieces]);
  } finally { walls.setTownWallPaths(null); }
  assert.ok(bay >= 20 && all.length - bay >= 20, `${bay} on the Bay, ${all.length - bay} past it`);
  let before = 0, n = 0;
  const size = { whole: [0, 0], cut: [0, 0] };
  for (const [name, pieces] of all) {
    const w = whole(pieces, classic), m = townWallModel(pieces, classic), was = fights(w, 1e-3);
    assert.ok(was > 30, `${name}, whole: ${was.toFixed(1)} m2 of faces in one plane`);
    before += was;
    const now = fights(m, 0.04);
    assert.ok(now < 1e-3, `${name}: no two faces within 4 cm of each other (${now} m2)`);
    size.whole[0] += w.positions.length / 3; size.whole[1] += w.indices.length / 3; size.cut[0] += m.positions.length / 3; size.cut[1] += m.indices.length / 3;
    if (n++ % 7) continue;
    const towers = pieces.filter((p) => p.model === WALL_MODELS.tower), b = openings(w, towers), a = openings(m, towers);
    assert.ok(a.back <= b.back && a.none <= b.none, `${name}: no opening seen (${JSON.stringify(b)} whole, ${JSON.stringify(a)} cut)`);
  }
  assert.ok(before > 1000 * all.length / 2, `whole: ${before.toFixed(0)} m2 over ${all.length} walls`);
  // the cut's cost: corners and triangles (its own corners kept once)
  // PIN MOVED (FB1028, the Bay's walls: each length mitred on its towers' middle lines too): 12.0 per cent more triangles measured
  assert.ok(size.cut[0] < 1.15 * size.whole[0] && size.cut[1] < 1.15 * size.whole[1], `corners and triangles ${JSON.stringify(size)}`);
});

test('WALL-FLICKER with ARENA2: Riften as the places host stands it (Skyrim\'s fourth city, Gothbrone Hall\'s grid, its one road from the east) - its gate\'s two towers, where the line turns, faces in their sides\' planes whole; the straight run south of it 154 m2 at a tower; none cut; the model door makes it a breath at a time (mutants: no cut; the door unsliced)', { skip: skipReal, timeout: 300_000 }, async () => {
  const { openSweep } = await import('../../tools/townBoardsSweep.mjs');
  const { arenaTemplates, arenaTemplateOf, synthesizeArenaLocation, arenaPlaceId } = await import('../../src/world/arenaLocations.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { outlineTownLocation, townOutlineBlockJson } = await import('../../src/world/townOutline.js');
  const { DIR } = await import('../../src/world/road/roadNetwork.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const sw = await openSweep(ARENA2);
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const classic = (id) => dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 64, height: 64 }));
  // the place as the freeware's trace stands it (scenes/tamrielPlacesHost.js arenaLocationAt): Bay pixel (2356, 77), its
  // pixel's roads the roads' worker's - one road, from the east; its template off MAPS.BSA's own rows (scenes/world.js
  // classicRow: a row a town pack replaced read again past the door)
  const place = { province: 'Skyrim', provinceIndex: 2, id: 3, kind: 'city-state', name: 'Riften', bx: 2356, by: 77 };
  const classicRow = (row) => (sw.maps.locationReplaced(row.regionIndex, row.locationIndex) ? sw.maps.readClassicLocation(row.regionIndex, row.locationIndex) : row);
  const template = arenaTemplateOf(arenaTemplates(sw.rows.map(classicRow).filter(Boolean), isMainStoryDungeon), place);
  assert.equal(template.name, 'Gothbrone Hall');
  const loc = outlineTownLocation(synthesizeArenaLocation(template, place), sw.io);
  assert.equal(loc.mapTableData.mapId, arenaPlaceId(place));
  walls.setTownWallPaths(() => ({ roads: DIR.E, tracks: 0, curved: true }));
  let wall;
  try { wall = walls.standTownWall(loc, template.exterior.exteriorData.blockNames, sw.io, townOutlineBlockJson); } finally { walls.setTownWallPaths(null); }
  const gates = wall.pieces.filter((p) => p.model === WALL_MODELS.gate);
  assert.equal(gates.length, 1, 'one gate, its road\'s');
  const [gate] = gates, from = (p, q) => Math.hypot(p.at[0] - q.at[0], p.at[1] - q.at[1]);
  assert.deepEqual([...gate.at.map((v) => Math.round(v * 10) / 10), ...gate.out.map((v) => Math.round(v * 1000) / 1000 + 0)], [630.2, 355.2, 1, 0.018], 'facing east');
  const towers = wall.pieces.filter((p) => p.model === WALL_MODELS.tower);
  const beside = (t) => wall.pieces.filter((p) => p.model !== WALL_MODELS.tower && from(p, t) < 13);
  const straight = (t) => beside(t).every((p) => Math.abs(p.out[0] * t.out[0] + p.out[1] * t.out[1]) > Math.cos(1e-4));
  const measured = (t) => [fights(whole([t, ...beside(t)], classic), 1e-3), fights(townWallModel([t, ...beside(t)], classic), 0.04)];
  // the gate's two towers, south and north: the line turns at each, and the gate's faces lie in their sides' planes whole
  const atGate = towers.filter((t) => from(t, gate) < 13).sort((a, b) => a.at[1] - b.at[1]);
  assert.ok(atGate.length === 2 && atGate.every((t) => beside(t).length === 2 && !straight(t)), 'two towers, the line turning at each');
  atGate.map(measured).forEach(([was, now], k) => {
    assert.ok(Math.abs(was - [4.37, 2.14][k]) < 0.1, `whole: ${was.toFixed(2)} m2 of the gate's faces in the tower's sides' planes`);
    assert.ok(now < 1e-3, `cut: none (${now} m2)`);
  });
  // the straight run south of the gate, on the face its road comes to: the nearest tower the line runs straight through
  const run = towers.filter((t) => beside(t).length === 2 && straight(t) && Math.abs(t.at[0] - gate.at[0]) < 1).sort((a, b) => from(a, gate) - from(b, gate))[0];
  assert.deepEqual(run.at.map((v) => Math.round(v * 10) / 10), [630.4, 291.1], 'the run\'s tower');
  const [was, now] = measured(run);
  assert.ok(Math.abs(was - 154.56) < 0.1, `whole: ${was.toFixed(2)} m2 of the two lengths' faces in the tower's sides' planes`);
  assert.ok(now < 1e-3, 'cut: none');
  const m = townWallModel(wall.pieces, classic);
  assert.ok(fights(m, 0.04) < 1e-3, 'its whole wall: none');
  // the model door makes it a breath at a time, the same model
  const { customModelBuilt } = await import('../../src/world/customModels.js');
  let breaths = 0;
  const built = await customModelBuilt(walls.townWallModelId(loc.mapTableData.mapId), { classicModel: classic }, async () => { breaths++; });
  assert.ok(breaths >= wall.pieces.length / walls.WALL_PIECES_A_BREATH - 1 && built.indices.length === m.indices.length, `${breaths} breaths, ${built.indices.length} indices`);
});

// ── the town's fabric at its gates ──────────────────────────────

test('WALL-FLICKER a wall\'s cells grown: every town-map cell a piece\'s footprint touches, grown a cell\'s half diagonal (mutants: the growth unread)', () => {
  const gate = { model: WALL_MODELS.gate, at: /** @type {[number, number]} */ ([51.2, 51.2]), out: /** @type {[number, number]} */ ([0.6, 0.8]), stretch: 1 };
  const count = (c) => c.reduce((s, v) => s + v, 0);
  const own = walls.townWallCells({ pieces: [gate] }, 1, 1), grown = walls.townWallCells({ pieces: [gate] }, 1, 1, 1.6 * Math.SQRT1_2);
  assert.ok(count(grown) > count(own) + 30, `${count(own)} cells, grown ${count(grown)}`);
  // every cell a point of the footprint lies in is a grown cell (some of them not the wall's own: their middles outside)
  const u = [gate.out[1], -gate.out[0]];
  let missed = 0;
  for (let a = -12.8; a <= 12.8; a += 0.2) for (let o = -4.8; o <= 4.8; o += 0.2) {
    const cx = Math.floor((gate.at[0] + u[0] * a + gate.out[0] * o) / 1.6), cz = Math.floor((gate.at[1] + u[1] * a + gate.out[1] * o) / 1.6);
    assert.equal(grown[cz * 64 + cx], 1, `the cell (${cx}, ${cz}) under (${a.toFixed(1)}, ${o.toFixed(1)})`);
    if (!own[cz * 64 + cx]) missed++;
  }
  assert.ok(missed > 0, 'the footprint reaches cells whose middles lie outside it');
});

test('WALL-FLICKER with ARENA2: the fabric of a city past the Bay keeps off its wall (a road every way; five templates the sweep found - four whose blocks pave under a gate, one whose yard fenced along a length) - planned on its whole grid, its faces lay in the wall\'s; through the stand, no cell the wall touches is laid and none of its faces lies within 4 cm of the wall\'s (mutants: the wall unread; its cells not grown)', { skip: skipReal, timeout: 600_000 }, async () => {
  const { openSweep, sweepClone, sweepPlan, sweepBlocks, ROADS_EVERY_WAY } = await import('../../tools/townBoardsSweep.mjs');
  const { townFabricModel } = await import('../../src/world/urban/townFabricModel.js');
  const { fabricGrid, planSteps } = await import('../../src/world/urban/townFabric.js');
  const { fabricBlockOf, fabricEnds } = await import('../../src/world/urban/townFabricStand.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const sw = await openSweep(ARENA2);
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const models = new Map();
  const classic = (id) => { if (!models.has(id)) models.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 64, height: 64 }))); return models.get(id); };
  /** two models' faces against each other alone: the fights of both together less each one's own */
  const across = (a, b) => {
    const both = { positions: new Float32Array([...a.positions, ...b.positions]), indices: [...a.indices, ...Array.from(b.indices, (i) => i + a.positions.length / 3)] };
    return fights(both, 0.04) - fights(a, 0.04) - fights(b, 0.04);
  };
  walls.setTownWallPaths(() => ({ roads: ROADS_EVERY_WAY, tracks: 0, curved: true }));
  try {
    for (const [j, least] of [[26, 1], [42, 1], [128, 1], [380, 1], [240, 0.1]]) {
      const loc = sweepClone(sw, 'city-state', j), wall = walls.townWallOf(loc), ed = loc.exterior.exteriorData, m = townWallModel(wall.pieces, classic);
      // planned on its whole grid, as the stand planned it before (no cell of its wall's off): faces in the wall's
      const at = new Map(sweepBlocks(sw, loc).map((b) => [b.y * ed.width + b.x, b]));
      const grid = fabricGrid(ed.width, ed.height, (bx, by) => fabricBlockOf(at.get(by * ed.width + bx))), { mains, ends, centre } = fabricEnds(loc, grid.W, grid.H);
      const steps = planSteps(grid, { ends, centre, seed: loc.mapTableData.mapId >>> 0, mains });
      let r = steps.next();
      while (!r.done) r = steps.next();
      const was = across(m, townFabricModel(r.value, 'imperial', { cobbles: true, classicModel: classic }));
      assert.ok(was > least, `#${j}, its whole grid: ${was.toFixed(2)} m2 of its faces in the wall's`);
      // through the stand: off every cell its wall touches
      const { plan } = await sweepPlan(sw, loc, null, null), touched = walls.townWallCells(wall, ed.width, ed.height, 1.6 * Math.SQRT1_2);
      assert.ok(plan.kind.every((k, i) => !touched[i] || k === 0), `#${j}: nothing laid where its wall stands`);
      const now = across(m, townFabricModel(plan, 'imperial', { cobbles: true, classicModel: classic }));
      assert.ok(now < 1e-3, `#${j}: ${now} m2 of the fabric's faces within 4 cm of its wall's`);
    }
  } finally { walls.setTownWallPaths(null); }
});
