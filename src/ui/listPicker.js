// U24: THE LIST PICKER - DFU's DaggerfallListPickerWindow (MIT,
// Daggerfall Workshop) on PICK00I0.IMG. The generic "choose one of
// these" popup: guild training picks a skill with it, and the spell
// and item makers, the travel map's teleport list and the quest
// journal all reach for the same window later.
//
// THE NATIVE-WINDOW RULE, element by element:
// - PICK00I0.IMG, 200x128 in the shipping data, and pickerPanel.Size
//   IS the texture's size (:73). Center/Middle on the 320x200 native
//   panel, so it sits at ((320-200)/2, (200-128)/2) = (60, 36).
// - listBox at panel-child (26,27), size 138x72 (:83-84).
// - the previous/next buttons are 9x9 at (179,10) and (179,108)
//   (:88-93) - they page by RowsDisplayed, not by one row.
// - the scroll bar is 5x82 at (181,23) (:96-99).
// - ListBox's own defaults (ListBox.cs:36-37): rowsDisplayed 9,
//   rowSpacing 1. A row advances by the font's glyph height PLUS the
//   spacing (:327).
// - the text colors are DaggerfallUI's (:52, :62): the default
//   243,239,44 and the SELECTED 162,36,12 - a dark red, not a
//   brighter yellow, which is the one people guess wrong.
//
// FLAGGED: the scroll bar draws as DFU's plain thumb rect rather than
// from art, because VerticalScrollBar paints a solid colour in DFU too
// - but its exact thumb colour comes from a Panel default this port
// has not needed anywhere else, so the bar is drawn from the same
// palette the rest of the window uses and the drag is not implemented
// (the two paging buttons cover the list; wheel scrolling is NOT
// implemented - AUDIT 23 ui-native-4 corrected the old claim).

import { loadImg, nativeMetrics, drawImg, shadowText, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';

/** pickerPanel.Size = the texture's size (:73), Center/Middle (:74-75). */
export const PICKER_W = 200, PICKER_H = 128;
export const PICKER_X = Math.round((320 - PICKER_W) / 2);   // 60
export const PICKER_Y = Math.round((200 - PICKER_H) / 2);   // 36

/** Panel-child rects, verbatim (:83-99). */
export const PICKER_RECTS = Object.freeze({
  list: [26, 27, 138, 72],
  previous: [179, 10, 9, 9],
  next: [179, 108, 9, 9],
  scrollBar: [181, 23, 5, 82],
});

/** ListBox.cs :36-37. */
export const ROWS_DISPLAYED = 9;
export const ROW_SPACING = 1;

/** DaggerfallUI.cs :62 - the SELECTED row is dark red. */
export const SELECTED_TEXT_COLOR = [162 / 255, 36 / 255, 12 / 255, 1];

let _art = null;
export async function preloadListPickerArt(deps) {
  if (_art) return;
  try { _art = { base: await loadImg(deps, 'PICK00I0.IMG') }; }
  catch { console.warn('[picker] PICK00I0.IMG unavailable; list pickers stay closed'); }
}
export const listPickerArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + PICKER_X && y >= ry + PICKER_Y
  && x < rx + PICKER_X + rw && y < ry + PICKER_Y + rh;

/** hooks = { items: string[], onPick(index, label), onCancel() }. */
export class ListPickerWindow {
  constructor({ items = [], onPick = null, onCancel = null } = {}) {
    this.items = items;
    this.onPick = onPick;
    this.onCancel = onCancel;
    this.done = false;
    this.isChoiceWindow = true;
    this.scrollIndex = 0;
    this.selectedIndex = 0;
  }

  /** ListBox.ScrollIndex's own bound: [0, Count - RowsDisplayed], and
   *  never below 0 for a list shorter than the window. */
  _clampScroll() {
    const max = Math.max(0, this.items.length - ROWS_DISPLAYED);
    this.scrollIndex = Math.min(Math.max(0, this.scrollIndex), max);
  }

  /** The paging buttons move by a WHOLE PAGE (:102-115 ScrollToNext /
   *  ScrollToPrevious call listBox.ScrollDown/Up by RowsDisplayed). */
  _page(dir) { this.scrollIndex += dir * ROWS_DISPLAYED; this._clampScroll(); }

  _pick(index) {
    if (index < 0 || index >= this.items.length) return;
    this.done = true;
    this.onPick?.(index, this.items[index]);
  }

  _cancel() { this.done = true; this.onCancel?.(); }

  input(code) {
    if (code === 'Escape') { this._cancel(); return; }
    if (code === 'Enter') { this._pick(this.selectedIndex); return; }
    if (code === 'ArrowDown' || code === 'KeyN') this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
    if (code === 'ArrowUp' || code === 'KeyP') this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    // keep the selection visible, which is ClampSelectionToVisibleRange's
    // job in DFU (commented out there, done here so the keyboard works)
    if (this.selectedIndex < this.scrollIndex) this.scrollIndex = this.selectedIndex;
    if (this.selectedIndex >= this.scrollIndex + ROWS_DISPLAYED) this.scrollIndex = this.selectedIndex - ROWS_DISPLAYED + 1;
    this._clampScroll();
    const d = /^Digit([1-9])$/.exec(code);
    if (d) this._pick(this.scrollIndex + Number(d[1]) - 1);
  }

  /** The row height a click resolves against (ListBox.cs:434):
   *  glyphHeight + rowSpacing. */
  rowHeight(font) { return (font?.fnt?.fixedHeight ?? 6) + ROW_SPACING; }

  click(vx, vy, font = null) {
    if (inRect(PICKER_RECTS.previous, vx, vy)) { this._page(-1); return true; }
    if (inRect(PICKER_RECTS.next, vx, vy)) { this._page(1); return true; }
    if (inRect(PICKER_RECTS.list, vx, vy)) {
      const rh = this.rowHeight(font ?? this._font);
      const row = Math.floor((vy - PICKER_Y - PICKER_RECTS.list[1]) / rh);
      if (row >= 0 && row < ROWS_DISPLAYED) {
        const index = this.scrollIndex + row;
        // DFU selects on the first click and USES on the second
        // (ListBox raises OnUseSelectedItem from a double click or
        // Return); the port picks straight through, because a
        // one-shot service list has nothing to preview.
        this._pick(index);
      }
      return true;
    }
    // a click on the panel but outside every control is consumed;
    // outside the panel closes, which is DaggerfallPopupWindow's
    // cancel-on-outside-click behaviour
    if (vx >= PICKER_X && vy >= PICKER_Y && vx < PICKER_X + PICKER_W && vy < PICKER_Y + PICKER_H) return true;
    this._cancel();
    return true;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._cancel(); return; }
    this._font = font;
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);
    drawImg(renderer, _art.base, m, PICKER_X, PICKER_Y);
    this._clampScroll();
    const [lx, ly] = PICKER_RECTS.list;
    const rh = this.rowHeight(font);
    this.items.slice(this.scrollIndex, this.scrollIndex + ROWS_DISPLAYED).forEach((label, r) => {
      const selected = this.scrollIndex + r === this.selectedIndex;
      shadowText(renderer, font, label, m, PICKER_X + lx, PICKER_Y + ly + r * rh,
        { color: selected ? SELECTED_TEXT_COLOR : DEFAULT_TEXT_COLOR });
    });
    // the scroll bar's thumb, sized and placed by the same
    // TotalUnits/DisplayUnits ratio VerticalScrollBar uses (:105-112)
    const [sx, sy, sw, sh] = PICKER_RECTS.scrollBar;
    const total = Math.max(this.items.length, ROWS_DISPLAYED);
    const thumbH = Math.max(1, Math.round(sh * ROWS_DISPLAYED / total));
    const thumbY = sy + Math.round(sh * this.scrollIndex / total);
    renderer.drawScreenQuad(null, {
      x: m.ox + (PICKER_X + sx) * m.s, y: m.oy + (PICKER_Y + thumbY) * m.s,
      w: sw * m.s, h: thumbH * m.s,
    }, undefined, DEFAULT_TEXT_COLOR);
  }
}
