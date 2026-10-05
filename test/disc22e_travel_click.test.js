// DISC22-E (2026-09-24, Tony H. on Discord: "When using Classic UI or GrimoireUI I'm not able to increase the speed
// from 10x in accelerated travel ... online").
//
// THE BUG: 10x is not a cap - it is the spinner's start value, and the spinner never heard the click. AUDIT-TO1 I2
// gated the classic strip's clicks on DFU's `cursorActive` flag, but online the pointer is freed WITHOUT that flag:
// the chat and the social panels release it with the flag down (world.js surfaceOpen), Enter opens the chat instead
// of toggling it (KB1), Escape releases it, a finger never holds it. The gate refused, and the click relocked the
// pointer instead. Map, Camp and Exit have keys; the spinner is mouse-only, so it alone looked broken. Both classic
// skins (Classic and GrimoireUI) draw this strip; the enhanced one is DOM and was never affected.
//
// The gate is the lock now: driven through the predicate world.js calls and the real strip.
// RATE-LAW (2026-10-04, Mac: "Remove travel options dials"): the spinner itself is gone - the gate stands for Map,
// Camp and Exit, and the recess shows the rate the journey's ground runs at.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTakesClick, createTravelControlUI, CONTROL_RECTS, UD_SPINNER } from '../src/ui/travelControlUI.js';
import { NATIVE_W } from '../src/ui/nativePanel.js';

const base = { showing: true, paused: false, locked: false, button: 0, enhancedDom: false };

test('DISC22-E: a click with the pointer free reaches the strip, whatever the cursor flag says (the chat left it down)', () => {
  assert.equal(stripTakesClick(base), true, 'the online case: chat open, pointer free, flag down');
});

test('DISC22-E: I2 stands - a LOCKED click (frozen coordinates) never reaches it, nor a paused one, a right click or the DOM strip\'s', () => {
  assert.equal(stripTakesClick({ ...base, locked: true }), false, 'the parked cursor over EXIT must not end a journey');
  assert.equal(stripTakesClick({ ...base, paused: true }), false);
  assert.equal(stripTakesClick({ ...base, button: 2 }), false);
  assert.equal(stripTakesClick({ ...base, enhancedDom: true }), false, 'the enhanced strip takes its own clicks');
  assert.equal(stripTakesClick({ ...base, showing: false }), false);
});

test('DISC22-E x RATE-LAW: the recess the spinner sat in is a READOUT - a free click there is the strip\'s (swallowed) and moves nothing; the journey alone sets the rate it shows (mutants: a click that steps it, a readout that never takes the rate)', () => {
  const ui = createTravelControlUI({});
  ui.show();
  const x0 = Math.trunc((NATIVE_W - CONTROL_RECTS.panel[2]) / 2);
  const [sx, sy] = CONTROL_RECTS.timeAccel;
  ui.setRate(100, true);
  assert.deepEqual([ui.timeAcceleration, ui.onRoad], [100, true]);
  const [vx, vy, vw, vh] = UD_SPINNER.value;
  for (const at of [[x0 + sx + 7, sy + 2], [x0 + sx + vx + vw / 2, sy + vy + vh / 2], [x0 + sx + 7, sy + 17]]) {
    assert.equal(ui.click(...at), true, 'inside the strip: swallowed');
    assert.equal(ui.timeAcceleration, 100, 'and nothing stepped');
  }
  assert.equal(typeof ui.faster, 'undefined', 'no spinner left to step');
  assert.equal(typeof ui.slower, 'undefined');
  ui.setRate(60, false);
  assert.deepEqual([ui.timeAcceleration, ui.onRoad], [60, false]);
});

test('DISC22-E: the host asks the lock, not the flag', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const arm = w.slice(w.indexOf('if (stripTakesClick('), w.indexOf('travelControlUI.click(v[0], v[1])'));
  assert.match(arm, /locked: document\.pointerLockElement === canvas/);
  assert.doesNotMatch(arm, /cursorActive\(\)/, 'the flag the chat leaves down is not asked');
});
