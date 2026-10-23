// S29: HOLIDAYS. 1:1 from FormulaHelper.GetHolidayId (:1819-1852) and
// DFLocation.Holidays (:286-343), MIT Daggerfall Workshop.
//
// It landed with U24's temple cure-disease window, which is the port's
// first reader: three holidays cure disease FREE and a fourth halves
// the price, so without this the temple charges full price on days
// classic does not. The tables are also what a festival, a tavern
// crowd or a quest date would read next.
//
// ── the two tables ────────────────────────────────────────────────
// Both are indexed by HOLIDAY ID MINUS ONE - GetHolidayId returns
// `holidayID + 1`, so the enum's None = 0 is not a row. The first
// gives which REGION celebrates each (0xFF = everywhere, otherwise a
// region id, compared against regionIndex + 1); the second gives the
// day of the year, 1-based.
//
// ── the two quirks, both kept ─────────────────────────────────────
// - `dayOfYear = gameMinutes % 518400 / 1440 + 1` computes the day
//   from the RAW MINUTE COUNT with C# integer division, and 518400 is
//   360 * 1440 - a whole year of minutes. This is the same day number
//   gameDate.dayOfYear derives, by a different road. U39 needed the
//   MINUTE road from a second module (the tavern's Heart's Day span
//   has to agree with the meal's holiday about what day it is), so the
//   line now lives in gameDate as dayOfYearFromMinutes and is called
//   from here - the arithmetic is unchanged, it just has one home.
// - `if (dayOfYear <= 355)` means THE LAST FIVE DAYS OF THE YEAR ARE
//   NEVER A HOLIDAY. The tables end at day 355 (0x163, Saturalia), so
//   the gate is exactly inclusive of the last row and days 356-360
//   are simply empty.
// - Both tables are 53 rows and the loop bound is `< 53`, so every row
//   is reachable and holiday ids run 1..53. The enum's 54th member,
//   Old_Life_Festival, has NO ROW - which is what DFU's own "// Not
//   used" comment means. It is kept in the enum and unreachable here.

import { dayOfYearFromMinutes } from './gameDate.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';   // AUDIT 64 F10: DFRegion.LocationTypes, for the town arm's filter

import { HOLIDAYS, REGION_CELEBRATING_HOLIDAY, HOLIDAY_DAYS_OF_YEAR, HOLIDAY_SEARCH_LIMIT, HOLIDAY_LAST_DAY } from './holidayTables.js';   // WITCH1: the tables' leaf

// WITCH1: the tables live in holidayTables.js (a leaf the account service can load); every name stays readable here
export { HOLIDAYS, REGION_CELEBRATING_HOLIDAY, HOLIDAY_DAYS_OF_YEAR, holidayDayOfYear, holidayRegion, HOLIDAY_SEARCH_LIMIT, HOLIDAY_LAST_DAY } from './holidayTables.js';

/** 360 * 1440: a whole year of minutes. */
export const MINUTES_PER_YEAR = 518400;

/** GetHolidayId (:1819-1852), verbatim - including the truncating day
 *  arithmetic and the 355 gate. `gameMinutes` is CLASSIC minutes (the
 *  same counter gameDate.dateToClassicMinutes produces). */
export function getHolidayId(gameMinutes, regionIndex) {
  const dayOfYear = dayOfYearFromMinutes(gameMinutes);
  if (dayOfYear > HOLIDAY_LAST_DAY) return HOLIDAYS.None;
  for (let holidayID = 0; holidayID < HOLIDAY_SEARCH_LIMIT; holidayID++) {
    const region = REGION_CELEBRATING_HOLIDAY[holidayID];
    if ((region === 0xFF || region === regionIndex + 1)
      && dayOfYear === HOLIDAY_DAYS_OF_YEAR[holidayID]) {
      return holidayID + 1;
    }
  }
  return HOLIDAYS.None;
}

/** HOLY-DAYS (2026-10-11, a profile of a player's live client entering the world: the Living World's pilgrims asked
 *  getHolidayId of every day of their cycle at every temple near - a day-of-year sum and the 53 rows each - ~2 s of a
 *  single frozen frame). THE HOLIDAY ROW ON A DAY OF THE YEAR - `{ id, region }` (the id GetHolidayId returns, the region
 *  id that keeps it, 0xFF every region) - or null. Each day of the table is one row's (no two rows share a day, every one
 *  inside HOLIDAY_LAST_DAY), so GetHolidayId on a day is this row where `holidayKeptIn` says so, else None. Read off the
 *  tables once. */
let _holidayByDay = null;
export function holidayOn(dayOfYear) {
  if (!_holidayByDay) {
    _holidayByDay = new Map();
    for (let i = 0; i < HOLIDAY_SEARCH_LIMIT; i++) _holidayByDay.set(HOLIDAY_DAYS_OF_YEAR[i], Object.freeze({ id: i + 1, region: REGION_CELEBRATING_HOLIDAY[i] }));
  }
  return _holidayByDay.get(dayOfYear) ?? null;
}
/** HOLY-DAYS: GetHolidayId's own test of a row (:1844) - kept everywhere, or in this region (a region ID is the index
 *  plus one). */
export const holidayKeptIn = (row, regionIndex) => row.region === 0xFF || row.region === regionIndex + 1;

/** The three holidays a temple cures disease FREE on, and the one that
 *  halves the price (DaggerfallGuildServiceCureDisease :60-88). */
export const FREE_CURE_HOLIDAYS = Object.freeze([
  HOLIDAYS.South_Winds_Prayer, HOLIDAYS.First_Harvest, HOLIDAYS.Second_Harvest,
]);
export const HALF_PRICE_CURE_HOLIDAY = HOLIDAYS.North_Winds_Festival;

// ── AUDIT 64 F10: the ANNOUNCEMENT ────────────────────────────────
// PlayerEnterExit.ShowHolidayText (:565-585) is the sixth reader of
// GetHolidayId and the only one that is not a price or a lock: walking
// into a town on one of the 53 holiday days pops a click-anywhere
// parchment carrying TEXT.RSC record 8349 + holidayId. It is not fired
// on the entry frame - PlayerEnterExit keeps three fields (:78-80) and
// a three-part lifecycle: the PRIME on the town arm of
// PlayerGPS_OnEnterLocationRect (:1404-1409), the DRAIN in Update
// (:355-368), and the ten-second re-arm at ShowHolidayText's tail
// (:584). The id arithmetic and the state machine live here; the box
// itself belongs to the host, like the module's five other readers.

/** `const int holidaysStartID = 8349` (PlayerEnterExit.cs:567). */
export const HOLIDAYS_START_ID = 8349;

/** ShowHolidayText's record id (PlayerEnterExit.cs:569-575):
 *  8349 + GetHolidayId(classic minutes, PlayerGPS.CurrentRegionIndex),
 *  or 0 for "no box" - the `if (holidayId != 0)` gate at :572. */
export function holidayTextId(gameMinutes, regionIndex) {
  const id = getHolidayId(gameMinutes, regionIndex);
  return id === HOLIDAYS.None ? 0 : HOLIDAYS_START_ID + id;
}

/** The location types whose rect entry primes NOTHING. DFU's handler
 *  splits three ways under `if (playerGPS && !isPlayerInside)`
 *  (PlayerEnterExit.cs:1362): the dungeon/graveyard arm (:1364-1367 -
 *  DungeonLabyrinth, DungeonKeep, DungeonRuin, Graveyard) prints two
 *  flavour lines and primes nothing, the town arm (:1382-1383,
 *  `else if (LocationType != Coven && != HomeYourShips)`) is the only
 *  one that primes, and Coven/HomeYourShips fall out of both. */
export const HOLIDAY_TEXT_SILENT_LOCATION_TYPES = Object.freeze([
  LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep,
  LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard,
  LOCATION_TYPES.Coven, LOCATION_TYPES.HomeYourShips,
]);

/** True when a rect entry of this location type takes DFU's TOWN arm,
 *  the only one that primes the holiday text. */
export function holidayTextPrimesFor(locationType) {
  return !HOLIDAY_TEXT_SILENT_LOCATION_TYPES.includes(locationType);
}

/** `holidayTextTimer = 2.5f` (:1406) - "short delay to give save game
 *  fade-in time to finish". */
export const HOLIDAY_TEXT_PRIME_DELAY = 2.5;
/** `holidayTextTimer = 10f` (:584), set whether or not a box was shown
 *  so a player bouncing across the city border does not re-run the
 *  check every frame. */
export const HOLIDAY_TEXT_REARM = 10;

/** PlayerEnterExit's holiday-text fields (:78-80) and their lifecycle.
 *  `location` stands for holidayTextLocation, DFU's
 *  StreamingWorld.CurrentPlayerLocationObject reference - compared by
 *  IDENTITY at :355, so the host hands in its own location object. */
export class HolidayTextTimer {
  constructor() {
    this.location = null;
    this.primed = false;
    this.timer = 0;
  }

  /** The town arm's prime (PlayerEnterExit.cs:1404-1409). The
   *  `!isPlayerInside` guard (:1362) and the location-type filter
   *  (holidayTextPrimesFor) are the caller's, exactly as DFU's are the
   *  handler's. */
  enterLocationRect(location) {
    if (this.timer <= 0 && !this.primed) {
      this.timer = HOLIDAY_TEXT_PRIME_DELAY;
      this.primed = true;
    }
    this.location = location;
  }

  /** PlayerEnterExit.Update's drain (:355-368). `currentLocation()` is
   *  StreamingWorld.CurrentPlayerLocationObject, `onHUD()` is
   *  GameManager.IsPlayerOnHUD (:400-403) - with a window on top the
   *  fire is DEFERRED, not dropped: the timer stays at or below zero
   *  and primed stays true. */
  update(dt, deps) {
    if (this.primed && this.location !== deps.currentLocation()) {
      this.timer = 0;
      this.primed = false;
    }
    if (this.timer > 0) this.timer -= dt;
    if (this.timer <= 0 && this.primed && deps.onHUD()) {
      this.primed = false;
      this.show(deps);
    }
  }

  /** ShowHolidayText (:565-585). `showRecord(id)` is the host's
   *  DaggerfallMessageBox door - SetTextTokens(int) with
   *  ClickAnywhereToClose and no screen dim (:573-579). The re-arm at
   *  :584 sits OUTSIDE the `if (holidayId != 0)` block, so a
   *  non-holiday entry blocks re-evaluation for the same ten seconds. */
  show(deps) {
    const textId = holidayTextId(deps.gameMinutes(), deps.regionIndex());
    if (textId !== 0) deps.showRecord(textId);
    this.timer = HOLIDAY_TEXT_REARM;
  }
}
