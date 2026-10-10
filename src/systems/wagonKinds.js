// @ts-check
// WAGONS1 (2026-10-09, Mac: "Theres an open wagon which I want to implement as a new type of cart with increased
// storage and the ability for players to request to sit in the back of the cart ... Is a closed wagon varient that also
// increases storage but also acts as an enterable and customizable interior"; asked, they are "Bought like the Small
// Cart", the capacity stepping 750 -> 1500 -> 2000 kg, and companions ride in the back too): THE WAGON KINDS - THE LAW.
//
// DFU has one cart, Transportation.Small_cart (template 93), and owning one IS having it in the pack - every
// "has a cart" in the port asks for that template (systems/inventorySession.js, scenes/world.js hasTransport, the
// transport window, the trade window's loaded-wagon refusal), and Horse Cart and Cargo's whole machine runs on it. The
// two new wagons are that same item, marked: a template-93 item carries `wagonKind` ('openWagon' or 'caravan'; absent,
// the Small Cart), its own name and its own value - so every one of those laws keeps answering, a save carries the mark
// as it carries any field (systems/save.js spreads each item), and a shop mints them on the General Store's shelf beside
// the cart (MERCHANT-YARDS, 2026-10-10: the Wagon Yard's counter now - systems/merchantYards.js yardStock). A player who owns more than one drives the best (`activeWagonItem`): buying a wagon is the upgrade, and the
// cart left over is an empty cart to sell.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (WAGONS1).
import { TRANSPORT_SMALL_CART, TRANSPORT_HORSE } from './itemTemplates.js';

/** The Small Cart's capacity, DFU's ItemHelper.WagonKgLimit (systems/itemTransfer.js WAGON_KG_LIMIT reads it here). */
export const SMALL_CART_KG = 750;

/**
 * Each kind: `name` (the item's and the Stable's), `kg` its capacity, `value` its base value (gold - the shop's price
 * law takes it from there, systems/shopStock.js calculateCost), `hitch` how far ahead of its rear axle the horse stands
 * (metres - the classic wagon's 3.1, HITCHED_HORSE_LOCAL_Z, measured for model 41214; each of Mac's is measured for its
 * own length, world/wagonModels.js), `seats` how many ride in its back, `enterable` whether it opens as a room, `icon`
 * the model id its picture is drawn from (ui/modelIcon.js's port door), `rank` which of two owned is driven, `floor` the
 * least value a lawful one carries (systems/itemLaw.js) - the price it was first shelved at, so a wagon bought before
 * WAGON-PRICE stays lawful.
 *
 * WAGON-PRICE (2026-10-10, asked: "Raise the price", then "More" - ten times): the Open Wagon 900 -> 9000, the Caravan
 * 2500 -> 25000. The Small Cart keeps DFU's template value.
 *
 * WAGONS3 (2026-10-10, Mac: "sit on the wagon itself, the ledge its built for and requiring 2 horses to use"; asked,
 * "Open Wagon + Caravan"): `horses` how many horses pull it - the two built with a front bench take a pair, the driver
 * on the bench (world/wagonModels.js driverSeatFor); the Small Cart keeps one between its shafts.
 */
export const WAGON_KINDS = Object.freeze({
  cart: Object.freeze({ key: 'cart', name: 'Small Cart', kg: SMALL_CART_KG, value: 150, floor: 150, hitch: 3.8, seats: 0, enterable: false, icon: 112490, rank: 0, horses: 1 }),
  openWagon: Object.freeze({ key: 'openWagon', name: 'Open Wagon', kg: 1500, value: 9000, floor: 900, hitch: 7.1, seats: 4, enterable: false, icon: 112491, rank: 1, horses: 2 }),
  caravan: Object.freeze({ key: 'caravan', name: 'Caravan', kg: 2000, value: 25000, floor: 2500, hitch: 7.7, seats: 0, enterable: true, icon: 112492, rank: 2, horses: 2 }),
});
/** The kinds in the order a shop shelves them and the Stable ranks them. */
export const WAGON_KIND_ORDER = Object.freeze(['cart', 'openWagon', 'caravan']);
/** A kind the law knows, or null. */
export const validWagonKind = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(WAGON_KINDS, k) ? k : null);
/** A kind as the wire says it (systems/horseCartWire.js `wk`): its place in WAGON_KIND_ORDER - 0 the Small Cart. */
export const wagonKindCode = (k) => Math.max(0, WAGON_KIND_ORDER.indexOf(validWagonKind(k) ?? 'cart'));
/** The kind a wire code names: the Small Cart for anything the law does not know (an older word says nothing). */
export const wagonKindOfCode = (c) => (Number.isInteger(c) && c >= 0 && c < WAGON_KIND_ORDER.length ? WAGON_KIND_ORDER[c] : 'cart');

/** Whether an item is a wagon (DFU's Small Cart, marked or not). */
export const isWagonItem = (item) => item?.templateIndex === TRANSPORT_SMALL_CART;
/** The kind a wagon item is: its mark, or the Small Cart. */
export const wagonKindOf = (item) => validWagonKind(item?.wagonKind) ?? 'cart';

/** The wagon a player drives, out of what they carry: the best they own (the highest rank; the first of a rank), or
 *  null. */
export function activeWagonItem(items) {
  let best = null, rank = -1;
  for (const it of items ?? []) {
    if (!isWagonItem(it)) continue;
    const r = WAGON_KINDS[wagonKindOf(it)].rank;
    if (r > rank) { best = it; rank = r; }
  }
  return best;
}
/** The kind of the wagon a player drives, or null when they own none. */
export const activeWagonKind = (items) => { const it = activeWagonItem(items); return it ? wagonKindOf(it) : null; };
/** A kind's capacity (kg); the Small Cart's for no kind (DFU's, which every window read before). */
export const wagonKgLimitOf = (kind) => WAGON_KINDS[validWagonKind(kind) ?? 'cart'].kg;
/** The capacity of the wagon an entity drives (its pack's best wagon - the Small Cart's when it owns none, as every
 *  window read before WAGONS1). */
export const wagonKgFor = (entity) => wagonKgLimitOf(activeWagonKind(entity?.items ?? []));
/** How far ahead of a kind's rear axle its horse is hitched (m). */
export const wagonHitchOf = (kind) => WAGON_KINDS[validWagonKind(kind) ?? 'cart'].hitch;
/** WAGONS3: how many horses pull a kind (the Small Cart's one for a kind the law does not know). */
export const wagonHorsesOf = (kind) => WAGON_KINDS[validWagonKind(kind) ?? 'cart'].horses;
/** WAGONS3: how many horses a pack holds - each Horse is its own item (DFU's ItemGroups.Transportation.Horse; a shop
 *  sells as many as are bought). */
export const horseCountOf = (items) => { let n = 0; for (const it of items ?? []) if (it?.templateIndex === TRANSPORT_HORSE) n++; return n; };
/** WAGONS3: the word a short team is refused with. */
export const WAGON_TEAM_TEXT = Object.freeze({
  short: (kind) => `Your ${WAGON_KINDS[validWagonKind(kind) ?? 'cart'].name} needs ${wagonHorsesOf(kind) === 2 ? 'two horses' : 'a horse'} to pull it. Buy another at a town's Stable.`,
});
/** WAGONS3: why the wagon a pack drives cannot be hitched - its team is short of the horses it takes (one owned, two
 *  needed) - or null. No horse at all is the mod's own refusal (horseCart.js `needHorseToPull`), said where it says it. */
export function wagonTeamShort(items) {
  const kind = activeWagonKind(items);
  if (!kind) return null;
  const have = horseCountOf(items);
  return have > 0 && have < wagonHorsesOf(kind) ? WAGON_TEAM_TEXT.short(kind) : null;
}

/** A new wagon of a kind, as a shelf mints it (systems/shopStock.js add): the Small Cart DFU's own template item, the
 *  others that item marked and valued - its name stays the template's (every minted row carries the template's
 *  ItemName - test/audit18_systems_items.test.js), and the kind's is what the item SAYS (systems/itemInfo.js
 *  resolveItemName, `wagonItemName`). */
export function newWagonItem(kind) {
  const k = validWagonKind(kind) ?? 'cart';
  const base = { group: 'Transportation', templateIndex: TRANSPORT_SMALL_CART };
  if (k === 'cart') return base;
  return { ...base, wagonKind: k, value: WAGON_KINDS[k].value };
}
/** The name a marked wagon is shown by (the Open Wagon, the Caravan), or null for every other item - the Small Cart's
 *  is its template's. */
export const wagonItemName = (item) => (isWagonItem(item) && validWagonKind(item?.wagonKind) && item.wagonKind !== 'cart' ? WAGON_KINDS[item.wagonKind].name : null);

/** The Stable card's name for a kind ("Your wagon" before WAGONS1 - the Small Cart's still). */
export const stableWagonName = (kind) => (validWagonKind(kind) === 'openWagon' ? 'Your open wagon' : validWagonKind(kind) === 'caravan' ? 'Your caravan' : 'Your wagon');
