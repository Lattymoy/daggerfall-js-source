// RRI2 - REALISTIC ENEMY EQUIPMENT. RoleplayRealismItemsMod.cs
// :411-757 (Hazelnut & Ralzar, MIT): the mod's
// `AssignEnemyStartingEquipment`, installed over
// `EnemyEntity.AssignEnemyEquipment` while realisticEnemyEquipment is
// on. A class enemy is kitted by its class - bows and a blade for the
// archers, the big weapon or a sidearm-and-shield for the fighters, a
// staff and robes for the mages, two axes-or-blades for the assassin -
// then armored piece by piece on a falling chance, in chain or leather
// where the class prefers it (the custom sets, under newArmor). Every
// worn thing lands at 30-75% condition. A monster keeps ItemHelper's
// own arm and then ConvertOrcish: an Orc's ebony-and-up (a Warlord's
// mithril-and-up) is Orcish four times in five.
//
// Answers the shape hostCombat.equipEnemy reads off assignEnemyEquipment
// - { rightHand, leftHand, armorPieces, armorValues } - plus `items` (the
// records as minted, worn and carried alike, the corpse's loot) and
// `worn` (the subset the equip table holds once every EquipItem has run -
// AUDIT DEX E2, below). Rolls are Unity's uniform slots on the caller's
// stream.
//
// DEX6: Daggerfall Enemy Expansion ships a copy of this arm
// (DEX_RRICompat.cs, run in its place while realisticEnemyEquipment is
// on) that reads a class otherwise - the mod's equipment table, the
// career's forbidden armor, an arm for a class it does not know. The arm
// is this one; a copy's reads are its `read` (RRI_READ, RRI's own).
import {
  createWeapon, randomMaterial, randomArmorMaterial, rollEnemyEquipment, enemyArmorValues,
  WEAPONS_ENUM, ARMOR_ENUM, ARROW_TEMPLATE,
} from './enemyEquipment.js';
import { dice100 } from './formulas.js';
import { mintCondition, setItemFields, templateByIndex, itemBaseValue } from '../systems/item/itemTemplates.js';
import { markFound } from '../systems/item/foundMark.js';   // AUDIT MEND-THIRD L3-2: a worn kit's piece handed over marked
import { rriModule, customItemClass } from '../systems/roleplayRealismItems/rriItems.js';
import { MOBILE_TYPES } from '../characters/mobile/mobileTypes.js';
import { DYE_COLORS } from '../characters/dyes.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { ARMOR_MATERIAL as ARMOR_MATERIALS } from '../systems/armorMaterials.js';
import { equipTableOf, getEquipSlot, wearLeavers, EQUIP_SLOTS } from '../systems/equip.js';   // AUDIT DEX E2: EquipItem's slot and what it takes off, one home
import { rollEnemyWeaponPoison } from '../systems/poisons.js';   // AUDIT DEX E3: ItemHelper's poison, rolled inside its arm
import { MENS_PLAIN_ROBES, WOMENS_PLAIN_ROBES } from '../systems/createItem.js';   // MensClothing / WomensClothing.Plain_robes, one home

const M = MOBILE_TYPES;
const W = WEAPONS_ENUM;
const A = ARMOR_ENUM;

/** The mod's custom template indices (ItemXxx.cs `templateIndex`). */
export const RRI_ITEM = Object.freeze({
  ArchersAxe: 513, LightFlail: 514,
  Hauberk: 515, Chausses: 516, LeftSpaulder: 517, RightSpaulder: 518, Sollerets: 519,
  Jerkin: 520, Cuisse: 521, Helmet: 522, Boots: 523, Gloves: 524, LeftVambrace: 525, RightVambrace: 526,
});

// ---- the roll helpers (:411-499), verbatim ------------------------------
const blunt = [W.Mace, W.Flail, W.Warhammer];
const bluntWnew = [W.Mace, W.Flail, W.Warhammer, RRI_ITEM.LightFlail];
const axe = [W['Battle Axe'], W['War Axe']];
const axeWnew = [W['Battle Axe'], W['War Axe'], RRI_ITEM.ArchersAxe];
const newWeapons = () => rriModule('newWeapons');
const newArmor = () => rriModule('newArmor');

const range = (rolls, lo, hi) => lo + Math.floor(rolls() * (hi - lo));   // UnityEngine.Random.Range(lo, hi) - hi exclusive
const coinFlip = (rolls) => range(rolls, 0, 2) === 0;
const oneOf = (rolls, array) => array[range(rolls, 0, array.length)];
const randomShield = (rolls) => range(rolls, A.Buckler, A.Round_Shield + 1);
const randomLongblade = (rolls) => range(rolls, W.Broadsword, W.Longsword + 1);
const randomBlunt = (rolls) => oneOf(rolls, newWeapons() ? bluntWnew : blunt);
const randomAxe = (rolls) => oneOf(rolls, newWeapons() ? axeWnew : axe);
const randomAxeOrBlade = (rolls) => (coinFlip(rolls) ? randomAxe(rolls) : randomLongblade(rolls));
const randomBluntOrBlade = (rolls) => (coinFlip(rolls) ? randomBlunt(rolls) : randomLongblade(rolls));
function randomBigWeapon(rolls) {
  let weapon = range(rolls, W.Claymore, W['War Axe'] + 1);
  if (weapon === W['Dai-Katana'] && dice100(90, rolls())) weapon = W.Claymore;   // "Dai-katana's are very rare."
  return weapon;
}
const randomBow = (rolls) => range(rolls, W['Short Bow'], W['Long Bow'] + 1);
const randomShortblade = (rolls) => (dice100(40, rolls()) ? W.Shortsword : range(rolls, W.Dagger, W.Wakazashi + 1));
function secondaryWeapon(rolls) {
  switch (range(rolls, 0, 4)) {
    case 0: return W.Dagger;
    case 1: return W.Shortsword;
    case 2: return newWeapons() ? RRI_ITEM.ArchersAxe : W['Short Bow'];
    default: return W['Short Bow'];
  }
}
function getCombatClassWeapon(enemyType, rolls) {
  switch (enemyType) {
    case M.Barbarian: return randomBigWeapon(rolls);
    case M.Knight: return coinFlip(rolls) ? randomBlunt(rolls) : randomLongblade(rolls);
    case M.Knight_CityWatch: return randomAxeOrBlade(rolls);
    case M.Monk: return randomBlunt(rolls);
    default: return randomLongblade(rolls);
  }
}
const isFighter = (mob) => mob === M.Knight || mob === M.Warrior;

/** GetArmorTemplateIndex (:735-757): the classic piece, or - under
 *  newArmor and a class preference - a coin flip between it and the
 *  chain or leather piece for the slot. */
export function getArmorTemplateIndex(slot, prefChain = false, prefLeather = false, rolls = Math.random) {
  const rand = (prefChain || prefLeather) && newArmor();
  switch (slot) {
    case 'ChestArmor': return rand ? (coinFlip(rolls) ? A.Cuirass : (prefChain ? RRI_ITEM.Hauberk : RRI_ITEM.Jerkin)) : A.Cuirass;
    case 'LegsArmor': return rand ? (coinFlip(rolls) ? A.Greaves : (prefChain ? RRI_ITEM.Chausses : RRI_ITEM.Cuisse)) : A.Greaves;
    case 'LeftArm': return rand ? (coinFlip(rolls) ? A.Left_Pauldron : (prefChain ? RRI_ITEM.LeftSpaulder : RRI_ITEM.LeftVambrace)) : A.Left_Pauldron;
    case 'RightArm': return rand ? (coinFlip(rolls) ? A.Right_Pauldron : (prefChain ? RRI_ITEM.RightSpaulder : RRI_ITEM.RightVambrace)) : A.Right_Pauldron;
    case 'Feet': return rand ? (coinFlip(rolls) ? A.Boots : (prefChain ? RRI_ITEM.Sollerets : RRI_ITEM.Boots)) : A.Boots;
    case 'Gloves': return rand ? (coinFlip(rolls) ? A.Gauntlets : RRI_ITEM.Gloves) : A.Gauntlets;
    case 'Head': return rand ? (coinFlip(rolls) ? A.Helm : RRI_ITEM.Helmet) : A.Helm;
    default: return -1;
  }
}

// ---- the mints --------------------------------------------------------
/** CreateWeapon (:721-726): ItemBuilder.CreateItem then
 *  ApplyWeaponMaterial - a custom weapon (the Archer's Axe) mints
 *  through the same SetItem writes as a classic one. */
const mintWeapon = (templateIndex, material, rolls) => {
  if (customItemClass(templateIndex)) {
    return mintCondition(setItemFields({ group: 'Weapons', templateIndex, material, flags: 0, value: itemBaseValue({ group: 'Weapons', templateIndex, material }) }));
  }
  return createWeapon(templateIndex, material, rolls);
};
/** CreateArmor (:728-733): CreateItem then ApplyArmorSettings - which
 *  is the class's CurrentVariant setter for a custom piece (RRI1's
 *  rriVariantFields, run by setItemFields). */
const mintArmor = (templateIndex, material) =>
  mintCondition(setItemFields({ group: 'Armor', templateIndex, material }));
/** ItemBuilder.CreateMensClothing / CreateWomensClothing (:135-186)
 *  with the defaults the mod passes: variant -1 (Range(0, variants)),
 *  dye Blue. */
const mintClothing = (female, templateIndex, rolls) => {
  const variants = templateByIndex(templateIndex)?.variants ?? 0;
  return mintCondition(setItemFields({
    group: female ? 'WomensClothing' : 'MensClothing', templateIndex,
    variant: variants > 0 ? range(rolls, 0, variants) : 0, dye: DYE_COLORS.Blue,
  }));
};
/** AddOrEquipWornItem (:501-511): every armor, weapon and garment
 *  lands at `Range(0.3f, 0.75f)` of its max; `equip` puts it on (the
 *  arm's `add`). */
function wornCondition(item, rolls) {
  if (item.group === 'Armor' || item.group === 'Weapons' || item.group === 'MensClothing' || item.group === 'WomensClothing') {
    item.currentCondition = Math.trunc((0.3 + rolls() * (0.75 - 0.3)) * (item.maxCondition ?? 0));
    // AUDIT MEND-THIRD L3-2 (A DEPARTURE, the mod's dice unmoved): SELL-AS-FOUND's mark (systems/item/foundMark.js). The body's
    // own roll re-wears and marks what stays on the corpse; a piece PLAIN-LOOT's keep let go never meets it, and PARTY-LOOT's
    // personal bonus handed the clone over worn and unmarked - mended at a smith, sold whole online
    markFound(item);
  }
  return item;
}

// ---- AssignEnemyStartingEquipment (:523-681) ----------------------------
/** How the arm reads a class. RRI's own: the class IS the enemy's id
 *  (`switch ((MobileTypes)enemyEntity.MobileEnemy.ID)`), its armor the
 *  class's preference (GetArmorTemplateIndex), and a class the switch
 *  does not name holds nothing. A copy's: `classOf(entity)` the class
 *  its tests ask (null for none), `armorTemplate(slot, { prefChain,
 *  prefLeather, career }, rolls)` the piece (-1 for none - CreateArmor
 *  mints nothing), `unknownArmed` its arm for a class it does not know,
 *  `equipsSecondary` whether the second weapon - a combat class's left-hand
 *  weapon, a sneaky class's second blade - is put on (AUDIT DEX E1:
 *  DEX_RRICompat.cs:333/:385 AddAndEquipWornItem) or carried (RRI's
 *  AddOrEquipWornItem with no `equip`, :573/:626). */
export const RRI_READ = Object.freeze({
  classOf: (entity) => entity.mobileType,
  armorTemplate: (slot, { prefChain, prefLeather }, rolls) => getArmorTemplateIndex(slot, prefChain, prefLeather, rolls),
  unknownArmed: false,
  equipsSecondary: false,
});

/** The class arm. `entity` is the spawn's (mobileType, level, isClass);
 *  `player` the player entity (gender, race - the doll the armor is
 *  minted for). A non-class enemy runs ItemHelper's own arm, its poison
 *  and then ConvertOrcish (below); null while the module is off, so the
 *  caller runs ItemHelper's. `read` is RRI_READ, or a copy's (DEX6). */
export function assignRriEnemyEquipment(entity, variant, playerLevel, { player = null, rolls = Math.random, read = RRI_READ } = {}) {
  if (!rriModule('realisticEnemyEquipment')) return null;
  const mob = entity.mobileType;
  if (!entity.isClass) {
    const eq = rollEnemyEquipment(entity, variant, playerLevel, rolls);
    // AUDIT DEX E3: ItemHelper's arm rolls its poison inside itself (ItemHelper.cs:1460-1474) and the mod's ConvertOrcish
    // runs after it returns (:528-529; DEX_RRICompat.cs:291-292) - the poison's draws first. `poisonRolled` tells
    // hostCombat.equipEnemy, which rolls it for ItemHelper's own arm, that this one has.
    const poison = eq.rightHand ? rollEnemyWeaponPoison(entity.mobileType, playerLevel, rolls) : null;
    if (poison != null) eq.rightHand.poisonType = poison;
    convertOrcish(entity, eq, rolls);
    return { ...eq, armorValues: enemyArmorValues(entity, eq.armorPieces), poisonRolled: true };
  }
  const items = [];   // enemyEntity.Items, in AddItem order
  const table = {};   // enemyEntity.ItemEquipTable, on a stand-in - equipEnemy fills the spawn's own from `worn`
  const slots = equipTableOf(table);
  const add = (item, equip = false) => {
    wornCondition(item, rolls);
    items.push(item);
    // AUDIT DEX E2: EquipItem(item, true, false) (ItemEquipTable.cs:94-154) - the slot GetEquipSlot answers over the table
    // as it stands, then what that wear takes off (wearLeavers: a two-hander both hands, a LeftOnly piece a two-hander
    // held right, the slot's occupant). A shield after a big weapon leaves the hand empty; what comes off stays in Items.
    const slot = equip ? getEquipSlot(table, item) : EQUIP_SLOTS.None;
    if (slot !== EQUIP_SLOTS.None) {
      for (const s of wearLeavers(table, item, slot)) slots[s] = null;
      slots[slot] = item;
    }
    return item;
  };
  const female = player?.gender === 'female';
  // "Set item level, city watch never have items above iron or steel"
  const itemLevel = mob === M.Knight_CityWatch ? 1 : (entity.level ?? playerLevel);
  const chance = 50;
  let armored = 100;
  let prefChain = false;
  let prefLeather = false;
  const cls = read.classOf(entity);   // what the class tests ask - the id itself in RRI's switch; the id tests below stay the id's in both

  switch (cls) {
    // Ranged specialists:
    case M.Archer:
    case M.Ranger: {
      add(createWeapon(randomBow(rolls), randomMaterial(itemLevel, rolls), rolls), true);
      add(mintWeapon(mob === M.Ranger ? randomLongblade(rolls) : randomShortblade(rolls), randomMaterial(itemLevel, rolls), rolls));
      const arrowPile = createWeapon(ARROW_TEMPLATE, WEAPON_MATERIALS.Iron, rolls);
      arrowPile.stackCount = range(rolls, 4, 17);
      items.push(arrowPile);
      armored = 60;
      prefChain = true;
      break;
    }
    // Combat classes:
    case M.Barbarian:
    case M.Knight:
    case M.Knight_CityWatch:
    case M.Monk:
    case M.Spellsword:
    case M.Warrior:
    case M.Rogue:
      if (variant === 0) {
        add(mintWeapon(getCombatClassWeapon(cls, rolls), randomMaterial(itemLevel, rolls), rolls), true);
        // Left hand shield?
        if (dice100(chance, rolls())) add(mintArmor(randomShield(rolls), randomArmorMaterial(itemLevel, rolls)), true);
        // left-hand weapon?
        else if (dice100(chance, rolls())) add(mintWeapon(secondaryWeapon(rolls), randomMaterial(itemLevel, rolls), rolls), read.equipsSecondary);
        if (!isFighter(cls)) armored = 80;
      } else {
        add(mintWeapon(randomBigWeapon(rolls), randomMaterial(itemLevel, rolls), rolls), true);
        if (!isFighter(cls)) { prefChain = true; armored = 90; }
      }
      if (cls === M.Barbarian) { armored = 30; prefLeather = true; }   // "Barbies tend to forgo armor or use leather"
      break;
    // Mage classes:
    case M.Mage:
    case M.Sorcerer:
    case M.Healer:
      add(createWeapon(W.Staff, randomMaterial(itemLevel, rolls), rolls), true);
      if (dice100(chance, rolls())) add(mintWeapon(randomShortblade(rolls), randomMaterial(itemLevel, rolls), rolls));
      add(mintClothing(female, female ? WOMENS_PLAIN_ROBES : MENS_PLAIN_ROBES, rolls), true);
      armored = 35;
      prefLeather = true;
      break;
    // Stealthy stabby classes:
    case M.Assassin:
      add(mintWeapon(randomAxeOrBlade(rolls), randomMaterial(itemLevel, rolls), rolls), true);
      add(mintWeapon(randomAxeOrBlade(rolls), randomMaterial(itemLevel, rolls), rolls));
      armored = 65;
      prefChain = true;
      break;
    case M.Battlemage:
      add(mintWeapon(randomBluntOrBlade(rolls), randomMaterial(itemLevel, rolls), rolls), true);
      add(mintWeapon(randomBluntOrBlade(rolls), randomMaterial(itemLevel, rolls), rolls));
      armored = 75;
      prefChain = true;
      break;
    // Sneaky classes:
    case M.Acrobat:
    case M.Bard:
    case M.Burglar:
    case M.Nightblade:
    case M.Thief:
      add(mintWeapon(randomShortblade(rolls), randomMaterial(itemLevel, rolls), rolls), true);
      if (dice100(chance, rolls())) add(mintWeapon(secondaryWeapon(rolls), randomMaterial(Math.trunc(itemLevel / 2), rolls), rolls), read.equipsSecondary);
      armored = 50;
      prefLeather = true;
      if (mob === M.Nightblade) prefChain = true;
      break;
    // Unknown (DEX_RRICompat's last else - RRI's switch has no default)
    default:
      if (read.unknownArmed) {
        add(mintWeapon(randomLongblade(rolls), randomMaterial(itemLevel, rolls), rolls), true);
        armored = 50;
      }
      break;
  }

  const armor = (slot) => {
    const templateIndex = read.armorTemplate(slot, { prefChain, prefLeather, career: entity.career ?? null }, rolls);
    const material = randomArmorMaterial(itemLevel, rolls);   // an argument of CreateArmor - rolled whether or not a piece is minted
    if (templateIndex !== -1) add(mintArmor(templateIndex, material), true);
  };
  // Torso
  if (dice100(armored, rolls())) armor('ChestArmor');
  armored -= 10;
  // Legs (Barbarians have a raised chance)
  if (dice100(armored, rolls()) || (mob === M.Barbarian && dice100(armored + 50, rolls()))) armor('LegsArmor');
  armored -= 10;
  // Feet
  if (dice100(armored, rolls())) armor('Feet');
  armored -= 10;
  // Head (Barbarians have a raised chance)
  if (dice100(armored, rolls()) || (mob === M.Barbarian && dice100(armored + 50, rolls()))) armor('Head');
  armored -= 20;
  if (armored > 0) {
    if (dice100(armored, rolls())) armor('RightArm');
    if (dice100(armored, rolls())) armor('LeftArm');
    if (dice100(armored, rolls())) armor('Gloves');
  }
  // The table as the last EquipItem left it: the worn set in AddItem order, the two hands, the armor pieces (a shield
  // among them) - the armor-value pass walks the table, as SetEnemyEquipment does.
  const worn = items.filter((it) => slots.includes(it));
  const armorPieces = worn.filter((it) => it.group === 'Armor')
    .map((item) => ({ piece: item.templateIndex, material: item.material, shield: item.templateIndex >= A.Buckler && item.templateIndex <= A.Tower_Shield, item }));
  // The poisoned-weapon chance (:664-680) is the same roll as ItemHelper's
  // (5%, the Assassin's 60%, past player level 1) and rides the port's
  // one home for it - poisons.rollEnemyWeaponPoison, at the spawn seam,
  // over `poisonClass`: the class its Assassin test asks (a copy's read).
  // Read off the right hand the table holds: a foe left bare-handed rolls none.
  return { rightHand: slots[EQUIP_SLOTS.RightHand], leftHand: slots[EQUIP_SLOTS.LeftHand], armorPieces, armorValues: enemyArmorValues(entity, armorPieces), items, worn, poisonClass: cls };
}

// ---- ConvertOrcish (:683-719) -----------------------------------------
/** "Orcs have any higher materials converted to Orcish 80% of the
 *  time." The Orcs team, Ebony and up (a Warlord's Mithril and up):
 *  the template's weight, value, condition and enchantment points are
 *  restored and the Orcish material applied over them - which is what
 *  the port's mint does from the material alone. Works over the DFU
 *  arm's roll before the armor-value pass reads it, as DFU's order is. */
export function convertOrcish(entity, eq, rolls = Math.random) {
  if (entity.basics?.team !== 'Orcs' || !dice100(80, rolls())) return eq;
  const convertFrom = entity.mobileType === M.OrcWarlord ? WEAPON_MATERIALS.Mithril : WEAPON_MATERIALS.Ebony;
  const orcish = (material) => (material & 0xFF) >= convertFrom;
  for (const weapon of [eq.rightHand, eq.leftHand]) {
    if (!weapon || weapon.group !== 'Weapons' || !orcish(weapon.material ?? 0)) continue;
    weapon.material = WEAPON_MATERIALS.Orcish;
    delete weapon.maxCondition; mintCondition(weapon);
    weapon.value = itemBaseValue(weapon);
  }
  for (const a of eq.armorPieces) {
    if (!orcish(a.material ?? 0)) continue;   // leather 0x0000 and chain 0x0100 read 0 under the mask - only plate converts
    a.material = ARMOR_MATERIALS.Orcish;
    if (a.item) { a.item.material = ARMOR_MATERIALS.Orcish; delete a.item.maxCondition; mintCondition(a.item); a.item.value = itemBaseValue(a.item); }
  }
  // AUDIT-RR F10: `Items.SearchItems(Weapons)` + `(Armor)` (:691-692) - the loot table's rolls are in Items already
  // (GenerateItems runs before SetEnemyEquipment, EnemyEntity.cs:330-347), so they convert too
  for (const it of entity.items ?? []) {
    if (it.group !== 'Weapons' && it.group !== 'Armor') continue;
    if (!orcish(it.material ?? 0)) continue;
    it.material = it.group === 'Weapons' ? WEAPON_MATERIALS.Orcish : ARMOR_MATERIALS.Orcish;
    delete it.maxCondition; mintCondition(it); it.value = itemBaseValue(it);
  }
  return eq;
}
