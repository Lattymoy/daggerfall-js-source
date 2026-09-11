// PERF5 (2026-09-11). The dungeon's static models merged into one mesh
// for the main view - PERF4's batch, for the level: one call per
// resolved texture instead of one per sub-mesh per placed model, while
// the automap keeps walking the per-model list for its reveal. Text
// pins; the builder is executed by test/perf4.test.js. Every pin names
// its mutant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('PERF5 pins: the context adds each static placement to the builder after its remap, action objects never, uploads on the first read, keeps drawList whole for the automap, and frees the mesh in destroy (mutant: any one dropped)', () => {
  const c = read('src/scenes/dungeonContext.js');
  assert.match(c, /let staticBatch = null, staticBuilt = false;\n\s+const staticBuilder = new StaticBatchBuilder\(\);/);
  assert.match(c, /const texRemap = new Map\(\);\n\s+const resolveTexKey = keyResolver\(texRemap\);/, 'resolves through the level\'s remap');
  assert.match(c, /drawList\.push\(\{ mesh: gpu, matrix, key: `\$\{bi\}:\$\{p\.position\}`, aabb \}\);\n\s+\/\/ PERF5[^\n]*\n\s+if \(cpu\.normals && cpu\.uvs\) \{ staticBuilder\.add\(cpu, matrix, resolveTexKey\); drawList\[drawList\.length - 1\]\._batched = true; \}/, 'added beside the draw entry, which stays in drawList for the automap');
  const loop = c.slice(c.indexOf("if (cls === 'move') {"), c.indexOf('drawList.push({ mesh: gpu, matrix, key: `${bi}:${p.position}`, aabb });'));
  assert.ok(!loop.includes('staticBuilder.add'), 'the move and specialDoor arms `continue` before the add: an action object is never batched');
  assert.match(c, /get staticBatch\(\) \{[^\n]*\n\s+if \(!staticBuilt\) \{ staticBuilt = true; const m = staticBuilder\.finish\(\); staticBatch = m \? renderer\.createMesh\(m\) : null; \}/, 'merged once, on the first frame that asks');
  assert.match(c, /if \(staticBatch\) \{ renderer\.destroyMesh\(staticBatch\); staticBatch = null; \}/, 'freed with the level');
  assert.match(read('src/ui/automapWindow.js'), /for \(const d of this\.deps\.drawList\) push\(d\.mesh, d\.matrix, d\.key\);/, 'the automap still reveals per model');
});

test('PERF5 pins: both dungeon hosts draw the merge with the identity before the per-model loop and skip the batched entries; the dynamic draws follow as before (mutant: a host dropped, or the skip dropped)', () => {
  for (const [f, ctx] of [['src/scenes/dungeon.js', 'ctx'], ['src/scenes/worldModes.js', 'dungeonCtx']]) {
    const s = read(f);
    assert.match(s, /^const BATCH_IDENTITY = identity\(\);/m, `${f}: the merged level is in world space`);
    assert.match(s, new RegExp(`if \\(${ctx}\\.staticBatch\\) renderer\\.drawMesh\\(${ctx}\\.staticBatch, BATCH_IDENTITY, null\\);[^\\n]*\\n\\s+for \\(const d of ${ctx}\\.drawList\\) if \\(!d\\._batched\\) renderer\\.drawMesh\\(d\\.mesh, d\\.matrix, ${ctx}\\.texRemap\\);\\n\\s+for \\(const d of ${ctx}\\.dynamicDraws\\) renderer\\.drawMesh\\(d\\.gpu, d\\.object\\.matrix, ${ctx}\\.texRemap\\);`), `${f}: the merge, then the rest, then the movers`);
  }
});
