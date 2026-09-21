// CM3 - THE ONE DaggerfallInputMessageBox.
//
// DaggerfallInputMessageBox (DaggerfallInputMessageBox.cs) is the small
// parchment prompt DFU pushes over an existing window whenever it needs
// one line of text or a number: optional text tokens above, a LABEL and
// a TextBox on one row, Return raises OnGotUserInput, Escape (the base
// popup's close) raises nothing. Six sites in DFU raise one - the action
// system's ShowTextWithInput, the spell maker's and the item maker's
// name buttons, the spellbook's rename, the travel map's find, the
// automap's note - and before this class each of the port's windows
// typed the field into its own art with its own key router (Ledger A
// row TB1, retired by CM3-CM9). This is the one home: the field's law
// lives here once, and a window that needs a line of text PUSHES one of
// these and reads the answer, as its DFU original does.
//
// The port's hosts hold ONE overlay slot, not a window stack, so the
// window that raised the box OWNS it - routes its input, draws it over
// itself, and drops it when `done` - exactly as CharSheet owns the
// windows it pushes (ui/charsheet.js's `child`).
//
// TWO VOCABULARIES, one reader. The dungeon host routes overlay ACTIONS
// ('confirm', 'back', 'backspace', 'char:x'); the exterior hosts route
// raw browser codes ('Enter', 'Escape', 'Backspace', 'KeyA' + e.key).
// `typedChar` already reads both spellings of a character; the three
// control keys are read both ways here, so one box serves every host.

import { nativeMetrics } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxArtLoaded } from './messageBox.js';
import { drawText, measureText } from './text.js';
import { typedChar } from './input.js';
import { normalizeCode } from '../systems/dialogShortcuts.js';
import { noteInputBoxClosed } from '../player/pointerLock.js';   // PL1: CloseWindow's stamp (DaggerfallInputMessageBox.cs:301)

/** TextBox.maxCharacters' default (TextBox.cs:26): what every
 *  DaggerfallInputMessageBox takes unless its raiser narrows it. */
export const DEFAULT_INPUT_MAX = 31;

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];
const DIM = [0.55, 0.52, 0.45, 1];

const SUBMIT = new Set(['confirm', 'Enter', 'NumpadEnter']);
const CANCEL = new Set(['back', 'Escape']);
const ERASE = new Set(['backspace', 'Backspace']);

/**
 * @typedef {object} InputMessageBoxOptions
 * @property {Array<string|object>} [lines]  the text tokens ABOVE the field (SetTextTokens); none for a bare prompt
 * @property {string} [label]                TextBoxLabel.Text, spacing included ('Enter new name : ', ' > ')
 * @property {string} [value]                TextBox.Text at Show()
 * @property {number} [maxCharacters]        TextBox.MaxCharacters (default 31)
 * @property {boolean} [numeric]             TextBox.Numeric
 * @property {(value: string) => void} [onSubmit]   OnGotUserInput - raised AFTER the box has closed
 * @property {() => void} [onCancel]         the base popup's Escape close; OnGotUserInput is not raised
 */
export class InputMessageBoxWindow {
  /** @param {InputMessageBoxOptions} [opts] */
  constructor({
    lines = [], label = '', value = '', maxCharacters = DEFAULT_INPUT_MAX,
    numeric = false, onSubmit = null, onCancel = null,
  } = {}) {
    this.lines = lines;
    this.label = String(label ?? '');
    this.maxCharacters = Math.max(0, maxCharacters | 0);
    this.value = String(value ?? '').slice(0, this.maxCharacters);
    this.numeric = !!numeric;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
    this.done = false;
    this.isChoiceWindow = true;   // raw browser codes on the native-window hosts
  }

  _close(submit) {
    if (this.done) return;
    this.done = true;
    // ReturnPlayerInputEvent (:283-296) CloseWindow()s FIRST - which
    // stamps timeClosedInputMessageBox (:301), the 0.3s pointer-lock
    // refusal PL1 reads - and raises OnGotUserInput after.
    noteInputBoxClosed();
    if (submit) this.onSubmit?.(this.value);
    else this.onCancel?.();
  }

  input(code, e = null) {
    const c = typeof code === 'string' && code.startsWith('char:') ? code : normalizeCode(code, e);
    if (SUBMIT.has(c)) { this._close(true); return; }
    if (CANCEL.has(c)) { this._close(false); return; }
    if (ERASE.has(c)) { this.value = this.value.slice(0, -1); return; }
    const ch = typedChar(code, e);
    if (!ch || e?.ctrlKey || e?.metaKey || this.value.length >= this.maxCharacters) return;
    if (this.numeric && !/^[0-9]$/.test(ch)) return;   // TextBox.Numeric (TextBox.cs:190-193)
    this.value += ch;
  }

  // Modal, and NOT ClickAnywhereToClose: DaggerfallInputMessageBox
  // never sets it (DaggerfallMessageBox's default is false), so a
  // background click reaches nothing - the raiser's window included.
  click() { return true; }
  clickNative() { return true; }

  draw(renderer, canvas, font, s = 1) {
    const entry = `${this.label}${this.value}_`;
    // The field sizes the box by its MAXIMUM, not its current text
    // (TextBox's fixed width), so the parchment does not breathe as the
    // player types.
    const sizing = `${this.label}${'M'.repeat(this.maxCharacters)}_`;
    if (messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      const box = layoutMessageBox(font, [...this.lines, { text: entry, center: false }], [], {
        sizingRows: [...this.lines, { text: sizing, center: false }],
      });
      if (drawMessageBox(renderer, m, font, box)) return;
    }
    // Art-less: the same rows on the flat panel, the entry dimmed as
    // ActionInputBox's always was.
    const scale = s || 1;
    const rows = this.lines.map((l) => (typeof l === 'string' ? l : (l?.text ?? '')));
    const w = Math.max(...rows.map((l) => measureText(font.fnt, l)), measureText(font.fnt, sizing)) * scale + 24 * scale;
    const lineH = 12 * scale;
    const h = (rows.length + 2) * lineH + 20 * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    let ty = y + 12 * scale;
    for (const l of rows) { drawText(renderer, font, l, x + 12 * scale, ty, scale, TEXT); ty += lineH; }
    drawText(renderer, font, entry, x + 12 * scale, ty + lineH, scale, DIM);
  }
}
