// ESC-LOCK (2026-09-27, Mac: "when you hit esc to leave a menu, your cursor remains on the screen instead of returning
// to the game"; a tester: "U have to hit escape 2 times to get pause menu up now").
//
// Two browser rules player/pointerLock.js had assumed away. (1) While the pointer is locked the Escape press is the
// BROWSER's - it ends the lock and the page never sees the key - so the first Escape only freed the cursor and the
// second opened the pause. A lock loss the page did not ask for is now read as that swallowed press and delivered, the
// pad's way (a keydown and its keyup on the document). (2) Escape is no user activation, and after the player ends a
// lock the browser grants the next only with one - so a relock inside an Escape close is refused. A tab cannot change
// that (the next click or key takes the look back); the desktop app's shell re-runs the request AS a gesture.
//
// Driven through the real module against a document just real enough for it: the lock element, the focus, the
// listeners, a dispatch that records what reached it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bindCursorToggle, releaseLook, requestLook, setCursorActive,
  ESCAPE_DELIVERY_MS, PAGE_RELEASE_MS, REAL_ESCAPE_MS, SHELL_RELOCK_MS,
} from '../src/player/pointerLock.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = () => wait(ESCAPE_DELIVERY_MS + 250);   // a loaded runner's timers run late; the margin is the pin's, not the law's

function rig() {
  const saved = { add: globalThis.addEventListener, remove: globalThis.removeEventListener, doc: globalThis.document, hadDoc: 'document' in globalThis, KE: globalThis.KeyboardEvent };
  const winL = []; const docL = [];
  const delivered = [];
  const canvas = { requests: 0, answer: () => undefined, requestPointerLock(opts) { canvas.requests++; return canvas.answer(opts); } };
  const doc = {
    pointerLockElement: null, visibilityState: 'visible', focused: true,
    hasFocus() { return doc.focused; },
    addEventListener(type, fn, capture) { docL.push({ type, fn, capture: !!capture }); },
    removeEventListener(type, fn, capture) { const i = docL.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture); if (i >= 0) docL.splice(i, 1); },
    dispatchEvent(e) { delivered.push(`${e.type}:${e.code}`); for (const l of docL.filter((x) => x.type === e.type)) l.fn(e); for (const l of winL.filter((x) => x.type === e.type)) l.fn(e); return true; },
    exitPointerLock() { doc.pointerLockElement = null; doc.change(); },
    change() { for (const l of docL.filter((x) => x.type === 'pointerlockchange')) l.fn({ type: 'pointerlockchange' }); },
  };
  globalThis.document = doc;
  globalThis.addEventListener = (type, fn, capture) => { winL.push({ type, fn, capture: !!capture }); };
  globalThis.removeEventListener = (type, fn, capture) => { const i = winL.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture); if (i >= 0) winL.splice(i, 1); };
  globalThis.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); this.isTrusted = false; } };
  const r = {
    canvas, doc, delivered, winL, docL,
    lock() { doc.pointerLockElement = canvas; doc.change(); },
    lose() { doc.pointerLockElement = null; doc.change(); },
    /** a key the browser DID hand the page (trusted) */
    press(code) { const e = { type: 'keydown', code, key: code, isTrusted: true, target: null, preventDefault() {} }; for (const l of winL.filter((x) => x.type === 'keydown')) l.fn(e); },
    restore() {
      globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.remove; globalThis.KeyboardEvent = saved.KE;
      if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    },
  };
  return r;
}
const actions = () => [];

test('ESC-LOCK (1): a lock the page did not release, lost with nothing up, is the player\'s Escape - delivered ONCE, a keydown and its keyup, on the document', async () => {
  const r = rig();
  try {
    const off = bindCursorToggle(r.canvas, () => false, actions);
    r.lock();
    r.lose();
    assert.deepEqual(r.delivered, [], 'not at once - a browser that hands the page its own Escape gets the chance');
    await settle();
    assert.deepEqual(r.delivered, ['keydown:Escape', 'keyup:Escape'], 'the one press the browser ate');
    await settle();
    assert.equal(r.delivered.length, 2, 'once');
    off();
  } finally { r.restore(); }
});

test('ESC-LOCK (1): never the page\'s own release, a window\'s, a freed cursor\'s, another window\'s focus, a lock taken back - nor a press the browser DID deliver', async () => {
  // the page's own release is LAST: its stamp is module-wide, and a case after it inside PAGE_RELEASE_MS would be held
  // by the stamp instead of its own guard
  const cases = {
    'a window is up': (r, up) => { r.lock(); up.v = true; r.lose(); },
    'the player freed the cursor': (r) => { r.lock(); setCursorActive(true); r.lose(); },
    'the page lost the focus': (r) => { r.lock(); r.doc.focused = false; r.lose(); },
    'the page is hidden': (r) => { r.lock(); r.doc.visibilityState = 'hidden'; r.lose(); },
    'the lock came back before the delivery': (r) => { r.lock(); r.lose(); r.lock(); },
    'the browser handed the page its Escape': (r) => { r.lock(); r.press('Escape'); r.lose(); },
    'the page released it (releaseLook)': (r) => { r.lock(); releaseLook(); },
  };
  for (const [why, act] of Object.entries(cases)) {
    const r = rig();
    try {
      const up = { v: false };
      const off = bindCursorToggle(r.canvas, () => up.v, actions);
      act(r, up);
      await settle();
      assert.deepEqual(r.delivered, [], why);
      off();
      setCursorActive(false);
    } finally { r.restore(); }
  }
  assert.ok(PAGE_RELEASE_MS >= 250 && REAL_ESCAPE_MS >= 200 && ESCAPE_DELIVERY_MS <= 100, 'the windows are short enough to be one press, long enough to hold one');
});

test('ESC-LOCK (1): the binding\'s disposer takes its lock listener and a pending delivery with it', async () => {
  await wait(PAGE_RELEASE_MS + 20);   // clear of the case above's page release, so only the disposer can hold this one
  const r = rig();
  try {
    const off = bindCursorToggle(r.canvas, () => false, actions);
    assert.equal(r.docL.filter((l) => l.type === 'pointerlockchange').length, 1);
    r.lock(); r.lose();
    off();
    assert.equal(r.docL.filter((l) => l.type === 'pointerlockchange').length, 0, 'the listener goes with the host');
    await settle();
    assert.deepEqual(r.delivered, [], 'and the pending delivery with it');
    assert.equal(r.winL.filter((l) => l.type === 'keydown').length, 0, 'still ONE keydown reader, removed');
  } finally { r.restore(); }
});

test('ESC-LOCK (2): a request the browser refused is asked of the desktop shell ONCE, which re-runs it as a gesture; a tab has no shell and waits for a click', async () => {
  const r = rig();
  const savedShell = globalThis.daggerShell;
  try {
    let asked = 0;
    globalThis.daggerShell = { relockPointer: () => { asked++; } };
    r.canvas.answer = () => Promise.reject(Object.assign(new Error('refused'), { name: 'NotAllowedError' }));
    requestLook(r.canvas);
    await wait(0);
    assert.equal(asked, 1, 'the refusal went to the shell');
    assert.equal(typeof globalThis.__daggerRelock, 'function', 'with the one hook the main process runs');
    globalThis.__daggerRelock();
    assert.equal(r.canvas.requests, 2, 'run as the gesture, the request is made again');
    assert.equal(globalThis.__daggerRelock, null, 'once');
    await wait(0);
    assert.equal(asked, 1, 'a request the shell cannot win either is not asked again in a loop');
    // past the window: the unsupported option's plain retry, refused, goes to the shell too
    await wait(SHELL_RELOCK_MS + 20);
    let n = 0;
    r.canvas.answer = () => Promise.reject(Object.assign(new Error('x'), { name: n++ === 0 ? 'NotSupportedError' : 'NotAllowedError' }));
    requestLook(r.canvas);
    await wait(0); await wait(0);
    assert.equal(asked, 2, 'the plain retry\'s refusal is asked of the shell');
    // a tab: no shell, nothing thrown, nothing hooked
    delete globalThis.daggerShell; globalThis.__daggerRelock = null;
    await wait(SHELL_RELOCK_MS + 20);
    r.canvas.answer = () => Promise.reject(Object.assign(new Error('refused'), { name: 'NotAllowedError' }));
    requestLook(r.canvas);
    await wait(0);
    assert.equal(globalThis.__daggerRelock, null, 'a tab waits for the next click or key');
  } finally {
    if (savedShell === undefined) delete globalThis.daggerShell; else globalThis.daggerShell = savedShell;
    delete globalThis.__daggerRelock;
    r.restore();
  }
});

test('ESC-LOCK (2): the desktop app\'s bridge - the preload asks, the main process runs the page\'s one hook as a user gesture', () => {
  assert.match(rd('app/preload.cjs'), /relockPointer: \(\) => ipcRenderer\.send\('dagger:relock'\),/);
  assert.match(rd('app/main.cjs'), /ipcMain\.on\('dagger:relock', \(e\) => \{ e\.sender\.executeJavaScript\('globalThis\.__daggerRelock\?\.\(\)', true\)\.catch\(\(\) => \{\}\); \}\);/,
    'a FIXED script, and `true` is executeJavaScript\'s userGesture');
});
