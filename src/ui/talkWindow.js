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
