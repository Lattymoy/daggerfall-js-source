// ═══════════════════════════════════════════════════════════════════
// U56 — TransferItem, IN ONE PLACE.
//
// DaggerfallInventoryWindow.cs has ONE TransferItem with several
// callers; the port had it as METHODS ON A WINDOW, which was fine
// while exactly one window did transfers and stops being fine the
// moment a second screen needs the same law. The choice at that point
// is to extract it or to copy it, and this port does not copy law -
// Port-Doctrine's translation rule allows simplification in structure
// and never in behaviour, and the audit24_onehome ratchet exists for
// precisely the other outcome.
//
// ── DECISIONS HERE, PRESENTATION THERE ───────────────────────────
//
// What a window does with a refusal - a parchment box, a DOM notice -
// is that window's business, and so is which sound plays. What is NOT
// is the LADDER: which guard fires first, whether a refusal is silent,
// how much of a stack fits, and what happens to the stack that does
// not. Those are DFU's, they carry four audits between them, and they
// are what lives in this file.
//
// So `planStore` and `planTake` are PURE - they read lists and answer
// what should happen - and `applyTransfer` performs the one part that
// is still law rather than presentation: the split.
//
// ── THE GUARDS, IN DFU'S OWN ORDER ───────────────────────────────
//
// TransferItem's first statement is the TRANSPORT block
// (:1460-1462), and it is SILENT - above the click sound, which
// DoTransferItem plays further down. A horse or cart can never leave
// the pack this way, and the port's own cart test reads the bag, so
// dropping the cart into its own wagon locked the player out of the
// wagon now holding it (AUDIT 24 ui).
//
// Its SECOND statement (:1464-1469) refuses a SUMMONED item, and that
// one SPEAKS, because DFU's does. Without it a conjured cuirass could
// be sold to a shopkeeper an hour before it vanished from their stock
// (X11b).
// ═══════════════════════════════════════════════════════════════════

import {
  addItem, canHoldAmount, effectiveUnitWeightInKg, totalWeight, isSummoned,
  splitStack, GOLD_PIECE_WEIGHT_KG, goldPiecesOf, addGoldPieces, isGoldPieces,
} from './inventory.js';
import { isMap, isLightSource } from './useItem.js';   // AUDIT 26 F156/F157: the map interception + the lit-torch clear
import { CANNOT_REMOVE_ITEM_TEXT } from './createItem.js';
// AUDIT 26: DaggerfallEntity.MaxEncumbrance, enchantment allowance and
// all - :1417 reads playerEntity.MaxEncumbrance, not the bare formula.
import { entityMaxEncumbrance } from '../combat/formulas.js';
import { makeItemPermanent } from './quest/item.js';   // TransferItem's MakePermanent arm (:1502-1504)
import { getBool } from './settings.js';   // GUI/CanDropQuestItems

/** ItemHelper.WagonKgLimit (:56). */
export const WAGON_KG_LIMIT = 750;
/** Internal_Strings.csv:828-829, verbatim - these ship in Unity-side
 *  localization rather than TEXT.RSC, and the rows are in the
 *  reference tree, the way the sibling row "cannotRemoveItem"
 *  (csv:827) is already taken verbatim at createItem.js's
 *  CANNOT_REMOVE_ITEM_TEXT. The keys are asked for at
 *  DaggerfallInventoryWindow.cs:1431 (cannotHoldAnymore, inside
 *  WagonCanHoldAmount) and :1420 (cannotCarryAnymore, inside
 *  CanCarryAmount). */
export const CANNOT_HOLD_TEXT = 'Your wagon cannot hold any more stuff.';
export const CANNOT_CARRY_TEXT = 'You cannot carry any more stuff.';

/** Why a transfer did not happen, and whether the player is told.
 *  EVERY refusal is silent in the SOUND sense - DFU's guards all
 *  return above DoTransferItem's click - so the only thing that
 *  varies is the box, and `text` is it: null means the click simply
 *  does nothing, which is what DFU's transport block does. */
export const REFUSAL = Object.freeze({
  /** Defensive only: both windows drop a click on an empty slot long
   *  before they reach the ladder. */
  missing: { reason: 'missing', text: null },
  transport: { reason: 'transport', text: null },
  summoned: { reason: 'summoned', text: CANNOT_REMOVE_ITEM_TEXT },
  /** AUDIT 26: the quest arm's refusal shares the summoned one's
   *  words, because DFU pops the same string for both. */
  questItem: { reason: 'questItem', text: CANNOT_REMOVE_ITEM_TEXT },
  chooseOnePile: { reason: 'chooseOnePile', text: null },
  wagonFull: { reason: 'wagonFull', text: CANNOT_HOLD_TEXT },
  cannotCarry: { reason: 'cannotCarry', text: CANNOT_CARRY_TEXT },
  /** The drop-gold field's own refusal, and it is SILENT because DFU's
   *  is: an amount below 1 or above the purse is REFUSED OUTRIGHT
   *  rather than clamped (:1272-1300), and the field simply does not
   *  take it. */
  badAmount: { reason: 'badAmount', text: null },
});

/**
 * TransferItem's QUEST arm (DaggerfallInventoryWindow.cs:1480-1505) as
 * ONE export, because DFU's is one member with THREE callers - the
 * local list's Remove click, the remote list's, and every staging
 * click in DaggerfallTradeWindow, which INHERITS TransferItem and
 * calls it at :795. `fromLocal` is DFU's `from == localItems`;
 * `toWagon` is `remoteTargetType == RemoteTargetTypes.Wagon`.
 *
 * Answers TRUE when the transfer is REFUSED. A legal transfer writes
 * the resource's playerDropped - the only writer of the flag the
 * DroppedItemAtPlace trigger polls - and re-permanents a cloned item
 * that had been made permanent.
 *
 * GetQuestItem (:1642-1656) THROWS on a missing quest or symbol; the
 * port answers null, the same call useItem.js's quest arm makes,
 * because a host with no machine has no quest to find and a stale
 * questUID is not worth a crash. DFU refuses an unresolvable quest
 * item too (:1489), so the null lands on the same side.
 *
 * THIS IS THE ONE RUNG THAT WRITES, which is why `planStore` and
 * `planTake` take a `dryRun` - see there.
 */
export function questTransferRefused(item, { fromLocal, toWagon = false, getQuest = null } = {}) {
  if (!item?.questItem) return false;
  const questItem = getQuest?.(item.questUID)?.getItem?.(item.questSymbol) ?? null;
  // "Player cannot drop most quest items unless enabled" (:1486-1494).
  // GUI/CanDropQuestItems ships False in both codebases.
  if (!getBool('GUI', 'CanDropQuestItems')) {
    if (questItem === null || (!questItem.allowDrop && fromLocal)) return true;
  }
  // Past the gate with no resource to write, C# would NRE on the next
  // line; the port lets the transfer stand and writes nothing.
  if (!questItem) return false;
  // "Dropping or picking up quest item" (:1496-1500) - and the WAGON
  // is not the ground, so stashing a droppable quest item in the cart
  // is not a drop.
  if (questItem.allowDrop && fromLocal && !toWagon) questItem.playerDropped = true;
  else if (!fromLocal) questItem.playerDropped = false;
  // :1502-1504 - a cloned quest item that should be permanent gets its
  // permanent status back.
  if (questItem.madePermanent) makeItemPermanent(item);
  return false;
}

/** key "wagonFullGold" - the drop-gold clamp's box, Internal_Strings.csv:815
 *  verbatim ("Your wagon could only hold {0} gold pieces."), formatted
 *  with wagonCanHold at DaggerfallInventoryWindow.cs:1303. */
export const wagonFullGoldText = (n) => `Your wagon could only hold ${n} gold pieces.`;

/**
 * DropGoldPopup_OnGotUserInput (:1269-1303). The GOLD arm of the same
 * transfer, and it does not behave like the item one: an amount out of
 * range is refused OUTRIGHT and silently, while an amount the WAGON
 * cannot take is CLAMPED with a box that names the headroom.
 *
 * `carried` is the purse (PlayerEntity's gold), passed in rather than
 * read, because a screen holding an entity and a screen holding only
 * an item list both ask this.
 *
 * @returns {{ok:true, amount:number, notice:string|null}
 *          |{ok:false, refusal:object, notice:string|null}}
 */
export function planDropGold(text, { carried = 0, usingWagon = false, remote = [] } = {}) {
  // A numeric field of 8 opening on "0": anything that is not a run of
  // digits is not a number, and 0 fails the range below.
  const asked = /^[0-9]+$/.test(String(text)) ? Number(text) : 0;
  if (asked < 1 || asked > carried) return { ok: false, refusal: REFUSAL.badAmount, notice: null };
  if (!usingWagon) return { ok: true, amount: asked, notice: null };
  // :1296-1303 - the 750kg headroom in COINS, and the box names it.
  const canHold = canHoldAmount(carried, GOLD_PIECE_WEIGHT_KG, WAGON_KG_LIMIT, totalWeight(remote));
  const notice = asked > canHold ? wagonFullGoldText(canHold) : null;
  const amount = Math.min(asked, canHold);
  // A FULL wagon still shows the box - it says "0 more gold", which is
  // the answer - and then nothing moves. DFU would mint a 0 stack
  // here; the port guards it (Ledger A).
  if (amount < 1) return { ok: false, refusal: REFUSAL.wagonFull, notice };
  return { ok: true, amount, notice };
}

/**
 * LOCAL -> REMOTE. The Remove arm's `TransferItem(item, localItems,
 * remoteItems, canHold, true)` (:1999) - the 5th positional is
 * blockTransport.
 *
 * `dryRun` ASKS WITHOUT PERFORMING. Every rung here is pure except
 * AUDIT 26's quest arm, which writes `playerDropped` and re-permanents
 * a clone as it passes - right when a click is being handled, and
 * wrong when a view is only deciding whether to draw a button. A dry
 * run skips that rung, and skipping it can never change such a
 * caller's answer, because the quest refusal SPEAKS: a button is drawn
 * for a refusal with words either way.
 *
 * @returns {{ok:false, refusal:object}|{ok:true, amount:number, sound:'click'}}
 */
export function planStore(item, {
  remote = [], usingWagon = false, chooseOne = null, getQuest = null, dryRun = false,
} = {}) {
  if (!item) return { ok: false, refusal: REFUSAL.missing };
  if (item.group === 'Transportation') return { ok: false, refusal: REFUSAL.transport };
  if (isSummoned(item)) return { ok: false, refusal: REFUSAL.summoned };
  // AUDIT 26 F156: THE MAP ARM (:1471-1478), between the summoned
  // guard and the quest arm. A MiscItems.Map in EITHER direction is
  // intercepted: RecordLocationFromMap runs, the item is removed, and
  // it never lands in the destination - pulling a treasure map out of
  // a loot pile reveals a location instead of bagging paper. The plan
  // ANSWERS the interception; the window routes to its own reveal
  // (its use arm carries the no-reveal-seam pending law).
  if (isMap(item)) return { ok: true, map: true, amount: item.stackCount ?? 1 };
  // AUDIT 26: TransferItem's QUEST arm (:1480-1505), the guard ONE
  // STATEMENT below the summoned one and ABOVE every capacity gate -
  // so a quest item stopped by a full wagon has still had its
  // playerDropped written, exactly as DFU leaves it.
  if (!dryRun && questTransferRefused(item, { fromLocal: true, toWagon: usingWagon, getQuest })) {
    return { ok: false, refusal: REFUSAL.questItem };
  }
  // G6 / NT3 (F162): DFU's local Remove arm runs only
  // `if (remoteItems != null && !chooseOne)` (:1994) - while a
  // choose-one reward list is up NOTHING leaves the pack, wagon or no
  // wagon. The old `&& !usingWagon` exemption here let a cart owner
  // stage gear into the wagon mid-choose-one.
  if (chooseOne) return { ok: false, refusal: REFUSAL.chooseOnePile };
  const stack = item.stackCount ?? 1;
  if (usingWagon) {
    // :1996-1999 -> WagonCanHoldAmount (:1425-1434). Zero fits refuses
    // with cannotHoldAnymore and NO click; a partial fit split-takes
    // exactly what fits.
    const canHold = canHoldAmount(stack, effectiveUnitWeightInKg(item), WAGON_KG_LIMIT, totalWeight(remote));
    if (canHold <= 0) return { ok: false, refusal: REFUSAL.wagonFull };
    return { ok: true, amount: Math.min(canHold, stack), sound: 'click' };
  }
  return { ok: true, amount: stack, sound: 'click' };   // DoTransferItem (:1583)
}

/**
 * REMOTE -> LOCAL. RemoteItemListScroller_OnItemClick: both Remove and
 * Equip transfer to the player; Equip also equips what it took.
 *
 * `entity` absent means no capacity to read and the gate stands open -
 * the loot-window tests mount without one.
 *
 * @returns {{ok:false, refusal:object}|{ok:true, amount, sound, equip, claimsChoice}}
 */
export function planTake(item, {
  bag = [], entity = null, mode = 'remove', chooseOne = null, usingWagon = false,
  getQuest = null, dryRun = false,
} = {}) {
  if (!item) return { ok: false, refusal: REFUSAL.missing };
  // X11b: TransferItem's summoned guard, BOTH callers. The remote arm
  // cannot fire today (nothing can get a summoned item out of the pack
  // to put it there) and is written anyway rather than left to a
  // future transfer path to rediscover.
  if (isSummoned(item)) return { ok: false, refusal: REFUSAL.summoned };
  if (isMap(item)) return { ok: true, map: true, amount: item.stackCount ?? 1 };   // F156: either direction
  // AUDIT 26: the quest arm, the OTHER caller. `from` is remoteItems
  // here, so the refusal cannot fire without CanDropQuestItems, and
  // picking the item back up CLEARS PlayerDropped (:1499-1500) - which
  // is a write, and the reason this runs above the carry gate.
  if (!dryRun && questTransferRefused(item, { fromLocal: false, toWagon: usingWagon, getQuest })) {
    return { ok: false, refusal: REFUSAL.questItem };
  }
  const stack = item.stackCount ?? 1;
  // CanCarryAmount (:1414-1422, AUDIT 23 items-9). AUDIT 26: :1417
  // reads playerEntity.MaxEncumbrance, which is the formula PLUS the
  // enchantment weight allowance - not the bare strength formula.
  //
  // E4: and its load is GetCarriedWeight() (:852-855), which is
  // PlayerEntity.CarriedWeight - Items.GetWeight() PLUS the gold
  // COUNTER's own weight (PlayerEntity.cs:184). `bag` is the caller's
  // reading of the collection (the trade window's override :630-633
  // adds the basket to it); the coin term is the entity's and is
  // added here, so a purse of 400,000 pieces weighs its thousand
  // kilograms against the gate exactly as the old bag stack did.
  const canCarry = entity
    ? canHoldAmount(stack, effectiveUnitWeightInKg(item),
      entityMaxEncumbrance(entity),
      totalWeight(bag) + goldPiecesOf(entity) * GOLD_PIECE_WEIGHT_KG)
    : stack;
  // The window's own gate went silent when it had no entity to read
  // and spoke when it did; there is one answer here, because the only
  // way to reach it without an entity is a stack of zero, which
  // nothing in the port can mint (Ledger A).
  if (canCarry <= 0) return { ok: false, refusal: REFUSAL.cannotCarry };
  return {
    ok: true,
    // TransferItem splits when maxAmount < stackCount (:1515), opening
    // the how-many popup DEFAULTED to maxAmount - Enter takes exactly
    // what fits, which is this arm.
    amount: Math.min(canCarry, stack),
    // DoTransferItem: gold rides its own clink (:1569), everything
    // else the button click (:1583) - AFTER the carry gate, so a
    // refused transfer stays silent.
    sound: isGoldPieces(item) ? 'gold' : 'click',
    equip: mode === 'equip',
    // G6 (:1585-1591): ONE is the whole gift. The window closes and
    // the callback runs - the claim and the taking are one event.
    claimsChoice: !!chooseOne && !usingWagon,
  };
}

/**
 * Perform a planned move. The SPLIT is law rather than presentation:
 * a partial take leaves the remainder in the source stack and mints a
 * new record for what moved, and a whole take removes the record.
 *
 * @returns the item that arrived in `to` (the new record when split).
 */
/** AUDIT 26 F157 - TransferItem :1506-1508, verbatim: a LIT light
 *  source leaving the PACK stops lighting the player.
 *  `if (item.IsLightSource && playerEntity.LightSource == item &&
 *  from == localItems) playerEntity.LightSource = null` - without it,
 *  dropping or selling a lit torch left the player carrying its light
 *  (and its condition burn) from an item in a pile or a shop. One
 *  home, because the trade window's staging arms need it too. */
export function clearLightSourceOnLeave(item, entity, fromLocal) {
  if (fromLocal && entity && isLightSource(item) && entity.lightSource === item) entity.lightSource = null;
}

/**
 * E4 - DoTransferItem's FIRST statement (:1562-1571), verbatim:
 *
 *     if (item.IsOfTemplate(Currency, Gold_pieces) && PlayerEntity.Items == to)
 *     { playerEntity.GoldPieces += item.stackCount; from.RemoveItem(item);
 *       Refresh(false); PlayOneShot(GoldPieces); return; }
 *
 * THE TRANSFER DOOR IS WHERE A PILE BECOMES A COUNTER. `toPlayer` is
 * DFU's `PlayerEntity.Items == to`, and it is the caller's answer
 * because only the caller knows which collection it handed over - the
 * trade window's basket and the wagon are not the pack, and a gold
 * pile put into either stays an item (DaggerfallBankManager.cs:343
 * reads exactly that wagon stack back).
 *
 * The SPLIT still runs first, because DFU's does: TransferItem routes
 * a partial move through SplitStackPopup_OnGotUserInput (:1554),
 * which calls SplitStack and only then DoTransferItem - so the item
 * the counter swallows is the freshly minted half, and the remainder
 * stays in the source. Nothing lands in `to`.
 *
 * THE ARM ANSWERS NULL, because DFU's `return` (:1570) skips the whole
 * rest of DoTransferItem: no EquipItem (:1580), and no choose-one
 * close-and-callback (:1585-1591). A guild reward pile of gold is
 * therefore taken WITHOUT closing the picker, which is DFU's quirk and
 * not the port's. Every other move answers the record that arrived.
 */
export function applyTransfer(item, plan, from, to, { entity = null, fromLocal = false, toPlayer = false, rolls = Math.random } = {}) {
  clearLightSourceOnLeave(item, entity, fromLocal);
  if (toPlayer && isGoldPieces(item)) {
    const coin = _splitOff(item, plan, from, rolls);
    const at = from.indexOf(coin);
    if (at >= 0) from.splice(at, 1);
    addGoldPieces(entity, coin.stackCount ?? 1);
    return null;
  }
  return _applyTransfer(item, plan, from, to, rolls);
}
/**
 * The half of a partial move that TRAVELS - or the item itself on a
 * whole move. E4 pulled it out of _applyTransfer so the gold arm and
 * the plain one cannot disagree about what a split produces.
 *
 * ROAD-Ar R5: DFU has no partial transfer that skips SplitStack.
 * TransferItem (:1515-1540) routes every `maxAmount < stackCount`
 * move into the split popup, whose handler is
 * `stackFrom.SplitStack(stackItem, count)` (:1554) BEFORE
 * DoTransferItem - so the half that travels is a fresh template item
 * (ItemCollection.cs:267 -> ItemBuilder.CreateItem -> SetItem:
 * material, variant, flags, message and potionRecipeKey zeroed, value
 * back to basePrice, condition back to hitPoints), not a copy of the
 * record. inventory.splitStack is that member's ONE home; this used
 * to re-spell it as `{ ...item, stackCount }`, which carried
 * condition, enchantments (by reference), message and recipe into the
 * moved half. splitStack pushes the new record into the SOURCE
 * collection, which is DFU's order exactly - SplitStack adds to
 * stackFrom, TransferItem then moves it.
 */
function _splitOff(item, plan, from, rolls) {
  const stack = item.stackCount ?? 1;
  if (plan.amount >= stack) return item;
  const minted = splitStack(from, item, plan.amount, { rolls });
  if (minted && minted !== item) return minted;
  // splitStack refuses what DFU's popup never offers (a 1-stack, an
  // item not in `from`); the old spelling stays as that fallback, and
  // it leaves the remainder record in place rather than in `from`'s
  // way - which is why the caller's splice is index-guarded.
  item.stackCount = stack - plan.amount;
  return { ...item, stackCount: plan.amount };
}
function _applyTransfer(item, plan, from, to, rolls = Math.random) {
  const moved = _splitOff(item, plan, from, rolls);
  const at = from.indexOf(moved);
  if (at >= 0) from.splice(at, 1);
  addItem(to, moved);
  return moved;
}
