// @ts-check
// INT1 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE REST SUPPLIES' ROWS, A LEAF. They were
// restItems.js's own, and that module pulls the rest's whole world in (the needs, the clock, the loot doors); the item
// law (systems/itemLaw.js) runs on the account service, which loads none of it, and needs only the rows - which
// templates the port knows, which stack. One home, two readers: restItems.js imports and re-exports every name here and
// registers the rows as it always did.

import { ICON_TWIGS } from '../net/professionLaw.js';

/** The block (Rest-Arc.md section 6: 1700-1709, the last three spare). */
export const REST_ITEM = Object.freeze({ Bedroll: 1700, EmberJar: 1701, Firewood: 1702, Tonic: 1703, Candle: 1704, Salts: 1705, Draught: 1706 });
export const REST_ITEM_GROUP = 'UselessItems2';
export const BEDROLL_NIGHTS = 10;
export const CANDLE_USES = 3;
export const SALTS_USES = 3;

const row = (index, name, baseWeight, hitPoints, basePrice, rarity, icon, stackable) => Object.freeze({
  index, name, baseWeight, hitPoints, capacityOrTarget: 0, basePrice, enchantmentPoints: 0, rarity, variants: 0,
  drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false,
  worldTextureArchive: icon[0], worldTextureRecord: icon[1], playerTextureArchive: 0, playerTextureRecord: 0, stackable,
  // AUDIT REST II H7: a supply's charges are its uses, never wear a smith mends - a repair counter recharged a Bedroll's
  // nights, a Candle's and the Salts' doses for less than the supply costs (DFU's ItemTemplate.isNotRepairable)
  isNotRepairable: !stackable,
});
/** The rows, in DFU's ItemTemplates.txt columns - charges as hitPoints (mintCondition), stacking unless they carry
 *  charges. The pictures are DFU's own: the camping bundle, the Clay Jar, the twigs, the Glass Bottle, the Candle, the
 *  Glass Jar, the Holy Water's flask. */
export const REST_ITEM_ROWS = Object.freeze([
  row(REST_ITEM.Bedroll, 'Bedroll', 2.5, BEDROLL_NIGHTS, 80, 1, [204, 8], false),
  row(REST_ITEM.EmberJar, 'Ember Jar', 0.5, 1, 15, 1, [218, 0], true),
  row(REST_ITEM.Firewood, 'Firewood', 1.5, 1, 8, 1, ICON_TWIGS, true),
  row(REST_ITEM.Tonic, 'Restorative Tonic', 0.2, 1, 30, 2, [205, 11], true),
  row(REST_ITEM.Candle, 'Meditation Candle', 0.3, CANDLE_USES, 35, 3, [210, 3], false),
  row(REST_ITEM.Salts, 'Waking Salts', 0.1, SALTS_USES, 40, 3, [205, 3], false),
  row(REST_ITEM.Draught, 'Sleeping Draught', 0.2, 1, 45, 3, [211, 49], true),
]);
