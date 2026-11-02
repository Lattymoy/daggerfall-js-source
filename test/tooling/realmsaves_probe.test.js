// tools/realmSavesProbe.mjs's seams are source edits Vite serves: each needle must stand once in the tree, or the probe
// stops at its first page instead of the suite failing here. Not the probe's run - that is a toolchain and an hour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REALM_SAVES_PROBE_EDITS } from '../../tools/realmSavesProbe.mjs';
import { ONLINE_PROBE_EDITS } from '../../tools/onlineFrameProbe.mjs';
import { editsPlugin } from '../../tools/frameProbe.mjs';

test('the realm saves probe: its needles stand once in world.js, after the online probe\'s own edit, and the served page carries its seams', () => {
  assert.deepEqual(REALM_SAVES_PROBE_EDITS.map((r) => r.file), ['src/scenes/world.js']);
  const code = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const online = ONLINE_PROBE_EDITS.find((r) => r.file === 'src/scenes/world.js');
  const before = editsPlugin('online-probe-transforms', [online]).transform(code, '/repo/src/scenes/world.js?v=1');
  for (const [needle] of REALM_SAVES_PROBE_EDITS[0].edits) assert.equal(before.split(needle).length - 1, 1, `the needle stands once - ${needle.slice(0, 70)}`);
  const served = editsPlugin('realm-saves-probe', REALM_SAVES_PROBE_EDITS).transform(before, '/repo/src/scenes/world.js?v=1');
  for (const seam of ['window.__onlineCheckpoint', 'window.__realmState', 'window.__rollRep', 'window.__heard', '[realm] lost: ']) assert.ok(served.includes(seam), seam);
});
