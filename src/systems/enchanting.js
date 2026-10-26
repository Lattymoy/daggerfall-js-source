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
import { templateByIndex } from './item/itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { customItemClass } from './roleplayRealismItems/rriItems.js';   // RRI1: GetEnchantmentPower is a virtual the armor classes answer
import { localizedText } from './textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language
import { enchantGold } from '../net/alchemyLaw.js';   // PROF12: Enchanting's layer - the gold with the rank's share off
import { recipeById, jewelPoints } from '../net/recipeLaw.js';   // AUDIT PROF10 J1: the most a crafted piece's recipe mints
import { enchantmentSettings } from './enchantmentCatalogue.js';   // AUDIT PROF10 J2: a crafted piece's own enchantments, costed as the maker costs a row
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';   // and their classic type back to the catalogue's key
import { isAetheric } from './aetheric.js';   // AETHERIC-MAKER: an Aetheric piece is the port's own tier, never the maker's
import { isGilded } from './gilded.js';   // GILDED1: nor a Gilded one - a static roll takes no enchantment
import { isCursed, lootRarityOn, RARE_FLAVOURS } from './loot/lootRarity.js';   // MAKER-RARE: a Rare's own rows - its flavour, a curse's drawback - and the ladder's switch

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
 *  The FloorToInt is the quirk - see the header.
 *  PROF10 (bible/06-Systems/Professions-Arc.md 9.3, 36): a CRAFTED
 *  piece of jewellery carries its own base - the item's own
 *  `enchantmentPoints` (DFU's item field, itemFields.js), its template's
 *  and the share its metal and its gem add (net/recipeLaw.js
 *  jewelPoints, written at its mint). Every other item reads its
 *  template's, as before; the maker's law is untouched. */
export function craftedJewelPoints(item) {
  const r = craftedJewelRecipe(item);
  if (!r || !Number.isSafeInteger(item.enchantmentPoints) || item.enchantmentPoints < 0) return null;
  // AUDIT PROF10 J1: never more than its recipe could have minted - the template's and the share its jeweller's hand adds
  // (a Goldsmith's Silver, a Gemcutter's gem): a piece forged over the wire or in a save carries no budget of its own.
  // AUDIT PROF-541 J6: the piece's OWN hand (written at its mint, smithItems.js setJewel) - no hand, no hand's share
  const tpl = templateByIndex(r.templateIndex)?.enchantmentPoints ?? 0;
  return Math.min(item.enchantmentPoints, jewelPoints(r, tpl, item.hand ?? null));
}
/** AUDIT PROF10 J1: a CRAFTED piece of jewellery's recipe - DFU's Jewellery with the service's 16-hex provenance, its
 *  record a jeweller's (recipeLaw JEWELCRAFTING_RECIPES) of the very template it is - or null for every other item. */
export function craftedJewelRecipe(item) {
  if (item?.group !== 'Jewellery' || !/^[0-9a-f]{16}$/.test(item.provenance ?? '') || typeof item.recipe !== 'string') return null;
  const r = recipeById(item.recipe);
  return r?.kind === 'jewel' && r.templateIndex === item.templateIndex ? r : null;
}
const TYPE_KEY = Object.freeze(Object.fromEntries(Object.entries(ENCHANTMENT_TYPES).map(([k, v]) => [v, k])));
/** AUDIT PROF-541 J4: what a row costs the item maker - the catalogue's (enchantmentSettings), by its classic type or
 *  its key - or null where the catalogue cannot cost it. A crafted piece's Rare roll is drawn among those its points hold. */
export function enchantmentRowCost(e) {
  return enchantmentSettings(TYPE_KEY[e?.type] ?? e?.type, e?.param)?.enchantCost ?? null;
}
/** A row the item maker laid - the catalogue's settings row, which carries its `enchantCost` (applyEnchantments); the
 *  item law reads a row so (itemLaw.js isMakerRow), and the temple's lift never takes one (lootCurse.js liftCurse). */
export const makerLaid = (e) => e?.enchantCost !== undefined;
/**
 * MAKER-RARE (FIELD BUGS 2026-10-26, the owner: "You cant enchant masterwork/rare armor"): A RARE THE ITEM MAKER TAKES.
 * A Rare - a loot door's, or a Masterwork's (smithItems.js mintPiece) - carries one of DFU's catalogue enchantments as
 * its flavour (lootRarity.js applyRarity) and a cursed one its drawback beside it (cursePiece), so DFU's refusal of an
 * enchanted item (AddFilteredItem :419-422) left every Rare out of every tab; J2 had opened the door for a crafted
 * jewel alone. A DEPARTURE (Port-Ledger A): an identified Rare is taken with the rows the ladder rolled on it - and the
 * maker's own laid since - and no other. Unidentified it stays out: the maker would show its rows and identify it
 * (DaggerfallUnityItem.cs:1341) for nothing (tradeModes.js itemIsIdentified - a Rare is enchanted, so its flag alone). A
 * Legendary keeps DFU's refusal with the artifacts it is named like, as DFU's own magic does. AUDIT MAKER-RARE A2: and
 * with the ladder switched off the item maker is DFU's (Loot-Rarity.md: "Off ... DFU's loot, exactly"), as a garment and
 * a Masterwork are DFU's off (AUDIT LOOT II A9) - online the lane forces the ladder on.
 */
export function rareKeeps(item) {
  if (!lootRarityOn() || item?.rarity !== 'rare' || item.magic === true || item.artifact === true || item.isIdentified !== true) return false;
  // AUDIT MAKER-RARE C5: the ladder's rows, as the item law reads them (itemLaw.js tierFindings, enchantmentFindings) - its
  // flavour first, one of its group's, and a curse's drawback after it, the curse's own; a row its ladder never rolls is
  // no row this door keeps free
  const [flavour, ...rest] = (item.enchantments ?? []).filter((e) => !makerLaid(e));
  const flavours = RARE_FLAVOURS[item.group] ?? RARE_FLAVOURS.Jewellery;
  if (flavour && !flavours.some((f) => f.type === flavour.type && f.param === flavour.param)) return false;
  if (!rest.length) return true;
  return rest.length === 1 && isCursed(item) && rest[0]?.type === item.cursed.type && rest[0]?.param === item.cursed.param;
}
/**
 * THE ENCHANTMENTS A PIECE KEEPS in the item maker. DFU's maker refuses any enchanted item (AddFilteredItem :415-443);
 * two doors take one with what it carries, each row kept at the head of its list, counted in the guard and the
 * filters, never taken off:
 * - AUDIT PROF10 J2 (DECIDED, Mac: "Item maker can add to it" - bible/06-Systems/Professions-Arc.md 36): a crafted piece
 *   of jewellery (craftedJewelRecipe), every row costed as the maker costs a row (the catalogue's - never a cost the item
 *   says of itself) against its budget - its Rare roll was drawn among those its points hold (J4).
 * - MAKER-RARE: an identified Rare (rareKeeps), the rows its ladder rolled costing none of its points, the maker's own
 *   laid since costing as ever. Its flavour was drawn whatever the piece's points (Regens Health 3,000 against a Steel
 *   Cuirass's 400): counted, 622 of 1,144 Rare armour piece, metal and flavour pairs would start over budget. Free is
 *   this door's choice, not a cap's (Field-Bugs-2026-10-26.md MAKER-RARE), and it is the item law's budget already - it
 *   costs a crafted jewel's kept rows alone (itemLaw.js makerFindings).
 * Answers [] for an item with none, the rows as EnchantmentSettings for either door, and null for any other enchanted
 * item (DFU's refusal) or a row the catalogue cannot cost.
 */
export function keptEnchantments(item) {
  const list = item?.enchantments ?? [];
  if (!list.length) return [];
  const jewel = craftedJewelRecipe(item) != null;
  if (!jewel && !rareKeeps(item)) return null;
  const out = [];
  for (const e of list) {
    const parent = typeof e?.parentEnchantment === 'string' ? e.parentEnchantment : 0;
    const row = enchantmentSettings(TYPE_KEY[e?.type] ?? e?.type, e?.param, { parent });
    if (!row) return null;
    out.push({ ...row, kept: true });
    if (!jewel && !makerLaid(e)) out[out.length - 1].enchantCost = 0;   // MAKER-RARE: the ladder's row rides free
  }
  return out;
}
/** INT1: `lookup` the template reader - the item law's (systems/item/itemLaw.js lawTemplate) knows the rows a headless reader
 *  never registers. */
export function itemEnchantmentPower(item, lookup = templateByIndex) {
  if (!item) throw new Error('itemEnchantmentPower: item is null');
  const basePower = craftedJewelPoints(item) ?? lookup(item.templateIndex)?.enchantmentPoints ?? 0;
  const cls = customItemClass(item.templateIndex);
  if (cls?.enchantmentPower) return cls.enchantmentPower(item, { enchantmentPoints: basePower, armorEnchantmentMultiplier });
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
 * AETHERIC-MAKER (FIELD BUGS 2026-10-03b, Discord: "You can enchant Ruhn's gear"): THE PIECES THE MAKER REFUSES beyond
 * DFU's own. An Aetheric piece carries no DFU enchantment (aetheric.js's header: its affixes and its sigil are the
 * port's own), so DFU's IsEnchanted refusal (AddFilteredItem :419-422) never met it and the maker spent its Daedric
 * budget over its powers. It is refused as the port's other services refuse it (reforge.js salvageRefusal,
 * reforgePrice). The line is the port's own.
 */
export const itemMakerRefuses = (item) => isAetheric(item) || isGilded(item);
export const AETHERIC_TAKES_NO_ENCHANTMENT = 'An Aetheric piece takes no enchantment.';

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
 *   { kind: 'refused', text }   (AETHERIC-MAKER: an item the maker refuses, the port's own arm)
 *   { kind: 'noEnchantments', text }
 *   { kind: 'noGold', text, goldCost }
 *   { kind: 'overLimit', text, cost, power }
 *   { kind: 'enchant', text, goldCost, cost, power }
 */
export function enchantDecision(item, powers = [], sideEffects = [], { gold = 0, discountPct = 0 } = {}) {
  if (!item) return { kind: 'noItem', text: ITEM_MUST_BE_SELECTED };
  if (itemMakerRefuses(item)) return { kind: 'refused', text: AETHERIC_TAKES_NO_ENCHANTMENT };   // AETHERIC-MAKER
  if (powers.length === 0 && sideEffects.length === 0) {
    return { kind: 'noEnchantments', text: localizedText('noEnchantments', NO_ENCHANTMENTS_PREPARED) };   // L10N3d: DaggerfallItemMakerWindow.cs:724
  }
  // AUDIT PROF10 J2: a kept piece's enchantments count against its points (GetTotalEnchantmentCost's own walk - a Rare's own
  // at nothing, MAKER-RARE), and cost no gold - they are on it already
  const cost = totalEnchantmentCost(powers, sideEffects) + enchantmentListCost(keptEnchantments(item) ?? []);
  // PROF12 (bible/06-Systems/Professions-Arc.md 9.3: "Enchanting (DFU's item maker, unchanged): cost -10% at Journeyman,
  // -20% at Master (Efficient -5% more)"): online, the enchanter's gold with the rank's share off (net/alchemyLaw.js
  // enchantGold) - none offline and none asked, DFU's own ladder whole
  const goldCost = enchantGold(totalGoldCost(powers), discountPct);
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
  // AUDIT PROF10 J2: a kept piece's own rows (a crafted jewel's, a Rare's) stay ahead of the new (keptEnchantments) - their
  // created payloads ran when they were laid on, and run no second time
  const kept = keptEnchantments(item)?.length ? item.enchantments : [];
  // AUDIT PROF-541 R2-C5: and count in the cap - DFU's eleven rows the most the item stores, kept and new together
  applied.length = Math.min(applied.length, Math.max(0, MAX_ENCHANTMENTS + 1 - kept.length));
  doEnchantedPayloads(item, applied, { entity: owner, ctx, nowMinutes });
  unequipItem(owner, item);
  // 3. AND WHAT IS STORED IS THE CLASSIC TYPE (:1316-1320). The
  //    settings rows name their effect by key (the catalogue's own
  //    'FeatherWeight'); `legacyEnchantment.type = settings
  //    .ClassicType` writes the NUMBER, which is the form every
  //    runtime reader - the payload dispatcher, the value sum, the
  //    held fold - looks the effect up by. A made item whose rows
  //    kept their keys is an item whose enchantments do nothing.
  item.enchantments = [...kept, ...applied.map((e) => ({ ...e, type: classicEnchantmentType(e.type) }))];
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
// sets, and ui/item/itemMakerWindow.js is the window.
