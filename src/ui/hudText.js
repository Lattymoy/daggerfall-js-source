// HUD popup text (UI arc, U5). The classic bottom-center message
// queue (DaggerfallUI.AddHUDText shape): lines stack newest-last,
// each lives ~2 seconds, drawn just above the vitals in classic
// text. Phrasings follow the classic strings ("Your %s skill has
// improved."); the TEXT.RSC database itself is FLAGGED - these
// literals swap for the real records when that reader lands.

import { drawText, measureText } from './text.js';

export const HUD_TEXT_SECONDS = 2.0;   // per-line life
export const HUD_TEXT_MAX = 4;         // visible lines

export class HudText {
  constructor() { this.lines = []; }
  add(text) {
    this.lines.push({ text, t: HUD_TEXT_SECONDS });
    if (this.lines.length > HUD_TEXT_MAX) this.lines.shift();
  }
  tick(dt) {
    for (const l of this.lines) l.t -= dt;
    this.lines = this.lines.filter((l) => l.t > 0);
  }
  draw(renderer, canvas, font, s) {
    if (!font || !this.lines.length) return;
    const baseY = canvas.height - (34 + this.lines.length * 10) * s;   // above the vitals strip
    this.lines.forEach((l, i) => {
      const a = Math.min(1, l.t / 0.4);                                // fade the last 0.4s
      drawText(renderer, font, l.text,
        (canvas.width - measureText(font.fnt, l.text) * s) / 2,
        baseY + i * 10 * s, s, [0.92, 0.9, 0.8, a]);
    });
  }
}
