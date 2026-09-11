// GP2 - THE JOYSTICK CONTROLS WINDOW (2026-09-11).
// DaggerfallJoystickControlsWindow.cs (MIT, Daggerfall Workshop;
// original author jefetienne), the JOYSTICK tab's destination
// (DaggerfallControlsWindow.cs:107-109, :279-286), the last of DFU's
// game windows the port did not have. "configureJoystickControls":
// four axis rows each with an invert box, the four UI-button rows, the
// Enable Controller box, and four sliders.
//
// THE NATIVE-ART QUESTION, answered as the mouse window's was: THERE
// IS NO CIF OR IMG. mainPanel is a flat 318x170 rect with an outline
// on `mainPanelBackgroundColor` (:37) unless a mod supplies a texture
// (SetBackground :366-376, TextureReplacement); the port has no mod
// texture layer, so the colour arm is the only arm.
//
// THE NATIVE-WINDOW RULE, element by element (panel-relative):
// - the panel 318x170 (:115) at Center/Middle over the 320x200 native
//   panel = (1, 15), outline on, black.
// - the title at y=4, centred (:125-130).
// - CONTINUE 80x10 bottom-right (:133-138) = (238,160), on
//   continueButtonBackgroundColor (0.5, 0, 0, 1) (:39).
// - ENABLE CONTROLLER, a Checkbox at (20,20) (:140), whose toggle
//   writes the setting AT ONCE (:522-526) and which Update re-reads
//   from the setting every frame (:96-102) - "a special realtime
//   setting as controller enabling can change at any time, even on
//   the window itself".
// - EIGHT KEYBIND ROWS (SetupKeybindButton :278-326): an 85x15 panel
//   at its anchor holding a 40x10 label panel (right-aligned label,
//   middle) and a 43x10 button pinned Right/Middle, so the button sits
//   at (+42, +2.5) - the mouse window's ROW_BUTTON exactly. The four
//   AXIS rows: Movement H. (20,40), Movement V. (20,80), Camera H.
//   (115,40), Camera V. (115,80) (:144-154), each with its INVERT box
//   at (+43, +20) (:145, :148, :151, :154 - (63,60), (63,100),
//   (158,60), (158,100)); the four UI rows in one column at x=210:
//   Left-Click y=40, Middle-Click 60, Right-Click 80, Back 100
//   (:156-159). An axis row's label is the AXIS NAME ("Axis1"); a UI
//   row's is GetButtonText of the key, elongated past ten characters
//   with the tooltip behind it (:248-263).
// - FOUR JOY_SLIDERS (CreateSlider :331-352), each a 70x45 panel with a
//   centred label at y=0 and the trough at (0,6), 70 wide, the
//   indicator 2 past its end (DaggerfallUI.AddSlider, ported in
//   ui/horizontalSlider.js): Look Sensitivity (15,120) 0.1..4.0, UI
//   Mouse Sensitivity (115,120) 0.1..5.0, Maximum Movement Threshold
//   (215,120) 0..1, Deadzone (15,140) 0..0.9 (:161-167). All four
//   FLOAT sliders, on the tenth the port's slider keeps.
//
// THE STAGING is DFU's two STATIC dictionaries (:69-72):
// UnsavedKeybindDict (the four UI keys by their "Left-Click" names and
// the four AxisActions by name) and UnsavedSettingsDict (the five
// settings and four inversions). ResetUnsavedSettings (:198-219)
// reads both out of the live state; SaveSettings (:221-241) writes
// them back, saves the settings, rebinds only what CHANGED
// (SaveAllKeybindValues :461-499) and saves the keybinds. The
// CONTROLS window drives both: its Setup and SetDefaults reset, its
// OnPop saves (DaggerfallControlsWindow.cs:142, :163-171, :234) - so
// CONTINUE here is CancelWindow and nothing else (:505-520), exactly
// as the mouse window's is. The port keeps the staging on an object
// the grid owns (`createJoystickUnsaved`) rather than on a module,
// so a test can hold two.
//
// THE CAPTURE (WaitForKeyPress :549-602): a UI button takes the next
// key down that is not an axis key of a BOUND axis
// (GetAnyKeyDownIgnoreAxisBinds - a keyboard key is legal here too);
// an axis button takes the next key down and keeps it only if it is
// an AXIS key, binding the AXIS ("Axis3") and reverting its label
// otherwise. ReservedKeys is empty in DFU. While waiting, the label
// is blank and AllowCancel is false; a Back press with duplicates
// standing shows the multipleAssignments box (:91-94), and so does
// CONTINUE (:512-515). CheckDuplicates (:419-441) runs GetDuplicates
// over the window's OWN eight strings - axis names and key strings in
// one list - and reddens the clashing labels.
//
// The pad's keys reach this window the way every key does: the
// poller (ui/gamepadInput.js) edges JoystickButtonN and every
// JoystickAxisNButtonM as synthetic keydowns, the host's ladder hands
// them to the overlay, and `input(code)` here is the capture.

import { nativeMetrics, drawRect } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { drawText, measureText } from './text.js';
import { layoutMessageBox, drawMessageBox } from './messageBox.js';
import {
  getAxisBinding, getJoystickUIBinding, getAxisInversion, setAxisBinding, setJoystickUIBinding, setAxisInversion, saveKeyBinds,
} from '../systems/inputActions.js';
import { AXIS_ACTIONS, JOYSTICK_UI_ACTIONS, parseAxisKeyName, axisOfKey } from '../systems/gamepad.js';
import { getDuplicates, buttonText, ELONGATED_TEXT, INTERNAL_DUPE_COLOR } from '../systems/controlsConfig.js';
import {
  makeSlider, setScrollIndex, sliderClick, sliderDrag, sliderGetValue, sliderScroll,
  sliderThumb, indicatorText, SLIDER_HEIGHT, SLIDER_INDICATOR_OFFSET, TROUGH_COLOR, TINT,
} from './horizontalSlider.js';
import { ToolTip } from './toolTip.js';
import { getBool, getFloat, setValue, saveSettings } from '../systems/settings.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { MOUSE_PANEL, PANEL_COLOR, KEYBIND_BG, CONTINUE_BG, CONTINUE_RECT, TITLE_Y, ROW_SIZE, ROW_LABEL, ROW_BUTTON, SLIDER_PANEL, CHECK_SIZE, CHECK_TEXT_OFFSET, toNative } from './mouseControlsWindow.js';

/** The same 318x170 panel at the same place (:115-118) - and so the
 *  mouse window's toNative is this window's (AUDIT 24: one home). */
export const JOY_PANEL = MOUSE_PANEL;
export { toNative };

/** The strings are DFU's GameSettings table (Internal_Settings). */
export const TITLE = 'Configure Joystick Controls';
/** The four UI actions' STAGING KEYS (:32-35) - "These are key name for bindings - do not translate". */
export const UI_KEYS = Object.freeze({ LeftClick: 'Left-Click', MiddleClick: 'Middle-Click', RightClick: 'Right-Click', Back: 'Back' });

/** SetupAxisKeybindButton (:144-154) and SetupUIKeybindButton (:156-159): the rows. */
export const AXIS_ROWS = Object.freeze([
  { action: 'MovementHorizontal', label: 'Movement H.', x: 20, y: 40, invert: { x: 63, y: 60, label: 'Invert' } },
  { action: 'MovementVertical', label: 'Movement V.', x: 20, y: 80, invert: { x: 63, y: 100, label: 'Invert' } },
  { action: 'CameraHorizontal', label: 'Camera H.', x: 115, y: 40, invert: { x: 158, y: 60, label: 'Invert' } },
  { action: 'CameraVertical', label: 'Camera V.', x: 115, y: 80, invert: { x: 158, y: 100, label: 'Invert' } },
]);
export const UI_ROWS = Object.freeze([
  { action: 'LeftClick', label: 'Left-Click', x: 210, y: 40 },
  { action: 'MiddleClick', label: 'Middle-Click', x: 210, y: 60 },
  { action: 'RightClick', label: 'Right-Click', x: 210, y: 80 },
  { action: 'Back', label: 'Back', x: 210, y: 100 },
]);
/** CreateSlider's four (:161-167). */
export const JOY_SLIDERS = Object.freeze([
  { id: 'lookSensitivity', key: 'JoystickLookSensitivity', label: 'Look Sensitivity', x: 15, y: 120, min: 0.1, max: 4.0 },
  { id: 'cursorSensitivity', key: 'JoystickCursorSensitivity', label: 'UI Mouse Sensitivity', x: 115, y: 120, min: 0.1, max: 5.0 },
  { id: 'movementThreshold', key: 'JoystickMovementThreshold', label: 'Maximum Movement Threshold', x: 215, y: 120, min: 0.0, max: 1.0 },
  { id: 'deadzone', key: 'JoystickDeadzone', label: 'Deadzone', x: 15, y: 140, min: 0.0, max: 0.9 },
]);
/** AddOption(20, 20, enableController) (:140). */
export const ENABLE_BOX = Object.freeze({ x: 20, y: 20, label: 'Enable Controller' });
const MULTIPLE_ASSIGNMENTS = 'You have multiple assignments...';   // ui/enhancedControls.js's line; not a second export (AUDIT 24)

const TEXT_COLOR = [0.9, 0.9, 0.75, 1];
const WHITE = [1, 1, 1, 1];
const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** ResetUnsavedSettings (:198-219): the staging read out of the live
 *  store and settings. The keybind half is one Map keyed by the
 *  "Left-Click" strings and the AxisActions names, as DFU's is. */
export function createJoystickUnsaved(store) {
  const u = { keybinds: new Map(), settings: {} };
  resetJoystickUnsaved(store, u);
  return u;
}
export function resetJoystickUnsaved(store, u) {
  u.keybinds.clear();
  for (const a of JOYSTICK_UI_ACTIONS) u.keybinds.set(UI_KEYS[a], getJoystickUIBinding(store, a));   // GetKeyString(None) is "None"; null here
  for (const a of AXIS_ACTIONS) u.keybinds.set(a, getAxisBinding(store, a));
  u.settings = {
    enableController: getBool('Controls', 'EnableController'),
    lookSensitivity: getFloat('Controls', 'JoystickLookSensitivity', 0.1, 4),
    cursorSensitivity: getFloat('Controls', 'JoystickCursorSensitivity', 0.1, 5),
    movementThreshold: getFloat('Controls', 'JoystickMovementThreshold', 0, 1),
    deadzone: getFloat('Controls', 'JoystickDeadzone', 0, 0.9),
    invert: Object.fromEntries(AXIS_ACTIONS.map((a) => [a, getAxisInversion(store, a)])),
  };
  return u;
}

/** SaveSettings (:221-241): the staging written back - the five
 *  settings and the four inversions, the settings saved, then
 *  SaveAllKeybindValues (:461-499) rebinding ONLY what differs from
 *  the live binding, the keybinds saved, and the staging re-read. */
export function saveJoystickSettings(store, u) {
  setValue('Controls', 'EnableController', u.settings.enableController);
  setValue('Controls', 'JoystickLookSensitivity', Number(u.settings.lookSensitivity).toFixed(1));
  setValue('Controls', 'JoystickCursorSensitivity', Number(u.settings.cursorSensitivity).toFixed(1));
  setValue('Controls', 'JoystickMovementThreshold', Number(u.settings.movementThreshold).toFixed(1));
  setValue('Controls', 'JoystickDeadzone', Number(u.settings.deadzone).toFixed(1));
  for (const a of AXIS_ACTIONS) setAxisInversion(store, a, u.settings.invert[a]);
  saveSettings();
  for (const a of JOYSTICK_UI_ACTIONS) {
    const code = u.keybinds.get(UI_KEYS[a]) ?? null;
    if (getJoystickUIBinding(store, a) !== code && code != null) setJoystickUIBinding(store, code, a);
  }
  for (const a of AXIS_ACTIONS) {
    const axis = u.keybinds.get(a) ?? '';
    if (getAxisBinding(store, a) !== axis && axis) setAxisBinding(store, axis, a);
  }
  saveKeyBinds(store);
  resetJoystickUnsaved(store, u);
}

/** CheckDuplicates' list (:421): every staged string, axes and keys together. */
export const joystickDuplicates = (u) => getDuplicates([...u.keybinds.values()].map((v) => (v == null || v === '' ? null : v)));

export class JoystickControlsWindow {
  /**
   * @param unsaved the grid's joystick staging (createJoystickUnsaved)
   * @param hooks { onBack() } - CancelWindow's return to the grid
   */
  constructor(unsaved, hooks = {}) {
    this.unsaved = unsaved;
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;
    this.capture = null;        // waitingForInput (:66): the row's action, and whether it is an axis
    this.top = null;            // 'multiple' - the ClickAnywhereToClose box (:449-455)
    this.tip = new ToolTip();
    this._drag = null;
    this._mouse = [0, 0];
    this._font = null;
    this.sliders = {};
    for (const s of JOY_SLIDERS) this.sliders[s.id] = makeSlider({ mode: 'float', min: s.min, max: s.max, start: unsaved.settings[s.id] });
    this.checks = { enableController: unsaved.settings.enableController, ...unsaved.settings.invert };
    this.dupes = joystickDuplicates(this.unsaved);
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }
  /** AllowCancel (:425, :446): no duplicates, and not waiting. */
  get allowCancel() { return this.dupes.size === 0 && !this.capture; }
  _refresh() { this.dupes = joystickDuplicates(this.unsaved); }

  /** OnPush -> OnReturn (:181-190): UpdateControlsToUnsavedSettings
   *  (:379-400) + CheckDuplicates - the controls read the staging. */
  onPush() {
    this.done = false;
    for (const s of JOY_SLIDERS) setScrollIndex(this.sliders[s.id], Math.round(this.unsaved.settings[s.id] * 10) - this.sliders[s.id].min);
    this.checks.enableController = this.unsaved.settings.enableController;
    for (const a of AXIS_ACTIONS) this.checks[a] = this.unsaved.settings.invert[a];
    this._refresh();
  }
  /** OnPop (:176-179): UpdateUnsavedSettingsToControls (:403-417) -
   *  the staging reads the controls; the keybinds were staged at capture. */
  onPop() {
    for (const s of JOY_SLIDERS) this.unsaved.settings[s.id] = sliderGetValue(this.sliders[s.id]);
    this.unsaved.settings.enableController = this.checks.enableController;
    for (const a of AXIS_ACTIONS) this.unsaved.settings.invert[a] = this.checks[a];
  }

  /** Update (:87-103): the Enable Controller box follows the live
   *  setting every frame, and a Back under standing duplicates shows
   *  the box. `back` is the host's word that GetBackButtonDown fired. */
  tick(dt, back = false) {
    this.checks.enableController = getBool('Controls', 'EnableController');
    if (back && !this.allowCancel && !this.capture) this.top = 'multiple';
    this.tip.update(dt);
  }

  static rowButtonRect(row) { return [row.x + ROW_BUTTON.x, row.y + ROW_BUTTON.y, ROW_BUTTON.w, ROW_BUTTON.h]; }
  static sliderTroughRect(s) { return [s.x, s.y + SLIDER_PANEL.troughY, SLIDER_PANEL.w, SLIDER_HEIGHT]; }
  static checkboxRect(c, fnt) {
    if (!fnt) return [c.x, c.y, CHECK_SIZE, CHECK_SIZE];
    return [c.x, c.y, CHECK_SIZE + CHECK_TEXT_OFFSET[0] + measureText(fnt, c.label), Math.max(CHECK_SIZE, fnt.fixedHeight ?? 6)];
  }

  /** The staged text a row shows (SetupKeybindButton :248-263). */
  rowLabel(row, axis) {
    if (this.capture?.action === row.action) return '';
    const v = this.unsaved.keybinds.get(axis ? row.action : UI_KEYS[row.action]);
    return axis ? (v || '') : buttonText(v ?? null);
  }

  /** WaitForKeyPress (:549-602), the next key down. */
  input(code, e = null) {
    void e;
    if (this.top === 'multiple') { this.top = null; return; }   // ClickAnywhereToClose: any key
    if (this.capture) {
      const { action, axis } = this.capture;
      const axisKey = parseAxisKeyName(code);
      if (axis) {
        // an axis row keeps only an AXIS key, and binds its AXIS (:570-583)
        const name = axisKey == null ? '' : axisOfKey(axisKey);
        if (name) this.unsaved.keybinds.set(action, name);
      } else {
        // GetAnyKeyDownIgnoreAxisBinds: an axis key of a BOUND axis is not a key here
        const bound = axisKey != null && [...AXIS_ACTIONS].some((a) => this.unsaved.keybinds.get(a) === axisOfKey(axisKey));
        if (bound) return;
        this.unsaved.keybinds.set(UI_KEYS[action], code);
      }
      this.capture = null;
      this._refresh();
      return;
    }
    if (code === 'Escape') {
      // the back door obeys CONTINUE's gate (:91-94, :512-519)
      if (!this.allowCancel) { this.top = 'multiple'; return; }
      this._click();
      this._close();
    }
  }

  _close() { this.done = true; this.hooks.onBack?.(); }   // CancelWindow (:518)

  hover(vx, vy) {
    this._mouse = [vx, vy];
    if (this.capture || this.top) { this.tip.hide(); return; }
    for (const row of UI_ROWS) {
      if (inRect(toNative(JoystickControlsWindow.rowButtonRect(row)), vx, vy)) {
        const code = this.unsaved.keybinds.get(UI_KEYS[row.action]) ?? null;
        if (buttonText(code) !== ELONGATED_TEXT) { this.tip.hide(); return; }   // "The left/right click buttons have tooltips, axis buttons do not" (:430)
        this.tip.show(buttonText(code, true), vx, vy);
        return;
      }
    }
    this.tip.hide();
  }
  drag(vx) {
    if (!this._drag) return;
    sliderDrag(this.sliders[this._drag.id], SLIDER_PANEL.w, vx - this._drag.fromX, this._drag.fromIndex);
  }
  release() { this._drag = null; }
  wheel(dir) {
    if (this.capture || this.top) return;
    const [vx, vy] = this._mouse;
    for (const spec of JOY_SLIDERS) {
      if (inRect(toNative(JoystickControlsWindow.sliderTroughRect(spec)), vx, vy)) { sliderScroll(this.sliders[spec.id], dir); return; }
    }
  }

  click(vx, vy) {
    if (this.capture) return true;
    if (this.top === 'multiple') { this.top = null; return true; }   // ClickAnywhereToClose
    for (const row of AXIS_ROWS) {
      if (inRect(toNative(JoystickControlsWindow.rowButtonRect(row)), vx, vy)) { this._click(); this.capture = { action: row.action, axis: true }; return true; }
    }
    for (const row of UI_ROWS) {
      if (inRect(toNative(JoystickControlsWindow.rowButtonRect(row)), vx, vy)) { this._click(); this.capture = { action: row.action, axis: false }; return true; }
    }
    for (const spec of JOY_SLIDERS) {
      const rect = toNative(JoystickControlsWindow.sliderTroughRect(spec));
      if (inRect(rect, vx, vy)) {
        const s = this.sliders[spec.id];
        const local = vx - rect[0];
        const thumb = sliderThumb([0, 0, SLIDER_PANEL.w, SLIDER_HEIGHT], s.scrollIndex, s.totalUnits, s.displayUnits);
        if (thumb && local >= thumb[0] && local <= thumb[0] + thumb[2]) this._drag = { id: spec.id, fromX: vx, fromIndex: s.scrollIndex };
        else sliderClick(s, [0, 0, SLIDER_PANEL.w, SLIDER_HEIGHT], local);
        return true;
      }
    }
    if (inRect(toNative(JoystickControlsWindow.checkboxRect(ENABLE_BOX, this._font?.fnt)), vx, vy)) {
      // EnableControllerCheckbox_OnToggleState (:522-526): the setting, at once
      this.checks.enableController = !this.checks.enableController;
      setValue('Controls', 'EnableController', this.checks.enableController);
      return true;
    }
    for (const row of AXIS_ROWS) {
      if (inRect(toNative(JoystickControlsWindow.checkboxRect(row.invert, this._font?.fnt)), vx, vy)) { this.checks[row.action] = !this.checks[row.action]; return true; }
    }
    if (inRect(toNative(CONTINUE_RECT), vx, vy)) {
      // ContinueButton_OnMouseClick (:505-520)
      this._click();
      if (!this.allowCancel) this.top = 'multiple';
      else this._close();
      return true;
    }
    return true;
  }

  draw(renderer, canvas, font) {
    this._font = font;
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);
    const [px, py, pw, ph] = JOY_PANEL;
    drawRect(renderer, m, px, py, pw, ph, PANEL_COLOR);
    for (const [ox, oy, ow, oh] of [[px, py, pw, 1], [px, py + ph - 1, pw, 1], [px, py, 1, ph], [px + pw - 1, py, 1, ph]]) drawRect(renderer, m, ox, oy, ow, oh, WHITE);
    const at = (x, y) => [m.ox + (px + x) * m.s, m.oy + (py + y) * m.s];
    const put = (text, x, y, color = TEXT_COLOR) => { const [sx, sy] = at(x, y); drawText(renderer, font, text, sx, sy, m.s, color); };
    const glyphH = font.fnt?.fixedHeight ?? 6;
    put(TITLE, Math.round((pw - measureText(font.fnt, TITLE)) / 2), TITLE_Y);
    drawRect(renderer, m, px + CONTINUE_RECT[0], py + CONTINUE_RECT[1], CONTINUE_RECT[2], CONTINUE_RECT[3], CONTINUE_BG);
    put('CONTINUE', CONTINUE_RECT[0] + Math.round((CONTINUE_RECT[2] - measureText(font.fnt, 'CONTINUE')) / 2), CONTINUE_RECT[1] + Math.round((CONTINUE_RECT[3] - glyphH) / 2));
    const drawRow = (row, axis) => {
      put(row.label, row.x + ROW_LABEL.w - measureText(font.fnt, row.label), row.y + Math.round((ROW_SIZE.h - glyphH) / 2));
      const [bx, by, bw, bh] = JoystickControlsWindow.rowButtonRect(row);
      drawRect(renderer, m, px + bx, py + by, bw, bh, KEYBIND_BG);
      const label = this.rowLabel(row, axis);
      const staged = this.unsaved.keybinds.get(axis ? row.action : UI_KEYS[row.action]);
      const color = staged && this.dupes.has(staged) ? INTERNAL_DUPE_COLOR : TEXT_COLOR;   // CheckDuplicates' red (:437)
      put(label, bx + Math.round((bw - measureText(font.fnt, label)) / 2), by + Math.round((bh - glyphH) / 2), color);
    };
    for (const row of AXIS_ROWS) drawRow(row, true);
    for (const row of UI_ROWS) drawRow(row, false);
    const drawCheck = (c, on) => {
      for (const [ox, oy, ow, oh] of [[c.x, c.y, CHECK_SIZE, 1], [c.x, c.y + CHECK_SIZE - 1, CHECK_SIZE, 1], [c.x, c.y, 1, CHECK_SIZE], [c.x + CHECK_SIZE - 1, c.y, 1, CHECK_SIZE]]) drawRect(renderer, m, px + ox, py + oy, ow, oh, TEXT_COLOR);
      if (on) drawRect(renderer, m, px + c.x + 2, py + c.y + 2, CHECK_SIZE - 4, CHECK_SIZE - 4, TEXT_COLOR);
      const [, , cw] = JoystickControlsWindow.checkboxRect(c, font.fnt);
      put(c.label, c.x + cw - measureText(font.fnt, c.label), c.y + CHECK_TEXT_OFFSET[1]);
    };
    drawCheck(ENABLE_BOX, this.checks.enableController);
    for (const row of AXIS_ROWS) drawCheck(row.invert, this.checks[row.action]);
    for (const spec of JOY_SLIDERS) {
      const s = this.sliders[spec.id];
      put(spec.label, spec.x + Math.round((SLIDER_PANEL.w - measureText(font.fnt, spec.label)) / 2), spec.y);
      const [tx, ty, tw, th] = JoystickControlsWindow.sliderTroughRect(spec);
      drawRect(renderer, m, px + tx, py + ty, tw, th, TROUGH_COLOR);
      const thumb = sliderThumb([tx, ty, tw, th], s.scrollIndex, s.totalUnits, s.displayUnits);
      if (thumb) drawRect(renderer, m, px + thumb[0], py + thumb[1], thumb[2], thumb[3], TINT);
      put(indicatorText(s), tx + tw + SLIDER_INDICATOR_OFFSET, ty, WHITE);
    }
    if (this.capture) put(this.capture.axis ? 'Move an axis...' : 'Press a key...', 4, ph - 12);
    if (this.top === 'multiple') {
      const box = layoutMessageBox(font, [MULTIPLE_ASSIGNMENTS], []);
      if (!drawMessageBox(renderer, m, font, box)) drawText(renderer, font, MULTIPLE_ASSIGNMENTS, m.ox + 20 * m.s, m.oy + 20 * m.s, m.s, TEXT_COLOR);
    }
    this.tip.draw(renderer, m, font);
  }
}
