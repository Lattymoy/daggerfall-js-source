// PERF9 (2026-09-11). The performance probe, and the counter seam it
// reads. The counter EXECUTES against a stub document and window; the
// probe is text-pinned (it needs a browser and ARENA2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountFpsCounter } from '../src/ui/fpsCounter.js';
import { _resetFrameClock } from '../src/systems/frameClock.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('PERF9 fpsCounter: window.__fpsStats answers the last second\'s numbers even while the overlay is hidden, and nothing is written to the overlay while it is (mutant: the stats only under the switch, or the text written while off)', () => {
  const prev = { d: globalThis.document, w: globalThis.window };
  const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } });
  globalThis.document = { createElement: stubEl, body: stubEl() };
  globalThis.window = {};
  try {
    _resetFrameClock();
    const c = mountFpsCounter({ enabled: () => false, raf: null, stats: () => ({ draws: 250, texBinds: 90 }) });
    assert.equal(typeof globalThis.window.__fpsStats, 'function', 'the seam is mounted with the counter');
    assert.equal(globalThis.window.__fpsStats(), null, 'nothing before the first second');
    for (let t = 0; t <= 1020; t += 1000 / 60) c.tick(t);
    const st = globalThis.window.__fpsStats();
    assert.ok(st && st.fps >= 59 && st.fps <= 61 && Math.abs(st.draws - 250) < 1e-9 && Math.abs(st.binds - 90) < 1e-9, `the second's numbers: ${JSON.stringify(st)}`);
    assert.equal(st.scriptMs, null, 'no host stamped a frame');
    assert.equal(c.el.textContent, '', 'the hidden overlay is not written');
    c.dispose();
  } finally { globalThis.document = prev.d; globalThis.window = prev.w; _resetFrameClock(); }
});

test('PERF9 pins: the probe boots the three scenes on the shot door, waits for the stream to settle, reads the counter seam, and runs on the machine\'s GPU when headed (mutant: a scene dropped, or the settle wait dropped)', () => {
  const p = read('tools/perfProbe.mjs');
  assert.match(p, /city: `\/play\/\?world&region=Daggerfall&loc=Daggerfall&class=1&novideo&shot&fps`/);
  assert.match(p, /road: `\/play\/\?world&spawn=random&class=1&novideo&shot&fps`/);
  assert.match(p, /dungeon: `\/play\/\?shot&class=0&fps`/);
  assert.match(p, /waitForFunction\(\(\) => window\.__shotReady === true/, 'settled means the stream is done');
  assert.match(p, /window\.__fpsStats \? window\.__fpsStats\(\) : null/, 'reads the counter\'s own numbers');
  assert.match(p, /HEADED\n\s+\? \{ headless: false \}\n\s+: \{ args: \['--use-gl=angle', '--use-angle=swiftshader'/, 'headed is the real GPU; headless is software and only relative');
  assert.match(p, /const ROOT = fileURLToPath\(new URL\('\.\.', import\.meta\.url\)\);/, 'the repo root, not a machine\'s path');
  assert.match(read('package.json'), /"perf": "node tools\/perfProbe\.mjs"/);
});
