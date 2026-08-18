// Action text boxes (U6). Verbatim data path from DaggerfallAction's
// text delegates: ShowText (11) pops TEXT.RSC record Index + 8600 in
// a click-anywhere-to-close box; ShowTextWithInput (12) pops record
// Index + 5400 with a 20-char ' > ' input line (DaggerfallInputMessageBox)
// and hands the entry back to the action system's answer gate.
// Presentation: U11 gave the port DaggerfallMessageBox's parchment
// frame, so these draw as the REAL classic popup - SPOP.RCI's
// nine-slice with the verbatim sizing law. The flat panel below is
// the art-less fallback now, not the plan. The overlay seam holds the
// world while a box is open.

import { drawText, measureText } from './text.js';
import { nativeMetrics } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxArtLoaded } from './messageBox.js';   // U11

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];
const DIM = [0.55, 0.52, 0.45, 1];

function drawPanel(renderer, canvas, font, s, lines, extra = null) {
  const w = Math.max(...lines.map((l) => measureText(font.fnt, l)), extra ? measureText(font.fnt, extra) : 0) * s + 24 * s;
  const lineH = 12 * s;
  const h = (lines.length + (extra ? 2 : 0)) * lineH + 20 * s;
  const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
  renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
  let ty = y + 12 * s;
  for (const l of lines) {
    drawText(renderer, font, l, x + 12 * s, ty, s, TEXT);
    ty += lineH;
  }
  return { x, y: ty + lineH, s };
}

/** ShowText: ClickAnywhereToClose - any key closes. */
export class ActionTextBox {
  constructor(lines) {
    this.lines = lines;
    this.done = false;
  }

  input() { this.done = true; }

  draw(renderer, canvas, font, s) {
    if (messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      // ClickAnywhereToClose has NO buttons (DaggerfallMessageBox
      // .ClickAnywhereToClose) - the box is text only.
      const box = layoutMessageBox(font, this.lines);
      if (drawMessageBox(renderer, m, font, box, this.lines)) return;
    }
    drawPanel(renderer, canvas, font, s, this.lines);
  }
}

/** ShowTextWithInput: the 20-char ' > ' entry; Enter submits to the
 *  action system's answer gate (a match fires the chain), Escape
 *  closes without answering. */
export class ActionInputBox {
  constructor(lines, onInput) {
    this.lines = lines;
    this.onInput = onInput;
    this.value = '';
    this.done = false;
  }

  input(action) {
    if (action === 'confirm') {
      this.done = true;
      this.onInput?.(this.value);
      return;
    }
    if (action === 'back') { this.done = true; return; }
    if (action === 'backspace') { this.value = this.value.slice(0, -1); return; }
    if (action.startsWith('char:') && this.value.length < 20) this.value += action.slice(5);   // maxCharacters 20
  }

  draw(renderer, canvas, font, s) {
    const entry = ` > ${this.value}_`;
    if (messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      // DaggerfallInputMessageBox puts the entry line UNDER the
      // prompt inside the same parchment box.
      const rows = [...this.lines, entry];
      const box = layoutMessageBox(font, rows);
      if (drawMessageBox(renderer, m, font, box, rows)) return;
    }
    const at = drawPanel(renderer, canvas, font, s, this.lines, entry);
    drawText(renderer, font, entry, at.x + 12 * s, at.y - 12 * s, s, DIM);
  }
}
