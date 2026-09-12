// PCO1 - PHYSICAL COMBAT AND ARMOR OVERHAUL 1.44, THE MOD, 1:1
// (2026-09-12, Mac: "I want to implement this as our next integrated
// mod. The goal is 1:1 with complete parity").
//
// What is pinned: the module ladder InitMod decides; Unity's half-to-
// even round; every hit helper against a hand-worked cell of the C#;
// the damage helpers (strength /10, the silver six, the two-handed
// doubling, the material +2 hit bonus); Roleplay Realism's archery
// tables; the condition bands; the four material ladders; the wear
// (weapon, armour, shield, the fading removal, the warnings); the
// reduction tables through float32 and half-to-even; the monsters'
// hides; the shield block and the shield-versus-under-armour test; the
// registry (a declined override leaves DFU's formula standing, an
// accepted one replaces it); the Meaner Monsters row; and the seams
// (the bow's draw timer, the arrow's hand-off, worldTick's install,
// the Mods pane entry, the credit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pcaaoModules, unityRound, pcaaoDamageModifier, pcaaoWeaponToHit, pcaaoArmorToHit, pcaaoAdrenalineRushToHit,
  pcaaoStatDiffsToHit, pcaaoSkillsToHit, pcaaoAdjustmentsToHit, pcaaoSuccessfulHit, PCAAO_BODY_PARTS, pcaaoStruckBodyPart,
  pcaaoCriticalStrike, pcaaoBonusOrPenaltyByEnemyType, pcaaoHandToHandAttackDamage, pcaaoWeaponAttackDamage,
  pcaaoAdjustWeaponHitChanceMod, pcaaoAdjustWeaponAttackDamage, pcaaoAlterDamageBasedOnWepCondition,
  pcaaoAlterArmorReducBasedOnItemCondition, pcaaoArmorMaterialIdentifier, pcaaoArmorMaterialModifierFinder,
  pcaaoEqualizeMaterialConditions, pcaaoSpecificWeaponConditionDamage, pcaaoMaterialDifferenceDamageCalculation,
  pcaaoDamageEquipment, pcaaoWarningMessagePlayerEquipmentCondition, pcaaoPercentageReductionCalculationWithUnarmed,
  pcaaoPercentageReductionCalculationWithWeapon, pcaaoShieldDamageReductionCalculation, pcaaoPercentageReductionAverage,
  pcaaoPercentageReductionCalculationForMonsters, SPECIAL_WEAPON_MONSTERS, MONSTER_WEAPON, pcaaoMonsterWeaponAssign,
  pcaaoShieldBlockChanceCalculation, pcaaoCompareShieldToUnderArmor, pcaaoNaturalDamageResistance, pcaaoAttackDamage,
  pcaaoProficiencyModifiers, pcaaoRacialModifiers, installPcaao, uninstallPcaao, SILVER_DOUBLED_CAREERS, PCAAO_REDUCTION_ROWS,
  MEANER_MONSTERS, meanerMonstersRow, _shieldBlockSuccess,
} from '../src/combat/pcaao.js';
import { calculateAttackDamage, damageModifier, damageEquipment, formulaOverride, registerFormulaOverride, adjustWeaponHitChanceMod, adjustWeaponAttackDamage, weaponAttackDamage } from '../src/combat/formulas.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { EQUIP_SLOTS, equipTableOf } from '../src/systems/equip.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { CREDITS } from '../src/ui/credits.js';
import { SKILLS } from '../src/systems/skills.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ALL_ON = { Enabled: true, equipmentDamageEnhanced: true, fadingEnchantedItems: true, fixedStrengthDamageModifier: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: true, softMaterialRequirements: true, rolePlayRealismArchery: false, meanerMonsters: false };
const modsOf = (over = {}) => pcaaoModules((k) => ({ ...ALL_ON, ...over })[k]);
const M = modsOf();
const stats = (o = {}) => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, ...o });
const skillsAll = (v) => Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v]));
const mkPlayer = (o = {}) => ({ isPlayer: true, level: 5, raceId: 1, stats: stats(), skills: skillsAll(40), career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, health: 50, maxHealth: 60, items: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0, ...o });
const career = (o = {}) => ({ ...stats(), attackModifierFlags: 0, ...o });
const monster = (id, o = {}) => ({ ...makeEnemyEntity(id, ENEMY_BASICS[id], career(), 5, () => 0.5), ...o });
const classEnemy = (id, o = {}) => ({ ...makeEnemyEntity(128 + id, ENEMY_BASICS[128 + id], career(), 5, () => 0.5), ...o });
const fixed = (v) => () => v;
const wear = (item, table, slot) => { table[slot] = item; return item; };

test('PCO1: InitMod\'s ladder - the dependent modules stand down with their parent, and nothing stands with Enabled off', () => {
  assert.deepEqual({ ...M }, { enabled: true, equipmentDamageEnhanced: true, fadingEnchantedItems: true, fixedStrengthDamageModifier: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: true, softMaterialRequirements: true, rolePlayRealismArchery: false, meanerMonsters: false });
  const noArmor = modsOf({ armorHitFormulaRedone: false });
  assert.equal(noArmor.criticalStrikesIncreaseDamage, false); assert.equal(noArmor.conditionBasedEffectiveness, false); assert.equal(noArmor.softMaterialRequirements, false);
  assert.equal(noArmor.equipmentDamageEnhanced, true, 'the wear module is independent');
  assert.equal(modsOf({ equipmentDamageEnhanced: false }).fadingEnchantedItems, false, 'fading rides enhanced wear');
  const off = modsOf({ Enabled: false });
  assert.ok(Object.entries(off).every(([k, v]) => v === false), `nothing on: ${JSON.stringify(off)}`);
  assert.equal(modsOf({ meanerMonsters: true }).meanerMonsters, true);
});

test('PCO1: Mathf.Round rounds half to EVEN, and a float32 half lands where the C#\'s lands', () => {
  assert.deepEqual([2.5, 3.5, -2.5, 0.5, 1.5, 2.4999, 2.5001].map(unityRound), [2, 4, -2, 0, 2, 2, 3]);
  // 15 x 0.9f is 13.5f in single precision (0.9f is 0.8999999761...), and Mathf.Round(13.5f) is 14
  assert.equal(pcaaoPercentageReductionCalculationWithUnarmed({ group: 'Armor', templateIndex: 103, material: 0 }, 1, 50, 15, false, 0, modsOf({ conditionBasedEffectiveness: false })), 14);
});

test('PCO1: DamageModifier is ten points a point, and the weapon\'s hit bonus is material x2 + 2 ("+14, not +60")', () => {
  assert.equal(pcaaoDamageModifier(60), 1); assert.equal(pcaaoDamageModifier(50), 0); assert.equal(pcaaoDamageModifier(45), -1); assert.equal(pcaaoDamageModifier(100), 5);
  assert.equal(pcaaoWeaponToHit({ material: 9 }), 14); assert.equal(pcaaoWeaponToHit({ material: 0 }), 0); assert.equal(pcaaoWeaponToHit({ material: 1 }), 2);
});

test('PCO1: the hit\'s helpers - armour, adrenaline, stat diffs, skills, adjustments', () => {
  const p = mkPlayer(); const mon = monster(0); const cls = classEnemy(17);
  assert.equal(pcaaoArmorToHit(p, 3), 100, 'the player: 100 less the enchantment channels, whatever the part');
  assert.equal(pcaaoArmorToHit(cls, 3), 60, 'a class enemy: a flat 60');
  mon.armorValues = [10, 20, 30, 40, 50, 60, 70];
  assert.equal(pcaaoArmorToHit(mon, 4), 50, 'a monster: its part');
  const rusher = mkPlayer({ career: { abilityFlagsAndSpellPointsBitfield: 4 }, health: 9, maxHealth: 60 });
  assert.equal(pcaaoAdrenalineRushToHit(rusher, p), 8, 'below a SIXTH of max health: +8');
  assert.equal(pcaaoAdrenalineRushToHit(p, rusher), -8);
  assert.equal(pcaaoAdrenalineRushToHit(mkPlayer({ career: { abilityFlagsAndSpellPointsBitfield: 4 }, health: 10, maxHealth: 60 }), p), 0, 'at a sixth exactly, not below');
  const a = mkPlayer({ stats: stats({ luck: 60 }) }); const t1 = mkPlayer({ stats: stats({ luck: 45 }) }); const t2 = mkPlayer({ stats: stats({ luck: 65 }) });
  assert.equal(pcaaoStatDiffsToHit(a, t1), 1, 'luck +15 -> +1; the target\'s -5 rounds -0.5 to even, 0');
  assert.equal(pcaaoStatDiffsToHit(a, t2), -2, 'luck -5 -> 0 (truncated toward zero); the target\'s +15 rounds 1.5 to 2');
  assert.equal(pcaaoStatDiffsToHit(mkPlayer({ stats: stats({ agility: 70, speed: 66 }) }), p), 5 + 2, 'agility /4, speed /8');
  const dodger = mkPlayer({ skills: skillsAll(50) });
  assert.equal(pcaaoSkillsToHit(p, dodger, fixed(0.99), M), -25, 'dodging HALVED, and no crit roll under the crit module');
  const critter = mkPlayer({ skills: skillsAll(90) });
  assert.equal(pcaaoSkillsToHit(critter, dodger, fixed(0.1), modsOf({ criticalStrikesIncreaseDamage: false })), -25 + 30, 'without the module: the player rolls crit/3 (30) for +crit/3');
  const critMon = monster(0); critMon.skills = skillsAll(90);
  assert.equal(pcaaoSkillsToHit(critMon, dodger, fixed(0.5), modsOf({ criticalStrikesIncreaseDamage: false })), -25 + 9, 'a monster rolls crit for +crit/10');
  assert.equal(pcaaoAdjustmentsToHit(mkPlayer({ biographyAvoidHitMod: 5 })), -55);
  assert.equal(pcaaoAdjustmentsToHit(mon), 0, 'a monster: +50 - 50');
  assert.equal(pcaaoAdjustmentsToHit(cls), -50);
});

test('PCO1: CalculateSuccessfulHit is NOT clamped - the C# computes Mathf.Clamp(3, 97) and throws it away', () => {
  const p = mkPlayer(); const mon = monster(0);
  assert.equal(pcaaoSuccessfulHit(p, mon, 300, 3, fixed(0.999), M), true, 'a 300 lands on a 99 roll');
  assert.equal(pcaaoSuccessfulHit(p, mon, -300, 3, fixed(0.0), M), false, 'a -300 misses on a 0 roll');
  assert.deepEqual([...PCAAO_BODY_PARTS], [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6], 'feet likelier than the head, legs than the hands');
  assert.equal(pcaaoStruckBodyPart(0), 0); assert.equal(pcaaoStruckBodyPart(0.99), 6);
});

test('PCO1: CriticalStrikeHandler - luck bends the divisor, the clamp is discarded', () => {
  const lucky = mkPlayer({ stats: stats({ luck: 100 }), skills: skillsAll(100) });
  assert.equal(pcaaoCriticalStrike(lucky, fixed(0.49)), true, '100 crit, 100 luck: 100 / (4 - 2) = 50%');
  assert.equal(pcaaoCriticalStrike(lucky, fixed(0.5)), false);
  const plain = mkPlayer({ skills: skillsAll(100) });
  assert.equal(pcaaoCriticalStrike(plain, fixed(0.24)), true, '50 luck: 100 / 4 = 25%');
  assert.equal(pcaaoCriticalStrike(plain, fixed(0.25)), false);
  const mon = monster(0); mon.skills = skillsAll(90); mon.stats = stats({ luck: 100 });
  assert.equal(pcaaoCriticalStrike(mon, fixed(0.29)), true, 'a monster: 90 / (5 - 2) = 30%');
  assert.equal(pcaaoCriticalStrike(mon, fixed(0.3)), false);
});

test('PCO1: the mod\'s GetBonusOrPenaltyByEnemyType - willpower\'s random bonus, the level\'s penalty, the career\'s bits', () => {
  const p = mkPlayer({ stats: stats({ willpower: 60 }), career: { attackModifierFlags: 0x01 } });   // undead BONUS
  const skel = monster(15); skel.level = 4;
  assert.equal(pcaaoBonusOrPenaltyByEnemyType(p, skel, fixed(0.5)), 5, 'Range(0, 10 + 2 - 2 = 10) at a half roll: 5');
  const phobic = mkPlayer({ career: { attackModifierFlags: 0x10 } });   // undead PHOBIA
  skel.level = 12;
  assert.equal(pcaaoBonusOrPenaltyByEnemyType(phobic, skel, fixed(0.5)), -6, 'penalty = target level / 2 - will = 6');
  const rat = monster(0); rat.attackModifierFlags = 0x04; rat.level = 8; rat.stats = stats({ willpower: 40 });   // humanoid bonus vs the PLAYER (humanoid)
  assert.equal(pcaaoBonusOrPenaltyByEnemyType(rat, mkPlayer({ level: 3 }), fixed(0.5)), 2, 'an enemy: Range(0, 5 + (-2) + 2 = 5) -> 2');
  assert.equal(pcaaoBonusOrPenaltyByEnemyType(mkPlayer(), skel, fixed(0.5)), 0, 'no bit, nothing');
});

test('PCO1: the damage - hand-to-hand, the weapon roll, the silver six, the two-handed doubling', () => {
  const p = mkPlayer({ stats: stats({ strength: 60 }) });
  assert.equal(pcaaoHandToHandAttackDamage(p, monster(0), 0, true, fixed(0.5)), 7 + 1, 'skill 40: 5..9 at a half roll is 7, plus STR/10');
  assert.equal(pcaaoHandToHandAttackDamage(monster(0), p, 12, false, fixed(0.5)), 12, 'a monster: its summed attack damage');
  const sword = { group: 'Weapons', templateIndex: 120, material: 1, flags: 0 };
  assert.equal(pcaaoWeaponAttackDamage(p, monster(0), 0, 0, sword, fixed(0), M), 2 + 1 + 0, 'longsword 2 + STR 1 + steel 0');
  assert.equal(pcaaoWeaponAttackDamage(p, monster(15), 0, 0, sword, fixed(0), M), 1 + 1 + 0, 'the Skeletal Warrior halves an edged blow');
  const silver = { ...sword, material: 2 };
  for (const c of SILVER_DOUBLED_CAREERS) assert.equal(pcaaoWeaponAttackDamage(p, monster(c), 0, 0, silver, fixed(0), M), 4 + 1, `silver doubles against career ${c}`);
  assert.deepEqual([...SILVER_DOUBLED_CAREERS], [9, 18, 23, 28, 19, 14]);
  const claymore = { group: 'Weapons', templateIndex: 122, material: 1, flags: 0 };
  assert.equal(pcaaoWeaponAttackDamage(mkPlayer({ stats: stats({ strength: 70 }) }), monster(0), 0, 0, claymore, fixed(0), M), 2 + 2 * 2, 'two-handed: the strength term doubled');
  const bow = { group: 'Weapons', templateIndex: 130, material: 1, flags: 0 };
  assert.equal(pcaaoWeaponAttackDamage(mkPlayer({ stats: stats({ strength: 70 }) }), monster(0), 0, 0, bow, fixed(0), M), 4 + 2, 'a bow is two-handed and does NOT double');
});

test('PCO1: Roleplay Realism\'s archery, as baked in - the draw time\'s hit and damage tables', () => {
  const bow = { templateIndex: 130 };
  assert.deepEqual([100, 300, 700, 1500, 6000, 9000].map((t) => pcaaoAdjustWeaponHitChanceMod(null, null, 50, t, bow)), [10, 40, 50, 60, 40, 40], 'the > 8000 arm sits behind > 5000 and never fires');
  assert.equal(pcaaoAdjustWeaponHitChanceMod(null, null, 50, 100, { templateIndex: 120 }), 50, 'not a bow');
  assert.equal(pcaaoAdjustWeaponHitChanceMod(null, null, 50, 0, bow), 50, 'no draw time');
  assert.deepEqual([400, 2000, 5500, 7000, 8500, 9500].map((t) => pcaaoAdjustWeaponAttackDamage(null, null, 20, t, bow)), [10, 20, 17, 15, 10, 5]);
});

test('PCO1: the condition bands - a weapon\'s damage and a piece\'s reduction factor', () => {
  const at = (pct) => ({ maxCondition: 100, currentCondition: pct });
  assert.equal(pcaaoAlterDamageBasedOnWepCondition(10, false, at(95)), 13);
  assert.equal(pcaaoAlterDamageBasedOnWepCondition(10, true, at(95)), 11);
  assert.equal(pcaaoAlterDamageBasedOnWepCondition(10, false, at(70)), 10);
  assert.equal(pcaaoAlterDamageBasedOnWepCondition(10, false, at(3)), 2, '10 x 0.25 = 2.5, half to even');
  assert.equal(pcaaoAlterDamageBasedOnWepCondition(10, true, at(3)), 5);
  assert.equal(pcaaoAlterArmorReducBasedOnItemCondition(at(95)), Math.fround(0.85));
  assert.equal(pcaaoAlterArmorReducBasedOnItemCondition(at(3)), Math.fround(1.5));
  assert.equal(pcaaoAlterArmorReducBasedOnItemCondition(null), 1);
});

test('PCO1: the four material ladders', () => {
  const shield = (m) => ({ group: 'Armor', templateIndex: 111, material: m });
  assert.deepEqual([0, 0x100, 0x200, 0x201, 0x202, 0x203, 0x204, 0x205, 0x206, 0x207, 0x208, 0x209].map((m) => pcaaoArmorMaterialIdentifier(shield(m))), [1, 2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10]);
  assert.equal(pcaaoArmorMaterialIdentifier({ group: 'Armor', templateIndex: 103, material: 0x209 }), 10, 'a daedric piece: 21 / 2');
  assert.equal(pcaaoArmorMaterialIdentifier({ group: 'Armor', templateIndex: 103, material: 0x209, artifact: true }), 5, 'an armour artifact halves first');
  assert.equal(pcaaoArmorMaterialIdentifier(null), 1);
  assert.deepEqual([0, 0x100, 0x200, 0x201, 0x203, 0x204, 0x206, 0x207, 0x208, 0x209].map((m) => pcaaoArmorMaterialModifierFinder({ material: m })), [1, 2, 2, 3, 4, 5, 5, 6, 7, 8]);
  assert.deepEqual([0, 1, 2, 3, 9].map((m) => pcaaoEqualizeMaterialConditions({ material: m })), [1, 1, 1, 2, 8]);
  assert.deepEqual([0x200, 0x202, 0x203, 0x209].map((m) => pcaaoEqualizeMaterialConditions({ material: m })), [1, 1, 2, 8]);
  assert.deepEqual([1, 2, 5].map((v) => pcaaoSpecificWeaponConditionDamage({ templateIndex: 130 }, 9, v)), [1, 2, 3]);
  assert.deepEqual([1, 2].map((v) => pcaaoSpecificWeaponConditionDamage({ templateIndex: 129 }, 9, v)), [1, 2]);
  assert.equal(pcaaoSpecificWeaponConditionDamage({ templateIndex: 120 }, 9, 3), 9);
});

test('PCO1: MaterialDifferenceDamageCalculation - blunt by weight, edged by the difference', () => {
  const plate = { material: 0x203 };
  assert.equal(pcaaoMaterialDifferenceDamageCalculation(plate, -1, 60, 10, false, 1, false), 13, 'edged, one tier under: (10 x 2 + 6) / 2');
  assert.equal(pcaaoMaterialDifferenceDamageCalculation(plate, 0, 60, 10, false, 1, false), 8, 'equal: (10 + 6) / 2');
  assert.equal(pcaaoMaterialDifferenceDamageCalculation(plate, 2, 60, 10, false, 1, false), 3, 'two tiers over: (10 / 2 + 6) / 3');
  assert.equal(pcaaoMaterialDifferenceDamageCalculation(plate, 0, 60, 10, false, 1, true), 4, 'a shield takes a third');
  assert.equal(pcaaoMaterialDifferenceDamageCalculation(plate, 0, 60, 10, true, 8, false), 14, 'blunt, 7-9 kg: (10 x 3 + 12) / 3');
  assert.equal(pcaaoMaterialDifferenceDamageCalculation({ material: 0 }, 0, 60, 10, true, 2, false), 3, 'blunt on leather quarters, 1-3 kg: (2 + 12) / 4');
  assert.equal(pcaaoMaterialDifferenceDamageCalculation({ material: 0x100 }, 0, 60, 10, true, 40, false), 50, 'blunt on chain doubles, 36+ kg: (20 x 7 + 12) / 3');
});

test('PCO1: DamageEquipment - the weapon wears by its kind, the struck side by the difference, a fist wears the piece alone', () => {
  const p = mkPlayer({ stats: stats({ strength: 60 }) });
  const sword = { group: 'Weapons', templateIndex: 120, material: 1, flags: 0, maxCondition: 1000, currentCondition: 1000, name: 'Longsword' };
  const foe = classEnemy(17);
  const cuirass = wear({ group: 'Armor', templateIndex: 102, material: 0x203, maxCondition: 1000, currentCondition: 1000, name: 'Cuirass' }, equipTableOf(foe), EQUIP_SLOTS.ChestArmor);
  pcaaoDamageEquipment(p, foe, 10, sword, 3, { rolls: fixed(0.99), say: null, modules: M });
  // the sword: (10 x 1 + 6) / 1.2 -> ceil 14 -> 10 x 14 / 50 = 2
  assert.equal(sword.currentCondition, 998);
  // the cuirass: equalized x2 (elven) = 20; finder 4 less steel (0 + 2) = 2 tiers over: (20 / 2 + 6) / 3 = 5, doubled for a piece: 10
  assert.equal(cuirass.currentCondition, 990);
  const mace = { group: 'Weapons', templateIndex: 124, material: 1, flags: 0, maxCondition: 1000, currentCondition: 1000, name: 'Mace' };
  const cuirass2 = wear({ group: 'Armor', templateIndex: 102, material: 0x203, maxCondition: 1000, currentCondition: 1000 }, equipTableOf(foe), EQUIP_SLOTS.ChestArmor);
  pcaaoDamageEquipment(p, foe, 10, mace, 3, { rolls: fixed(0.99), say: null, modules: M });
  assert.equal(mace.currentCondition, 998, 'blunt: the same weapon arithmetic');
  assert.ok(cuirass2.currentCondition < 1000, 'and the piece wears by the mace\'s weight band');
  const shield = wear({ group: 'Armor', templateIndex: 111, material: 0x203, maxCondition: 1000, currentCondition: 1000 }, equipTableOf(foe), EQUIP_SLOTS.LeftHand);
  const before = shield.currentCondition;
  pcaaoDamageEquipment(p, foe, 10, null, 2, { rolls: fixed(0.99), say: null, modules: modsOf({ armorHitFormulaRedone: false }) });
  assert.ok(shield.currentCondition < before, 'without the overhaul, the shield covering the struck arm takes a fist');
  assert.equal(_shieldBlockSuccess(), true);
  assert.equal(pcaaoDamageEquipment(p, foe, 0, sword, 3, { modules: M }), false, 'no damage, nothing - and always false');
});

test('PCO1: the fading module DESTROYS the player\'s enchanted piece on breaking, and the warnings speak at 48, 15 and a 15-point blow', () => {
  const p = mkPlayer({ stats: stats({ strength: 60 }) });
  const ring = { group: 'Armor', templateIndex: 107, material: 0x201, maxCondition: 100, currentCondition: 1, name: 'Helm', enchantments: [{ type: 5, param: 1 }] };
  p.items.push(ring); wear(ring, equipTableOf(p), EQUIP_SLOTS.Head);
  const foe = classEnemy(17); foe.stats = stats({ strength: 60 });
  const sword = { group: 'Weapons', templateIndex: 120, material: 1, flags: 0, maxCondition: 1000, currentCondition: 1000 };
  const said = [];
  // without the overhaul's own roll, DamageEquipment decides the shield itself (none here)
  const wearOnly = modsOf({ armorHitFormulaRedone: false });
  pcaaoDamageEquipment(foe, p, 10, sword, 0, { rolls: fixed(0.99), say: (t) => said.push(t), modules: wearOnly });
  assert.equal(ring.currentCondition, 0); assert.equal(p.items.includes(ring), false, 'gone from the pack');
  assert.ok(said.some((t) => /has broken/.test(t)));
  const p2 = mkPlayer({ stats: stats({ strength: 60 }) });
  const ring2 = { ...ring, currentCondition: 1, enchantments: [{ type: 5, param: 1 }] };
  p2.items.push(ring2); wear(ring2, equipTableOf(p2), EQUIP_SLOTS.Head);
  pcaaoDamageEquipment(foe, p2, 10, sword, 0, { rolls: fixed(0.99), say: null, modules: modsOf({ armorHitFormulaRedone: false, fadingEnchantedItems: false }) });
  assert.equal(p2.items.includes(ring2), true, 'without fading it breaks and stays');
  const say = []; const s = (t, d) => say.push([t, d]);
  pcaaoWarningMessagePlayerEquipmentCondition({ templateIndex: 120, name: 'Longsword', maxCondition: 100, currentCondition: 48 }, 60, s);
  pcaaoWarningMessagePlayerEquipmentCondition({ templateIndex: 124, name: 'Mace', maxCondition: 100, currentCondition: 15 }, 20, s);
  pcaaoWarningMessagePlayerEquipmentCondition({ templateIndex: 130, name: 'Long Bow', maxCondition: 100, currentCondition: 40 }, 60, s);
  pcaaoWarningMessagePlayerEquipmentCondition({ templateIndex: 103, name: 'Boots', maxCondition: 100, currentCondition: 80 }, 82, s);
  assert.deepEqual(say, [['My Longsword Could Use A Sharpening', 2], ["My Mace's Shaft Is Nearly Split In Two", 2], ['The Bowstring On My Long Bow Nearly Snapped From That', 2]]);
});

test('PCO1: the reduction tables - a cell of each, the condition factor under its cap, the natural resistance subtracted', () => {
  const leather = { group: 'Armor', templateIndex: 103, material: 0, maxCondition: 100, currentCondition: 100 };
  const noCond = modsOf({ conditionBasedEffectiveness: false });
  assert.equal(pcaaoPercentageReductionCalculationWithUnarmed(leather, 1, 50, 10, false, 0, noCond), 9, 'unarmed on leather: x0.9');
  assert.equal(pcaaoPercentageReductionCalculationWithUnarmed(leather, 10, 50, 100, false, 0, noCond), 30, 'unarmed on daedric: x0.3');
  assert.equal(pcaaoPercentageReductionCalculationWithWeapon(leather, 1, 50, 100, true, 5, false, 0, noCond), 72, 'blunt on leather: x0.72');
  assert.equal(pcaaoPercentageReductionCalculationWithWeapon(leather, 1, 50, 100, false, 1, false, 0, noCond), 88, 'edged on leather: x0.88');
  assert.equal(pcaaoPercentageReductionCalculationWithWeapon(leather, 2, 50, 100, true, 5, false, 0, noCond), 88, 'blunt on chain: x0.88 - chain hates maces');
  assert.equal(pcaaoShieldDamageReductionCalculation(leather, 1, 50, 100, false, 1, true, 0, noCond), 59, 'a fist on a leather shield: x0.59');
  assert.equal(pcaaoShieldDamageReductionCalculation(leather, 10, 50, 100, true, 5, false, 0, noCond), 34, 'a mace on a daedric shield: x0.34');
  assert.equal(pcaaoShieldDamageReductionCalculation(leather, 10, 50, 100, false, 1, false, 0, noCond), 30, 'a blade on a daedric shield: x0.30');
  assert.equal(pcaaoPercentageReductionAverage(leather, 1, 100, 0, true, noCond), 68);
  assert.equal(pcaaoPercentageReductionAverage(leather, 1, 100, 0, false, noCond), 83);
  // a worn piece: the factor 1.5 pushes 0.9 to 1.35, capped at 0.95
  const rag = { ...leather, currentCondition: 3 };
  assert.equal(pcaaoPercentageReductionCalculationWithUnarmed(rag, 1, 50, 100, false, 0, M), 95, 'capped');
  // the natural resistance comes off the factor
  assert.equal(pcaaoPercentageReductionCalculationWithUnarmed(leather, 1, 50, 100, false, Math.fround(0.1), noCond), 80);
  assert.equal(Object.keys(PCAAO_REDUCTION_ROWS).length, 8);
  assert.equal(pcaaoPercentageReductionCalculationWithUnarmed(leather, 99, 50, 100, false, 0, noCond), 100, 'an unknown material reduces nothing');
});

test('PCO1: the monsters\' hides, and the seventeen that swing a weapon of their own', () => {
  const r = (id, blunt, dmg = 100) => pcaaoPercentageReductionCalculationForMonsters(null, monster(id), dmg, blunt, 0);
  assert.equal(r(15, false), 80, 'the Skeletal Warrior 0.8');
  assert.equal(r(22, true), 121, 'the Gargoyle: blunt 1.21'); assert.equal(r(22, false), 71);
  assert.equal(r(2, true), 66, 'the Spriggan: blunt 0.66'); assert.equal(r(2, false), 126);
  assert.equal(r(27, false), 95); assert.equal(r(26, true), 100); assert.equal(r(25, true), 104); assert.equal(r(25, false), 84); assert.equal(r(31, true), 95);
  assert.equal(r(38, true), 140, 'the Ice Atronach: blunt 1.4'); assert.equal(r(38, false), 100);
  assert.equal(r(36, true), 60, 'the Iron Atronach: blunt 0.6'); assert.equal(r(36, false), 90);
  assert.equal(r(0, true), 100, 'a rat: nothing'); assert.equal(r(17, true), 100, 'a zombie: nothing');
  assert.equal(r(22, true, 10), 12, '10 x 1.21f rounds to 12');
  assert.deepEqual([...SPECIAL_WEAPON_MONSTERS], [7, 8, 12, 15, 16, 21, 22, 23, 24, 25, 26, 27, 31, 32, 33, 36, 38]);
  assert.equal(Object.keys(MONSTER_WEAPON).length, 17);
  const axe = pcaaoMonsterWeaponAssign(monster(15));
  assert.equal(axe.templateIndex, 128); assert.equal(axe.material, 1, 'the Skeletal Warrior: a steel war axe');
  const sword = pcaaoMonsterWeaponAssign(monster(31));
  assert.equal(sword.templateIndex, 118); assert.equal(sword.material, 9, 'the Daedra Lord: a daedric broadsword');
  assert.equal(pcaaoMonsterWeaponAssign(monster(0)), null);
});

test('PCO1: the shield - its block chance by template and stats, and only when it beats the piece under it', () => {
  const t = mkPlayer();
  const kite = { group: 'Armor', templateIndex: 111, material: 0x203, maxCondition: 100, currentCondition: 100 };
  assert.equal(pcaaoShieldBlockChanceCalculation(t, true, kite, fixed(0.44)), true, 'a kite shield\'s strong spot: 45 at all-50 stats');
  assert.equal(pcaaoShieldBlockChanceCalculation(t, true, kite, fixed(0.45)), false);
  assert.equal(pcaaoShieldBlockChanceCalculation(t, false, kite, fixed(0.04)), true, 'its weak spot: 5');
  assert.equal(pcaaoShieldBlockChanceCalculation(t, false, kite, fixed(0.05)), false);
  const tower = { ...kite, templateIndex: 112 };
  assert.equal(pcaaoShieldBlockChanceCalculation(t, false, tower, fixed(0.0)), false, 'a tower shield\'s weak spot is -5: never');
  const nimble = mkPlayer({ stats: stats({ agility: 100, speed: 100 }) });
  assert.equal(pcaaoShieldBlockChanceCalculation(nimble, true, kite, fixed(0.74)), true, '45 + 15 + 15 = 75');
  assert.equal(pcaaoShieldBlockChanceCalculation(nimble, true, kite, fixed(0.75)), false);
  // versus the piece under it: a leather shield over a daedric helm loses, over bare skin wins
  const target = mkPlayer();
  wear({ group: 'Armor', templateIndex: 109, material: 0, maxCondition: 100, currentCondition: 100 }, equipTableOf(target), EQUIP_SLOTS.LeftHand);
  assert.equal(pcaaoCompareShieldToUnderArmor(target, 0, 0, M), true, 'bare head: the shield');
  wear({ group: 'Armor', templateIndex: 107, material: 0x209, maxCondition: 100, currentCondition: 100 }, equipTableOf(target), EQUIP_SLOTS.Head);
  assert.equal(pcaaoCompareShieldToUnderArmor(target, 0, 0, M), false, 'a daedric helm under a leather buckler: the helm');
  assert.equal(pcaaoNaturalDamageResistance(mkPlayer({ stats: stats({ endurance: 70, strength: 60, willpower: 55 }) })), Math.fround(Math.fround(Math.fround(20 * Math.fround(0.002)) + Math.fround(10 * Math.fround(0.001))) + Math.fround(5 * Math.fround(0.001))));
  // the +-0.2 clamp is computed and discarded - and moot: three stats of 100 reach exactly 0.2, three of 0 exactly -0.2
  const f = Math.fround;
  assert.equal(pcaaoNaturalDamageResistance(mkPlayer({ stats: stats({ endurance: 100, strength: 100, willpower: 100 }) })), f(f(f(50 * f(0.002)) + f(50 * f(0.001))) + f(50 * f(0.001))));
  assert.equal(pcaaoNaturalDamageResistance(mkPlayer({ stats: stats({ endurance: 0, strength: 0, willpower: 0 }) })), f(f(f(-50 * f(0.002)) + f(-50 * f(0.001))) + f(-50 * f(0.001))));
});

test('PCO1: proficiency and racial modifiers are stat-driven, on the C#\'s ladders', () => {
  const expertLong = mkPlayer({ stats: stats({ strength: 60, agility: 66 }), career: { weaponArmorShieldsBitfield: 2 << 16 } });
  const sword = { group: 'Weapons', templateIndex: 120, material: 1 };
  assert.deepEqual(pcaaoProficiencyModifiers(expertLong, sword), { damageMod: 3 + 1 + 1, toHitMod: 8 + 2 + 2 }, 'long blade: agi/20 + str/33 + 1; agi/8 + spd/20 + luck/20');
  assert.deepEqual(pcaaoProficiencyModifiers(mkPlayer(), sword), { damageMod: 0, toHitMod: 0 }, 'no expertise, nothing');
  const fists = mkPlayer({ career: { weaponArmorShieldsBitfield: 4 << 16 } });
  assert.deepEqual(pcaaoProficiencyModifiers(fists, null), { damageMod: 4 + 1, toHitMod: 10 });
  const darkElf = mkPlayer({ raceId: 4, stats: stats({ agility: 75 }) });
  assert.deepEqual(pcaaoRacialModifiers(darkElf, sword, darkElf), { damageMod: 3 + 2, toHitMod: 3 + 1 + 1 });
  assert.deepEqual(pcaaoRacialModifiers(darkElf, { group: 'Weapons', templateIndex: 113, material: 1 }, darkElf), { damageMod: 1 + 1, toHitMod: 2 + 1 + 1 }, 'the else-if arm: a short blade');
  assert.deepEqual(pcaaoRacialModifiers(darkElf, { group: 'Weapons', templateIndex: 130, material: 1 }, darkElf), { damageMod: 0, toHitMod: 0 }, 'a bow: nothing for a Dark Elf');
  const khajiit = mkPlayer({ raceId: 7 });
  assert.deepEqual(pcaaoRacialModifiers(khajiit, null, khajiit), { damageMod: 1 + 1 + 1 + 1, toHitMod: 2 + 1 + 1 + 1 + 1 }, 'bare hands: the Khajiit');
  assert.deepEqual(pcaaoRacialModifiers(mkPlayer({ raceId: 1 }), null, mkPlayer({ raceId: 1 })), { damageMod: 0, toHitMod: 0 });
});

test('PCO1: the whole blow - a sword through the overhaul, the monster loop with its assigned weapon, the soft material, the notes', () => {
  const p = mkPlayer({ stats: stats({ strength: 60 }) });
  const sword = { group: 'Weapons', templateIndex: 120, material: 1, flags: 0, maxCondition: 1000, currentCondition: 1000, name: 'Longsword' };
  const rat = monster(0);
  const notes = { hit: false, critical: false, backstab: false, ineffective: false };
  // rolls: crit roll (miss), struck part, hit roll(s), damage roll, backstab...
  const d = pcaaoAttackDamage(p, rat, { weapon: sword, rolls: fixed(0.5), dfRand: fixed(0), notes, modules: M });
  assert.ok(d > 0, `a landed blow does damage (${d})`);
  assert.equal(notes.hit, true);
  assert.ok(sword.currentCondition < 1000, 'and the sword wore, pre-reduction');
  // the soft material: an iron blade against a foe that wants silver takes a 60% cut rather than a refusal
  const iron = { group: 'Weapons', templateIndex: 120, material: 0, flags: 0, maxCondition: 1000, currentCondition: 1000 };
  const ghost = monster(18); ghost.minMetalToHit = 3;   // three tiers over iron: x0.4, under the 0.45 that speaks
  const said = [];
  const soft = pcaaoAttackDamage(p, ghost, { weapon: iron, rolls: fixed(0.01), dfRand: fixed(0), say: (t, s) => said.push([t, s]), modules: M });
  assert.ok(soft > 0, 'not refused');
  assert.ok(said.some(([t, s]) => t === 'This Weapon Is Not Very Effective Against This Creature.' && s === 1), 'and the HUD says so for a second');
  const hard = pcaaoAttackDamage(p, ghost, { weapon: iron, rolls: fixed(0.01), dfRand: fixed(0), say: (t) => said.push([t]), modules: modsOf({ softMaterialRequirements: false }) });
  assert.equal(hard, 0, 'without the module: DFU\'s refusal');
  // a monster with its own weapon: the Skeletal Warrior's steel war axe wears the player's helm
  const skel = monster(15);
  const cuirass = wear({ group: 'Armor', templateIndex: 102, material: 0x201, maxCondition: 1000, currentCondition: 1000, name: 'Cuirass' }, equipTableOf(p), EQUIP_SLOTS.ChestArmor);
  let total = 0;
  let seed = 11; const lcg = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; };   // a fixed five-roll cycle would strike the same part every blow
  for (let i = 0; i < 40; i++) total += pcaaoAttackDamage(skel, p, { rolls: lcg, dfRand: fixed(0), modules: M });
  assert.ok(total > 0, 'the loop lands');
  assert.ok(cuirass.currentCondition < 1000, 'the cuirass wore under an axe (the chest is the likeliest part)');
  // no attacker or target: 0
  assert.equal(pcaaoAttackDamage(null, p, { modules: M }), 0);
});

test('PCO1: the registry - installed, each override reads its switch live; declined, DFU\'s formula stands', () => {
  uninstallPcaao();
  assert.equal(damageModifier(60), 2, 'DFU: (60 - 50) / 5');
  let read = { ...ALL_ON };
  installPcaao({ read: (k) => read[k] });
  assert.equal(damageModifier(60), 1, 'the mod: / 10');
  read = { ...ALL_ON, fixedStrengthDamageModifier: false };
  assert.equal(damageModifier(60), 2, 'the switch off: declined, DFU stands');
  read = { ...ALL_ON, Enabled: false };
  assert.equal(damageModifier(60), 2);
  assert.ok(formulaOverride('calculateAttackDamage'), 'registered');
  // the attack core: through formulas.calculateAttackDamage, the mod's material law answers
  const p = mkPlayer({ stats: stats({ strength: 60 }) });
  const iron = { group: 'Weapons', templateIndex: 120, material: 0, flags: 0, maxCondition: 1000, currentCondition: 1000 };
  const ghost = monster(18); ghost.minMetalToHit = 2;
  read = { ...ALL_ON };
  assert.ok(calculateAttackDamage(p, ghost, { weapon: iron, rolls: fixed(0.01), dfRand: fixed(0) }) > 0, 'the overhaul: the soft material lands');
  read = { ...ALL_ON, Enabled: false };
  assert.equal(calculateAttackDamage(p, ghost, { weapon: iron, rolls: fixed(0.01), dfRand: fixed(0) }), 0, 'off: DFU refuses the material');
  // damageEquipment: a fist wears a piece only under the mod
  const foe = classEnemy(17);
  const cuirass = wear({ group: 'Armor', templateIndex: 102, material: 0x203, maxCondition: 1000, currentCondition: 1000 }, equipTableOf(foe), EQUIP_SLOTS.ChestArmor);
  damageEquipment(p, foe, 10, null, 3, { rolls: fixed(0.99) });
  assert.equal(cuirass.currentCondition, 1000, 'DFU: a fist wears nothing');
  read = { ...ALL_ON };
  damageEquipment(p, foe, 10, null, 3, { rolls: fixed(0.99) });
  assert.ok(cuirass.currentCondition < 1000, 'the mod: it does');
  uninstallPcaao();
  assert.equal(formulaOverride('damageModifier'), null);
  registerFormulaOverride('damageModifier', null);
});

test('PCO1: the Meaner Monsters edit rides the row a foe is minted from, only under its switch', () => {
  assert.equal(Object.keys(MEANER_MONSTERS).length, 42);
  assert.deepEqual(MEANER_MONSTERS[31], { minDamage: 26, maxDamage: 42, minHealth: 170, maxHealth: 285, level: 21, armorValue: -9 }, 'the Daedra Lord');
  assert.deepEqual(MEANER_MONSTERS[4], { minDamage: 4, maxDamage: 8, minDamage2: 6, maxDamage2: 8, minDamage3: 6, maxDamage3: 10, minHealth: 55, maxHealth: 110, level: 4, armorValue: 8 }, 'the Grizzly Bear\'s three pairs');
  const base = ENEMY_BASICS[0];
  assert.equal(meanerMonstersRow(0, base, false), base, 'off: the base row itself');
  const on = meanerMonstersRow(0, base, true);
  assert.equal(on.minHealth, 15); assert.equal(on.maxHealth, 35); assert.equal(on.armorValue, 6); assert.equal(on.maleTexture, base.maleTexture, 'the rest is the base row\'s');
  assert.equal(meanerMonstersRow(128 + 17, ENEMY_BASICS[128 + 17], true), ENEMY_BASICS[128 + 17], 'a class enemy is untouched');
  _resetModSettings();
  setModSetting('pcaao', 'Enabled', true); setModSetting('pcaao', 'meanerMonsters', true);
  const rat = makeEnemyEntity(0, ENEMY_BASICS[0], career(), 5, () => 0.5);
  assert.equal(rat.basics.minHealth, 15, 'a minted rat carries the edit');
  assert.equal(rat.maxHealth, 25, 'Range(15, 36) at a half roll');
  _resetModSettings();
  const plain = makeEnemyEntity(0, ENEMY_BASICS[0], career(), 5, () => 0.5);
  assert.equal(plain.basics.minHealth, ENEMY_BASICS[0].minHealth);
});

test('PCO1: the seams - the Mods pane entry, the credit, the vendor folder, worldTick\'s install, the bow\'s draw timer', () => {
  const m = MOD_SETTINGS.pcaao;
  const manifest = JSON.parse(rd('vendor/pcaao/physicalcombatandarmoroverhaul.dfmod.json'));
  assert.equal(m.author, manifest.ModAuthor); assert.equal(manifest.ModVersion, '1.44');
  const shipped = JSON.parse(rd('vendor/pcaao/modsettings.json')).Sections[0].Keys;
  for (const k of shipped) {
    assert.ok(m.keys[k.Name], `the shipped key ${k.Name} is on the pane`);
    assert.equal(m.keys[k.Name].default, k.Value, `${k.Name} defaults as shipped`);
    assert.equal(m.keys[k.Name].description, k.Description, `${k.Name}'s description is the mod's own`);
  }
  assert.equal(m.keys.Enabled.default, false, 'the mod is the player\'s choice in the Mods pane (DFU enables a mod by listing it)');
  assert.equal(m.keys.rolePlayRealismArchery.default, false); assert.equal(m.keys.meanerMonsters.default, false);
  const credit = CREDITS.mods.find((c) => c.title === 'Physical Combat And Armor Overhaul');
  assert.ok(credit); assert.equal(credit.author, 'Kirk.O'); assert.deepEqual([...credit.vendor], ['pcaao']); assert.equal(credit.version, '1.44');
  assert.match(rd('vendor/pcaao/README.md'), /Kirk\.O/);
  assert.match(rd('src/systems/worldTick.js'), /installPcaao\(\);/, 'every host installs the overrides through worldTick');
  const pw = rd('src/combat/playerWeapon.js');
  assert.match(pw, /this\._drawStartedAt = nowMs\(\); return 'StrikeUp';/, 'the draw starts the clock');
  assert.match(pw, /this\.lastDrawMs = this\._drawStartedAt == null \? 0 : Math\.max\(0, Math\.round\(nowMs\(\) - this\._drawStartedAt\)\);/, 'the release reads it');
  assert.match(pw, /this\.lastDrawMs = 0; return 'StrikeDown';/, 'the instant shot has no draw');
  assert.match(rd('src/combat/arrowFlight.js'), /weaponAnimTime: playerWeapon\?\.lastDrawMs \?\? 0,/, 'the arrow hands it to the formula');
  assert.match(rd('src/combat/formulas.js'), /const core = _overrides\.get\('calculateAttackDamage'\);/, 'the core is the registry\'s');
  assert.match(rd('src/systems/equip.js'), /if \(removeFrom\) \{ const i = removeFrom\.indexOf\(item\); if \(i >= 0\) removeFrom\.splice\(i, 1\); \}/, 'LowerCondition\'s removeFromCollectionWhenBreaks');
  assert.match(rd('src/characters/enemyEntity.js'), /const basics = meanerMonstersRow\(mobileType, basicsIn\);/);
  const ws = rd('src/combat/pcaao.js');
  assert.equal((ws.match(/Mathf\.Clamp/g) || []).length >= 4, true, 'the four discarded clamps are named');
  assert.equal(pcaaoAdjustmentsToHit(mkPlayer()), -50);
  assert.ok(SKILLS.CriticalStrike === 34 && SKILLS.Dodging === 20, 'the skill ids the C# numbers');
});

// ═══ AUDIT PCO1 (2026-09-12) - the 1:1 audit, method for method against
// the decompiled 1.44. Two findings, both pinned here.
test('AUDIT PCO1: the archery arm registers on the STOCK path too - InitMod registers AdjustWeaponHitChanceMod/AdjustWeaponAttackDamage whatever the armour module says (mutant: the hooks missing from formulas.js, or gated on armorHitFormulaRedone)', () => {
  uninstallPcaao();
  const p = mkPlayer();
  const bow = { group: 'Weapons', templateIndex: 129, material: 1, flags: 0, maxCondition: 1000, currentCondition: 1000 };
  const rat = monster(0);
  // nothing registered: DFU's no-op hooks
  assert.equal(adjustWeaponHitChanceMod(p, rat, 30, 100, bow), 30);
  assert.equal(adjustWeaponAttackDamage(p, rat, 20, 100, bow), 20);
  // the mod on, its archery arm on, the REDONE FORMULA OFF: the stock core still bends the bow by its draw
  let read = { ...ALL_ON, armorHitFormulaRedone: false, rolePlayRealismArchery: true };
  installPcaao({ read: (k) => read[k] });
  assert.equal(formulaOverride('calculateAttackDamage')(p, rat, {}), undefined, 'the redone core declines');
  assert.equal(adjustWeaponHitChanceMod(p, rat, 30, 100, bow), -10, 'a snap shot: -40');
  assert.equal(adjustWeaponAttackDamage(p, rat, 20, 100, bow), 2, '20 * 100/800, truncated');
  assert.equal(adjustWeaponAttackDamage(p, rat, 20, 7000, bow), 15, 'a long hold: x0.75');
  // ...and the stock weapon roll carries it: a bow with weaponAnimTime lands the adjust as CalculateWeaponAttackDamage's last line
  const stock = weaponAttackDamage(p, rat, 0, bow, fixed(0.5), 0);
  const drawn = weaponAttackDamage(p, rat, 0, bow, fixed(0.5), 100);
  assert.ok(stock > 0 && drawn === Math.trunc(stock * 100 / 800), `the draw scales the stock roll (${stock} -> ${drawn})`);
  // the arm off: identity again, live
  read = { ...ALL_ON, armorHitFormulaRedone: false, rolePlayRealismArchery: false };
  assert.equal(adjustWeaponHitChanceMod(p, rat, 30, 100, bow), 30);
  assert.equal(adjustWeaponAttackDamage(p, rat, 20, 100, bow), 20);
  uninstallPcaao();
  assert.equal(formulaOverride('adjustWeaponHitChanceMod'), null);
  assert.equal(formulaOverride('adjustWeaponAttackDamage'), null);
  // the source: both stock sites consult the registry where the C# calls its hooks
  const f = rd('src/combat/formulas.js');
  assert.match(f, /if \(weapon\) chanceToHitMod = adjustWeaponHitChanceMod\(attacker, target, chanceToHitMod, weaponAnimTime, weapon\);/, 'after CalculateWeaponToHit');
  assert.match(f, /damage = adjustWeaponAttackDamage\(attacker, target, damage, weaponAnimTime, weapon\);\n\s+return damage;\n\}/, 'CalculateWeaponAttackDamage\'s last line');
  assert.match(f, /weaponAttackDamage\(attacker, target, damageModifiers, weapon, rolls, weaponAnimTime\)/, 'the stock core hands the draw down');
});

test('AUDIT PCO1: a CLASS enemy\'s bare fists deal nothing under the overhaul - CalculateHandToHandAttackDamage gives a non-player only its damageModifier, which is 0 for anyone but the player (bug for bug; a knight whose sword the wear broke fights for 0)', () => {
  const p = mkPlayer();
  const foe = classEnemy(17);   // a Knight, unarmed
  assert.equal(pcaaoHandToHandAttackDamage(foe, p, 0, false, fixed(0.5)), 0, 'the helper: 0 + 0, floored to 0, no enemy-type term');
  let landed = 0;
  for (let i = 0; i < 20; i++) landed += pcaaoAttackDamage(foe, p, { weapon: null, rolls: fixed(0.01), dfRand: fixed(0), modules: M });
  assert.equal(landed, 0, 'the whole blow: every hit lands for 0');
  // the player's fists still roll (the `player` arm), and a MONSTER's summed natural damage is its modifier
  assert.ok(pcaaoHandToHandAttackDamage(p, foe, 0, true, fixed(0.5)) > 0);
  assert.equal(pcaaoHandToHandAttackDamage(monster(0), p, 7, false, fixed(0.5)), 7, 'a monster: its summed damage, plus a 0 enemy-type term for a career with no bits');
});
