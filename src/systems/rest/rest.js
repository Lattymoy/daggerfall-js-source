// Rest recovery + exhaustion (Systems S20). Verbatim formulas from
// DFU FormulaHelper.cs (the per-hour rest rates) + DFCareer's flag
// decodes (MIT, Daggerfall Workshop).
//
// The rates are PER HOUR OF REST. Their first consumer is the
// exhaustion collapse (PlayerEntity's OnExhausted handler): fatigue
// hitting 0 with health left drops the player - with no enemies
// nearby and dry feet, one hour passes and each pool recovers one
// hour's rate (plus a Medical tally). Near enemies or in water DFU's
// collapse KILLS (SetHealth(0) - classic's "collapse from exhaustion
// near monsters = die" and the watery grave); the port's costs a tenth
// of the health instead (SWIM-SPENT in the water, SPENT-ASHORE on dry
// feet - exhaustionOutcome below). The rest UI itself pends; these
// rates are shared with it when it arrives.

import { liveStat, maxFatigue } from '../statMods.js';
import { skillValue, SKILLS } from '../skills.js';
import { healingRateModifier } from '../../combat/formulas.js';   // U10
import { isOnlinePage } from '../online/onlineLane.js';   // REST-MANA1: online, every career's magicka comes back with rest
import { localizedText, t } from '../textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language; L10N4: SPENT-ASHORE's line is the port's own

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
// safe); the in-water line is a TextManager string (no RSC record).
// DFU's 1072 (the collapse with enemies nearby) is said by no host
// since SPENT-ASHORE: that collapse is no box and no death here.
export const EXHAUSTED_SAFE_TEXT_ID = 1071;
export const EXHAUSTED_IN_WATER = 'Fatigue overcomes you and sends you to a watery grave....';
/** L10N3d: the line as the hosts show it (PlayerEntity.cs:2407), in the player's language. */
export const exhaustedInWaterText = () => localizedText('exhaustedInWater', EXHAUSTED_IN_WATER);
/**
 * FIELD BUGS 2026-09-30b (SWIM-SPENT; Mac: "you can get instakilled when fishing" - "I dont care about DFU. We're our
 * own thing now"): A SWIMMER WHO RUNS OUT OF FATIGUE DROWNS, NOT AT ONCE. DFU's OnExhausted SetHealth(0)s a swimmer
 * whatever the health, and says so after (EXHAUSTED_IN_WATER). Now each drain to nothing in the water - one a game
 * minute while the swimmer stays in it, five real seconds - costs this share of the health pool, said on the HUD with
 * no box to hold the swimmer still: some fifty seconds from full health to reach the shore, where the collapse is the
 * rest hour it always was.
 */
export const EXHAUSTED_SPENT_SHARE = 0.1;
export const EXHAUSTED_SWIMMING_LINE = 'You are too exhausted to swim. Get out of the water!';
/**
 * FIELD BUGS 2026-10-13e (SPENT-ASHORE; a player near Knightshead: "the death screen suddenly appeared ... several
 * seconds after combat, despite having full health"; Mac on SWIM-SPENT: "We're our own thing now", and on FULL-GUARD:
 * "No kill from full health"): A FIGHTER WHO RUNS OUT OF FATIGUE WITH FOES ABOUT IS SPENT, NOT DEAD. DFU's OnExhausted
 * SetHealth(0)s a player on dry feet when AreEnemiesNearby - any live foe inside the classic spawn band, seen or not -
 * so the swings that emptied the bar and the walk after the last kill killed at full health, past the shield and every
 * death save, and the death screen took the box that said why in the same call. Now a drain to nothing there costs
 * SWIM-SPENT's share, said on the HUD with no box (the water's arm, its own line): a drain a game minute while the foes
 * stay about, some fifty real seconds from full health to get clear. With none about the collapse is the rest hour it
 * always was.
 */
export const EXHAUSTED_FIGHTING_LINE = 'You are too exhausted to fight. Get clear and rest!';
/** The line as the HUD says it, in the player's language (L10N4's text core), read at the collapse. */
export const exhaustedFightingText = () => t('rest.exhausted.fighting', EXHAUSTED_FIGHTING_LINE);
/** What a drain to nothing costs, in the water and ashore alike: the share of the health pool, never nothing. */
const spentDamage = (entity) => Math.max(1, Math.ceil((entity?.maxHealth ?? 0) * EXHAUSTED_SPENT_SHARE));

/**
 * The OnExhausted outcome, pure (the scene owns the popup and the
 * clock): returns what must happen. deps = { enemiesNearby, swimming,
 * entity, day, inside }. Safe: one rest hour - the caller advances
 * the clock 60 classic minutes, applies the three rates (clamped)
 * and tallies Medical. In the water (SWIM-SPENT): `drown` - `damage`
 * off the health, `line` on the HUD, no box. On dry feet with foes
 * about (SPENT-ASHORE): `spent` - the same, with its own line. No
 * outcome is a death: only the health the drains take can kill.
 */
export function exhaustionOutcome({ enemiesNearby = false, swimming = false, entity, day = false, inside = true }) {
  if (swimming) {
    return { kind: 'drown', damage: spentDamage(entity), line: EXHAUSTED_SWIMMING_LINE, textId: null, inWater: true };
  }
  if (!enemiesNearby && !swimming) {
    // LIVED1: every collapse costs its hour and pays it in full, online as offline - the host's RaiseTime moves the
    // character's own clock (worldTick.js advanceOwnMinutes through the ticker), so the hour is charged: the needs,
    // the effects and the curses age by it. [SUPERSEDES AUDIT WORLD5 C6's once-per-world-hour pay, which answered an
    // hour that could not be charged.]
    return {
      kind: 'rest',
      textId: EXHAUSTED_SAFE_TEXT_ID,
      health: healthRecoveryRate(entity, { day, inside }),
      fatigue: fatigueRecoveryRate(maxFatigue(entity)),
      magicka: spellPointRecoveryRate(entity),
    };
  }
  return { kind: 'spent', damage: spentDamage(entity), line: exhaustedFightingText(), textId: null, inWater: false };   // SPENT-ASHORE: foes about, on dry feet (the water's is `drown`, above)
}
