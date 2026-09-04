// ROAD-G G6: THE MOUSE / ADVANCED CONTROLS WINDOW, against
// DaggerfallUnityMouseControlsWindow.cs, HorizontalSlider.cs and
// DaggerfallUI.AddSlider - plus the ORDERING that makes the window
// work at all (its ten settings are written by the CONTROLS window's
// save, not by its own CONTINUE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MouseControlsWindow, MOUSE_PANEL, CONTINUE_RECT, TITLE_Y, ROW_SIZE, ROW_LABEL,
  ROW_BUTTON, KEYBIND_ROWS, SLIDER_PANEL, SLIDERS, CHECKBOXES, CHECK_SIZE,
  CHECK_TEXT_OFFSET, THRESHOLD, THRESHOLD_RANGE, SENSITIVITY_RANGE,
  SMOOTHING_FACTORS, SMOOTHING_STRENGTHS, WEAPON_SWING_MODES, MELEE_DETECTION_MODES,
  smoothingStrength, tryParseFloat, toNative,
} from '../src/ui/mouseControlsWindow.js';
import {
  makeSlider, setScrollIndex, sliderClick, sliderDrag, sliderGetValue, sliderThumb,
  indicatorText, roundToInt, SLIDER_DISPLAY_UNITS, SLIDER_HEIGHT,
  SLIDER_INDICATOR_OFFSET, THUMB_MIN_W, TINT, TROUGH_COLOR,
} from '../src/ui/horizontalSlider.js';
import { ControlsWindow, gridButtons, TAB_RECTS } from '../src/ui/controlsWindow.js';
import { createUnsavedKeybinds, currentDict } from '../src/systems/controlsConfig.js';
import { createBindings, resetDefaults, saveKeyBinds, onSavedKeyBinds } from '../src/systems/inputActions.js';
import {
  getBool, getFloat, getInt, setValue, effectiveSettings, _resetForTests,
} from '../src/systems/settings.js';
import { NUMBER_LAW } from '../src/ui/settingsLaw.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f) => readFileSync(join(root, 'src', f), 'utf8');
const freshStore = () => { const b = createBindings(); resetDefaults(b); return b; };
const freshWindow = () => { _resetForTests(); return new MouseControlsWindow(createUnsavedKeybinds(freshStore())); };

test('G6: the panel is DFU\'s 318x170 at Center/Middle, and every child rect is verbatim', () => {
  // mainPanelSize (:83) centred over the 320x200 native panel.
  assert.deepEqual([...MOUSE_PANEL], [1, 15, 318, 170]);
  assert.equal(MOUSE_PANEL[0], Math.round((320 - 318) / 2));
  assert.equal(MOUSE_PANEL[1], Math.round((200 - 170) / 2));
  // continueButton: 80x10, Right/Bottom (:104-110)
  assert.deepEqual([...CONTINUE_RECT], [318 - 80, 170 - 10, 80, 10]);
  assert.equal(TITLE_Y, 4);
  // the keybind row (:174-208): an 85x15 panel, a 40x10 label panel
  // and a 43x10 button pinned Right/Middle inside it.
  assert.deepEqual({ ...ROW_SIZE }, { w: 85, h: 15 });
  assert.deepEqual({ ...ROW_LABEL }, { w: 40, h: 10 });
  assert.deepEqual({ ...ROW_BUTTON }, { w: 43, h: 10, x: 85 - 43, y: (15 - 10) / 2 });
  assert.deepEqual(KEYBIND_ROWS.map((r) => `${r.action}@${r.x},${r.y}`), [
    'Escape@20,20', 'AutoRun@20,40', 'ToggleConsole@115,20',
    'PrintScreen@115,40', 'QuickSave@210,20', 'QuickLoad@210,40',
  ]);
  // CreateSlider's panel (:224-247) and the four anchors (:120-133)
  assert.deepEqual({ ...SLIDER_PANEL }, { w: 70, h: 45, troughY: 6 });
  assert.deepEqual(SLIDERS.map((s) => `${s.id}@${s.x},${s.y}`),
    ['mouseSmoothing@150,70', 'mouseSensitivity@20,70',
      'weaponSwingMode@150,90', 'meleeAttackDetection@20,145']);
  // the five AddOption calls (:122-131), and Checkbox.cs's 7x7 art
  assert.deepEqual(CHECKBOXES.map((c) => `${c.id}@${c.x},${c.y}`), [
    'invertMouseVertical@20,120', 'movementAcceleration@20,130',
    'bowDrawback@150,120', 'toggleSneak@150,130',
    'meleeAttackFriendlyProtection@150,145',
  ]);
  assert.equal(CHECK_SIZE, 7);
  assert.deepEqual([...CHECK_TEXT_OFFSET], [2, 1]);
  // AddTextbox (:253-283)
  assert.equal(THRESHOLD.x, 20);
  assert.equal(THRESHOLD.y, 90);
  assert.deepEqual([...THRESHOLD.box], [0, 10, 30, 6]);
  assert.equal(THRESHOLD.maxCharacters, 5);
  // panel-relative -> native
  assert.deepEqual(toNative(MouseControlsWindow.rowButtonRect(KEYBIND_ROWS[0])),
    [1 + 20 + 42, 15 + 20 + 2.5, 43, 10]);
});

test('G6: the six keybind buttons are EXACTLY the six DFU leaves off the classic grid', () => {
  const offered = new Set(gridButtons().map((b) => b.action));
  const here = KEYBIND_ROWS.map((r) => r.action);
  assert.equal(here.length, 6);
  assert.equal(new Set(here).size, 6, 'no action appears twice');
  for (const a of here) assert.ok(!offered.has(a), `${a} is already on the grid`);
  assert.equal(offered.size + here.length, 44, 'the two windows together cover the whole Actions enum bar none');
});

test('G6: HorizontalSlider - the units, the float x10, the indicator and the paging', () => {
  // AddSlider fixes DisplayUnits at 20 and the trough at 4 tall
  // (DaggerfallUI.cs:1110-1111), and the indicator sits 2 past it.
  assert.equal(SLIDER_DISPLAY_UNITS, 20);
  assert.equal(SLIDER_HEIGHT, 4);
  assert.equal(SLIDER_INDICATOR_OFFSET, 2);
  assert.equal(THUMB_MIN_W, 10);
  assert.deepEqual([...TROUGH_COLOR], [0.5, 0.5, 0.5, 0.3]);
  assert.deepEqual([...TINT], [1, 1, 0, 1], 'Color(153,153,0) saturates to yellow');

  // SetIndicator(float,float,float) (:203-212): x10, ROUNDED.
  const sens = makeSlider({ mode: 'float', min: 0.1, max: 16.0, start: 2.0 });
  assert.equal(sens.min, 1);
  assert.equal(sens.max, 160);
  assert.equal(sens.totalUnits, (160 - 1) + 20, 'SetDisplayUnits derives totalUnits (:266-272)');
  assert.equal(sens.scrollIndex, 20 - 1, 'the start is an INDEX off min');
  assert.equal(sliderGetValue(sens), 2.0);
  assert.equal(indicatorText(sens), '2.0', 'C#\'s "n1"');

  // MouseClick pages by DisplayUnits (:169-178) - two whole points.
  const rect = [0, 0, SLIDER_PANEL.w, SLIDER_HEIGHT];
  sliderClick(sens, rect, SLIDER_PANEL.w - 1);
  assert.equal(sliderGetValue(sens), 4.0);
  sliderClick(sens, rect, 0);
  assert.equal(sliderGetValue(sens), 2.0);
  // ...and the clamp holds at both ends (:279-291)
  for (let i = 0; i < 20; i++) sliderClick(sens, rect, 0);
  assert.equal(sliderGetValue(sens), 0.1);
  for (let i = 0; i < 20; i++) sliderClick(sens, rect, SLIDER_PANEL.w - 1);
  assert.equal(sliderGetValue(sens), 16.0);

  // the thumb: scaled by displayUnits/totalUnits with the 10px floor
  const thumb = sliderThumb(rect, 0, sens.totalUnits, sens.displayUnits);
  assert.equal(thumb[2], THUMB_MIN_W, '70 * 20/179 is under the floor');
  assert.equal(sliderThumb(rect, 0, 10, 20), null, 'nothing to scroll, no thumb');

  // MultipleChoices (:222-227, :358-359)
  const swing = makeSlider({ mode: 'choices', items: WEAPON_SWING_MODES, selected: 2 });
  assert.equal(swing.totalUnits, 2 + 20);
  assert.equal(indicatorText(swing), 'Hold');
  setScrollIndex(swing, 0);
  assert.equal(indicatorText(swing), 'Vanilla');

  // the drag TRUNCATES toward zero against Size.x/totalUnits (:141-146)
  const s2 = makeSlider({ mode: 'float', min: 0.1, max: 16.0, start: 0.1 });
  sliderDrag(s2, SLIDER_PANEL.w, SLIDER_PANEL.w / s2.totalUnits * 5.9, 0);
  assert.equal(s2.scrollIndex, 5);

  // Mathf.RoundToInt is banker's rounding, not Math.round
  assert.equal(roundToInt(0.5), 0);
  assert.equal(roundToInt(1.5), 2);
  assert.equal(roundToInt(2.5), 2);
});

test('G6: the smoothing table is DFU\'s six factors, and the strength is an EXACT match or 0', () => {
  assert.deepEqual([...SMOOTHING_FACTORS], [0.0, 0.3, 0.4, 0.5, 0.6, 0.7]);
  assert.equal(SMOOTHING_STRENGTHS.length, SMOOTHING_FACTORS.length);
  assert.deepEqual([...SMOOTHING_STRENGTHS], ['None', 'Lowest', 'Low', 'Medium', 'High', 'Highest']);
  assert.deepEqual([...WEAPON_SWING_MODES], ['Vanilla', 'Click', 'Hold']);
  assert.deepEqual([...MELEE_DETECTION_MODES], ['Performance', 'Quality']);
  assert.equal(smoothingStrength(0.5), 3, 'the shipped default');
  assert.equal(smoothingStrength(0.0), 0);
  assert.equal(smoothingStrength(0.7), 5);
  // GetMouseLookSmoothingStrength (:359-368) returns 0 for anything
  // NOT in the table - a stored 0.45 reads as "None", not as nearest.
  assert.equal(smoothingStrength(0.45), 0);
});

test('G6: the sensitivity slider is DFU\'s 0.1..16.0, end to end', () => {
  // SettingsManager.cs:524 clamps at exactly the range the window's
  // slider offers (:121), and the port's own consumer and settings row
  // agree with both - the range-equals-clamp law, satisfied by
  // widening to DFU rather than by narrowing the window.
  assert.deepEqual([...SENSITIVITY_RANGE], [0.1, 16.0]);
  assert.match(code('ui/lookSettings.js'),
    /getFloat\('Controls', 'MouseLookSensitivity', 0\.1, 16\.0\)/);
  assert.equal(NUMBER_LAW['Controls/MouseLookSensitivity'].min, 0.1);
  assert.equal(NUMBER_LAW['Controls/MouseLookSensitivity'].max, 16.0);
});

test('G6: OnUpdateValues writes all nine controls, and TryParse gates the tenth', () => {
  const w = freshWindow();
  setScrollIndex(w.sliders.mouseSensitivity, w.sliders.mouseSensitivity.scrollIndex + 20);
  setScrollIndex(w.sliders.mouseSmoothing, 5);
  setScrollIndex(w.sliders.weaponSwingMode, 2);
  setScrollIndex(w.sliders.meleeAttackDetection, 1);
  for (const c of CHECKBOXES) w.checks[c.id] = !w.checks[c.id];
  const before = getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE);

  w.applyValues();
  assert.equal(getFloat('Controls', 'MouseLookSensitivity', ...SENSITIVITY_RANGE), 4.0);
  assert.equal(getFloat('Controls', 'MouseLookSmoothingFactor', 0, 0.9), 0.7);
  assert.equal(getInt('Controls', 'WeaponSwingMode', 0, 2), 2);
  assert.equal(Number(effectiveSettings().MeleeAttacks.MeleeAttackDetection), 1);
  assert.equal(getBool('Controls', 'InvertMouseVertical'), true);
  assert.equal(getBool('Controls', 'MovementAcceleration'), true);
  assert.equal(getBool('Controls', 'BowDrawback'), true);
  assert.equal(getBool('Controls', 'ToggleSneak'), true);
  assert.equal(getBool('MeleeAttacks', 'MeleeAttackFriendlyProtection'), false);

  // THE QUIRK (:353-355 over TextBox.cs:342-343): an untouched box
  // reports the EMPTY string - DefaultText is display only - so
  // float.TryParse fails and the threshold is left exactly as it was.
  assert.equal(getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE), before);
  assert.equal(tryParseFloat(''), null);
  assert.equal(tryParseFloat('  0.25 '), 0.25);
  assert.equal(tryParseFloat('0.2x'), null);
  // ...and a typed value IS written, through Mathf.Clamp (:355)
  w.threshold.text = '9';
  w.applyValues();
  assert.equal(getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE), THRESHOLD_RANGE[1]);
  w.threshold.text = '0';
  w.applyValues();
  assert.equal(getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE), THRESHOLD_RANGE[0]);
  w.dispose();
});

test('G6: Setup reads all ten values out of the store', () => {
  // Every control shows what is STORED when the window opens (:120-135)
  // - a window that opened on its own defaults would quietly reset the
  // player's settings the next time the grid saved.
  _resetForTests();
  setValue('Controls', 'MouseLookSensitivity', '3.5');
  setValue('Controls', 'MouseLookSmoothingFactor', '0.6');
  setValue('Controls', 'WeaponSwingMode', '1');
  setValue('MeleeAttacks', 'MeleeAttackDetection', '1');
  setValue('Controls', 'WeaponAttackThreshold', '0.02');
  for (const c of CHECKBOXES) setValue(c.section, c.key, true);
  const w = new MouseControlsWindow(createUnsavedKeybinds(freshStore()));
  assert.equal(sliderGetValue(w.sliders.mouseSensitivity), 3.5);
  assert.equal(w.sliders.mouseSmoothing.scrollIndex, 4, 'GetMouseLookSmoothingStrength(0.6)');
  assert.equal(w.sliders.weaponSwingMode.scrollIndex, 1);
  assert.equal(w.sliders.meleeAttackDetection.scrollIndex, 1);
  assert.equal(w.threshold.defaultText, '0.02', 'DefaultText is the stored value (:277)');
  assert.equal(w.threshold.text, '', 'Text starts EMPTY - DefaultText is display only');
  for (const c of CHECKBOXES) assert.equal(w.checks[c.id], true, c.id);
  w.dispose();
});

test('G6: the values land on the KEYBIND SAVE, which is the controls window\'s close', () => {
  // Setup subscribes OnUpdateValues to InputManager.OnSavedKeyBinds
  // (:78) and CONTINUE only calls CancelWindow (:369-376), so the
  // ordering is DFU's: nothing this window holds reaches the store
  // until the grid saves.
  _resetForTests();
  const w = new MouseControlsWindow(createUnsavedKeybinds(freshStore()));
  setScrollIndex(w.sliders.mouseSmoothing, 0);
  w.checks.invertMouseVertical = true;

  // its own CONTINUE writes NOTHING
  w.click(...[toNative(CONTINUE_RECT)[0] + 1, toNative(CONTINUE_RECT)[1] + 1]);
  assert.equal(w.done, true);
  assert.equal(getBool('Controls', 'InvertMouseVertical'), false, 'CancelWindow is not a save');

  // the keybind save is what pays it out
  saveKeyBinds(freshStore());
  assert.equal(getBool('Controls', 'InvertMouseVertical'), true);
  assert.equal(getFloat('Controls', 'MouseLookSmoothingFactor', 0, 0.9), 0.0);

  // ...and dispose detaches, so a closed window stops writing
  w.dispose();
  w.checks.invertMouseVertical = false;
  saveKeyBinds(freshStore());
  assert.equal(getBool('Controls', 'InvertMouseVertical'), true, 'a disposed window is off the event');
});

test('G6: the event has ONE home and every listener is shielded', () => {
  // A listener that throws must not make a keybind write fail - the
  // shield settings.js already puts on its own publisher.
  const seen = [];
  const offA = onSavedKeyBinds(() => { throw new Error('bad listener'); });
  const offB = onSavedKeyBinds(() => seen.push('b'));
  saveKeyBinds(freshStore());
  assert.deepEqual(seen, ['b']);
  offA(); offB();
  saveKeyBinds(freshStore());
  assert.deepEqual(seen, ['b'], 'unsubscribed listeners stop firing');
});

test('G6: the ADVANCED tab opens it over the grid, on the SAME staged dicts', () => {
  const cw = new ControlsWindow({});
  assert.equal(cw.advancedOpen, false);
  cw.click(TAB_RECTS.advanced[0] + 1, TAB_RECTS.advanced[1] + 1);
  assert.equal(cw.advancedOpen, true);
  assert.ok(cw.advanced instanceof MouseControlsWindow);
  // DFU's two windows edit ControlsConfigManager.Instance - ONE object
  assert.equal(cw.advanced.unsaved, cw.unsaved, 'the popup stages into the grid\'s dicts');

  // a rebind made in the popup is staged where the grid's close applies it
  const btn = toNative(MouseControlsWindow.rowButtonRect(KEYBIND_ROWS[0]));
  cw.click(btn[0] + 1, btn[1] + 1);
  assert.equal(cw.advanced.capture, 'Escape');
  cw.input('KeyJ');
  assert.equal(currentDict(cw.unsaved).get('Escape'), 'KeyJ');

  // CONTINUE pops back onto the grid, which re-checks duplicates
  const cont = toNative(CONTINUE_RECT);
  cw.click(cont[0] + 1, cont[1] + 1);
  assert.equal(cw.advancedOpen, false);
  assert.equal(cw.done, false, 'the grid is still open underneath');
  // ...and the cached instance re-opens rather than being rebuilt
  const first = cw.advanced;
  cw.click(TAB_RECTS.advanced[0] + 1, TAB_RECTS.advanced[1] + 1);
  assert.equal(cw.advanced, first);
  assert.equal(cw.advancedOpen, true);
  cw.advanced.dispose();
});

test('G6: the JOYSTICK tab still answers with its note, and the grid still owns the wiring', () => {
  // The joystick window stays unbuilt by owner decision (Ledger); the
  // note that sends the reader there must not have been collected by
  // this slice along with the advanced one.
  const cw = new ControlsWindow({});
  cw.click(TAB_RECTS.joystick[0] + 1, TAB_RECTS.joystick[1] + 1);
  assert.equal(cw.top, 'note');
  assert.deepEqual(cw._noteRows, ['The port has no gamepad layer (Ledger).']);
  assert.equal(cw.advancedOpen, false);
  // ...and the grid's own close is what disposes the popup, AFTER the
  // save that pays its settings out.
  const src = code('ui/controlsWindow.js');
  assert.match(src, /saveKeyBinds\(bindings\(\)\);[\s\S]*?this\.advanced\?\.dispose\(\);/,
    'dispose must come after the save, or the last raise is lost');
  // ...and DaggerfallUI draws ONLY the top window (DaggerfallUI.cs:489-492),
  // so while the popup is up the grid hands the frame over whole.
  assert.match(src, /if \(this\.advancedOpen\) \{ this\.advanced\.draw\(renderer, canvas, font\); return; \}/,
    'the popup must be what draws while it is open');
});

test('G6: the checkboxes, the field focus and the capture take pointer input', () => {
  const w = freshWindow();
  const c = CHECKBOXES[0];
  const box = toNative([c.x, c.y, CHECK_SIZE, CHECK_SIZE]);
  const was = w.checks[c.id];
  w.click(box[0] + 1, box[1] + 1);
  assert.equal(w.checks[c.id], !was);

  const field = toNative(MouseControlsWindow.thresholdBoxRect());
  w.click(field[0] + 1, field[1] + 1);
  assert.equal(w.threshold.focus, true, 'UseFocus (:281)');
  w.input('Digit1', { key: '1' });
  w.input('Period', { key: '.' });
  for (const ch of '2345') w.input('Key', { key: ch });
  assert.equal(w.threshold.text, '1.234', 'MaxCharacters 5 (:275)');
  w.input('Backspace');
  assert.equal(w.threshold.text, '1.23');

  // a RIGHT click on a bound row prompts to remove it (:377-386)
  const btn = toNative(MouseControlsWindow.rowButtonRect(KEYBIND_ROWS[4]));
  w.click(btn[0] + 1, btn[1] + 1, true);
  assert.equal(w.top, 'remove');
  w.input('KeyY');
  assert.equal(currentDict(w.unsaved).get('QuickSave'), null);
  w.dispose();
});

test('G6: HorizontalSlider.cs has ONE home, and the topic bar uses it', () => {
  // nativeTalk.js carried half of DrawSlider before this slice.
  const talk = code('ui/nativeTalk.js');
  assert.match(talk, /import \{ sliderThumb \} from '\.\/horizontalSlider\.js';/);
  assert.match(talk, /export const topicSliderThumb = sliderThumb;/);
  assert.equal(/const thumbW = Math\.max\(10,/.test(talk), false,
    'the second copy of the thumb arithmetic is gone');
  // ...and SetScrollIndex's clamp is the vertical bar's, which is where
  // DFU itself took it from ("Reused code from VerticalScrollBar").
  assert.match(code('ui/horizontalSlider.js'),
    /export \{ clampScrollIndex \} from '\.\/verticalScrollBar\.js';/);
});
