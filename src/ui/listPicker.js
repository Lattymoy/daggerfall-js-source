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
// ROAD-A7 closed this file's scroll-bar note. The bar is now a real
// VerticalScrollBar (ui/verticalScrollBar.js): DFU's three thumb art
// slices, the trough paging off thumbRect, and Update's DRAG - which
// Update (:103-119) feeds back the other way, `listBox.ScrollIndex =
// scrollBar.ScrollIndex` while DraggingThumb and the reverse when it
// is not. The list itself gained the two laws it was missing:
// MouseClick SELECTS and MouseDoubleClick USES (ListBox.cs:465-512),
// and MouseMove's highlightedIndex feeds DecideTextColor's two hover
// arms (:360-380).

import { loadImg, nativeMetrics, drawImg, shadowText, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { drawMenuBackdrop, DOUBLE_CLICK_DELAY_MS } from './chargenArt.js';
import { VerticalScrollBar, drawScrollThumb } from './verticalScrollBar.js';

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
/** DaggerfallUI.cs:57 - DaggerfallAlternateHighlightTextColor, the
 *  colour a row under the CURSOR takes (ListItem.highlightedTextColor,
 *  ListBox.cs:71). An orange, not the default gold. */
export const HIGHLIGHTED_TEXT_COLOR = [255 / 255, 130 / 255, 40 / 255, 1];
/** DaggerfallUI.cs:63 - DaggerfallBrighterSelectedTextColor, for the
 *  row that is BOTH selected and hovered (:362-366). */
export const HIGHLIGHTED_SELECTED_TEXT_COLOR = [254 / 255, 56 / 255, 18 / 255, 1];

/** DecideTextColor (ListBox.cs:360-380), the four arms in DFU's own
 *  order. Every list item in this window is Enabled, so the two
 *  disabled arms collapse away. */
export function rowTextColor(selected, highlighted) {
  if (highlighted && selected) return HIGHLIGHTED_SELECTED_TEXT_COLOR;
  if (selected) return SELECTED_TEXT_COLOR;
  if (highlighted) return HIGHLIGHTED_TEXT_COLOR;
  return DEFAULT_TEXT_COLOR;
}

/** AUDIT 39 F128: the SELECTED row carries NO shadow - ListBox.cs:41
 *  holds selectedShadowPosition = Vector2.zero and DecideTextColor
 *  hands it to the label in BOTH selected arms, where TextLabel's
 *  zero-position guard skips the pass outright. The picker window
 *  never overrides it, unlike the talk window. The two HIGHLIGHT arms
 *  keep the default shadowPosition (:376, :382). */
export const rowShadowOffset = (selected) => (selected ? 0 : 1);

let _art = null;
export async function preloadListPickerArt(deps) {
  if (_art) return;
  try { _art = { base: await loadImg(deps, 'PICK00I0.IMG') }; }
  catch { console.warn('[picker] PICK00I0.IMG unavailable; list pickers stay closed'); }
}
export const listPickerArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + PICKER_X && y >= ry + PICKER_Y
  && x < rx + PICKER_X + rw && y < ry + PICKER_Y + rh;

/** hooks = { items: string[], onPick(index, label), onCancel(),
 *  backdrop, allowCancel, selectedIndex }. BACKDROP: DFU's picker is a
 *  DaggerfallPopupWindow over a previousWindow, and
 *  DaggerfallPopupWindow paints Color.clear behind itself
 *  (ScreenDimColor, nativePanel.js's note), so the window underneath
 *  stays VISIBLE - which is what 'none' does. The default stays the
 *  opaque menu fill because the port's box-chain callers
 *  (guildServiceWindows) draw nothing of their own while a picker is
 *  up and would otherwise float over the live world.
 *
 *  X11b: `allowCancel` is DaggerfallPopupWindow.AllowCancel (:36-40),
 *  which gates the BACK button in Update (:69-73). Create Item sets it
 *  false (CreateItem.cs:70) because the magicka is already spent - the
 *  player must choose. `selectedIndex` is ListBox.SelectIndex +
 *  ScrollToSelected, which that same constructor calls with a STATIC
 *  lastSelectedIndex so the picker reopens where you left it. */
export class ListPickerWindow {
  constructor({
    items = [], onPick = null, onCancel = null, backdrop = 'menu',
    allowCancel = true, selectedIndex = 0,
  } = {}) {
    this.items = items;
    this.onPick = onPick;
    this.onCancel = onCancel;
    this.backdrop = backdrop;
    this.allowCancel = allowCancel;
    this.done = false;
    this.isChoiceWindow = true;
    this.scrollIndex = 0;
    this.selectedIndex = Math.min(Math.max(0, selectedIndex | 0), Math.max(0, items.length - 1));
    // ListBox.cs:29 - nothing is highlighted until the cursor moves
    // over a row, and MouseLeave puts it back (:460-463).
    this.highlightedIndex = -1;
    this.scrollToSelected();
    // Setup (:96-100): the bar is a pickerPanel child at (181,23),
    // 5x82. Its rect is kept in NATIVE coordinates so the window's own
    // hit tests and its draw share one origin.
    this.scrollBar = new VerticalScrollBar({
      rect: [PICKER_X + PICKER_RECTS.scrollBar[0], PICKER_Y + PICKER_RECTS.scrollBar[1],
        PICKER_RECTS.scrollBar[2], PICKER_RECTS.scrollBar[3]],
      totalUnits: this.items.length, displayUnits: ROWS_DISPLAYED, scrollIndex: this.scrollIndex,
    });
    this._lastRowClick = null;
  }

  /** Update (:103-119). TotalUnits/DisplayUnits are refreshed from the
   *  live list every frame, and the index flows FROM the bar while the
   *  thumb is being dragged and TO it the rest of the time. */
  syncScrollBar() {
    const bar = this.scrollBar;
    bar.totalUnits = this.items.length;
    bar.displayUnits = ROWS_DISPLAYED;
    if (bar.draggingThumb) {
      this.scrollIndex = bar.scrollIndex;
      this._clampScroll();
    } else {
      bar.setScrollIndexWithoutRaisingScrollEvent(this.scrollIndex);
    }
  }

  _now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  /** ROAD-U CORRECTION. ListBox.ScrollToSelected (:778-783) is
   *  UNCONDITIONAL - `scrollIndex = selectedIndex;` then a clamp to
   *  [0, Count - RowsDisplayed]: the selection is moved to the TOP row
   *  of the window. This used to hold the keep-it-on-screen arms
   *  (ClampSelectionToVisibleRange's job, which the arrow keys do
   *  inline at :217-219) under a docstring citing the law it
   *  contradicted, so a Create Item picker reopened at row 5 opened
   *  scrolled to 0 with the selection six rows down where DFU opens
   *  scrolled to 5 with it on the first row. Its one caller is the
   *  constructor, standing for CreateItem.cs:75-76
   *  (SelectIndex(lastSelectedIndex); ScrollToSelected()). */
  scrollToSelected() {
    this.scrollIndex = this.selectedIndex;
    this._clampScroll();
  }

  /** ListBox.ScrollIndex's own bound: [0, Count - RowsDisplayed], and
   *  never below 0 for a list shorter than the window. */
  _clampScroll() {
    const max = Math.max(0, this.items.length - ROWS_DISPLAYED);
    this.scrollIndex = Math.min(Math.max(0, this.scrollIndex), max);
  }

  /** X11b CORRECTION. This used to page by RowsDisplayed, citing
   *  ScrollToNext/ScrollToPrevious - which belong to a DIFFERENT
   *  window. DaggerfallListPickerWindow's own two buttons call
   *  `listBox.SelectPrevious()` / `SelectNext()` (:121-129), which move
   *  the SELECTION by ONE and scroll only far enough to keep it visible
   *  (ListBox.cs:709-741). So the buttons were skipping nine rows where
   *  DFU steps one, and left the selection where it was - on a 29-row
   *  list that is the difference between choosing an item and hunting
   *  for it. Found while reading this window for Create Item, whose
   *  picker is the longest one in the game. */
  _select(dir) {
    const next = this.selectedIndex + dir;
    if (next < 0 || next >= this.items.length) return;   // SelectPrevious/SelectNext both refuse at the ends
    this.selectedIndex = next;
    // EntryWise scrolling: only enough to keep the selection on screen
    if (dir < 0 && this.selectedIndex < this.scrollIndex) this.scrollIndex = this.selectedIndex;
    if (dir > 0 && this.selectedIndex > this.scrollIndex + ROWS_DISPLAYED - 1) this.scrollIndex++;
    this._clampScroll();
  }

  /** ListBox.UseSelectedItem (:785-789) -> OnUseSelectedItem ->
   *  DaggerfallListPickerWindow.RaiseOnItemPickedEvent (:136-149). The
   *  index it reports is the LIST's selectedIndex, never the row that
   *  was clicked - MouseClick has already moved the selection there. */
  _pick(index) {
    if (index < 0 || index >= this.items.length) return;
    this.done = true;
    this.onPick?.(index, this.items[index]);
  }

  /** UseSelectedItem over the live selection. */
  _use() { this._pick(this.selectedIndex); }

  _cancel() {
    if (!this.allowCancel) return;   // AllowCancel gates the back button (DaggerfallPopupWindow :69-73)
    this.done = true;
    this.onCancel?.();
  }

  input(code) {
    if (code === 'Escape') { this._cancel(); return; }
    // ListBox.Update (:296-297): Return is UseSelectedItem, the same
    // door the double click goes through.
    if (code === 'Enter') { this._use(); return; }
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

  /** The mouse wheel scrolls the list one row per notch (ListBox
   *  OnMouseScrollUp/Down), selection untouched. */
  wheel(dir) {
    if (!dir) return;
    this.scrollIndex += Math.sign(dir);
    this._clampScroll();
  }

  /** The ONE row height draw, hover and the hit-test all resolve
   *  against (ListBox.cs:435, :469): glyphHeight + rowSpacing. */
  rowHeight(font) { return (font?.fnt?.fixedHeight ?? 6) + ROW_SPACING; }

  /** MouseMove (:428-458) and MouseLeave (:460-463): the row under the
   *  cursor is the highlightedIndex, and anything off the LIST clears
   *  it. The host's hover seam also drives VerticalScrollBar.Update -
   *  `e` is the DOM mousemove, whose `buttons` bit 0 stands in for
   *  InputManager.GetMouseButton(0). A host that hands no event holds
   *  no button, so the drag lets go, which is the safe direction. */
  hover(vx, vy, e = null) {
    const rh = this.rowHeight(this._font);
    this.highlightedIndex = -1;
    if (this.items.length && inRect(PICKER_RECTS.list, vx, vy)) {
      const row = Math.floor((vy - PICKER_Y - PICKER_RECTS.list[1]) / rh);
      const index = this.scrollIndex + row;
      if (index >= 0 && index < this.items.length) this.highlightedIndex = index;
    }
    this.syncScrollBar();
    if (this.scrollBar.update(!!(e?.buttons & 1), vy)) this.syncScrollBar();
  }

  /** The button let go: Update's else arm (:123-129). */
  release() { this.scrollBar.draggingThumb = false; }

  click(vx, vy, font = null, now = null) {
    if (inRect(PICKER_RECTS.previous, vx, vy)) { this._select(-1); return true; }
    if (inRect(PICKER_RECTS.next, vx, vy)) { this._select(1); return true; }
    // ROAD-A7: the bar. A press inside thumbRect latches the DRAG
    // (Update :108-113); a press above or below it pages by
    // DisplayUnits (MouseClick :146-149). The bar rect is already
    // native, so no PICKER_X/Y fold here.
    this.syncScrollBar();
    if (this.scrollBar.contains(vx, vy)) {
      this.scrollBar.press(vx, vy);
      this.scrollIndex = this.scrollBar.scrollIndex;
      this._clampScroll();
      return true;
    }
    if (inRect(PICKER_RECTS.list, vx, vy)) {
      // ROAD-U: ONE row height for draw, hover and hit-test. ListBox
      // resolves MouseMove (:435) and MouseClick (:469) off the SAME
      // live font, and `draw` (:312) is what records it here. The third
      // argument is only a pre-first-frame seed now, and is ignored
      // unless it really is a font: the three routers that mount a bare
      // picker pass a right-button BOOLEAN in that slot
      // (townTalk.js:904, worldModes.js:5770, dungeonContext.js:4064),
      // and `false ?? this._font` kept the `false`, dropping the click
      // grid to 6+1=7 against a drawn and hovered grid of 7+1=8 for
      // FONT0003 - so from the 6th visible row on, the row you
      // highlighted was not the row you selected, and the 9th was
      // unselectable outright.
      const rh = this.rowHeight(this._font ?? (font?.fnt ? font : null));
      const row = Math.floor((vy - PICKER_Y - PICKER_RECTS.list[1]) / rh);
      if (row >= 0 && row < ROWS_DISPLAYED) {
        const index = this.scrollIndex + row;
        // ROAD-A7: DFU's real law at last. ListBox.MouseClick
        // (:465-505) only SELECTS - it sets selectedIndex and raises
        // OnSelectItem; it takes MouseDoubleClick (:507-512) to reach
        // UseSelectedItem, and through it OnItemPicked. The port used
        // to pick straight through on one click, which meant no list
        // in the game could be browsed and the DFU behaviour every
        // other list window in this port already carries (the class
        // picker, the save window) stopped at this one door.
        //
        // The double-click test is on TIME ALONE
        // (BaseScreenComponent.cs:691, the chargen precedent): the
        // second click need not land on the same row, because
        // MouseClick has already moved the selection to it.
        if (index >= 0 && index < this.items.length) {
          const t = now ?? this._now();
          const wasDouble = this._lastRowClick != null && (t - this._lastRowClick) < DOUBLE_CLICK_DELAY_MS;
          this.selectedIndex = index;          // MouseClick
          this._lastRowClick = t;
          if (wasDouble) { this._lastRowClick = null; this._use(); }   // MouseDoubleClick
        }
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
    // No art, no window. A picker that cannot be cancelled still has to
    // go away here or it would hold the host for ever showing nothing -
    // so this bypasses AllowCancel deliberately, and says so.
    if (!_art) { this.done = true; this.onCancel?.(); return; }
    this._font = font;
    const m = nativeMetrics(canvas);
    if (this.backdrop !== 'none') drawMenuBackdrop(renderer, canvas);
    drawImg(renderer, _art.base, m, PICKER_X, PICKER_Y);
    this._clampScroll();
    const [lx, ly] = PICKER_RECTS.list;
    const rh = this.rowHeight(font);
    this.items.slice(this.scrollIndex, this.scrollIndex + ROWS_DISPLAYED).forEach((label, r) => {
      const i = this.scrollIndex + r;
      const selected = i === this.selectedIndex;
      // DecideTextColor (:360-380): selected, hovered, both, or plain.
      shadowText(renderer, font, label, m, PICKER_X + lx, PICKER_Y + ly + r * rh,
        { color: rowTextColor(selected, i === this.highlightedIndex), shadowOffset: rowShadowOffset(selected) });
    });
    // ROAD-A7: the bar, from DFU's own thumb art. Draw (:136) paints
    // nothing at all when the list fits, which drawScrollThumb honours
    // through thumbSpan's null.
    this.syncScrollBar();
    drawScrollThumb(renderer, m, this.scrollBar.rect, this.scrollBar.thumbSpan);
  }
}
