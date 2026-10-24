// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - THE NEW MATERIALS AS ITEMS: the ores
// (610-615), the ingots (620-630) and the stone (673-674) - and PROF4's
// logs, planks, Charcoal, Resin and Heartwood (635-654) - registered as
// custom templates in the professions' reserved range (PROF0 4.8, law
// 2), as the Sigil Stone (570, systems/gate/gateSpoils.js) and Foraging's
// twelve (1600-1611) are. The rows are the law's (net/professionLaw.js
// ORES, INGOTS, STONES); this file only writes them in DFU's
// ItemTemplates.txt columns.
//
// REGISTERED AT IMPORT, AND IMPORTED BY THE SAVE (systems/save/save.js): an
// ingot withdrawn online rides the save like any item, and a save loaded
// in any scene - the fixed city, a standalone dungeon, offline - must
// still know what template 620 is, or the item has no name, no picture
// and no weight. (Offline nothing makes one: the Stores are online's.)
//
// THE PICTURE is DFU's own (law 6): an ore and stone Lodestone's lump
// (TEXTURE.254 record 66), an ingot Iron's bar (record 63) - recoloured
// by DFU's own law, GetItemImage's ChangeDye with the metal's DyeColor
// over the WeaponsAndArmor swatch (ItemHelper.cs:473-476; systems/
// itemTemplates.js inventoryItemImage reads `iconDye`), the way DFU tells
// an Ebony blade from an Iron one. A silver one is DFU's Silver, which
// is Unchanged, as a silver blade is.
//
// NEVER SHELVED, NEVER LOOT: rarity 10 and no custom-items-for-group
// registration, so a shop's shelf and a pile never mint one - the Stores
// are the one door (law 3).
//
// PROF7 (2026-09-29, Mac: "Do it"; Professions-Arc.md 29): THE HIDES,
// THE LEATHERS AND THE CLOTH (655-671) the same way - and THE SKINNING
// KNIFE (603), the one row here a shop shelves: a tool the player buys,
// as Foraging's six are, ONLINE ONLY (FORAGE0 14.2: nothing offline uses
// it) - General Stores and Pawn Shops, by DFU's own custom-item loop.
//
// PROF11 (Professions-Arc.md 4.5, 4.8, 9.3): MORTAR (675), on the
// stone's own picture as Rough and Cut Stone are; and the SCULPTOR'S
// FOUR (696-699: a column, a bench, a font, a statue plinth) - pieces
// of DFU's Furniture group, delivered among the home's things, never
// carried, never shelved.
//
// PROF9 (Professions-Arc.md 4.8, 9.3, 35): THE FOUR DISHES (685-688) -
// Hunter's Stew, Fisherman's Supper, Orchard Tart, Feast of the Hearth -
// each on a Climates & Calories food's own row (its picture, weight and
// keeping - imported, never typed again), and each a FOOD by C&C's own
// law (survival/food.js registerFoods): eaten, spoiled and named by it.
// ═══════════════════════════════════════════════════════════════════
import { registerCustomTemplates, registerKitDye, registerCustomItemsForGroup } from '../item/itemTemplates.js';
import { DYE_COLORS } from '../../characters/dyes.js';
import { ORES, INGOTS, STONES, TIER_VALUES, WOOD_TEMPLATES, HIDE_TEMPLATES, SKINNING_KNIFE, SIEGE_GEM, MASONRY_TEMPLATES, ICON_LODESTONE, ESSENCE_TEMPLATES } from '../../net/professionLaw.js';   // PROF11: Mortar; PROF12: Arcane Essence
import { REPAIR_KIT_TEMPLATE, STONE_DECOR, DISHES } from '../../net/recipeLaw.js';   // PROF11: the Sculptor's four; PROF9: the dishes
import { SURVIVAL_TEMPLATES } from '../survival/items.js';   // PROF9: C&C's food rows the dishes stand on
import { TEMPLATE as CC, FOOD, registerFoods } from '../survival/food.js';
import { isOnlinePage } from '../online/onlineLane.js';
import { BAG_ROW } from '../../net/bagLaw.js';   // BAG1: the Materials Bag (600)

/** The group every new material mints in: DFU's miscellany (UselessItems2), where Foraging's own items sit - not an
 *  ingredient group, so no maker takes one for an ingredient. */
export const PROF_ITEM_GROUP = 'UselessItems2';
/** Weights (kg): an ore as DFU's Iron (0.5), an ingot twice it, stone a heavy lump. */
const WEIGHT = Object.freeze({ ore: 0.5, ingot: 1, 'stone:rough': 3, 'stone:cut': 2.5 });
/** A gold price in DFU's metals' scale (Iron 6, Platinum 30): 8 x the tier's Marks value, an ingot two and a half
 *  times its ore's; stone the cheapest thing in a pack. */
const priceOf = (m) => (m.key === 'stone:rough' ? 2 : m.key === 'stone:cut' ? 5
  : Math.round(8 * TIER_VALUES[m.tier - 1] * (m.key.startsWith('ingot:') ? 2.5 : 1)));
const weightOf = (m) => WEIGHT[m.key] ?? (m.key.startsWith('ingot:') ? WEIGHT.ingot : WEIGHT.ore);

/** Every row, in DFU's columns and the port's two (`stackable`, `iconDye`). */
export const MINING_TEMPLATE_ROWS = Object.freeze([...ORES, ...INGOTS, ...STONES].map((m) => Object.freeze({
  index: m.templateIndex,
  name: m.name,
  baseWeight: weightOf(m),
  hitPoints: 50,
  capacityOrTarget: 0,
  basePrice: priceOf(m),
  enchantmentPoints: 0,
  rarity: 10,
  variants: 0,
  drawOrderOrEffect: 0,
  isBluntWeapon: false,
  isLiquid: false,
  isOneHanded: false,
  isIngredient: false,
  worldTextureArchive: m.icon[0],
  worldTextureRecord: m.icon[1],
  playerTextureArchive: 0,
  playerTextureRecord: 0,
  stackable: true,
  ...(m.dye ? { iconDye: DYE_COLORS[m.dye] } : {}),
})));
registerCustomTemplates(MINING_TEMPLATE_ROWS);

// ─── PROF4: THE WOODS (PROF0 4.2, 4.8, 25: 635-654) ───────────────────
/** Weights (kg): a log a length of trunk, a plank a board, Charcoal Iron's lump, Resin a pinch, Heartwood a board. */
const WOOD_WEIGHT = Object.freeze({ log: 2, plank: 1, 'wood:charcoal': 0.5, 'wood:resin': 0.25, 'wood:heartwood': 1 });
const woodWeight = (m) => WOOD_WEIGHT[m.key] ?? WOOD_WEIGHT[m.key.slice(0, m.key.indexOf(':'))] ?? 1;
/** A gold price in the metals' scale: 8 x the tier's Marks value, a plank half again a log's (it was sawn). */
const woodPrice = (m) => Math.round(8 * TIER_VALUES[m.tier - 1] * (m.key.startsWith('plank:') ? 1.5 : 1));
/** The logs, planks, Charcoal, Resin and Heartwood - the rows the law names, on DFU's own pictures (a plank the Staff's,
 *  dyed as DFU dyes an Iron Staff: its `iconDye`), stacking, never shelved. */
export const WOOD_TEMPLATE_ROWS = Object.freeze(WOOD_TEMPLATES.map((m) => Object.freeze({
  index: m.templateIndex, name: m.name, baseWeight: woodWeight(m), hitPoints: 50, capacityOrTarget: 0, basePrice: woodPrice(m),
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: m.icon[0], worldTextureRecord: m.icon[1],
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: true, ...(m.dye ? { iconDye: DYE_COLORS[m.dye] } : {}),
})));
registerCustomTemplates(WOOD_TEMPLATE_ROWS);

// ─── PROF3: THE REPAIR KIT (PROF0 4.8: 692, DFU's Warhammer picture) ───
/** The anvil's consumable (systems/smithItems.js): the Warhammer's own world picture (TEXTURE.214 record 3), dyed per
 *  kit by the metal it mends (`kitDye`: the item's `kitMetal`, DFU's DyeColor for that material). Not stackable - each
 *  kit is its own piece, its own provenance. */
export const REPAIR_KIT_ROW = Object.freeze({
  index: REPAIR_KIT_TEMPLATE, name: 'Repair Kit', baseWeight: 1.5, hitPoints: 1, capacityOrTarget: 0, basePrice: 20,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 214, worldTextureRecord: 3, playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: false, kitDye: true,
});
registerCustomTemplates([REPAIR_KIT_ROW]);
/** DFU's metal names by material, the dye each kit takes. */
const KIT_DYES = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
/** A kit's dye, by the metal it mends, or null. */
export const kitDye = (item) => (Number.isInteger(item?.kitMetal) ? DYE_COLORS[KIT_DYES[item.kitMetal]] ?? null : null);
registerKitDye(kitDye);

// ─── PROF7: THE HIDES, THE LEATHERS AND THE CLOTH (PROF0 4.4, 4.5, 4.8, 29: 655-671) ───
/** Weights (kg): a hide a pelt's (Spider Silk and Harpy Feathers a handful), a leather the same, a bolt of cloth half. */
const hideWeight = (m) => (m.key === 'hide:spider' || m.key === 'hide:harpy' ? 0.25 : m.key.startsWith('cloth:') ? 0.5 : 1);
/** A gold price in the metals' scale: 8 x the tier's Marks value, half again a leather's (it was cured) and a Silk
 *  Bolt's (it was woven). */
const hidePrice = (m) => Math.round(8 * TIER_VALUES[m.tier - 1] * (m.key.startsWith('leather:') || m.key === 'cloth:silk' ? 1.5 : 1));
/** The hides, leathers and cloth - the rows the law names, on the DFU pictures it borrows (professionLaw ICON_HAIR and
 *  its kin), stacking, never shelved. */
export const HIDE_TEMPLATE_ROWS = Object.freeze(HIDE_TEMPLATES.map((m) => Object.freeze({
  index: m.templateIndex, name: m.name, baseWeight: hideWeight(m), hitPoints: 50, capacityOrTarget: 0, basePrice: hidePrice(m),
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: m.icon?.[0] ?? 0, worldTextureRecord: m.icon?.[1] ?? 0,
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: true, ...(m.dye ? { iconDye: DYE_COLORS[m.dye] } : {}),
})));
registerCustomTemplates(HIDE_TEMPLATE_ROWS);

// ─── AUDIT-SEATS: THE SIEGE-CRACKED GEM (PROF0 4.7, 4.8: 678) ─────────
/** A siege's Spoils' gem: DFU's Diamond's weight and picture (itemTemplates.json Gems 3: 0.25 kg, TEXTURE.254 record 3),
 *  half its price (a cracked stone), stacking, never shelved - the Stores its one door, as every row here. */
export const SIEGE_GEM_ROW = Object.freeze({
  index: SIEGE_GEM.templateIndex, name: SIEGE_GEM.name, baseWeight: 0.25, hitPoints: 50, capacityOrTarget: 0, basePrice: 250,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: SIEGE_GEM.icon[0], worldTextureRecord: SIEGE_GEM.icon[1],
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: true,
});
registerCustomTemplates([SIEGE_GEM_ROW]);

// ─── PROF11: MORTAR AND THE SCULPTOR'S FOUR (PROF0 4.5, 4.8, 9.3: 675, 696-699) ───
/** Mortar's row: DECIDED 1 kg (a measure of it - ten from five Rough Stone and two metals) and 2 gold (the stone's own
 *  scale - "stone the cheapest thing in a pack", Rough Stone's 2), Lodestone's grey lump undyed as the stones', stacking,
 *  never shelved - the Stores its one door. */
export const MASONRY_TEMPLATE_ROWS = Object.freeze(MASONRY_TEMPLATES.map((m) => Object.freeze({
  index: m.templateIndex, name: m.name, baseWeight: 1, hitPoints: 50, capacityOrTarget: 0, basePrice: 2,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: m.icon[0], worldTextureRecord: m.icon[1],
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: true,
})));
registerCustomTemplates(MASONRY_TEMPLATE_ROWS);

// ─── PROF12: ARCANE ESSENCE (PROF0 4.8: 680; section 37) ──────────────
/** Disenchanting's yield (9.3): DECIDED Ectoplasm's own weight and the metals' scale's price (8 x its tier's Marks value -
 *  32 gold), on Ectoplasm's picture undyed (professionLaw ARCANE_ESSENCE), stacking, never shelved - the Stores its one
 *  door, as every row here. */
export const ESSENCE_TEMPLATE_ROWS = Object.freeze(ESSENCE_TEMPLATES.map((m) => Object.freeze({
  index: m.templateIndex, name: m.name, baseWeight: 0.1, hitPoints: 50, capacityOrTarget: 0, basePrice: 8 * TIER_VALUES[m.tier - 1],
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: m.icon[0], worldTextureRecord: m.icon[1],
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: true,
})));
registerCustomTemplates(ESSENCE_TEMPLATE_ROWS);
/** The Sculptor's four (recipeLaw STONE_DECOR - its worth and weight, DECIDED there): one a piece, never stacked (each
 *  its own provenance), never shelved; 200 hit points (stone outlasts DFU's oak, 50-150); in a list the stone's own
 *  lump, in a room its one DFU model (decorFurnish.js). */
export const STONE_DECOR_ROWS = Object.freeze(STONE_DECOR.map((d) => Object.freeze({
  index: d.templateIndex, name: d.name, baseWeight: d.weight, hitPoints: 200, capacityOrTarget: 0, basePrice: d.price,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: ICON_LODESTONE[0], worldTextureRecord: ICON_LODESTONE[1],
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: false,
})));
registerCustomTemplates(STONE_DECOR_ROWS);

// ─── PROF7: THE SKINNING KNIFE (PROF0 4.8: 603; FORAGE0 14.2) ─────────
/** The knife's row: 0.5 kg, 50 uses, 100 gold, rarity 10, DFU's Dagger's picture; one to a slot, as a tool is. */
export const SKINNING_KNIFE_ROW = Object.freeze({
  index: SKINNING_KNIFE.templateIndex, name: SKINNING_KNIFE.name, baseWeight: SKINNING_KNIFE.weight, hitPoints: SKINNING_KNIFE.hitPoints,
  capacityOrTarget: 0, basePrice: SKINNING_KNIFE.price, enchantmentPoints: 0, rarity: SKINNING_KNIFE.rarity, variants: 0,
  drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false,
  worldTextureArchive: SKINNING_KNIFE.icon[0], worldTextureRecord: SKINNING_KNIFE.icon[1], playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: false,
});
registerCustomTemplates([SKINNING_KNIFE_ROW]);

// ─── BAG1: THE MATERIALS BAG (600 - Professions-Arc 4.8's unused id) ──
/** The bag's row (net/bagLaw.js BAG_ROW): DFU's Backpack picture, weightless as the Small Cart, one to a slot. Shelved
 *  by name by every General Store online (systems/shopStock.js), never by the custom-item loop - "available in every
 *  general store". Registered here, at import, so a save that holds one loads it in any scene. */
registerCustomTemplates([BAG_ROW]);
/** The knife's share of GetCustomItemsForGroup: DFU's miscellany, ONLINE ONLY (law 6's exception, for 603 - PROF0 15's
 *  row), so a General Store or a Pawn Shop shelves it by DFU's own custom-item loop, as Foraging's tools. */
export const knifeCustomItemsForGroup = (group) => (group === PROF_ITEM_GROUP && isOnlinePage() ? [SKINNING_KNIFE.templateIndex] : []);
registerCustomItemsForGroup(knifeCustomItemsForGroup);

// ─── PROF9: THE DISHES (PROF0 4.8, 9.3: 685-688; section 35) ──────────
/** The C&C food each dish stands on - its picture, weight and keeping (4.8: "C&C's Meat / Cooked Fish / Bread"): the Stew
 *  and the Feast the Meat's, the Supper the Cooked Fish's, the Tart the Bread's. */
export const DISH_FOODS = Object.freeze({ stew: CC.Meat, supper: CC.CookedFish, tart: CC.Bread, feast: CC.Meat });
const ccRow = (t) => SURVIVAL_TEMPLATES.find((r) => r.index === t);
/** A dish's price: DECIDED three times its C&C food's (a cooked meal and its herbs), a feast twelve (a table's); its
 *  weight the food's, a feast four times it. NOT LAID ON, for Mac: 4.8's "tinted" - DFU's dye swatch reaches no food's
 *  picture (Mortar's finding, PROF11), so the Feast wears the Meat's as the Stew does, their names telling them apart. */
export const DISH_TEMPLATE_ROWS = Object.freeze(DISHES.map((d) => {
  const food = /** @type {any} */ (ccRow(DISH_FOODS[d.id]));
  const feast = d.effect.party === true;
  return Object.freeze({
    index: d.templateIndex, name: d.name, baseWeight: food.baseWeight * (feast ? 4 : 1), hitPoints: food.hitPoints, capacityOrTarget: 0,
    basePrice: food.basePrice * (feast ? 12 : 3), enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false,
    isLiquid: false, isOneHanded: false, isIngredient: false, worldTextureArchive: food.worldTextureArchive, worldTextureRecord: food.worldTextureRecord,
    playerTextureArchive: 0, playerTextureRecord: 0, stackable: false,   // each serving its own piece, its own provenance
  });
}));
registerCustomTemplates(DISH_TEMPLATE_ROWS);
/** The dishes as FOOD (C&C's law, survival/food.js registerFoods): each its C&C food's row - its satiety, keeping and
 *  stale word - under its own name. */
export const DISH_FOOD_ROWS = Object.freeze(Object.fromEntries(DISHES.map((d) => [d.templateIndex, Object.freeze({ ...FOOD[DISH_FOODS[d.id]], name: d.name })])));
registerFoods(DISH_FOOD_ROWS);
