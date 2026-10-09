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
import { remainsFit, recordFits } from '../net/wildLaw.js';   // INT9: one remains' bound, the room's own
import { RECEIVER_MARKS, tradeableRecord } from '../net/realmTradeLaw.js';
import { liquidWorthOf } from '../net/realmGoldLaw.js';   // INT9 (AUDIT): a letter's worth, the judge's wealth's own
import { goldStack } from './inventory.js';
import { isWalletItem, walletHolds } from './walletItem.js';   // KEEP-WALLET
import { classicPiece, itemWorth } from './itemLaw.js';   // INT9: a classic save's piece stays its character's

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


/** INT9 (AUDIT): THE KILLER'S PIECE - the worn offer's `w`th (wornOffer), or, where the relay signed what the offer showed
 *  (`wt`, `[templateIndex, material]` - net/wildReceipt.js), the piece worn now that is that: the `w`th when it still is,
 *  else the first that is, else none (AUDIT INT9: the place alone was an index into a list the fallen built). */
export function wildPickOf(items, w = -1, wt = null) {
  if (!Number.isInteger(w) || w < 0) return null;
  const offer = wornOffer(items);
  if (!Array.isArray(wt)) return offer[w] ?? null;
  const is = (/** @type {any} */ it) => !!it && it.templateIndex === wt[0] && (it.material ?? 0) === wt[1];
  return is(offer[w]) ? offer[w] : (offer.find(is) ?? null);
}

/** INT9 (AUDIT): EVERY PIECE A DEATH COULD TAKE out of `entity` (its killer's piece, the bag's and the cart's drop) -
 *  unfitted, untouched. The account service asks the ledger of all of them before it takes any (AUDIT INT9: it asked of
 *  a dry run's fitted few, and a piece kept back let in one it never asked of). */
export function wildDropCandidates(entity, w = -1, wt = null) {
  const bag = Array.isArray(entity?.items) ? entity.items : [];
  const cart = Array.isArray(entity?.wagonItems) ? entity.wagonItems : [];
  const k = wildPickOf(bag, w, wt);
  const drop = [...bag.filter((it) => !isEquipped(it) && wildCanLose(it)), ...cart.filter((it) => wildCanLose(it))];
  return k ? [k, ...drop] : drop;
}

/** A piece's worth to the drop's order: a coin or a letter at its gold, any other at its worth (the judge's wealth's own
 *  measure - itemLaw.js itemWorth). */
const dropWorth = (/** @type {any} */ it) => { const l = liquidWorthOf(it); return l > 0 ? l : itemWorth(it); };

/**
 * INT9: A DEATH'S WHOLE TAKE, in place, off `entity` - a live character or a judged record alike (`items`, `wagonItems`,
 * `goldPieces`): the killer's worn piece first (wildPickOf - `w` its place in wornOffer, `wt` what the offer showed;
 * -1 none), then the purse's and the cart's share of their gold, then the bag's and the cart's drop BY WORTH, the most
 * first - every piece `keep` names left where it lies, and one heavier than a remains' record (net/wildLaw.js recordFits)
 * left too - fitted to one remains (remainsFit), and what does not fit put back where it came from (AUDIT INT9: the
 * purse came last, so a bag of junk ahead of it kept the gold and the valuables; and a coin's share put back went into
 * the purse, the cart's too). The record's lit light (`lightSourceIndex`, an index into `items` - systems/save.js)
 * follows its piece. Answers `{ taken, from, records, killer, gold }`: the pieces taken (the gold a stack of it), where
 * each came from ('bag', 'cart', 'gold'), their wire records in that order, whether the first is the killer's, and the
 * gold taken `{ purse, cart }`. The account service runs it on the record (server-account/src/wild.js) and answers what
 * it took; the fallen's game takes out exactly that (wildTakeTook) - it never guesses what the ledger kept.
 * @param {any} entity @param {number} [w] @param {(item: any) => boolean} [keep] @param {number[] | null} [wt]
 */
export function takeWildDeath(entity, w = -1, keep = () => false, wt = null) {
  const bag = Array.isArray(entity?.items) ? entity.items : [];
  const cart = Array.isArray(entity?.wagonItems) ? entity.wagonItems : [];
  const lit = Number.isSafeInteger(entity?.lightSourceIndex) && entity.lightSourceIndex >= 0 ? bag[entity.lightSourceIndex] : undefined;
  /** @type {[any, string][]} each piece taken, and where it came from */
  const took = [];
  const k = wildPickOf(bag, w, wt);
  if (k && !keep(k) && recordFits(wildRecord(k))) { bag.splice(bag.indexOf(k), 1); took.push([k, 'bag']); }
  const killer = took.length > 0;
  // the gold, second: the purse's share and the cart's
  const cartCoin = cart.find((i) => i?.group === 'Currency') ?? null;
  const purse0 = Math.max(0, Math.floor(entity?.goldPieces ?? 0)), cart0 = cartCoin ? Math.max(0, Math.floor(cartCoin.stackCount ?? 1)) : 0;
  const coin = takeWildGold(entity);
  const gold = { purse: coin ? purse0 - Math.max(0, Math.floor(entity.goldPieces ?? 0)) : 0, cart: coin && cartCoin ? cart0 - Math.max(0, Math.floor(cartCoin.stackCount ?? 0)) : 0 };
  if (coin) took.push([coin, 'gold']);
  // a piece kept stands aside while the drop is taken, and comes back to its place
  const aside = (/** @type {any[]} */ list) => {
    const held = list.map((it, i) => (keep(it) || (wildCanLose(it) && !recordFits(wildRecord(it))) ? [i, it] : null)).filter((x) => x !== null);
    for (let n = held.length - 1; n >= 0; n--) list.splice(/** @type {any} */ (held[n])[0], 1);
    return held;
  };
  const back = (/** @type {any[]} */ list, /** @type {any[]} */ held) => { for (const [i, it] of held) list.splice(Math.min(i, list.length), 0, it); };
  const hb = aside(bag), hc = aside(cart);
  /** @type {[any, string][]} */
  const drop = [...takeWildDrop(bag).map((it) => /** @type {[any, string]} */ ([it, 'bag'])), ...takeWildDrop([], cart).map((it) => /** @type {[any, string]} */ ([it, 'cart']))];
  back(bag, hb); back(cart, hc);
  const worth = new Map(drop.map(([it]) => [it, dropWorth(it)]));
  drop.sort((a, b) => worth.get(b[0]) - worth.get(a[0]));   // stable: equal worth keeps the pack's order
  took.push(...drop);
  const records = remainsFit(took.map(([it]) => wildRecord(it)));
  for (const [it, from] of took.slice(records.length)) {
    if (from === 'bag') bag.push(it);
    else if (from === 'cart') cart.push(it);
    else {
      entity.goldPieces = Math.max(0, Math.floor(entity.goldPieces ?? 0)) + gold.purse;
      if (cartCoin) cartCoin.stackCount = Math.max(0, Math.floor(cartCoin.stackCount ?? 0)) + gold.cart;
      gold.purse = 0; gold.cart = 0;
    }
  }
  if (lit !== undefined) entity.lightSourceIndex = bag.indexOf(lit);
  const kept = took.slice(0, records.length);
  return { taken: kept.map(([it]) => it), from: kept.map(([, f]) => f), records, killer: killer && records.length > 0, gold };
}

/** INT9 (AUDIT): WHAT THE SERVICE TOOK, as the fallen's game finds it again - a piece's own marks (`g` group, `t`
 *  template, `m` material, `u` its id, `p` its craft's provenance, `n` its stack, `f` where it lay). */
export const wildTookOf = (/** @type {any[]} */ taken, /** @type {string[]} */ from) => taken.map((it, i) => ({ g: it.group ?? null, t: it.templateIndex ?? null, m: it.material ?? 0, u: typeof it.uid === 'string' ? it.uid : null, p: typeof it.provenance === 'string' ? it.provenance : null, n: Math.max(1, Math.floor(it.stackCount ?? 1)), f: from[i] })).filter((x) => x.f !== 'gold');

/**
 * INT9 (AUDIT): THE FALLEN'S GAME TAKES OUT EXACTLY WHAT THE SERVICE TOOK off its record (`took` - wildTookOf; `gold` -
 * `{ purse, cart }`), in place: each piece found by its id or its craft's provenance, else by its marks, in the list it
 * lay in; the purse and the cart's coin lowered by their shares. Never the law run again on the live pack (AUDIT INT9:
 * the game ran it without the ledger's word, and took what the service kept). Answers the pieces taken out.
 * @param {any} entity @param {any[]} took @param {{ purse?: number, cart?: number } | null} gold
 */
export function wildTakeTook(entity, took, gold) {
  const out = [];
  for (const s of Array.isArray(took) ? took : []) {
    const list = s?.f === 'cart' ? entity?.wagonItems : entity?.items;
    if (!Array.isArray(list)) continue;
    const same = (/** @type {any} */ it) => !!it && (s.u ? it.uid === s.u : s.p ? it.provenance === s.p
      : !it.uid && !it.provenance && it.group === s.g && it.templateIndex === s.t && (it.material ?? 0) === s.m && Math.max(1, Math.floor(it.stackCount ?? 1)) === s.n);
    const i = list.findIndex(same);
    if (i >= 0) out.push(list.splice(i, 1)[0]);
  }
  const purse = Math.max(0, Math.floor(gold?.purse ?? 0)), cart = Math.max(0, Math.floor(gold?.cart ?? 0));
  if (purse) entity.goldPieces = Math.max(0, Math.floor(entity.goldPieces ?? 0) - purse);
  const coin = cart && Array.isArray(entity?.wagonItems) ? entity.wagonItems.find((i) => i?.group === 'Currency') : null;
  if (coin) coin.stackCount = Math.max(0, Math.floor(coin.stackCount ?? 1) - cart);
  return out;
}
