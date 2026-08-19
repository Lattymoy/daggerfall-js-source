// The PLAYER's per-classic-minute tick, shared by every host.
//
// AUDIT 18: this ran in ONE place - dungeonContext.js's frame body - so
// outside a dungeon nothing aged. Active magic effects never ticked (a
// spell cast in town lasted forever and Levitate never expired), diseases
// never advanced a day, poisons never fired a round, fatigue never
// drained, and raiseSkills never ran, so a character who stayed above
// ground NEVER ADVANCED A SKILL OR GAINED A LEVEL. DFU has no such split:
// EntityEffectBroker.Update (:200-236) raises MagicRound on a global
// interval and PlayerEntity.Update (:263-330) runs the fatigue and
// advancement path wherever the player is.
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
import { raiseSkills } from './advancement.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';
import { FATIGUE_LOSS } from './statMods.js';
import { RACES } from './races.js';
import { dice100 } from '../combat/formulas.js';

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
 * @param {Function} [o.onLevelUp] called when raiseSkills crosses a level
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
  onLevelUp = null,
} = {}) {
  const prevMinute = Math.floor(classicMinutes);
  const next = classicMinutes + dt * CLASSIC_MINUTES_PER_SECOND;
  let rounds = 0;

  // S7/S18/S19b, verbatim order: diseases update FIRST so an ending
  // disease's final day lands and the same round's tick removes the
  // expired entry (DFU removes at the end of the same DoMagicRound).
  for (let r = prevMinute; r < Math.floor(next); r++) {
    updateDiseases(entity, Math.floor((r + 1) / MINUTES_PER_DAY), sinks, rolls, say);
    updatePoisons(entity, r + 1, sinks, rolls, say);
    tickActiveEffects(entity, sinks);
    rounds++;
  }

  // S20 parity: DFU applies the loss ONCE per minute-CHANGE
  // (`lastGameMinutes != gameMinutes` guards a single DecreaseFatigue),
  // so a multi-minute jump costs one minute's fatigue, not one per
  // minute caught up. The (int) cast happens AFTER the multiply.
  if (Math.floor(next) !== prevMinute) {
    let loss = FATIGUE_LOSS.Default;
    if (activity.running) loss = FATIGUE_LOSS.Running;
    else if (activity.swimming) {
      // PlayerEntity.cs:412 (P18): the Argonian exemption SHORT-
      // CIRCUITS before the Dice100 roll - an Argonian never rolls,
      // pays the default loss, and still tallies (:414).
      if (entity.raceId !== RACES.Argonian && !dice100(skillValue(entity, SKILLS.Swimming), rolls())) loss = FATIGUE_LOSS.Swimming;
      tallySkill(entity, SKILLS.Swimming);          // the 20000 clamp is load-bearing
    }
    sinks.drainFatigue?.(Math.trunc(loss * fatigueMultiplier));
  }

  const raised = raiseSkills(entity, next, rolls, onLevelUp) ?? [];
  return { classicMinutes: next, rounds, raised };
}
