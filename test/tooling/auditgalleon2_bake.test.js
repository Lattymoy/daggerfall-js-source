// AUDIT GALLEON-2 (2026-10-03) - THE BAKE, SECOND READ: findings GN2-BK1 to GN2-BK5 pinned over tools/fbxMesh.mjs's
// port of Blender's fill, tools/bakeGalleon.mjs and the file it bakes (src/assets/galleon/galleon.json). The first
// audit (GN-B1) ported the fill as Blender 5.0 holds it; Mac's export was written by Blender 5.1.1 (its SceneInfo says
// so), and 5.1.0 rewrote the fill's point test and its kd-tree. So the judge here is Blender 5.1.1's own source -
// polyfill_2d.cc and mesh_tessellate.cc at the v5.1.1 tag, compiled verbatim (x86-64, -ffp-contract=off, as Blender
// builds): every literal cut below is its output, and where 5.0.1's cut differs the pin names 5.0.1's.
//   BK1 the fill is 5.1's: its point test, its kd-tree (own point first, collapse on removal, the index cache), her
//       hull's 24-gons #2 and #34 cut as 5.1.1 cuts them, every polygon of the export alike, eleven triangles of no
//       area, and an export from any other Blender refused by name;
//   BK2 the projection's comment says Blender's rule (coords_sign 1 where cross_poly_v2 <= 0);
//   BK3 its float comment says how Blender builds (no contraction), not what an ARM build might do;
//   BK4 --fbx records the file it baked, --out names where it goes;
//   BK5 round4 rounds a half step away from nought both sides, so a mirror pair never bakes apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as BAKE from '../../tools/bakeGalleon.mjs';   // its AUDIT GN2 names, read where the tree may not have them yet
import * as MESH from '../../tools/fbxMesh.mjs';
import { readFbx, nodeAt, childNamed, childrenNamed } from '../../tools/fbxRead.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BYTES = readFileSync(join(ROOT, BAKE.SOURCE_FBX));
const SHIPPED_TEXT = readFileSync(join(ROOT, BAKE.OUT), 'utf8');
const SHIPPED = JSON.parse(SHIPPED_TEXT);
const OBJECTS = BAKE.sceneObjects(readFbx(BYTES));
const MESH_SRC = readFileSync(join(ROOT, 'tools/fbxMesh.mjs'), 'utf8');
const F = Math.fround;
/** A cut as the compiled reference prints it: "a b c;d e f;...". */
const cutOf = (tris) => tris.map((t) => t.join(' ')).join(';');
const polygon = (name, k) => { const o = OBJECTS.find((x) => x.name === name); return o.polygons[k].map((vi) => o.local[vi]); };
/** A SceneInfo row of a tree (Original|ApplicationVersion and the like). */
const sceneInfoRow = (tree, key) => childrenNamed(childNamed(nodeAt(tree.nodes, 'FBXHeaderExtension', 'SceneInfo'), 'Properties70'), 'P').find((r) => r.props[0] === key);
/** A baked hull polygon's triangles back in its source corners and Blender's winding (the bake mirrors both). Her
 *  rudder's five faces are #78-#82, so her polygons before them keep their numbers in the hull part. */
const bakedCut = (part, k) => {
  const ring = [...part.polygons[k]].reverse();
  const out = [];
  for (let t = 0; t < part.triangleOf.length; t++) {
    if (part.triangleOf[t] !== k) continue;
    const [a, b, c] = part.triangles.slice(t * 3, t * 3 + 3).map((v) => ring.indexOf(v));
    out.push([a, c, b]);
  }
  return cutOf(out);
};

// ── BK1: the fill is Blender 5.1's ────────────────────────────────────────────────────────────────────────────────────

/** Compiled Blender 5.1.1 over every polygon of the export (59 objects, 2310 polygons, sceneObjects' order, each cut a
 *  line): sha256 of the lines joined by "\n". Compiled 5.0.1 gives 2605c541...; the port gave that until GN2-BK1. */
const BLENDER_511_ALL = '482e18133b0acce02f4fae66cd4a52fc65fe9822d10b14e88e337b06e6f8142b';
const BLENDER_501_ALL = '2605c5418c80ed25d26901e5890bd2039ac53d0d0e4bf07fcd8f9714e78ca937';
/** Her lower sides' 24-gons: Blender 5.1.1's cut, and 5.0.1's (the port's before GN2-BK1). */
const HULL_511 = Object.freeze({
  2: '23 0 1;23 1 2;20 21 22;19 20 22;16 17 18;19 22 23;18 19 23;15 16 18;12 13 14;11 12 14;8 9 10;7 8 10;5 6 7;3 4 5;3 5 7;7 10 11;11 14 15;2 3 7;7 11 15;15 18 23;23 2 7;7 15 23',
  34: '23 0 1;2 3 4;2 4 5;5 6 7;8 9 10;2 5 7;8 10 11;2 7 8;22 23 1;1 2 8;11 12 13;14 15 16;8 11 13;13 14 16;17 18 19;13 16 17;1 8 13;20 21 22;22 1 13;13 17 19;20 22 13;13 19 20',
});
const HULL_501 = Object.freeze({
  2: '23 0 1;23 1 2;20 21 22;19 20 22;16 17 18;18 19 22;18 22 23;15 16 18;12 13 14;15 18 23;11 12 14;11 14 15;8 9 10;11 15 23;7 8 10;7 10 11;5 6 7;3 4 5;3 5 7;7 11 23;2 3 7;2 7 23',
  34: '23 0 1;2 3 4;22 23 1;2 4 5;22 1 2;20 21 22;17 18 19;14 15 16;11 12 13;13 14 16;13 16 17;10 11 13;8 9 10;5 6 7;8 10 13;2 5 7;7 8 13;13 17 19;13 19 20;2 7 13;13 20 22;2 13 22',
});

test('AUDIT GALLEON-2 BK1: MAC\'S EXPORT IS BLENDER 5.1.1\'S AND EVERY POLYGON OF IT IS CUT AS 5.1.1 CUTS IT - her hull\'s lower 24-gons #2 and #34 (and their twins and stations, ten polygons in all) where 5.0.1 cut otherwise, in blenderTessellate and in the shipped bake through the mirror; all 2310 polygons of the export to compiled 5.1.1\'s digest (mutants: the 5.0 point test, the bounding box first, the point test in double)', () => {
  const tree = readFbx(BYTES);
  for (const key of ['Original|ApplicationVersion', 'LastSaved|ApplicationVersion']) assert.equal(sceneInfoRow(tree, key).props[4], '5.1.1', key);
  assert.equal(childNamed(tree.nodes, 'Creator').props[0], 'Blender (stable FBX IO) - 5.1.1 - 5.15.0');
  const hull = SHIPPED.parts.find((p) => p.role === 'hull');
  for (const k of [2, 34]) {
    assert.equal(cutOf(MESH.blenderTessellate(polygon('Cube', k))), HULL_511[k], `hull #${k}: Blender 5.1.1's cut`);
    assert.notEqual(HULL_511[k], HULL_501[k], `hull #${k}: 5.0.1 cut it otherwise`);
    assert.equal(bakedCut(hull, k), HULL_511[k], `hull #${k}: the shipped bake carries 5.1.1's cut`);
  }
  const all = OBJECTS.flatMap((o) => o.polygons.map((poly) => cutOf(MESH.blenderTessellate(poly.map((vi) => o.local[vi])))));
  assert.equal(all.length, 2310, 'every polygon of the export, the skipped objects too');
  const digest = createHash('sha256').update(all.join('\n')).digest('hex');
  assert.notEqual(digest, BLENDER_501_ALL, 'not Blender 5.0.1\'s cut');
  assert.equal(digest, BLENDER_511_ALL, 'compiled Blender 5.1.1\'s cut of all 2310');
});

test('AUDIT GALLEON-2 BK1: THE POINT TEST IS 5.1\'S (USE_PRECOMPUTED_ISECT) - each edge\'s vector and constant computed once, e.y x - e.x y + c >= 0, in single precision: three corners on one line in decimal and not in float block where span_tri_v2_sign\'s arithmetic let the ear go; on her hull\'s two 24-gons, with the walk, a corner past a convex ear\'s box rounded onto its edge\'s line blocks it (mutants: span_tri_v2_sign\'s test, the edges\' constants or the test in double)', () => {
  // corners 0, 1 and 4 stand on y = 0.75 x + 1.475 in decimal; in float32 corner 4 lies a hair off it
  const line = [[1.14, 2.33], [2.22, 3.14], [2.2, 1.5], [0.7, 1.1], [1.42, 2.54]].map((p) => p.map(F));
  assert.equal(cutOf(MESH.blenderPolyfill(line)), '1 2 3;1 3 4;0 1 4', 'Blender 5.1.1 (5.0.1, and 5.1.1 without the precomputed test: 0 1 2;2 3 4;0 2 4)');
  const far = [[1001.5, 2000.9], [1001.5, 2000.9], [1008, 2009], [1010.6, 2004.8], [1009.9, 2004.5]].map((p) => p.map(F));
  assert.equal(cutOf(MESH.blenderPolyfill(far)), '1 2 3;4 0 1;1 3 4', 'Blender 5.1.1 a kilometre out, a corner doubled (5.0.1: 2 3 4;0 1 2;0 2 4)');
});

test('AUDIT GALLEON-2 BK1: THE KD-TREE IS 5.1\'S - each node\'s own point asked before any bounds (so a corner on a tangential ear\'s line past its ends blocks it when the walk reaches it), its children pruned by the triangle\'s bounds, the centre\'s side first; a removed node with one child collapsed into its parent; the corner that last blocked an ear asked first, while it stays in the tree (mutants: the bounding box first, a removed node\'s point asked, each side\'s pruning dropped, the centre\'s side ignored, the axes not alternating, the lower median, convex corners in the tree, no collapse, a collapse past a live parent, no index cache, the cache never dirty, a changed ear\'s cached corner not asked)', () => {
  const F2 = (xy) => cutOf(MESH.blenderPolyfill(xy));
  // own point first: corner 2's tangential ear (2, 3, 1 on y = 1 over x 1..2 - corner 3 doubles corner 2) is blocked by
  // corner 4 at (0, 1), on its line past its end, as the walk reaches it; corner 3's is cut instead
  assert.equal(F2([[0, 0], [1, 1], [2, 1], [2, 1], [0, 1]]), '2 3 4;0 1 2;0 2 4', 'Blender 5.1.1 (5.0.1, bounds first: 1 2 3;0 1 3;0 3 4)');
  // collapse: after the fourth cut corner 0's ear (0, 2, 8, all at (1, 0) - no extent, so the point test passes any
  // corner against it) is blocked by corner 7, reached past a removed node collapsed out of the walk, whose split
  // pruned it before
  assert.equal(F2([[1, 0], [0, 1], [1, 0], [0, 2], [2, 1], [2, 0], [1, 1], [0, 2], [1, 0]]), '4 5 6;4 6 7;3 4 7;0 1 2;2 3 7;8 0 2;2 7 8', 'Blender 5.1.1 (without the collapse, and 5.0.1: 4 5 6;4 6 7;3 4 7;0 1 2;8 0 2;7 8 2;2 3 7)');
  // the index cache: after the fifth cut corner 6's ear (6, 8, 4, on y = x) has changed, and the corner that blocked it
  // before, 0 at (2, 2) on that line past its ends, is asked first and blocks it - the walk would have pruned it
  assert.equal(F2([[2, 2], [2, 2], [5, 1], [1, 1], [6, 6], [3, 3], [5, 5], [4, 4], [5, 5]]), '0 1 2;0 2 3;4 5 6;0 3 4;6 7 8;0 4 6;0 6 8', 'Blender 5.1.1 (without the cache: 0 1 2;0 2 3;4 5 6;0 3 4;6 7 8;4 6 8;0 4 8; 5.0.1: 0 1 2;0 2 3;6 7 8;5 6 8;5 8 0;4 5 0;0 3 4)');
  // the walk's pruning, each side: a corner on a tangential ear's line past its ends, under a node whose split stands
  // outside the triangle's bounds, is never reached (as 5.0.1 cuts these too)
  assert.equal(F2([[1, 1], [3, 3], [4, 1], [4, 4], [3, 3]]), '4 0 1;4 1 2;2 3 4', 'Blender 5.1.1: the positive side pruned');
  assert.equal(F2([[0, 1], [1, 1], [5, 5], [2, 2], [2, 2]]), '2 3 4;2 4 0;0 1 2', 'Blender 5.1.1: the negative side pruned');
  // the centre's side first: which corner the walk finds first is the one cached, and a later ear asks it
  assert.equal(F2([[0, 0], [3, 3], [4, 4], [3, 3], [0, 0], [1, 1]]), '5 0 1;2 3 4;5 1 2;2 4 5', 'Blender 5.1.1 (5.0.1: 1 2 3;4 5 0;0 1 3;0 3 4)');
  // the axes alternating x, y down the tree: which nodes prune
  assert.equal(F2([[1, 1], [2, 1], [3, 3], [4, 4], [4, 4]]), '3 4 0;1 2 3;0 1 3', 'Blender 5.1.1 (5.0.1: 2 3 4;1 2 4;0 1 4)');
});

test('AUDIT GALLEON-2 BK1: ELEVEN TRIANGLES OF NO AREA, BLENDER 5.1.1\'S - on corners Mac drew on one line: four on her lower side #2, two on #33, one on her inner planking #34, three on #76, one on her castle #20 (5.0.1\'s cut laid thirteen: five on #2, two on #34) (mutants: the 5.0 point test)', () => {
  const where = [];
  for (const part of SHIPPED.parts) {
    const P = (v) => part.positions.slice(v * 3, v * 3 + 3);
    for (let t = 0; t < part.triangleOf.length; t++) {
      const [a, b, c] = part.triangles.slice(t * 3, t * 3 + 3).map(P);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      if (Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) <= 1e-12) where.push(`${part.role} #${part.triangleOf[t]}`);
    }
  }
  assert.deepEqual(where, ['hull #2', 'hull #2', 'hull #2', 'hull #2', 'hull #33', 'hull #33', 'hull #34', 'hull #76', 'hull #76', 'hull #76', 'castle #20']);
});

test('AUDIT GALLEON-2 BK1: THE BAKE REFUSES AN EXPORT FROM ANY BLENDER BUT THE ONE ITS FILL IS, BY NAME - SceneInfo\'s Original and LastSaved ApplicationVersion must be 5.1.x (the fill changed at 5.1.0; 5.1.0 and 5.1.1 hold the same polyfill_2d.cc) and its ApplicationName Blender\'s; 5.1.0 bakes the same file (mutants: the version unread, LastSaved unread, the name unread)', () => {
  assert.equal(MESH.BLENDER_FILL, '5.1', 'the Blender whose fill tools/fbxMesh.mjs ports');
  const bake = (edit) => { const tree = readFbx(BYTES); edit(tree); return () => BAKE.bakeGalleon(BYTES, tree); };
  const set = (key, v) => (tree) => { sceneInfoRow(tree, key).props[4] = v; };
  assert.throws(bake(set('Original|ApplicationVersion', '5.0.1')), /written by Blender 5\.0\.1 \(SceneInfo Original\|ApplicationVersion\) - tools\/fbxMesh\.mjs cuts faces as Blender 5\.1 does/);
  assert.throws(bake(set('LastSaved|ApplicationVersion', '5.2.0')), /written by Blender 5\.2\.0 \(SceneInfo LastSaved\|ApplicationVersion\)/);
  assert.throws(bake(set('Original|ApplicationVersion', '5.10.0')), /written by Blender 5\.10\.0/, 'not a 5.1 by its prefix');
  assert.throws(bake(set('Original|ApplicationName', 'Maya')), /written by Maya \(SceneInfo Original\|ApplicationName\), not Blender/);
  assert.throws(bake((tree) => { const h = nodeAt(tree.nodes, 'FBXHeaderExtension'); h.children = h.children.filter((c) => c.name !== 'SceneInfo'); }), /no SceneInfo/);
  const same = BAKE.bakeGalleon(BYTES, (() => { const tree = readFbx(BYTES); set('Original|ApplicationVersion', '5.1.0')(tree); set('LastSaved|ApplicationVersion', '5.1.0')(tree); return tree; })());
  assert.equal(BAKE.galleonJson(same), SHIPPED_TEXT, '5.1.0 bakes the same file');
});

// ── BK2, BK3: the port's comments say what Blender does ───────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 BK2: THE PROJECTION\'S COMMENT SAYS BLENDER\'S RULE - BLI_polyfill_calc\'s coords_sign 1 is the winding polyfill_prepare derives from cross_poly_v2 <= 0 (math_geom.cc\'s sum, verbatim here): blenderProject\'s faces have it, strictly, and the comment no longer says ">= 0"', () => {
  assert.doesNotMatch(MESH_SRC, /coords_sign 1: cross_poly_v2 >= 0/);
  assert.match(MESH_SRC, /cross_poly_v2 <= 0/);
  // cross_poly_v2, as math_geom.cc sums it: (prev.x - cur.x) * (cur.y + prev.y), from the last corner round
  const crossPoly = (v) => { let c = 0, prev = v[v.length - 1]; for (const cur of v) { c += (prev[0] - cur[0]) * (cur[1] + prev[1]); prev = cur; } return c; };
  for (const face of [[[0, 0, 0], [4, 0, 0], [4, 2, 0], [0, 2, 0]], [[2, 0, 0], [4, 1.5, 0], [3, 4, 0], [1, 4, 0], [0, 1.5, 0]], polygon('Cube', 2), polygon('Cube', 34)]) {
    assert.ok(crossPoly(MESH.blenderProject(face)) < 0, 'cross_poly_v2 < 0: coords_sign 1');
  }
});

test('AUDIT GALLEON-2 BK3: THE FLOAT COMMENT SAYS HOW BLENDER BUILDS - -ffp-contract=off on Apple, Unix and Windows\' clang (v5.1.1\'s build_files/cmake/platform), no fused multiply-add for a*b - c*d to round into; not "an ARM build may contract"', () => {
  assert.doesNotMatch(MESH_SRC, /an ARM build may contract/);
  assert.match(MESH_SRC, /-ffp-contract=off/);
  assert.match(MESH_SRC, /platform_apple\.cmake:161/);
});

// ── BK4: the CLI says what it baked and where ─────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 BK4: --fbx BAKES THE FILE GIVEN AND RECORDS IT, --out WRITES WHERE IT IS TOLD - a copy outside the repo recorded by its own path, the repo\'s export by its path in the repo however it was named, the defaults the repo\'s own from any directory; the repo\'s galleon.json untouched (mutants: SOURCE_FBX recorded whatever was baked, --out unread)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gn2bk4-'));
  try {
    const bake = (...args) => execFileSync(process.execPath, [join(ROOT, 'tools/bakeGalleon.mjs'), ...args], { cwd: tmp, encoding: 'utf8' });
    // the repo's own export first: a bake that ignored --out would write the repo's file as it stands
    bake(`--fbx=${join(ROOT, BAKE.SOURCE_FBX)}`, `--out=${join(tmp, 'b.json')}`);
    assert.ok(existsSync(join(tmp, 'b.json')), '--out: written where it was told');
    assert.ok(!existsSync(join(tmp, 'src')), 'and nowhere else');
    assert.equal(readFileSync(join(tmp, 'b.json'), 'utf8'), SHIPPED_TEXT, 'the repo\'s export, named absolutely: its path in the repo, the file committed');
    const copy = join(tmp, 'Another_Ship.fbx');
    copyFileSync(join(ROOT, BAKE.SOURCE_FBX), copy);
    bake(`--fbx=${copy}`, '--out=a.json');
    const a = JSON.parse(readFileSync(join(tmp, 'a.json'), 'utf8'));   // relative to where it ran
    const inRepo = !relative(ROOT, copy).startsWith('..');   // a mutation workspace keeps its TMPDIR inside it
    assert.equal(a.source, inRepo ? relative(ROOT, copy).split(sep).join('/') : copy, 'another file: recorded by its own path (in the repo, its path there)');
    assert.deepEqual({ ...a, source: SHIPPED.source }, SHIPPED, 'the same bytes bake the same parts');
    bake('--out=c.json');
    assert.equal(readFileSync(join(tmp, 'c.json'), 'utf8'), SHIPPED_TEXT, 'the defaults: the repo\'s export, from any directory');
    assert.equal(readFileSync(join(ROOT, BAKE.OUT), 'utf8'), SHIPPED_TEXT, 'the repo\'s galleon.json untouched');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  assert.equal(BAKE.sourcePath(join(ROOT, 'src', 'x.fbx')), 'src/x.fbx', 'in the repo: its path there, forward slashes');
  assert.equal(BAKE.sourcePath(join(ROOT, '..', 'x.fbx')), join(ROOT, '..', 'x.fbx'), 'outside it: where it lies');
});

// ── BK5: a half step rounds alike both sides ──────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 BK5: round4 ROUNDS A HALF STEP AWAY FROM NOUGHT BOTH SIDES - so a mirror pair whose |x| falls on a half step bakes to the same |x| (Math.round alone took -1.23465 to -1.2346 and 1.23465 to 1.2347); never a -0; the committed bake as it was (its closest coordinate to a half step 3.78e-4 of one) (mutants: Math.round alone)', () => {
  assert.equal(typeof BAKE.round4, 'function');
  for (const [v, r] of [[1.23465, 1.2347], [0.00125, 0.0013], [5.79725, 5.7973], [1.23464, 1.2346], [2, 2]]) {
    assert.equal(BAKE.round4(v), r, `round4(${v})`);
    assert.equal(BAKE.round4(-v), -r, `round4(-${v})`);
  }
  assert.ok(Object.is(BAKE.round4(-0), 0) && Object.is(BAKE.round4(-0.00004), 0), 'no -0 in the file');
});
