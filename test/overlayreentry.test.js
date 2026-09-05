// THE CRASH OF 2026-08-29 — "InternalError: too much recursion", fifty
// frames of closeOverlay -> onClose -> _close -> dispose -> closeOverlay
// off the live site, and every close path of the rest window reached it.
//
// TWO HALVES, PINNED APART, because either alone stops the crash and
// leaving the other broken leaves the next window to find it:
//
//   THE HOST'S ORDER. Every drain disposed the occupant and cleared the
//   slot AFTER. `dispose()` runs host code - S40 made that reachable on
//   purpose, so a window can vacate the slot before handing control on
//   (DFU's PopToHUD runs before RaiseSkills, and the level-up screen
//   needs the slot free). So the re-entrant close read a slot still
//   pointing at the window being disposed, and disposed it again.
//
//   THE WINDOW'S DISPATCH. RestWindow._close is deliberately unguarded
//   on `done` - clearing a boolean twice is clearing it once - but it
//   also fires `onClose`, and firing THAT twice is a second PopToHUD.
//
// These are behaviour pins, not source sweeps: the slot is a closure
// and the window is a plain class, so the whole loop reproduces in Node
// with no GL and no ARENA2. The repro is ten lines and it is the test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { RestWindow } from '../src/ui/restWindow.js';
import { createTownTalk } from '../src/scenes/townTalk.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

/** The host slot in the shape townTalk.dropOverlay now has it: the slot
 *  is emptied BEFORE the window is told. */
function hostSlot() {
  let overlay = null;
  const host = {
    closes: 0,
    show(w) { overlay = w; },
    get current() { return overlay; },
    close(win = null) {
      if (!overlay || (win && overlay !== win)) return false;
      const w = overlay;
      overlay = null;      // ← the law
      w.dispose?.();
      host.closes++;
      return true;
    },
  };
  return host;
}

/** A rest window wired exactly as exterior.js:1338 and world.js:1944
 *  wire it - the PopToHUD door S40 opened. */
function restWindowOn(host, over = {}) {
  const win = new RestWindow({
    onClose: () => { if (host.current?.isRestWindow) host.close?.(); },
    endLines: () => ['finished'],
    ...over,
  });
  host.show(win);
  return win;
}

// Every door that closes a rest window, named from restWindow.js's own
// _close call sites (:176 refusal, :213 refused page, :226 ended page,
// :241 selection back, :337 the click) plus the host closing the slot.
const DOORS = {
  'the ended page, on a key': (w) => { w.state = 'ended'; w.input('confirm'); },
  'the ended page, on a click': (w) => { w.state = 'ended'; w.click?.(0, 0); },
  'the refusal page': (w) => { w.state = 'refused'; w.input('confirm'); },
  // ROAD-E E1: the selection page's Esc is GetBackButtonUp() (Update
  // :193), so backing out is a RELEASE - and the release drain is the
  // same re-entrancy hazard the press drain was. Both edges, because
  // the door carries DaggerfallAutomapWindow.cs:703-713's deferral (the
  // port opens on the press where DFU opens on ActionComplete).
  'backing out of the selection page': (w) => { w.state = 'selection'; w.input('back'); w.keyup('back'); },
  'the host closing the slot': (w, h) => { h.close(); },
  'the host disposing the window': (w) => { w.dispose(); },
};

test('CRASH 2026-08-29: no close path of the rest window recurses', () => {
  for (const [name, open] of Object.entries(DOORS)) {
    const host = hostSlot();
    const win = restWindowOn(host);
    // The bug threw RangeError/InternalError here. assert.doesNotThrow
    // would pass on a window that quietly did nothing, so the state is
    // asserted below too.
    open(win, host);
    assert.equal(win.done, true, `${name}: the window did not close`);
    assert.equal(host.current, null, `${name}: the slot still holds the closed window`);
  }
});

test('CRASH 2026-08-29: PopToHUD still happens, and happens ONCE', () => {
  // The fix must not buy safety by dropping the callback: S40's whole
  // reason for the door is that the slot must be FREE before the window
  // hands control on, or advancement.js takes its headless arm and
  // dumps every point into the LOWEST stats (the AUDIT 21 F3 defect).
  for (const [name, open] of Object.entries(DOORS)) {
    const host = hostSlot();
    let fired = 0;
    const win = restWindowOn(host, {
      onClose: () => { fired++; if (host.current?.isRestWindow) host.close?.(); },
    });
    open(win, host);
    assert.equal(fired, 1, `${name}: onClose fired ${fired} times, owed exactly one`);
    assert.equal(host.current, null, `${name}: the slot is not free for a level-up screen`);
  }
});

test('CRASH 2026-08-29: the window half holds even against the OLD host order', () => {
  // Defence in depth, stated as a test rather than as a hope: a host
  // that still disposes before clearing (the shape every drain had
  // yesterday, and the shape a new host will reach for) must not be
  // able to spin this window. This is the half that lives in
  // restWindow.js, and it is pinned against the broken caller on
  // purpose - remove it and this test recurses again.
  let overlay = null;
  const badClose = () => {
    if (!overlay) return false;
    overlay.dispose?.();   // ← the old order, deliberately
    overlay = null;
    return true;
  };
  const win = new RestWindow({
    onClose: () => { if (overlay?.isRestWindow) badClose(); },
    endLines: () => ['finished'],
  });
  overlay = win;
  win.state = 'ended';
  win.input('confirm');
  assert.equal(win.done, true);
});

test('CRASH 2026-08-29: the host half holds even against a window that re-dispatches', () => {
  // The other side of the same coin: a window with NO dispatch guard at
  // all (every other window in the tree is one) must not be able to
  // spin the host. This is the half that lives in townTalk.dropOverlay.
  const host = hostSlot();
  let fired = 0;
  const naive = {
    done: false,
    isRestWindow: true,
    _close() { this.done = true; fired++; if (host.current?.isRestWindow) host.close?.(); },
    dispose() { this._close(); },
  };
  host.show(naive);
  host.close();
  assert.equal(fired, 1, 'the naive window re-entered the host');
  assert.equal(host.current, null);
});

test('CRASH 2026-08-29: every drain in the talk host empties the slot before disposing', () => {
  // A source sweep on top of the behaviour pins, because the behaviour
  // pins can only reach the drains a headless test can drive. The rule
  // is mechanical and greppable: in townTalk.js, nothing may call
  // dispose on the overlay slot except the one drain that owns it.
  const text = src('src/scenes/townTalk.js');
  const disposes = [...text.matchAll(/^.*overlay\??\.dispose\?\.\(\).*$/gm)].map((m) => m[0].trim());
  assert.deepEqual(disposes, [],
    `townTalk.js disposes the overlay slot outside dropOverlay:\n  ${disposes.join('\n  ')}`);
  // ...and the drain itself must null the slot before the dispose. The
  // order is the whole fix, so it is read in order rather than asserted
  // as two facts that could be true in either sequence.
  const drain = text.match(/function dropOverlay\([\s\S]*?\n {2}}/)?.[0];
  assert.ok(drain, 'townTalk.js lost dropOverlay');
  assert.ok(drain.indexOf('overlay = null') < drain.indexOf('win.dispose'),
    'dropOverlay disposes the window before it empties the slot - the crash is back');
});

// ---------------------------------------------------------------------------
// AND THE REAL HOST, not a stand-in.
//
// The pins above hold the LAW against a slot shaped like townTalk's. They
// cannot fail for a drain that stops draining, or for a callback the real
// module drops - a stand-in host proves the rule, not the caller. `createTownTalk`
// builds with no GL and no ARENA2 (nothing loads until `ensureLoaded`), and the
// overlay slot is plain closure state, so the real drains are drivable here.
// ---------------------------------------------------------------------------

const talkHost = () => createTownTalk({
  renderer: { uploadTexture: () => ({}) },
  canvas: { width: 640, height: 400 },
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
});
const fakeWindow = (over = {}) => ({
  done: false, disposed: 0, dispose() { this.disposed++; }, ...over,
});

test('CRASH 2026-08-29: the real talk host drains, disposes once, and owes the callback once', () => {
  // closeOverlay
  {
    const tt = talkHost();
    let closed = 0;
    const win = fakeWindow();
    tt.showOverlay(win, () => closed++);
    assert.equal(tt.closeOverlay(), true);
    assert.equal(win.disposed, 1, 'the occupant was not disposed');
    assert.equal(closed, 1, 'the close callback was dropped');
    assert.equal(tt.overlay, null, 'the slot still holds the closed window');
    assert.equal(tt.closeOverlay(), false, 'an empty slot reported a close');
    assert.equal(win.disposed, 1, 'the empty slot disposed the window again');
  }
  // the KEY drain - a window that finishes inside its own input
  {
    const tt = talkHost();
    let closed = 0;
    const win = fakeWindow({ isChoiceWindow: true, input() { this.done = true; } });
    tt.showOverlay(win, () => closed++);
    assert.equal(tt.keydown({ code: 'Escape', preventDefault() {} }), true);
    assert.equal(win.disposed, 1, 'the key drain stopped draining');
    assert.equal(closed, 1);
    assert.equal(tt.overlay, null);
  }
  // showOverlay replacing an occupant
  {
    const tt = talkHost();
    const outgoing = fakeWindow();
    const successor = fakeWindow();
    tt.showOverlay(outgoing);
    tt.showOverlay(successor);
    assert.equal(outgoing.disposed, 1, 'the replaced window leaked - it holds GL resources');
    assert.equal(successor.disposed, 0, 'the successor was disposed on arrival');
    assert.equal(tt.overlay, successor);
  }
});

test('CRASH 2026-08-29: the real talk host survives a window that closes it from inside dispose', () => {
  // This is the crash itself, against the real module: RestWindow's
  // PopToHUD door, reduced to the one line that matters.
  const tt = talkHost();
  let depth = 0, deepest = 0;
  const win = fakeWindow({
    isRestWindow: true,
    dispose() {
      depth++; deepest = Math.max(deepest, depth);
      if (tt.overlay?.isRestWindow) tt.closeOverlay?.();   // exterior.js:1338, world.js:1944
      depth--;
    },
  });
  tt.showOverlay(win);
  tt.closeOverlay();
  assert.equal(deepest, 1, `dispose re-entered ${deepest} deep - the recursion is back`);
  assert.equal(tt.overlay, null);
});
