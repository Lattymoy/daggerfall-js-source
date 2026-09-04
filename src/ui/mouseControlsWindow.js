// ROAD-G G6: THE MOUSE / ADVANCED CONTROLS WINDOW -
// DaggerfallUnityMouseControlsWindow.cs (MIT, Daggerfall Workshop;
// original author jefetienne), the destination of the controls
// window's second tab (DaggerfallControlsWindow.cs:112-121,
// :288-295). The class is called "Mouse" and its title is
// "configureAdvancedControls": DFU's own advanced-options popup,
// carrying six keybinds, four sliders, five checkboxes and a text
// field.
//
// THE NATIVE-ART QUESTION, answered: THERE IS NO CIF OR IMG. This is
// the one DFU window that draws no Daggerfall art at all - `mainPanel`
// is a flat rect with an outline whose colour is
// `mainPanelBackgroundColor` (:29) unless a MOD supplies a texture
// named "advancedControlsMainPanelBackgroundColor" (SetBackground
// :281-291, TextureReplacement). The port has no mod texture layer, so
// the colour arm is the only arm - recorded exactly as
// ui/travelPopUp.js records the same shape for its green checkbox, and
// not a departure of behaviour.
//
// THE NATIVE-WINDOW RULE, element by element (all rects panel-relative
// unless said otherwise):
// - the panel is 318x170 (:83) at HorizontalAlignment.Center /
//   VerticalAlignment.Middle, which over the 320x200 native panel is
//   (1, 15) - MOUSE_PANEL below. Outline on, background black (:29).
// - the title at y=4, centred (:96-101).
// - CONTINUE is 80x10 bottom-right (:104-110) = (238,160), on
//   continueButtonBackgroundColor (0.5, 0, 0, 1) (:31).
// - SIX KEYBIND ROWS (:113-118), each an 85x15 panel at its anchor
//   holding a 40x10 label panel (right-aligned label, middle) and a
//   43x10 button pinned Right/Middle - so the button sits at
//   (+42, +2.5) inside the row and the label's right edge at +40
//   (:174-208). These are EXACTLY the six actions DFU leaves off the
//   classic grid (ui/controlsWindow.js:8-12 records that omission as
//   DFU's own quirk, kept) - this window is where DFU rebinds them.
// - FOUR SLIDERS (:120-133), each a 70x45 panel: a centred label at
//   y=0 and the trough at (0,6), 70x4, with the indicator 2 past its
//   right edge (DaggerfallUI.cs:1106-1124, ported in
//   ui/horizontalSlider.js). Mouse Look Smoothing (150,70) over the
//   six strength names; Mouse Look Sensitivity (20,70) as a FLOAT
//   slider 0.1..16.0; Weapon Swing Mode (150,90); Hit Detection
//   (20,145).
// - FIVE CHECKBOXES (:122-131), 7x7 (Checkbox.cs, checkbox_unchecked
//   is 7x7) with the label 2 across and 1 down (:26-27): Invert Look-Y
//   (20,120), Movement Acceleration (20,130), Bows (150,120), Toggle
//   Sneak (150,130), Protect Friendlies (150,145).
// - the THRESHOLD FIELD (:135, :253-283): a 100x20 panel at (20,90),
//   its label at y=0 and a 30x6 box at y=10, MaxCharacters 5.
//
// THE STRINGS are DFU's own Internal_Settings table (Assets/
// StreamingAssets/Text/Master Localization CSV Files/
// Internal_Settings.csv and, for the two-name hit-detection list,
// Internal_Settings_en.asset id 392878225761951744), transcribed
// verbatim below. `meleeAttackDetection` and
// `meleeAttackFriendlyProtection` resolve first in GameSettings.txt
// (:63, :65), which is the same pair of words.
//
// THE ORDERING THAT LOOKS LIKE A BUG AND IS THE LAW. Setup subscribes
// `OnUpdateValues` to InputManager.OnSavedKeyBinds (:78) and does ALL
// of its setting writes there (:334-360). CONTINUE only calls
// CancelWindow (:369-376). So the sliders, the checkboxes and the
// field reach the store when the KEYBINDS are saved - which is the
// CONTROLS window's close (DaggerfallControlsWindow.cs:163-171), not
// this window's own. systems/inputActions.js carries that event now
// and this window subscribes to it, so the ordering is DFU's rather
// than a call the port wired by hand.
//
// TWO QUIRKS INSIDE THAT HANDLER, both kept:
//  - the THRESHOLD is only written when `float.TryParse` succeeds
//    (:353-355). TextBox.Text is the TYPED text and DefaultText is
//    only a display fallback (TextBox.cs:342-343), so a player who
//    never touches the field leaves Text empty, TryParse fails, and
//    WeaponAttackThreshold keeps whatever it had. Opening this window
//    cannot silently rewrite it.
//  - `weaponSensitivitySlider` is commented out in DFU (:47, :338).
//    Nine controls are built; the tenth is a stub. Not ported.
//
// WHAT THE PORT DRAWS DIFFERENTLY, and why neither is a behaviour:
//  - DFU's parent panel is ScreenDimColor = Color.clear (:81,
//    DaggerfallPopupWindow.cs:82) and DaggerfallUI draws ONLY the top
//    window (DaggerfallUI.cs:489-492), so its 3D camera keeps painting
//    behind the popup. The port's overlay slot does not repaint the
//    scene under a held overlay, so the parent panel takes the menu
//    backdrop's black - the same black ui/controlsWindow.js already
//    lays down under CNFG00I0.
//  - DFU sets TextScale 0.9 on the keybind labels and the slider
//    indicators (:193, :1119). The port draws the classic bitmap font
//    at integer scale; 0.9 is an SDF-era shrink with no counterpart
//    here, so the labels draw at 1.
//
// GameManager.Instance.StartGameBehaviour.ApplyStartSettings() (:359)
// has no port counterpart and needs none: every one of these ten
// settings is read at its point of use, so a write is already live.

import { nativeMetrics, drawRect } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { drawText, measureText } from './text.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { onSavedKeyBinds } from '../systems/inputActions.js';
import {
  currentDict, setUnsavedBinding, checkDuplicates, buttonText, ELONGATED_TEXT,
  INTERNAL_DUPE_COLOR, CROSS_DUPE_COLOR, removeKeybindPromptRows, comboFromEvent,
} from '../systems/controlsConfig.js';
import {
  makeSlider, setScrollIndex, sliderClick, sliderDrag, sliderGetValue, sliderThumb,
  indicatorText, SLIDER_HEIGHT, SLIDER_INDICATOR_OFFSET, TROUGH_COLOR, TINT,
} from './horizontalSlider.js';
import { ToolTip } from './toolTip.js';
import { getBool, getFloat, getInt, setValue, saveSettings, effectiveSettings } from '../systems/settings.js';

// MeleeAttackDetection is the ONE of this window's ten keys tiered
// `stored` - the port has no melee-detection branch to consume it - so
// it is read through effectiveSettings, the settings menu's own
// display surface, exactly as ui/pauseWindow.js:144-146 reads its
// three stored-tier controls. The tier doctrine reserves the typed
// getters for LIVE keys, and settings.test.js enforces it. The CLAMP
// GetInt(0,1) would have applied (SettingsManager.cs:516) is applied
// here instead, so a corrupt value still lands on a real slider stop.
const effInt = (sec, key, min, max) =>
  Math.min(max, Math.max(min, Number(effectiveSettings()[sec]?.[key] ?? min) || min));
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

/** mainPanelSize (:83) at Center/Middle over the 320x200 native panel. */
export const MOUSE_PANEL = Object.freeze([1, 15, 318, 170]);
/** mainPanelBackgroundColor / continueButtonBackgroundColor /
 *  keybindButtonBackgroundColor (:29-31). */
export const PANEL_COLOR = Object.freeze([0, 0, 0, 1]);
export const KEYBIND_BG = Object.freeze([0.2, 0.2, 0.2, 1]);
export const CONTINUE_BG = Object.freeze([0.5, 0, 0, 1]);
/** continueButton (:104-110): 80x10, Right/Bottom inside the panel. */
export const CONTINUE_RECT = Object.freeze([238, 160, 80, 10]);
/** titleLabel.Position.y (:98); x is centred away. */
export const TITLE_Y = 4;

/** SetupKeybindButton's panel/label/button geometry (:174-208). */
export const ROW_SIZE = Object.freeze({ w: 85, h: 15 });
export const ROW_LABEL = Object.freeze({ w: 40, h: 10 });
export const ROW_BUTTON = Object.freeze({ w: 43, h: 10, x: 42, y: 2.5 });

/** The six SetupKeybindButton calls (:113-118), in DFU's order, with
 *  the Internal_Settings face each action wears here. */
export const KEYBIND_ROWS = Object.freeze([
  { action: 'Escape', label: 'Escape', x: 20, y: 20 },
  { action: 'AutoRun', label: 'AutoRun', x: 20, y: 40 },
  { action: 'ToggleConsole', label: 'Console', x: 115, y: 20 },
  { action: 'PrintScreen', label: 'Screenshot', x: 115, y: 40 },
  { action: 'QuickSave', label: 'QuickSave', x: 210, y: 20 },
  { action: 'QuickLoad', label: 'QuickLoad', x: 210, y: 40 },
]);

/** CreateSlider's panel (:224-247): 70x45, label centred at the top,
 *  trough at (0,6) 70 wide. */
export const SLIDER_PANEL = Object.freeze({ w: 70, h: 45, troughY: 6 });

/** SettingsManager.GetMouseLookSmoothingFactors (:354-357) - the SIX
 *  factors the strength names index. */
export const SMOOTHING_FACTORS = Object.freeze([0.0, 0.3, 0.4, 0.5, 0.6, 0.7]);
/** GetMouseLookSmoothingStrength (:359-368): the INDEX of an exact
 *  match, and 0 for anything else - a stored 0.45 reads as "None". */
export function smoothingStrength(factor) {
  const i = SMOOTHING_FACTORS.indexOf(factor);
  return i < 0 ? 0 : i;
}

/** Internal_Settings.csv, verbatim. */
export const SMOOTHING_STRENGTHS = Object.freeze(['None', 'Lowest', 'Low', 'Medium', 'High', 'Highest']);
export const WEAPON_SWING_MODES = Object.freeze(['Vanilla', 'Click', 'Hold']);
/** Internal_Settings_en.asset, id 392878225761951744. */
export const MELEE_DETECTION_MODES = Object.freeze(['Performance', 'Quality']);

/** The four CreateSlider calls (:120-133), and the label each carries. */
export const SLIDERS = Object.freeze([
  { id: 'mouseSmoothing', label: 'Mouse Look Smoothing', x: 150, y: 70 },
  { id: 'mouseSensitivity', label: 'Mouse Look Sensitivity', x: 20, y: 70 },
  { id: 'weaponSwingMode', label: 'Weapon Swing Mode', x: 150, y: 90 },
  { id: 'meleeAttackDetection', label: 'Hit Detection', x: 20, y: 145 },
]);

/** The five AddOption calls (:122-131). Checkbox.cs's texture is 7x7
 *  and its label sits TextHorzOffset 2 / TextVertOffset 1 across
 *  (:26-27, :140). */
export const CHECK_SIZE = 7;
export const CHECK_TEXT_OFFSET = Object.freeze([2, 1]);
export const CHECKBOXES = Object.freeze([
  { id: 'invertMouseVertical', label: 'Invert Look-Y', x: 20, y: 120, section: 'Controls', key: 'InvertMouseVertical' },
  { id: 'movementAcceleration', label: 'Movement Acceleration', x: 20, y: 130, section: 'Controls', key: 'MovementAcceleration' },
  { id: 'bowDrawback', label: 'Bows - draw and release', x: 150, y: 120, section: 'Controls', key: 'BowDrawback' },
  { id: 'toggleSneak', label: 'Toggle Sneak', x: 150, y: 130, section: 'Controls', key: 'ToggleSneak' },
  { id: 'meleeAttackFriendlyProtection', label: 'Protect Friendlies and Neutrals', x: 150, y: 145, section: 'MeleeAttacks', key: 'MeleeAttackFriendlyProtection' },
]);

/** AddTextbox (:135, :253-283). */
export const THRESHOLD = Object.freeze({
  label: 'Mouse Weapon Attack Threshold',
  x: 20, y: 90, panelW: 100, panelH: 20,
  box: [0, 10, 30, 6], maxCharacters: 5,
});
/** SettingsManager.cs:534 - the clamp OnUpdateValues re-applies (:355). */
export const THRESHOLD_RANGE = Object.freeze([0.001, 1.0]);
/** SettingsManager.cs:524 - the sensitivity slider's own range. */
export const SENSITIVITY_RANGE = Object.freeze([0.1, 16.0]);

/** DaggerfallUI.DaggerfallDefaultTextColor's role here, and the dim
 *  the port's other native windows use for a secondary face. */
const TEXT_COLOR = [0.9, 0.9, 0.75, 1];
const WHITE = [1, 1, 1, 1];

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;
/** panel-relative -> native. */
export const toNative = ([x, y, w, h]) => [MOUSE_PANEL[0] + x, MOUSE_PANEL[1] + y, w, h];

/** C#'s float.TryParse over the invariant-ish shapes a five-character
 *  field can hold: optional sign, digits with an optional point, an
 *  optional exponent. Anything else - the EMPTY string a never-touched
 *  TextBox reports above all - fails, and the caller writes nothing. */
export function tryParseFloat(text) {
  const s = String(text ?? '').trim();
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class MouseControlsWindow {
  /**
   * @param unsaved the CONTROLS window's staged dicts - DFU's two
   *   windows both edit ControlsConfigManager.Instance, one object, so
   *   a rebind made here is staged into the same dictionaries the grid
   *   stages into and applies with them.
   * @param hooks   { onBack() } - CancelWindow's return to the grid.
   */
  constructor(unsaved, hooks = {}) {
    this.unsaved = unsaved;
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;
    this.capture = null;      // waitingForInput (:56)
    this.top = null;          // 'remove'
    this._removeAction = null;
    this._box = null;
    this.dupes = checkDuplicates(this.unsaved);
    this.tip = new ToolTip();
    this._drag = null;

    // Setup's reads (:120-135), each through the getter DFU's
    // SettingsManager uses for that key.
    this.sliders = {
      mouseSmoothing: makeSlider({
        mode: 'choices', items: SMOOTHING_STRENGTHS,
        selected: smoothingStrength(getFloat('Controls', 'MouseLookSmoothingFactor', 0.0, 0.9)),
      }),
      mouseSensitivity: makeSlider({
        mode: 'float', min: SENSITIVITY_RANGE[0], max: SENSITIVITY_RANGE[1],
        start: getFloat('Controls', 'MouseLookSensitivity', ...SENSITIVITY_RANGE),
      }),
      weaponSwingMode: makeSlider({
        mode: 'choices', items: WEAPON_SWING_MODES,
        selected: getInt('Controls', 'WeaponSwingMode', 0, 2),
      }),
      meleeAttackDetection: makeSlider({
        mode: 'choices', items: MELEE_DETECTION_MODES,
        selected: effInt('MeleeAttacks', 'MeleeAttackDetection', 0, 1),
      }),
    };
    this.checks = {};
    for (const c of CHECKBOXES) this.checks[c.id] = getBool(c.section, c.key);
    // DefaultText is the STORED value's face; Text starts empty (:277).
    this.threshold = {
      text: '',
      defaultText: String(getFloat('Controls', 'WeaponAttackThreshold', ...THRESHOLD_RANGE)),
      focus: false,
    };

    // :78 - the whole of this window's write path.
    this._unsub = onSavedKeyBinds(() => this.applyValues());
  }

  /** The subscription DFU never releases, because its windows are
   *  DaggerfallUI singletons and this one is not. The controls window
   *  calls it AFTER its save, so the last raise still lands. */
  dispose() { this._unsub?.(); this._unsub = null; }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  _refresh() { this.dupes = checkDuplicates(this.unsaved); }

  /** OnUpdateValues (:334-360). */
  applyValues() {
    setValue('Controls', 'MouseLookSensitivity', sliderGetValue(this.sliders.mouseSensitivity).toFixed(1));
    setValue('Controls', 'MouseLookSmoothingFactor',
      SMOOTHING_FACTORS[this.sliders.mouseSmoothing.scrollIndex]);
    setValue('Controls', 'MovementAcceleration', this.checks.movementAcceleration);
    setValue('Controls', 'InvertMouseVertical', this.checks.invertMouseVertical);
    setValue('Controls', 'WeaponSwingMode', this.sliders.weaponSwingMode.scrollIndex);
    setValue('Controls', 'BowDrawback', this.checks.bowDrawback);
    setValue('Controls', 'ToggleSneak', this.checks.toggleSneak);
    setValue('MeleeAttacks', 'MeleeAttackDetection', this.sliders.meleeAttackDetection.scrollIndex);
    setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', this.checks.meleeAttackFriendlyProtection);

    const v = tryParseFloat(this.threshold.text);
    if (v !== null) setValue('Controls', 'WeaponAttackThreshold', clamp(v, ...THRESHOLD_RANGE));

    saveSettings();
  }

  _close() {
    // ContinueButton_OnMouseClick (:369-376): CancelWindow, nothing else.
    this.done = true;
    this.hooks.onBack?.();
  }

  /** The row rects, panel-relative. */
  static rowButtonRect(row) {
    return [row.x + ROW_BUTTON.x, row.y + ROW_BUTTON.y, ROW_BUTTON.w, ROW_BUTTON.h];
  }
  static sliderTroughRect(s) {
    return [s.x, s.y + SLIDER_PANEL.troughY, SLIDER_PANEL.w, SLIDER_HEIGHT];
  }
  static thresholdBoxRect() {
    return [THRESHOLD.x + THRESHOLD.box[0], THRESHOLD.y + THRESHOLD.box[1],
      THRESHOLD.box[2], THRESHOLD.box[3]];
  }

  input(code, e = null) {
    if (this.capture) {
      // WaitForKeyPress is DaggerfallControlsWindow's own static
      // (:436-439 calls it), so the capture law - and the port's
      // narrowing of its two-key gesture onto the event's modifier
      // flags - is the grid's, unchanged.
      const combo = comboFromEvent(code, e);
      setUnsavedBinding(this.unsaved, this.capture, combo ?? code);
      this.capture = null;
      this._refresh();
      return;
    }
    if (this.top === 'remove') {
      if (code === 'KeyY') {
        this._click();
        setUnsavedBinding(this.unsaved, this._removeAction, null);
        this._refresh();
      }
      if (code === 'KeyY' || code === 'KeyN' || code === 'Escape') { this.top = null; this._removeAction = null; }
      return;
    }
    if (this.threshold.focus) {
      // TextBox's keyboard (TextBox.cs:415-430): a character appends
      // while the text is under MaxCharacters, Backspace removes one.
      // Enter and Escape both leave the field - DFU drops focus on the
      // next click elsewhere, and a keyboard-only door is the port's.
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'Escape') { this.threshold.focus = false; return; }
      if (code === 'Backspace') { this.threshold.text = this.threshold.text.slice(0, -1); return; }
      const ch = e?.key;
      if (typeof ch === 'string' && ch.length === 1 && !e?.ctrlKey && !e?.metaKey
        && this.threshold.text.length < THRESHOLD.maxCharacters) this.threshold.text += ch;
      return;
    }
    if (code === 'Escape') {
      // AllowCancel is false only while waiting for input (:325-329);
      // otherwise Escape is CancelWindow, the same exit as CONTINUE.
      this._click();
      this._close();
    }
  }

  hover(vx, vy) {
    if (this.capture || this.top) { this.tip.hide(); return; }
    const dict = currentDict(this.unsaved);
    for (const row of KEYBIND_ROWS) {
      if (inRect(toNative(MouseControlsWindow.rowButtonRect(row)), vx, vy)) {
        // SuppressToolTip (:167-169): only an elongated label gets one.
        const code = dict.get(row.action);
        if (buttonText(code) !== ELONGATED_TEXT) { this.tip.hide(); return; }
        this.tip.show(buttonText(code, true), vx, vy);
        return;
      }
    }
    this.tip.hide();
  }

  tick(dt) { this.tip.update(dt); }

  /** The thumb drag (HorizontalSlider.cs:130-153) - held while the
   *  pointer is down, released by the host's pointer-up. */
  drag(vx) {
    if (!this._drag) return;
    const s = this.sliders[this._drag.id];
    sliderDrag(s, SLIDER_PANEL.w, vx - this._drag.fromX, this._drag.fromIndex);
  }

  release() { this._drag = null; }

  click(vx, vy, right = false) {
    if (this.capture) return true;
    if (this.top === 'remove') {
      if (this._box) {
        const hit = messageBoxHit(this._box, vx, vy);
        if (hit === MB_BUTTONS.Yes) this.input('KeyY');
        else if (hit === MB_BUTTONS.No) this.input('KeyN');
        return true;
      }
      this.top = null;
      return true;
    }
    for (const row of KEYBIND_ROWS) {
      if (inRect(toNative(MouseControlsWindow.rowButtonRect(row)), vx, vy)) {
        this._click();
        if (right) {
          // PromptRemoveKeybindMessage refuses on an unbound slot (:292)
          if (currentDict(this.unsaved).get(row.action) == null) return true;
          this.top = 'remove';
          this._removeAction = row.action;
        } else this.capture = row.action;
        return true;
      }
    }
    if (right) return true;
    for (const spec of SLIDERS) {
      const rect = toNative(MouseControlsWindow.sliderTroughRect(spec));
      if (inRect(rect, vx, vy)) {
        const s = this.sliders[spec.id];
        const local = vx - rect[0];
        const thumb = sliderThumb([0, 0, SLIDER_PANEL.w, SLIDER_HEIGHT], s.scrollIndex, s.totalUnits, s.displayUnits);
        if (thumb && local >= thumb[0] && local <= thumb[0] + thumb[2]) {
          this._drag = { id: spec.id, fromX: vx, fromIndex: s.scrollIndex };
        } else sliderClick(s, [0, 0, SLIDER_PANEL.w, SLIDER_HEIGHT], local);
        return true;
      }
    }
    for (const c of CHECKBOXES) {
      if (inRect(toNative([c.x, c.y, CHECK_SIZE, CHECK_SIZE]), vx, vy)) {
        // Checkbox_OnMouseClick (:160-165)
        this.checks[c.id] = !this.checks[c.id];
        return true;
      }
    }
    if (inRect(toNative(MouseControlsWindow.thresholdBoxRect()), vx, vy)) {
      this.threshold.focus = true;   // UseFocus (:281)
      return true;
    }
    this.threshold.focus = false;
    if (inRect(toNative(CONTINUE_RECT), vx, vy)) {
      this._click();
      this._close();
      return true;
    }
    return true;
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);   // see the header: the port's stand-in for a clear parent panel
    const [px, py, pw, ph] = MOUSE_PANEL;
    drawRect(renderer, m, px, py, pw, ph, PANEL_COLOR);
    // Outline.Enabled (:87) - a one-pixel border in the panel colour's
    // own outline, which BaseScreenComponent draws in DaggerfallDefault.
    for (const [ox, oy, ow, oh] of [[px, py, pw, 1], [px, py + ph - 1, pw, 1],
      [px, py, 1, ph], [px + pw - 1, py, 1, ph]]) {
      drawRect(renderer, m, ox, oy, ow, oh, TEXT_COLOR);
    }
    const at = (x, y) => [m.ox + (MOUSE_PANEL[0] + x) * m.s, m.oy + (MOUSE_PANEL[1] + y) * m.s];
    const put = (text, x, y, color = TEXT_COLOR) => {
      const [sx, sy] = at(x, y);
      drawText(renderer, font, text, sx, sy, m.s, color);
    };
    const glyphH = font.fnt?.fixedHeight ?? 6;

    put('Configure Advanced Controls', Math.round((pw - measureText(font.fnt, 'Configure Advanced Controls')) / 2), TITLE_Y);

    // CONTINUE
    drawRect(renderer, m, MOUSE_PANEL[0] + CONTINUE_RECT[0], MOUSE_PANEL[1] + CONTINUE_RECT[1],
      CONTINUE_RECT[2], CONTINUE_RECT[3], CONTINUE_BG);
    put('CONTINUE', CONTINUE_RECT[0] + Math.round((CONTINUE_RECT[2] - measureText(font.fnt, 'CONTINUE')) / 2),
      CONTINUE_RECT[1] + Math.round((CONTINUE_RECT[3] - glyphH) / 2));

    // the six keybind rows
    const dict = currentDict(this.unsaved);
    for (const row of KEYBIND_ROWS) {
      const lw = measureText(font.fnt, row.label);
      put(row.label, row.x + ROW_LABEL.w - lw, row.y + Math.round((ROW_SIZE.h - glyphH) / 2));
      const [bx, by, bw, bh] = MouseControlsWindow.rowButtonRect(row);
      drawRect(renderer, m, MOUSE_PANEL[0] + bx, MOUSE_PANEL[1] + by, bw, bh, KEYBIND_BG);
      const code = dict.get(row.action);
      const label = this.capture === row.action ? '' : buttonText(code);
      const color = this.dupes.internal.has(code) ? INTERNAL_DUPE_COLOR
        : this.dupes.cross.has(code) ? CROSS_DUPE_COLOR : TEXT_COLOR;
      put(label, bx + Math.round((bw - measureText(font.fnt, label)) / 2),
        by + Math.round((bh - glyphH) / 2), color);
    }

    // the four sliders
    for (const spec of SLIDERS) {
      const s = this.sliders[spec.id];
      put(spec.label, spec.x + Math.round((SLIDER_PANEL.w - measureText(font.fnt, spec.label)) / 2), spec.y);
      const [tx, ty, tw, th] = MouseControlsWindow.sliderTroughRect(spec);
      drawRect(renderer, m, MOUSE_PANEL[0] + tx, MOUSE_PANEL[1] + ty, tw, th, TROUGH_COLOR);
      const thumb = sliderThumb([tx, ty, tw, th], s.scrollIndex, s.totalUnits, s.displayUnits);
      if (thumb) drawRect(renderer, m, MOUSE_PANEL[0] + thumb[0], MOUSE_PANEL[1] + thumb[1], thumb[2], thumb[3], TINT);
      put(indicatorText(s), tx + tw + SLIDER_INDICATOR_OFFSET, ty, WHITE);
    }

    // the five checkboxes
    for (const c of CHECKBOXES) {
      for (const [ox, oy, ow, oh] of [[c.x, c.y, CHECK_SIZE, 1], [c.x, c.y + CHECK_SIZE - 1, CHECK_SIZE, 1],
        [c.x, c.y, 1, CHECK_SIZE], [c.x + CHECK_SIZE - 1, c.y, 1, CHECK_SIZE]]) {
        drawRect(renderer, m, MOUSE_PANEL[0] + ox, MOUSE_PANEL[1] + oy, ow, oh, TEXT_COLOR);
      }
      if (this.checks[c.id]) {
        drawRect(renderer, m, MOUSE_PANEL[0] + c.x + 2, MOUSE_PANEL[1] + c.y + 2, CHECK_SIZE - 4, CHECK_SIZE - 4, TEXT_COLOR);
      }
      put(c.label, c.x + CHECK_SIZE + CHECK_TEXT_OFFSET[0], c.y + CHECK_TEXT_OFFSET[1]);
    }

    // the threshold field
    put(THRESHOLD.label, THRESHOLD.x, THRESHOLD.y);
    const [fx, fy, fw, fh] = MouseControlsWindow.thresholdBoxRect();
    for (const [ox, oy, ow, oh] of [[fx, fy, fw, 1], [fx, fy + fh - 1, fw, 1],
      [fx, fy, 1, fh], [fx + fw - 1, fy, 1, fh]]) {
      drawRect(renderer, m, MOUSE_PANEL[0] + ox, MOUSE_PANEL[1] + oy, ow, oh, WHITE);
    }
    put(this.threshold.text || this.threshold.defaultText, fx + 1, fy, WHITE);

    if (this.capture) put('Press a key...', 4, MOUSE_PANEL[3] - 12);

    if (this.top === 'remove') {
      const rows = removeKeybindPromptRows(this._removeAction,
        currentDict(this.unsaved).get(this._removeAction));
      this._box = layoutMessageBox(font, rows, [MB_BUTTONS.Yes, MB_BUTTONS.No]);
      if (!drawMessageBox(renderer, m, font, this._box)) {
        (this._box.rows ?? []).forEach((r, i) =>
          drawText(renderer, font, r.text, m.ox + 20 * m.s, m.oy + (20 + i * 10) * m.s, m.s, TEXT_COLOR));
      }
    } else this._box = null;
    this.tip.draw(renderer, m, font);
  }
}
