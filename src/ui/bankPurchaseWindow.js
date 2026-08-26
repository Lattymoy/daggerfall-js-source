// H2 - THE BANK'S PURCHASE WINDOW (DaggerfallBankPurchasePopUp, MIT
// Daggerfall Workshop): the list of houses on the market, and the one
// button that buys one.
//
// IT IS TWO WINDOWS IN ONE, and the discriminator is a NULL: the
// constructor takes `List<BuildingSummary> housesForSale = null`
// (:92-95) and every method asks `housesForSale == null` (:186-190,
// :244-247, :387-388). With no houses behind it the list is the two
// SHIP prices, the picked row's index IS the ShipType, and BUY hands
// it to the banking window's GeneratePurchaseShipPopup. The port
// spells that null as an ABSENT `houses` hook.
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
// FLAGGED, and it is presentation rather than function: the 104x91
// panel at (117,12) is a live 3D render of the selected building's own
// model, rotating one degree per 0.02s on a dedicated Unity camera and
// layer (:163-178, :202-260). The port draws the panel and leaves it
// empty. Everything the window is FOR - choosing a house, seeing its
// price, paying - is here; what is missing is a picture of it. Doing
// that properly means rendering an ARCH3D model to a texture inside a
// UI panel, which is a rendering slice and not a banking one.
//
// The port's own departure (Ledger A, the bank window's rule): DFU
// binds each button to a DaggerfallShortcut hotkey; the accelerators
// here are ours.

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox } from './messageBox.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { TRANSACTION_RESULT, housePrice, shipPrice, SHIP_PRICES } from '../systems/banking.js';

/** mainPanel.Size (:125) - and the size BANK01I0.IMG ships. */
export const PURCHASE_PANEL_W = 225, PURCHASE_PANEL_H = 129;
export const PURCHASE_PANEL_X = Math.round((320 - PURCHASE_PANEL_W) / 2);   // 48
/** mainPanel.Position (:124) is (0, 50) under a MIDDLE alignment. */
export const PURCHASE_PANEL_Y = 50;

/** The window's rects, verbatim (:23-28, :287-288, :320-334). */
export const PURCHASE_RECTS = Object.freeze({
  priceList: [5, 24, 99, 78],
  upArrow: [105, 23, 9, 16],
  downArrow: [105, 87, 9, 16],
  scrollBar: [106, 39, 7, 48],
  display: [117, 12, 104, 91],   // FLAGGED: the 3D preview
  buy: [38, 106, 40, 19],
  exit: [150, 106, 40, 19],
});
/** listDisplayUnits (:65) - ten rows in the scrolling area, and the
 *  list is 78 tall, so a row is 7 with the remainder as padding. */
export const LIST_ROWS = 10;
export const LIST_ROW_H = 7;
/** scrollNum (:66) - one item per scroll tick. */
export const SCROLL_NUM = 1;

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
 *   houses()        -> [{ buildingKey, meshRadius, ... }] on the market.
 *                      ABSENT is DFU's `housesForSale == null`: SHIP mode
 *   buy(house)      -> { result, amount } (systems/banking.purchaseHouse);
 *                      in SHIP mode it takes the ShipType instead
 *   rows(textId)    -> the host's TEXT.RSC reader
 *   onClose()
 */
export class BankPurchaseWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    this.selected = -1;           // SelectNone (:298)
    this.scroll = 0;
    this.box = null;
    this._boxLayout = null;
  }

  get houses() { return this.hooks.houses?.() ?? []; }
  /** `housesForSale == null` (:186) - the whole mode switch. */
  get ships() { return this.hooks.houses == null; }
  /** The list's length either way; the ship list is DFU's `i < 2`. */
  get count() { return this.ships ? SHIP_PRICES.length : this.houses.length; }
  _close() { this.done = true; this.hooks.onClose?.(); }

  /** The visible slice, and the scroll clamp that keeps it whole. */
  rows() {
    const maxScroll = Math.max(0, this.count - LIST_ROWS);
    if (this.scroll > maxScroll) this.scroll = maxScroll;
    // PopulatePriceList (:186-197): two rows of GetShipPrice(i) with
    // no houses behind the window, and the market's own prices with.
    if (this.ships) {
      return SHIP_PRICES.map((_, i) => ({ house: null, index: i, text: priceRow(shipPrice(i)) }))
        .slice(this.scroll, this.scroll + LIST_ROWS);
    }
    return this.houses.slice(this.scroll, this.scroll + LIST_ROWS)
      .map((h, i) => ({ house: h, index: this.scroll + i, text: priceRow(housePrice(h.meshRadius ?? 0)) }));
  }

  /** UpdateListScrollerButtons (:338-346) - the arrows are GREEN only
   *  while there is somewhere to go, which is what the port draws
   *  instead of the two arrow textures DFU swaps. */
  canScrollUp() { return this.scroll > 0; }
  canScrollDown() { return this.scroll < Math.max(0, this.count - LIST_ROWS); }

  _scroll(by) {
    const next = this.scroll + by * SCROLL_NUM;
    this.scroll = Math.max(0, Math.min(next, Math.max(0, this.count - LIST_ROWS)));
  }

  /** BuyButton_OnMouseClick (:380-392). SelectedIndex < 0 does
   *  NOTHING AT ALL - no beep, no message - which is DFU's own
   *  `if (SelectedIndex < 0) return;` and is why the button feels
   *  dead until a row is picked. */
  _buy() {
    if (this.selected < 0) return;
    // In SHIP mode DFU CLOSES this window first and the BANKING window
    // generates the popup (:385-388 -> DaggerfallBankingWindow.cs
    // :229-232), so the result of a ship purchase is the bank's
    // message and not this window's. The picked INDEX is the ShipType.
    if (this.ships) {
      audio.playOneShot(SOUND.ButtonClick, 1);
      this._close();
      this.hooks.buy?.(this.selected);
      return;
    }
    const house = this.houses[this.selected];
    if (!house) return;
    audio.playOneShot(SOUND.ButtonClick, 1);
    const r = this.hooks.buy?.(house) ?? { result: TRANSACTION_RESULT.NONE };
    if (r.result === TRANSACTION_RESULT.NONE) return;   // GeneratePopup says nothing on NONE
    const rows = this.hooks.rows?.(r.result) ?? [];
    this.box = {
      rows: rows.length ? rows : [{ text: String(r.result), center: true }],
      amount: r.amount ?? 0,
      bought: r.result === TRANSACTION_RESULT.PURCHASED_HOUSE,
    };
  }

  _dismissBox() {
    const b = this.box;
    this.box = null;
    // A completed purchase closes the window with it: the list it was
    // showing is a market this player has just left.
    if (b?.bought) this._close();
  }

  click(vx, vy) {
    if (this.box) {
      // ClickAnywhereToClose: the result box has no buttons, so any
      // click inside the window dismisses it.
      this._dismissBox();
      return true;
    }
    if (inRect(PURCHASE_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    if (inRect(PURCHASE_RECTS.buy, vx, vy)) { this._buy(); return true; }
    if (inRect(PURCHASE_RECTS.upArrow, vx, vy)) { this._scroll(-1); return true; }
    if (inRect(PURCHASE_RECTS.downArrow, vx, vy)) { this._scroll(1); return true; }
    const [lx, ly, lw] = PURCHASE_RECTS.priceList;
    if (vx >= lx + PURCHASE_PANEL_X && vx < lx + PURCHASE_PANEL_X + lw) {
      const row = Math.floor((vy - (ly + PURCHASE_PANEL_Y)) / LIST_ROW_H);
      if (row >= 0 && row < LIST_ROWS) {
        const pick = this.scroll + row;
        if (pick < this.count) { this.selected = pick; audio.playOneShot(SOUND.ButtonClick, 1); }
        return true;
      }
    }
    return true;   // the window owns every click inside it
  }

  input(code) {
    if (this.box) { this._dismissBox(); return; }
    if (code === 'Escape' || code === 'KeyE') { this._close(); return; }
    if (code === 'ArrowUp') {
      if (this.selected > 0) this.selected--;
      if (this.selected < this.scroll) this.scroll = this.selected;
      return;
    }
    if (code === 'ArrowDown') {
      if (this.selected < this.count - 1) this.selected++;
      if (this.selected >= this.scroll + LIST_ROWS) this.scroll = this.selected - LIST_ROWS + 1;
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
    if (this.box) {
      this._boxLayout = layoutMessageBox(font, this.box.rows, []);
      drawMessageBox(renderer, m, font, this._boxLayout);
    } else this._boxLayout = null;
  }
}
