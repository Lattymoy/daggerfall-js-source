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
import { autoBuildArms, armsStandFor, armIdentityOf } from '../src/combat/weaponRig.js';
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

// ---------------------------------------------------------------
// MWA3 - the arm stands FOR the entity, not merely stands
// ---------------------------------------------------------------
// Mac, 2026-09-16: "my character who is an argonian uses a human
// morrowind model". fpArm is one module singleton for the session and
// autoBuildArms's last gate was `fpArm.ready()` - so whichever identity
// first reached a door (the wizard's character, an earlier save, a
// ?test preset) owned the arm, and a save loaded over it in-session
// kept that arm's race, sex and face; setWorn's equip-follow rebuilds
// spread lastBuildOpts and carried the stale identity forward. An
// Argonian on the human skeleton, no tail, until the pack's Off/On.
test('MWA3 armsStandFor: a standing arm counts only when its race, sex and face are the entity\'s own (mutant: any of the three dropped, or ready() alone)', () => {
  const argonian = { race: 'Argonian', gender: 'female', faceIndex: 3 };
  const forHer = { race: 'argonian', female: true, faceIndex: 3 };
  assert.equal(armsStandFor(argonian, { ready: () => true, builtFor: () => forHer }), true, 'her own arm stands');
  assert.equal(armsStandFor(argonian, { ready: () => false, builtFor: () => forHer }), false, 'no arm stands');
  assert.equal(armsStandFor(argonian, { ready: () => true, builtFor: () => null }), false, 'ready with no build record is not hers');
  assert.equal(armsStandFor(argonian, { ready: () => true, builtFor: () => ({ ...forHer, race: 'breton' }) }), false, 'a human\'s arm is not hers - the report');
  assert.equal(armsStandFor(argonian, { ready: () => true, builtFor: () => ({ ...forHer, female: false }) }), false, 'the male skeleton is not hers');
  assert.equal(armsStandFor(argonian, { ready: () => true, builtFor: () => ({ ...forHer, faceIndex: 4 }) }), false, 'another face is not hers');
  assert.deepEqual(armIdentityOf({ race: 'DarkElf', gender: 'male', faceIndex: 7 }), { race: 'dark elf', female: false, faceIndex: 7 }, 'the identity third of armBuildOptsOf, in the ESM\'s own race spelling');
  assert.deepEqual(armIdentityOf(null), { race: null, female: false, faceIndex: 0 }, 'no entity, no identity - never a throw at a boot door');
});

test('MWA3 autoBuildArms: an arm standing for ANOTHER identity is no longer a reason to stand down - the load\'s door rebuilds (mutant: the gate reads ready() again)', async () => {
  const made = { chargenDone: true, race: 'Argonian', gender: 'male', faceIndex: 0 };
  let built = 0;
  const measure = async () => { built += 1; throw new Error('a test has no store - the gate is the pin, not the build'); };
  assert.equal(await autoBuildArms(made, { wanted: () => true, dataCount: () => 1, standing: () => true, measure, measured: () => null }), null, 'her own arm stands: nothing to do');
  assert.equal(built, 0);
  const res = await autoBuildArms(made, { wanted: () => true, dataCount: () => 1, standing: () => false, measure, measured: () => null });
  assert.equal(built, 1, 'another identity\'s arm (or none) stands: the door goes on to the build');
  assert.ok(res && res.ok === false, 'the build itself refuses in a test (no archives), which is a result, not null');
});

test('MWA1 pins: the switch on the prefs shelf, flipped by Build and Unload; the hosts build at every door a made character arrives through (mutant: a door dropped, or the pane forgetting to set it)', () => {
  assert.equal(PREF_DEFAULTS.mwArms, false, 'off until the player builds once');
  assert.equal(PREF_DEFAULTS.showFps, false, 'a diagnostic is off by default');
  const rig = read('src/combat/weaponRig.js');
  assert.match(rig, /export async function autoBuildArms\(entity, \{ wanted = \(\) => getPref\('mwArms'\), dataCount = morrowindDataCount, measure = registerMorrowindData, measured = morrowindDataFingerprint, standing = armsStandFor \} = \{\}\)/);
  assert.match(rig, /if \(measured\(\) == null\) await measure\(\)\.catch\(\(\) => 0\);\n\s+const res = await buildArmsFor\(entity\);/, 'AUDIT 65 XL-6: the store is measured before the face verdict, not parsed a dozen times');
  assert.match(rig, /if \(!entity\?\.chargenDone \|\| !wanted\(\) \|\| !\(dataCount\(\) > 0\) \|\| standing\(entity\)\) return null;/, 'the four gates, the last so a second door does not rebuild an arm that already stands FOR THIS ENTITY (MWA3: not merely a built one)');
  const w = read('src/scenes/world.js');
  assert.equal((w.match(/autoBuildArms\(playerEntity\);/g) ?? []).length, 4, 'world: the rig, the wizard, the load, the classic load');
  assert.match(w, /questInitAtGameStart\(\);\s+\/\/ Q4-v: OnStartGame for the new character\n\s+autoBuildArms\(playerEntity\);/, 'after the wizard');
  assert.match(w, /if \(!extras\) \{ townTalk\.say\('Save version mismatch\.'\); return; \}\n\s+autoBuildArms\(playerEntity\);/, 'after the restore');
  assert.match(read('src/scenes/exterior.js'), /\n  \}\);\n  autoBuildArms\(playerEntity\);/, 'exterior: after its rig');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /fpArm\.unload\(\); setPref\('mwArms', false\);/, 'Unload clears it');
  assert.match(menu, /const res = await buildArmsFor\(playerEntity\);\n\s+if \(res\?\.ok\) setPref\('mwArms', true\);/, 'Build sets it only when the build stood');
  assert.match(menu, /prefRow\('showFps', 'FPS counter',/, 'the counter has its row');
  assert.match(read('src/main.js'), /mountFpsCounter\(\{ enabled: \(\) => params\.has\('fps'\) \|\| !!getPref\('showFps'\), stats: \(\) => renderer\.stats \}\);/, 'the counter mounts over every host, on the pref or ?fps, with the renderer\'s counts (PERF3)');
});

test('MWA2 (Mac: "a toggle for the morrowind asset pack"): ONE On/Off row over the mwArms switch replaces Build / Unload - ON builds and holds the pref only when the build stood, OFF unloads; every consumer already reads that one pref', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /mw\.append\(prefRow\('mwArms', 'Use Morrowind assets',/, 'the row, on the Morrowind assets card, only once archives are attached');
  assert.match(menu, /if \(count\) \{\n\s+mw\.append\(prefRow\('mwArms'/, 'gated on attached data');
  assert.match(menu, /const toggleMorrowind = async \(on\) => \{\n\s+if \(!on\) \{ fpArm\.unload\(\); setPref\('mwArms', false\); render\(\); return; \}/, 'OFF: unload, and the switch stays off across launches');
  assert.match(menu, /if \(res\?\.ok\) setPref\('mwArms', true\);[^\n]*\n\s+else setPref\('mwArms', false\);/, 'ON: the pref holds only when the build stood - a refusal turns the row back off');
  assert.doesNotMatch(menu, /'Unload arms'|'Build first-person arms'/, 'the two buttons are gone: one idea, one control');
  // the one pref, read by every consumer of the pack
  assert.match(read('src/combat/weaponRig.js'), /wanted = \(\) => getPref\('mwArms'\)/, 'the boot build');
  assert.match(read('src/scenes/world.js'), /enabled: \(\) => enhanced && !!getPref\('mwArms'\) && morrowindDataCount\(\) > 0/, 'the peer bodies');
  assert.match(read('src/player/mwView.js'), /if \(fpArm\.canThirdPerson\(\)\) return false;/, 'and the view seam asks the arm, which unload() empties - so OFF hands third person to the sprite');
});
