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

// RESTX1 (2026-09-15, Mac: "for online I want to change the rest
// mechanic to not use any time. Basically rest just becomes the way to
// regain") made an online REST resolve in ONE FRAME - the whole hourly
// ladder run inside a single tick(), no minutes passed, no host clock
// jump, no encounter roll - and left LOITER pacing off the shared
// world clock at DFU's TimeScale (an hour of loiter was five real
// minutes of watching a counter).
//
// RESTX2 (2026-09-17, Mac, "BetterResting": monsters should still be
// able to interrupt an online wait, and the hours-remaining counter
// should visibly tick down rather than jump straight to its answer)
// RETIRES BOTH SPECIAL CASES. ONE LAW FOR EVERY MODE, ONLINE OR OFF:
// the window's own real-time timer (REST_WAIT_PER_HOUR /
// LOITER_WAIT_PER_HOUR real seconds a simulated hour) paces every
// sub-tick, exactly as offline always did. So online:
//   - the counter ticks down at the offline rate (eight hours in six
//     real seconds; three hours of loiter in under four);
//   - `advanceMinutes` is spent on EVERY sub-tick, so the magic-round
//     catch-up and the hourly rest-interruption encounter roll
//     (runEncounterTick / the dungeon's _restAdvance) run online as
//     they always have offline - a foe that wanders in breaks the rest;
//   - the shared WORLD clock is untouched: `worldTick.setWorldMinutes`
//     still refuses every local write while it stands (:834-838), so
//     this is pacing only, not time made or taken from anyone else's
//     sky. The game minutes the encounter roll and the catch-up READ
//     online come from `_onlineSimMinutes`, a counter local to this
//     one session - seeded from the shared clock, ten minutes a
//     sub-tick, forgotten when the session ends - handed to the host as
//     the sub-tick's END (AUDIT WORLD5 C8's slot), so every simulated
//     hour rolls against a fresh, distinct minute;
//   - a QUEST tick still does not happen online. A quest clock is
//     cross-player-visible state; ticking it against a locally
//     simulated minute would desync this player's quests from everyone
//     else's. Offline the quest tick rides the sub-tick as DFU has it.
// AUDIT RESTX F1's full-health guard on the Medical tally went with
// the free lane: the exploit it closed ("rest 99 hours" = 99 tallies on
// one click) needed an hour that cost no time, and every hour costs
// its real seconds again. DFU's unconditional tally stands in every
// lane.

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

// ---- ROAD-B B5: THE PREVENT-REST REGISTRY (GameManager.cs:52,
// :637-675) ----
//
// The port has carried this registry's ANSWER since U48 -
// restDecision's third arm reads a `preventedMessage` - but never the
// registry, so nothing could produce one and both consumers (the open
// gate and, from B5, TickRest's per-frame poll) were fed a permanent
// null. DFU's own tree has no caller either; the doc comment names the
// audience ("prevents the player from starting or continuing to rest")
// and the class is ported whole because that is the doctrine, with the
// EMPTY-STRING normalisation which is the half that is NOT inert - it
// is the difference between "no prevention" and "prevented, wordlessly"
// and both consumers already branch on it.
//
// The Dictionary is keyed by the HANDLER, so re-registering the same
// function replaces its message rather than doubling the condition, and
// insertion order decides which of two live conditions speaks (C#'s
// Dictionary enumeration order is unspecified; a Map's is insertion,
// which is the deterministic reading of the same walk).
const preventRestConditions = new Map();

/** RegisterPreventRestCondition (:660-666). A null message becomes ""
 *  - DFU's own comment: "If the message is null, it is assumed by the
 *  game that there was no prevention, so we must set it to be the
 *  empty string instead". */
export function registerPreventRestCondition(handler, message) {
  if (typeof handler !== 'function') return;
  preventRestConditions.set(handler, message == null ? '' : message);
}

/** UnregisterPreventRestCondition (:672-675). */
export function unregisterPreventRestCondition(handler) {
  preventRestConditions.delete(handler);
}

/** GetPreventedRestMessage (:641-653) - the FIRST condition that
 *  answers true speaks; null when none do. */
export function getPreventedRestMessage() {
  for (const [handler, message] of preventRestConditions) {
    if (handler()) return message;
  }
  return null;
}

/** Not DFU's - the port's teardown door, so a page that rebuilds its
 *  scene does not carry a dead closure's condition into the next one. */
export function clearPreventRestConditions() { preventRestConditions.clear(); }

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
 * FIVE THINGS IN ORDER, and the order is the law:
 *
 * 1. ENEMIES OUTRANK THE WATER, because DFU's is an if/else-if chain -
 *    and it matters, because only this arm RAISES THE ALERT (:654-655),
 *    which is what arms the rest-encounter roll. A player who tries to
 *    rest with something nearby has paid for the attempt.
 * 2. Swimming or airborne is 355. StartRestGroundedCheck is the
 *    grounded half and lives in player/motor.js, its DFU home.
 * 3. THE PREVENTED-REST REGISTRY (GameManager.GetPreventedRestMessage,
 *    :641-653), ASKED ONLY HERE - it is fetched inside the third
 *    `else` (:667-669), so DFU never runs a registered condition on a
 *    press the enemy or the swimming/grounded arm answered. The
 *    registry's handlers are arbitrary caller-supplied `Func<bool>`s
 *    (:660-666), so "when they run" is part of the contract and not
 *    an optimisation; pass this as a FUNCTION and the arm calls it,
 *    the way shared.js hands TickRest the producer rather than a
 *    polled value. A plain string or null still works, for the
 *    callers that already have the answer.
 *    ...and its EMPTY STRING, which is deliberate:
 *    RegisterPreventRestCondition turns a null message into "" so a
 *    caller can block rest without wording it, and the dispatch falls
 *    back to 355 rather than showing a blank box. null is NOT "".
 * 4. A PENDING QUEST OFFER TAKES THE PRESS (AUDIT 58). `else if
 *    (!GiveOffer())` (:680) is a RUNG this ladder was missing: when a
 *    `give pc _item_ notify`/`silently` offer has become eligible,
 *    DaggerfallUI hands the item over on the spot and swallows the
 *    press - the rest window does not open, and the NEXT press rests
 *    normally (DaggerfallUI.cs:1717-1726; ui/pendingOffer.js is the
 *    latch). It is a PRODUCER for the same reason the registry above
 *    is: GiveOffer has a side effect, so "when it runs" is the law -
 *    only on a press the first three arms did not answer.
 * 5. A RACIAL OVERRIDE REFUSES SILENTLY - RacialOverrideEffect
 *    .CheckStartRest, "allow custom race to block rest (e.g. vampire
 *    not sated)" - and it is LAST, so a swimming vampire is told about
 *    the water, which is the arm they can act on.
 *
 * Answers { kind: 'rest' | 'enemies' | 'cannot' | 'prevented' |
 * 'offer' | 'blocked' } with the textId or message the caller speaks;
 * 'offer' has nothing to say - the press is simply spent.
 */
export function restDecision({
  enemiesNearby = false, swimming = false, grounded = true,
  preventedMessage = null, giveOffer = null, racialOverrideBlocks = false,
} = {}) {
  if (enemiesNearby) return { kind: 'enemies', textId: REST_TEXT.enemiesNearby };
  if (swimming || !grounded) return { kind: 'cannot', textId: REST_TEXT.cannotRestNow };
  // The third `else` (:667-669) - and the first line of it that runs.
  const prevented = typeof preventedMessage === 'function' ? preventedMessage() : preventedMessage;
  if (prevented !== null && prevented !== undefined) {
    return prevented === ''
      ? { kind: 'cannot', textId: REST_TEXT.cannotRestNow }
      // the RESOLVED text, never the producer: every host renders this
      // field straight into an ActionTextBox line, and DaggerfallUI.cs
      // :667-669 shows the string GetPreventedRestMessage returned.
      : { kind: 'prevented', message: prevented };
  }
  // :680's `else if (!GiveOffer())` - inside the third else, after the
  // prevented-rest message and BEFORE the racial override.
  if (typeof giveOffer === 'function' ? giveOffer() : !!giveOffer) return { kind: 'offer' };
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
 *  with TEXT.RSC 26 as a NEW box over the SELECTION page - the input
 *  box already closed itself before the handler ran
 *  (DaggerfallInputMessageBox.cs:298-304); AUDIT 26 F144 corrected
 *  this comment's old claim that the prompt "stays up", which had
 *  licensed a retry that skipped CanRest. The port also used to make
 *  the arm unreachable by capping the field at two digits, a cap DFU
 *  does not have - its MaxCharacters is 8 (:621, :702). */
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
  /** ROAD-B B5: `isTopWindow` is DaggerfallRestWindow's own
   *  `uiManager.TopWindow != this` (TickRest :364/:399), handed down by
   *  the window because only the window knows which stack entry it is.
   *  An absent seam answers "I am the top", which is what a headless
   *  session and a host with no stack both mean. */
  constructor(mode, hours, deps, remainingHoursRented = -1, isTopWindow = null) {
    this.mode = mode;
    this.hoursRemaining = hours ?? 0;
    this.deps = deps;
    // S40: CanRest's out-parameter, carried into the session because
    // TickRest counts it DOWN (see checkRent below). -1 is DFU's "not
    // a rented room" sentinel and the reason a dungeon rest is not
    // billed by the hour.
    this.remainingHoursRented = remainingHoursRented;
    this.isTopWindow = isTopWindow;
    this.totalHours = 0;
    this._minutesOfHour = 0;
    this._timer = 0;
    this._abortEnemySpawn = false;   // B1: the OnEncounter latch, read at the next tick
    // waitTimePerHour / minutesPerTick, verbatim (NOT per-hour /
    // ticks-per-hour - see the header quirk note).
    this._subTickEvery = (mode === 'loiter' ? LOITER_WAIT_PER_HOUR : REST_WAIT_PER_HOUR) / MINUTES_PER_TICK;
    this._onlineSimMinutes = null;   // RESTX2: this session's own locally-ticked minute counter, online only - seeded from the shared clock at the first sub-tick (see tick() and the header)
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

  /**
   * ROAD-B B5 - THE PER-FRAME PREVENTED-REST POLL.
   *
   * TickRest reads GameManager.GetPreventedRestMessage TWICE per frame
   * (:357-360 before the clock moves at all, :407-410 after the hour's
   * enemy check) and ENDS THE REST the moment it answers non-null. The
   * port had the registry's shape - restDecision's third arm - but only
   * on the OPEN gate, so a condition registered while the player slept
   * (DFU's own doc: "prevents the player from starting OR CONTINUING to
   * rest", GameManager.cs:656-659) could never interrupt one. A quest
   * that forbade sleeping until a ritual finished stopped you lying
   * down and then let you sleep through it.
   *
   * The EMPTY STRING is the same law restDecision carries and it is
   * EndRest's, not the poll's (:465-478): a registered condition with
   * no wording is "" - the message box falls back to TEXT.RSC 355
   * rather than showing a blank one - and that is why `null` and `''`
   * cannot be folded together here either.
   *
   * The result is built by hand rather than through `_finish`, exactly
   * like the enemy break above it: EndRest's ladder puts enemyBrokeRest
   * FIRST and preventedRestMessage SECOND, both ABOVE the expired-room
   * arm (:461-486), so a prevented rest in a room that ran out this
   * same hour speaks the prevention, not the landlord.
   */
  _prevented() {
    const m = this.deps.preventedRestMessage?.();
    if (m === null || m === undefined) return null;
    return m === ''
      ? { textId: REST_TEXT.cannotRestNow, prevented: true, enemyBroke: false, died: false }
      : { textId: null, text: m, prevented: true, enemyBroke: false, died: false };
  }

  /** `uiManager.TopWindow != this` (:364, :399). See the ctor note:
   *  no seam means no stack above this window. */
  _covered() { return this.isTopWindow ? !this.isTopWindow() : false; }

  /** RESTX2: the frame's real seconds, banked for the timer in EVERY mode - see the header. RESTX1 skipped
   *  this under the shared clock (a free rest read no timer at all, a loiter read the world's clock); both
   *  are retired, so the one timer offline always used paces online too. */
  _accrue(dt) {
    this._timer += dt;
  }

  /** ONE sub-tick taken, if one is owed - and only then, so a rest the window covers mid-frame keeps what it still
   *  owes for the next frame, exactly as the timer always did. RESTX2: one law for every mode, online or off -
   *  the window's own timer (REST_WAIT_PER_HOUR / LOITER_WAIT_PER_HOUR real seconds a simulated hour). The old
   *  free-rest branch (the whole rest in one frame) and the old shared-clock branch (five real minutes a
   *  simulated hour, one sub-tick a frame) are both gone; a covered frame banks nothing, because `_accrue` is
   *  never reached under a cover, so a rest covered for a real hour by a quest box resolves no night when the
   *  cover lifts - the timer's own law, in every lane now. */
  _takeSubTick() {
    if (this._timer < this._subTickEvery) return false;
    this._timer -= this._subTickEvery;
    return true;
  }

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
      // PARTY-REST5 (2026-09-21, per-request: "when the initiator spawns mobs only he gets taken out of the rest
      // not the follower... the ones who not initiate need to also stop resting when an enemy appears for the
      // initiator"): an optional dep, called ONLY on a real enemy break, never on an ordinary wake/healed/cancel
      // finish - a follower's own mirror deps never supplies this hook, so nothing happens for the follower
      // locally; a host that DOES supply it (world.js's `outdoorRestDeps`/the interior and dungeon equivalents)
      // uses it to stamp a broadcast timestamp a follower's own mirror tick compares against (world.js's
      // `composePartyPose`/`partyRestFollowTick`), so the leader's real interrupt reaches every mirror of it too.
      this.deps.onEnemyBreak?.();
      return { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false };
    }

    // PARTY-REST19 (2026-09-22, per-request: "An non initiator MUST cancel the rest for all if he cancels
    // the ongoing resting"): an optional dep, checked every tick like the enemy-abort latch above, so it
    // takes effect the same frame a follower's own Stop click is pressed rather than waiting up to an hour.
    // `endEarly()` (not a raw textId object) reuses this session's own mode-aware choice of message - a
    // FullRest already healed still reports healed, a Loiter reports loiterDone, exactly as if THIS player
    // had pressed Stop themselves - only the fact that someone else's Stop caused it is invisible to the
    // message shown.
    if (this.deps.canceledByFollower?.()) return this.endEarly();

    // TickRest :357-360, and the ORDER is DFU's: the abort latch above
    // outranks the poll, and the poll outranks the top-window test
    // below - so a condition that lands while a message box covers the
    // rest still ends it on the frame the box is dismissed, and does it
    // BEFORE any world time passes.
    const preventedNow = this._prevented();
    if (preventedNow) return preventedNow;

    // :361-365. Redundant under the port's hosts in the same way it is
    // redundant in DFU - DaggerfallUI.cs:433 updates the TOP WINDOW and
    // nothing else, which is exactly what B1's hosts do - and kept for
    // the same reason DFU keeps it: it is the pair of the reachable one
    // below, and a host that ever ticks a covered window must not
    // advance its clock.
    if (this._covered()) return null;

    this._accrue(dt);
    while (this._takeSubTick()) {
      // RESTX2: every sub-tick spends `advanceMinutes` - the magic-round catch-up and the hourly
      // rest-interruption encounter roll both live inside it, so both run online as they always have offline.
      // The host's own clock write is refused online regardless (worldTick.setWorldMinutes), so the minutes the
      // roll and the catch-up READ online come from `_onlineSimMinutes` - local to this session, seeded from the
      // shared clock, ten a sub-tick, forgotten when the session ends - handed over as the sub-tick's END
      // (AUDIT WORLD5 C8's slot; null offline, where the host reads its own clock). Nothing here is visible to
      // another player or survives past this rest; it only has to look, from the inside, like an hour passed.
      const online = Number.isFinite(this.deps.sharedMinutes?.());
      if (online) {
        if (this._onlineSimMinutes == null) this._onlineSimMinutes = Math.floor(this.deps.sharedMinutes());
        this._onlineSimMinutes += MINUTES_PER_TICK;
        // MAC-LVL1 (2026-09-21, a player: "leveling doesn't work properly
        // online ... how online changes the passage of time"): the same
        // ten simulated minutes are CREDITED to the skill-check clock.
        // DFU's RaiseSkills is called by exactly two things - this rest
        // and fast travel - both of which have just raised world time,
        // so its 360-minute gate always opens after a night; online the
        // shared clock the gate reads moved 43 minutes in the 3.6 real
        // seconds an 8-hour rest takes, and the gate stayed shut.
        this.deps.creditSkillMinutes?.(MINUTES_PER_TICK);
      }
      this.deps.advanceMinutes(MINUTES_PER_TICK, online ? this._onlineSimMinutes : null);
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
      // RESTX2: NOT online - a quest clock is cross-player-visible state (deadlines, timers), unlike a
      // magic-round catch-up or an encounter roll, so it never ticks against a locally simulated minute.
      if (!online) this.deps.tickQuests?.();
      this._minutesOfHour += MINUTES_PER_TICK;
      if (this._minutesOfHour < 60) {
        // :381-385 returns false here, so DFU's frame is over either
        // way; the port's loop is what has to be told. A quest popup
        // the tick above pushed suspends the rest AT ONCE rather than
        // running the rest of this dt out underneath it.
        if (this._covered()) return null;
        continue;
      }
      this._minutesOfHour = 0;
      this.totalHours++;
      // TickRest :396-399 - the SECOND top-window test, and DFU's own
      // comment says why it exists: "Checking for second time as quest
      // tick above can perfectly align with rest ending". This is the
      // REACHABLE one, because the quest tick runs INSIDE the loop.
      // The quirk is exact and deliberate: totalHours has ALREADY been
      // counted (:394), so the covered hour reaches OnSleepEnd's
      // six-hour test while the sleeper gets no vitals and a timed rest
      // loses no hour off its counter.
      if (this._covered()) return null;
      // PARTY-REST5: see the doc comment on the abort-latch arm above - the same hook, the same law, the other
      // of the two places a real session's enemy break can be discovered.
      if (this.deps.enemiesNearby()) { this.deps.onEnemyBreak?.(); return { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false }; }
      // :405-410 - the poll AGAIN, after the enemies and before the
      // vitals, so a condition that turns on during the hour's own
      // quest ticks stops the healing rather than following it.
      const preventedHour = this._prevented();
      if (preventedHour) return preventedHour;
      // TickRest's own order (:348-438): the mode's completion is
      // decided FIRST and CheckRent runs after it, so a rest that
      // finishes on the very hour the room expires answers the
      // EXPIRED line - _finish is where that precedence lives.
      let done = null;
      if (this.mode === 'timed') {
        // AUDIT RESTX F1 is retired by RESTX2 (see the header): the free lane's full-health guard closed an
        // exploit whose precondition - an hour that costs no time - no longer holds in any lane, so DFU's
        // unconditional tally stands everywhere.
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
