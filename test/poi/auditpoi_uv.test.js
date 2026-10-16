// AUDIT POI, lane F (2026-10-15; bible/06-Systems/POI-Editor-Arc.md POI-5, and POI-4b's ITS PICTURE) - THE UV EDITOR'S
// GEOMETRY AND THE THUMBNAIL, as the audit of the POI editor arc found them at 0c78d81a85:
//   M1  a face with two corners on one welded vertex (a strip's stitch, a collapsed edge) sent the whole island to
//       conjugate gradients - its second corner an unknown in no equation, a zero column the factor refused;
//   M2  two parts joined only through a face of no area hung on one vertex - a singular system the factor took;
//   M3  a projection parted the UVs and marked no seam, so pack, island select and density read the projected
//       regions as one island;
//   M4  the unwrap pinned its farthest pair at their chord, so a curved island came out shrunk;
//   M5  a selection's corners were found by a walk of a whole island for every corner, on every press and every draw;
//   M6  the undo kept a whole copy of every corner's UV for every step, a hundred deep;
//   M7  a corner on the axis of a curved projection took the angle nought, and the wrap was read from it;
//   M8  the thumbnail's key and fill lights stood mirrored against their own words;
//   M9  a pack with an empty island collapsed every island; one that could not fit had turned them already, unsaid; a
//       small island's lying-down tie was lost under an absolute step;
//   M10 the weld rounded to a grid, parting copies a hair apart across a cell's edge;
//   M11 the pivot counted a UV vertex once for every face on it;
//   M12 the thumbnail's rasterizer drew a pixel centre on a shared edge twice;
//   M13 the unwrap at the mesh law's size ran on the page's own thread - now off it, by the Hermitian factor.
// Each test is read through the modules' namespaces, so on the old code each fails on its own claim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';
import '../chargenDom.mjs';
import * as UV from '../../src/poi/uv/uvMesh.js';
import * as ED from '../../src/poi/uv/uvEdit.js';
import * as THUMB from '../../src/poi/poiThumb.js';

const near = (a, b, eps, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} vs ${b}`);
const mk = (pos, idx, uv = null) => {
  const V = pos.length / 3;
  return { positions: Float32Array.from(pos), normals: new Float32Array(V * 3), uvs: uv ? Float32Array.from(uv) : new Float32Array(V * 2), indices: Uint32Array.from(idx), submeshes: [{ start: 0, count: idx.length }] };
};
const all = (s) => [...Array(s.faces).keys()];
const posC = (s, c) => { const v = s.tris[c]; return [s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]]; };
const uvC = (s, c) => [s.cornerUv[c * 2], s.cornerUv[c * 2 + 1]];
const area3 = (s, f) => { const a = posC(s, f * 3), b = posC(s, f * 3 + 1), c = posC(s, f * 3 + 2); const e1 = b.map((x, i) => x - a[i]), e2 = c.map((x, i) => x - a[i]); return Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2; };
const areaUv = (s, f) => { const U = s.cornerUv, a = f * 6; return ((U[a + 2] - U[a]) * (U[a + 5] - U[a + 1]) - (U[a + 3] - U[a + 1]) * (U[a + 4] - U[a])) / 2; };
/** A grid of n x n squares: `at(i, j)` its vertex, `p(i, j)` its position. */
function gridMesh(n, p, uv = null) {
  const pos = [], idx = [], uvs = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { pos.push(...p(i, j)); uvs.push(...(uv ? uv(i, j) : [0, 0])); }
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
  return { pos, idx, uvs, at };
}

test('AUDIT POI M1: a face with two corners on one welded vertex - a strip\'s stitch (a, a, b), a collapsed edge (a, a\', b) - is not a triangle of the surface: the unwrap solves over the rest and lays the sheet by the DIRECT solve (one iteration of the fallback could not), and the face\'s corners take their welded neighbours\' UVs (mutants: a face\'s second corner at one weld unjoined; the faces of no area solved)', () => {
  const g = gridMesh(40, (i, j) => [i, Math.sin(i / 10) * 3, j]);
  const v = g.at(5, 5), dup = g.pos.length / 3;
  g.pos.push(...g.pos.slice(v * 3, v * 3 + 3)); g.uvs.push(0, 0);
  g.idx.push(v, dup, g.at(6, 5));             // a collapsed edge: two vertices at one point
  g.idx.push(g.at(9, 9), g.at(9, 9), g.at(10, 9));   // a strip's stitch: one index twice
  // and two corners within the weld's reach that are NOT one point, the third a metre off: an area, but no triangle
  const w0 = g.at(20, 20), hair = g.pos.length / 3;
  g.pos.push(g.pos[w0 * 3] + 3e-6, g.pos[w0 * 3 + 1], g.pos[w0 * 3 + 2]); g.uvs.push(0, 0);
  g.idx.push(w0, hair, g.at(20, 21));
  const s = UV.uvSessionOf(mk(g.pos, g.idx, g.uvs));
  assert.ok(area3(s, s.faces - 1) > 1e-7, 'the hair\'s face has an area');
  const pieces = UV.unwrapLscm(s, all(s), { iterations: 1 });   // one iteration: only the direct solve lays it true
  assert.equal(pieces.length, 1, 'one piece');
  let worst = 0, mirrored = 0;
  for (let f = 0; f < s.faces - 3; f++) { if (areaUv(s, f) <= 0) mirrored++; worst = Math.max(worst, Math.abs(areaUv(s, f) / area3(s, f) - 1)); }
  assert.equal(mirrored, 0, 'no face mirrored (the factor refused, one step of the fallback leaves them anyhow)');
  assert.ok(worst < 1e-3, `the worst face's area off by ${worst} - the sheet is developable, laid true`);
  // the collapsed face's two coincident corners one UV, the weld's own (a live corner at it); the stitch's likewise
  const liveAt = (w) => { for (let c = 0; c < (s.faces - 3) * 3; c++) if (s.weld[s.tris[c]] === w) return c; return -1; };
  for (const f of [s.faces - 3, s.faces - 2, s.faces - 1]) for (let k = 0; k < 3; k++) {
    const c = f * 3 + k, mate = liveAt(s.weld[s.tris[c]]);
    assert.deepEqual(uvC(s, c), uvC(s, mate), `face ${f} corner ${k}: its welded neighbours' UV`);
  }
});

test('AUDIT POI M2: two parts joined only through a face of no area (three points on a line) are two pieces, each pinned and laid alone - each true to its own area - where one system held them on a hinge no pin fixed (mutants: the pieces joined through a face of no area; a piece unpinned)', () => {
  for (const k of [1, 4]) {
    const pos = [], idx = [];
    const grid = (x0, z0) => {
      const base = pos.length / 3;
      for (let j = 0; j <= k; j++) for (let i = 0; i <= k; i++) pos.push(x0 + i / k, 0, z0 + j / k);
      const at = (i, j) => base + j * (k + 1) + i;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
      return at;
    };
    const A = grid(0, 0), B = grid(1, 1);
    idx.push(A(k, k - 1), A(k, k), B(0, 1));   // on the line x = 1: z = 1 - 1/k, 1, 1 + 1/k
    const s = UV.uvSessionOf(mk(pos, idx));
    assert.equal(UV.islandsOf(s).length, 1, 'one island by its seams (none)');
    const pieces = UV.unwrapLscm(s, all(s));
    assert.equal(pieces.length, 2, `k=${k}: two pieces laid`);
    const T = 2 * k * k;
    const sum = (fs) => fs.reduce((a, f) => a + areaUv(s, f), 0);
    near(sum([...Array(T).keys()]), 1, 1e-9, `k=${k}: the first part's UV area`);
    near(sum([...Array(T).keys()].map((f) => f + T)), 1, 1e-9, `k=${k}: the second's`);
    for (let f = 0; f < 2 * T; f++) for (let e = 0; e < 3; e++) {
      const a = f * 3 + e, b = f * 3 + (e + 1) % 3;
      near(Math.hypot(...uvC(s, a).map((x, i) => x - uvC(s, b)[i])), Math.hypot(...posC(s, a).map((x, i) => x - posC(s, b)[i])), 1e-9, `k=${k}: face ${f}'s edge its own length`);
    }
  }
});

/** A cube whose eight corners are SHARED (a smooth export), its UVs all nought: one island, no seam. */
function sharedCube() {
  const P = [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5], [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]];
  const idx = [];
  for (const [a, b, c, d] of [[1, 2, 6, 5], [4, 7, 3, 0], [3, 7, 6, 2], [0, 1, 5, 4], [5, 6, 7, 4], [0, 3, 2, 1]]) idx.push(a, b, c, a, c, d);
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [P[idx[t]], P[idx[t + 1]], P[idx[t + 2]]], n = cr(b.map((x, i) => x - a[i]), c.map((x, i) => x - a[i]));
    if (n[0] * (a[0] + b[0] + c[0]) + n[1] * (a[1] + b[1] + c[1]) + n[2] * (a[2] + b[2] + c[2]) < 0) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  }
  return { positions: Float32Array.from(P.flat()), normals: Float32Array.from(P.flat()), uvs: new Float32Array(16), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: idx.length }] };
}
/** The share of the unit square under two or more faces at once. */
function overlap(s, faces, k = 100) {
  const tri = (f) => [0, 1, 2].map((j) => uvC(s, f * 3 + j));
  const sg = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, t) => { const d1 = sg(t[0], t[1], p), d2 = sg(t[1], t[2], p), d3 = sg(t[2], t[0], p); return (d1 > 1e-12 && d2 > 1e-12 && d3 > 1e-12) || (d1 < -1e-12 && d2 < -1e-12 && d3 < -1e-12); };
  const tris = faces.map(tri);
  let hits = 0;
  for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) { const p = [(x + 0.5) / k, (y + 0.5) / k]; let n = 0; for (const t of tris) if (inside(p, t)) n++; if (n > 1) hits++; }
  return hits / (k * k);
}

test('AUDIT POI M3: a box projection parts a smooth cube\'s UVs into six islands AS THE UVS HOLD THEM - packed apart (nothing over anything), an island picked as one side, its density set side by side - while its seams stay the unwrap\'s (none marked: one island to unwrap) (mutants: the UV islands joined where the UVs part; the pack by the seams\' islands; an island\'s pick by the seams\')', () => {
  const ed = ED.createUvEdit(sharedCube());
  const s = ed.session;
  ed.project('box');
  ed.pack({ margin: 0.02 });
  assert.equal(overlap(s, ed.faces()), 0, 'nothing packed over anything (it was 92% of the square under two faces)');
  ed.setMode('island');
  const [a, b, c] = ed.faceUvs(0);
  ed.pick((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, 0.01);
  assert.equal(ed.selection().size, 2, 'an island: one side of the box, its two triangles');
  assert.equal(UV.islandsOf(s).length, 1, 'the seams untouched: one island to unwrap');
  assert.equal(UV.uvIslandsOf(s).length, 6, 'six islands as the UVs hold them');
  // the picked side made half the others' density, then a density set over all six: each side to it, about its own centre
  ed.transform({ scale: [0.5, 0.5] });
  ed.clear();
  ed.setDensity(64, 256, 256);
  for (const g of UV.uvIslandsOf(s)) near(UV.texelDensity(s, g, 256, 256), 64, 1e-9, 'each side its density');
  assert.equal(overlap(s, ed.faces()), 0, 'each sized in its own place');
});

test('AUDIT POI M4: an unwrapped piece is sized to its surface - a metre a unit of UV over it - where the pins\' chord shrank a curved one (a cut cylinder 0.58 of its area, a hemisphere 0.35); pieces unwrapped together share one density (mutants: the piece unsized; sized by the wrong root)', () => {
  // a cylinder r = 1, h = 2, cut once by marked seams; and a flat 2 x 2 sheet beside it, unwrapped together
  const seg = 32, rows = 8, pos = [], idx = [];
  for (let r = 0; r <= rows; r++) for (let k = 0; k <= seg; k++) { const a = (k / seg) * 2 * Math.PI; pos.push(Math.cos(a), (r / rows) * 2, Math.sin(a)); }
  const at = (k, r) => r * (seg + 1) + k;
  for (let r = 0; r < rows; r++) for (let k = 0; k < seg; k++) idx.push(at(k, r), at(k + 1, r + 1), at(k + 1, r), at(k, r), at(k, r + 1), at(k + 1, r + 1));
  const cylFaces = idx.length / 3, base = pos.length / 3;
  for (const [x, z] of [[5, 0], [7, 0], [7, 2], [5, 2]]) pos.push(x, 0, z);
  idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  const s = UV.uvSessionOf(mk(pos, idx));
  for (let r = 0; r < rows; r++) UV.setSeam(s, s.weld[at(0, r)], s.weld[at(0, r + 1)], true);
  assert.equal(UV.unwrapLscm(s, all(s)).length, 2);
  const cyl = [...Array(cylFaces).keys()], flat = [cylFaces, cylFaces + 1];
  const ratio = (fs) => fs.reduce((a, f) => a + Math.abs(areaUv(s, f)), 0) / fs.reduce((a, f) => a + area3(s, f), 0);
  near(ratio(cyl), 1, 1e-9, 'the cylinder\'s UV area its surface\'s');
  near(UV.texelDensity(s, cyl, 512, 512), 512, 1e-6, 'a metre a unit: 512 pixels a metre on a 512 picture');
  near(UV.texelDensity(s, flat, 512, 512), 512, 1e-6, 'and the flat piece unwrapped with it the same');
  // a hemisphere's own UVs (u round it, a seam where u wraps), its pole's faces of no area among them
  const hp = [], hi = [], hu = [];
  for (let r = 0; r <= 12; r++) for (let k = 0; k <= 32; k++) { const th = (r / 12) * Math.PI / 2, ph = (k / 32) * 2 * Math.PI; hp.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); hu.push(k / 32, r / 12); }
  const hat = (k, r) => r * 33 + k;
  for (let r = 0; r < 12; r++) for (let k = 0; k < 32; k++) hi.push(hat(k, r), hat(k + 1, r), hat(k + 1, r + 1), hat(k, r), hat(k + 1, r + 1), hat(k, r + 1));
  const h = UV.uvSessionOf(mk(hp, hi, hu));
  UV.unwrapLscm(h, all(h));
  const live = all(h).filter((f) => area3(h, f) > 1e-9);
  near(live.reduce((a, f) => a + Math.abs(areaUv(h, f)), 0) / live.reduce((a, f) => a + area3(h, f), 0), 1, 1e-9, 'the hemisphere\'s');
  assert.equal(live.filter((f) => areaUv(h, f) <= 0).length, 0, 'none mirrored');
});

test('AUDIT POI M5: a selection\'s corners are read from the UV vertices\' table - a move of all 12,800 faces costs what a move of the whole material does, a box over every island what a box over every face does, and the panel\'s draw reads it again only when the UVs or the selection change (mutants: the table re-read on every ask; an island looked up by search)', () => {
  const g = gridMesh(80, (i, j) => [i, 0, j], (i, j) => [i / 80, j / 80]);
  const ed = ED.createUvEdit(mk(g.pos, g.idx, g.uvs));
  ed.setMode('face');
  ed.clear(); ed.transform({ move: [0.1, 0] });   // warm
  let t0 = performance.now(); ed.transform({ move: [0.1, 0] }); const none = performance.now() - t0;
  ed.selectAll();
  t0 = performance.now(); ed.transform({ move: [0.1, 0] }); const allSel = performance.now() - t0;
  assert.ok(allSel < 20 * none + 100, `Ctrl+A then a move ${allSel.toFixed(0)} ms against a move of nothing selected ${none.toFixed(0)} ms (it was 4 s)`);
  ed.setMode('face'); t0 = performance.now(); ed.box(-2, -2, 3, 3); const boxFaces = performance.now() - t0;
  ed.setMode('island'); t0 = performance.now(); ed.box(-2, -2, 3, 3); const boxIslands = performance.now() - t0;
  assert.equal(ed.selection().size, 12800);
  assert.ok(boxIslands < 20 * boxFaces + 100, `a box in island mode ${boxIslands.toFixed(0)} ms against face mode ${boxFaces.toFixed(0)} ms (it was 42 s)`);
  // the draw's ask: the same corners, not read again, until something changes
  ed.setMode('vertex'); ed.selectAll();
  const a = ed.selectedCorners();
  assert.equal(ed.selectedCorners(), a, 'asked again: the corners already read');
  ed.transform({ move: [0.01, 0] });
  assert.notEqual(ed.selectedCorners(), a, 'the UVs changed: read again');
  assert.equal(ed.selectedCorners().length, 12800 * 3);
  // and a UV vertex is still every corner at its point of its island: the grid's inner vertex, six
  const ed2 = ED.createUvEdit(mk(g.pos, g.idx, g.uvs));
  ed2.setMode('vertex');
  const inner = UV.cornersOf(ed2.faces()).find((c) => { const p = posC(ed2.session, c); return p[0] === 40 && p[2] === 40; });
  const [u, v] = uvC(ed2.session, inner);
  ed2.pick(u, v, 1e-4);
  assert.equal(ed2.selectedCorners().length, 6);
});

/** The bytes a hundred one-face steps of a 20,000-triangle sheet hold, read in a child of its own (ALLOC-RACE: the
 *  measure's flags have one home, test/allocChild.mjs) - the buffers the heap still holds once the collector has had its
 *  way, asked a few times with the loop turned between (a dead buffer's backing store is freed by a sweeper of its own). */
const UNDO_CHILD = `
import { createUvEdit } from ${JSON.stringify(new URL('../../src/poi/uv/uvEdit.js', import.meta.url).href)};
const n = 100, pos = [], idx = [], uv = [];
for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { pos.push(i, 0, j); uv.push(i / n, j / n); }
const at = (i, j) => j * (n + 1) + i;
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) idx.push(at(i, j), at(i + 1, j + 1), at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
const V = pos.length / 3;
const ed = createUvEdit({ positions: Float32Array.from(pos), normals: new Float32Array(V * 3), uvs: Float32Array.from(uv), indices: Uint32Array.from(idx), submeshes: [{ start: 0, count: idx.length }] });
const settled = async () => { for (let i = 0; i < 6; i++) { gc(); await new Promise((r) => setTimeout(r, 15)); } return process.memoryUsage().arrayBuffers; };
ed.setMode('face');
ed.pick(0.004, 0.002, 0.001);
ed.transform({ move: [1e-6, 0] });
const a0 = await settled();
for (let k = 0; k < 99; k++) { ed.pick(0.004 + k * 0.01, 0.002, 0.001); ed.transform({ move: [1e-6, 0] }); }
const grew = (await settled()) - a0;
console.log(JSON.stringify({ grew, held: ed.undoBytes() }));
`;
function undoGrowth() {
  const run = spawnSync(process.execPath, [...ALLOC_CHILD_ARGS, '--input-type=module', '-e', UNDO_CHILD], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim().split('\n').pop());
}

test('AUDIT POI M6: a step of the UV undo holds what it changed - a hundred one-face nudges of a 20,000-triangle sheet keep kilobytes, not a whole copy of every corner each (96 MB) - undone and redone exactly, its seams too, the oldest let go past the undo\'s bytes and the latest always kept (mutants: a whole copy a step; the budget unread; a step\'s seams unrestored)', async () => {
  const g = gridMesh(100, (i, j) => [i, 0, j], (i, j) => [i / 100, j / 100]);
  const ed = ED.createUvEdit(mk(g.pos, g.idx, g.uvs));
  const start = Float64Array.from(ed.session.cornerUv);
  ed.setMode('face');
  ed.pick(0.004, 0.002, 0.001);
  ed.transform({ move: [1e-6, 0] });   // the first read of the UV vertices' table
  for (let k = 0; k < 99; k++) { ed.pick(0.004 + k * 0.01, 0.002, 0.001); ed.transform({ move: [1e-6, 0] }); }
  // the heap's own word, in the measure's child: what the hundred steps hold, not only what the undo counts
  const { grew, held } = undoGrowth();
  assert.ok(grew < 24e6, `a hundred one-face steps held ${(grew / 1e6).toFixed(1)} MB more (a whole copy a step: 96 MB)`);
  assert.equal(held, ed.undoBytes(), 'the child\'s steps the same as these');
  assert.ok(ed.undoBytes() < 64 * 1024, `the undo holds ${ed.undoBytes()} bytes for a hundred steps of a few corners each`);
  assert.ok(ED.UV_UNDO_BYTES >= 64 * 1024 * 1024);
  const after = Float64Array.from(ed.session.cornerUv);
  for (let k = 0; k < 100; k++) assert.ok(ed.undo());
  assert.deepEqual([...ed.session.cornerUv], [...start], 'undone to the start, exactly');
  for (let k = 0; k < 100; k++) assert.ok(ed.redo());
  assert.deepEqual([...ed.session.cornerUv], [...after], 'redone, exactly');
  // seams: marked, then a move; both undone
  ed.setMode('edge');
  const [e0, e1] = ed.faceUvs(0);
  ed.pick((e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2, 1e-4);
  const seamsBefore = [...ed.session.seams];
  assert.equal(ed.seams(true), 1);
  ed.transform({ move: [0.5, 0] });
  ed.undo(); ed.undo();
  assert.deepEqual([...ed.session.seams], seamsBefore, 'the seam cleared again');
  ed.redo();
  assert.equal(ed.session.seams.size, seamsBefore.length + 1, 'and marked again');
  // the budget: steps that each move the whole material, past a small budget - the oldest go, the latest stays
  const small = ED.createUvEdit(mk(g.pos, g.idx, g.uvs), { undoBytes: 2e6 });
  for (let k = 0; k < 10; k++) small.transform({ move: [0.01, 0] });   // ~1.2 MB a step
  assert.ok(small.undoBytes() > 0 && small.undoBytes() <= 2e6, `the undo holds ${small.undoBytes()} bytes`);
  let n = 0; while (small.undo()) n++;
  assert.equal(n, 1, 'one step within two megabytes: the latest');
  assert.equal(small.changed(), true, 'and the steps let go are still changes');
});

test('AUDIT POI M7: a corner on the axis of a curved projection - a sphere\'s pole, a cylinder\'s cap centre - takes the mean angle of its face\'s others: every polar triangle one segment wide, where it stood at nought and its triangles ran one to fifteen segments (mutants: the axis corner at its own atan2; the wrap read from it)', () => {
  const seg = 16, rings = 8, pos = [0, 1, 0], idx = [];
  for (let r = 1; r < rings; r++) for (let k = 0; k < seg; k++) { const th = (r / rings) * Math.PI, ph = (k / seg) * 2 * Math.PI; pos.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)); }
  const ring = (r, k) => 1 + (r - 1) * seg + (k % seg);
  for (let k = 0; k < seg; k++) idx.push(0, ring(1, k + 1), ring(1, k));
  for (let r = 1; r < rings - 1; r++) for (let k = 0; k < seg; k++) idx.push(ring(r, k), ring(r, k + 1), ring(r + 1, k + 1), ring(r, k), ring(r + 1, k + 1), ring(r + 1, k));
  const s = UV.uvSessionOf(mk(pos, idx));
  UV.projectSphere(s, all(s), [0, 0, 0]);
  const width = (q, f) => { const u = [0, 1, 2].map((k) => q.cornerUv[(f * 3 + k) * 2]); return Math.max(...u) - Math.min(...u); };
  for (let f = 0; f < seg; f++) near(width(s, f) / ((2 * Math.PI) / seg), 1, 1e-6, `polar triangle ${f}, in segments`);
  // a cylinder with a bottom cap: its centre on the axis, each cap triangle as wide as a wall's
  const cp = [0, 0, 0], ci = [];
  for (const y of [0, 1]) for (let k = 0; k < seg; k++) { const a = (k / seg) * 2 * Math.PI; cp.push(Math.cos(a), y, Math.sin(a)); }
  const b = (k) => 1 + (k % seg), t = (k) => 1 + seg + (k % seg);
  for (let k = 0; k < seg; k++) ci.push(0, b(k + 1), b(k));
  for (let k = 0; k < seg; k++) ci.push(b(k), t(k + 1), b(k + 1), b(k), t(k), t(k + 1));
  const c = UV.uvSessionOf(mk(cp, ci));
  UV.projectCylinder(c, all(c), [0, 1, 0], [0, 0.5, 0]);
  const wall = width(c, seg);
  for (let f = 0; f < seg; f++) near(width(c, f), wall, 1e-6, `cap triangle ${f} against a wall's`);
});

test('AUDIT POI M8: the thumbnail\'s key light stands above the eye\'s LEFT shoulder and the fill low on its RIGHT, as their words say - set in the eye\'s own frame; a face turned to the eye\'s left drawn brighter than one turned to its right (mutants: the lights in the model\'s frame again; the key on the right)', () => {
  const eye = THUMB.thumbEye();
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** A white quad facing `n` (towards the eye, a little to one side), drawn alone: its middle pixel's red. */
  const shade = (side) => {
    const n = [0, 1, 2].map((a) => side * 0.6 * eye.right[a] - 0.8 * eye.f[a]);
    const ax = [0, 1, 2].map((a) => eye.up[a]), bx = [n[1] * ax[2] - n[2] * ax[1], n[2] * ax[0] - n[0] * ax[2], n[0] * ax[1] - n[1] * ax[0]];
    const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [0, 1, 2].map((a) => x * bx[a] + y * ax[a]));
    const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const w = cr(P[1].map((x, i) => x - P[0][i]), P[2].map((x, i) => x - P[0][i]));
    const idx = dot(w, n) > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    const mesh = { positions: Float32Array.from(P.flat()), normals: Float32Array.from([n, n, n, n].flat()), uvs: new Float32Array(8), indices: Uint16Array.from(idx), submeshes: [{ start: 0, count: 6 }] };
    const img = THUMB.renderThumb([{ mesh, materials: [{ color: [1, 1, 1, 1] }] }], { size: 32 });
    const o = (16 * 32 + 16) * 4;
    assert.equal(img.data[o + 3], 255, 'drawn');
    return img.data[o];
  };
  const left = shade(-1), right = shade(1);
  assert.ok(left > right + 10, `turned to the eye's left ${left}, to its right ${right}: the key on the left`);
  assert.ok(dot(THUMB.THUMB_KEY, eye.right) < 0 && dot(THUMB.THUMB_KEY, eye.up) > 0 && dot(THUMB.THUMB_KEY, eye.f) < 0, 'the key: left, above, from behind the eye');
  assert.ok(dot(THUMB.THUMB_FILL, eye.right) > 0 && dot(THUMB.THUMB_FILL, eye.f) < 0, 'the fill: right, from behind the eye');
});

test('AUDIT POI M9: packing - an empty island is left out (the rest still packed, not laid at a point); a pack that cannot fit answers 0, moves nothing and is no step, and the panel says so; a small standing island lies down on the tie as a large one does (mutants: the turns applied before a fit; the empty island read; the tie by an absolute step; the panel\'s word unsaid)', () => {
  const quads = (count, uvFn) => {
    const pos = [], idx = [], uv = [];
    for (let q = 0; q < count; q++) { const b = pos.length / 3; for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push(q * 3 + i, 0, j); uv.push(...uvFn(q, i, j)); } idx.push(b, b + 2, b + 1, b, b + 3, b + 2); }
    return mk(pos, idx, uv);
  };
  const s = UV.uvSessionOf(quads(3, (q, i, j) => [i * (q + 1), j]));
  const isl = UV.islandsOf(s);
  const k = UV.packIslands(s, [...isl, []]);
  assert.ok(k > 0.1, `scale ${k}`);
  for (const g of isl) { const b = UV.uvBounds(s, UV.cornersOf(g)); assert.ok(b[2] - b[0] > 0.05 && b[3] - b[1] > 0.05, `an island laid with its size: ${b}`); }
  // 1,200 islands at a margin of 0.03: the margins alone overfill the square
  const many = quads(1200, (q, i, j) => [i * 0.5 + j * 0.3, j * 0.4 - i * 0.2]);
  const m = UV.uvSessionOf(many);
  const before = Float64Array.from(m.cornerUv);
  assert.equal(UV.packIslands(m, UV.islandsOf(m), { margin: 0.03 }), 0);
  assert.deepEqual([...m.cornerUv], [...before], 'nothing moved');
  const ed = ED.createUvEdit(many);
  assert.equal(ed.pack({ margin: 0.03 }), 0);
  assert.equal(ed.canUndo(), false, 'no step');
  // the tie: a standing box lies down, small as large
  for (const [w, h] of [[0.1, 0.2], [0.01, 0.02], [1e-4, 2e-4]]) {
    const pts = [[0, 0], [w, 0], [w, h], [0, h]], a = (UV.minAreaTurn(pts) * Math.PI) / 180;
    const ru = pts.map(([u, v]) => u * Math.cos(a) + v * Math.sin(a)), rv = pts.map(([u, v]) => -u * Math.sin(a) + v * Math.cos(a));
    assert.ok(Math.max(...ru) - Math.min(...ru) > Math.max(...rv) - Math.min(...rv), `${w} x ${h} laid lying down`);
  }
});

test('AUDIT POI M9: the panel\'s Pack says when the islands do not fit at its margin', async () => {
  const { createPoiUvPanel } = await import('../../src/ui/poi/poiUvPanel.js');
  const pos = [], idx = [], uv = [];
  for (let q = 0; q < 400; q++) { const b = pos.length / 3; for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push(q * 3 + i, 0, j); uv.push(i, j); } idx.push(b, b + 2, b + 1, b, b + 3, b + 2); }
  const dlg = createPoiUvPanel({ doc: document, mesh: mk(pos, idx, uv), materials: 1, title: 'Pack', onApply: () => true, onClose() {} });
  const margin = dlg.root.querySelectorAll('input').find((n) => n.type === 'number' && n.max === '0.2');
  margin.value = '0.2'; margin.dispatch('change', {});
  const before = Float64Array.from(dlg.edit.session.cornerUv);
  dlg.root.querySelectorAll('button').find((n) => n.textContent === 'Pack').click();
  assert.match(dlg.root.textContent, /do not fit in the square at that margin/);
  assert.deepEqual([...dlg.edit.session.cornerUv], [...before]);
});

test('AUDIT POI M10: the weld joins vertices within its reach on every axis, wherever they fall on its grid - copies two ten-millionths apart across a cell\'s edge one vertex (one island), copies two reaches apart two (mutants: the weld by rounding again; the cells round a vertex unread)', () => {
  const two = (xa, xb) => {
    const pos = [xa - 1, 0, 0, xa, 0, 0, xa, 0, 1, xa - 1, 0, 1, xb, 0, 0, xb + 1, 0, 0, xb + 1, 0, 1, xb, 0, 1];
    const s = UV.uvSessionOf(mk(pos, [0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]));
    return [s.welded, UV.islandsOf(s).length];
  };
  assert.deepEqual(two(0.0000049, 0.0000051), [6, 1], 'a hair apart across the old grid\'s edge: welded');
  assert.deepEqual(two(0.0000051, 0.0000149), [6, 1], 'within the reach inside a cell: welded');
  assert.deepEqual(two(0.0000199, 0.0000201), [6, 1], 'and across the weld\'s own cells\' edge');
  assert.deepEqual(two(0, 0.00002), [8, 2], 'two reaches apart: apart');
  assert.deepEqual(two(-0.0000049, -0.0000051), [6, 1], 'and below nought');
});

test('AUDIT POI M11: the pivot is the middle of the selection\'s UV bounds - each point once, however many faces stand on it: a fan\'s pivot not drawn to its hub, a flip about it in place (mutants: the corners averaged again)', () => {
  const rim = [...Array(6).keys()].map((k) => [Math.cos(k * Math.PI / 3), Math.sin(k * Math.PI / 3)]);
  const pos = [0, 0, 0, ...rim.flatMap(([x, z]) => [x, 0, z]), 3, 0, 0];
  const idx = []; for (let k = 0; k < 6; k++) idx.push(0, 1 + ((k + 1) % 6), 1 + k);
  idx.push(1, 7, 2);
  const V = pos.length / 3;
  const ed = ED.createUvEdit(mk(pos, idx, [...Array(V).keys()].flatMap((v) => [pos[v * 3], pos[v * 3 + 2]])));
  ed.setMode('face'); ed.selectAll();
  const p = ed.pivot();
  near(p[0], 1, 1e-6, 'u: the middle of -1 .. 3'); near(p[1], 0, 1e-6, 'v');
  const b0 = UV.uvBounds(ed.session, ed.selectedCorners());
  ed.flip('u');
  UV.uvBounds(ed.session, ed.selectedCorners()).forEach((x, i) => near(x, b0[i], 1e-6, 'flipped in place'));
  assert.deepEqual(UV.uvCentre(ed.session, [0, 0, 0, 0, 3]), UV.uvCentre(ed.session, [0, 3]), 'a point counted twice moves nothing');
});

test('AUDIT POI M12: the thumbnail\'s rasterizer gives a pixel centre on an edge two triangles share to one of them - the top-left rule - so each pixel of a split square is drawn once, whatever the split\'s slope or winding (mutants: a centre on an edge every triangle\'s; the rule\'s level edge taken by the wrong side)', () => {
  const cover = (tris, W = 12) => {
    const n = new Uint8Array(W * W);
    for (const t of tris) THUMB.thumbRaster(...t, W, (x, y) => { n[y * W + x]++; });
    return n;
  };
  const once = (n, expect, what) => { let c = 0; for (const v of n) { assert.ok(v <= 1, `${what}: a pixel drawn ${v} times`); c += v; } assert.equal(c, expect, `${what}: every pixel inside`); };
  // a square split on its diagonal - the diagonal through four pixel centres - both windings
  const sq = [[1, 1, 5, 1, 5, 5], [1, 1, 5, 5, 1, 5]];
  once(cover(sq), 16, 'diagonal');
  once(cover(sq.map((t) => [t[0], t[1], t[4], t[5], t[2], t[3]])), 16, 'diagonal, wound the other way');
  // split down a column of centres (x = 3.5), and across a row of them (y = 2.5)
  once(cover([[1, 1, 3.5, 1, 3.5, 5], [1, 1, 3.5, 5, 1, 5], [3.5, 1, 6, 1, 6, 5], [3.5, 1, 6, 5, 3.5, 5]]), 20, 'a column');
  once(cover([[1, 1, 5, 1, 5, 2.5], [1, 1, 5, 2.5, 1, 2.5], [1, 2.5, 5, 2.5, 5, 6], [1, 2.5, 5, 6, 1, 6]]), 20, 'a row');
  // a square whose own edges run through centres: its top and left rows are its own, its bottom and right the next one's
  const half = cover([[0.5, 0.5, 4.5, 0.5, 4.5, 4.5], [0.5, 0.5, 4.5, 4.5, 0.5, 4.5]]);
  const got = []; half.forEach((v, i) => { if (v) got.push([i % 12, Math.floor(i / 12)]); });
  assert.deepEqual(got, [...Array(16).keys()].map((i) => [i % 4, Math.floor(i / 4)]), 'the top-left sixteen');
  // a fan of eight round a centre on a pixel centre
  const fan = [...Array(8).keys()].map((k) => { const a = (k / 8) * 2 * Math.PI, b = ((k + 1) / 8) * 2 * Math.PI; return [6.5, 6.5, 6.5 + 4 * Math.cos(a), 6.5 + 4 * Math.sin(a), 6.5 + 4 * Math.cos(b), 6.5 + 4 * Math.sin(b)]; });
  const f = cover(fan);
  assert.equal(f[6 * 12 + 6], 1, 'the fan\'s hub, a centre on all eight edges, drawn once');
  for (const v of f) assert.ok(v <= 1);
});

test('AUDIT POI M13: the unwrap runs off the page\'s thread - on a worker over its own session of the same mesh, laying the very UVs the same-thread unwrap lays, as one step; the tools wait while it works; a worker that errors or dies, a factory that throws, or none at all, and it runs here; an idle worker is let go; the worker\'s URL in the spelling the bundler reads (mutants: the answer unlaid; the tools not waiting; a dead worker\'s job dropped)', async () => {
  const { handleUnwrap } = await import('../../src/poi/uv/uvUnwrapWorker.js');
  const { createUnwrapThread } = await import('../../src/poi/uv/uvUnwrapClient.js');
  const fake = (answer = (msg, w) => handleUnwrap(msg, (reply) => w.onmessage?.({ data: reply }))) => {
    const w = { terminated: 0, onmessage: null, onerror: null, postMessage(msg) { queueMicrotask(() => answer(msg, w)); }, terminate() { w.terminated++; } };
    return w;
  };
  // a cylinder opened by marked seams
  const seg = 16, pos = [], idx = [];
  for (let r = 0; r <= 4; r++) for (let k = 0; k <= seg; k++) { const a = (k / seg) * 2 * Math.PI; pos.push(Math.cos(a), r / 2, Math.sin(a)); }
  const at = (k, r) => r * (seg + 1) + k;
  for (let r = 0; r < 4; r++) for (let k = 0; k < seg; k++) idx.push(at(k, r), at(k + 1, r + 1), at(k + 1, r), at(k, r), at(k, r + 1), at(k + 1, r + 1));
  const mesh = mk(pos, idx);
  const opened = (opts) => {
    const ed = ED.createUvEdit(mesh, opts);
    for (let r = 0; r < 4; r++) UV.setSeam(ed.session, ed.session.weld[at(0, r)], ed.session.weld[at(0, r + 1)], true);
    return ed;
  };
  const here = opened({ workerFactory: null });
  assert.equal(here.unwrap(), 1);
  const w = fake();
  const ed = opened({ workerFactory: () => w });
  const before = Float64Array.from(ed.session.cornerUv);
  const job = ed.unwrapOffThread();
  assert.equal(ed.busy(), true, 'out on the worker');
  assert.equal(ed.transform({ move: [1, 0] }), false, 'the tools wait');
  assert.equal(ed.pack(), 0);
  assert.equal(await job, 1);
  assert.equal(ed.busy(), false);
  assert.deepEqual([...ed.session.cornerUv], [...here.session.cornerUv], 'the very UVs the same-thread unwrap lays');
  ed.undo();
  assert.deepEqual([...ed.session.cornerUv], [...before], 'one step');
  // the fallbacks: the same UVs, here
  const warn = console.warn; console.warn = () => {};
  try {
    for (const factory of [
      () => fake((msg, x) => { if (msg.t === 'unwrap') x.onmessage({ data: { t: 'error', id: msg.id, message: 'boom' } }); }),
      () => fake((msg, x) => { if (msg.t === 'unwrap') x.onerror({ message: 'gone' }); }),
      () => { throw new Error('no workers here'); },
      null,
    ]) {
      const e = opened({ workerFactory: factory });
      assert.equal(await e.unwrapOffThread(), 1);
      assert.deepEqual([...e.session.cornerUv], [...here.session.cornerUv]);
      assert.equal(e.canUndo(), true);
    }
  } finally { console.warn = warn; }
  // an idle worker let go
  const w2 = fake();
  const th = createUnwrapThread(mesh, { workerFactory: () => w2, idleMs: 5 });
  assert.ok(await th.unwrap([0, 1], []));
  assert.equal(th.onWorker, true);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(w2.terminated, 1); assert.equal(th.onWorker, false);
  th.close();
  const client = readFileSync(new URL('../../src/poi/uv/uvUnwrapClient.js', import.meta.url), 'utf8');
  assert.match(client, /return new Worker\(new URL\('\.\/uvUnwrapWorker\.js', import\.meta\.url\), \{ type: 'module' \}\);/, 'the literal spelling Vite bundles');
});
