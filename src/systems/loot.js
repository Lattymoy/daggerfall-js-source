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
// INTERIM (loud): MI (magic items) rolls need the MAGIC.DEF registry
// (setMagicItemTemplates) - a context that has not loaded it
// under-generates by that category.

import { randomMaterial, randomArmorMaterial, createWeapon, WEAPONS_ENUM, ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { dice100 } from '../combat/formulas.js';
import { goldStack } from './inventory.js';
import { ITEM_TEMPLATES } from './itemTemplates.js';
import { CLOTHING_DYES } from '../characters/dyes.js';

// LootChanceMatrix rows, verbatim (21 keys).
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

// ItemGroups template-index lists (ItemEnums.cs, brace-bounded
// extraction, counts asserted at generation time).
export const ITEM_GROUPS = Object.freeze({
  PlantIngredients1: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 25],
  PlantIngredients2: [8, 9, 10, 11, 12, 13, 15, 16, 17, 21, 22, 24, 26, 27, 28, 29, 30, 31, 32],
  CreatureIngredients1: [33, 35, 38, 39, 40, 41, 42, 43, 44, 45, 50, 51, 53, 54, 61],
  CreatureIngredients2: [46, 47, 48, 49, 52],
  CreatureIngredients3: [34, 36, 37],
  MiscellaneousIngredients1: [55, 56, 57, 58, 59, 60, 62, 63, 64],
  MiscellaneousIngredients2: [76, 77],
  ReligiousItems: [258, 259, 260, 261, 262, 263, 264, 265, 267, 268, 269, 270, 271],
  Gems: [0, 1, 2, 3, 4, 5, 6, 7],
  Jewellery: [133, 134, 135, 136, 137, 138, 139, 140],
  MensClothing: [141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181],
  WomensClothing: [182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216],
});
export const BOOK_TEMPLATE = 277;

// DaggerfallLootDataTables + LootTables.GenerateLoot verbatim data
// (moved here from the dungeon scene in the 2026-07-06b audit - a
// scene file is no home for source tables):
export const RANDOM_TREASURE_ARCHIVE = 216;                    // randomTreasureArchive
export const RANDOM_TREASURE_MARKER_RECORD = 19;               // RDBLayout randomTreasureFlatIndex (editor 199.19)
export const RANDOM_TREASURE_ICONS = Object.freeze([0, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 37, 43, 44, 45, 46, 47]);
/** GenerateLoot's dungeon-type -> key rows (19 types, in order). */
export const DUNGEON_LOOT_KEYS = Object.freeze(['K', 'N', 'N', 'N', 'K', 'M', 'M', 'Q', 'K', 'U', 'D', 'N', 'L', 'F', 'S', 'N', 'M', 'L', 'N']);   // Book0..3 all template 277; CreateRandomBook rolls Range(0, TotalVariants) = Range(0, 2) - the 4 is the Books ENUM NAME count, not a variant count

const WEAPON_NAMES = Object.keys(WEAPONS_ENUM);   // 18 melee/bow names; index 18 = Arrow
const ARMOR_PIECES = Object.values(ARMOR_ENUM);   // 11 pieces incl shields

/** ItemBuilder.CreateRandomWeapon: uniform over the 19 weapon slots;
 *  slot 18 is arrows - stack Range(1, 21), material 0. */
export function createRandomWeapon(playerLevel, rolls = Math.random) {
  const groupIndex = Math.floor(rolls() * 19);
  if (groupIndex === 18) {
    return { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 + Math.floor(rolls() * 20) };
  }
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
 *  so the dungeon item list (ui/inventory.js) labelled a looted
 *  Yellow Flowers "PlantIngredients1". */
const named = (item) => ({ ...item, name: item.name ?? ITEM_TEMPLATES[item.templateIndex]?.name });

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
    while (dice100(Math.trunc(c), rolls())) { items.push(named(make())); c *= 0.5; }
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
  // CreateRandomBook: CurrentVariant = Range(0, book.TotalVariants),
  // and TotalVariants is ItemTemplate.variants (2 for template 277).
  halving(matrix.BK, () => ({ group: 'Books', templateIndex: BOOK_TEMPLATE, variant: Math.floor(rolls() * (ITEM_TEMPLATES[BOOK_TEMPLATE]?.variants ?? 0)) }));
  halving(matrix.RL, () => ({ group: 'ReligiousItems', templateIndex: pick(ITEM_GROUPS.ReligiousItems, rolls) }));
  return items;
}

// ---- Magic items (S4c): ItemBuilder.CreateRegularMagicItem verbatim ----
// The MAGIC.DEF registry: set once per context after the file loads.
let _magicItemTemplates = null;
export function setMagicItemTemplates(templates) { _magicItemTemplates = templates; }

// "The possible groups are determined by the 33rd byte" - group 0
// picks from {Armor 2, Weapons 3, MensClothing 6, ReligiousItems 10,
// WomensClothing 12, Gems 14, Jewellery 25}; group 1 from
// {2, 3, 6, 12, 25}; group 2 is always Weapons. ItemGroups numerics
// per ItemEnums.cs.
const MAGIC_GROUPS_0 = Object.freeze([2, 3, 6, 10, 12, 14, 25]);
const MAGIC_GROUPS_1 = Object.freeze([2, 3, 6, 12, 25]);

export function createRegularMagicItem(templates, playerLevel, gender, rolls = Math.random) {
  const regular = templates.filter((t) => t.type === 0);   // RegularMagicItem
  const magicItem = regular[Math.floor(rolls() * regular.length)];
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
  // raw; condition = uses. Item VALUE from enchantment costs is
  // FLAGGED to the economy slice (shops).
  return {
    ...base,
    name: magicItem.name,
    magic: true,
    enchantments: magicItem.enchantments.filter((e) => e.type !== -1),
    maxCondition: magicItem.uses,
    currentCondition: magicItem.uses,
  };
}

/** DaggerfallLoot.GenerateItems: key -> matrix -> loot. Unknown keys
 *  fall to '-' (empty), matching GetMatrix's null-safe use. */
export function generateItems(lootTableKey, who, rolls = Math.random) {
  const matrix = LOOT_MATRICES[lootTableKey] ?? LOOT_MATRICES['-'];
  return generateRandomLoot(matrix, who, rolls);
}
