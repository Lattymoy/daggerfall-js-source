// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07) - A DEATH IN THE OPEN ZONE: WHAT STAYS, WHAT DROPS, WHAT A KILLER MAY TAKE - THE LAW
// (bible/11-Multiplayer/Wild-Zone.md; systems/wildDeath.js says the owner's words and re-exports every member here).
//
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md): ITS HOME SINCE, A LEAF THE ACCOUNT
// WORKER BUNDLES. A death in the zone drops what the ACCOUNT SERVICE takes off the fallen character's judged record
// (server-account/src/wild.js), never what the fallen's own game hands over - so the drop, the purse's share and the
// killer's worn piece are one law at both ends: the fallen's game takes the same out of its own pack as the service takes
// out of the record, and only the service's list is ever deposited. Every import a leaf the Worker already reads (the
// trade's refusals over plain data - net/realmTradeLaw.js tradeableRecord, the pack's own refusal's law - never the
// pack's module).
// ═══════════════════════════════════════════════════════════════════
import { isPotion, isLightSource, TEMPLATES } from './itemKinds.js';
import { isSurvivalItem } from './survival/items.js';
import { isFood, isWaterskin } from './survival/food.js';
import { isRestItem } from './restItemRows.js';
import { isAmmunition } from './itemTemplates.js';
import { BANDAGE_TEMPLATE } from './rriRealism.js';
import { isEquipped } from './equip.js';
import { DECOR_OWN_KEPT_BACK } from '../net/decorLaw.js';
import { WILD_ITEMS_MAX } from '../net/wire.js';
import { remainsFit } from '../net/wildLaw.js';   // INT9: one remains' bound, the room's own
import { RECEIVER_MARKS, tradeableRecord } from '../net/realmTradeLaw.js';
import { goldStack } from './inventory.js';
import { isWalletItem, walletHolds } from './walletItem.js';   // KEEP-WALLET
import { classicPiece } from './itemLaw.js';   // INT9: a classic save's piece stays its character's

/** The groups no death in the zone ever drops: a vehicle, a deed, a quest's own item. */
export const WILD_NEVER_GROUPS = Object.freeze(new Set(['Transportation', 'Deeds', 'QuestItems', 'Currency']));

/** "except campfires, torches, potions etc" - is this a consumable the fallen keep? */
export function keptOnWildDeath(item) {
  if (!item) return true;
  return isPotion(item) || isLightSource(item) || isSurvivalItem(item) || isFood(item) || isWaterskin(item)
    || isRestItem(item) || isAmmunition(item) || (item.group === 'UselessItems2' && item.templateIndex === BANDAGE_TEMPLATE);
}

/** May this piece leave its owner at a death in the zone at all? Worn or not - the trade's own refusals over a copy
 *  that is not worn (its `isEquipped` arm is the only one that asks where the piece is), and the kept-back list. */
export function wildCanLose(item) {
  if (!item || keptOnWildDeath(item)) return false;
  // LETTERS-DROP (the owner: "letter of credits should be dropped"): a letter of credit is the one piece of the wallet's
  // that a death in the zone takes, as a coin of the purse is - the Embers and the Shards stay
  if (item.group === 'MiscItems' && item.templateIndex === TEMPLATES.Letter_of_credit && !item.questItem) return tradeableRecord({ ...item, equipSlot: undefined });
  if (WILD_NEVER_GROUPS.has(item.group) || DECOR_OWN_KEPT_BACK.has(item.templateIndex) || item.templateIndex === TEMPLATES.Spellbook) return false;
  // KEEP-WALLET (2026-10-09, the owner: "the wallet shouldnt drop in the zone"): the wallet is an organizer - its pieces
  // lie in the pack itself; the Deadlands Embers and the Welkynd Shards stay with the fallen, as the wallet does (bound
  // already) - the letters of credit drop (LETTERS-DROP, above)
  if (isWalletItem(item) || walletHolds(item)) return false;
  // INT9: a classic save's piece is its character's for good (systems/itemLaw.js classicPiece - "Keep all, can't sell"):
  // no route hands it to another player, and a death's remains are taken by anyone
  if (classicPiece(item)) return false;
  return tradeableRecord({ ...item, equipSlot: undefined });   // the trade's refusals over plain data (net/realmTradeLaw.js)
}

/**
 * THE DROP: what a death in the zone takes out of the bag (`items`, never a worn piece) and the cart (`wagon`) -
 * REMOVED from both lists, in their order, and handed back to be deposited. Pure over the two arrays it is given.
 */
export function takeWildDrop(items, wagon = null) {
  const lift = (list, worn) => {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if ((worn && isEquipped(it)) || !wildCanLose(it)) continue;
      list.splice(i, 1);
      out.unshift(it);
    }
    return out;
  };
  return [...lift(items, true), ...lift(wagon, false)];
}

/** WILD GOLD: a death in the zone drops this share of the gold carried (no usual death penalty) into the remains. */
export const WILD_GOLD_LOSS = 0.5;

/** Take WILD_GOLD_LOSS of the purse (`entity.goldPieces`) AND of the cart's gold stack (the `Currency` item in
 *  `entity.wagonItems`), in place; answers the gold as ONE pile record (purse + cart share), or null. */
export function takeWildGold(entity) {
  let take = 0;
  const have = Math.max(0, Math.floor(entity?.goldPieces ?? 0));
  const purse = Math.floor(have * WILD_GOLD_LOSS);
  if (purse >= 1) { entity.goldPieces = have - purse; take += purse; }
  const cart = Array.isArray(entity?.wagonItems) ? entity.wagonItems.find((i) => i?.group === 'Currency') : null;
  if (cart) {
    const n = Math.max(0, Math.floor(cart.stackCount ?? 1));
    const share = Math.floor(n * WILD_GOLD_LOSS);
    if (share >= 1) { cart.stackCount = n - share; take += share; }
  }
  return take >= 1 ? goldStack(take) : null;
}

/** THE KILLER'S CHOICE: the worn pieces a body offers - worn, and a death may let them go - at most WILD_ITEMS_MAX. */
export const wornOffer = (items) => (Array.isArray(items) ? items.filter((it) => it && isEquipped(it) && wildCanLose(it)).slice(0, WILD_ITEMS_MAX) : []);

/** A record for the wire: a plain-data copy with the RECEIVER's marks off (its slot, its quest - loot.js's own clamp
 *  strips them too; never sent is better than stripped). */
export function wildRecord(item) {
  const copy = JSON.parse(JSON.stringify(item));
  for (const k of RECEIVER_MARKS) delete copy[k];   // ACQUIRE1's `acquired` among them; MARK-WIRE: one list (net/realmTradeLaw.js)
  return copy;
}


/**
 * INT9: A DEATH'S WHOLE TAKE, in place, off `entity` - a live character or a judged record alike (`items`, `wagonItems`,
 * `goldPieces`): the killer's worn piece first (`w`, its place in wornOffer; -1 none), then the bag's and the cart's drop,
 * then the purse's share - every piece `keep` names left where it lies - fitted to one remains (net/wildLaw.js
 * remainsFit), and what does not fit put back where it came from (a coin's share into the purse). Answers `{ taken,
 * records, killer }`: the pieces taken (the purse's share a stack of gold), their wire records in that order, and whether
 * the first is the killer's. ONE LAW AT BOTH ENDS: the account service runs it on the record (server-account/src/wild.js)
 * and the fallen's game on its own pack before it asks, so the two agree to the piece.
 * @param {any} entity @param {number} [w] @param {(item: any) => boolean} [keep]
 */
export function takeWildDeath(entity, w = -1, keep = () => false) {
  const bag = Array.isArray(entity?.items) ? entity.items : [];
  const cart = Array.isArray(entity?.wagonItems) ? entity.wagonItems : [];
  /** @type {[any, any[] | null][]} each piece taken, and the list it came out of (null: the purse) */
  const took = [];
  if (Number.isInteger(w) && w >= 0) {
    const it = wornOffer(bag)[w];
    if (it && !keep(it)) { bag.splice(bag.indexOf(it), 1); took.push([it, bag]); }
  }
  const killer = took.length > 0;
  // a piece kept stands aside while the drop is taken, and comes back to its place
  const aside = (/** @type {any[]} */ list) => {
    const held = list.map((it, i) => (keep(it) ? [i, it] : null)).filter((x) => x !== null);
    for (let k = held.length - 1; k >= 0; k--) list.splice(/** @type {any} */ (held[k])[0], 1);
    return held;
  };
  const back = (/** @type {any[]} */ list, /** @type {any[]} */ held) => { for (const [i, it] of held) list.splice(Math.min(i, list.length), 0, it); };
  const hb = aside(bag), hc = aside(cart);
  for (const it of takeWildDrop(bag)) took.push([it, bag]);
  for (const it of takeWildDrop([], cart)) took.push([it, cart]);
  back(bag, hb); back(cart, hc);
  const gold = takeWildGold(entity);
  if (gold) took.push([gold, null]);
  const records = remainsFit(took.map(([it]) => wildRecord(it)));
  for (const [it, from] of took.slice(records.length)) {
    if (from) from.push(it);
    else entity.goldPieces = Math.max(0, Math.floor(entity.goldPieces ?? 0)) + Math.max(1, Math.floor(it.stackCount ?? 1));
  }
  return { taken: took.slice(0, records.length).map(([it]) => it), records, killer: killer && records.length > 0 };
}
