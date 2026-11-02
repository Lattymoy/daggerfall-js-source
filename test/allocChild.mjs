// ALLOC-RACE (2026-10-14): THE ALLOCATION MEASURE'S CHILD, ONE HOME. Ten suites
// spawn a child to count the bytes a frame makes (L2 F9's measure: a fixed
// 64 MB young space, the least of several windows, against a control that must
// show) - and each spelled its flags itself. The measure only reads true once
// the function under it is OPTIMISED, and V8 optimises on a background thread:
// on a loaded machine (CI's four shards, each spawning children of its own on
// four cores) that thread can be starved past the whole warm-up, and the
// windows then count the lower tier's boxed numbers instead of the frame.
// sd25_arena's S7 failed so in a full run (marks: 17.32 bytes a frame) and
// passed alone.
//
// The child waits for the compiler instead of racing it: test/allocSettle.mjs,
// preloaded, makes the gc() that opens every window first finish the optimising
// queue (%FinalizeOptimization). The code is compiled the browser's own way -
// concurrently - and read only once it is in. (AUDIT ALLOC-RACE: the first fix,
// --no-concurrent-recompilation, compiled each caller the moment it turned hot,
// before its callees - a different shape of optimised code, which inlined a call
// whose boxed arguments the shipping engine makes; a still body posed again read
// 48 bytes a frame concurrently and 1 synchronously.) test/tooling/allocchild.test.js
// proves the settle under an artificially late compiler. Every suite that
// measures allocation spawns its child with these.
import { fileURLToPath } from 'node:url';

export const ALLOC_CHILD_ARGS = Object.freeze([
  '--expose-gc',
  '--min-semi-space-size=64',
  '--max-semi-space-size=64',
  '--allow-natives-syntax',
  '--import', fileURLToPath(new URL('./allocSettle.mjs', import.meta.url)),
]);
