// U1: the HUD's pure math - compass scroll, bar fill, scale, and the
// indexed->RGBA conversion with the index-0 transparency rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compassScroll, barFill, hudScale, bitmapToColor32,
  COMPASS_NON_WRAPPED, COMPASS_BOX_INTERIOR,
} from '../src/ui/hud.js';

test('hud: compass scroll verbatim (trunc, wrap, window fits the strip)', () => {
  assert.equal(compassScroll(0), 0);
  assert.equal(compassScroll(0.5), 129);                 // trunc(258 * .5)
  assert.equal(compassScroll(0.999999), 257);            // never reaches 258
  assert.equal(compassScroll(1.25), Math.trunc(258 * 0.25));   // wraps
  assert.equal(compassScroll(-0.25), Math.trunc(258 * 0.75));  // negative headings wrap up
  // the classic strip is 322 wide: max scroll 257 + the 64 window = 321 < 322
  assert.ok(COMPASS_NON_WRAPPED - 1 + COMPASS_BOX_INTERIOR < 322);
});

test('hud: bar fill bottom-anchored + scale floors at 1', () => {
  assert.deepEqual(barFill(50, 100), { ratio: 0.5, v0: 0.5, v1: 1 });   // lower half of the art
  assert.deepEqual(barFill(0, 100), { ratio: 0, v0: 1, v1: 1 });
  assert.deepEqual(barFill(150, 100), { ratio: 1, v0: 0, v1: 1 });      // clamped
  assert.deepEqual(barFill(5, 0), { ratio: 0, v0: 1, v1: 1 });          // max 0 guarded
  assert.equal(hudScale(200), 1);
  assert.equal(hudScale(1080), 5);
  assert.equal(hudScale(120), 1);                                        // floors at 1
});

test('hud: indexed->RGBA with index-0 transparency', () => {
  const palette = { get: (i) => ({ r: i, g: i + 1, b: i + 2 }) };
  const bmp = { width: 2, height: 1, data: new Uint8Array([0, 7]) };
  const c32 = bitmapToColor32(bmp, palette);
  const u8 = new Uint8Array(c32.colors.buffer);
  assert.equal(u8[3], 0);                                // index 0: transparent
  assert.deepEqual([...u8.slice(4, 8)], [7, 8, 9, 255]); // index 7: palette RGB, opaque
});
