// DLG1 + WM1: the enhanced decision box and the windows' open/close motion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dialogFits, dialogSig, BUTTON_LABELS, BUTTON_KEYS, PRIMARY_BUTTONS, drawEnhancedDialog } from '../src/ui/enhancedDialog.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';
import { motionEnabled, MOTION_WINDOWS } from '../src/ui/windowMotion.js';
import { PLUS_CSS as ENHANCED_CSS } from '../src/ui/enhancedPlusStyle.js';   // PLUS1: the refresh's dress is the Enhanced Plus sheet

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const yn = { rows: [{ text: 'Exit?' }], buttons: [{ button: MB_BUTTONS.Yes, rect: [0, 0, 32, 16] }, { button: MB_BUTTONS.No, rect: [64, 0, 32, 16] }] };

test('DLG1: every MessageBoxButtons value has words, and Y/N name the keys the windows already take', () => {
  for (const [name, v] of Object.entries(MB_BUTTONS)) assert.ok(BUTTON_LABELS[v], `${name} has a label`);
  assert.equal(BUTTON_KEYS[MB_BUTTONS.Yes], 'Y');
  assert.equal(BUTTON_KEYS[MB_BUTTONS.No], 'N');
  assert.ok(PRIMARY_BUTTONS.has(MB_BUTTONS.Yes) && PRIMARY_BUTTONS.has(MB_BUTTONS.OK));
});

test('DLG1: only a box that asks, with words for every button and no painting, is taken', () => {
  assert.equal(dialogFits(yn), true);
  assert.equal(dialogFits({ rows: [], buttons: [] }), false, 'a notice is the notice panel\'s');
  assert.equal(dialogFits({ ...yn, image: [0, 0, 1, 1] }), false, 'the painting arm stays on the canvas');
  assert.equal(dialogFits({ ...yn, buttons: [{ button: 99, rect: [0, 0, 1, 1] }] }), false, 'an unknown mod button keeps its art');
});

test('DLG1: a box is known by what it says, so a per-frame re-layout is one dialog', () => {
  assert.equal(dialogSig(yn), dialogSig({ ...yn, buttons: yn.buttons.map((b) => ({ ...b })) }));
  assert.notEqual(dialogSig(yn), dialogSig({ ...yn, rows: [{ text: 'Delete?' }] }));
});

test('DLG1: with no document (node, the classic path) nothing is taken', () => {
  assert.equal(drawEnhancedDialog(null, { ox: 0, oy: 0, s: 1 }, yn, {}, undefined), false);
});

test('DLG1: drawMessageBox hands a box to the dialog under the enhanced skin only, before the classic draw', () => {
  const src = read('src/ui/messageBox.js');
  const at = src.indexOf('isEnhancedPlus() && drawEnhancedDialog(renderer, m, box, { image })');
  assert.ok(at > 0);
  assert.ok(at < src.indexOf('drawFrame(renderer, m, box);', at), 'it runs before the parchment is drawn');
});

test('WM1: motion is off under automation (the probes) unless asked for', () => {
  const win = (search, webdriver) => ({ location: { search }, navigator: { webdriver } });
  assert.equal(motionEnabled(win('', false)), true);
  assert.equal(motionEnabled(win('', true)), false);
  assert.equal(motionEnabled(win('?motion', true)), true);
  assert.equal(motionEnabled(win('?nomotion', false)), false);
});

test('WM1 + DLG1: the sheet carries the motion and the dialog, with the kit still last', () => {
  assert.ok(ENHANCED_CSS.includes('WM1: WINDOWS UNFOLD AND FOLD'));
  assert.ok(ENHANCED_CSS.includes('DLG1: THE DECISION BOX'));
  assert.ok(MOTION_WINDOWS.includes('.dlg-win'));
  assert.ok(ENHANCED_CSS.lastIndexOf('FRAME1: THE STONE-AND-BRASS KIT') > ENHANCED_CSS.lastIndexOf('WM1: WINDOWS'));
});
