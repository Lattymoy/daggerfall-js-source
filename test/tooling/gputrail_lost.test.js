// GPU-TRAIL-LOST (2026-10-25, app/lib/rendererGone.cjs createGpuGoneWait): the GPU process's own crash.log entry carries
// the page's lost sample. In the desktop app's crash run (2026-10-25) the GPU's entry was written the moment
// child-process-gone fired, before the page's lost-context sample crossed the bridge, so only a later renderer stop's
// entry showed it. The hold is driven by execution with a fake clock; the shell's wiring is pinned in
// gputrail_crashlog.test.js. The restored flag's line is here too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gpuSample } from '../../src/render/gpuTrail.js';

const require = createRequire(import.meta.url);
const G = require('../../app/lib/rendererGone.cjs');

const AT = Date.UTC(2026, 9, 25, 22, 42, 58);
const LIVE = { textures: 1701, buffers: 3377, vaos: 990, framebuffers: 168, programs: 114 };
const FRAME = { fps: 120, meanMs: 8.3, worstMs: 9, draws: 342, binds: 334, viewDraws: 0, shadowDraws: 208, hitch: null };

/** A fake clock: `setTimeout` holds its callback until `run()`. */
function fakeTimers() {
  const due = new Map();
  let ids = 0;
  return {
    setTimeout(fn, ms) { due.set(++ids, { fn, ms }); return ids; },
    clearTimeout(id) { due.delete(id); },
    waits: () => [...due.values()].map((d) => d.ms),
    run() { const all = [...due.values()]; due.clear(); for (const d of all) d.fn(); },
  };
}

/** A shell's crash.log and its kept trail, as main.cjs keeps them: `write` is logGone's GPU arm. */
function shell() {
  const timers = fakeTimers();
  const state = { log: '', trail: null };
  const write = (details, at) => { state.log = G.logWith(state.log, G.goneLine('gpu', details, at) + G.trailLines(state.trail)); };
  const wait = G.createGpuGoneWait({ write, timers });
  const hand = (samples) => { state.trail = G.trailFrom({ gpu: 'ANGLE (AMD, Radeon RX 7800 XT)', samples }); wait.heard(state.trail); };
  return { timers, state, wait, hand };
}

const sample = (at, extra = {}) => gpuSample({ at, upMs: 226_000, live: LIVE, frame: FRAME, heap: 1368 * 1048576, hidden: false, lost: false, ...extra });
const GPU = { reason: 'crashed', exitCode: -1073741819, type: 'GPU' };

test('GPU-TRAIL-LOST the GPU\'s entry waits for the page\'s lost sample and carries it, under the time the GPU died (mutants: written at once; written at the sample\'s time; the lost sample not awaited)', () => {
  const { timers, state, wait, hand } = shell();
  hand([sample(AT - 30_000)]);
  wait.gone(GPU, AT);
  assert.equal(state.log, '', 'nothing written before the page has said its last');
  assert.deepEqual(timers.waits(), [G.GPU_GONE_WAIT_MS]);
  hand([sample(AT - 30_000), sample(AT + 3, { lost: true })]);
  const lines = state.log.split('\n');
  assert.equal(lines[0], '2026-10-25T22:42:58.000Z gpu crashed exitCode=-1073741819 type=GPU');
  assert.match(lines.at(-2), /^ {2}2026-10-25T22:42:58\.003Z .* lost$/, 'the entry ends on the lost sample');
  assert.deepEqual(timers.waits(), [], 'written once: the wait let go');
  timers.run();
  hand([sample(AT + 4, { lost: true })]);
  assert.equal(state.log.match(/ gpu crashed /g).length, 1, 'never written twice');
});

test('GPU-TRAIL-LOST a page that never says it was lost still gets its entry, after GPU_GONE_WAIT_MS; a renderer stop or a quit writes a held one first (mutants: the wait never ends; flush ignored; a second GPU death drops the first)', () => {
  assert.equal(G.GPU_GONE_WAIT_MS, 2_000);
  const quiet = shell();
  quiet.hand([sample(AT - 30_000)]);
  quiet.wait.gone(GPU, AT);
  quiet.hand([sample(AT - 30_000), sample(AT + 500)]);
  assert.equal(quiet.state.log, '', 'a sample that is not lost does not end the wait');
  quiet.timers.run();
  assert.match(quiet.state.log, /^2026-10-25T22:42:58\.000Z gpu crashed [^\n]*\n {2}gpu ANGLE/);

  const stop = shell();
  stop.wait.gone(GPU, AT);
  stop.wait.flush();
  assert.match(stop.state.log, / gpu crashed /, 'flushed: written at once');
  stop.wait.flush();
  stop.timers.run();
  assert.equal(stop.state.log.match(/ gpu crashed /g).length, 1);

  const twice = shell();
  twice.wait.gone(GPU, AT);
  twice.wait.gone({ ...GPU, exitCode: 5 }, AT + 1000);
  assert.equal(twice.state.log.match(/ gpu crashed /g).length, 1, 'the first death written when the second came');
  twice.timers.run();
  assert.deepEqual(twice.state.log.match(/exitCode=-?\d+/g), ['exitCode=-1073741819', 'exitCode=5']);
});

test('GPU-TRAIL-LOST the sample taken as the context comes back is written `restored`; a minute with no hitch is hitch=0, and "-" is kept for no second at all (mutants: the restored flag not kept; not written; hitch=- for a minute without one)', () => {
  const back = sample(AT + 1007, { restored: true });
  assert.equal(back.restored, true);
  assert.equal(back.hitchMs, 0, 'the counter kept no hitch: a number it has');
  const none = gpuSample({ at: AT, upMs: 0, live: LIVE, frame: null, heap: null, hidden: false, lost: false });
  assert.deepEqual([none.hitchMs, none.restored], [null, false]);
  const trail = G.trailFrom({ gpu: 'x', samples: [sample(AT + 3, { lost: true }), back, none, { ...back, restored: 'yes' }] });
  assert.deepEqual(trail.samples.map((s) => s.restored), [false, true, false, false], 'a flag is kept only when it is true');
  const lines = G.trailLines(trail).split('\n');
  assert.match(lines[1], / hitch=0 [^\n]* lost$/);
  assert.match(lines[2], / hitch=0 [^\n]* restored$/);
  assert.match(lines[3], / fps=- [^\n]* hitch=- /, 'no second: every frame number is "-"');
  assert.doesNotMatch(lines[3], /restored|lost/);
});
