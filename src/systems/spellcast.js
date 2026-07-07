// Spell casting vs the player (Systems S4b). Verbatim ports from DFU
// FormulaHelper.SavingThrow, EntityEffect.GetMagnitude,
// DaggerfallMissile constants, and DaggerfallAction.CastSpell (MIT,
// Daggerfall Workshop). Scope (loud): the RESOLVED effect family is
// classic Damage Health - direct (type 4, sub 0) and continuous
// (type 1, sub 0) applied as an instant hit; every other effect in a
// trap spell is SKIPPED with a flag until the effect-library slice.
// Racial saving-throw flags pend race selection (chargen UI);
// biography mods pend biography.

import { dice100 } from '../combat/formulas.js';

// ---- DaggerfallMissile constants, verbatim ----
export const MISSILE_SPEED = 25.0;
export const MISSILE_COLLIDER_RADIUS = 0.45;
export const MISSILE_LIFESPAN_S = 8;
export const CASTSPELL_COOLDOWN_TICK = 45.454546;   // "Approximates classic based on observation"
/** Element -> texture archive: fire 375, cold 376, poison 377,
 *  shock 378, magic 379 - sequential from the classic element order,
 *  matching the source's five named archives exactly. */
export const missileArchive = (element) => 375 + Math.max(0, Math.min(4, element));

// ---- DFCareer.EffectFlags bits ----
export const EFFECT_FLAGS = Object.freeze({ Paralysis: 1, Magic: 2, Poison: 4, Fire: 8, Frost: 16, Shock: 32, Disease: 64 });
/** Classic element index -> the effect flag its saving throw checks
 *  (fire/cold/poison/shock/magic). */
const ELEMENT_EFFECT_FLAG = Object.freeze([EFFECT_FLAGS.Fire, EFFECT_FLAGS.Frost, EFFECT_FLAGS.Poison, EFFECT_FLAGS.Shock, EFFECT_FLAGS.Magic]);

/** DFCareer.GetTolerance over the four CFG flag bytes, verbatim
 *  precedence: Resistant > Immune > LowTolerance > CriticalWeakness. */
export function careerTolerance(career, flag) {
  const has = (byte) => (byte & flag) === flag;
  if (has(career.resistanceFlags ?? 0)) return 'Resistant';
  if (has(career.immunityFlags ?? 0)) return 'Immune';
  if (has(career.lowToleranceFlags ?? 0)) return 'LowTolerance';
  if (has(career.criticalWeaknessFlags ?? 0)) return 'CriticalWeakness';
  return 'Normal';
}

/**
 * FormulaHelper.SavingThrow verbatim for our entities. Returns the
 * percent of damage/duration that lands (0..100). Racial flags +
 * biography mods pend their slices (0). Magic-effect resistances
 * (HasResistanceFlag) pend active effects (none exist yet).
 */
export function savingThrow(element, effectFlags, target, modifier = 0, rolls = Math.random) {
  let saving = 50;
  const career = target.career ?? {};
  const tolerance = { Immune: 0, CriticalWeakness: 0, LowTolerance: 0, Resistant: 0 };
  const fold = (flag) => { const t = careerTolerance(career, flag); if (t !== 'Normal') tolerance[t] = 1; };
  if (effectFlags & EFFECT_FLAGS.Paralysis) fold(EFFECT_FLAGS.Paralysis);
  if (effectFlags & EFFECT_FLAGS.Magic) fold(EFFECT_FLAGS.Magic);
  if (effectFlags & EFFECT_FLAGS.Poison) fold(EFFECT_FLAGS.Poison);
  if (effectFlags & EFFECT_FLAGS.Fire) fold(EFFECT_FLAGS.Fire);
  if (effectFlags & EFFECT_FLAGS.Frost) fold(EFFECT_FLAGS.Frost);
  if (effectFlags & EFFECT_FLAGS.Shock) fold(EFFECT_FLAGS.Shock);
  if (effectFlags & EFFECT_FLAGS.Disease) fold(EFFECT_FLAGS.Disease);
  // DFU's own departure from classic (mixed tolerances), preserved:
  if (tolerance.Immune) saving += 50;
  if (tolerance.CriticalWeakness) saving -= 50;
  if (tolerance.LowTolerance) saving -= 25;
  if (tolerance.Resistant) saving += 25;
  saving += modifier;
  if (saving >= 100) return 0;
  // MagicResist = floor(willpower / 10)
  saving += Math.floor((target.stats?.willpower ?? 50) / 10);
  saving = Math.max(5, Math.min(95, saving));
  let percent = 100;
  const roll = 1 + Math.floor(rolls() * 100);   // Dice100.Roll
  if (roll <= saving) {
    // prorated within 20 of a failed roll, per DF Chronicles
    percent = saving - 20 <= roll ? 100 - 5 * (saving - roll) : 0;
  }
  return Math.max(0, Math.min(100, percent));
}

/** EntityEffect.GetMagnitude verbatim over a classic effect record:
 *  Range(baseLow, baseHigh+1) + Range(levelBase, levelHigh+1) x
 *  floor(casterLevel / perLevel). */
export function rollMagnitude(effect, casterLevel, rolls = Math.random) {
  const range = (lo, hi) => lo + Math.floor(rolls() * (hi + 1 - lo));
  const base = range(effect.magnitudeBaseLow, effect.magnitudeBaseHigh);
  const plus = range(effect.magnitudeLevelBase, effect.magnitudeLevelHigh);
  const per = Math.max(1, effect.magnitudePerLevel);
  return base + plus * Math.floor(casterLevel / per);
}

/** The resolved classic damage family: (4,0) Damage Health,
 *  (1,0) Continuous Damage Health (instant application - the
 *  rounds system pends the effect-library slice). */
export const isDamageHealthEffect = (e) =>
  (e.type === 4 && e.subType === 0) || (e.type === 1 && e.subType === 0);

/** ClassicTargetIndexToTargetType, verbatim (rangeType byte). */
export const TARGET_TYPES = Object.freeze(['CasterOnly', 'ByTouch', 'SingleTargetAtRange', 'AreaAroundCaster', 'AreaAtRange']);

// resolveSpellVsTarget moved to systems/effects.applySpell (S7) -
// one door for instant AND continuous families.
