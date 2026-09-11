// PERF6 (2026-09-11). PERF5's batch for the building INTERIOR: the room's
// static placements merged into one mesh for the main view, doors and
// machinery drawn as before, the automap walking the whole list. Text
// pins; the builder is executed by test/perf4.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('PERF6 pins: the interior context remaps every model before the list, adds each placement beside its entry, uploads on the first read, frees in destroy; the host draws the merge before the loop and skips the batched entries, doors and rotors as before (mutant: any one dropped)', () => {
  const c = read('src/scenes/interiorContext.js');
  const remapAt = c.indexOf('await remapSubMeshes(cpuModels.get(id)?.subMeshes, texRemap, climateArchive, deps);');
  const listAt = c.indexOf('const drawList = [];');
  assert.ok(remapAt > 0 && remapAt < listAt, 'every model\'s remap is awaited before the list is built, so the keys resolve as drawMesh\'s do');
  assert.match(c, /const texRemap = new Map\(\);\n\s+const resolveTexKey = keyResolver\(texRemap\);/);
  assert.match(c, /let staticBatch = null, staticBuilt = false;\n\s+const staticBuilder = new StaticBatchBuilder\(\);/);
  assert.match(c, /drawList\.push\(\{ mesh: gpu, matrix, key, aabb \}\);\n\s+\/\/ PERF6[^\n]*\n\s+if \(cpu\.normals && cpu\.uvs\) \{ staticBuilder\.add\(cpu, matrix, resolveTexKey\); drawList\[drawList\.length - 1\]\._batched = true; \}/);
  assert.match(c, /get staticBatch\(\) \{[^\n]*\n\s+if \(!staticBuilt\) \{ staticBuilt = true; const m = staticBuilder\.finish\(\); staticBatch = m \? renderer\.createMesh\(m\) : null; \}/);
  assert.match(c, /if \(staticBatch\) \{ renderer\.destroyMesh\(staticBatch\); staticBatch = null; \}/);
  assert.match(c, /dynamicDraws\.push\(\{ gpu, object: actions\.addDoor\(cpu, parent\(d\.matrix\)\) \}\);/, 'the doors stay dynamic');
  const w = read('src/scenes/worldModes.js');
  assert.match(w, /if \(interiorCtx\.staticBatch\) renderer\.drawMesh\(interiorCtx\.staticBatch, BATCH_IDENTITY, null\);[^\n]*\n\s+for \(const d of interiorCtx\.drawList\) if \(!d\._batched\) renderer\.drawMesh\(d\.mesh, d\.matrix, interiorCtx\.texRemap\);/);
  assert.match(w, /for \(const r of interiorCtx\.rotors\) \{/, 'the machinery turns as before');
  assert.match(w, /for \(const d of interiorCtx\.dynamicDraws\) renderer\.drawMesh\(d\.gpu, d\.object\.matrix, interiorCtx\.texRemap\);/, 'the doors draw as before');
});
