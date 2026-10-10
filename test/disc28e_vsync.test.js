// FPS-VSYNC (2026-09-28, Discord, Regi: "Settings are also set for 300 FPS but it seems it's limited to 60 (possibly by
// vsync)"; Mac, asked whether the desktop app should run above the screen's refresh: "Yes"). DFU's own law
// (StartGameBehaviour.cs:238-250): VSync on, frames wait for the screen and the cap does nothing; VSync off, the Frame
// Rate Cap holds them. A page cannot stop waiting; the desktop app's Chromium can, told at launch - so the shell reads
// the player's saved VSync (the page's own settings blob, written through the page's own writer into the shell's
// file store) and lifts the wait when it is off. In the app the setting is a real one, read at the next start; in a
// browser it stays unavailable (test/fpscap1.test.js holds that side).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

import { setValue, saveSettings, _resetForTests, tierOf, SHELL_AT_LAUNCH } from '../src/systems/settings.js';
import { createFramePacer, installFramePacer, capStep, capTake, frameCapSkip, _resetFrameCap, PACER_LEAD_MS } from '../src/systems/frameCap.js';
import { widgetFor, formatValue } from '../src/ui/settingsLaw.js';
import { TIER_TEXT } from '../src/ui/settingsCopy.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { codeHasOnce } from './codeOnly.mjs';

const require = createRequire(import.meta.url);
const { SETTINGS_PREF, VSYNC_OFF_SWITCHES, savedVSync, frameRateSwitches } = require('../app/lib/frameRate.cjs');
const { createFileStorage } = require('../app/lib/fileStorage.cjs');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const roots = [];
/** A userData folder with the shell's file store on the page's bridge, as app/preload.cjs puts it there. */
function shell() {
  const root = mkdtempSync(join(tmpdir(), 'vsync-'));
  roots.push(root);
  globalThis.daggerShell = { storage: createFileStorage(root) };
  _resetForTests();
  return root;
}
afterEach(() => {
  delete globalThis.daggerShell;
  _resetForTests();
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

test('FPS-VSYNC: the shell reads the VSync the page saved - off lifts both of Chromium\'s waits, on (DFU\'s default) lifts nothing', () => {
  const root = shell();
  assert.equal(savedVSync(root), true, 'nothing saved: DFU\'s default, on');
  assert.deepEqual(frameRateSwitches(root), []);
  setValue('Video', 'VSync', 'False');
  assert.ok(saveSettings(), 'the page writes through the shell\'s store');
  assert.equal(savedVSync(root), false);
  assert.deepEqual(frameRateSwitches(root), ['disable-gpu-vsync', 'disable-frame-rate-limit']);
  assert.deepEqual([...VSYNC_OFF_SWITCHES], ['disable-gpu-vsync', 'disable-frame-rate-limit']);
  setValue('Video', 'VSync', 'True');
  saveSettings();
  assert.deepEqual(frameRateSwitches(root), [], 'on again: the wait stays');
});

test('FPS-VSYNC: the shell reads the value as the page\'s GetBool does - any case of true is on, anything else stored is off, an unreadable store is the default', () => {
  const root = shell();
  const store = createFileStorage(root);
  const put = (v) => store.setItem(SETTINGS_PREF, JSON.stringify({ Video: { VSync: v } }));
  put(' TRUE ');
  assert.equal(savedVSync(root), true);
  put('no');
  assert.equal(savedVSync(root), false, 'GetBool reads a stored non-boolean as False');
  store.setItem(SETTINGS_PREF, '{ not json');
  assert.equal(savedVSync(root), true, 'unreadable: DFU\'s default, never a surprise uncapped launch');
  store.setItem(SETTINGS_PREF, JSON.stringify({ Video: { TargetFrameRate: '300' } }));
  assert.equal(savedVSync(root), true, 'a cap alone does not lift the wait - VSync decides, as in DFU');
  // ONE file read at launch, no store built - the save slots are never listed (AUDIT 28e: 22 ms at 300 slots, before
  // the single-instance lock). fileStorage.cjs's readPref, the store's own spelling of the pref's file.
  const fs = require('node:fs');
  const listed = fs.readdirSync;
  let lists = 0;
  fs.readdirSync = (...a) => { lists++; return listed(...a); };
  try { savedVSync(root); } finally { fs.readdirSync = listed; }
  assert.equal(lists, 0);
});

test('FPS-VSYNC: in the app VSync is a real setting read at the next start; in a browser it stays unavailable', () => {
  const k = 'Video/VSync';
  assert.equal(SHELL_AT_LAUNCH[k], 'app/lib/frameRate.cjs');
  assert.equal(tierOf(k), 'unavailable', 'no shell: the browser always waits');
  shell();
  assert.equal(tierOf(k), 'restart');
  assert.equal(widgetFor(k), 'switch', 'a switch, not the blocked readout');
  assert.equal(formatValue(k, 'True'), 'On');
  assert.equal(TIER_TEXT.restart, 'Takes effect the next time the app starts.');
  assert.equal(tierOf('Video/TargetFrameRate'), 'live', 'the cap itself is live everywhere');
  // Its dot is the live colour as a ring - not the stored tier's grey (AUDIT 28e).
  const css = ENHANCED_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const at = css.indexOf('.tier.restart {');
  assert.ok(at >= 0, 'the restart tier has a dot of its own');
  assert.match(css.slice(at, css.indexOf('}', at)), /var\(--verdigris\)/);
});

test('FPS-VSYNC by source: the shell asks before the app is ready, over the page\'s own key; the screen draws the row with the live ones', () => {
  // Pins read CODE (test/codeOnly.mjs): a line reverted and kept as a comment beside its old self fails them.
  const main = read('app/main.cjs');
  const from = main.indexOf("\nif (process.env.DAGGER_USER_DATA) app.setPath('userData'"), to = main.indexOf('\napp.whenReady()');
  assert.ok(from > 0 && to > from, 'the storage root is pinned, then the app is readied');
  codeHasOnce(main.slice(from, to), /\nfor \(const s of FRAME_SWITCHES\) app\.commandLine\.appendSwitch\(s\);/,
    'after the storage root is pinned and before the app is ready - Chromium reads its switches at launch');
  assert.match(read('src/systems/settings.js'), new RegExp(`\\nconst STORAGE_KEY = '${SETTINGS_PREF.replace(/\./g, '\\.')}';`), 'the key the page saves under');
  const menu = read('src/ui/enhancedMenu.js');
  const lineOf = (head) => { const at = menu.indexOf(head); assert.ok(at >= 0, head); return menu.slice(at, menu.indexOf('\n', at)); };
  const fnOf = (head) => { const at = menu.indexOf(head); assert.ok(at >= 0, head); return menu.slice(at, menu.indexOf('\n}\n', at) + 3); };
  codeHasOnce(lineOf('function drawsFlat(key) {'), /function drawsFlat\(key\) \{ const t = tierOf\(key\); return t === 'live' \|\| t === 'restart'; \}/);
  // ORG2: one screen draws every tab, the pause window's too - a key draws where drawsHere says, flat with the live ones
  codeHasOnce(lineOf('const drawsHere = (key, pause) =>'), /const drawsHere = \(key, pause\) => \(pause \? tierOf\(key\) === 'live' : drawsFlat\(key\)\);/, 'the pause window keeps to what applies at once');
  codeHasOnce(fnOf('function itemNodes(item, ctx) {'), /if \(!drawsHere\(item, pause\)\) \{/);
  codeHasOnce(fnOf('function tabCount(tab, ctx) {'), /if \(isSettingItem\(item\)\) \{ if \(!featureForControl\('settings', item\) && drawsHere\(item, ctx\.pause\)\) n\+\+; \}/, 'the sub-rail counts what is drawn');
});

// THE PACER (AUDIT 28e, the frame lane: "with VSync off, the Frame Rate Cap cannot hold frames above the screen"). A
// clock of the test's own over the mechanism the lane measured in the app: with the wait lifted, a browser frame that
// draws nothing costs a whole refresh (the next one waits for the screen's next tick), and one that draws answers the
// next ask half a millisecond after it is made.
function liftedBrowser(refresh = 1000 / 60) {
  let t = 0, asked = null, drewLast = true, nextId = 1;
  const timers = [];
  const b = {
    now: () => t,
    raf: (cb) => { asked = { cb, at: t, id: nextId++ }; return asked.id; },
    caf: (id) => { if (asked?.id === id) asked = null; },
    later: (fn, ms) => { timers.push({ fn, at: t + ms }); timers.sort((x, y) => x.at - y.at); },
    drew: () => { b.drawn = true; },
    drawn: false,
    /** Run the clock to `until`, one event at a time: the next timer or the next browser frame. */
    runUntil(until) {
      let frames = 0, drawnFrames = 0;
      for (;;) {
        const frameAt = asked ? (drewLast ? asked.at + 0.5 : Math.ceil((asked.at + 1e-9) / refresh) * refresh) : Infinity;
        const timerAt = timers.length ? timers[0].at : Infinity;
        const at = Math.min(frameAt, timerAt);
        if (at > until) return { frames, drawnFrames };
        t = at;
        if (timerAt <= frameAt) { timers.shift().fn(); continue; }
        const { cb } = asked; asked = null;
        b.drawn = false;
        cb(t);
        frames++;
        if (b.drawn) drawnFrames++;
        drewLast = b.drawn;
      }
    },
  };
  return b;
}
/** A host's loop, in the hosts' own shape (the gate first; a held frame re-arms and returns). */
function hostLoop(ask, gate, drew) {
  const frame = (now) => { if (gate(now)) { ask(frame); return; } drew(); ask(frame); };
  ask(frame);
}

test('FPS-VSYNC: with the wait lifted, the gate alone draws the screen\'s rate whatever the cap - the pacer draws the cap', () => {
  for (const fps of [144, 240, 300]) {
    // As shipped in the batch: rAF straight to the browser, the gate holding frames - every held one a refresh.
    const raw = liftedBrowser();
    const state = { due: 0, at: -1, held: false };
    hostLoop(raw.raf, (now) => capStep(state, now, fps), raw.drew);
    const before = raw.runUntil(1000);
    assert.ok(before.drawnFrames <= 62, `cap ${fps}: the gate alone drew ${before.drawnFrames} (the lane measured 54-57)`);
    // Paced: the ask waits for its slot, the answer IS the slot.
    const b = liftedBrowser();
    const st = { due: 0, at: -1, held: false };
    const pacer = createFramePacer({ raf: b.raf, caf: b.caf, later: b.later, now: b.now, fps: () => fps, take: (s) => capTake(st, s, fps), due: () => st.due });
    hostLoop((cb) => pacer.request(cb), (now) => capStep(st, now, fps), b.drew);
    const after = b.runUntil(1000);
    assert.ok(Math.abs(after.drawnFrames - fps) <= 2, `cap ${fps}: paced, ${after.drawnFrames} drawn`);
    assert.equal(after.frames, after.drawnFrames, 'and no browser frame goes by without drawing');
  }
});

test('FPS-VSYNC: the pacer - one browser frame a slot and one stamp for every ask in it, a throw its own, a cancel, the cap Off straight through', () => {
  const b = liftedBrowser();
  const st = { due: 0, at: -1, held: false };
  let fps = 100;
  const errors = [];
  const pacer = createFramePacer({ raf: b.raf, caf: b.caf, later: b.later, now: b.now, fps: () => fps, take: (s) => capTake(st, s, fps), due: () => st.due, report: (e) => errors.push(e.message) });
  const seen = [];
  pacer.request((t) => { b.drew(); seen.push(['host', t]); });
  pacer.request(() => { throw new Error('a window\'s one-off'); });
  const gone = pacer.request((t) => seen.push(['cancelled', t]));
  pacer.request((t) => { seen.push(['counter', t]); pacer.request((t2) => { b.drew(); seen.push(['next slot', t2]); }); });
  pacer.cancel(gone);
  b.runUntil(1);
  assert.deepEqual(seen, [['host', 0.5], ['counter', 0.5]], 'one frame, one stamp for all; the cancelled one never ran');
  assert.deepEqual(errors, ["a window's one-off"], 'a throw is reported and the rest still ran');
  assert.equal(capStep(st, 0.5, fps), false, 'the host\'s own question for that stamp reads "drawn"');
  b.runUntil(20);
  // the slot is 10.5 (0.5 + a 100 cap's 10 ms): asked for PACER_LEAD_MS early, answered half a millisecond later
  assert.deepEqual(seen.at(-1), ['next slot', 10.5 - PACER_LEAD_MS + 0.5], 'an ask made in the frame waits for the next slot, asked for early');
  assert.equal(capStep(st, 10.5 - PACER_LEAD_MS + 0.5, fps), false, 'and that early stamp is the slot - drawn, not held (a held one costs a refresh)');
  assert.equal(st.due, 20.5, 'the next booked from the slot, not the stamp: the cadence is the cap\'s');
  // The cap Off: every ask is the browser's at once - DFU's VSync off with no target, as fast as it goes - even with a
  // slot still booked from the cap before (20.5).
  fps = 0;
  const at = [], asked = b.now();
  assert.ok(st.due - PACER_LEAD_MS > asked, 'a slot still booked ahead');
  pacer.request((t) => at.push(t));
  b.runUntil(21);
  assert.deepEqual(at, [asked + 0.5], 'no timer between the ask and the frame');
});

test('FPS-VSYNC: the pacer stands in front of the page\'s rAF only where the shell lifted the wait at launch', () => {
  const page = (lifted) => {
    const calls = [];
    const win = {
      daggerShell: lifted == null ? undefined : { framesLifted: lifted },
      requestAnimationFrame: (cb) => { calls.push(cb); return 7; }, cancelAnimationFrame: () => {},
      setTimeout: (fn) => fn(), performance: { now: () => 0 },
    };
    return { win, calls };
  };
  const browser = page(null), vsyncOn = page(false), lifted = page(true);
  assert.equal(installFramePacer(browser.win), false, 'a browser: the screen waits, the gate holds frames as ever');
  assert.equal(installFramePacer(vsyncOn.win), false, 'the app with VSync on: likewise');
  const raf = lifted.win.requestAnimationFrame;
  assert.equal(installFramePacer(lifted.win), true);
  assert.notEqual(lifted.win.requestAnimationFrame, raf, 'the page\'s rAF is the pacer\'s');
  assert.equal(installFramePacer(lifted.win), false, 'once');
  _resetFrameCap();
  assert.equal(typeof frameCapSkip, 'function');
  // ...told by the shell what THIS launch runs with, not what the setting says now (the settings screen's "next start").
  const main = read('app/main.cjs');
  const from = main.indexOf("\nif (process.env.DAGGER_USER_DATA) app.setPath('userData'"), to = main.indexOf('\napp.whenReady()');
  codeHasOnce(main.slice(from, to), /\nconst FRAME_SWITCHES = frameRateSwitches\(app\.getPath\('userData'\)\);\nfor \(const s of FRAME_SWITCHES\) app\.commandLine\.appendSwitch\(s\);/);
  codeHasOnce(main.slice(from), /ipcMain\.on\('dagger:frames-lifted', \(e\) => \{ e\.returnValue = FRAME_SWITCHES\.length > 0; \}\);/);
  codeHasOnce(read('app/preload.cjs'), /framesLifted: ipcRenderer\.sendSync\('dagger:frames-lifted'\) === true,/);
  const boot = read('src/main.js');
  const at = boot.indexOf('async function boot() {');
  codeHasOnce(boot.slice(at, boot.indexOf('\n', boot.indexOf('\n', at) + 1)), /installFramePacer\(\);/, 'the first thing boot does, before any loop asks for a frame');
});
