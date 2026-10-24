// DEX6 (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 12; Mac, 2026-10-19: "I want to implement this as our
// next mod 1:1") - THE EQUIPMENT. BestiaryMod.Start takes EnemyEntity.AssignEnemyEquipment over (BestiaryMod.cs:194,
// :2121-2131): while Roleplay & Realism: Items' realisticEnemyEquipment is on (read at the mod's start,
// DEX_RRICompat.OnStart) the mod's own copy of RRI's class arm kits a foe (DEX_RRICompat.cs), and otherwise ItemHelper's
// arm does. Start runs after every mod's Init - RRI writes the delegate in its Awake - so the mod's is the one that
// stands whichever loads first. The copy is RRI's arm (combat/rriEnemyEquipment.js) with four reads of its own:
//   - THE CLASS BY ITS TABLE (HasClassTable, :77-93): a row's EquipmentTable names the class whose kit it takes
//     ("Guard" the City Watch's, any other a class's own name, OrdinalIgnoreCase), and a row with none is its own id -
//     so a Knight Rider fights as a Knight, and a table that names no class is a class the arm does not know.
//   - THE ARMOR BY THE CAREER (GetArmorTemplateIndex, :120-163): the classic piece, unless newArmor is on, the career
//     forbids plate and a coin says otherwise - then the chain set where chain is allowed, else the leather set, else
//     nothing (CreateArmor mints none for -1). RRI's reads the class's preference instead.
//   - AN ARM FOR THE UNKNOWN (:388-393): a longblade, armored 50 - RRI's switch has no default, and a class it does not
//     name holds nothing.
//   - THE SECOND WEAPON PUT ON (AUDIT DEX E1, :333/:385): a combat class's left-hand weapon (variant 0, no shield) and a
//     sneaky class's second go through AddAndEquipWornItem - RRI's arm carries both (RoleplayRealismItemsMod.cs:573,
//     :626). EquipItem's hand rules then keep what they keep (the arm's `add`): beside a one-hander it is held left, after
//     a two-hander it takes the right hand, and a Short Bow takes both (under BowLeftHandWithSwitching the left, taking
//     a two-hander off the right).
// The id tests stay the id's (the City Watch's item level, the Ranger's longblade, the Barbarian's raised legs and
// head); the poison's Assassin is the table's (:432-433 - the arm's answer carries it, hostCombat.equipEnemy reads it).
// RRI's newWeapons and newArmor are read as its arm reads them (rriModule) - DEX_RRICompat reads the same two settings.

import { assignRriEnemyEquipment, RRI_ITEM } from '../../combat/rriEnemyEquipment.js';
import { ARMOR_ENUM as A } from '../../combat/enemyEquipment.js';
import { rriModule } from '../roleplayRealismItems/rriItems.js';
import { MOBILE_TYPES as M } from '../../characters/mobile/mobileTypes.js';

/** The classes HasClassTable is asked of by name - MobileTypes' class members, the City Watch aside (asked by "Guard"
 *  alone: `if (classType == MobileTypes.Knight_CityWatch) return equipmentTable.Equals("Guard", ...)`). */
const CLASS_BY_NAME = new Map(Object.entries(M)
  .filter(([name, id]) => id >= M.Mage && id <= M.Knight && name !== 'Knight_CityWatch')
  .map(([name, id]) => [name.toLowerCase(), id]));

/** The class a row's kit is drawn by (HasClassTable's answer for every class at once): `propsOf(id)` the mod's
 *  properties (dexInstall.js dexProperties). Null where the table names no class - the arm's unknown. */
export function dexClassTable(mobileId, propsOf) {
  const table = propsOf(mobileId)?.equipmentTable;
  if (!table) return mobileId;   // `return mobileId == (int)classType`
  const name = String(table).toLowerCase();
  if (name === 'guard') return M.Knight_CityWatch;
  return CLASS_BY_NAME.get(name) ?? null;
}

/** DFCareer.ArmorFlags (DFCareer.cs:302-307) over ForbiddenArmors, `(WeaponArmorShieldsBitfield >> 6) & 0x07` (:605). */
const ARMOR_FLAG = Object.freeze({ Leather: 1, Chain: 2, Plate: 4 });
const forbiddenArmors = (career) => ((career?.weaponArmorShieldsBitfield ?? 0) >>> 6) & 0x07;
/** DEX_RRICompat.CoinFlip (:47-50), the copy's own: `Random.Range(0, 2) == 0` on the caller's stream. */
const coinFlip = (rolls) => Math.floor(rolls() * 2) === 0;

const CLASSIC_PIECE = Object.freeze({ ChestArmor: A.Cuirass, LegsArmor: A.Greaves, LeftArm: A.Left_Pauldron, RightArm: A.Right_Pauldron, Feet: A.Boots, Gloves: A.Gauntlets, Head: A.Helm });
const CHAIN_PIECE = Object.freeze({ ChestArmor: RRI_ITEM.Hauberk, LegsArmor: RRI_ITEM.Chausses, LeftArm: RRI_ITEM.LeftSpaulder, RightArm: RRI_ITEM.RightSpaulder, Feet: RRI_ITEM.Sollerets, Gloves: RRI_ITEM.Gloves, Head: RRI_ITEM.Helmet });
const LEATHER_PIECE = Object.freeze({ ChestArmor: RRI_ITEM.Jerkin, LegsArmor: RRI_ITEM.Cuisse, LeftArm: RRI_ITEM.LeftVambrace, RightArm: RRI_ITEM.RightVambrace, Feet: RRI_ITEM.Boots, Gloves: RRI_ITEM.Gloves, Head: RRI_ITEM.Helmet });

/** DEX_RRICompat.GetArmorTemplateIndex: the slot's piece for `career`, or -1. The coin is thrown only past the first
 *  two tests (C#'s ||). */
export function dexArmorTemplateIndex(slot, career, rolls = Math.random) {
  const forbidden = forbiddenArmors(career);
  if (!rriModule('newArmor') || (forbidden & ARMOR_FLAG.Plate) === 0 || coinFlip(rolls)) return CLASSIC_PIECE[slot] ?? -1;
  if ((forbidden & ARMOR_FLAG.Chain) === 0) return CHAIN_PIECE[slot] ?? -1;
  if ((forbidden & ARMOR_FLAG.Leather) === 0) return LEATHER_PIECE[slot] ?? -1;
  return -1;
}

/** The arm's reads for the mod's copy (rriEnemyEquipment.js RRI_READ's shape). */
export const dexKitRead = (propsOf) => Object.freeze({
  classOf: (entity) => dexClassTable(entity.mobileType, propsOf),
  armorTemplate: (slot, { career }, rolls) => dexArmorTemplateIndex(slot, career, rolls),
  unknownArmed: true,
  equipsSecondary: true,
});

/** BestiaryMod.AssignEnemyStartingEquipment, the delegate the mod installs: the copy while realisticEnemyEquipment is
 *  on, and null - ItemHelper's arm - while it is off (assignRriEnemyEquipment's own gate, the setting
 *  DEX_RRICompat.hasRRIRealisticEnemyEquipment reads). */
export function createDexEquipmentAssigner(propsOf) {
  const read = dexKitRead(propsOf);
  return (entity, variant, playerLevel, opts = {}) => assignRriEnemyEquipment(entity, variant, playerLevel, { ...opts, read });
}
