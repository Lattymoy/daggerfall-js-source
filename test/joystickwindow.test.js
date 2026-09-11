// GP2 (2026-09-11): THE JOYSTICK CONTROLS WINDOW against
// DaggerfallJoystickControlsWindow.cs, and the ORDERING that makes it
// work (its staging is the grid's, saved at the grid's close).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  JoystickControlsWindow, createJoystickUnsaved, resetJoystickUnsaved, saveJoystickSettings, joystickDuplicates,
  JOY_PANEL, AXIS_ROWS, UI_ROWS, JOY_SLIDERS, ENABLE_BOX, UI_KEYS, TITLE, toNative,
} from '../src/ui/joystickControlsWindow.js';
import { MOUSE_PANEL, CONTINUE_RECT, ROW_BUTTON, CHECK_SIZE } from '../src/ui/mouseControlsWindow.js';
import { ControlsWindow, TAB_RECTS } from '../src/ui/controlsWindow.js';
import { createBindings, resetDefaults, getAxisBinding, getJoystickUIBinding, getAxisInversion, setAxisBinding } from '../src/systems/inputActions.js';
import { setBindings } from '../src/ui/input.js';
import { sliderGetValue } from '../src/ui/horizontalSlider.js';
import { getBool, getFloat, setValue, _resetForTests } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f) => readFileSync(join(root, 'src', f), 'utf8');
const freshStore = () => { const b = createBindings(); resetDefaults(b); return b; };
const FONT = { fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 }, tex: 'atlas' };
const CANVAS = { width: 320, height: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }) };
const recorder = () => { const quads = []; return { quads, screenOffset: [0, 0], uploadTexture: () => ({}), drawScreenQuad(tex, rect, uv, color) { quads.push({ rect, color }); } }; };
const center = ([x, y, w, h]) => [x + w / 2, y + h / 2];

test('GP2 the layout: the same panel as the mouse window, the rows on its row geometry at DFU\'s anchors, the invert boxes twenty below their axis rows, the four sliders with DFU\'s ranges, the strings (mutant: an anchor moved)', () => {
  assert.equal(JOY_PANEL, MOUSE_PANEL);
  assert.deepEqual(AXIS_ROWS.map((r) => [r.action, r.x, r.y]), [['MovementHorizontal', 20, 40], ['MovementVertical', 20, 80], ['CameraHorizontal', 115, 40], ['CameraVertical', 115, 80]]);
  for (const r of AXIS_ROWS) assert.deepEqual([r.invert.x, r.invert.y], [r.x + 43, r.y + 20], `${r.action}: AddOption(x+43, y+20)`);
  assert.deepEqual(UI_ROWS.map((r) => [r.action, r.x, r.y]), [['LeftClick', 210, 40], ['MiddleClick', 210, 60], ['RightClick', 210, 80], ['Back', 210, 100]]);
  assert.deepEqual(JOY_SLIDERS.map((s) => [s.key, s.x, s.y, s.min, s.max]), [
    ['JoystickLookSensitivity', 15, 120, 0.1, 4.0], ['JoystickCursorSensitivity', 115, 120, 0.1, 5.0],
    ['JoystickMovementThreshold', 215, 120, 0.0, 1.0], ['JoystickDeadzone', 15, 140, 0.0, 0.9]]);
  assert.deepEqual([ENABLE_BOX.x, ENABLE_BOX.y], [20, 20]);
  assert.deepEqual(JoystickControlsWindow.rowButtonRect(AXIS_ROWS[0]), [20 + ROW_BUTTON.x, 40 + ROW_BUTTON.y, 43, 10]);
  assert.equal(TITLE, 'Configure Joystick Controls');
  assert.deepEqual(UI_KEYS, { LeftClick: 'Left-Click', MiddleClick: 'Middle-Click', RightClick: 'Right-Click', Back: 'Back' });
  assert.deepEqual(JOY_SLIDERS.map((s) => s.label), ['Look Sensitivity', 'UI Mouse Sensitivity', 'Maximum Movement Threshold', 'Deadzone']);
});

test('GP2 the staging: ResetUnsavedSettings reads the store and the settings; SaveSettings writes the settings and inversions, rebinds ONLY what changed, and re-reads (mutant: an unchanged binding re-set, or an inversion dropped)', () => {
  _resetForTests();
  const store = freshStore();
  const u = createJoystickUnsaved(store);
  assert.equal(u.keybinds.get('Left-Click'), 'JoystickButton0');
  assert.equal(u.keybinds.get('Back'), 'JoystickButton1');
  assert.equal(u.keybinds.get('CameraVertical'), 'Axis5');
  assert.deepEqual(u.settings.invert, { MovementHorizontal: false, MovementVertical: false, CameraHorizontal: false, CameraVertical: false });
  assert.equal(u.settings.deadzone, 0.1);
  // stage changes
  u.keybinds.set('Back', 'JoystickButton7');
  u.keybinds.set('CameraHorizontal', 'Axis3');
  u.settings.invert.CameraVertical = true;
  u.settings.deadzone = 0.25; u.settings.enableController = false;
  let axisSets = 0;
  const origSet = store.axisActions.set.bind(store.axisActions);
  store.axisActions.set = (k, v) => { axisSets++; return origSet(k, v); };
  saveJoystickSettings(store, u);
  assert.equal(getJoystickUIBinding(store, 'Back'), 'JoystickButton7');
  assert.equal(getAxisBinding(store, 'CameraHorizontal'), 'Axis3');
  assert.equal(getAxisBinding(store, 'MovementHorizontal'), 'Axis1', 'untouched');
  assert.equal(axisSets, 1, 'one axis rebound: the changed one');
  assert.equal(getAxisInversion(store, 'CameraVertical'), true);
  assert.equal(getFloat('Controls', 'JoystickDeadzone', 0, 1), 0.3, 'the slider\'s tenth');
  assert.equal(getBool('Controls', 'EnableController'), false);
  assert.equal(u.settings.deadzone, 0.3, 're-read after the save');
  setValue('Controls', 'EnableController', true);
  resetJoystickUnsaved(store, u);
  assert.equal(u.settings.enableController, true);
  _resetForTests();
});

test('GP2 the window: OnPush reads the staging into the controls, OnPop reads them back; the capture binds an axis row to the axis of an axis key and reverts on any other, a UI row to any key but a bound axis\'s; duplicates redden and gate CONTINUE and Escape behind the box, which any click or key closes; Enable Controller writes the setting at once and follows it every frame (mutant: the axis capture keeping a button, or the gate dropped)', () => {
  _resetForTests();
  const store = freshStore(); setBindings(store);
  try {
    const u = createJoystickUnsaved(store);
    let backs = 0;
    const w = new JoystickControlsWindow(u, { onBack: () => backs++ });
    w.onPush();
    assert.equal(sliderGetValue(w.sliders.deadzone), 0.1);
    assert.equal(w.checks.enableController, true);
    // the axis capture
    const camH = toNative(JoystickControlsWindow.rowButtonRect(AXIS_ROWS[2]));
    w.click(...center(camH));
    assert.deepEqual(w.capture, { action: 'CameraHorizontal', axis: true });
    assert.equal(w.rowLabel(AXIS_ROWS[2], true), '', 'blank while waiting');
    assert.equal(w.allowCancel, false);
    w.input('JoystickButton3');
    assert.equal(w.capture, null); assert.equal(u.keybinds.get('CameraHorizontal'), 'Axis4', 'a button is not an axis: reverted');
    w.click(...center(camH)); w.input('JoystickAxis3Button1');
    assert.equal(u.keybinds.get('CameraHorizontal'), 'Axis3', 'the AXIS of the axis key, either half');
    assert.equal(w.rowLabel(AXIS_ROWS[2], true), 'Axis3');
    // the UI capture: a keyboard key binds; an axis key of a bound axis is ignored; a free axis key binds
    const back = toNative(JoystickControlsWindow.rowButtonRect(UI_ROWS[3]));
    w.click(...center(back)); w.input('KeyQ');
    assert.equal(u.keybinds.get('Back'), 'KeyQ');
    w.click(...center(back)); w.input('JoystickAxis1Button0');
    assert.equal(w.capture !== null, true, 'Axis1 is bound to movement: not a key here (GetAnyKeyDownIgnoreAxisBinds)');
    w.input('JoystickAxis9Button0');
    assert.equal(u.keybinds.get('Back'), 'JoystickAxis9Button0', 'a trigger, unbound as an axis, is a key');
    assert.equal(w.rowLabel(UI_ROWS[3], false), '...', 'elongated past ten characters');
    // duplicates: Left-Click onto Right-Click's button
    const left = toNative(JoystickControlsWindow.rowButtonRect(UI_ROWS[0]));
    w.click(...center(left)); w.input('JoystickButton3');
    assert.ok(w.dupes.has('JoystickButton3') && !w.allowCancel);
    w.click(...center(toNative(CONTINUE_RECT)));
    assert.equal(w.top, 'multiple'); assert.equal(w.done, false, 'refused');
    w.click(5, 5); assert.equal(w.top, null, 'ClickAnywhereToClose');
    w.input('Escape'); assert.equal(w.top, 'multiple', 'the back door obeys the same gate');
    w.input('KeyA'); assert.equal(w.top, null);
    // and an axis clash reddens too (axes and keys in one list)
    const movH = toNative(JoystickControlsWindow.rowButtonRect(AXIS_ROWS[0]));
    w.click(...center(movH)); w.input('JoystickAxis3Button0');
    assert.ok(w.dupes.has('Axis3'));
    // resolve them
    w.click(...center(left)); w.input('JoystickButton0');
    w.click(...center(movH)); w.input('JoystickAxis1Button0');
    assert.equal(joystickDuplicates(u).size, 0);
    // Enable Controller: the setting at once, and followed every frame
    const box = toNative(JoystickControlsWindow.checkboxRect(ENABLE_BOX, null));
    w.click(box[0] + 1, box[1] + 1);
    assert.equal(getBool('Controls', 'EnableController'), false, 'written at once (:522-526)');
    setValue('Controls', 'EnableController', true); w.tick(1 / 60);
    assert.equal(w.checks.enableController, true, 'Update re-reads it (:96-102)');
    // an invert box, a slider, then OnPop reads the controls into the staging
    const inv = toNative(JoystickControlsWindow.checkboxRect(AXIS_ROWS[3].invert, null));
    w.click(inv[0] + 1, inv[1] + 1);
    const trough = toNative(JoystickControlsWindow.sliderTroughRect(JOY_SLIDERS[3]));
    w.click(trough[0] + trough[2] - 1, trough[1] + 1);
    w.onPop();
    assert.equal(u.settings.invert.CameraVertical, true);
    assert.ok(u.settings.deadzone > 0.5, `the deadzone slider clicked at its end: ${u.settings.deadzone}`);
    // CONTINUE with a clean sheet: CancelWindow
    w.click(...center(toNative(CONTINUE_RECT)));
    assert.equal(w.done, true); assert.equal(backs, 1);
    // draw runs against a recording renderer - the panel, the rows'
    // buttons and the box all land as quads
    const r = recorder();
    w.top = 'multiple';
    w.draw(r, CANVAS, FONT);
    assert.ok(r.quads.length > 20, `the panel, its outline, eight buttons, five boxes, four troughs: ${r.quads.length}`);
    assert.equal(CHECK_SIZE, 7);
  } finally { setBindings(null); _resetForTests(); }
});

test('GP2 the grid: the JOYSTICK tab pushes the window on the grid\'s staging, the popup takes input, hover, wheel, release, tick and draw while it is up, its close reads the controls back, Y to defaults re-reads the staging, and the grid\'s own close SAVES the joystick settings after the keybinds (mutant: the save dropped, or done before the keybind save)', () => {
  _resetForTests();
  const store = freshStore(); setBindings(store);
  try {
    let backs = 0;
    const cw = new ControlsWindow({ onBack: () => backs++ });
    assert.ok(cw.unsaved.joystick, 'ResetUnsavedSettings at Setup');
    cw.click(TAB_RECTS.joystick[0] + 1, TAB_RECTS.joystick[1] + 1);
    assert.equal(cw.joystickOpen, true);
    assert.match(code('ui/controlsWindow.js'), /if \(this\._popup\) \{ this\._popup\.draw\(renderer, canvas, font\); return; \}/, 'the popup draws, the grid does not (the grid\'s own draw needs CNFG00I0, which no test has)');
    // a capture through the grid's input seam
    const camV = toNative(JoystickControlsWindow.rowButtonRect(AXIS_ROWS[3]));
    cw.click(...center(camV)); cw.input('JoystickAxis6Button0');
    assert.equal(cw.unsaved.joystick.keybinds.get('CameraVertical'), 'Axis6');
    cw.hover(...center(camV)); cw.wheel(1); cw.release(); cw.tick(1 / 60);
    cw.input('Escape');
    assert.equal(cw.joystickOpen, false, 'closed, and the grid is back');
    // the grid's close saves the joystick staging AFTER the keybinds
    cw.input('Escape');
    assert.equal(cw.done, true); assert.equal(backs, 1);
    assert.equal(getAxisBinding(store, 'CameraVertical'), 'Axis6', 'saved through SaveSettings');
    const src = code('ui/controlsWindow.js');
    assert.match(src, /saveKeyBinds\(bindings\(\)\);\n(\s*\/\/[^\n]*\n)*\s*saveJoystickSettings\(bindings\(\), this\.unsaved\.joystick\);/, 'the joystick save rides the grid\'s OnPop, after the keybind save');
    assert.match(src, /resetJoystickUnsaved\(bindings\(\), this\.unsaved\.joystick\);/, 'SetDefaults re-reads the staging');
    // Y to defaults resets the store's joystick dicts and the staging with them
    const cw2 = new ControlsWindow({});
    setAxisBinding(store, 'Axis9', 'CameraVertical'); cw2.unsaved.joystick.keybinds.set('CameraVertical', 'Axis9');
    cw2.top = 'defaults'; cw2.input('KeyY');
    assert.equal(getAxisBinding(store, 'CameraVertical'), 'Axis5');
    assert.equal(cw2.unsaved.joystick.keybinds.get('CameraVertical'), 'Axis5');
    // the poller edges every axis key and holds the move codes back under a window
    const poller = code('ui/gamepadInput.js');
    assert.match(poller, /for \(let key = AXIS_KEY_BASE; key < AXIS_KEY_BASE \+ NUM_AXES \* 2; key\+\+\) if \(axisKeyDown\(axes, key\)\) wanted\.add\(axisKeyName\(key\)\);/);
    assert.match(poller, /if \(mh && mvn && !overlay\) \{/);
    assert.doesNotMatch(src, /_noteRows = \['The pad plays/, 'the note is gone');
  } finally { setBindings(null); _resetForTests(); }
});
