// @ts-check
// STEED1 / WAGONS4 (2026-10-11): THE UPKEEP'S TWO ITEMS, A LEAF - the Sack of Oats a horse eats (systems/steedCare.js)
// and the Wagon Repair Kit a wagon is mended with in the field (systems/wagon/wagonUpkeep.js). Their rows register at import,
// as the wallet's do, so the item law (systems/item/itemLaw.js, on the account service too) knows them headless; nothing here
// stocks a shelf or rolls a loot table - the yards sell them (systems/merchantYards.js yardStock), and online only while
// UPKEEP_ITEMS_ONLINE is on (SHIP BEFORE ANYONE CAN SEE ONE, Rest-Arc.md REST6: a release ships the templates first, so
// no older client meets an item it cannot read).
//
// UPKEEP-ONLINE (2026-10-12, the owner: "We never added oats or repair kits to the new horse/wagon system"). The
// templates shipped with STEED1/WAGONS4's merge (#791, 2026-10-11) and every release since has carried them, so the
// switch is ON: online a Stable sells oats and a Wagon Yard its kits, as they did offline from the first.

import { registerCustomTemplates } from '../item/itemTemplates.js';
import { ICON_STAFF } from '../../net/professionLaw.js';

/** The block (1710-1719: the two, the rest spare). */
export const UPKEEP_ITEM = Object.freeze({ Oats: 1710, WagonKit: 1711 });
export const UPKEEP_ITEM_GROUP = 'UselessItems2';
/** The online sources' switch - false for the release the templates shipped in (REST6's law), on since (UPKEEP-ONLINE).
 *  Off again is the way back if an older client ever meets one it cannot read. Offline they sell at once. */
export const UPKEEP_ITEMS_ONLINE = true;
/** Whether a yard may sell one here: offline always; online once the switch is on. */
export const upkeepItemsAvailable = (online) => !online || UPKEEP_ITEMS_ONLINE;

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
]);
registerCustomTemplates(UPKEEP_ITEM_ROWS);

/** One of the two, as a yard mints it. */
export const newUpkeepItem = (templateIndex, stackCount = 1) => ({ group: UPKEEP_ITEM_GROUP, templateIndex, ...(stackCount > 1 ? { stackCount } : {}) });
export const isOatsItem = (item) => item?.templateIndex === UPKEEP_ITEM.Oats;
export const isWagonKitItem = (item) => item?.templateIndex === UPKEEP_ITEM.WagonKit;
