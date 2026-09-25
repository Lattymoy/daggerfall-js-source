// PERF-EXT-C5 (2026-09-25, the players: "fps issues in the exterior but
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

test('PERF-EXT-C5: frameFitBudget lends the frame interval less its own script less the margin, 3 to 6 ms - and the whole 6 to a stream two seconds old, an awaited build, or a NaN', () => {
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

test('PERF-EXT-C5: the breather asks the budget once a slice, yields when it is spent and not before, and tells onSlice what each slice took', async () => {
  let t = 0, asked = 0, budget = 3;
  const frames = [], slices = [];
  const b = BB.createBreather({ now: () => t, raf: (fn) => { frames.push(fn); }, budget: () => { asked++; return budget; }, onSlice: (ms) => slices.push(ms) });
  assert.equal(asked, 1, 'asked as the first slice begins');
  t = 2.9; b.breathe(); await Promise.resolve();
  assert.equal(frames.length, 0, 'inside a 3 ms slice: no frame');
  t = 3.1; const p = b.breathe(); await Promise.resolve(); await Promise.resolve();
  assert.equal(frames.length, 1, 'the 3 ms spent: a frame is asked for');
  assert.deepEqual(slices, [3.1], 'and the slice reported');
  budget = 6; t = 20; frames[0](); await p;
  assert.equal(asked, 2, 'asked again as the next slice begins, not at every breath');
  t = 25.9; b.breathe(); await Promise.resolve();
  assert.equal(frames.length, 1, 'a 6 ms slice does not yield at 5.9');
  t = 26.1; b.breathe(); await Promise.resolve(); await Promise.resolve();
  assert.equal(frames.length, 2, 'and does at 6.1');
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

test('PERF-EXT-C5: the frame clock measures the display\'s period, the frame\'s own script, and folds a lent slice into the next sample', () => {
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

test('PERF-EXT-C5: `?perf=cpu` carries the stream as a `build` span; the GPU clocks never hear of it', () => {
  const gl = { getExtension: () => null };
  const m = new PerfMeter(gl, false, true);
  m.markCpu('world');
  m.addCpu('build', 4.5); m.addCpu('build', 1.5); m.addCpu('build', 0);
  assert.equal(m.cpuZones.get('build'), 6);
  const g = new PerfMeter(gl, true, false);
  g.addCpu('build', 4);
  assert.equal(g.cpuZones.size, 0, 'a GPU meter keeps no CPU buckets');
});

test('PERF-EXT-C5: the world host sizes the stream\'s slice by the frame clock, lends each slice back, and lends an awaited build the whole slice', () => {
  assert.match(WORLD, /  const breather = createBreather\(\{   \/\/ PERF7[^\n]*\n    budget: \(\) => frameFitBudget\(\{ intervalMs: frameInterval\(\), busyMs: lastBusy\(\), streamingMs: _streamSince == null \? 0 : performance\.now\(\) - _streamSince, awaited: _streamSince == null \}\),\n    onSlice: \(ms\) => \{ lendFrame\(ms\); meterFor\(renderer\.gl\)\?\.addCpu\('build', ms\); \},\n  \}\);/);
  const pump = WORLD.slice(WORLD.indexOf('  async function pump() {'), WORLD.indexOf('\n  }\n', WORLD.indexOf('  async function pump() {')));
  assert.match(pump, /const next = queue\.shift\(\);\n    _streamSince \?\?= performance\.now\(\);/, 'the pump\'s builds are the stream');
  assert.match(pump, /building = false;\n    if \(!queue\.length\) _streamSince = null;/, 'and the stream ends with the queue');
  assert.equal((WORLD.match(/(?<!let )_streamSince = /g) || []).length, 1, 'only the pump ends a stream');
});
