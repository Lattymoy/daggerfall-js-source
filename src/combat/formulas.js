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
import { CLASSIC_TO_UNITY_RATIO } from '../player/motor.js';   // C15 knockback units
import { rand } from '../formats/dfRandom.js';   // the monster multi-attack reflex gate (F2)
import { liveStat } from '../systems/statMods.js';   // S14: fortify-aware stat reads
import { skillValue, SKILLS, WEAPON_SKILL } from '../systems/skills.js';   // S3: real skills (enemies stay flat, verbatim)

// ---- Dice100.cs verbatim ----
export const dice100 = (chance, roll01 = Math.random()) => Math.floor(roll01 * 100) < chance;   // Random.Range(0,100) < chance

// ---- FormulaHelper.DamageModifier ----
export const damageModifier = (strength) => Math.floor((strength - 50) / 5);

// ---- U10 / ONE DFU MEMBER, ONE EXPORT: the rest of FormulaHelper's
// DERIVED STATS (FormulaHelper.cs:66-125). The chargen bonus-stats
// screen shows all seven in one block, and the port had them
// scattered - MaxEncumbrance inline in charsheet.js, MagicResist
// inline in spellcast.js, HealingRateModifier in rest.js, SpellPoints
// in chargen.js - with ToHitModifier and HitPointsModifier missing
// entirely. They live here, beside DamageModifier, and the old sites
// import them.
export const maxEncumbrance = (strength) => Math.floor(strength * 1.5);
export const spellPointsFor = (intelligence, multiplier) => Math.floor(intelligence * multiplier);
export const magicResist = (willpower) => Math.floor(willpower / 10);
export const toHitModifier = (agility) => Math.floor(agility / 10) - 5;
export const hitPointsModifier = (endurance) => Math.floor(endurance / 10) - 5;
/** DFU deliberately skips classic's negative-modifier-plus-one bug;
 *  so do we (the note rest.js carried since S20). */
export const healingRateModifier = (endurance) => Math.floor(endurance / 10) - 5;

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
  // DFU applies BOTH bits additively (+level for bonus, -level for
  // phobia; a career carrying both nets 0) - audit F16.
  return ((attackModifierFlags & bonus) === bonus ? 1 : 0) - ((attackModifierFlags & phobia) === phobia ? 1 : 0);
}

/** Affinity string -> enemy group (class enemies are Humanoid). DFU's
 *  GetEnemyGroup uses a per-careerIndex table; affinity carries the
 *  same partition for every entry we spawn. */
export function enemyGroupOf(affinity) {
  return { Human: ENEMY_GROUPS.Humanoid, Undead: ENEMY_GROUPS.Undead, Daedra: ENEMY_GROUPS.Daedra, Animal: ENEMY_GROUPS.Animals }[affinity] ?? null;
}

// ---- GetBonusOrPenaltyByEnemyType (the DFU always-on port) ----
export function bonusOrPenaltyByEnemyType(attacker, targetGroup) {
  // AUDIT 17n: DFU reads attacker.Career.<group>AttackModifier for
  // EVERY attacker (FormulaHelper.cs:993-1030). The port flattened the
  // byte onto the entity, and only the foe builder ever set it
  // (enemyEntity.js:105) - the player carries `career` and no flat
  // field, so this guard returned 0 on every player swing. The target
  // half was wired correctly all along (playerWeapon.js passes
  // enemyGroupOf(affinity)), which is why nothing looked broken.
  //
  // Not just a U20b concern: the classic ASSASSIN ships
  // attackModifierFlags 0x04 - a Humanoid bonus - and has never
  // received it. U20b only made the same modifier purchasable, at 3-6
  // difficulty points for a bonus and -4 for a phobia.
  const flags = attacker.attackModifierFlags ?? attacker.career?.attackModifierFlags ?? null;
  if (flags == null || targetGroup == null) return 0;
  return careerAttackModifier(flags, targetGroup) * attacker.level;
}

// ---- CalculateStatsToHit ----
export const statsToHit = (a, t) =>
  Math.trunc((liveStat(a, 'luck') - liveStat(t, 'luck')) / 10) + Math.trunc((liveStat(a, 'agility') - liveStat(t, 'agility')) / 10);

// ---- CalculateSkillsToHit (classic's /4 dodging; crit roll adds crit/10) ----
export function skillsToHit(a, t, roll01 = Math.random()) {
  let mod = -Math.floor(skillValue(t, SKILLS.Dodging) / 4);            // classic's /4 bug preserved
  const crit = skillValue(a, SKILLS.CriticalStrike);
  if (dice100(crit, roll01)) mod += Math.floor(crit / 10);
  return mod;
}

// ---- CalculateAdjustmentsToHit (2026-08-13 parity audit F1) ----
// Verbatim: biography avoid-hit (pending chargen biography - 0),
// +40 when the TARGET is an enemy MONSTER, then a flat -50 always
// ("DF Chronicles says -60 ... it actually seems to be -50").
export function adjustmentsToHit(target) {
  let mod = 0;
  // biography adjustments: chargen biography pending - 0
  if (!target.isPlayer && target.isClass === false) mod += 40;   // EntityTypes.EnemyMonster
  mod -= 50;
  return mod;
}

// ---- CalculateSuccessfulHit (clamp 3..97) ----
export function calculateSuccessfulHit(attacker, target, chanceToHitMod, struckBodyPart, rolls = Math.random) {
  let chance = chanceToHitMod;
  // CalculateArmorToHit: per-part when equipped (E4b), the
  // SetEnemyCareer scalar otherwise. Increased/DecreasedArmorValueModifier
  // channels pend their effects (none exist yet) - 0 (audit F5).
  chance += target.armorValues ? target.armorValues[struckBodyPart] ?? 0 : (target.armor ?? 0);
  // adrenaline rush: the career ability bitfield DECODES now (U20b
  // put SPECIAL_ABILITY_BITS on specialAdvantages.js and rest.js
  // already exports hasSpecialAbility) - what pends is the EFFECT,
  // not the read. AUDIT 17n re-pointed this note; still 0.
  // attacker.ChanceToHitModifier (enchantments): pends the enchantment
  // system - 0 (audit F4).
  chance += statsToHit(attacker, target);
  chance += skillsToHit(attacker, target, rolls());
  chance += adjustmentsToHit(target);   // the +40 monster mod and flat -50 (F1)
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
/** AUDIT 17n: `targetGroup` is threaded in because the port split
 *  DFU's one call apart. CalculateWeaponAttackDamage passes the TARGET
 *  ENTITY to GetBonusOrPenaltyByEnemyType (FormulaHelper.cs:788) and
 *  derives the group inside it; the port lifted the group into a
 *  parameter for the monster and hand-to-hand branches but left this
 *  one reading `target.group` - a field NOTHING in the codebase mints.
 *  So the enemy-type modifier was dead on the weapon path for every
 *  attacker, independently of whether the attacker carried the byte at
 *  all. The `target.group` read stays as the fallback it was. */
export function weaponAttackDamage(attacker, target, damageMod, weapon, rolls = Math.random, targetGroup = null) {
  let damage = weapon.minDamage + Math.floor(rolls() * (weapon.maxDamage + 1 - weapon.minDamage)) + damageMod;
  if (!target.isPlayer && target.careerIndex === SKELETAL_WARRIOR_INDEX) {
    if ((weapon.flags & 0x10) === 0) damage = Math.trunc(damage / 2);   // edged-weapon rule
    if (weapon.material === 2) damage *= 2;                             // Silver
  }
  damage += damageModifier(liveStat(attacker, 'strength'));
  damage += WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0;   // half of the in-game display, per the source comment
  if (damage < 1) damage = 0;
  damage += bonusOrPenaltyByEnemyType(attacker, targetGroup ?? target.group ?? null);
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

export function calculateAttackDamage(attacker, target, { weapon = null, targetGroup = null, damageMod = 0, toHitMod = 0, backstabChance = 0, rolls = Math.random, dfRand = rand, onMonsterHit = null, onInflictPoison = null } = {}) {
  if (!attacker || !target) return 0;
  if (weapon && (target.minMetalToHit ?? -1) > weapon.material) return 0;   // material too low
  // source: chanceToHitMod = skill, then player swing/proficiency/
  // racial toHit mods add on; damageModifiers ride INTO the damage
  // calls (before the skeletal rules and the <1 floor)
  // chanceToHitMod = the LIVE skill for the attack in hand (weapon's
  // skill or HandToHand), + player mods. Enemies read the same value
  // for every skill (flat, SetEnemyCareer verbatim).
  const attackSkill = weapon ? (WEAPON_SKILL[weapon.name] ?? SKILLS.HandToHand) : SKILLS.HandToHand;
  let chanceToHitMod = skillValue(attacker, attackSkill) + toHitMod + backstabChance;
  // CalculateWeaponToHit: material modifier x 10 rides the WEAPON
  // branch only, verbatim (audit F3).
  if (weapon) chanceToHitMod += (WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0) * 10;
  const struck = calculateStruckBodyPart(rolls());
  let damage = 0;
  if (!weapon) {
    // Monster weaponless attacks (audit F2): DFU's multi-attack loop
    // over MobileEnemy.MinDamage/2/3 - NOT the H2H skill formula
    // (that branch is player + class enemies only). Per attack: the
    // reflex gate DFRandom.rand() % 100 < 50 - 10*(reflexes-2), then
    // the shared hit roll; damage Range(min, max+1); the enemy-type
    // bonus lands PER HIT. onMonsterHit = the special-attack rider
    // seam (S18 diseases.js) - fired per hit BEFORE the damage sums,
    // exactly at FormulaHelper.cs:662.
    if (!attacker.isPlayer && attacker.isClass === false && attacker.basics) {
      const b = attacker.basics;
      const spans = [
        [b.minDamage ?? 0, b.maxDamage ?? 0],
        [b.minDamage2 ?? 0, b.maxDamage2 ?? 0],
        [b.minDamage3 ?? 0, b.maxDamage3 ?? 0],
      ];
      const reflexesChance = 50 - 10 * ((target.reflexes ?? 2) - 2);
      for (const [min, max] of spans) {
        let hitDamage = 0;
        if (dfRand() % 100 < reflexesChance && min > 0 &&
            calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
          hitDamage = min + Math.floor(rolls() * (max + 1 - min));   // Range(min, max+1)
          if (hitDamage > 0 && onMonsterHit) onMonsterHit(attacker, target, hitDamage);
          damage += hitDamage;
        }
        if (hitDamage > 0) damage += bonusOrPenaltyByEnemyType(attacker, targetGroup);
      }
    } else if (calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
      damage = handToHandAttackDamage(attacker, targetGroup, damageMod, !!attacker.isPlayer, rolls);
    }
  } else {
    if (calculateSuccessfulHit(attacker, target, chanceToHitMod, struck, rolls)) {
      damage = weaponAttackDamage(attacker, target, damageMod, weapon, rolls, targetGroup);
    }
  }
  damage = backstabDamage(damage, backstabChance, rolls());   // applied AFTER the damage calc, verbatim (lines 627/688)
  // Poisoned weapons (S19b): a damaging weapon hit inflicts the
  // poison ONCE and clears it from the weapon (the source's
  // weapon.poisonType = Poisons.None, inside the weapon branch after
  // backstab). onInflictPoison = the scene's InflictPoison seam.
  if (weapon && damage > 0 && (weapon.poisonType ?? -1) !== -1) {
    if (onInflictPoison) onInflictPoison(attacker, target, weapon.poisonType);
    weapon.poisonType = -1;
  }
  return Math.max(0, damage);
}

// ---- EnemyAttack.MeleeDamage hit gate, "matched to classic" ----
export const MELEE_HIT_YAW_DEG = 35.156;
export function meleeHitConnects(dist, inSight, withinHitYaw) {
  return inSight && (dist <= 0.25 || (dist <= MELEE_DISTANCE && withinHitYaw));
}

// ---- C15: knockback (WeaponManager.WeaponDamage + FormulaHelper) ----
// PlayerSpeedChanger.classicToUnitySpeedUnitRatio / 10 - every
// knockback constant divides through this (single source: motor.js,
// imported at the top).
export const KB_UNIT = CLASSIC_TO_UNITY_RATIO / 10;   // 3.95

/** GetEnemyEntityWeightInClassicUnits, verbatim shape: monster =
 *  MobileEnemy.Weight, class = female 240 / male 350. FLAGGED: the
 *  + Items.GetWeight()*4 term pends item weights (the items arc). */
export function enemyWeightClassicUnits(isClass, gender, mobileWeight) {
  if (!isClass) return mobileWeight ?? 0;
  return gender === 'female' ? 240 : 350;
}

// ---- T3a: CalculatePickpocketingChance, verbatim ----
// chance = live Pickpocket skill; vs an enemy mobile add
// 5 * (playerLevel - targetLevel); clamp 5..95. targetLevel = null
// for a townsperson (no level modifier).
export function calculatePickpocketingChance(pickpocketSkill, playerLevel, targetLevel = null) {
  let chance = pickpocketSkill;
  if (targetLevel != null) chance += 5 * (playerLevel - targetLevel);
  return Math.max(5, Math.min(95, chance));
}

/** The WeaponManager player-hit knockback speed, verbatim:
 *  kb = ((10d - w) * 256) / (w + 10d) * 2d;
 *  speed = (10d / w) * (2d - kb/256), through the ratio, floored at
 *  15 classic units. Caller owns the weight-0 gate. */
export function weaponKnockbackSpeed(damage, weightClassic) {
  const ten = damage * 10, two = damage * 2;
  const kb = ((ten - weightClassic) * 256) / (weightClassic + ten) * two;
  let ks = (ten / weightClassic) * (two - kb / 256);
  ks /= KB_UNIT;
  const floor = 15 / KB_UNIT;
  return ks < floor ? floor : ks;
}
