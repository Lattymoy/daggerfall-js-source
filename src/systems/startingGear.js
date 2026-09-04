// S3d: STARTING EQUIPMENT - ItemHelper.AssignStartingGear verbatim
// (ItemHelper.cs:1277-1364, MIT Daggerfall Workshop). This retires
// the iron-dagger stand-in seedStartingEquipment used to hand out
// (equip.js:288), which survives only as the PRE-CHARGEN fallback its
// two hosts gate it to - world.js:1255 and exterior.js:865 seed it
// solely for an entity that never ran chargen. A new character now
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
//   not equipped - and added FIRST, ahead of the clothes, so it heads
//   the bag exactly as classic shows it.
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

import { addItem, addGoldPieces } from './inventory.js';   // E4: gold is the counter, not a bag stack
import { equipItem } from './equip.js';
import { itemBaseValue, templateByIndex, mintCondition } from './itemTemplates.js';
import { CLOTHING_DYES } from '../characters/dyes.js';
import { createWeapon } from '../combat/enemyEquipment.js';   // ItemBuilder.CreateWeapon's one home (the arrow arm)
import { getBool } from './settings.js';   // SETT: PlayerTorchFromItems

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
 *  fix - a missing value made the shop price it at 1) and its
 *  TEMPLATE name (AUDIT 17f: the hand-written names here were
 *  lower-cased copies - DFU's ItemName is ItemTemplate.name, so the
 *  bag read "Short shirt" where classic reads "Short Shirt"). */
const mint = (item) => mintCondition({
  ...item,
  name: item.name ?? templateByIndex(item.templateIndex)?.name,
  value: item.value ?? itemBaseValue(item),
});   // AUDIT 23 (items-5): condition mints with the item

/** AssignStartingGear verbatim. `rolls` is the RNG seam;
 *  torchesFromItems ports DFU's setting (ships OFF - not classic);
 *  SETT made it LIVE, so the default is a point-of-use store read and
 *  an explicit argument still overrides it (the tests do).
 *  Returns the items added, newest last. */
export function assignStartingGear(entity, { classIndex = 0, isCustom = false, rolls = Math.random, torchesFromItems = getBool('Enhancements', 'PlayerTorchFromItems') } = {}) {
  entity.items = entity.items ?? [];
  const female = entity.gender === 'female';
  const added = [];
  const add = (item) => { const it = mint(item); addItem(entity.items, it); added.push(it); return it; };

  // AUDIT 17f: the SPELLBOOK is added FIRST (ItemHelper.cs:1300-1306).
  // AddItem's default is AddPosition.Back (ItemCollection.cs:217), so
  // the collection order IS the order the item list draws in
  // (ItemListScroller walks items[scrollIndex + i] forward) - the
  // port added the clothes first and put a new character's spellbook
  // third in their bag where classic puts it first.
  add({ group: 'MiscItems', templateIndex: SPELLBOOK });

  // gender-specific clothes, dyed + varied, then EQUIPPED
  const pantsTemplate = female ? CASUAL_PANTS_F : CASUAL_PANTS_M;
  const shirt = add({
    group: female ? 'WomensClothing' : 'MensClothing',
    templateIndex: female ? SHORT_SHIRT_CLOSED_F : SHORT_SHIRT_M,
    variant: 0,   // CreateMens/WomensClothing(..., 0) - the shirt is NOT randomized
    dye: CLOTHING_DYES[Math.floor(rolls() * CLOTHING_DYES.length)],
  });
  const pants = add({
    group: female ? 'WomensClothing' : 'MensClothing',
    templateIndex: pantsTemplate,
    // RandomizeClothingVariant: Random.Range(0, ItemTemplate.variants)
    // (ItemBuilder.cs:803-807). AUDIT 17f: this was hardcoded to 4,
    // which is the MEN'S count - women's Casual pants (template 190)
    // has FIVE variants, so a woman could never roll the last one.
    variant: Math.floor(rolls() * (templateByIndex(pantsTemplate)?.variants ?? 1)),
  });

  // clothes go ON before the weapon is minted (equipTable.EquipItem
  // twice at ItemHelper.cs:1305-1306, ahead of the isCustom branch)
  equipItem(entity, shirt);
  equipItem(entity, pants);

  // the class weapon (or an iron longsword for a custom class)
  if (isCustom) {
    add({ group: 'Weapons', templateIndex: LONGSWORD, material: 0 });
  } else {
    const i = Math.max(0, Math.min(STARTING_WEAPON_BY_CLASS.length - 1, classIndex | 0));
    add({ group: 'Weapons', templateIndex: STARTING_WEAPON_BY_CLASS[i], material: STARTING_MATERIAL_BY_CLASS[i] });
    if (i === ARCHER_CLASS_INDEX) {
      add({ group: 'Weapons', templateIndex: BATTLE_AXE, material: 1 });
      // AUDIT 58: the pile is minted through the ONE home of
      // CreateWeapon's arrow arm, not hand-built. DFU builds it as
      // `ItemBuilder.CreateWeapon(Weapons.Arrow, WeaponMaterialTypes.Iron)`
      // then writes the stack after (ItemHelper.cs:1342-1344), and that
      // arm sets `currentCondition = 0` - "not sure if this is
      // necessary, but classic does it" (ItemBuilder.cs:359-364).
      // Hand-minting it here ran mintCondition instead, which paid the
      // pile full condition; createWeapon's own Range(1, 21) stack draw
      // is spent as DFU spends it and then overwritten, same as
      // ItemHelper does.
      add({ ...createWeapon(ARROW, 0, rolls), stackCount: ARCHER_ARROWS });
    }
  }

  // DFU's PlayerTorchFromItems setting - an enhancement, not classic
  if (torchesFromItems) {
    for (let i = 0; i < 5; i++) add({ group: 'UselessItems2', templateIndex: TORCH });
    for (let i = 0; i < 2; i++) add({ group: 'UselessItems2', templateIndex: CANDLE });
  }

  addStartingGold(entity, STARTING_GOLD);
  return added;
}

/** `playerEntity.GoldPieces += 100` (ItemHelper.cs:1354), verbatim
 *  since E4: the counter, not a Currency stack in the bag. */
export function addStartingGold(entity, amount = STARTING_GOLD) {
  addGoldPieces(entity, amount);
  return entity;
}
