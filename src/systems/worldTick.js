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
import { runInfections } from './infection.js';   // V1: UpdateDisease's override, which the base walk skips
import { updatePoisons } from './poisons.js';
import { tickActiveEffects } from './effects.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';
import { FATIGUE_LOSS, killIfAnyLiveStatZero } from './statMods.js';
import { dice100 } from '../combat/formulas.js';
import { normalizeReputations, NORMALIZE_INTERVAL_MINUTES } from './court.js';   // AUDIT 23 (C4)
import { CLASSIC_GAME_START_TIME } from './gameDate.js';
import { RACES } from './races.js';

/** PlayerEntity.cs:263 - the classic day is elapsed minutes / 1440. */
// AUDIT 24 (wave 24): one home, systems/gameDate.js.
import { MINUTES_PER_DAY } from './gameDate.js';
import { enchantmentMagicRound } from './enchantments.js';   // E1: the per-round item payload pump

export { MINUTES_PER_DAY };

/** Classic minutes advance 12x real seconds (one classic minute per 5s). */
export const CLASSIC_MINUTES_PER_SECOND = 12 / 60;

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
//
// AUDIT 24 (wave 30) pulled the loop out of tickPlayerMinutes, because the
// entity tick is not the only thing that crosses a game minute. The rest
// window advances world time with the whole gameplay frame HELD - dungeon.js
// returns at the overlay gate, before ctx.drawFoes and before the tick - so a
// rested night fired zero rounds and the entire backlog landed in one burst on
// the first frame after the window closed, AFTER every hour of healing had
// already been applied. MonoBehaviour.Update runs under Time.timeScale = 0,
// which is what the broker's own comment is about. Resting off a Continuous
// Damage Health was free, a poison could not kill you in your sleep, and eight
// hours of Levitate came back with its duration intact.
//
// AUDIT 24 (wave 32) then split the MARKER from the ROUND. There is one broker
// and one marker, but there is an EntityEffectManager on every entity in the
// scene, and all of them handle every raised round - so claimMagicRounds()
// answers the window once per frame and runMagicRoundsFor() runs it on each
// subscriber. Above ground the port had no foe subscriber at all.

/**
 * EntityEffectBroker.Update's OWN bookkeeping (:210-237), and nothing else:
 * how many game minutes have passed since the marker, capped, and the marker
 * advance. It answers `[from, to)` - the window every subscriber then runs.
 *
 * AUDIT 24 (wave 32) split this out of runMagicRounds. The broker raises ONE
 * event per elapsed minute and EVERY EntityEffectManager in the scene handles
 * it - one manager per entity, player and foes alike. A per-entity function
 * that also owned the marker could only ever serve the first caller: the
 * second would find the marker already advanced and run nothing. So the claim
 * happens once per frame and the window is handed to each subscriber.
 *
 * @returns {{from: number, to: number, rounds: number}} half-open, DFU's own
 *          `for (int i = 0; i < catchupRounds; i++)`
 */
export function claimMagicRounds(fromMinute, toMinute) {
  const nextFloor = Math.floor(toMinute);
  const here = Math.floor(fromMinute);
  // Anchor on first use, and RE-anchor whenever the clock has moved BACKWARDS
  // relative to the marker - that is a load, and DFU sits it out through
  // `SaveLoadManager.Instance.LoadInProgress` (:206-207). Re-anchoring here
  // rather than trusting callers to call resetMagicRoundMarker keeps the
  // function total: a restored save cannot fire the cap's worth of rounds
  // against effects that already expired in the saved game.
  if (_lastMagicRoundMinute === null || here < _lastMagicRoundMinute) _lastMagicRoundMinute = here;
  const from = Math.max(_lastMagicRoundMinute, nextFloor - MAX_CATCHUP_ROUNDS);
  // The broker's own lastGameMinute advance (:237). It never moves BACKWARDS
  // here: a rewind is a load, and the re-anchor above owns that case.
  if (nextFloor > _lastMagicRoundMinute) _lastMagicRoundMinute = nextFloor;
  return { from, to: nextFloor, rounds: Math.max(0, nextFloor - from) };
}

/**
 * ONE SUBSCRIBER'S OnNewMagicRound HANDLER across a claimed window -
 * EntityEffectManager.DoMagicRound, which every entity in the scene has one of.
 *
 * Diseases, poisons and active effects, and NOTHING player-specific: the
 * reputation normalisation that used to live in this loop is PlayerEntity's,
 * not the broker's, and moved back to the entity tick in wave 32.
 *
 * @returns {number} rounds run
 */
export function runMagicRoundsFor(entity, from, to, { sinks, rolls = Math.random, say = () => {} , enchantCtx = null } = {}) {
  if (!entity || !(to > from)) return 0;
  let rounds = 0;
  // S7/S18/S19b, verbatim order: diseases update FIRST so an ending
  // disease's final day lands and the same round's tick removes the
  // expired entry (DFU removes at the end of the same DoMagicRound).
  for (let r = from; r < to; r++) {
    updateDiseases(entity, Math.floor((r + 1) / MINUTES_PER_DAY), sinks, rolls, say);
    // V1: the two infections override UpdateDisease and manage their
    // own lifecycle, so diseases.js skips them and they run here - in
    // the SAME round, because in DFU they are the same DoMagicRound
    // over the same instancedBundles. One home means every host that
    // feeds the tick gets the dream and the turn; the video and the
    // clock arrive through infection.js's registered host.
    runInfections(entity, Math.floor((r + 1) / MINUTES_PER_DAY));
    updatePoisons(entity, r + 1, sinks, rolls, say);
    tickActiveEffects(entity, sinks);
    // E1: the enchantment pump rides the SAME round (DoMagicRound's
    // tail runs the MagicRound item payloads, EntityEffectManager.cs
    // :1755-1770) - one home here means every host's player AND foes
    // get it, the wave-32 one-broker law. hurtSelf routes the round
    // damage (UserTakesDamage/HealthLeech) through the caller's own
    // damage sink so death fires.
    enchantmentMagicRound(entity, r + 1, {
      nowMinutes: r + 1,
      ctx: { ...(enchantCtx ?? {}), hurtSelf: (n) => sinks?.hurt?.(n), say },
    });
    rounds++;
  }
  return rounds;
}

/**
 * Claim a window and run it on ONE subscriber - the common case, and the
 * shape wave 30 shipped. A caller with foes as well as a player claims once
 * with claimMagicRounds and calls runMagicRoundsFor per entity instead.
 *
 * @returns {number} rounds run
 */
export function runMagicRounds({ entity, fromMinute, toMinute, sinks, rolls = Math.random, say = () => {} } = {}) {
  const { from, to } = claimMagicRounds(fromMinute, toMinute);
  return runMagicRoundsFor(entity, from, to, { sinks, rolls, say });
}

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
 * @returns {{ classicMinutes: number, rounds: number, magicRoundWindow: {from:number,to:number,rounds:number} }}
 *          magicRoundWindow is the window the broker CLAIMED this tick - the host
 *          runs it on its own foes with runMagicRoundsFor (wave 32).
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

  // THE BROKER, claimed once. The window comes back out in the result so the
  // host can run it on ITS foes - one raise, every manager (wave 32).
  const magicRoundWindow = claimMagicRounds(classicMinutes, next);
  const rounds = runMagicRoundsFor(entity, magicRoundWindow.from, magicRoundWindow.to, { sinks, rolls, say });

  // PlayerEntity.cs:452-475, and NOT the broker's: the per-minute loop in
  // PlayerEntity.Update runs on PLAYERENTITY'S OWN lastGameMinutes, which is a
  // different marker from the broker's and - this is the part wave 30 got
  // wrong by folding it into the round loop - has NO 2880-minute cap. DFU
  // steps a 21-day prison sentence through all 30,240 of its minutes here
  // while the broker sees only the last 2,880.
  //
  // AUDIT 23 (C4: guilds-4 = cross-1 = entity-6) - :455-459: every 161280th
  // game minute (112 days) normalizes the legal AND faction reputations toward
  // zero, unless the prison skip set preventNormalizingReputations for its
  // jump. (The other three arms of that loop - faction powers at 7 days,
  // regional conditions at 38, the racial override quest at 84 - are
  // unported.)
  // ...and it is OFF BY ONE from the broker's, which is why moving it here
  // mattered. DFU tests `(i + lastGameMinutes) % 161280 == 0` for i in
  // [0, minutesPassed), i.e. the minute VALUES [last, now) with no +1, while
  // the broker's rounds represent the minutes [last+1, now]. AUDIT 23 wrote
  // this loop inside the broker's and inherited its `r + 1`, so the port
  // normalised one game minute late. DFU's own inconsistency, reproduced.
  //
  // A rewound clock re-anchors instead of looping backwards, which is exactly
  // what SerializablePlayer.cs:339 does on restore ("entity.LastGameMinutes =
  // ...ToClassicDaggerfallTime()") - so the field is deliberately NOT in the
  // save envelope.
  const lastMinutes = Number.isFinite(entity.lastGameMinutes) ? entity.lastGameMinutes : Math.floor(classicMinutes);
  const nowMinutes = Math.floor(next);
  for (let i = lastMinutes; i < nowMinutes; i++) {
    if (i % NORMALIZE_INTERVAL_MINUTES === 0 && !entity.preventNormalizingReputations) {
      normalizeReputations(entity, entity.factionRep ?? null);
    }
  }
  entity.lastGameMinutes = nowMinutes;   // :521, the tail of the same update

  // PlayerEntity.cs:528-530, the tail of the SAME update: the flag is
  // a ONE-JUMP shield, cleared the moment the jump it covered is over.
  // AUDIT 24 (the seven-slice sweep): nothing set it and nothing
  // cleared it, so both halves of the rule were dead - the read above
  // was a constant `true`, and the prison arm's own comment ("it sets
  // PreventNormalizingReputations across the skip precisely so the
  // elapsed days cannot decay what it just credited... not harmless
  // now that it is [ported]") described a line that was not there.
  if (entity.preventNormalizingReputations) entity.preventNormalizingReputations = false;

  // AUDIT 23 (C6: hosts-10 = entity-4) - PlayerEntity.cs:425-430: the
  // per-jump fatigue (11 x multiplier) and TallySkill(Jumping) live in
  // the ENTITY update; activity.jumped is the motor's frame edge, so
  // every host that feeds the tick gets the law (the dungeon's inline
  // reportActivity arm moved here).
  if (activity.jumped) {
    sinks.drainFatigue?.(Math.trunc(FATIGUE_LOSS.Jumping * fatigueMultiplier));
    tallySkill(entity, SKILLS.Jumping);
  }

  // AUDIT 23 (entity-5) - PlayerEntity.cs:309-320: TallySkill(Running, 1)
  // every 4th classic update (4 x 0.0625s) while running. The counter
  // rides the entity so the cadence survives host swaps; it only
  // advances while running, exactly like runningTallyCounter.
  if (activity.running) {
    entity._runTallyAcc = (entity._runTallyAcc ?? 0) + dt;
    while (entity._runTallyAcc >= 0.25) {
      entity._runTallyAcc -= 0.25;
      tallySkill(entity, SKILLS.Running);
    }
  }

  // The fatigue band still asks "did the minute CHANGE this frame", which is
  // DFU's `lastGameMinutes != gameMinutes` - a different marker from the
  // broker's, and deliberately so: a multi-minute jump costs ONE minute's
  // fatigue (S20) while it costs many magic rounds.
  if (Math.floor(next) !== Math.floor(classicMinutes)) {
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

  // EntityEffectManager.UpdateEntityMods' tail (:1855-1866), on its own
  // 0.2s real-time cadence: a live stat at zero kills the host. It sits
  // here rather than in runMagicRounds because DFU's is not a magic
  // round - it is Update()'s refreshMods timer, and Time.deltaTime is
  // zero under a paused UI, which is why a rest cannot kill you this way.
  killIfAnyLiveStatZero(entity, sinks, dt);

  // AUDIT 23 (entity-1): NO advancement here. DFU's PlayerEntity.Update
  // (:347-538) runs no RaiseSkills; the only call sites in the whole
  // tree are DaggerfallRestWindow.cs:731 (the finished popup's close)
  // and DaggerfallTravelPopUp.cs:380 (fast travel, unported). The
  // per-minute raise this tick used to run leveled characters mid-walk
  // without ever resting.
  return { classicMinutes: next, rounds, magicRoundWindow };
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
