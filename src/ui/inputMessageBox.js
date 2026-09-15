// CM3 - THE SHARED DAGGERFALL INPUT MESSAGE BOX.
//
// DaggerfallInputMessageBox is the small parchment prompt DFU pushes
// over an existing window whenever it needs one line of text or a
// number. The port had the parchment frame already, but each caller
// still reimplemented the field in-place. This class gives those
// callers one modal owner: fixed-width input, the 31-character default,
// numeric filtering when requested, Return submit, Escape cancel, and
// the pointer-lock close stamp.

import { nativeMetrics } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxArtLoaded } from './messageBox.js';
import { drawText, measureText } from './text.js';
import { typedChar } from './input.js';
import { normalizeCode } from '../systems/dialogShortcuts.js';
import { noteInputBoxClosed } from '../player/pointerLock.js';

export const DEFAULT_INPUT_MAX = 31;   // DaggerfallInputMessageBox ctor default / TextBox default

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];

/**
 * label         TextBoxLabel.Text, normally already including spacing
 * value         TextBox.Text at Show()
 * maxCharacters TextBox.MaxCharacters (default 31)
 * numeric       TextBox.Numeric
 * onSubmit(v)   OnGotUserInput; Return closes BEFORE this callback
 * onCancel()    base popup Escape close; no OnGotUserInput
 */
export class InputMessageBoxWindow {
  constructor({
    label = '', value = '', maxCharacters = DEFAULT_INPUT_MAX,
    numeric = false, onSubmit = null, onCancel = null,
  } = {}) {
    this.label = String(label ?? '');
    this.value = String(value ?? '').slice(0, Math.max(0, maxCharacters));
    this.maxCharacters = Math.max(0, maxCharacters | 0);
    this.numeric = !!numeric;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
    this.done = false;
    this.isChoiceWindow = true;   // raw browser codes on the native-window hosts
  }

  _close(submit) {
    if (this.done) return;
    this.done = true;
    // DaggerfallInputMessageBox.ReturnPlayerInputEvent closes first and
    // stamps timeClosedInputMessageBox before invoking OnGotUserInput.
    noteInputBoxClosed();
    if (submit) this.onSubmit?.(this.value);
    else this.onCancel?.();
  }

  input(code, e = null) {
    const c = normalizeCode(code, e);
    if (c === 'Enter' || c === 'NumpadEnter') { this._close(true); return; }
    if (c === 'Escape') { this._close(false); return; }
    if (c === 'Backspace') { this.value = this.value.slice(0, -1); return; }
    const ch = typedChar(code, e);
    if (!ch || this.value.length >= this.maxCharacters) return;
    if (this.numeric && !/^[0-9]$/.test(ch)) return;
    this.value += ch;
  }

  // A DaggerfallInputMessageBox is modal, but unlike a click-anywhere
  // DaggerfallMessageBox its background click does not dismiss it.
  click() { return true; }
  clickNative() { return true; }

  draw(renderer, canvas, font, s = 1) {
    const entry = `${this.label}${this.value}_`;
    const sizing = `${this.label}${'M'.repeat(this.maxCharacters)}_`;
    if (messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      const box = layoutMessageBox(font, [{ text: entry, center: false }], [], {
        sizingRows: [{ text: sizing, center: false }],
      });
      if (drawMessageBox(renderer, m, font, box)) return;
    }

    // Art-less fallback: same fixed-width field, plain panel.
    const scale = s || 1;
    const w = Math.max(44 * scale, measureText(font.fnt, sizing) * scale + 24 * scale);
    const h = 36 * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    drawText(renderer, font, entry, x + 12 * scale, y + 14 * scale, scale, TEXT);
  }
}
