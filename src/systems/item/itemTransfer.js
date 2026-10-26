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
  splitStack, GOLD_PIECE_WEIGHT_KG, goldPiecesOf, addGoldPieces, isGoldPieces, tellTaken,
  findExistingStack, goldStack,
} from '../inventory.js';
import { LOOT_STACK_MAX } from '../loot/loot.js';   // GOLD-WIRE: the most one stack rides the room's word in
import { isRoomCarried } from '../loot/roomCarriedList.js';   // GOLD-WIRE: whether the room's word carries the list a drop lands in
import { isMap, isLightSource, isSpellbook } from '../useItem.js';   // AUDIT 26 F156/F157: the map interception + the lit-torch clear; KEEP-SPELLBOOK
import { cannotRemoveItemText } from '../createItem.js';
// AUDIT 26: DaggerfallEntity.MaxEncumbrance, enchantment allowance and
// all - :1417 reads playerEntity.MaxEncumbrance, not the bare formula.
import { entityMaxEncumbrance } from '../../combat/formulas.js';
import { makeItemPermanent } from '../quest/item.js';   // TransferItem's MakePermanent arm (:1502-1504)
import { getBool } from '../settings/settings.js';   // GUI/CanDropQuestItems
import { setLightSource } from '../lightSource.js';   // DISC7: the light in hand's one door
import { localizedText, formatText, t } from '../textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language; QUEST-AUDIT III: the port's own
import { REMAINS_LIST } from '../legacy/heirloom.js';   // AUDIT LEGACY II H4: a remains' list, open
import { BAG_WORDS, isBagItem, holdsOtherBag } from '../../net/bagLaw.js';   // BAG1: a loaded Materials Bag never leaves the pack; ONE-BAG: one to a character
import { SMALL_CART_KG } from '../wagon/wagonKinds.js';   // WAGONS1: DFU's 750, one literal
import { takenFromKeeping, returnedToKeeping, landedInKeeping } from '../stolenGoods.js';   // STOLEN-GOODS: a take of the owner's piece from their keeping is marked as it lands (a leaf)

/** ItemHelper.WagonKgLimit (:56). */
export const WAGON_KG_LIMIT = SMALL_CART_KG;   // WAGONS1: the Small Cart's - each kind's own is systems/wagon/wagonKinds.js wagonKgLimitOf, handed in as `wagonKg`
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
/** L10N3d: ...in the player's language, read where the box shows them. */
export const cannotHoldText = () => localizedText('cannotHoldAnymore', CANNOT_HOLD_TEXT);
export const cannotCarryText = () => localizedText('cannotCarryAnymore', CANNOT_CARRY_TEXT);

/** KEEP-SPELLBOOK (2026-10-08, the owner: "a player dropped his spellbook apparently"): the port's own - DFU lets the
 *  spellbook go like any MiscItems piece. The character's spellbook (MiscItems 132, not a quest's) leaves the pack for
 *  nowhere but the character's own wagon: never the ground, a pile, a body, a chest, a companion's pack, or a
 *  counter's sale (ui/native/nativeTrade.js, ui/enhanced/enhancedTrade.js). A death in the zone already keeps it
 *  (systems/wild/wildDeath.js wildCanLose). One reading, one sentence, for every door that asks. */
export const isKeptSpellbook = (item) => isSpellbook(item) && item.group === 'MiscItems' && !item.questItem;
export const SPELLBOOK_KEPT_TEXT = 'Your spellbook never leaves you.';

/** Why a transfer did not happen, and whether the player is told.
 *  EVERY refusal is silent in the SOUND sense - DFU's guards all
 *  return above DoTransferItem's click - so the only thing that
 *  varies is the box, and `text` is it: null means the click simply
 *  does nothing, which is what DFU's transport block does. L10N3d: a
 *  `text` is read in the player's language when the box asks for it. */
export const REFUSAL = Object.freeze({
  /** Defensive only: both windows drop a click on an empty slot long
   *  before they reach the ladder. */
  missing: { reason: 'missing', text: null },
  transport: { reason: 'transport', text: null },
  summoned: { reason: 'summoned', get text() { return cannotRemoveItemText(); } },
  /** AUDIT 26: the quest arm's refusal shares the summoned one's
   *  words, because DFU pops the same string for both. */
  questItem: { reason: 'questItem', get text() { return cannotRemoveItemText(); } },
  remains: { reason: 'remains', text: 'These are the remains of your blood. Carry them home, or leave them where they lie.' },   // AUDIT LEGACY II H4
  spellbook: { reason: 'spellbook', text: SPELLBOOK_KEPT_TEXT },   // KEEP-SPELLBOOK
  chooseOnePile: { reason: 'chooseOnePile', text: null },
  wagonFull: { reason: 'wagonFull', get text() { return cannotHoldText(); } },
  cannotCarry: { reason: 'cannotCarry', get text() { return cannotCarryText(); } },
  /** BAG1: the Materials Bag leaves the pack only empty - the cart's own rule (tradeModes.js), said here because a bag
   *  dropped, chested or carted with materials in it would strand them in a list nobody owns. */
  bagLoaded: { reason: 'bagLoaded', text: BAG_WORDS.notEmpty },
  /** ONE-BAG (2026-10-04, Mac: "you shouldnt be able to hold multiple gathering bags"): one Materials Bag to a character -
   *  a second is never taken into the pack, bought into a basket or carried off a shelf. */
  secondBag: { reason: 'secondBag', text: BAG_WORDS.second },
  /** QUEST-AUDIT III SHELF-TWIN: a quest item is never taken while a copy of it is already kept (holdsQuestTwin). */
  questTwin: { reason: 'questTwin', get text() { return t('items.refusal.questTwin', 'You already have this quest item.'); } },
  /** The drop-gold field's own refusal, and it is SILENT because DFU's
   *  is: an amount below 1 or above the purse is REFUSED OUTRIGHT
   *  rather than clamped (:1272-1300), and the field simply does not
   *  take it. */
  badAmount: { reason: 'badAmount', text: null },
  /** GOLD-WIRE: the gold pile in a container the room's word carries holds LOOT_STACK_MAX already (sharedGoldRoom). */
  sharedGoldFull: { reason: 'sharedGoldFull', get text() { return sharedGoldFullText(); } },
});

/**
 * "Send click to quest system" (DaggerfallInventoryWindow.cs:2027-2037)
 * - the FIRST act of RemoteItemListScroller_OnItemClick, ahead of the
 * action-mode branch, so a quest item clicked on the REMOTE list (a
 * pile, a body, a container) clicks its quest's Item whatever the mode,
 * a look included. The ClickedItem trigger polls that click
 * (`clicked item _x_` - O0A0AL00's note in the stolen robes, the
 * letters a foe carries). The right click is the same member
 * (RemoteItemListScroller_OnItemRightClick, :2070-2073).
 *
 * WHERE-ROBES (FIELD BUGS 2026-10-04c): ONE HOME, because the port has
 * more doors onto a remote row than DFU's one list - each skin's row,
 * the enhanced skin's menu and its pad's quick act, and quick loot,
 * which takes a row with no window at all. Three of those took the
 * item and never sent the click, and the trigger never fired.
 *
 * C# guards the quest and then NREs on a missing symbol (its second
 * `if` re-tests the quest); the port answers nothing, as
 * questTransferRefused below does. Answers whether an Item was clicked.
 */
export function sendQuestItemClick(item, getQuest = null) {
  if (!item?.questItem) return false;
  const questItem = getQuest?.(item.questUID)?.getItem?.(item.questSymbol) ?? null;
  if (!questItem) return false;
  questItem.setPlayerClicked();
  return true;
}

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
/** QUEST-AUDIT III SHELF-TWIN: does any of `lists` keep another copy of the quest item `item` (its quest and symbol)? */
export function holdsQuestTwin(lists, item) {
  if (!item?.questItem) return false;
  const name = item.questSymbol?.name;
  return lists.some((l) => Array.isArray(l) && l.some((x) => x !== item && x?.questItem && x.questUID === item.questUID && x.questSymbol?.name === name));
}

/** QUEST-AUDIT III SHELF-TWIN: does the player keep the quest Item resource `res`'s item anywhere - the pack, the wagon,
 *  the Materials Bag, a repairer's hands (DFU's OtherItems)? The host's `carriesQuestItem`: the reclaim of a quest set
 *  aside hands an item back only when none is kept (machine.js reclaimQuest). */
export function keepsQuestItem(entity, res) {
  const uid = res?.parentQuest?.uid, name = res?.symbol?.name;
  return [entity?.items, entity?.wagonItems, entity?.bagItems, entity?.otherItems]
    .some((l) => Array.isArray(l) && l.some((it) => it?.questItem && it.questUID === uid && it.questSymbol?.name === name));
}

/** MakePermanent over the pack's copies of a quest's item `sym` (item.js's sync) - the host's `makeHeldQuestItemsPermanent`,
 *  out of bootWorld (HOST-SPLIT) beside its quest-item kin. */
export function makeHeldQuestItemsPermanent(entity, uid, sym) {
  for (const it of entity?.items ?? []) {
    if (it.questItem && it.questUID === uid && it.questSymbol?.name === sym?.name) makeItemPermanent(it);
  }
}

export function questTransferRefused(item, { fromLocal, toWagon = false, getQuest = null, trade = false } = {}) {
  if (!item?.questItem) return false;
  const quest = getQuest?.(item.questUID) ?? null;
  const questItem = quest?.getItem?.(item.questSymbol) ?? null;
  // QUEST-SHELF-DROP (2026-10-13, the lead dev: "when a player abandoned a quest he cant throw away the questitem for
  // it"): A QUEST SET ASIDE HOLDS NO ITEM - its item may leave the pack (the ground, a chest, the wagon), and nothing is
  // written to the quest, which is not running. Reclaimed, an item it had in the pack is handed back if it is gone
  // (machine.js reclaimQuest). NEVER TO A COUNTER (`trade`): a shop would buy an item reclaiming hands back again; and
  // never one the quest made permanent - that one outlives the quest, and a second copy would too.
  if (!trade && fromLocal && quest?.shelvedAt != null && questItem && !questItem.madePermanent) return false;
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
export const wagonFullGoldText = (n) => formatText(localizedText('wagonFullGold', 'Your wagon could only hold {0} gold pieces.'), n);
/** COMPANION-WEIGHT (2026-10-01): a storage with its own limit - a companion's pack (inventorySession storeCapacityOf) -
 *  refuses in its own words, the port's: DFU has no companion to name. */
export const packFullText = (name) => `${name || 'Your companion'} cannot carry any more.`;
export const packFullGoldText = (name, n) => `${name || 'Your companion'} could only carry ${n} gold pieces.`;
/** GOLD-WIRE (FIELD BUGS 2026-10-25b): a container the room's word carries (loot/roomCarriedList.js) takes coin up to the
 *  room left on the gold stack it lands on, in its own words - the port's: DFU has no other player to share one with. */
export const sharedGoldText = (n) => t('items.gold.sharedRoom', 'Only {n, number} more gold pieces fit here. Everyone here shares this container, and one pile of gold in it holds no more than {max, number}.', { n, max: LOOT_STACK_MAX });
export const sharedGoldFullText = () => t('items.gold.sharedFull', 'No more gold fits here. Everyone here shares this container, and one pile of gold in it holds no more than {max, number}.', { max: LOOT_STACK_MAX });
/** GOLD-WIRE: how much more gold the stack a drop lands on may take in a list the room's word carries. The drop's addItem
 *  merges the coin into findExistingStack's answer, and a stack past LOOT_STACK_MAX - the most one stack rides the room's
 *  word in - made that word unreadable to everyone else in the room (portalStone.js portalStoneRoom's law, for coin). */
export function sharedGoldRoom(remote) {
  const onto = findExistingStack(remote, goldStack(1));
  return Math.max(0, LOOT_STACK_MAX - (onto ? (onto.stackCount ?? 1) : 0));
}
/** AUDIT ECON C5: a storage whose keeper is gone (a quickload under his window that left him aboard) takes nothing - what
 *  it took would go into a list nothing keeps. */
export const packGoneText = (name) => `${name || 'Your companion'} is no longer with you.`;
const packFull = (capacity) => (capacity?.gone ? { reason: 'packGone', text: packGoneText(capacity?.name) } : { reason: 'packFull', text: packFullText(capacity?.name) });
/** Whether a capacity refuses a store of `units` of `item` onto `remote` outright - gone, or no room for one. */
const packRefuses = (capacity, item, units, remote) => !!capacity.gone || canHoldAmount(units, effectiveUnitWeightInKg(item), capacity.kg, totalWeight(remote)) <= 0;

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
 * GOLD-WIRE: `shared` - the room's word carries `remote` (by default,
 * whether it is marked so) - clamps the amount to the room left on the
 * gold stack it lands on (sharedGoldRoom), with a box that names it, as
 * the wagon does. The port's own: DFU has no shared container.
 *
 * @returns {{ok:true, amount:number, notice:string|null}
 *          |{ok:false, refusal:object, notice:string|null}}
 */
export function planDropGold(text, { carried = 0, usingWagon = false, remote = [], shared = isRoomCarried(remote), groundRefusal = null, capacity = null, wagonKg = WAGON_KG_LIMIT } = {}) {
  if (groundRefusal && !usingWagon) return { ok: false, refusal: { reason: 'ground', text: groundRefusal }, notice: null };   // HOUSE-DROP: gold on a floor that refuses it
  // A numeric field of 8 opening on "0": anything that is not a run of
  // digits is not a number, and 0 fails the range below.
  const asked = /^[0-9]+$/.test(String(text)) ? Number(text) : 0;
  if (asked < 1 || asked > carried) return { ok: false, refusal: REFUSAL.badAmount, notice: null };
  if (!usingWagon && capacity) {
    if (capacity.gone) { const r = packFull(capacity); return { ok: false, refusal: r, notice: r.text }; }   // AUDIT ECON C5
    // COMPANION-WEIGHT: a companion's pack clamps gold the way the wagon does, by its own limit and in its own words
    const canCarry = canHoldAmount(carried, GOLD_PIECE_WEIGHT_KG, capacity.kg, totalWeight(remote));
    const notice = asked > canCarry ? packFullGoldText(capacity.name, Math.max(0, canCarry)) : null;
    const amount = Math.min(asked, canCarry);
    if (amount < 1) return { ok: false, refusal: packFull(capacity), notice };
    return { ok: true, amount, notice };
  }
  if (!usingWagon && shared) {
    const room = sharedGoldRoom(remote);
    const amount = Math.min(asked, room);
    if (amount < 1) return { ok: false, refusal: REFUSAL.sharedGoldFull, notice: sharedGoldFullText() };
    return { ok: true, amount, notice: asked > room ? sharedGoldText(room) : null };
  }
  if (!usingWagon) return { ok: true, amount: asked, notice: null };
  // :1296-1303 - the 750kg headroom in COINS, and the box names it.
  const canHold = canHoldAmount(carried, GOLD_PIECE_WEIGHT_KG, wagonKg, totalWeight(remote));   // WAGONS1: the driven wagon's own
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
  remote = [], usingWagon = false, chooseOne = null, getQuest = null, dryRun = false, groundRefusal = null, capacity = null, bagLoaded = false, wagonKg = WAGON_KG_LIMIT,
} = {}) {
  if (!item) return { ok: false, refusal: REFUSAL.missing };
  if (bagLoaded && isBagItem(item)) return { ok: false, refusal: REFUSAL.bagLoaded };   // BAG1
  // HOUSE-DROP (2026-09-27): the ground itself refuses - the window hands the host's word (inventorySession
  // groundRefusalOf) only when the destination IS the ground, so a wagon, a chest and a trade are untouched
  if (groundRefusal) return { ok: false, refusal: { reason: 'ground', text: groundRefusal } };
  if (item.group === 'Transportation') return { ok: false, refusal: REFUSAL.transport };
  if (isKeptSpellbook(item) && !usingWagon) return { ok: false, refusal: REFUSAL.spellbook };   // KEEP-SPELLBOOK: the own wagon takes it, nothing else
  if (isSummoned(item)) return { ok: false, refusal: REFUSAL.summoned };
  // AUDIT LEGACY II H4: an ancestor's remains (Project Legacy) leave the character's keeping - the pack, the wagon -
  // only back into the list they were taken from (it bears their mark while open, systems/legacy/heirloom.js
  // REMAINS_LIST); a chest, a pile or the ground would hold a second set of bones the quest never reads
  if (item.legacyRemains && !usingWagon && remote?.[REMAINS_LIST] !== item.legacyRemains.of) return { ok: false, refusal: REFUSAL.remains };
  // AUDIT 26 F156: THE MAP ARM (:1471-1478), between the summoned
  // guard and the quest arm. A MiscItems.Map in EITHER direction is
  // intercepted: RecordLocationFromMap runs, the item is removed, and
  // it never lands in the destination - pulling a treasure map out of
  // a loot pile reveals a location instead of bagging paper. The plan
  // ANSWERS the interception; the window routes to its own reveal
  // (its use arm carries the no-reveal-seam pending law).
  if (isMap(item)) return { ok: true, map: true, amount: item.stackCount ?? 1 };
  // AUDIT ECON C1: a storage of the port's own with no room left (a companion's pack, COMPANION-WEIGHT) refuses ABOVE
  // the quest arm - DFU has no such limit, and its one capacity, the wagon's, never writes the flag (toWagon), so DFU
  // never marks an item dropped and then keeps it in the pack; below it, a quest's dropped-at-place letter refused by a
  // full pack still fired the quest's DroppedItemAtPlace while it stayed in the player's bag
  if (capacity && !usingWagon && packRefuses(capacity, item, item.stackCount ?? 1, remote)) return { ok: false, refusal: packFull(capacity) };
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
    const canHold = canHoldAmount(stack, effectiveUnitWeightInKg(item), wagonKg, totalWeight(remote));   // WAGONS1: the driven wagon's capacity
    if (canHold <= 0) return { ok: false, refusal: REFUSAL.wagonFull };
    return { ok: true, amount: Math.min(canHold, stack), sound: 'click' };
  }
  if (capacity) {
    // COMPANION-WEIGHT: a storage with its own limit takes what fits, the wagon's law under its own number - a load
    // already over it (a pack filled before the limit) refuses everything more, and taking out is never gated
    const canHold = canHoldAmount(stack, effectiveUnitWeightInKg(item), capacity.kg, totalWeight(remote));
    if (capacity.gone || canHold <= 0) return { ok: false, refusal: packFull(capacity) };
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
  // ONE-BAG: a Materials Bag is never taken while another is held - in the pack, in a trade's basket (the trade windows'
  // `bag` is both) or in the wagon; the bag being taken is not "another", wherever it sits. AUDIT ONE-BAG 1: nor is one out of
  // the character's own wagon a bag taken - it is already theirs, and two held from before were locked in the wagon for good
  const ownWagon = Array.isArray(entity?.wagonItems) && entity.wagonItems.includes(item);
  if (isBagItem(item) && !ownWagon && holdsOtherBag([bag, entity?.wagonItems], item)) return { ok: false, refusal: REFUSAL.secondBag };
  // QUEST-AUDIT III SHELF-TWIN: a quest's item abandoned onto the ground is handed back when the quest is reclaimed
  // (machine.js reclaimQuest) - and the copy on the ground, picked up, was a second; a permanent one outlives the quest
  if (holdsQuestTwin([bag, entity?.items, entity?.wagonItems, entity?.bagItems], item)) return { ok: false, refusal: REFUSAL.questTwin };
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

// ─── THE SPLIT POPUP (CM5; DISC25-F one home) ─────────────────────────
//
// TransferItem (DaggerfallInventoryWindow.cs:1515-1539): when the amount the plan would move is short of the stack -
// or either Control is held (Input.GetKey, a STATE, polled at the click) - it pushes a DaggerfallInputMessageBox
// labelled howManyItems, numeric, MaxCharacters 8, and only SplitStackPopup_OnGotUserInput (:1546-1560) performs the
// transfer, with the count the player typed. An unparseable or over-large answer moves nothing (:1551-1552).
// DaggerfallTradeWindow inherits the member (DaggerfallTradeWindow.cs:31), so a basket takes part of a shelf's stack
// and a sale part of the pack's (:795, :803, :842). The classic windows push the box; the enhanced windows write the
// same question as a field on the item's own card (DISC25-F).

/** TextManager's howManyItems, formatted (:1529). */
export const HOW_MANY_ITEMS = (max) => formatText(localizedText('howManyItems', 'Pick how many items (max {0})?'), max);
/** mb.TextBox.MaxCharacters = 8 (:1533). */
export const SPLIT_INPUT_MAX = 8;

/** SplitStackPopup_OnGotUserInput's parse (:1549-1552): `int.TryParse`, then 1..max - else null, and nothing moves.
 *  TryParse takes an optional sign and the surrounding white space and nothing else, so "3x" is no count (the classic
 *  box admits digits alone, TextBox.Numeric; the enhanced field is a plain input, DISC25-F, and must read the same). */
export function parseSplitAmount(text, max) {
  const t = String(text ?? '').trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  const count = Number(t);
  return Number.isInteger(count) && count >= 1 && count <= max ? count : null;
}

/** TransferItem's gate (:1515-1519): a STACK (item.IsAStack(), :1519) whose planned amount is short of it, or any
 *  stack under Control. */
export function splitRequired(item, amount, controlDown = false) {
  const stack = item?.stackCount ?? 1;
  return stack > 1 && (amount < stack || !!controlDown);
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
  if (fromLocal && entity && isLightSource(item) && entity.lightSource === item) setLightSource(entity, null);   // DISC7: the one door
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
 *
 * STOLEN-GOODS (FIELD BUGS 2026-10-16b): `stolenFrom` - the move takes a piece out of someone else's keeping (a shut
 * shop's shelf, a stranger's cupboard, a robbed caravan's goods: systems/inventorySession.js theftTarget, the owner's
 * keeping the host took as the window opened) - marks the record that travels when its source is the owner's; and
 * `returnTo` - the move puts a piece into that keeping - clears it when the piece is the owner's. Both BEFORE it lands,
 * because the landing is where a stack merges (systems/stolenGoods.js); and the keeping follows the owner's pieces - a
 * split taken off theirs, a stack one put back merged into - so the theft's basket reads what the mark wrote (AUDIT S1:
 * every take was marked and every put cleared, so the player's own piece through a stranger's cupboard came out
 * stolen). Coin carries no mark: the gold arm spends it into the counter first.
 *
 * OUTDOOR-LOOT (DESIGN 3.9, T14 - the doc of the dungeon's own latent class): A ROW ITS SOURCE NO LONGER HOLDS MOVES
 * NOTHING. A window draws its rows from lists that change under it - a piece LIFTED out of the pack while its claim stands
 * (systems/loot/claimLedger.js; the pack panel repaints on its own clock), a container another player emptied first - and a
 * click on such a row planned a move of a piece that was not there and landed a COPY: the source's splice found nothing
 * and the destination took the piece anyway, a coin row was spent into the purse the same, and a split of a stack its
 * source did not hold minted its half out of nothing. The tests plan and then apply, so the door every screen's transfer
 * ends at is where it is refused: answered null, no arrival - the gold arm's own answer, which every caller reads as
 * nothing to follow (LOOT-BULK's bulkMove, the quick door and the trade windows already ask `from.includes(item)`). Every
 * caller in src/ hands the list the piece is in (swept: the windows' own, quick loot, Physical Items, the naval plunder's
 * one-piece source, a decor take).
 */
export function applyTransfer(item, plan, from, to, { entity = null, fromLocal = false, toPlayer = false, rolls = Math.random, stolenFrom = null, returnTo = null } = {}) {
  if (Array.isArray(from) && !from.includes(item)) return null;
  clearLightSourceOnLeave(item, entity, fromLocal);
  if (toPlayer && isGoldPieces(item)) {
    const coin = _splitOff(item, plan, from, rolls);
    const at = from.indexOf(coin);
    if (at >= 0) from.splice(at, 1);
    takenFromKeeping(stolenFrom, item, coin);   // STOLEN-GOODS AUDIT S1: the owner's coin out of their keeping - the theft's basket counts a handful too; the purse it lands in is a number, and carries no mark
    addGoldPieces(entity, coin.stackCount ?? 1);
    return null;
  }
  // STOLEN-GOODS AUDIT S1: each asked of the SOURCE (`item`), the record the owner's keeping knows - a split's half is new
  const landed = _applyTransfer(item, plan, from, to, rolls, (moved) => { takenFromKeeping(stolenFrom, item, moved); returnedToKeeping(returnTo, item, moved); },
    (moved, held) => landedInKeeping(returnTo, item, moved, held));
  if (toPlayer && landed) tellTaken(landed);   // LOOT8: a piece taken into the pack - the loot window's, quick loot's
  return landed;
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
function _applyTransfer(item, plan, from, to, rolls = Math.random, beforeLanding = null, afterLanding = null) {
  const moved = _splitOff(item, plan, from, rolls);
  const at = from.indexOf(moved);
  if (at >= 0) from.splice(at, 1);
  beforeLanding?.(moved);   // STOLEN-GOODS: the theft's mark, written before the merge below can take the record
  // AUDIT 64 F54: DoTransferItem's own position
  // (DaggerfallInventoryWindow.cs:1573-1579) - "Always place quest
  // item pickups to front of list / Otherwise use preferred order":
  // `order = preferredOrder; if (item.IsQuestItem) order =
  // AddPosition.Front;` then `to.Transfer(item, from, order)`
  // (ItemCollection.cs:473-480 forwards it to AddItem).
  // `preferredOrder` is DontCare and is never reassigned anywhere in
  // the tree, so Front is the ONLY position that is not an append.
  // It is the MOVED record that is tested, not the clicked one: a
  // partial move mints a fresh item through SplitStack and DFU's
  // SplitStack_OnGotUserInput (:1546-1558) hands THAT to
  // DoTransferItem. The rule is not scoped to pickups - storing a
  // droppable quest item into the wagon or the ground pile inserts at
  // that collection's front too, and DaggerfallTradeWindow's clicks
  // inherit the same member.
  // A shared chest records each stack on its own. Merging here would add the count onto a pile the settle also stores.
  const held = to?.unstacked === true ? (to.push(moved), moved) : addItem(to, moved, moved?.questItem ? 'front' : 'dontCare');
  afterLanding?.(moved, held);   // STOLEN-GOODS AUDIT S1: where the owner's piece came to rest - the record that holds it is theirs
  return moved;
}
