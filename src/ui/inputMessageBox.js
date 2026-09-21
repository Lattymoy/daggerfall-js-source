// CM3 - THE ONE DaggerfallInputMessageBox.
//
// DaggerfallInputMessageBox (DaggerfallInputMessageBox.cs) is the small
// prompt DFU pushes over an existing window whenever it needs one line
// of text or a number: optional text tokens above, a LABEL and a
// TextBox on one row, Return raises OnGotUserInput, Escape (the base
// popup's close) raises nothing. Eleven sites in DFU raise one - the
// action system's ShowTextWithInput, the spell maker's and the item
// maker's name buttons, the spellbook's rename, the travel map's find,
// the automap's note, the inventory's split popup and drop-gold prompt,
// the save window's rename, the guild donation, the tavern's day count -
// and before this class each of the port's windows typed the field into
// its own art with its own key router (Ledger A row TB1, retired by
// CM3-CM11). This is the one home: the field's law lives here once, and
// a window that needs a line of text PUSHES one of these and reads the
// answer, as its DFU original does.
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
//
// AUDIT-CM (2026-09-21) brought the class to the C# on four counts the
// first cut had wrong: the TextBox has a CURSOR (Left/Right/Home/End,
// Delete at it, Backspace before it, insertion at it - TextBox.cs
// :352-409); a NUMERIC field takes a shifted digit by its key
// (TextBox.cs:446-449, Alpha0..9 in NumericMode.Natural); the seed is
// never truncated (TextBox.Text's setter, :74-82, only typing is
// capped); and the pointer-lock stamp belongs to ReturnPlayerInputEvent
// ALONE (:298-304) - Escape goes through DaggerfallPopupWindow
// .CancelWindow and stamps nothing. It also grew the two construction
// flags the action system's box passes (:107-122): no parchment, and
// shown at the TOP of the screen.

import { nativeMetrics, shadowText, NATIVE_W } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxArtLoaded } from './messageBox.js';
import { drawText, measureText } from './text.js';
import { typedChar } from './input.js';
import { normalizeCode } from '../systems/dialogShortcuts.js';
import { noteInputBoxClosed } from '../player/pointerLock.js';   // PL1: ReturnPlayerInputEvent's stamp (DaggerfallInputMessageBox.cs:301)

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
 * @property {string} [label]                TextBoxLabel.Text, spacing included ('Enter new name : ', ' > '); '' when the raiser sets none
 * @property {string} [value]                TextBox.Text at Show(), shown whole even past MaxCharacters
 * @property {number} [maxCharacters]        TextBox.MaxCharacters (default 31)
 * @property {boolean} [numeric]             TextBox.Numeric
 * @property {boolean} [parchment]           useParchmentBackGround (:110, default true): the SPOP.RCI frame, or bare text
 * @property {boolean} [atTop]               showAtTopOfScreen (:111, default false): VerticalAlignment.Top instead of Middle (:150-152)
 * @property {(value: string) => void} [onSubmit]   OnGotUserInput - raised AFTER the box has closed
 * @property {() => void} [onCancel]         the base popup's Escape close; OnGotUserInput is not raised
 */
export class InputMessageBoxWindow {
  /** @param {InputMessageBoxOptions} [opts] */
  constructor({
    lines = [], label = '', value = '', maxCharacters = DEFAULT_INPUT_MAX,
    numeric = false, parchment = true, atTop = false, onSubmit = null, onCancel = null,
  } = {}) {
    this.lines = lines;
    this.label = String(label ?? '');
    this.maxCharacters = Math.max(0, maxCharacters | 0);
    this.value = String(value ?? '');   // TextBox.Text's setter does not truncate (:74-82); only typing is capped
    this.cursor = this.value.length;    // SetCursorPosition(text.Length) on Text's setter
    this.numeric = !!numeric;
    this.parchment = !!parchment;
    this.atTop = !!atTop;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
    this.done = false;
    this.isChoiceWindow = true;   // raw browser codes on the native-window hosts
  }

  _close(submit) {
    if (this.done) return;
    this.done = true;
    if (submit) {
      // ReturnPlayerInputEvent (:298-304): CloseWindow() FIRST, then
      // the stamp timeClosedInputMessageBox (:301) - the 0.3s
      // pointer-lock refusal PL1 reads - then OnGotUserInput. Escape
      // never reaches here: CancelWindow (DaggerfallPopupWindow.cs
      // :88-92) closes and stamps nothing.
      noteInputBoxClosed();
      this.onSubmit?.(this.value);
    } else {
      this.onCancel?.();
    }
  }

  /** TextBox.cs:352-409's cursor, as SetCursorPosition clamps it. */
  _setCursor(n) { this.cursor = Math.max(0, Math.min(this.value.length, n)); }

  input(code, e = null) {
    const c = typeof code === 'string' && code.startsWith('char:') ? code : normalizeCode(code, e);
    if (SUBMIT.has(c)) { this._close(true); return; }
    if (CANCEL.has(c)) { this._close(false); return; }
    // the cursor keys (TextBox.cs:356-409)
    if (c === 'ArrowLeft') { this._setCursor(this.cursor - 1); return; }
    if (c === 'ArrowRight') { this._setCursor(this.cursor + 1); return; }
    if (c === 'Home') { this._setCursor(0); return; }
    if (c === 'End') { this._setCursor(this.value.length); return; }
    if (c === 'Delete') {   // removes AT the cursor, cursor stays (:368-376)
      if (this.cursor !== this.value.length) this.value = this.value.slice(0, this.cursor) + this.value.slice(this.cursor + 1);
      return;
    }
    if (ERASE.has(c)) {   // removes BEFORE the cursor and steps back (:377-386)
      if (this.cursor !== 0) { this.value = this.value.slice(0, this.cursor - 1) + this.value.slice(this.cursor); this._setCursor(this.cursor - 1); }
      return;
    }
    let ch = typedChar(code, e);
    if (!ch || e?.ctrlKey || e?.metaKey || this.value.length >= this.maxCharacters) return;
    if (this.numeric && !/^[0-9]$/.test(ch)) {
      // TextBox.Numeric (:436-449): a non-digit is refused, EXCEPT that
      // NumericMode.Natural reads the digit off the KEY - Shift+1 types
      // 1, not "!" (the Alpha0..Alpha9 arm at :446-449).
      const d = /^(?:Digit|Numpad)([0-9])$/.exec(typeof code === 'string' ? code : '');
      if (!d) return;
      ch = d[1];
    }
    this.value = this.value.slice(0, this.cursor) + ch + this.value.slice(this.cursor);   // text.Insert(cursorPosition, ...) (:464)
    this._setCursor(this.cursor + 1);
  }

  // Modal, and NOT ClickAnywhereToClose: DaggerfallInputMessageBox
  // never sets it (DaggerfallMessageBox's default is false, :43), so a
  // background click reaches nothing - the raiser's window included.
  click() { return true; }
  clickNative() { return true; }

  /** The field as drawn: the label, the text with the cursor mark at
   *  the cursor - the port's `_` idiom, at the end for an untouched
   *  field and inside the text after Left/Home. */
  entryText() {
    return `${this.label}${this.value.slice(0, this.cursor)}_${this.value.slice(this.cursor)}`;
  }

  draw(renderer, canvas, font, s = null) {
    const entry = this.entryText();
    // The field sizes the box by its MAXIMUM, not its current text
    // (TextBox.CalculateMaximumSize :314-331, the widest glyph times
    // MaxCharacters), so the parchment does not breathe as the player
    // types.
    const sizing = `${this.label}${'M'.repeat(this.maxCharacters)}_`;
    const rows = this.lines.map((l) => (typeof l === 'string' ? l : (l?.text ?? '')));
    if (font && !this.parchment) {
      // useParchmentBackGround = false (:110): no SPOP.RCI frame, the
      // text alone, centred - at the TOP of the screen when
      // showAtTopOfScreen (:150-152), else the middle.
      const m = nativeMetrics(canvas);
      const all = [...rows, entry];
      const y0 = this.atTop ? 4 : Math.max(0, Math.floor((200 - all.length * 10) / 2));
      all.forEach((l, i) => shadowText(renderer, font, l, m, 0, y0 + i * 10, { align: 'center', w: NATIVE_W }));
      return;
    }
    if (messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      const box = layoutMessageBox(font, [...this.lines, { text: entry, center: false }], [], {
        sizingRows: [...this.lines, { text: sizing, center: false }],
      });
      if (drawMessageBox(renderer, m, font, box)) return;
    }
    // Art-less: the same rows on the flat panel, at the host's native
    // scale, the entry dimmed as ActionInputBox's always was.
    const scale = s ?? nativeMetrics(canvas).s;
    const w = Math.max(...rows.map((l) => measureText(font.fnt, l)), measureText(font.fnt, sizing)) * scale + 24 * scale;
    const lineH = 12 * scale;
    const h = (rows.length + 2) * lineH + 20 * scale;
    const x = (canvas.width - w) / 2;
    const y = this.atTop ? 8 * scale : (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    let ty = y + 12 * scale;
    for (const l of rows) { drawText(renderer, font, l, x + 12 * scale, ty, scale, TEXT); ty += lineH; }
    drawText(renderer, font, entry, x + 12 * scale, ty + lineH, scale, DIM);
  }
}
