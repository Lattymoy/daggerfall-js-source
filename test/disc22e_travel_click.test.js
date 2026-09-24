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

test('DISC22-E: the spinner a free click lands on steps the speed past 10 - up by the top half, down by the bottom', () => {
  const changed = [];
  const ui = createTravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onTimeAccelerationChanged: (n) => changed.push(n) });
  ui.show();
  const x0 = Math.trunc((NATIVE_W - CONTROL_RECTS.panel[2]) / 2);
  const [sx, sy] = CONTROL_RECTS.timeAccel;
  const up = [x0 + sx + 7, sy + 2], down = [x0 + sx + 7, sy + UD_SPINNER.down[1] + 2];
  assert.equal(ui.timeAcceleration, 10);
  for (let i = 0; i < 3; i++) assert.equal(ui.click(...up), true);
  assert.equal(ui.timeAcceleration, 25, 'three clicks up from 10');
  assert.equal(ui.click(...down), true);
  assert.equal(ui.timeAcceleration, 20);
});

test('DISC22-E: the host asks the lock, not the flag', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const arm = w.slice(w.indexOf('if (stripTakesClick('), w.indexOf('travelControlUI.click(v[0], v[1])'));
  assert.match(arm, /locked: document\.pointerLockElement === canvas/);
  assert.doesNotMatch(arm, /cursorActive\(\)/, 'the flag the chat leaves down is not asked');
});
