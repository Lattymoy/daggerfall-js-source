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
import { LIST_SLOTS, CELL_X, CELL_W, SLOT_H, ARROW_H, DOWN_ARROW_Y, scrollerHit, applyScroll, makeIconDrawer, drawStackLabel,
  preloadScrollerArrowArt, drawScrollerArrows, drawScrollerThumb, playScrollerArrowClick, makeSlotToolTip } from './itemScroller.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from './text.js';
import { planTake, applyTransfer, clearLightSourceOnLeave } from '../systems/itemTransfer.js';   // AUDIT 26 F157/F158
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import {
  MODE_ACTION_ART, SELL_GOLD_ART, modeActionArt,
  tradeCost, getTradePrice, tradeDecision, sellProceeds,
  localListAccepts, localClickDecision, DOESNT_NEED_IDENTIFY, LETTER_OF_CREDIT_TEXT,
  MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID, DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID,
} from '../systems/tradeModes.js';
import { CANNOT_BE_REPAIRED_TEXT, INTERRUPT_REPAIR_TEXT, isBeingRepaired as itemIsBeingRepaired,
  isRepairFinished, collectRepaired } from '../systems/repairService.js';   // D7: the Repair mode's remote arm
import { isSummoned } from '../systems/inventory.js';   // TransferItem's summoned guard
import { CANNOT_REMOVE_ITEM_TEXT } from '../systems/createItem.js';   // both TransferItem refusals speak it
import { questTransferRefused, SMALL_CART_TEMPLATE } from './nativeInventory.js';   // DaggerfallTradeWindow EXTENDS the inventory window
import { expandGuildMacros } from '../systems/guildServiceActions.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table

/** A8: the mode action button's Hotkey is chosen by the WINDOW MODE
 *  (:325-344) - one button, four letters. Inventory mode assigns none
 *  ("Shouldn't happen"), and Sell and SellMagic share TradeSell. */
const MODE_ACTION_BUTTON = Object.freeze({
  Buy: 'TradeBuy', Identify: 'TradeIdentify', Repair: 'TradeRepair',
  Sell: 'TradeSell', SellMagic: 'TradeSell',
});

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
    await preloadScrollerArrowArt(deps);   // ROAD-A7: the red/green arrow strips
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
 *   packItems()    -> PlayerEntity.Items, the LIVE collection (:389).
 *                     D7: not a filtered view - a click TRANSFERS out
 *                     of it, so it must be spliceable. The equipped
 *                     test is this window's, in localList.
 *   isEquipped(it) -> FilterLocalItems' `!item.IsEquipped` (:693)
 *   otherItems()   -> PlayerEntity.OtherItems, the REPAIR mode's
 *                     remoteItems (:392) - the in-repair collection
 *   repairItems()  -> FilterRemoteItems' Repair arm (:705-724) over
 *                     that collection, which the port's repair law
 *                     already owns (repairService.repairJobsAt)
 *   nowMinutes()   -> the clock the repair arm's IsRepairFinished reads
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
    // D7: the window's shared ToolTip - one tip, both lists, exactly
    // as ItemListScroller hands `toolTip` to every item button it
    // builds (:340). Its text is ResolveItemLongName (:464), which is
    // the only thing on this screen that names what is in a slot.
    this._tip = makeSlotToolTip();
  }

  /** DaggerfallBaseWindow's defaultToolTip rest clock. */
  tick(dt) { this._tip.update(dt); }

  /** The item under the cursor on either list. The hit-test is
   *  scrollerHit's - the same one the click uses - so the tip can
   *  never name a slot a click would miss. */
  _itemAt(vx, vy) {
    for (const [rect, scroll, items] of [
      [TRADE_RECTS.remoteList, this.remoteScroll, this.remoteList()],
      [TRADE_RECTS.localList, this.localScroll, this.localList()],
    ]) {
      const hit = scrollerHit(rect, vx, vy, scroll, items.length);
      if (hit?.kind === 'slot') return items[scroll + hit.slot] ?? null;
      if (hit) return null;
    }
    return null;
  }

  /** The pointer over the panel. A box is up = no tip: DFU's message
   *  box is a window of its own pushed OVER this one, and the buttons
   *  underneath stop getting mouse events at all. */
  hover(vx, vy) {
    if (this.box || vx < 0 || vy < 0) { this._tip.hide(); return; }
    this._tip.show(this._itemAt(vx, vy), vx, vy, { getQuest: this.hooks.getQuest ?? null });
  }

  /** remoteItems (:392). In REPAIR mode DFU points it at
   *  PlayerEntity.OtherItems - the shop-side in-repair collection -
   *  and in every other mode at merchantItems, which on this side is
   *  the window's own staged lot. Everything that stages, unstages or
   *  clears goes through here, so the Repair mode moves real items
   *  into the real collection the repair law reads back. */
  get remoteItems() { return this.mode === 'Repair' ? (this.hooks.otherItems?.() ?? this.staged) : this.staged; }

  /** The collection the cost strip totals (:430, :453). UpdateCostAndGold
   *  walks `basketItems` in Buy mode and `remoteItems` in every other -
   *  and in Repair that walk skips anything already being repaired
   *  (:466-471), which is the same cut FilterRemoteItems makes, so the
   *  filtered list and the raw collection agree on the number. */
  get stagedForCost() {
    if (this.mode === 'Buy') return this.basket;
    return this.mode === 'Repair' ? this.remoteList() : this.staged;
  }

  /** FilterLocalItems (:672-703): the basket FIRST in Buy mode, then
   *  the pack narrowed by the mode's own gate.
   *
   *  AUDIT 39 F102: and MINUS what is already staged. DFU's list needs
   *  no such test because TransferItem physically moves the clicked
   *  item out of localItems (PlayerEntity.Items, the live collection)
   *  the moment it is staged. A host that hands `packItems` a FILTERED
   *  VIEW cannot be spliced, so the staged lot is a SELECTION over a
   *  pack that still holds the item - and without this the same item
   *  stayed in the list, staged again on the next click, and the cost
   *  strip paid for it once per click. The test is harmless against a
   *  host that does hand over the live array: the item is gone from
   *  the pack by then and matches nothing. */
  localList() {
    // D7: `!item.IsEquipped` is the WINDOW's test in DFU and it is
    // applied TWICE - once to the basket (:697) and once to the pack
    // (:693) - because Buy mode lets the player equip out of the
    // basket while shopping. The host used to make the cut on its
    // side, which meant handing over a fresh FILTERED array that
    // could not be spliced; with the test here the host hands the
    // live PlayerEntity.Items and a click TRANSFERS, as DFU does.
    const equipped = this.hooks.isEquipped ?? (() => false);
    const staged = this.remoteItems;
    const pack = (this.hooks.packItems?.() ?? []).filter((it) => !equipped(it) && localListAccepts(this.mode, it, {
      accepts: this.hooks.accepts, enchanted: this.hooks.enchanted,
    }) && !staged.includes(it));
    return this.mode === 'Buy' ? [...this.basket.filter((it) => !equipped(it)), ...pack] : pack;
  }

  /** FilterRemoteItems (:704-727): the shelf in Buy mode, the in-repair
   *  collection NARROWED in Repair mode, and the staged lot otherwise.
   *
   *  D7 - the Repair arm. DFU keeps an item only if it is not being
   *  repaired at all or is being repaired HERE (a job left at another
   *  shop is invisible from this counter), and heals any job whose
   *  time is up on the way past. That walk is repairService's
   *  repairJobsAt, character for character, so the host hands it in
   *  rather than the window growing a second copy.
   *
   *  RECORDED: FilterRemoteItems ends with `UpdateRepairTimes(false)`
   *  (:725), the ESTIMATE pass, and this does not run it. That pass
   *  exists for exactly one reader - RepairItemLabelTextHandler's
   *  "%d days" MISC LABEL (:282-288), which is an ItemListScroller
   *  label template the port's shared scroller does not draw (icon,
   *  stack count and tooltip only). Running it here would also run it
   *  per FRAME rather than per Refresh, and its clamp never decreases,
   *  so the estimate would ratchet. The keyed collect list computes
   *  the same number on demand through repairStatusLabel; when the
   *  misc label lands, it does the same. */
  remoteList() {
    if (this.mode === 'Buy') return this.hooks.shelfItems?.() ?? [];
    if (this.mode === 'Repair') return this.hooks.repairItems?.() ?? this.remoteItems;
    return this.staged;
  }

  /** UpdateCostAndGold (:425-489) - the strip's number and whether the
   *  mode action is live, from one walk. */
  cost() {
    return tradeCost(this.mode, this.stagedForCost, {
      ...(this.hooks.priceCtx?.() ?? {}),
      // AUDIT 39 F144: the SPELL's window is the one that reaches
      // UpdateCostAndGold's "Identify spell remains free" line
      // (:479-481), and priceCtx is the host's PRICE context - it
      // carries no window flags, so the guard read its own default
      // and the spell was billed the paid service's price.
      usingIdentifySpell: this.hooks.usingIdentifySpell ?? false,
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
      // AUDIT 26 F157: TransferItem :1506-1508 - staging a LIT torch
      // for sale douses it; from is localItems on every staging arm.
      clearLightSourceOnLeave(item, this.hooks.entity, true);
      this._move(item, this.hooks.packItems(), this.remoteItems);
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
      // AUDIT 26 F158: DFU's Buy-mode remote click transfers shelf to
      // basket through TransferItem with maxAmount =
      // CanCarryAmount(item) (DaggerfallTradeWindow.cs:842): no
      // capacity refuses with "cannot carry any more", a partial fit
      // SPLITS the stack (:1414-1422). The port moved whole lots with
      // no gate, so a player could stage and buy past MaxEncumbrance
      // through the shop screen. The bag under test is pack + basket -
      // the player walks out with both.
      const plan = planTake(item, {
        bag: [...this.hooks.packItems(), ...this.basket],
        entity: this.hooks.entity ?? null,
      });
      if (!plan.ok) { this.box = { rows: [{ text: plan.refusal?.text ?? 'You cannot carry any more.', center: true }], buttons: null }; return; }
      applyTransfer(item, plan, this.hooks.shelfItems(), this.basket);
      return;
    }
    // D7 - the REPAIR arm (:842-853). A job still under way is not
    // simply taken back: it raises ConfirmInterruptRepairBox first,
    // and only Yes reaches TakeItemFromRepair. A finished job, or one
    // that was never booked (staged this visit, or instantly
    // repaired), comes straight back.
    if (this.mode === 'Repair') {
      const now = this.hooks.nowMinutes?.() ?? 0;
      if (itemIsBeingRepaired(item) && !isRepairFinished(item, now)) {
        this.box = {
          rows: [{ text: INTERRUPT_REPAIR_TEXT, center: true }],
          buttons: 'YesNo',
          onYes: () => this._takeItemFromRepair(item),
        };
        return;
      }
      this._takeItemFromRepair(item);
      return;
    }
    this._move(item, this.remoteItems, this.hooks.packItems());
  }

  /** TakeItemFromRepair (:857-862): the item comes back to the pack
   *  and its repair record leaves whole - an interrupted job is
   *  partial and UNREFUNDED, which is the whole point of the confirm. */
  _takeItemFromRepair(item) {
    this._move(item, this.remoteItems, this.hooks.packItems());
    collectRepaired(item);
  }

  /** ClearSelectedItems (:589-627) - everything staged goes back
   *  where it came from. Three arms, and the third is not the same as
   *  the second: Buy returns the basket to the merchant, REPAIR
   *  returns only what is not actively under way (Collect()ing each as
   *  it goes), and every other mode returns the whole remote lot to
   *  the player - "ignoring weight here, like classic. Priority is to
   *  not lose any items."
   *
   *  D7: this is also OnPop (:404-407), so it runs when the window
   *  CLOSES as well as when the Clear button is pressed. That is what
   *  makes the live-array transfer safe - walking out of a shop with
   *  goods staged puts them back in the pack rather than dropping them
   *  on the floor of a collection nobody reads. */
  _clear() {
    if (this.mode === 'Buy') {
      while (this.basket.length) this._move(this.basket[0], this.basket, this.hooks.shelfItems());
      return;
    }
    if (this.mode === 'Repair') {
      const now = this.hooks.nowMinutes?.() ?? 0;
      for (const it of [...this.remoteList()]) {
        if (itemIsBeingRepaired(it) && !isRepairFinished(it, now)) continue;
        this._takeItemFromRepair(it);
      }
      return;
    }
    const remote = this.remoteItems;
    while (remote.length) this._move(remote[0], remote, this.hooks.packItems());
  }

  /** CloseWindow -> OnPop (:404-407). Every exit from this screen is
   *  DFU's window pop, and the pop clears the selection. */
  _close() {
    this._clear();
    this.done = true;
  }

  /** DoModeAction -> ShowTradePopup (:954-998, :1100-1134). */
  _modeAction() {
    const { cost, modeActionEnabled } = this.cost();
    if (!modeActionEnabled) return;          // DFU disables the button outright
    // AUDIT 39 F144: DoModeAction opens on the SPELL (:955-995) and
    // ShowTradePopup is its ELSE. The spell pays in magicka, rolls per
    // item and prints the tally - no gold price is computed, no Yes/No
    // is raised, and a penniless caster is never refused. The host's
    // commit carries that whole pass (its magicka refusal answers
    // false, which leaves the lot staged as DFU's early return does).
    if (this.hooks.usingIdentifySpell) { this._castIdentifySpell(); return; }
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

  /** DoModeAction's SPELL arm (:955-995). ClearSelectedItems + Refresh
   *  close it, which here is the staged lot going back to the pack -
   *  the goods never physically left it (the selection shape, see
   *  localList). No coins clink: the sound belongs to ConfirmTrade,
   *  which this path never reaches. */
  _castIdentifySpell() {
    if (this.hooks.commit?.(this.mode, [...this.staged], 0, null) === false) return;
    // "Transfer all items back to player" (:992) IS ClearSelectedItems,
    // and D7 made that a real move rather than a list reset: the goods
    // left the pack at the click, so dropping the references here
    // would have destroyed them.
    this._clear();
    this.localScroll = 0;
    this.remoteScroll = 0;
  }

  /** ConfirmTrade_OnButtonClick's Yes arm (:1027-1092). */
  _confirm(price) {
    const selling = this.mode === 'Sell' || this.mode === 'SellMagic';
    const proceeds = selling
      ? sellProceeds(price, this.hooks.weight?.() ?? {})
      : null;
    this.hooks.commit?.(this.mode, [...this.stagedForCost], price, proceeds);
    // D7 - ConfirmTrade clears PER MODE, and two of the four clear
    // nothing at all (:1027-1090). Buy does `PlayerEntity.Items
    // .TransferAll(basketItems)`, Sell/SellMagic `remoteItems.Clear()`;
    // REPAIR and IDENTIFY leave the remote lot exactly where it is -
    // the booked jobs stay with the shop and the rest goes back through
    // OnPop's ClearSelectedItems when the player walks out. Zeroing
    // both collections here dropped an identified amulet on the floor
    // the moment the goods stopped being a selection over the pack.
    if (this.mode === 'Buy') this.basket.length = 0;
    else if (selling) this.staged.length = 0;
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

  input(code, e = null) {
    if (this.box) {
      if (this.box.buttons === 'YesNo') {
        if (code === 'KeyY') this._dismissBox(MB_BUTTONS.Yes);
        else if (code === 'KeyN' || code === 'Escape') this._dismissBox(MB_BUTTONS.No);
      } else this._dismissBox();
      return;
    }
    if (code === 'Escape') { this._close(); return; }
    // Enter commits the deal rather than closing - the port's own
    // accelerator, kept; DFU has no Return arm on this screen.
    if (code === 'Enter') { this._modeAction(); return; }
    // A8: the rest are DaggerfallShortcut's, read from the table
    // (DaggerfallTradeWindow.cs:249 exit, :323-345 the mode action -
    // whose LETTER is the window mode's, :348 clear). The four
    // action-panel buttons this port consumes as no-ops (wagon, info,
    // select, steal) carry no key here for the same reason they carry
    // no click: each waits on its own slice, and a live key onto a
    // dead button is worse than a quiet one.
    const action = MODE_ACTION_BUTTON[this.mode] ?? null;   // Inventory mode assigns none ("Shouldn't happen")
    const hit = firstHotkey(['TradeExit', ...(action ? [action] : []), 'TradeClear'], code, e);
    if (hit === 'TradeExit') { this._close(); return; }
    if (hit === 'TradeClear') { this._clear(); return; }
    if (hit) { this._modeAction(); return; }
    const d = /^Digit([1-4])$/.exec(code);   // digits stage the visible remote slots (the port's own)
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
      // AUDIT 39 F126: the rail pages off the live thumb, so the hit
      // needs this list's scroll index and length.
      const hit = scrollerHit(rect, vx, vy, this[which], items.length);
      if (!hit) continue;
      if (hit.kind === 'slot') pick(hit.slot);
      else { playScrollerArrowClick(hit.kind); this[which] = applyScroll(this[which], hit.kind, items.length); }   // ROAD-A7: the two arrows click
      return true;
    }
    // the remaining action-panel buttons (wagon/info/select/steal)
    // are consumed no-ops - each waits on its own slice
    return inRect(R.actionPanel, vx, vy) || inRect(R.costPanel, vx, vy);
  }

  _drawIcon(renderer, m, it, rect, slot) { return this._icon(renderer, m, it, rect, slot); }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }   // D7: an art-less bail is still a POP - the selection goes home
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
      // ROAD-A7: the arrows' red/green states and the art thumb.
      drawScrollerArrows(renderer, m, rect, scroll, items.length);
      drawScrollerThumb(renderer, m, rect, scroll, items.length);
    }
    // The confirm / refusal box sits OVER the panel - DFU pushes it as
    // its own window and the trade screen stays behind it, which is
    // why this draws last and the window is not closed to show it.
    if (this.box) {
      const buttons = this.box.buttons === 'YesNo' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._boxLayout = layoutMessageBox(font, this.box.rows, buttons);
      drawMessageBox(renderer, m, font, this._boxLayout);
    } else this._boxLayout = null;
    this._tip.draw(renderer, m, font);   // D7: last, over the panel and the box
  }
}
