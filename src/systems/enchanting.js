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
// AND THE SIGN IS THE MECHANIC. A side effect's EnchantCost is
// NEGATIVE (ItemDeteriorates -3000, UserTakesDamage -6000, BadRepWith
// -5000), so adding it to the enchantment sum REDUCES that sum:
// taking a drawback BUYS you budget. The gold sum skips the side
// effects entirely, so the budget it buys is free - a player who
// loads an item with drawbacks gets a more powerful item at the same
// price, not a cheaper one. A forced enchantment runs the other way:
// it costs gold and costs no points. They are not the same sum with a
// different scale; they are two different walks. M4's catalogue holds
// the costs themselves.
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

import { doEnchantedPayloads, classicEnchantmentType } from './enchantments.js';   // SetEnchantments' created-payload callback (:1289-1300) and its ClassicType store (:1316-1320)
import { unequipItem } from './equip.js';   // DaggerfallUnityItem.UnequipItem (:1183-1196)
import { templateByIndex } from './itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';

/** SetEnchantments' `maxEnchantments` (:1273) - and the same ten the
 *  two picker buttons test against (DaggerfallItemMakerWindow.cs:629,
 *  :675). DFU truncates rather than refusing; see applyEnchantments
 *  for why the truncation keeps eleven rows, not ten. */
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

/** What the maker speaks. Five come straight off TEXT.RSC 1650-1658,
 *  verified against the real ARENA2 file; ONE does not. DFU replaced
 *  the empty-lists line with its own localized "noEnchantments"
 *  string, and classic's record 1654 reads "No enchantments have been
 *  placed on the item." instead - the same refusal, differently
 *  worded. DFU's is the one this port speaks, as with M2's mixing
 *  lines (Ledger B). */
export const NOT_ENOUGH_GOLD_TO_ENCHANT = 'You do not have the gold to properly pay the enchanter.';  // 1650
export const BEYOND_ITEM_LIMIT = 'You cannot enchant this item beyond its limit.';                   // 1651
export const ITEM_ENCHANTED = 'The item has been enchanted.';                                        // 1652
export const ITEM_MUST_BE_SELECTED = 'An item must be selected to be enchanted.';                    // 1653
export const NO_ENCHANTMENTS_PREPARED = 'You have not prepared enchantments for this item.';         // DFU's own
export const CANNOT_ENCHANT_MORE_POWERS = 'You cannot enchant this item with any more powers.';      // 1657
export const NO_MORE_SIDE_EFFECTS = 'No further side-effects may be enchanted in this item.';        // 1658

/**
 * PowersButton / SideEffectsButton_OnMouseClick's guard (:614-633,
 * :660-679). The two buttons share a ladder and differ only in the
 * line they speak at the top.
 *
 * THE COUNT TEST IS `== 10`, NOT `>= 10` - and that matters, because
 * nothing else stops the lists growing past ten. The picker's own
 * room check runs ONLY for a bound soul (see the catalogue), so a
 * player who adds eleven plain enchantments walks straight past this
 * guard, which no longer matches, and keeps adding. Verbatim.
 *
 * Answers { kind: 'refuse', text } or { kind: 'open' }.
 */
export function openPickerDecision(selectingPowers, { item = null, powers = [], sideEffects = [] } = {}) {
  if (!item) return { kind: 'refuse', text: ITEM_MUST_BE_SELECTED };
  if (powers.length + sideEffects.length === MAX_ENCHANTMENTS) {
    return { kind: 'refuse', text: selectingPowers ? CANNOT_ENCHANT_MORE_POWERS : NO_MORE_SIDE_EFFECTS };
  }
  return { kind: 'open' };
}

/**
 * EnchantItemButton_OnMouseClick's ladder (:705-751) as a decision.
 * FIVE ARMS IN DFU'S ORDER, and the order is observable at every
 * step: no item first, then nothing prepared, then the GOLD, and only
 * then the item's power - so a player who can afford neither is told
 * about the gold. Answers one of
 *   { kind: 'noItem', text }
 *   { kind: 'noEnchantments', text }
 *   { kind: 'noGold', text, goldCost }
 *   { kind: 'overLimit', text, cost, power }
 *   { kind: 'enchant', text, goldCost, cost, power }
 */
export function enchantDecision(item, powers = [], sideEffects = [], { gold = 0 } = {}) {
  if (!item) return { kind: 'noItem', text: ITEM_MUST_BE_SELECTED };
  if (powers.length === 0 && sideEffects.length === 0) {
    return { kind: 'noEnchantments', text: NO_ENCHANTMENTS_PREPARED };
  }
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

/** SetEnchantments (DaggerfallUnityItem.cs:1271-1341). The cap is a
 *  CAP, not a refusal: DFU truncates and drops the rest silently. An
 *  empty list THROWS there rather than making a plain item.
 *
 *  AND THE CAP KEEPS ELEVEN, NOT TEN. The loop ADDS the row first and
 *  tests afterwards - `if (++count > maxEnchantments) break` (:1324-
 *  1325) with `maxEnchantments = 10` (:1273). On the tenth pass count
 *  becomes 10 and `10 > 10` is false, so the loop takes an ELEVENTH
 *  pass, adds the eleventh row, and only then breaks. DFU's own
 *  doc-comment says "Maximum of 10 enchantments are applied" (:1270)
 *  and the code applies eleven; the port follows the code.
 *
 *  AND IT IS NOT JUST A COPY. Four things ride the same call:
 *
 *  1. THE CREATED PAYLOAD (:1289-1300). Every settings row whose
 *     effect carries EnchantmentPayloadFlags.Enchanted fires its
 *     callback here, with this item as sourceItem. That flag is the
 *     ONLY way FeatherWeight (weight -> 0.25kg) and ExtraWeight
 *     (weight x4) ever write anything, and it is where HealthLeech
 *     starts its day/week clock so a fresh daily item does not leech
 *     from its first round.
 *
 *  2. THE UNEQUIP (:1338-1341). "Unequip item - entity must equip
 *     again. This ensures 'on equip' effect payloads execute
 *     correctly" - DFU's own comment. `owner` is SetEnchantments'
 *     second parameter and its default is null (no owner, nothing to
 *     unequip). */
export function applyEnchantments(item, enchantments, { owner = null, ctx = null, nowMinutes = null } = {}) {
  if (!enchantments || enchantments.length === 0) {
    throw new Error('applyEnchantments: enchantments cannot be null or empty');
  }
  // The cap loop verbatim (:1281-1325) - add, then `if (++count >
  // maxEnchantments) break`, which is why the eleventh row survives.
  const applied = [];
  let count = 0;
  for (const e of enchantments) {
    applied.push({ ...e });
    if (++count > MAX_ENCHANTMENTS) break;
  }
  doEnchantedPayloads(item, applied, { entity: owner, ctx, nowMinutes });
  unequipItem(owner, item);
  // 3. AND WHAT IS STORED IS THE CLASSIC TYPE (:1316-1320). The
  //    settings rows name their effect by key (the catalogue's own
  //    'FeatherWeight'); `legacyEnchantment.type = settings
  //    .ClassicType` writes the NUMBER, which is the form every
  //    runtime reader - the payload dispatcher, the value sum, the
  //    held fold - looks the effect up by. A made item whose rows
  //    kept their keys is an item whose enchantments do nothing.
  item.enchantments = applied.map((e) => ({ ...e, type: classicEnchantmentType(e.type) }));
  // 4. AND THE ITEM COMES OUT IDENTIFIED (:1341). SetEnchantments
  //    ends with IdentifyItem(), `flags |= identifiedMask` (:1253-
  //    1256), so a just-made item never needs the Identify service -
  //    which is the flag itemIsIdentified (tradeModes.js) reads.
  item.isIdentified = true;
  return item;
}

/** The cost label the window shows (:206): "used/available". */
export const enchantmentCostLabel = (cost, power) => `${cost}/${power}`;

// M4 closed both of M3's flags: systems/enchantmentCatalogue.js
// gathers every effect's EnchantmentSettings and SoulBound's forced
// sets, and ui/itemMakerWindow.js is the window.
