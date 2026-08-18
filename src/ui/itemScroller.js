// The shared classic ITEM LIST SCROLLER (DFU ItemListScroller, MIT
// Daggerfall Workshop) - extracted from nativeTrade after the 17d UI
// audit so every native window rides ONE corrected layout. Verbatim:
// itemListPanelRect (9,0,50,152) - the four 50x38 item BUTTONS sit
// at x=9 inside the 59x152 scroller, and the LEFT 9px column is the
// scroll rail: up arrow (0,0,9,16), down arrow (0,136,9,16), the
// scrollbar (1,18,6,117) between. Icons ScaleToFit with MaxAutoScale
// 1 (never upscaled), centered both axes in the button; the ONLY
// cell text is the stack count (FONT0004 at the button's top-left,
// drawn when stackCount > 1 - names ride the info/tooltip seam).

import { inventoryItemImage } from '../systems/itemTemplates.js';
import { drawText, measureText } from './text.js';

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

/** Hit-test a scroller-relative click. rect = [x,y,w,h] virtual;
 *  returns null outside, {kind:'up'|'down'|'page-up'|'page-down'}
 *  on the LEFT rail, or {kind:'slot', slot} on a button. */
export function scrollerHit(rect, vx, vy) {
  const [rx, ry, rw, rh] = rect;
  if (vx < rx || vy < ry || vx >= rx + rw || vy >= ry + rh) return null;
  const x = vx - rx, y = vy - ry;
  if (x < CELL_X) {
    if (y < ARROW_H) return { kind: 'up' };
    if (y >= DOWN_ARROW_Y) return { kind: 'down' };
    return { kind: y < rh / 2 ? 'page-up' : 'page-down' };
  }
  return { kind: 'slot', slot: Math.floor(y / SLOT_H) };
}

/** Fold a rail hit into a scroll index (arrows one slot, the bar a
 *  page), clamped to the list. */
export function applyScroll(current, kind, len) {
  const max = Math.max(0, len - LIST_SLOTS);
  const d = kind === 'up' ? -1 : kind === 'down' ? 1 : kind === 'page-up' ? -LIST_SLOTS : LIST_SLOTS;
  return Math.max(0, Math.min(max, current + d));
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
