// The shared classic ITEM LIST SCROLLER (DFU ItemListScroller, MIT
// Daggerfall Workshop) - extracted from nativeTrade after the 17d UI
// audit so every native window rides ONE corrected layout. Verbatim:
// itemListPanelRect (9,0,50,152) - the four 50x38 item BUTTONS sit
// at x=9 inside the 59x152 scroller, and the LEFT 9px column is the
// scroll rail: up arrow (0,0,9,16), down arrow (0,136,9,16), the
// scrollbar (1,18,6,117) between. Icons ScaleToFit with MaxAutoScale
// 1 (never upscaled), centered both axes in the button; the ONLY
// cell text is the stack count (FONT0004 at the button's top-left,
// drawn when stackCount > 1 - the NAME rides the button's TOOLTIP,
// which D7 shipped: scrollerToolTipText below is :464 and
// makeSlotToolTip is the per-window ToolTip every item button shares.

import { inventoryItemImage } from '../systems/itemTemplates.js';
import { drawText, measureText } from './text.js';
import { loadImg, drawImgCrop } from './nativePanel.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { thumbSpan, drawScrollThumb, VerticalScrollBar } from './verticalScrollBar.js';
import { itemLongName } from '../systems/itemInfo.js';   // D7: ResolveItemLongName, the tooltip's text
import { bookTitle } from '../systems/books.js';         // D7: GetBookTitle, the Books arm
import { ToolTip } from './toolTip.js';                  // D7: itemButtons[i].ToolTip = toolTip (:340)

export const LIST_SLOTS = 4;
export const CELL_X = 9;         // itemListPanelRect.x - the buttons' column
export const CELL_W = 50;
export const SLOT_H = 38;
export const ARROW_H = 16;       // upArrowRect (0,0,9,16)
export const DOWN_ARROW_Y = 136; // downArrowRect (0,136,9,16)
// AUDIT 17e F26: itemButtonMargin = 2 on all sides
// (ItemListScroller.cs:98, :339) - the icon panel is a ScaleToFit
// child of the BUTTON, so it fits the button's INTERIOR (46x34), not
// its full 50x38. Icons drew ~9% oversized.
export const CELL_MARGIN = 2;
// AUDIT 17e F25: stack labels are Right/Bottom aligned with
// ShadowPosition ZERO and the tooltip text colour
// (ItemListScroller.cs:360-365; DaggerfallUI.cs:69).
export const STACK_LABEL_COLOR = [230 / 255, 230 / 255, 200 / 255, 1];

// The scrollbar itself, in scroller-local px: Position (1,18), Size
// (6, itemListPanelRect.height - 35) = 117 (ItemListScroller.cs:279-284).
export const SCROLLBAR_Y = 18;
export const SCROLLBAR_W = 6;
export const SCROLLBAR_H = 117;

/** The thumb's span in BAR-LOCAL px. ROAD-A7: the arithmetic moved to
 *  ui/verticalScrollBar.js, which is now DFU's VerticalScrollBar in
 *  one place instead of two copies; this is that law with the
 *  scroller's own bar height and DisplayUnits baked in. Null when the
 *  list FITS - Draw returns before DrawScrollBar (:136) so no thumb
 *  rect is ever computed. */
export function scrollThumbSpan(scroll, len) {
  return thumbSpan(SCROLLBAR_H, len, LIST_SLOTS, scroll);
}

/** ROAD-A7: the scroller's own VerticalScrollBar, for a window that
 *  wants the DRAG. `rect` is the scroller's virtual [x,y,w,h]; the bar
 *  sits at (1,18) inside it (ItemListScroller.cs:279-284) and its
 *  DisplayUnits are the four rows. `onScroll` is
 *  ItemsScrollBar_OnScroll (:585-588). */
export function makeScrollerBar(rect, len, scroll, onScroll = null) {
  return new VerticalScrollBar({
    rect: [rect[0] + 1, rect[1] + SCROLLBAR_Y, SCROLLBAR_W, SCROLLBAR_H],
    totalUnits: len, displayUnits: LIST_SLOTS, scrollIndex: scroll, onScroll,
  });
}

/** Draw the thumb over a scroller rect (Draw -> DrawScrollBar). */
export function drawScrollerThumb(renderer, m, rect, scroll, len) {
  return drawScrollThumb(renderer, m,
    [rect[0] + 1, rect[1] + SCROLLBAR_Y, SCROLLBAR_W, SCROLLBAR_H],
    scrollThumbSpan(scroll, len));
}

/** Hit-test a scroller-relative click. rect = [x,y,w,h] virtual;
 *  returns null outside, {kind:'up'|'down'|'page-up'|'page-down'|'thumb'}
 *  on the LEFT rail, or {kind:'slot', slot} on a button.
 *
 *  AUDIT 39 F126: the rail pages off the THUMB, never off the rail's
 *  own midpoint - VerticalScrollBar.MouseClick (:142-150) compares the
 *  bar-local click against thumbRect.yMin/yMax, so at scrollIndex 0 a
 *  click halfway down the rail is BELOW the thumb and pages down. The
 *  midpoint split answered 'page-up' there and the clamp ate it. A
 *  click on the thumb moves nothing (neither branch fires), and a list
 *  that fits leaves thumbRect at the zero rect, where every rail click
 *  falls into the `>` arm and SetScrollIndex clamps it away. */
export function scrollerHit(rect, vx, vy, scroll = 0, len = 0) {
  const [rx, ry, rw, rh] = rect;
  if (vx < rx || vy < ry || vx >= rx + rw || vy >= ry + rh) return null;
  const x = vx - rx, y = vy - ry;
  if (x < CELL_X) {
    if (y < ARROW_H) return { kind: 'up' };
    if (y >= DOWN_ARROW_Y) return { kind: 'down' };
    const span = scrollThumbSpan(scroll, len);
    if (!span) return { kind: 'page-down' };
    const by = y - SCROLLBAR_Y;
    if (by < span.y) return { kind: 'page-up' };
    if (by > span.y + span.h) return { kind: 'page-down' };
    return { kind: 'thumb' };
  }
  return { kind: 'slot', slot: Math.floor(y / SLOT_H) };
}

/** Fold a rail hit into a scroll index (arrows one slot, the bar a
 *  page), clamped to the list. A click ON the thumb - or any other
 *  kind - moves nothing: DFU's MouseClick has only the two arms. */
export function applyScroll(current, kind, len) {
  const max = Math.max(0, len - LIST_SLOTS);
  const d = kind === 'up' ? -1 : kind === 'down' ? 1
    : kind === 'page-up' ? -LIST_SLOTS : kind === 'page-down' ? LIST_SLOTS : 0;
  return Math.max(0, Math.min(max, current + d));
}

// ── ROAD-A7: THE ARROWS' RED/GREEN STATES AND THEIR CLICK ─────────
//
// ItemListScroller.cs:91-92, :504-516 and :486-501. The scroller's two
// arrows are NOT part of the window background: they are cut out of
// two 9x152 strips, INVE06I0.IMG (green - "more items available") and
// INVE07I0.IMG (red - "no more items available"), at the SAME two
// rects the rail hit-test already uses, and swapped every time the
// list redraws. The port drew whatever the base INVE00I0 image happens
// to carry, for ever, so a scrolled list never told the player there
// was more above it.

/** The two strips' full size (:29) - the sub-rect cut is against this,
 *  not against the loaded image, so a replacement asset scales. */
export const ARROWS_FULL = Object.freeze({ w: 9, h: 152 });
export const ARROW_W = 9;
export const UP_ARROW_RECT = Object.freeze([0, 0, ARROW_W, ARROW_H]);
export const DOWN_ARROW_RECT = Object.freeze([0, DOWN_ARROW_Y, ARROW_W, ARROW_H]);

/** UpdateListScrollerButtons (:486-501), verbatim. Up is green once
 *  the list has scrolled at all; down is green while the last row is
 *  still below the window; and a list that FITS forces both red,
 *  overriding whatever the first two lines decided. */
export function arrowStates(index, count) {
  let up = index > 0 ? 'green' : 'red';
  let down = index < (count - LIST_SLOTS) ? 'green' : 'red';
  if (count <= LIST_SLOTS) { up = 'red'; down = 'red'; }
  return { up, down };
}

let _arrowArt = null;
export async function preloadScrollerArrowArt(deps) {
  if (_arrowArt) return;
  try {
    const [green, red] = await Promise.all([
      loadImg(deps, 'INVE06I0.IMG'), loadImg(deps, 'INVE07I0.IMG'),
    ]);
    _arrowArt = { green, red };
  } catch { console.warn('[scroller] INVE06I0/INVE07I0 unavailable; the arrows keep the background art'); }
}
export const scrollerArrowArtLoaded = () => !!_arrowArt;

/** Overlay both arrows in their current state onto a scroller rect. */
export function drawScrollerArrows(renderer, m, rect, index, count) {
  if (!_arrowArt) return false;
  const { up, down } = arrowStates(index, count);
  const [rx, ry] = rect;
  drawImgCrop(renderer, _arrowArt[up], m, UP_ARROW_RECT, [rx, ry, ARROW_W, ARROW_H]);
  drawImgCrop(renderer, _arrowArt[down], m, DOWN_ARROW_RECT, [rx, ry + DOWN_ARROW_Y, ARROW_W, ARROW_H]);
  return true;
}

/** ItemsUpButton_OnMouseClick / ItemsDownButton_OnMouseClick
 *  (:590-604): the two ARROWS play SoundClips.ButtonClick. The rail,
 *  the thumb and the wheel (:606-614) play nothing - the sound is on
 *  the buttons, not on the scrolling. */
export function playScrollerArrowClick(kind) {
  if (kind !== 'up' && kind !== 'down') return false;
  audio.playOneShot(SOUND.ButtonClick, 1);
  return true;
}

/** A per-window icon drawer over the host texture pipeline
 *  ({ getTexture, uploadRecord, textures }): lazily warms each
 *  template's world-texture record + captures its native size, then
 *  draws it centered in the button with the V-FLIPPED source rect
 *  (record textures store BOTTOM-UP GL rows - the hotfix law). */
export function makeIconDrawer(icons, identityOf = null) {
  const warm = new Set();
  const sizes = new Map();
  const drawer = (renderer, m, it, rect, slot) => {
    // AUDIT 17e F9: the lists used to draw the WORLD texture for every
    // item. DFU's GetItemImage draws the PLAYER (inventory) texture
    // for everything except UselessItems1 / ingredients / arrows /
    // ReligiousItems / MiscItems - 111 of 288 templates differ.
    // AUDIT 17f: the icon is addressed for a WEARER - SetRace offsets
    // clothing/armor archives by body morphology, and GetInventory-
    // TextureArchive reads that offset field back. Without it every
    // list drew the morphology-0 (Argonian) row.
    const img = inventoryItemImage(it, identityOf?.() ?? undefined);
    if (!img || !img.archive) return false;
    const key = `${img.archive}_${img.record}`;
    if (!warm.has(key)) {
      warm.add(key);
      icons.getTexture(img.archive).then((tex) => {
        if (img.record < tex.recordCount) {
          icons.uploadRecord(img.archive, img.record);
          sizes.set(key, tex.getSize(img.record));
        }
      }).catch(() => {});
    }
    const glTex = icons.textures.get(key);
    const size = sizes.get(key);
    if (!glTex || !size?.width) return false;
    const fit = Math.min(1, (CELL_W - CELL_MARGIN * 2) / size.width, (SLOT_H - CELL_MARGIN * 2) / size.height);
    const w = size.width * fit, h = size.height * fit;
    const x = rect[0] + CELL_X + (CELL_W - w) / 2;
    const y = rect[1] + slot * SLOT_H + (SLOT_H - h) / 2;
    renderer.drawScreenQuad(glTex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s },
      { u0: 0, v0: 1, u1: 1, v1: 0 });
    return true;
  };
  drawer._warm = warm;       // test seams
  drawer._sizes = sizes;
  return drawer;
}

/** The stack-count label (FONT0004), only above 1. AUDIT 17e F25:
 *  right/bottom aligned INSIDE the 2px button margin, with NO shadow
 *  and the tooltip colour - the port drew it top-left, shadowed, in
 *  default gold. */
export function drawStackLabel(renderer, font4, m, it, rect, slot) {
  if ((it.stackCount ?? 1) <= 1) return;
  const text = String(it.stackCount);
  const tw = measureText(font4.fnt, text);
  const th = font4.fnt?.fixedHeight ?? 6;
  const x = rect[0] + CELL_X + CELL_W - CELL_MARGIN - tw;
  const y = rect[1] + slot * SLOT_H + SLOT_H - CELL_MARGIN - th;
  drawText(renderer, font4, text, m.ox + x * m.s, m.oy + y * m.s, m.s, STACK_LABEL_COLOR);
}

/** AUDIT 17e F15 - ItemListScroller's delayScrollUp semantics
 *  (ItemListScroller.cs): when the backing list shrinks under a
 *  scrolled index the scroller does NOT re-clamp tightly - it only
 *  corrects once the index runs past the end, which leaves a
 *  partly-filled column exactly as classic does. Nothing re-clamped
 *  at all before, so equipping or dropping items while scrolled
 *  could strand the rest of the list off-screen. */
export function safeScrollIndex(scroll, len) {
  if (scroll < len) return scroll;
  return Math.max(0, len - LIST_SLOTS);
}

// ── D7: THE ITEM BUTTON'S TOOLTIP (ItemListScroller.cs:340, :462-465)
//
// Every one of the scroller's item buttons is handed the WINDOW's
// shared ToolTip at construction (`itemButtons[i].ToolTip = toolTip`,
// :340) and its text is re-set on every refresh from the item under
// it (:462-465). That text is not the item's short name: it is
// ResolveItemLongName - so a list shows "Daedric Broadsword", a
// northern plant its (northern) variant, a potion its %po and a quest
// letter its signoff - with ONE exception, spelled out on the line
// itself: a BOOK that is not an artifact reads GetBookTitle instead.
//
// The port drew the icon and the stack label and stopped there, which
// left every native item list a wall of unlabelled pictures: the only
// way to find out what a slot held was to click it.

/** ItemListScroller.cs:462-465, verbatim - including the
 *  `!item.IsArtifact` half of the Books test, which is what keeps an
 *  artifact tome reading as the artifact rather than as its title.
 *  DFU passes `item.LongName` as GetBookTitle's fallback, so an
 *  unmapped book id keeps the long name it already had. */
export function scrollerToolTipText(item, { getQuest = null } = {}) {
  if (!item) return null;
  const long = itemLongName(item, { getQuest });
  if (item.group === 'Books' && !item.artifact) return bookTitle(item.message ?? -1) ?? long;
  return long;
}

/** The window's shared ToolTip over a scroller (DaggerfallBaseWindow's
 *  defaultToolTip, :50-56), with the rest clock U37's ToolTip already
 *  owns. A window builds ONE of these, points its `hover` at it with
 *  the item under the cursor, runs `tick(dt)` and draws it LAST.
 *  `show(null, ...)` is the pointer leaving every button, which is
 *  DFU's OnMouseLeave clearing the shared tip. */
export function makeSlotToolTip() {
  const tip = new ToolTip();
  return {
    tip,
    /** The item under the cursor, or null to clear. */
    show(item, vx, vy, opts = {}) {
      const text = scrollerToolTipText(item, opts);
      if (!text) { tip.hide(); return null; }
      tip.show(text, vx, vy);
      return text;
    },
    hide: () => tip.hide(),
    update: (dt) => tip.update(dt),
    draw: (renderer, m, font) => tip.draw(renderer, m, font),
  };
}
