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
// cannot-loiter lines. S40 added the fourth and largest gate below -
// CanRest, the whole lodging ladder - and retired the sentence that
// stood here since U7 saying building trespass and rent rules pend
// towns.

import { getInt, getBool } from './settings.js';   // SETT: LoiterLimitInHours, S40: IllegalRestWarning
import { roomRemainingHours } from './tavern.js';   // S40: GetRemainingHours, CanRest's room arm
import { interiorSceneName } from './sceneCache.js';   // S40: DaggerfallInterior.GetSceneName
import { BUILDING_TYPES } from '../world/buildingNames.js';   // S40: the Ship and Tavern arms

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
/** DaggerfallRestWindow's TEXT.RSC 17 - "Camping in the city is
 *  illegal" (:69, :554). A record id, not a string key. */
export const CITY_CAMPING_ILLEGAL_ID = 17;
/** Internal_Strings.csv :357, verbatim. */
export const HAVE_NOT_RENTED_ROOM = 'You have not rented a room here.';
/** Internal_Strings.csv :871, verbatim - the Yes/No box the WHILE and
 *  HEALED buttons raise BEFORE they ever reach CanRest, when
 *  Settings.IllegalRestWarning is on and the player is in town
 *  outdoors (:645-652, :671-677). Its Yes arm is the ONLY producer of
 *  CanRest's `alreadyWarned`. */
export const ILLEGAL_REST_WARNING = 'It is illegal to camp in or near a city. Continue?';
/** Internal_Strings.csv :358, verbatim - EndRest's FIRST arm, which
 *  outranks "You wake up." and "You are healed." both (:480-486). */
export const EXPIRED_RENTED_ROOM = 'Your time for this room has expired.';
/** Settings/GUI/IllegalRestWarning, read at point of use (ships True).
 *  DFU reads it fresh on every button click, so a launcher flip lands
 *  without reopening the window. */
export const illegalRestWarning = () => getBool('GUI', 'IllegalRestWarning');

/**
 * THE OPEN GATE - DaggerfallUI.cs:651-687, the `dfuiOpenRestWindow`
 * message handler. Three refusals stand between the Rest action and
 * the window ever being pushed, and they are SCENE-FREE: DFU raises
 * this from one handler, so a foe at your back stops you resting in a
 * dungeon, a shop and a field alike. The port had them written out
 * inline in the dungeon host, which is where rest lived; S40 gave
 * three more hosts a rest key, so the gate needs one home too.
 *
 *  1. AreEnemiesNearby(TRUE) - the RESTING variant, the same one the
 *     hourly break uses. DFU raises the enemy alert HERE
 *     (DaggerfallUI.cs:655 - every other number in this doc is the
 *     rest window's, so this one is spelled out), which
 *     is what arms the dungeon's rest-encounter roll, and then shows
 *     TEXT.RSC 354.
 *  2. Swimming, or failing StartRestGroundedCheck (PlayerMotor.cs:
 *     184-194: grounded passes at once, else a ray of height/2 + 0.2
 *     lets a near-ground levitator rest) - TEXT.RSC 355.
 *  3. GetPreventedRestMessage / GiveOffer / the racial override's
 *     CheckStartRest, which are FLAGGED: the vampire's "not sated"
 *     block and the quest offer-on-rest both pend their own arcs.
 *
 * Answers { ok, textId, alert } - the host raises the alert and shows
 * the record, because only it owns those.
 */
export function restOpenGate({ enemiesNearby = false, swimming = false, grounded = true } = {}) {
  if (enemiesNearby) return { ok: false, textId: REST_TEXT.enemiesNearby, alert: true };
  if (swimming || !grounded) return { ok: false, textId: REST_TEXT.cannotRestNow, alert: false };
  return { ok: true, textId: null, alert: false };
}

/**
 * CanRest's argument bag for INSIDE A BUILDING, as a pure function of
 * what the host reads (`:563-597`). It lives here rather than inside
 * the interior host because a bag built in a closure can only be
 * pinned by a regex over its own source - and a review round proved
 * that hollow: flipping `insideBuilding` to false there bypassed the
 * ENTIRE lodging economy (every interior rests free, no room, no bed,
 * no rent) with the whole suite still green, because nothing ran it.
 *
 * `inTownStrict` is a constant false and that IS the law:
 * IsPlayerInTown(true, true) passes `mustBeOutside`, and the player
 * inside a building is not. `inTown` is the BARE IsPlayerInTown() -
 * location type only, no rect test, no inside test, both optional
 * flags defaulting off (PlayerGPS.cs:504-527).
 */
export function interiorRestPlace({
  inTown = false, building = null, mapId = 0, nowMinutes = 0,
  restMarkers = [], isPermanentScene = () => false,
  isHouseOwned = () => false, rentedRoom = () => null,
  guildCanRest = () => false,
} = {}) {
  return {
    inTownStrict: false,
    inTown,
    insideBuilding: true,
    buildingType: building?.buildingType ?? BUILDING_TYPES.None,
    buildingKey: building?.buildingKey ?? 0,
    mapId,
    isPermanentScene,
    // DaggerfallBankManager.IsHouseOwned - the bank's house ledger is
    // unported, so a host with no bank passes DFU's own default for a
    // player who has bought nothing. FLAGGED with the bank slice.
    isHouseOwned,
    rentedRoom,
    nowMinutes,
    restMarkers,
    guildCanRest,
  };
}

/**
 * DaggerfallRestWindow.CanRest (:542-599), the whole gate - and until
 * S40 the port had none of it, because rest existed only in the
 * dungeon host where the answer is always yes. Outdoors and in a
 * building the answer is most of Daggerfall's lodging economy.
 *
 * Three arms, in DFU's order:
 *
 *  1. IN TOWN AND OUTDOORS (:549-562). Camping is illegal. DFU returns
 *     `alreadyWarned`, and that word is easy to misread: it is NOT
 *     "you pressed rest once already". It is the Yes answer to the
 *     IllegalRestWarning box, which the WHILE and HEALED buttons
 *     raise BEFORE calling CanRest at all (:645-657). So with the
 *     setting ON (its shipped value) camping in town is a CONFIRM,
 *     and with it OFF camping in town is simply IMPOSSIBLE - the
 *     window closes on TEXT.RSC 17 and no time passes, no matter how
 *     many times the key is pressed. What does NOT depend on the
 *     setting: Vagrancy is registered and SpawnCityGuards(true) fires
 *     on BOTH paths (:558-559), so being turned away still puts
 *     guards on the street. That is the quirk worth keeping.
 *  2. IN TOWN AND INSIDE. If the building is a PERMANENT SCENE it is
 *     one the player has a claim on - a ship or an owned house rests
 *     outright, otherwise the rented-room record decides, and the
 *     allocated bed is looked up BY INDEX into the interior's Rest
 *     markers (DFU relinks by index because building positions are
 *     not stable across terrain mods). Failing that, a guild hall the
 *     player may rest in - EXCLUDING taverns, which the data marks as
 *     fighters guilds and which would otherwise give every inn a free
 *     bed. Failing that, "You have not rented a room here."
 *  3. ANYWHERE ELSE - the wilderness, a dungeon - rest freely.
 *
 * Answers a decision rather than acting: { ok, crime, spawnGuards,
 * textId, text, remainingHoursRented, allocatedBed }. The host
 * commits the crime and moves the player.
 */
export function canRest({
  inTownStrict = false, inTown = false, insideBuilding = false,
  buildingType = BUILDING_TYPES.None, buildingKey = 0, mapId = 0,
  isPermanentScene = () => false, isHouseOwned = () => false,
  rentedRoom = () => null, nowMinutes = 0,
  restMarkers = [], guildCanRest = () => false,
  alreadyWarned = false,
} = {}) {
  const none = { remainingHoursRented: -1, allocatedBed: null };
  // IsPlayerInTown(true, true) - the STRICT variant, which is the
  // outdoors-in-a-town test.
  if (inTownStrict) {
    return {
      ...none,
      ok: alreadyWarned,   // the confirm box's Yes, not a second press
      crime: 'Vagrancy',   // registered on BOTH paths (:558-559)
      spawnGuards: true,
      textId: alreadyWarned ? null : CITY_CAMPING_ILLEGAL_ID,
    };
  }
  if (inTown && insideBuilding) {
    let remainingHoursRented = -1;
    let allocatedBed = null;
    if (isPermanentScene(interiorSceneName(mapId, buildingKey))) {
      if (buildingType === BUILDING_TYPES.Ship || isHouseOwned(buildingKey)) {
        return { ...none, ok: true, crime: null, spawnGuards: false, textId: null };
      }
      const room = rentedRoom();
      remainingHoursRented = roomRemainingHours(room, nowMinutes);
      // The bed is relinked BY INDEX, and an out-of-range index falls
      // back to 0 rather than throwing (:581-583). Two guards here are
      // OURS and are named as deviations: DFU dereferences `room`
      // without a null check and indexes `restMarkers` without a
      // length check, so a permanent scene with no rental record - or
      // an interior with no Rest marker - throws in DFU and answers
      // "no bed" here. Neither shape is reachable in DFU's own data
      // (only RentRoom adds a non-owned permanent scene), so this is
      // a crash the port declines to reproduce, not a rule it bends.
      if (restMarkers.length) {
        const i = room && room.allocatedBedIndex >= 0 && room.allocatedBedIndex < restMarkers.length
          ? room.allocatedBedIndex : 0;
        allocatedBed = restMarkers[i];
      }
      if (remainingHoursRented > 0) {
        return { ok: true, crime: null, spawnGuards: false, textId: null, remainingHoursRented, allocatedBed };
      }
    }
    // The tavern exclusion is load bearing: every tavern in the data
    // carries the fighters-guild faction, so without it a Fighters
    // Guild member sleeps free in every inn in the Bay (:588-590).
    if (buildingType !== BUILDING_TYPES.Tavern && guildCanRest()) {
      return {
        ok: true, crime: null, spawnGuards: false, textId: null,
        remainingHoursRented, allocatedBed: restMarkers[0] ?? null,
      };
    }
    return {
      ok: false, crime: null, spawnGuards: false,
      text: HAVE_NOT_RENTED_ROOM, remainingHoursRented, allocatedBed,
    };
  }
  return { ...none, ok: true, crime: null, spawnGuards: false, textId: null };
}

export class RestSession {
  constructor(mode, hours, deps, remainingHoursRented = -1) {
    this.mode = mode;
    this.hoursRemaining = hours ?? 0;
    this.deps = deps;
    // S40: CanRest's out-parameter, carried into the session because
    // TickRest counts it DOWN (see checkRent below). -1 is DFU's "not
    // a rented room" sentinel and the reason a dungeon rest is not
    // billed by the hour.
    this.remainingHoursRented = remainingHoursRented;
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
    // EndRest's mode arms (:487-503), not a flat "You wake up.": a
    // FullRest stopped on the very frame it completes still reports
    // healed, because DFU picks `IsPlayerFullyHealed() ? healed :
    // wakeUp` at the moment EndRest runs rather than at the moment the
    // hours ran out. Narrow, and one line to be exact about.
    if (this.mode === 'loiter') return this._finish(REST_TEXT.loiterDone);
    if (this.mode === 'full' && this.deps.fullyHealed?.()) return this._finish(REST_TEXT.healed);
    return this._finish(REST_TEXT.wakeUp);
  }

  /** GameManager.OnEncounter -> DaggerfallRestWindow.
   *  AbortRestForEnemySpawn (:301-304): latch only; the next tick
   *  answers the enemies-nearby break. */
  abortForEnemySpawn() { this._abortEnemySpawn = true; }

  /** CheckRent (:441-448), run at the END of every rested hour
   *  (:435-436) after the mode's own completion test. Verbatim, and
   *  the shape is easy to get wrong: it fires exactly ONCE, on the
   *  hour the counter reaches zero - not while it is negative, and not
   *  when there was never a room (-1 returns before the decrement, so
   *  an unrented rest never counts down at all). */
  checkRent() {
    if (this.remainingHoursRented === -1) return false;
    this.remainingHoursRented--;
    return this.remainingHoursRented === 0;
  }

  /** EndRest (:450) reaches four arms; this is the first of its final
   *  ELSE (:480-486), and it outranks the mode's own line:
   *  a timed rest whose room expires on the last hour says "Your time
   *  for this room has expired.", not "You wake up." - and DFU calls
   *  RemoveExpiredRentedRooms right there, so the landlord clears the
   *  room as the player wakes. */
  _finish(textId) {
    if (this.remainingHoursRented === 0) return { textId: null, text: EXPIRED_RENTED_ROOM, rentExpired: true, enemyBroke: false, died: false };
    return { textId, enemyBroke: false, died: false };
  }

  tick(dt) {
    // The per-frame checks, in DFU's Update order (:215-227): death
    // ends at once (the death flow owns the message); an
    // already-healed FullRest ends without waiting for an hour; and a
    // NON-FullRest session with hoursRemaining < 1 ends BEFORE
    // TickRest runs - so a 0-hour timed/loiter request (the prompts
    // clamp a negative input to 0 and accept it, :749-752/:774-777 -
    // the parse GUARD that returns on unparseable input is the pair
    // above each, :745-746/:770-771)
    // passes no world time at all: no RaiseTime, no enemy check, no
    // vitals. The `hoursRemaining < 1` test inside TickRest is the
    // SECOND one, not the only one.
    if (this.deps.dead()) return { textId: null, enemyBroke: false, died: true };
    if (this.mode === 'full' && this.deps.fullyHealed?.()) return this._finish(REST_TEXT.healed);
    if (this.mode !== 'full' && this.hoursRemaining < 1) {
      return this._finish(this.mode === 'loiter' ? REST_TEXT.loiterDone : REST_TEXT.wakeUp);
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
      // TickRest's own order (:348-438): the mode's completion is
      // decided FIRST and CheckRent runs after it, so a rest that
      // finishes on the very hour the room expires answers the
      // EXPIRED line - _finish is where that precedence lives.
      let done = null;
      if (this.mode === 'timed') {
        this.deps.tickVitals();
        if (--this.hoursRemaining < 1) done = REST_TEXT.wakeUp;
      } else if (this.mode === 'full') {
        if (this.deps.tickVitals()) done = REST_TEXT.healed;
      } else {
        if (--this.hoursRemaining < 1) done = REST_TEXT.loiterDone;
      }
      // `finished |= CheckRent()` - the decrement runs EVERY hour, so
      // it must not be short-circuited by the mode already finishing.
      const rentUp = this.checkRent();
      if (done !== null || rentUp) return this._finish(done ?? REST_TEXT.wakeUp);
    }
    return null;
  }
}
