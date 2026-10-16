// @ts-check
// SEA-REPAIR (2026-09-30) - CARPENTER'S STORES: timber, pitch and canvas in a boat's hold (Come Sail Away's cargo),
// bought at the shipwright's yard (navalYard.js STORE_PRICE) and spent by her crew's repairs at sea (navalYard.js
// seaRepair, the host's MAKE REPAIRS). An item of the port's own (DECLARED): a custom template registered at import as
// the port's others are (profTemplates.js), so a save carries it whether or not the naval arc is on. It stacks.
import { registerCustomTemplates, setItemFields, mintCondition } from '../item/itemTemplates.js';

/** The stores' template index - the next free after Come Sail Away's two (1320, 1321). */
export const STORES_TEMPLATE = 1330;
export const STORES_GROUP = 'UselessItems2';
export const STORES_ROW = Object.freeze({
  index: STORES_TEMPLATE, name: 'Carpenter\'s Stores', baseWeight: 10, hitPoints: 1, capacityOrTarget: 0, basePrice: 25,
  enchantmentPoints: 0, rarity: 1, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 204, worldTextureRecord: 8, playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: true,
});
registerCustomTemplates([STORES_ROW]);

/** `n` stores as one stack. @param {number} n */
export const mintStores = (n) => mintCondition(setItemFields({ group: STORES_GROUP, templateIndex: STORES_TEMPLATE, material: 0, flags: 0, variant: 0, message: 0, stackCount: Math.max(1, n | 0) }));
/** Whether an item is the stores. */
export const isStores = (it) => it?.templateIndex === STORES_TEMPLATE;
/** How many stores a list of items holds. @param {any[]} items */
export const storesIn = (items) => (items ?? []).reduce((n, it) => n + (isStores(it) ? Math.max(1, it.stackCount | 0) : 0), 0);
/** One store taken from a list (a stack's count down, or the stack gone). Answers whether there was one. @param {any[]} items */
export function spendStore(items) {
  const i = (items ?? []).findIndex(isStores);
  if (i < 0) return false;
  const it = items[i];
  if ((it.stackCount | 0) > 1) it.stackCount--;
  else items.splice(i, 1);
  return true;
}
