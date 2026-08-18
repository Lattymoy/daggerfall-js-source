// S3d: STARTING EQUIPMENT - ItemHelper.AssignStartingGear verbatim
// (ItemHelper.cs:1277-1364, MIT Daggerfall Workshop). This retires
// seedStartingEquipment's INTERIM iron dagger: a new character now
// begins dressed, with a spellbook, their CLASS's weapon, and 100
// gold, exactly as classic does.
//
// Verbatim laws:
// - clothing is GENDER-specific: men get Short_shirt (165) +
//   Casual_pants (151), women Short_shirt_closed (206) +
//   Casual_pants (190). The shirt takes a RANDOM clothing dye
//   (RandomClothingDye over the 10-entry table) and the pants a
//   RANDOM variant (RandomizeClothingVariant). Both are EQUIPPED.
// - every player starts with a Spellbook (MiscItems 132), carried
//   not equipped.
// - the class weapon comes from StartingWeaponTypesByClass, with
//   StartingWeaponMaterialsByClass choosing iron (0) or steel (1);
//   a CUSTOM class gets an iron Longsword instead.
// - the ARCHER (class index 13) alone also gets a steel Battle Axe
//   and a stack of 24 iron Arrows.
// - +100 gold.
// - torches/candles ride DFU's PlayerTorchFromItems SETTING, which
//   is a DFU enhancement rather than classic behaviour - ported but
//   defaulted OFF, the same stance the 17e audit took on the
//   enhanced 16-slot item list.

import { addItem } from './inventory.js';
import { equipItem } from './equip.js';
import { itemBaseValue, templateByIndex } from './itemTemplates.js';
import { CLOTHING_DYES } from '../characters/dyes.js';

// ItemEnums template indices
const SHORT_SHIRT_M = 165, CASUAL_PANTS_M = 151;
const SHORT_SHIRT_CLOSED_F = 206, CASUAL_PANTS_F = 190;
const SPELLBOOK = 132;
const TORCH = 247, CANDLE = 253;
const ARROW = 131;
const LONGSWORD = 120, BATTLE_AXE = 127;

/** StartingWeaponTypesByClass (ItemHelper.cs:1311-1329) in career
 *  order: Mage, Spellsword, Battlemage, Sorcerer, Healer, Nightblade,
 *  Bard, Burglar, Rogue, Acrobat, Thief, Assassin, Monk, Archer,
 *  Ranger, Barbarian, Warrior, Knight. */
export const STARTING_WEAPON_BY_CLASS = Object.freeze([
  116, 119, 119, 116, 124, 116, 116, 114, 119, 116, 116, 120, 115, 130, 127, 126, 118, 120,
]);
/** StartingWeaponMaterialsByClass: 0 = iron, 1 = steel. */
export const STARTING_MATERIAL_BY_CLASS = Object.freeze([
  1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,
]);
export const ARCHER_CLASS_INDEX = 13;
export const ARCHER_ARROWS = 24;
export const STARTING_GOLD = 100;

/** Every item the port mints carries its own value (the 17e F2 root
 *  fix - a missing value made the shop price it at 1). */
const mint = (item) => ({
  ...item,
  name: item.name ?? templateByIndex(item.templateIndex)?.name,
  value: item.value ?? itemBaseValue(item),
});

/** AssignStartingGear verbatim. `rolls` is the RNG seam;
 *  torchesFromItems ports DFU's setting (default OFF - not classic).
 *  Returns the items added, newest last. */
export function assignStartingGear(entity, { classIndex = 0, isCustom = false, rolls = Math.random, torchesFromItems = false } = {}) {
  entity.items = entity.items ?? [];
  const female = entity.gender === 'female';
  const added = [];
  const add = (item) => { const it = mint(item); addItem(entity.items, it); added.push(it); return it; };

  // gender-specific clothes, dyed + varied, then EQUIPPED
  const shirt = add({
    group: female ? 'WomensClothing' : 'MensClothing',
    templateIndex: female ? SHORT_SHIRT_CLOSED_F : SHORT_SHIRT_M,
    name: female ? 'Short shirt' : 'Short shirt',
    variant: 0,
    dye: CLOTHING_DYES[Math.floor(rolls() * CLOTHING_DYES.length)],
  });
  const pants = add({
    group: female ? 'WomensClothing' : 'MensClothing',
    templateIndex: female ? CASUAL_PANTS_F : CASUAL_PANTS_M,
    name: 'Casual pants',
    variant: Math.floor(rolls() * 4),   // RandomizeClothingVariant over the template's variants
  });

  // every player starts with a spellbook (carried, not equipped)
  add({ group: 'MiscItems', templateIndex: SPELLBOOK, name: 'Spellbook' });

  // the class weapon (or an iron longsword for a custom class)
  if (isCustom) {
    add({ group: 'Weapons', templateIndex: LONGSWORD, material: 0, name: 'Longsword' });
  } else {
    const i = Math.max(0, Math.min(STARTING_WEAPON_BY_CLASS.length - 1, classIndex | 0));
    add({ group: 'Weapons', templateIndex: STARTING_WEAPON_BY_CLASS[i], material: STARTING_MATERIAL_BY_CLASS[i] });
    if (i === ARCHER_CLASS_INDEX) {
      add({ group: 'Weapons', templateIndex: BATTLE_AXE, material: 1, name: 'Battle Axe' });
      add({ group: 'Weapons', templateIndex: ARROW, material: 0, name: 'Arrow', stackCount: ARCHER_ARROWS });
    }
  }

  // DFU's PlayerTorchFromItems setting - an enhancement, not classic
  if (torchesFromItems) {
    for (let i = 0; i < 5; i++) add({ group: 'UselessItems2', templateIndex: TORCH, name: 'Torch' });
    for (let i = 0; i < 2; i++) add({ group: 'UselessItems2', templateIndex: CANDLE, name: 'Candle' });
  }

  // clothes go ON (equipTable.EquipItem for both, after the adds)
  equipItem(entity, shirt);
  equipItem(entity, pants);

  addStartingGold(entity, STARTING_GOLD);
  return added;
}

/** playerEntity.GoldPieces += 100. Gold rides as a Currency stack in
 *  the bag (the port's S2 shape). */
export function addStartingGold(entity, amount = STARTING_GOLD) {
  entity.items = entity.items ?? [];
  addItem(entity.items, { group: 'Currency', name: 'Gold Pieces', stackCount: amount });
  return entity;
}
