// PERF7 (2026-09-11). The stream build breathes: a warm pixel build -
// every await settled from cache - ran as one task and stalled the
// frame for the whole of a city pixel. The breather yields to the next
// animation frame once a slice's budget is spent. EXECUTES with an
// injected clock and frame request; the world host is pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBreather, BUILD_SLICE_MS } from '../src/systems/buildBreather.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('PERF7 createBreather: resolves at once inside the slice, awaits one frame once the budget is spent, and a reset starts a fresh slice (mutant: the yield unconditional, or the slice never restarted)', async () => {
  let t = 0;
  const frames = [];
  const raf = (fn) => { frames.push(fn); return frames.length; };
  const b = createBreather({ now: () => t, raf, sliceMs: 6 });
  // inside the budget: no frame asked for, resolved synchronously (the microtask alone)
  t = 3;
  let resolved = false;
  b.breathe().then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(frames.length, 0, 'no frame requested inside the slice');
  assert.equal(resolved, true);
  assert.equal(b.yields, 0);
  // the budget spent: a frame is asked for, and the breath holds until it comes
  t = 7;
  let done = false;
  const p = b.breathe().then(() => { done = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(frames.length, 1, 'one frame requested'); assert.equal(done, false, 'held until the frame');
  t = 20;   // the frame arrives later
  frames[0](); await p;
  assert.equal(done, true); assert.equal(b.yields, 1);
  // the slice restarted at the frame: 5 ms later is still inside it
  t = 24;
  b.breathe(); await Promise.resolve();
  assert.equal(frames.length, 1, 'no new frame inside the fresh slice');
  // reset: a new build's clock
  t = 100; b.reset(); t = 105;
  b.breathe(); await Promise.resolve();
  assert.equal(frames.length, 1, 'reset moved the slice start to 100');
  t = 107;
  const q = b.breathe(); await Promise.resolve(); await Promise.resolve();
  assert.equal(frames.length, 2, 'and 7 ms later the budget is spent again');
  frames[1](); await q;
  assert.equal(b.yields, 2);
  assert.equal(BUILD_SLICE_MS, 6, 'the shipped slice: room for the draw in a 16.7 ms frame');
});

test('PERF7 pins: the world host keeps one breather for the stream, resets it at each build, and breathes after every placed model (mutant: the call dropped, or reset dropped so a long earlier await eats the first slice)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const breather = createBreather\(\);[^\n]*\n\s+async function buildPixelNow\(px, py, \{ roadsRetry = false \} = \{\}\) \{\n\s+breather\.reset\(\);/, 'one breather, reset per build');
  assert.match(w, /entry\._batched = true; \}[^\n]*\n\s+await breather\.breathe\(\);/, 'after each model, inside the placements loop');
  const loopAt = w.indexOf('for (const placed of b.layout.models) {');
  const breatheAt = w.indexOf('await breather.breathe();');
  assert.ok(loopAt > 0 && breatheAt > loopAt && breatheAt - loopAt < 3000, 'the breath is inside the model loop');
});
