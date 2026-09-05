// Spell casting vs the player (Systems S4b). Verbatim ports from DFU
// FormulaHelper.SavingThrow, EntityEffect.GetMagnitude,
// DaggerfallMissile constants, and DaggerfallAction.CastSpell (MIT,
// Daggerfall Workshop).
//
// EF1c: this header used to declare a SCOPE - "the RESOLVED effect
// family is classic Damage Health... every other effect in a trap
// spell is SKIPPED with a flag until the effect-library slice" - and
// it had outlived every clause. This module never resolved effects at
// all: it owns the saving throw, the magnitude roll and the missile
// constants, and systems/effects.js has dispatched the whole library
// (all 91 of DFU's classic keys - EF1) for a long time. A scope note
// describing a neighbour's old shape is worse than none, because it
// reads as current and nothing here contradicts it.

import { dice100 } from '../combat/formulas.js';
import { liveStat } from './statMods.js';   // F9: MagicResist reads the LIVE willpower
import { magicResist } from '../combat/formulas.js';   // U10
import { raceById, raceByKey } from './races.js';   // AUDIT 18: the racial saving-throw block

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
/** DFCareer.Elements, verbatim (the classic element index a spell
 *  record carries). */
export const ELEMENTS = Object.freeze({ Fire: 0, Frost: 1, DiseaseOrPoison: 2, Shock: 3, Magic: 4 });
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

/** FormulaHelper.SpellHasFlags, verbatim (FormulaHelper.cs:1549-1557
 *  - all six clauses). Two carry teeth: the DiseaseOrPoison clause
 *  ANDs the check flags with the SPELL's own flags before masking
 *  Disease|Poison, and the last clause is ELEMENT-INDEPENDENT - any
 *  Paralysis spell flag against any Paralysis check flag matches,
 *  whatever the element. */
export function spellHasFlags(element, checkFlags, spellEffectFlags) {
  return (element === ELEMENTS.Fire && (checkFlags & EFFECT_FLAGS.Fire) !== 0) ||
    (element === ELEMENTS.Frost && (checkFlags & EFFECT_FLAGS.Frost) !== 0) ||
    (element === ELEMENTS.DiseaseOrPoison && (checkFlags & spellEffectFlags & (EFFECT_FLAGS.Disease | EFFECT_FLAGS.Poison)) !== 0) ||
    (element === ELEMENTS.Shock && (checkFlags & EFFECT_FLAGS.Shock) !== 0) ||
    (element === ELEMENTS.Magic && (checkFlags & EFFECT_FLAGS.Magic) !== 0) ||
    ((spellEffectFlags & EFFECT_FLAGS.Paralysis) !== 0 && (checkFlags & EFFECT_FLAGS.Paralysis) !== 0);
}

/** PlayerEntity.GetLiveRaceTemplate's stand-in: the entity's own
 *  template if it carries one (DFU's racial-override effects -
 *  vampire/lycanthropy - swap it there), else the race table row for
 *  its raceId / race key. */
const raceTemplateOf = (target) =>
  target.raceTemplate ?? raceById(target.raceId) ?? raceByKey(target.race) ?? null;

/**
 * FormulaHelper.SavingThrow verbatim for our entities. Returns the
 * percent of damage/duration that lands (0..100). Magic-effect
 * resistances (HasResistanceFlag / GetResistanceChance) are set by the
 * ElementalResistance family (classic 8,0..4), which is LIVE - casting
 * 8,0 pushes an `elementalResistance` entry that the function
 * immediately below sums. (EF1c: this said the family was one "the
 * effect library has not reached, so nothing can raise one yet",
 * standing directly above the reader of the entries it declared could
 * not exist. Two neighbours, opposite claims, and only one of them
 * runs.)
 */
/** X1: the live Elemental Resistance chance for one element, summed
 *  over every active instance (DFU's additive RaiseResistanceChance).
 *  0 = no resistance flag set, which is the common case. */
export function elementalResistanceChance(target, element) {
  let total = 0;
  for (const a of target?.activeEffects ?? []) {
    if (a.kind === 'elementalResistance' && a.element === element && !a.ended) total += a.chance ?? 0;
  }
  return total;
}

export function savingThrow(element, effectFlags, target, modifier = 0, rolls = Math.random) {
  // X1: ELEMENTAL RESISTANCE comes FIRST and is absolute - DFU tests
  // the resistance flag at the very top of SavingThrow (FH:1442-1452)
  // and a successful roll returns 0 outright: the effect is resisted
  // whole, not scaled. Multiple instances on one element STACK their
  // chances additively (DoConstantEffects re-raises each live effect's
  // chance onto a cleared slate every frame, EEM:1679-1702), which the
  // sum below reproduces.
  const resist = elementalResistanceChance(target, element);
  if (resist > 0 && Math.floor(rolls() * 100) < resist) return 0;
  let saving = 50;
  let biographyMod = 0;
  const career = target.career ?? {};
  // Player racial flags (gated on `target == playerEntity`): note
  // IMMUNITY ASSIGNS 100 rather than adding, which the >= 100 return
  // below turns into flat immunity.
  if (target.isPlayer) {
    const rt = raceTemplateOf(target) ?? {};
    if (spellHasFlags(element, rt.resistanceFlags ?? 0, effectFlags)) saving += 30;
    if (spellHasFlags(element, rt.immunityFlags ?? 0, effectFlags)) saving = 100;
    if (spellHasFlags(element, rt.lowToleranceFlags ?? 0, effectFlags)) saving -= 25;
    if (spellHasFlags(element, rt.criticalWeaknessFlags ?? 0, effectFlags)) saving -= 50;
  }
  const tolerance = { Immune: 0, CriticalWeakness: 0, LowTolerance: 0, Resistant: 0 };
  const fold = (flag) => { const t = careerTolerance(career, flag); if (t !== 'Normal') tolerance[t] = 1; };
  // The biography questionnaire's resist mods ride the same fold,
  // player-only, at DFU's exact positions (FormulaHelper.cs:1486/
  // 1492/1504) - there is no Fire/Frost/Shock/Paralysis mod.
  if (effectFlags & EFFECT_FLAGS.Paralysis) fold(EFFECT_FLAGS.Paralysis);
  if (effectFlags & EFFECT_FLAGS.Magic) {
    fold(EFFECT_FLAGS.Magic);
    if (target.isPlayer) biographyMod += target.biographyResistMagicMod ?? 0;
  }
  if (effectFlags & EFFECT_FLAGS.Poison) {
    fold(EFFECT_FLAGS.Poison);
    if (target.isPlayer) biographyMod += target.biographyResistPoisonMod ?? 0;
  }
  if (effectFlags & EFFECT_FLAGS.Fire) fold(EFFECT_FLAGS.Fire);
  if (effectFlags & EFFECT_FLAGS.Frost) fold(EFFECT_FLAGS.Frost);
  if (effectFlags & EFFECT_FLAGS.Shock) fold(EFFECT_FLAGS.Shock);
  if (effectFlags & EFFECT_FLAGS.Disease) {
    fold(EFFECT_FLAGS.Disease);
    if (target.isPlayer) biographyMod += target.biographyResistDiseaseMod ?? 0;
  }
  // DFU's own departure from classic (mixed tolerances), preserved:
  if (tolerance.Immune) saving += 50;
  if (tolerance.CriticalWeakness) saving -= 50;
  if (tolerance.LowTolerance) saving -= 25;
  if (tolerance.Resistant) saving += 25;
  saving += biographyMod + modifier;
  if (saving >= 100) return 0;
  // MagicResist = floor(LIVE willpower / 10) - fortify-aware (audit F9).
  // U10: through the FormulaHelper home, not a fourth inline copy.
  saving += magicResist(liveStat(target, 'willpower'));
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

/** The classic damage-health pair: (4,0) Damage Health and (1,0)
 *  Continuous Damage Health. EF1c: the parenthesis here read "(instant
 *  application - the rounds system pends the effect-library slice)".
 *  It ships: (1,0) enters activeEffects as a `continuousDamage` entry
 *  and tickActiveEffects re-rolls its magnitude every round for the
 *  duration, which is the verbatim GetMagnitude-per-MagicRound law. */
export const isDamageHealthEffect = (e) =>
  (e.type === 4 && e.subType === 0) || (e.type === 1 && e.subType === 0);

/** U42: the FLIGHT PROBE's spell picker, and nothing else. It moved
 *  here when the U4 keyed spellbook - whose `knownSpells` fallback
 *  listed these as a stand-in for starting-spell data the port did
 *  not have yet - retired onto the classic window. chargenSession
 *  has assigned real starting spells since S3c, so no PLAYER reads
 *  this: the two `__readyRanged` hooks do, to ready the cheapest
 *  flier in SPELLS.STD for the missile leg (no classic starting set
 *  carries one). */
export function rangedDamageSpells(spellsByIndex) {
  if (!spellsByIndex) return [];
  const out = [];
  for (const sp of spellsByIndex.values()) {
    if ((sp.rangeType === 2 || sp.rangeType === 4) && sp.effects.some(isDamageHealthEffect)) out.push(sp);
  }
  return out;
}

/** ClassicTargetIndexToTargetType, verbatim (rangeType byte). */
export const TARGET_TYPES = Object.freeze(['CasterOnly', 'ByTouch', 'SingleTargetAtRange', 'AreaAroundCaster', 'AreaAtRange']);

/** Missile.ExplosionRadius, verbatim (world units == Unity meters
 *  throughout the port). */
export const EXPLOSION_RADIUS = 4.0;

/** The ByTouch cast shape (DaggerfallMissile.cs:61-62): a 0.25-radius
 *  sphere pushed 3.0 units ALONG THE AIM. */
export const TOUCH_SPHERE_CAST_RADIUS = 0.25;
export const TOUCH_RANGE = 3.0;

/** GetEntityTargetInTouchRange (DaggerfallMissile.cs:409-425, L2-slice
 *  AUDIT 23 magic-7): ByTouch targets by SPHERE-CAST along the aim
 *  direction - NOT a nearest-in-any-direction radius pick, which
 *  could touch a foe behind the caster's shoulder. Each live foe's
 *  mid-capsule is tested against the aim segment (closest-point
 *  distance <= cast radius + the 0.45 body the missile hit test
 *  uses) and the FIRST hit along the ray wins, as a physics cast
 *  returns; the caller's losClear keeps walls blocking the touch. */
export function pickTouchTarget(eye, dir, foes, losClear = () => true) {
  let best = null, bestT = Infinity;
  for (const f of foes) {
    if (f.dead) continue;
    const c = [f.ai.feet[0], f.ai.feet[1] + (f.ai.height ?? 1.8) / 2, f.ai.feet[2]];   // REVIEW 2026-09-05: the foe's own capsule centre
    const rx = c[0] - eye[0], ry = c[1] - eye[1], rz = c[2] - eye[2];
    const t = Math.max(0, Math.min(TOUCH_RANGE, rx * dir[0] + ry * dir[1] + rz * dir[2]));
    const d = Math.hypot(rx - dir[0] * t, ry - dir[1] * t, rz - dir[2] * t);
    if (d <= TOUCH_SPHERE_CAST_RADIUS + 0.45 && t < bestT && losClear(c, Math.hypot(rx, ry, rz))) {
      best = f; bestT = t;
    }
  }
  return best;
}

/** Area sweep: live foes within radius of a point (OverlapSphere). */
export function sweepFoes(pos, radius, foes) {
  const out = [];
  for (const f of foes) {
    if (f.dead) continue;
    const c = [f.ai.feet[0], f.ai.feet[1] + (f.ai.height ?? 1.8) / 2, f.ai.feet[2]];   // REVIEW 2026-09-05: the foe's own capsule centre
    if (Math.hypot(c[0] - pos[0], c[1] - pos[1], c[2] - pos[2]) <= radius) out.push(f);
  }
  return out;
}

// resolveSpellVsTarget moved to systems/effects.applySpell (S7) -
// one door for instant AND continuous families.
