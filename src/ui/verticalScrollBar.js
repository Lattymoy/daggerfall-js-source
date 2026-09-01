// ROAD-A7: THE VERTICAL SCROLL BAR - DFU's VerticalScrollBar
// (Game/UserInterface/VerticalScrollBar.cs, MIT Daggerfall Workshop),
// the one widget three of the port's windows drew a flat rectangle for
// and nobody could ever drag.
//
// The port had the THUMB MATH already (AUDIT 39 F126 got the paging
// off thumbRect rather than the rail's midpoint), but it lived twice -
// once inline in listPicker.js and once in itemScroller.js - and
// neither copy carried Update()'s drag. This file is the single law;
// both consumers now read it.
//
// ── the law, member by member ─────────────────────────────────────
// - SetScrollIndex (:187-202): maxScroll = totalUnits - displayUnits,
//   floored at 0; the value is assigned FIRST and then clamped into
//   [0, maxScroll]. Every setter in the class runs through it, which
//   is why a page or a drag can overshoot without consequence.
// - Draw (:132-140): totalUnits <= displayUnits draws NOTHING, so
//   thumbRect keeps whatever it last held (the zero rect on a bar that
//   never had a thumb) - which is why every rail click on a list that
//   fits falls into MouseClick's `>` arm and clamps away.
// - DrawScrollBar (:204-222): thumbHeight is the displayed fraction of
//   the bar with a 10px floor, and thumbY walks the LEFTOVER by
//   scrollIndex / (totalUnits - displayUnits). The three art slices
//   are then laid with each rect's origin TRUNCATED to an int.
// - MouseClick (:142-150): above thumbRect.yMin pages up by
//   displayUnits, below yMax pages down; a click ON the thumb moves
//   nothing - there is no third arm.
// - Update (:101-130): while mouse button 0 is HELD, a press whose
//   bar-local point is inside thumbRect latches the drag, and each
//   frame after that
//        scale       = Size.y / totalUnits         <- TOTAL, not the span
//        unitsMoved  = dragDistance.y / scale
//        SetScrollIndex(dragStartScrollIndex + (int)unitsMoved)
//   The scale reading TOTAL units rather than (total - display) is
//   DFU's own quirk and is kept: it makes the thumb lag the cursor
//   slightly on a long list, and the clamp absorbs the overshoot.
//   `(int)` is a C# cast, so it truncates TOWARD ZERO - not floor.
// - MouseScrollUp/Down (:152-162): one unit per notch.
//
// ── the thumb art ────────────────────────────────────────────────
// vScrollThumbTop/Body/Bottom are DFU's own Resources textures, not
// ARENA2 art: three 5x1 RGB strips, verbatim below. Each is drawn
// StretchToFill across the bar's width, so a 5-wide bar (the list
// picker's) is 1:1 and a 6-wide bar (the item scroller's) stretches.
// Carrying the fifteen bytes is the only way this port can draw the
// same thumb without an asset pipeline for a foreign engine's
// Resources folder.

/** DrawScrollBar's floor (:209). */
export const THUMB_MIN_H = 10;

/** The three 5x1 strips, left column first (VScrollThumbTop.png,
 *  VScrollThumbBody.png, VScrollThumbBottom.png - greyscale, so one
 *  byte per column). The left column is the dark edge; the body's
 *  right column is the highlight. */
export const THUMB_TOP_ROW = Object.freeze([77, 223, 223, 223, 223]);
export const THUMB_BODY_ROW = Object.freeze([77, 186, 186, 186, 223]);
export const THUMB_BOTTOM_ROW = Object.freeze([77, 77, 77, 77, 77]);
export const THUMB_COLUMNS = 5;

/** SetScrollIndex (:187-202) as a pure fold. */
export function clampScrollIndex(value, totalUnits, displayUnits) {
  let maxScroll = totalUnits - displayUnits;
  if (maxScroll < 0) maxScroll = 0;
  let scrollIndex = value | 0;
  if (scrollIndex < 0) scrollIndex = 0;
  if (scrollIndex > maxScroll) scrollIndex = maxScroll;
  return scrollIndex;
}

/** DrawScrollBar's thumb, in BAR-LOCAL pixels (:206-211). Null when
 *  the content fits, because Draw (:136) returns before DrawScrollBar
 *  ever computes one. */
export function thumbSpan(barH, totalUnits, displayUnits, scrollIndex) {
  if (totalUnits <= displayUnits) return null;
  let h = barH * (displayUnits / totalUnits);
  if (h < THUMB_MIN_H) h = THUMB_MIN_H;
  return { y: scrollIndex * (barH - h) / (totalUnits - displayUnits), h };
}

/** MouseClick (:142-150) over a bar-local y. Answers the NEW scroll
 *  index. A null span is a bar that never drew a thumb, where
 *  thumbRect is the zero rect: every y is `> yMax`, so it pages down
 *  and SetScrollIndex clamps it back. */
export function scrollBarClick(localY, span, scrollIndex, totalUnits, displayUnits) {
  const yMin = span ? span.y : 0;
  const yMax = span ? span.y + span.h : 0;
  if (localY < yMin) return clampScrollIndex(scrollIndex - displayUnits, totalUnits, displayUnits);
  if (localY > yMax) return clampScrollIndex(scrollIndex + displayUnits, totalUnits, displayUnits);
  return clampScrollIndex(scrollIndex, totalUnits, displayUnits);
}

/** Update's drag arm (:115-121). `startY`/`startIndex` are the latch,
 *  `localY` the live bar-local point. */
export function dragScrollIndex(localY, startY, startIndex, barH, totalUnits, displayUnits) {
  const scale = barH / totalUnits;
  const unitsMoved = (localY - startY) / scale;
  return clampScrollIndex(startIndex + Math.trunc(unitsMoved), totalUnits, displayUnits);
}

/** A live scroll bar: the geometry, the two unit counts, the index and
 *  the drag latch. `rect` is [x, y, w, h] in the OWNER's coordinates -
 *  the window converts a screen point into that space before calling
 *  in, exactly as ScreenToLocal does in DFU. */
export class VerticalScrollBar {
  constructor({ rect = [0, 0, 5, 82], totalUnits = 0, displayUnits = 0, scrollIndex = 0, onScroll = null } = {}) {
    this.rect = rect;
    this.totalUnits = totalUnits;
    this.displayUnits = displayUnits;
    this.scrollIndex = scrollIndex;
    this.onScroll = onScroll;
    this.draggingThumb = false;
    this._dragStartY = 0;
    this._dragStartIndex = 0;
  }

  get barH() { return this.rect[3]; }

  /** Reset (:171-176) - "resets scroll properties without triggering
   *  events". */
  reset(displayUnits = 0, totalUnits = 0, scrollIndex = 0) {
    this.displayUnits = displayUnits;
    this.totalUnits = totalUnits;
    this.scrollIndex = scrollIndex;
  }

  setScrollIndex(value, doNotRaiseScrollEvent = false) {
    this.scrollIndex = clampScrollIndex(value, this.totalUnits, this.displayUnits);
    if (!doNotRaiseScrollEvent) this.onScroll?.(this.scrollIndex);
    return this.scrollIndex;
  }

  setScrollIndexWithoutRaisingScrollEvent(value) { return this.setScrollIndex(value, true); }

  /** The live thumb, bar-local. */
  get thumbSpan() { return thumbSpan(this.barH, this.totalUnits, this.displayUnits, this.scrollIndex); }

  /** Is an owner-space point inside the bar? */
  contains(x, y) {
    const [rx, ry, rw, rh] = this.rect;
    return x >= rx && y >= ry && x < rx + rw && y < ry + rh;
  }

  /** The press. DFU splits this across Update (the drag latch) and
   *  MouseClick (the paging); the two are mutually exclusive because
   *  the latch only fires inside thumbRect and MouseClick's two arms
   *  only fire outside it. Answers true when the press was the bar's.
   *  x/y are OWNER-space. */
  press(x, y) {
    if (!this.contains(x, y)) return false;
    const localY = y - this.rect[1];
    const span = this.thumbSpan;
    if (span && localY >= span.y && localY <= span.y + span.h) {
      this.draggingThumb = true;
      this._dragStartY = localY;
      this._dragStartIndex = this.scrollIndex;
      return true;
    }
    const next = scrollBarClick(localY, span, this.scrollIndex, this.totalUnits, this.displayUnits);
    if (next !== this.scrollIndex) this.setScrollIndex(next);
    return true;
  }

  /** Update (:101-130), driven from the host's mousemove. `held` is
   *  InputManager.GetMouseButton(0); releasing it drops the latch. y is
   *  OWNER-space and may be off the bar entirely - DFU keeps dragging
   *  wherever the cursor goes, which is what a scroll bar must do. */
  update(held, y) {
    if (!held) { this.draggingThumb = false; return false; }
    if (!this.draggingThumb) return false;
    const localY = y - this.rect[1];
    const next = dragScrollIndex(localY, this._dragStartY, this._dragStartIndex,
      this.barH, this.totalUnits, this.displayUnits);
    if (next !== this.scrollIndex) this.setScrollIndex(next);
    return true;
  }

  /** MouseScrollUp/Down (:152-162). */
  scrollUp() { this.setScrollIndex(this.scrollIndex - 1); }
  scrollDown() { this.setScrollIndex(this.scrollIndex + 1); }
}

/** Draw the three art slices over a VIRTUAL rect (Draw + DrawScrollBar,
 *  :132-222). `rect` is [x, y, w, h] in 320x200 space, already absolute;
 *  `m` is nativePanel's metrics. Nothing draws when the content fits. */
export function drawScrollThumb(renderer, m, rect, span) {
  if (!span) return false;
  const [rx, ry, rw] = rect;
  // The three rects, each origin truncated as DFU's (int) casts do.
  const topY = Math.trunc(ry + span.y);
  const topH = 1, bottomH = 1;              // the textures are 1px tall
  const bodyY = topY + topH;
  const bodyH = Math.trunc(span.h - topH - bottomH);
  const bottomY = bodyY + bodyH;
  const colW = rw / THUMB_COLUMNS;
  const band = (row, y, h) => {
    if (h <= 0) return;
    for (let c = 0; c < THUMB_COLUMNS; c++) {
      const v = row[c] / 255;
      renderer.drawScreenQuad(null, {
        x: m.ox + (rx + c * colW) * m.s, y: m.oy + y * m.s,
        w: colW * m.s, h: h * m.s,
      }, undefined, [v, v, v, 1]);
    }
  };
  band(THUMB_TOP_ROW, topY, topH);
  band(THUMB_BODY_ROW, bodyY, bodyH);
  band(THUMB_BOTTOM_ROW, bottomY, bottomH);
  return true;
}
