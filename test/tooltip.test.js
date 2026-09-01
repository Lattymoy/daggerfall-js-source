// U37: the ToolTip against ToolTip.cs, and the hover seam it needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TOOLTIP_MARGIN, TOOLTIP_MOUSE_OFFSET,
  parseHexColor, toolTipRows, toolTipSize, toolTipPosition,
  toolTipsEnabled, toolTipDelay, ToolTip,
  DEFAULT_TOOLTIP_TEXT_BG, DEFAULT_TOOLTIP_TEXT_FG,
} from '../src/ui/toolTip.js';
import { NATIVE_W, NATIVE_H } from '../src/ui/nativePanel.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { DEFAULTS } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('U37: the constants are DFU\'s (:30, :33, :68-69)', () => {
  assert.equal(TOOLTIP_MARGIN, 2);
  assert.deepEqual([...TOOLTIP_MOUSE_OFFSET], [0, 4]);
  // DaggerfallUI.cs:68-69 - Color32(64,64,64,210) and (230,230,200,255)
  assert.deepEqual(DEFAULT_TOOLTIP_TEXT_BG.map((c) => Math.round(c * 255)), [64, 64, 64, 210]);
  assert.deepEqual(DEFAULT_TOOLTIP_TEXT_FG.map((c) => Math.round(c * 255)), [230, 230, 200, 255]);
  // and the SHIPPED settings carry exactly those, which is why they
  // can be the store's defaults rather than a second copy
  assert.equal(DEFAULTS.GUI.ToolTipBackgroundColor, '404040D2');
  assert.equal(DEFAULTS.GUI.ToolTipTextColor, 'E6E6C8FF');
  assert.deepEqual(parseHexColor('404040D2', null).map((c) => Math.round(c * 255)), [64, 64, 64, 210]);
  assert.deepEqual(parseHexColor('E6E6C8FF', null).map((c) => Math.round(c * 255)), [230, 230, 200, 255]);
  // a malformed value falls back rather than painting NaN
  assert.equal(parseHexColor('nope', DEFAULT_TOOLTIP_TEXT_FG), DEFAULT_TOOLTIP_TEXT_FG);
  assert.equal(parseHexColor(null, DEFAULT_TOOLTIP_TEXT_BG), DEFAULT_TOOLTIP_TEXT_BG);
});

test('U37: rows split on \\r, with the ESCAPED form collapsed first (:243-245)', () => {
  assert.deepEqual(toolTipRows('one'), ['one']);
  assert.deepEqual(toolTipRows('one\rtwo'), ['one', 'two']);
  // text read from a plain-text file carries the two-character escape
  assert.deepEqual(toolTipRows('one\\rtwo'), ['one', 'two']);
  assert.deepEqual(toolTipRows('a\\rb\rc'), ['a', 'b', 'c']);
});

test('U37: the box size carries DFU\'s -1 (:158-160)', () => {
  // (widest + left + right) x (glyph * rows + top + bottom - 1)
  assert.deepEqual(toolTipSize(['a'], 20, 6), [20 + 4, 6 + 4 - 1]);
  assert.deepEqual(toolTipSize(['a', 'b'], 30, 6), [34, 12 + 3]);
  // the -1 is per BOX, not per row - two rows lose one pixel, not two
  const [, h1] = toolTipSize(['a'], 10, 6);
  const [, h2] = toolTipSize(['a', 'b'], 10, 6);
  assert.equal(h2 - h1, 6, 'each extra row adds exactly one glyph height');
});

test('U37: the edges SHIFT the box back, they do not flip it (:166-177)', () => {
  // comfortably inside: cursor + MouseOffset, untouched
  assert.deepEqual(toolTipPosition(100, 100, 40, 10), [100, 104]);
  // past the right edge: pushed back by exactly the overflow, so the
  // box ends flush - NOT mirrored to the cursor's other side
  const [x] = toolTipPosition(NATIVE_W - 10, 50, 40, 10);
  assert.equal(x, NATIVE_W - 40);
  // past the bottom edge, same shape
  const [, y] = toolTipPosition(50, NATIVE_H - 2, 40, 10);
  assert.equal(y, NATIVE_H - 10);
  // both at once
  assert.deepEqual(toolTipPosition(NATIVE_W - 1, NATIVE_H - 1, 40, 10), [NATIVE_W - 40, NATIVE_H - 10]);
});

test('U37: the four GUI/ToolTip* settings are LIVE, and the delay is a REST', () => {
  _resetForTests();
  assert.equal(toolTipsEnabled(), true, 'EnableToolTips ships True');
  assert.equal(toolTipDelay(), 0, 'and the delay ships 0.0 - a tip shows at once');

  setValue('GUI', 'ToolTipDelayInSeconds', 0.5);
  const t = new ToolTip();
  t.show('hello', 10, 10);
  t.update(0.2);
  assert.equal(t.text, null, 'not yet');
  t.update(0.4);
  assert.equal(t.text, 'hello', 'past the delay');
  // moving to a DIFFERENT tip restarts the clock
  t.show('other', 12, 12);
  t.update(0.2);
  assert.equal(t.text, null, 'a new tip starts its own timer');
  // ...but resting on the SAME one keeps accumulating
  t.show('other', 13, 13);
  t.update(0.4);
  assert.equal(t.text, 'other');
  // leaving clears it outright
  t.hide();
  t.update(1);
  assert.equal(t.text, null);
  // an empty text is a hide, not a blank box - and the clear is
  // IMMEDIATE, before any tick: a window that stops hovering mid-frame
  // must not draw the stale tip it was showing a moment ago.
  t.show('again', 5, 5);
  t.update(1);
  assert.equal(t.text, 'again');
  t.show('', 5, 5);
  assert.equal(t.text, null, 'an empty text clears without waiting for a tick');
  t.show('again', 5, 5);
  t.update(1);
  t.hide();
  assert.equal(t.text, null, 'and so does hide()');
  _resetForTests();
});

test('U37: the hover seam reaches a window in all four hosts', () => {
  const code = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
  // the two overlay channels expose it
  assert.match(code('scenes/dungeonContext.js'), /overlayHover\(vx, vy\) \{ activeOverlay\?\.hover\?\.\(vx, vy\); \}/);
  assert.match(code('scenes/townTalk.js'), /function hover\(e\) \{/);
  // and every host routes mousemove into one of them
  assert.match(code('scenes/dungeon.js'), /ctx\.overlayHover\?\.\(/);
  assert.match(code('scenes/worldModes.js'), /dungeonCtx\.overlayHover\?\.\(/);
  for (const rel of ['scenes/exterior.js', 'scenes/world.js']) {
    assert.match(code(rel), /townTalk\.hover\(e\) \|\| modes\?\.hover\?\.\(e\)/, `${rel} routes the hover`);
  }
  // U25's flag said the inventory info panel pends "the mouse-move
  // seam's" slice - this is that seam, so the flag may now be spent
  // by a consumer rather than staying a promise.
  assert.match(code('ui/controlsWindow.js'), /hover\(vx, vy\) \{/, 'the controls grid consumes it');
});

test('U37: the tip is SUPPRESSED unless the label elongated (:214-216)', async () => {
  const { ControlsWindow } = await import('../src/ui/controlsWindow.js');
  const { setBindings } = await import('../src/ui/input.js');
  const { createBindings, resetDefaults, setBinding } = await import('../src/systems/inputActions.js');
  _resetForTests();
  const b = createBindings();
  resetDefaults(b);
  setBindings(b);
  const w = new ControlsWindow({});
  const mf = w.buttons.find((x) => x.action === 'MoveForwards');
  // KeyW reads 'W' - short, no tip
  w.hover(mf.x + 1, mf.y + 1);
  w.tick(1);
  assert.equal(w.tip.text, null, 'a short label offers nothing');
  // a long code elongates to '...', and THEN the tip carries the full text
  const b2 = createBindings();
  resetDefaults(b2);
  setBinding(b2, 'SomethingVeryLongIndeed', 'MoveForwards');
  setBindings(b2);
  const w2 = new ControlsWindow({});
  const mf2 = w2.buttons.find((x) => x.action === 'MoveForwards');
  w2.hover(mf2.x + 1, mf2.y + 1);
  w2.tick(1);
  assert.equal(w2.tip.text, 'SOMETHING VERY LONG INDEED', 'the elongated label shows its full text - capped by the classic ToUpper tail (NT3 F082)');
  // hovering nothing clears it
  w2.hover(-1, -1);
  w2.tick(1);
  assert.equal(w2.tip.text, null);
  _resetForTests();
});
