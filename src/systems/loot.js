// Loot generation (Systems S1). Verbatim ports from DFU
// LootTables.cs + the ItemBuilder CreateRandom* pick rules (MIT,
// Daggerfall Workshop). Items here are plain records carrying what
// downstream consumers need: { group, templateIndex, name?, material?,
// stackCount?, variant? } - the inventory arc (S2) grows them.
//
// Verbatim notes preserved from the source:
//   - gold = Range(MinGold, MaxGold + 1) * player level
//   - WP/AM/MI/CL/BK/RL roll repeatedly at HALVED chance each hit
//   - ingredients: C1, C2, P1, P2 chances scale by player level;
//     C3, M1, M2 stay flat (FALL.EXE behavior over the Chronicles)
//   - classic compares a 0-99 roll to the chance, so a 0% category
//     still has a 1/100 chance - Dice100 semantics carry that
//   - DFU reseeds Unity's global Random with items.GetHashCode()
//     (an arbitrary hash, no determinism value); our uniform roll
//     slots match the role per the approved engine-PRNG stance
// MI (magic items) rolls need the MAGIC.DEF registry
// (setMagicItemTemplates), and EVERY host that can generate loot now
// loads it: scenes/shared.js:99-102 (loadMagicRegistries) feeds the
// module table this file reads, called from dungeonContext.js:890,
// world.js:1267 and exterior.js:879 - interiors run inside those hosts
// and read the same table. What is left is the data-absent boot, and
// that is DFU's own answer rather than a stand-in: shared.js:102
// records it, the category simply stays empty.

import { randomMaterial, randomArmorMaterial, createWeapon, WEAPONS_ENUM, ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { ARROW_TEMPLATE } from './inventory.js';   // X11b: CreateWeapon's arrow arm keys on it
import { dice100 } from '../combat/formulas.js';
import { goldStack } from './inventory.js';
import { ITEM_TEMPLATES, mintCondition, GROUP_TEMPLATE_INDICES, templateByIndex, itemBaseValue } from './itemTemplates.js';   // F103: SetItem writes the value with the name
import { CLOTHING_DYES } from '../characters/dyes.js';
import { legacyEnchantmentValue } from './enchantments.js';   // G4: ItemBuilder's closing value sum
import { createRandomBook, BOOK_TEMPLATE } from './books.js';   // IM1: CreateRandomBook whole (A2: + its book-file price)
import { potionRecipeByKey } from './potions.js';   // F103: PotionRecipeKey's price side effect
import { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS, DROP_ICON_ARCHIVES, DROP_ICON_IDXS } from './lootDataTables.js';   // G5: DaggerfallLootDataTables.cs, its own file again

// LootChanceMatrix rows, verbatim (22 keys, '-' included).
export const LOOT_MATRICES = Object.freeze({
  '-': { MinGold: 0, MaxGold: 0, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 0, WP: 0, MI: 0, CL: 0, BK: 0, M2: 0, RL: 0 },
  A: { MinGold: 1, MaxGold: 10, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 5, WP: 5, MI: 2, CL: 4, BK: 0, M2: 2, RL: 0 },
  B: { MinGold: 0, MaxGold: 0, P1: 10, P2: 10, C1: 0, C2: 0, C3: 0, M1: 0, AM: 0, WP: 0, MI: 0, CL: 0, BK: 0, M2: 0, RL: 0 },
  C: { MinGold: 2, MaxGold: 20, P1: 10, P2: 10, C1: 5, C2: 5, C3: 5, M1: 5, AM: 5, WP: 25, MI: 3, CL: 0, BK: 2, M2: 2, RL: 2 },
  D: { MinGold: 1, MaxGold: 4, P1: 6, P2: 6, C1: 6, C2: 6, C3: 6, M1: 6, AM: 0, WP: 0, MI: 0, CL: 0, BK: 0, M2: 0, RL: 4 },
  E: { MinGold: 20, MaxGold: 80, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 10, WP: 10, MI: 3, CL: 4, BK: 2, M2: 1, RL: 15 },
  F: { MinGold: 4, MaxGold: 30, P1: 2, P2: 2, C1: 5, C2: 5, C3: 5, M1: 2, AM: 50, WP: 50, MI: 1, CL: 0, BK: 0, M2: 3, RL: 0 },
  G: { MinGold: 3, MaxGold: 15, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 50, WP: 50, MI: 1, CL: 5, BK: 0, M2: 3, RL: 0 },
  H: { MinGold: 2, MaxGold: 10, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 0, WP: 100, MI: 1, CL: 2, BK: 0, M2: 0, RL: 0 },
  I: { MinGold: 0, MaxGold: 0, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 0, WP: 0, MI: 2, CL: 0, BK: 0, M2: 0, RL: 5 },
  J: { MinGold: 50, MaxGold: 150, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 5, WP: 5, MI: 3, CL: 0, BK: 0, M2: 0, RL: 0 },
  K: { MinGold: 1, MaxGold: 10, P1: 3, P2: 3, C1: 3, C2: 3, C3: 3, M1: 3, AM: 5, WP: 5, MI: 3, CL: 0, BK: 5, M2: 2, RL: 100 },
  L: { MinGold: 1, MaxGold: 20, P1: 0, P2: 0, C1: 3, C2: 3, C3: 3, M1: 3, AM: 50, WP: 50, MI: 1, CL: 75, BK: 0, M2: 5, RL: 3 },
  M: { MinGold: 1, MaxGold: 15, P1: 1, P2: 1, C1: 1, C2: 1, C3: 1, M1: 2, AM: 10, WP: 10, MI: 1, CL: 15, BK: 2, M2: 3, RL: 1 },
  N: { MinGold: 1, MaxGold: 80, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 5, AM: 5, WP: 5, MI: 1, CL: 20, BK: 5, M2: 2, RL: 5 },
  O: { MinGold: 5, MaxGold: 20, P1: 1, P2: 1, C1: 1, C2: 1, C3: 1, M1: 1, AM: 10, WP: 15, MI: 2, CL: 0, BK: 0, M2: 0, RL: 0 },
  P: { MinGold: 5, MaxGold: 20, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 5, AM: 5, WP: 10, MI: 2, CL: 0, BK: 10, M2: 5, RL: 0 },
  Q: { MinGold: 20, MaxGold: 80, P1: 2, P2: 2, C1: 8, C2: 8, C3: 8, M1: 2, AM: 10, WP: 25, MI: 3, CL: 35, BK: 5, M2: 3, RL: 0 },
  R: { MinGold: 5, MaxGold: 20, P1: 0, P2: 0, C1: 3, C2: 3, C3: 3, M1: 5, AM: 5, WP: 15, MI: 2, CL: 0, BK: 0, M2: 0, RL: 0 },
  S: { MinGold: 50, MaxGold: 125, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 15, AM: 10, WP: 10, MI: 3, CL: 0, BK: 5, M2: 5, RL: 0 },
  T: { MinGold: 20, MaxGold: 80, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 100, WP: 100, MI: 1, CL: 0, BK: 0, M2: 0, RL: 0 },
  U: { MinGold: 7, MaxGold: 30, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 10, AM: 10, WP: 10, MI: 2, CL: 0, BK: 2, M2: 2, RL: 10 },
});

// ItemGroups template-index lists.
//
// AUDIT 24 (wave 23): these twelve rows were a SECOND copy of twelve
// of GROUP_TEMPLATE_INDICES' rows - the same numbers, extracted from
// the same ItemEnums.cs, sitting in a file that already imports the
// first copy two lines above. Identical the day it was found. They
// are a view onto the one table now, so a regenerated enum cannot
// move one and leave the other.
const LOOT_GROUP_KEYS = Object.freeze([
  'PlantIngredients1', 'PlantIngredients2',
  'CreatureIngredients1', 'CreatureIngredients2', 'CreatureIngredients3',
  'MiscellaneousIngredients1', 'MiscellaneousIngredients2',
  'ReligiousItems', 'Gems', 'Jewellery', 'MensClothing', 'WomensClothing',
]);
export const ITEM_GROUPS = Object.freeze(Object.fromEntries(
  LOOT_GROUP_KEYS.map((k) => [k, GROUP_TEMPLATE_INDICES[k]])));
export { BOOK_TEMPLATE };   // ONE DFU MEMBER, ONE EXPORT: template 277's home is books.js now

// LootTables.GenerateLoot verbatim data (moved here from the dungeon
// scene in the 2026-07-06b audit - a scene file is no home for source
// tables). ROAD-G G5: DaggerfallLootDataTables' own three members went
// on to `systems/lootDataTables.js` - DFU's own file boundary - so a
// leaf can read the drop-icon table without importing this generator;
// they are RE-EXPORTED here, so every importer that reads them off
// `loot.js` still does.
export { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS, DROP_ICON_ARCHIVES, DROP_ICON_IDXS };
export const RANDOM_TREASURE_MARKER_RECORD = 19;               // RDBLayout randomTreasureFlatIndex (editor 199.19)

/** GenerateLoot's dungeon-type -> key rows (19 types, in order). */
export const DUNGEON_LOOT_KEYS = Object.freeze(['K', 'N', 'N', 'N', 'K', 'M', 'M', 'Q', 'K', 'U', 'D', 'N', 'L', 'F', 'S', 'N', 'M', 'L', 'N']);   // Book0..3 all template 277; CreateRandomBook rolls Range(0, TotalVariants) = Range(0, 2) - the 4 is the Books ENUM NAME count, not a variant count

const WEAPON_NAMES = Object.keys(WEAPONS_ENUM);   // 18 melee/bow names; index 18 = Arrow
const ARMOR_PIECES = Object.values(ARMOR_ENUM);   // 11 pieces incl shields

/** ItemBuilder.CreateRandomWeapon: uniform over the 19 weapon slots;
 *  slot 18 is arrows - stack Range(1, 21), material 0. */
export function createRandomWeapon(playerLevel, rolls = Math.random) {
  const groupIndex = Math.floor(rolls() * 19);
  // AUDIT 24 systems: the arrow branch makes THREE writes
  // (ItemBuilder.cs:395-398) - the stack, `currentCondition = 0`
  // ("not sure if this is necessary, but classic does it") and
  // `nativeMaterialValue = 0`. maxCondition stays the template's
  // hitPoints, since the arrow branch never runs ApplyWeaponMaterial.
  // The port dropped the zero and then let mintCondition fill the
  // stack in at 100%.
  //
  // X11b: that arm was WRITTEN OUT HERE, inline, while the other arm
  // of the same DFU function lived in combat/enemyEquipment.js. Both
  // arms are CreateWeapon's, so both live there now and this call
  // reaches the whole function - which is what let Create Item mint
  // conjured arrows without a third copy of these four lines.
  if (groupIndex === 18) return createWeapon(ARROW_TEMPLATE, 0, rolls);
  const name = WEAPON_NAMES[groupIndex];
  return { group: 'Weapons', ...createWeapon(WEAPONS_ENUM[name], randomMaterial(playerLevel, rolls)) };
}

/** ItemBuilder.CreateRandomArmor: uniform over the 11 armor pieces
 *  (shields included) + RandomArmorMaterial. */
export function createRandomArmor(playerLevel, rolls = Math.random) {
  const piece = ARMOR_PIECES[Math.floor(rolls() * ARMOR_PIECES.length)];
  return { group: 'Armor', templateIndex: piece, material: randomArmorMaterial(playerLevel, rolls) };
}

const pick = (list, rolls) => list[Math.floor(rolls() * list.length)];

/** DaggerfallUnityItem.ItemName is the TEMPLATE's name for every
 *  plain item (only magic items and weapons carry their own).
 *  AUDIT 18: the loot factories minted bare {group, templateIndex},
 *  so the dungeon item list (the keyed window that lived in what is
 *  now ui/deathScreen.js) labelled a looted
 *  Yellow Flowers "PlantIngredients1".
 *
 *  AUDIT 39 F103: and SetItem's OTHER write goes with the name -
 *  `value = itemTemplate.basePrice` (DaggerfallUnityItem.cs:563),
 *  through SetItemPropertiesByMaterial's multiplier (ItemBuilder.cs:
 *  649) for the material bands, which is what itemBaseValue answers.
 *  NO DFU item exists without a value, and the trade window reads
 *  `item.value` raw: an undefined one summed to NaN, and
 *  CalculateTradePrice's `>>8` collapsed that to 0 - looted gear sold
 *  for nothing and was taken. Anything minted with its own value
 *  (a magic item's enchantment sum) keeps it. */
const named = (item) => ({
  ...item,
  name: item.name ?? ITEM_TEMPLATES[item.templateIndex]?.name,
  value: item.value ?? itemBaseValue(item),
});

/** ItemBuilder.CreateRandomClothing verbatim (:184-208): a uniform
 *  template over the gender's group, then RandomClothingDye, THEN
 *  SetVariant(Range(0, TotalVariants)) - that roll order is the
 *  opposite of the shop shelf's (DaggerfallLoot.cs:230-239 rolls the
 *  variant inside CreateMensClothing and assigns the dye after), so
 *  the two paths must NOT share a helper. */
export function createRandomClothing(gender, rolls = Math.random) {
  const group = gender === 'female' ? 'WomensClothing' : 'MensClothing';
  const templateIndex = pick(ITEM_GROUPS[group], rolls);
  const dye = CLOTHING_DYES[Math.floor(rolls() * CLOTHING_DYES.length)];
  const variant = Math.floor(rolls() * (ITEM_TEMPLATES[templateIndex]?.variants ?? 0));
  return { group, templateIndex, dye, variant };
}

/** LootTables.GenerateRandomLoot, verbatim flow. `who` = { level,
 *  gender } (race feeds clothing variants later - S2). */
export function generateRandomLoot(matrix, who, rolls = Math.random) {
  const items = [];
  const level = Math.max(1, who.level | 0);
  const gold = (matrix.MinGold + Math.floor(rolls() * (matrix.MaxGold + 1 - matrix.MinGold))) * level;
  // ItemBuilder.CreateGoldPieces = CreateItem(Currency, Gold_pieces).
  // AUDIT 18: this minted a bare Currency row with NO templateIndex,
  // so inventory.stacksWith could never merge it with the player's
  // gold stack (276) - looted gold was a second, unspendable row.
  if (gold > 0) items.push(goldStack(gold));
  const halving = (chance, make) => {
    let c = chance;
    while (dice100(Math.trunc(c), rolls())) { items.push(mintCondition(named(make()))); c *= 0.5; }   // AUDIT 23 (items-5)
  };
  halving(matrix.WP, () => createRandomWeapon(level, rolls));
  halving(matrix.AM, () => createRandomArmor(level, rolls));
  const ingredient = (chance, groupName) =>
    halving(chance, () => ({ group: groupName, templateIndex: pick(ITEM_GROUPS[groupName], rolls) }));
  ingredient(matrix.C1 * level, 'CreatureIngredients1');
  ingredient(matrix.C2 * level, 'CreatureIngredients2');
  ingredient(matrix.C3, 'CreatureIngredients3');
  ingredient(matrix.P1 * level, 'PlantIngredients1');
  ingredient(matrix.P2 * level, 'PlantIngredients2');
  ingredient(matrix.M1, 'MiscellaneousIngredients1');
  ingredient(matrix.M2, 'MiscellaneousIngredients2');
  // MI (S4c): real when MAGIC.DEF templates are registered (context
  // build); absent -> the category still skips, loudly interim.
  if (_magicItemTemplates) {
    halving(matrix.MI, () => createRegularMagicItem(_magicItemTemplates, level, who.gender, rolls));
  }
  halving(matrix.CL, () => createRandomClothing(who.gender, rolls));
  // CreateRandomBook: message = GetRandomBookID() FIRST (IM1 - the
  // mint never set it, so a dungeon-loot book had no id: no title on
  // the info panel and nothing for the reader to open), THEN
  // CurrentVariant = Range(0, book.TotalVariants), variants 2 for
  // template 277, THEN `book.value = bookFile.Price`. A2 closed that
  // last clause and took the whole member into books.js, so the three
  // sites that had it inline share one mint and one draw order.
  halving(matrix.BK, () => createRandomBook(rolls));
  halving(matrix.RL, () => ({ group: 'ReligiousItems', templateIndex: pick(ITEM_GROUPS.ReligiousItems, rolls) }));
  return items;
}

// ---- Magic items (S4c): ItemBuilder.CreateRegularMagicItem verbatim ----
// The MAGIC.DEF registry: set once per context after the file loads.
let _magicItemTemplates = null;
export function setMagicItemTemplates(templates) { _magicItemTemplates = templates; }
// G4: the SPELLS.STD records, by index, for the CastWhen* arm of the
// value sum below. The same module-level-registry idiom, set from the
// same host block that builds the map (dungeonContext) - and absent
// it, DFU's own answer applies: a spell the reader cannot find scores
// zero, because GetSpellEnchantPtCost's loop simply never matches.
let _spellsByIndex = null;
export function setSpellRecordsByIndex(byIndex) { _spellsByIndex = byIndex; }
export const spellRecordOfIndex = (index) => _spellsByIndex?.get?.(index) ?? null;

// "The possible groups are determined by the 33rd byte" - group 0
// picks from {Armor 2, Weapons 3, MensClothing 6, ReligiousItems 10,
// WomensClothing 12, Gems 14, Jewellery 25}; group 1 from
// {2, 3, 6, 12, 25}; group 2 is always Weapons. ItemGroups numerics
// per ItemEnums.cs.
const MAGIC_GROUPS_0 = Object.freeze([2, 3, 6, 10, 12, 14, 25]);
const MAGIC_GROUPS_1 = Object.freeze([2, 3, 6, 12, 25]);

export function createRegularMagicItem(templates, playerLevel, gender, rolls = Math.random, chosenItem = -1) {
  const regular = templates.filter((t) => t.type === 0);   // RegularMagicItem
  // Q2b-ii: the quest mint's "item class 4 subclass N" passes a CHOSEN
  // index (-1 = random, as every earlier caller). C#'s guard is `>`
  // Length - chosenItem == Length walks off the array and crashes
  // there too (kept: regular[length] is undefined and throws below).
  if (chosenItem > regular.length) throw new Error(`Magic item subclass ${chosenItem} does not exist`);
  if (chosenItem === -1) chosenItem = Math.floor(rolls() * regular.length);
  const magicItem = regular[chosenItem];
  let groupId;
  if (magicItem.group === 0) groupId = MAGIC_GROUPS_0[Math.floor(rolls() * 7)];
  else if (magicItem.group === 1) groupId = MAGIC_GROUPS_1[Math.floor(rolls() * 5)];
  else groupId = 3;   // group 2 -> Weapons
  let base;
  if (groupId === 3) {
    base = createRandomWeapon(playerLevel, rolls);
    while (base.name === 'Arrow') base = createRandomWeapon(playerLevel, rolls);   // "No arrows as enchanted items"
  } else if (groupId === 2) base = createRandomArmor(playerLevel, rolls);
  else if (groupId === 6 || groupId === 12) base = createRandomClothing(gender, rolls);
  else if (groupId === 10) base = { group: 'ReligiousItems', templateIndex: pick(ITEM_GROUPS.ReligiousItems, rolls) };
  else if (groupId === 14) base = { group: 'Gems', templateIndex: pick(ITEM_GROUPS.Gems, rolls) };
  else base = { group: 'Jewellery', templateIndex: pick(ITEM_GROUPS.Jewellery, rolls) };
  // The regular name is replaced by the magic name; enchantments ride
  // raw; condition = uses.
  //
  // G4: THE VALUE IS OVERWRITTEN (:632). The gap that stood here from
  // S4c - the enchantment cost sum unported, so a magic item sold at
  // its mundane base - closed with M4's catalogue: the sum is
  // legacyEnchantmentValue (enchantments.js:218-236) and it is called
  // on the `value:` line below. `newItem.value = value` REPLACES
  // whatever the base item was
  // worth, so a daedric longsword and a leather boot with the same
  // enchantment are worth the same; and it replaces MAGIC.DEF's own
  // stored `value` field too, which is why that field is read and
  // never used. On the shipping file the two disagree by up to a
  // factor of six.
  const enchantments = magicItem.enchantments.filter((e) => e.type !== -1);
  return {
    ...base,
    name: magicItem.name,
    magic: true,
    enchantments,
    value: legacyEnchantmentValue(enchantments, { spellOfIndex: spellRecordOfIndex }),
    maxCondition: magicItem.uses,
    currentCondition: magicItem.uses,
  };
}

// The ItemGroups NUMBER -> the port's group NAME, in ItemEnums.cs:27-59
// order. The quest mint (Q2b-ii) resolves "item class N" through it;
// MagicItems/Artifacts/Books never reach the generic arm (their
// CreateItem branches run first, as in Item.cs).
export const ITEM_GROUP_NAME_BY_CLASS = Object.freeze([
  'Drugs', 'UselessItems1', 'Armor', 'Weapons', 'MagicItems', 'Artifacts',
  'MensClothing', 'Books', 'Furniture', 'UselessItems2', 'ReligiousItems',
  'Maps', 'WomensClothing', 'Paintings', 'Gems', 'PlantIngredients1',
  'PlantIngredients2', 'CreatureIngredients1', 'CreatureIngredients2',
  'CreatureIngredients3', 'MiscellaneousIngredients1', 'MetalIngredients',
  'MiscellaneousIngredients2', 'Transportation', 'Deeds', 'Jewellery',
  'QuestItems', 'MiscItems', 'Currency',
]);

// ── THE ITEM FLAG BITMASKS (DaggerfallUnityItem.cs:94-98) ─────────
//
// A4: two constants and the derivation over them. Every item DFU
// MINTS carries its identity as booleans on the port's record
// (createArtifact below writes `artifact` and `isIdentified` where
// DFU writes `flags = artifactMask | identifiedMask`, :617) - but an
// item read out of a CLASSIC SAVE arrives with the classic flags word
// and nothing else, so the two bits have to be read back out of it.

export const ITEM_IDENTIFIED_MASK = 0x20;
export const ITEM_ARTIFACT_MASK = 0x800;

/** ItemEnums.ArtifactsSubTypes (:238-264) by NAME, in Enum.GetNames
 *  order - which is value order, so None (-1) leads. The names are the
 *  lookup key, not decoration: LegacyGetArtifactSubType matches them
 *  against the item's own short name. */
export const ARTIFACT_SUB_TYPE_NAMES = Object.freeze([
  ['None', -1],
  ['Masque_of_Clavicus', 0], ['Mehrunes_Razor', 1], ['Mace_of_Molag_Bal', 2],
  ['Hircine_Ring', 3], ['Sanguine_Rose', 4], ['Oghma_Infinium', 5],
  ['Wabbajack', 6], ['Ring_of_Namira', 7], ['Skull_of_Corruption', 8],
  ['Azuras_Star', 9], ['Volendrung', 10], ['Warlocks_Ring', 11],
  ['Auriels_Bow', 12], ['Necromancers_Amulet', 13], ['Chrysamere', 14],
  ['Lords_Mail', 15], ['Staff_of_Magnus', 16], ['Ring_of_Khajiit', 17],
  ['Ebony_Mail', 18], ['Auriels_Shield', 19], ['Spell_Breaker', 20],
  ['Skeletons_Key', 21], ['Ebony_Blade', 22],
]);

/**
 * ItemHelper.LegacyGetArtifactSubType (ItemHelper.cs:532-541) verbatim.
 * The short name loses its apostrophes and turns its spaces into
 * underscores, then the FIRST enum name it CONTAINS wins - a substring
 * test, not equality, because classic short names carry decoration
 * ("Auriel's Bow" but also the odd prefixed variant). Answers
 * ArtifactsSubTypes.None (-1) when nothing matches.
 */
export function legacyGetArtifactSubType(itemShortName) {
  const key = String(itemShortName ?? '').replaceAll('\'', '').replaceAll(' ', '_');
  for (const [name, value] of ARTIFACT_SUB_TYPE_NAMES) {
    if (key.includes(name)) return value;
  }
  return -1;
}

/**
 * DaggerfallUnityItem.LegacyArtifactIndexBitfieldCheck (:1697-1707),
 * run by FromItemRecord (:1582) on every classic item and by the
 * legacy-save restore (:1678).
 *
 * "Newly created artifacts store their artifact index in
 * artifactIndexBitfield as artifactIndex << 1 | 1" - bit 0 is the
 * HAS-AN-INDEX flag, so an item whose flags say artifact but whose
 * bitfield's low bit is clear came from data that predates the field,
 * and the index is recovered by reversing the name to the enum the way
 * older versions did. A name that matches nothing leaves the bitfield
 * alone: an artifact with no recoverable index, which is DFU's own
 * outcome (GetArtifactSubType then throws and the caller logs).
 *
 * MUTATES the item, as the C# mutates `this`. Returns the item.
 */
export function legacyArtifactIndexBitfieldCheck(item) {
  if (!item?.artifact) return item;
  if (((item.artifactIndexBitfield ?? 0) & 1) !== 0) return item;
  const subType = legacyGetArtifactSubType(item.shortName ?? item.name);
  if (subType !== -1) item.artifactIndexBitfield = (subType << 1) | 1;
  return item;
}

/** ItemHelper.GetArtifactTextureIndices (ItemHelper.cs:519-523), the
 *  whole of it: the ARCHIVE is the player's gender and nothing else,
 *  and the RECORD is this table indexed by the artifact subtype
 *  (ItemHelper.cs:43). Both are static - no ARENA2 read anywhere in
 *  the call. */
export const ARTIFACT_MALE_TEXTURE_ARCHIVE = 432;     // ItemHelper.cs:50
export const ARTIFACT_FEMALE_TEXTURE_ARCHIVE = 433;   // ItemHelper.cs:51
export const ARTIFACT_TEXTURE_INDEX_MAPPINGS = Object.freeze([
  12, 13, 10, 8, 19, 16, 25, 18, 21, 2, 24, 26, 0, 15, 3, 9, 23, 17, 7, 1, 22, 20, 5,
]);
export function artifactTextureIndices(artifactIndex, gender = 'male') {
  return {
    archive: gender === 'female' ? ARTIFACT_FEMALE_TEXTURE_ARCHIVE : ARTIFACT_MALE_TEXTURE_ARCHIVE,
    record: ARTIFACT_TEXTURE_INDEX_MAPPINGS[artifactIndex] ?? 0,
  };
}

/** DaggerfallUnityItem.SetArtifact (DaggerfallUnityItem.cs:580-612)
 *  over the MAGIC.DEF registry: the artifact template (rows with type
 *  ArtifactClass1/2, file order - ItemHelper.cs:1511-1517) expands to
 *  its base group/groupIndex, armor material moves to the plate band
 *  (0x200+), the magic name replaces the base name and the
 *  enchantments ride raw.
 *  ArtifactIndexBitfield (index << 1 | 1) is carried for save parity.
 *
 *  D9: THE TEXTURE INDICES SHIP. They used to be waved off as "the
 *  inventory art's concern", but SetArtifact writes all four
 *  (:608-611, world = player, on DFU's own "not sure about artifact
 *  world textures" note) and one LAW reads them: Open.CheckCastByItem
 *  identifies the Skeleton's Key by `IsArtifact && WorldTextureArchive
 *  == 432 && WorldTextureRecord == 20` (Open.cs:176-180) - so without
 *  them no item could ever be the key. Note what that means for a
 *  FEMALE character: her artifacts are archive 433, so her Skeleton's
 *  Key does NOT bypass the door's level test. That is DFU's, verbatim,
 *  and it is why the gender rides this call. */
export function createArtifact(templates, artifactIndex, { gender = 'male' } = {}) {
  const artifacts = templates.filter((t) => t.type === 1 || t.type === 2);
  const magicItem = artifacts[artifactIndex];
  if (!magicItem) throw new Error(`Artifact template index out of range: ArtifactIndex=${artifactIndex}`);
  const groupName = ITEM_GROUP_NAME_BY_CLASS[magicItem.group];
  const templateIndex = GROUP_TEMPLATE_INDICES[groupName]?.[magicItem.groupIndex];
  let material = magicItem.material;
  if (magicItem.group === 2) material = 0x200 + material;   // Armor -> plate band
  // ROAD-U: the two identity BOOLEANS this used to stamp here
  // (`oghmaInfinium` on index 5, `azurasStar` on index 9) are gone.
  // Nothing in DFU carries them: ItemHelper.GetItemInfo (:782, :811)
  // and SoulTrap.cs:129 both ask the ITEM's own enchantment record for
  // SpecialArtifactEffect + subtype, which SetArtifact copies below
  // and which a classic import carries too - so keying on a flag only
  // this mint wrote made every imported Oghma a plain book and every
  // imported Star an inert gem. The identity now rides
  // `enchantments`, one predicate for both paths
  // (artifactEffects.hasArtifactSubtype).
  return {
    group: groupName,
    templateIndex,
    name: magicItem.name,
    magic: true,
    artifact: true,
    // SetArtifact's flags word (:617) - `artifactMask | identifiedMask`,
    // and DFU's own comment on the line is "Set as artifact &
    // identified." An artifact is BORN identified, which is why the
    // trade window's Identify service only ever stages `if
    // (!item.IsIdentified)` (DaggerfallTradeWindow.cs:823-826) and
    // never charges for one. Without this every artifact read
    // unidentified through itemIsIdentified (tradeModes.js), so its
    // info panel showed the base template name instead of the artifact
    // name and the Identify service billed (25 * value) >> 8 for it.
    isIdentified: true,
    artifactIndexBitfield: (artifactIndex << 1) | 1,
    material,
    enchantments: magicItem.enchantments.filter((e) => e.type !== -1),
    maxCondition: magicItem.uses,
    currentCondition: magicItem.uses,
    // SetArtifact :608-611 - the same pair twice, player and world.
    playerTextureArchive: artifactTextureIndices(artifactIndex, gender).archive,
    playerTextureRecord: artifactTextureIndices(artifactIndex, gender).record,
    worldTextureArchive: artifactTextureIndices(artifactIndex, gender).archive,
    worldTextureRecord: artifactTextureIndices(artifactIndex, gender).record,
    // SetArtifact's own price (:615) - the MAGIC.DEF row's value, not
    // the mundane base template's (Q2b-ii VERIFY: it was dropped).
    value: magicItem.value,
  };
}

/** The MAGIC.DEF registry, readable by the quest mint (Q2b-ii): the
 *  mint builds real magic items and artifacts when a host has
 *  registered the file, and pends LOUDLY when not (the headless
 *  corpus gate runs with no ARENA2 - Ledger row). */
export function getMagicItemTemplates() { return _magicItemTemplates; }

/** DaggerfallLoot.GenerateItems: key -> matrix -> loot. Unknown keys
 *  fall to '-' (empty), matching GetMatrix's null-safe use. */
export function generateItems(lootTableKey, who, rolls = Math.random) {
  const matrix = LOOT_MATRICES[lootTableKey] ?? LOOT_MATRICES['-'];
  return generateRandomLoot(matrix, who, rolls);
}

// ---- The three rolls nobody ran (AUDIT 24, wave 43) ----------------
// SetEnemyCareer does not stop at the loot table. EnemyEntity.cs:388-397:
//
//     DaggerfallLoot.RandomlyAddMap(mobileEnemy.MapChance, items);
//     if (!string.IsNullOrEmpty(mobileEnemy.LootTableKey))
//     {
//         DaggerfallLoot.RandomlyAddPotion(3, items);
//         DaggerfallLoot.RandomlyAddPotionRecipe(2, items);
//     }
//
// `mapChance` is in all sixty-two rows of ENEMY_BASICS and had zero
// readers, so no enemy in the game has ever dropped a dungeon map -
// which in classic is a main way the player finds new dungeons at all.
// No enemy dropped a potion or a recipe either.
//
// The map arm is UNCONDITIONAL; the potion pair is gated on the enemy
// having a loot table. So a Ghost (mapChance 3, no table) can carry a
// map and never a potion, and that asymmetry is DFU's.

/** PotionRecipe.cs:28-29 - classicRecipeKeys, the twenty recipe hashes
 *  of the unmodded game.
 *
 *  RandomlyAddPotionRecipe picks from exactly this list.
 *  CreateRandomPotion instead asks the broker for every REGISTERED
 *  potion recipe (EntityEffectBroker.cs:476-479), which is built from
 *  the effects that define one - and the vendored tree defines twenty,
 *  across fifteen effect files, against this list of twenty. So in the
 *  unmodded game the two sets are the same set, and the port uses this
 *  one for both. The day the port registers a potion effect of its
 *  own, CreateRandomPotion's source moves to that registry and this
 *  list stays where it is: DFU keeps them separate for that reason. */
export const CLASSIC_RECIPE_KEYS = Object.freeze([
  221871, 239524, 4975678, 5017404, 5188896, 111516185, 4826108, 216843, 224588, 220192,
  240081, 4937012, 228890, 221117, 4870452, 5361377, 112080144, 4842851, 4815872, 2031019196,
]);

/** MiscItems.Map (template 287) - ItemBuilder has no maker for it;
 *  DaggerfallLoot news it up inline (:92). */
export const MAP_TEMPLATE_INDEX = 287;
/** MiscItems index 4 = Potion recipe (template 278). */
export const POTION_RECIPE_TEMPLATE_INDEX = 278;
/** UselessItems1 index 1 = the glass bottle a potion IS (:754). */
export const POTION_TEMPLATE_INDEX = GROUP_TEMPLATE_INDICES.UselessItems1[1];

/** AUDIT 39 F103: PotionRecipeKey's setter carries the PRICE - "has a
 *  side effect (ugh, sorry) of populating the item value from the
 *  recipe price" (DaggerfallUnityItem.cs:387-399), and it is the whole
 *  worth of a potion or a recipe: the bottle's own basePrice is 1.
 *  A key no recipe answers leaves the template value standing, as the
 *  setter's own null guard does. */
const potionValue = (recipeKey, item) => potionRecipeByKey(recipeKey)?.price ?? itemBaseValue(item);

/** ItemBuilder.CreatePotion (:752-755) - a bottle carrying a key. */
export function createPotion(recipeKey) {
  const potion = { group: 'UselessItems1', templateIndex: POTION_TEMPLATE_INDEX, potionRecipeKey: recipeKey };
  return mintCondition({ ...potion, value: potionValue(recipeKey, potion) });
}

/** ItemBuilder.CreateRandomPotion (:761-766). */
export function createRandomPotion(rolls = Math.random) {
  return createPotion(CLASSIC_RECIPE_KEYS[Math.floor(rolls() * CLASSIC_RECIPE_KEYS.length)]);
}

/** DaggerfallLoot.RandomlyAddMap (:88-96). Dice100.SuccessRoll, so a
 *  chance of 0 never fires and no roll is wasted deciding that. */
export function randomlyAddMap(chance, items, rolls = Math.random) {
  if (!dice100(chance, rolls())) return null;
  const map = mintCondition({ group: 'MiscItems', templateIndex: MAP_TEMPLATE_INDEX, value: itemBaseValue({ group: 'MiscItems', templateIndex: MAP_TEMPLATE_INDEX }) });   // F103: SetItem's basePrice
  items.push(map);
  return map;
}

/** DaggerfallLoot.RandomlyAddPotion (:100-105). */
export function randomlyAddPotion(chance, items, rolls = Math.random) {
  if (!dice100(chance, rolls())) return null;
  const potion = createRandomPotion(rolls);
  items.push(potion);
  return potion;
}

/** DaggerfallLoot.RandomlyAddPotionRecipe (:109-118). */
export function randomlyAddPotionRecipe(chance, items, rolls = Math.random) {
  if (!dice100(chance, rolls())) return null;
  const key = CLASSIC_RECIPE_KEYS[Math.floor(rolls() * CLASSIC_RECIPE_KEYS.length)];
  // CreateRandomRecipe sets PotionRecipeKey too (ItemBuilder.cs:772),
  // so a recipe is priced by the potion it teaches, not by MiscItems 4.
  const row = { group: 'MiscItems', templateIndex: POTION_RECIPE_TEMPLATE_INDEX, potionRecipeKey: key };
  const recipe = mintCondition({ ...row, value: potionValue(key, row) });
  items.push(recipe);
  return recipe;
}

/** EnemyEntity.cs:388-397's tail, for all four spawn sites. Runs
 *  AFTER the equipment, as DFU does - AssignEnemyStartingEquipment
 *  has already pushed the gear into `items` by :388, so a map lands
 *  after a helmet in the list and not before it. */
export function addEnemyLootExtras(items, basics, rolls = Math.random) {
  if (!items || !basics) return items;
  randomlyAddMap(basics.mapChance ?? 0, items, rolls);
  // "if (!string.IsNullOrEmpty(mobileEnemy.LootTableKey))" - the port
  // spells an absent table '-' at its call sites, and DFU's own rows
  // leave it null, so both are "no table".
  const key = basics.lootTableKey;
  if (key && key !== '-') {
    randomlyAddPotion(3, items, rolls);
    randomlyAddPotionRecipe(2, items, rolls);
  }
  return items;
}

/** LootTables.GenerateLoot (:145-160) - the DUNGEON PILE half, which
 *  is a different trio: the map chance comes from a six-entry table
 *  indexed by the loot key, and only keys J through O roll at all.
 *  The potion chance is FOUR here, not three. */
export const PILE_MAP_CHANCES = Object.freeze([2, 1, 1, 2, 2, 15]);   // J, K, L, M, N, O

export function addPileLootExtras(items, lootTableKey, rolls = Math.random) {
  if (!items || !lootTableKey) return items;
  // `int alphabetIndex = key - 64` on the FIRST character: 'A' is 1,
  // so J is 10 and O is 15.
  const alphabetIndex = lootTableKey.charCodeAt(0) - 64;
  if (alphabetIndex < 10 || alphabetIndex > 15) return items;
  randomlyAddMap(PILE_MAP_CHANCES[alphabetIndex - 10], items, rolls);
  randomlyAddPotion(4, items, rolls);
  randomlyAddPotionRecipe(2, items, rolls);
  return items;
}

