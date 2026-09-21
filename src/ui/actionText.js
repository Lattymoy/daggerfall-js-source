// Action text boxes (U6). Verbatim data path from DaggerfallAction's
// text delegates: ShowText (11) pops TEXT.RSC record Index + 8600 in
// a click-anywhere-to-close box; ShowTextWithInput (12) pops record
// Index + 5400 with a 20-char ' > ' input line (DaggerfallInputMessageBox)
// and hands the entry back to the action system's answer gate.
// Presentation: U11 gave the port DaggerfallMessageBox's parchment
// frame, so ShowText draws as the REAL classic popup - SPOP.RCI's
// nine-slice with the verbatim sizing law; the flat panel below is
// its art-less fallback. ShowTextWithInput is the exception, and
// AUDIT-CM (2026-09-21) found the first cut drawing it wrong: DFU
// builds that box with useParchmentBackGround = false and
// showAtTopOfScreen = true (DaggerfallAction.cs:566), so it is bare
// text at the TOP of the screen, no frame. The overlay seam holds the
// world while a box is open.

import { drawText, measureText } from './text.js';
import { nativeMetrics } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxArtLoaded } from './messageBox.js';   // U11
import { InputMessageBoxWindow } from './inputMessageBox.js';   // CM3: the one DaggerfallInputMessageBox
import { noticeDraw, noticeRelease } from './enhancedNotice.js';   // ENH-NOTICE1: the enhanced skin's panel

/** DaggerfallInputMessageBox maxCharacters. */
export const MAX_INPUT = 20;

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];

/** The art-less fallback draws plain strings, so a row record - a
 *  { text } or AUDIT 64 F28's tab-stopped { cells } - flattens to one.
 *  The column stops are lost with the parchment; the words are not. */
const flatten = (l) => {
  if (typeof l === 'string') return l;
  if (Array.isArray(l?.cells)) return l.cells.map((c) => c.text ?? '').join('  ');
  return l?.text ?? '';
};

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
  /** AUDIT 64 F28: `highlightColor` is DaggerfallMessageBox
   *  .SetHighlightColor (:455-458), the one thing a caller overrides
   *  before Show() - the banking status box sets
   *  DaggerfallUnityStatDrainedTextColor so a DEFAULTED region reads as
   *  a warning (DaggerfallBankingWindow.cs:523). Unset keeps
   *  MultiFormatTextLabel's own default. */
  /** AUDIT 64 F35 (review round): DaggerfallPopupWindow.previousWindow
   *  (DaggerfallPopupWindow.cs:24, :56-59). This class is the port's
   *  DaggerfallMessageBox and nearly every one of its ~35 sites is a
   *  `DaggerfallUI.MessageBox(...)` in the reference - a box built on
   *  `Instance.uiManager.TopWindow` (DaggerfallUI.cs:1330/:1339/:1348/
   *  :1357), which during play is `dfHUD` (:407-408). So the default
   *  is SET, and `Draw` (:76-84) paints the HUD under the box.
   *  DaggerfallAction's own ShowText box is the exception and passes
   *  `null` (Internal/DaggerfallAction.cs:536); it says so at its call
   *  site. */
  constructor(lines, { highlightColor = undefined, previousWindow = true } = {}) {
    this.lines = lines;
    this.highlightColor = highlightColor;
    this.done = false;
    this._next = [];
    this.previousWindow = previousWindow;
  }

  /** ST1: DaggerfallMessageBox.AddNextMessageBox - dismissing this
   *  box shows the next box's rows in its place, and only the LAST
   *  dismissal closes. DisplayStatusInfo chains the record-22 status
   *  text into the health box this way (DaggerfallUI.cs:1623-1626).
   *  Answers `this` so a chain reads as one expression. */
  addNext(lines) { this._next.push(lines); return this; }

  input() {
    if (this._next.length) { this.lines = this._next.shift(); return; }
    this.done = true;
    // ENH-NOTICE1: the panel leaves with the box. A no-op on the
    // classic skin (no panel was ever keyed to this box).
    noticeRelease(this);
  }

  /** ClickAnywhereToClose is CLICK anywhere first (DaggerfallMessageBox
   *  .ClickAnywhereToClose - the parent panel's OnMouseClick dismisses
   *  it). The box was key-only, which the char sheet's level-up
   *  refusal made visible: a mouse-driven player clicked a box that
   *  would not go away. Same dismissal as a key, chain and all. */
  click() { this.input(); return true; }

  draw(renderer, canvas, font, s) {
    // ENH-NOTICE1: on the enhanced skin the rows go to the slide-in
    // panel (ui/enhancedNotice.js) and nothing is painted here. The
    // box is still the box - modal, chained, click-anywhere.
    if (noticeDraw(this, this.lines)) return;
    if (messageBoxArtLoaded() && font) {
      const m = nativeMetrics(canvas);
      // ClickAnywhereToClose has NO buttons (DaggerfallMessageBox
      // .ClickAnywhereToClose) - the box is text only.
      const box = layoutMessageBox(font, this.lines);
      const opts = this.highlightColor ? { highlightColor: this.highlightColor } : {};
      if (drawMessageBox(renderer, m, font, box, opts)) return;
    }
    drawPanel(renderer, canvas, font, s, this.lines.map(flatten));
  }
}

/** ShowTextWithInput: the 20-char ' > ' entry; Enter submits to the
 *  action system's answer gate (a match fires the chain), Escape
 *  closes without answering. CM3: the field IS the one
 *  DaggerfallInputMessageBox (ui/inputMessageBox.js) - this is the
 *  action system's construction of it, record lines above, ' > ' for
 *  the label, MaxCharacters 20 - and nothing of the field's law lives
 *  here any more. */
export class ActionInputBox extends InputMessageBoxWindow {
  constructor(lines, onInput) {
    // `new DaggerfallInputMessageBox(UIManager, textID, 20, " > ", false, true, null)`
    // (DaggerfallAction.cs:566): twenty characters, " > " for the
    // label, NO parchment, at the TOP of the screen.
    super({ lines, label: ' > ', maxCharacters: MAX_INPUT, parchment: false, atTop: true, onSubmit: onInput });
    this.onInput = onInput;
    /** AUDIT 64 F35 (review round): the ONLY construction of this box
     *  in the reference passes a null previous - `new
     *  DaggerfallInputMessageBox(DaggerfallUI.UIManager, textID, 20,
     *  " > ", false, true, null)` (Internal/DaggerfallAction.cs:566) -
     *  so nothing is painted beneath it. Every other
     *  DaggerfallInputMessageBox in DFU is raised from inside another
     *  window and passes `this`, which roots at that window, not at
     *  the HUD. */
    this.previousWindow = null;
  }
}
