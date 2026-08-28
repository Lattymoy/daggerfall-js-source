// CP1 - THE COLOR PICKER (ColorPicker.cs, whole) and its one
// consumer: the settings screen's colour rows. An HSV picker - the
// 360-hue slider, the (int)-cast 186x90 S/V picture, the
// parse-at-eight hex box - whose panel background IS the live picked
// colour, with OK the only way a pick lands and Escape the popup's
// CancelWindow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  rgbToHsv, hsvToRgb, pickerColors, colorPreviewPixels, samplePreview,
  toHexRGBA, parseHexRGBA, colorPickerLayout, ColorPickerWindow,
  NUMBER_OF_COLORS, COLOR_PREVIEW_W, COLOR_PREVIEW_H,
  HUE_SLIDER_DISPLAY_UNITS, HUE_SLIDER_TOTAL_UNITS, HUE_MAX_SCROLL,
} from '../src/ui/colorPicker.js';
import { SettingsWindow } from '../src/ui/settingsWindow.js';
import { getString, setValue, _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ~ ${b}`);

// ---------------------------------------------------------------
// 1. THE CONSTANTS AND THE HSV LAWS
// ---------------------------------------------------------------

test("CP1: the (int) casts and the slider's unit arithmetic, verbatim", () => {
  assert.equal(NUMBER_OF_COLORS, 360);
  assert.equal(COLOR_PREVIEW_W, 186, '(int)(280f/3*2) - the cast eats the .666');
  assert.equal(COLOR_PREVIEW_H, 90, '(int)(120f/4*3)');
  assert.equal(HUE_SLIDER_DISPLAY_UNITS, 50);
  assert.equal(HUE_SLIDER_TOTAL_UNITS, 50 + 360 - 1, 'TotalUnits = DisplayUnits + colors.Length - 1 (:133)');
  assert.equal(HUE_MAX_SCROLL, 359, 'so the scroll range is exactly the 360 hues');
});

test('CP1: RGBToHSV / HSVToRGB agree with Unity on the anchors and round-trip', () => {
  assert.deepEqual(rgbToHsv(1, 0, 0), [0, 1, 1], 'red is hue 0');
  close(rgbToHsv(0, 1, 0)[0], 1 / 3);
  close(rgbToHsv(0, 1, 1)[0], 0.5, 1e-9);
  assert.deepEqual(rgbToHsv(0, 0, 0), [0, 0, 0], 'black: h and s zero, not NaN');
  assert.deepEqual(rgbToHsv(1, 1, 1), [0, 0, 1], 'white is s 0');
  assert.deepEqual(hsvToRgb(0.5, 1, 1), [0, 1, 1], 'and back');
  // the magenta side rides the negative-modulo wrap (h < 0 -> +1);
  // the wrap must land in the RETURNED h - hsvToRgb's own wrap would
  // hide its absence from any round-trip
  close(rgbToHsv(0.9, 0.1, 0.5)[0], 1 - 0.5 / 6);
  for (const c of [[0.2, 0.7, 0.4], [1, 0.86, 0.45], [0.04, 0.04, 0.05], [0.9, 0.1, 0.5]]) {
    const rt = hsvToRgb(...rgbToHsv(...c));
    c.forEach((v, i) => close(rt[i], v, 1e-9));
  }
});

test('CP1: GetColors - 360 fully saturated hues in order', () => {
  const cs = pickerColors();
  assert.equal(cs.length, 360);
  assert.deepEqual(cs[0], [1, 0, 0]);
  assert.deepEqual(cs[180], [0, 1, 1], 'half way round is cyan');
});

// ---------------------------------------------------------------
// 2. THE S/V PICTURE (GetColorPreview + GetPixel)
// ---------------------------------------------------------------

test('CP1: the picture stores rows BOTTOM-UP - row 0 is v 0, black edge to edge', () => {
  const px = colorPreviewPixels(0);
  assert.equal(px.length, 186 * 90);
  assert.deepEqual(px[0], [0, 0, 0], '(0,0): s 0, v 0');
  assert.deepEqual(px[185], [0, 0, 0], 'the whole bottom row is v 0');
  // the leftmost column is s 0 - a grey ramp
  const grey = px[45 * 186];
  close(grey[0], 45 / 90); close(grey[1], 45 / 90); close(grey[2], 45 / 90);
  // top-right approaches the pure hue
  const bright = px[89 * 186 + 185];
  close(bright[0], 89 / 90);
  assert.ok(bright[1] < 0.02, 'red hue: green stays near zero');
});

test('CP1: GetPixel flips y (screen y down, texture rows up) and the port clamps the one wrap edge', () => {
  const px = colorPreviewPixels(0);
  assert.deepEqual(samplePreview(px, 10, 90), px[0 * 186 + 10], 'the panel bottom reads texture row 0');
  assert.deepEqual(samplePreview(px, 10, 1), px[89 * 186 + 10], 'one down from the top reads row 89');
  assert.deepEqual(samplePreview(px, 10, 0), px[89 * 186 + 10],
    'y 0 would read row 90 - Unity wraps it to black; the port clamps to the brightest row, the recorded departure');
  assert.deepEqual(samplePreview(px, 999, 45), samplePreview(px, 185, 45), 'x clamps');
});

// ---------------------------------------------------------------
// 3. THE WINDOW
// ---------------------------------------------------------------

test('CP1: SetColor seeds slider, crosshair and hex from the swatch colour', () => {
  const w = new ColorPickerWindow({ color: { rgb: [0, 1, 1], a: 1 } });   // cyan
  assert.equal(w.scrollIndex, 180, 'RoundToInt(360 * h) (:185)');
  assert.deepEqual(w.crosshair, [186, 0], 's 1 -> full right, v 1 -> top (:196-201)');
  assert.equal(w.hexText, '00FFFFFF');
  const seeded = new ColorPickerWindow();
  assert.deepEqual(seeded.color, [1, 1, 1], 'no sender falls to white (:142-143)');
});

test('CP1: the slider clamp, the wheel step and the DisplayUnits trough paging', () => {
  const w = new ColorPickerWindow({ color: { rgb: [1, 0, 0], a: 1 } });
  assert.equal(w.scrollIndex, 0);
  w.wheel(-1);
  assert.equal(w.scrollIndex, 0, 'clamped at zero');
  w.wheel(1);
  assert.equal(w.scrollIndex, 1, 'MouseScroll steps one (:181-191)');
  w.sliderClick(0.9);   // far past the thumb
  assert.equal(w.scrollIndex, 51, 'a trough click pages by DisplayUnits (:170-178)');
  for (let i = 0; i < 20; i++) w.sliderClick(1);
  assert.equal(w.scrollIndex, HUE_MAX_SCROLL, 'clamped at 359');
  w.sliderClick(0);
  assert.equal(w.scrollIndex, HUE_MAX_SCROLL - 50, 'and pages back down');
});

test('CP1: a hue change regenerates the picture and re-samples the PICKED point', () => {
  const w = new ColorPickerWindow({ color: { rgb: [1, 0, 0], a: 1 } });
  w.pickAt(186, 0);   // brightest corner (clamped to the last cell)
  assert.ok(w.color[0] > 0.98 && w.color[1] < 0.01 && w.color[2] < 0.01, 'near-pure red');
  w._setScroll(180);  // swing the hue to cyan
  assert.ok(w.color[1] > 0.9 && w.color[2] > 0.9 && w.color[0] < 0.02,
    'the same S/V point now answers in the new hue');
});

test('CP1: the hex box parses at EXACTLY eight characters, and alpha rides it alone', () => {
  const w = new ColorPickerWindow({ color: { rgb: [1, 1, 1], a: 1 } });
  for (let i = 0; i < 8; i++) w.typeHex('\b');
  assert.equal(w.hexText, '');
  for (const ch of '404040D') w.typeHex(ch);
  assert.deepEqual(w.color, [1, 1, 1], 'seven characters parse nothing (:279)');
  w.typeHex('2');
  close(w.color[0], 0x40 / 255);
  close(w.alpha, 0xD2 / 255, 1e-9);
  assert.equal(w.hexText, '404040D2');
  w.typeHex('Z');
  assert.equal(w.hexText, '404040D2', 'a non-hex character never lands');
  // ALPHA QUIRK, kept: picking by eye discards the D2
  w.pickAt(93, 45);
  assert.equal(w.alpha, 1, 'the picture knows no alpha - only typing eight digits keeps one');
});

test('CP1: OK fires the pick as RRGGBBAA; cancel fires nothing', () => {
  let picked = null;
  const w = new ColorPickerWindow({ color: { rgb: [1, 0, 0], a: 1 }, onPicked: (h) => { picked = h; } });
  w.ok();
  assert.equal(picked, 'FF0000FF');
  assert.equal(w.done, true);
  picked = null;
  const w2 = new ColorPickerWindow({ color: { rgb: [1, 0, 0], a: 1 }, onPicked: (h) => { picked = h; } });
  w2.cancel();
  assert.equal(picked, null, 'CancelWindow - the old colour stands');
  // a typed alpha SURVIVES the OK - the one path that can carry it
  const w3 = new ColorPickerWindow({ color: { rgb: [1, 1, 1], a: 1 }, onPicked: (h) => { picked = h; } });
  for (let i = 0; i < 8; i++) w3.typeHex('\b');
  for (const ch of '404040D2') w3.typeHex(ch);
  w3.ok();
  assert.equal(picked, '404040D2');
});

// ---------------------------------------------------------------
// 4. THE LAYOUT AND THE SETTINGS SEAM
// ---------------------------------------------------------------

test('CP1: the geometry on a full page, and the elastic clamp on a phone page', () => {
  const g = colorPickerLayout(320, 200);
  assert.deepEqual(g.panel, [20, 40, 280, 120], '280x120 centred (:22-23, :80-82)');
  assert.deepEqual(g.preview, [114, 40, 186, 90], 'right-aligned at y 0 (:117-119)');
  assert.deepEqual(g.slider, [114, 135, 186, 10], '5 under the picture, 10 tall (:130-131)');
  assert.deepEqual(g.ok, [48, 115, 39, 22], '(panelW - previewW)/2 - okW/2 at y 75 (:112)');
  const n = colorPickerLayout(156, 200);
  assert.equal(n.panel[2], 148, 'the panel clamps to the page');
  assert.equal(n.preview[2], Math.trunc(148 / 3 * 2), "and the preview keeps DFU's (int) proportions of the clamped size");
});

test('CP1: a colour row opens the picker, OK commits the eight digits, Escape keeps the old value', () => {
  _resetForTests();
  setValue('GUI', 'ToolTipTextColor', 'FF0000FF');
  const win = new SettingsWindow();
  win._openColorPicker('GUI/ToolTipTextColor');
  assert.ok(win.colorPicker instanceof ColorPickerWindow);
  assert.equal(win.colorPicker.hexText, 'FF0000FF', 'seeded from the live value');
  // retype a new colour and OK through the window's own input router
  for (let i = 0; i < 8; i++) win.input('Backspace');
  for (const ch of '00FF00FF') win.input(`Key${ch}`, { key: ch });
  win.input('Enter');
  assert.equal(win.colorPicker, null, 'closed');
  assert.equal(getString('GUI', 'ToolTipTextColor'), '00FF00FF', 'the pick landed in the store');
  // Escape declines
  win._openColorPicker('GUI/ToolTipTextColor');
  for (let i = 0; i < 8; i++) win.input('Backspace');
  for (const ch of '12345678') win.input(`Key${ch}`, { key: ch });
  win.input('Escape');
  assert.equal(win.colorPicker, null);
  assert.equal(getString('GUI', 'ToolTipTextColor'), '00FF00FF', 'nothing fires on cancel');
  _resetForTests();
});

test('CP1: the wiring - the colour arm of _nudge opens the picker and the routing reaches all three surfaces', () => {
  const s = src('ui/settingsWindow.js');
  assert.match(s, /if \(it\.widget === 'colour'\) \{ this\._openColorPicker\(it\.key\); return; \}/,
    "a colour row's change gesture is the picker, not the read-only detail");
  assert.match(s, /if \(this\.colorPicker\) \{ this\.colorPicker\.wheel\(dir\); return; \}/);
  assert.match(s, /if \(this\.colorPicker\) \{\n      \/\/ CP1/, 'the click router owns the tap surfaces');
  assert.match(s, /cp\.sliderClick\(\(vx - g\.slider\[0\]\) \/ g\.slider\[2\]\)/);
});
