// PERF4 (2026-09-11, Mac: "look for opportunities"). A streamed pixel's
// static RMB models merged into one mesh per pixel, one draw call per
// resolved texture, instead of one call per sub-mesh per model. The
// builder EXECUTES; the world host is text-pinned. Every pin names its
// mutant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StaticBatchBuilder, keyResolver } from '../src/render/staticBatch.js';
import { trs } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;

/** a two-triangle model: one quad in two sub-meshes, textures (7,1) and (7,2) */
function model() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    subMeshes: [{ textureArchive: 7, textureRecord: 1, startIndex: 0, primitiveCount: 1 }, { textureArchive: 7, textureRecord: 2, startIndex: 3, primitiveCount: 1 }],
  };
}

test('PERF4 StaticBatchBuilder: vertices land transformed, normals rotated and unit, indices offset by each model\'s base, and every sub-mesh of every model that shares a texture becomes ONE run (mutant: base not added, normals translated, groups not merged)', () => {
  const sb = new StaticBatchBuilder();
  const resolve = keyResolver(new Map());
  sb.add(model(), trs(10, 0, 0, 0, 0, 0), resolve);            // moved +10 x
  sb.add(model(), trs(0, 0, 5, 0, 90, 0), resolve);            // turned 90 about y, moved +5 z
  const m = sb.finish();
  assert.equal(m.vertexCount, 8); assert.equal(m.triangles, 4); assert.equal(m.models, 2);
  assert.ok(near(m.positions[0], 10) && near(m.positions[3], 11), 'the first model is at +10 x');
  // the second model's (1,0,0) turned 90 about y lands on the z axis (either sign is a handedness of trs, both unit)
  const px = m.positions[4 * 3 + 3], pz = m.positions[4 * 3 + 5];
  assert.ok(near(px, 0) && near(Math.abs(pz - 5), 1), `turned: (${px}, ${pz})`);
  assert.ok(near(m.normals[0], 0) && near(m.normals[2], 1), 'the first model\'s normal is untouched by a translation');
  const nx = m.normals[4 * 3], nz = m.normals[4 * 3 + 2];
  assert.ok(near(Math.abs(nx), 1) && near(nz, 0), `the second model's normal turned with it and stayed unit: (${nx}, ${nz})`);
  assert.equal(m.uvs.length, 16);
  // two textures -> two sub-meshes, each holding one triangle from EACH model
  assert.equal(m.subMeshes.length, 2);
  assert.deepEqual(m.subMeshes.map((s) => [s.textureArchive, s.textureRecord, s.primitiveCount]), [[7, 1, 2], [7, 2, 2]]);
  const first = Array.from(m.indices.slice(m.subMeshes[0].startIndex, m.subMeshes[0].startIndex + 6));
  assert.deepEqual(first, [0, 1, 2, 4, 5, 6], 'the second model\'s triangle is offset by the first\'s four vertices');
  const second = Array.from(m.indices.slice(m.subMeshes[1].startIndex, m.subMeshes[1].startIndex + 6));
  assert.deepEqual(second, [0, 2, 3, 4, 6, 7]);
  assert.equal(new StaticBatchBuilder().finish(), null, 'nothing added, no mesh');
});

test('PERF4 keyResolver: the pixel\'s remap is applied exactly as drawMesh applies it, and a remapped texture groups under the swapped archive (mutant: the remap ignored)', () => {
  const remap = new Map([['7_1', '107_1']]);
  const resolve = keyResolver(remap);
  assert.equal(resolve(7, 1), '107_1'); assert.equal(resolve(7, 2), '7_2');
  const sb = new StaticBatchBuilder();
  sb.add(model(), trs(0, 0, 0, 0, 0, 0), resolve);
  const m = sb.finish();
  assert.deepEqual(m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`), ['107_1', '7_2'], 'drawMesh will look these up with no remap and find the swapped upload');
});

test('PERF4 pins: the world host merges each placed model as it arrives (gates stay out), uploads the merge once, draws it with the pixel matrix before the per-model loop, skips the batched models there, and frees it with the pixel (mutant: any one dropped)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const staticBuilder = new StaticBatchBuilder\(\);\n\s+const resolveTexKey = keyResolver\(texRemap\);/, 'one builder per pixel build, resolving through the pixel\'s remap');
  assert.match(w, /models\.push\(entry\);\n\s+if \(!isCityGate\(placed\.modelIdNum\) && cpu\.normals && cpu\.uvs\) \{ staticBuilder\.add\(cpu, local, resolveTexKey\); entry\._batched = true; \}/, 'added right after the entry, after the remap was awaited; gates excluded');
  assert.match(w, /const staticMerged = staticBuilder\.finish\(\);[^\n]*\n\s+const staticBatch = staticMerged \? renderer\.createMesh\(staticMerged\) : null;/, 'uploaded once at the end');
  assert.match(w, /built\.set\(key, \{\n\s+staticBatch,/, 'kept on the pixel');
  assert.match(w, /if \(p\.staticBatch\) renderer\.drawMesh\(p\.staticBatch, pixelMatrix, null\);[^\n]*\n\s+for \(const m of p\.models\) \{\n\s+if \(m\._batched\) continue;/, 'drawn once, then the individual models minus the batched');
  assert.match(w, /if \(p\.staticBatch\) \{ renderer\.destroyMesh\(p\.staticBatch\); p\.staticBatch = null; \}/, 'freed in destroyPixel');
  const mills = w.indexOf("models.push({ gpu: parts.body, local, _box: box, _order: -1 });");
  assert.ok(mills > 0 && !w.slice(mills, mills + 200).includes('staticBuilder.add'), 'the mills are not batched: their rotor turns');
});
