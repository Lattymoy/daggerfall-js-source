// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT) - the Bay's fit to the picture of
// Tamriel kept across launches (world/tamriel/bayFitKept.js, the world host's trace hook awaits it). Held here: a kept
// fit equals fitBayToPicture's and the fit does not run for it; another trace or another Bay refuses it; a malformed
// record is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitBayToPicture } from '../../src/world/tamriel/tamrielLand.js';
import { PICTURE_W, PICTURE_H } from '../../src/world/tamriel/tamrielFrame.js';
import { keptBayFit, bayFitKey } from '../../src/world/tamriel/bayFitKept.js';

/** A picture's land: blobs of land in sea, deterministic. */
function traceOf(seed = 1) {
  const land = new Uint8Array(PICTURE_W * PICTURE_H);
  for (let y = 0; y < PICTURE_H; y++) for (let x = 0; x < PICTURE_W; x++) land[y * PICTURE_W + x] = (Math.sin(x * 0.11 + seed) + Math.cos(y * 0.13 - seed) > 0.2) ? 1 : 0;
  return { w: PICTURE_W, h: PICTURE_H, land };
}
/** The Bay, cut from the picture at (44, 50) x 18. */
const bayOf = (trace) => (x, y) => !!trace.land[Math.floor(50 + y / 18) * trace.w + Math.floor(44 + x / 18)];
function storeOf() {
  const m = new Map();
  return { m, sets: 0, async get(k) { return m.get(k) ?? null; }, async set(k, v) { this.sets++; m.set(k, structuredClone(v)); return true; } };
}

test('FIRST-VISIT Bay fit: a kept fit is fitBayToPicture\'s own, and the fit does not run for it (mutant: the kept fit ignored)', async () => {
  const trace = traceOf();
  const want = fitBayToPicture({ bayLand: bayOf(trace), trace });
  assert.ok(want, 'the fixture fits');
  const store = storeOf();
  assert.deepEqual(await keptBayFit({ bayLand: bayOf(trace), trace }, store), want);
  assert.equal(store.sets, 1);
  // a forged record under the same key is what answers: read back, not fitted again
  const key = bayFitKey(bayOf(trace), trace);
  store.m.set(key, { ...want, ox: want.ox + 1 });
  assert.equal((await keptBayFit({ bayLand: bayOf(trace), trace }, store)).ox, want.ox + 1);
  assert.equal(store.sets, 1, 'nothing kept again');
});

test('FIRST-VISIT Bay fit: another trace or another Bay is another key; a malformed record is refused (mutants: the trace or the Bay left out of the stamp; any object taken)', async () => {
  const trace = traceOf();
  const key = bayFitKey(bayOf(trace), trace);
  assert.notEqual(bayFitKey(bayOf(trace), traceOf(2)), key);
  assert.notEqual(bayFitKey((x, y) => bayOf(trace)(x, y) !== (x === 500 && y === 250), trace), key);
  const store = storeOf();
  store.m.set(key, { ox: 1, oy: 2 });
  const fit = await keptBayFit({ bayLand: bayOf(trace), trace }, store);
  assert.deepEqual(fit, fitBayToPicture({ bayLand: bayOf(trace), trace }));
  assert.equal(store.sets, 1, 'the malformed record replaced by the fit');
});
