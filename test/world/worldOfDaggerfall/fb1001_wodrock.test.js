// FB1001-WODROCK (2026-10-01, the field: "MASSIVE buggy mountain at 823, 399 - insane"; Mac: "Retexture them to be as
// detailed as possible"). World of Daggerfall builds its massifs out of ARCH3D's pebbles scaled by hundreds and
// thousands (WOD_Mountain_01r1's spire at (824,399): model 60716 at 398 x 1101 x 398), and the model's own UVs rode the
// scale - one 64x64 repeat over 600 m to 2.6 km of face, 0.03 to 0.5 texels a metre against the pebble's 12 to 150.
// world/worldOfDaggerfall/wodRockUv.js unfolds each plane of a piece stretched 4x or more at its pebble's own texel density; the piece
// stands where it stood, as tall, colliding as before. Pinned on a made pebble (no game data): the density and the
// texture's orientation on every face, the planes' seams, the whole-repeat shift, a vertex two planes share, a mirror,
// the unit-scale piece byte for byte through the static batch, and the host's one call. With ARENA2_PATH, the real
// spire's numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { wodRockUvs, pieceStretch, WOD_ROCK_STRETCH_MIN } from '../../../src/world/worldOfDaggerfall/wodRockUv.js';
import { objectMatrix } from '../../../src/world/worldOfDaggerfall/wodLocationObjects.js';
import { StaticBatchBuilder } from '../../../src/render/staticBatch.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data spire skipped' : false;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/** A pebble the way dfMeshToModel makes one: every plane its own vertices, a fan of triangles, flat normals, UVs an
 *  affine map of the plane (KU repeats a metre along the plane's first edge, KV across it - anisotropic on purpose).
 *  Its base is a quad (two triangles sharing an edge); its sides are four triangles round an off-centre apex. */
const KU = 1.6, KV = 2.9;
function pebble() {
  const base = [[-0.40, -0.20, -0.30], [0.35, -0.20, -0.32], [0.38, -0.20, 0.28], [-0.36, -0.20, 0.33]];
  const apex = [0.05, 0.40, -0.03];
  const planes = [[base[0], base[1], base[2], base[3]]];   // the quad, wound so its normal points down (outward)
  for (let i = 0; i < 4; i++) planes.push([base[(i + 1) % 4], base[i], apex]);
  const positions = [], normals = [], uvs = [], indices = [];
  planes.forEach((poly, k) => {
    const first = positions.length / 3;
    const n = unit(cross(sub(poly[1], poly[0]), sub(poly[2], poly[0])));
    const t = unit(sub(poly[1], poly[0])), b = cross(n, t);
    for (const p of poly) {
      positions.push(...p); normals.push(...n);
      const d = sub(p, poly[0]);
      uvs.push(0.25 * k + dot(d, t) * KU, 0.1 + dot(d, b) * KV);
    }
    for (let j = 1; j + 1 < poly.length; j++) indices.push(first, first + j, first + j + 1);
  });
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices), subMeshes: [{ textureArchive: 141, textureRecord: 2, startIndex: 0, primitiveCount: indices.length / 3 }],
  };
}

/** Per triangle: the UV map's two singular values in repeats a metre (finest, coarsest) and its orientation against the
 *  face's own normal (the sign of its determinant in the frame (t, n x t)), with the piece's matrix applied. */
function faces(cpu, M = null) {
  const L = (p) => (M ? [M[0] * p[0] + M[4] * p[1] + M[8] * p[2], M[1] * p[0] + M[5] * p[1] + M[9] * p[2], M[2] * p[0] + M[6] * p[1] + M[10] * p[2]] : p);
  const out = [];
  for (let i = 0; i < cpu.indices.length; i += 3) {
    const v = [cpu.indices[i], cpu.indices[i + 1], cpu.indices[i + 2]];
    const p = v.map((j) => L([cpu.positions[j * 3], cpu.positions[j * 3 + 1], cpu.positions[j * 3 + 2]]));
    const e1 = sub(p[1], p[0]), e2 = sub(p[2], p[0]), n = unit(cross(e1, e2)), t = unit(e1), b = cross(n, t);
    const x1 = dot(e1, t), y1 = dot(e1, b), x2 = dot(e2, t), y2 = dot(e2, b), k = x1 * y2 - x2 * y1;
    const du1 = cpu.uvs[v[1] * 2] - cpu.uvs[v[0] * 2], dv1 = cpu.uvs[v[1] * 2 + 1] - cpu.uvs[v[0] * 2 + 1];
    const du2 = cpu.uvs[v[2] * 2] - cpu.uvs[v[0] * 2], dv2 = cpu.uvs[v[2] * 2 + 1] - cpu.uvs[v[0] * 2 + 1];
    const a = (du1 * y2 - du2 * y1) / k, c = (du2 * x1 - du1 * x2) / k, d = (dv1 * y2 - dv2 * y1) / k, e = (dv2 * x1 - dv1 * x2) / k;
    const s1 = a * a + c * c + d * d + e * e, s2 = Math.sqrt((a * a + c * c - d * d - e * e) ** 2 + 4 * (a * d + c * e) ** 2);
    out.push({ fine: Math.sqrt((s1 + s2) / 2), coarse: Math.sqrt(Math.max(0, (s1 - s2) / 2)), sign: Math.sign(a * e - c * d) });
  }
  return out;
}
const near = (a, b, rel = 1e-3, what = '') => assert.ok(Math.abs(a / b - 1) <= rel, `${what}: ${a} vs ${b}`);

const ROT = { x: 0.12, y: -0.9, z: 0.05, w: 0.42 };   // an arbitrary turn, normalized by objectMatrix as Unity would
const SPIRE = { x: 400, y: 1100, z: 400 };            // WOD_Mountain_01r1 object 7's stretch, near enough

test('FB1001-WODROCK: a piece stretched 400 x 1100 x 400 carries its pebble\'s texel density on every face - it carried a 1,100th of it', () => {
  const cpu = pebble(), M = objectMatrix([211, 1167, 89], ROT, SPIRE);
  const own = faces(cpu), was = faces(cpu, M), now = faces(wodRockUvs(cpu, M), M);
  assert.equal(now.length, own.length);
  own.forEach((f, i) => {
    near(now[i].fine, f.fine, 1e-3, `face ${i} finest axis`);
    near(now[i].coarse, f.coarse, 1e-3, `face ${i} coarsest axis`);
    assert.equal(now[i].sign, f.sign, `face ${i}: the texture is not mirrored on the face`);
    assert.ok(was[i].coarse < f.coarse / 300, `face ${i}: the stretch it had (${was[i].coarse} repeats/m against ${f.coarse})`);
  });
  // the made pebble's own numbers, so the law is about something: KU and KV repeats a metre on every face
  for (const f of own) { near(f.fine, KV, 1e-4, 'pebble finest'); near(f.coarse, KU, 1e-4, 'pebble coarsest'); }
});

test('FB1001-WODROCK: under the threshold the piece is the SAME object - and it batches byte for byte as before', () => {
  const cpu = pebble();
  for (const s of [{ x: 1, y: 1, z: 1 }, { x: 2.65, y: 2.65, z: 2.65 }, { x: 1.39, y: 0.67, z: 1 }, { x: 3.99, y: 1, z: 2 }, { x: -1.57, y: 1, z: 1 }]) {
    const M = objectMatrix([5, 6, 7], ROT, s);
    assert.ok(pieceStretch(M) < WOD_ROCK_STRETCH_MIN);
    assert.equal(wodRockUvs(cpu, M), cpu, `scale ${JSON.stringify(s)} is left alone`);
    const a = new StaticBatchBuilder(), b = new StaticBatchBuilder();
    a.add(cpu, M, (ar, r) => `${ar}_${r}`); b.add(wodRockUvs(cpu, M), M, (ar, r) => `${ar}_${r}`);
    const ma = a.finish(), mb = b.finish();
    for (const k of ['positions', 'normals', 'uvs', 'indices']) assert.deepEqual(mb[k], ma[k], `${k} at ${JSON.stringify(s)}`);
  }
  assert.equal(WOD_ROCK_STRETCH_MIN, 4);
  // at the threshold, on any one axis, whatever the turn: re-mapped
  for (const s of [{ x: 4, y: 1, z: 1 }, { x: 1, y: 4, z: 1 }, { x: 1, y: 1, z: 4 }, { x: 1, y: 1100, z: 1 }]) {
    const M = objectMatrix([0, 0, 0], ROT, s);
    assert.notEqual(wodRockUvs(cpu, M), cpu, `scale ${JSON.stringify(s)} is re-mapped`);
    faces(wodRockUvs(cpu, M), M).forEach((f, i) => near(f.coarse, faces(cpu)[i].coarse, 1e-3, `scale ${JSON.stringify(s)} face ${i}`));
  }
});

test('FB1001-WODROCK: a plane is one map - its two triangles meet without a seam - and starts within a repeat of zero', () => {
  const cpu = pebble(), M = objectMatrix([9000, -800, -11000], ROT, SPIRE);
  const out = wodRockUvs(cpu, M);
  // the base quad: vertices 0..3, triangles (0,1,2) and (0,2,3). The map fitted on the first triangle predicts the
  // fourth vertex's UV exactly - one affine function over the plane, so no seam along the shared diagonal
  const P = (j) => { const p = [cpu.positions[j * 3], cpu.positions[j * 3 + 1], cpu.positions[j * 3 + 2]]; return [M[0] * p[0] + M[4] * p[1] + M[8] * p[2], M[1] * p[0] + M[5] * p[1] + M[9] * p[2], M[2] * p[0] + M[6] * p[1] + M[10] * p[2]]; };
  const e1 = sub(P(1), P(0)), e2 = sub(P(2), P(0)), e3 = sub(P(3), P(0));
  const t = unit(e1), b = cross(unit(cross(e1, e2)), t);
  const [x1, y1, x2, y2, x3, y3] = [dot(e1, t), dot(e1, b), dot(e2, t), dot(e2, b), dot(e3, t), dot(e3, b)];
  const k = x1 * y2 - x2 * y1;
  for (const c of [0, 1]) {
    const d1 = out.uvs[2 + c] - out.uvs[c], d2 = out.uvs[4 + c] - out.uvs[c];
    const gx = (d1 * y2 - d2 * y1) / k, gy = (d2 * x1 - d1 * x2) / k;
    const want = out.uvs[c] + gx * x3 + gy * y3;
    assert.ok(Math.abs(out.uvs[6 + c] - want) < 1e-3, `the quad's fourth corner sits on its plane's map (${c ? 'v' : 'u'}: ${out.uvs[6 + c]} vs ${want})`);
  }
  // each plane's UVs start within one repeat of zero: whole repeats shifted off (REPEAT makes them invisible), so a
  // 1.4 km face's UVs stay in the low thousands rather than wherever the piece's place in the world put them
  const planes = [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15]];
  for (const pl of planes) {
    for (const c of [0, 1]) {
      const m = Math.min(...pl.map((j) => out.uvs[j * 2 + c]));
      assert.ok(m >= 0 && m < 1, `plane ${pl}: its least ${c ? 'v' : 'u'} is ${m}`);
    }
  }
  let max = 0; for (const v of out.uvs) max = Math.max(max, Math.abs(v));
  assert.ok(max < 2000, `the UVs stay small: ${max}`);
});

test('FB1001-WODROCK: a vertex two planes share is copied for the second, and the model handed in is never written', () => {
  // a tent of two planes sharing their ridge (vertices 1 and 2) - not how dfMeshToModel builds one, but a model may
  const positions = new Float32Array([0, 0, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1]);
  const normals = new Float32Array(18).fill(0.5);
  const uvs = new Float32Array([0, 0, 0.7, 0, 0.7, 1.6, 0, 1.6, 0.2, 0.9, 0.2, 2.5]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 2, 1, 4, 5, 2]);
  const cpu = { positions, normals, uvs, indices, subMeshes: [{ textureArchive: 141, textureRecord: 2, startIndex: 0, primitiveCount: 4 }] };
  const before = { p: positions.slice(), n: normals.slice(), u: uvs.slice(), i: indices.slice() };
  const M = objectMatrix([0, 0, 0], ROT, SPIRE);
  const out = wodRockUvs(cpu, M);
  assert.deepEqual([cpu.positions, cpu.normals, cpu.uvs, cpu.indices], [before.p, before.n, before.u, before.i], 'the cached model is untouched');
  assert.equal(out.positions.length / 3, 8, 'the ridge\'s two vertices copied for the second plane');
  assert.deepEqual([...out.indices.slice(0, 6)], [0, 1, 2, 0, 2, 3], 'the first plane keeps its own');
  const [a4, c2, c1, b4, v5, d2] = out.indices.slice(6);   // was (4, 2, 1), (4, 5, 2)
  assert.deepEqual([a4, b4, v5], [4, 4, 5], 'the second plane\'s own vertices are its own');
  assert.equal(c2, d2, 'one copy of vertex 2 for both its triangles');
  assert.deepEqual([c1, c2].sort(), [6, 7], 'the second plane draws the ridge through its copies');
  for (const [copy, of] of [[c2, 2], [c1, 1]]) {
    assert.deepEqual([...out.positions.slice(copy * 3, copy * 3 + 3)], [...positions.slice(of * 3, of * 3 + 3)], `copy ${copy} stands where vertex ${of} does`);
    assert.deepEqual([...out.normals.slice(copy * 3, copy * 3 + 3)], [...normals.slice(of * 3, of * 3 + 3)], `copy ${copy} carries vertex ${of}'s normal`);
  }
  const own = faces(cpu), now = faces(out, M);
  own.forEach((f, i) => { near(now[i].coarse, f.coarse, 1e-3, `face ${i}`); near(now[i].fine, f.fine, 1e-3, `face ${i}`); });
});

test('FB1001-WODROCK: a mirrored piece (a negative scale) keeps the density too', () => {
  const cpu = pebble(), M = objectMatrix([0, 0, 0], ROT, { x: -400, y: 1100, z: 400 });
  const own = faces(cpu), now = faces(wodRockUvs(cpu, M), M);
  own.forEach((f, i) => { near(now[i].coarse, f.coarse, 1e-3, `face ${i}`); near(now[i].fine, f.fine, 1e-3, `face ${i}`); });
});

test('FB1001-WODROCK: the streaming host re-maps each WoD piece as it reads its model - one call, the mod\'s loop alone', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /^import \{ wodRockUvs \} from '\.\.\/world\/worldOfDaggerfall\/wodRockUv\.js';/m);   // HOST-SPLIT 2: the pixel build's own import line now
  // the piece's model is read through it, before its box, its batch and its collider: the batch draws the new UVs,
  // and the box and the collider read the same positions and indices (a dfMeshToModel pebble's own arrays - below)
  assert.match(w, /for \(const m of place\.models\) \{\n\s*const gpu = await getGpuMesh\(m\.modelId\);\n[^\n]*\n\s*const cpu = wodRockUvs\(cpuModels\.get\(m\.modelId\), m\.matrix, m\.modelId\);/);
  assert.equal(w.split('wodRockUvs(').length - 1, 1, 'the WoD pieces alone - never a town\'s models or the Hold\'s');
  const loop = w.slice(w.indexOf('for (const m of place.models) {'), w.indexOf('for (const f of place.flats) {'));
  assert.match(loop, /addStatic\(cpu, m\.matrix, false, m\.normalMatrix\);/);
  assert.match(loop, /late\.add\(key, cpu\.positions, cpu\.indices, m\.matrix, \{ translation: wodBucket \}\);/);   // PIN MOVED (ROCK-CLEAR): the pixel's solids through the world collider's gate (player/lateSolid.js; test/scenes/fb1019f_rockclear.test.js)
  // a pebble as dfMeshToModel makes one (every plane its own vertices) keeps its positions and indices BY REFERENCE:
  // the collider and the box take the model's own arrays, the batch alone a new UV array
  const cpu = pebble(), out = wodRockUvs(cpu, objectMatrix([0, 0, 0], ROT, SPIRE));
  assert.equal(out.positions, cpu.positions); assert.equal(out.indices, cpu.indices); assert.equal(out.normals, cpu.normals);
  assert.notEqual(out.uvs, cpu.uvs);
});

test('FB1001-WODROCK: the real spire - WOD_Mountain_01r1 object 7 (60716 at 398 x 1101 x 398) at its pebble\'s 74 texels a metre', { skip: skipReal }, async () => {
  const { Arch3dFile } = await import('../../../src/formats/arch3dFile.js');
  const { TextureFile } = await import('../../../src/formats/textureFile.js');
  const { dfMeshToModel } = await import('../../../src/world/meshReader.js');
  const { loadLocationPrefab } = await import('../../../src/world/worldOfDaggerfall/wodLocationData.js');
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const t = new TextureFile();
  t.load(new Uint8Array(readFileSync(join(ARENA2, 'TEXTURE.141'))), 'TEXTURE.141');
  const cpu = dfMeshToModel(arch.getMesh(arch.getRecordIndex(60716)), (a, r) => ({ width: t.getWidth(r), height: t.getHeight(r) }));
  const o = loadLocationPrefab(readFileSync(new URL('../../../vendor/world-of-daggerfall/LocationPrefab/WOD_Mountain_01r1.txt', import.meta.url), 'utf8')).obj.find((q) => q.objectID === 7);
  const M = objectMatrix([0, 0, 0], o.rot, o.scale);
  const W = t.getWidth(2);
  const median = (fs) => { const s = fs.map((f) => f.coarse * W).sort((a, b) => a - b); return s[s.length >> 1]; };
  const own = median(faces(cpu)), was = median(faces(cpu, M)), now = median(faces(wodRockUvs(cpu, M), M));
  near(own, 74.4, 2e-3, 'the pebble'); assert.ok(was < 0.11, `the spire was ${was} texels a metre`);
  near(now, own, 1e-3, 'the spire now');
});
