// PERF-ON4 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"; bible/07-Rendering/Performance-Online.md): THE PROBES' EDITS STAND IN THE TREE. tools/frameProbe.mjs and
// tools/onlineFrameProbe.mjs measure the real game through a few probe-only edits of its source (the stream's build
// slice, the grass's fill, the account base, `?shot` online, the composer's hook) - each a needle they replace. A probe
// is not in the suite (it needs a browser, the game's data and minutes), so a change that moved a needle was found by
// the next person to run it, an hour in. Here every needle is held to the file it names: present, and once.
// AUDIT PERF-ON4 (tooling lens, F4/F5): AND EACH EDIT DOES WHAT IT IS FOR - read off the edited source, through the very
// plugins each probe's server is built with: the online lane no longer refuses `?shot` (and refuses all else it did),
// the account base takes the local service and nothing else new, the hook reads the session and the way book where they
// stand. The files are named here so `npm run test:changed` picks this file for a change to any of them:
// src/systems/buildBreather.js, src/render/labGrass.js, src/net/accountClient.js, src/systems/onlineLane.js,
// src/scenes/world.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRAME_PROBE_EDITS, editsPlugin, probeTransforms } from '../tools/frameProbe.mjs';
import { ONLINE_PROBE_EDITS, probePlugins, crowdsOf } from '../tools/onlineFrameProbe.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const NEEDLE_FILES = ['src/systems/buildBreather.js', 'src/render/labGrass.js', 'src/net/accountClient.js', 'src/systems/onlineLane.js', 'src/scenes/world.js'];
/** A file as the online probe's page server serves it: every transform its server is built with, in order. */
const served = (file) => probePlugins().reduce((code, pl) => pl.transform(code, `/repo/${file}?v=1`) ?? code, src(file));

test('PERF-ON4: every probe edit\'s needle stands in its file, once - the frame probe\'s (the build slice, the grass fill) and the online probe\'s (the account base, `?shot` kept online, the composer\'s hook) - and the plugin makes each edit and refuses a file whose needle is gone or doubled, and a path that only contains the file\'s (mutants: a needle moved in the tree; the plugin passing a missed needle, or a doubled one; a path matched by containing)', () => {
  let n = 0;
  assert.deepEqual([...FRAME_PROBE_EDITS, ...ONLINE_PROBE_EDITS].map((r) => r.file), NEEDLE_FILES, 'the files the edits name');
  for (const row of [...FRAME_PROBE_EDITS, ...ONLINE_PROBE_EDITS]) {
    const code = src(row.file);
    for (const [needle, by] of row.edits) {
      assert.equal(code.split(needle).length - 1, 1, `${row.file}: the needle stands once - ${needle.slice(0, 70)}`);
      assert.notEqual(needle, by);
      n++;
    }
    const plugin = editsPlugin('t', [row]);
    const out = plugin.transform(code, `/x/${row.file}?v=1`);
    assert.notEqual(out, code, `${row.file}: edited`);
    for (const [, by] of row.edits) assert.ok(out.includes(by), `${row.file}: the edit is made (what it does: the next test)`);
    assert.throws(() => plugin.transform(code.replace(row.edits[0][0], ''), `/x/${row.file}`), /needle missed/, `${row.file}: a missed needle is refused`);
    assert.throws(() => plugin.transform(`${code}\n// ${row.edits[0][0]}`, `/x/${row.file}`), /needle found 2 times/, `${row.file}: a doubled needle is refused (AUDIT PERF-ON4 F7)`);
    assert.equal(plugin.transform(code, `/x/other${row.file}`), null, `${row.file}: a path that only contains it is another file`);
  }
  assert.equal(n, 6, 'six edits in all');
  assert.equal(editsPlugin('t', FRAME_PROBE_EDITS).transform('x', '/x/src/main.js'), null, 'a file no row names is left alone');
});

test('PERF-ON4 (AUDIT PERF-ON4 F4): EACH EDIT DOES WHAT IT IS FOR, as the probes\' own servers serve it - the frame probe\'s transform serves the build slice and the grass fill edited; the online probe\'s serves `?shot` unrefused online and every other refusal kept, an account base of the local service (a port on 127.0.0.1) taken beside https and nothing else new, and the hook reading the session\'s peers and status and the way book; the crowds read in order, a repeat named apart (mutants: the edit keeping `shot` refused; the base taking another host; the frame probe\'s transform skipping its own edits; the online server built without its edits; the hook without the way book)', () => {
  const frame = probeTransforms();
  for (const row of FRAME_PROBE_EDITS) {
    const out = frame.transform(src(row.file), `/repo/${row.file}`);
    for (const [, by] of row.edits) assert.ok(out?.includes(by), `the frame probe serves ${row.file} edited`);
  }
  // the online lane: `shot` unrefused, every other refusal as it stands
  const flags = (code) => Function(`return ${/export const ONLINE_REFUSED_FLAGS = (Object\.freeze\(\[[^\]]*\]\));/.exec(code)[1]}`)();
  const was = flags(src('src/systems/onlineLane.js')), now = flags(served('src/systems/onlineLane.js'));
  assert.ok(was.includes('shot'), 'the tree refuses `?shot` online');
  assert.deepEqual(now, was.filter((f) => f !== 'shot'), 'the probe\'s page refuses all else, and not `?shot`');
  // the account base
  const base = (code) => new RegExp(/\(typeof v === 'string' && \/(.+)\/\.test\(v\)\)/.exec(code)[1]);
  const tree = base(src('src/net/accountClient.js')), probe = base(served('src/net/accountClient.js'));
  for (const v of ['https://account.example', 'http://127.0.0.1:8870', 'http://example.com', 'http://127.0.0.2:8870', 'http://127.0.0.1', 'http://localhost:8870', 'https://a b']) {
    const want = tree.test(v) || /^http:\/\/127\.0\.0\.1:\d+$/.test(v);
    assert.equal(probe.test(v), want, `the probe's page takes ${v} as an account base: ${want}`);
  }
  // the hook: the session's peers and status, the way book's size - each name the world host declares before it
  const world = served('src/scenes/world.js');
  const hook = world.indexOf('window.__probeOnline = () => ({ peers: online ? online.drawable().length : null, status: online ? online.status : null, ways: livingWays.size');
  assert.ok(hook > 0, 'the hook is served');
  assert.ok(world.indexOf('const livingWays = createWayBook(') < hook && world.indexOf('let online = null') < hook, 'the way book and the session declared before it, in the host');
  assert.ok(world.includes('window.__probeSaveText = () =>'), 'and the composer\'s hook');
  // the crowds
  assert.deepEqual(crowdsOf(undefined).map((c) => [c.crowd, c.name]), [[0, 'online0'], [20, 'online20'], [60, 'online60'], [0, 'online0b']]);
  assert.deepEqual(crowdsOf('40,0').map((c) => c.crowd), [40, 0], 'in the order given');
  assert.throws(() => crowdsOf('x'), /PEERS is a list of crowd sizes/);
});
