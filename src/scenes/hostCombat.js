// AUDIT 18 (hosts): the combat/spawn laws that the four scene hosts
// each carried a private copy of - or, more often, that ONE host
// carried and the others silently dropped. Everything here is a
// verbatim DFU translation with no scene state of its own, so a host
// cannot half-apply it any more.
//
// DFU sources: WeaponManager.cs, EnemyMotor.cs, EnemyEntity.cs,
// FormulaHelper.cs, DaggerfallUnityItem.cs, PlayerActivate.cs
// (MIT, Daggerfall Workshop).

import { SKILLS, tallySkill, skillValue } from '../systems/skills.js';
import { ENEMY_GROUPS } from '../combat/formulas.js';
import { assignEnemyEquipment, equipmentVariantFor, equipmentItems } from '../combat/enemyEquipment.js';
import { rollEnemyWeaponPoison } from '../systems/poisons.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { swingSoundFor } from '../systems/soundClips.js';

// ---- DaggerfallUnityItem.GetWeaponSkillUsed / GetWeaponSkillIDAsShort ----
/** The attack skill is a property of the weapon TEMPLATE, never of its
 *  display name. Reading the skill out of a display-name table
 *  (what every host
 *  did) misses every renamed item: createRegularMagicItem overwrites
 *  `name` with the enchantment's magic-item name, so an enchanted
 *  Longsword trained - and rolled to hit with - Hand-to-Hand for the
 *  rest of the game. DaggerfallUnityItem.cs:910-941 + :943-962,
 *  keyed on Weapons (ItemEnums.cs:113..130). */
export const WEAPON_SKILL_BY_TEMPLATE = Object.freeze({
  113: SKILLS.ShortBlade,   // Dagger
  114: SKILLS.ShortBlade,   // Tanto
  115: SKILLS.BluntWeapon,  // Staff
  116: SKILLS.ShortBlade,   // Shortsword
  117: SKILLS.ShortBlade,   // Wakazashi
  118: SKILLS.LongBlade,    // Broadsword
  119: SKILLS.LongBlade,    // Saber
  120: SKILLS.LongBlade,    // Longsword
  121: SKILLS.LongBlade,    // Katana
  122: SKILLS.LongBlade,    // Claymore
  123: SKILLS.LongBlade,    // Dai-Katana
  124: SKILLS.BluntWeapon,  // Mace
  125: SKILLS.BluntWeapon,  // Flail
  126: SKILLS.BluntWeapon,  // Warhammer
  127: SKILLS.Axe,          // Battle Axe
  128: SKILLS.Axe,          // War Axe
  129: SKILLS.Archery,      // Short Bow
  130: SKILLS.Archery,      // Long Bow
});

/** GetWeaponSkillIDAsShort: null (Skills.None) for anything that is
 *  not one of the 18 weapon templates. */
export function weaponSkillUsed(templateIndex) {
  return WEAPON_SKILL_BY_TEMPLATE[templateIndex] ?? null;
}

/** CalculateAttackDamage's skillID pick (FormulaHelper.cs:573-590):
 *  the weapon's skill, or HandToHand with no weapon. */
export function attackSkillOf(weapon) {
  return weaponSkillUsed(weapon?.templateIndex) ?? SKILLS.HandToHand;
}

/** WeaponManager's `ScreenWeapon.WeaponType == WeaponTypes.Bow` test,
 *  read off the item rather than the viewmodel. */
export const isBowWeapon = (weapon) => attackSkillOf(weapon) === SKILLS.Archery;

// ---- EnemyMotor.cs:131-137 ----
/** A mobile has a bow attack if it has RangedAttack1 and does not cast
 *  magic, or has BOTH ranged flags. NOTHING about the enemy's
 *  inventory enters this: AssignEnemyStartingEquipment never rolls a
 *  bow, so minting `rangedAttack` from an equipped bow (what every
 *  host did) meant no enemy in the game could ever fire one. */
export const hasBowAttack = (basics) =>
  !!basics?.hasRangedAttack1 && (!basics?.castsMagic || !!basics?.hasRangedAttack2);

// ---- EnemyEntity.SetEnemyCareer, the equipment chain (EnemyEntity.cs:330-347) ----
/** DFU runs the equipment chain by careerIndex BEFORE the class arm:
 *  Orc(7)/OrcShaman(21) -> SetEnemyEquipment(0), Centaur(8)/
 *  OrcSergeant(12) -> (1), OrcWarlord(24) -> (2), and only then
 *  EnemyClass -> Random.Range(0,2). equipmentVariantFor already
 *  carries that whole table; the monster spawn path just never called
 *  it, so five equipment-using monsters walked in naked.
 *
 *  Order note: GenerateItems(LootTableKey) runs FIRST (EnemyEntity.cs:
 *  328) and the equipment items are appended after - callers must have
 *  filled `entity.items` before calling this. */
export function equipEnemy(entity, mobileType, playerLevel) {
  const variant = equipmentVariantFor(entity.careerIndex, entity.isClass);
  if (variant === null) return null;
  const eq = assignEnemyEquipment(entity, variant, playerLevel);
  entity.armorValues = eq.armorValues;
  entity.weapon = eq.rightHand;
  // S19b: ItemHelper's poisoned-weapon roll rides the spawn -
  // class enemies + Orc/Centaur/OrcSergeant, 5% (Assassin 60%)
  if (entity.weapon) {
    const pt = rollEnemyWeaponPoison(mobileType, playerLevel);
    if (pt != null) entity.weapon.poisonType = pt;
  }
  // AssignEnemyStartingEquipment adds every equipped piece to the
  // entity's items - the corpse's droppable loot.
  entity.items = entity.items ?? [];
  entity.items.push(...equipmentItems(eq));
  return eq;
}

// ---- WeaponManager.cs:72 / :419-436 ----
/** "According to DF Chronicles and verified in classic." Spent on
 *  EVERY swing that reaches the hit frame, hit or miss. */
export const SWING_WEAPON_FATIGUE_LOSS = 11;

/** The tally half of the same block: the weapon's own skill (or
 *  HandToHand for a bare-handed/werecreature swing) AND CriticalStrike,
 *  once per connecting swing. CriticalStrike was tallied nowhere in the
 *  port, so a skill that feeds every to-hit roll could never advance. */
export function tallySwingSkills(player, weapon) {
  tallySkill(player, attackSkillOf(weapon), 1);
  tallySkill(player, SKILLS.CriticalStrike, 1);
}

// ---- FormulaHelper.CalculateBackstabChance (FormulaHelper.cs:975-990) ----
/** The tally is INSIDE the chance calculation in DFU, so every
 *  back-facing swing counts a Backstabbing use whether or not the x3
 *  roll lands. No host tallied it, so Backstabbing could never rise. */
export function backstabChanceOf(player, isEnemyFacingAwayFromPlayer) {
  if (!isEnemyFacingAwayFromPlayer) return 0;
  tallySkill(player, SKILLS.Backstabbing, 1);
  return skillValue(player, SKILLS.Backstabbing);
}

// ---- GetBonusOrPenaltyByEnemyType, the PlayerEntity arm (FormulaHelper.cs:1037-1053) ----
/** DFU: `else if (target is PlayerEntity)` -> Undead when the player
 *  has vampirism, otherwise "Player is assumed humanoid". The port has
 *  no vampirism (diseases.js routes stage-one infection away), so the
 *  Undead arm is unreachable and the player is always Humanoid.
 *  Passing `targetGroup: null` - what all three enemy-vs-player call
 *  sites did - made the whole modifier dead against the player. */
export const PLAYER_TARGET_GROUP = ENEMY_GROUPS.Humanoid;

// ---- WeaponManager.cs:609-615, the ZERO-damage connected swing ----
export const PARRY_1 = 428;          // SoundClips.Parry1
export const PARRY_SOUND_COUNT = 9;  // Random.Range(0, 9)

/**
 * A swing that CONNECTED but dealt no damage. DFU:
 *   if ((!arrowHit && !enemy.ParrySounds) || strikingWeapon == null)
 *       ScreenWeapon.PlaySwingSound();
 *   else if (enemy.ParrySounds)
 *       enemySounds.PlayParrySound();     // Parry1 + Range(0,9), at the ENEMY
 * The hosts instead played WeaponManager.cs:483's WALL-hit pair
 * (Hit2 / Parry6) - a branch DFU's own comment marks "not in classic".
 * @returns {{sound:number, at:'player'|'enemy'}|null}
 */
export function zeroDamageHitSound({ weapon = null, arrowHit = false, parrySounds = false, roll = 0 } = {}) {
  if ((!arrowHit && !parrySounds) || !weapon) return { sound: swingSoundFor(weapon), at: 'player' };
  if (parrySounds) return { sound: PARRY_1 + Math.floor(roll * PARRY_SOUND_COUNT), at: 'enemy' };
  return null;
}

// ---- PlayerActivate.cs:85 ----
/** CorpseActivationDistance = 150 * GlobalScale = 3.75. The hosts left
 *  corpses on activationTargets' 128-unit default (3.2), so a body was
 *  out of reach over half a metre before DFU says it is. */
export const CORPSE_ACTIVATION_DISTANCE = 150 * GLOBAL_SCALE;
