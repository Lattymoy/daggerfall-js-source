// U1: the HUD's pure math - compass scroll, bar fill, scale, and the
// indexed->RGBA conversion with the index-0 transparency rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compassScroll, barFill, hudScale, bitmapToColor32,
  compassMarkerLerp, changeRange, DETECT_MARKER_W, DETECT_MARKER_H, DETECT_MARKER_RGB, DETECT_MARKER_ROWS,
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
  // FIT scale (min axis of the 320x200 virtual screen), floors at 1
  assert.equal(hudScale(320, 200), 1);
  assert.equal(hudScale(1920, 1080), 5);      // desktop: min(6, 5.4) -> 5, same as height-only gave
  assert.equal(hudScale(1080, 2280), 3);      // portrait phone: WIDTH constrains - min(3.375, 11.4) -> 3 (height-only gave 11 and blew the layout)
  assert.equal(hudScale(160, 120), 1);        // floors at 1
});

test('hud: indexed->RGBA with index-0 transparency', () => {
  const palette = { get: (i) => ({ r: i, g: i + 1, b: i + 2 }) };
  const bmp = { width: 2, height: 1, data: new Uint8Array([0, 7]) };
  const c32 = bitmapToColor32(bmp, palette);
  const u8 = new Uint8Array(c32.colors.buffer);
  assert.equal(u8[3], 0);                                // index 0: transparent
  assert.deepEqual([...u8.slice(4, 8)], [7, 8, 9, 255]); // index 7: palette RGB, opaque
});

// ── X4: the Detect markers on the compass ─────────────────────────
test('X4 compass marker: ahead is centre, right is the right edge, left is the left edge', () => {
  // Player at the origin facing +z (heading01 = 0), which is the
  // port's and DFU's shared convention (eulerAngles.y / 360).
  const P = [0, 0];
  assert.ok(Math.abs(compassMarkerLerp([0, 10], P, 0) - 0.5) < 1e-9, 'dead ahead sits centre');
  assert.ok(Math.abs(compassMarkerLerp([10, 0], P, 0) - 1.0) < 1e-9, 'due right pins right');
  assert.ok(Math.abs(compassMarkerLerp([-10, 0], P, 0) - 0.0) < 1e-9, 'due left pins left');
  // and the marker travels with the CAMERA: turning 90 degrees right
  // (heading01 = 0.25) swings the object that was ahead to the left
  assert.ok(Math.abs(compassMarkerLerp([0, 10], P, 0.25) - 0.0) < 1e-9);
  // distance does not move it - only bearing
  assert.equal(compassMarkerLerp([1, 0], P, 0), compassMarkerLerp([500, 0], P, 0));
});

test('X4 compass marker: the half-circle BEHIND the player runs outside 0..1 - the clamp is the behaviour', () => {
  // Each branch maps a quarter-turn onto 0..1, so the rear half
  // produces -0.5..0 and 1..1.5. Unity's Mathf.Lerp clamps t, which
  // is what pins rear markers to the box edges instead of drawing
  // them off-box. A port that "tidied" the formula to stay in range
  // would spread rear objects across the compass as if they were
  // in front.
  const P = [0, 0];
  assert.ok(compassMarkerLerp([0, -10], P, 0) < 0, 'directly behind runs NEGATIVE');
  // a bearing just off dead-behind on the other side runs past 1
  assert.ok(compassMarkerLerp([0.001, -10], P, 0) > 1, 'and the other side of behind runs past 1');
  // the two ends of the rear half are the two edges, not the centre
  assert.ok(compassMarkerLerp([10, -10], P, 0) > 1);
  assert.ok(compassMarkerLerp([-10, -10], P, 0) < 0);
  // degenerate: standing exactly on the target is dead ahead, not NaN
  assert.equal(compassMarkerLerp([0, 0], P, 0), 0.5);
});

test('X4 compass marker: ChangeRange is DFU\'s, and the icon is described rather than shipped', () => {
  // ChangeRange(value, oldMin, oldMax, newMin, newMax) - note the
  // arguments run min,max on BOTH sides and DFU calls it with
  // oldMin > oldMax in the first branch (0.25 -> 0.0), which is what
  // makes that branch descend.
  assert.equal(changeRange(0.25, 0.25, 0.0, 1.0, 0.5), 1.0);
  assert.equal(changeRange(0.0, 0.25, 0.0, 1.0, 0.5), 0.5);
  assert.equal(changeRange(0.75, 1.0, 0.75, 0.5, 0.0), 0.0);
  assert.equal(changeRange(1.0, 1.0, 0.75, 0.5, 0.0), 0.5);
  // The marker itself: DFU's Resources/DetectMarker.png is a 5x3 RGBA
  // downward triangle, every opaque pixel (154,24,8). It is a
  // DFU-authored asset outside ARENA2, so the port describes the
  // shape in code instead of carrying the file.
  assert.equal(DETECT_MARKER_W, 5);
  assert.equal(DETECT_MARKER_H, 3);
  assert.deepEqual([...DETECT_MARKER_RGB], [154, 24, 8]);
  assert.deepEqual([...DETECT_MARKER_ROWS], [5, 3, 1], 'centred rows - the triangle points DOWN at the compass');
  assert.equal(DETECT_MARKER_ROWS.length, DETECT_MARKER_H);
});
