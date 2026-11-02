// DELVE II DLV3's END-TO-END PROBE'S EDITS STAND IN THE TREE (test/tooling/partyloot_probe.test.js's law): tools/delveOnlineProbe.mjs
// plays a Hold online through two probe-only seams beside the loot door - the encounters' host (`__delve`) and a foe's
// record (`__foeRecord`, scenes/dungeon.js's own) - and a probe is not in the suite, so a change that moved the needle or
// a door the seams read would be found by the next person to run it, an hour in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editsPlugin } from '../../tools/frameProbe.mjs';
import { DELVE_ONLINE_PROBE_EDITS } from '../../tools/delveOnlineProbe.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('DLV3 probe: its needle stands once in the file it names, and its plugin serves the encounters\' host and a foe\'s record beside the loot door', () => {
  assert.deepEqual(DELVE_ONLINE_PROBE_EDITS.map((r) => r.file), ['src/scenes/worldModes.js']);
  const code = src('src/scenes/worldModes.js');
  for (const [needle] of DELVE_ONLINE_PROBE_EDITS[0].edits) assert.equal(code.split(needle).length - 1, 1, `the needle stands once - ${needle.slice(0, 70)}`);
  const served = editsPlugin('delve-online-probe', DELVE_ONLINE_PROBE_EDITS).transform(code, '/repo/src/scenes/worldModes.js?v=1');
  assert.match(served, /window\.__takeLoot = \(k\) => \(dungeonCtx \? dungeonCtx\.takeLoot\(k\) : null\);\n {4}window\.__delve = \(\) => dungeonCtx\?\.delve\?\.\(\) \?\? null;\n {4}window\.__foeRecord = \(i\) => dungeonCtx\?\.foes\?\.\[i\] \?\? null;/);
});

test('DLV3 probe: the doors its seams read are where it reads them - the context\'s encounters\' host, the host\'s state, snapshot, press and contents, a wave foe\'s stamp', () => {
  assert.match(src('src/scenes/dungeonContext.js'), /\n {4}delve: \(\) => delve,/, 'the context\'s own door');
  const host = src('src/scenes/delve/delveHost.js');
  for (const door of ['state: () =>\n      runs.map(', 'snapshot: () => ({\n      h: hash,', 'press(key, mode = \'grab\') {', 'contents(key) {']) assert.ok(host.includes(door), door);
  const hold = src('src/scenes/delve/delveHold.js');
  assert.match(hold, /\n {4}f\._delve = stamp;/, 'a wave foe carries its stamp');
  assert.match(hold, /void standOne\(p, \{\}, \{ i: site\.i, g: myGen, w, cap: false \}\)/, 'and the stamp names its site');
});
