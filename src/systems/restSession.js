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
// cannot-loiter lines. THREE lanes independently retired the line
// that stood here for four audits - "Building trespass/rent rules
// pend towns" - by porting CanRest (:542-599) whole, and the merge
// below is the union of what each of them got right.

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
  cityCampingIllegal: 17,   // V5: DaggerfallRestWindow.cs:69
});
/** Internal_Strings.csv:357 / :871 - the two lines CanRest speaks. */
export const HAVE_NOT_RENTED_ROOM = 'You have not rented a room here.';
export const ILLEGAL_REST_WARNING = 'It is illegal to camp in or near a city. Continue?';
/** DFLocation.BuildingTypes.Tavern - the one type the guild-hall arm
 *  excludes, because the data marks EVERY tavern a Fighters Guild. */
export const BUILDING_TAVERN = 15;
/** DFLocation.BuildingTypes.Ship / None - CanRest's ship arm (:580)
 *  and the bag's default when no door has been walked through. */
export const BUILDING_SHIP = 24;
export const BUILDING_NONE = -1;

/** PlayerEntity.GetRemainingHours (:268-275): the hours a rental still
 *  has to run, -1 for no room.
 *
 *  CEILING, not a truncating cast. The C# is
 *  `(int)Math.Ceiling(remainingSecs / SecondsPerHour)` - the cast is
 *  applied to a value Math.Ceiling has ALREADY rounded up, so it
 *  truncates nothing. One lane read the cast and wrote `Math.trunc`
 *  with a note explaining why the difference never shows; it shows in
 *  two places. A room with one minute left reads ONE hour rather than
 *  zero, so `> 0` still lets you sleep in it - and
 *  RemoveExpiredRentedRooms (:257-266) drops a room whose hours are
 *  `< 1`, which under a ceiling is true exactly when no time at all
 *  is left. Under truncation the sweep would evict a room that still
 *  had 59 minutes on it. */
export const remainingHoursRented = (room, nowMinutes) =>
  (room ? Math.ceil((room.expiryMinutes - nowMinutes) / 60) : -1);

/**
 * U48 - THE REST DISPATCH (DaggerfallUI.cs:651-688), which is the
 * question ABOVE CanRest: not where the player may sleep, but whether
 * the window opens at all.
 *
 * IT HAS NO SCENE GATE. The `dfuiOpenRestWindow` arm asks about
 * ENEMIES, SWIMMING and the GROUND, and about nothing else. V5 ported
 * CanRest and wired three hosts to it; this ladder still lived inline
 * inside dungeonContext, so above ground a player could open the rest
 * window while swimming, while falling, and with a foe in the street.
 *
 * FOUR THINGS IN ORDER, and the order is the law:
 *
 * 1. ENEMIES OUTRANK THE WATER, because DFU's is an if/else-if chain -
 *    and it matters, because only this arm RAISES THE ALERT (:654-655),
 *    which is what arms the rest-encounter roll. A player who tries to
 *    rest with something nearby has paid for the attempt.
 * 2. Swimming or airborne is 355. StartRestGroundedCheck is the
 *    grounded half and lives in player/motor.js, its DFU home.
 * 3. THE PREVENTED-REST REGISTRY (GameManager.GetPreventedRestMessage,
 *    :641-653) and its EMPTY STRING, which is deliberate:
 *    RegisterPreventRestCondition turns a null message into "" so a
 *    caller can block rest without wording it, and the dispatch falls
 *    back to 355 rather than showing a blank box. null is NOT "".
 * 4. A RACIAL OVERRIDE REFUSES SILENTLY - RacialOverrideEffect
 *    .CheckStartRest, "allow custom race to block rest (e.g. vampire
 *    not sated)" - and it is LAST, so a swimming vampire is told about
 *    the water, which is the arm they can act on.
 *
 * Answers { kind: 'rest' | 'enemies' | 'cannot' | 'prevented' |
 * 'blocked' } with the textId or message the caller speaks.
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
  if (racialOverrideBlocks) return { kind: 'blocked' };
  return { kind: 'rest' };
}

/**
 * DaggerfallRestWindow.CanRest (:542-600), verbatim in shape.
 *
 * THE WHOLE TOWN HALF OF RESTING WAS UNPORTED until V5, and the
 * first-hour probe made it concrete: a character rented a room in
 * Burgley for five gold - the gold left the purse, the rental record
 * landed - and then could not go to sleep in it.
 *
 * Answers a verdict rather than a bool, because DFU's own return is
 * only half the story: the town arm ALSO registers a crime and calls
 * the watch, and the caller has to know the allocated bed to move the
 * player to it.
 *
 *   { allowed, textId?, line?, crime?, spawnGuards?, hoursRented, bedIndex }
 *
 * THE TWO-STEP CAMPING FLOW, verbatim and easy to misread. Inside a
 * town's rect the answer is `alreadyWarned` ITSELF:
 *   - first press (alreadyWarned false) -> refused, and the
 *     cityCampingIllegal box shows;
 *   - the buttons re-ask through the illegalRestWarning Yes/No box
 *     (:648-664, gated on the GUI/IllegalRestWarning setting) and a
 *     Yes calls back with true -> ALLOWED.
 * Either way Vagrancy is registered and the watch is spawned - so a
 * player who tries to camp in town and then backs out has still
 * committed the crime, and with the warning setting OFF they commit
 * it on every press while never being allowed to rest. Verbatim.
 *
 * LOITER DOES NOT COME THROUGH HERE AT ALL (:693-706) - the loiter
 * button opens its hours prompt directly, so loitering in a town is
 * free of both the refusal and the crime. Also verbatim.
 *
 * A DFU DEFECT THE PORT'S SHAPE AVOIDS: inside the permanent-scene
 * arm DFU reads `room.allocatedBedIndex` with no null check (:582),
 * having just called GetRemainingHours which explicitly handles a
 * null room. A permanent scene whose rental record is gone - an
 * expired room the sweep has not yet collected - is a
 * NullReferenceException there. Here the room is tested before it is
 * read, and a missing one simply fails the `hoursRented > 0` gate.
 */
export function canRest({
  // PlayerGPS.IsPlayerInTown(mustBeInLocationRect: true, mustBeOutside: true)
  // - TRUE only standing in the OPEN inside a town's rect. Read the
  // second flag backwards and every inn refuses to let you sleep.
  inTownOutside = false,
  inTownLocation = false,    // PlayerGPS.IsPlayerInTown() - the location type alone
  insideBuilding = false,
  buildingType = null,
  permanentScene = false,    // StateManager.ContainsPermanentScene(sceneName)
  isShip = false,
  houseOwned = false,        // DaggerfallBankManager.IsHouseOwned(buildingKey)
  room = null,               // the rental record for THIS inn, or null
  nowMinutes = 0,
  restMarkers = 0,           // Interior.FindMarkers(InteriorMarkerTypes.Rest).length
  guildCanRest = false,      // GuildManager.GetGuild(factionID).CanRest()
  alreadyWarned = false,
} = {}) {
  if (inTownOutside) {
    return {
      allowed: alreadyWarned,
      textId: alreadyWarned ? null : REST_TEXT.cityCampingIllegal,
      crime: 'Vagrancy', spawnGuards: true,
      hoursRented: -1, bedIndex: -1,
    };
  }
  if (inTownLocation && insideBuilding) {
    // S40: `hoursRented` and `bedIndex` are DFU's two OUT-PARAMETERS
    // (`remainingHoursRented`, `allocatedBed`, set at :544-545 and
    // written as the arms run), not per-arm return values - and that
    // matters, because TickRest counts the first one DOWN every rested
    // hour (CheckRent, :441-448) and EndRest's first arm reads it
    // again (:480). Returning a flat -1 from the arms below made both
    // unreachable: a rented room never ran out under the sleeper.
    let hoursRented = -1;
    let bedIndex = -1;
    if (permanentScene) {
      // A ship or a house you own needs no rental and no bed marker.
      if (isShip || houseOwned) return { allowed: true, hoursRented: -1, bedIndex: -1 };
      hoursRented = remainingHoursRented(room, nowMinutes);
      // The bed index is stored rather than a position because
      // "building positions are not stable" (DFU's own comment);
      // out of range falls to 0, as :582.
      const idx = (room && room.allocatedBedIndex >= 0 && room.allocatedBedIndex < restMarkers)
        ? room.allocatedBedIndex : 0;
      bedIndex = restMarkers > 0 ? idx : -1;
      if (hoursRented > 0) return { allowed: true, hoursRented, bedIndex };
    }
    // The guild-hall privilege, and the tavern exclusion that has to
    // come with it: the data marks every tavern a Fighters Guild, so
    // without this every innkeeper's common room would be a free bed.
    if (buildingType !== BUILDING_TAVERN && guildCanRest) {
      // FindMarker (singular) OVERWRITES allocatedBed with the first
      // rest marker (:591), but `remainingHoursRented` is untouched -
      // DFU never resets it, so an expired room's 0 survives into this
      // arm and EndRest still reports the room as expired.
      return { allowed: true, hoursRented, bedIndex: restMarkers > 0 ? 0 : -1 };
    }
    // The refusal carries both out-parameters as DFU left them, which
    // is how an expired room reports 0 rather than -1.
    return { allowed: false, line: HAVE_NOT_RENTED_ROOM, hoursRented, bedIndex };
  }
  // The wilderness, a dungeon, a town you are not standing in the
  // rect of: rest freely. This is the arm the dungeon host has always
  // taken, which is why resting there worked and nowhere else did.
  return { allowed: true, hoursRented: -1, bedIndex: -1 };
}
export const REST_PROMPT = 'Rest how many hours : ';
/** TimedRestPrompt's range arm (:753-757): past 99 hours DFU refuses
 *  with TEXT.RSC 26 and the prompt STAYS UP. The port used to make
 *  this unreachable by capping the field at two digits, which is a
 *  cap DFU does not have - its MaxCharacters is 8 (:621, :702). */
export const CANNOT_REST_MORE_THAN_99_HOURS_ID = 26;
export const MAX_REST_HOURS = 99;
/** DaggerfallInputMessageBox.TextBox.MaxCharacters on both prompts
 *  (:621, :702). The field is PREFILLED with "0" (:619, :700), so
 *  Enter on an untouched prompt parses and starts a 0-hour rest -
 *  int.TryParse only fails once the player has emptied it. */
export const PROMPT_MAX_CHARS = 8;
export const PROMPT_INITIAL = '0';
export const LOITER_PROMPT = 'Loiter how many hours : ';
export const cannotLoiterLines = () => Object.freeze([
  'You cannot loiter more', `than ${loiterLimitHours()} hours at a time.`,
]);

/** Internal_Strings.csv :358, verbatim - EndRest's FIRST arm, which
 *  outranks "You wake up." and "You are healed." both (:480-486). */
export const EXPIRED_RENTED_ROOM = 'Your time for this room has expired.';
/** Settings/GUI/IllegalRestWarning, read at point of use (ships True).
 *  DFU reads it fresh on every button click, so a launcher flip lands
 *  without reopening the window. */
export const illegalRestWarning = () => getBool('GUI', 'IllegalRestWarning');

/**
 * CanRest's argument bag for INSIDE A BUILDING, as a pure function of
 * what the host reads (`:563-597`). It lives here rather than inside
 * the interior host because a bag built in a closure can only be
 * pinned by a regex over its own source - and a review round proved
 * that hollow: flipping `insideBuilding` to false there bypassed the
 * ENTIRE lodging economy (every interior rests free, no room, no bed,
 * no rent) with the whole suite still green, because nothing ran it.
 *
 * `inTownOutside` is a constant false and that IS the law:
 * IsPlayerInTown(true, true) passes `mustBeOutside`, and the player
 * inside a building is not. `inTownLocation` is the BARE
 * IsPlayerInTown() - location type only, no rect test, no inside
 * test, both optional flags defaulting off (PlayerGPS.cs:504-527).
 */
export function interiorRestPlace({
  inTownLocation = false, building = null, nowMinutes = 0,
  restMarkers = 0, permanentScene = false, houseOwned = false,
  room = null, guildCanRest = false,
} = {}) {
  const buildingType = building?.buildingType ?? BUILDING_NONE;
  return {
    inTownOutside: false,
    inTownLocation,
    insideBuilding: true,
    buildingType,
    isShip: buildingType === BUILDING_SHIP,
    permanentScene,
    // DaggerfallBankManager.IsHouseOwned - live since H1; a host
    // without a bank passes DFU's own default for a player who has
    // bought nothing.
    houseOwned,
    room,
    nowMinutes,
    restMarkers,
    guildCanRest,
  };
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
      // TickRest :376-379, `RaiseTime` then `QuestMachine.Instance.
      // Tick()`, in that order and inside the SAME sub-tick. DFU's own
      // comment two lines above says the ten-minute granularity exists
      // for exactly this: "This allows quest machine to have more time
      // resolution while still counting off rest in hourly
      // increments." The port ported the clock half and not the quest
      // half, and every host gates its ordinary questBridge.tick on
      // "no overlay up" - so a rested night ran ZERO quest ticks. Same
      // shape as AUDIT 24 wave 30, which found the magic-round half of
      // this frozen and fixed only that half.
      //
      // It is the SESSION's law and not a host's: DFU calls the
      // machine directly here, bypassing QuestMachine.Update's
      // real-time pacing, so the port must call the unpaced door too.
      this.deps.tickQuests?.();
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
