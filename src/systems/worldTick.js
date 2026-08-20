// The PLAYER's per-classic-minute tick, shared by every host.
//
// AUDIT 18: this ran in ONE place - dungeonContext.js's frame body - so
// outside a dungeon nothing aged. Active magic effects never ticked (a
// spell cast in town lasted forever and Levitate never expired), diseases
// never advanced a day, poisons never fired a round, fatigue never
// drained - so a character who stayed above
// ground NEVER ADVANCED A SKILL OR GAINED A LEVEL. DFU has no such split:
// EntityEffectBroker.Update (:200-236) raises MagicRound on a global
// interval and PlayerEntity.Update (:347-538) runs the fatigue path
// wherever the player is - advancement runs at REST END, never here.
//
// It lives here rather than in a scene because a scene cannot be tested -
// the four hosts have zero execution coverage, which is exactly why the
// gap survived. Everything the tick needs arrives as arguments, so the
// whole law is exercised by test/audit18.test.js against plain objects.
//
// The FOE half stays in the dungeon host: it walks that host's live foe
// list, and no other host has one.

import { updateDiseases } from './diseases.js';
import { updatePoisons } from './poisons.js';
import { tickActiveEffects } from './effects.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';
import { FATIGUE_LOSS } from './statMods.js';
import { dice100 } from '../combat/formulas.js';
import { CLASSIC_GAME_START_TIME } from './gameDate.js';
import { RACES } from './races.js';

/** PlayerEntity.cs:263 - the classic day is elapsed minutes / 1440. */
export const MINUTES_PER_DAY = 1440;

/** Classic minutes advance 12x real seconds (one classic minute per 5s). */
export const CLASSIC_MINUTES_PER_SECOND = 12 / 60;

/**
 * Advance the player's world clock by `dt` real seconds and run every
 * per-minute law DFU runs, in DFU's order.
 *
 * @param {object} o
 * @param {object} o.entity        the player entity
 * @param {number} o.classicMinutes the clock BEFORE this step
 * @param {number} o.dt            real seconds elapsed
 * @param {object} o.sinks         { hurt, heal, drainMagicka, drainFatigue, restoreFatigue, restoreMagicka, say }
 * @param {object} [o.activity]    { running, swimming } - the fatigue band
 * @param {number} [o.fatigueMultiplier] PlayerEntity.cs:388-400, 0.9 with Athleticism
 * @param {Function} [o.rolls]     injectable RNG
 * @param {Function} [o.say]       message sink for disease/skill text
 * @returns {{ classicMinutes: number, rounds: number, raised: number[] }}
 */
export function tickPlayerMinutes({
  entity,
  classicMinutes,
  dt,
  sinks,
  activity = { running: false, swimming: false },
  fatigueMultiplier = 1,
  rolls = Math.random,
  say = () => {},
} = {}) {
  const next = classicMinutes + dt * CLASSIC_MINUTES_PER_SECOND;
  let rounds = 0;

  // AUDIT 21 F4: THE BROKER'S OWN MARKER, which the port did not have.
  //
  // This used to anchor on `Math.floor(classicMinutes)` - whatever the clock
  // read at the START of this frame - so minutes added by anyone ELSE
  // produced ZERO magic rounds. Rest, a court sentence, a RaiseTime: the
  // clock jumped and the round loop began at the far side of the jump.
  // Diseases and poisons survived that by accident (they carry their own
  // lastDay/lastMinute and catch up on the next ordinary tick); active spell
  // effects did not, because roundsRemaining is only decremented in here.
  // Cast Levitate, rest eight hours, wake still levitating with the full
  // duration intact - and rest off a Continuous Damage Health for free.
  //
  // EntityEffectBroker.Update (:202-240) keeps its OWN lastGameMinute for
  // exactly this reason, and says so: "Effect system must be able to update
  // while game is paused but game time still passes, e.g. rest or fast
  // travel". The 2880 cap is its too - maxCatchupDays = 2 - and it is not
  // optional: prison time steps the clock by 30,240 minutes and a load by
  // millions.
  const nextFloor = Math.floor(next);
  const here = Math.floor(classicMinutes);
  // Anchor on first use, and RE-anchor whenever the clock has moved BACKWARDS
  // relative to the marker - that is a load, and DFU sits it out through
  // `SaveLoadManager.Instance.LoadInProgress` (:206-207). Re-anchoring here
  // rather than trusting callers to call resetMagicRoundMarker keeps the
  // function total: a restored save cannot fire the cap's worth of rounds
  // against effects that already expired in the saved game.
  if (_lastMagicRoundMinute === null || here < _lastMagicRoundMinute) _lastMagicRoundMinute = here;
  const prevMinute = Math.max(_lastMagicRoundMinute, nextFloor - MAX_CATCHUP_ROUNDS);

  // S7/S18/S19b, verbatim order: diseases update FIRST so an ending
  // disease's final day lands and the same round's tick removes the
  // expired entry (DFU removes at the end of the same DoMagicRound).
  for (let r = prevMinute; r < nextFloor; r++) {
    updateDiseases(entity, Math.floor((r + 1) / MINUTES_PER_DAY), sinks, rolls, say);
    updatePoisons(entity, r + 1, sinks, rolls, say);
    tickActiveEffects(entity, sinks);
    rounds++;
  }

  // S20 parity: DFU applies the loss ONCE per minute-CHANGE
  // (`lastGameMinutes != gameMinutes` guards a single DecreaseFatigue),
  // so a multi-minute jump costs one minute's fatigue, not one per
  // minute caught up. The (int) cast happens AFTER the multiply.
  if (nextFloor > _lastMagicRoundMinute) _lastMagicRoundMinute = nextFloor;

  // The fatigue band still asks "did the minute CHANGE this frame", which is
  // DFU's `lastGameMinutes != gameMinutes` - a different marker from the
  // broker's, and deliberately so: a multi-minute jump costs ONE minute's
  // fatigue (S20) while it costs many magic rounds.
  if (nextFloor !== Math.floor(classicMinutes)) {
    let loss = FATIGUE_LOSS.Default;
    if (activity.running) loss = FATIGUE_LOSS.Running;
    else if (activity.swimming) {
      // AUDIT 21 F8: THE ARGONIAN EXEMPTION, and its short-circuit.
      //     if (Race != Races.Argonian && Dice100.FailedRoll(...Swimming))
      //         amount = (int)(SwimmingFatigueLoss * fatigueLossMultiplier);
      // C#'s `&&` means an Argonian never pays the penalty AND never consumes
      // the roll - the operand order is preserved here for the same reason
      // the court's roll order was (AUDIT 21 F5): a roll drawn where DFU
      // draws none shifts every later roll from the same generator.
      //
      // Without it, an Argonian with Swimming 20 paid 44 fatigue on ~80% of
      // minutes instead of 11 - four times the drain, in the water, for the
      // race built for it, ending in exhaustionOutcome's death arm in about a
      // quarter of the time DFU allows. (P18 shipped this same line in
      // the parallel Player lane the same day - two finders, one law.)
      if (entity.raceId !== RACES.Argonian
        && !dice100(skillValue(entity, SKILLS.Swimming), rolls())) loss = FATIGUE_LOSS.Swimming;
      tallySkill(entity, SKILLS.Swimming);          // the 20000 clamp is load-bearing
    }
    sinks.drainFatigue?.(Math.trunc(loss * fatigueMultiplier));
  }

  // AUDIT 23 (entity-1): NO advancement here. DFU's PlayerEntity.Update
  // (:347-538) runs no RaiseSkills; the only call sites in the whole
  // tree are DaggerfallRestWindow.cs:731 (the finished popup's close)
  // and DaggerfallTravelPopUp.cs:380 (fast travel, unported). The
  // per-minute raise this tick used to run leveled characters mid-walk
  // without ever resting.
  return { classicMinutes: next, rounds };
}

// --- THE WORLD CLOCK (AUDIT 21 F2) -----------------------------------
//
// There were THREE of these, plus a fourth inside dungeonContext. AUDIT 18
// extracted the per-minute LAW here and left the ACCUMULATOR with each
// carrier, so world.js, exterior.js, worldModes.js and every built dungeon
// context each counted from zero and only while their own mode was active.
// Crossing a host rewound time.
//
// That is not a cosmetic split. Diseases are DAY-driven
// (daysPast = currentDay - entry.lastDay): catch one three days into a
// crawl, walk out to a clock that reads day 0, and daysPast goes NEGATIVE -
// the damage loop runs zero times and `daysOfSymptomsLeft -= daysPast` ADDS
// days. A finite disease got longer every time you opened a door. Poisons
// are minute-indexed and drift the same way, and the music director's
// gameDays reset on every dungeon entry.
//
// One clock, module-level, because there is one world. The carriers below
// are VIEWS on it.

/** DaggerfallDateTime.classicGameStartTime (:30), applied by
 *  SetClassicGameStartTime (:491-494): 13:30 on the 4th of Morning Star,
 *  3E405. Minutes from the CLASSIC EPOCH, not from "when this session began".
 *
 *  AUDIT 21 (music lane, F11): the clock started at 0, and 523530 / 1440 =
 *  DAY 363. SelectCurrentSong uses gameDays both as the DFRandom seed for
 *  every non-dungeon playlist and as the tavern list index, so every song the
 *  port picked on a given in-game date differed from DFU's: a new character
 *  walking into a tavern got SQUARE_2 (0 % 5) where DFU plays FOLK2 (363 % 5).
 *  Everything else that reads days - diseases, the 28-day guild gate, the
 *  court's normalize interval - was counting from the wrong epoch too. */
// ONE DFU MEMBER, ONE EXPORT (AUDIT 22 merge). AUDIT 21 and S28 landed
// this same DFU constant in the same session from opposite directions -
// the music lane needed the right day for its playlist seed, the
// calendar needed the right date for the guild gate - and wrote it out
// twice. DaggerfallDateTime owns it, so gameDate.js exports it and this
// re-exports the name its own readers use.
export { CLASSIC_GAME_START_TIME as CLASSIC_GAME_START_MINUTES } from './gameDate.js';

let _worldMinutes = CLASSIC_GAME_START_TIME;

/** EntityEffectBroker.maxCatchupDays = 2, i.e. 2880 game minutes
 *  (EntityEffectBroker.cs:36, applied at :223). DFU's own reasoning: the
 *  longest spell duration is under 2000 minutes, constant-state effects need
 *  one tick, and poisons and diseases catch up by themselves - so the cap
 *  stops the framework spinning on empty across a prison sentence or a load. */
export const MAX_CATCHUP_ROUNDS = 2880;

/** The broker's `lastGameMinute` (EntityEffectBroker.cs:213-237). null until
 *  the first tick, which is DFU's `if (lastGameMinute == 0) return;` - a
 *  pre-init frame fires no rounds. */
let _lastMagicRoundMinute = null;

/** Classic minutes from the CLASSIC EPOCH - DaggerfallDateTime's own unit,
 *  which is what ToClassicDaggerfallTime returns and what gameDays divides.
 *  A new game starts at CLASSIC_GAME_START_MINUTES, not at zero. */
export const worldMinutes = () => _worldMinutes;

/** Set the clock - a load restores it, a rest or a court sentence jumps it. */
export function setWorldMinutes(v) {
  _worldMinutes = Number.isFinite(v) ? v : 0;
  return _worldMinutes;
}

/** A LOAD resets the marker rather than catching up across it - DFU's
 *  `SaveLoadManager.Instance.LoadInProgress` early return (:206-207). Without
 *  this a restored save would fire the cap's worth of rounds on its first
 *  frame against effects that already expired in the saved game. */
export function resetMagicRoundMarker(v = null) {
  _lastMagicRoundMinute = v === null ? null : Math.floor(v);
  return _lastMagicRoundMinute;
}

/** Move the clock forward (or back, for a load). */
export function advanceWorldMinutes(delta) {
  return setWorldMinutes(_worldMinutes + (Number(delta) || 0));
}
