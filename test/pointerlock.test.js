// The pointer-lock helper must never throw, whatever requestPointerLock does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestLook } from '../src/player/pointerLock.js';

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
import { noteInputBoxClosed, cursorToggleRefused, INPUT_BOX_TOGGLE_REFUSAL_MS } from '../src/player/pointerLock.js';
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
  const at = readFileSync('src/ui/actionText.js', 'utf8');
  assert.equal((at.match(/noteInputBoxClosed\(\);/g) ?? []).length, 2,
    'CloseWindow stamps on submit AND on Escape - both exits close the box');
});
