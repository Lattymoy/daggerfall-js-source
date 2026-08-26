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
  GOLD_PIECE_WEIGHT_KG,
} from './inventory.js';
import { CANNOT_REMOVE_ITEM_TEXT } from './createItem.js';
import { maxEncumbrance } from '../combat/formulas.js';
import { liveStat } from './statMods.js';

/** ItemHelper.WagonKgLimit (:56). */
export const WAGON_KG_LIMIT = 750;
/** Internal_Strings, recovered - these ship in Unity-side
 *  localization rather than TEXT.RSC, so the prose is the port's and
 *  the BEHAVIOUR is DFU's. */
export const CANNOT_HOLD_TEXT = 'Your wagon cannot hold any more.';
export const CANNOT_CARRY_TEXT = 'You cannot carry any more.';

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
  chooseOnePile: { reason: 'chooseOnePile', text: null },
  wagonFull: { reason: 'wagonFull', text: CANNOT_HOLD_TEXT },
  cannotCarry: { reason: 'cannotCarry', text: CANNOT_CARRY_TEXT },
  /** The drop-gold field's own refusal, and it is SILENT because DFU's
   *  is: an amount below 1 or above the purse is REFUSED OUTRIGHT
   *  rather than clamped (:1272-1300), and the field simply does not
   *  take it. */
  badAmount: { reason: 'badAmount', text: null },
});

/** key "wagonFullGold" (:1303) - the drop-gold clamp's box. */
export const wagonFullGoldText = (n) => `Your wagon can only hold ${n} more gold.`;

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
 * @returns {{ok:false, refusal:object}|{ok:true, amount:number, sound:'click'}}
 */
export function planStore(item, { remote = [], usingWagon = false, chooseOne = null } = {}) {
  if (!item) return { ok: false, refusal: REFUSAL.missing };
  if (item.group === 'Transportation') return { ok: false, refusal: REFUSAL.transport };
  if (isSummoned(item)) return { ok: false, refusal: REFUSAL.summoned };
  // G6 (:1994): nothing goes INTO a choose-one pile, so nothing of the
  // player's can be dumped into a reward list they are only choosing
  // from. The WAGON is not that pile, so it is still open.
  if (chooseOne && !usingWagon) return { ok: false, refusal: REFUSAL.chooseOnePile };
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
} = {}) {
  if (!item) return { ok: false, refusal: REFUSAL.missing };
  // X11b: TransferItem's summoned guard, BOTH callers. The remote arm
  // cannot fire today (nothing can get a summoned item out of the pack
  // to put it there) and is written anyway rather than left to a
  // future transfer path to rediscover.
  if (isSummoned(item)) return { ok: false, refusal: REFUSAL.summoned };
  const stack = item.stackCount ?? 1;
  // CanCarryAmount (:1414-1422, AUDIT 23 items-9).
  const canCarry = entity
    ? canHoldAmount(stack, effectiveUnitWeightInKg(item),
      maxEncumbrance(liveStat(entity, 'strength')), totalWeight(bag))
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
    sound: item.group === 'Currency' ? 'gold' : 'click',
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
export function applyTransfer(item, plan, from, to) {
  const stack = item.stackCount ?? 1;
  if (plan.amount < stack) {
    item.stackCount = stack - plan.amount;
    const taken = { ...item, stackCount: plan.amount };
    addItem(to, taken);
    return taken;
  }
  const at = from.indexOf(item);
  if (at >= 0) from.splice(at, 1);
  addItem(to, item);
  return item;
}
