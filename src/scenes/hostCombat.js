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
import { ENEMY_GROUPS, dice100 } from '../combat/formulas.js';
import { combatVoicesEnabled, ATTACK_VOICE_CHANCE, PAIN_VOICE_CHANCE, combatVoice, rollVoiceRace, isHeavyDamage } from '../combat/combatVoices.js';   // C2-slice
import { RACES } from '../systems/races.js';   // C2-slice: the player grunt's race
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
// AUDIT 18: retired. calculateAttackDamage no longer takes a targetGroup -
// bonusOrPenaltyByEnemyType derives it from the TARGET ENTITY, and the
// player's isPlayer flag selects DFU's "player is assumed humanoid" arm
// (FormulaHelper.cs:1048). Passing a group in was an ignored key.

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

// ---- C2-slice (AUDIT 23 combat-9/17): the enemy melee frame's sound
// tail + the combat voices, shared so every host speaks the same. ----

/** EnemySounds.PlayMissSound: an attack that whiffed (out of reach)
 *  or lost the hit roll - armed foes ring their weapon's swing clip,
 *  barehanded the high pitch (swingSoundFor's null arm IS that). */
export const enemyMissSound = (weapon) => swingSoundFor(weapon);

/** MobileTypes.Knight_CityWatch - the one class id whose voice is
 *  FORCED male whatever the mobile rolled (EnemyAttack.cs:220/:357). */
export const KNIGHT_CITY_WATCH = 146;

/** The foe's voice gender per the source's pick: the mobile's
 *  gender, with the city-watch knight forced male. */
const foeVoiceGender = (f) =>
  (f.gender === 'female' && f.mobileType !== KNIGHT_CITY_WATCH ? 'female' : 'male');

/** The foe's spawn-rolled voice race (EnemySounds:72 rolls it once
 *  per foe); the port rolls lazily at first use and caches - one
 *  race per foe, same as the spawn roll. */
const foeVoiceRace = (f, rolls) => (f.voiceRace ??= rollVoiceRace(rolls));

/** The 20% enemy-class ATTACK voice at the melee damage frame
 *  (EnemyAttack.cs:217-226), behind the CombatVoices setting.
 *  Returns { clip, pitchLift } or null. */
export function enemyAttackVoice(f, rolls = Math.random) {
  if (!combatVoicesEnabled() || !f.entity?.isClass) return null;
  if (!dice100(ATTACK_VOICE_CHANCE, rolls())) return null;
  return combatVoice({ race: foeVoiceRace(f, rolls), gender: foeVoiceGender(f), isAttack: true, rolls });
}

/** The 40% enemy-class PAIN voice when the player's hit lands
 *  (WeaponManager.cs:597-607); heavyDamage = damage >= maxHealth/4.
 *  Returns { clip, pitchLift } or null. */
export function enemyPainVoice(f, damage, rolls = Math.random) {
  if (!combatVoicesEnabled() || !f.entity?.isClass || damage <= 0) return null;
  if (!dice100(PAIN_VOICE_CHANCE, rolls())) return null;
  return combatVoice({
    race: foeVoiceRace(f, rolls), gender: foeVoiceGender(f), isAttack: false,
    heavyDamage: isHeavyDamage(damage, f.entity.maxHealth ?? 0), rolls,
  });
}

/** The PLAYER's 20% attack grunt at the hit frame - never for a bow
 *  (WeaponManager.cs:385-389; the racial-override suppression rides
 *  the vampirism arc). Returns { clip, pitchLift } or null. */
export function playerAttackGrunt(playerEntity, isBow, rolls = Math.random) {
  if (!combatVoicesEnabled() || isBow) return null;
  if (!dice100(ATTACK_VOICE_CHANCE, rolls())) return null;
  return combatVoice({
    race: RACES[playerEntity.race] ?? 1, gender: playerEntity.gender ?? 'male', isAttack: true, rolls,
  });
}

// ---- PlayerActivate.cs:85 ----
/** CorpseActivationDistance = 150 * GlobalScale = 3.75. The hosts left
 *  corpses on activationTargets' 128-unit default (3.2), so a body was
 *  out of reach over half a metre before DFU says it is. */
export const CORPSE_ACTIVATION_DISTANCE = 150 * GLOBAL_SCALE;
