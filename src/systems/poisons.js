// Poisons (Systems S19b). Verbatim from DFU PoisonEffect.cs +
// FormulaHelper.InflictPoison + ItemHelper's poisoned-weapon roll
// (MIT, Daggerfall Workshop).
//
// Shape: a poison is a PERMANENT activeEffects entry ({ kind:
// 'poison' }) owning its own lifecycle over CLASSIC MINUTES (unlike
// the disease's daily tick): Start rolls minutesToStart =
// Range(min, max+1) and minutesRemaining = Range(min, max+1) from
// the per-variant timing tables, then every magic round UpdatePoison
// catches up one IncrementPoisonEffects per elapsed minute (fast
// travel/rest catch up in one round). The Waiting state counts
// minutesToStart down and ticks the FIRST active minute the moment
// it reaches 0; each active minute runs the per-variant switch
// (health/fatigue/magicka through the sinks - fatigue x64, DFU
// passes assignMultiplier: true - and signed statMods: DRUGS
// (Indulcet/Sursum/Quaesto Vil/Aegrotat) push POSITIVE mods too),
// alerts the player host ("You feel somewhat bad."), and counts
// minutesRemaining down to the Complete state. Complete keeps the
// entry (and its negative statMods) ALIVE: each round CompletePoison
// strips a drug's positive mods once, then expires the entry only
// when every attribute mod has healed to >= 0 ("if poison has
// completed and all attribute damage is healed then outcome is
// identical to just curing poison directly") - attribute damage from
// poisons persists until healed or cured.
//
// InflictPoison: the career's Poison tolerance Immune vetoes
// outright ("in classic, AI characters' immunity to poison is
// ignored" - DFU checks it, we port DFU); player racial immunity
// pends the RACIAL-OVERRIDE templates (vampire/were - no base race
// carries Poison immunity; race selection itself shipped, AUDIT 23);
// then bypassResistance OR a non-zero saving
// throw (Poison flag) infects targets above level 1 (the level-1
// check "still gives rats immunity"). Unlike diseases, ANY entity
// can be poisoned - player poisoned weapons work on foes.
//
// Weapon poisons: ItemHelper rolls at enemy spawn (player level > 1,
// class enemies + Orc/Centaur/OrcSergeant, 5% - Assassin 60% -
// poison Range(128, 136)); CalculateAttackDamage's weapon branch
// inflicts on a damaging hit and CLEARS the weapon's poison (the
// onInflictPoison seam in formulas.js).

import { savingThrow, careerTolerance, EFFECT_FLAGS } from './spellcast.js';
import { FATIGUE_MULTIPLIER } from './statMods.js';
import { dice100 } from '../combat/formulas.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { YOU_FEEL_SOMEWHAT_BAD } from './diseases.js';

// ---- ItemEnums.Poisons, verbatim (0-7 weapon poisons, 8-11 drugs) ----
export const POISONS = Object.freeze({
  None: -1,
  Nux_Vomica: 128, Arsenic: 129, Moonseed: 130, Drothweed: 131,
  Somnalius: 132, Pyrrhic_Acid: 133, Magebane: 134, Thyrwort: 135,
  Indulcet: 136, Sursum: 137, Quaesto_Vil: 138, Aegrotat: 139,
});
export const POISON_START_VALUE = 128;   // PoisonEffect.startValue
export const TOTAL_POISON_VARIANTS = 12;

// ---- PoisonEffect.Start's timing tables, verbatim (index = type - 128) ----
//                                                0    1    2    3    4    5    6    7    8    9   10   11
export const MIN_MINUTES_TO_POISON = Object.freeze([4, 10, 0, 5, 0, 0, 2, 0, 2, 1, 2, 0]);
export const MAX_MINUTES_TO_POISON = Object.freeze([4, 10, 0, 10, 0, 0, 2, 0, 12, 4, 12, 0]);
export const MIN_ROUNDS_OF_POISON = Object.freeze([3, 20, 1, 5, 2, 1, 5, 1, 2, 2, 1, 5]);
export const MAX_ROUNDS_OF_POISON = Object.freeze([10, 1000, 4, 30, 10, 2, 20, 3, 6, 2, 4, 20]);

/** IsDrugType, verbatim: Indulcet/Sursum/Quaesto Vil/Aegrotat. */
export const isDrugType = (poisonType) => poisonType >= POISONS.Indulcet && poisonType <= POISONS.Aegrotat;

/**
 * PoisonEffect.Start: roll the timing spans (BOTH Ranges consume
 * even when an incumbent swallows the new instance - AttachHost's
 * AddState is a no-op for poisons, "poisonType does not stack rounds
 * with self") and create the live entry. currentMinute = the classic
 * minute count at infection.
 */
export function startPoison(target, poisonType, currentMinute, rolls = Math.random) {
  if (poisonType === POISONS.None) return null;
  // NO EFFECT IS REGISTERED FOR AN UNKNOWN TYPE. DFU builds the bundle
  // from GetClassicPoisonEffectKey's `string.Format("Poison-{0}",
  // poisonType)`, so a value outside the enum formats a key nothing is
  // registered under and AssignBundle instantiates NOTHING. U25 found
  // the path that reaches here: the drug arm of UseItem adds 66 to a
  // template index of 78..81 and lands on 144..147. Refusing is the
  // faithful translation; indexing the timing tables at 16..19 would
  // invent a poison DFU never creates.
  if (poisonType < POISON_START_VALUE || poisonType >= POISON_START_VALUE + TOTAL_POISON_VARIANTS) return null;
  const i = poisonType - POISON_START_VALUE;
  const range = (lo, hi) => lo + Math.floor(rolls() * (hi + 1 - lo));   // Range(min, max + 1)
  const minutesToStart = range(MIN_MINUTES_TO_POISON[i], MAX_MINUTES_TO_POISON[i]);
  const minutesRemaining = range(MIN_ROUNDS_OF_POISON[i], MAX_ROUNDS_OF_POISON[i]);
  if (target.activeEffects?.some((a) => a.kind === 'poison' && a.poison === poisonType && !a.ended)) return null;
  const entry = {
    kind: 'poison', poison: poisonType, permanent: true,
    state: 'waiting', minutesToStart, minutesRemaining,
    lastMinute: currentMinute, statMods: {}, positiveStatsRemoved: false,
  };
  target.activeEffects = target.activeEffects || [];
  target.activeEffects.push(entry);
  return entry;
}

/** CurePoison, verbatim: zero the clock, complete, expire (the tick
 *  pass removes the entry - its statMods lift with it). */
export function curePoisonEntry(entry) {
  entry.minutesRemaining = 0;
  entry.state = 'complete';
  entry.ended = true;   // forcedRoundsRemaining = 0
}

/** IncrementPoisonEffects, verbatim: the Waiting countdown ticks
 *  into Active the minute it expires; each active minute runs the
 *  per-variant switch IN CALL ORDER (roll sequences match), alerts,
 *  and counts down to Complete. Random.Range(lo, hi) is EXCLUSIVE
 *  hi here, exactly as the switch calls it. */
function incrementPoisonEffects(entry, sinks, rolls, onAlert) {
  if (entry.state === 'waiting') {
    if (--entry.minutesToStart > 0) return;
    entry.state = 'active';
  }
  const range = (lo, hi) => lo + Math.floor(rolls() * (hi - lo));   // Range(lo, hi) exclusive
  const mods = entry.statMods;
  const change = (stat, delta) => { mods[stat] = (mods[stat] ?? 0) + delta; };
  switch (entry.poison) {
    case POISONS.Nux_Vomica:
      if (sinks.hurt) sinks.hurt(range(2, 12));
      break;
    case POISONS.Arsenic:
      if (sinks.hurt) sinks.hurt(2);
      change('endurance', -1);
      break;
    case POISONS.Moonseed:
      if (sinks.hurt) sinks.hurt(range(1, 10));
      break;
    case POISONS.Drothweed:
      change('strength', -range(5, 10));
      change('agility', -range(1, 5));
      change('speed', -range(1, 5));
      break;
    case POISONS.Somnalius:
      if (sinks.drainFatigue) sinks.drainFatigue(range(10, 100) * FATIGUE_MULTIPLIER);   // DecreaseFatigue(n, true)
      break;
    case POISONS.Pyrrhic_Acid:
      if (sinks.hurt) sinks.hurt(range(1, 30));
      break;
    case POISONS.Magebane:
      change('willpower', -range(1, 5));
      if (sinks.drainMagicka) sinks.drainMagicka(range(5, 15));
      break;
    case POISONS.Thyrwort:
      change('willpower', -range(5, 20));
      change('personality', -range(10, 20));
      break;
    case POISONS.Indulcet:
      if (sinks.drainFatigue) sinks.drainFatigue(range(10, 100) * FATIGUE_MULTIPLIER);
      change('luck', range(4, 10));   // the drug's POSITIVE mod
      break;
    case POISONS.Sursum:
      change('intelligence', -range(10, 30));
      change('strength', range(5, 20));
      break;
    case POISONS.Quaesto_Vil:
      change('willpower', -range(1, 4));
      if (sinks.restoreFatigue) sinks.restoreFatigue(range(5, 10) * FATIGUE_MULTIPLIER);   // IncreaseFatigue(n, true)
      break;
    case POISONS.Aegrotat:
      change('endurance', -range(1, 5));
      if (sinks.restoreMagicka) sinks.restoreMagicka(range(5, 10));
      break;
  }
  if (onAlert) onAlert(YOU_FEEL_SOMEWHAT_BAD);   // player hosts only (the scene wires it)
  if (--entry.minutesRemaining <= 0) entry.state = 'complete';
}

/** CompletePoison, verbatim: drugs strip their positive mods once;
 *  the entry expires only when all attribute damage has healed. */
function completePoison(entry) {
  if (isDrugType(entry.poison) && !entry.positiveStatsRemoved) {
    for (const k of Object.keys(entry.statMods)) if (entry.statMods[k] > 0) entry.statMods[k] = 0;
    entry.positiveStatsRemoved = true;
  }
  if (!Object.values(entry.statMods).some((v) => v < 0)) curePoisonEntry(entry);
}

/** PoisonEffect.MagicRound over one entry: UpdatePoison until
 *  Complete (minutesPassed catch-up), then CompletePoison rounds. */
export function updatePoisonEntry(entry, currentMinute, sinks, rolls = Math.random, onAlert = null) {
  if (entry.ended) return;
  if (entry.state !== 'complete') {
    let minutesPassed = currentMinute - entry.lastMinute;
    while (minutesPassed-- > 0 && entry.minutesRemaining > 0 && entry.state !== 'complete') {
      incrementPoisonEffects(entry, sinks, rolls, onAlert);
    }
    entry.lastMinute = currentMinute;
  } else {
    completePoison(entry);
  }
}

/** The per-round poison pass for one entity (call before
 *  tickActiveEffects, like the disease pass). */
export function updatePoisons(entity, currentMinute, sinks, rolls = Math.random, onAlert = null) {
  for (const a of entity.activeEffects ?? []) {
    if (a.kind === 'poison') updatePoisonEntry(a, currentMinute, sinks, rolls, onAlert);
  }
}

/**
 * FormulaHelper.InflictPoison, verbatim: career Poison tolerance
 * Immune vetoes (racial immunity pends the racial-override templates); then
 * bypassResistance OR a non-zero saving throw infects targets above
 * level 1. Element 2 = DiseaseOrPoison.
 */
export function inflictPoison(target, poisonType, bypassResistance, { rolls = Math.random, currentMinute = 0 } = {}) {
  if (careerTolerance(target.career ?? {}, EFFECT_FLAGS.Poison) === 'Immune') return null;
  if (bypassResistance || savingThrow(2, EFFECT_FLAGS.Poison, target, 0, rolls) !== 0) {
    if (target.level !== 1) return startPoison(target, poisonType, currentMinute, rolls);
  }
  return null;
}

/**
 * ItemHelper's poisoned-weapon roll at enemy spawn, verbatim:
 * player level > 1; class enemies plus Orc/Centaur/OrcSergeant;
 * 5% chance (Assassin 60%); poison = Range(128, 136) - the weapon
 * poisons only, never drugs. Returns the poison type or null.
 */
export function rollEnemyWeaponPoison(mobileType, playerLevel, rolls = Math.random) {
  if (playerLevel <= 1) return null;
  const isClass = mobileType >= 128 && mobileType !== MOBILE_TYPES.None;
  if (!isClass && mobileType !== MOBILE_TYPES.Orc && mobileType !== MOBILE_TYPES.Centaur && mobileType !== MOBILE_TYPES.OrcSergeant) return null;
  const chanceToPoison = mobileType === MOBILE_TYPES.Assassin ? 60 : 5;
  if (!dice100(chanceToPoison, rolls())) return null;
  return POISON_START_VALUE + Math.floor(rolls() * 8);   // Range(128, 135 + 1)
}
