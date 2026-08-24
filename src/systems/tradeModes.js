// U40 - THE TRADE WINDOW'S MODE FLOW, law half.
// DaggerfallTradeWindow.cs (MIT, Daggerfall Workshop / Hazelnut).
//
// U8c shipped the shop screen in BUY mode only, and said so: "FLAGGED
// loud: the basket + mode-action flow (DFU accumulates then Buy)".
// That one gap is the named blocker at four separate sites - the
// repair popup's SELL button, the plain-merchant sell arm in
// worldModes, the shelf flow's mode split, and nativeTrade's own
// INVE10 art - so this is one law with four consumers waiting.
//
// THE SHAPE, because it is not the shape the port has been using.
// DFU does NOT transact at the click. A click STAGES an item: in Buy
// mode into the BASKET, in every other mode into the REMOTE list. The
// cost strip re-totals the whole staged collection on every change,
// and the mode-action button (Buy / Sell / Repair / Identify) commits
// the lot behind one Yes/No popup. That is why there is a Clear
// button at all, and why the cost label can show a number for goods
// the player does not own yet.
//
// THE FIVE MODES and their action-panel art (:78-83, :751-771). Sell
// and SellMagic share INVE10; DFU also loads INVE11 (the same panel in
// GOLD) purely to cut the SELECTED state of the select button out of
// it, which is why that one is loaded unconditionally regardless of
// mode.
//
// THREE THINGS THAT DO NOT READ THE WAY THEY LOOK, each pinned:
//
// 1. SELL MODE LOOKS LIKE IT PRICES BY CONDITION AND DOES NOT.
//    :462 calls `CalculateCost(item.value, quality, item.ConditionPercentage)`
//    and CalculateCost's third parameter (:1884) is
//    `conditionPercentage = -1`, which its BODY NEVER READS - the
//    parameter exists only so a mod override can see it. So a
//    battered sword and a pristine one fetch the same price in DFU,
//    and the call site says otherwise. The port's calculateCost took
//    the third slot for ApplyRegionalPriceAdjustment (which DFU
//    reaches for as a global), so this file must NOT pass condition
//    into it - and the reason is written down here rather than
//    rediscovered.
//
// 2. THE BUY-MODE HOLIDAY DISCOUNTS ARE THREE DIFFERENT PREDICATES
//    (:444-449), not one. Merchants Festival halves everything but
//    only OUTSIDE a guild; Tales and Tallow halves only INSIDE the
//    Mages Guild; Warriors Festival halves only WEAPONS and only
//    outside a guild. And unlike the tavern's meal - which passes
//    region 0 as a literal - this one reads the player's REAL region,
//    so a regional holiday actually lands here.
//
// 3. THE HAGGLE MESSAGE IS THE TEMPLE'S. ShowTradePopup's three bands
//    (:1104-1110) are `cost >> 1 <= price` and `cost - (cost >> 2) <=
//    price` - character for character the bands
//    DaggerfallGuildServiceCureDisease uses, which the port already
//    ported as cureOfferMessageOffset. DFU wrote it twice; there is
//    one home here. The only difference is the +3 that moves the SELL
//    modes onto their own three records.

import { calculateCost, calculateTradePrice } from './shopStock.js';
import { GOLD_PIECE_WEIGHT_KG, isEnchanted } from './inventory.js';
import { calculateItemRepairCost, repairRefusal } from './repairService.js';
import { HOLIDAYS } from './holidays.js';
import { GUILDS } from './guilds.js';
import {
  cureOfferMessageOffset, TRADE_MESSAGE_BASE_ID, NOT_ENOUGH_GOLD_ID,
} from './guildServiceActions.js';

/** The shared TEXT.RSC ids. DaggerfallTradeWindow declares both
 *  (:33-34) and so do the guild services; ONE DFU MEMBER, ONE EXPORT,
 *  so this re-exports the existing home rather than writing 260 and
 *  454 down a third time. */
export { TRADE_MESSAGE_BASE_ID, NOT_ENOUGH_GOLD_ID };
/** The weight law's own - re-exported so a caller of sellProceeds
 *  can read the number it was weighed against. */
export { GOLD_PIECE_WEIGHT_KG };

/** WindowModes (:133-141). Inventory is DFU's own "should never get
 *  used, treat as 'none'" - kept because the numbering depends on it. */
export const WINDOW_MODES = Object.freeze({
  Inventory: 0, Sell: 1, Buy: 2, Repair: 3, Identify: 4, SellMagic: 5,
});

/** LoadTextures' mode switch (:755-764). Sell and SellMagic share the
 *  same panel; Inventory mode has NO overlay at all, which is what
 *  DFU's `if (actionButtonsTexture != null)` at :213 is guarding. */
export const MODE_ACTION_ART = Object.freeze({
  Buy: 'INVE08I0.IMG',
  Sell: 'INVE10I0.IMG',
  SellMagic: 'INVE10I0.IMG',
  Repair: 'INVE12I0.IMG',
  Identify: 'INVE14I0.IMG',
});
/** sellButtonsGoldTextureName (:80), loaded in EVERY mode (:765) - not
 *  as a panel, but as the source of the select button's SELECTED
 *  state, cut out of it at selectButtonRect (:767-768). */
export const SELL_GOLD_ART = 'INVE11I0.IMG';

export const modeActionArt = (mode) => MODE_ACTION_ART[mode] ?? null;

/** The two refusal ids the Repair arm speaks (:87-88). DFU declares
 *  them a second time here; the port's repair law already owns them,
 *  so these are its bindings and not a fresh 24 and 33. The NAMES
 *  differ between the two DFU sites, which is exactly how a duplicate
 *  slips past a guard that matches on identifiers. */
export {
  DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID, MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID,
} from './repairService.js';

/** CalculateItemIdentifyCost's numerator (:1950) - `(25 * value) >> 8`. */
export const IDENTIFY_COST_MULTIPLIER = 25;

/** DaggerfallUnityItem.GetIsIdentified (:1821-1827), which is a
 *  DERIVATION and not a field:
 *
 *      if (!IsEnchanted) return true;
 *      return (flags & identifiedMask) > 0;
 *
 *  An UNENCHANTED item is ALWAYS identified - the flag only means
 *  anything for something with magic in it, which is why DFU's own
 *  comment on the member says "only relevant if item has some
 *  enchantments".
 *
 *  X7 FIX. Every reader below took `item.isIdentified` raw. The port's
 *  items are plain records that carry the field only once something
 *  has written it, so an ordinary iron dagger read `undefined` -
 *  FALSY - and therefore UNIDENTIFIED. The Identify mode would have
 *  accepted a rusty dagger and charged (25 * value) >> 8 to identify
 *  it, and the mode-action button would have lit up over a pack with
 *  no magic in it at all. It was never seen because the Identify
 *  destination has been a FLAGGED null, so the mode could not be
 *  opened; this lane opens it, so the derivation has to be right
 *  first. */
export const itemIsIdentified = (item) => !isEnchanted(item) || item?.isIdentified === true;

/** FormulaHelper.CalculateItemIdentifyCost (:1935-1955). FREE on the
 *  Witches Festival, and the guild discount applies after the shift.
 *  The holiday arm is gated on HasCurrentLocation, so identifying in
 *  the wilderness never gets the festival - the caller passes the
 *  holiday it resolved (or None off-location). */
export function calculateItemIdentifyCost(baseItemValue, { holidayId = HOLIDAYS.None, reducedIdentifyCost = null } = {}) {
  if (holidayId === HOLIDAYS.Witches_Festival) return 0;
  const cost = (IDENTIFY_COST_MULTIPLIER * baseItemValue) >> 8;
  return reducedIdentifyCost ? reducedIdentifyCost(cost) : cost;
}

/** DaggerfallTradeWindow's Identify-spell pass (:966-991).
 *
 *  The SERVICE identifies everything staged for gold; the SPELL rolls
 *  PER ITEM against the spell's own chance and charges magicka once.
 *  Three details that are easy to lose:
 *
 *   - an ALREADY-IDENTIFIED item counts as a SUCCESS rather than being
 *     skipped (:970-975), so the tally the player is shown is
 *     "how many of these do you now know", not "how many did the spell
 *     work on". In spell mode identified items can be staged at all
 *     (:823's `|| UsingIdentifySpell`), which is what makes that
 *     reachable - DFU's comment says it matches classic;
 *   - the magicka is spent ONCE for the whole list and only when the
 *     list is non-empty (:985-987) - not per item, and not per success;
 *   - a FAILED roll leaves the item unidentified and simply does not
 *     count. There is no retry cost and nothing is consumed.
 *
 *  Returns the tally DFU shows and the items it identified. */
export function identifySpellPass(items, chance, rolls = Math.random) {
  const list = items ?? [];
  const identified = [];
  let successCount = 0;
  for (const item of list) {
    if (itemIsIdentified(item)) { successCount++; continue; }   // already known counts as a success
    if (Math.floor(rolls() * 100) < chance) {                   // Dice100.SuccessRoll
      identified.push(item);
      successCount++;
    }
  }
  return { successCount, total: list.length, identified, spendMagicka: list.length > 0 };
}

/** Internal_Strings.csv:1053 - `totalIdentified,{0} out of {1} identified.` */
export const identifiedTallyText = (successCount, total) =>
  `${successCount} out of ${total} identified.`;

/** The three Buy-mode holiday halvings (:444-449), as ONE predicate
 *  per arm so each can be pinned alone. `guildFactionId` is null
 *  outside a guild - DFU's `Guild == null`. */
export function buyHolidayHalvesPrice(item, { holidayId = HOLIDAYS.None, guildFactionId = null } = {}) {
  const inGuild = guildFactionId != null;
  if (holidayId === HOLIDAYS.Merchants_Festival && !inGuild) return true;
  if (holidayId === HOLIDAYS.Tales_and_Tallow && inGuild
    && guildFactionId === GUILDS.MagesGuild.factionId) return true;
  return holidayId === HOLIDAYS.Warriors_Festival && !inGuild && item.group === 'Weapons';
}

/** One basket item's Buy price (:443-450). The halving is C# integer
 *  division on an int, so it TRUNCATES, and it lands AFTER the stack
 *  multiply rather than per unit. */
export function buyItemPrice(item, { quality = 0, priceAdjustment = 1000, holidayId = HOLIDAYS.None, guildFactionId = null } = {}) {
  const price = calculateCost(item.value, quality, priceAdjustment) * (item.stackCount ?? 1);
  return buyHolidayHalvesPrice(item, { holidayId, guildFactionId })
    ? Math.trunc(price / 2) : price;
}

/**
 * UpdateCostAndGold (:425-489). Answers the cost strip's number and
 * whether the mode-action button is ENABLED - which is the same walk,
 * because DFU sets `modeActionEnabled = true` from inside each arm
 * and an arm that skips every item leaves the button dead.
 *
 * `staged` is the basket in Buy mode and the remote list in every
 * other. Repair skips an item already being repaired and Identify
 * skips one already identified, so a list of nothing BUT those totals
 * zero AND cannot be committed - the two are one fact.
 */
export function tradeCost(mode, staged = [], {
  quality = 0, priceAdjustment = 1000, holidayId = HOLIDAYS.None,
  guildFactionId = null, reducedRepairCost = null, reducedIdentifyCost = null,
  usingIdentifySpell = false, isBeingRepaired = () => false,
} = {}) {
  let cost = 0;
  let modeActionEnabled = false;
  for (const item of staged) {
    const stack = item.stackCount ?? 1;
    switch (mode) {
      case 'Buy':
        modeActionEnabled = true;
        cost += buyItemPrice(item, { quality, priceAdjustment, holidayId, guildFactionId });
        break;
      case 'Sell':
        modeActionEnabled = true;
        // NOT by condition - see the header. DFU passes
        // ConditionPercentage into a slot CalculateCost never reads.
        cost += calculateCost(item.value, quality, priceAdjustment) * stack;
        break;
      case 'SellMagic':
        // DFU's own TODO sits on this line: "Fencing base price higher
        // and guild rep affects it". Until it does, SellMagic is Sell
        // WITHOUT the stack multiply - a stack of five soul gems fences
        // for the price of one. Verbatim, and deliberately not "fixed".
        modeActionEnabled = true;
        cost += calculateCost(item.value, quality, priceAdjustment);
        break;
      case 'Repair':
        if (isBeingRepaired(item)) break;
        modeActionEnabled = true;
        cost += calculateItemRepairCost(item.value, quality, item.currentCondition ?? 0, item.maxCondition ?? 0,
          { reducedRepairCost, priceAdjustment }) * stack;
        break;
      case 'Identify':
        if (itemIsIdentified(item)) break;
        modeActionEnabled = true;
        // "Identify spell remains free" (:479-481) - the button still
        // enables, so the spell can be cast on a list that costs nothing.
        if (!usingIdentifySpell) {
          cost += calculateItemIdentifyCost(item.value, { holidayId, reducedIdentifyCost });
        }
        break;
      default:
        break;
    }
  }
  return { cost, modeActionEnabled };
}

/** GetTradePrice (:492-509). Buy and Repair haggle as a PURCHASE,
 *  Sell and SellMagic as a SALE, and Identify does not haggle at all -
 *  its cost is the price. DFU THROWS on any other mode rather than
 *  returning the cost, so Inventory mode reaching here is a bug and
 *  says so. */
export function getTradePrice(mode, cost, quality, skills) {
  switch (mode) {
    case 'Buy':
    case 'Repair':
      return calculateTradePrice(cost, quality, skills, false);
    case 'Sell':
    case 'SellMagic':
      return calculateTradePrice(cost, quality, skills, true);
    case 'Identify':
      return cost;
    default:
      throw new Error(`Unexpected windowMode: ${mode}`);
  }
}

/** ShowTradePopup's record offset (:1102-1113). The three haggle bands
 *  are cureOfferMessageOffset's - DFU wrote the same comparison twice
 *  and the port keeps one home - and the SELL modes then step three
 *  records further on to their own set. */
export function tradeMessageOffset(mode, cost, tradePrice) {
  const band = cureOfferMessageOffset(cost, tradePrice);
  return (mode === 'Sell' || mode === 'SellMagic') ? band + 3 : band;
}

/** ShowTradePopup as a decision (:1100-1134). A BUYING mode with too
 *  little gold gets the two records CONCATENATED into one
 *  click-anywhere box and no Yes/No at all - the deal is refused
 *  before it is offered, which is the opposite of the tavern's order
 *  and of the temple's. A SELLING mode never checks gold, because the
 *  gold is coming the other way. */
export function tradeDecision(mode, { cost, tradePrice, gold = 0 }) {
  const textId = TRADE_MESSAGE_BASE_ID + tradeMessageOffset(mode, cost, tradePrice);
  const selling = mode === 'Sell' || mode === 'SellMagic';
  if (!selling && gold < tradePrice) {
    return { kind: 'notEnoughGold', textIds: [textId, NOT_ENOUGH_GOLD_ID], price: tradePrice };
  }
  return { kind: 'offer', textId, price: tradePrice };
}

/** ConfirmTrade's SELL arm (:1035-1050): the proceeds are weighed
 *  BEFORE they are paid, and a purse that would push the player past
 *  MaxEncumbrance becomes a LETTER OF CREDIT for the full amount
 *  instead - added to the FRONT of the pack, and announced with
 *  parchment rather than coins. The weight test uses the same
 *  0.0025 kg/piece the character sheet's encumbrance line does. */
export function sellProceeds(tradePrice, { carriedWeightKg = 0, maxEncumbranceKg = Infinity } = {}) {
  const goldWeight = tradePrice * GOLD_PIECE_WEIGHT_KG;
  return (carriedWeightKg + goldWeight <= maxEncumbranceKg)
    ? { kind: 'gold', amount: tradePrice }
    : { kind: 'letterOfCredit', amount: tradePrice };
}

/** FilterLocalItems' mode gate (:672-703). The player's own pack is
 *  shown WHOLE in most modes, but the two selling modes narrow it:
 *  Sell to the groups this shop actually buys (storeBuysItemType, the
 *  port's shopBuysItem), SellMagic to ENCHANTED items only. An
 *  equipped item never appears in any mode, which is the port's
 *  existing AUDIT 17e F4 rule reaching the same conclusion DFU does.
 *  Note SellMagic does NOT also apply the shop's accepted groups - a
 *  fence takes an enchanted item the shop would refuse plain. */
export function localListAccepts(mode, item, { accepts = () => true, enchanted = () => false } = {}) {
  if (mode === 'Sell') return accepts(item);
  if (mode === 'SellMagic') return enchanted(item);
  return true;
}

/** LocalItemListScroller_OnItemClick as a decision (:788-826). A click
 *  on the player's own item either STAGES it or is REFUSED with a
 *  box, and which of the two is entirely mode-dependent:
 *    Sell/SellMagic - always stages (the list is already filtered)
 *    Repair         - the three refusals, in DFU's own click order
 *    Identify       - refused when the item is already identified,
 *                     UNLESS the spell is in use ("matches classic")
 *    Buy            - a BASKET item clicks back out to the shelf;
 *                     anything else is the equip path, not a trade
 *  Answers { kind: 'stage' } | { kind: 'unstage' } | { kind: 'refuse',
 *  textId | text } | { kind: 'ignore' }. */
export function localClickDecision(mode, item, {
  inBasket = () => false, allowMagicRepairs = false, usingIdentifySpell = false,
} = {}) {
  switch (mode) {
    case 'Sell':
    case 'SellMagic':
      return { kind: 'stage' };
    case 'Repair': {
      const refusal = repairRefusal(item, { allowMagicRepairs });
      if (!refusal) return { kind: 'stage' };
      return { kind: 'refuse', refusal };
    }
    case 'Identify':
      return (!itemIsIdentified(item) || usingIdentifySpell)
        ? { kind: 'stage' }
        : { kind: 'refuse', refusal: 'identified' };
    case 'Buy':
      return inBasket(item) ? { kind: 'unstage' } : { kind: 'ignore' };
    default:
      return { kind: 'ignore' };
  }
}

/** "doesntNeedIdentify" - Internal_Strings, recovered. */
export const DOESNT_NEED_IDENTIFY = 'This item does not need to be identified.';

// FLAGGED, with the slices they wait on:
//  - the IDENTIFY SPELL arm (:956-996): DoModeAction has a whole
//    second path where the Identify spell pays in MAGICKA and rolls
//    per item, telling the player "N of M identified". It needs the
//    Identify effect wired to a window entry point, which the magic
//    arc owns.
//  - the LETTER OF CREDIT is minted here as a decision and the item
//    itself waits on banking (there is nowhere to cash one yet).
//  - SellMagic's "fencing base price" TODO is DFU's own and stays open
//    in both codebases.
