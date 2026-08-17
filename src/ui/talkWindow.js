// T3b: the talk panel (the U-arc clean text-panel idiom, exactly the
// rest window's shape - the classic TALK01I0.IMG screen art pends the
// shared UI background note). Shows the NPC's greeting (or refusal)
// with the topic machinery pending T3c: Where-is/Tell-me-about lists,
// the tone buttons, and the portrait all land with topics. Esc (or
// Enter) says goodbye.

import { drawText, measureText } from './text.js';

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
 *  input(code) runs the matching action and closes; done after. */
export class ChoiceWindow {
  constructor({ lines, options = [] }) {
    this.lines = lines;
    this.options = options;
    this.done = false;
    this.isChoiceWindow = true;
  }

  input(code) {
    if (!this.options.length && (code === 'back' || code === 'confirm' || code === 'Escape' || code === 'Enter' || code === 'KeyE')) {
      this.done = true;
      return;
    }
    const opt = this.options.find((o) => o.code === code);
    if (opt) { this.done = true; opt.action?.(); }
  }

  draw(renderer, canvas, font, s) {
    const wrapped = this.lines.flatMap((l) => (l === '' ? [''] : wrapText(font.fnt, l, 280)));
    const lines = [...wrapped, '', ...this.options.filter((o) => o.label).map((o) => o.label)];
    if (!this.options.length) lines.push('(continue)');
    const w = Math.max(...lines.map((l) => measureText(font.fnt, l))) * s + 24 * s;
    const lineH = 12 * s;
    const h = lines.length * lineH + 20 * s;
    const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    let ty = y + 12 * s;
    for (const l of lines) {
      drawText(renderer, font, l, x + 12 * s, ty, s, this.options.some((o) => o.label === l) || l === '(continue)' ? DIM : TEXT);
      ty += lineH;
    }
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
