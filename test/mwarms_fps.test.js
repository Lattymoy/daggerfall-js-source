// MWA1 + FPS1 (2026-09-11, RookieG's report via Mac: "morrowind arms
// did not work on first launch" / "we need an ingame fps counter").
// The pure halves EXECUTE; the DOM half runs against AUDIT 62's stub
// document; the hosts and the pane are text-pinned. Every pin names
// its mutant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fpsStats, mountFpsCounter } from '../src/ui/fpsCounter.js';
import { autoBuildArms } from '../src/combat/weaponRig.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// ---------------------------------------------------------------
// FPS1 - the numbers
// ---------------------------------------------------------------
test('FPS1 fpsStats: frames a second from the stamps, the mean frame, and the WORST frame a mean hides (mutant: worst dropped, or fps counted as stamps rather than intervals)', () => {
  const sixty = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));   // 60 intervals across one second
  const s = fpsStats(sixty);
  assert.equal(s.fps, 60);
  assert.ok(Math.abs(s.meanMs - 1000 / 60) < 1e-9);
  assert.ok(Math.abs(s.worstMs - 1000 / 60) < 1e-9, 'a steady second: worst is the mean');
  // a steady 60 with ONE 90 ms hitch
  const hitch = [...sixty]; for (let i = 31; i < hitch.length; i++) hitch[i] += 90 - 1000 / 60;
  const h = fpsStats(hitch);
  assert.ok(Math.abs(h.worstMs - 90) < 1e-9, `the stutter is reported: ${h.worstMs}`);
  assert.ok(h.fps < 60 && h.fps >= 55, `and the second held fewer frames: ${h.fps}`);
  assert.deepEqual(fpsStats([]), { fps: 0, meanMs: 0, worstMs: 0 });
  assert.deepEqual(fpsStats([5]), { fps: 1, meanMs: 0, worstMs: 0 }, 'one stamp is one frame and no interval');
});

test('FPS1 mountFpsCounter: hidden while its switch is off, shown and written once a second while on, disposed cleanly (mutant: the switch read once at mount, or the element written while hidden)', () => {
  const prev = { d: globalThis.document };
  const made = [];
  const stubEl = () => {
    const n = { id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } };
    made.push(n); return n;
  };
  globalThis.document = { createElement: stubEl, body: stubEl() };
  try {
    let on = false;
    const c = mountFpsCounter({ enabled: () => on, raf: null });   // no frame loop: the test drives tick
    assert.equal(c.el.style.display, 'none', 'hidden at mount');
    for (let t = 0; t <= 1000; t += 1000 / 60) c.tick(t);
    assert.equal(c.el.textContent, '', 'nothing is written while off');
    on = true;
    c.tick(1020);
    assert.equal(c.el.style.display, 'block', 'the switch is read on the tick, not at mount');
    for (let t = 1020 + 1000 / 60; t <= 2040; t += 1000 / 60) c.tick(t);
    assert.match(c.el.textContent, /^6\d fps\n1\d\.\d ms  worst \d+$/, `the second's numbers: ${JSON.stringify(c.el.textContent)}`);
    on = false;
    c.tick(2060);
    assert.equal(c.el.style.display, 'none', 'and off again at once');
    c.dispose();
    assert.equal(c.el.removed, true);
  } finally { globalThis.document = prev.d; }
});

// ---------------------------------------------------------------
// MWA1 - the arms at boot
// ---------------------------------------------------------------
test('MWA1 autoBuildArms: nothing without a made character, without the switch, or without the archives (mutant: any gate dropped)', async () => {
  const made = { chargenDone: true };
  assert.equal(await autoBuildArms(null, { wanted: () => true, dataCount: () => 1 }), null);
  assert.equal(await autoBuildArms({ chargenDone: false }, { wanted: () => true, dataCount: () => 1 }), null, 'the wizard has not run: race, sex and face are not known');
  assert.equal(await autoBuildArms(made, { wanted: () => false, dataCount: () => 1 }), null, 'the switch is off');
  assert.equal(await autoBuildArms(made, { wanted: () => true, dataCount: () => 0 }), null, 'no archives attached');
});

test('MWA1 pins: the switch on the prefs shelf, flipped by Build and Unload; the hosts build at every door a made character arrives through (mutant: a door dropped, or the pane forgetting to set it)', () => {
  assert.equal(PREF_DEFAULTS.mwArms, false, 'off until the player builds once');
  assert.equal(PREF_DEFAULTS.showFps, false, 'a diagnostic is off by default');
  const rig = read('src/combat/weaponRig.js');
  assert.match(rig, /export async function autoBuildArms\(entity, \{ wanted = \(\) => getPref\('mwArms'\), dataCount = morrowindDataCount \} = \{\}\)/);
  assert.match(rig, /if \(!entity\?\.chargenDone \|\| !wanted\(\) \|\| !\(dataCount\(\) > 0\) \|\| fpArm\.ready\(\)\) return null;/, 'the four gates, the last so a second door does not rebuild a built arm');
  const w = read('src/scenes/world.js');
  assert.equal((w.match(/autoBuildArms\(playerEntity\);/g) ?? []).length, 4, 'world: the rig, the wizard, the load, the classic load');
  assert.match(w, /questInitAtGameStart\(\);\s+\/\/ Q4-v: OnStartGame for the new character\n\s+autoBuildArms\(playerEntity\);/, 'after the wizard');
  assert.match(w, /if \(!extras\) \{ townTalk\.say\('Save version mismatch\.'\); return; \}\n\s+autoBuildArms\(playerEntity\);/, 'after the restore');
  assert.match(read('src/scenes/exterior.js'), /\n  \}\);\n  autoBuildArms\(playerEntity\);/, 'exterior: after its rig');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /fpArm\.unload\(\); setPref\('mwArms', false\);/, 'Unload clears it');
  assert.match(menu, /const res = await buildArmsFor\(playerEntity\);\n\s+if \(res\?\.ok\) setPref\('mwArms', true\);/, 'Build sets it only when the build stood');
  assert.match(menu, /prefRow\('showFps', 'FPS counter',/, 'the counter has its row');
  assert.match(read('src/main.js'), /mountFpsCounter\(\{ enabled: \(\) => params\.has\('fps'\) \|\| !!getPref\('showFps'\) \}\);/, 'the counter mounts over every host, on the pref or ?fps');
});
