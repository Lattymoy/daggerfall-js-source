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
import { consumeRacialOverridePending, lycanthropyMagicRound } from './lycanthropy.js';   // V2a: the curse the deploy mints
import { consumeVampirismPending, vampirismMagicRound, liveVampirism } from './vampirism.js';   // V2b: the other curse; AUDIT WORLD5 C3: its feeding clock, aligned with the rest
import { updatePoisons } from './poisons.js';
import { tickActiveEffects } from './effects.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';
import { FATIGUE_LOSS, killIfAnyLiveStatZero } from './statMods.js';
import { decayEnemyAlert } from './encounters.js';   // PlayerEntity.Update:380-384, the 8-hour alert decay
import { dice100, setRacialHitHook, setPlayerStruckHook } from '../combat/formulas.js';
import { installPcaao } from '../combat/pcaao.js';   // PCO1: the mod's RegisterOverride, once, for every host
import { installMeanerMonsters } from '../characters/meanerMonsters.js';   // MM1: its xml billboard scales join the registry, once
import { installUnleveledLoot } from './unleveledLoot.js';   // UL1: its two material overrides and its death handler, once
import { onLycanthropeHit } from './lycanthropy.js';
import { onVampireHit } from './vampirism.js';
import { onPlayerStruckByEnemy } from './artifactEffects.js';   // V3: the Ring of Namira's reflection

// V2a/V2b: OnWeaponHitEntity's registration - formulas.js cannot
// import the curses (the dice100 cycle), and every host loads THIS
// module, so the hook rides here.
setRacialHitHook((attacker, target, { nowMinutes = 0, mobileType = null, isCivilian = false } = {}) => {
  onVampireHit(attacker, nowMinutes);
  onLycanthropeHit(attacker, target, { nowMinutes, mobileType, isCivilian });
});
// V3: the other tail - an enemy damaging the player runs the Ring of
// Namira's reflection (registered here for the same cycle reason).
setPlayerStruckHook((attacker, target, damage) => onPlayerStruckByEnemy(attacker, target, damage));
// PCO1: Physical Combat And Armor Overhaul's three overrides - each
// reads its module switch live and declines when off.
installMeanerMonsters();   // MM1: before the overhaul, as DFU Awakes the dependency first
installPcaao();
installUnleveledLoot();   // UL1: after everything it would override (its manifest orders it after Roleplay Realism)
import { normalizeReputations, NORMALIZE_INTERVAL_MINUTES } from './court.js';   // AUDIT 23 (C4)
// S43: the entity update's 7-day and 38-day arms (PlayerEntity.cs:460-472).
import { regionPowerUpdate } from './regionPower.js';
/** :462 - `% 10080`, seven days of game minutes. */
export const FACTION_POWER_INTERVAL_MINUTES = 10080;
/** :469 - `% 54720`, thirty-eight days. */
export const REGION_CONDITIONS_INTERVAL_MINUTES = 54720;
// V2d: the same loop's racial-quest arms (:472 rides the 38-day
// minute, :475-476 adds the 84-day cure minute).
import { startRacialOverrideQuest, CURE_QUEST_INTERVAL_MINUTES } from './racialQuests.js';
import { CLASSIC_GAME_START_TIME } from './gameDate.js';
import { RACES } from './races.js';

/** PlayerEntity.cs:263 - the classic day is elapsed minutes / 1440. */
// AUDIT 24 (wave 24): one home, systems/gameDate.js.
import { MINUTES_PER_DAY } from './gameDate.js';
import { enchantmentMagicRound } from './enchantments.js';
import { computeEntityMods } from './entityMods.js';   // RF1: the entity's folds ride the same round   // E1: the per-round item payload pump
import { claimSyntheticTimeIncrease, resetSyntheticTimeIncrease } from './effectBroker.js';   // AUDIT 63 F13: EntityEffectBroker.SyntheticTimeIncrease (:81, :244-248)
import { passiveSpecialsMagicRound } from './passiveSpecials.js';   // V2c: careers' regen/sun/holy/magery + the vampire's fire
// S41 - the day-change block's four members. They live in their own
// systems; this file is only the ONE PLACE that runs them on a day
// boundary, which is where PlayerEntity.Update runs them.
import { updateRegionalPrices, setWorldPriceSource, initialRegionPrice, priceWalkStep, applyPriceConditionFlags } from './shopStock.js';            // FormulaHelper.UpdateRegionalPrices (:2053); ECON1: the world's price seam and the walk's one-home pieces
import { REGION_COUNT } from './regionConditions.js';   // ECON1: the world's walk is region-major, as DFU's
import { ONLINE_EPOCH_MINUTES } from '../net/wire.js';   // ECON1: the world's economy begins the day the online world stood at the classic start
import { rollClimateWeathersForDay, evolveClimateWeathers } from './weatherSim.js';      // WeatherManager.SetClimateWeathers (:419); CLK2: the enhanced lane's hourly evolution
import { seededRng } from './wind.js';   // WORLD6b: the shared day's own generator for the region's walk
import { removeExpiredRooms } from './tavern.js';                 // PlayerEntity.RemoveExpiredRentedRooms (:257)
import { removeExpiredItems } from './createItem.js';             // X11b: ItemCollection.RemoveExpiredItems (:125), the per-minute sweep
import { tickPlayerTorch } from './playerTorch.js';               // T1: EnablePlayerTorch.Update, on the REAL clock
import { checkOverdueLoans, settleOverdueLoan } from './banking.js';   // LoanChecker.CheckOverdueLoans (:17)
import { lowerRepForCrime } from './court.js';                    // OverdueLoan's LowerRepForCrime (:70)
import { REGION_NAMES } from '../formats/mapsFile.js';            // loanReminder2's %s

import { handleStartingCrimeGuildQuests } from './crimeGuilds.js';   // CG2: PlayerEntity.Update:531

const SHARED_DAY_SEED = 0x44415953;   // 'DAYS'
/** AUDIT WORLD6b C5: each consumer of a day's rolls has its own SALT - the price walk and the faction powers fired
 *  on one day from one seed and drew the identical sequence from index zero (the weather's rollsFor has a salt for
 *  the same reason). */
export const DAY_SALT = Object.freeze({ prices: 1, powers: 2, priceInit: 3, conditions: 4 });   // ECON1: the world's opening indices, and the player's flag draws off the world's index
/** ECON1: THE day's generator - the world's day and the consumer's salt, whoever asks and whether or not the shared
 *  clock stands (the world's economy is a function of the day alone, computable anywhere). */
export const dayRng = (minute, salt = 0) => seededRng(((Math.floor(minute / MINUTES_PER_DAY) * 7919) ^ SHARED_DAY_SEED ^ Math.imul(salt | 0, 0x9E3779B1)) >>> 0);
/** WORLD6b: the generator a day's rolls come from. Under the shared clock the day's rolls are THE DAY'S - the price
 *  walk's and the faction powers' generator is seeded by the world's day (the weather's own law, WORLD5 rollsFor)
 *  and the consumer's salt; offline, the caller's own `rolls`. The powers' STATE stays each player's (they live on
 *  the entity, and quests move them - Multiplayer.md's first lock); the PRICES are the world's (ECON1, below). */
export const dayRollsFor = (minute, rolls, salt = 0) => (sharedClockOn() ? dayRng(minute, salt) : rolls);

// ECON1 (2026-09-17, the STOP list's "one economy"): THE REGION'S PRICES ARE THE WORLD'S. DFU walks each region's
// price index once a day on the player's own state (RandomizeInitialRegionalPrices at the start, UpdateRegionalPrices
// :2053-2088 each day), tilted by The Merchants' power against the region's. WORLD6b made the day's ROLLS the world's
// and left the STATE each player's, so two players who arrived on different days read different prices in one shop.
// Here the index is a pure function of the world's day: the opening indices are drawn on the world's epoch day (the
// day the online world stood at the classic start, ONLINE_EPOCH_MINUTES) from the day's own generator, region-major
// as DFU draws them, and every day since is walked with that day's generator, one roll a region, region-major. The
// merchants' tilt is DROPPED (the powers are each player's - quests move them - so the term was the one input that
// could not be the world's; the STOP record offered "split out or dropped"): the world's walk is the pure mean
// reversion around 1000 that DFU's own comment describes, with the tilt at zero. Catching up equals having stayed,
// and a player away a week reads exactly what one who stayed reads: today's index. No wire, no owner, no memory -
// every client computes the same numbers from the same day.
const ECON_EPOCH_DAY = Math.floor(ONLINE_EPOCH_MINUTES / MINUTES_PER_DAY);
let _worldPrices = null;   // { day, prices: number[REGION_COUNT] } - the last day computed; a later day walks on from it
/** ECON1: every region's index on a world day (an absolute day number, classic minutes / MINUTES_PER_DAY). A day
 *  before the epoch reads the epoch's. Cached by day and walked forward; a day behind the cache is rebuilt from the
 *  epoch, so the answer is the day's whatever was asked before. */
export function worldRegionPricesOn(day) {
  const d = Math.floor(Number.isFinite(day) ? day : ECON_EPOCH_DAY);
  if (!_worldPrices || _worldPrices.day > d) {   // (a day before the epoch lands here too and reads the epoch's: the walk below has nowhere to go)
    const init = dayRng(ECON_EPOCH_DAY * MINUTES_PER_DAY, DAY_SALT.priceInit);
    const prices = new Array(REGION_COUNT);
    for (let i = 0; i < REGION_COUNT; i++) prices[i] = initialRegionPrice(init());
    _worldPrices = { day: ECON_EPOCH_DAY, prices };
  }
  while (_worldPrices.day < d) {
    const next = _worldPrices.day + 1;
    const gen = dayRng(next * MINUTES_PER_DAY, DAY_SALT.prices);
    const prices = _worldPrices.prices.map((adj) => priceWalkStep(adj, 0, gen()));
    _worldPrices = { day: next, prices };
  }
  return _worldPrices.prices;
}
/** ECON1: one region's index at a classic minute of the world's (today's, by default). */
export const worldRegionPrice = (regionIndex, minute = worldMinutes()) => worldRegionPricesOn(Math.floor(minute / MINUTES_PER_DAY))[regionIndex | 0] ?? 1000;

export { MINUTES_PER_DAY };

/** Classic minutes advance 12x real seconds (one classic minute per 5s). */
export const CLASSIC_MINUTES_PER_SECOND = 12 / 60;

/** AUDIT 64 F27: `const float loanReminderHUDDelay = 3` (LoanChecker.cs:15),
 *  passed on BOTH of CheckOverdueLoans' AddHUDText calls (:42-45). The
 *  reminder is the ONLY warning before a default costs
 *  Crimes.LoanDefault reputation, so it holds three times as long as
 *  PopupText.popDelay's default second - the same reason
 *  ShopQualityHUDDelay exists. */
export const LOAN_REMINDER_HUD_DELAY = 3;

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
  // AUDIT 63 F13: the broker Update's synthetic-time bookkeeping
  // (EntityEffectBroker.cs:244-248). ONE claimed window is shielded per
  // raise, whatever its round count - DFU lowers the flag outside the
  // `if (catchupRounds > 0)` block, and so does this, because the claim
  // happens before the window is even measured. The lowering is deferred
  // to the NEXT claim so that the host's foe fan-out (which runs after
  // the player's half, and whose ItemDeteriorates/HealthLeech arms are
  // not player-gated) is still inside the shielded window; see
  // effectBroker.js's header for why that beats a per-host tail call.
  claimSyntheticTimeIncrease();
  const nextFloor = Math.floor(toMinute);
  const here = Math.floor(fromMinute);
  // Anchor on first use, and RE-anchor whenever the clock has moved BACKWARDS
  // relative to the marker - that is a load, and DFU sits it out through
  // `SaveLoadManager.Instance.LoadInProgress` (:206-207). This is a BACKSTOP,
  // not the load arm: DFU's load arm is InitMagicRoundTimer (:817-822, "after
  // world time has been set/restored"), which resets the marker WHICHEVER WAY
  // the clock moved, and restorePlayer (save.js) calls resetMagicRoundMarker
  // for exactly that. A backward-only re-anchor cannot cover a load FORWARD of
  // the session clock, which is the direction that fires the cap's worth of
  // rounds against effects the saved game had already lived through.
  if (_lastMagicRoundMinute === null || here < _lastMagicRoundMinute) _lastMagicRoundMinute = here;
  const from = Math.max(_lastMagicRoundMinute, nextFloor - MAX_CATCHUP_ROUNDS);
  // The broker's own lastGameMinute advance (:237). It never moves BACKWARDS
  // here: a rewind is a load, and the re-anchor above owns that case.
  if (nextFloor > _lastMagicRoundMinute) _lastMagicRoundMinute = nextFloor;
  // AUDIT WORLD5 C1: under the SHARED clock a claim made outside the tick (the dungeon's rest arm claims its own
  // window) moves the tick's last reading with it - the next tick reads from here, not from a reading BEHIND the
  // marker, which the backstop above would have taken for a load and re-anchored on, running the rested night's
  // rounds a second time
  if (_sharedClock && nextFloor > (_sharedLastTick ?? -Infinity)) _sharedLastTick = nextFloor;
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
    // V2a: the infection's deploy mints racialOverridePending in the
    // SAME round; the curse consumes it here so the turn is complete
    // before the next round's laws read the entity. The lycanthropy
    // fold then rides every round, exactly as RacialOverrideEffect's
    // constant pass does (a vampirism pending stands - V2b).
    consumeRacialOverridePending(entity, { now: r + 1 });
    consumeVampirismPending(entity, { now: r + 1 });
    lycanthropyMagicRound(entity, { nowMinutes: r + 1, say });
    vampirismMagicRound(entity, { nowMinutes: r + 1 });
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
    // RF1: the entity's modifier folds ride the same round, AFTER the
    // enchant fold - the equip listener keeps them current between
    // rounds; here is where a switch press is felt on a worn set.
    computeEntityMods(entity);
    // V2c: PassiveSpecials rides the same round, AFTER the enchant
    // fold - its magery arm SUMS the two producers into the one
    // maxMagickaModifier the accessor reads. Player-gated inside.
    passiveSpecialsMagicRound(entity, { nowMinutes: r + 1, sinks });
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
/**
 * S41 - PlayerEntity.Update's DAY-CHANGE BLOCK (:441-450), which the
 * port did not have a home for at all.
 *
 *     uint lastDay = lastGameMinutes / 1440;
 *     uint currentDay = gameMinutes / 1440;
 *     int daysPast = (int)(currentDay - lastDay);
 *     if (daysPast > 0) { UpdateRegionalPrices; SetClimateWeathers;
 *                         RemoveExpiredRentedRooms; CheckOverdueLoans; }
 *
 * FOUR members, and the port ran ONE of them. Three were ported as
 * laws and then never called on a day boundary by anybody:
 *
 *  - UpdateRegionalPrices was not ported at all, so every shop price
 *    in the world was frozen at its boot roll for the life of the
 *    character (shopStock.js).
 *  - SetClimateWeathers was fused into weatherSim's tickWeather with
 *    a SECOND private day marker, and only ran on an exterior frame,
 *    so days underground rolled the zones zero times.
 *  - RemoveExpiredRentedRooms ran when a tavern window opened and
 *    when a rest ENDED on an expired room, and nowhere else: sleep
 *    out a rental in a dungeon and the landlord never noticed, so
 *    the room's interior stayed a permanent scene forever.
 *  - CheckOverdueLoans had NO CALLER IN THE PORT. Every line of the
 *    loan system worked - borrow, repay, the 6/3/1-month reminder
 *    crossings, the account raid, the LoanDefault reputation hit -
 *    and none of it could ever fire, because nothing advanced a loan
 *    towards its due date. You could borrow the maximum in all 62
 *    regions and never owe a thing.
 *
 * It lives HERE, in the entity tick, because that is where DFU puts
 * it and because every one of its inputs is on the ENTITY - the
 * rentals, the bank accounts, the regional prices, the faction store,
 * the scene cache. Nothing has to be threaded from a host, which is
 * precisely why all four hosts get the law and none of them can
 * forget a line.
 *
 * DFU's own ordering is kept exactly, because three of the four draw
 * from the same generator.
 *
 * @param {number} lastMinutes  PlayerEntity.lastGameMinutes, BEFORE the tick
 *                              advanced it - the day block reads the marker's
 *                              old value and CheckOverdueLoans takes it whole.
 * @returns {{daysPast: number, loanReminders: object[], loanDefaults: number[]}}
 */
export function runDayChange({ entity, lastMinutes, nowMinutes, rolls = Math.random, say = () => {} } = {}) {
  const none = { daysPast: 0, loanReminders: [], loanDefaults: [] };
  if (!entity) return none;
  const daysPast = Math.floor(nowMinutes / MINUTES_PER_DAY) - Math.floor(lastMinutes / MINUTES_PER_DAY);
  if (!(daysPast > 0)) return none;
  // :446 - the merchants' tug-of-war on every region's price index.
  // S42: the condition store rides the entity like every other day-block
  // input, so the price walk's PricesHigh/PricesLow half reaches it with
  // no host wiring - the same reason the whole block lives here.
  // AUDIT WORLD6b C4: under the shared clock the walk is ONE DAY AT A TIME, each day from its own generator - one
  // generator seeded by today and walked `daysPast` days made the draw depend on when each player LAST ran the day
  // change (the walk is region-major, day-minor), so a player back from three days away walked a different region
  // than one who was there every day. Per day, the walk is a function of the state and the days walked alone:
  // catching up equals having stayed. Offline the caller's stream walks the span whole, as DFU does.
  // ECON1: under the shared clock the prices are THE WORLD'S (worldRegionPricesOn) and this player's `regionPrices`
  // are not walked and not written - the save keeps its own economy for its own world. What is this player's is the
  // CONDITION half (PricesHigh / PricesLow are the player's region-condition store, which the rumours and the court
  // read): it is applied from the world's index, one day at a time, with the day's own generator for the flag's
  // duration draw - so two players who walked different spans read the same flags.
  if (sharedClockOn()) {
    const firstDay = Math.floor(lastMinutes / MINUTES_PER_DAY) + 1, lastDay = Math.floor(nowMinutes / MINUTES_PER_DAY);
    for (let d = firstDay; d <= lastDay; d++) {
      const prices = worldRegionPricesOn(d), flagRolls = dayRng(d * MINUTES_PER_DAY, DAY_SALT.conditions);
      for (let i = 0; i < REGION_COUNT; i++) applyPriceConditionFlags(entity.regionConditions ?? null, i, prices[i], flagRolls);
    }
  } else updateRegionalPrices(entity, entity.factionRep?.dict ?? null, daysPast, rolls, entity.regionConditions ?? null);

  // :447-448 - roll the six climate zones and RAISE the pending-apply
  // flag; the exterior frame's tickWeather drains it. Splitting those
  // is not a liberty, it is WeatherManager's own shape (:146-156).
  rollClimateWeathersForDay(nowMinutes, rolls);

  // :449 - the landlord's sweep. `entity.sceneCache` may not exist yet
  // (a host that never entered a building), and removeExpiredRooms
  // takes null for exactly that.
  if (entity.rentedRooms?.length) {
    entity.rentedRooms = removeExpiredRooms(entity.rentedRooms, nowMinutes, entity.sceneCache ?? null);
  }

  // :450 - LoanChecker.CheckOverdueLoans(lastGameMinutes). DFU hands
  // it the OLD marker and reads `now` off WorldTime itself, which is
  // what makes the 6/3/1-month reminder a CROSSING rather than a
  // state - see banking.js.
  const loanReminders = [];
  const loanDefaults = [];
  if (entity.bankAccounts?.length) {
    const { reminders, overdue } = checkOverdueLoans(entity.bankAccounts, lastMinutes, nowMinutes);
    for (const r of reminders) {
      // Internal_Strings.csv:861-862, both lines, verbatim - DFU
      // AddHUDTexts them one after the other and the second carries
      // the region name.
      say(`You have a loan of ${r.owed} gold pieces due in`, LOAN_REMINDER_HUD_DELAY);
      say(`less than ${r.months} months in ${REGION_NAMES[r.regionIndex] ?? ''}`, LOAN_REMINDER_HUD_DELAY);
      loanReminders.push(r);
    }
    for (const regionIndex of overdue) {
      // OverdueLoan (:53-72): the account is raided first, and only a
      // loan still standing after that is a default.
      const outcome = settleOverdueLoan(entity.bankAccounts, regionIndex, entity);
      if (outcome.kind !== 'defaulted') continue;
      lowerRepForCrime(entity, regionIndex, outcome.crime);
      loanDefaults.push(regionIndex);
    }
  }
  return { daysPast, loanReminders, loanDefaults };
}

export function tickPlayerMinutes({
  entity,
  classicMinutes,
  dt,
  sinks,
  activity = { running: false, runningTally: false, swimming: false },   // AUDIT 64 F7: the tally's gate is its own (PlayerEntity.cs:311)
  fatigueMultiplier = 1,
  rolls = Math.random,
  say = () => {},
  // CG2: PlayerEnterExit.IsPlayerInside, the crime-guild letter's own
  // gate. Defaults FALSE - the outdoor answer - because the handler is
  // inert without a registered quest host anyway, so a host that has
  // not wired the quest machine cannot deliver a letter early.
  inside = false,
  // T1 (AUDIT 39): REAL seconds, which a clock JUMP has none of. `dt` is
  // the tick's game-time budget and a jump fabricates it
  // (minutes / CLASSIC_MINUTES_PER_SECOND, shared.js advance), so the two
  // real-time timers below - the torch's 20-second burn and refreshMods'
  // 0.2s - must be fed this instead: DFU's RaiseTime does not advance
  // Time.deltaTime, so a rested night burns no torch and cannot kill by
  // a drained stat. Defaults to dt, which is the frame case.
  realSeconds = dt,
} = {}) {
  // WORLD5: under the SHARED clock the world's time moved on its own between two ticks - this tick owes the rounds
  // and the days from the last tick's reading to now, and fabricates nothing from dt (a jump has no dt, and dt
  // still feeds the real-time arms below: the fatigue drain, the tallies, the torch)
  if (_sharedClock) {
    classicMinutes = _sharedLastTick ?? _sharedClock();
    // AUDIT WORLD5 C2: a source that stepped BACKWARDS (the relay's offset corrected, the machine's clock set back)
    // re-anchors the reading rather than freezing every tick until the clock catches its old self up
    if (_sharedClock() < classicMinutes) classicMinutes = _sharedClock();
  }
  const next = _sharedClock ? Math.max(classicMinutes, _sharedClock()) : classicMinutes + dt * CLASSIC_MINUTES_PER_SECOND;
  if (_sharedClock) _sharedLastTick = next;
  // AUDIT 39: the clock as it stood when this tick began. A sink can move
  // the WORLD clock from inside this call (the exhaustion collapse -
  // PlayerEntity.cs:2429's RaiseTime(1 hour), which the hosts fire out of
  // sinks.drainFatigue), and `next` above is fixed before any sink runs.
  // The composition happens at the return; see the note there.
  const clockAtEntry = worldMinutes();

  // THE BROKER, claimed once. The window comes back out in the result so the
  // host can run it on ITS foes - one raise, every manager (wave 32).
  const magicRoundWindow = claimMagicRounds(classicMinutes, next);
  const rounds = runMagicRoundsFor(entity, magicRoundWindow.from, magicRoundWindow.to, { sinks, rolls, say });

  // PLAYERENTITY'S OWN MARKER, which is not the broker's. The per-minute loop
  // in PlayerEntity.Update (:453-477) runs on lastGameMinutes and - this is the
  // part wave 30 got wrong by folding it into the round loop - has NO
  // 2880-minute cap. DFU steps a 21-day prison sentence through all 30,240 of
  // its minutes there while the broker sees only the last 2,880.
  //
  // The two values are captured HERE, at the top, because three separate things
  // downstream read them: the marker write just below, the day block, and the
  // normalise loop that follows it. The loop's own commentary is at its body.
  const lastMinutes = Number.isFinite(entity.lastGameMinutes) ? entity.lastGameMinutes : Math.floor(classicMinutes);
  const nowMinutes = Math.floor(next);
  // :521, the tail of the same update - but MONOTONIC, which is DFU's
  // own hard invariant rather than a liberty: PlayerEntity.cs:368-371
  // THROWS when `gameMinutes < lastGameMinutes`, so in DFU this marker
  // can never end a frame ahead of the clock and a calendar boundary is
  // therefore crossed exactly once.
  //
  // The port cannot make that a throw, because it has a caller DFU does
  // not: the exhaustion collapse. DFU's is PlayerEntity.cs:2429, a bare
  // `RaiseTime(1 hour)` that returns - the port's hosts implement it as
  // `playerTicker.advance(60)` (exterior.js, world.js; the dungeon adds
  // the hour to its clock ref directly), fired from inside
  // sinks.drainFatigue, which re-enters THIS FUNCTION from inside its own
  // fatigue band. The nested tick wrote the marker an hour ahead, the
  // outer frame then reset the world clock to its own smaller value, and
  // the marker was pulled BACK on the next frame - so the same midnight
  // was crossed, and processed, twice. (AUDIT 39 fixed the CLOCK half of
  // that seam at the return below; this clamp is still the marker's.)
  //
  // S41 is what made that reachable: before it, the only reader of this
  // marker was the 112-day reputation-normalise loop, and the weather
  // member - the one day-change law the port had - carried its own
  // monotonic module marker that was immune. Hanging all four day-change
  // members off this one exposed it. Measured: one collapse at 23:30
  // drifted the region price twice (1000 -> 980 -> 960), rolled the six
  // climate zones twice, and ran the room sweep and the loan check twice.
  //
  // Clamping restores DFU's invariant at the one seam that can break it.
  // A genuine BACKWARD move of the clock is a load, and that no longer
  // arrives here at all: save.js re-anchors the marker explicitly, which
  // is SerializablePlayer.cs:338-339.
  if (!Number.isFinite(entity.lastGameMinutes) || nowMinutes > entity.lastGameMinutes) {
    entity.lastGameMinutes = nowMinutes;
  }

  // PlayerEntity.cs:380-384, on the same `gameMinutes` the marker above
  // reads and BEFORE the fatigue band, exactly where DFU puts it: an
  // enemy alert older than eight hours goes out. It belongs to the
  // player's own update, so it lives on the tick every host runs -
  // hung off createPlayerTicker instead, it reached only the three
  // hosts that build one, and the dungeon (which calls this function
  // directly) raised the alert on every sighting and never lowered it,
  // permanently arming its own resting spawn roll.
  decayEnemyAlert(entity, nowMinutes);

  // PlayerEntity.cs:528-530, the tail of the SAME update: the flag is
  // a ONE-JUMP shield, cleared the moment the jump it covered is over.
  // AUDIT 24 (the seven-slice sweep): nothing set it and nothing
  // cleared it, so both halves of the rule were dead - the read above
  // was a constant `true`, and the prison arm's own comment ("it sets
  // PreventNormalizingReputations across the skip precisely so the
  // elapsed days cannot decay what it just credited... not harmless
  // now that it is [ported]") described a line that was not there.
  // (CLEARED BELOW, at the tail, which is where DFU clears it.)

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
  //
  // AUDIT 64 F7: its gate is its OWN - `playerMotor.IsRunning &&
  // !playerMotor.IsRiding` (:311), with no standing test - and it is
  // NOT the fatigue band's `IsRunning && !IsStandingStill` (:408,
  // below). The port drove both off one `activity.running` that the
  // hosts built with the fatigue condition, so a grounded player
  // holding Run in place tallied nothing where DFU tallies 4/s.
  if (activity.runningTally) {
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
    // AUDIT 26 F083: the CLIMBING arm heads DFU's band
    // (PlayerEntity.cs:405-408 - climbing, else running, else the
    // swimming arms; ClimbingFatigueLoss 22 at :110). The port tested
    // running and swimming alone and FATIGUE_LOSS.Climbing had zero
    // consumers - a climber paid half the classic drain per minute.
    if (activity.climbing) loss = FATIGUE_LOSS.Climbing;
    else if (activity.running) loss = FATIGUE_LOSS.Running;
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
    // S40 - PlayerEntity.cs:417-418, `if (!isResting) DecreaseFatigue`.
    // The gate is on THIS drain only: the jumping one above is C#'s
    // :427, outside the per-minute block and ungated, and the
    // Swimming tally at :414 runs BEFORE the gate, so both stay where
    // they are. Missing it cost 66 fatigue an hour through a rest -
    // and a LOITER, which by DFU's own law calls no tickVitals, has
    // nothing restoring it, so a long enough loiter drained the
    // player to exhaustion. The dungeon host was accidentally exempt
    // (its rest advance never routes through this tick); the three
    // hosts S40 gave rest to were not.
    if (!entity.isResting) sinks.drainFatigue?.(Math.trunc(loss * fatigueMultiplier));

    // X11b - PlayerEntity.cs:420-421, the very next statement after
    // that fatigue drain and inside the same per-minute block:
    // "Make magically-created items that have expired disappear".
    // It sits HERE and not in the magic-round loop for the reason
    // DFU's does: a conjured item's lifetime is wall-clock game
    // minutes, not effect rounds - the effect that made it ended the
    // moment the player picked, and the ITEM carries the clock.
    // It runs even while resting (DFU's !isResting gate covers only
    // the fatigue line above), which is the point: sleeping through
    // your conjured armour's expiry has to lose you the armour.
    removeExpiredItems(entity, Math.floor(next));
  }

  // T1 - EnablePlayerTorch.Update, and it sits OUTSIDE the per-minute
  // block on purpose: DFU accumulates Time.deltaTime toward a 20-REAL-
  // second timer (:26, :63), not game minutes. A torch burns on the
  // wall clock, so a paused game burns none of it and a fast time
  // scale does not eat it faster - the same reasoning that puts
  // killIfAnyLiveStatZero below on its own real-time cadence rather
  // than in a magic round.
  // AUDIT 39: fed realSeconds, NOT dt. A rested hour reaches this tick as
  // six fabricated 50-"second" frames, each over the 20-second threshold,
  // so an 8-hour sleep spent 48 of a Torch's 50 hit points where DFU
  // (whose RaiseTime never touches Time.deltaTime) spends none.
  tickPlayerTorch(entity, realSeconds, { say, rolls });

  // S41 - THE DAY CHANGE (PlayerEntity.cs:441-450). It sits AFTER the
  // fatigue band because DFU's does: the swimming roll at :412 is
  // drawn before the price rolls at :446, and a generator does not
  // forgive a reordered draw.
  runDayChange({ entity, lastMinutes, nowMinutes, rolls, say });
  // CLK2: the enhanced lane's HOURLY evolution of the six zones, on the
  // clock wherever the player is - after the day roll, since a day
  // boundary is an hour boundary too and the day's roll comes first.
  // Inert on the classic lane; its generator is its own.
  evolveClimateWeathers(nowMinutes);

  // PlayerEntity.cs:453-477, the per-minute loop - and it runs AFTER the day
  // block because DFU's does (:441-450 then :453-477). The port had it hoisted
  // to the top of this function, which is free for the roll stream (neither
  // this loop nor normalizeReputations draws one) but NOT free for state: the
  // day block's loan arm calls LowerRepForCrime (LoanChecker.cs:70), so on a
  // tick that crosses a 112-day boundary with a loan defaulting, DFU lands the
  // fresh -10 legal hit and then decays it by one in the same tick, while the
  // hoisted order decayed first and applied the hit after - one point of legal
  // reputation, and the same inversion on the faction channel the People
  // half writes. Every 112-day boundary IS a day boundary (161280 = 112 x
  // 1440), so the coincidence is only "a loan came due that day".
  //
  // AUDIT 23 (C4: guilds-4 = cross-1 = entity-6) - :455-459: every 161280th
  // game minute (112 days) normalizes the legal AND faction reputations toward
  // zero, unless the prison skip set preventNormalizingReputations for its
  // jump. (The other three arms of that loop - faction powers at 7 days,
  // regional conditions at 38, the racial override quest at 84 - are
  // unported.)
  //
  // It is OFF BY ONE from the broker's, deliberately. DFU tests
  // `(i + lastGameMinutes) % 161280 == 0` for i in [0, minutesPassed), i.e. the
  // minute VALUES [last, now) with no +1, while the broker's rounds represent
  // [last+1, now]. AUDIT 23 wrote this loop inside the broker's and inherited
  // its `r + 1`, so the port normalised one game minute late. DFU's own
  // inconsistency, reproduced.
  //
  // A rewound clock loops zero times rather than backwards; the restore
  // re-anchors the marker explicitly (SerializablePlayer.cs:338-339), which is
  // why the field is deliberately NOT in the save envelope.
  for (let i = lastMinutes; i < nowMinutes; i++) {
    if (i % NORMALIZE_INTERVAL_MINUTES === 0 && !entity.preventNormalizingReputations) {
      normalizeReputations(entity, entity.factionRep ?? null);
    }
    // S43 - :461-462, the SECOND arm of the :453-477 loop: every 7 days the
    // faction powers move. Until now nothing in the port ever changed a
    // faction's power, so S41's price walk - which tilts a region's
    // prices by The Merchants' power against the region's own - had a
    // constant for its whole tug-of-war term.
    // WORLD6b: both power arms of one minute draw from ONE generator, the day's (the 266-day minute where the two
    // align fires the walk twice, as DFU does, and the second walk must not replay the first's rolls)
    const dayRolls = dayRollsFor(i, rolls, DAY_SALT.powers);
    if (i % FACTION_POWER_INTERVAL_MINUTES === 0) {
      regionPowerUpdate(entity.factionRep ?? null, { rumorMill: entity.rumorMill ?? null, rolls: dayRolls });   // WORLD6b: the shared day's roll
    }
    // :468-472, the THIRD arm: every 38 days DFU calls the SAME member
    // with updateConditions true, which runs this power half AND the
    // conditions half. The power half therefore fires on both cadences,
    // and on the 266-day minute where the two align it fires TWICE -
    // two separate ifs, both calling a member that always walks the
    // powers. That is reproduced here, and so is the conditions body:
    // the alliances that end and start, the rivalries, the wars, the
    // famines and plagues and crime waves, and the new-ruler roll all
    // land through this one call (regionPower.js:factionConditionsStep),
    // over the S42 region store the player carries.
    //
    // DFU's own note on this arm is worth keeping: classic ran the
    // conditions version only on a minute divisible by BOTH 10080 and
    // 54720 - every 266 days - and DFU says "I'm pretty sure it was
    // supposed to be every 38 days" and made it so. A DFU deviation
    // from classic, inherited deliberately.
    if (i % REGION_CONDITIONS_INTERVAL_MINUTES === 0) {
      regionPowerUpdate(entity.factionRep ?? null, {
        rumorMill: entity.rumorMill ?? null, rolls: dayRolls,   // WORLD6b: the shared day's roll
        updateConditions: true, regionConditions: entity.regionConditions ?? null,
      });
      // :472 - StartRacialOverrideQuest(false) rides this same arm:
      // the vampire's P0A01L00 initiation, then the clan's own quests
      // (V2d; a no-op without a live override or a registered host).
      startRacialOverrideQuest(entity, false, { rolls });
    }
    // :475-476, the FOURTH arm - every 84 days, the CURE quest roll
    // ($CUREVAM at (10,100)<30, $CUREWER at (1,100)<30 once).
    if (i % CURE_QUEST_INTERVAL_MINUTES === 0) {
      startRacialOverrideQuest(entity, true, { rolls });
    }
  }

  // PlayerEntity.cs:528-530, the tail of the SAME update: the flag is a
  // ONE-JUMP shield, cleared the moment the jump it covered is over. It has to
  // sit below the loop that READS it, which is why it came down here with it.
  //
  // AUDIT 24 (the seven-slice sweep): nothing set it and nothing cleared it, so
  // both halves of the rule were dead - the read above was a constant `true`,
  // and the prison arm's own comment ("it sets PreventNormalizingReputations
  // across the skip precisely so the elapsed days cannot decay what it just
  // credited... not harmless now that it is [ported]") described a line that
  // was not there.
  if (entity.preventNormalizingReputations) entity.preventNormalizingReputations = false;

  // CG2 - HandleStartingCrimeGuildQuests (:1503-1522), called from
  // PlayerEntity.Update at :531: the line AFTER the two prevent-flag
  // resets above, which is why it sits here and not with the quest
  // starts further down. A theft or murder tally that crossed its
  // threshold stamped a clock three days out; this is where the clock
  // runs down and the invitation quest starts - and only OUTSIDE, so
  // the letter never finds the player in a dungeon.
  handleStartingCrimeGuildQuests(entity, { nowClassicMinutes: next, inside });

  // EntityEffectManager.UpdateEntityMods' tail (:1855-1866), on its own
  // 0.2s real-time cadence: a live stat at zero kills the host. It sits
  // here rather than in runMagicRounds because DFU's is not a magic
  // round - it is Update()'s refreshMods timer, and Time.deltaTime is
  // zero under a paused UI, which is why a rest cannot kill you this way.
  killIfAnyLiveStatZero(entity, sinks, realSeconds);

  // AUDIT 23 (entity-1): NO advancement here. DFU's PlayerEntity.Update
  // (:347-538) runs no RaiseSkills; the only call sites in the whole
  // tree are DaggerfallRestWindow.cs:731 (the finished popup's close)
  // and DaggerfallTravelPopUp.cs:380 (fast travel, unported). The
  // per-minute raise this tick used to run leveled characters mid-walk
  // without ever resting.
  // AUDIT 39 - THE COLLAPSE'S HOUR SURVIVES THE WRITE-BACK. `next` was
  // fixed at entry, and every host writes this value back OVER the live
  // clock (shared.js's ticker, dungeonContext's classicMinutesRef), so an
  // hour added from INSIDE this tick - the exhaustion collapse's
  // RaiseTime(1 hour) out of sinks.drainFatigue - was erased the moment
  // the tick returned: the port recovered the vitals of a rested hour
  // without spending it, and the backward clock move then re-anchored the
  // broker marker so that hour's magic rounds ran a second time. DFU has
  // no such write: PlayerEntity.Update only READS the clock (:367), so
  // the hour stands there. Composing the two is what makes it stand here.
  // A jump is only ever forward; a backward move is a load, and a load
  // does not arrive through this function.
  const jumped = worldMinutes() - clockAtEntry;
  return { classicMinutes: jumped > 0 ? next + jumped : next, rounds, magicRoundWindow };
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

// WORLD5 (Mac: "the shared clock and weather, and the quest clocks stood down online"): THE SHARED CLOCK. Online the
// world's time is a function of wall time (net/wire.js sharedClassicMinutes), the same on every client, and nothing
// local may move it - a rest, a fast travel, a sentence, a training session, ?tod. The source is installed by the
// world host at boot; while it stands, worldMinutes() reads it and every write is refused. The tick claims what the
// clock owes between two readings (tickPlayerMinutes) rather than fabricating minutes from dt.
let _sharedClock = null;
let _sharedLastTick = null;
/** Install (a function answering classic minutes) or remove (null) the shared clock. */
export function setSharedClock(source, wallOf = null) {
  _sharedClock = typeof source === 'function' ? source : null;
  _sharedWall = _sharedClock && typeof wallOf === 'function' ? wallOf : null;
  _sharedLastTick = null;
  // ECON1: the world's prices stand with the world's clock - every consumer of regionPriceAdjustment reads today's
  // world index while the clock stands, and the player's own again when it goes
  setWorldPriceSource(_sharedClock ? (regionIndex) => worldRegionPrice(regionIndex, _sharedClock()) : null);
}
export const sharedClockOn = () => _sharedClock !== null;

// OL3 (Mac, 2026-09-14): THE CLOCK DOES NOT PUNISH ABSENCE - the price is
// said in real time. Under the shared clock every world-time deadline (a
// rented room's expiry, a loan's due date) runs on wall time, through a
// logout: a week's lodging is fourteen real hours. The shared world keeps
// one clock, so the honest fix is that the player buys what they think
// they are buying: the host installs, beside the source, the inverse -
// the millisecond on THIS machine's clock at which the world reads a
// classic minute (wire.js wallMsForClassicMinutes, less the relay's
// offset) - and the tavern's offer and the bank's due-by say it.
let _sharedWall = null;
/** This machine's wall-clock ms for a classic minute under the shared clock, else null. */
export const sharedWallMs = (classicMinutes) => (_sharedWall && Number.isFinite(classicMinutes) ? _sharedWall(classicMinutes) : null);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Tue 15 Sep 18:00" on this machine's clock, in the game font's own ASCII (no locale, no glyph the font lacks). */
export function realTimeText(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return null;
  const two = (n) => String(n).padStart(2, '0');
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
/** The real time a classic minute falls at, as words, under the shared clock; null offline. */
export const sharedRealTimeText = (classicMinutes) => { const ms = sharedWallMs(classicMinutes); return ms == null ? null : realTimeText(ms); };

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
export const worldMinutes = () => (_sharedClock ? _sharedClock() : _worldMinutes);

/** Set the clock - a load restores it, a rest or a court sentence jumps it. WORLD5: refused under the shared clock. */
export function setWorldMinutes(v) {
  if (_sharedClock) return _sharedClock();
  _worldMinutes = Number.isFinite(v) ? v : 0;
  return _worldMinutes;
}

/** WORLD5: a player's own time markers set to the world's - the day marker, the broker's, every disease's day and
 *  every poison's minute - so a save from another time (a month behind, a year ahead) neither catches up a month of
 *  loans and diseases on its first online frame nor reads a negative day. The world's time is not this save's
 *  continuation; it is where the player has arrived. */
export function alignEntityClocks(entity, nowMinutes) {
  if (!entity || !Number.isFinite(nowMinutes)) return false;
  const now = Math.floor(nowMinutes);
  // AUDIT WORLD5 C3: a SHIFT, not a stamp. Every marker the save carries moves by the distance from the save's own
  // clock (its day marker) to the world's, so a room rented with twenty hours left keeps twenty hours, a loan due in
  // a week is due in a week, a summoned item lasts what it had left, and a skill check that was due is due now -
  // where a stamp of the four markers WORLD5 aligned left the rest dated by the save's clock: a save further along
  // than the world (an old character in a young world) raised no skill and trained nowhere for real days, and one
  // behind it read every deadline as long past. A "last" marker never lands ahead of now; a zero stays zero (it
  // means "never" or "none" - the letter clocks, a summoned item's hour, a first skill check). An entity with no day
  // marker (a fresh character) has nothing to measure from: its "last" markers are stamped to now and nothing else moves.
  const delta = Number.isFinite(entity.lastGameMinutes) ? now - Math.floor(entity.lastGameMinutes) : null;
  const dayDelta = delta === null ? null : Math.floor(now / MINUTES_PER_DAY) - Math.floor((now - delta) / MINUTES_PER_DAY);
  const past = (v) => (Number.isFinite(v) && v !== 0 ? Math.min(now, delta === null ? now : v + delta) : v);
  const due = (v) => (Number.isFinite(v) && v !== 0 && delta !== null ? v + delta : v);
  const pastDay = (v) => (Number.isFinite(v) && dayDelta !== null ? Math.min(Math.floor(now / MINUTES_PER_DAY), v + dayDelta) : v);
  entity.lastGameMinutes = now;
  resetMagicRoundMarker(now);
  _sharedLastTick = _sharedClock ? nowMinutes : null;
  for (const k of ['lastSkillCheckTime', 'timeOfLastSkillTraining', 'lastEnemyAlertTime']) if (k in entity) entity[k] = past(entity[k]);
  for (const k of ['timeForThievesGuildLetter', 'timeForDarkBrotherhoodLetter']) if (k in entity) entity[k] = due(entity[k]);
  for (const a of entity.activeEffects ?? []) {
    if (!a || typeof a !== 'object') continue;
    if (Number.isFinite(a.lastDay)) a.lastDay = pastDay(a.lastDay);
    if (Number.isFinite(a.lastMinute)) a.lastMinute = past(a.lastMinute);
  }
  const vamp = liveVampirism(entity);
  if (vamp && Number.isFinite(vamp.lastTimeFed)) vamp.lastTimeFed = past(vamp.lastTimeFed);
  for (const acct of entity.bankAccounts ?? []) if (acct && acct.loanTotal > 0) acct.loanDueDate = due(acct.loanDueDate);
  for (const room of entity.rentedRooms ?? []) if (room) room.expiryMinutes = due(room.expiryMinutes);
  for (const it of entity.items ?? []) if (it && Number.isFinite(it.timeForItemToDisappear)) it.timeForItemToDisappear = due(it.timeForItemToDisappear);
  const store = entity.guildMemberships;
  const books = store && typeof store === 'object' ? (Object.hasOwn(store, 'mortal') && Object.hasOwn(store, 'vampire') ? [store.mortal, store.vampire] : [store]) : [];
  for (const book of books) for (const m of Object.values(book ?? {})) if (m && Number.isFinite(m.lastRankChange)) m.lastRankChange = pastDay(m.lastRankChange);
  return true;
}

/** A LOAD resets the marker rather than catching up across it - DFU's
 *  `SaveLoadManager.Instance.LoadInProgress` early return (:206-207). Without
 *  this a restored save would fire the cap's worth of rounds on its first
 *  frame against effects that already expired in the saved game. */
export function resetMagicRoundMarker(v = null) {
  _lastMagicRoundMinute = v === null ? null : Math.floor(v);
  // AUDIT 63 F13: a load is a fresh broker, and nothing in DFU
  // serialises SyntheticTimeIncrease - a flag raised in the session
  // being replaced must not shield the restored one's first window.
  resetSyntheticTimeIncrease();
  return _lastMagicRoundMinute;
}

/** Move the clock forward (or back, for a load). WORLD5: refused under the shared clock. */
export function advanceWorldMinutes(delta) {
  if (_sharedClock) return _sharedClock();
  return setWorldMinutes(_worldMinutes + (Number(delta) || 0));
}
