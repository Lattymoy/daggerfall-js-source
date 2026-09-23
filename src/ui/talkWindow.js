// T3b: the talk panel (the U-arc clean text-panel idiom, exactly the
// rest window's shape - the classic TALK01I0.IMG screen art pends the
// shared UI background note). Shows the NPC's greeting (or refusal)
// with the topic machinery pending T3c: Where-is/Tell-me-about lists,
// the tone buttons, and the portrait all land with topics. Esc (or
// Enter) says goodbye.

import { drawText, measureText } from './text.js';
import { nativeMetrics } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxArtLoaded } from './messageBox.js';
import { noticeDraw, noticeRelease } from './enhancedNotice.js';   // ENH-NOTICE1: the no-options box on the enhanced skin

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];
const DIM = [0.55, 0.52, 0.45, 1];

/** Greedy word-wrap against the classic font metrics. */
export function wrapText(fnt, text, maxWidth, measure = measureText) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const probe = line.length ? `${line} ${w}` : w;
    if (line.length && measure(fnt, probe) > maxWidth) { lines.push(line); line = w; }
    else line = probe;
  }
  if (line.length) lines.push(line);
  return lines;
}

/** G2: a text panel with keyed choices (the surrender prompt and the
 *  court sequence ride it). options = [{ code, label, action }];
 *  input(code) runs the matching action and closes; done after.
 *
 * CM1: the NO-OPTIONS shape is not a menu at all. Every production
 * caller of that shape is a DaggerfallMessageBox-style notice: house
 * greetings, shop-quality popups, court outcomes, holiday/quest text,
 * and other one-shot messages. Draw those through the one native
 * SPOP.RCI parchment implementation instead of the old interim flat
 * panel. Keyed menus keep the old panel until their own native window
 * replaces them. */
export class ChoiceWindow {
  constructor({ lines, options = [] }) {
    this.lines = lines;
    this.options = options;
    this.done = false;
    this.isChoiceWindow = true;
    this._hitRows = null;   // set by draw(): this session's option rows, in real pixel space
    this._hitBox = null;
    this._m = null;         // this session's nativeMetrics, so click() can undo pointToNative
  }

  input(code) {
    if (!this.options.length && (code === 'back' || code === 'confirm' || code === 'Escape' || code === 'Enter' || code === 'KeyE')) {
      this.done = true;
      noticeRelease(this);   // ENH-NOTICE1: the panel leaves with the box
      return;
    }
    const opt = this.options.find((o) => o.code === code);
    if (opt) { this.done = true; opt.action?.(); }
  }

  /** AUDIT (mouse): the box was keyboard-only - a mouse-driven player
   *  read "Y - yes / N - no" and had nothing to click, the same fault
   *  ActionTextBox's own doc comment records for ClickAnywhereToClose.
   *  `vx,vy` arrive in the host's NATIVE 320x200 space (pointToNative,
   *  nativePanel.js) - this box draws in real canvas pixels centred on
   *  canvas.width/height, a DIFFERENT space, so the point is converted
   *  back through THIS box's own last draw() metrics rather than the
   *  box being moved into native space (which would be a visual change
   *  to a box ~50 call sites already draw and centre correctly).
   *
   *  CM1: a NO-OPTIONS box is DaggerfallMessageBox.ClickAnywhereToClose
   *  - any click closes it, wherever it lands, and it draws as the
   *  parchment (below), whose rows the hit map above never sees. The
   *  keyed menus keep the row hit. */
  click(vx, vy) {
    if (!this.options.length) { this.input('confirm'); return true; }
    if (this._m && this._hitBox) {
      const px = vx * this._m.s + this._m.ox;
      const py = vy * this._m.s + this._m.oy;
      if (px >= this._hitBox.x && px < this._hitBox.x + this._hitBox.w) {
        const row = this._hitRows.find((r) => py >= r.y0 && py < r.y1);
        if (row) { this.input(row.code ?? 'confirm'); return true; }
      }
    }
    return true;   // a click that missed every row is swallowed, not answered
  }

  draw(renderer, canvas, font, s) {
    // ENH-NOTICE1: the no-options box IS DaggerfallMessageBox
    // .ClickAnywhereToClose (CM1), so on the enhanced skin it is the
    // slide-in panel; a keyed menu is a decision and keeps its rows
    // on the canvas on both skins.
    if (!this.options.length && noticeDraw(this, this.lines)) return;
    if (!this.options.length && messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      const box = layoutMessageBox(font, this.lines);
      if (drawMessageBox(renderer, m, font, box)) return;
    }

    const wrapped = this.lines.flatMap((l) => (l === '' ? [''] : wrapText(font.fnt, l, 280)));
    const optLines = this.options.filter((o) => o.label);
    const bodyCount = wrapped.length + 1;   // +1 for the blank spacer row below the text
    const lines = [...wrapped, '', ...optLines.map((o) => o.label)];
    if (!this.options.length) lines.push('(continue)');
    const w = Math.max(...lines.map((l) => measureText(font.fnt, l))) * s + 24 * s;
    const lineH = 12 * s;
    const h = lines.length * lineH + 20 * s;
    const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    this._m = nativeMetrics(canvas);
    this._hitBox = { x, y, w, h };
    this._hitRows = [];
    let ty = y + 12 * s;
    lines.forEach((l, i) => {
      drawText(renderer, font, l, x + 12 * s, ty, s, this.options.some((o) => o.label === l) || l === '(continue)' ? DIM : TEXT);
      // Every row from bodyCount on is a clickable one: a real option
      // (its own code) or, when there are none at all, the single
      // '(continue)' row (null - click() reads that as 'confirm').
      if (i >= bodyCount) this._hitRows.push({ code: optLines[i - bodyCount]?.code ?? null, y0: ty - lineH, y1: ty });
      ty += lineH;
    });
  }
}

export class TalkWindow {
  /** @param opts { text, refused } from startMobileTalk */
  constructor({ text, refused = false }) {
    this.text = text;
    this.refused = refused;
    this.done = false;
    this.isTalkWindow = true;
  }

  input(action) {
    if (action === 'back' || action === 'confirm') this.done = true;
  }

  /** Same fault as ChoiceWindow's, simpler fix: one message, no
   *  branching, so any click just says goodbye - "click anywhere to
   *  close", ActionTextBox's own rule. */
  click() { this.input('confirm'); return true; }

  draw(renderer, canvas, font, s) {
    const wrapped = wrapText(font.fnt, this.text, 280);
    const lines = [...wrapped, '', 'Esc - goodbye'];
    const w = Math.max(...lines.map((l) => measureText(font.fnt, l))) * s + 24 * s;
    const lineH = 12 * s;
    const h = lines.length * lineH + 20 * s;
    const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    let ty = y + 12 * s;
    for (const l of lines) {
      drawText(renderer, font, l, x + 12 * s, ty, s, l.startsWith('Esc') ? DIM : TEXT);
      ty += lineH;
    }
  }
}