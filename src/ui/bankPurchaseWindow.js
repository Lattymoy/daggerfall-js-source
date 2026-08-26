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
// THE 104x91 PANEL AT (117,12) IS A LIVE 3D RENDER of the SELECTED
// row's own model, turning one degree per 0.02 real seconds on a
// camera and layer of its own (:163-178, :200-280). The whole of that
// law - which model, from what stand, how fast it turns, and that a
// new pick starts the turn again from zero - lives here as
// `previewSpec`/`update`, and `drawDisplayPanel` composites the result
// into DFU's own rect. What this file cannot supply is the PIXELS: the
// port's renderer draws an ARCH3D mesh only into the frame's own
// framebuffer through `beginFrame` (renderer.js:1095-1104), which
// resets the viewport to the whole canvas and clears it, and its one
// offscreen path (`renderCharacterSprite`, renderer.js:746) runs the
// CHARACTER program, whose vertex stream carries no UVs. A 104x91
// panel therefore cannot receive a world mesh without a new renderer
// member, and the model behind a modelId comes from the data pipeline
// the host owns (`getGpuMesh`). Both are outside this window, so the
// render arrives through the `previewTexture` hook; with no host
// behind it the rect stays empty, exactly as it stands in DFU before
// a row is picked.
//
// FLAGGED, and left undrawn on purpose: the camera CLEARS to a solid
// colour (:211) that DFU never assigns - it is whatever Unity gives a
// Camera component by default, a value that is nowhere in the source
// tree. The port paints no background in the display rect; only the
// model.
//
// The port's own departure (Ledger A, the bank window's rule): DFU
// binds each button to a DaggerfallShortcut hotkey; the accelerators
// here are ours.

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox } from './messageBox.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import {
  TRANSACTION_RESULT, housePrice, shipPrice, SHIP_PRICES, shipModelId, shipCameraDist,
} from '../systems/banking.js';

/** mainPanel.Size (:125) - and the size BANK01I0.IMG ships. */
export const PURCHASE_PANEL_W = 225, PURCHASE_PANEL_H = 129;
export const PURCHASE_PANEL_X = Math.round((320 - PURCHASE_PANEL_W) / 2);   // 48
/** Center/Middle on the 320x200 NativePanel (:122-123). BaseScreenComponent
 *  :1217/:1234 make BOTH alignments compute the rect from the parent
 *  alone, so the declared `Position = new Vector2(0, 50)` (:124) never
 *  applies - the panel sits at ((200-129)/2) = 35.5, not 50. The half
 *  pixel is real in DFU too (its rect is float); the port rounds it the
 *  way the guild popup's 74.5 is rounded. */
export const PURCHASE_PANEL_Y = Math.round((200 - PURCHASE_PANEL_H) / 2);   // 36

/** The window's rects, verbatim (:23-28, :287-288, :320-334). */
export const PURCHASE_RECTS = Object.freeze({
  priceList: [5, 24, 99, 78],
  upArrow: [105, 23, 9, 16],
  downArrow: [105, 87, 9, 16],
  scrollBar: [106, 39, 7, 48],
  display: [117, 12, 104, 91],   // displayPanelRect (:23) - the 3D preview
  buy: [38, 106, 40, 19],
  exit: [150, 106, 40, 19],
});
/** listDisplayUnits (:65) - ten rows in the scrolling area, and the
 *  list is 78 tall, so a row is 7 with the remainder as padding. */
export const LIST_ROWS = 10;
export const LIST_ROW_H = 7;
/** scrollNum (:66) - one item per scroll tick. */
export const SCROLL_NUM = 1;

/** rotSpeed (:68) and `goModel.transform.Rotate(Vector3.up, -1)`
 *  (:175): one degree NEGATIVE about up, once every 0.02 seconds. The
 *  clock is Time.realtimeSinceStartup (:167) - REAL seconds, so the
 *  model turns at the same rate whatever the world clock is doing. */
export const PREVIEW_ROT_SPEED = 0.02;
export const PREVIEW_ROT_STEP = -1;
/** Display3dModelSelection's two camera stands. A HOUSE is framed
 *  from (0, 3, -20) whatever house it is (:251); a SHIP from
 *  (0, 12, GetShipCameraDist(type)) (:246). */
export const HOUSE_CAMERA_POS = Object.freeze([0, 3, -20]);
export const SHIP_CAMERA_Y = 12;
/** nearClipPlane / farClipPlane (:214-215). */
export const PREVIEW_NEAR_CLIP = 0.7;
export const PREVIEW_FAR_CLIP = 100;
/** The one light (:218-228): DIRECTIONAL, standing at (0, 50, -50),
 *  intensity `brightness` (:69), hard shadows. */
export const PREVIEW_LIGHT_POS = Object.freeze([0, 50, -50]);
export const PREVIEW_LIGHT_INTENSITY = 0.4;

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
 *   previewTexture(spec) -> a texture handle for the 3D panel, or a
 *                      falsy value while the model is not resolved.
 *                      `spec` carries everything DFU's own camera and
 *                      model are set from - see `previewSpec` - plus
 *                      the render's pixel size (:203-204). ABSENT is
 *                      the port's standing gap: nothing renders and
 *                      the rect is left as the base art drew it.
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
    // The 3D panel's model, rebuilt whenever the pick changes (:236-240
    // destroys goModel and makes a new one, so the turn starts over).
    this._preview = null;
    this._previewIndex = -1;
    this.lastRotTime = 0;
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

  /**
   * Display3dModelSelection (:234-254) as a VALUE: which model the
   * display panel shows, and where the camera stands to see it. The
   * mode switch is the same null as everywhere else in this window -
   * a ship takes GetShipModelId and its own camera distance
   * (:246-247), a house takes the BuildingSummary's own ModelID from a
   * fixed stand (:251-253).
   *
   * A NEW PICK IS A NEW MODEL: DFU destroys goModel and builds another
   * (:236-240, :257-259), so the turn starts again from zero. Answers
   * null for a row that resolves no model at all - the port's building
   * record carries `modelIdNum: null` where the subrecord has no 3D
   * object (talkTopics.js:229-236), which is a house DFU's
   * CreateDaggerfallMeshGameObject would have had nothing to build
   * either.
   *
   * The climate the model is dressed in (:263-267 -
   * ClimateSwaps.FromAPIClimateBase of PlayerGPS's climate, Winter or
   * Summer by the world clock, WindowStyle.Day) is a PlayerGPS read
   * and a texture remap; it belongs to whoever owns the renderer's
   * remap, not to this window.
   */
  previewSpec() {
    if (this.selected !== this._previewIndex) {
      this._previewIndex = this.selected;
      this._preview = this._buildPreview(this.selected);
    }
    return this._preview;
  }

  _buildPreview(index) {
    if (index < 0 || index >= this.count) return null;
    let modelId, camera;
    if (this.ships) {
      modelId = shipModelId(index);
      camera = [0, SHIP_CAMERA_Y, shipCameraDist(index)];
    } else {
      modelId = this.houses[index]?.modelIdNum;
      camera = [...HOUSE_CAMERA_POS];
    }
    if (modelId == null) return null;
    return {
      modelId,
      camera,
      angle: 0,
      near: PREVIEW_NEAR_CLIP,
      far: PREVIEW_FAR_CLIP,
      light: [...PREVIEW_LIGHT_POS],
      intensity: PREVIEW_LIGHT_INTENSITY,
    };
  }

  /** Update (:163-178): past `lastRotTime + rotSpeed` the panel
   *  renders and THEN the model turns one degree, which is why the
   *  frame right after a pick shows it unrotated. lastRotTime moves on
   *  whether there is a model or not - :169 sits ABOVE the
   *  `if (goModel)`. `now` is REAL seconds, DFU's
   *  Time.realtimeSinceStartup; answers whether the model turned. */
  update(now = performance.now() / 1000) {
    if (!(now > this.lastRotTime + PREVIEW_ROT_SPEED)) return false;
    this.lastRotTime = now;
    const pv = this.previewSpec();
    if (!pv) return false;
    // The port keeps the angle in degrees where DFU accumulates it in
    // the transform's quaternion; 360 is the same pose as 0.
    pv.angle = (pv.angle + PREVIEW_ROT_STEP) % 360;
    return true;
  }

  /**
   * RenderModel (:270-280): the camera's render becomes the display
   * panel's BackgroundTexture, so it covers displayPanelRect exactly.
   * The texture is that rect at the UI's own scale (:203-204 - DFU
   * multiplies by NativePanel.LocalScale, which the port's integer
   * scale IS).
   * @returns {boolean} whether anything was drawn into the rect.
   */
  drawDisplayPanel(renderer, m) {
    const pv = this.previewSpec();
    if (!pv) return false;
    const [dx, dy, dw, dh] = PURCHASE_RECTS.display;
    const tex = this.hooks.previewTexture?.({ ...pv, width: dw * m.s, height: dh * m.s });
    if (!tex) return false;
    renderer.drawScreenQuad(tex, {
      x: m.ox + (PURCHASE_PANEL_X + dx) * m.s,
      y: m.oy + (PURCHASE_PANEL_Y + dy) * m.s,
      w: dw * m.s,
      h: dh * m.s,
    });
    return true;
  }

  /** BuyButton_OnMouseClick (:380-391). The ButtonClick is played
   *  FIRST, ABOVE the guard (:381-382), so the button beeps even on a
   *  dead press; then `if (SelectedIndex < 0) return;` does NOTHING
   *  ELSE - no message - which is why it feels dead until a row is
   *  picked. Then CloseWindow() runs UNCONDITIONALLY (:386), before
   *  either GeneratePurchase*Popup: the list is gone whatever the
   *  transaction answers, and the result box belongs to the BANKING
   *  window behind it. */
  _buy() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    if (this.selected < 0) return;
    // In SHIP mode DFU CLOSES this window first and the BANKING window
    // generates the popup (:387-388 -> DaggerfallBankingWindow.cs
    // :229-232), so the result of a ship purchase is the bank's
    // message and not this window's. The picked INDEX is the ShipType.
    if (this.ships) {
      this._close();
      this.hooks.buy?.(this.selected);
      return;
    }
    const house = this.houses[this.selected];
    if (!house) return;
    const r = this.hooks.buy?.(house) ?? { result: TRANSACTION_RESULT.NONE };
    if (r.result === TRANSACTION_RESULT.NONE) return;   // GeneratePopup says nothing on NONE
    const rows = this.hooks.rows?.(r.result) ?? [];
    this.box = {
      rows: rows.length ? rows : [{ text: String(r.result), center: true }],
      amount: r.amount ?? 0,
      result: r.result,
    };
  }

  _dismissBox() {
    this.box = null;
    // CloseWindow() at :386 is above the popup and takes no result
    // with it: the list is gone after ANY press of BUY, bought or
    // refused, and the player is back at the banking window.
    //
    // FLAGGED, and it is ownership rather than function: in DFU the
    // result box is GeneratePurchaseHousePopup's, raised BY the
    // banking window (DaggerfallBankingWindow.cs:234-237) over a
    // purchase list that has already closed. The port's host wires
    // `buy` straight to systems/banking.purchaseHouse instead of
    // through the banking window's own arm, so this window still
    // carries the box - it is drawn over a list DFU had already
    // dismissed. Routing it needs a `buyHouse` on the banking window
    // and the host hook re-pointed at it; both are outside this file.
    this._close();
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
    // Update's own order (:173-175): the panel RENDERS, and then the
    // model turns the degree that the next render will show.
    this.drawDisplayPanel(renderer, m);
    this.update();
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
