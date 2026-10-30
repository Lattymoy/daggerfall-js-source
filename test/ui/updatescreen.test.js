// UPDATE-FORCE (2026-10-29, the owner: "when theres an update we need a screen that forces player to logout and
// update /reload"). The phase law, then the run driven over a fake page: the warning, the hold, the screen that
// takes the keys, the save before the reload, the guard stood down, and one run however many builds are found.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  updatePhase, countdownOf, startForcedUpdate, resetForcedUpdate, forcedUpdateRunning, updateAppNoticeText, pollForUpdate, autoUpdatesOn, updateReadyNoticeText,
  UPDATE_WARN_MS, UPDATE_SCREEN_MS, UPDATE_HOLD_MAX_MS, UPDATE_SCREEN_ID, UPDATE_BANNER_ID,
} from '../../src/ui/updateScreen.js';
import { BUILD_UPDATE_TEXT, BUILD_POLL_MS, resetUpdateNotice } from '../../src/net/updateNotice.js';
import { getPref, setPref, _resetForTests as resetPrefsForTests } from '../../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS } from '../../src/systems/online/onlineLane.js';
import { forceShellUpdates, resetShellUpdates, shellRestartsFor } from '../../src/systems/shellUpdates.js';
import { armUnloadGuard, unloadGuardArmed, resetUnloadGuard } from '../../src/systems/unloadGuard.js';

function fakeNode(tag) {
  const n = {
    tag, id: '', type: '', textContent: '', style: { cssText: '' }, children: [], parent: null, listeners: {}, focused: false,
    append(...kids) { for (const k of kids) { k.parent = n; n.children.push(k); } },
    remove() { if (n.parent) n.parent.children = n.parent.children.filter((c) => c !== n); n.parent = null; },
    addEventListener(type, fn) { (n.listeners[type] ??= []).push(fn); },
    focus() { n.focused = true; },
  };
  return n;
}
const find = (n, id) => (n.id === id ? n : n.children.map((c) => find(c, id)).find(Boolean) ?? null);
const all = (n) => [n, ...n.children.flatMap(all)];

function fakePage() {
  const body = fakeNode('body');
  const doc = { body, createElement: fakeNode, exitedLock: 0, exitPointerLock() { doc.exitedLock++; } };
  const win = {
    document: doc, ticks: [], keyListeners: [], reloads: 0,
    setInterval(fn) { win.ticks.push(fn); return 1; }, clearInterval() { win.ticks = []; },
    addEventListener(type, fn, capture) { win.keyListeners.push({ type, fn, capture }); },
  };
  return { doc, win, body };
}

beforeEach(() => { resetForcedUpdate(); resetUnloadGuard(); });

test('UPDATE-FORCE: the phase law - a minute of warning, a hold while busy that has a ceiling, then the screen and the go', () => {
  const run = { startedAt: 0 };
  assert.equal(updatePhase(run, 0, false), 'warn');
  assert.equal(updatePhase(run, UPDATE_WARN_MS - 1, true), 'warn', 'a death or duel does not stretch the warning itself');
  assert.equal(updatePhase(run, UPDATE_WARN_MS, false), 'screen');
  assert.equal(updatePhase(run, UPDATE_WARN_MS, true), 'hold');
  assert.equal(updatePhase({ startedAt: 0, holdSince: UPDATE_WARN_MS }, UPDATE_WARN_MS + UPDATE_HOLD_MAX_MS - 1, true), 'hold');
  assert.equal(updatePhase({ startedAt: 0, holdSince: UPDATE_WARN_MS }, UPDATE_WARN_MS + UPDATE_HOLD_MAX_MS, true), 'screen', 'a hold never traps: the ceiling ends it');
  assert.equal(updatePhase({ startedAt: 0, screenAt: 70_000 }, 70_000 + UPDATE_SCREEN_MS - 1, true), 'screen', 'once up, the screen ignores busy');
  assert.equal(updatePhase({ startedAt: 0, screenAt: 70_000 }, 70_000 + UPDATE_SCREEN_MS, false), 'go');
  assert.equal(UPDATE_WARN_MS, 60_000, 'the owner\'s minute');
  assert.ok(BUILD_POLL_MS <= 2 * 60_000, 'the poll finds a build within two minutes');
});

test('UPDATE-FORCE: the clock reads m:ss and never 0:00 while time is left', () => {
  assert.equal(countdownOf(60_000), '1:00');
  assert.equal(countdownOf(58_200), '0:59');
  assert.equal(countdownOf(1), '0:01');
  assert.equal(countdownOf(0), '0:00');
  assert.equal(countdownOf(-50), '0:00');
});

test('UPDATE-FORCE: a run warns, holds, shows the screen, saves, stands the guard down and reloads - once', () => {
  const { doc, win, body } = fakePage();
  let now = 1000;
  let busy = false;
  const notices = [];
  let saves = 0;
  let reloads = 0;
  armUnloadGuard(() => true, { addEventListener() {} });
  const opts = { notice: (s) => notices.push(s), save: () => { saves++; }, busy: () => busy, reload: () => { reloads++; }, doc, win, now: () => now };
  assert.equal(startForcedUpdate(opts), true);
  assert.equal(startForcedUpdate(opts), false, 'a second build found while counting down changes nothing');
  assert.ok(forcedUpdateRunning());
  assert.deepEqual(notices, [BUILD_UPDATE_TEXT], 'one chat line');
  const tick = () => win.ticks[0]?.();
  assert.match(find(body, UPDATE_BANNER_ID).textContent, /1:00/);
  now += 30_000; tick();
  assert.match(find(body, UPDATE_BANNER_ID).textContent, /0:30/);
  busy = true; now += 30_000; tick();
  assert.match(find(body, UPDATE_BANNER_ID).textContent, /fight or death screen/, 'held while busy, and says why');
  assert.equal(find(body, UPDATE_SCREEN_ID), null);
  busy = false; now += 1000; tick();
  assert.equal(find(body, UPDATE_BANNER_ID), null, 'the banner gives way to the screen');
  const screen = find(body, UPDATE_SCREEN_ID);
  assert.ok(screen, 'the screen is up');
  assert.equal(saves, 1, 'saved as the screen goes up');
  assert.equal(doc.exitedLock, 1, 'the mouse let go, so the button can be pressed');
  assert.deepEqual(win.keyListeners.map((l) => [l.type, l.capture]), [['keydown', true], ['keyup', true], ['keypress', true]], 'the keys are the screen\'s');
  const e = { target: {}, stopped: false, prevented: false, stopImmediatePropagation() { e.stopped = true; }, preventDefault() { e.prevented = true; } };
  win.keyListeners[0].fn(e);
  assert.ok(e.stopped && e.prevented, 'a key never reaches the game under the screen');
  const button = all(screen).find((n) => n.tag === 'button');
  assert.ok(button.focused);
  assert.equal(unloadGuardArmed(), true);
  now += UPDATE_SCREEN_MS; tick();
  assert.equal(reloads, 1);
  assert.equal(unloadGuardArmed(), false, 'no "Leave site?" between the player and the new build');
  tick(); button.listeners.click[0]();
  assert.equal(reloads, 1, 'reloads once');
});

test('UPDATE-FORCE: Reload Now goes at once; a busy that throws counts as not busy', () => {
  const { doc, win, body } = fakePage();
  let now = 0;
  let reloads = 0;
  startForcedUpdate({ busy: () => { throw new Error('no host yet'); }, reload: () => { reloads++; }, doc, win, now: () => now });
  now = UPDATE_WARN_MS; win.ticks[0]();
  const button = all(find(body, UPDATE_SCREEN_ID)).find((n) => n.tag === 'button');
  button.listeners.click[0]();
  assert.equal(reloads, 1);
});

test('UPDATE-FORCE: the host starts it where the build poll finds a new build, with the online save and the death and duel hold', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  // PIN MOVED (UPDATE-RESTART): the host hands its save and hold to the poll, which starts the run (ui/updateScreen.js pollForUpdate)
  assert.match(w, /pollForUpdate\(\{ notice: chatNotice, save: onlineCheckpoint, busy: \(\) => !!duelMgr\?\.duel \|\| townTalk\.overlay instanceof DeathScreen \|\| !!modes\?\.deathUp\?\.\(\) \|\| successionOpen\(\) \}\);/);
  const u = readFileSync(new URL('../../src/ui/updateScreen.js', import.meta.url), 'utf8');
  // PIN MOVED (AUTO-UPDATE): the run with the player's switch on, the notice without
  assert.match(u, /buildUpdateSeen\(tag, BUILD_TAG\) === 'changed' && \(autoUpdatesOn\(\) \? startForcedUpdate\(opts\) : opts\.notice\?\.\(updateReadyNoticeText\(\)\)\)/);
});

// UPDATE-RESTART (2026-10-30, the owner: "we should close the desktop app instead of reload it does not update" / "make
// sure it updates"): in the desktop app the countdown is the app's update's, and its end restarts the app onto it.
test('UPDATE-RESTART: the app\'s run says the app restarts, and its end is the restart it is handed', () => {
  const { doc, win, body } = fakePage();
  let now = 0;
  let restarts = 0;
  const notices = [];
  startForcedUpdate({ app: true, notice: (s) => notices.push(s), reload: () => { restarts++; }, doc, win, now: () => now });
  assert.deepEqual(notices, [updateAppNoticeText()]);
  assert.match(find(body, UPDATE_BANNER_ID).textContent, /The app restarts in 1:00/);
  now = UPDATE_WARN_MS; win.ticks[0]();
  const screen = find(body, UPDATE_SCREEN_ID);
  const texts = all(screen).map((n) => n.textContent).join('|');
  assert.match(texts, /Restarting the app/);
  assert.match(texts, /closes, updates and opens again/);
  assert.doesNotMatch(texts, /Reload/, 'nothing in the app says reload');
  assert.equal(all(screen).find((n) => n.tag === 'button').textContent, 'Restart Now');
  now += UPDATE_SCREEN_MS; win.ticks[0]();
  assert.equal(restarts, 1);
});

test('UPDATE-RESTART: the app\'s update starts the run once it can be put in place - not a manual one, not in a browser, not in an old shell', () => {
  resetShellUpdates();
  assert.equal(forceShellUpdates(undefined, () => {}), false, 'a browser tab has no shell');
  assert.equal(forceShellUpdates({ onUpdateReady() {} }, () => {}), false, 'a shell too old to restart');
  let fire = null;
  const shell = { onUpdateReady: (cb) => { fire = cb; }, restartForUpdate() {} };
  const started = [];
  assert.equal(forceShellUpdates(shell, (info) => started.push(['a', info.version])), true);
  fire({ version: '0.1.9000', manual: true });
  assert.deepEqual(started, [], 'a copy that updates by hand keeps its HUD line');
  fire({ version: '0.1.9001', manual: false });
  assert.deepEqual(started, [['a', '0.1.9001']]);
  let subs = 0;
  shell.onUpdateReady = () => { subs++; };
  assert.equal(forceShellUpdates(shell, (info) => started.push(['b', info.version])), true);
  assert.equal(subs, 0, 'one subscription');
  assert.deepEqual(started.at(-1), ['b', '0.1.9001'], 'a host that comes later hears the update already here');
  assert.equal(shellRestartsFor(shell, { version: '1.0.0' }), true);
  assert.equal(shellRestartsFor({}, { version: '1.0.0' }), false);
  resetShellUpdates();
});

test('UPDATE-RESTART: the host starts the app\'s run with the same save and hold, ended by the shell\'s restart; the shell quits and starts again', () => {
  const u = readFileSync(new URL('../../src/ui/updateScreen.js', import.meta.url), 'utf8');
  // PIN MOVED (AUTO-UPDATE): and only with the player's switch on
  assert.match(u, /forceShellUpdates\(shell, \(\) => autoUpdatesOn\(\) && startForcedUpdate\(\{ \.\.\.opts, app: true, reload: \(\) => shell\.restartForUpdate\(\) \}\)\);/, 'the same save and hold as the browser\'s run');
  const pre = readFileSync(new URL('../../app/preload.cjs', import.meta.url), 'utf8');
  assert.match(pre, /restartForUpdate: \(\) => ipcRenderer\.send\('dagger:restart-for-update'\)/);
  const main = readFileSync(new URL('../../app/main.cjs', import.meta.url), 'utf8');
  const fn = main.slice(main.indexOf('function restartForUpdate()'), main.indexOf('/** A box over the window the player is looking at'));
  assert.match(fn, /if \(updateReady\?\.game\) \{[^}]*app\.relaunch\(\{ args: \[\.\.\.process\.argv\.slice\(1\)\.filter\(\(a\) => a !== PLAY_SWITCH\), PLAY_SWITCH\] \}\);\s*app\.quit\(\);/, 'a channel version: quit and start again, straight into the game');
  assert.match(fn, /currentUpdateTransport\(\) === 'updater'\) \{ installNow\(updateReady\.version\); return; \}/, 'an installer: it runs and reopens the app');
  assert.match(main, /ipcMain\.on\('dagger:restart-for-update', \(e\) => \{\s*if \(gameWindow && !gameWindow\.isDestroyed\(\) && e\.sender === gameWindow\.webContents\) restartForUpdate\(\);/, 'only the game\'s own window');
});

// AUTO-UPDATE (2026-10-30, the owner: "turn off the automatic updates by default. Im tired of players being forced out of
// the game"): the forced run is the player's switch, off by default.
test('AUTO-UPDATE: off by default - a new build on the site is told once in chat and nothing reloads; switched on, the forced run starts; the app\'s own update the same (mutants: the switch on by default; the switch unread on the site; the switch unread in the app)', async () => {
  resetPrefsForTests();
  assert.equal(getPref('autoUpdates'), false, 'off by default');
  assert.equal(autoUpdatesOn(), false);
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes('autoUpdates'), 'the player\'s own, online too');
  const was = { fetch: globalThis.fetch, location: globalThis.location };
  globalThis.location = { href: 'https://example.test/play/' };
  globalThis.fetch = async () => ({ ok: true, text: async () => '<meta name="build-tag" content="a-newer-build">' });
  try {
    const { doc, win } = fakePage();
    const said = [];
    resetUpdateNotice();
    await pollForUpdate({ notice: (t) => said.push(t), doc, win, reload: () => { win.reloads++; } }, undefined);
    assert.deepEqual(said, [updateReadyNoticeText()], 'told, once');
    assert.equal(forcedUpdateRunning(), false, 'no countdown, no screen');
    await pollForUpdate({ notice: (t) => said.push(t), doc, win }, undefined);
    assert.equal(said.length, 1, 'the same build is not told again');
    // on: the run starts on the next new build
    setPref('autoUpdates', true);
    resetUpdateNotice();
    await pollForUpdate({ notice: (t) => said.push(t), doc, win, reload: () => { win.reloads++; } }, undefined);
    assert.equal(forcedUpdateRunning(), true, 'switched on: the forced run');
    assert.equal(said.at(-1), BUILD_UPDATE_TEXT);
  } finally {
    globalThis.fetch = was.fetch; globalThis.location = was.location;
    resetForcedUpdate(); resetUpdateNotice(); resetShellUpdates(); resetPrefsForTests();
  }
  // the app's own update: heard, it starts the run only with the switch on
  let ready = null;
  const shell = { onUpdateReady(fn) { ready = fn; }, restartForUpdate() {} };
  globalThis.fetch = async () => ({ ok: false });
  try {
    await pollForUpdate({ notice() {}, ...fakePage() }, shell);
    ready({ version: '9.9.9', manual: false });
    assert.equal(forcedUpdateRunning(), false, 'off: the HUD line alone (systems/shellUpdates.js updateReadyText)');
    setPref('autoUpdates', true);
    await pollForUpdate({ notice() {}, ...fakePage() }, shell);
    assert.equal(forcedUpdateRunning(), true, 'on: the app restarts onto it after the minute');
  } finally {
    globalThis.fetch = was.fetch;
    resetForcedUpdate(); resetShellUpdates(); resetPrefsForTests();
  }
});
