// The pointer-lock helper must never throw, whatever requestPointerLock does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestLook } from '../../src/player/pointerLock.js';

test('requestLook: swallows a rejecting promise (the crash + frozen-yaw bug)', () => {
  // modern Chrome: returns a Promise that can reject
  let rejected;
  const canvas = { requestPointerLock: () => { rejected = Promise.reject(new Error('cooldown')); return rejected; } };
  assert.doesNotThrow(() => requestLook(canvas));   // must not throw synchronously
  return rejected.catch(() => {});                  // and the rejection is handled (no unhandledRejection)
});

test('requestLook: tolerates the void-returning (older) API', () => {
  const canvas = { requestPointerLock: () => undefined };
  assert.doesNotThrow(() => requestLook(canvas));
});

test('requestLook: a synchronous throw is non-fatal', () => {
  const canvas = { requestPointerLock: () => { throw new Error('no lock'); } };
  assert.doesNotThrow(() => requestLook(canvas));
});

// ── PL1: the 0.3s toggle refusal after an input box (2026-08-28) ──
// PlayerMouseLook.cs:192-196 over DaggerfallInputMessageBox
// .CloseWindow's stamp (:301): Return both submits the box and is the
// toggle's default binding, so the submitting keypress must not also
// free the mouse - "players often think this is a bug".
import { noteInputBoxClosed, cursorToggleRefused, INPUT_BOX_TOGGLE_REFUSAL_MS } from '../../src/player/pointerLock.js';
import { readFileSync } from 'node:fs';

test('PL1: the refusal window is 0.3s, C#\'s strict-greater boundary kept', () => {
  noteInputBoxClosed(1000);
  assert.equal(cursorToggleRefused(1000), true, 'the submitting keypress itself');
  assert.equal(cursorToggleRefused(1000 + 300), true, 'exactly 0.3s: C# allows only STRICTLY greater');
  assert.equal(cursorToggleRefused(1000 + 301), false, 'past the window the toggle works');
  assert.equal(INPUT_BOX_TOGGLE_REFUSAL_MS, 300);
});

test('PL1: the wire - the toggle gate reads the predicate, the input box stamps on BOTH exits', () => {
  const pl = readFileSync('src/player/pointerLock.js', 'utf8');
  assert.match(pl, /if \(cursorToggleRefused\(\)\) return;\s*\n\s*toggleCursorActive\(canvas\);/,
    'the refusal sits inside bindCursorToggle\'s onKey, before the toggle');
  // CM3: the input box has ONE home now (ui/inputMessageBox.js) and one
  // close, `_close(submit)`, that stamps before either callback - and
  // both exits, Return and Escape, go through it. ActionInputBox is its
  // subclass and stamps nothing of its own.
  // AUDIT-CM: DFU stamps in ReturnPlayerInputEvent ALONE (:298-304) -
  // Escape goes through CancelWindow and stamps nothing. The behavioural
  // pin (stamped before the handler, not on cancel) is
  // test/ui/classicinputbox.test.js's; this is the shape.
  const im = readFileSync('src/ui/inputMessageBox.js', 'utf8');
  assert.equal((im.match(/noteInputBoxClosed\(\);/g) ?? []).length, 1, 'the stamp sits in the one close, on the submit arm');
  assert.match(im, /if \(submit\) \{\n[\s\S]*?noteInputBoxClosed\(\);\n\s+this\.onSubmit\?\.\(this\.value\);\n\s+\} else \{\n\s+this\.onCancel\?\.\(\);/,
    'CloseWindow stamps BEFORE OnGotUserInput, and only there (DaggerfallInputMessageBox.cs:298-304)');
  const at = readFileSync('src/ui/actionText.js', 'utf8');
  assert.equal((at.match(/noteInputBoxClosed\(\);/g) ?? []).length, 0, 'the action box delegates the stamp');
  assert.match(at, /class ActionInputBox extends InputMessageBoxWindow/);
});

// ── HOLD_FREE_MOUSE: hold key to free, release to lock ──
import { bindCursorToggle, HOLD_FREE_MOUSE_ACTION, cursorHeld, cursorActive, setCursorActive } from '../../src/player/pointerLock.js';

test('HOLD_FREE_MOUSE: keydown frees cursor via hold, keyup relocks', () => {
  noteInputBoxClosed(-Infinity);
  let requested = 0;
  let released = 0;
  const canvas = {
    requestPointerLock: () => {
      requested++;
      globalThis.document.pointerLockElement = canvas;
      return Promise.resolve();
    },
  };
  const listeners = {};
  const origDoc = globalThis.document;
  const origAdd = globalThis.addEventListener;
  const origRem = globalThis.removeEventListener;

  globalThis.document = {
    pointerLockElement: canvas,
    exitPointerLock: () => {
      released++;
      globalThis.document.pointerLockElement = null;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.addEventListener = (evt, fn) => { listeners[evt] = fn; };
  globalThis.removeEventListener = (evt) => { delete listeners[evt]; };

  try {
    const unbind = bindCursorToggle(canvas, () => false, (e) => e.code === 'KeyF' ? [HOLD_FREE_MOUSE_ACTION] : []);
    assert.equal(cursorActive(), false);

    // Keydown frees cursor and activates cursorActive for UI/hotbar/decor
    let prevented = false;
    listeners.keydown({ code: 'KeyF', preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(cursorActive(), true);
    assert.ok(released > 0);

    // Keyup restores look and clears cursorActive
    prevented = false;
    listeners.keyup({ code: 'KeyF', preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(cursorActive(), false);
    assert.ok(requested > 0);

    unbind();
  } finally {
    globalThis.document = origDoc;
    globalThis.addEventListener = origAdd;
    globalThis.removeEventListener = origRem;
  }
});

test('HOLD_FREE_MOUSE: does not relock on keyup if cursor was already toggled free', () => {
  let requested = 0;
  const canvas = {
    requestPointerLock: () => { requested++; return Promise.resolve(); },
  };
  const listeners = {};
  const origDoc = globalThis.document;
  const origAdd = globalThis.addEventListener;
  const origRem = globalThis.removeEventListener;

  globalThis.document = {
    pointerLockElement: null,
    exitPointerLock: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.addEventListener = (evt, fn) => { listeners[evt] = fn; };
  globalThis.removeEventListener = (evt) => { delete listeners[evt]; };

  try {
    const unbind = bindCursorToggle(canvas, () => false, (e) => e.code === 'KeyF' ? [HOLD_FREE_MOUSE_ACTION] : []);
    setCursorActive(true); // Player toggled cursor on beforehand

    listeners.keydown({ code: 'KeyF', preventDefault: () => {} });
    listeners.keyup({ code: 'KeyF', preventDefault: () => {} });

    assert.equal(requested, 0, 'must not re-lock when cursorActive is true');
    unbind();
  } finally {
    setCursorActive(false);
    globalThis.document = origDoc;
    globalThis.addEventListener = origAdd;
    globalThis.removeEventListener = origRem;
  }
});

test('HOLD_FREE_MOUSE: does not relock on keyup if a window or overlay is up', () => {
  let requested = 0;
  const canvas = {
    requestPointerLock: () => { requested++; return Promise.resolve(); },
  };
  const listeners = {};
  const origDoc = globalThis.document;
  const origAdd = globalThis.addEventListener;
  const origRem = globalThis.removeEventListener;

  globalThis.document = {
    pointerLockElement: null,
    exitPointerLock: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.addEventListener = (evt, fn) => { listeners[evt] = fn; };
  globalThis.removeEventListener = (evt) => { delete listeners[evt]; };

  let windowUp = false;
  try {
    const unbind = bindCursorToggle(canvas, () => windowUp, (e) => e.code === 'KeyF' ? [HOLD_FREE_MOUSE_ACTION] : []);

    listeners.keydown({ code: 'KeyF', preventDefault: () => {} });
    assert.equal(cursorActive(), true);

    // Window opens (e.g. Decorate browse or dialog) while holding
    windowUp = true;

    listeners.keyup({ code: 'KeyF', preventDefault: () => {} });
    assert.equal(requested, 0, 'must not re-lock when window is up');
    assert.equal(cursorActive(), false);

    unbind();
  } finally {
    setCursorActive(false);
    globalThis.document = origDoc;
    globalThis.addEventListener = origAdd;
    globalThis.removeEventListener = origRem;
  }
});
