// POI-5 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE UV EDITOR'S GEOMETRY.
// Mac, asked what "UV map" covers: "Full UV editor" - select vertices, edges, faces and islands; move, rotate, scale;
// seams; unwrap; pack.
//   - the session (src/poi/uv/uvMesh.js): a mesh's corners welded into its surface, the model's own seams found, its
//     islands; back to a mesh split exactly where the UVs part;
//   - the tools: corners moved, turned and sized; the projections (planar, box, cylindrical, spherical) in metres and
//     unmirrored as each face is seen from its front; the LSCM unwrap (a flat island laid true to its lengths and
//     angles, a curved one with little stretch); the packing (every island in the square, none over another, margins
//     kept); the texel density read and set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  uvSessionOf, islandsOf, setSeam, edgeKey, cornersOf, uvVertexCorners, transformCorners, uvBounds, projectPlanar,
  projectBox, projectCylinder, projectSphere, unwrapLscm, packIslands, texelDensity, setTexelDensity, meshFromSession,
  pictureAxes, minAreaTurn, hull2,
} from '../../src/poi/uv/uvMesh.js';

const near = (a, b, eps = 1e-6, what = '') => {
  if (Array.isArray(a)) a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= eps, `${what}[${i}] ${v} vs ${b[i]}`));
  else assert.ok(Math.abs(a - b) <= eps, `${what} ${a} vs ${b}`);
};

/** A unit cube as a modeller exports one: each face its own four vertices, its own UVs 0 - 1 (24 vertices, 12
 *  triangles), one submesh. */
function cube() {
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
    [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  const pos = [], nor = [], uv = [], idx = [];
  for (const [n, a, b] of faces) {
    const c = n.map((x) => x * 0.5);
    const base = pos.length / 3;
    for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const p = [0, 1, 2].map((k) => c[k] + (i - 0.5) * b[k] + (j - 0.5) * a[k]);
      pos.push(...p); nor.push(...n); uv.push(i, 1 - j);
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);   // wound so (b - a) x (c - a) is the outward normal, as the import leaves a model
  }
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: idx.length }] };
}
/** A flat n x n grid of unit squares in the y = 0 plane, facing up, its vertices shared, its UVs all nought. */
function grid(n = 3) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { pos.push(i, 0, j); nor.push(0, 1, 0); uv.push(0, 0); }
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: idx.length }] };
}
/** An open cylinder round +y: `seg` sides, `rows` rows, radius 1, height 2; vertices shared round it but for one seam. */
function cylinder(seg = 16, rows = 4) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let r = 0; r <= rows; r++) for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * 2 * Math.PI;
    pos.push(Math.cos(a), (r / rows) * 2, Math.sin(a)); nor.push(Math.cos(a), 0, Math.sin(a)); uv.push(0, 0);
  }
  const at = (k, r) => r * (seg + 1) + k;
  for (let r = 0; r < rows; r++) for (let k = 0; k < seg; k++) idx.push(at(k, r), at(k + 1, r + 1), at(k + 1, r), at(k, r), at(k, r + 1), at(k + 1, r + 1));   // outward
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: idx.length }] };
}
const uvOf = (s, c) => [s.cornerUv[c * 2], s.cornerUv[c * 2 + 1]];
const posOfC = (s, c) => { const v = s.tris[c]; return [s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]]; };
const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

test('POI-5 THE SESSION: a modeller\'s cube - 24 vertices, each face its own - welded to its 8 corners, its 12 edges each between two faces and each a seam the model made (its faces disagree on the UVs there), six islands; a seam cleared joins two; back to a mesh with nothing split that was not (mutants: the weld unread; a seam where the UVs agree)', () => {
  const s = uvSessionOf(cube());
  assert.equal(s.welded, 8);
  assert.equal(s.edgeFaces.size, 18, 'twelve cube edges, and six face diagonals');
  assert.equal([...s.edgeFaces.values()].every((f) => f.length === 2), true);
  assert.equal(s.seams.size, 12, 'the twelve cube edges - never the diagonals inside a face');
  assert.equal(islandsOf(s).length, 6);
  const [k] = [...s.seams];
  const [a, b] = k.split('_').map(Number);
  setSeam(s, a, b, false);
  assert.equal(islandsOf(s).length, 5);
  assert.equal(setSeam(s, 0, 0, true), false, 'no such edge');
  // back to a mesh: nothing changed, nothing split anew
  const m = meshFromSession(uvSessionOf(cube()));
  assert.equal(m.positions.length / 3, 24); assert.equal(m.indices.length, 36);
  // a shared grid: one island, its vertices shared (9 + 7 = 16), no seam
  const g = uvSessionOf(grid(3));
  assert.equal(g.welded, 16); assert.equal(g.seams.size, 0); assert.equal(islandsOf(g).length, 1);
});

test('POI-5 THE TOOLS: a UV vertex is every corner at that point of the island; corners moved, turned and sized about their pivot; a planar projection in metres, seen from the face\'s front - u to the eye\'s right, v down (the game\'s left-handed frame); a box projection each face by its own axis (mutants: the turn\'s sense; u mirrored)', () => {
  const g = uvSessionOf(grid(2));
  projectPlanar(g, [...Array(g.faces).keys()], [0, 1, 0]);
  const centre = cornersOf([...Array(g.faces).keys()]).find((c) => { const p = posOfC(g, c); return p[0] === 1 && p[2] === 1; });
  assert.equal(uvVertexCorners(g, centre).length, 6, 'the middle vertex of a 2 x 2 grid: six corners');
  // the face seen from above (looking down -y, its front): u to the eye's right, v down; a metre a unit
  const [ua, va] = pictureAxes([0, 1, 0]);
  for (const c of cornersOf([0, 1])) { const p = posOfC(g, c); near(uvOf(g, c), [p[0] * ua[0] + p[2] * ua[2], p[0] * va[0] + p[2] * va[2]], 1e-9); }
  // the convention, from the motor's own right: an eye looking along -n has its right at up x f
  for (const n of [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]]) {
    const f = n.map((x) => -x), yaw = Math.atan2(f[0], f[2]);
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const [u, v] = pictureAxes(n);
    near(u, right, 1e-9, `u is the eye's right facing ${n}`);
    near(v, [0, -1, 0], 1e-9, 'v is down');
  }
  // move, turn, size
  const cs = cornersOf([0]);
  const before = cs.map((c) => uvOf(g, c));
  transformCorners(g, cs, { move: [1, 2] });
  cs.forEach((c, i) => near(uvOf(g, c), [before[i][0] + 1, before[i][1] + 2], 1e-12));
  transformCorners(g, cs, { turn: 90, pivot: [0, 0] });
  const t = uvOf(g, cs[0]), b0 = [before[0][0] + 1, before[0][1] + 2];
  near(t, [b0[1], -b0[0]], 1e-9, 'a quarter turn takes +u to -v (the picture\'s up)');
  transformCorners(g, cs, { scale: [2, 2], pivot: [0, 0] });
  near(uvOf(g, cs[0]), [b0[1] * 2, -b0[0] * 2], 1e-9);
  // the box: the cube's top by y, its side by x
  const s = uvSessionOf(cube());
  projectBox(s, [...Array(s.faces).keys()]);
  for (let f = 0; f < s.faces; f++) {
    const a = uvOf(s, f * 3), b = uvOf(s, f * 3 + 1), c = uvOf(s, f * 3 + 2);
    assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0, `face ${f} unmirrored (positive as read)`);
  }
});

test('POI-5 THE UNWRAP: a flat island laid true - every edge its own length, every angle its own, unmirrored; a cut cylinder laid flat with little stretch (its rows straight, its sides alike); islands kept apart by their seams (mutants: the pins at one point; the handedness unkept)', () => {
  const g = uvSessionOf(grid(3));
  const faces = [...Array(g.faces).keys()];
  const isl = unwrapLscm(g, faces);
  assert.equal(isl.length, 1);
  for (const f of faces) for (let k = 0; k < 3; k++) {
    const c0 = f * 3 + k, c1 = f * 3 + (k + 1) % 3;
    near(dist(uvOf(g, c0), uvOf(g, c1)), dist(posOfC(g, c0), posOfC(g, c1)), 1e-5, `edge of face ${f}`);
  }
  for (const f of faces) {
    const a = uvOf(g, f * 3), b = uvOf(g, f * 3 + 1), c = uvOf(g, f * 3 + 2);
    assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0, `face ${f} unmirrored`);
  }
  // the cylinder: its one seam cuts it open; laid out, each row of sides is as wide as the next and as tall
  const cyl = uvSessionOf(cylinder(16, 4));
  // the weld closes it round: the seam that opens it again is the builder's
  for (let r = 0; r < 4; r++) {
    const a = cyl.weld[r * 17], b = cyl.weld[(r + 1) * 17];
    setSeam(cyl, a, b, true);
  }
  const cf = [...Array(cyl.faces).keys()];
  assert.equal(islandsOf(cyl).length, 1);
  unwrapLscm(cyl, cf);
  // a side's two vertical edges are the same length, and every side as wide as its neighbours
  const lengths = [];
  for (let f = 0; f < cyl.faces; f += 2) lengths.push(dist(uvOf(cyl, f * 3), uvOf(cyl, f * 3 + 2)));   // a side's bottom edge
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  for (const l of lengths) assert.ok(Math.abs(l - mean) / mean < 0.02, `a side's width ${l} against the mean ${mean}`);
  // the cube's six islands unwrapped stay six
  const s = uvSessionOf(cube());
  assert.equal(unwrapLscm(s, [...Array(s.faces).keys()]).length, 6);
  // the curved projections keep the picture unmirrored too
  const c2 = uvSessionOf(cylinder(16, 4));
  projectCylinder(c2, [...Array(c2.faces).keys()], [0, 1, 0], [0, 0, 0]);
  const c3 = uvSessionOf(cylinder(16, 4));
  projectSphere(c3, [...Array(c3.faces).keys()], [0, 1, 0]);
  for (const q of [c2, c3]) {
    let pos = 0;
    for (let f = 0; f < q.faces; f++) { const a = uvOf(q, f * 3), b = uvOf(q, f * 3 + 1), c = uvOf(q, f * 3 + 2); pos += Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); }
    assert.ok(pos > q.faces * 0.9, 'the faces read unmirrored');
  }
});

test('POI-5 PACKING AND DENSITY: every island inside the square with its margin, none over another, each turned to its smallest box, the scale the largest that fits; a texel density read in the picture\'s pixels a metre and set (mutants: the margin unkept; the boxes unturned)', () => {
  const s = uvSessionOf(cube());
  const isl = islandsOf(s);
  // one island made twice as wide as tall, then turned 30 degrees: the packer lays it flat again (its box 2 : 1)
  transformCorners(s, cornersOf(isl[0]), { scale: [2, 1] });
  transformCorners(s, cornersOf(isl[0]), { turn: 30 });
  const scale = packIslands(s, isl, { margin: 0.02 });
  assert.ok(scale > 0.25, `the six faces in a 3 x 2 shelf at least (${scale})`);
  const boxes = isl.map((faces) => uvBounds(s, cornersOf(faces)));
  for (const b of boxes) {
    assert.ok(b[0] >= 0.02 - 1e-9 && b[1] >= 0.02 - 1e-9 && b[2] <= 1 + 1e-9 && b[3] <= 1 + 1e-9, `inside, its margin kept: ${b}`);
  }
  boxes.forEach((b, i) => near((b[2] - b[0]) / (b[3] - b[1]), i === 0 ? 2 : 1, 1e-6, `island ${i} laid in its smallest box (its turn undone, lying down)`));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const overlap = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-9 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-9;
    assert.ok(!overlap, `islands ${i} and ${j} apart`);
  }
  assert.equal(minAreaTurn([[0, 0], [1, 1], [0, 2], [-1, 1]]) % 90 !== 0, true, 'a diamond turned to its square');
  assert.equal(hull2([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]).length, 4);
  // density: a metre square face, its UVs the whole picture - 512 pixels a metre; set to 256, its UVs halved
  const g = uvSessionOf(grid(1));
  projectPlanar(g, [0, 1], [0, 1, 0]);
  near(texelDensity(g, [0, 1], 512, 512), 512, 1e-6);
  setTexelDensity(g, [[0, 1]], 256, 512, 512);
  near(texelDensity(g, [0, 1], 512, 512), 256, 1e-6);
  // back to a mesh: the grid's shared vertices still shared after its projection (no split where nothing parts)
  assert.equal(meshFromSession(g).positions.length / 3, 4);
});

import { orderByDissection, cholesky, solveCholesky, upperCsc } from '../../src/poi/sparseCholesky.js';

// PIN MOVED (AUDIT POI M13): the solver is HERMITIAN now - the conformal map's own complex form, one column a vertex
// where the real form had two (four times the entries) - so the system below is complex (an off-diagonal coupling with an
// imaginary part, its twin the conjugate), its answer complex, and upperCsc takes the imaginary parts beside the real and
// conjugates what it mirrors. The pin is the same claim, made harder: a real symmetric system is the case Az = 0.
test('POI-5 THE DIRECT SOLVE: a sparse positive-definite system factored and solved as a dense one solves it; the order a permutation of every vertex, a cut\'s vertices after both its halves; a matrix that is not positive definite refused (the unwrap falls back) (mutants: the separator first; a diagonal summed twice)', () => {
  // a grid Laplacian with complex couplings, plus a little of the identity, its right-hand side known
  const k = 12, N = k * k;
  const pts = [], nb = Array.from({ length: N }, () => []);
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) pts.push([i, 0, j]);
  const I = [], J = [], V = [], Z = [];
  const at = (i, j) => j * k + i;
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
    const a = at(i, j);
    I.push(a); J.push(a); V.push(4.6); Z.push(0);
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      if (i + di < k && j + dj < k) { const b = at(i + di, j + dj); I.push(a); J.push(b); V.push(-1); Z.push(di ? 0.3 : -0.2); nb[a].push(b); nb[b].push(a); }
    }
  }
  const order = orderByDissection(pts, nb, 8);
  assert.deepEqual([...order].sort((a, b) => a - b), [...Array(N).keys()], 'a permutation of every vertex');
  // the first cut: the last vertices ordered are its separator - a column of the grid between two halves
  const last = [...order.slice(-k)].map((v) => pts[v][0]);
  assert.ok(last.every((x) => x === last[0]), `the separator a single column, ordered last (${last})`);
  // renumbered by the order (a triple whose row now ranks after its column is mirrored, conjugated), factored, solved
  const rank = new Int32Array(N); order.forEach((v, r) => { rank[v] = r; });
  const { Ap, Ai, Ar, Az } = upperCsc(N, Int32Array.from(I.map((v) => rank[v])), Int32Array.from(J.map((v) => rank[v])), Float64Array.from(V), Float64Array.from(Z), V.length);
  const L = cholesky(N, Ap, Ai, Ar, Az);
  assert.ok(L);
  const tr = Float64Array.from({ length: N }, (_, i) => Math.sin(i)), tz = Float64Array.from({ length: N }, (_, i) => Math.cos(i * 0.7));
  // b = H truth, H the full Hermitian matrix: H(a, b) = V + iZ above, its conjugate below
  const br = new Float64Array(N), bz = new Float64Array(N);
  const madd = (r, c, hr, hz) => { br[r] += hr * tr[c] - hz * tz[c]; bz[r] += hr * tz[c] + hz * tr[c]; };
  for (let t = 0; t < V.length; t++) { const r = rank[I[t]], c = rank[J[t]]; madd(r, c, V[t], Z[t]); if (r !== c) madd(c, r, V[t], -Z[t]); }
  const x = solveCholesky(L, br, bz);
  for (let i = 0; i < N; i++) { near(x.re[i], tr[i], 1e-9, `x[${i}].re`); near(x.im[i], tz[i], 1e-9, `x[${i}].im`); }
  // not positive definite: refused
  const bad = upperCsc(2, Int32Array.from([0, 1, 0]), Int32Array.from([0, 1, 1]), Float64Array.from([1, 1, 2]), null, 3);
  assert.equal(cholesky(2, bad.Ap, bad.Ai, bad.Ar, bad.Az), null);
  // duplicates summed, a triple below the diagonal mirrored above it - conjugated
  const d = upperCsc(2, Int32Array.from([1, 0, 0]), Int32Array.from([0, 1, 0]), Float64Array.from([2, 3, 1]), Float64Array.from([0.5, 0.25, 0]), 3);
  assert.deepEqual([...d.Ap], [0, 1, 2]); assert.deepEqual([...d.Ai], [0, 0]); assert.deepEqual([...d.Ar], [1, 5]); assert.deepEqual([...d.Az], [0, -0.25]);
});

test('POI-5 THE UNWRAP AT SIZE: a curved sheet of 7,200 triangles laid flat by the direct solve - true to its area within the pins\' own two per cent, every face unmirrored (mutants: the direct solve unread)', () => {
  const n = 60, pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { pos.push(i, Math.sin(i / 10) * 3, j); nor.push(0, 1, 0); uv.push(0, 0); }
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
  const s = uvSessionOf({ positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: idx.length }] });
  unwrapLscm(s, [...Array(s.faces).keys()], { iterations: 1 });   // one iteration: only the direct solve can lay it true
  let worst = 0, mirrored = 0;
  for (let f = 0; f < s.faces; f++) {
    const U = s.cornerUv, a = f * 6;
    const sa = (U[a + 2] - U[a]) * (U[a + 5] - U[a + 1]) - (U[a + 3] - U[a + 1]) * (U[a + 4] - U[a]);
    if (sa <= 0) mirrored++;
    const P = (k) => { const v = s.tris[f * 3 + k]; return [s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]]; };
    const p0 = P(0), e1 = P(1).map((x, i) => x - p0[i]), e2 = P(2).map((x, i) => x - p0[i]);
    const A = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
    worst = Math.max(worst, Math.abs(Math.abs(sa) / 2 / A - 1));
  }
  assert.equal(mirrored, 0);
  assert.ok(worst < 0.03, `the worst face's area off by ${worst}`);
});

import { createUvEdit, UV_UNDO_DEPTH } from '../../src/poi/uv/uvEdit.js';

/** A cube with two materials: its first two faces the second. */
function cube2() {
  const m = cube();
  return { ...m, submeshes: [{ start: 0, count: 12 }, { start: 12, count: 24 }] };
}

test('POI-5 THE UV EDITOR\'S HANDS: one material\'s faces at a time; a click takes the face under it, Shift adds and takes away, a box everything inside; an island by any of its faces; a UV vertex every corner at its point; each tool one step of its own undo, a drag one step from its start; seams marked along edges; the result a mesh with the material\'s count kept (mutants: Shift never takes away; the drag gathered; the seam on the wrong edge)', () => {
  const ed = createUvEdit(cube2(), { sub: 1 });
  assert.equal(ed.faces().length, 8, 'the second material: four of the cube\'s faces, eight triangles');
  ed.setSubmesh(0);
  assert.equal(ed.faces().length, 4);
  ed.setSubmesh(1);
  // the face under a click: the first shown face's centre
  const [a, b, c] = ed.faceUvs(ed.faces()[0]);
  const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
  ed.setMode('face');
  const hit = ed.pick(mid[0], mid[1], 0.01);
  assert.ok(hit !== null && ed.selection().has(hit));
  ed.pick(mid[0], mid[1], 0.01, true);
  assert.equal(ed.selection().size, 0, 'Shift on what is held takes it away');
  ed.setMode('island');
  ed.pick(mid[0], mid[1], 0.01);
  assert.equal(ed.selection().size, 2, 'a cube face\'s island: its two triangles');
  ed.setMode('vertex');
  ed.pick(a[0], a[1], 0.001);
  assert.ok(ed.selectedCorners().length >= 1);
  ed.box(-1, -1, 2, 2);
  assert.equal(ed.selection().size, 24, 'every corner of eight triangles');
  // a tool: one step; undone, the UVs as they were
  ed.setMode('face');
  ed.clear();
  const before = Float64Array.from(ed.session.cornerUv);
  ed.transform({ move: [0.5, 0] });
  assert.ok(ed.canUndo());
  ed.undo();
  assert.deepEqual([...ed.session.cornerUv], [...before]);
  ed.redo(); ed.undo();
  // a drag: from its start each time, one step
  ed.pick(mid[0], mid[1], 0.01);
  ed.begin();
  for (let k = 1; k <= 10; k++) ed.drag({ move: [k * 0.01, 0] });
  assert.equal(ed.end(), true);
  const moved = ed.faceUvs(hit)[0][0] - a[0];
  near(moved, 0.1, 1e-12, 'the last drag\'s move, from the start');
  ed.undo();
  near(ed.faceUvs(hit)[0][0], a[0], 1e-12, 'the drag one step');
  // a seam marked along a selected edge, on that edge's welded ends
  ed.setMode('edge');
  ed.setSubmesh(1);
  const f0 = ed.faces()[0];
  const [e0, e1] = ed.faceUvs(f0);
  ed.pick((e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2, 0.01);
  const edge = [...ed.selection()][0];
  const wasSeam = ed.isSeam(Math.floor(edge / 3), edge % 3);
  assert.equal(ed.seams(!wasSeam), 1);
  assert.equal(ed.isSeam(Math.floor(edge / 3), edge % 3), !wasSeam);
  // the tools over the whole material, then the result: a mesh with the cube's two materials
  ed.clear();
  ed.unwrap(); ed.pack({ margin: 0.02 }); ed.fit(); ed.flip('u');
  const m = ed.result();
  assert.equal(m.submeshes.length, 2);
  assert.equal(m.indices.length, 36);
  assert.equal(UV_UNDO_DEPTH, 100);
});
