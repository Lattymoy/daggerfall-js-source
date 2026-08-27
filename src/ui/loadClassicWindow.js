// SAV3: THE CLASSIC LOAD WINDOW - DaggerfallLoadClassicGameWindow.cs,
// verbatim geometry (MIT, Daggerfall Workshop). LOAD00I0.IMG is the
// whole background; the six save slots are invisible click rects laid
// over its painted frames - an 80x50 screenshot button and a 158x9
// name button each - with a 1px outline in the default text colour
// around the selected frame. Load Game (126,5 68x11) and Exit
// (133,150 56x19) are painted into the art the same way (:42-70,
// :157, :162). A slot that fails LazyOpenSave is logged and simply
// not mounted (:117-121); the first valid slot starts selected
// (:142-152); a double click selects AND loads (:225-230).
//
// The slot screenshots are the saves' own IMAGE.RAW over ART_PAL.COL
// (SaveImage's charter), uploaded per slot by the flow that owns the
// SaveGames - this window draws what it is handed and answers clicks,
// the StartWindow shape.
//
// Departure (structure only): DFU pushes the window from the DFU
// save window's Classic button; the port has no multi-slot save
// window yet (Ledger C), so the flow mounts this from the start
// menu's Load arm instead - see scenes/menu.js.

import { nativeMetrics, drawImg, drawRect, shadowText, pointToNative, DEFAULT_TEXT_COLOR } from './nativePanel.js';

export const LOAD_CLASSIC_IMG = 'LOAD00I0.IMG';

/** saveImageButtonDims - the six 80x50 screenshot rects. */
export const SAVE_IMAGE_RECTS = Object.freeze([
  Object.freeze([40, 4, 80, 50]),
  Object.freeze([40, 69, 80, 50]),
  Object.freeze([40, 134, 80, 50]),
  Object.freeze([200, 4, 80, 50]),
  Object.freeze([200, 69, 80, 50]),
  Object.freeze([200, 134, 80, 50]),
]);

/** saveTextButtonDims - the six 158x9 save-name rects. */
export const SAVE_TEXT_RECTS = Object.freeze([
  Object.freeze([1, 56, 158, 9]),
  Object.freeze([1, 121, 158, 9]),
  Object.freeze([1, 186, 158, 9]),
  Object.freeze([162, 56, 158, 9]),
  Object.freeze([162, 121, 158, 9]),
  Object.freeze([162, 186, 158, 9]),
]);

/** outlineRects - one pixel around each screenshot frame. */
export const OUTLINE_RECTS = Object.freeze([
  Object.freeze([39, 3, 81, 51]),
  Object.freeze([39, 68, 81, 51]),
  Object.freeze([39, 133, 81, 51]),
  Object.freeze([199, 3, 81, 51]),
  Object.freeze([199, 68, 81, 51]),
  Object.freeze([199, 133, 81, 51]),
]);

/** The Load Game and Exit buttons (:157, :162). */
export const LOAD_BUTTON_RECT = Object.freeze([126, 5, 68, 11]);
export const EXIT_BUTTON_RECT = Object.freeze([133, 150, 56, 19]);

const inRect = ([x, y, w, h], vx, vy) => vx >= x && vy >= y && vx < x + w && vy < y + h;

export class LoadClassicWindow {
  /**
   * @param {object|null} art - { bg, font } (either may be null - the
   *   window still answers clicks on the verbatim rects, the
   *   text-fallback-never-traps law).
   * @param {Array} slots - six entries of { name, tex } or null for an
   *   absent/unreadable save.
   */
  constructor(art, slots) {
    this.art = art;
    this.slots = slots;
    // "Select first valid save game" (:142-144).
    this.selectedSaveGame = slots.findIndex((s) => !!s);
    this.done = false;
  }

  /** The classic-window click law: returns
   *  { action: 'select'|'load'|'exit', index? } or null (consumed). A
   *  slot click with `isDouble` selects AND loads (:225-230). The
   *  Load button only exists while a save is selected (:155-159). */
  click(canvas, px, py, isDouble = false) {
    const m = nativeMetrics(canvas);
    const pt = pointToNative(m, px, py);
    if (!pt) return null;
    const [vx, vy] = pt;
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i]) continue;   // an unmounted slot has no buttons
      if (inRect(SAVE_IMAGE_RECTS[i], vx, vy) || inRect(SAVE_TEXT_RECTS[i], vx, vy)) {
        this.selectedSaveGame = i;
        return isDouble ? { action: 'load', index: i } : { action: 'select', index: i };
      }
    }
    if (this.selectedSaveGame >= 0 && inRect(LOAD_BUTTON_RECT, vx, vy)) {
      return { action: 'load', index: this.selectedSaveGame };
    }
    if (inRect(EXIT_BUTTON_RECT, vx, vy)) return { action: 'exit' };
    return null;
  }

  draw(renderer, canvas) {
    const m = nativeMetrics(canvas);
    if (this.art?.bg) drawImg(renderer, this.art.bg, m, 0, 0);
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot) continue;
      if (slot.tex) {
        const [x, y, w, h] = SAVE_IMAGE_RECTS[i];
        renderer.drawScreenQuad(slot.tex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s });
      }
      if (this.art?.font && slot.name) {
        const [tx, ty, tw] = SAVE_TEXT_RECTS[i];
        shadowText(renderer, this.art.font, slot.name, m, tx, ty + 1, { align: 'center', w: tw });
      }
    }
    // The outline rides the selected frame (:148-152, :183-185), in
    // DaggerfallDefaultTextColor - four 1px strips.
    if (this.selectedSaveGame >= 0) {
      const [x, y, w, h] = OUTLINE_RECTS[this.selectedSaveGame];
      drawRect(renderer, m, x, y, w, 1, DEFAULT_TEXT_COLOR);
      drawRect(renderer, m, x, y + h - 1, w, 1, DEFAULT_TEXT_COLOR);
      drawRect(renderer, m, x, y, 1, h, DEFAULT_TEXT_COLOR);
      drawRect(renderer, m, x + w - 1, y, 1, h, DEFAULT_TEXT_COLOR);
    }
  }
}
