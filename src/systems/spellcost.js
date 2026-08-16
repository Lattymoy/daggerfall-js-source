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
// The per-effect factors below are each effect class's own
// MakeEffectCosts(costA, costB, offsetGold=0) values, keyed by the
// classic (type, subType). Effects without a table entry cost the
// zero-component fudge (their real factors land with each family).

import { skillValue } from './skills.js';

export const CAST_COST_FLOOR = 5;
const FUDGE = { A: 60, B: 100, offset: 160 };

// classic 'type,subType' -> { skill, duration?, magnitude?, chance? }
export const EFFECT_COST_TABLE = Object.freeze({
  '4,0':    { skill: 22, magnitude: { A: 20, B: 28, offset: 0 } },                                  // DamageHealth (Destruction)
  '1,0':    { skill: 22, duration: { A: 28, B: 8, offset: 0 }, magnitude: { A: 40, B: 28, offset: 0 } },   // ContinuousDamageHealth
  '10,8':   { skill: 23, magnitude: { A: 20, B: 28, offset: 0 } },                                  // HealHealth (Restoration)
  '0,255':  { skill: 25, duration: { A: 28, B: 100, offset: 0 }, chance: { A: 28, B: 100, offset: 0 } },   // Paralyze (Alteration) - S19
  '3,0':    { skill: 23, chance: { A: 8, B: 100, offset: 0 } },                                     // Cure Disease (Restoration) - S19c
  '3,1':    { skill: 23, chance: { A: 8, B: 100, offset: 0 } },                                     // Cure Poison (Restoration) - S19c
  '3,2':    { skill: 23, chance: { A: 20, B: 140, offset: 0 } },                                    // Cure Paralyzation (Restoration) - S19c
  '25,255': { skill: 25, duration: { A: 20, B: 100, offset: 0 } },                                  // Slowfall (Alteration)
  '31,255': { skill: 26, duration: { A: 20, B: 8, offset: 0 } },                                    // WaterWalking (Thaumaturgy)
  '23,0':   { skill: 24, duration: { A: 20, B: 80, offset: 0 } },                                   // ChameleonNormal (Illusion)
});

export const TARGET_COST_MULT = Object.freeze({ 0: 1.0, 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 });

const component = (c, starting, increase, per) =>
  Math.trunc(c.offset + c.A * starting + c.B * Math.trunc(increase / Math.max(1, per)));

/** One effect's { gold, sp } at the caster's skill. */
export function effectCost(e, casterSkillOf) {
  // subType normalized to BYTE (DFU MakeClassicKey casts the sbyte;
  // real records read 0xFF as -1 - parity fix 2026-08-16d)
  const entry = EFFECT_COST_TABLE[`${e.type},${e.subType & 0xff}`];
  const skill = casterSkillOf(entry?.skill ?? 22);
  let gold = 0;
  if (!entry) {
    gold = component(FUDGE, 1, 1, 1);   // unknown family: the zero-component fudge
  } else {
    if (entry.duration) gold += component(entry.duration, e.durationBase, e.durationMod, e.durationPerLevel);
    if (entry.chance) gold += component(entry.chance, e.chanceBase, e.chanceMod, e.chancePerLevel);
    if (entry.magnitude) {
      const base = Math.trunc((e.magnitudeBaseLow + e.magnitudeBaseHigh) / 2);
      const plus = Math.trunc((e.magnitudeLevelBase + e.magnitudeLevelHigh) / 2);
      gold += component(entry.magnitude, base, plus, e.magnitudePerLevel);
    }
  }
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
