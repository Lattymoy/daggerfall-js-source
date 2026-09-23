// Rest recovery + exhaustion (Systems S20). Verbatim formulas from
// DFU FormulaHelper.cs (the per-hour rest rates) + DFCareer's flag
// decodes (MIT, Daggerfall Workshop).
//
// The rates are PER HOUR OF REST. Their first consumer is the
// exhaustion collapse (PlayerEntity's OnExhausted handler): fatigue
// hitting 0 with health left drops the player - with no enemies
// nearby and dry feet, one hour passes and each pool recovers one
// hour's rate (plus a Medical tally); near enemies or in water the
// collapse KILLS (SetHealth(0) - classic's "collapse from exhaustion
// near monsters = die" and the watery grave). The rest UI itself
// pends; these rates are shared with it when it arrives.

import { liveStat, maxFatigue } from './statMods.js';
import { skillValue, SKILLS } from './skills.js';
import { healingRateModifier } from '../combat/formulas.js';   // U10
import { sharedClockOn, worldMinutes } from './worldTick.js';   // AUDIT WORLD5 C6: the collapse's hour, paid once a world hour online
import { isOnlinePage } from './onlineLane.js';   // REST-MANA1: online, every career's magicka comes back with rest

// ---- DFCareer.SpecialAbilityFlags (the low byte of
// AbilityFlagsAndSpellPointsBitfield) + RapidHealingFlags ----
export const SPECIAL_ABILITY = Object.freeze({
  AcuteHearing: 1, Athleticism: 2, AdrenalineRush: 4,
  NoRegenSpellPoints: 8, SunDamage: 16, HolyDamage: 32,
});
export const RAPID_HEALING = Object.freeze({ None: 0, InLight: 1, InDarkness: 2, Always: 4 });

/** DFCareer.HasSpecialAbility: the flag masked against the bitfield's
 *  LOW BYTE (the C# (byte)flags cast), verbatim. */
export const hasSpecialAbility = (career, flag) =>
  ((career?.abilityFlagsAndSpellPointsBitfield ?? 0) & flag) === flag;

// U10: HealingRateModifier moved to the FormulaHelper home beside
// the other six derived stats; re-exported so existing importers of
// rest.js keep working.
export { healingRateModifier };

/**
 * CalculateHealthRecoveryRate, verbatim: live Medical + an add of 60
 * (100 with RapidHealing Always; or InLight while it is day AND the
 * player is outside; or InDarkness otherwise), then
 * max(floor(healingRateModifier(liveEndurance) + medical x maxHealth
 * / 1000), 1). day/inside describe where the rest happens (a dungeon
 * is inside; day only matters for InLight).
 */
export function healthRecoveryRate(entity, { day = false, inside = true } = {}) {
  let medical = skillValue(entity, SKILLS.Medical);
  const rapid = entity.career?.rapidHealing ?? 0;
  let add = 60;
  if (rapid === RAPID_HEALING.Always) add = 100;
  else if (day && !inside) {
    if (rapid === RAPID_HEALING.InLight) add = 100;
  } else if (rapid === RAPID_HEALING.InDarkness) {
    add = 100;
  }
  medical += add;
  return Math.max(Math.floor(healingRateModifier(liveStat(entity, 'endurance')) + medical * (entity.maxHealth ?? 0) / 1000), 1);
}

/** CalculateFatigueRecoveryRate: max(floor(maxFatigue / 8), 1) -
 *  maxFatigue in STORED (x64) units, so the rate is too. */
export const fatigueRecoveryRate = (maxFat) => Math.max(Math.floor(maxFat / 8), 1);

/** CalculateSpellPointRecoveryRate: 0 for NoRegenSpellPoints careers,
 *  else max(floor(maxMagicka / 8), 1). */
/** REST-MANA1 (2026-09-23, per-request: "change it so that resting heals mana anyway only for online mode"):
 *  ONLINE, NO CAREER SITS OUT THE REST. Daggerfall's "Inability to regenerate spell points" (the Sorcerer's,
 *  and any custom class that takes it) keeps a rested hour from paying any magicka - right for a solo game built
 *  around Spell Absorption, and a party's caster stuck empty while everyone else wakes up full online. Online the
 *  disadvantage no longer stops REST (the rate below, and restFullyHealed's clause in scenes/shared.js); offline it
 *  is Daggerfall's, unchanged. */
export const restIgnoresNoRegen = () => isOnlinePage();

export function spellPointRecoveryRate(entity) {
  if (hasSpecialAbility(entity.career, SPECIAL_ABILITY.NoRegenSpellPoints) && !restIgnoresNoRegen()) return 0;
  return Math.max(Math.floor((entity.maxMagicka ?? 0) / 8), 1);
}

// The exhaustion texts: TEXT.RSC 1071 ("you drop to the ground",
// safe) / 1072 (enemies nearby); the in-water line is a TextManager
// string (no RSC record).
export const EXHAUSTED_SAFE_TEXT_ID = 1071;
export const EXHAUSTED_ENEMIES_TEXT_ID = 1072;
export const EXHAUSTED_IN_WATER = 'Fatigue overcomes you and sends you to a watery grave....';

/**
 * The OnExhausted outcome, pure (the scene owns the popup and the
 * clock): returns what must happen. deps = { enemiesNearby, swimming,
 * entity, day, inside }. Safe: one rest hour - the caller advances
 * the clock 60 classic minutes, applies the three rates (clamped)
 * and tallies Medical. Otherwise: death.
 */
export function exhaustionOutcome({ enemiesNearby = false, swimming = false, entity, day = false, inside = true }) {
  if (!enemiesNearby && !swimming) {
    // AUDIT WORLD5 C6: ONLINE THE HOUR CANNOT BE CHARGED - the clock is the world's and the host's RaiseTime is
    // refused - so it is not paid twice in one: the fatigue hour lands every collapse (it is what stands the player
    // up; without it the next frame collapses again), the health and the magicka once per WORLD hour, which is what
    // an hour's rest yields over the same real minutes. Offline every collapse costs its hour and pays in full.
    let paid = true;
    if (sharedClockOn()) {
      const hour = Math.floor(worldMinutes() / 60);
      paid = entity.lastExhaustionHour !== hour;
      entity.lastExhaustionHour = hour;
    }
    return {
      kind: 'rest',
      textId: EXHAUSTED_SAFE_TEXT_ID,
      health: paid ? healthRecoveryRate(entity, { day, inside }) : 0,
      fatigue: fatigueRecoveryRate(maxFatigue(entity)),
      magicka: paid ? spellPointRecoveryRate(entity) : 0,
    };
  }
  return { kind: 'death', textId: swimming ? null : EXHAUSTED_ENEMIES_TEXT_ID, inWater: swimming };
}
