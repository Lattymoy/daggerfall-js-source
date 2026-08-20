// Enemy equipment (C8 E4b). Verbatim ports from DFU ItemHelper.cs
// (AssignEnemyStartingEquipment), ItemBuilder.cs (materialsByModifier),
// FormulaHelper.cs (RandomMaterial/RandomArmorMaterial),
// DaggerfallUnityItem.cs (material/shield armor values, slot -> body
// part), DaggerfallEntity.cs (UpdateEquippedArmorValues) and
// EnemyEntity.cs (SetEnemyEquipment clamps + the variant table) -
// MIT, Daggerfall Workshop.
//
// Body parts (ArmorValues indices, = the struck-body-part range):
//   0 Head, 1 RightArm, 2 LeftArm, 3 Chest, 4 Hands, 5 Legs, 6 Feet
// Weapon items here carry what the formulas consume:
//   { name, templateIndex, material (0..9), flags }. The damage span
//   is NOT stored - baseDamageMin/Max resolve the template on every
//   swing, exactly as GetBaseDamageMin/Max do.
// Unity Random slots stay uniform rolls, as in DFU itself.

import { mintCondition } from '../systems/itemTemplates.js';   // AUDIT 23 (items-5)
import { WEAPON_MIN_DAMAGE, WEAPON_MAX_DAMAGE, dice100 } from './formulas.js';

// ---- Weapons enum (template indices) - the roll ranges are numeric ----
export const WEAPONS_ENUM = Object.freeze({
  Dagger: 113, Tanto: 114, Staff: 115, Shortsword: 116, Wakazashi: 117,
  Broadsword: 118, Saber: 119, Longsword: 120, Katana: 121, Claymore: 122,
  'Dai-Katana': 123, Mace: 124, Flail: 125, Warhammer: 126,
  'Battle Axe': 127, 'War Axe': 128, 'Short Bow': 129, 'Long Bow': 130,
});
const WEAPON_BY_INDEX = Object.freeze(Object.fromEntries(Object.entries(WEAPONS_ENUM).map(([k, v]) => [v, k])));

export const ARMOR_ENUM = Object.freeze({
  Cuirass: 102, Gauntlets: 103, Greaves: 104, Left_Pauldron: 105,
  Right_Pauldron: 106, Helm: 107, Boots: 108, Buckler: 109,
  Round_Shield: 110, Kite_Shield: 111, Tower_Shield: 112,
});
export const BODY_PARTS = Object.freeze({ Head: 0, RightArm: 1, LeftArm: 2, Chest: 3, Hands: 4, Legs: 5, Feet: 6 });
// GetBodyPartForEquipSlot, expressed piece -> part (each piece owns one slot)
const PIECE_BODY_PART = Object.freeze({
  107: 0,   // Helm -> Head
  106: 1,   // Right pauldron -> RightArm
  105: 2,   // Left pauldron -> LeftArm
  102: 3,   // Cuirass -> Chest
  103: 4,   // Gauntlets -> Hands
  104: 5,   // Greaves -> Legs
  108: 6,   // Boots -> Feet
});
const SHIELD_VALUE = Object.freeze({ 109: 1, 110: 2, 111: 3, 112: 4 });
const SHIELD_PARTS = Object.freeze({
  109: [2, 4],          // Buckler: LeftArm, Hands
  110: [2, 4, 5],       // Round: + Legs
  111: [2, 4, 5],       // Kite: same
  112: [0, 2, 4, 5],    // Tower: + Head
});

/** DaggerfallUnityItem.GetShieldProtectedBodyParts (:1082-1095), verbatim:
 *  Buckler LeftArm+Hands, Round and Kite add Legs, Tower adds Head.
 *  Anything that is not a shield protects nothing. Exported so the table
 *  can be pinned against the C# - AUDIT 18's re-measurement found the
 *  only assertion in the suite that pinned it was vacuous. */
export const shieldProtectedBodyParts = (templateIndex) => SHIELD_PARTS[templateIndex] ?? [];

// ---- ItemBuilder.materialsByModifier + FormulaHelper.RandomMaterial ----
export const MATERIALS_BY_MODIFIER = Object.freeze([64, 128, 10, 21, 13, 8, 5, 3, 2, 5]);
export function randomMaterial(playerLevel, rolls = Math.random) {
  let levelModifier = playerLevel - 10;
  levelModifier *= levelModifier >= 0 ? 2 : 4;
  const randomModifier = Math.floor(rolls() * 256);          // Range(0, 256)
  let combined = Math.max(0, Math.min(256, levelModifier + randomModifier));
  let material = 0;                                          // iron
  while (MATERIALS_BY_MODIFIER[material] < combined) {
    combined -= MATERIALS_BY_MODIFIER[material++];
  }
  return material;
}

// ---- ArmorMaterialTypes + RandomArmorMaterial ----
export const ARMOR_MATERIAL = Object.freeze({ Leather: 0x0000, Chain: 0x0100, PLATE_BASE: 0x0200 });
export function randomArmorMaterial(playerLevel, rolls = Math.random) {
  const roll = 1 + Math.floor(rolls() * 100);                // Dice100.Roll
  if (roll >= 70) {
    if (roll >= 90) return ARMOR_MATERIAL.PLATE_BASE + randomMaterial(playerLevel, rolls);
    return ARMOR_MATERIAL.Chain;
  }
  return ARMOR_MATERIAL.Leather;
}

// ---- GetMaterialArmorValue (non-shield) ----
export function materialArmorValue(armorMaterial) {
  if (armorMaterial === ARMOR_MATERIAL.Leather) return 3;
  if (armorMaterial === ARMOR_MATERIAL.Chain || armorMaterial === 0x0103) return 6;
  const plate = armorMaterial - ARMOR_MATERIAL.PLATE_BASE;   // Iron..Daedric
  return [7, 9, 9, 11, 13, 15, 15, 17, 19, 21][plate] ?? 0;
}

/** ItemBuilder mints every weapon through DaggerfallUnityItem.SetItem,
 *  which sets `flags = 0` (DaggerfallUnityItem.cs:565); the only other
 *  writers are the artifact mask (:617, 0x820) and the classic-save
 *  importer (:1563), and neither touches bit 0x10. AUDIT 18: the port
 *  minted 0x10 on every EDGED weapon by intent, which inverted
 *  FormulaHelper.cs:742-744 - DFU halves EVERY weapon's damage against
 *  a Skeletal Warrior, and the port halved only blunt ones. Reproduced
 *  bug-for-bug: no port site mints the bit. */
export function createWeapon(templateIndex, material) {
  const name = WEAPON_BY_INDEX[templateIndex];
  return mintCondition({
    name, templateIndex, group: 'Weapons', material,
    flags: 0,
    minDamage: WEAPON_MIN_DAMAGE[name], maxDamage: WEAPON_MAX_DAMAGE[name],
  });   // AUDIT 23 (items-5): the condition mints with the item
}

/**
 * AssignEnemyStartingEquipment + SetEnemyEquipment, verbatim: rolls
 * the loadout, then the armor-value pass (init 100 = no armor; each
 * piece SUBTRACTS materialValue*5 on its body part; shields subtract
 * shieldValue*5 on their protected parts, material-blind; class
 * clamp >60 -> 60; monsters keep the BETTER of equipment vs their
 * definition's armorValue*5 - the DFU rule).
 * @returns { rightHand, leftHand, armorPieces, armorValues }
 */
export function assignEnemyEquipment(entity, variant, playerLevel, rolls = Math.random) {
  const range = (lo, hi) => lo + Math.floor(rolls() * (hi + 1 - lo));   // Range(lo, hi+1)
  let itemLevel = playerLevel;
  if (entity.isClass && entity.mobileType === 146) itemLevel = 1;       // city watch: iron/steel only
  let rightHand = null, leftHand = null;
  const armorPieces = [];
  let chance = 0;
  if (variant === 0) {
    rightHand = createWeapon(range(WEAPONS_ENUM.Broadsword, WEAPONS_ENUM.Longsword), randomMaterial(itemLevel, rolls));
    chance = 50;
    const shield = range(ARMOR_ENUM.Buckler, ARMOR_ENUM.Round_Shield);
    if (dice100(chance, rolls())) {
      leftHand = { templateIndex: shield, shield: true };
      armorPieces.push({ piece: shield, material: randomArmorMaterial(itemLevel, rolls), shield: true });
    } else if (dice100(chance, rolls())) {
      leftHand = createWeapon(range(WEAPONS_ENUM.Dagger, WEAPONS_ENUM.Shortsword), randomMaterial(itemLevel, rolls));
    }
  } else {
    rightHand = createWeapon(range(WEAPONS_ENUM.Claymore, WEAPONS_ENUM['Battle Axe']), randomMaterial(itemLevel, rolls));
    if (variant === 1) chance = 75;
    else if (variant === 2) chance = 90;
  }
  for (const piece of [ARMOR_ENUM.Helm, ARMOR_ENUM.Right_Pauldron, ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Cuirass, ARMOR_ENUM.Greaves, ARMOR_ENUM.Boots]) {
    if (dice100(chance, rolls())) armorPieces.push({ piece, material: randomArmorMaterial(itemLevel, rolls) });
  }
  // poisoned-weapon chance pends the poison system (Systems arc)

  // SetEnemyEquipment armor-value pass
  const armorValues = new Array(7).fill(100);
  for (const a of armorPieces) {
    if (a.shield) {
      const bonus = SHIELD_VALUE[a.piece] ?? 0;
      for (const part of SHIELD_PARTS[a.piece] ?? []) armorValues[part] -= bonus * 5;
    } else {
      // EnemyEntity.cs:414 `for (i = EquipSlots.Head (12); i <
      // EquipSlots.Feet (26); i++)` - Feet is the EXCLUSIVE bound, so
      // the boots AssignEnemyStartingEquipment just equipped never
      // reach UpdateEquippedArmorValues. AUDIT 18: the port ran them
      // through the same loop as every other piece, so a well-armoured
      // class enemy's Feet came out below the 60 clamp. They stay in
      // armorPieces - the corpse still drops them, as DFU's
      // Items.AddItem gives it.
      if (a.piece === ARMOR_ENUM.Boots) continue;
      const part = PIECE_BODY_PART[a.piece];
      if (part != null) armorValues[part] -= materialArmorValue(a.material) * 5;
    }
  }
  if (entity.isClass) {
    for (let i = 0; i < 7; i++) if (armorValues[i] > 60) armorValues[i] = 60;
  } else {
    const def = (entity.armor ?? 0);                          // already armorValue*5
    for (let i = 0; i < 7; i++) if (armorValues[i] > def) armorValues[i] = def;
  }
  return { rightHand, leftHand, armorPieces, armorValues };
}

/** G3: DFU adds EVERY equipped piece to enemyEntity.Items
 *  (AssignEnemyStartingEquipment's Items.AddItem after each
 *  EquipItem) - that inventory is the corpse's droppable loot. The
 *  shield rides armorPieces (its armor item), so a shield leftHand
 *  marker is skipped; a leftHand WEAPON is its own item. */
export function equipmentItems(eq) {
  const items = [];
  if (eq.rightHand) items.push({ group: 'Weapons', ...eq.rightHand });
  if (eq.leftHand && !eq.leftHand.shield) items.push({ group: 'Weapons', ...eq.leftHand });
  for (const a of eq.armorPieces) items.push({ group: 'Armor', templateIndex: a.piece, material: a.material });
  return items;
}

/** SetEnemyCareer's equipment-variant table, verbatim. */
export function equipmentVariantFor(careerIndex, isClass, rolls = Math.random) {
  if (careerIndex === 7 || careerIndex === 21) return 0;      // Orc = 7, OrcShaman = 21 (EntityEnums.cs, verified)
  if (careerIndex === 8 || careerIndex === 12) return 1;      // Centaur, OrcSergeant
  if (careerIndex === 24) return 2;                            // OrcWarlord
  if (isClass) return Math.floor(rolls() * 2);                 // Range(0, 2)
  return null;                                                 // no equipment
}
