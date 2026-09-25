// PERF-EXT24 (2026-09-25, the players: "fps issues in the exterior but
// fine in the interior", "me too my friend.. don't know why. I got a
// RX6600") - THE BUILD SLICE IS WHAT THE FRAME LEFT. The stream's breather
// resumes inside its own animation-frame callback, in the same rendering
// opportunity as the frame, so a flat 6 ms slice sat on top of a frame that
// had already spent its budget: every streaming frame over ~8.7 ms of
// script missed vsync. And the slice ran after the frame's clock closed,
// so no meter ever saw it. EXECUTES on injected clocks; the host is pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as BB from '../src/systems/buildBreather.js';
import * as FC from '../src/systems/frameClock.js';
import { PerfMeter } from '../src/render/perfMeter.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');

test('PERF-EXT24: frameFitBudget lends the frame interval less its own script less the margin, 3 to 6 ms - and the whole 6 to a stream two seconds old, an awaited build, or a NaN', () => {
  assert.equal(typeof BB.frameFitBudget, 'function');
  const f = BB.frameFitBudget;
  assert.equal(BB.BUILD_SLICE_FLOOR_MS, 3, 'the prover\'s floor');
  assert.equal(BB.BUILD_SLICE_MARGIN_MS, 2.5);
  assert.equal(BB.BUILD_STREAM_AGE_MS, 2000);
  assert.equal(f({ intervalMs: 16.7, busyMs: 4 }), 6, 'a light frame lends the whole slice, as before');
  assert.ok(Math.abs(f({ intervalMs: 16.7, busyMs: 10 }) - 4.2) < 1e-9, 'a 10 ms frame lends what it left: 16.7 - 10 - 2.5');
  assert.equal(f({ intervalMs: 16.7, busyMs: 14 }), 3, 'a heavy frame lends the floor');
  assert.equal(f({ intervalMs: 6.9, busyMs: 3 }), 3, 'a 144 Hz display is measured, not assumed');
  assert.ok(Math.abs(f({ intervalMs: 33.3, busyMs: 26 }) - 4.8) < 1e-9, 'and a 30 Hz one');
  assert.equal(f({ intervalMs: 16.7, busyMs: 14, streamingMs: 2001 }), 6, 'a stream past its age gets the whole slice back');
  assert.equal(f({ intervalMs: 16.7, busyMs: 14, streamingMs: 1999 }), 3, 'and not before');
  assert.equal(f({ intervalMs: 16.7, busyMs: 14, awaited: true }), 6, 'a build something awaits lends the whole slice');
  assert.equal(f({ intervalMs: NaN, busyMs: 4 }), 6, 'a NaN in is the old slice out');
});

test('PERF-EXT24: the breather asks the budget once a slice, yields when it is spent and not before, and tells onSlice what a resumed slice took', async () => {
  let t = 0, asked = 0, budget = 3;
  const frames = [], slices = [];
  const b = BB.createBreather({ now: () => t, raf: (fn) => { frames.push(fn); }, budget: () => { asked++; return budget; }, onSlice: (ms) => slices.push(ms) });
  assert.equal(asked, 1, 'asked as the first slice begins');
  t = 2.9; b.breathe(); await Promise.resolve();
  assert.equal(frames.length, 0, 'inside a 3 ms slice: no frame');
  t = 3.1; const p = b.breathe(); await Promise.resolve(); await Promise.resolve();
  assert.equal(frames.length, 1, 'the 3 ms spent: a frame is asked for');
  assert.deepEqual(slices, [], 'but a slice the breather\'s birth began is not its to vouch for (PERF-EXT24\'s review) - it yields, unheard');
  budget = 6; t = 20; frames[0](); await p;
  assert.equal(asked, 2, 'asked again as the next slice begins, not at every breath');
  t = 25.9; b.breathe(); await Promise.resolve();
  assert.equal(frames.length, 1, 'a 6 ms slice does not yield at 5.9');
  t = 26.1; b.breathe(); await Promise.resolve(); await Promise.resolve();
  assert.equal(frames.length, 2, 'and does at 6.1');
  assert.equal(slices.length, 1);
  assert.ok(Math.abs(slices[0] - 6.1) < 1e-9, `the slice a resume began is reported (${slices})`);
  assert.equal(asked, 2);
  // a reset asks for a fresh slice's budget
  budget = 3; t = 100; b.reset();
  assert.equal(asked, 3);
  // without a budget the slice is sliceMs, as PERF7 made it
  let t2 = 0; const f2 = [];
  const plain = BB.createBreather({ now: () => t2, raf: (fn) => { f2.push(fn); } });
  t2 = 5.9; plain.breathe(); await Promise.resolve();
  assert.equal(f2.length, 0);
  t2 = 6.1; plain.breathe(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f2.length, 1);
});

test('PERF-EXT24: the frame clock measures the display\'s period, the frame\'s own script, and folds a lent slice into the next sample', () => {
  FC._resetFrameClock();
  assert.ok(Math.abs(FC.frameInterval() - 1000 / 60) < 1e-9, '60 Hz until two frames have begun');
  // a 144 Hz display with one hitch: the median ignores it
  let t = 1000;
  for (const d of [6.9, 6.9, 6.9, 40, 6.9, 7.0, 6.9]) { FC.frameBegin(t); FC.frameEnd(t + 2); t += d; }
  assert.ok(Math.abs(FC.frameInterval() - 6.9) < 1e-9, `the median interval (${FC.frameInterval()})`);
  FC._resetFrameClock();
  FC.frameBegin(0); FC.frameEnd(10);
  assert.equal(FC.lastBusy(), 10);
  FC.lendFrame(3);
  FC.frameBegin(16.7); FC.frameEnd(26.7);
  assert.equal(FC.lastBusy(), 10, 'the frame\'s own script, the lent slice excluded - it sizes the next slice');
  const cpu = FC.frameCpu();
  assert.equal(cpu.frames, 2);
  assert.ok(Math.abs(cpu.meanMs - 11.5) < 1e-9 && cpu.worstMs === 13, `the lent 3 ms is in the second sample (${cpu.meanMs}, ${cpu.worstMs})`);
  FC.lendFrame(-5); FC.frameBegin(33.4); FC.frameEnd(43.4);
  assert.equal(FC.frameCpu().worstMs, 13, 'nothing negative is lent');
  assert.ok(Math.abs(FC.frameCpu().meanMs - 11) < 1e-9, `a slice is lent to ONE sample - the third is its own 10 ms (${FC.frameCpu().meanMs})`);
  FC._resetFrameClock();
});

test('PERF-EXT24: `?perf=cpu` carries the stream as a `build` span; the GPU clocks never hear of it', () => {
  const gl = { getExtension: () => null };
  const m = new PerfMeter(gl, false, true);
  m.markCpu('world');
  m.addCpu('build', 4.5); m.addCpu('build', 1.5); m.addCpu('build', 0);
  assert.equal(m.cpuZones.get('build'), 6);
  const g = new PerfMeter(gl, true, false);
  g.addCpu('build', 4);
  assert.equal(g.cpuZones.size, 0, 'a GPU meter keeps no CPU buckets');
});

test('PERF-EXT24: the world host sizes the stream\'s slice by the frame clock, lends each slice back, and lends an awaited build the whole slice', () => {
  assert.match(WORLD, /  const breather = createBreather\(\{   \/\/ PERF7[^\n]*\n    budget: \(\) => frameFitBudget\(\{ intervalMs: frameInterval\(\), busyMs: lastBusy\(\), streamingMs: _streamSince == null \? 0 : performance\.now\(\) - _streamSince, awaited: _awaitedBuilds > 0 \}\),\n    onSlice: \(ms\) => \{ lendFrame\(ms\); meterFor\(renderer\.gl\)\?\.addCpu\('build', ms\); \},\n    frames: framesBegun,[^\n]*\n  \}\);/);
  const pump = WORLD.slice(WORLD.indexOf('  async function pump() {'), WORLD.indexOf('\n  }\n', WORLD.indexOf('  async function pump() {')));
  assert.match(pump, /const next = queue\.shift\(\);\n    _streamSince \?\?= performance\.now\(\);/, 'the pump\'s builds are the stream');
  assert.match(pump, /building = false;\n    if \(!queue\.length\) _streamSince = null;/, 'and the stream ends with the queue');
  assert.equal((WORLD.match(/(?<!let )_streamSince = /g) || []).length, 2, 'only the pump and a teleport\'s sweep end a stream');
});

// PERF-EXT24 (the review, 2026-09-25). The slice clock is wall time, and a
// build awaits more than the breather: its first slice began at reset()
// inside the pump's frame and ran on across the terrain worker's round
// trip, and whole frames went by in it. Lending that told the counter a
// pixel's 1 ms was 38 ms of script. The reviewer's repro, wired as world.js
// wires it (onSlice -> lendFrame, frames -> framesBegun), on the REAL frame
// clock and breather.
test('PERF-EXT24 (the review): only a slice the breather can vouch for is lent - never one a reset began, never one a frame ran inside; a resumed slice no frame entered is lent whole', async () => {
  FC._resetFrameClock();
  let t = 0;
  const rafQ = [], lent = [];
  const b = BB.createBreather({
    now: () => t, raf: (fn) => { rafQ.push(fn); },
    budget: () => BB.frameFitBudget({ intervalMs: FC.frameInterval(), busyMs: FC.lastBusy(), streamingMs: 0, awaited: false }),
    onSlice: (ms) => { lent.push(ms); FC.lendFrame(ms); },
    frames: FC.framesBegun,   // the frame clock's count of frames begun
  });
  const frame = (start, busy, inside) => { FC.frameBegin(start); t = start; inside?.(); t = start + busy; FC.frameEnd(t); };
  let reply;
  const job = new Promise((r) => { reply = r; });
  let built = null;
  // frame 0: the pump starts a build - reset, then the worker job
  frame(0, 10, () => { t = 8; b.reset(); built = (async () => { await job; t += 1; await b.breathe(); t += 5.5; await b.breathe(); })(); });
  frame(16.7, 10); frame(33.3, 10);
  t = 45; reply(); await new Promise((r) => setImmediate(r));
  assert.equal(b.yields, 1, 'the reset\'s slice still yields at its first breath - the stream\'s pace is as it was');
  assert.deepEqual(lent, [], 'and lends none of its 38 ms: one was the build\'s');
  frame(50, 10);
  let cpu = FC.frameCpu();
  assert.equal(cpu.worstMs, 10, `no frame reads the wait as script (worst ${cpu.worstMs})`);
  // the next frame, then the breather's own resume in the same opportunity: 5.5 ms of work, one slice
  frame(66.7, 10);
  t = 76.8; for (const fn of rafQ.splice(0)) fn(); await new Promise((r) => setImmediate(r));
  assert.equal(b.yields, 2);
  assert.equal(lent.length, 1);
  assert.ok(Math.abs(lent[0] - 5.5) < 1e-9, `a resumed slice no frame entered is lent whole (${lent})`);
  frame(83.4, 10);
  cpu = FC.frameCpu();
  assert.ok(Math.abs(cpu.worstMs - 15.5) < 1e-9, `the next sample holds it (${cpu.worstMs})`);
  for (const fn of rafQ.splice(0)) fn();   // the breather resumes after that frame, in its opportunity, and the build ends
  await built;
  // a resumed slice that a frame ran inside: a cold fetch across a vsync
  let fetched;
  const fetch = new Promise((r) => { fetched = r; });
  const cold = (async () => { t += 1; await fetch; t += 2; await b.breathe(); })();
  await new Promise((r) => setImmediate(r));
  frame(100, 10);
  t = 112; fetched(); await new Promise((r) => setImmediate(r));
  assert.equal(b.yields, 3, 'it yields as it always did');
  assert.equal(lent.length, 1, `and is not lent: the frame between is in its own sample, and the rest was a wait (${lent})`);
  for (const fn of rafQ.splice(0)) fn();
  await cold;
  // a build with no worker to wait on: reset inside the pump's frame, its
  // work run on after the frame closed, breathing before the next begins.
  // No frame entered it, and still its head is in that frame's own sample.
  let sync = null;
  frame(120, 10, () => { t = 125; b.reset(); sync = (async () => { await null; t += 7; await b.breathe(); })(); });
  await new Promise((r) => setImmediate(r));
  assert.equal(b.yields, 4, 'it yields');
  assert.equal(lent.length, 1, `and a slice a reset began is never lent (${lent})`);
  for (const fn of rafQ.splice(0)) fn();
  await sync;
  assert.equal(typeof FC.framesBegun, 'function', 'the frame clock counts the frames begun');
  FC._resetFrameClock();
});

// PERF-EXT24 (the review, 2026-09-25): the awaited arm was inferred from an
// idle pump, and a teleport's build is never alone - the frame loop pumps on
// while it is awaited, the new ring's first pixel starts, and the arrival's
// slices were sized for the stream. The world host's own `awaitedBuild` and
// budget, lifted out and run: a stream begun beside a teleport, at 144 Hz.
test('PERF-EXT24 (the review): a build something waits on says so - the boot and a teleport build through awaitedBuild, and while one is in flight every slice has the whole 6 ms, the stream beside it or not', async () => {
  const at = WORLD.indexOf('  async function awaitedBuild(px, py) {');
  assert.ok(at > 0, 'the host has one door for an awaited build');
  const helper = WORLD.slice(at, WORLD.indexOf('\n  }\n', at) + 4);
  const budgetSrc = /    budget: (\(\) => frameFitBudget\(\{[^\n]*\}\)),\n/.exec(WORLD)?.[1];
  assert.ok(budgetSrc, 'the breather\'s budget');
  let settle;
  const env = { frameFitBudget: BB.frameFitBudget, frameInterval: () => 6.9, lastBusy: () => 3, performance: { now: () => 500 }, buildPixel: () => new Promise((r, j) => { settle = { r, j }; }) };
  const host = new Function(...Object.keys(env), `let _streamSince = null; let _awaitedBuilds = 0;\n${helper}\nconst budget = ${budgetSrc};\nreturn { awaitedBuild, budget, stream: (v) => { _streamSince = v; } };`)(...Object.values(env));
  host.stream(400);   // the pump has started the new ring's first pixel, 100 ms ago
  assert.equal(host.budget(), BB.BUILD_SLICE_FLOOR_MS, 'the stream alone, on a 144 Hz display: the floor');
  const arrival = host.awaitedBuild(1, 2);
  assert.equal(host.budget(), BB.BUILD_SLICE_MS, 'a teleport\'s build in flight: the whole slice, the stream beside it notwithstanding');
  settle.r({ px: 1 });
  assert.deepEqual(await arrival, { px: 1 }, 'the build\'s own answer comes back');
  assert.equal(host.budget(), BB.BUILD_SLICE_FLOOR_MS, 'and once it stands the stream is sized for the frame again');
  const failed = host.awaitedBuild(3, 4);
  settle.j(new Error('the build threw'));
  await assert.rejects(failed, /the build threw/);
  assert.equal(host.budget(), BB.BUILD_SLICE_FLOOR_MS, 'a build that threw is not waited on any more');
  // the host's two waiters, and nothing else, build through it
  assert.match(WORLD, /\n  const playerPixel = await awaitedBuild\(first\.px, first\.py\);/, 'the boot\'s first pixel');
  assert.match(WORLD, /try \{ dest = await awaitedBuild\(first\.px, first\.py\); \}/, 'a teleport\'s');
  assert.equal(WORLD.split('\n').filter((l) => /awaitedBuild\(/.test(l) && !/^\s*\/\//.test(l)).length, 3, 'the door and its two callers');
  assert.equal((WORLD.match(/_awaitedBuilds(\+\+|--)/g) || []).length, 2, 'and only the door counts');
  // the sweep ends the old world's stream, so the new one's two seconds are its own
  const tp = WORLD.slice(WORLD.indexOf('  async function _teleportToPixel('), WORLD.indexOf('    const first = queue.shift();', WORLD.indexOf('  async function _teleportToPixel(')));
  assert.match(tp, /queue\.push\(\.\.\.state\.init\(px, py\)\);[\s\S]*\n    _streamSince = null;/, 'a teleport\'s sweep ends the stream it emptied');
});

