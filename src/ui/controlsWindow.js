// I4: THE CONTROLS WINDOW - DaggerfallControlsWindow.cs (MIT,
// Daggerfall Workshop) on the real CNFG00I0.IMG, with CNFG00I1's
// mouse-look-alt panel at (152,100,168,45) (:100-105). The rebinding
// grid the I1 registry has been waiting for.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is the full 320x200 CNFG00I0 (:96-99).
// - NINE GROUPS of 47x7 buttons stacked at +11 (:184-201), covering
//   Actions[2..40) - 38 of the 44: Escape and ToggleConsole are not
//   offered, and QuickSave/QuickLoad/PrintScreen/AutoRun sit past
//   the grid's end. DFU's own quirk, kept: those six rebind only by
//   editing the file.
// - the group anchors are the FIRST-SETUP values (:146-152). DFU's
//   UpdateKeybindButtons re-anchors every group one pixel up-left
//   (:243-251 - 56,12 against 57,13), so its labels shift by (1,1)
//   after the first rebind; the port draws from ONE table and the
//   quirk is recorded rather than reproduced (Ledger B would need a
//   second layout table to lie identically).
// - the tab row at y=190 (:108-131): JOYSTICK (0), ADVANCED (80 -
//   DFU's mouse tab), DEFAULT (160), CONTINUE (240), 80x10 each. The
//   first two answer with a note: no gamepad layer, and the advanced
//   window rides the settings arc.
// - the PRIMARY/SECONDARY toggle at (268,0,50,8) (:135-141), showing
//   which staged dict the grid edits; switching is refused while the
//   shown dict carries an internal clash (:337-343).
//
// THE FLOW, law for law:
// - a LEFT CLICK on a key button enters capture: the next keydown
//   binds (WaitForKeyPress :383-427). ReservedKeys is EMPTY in DFU
//   (:73), so every key binds - Escape included. A8 retired half of
//   the combo flag that stood here: a captured key pressed under
//   Ctrl/Shift/Alt now binds a COMBO, and the grid draws it through
//   GetButtonText's combo arm ("LSHIFT + T", elongated past ten
//   characters with the full string on the tooltip). Still not here:
//   DFU also captures MOUSE BUTTONS in this window, and its two-key
//   gesture accepts ANY key as the modifier where this one reads the
//   event's three virtual flags.
// - a RIGHT CLICK prompts to remove the binding (:371-381,
//   PromptRemoveKeybindMessage :290-320), Yes staging null.
// - DUPLICATES colour the labels - red inside the shown dict, blue
//   across the two (:243-266) - and EITHER kind blocks CONTINUE and
//   Escape with the multipleAssignments box (:258-267, :319-333).
// - DEFAULT confirms, then resets the LIVE registry and re-stages
//   (:296-317).
// - CONTINUE on a valid grid closes; the close APPLIES the staged
//   dicts and saves (OnPop :163-171).
import { loadImg, nativeMetrics, drawImg } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { drawText, measureText } from './text.js';
import { ACTIONS, saveKeyBinds, comboCode } from '../systems/inputActions.js';
import { bindings } from './input.js';
import {
  createUnsavedKeybinds, currentDict, setUnsavedBinding, checkDuplicates,
  applyUnsavedKeybinds, resetUnsavedToDefaults, buttonText, ELONGATED_TEXT,
  INTERNAL_DUPE_COLOR, CROSS_DUPE_COLOR,
} from '../systems/controlsConfig.js';
import { ToolTip } from './toolTip.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

/** SetupKeybindButtons' nine calls (:146-152): [startIndex, endIndex)
 *  into the Actions enum, and the group's anchor. */
export const KEY_GROUPS = Object.freeze([
  { start: 2, end: 8, x: 57, y: 13 },     // moveKeysOne
  { start: 8, end: 14, x: 164, y: 13 },   // moveKeysTwo
  { start: 14, end: 20, x: 270, y: 13 },  // modeKeys
  { start: 20, end: 24, x: 102, y: 80 },  // magicKeys
  { start: 24, end: 27, x: 102, y: 125 }, // weaponKeys
  { start: 27, end: 30, x: 102, y: 159 }, // statusKeys
  { start: 30, end: 32, x: 270, y: 80 },  // activateKeys
  { start: 32, end: 36, x: 270, y: 103 }, // lookKeys
  { start: 36, end: 40, x: 270, y: 148 }, // uiKeys
]);
/** buttonGroup[j].Size (:159) and the +11 stride (:164). */
export const KEY_BTN = Object.freeze({ w: 47, h: 7, stride: 11 });
/** The tab row (:108-131) and the primary/secondary toggle (:135). */
export const TAB_RECTS = Object.freeze({
  joystick: [0, 190, 80, 10],
  advanced: [80, 190, 80, 10],
  defaults: [160, 190, 80, 10],
  continue: [240, 190, 80, 10],
  whichDict: [268, 0, 50, 8],
});
/** mLookAltPanel (:100-103). */
export const MLOOK_ALT_RECT = Object.freeze([152, 100, 168, 45]);

/** Every button the grid offers, derived once from the group table. */
export function gridButtons() {
  const out = [];
  for (const g of KEY_GROUPS) {
    for (let i = g.start; i < g.end; i++) {
      out.push({ action: ACTIONS[i], x: g.x, y: g.y + (i - g.start) * KEY_BTN.stride });
    }
  }
  return out;
}

let _art = null;
export async function preloadControlsArt(deps) {
  if (!_art) {
    const base = await loadImg(deps, 'CNFG00I0.IMG');
    let mlook = null;
    try { mlook = await loadImg(deps, 'CNFG00I1.IMG'); } catch { /* the alt panel is optional art */ }
    _art = { base, mlook };
  }
  return _art;
}
export const controlsArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** The three virtual modifiers a KeyboardEvent reports, each mapped to
 *  the LEFT physical key - see the narrowing note in input(). The
 *  modifier keys themselves are excluded: pressing Shift alone must
 *  bind Shift, not a Shift+Shift combo. */
const EVENT_MODIFIERS = Object.freeze([
  ['ctrlKey', 'ControlLeft', ['ControlLeft', 'ControlRight']],
  ['shiftKey', 'ShiftLeft', ['ShiftLeft', 'ShiftRight']],
  ['altKey', 'AltLeft', ['AltLeft', 'AltRight']],
]);
export function comboFromEvent(code, e) {
  if (!e) return null;
  for (const [flag, mod, own] of EVENT_MODIFIERS) {
    if (e[flag] && !own.includes(code)) return comboCode(mod, code);
  }
  return null;
}

/** The remove prompt's action face (:302): camel case split. */
const splitCamel = (s) => s.replace(/(?<=[a-z])([A-Z])/g, ' $1').trim();

const TEXT_COLOR = [0.9, 0.9, 0.75, 1];   // DaggerfallDefaultTextColor's role here
const DIM = [0.6, 0.58, 0.5, 1];

export class ControlsWindow {
  /** hooks: { onBack() } - the host reopens the pause window. */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;
    this.unsaved = createUnsavedKeybinds(bindings());
    this.buttons = gridButtons();
    this.capture = null;        // the action awaiting a key (:52 waitingForInput)
    this.top = null;            // 'dupes' | 'defaults' | 'remove' | 'note'
    this._noteRows = null;
    this._removeAction = null;
    this._box = null;
    this.dupes = checkDuplicates(this.unsaved);
    // U37: DFU points every key button at the shared tooltip and
    // SUPPRESSES it unless the label elongated (:214-216) - the tip
    // exists to show the full text a '...' is standing in for.
    this.tip = new ToolTip();
    this._hover = [-1, -1];
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  _close() {
    // OnPop (:163-171): apply the staged dicts, save, and hand the
    // slot back to the pause window.
    applyUnsavedKeybinds(bindings(), this.unsaved);
    saveKeyBinds(bindings());
    this.done = true;
    this.hooks.onBack?.();
  }

  _refresh() { this.dupes = checkDuplicates(this.unsaved); }

  input(code, e = null) {
    if (this.capture) {
      // WaitForKeyPress (:380-424): the next key binds - reserved keys
      // are EMPTY in DFU, so Escape binds too rather than cancelling.
      //
      // A8 - THE COMBO HALF. DFU takes TWO key-downs: the first is the
      // modifier, and a second arriving before the first comes up makes
      // `GetComboCode(code1, code2)` (:408). The port's overlay seam
      // delivers key-DOWNS only and no held set, so the two-key gesture
      // is read off the event's own modifier flags instead: a captured
      // key pressed under Ctrl, Shift or Alt binds the combo, anything
      // else binds the single code.
      //
      // NARROWED, deliberately, and the narrowing is only here in the
      // capture: DFU lets ANY key be the modifier (Z+LeftShift is legal
      // and GetDuplicates' third phase exists for it), and it tells
      // left from right. A browser KeyboardEvent reports three virtual
      // flags and no side, so this door offers the LEFT side of the
      // three - which is what every DFU default binds anyway. The
      // storage, the duplicate law and the runtime read take any pair.
      const combo = comboFromEvent(code, e);
      setUnsavedBinding(this.unsaved, this.capture, combo ?? code);
      this.capture = null;
      this._refresh();
      return;
    }
    if (this.top === 'defaults') {
      if (code === 'KeyY') {
        this._click();
        resetUnsavedToDefaults(bindings(), this.unsaved);
        saveKeyBinds(bindings());   // ConfirmDefaultsBox (:309-317)
        this._refresh();
      }
      if (code === 'KeyY' || code === 'KeyN' || code === 'Escape') this.top = null;
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
    if (this.top) { this.top = null; return; }   // dupes/note: any key clears
    if (code === 'Escape') {
      // the back door obeys the same gate as CONTINUE (:71-74)
      if (!this.dupes.ok) { this.top = 'dupes'; return; }
      this._click();
      this._close();
    }
  }

  /** U37: the hover seam. A key button whose label ELONGATED offers
   *  its full text; everything else offers nothing, exactly as
   *  SuppressToolTip decides (:214-216). */
  hover(vx, vy) {
    this._hover = [vx, vy];
    if (this.capture || this.top) { this.tip.hide(); return; }
    const dict = currentDict(this.unsaved);
    for (const b of this.buttons) {
      if (inRect([b.x, b.y, KEY_BTN.w, KEY_BTN.h], vx, vy)) {
        const code = dict.get(b.action);
        // the SUPPRESS rule: only an elongated label gets a tip
        if (buttonText(code) !== ELONGATED_TEXT) { this.tip.hide(); return; }
        this.tip.show(buttonText(code, true), vx, vy);
        return;
      }
    }
    this.tip.hide();
  }

  /** The tooltip's rest clock. `tick` is the name the hosts' overlay
   *  seam already calls (townTalk.frame, dungeonContext.tickOverlay) -
   *  ONE per-frame hook, not a second one beside it. */
  tick(dt) { this.tip.update(dt); }

  /** vx/vy native; `right` marks the remove gesture (:371). */
  click(vx, vy, right = false) {
    if (this.capture) return true;   // every tab ignores clicks mid-capture (:283 etc.)
    if (this.top) {
      if ((this.top === 'defaults' || this.top === 'remove') && this._box) {
        const hit = messageBoxHit(this._box, vx, vy);
        if (hit === MB_BUTTONS.Yes) this.input('KeyY');
        else if (hit === MB_BUTTONS.No) this.input('KeyN');
        return true;
      }
      this.top = null;
      return true;
    }
    for (const b of this.buttons) {
      if (inRect([b.x, b.y, KEY_BTN.w, KEY_BTN.h], vx, vy)) {
        this._click();
        if (right) {
          // PromptRemoveKeybindMessage refuses on an unbound slot (:292)
          if (currentDict(this.unsaved).get(b.action) == null) return true;
          this.top = 'remove';
          this._removeAction = b.action;
        } else this.capture = b.action;
        return true;
      }
    }
    if (inRect(TAB_RECTS.continue, vx, vy)) {
      this._click();
      if (!this.dupes.ok) this.top = 'dupes';   // ShowMultipleAssignmentsMessage
      else this._close();
      return true;
    }
    if (inRect(TAB_RECTS.defaults, vx, vy)) { this._click(); this.top = 'defaults'; return true; }
    if (inRect(TAB_RECTS.whichDict, vx, vy)) {
      this._click();
      // the switch is refused while the SHOWN dict clashes internally
      if (this.dupes.internal.size) { this.top = 'dupes'; return true; }
      this.unsaved.usingPrimary = !this.unsaved.usingPrimary;
      this._refresh();
      return true;
    }
    if (inRect(TAB_RECTS.joystick, vx, vy)) {
      this._click(); this.top = 'note';
      this._noteRows = ['The port has no gamepad layer (Ledger).'];
      return true;
    }
    if (inRect(TAB_RECTS.advanced, vx, vy)) {
      this._click(); this.top = 'note';
      this._noteRows = ['Advanced mouse settings live in the launcher menu.'];
      return true;
    }
    return true;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this.done = true; return; }
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);
    drawImg(renderer, _art.base, m, 0, 0);
    if (_art.mlook) drawImg(renderer, _art.mlook, m, MLOOK_ALT_RECT[0], MLOOK_ALT_RECT[1]);
    const dict = currentDict(this.unsaved);
    for (const b of this.buttons) {
      const code = dict.get(b.action);
      const label = this.capture === b.action ? '' : buttonText(code);
      const color = this.dupes.internal.has(code) ? INTERNAL_DUPE_COLOR
        : this.dupes.cross.has(code) ? CROSS_DUPE_COLOR : TEXT_COLOR;
      const lw = measureText(font.fnt, label);
      drawText(renderer, font, label,
        m.ox + (b.x + Math.round((KEY_BTN.w - lw) / 2)) * m.s,
        m.oy + b.y * m.s, m.s, color);
    }
    // the primary/secondary face (:141)
    const which = this.unsaved.usingPrimary ? 'PRIMARY' : 'SECONDARY';
    drawText(renderer, font, which,
      m.ox + (TAB_RECTS.whichDict[0] + 2) * m.s, m.oy + (TAB_RECTS.whichDict[1] + 1) * m.s,
      m.s, DIM);
    if (this.capture) {
      drawText(renderer, font, 'Press a key...', m.ox + 4 * m.s, m.oy + 180 * m.s, m.s, TEXT_COLOR);
    }
    if (this.top) {
      // the three prompts are Internal_Strings' own, recovered - the
      // remove prompt formats the camel-split action and the FULL key
      // text exactly as PromptRemoveKeybindMessage does (:300-302)
      const rows = this.top === 'dupes' ? ['You have multiple assignments...']
        : this.top === 'defaults' ? ['Are you sure you want to set default controls?']
          : this.top === 'remove' ? [`Are you sure you want to remove the keybind`,
            `for ${splitCamel(this._removeAction)} ('${buttonText(currentDict(this.unsaved).get(this._removeAction), true)}')?`]
            : this._noteRows;
      const buttons = (this.top === 'defaults' || this.top === 'remove') ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._box = layoutMessageBox(font, rows, buttons);
      if (!drawMessageBox(renderer, m, font, this._box)) {
        (this._box.rows ?? []).forEach((r, i) => drawText(renderer, font, r.text, m.ox + 20 * m.s, m.oy + (20 + i * 10) * m.s, m.s, TEXT_COLOR));
      }
    } else this._box = null;
    this.tip.draw(renderer, m, font);   // LAST - DFU's final-component order
  }
}
