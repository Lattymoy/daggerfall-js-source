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
// the cart. A player who owns more than one drives the best (`activeWagonItem`): buying a wagon is the upgrade, and the
// cart left over is an empty cart to sell.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (WAGONS1).
import { TRANSPORT_SMALL_CART } from './itemTemplates.js';

/** The Small Cart's capacity, DFU's ItemHelper.WagonKgLimit (systems/itemTransfer.js WAGON_KG_LIMIT reads it here). */
export const SMALL_CART_KG = 750;

/**
 * Each kind: `name` (the item's and the Stable's), `kg` its capacity, `value` its base value (gold - the shop's price
 * law takes it from there, systems/shopStock.js calculateCost), `hitch` how far ahead of its rear axle the horse stands
 * (metres - the classic wagon's 3.1, HITCHED_HORSE_LOCAL_Z, measured for model 41214; each of Mac's is measured for its
 * own length, world/wagonModels.js), `seats` how many ride in its back, `enterable` whether it opens as a room, `icon`
 * the model id its picture is drawn from (ui/modelIcon.js's port door), `rank` which of two owned is driven.
 */
export const WAGON_KINDS = Object.freeze({
  cart: Object.freeze({ key: 'cart', name: 'Small Cart', kg: SMALL_CART_KG, value: 150, hitch: 3.8, seats: 0, enterable: false, icon: 112490, rank: 0 }),
  openWagon: Object.freeze({ key: 'openWagon', name: 'Open Wagon', kg: 1500, value: 900, hitch: 7.1, seats: 4, enterable: false, icon: 112491, rank: 1 }),
  caravan: Object.freeze({ key: 'caravan', name: 'Caravan', kg: 2000, value: 2500, hitch: 7.7, seats: 0, enterable: true, icon: 112492, rank: 2 }),
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

/** A new wagon of a kind, as a shelf mints it (systems/shopStock.js add): the Small Cart DFU's own template item, the
 *  others that item marked, named and valued. */
export function newWagonItem(kind) {
  const k = validWagonKind(kind) ?? 'cart';
  const base = { group: 'Transportation', templateIndex: TRANSPORT_SMALL_CART };
  if (k === 'cart') return base;
  const w = WAGON_KINDS[k];
  return { ...base, wagonKind: k, name: w.name, shortName: w.name, value: w.value };
}

/** The Stable card's name for a kind ("Your wagon" before WAGONS1 - the Small Cart's still). */
export const stableWagonName = (kind) => (validWagonKind(kind) === 'openWagon' ? 'Your open wagon' : validWagonKind(kind) === 'caravan' ? 'Your caravan' : 'Your wagon');
