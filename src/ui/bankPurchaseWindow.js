// H2 - THE BANK'S PURCHASE WINDOW (DaggerfallBankPurchasePopUp, MIT
// Daggerfall Workshop): the list of houses on the market, and the one
// button that buys one.
//
// H1 made a house ownable and left this as the only thing between a
// player and a deed - four consumers behind it (the rest law, the lock
// ladder, the quest residence filter, the bank's own buttons) all live
// and reachable by nobody, because a knight at rank 9 was the whole
// supply. This is the shop.
//
// THE FLOW IS SHORTER THAN ITS SOURCE LOOKS. BUY does not ask twice:
// `BuyButton_OnMouseClick` calls
// `bankingWindow.GeneratePurchaseHousePopup(house)`, which is
// `GeneratePopup(PurchaseHouse(house, regionIndex))` (:234-237) - the
// transaction runs and its RESULT is the message. There is no Yes/No.
//
// H4: THE 3D PREVIEW IS LIVE. The 104x91 panel at (117,12) shows the
// selected building's own ARCH3D model rotating -1 degree per 0.02s
// (:163-178's Update), through the host's drawModelPreview door - the
// WINDOW owns the rotation clock and the camera law (houses at
// (0,3,-20), Display3dModelSelection :245; the ships arm's
// (0,12,shipCameraDist) camera is carried for the day a ships list
// exists), the HOST owns the scissored second camera pass (the
// automap's beginFrame precedent). No selection, no render - DFU
// starts with SelectNone and an empty panel.
//
// The port's own departure (Ledger A, the bank window's rule): DFU
// binds each button to a DaggerfallShortcut hotkey; the accelerators
// here are ours.

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { TRANSACTION_RESULT, housePrice } from '../systems/banking.js';

/** mainPanel.Size (:125) - and the size BANK01I0.IMG ships. */
export const PURCHASE_PANEL_W = 225, PURCHASE_PANEL_H = 129;
export const PURCHASE_PANEL_X = Math.round((320 - PURCHASE_PANEL_W) / 2);   // 48
/** AUDIT 26 F137: mainPanel.Position (:124) declares (0, 50) - but
 *  under VerticalAlignment.Middle the y is DEAD: BaseScreenComponent
 *  :1234-1236 centres the rect and only VerticalAlignment.None reads
 *  position.y. The real y is (200-129)/2 = 35.5, rounded the way the
 *  siblings round their centring (guildServiceWindow.js PANEL_Y). */
export const PURCHASE_PANEL_Y = Math.round((200 - PURCHASE_PANEL_H) / 2);

/** The window's rects, verbatim (:23-28, :287-288, :320-334). */
export const PURCHASE_RECTS = Object.freeze({
  priceList: [5, 24, 99, 78],
  upArrow: [105, 23, 9, 16],
  downArrow: [105, 87, 9, 16],
  scrollBar: [106, 39, 7, 48],
  display: [117, 12, 104, 91],   // H4: the live 3D preview (drawn through the host door)
  buy: [38, 106, 40, 19],
  exit: [150, 106, 40, 19],
});
/** listDisplayUnits (:65) - ten rows in the scrolling area. AUDIT 26
 *  F142: the row PITCH is not a size/count division - DFU's ListBox
 *  advances `y += TextHeight + rowSpacing` (ListBox.cs:327) and maps
 *  clicks by `GlyphHeight + rowSpacing` (:434), and this list rides
 *  FONT0003 (fixedHeight 7) with the default rowSpacing 1 - so 8,
 *  rows drifting past the old derived 7 exactly as DFU's do. */
export const LIST_ROWS = 10;
export const LIST_ROW_H = 8;
/** scrollNum (:66) - one item per scroll tick. */
export const SCROLL_NUM = 1;

/** rotSpeed (:68) - the model turns one degree every 0.02 seconds,
 *  NEGATIVE about Y (Update :175). */
export const PREVIEW_ROT_SPEED = 0.02;
/** Display3dModelSelection's two cameras (:245-252): houses from
 *  (0, 3, -20); ships from (0, 12, GetShipCameraDist) - the ship
 *  distances are banking.js's SHIP_CAMERA_DIST. Near 0.7, far 100
 *  (SetupDisplayPanel :212-213). */
export const PREVIEW_HOUSE_CAMERA = Object.freeze({ y: 3, z: -20 });
export const PREVIEW_NEAR = 0.7, PREVIEW_FAR = 100;

/** Internal_Strings `bankPurchasePrice`, verbatim. */
export const priceRow = (price) => `Price : ${price} gold`;
/** ListBox.SelectedTextColor - the picked row stands out. */
const SELECTED_TEXT = [1, 0.85, 0.4, 1];

let _art = null;
export async function preloadPurchaseArt(deps) {
  if (_art) return;
  try {
    _art = await loadImg(deps, 'BANK01I0.IMG');
  } catch { console.warn('[bank] BANK01I0 unavailable; the purchase window stays closed'); }
}
export const purchaseArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + PURCHASE_PANEL_X && y >= ry + PURCHASE_PANEL_Y
  && x < rx + PURCHASE_PANEL_X + rw && y < ry + PURCHASE_PANEL_Y + rh;

/**
 * hooks:
 *   houses()        -> [{ buildingKey, meshRadius, ... }] on the market
 *   buy(house)      -> { result, amount } (systems/banking.purchaseHouse)
 *   showResult(result, amount) -> the BANKING window's GeneratePopup
 *   onClose()
 */
export class BankPurchaseWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    this.selected = -1;           // SelectNone (:298)
    this.scroll = 0;
    this.yawDeg = 0;              // H4: the preview's rotation, this window's clock
    this._rotAcc = 0;
  }

  /** H4: Update's rotation clock (:167-177) - one NEGATIVE degree per
   *  0.02s of real time, however many frames that spans. */
  tick(dt) {
    this._rotAcc += dt;
    while (this._rotAcc >= PREVIEW_ROT_SPEED) {
      this._rotAcc -= PREVIEW_ROT_SPEED;
      this.yawDeg -= 1;
    }
  }

  get houses() { return this.hooks.houses?.() ?? []; }
  _close() { this.done = true; this.hooks.onClose?.(); }

  /** The visible slice, and the scroll clamp that keeps it whole. */
  rows() {
    const all = this.houses;
    const maxScroll = Math.max(0, all.length - LIST_ROWS);
    if (this.scroll > maxScroll) this.scroll = maxScroll;
    if (this.scroll < 0) this.scroll = 0;   // scrollIndex is never negative in DFU; no path may leave one standing
    return all.slice(this.scroll, this.scroll + LIST_ROWS)
      .map((h, i) => ({ house: h, index: this.scroll + i, text: priceRow(housePrice(h.meshRadius ?? 0)) }));
  }

  /** UpdateListScrollerButtons (:338-346) - the arrows are GREEN only
   *  while there is somewhere to go, which is what the port draws
   *  instead of the two arrow textures DFU swaps. */
  canScrollUp() { return this.scroll > 0; }
  canScrollDown() { return this.scroll < Math.max(0, this.houses.length - LIST_ROWS); }

  _scroll(by) {
    const next = this.scroll + by * SCROLL_NUM;
    this.scroll = Math.max(0, Math.min(next, Math.max(0, this.houses.length - LIST_ROWS)));
  }

  /** BuyButton_OnMouseClick (:380-391), in DFU's exact order - the
   *  click sound FIRST (:382), then `if (SelectedIndex < 0) return;`
   *  with no beep and no message, which is why the button feels dead
   *  until a row is picked. AUDIT 26 F138: then CloseWindow() runs
   *  BEFORE the result is even known (:386) - the purchase list
   *  closes on EVERY outcome, refusal included, and the result box is
   *  the BANKING window's (GeneratePurchaseHousePopup -> the parent's
   *  GeneratePopup), shown over it via the showResult hook. The old
   *  cut kept the list open under the box and closed only on success. */
  _buy() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    if (this.selected < 0) return;
    const house = this.houses[this.selected];
    if (!house) return;
    this._close();
    const r = this.hooks.buy?.(house) ?? { result: TRANSACTION_RESULT.NONE };
    this.hooks.showResult?.(r.result, r.amount ?? 0);
  }

  click(vx, vy) {
    if (inRect(PURCHASE_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    if (inRect(PURCHASE_RECTS.buy, vx, vy)) { this._buy(); return true; }
    if (inRect(PURCHASE_RECTS.upArrow, vx, vy)) { this._scroll(-1); return true; }
    if (inRect(PURCHASE_RECTS.downArrow, vx, vy)) { this._scroll(1); return true; }
    const [lx, ly, lw] = PURCHASE_RECTS.priceList;
    if (vx >= lx + PURCHASE_PANEL_X && vx < lx + PURCHASE_PANEL_X + lw) {
      const row = Math.floor((vy - (ly + PURCHASE_PANEL_Y)) / LIST_ROW_H);
      if (row >= 0 && row < LIST_ROWS) {
        const pick = this.scroll + row;
        if (pick < this.houses.length) { this.selected = pick; audio.playOneShot(SOUND.ButtonClick, 1); }
        return true;
      }
    }
    return true;   // the window owns every click inside it
  }

  input(code) {
    if (code === 'Escape' || code === 'KeyE') { this._close(); return; }
    // ListBox.SelectPrevious/SelectNext (ListBox.cs:709-741): the
    // scroll adjustment lives INSIDE the move guard. Hoisted out, an
    // ArrowUp on the freshly opened list - SelectNone's -1 - moved
    // nothing and still assigned `scroll = -1`, and rows() clamps only
    // downward, so the list collapsed to one unbuyable row at index -1.
    if (code === 'ArrowUp') {
      if (this.selected > 0) {
        this.selected--;
        if (this.selected < this.scroll) this.scroll = this.selected;
      }
      return;
    }
    if (code === 'ArrowDown') {
      if (this.selected < this.houses.length - 1) {
        this.selected++;
        if (this.selected >= this.scroll + LIST_ROWS) this.scroll = this.selected - LIST_ROWS + 1;
      }
      return;
    }
    if (code === 'Enter' || code === 'KeyB') this._buy();
  }

  wheel(dy) { this._scroll(dy > 0 ? 1 : -1); }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, PURCHASE_PANEL_X, PURCHASE_PANEL_Y);
    const [lx, ly] = PURCHASE_RECTS.priceList;
    for (const r of this.rows()) {
      const y = ly + (r.index - this.scroll) * LIST_ROW_H;
      shadowText(renderer, font, r.text, m,
        PURCHASE_PANEL_X + lx + 2, PURCHASE_PANEL_Y + y,
        r.index === this.selected ? { color: SELECTED_TEXT } : undefined);
    }
    // H4: the live model, through the host's door - AFTER the chrome,
    // because the pass paints inside the display rect over it. The
    // rect travels in CANVAS pixels (the scissor's frame).
    const sel = this.houses[this.selected];
    if (sel?.modelIdNum != null) {
      const [dx, dy, dw, dh] = PURCHASE_RECTS.display;
      this.hooks.drawModelPreview?.(sel.modelIdNum, {
        x: m.ox + (PURCHASE_PANEL_X + dx) * m.s,
        y: m.oy + (PURCHASE_PANEL_Y + dy) * m.s,
        w: dw * m.s, h: dh * m.s,
      }, this.yawDeg, PREVIEW_HOUSE_CAMERA);
    }
  }
}
