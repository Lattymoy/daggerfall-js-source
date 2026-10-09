// PERF-ON4 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"; bible/07-Rendering/Performance-Online.md): THE PROBES' EDITS STAND IN THE TREE. tools/frameProbe.mjs and
// tools/onlineFrameProbe.mjs measure the real game through a few probe-only edits of its source (the stream's build
// slice, the grass's fill, the account base, `?shot` online, the composer's hook) - each a needle they replace. A probe
// is not in the suite (it needs a browser, the game's data and minutes), so a change that moved a needle was found by
// the next person to run it, an hour in. Here every needle is held to the file it names: present, and once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRAME_PROBE_EDITS, editsPlugin } from '../tools/frameProbe.mjs';
import { ONLINE_PROBE_EDITS } from '../tools/onlineFrameProbe.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PERF-ON4: every probe edit\'s needle stands in its file, once - the frame probe\'s (the build slice, the grass fill) and the online probe\'s (the account base, `?shot` kept online, the composer\'s hook) - and the plugin makes each edit and refuses a file whose needle is gone (mutants: a needle moved in the tree; the plugin passing a missed needle)', () => {
  let n = 0;
  for (const row of [...FRAME_PROBE_EDITS, ...ONLINE_PROBE_EDITS]) {
    const code = src(row.file);
    for (const [needle, by] of row.edits) {
      assert.equal(code.split(needle).length - 1, 1, `${row.file}: the needle stands once - ${needle.slice(0, 70)}`);
      assert.notEqual(needle, by);
      n++;
    }
    const plugin = editsPlugin('t', [row]);
    const out = plugin.transform(code, `/x/${row.file}?v=1`);
    for (const [, by] of row.edits) assert.ok(out.includes(by), `${row.file}: the edit is made`);
    assert.throws(() => plugin.transform(code.replace(row.edits[0][0], ''), `/x/${row.file}`), /needle missed/, `${row.file}: a missed needle is refused`);
  }
  assert.equal(n, 6, 'six edits in all');
  assert.equal(editsPlugin('t', FRAME_PROBE_EDITS).transform('x', '/x/src/main.js'), null, 'a file no row names is left alone');
});
