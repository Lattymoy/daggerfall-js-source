// RPT1026-MISC TOUCH-NO-LOCK (a private report, from Chrome on a phone: a banner on how to get a cursor back came up with
// every menu). That is Chrome for Android's pointer-lock banner: the
// page held the lock. A phone's look is the touch layer's drag (ui/touch/touch.js), yet every relock door - a window's
// close, the look gate's close edge, the dial's goodbye - asked for the lock there too, and Chrome granted it to the tap
// that closed the window. requestLook is the one door they all go through (player/pointerLock.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestLook, makeLookGate } from '../../src/player/pointerLock.js';

/** A window-like as a browser reports it: a phone (a coarse pointer, no hover, touch points) or a desktop. */
function withScreen(kind, body) {
  const prevWin = globalThis.window, prevDoc = globalThis.document;
  const phone = kind === 'phone';
  globalThis.window = {
    location: { search: '' }, navigator: { maxTouchPoints: phone ? 5 : 0 }, ...(phone ? { ontouchstart: null } : {}),
    matchMedia: (q) => ({ matches: phone ? q === '(pointer: coarse)' || q === '(hover: none)' : q === '(pointer: fine)' || q === '(hover: hover)' }),
  };
  globalThis.document = { pointerLockElement: null, addEventListener() {}, removeEventListener() {}, exitPointerLock() {} };
  try { return body(); } finally {
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }
}
const canvasSpy = () => { const asked = []; return { asked, requestPointerLock: (o) => { asked.push(o ?? null); return Promise.resolve(); } }; };

test('RPT1026-MISC TOUCH-NO-LOCK: on a phone no door asks for the pointer lock - neither a request nor the look gate\'s close edge; a desktop still asks, raw input first (mutant: rpt1026-misc-touch-lock-asked)', () => {
  withScreen('phone', () => {
    const c = canvasSpy();
    requestLook(c);
    const gate = makeLookGate(c);
    gate(true); gate(false);   // a window up, then closed - the relock edge
    assert.deepEqual(c.asked, [], 'a finger never takes the lock, so Chrome never shows its banner');
  });
  withScreen('desktop', () => {
    const c = canvasSpy();
    requestLook(c);
    assert.deepEqual(c.asked, [{ unadjustedMovement: true }], 'a mouse asks as it did (MAC1: the raw counts first)');
  });
});
