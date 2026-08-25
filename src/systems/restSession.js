// The rest session machine (Systems side of U7). Behavior ported
// from DFU's DaggerfallRestWindow (MIT, Daggerfall Workshop) - the
// hour ticking, interrupts, and completion rules; the panel itself
// lives in ui/restWindow.js.
//
// Timing (audit 2026-08-16f, verbatim quirk): DFU's sub-tick fires
// every waitTimePerHour / minutesPerTick REAL seconds - the divisor
// is the CONSTANT 10, not the 6 ticks an hour actually takes - so a
// rested hour passes in 6 x 0.075 = 0.45 real seconds (loiter 6 x
// 0.125 = 0.75). The first cut divided by ticks-per-hour and rested
// ~1.7x too slow. Each sub-tick advances 10 classic minutes so world
// time - and with it our magic rounds, diseases, poisons - flows
// through the rest exactly as DFU's RaiseTime does. Each completed
// HOUR: the enemy check
// (the RESTING AreEnemiesNearby variant - an aware foe at any
// spawn-band range, an unaware one only within 12 units) breaks the
// rest (TEXT.RSC 354); then vitals tick for TimedRest/FullRest (the
// S20 per-hour rates + a Medical tally - loiter recovers NOTHING)
// and the mode's completion is checked: FullRest ends when fully
// healed (health AND fatigue full, magicka full or NoRegenSpellPoints
// - TEXT.RSC 350 "You are healed."), TimedRest when the hours run
// out (353 "You wake up."), Loiter likewise (349). Death mid-rest
// ends the session at once (the scene's death screen takes over;
// DFU's "You never awaken." line rides that flow).
//
// Pre-rest gates (the scene owns them, constants here): enemies
// nearby -> 354; swimming or airborne -> 355 "You cannot rest now.";
// loiter requests above the classic 3-hour cap are refused with the
// cannot-loiter lines. Building trespass/rent rules pend towns.

import { CRIMES } from './court.js';   // U48: camping in a town is Vagrancy
import { getInt } from './settings.js';   // SETT: LoiterLimitInHours

export const MINUTES_PER_TICK = 10;          // classic minutes per sub-tick
export const REST_WAIT_PER_HOUR = 0.75;      // real seconds per rested hour
export const LOITER_WAIT_PER_HOUR = 1.25;    // loiter runs slower
/** DFU LoiterLimitInHours (ships 3, classic's cap). SETT made it a
 *  real setting, so this is a point-of-use read; the refusal lines
 *  quote it and are a FUNCTION for the same reason. The 3..12 range is
 *  DFU's own slider (DaggerfallAdvancedSettingsWindow.cs:354) - the
 *  MENU range-equals-clamp pin caught an invented 1..24 here. */
export const loiterLimitHours = () => getInt('Enhancements', 'LoiterLimitInHours', 3, 12);

export const REST_TEXT = Object.freeze({
  loiterDone: 349, healed: 350, wakeUp: 353, enemiesNearby: 354, cannotRestNow: 355,
});
/**
 * U48 - THE REST DISPATCH (DaggerfallUI.cs:651-688), the ladder that
 * decides whether the rest window opens at all.
 *
 * IT HAS NO SCENE GATE. DFU's `dfuiOpenRestWindow` arm asks about
 * ENEMIES, SWIMMING and the GROUND, and about nothing else - not
 * whether the player is in a dungeon, a building or a field. The port
 * had this ladder in exactly one host (the dungeon context), so KeyR
 * did nothing at all above ground, which is the same shape U43 found
 * for the character sheet and the inventory one door over.
 *
 * THE ENEMY ARM RAISES THE ALERT before it refuses (:654-655), and
 * that is not decoration: the alert is what arms the rest-encounter
 * roll, so a player who tries to rest with something nearby has made
 * the dungeon more dangerous whether or not they get to sleep.
 *
 * `preventedMessage` is GetPreventedRestMessage (GameManager.cs:641),
 * a registry of (predicate, message) pairs - and its EMPTY STRING is
 * a real case DFU handles separately: RegisterPreventRestCondition
 * turns a null message into "" precisely so a caller can block rest
 * without wording it, and the dispatch then falls back to 355.
 *
 * Answers one of
 *   { kind: 'enemies', textId }   - and the caller RAISES THE ALERT
 *   { kind: 'cannot', textId }
 *   { kind: 'prevented', message } - a registered condition's own words
 *   { kind: 'blocked' }            - a racial override says no, silently
 *   { kind: 'rest' }
 */
export function restDecision({
  enemiesNearby = false, swimming = false, grounded = true,
  preventedMessage = null, racialOverrideBlocks = false,
} = {}) {
  if (enemiesNearby) return { kind: 'enemies', textId: REST_TEXT.enemiesNearby };
  if (swimming || !grounded) return { kind: 'cannot', textId: REST_TEXT.cannotRestNow };
  if (preventedMessage !== null && preventedMessage !== undefined) {
    return preventedMessage === ''
      ? { kind: 'cannot', textId: REST_TEXT.cannotRestNow }
      : { kind: 'prevented', message: preventedMessage };
  }
  // RacialOverrideEffect.CheckStartRest - "Allow custom race to block
  // rest (e.g. vampire not sated)". It says nothing when it refuses;
  // DFU simply returns. V2 is the producer.
  if (racialOverrideBlocks) return { kind: 'blocked' };
  return { kind: 'rest' };
}

/** TEXT.RSC 17 - "camping in the city is illegal" (:69). */
export const CITY_CAMPING_ILLEGAL = 17;
/** Internal_Strings haveNotRentedRoom - the interior refusal (:594). */
export const HAVE_NOT_RENTED_ROOM = 'You have not rented a room here.';

/**
 * U48 - CANREST (DaggerfallRestWindow.cs:542-599), the WHERE gate,
 * which is a different question from restDecision's WHETHER and runs
 * after it. Three branches, and the port had none of them because it
 * had no rest above ground to gate.
 *
 * CAMPING IN A TOWN IS A CRIME, and this is the branch that makes
 * "rest above ground" more than a key binding. Outdoors inside a town
 * the first attempt REFUSES with TEXT.RSC 17 - and commits VAGRANCY
 * and spawns the city guards while doing it. `alreadyWarned` is then
 * true, and the SECOND attempt is allowed: DFU returns
 * `alreadyWarned`, so the player may camp, having already been booked
 * for it. The crime and the guards are charged on BOTH attempts,
 * because they sit above the return.
 *
 * INSIDE A BUILDING it is the owned-or-rented ladder, and the order
 * matters: the permanent-scene test gates the ship/house/room arm
 * ENTIRELY, so a building the player has never held anything in
 * cannot be rested in however the room record reads. The guild arm
 * that follows EXCLUDES TAVERNS, and DFU says why - "they are all
 * marked as fighters guilds in data", so without that test every inn
 * in the Bay would be a free bed for a Fighters Guild member.
 *
 * ANYWHERE ELSE - a dungeon, the wilderness, a town's interior that
 * is not a building - answers true at the tail.
 *
 * Answers { kind: 'allow' } or { kind: 'refuse', textId | message,
 * crime, spawnGuards }.
 */
export function canRestHere({
  inTown = false, insideBuilding = false, alreadyWarned = false,
  permanentScene = false, isShip = false, houseOwned = false,
  remainingHoursRented = -1, buildingIsTavern = false, guildCanRest = false,
} = {}) {
  if (inTown && !insideBuilding) {
    // The crime and the guards are charged whether or not this is the
    // warned attempt - they are above the return, not inside the
    // refusal.
    const out = { crime: CRIMES.Vagrancy, spawnGuards: true };
    return alreadyWarned
      ? { kind: 'allow', ...out }
      : { kind: 'refuse', textId: CITY_CAMPING_ILLEGAL, ...out };
  }
  if (inTown && insideBuilding) {
    if (permanentScene) {
      if (isShip || houseOwned) return { kind: 'allow' };
      if (remainingHoursRented > 0) return { kind: 'allow' };
    }
    if (!buildingIsTavern && guildCanRest) return { kind: 'allow' };
    return { kind: 'refuse', message: HAVE_NOT_RENTED_ROOM };
  }
  return { kind: 'allow' };
}

export const REST_PROMPT = 'Rest how many hours : ';
export const LOITER_PROMPT = 'Loiter how many hours : ';
export const cannotLoiterLines = () => Object.freeze([
  'You cannot loiter more', `than ${loiterLimitHours()} hours at a time.`,
]);

/**
 * One running rest. mode = 'timed' | 'full' | 'loiter'; hours only
 * for timed/loiter. deps (the scene's):
 *   advanceMinutes(n)  - move the classic clock (magic rounds catch up)
 *   tickVitals()       - apply the three per-hour rates + the Medical
 *                        tally; returns TRUE when fully healed
 *   enemiesNearby()    - the RESTING variant
 *   dead()             - health gone (disease/poison through the hours)
 * tick(dt) returns null while running, else the end result
 * { textId, enemyBroke, died }.
 */
export class RestSession {
  constructor(mode, hours, deps) {
    this.mode = mode;
    this.hoursRemaining = hours ?? 0;
    this.deps = deps;
    this.totalHours = 0;
    this._minutesOfHour = 0;
    this._timer = 0;
    this._abortEnemySpawn = false;   // B1: the OnEncounter latch, read at the next tick
    // waitTimePerHour / minutesPerTick, verbatim (NOT per-hour /
    // ticks-per-hour - see the header quirk note).
    this._subTickEvery = (mode === 'loiter' ? LOITER_WAIT_PER_HOUR : REST_WAIT_PER_HOUR) / MINUTES_PER_TICK;
  }

  /** End the session early (the toggle key / Escape): the mode's own
   *  finish text, exactly as DFU's EndRest on the rest binding. */
  endEarly() {
    return { textId: this.mode === 'loiter' ? REST_TEXT.loiterDone : REST_TEXT.wakeUp, enemyBroke: false, died: false };
  }

  /** GameManager.OnEncounter -> DaggerfallRestWindow.
   *  AbortRestForEnemySpawn (:301-304): latch only; the next tick
   *  answers the enemies-nearby break. */
  abortForEnemySpawn() { this._abortEnemySpawn = true; }

  tick(dt) {
    // The per-frame checks, in DFU's Update order (:215-227): death
    // ends at once (the death flow owns the message); an
    // already-healed FullRest ends without waiting for an hour; and a
    // NON-FullRest session with hoursRemaining < 1 ends BEFORE
    // TickRest runs - so a 0-hour timed/loiter request (the prompts
    // clamp a negative input to 0 and accept it, :745-748/:770-773)
    // passes no world time at all: no RaiseTime, no enemy check, no
    // vitals. The `hoursRemaining < 1` test inside TickRest is the
    // SECOND one, not the only one.
    if (this.deps.dead()) return { textId: null, enemyBroke: false, died: true };
    if (this.mode === 'full' && this.deps.fullyHealed?.()) return { textId: REST_TEXT.healed, enemyBroke: false, died: false };
    if (this.mode !== 'full' && this.hoursRemaining < 1) {
      return { textId: this.mode === 'loiter' ? REST_TEXT.loiterDone : REST_TEXT.wakeUp, enemyBroke: false, died: false };
    }

    // B1: AbortRestForEnemySpawn (DaggerfallRestWindow.cs:301-304, read
    // in Update) - GameManager.OnEncounter's ONE core consumer: a quest
    // foe spawned by CreateFoe while resting wakes the player with the
    // enemies-nearby text, exactly like the hourly check below.
    if (this._abortEnemySpawn) {
      this._abortEnemySpawn = false;
      return { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false };
    }

    this._timer += dt;
    while (this._timer >= this._subTickEvery) {
      this._timer -= this._subTickEvery;
      this.deps.advanceMinutes(MINUTES_PER_TICK);
      this._minutesOfHour += MINUTES_PER_TICK;
      if (this._minutesOfHour < 60) continue;
      this._minutesOfHour = 0;
      this.totalHours++;
      // A full hour: the enemy break first, then vitals/completion.
      if (this.deps.enemiesNearby()) return { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false };
      if (this.mode === 'timed') {
        this.deps.tickVitals();
        if (--this.hoursRemaining < 1) return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false };
      } else if (this.mode === 'full') {
        if (this.deps.tickVitals()) return { textId: REST_TEXT.healed, enemyBroke: false, died: false };
      } else {
        if (--this.hoursRemaining < 1) return { textId: REST_TEXT.loiterDone, enemyBroke: false, died: false };
      }
    }
    return null;
  }
}
