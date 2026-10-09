// FIELD BUGS 2026-10-09c - TOUCH-UNLOCK, the Discord's "Touching anywhere onscreen in mobile opens the system menu"
// (Firefox and Waterfox on Android; replicated on Fennec/Ironfox, "The game does work on Chrome").
//
// Gecko grants a tap's pointer lock (a tap is a user activation) and ends ANY lock on the next touch event
// (PresShell.cpp, PointerLockManager::Unlock("TouchEvent")), posting the pointerlockchange after that touch's own
// dispatch. ESC-LOCK reads a lock the page did not release, lost with nothing up, as the Escape the browser swallowed -
// so every tap opened the pause, and the pause's close relocked for the next tap to end. Blink never ends a lock on a
// touch. A loss within TOUCH_UNLOCK_MS of a touch event is the finger's now (player/pointerLock.js bindCursorToggle),
// and a loss with no touch near is still the player's Escape. `01-Overview/Field-Bugs-2026-10-09c.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindCursorToggle, ESCAPE_DELIVERY_MS, TOUCH_UNLOCK_MS } from '../src/player/pointerLock.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = () => wait(ESCAPE_DELIVERY_MS + 250);   // a loaded runner's timers run late; the margin is the pin's

/** esclock.test.js's document, with the touch listeners it never needed. */
function rig() {
  const saved = { add: globalThis.addEventListener, remove: globalThis.removeEventListener, doc: globalThis.document, hadDoc: 'document' in globalThis, KE: globalThis.KeyboardEvent };
  const winL = []; const docL = [];
  const delivered = [];
  const canvas = { requestPointerLock() {} };
  const cap = (o) => (typeof o === 'object' && o ? !!o.capture : !!o);
  const doc = {
    pointerLockElement: null, visibilityState: 'visible',
    hasFocus() { return true; },
    addEventListener(type, fn, o) { docL.push({ type, fn, capture: cap(o) }); },
    removeEventListener(type, fn, o) { const i = docL.findIndex((l) => l.type === type && l.fn === fn && l.capture === cap(o)); if (i >= 0) docL.splice(i, 1); },
    dispatchEvent(e) { delivered.push(`${e.type}:${e.code}`); for (const l of docL.filter((x) => x.type === e.type)) l.fn(e); return true; },
    change() { for (const l of docL.filter((x) => x.type === 'pointerlockchange')) l.fn({ type: 'pointerlockchange' }); },
  };
  globalThis.document = doc;
  globalThis.addEventListener = (type, fn, capture) => { winL.push({ type, fn, capture: !!capture }); };
  globalThis.removeEventListener = (type, fn, capture) => { const i = winL.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture); if (i >= 0) winL.splice(i, 1); };
  globalThis.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); this.isTrusted = false; } };
  return {
    canvas, doc, delivered, docL,
    lock() { doc.pointerLockElement = canvas; doc.change(); },
    lose() { doc.pointerLockElement = null; doc.change(); },
    /** a touch event on the document, as Gecko dispatches it before posting its unlock */
    touch(type) { for (const l of docL.filter((x) => x.type === type)) l.fn({ type }); },
    restore() {
      globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.remove; globalThis.KeyboardEvent = saved.KE;
      if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    },
  };
}
const actions = () => [];

test('TOUCH-UNLOCK: a lock a touch event ended is the finger\'s - no Escape, no pause - for every touch type, and a touch that lands between the loss and the delivery holds it too', async () => {
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    const r = rig();
    try {
      const off = bindCursorToggle(r.canvas, () => false, actions);
      r.lock();
      r.touch(type);   // Gecko: Unlock("TouchEvent") runs, the touch dispatches, then the change
      r.lose();
      await settle();
      assert.deepEqual(r.delivered, [], `a ${type} ended the lock`);
      off();
    } finally { r.restore(); }
  }
  const r = rig();
  try {
    const off = bindCursorToggle(r.canvas, () => false, actions);
    r.lock();
    r.lose();
    r.touch('touchend');
    await settle();
    assert.deepEqual(r.delivered, [], 'the touch the change raced');
    off();
  } finally { r.restore(); }
});

test('TOUCH-UNLOCK: a loss with no touch near is still the player\'s Escape (ESC-LOCK), and the binding\'s disposer takes its touch listeners with it', async () => {
  const r = rig();
  try {
    const off = bindCursorToggle(r.canvas, () => false, actions);
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      const ls = r.docL.filter((l) => l.type === type);
      assert.equal(ls.length, 1, `one ${type} reader`);
      assert.equal(ls[0].capture, true, 'on the capture phase - before any handler can stop it');
    }
    r.touch('touchend');
    await wait(TOUCH_UNLOCK_MS + 50);
    r.lock();
    r.lose();
    await settle();
    assert.deepEqual(r.delivered, ['keydown:Escape', 'keyup:Escape'], 'a mouse\'s and a keyboard\'s player - and a finger long lifted - keep ESC-LOCK');
    off();
    assert.equal(r.docL.filter((l) => l.type.startsWith('touch')).length, 0, 'the touch readers go with the host');
  } finally { r.restore(); }
  assert.ok(TOUCH_UNLOCK_MS >= 250 && TOUCH_UNLOCK_MS <= 1000, 'long enough to hold a posted change, short enough that a real Escape after a tap is still one');
});
