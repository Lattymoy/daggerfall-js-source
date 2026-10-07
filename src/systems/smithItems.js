// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF3 (2026-09-28, Mac: "Lets keep moving") - THE PIECE A CRAFT MADE
// (bible/06-Systems/Professions-Arc.md 9.2, 24): minted as DFU mints
// it and the quality laid on it after.
//
// DFU'S OWN ITEM FIRST. A weapon is ItemBuilder.CreateWeapon's
// (combat/enemyEquipment.js weaponOfMaterial - its material's value and
// condition), a piece of armour CreateArmor's (armorOfMaterial - plate
// 0x0200 + the metal, chain 0x0100), a tool Foraging's own mint
// (foragingInstall.js createForagingItem). THEN THE QUALITY: the
// condition's and the weight's multipliers, and for a Superior and a
// Masterwork one Loot Rarity roll (lootRarity.js applyRarity), rolled
// off the product record's seed so the piece is the record's on every
// client; a Masterwork takes the maker's mark for its name
// (itemInfo.js itemNameParts). A tool's quality is its life.
//
// THE PIECE CARRIES `quality`, `provenance` and `maker` (itemFields.js),
// riding the save as Loot Rarity's `rarity` does; the signed record is
// the service's (`products`), the id the piece's.
//
// THE REPAIR KIT (692): the anvil's consumable - a quarter of an item's
// condition, once, on the most-worn weapon or armour of its metal the
// pack holds. Its row is registered with the ores and ingots
// (profTemplates.js), so any scene the save loads in knows it.
//
// MEND-AIM (2026-09-30, Discord suggestion, kurkku: "Allow targeting
// field repair kit use" - "always repairing the most worn piece of
// equipment means fixing arrows or random loot you picked up most of
// the time"): A KIT IS AIMED. Used from either pack with more than one
// piece to mend, it asks which (the classic window's list picker, the
// enhanced pack's own list); the quick keys, which have no list to
// show, take what is WORN first, then the pack's, each the most worn
// first. An arrow is never mended - DFU mints a quiver at condition 0,
// so it was always the "most worn" piece a kit could find.
//
// PROF4 (2026-09-28, Mac: "Continue"; Professions-Arc.md 25): AND THE
// WORKBENCH'S. A staff or a bow is DFU's weapon at its wood's material,
// its quality the smith's weapons'; arrows are CreateWeapon's arrow arm
// at twenty, no quality and no provenance (DFU mints a quiver at
// condition 0, one stack - a mark would split it); furniture is DFU's
// Furniture template, its quality its worth (the condition's multiplier
// on its value, never a Loot Rarity roll), the mark on a Masterwork and
// on every piece a Master Joiner makes (`marked`); the Basket Foraging's
// own, its quality its life.
//
// PROF7 (2026-09-29, Mac: "Do it"; Professions-Arc.md 29): AND THE
// LOOM'S. Leather armour is CreateArmor's at Leather (material 0), its
// quality the smith's armour's; a garment is DFU's clothing template in
// its group (the men's or the women's), its variant the record's seed's
// and its dye the record's (`u`) - as DFU's shelf mints clothing, the
// variant then the dye - its quality the armour's; the rugs,
// tapestries and skins are furniture; the Fishing-Net Foraging's own and
// the Skinning Knife the port's (603), each a tool, its quality its life.
//
// PROF11 (Professions-Arc.md 9.3): AND THE MASON'S. The Sculptor's
// column, bench, font and plinth (696-699, recipeLaw STONE_DECOR) are
// furniture - DFU's Furniture group, among the home's things, their
// quality their worth and their mark a Masterwork's - and stand in a
// room as their one DFU model (systems/decorFurnish.js).
//
// PROF9 (Professions-Arc.md 9.3, 35): AND THE COOK'S. A dish (685-688)
// is minted by systems/cookItems.js mintDish - a C&C food under its own
// name, no quality, its cook's hand (a Chef's feast, a Provisioner's
// dish) the record's; a dish spoiled since it was cooked is no longer
// as minted, and lists nowhere.
//
// PROF10 (Professions-Arc.md 9.3, 36): AND THE JEWELLER'S. A piece of
// jewellery is DFU's own Jewellery template as DFU's loot mints one
// (loot.js createRandomOfGroup: the template in its group, no material),
// its quality the armour's (condition, weight, a Superior's Magic roll,
// a Masterwork's Rare one and its mark), named for its metal and its gem
// ("Gold Ruby Ring" - the rarity's words kept about it), its enchantment
// points its template's and the share its metal and gem add (recipeLaw
// jewelPoints, the jeweller's hand the record's) - the budget DFU's item
// maker reads off it - and its worth its template's by that share, the
// set gem's own price with it.
// ═══════════════════════════════════════════════════════════════════
import {
  recipeById, QUALITY_EFFECTS, TOOL_LIFE, MASTERWORK, REPAIR_KIT_TEMPLATE, KIT_REPAIR, FIELD_KIT_REPAIR, KIT_CEILING, INGOT_MATERIAL, ARMOR_PLATE,
  ARMOR_CHAIN, PROVENANCE_RE, makerMark, QUALITY_NAMES,
  jewelPoints, jewelPointsPct,   // PROF10: a piece of jewellery's points and its worth
  jewelHandOk,   // AUDIT PROF-541 J6: the hand a piece keeps, one its recipe takes
} from '../net/recipeLaw.js';
import { enchantmentRowCost } from './enchanting.js';   // AUDIT PROF-541 J4: a Rare roll the piece's points hold
import { minedMaterial } from '../net/professionLaw.js';
import { weaponOfMaterial, armorOfMaterial, createWeapon } from '../combat/enemyEquipment.js';
import { setItemFields, mintCondition, templateByIndex, registerItemUseHandler, conditionPercentage, conditionShare, mendOrder } from './itemTemplates.js';   // AUDIT ECON R2: the card's own percentage; MEND-WORN: the mend order's one home
import { registerTabledLootHandler, registerEnemyLootExtra } from './loot.js';   // REPAIR-EASE: the field kit's two loot doors
import { itemLongName } from './itemInfo.js';
import './profTemplates.js';   // the Repair Kit's row (692), registered with the ores and ingots
import { applyRarity, rarityEligible, RARE_FLAVOURS } from './lootRarity.js';
import { unitWeightInKg, ARROW_TEMPLATE } from './inventory.js';   // MEND-AIM: the arrow, never mended
import { seededRng } from './wind.js';
import { createForagingItem } from './foragingInstall.js';
import { mintDish, isDish } from './cookItems.js';   // PROF9: the fire's dishes

/** DFU's metal names by material (itemInfo.js MATERIAL_NAMES' first ten) - a kit's word and its dye. */
const METALS = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);

/** A kit's worth: 10 gold and 10 a tier of its metal. */
const kitValue = (tier) => 10 + 10 * tier;

// ─── THE PIECE ───────────────────────────────────────────────────────

/**
 * PROF7: A GARMENT as DFU's shelf mints clothing (systems/shopStock.js) - the template in its group, then its variant (the
 * record's seed's, so every client mints the same one), then its dye (the record's, `u`; an undyed garment none).
 * @param {import('../net/recipeLaw.js').Recipe} r @param {number} seed @param {number|null} dye
 */
export function garmentItem(r, seed, dye = null) {
  const variants = Math.max(1, templateByIndex(r.templateIndex)?.variants ?? 0);
  /** @type {any} */
  const item = mintCondition(setItemFields({ group: r.group, templateIndex: r.templateIndex, material: 0, flags: 0, variant: (seed >>> 0) % variants, message: 0, stackCount: 1 }));
  if (r.dyes === true && Number.isInteger(dye)) item.dye = dye;
  return item;
}

/**
 * PROF10: A PIECE OF JEWELLERY as DFU's loot mints one (loot.js createRandomOfGroup - the Jewellery template in its group,
 * no material), conditioned as every mint is.
 * @param {import('../net/recipeLaw.js').Recipe} r
 */
export function jewelItem(r) {
  return mintCondition(setItemFields({ group: 'Jewellery', templateIndex: r.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
}
/**
 * PROF10: what a piece of jewellery's metal and gem make of it once its quality is laid on - its name the recipe's ("Gold
 * Ruby Ring"; a Magic or Rare roll's words kept about it, a Masterwork's mark before it - itemNameParts), its enchantment
 * points (jewelPoints: the template's, and the share the metal, the gem and the jeweller's hand add), and its worth: the
 * template's price by that share, and the set gem's own (a Ruby set is a Ruby's worth carried).
 * @param {any} item @param {import('../net/recipeLaw.js').Recipe} r @param {number|null} hand
 */
function setJewel(item, r, hand) {
  const base = templateByIndex(r.templateIndex);
  const word = base?.name ?? '';
  item.name = word && typeof item.name === 'string' && item.name.includes(word) ? item.name.replace(word, r.name) : r.name;
  item.enchantmentPoints = jewelPoints(r, base?.enchantmentPoints ?? 0, hand);
  if (jewelHandOk(r, hand)) item.hand = hand;   // AUDIT PROF-541 J6: the jeweller's hand kept on the piece - its points' cap its own (enchanting.js craftedJewelPoints)
  const gem = r.gem ? templateByIndex(minedMaterial(r.gem)?.templateIndex ?? -1)?.basePrice ?? 0 : 0;
  item.value = Math.max(1, Math.round((Number.isFinite(item.value) ? item.value : base?.basePrice ?? 0) + ((base?.basePrice ?? 0) * jewelPointsPct(r, hand)) / 100) + gem);
}

/**
 * One piece of a craft's answer - `{ recipe, quality, seed, maker, marked, dye }` and the piece's `provenance` - as the
 * pack (or, furniture, the home's things) holds it, or null for a recipe this client does not know.
 * @param {{ recipe: string, quality: number, seed: number, maker?: string|null, marked?: boolean, dye?: number|null, hand?: number|null }} made
 * @param {string} provenance
 */
export function mintPiece({ recipe, quality, seed, maker = null, marked = false, dye = null, hand = null }, provenance) {
  const r = recipeById(recipe);
  if (!r || typeof provenance !== 'string' || !PROVENANCE_RE.test(provenance)) return null;
  const mark = makerMark(maker);   // TEXT-F1
  if (r.kind === 'siege') return null;   // PROF4: the Ram Kit is the Stores' (and made with the sieges)
  if (r.kind === 'dish') return mintDish({ recipe, maker, hand }, provenance);   // PROF9: a dish, its cook's hand the record's
  if (r.kind === 'arrows') {
    // PROF4: CreateWeapon's arrow arm (combat/enemyEquipment.js), the stack the recipe's - no quality, no provenance
    const arrows = createWeapon(r.templateIndex, 0, () => 0);
    arrows.stackCount = r.stack ?? 1;
    return arrows;
  }
  /** @type {any} */
  let item;
  if (r.kind === 'kit') {
    const m = INGOT_MATERIAL[r.metal];
    item = mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: REPAIR_KIT_TEMPLATE, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
    item.name = `${METALS[m]} Repair Kit`;
    item.kitMetal = m;
    item.value = kitValue(minedMaterial(r.metal).tier);
    item.recipe = r.id;   // AUDIT 31 H3: the recipe it was minted of, read before any look-alike's
    item.provenance = provenance;
    if (mark) item.maker = mark;
    return item;
  }
  const q = Math.max(0, Math.min(MASTERWORK, quality | 0));
  if (r.kind === 'furniture') {
    // PROF4: DFU's Furniture template (the furnisher's own mint, systems/shopStock.js), its quality its worth
    item = mintCondition(setItemFields({ group: 'Furniture', templateIndex: r.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
    const base = templateByIndex(r.templateIndex);
    item.value = Math.max(1, Math.round((base?.basePrice ?? item.value ?? 1) * QUALITY_EFFECTS[q].condition));
    if (base?.name) item.name = base.name;
    item.quality = q;
    item.recipe = r.id;
    item.provenance = provenance;
    if (mark) item.maker = mark;
    if (marked === true && q !== MASTERWORK) item.marked = true;   // a Master Joiner's (a Masterwork's mark is its own)
    return item;
  }
  if (r.kind === 'tool') {
    item = createForagingItem(r.templateIndex);   // PROF7: the Skinning Knife too - a custom row (603) Foraging's mint hands to the port's own
    if (!item) return null;
    item.maxCondition = item.currentCondition = TOOL_LIFE[q];   // FORAGE0 14.7: a tool's quality is its life
  } else {
    item = r.kind === 'weapon' || r.kind === 'staff' || r.kind === 'bow' ? weaponOfMaterial(r.templateIndex, r.material)   // PROF4: a staff's or a bow's material its wood's
      : r.kind === 'garment' ? garmentItem(r, seed, dye)   // PROF7: DFU's clothing, its variant and dye the record's
        : r.kind === 'jewel' ? jewelItem(r)   // PROF10: DFU's jewellery
          : armorOfMaterial(r.templateIndex, r.material);   // PROF7: leather armour at Leather (0)
    const eff = QUALITY_EFFECTS[q];
    // AUDIT PROF-541 J4: a jewel's Rare roll one its points hold (a Cloth Amulet's 660 never carries Tongues' 1,590)
    const fits = r.kind === 'jewel' ? ((f) => (enchantmentRowCost(f) ?? Infinity) <= jewelPoints(r, templateByIndex(r.templateIndex)?.enchantmentPoints ?? 0, hand)) : null;
    if (eff.rarity && rarityEligible(item)) { applyRarity(item, eff.rarity, seededRng(seed >>> 0), null, { fits }); item.isIdentified = true; }
    item.maxCondition = item.currentCondition = Math.max(1, Math.round(item.maxCondition * eff.condition));
    if (eff.weight !== 1) item.weightInKg = Math.round(unitWeightInKg({ ...item, weightInKg: undefined }) * eff.weight * 100) / 100;
    if (q === MASTERWORK && mark) item.name = templateByIndex(r.templateIndex)?.name ?? item.name;   // the mark is its name (itemNameParts)
    if (r.kind === 'jewel') setJewel(item, r, hand);   // PROF10: its metal's and its gem's name, points and worth
  }
  item.quality = q;
  item.recipe = r.id;   // AUDIT 31 H3: an Ebony and a Warforged piece mint the same template and material
  item.provenance = provenance;
  if (mark) item.maker = mark;
  return item;
}

/**
 * AUDIT 30 C2: whether a piece is still what its record mints - no enchantment but its quality's roll (a Rare's one
 * flavour, of its group's), none written by the item maker (DFU's own door writes over `enchantments`). What crosses the
 * market is minted again from its record at the other end, so a piece enchanted since would lose what it was paid for.
 * @param {any} item
 */
export function asMinted(item) {
  if (!item?.provenance || item.legendary || item.customEnchantments?.length) return false;
  if (item.reforged !== undefined || item.imprint !== undefined) return false;   // AUDIT LOOT F3: a line the Reforge rolled again, a power imprinted - the record mints neither
  if (item.honed !== undefined) return false;   // AUDIT LOOT II C1: nor a line honed past its roll (LOOT17) - the market's mint would hand back the roll, the shards and the gold gone
  if ((item.foodStage ?? 0) > 0) return false;   // PROF9: a dish spoiled since it was cooked - the record mints it fresh
  const e = item.enchantments ?? [];
  if (item.rarity !== 'rare') return e.length === 0;
  const roll = RARE_FLAVOURS[item.group] ?? RARE_FLAVOURS.Jewellery;
  return e.length === 1 && roll.some((f) => f.type === e[0]?.type && f.param === e[0]?.param);
}

/** Every piece of a craft's answer, minted - two of a Quartermaster's kit. @param {any} data */
export const mintPieces = (data) => (data?.pieces ?? []).map((p) => mintPiece(data, p.provenance)).filter(Boolean);

/** PROF6 (Professions-Arc 28): whether a crafted piece is of a recipe - DFU's group, template and material (a kit's
 *  metal) as the recipe mints them - so the Work tab offers a commission only the pieces that answer it (the service
 *  asks the piece's own record: writs.js fulfilCommission). */
export function pieceOfRecipe(item, recipeId) {
  if (typeof item?.recipe === 'string') return item.recipe === recipeId;   // AUDIT 31 H3: its own record's, where it keeps one
  const s = mintPiece({ recipe: recipeId, quality: 1, seed: 0 }, '0000000000000000');
  if (!s || !item) return false;
  return item.group === s.group && item.templateIndex === s.templateIndex && (item.material ?? 0) === (s.material ?? 0)
    && (item.kitMetal ?? null) === (s.kitMetal ?? null);
}
/** PROF4: whether a minted piece is furniture - the home's things (DECOR2b's furnishings), never the pack. */
export const isCraftedFurniture = (item) => item?.group === 'Furniture';

// ─── THE REPAIR KIT'S USE ────────────────────────────────────────────

/** Whether a kit of metal `m` mends an item: a weapon of the metal, a plate piece of it, and Steel's the chain too.
 *  MEND-AIM: never an arrow - it is shot and spent, and DFU mints it at condition 0, so every kit reached for it first. */
export function kitMends(m, item) {
  if (item?.templateIndex === ARROW_TEMPLATE) return false;
  if (m === FIELD_KIT && item?.maxCondition > 0) return item.group === 'Weapons' || item.group === 'Armor';   // REPAIR-EASE: any metal
  if (!item || !Number.isInteger(m) || !(item.maxCondition > 0)) return false;
  if (item.group === 'Weapons') return item.material === m;
  if (item.group === 'Armor') return item.material === ARMOR_PLATE + m || (m === 1 && item.material === ARMOR_CHAIN);
  return false;
}
/** KIT-CEILING: the condition no kit mends a piece past - three quarters of it (recipeLaw.js KIT_CEILING), ROUNDED DOWN:
 *  an Iron Dagger's 50 stops at 37 (74%), never 38 (76% - the overhaul's sharp band, pcaao.js, the smith's to give). */
export const kitCeiling = (it) => Math.floor(it.maxCondition * KIT_CEILING);
/** AUDIT ECON R2: WHETHER A KIT HAS ANYTHING TO GIVE A PIECE - more than a hundredth of its condition below the ceiling.
 *  A piece a kit mended stops AT the ceiling, and a blow later stood a point or two under it: worn, it came first in
 *  the order, and the hotbar, the classic pack's no-art fallback and the chooser's focused first row spent a whole kit
 *  on it - "The Daedric Longsword is mended: 75% to 75%." - with a flail at 20% beside it. */
export const kitGives = (it) => kitCeiling(it) - it.currentCondition > Math.floor(it.maxCondition / 100);
/**
 * MEND-AIM: THE PIECES A KIT COULD MEND in `items`, in the order it takes them unaimed - what is WORN first (the player's
 * own gear, never a piece of loot carried to sell), then the rest, each the lowest share of its condition left first.
 * Empty for anything but a kit, and for a kit with nothing of its metal wanting mending.
 * @param {any} kit
 * @param {any[]} items
 */
export function repairKitTargets(kit, items) {
  if (!kit || kit.templateIndex !== REPAIR_KIT_TEMPLATE || !Array.isArray(items)) return [];
  const metal = kit.fieldKit === true ? FIELD_KIT : kit.kitMetal;   // REPAIR-EASE: a field kit mends any metal, by less
  return items.filter((it) => it !== kit && kitMends(metal, it) && kitGives(it))   // KIT-CEILING: below it, by more than a hundredth
    .sort(mendOrder);   // MEND-WORN: the order's one home, Repairs Objects' too (itemTemplates.js)
}
/**
 * A KIT USED (PROF0 9.3: "repairs 25% of an item's condition, once"): the piece it is AIMED at (MEND-AIM), or unaimed the
 * first of repairKitTargets - mended by a quarter of its condition (a field kit's 15%), never past the ceiling
 * (KIT-CEILING); the kit spent out of `items`, the list it lives in. The pieces are `pack`'s (the list itself, unless
 * the host hands the player's own). Answers the item mended, its share before and after, and the two as the card
 * prints them (`from`, `to`), or null when nothing of the metal wants mending, or the aim is at a piece the kit cannot
 * mend (the kit kept).
 * @param {any} kit
 * @param {any[]} items
 * @param {{ target?: any, pack?: any[] }} [aim]
 */
export function useRepairKit(kit, items, { target = null, pack = items } = {}) {
  if (!Array.isArray(items)) return null;
  const want = repairKitTargets(kit, pack);
  const it = target == null ? want[0] : want.includes(target) ? target : null;
  if (!it) return null;
  const before = conditionShare(it), from = conditionPercentage(it);
  it.currentCondition = Math.min(kitCeiling(it), it.currentCondition + Math.ceil(it.maxCondition * (kit.fieldKit === true ? FIELD_KIT_REPAIR : KIT_REPAIR)));   // KIT-CEILING: never past three quarters
  const i = items.indexOf(kit);
  if (i >= 0) items.splice(i, 1);
  return { item: it, before, after: conditionShare(it), from, to: conditionPercentage(it) };
}
/** KIT-CEILING: the refusal when the pieces the kit could take below whole are all held back at its ceiling. AUDIT ECON
 *  R5: "three quarters", never "75%" - the smallest pieces stop at 74% (an Iron Dagger's 37 of 50), and were refused
 *  as "past 75%" under a card that read 74%. */
export const KIT_CEILING_TEXT = 'A kit mends nothing past three quarters. A smith can do the rest.';
/** KIT-CEILING: the pieces of the kit's metal it holds back - worn below whole, and at its ceiling or within a hundredth
 *  of it (kitGives). Read in the player's own pack (`localItems`), whichever list the kit was used from. */
const kitHeldBack = (kit, items) => {
  if (!kit || kit.templateIndex !== REPAIR_KIT_TEMPLATE || !Array.isArray(items)) return [];
  const metal = kit.fieldKit === true ? FIELD_KIT : kit.kitMetal;
  return items.filter((it) => it !== kit && kitMends(metal, it) && it.currentCondition < it.maxCondition && !kitGives(it));
};
/** The kit's metal's word, for its refusal ("Nothing of Mithril here wants mending."). */
export const kitMetalName = (kit) => METALS[kit?.kitMetal] ?? 'its metal';

/** MEND-AIM: the chooser's heading, both packs'. */
export const MEND_WHICH_TEXT = 'Mend which?';
/** MEND-AIM: a piece's row in the chooser - "Iron Longsword 42% (worn)" - AUDIT ECON R2: the percentage the card prints
 *  (DFU's ConditionPercentage, truncated), never a rounding of it a point above. */
export const mendTargetLabel = (it) => `${itemLongName(it)} ${conditionPercentage(it)}%${it.equipSlot != null ? ' (worn)' : ''}`;

/** A kit used from the pack (useItem.js's delegate arm): the piece it is aimed at (`target`), or the first of
 *  repairKitTargets, mended - or the kit kept and said so. MEND-AIM: a host that can ask (`chooseTarget`, both packs)
 *  is answered `chooseTarget` with the pieces, in that order, when there is more than one to choose from, and uses the
 *  kit again with the one chosen; the pieces are the player's own (`localItems`) whichever list the kit was used from.
 *  Offline as online - a kit is the pack's, and mending asks no service. */
export function repairKitUse(item, collection, { target = null, chooseTarget = false, localItems = null } = {}) {
  const pack = Array.isArray(localItems) ? localItems : collection;
  if (chooseTarget && target == null && Array.isArray(collection)) {
    const targets = repairKitTargets(item, pack);
    // AUDIT ECON R1: ONE piece to mend while the ceiling holds another back still asks - one row, and Keep. The ceiling
    // took a worn cuirass at 80% out of the choices and left a flail carried to sell at 20%, and the kit went on the
    // flail unasked: MEND-AIM's own complaint, which its chooser answered while both were in it
    if (targets.length > 1 || (targets.length === 1 && kitHeldBack(item, pack).length > 0)) return { kind: 'chooseTarget', item, targets, title: MEND_WHICH_TEXT, labels: targets.map(mendTargetLabel) };
  }
  const done = useRepairKit(item, collection, { target, pack });
  // KIT-CEILING: pieces the kit could take held back at three quarters - say so, rather than that none wants mending.
  // AUDIT ECON R3: and each refusal is a REFUSAL - the kit is kept, and the hotbar (quickslots.js) says it and never
  // strikes gold under it, which it did once a refusal became the answer for any gear between 75% and whole
  if (!done && kitHeldBack(item, pack).length > 0) return { kind: 'repairKit', text: KIT_CEILING_TEXT, refused: true };
  if (!done) return { kind: 'repairKit', text: item?.fieldKit === true ? 'Nothing here wants mending.' : `Nothing of ${kitMetalName(item)} here wants mending.`, refused: true };   // REPAIR-EASE
  // AUDIT 30 C8: a marked piece's name is its maker's - "Silverthorn's Longsword", never "The Silverthorn's"
  const long = itemLongName(done.item);
  const named = typeof done.item.maker === 'string' && long.startsWith(`${done.item.maker}'s `);
  return { kind: 'repairKit', text: `${named ? long : `The ${long}`} is mended: ${done.from}% to ${done.to}%.` };   // AUDIT ECON R2: as the card prints them
}
/** REPAIR-EASE: the field kit's `metal` in kitMends - any weapon or armour. */
export const FIELD_KIT = 'any';
/** REPAIR-EASE: the chance, in percent, a dungeon pile (keys J-O, where DFU's own map and potion roll) holds a field
 *  kit, and a foe with a loot table carries one. */
export const FIELD_KIT_PILE_CHANCE = 6;
export const FIELD_KIT_ENEMY_CHANCE = 3;
/** REPAIR-EASE: a Field Repair Kit - the Repair Kit's template and picture, undyed, worth 15 gold. */
export function mintFieldRepairKit() {
  const item = mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: REPAIR_KIT_TEMPLATE, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  item.name = 'Field Repair Kit';
  item.fieldKit = true;
  item.value = 15;
  return item;
}
/** REPAIR-EASE: one roll of `pct` percent, and a field kit into `items` on a hit. Answers whether one was added. */
export function maybeAddFieldKit(items, pct, rolls = Math.random) {
  if (!Array.isArray(items) || !(rolls() * 100 < pct)) return false;
  items.push(mintFieldRepairKit());
  return true;
}
/** Every host's install (scenes/shared.js): the Repair Kit's use on the item-use door; REPAIR-EASE: and the field kit
 *  into the loot - a J-O pile on LootTables.OnLootSpawned, a looting foe on the enemy-extras hook. */
export function installSmithing() {
  registerItemUseHandler(REPAIR_KIT_TEMPLATE, repairKitUse);
  registerTabledLootHandler('field-repair-kit', ({ key, items, rolls }) => {
    const i = typeof key === 'string' ? key.charCodeAt(0) - 64 : 0;
    if (i >= 10 && i <= 15) maybeAddFieldKit(items, FIELD_KIT_PILE_CHANCE, rolls);
  });
  registerEnemyLootExtra('field-repair-kit', ({ items, rolls }) => maybeAddFieldKit(items, FIELD_KIT_ENEMY_CHANCE, rolls));
}

/** What a craft says it made: "You made a Fine Mithril Longsword." - "two Mithril Repair Kits" for a Quartermaster's;
 *  PROF4: "20 Arrows"; a table waits among the home's things. */
export function craftedText(pieces) {
  if (!pieces.length) return 'You made nothing.';
  const it = pieces[0];
  // PROF9: a dish is cooked, a Cook's two servings
  if (isDish(it)) return pieces.length > 1 ? `You cooked ${pieces.length} servings of ${it.name}` : `You cooked ${/^[AEIOU]/.test(it.name) ? 'an' : 'a'} ${it.name}`;
  if ((it.stackCount ?? 1) > 1) return `You made ${it.stackCount} ${itemLongName(it)}s`;
  const name = itemLongName(it);
  // a piece whose name is its maker's mark ("Silverthorn's Mithril Longsword") takes no article and no quality word -
  // PROF4 found PROF3 saying "an Silverthorn's..." whenever the maker's name began with a vowel
  const marked = typeof it.maker === 'string' && it.maker && (it.quality === MASTERWORK || it.marked === true);
  const word = !marked && Number.isInteger(it.quality) && !Number.isInteger(it.kitMetal) ? `${QUALITY_NAMES[it.quality]} ` : '';
  const one = marked ? name : `${/^[AEIOU]/.test(word || name) ? 'an' : 'a'} ${word}${name}`;
  if (isCraftedFurniture(it)) return `You made ${one} - it waits among your things for a room to stand in`;
  return pieces.length > 1 ? `You made ${pieces.length} ${name}s` : `You made ${one}`;
}
/** SEAT2b part two (PROF0 4.8: "690 | Ram Kit | Stores (a siege work)"): what a siege work's craft says - its kits go to
 *  the Stores, never the pack (the service answers no piece - professions.js craftAtAnvil): "You made a Ram Kit - it waits
 *  in your Stores". */
export const storedText = (name, count = 1) => (count > 1 ? `You made ${count} ${name}s - they wait in your Stores` : `You made a ${name} - it waits in your Stores`);
/** What a craft whose answer did not come says: kept, and made when it does. */
export const CRAFT_KEPT_TEXT = 'The anvil rang, but no word came back - the work is kept, and made when the word comes.';
/** AUDIT 30 A4: the workbench's own (Carpentry's work is planed, not struck). */
export const BENCH_KEPT_TEXT = 'The shavings fell, but no word came back - the work is kept, and made when the word comes.';
/** PROF7: the loom's own. */
export const LOOM_KEPT_TEXT = 'The last stitch was pulled, but no word came back - the work is kept, and made when the word comes.';
/** PROF11: the mason's bench's own. */
export const MASON_KEPT_TEXT = 'The last chip fell, but no word came back - the work is kept, and made when the word comes.';
/** PROF9: the fire's own. */
export const COOK_KEPT_TEXT = 'The last pan came off the fire, but no word came back - the dish is kept, and made when the word comes.';
/** PROF10: the jeweller's bench's own. */
export const JEWEL_KEPT_TEXT = 'The last facet caught the light, but no word came back - the piece is kept, and made when the word comes.';
