// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAG1 (2026-10-03) — THE MATERIALS BAG, IN THE SAVE: the bag the player
// buys at a General Store and the materials it carries, handled as DFU
// handles the wagon (systems/inventorySession.js, itemTransfer.js) - a
// second list beside the pack, `entity.bagItems`, with a weight it may
// not pass (bagLaw.js BAG_KG_LIMIT) - and what a harvest, a withdrawal
// or a station does with the items a material is
// (bible/06-Systems/Materials-Bag.md).
//
// THE BAG IS AN ITEM IN THE PACK, the way the Small Cart is (DFU's
// HasCart reads the cart's template in the pack): owning one is
// holding one. Its own list is the save's (systems/save.js), and a bag
// sold or dropped while it holds anything is refused - the cart's own
// rule (tradeModes.js), so nothing is ever left in a list nobody owns.
//
// ONLY MATERIALS GO IN IT: an item whose group and template are those a
// material mints as (profItems.js mintMaterialItem). The map from an
// item back to its material is BUILT BY MINTING every material once, so
// the bag's rule and the mint can never disagree about what an Oak Log
// is. DFU's own Red Rose looted off a corpse IS a Red Rose - it goes in
// the bag, and counts as held; the service's count (bagLaw.js) is what
// keeps a looted one from becoming a harvested one on the service.
//
// Pure where it can be: every function takes the entity it reads or
// writes; nothing here asks the network.
// ═══════════════════════════════════════════════════════════════════
import { BAG_KG_LIMIT, BAG_WORDS, CARRIED_MAX, hasBag, isBagItem, depositOrderOk } from '../net/bagLaw.js';
import { PLANT_GROUP_TEMPLATES, FOOD_KEYS, MINED_KEYS, withdrawable } from '../net/professionLaw.js';
import { material } from '../net/nodeLaw.js';
import { mintMaterialItem, withdrawIntoPack } from './profItems.js';
import { addItem, totalWeight, effectiveUnitWeightInKg, canHoldAmount, carriedWeight, isSummoned, isEnchanted } from './inventory.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';

/** Whether a list (the pack) holds a Materials Bag, and whether a record is one - net/bagLaw.js's, the one spelling. */
export { hasBag, isBagItem };
/** The bag's list on an entity, made on demand as the wagon's is (`playerEntity.wagonItems ??= []`). */
export function bagItemsOf(entity) {
  if (!entity) return [];
  if (!Array.isArray(entity.bagItems)) entity.bagItems = [];
  return entity.bagItems;
}

/** Every key a material is kept under: the herbs of both groups, the Basket's foods, and every mined, cut, sawn,
 *  skinned or brewed row the law registers. */
export function materialKeys() {
  const herbs = Object.entries(PLANT_GROUP_TEMPLATES).flatMap(([g, list]) => list.map((t) => `${g}:${t}`));
  return [...herbs, ...FOOD_KEYS, ...MINED_KEYS].filter((k) => !!material(k));
}

/** @type {Map<string, string>|null} `group|templateIndex` -> the material key. */
let _byItem = null;
const itemKey = (it) => `${it?.group}|${it?.templateIndex}`;
/** THE MAP FROM AN ITEM TO ITS MATERIAL, built by minting each material - both ways a food mints (Climates & Calories
 *  on or off) - so it is the mint's own inverse. A key with no pack form (the Ram Kit, Arcane Essence) has none. */
function byItem() {
  if (_byItem) return _byItem;
  const m = new Map();
  for (const key of materialKeys()) {
    if (!withdrawable(key)) continue;
    for (const cc of key.startsWith('food:') ? [true, false] : [undefined]) {
      let it = null;
      try { it = mintMaterialItem(key, cc); } catch { it = null; }
      if (it && !m.has(itemKey(it))) m.set(itemKey(it), key);
    }
  }
  // a map built before every template registered would miss its rows forever: keep it only once it holds any
  if (m.size) _byItem = m;
  return m;
}
/** The material an item is, or null. A quest's item, a summoned one or one an enchantment marks is never a material:
 *  it is not what the mint makes. AUDIT BAG1 B7: nor a food on its way to putrid (survival/food.js foodStage) - the
 *  mint makes it fresh, and a rotting haunch held as the Basket's meat went into the Stores as fresh. */
export function materialKeyOfItem(item) {
  if (!item || item.questItem || isSummoned(item) || item.equipSlot != null || isEnchanted(item) || (item.foodStage ?? 0) > 0) return null;
  return byItem().get(itemKey(item)) ?? null;
}
export const isMaterialItem = (item) => materialKeyOfItem(item) != null;

/** How many units of a material the bag and the pack hold together - the `held` a carrying request says. AUDIT BAG1 B6:
 *  and the wagon - the realm counts it with them (realmGoldLaw.js carriedItemLists), and herbs moved from the bag into
 *  the wagon were said as gone, the count cut under them. */
export function heldOf(entity, key) {
  let n = 0;
  for (const list of [entity?.items ?? [], entity?.bagItems ?? [], entity?.wagonItems ?? []]) {
    for (const it of list) if (materialKeyOfItem(it) === key) n += it.stackCount ?? 1;
  }
  return n;
}

/** UNCOUNTED (FIELD BUGS 2026-10-09c, "Some ingredients won't let you store them"): every material the pack, the bag
 *  and the wagon hold an item of - counted by the service or not - so the Stores page can name what it will not take. */
export function heldKeysOf(entity) {
  const keys = new Set();
  for (const list of [entity?.items ?? [], entity?.bagItems ?? [], entity?.wagonItems ?? []]) {
    for (const it of list) { const k = materialKeyOfItem(it); if (k) keys.add(k); }
  }
  return [...keys];
}

/** One unit's weight, in kg, as the pack weighs it. */
export function unitKgOf(key) {
  const it = mintMaterialItem(key);
  return it ? effectiveUnitWeightInKg(it) : 0;
}

/** What the bag weighs now, and what it may weigh. */
export const bagWeight = (entity) => totalWeight(entity?.bagItems ?? []);
/** How many more units of a material fit - in the bag (if the pack holds one) and then the pack, by DFU's own
 *  integer law (inventory.js canHoldAmount), never past the service's count's bound. */
export function roomFor(entity, key) {
  const kg = unitKgOf(key);
  const inBag = hasBag(entity?.items) ? Math.max(0, canHoldAmount(CARRIED_MAX, kg, BAG_KG_LIMIT, bagWeight(entity))) : 0;
  const inPack = Math.max(0, canHoldAmount(CARRIED_MAX, kg, entityMaxEncumbrance(entity), carriedWeight(entity)));
  return Math.min(CARRIED_MAX, inBag + inPack);
}

/**
 * THE SERVICE'S UNITS, MINTED WHERE THEY GO: `n` items of a material into the bag first - as many as its weight allows,
 * while the pack holds a bag - then the pack, as many as the carry allows. Each is DFU's AddItem (a stack joins its
 * stack). `{ bag, pack, left }`: how many went where, and how many found no room (the host says they were left).
 * `slowRot` / `noRot` as profItems.js withdrawIntoPack's.
 * @param {any} entity @param {string} key @param {number} n
 * @param {{ cc?: boolean, slowRot?: boolean, noRot?: boolean }} [opts]
 */
export function mintCarried(entity, key, n, { cc, slowRot = false, noRot = false } = {}) {
  const out = { bag: 0, pack: 0, left: 0 };
  if (!entity || !Number.isSafeInteger(n) || n < 1) return out;
  // AUDIT2 BAG1 H12: only what has a pack form (professionLaw.js withdrawable) - an Arcane Essence or a Ram Kit minted as
  // an item was a shop's gold (PROF12 E1's closed faucet) and a held count of none
  if (!withdrawable(key)) { out.left = n; return out; }
  if (!Array.isArray(entity.items)) entity.items = [];
  const kg = unitKgOf(key);
  for (let i = 0; i < n; i++) {
    const item = mintMaterialItem(key, cc);
    if (!item) { out.left += n - i; break; }
    if (slowRot === true) item.slowRot = true;
    if (noRot === true && key.startsWith('food:')) item.noRot = true;
    if (hasBag(entity.items) && canHoldAmount(1, kg, BAG_KG_LIMIT, bagWeight(entity)) >= 1) { addItem(bagItemsOf(entity), item, 'back'); out.bag++; continue; }
    if (canHoldAmount(1, kg, entityMaxEncumbrance(entity), carriedWeight(entity)) >= 1) { addItem(entity.items, item, 'back'); out.pack++; continue; }
    out.left++;
  }
  return out;
}

/** AUDIT2 BAG1 H3: a list by its role, read NOW - the bag's only while the pack still holds a bag (sold since, its goods go
 *  to the pack), the wagon's or the pack's - so an undo never writes into a list the entity no longer has. */
function listOf(entity, role) {
  if (role === 'bag') return hasBag(entity?.items) ? bagItemsOf(entity) : (entity.items ??= []);
  if (role === 'wagon') return (entity.wagonItems ??= []);
  return (entity.items ??= []);
}

/**
 * THE ITEMS A DEPOSIT TAKES: `n` units of a material out of the bag first, then the pack - whole stacks and a split of
 * the last - answered as `{ taken, back }`: how many came out, and the undo that puts each back where it was (a refusal
 * gives them back). Never a quest's, a summoned or a worn one (materialKeyOfItem). AUDIT BAG1 B6: the wagon last - what
 * it holds is held (heldOf), so a station may use it as it uses the pack.
 * AUDIT2 BAG1 H3: the undo puts each back by its list's ROLE, read at the undo (listOf) - a split stack whose rest has gone
 * (merged, sold) comes back as a record of its own, never onto a record the lists no longer hold.
 * AUDIT2 BAG1 K3/K7/H2: `stamp` - a deposit's id, written into the save with the take (`entity.bagTakes`, systems/save.js)
 * with its material, units and `order`, so a page loaded later knows whether the save it booted saw these units go, and
 * can ask a deposit no kept act names (net/profBook.js strayStamps). The undo takes the stamp off with them.
 * @param {any} entity @param {string} key @param {number} n @param {string|null} [stamp] @param {string|null} [order]
 */
export function takeCarried(entity, key, n, stamp = null, order = null) {
  /** @type {{ role: string, item: any, count: number, whole: boolean }[]} */
  const moves = [];
  let left = Math.max(0, n | 0);
  for (const [role, list] of /** @type {[string, any[]][]} */ ([['bag', bagItemsOf(entity)], ['items', entity?.items ?? []], ['wagon', entity?.wagonItems ?? []]])) {
    for (let i = list.length - 1; i >= 0 && left > 0; i--) {
      const it = list[i];
      if (materialKeyOfItem(it) !== key) continue;
      const count = it.stackCount ?? 1;
      const take = Math.min(left, count);
      if (take === count) { list.splice(i, 1); moves.push({ role, item: it, count, whole: true }); } else { it.stackCount = count - take; moves.push({ role, item: it, count: take, whole: false }); }
      left -= take;
    }
  }
  const taken = moves.reduce((a, m) => a + m.count, 0);
  if (stamp && taken > 0) (entity.bagTakes ??= {})[stamp] = { material: key, qty: taken, ...(depositOrderOk(order) ? { order } : {}) };
  const back = () => {
    for (const m of moves.reverse()) {
      const list = listOf(entity, m.role);
      if (m.whole) addItem(list, m.item, 'back');
      else if (list.includes(m.item)) m.item.stackCount = (m.item.stackCount ?? 1) + m.count;
      else addItem(list, { ...m.item, stackCount: m.count }, 'back');
    }
    moves.length = 0;
    if (stamp && entity?.bagTakes) delete entity.bagTakes[stamp];
  };
  return { taken, back };
}

/** AUDIT2 BAG1: the deposits' stamps the save holds - `{ id: { material, qty, order? } }` (takeCarried's `stamp`). */
export const bagTakesOf = (entity) => (entity?.bagTakes && typeof entity.bagTakes === 'object' ? entity.bagTakes : {});

/**
 * AUDIT2 BAG1 H4/K4/H5: UNITS THE SERVICE HANDED OVER, ALL OF THEM MINTED - into the bag and then the pack as mintCarried,
 * and what finds no room into the pack past its weight, as a withdrawal always came (B5): a unit the service counted as
 * carried and the save never got was lost to the character. `{ bag, pack, over }`.
 * @param {any} entity @param {string} key @param {number} n @param {{ cc?: boolean, slowRot?: boolean, noRot?: boolean }} [opts]
 */
export function giveCarried(entity, key, n, opts = {}) {
  const got = mintCarried(entity, key, n, opts);
  let over = 0;
  if (got.left > 0 && withdrawable(key)) over = withdrawIntoPack(entity, key, got.left, opts.cc, { slowRot: opts.slowRot === true, noRot: opts.noRot === true });
  return { bag: got.bag, pack: got.pack, over };
}

/** THE BAG'S OWN RULE, ahead of the wagon's capacity ladder: only a material goes in it. Null - the ladder decides. */
export function bagStoreRefusal(item) {
  return isMaterialItem(item) ? null : { reason: 'bagOnlyMaterials', text: BAG_WORDS.onlyMaterials };
}

/** Whether a bag may leave the pack - sold, dropped, given: only when it holds nothing, the cart's own rule. AUDIT2 BAG1
 *  H11: the one test - every door that asks it (the inventories' transfer ladders, the sale) reads this. */
export const bagMayLeave = (entity) => !(entity?.bagItems?.length > 0);

/**
 * AUDIT2 BAG1 H1/U2: THE BAG EMPTIED INTO THE PACK - every piece in it, as much of each as the pack's weight takes (DFU's
 * own integer law, as roomFor reads it): whole stacks, and the part of the last that fits. Reached from the Stores page
 * on either skin and anywhere - the classic inventory draws no bag, and a food that rotted in it (no material, so never
 * put in the Stores) held the bag loaded for good, never sold. `{ moved, left }`, in units.
 * @param {any} entity
 */
export function emptyBagIntoPack(entity) {
  const out = { moved: 0, left: 0 };
  const bag = entity?.bagItems;
  if (!Array.isArray(bag) || !bag.length) return out;
  if (!Array.isArray(entity.items)) entity.items = [];
  // what no Put in takes first (a rotted food, a piece that is no material): a full pack must never leave the jam behind
  const order = [...bag].sort((a, b) => (isMaterialItem(a) ? 1 : 0) - (isMaterialItem(b) ? 1 : 0));
  for (const it of order) {
    const count = it.stackCount ?? 1;
    const kg = effectiveUnitWeightInKg(it);
    const fit = kg > 0 ? Math.max(0, Math.min(count, canHoldAmount(count, kg, entityMaxEncumbrance(entity), carriedWeight(entity)))) : count;
    if (fit >= count) {
      bag.splice(bag.indexOf(it), 1);
      addItem(entity.items, it, 'back');
    } else if (fit > 0) {
      it.stackCount = count - fit;
      addItem(entity.items, { ...it, stackCount: fit }, 'back');
    }
    out.moved += fit;
    out.left += count - fit;
  }
  return out;
}
