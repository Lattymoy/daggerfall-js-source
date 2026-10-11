// @ts-check
// STEED1 / WAGONS4 (2026-10-11): THE UPKEEP'S TWO ITEMS, A LEAF - the Sack of Oats a horse eats (systems/steedCare.js)
// and the Wagon Repair Kit a wagon is mended with in the field (systems/wagonUpkeep.js). Their rows register at import,
// as the wallet's do, so the item law (systems/itemLaw.js, on the account service too) knows them headless; nothing here
// stocks a shelf or rolls a loot table - the yards sell them (systems/merchantYards.js yardStock), and online only once
// UPKEEP_ITEMS_ONLINE is on (SHIP BEFORE ANYONE CAN SEE ONE, Rest-Arc.md REST6: a release ships the templates first, so
// no older client meets an item it cannot read).

import { registerCustomTemplates } from './itemTemplates.js';
import { ICON_STAFF } from '../net/professionLaw.js';

/** The block (1710-1719: the two, BARD1's four, the rest spare). */
export const UPKEEP_ITEM = Object.freeze({ Oats: 1710, WagonKit: 1711 });
/** BARD1 (bible/06-Systems/Horse-Barding.md): a horse's armour and its cloth - fitted at the Stable (systems/horseBarding.js). */
export const BARDING_ITEM = Object.freeze({ Leather: 1712, Chain: 1713, Plate: 1714, Caparison: 1715 });
export const UPKEEP_ITEM_GROUP = 'UselessItems2';
/** The online sources' switch - false for the release the templates ship in (REST6's law). Offline they sell at once. */
export const UPKEEP_ITEMS_ONLINE = false;
/** Whether a yard may sell one here: offline always; online once the switch is on. */
export const upkeepItemsAvailable = (online) => !online || UPKEEP_ITEMS_ONLINE;
/** BARD1's own switch - its four rows ship a release after the upkeep's, so they wait on their own (REST6's law). */
export const BARDING_ITEMS_ONLINE = false;
export const bardingItemsAvailable = (online) => !online || BARDING_ITEMS_ONLINE;

const row = (index, name, baseWeight, basePrice, icon, stackable) => Object.freeze({
  index, name, baseWeight, hitPoints: 1, capacityOrTarget: 0, basePrice, enchantmentPoints: 0, rarity: 20, variants: 0,
  drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false,
  worldTextureArchive: icon[0], worldTextureRecord: icon[1], playerTextureArchive: 0, playerTextureRecord: 0, stackable,
  // a supply spent whole, never wear a smith mends (REST II H7's law)
  isNotRepairable: true,
});
/** The rows, in DFU's ItemTemplates.txt columns. Rarity 20: no shelf and no loot table rolls them. The pictures are
 *  DFU's own: the provisions' sack (Climates & Calories' Rations), the planks' (the professions' Plank). */
export const UPKEEP_ITEM_ROWS = Object.freeze([
  row(UPKEEP_ITEM.Oats, 'Sack of Oats', 1.0, 4, [205, 17], true),
  row(UPKEEP_ITEM.WagonKit, 'Wagon Repair Kit', 4.0, 60, ICON_STAFF, true),
  // BARD1: the barding a horse wears and its caparison - heavy in a pack, the horse's weight once fitted; the
  // pictures DFU's cuirass's and its cloak's
  row(BARDING_ITEM.Leather, 'Leather Barding', 15, 400, [207, 11], false),
  row(BARDING_ITEM.Chain, 'Chain Barding', 40, 1200, [207, 11], false),
  row(BARDING_ITEM.Plate, 'Plate Barding', 60, 3000, [207, 11], false),
  row(BARDING_ITEM.Caparison, 'Caparison', 6, 250, [204, 0], false),
]);
registerCustomTemplates(UPKEEP_ITEM_ROWS);

/** One of the two, as a yard mints it. */
export const newUpkeepItem = (templateIndex, stackCount = 1) => ({ group: UPKEEP_ITEM_GROUP, templateIndex, ...(stackCount > 1 ? { stackCount } : {}) });
export const isOatsItem = (item) => item?.templateIndex === UPKEEP_ITEM.Oats;
export const isWagonKitItem = (item) => item?.templateIndex === UPKEEP_ITEM.WagonKit;
/** BARD1: one of the four, as a yard mints it; which it is. */
export const newBardingItem = (templateIndex) => ({ group: UPKEEP_ITEM_GROUP, templateIndex });
export const isBardingItem = (item) => item?.group === UPKEEP_ITEM_GROUP && Object.values(BARDING_ITEM).includes(item?.templateIndex);
