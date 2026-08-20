// Spell casting costs (Systems S10). Verbatim from DFU
// FormulaHelper.CalculateTotalEffectCosts / CalculateEffectCosts /
// GetEffectComponentCosts (MIT, Daggerfall Workshop):
//   component gold = trunc(offsetGold + A*starting + B*trunc(inc/per))
//   magnitude uses the AVERAGED settings: base = (baseMin+baseMax)/2,
//     plus = (plusMin+plusMax)/2 (integer division)
//   per-effect spellpoints = gold * (110 - skill) / 400, where skill
//     is the caster's value in the effect's MAGIC SKILL
//   zero-component effects fudge MakeEffectCosts(60, 100, 160)
//   target multipliers on the SUMS: CasterOnly/ByTouch x1.0,
//     SingleTargetAtRange x1.5, AreaAroundCaster x2.0,
//     AreaAtRange x2.5 (float mul, int cast)
//   spellpoint floor 5 (castCostFloor)
// The table below is the WHOLE classic-key surface of DFU's effect
// library (Game/MagicAndEffects/Effects/**): every class's own
// ClassicKey -> its MagicSkill + its MakeEffectCosts(costA, costB,
// offsetGold=0) rows, plus which of Duration/Chance/Magnitude that
// class actually supports. Cost is charged ONLY for supported
// components (SupportDuration/SupportChance/SupportMagnitude), and
// the 60/100/160 fudge fires ONLY for a class with NO component at
// all (activeComponents == false: Teleport 43,255 and MorphSelf
// 29,255 in vanilla) - never as a stand-in for a missing row, and
// never against a defaulted magic skill. A classic key with NO
// effect class in DFU is not a cheap effect but NO effect: the
// broker's ClassicEffectRecordToEffectEntry returns false and the
// entry never enters the bundle (EntityEffectBroker.cs:924-931), so
// it contributes nothing to the cost. Every one of the 60 distinct
// keys the shipping SPELLS.STD uses has a class here.

import { skillValue, SKILLS } from './skills.js';

export const CAST_COST_FLOOR = 5;
const FUDGE = { A: 60, B: 100, offset: 160 };

const costs = (A, B, offset = 0) => ({ A, B, offset });
// One row per effect class: { skill, duration?, chance?, magnitude? }.
const row = (skill, parts) => Object.freeze({ skill, ...parts });
// The per-stat families (DFCareer.Stats order 0 Strength .. 7 Luck)
// are eight sibling classes sharing one set of factors, so they are
// expanded from one row rather than typed out eight times.
const family = (type, subTypes, r) =>
  Object.fromEntries(subTypes.map((s) => [`${type},${s}`, r]));
const STATS = [0, 1, 2, 3, 4, 5, 6, 7];

// classic 'type,subType' -> { skill, duration?, magnitude?, chance? }
export const EFFECT_COST_TABLE = Object.freeze({
  // ---- Alteration ----
  '0,255':  row(SKILLS.Alteration, { duration: costs(28, 100), chance: costs(28, 100) }),   // Paralyze - S19
  ...family(8, [0, 1, 2, 3, 4], row(SKILLS.Alteration, { duration: costs(100, 100), chance: costs(8, 100) })),   // ElementalResistance Fire/Frost/DiseaseOrPoison/Shock/Magic
  '25,255': row(SKILLS.Alteration, { duration: costs(20, 100) }),                           // Slowfall
  '27,255': row(SKILLS.Alteration, { duration: costs(20, 8) }),                             // Jumping
  '28,255': row(SKILLS.Alteration, { duration: costs(20, 20) }),                            // Climbing
  '30,255': row(SKILLS.Alteration, { duration: costs(20, 8) }),                             // WaterBreathing - P12
  '35,255': row(SKILLS.Alteration, { duration: costs(28, 8), magnitude: costs(80, 60) }),   // Shield

  // ---- Destruction ----
  '1,0':    row(SKILLS.Destruction, { duration: costs(28, 8), magnitude: costs(40, 28) }),  // ContinuousDamageHealth
  '1,1':    row(SKILLS.Destruction, { duration: costs(20, 8), magnitude: costs(40, 28) }),  // ContinuousDamageFatigue
  '1,2':    row(SKILLS.Destruction, { duration: costs(40, 8), magnitude: costs(40, 28) }),  // ContinuousDamageSpellPoints
  '4,0':    row(SKILLS.Destruction, { magnitude: costs(20, 28) }),                          // DamageHealth
  '4,1':    row(SKILLS.Destruction, { magnitude: costs(20, 28) }),                          // DamageFatigue
  '4,2':    row(SKILLS.Destruction, { magnitude: costs(20, 28) }),                          // DamageSpellPoints
  '5,255':  row(SKILLS.Destruction, { chance: costs(80, 140) }),                            // Disintegrate
  ...family(7, STATS, row(SKILLS.Destruction, { magnitude: costs(8, 100, 116) })),           // Drain{Attribute}
  ...family(11, [...STATS, 8, 9], row(SKILLS.Destruction, { magnitude: costs(60, 100, 40) })),   // Transfer{Attribute} + TransferHealth (11,8) / TransferFatigue (11,9)

  // ---- Illusion ----
  '13,0':   row(SKILLS.Illusion, { duration: costs(40, 120) }),                             // InvisibilityNormal - S21
  '13,1':   row(SKILLS.Illusion, { duration: costs(60, 140) }),                             // InvisibilityTrue - S21
  '15,255': row(SKILLS.Illusion, { duration: costs(8, 40) }),                               // LightNormal
  '23,0':   row(SKILLS.Illusion, { duration: costs(20, 80) }),                              // ChameleonNormal
  '23,1':   row(SKILLS.Illusion, { duration: costs(40, 120) }),                             // ChameleonTrue - S21
  '24,0':   row(SKILLS.Illusion, { duration: costs(20, 80) }),                              // ShadowNormal - S21
  '24,1':   row(SKILLS.Illusion, { duration: costs(40, 120) }),                             // ShadowTrue - S21
  '29,255': row(SKILLS.Illusion, {}),                                                       // MorphSelf - NO components (the fudge, at Illusion)

  // ---- Mysticism ----
  '2,255':  row(SKILLS.Mysticism, { duration: costs(60, 120) }),                            // CreateItem
  '6,0':    row(SKILLS.Mysticism, { chance: costs(120, 180) }),                             // DispelMagic
  '6,1':    row(SKILLS.Mysticism, { chance: costs(80, 140) }),                              // DispelUndead
  '6,2':    row(SKILLS.Mysticism, { chance: costs(120, 180) }),                             // DispelDaedra
  '12,255': row(SKILLS.Mysticism, { duration: costs(60, 68), chance: costs(40, 68) }),      // SoulTrap
  '16,255': row(SKILLS.Mysticism, { chance: costs(28, 120, 120) }),                         // Lock
  '17,255': row(SKILLS.Mysticism, { chance: costs(20, 100) }),                              // Open
  '19,255': row(SKILLS.Mysticism, { duration: costs(20, 100), chance: costs(20, 100) }),    // Silence
  '43,255': row(SKILLS.Mysticism, {}),                                                      // Teleport - NO components (the fudge, at Mysticism)
  '44,255': row(SKILLS.Mysticism, { duration: costs(60, 68), chance: costs(40, 68) }),      // ComprehendLanguages

  // ---- Restoration ----
  '3,0':    row(SKILLS.Restoration, { chance: costs(8, 100) }),                             // CureDisease - S19c
  '3,1':    row(SKILLS.Restoration, { chance: costs(8, 100) }),                             // CurePoison - S19c
  '3,2':    row(SKILLS.Restoration, { chance: costs(20, 140) }),                            // CureParalyzation - S19c
  ...family(9, STATS, row(SKILLS.Restoration, { duration: costs(28, 100), magnitude: costs(40, 120) })),   // Fortify{Attribute}
  ...family(10, STATS, row(SKILLS.Restoration, { magnitude: costs(40, 28) })),               // Heal{Attribute}
  '10,8':   row(SKILLS.Restoration, { magnitude: costs(20, 28) }),                          // HealHealth
  '10,9':   row(SKILLS.Restoration, { magnitude: costs(8, 28) }),                           // HealFatigue
  '18,255': row(SKILLS.Restoration, { duration: costs(100, 20), magnitude: costs(8, 8) }),  // Regenerate
  '20,255': row(SKILLS.Restoration, { duration: costs(28, 140), chance: costs(28, 140) }),  // SpellAbsorption
  '26,255': row(SKILLS.Restoration, { duration: costs(20, 8) }),                            // FreeAction - S22

  // ---- Thaumaturgy ----
  '14,255': row(SKILLS.Thaumaturgy, { duration: costs(60, 100) }),                          // Levitate - P11
  '21,255': row(SKILLS.Thaumaturgy, { duration: costs(28, 140), chance: costs(28, 140) }),  // SpellReflection
  '22,255': row(SKILLS.Thaumaturgy, { duration: costs(20, 100), chance: costs(20, 100) }),  // SpellResistance
  '31,255': row(SKILLS.Thaumaturgy, { duration: costs(20, 8) }),                            // WaterWalking
  '33,0':   row(SKILLS.Thaumaturgy, { chance: costs(60, 100, 160) }),                       // Pacify-Animals
  '33,1':   row(SKILLS.Thaumaturgy, { chance: costs(80, 140, 60) }),                        // Pacify-Undead
  '33,2':   row(SKILLS.Thaumaturgy, { chance: costs(80, 140, 60) }),                        // Pacify-Humanoid
  '33,3':   row(SKILLS.Thaumaturgy, { chance: costs(60, 120, 36) }),                        // Pacify-Daedra
  '34,255': row(SKILLS.Thaumaturgy, { chance: costs(40, 60) }),     // Charm - AUDIT 23 (magic-6): CharmEffect.cs:36/:42 comment DURATION out; chance alone is priced
  '39,0':   row(SKILLS.Thaumaturgy, { duration: costs(20, 8, 200) }),                       // DetectMagic
  '39,1':   row(SKILLS.Thaumaturgy, { duration: costs(20, 8, 200) }),                       // DetectEnemy
  '39,2':   row(SKILLS.Thaumaturgy, { duration: costs(20, 8, 160) }),                       // DetectTreasure
  '40,255': row(SKILLS.Thaumaturgy, { chance: costs(40, 100, 28) }),                        // Identify
});

export const TARGET_COST_MULT = Object.freeze({ 0: 1.0, 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 });

const component = (c, starting, increase, per) =>
  Math.trunc(c.offset + c.A * starting + c.B * Math.trunc(increase / Math.max(1, per)));

/** One effect's { gold, sp } at the caster's skill. */
/** S24: the effect's MAGIC SCHOOL, off the same table entry the cost
 *  reads. Absorption gates on Destruction and needs the partition the
 *  cost table already single-sources; the default matches effectCost's
 *  own (an unknown family is priced as Destruction). */
export function effectSchool(e) {
  return EFFECT_COST_TABLE[`${e.type},${e.subType & 0xff}`]?.skill ?? 22;
}

export function effectCost(e, casterSkillOf) {
  // subType normalized to BYTE (DFU MakeClassicKey casts the sbyte;
  // real records read 0xFF as -1 - parity fix 2026-08-16d)
  const entry = EFFECT_COST_TABLE[`${e.type},${e.subType & 0xff}`];
  // No effect class for this classic key: DFU drops the entry from
  // the bundle entirely, so it costs nothing.
  if (!entry) return { gold: 0, sp: 0 };
  const skill = casterSkillOf(entry.skill);
  let gold = 0;
  let activeComponents = false;
  if (entry.duration) {
    activeComponents = true;
    gold += component(entry.duration, e.durationBase, e.durationMod, e.durationPerLevel);
  }
  if (entry.chance) {
    activeComponents = true;
    gold += component(entry.chance, e.chanceBase, e.chanceMod, e.chancePerLevel);
  }
  if (entry.magnitude) {
    activeComponents = true;
    const base = Math.trunc((e.magnitudeBaseLow + e.magnitudeBaseHigh) / 2);
    const plus = Math.trunc((e.magnitudeLevelBase + e.magnitudeLevelHigh) / 2);
    gold += component(entry.magnitude, base, plus, e.magnitudePerLevel);
  }
  // "If there are no active components (e.g. Teleport) then fudge some costs"
  if (!activeComponents) gold += component(FUDGE, 1, 1, 1);
  return { gold, sp: Math.trunc(gold * (110 - skill) / 400) };
}

/** The full casting cost of a classic spell record for a caster:
 *  per-effect sums, target multiplier, the floor. */
export function calculateCastCost(spell, casterEntity) {
  const skillOf = (id) => skillValue(casterEntity, id);
  let gold = 0, sp = 0;
  for (const e of spell.effects) {
    if (e.type <= -1) continue;
    const c = effectCost(e, skillOf);
    gold += c.gold;
    sp += c.sp;
  }
  const m = TARGET_COST_MULT[spell.rangeType] ?? 1.0;
  gold = Math.trunc(gold * m);
  sp = Math.trunc(sp * m);
  if (sp < CAST_COST_FLOOR) sp = CAST_COST_FLOOR;
  return { gold, sp };
}
