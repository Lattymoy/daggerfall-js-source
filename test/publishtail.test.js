// PERF-EXT-C4 (2026-09-25, the players: "fps issues in the exterior but
// fine in the interior", "me too my friend.. don't know why. I got a
// RX6600") - THE PUBLISH TAIL BREATHES. A streamed pixel's build breathed
// between its models (PERF7) and then ran its tail in one piece: the flats
// loop (every texture a cached promise, a microtask that gives no frame
// back), StaticBatchBuilder.finish and createMesh's spheres - on a
// synthetic city pixel 45-60 ms of ONE frame. The merge now yields between
// units and hands createMesh the spheres it measured. Everything it makes
// is held here to the bytes the unbroken tail made, on the real builder,
// the real boundsOf and the real Renderer on a GL that answers the
// constructor and nothing more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SB from '../src/render/staticBatch.js';
import * as B from '../src/render/bounds.js';
import { Renderer } from '../src/render/renderer.js';
import { trs } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');
const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

function glCanvas() {
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
}

/** the hunter's synthetic block model: `verts` vertices, `tris` triangles over `subs` textures */
function model(verts, tris, subs, seed) {
  const positions = new Float32Array(verts * 3), normals = new Float32Array(verts * 3), uvs = new Float32Array(verts * 2);
  for (let i = 0; i < verts * 3; i++) { positions[i] = ((i * 7919 + seed) % 1000) / 10 - 30; normals[i] = i % 3 === 1 ? 1 : 0; }
  for (let i = 0; i < verts * 2; i++) uvs[i] = (i % 17) / 16;
  const indices = new Uint32Array(tris * 3); for (let i = 0; i < indices.length; i++) indices[i] = (i * 31 + seed) % verts;
  const per = Math.floor(tris / subs); const subMeshes = [];
  for (let s = 0; s < subs; s++) subMeshes.push({ textureArchive: 100 + ((seed + s) % 40), textureRecord: s, startIndex: s * per * 3, primitiveCount: s === subs - 1 ? tris - per * (subs - 1) : per });
  return { positions, normals, uvs, indices, subMeshes };
}
function builder(n) {
  const kinds = Array.from({ length: 30 }, (_, i) => model(60 + (i % 5) * 20, 40, 3, i));
  const b = new SB.StaticBatchBuilder(); const res = SB.keyResolver(new Map([['101_0', '909_4']]));
  for (let i = 0; i < n; i++) {
    const m = trs(i % 37 * 8, (i % 3) * 2, Math.floor(i / 37) * 8, 0, (i * 37) % 360, 0);
    if (i % 11 === 0) { m[0] = -m[0]; m[1] = -m[1]; m[2] = -m[2]; }   // WOD5: a mirrored placement now and then
    b.add(kinds[i % 30], m, res);
  }
  return b;
}

test('PERF-EXT-C4: boundsSteps is boundsOf cut in ranges - the same sphere, bit for bit, however the vertices are cut', () => {
  assert.equal(typeof B.boundsSteps, 'function', 'the sliced sphere exists');
  const drain = (it) => { let r = it.next(), n = 0; while (!r.done) { n++; r = it.next(); } return [r.value, n]; };
  const shapes = [
    new Float32Array(0),
    new Float32Array([4, -2, 9]),
    Float32Array.from({ length: 3 * 5000 }, (_, i) => Math.sin(i * 0.731) * 400 + (i % 3) * 7),
    Float32Array.from({ length: 3 * 777 }, (_, i) => (i === 3 * 776 ? 1e5 : i === 1 ? -3e4 : (i * 13) % 97 - 50)),   // the extremes in the last range and the first
  ];
  for (const p of shapes) {
    const want = bytes(B.boundsOf(p));
    for (const range of [1, 7, 256, B.BOUNDS_RANGE, 1e9]) {
      const [got, yields] = drain(B.boundsSteps(p, range));
      assert.equal(bytes(got), want, `${p.length / 3} vertices in ranges of ${range}`);
      assert.equal(yields, 2 * Math.ceil(p.length / 3 / range), 'a yield after every range of either pass');
    }
  }
});

test('PERF-EXT-C4: finishSliced makes finish()\'s mesh and createMesh\'s spheres, byte for byte, a breath between every unit', async () => {
  assert.equal(typeof SB.StaticBatchBuilder.prototype.finishSliced, 'function');
  const N = 300;
  const ref = builder(N).finish();
  const r = new Renderer(glCanvas());
  const refMesh = r.createMesh(ref);
  let breaths = 0;
  const b = builder(N);
  const merged = await b.finishSliced(async () => { breaths++; });
  for (const k of ['positions', 'normals', 'uvs', 'indices']) assert.equal(bytes(merged[k]), bytes(ref[k]), `${k}: the same bytes`);
  assert.deepEqual(merged.subMeshes, ref.subMeshes, 'the same groups, in the same order');
  assert.deepEqual([merged.vertexCount, merged.triangles, merged.models], [ref.vertexCount, ref.triangles, ref.models]);
  assert.equal(bytes(merged.bounds.whole), bytes(refMesh.bounds), 'the whole sphere createMesh measures');
  assert.equal(merged.bounds.subs.length, refMesh.subMeshes.length);
  merged.bounds.subs.forEach((s, i) => assert.equal(bytes(s), bytes(refMesh.subMeshes[i]._bounds), `group ${i}'s sphere`));
  const ranges = 2 * Math.ceil(ref.vertexCount / B.BOUNDS_RANGE);
  assert.ok(breaths >= N + ranges + ref.subMeshes.length, `a breath after each model's copy, each sphere range and each group (${breaths})`);
  assert.equal(await new SB.StaticBatchBuilder().finishSliced(async () => {}), null, 'nothing added, nothing made');
});

test('PERF-EXT-C4: createMesh handed the measured spheres takes them and reads no vertex; handed none, it measures as before', () => {
  const N = 40;
  const merged = builder(N).finish();
  let reads = 0;
  const counted = (a) => new Proxy(a, { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k)) reads++; const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; } });
  const r = new Renderer(glCanvas());
  const whole = new Float32Array([1, 2, 3, 4]);
  const subs = merged.subMeshes.map((_, i) => new Float32Array([i, i, i, i]));
  const mesh = r.createMesh({ ...merged, positions: counted(merged.positions) }, { bounds: { whole, subs } });
  assert.equal(reads, 0, 'no vertex read: the spheres are not walked again');
  assert.equal(mesh.bounds, whole);
  mesh.subMeshes.forEach((sm, i) => assert.equal(sm._bounds, subs[i]));
  reads = 0;
  const plain = r.createMesh({ ...merged, positions: counted(merged.positions) });
  assert.ok(reads > 0, 'handed nothing, it measures');
  assert.equal(bytes(plain.bounds), bytes(B.boundsOf(merged.positions)));
});

test('PERF-EXT-C4: the world host merges a breath at a time, hands the spheres to the upload, and breathes between flat groups', () => {
  assert.match(WORLD, /const staticMerged = await staticBuilder\.finishSliced\(\(\) => breather\.breathe\(\)\);[^\n]*\n\s+const staticBatch = staticMerged \? renderer\.createMesh\(staticMerged, \{ bounds: staticMerged\.bounds \}\) : null;/);
  assert.match(WORLD, /    for \(const \[k, centers\] of groups\) \{\n      await breather\.breathe\(\);/, 'a flat group a breath');
  // the interior and the dungeon merge once at their first frame, and keep finish()
  for (const f of ['src/scenes/interiorContext.js', 'src/scenes/dungeonContext.js']) {
    assert.match(readFileSync(join(root, f), 'utf8'), /const m = staticBuilder\.finish\(\); staticBatch = m \? renderer\.createMesh\(m\) : null;/, f);
  }
});
