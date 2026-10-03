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
import { runInfections, setRacialCurseDeployer } from './infection.js';   // V1: UpdateDisease's override, which the base walk skips; DISC10-D V2: the deploy's curse mint
import { consumeRacialOverridePending, lycanthropyMagicRound } from './lycanthropy.js';   // V2a: the curse the deploy mints
import { consumeVampirismPending, vampirismMagicRound } from './vampirism.js';   // V2b: the other curse
import { updatePoisons } from './poisons.js';
import { tickActiveEffects } from './effects.js';
import { skillValue, tallyMovementSkill, SKILLS } from './skills.js';   // MOVE-REAL: the motion tallies' own door
import { FATIGUE_LOSS, FATIGUE_DRAIN_SCALE, killIfAnyLiveStatZero } from './statMods.js';
import { decayEnemyAlert } from './encounters.js';   // PlayerEntity.Update:380-384, the 8-hour alert decay
import { dice100, setPlayerStruckHook } from '../combat/formulas.js';
import { installPcaao } from '../combat/pcaao.js';   // PCO1: the mod's RegisterOverride, once, for every host
import { installMeanerMonsters } from '../characters/meanerMonsters.js';   // MM1: its xml billboard scales join the registry, once
import { installUnleveledLoot } from './unleveledLoot.js';   // UL1: its two material overrides and its death handler, once
import { onLycanthropeHit } from './lycanthropy.js';
import { onVampireHit } from './vampirism.js';
import { onPlayerStruckByEnemy } from './artifactEffects.js';   // V3: the Ring of Namira's reflection

/**
 * DISC10-D H1: RacialOverrideEffect.OnWeaponHitEntity - THE ONE DISPATCHER,
 * called by the player's strike resolution AFTER the target's health moved,
 * for every weapon connect whatever the damage: WeaponManager.WeaponDamage
 * runs DecreaseHealth, HandleAttackFromSource and then this
 * (WeaponManager.cs:627-635), and a murdered civilian gets it straight after
 * SetHealth(0) (:514-521). A player's ARROW is the same call - BowDamage
 * routes the shaft back through WeaponDamage (DaggerfallMissile.cs:680-687).
 * Spells never reach it, and neither does a PEER's blow applied here: it is
 * the local player's own weapon, and nothing else, that feeds or kills.
 *
 * The vampire's body is UpdateSatiation (VampirismEffect.cs:189-193); the
 * werewolf's is KilledInnocent -> UpdateSatiation (LycanthropyEffect.cs
 * :347-354, :383-407). Both read the clock themselves
 * (ToClassicDaggerfallTime), so the stamp is the LIVE minute.
 *
 * It used to be a hook registered into the damage FORMULA's tail - before
 * any door had subtracted anything, and after an early return for an
 * ineffective material. The strike sites call it now: cityGuards'
 * resolvePlayerHit and resolveCivilianHit, exteriorFoes' and
 * dungeonContext's resolvePlayerHit, and arrowFlight's playerArrowHitFoe.
 *
 * @param {object} player   the player entity (GetRacialOverrideEffect's owner)
 * @param {object} target   the struck entity, AFTER its health was taken
 * @param {object} [o]
 * @param {number} [o.nowMinutes]  the live classic minute
 * @param {boolean} [o.isCivilian] EntityTypes.CivilianNPC
 * @param {number|null} [o.mobileType] MobileEnemy.ID - the city watch is an innocent
 */
export function playerWeaponHitEntity(player, target, { nowMinutes = Math.floor(ownMinutes()), isCivilian = false, mobileType = null } = {}) {   // LIVED1: the feeding and the kill stamp the character's own clock
  if (!player?.racialOverride) return;   // `if (racialOverride != null)` (WeaponManager.cs:632-634)
  onVampireHit(player, nowMinutes);
  onLycanthropeHit(player, target, { nowMinutes, isCivilian, mobileType: mobileType ?? target?.mobileType ?? null });
}
/**
 * DISC10-E online: OnWeaponHitEntity's DEATH, reported. DFU reads the
 * target's health after DecreaseHealth, in the same call; online a peer's
 * watchman dies at its OWNER, so the striker's call above read a live
 * puppet and the owner's "your blow killed it" arrives a round trip later
 * (exteriorFoes' `slain` arm). Only the half that asks about the death
 * runs - KilledInnocent - on the live minute: the vampire already fed on
 * the blow itself, and feeding twice for one blow is no law of DFU's.
 */
export function playerWeaponKillReported(player, { nowMinutes = Math.floor(ownMinutes()), isCivilian = false, mobileType = null } = {}) {
  if (!player?.racialOverride) return;
  onLycanthropeHit(player, { health: 0 }, { nowMinutes, isCivilian, mobileType });
}
// DISC10-D V2: the deploy's own curse mint (DeployFullBlownVampirism
// :176-184 assigns the curse inside the deploy, after the RaiseTime). The
// curses import infection.js, so infection.js cannot import them; this
// module imports both consumers already, and every host loads it.
setRacialCurseDeployer((entity, { now }) => {
  consumeRacialOverridePending(entity, { now });
  consumeVampirismPending(entity, { now });
});
// V3: the other tail - an enemy damaging the player runs the Ring of
// Namira's reflection (registered here for the same cycle reason).
setPlayerStruckHook((attacker, target, damage) => onPlayerStruckByEnemy(attacker, target, damage));
// PCO1: Physical Combat And Armor Overhaul's three overrides - each
// reads its module switch live and declines when off.
installMeanerMonsters();   // MM1: before the overhaul, as DFU Awakes the dependency first
installPcaao();
installUnleveledLoot();   // UL1: after everything it would override (its manifest orders it after Roleplay Realism)
installSurvivalIcons();   // SURV2: the mod's spoiled-food and waterskin icons ride the texture pipeline as the port's own art
installSurvivalLoot({ enabled: corpseFoodOn });   // SURV2: an animal's corpse carries meat, a humanoid's sometimes a meal (after UL1, which walks the gold); off with the one switch - offline (CORPSE-FOOD: online the body's food is the room's)
// AUDIT-THUNDERLOCK F1: the port's own weapon was DEAD. Its module
// registers everything it is at import - the two custom templates, the
// pellet as ammunition, the unique find, its legendary - and NOTHING
// IN THE APP IMPORTED IT. The tests did, which is exactly why they all
// passed: a suite that imports the module under test brings the side
// effects with it. In the running game the weapon had no template row,
// could never drop, and had no icons. This call is what carries the
// import, the same wire SURV2's icons come in by - AFTER the survival
// pair, whose adjacency that mod's own pin holds.
installThunderlockIcons();   // THUNDERLOCK: the templates, the find and the legendary register at its import; the icons here
import { normalizeReputations, NORMALIZE_INTERVAL_MINUTES, RECOVERY_INTERVAL_MINUTES } from './court.js';   // AUDIT 23 (C4); REP4: the week's recovery
// S43: the entity update's 7-day and 38-day arms (PlayerEntity.cs:460-472).
import { regionPowerUpdate } from './regionPower.js';
import { runSurvivalMinutes, clearSurvivalMods, pauseSurvival } from './survival/needs.js';   // SURV1: the needs, a world minute at a time; AUDIT SURV A: and the drains dropped when the feed stops; AUDIT SURV-TIERS: and paused while Off
import { installSurvivalIcons } from './survival/items.js';   // SURV2: the templates register at its import; the icons here
import { installThunderlockIcons } from './thunderlock.js';   // THUNDERLOCK: same wire - the import IS the registration (AUDIT-THUNDERLOCK F1)
import { installSurvivalLoot } from './survival/loot.js';   // SURV2: the corpse's food
import { survivalOn, corpseFoodOn } from './survival/switch.js';   // SURV2: the one switch; CORPSE-FOOD: and the body's food, the room's online
/** :462 - `% 10080`, seven days of game minutes. */
export const FACTION_POWER_INTERVAL_MINUTES = 10080;
/** :469 - `% 54720`, thirty-eight days. */
export const REGION_CONDITIONS_INTERVAL_MINUTES = 54720;
// V2d: the same loop's racial-quest arms (:472 rides the 38-day
// minute, :475-476 adds the 84-day cure minute).
import { startRacialOverrideQuest, CURE_QUEST_INTERVAL_MINUTES, ONLINE_RACIAL_INTERVAL_MINUTES, racialArmIdle } from './racialQuests.js';
import { CLASSIC_GAME_START_TIME } from './gameDate.js';
import { RACES } from './races.js';

/** PlayerEntity.cs:263 - the classic day is elapsed minutes / 1440. */
// AUDIT 24 (wave 24): one home, systems/gameDate.js.
import { MINUTES_PER_DAY, DUSK_HOUR, isDayFromMinutes } from './gameDate.js';
import { enchantmentMagicRound } from './enchantments.js';
import { computeEntityMods } from './entityMods.js';   // RF1: the entity's folds ride the same round   // E1: the per-round item payload pump
import { claimSyntheticTimeIncrease, resetSyntheticTimeIncrease } from './effectBroker.js';   // AUDIT 63 F13: EntityEffectBroker.SyntheticTimeIncrease (:81, :244-248)
import { passiveSpecialsMagicRound } from './passiveSpecials.js';   // V2c: careers' regen/sun/holy/magery + the vampire's fire
// S41 - the day-change block's four members. They live in their own
// systems; this file is only the ONE PLACE that runs them on a day
// boundary, which is where PlayerEntity.Update runs them.
import { updateRegionalPrices, setWorldPriceSource, initialRegionPrice, priceWalkStep, applyPriceConditionFlags } from './shopStock.js';
import { findFactionByTypeAndRegion } from './talk.js';   // AUDIT ALL E8: the online flag arm skips a region with no Province faction, as DFU's walk does
import { FACTION_TYPES } from '../formats/factionFile.js';
import { MERCHANTS_FACTION_ID } from './guilds.js';   // AUDIT ALL E8: no Merchants, no walk, no flags (DFU's own gate)            // FormulaHelper.UpdateRegionalPrices (:2053); ECON1: the world's price seam and the walk's one-home pieces
import { REGION_COUNT } from './regionConditions.js';   // ECON1: the world's walk is region-major, as DFU's
import { ONLINE_EPOCH_MINUTES, ONLINE_MINUTES_PER_MS } from '../net/wire.js';   // ECON1: the world's economy begins the day the online world stood at the classic start
import { rollClimateWeathersForDay, evolveClimateWeathers } from './weatherSim.js';
import { setSkyCalendar } from './skyCalendar.js';   // TIME1: the weather's season and hour are the sky's, switched on with the sky      // WeatherManager.SetClimateWeathers (:419); CLK2: the enhanced lane's hourly evolution
import { seededRng } from './wind.js';   // WORLD6b: the shared day's own generator for the region's walk
import { removeExpiredRooms } from './tavern.js';                 // PlayerEntity.RemoveExpiredRentedRooms (:257)
import { removeExpiredItems } from './createItem.js';             // X11b: ItemCollection.RemoveExpiredItems (:125), the per-minute sweep
import { tickPlayerTorch } from './playerTorch.js';               // T1: EnablePlayerTorch.Update, on the REAL clock
import { checkOverdueLoans, settleOverdueLoan, callInEmpireDebt, empireCallInLines, calculateMaxBankLoan, bankedGold, empireDrawLines } from './banking.js';   // LoanChecker.CheckOverdueLoans (:17); REALM P0.3: the Empire's call at the join; EMPIRE-ACCOUNT: what it draws, said
import { isOnlinePage } from './onlineLane.js';   // EMPIRE-ACCOUNT: the Empire's draw is said online
import { lowerRepForCrime, deductGold } from './court.js';                    // OverdueLoan's LowerRepForCrime (:70); REALM P0.3: the call's purse
import { REGION_NAMES } from '../formats/mapsFile.js';            // loanReminder2's %s
import { localizedText, formatText, getLocalizedRegionName } from './textManager.js';      // L10N3d: the two lines in the player's language; L10N3e: the region shown

import { handleStartingCrimeGuildQuests } from './crimeGuilds.js';   // CG2: PlayerEntity.Update:531

const SHARED_DAY_SEED = 0x44415953;   // 'DAYS'
/** AUDIT WORLD6b C5: each consumer of a day's rolls has its own SALT - the price walk and the faction powers fired
 *  on one day from one seed and drew the identical sequence from index zero (the weather's rollsFor has a salt for
 *  the same reason). */
export const DAY_SALT = Object.freeze({ prices: 1, powers: 2, priceInit: 3, conditions: 4, raids: 5 });   // ECON1: the world's opening indices, and the player's flag draws off the world's index; RAID1: the day's raids (systems/raidingParties.js)
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
// AUDIT ALL E4: a rebuild from the epoch grew without bound (twelve game days a real day: past a frame budget in under
// two real years) - a checkpoint every CHECKPOINT_DAYS bounds a rebuild to that many steps
const CHECKPOINT_DAYS = 512;
const _checkpoints = new Map();   // day -> prices, at multiples of CHECKPOINT_DAYS
// AUDIT ALL E1: the world's tilt - a function of the region index over the game's own base powers (shopStock
// .worldPriceTiltOf), installed by the world host once FACTION.TXT is read; null for a region DFU walks nothing for.
// Until installed the walk is untilted (a boot's first seconds; no shop is open yet) and a later install starts the
// world over from the epoch, so every client that has the file walks the same numbers.
let _worldTilt = null;
/** ECON1 / AUDIT ALL E1: install (a function of a region index answering the tilt, or null to walk nothing) or remove the
 *  world's tilt; the cache starts over, the tilt being part of every step. */
export function setWorldPriceTilt(tiltOf) { _worldTilt = typeof tiltOf === 'function' ? tiltOf : null; _worldPrices = null; _checkpoints.clear(); }
export const worldPriceTiltOn = () => _worldTilt !== null;
/** AUDIT ALL E4 (a probe): the days a checkpoint stands on, for the pin that proves a rebuild is bounded. */
export const worldPriceCheckpointDays = () => [..._checkpoints.keys()].sort((a, b) => a - b);
/** ECON1: every region's index on a world day (an absolute day number, classic minutes / MINUTES_PER_DAY). A day
 *  before the epoch reads the epoch's. Cached by day and walked forward; a day behind the cache is rebuilt from the
 *  epoch, so the answer is the day's whatever was asked before. */
export function worldRegionPricesOn(day) {
  const d = Math.floor(Number.isFinite(day) ? day : ECON_EPOCH_DAY);
  if (!_worldPrices || _worldPrices.day > d) {   // (a day before the epoch lands here too and reads the epoch's: the walk below has nowhere to go)
    // AUDIT ALL E4: from the newest checkpoint at or before the day, else from the epoch
    let from = null;
    for (const [cd, cp] of _checkpoints) if (cd <= d && (!from || cd > from.day)) from = { day: cd, prices: cp };
    if (from) _worldPrices = { day: from.day, prices: from.prices.slice() };
    else {
      const init = dayRng(ECON_EPOCH_DAY * MINUTES_PER_DAY, DAY_SALT.priceInit);
      const prices = new Array(REGION_COUNT);
      for (let i = 0; i < REGION_COUNT; i++) prices[i] = initialRegionPrice(init());
      _worldPrices = { day: ECON_EPOCH_DAY, prices };
    }
  }
  while (_worldPrices.day < d) {
    const next = _worldPrices.day + 1;
    const gen = dayRng(next * MINUTES_PER_DAY, DAY_SALT.prices);
    // AUDIT ALL E1: the day's roll is DRAWN for every region in order (DFU's stream position), and spent on a step only
    // where DFU walks - a region with no Province faction, or a world with no Merchants (the tilt answers null), stands
    const prices = _worldPrices.prices.map((adj, i) => { const roll = gen(); const tilt = _worldTilt ? _worldTilt(i) : 0; return tilt == null ? adj : priceWalkStep(adj, tilt, roll); });
    _worldPrices = { day: next, prices };
    if (next % CHECKPOINT_DAYS === 0 && !_checkpoints.has(next)) _checkpoints.set(next, prices.slice());
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
  // (AUDIT WORLD5 C1 moved the tick's world reading with a claim made outside the tick, because a rested night's
  // rounds were claimed on minutes the world's clock had not reached. LIVED1 retired it: the broker counts the
  // character's own minutes and the world's reading is the world's - a rested night moves the one and not the other.)
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
/** RR1: `EntityEffectBroker.OnNewMagicRound += ...` for a law that is not
 *  an effect - Roleplay & Realism's encumbrance penalty subscribes so.
 *  Registered by name; `fn(entity, { nowMinutes, sinks, say })` runs after
 *  the entity's own round, for every entity the ticker fans out to. */
const _roundHooks = new Map();
export function registerMagicRoundHook(name, fn) { if (typeof fn === 'function') _roundHooks.set(name, fn); else _roundHooks.delete(name); }

export function runMagicRoundsFor(entity, from, to, { sinks, rolls = Math.random, say = () => {} , enchantCtx = null, skyMinutes = null } = {}) {
  if (!entity || !(to > from)) return 0;
  let rounds = 0;
  // DISC10-D V1: THE CLOCK EVERY CATCH-UP ROUND READS IS TODAY'S.
  // EntityEffectBroker.Update raises the whole catch-up loop inside ONE
  // frame (:210-232), so every round of a fast travel or of the turn's
  // fortnight reads WorldTime.Now - the CURRENT minute, the window's end -
  // wherever the curse laws ask what time it is: DamageFromSunlight's IsDay
  // (PassiveSpecialsEffect.cs:149-172), the curses' satiation and moon
  // reads, the infection's day (VampirismInfection.cs:117). `r + 1` stays
  // the ROUND's number, the port's MagicRoundsSinceStartup stand-in for the
  // `% N` cadences. Read off each past round's minute instead, a vampire who
  // arrived at night burned for every daylight hour of the road behind him
  // (~4320 over the 2880-round cap).
  const clockMinutes = to;
  // LIVED1: THE SKY IS THE WORLD'S. Offline WorldTime.Now is the window's end - the one clock. Online the window is
  // the character's own time and the sun and the moons are the world's: the reading the tick took (null answers the
  // window's end, which is the offline clock and every foe pool's fan-out).
  const sky = Number.isFinite(skyMinutes) ? skyMinutes : clockMinutes;
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
    runInfections(entity, Math.floor(clockMinutes / MINUTES_PER_DAY), { clockMinutes });   // DISC10-D V1: the day of WorldTime.Now; DISC10-E V2: and the clock a turn in this round is minted at
    // V2a: the infection's deploy mints racialOverridePending in the
    // SAME round; the curse consumes it here so the turn is complete
    // before the next round's laws read the entity. The lycanthropy
    // fold then rides every round, exactly as RacialOverrideEffect's
    // constant pass does.
    // DISC10-D V2: the deploy now mints the curse ITSELF, at the live
    // clock (infection.js's registered deployer, registered below) - so a
    // marker still standing here is a save restored between the turn and
    // the curse, consumed at the clock the curse's Start reads
    // (UpdateSatiation, LycanthropyEffect.cs:159 / VampirismEffect.cs:95-96).
    consumeRacialOverridePending(entity, { now: clockMinutes });
    consumeVampirismPending(entity, { now: clockMinutes });
    lycanthropyMagicRound(entity, { nowMinutes: r + 1, clockMinutes, skyMinutes: sky, moonNight: Number.isFinite(skyMinutes), say });   // DISC10-E V1: the round for the nag's cadence, the clock for the kill; LIVED1: the sky's for the moon; TIME2: a sky handed is the online lane, where the full moon forces its night alone
    vampirismMagicRound(entity, { nowMinutes: clockMinutes, skyMinutes: sky });   // DISC10-D V1: IsSatiated reads the clock (VampirismEffect.cs:238-241); LIVED1: VAMP-DAY's day the sky's
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
    passiveSpecialsMagicRound(entity, { nowMinutes: r + 1, clockMinutes: sky, sinks });   // DISC10-D V1: the cadence off the round, the sky off the clock (LIVED1: the world's)
    for (const fn of _roundHooks.values()) fn(entity, { nowMinutes: r + 1, sinks, say });   // RR1: EntityEffectBroker.OnNewMagicRound's other subscribers (a mod's, by name)
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
 * @param {object} [o.activity]    { running, swimming } - the fatigue band; MOVE-REAL: + `odometer`, the motor's live { h, v }
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
/** LIVED1: which half of the day block (and of the calendar's per-minute arms) a walk runs - all of it offline, where
 *  the world's clock and the character's are one; online the WORLD's half over the world's window and the character's
 *  OWN over theirs. */
export const DAY_ARMS = Object.freeze({ all: 'all', world: 'world', own: 'own' });
export function runDayChange({ entity, lastMinutes, nowMinutes, rolls = Math.random, say = () => {}, arms = DAY_ARMS.all } = {}) {
  const none = { daysPast: 0, loanReminders: [], loanDefaults: [] };
  if (!entity) return none;
  const worldHalf = arms !== DAY_ARMS.own, ownHalf = arms !== DAY_ARMS.world;
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
  // LIVED1: the price walk is the WORLD's half - online its day is the world's, walked on the world's window.
  if (worldHalf && sharedClockOn()) {
    const firstDay = Math.floor(lastMinutes / MINUTES_PER_DAY) + 1, lastDay = Math.floor(nowMinutes / MINUTES_PER_DAY);
    // AUDIT ALL E8: and only for a region DFU's own walk reaches - one with a Province faction in this player's store
    // (updateRegionalPrices' `continue`); with no store or no Merchants DFU walks nothing and flags nothing
    const dict = entity.factionRep?.dict ?? null, merchants = dict?.get(MERCHANTS_FACTION_ID) ?? null;
    for (let d = firstDay; d <= lastDay && merchants; d++) {
      const prices = worldRegionPricesOn(d), flagRolls = dayRng(d * MINUTES_PER_DAY, DAY_SALT.conditions);
      for (let i = 0; i < REGION_COUNT; i++) if (findFactionByTypeAndRegion(dict, FACTION_TYPES.Province, i)) applyPriceConditionFlags(entity.regionConditions ?? null, i, prices[i], flagRolls);
    }
  } else if (worldHalf) updateRegionalPrices(entity, entity.factionRep?.dict ?? null, daysPast, rolls, entity.regionConditions ?? null);

  // :447-448 - roll the six climate zones and RAISE the pending-apply
  // flag; the exterior frame's tickWeather drains it. Splitting those
  // is not a liberty, it is WeatherManager's own shape (:146-156).
  if (worldHalf) rollClimateWeathersForDay(nowMinutes, rolls);
  if (!ownHalf) return { daysPast, loanReminders: [], loanDefaults: [] };   // LIVED1: the world's half alone

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
      // the region name, as shown (GetLocalizedRegionName, LoanChecker.cs:45).
      say(formatText(localizedText('loanReminder', 'You have a loan of {0} gold pieces due in'), r.owed), LOAN_REMINDER_HUD_DELAY);
      say(formatText(localizedText('loanReminder2', 'less than {0} months in {1}'), r.months,
        getLocalizedRegionName(r.regionIndex, (i) => REGION_NAMES[i] ?? '')), LOAN_REMINDER_HUD_DELAY);
      loanReminders.push(r);
    }
    for (const regionIndex of overdue) {
      // OverdueLoan (:53-72): the account is raided first, and only a
      // loan still standing after that is a default.
      const outcome = settleSaid(entity, regionIndex, say);
      if (outcome.kind !== 'defaulted') continue;
      lowerRepForCrime(entity, regionIndex, outcome.crime);
      loanDefaults.push(regionIndex);
    }
  }
  return { daysPast, loanReminders, loanDefaults };
}

/** EMPIRE-ACCOUNT: AN OVERDUE LOAN SETTLED (banking.js settleOverdueLoan, on the character's own accounts), and online
 *  what the Empire drew for it said - the account, then every branch, which a default took without a word. */
function settleSaid(entity, regionIndex, say) {
  const banked = bankedGold(entity.bankAccounts);
  const outcome = settleOverdueLoan(entity.bankAccounts, regionIndex, entity);
  if (isOnlinePage()) for (const line of empireDrawLines(banked - bankedGold(entity.bankAccounts), REGION_NAMES[regionIndex] ?? '')) say(line, LOAN_REMINDER_HUD_DELAY);
  return outcome;
}

/** REALM P0.3: THE EMPIRE'S CALL AS A CHARACTER JOINS (banking.js callInEmpireDebt). The debt brought online past the
 *  Empire's one loan is paid from the accounts and the purse (DeductGoldAmount's coins, then letters), and a call left
 *  unpaid is settled as the day's sweep above settles an overdue loan: a default, with the region's reputation. Run on
 *  the character's own clock (LIVED1: the loans are theirs, and their due dates were stamped on it), after the
 *  arrival. Answers the call; its lines go to the HUD. */
export function empireJoin({ entity, nowMinutes, say = () => {} } = {}) {
  const accounts = entity?.bankAccounts;
  if (!accounts?.length) return null;
  // AUDIT REALM L3-F8: A LOAN DUE AT THE JOIN STANDS IN NO GOOD STANDING. Customs' unpaid call falls due at the save's own
  // minute (realmCustoms.js), and the character's clock is restored at that minute (LIVED1) - due now, so the Empire kept it
  // as its one loan in good standing when it fit the cap: no default, no reputation, "none for a newcomer" undone. A
  // loan already due is settled first, as the day's sweep settles an overdue one; the Empire keeps only one not yet due.
  const now = Math.floor(nowMinutes);
  for (let r = 0; r < accounts.length; r++) {
    const due = accounts[r]?.loanDueDate;
    if (!(accounts[r]?.loanTotal > 0) || !due || due > now) continue;
    const outcome = settleSaid(entity, r, say);
    if (outcome.kind === 'defaulted') lowerRepForCrime(entity, r, outcome.crime);
  }
  const call = callInEmpireDebt(accounts, { deductGold: (n) => deductGold(entity, n) }, { cap: calculateMaxBankLoan(entity.level ?? 1), nowMinutes: now });
  for (const regionIndex of call.unpaid) {
    const outcome = settleSaid(entity, regionIndex, say);
    if (outcome.kind === 'defaulted') lowerRepForCrime(entity, regionIndex, outcome.crime);
  }
  for (const line of empireCallInLines(call)) say(line, LOAN_REMINDER_HUD_DELAY);
  return call;
}

export function tickPlayerMinutes(args = {}) {
  _tickDepth++;
  try { return tickPlayerMinutesOnce(args); } finally { _tickDepth--; }
}
function tickPlayerMinutesOnce({
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
  // SURV1: the needs' law, when the host feeds it - { env, deps } as
  // survival/needs.js survivalMinute takes them; null runs nothing.
  survival = null,
  // LIVED1: a RaiseTime's minutes, online - the character's own time the world does not wait for (the ticker's
  // advance: a rest's sub-tick, a journey, a training session). Offline the host fabricates dt for them instead, as
  // it always has; the one clock moves and the tick walks it.
  raiseMinutes = 0,
} = {}) {
  // WORLD5 + LIVED1: TWO WINDOWS under the shared clock. The WORLD's is its movement since the last reading - this
  // tick owes the world's arms (the day's price flags and sky, the hourly climate, the faction powers) exactly that,
  // and fabricates nothing from dt. The CHARACTER's is their own clock, which ran with the world's over the same
  // minutes and ahead of it by any raise: the broker, the per-minute loop, the needs and the character's calendar walk
  // it. Offline the two are one clock and one window, and nothing below reads differently.
  let worldFrom = null, worldTo = null;
  if (_sharedClock) {
    const reading = _sharedClock();
    worldFrom = _sharedLastTick ?? reading;
    // AUDIT WORLD5 C2: a source that stepped BACKWARDS (the relay's offset corrected, the machine's clock set back)
    // re-anchors the reading rather than freezing every tick until the clock catches its old self up
    if (reading < worldFrom) worldFrom = reading;
    worldTo = Math.max(worldFrom, reading);
    _sharedLastTick = worldTo;
    // a character with no clock of their own yet (born online, no save to restore one from) starts it at the world's
    // LAST reading, so the window below is counted once - ownMinutes() would read the world's current one
    classicMinutes = _ownMinutes ?? worldFrom;
    _ownMinutes = classicMinutes + (worldTo - worldFrom) + (raiseMinutes > 0 ? raiseMinutes : 0);
    if (raiseMinutes > 0) _raisedMinutes += raiseMinutes;   // TIME3: the raise, counted - a quest charges it whole
  }
  // AUDIT LIVED1 I: the world's arms walk no world minute twice - AUDIT LIVED1b P3: and lose none lived; they walk the
  // parts of the reading's window no walk this session covered (worldArmsPieces)
  const worldPieces = _sharedClock ? worldArmsPieces(Math.floor(worldFrom), Math.floor(worldTo)) : null;
  const next = _sharedClock ? _ownMinutes : classicMinutes + dt * CLASSIC_MINUTES_PER_SECOND;
  // AUDIT 39: the clock as it stood when this tick began. A sink can move
  // the WORLD clock from inside this call (the exhaustion collapse -
  // PlayerEntity.cs:2429's RaiseTime(1 hour), which the hosts fire out of
  // sinks.drainFatigue), and `next` above is fixed before any sink runs.
  // The composition happens at the return; see the note there. (LIVED1:
  // offline only - online a nested raise moves the character's own clock,
  // which no host writes back over.)
  const clockAtEntry = worldMinutes();

  // THE BROKER, claimed once. The window comes back out in the result so the
  // host can run it on ITS foes - one raise, every manager (wave 32).
  // LIVED1: on the character's own clock; the sky its rounds read (IsDay, the
  // moons) is the world's reading.
  const magicRoundWindow = claimMagicRounds(classicMinutes, next);
  const rounds = runMagicRoundsFor(entity, magicRoundWindow.from, magicRoundWindow.to, { sinks, rolls, say, skyMinutes: _sharedClock ? skyMinutes() : null });   // TIME1: the sky's, not the event window's end

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
  // MOVE-REAL: the motor's live odometer (player/motor.js), which the movement skills past 100 count - the host hands
  // it on with the activity (the climb's check, inside the motor's own step, reads it off the entity too)
  if (activity.odometer) entity._odometer = activity.odometer;
  if (activity.jumped) {
    sinks.drainFatigue?.(Math.trunc(FATIGUE_LOSS.Jumping * fatigueMultiplier * FATIGUE_DRAIN_SCALE));   // BALANCE1: exertion's scale
    tallyMovementSkill(entity, SKILLS.Jumping);
  }
  // CLIMB1 (the Enhanced Climbing arc): a mantle or a vault the enhanced
  // climb starts is one exertion - a jump's fatigue, the port's own price -
  // and trains the skill it used: a vault is a leap (Jumping), a mantle a
  // climb (Climbing). The motor never raises `jumped` for either, so neither
  // is billed twice. MOVE-REAL's odometer still weighs the tally past 100.
  // AUDIT CLIMB-ARC L13: a frame that began two moves (the motor's flag a list then) bills each
  for (const kind of [].concat(activity.parkoured || [])) {
    const exertion = FATIGUE_LOSS.Jumping;   // priced as the jump it takes the place of
    sinks.drainFatigue?.(Math.trunc(exertion * fatigueMultiplier * FATIGUE_DRAIN_SCALE));
    tallyMovementSkill(entity, kind === 'vault' || kind === 'leap' ? SKILLS.Jumping : SKILLS.Climbing);   // CLIMB3: a leap is the Jumping skill's
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
      tallyMovementSkill(entity, SKILLS.Running);   // MOVE-REAL: past 100 only the ground covered counts
    }
  }

  // The fatigue band still asks "did the minute CHANGE this frame", which is
  // DFU's `lastGameMinutes != gameMinutes` - a different marker from the
  // broker's, and deliberately so: a multi-minute jump costs ONE minute's
  // fatigue (S20) while it costs many magic rounds.
  if (Math.floor(next) !== Math.floor(classicMinutes)) {
    // FATIGUE-IDLE (2026-09-29, Mac: "You shouldn't lose fatigue at an insane rate standing still"; asked what it
    // should cost: "Nothing"): THE BAND CHARGES NOTHING STANDING STILL ON THE GROUND. DFU charges DefaultFatigueLoss
    // every minute the player is not climbing, running or swimming (PlayerEntity.cs:405-418) - standing still included:
    // the walk's 8 a minute on BALANCE1's scale, a full bar at STR/END 50 in ~67 real minutes of doing nothing.
    // `standing` is the motor's IsStandingStill term (grounded, no move input - player/motor.js); the arms below still
    // price a climb and a swim, whose passed roll pays the walk (treading water is not standing on the ground).
    // Roleplay Realism's overload is its own round and keeps the mod's rule. A departure: Ledger A, FATIGUE-IDLE.
    let loss = activity.standing && !activity.swimming ? 0 : FATIGUE_LOSS.Default;
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
      tallyMovementSkill(entity, SKILLS.Swimming);  // the 20000 clamp is load-bearing; MOVE-REAL: past 100, treading water teaches nothing
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
    if (!entity.isResting) sinks.drainFatigue?.(Math.trunc(loss * fatigueMultiplier * FATIGUE_DRAIN_SCALE));   // BALANCE1: exertion's scale

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
  // LIVED1: online the block's two halves walk their own clocks - the world's day (the price flags off the world's
  // index, the six zones' roll) over the world's window, the character's (the landlord's sweep, the loan check) over
  // their own - in DFU's order, the world's half first as UpdateRegionalPrices and SetClimateWeathers lead the block.
  if (_sharedClock) {
    for (const [s, e] of worldPieces) runDayChange({ entity, lastMinutes: s, nowMinutes: e, rolls, say, arms: DAY_ARMS.world });
    rollWorldZonesAcross(worldFrom, worldTo);   // AUDIT LIVED1b K3
    runDayChange({ entity, lastMinutes, nowMinutes, rolls, say, arms: DAY_ARMS.own });
  } else runDayChange({ entity, lastMinutes, nowMinutes, rolls, say });
  // CLK2: the enhanced lane's HOURLY evolution of the six zones, on the
  // clock wherever the player is - after the day roll, since a day
  // boundary is an hour boundary too and the day's roll comes first.
  // Inert on the classic lane; its generator is its own.
  evolveClimateWeathers(_sharedClock ? Math.floor(worldTo) : nowMinutes);   // LIVED1: the sky's hours are the world's

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
  // AUDIT DISC28 TM-3: the loop's body is runCalendarArms (below this
  // function) - ONE law, which skipDeadMinutes walks too over the minutes a
  // player lay dead, because the world's calendar runs on through a death.
  // LIVED1: online its arms split the same way the day block's do - the
  // character's (the reputation drift, the racial override quests) over
  // their own minutes, the world's (the faction powers and the regional
  // conditions, off the shared day's rolls) over the world's.
  if (_sharedClock) {
    runCalendarArms(entity, lastMinutes, nowMinutes, { rolls, arms: DAY_ARMS.own });
    for (const [s, e] of worldPieces) runCalendarArms(entity, s, e, { rolls, arms: DAY_ARMS.world });   // AUDIT LIVED1 I, LIVED1b P3
  } else runCalendarArms(entity, lastMinutes, nowMinutes, { rolls });

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
  handleStartingCrimeGuildQuests(entity, { nowClassicMinutes: next, inside, online: sharedClockOn() });   // TIMEFREE: the short wait online

  // SURV1 - THE NEEDS, one world minute at a time over the minutes this
  // tick crossed (the same [last, now] the per-minute loop above walks),
  // capped at two days so a jump charges what a jump can. Nothing here
  // draws from the day's generator; the felt temperature comes back out
  // for the HUD.
  let felt = null;
  if (survival && nowMinutes > lastMinutes) {
    felt = runSurvivalMinutes(entity, lastMinutes, nowMinutes, survival.env ?? {}, { ...(survival.deps ?? {}), sinks: survival.deps?.sinks ?? sinks, rolls });
  } else if (!survival) {
    clearSurvivalMods(entity);   // AUDIT SURV A: the mod off (or a host with no reader) leaves no drain behind
    if (!survivalOn() && nowMinutes > lastMinutes) pauseSurvival(entity, lastMinutes, nowMinutes);   // AUDIT SURV-TIERS: Off's minutes are nobody's needs (needs.js pauseSurvival) - a host with no reader while the arc is ON keeps WORLD5's clocks
  }

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
  // LIVED1: online the answer is the character's own clock as it stands -
  // a raise from inside this tick has already moved it, and nothing writes
  // it back.
  if (_sharedClock) return { classicMinutes: ownMinutes(), rounds, magicRoundWindow, felt };
  const jumped = worldMinutes() - clockAtEntry;
  return { classicMinutes: jumped > 0 ? next + jumped : next, rounds, magicRoundWindow, felt };
}

/**
 * AUDIT DISC28 TM-3: THE CALENDAR - PlayerEntity.Update's per-minute loop,
 * its four arms in DFU's order within a minute (NormalizeReputations, then
 * RegionPowerAndConditionsUpdate's two cadences, then StartRacialOverrideQuest),
 * over the minute VALUES [lastMinutes, nowMinutes). It was the body of
 * tickPlayerMinutes' loop and is still called from there; skipDeadMinutes
 * walks it too, over the minutes a player lay dead - the online time
 * model's rule that the world's calendar runs on through a death (the body
 * is charged nothing, the world keeps its dates). One home, so the dead span
 * and a lived minute cannot disagree about when a boundary fell.
 *
 * AUDIT 23 (C4: guilds-4 = cross-1 = entity-6) - :455-459: every 161280th
 * game minute (112 days) normalizes the legal AND faction reputations toward
 * zero, unless the prison skip set preventNormalizingReputations for its
 * jump (the shield is read here and cleared at the tail of the tick, as
 * DFU's Update clears it).
 *
 * It is OFF BY ONE from the broker's, deliberately. DFU tests
 * `(i + lastGameMinutes) % 161280 == 0` for i in [0, minutesPassed), i.e. the
 * minute VALUES [last, now) with no +1, while the broker's rounds represent
 * [last+1, now]. AUDIT 23 wrote this loop inside the broker's and inherited
 * its `r + 1`, so the port normalised one game minute late. DFU's own
 * inconsistency, reproduced.
 *
 * A rewound clock loops zero times rather than backwards; the restore
 * re-anchors the marker explicitly (SerializablePlayer.cs:338-339), which is
 * why the field is deliberately NOT in the save envelope.
 */
export function runCalendarArms(entity, lastMinutes, nowMinutes, { rolls = Math.random, arms = DAY_ARMS.all } = {}) {
  if (!entity) return;
  // LIVED1: the arms by clock - the reputation drift and the racial override quests are the CHARACTER's (their own
  // minutes), the faction powers and the regional conditions the WORLD's (the shared day's rolls). Offline all of
  // them walk the one clock in DFU's order within a minute, exactly as before.
  const worldArms = arms !== DAY_ARMS.own, ownArms = arms !== DAY_ARMS.world;
  const timeFree = sharedClockOn();   // TIMEFREE: online the curse's quests come on the short wait, not 38 and 84 days
  for (let i = lastMinutes; i < nowMinutes; i++) {
    if (ownArms && i % NORMALIZE_INTERVAL_MINUTES === 0 && !entity.preventNormalizingReputations) {
      normalizeReputations(entity, entity.factionRep ?? null);
    } else if (ownArms && i % RECOVERY_INTERVAL_MINUTES === 0 && !entity.preventNormalizingReputations) {
      // REP4 (Mac: "Earn it + faster drift"): between DFU's 112-day walks, a standing below zero recovers a point every
      // seven days - the recovery half alone (a positive standing wears down on DFU's walk only). On a 112-day boundary
      // the walk above is the week's too, so no minute pays twice.
      normalizeReputations(entity, entity.factionRep ?? null, { recoveryOnly: true });
    }
    // S43 - :461-462, the SECOND arm of the :453-477 loop: every 7 days the
    // faction powers move. Until now nothing in the port ever changed a
    // faction's power, so S41's price walk - which tilts a region's
    // prices by The Merchants' power against the region's own - had a
    // constant for its whole tug-of-war term.
    // WORLD6b: both power arms of one minute draw from ONE generator, the day's (the 266-day minute where the two
    // align fires the walk twice, as DFU does, and the second walk must not replay the first's rolls)
    // LIVED1: minted only on a minute an arm reads it - the character's own walk crosses whole rested nights, and a
    // seeded generator a minute was a construction per minute for nothing (the draws are unchanged: offline this is
    // the caller's stream itself, online the day's seed).
    const powerMinute = worldArms && i % FACTION_POWER_INTERVAL_MINUTES === 0;
    const conditionMinute = i % REGION_CONDITIONS_INTERVAL_MINUTES === 0;
    const dayRolls = powerMinute || (worldArms && conditionMinute) ? dayRollsFor(i, rolls, DAY_SALT.powers) : null;
    if (powerMinute) {
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
    if (conditionMinute) {
      if (worldArms) {
        regionPowerUpdate(entity.factionRep ?? null, {
          rumorMill: entity.rumorMill ?? null, rolls: dayRolls,   // WORLD6b: the shared day's roll
          updateConditions: true, regionConditions: entity.regionConditions ?? null,
        });
      }
      // :472 - StartRacialOverrideQuest(false) rides this same arm:
      // the vampire's P0A01L00 initiation, then the clan's own quests
      // (V2d; a no-op without a live override or a registered host).
      // LIVED1: the curse's quests are the character's - online they
      // ride the same cadence on their own minutes.
      if (ownArms && !timeFree) startRacialOverrideQuest(entity, false, { rolls });
    }
    // :475-476, the FOURTH arm - every 84 days, the CURE quest roll
    // ($CUREVAM at (10,100)<30, $CUREWER at (1,100)<30 once).
    if (ownArms && !timeFree && i % CURE_QUEST_INTERVAL_MINUTES === 0) {
      startRacialOverrideQuest(entity, true, { rolls });
    }
    // TIMEFREE: online both arms roll on the short wait, each only while it has nothing running (racialQuests.js)
    if (ownArms && timeFree && i % ONLINE_RACIAL_INTERVAL_MINUTES === 0) {
      if (racialArmIdle(false)) startRacialOverrideQuest(entity, false, { rolls });
      if (racialArmIdle(true)) startRacialOverrideQuest(entity, true, { rolls });
    }
  }
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
// clock owes between two readings (tickPlayerMinutes) rather than fabricating minutes from dt. [LIVED1: the refusal is
// the WORLD's clock's; a character's own time is theirs to spend - advanceOwnMinutes, below.]
let _sharedClock = null;
let _sharedLastTick = null;
// TIME1 (Mac, 2026-10-01: "I don't want a band aid, I want a detailed way we can do this"): THE SKY, the third clock
// (bible/06-Systems/Online-Time-Arc.md). Online the shared clock above becomes the EVENT clock - the economy, the
// relay's events, every term and stamp, at WORLD5's TimeScale 12 for good - and the hour, the date and the moons a
// player sees read the sky's own source (net/skyLaw.js, a faster rate), installed beside it. Nothing walks the sky and
// nothing is stamped on it: skyMinutes() is read for "now". A shared clock installed without a sky (a test's bare
// source) has its sky read the event clock, the one rate WORLD5 had; offline the sky is the one clock.
let _skySource = null;
let _skyWall = null;
// AUDIT LIVED1 I (K1): THE WORLD'S ARMS WALK EACH WORLD MINUTE ONCE. The reading re-anchors DOWN when the source steps
// back (C2 below) or a correction lowers it (alignEntityClocks), and the world's arms - the seven-day power walk and the
// thirty-eight-day conditions walk, neither of them idempotent - then walked the minutes between again. The per-minute
// loop's own marker (lastGameMinutes, monotonic) guarded them while they walked the one clock; online they walk the
// world's, so the world's own high-water mark guards them: only ever raised, and the arms start at it.
// AUDIT LIVED1b P3 (A4, K3): ...AND ONE MARK COUNTED AS WALKED MINUTES NO WALK HAD COVERED. The boot's frames read a
// machine clock running fast (the relay's offset arrives with its welcome) and walked the world's arms ahead of the
// world; the welcome stepped the reading back, and the minutes between - lived now - sat under the mark and were never
// walked: a faction power's day lost, the six zones kept yesterday's sky for the world's day. A correction forward skips
// its gap as an arrival does, and one back into the gap found it under the mark too. The walks are kept as the SPANS they
// covered - [from, to] pairs of whole world minutes, sorted and disjoint, joined where they touch - and a reading walks
// exactly the parts of its window no span holds: no world minute twice (I's law), none lived lost. The spans are this
// session's (a new one starts at its first reading); the oldest two join when there are more than eight.
let _worldWalked = [];
const WORLD_WALKED_SPANS = 8;
/** AUDIT LIVED1b P3: the parts of the world's window [from, to] no walk this session has covered, in order, as [s, e]
 *  pairs for the world's arms (each walked as the whole window would be - consecutive pieces share their ends, so the
 *  day block's and the calendar loop's own conventions count a boundary once) - and the window is walked from here. */
export function worldArmsPieces(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return [];
  const pieces = [];
  let s = from;
  for (const [a, b] of _worldWalked) {
    if (a >= to) break;
    if (b <= s) continue;
    if (a > s) pieces.push([s, a]);
    s = Math.max(s, b);
  }
  if (s < to) pieces.push([s, to]);
  let lo = from, hi = to;
  const spans = [];
  for (const [a, b] of _worldWalked) {
    if (b < lo || a > hi) spans.push([a, b]);
    else { lo = Math.min(lo, a); hi = Math.max(hi, b); }
  }
  spans.push([lo, hi]);
  spans.sort((x, y) => x[0] - y[0]);
  while (spans.length > WORLD_WALKED_SPANS) spans.splice(0, 2, [spans[0][0], spans[1][1]]);
  _worldWalked = spans;
  return pieces;
}
/** AUDIT LIVED1b K3 (A4): THE SIX ZONES ARE THE WORLD'S DAY'S, WHATEVER WAS WALKED. Online the day's roll is a function of
 *  the shared day alone (weatherSim rollsFor), so it is rolled on every midnight the READING crosses - not only on one
 *  the arms walk: an arrival that corrected the reading back across a midnight re-rolled the day before (world.js
 *  onlineArrival), and the midnight itself, walked once already, was then held off the arms and the day's sky with it. */
function rollWorldZonesAcross(from, to) {
  if (Math.floor(Math.floor(to) / MINUTES_PER_DAY) > Math.floor(Math.floor(from) / MINUTES_PER_DAY)) rollClimateWeathersForDay(Math.floor(to));
}
// AUDIT LIVED1b P4 (the first audit's recorded suspect, reproduced by lane P as an exploit): THE ABSENCE IS MEASURED ON
// THE RELAY'S CLOCK. The boot loads, and paid the absence, before the socket opens - on THIS machine's clock, the relay's
// offset arriving with its welcome: an OS clock set eleven months fast at each boot paid TM-1's recovery for months that
// never passed (a legal reputation of -80, then -44, -8 and 0 in three boots) and SURV7's fresh start beside it. The load
// hands its absence here, and it is paid when the host hears the relay's clock (hearSharedClock) - over [left, the
// corrected now) - and until then an online save keeps the world's minute the character left at
// (worldMinutesToSave), so no save written on the machine's clock moves the next absence either.
let _sharedClockHeard = false;
let _absenceWaiting = null;   // { left, pay }: a loaded character's absence, waiting for the relay's clock
export const sharedClockHeard = () => _sharedClockHeard;
/** AUDIT REP F2: THE WORLD'S CALENDAR, WHEN IT CAN BE TRUSTED - online only once the relay's clock is heard (P4's own
 *  law), NaN before it; offline the one clock. A banishment's term reads it (systems/standing.js): a machine clock set
 *  months fast at the boot lifted a banishment for good on the first frame, before the relay could correct it. */
export const trustedWorldMinutes = () => (_sharedClock && !_sharedClockHeard ? NaN : worldMinutes());
/** AUDIT LIVED1b P4: the load's absence - `pay(nowMinutes)` runs once the relay's clock is heard (at once if it has
 *  been). Answers whether it was taken. */
export function payAbsenceWhenHeard(left, pay) {
  if (!_sharedClock || !Number.isFinite(left) || typeof pay !== 'function') return false;
  _absenceWaiting = { left: Math.floor(left), pay };
  if (_sharedClockHeard) settleAbsence();
  return true;
}
function settleAbsence() {
  const waiting = _absenceWaiting;
  _absenceWaiting = null;
  if (waiting) waiting.pay(worldMinutes());
}
/** AUDIT LIVED1b P4: the host has heard the relay's clock (its offset is in the source) - the waiting absence is paid on
 *  it. Answers whether a shared clock stands to hear. */
export function hearSharedClock() {
  if (!_sharedClock) return false;
  _sharedClockHeard = true;
  settleAbsence();
  return true;
}
/** AUDIT LIVED1b P4: the world's minute an online save stamps - the one the character left at while their absence
 *  waits for the relay's clock, the world's now once it is paid. */
export const worldMinutesToSave = () => (_absenceWaiting ? _absenceWaiting.left : Math.floor(worldMinutes()));
// AUDIT LIVED1 J (K6): a tick in flight - the exhaustion collapse's RaiseTime can fire from INSIDE one (a poison
// draining fatigue within a round), and online the ticker's advance then ran a nested tick whose hour of rounds landed
// before the outer window's own: a disease day rolled in the nested hour was given back by the outer round
// (daysPast = -1) and rolled again. DFU's RaiseTime is a bare clock move the broker's next Update catches up; online the
// ticker's advance is that bare move while a tick is in flight (shared.js createPlayerTicker advance).
let _tickDepth = 0;
export const tickInFlight = () => _tickDepth > 0;
/** Install (a function answering classic minutes) or remove (null) the shared clock. TIME1: `sky` (classic minutes) and
 *  `skyWall` (this machine's ms for a sky minute) install the sky beside it - read only while the shared clock stands. */
export function setSharedClock(source, wallOf = null, { sky = null, skyWall = null } = {}) {
  _sharedClock = typeof source === 'function' ? source : null;
  _sharedWall = _sharedClock && typeof wallOf === 'function' ? wallOf : null;
  _skySource = _sharedClock && typeof sky === 'function' ? sky : null;
  _skyWall = _skySource && typeof skyWall === 'function' ? skyWall : null;
  setSkyCalendar(!!_skySource);   // TIME1: an event minute reads the sky's date while a sky stands
  _sharedLastTick = null;
  _worldWalked = [];   // AUDIT LIVED1 I, LIVED1b P3: a new session's world arms start at its first reading
  _sharedClockHeard = false;   // AUDIT LIVED1b P4: and it has not heard the relay's clock yet
  _absenceWaiting = null;
  _ownMinutes = null;   // LIVED1: a clock installed or removed is a new session - the character's own time comes from its load
  _raisedMinutes = 0;   // TIME3: ...and its raises are counted from nought
  // ECON1: the world's prices stand with the world's clock - every consumer of regionPriceAdjustment reads today's
  // world index while the clock stands, and the player's own again when it goes
  setWorldPriceSource(_sharedClock ? (regionIndex) => worldRegionPrice(regionIndex, _sharedClock()) : null);
}
export const sharedClockOn = () => _sharedClock !== null;

// LIVED1 (Mac, 2026-09-29: "We need a better system for time online instead of a band aid fix. Something detailed and
// that really makes sense"): YOUR OWN TIME. DFU has one clock and the player owns it - every "and then time passes"
// (a night's sleep, a loiter, a journey, a training session, a sentence, the vampire's fortnight) moves it. Online the
// world's clock is nobody's (WORLD5), so each of those became a refusal and each system that needed its time back got
// a patch of its own. The honest shape is TWO clocks:
//   - THE WORLD'S (worldMinutes): the sky, the calendar and everything every player shares. Nobody moves it.
//   - THE CHARACTER'S (ownMinutes): one number per character, saved with them. Online it runs with the world's while
//     they are in it and alive (a minute for a minute), runs AHEAD when they spend time the world does not wait for
//     (advanceOwnMinutes - every RaiseTime DFU has), and stands while they are away or dead. Offline it IS the
//     world's clock - one variable, DFU byte for byte.
// The rule for which one a law reads: the sun, the moons, the calendar and the world everyone shares read the world's;
// the body, its magic, its needs, its contracts and its standing read the character's (bible/06-Systems/Lived-Time.md).
let _ownMinutes = null;
// TIME3 (bible/06-Systems/Online-Time-Arc.md 6.3): THE SESSION'S RAISES - the minutes the character's clock has run
// AHEAD of the world's this session, counted as they are raised (every RaiseTime: the ticker's advance, through the
// tick's raiseMinutes, and advanceOwnMinutes). A quest's countdowns run on the character's clock, which moves two
// ways online: with the world while they live in it - a quest charges that by one played step a frame at most, the
// rest is time away and forgiven (WORLD7: a hidden tab, a menu left open) - and ahead of it when they raise time, which
// a quest charges whole, as DFU charges a RaiseTime: a three-day wait is a 72-hour rest. This count tells the two
// apart. A load moves the clock and raises nothing; a clock installed or removed starts a session and the count with
// it; offline there is one clock, no raise to tell apart, and it reads 0.
let _raisedMinutes = 0;
/** TIME3: the minutes raised this session - a quest's countdown charges the raised part of its clock whole. Nought
 *  offline: the count starts again with every clock installed or removed, and only the online lane adds to it. */
export const raisedMinutes = () => _raisedMinutes;
/** LIVED1: the character's own clock - online the one the load restored, run by the tick and every RaiseTime; offline
 *  the world's clock itself. Before a load online it reads the world's (a character born online starts there). */
export const ownMinutes = () => (_sharedClock ? (_ownMinutes ?? _sharedClock()) : _worldMinutes);
/** LIVED1: set the character's own clock - a load restores it. Offline it is the world's clock (setWorldMinutes). */
export function setOwnMinutes(v) {
  if (!_sharedClock) return setWorldMinutes(v);
  _ownMinutes = Number.isFinite(v) ? v : _sharedClock();
  return _ownMinutes;
}
/** LIVED1: DaggerfallDateTime.RaiseTime for the character - time they spend that the world does not wait for. Offline
 *  it moves the world's clock (the one clock); online the character's alone, and it is never refused: the next tick
 *  walks the span (the broker, the per-minute loop, the needs), exactly as the offline tick walks a raised clock. */
export function advanceOwnMinutes(delta) {
  const d = Number(delta) || 0;
  if (!_sharedClock) return setWorldMinutes(_worldMinutes + d);
  if (!Number.isFinite(d)) return ownMinutes();   // AUDIT LIVED1b F3: an Infinity would set a clock the calendar loop never ends on
  _ownMinutes = ownMinutes() + d;
  if (d > 0) _raisedMinutes += d;   // TIME3: the raise, counted
  return _ownMinutes;
}
/** AUDIT LIVED1b S1: whether a raise waits for its walk online - the character's clock a whole minute past the minute
 *  the tick last walked (`lastGameMinutes`, which every tick brings to its floor). Offline, never: the host saves on
 *  its own and a raise is walked by the frame it is walked by, as before. */
export const ownWalkWaiting = (entity) => !!_sharedClock && Number.isFinite(entity?.lastGameMinutes) && Math.floor(ownMinutes()) > entity.lastGameMinutes;

// OL3 (Mac, 2026-09-14): THE CLOCK DOES NOT PUNISH ABSENCE - the price is
// said in real time. Under the shared clock every world-time deadline (a
// rented room's expiry, a loan's due date) runs on wall time, through a
// logout: a week's lodging is fourteen real hours. The shared world keeps
// one clock, so the honest fix is that the player buys what they think
// they are buying: the host installs, beside the source, the inverse -
// the millisecond on THIS machine's clock at which the world reads a
// classic minute (wire.js wallMsForClassicMinutes, less the relay's
// offset) - and the tavern's offer and the bank's due-by say it.
// [LIVED1 SUPERSEDES this for rooms, loans and repairs: they run on the character's own clock, which stands while
// they are away, so the offer and the due-by say ownTimeLeftText. The inverse stays for the world's own dates.]
let _sharedWall = null;
/** This machine's wall-clock ms for a classic minute under the shared clock, else null. */
export const sharedWallMs = (classicMinutes) => (_sharedWall && Number.isFinite(classicMinutes) ? _sharedWall(classicMinutes) : null);
// [AUDIT LIVED1b U6: OL3's `realTimeText` and `sharedRealTimeText` - a classic minute as this machine's wall-clock words
// - went with their last reader (LIVED1 moved the room's and the loan's words to the character's clock); the gates
// and the raids read `sharedWallMs` itself.]
/** LIVED1: THE SUN IS EVERYONE'S. A single player waits out the day with a rest; online a rest moves their own clock
 *  and not the sky, so a refusal that waits on the night (the vampire's CheckFastTravel, a sun-damaged career's box)
 *  says when the world's night falls, in real minutes. Null offline, or when it is night. TIME1: the SKY's night, timed
 *  through the sky's own inverse - at the sky's rate, which the event clock's ONLINE_MINUTES_PER_MS no longer is (it
 *  would have said four times too long); a sky with no inverse installed is timed at the wire's one rate. */
export function worldNightfallText() {
  if (!_sharedClock) return null;
  const sky = skyMinutes();
  const now = Math.floor(sky);
  if (!isDayFromMinutes(now)) return null;
  const dusk = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + DUSK_HOUR * 60;
  const ms = _skyWall ? _skyWall(dusk) - _skyWall(sky) : (dusk - sky) / ONLINE_MINUTES_PER_MS;
  const real = Math.max(1, Math.ceil(ms / 60000));
  return `The sun is the world's - night falls in about ${real} minute${real === 1 ? '' : 's'}.`;
}
/** LIVED1: a deadline on the CHARACTER's own clock (a room's end, a loan's due day, a repair's ready minute), said as
 *  what it is online - the time left on their clock, and what that is in play: their clock runs with the world's
 *  while they play (the wire's one rate), faster through a rest or a journey, and not at all while they are away, so
 *  the play is the most it can take. [SUPERSEDES OL3's real time for these - a wall-clock date the character's own
 *  clock does not keep.] "7 days of your time (14h of play)", in the game font's ASCII; null offline, where DFU says
 *  its dates. */
export function ownTimeLeftText(untilMinutes) {
  if (!_sharedClock || !Number.isFinite(untilMinutes)) return null;
  const left = Math.max(0, Math.ceil(untilMinutes - ownMinutes()));
  const n = (v, unit) => `${v} ${unit}${v === 1 ? '' : 's'}`;
  const days = Math.floor(left / MINUTES_PER_DAY), hours = Math.floor((left % MINUTES_PER_DAY) / 60);
  const own = days > 0 ? n(days, 'day') + (hours > 0 ? ` ${n(hours, 'hour')}` : '') : hours > 0 ? n(hours, 'hour') : n(left % 60, 'minute');
  const playMinutes = Math.ceil(left / ONLINE_MINUTES_PER_MS / 60000);
  // AUDIT LIVED1b U5: "the most it can take" is never rounded DOWN - from two days of play the hours went to the
  // nearest, and "(48 hours of play)" stood for up to 48h 29m
  const play = playMinutes >= 2880 ? `${Math.ceil(playMinutes / 60)} hours`
    : playMinutes >= 60 ? `${Math.floor(playMinutes / 60)}h${playMinutes % 60 ? ` ${playMinutes % 60}m` : ''}` : `${playMinutes}m`;
  return `${own} of your time (${play} of play)`;
}
/** AUDIT LIVED1 P/Q (U5/U6/R7): the same time left, SHORT, for a classic label with no room for the play - the bank's
 *  parchment, the character sheet's due column: its largest whole unit, floored as the long form's is ("359 days",
 *  "5 hours", "20 minutes"), "now" at or past it (AUDIT LIVED1 L: a due-by said "in 0 minutes of your time (0m of
 *  play)" for a loan already due). Null offline, where DFU says its dates. */
export function ownTimeLeftShort(untilMinutes) {
  if (!_sharedClock || !Number.isFinite(untilMinutes)) return null;
  const left = Math.ceil(untilMinutes - ownMinutes());
  if (left <= 0) return 'now';
  const n = (v, unit) => `${v} ${unit}${v === 1 ? '' : 's'}`;
  return left >= MINUTES_PER_DAY ? n(Math.floor(left / MINUTES_PER_DAY), 'day') : left >= 60 ? n(Math.floor(left / 60), 'hour') : n(left, 'minute');
}

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
/** TIME1: THE SKY - the minute the hour, the date, the season and the moons are read off. Online the sky's own source
 *  (net/skyLaw.js skyClassicMinutes through the relay's offset), or the event clock where none was installed; offline
 *  the one clock. Read for "now": a reading that is saved, sent or compared later is worldMinutes()'s or ownMinutes()'s
 *  (bible/06-Systems/Online-Time-Arc.md section 5). */
export const skyMinutes = () => (_sharedClock ? (_skySource ? _skySource() : _sharedClock()) : _worldMinutes);

/** Set the clock - a load restores it, a rest or a court sentence jumps it. WORLD5: refused under the shared clock. */
export function setWorldMinutes(v) {
  if (_sharedClock) return _sharedClock();
  _worldMinutes = Number.isFinite(v) ? v : 0;
  return _worldMinutes;
}

/** LIVED1: AN ARRIVAL MOVES NOTHING OF THE CHARACTER'S. Their own clock stood while they were away (it runs only in a
 *  tick, and no tick runs for a player who is not here), so every marker they carry - a disease's day, a poison's
 *  minute, an infection's incubation, the curses' clocks, the needs, a room, a loan, a repair, a letter, a conjured
 *  item's hour, a guild's rank wait - is still in tune with it, and nothing needs carrying across.
 *
 *  [SUPERSEDES WORLD5 C3's shift and every marker added to it since - MAC-BUG3's repairs, DISC10-D/E V9's infection
 *  and werewolf stamps, AUDIT DISC28 TM-4's body clocks. Each was a marker someone remembered to shift; one forgotten
 *  was a bug (a repair the smith kept for ever, a werewolf turned on the first online frame). A clock that does not
 *  run while the player is away has no list to forget.]
 *
 *  What an arrival still does is the WORLD's: the tick's world reading re-anchors at now, so the world's arms walk
 *  nothing of the time away (the standing rule - an absence walks no calendar arm), and, when the caller knows the
 *  world minute the character LEFT at (`worldLeft`, the save's), the one arm an absence pays: AUDIT DISC28 TM-1 (Mac,
 *  2026-09-28: "Recovery only") - each 112-day boundary the world crossed moves a reputation below zero one point
 *  back, a standing above zero kept. A relay's correction or the session's own start is not an absence and passes no
 *  `worldLeft`. */
export function alignEntityClocks(entity, nowMinutes, { worldLeft = null } = {}) {
  if (!entity || !Number.isFinite(nowMinutes)) return false;
  const now = Math.floor(nowMinutes);
  if (Number.isFinite(worldLeft) && now > Math.floor(worldLeft)) normalizeAcross(entity, Math.floor(worldLeft), now);
  // a character with no day marker (never ticked, never saved) starts it at their own clock's now
  if (!Number.isFinite(entity.lastGameMinutes)) entity.lastGameMinutes = Math.floor(ownMinutes());
  _sharedLastTick = _sharedClock ? nowMinutes : null;
  return true;
}

/** DISC28-F (Discord: arrested for Criminal Conspiracy over and over, the legal reputation never recovering). DFU's
 *  NormalizeReputations - every region's legal reputation and every faction's one point toward zero - fires on the
 *  exact minutes that are multiples of 161280 (PlayerEntity.cs:455-459, the per-minute loop above walks
 *  [last, now)), and the single-player clock never runs while nobody plays, so no boundary is ever skipped. Online
 *  the world's clock runs on through every absence and the stamps that end one (alignEntityClocks, skipDeadMinutes)
 *  moved the marker to now without walking the span: a boundary that fell while the player was away was lost for
 *  good, and with the shared clock's 12x a boundary is an instant roughly every nine real days. A player below -10
 *  kept rolling conspiracy (encounters.js passiveGuardSpawns, DFU's own 5%) and the one road back was gone. Here
 *  each boundary in [from, to) is paid once, under the prison skip's own one-jump shield. Answers how many.
 *
 *  AUDIT DISC28 TM-1 (Mac, 2026-09-28: "Recovery only"): this is the ABSENCE's normalise, and it pays the recovery
 *  half alone (court.js normalizeReputations' `recoveryOnly`, the port's online time model): a reputation below zero
 *  drifts one point back per boundary, a positive standing is kept. Paid both ways, a break wore every guild,
 *  temple and noble standing down a point per nine real days away and demoted a member at their rank's line on the
 *  next rank check - a cost an absence never had. [AUDIT LIVED1 K: the minutes spent DEAD pay neither half - the
 *  drift is the character's own and their clock stands under the death screen (skipDeadMinutes walks the world's
 *  arms alone); a lived minute pays both, on the character's clock, as the tick walks it.] */
export const NORMALIZE_ACROSS_MAX = 200;
export function normalizeAcross(entity, from, to) {
  if (!entity || !Number.isFinite(from) || !Number.isFinite(to)) return 0;
  const a = Math.floor(from), b = Math.floor(to);
  if (!(b > a)) return 0;
  // multiples of the interval in [a, b): the same minute VALUES the loop above tests (DFU's `(i + last) % N == 0`).
  // REP4: the absence pays the recovery half, and the recovery half is weekly now - every 7-day boundary crossed away
  // is a point back for a standing below zero (the 112-day boundaries are among them).
  const n = Math.floor((b - 1) / RECOVERY_INTERVAL_MINUTES) - Math.floor((a - 1) / RECOVERY_INTERVAL_MINUTES);
  if (n <= 0 || entity.preventNormalizingReputations) return 0;
  // AUDIT LIVED1b F3: at most NORMALIZE_ACROSS_MAX walks - a tampered save's -1e308 asked for ~1e300 and the load never
  // returned; a reputation is clamped to +-100 and each walk moves it one point, so no more can change anything
  for (let k = 0; k < Math.min(n, NORMALIZE_ACROSS_MAX); k++) normalizeReputations(entity, entity.factionRep ?? null, { recoveryOnly: true });
  return n;
}

/** DISC28-E (Discord: "dying infinitely from fatigue ... respawn at 0% fatigue"): THE DEAD LIVE NO MINUTES.
 *  PlayerEntity.Update returns while CurrentHealth <= 0 (PlayerEntity.cs:352-353), before its per-minute loop - nothing
 *  is charged to a dead body - and single-player death ends in a load. Online the death screen stands while the
 *  shared clock runs on.
 *
 *  LIVED1: the rule is now the clock's own. No tick runs under the death screen (the hosts hold their frame under a
 *  window), so the CHARACTER's clock stood through it: the body is billed nothing - no stamina, no needs, no magic
 *  rounds, no disease day - and no marker of theirs moves, because none fell behind. [SUPERSEDES the revival's shifts:
 *  the needs' pause and TM-4's carried effect clocks.] What the dead span still owes is the WORLD's: the world's day
 *  block (the price flags, the six zones) and the world's calendar arms (the faction powers, the regional conditions)
 *  over the world's minutes since the last reading, as for any minute the world ran - and then the reading re-anchors
 *  at now, so the first tick after the rise does not count the span as lived. [SUPERSEDES AUDIT DISC28 TM-3's walk of
 *  the character's own calendar over the span - the landlord's sweep, the loan check, the reputation drift and the
 *  racial quests are the character's, and the character did not live those minutes.]
 *
 *  AUDIT DISC28 TM-2 stands: PreventEnemySpawns, DFU's flag for time the player did not live, is raised so every
 *  host's encounter loop takes a span of nothing and lowers it. `rolls` and `say` are the day block's and the arms'
 *  (runDayChange's own defaults). */
export function skipDeadMinutes(entity, nowMinutes, { rolls = Math.random, say = () => {} } = {}) {
  if (!entity || !Number.isFinite(nowMinutes)) return false;
  const now = Math.floor(nowMinutes);
  // AUDIT LIVED1 I: from the last reading, walking no world minute twice - AUDIT LIVED1b P3: over what no walk covered
  const from = _sharedClock && Number.isFinite(_sharedLastTick) ? Math.floor(_sharedLastTick) : null;
  const pieces = from === null ? [] : worldArmsPieces(from, now);
  if (_sharedClock) _sharedLastTick = nowMinutes;
  entity.preventEnemySpawns = true;   // AUDIT DISC28 TM-2: every host's encounter loop reads it and lowers it - raised on every rise
  for (const [s, e] of pieces) {
    runDayChange({ entity, lastMinutes: s, nowMinutes: e, rolls, say, arms: DAY_ARMS.world });   // AUDIT DISC28 TM-3: the day block first, as Update orders it
    runCalendarArms(entity, s, e, { rolls, arms: DAY_ARMS.world });   // AUDIT DISC28 TM-3: then the per-minute loop's world arms
  }
  if (from !== null) rollWorldZonesAcross(from, now);   // AUDIT LIVED1b K3
  return true;
}

/** A LOAD resets the marker rather than catching up across it - DFU's
 *  `SaveLoadManager.Instance.LoadInProgress` early return (:206-207). Without
 *  this a restored save would fire the cap's worth of rounds on its first
 *  frame against effects that already expired in the saved game. */
export function resetMagicRoundMarker(v = null) {
  // AUDIT LIVED1b F3: a marker that is no number is none - a tampered save's "abc" left NaN here, and `here < NaN`
  // never re-anchors, so no magic round ran again that session
  _lastMagicRoundMinute = v === null || !Number.isFinite(Number(v)) ? null : Math.floor(Number(v));
  // AUDIT 63 F13: a load is a fresh broker, and nothing in DFU
  // serialises SyntheticTimeIncrease - a flag raised in the session
  // being replaced must not shield the restored one's first window.
  resetSyntheticTimeIncrease();
  return _lastMagicRoundMinute;
}

/**
 * Move the clock forward (or back, for a load). WORLD5: refused under
 * the shared clock.
 *
 * CLOCK-REFUSAL (2026-09-22). THE REFUSAL IS INVISIBLE TO THE CALLER
 * AND THAT HAS ALREADY COST ONE BUG. It answers a number either way -
 * the shared clock's current minute when it refuses, the new minute
 * when it moves - so nothing downstream can tell whether the hours it
 * asked for actually passed. DEATHLOOP1's second half was exactly
 * that: the prison release asked for the sentence's days, got a
 * plausible number back, and let the player out at the health they
 * came in with, which for someone arrested while dying was dead.
 *
 * The contract is not changed here, because every caller reads the
 * answer as "the clock now" and that is still true. What is added is a
 * way to ASK, and a pin (test/clockrefusal.test.js) that requires
 * every caller either to consult it or to be listed with the reason it
 * does not need to. A silent refusal is fine; an unnoticed one is not.
 */
export function advanceWorldMinutes(delta) {
  if (_sharedClock) return _sharedClock();
  return setWorldMinutes(_worldMinutes + (Number(delta) || 0));
}

/** CLOCK-REFUSAL: false while the shared clock stands, when asking the
 *  world clock to move is a no-op. The one question a caller that
 *  MEANS the passage of time - a sentence served, nights at an inn,
 *  hours of rest - has to ask before it trusts its own request. */
export const worldClockAdvances = () => !_sharedClock;
