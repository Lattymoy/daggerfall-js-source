// Combat formulas (C8 E3b). Verbatim ports from DFU FormulaHelper.cs
// / Dice100.cs / DaggerfallUnityItem.cs / DFCareer.cs (MIT,
// Daggerfall Workshop). Every function cites its source; classic's
// bugs are PRESERVED where DFU preserves them (dodging uses /4 and
// is applied as a flat penalty; the enemy-type bonus that classic
// gated behind max-enchantment weapons follows DFU's always-on port).
// Entity shape (ours): { level, health, maxHealth, armor, skills
// (flat, per SetEnemyCareer), stats: {strength, agility, luck},
// attackModifierFlags (career CFG byte), isPlayer }.
// FLAGGED interims (all documented at their site): adrenaline rush
// (career ability bitfield decode - Systems), biography adjustments
// (chargen), per-part armor (equipment E4) - target.armor is the
// scalar SetEnemyCareer fills every slot with, so [part] == armor.

import { MELEE_DISTANCE } from '../characters/enemyMotor.js';   // single source (EnemyAttack.cs:30)
import { skillValue, SKILLS, WEAPON_SKILL } from '../systems/chargen.js';   // S3: real skills (enemies stay flat, verbatim)

// ---- Dice100.cs verbatim ----
export const dice100 = (chance, roll01 = Math.random()) => Math.floor(roll01 * 100) < chance;   // Random.Range(0,100) < chance

// ---- FormulaHelper.DamageModifier ----
export const damageModifier = (strength) => Math.floor((strength - 50) / 5);

// ---- CalculateHandToHandMin/MaxDamage (int division) ----
export const handToHandMinDamage = (skill) => Math.floor(skill / 10) + 1;
export const handToHandMaxDamage = (skill) => Math.floor(skill / 5) + 1;   // the character-sheet rule, not the Chronicles table

// ---- CalculateWeaponMin/MaxDamage switch tables ----
export const WEAPON_MIN_DAMAGE = Object.freeze({
  Dagger: 1, Tanto: 1, Wakazashi: 1, Shortsword: 1, Broadsword: 1, Staff: 1, Mace: 1,
  Longsword: 2, Claymore: 2, 'Battle Axe': 2, 'War Axe': 2, Flail: 2,
  Saber: 3, Katana: 3, 'Dai-Katana': 3, Warhammer: 3,
  'Short Bow': 4, 'Long Bow': 4,
});
export const WEAPON_MAX_DAMAGE = Object.freeze({
  Dagger: 6, Tanto: 8, Shortsword: 8, Staff: 8, Wakazashi: 10,
  Broadsword: 12, Saber: 12, 'Battle Axe': 12, Mace: 12, Flail: 14,
  Longsword: 16, Katana: 16, 'War Axe': 16, 'Short Bow': 16,
  Claymore: 18, Warhammer: 18, 'Long Bow': 18, 'Dai-Katana': 21,
});

// ---- DaggerfallUnityItem.GetWeaponMaterialModifier (index = material 0..9) ----
export const WEAPON_MATERIAL_MODIFIER = Object.freeze([-1, 0, 0, 1, 2, 3, 3, 4, 5, 6]);

// ---- CalculateStruckBodyPart ----
const BODY_PARTS = Object.freeze([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6]);
export const calculateStruckBodyPart = (roll01 = Math.random()) => BODY_PARTS[Math.floor(roll01 * BODY_PARTS.length)];

// ---- DFCareer.StructureData attack-modifier bit table ----
export const ENEMY_GROUPS = Object.freeze({ Undead: 0, Daedra: 1, Humanoid: 2, Animals: 3 });
const GROUP_BITS = Object.freeze([[0x01, 0x10], [0x02, 0x20], [0x04, 0x40], [0x08, 0x80]]);   // [bonus, phobia] per group
export function careerAttackModifier(attackModifierFlags, group) {
  const [bonus, phobia] = GROUP_BITS[group];
  if ((attackModifierFlags & bonus) === bonus) return 1;
  if ((attackModifierFlags & phobia) === phobia) return -1;
  return 0;
}

/** Affinity string -> enemy group (class enemies are Humanoid). DFU's
 *  GetEnemyGroup uses a per-careerIndex table; affinity carries the
 *  same partition for every entry we spawn. */
export function enemyGroupOf(affinity) {
  return { Human: ENEMY_GROUPS.Humanoid, Undead: ENEMY_GROUPS.Undead, Daedra: ENEMY_GROUPS.Daedra, Animal: ENEMY_GROUPS.Animals }[affinity] ?? null;
}

// ---- GetBonusOrPenaltyByEnemyType (the DFU always-on port) ----
export function bonusOrPenaltyByEnemyType(attacker, targetGroup) {
  if (attacker.attackModifierFlags == null || targetGroup == null) return 0;
  return careerAttackModifier(attacker.attackModifierFlags, targetGroup) * attacker.level;
}

// ---- CalculateStatsToHit ----
export const statsToHit = (a, t) =>
  Math.trunc((a.stats.luck - t.stats.luck) / 10) + Math.trunc((a.stats.agility - t.stats.agility) / 10);

// ---- CalculateSkillsToHit (classic's /4 dodging; crit roll adds crit/10) ----
export function skillsToHit(a, t, roll01 = Math.random()) {
  let mod = -Math.floor(skillValue(t, SKILLS.Dodging) / 4);            // classic's /4 bug preserved
  const crit = skillValue(a, SKILLS.CriticalStrike);
  if (dice100(crit, roll01)) mod += Math.floor(crit / 10);
  return mod;
}

// ---- CalculateSuccessfulHit (clamp 3..97) ----
export function calculateSuccessfulHit(attacker, target, chanceToHitMod, struckBodyPart, rolls = Math.random) {
  let chance = chanceToHitMod;
  chance += target.armorValues ? target.armorValues[struckBodyPart] ?? 0 : (target.armor ?? 0);   // CalculateArmorToHit: per-part when equipped (E4b), the SetEnemyCareer scalar otherwise
  // adrenaline rush: career ability bitfield decode pending (Systems) - 0
  chance += statsToHit(attacker, target);
  chance += skillsToHit(attacker, target, rolls());
  // biography adjustments: chargen pending - 0
  chance = Math.max(3, Math.min(97, chance));
  return dice100(chance, rolls());
}

// ---- CalculateHandToHandAttackDamage ----
export function handToHandAttackDamage(attacker, targetGroup, damageMod, isPlayer, rolls = Math.random) {
  const h2h = skillValue(attacker, SKILLS.HandToHand);
  const min = handToHandMinDamage(h2h);
  const max = handToHandMaxDamage(h2h);
  let damage = min + Math.floor(rolls() * (max + 1 - min));  // Range(min, max+1)
  damage += damageMod;
  if (isPlayer) damage += damageModifier(attacker.stats.strength);   // "not applied in classic" for AI - DFU preserves that
  damage += bonusOrPenaltyByEnemyType(attacker, targetGroup);
  return damage;
}

export const SKELETAL_WARRIOR_INDEX = 15;   // MonsterCareers.SkeletalWarrior

// ---- CalculateWeaponAttackDamage ----
export function weaponAttackDamage(attacker, target, damageMod, weapon, rolls = Math.random) {
  let damage = weapon.minDamage + Math.floor(rolls() * (weapon.maxDamage + 1 - weapon.minDamage)) + damageMod;
  if (!target.isPlayer && target.careerIndex === SKELETAL_WARRIOR_INDEX) {
    if ((weapon.flags & 0x10) === 0) damage = Math.trunc(damage / 2);   // edged-weapon rule
    if (weapon.material === 2) damage *= 2;                             // Silver
  }
  damage += damageModifier(attacker.stats.strength);
  damage += WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0;   // half of the in-game display, per the source comment
  if (damage < 1) damage = 0;
  damage += bonusOrPenaltyByEnemyType(attacker, target.group ?? null);
  return damage;
}

// ---- CalculateBackstabDamage ----
export function backstabDamage(damage, backstabbingLevel, roll01 = Math.random()) {
  if (backstabbingLevel > 1 && dice100(backstabbingLevel, roll01)) return damage * 3;
  return damage;
}

/**
 * The CalculateAttackDamage orchestration for our reachable branches:
 * class-enemy hand-to-hand vs the player (equipment E4), player
 * weapon/hand-to-hand vs foes (input wiring E3c), monster multi-attack
 * (rigs E4). chanceToHitMod = the attacker's live weapon skill
 * (flat skills here). Swing/proficiency/racial player mods: E3c with
 * the in-world weapon.
 */
/** CalculateAttackDamage's enemy weapon-vs-weaponless choice: classic
 *  weapon-wielders use weapon damage, but DFU lets them keep the
 *  weaponless attack when its AVERAGE is higher (source comment: some
 *  enemies' weapons undershoot similar-tier monsters). */
export function chooseEnemyWeapon(weapon, basics) {
  if (!weapon) return null;
  const weaponAvg = Math.trunc((weapon.minDamage + weapon.maxDamage) / 2);
  const noWeaponAvg = Math.trunc(((basics?.minDamage ?? 0) + (basics?.maxDamage ?? 0)) / 2);
  return noWeaponAvg > weaponAvg ? null : weapon;
}

export function calculateAttackDamage(attacker, target, { weapon = null, targetGroup = null, damageMod = 0, toHitMod = 0, backstabChance = 0, rolls = Math.random } = {}) {
  if (!attacker || !target) return 0;
  if (weapon && (target.minMetalToHit ?? -1) > weapon.material) return 0;   // material too low
  // source: chanceToHitMod = skill, then player swing/proficiency/
  // racial toHit mods add on; damageModifiers ride INTO the damage
  // calls (before the skeletal rules and the <1 floor)
  // chanceToHitMod = the LIVE skill for the attack in hand (weapon's
  // skill or HandToHand), + player mods. Enemies read the same value
  // for every skill (flat, SetEnemyCareer verbatim).
  const attackSkill = weapon ? (WEAPON_SKILL[weapon.name] ?? SKILLS.HandToHand) : SKILLS.HandToHand;
  const chanceToHitMod = skillValue(attacker, attackSkill) + toHitMod + backstabChance;
  const struck = calculateStruckBodyPart(rolls());
  let damage = 0;
  if (!weapon) {
    if (calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
      damage = handToHandAttackDamage(attacker, targetGroup, damageMod, !!attacker.isPlayer, rolls);
    }
  } else {
    if (calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
      damage = weaponAttackDamage(attacker, target, damageMod, weapon, rolls);
    }
  }
  damage = backstabDamage(damage, backstabChance, rolls());   // applied AFTER the damage calc, verbatim (lines 627/688)
  return Math.max(0, damage);
}

// ---- EnemyAttack.MeleeDamage hit gate, "matched to classic" ----
export const MELEE_HIT_YAW_DEG = 35.156;
export function meleeHitConnects(dist, inSight, withinHitYaw) {
  return inSight && (dist <= 0.25 || (dist <= MELEE_DISTANCE && withinHitYaw));
}
