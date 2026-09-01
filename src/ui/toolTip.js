// U37: THE TOOLTIP - ToolTip.cs (MIT, Daggerfall Workshop) on the
// native idiom, and with it THE HOVER SEAM the port has been missing
// since U25 flagged it on the inventory's info panel.
//
// DFU's tooltip is a shared BaseScreenComponent every window's buttons
// point at: a component sets ToolTipText, the UI update draws the box
// at the cursor when the pointer has rested long enough. The port has
// no retained widget tree, so the shape here is the immediate-mode
// equivalent: a window holds one ToolTip, tells it the hovered text
// each frame (`show(text)` / `hide()`), and draws it LAST so it lands
// over everything else - DFU's own draw order, where the tooltip is
// the final component in the canvas.
//
// The law, line for line:
// - defaultMarginSize 2 on all four sides (:30, :108).
// - the box is (widestRow + left + right) x
//   (glyphHeight * rows + top + bottom - 1) (:158-160). The -1 is
//   DFU's, and it is not a rounding artefact: it tightens every
//   tooltip by one pixel regardless of row count.
// - the position is the cursor plus MouseOffset (:163), whose default
//   is (0, 4) (:33) - DFU recomputes it from the OS cursor height at
//   runtime (:128-135), which a browser page cannot ask for, so the
//   declared default stands (Ledger A).
// - EDGE FLIPPING (:166-177) is a SHIFT, not a flip: a box past the
//   right or bottom edge is pushed back by exactly the overflow, so
//   it ends flush against the edge rather than jumping to the other
//   side of the cursor.
// - rows split on \r, with the literal two-character "\\r" collapsed
//   first (:243-245) - text read from a plain-text file carries the
//   escape, not the control character.
// - the colours are DaggerfallUI's own (:68-69), and the port reads
//   them from the four GUI/ToolTip* settings, which ship those exact
//   values and were stored-tier with no consumer until now.
import { drawRect, NATIVE_W, NATIVE_H } from './nativePanel.js';   // ONE home for the virtual canvas size
import { drawText, measureText } from './text.js';
import { getBool, getFloat, getString } from '../systems/settings.js';

/** defaultMarginSize (:30). */
export const TOOLTIP_MARGIN = 2;
/** MouseOffset's default (:33). */
export const TOOLTIP_MOUSE_OFFSET = Object.freeze([0, 4]);
/** "RRGGBBAA" -> [r,g,b,a] in 0..1. The alpha is load-bearing: the
 *  background ships D2 (210/255), a deliberate translucency. */
export function parseHexColor(hex, fallback) {
  if (!/^[0-9A-Fa-f]{8}$/.test(String(hex ?? ''))) return fallback;
  const n = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), n(6)];
}

export const DEFAULT_TOOLTIP_TEXT_BG = Object.freeze([64 / 255, 64 / 255, 64 / 255, 210 / 255]);
export const DEFAULT_TOOLTIP_TEXT_FG = Object.freeze([230 / 255, 230 / 255, 200 / 255, 1]);

/** UpdateTextRows (:238-256): the escaped-\r collapse, then the split. */
export const toolTipRows = (text) => String(text).replace(/\\r/g, '\r').split('\r');

/** Draw's sizing (:158-160) - the -1 is DFU's own. */
export function toolTipSize(rows, widest, glyphHeight) {
  return [
    widest + TOOLTIP_MARGIN * 2,
    glyphHeight * rows.length + TOOLTIP_MARGIN * 2 - 1,
  ];
}

/** Draw's placement + the two edge shifts (:163-177). Native coords. */
export function toolTipPosition(mouseX, mouseY, w, h) {
  let x = mouseX + TOOLTIP_MOUSE_OFFSET[0];
  let y = mouseY + TOOLTIP_MOUSE_OFFSET[1];
  if (x + w > NATIVE_W) x -= (x + w) - NATIVE_W;
  if (y + h > NATIVE_H) y -= (y + h) - NATIVE_H;
  return [x, y];
}

/** GUI/EnableToolTips - the master switch (stored-tier until now). */
export const toolTipsEnabled = () => getBool('GUI', 'EnableToolTips');
/** GUI/ToolTipDelayInSeconds - how long the pointer must REST. */
export const toolTipDelay = () => getFloat('GUI', 'ToolTipDelayInSeconds', 0, 10);

/**
 * One tooltip, owned by one window. The window calls `show(text, x, y)`
 * every frame the pointer rests on something with a tip and `hide()`
 * otherwise; `draw` renders it last.
 *
 * THE DELAY IS A REST, NOT A DWELL: moving the pointer to a DIFFERENT
 * tip restarts the clock (DFU's tooltip belongs to the component under
 * the cursor, so crossing to another component starts its timer from
 * zero), but re-entering the same tip after a twitch does not.
 */
export class ToolTip {
  constructor() {
    this.text = null;
    this._pending = null;
    this._elapsed = 0;
    this.x = 0;
    this.y = 0;
  }

  /** Called each frame with the hovered text, or via hide(). */
  show(text, vx, vy) {
    if (!text) { this.hide(); return; }
    if (text !== this._pending) { this._pending = text; this._elapsed = 0; }
    this.x = vx;
    this.y = vy;
  }

  hide() { this._pending = null; this._elapsed = 0; this.text = null; }

  /** The rest clock. dt in seconds. */
  update(dt) {
    if (!this._pending) { this.text = null; return; }
    this._elapsed += dt;
    this.text = this._elapsed >= toolTipDelay() ? this._pending : null;
  }

  /** Drawn LAST by its window (DFU's final-component order). */
  draw(renderer, m, font) {
    if (!this.text) return;
    drawToolTipBox(renderer, m, font, this.text, this.x, this.y);
  }
}

/**
 * ToolTip.Draw's BODY, with the rest clock left to the caller (:158-217).
 * The ToolTip class above owns DFU's per-component clock; ROAD-C c2/S5's
 * automap window owns a DIFFERENT one - ui/automapChrome.js's, which is
 * the only clock that knows about SuppressToolTip and about the automap's
 * own ToolTipDelay of 1 second (DaggerfallAutomapWindow.cs:22, :492-502).
 * Both draw the SAME box, so the box lives here once. EnableToolTips is
 * checked here because it is the master switch either way.
 */
export function drawToolTipBox(renderer, m, font, text, vx, vy) {
  if (!text || !toolTipsEnabled()) return;
  const rows = toolTipRows(text);
  // DaggerfallFont.GlyphHeight - the port's own fixedHeight, the
  // same reader messageBox's rowH uses.
  const glyph = font?.fnt?.fixedHeight ?? 6;
  let widest = 0;
  for (const r of rows) widest = Math.max(widest, measureText(font.fnt, r));
  const [w, h] = toolTipSize(rows, widest, glyph);
  const [x, y] = toolTipPosition(vx, vy, w, h);
  const bg = parseHexColor(getString('GUI', 'ToolTipBackgroundColor'), DEFAULT_TOOLTIP_TEXT_BG);
  const fg = parseHexColor(getString('GUI', 'ToolTipTextColor'), DEFAULT_TOOLTIP_TEXT_FG);
  drawRect(renderer, m, x, y, w, h, bg);
  // NO SHADOW: DFU draws the tooltip with a bare font.DrawText
  // (:213-217), unlike every labelled button in the UI.
  rows.forEach((r, i) => drawText(renderer, font, r,
    m.ox + (x + TOOLTIP_MARGIN) * m.s,
    m.oy + (y + TOOLTIP_MARGIN + i * glyph) * m.s, m.s, fg));
}
