// MC1 - THE SPELL ICON PICKER (SpellIconPickerWindow.cs, MIT,
// Daggerfall Workshop). The window both icon clicks have been waiting
// on: the spellbook's icon panel (SpellIconPanel_OnMouseClick,
// DaggerfallSpellBookWindow.cs:954-958) and the spell maker's
// selectIcon button (:894-898). It is a HOVER-DRIVEN picker: the
// selection IS whatever icon the pointer rests on (UpdateSelectedIcon,
// :218-244), a click anywhere over an icon closes the window with it,
// a click over no icon does nothing at all, and Escape cancels with
// the selection NULLED (CancelWindow, :106-110) - the consumer reads
// SelectedIcon from OnClose and a null means keep what you had.
//
// NO ICON PACKS. DFU's AddIconPacks walks SpellIconPacks first - the
// mod-supplied atlases - then the classic section. The port has no
// mod system (Ledger C, Not planned; ui/spellIcons.js records the same
// cut), so the pack loop contributes nothing and the classic section
// is the whole grid: 69 icons, 12 per row. The section header is the
// `classicIcons` string, VERBATIM from the pinned clone's own
// Internal_Strings.csv: "Classic".
//
// THE SCROLL LAW ships whole even though classic-only content cannot
// scroll (ScrollSteps 7 <= DisplayUnits 8, and the scroller's clamp is
// 0..max(0, total - display) = 0): the machinery is the window's core
// and a content change would silently need it. ONE INDEX: DFU keeps
// one on the scroller and one on the panel, but every writer routes
// through the scroller (wheel, Scroller_OnScroll copies, Reset), so
// the panel's looser 0..ScrollSteps clamp is unreachable and the port
// keeps the one index with the scroller's clamp.
//
// ROAD-G G4 FINISHED THE SCROLLER. `scroller` is a VerticalScrollBar
// (:39, :91-94) and MC1 shipped the clamp alone: the rail took no
// press, the thumb could not be dragged, and the window PAINTED a grey
// trough with a grey block on it - pixels DFU never draws, because
// VerticalScrollBar.Draw returns before DrawScrollBar whenever the
// content fits (:135-139) and this scroller sets no BackgroundColor at
// all (:91-94), so classic-only content shows the main panel's black
// and nothing else. It is `ui/verticalScrollBar.js` now, whole: the
// press splits across MouseClick's paging and Update's latch, the drag
// runs off the host's held button and the button coming UP drops it
// through `release()` - the seam wave E built, forwarded here by both
// consumers (`spellbookWindow.js`, `spellMakerWindow.js`) the way they
// already forward `hover`.
//
// THE CLIP QUIRK, kept: ScrollingPanel.Draw draws a child only when
// its scroll-adjusted top-left POINT sits inside the panel rect
// (:326-348) - DFU compares child-relative coordinates against a
// parent-relative rect, which works because both origins are (2,2).
// So an item is wholly shown or wholly skipped ("items are either
// wholly inside or outside of display area", the class's own note),
// and the hit test (UpdateSelectedIcon) has NO such gate - it walks
// every component, drawn or not.

import { nativeMetrics, drawRect } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { drawSpellIcon, SPELL_ICON_COUNT } from './spellIcons.js';
import { drawText } from './text.js';
import { VerticalScrollBar, drawScrollThumb } from './verticalScrollBar.js';   // ROAD-G G4: the scroller is DFU's component, not a painted rectangle

// #region UI Rects (:27-31), verbatim - the main panel is centred.
export const ICON_PICKER_PANEL_SIZE = Object.freeze([274, 180]);
export const ICON_PICKER_SCROLL_PANEL = Object.freeze([2, 2, 262, 176]);
export const ICON_PICKER_SCROLLER = Object.freeze([265, 2, 8, 176]);

// (:125-127), verbatim.
export const ICONS_PER_ROW = 12;
export const ICON_PICKER_ICON_SIZE = 16;
export const ICON_SPACING = 22;

/** THE F116 CONVENTION: TextManager "classicIcons" reads "Classic"
 *  from the pinned clone's Internal_Strings.csv. */
export const CLASSIC_ICONS_HEADER = 'Classic';

// scrollingPanel.BackgroundColor (:82); the main panel is black with
// a white outline (:75-76, Outline.cs:30 - Color.white, thickness 1).
const SCROLL_PANEL_BG = [0.5, 0.5, 0.5, 0.2];
const PANEL_BG = [0, 0, 0, 1];
const OUTLINE = [1, 1, 1, 1];

/**
 * AddIconPacks (:129-171) with the pack loop contributing nothing:
 * one header then the classic grid. Answers the laid-out items in
 * scrolling-panel-relative coordinates plus ScrollSteps.
 *
 * AddHeaderLabel places its label at (xpos, ypos + 4) and advances
 * ypos by one spacing (:204-216); AddIcon advances xpos by the
 * spacing and wraps every 12 (:173-202). ScrollSteps is DFU's
 * `ypos / iconSpacing + 1` - integer division over the FINAL ypos,
 * which the classic loop leaves on the last icon row.
 */
export function buildIconPickerLayout(iconCount = SPELL_ICON_COUNT) {
  const items = [];
  let xpos = 2, ypos = 2;
  const startX = xpos;
  items.push({ type: 'header', text: CLASSIC_ICONS_HEADER, x: xpos, y: ypos + 4 });
  ypos += ICON_SPACING;
  let rowCount = 0;
  for (let i = 0; i < iconCount; i++) {
    items.push({ type: 'icon', index: i, x: xpos, y: ypos });
    xpos += ICON_SPACING;
    if (++rowCount >= ICONS_PER_ROW) {
      xpos = startX;
      ypos += ICON_SPACING;
      rowCount = 0;
    }
  }
  return { items, scrollSteps: Math.trunc(ypos / ICON_SPACING) + 1 };
}

/** ScrollingPanel.Draw's gate (:326-348): an item survives when its
 *  scroll-adjusted top-left POINT is inside the panel rect - x in
 *  [2, 2+width), y in [2, 2+height) in the shared (2,2)-origin
 *  coordinates. Whole items in, whole items out. */
export function visibleIconPickerItems(items, scrollIndex) {
  const [sx, sy, sw, sh] = ICON_PICKER_SCROLL_PANEL;
  const dy = -scrollIndex * ICON_SPACING;
  return items.filter((it) => {
    const y = it.y + dy;
    return it.x >= sx && it.x < sx + sw && y >= sy && y < sy + sh;
  });
}

export class SpellIconPickerWindow {
  /** hooks.onClose(selectedIcon | null) is DFU's OnClose with the
   *  SelectedIcon read folded in - both consumers do exactly that
   *  (spellbook :960-974, maker :1013-1017). A selection is
   *  { key, index }; key is always null here (no packs), which is
   *  DFU's own "fallback to classic using index" tag (:196-201). */
  constructor(hooks = {}) {
    this.hooks = hooks;
    const { items, scrollSteps } = buildIconPickerLayout();
    this.items = items;
    this.scrollSteps = scrollSteps;
    // scroller.DisplayUnits = InteriorHeight / iconSpacing (:169)
    this.displayUnits = Math.trunc(ICON_PICKER_SCROLL_PANEL[3] / ICON_SPACING);
    this.scrollIndex = 0;
    // ROAD-G G4: the component (:39, :91-94). `rect` is MAIN-panel
    // local, the space Position/Size are set in; OnScroll is
    // Scroller_OnScroll (:246-250), which copies the index onto the
    // scrolling panel and re-derives the hovered icon. The two unit
    // counts are poured in before every read (`_syncScroller`) because
    // this window keeps ONE index, as the note above records.
    this.scroller = new VerticalScrollBar({
      rect: [...ICON_PICKER_SCROLLER],
      onScroll: (i) => this._setScroll(i),
    });
    this.selectedIcon = null;
    this._pointer = null;   // last pointer position, panel-relative
    this.closed = false;
  }

  /** ResetScrollPosition (:116-119). */
  resetScrollPosition() { this._setScroll(0); }

  /** The main panel's top-left on the 320x200 virtual screen -
   *  Center/Middle alignment (:72-73). */
  static panelOrigin() {
    return [(320 - ICON_PICKER_PANEL_SIZE[0]) / 2, (200 - ICON_PICKER_PANEL_SIZE[1]) / 2];
  }

  /** native (vx, vy) -> scrolling-panel-relative, or null outside. */
  _panelPoint(vx, vy) {
    const [px, py] = SpellIconPickerWindow.panelOrigin();
    const [sx, sy, sw, sh] = ICON_PICKER_SCROLL_PANEL;
    const x = vx - px - sx, y = vy - py - sy;
    return (x >= 0 && y >= 0 && x < sw && y < sh) ? [x, y] : null;
  }

  /** ROAD-G G4: native (vx, vy) -> MAIN-panel-relative, the space the
   *  scroller's rect lives in. No null arm: DFU's Update polls a
   *  position wherever it is, so a drag that leaves the window keeps
   *  scrolling. */
  _mainPoint(vx, vy) {
    const [px, py] = SpellIconPickerWindow.panelOrigin();
    return [vx - px, vy - py];
  }

  /** The two unit counts, poured into the component before any read -
   *  DisplayUnits and TotalUnits are set once in DFU (:169-170) and
   *  `scrollSteps` is a live field here. Reset (:171-176) raises no
   *  event, which is what makes it safe to call on every frame. */
  _syncScroller() {
    this.scroller.reset(this.displayUnits, this.scrollSteps, this.scrollIndex);
    return this.scroller;
  }

  /** VerticalScrollBar.SetScrollIndex (:187-199): clamp to
   *  0..max(0, totalUnits - displayUnits); Scroller_OnScroll then
   *  copies the value to the panel and re-derives the selection. */
  _setScroll(v) {
    const maxScroll = Math.max(0, this.scrollSteps - this.displayUnits);
    this.scrollIndex = Math.max(0, Math.min(maxScroll, v));
    this._updateSelectedIcon();
  }

  /** UpdateSelectedIcon (:218-244): the selection follows the
   *  pointer. Every icon is hit-tested at its scroll-adjusted rect -
   *  drawn or not - and resting on none NULLS the selection. */
  _updateSelectedIcon() {
    let over = null;
    const p = this._pointer;
    if (p) {
      const dy = -this.scrollIndex * ICON_SPACING;
      for (const it of this.items) {
        if (it.type !== 'icon') continue;
        const y = it.y + dy;
        if (p[0] >= it.x && p[0] < it.x + ICON_PICKER_ICON_SIZE
          && p[1] >= y && p[1] < y + ICON_PICKER_ICON_SIZE) {
          over = it;
        }
      }
    }
    this.selectedIcon = over ? { key: null, index: over.index } : null;
  }

  hover(vx, vy, e = null) {
    // ROAD-G G4: Update's drag arm (VerticalScrollBar.cs:101-121) -
    // `e.buttons & 1` is GetMouseButton(0) and the host's mousemove is
    // the frame. It runs BEFORE the pointer is re-read, because
    // Scroller_OnScroll's UpdateSelectedIcon (:248) reads the scrolling
    // panel's LAST mouse position, not this move's.
    // ...but never on the hosts' (-1,-1) SENTINEL, which is a
    // fabricated pair for "off the letterboxed panel" and not a
    // position (ROAD-C c2 flight 2's finding, in the space it was found
    // in: the NATIVE point, before this window's panel origin comes
    // off). `release()` is what ends the latch, so skipping the frame
    // strands nothing.
    const [mx, my] = this._mainPoint(vx, vy);
    if (vx >= 0 && vy >= 0) this._syncScroller().update(!!(e?.buttons & 1), my);
    // ScrollingPanel_OnMouseMove (:264-267): the panel's own move
    // handler, which does not fire while the cursor is off it.
    this._pointer = this._panelPoint(vx, vy);
    this._updateSelectedIcon();
  }

  /** ROAD-G G4: the button coming up - Update's `else` arm (:123-129).
   *  Both consumers forward it beside `hover`; unforwarded, a released
   *  thumb resumes from its stale anchor on the next move. */
  release() { this.scroller.draggingThumb = false; }

  /** OnMouseScrollUp/Down (:252-262): one scroller step per notch. */
  wheel(dir) { this._setScroll(this.scrollIndex + Math.sign(dir)); }

  /** ScrollingPanel_OnMouseClick (:269-274): re-derive, then close
   *  ONLY when the click landed on an icon - a miss keeps the window
   *  up. Answers true always; the picker is modal. */
  click(vx, vy) {
    // ROAD-G G4: the scroller is a sibling component of the scrolling
    // panel (:94), so a press on the rail is ITS press - MouseClick's
    // two paging arms outside the thumb, Update's latch on it - and
    // never the panel's click. `press` is that split.
    const [mx, my] = this._mainPoint(vx, vy);
    if (this._syncScroller().contains(mx, my)) { this.scroller.press(mx, my); return true; }
    this._pointer = this._panelPoint(vx, vy);
    this._updateSelectedIcon();
    if (this.selectedIcon) this._close();
    return true;
  }

  /** CancelWindow (:106-110): Escape nulls the selection first, so
   *  the consumer's `SelectedIcon != null` arm keeps the old icon. */
  cancel() {
    this.selectedIcon = null;
    this._close();
  }

  input(code) {
    if (code === 'Escape') { this.cancel(); return true; }
    return true;   // modal - no key falls through to the window below
  }

  _close() {
    if (this.closed) return;
    this.closed = true;
    this.hooks.onClose?.(this.selectedIcon);
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    drawScreenDimBackdrop(renderer, canvas);
    const [px, py] = SpellIconPickerWindow.panelOrigin();
    const [pw, ph] = ICON_PICKER_PANEL_SIZE;
    // the black main panel and its 1px white outline (:75-76)
    drawRect(renderer, m, px - 1, py - 1, pw + 2, 1, OUTLINE);
    drawRect(renderer, m, px - 1, py + ph, pw + 2, 1, OUTLINE);
    drawRect(renderer, m, px - 1, py, 1, ph, OUTLINE);
    drawRect(renderer, m, px + pw, py, 1, ph, OUTLINE);
    drawRect(renderer, m, px, py, pw, ph, PANEL_BG);
    const [sx, sy, sw, sh] = ICON_PICKER_SCROLL_PANEL;
    drawRect(renderer, m, px + sx, py + sy, sw, sh, SCROLL_PANEL_BG);
    // ScrollingPanel.Draw's clip - see visibleIconPickerItems.
    const dy = -this.scrollIndex * ICON_SPACING;
    for (const it of visibleIconPickerItems(this.items, this.scrollIndex)) {
      const y = it.y + dy;
      if (it.type === 'header') {
        if (font) drawText(renderer, font, it.text, m.ox + (px + sx + it.x) * m.s, m.oy + (py + sy + y) * m.s, m.s);
        continue;
      }
      const dst = [px + sx + it.x, py + sy + y, ICON_PICKER_ICON_SIZE, ICON_PICKER_ICON_SIZE];
      drawSpellIcon(renderer, m, it.index, dst);
      // the hovered icon's Outline.Enabled (:231)
      if (this.selectedIcon?.index === it.index) {
        const [ox, oy, ow, oh] = dst;
        drawRect(renderer, m, ox - 1, oy - 1, ow + 2, 1, OUTLINE);
        drawRect(renderer, m, ox - 1, oy + oh, ow + 2, 1, OUTLINE);
        drawRect(renderer, m, ox - 1, oy, 1, oh, OUTLINE);
        drawRect(renderer, m, ox + ow, oy, 1, oh, OUTLINE);
      }
    }
    // ROAD-G G4: the scroller (:91-94) draws what VerticalScrollBar
    // draws and nothing else - the three thumb slices of DrawScrollBar
    // (:204-222), and NOTHING AT ALL while the content fits, because
    // Draw returns at :135-139 and the component sets no
    // BackgroundColor. The grey trough and grey block MC1 painted here
    // were the port's own pixels; on classic-only content (7 steps in
    // 8 units) DFU shows the main panel's black.
    const [cx, cy, cw, ch] = ICON_PICKER_SCROLLER;
    drawScrollThumb(renderer, m, [px + cx, py + cy, cw, ch], this._syncScroller().thumbSpan);
  }
}
