// ALLOC-RACE (2026-10-14) - THE ALLOCATION MEASURE CANNOT RACE THE COMPILER.
// test/allocChild.mjs carries the flags every allocation-measuring child is
// spawned with, and test/allocSettle.mjs the settle they preload; this suite
// holds the settle to its purpose and the suites to the flags
// (bible/09-Testing/Testing.md, ALLOC-RACE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';

const TEST_DIR = fileURLToPath(new URL('..', import.meta.url));
/** How late the optimising compiler is made to run - a loaded machine, made certain. */
const LATE_MS = 3000;

// A frame that makes nothing once optimised and boxes a number a frame before: the measure's own shape (warm-up,
// gc twice, the least of eight windows) - and how long the warm-up and the windows took, so a control that ran so
// slowly the late compiler may have landed inside it says so instead of failing.
const SCRIPT = `
  const t0 = performance.now();
  const out = new Float64Array(4), src = Array.from({ length: 64 }, (_, i) => i * 1.25); src.push('tagged');
  let k = 0;
  const fn = () => { const a = src[(k = (k + 1) & 63)]; out[0] = Math.sqrt(a * a + 1.5) * 0.5 + a / 3; };
  for (let f = 0; f < 200000; f++) fn();
  let least = Infinity;
  for (let w = 0; w < 8; w++) {
    globalThis.gc(); globalThis.gc();
    const h0 = process.memoryUsage().heapUsed;
    for (let f = 0; f < 5000; f++) fn();
    least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
  }
  console.log(JSON.stringify({ least, ms: performance.now() - t0 }));
`;
const measure = (args) => {
  const run = spawnSync(process.execPath, [...args, `--concurrent-recompilation-delay=${LATE_MS}`, '--input-type=module', '-e', SCRIPT], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim().split('\n').pop());
};
const BARE = ALLOC_CHILD_ARGS.slice(0, 3);   // --expose-gc and the young space: the measure without the settle

test('ALLOC-RACE THE MEASURE WAITS FOR A LATE COMPILER: with the optimising thread held back three seconds (--concurrent-recompilation-delay, a loaded machine made certain), a frame that makes nothing measures under 2 bytes through ALLOC_CHILD_ARGS (the settle finishes the queue before each window) - and the control, the measure without the settle, shows the boxing, or the delay starved nothing and the pin is blind (mutants: the settle dropped from the list; the settle that waits for nothing)', (t) => {
  assert.deepEqual(BARE, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64'], 'the control is the measure\'s own flags');
  const control = measure(BARE);
  if (control.ms < LATE_MS * 0.8) assert.ok(control.least >= 40, `the control made ${control.least.toFixed(2)} bytes a frame in ${Math.round(control.ms)} ms - the late compiler never showed`);
  else t.diagnostic(`the control ran ${Math.round(control.ms)} ms against a ${LATE_MS} ms delay - too slow to say the compiler was still out; its reading (${control.least.toFixed(2)}) is not a verdict`);
  const settled = measure(ALLOC_CHILD_ARGS);
  assert.ok(settled.least < 2, `${settled.least.toFixed(2)} bytes a frame through ALLOC_CHILD_ARGS with the compiler late (the control ${control.least.toFixed(2)})`);
});

test('ALLOC-RACE ONE HOME FOR THE CHILD\'S FLAGS: every suite that spawns an allocation-measuring child (one that exposes gc, or reads heapUsed in a child) imports ALLOC_CHILD_ARGS from test/allocChild.mjs, spells none of its flags itself and takes the list whole - a suite that writes its own list, or drops the settle from it, is the one that races the compiler (mutants: a suite\'s own list again)', () => {
  const stray = [];
  let measuring = 0;
  const spawns = /\b(spawnSync|spawn|execFileSync|execFile|fork)\(/;
  for (const f of readdirSync(TEST_DIR, { recursive: true }).filter((n) => n.endsWith('.test.js') && n.split(/[\\/]/).pop() !== 'allocchild.test.js').sort()) {
    const src = readFileSync(join(TEST_DIR, f), 'utf8');
    // a measuring child is one that can call gc() - perfcrowd1's '--max-semi-space-size=32' is the desktop shell's own
    // switch (a regex over app/main.cjs), no child of a test - or one a test spawns to read its heap
    if (!/ALLOC_CHILD_ARGS|expose[-_]gc/.test(src) && !(spawns.test(src) && /heapUsed/.test(src))) continue;
    measuring++;
    if (!/import \{[^}]*\bALLOC_CHILD_ARGS\b[^}]*\} from ['"](?:\.\/|(?:\.\.\/)+)allocChild\.mjs['"];/.test(src)) stray.push(`${f}: does not import ALLOC_CHILD_ARGS`);   // TIDY5: from its area's folder, the helper a level or two up
    // (--allow-natives-syntax alone is no measure's flag: perfextb's PERF-EXT10 child asks V8 about hidden classes with it)
    if (/expose[-_]gc|(min|max)-semi-space-size|allocSettle/.test(src)) stray.push(`${f}: spells a child flag itself`);
    if (/ALLOC_CHILD_ARGS\s*\.\s*(filter|slice|splice|map|with|toSpliced)\b/.test(src)) stray.push(`${f}: takes ALLOC_CHILD_ARGS apart`);
  }
  assert.deepEqual(stray, []);
  assert.ok(measuring >= 10, `only ${measuring} measuring suites found - the sweep is reading the wrong tree`);
});
