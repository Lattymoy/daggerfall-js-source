// UPDATE-FORCE (2026-10-29, the owner: "when theres an update we need a screen that forces player to logout and
// update /reload"). The phase law, then the run driven over a fake page: the warning, the hold, the screen that
// takes the keys, the save before the reload, the guard stood down, and one run however many builds are found.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  updatePhase, countdownOf, startForcedUpdate, resetForcedUpdate, forcedUpdateRunning,
  UPDATE_WARN_MS, UPDATE_SCREEN_MS, UPDATE_HOLD_MAX_MS, UPDATE_SCREEN_ID, UPDATE_BANNER_ID,
} from '../../src/ui/updateScreen.js';
import { BUILD_UPDATE_TEXT, BUILD_POLL_MS } from '../../src/net/updateNotice.js';
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
  assert.match(w, /buildUpdateSeen\(tag, BUILD_TAG\) === 'changed'\) startForcedUpdate\(\{ notice: chatNotice, save: onlineCheckpoint, busy: \(\) => !!duelMgr\?\.duel \|\| townTalk\.overlay instanceof DeathScreen \|\| !!modes\?\.deathUp\?\.\(\) \|\| successionOpen\(\) \}\)/);
});
