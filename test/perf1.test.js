// PERF1 (2026-09-11, RookieG via Mac: "its like 45fps on the outside").
// The frame clock EXECUTES; the counter's script line runs against a
// stub document; the hosts, the grass, the clouds and the pane are
// text-pinned. Every pin names its mutant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameBegin, frameEnd, frameCpu, _resetFrameClock } from '../src/systems/frameClock.js';
import { mountFpsCounter } from '../src/ui/fpsCounter.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { QUALITY } from '../src/render/volumetricClouds.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('PERF1 frameClock: the last second\'s script time, mean and worst; an unmatched end or begin is no sample (mutant: the window not trimmed, or a begin-less end counted)', () => {
  _resetFrameClock();
  assert.equal(frameCpu(), null, 'nothing stamped yet');
  frameEnd(100);
  assert.equal(frameCpu(), null, 'an end with no begin is not a frame');
  for (let f = 0; f < 60; f++) { frameBegin(1000 + f * 16); frameEnd(1000 + f * 16 + 6); }
  let c = frameCpu();
  assert.equal(c.frames, 60); assert.ok(near(c.meanMs, 6) && near(c.worstMs, 6), `a steady 6 ms: ${JSON.stringify(c)}`);
  frameBegin(2000); frameEnd(2030);   // one 30 ms frame
  c = frameCpu();
  assert.ok(near(c.worstMs, 30), 'the worst is reported');
  frameBegin(3500);   // an early return: begun, never ended...
  frameBegin(3600); frameEnd(3604);   // ...the next frame's begin replaces it
  c = frameCpu();
  assert.equal(c.frames, 1, 'the window is the last second only, and the abandoned frame left no sample');
  assert.ok(near(c.meanMs, 4));
  frameEnd(3700);
  assert.equal(frameCpu().frames, 1, 'a second end without a begin adds nothing');
  _resetFrameClock();
});

test('PERF1 fpsCounter: the script line appears under the cadence once a host has stamped a frame, and not before (mutant: the line unconditional, or the clock unread)', () => {
  const prev = { d: globalThis.document };
  const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } });
  globalThis.document = { createElement: stubEl, body: stubEl() };
  try {
    _resetFrameClock();
    const c = mountFpsCounter({ enabled: () => true, raf: null });
    for (let t = 0; t <= 1020; t += 1000 / 60) c.tick(t);
    assert.doesNotMatch(c.el.textContent, /script/, 'the menu has no host loop: no script line');
    for (let t = 1020; t <= 2040; t += 1000 / 60) { frameBegin(t); frameEnd(t + 7); c.tick(t + 1000 / 60); }
    assert.match(c.el.textContent, /\nscript 7\.0 ms  worst 7$/, `the hosts' share: ${JSON.stringify(c.el.textContent)}`);
    c.dispose();
  } finally { globalThis.document = prev.d; _resetFrameClock(); }
});

test('PERF1 pins: every host stamps its frame, the grass takes the pref\'s fraction and none at 0, the clouds take the pref behind the door, the pane has both dials (mutant: any one dropped)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = read(h);
    assert.match(s, /if \(!frameAlive\(_frameToken\)\) return;[^\n]*\n\s+frameBegin\(now\);/, `${h}: begin at the top of the live frame (a held frame returns before frameEnd, so it leaves no sample)`);
    assert.match(s, /frameEnd\(\);\s+\/\/ PERF1\n\s+requestAnimationFrame\(frame\);\n  \}\n  requestAnimationFrame\(frame\);/, `${h}: end before the loop re-arms`);
  }
  assert.equal(PREF_DEFAULTS.grassDensity, 1, 'the full field by default - the enhanced look is the law, the dial is the escape');
  assert.equal(PREF_DEFAULTS.cloudQuality, 'default');
  assert.ok(Object.hasOwn(QUALITY, PREF_DEFAULTS.cloudQuality));
  const w = read('src/scenes/world.js');
  assert.match(w, /const grassDensity = Math\.max\(0, Math\.min\(1, Number\(getPref\('grassDensity'\)\) \|\| 0\)\) \* LAB_GRASS\.density;/);
  assert.match(w, /getPref\('enhancedEnvironments'\) && grassDensity > 0 &&/, 'a zero density builds no renderer');
  assert.match(w, /createGrassField\(labGrass, \{ keep, ground, density: grassDensity \}\)/, 'the field is built at the fraction');
  assert.match(read('src/scenes/shared.js'), /Object\.hasOwn\(CLOUD_QUALITY, cloudsDoor\) \? cloudsDoor : \(Object\.hasOwn\(CLOUD_QUALITY, getPref\('cloudQuality'\)\) \? getPref\('cloudQuality'\) : 'default'\)/, 'the URL door still wins; the pref sits behind it; an unknown pref is the default');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /choiceRow\('grassDensity', 'Grass density',[\s\S]{0,400}\[\[1, 'Full'\], \[0\.5, 'Half'\], \[0\.25, 'Quarter'\], \[0, 'Off'\]\]/);
  assert.match(menu, /choiceRow\('cloudQuality', 'Cloud quality',[\s\S]{0,400}\[\['default', 'Default'\], \['lo', 'Low'\], \['hi', 'High'\]\]/);
  assert.match(read('src/ui/fpsCounter.js'), /const cpu = frameCpu\(\);/, 'the counter reads the clock');
});
