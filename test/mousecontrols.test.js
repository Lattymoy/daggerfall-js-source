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
import {
  createUnsavedKeybinds, currentDict, setUnsavedBinding, removeKeybindPromptRows,
} from '../src/systems/controlsConfig.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { createBindings, resetDefaults, saveKeyBinds, onSavedKeyBinds } from '../src/systems/inputActions.js';
import {
  getBool, getFloat, getInt, setValue, effectiveSettings, _resetForTests,
} from '../src/systems/settings.js';
import { NUMBER_LAW } from '../src/ui/settingsLaw.js';
import { measureText } from '../src/ui/text.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f) => readFileSync(join(root, 'src', f), 'utf8');
const freshStore = () => { const b = createBindings(); resetDefaults(b); return b; };
const freshWindow = () => { _resetForTests(); return new MouseControlsWindow(createUnsavedKeybinds(freshStore())); };

const FONT = { fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 }, tex: 'atlas' };
const CANVAS = {
  width: 320,
  height: 200,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
};
/** A renderer that records its quads, so a COLOUR is assertable. */
const recorder = () => {
  const quads = [];
  return {
    quads,
    screenOffset: [0, 0],
    uploadTexture: () => ({}),
    drawScreenQuad(tex, rect, uv, color) { quads.push({ rect, color }); },
  };
};
/** One draw, which is what fills the font-dependent hit rects. */
const drawOnce = (w) => { w.draw(recorder(), CANVAS, FONT); return w; };

/** The sensitivity slider's thumb, in native coordinates. */
function thumbAt(w, id = 'mouseSensitivity') {
  const spec = SLIDERS.find((s) => s.id === id);
  const rect = toNative(MouseControlsWindow.sliderTroughRect(spec));
  const s = w.sliders[id];
  const thumb = sliderThumb([0, 0, SLIDER_PANEL.w, SLIDER_HEIGHT], s.scrollIndex, s.totalUnits, s.displayUnits);
  assert.ok(thumb, 'the sensitivity slider has a thumb');
  return { rect, x: rect[0] + thumb[0] + 1, y: rect[1] + 1 };
}

test('G6: the panel is DFU\'s 318x170 at Center/Middle, and every child rect is verbatim', () => {
  // mainPanelSize (:89) centred over the 320x200 native panel.
  assert.deepEqual([...MOUSE_PANEL], [1, 15, 318, 170]);
  assert.equal(MOUSE_PANEL[0], Math.round((320 - 318) / 2));
  assert.equal(MOUSE_PANEL[1], Math.round((200 - 170) / 2));
  // continueButton: 80x10, Right/Bottom (:107-113)
  assert.deepEqual([...CONTINUE_RECT], [318 - 80, 170 - 10, 80, 10]);
  assert.equal(TITLE_Y, 4);
  // the keybind row (:173-213): an 85x15 panel, a 40x10 label panel
  // and a 43x10 button pinned Right/Middle inside it.
  assert.deepEqual({ ...ROW_SIZE }, { w: 85, h: 15 });
  assert.deepEqual({ ...ROW_LABEL }, { w: 40, h: 10 });
  assert.deepEqual({ ...ROW_BUTTON }, { w: 43, h: 10, x: 85 - 43, y: (15 - 10) / 2 });
  assert.deepEqual(KEYBIND_ROWS.map((r) => `${r.action}@${r.x},${r.y}`), [
    'Escape@20,20', 'AutoRun@20,40', 'ToggleConsole@115,20',
    'PrintScreen@115,40', 'QuickSave@210,20', 'QuickLoad@210,40',
  ]);
  // CreateSlider's panel (:228-249) and the four anchors (:123-132)
  assert.deepEqual({ ...SLIDER_PANEL }, { w: 70, h: 45, troughY: 6 });
  assert.deepEqual(SLIDERS.map((s) => `${s.id}@${s.x},${s.y}`),
    ['mouseSmoothing@150,70', 'mouseSensitivity@20,70',
      'weaponSwingMode@150,90', 'meleeAttackDetection@20,145']);
  // the five AddOption calls (:125-133), and Checkbox.cs's 7x7 ART
  assert.deepEqual(CHECKBOXES.map((c) => `${c.id}@${c.x},${c.y}`), [
    'invertMouseVertical@20,120', 'movementAcceleration@20,130',
    'bowDrawback@150,120', 'toggleSneak@150,130',
    'meleeAttackFriendlyProtection@150,145',
  ]);
  assert.equal(CHECK_SIZE, 7);
  assert.deepEqual([...CHECK_TEXT_OFFSET], [2, 1]);
  // AddTextbox (:285-319)
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

  // THE QUIRK (:364-366 over TextBox.cs:342-343): an untouched box
  // reports the EMPTY string - DefaultText is display only - so
  // float.TryParse fails and the threshold is left exactly as it was.
  assert.equal(getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE), before);
  assert.equal(tryParseFloat(''), null);
  assert.equal(tryParseFloat('  0.25 '), 0.25);
  assert.equal(tryParseFloat('0.2x'), null);
  // ...and a typed value IS written, through Mathf.Clamp (:366)
  w.threshold.text = '9';
  w.applyValues();
  assert.equal(getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE), THRESHOLD_RANGE[1]);
  w.threshold.text = '0';
  w.applyValues();
  assert.equal(getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE), THRESHOLD_RANGE[0]);
  w.dispose();
});

test('G6: Setup reads all ten values out of the store', () => {
  // Every control shows what is STORED when the window opens (:123-135)
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
  assert.equal(w.threshold.defaultText, '0.02', 'DefaultText is the stored value (:308)');
  assert.equal(w.threshold.text, '', 'Text starts EMPTY - DefaultText is display only');
  for (const c of CHECKBOXES) assert.equal(w.checks[c.id], true, c.id);
  w.dispose();
});

test('G6: the values land on the KEYBIND SAVE, which is the controls window\'s close', () => {
  // Setup subscribes OnUpdateValues to InputManager.OnSavedKeyBinds
  // (:83) and CONTINUE only calls CancelWindow (:373-380), so the
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

  // ...and the RAISE OUTLIVES A FAILED WRITE, which is the port's own
  // departure and is now written as one. DFU raises only after a
  // successful write - File.WriteAllText (InputManager.cs:926),
  // UpdateBindingCache (:927), RaiseSavedKeyBindsEvent (:928), with no
  // try/catch anywhere in SaveKeyBinds (:871-929) - so a throwing write
  // propagates and the event never fires. The port shields the write
  // (AUDIT DA) and raises regardless, because a lost keybind blob must
  // not also cost the ten advanced-controls values.
  const prevLs = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const prevWarn = console.warn;
  try {
    console.warn = () => {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, removeItem() {}, setItem() { throw new Error('quota'); } },
    });
    const after = [];
    const off = onSavedKeyBinds(() => after.push('raised'));
    saveKeyBinds(freshStore());
    assert.deepEqual(after, ['raised'], 'a write that threw still notifies - the port\'s departure');
    off();
  } finally {
    console.warn = prevWarn;
    if (prevLs) Object.defineProperty(globalThis, 'localStorage', prevLs);
    else delete globalThis.localStorage;
  }
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
  // ...and the re-push CLEARS `done` (OnPush, :146-149), so the next
  // click INTO the popup is a click and not the stale close left over
  // from the last CONTINUE.
  const cbox = toNative(MouseControlsWindow.checkboxRect(CHECKBOXES[0], null));
  const wasChecked = cw.advanced.checks[CHECKBOXES[0].id];
  cw.click(cbox[0] + 1, cbox[1] + 1);
  assert.equal(cw.advancedOpen, true, 'a re-pushed window stays up');
  assert.equal(cw.advanced.checks[CHECKBOXES[0].id], !wasChecked);
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
  assert.equal(w.threshold.focus, true, 'UseFocus (:312)');
  w.input('Digit1', { key: '1' });
  w.input('Period', { key: '.' });
  for (const ch of '2345') w.input('Key', { key: ch });
  assert.equal(w.threshold.text, '1.234', 'MaxCharacters 5 (:306)');
  w.input('Backspace');
  assert.equal(w.threshold.text, '1.23');

  // a RIGHT click on a bound row prompts to remove it (:393-401)
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

// ─────────────────────────────────────────────────────────────────────
// ROAD-GR G6: THE POINTER PATH. The lane pinned the slider as a
// COMPONENT and the write path end to end, and left the window's own
// pointer wiring - the drag's direction, the release edge, the grid's
// forwarding, the right-click guard, the unbound-row refusal, the
// cached re-push and the wheel - held by nothing.
// ─────────────────────────────────────────────────────────────────────

test('G6: the checkbox click target is DFU\'s Checkbox rect - art + gap + LABEL, bounded by the label', () => {
  // Checkbox is a Panel that hangs the toggle on ITSELF (Checkbox.cs:84)
  // and re-sizes itself every Update to `checkTextureSize.x +
  // checkTextHorzOffset + label.Size.x` by `Mathf.Max(art, label)`
  // (Checkbox.cs:103-105). That Size IS the rect BaseScreenComponent
  // hit-tests (:578-579) and dispatches the click from (:681-684), so
  // in DFU clicking the WORDS toggles the box. AddOption sets only
  // Position (:274-283), so nothing else ever sizes it.
  const w = drawOnce(freshWindow());
  const c = CHECKBOXES[4];   // 'Protect Friendlies and Neutrals', the widest
  const rect = MouseControlsWindow.checkboxRect(c, FONT.fnt);
  assert.equal(rect[2], CHECK_SIZE + CHECK_TEXT_OFFSET[0] + measureText(FONT.fnt, c.label));
  assert.equal(rect[3], Math.max(CHECK_SIZE, FONT.fnt.fixedHeight));
  const native = toNative(rect);

  // the middle of the LABEL, well clear of the 7x7 art
  const was = w.checks[c.id];
  w.click(native[0] + CHECK_SIZE + CHECK_TEXT_OFFSET[0] + 3, native[1] + 2);
  assert.equal(w.checks[c.id], !was, 'the label is inside the Checkbox rect');
  // ...and the rect is BOUNDED by the label's own width - one pixel
  // past its right edge is outside the component, not inside an
  // open-ended strip.
  w.click(native[0] + native[2] + 1, native[1] + 2);
  assert.equal(w.checks[c.id], !was, 'past the label is outside the component');
  // the art still answers, as it always did
  w.click(native[0] + 1, native[1] + 1);
  assert.equal(w.checks[c.id], was);

  // Before the first draw there is no font to measure with - and DFU is
  // in the same place, because Checkbox.Update calls base.Update()
  // BEFORE assigning Size (:93-105), so its first frame hit-tests the
  // previous Size too. The fallback is the art alone.
  const fresh = freshWindow();
  const artOnly = toNative(MouseControlsWindow.checkboxRect(c, null));
  assert.deepEqual(artOnly, toNative([c.x, c.y, CHECK_SIZE, CHECK_SIZE]));
  const before = fresh.checks[c.id];
  fresh.click(artOnly[0] + CHECK_SIZE + CHECK_TEXT_OFFSET[0] + 3, artOnly[1] + 2);
  assert.equal(fresh.checks[c.id], before, 'no font, no measured label');
  w.dispose();
  fresh.dispose();
});

test('G6: the main panel\'s outline is Outline.cs\'s WHITE, not the text colour', () => {
  // `mainPanel.Outline.Enabled = true` (:94) is all this window sets;
  // it never assigns Outline.Color, and Panel's focus arms
  // (Panel.cs:202, :211) need UseFocus, which mainPanel does not set.
  // So the border keeps Outline.cs:29-31's defaults - thickness 1,
  // Sides.All, Color.white - the same white the TextBox border takes
  // explicitly at :310-311.
  const r = recorder();
  const w = freshWindow();
  w.draw(r, CANVAS, FONT);
  const [px, py, pw, ph] = MOUSE_PANEL;
  const strips = [[px, py, pw, 1], [px, py + ph - 1, pw, 1],
    [px, py, 1, ph], [px + pw - 1, py, 1, ph]];
  for (const [x, y, sw, sh] of strips) {
    const q = r.quads.find((v) => v.rect.x === x && v.rect.y === y
      && v.rect.w === sw && v.rect.h === sh);
    assert.ok(q, `the outline strip ${x},${y},${sw},${sh} is drawn`);
    assert.deepEqual([...q.color], [1, 1, 1, 1], 'Outline.cs:30 - Color.white');
  }
  w.dispose();
});

test('G6: the thumb drag runs off the pointer, and the host\'s UP edge is what ends it', () => {
  // HorizontalSlider.Update drags only inside `GetMouseButton(0)`
  // (:130-146) and its else arm drops `draggingThumb` the frame the
  // button comes up (:148-154). The port has no held-button poll, so
  // `release()` IS that else arm.
  const w = freshWindow();
  setScrollIndex(w.sliders.mouseSensitivity, 80);
  const t = thumbAt(w);
  w.click(t.x, t.y);
  assert.ok(w._drag, 'a press inside the thumb latches the drag');
  assert.equal(w._drag.fromIndex, 80);

  // the DIRECTION: rightward raises the index, leftward lowers it
  w.drag(t.x + 20);
  const up = w.sliders.mouseSensitivity.scrollIndex;
  assert.ok(up > 80, `a rightward drag raises the index (got ${up})`);
  w.drag(t.x - 20);
  const down = w.sliders.mouseSensitivity.scrollIndex;
  assert.ok(down < 80, `a leftward drag lowers it (got ${down})`);

  // the RELEASE, and the consequence that is the whole point of it
  w.release();
  assert.equal(w._drag, null);
  w.drag(t.x + 40);
  assert.equal(w.sliders.mouseSensitivity.scrollIndex, down,
    'a released drag moves nothing');
  w.dispose();
});

test('G6: the GRID forwards the pointer edges into the popup - the move, the UP and the wheel', () => {
  const cw = new ControlsWindow({});
  cw.click(TAB_RECTS.advanced[0] + 1, TAB_RECTS.advanced[1] + 1);
  const adv = cw.advanced;
  setScrollIndex(adv.sliders.mouseSensitivity, 80);
  const t = thumbAt(adv);
  cw.click(t.x, t.y);
  assert.ok(adv._drag, 'the grid hands the press through');

  // the MOVE arm: the grid's hover pumps drag(vx)
  cw.hover(t.x + 20, t.y);
  const dragged = adv.sliders.mouseSensitivity.scrollIndex;
  assert.ok(dragged > 80, 'a move with the button down drags the thumb');

  // THE UP ARM. The four hosts deliver the button-up edge as
  // `overlay.release?.()`, and ControlsWindow is what sits in that slot
  // while the popup is up - so without a release member of its own the
  // edge is a silent no-op and one press glues the slider to the
  // pointer for the rest of the session.
  assert.equal(typeof cw.release, 'function', 'the grid must carry the up edge');
  cw.release();
  assert.equal(adv._drag, null);
  cw.hover(t.x + 60, t.y);
  assert.equal(adv.sliders.mouseSensitivity.scrollIndex, dragged,
    'a move after the button came up moves nothing');

  // the WHEEL arm: MouseScrollUp/Down (HorizontalSlider.cs:180-190),
  // one unit a notch, on the slider the pointer is over.
  const trough = t.rect;
  cw.hover(trough[0] + 3, trough[1] + 1);
  cw.wheel(-1);
  assert.equal(adv.sliders.mouseSensitivity.scrollIndex, dragged - 1, 'wheel UP steps -1');
  cw.wheel(1);
  cw.wheel(1);
  assert.equal(adv.sliders.mouseSensitivity.scrollIndex, dragged + 1, 'wheel DOWN steps +1');
  // ...and off every trough it moves nothing
  cw.hover(toNative([0, 0, 1, 1])[0], toNative([0, 0, 1, 1])[1]);
  cw.wheel(-1);
  assert.equal(adv.sliders.mouseSensitivity.scrollIndex, dragged + 1,
    'the wheel only reaches the slider under the pointer');
  adv.dispose();
});

test('G6 LIVE: the real townTalk host delivers the up edge into the popup\'s thumb latch', () => {
  // The gate at the top of the host's pointer route admits phase 'up'
  // only for a window that HAS a release member, so this is the pin
  // that holds the seam end to end rather than the method's existence.
  const tt = createTownTalk({
    renderer: { uploadTexture: () => ({}) },
    canvas: CANVAS,
    fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
    regionIndex: 0,
  });
  const cw = new ControlsWindow({});
  tt.showOverlay(cw);
  tt.pointerdown({ clientX: TAB_RECTS.advanced[0] + 1, clientY: TAB_RECTS.advanced[1] + 1, button: 0 });
  assert.equal(cw.advancedOpen, true, 'the host press opened the ADVANCED window');
  const adv = cw.advanced;
  setScrollIndex(adv.sliders.mouseSensitivity, 80);
  const t = thumbAt(adv);
  tt.pointerdown({ clientX: t.x, clientY: t.y, button: 0 });
  assert.ok(adv._drag, 'the host press latched the thumb');
  assert.equal(tt.pointer('up', { clientX: t.x, clientY: t.y, button: 0 }), true,
    'the host owns the release for a window that carries one');
  assert.equal(adv._drag, null, 'and the host release let it go');
  const held = adv.sliders.mouseSensitivity.scrollIndex;
  tt.hover({ clientX: t.x + 40, clientY: t.y });
  assert.equal(adv.sliders.mouseSensitivity.scrollIndex, held,
    'a button-up move across the screen no longer drags the slider');
  adv.dispose();
});

test('G6: right-click reaches ONLY the keybind rows, and refuses an unbound one', () => {
  // DaggerfallUnityMouseControlsWindow registers OnRightMouseClick on
  // the keybind buttons ALONE (:203) - no checkbox, slider or TextBox
  // in this window carries one.
  const w = drawOnce(freshWindow());
  const c = CHECKBOXES[0];
  const cbox = toNative(MouseControlsWindow.checkboxRect(c, FONT.fnt));
  const wasChecked = w.checks[c.id];
  w.click(cbox[0] + 1, cbox[1] + 1, true);
  assert.equal(w.checks[c.id], wasChecked, 'a right click does not toggle a checkbox');

  const field = toNative(MouseControlsWindow.thresholdBoxRect());
  w.click(field[0] + 1, field[1] + 1, true);
  assert.equal(w.threshold.focus, false, 'a right click does not focus the field');

  const spec = SLIDERS.find((s) => s.id === 'weaponSwingMode');
  const trough = toNative(MouseControlsWindow.sliderTroughRect(spec));
  const wasIndex = w.sliders.weaponSwingMode.scrollIndex;
  w.click(trough[0] + SLIDER_PANEL.w - 1, trough[1] + 1, true);
  assert.equal(w.sliders.weaponSwingMode.scrollIndex, wasIndex, 'a right click does not page a slider');

  // ...and PromptRemoveKeybindMessage refuses an UNBOUND slot outright
  // (ControlsConfigManager.cs:290-292: `if (button.Label.Text ==
  // KeyCode.None.ToString()) return;`).
  setUnsavedBinding(w.unsaved, 'AutoRun', null);
  const row = KEYBIND_ROWS.find((r) => r.action === 'AutoRun');
  const btn = toNative(MouseControlsWindow.rowButtonRect(row));
  w.click(btn[0] + 1, btn[1] + 1, true);
  assert.equal(w.top, null, 'an unbound row raises no remove prompt');
  assert.equal(w._removeAction, null);
  // the control: a BOUND row does raise it, so the refusal is about the
  // binding and not about the rect
  const bound = KEYBIND_ROWS.find((r) => r.action === 'QuickSave');
  const bbtn = toNative(MouseControlsWindow.rowButtonRect(bound));
  w.click(bbtn[0] + 1, bbtn[1] + 1, true);
  assert.equal(w.top, 'remove');
  w.input('KeyN');
  w.dispose();
});

test('G6: re-opening the ADVANCED window re-checks duplicates - OnPush -> OnReturn (:146-155)', () => {
  // DFU caches ONE instance and PushWindow lays it over the grid again
  // (DaggerfallUI.cs:569-571), so OnPush -> OnReturn ->
  // UpdateKeybindButtons + CheckDuplicates is what keeps the cached
  // window's colouring current against edits made on the GRID. The two
  // windows edit one ControlsConfigManager, so a clash made on either
  // side has to colour on both.
  const cw = new ControlsWindow({});
  cw.click(TAB_RECTS.advanced[0] + 1, TAB_RECTS.advanced[1] + 1);   // visit 1
  const cont = toNative(CONTINUE_RECT);
  cw.click(cont[0] + 1, cont[1] + 1);                                // back to the grid
  assert.equal(cw.advancedOpen, false);

  // a clash made on the GRID, between the two visits, through its own UI
  const escCode = currentDict(cw.unsaved).get('Escape');
  const b0 = cw.buttons[0];
  const b0Code = currentDict(cw.unsaved).get(b0.action);
  cw.click(b0.x + 1, b0.y + 1);
  cw.input(escCode);
  assert.ok(cw.dupes.internal.has(escCode), 'the grid paints the clash');
  assert.equal(cw.advanced.dupes.internal.has(escCode), false,
    'the cached popup still holds its construction-time snapshot');

  cw.click(TAB_RECTS.advanced[0] + 1, TAB_RECTS.advanced[1] + 1);   // visit 2
  assert.ok(cw.advanced.dupes.internal.has(escCode),
    'the re-push re-runs CheckDuplicates over the shared dicts');
  assert.deepEqual([...cw.advanced.dupes.internal].sort(), [...cw.dupes.internal].sort());

  // ...and the MIRROR: a clash CLEARED on the grid stops colouring here
  cw.click(cont[0] + 1, cont[1] + 1);
  cw.click(b0.x + 1, b0.y + 1);
  cw.input(b0Code);
  assert.equal(cw.dupes.internal.has(escCode), false, 'the grid cleared it');
  cw.click(TAB_RECTS.advanced[0] + 1, TAB_RECTS.advanced[1] + 1);
  assert.equal(cw.advanced.dupes.internal.has(escCode), false,
    'a cleared clash stops colouring in the popup too');
  assert.equal(cw.advanced.dupes.ok, true);
  cw.advanced.dispose();
});

test('G6: the remove prompt splits the action\'s camel case, as PromptRemoveKeybindMessage does', () => {
  // ControlsConfigManager.cs:298-302 formats the "removeKeybind" record
  // with the action name split at its capitals and the FULL button text
  // of the code being removed. An identity `splitCamel` was invisible
  // to the whole suite.
  const rows = removeKeybindPromptRows('AutoRun', 'KeyR');
  assert.equal(rows.length, 2);
  assert.match(rows[1], /Auto Run/, 'the camel case is SPLIT, not passed through');
  assert.equal(/AutoRun/.test(rows[1]), false);
  assert.match(rows[1], /'R'/, 'and the code is the FULL button text');
});
