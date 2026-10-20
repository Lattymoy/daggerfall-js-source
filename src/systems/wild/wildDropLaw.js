// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07) - A DEATH IN THE OPEN ZONE: WHAT STAYS, WHAT DROPS, WHAT A KILLER MAY TAKE - THE LAW
// (bible/11-Multiplayer/Wild-Zone.md; systems/wild/wildDeath.js says the owner's words and re-exports every member here).
//
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md): ITS HOME SINCE, A LEAF THE ACCOUNT
// WORKER BUNDLES. A death in the zone drops what the ACCOUNT SERVICE takes off the fallen character's judged record
// (server-account/src/wild.js), never what the fallen's own game hands over - so the drop, the purse's share and the
// killer's worn piece are one law at both ends: the fallen's game takes the same out of its own pack as the service takes
// out of the record, and only the service's list is ever deposited. Every import a leaf the Worker already reads (the
// trade's refusals over plain data - net/realm/realmTradeLaw.js tradeableRecord, the pack's own refusal's law - never the
// pack's module).
// ═══════════════════════════════════════════════════════════════════
import { isPotion, isLightSource, TEMPLATES } from '../item/itemKinds.js';
import { isSurvivalItem } from '../survival/items.js';
import { isFood, isWaterskin } from '../survival/food.js';
import { isRestItem } from '../rest/restItemRows.js';
import { isAmmunition } from '../item/itemTemplates.js';
import { BANDAGE_TEMPLATE } from '../roleplayRealismItems/rriRealism.js';
import { isEquipped } from '../equip.js';
import { DECOR_OWN_KEPT_BACK } from '../../net/decorLaw.js';
import { WILD_ITEMS_MAX } from '../../net/wire.js';
import { remainsFit, recordFits } from '../../net/wild/wildLaw.js';   // INT9: one remains' bound, the room's own
import { RECEIVER_MARKS, tradeableRecord } from '../../net/realm/realmTradeLaw.js';
import { liquidWorthOf, NAVAL_VENDOR, REVENANT_VENDOR } from '../../net/realm/realmGoldLaw.js';   // INT9 (AUDIT): a letter's worth, the judge's wealth's own; COMPANION-DROP: where a save keeps the companions
import { goldStack } from '../inventory.js';
import { isWalletItem, walletHolds } from '../walletItem.js';   // KEEP-WALLET
import { classicPiece, itemWorth } from '../item/itemLaw.js';   // INT9: a classic save's piece stays its character's
import { HCC_VENDOR, WAGON_MODE } from '../horse/horseCartLaw.js';   // CART-AWAY: the wagon's record, the mod's own words (a leaf the Worker bundles already)

// The groups no death in the zone ever drops: a leaf of their own (wildLeaf.js), re-exported for the drop's readers.
import { WILD_NEVER_GROUPS } from './wildLeaf.js';
export { WILD_NEVER_GROUPS };

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
  // INT9: a classic save's piece is its character's for good (systems/item/itemLaw.js classicPiece - "Keep all, can't sell"):
  // no route hands it to another player, and a death's remains are taken by anyone
  if (classicPiece(item)) return false;
  return tradeableRecord({ ...item, equipSlot: undefined });   // the trade's refusals over plain data (net/realm/realmTradeLaw.js)
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

/** A list's gold stack (its `Currency` item) - the cart's, a companion's pack's - or null. */
const coinIn = (/** @type {any} */ list) => (Array.isArray(list) ? list.find((i) => i?.group === 'Currency') ?? null : null);

/** Take WILD_GOLD_LOSS of the purse (`entity.goldPieces`) AND of the cart's gold stack (the `Currency` item in
 *  `entity.wagonItems`), in place; answers the gold as ONE pile record (purse + cart share), or null. CART-AWAY (Mac,
 *  2026-10-15): `cart` false - the wagon away from the death (wildCartMayBeAway) - and the purse's share alone.
 *  COMPANION-DROP: and of each pack at the side's gold stack (`packs` - wildPacks; a record's own, wildPacksOf, by
 *  default), into the same pile.
 *  @param {any} entity @param {{ cart?: boolean, packs?: WildPack[] }} [opts] */
export function takeWildGold(entity, { cart: withCart = true, packs = wildPacksOf(entity) } = {}) {
  let take = 0;
  const have = Math.max(0, Math.floor(entity?.goldPieces ?? 0));
  const purse = Math.floor(have * WILD_GOLD_LOSS);
  if (purse >= 1) { entity.goldPieces = have - purse; take += purse; }
  const cart = withCart && Array.isArray(entity?.wagonItems) ? entity.wagonItems.find((i) => i?.group === 'Currency') : null;
  for (const coin of [cart, ...packs.map((p) => coinIn(p.items))]) {
    if (!coin) continue;
    const n = Math.max(0, Math.floor(coin.stackCount ?? 1));
    const share = Math.floor(n * WILD_GOLD_LOSS);
    if (share >= 1) { coin.stackCount = n - share; take += share; }
  }
  return take >= 1 ? goldStack(take) : null;
}

/** THE KILLER'S CHOICE: the worn pieces a body offers - worn, and a death may let them go - at most WILD_ITEMS_MAX. */
export const wornOffer = (items) => (Array.isArray(items) ? items.filter((it) => it && isEquipped(it) && wildCanLose(it)).slice(0, WILD_ITEMS_MAX) : []);

/** A record for the wire: a plain-data copy with the RECEIVER's marks off (its slot, its quest - loot.js's own clamp
 *  strips them too; never sent is better than stripped). */
export function wildRecord(item) {
  const copy = JSON.parse(JSON.stringify(item));
  for (const k of RECEIVER_MARKS) delete copy[k];   // ACQUIRE1's `acquired` among them; MARK-WIRE: one list (net/realm/realmTradeLaw.js)
  return copy;
}


/** INT9 (AUDIT): THE KILLER'S PIECE - the worn offer's `w`th (wornOffer), or, where the relay signed what the offer showed
 *  (`wt`, `[templateIndex, material]` - net/wild/wildReceipt.js), the piece worn now that is that: the `w`th when it still is,
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
 *  a dry run's fitted few, and a piece kept back let in one it never asked of). CART-AWAY: `cart` false, none of the
 *  cart's (takeWildDeath's own option). COMPANION-DROP: and every pack's at the side (`packs`, takeWildDeath's own).
 *  @param {any} entity @param {number} [w] @param {number[] | null} [wt] @param {{ cart?: boolean, packs?: WildPack[] }} [opts] */
export function wildDropCandidates(entity, w = -1, wt = null, { cart: withCart = true, packs = wildPacksOf(entity) } = {}) {
  const bag = Array.isArray(entity?.items) ? entity.items : [];
  const cart = withCart && Array.isArray(entity?.wagonItems) ? entity.wagonItems : [];
  const k = wildPickOf(bag, w, wt);
  const drop = [...bag.filter((it) => !isEquipped(it) && wildCanLose(it)), ...cart.filter((it) => wildCanLose(it)), ...packs.flatMap((p) => p.items.filter((it) => wildCanLose(it)))];
  return k ? [k, ...drop] : drop;
}

/** A piece's worth to the drop's order: a coin or a letter at its gold, any other at its worth (the judge's wealth's own
 *  measure - itemLaw.js itemWorth). */
const dropWorth = (/** @type {any} */ it) => { const l = liquidWorthOf(it); return l > 0 ? l : itemWorth(it); };

/**
 * INT9: A DEATH'S WHOLE TAKE, in place, off `entity` - a live character or a judged record alike (`items`, `wagonItems`,
 * `goldPieces`): the killer's worn piece first (wildPickOf - `w` its place in wornOffer, `wt` what the offer showed;
 * -1 none), then the purse's and the cart's share of their gold, then the bag's and the cart's drop BY WORTH, the most
 * first - every piece `keep` names left where it lies, and one heavier than a remains' record (net/wild/wildLaw.js recordFits)
 * left too - fitted to one remains (remainsFit), and what does not fit put back where it came from (AUDIT INT9: the
 * purse came last, so a bag of junk ahead of it kept the gold and the valuables; and a coin's share put back went into
 * the purse, the cart's too). The record's lit light (`lightSourceIndex`, an index into `items` - systems/save/save.js)
 * follows its piece. Answers `{ taken, from, records, killer, gold }`: the pieces taken (the gold a stack of it), where
 * each came from ('bag', 'cart', 'gold'), their wire records in that order, whether the first is the killer's, and the
 * gold taken `{ purse, cart }`. The account service runs it on the record (server-account/src/wild.js) and answers what
 * it took; the fallen's game takes out exactly that (wildTakeTook) - it never guesses what the ledger kept.
 * CART-AWAY (Mac, 2026-10-15: "if its parked outside the zone nothing should be lost"): `cart` false - the wagon away
 * from the death, parked off the zone, stabled or none (the service's word, wildCartMayBeAway) - takes nothing of the
 * cart, neither a piece nor its coin's share; the bag and the purse as ever.
 * COMPANION-DROP (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Bag drops; no send-off in zone"): AND EVERY PACK AT
 * THE FALLEN'S SIDE (`packs` - wildPacks: a crew hand's ashore, a sworn one's at the side and its kit; a record's own,
 * wildPacksOf, by default) as the cart is - its pieces in the drop by worth (`from` its word, WILD_PACK), its coin's
 * share in the pile (`gold.packs`, by that word), what does not fit put back in it.
 * @param {any} entity @param {number} [w] @param {(item: any) => boolean} [keep] @param {number[] | null} [wt]
 * @param {{ cart?: boolean, packs?: WildPack[] }} [opts]
 */
export function takeWildDeath(entity, w = -1, keep = () => false, wt = null, { cart: withCart = true, packs = wildPacksOf(entity) } = {}) {
  const bag = Array.isArray(entity?.items) ? entity.items : [];
  const cart = withCart && Array.isArray(entity?.wagonItems) ? entity.wagonItems : [];
  const lit = Number.isSafeInteger(entity?.lightSourceIndex) && entity.lightSourceIndex >= 0 ? bag[entity.lightSourceIndex] : undefined;
  /** @type {[any, string][]} each piece taken, and where it came from */
  const took = [];
  const k = wildPickOf(bag, w, wt);
  if (k && !keep(k) && recordFits(wildRecord(k))) { bag.splice(bag.indexOf(k), 1); took.push([k, 'bag']); }
  const killer = took.length > 0;
  // the gold, second: the purse's share and the cart's - COMPANION-DROP: and each pack's at the side
  const cartCoin = cart.find((i) => i?.group === 'Currency') ?? null;
  const purse0 = Math.max(0, Math.floor(entity?.goldPieces ?? 0)), cart0 = cartCoin ? Math.max(0, Math.floor(cartCoin.stackCount ?? 1)) : 0;
  const packCoins = packs.map((p) => coinIn(p.items)), pack0 = packCoins.map((c) => (c ? Math.max(0, Math.floor(c.stackCount ?? 1)) : 0));
  const coin = takeWildGold(entity, { cart: withCart, packs });
  /** @type {{ purse: number, cart: number, packs?: Record<string, number> }} */
  const gold = { purse: coin ? purse0 - Math.max(0, Math.floor(entity.goldPieces ?? 0)) : 0, cart: coin && cartCoin ? cart0 - Math.max(0, Math.floor(cartCoin.stackCount ?? 0)) : 0 };
  packCoins.forEach((c, i) => { const n = c ? pack0[i] - Math.max(0, Math.floor(c.stackCount ?? 0)) : 0; if (n > 0) (gold.packs ??= {})[packs[i].f] = n; });
  if (coin) took.push([coin, 'gold']);
  // a piece kept stands aside while the drop is taken, and comes back to its place
  const aside = (/** @type {any[]} */ list) => {
    const held = list.map((it, i) => (keep(it) || (wildCanLose(it) && !recordFits(wildRecord(it))) ? [i, it] : null)).filter((x) => x !== null);
    for (let n = held.length - 1; n >= 0; n--) list.splice(/** @type {any} */ (held[n])[0], 1);
    return held;
  };
  const back = (/** @type {any[]} */ list, /** @type {any[]} */ held) => { for (const [i, it] of held) list.splice(Math.min(i, list.length), 0, it); };
  const hb = aside(bag), hc = aside(cart);
  const hp = packs.map((p) => aside(p.items));
  /** @type {[any, string][]} */
  const drop = [...takeWildDrop(bag).map((it) => /** @type {[any, string]} */ ([it, 'bag'])), ...takeWildDrop([], cart).map((it) => /** @type {[any, string]} */ ([it, 'cart'])),
    ...packs.flatMap((p) => takeWildDrop([], p.items).map((it) => /** @type {[any, string]} */ ([it, p.f])))];
  back(bag, hb); back(cart, hc); packs.forEach((p, i) => back(p.items, hp[i]));
  const worth = new Map(drop.map(([it]) => [it, dropWorth(it)]));
  drop.sort((a, b) => worth.get(b[0]) - worth.get(a[0]));   // stable: equal worth keeps the pack's order
  took.push(...drop);
  const records = remainsFit(took.map(([it]) => wildRecord(it)));
  for (const [it, from] of took.slice(records.length)) {
    if (from === 'bag') bag.push(it);
    else if (from === 'cart') cart.push(it);
    else if (from !== 'gold') packs.find((p) => p.f === from)?.items.push(it);   // COMPANION-DROP: back in his pack
    else {
      entity.goldPieces = Math.max(0, Math.floor(entity.goldPieces ?? 0)) + gold.purse;
      packCoins.forEach((c, i) => { const n = gold.packs?.[packs[i].f] ?? 0; if (c && n) c.stackCount = Math.max(0, Math.floor(c.stackCount ?? 0)) + n; });
      if (cartCoin) cartCoin.stackCount = Math.max(0, Math.floor(cartCoin.stackCount ?? 0)) + gold.cart;
      gold.purse = 0; gold.cart = 0; delete gold.packs;
    }
  }
  for (const p of packs) p.put?.(p.items);   // COMPANION-DROP: a kit's slots as its list now stands
  if (lit !== undefined) entity.lightSourceIndex = bag.indexOf(lit);
  const kept = took.slice(0, records.length);
  return { taken: kept.map(([it]) => it), from: kept.map(([, f]) => f), records, killer: killer && records.length > 0, gold };
}

/** CART-AWAY (FIELD BUGS 2026-10-15d; Mac, asked "If parked outside of the pvp zone in the wrothgarian mountains, can it
 *  be lost?": "Yeah, if its parked outside the zone nothing should be lost"): THE WAGON'S RECORD a save carries - Horse
 *  Cart and Cargo's (horseCartLaw.js newSaveData, in the save's `modData` under HCC_VENDOR) - or null. */
export const wildCartRecordOf = (/** @type {any} */ save) => { const r = save?.modData?.[HCC_VENDOR]; return r && typeof r === 'object' ? r : null; };

/** CART-AWAY: MAY THIS RECORD'S WAGON STAND AWAY FROM ITS FALLEN, by its mode alone - no wagon (None), parked (Deployed:
 *  whether off the zone only its mask can say, which a client holds - systems/wild/wildCart.js wildCartAway), or sent to the
 *  stable (WithPlayer with WAGON-STABLED's word). Never driven, following, or beside them on foot (WithPlayer unstabled:
 *  the mod's next door parks it there, so it is where they are), and no record says nothing. The account service honours
 *  a fallen's word that its wagon is away only where the record it keeps says this (server-account/src/wild.js).
 *  @param {any} rec @returns {boolean} */
export function wildCartMayBeAway(rec) {
  if (!rec || typeof rec !== 'object') return false;
  if (rec.Mode === WAGON_MODE.None || rec.Mode === WAGON_MODE.Deployed) return true;
  return rec.Mode === WAGON_MODE.WithPlayer && rec.WagonStabled === true;
}

// ── COMPANION-DROP (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Bag drops; no send-off in zone") ────────────────
// A COMPANION AT THE FALLEN'S SIDE DROPS HIS PACK WITH THEIRS. CART-AWAY's law, for the companions: storage WITH the
// player drops, storage outside the zone keeps. A crew hand ashore (CREW-COMPANIONS, systems/naval/crewCompanions.js)
// walks with the player through every door - the sea's record keeps him in its `party` - so he is with them wherever
// they fall; a sworn revenant is with them while it walks at their side (REVENANT-COMPANION's 'with'), and in the zone
// only the first WILD_REVENANTS_MAX stand there (PVPDUNGEONS) - the rest wait outside it. What each carries is the
// player's own (COMPANION-KIT's pack; RVN-GEAR's kit, given from the pack and taken back to it at will), so the zone's
// own law reads it as it reads the bag: what never changes hands stays (wildCanLose), the rest drops, his coin halves.

// The zone's count of the sworn at the side and which ones they are: the same leaf (wildLeaf.js), so the companions read
// them without this law's graph; re-exported here for the drop's readers and the account service.
import { WILD_REVENANTS_MAX, wildSwornAtSide } from './wildLeaf.js';
export { WILD_REVENANTS_MAX, wildSwornAtSide };

/** COMPANION-DROP: where a companion's piece lay - the take's word for it (`from`, wildTookOf's `f`): a crew hand's
 *  pack (his boat's number and his name - his for life), a sworn one's pack, a sworn one's kit (its record's id). */
export const WILD_PACK = Object.freeze({
  crew: (/** @type {any} */ boat, /** @type {any} */ name) => `crew:${boat}:${name}`,
  sworn: (/** @type {any} */ id) => `sworn:${id}`,
  kit: (/** @type {any} */ id) => `kit:${id}`,
});

/** @typedef {{ f: string, items: any[], put?: (left: any[]) => void }} WildPack - a list at the side the drop takes
 *  from, its word, and (a kit) how what is left is written back */

/** COMPANION-DROP: a sworn one's kit (`companion.gear`, a slot's key -> its piece - revenantGear.js) as a list the drop
 *  takes from; `put` empties each slot whose piece left the list. @param {string} f @param {any} gear @returns {WildPack} */
function kitPack(f, gear) {
  const items = Object.values(gear).filter((it) => it && typeof it === 'object');
  return { f, items, put: (left) => { for (const k of Object.keys(gear)) if (gear[k] && typeof gear[k] === 'object' && !left.includes(gear[k])) delete gear[k]; } };
}

/** COMPANION-DROP: THE PACKS AT THE PLAYER'S SIDE - each crew hand ashore's (`party`: the crew's party, crewCompanions.js -
 *  live, or the sea's record's `party.party`) and each sworn one's at the side (`revenants`: the feud's list, live or the
 *  record's - wildSwornAtSide), its pack and its kit. The live lists themselves, so the take empties them in place. One
 *  shape at both ends: the account service reads the record's (wildPacksOf), the fallen's game its own live ones.
 *  @param {any} party @param {any} revenants @returns {WildPack[]} */
export function wildPacks(party, revenants) {
  /** @type {WildPack[]} */
  const out = [];
  for (const c of Array.isArray(party) ? party : []) if (c && Array.isArray(c.items)) out.push({ f: WILD_PACK.crew(c.boat, c.name), items: c.items });
  for (const r of wildSwornAtSide(revenants)) {
    if (Array.isArray(r.companion?.items)) out.push({ f: WILD_PACK.sworn(r.id), items: r.companion.items });
    if (r.companion?.gear && typeof r.companion.gear === 'object') out.push(kitPack(WILD_PACK.kit(r.id), r.companion.gear));
  }
  return out;
}
/** COMPANION-DROP: the packs at the side a RECORD keeps (a save, the service's judged record): its sea's party ashore
 *  (`modData[NAVAL_VENDOR].party.party` - navalHost.js getSaveData) and its feud's sworn (`modData[REVENANT_VENDOR].list` -
 *  revenant.js getSaveData). None for a live character (no `modData`): its game hands its own (wildPacks).
 *  @param {any} save @returns {WildPack[]} */
export const wildPacksOf = (save) => wildPacks(save?.modData?.[NAVAL_VENDOR]?.party?.party, save?.modData?.[REVENANT_VENDOR]?.list);

/** COMPANION-DROP (AUDIT FB1019f B2): THE FALLEN'S WORD THAT ITS GAME READS THE PACKS - `packs` 1 on /v1/wild/fall
 *  (systems/wild/wildDeath.js wildFallWords): its game takes a pack's piece out of that pack and lowers that pack's coin by
 *  its share (wildTakeTook's `packs`, `gold.packs`). A game from before COMPANION-DROP says none, and its take read every
 *  piece not the cart's as the bag's and no pack's coin: handed a take of a companion's pack, it stripped a piece of the
 *  bag bearing the same marks - a worn one too - and left his piece and his coin where the record no longer had them, his
 *  coin twice at its next checkpoint. So the account service hands a take of the packs to no fallen's tab that does not
 *  say this (server-account/src/wild.js, wildTakesPacks). */
export const WILD_FALL_PACKS = 1;
/** COMPANION-DROP (AUDIT FB1019f B2): DOES A TAKE - takeWildDeath's answer - TAKE ANYTHING OF A PACK AT THE SIDE: a piece
 *  out of one (`from` a pack's word), or a share of one's coin (`gold.packs`)?
 *  @param {{ from: string[], gold: { packs?: Record<string, number> } }} drop @returns {boolean} */
export const wildTakesPacks = (drop) => drop.from.some((f) => f !== 'bag' && f !== 'cart' && f !== 'gold') || !!drop.gold.packs;

/** INT9 (AUDIT): WHAT THE SERVICE TOOK, as the fallen's game finds it again - a piece's own marks (`g` group, `t`
 *  template, `m` material, `u` its id, `p` its craft's provenance, `n` its stack, `f` where it lay). */
export const wildTookOf = (/** @type {any[]} */ taken, /** @type {string[]} */ from) => taken.map((it, i) => ({ g: it.group ?? null, t: it.templateIndex ?? null, m: it.material ?? 0, u: typeof it.uid === 'string' ? it.uid : null, p: typeof it.provenance === 'string' ? it.provenance : null, n: Math.max(1, Math.floor(it.stackCount ?? 1)), f: from[i] })).filter((x) => x.f !== 'gold');

/**
 * INT9 (AUDIT): THE FALLEN'S GAME TAKES OUT EXACTLY WHAT THE SERVICE TOOK off its record (`took` - wildTookOf; `gold` -
 * `{ purse, cart }`), in place: each piece found by its id or its craft's provenance, else by its marks, in the list it
 * lay in; the purse and the cart's coin lowered by their shares. Never the law run again on the live pack (AUDIT INT9:
 * the game ran it without the ledger's word, and took what the service kept). Answers the pieces taken out.
 * COMPANION-DROP: a piece of a pack at the side out of that pack (`packs` - wildPacks over the game's own party and
 * sworn; a record's own by default), found by its word - one whose pack is not here is left (never another list's
 * piece of the same marks) - and each pack's coin lowered by its share (`gold.packs`).
 * @param {any} entity @param {any[]} took @param {{ purse?: number, cart?: number, packs?: Record<string, number> } | null} gold @param {(item: any) => void} [before]
 *   told of each piece before it leaves its list (a worn one unequipped)
 * @param {WildPack[]} [packs]
 */
export function wildTakeTook(entity, took, gold, before = (/** @type {any} */ _it) => {}, packs = wildPacksOf(entity)) {
  const out = [];
  for (const s of Array.isArray(took) ? took : []) {
    const list = s?.f === 'cart' ? entity?.wagonItems : s?.f === 'bag' ? entity?.items : packs.find((p) => p.f === s?.f)?.items;
    if (!Array.isArray(list)) continue;
    const same = (/** @type {any} */ it) => !!it && (s.u ? it.uid === s.u : s.p ? it.provenance === s.p
      : !it.uid && !it.provenance && it.group === s.g && it.templateIndex === s.t && (it.material ?? 0) === s.m && Math.max(1, Math.floor(it.stackCount ?? 1)) === s.n);
    const i = list.findIndex(same);
    if (i < 0) continue;
    before(list[i]);
    out.push(list.splice(i, 1)[0]);
  }
  const purse = Math.max(0, Math.floor(gold?.purse ?? 0)), cart = Math.max(0, Math.floor(gold?.cart ?? 0));
  if (purse) entity.goldPieces = Math.max(0, Math.floor(entity.goldPieces ?? 0) - purse);
  const coin = cart && Array.isArray(entity?.wagonItems) ? entity.wagonItems.find((i) => i?.group === 'Currency') : null;
  if (coin) coin.stackCount = Math.max(0, Math.floor(coin.stackCount ?? 1) - cart);
  for (const p of packs) {
    const n = Math.max(0, Math.floor(gold?.packs?.[p.f] ?? 0)), c = n ? coinIn(p.items) : null;
    if (c) c.stackCount = Math.max(0, Math.floor(c.stackCount ?? 1) - n);
    p.put?.(p.items);
  }
  return out;
}
