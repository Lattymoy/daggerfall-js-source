// ═══════════════════════════════════════════════════════════════════
// PCO1 - PHYSICAL COMBAT AND ARMOR OVERHAUL v1.44, THE MOD, 1:1
// (2026-09-12, Mac: "I want to implement this as our next integrated
// mod. The goal is 1:1 with complete parity").
//
// Kirk.O's Physical Combat And Armor Overhaul (Nexus; source
// github.com/magicono43/DFU-Mod_Physical-Combat-And-Armor-Overhaul)
// for Daggerfall Unity 1.1.1. THE LAW HERE IS THE SHIPPED v1.44 .dfmod
// Mac handed over, decompiled (ILSpy 8.2) - the repository's last
// single-file source is v1.40 and the DLL carries four versions of
// changes past it (the silver-weakness six, the VCEH mirror, the
// second and third monster damage pairs, the Ring of Namira dispatch).
// The v1.40 source names what the decompiler numbered (an enum member,
// a skill), and every method below cites the C# it restates by name.
//
// ── WHAT THE MOD IS ─────────────────────────────────────────────
//
// A MonoBehaviour that REPLACES FormulaHelper's combat formulas through
// FormulaHelper.RegisterOverride, one override per module switch:
//
//   equipmentDamageEnhanced   -> DamageEquipment (the mod's own
//                                "Believable Equipment Characteristics
//                                And Durability")
//   fadingEnchantedItems      -> a flag DamageEquipment reads: the
//                                PLAYER's enchanted gear is DESTROYED on
//                                breaking (LowerCondition with the item
//                                collection to remove it from)
//   fixedStrengthDamageModifier -> DamageModifier: (STR-50)/10, not /5
//   armorHitFormulaRedone     -> CalculateAttackDamage and every hit
//                                helper (the module that IS the overhaul:
//                                armour reduces damage instead of hit
//                                chance, skills decide the hit)
//   criticalStrikesIncreaseDamage, conditionBasedEffectiveness,
//   softMaterialRequirements  -> flags the overhaul reads; each is
//                                DEPENDENT on the module above it and
//                                stands down when that one is off,
//                                exactly as InitMod decides
//   + Roleplay Realism's archery (AdjustWeaponHitChanceMod /
//     AdjustWeaponAttackDamage), registered when THAT mod's
//     advancedArchery switch is on; and Ralzar's Meaner Monsters
//     (Kirk.O's edit), applied when that mod is loaded -
//     pcaaoMeanerMonsters.js. The port has no mod list, so both are
//     switches on the Mods pane, off by default.
//
// ── HOW IT LANDS HERE ───────────────────────────────────────────
//
// combat/formulas.js grew DFU's RegisterOverride: a registry the three
// members the mod overrides (damageModifier, damageEquipment,
// calculateAttackDamage's CORE) consult first. installPcaao()
// registers this module's three (systems/worldTick.js calls it, and
// every host loads worldTick), and each registered arm reads the
// module switches LIVE and declines (returns undefined) when its
// module is off - so the Mods pane's switches apply without a restart,
// where DFU's need one. The port's tail of calculateAttackDamage
// (concealment, the Strikes payload, the racial hit hook, the Ring of
// Namira's struck hook, the HUD report) is DFU's CALLERS' work and
// runs after either core, as it does after either FormulaHelper.
//
// ── WHAT IS KEPT BUG FOR BUG ────────────────────────────────────
//
// Unity's Mathf.Round rounds half to EVEN (unityRound), and every
// float the C# computes is a float32 (Math.fround at each step), so a
// .5 lands where the mod's lands. Four Mathf.Clamp calls whose result
// the C# DISCARDS (the hit chance's 3..97, the natural resistance's
// +-0.2, the critical strike's luck term, the shield chances) are
// discarded here too: the mod does not clamp them, and the port does
// not either. C# integer division truncates toward zero, and where an
// operand can be negative (a stat below 50, a level difference) the
// port truncates too. Random.Range(a, b) is b-exclusive; DFRandom.rand
// % 100 is the monster attack gate's own generator.
//
// What is NOT carried, and why: the two events the mod mirrors from the
// "Vanilla Combat Event Handler" mod (OnAttackDamageCalculated,
// OnSavingThrow) exist only to relay to OTHER mods and have no consumer
// here; the Debug.LogFormat of the soft-material multiplier is a Unity
// console line. Recorded in Combat-Arc PCO1.
// ═══════════════════════════════════════════════════════════════════

import { modSetting } from '../systems/modSettings.js';
import { liveStat } from '../systems/statMods.js';
import { skillValue, SKILLS } from '../systems/skills.js';
import { RACES } from '../systems/races.js';
import { SPECIAL_ABILITY_BITS } from '../systems/specialAdvantages.js';
import { weaponMinDamage, weaponMaxDamage, weaponSkillUsed } from '../characters/weapons.js';
import { equipTableOf, lowerCondition, slotForBodyPart, EQUIP_SLOTS, weaponProficiencyFlag } from '../systems/equip.js';
import { SHIELD_PARTS, isShieldTemplate, itemArmorValue } from '../systems/armorMaterials.js';
import { conditionPercentage, itemLongName } from '../systems/itemInfo.js';
import { effectiveUnitWeightInKg } from '../systems/inventory.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { enchantArmorMod, enchantChanceToHitMod, isEnchantedItem, entityImprovedAdrenalineRush } from '../systems/enchantments.js';
import { getItemHands, ITEM_HANDS } from '../characters/equipTable.js';
import { createWeapon } from './enemyEquipment.js';
import {
  registerFormulaOverride, handToHandMinDamage, handToHandMaxDamage,
  WEAPON_MATERIAL_MODIFIER, enemyEntityGroup, careerAttackModifier, ENEMY_GROUPS, dice100,
  MATERIAL_INEFFECTIVE_TEXT, SUCCESSFUL_BACKSTAB_TEXT,
} from './formulas.js';
import { meanerMonstersOn } from './pcaaoMeanerMonsters.js';

export { MEANER_MONSTERS, meanerMonstersRow, meanerMonstersOn } from './pcaaoMeanerMonsters.js';

// ── the vendor key, the manifest's own names ──────────────────────
export const PCAAO_VENDOR = 'pcaao';
export const PCAAO_VERSION = '1.44';

/** Unity's Mathf.Round: half to EVEN. Mathf.Round(2.5f) is 2 and
 *  Mathf.Round(3.5f) is 4; JS Math.round would say 3 and 4. */
export function unityRound(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
const F = Math.fround;   // every C# float here is a float32
/** `(int)x` on a double or float: truncation toward zero. */
const int = (x) => Math.trunc(x);
/** Random.Range(min, max + 1) - the C#'s inclusive integer roll. */
const range = (min, max, rolls) => min + Math.floor(rolls() * (max + 1 - min));
/** Random.Range(0, n): n-EXCLUSIVE, and Unity answers min when n <= 0. */
const rangeExclusive = (n, rolls) => (n <= 0 ? 0 : Math.floor(rolls() * n));

// ── THE MODULE SWITCHES (Awake + InitMod) ─────────────────────────
/** InitMod's dependency ladder, as it decides the *ModuleCheck
 *  statics: fading needs enhanced equipment damage; the critical,
 *  condition and soft-material modules need the redone armour formula.
 *  `Enabled` is the port's - DFU enables a mod by listing it. `read` is
 *  the Mods pane's store by default; a test hands in its own. */
export function pcaaoModules(read = (k) => modSetting(PCAAO_VENDOR, k)) {
  const enabled = !!read('Enabled');
  const on = (k) => enabled && !!read(k);
  const equipmentDamageEnhanced = on('equipmentDamageEnhanced');
  const armorHitFormulaRedone = on('armorHitFormulaRedone');
  return Object.freeze({
    enabled,
    equipmentDamageEnhanced,
    fadingEnchantedItems: equipmentDamageEnhanced && on('fadingEnchantedItems'),
    fixedStrengthDamageModifier: on('fixedStrengthDamageModifier'),
    armorHitFormulaRedone,
    criticalStrikesIncreaseDamage: armorHitFormulaRedone && on('criticalStrikesIncreaseDamage'),
    conditionBasedEffectiveness: armorHitFormulaRedone && on('conditionBasedEffectiveness'),
    softMaterialRequirements: armorHitFormulaRedone && on('softMaterialRequirements'),
    rolePlayRealismArchery: on('rolePlayRealismArchery'),
    meanerMonsters: enabled && meanerMonstersOn(read),
  });
}

// ── entity readers, in the C#'s names ──────────────────────────────
const isPlayer = (e) => !!e?.isPlayer;
const isMonster = (e) => !!e && !e.isPlayer && e.isClass === false;   // EntityTypes.EnemyMonster
const isClassEnemy = (e) => !!e && !e.isPlayer && e.isClass === true;   // EntityTypes.EnemyClass
const stat = (e, k) => liveStat(e, k);
const skill = (e, id) => skillValue(e, id);
const hasAbility = (career, flag) => ((career?.abilityFlagsAndSpellPointsBitfield ?? 0) & flag) === flag;
const leftHandItem = (e) => equipTableOf(e)[EQUIP_SLOTS.LeftHand] ?? null;
const struckSlotItem = (e, part) => {
  const slot = slotForBodyPart(part);
  return slot !== EQUIP_SLOTS.None ? (equipTableOf(e)[slot] ?? null) : null;
};
const isShield = (item) => item?.group === 'Armor' && isShieldTemplate(item?.templateIndex);
const isArmorGroup = (item) => item?.group === 'Armor';
const nativeMaterial = (item) => item?.material ?? 0;
const weaponSkillOf = (weapon) => weaponSkillUsed(weapon?.templateIndex) ?? SKILLS.HandToHand;
const materialModifier = (weapon) => WEAPON_MATERIAL_MODIFIER[weapon?.material] ?? 0;   // GetWeaponMaterialModifier
const shortName = (item) => item?.name ?? templateByIndex(item?.templateIndex)?.name ?? 'Item';
const SHORT_BOW = 129, LONG_BOW = 130, DAGGER = 113, TANTO = 114;

/** shieldBlockSuccess - the mod's static, written by the overhaul's
 *  CalculateAttackDamage (or by DamageEquipment itself when the
 *  overhaul is off) and read by the reductions that follow. */
let shieldBlockSuccess = false;
export const _shieldBlockSuccess = () => shieldBlockSuccess;

// ── DamageModifier ────────────────────────────────────────────────
/** `(int)Mathf.Floor((strength - 50) / 10f)` - ten points a point,
 *  "fixes a bug in DFU 0.10.21, the strength modifier for damage is
 *  double what classic had". The overhaul's OWN damage always uses
 *  this (the class's static), whatever the module switch says; the
 *  switch decides whether FormulaHelper's callers get it too. */
export const pcaaoDamageModifier = (strength) => Math.floor((strength - 50) / 10);

// ── CalculateSwingModifiers / Proficiency / Racial ─────────────────
/** The swing table is DFU's own (StrikeUp -4/+10, DownRight -2/+5,
 *  DownLeft +2/-5, Down +4/-10): the callers' damageMod/toHitMod. */

/** CalculateProficiencyModifiers: `ExpertProficiencies &
 *  weapon.GetWeaponSkillUsed()`, then a STAT-DRIVEN bonus per weapon
 *  skill (DFU's is level-driven). Integer divisions of stats >= 0. */
export function pcaaoProficiencyModifiers(attacker, weapon) {
  const mods = { damageMod: 0, toHitMod: 0 };
  const expert = ((attacker.career?.weaponArmorShieldsBitfield ?? 0) >>> 16) & 0x3f;
  const S = (k) => stat(attacker, k);
  if (weapon) {
    if ((expert & weaponProficiencyFlag(weapon)) !== 0) {
      switch (weaponSkillOf(weapon)) {
        case SKILLS.Archery:
          mods.damageMod = int(S('strength') / 25) + int(S('agility') / 25) + 1;
          mods.toHitMod = int(S('agility') / 8) + int(S('speed') / 20) + int(S('luck') / 20);
          break;
        case SKILLS.Axe:
          mods.damageMod = int(S('strength') / 20) + int(S('agility') / 33) + 1;
          mods.toHitMod = int(S('strength') / 11) + int(S('agility') / 11) + int(S('luck') / 22);
          break;
        case SKILLS.BluntWeapon:
          mods.damageMod = int(S('strength') / 20) + int(S('endurance') / 33) + 1;
          mods.toHitMod = int(S('strength') / 10) + int(S('agility') / 16) + int(S('luck') / 16);
          break;
        case SKILLS.LongBlade:
          mods.damageMod = int(S('agility') / 20) + int(S('strength') / 33) + 1;
          mods.toHitMod = int(S('agility') / 8) + int(S('speed') / 20) + int(S('luck') / 20);
          break;
        case SKILLS.ShortBlade:
          mods.damageMod = int(S('agility') / 25) + int(S('speed') / 25) + 1;
          mods.toHitMod = int(S('agility') / 10) + int(S('speed') / 14) + int(S('luck') / 18);
          break;
        default: break;
      }
    }
  } else if ((expert & 4) !== 0) {   // ProficiencyFlags.HandToHand
    mods.damageMod = int(S('strength') / 50) + int(S('endurance') / 50) + int(S('agility') / 50) + int(S('speed') / 50) + 1;
    mods.toHitMod = int(S('agility') / 22) + int(S('speed') / 22) + int(S('strength') / 22) + int(S('endurance') / 22) + int(S('luck') / 22);
  }
  return mods;
}

/** CalculateRacialModifiers: per race, per weapon skill, stat-driven -
 *  and the ELSE-IF ladders are the C#'s (a Dark Elf with a short blade
 *  takes the second arm, an Argonian with anything but a short blade
 *  takes nothing). Weaponless: Khajiit and Nord. */
export function pcaaoRacialModifiers(attacker, weapon, player) {
  const mods = { damageMod: 0, toHitMod: 0 };
  const S = (k) => stat(attacker, k);
  const race = player?.raceId ?? attacker.raceId;
  if (weapon) {
    const ws = weaponSkillOf(weapon);
    switch (race) {
      case RACES.Argonian:
        if (ws === SKILLS.ShortBlade) {
          mods.damageMod = int(S('agility') / 33) + int(S('speed') / 33);
          mods.toHitMod = int(S('agility') / 16) + int(S('speed') / 33) + int(S('luck') / 33);
        }
        break;
      case RACES.DarkElf:
        if (ws === SKILLS.LongBlade) {
          mods.damageMod = int(S('agility') / 25) + int(S('strength') / 25);
          mods.toHitMod = int(S('agility') / 25) + int(S('speed') / 33) + int(S('luck') / 33);
        } else if (ws === SKILLS.ShortBlade) {
          mods.damageMod = int(S('agility') / 50) + int(S('speed') / 50);
          mods.toHitMod = int(S('agility') / 33) + int(S('speed') / 33) + int(S('luck') / 33);
        }
        break;
      case RACES.Khajiit:
        if (ws === SKILLS.ShortBlade) {
          mods.damageMod = int(S('agility') / 33) + int(S('speed') / 50);
          mods.toHitMod = int(S('agility') / 20) + int(S('speed') / 33) + int(S('luck') / 50);
        }
        break;
      case RACES.Nord:
        if (ws === SKILLS.Axe) {
          mods.damageMod = int(S('strength') / 16) + int(S('agility') / 33);
          mods.toHitMod = int(S('strength') / 33) + int(S('agility') / 33) + int(S('luck') / 33);
        } else if (ws === SKILLS.BluntWeapon) {
          mods.damageMod = int(S('strength') / 25) + int(S('endurance') / 25);
          mods.toHitMod = int(S('strength') / 25) + int(S('agility') / 33) + int(S('luck') / 33);
        }
        break;
      case RACES.Redguard:
        if (ws === SKILLS.LongBlade) {
          mods.damageMod = int(S('agility') / 33) + int(S('strength') / 50);
          mods.toHitMod = int(S('agility') / 10) + int(S('speed') / 25) + int(S('luck') / 25);
        } else if (ws === SKILLS.BluntWeapon) {
          mods.damageMod = int(S('strength') / 33) + int(S('endurance') / 33);
          mods.toHitMod = int(S('strength') / 20) + int(S('agility') / 25) + int(S('luck') / 33);
        } else if (ws === SKILLS.Axe) {
          mods.damageMod = int(S('strength') / 16) + int(S('agility') / 33);
          mods.toHitMod = int(S('strength') / 33) + int(S('agility') / 33) + int(S('luck') / 33);
        } else if (ws === SKILLS.Archery) {
          mods.damageMod = int(S('strength') / 50) + int(S('agility') / 50);
          mods.toHitMod = int(S('agility') / 25) + int(S('speed') / 33) + int(S('luck') / 33);
        }
        break;
      case RACES.WoodElf:
        if (ws === SKILLS.ShortBlade) {
          mods.damageMod = int(S('agility') / 33) + int(S('speed') / 50);
          mods.toHitMod = int(S('agility') / 20) + int(S('speed') / 33) + int(S('luck') / 50);
        } else if (ws === SKILLS.Archery) {
          mods.damageMod = int(S('strength') / 25) + int(S('agility') / 25);
          mods.toHitMod = int(S('agility') / 10) + int(S('speed') / 25) + int(S('luck') / 25);
        }
        break;
      default: break;
    }
  } else if (race === RACES.Khajiit) {
    mods.damageMod = int(S('strength') / 33) + int(S('endurance') / 33) + int(S('agility') / 50) + int(S('speed') / 50);
    mods.toHitMod = int(S('agility') / 25) + int(S('speed') / 50) + int(S('strength') / 50) + int(S('endurance') / 50) + int(S('luck') / 50);
  } else if (race === RACES.Nord) {
    mods.damageMod = int(S('strength') / 33) + int(S('endurance') / 50);
  }
  return mods;
}

// ── the hit ───────────────────────────────────────────────────────
/** CalculateWeaponToHit: material modifier x2 + 2 ("that daedric sword
 *  will now give +14 to the wielder's hit chance, instead of +60"). */
export const pcaaoWeaponToHit = (weapon) => materialModifier(weapon) * 2 + 2;

/** CalculateArmorToHit: the struck part's ArmorValues entry, then the
 *  PLAYER reads `100 - Increased - Decreased` whatever the part, and a
 *  CLASS enemy reads a flat 60. A monster keeps its part's value. */
export function pcaaoArmorToHit(target, struckBodyPart) {
  let result = 0;
  const values = target.armorValues ?? [];
  if (struckBodyPart <= values.length) result = values[struckBodyPart] ?? 0;
  if (isPlayer(target)) result = 100 - enchantArmorMod(target);
  else if (isClassEnemy(target)) result = 60;
  return result;
}

/** CalculateAdrenalineRushToHit: below a SIXTH of max health (DFU's is
 *  an eighth), +8 or +12 improved (DFU's +5/+8). */
export function pcaaoAdrenalineRushToHit(attacker, target) {
  let mod = 0;
  const rushing = (e) => hasAbility(e.career, SPECIAL_ABILITY_BITS.adrenalineRush) && (e.health ?? 0) < int((e.maxHealth ?? 0) / 6);
  if (rushing(attacker)) mod += entityImprovedAdrenalineRush(attacker) ? 12 : 8;
  if (rushing(target)) mod -= entityImprovedAdrenalineRush(target) ? 12 : 8;
  return mod;
}

/** CalculateStatDiffsToHit: luck/10, agility/4, speed/8 - and the
 *  target's luck above 50 costs the attacker, rounded (half to even). */
export function pcaaoStatDiffsToHit(attacker, target) {
  return int((stat(attacker, 'luck') - stat(target, 'luck')) / 10)
    + int((stat(attacker, 'agility') - stat(target, 'agility')) / 4)
    + int((stat(attacker, 'speed') - stat(target, 'speed')) / 8)
    - unityRound(F((stat(target, 'luck') - 50) / 10));
}

/** CalculateSkillsToHit: dodging halved (DFU quarters it), and WITHOUT
 *  the critical-strike module the classic crit roll - the player's at
 *  crit/3 for +crit/3, a monster's at crit for +crit/10. */
export function pcaaoSkillsToHit(attacker, target, rolls, modules, notes = null) {
  let mod = -int(skill(target, SKILLS.Dodging) / 2);
  if (!modules.criticalStrikesIncreaseDamage) {
    const crit = skill(attacker, SKILLS.CriticalStrike);
    if (isPlayer(attacker)) {
      if (dice100(int(crit / 3), rolls())) { mod += int(crit / 3); if (notes) notes.critical = true; }
    } else if (dice100(crit, rolls())) { mod += int(crit / 10); if (notes) notes.critical = true; }
  }
  return mod;
}

/** CalculateAdjustmentsToHit: the biography's avoid-hit against the
 *  player, +50 for a MONSTER target, -50 always - so a monster nets 0
 *  where DFU's +40 nets -10. */
export function pcaaoAdjustmentsToHit(target) {
  let mod = 0;
  if (isPlayer(target)) mod -= (target.biographyAvoidHitMod ?? 0);
  if (isMonster(target)) mod += 50;
  return mod - 50;
}

/** CalculateSuccessfulHit: the seven terms summed, `Mathf.Clamp(num,
 *  3, 97)` COMPUTED AND DISCARDED (the C# never assigns it), then
 *  Dice100. A 200 is a certain hit and a -10 a certain miss. */
export function pcaaoSuccessfulHit(attacker, target, chanceToHitMod, struckBodyPart, rolls, modules, notes = null) {
  if (!attacker || !target) return false;
  const chance = chanceToHitMod
    + pcaaoArmorToHit(target, struckBodyPart)
    + pcaaoAdrenalineRushToHit(attacker, target)
    + enchantChanceToHitMod(attacker)
    + pcaaoStatDiffsToHit(attacker, target)
    + pcaaoSkillsToHit(attacker, target, rolls, modules, notes)
    + pcaaoAdjustmentsToHit(target);
  return dice100(chance, rolls());
}

/** CalculateStruckBodyPart: the mod's twenty-slot table - feet likelier
 *  than the head, legs likelier than the hands. */
export const PCAAO_BODY_PARTS = Object.freeze([0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6]);
export const pcaaoStruckBodyPart = (roll01) => PCAAO_BODY_PARTS[Math.floor(roll01 * PCAAO_BODY_PARTS.length)];

/** CalculateBackstabDamage: DFU's own (x3 behind the level > 1 gate,
 *  and the popup). */
export function pcaaoBackstabDamage(damage, backstabbingLevel, rolls, say) {
  if (backstabbingLevel > 1 && dice100(backstabbingLevel, rolls())) {
    say?.(SUCCESSFUL_BACKSTAB_TEXT);
    return damage * 3;
  }
  return damage;
}

/** CriticalStrikeHandler: luck's term `Mathf.Floor((luck - 50) / 25f)`,
 *  its `Mathf.Clamp(num, -2, 2)` computed and discarded; the player rolls crit / (4 - luckTerm),
 *  a monster crit / (5 - luckTerm). */
export function pcaaoCriticalStrike(attacker, rolls) {
  const luckTerm = Math.floor(F((stat(attacker, 'luck') - 50) / 25));
  const crit = skill(attacker, SKILLS.CriticalStrike);
  if (isPlayer(attacker)) return dice100(int(crit / (4 - luckTerm)), rolls());
  return dice100(int(crit / (5 - luckTerm)), rolls());
}

// ── damage ────────────────────────────────────────────────────────
/** The mod's GetBonusOrPenaltyByEnemyType: a WILLPOWER-driven random
 *  bonus (Range(0, n), n-exclusive) and a level-driven penalty, on the
 *  career's Bonus/Phobia bits per enemy group - the Humanoid arm keys
 *  on GetEnemyGroup (DFU's keys on affinity), and a player TARGET is
 *  humanoid. The integer divisions truncate toward zero. */
export function pcaaoBonusOrPenaltyByEnemyType(attacker, target, rolls) {
  if (!attacker || !target) return 0;
  const flags = attacker.attackModifierFlags ?? attacker.career?.attackModifierFlags ?? null;
  let bonus = 0, penalty = 0;
  const will = int((stat(attacker, 'willpower') - 50) / 5);   // Mathf.Round of an int
  const aLevel = attacker.level ?? 1, tLevel = target.level ?? 1;
  if (isPlayer(attacker)) {
    bonus = Math.max(10 + will - int(tLevel / 2), 0);
    penalty = Math.max(int(tLevel / 2) - will, 0);
  } else {
    bonus = Math.max(5 + will + int(aLevel / 4), 0);
    penalty = Math.max(tLevel - (aLevel + will), 0);
  }
  bonus = rangeExclusive(bonus, rolls);
  let group = ENEMY_GROUPS.None;
  if (isPlayer(target)) group = ENEMY_GROUPS.Humanoid;
  else group = enemyEntityGroup(target.careerIndex);
  if (flags == null || group === ENEMY_GROUPS.None) return 0;
  const decoded = careerAttackModifier(flags, group);   // 1 bonus, -1 phobia (DFU decodes exclusively)
  let result = 0;
  if (decoded === 1) result += bonus;
  if (decoded === -1) result -= penalty;
  return result;
}

/** CalculateHandToHandAttackDamage: the player rolls DFU's own
 *  min..max, adds the modifier and the mod's STRENGTH term; a monster's
 *  `damageModifier` IS its summed attack damage. */
export function pcaaoHandToHandAttackDamage(attacker, target, damageModifier, player, rolls) {
  let damage = 0;
  if (player) {
    const h2h = skill(attacker, SKILLS.HandToHand);
    damage = range(handToHandMinDamage(h2h), handToHandMaxDamage(h2h), rolls);
    damage += damageModifier;
    damage += pcaaoDamageModifier(stat(attacker, 'strength'));
  } else {
    damage += damageModifier;
  }
  if (damage < 1) damage = 0;
  if (damage >= 1) damage += pcaaoBonusOrPenaltyByEnemyType(attacker, target, rolls);
  return damage;
}

/** MonsterCareers whose weapons silver doubles against (the six that
 *  joined the Skeletal Warrior): Werewolf, Ghost, Wraith, Vampire,
 *  Mummy, Wereboar. */
export const SILVER_DOUBLED_CAREERS = Object.freeze([9, 18, 23, 28, 19, 14]);
const SKELETAL_WARRIOR = 15;

/** CalculateWeaponAttackDamage: the roll, the Skeletal Warrior's edged
 *  halving and silver doubling, the six others' silver doubling, the
 *  strength term DOUBLED for a two-handed weapon that is not a bow,
 *  the material modifier, the floor, the enemy-type term, the archery
 *  module. */
export function pcaaoWeaponAttackDamage(attacker, target, damageModifier, weaponAnimTime, weapon, rolls, modules) {
  let damage = range(weaponMinDamage(weapon.templateIndex), weaponMaxDamage(weapon.templateIndex), rolls) + damageModifier;
  if (!isPlayer(target)) {
    if (target.careerIndex === SKELETAL_WARRIOR) {
      if (((weapon.flags ?? 0) & 0x10) === 0) damage = int(damage / 2);
      if (weapon.material === 2) damage *= 2;
    } else if (SILVER_DOUBLED_CAREERS.includes(target.careerIndex) && weapon.material === 2) {
      damage *= 2;
    }
  }
  const twoHanded = getItemHands(weapon) === ITEM_HANDS.Both && weapon.templateIndex !== SHORT_BOW && weapon.templateIndex !== LONG_BOW;
  damage += twoHanded ? pcaaoDamageModifier(stat(attacker, 'strength')) * 2 : pcaaoDamageModifier(stat(attacker, 'strength'));
  damage += materialModifier(weapon);
  if (damage < 1) damage = 0;
  if (damage >= 1) damage += pcaaoBonusOrPenaltyByEnemyType(attacker, target, rolls);
  if (modules.rolePlayRealismArchery) damage = pcaaoAdjustWeaponAttackDamage(attacker, target, damage, weaponAnimTime, weapon);
  return damage;
}

// ── Roleplay Realism's archery, as the mod bakes it in ─────────────
/** AdjustWeaponHitChanceMod: a bow's draw time (ms) bends the hit
 *  chance - a snap shot -40, a long hold -10 (the `> 8000` arm is
 *  unreachable behind `> 5000`; carried as written). */
export function pcaaoAdjustWeaponHitChanceMod(attacker, target, hitChanceMod, weaponAnimTime, weapon) {
  if (weaponAnimTime > 0 && (weapon.templateIndex === SHORT_BOW || weapon.templateIndex === LONG_BOW)) {
    let mod = hitChanceMod;
    if (weaponAnimTime < 200) mod -= 40;
    else if (weaponAnimTime < 500) mod -= 10;
    else if (weaponAnimTime < 1000) mod = hitChanceMod;
    else if (weaponAnimTime < 2000) mod += 10;
    else if (weaponAnimTime > 5000) mod -= 10;
    else if (weaponAnimTime > 8000) mod -= 20;
    return mod;
  }
  return hitChanceMod;
}
/** AdjustWeaponAttackDamage: the draw time scales the damage, in a
 *  DOUBLE, truncated back to int. */
export function pcaaoAdjustWeaponAttackDamage(attacker, target, damage, weaponAnimTime, weapon) {
  if (weaponAnimTime > 0 && (weapon.templateIndex === SHORT_BOW || weapon.templateIndex === LONG_BOW)) {
    let d = damage;
    if (weaponAnimTime < 800) d *= weaponAnimTime / 800.0;
    else if (weaponAnimTime < 5000) d = damage;
    else if (weaponAnimTime < 6000) d *= 0.85;
    else if (weaponAnimTime < 8000) d *= 0.75;
    else if (weaponAnimTime < 9000) d *= 0.5;
    else d *= 0.25;
    return int(d);
  }
  return damage;
}

// ── condition ─────────────────────────────────────────────────────
/** AlterDamageBasedOnWepCondition: the weapon's condition band scales
 *  its damage - a blunt weapon loses less. Mathf.Round, half to even. */
export function pcaaoAlterDamageBasedOnWepCondition(damage, bluntWep, weapon) {
  const pct = conditionPercentage(weapon);
  const r = (m) => unityRound(F(damage * F(m)));
  if (bluntWep) {
    if (pct >= 92) return r(1.1);
    if (pct >= 76) return damage;
    if (pct >= 61) return damage;
    if (pct >= 41) return r(0.9);
    if (pct >= 16) return r(0.8);
    if (pct >= 6) return r(0.65);
    if (pct > 5) return damage;
    return r(0.5);
  }
  if (pct >= 92) return r(1.3);
  if (pct >= 76) return r(1.1);
  if (pct >= 61) return damage;
  if (pct >= 41) return r(0.85);
  if (pct >= 16) return r(0.7);
  if (pct >= 6) return r(0.45);
  if (pct > 5) return damage;
  return r(0.25);
}
/** AlterArmorReducBasedOnItemCondition: the multiplier on an armour
 *  piece's reduction factor - worn armour reduces less. A null piece
 *  is 1. */
export function pcaaoAlterArmorReducBasedOnItemCondition(armor) {
  if (!armor) return 1;
  const pct = conditionPercentage(armor);
  if (pct >= 92) return F(0.85);
  if (pct >= 76) return F(0.95);
  if (pct >= 61) return 1;
  if (pct >= 41) return F(1.1);
  if (pct >= 16) return F(1.2);
  if (pct >= 6) return F(1.35);
  if (pct <= 5) return F(1.5);
  return 1;
}

// ── the material ladders ──────────────────────────────────────────
/** ArmorMaterialIdentifier: a shield by its native material, 1..10
 *  (leather 1, chain 2, iron 3, steel and silver 4, elven 5, dwarven
 *  6, mithril and adamantium 7, ebony 8, orcish 9, daedric 10); any
 *  other piece GetMaterialArmorValue() / 2 (the artifact halving
 *  rides inside); nothing is 1. */
export function pcaaoArmorMaterialIdentifier(armor) {
  if (!armor) return 1;
  if (!isShield(armor)) return int(itemArmorValue(armor) / 2);
  switch (nativeMaterial(armor)) {
    case 0: return 1;
    case 256: case 259: return 2;
    case 512: return 3;
    case 513: case 514: return 4;
    case 515: return 5;
    case 516: return 6;
    case 517: case 518: return 7;
    case 519: return 8;
    case 520: return 9;
    case 521: return 10;
    default: return 1;
  }
}
/** ArmorMaterialModifierFinder: the armour's tier for the condition
 *  arithmetic, 1..8. */
export function pcaaoArmorMaterialModifierFinder(armor) {
  switch (nativeMaterial(armor)) {
    case 0: return 1;
    case 256: case 259: case 512: return 2;
    case 513: case 514: return 3;
    case 515: return 4;
    case 516: case 517: case 518: return 5;
    case 519: return 6;
    case 520: return 7;
    case 521: return 8;
    default: return 1;
  }
}
/** EqualizeMaterialConditions: a weapon's material 0..9 and an
 *  armour's 256..521 onto one 1..8 scale (iron, steel and silver, and
 *  leather, chain and iron plate, are all 1). */
export function pcaaoEqualizeMaterialConditions(item) {
  const m = nativeMaterial(item);
  if (m <= 9 && m >= 0) {
    switch (m) {
      case 0: case 1: case 2: return 1;
      case 3: return 2;
      case 4: return 3;
      case 5: return 4;
      case 6: return 5;
      case 7: return 6;
      case 8: return 7;
      case 9: return 8;
      default: return 1;
    }
  }
  if (m <= 521 && m >= 256) {
    switch (m) {
      case 256: case 259: case 512: case 513: case 514: return 1;
      case 515: return 2;
      case 516: return 3;
      case 517: return 4;
      case 518: return 5;
      case 519: return 6;
      case 520: return 7;
      case 521: return 8;
      default: return 1;
    }
  }
  return 1;
}
/** SpecificWeaponConditionDamage: a bow's string wears by its
 *  material tier alone. */
export function pcaaoSpecificWeaponConditionDamage(weapon, damageWep, materialValue) {
  if (weapon.templateIndex === LONG_BOW) return materialValue === 1 ? 1 : materialValue === 2 ? 2 : 3;
  if (weapon.templateIndex === SHORT_BOW) return materialValue === 1 ? 1 : 2;
  return damageWep;
}

// ── the wear ──────────────────────────────────────────────────────
/** LowerCondition(amount, owner, collection): the PLAYER's enchanted
 *  piece, under the fading module, is REMOVED from the pack when it
 *  breaks; everything else breaks as DFU's does. */
function wear(item, owner, amount, modules, say) {
  const removeFrom = modules.fadingEnchantedItems && isPlayer(owner) && isEnchantedItem(item) ? (owner.items ?? null) : null;
  lowerCondition(item, amount, owner, say, removeFrom);
}
/** ApplyConditionDamageThroughWeaponDamage: armour takes the damage
 *  (a shield as is, a piece doubled); a weapon takes `10 * damage /
 *  50`, a 40% roll turning 0 into 1, and a bow its own tier's wear. */
export function pcaaoApplyConditionDamageThroughWeaponDamage(item, owner, damage, bluntWep, shtbladeWep, missileWep, wepEqualize, modules, rolls, say) {
  if (isArmorGroup(item)) {
    wear(item, owner, isShield(item) ? damage : damage * 2, modules, say);
    return;
  }
  let amount = int(10 * damage / 50);
  if (amount === 0 && dice100(40, rolls())) amount = 1;
  if (missileWep) amount = pcaaoSpecificWeaponConditionDamage(item, amount, wepEqualize);
  wear(item, owner, amount, modules, say);
}
/** ApplyConditionDamageThroughUnarmedDamage: a fist wears only
 *  armour - a shield half of it, a piece all of it. */
export function pcaaoApplyConditionDamageThroughUnarmedDamage(item, owner, damage, modules, say) {
  if (!isArmorGroup(item)) return;
  wear(item, owner, isShield(item) ? int(damage / 2) : damage, modules, say);
}

/** WarningMessagePlayerEquipmentCondition: the player's gear speaks
 *  as it wears - at 48%, at 15%, and on any single blow that took 15
 *  points of its percentage - in the words the mod gives each kind of
 *  thing. HUD text for two seconds. */
export function pcaaoWarningMessagePlayerEquipmentCondition(item, startItemCondPer, say) {
  const pct = conditionPercentage(item);
  const lost = startItemCondPer - pct;
  if (pct > 49 && lost < 15) return;
  let a, b, c;
  if (isEnchantedItem(item)) {
    const n = item.customMagic != null ? shortName(item) : itemLongName(item);
    a = `My ${n} Is Flickering Slightly`;
    b = `My ${n} Is Going In And Out Of Existence`;
    c = `My ${n} Was Drained Significantly By That`;
  } else {
    const n = shortName(item);
    switch (item.templateIndex) {
      case 103: case 104: case 108: case 516: case 519:
        a = `My ${n} Are In Rough Shape`; b = `My ${n} Are Falling Apart`; c = `My ${n} Were Shredded Heavily By That`; break;
      case 113: case 114: case 116: case 117: case 118: case 119: case 120: case 121: case 122: case 123: case 127: case 128: case 513:
        a = `My ${n} Could Use A Sharpening`; b = `My ${n} Looks As Dull As A Butter Knife`; c = `My ${n} Lost A lot Of Edge From That Swipe`; break;
      case 115: case 124: case 125: case 126: case 514:
        a = `My ${n}'s Shaft Has Some Small Cracks`; b = `My ${n}'s Shaft Is Nearly Split In Two`; c = `My ${n} Shaft Was Cracked By That Swing`; break;
      case 129: case 130:
        a = `The Bowstring On My ${n} Is Losing Its Twang`; b = `The Bowstring On My ${n} Looks Ready To Snap`; c = `The Bowstring On My ${n} Nearly Snapped From That`; break;
      default:
        a = `My ${n} Is In Rough Shape`; b = `My ${n} Is Falling Apart`; c = `My ${n} Was Shredded Heavily By That`; break;
    }
  }
  if (pct === 48) say?.(a, 2);
  else if (pct === 15) say?.(b, 2);
  else if (lost >= 15) say?.(c, 2);
}

/** MaterialDifferenceDamageCalculation: how much of a blow's damage
 *  reaches a struck piece's condition - blunt weapons by their weight
 *  band, edged by the material difference, and a shield takes twice
 *  (blunt) or a third (edged). All C# integer arithmetic. */
export function pcaaoMaterialDifferenceDamageCalculation(item, matDifference, atkStrength, damage, bluntWep, wepWeight, shieldCheck) {
  const m = nativeMaterial(item);
  let d = damage, s = atkStrength, diff = matDifference;
  if (bluntWep) {
    if (shieldCheck) d *= 2;
    if (m === 0) d = int(d / 4);
    else if (m === 256 || m === 259) d *= 2;
    if (wepWeight >= 7 && wepWeight <= 9) { s = int(s / 5); d = d * 3 + s; return int(d / 3); }
    if (wepWeight >= 4 && wepWeight <= 6) { s = int(s / 5); d = d * 2 + s; return int(d / 3); }
    if (wepWeight >= 10 && wepWeight <= 12) { s = int(s / 5); d = d * 4 + s; return int(d / 3); }
    if (wepWeight >= 1 && wepWeight <= 3) { s = int(s / 5); d += s; return int(d / 4); }
    if (wepWeight >= 13 && wepWeight <= 35) { s = int(s / 5); d = d * 5 + s; return int(d / 3); }
    if (wepWeight >= 36) { s = int(s / 5); d = d * 7 + s; return int(d / 3); }
    s = int(s / 20); d = int(d / 2) + s; return int(d / 5);
  }
  if (shieldCheck) d = int(d / 3);
  if (m === 256 || m === 259) d = int(d / 2);
  if (diff < 0) { diff = -diff; diff++; s = int(s / 10); d = d * diff + s; return int(d / 2); }
  if (diff === 0) { s = int(s / 10); d += s; return int(d / 2); }
  s = int(s / 10); d = int(d / diff) + s; return int(d / 3);
}

/** DamageEquipment - the "Believable Equipment Characteristics And
 *  Durability" module. Without the overhaul, the shield block is the
 *  plain "does the shield cover the struck part" test; with it, the
 *  overhaul's roll already decided `shieldBlockSuccess`. The attacker's
 *  weapon wears by its kind (blunt +STR/10 over its tier, a dagger or
 *  tanto +STR/30 over a heavy tier, other short blades lighter, a bow
 *  by its string), the player is warned, and the struck side - the
 *  blocking shield or the struck part's piece - wears by the material
 *  difference. A fist wears the struck piece alone. Always false: the
 *  C# returns false on every path. */
export function pcaaoDamageEquipment(attacker, target, damage, weapon, struckBodyPart, { rolls = Math.random, say = null, modules = pcaaoModules() } = {}) {
  let liveStrength = stat(attacker, 'strength');
  let matDifference = 0;
  let bluntWep = false, shtbladeWep = false, missileWep = false;
  let wepEqualize = 1, wepWeight = 1;
  let startItemCondPer = 0;
  if (!modules.armorHitFormulaRedone) {
    const shield = leftHandItem(target);
    shieldBlockSuccess = false;
    if (shield) {
      for (const part of SHIELD_PARTS.get(shield.templateIndex) ?? []) {
        if (shieldBlockSuccess) break;
        if (part === struckBodyPart) shieldBlockSuccess = true;
      }
    }
  }
  if (weapon && damage > 0) {
    const wepMatModifier = materialModifier(weapon) + 2;
    let wepDamage = damage;
    wepEqualize = pcaaoEqualizeMaterialConditions(weapon);
    wepDamage *= wepEqualize;
    const ws = weaponSkillOf(weapon);
    if (ws === SKILLS.BluntWeapon) {
      wepDamage += int(liveStrength / 10);
      const wepMatDiv = F(F(wepEqualize * F(0.2)) + 1);
      wepDamage = Math.ceil(F(wepDamage / wepMatDiv));
      bluntWep = true;
      wepWeight = Math.ceil(effectiveUnitWeightInKg(weapon));
      startItemCondPer = conditionPercentage(weapon);
      pcaaoApplyConditionDamageThroughWeaponDamage(weapon, attacker, wepDamage, bluntWep, shtbladeWep, missileWep, wepEqualize, modules, rolls, say);
    } else if (ws === SKILLS.ShortBlade) {
      const heavy = weapon.templateIndex === DAGGER || weapon.templateIndex === TANTO;
      wepDamage += int(liveStrength / 30);
      const wepMatDiv = F(F(wepEqualize * F(heavy ? 0.9 : 0.3)) + 1);
      wepDamage = Math.ceil(F(wepDamage / wepMatDiv));
      shtbladeWep = true;
      startItemCondPer = conditionPercentage(weapon);
      pcaaoApplyConditionDamageThroughWeaponDamage(weapon, attacker, wepDamage, bluntWep, shtbladeWep, missileWep, wepEqualize, modules, rolls, say);
    } else if (ws === SKILLS.Archery) {
      missileWep = true;
      startItemCondPer = conditionPercentage(weapon);
      pcaaoApplyConditionDamageThroughWeaponDamage(weapon, attacker, wepDamage, bluntWep, shtbladeWep, missileWep, wepEqualize, modules, rolls, say);
    } else {
      wepDamage += int(liveStrength / 10);
      const wepMatDiv = F(F(wepEqualize * F(0.2)) + 1);
      wepDamage = Math.ceil(F(wepDamage / wepMatDiv));
      startItemCondPer = conditionPercentage(weapon);
      pcaaoApplyConditionDamageThroughWeaponDamage(weapon, attacker, wepDamage, bluntWep, shtbladeWep, missileWep, wepEqualize, modules, rolls, say);
    }
    if (isPlayer(attacker)) pcaaoWarningMessagePlayerEquipmentCondition(weapon, startItemCondPer, say);
    const struck = shieldBlockSuccess ? leftHandItem(target) : struckSlotItem(target, struckBodyPart);
    if (struck) {
      let d = damage * pcaaoEqualizeMaterialConditions(struck);
      matDifference = pcaaoArmorMaterialModifierFinder(struck) - wepMatModifier;
      d = pcaaoMaterialDifferenceDamageCalculation(struck, matDifference, liveStrength, d, bluntWep, wepWeight, shieldBlockSuccess);
      startItemCondPer = conditionPercentage(struck);
      pcaaoApplyConditionDamageThroughWeaponDamage(struck, target, d, bluntWep, shtbladeWep, missileWep, wepEqualize, modules, rolls, say);
      if (isPlayer(target)) pcaaoWarningMessagePlayerEquipmentCondition(struck, startItemCondPer, say);
    }
    return false;
  }
  if (!weapon && damage > 0) {
    const struck = shieldBlockSuccess ? leftHandItem(target) : struckSlotItem(target, struckBodyPart);
    if (struck) {
      let d = damage * pcaaoEqualizeMaterialConditions(struck);
      const armorMod = pcaaoArmorMaterialModifierFinder(struck);
      liveStrength = int(liveStrength / 5);
      const div = F(F(armorMod * F(shieldBlockSuccess ? 0.4 : 0.2)) + 1);
      d = Math.ceil(F((d + liveStrength) / div));
      startItemCondPer = conditionPercentage(struck);
      pcaaoApplyConditionDamageThroughUnarmedDamage(struck, target, d, modules, say);
      if (isPlayer(target)) pcaaoWarningMessagePlayerEquipmentCondition(struck, startItemCondPer, say);
    }
    return false;
  }
  return false;
}

// ── the reductions ────────────────────────────────────────────────
/** One row of a reduction table: `Mathf.Round(damage * (Mathf.Min(base
 *  * cond, cap) - naturalDamResist))`, every term a float32, the round
 *  half to even. */
const reduce = (damage, base, cap, cond, nat) => unityRound(F(damage * F(F(Math.min(F(base * cond), F(cap))) - nat)));
const table = (rows, material, damage, cond, nat) => {
  const row = rows[material];
  return row ? reduce(damage, row[0], row[1], cond, nat) : reduce(damage, 1, 1, cond, nat);
};
// [base, cap] by armour material 1..10
const UNARMED_ROWS = { 1: [0.9, 0.95], 2: [0.84, 0.95], 3: [0.8, 0.92], 4: [0.72, 0.89], 5: [0.66, 0.86], 6: [0.58, 0.83], 7: [0.52, 0.8], 8: [0.46, 0.76], 9: [0.36, 0.7], 10: [0.3, 0.65] };
const BLUNT_ROWS = { 1: [0.72, 0.89], 2: [0.88, 0.95], 3: [0.92, 0.95], 4: [0.84, 0.93], 5: [0.8, 0.9], 6: [0.72, 0.87], 7: [0.64, 0.84], 8: [0.56, 0.78], 9: [0.48, 0.7], 10: [0.4, 0.58] };
const EDGED_ROWS = { 1: [0.88, 0.95], 2: [0.72, 0.89], 3: [0.86, 0.9], 4: [0.78, 0.88], 5: [0.74, 0.85], 6: [0.66, 0.82], 7: [0.58, 0.78], 8: [0.5, 0.73], 9: [0.42, 0.56], 10: [0.34, 0.46] };
const SHIELD_UNARMED_ROWS = { 1: [0.59, 0.79], 2: [0.55, 0.75], 3: [0.49, 0.69], 4: [0.45, 0.65], 5: [0.43, 0.63], 6: [0.39, 0.59], 7: [0.35, 0.55], 8: [0.33, 0.44], 9: [0.29, 0.37], 10: [0.25, 0.31] };
const SHIELD_BLUNT_ROWS = { 1: [0.74, 0.84], 2: [0.7, 0.8], 3: [0.64, 0.72], 4: [0.58, 0.68], 5: [0.54, 0.64], 6: [0.5, 0.6], 7: [0.46, 0.56], 8: [0.42, 0.5], 9: [0.38, 0.45], 10: [0.34, 0.39] };
const SHIELD_EDGED_ROWS = { 1: [0.7, 0.8], 2: [0.66, 0.76], 3: [0.6, 0.68], 4: [0.54, 0.64], 5: [0.5, 0.6], 6: [0.46, 0.56], 7: [0.42, 0.52], 8: [0.38, 0.46], 9: [0.34, 0.41], 10: [0.3, 0.36] };
const AVERAGE_SHIELD_ROWS = { 1: [0.68, 0.81], 2: [0.64, 0.77], 3: [0.58, 0.7], 4: [0.52, 0.66], 5: [0.49, 0.62], 6: [0.45, 0.61], 7: [0.41, 0.54], 8: [0.38, 0.47], 9: [0.34, 0.41], 10: [0.3, 0.35] };
const AVERAGE_ARMOR_ROWS = { 1: [0.83, 0.93], 2: [0.81, 0.93], 3: [0.86, 0.92], 4: [0.78, 0.9], 5: [0.73, 0.87], 6: [0.65, 0.84], 7: [0.58, 0.81], 8: [0.51, 0.76], 9: [0.42, 0.65], 10: [0.35, 0.56] };
export const PCAAO_REDUCTION_ROWS = Object.freeze({ UNARMED_ROWS, BLUNT_ROWS, EDGED_ROWS, SHIELD_UNARMED_ROWS, SHIELD_BLUNT_ROWS, SHIELD_EDGED_ROWS, AVERAGE_SHIELD_ROWS, AVERAGE_ARMOR_ROWS });

const condOf = (item, modules) => (modules.conditionBasedEffectiveness ? pcaaoAlterArmorReducBasedOnItemCondition(item) : 1);

/** ShieldDamageReductionCalculation: the blocking shield's row, by the
 *  attack's kind. */
export function pcaaoShieldDamageReductionCalculation(shield, shieldMaterial, atkStrength, damage, bluntWep, wepWeight, unarmedCheck, naturalDamResist, modules) {
  const cond = condOf(shield, modules);
  const rows = unarmedCheck ? SHIELD_UNARMED_ROWS : bluntWep ? SHIELD_BLUNT_ROWS : SHIELD_EDGED_ROWS;
  return table(rows, shieldMaterial, damage, cond, naturalDamResist);
}
/** PercentageReductionCalculationWithUnarmed: a fist against a piece
 *  (or the blocking shield). */
export function pcaaoPercentageReductionCalculationWithUnarmed(item, armorMaterial, atkStrength, damage, shieldCheck, naturalDamResist, modules) {
  if (shieldCheck) return pcaaoShieldDamageReductionCalculation(item, armorMaterial, atkStrength, damage, false, 1, true, naturalDamResist, modules);
  return table(UNARMED_ROWS, armorMaterial, damage, condOf(item, modules), naturalDamResist);
}
/** PercentageReductionCalculationWithWeapon: a weapon against a piece
 *  (or the blocking shield) - blunt and edged read different rows. */
export function pcaaoPercentageReductionCalculationWithWeapon(item, armorMaterial, atkStrength, damage, bluntWep, wepWeight, shieldCheck, naturalDamResist, modules) {
  if (shieldCheck) return pcaaoShieldDamageReductionCalculation(item, armorMaterial, atkStrength, damage, bluntWep, wepWeight, false, naturalDamResist, modules);
  return table(bluntWep ? BLUNT_ROWS : EDGED_ROWS, armorMaterial, damage, condOf(item, modules), naturalDamResist);
}
/** PercentageReductionAverage: the shield-or-under-armour comparison's
 *  yardstick, over a nominal 100. */
export function pcaaoPercentageReductionAverage(item, armorMaterial, damage, naturalDamResist, shieldQuickCheck, modules) {
  return table(shieldQuickCheck ? AVERAGE_SHIELD_ROWS : AVERAGE_ARMOR_ROWS, armorMaterial, damage, condOf(item, modules), naturalDamResist);
}
/** CalculateArmorDamageReductionWithWeapon / ...WithUnarmed: the
 *  blocking shield, else the struck part's piece, else the natural
 *  resistance alone. */
export function pcaaoArmorDamageReductionWithWeapon(attacker, target, damage, weapon, struckBodyPart, naturalDamResist, modules) {
  const liveStrength = stat(attacker, 'strength');
  let bluntWep = false, wepWeight = 1;
  if (weaponSkillOf(weapon) === SKILLS.BluntWeapon) { bluntWep = true; wepWeight = Math.ceil(effectiveUnitWeightInKg(weapon)); }
  if (shieldBlockSuccess) {
    const shield = leftHandItem(target);
    return pcaaoPercentageReductionCalculationWithWeapon(shield, pcaaoArmorMaterialIdentifier(shield), liveStrength, damage, bluntWep, wepWeight, true, naturalDamResist, modules);
  }
  const armor = struckSlotItem(target, struckBodyPart);
  if (armor) return pcaaoPercentageReductionCalculationWithWeapon(armor, pcaaoArmorMaterialIdentifier(armor), liveStrength, damage, bluntWep, wepWeight, false, naturalDamResist, modules);
  return unityRound(F(damage * F(1 - naturalDamResist)));
}
export function pcaaoArmorDamageReductionWithUnarmed(attacker, target, damage, struckBodyPart, naturalDamResist, modules) {
  const liveStrength = stat(attacker, 'strength');
  if (shieldBlockSuccess) {
    const shield = leftHandItem(target);
    return pcaaoPercentageReductionCalculationWithUnarmed(shield, pcaaoArmorMaterialIdentifier(shield), liveStrength, damage, true, naturalDamResist, modules);
  }
  const armor = struckSlotItem(target, struckBodyPart);
  if (armor) return pcaaoPercentageReductionCalculationWithUnarmed(armor, pcaaoArmorMaterialIdentifier(armor), liveStrength, damage, false, naturalDamResist, modules);
  return unityRound(F(damage * F(1 - naturalDamResist)));
}

/** PercentageReductionCalculationForMonsters: the innate hide of a
 *  monster that wears nothing on the struck part - the C# switches on
 *  `enemyGroup + 1`: Animals 1.0; Undead - the Skeletal Warrior 0.8;
 *  Humanoid - the Gargoyle 1.21 blunt / 0.71 else, the Spriggan 0.66
 *  blunt / 1.26 else; Daedra - the Daedroth 0.95, the Fire Daedra 1,
 *  the Frost Daedra 1.04 blunt / 0.84, the Daedra Lord 0.95; None -
 *  the Ice Atronach 1.4 blunt / 1, the Iron Atronach 0.6 blunt / 0.9.
 *  Each less the natural resistance, rounded half to even. */
export function pcaaoPercentageReductionCalculationForMonsters(attacker, target, damage, bluntWep, naturalDamResist) {
  const r = (m) => unityRound(F(damage * F(F(m) - naturalDamResist)));
  const c = target.careerIndex;
  switch (enemyEntityGroup(c)) {
    case ENEMY_GROUPS.Animals: return r(1);
    case ENEMY_GROUPS.Undead: return c === 15 ? r(0.8) : r(1);
    case ENEMY_GROUPS.Humanoid:
      if (c === 22) return bluntWep ? r(1.21) : r(0.71);
      if (c === 2) return bluntWep ? r(0.66) : r(1.26);
      return r(1);
    case ENEMY_GROUPS.Daedra:
      if (c === 27) return r(0.95);
      if (c === 26) return r(1);
      if (c === 25) return bluntWep ? r(1.04) : r(0.84);
      if (c === 31) return r(0.95);
      return r(1);
    case ENEMY_GROUPS.None:
      if (c === 38) return bluntWep ? r(1.4) : r(1);
      if (c === 36) return bluntWep ? r(0.6) : r(0.9);
      return r(1);
    default: return r(1);
  }
}

/** SpecialWeaponCheckForMonsters + MonsterWeaponAssign: the seventeen
 *  monsters whose natural attack the overhaul treats as a WEAPON blow
 *  for the wear and the reduction - each assigned the weapon its
 *  sprite carries (a Skeletal Warrior's steel war axe, a Daedra Lord's
 *  daedric broadsword...). ItemBuilder.CreateWeapon(template, material). */
export const MONSTER_WEAPON = Object.freeze({
  15: [128, 1], 7: [119, 1], 12: [127, 4], 24: [127, 8], 27: [127, 8],
  21: [115, 6], 32: [115, 6], 33: [115, 6], 8: [122, 3], 16: [126, 1],
  22: [125, 1], 36: [124, 1], 38: [121, 3], 23: [119, 5], 25: [126, 9],
  26: [118, 9], 31: [118, 9],
});
export const SPECIAL_WEAPON_MONSTERS = Object.freeze([7, 8, 12, 15, 16, 21, 22, 23, 24, 25, 26, 27, 31, 32, 33, 36, 38]);
export const pcaaoSpecialWeaponCheckForMonsters = (attacker) => SPECIAL_WEAPON_MONSTERS.includes(attacker?.careerIndex);
export function pcaaoMonsterWeaponAssign(attacker, rolls = Math.random) {
  const row = MONSTER_WEAPON[attacker?.careerIndex];
  return row ? createWeapon(row[0], row[1], rolls) : null;
}

/** ArmorStruckVerification: did the blow land on the shield, or on a
 *  piece. */
export function pcaaoArmorStruckVerification(target, struckBodyPart) {
  if (shieldBlockSuccess) return true;
  return !!struckSlotItem(target, struckBodyPart);
}

/** ShieldBlockChanceCalculation: a strong spot (a part the shield
 *  covers) blocks at the shield's base chance bent by the six stats,
 *  a weak spot at its smaller one; both `Mathf.Clamp` calls (7..95 and
 *  0..50) are computed and discarded by the C#. Buckler 30/20, Round 35/10, Kite 45/5, Tower
 *  55/-5, anything else in the hand 40/0. */
export function pcaaoShieldBlockChanceCalculation(target, shieldStrongSpot, shield, rolls) {
  let strong = 0, weak = 0;
  const d = (k) => stat(target, k) - 50;
  const agi = d('agility'), spd = d('speed'), str = d('strength'), end = d('endurance'), wil = d('willpower'), luk = d('luck');
  switch (shield.templateIndex) {
    case 109: strong = 30; weak = 20; break;
    case 110: strong = 35; weak = 10; break;
    case 111: strong = 45; weak = 5; break;
    case 112: strong = 55; weak = -5; break;
    default: strong = 40; weak = 0; break;
  }
  if (shieldStrongSpot) {
    let n = F(strong);
    n = F(n + F(agi * F(0.3))); n = F(n + F(spd * F(0.3))); n = F(n + F(str * F(0.3)));
    n = F(n + F(end * F(0.2))); n = F(n + F(wil * F(0.1))); n = F(n + F(luk * F(0.1)));
    return dice100(unityRound(n), rolls());
  }
  let n = F(weak);
  n = F(n + F(agi * F(0.3))); n = F(n + F(spd * F(0.2))); n = F(n + F(str * F(0.2)));
  n = F(n + F(end * F(0.1))); n = F(n + F(wil * F(0.1))); n = F(n + F(luk * F(0.1)));
  return dice100(unityRound(n), rolls());
}
/** CompareShieldToUnderArmor: the shield reduces only when its average
 *  reduction over 100 is at least as good as the piece under it
 *  (bare skin reduces by the natural resistance alone). */
export function pcaaoCompareShieldToUnderArmor(target, struckBodyPart, naturalDamResist, modules) {
  const shield = leftHandItem(target);
  const shieldReduced = pcaaoPercentageReductionAverage(shield, pcaaoArmorMaterialIdentifier(shield), 100, naturalDamResist, true, modules);
  const under = struckSlotItem(target, struckBodyPart);
  const underReduced = under
    ? pcaaoPercentageReductionAverage(under, pcaaoArmorMaterialIdentifier(under), 100, naturalDamResist, false, modules)
    : unityRound(F(100 * F(1 - naturalDamResist)));
  return shieldReduced <= underReduced;
}

/** The natural damage resistance: endurance x0.002, strength x0.001,
 *  willpower x0.001 above 50, float32 - and `Mathf.Clamp(-0.2, 0.2)`
 *  computed and discarded. */
export function pcaaoNaturalDamageResistance(target) {
  let n = F((stat(target, 'endurance') - 50) * F(0.002));
  n = F(n + F((stat(target, 'strength') - 50) * F(0.001)));
  n = F(n + F((stat(target, 'willpower') - 50) * F(0.001)));
  return n;
}

// ── CalculateAttackDamage, the overhaul ───────────────────────────
/**
 * The mod's CalculateAttackDamage(attacker, target, enemyAnimStateRecord,
 * weaponAnimTime, weapon), on the port's option bag: `damageMod` and
 * `toHitMod` are the caller's swing modifiers (the mod's own table is
 * DFU's), `backstabChance` the caller's CalculateBackstabChance (the
 * tally inside it already taken), `weaponAnimTime` the bow's draw in
 * milliseconds. Returns the damage the port's tail then carries on.
 * `notes` is the HUD's report (hit / critical / backstab /
 * ineffective), written as the C# decides each.
 */
export function pcaaoAttackDamage(attacker, target, {
  weapon: weaponIn = null, damageMod = 0, toHitMod = 0, backstabChance = 0, weaponAnimTime = 0,
  rolls = Math.random, dfRand = () => Math.floor(Math.random() * 32768), onMonsterHit = null, onInflictPoison = null,
  say = null, playerReflexes = null, notes = null, modules = pcaaoModules(),
} = {}) {
  if (!attacker || !target) return 0;
  let weapon = weaponIn;
  let damageModifiers = 0, damage = 0, chanceToHitMod = 0, backstab = 0;
  let skillID = 0;
  let unarmedAttack = false, weaponAttack = false, bluntWep = false, critSuccess = false;
  let critDamMulti = F(1), critHitAddi = 0, matReqDamMulti = F(1);
  const player = isPlayer(attacker) ? attacker : (isPlayer(target) ? target : null);
  const AITarget = isPlayer(target) ? null : target;
  const AIAttacker = isPlayer(attacker) ? null : attacker;
  // an enemy's weapon loses to its own natural attack when that averages higher
  if (AIAttacker && weapon) {
    const wepAvg = int((weaponMinDamage(weapon.templateIndex) + weaponMaxDamage(weapon.templateIndex)) / 2);
    const b = AIAttacker.basics ?? {};
    if (int(((b.minDamage ?? 0) + (b.maxDamage ?? 0)) / 2) > wepAvg) weapon = null;
  }
  if (weapon) {
    if (modules.softMaterialRequirements) {
      if ((target.minMetalToHit ?? -1) > weapon.material) {
        let m = F((target.minMetalToHit ?? -1) - weapon.material);
        m = m <= 0 ? F(1) : F(F(Math.min(F(m * F(0.2)), F(0.9)) - 1) * -1);
        matReqDamMulti = m;
      }
      skillID = weaponSkillOf(weapon);
      if (skillID === SKILLS.BluntWeapon) bluntWep = true;
    } else {
      if ((target.minMetalToHit ?? -1) > weapon.material) {
        if (isPlayer(attacker)) say?.(MATERIAL_INEFFECTIVE_TEXT);
        if (notes) notes.ineffective = true;
        return 0;
      }
      skillID = weaponSkillOf(weapon);
      if (skillID === SKILLS.BluntWeapon) bluntWep = true;
    }
  } else {
    skillID = SKILLS.HandToHand;
  }
  chanceToHitMod = isPlayer(attacker) ? Math.ceil(F(skill(attacker, skillID) * F(1.5))) : skill(attacker, skillID);
  if (modules.criticalStrikesIncreaseDamage) {
    critSuccess = pcaaoCriticalStrike(attacker, rolls);
    if (critSuccess) {
      const crit = skill(attacker, SKILLS.CriticalStrike);
      if (isPlayer(attacker)) {
        critDamMulti = F(F(int(crit / 5) * F(0.05)) + 1);
        critHitAddi = int(crit / 4);
      } else {
        critDamMulti = F(F(int(crit / 5) * F(0.025)) + 1);
        critHitAddi = int(crit / 10);
      }
      chanceToHitMod += critHitAddi;
      if (notes) notes.critical = true;
    }
  }
  if (isPlayer(attacker)) {
    damageModifiers += damageMod;   // CalculateSwingModifiers(ScreenWeapon)
    chanceToHitMod += toHitMod;
    const prof = pcaaoProficiencyModifiers(attacker, weapon);
    damageModifiers += prof.damageMod; chanceToHitMod += prof.toHitMod;
    const racial = pcaaoRacialModifiers(attacker, weapon, attacker);
    damageModifiers += racial.damageMod; chanceToHitMod += racial.toHitMod;
    backstab = backstabChance;   // CalculateBackstabChance(player, null, enemyAnimStateRecord)
    chanceToHitMod += backstab;
  }
  const struckBodyPart = pcaaoStruckBodyPart(rolls());
  const backstabbed = (before, after) => { if (notes && before > 0 && after === before * 3) notes.backstab = true; };
  if (skillID === SKILLS.HandToHand) {
    unarmedAttack = true;
    if (isPlayer(attacker) || isClassEnemy(AIAttacker)) {
      if (pcaaoSuccessfulHit(attacker, target, chanceToHitMod, struckBodyPart, rolls, modules, notes)) {
        if (notes) notes.hit = true;
        damage = pcaaoHandToHandAttackDamage(attacker, target, damageModifiers, isPlayer(attacker), rolls);
        const before = damage;
        damage = pcaaoBackstabDamage(damage, backstab, rolls, say);
        backstabbed(before, damage);
      }
    } else if (AIAttacker) {
      if (pcaaoSpecialWeaponCheckForMonsters(attacker)) {
        unarmedAttack = false;
        weaponAttack = true;
        weapon = pcaaoMonsterWeaponAssign(attacker, rolls);
        skillID = weaponSkillOf(weapon);
        if (skillID === SKILLS.BluntWeapon) bluntWep = true;
      }
      const b = AIAttacker.basics ?? {};
      const spans = [[b.minDamage ?? 0, b.maxDamage ?? 0], [b.minDamage2 ?? 0, b.maxDamage2 ?? 0], [b.minDamage3 ?? 0, b.maxDamage3 ?? 0]];
      const reflexes = playerReflexes ?? (isPlayer(target) ? target.reflexes : null) ?? 2;
      const reflexesChance = 50 - 10 * (reflexes - 2);
      for (const [min, max] of spans) {
        if (dfRand() % 100 < reflexesChance && min > 0 && pcaaoSuccessfulHit(attacker, target, chanceToHitMod, struckBodyPart, rolls, modules, notes)) {
          if (notes) notes.hit = true;
          const hit = range(min, max, rolls);
          if (hit > 0 && onMonsterHit) onMonsterHit(attacker, target, hit);
          damage += hit;
        }
      }
      if (damage >= 1) damage = pcaaoHandToHandAttackDamage(attacker, target, damage, false, rolls);
    }
  } else if (weapon) {
    weaponAttack = true;
    chanceToHitMod += pcaaoWeaponToHit(weapon);
    if (modules.rolePlayRealismArchery) chanceToHitMod = pcaaoAdjustWeaponHitChanceMod(attacker, target, chanceToHitMod, weaponAnimTime, weapon);
    if (pcaaoSuccessfulHit(attacker, target, chanceToHitMod, struckBodyPart, rolls, modules, notes)) {
      if (notes) notes.hit = true;
      damage = pcaaoWeaponAttackDamage(attacker, target, damageModifiers, weaponAnimTime, weapon, rolls, modules);
      const before = damage;
      damage = pcaaoBackstabDamage(damage, backstab, rolls, say);
      backstabbed(before, damage);
    }
    if (damage > 0 && (weapon.poisonType ?? -1) !== -1) {
      if (onInflictPoison) onInflictPoison(attacker, target, weapon.poisonType);
      weapon.poisonType = -1;
    }
  }
  damage = Math.max(0, damage);
  if (critSuccess) damage = unityRound(F(damage * critDamMulti));
  const preMatReq = F(damage);
  damage = unityRound(F(damage * matReqDamMulti));
  const postMatReq = F(damage);
  if (modules.softMaterialRequirements && isPlayer(attacker) && preMatReq > 0 && F(postMatReq / preMatReq) <= F(0.45)) {
    say?.('This Weapon Is Not Very Effective Against This Creature.', 1);
  }
  const naturalDamResist = pcaaoNaturalDamageResistance(target);
  const shield = leftHandItem(target);
  let shieldStrongSpot = false;
  shieldBlockSuccess = false;
  if (shield) {
    for (const part of SHIELD_PARTS.get(shield.templateIndex) ?? []) {
      if (shieldStrongSpot) break;
      if (part === struckBodyPart) shieldStrongSpot = true;
    }
    shieldBlockSuccess = pcaaoShieldBlockChanceCalculation(target, shieldStrongSpot, shield, rolls);
    if (shieldBlockSuccess) shieldBlockSuccess = pcaaoCompareShieldToUnderArmor(target, struckBodyPart, naturalDamResist, modules);
  }
  if (modules.conditionBasedEffectiveness && isPlayer(attacker) && weapon) {
    damage = pcaaoAlterDamageBasedOnWepCondition(damage, bluntWep, weapon);
  }
  if (damage < 1) return damage;
  // The CLASS's own DamageEquipment (`DamageEquipment(attacker, target,
  // num2, weapon, num10)` - the static, not FormulaHelper's), so the
  // overhaul always wears gear its way, PRE-reduction, whatever the
  // equipmentDamageEnhanced switch registered for DFU's own path.
  pcaaoDamageEquipment(attacker, target, damage, weapon, struckBodyPart, { rolls, say, modules });
  if (AITarget && isMonster(AITarget)) {
    if (!pcaaoArmorStruckVerification(target, struckBodyPart)) damage = pcaaoPercentageReductionCalculationForMonsters(attacker, target, damage, bluntWep, naturalDamResist);
    else if (unarmedAttack) damage = pcaaoArmorDamageReductionWithUnarmed(attacker, target, damage, struckBodyPart, naturalDamResist, modules);
    else if (weaponAttack) damage = pcaaoArmorDamageReductionWithWeapon(attacker, target, damage, weapon, struckBodyPart, naturalDamResist, modules);
  } else if (unarmedAttack) {
    damage = pcaaoArmorDamageReductionWithUnarmed(attacker, target, damage, struckBodyPart, naturalDamResist, modules);
  } else if (weaponAttack) {
    damage = pcaaoArmorDamageReductionWithWeapon(attacker, target, damage, weapon, struckBodyPart, naturalDamResist, modules);
  }
  // The Ring of Namira's payload (the C# dispatches it here for an
  // enemy's blow on the player) is the port's struck hook at the tail
  // of formulas.calculateAttackDamage, fed this very damage.
  return damage;
}

// ── RegisterOverride ──────────────────────────────────────────────
/** InitMod: the three FormulaHelper members the mod registers, each
 *  reading its module switch live and declining (undefined) when it is
 *  off, so the stock member stands. Idempotent; `read` for tests. */
export function installPcaao({ read = null } = {}) {
  const modules = () => (read ? pcaaoModules(read) : pcaaoModules());
  registerFormulaOverride('damageModifier', (strength) => (modules().fixedStrengthDamageModifier ? pcaaoDamageModifier(strength) : undefined));
  registerFormulaOverride('damageEquipment', (attacker, target, damage, weapon, struckBodyPart, opts = {}) => {
    const m = modules();
    if (!m.equipmentDamageEnhanced) return undefined;
    pcaaoDamageEquipment(attacker, target, damage, weapon, struckBodyPart, { ...opts, modules: m });
    return false;
  });
  registerFormulaOverride('calculateAttackDamage', (attacker, target, opts = {}) => {
    const m = modules();
    if (!m.armorHitFormulaRedone) return undefined;
    return pcaaoAttackDamage(attacker, target, { ...opts, modules: m });
  });
  // AUDIT PCO1: InitMod's archery arm registers AdjustWeaponHitChanceMod
  // and AdjustWeaponAttackDamage on FormulaHelper whatever the armour
  // module says, so DFU's STOCK CalculateAttackDamage bends a bow's hit
  // and damage by the draw when the redone formula is off. The port's
  // stock path consults these two names (formulas.js); the overhaul's
  // own core reads the switch directly.
  registerFormulaOverride('adjustWeaponHitChanceMod', (attacker, target, hitChanceMod, weaponAnimTime, weapon) =>
    (modules().rolePlayRealismArchery ? pcaaoAdjustWeaponHitChanceMod(attacker, target, hitChanceMod, weaponAnimTime, weapon) : undefined));
  registerFormulaOverride('adjustWeaponAttackDamage', (attacker, target, damage, weaponAnimTime, weapon) =>
    (modules().rolePlayRealismArchery ? pcaaoAdjustWeaponAttackDamage(attacker, target, damage, weaponAnimTime, weapon) : undefined));
  return true;
}
export function uninstallPcaao() {
  registerFormulaOverride('damageModifier', null);
  registerFormulaOverride('damageEquipment', null);
  registerFormulaOverride('calculateAttackDamage', null);
  registerFormulaOverride('adjustWeaponHitChanceMod', null);
  registerFormulaOverride('adjustWeaponAttackDamage', null);
}
