// WOD5 - WORLD OF DAGGERFALL: WHAT THE AUDIT FOUND.
//
// An independent pass read the port against the eight C# sources and
// found four behaviours the port did not yet share: the mirrored wall
// drawn inside out, a region visited between two builds going unheard,
// a captive vanishing on a rebuild the reference never makes, and the
// marker's loot pile riding a save that DFU never writes. Each is
// pinned here as it now stands, the first two by behaviour.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StaticBatchBuilder } from '../src/render/staticBatch.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { objectMatrix, objectNormalMatrix } from '../src/world/wodLocationObjects.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** One triangle facing +z, and the key the batch groups it under. */
const tri = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array(6),
  indices: new Uint32Array([0, 1, 2]),
  subMeshes: [{ textureArchive: 1, textureRecord: 2, startIndex: 0, primitiveCount: 1 }],
});
const key = () => '1_2';

test('WOD5: a mirrored model keeps its faces - a negative determinant reverses the winding, as Unity reverses the culling', () => {
  const rot = { x: 0, y: 0, z: 0, w: 1 };
  const plain = new StaticBatchBuilder();
  plain.add(tri(), objectMatrix([0, 0, 0], rot, { x: 2, y: 1, z: 1 }), key);
  assert.deepEqual([...plain.finish().indices], [0, 1, 2], 'a positive scale leaves the order alone');
  const mirrorScale = { x: -1.573463, y: 1, z: 1 };   // WOD_BanditCamp_09's wall (58055)
  const mirror = new StaticBatchBuilder();
  mirror.add(tri(), objectMatrix([0, 0, 0], rot, mirrorScale), key, objectNormalMatrix(rot, mirrorScale));
  const out = mirror.finish();
  assert.deepEqual([...out.indices], [0, 2, 1], 'the last two corners swap');
  // the mirrored triangle's corners, in the new order, wind the way the
  // unmirrored one does seen from its normal - so the cull keeps it
  const p = out.positions, i = out.indices;
  const v = (k) => [p[i[k] * 3], p[i[k] * 3 + 1], p[i[k] * 3 + 2]];
  const [a, b, c] = [v(0), v(1), v(2)];
  const cross = (u, w) => [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const face = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
  assert.ok(face[2] * out.normals[2] > 0, 'the wound face and the transformed normal agree');
  // the camp's own wall is turned as well as mirrored (rotY -1: half a turn); a turn never changes the sign
  for (const turn of [{ x: 0, y: -1, z: 0, w: 2.294779e-6 }, { x: 0.2, y: 0.5, z: -0.3, w: 0.787 }, { x: 0.5, y: 0, z: 0, w: 0.8660254 }]) {   // the last, 60 degrees about x, is where a cofactor's sign would show
    const m = new StaticBatchBuilder();
    m.add(tri(), objectMatrix([0, 0, 0], turn, mirrorScale), key, objectNormalMatrix(turn, mirrorScale));
    assert.deepEqual([...m.finish().indices], [0, 2, 1], 'turned and mirrored, still reversed');
    const t = new StaticBatchBuilder();
    t.add(tri(), objectMatrix([0, 0, 0], turn, { x: 1.5, y: 1, z: 1 }), key);
    assert.deepEqual([...t.finish().indices], [0, 1, 2], 'turned alone, left as it was');
  }
  assert.match(rd('vendor/world-of-daggerfall/LocationPrefab/WOD_BanditCamp_09.txt'), /<name>58055<\/name>[\s\S]{0,80}<scaleX>-1\.573463<\/scaleX>/, 'the one negative scale in the shipped layouts');
});

test('WOD5: the loader hears a region on the crossing itself, after Awake - a visit shorter than a build is still announced', () => {
  const w = rd('src/scenes/world.js');
  const crossing = w.slice(w.indexOf('    if (r.pixelChanged) {'), w.indexOf('      for (const u of r.unload) {'));
  assert.match(crossing, /if \(wod\) \{ const region = maps\.getRegionIndexAt\(r\.current\.x, r\.current\.y\); wodOpened\.then\(\(ok\) => \{ if \(ok\) wod\.noteRegion\(region\); \}\); \}/);
  assert.match(w, /wod\.noteRegion\(maps\.getRegionIndexAt\(here\.x, here\.y\)\);\s*await wod\.settle\(\);/, 'and still before every build, where the list is read');
});

test('WOD5: a captive stood by a marker rides the carry and stands again on the rebuilt pixel', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /w\.flat = \{ kind: 'billboard', archive: act\.archive, record: act\.record \};\n\s*getTexture\(act\.archive\)\.then/, 'the stood flat is remembered before its art loads');
  assert.match(w, /spawners\.get\(k\)\.push\(\{ spawner: w\.spawner, flat: w\.flat \?\? null \}\);/, 'the carry takes it');
  assert.match(w, /if \(w\.restand\) \{ w\.restand = false; standWodAction\(p, w, w\.flat\); \}[^\n]*\n\s*if \(!w\.spawner\.active\) continue;/, 'before the spent marker is skipped');
});

test('WOD5: the marker\'s pile is a LoadID-0 container - no save and no scene cache carries it', async () => {
  const renderer = { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, destroyBatch: () => {} };
  const getTexture = async () => ({ recordCount: 64, getFrameCount: () => 1, getSize: () => ({ width: 32, height: 32 }), getScale: () => ({ width: 0, height: 0 }) });
  const pool = createDroppedLoot({ renderer, getTexture, uploadRecordFrame: () => {} });
  const item = { templateIndex: 1, itemGroup: 1, name: 'x' };
  pool.seedPile([item], [0, 0, 0], { archive: 216, record: 3 }, null, '1,1', { unsaved: true });
  pool.seedPile([item], [1, 0, 0], { archive: 216, record: 4 }, null, '1,1');
  const saved = pool.snapshotWorld((p) => ({ x: p[0], z: p[2] }));
  assert.deepEqual(saved.map((s) => s.record), [4], 'the WoD pile stays out; an ordinary pile rides as before');
  assert.equal(pool._piles.length, 2, 'both stand in the world meanwhile');
  const src = rd('vendor/world-of-daggerfall/Scripts/LocationEnemySpawner.cs');
  assert.match(src, /\/\/loot\.LoadID = \(\(ulong\)locationID \* 10000\) \+ \(ulong\)objID;/, 'the C# comments the LoadID out');
});
