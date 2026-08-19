// HUD popup text (UI arc, U5). PopupText verbatim (PopupText.cs, MIT
// Daggerfall Workshop): rows lay out from the TOP of the 320x200
// NativePanel - DaggerfallHUD.cs:172-173 gives popupText
// NativePanel.Size and adds it there - starting at y = 4 and striding
// TextHeight + textSpacing (1), each row centred by
// HorizontalAlignment.Center over the panel's 320 px.
//
// The queue is DFU's single-timer model, not a per-line countdown:
// AddText arms `timer` with popDelay (1 s), Update decrements it -
// accelerated by 1 + rubberbandFactor * (rows - maxRows) once more
// than maxRows (7) are queued - and every crossing of -popDelay pops
// the FRONT row and adds nextPopDelay back. While timer is negative
// the whole block slides up by (TextHeight + textSpacing) *
// timer / popDelay, which is the classic scroll-out.
//
// Phrasings follow the classic strings ("Your %s skill has
// improved."); the TEXT.RSC database itself is FLAGGED - these
// literals swap for the real records when that reader lands.

import { drawText, measureText } from './text.js';
import { nativeMetrics, NATIVE_W, DEFAULT_TEXT_COLOR } from './nativePanel.js';

export const HUD_TEXT_POP_DELAY = 1.0;      // PopupText.popDelay
export const HUD_TEXT_MAX_ROWS = 7;         // PopupText.maxRows
export const HUD_TEXT_SPACING = 1;          // PopupText.textSpacing
export const HUD_TEXT_RUBBERBAND = 0.8;     // PopupText.rubberbandFactor
export const HUD_TEXT_TOP = 4;              // PopupText.Draw's `float y = 4`

export class HudText {
  constructor() {
    this.lines = [];
    this.timer = 0;
    this.nextPopDelay = HUD_TEXT_POP_DELAY;
  }

  /** PopupText.AddText verbatim - the row is queued unconditionally;
   *  only the timer retires rows. */
  add(text, delayInSeconds = HUD_TEXT_POP_DELAY) {
    if (this.lines.length === 0) this.timer = delayInSeconds;
    else if (this.timer >= 0) this.timer = Math.max(this.timer, delayInSeconds);
    else this.nextPopDelay = Math.max(this.nextPopDelay, delayInSeconds);
    this.lines.push({ text });
  }

  /** PopupText.Update verbatim. */
  tick(dt) {
    if (!this.lines.length) return;
    const rowsLate = this.lines.length - HUD_TEXT_MAX_ROWS;
    this.timer -= rowsLate > 0 ? dt * (1 + HUD_TEXT_RUBBERBAND * rowsLate) : dt;
    while (this.lines.length && this.timer < -HUD_TEXT_POP_DELAY) {
      this.timer += this.nextPopDelay;
      this.lines.shift();
      this.nextPopDelay = HUD_TEXT_POP_DELAY;
    }
  }

  /** PopupText.Draw verbatim, in NativePanel coordinates. */
  draw(renderer, canvas, font) {
    if (!font || !this.lines.length) return;
    const m = nativeMetrics(canvas);
    const rowH = font.fnt.fixedHeight;   // TextLabel.TextHeight = font.GlyphHeight
    let y = HUD_TEXT_TOP;
    if (this.timer < 0) y += (rowH + HUD_TEXT_SPACING) * this.timer / HUD_TEXT_POP_DELAY;
    const maxCount = Math.min(this.lines.length, HUD_TEXT_MAX_ROWS);
    let count = 0;
    for (const l of this.lines) {
      const x = (NATIVE_W - measureText(font.fnt, l.text)) / 2;
      drawText(renderer, font, l.text, m.ox + x * m.s, m.oy + y * m.s, m.s, DEFAULT_TEXT_COLOR);
      y += rowH + HUD_TEXT_SPACING;
      if (++count > maxCount) break;
    }
  }
}
