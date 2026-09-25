// FRAME1: the stone-and-brass kit (ui/enhancedFrame.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_ROLES, FRAME_CSS, frameSvg, BAND, EDGE, OUTSET } from '../src/ui/enhancedFrame.js';
import { PLUS_CSS as ENHANCED_CSS } from '../src/ui/enhancedPlusStyle.js';   // PLUS1: the refresh's dress is the Enhanced Plus sheet

test('FRAME1: the kit is the LAST thing in the sheet, so it dresses every screen by role', () => {
  assert.ok(ENHANCED_CSS.trimEnd().endsWith(FRAME_CSS.trimEnd()), 'the paint kit is the very last block');
});

test('FRAME1: paint only - the kit never writes a width, padding or size', () => {
  assert.doesNotMatch(FRAME_CSS, /(^|[\s;{])(width|height|padding|margin|border-width|min-height|min-width)\s*:/m);
  assert.doesNotMatch(FRAME_CSS, /border(-(top|right|bottom|left))?\s*:\s*\d/, 'no border shorthand that could change a width');
});

test('FRAME1: every role selector is a single selector (a list keeps each one its own weight)', () => {
  for (const [role, sels] of Object.entries(FRAME_ROLES)) {
    for (const s of sels) assert.ok(!s.includes(','), `${role}: ${s}`);
    assert.equal(new Set(sels).size, sels.length, `${role} has no duplicates`);
  }
});

test('FRAME1: the window picture lands its inner 2px on the box border', () => {
  assert.equal(OUTSET, EDGE - 2);
  const svg = frameSvg();
  assert.match(svg, new RegExp(`width='${BAND * 2 + 1}'`));
  assert.match(svg, /shape-rendering='crispEdges'/);
});

test('FRAME1: pressable things answer the same way everywhere', () => {
  for (const s of FRAME_ROLES.button) {
    assert.ok(FRAME_CSS.includes(`${s}:hover`), `${s} hover`);
    assert.ok(FRAME_CSS.includes(`${s}:active:not(:disabled)`), `${s} pressed`);
    assert.ok(FRAME_CSS.includes(`${s}:disabled`), `${s} disabled`);
  }
});
