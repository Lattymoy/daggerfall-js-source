// U8c: the NATIVE TRADE WINDOW - the classic shop screen on real
// art (DFU DaggerfallInventoryWindow + DaggerfallTradeWindow
// geometry, MIT Daggerfall Workshop): INVE00I0.IMG base,
// INVE08I0.IMG buy-mode action panel at (222,10), SHOP00I0.IMG cost strip at
// (49,13) with cost/gold labels at +28/+68. Item lists are the
// classic vertical scrollers - local (163,48,59x152) = the player's
// shop-accepted sellables, remote (261,48,59x152) = the open
// shelf's stock - four ~38px slots each, REAL item icons through
// the world-texture records the E1 templates carry.
//
// U40: THE MODE FLOW. U8c shipped this screen in BUY mode only and
// transacted AT THE CLICK, flagging the gap loud. DFU does neither:
// a click STAGES an item and the MODE ACTION button commits the lot
// behind one Yes/No popup. That is why there is a Clear button.
//
// The two lists are not "player" and "shop" - they are LOCAL and
// REMOTE, and what each holds depends on the mode:
//   Buy   local = the BASKET first, then the pack (:677-701)
//         remote = the shelf's stock
//   other local = the pack, narrowed by mode (Sell to the groups this
//         shop buys, SellMagic to enchanted items only)
//         remote = what you have STAGED, which starts empty
// So in Sell mode the right-hand list fills up as you click, and the
// cost strip totals it. Clicking a staged item takes it back.
//
// The laws are systems/tradeModes.js's; this file is the panel, the
// hit rects, the staging collections and the confirm box.

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { LIST_SLOTS, CELL_X, CELL_W, SLOT_H, ARROW_H, DOWN_ARROW_Y, scrollerHit, applyScroll, makeIconDrawer, drawStackLabel } from './itemScroller.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from './text.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import {
  MODE_ACTION_ART, SELL_GOLD_ART, modeActionArt,
  tradeCost, getTradePrice, tradeDecision, sellProceeds,
  localListAccepts, localClickDecision, DOESNT_NEED_IDENTIFY, LETTER_OF_CREDIT_TEXT,
  MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID, DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID,
} from '../systems/tradeModes.js';
import { CANNOT_BE_REPAIRED_TEXT } from '../systems/repairService.js';
import { isSummoned } from '../systems/inventory.js';   // TransferItem's summoned guard
import { CANNOT_REMOVE_ITEM_TEXT } from '../systems/createItem.js';   // both TransferItem refusals speak it
import { questTransferRefused, SMALL_CART_TEMPLATE, extinguishTransferred, CANNOT_CARRY_TEXT } from './nativeInventory.js';   // DaggerfallTradeWindow EXTENDS the inventory window
import { canHoldAmount, effectiveUnitWeightInKg, totalWeight } from '../systems/inventory.js';   // ComputeCanHoldAmount (:1447-1457), the one member CanCarryAmount weighs with
import { expandGuildMacros } from '../systems/guildServiceActions.js';

// re-exported so the composed window keeps one import surface
export { LIST_SLOTS, CELL_X, CELL_W, SLOT_H, ARROW_H, DOWN_ARROW_Y };

export const TRADE_RECTS = Object.freeze({
  costPanel: [49, 13, 111, 9],           // SHOP00I0 strip
  actionPanel: [222, 10, 39, 190],       // the mode's own panel - INVE08/10/12/14 (:755-764)
  localList: [163, 48, 59, 152],
  remoteList: [261, 48, 59, 152],
  exit: [222 + 0, 178, 39, 22],          // the inventory exit rect over the action panel art
  modeAction: [222 + 4, 10 + 124, 31, 14],   // the mode action (panel-child 4,124)
  clear: [222 + 4, 10 + 146, 31, 14],
});
// The ItemListScroller layout lives in itemScroller.js (the 17d UI
// audit's corrected law, shared with the inventory window).

let _art = null;
/** LoadTextures (:751-771). Every mode's panel is loaded up front
 *  rather than on open: they are five small IMGs, two of the five
 *  names are the SAME file (Sell and SellMagic share INVE10), and a
 *  window that had to await art on construction could not answer
 *  tradeArtLoaded() before the host had already decided to open it.
 *  INVE11 rides along because DFU loads it in every mode - it is the
 *  GOLD panel the select button's selected state is cut out of. */
export async function preloadTradeArt(deps) {
  if (_art) return;
  try {
    const names = [...new Set([...Object.values(MODE_ACTION_ART), SELL_GOLD_ART])];
    const [base, cost, fnt4, ...panels] = await Promise.all([
      loadImg(deps, 'INVE00I0.IMG'), loadImg(deps, 'SHOP00I0.IMG'),
      deps.fetchBytes('FONT0004.FNT'),   // the stack-count font (DFU Font4)
      ...names.map((n) => loadImg(deps, n)),
    ]);
    _art = {
      base, cost, panels: new Map(names.map((n, i) => [n, panels[i]])),
      font4: makeFont(deps.renderer, new FntFile().load(fnt4), 'FONT0004'),
    };
  } catch { console.warn('[trade] INVE00I0/SHOP00I0/mode panels unavailable; the keyed shelf window stands in'); }
}
export const tradeArtLoaded = () => !!_art;
/** The panel this mode draws, or null in Inventory mode - DFU's own
 *  `if (actionButtonsTexture != null)` guard at :213. */
export const modeActionPanel = (mode) => _art?.panels.get(modeActionArt(mode)) ?? null;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/**
 * hooks:
 *   mode           'Buy' | 'Sell' | 'SellMagic' | 'Repair' | 'Identify'
 *   shelfItems()   -> the shop's stock (the Buy mode remote list)
 *   packItems()    -> the player's own items, already minus equipped
 *   accepts(item)  -> storeBuysItemType for THIS shop (Sell's filter)
 *   enchanted(item)-> SellMagic's filter
 *   priceCtx()     -> { quality, priceAdjustment, holidayId, guildFactionId,
 *                       skills, reducedRepairCost, reducedIdentifyCost }
 *   gold(), rows(textId), weight() -> { carriedWeightKg, maxEncumbranceKg }
 *   commit(mode, staged, price, proceeds) - the host's transaction
 *   icons, entity, shopName
 *   getQuest(uid)  -> QuestMachine.GetQuest, for TransferItem's quest
 *                     arm. UNWIRED: no host passes one yet, and DFU
 *                     refuses a quest item it cannot resolve (:1489),
 *                     so the missing seam lands on the safe side - no
 *                     quest item can be sold at all until a host
 *                     supplies it.
 */
export class NativeTradeWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.mode = hooks.mode ?? 'Buy';
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seams
    this.localScroll = 0;
    this.remoteScroll = 0;
    this.lastPrice = null;
    // THE TWO STAGING COLLECTIONS. In Buy mode the basket holds what
    // you have picked off the shelf; in every other mode `staged` is
    // the remote list itself, which starts EMPTY and fills as you
    // click. They are separate fields rather than one because Buy
    // shows its basket in the LOCAL list (:677-686) and the others
    // show theirs in the remote one - the same collection would have
    // to be drawn on both sides depending on mode.
    this.basket = [];
    this.staged = [];
    this.box = null;             // the confirm / refusal box, when one is up
    this._icon = makeIconDrawer(hooks.icons, () => hooks.entity);   // the shared scroller's warm cache
  }

  /** The collection the cost strip totals (:430, :453). */
  get stagedForCost() { return this.mode === 'Buy' ? this.basket : this.staged; }

  /** FilterLocalItems (:672-703): the basket FIRST in Buy mode, then
   *  the pack narrowed by the mode's own gate. */
  localList() {
    const pack = (this.hooks.packItems?.() ?? []).filter((it) => localListAccepts(this.mode, it, {
      accepts: this.hooks.accepts, enchanted: this.hooks.enchanted,
    }));
    return this.mode === 'Buy' ? [...this.basket, ...pack] : pack;
  }

  /** The remote list: the shelf in Buy mode, the staged lot otherwise. */
  remoteList() { return this.mode === 'Buy' ? (this.hooks.shelfItems?.() ?? []) : this.staged; }

  /** UpdateCostAndGold (:425-489) - the strip's number and whether the
   *  mode action is live, from one walk. */
  cost() {
    return tradeCost(this.mode, this.stagedForCost, {
      ...(this.hooks.priceCtx?.() ?? {}),
      isBeingRepaired: this.hooks.isBeingRepaired ?? (() => false),
    });
  }

  _move(item, from, to) {
    const i = from.indexOf(item);
    if (i >= 0) from.splice(i, 1);
    to.push(item);
  }

  /** TEXT.RSC rows through the macro table. The trade records quote
   *  the SHOP, the CITY and the PRICE back at the player - "%cpn
   *  prides itself on having the lowest prices in %cn ... I can sell
   *  for no less than %a gold pieces" - and every one of the three was
   *  printing raw until U40's live probe read the box off the real
   *  game. %a is the PRICE, so this is not cosmetic. */
  _rows(id, amount = null) {
    return (this.hooks.rows?.(id) ?? []).map((r) => ({
      ...r,
      text: expandGuildMacros(r.text, {
        amount,
        gold: this.hooks.gold?.() ?? 0,
        shopName: this.hooks.shopName ?? '',
        cityName: this.hooks.cityName?.() ?? '',
        playerName: this.hooks.entity?.name ?? '',
      }),
    }));
  }

  _refuse(refusal) {
    const rows = (id) => this._rows(id);
    const text = {
      magic: rows(MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID),
      undamaged: rows(DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID),
      notRepairable: [{ text: CANNOT_BE_REPAIRED_TEXT, center: true }],
      identified: [{ text: DOESNT_NEED_IDENTIFY, center: true }],
    }[refusal] ?? [];
    this.box = { rows: text.length ? text : [{ text: '...', center: true }], buttons: null };
  }

  /** TransferItem's own guards (DaggerfallInventoryWindow.cs:1464-
   *  1494). DaggerfallTradeWindow EXTENDS the inventory window and
   *  every staging arm reaches the list by calling TransferItem
   *  (:795, :817, :823, :826), so a staged item passes exactly the
   *  gates a dropped one does: a SUMMONED item cannot leave the pack,
   *  and neither can a quest item the player is not allowed to drop.
   *  Both refusals raise the one "You cannot remove this item." box.
   *  `from` is localItems at every one of those calls and the remote
   *  side is the staged lot, never the wagon. */
  _refuseTransfer(item) {
    const refused = isSummoned(item) || questTransferRefused(item, {
      fromLocal: true, toWagon: false, getQuest: this.hooks.getQuest ?? null,
    });
    if (!refused) return false;
    this.box = { rows: [{ text: CANNOT_REMOVE_ITEM_TEXT, center: true }], buttons: null };
    return true;
  }

  /** LocalItemListScroller_OnItemClick (:788-826), through the law. */
  _pickLocal(slot) {
    const item = this.localList()[this.localScroll + slot];
    if (!item) return;
    const d = localClickDecision(this.mode, item, {
      inBasket: (i) => this.basket.includes(i),
      allowMagicRepairs: this.hooks.allowMagicRepairs ?? false,
      usingIdentifySpell: this.hooks.usingIdentifySpell ?? false,
      // PlayerEntity.WagonItems / PlayerEntity.Items.GetItem (:789-793)
      // are read straight off the entity here, as DFU reads them off
      // the singleton - they are not the window's collections.
      wagonLoaded: (this.hooks.entity?.wagonItems ?? []).length > 0,
      usedWagon: (this.hooks.entity?.items ?? []).find(
        (i) => i.group === 'Transportation' && i.templateIndex === SMALL_CART_TEMPLATE) ?? null,
    });
    if (d.kind === 'stage') {
      if (this._refuseTransfer(item)) return;
      // TransferItem's LIGHT arm (DaggerfallInventoryWindow.cs:1506-
      // 1508). `from` is localItems at every staging call here
      // (:795, :817, :823, :826), so staging a LIT torch or lantern
      // for sale, repair or identification puts it out - the player
      // does not keep the light, or its burn, from an item now sitting
      // on the merchant's side of the counter.
      extinguishTransferred(this.hooks.entity, item);
      this._move(item, this.hooks.packItems(), this.staged);
      return;
    }
    // Buy: a basket item clicks back OUT to the shelf (:800-801)
    if (d.kind === 'unstage') { this._move(item, this.basket, this.hooks.shelfItems()); return; }
    if (d.kind === 'refuse') this._refuse(d.refusal);
  }

  /** RemoteItemListScroller_OnItemClick (:833-860). In Buy mode a
   *  shelf item goes to the BASKET; in every other mode a staged item
   *  comes back OUT of the deal. */
  _pickRemote(slot) {
    const item = this.remoteList()[this.remoteScroll + slot];
    if (!item) return;
    if (this.mode === 'Buy') {
      // `TransferItem(item, remoteItems, basketItems, CanCarryAmount(item), ...)`
      // (DaggerfallTradeWindow.cs:842). The BASKET is weighed like the
      // pack: CanCarryAmount (DaggerfallInventoryWindow.cs:1414-1423)
      // measures against GetCarriedWeight(), which THIS window
      // overrides to `PlayerEntity.CarriedWeight + basketItems
      // .GetWeight()` (:630-633) - so the gate tightens as the basket
      // fills, and a lot that would put the player over MaxEncumbrance
      // cannot be staged at all. Zero fit refuses with the
      // cannotCarryAnymore box; a partial fit splits (:1514-1538,
      // the popup defaulted to maxAmount - the port takes exactly
      // what fits, as the inventory window's remote arm does).
      const canCarry = this._canCarryAmount(item);
      if (canCarry <= 0) return;
      if (canCarry < (item.stackCount ?? 1)) {
        item.stackCount -= canCarry;
        this.basket.push({ ...item, stackCount: canCarry });
        return;
      }
      this._move(item, this.hooks.shelfItems(), this.basket);
      return;
    }
    this._move(item, this.staged, this.hooks.packItems());
  }

  /** CanCarryAmount (DaggerfallInventoryWindow.cs:1414-1423) over this
   *  window's own GetCarriedWeight (:630-633). No weight seam mounted
   *  = no capacity to read, so the gate stands open - the same answer
   *  the inventory window's gives a host with no entity. */
  _canCarryAmount(item) {
    const w = this.hooks.weight?.();
    if (!w) return item.stackCount ?? 1;
    const canCarry = canHoldAmount(item.stackCount ?? 1, effectiveUnitWeightInKg(item),
      w.maxEncumbranceKg ?? 0, (w.carriedWeightKg ?? 0) + totalWeight(this.basket));
    if (canCarry <= 0) this.box = { rows: [{ text: CANNOT_CARRY_TEXT, center: true }], buttons: null };
    return canCarry;
  }

  /** ClearSelectedItems (:589-599, :613-625) - everything staged goes
   *  back where it came from. The Clear button is one caller
   *  (ClearButton_OnMouseClick :1020-1025); OnPop is the other. */
  _clear() {
    if (this.mode === 'Buy') {
      while (this.basket.length) this._move(this.basket[0], this.basket, this.hooks.shelfItems());
    } else {
      while (this.staged.length) this._move(this.staged[0], this.staged, this.hooks.packItems());
    }
  }

  /** OnPop (:404-407): `ClearSelectedItems()`, unconditionally,
   *  whenever this window is popped - NOT only when the Clear button
   *  is pressed. In Buy mode that returns the whole basket to the
   *  merchant (:589-599), so items picked off a shelf and then walked
   *  away from go BACK on the shelf; in the staging modes it returns
   *  the staged lot to the pack (:613-625), which is DFU's own
   *  "priority is to not lose any items".
   *
   *  Without this the port DESTROYED whatever had been clicked: the
   *  basket left the shelf array at the click (_pickRemote) and the
   *  window was simply dropped by the host's done-drain, so a player
   *  could empty a shop's shelf by clicking and closing. */
  onPop() { this._clear(); }

  /** The host frees a finished overlay through `dispose?.()` (the
   *  done-drain), which is where this port pops. Idempotent - _clear
   *  over an already-empty basket moves nothing - so the explicit
   *  close paths below can pop too without double-returning. */
  dispose() { this.onPop(); }

  /** Every path that closes this window pops it (DFU's CloseWindow ->
   *  OnPop), so the staging is returned before the window goes. */
  _close() { this.onPop(); this.done = true; }

  /** DoModeAction -> ShowTradePopup (:954-998, :1100-1134). */
  _modeAction() {
    const { cost, modeActionEnabled } = this.cost();
    if (!modeActionEnabled) return;          // DFU disables the button outright
    const ctx = this.hooks.priceCtx?.() ?? {};
    const price = getTradePrice(this.mode, cost, ctx.quality ?? 0, ctx.skills ?? {});
    const d = tradeDecision(this.mode, { cost, tradePrice: price, gold: this.hooks.gold() });
    if (d.kind === 'notEnoughGold') {
      // the two records CONCATENATED into one click-anywhere box
      this.box = { rows: d.textIds.flatMap((id) => this._rows(id, price)), buttons: null };
      return;
    }
    this.box = { rows: this._rows(d.textId, price), buttons: 'YesNo', price, cost, onYes: () => this._confirm(price) };
  }

  /** ConfirmTrade_OnButtonClick's Yes arm (:1027-1092). */
  _confirm(price) {
    const selling = this.mode === 'Sell' || this.mode === 'SellMagic';
    const proceeds = selling
      ? sellProceeds(price, this.hooks.weight?.() ?? {})
      : null;
    this.hooks.commit?.(this.mode, [...this.stagedForCost], price, proceeds);
    this.basket.length = 0;
    this.staged.length = 0;
    this.lastPrice = price;
    // "a concluded deal clinks" - and a LETTER OF CREDIT scratches
    // instead (:1084-1087), which is the one place that sound is used.
    audio.playOneShot(proceeds?.kind === 'letterOfCredit' ? SOUND.ParchmentScratching : SOUND.GoldPieces, 1);
    this.localScroll = 0;
    this.remoteScroll = 0;
    // ...and it is ANNOUNCED (:1092-1093). T2: the port minted the
    // letter and scratched the parchment but said nothing, so a sale
    // made while overloaded looked to the player like a sale that had
    // silently failed - the gold simply did not move.
    //
    // The ORDER is DFU's. A bare `CloseWindow()` in a message-box
    // handler pops the TOP window (UserInterfaceWindow.cs:127-132),
    // which at that moment is the CONFIRM box, not the trade window -
    // so DFU dismisses the confirmation and raises the letter's box
    // over a trade screen that is still open. _dismissBox has already
    // nulled `this.box` before it calls onYes, so writing the box here
    // is exactly that sequence.
    if (proceeds?.kind === 'letterOfCredit') {
      this.box = { rows: [{ text: LETTER_OF_CREDIT_TEXT, center: true }], buttons: null };
    }
  }

  _dismissBox(button = null) {
    const b = this.box;
    this.box = null;
    if (b?.buttons === 'YesNo' && button === MB_BUTTONS.Yes) b.onYes?.();
  }

  input(code) {
    if (this.box) {
      if (this.box.buttons === 'YesNo') {
        if (code === 'KeyY') this._dismissBox(MB_BUTTONS.Yes);
        else if (code === 'KeyN' || code === 'Escape') this._dismissBox(MB_BUTTONS.No);
      } else this._dismissBox();
      return;
    }
    if (code === 'Escape' || code === 'KeyE') { this._close(); return; }
    // The port's own accelerators (Ledger A - DFU reads DaggerfallShortcut):
    // Enter commits the deal rather than closing, which is what the
    // mode-action button is for and what a keyboard player expects.
    if (code === 'Enter') { this._modeAction(); return; }
    if (code === 'KeyC') { this._clear(); return; }
    const d = /^Digit([1-4])$/.exec(code);   // digits stage the visible remote slots
    if (d) this._pickRemote(Number(d[1]) - 1);
    // AUDIT 18: KeyN had no upper clamp, so the keyboard alone could
    // drive the shelf list past its end into a blank panel. Route both
    // through the shared ItemListScroller clamp (DFU sends every scroll
    // index through VerticalScrollBar.SetScrollIndex, which bounds it
    // to [0, totalUnits - displayUnits]), exactly as nativeInventory does.
    if (code === 'KeyN') this.remoteScroll = applyScroll(this.remoteScroll, 'down', this.remoteList().length);
    if (code === 'KeyP') this.remoteScroll = applyScroll(this.remoteScroll, 'up', this.remoteList().length);
  }

  click(vx, vy) {
    if (this.box) {
      if (this.box.buttons === 'YesNo') {
        const hit = this._boxLayout ? messageBoxHit(this._boxLayout, vx, vy) : null;
        if (hit !== null) this._dismissBox(hit);
      } else this._dismissBox();
      return true;
    }
    const R = TRADE_RECTS;
    if (inRect(R.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }   // every trade button clicks (:887-1022)
    if (inRect(R.modeAction, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._modeAction(); return true; }
    if (inRect(R.clear, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._clear(); return true; }
    for (const [rect, which, items, pick] of [
      [R.remoteList, 'remoteScroll', this.remoteList(), (s) => this._pickRemote(s)],
      [R.localList, 'localScroll', this.localList(), (s) => this._pickLocal(s)],
    ]) {
      const hit = scrollerHit(rect, vx, vy);
      if (!hit) continue;
      if (hit.kind === 'slot') pick(hit.slot);
      else this[which] = applyScroll(this[which], hit.kind, items.length);
      return true;
    }
    // the remaining action-panel buttons (wagon/info/select/steal)
    // are consumed no-ops - each waits on its own slice
    return inRect(R.actionPanel, vx, vy) || inRect(R.costPanel, vx, vy);
  }

  _drawIcon(renderer, m, it, rect, slot) { return this._icon(renderer, m, it, rect, slot); }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // AUDIT 19 F2: OPAQUE BLACK, not a dim. DaggerfallBaseWindow's
    // constructor sets `parentPanel.BackgroundColor = Color.black`
    // (DaggerfallBaseWindow.cs:40) - ScreenDimColor is used only by the
    // handful of windows that explicitly override it, and this is not one.
    // Drawing a 50% dim here left the letterbox showing the world at half
    // brightness around the panel, which is the SAME defect U21 fixed for
    // the menu, U21b for chargen and U22 for the splash. Fourth, fifth and
    // sixth instance; one shared helper now.
    // AUDIT 24 ui: this window's Setup assigns
    // `ParentPanel.BackgroundColor = ScreenDimColor` (DaggerfallTradeWindow.cs:199),
    // which is Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art.base, m, 0, 0);
    const R = TRADE_RECTS;
    // The mode's own panel (:213) - Inventory mode has none, and the
    // guard is DFU's, not a defensive extra.
    const panel = modeActionPanel(this.mode);
    if (panel) drawImg(renderer, panel, m, R.actionPanel[0], R.actionPanel[1]);
    drawImg(renderer, _art.cost, m, R.costPanel[0], R.costPanel[1]);
    // The strip shows the LIVE total of what is staged, re-totalled
    // every frame the way Refresh -> UpdateCostAndGold re-totals it -
    // not the last concluded price, which is what the pre-mode-flow
    // window had to show because it transacted at the click.
    shadowText(renderer, font, String(this.cost().cost), m, R.costPanel[0] + 28, R.costPanel[1] + 2);
    shadowText(renderer, font, String(this.hooks.gold()), m, R.costPanel[0] + 68, R.costPanel[1] + 2);
    for (const [rect, scroll, items] of [
      [R.remoteList, this.remoteScroll, this.remoteList()],
      [R.localList, this.localScroll, this.localList()],
    ]) {
      items.slice(scroll, scroll + LIST_SLOTS).forEach((it, s) => {
        this._drawIcon(renderer, m, it, rect, s);
        drawStackLabel(renderer, _art?.font4 ?? font, m, it, rect, s);
      });
    }
    // The confirm / refusal box sits OVER the panel - DFU pushes it as
    // its own window and the trade screen stays behind it, which is
    // why this draws last and the window is not closed to show it.
    if (this.box) {
      const buttons = this.box.buttons === 'YesNo' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._boxLayout = layoutMessageBox(font, this.box.rows, buttons);
      drawMessageBox(renderer, m, font, this._boxLayout);
    } else this._boxLayout = null;
  }
}
