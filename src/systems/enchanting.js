// M3 - THE ENCHANTING LAW: DaggerfallItemMakerWindow's cost
// accounting (MIT, Daggerfall Workshop) and FormulaHelper's
// enchantment-power formulas.
//
// E2 ported what an enchantment DOES - the held, used and struck
// payloads, all fifteen of them. What was missing is the MAKER: the
// budget an item carries, what each effect costs against it, and the
// two refusals. Audit-25 listed enchanting among the six systems at
// or near zero, and this is its arithmetic half.
//
// TWO SUMS OVER OVERLAPPING SETS, which is the thing to get right:
//
//   the ENCHANTMENT cost (:229-232) adds BOTH lists - powers and side
//   effects - and EXCLUDES forced enchantments (the ones a chosen
//   effect drags in behind it, marked by a non-zero ParentEnchantment).
//
//   the GOLD cost (:234-237) adds the POWERS ONLY, INCLUDES the forced
//   ones, and multiplies by ten.
//
// So a side effect costs enchantment points and costs no gold, and a
// forced enchantment costs gold and costs no points. They are not the
// same sum with a different scale; they are two different walks.
//
// AND THE GOLD IS CHECKED FIRST (:733-746). A player who can afford
// neither is told about the gold, not about the item's limit.
//
// THE POWER FORMULA'S QUIRK (:2660-2678): the item's base power comes
// from its template, and the material MULTIPLIES it -
// `basePower + FloorToInt(basePower * multiplier)`. Iron's multiplier
// is NEGATIVE (-0.25), and flooring a negative rounds AWAY from zero,
// so an iron item loses slightly MORE than a quarter of its points
// whenever basePower is not a multiple of four. That is a real,
// observable off-by-one in the player's favour nowhere.

import { templateByIndex } from './itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';

/** SetEnchantments' cap (:1273) - "Maximum of 10 enchantments are
 *  applied", and DFU truncates rather than refusing. */
export const MAX_ENCHANTMENTS = 10;

/** GetTotalGoldCost's scale (:236). */
export const GOLD_PER_ENCHANTMENT_POINT = 10;

/** GetWeaponEnchantmentMultiplier (:2680-2708). Steel is the BASE and
 *  the switch's own default, so an unknown material reads as steel
 *  rather than as zero power. Note Silver and Adamantium share +75%,
 *  and Elven and Mithril share +25% - the progression is not
 *  monotonic in the material order, which is why this is a table and
 *  not an index. */
export const WEAPON_ENCHANTMENT_MULTIPLIER = Object.freeze({
  [WEAPON_MATERIALS.Iron]: -0.25,
  [WEAPON_MATERIALS.Steel]: 0,
  [WEAPON_MATERIALS.Silver]: 0.75,
  [WEAPON_MATERIALS.Elven]: 0.25,
  [WEAPON_MATERIALS.Dwarven]: 0.5,
  [WEAPON_MATERIALS.Mithril]: 0.25,
  [WEAPON_MATERIALS.Adamantium]: 0.75,
  [WEAPON_MATERIALS.Ebony]: 1.0,
  [WEAPON_MATERIALS.Orcish]: 1.5,
  [WEAPON_MATERIALS.Daedric]: 2.0,
});

/** GetArmorEnchantmentMultiplier (:2711-2744). The SAME progression,
 *  but a bigger base set: Leather, Chain, Chain2 AND Steel all sit at
 *  the base where weapons have only Steel. DFU's own comment says it
 *  is "not entirely confident in accuracy of UESP information here"
 *  and uses a consistent progression deliberately. */
export const ARMOR_ENCHANTMENT_MULTIPLIER = Object.freeze({
  [ARMOR_MATERIAL.Leather]: 0,
  [ARMOR_MATERIAL.Chain]: 0,
  [ARMOR_MATERIAL.Chain2]: 0,
  [ARMOR_MATERIAL.Steel]: 0,
  [ARMOR_MATERIAL.Iron]: -0.25,
  [ARMOR_MATERIAL.Silver]: 0.75,
  [ARMOR_MATERIAL.Elven]: 0.25,
  [ARMOR_MATERIAL.Dwarven]: 0.5,
  [ARMOR_MATERIAL.Mithril]: 0.25,
  [ARMOR_MATERIAL.Adamantium]: 0.75,
  [ARMOR_MATERIAL.Ebony]: 1.0,
  [ARMOR_MATERIAL.Orcish]: 1.5,
  [ARMOR_MATERIAL.Daedric]: 2.0,
});

/** Both switches fall through to their BASE case on anything they do
 *  not name - `default:` shares the Steel/Leather arm - so an unknown
 *  material is base power and never zero power. */
export const weaponEnchantmentMultiplier = (material) =>
  WEAPON_ENCHANTMENT_MULTIPLIER[material] ?? 0;
export const armorEnchantmentMultiplier = (material) =>
  ARMOR_ENCHANTMENT_MULTIPLIER[material] ?? 0;

/** GetItemEnchantmentPower (:2660-2678). The material multiplies only
 *  for WEAPONS and ARMOR; everything else (a ring, a robe) takes its
 *  template's base points untouched, because the multiplier stays 0.
 *  The FloorToInt is the quirk - see the header. */
export function itemEnchantmentPower(item) {
  if (!item) throw new Error('itemEnchantmentPower: item is null');
  const basePower = templateByIndex(item.templateIndex)?.enchantmentPoints ?? 0;
  let multiplier = 0;
  if (item.group === 'Weapons') multiplier = weaponEnchantmentMultiplier(item.material);
  else if (item.group === 'Armor') multiplier = armorEnchantmentMultiplier(item.material);
  return basePower + Math.floor(basePower * multiplier);
}

/** EnchantmentListPicker.GetTotalEnchantmentCost (:138-151). A FORCED
 *  enchantment - one a chosen effect dragged in, marked by a non-zero
 *  parentEnchantment - is skipped unless the caller asks for it. */
export const enchantmentListCost = (list = [], { countForced = false } = {}) =>
  list.reduce((sum, e) => (
    (!countForced && (e.parentEnchantment ?? 0) !== 0) ? sum : sum + (e.enchantCost ?? 0)
  ), 0);

/** GetTotalEnchantmentCost (:229-232) - BOTH lists, forced excluded. */
export const totalEnchantmentCost = (powers = [], sideEffects = []) =>
  enchantmentListCost(powers) + enchantmentListCost(sideEffects);

/** GetTotalGoldCost (:234-237) - the POWERS ONLY, forced INCLUDED,
 *  times ten. Side effects are free in gold, which is what makes them
 *  worth taking. */
export const totalGoldCost = (powers = []) =>
  enchantmentListCost(powers, { countForced: true }) * GOLD_PER_ENCHANTMENT_POINT;

/** The two TEXT.RSC refusals the maker speaks. */
export const NOT_ENOUGH_GOLD_TO_ENCHANT = 'You do not have the gold to properly pay the enchanter.';
export const BEYOND_ITEM_LIMIT = 'You cannot enchant this item beyond its limit.';
export const ITEM_ENCHANTED = 'The item has been enchanted.';

/**
 * EnchantItemButton_OnMouseClick's ladder (:727-751) as a decision.
 * THE ORDER IS DFU'S AND IS OBSERVABLE: gold is checked BEFORE the
 * item's power, so a player who can afford neither is told about the
 * gold. Answers one of
 *   { kind: 'noGold', text, goldCost }
 *   { kind: 'overLimit', text, cost, power }
 *   { kind: 'enchant', text, goldCost, cost, power }
 */
export function enchantDecision(item, powers, sideEffects, { gold = 0 } = {}) {
  const cost = totalEnchantmentCost(powers, sideEffects);
  const goldCost = totalGoldCost(powers);
  const power = itemEnchantmentPower(item);
  if (gold < goldCost) {
    return { kind: 'noGold', text: NOT_ENOUGH_GOLD_TO_ENCHANT, goldCost };
  }
  if (power < cost) {
    return { kind: 'overLimit', text: BEYOND_ITEM_LIMIT, cost, power };
  }
  return { kind: 'enchant', text: ITEM_ENCHANTED, goldCost, cost, power };
}

/** SetEnchantments' truncation (:1271-1280). Ten is a CAP, not a
 *  refusal: DFU applies the first ten and drops the rest silently.
 *  An empty list THROWS there rather than making a plain item. */
export function applyEnchantments(item, enchantments) {
  if (!enchantments || enchantments.length === 0) {
    throw new Error('applyEnchantments: enchantments cannot be null or empty');
  }
  item.enchantments = enchantments.slice(0, MAX_ENCHANTMENTS).map((e) => ({ ...e }));
  return item;
}

/** The cost label the window shows (:206): "used/available". */
export const enchantmentCostLabel = (cost, power) => `${cost}/${power}`;

// FLAGGED, with the slice it waits on:
//  - the WINDOW (M4) - the item list, the two enchantment pickers,
//    the name field and the icon picker DFU opens from it.
//  - each effect's own EnchantmentSettings (its EnchantCost and any
//    forced children) are declared per effect class, as the potion
//    recipes were; M4 gathers them the same way M1 gathered those.
