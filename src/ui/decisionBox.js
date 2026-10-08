// @ts-check
// REST-WARN2 (2026-10-08, the owner: "those are not enhanced plus ui button and window"): A YES / NO DECISION AS DFU'S
// MESSAGE BOX - its rows and its YesNo buttons laid out by ui/messageBox.js and drawn through drawMessageBox, which
// under the enhanced skin hands a box with buttons to the Plus decision dialog (ui/enhancedDialog.js, DLG1: the stone-
// and-brass kit the guild, the bank and the travel map's own warnings wear) and on the classic skin draws DFU's
// parchment. The window answers the press itself (messageBoxHit), and Y / N as DFU's box does (Return is No).
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { nativeMetrics, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';

export class DecisionBoxWindow {
  /** @param {{ rows: string[], onYes?: (() => void)|null, onNo?: (() => void)|null }} o */
  /** GIANT-FALL: `ok` - a notice with one OK button (any of Return, Space, Escape, Y answers it) instead of Yes / No. */
  constructor({ rows, onYes = null, onNo = null, ok = false }) {
    this.ok = !!ok;
    this.rows = (rows ?? []).map((text) => ({ text: String(text), center: true }));
    this.onYes = onYes;
    this.onNo = onNo;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    this._box = null;
  }
  answer(yes) {
    if (this.done) return;
    this.done = true;
    (yes ? this.onYes : this.onNo)?.();
  }
  input(code) {
    if (this.ok) { if (['Enter', 'NumpadEnter', 'Space', 'Escape', 'KeyY'].includes(code)) this.answer(true); return; }
    if (code === 'KeyY') this.answer(true);
    else if (code === 'KeyN' || code === 'Enter' || code === 'NumpadEnter') this.answer(false);
  }
  click(vx, vy) {
    const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
    if (this.ok) { if (hit === MB_BUTTONS.OK) this.answer(true); return true; }
    if (hit === MB_BUTTONS.Yes) this.answer(true);
    else if (hit === MB_BUTTONS.No) this.answer(false);
    return true;
  }
  draw(renderer, canvas, font) {
    if (this.done) return;
    const m = nativeMetrics(canvas);
    drawScreenDimBackdrop(renderer, canvas);
    this._box = layoutMessageBox(font, this.rows, this.ok ? [MB_BUTTONS.OK] : [MB_BUTTONS.Yes, MB_BUTTONS.No]);
    if (!drawMessageBox(renderer, m, font, this._box)) {
      // no art and no enhanced dialog: the words and the keys, plainly
      this.rows.forEach((r, i) => shadowText(renderer, font, r.text, m, 20, 20 + i * (this._box.rowH ?? 8)));
      shadowText(renderer, font, this.ok ? 'Return - OK' : 'Y - yes   N - no', m, 20, 24 + this.rows.length * (this._box.rowH ?? 8));
    }
  }
}
