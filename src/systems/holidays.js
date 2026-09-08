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

/** DFLocation.Holidays (:286-343). The value IS the id GetHolidayId
 *  returns; None = 0 means "not a holiday today". */
export const HOLIDAYS = Object.freeze({
  None: 0, New_Life: 1, Scour_Day: 2, Ovanka: 3, South_Winds_Prayer: 4,
  Day_of_Lights: 5, Waking_Day: 6, Mad_Pelagius: 7, Othroktide: 8,
  Day_of_Release: 9, Hearts_Day: 10, Perserverance_Day: 11, Aduros_Nau: 12,
  First_Harvest: 13, Day_of_Waiting: 14, Flower_Day: 15, Festival_of_Blades: 16,
  Gardtide: 17, Day_of_the_Dead: 18, Day_of_Shame: 19, Jesters_Day: 20,
  Second_Harvest: 21, Marukhs_Day: 22, Fire_Festival: 23, Fishing_Day: 24,
  Drigh_RZimb: 25, Mid_Year: 26, Dancing_Day: 27, Tibedetha: 28,
  Merchants_Festival: 29, Divad_Etept: 30, Suns_Rest: 31, Fiery_Night: 32,
  Maiden_Katrica: 33, Koomu_Alazeri: 34, Feast_of_the_Tiger: 35,
  Appreciation_Day: 36, Harvest_End: 37, Tales_and_Tallow: 38, Khurat: 39,
  Riglametha: 40, Childrens_Day: 41, Dirij_Tereur: 42, Witches_Festival: 43,
  Broken_Diamonds: 44, Emperors_Birthday: 45, Serpents_Dance: 46,
  Moon_Festival: 47, Hel_Anseilak: 48, Warriors_Festival: 49,
  North_Winds_Festival: 50, Baranth_Do: 51, Chila: 52, Saturalia: 53,
  Old_Life_Festival: 54,   // DFU: "Not used"
});

/** regionIndexCelebratingHoliday (:1823-1826). 0xFF = every region;
 *  otherwise a REGION ID, which is regionIndex + 1. */
export const REGION_CELEBRATING_HOLIDAY = Object.freeze([
  0xFF, 0x19, 0x01, 0xFF, 0x1D, 0x05, 0x19, 0x06, 0x3C, 0xFF, 0x29, 0x1A,
  0xFF, 0x02, 0x19, 0x01, 0x0E, 0x12, 0x14, 0xFF, 0xFF, 0x1C, 0x21, 0x1F, 0x2C, 0xFF, 0x12,
  0x23, 0xFF, 0x38, 0xFF, 0x01, 0x30, 0x29, 0x0B, 0x16, 0xFF, 0xFF, 0x11, 0x17, 0x14, 0x01,
  0xFF, 0x13, 0xFF, 0x33, 0x3C, 0x2E, 0xFF, 0xFF, 0x01, 0x2D, 0x18,
]);

/** holidayDaysOfYear (:1830-1833), 1-based days. */
export const HOLIDAY_DAYS_OF_YEAR = Object.freeze([
  0x01, 0x02, 0x0C, 0x0F, 0x10, 0x12, 0x20, 0x23, 0x26, 0x2E, 0x39, 0x3A,
  0x43, 0x45, 0x55, 0x56, 0x5B, 0x67, 0x6E, 0x76, 0x7F, 0x81, 0x8C, 0x96, 0x97, 0xA6, 0xAD,
  0xAE, 0xBE, 0xC0, 0xC8, 0xD1, 0xD4, 0xDD, 0xE0, 0xE7, 0xED, 0xF3, 0xF6, 0xFC, 0x103, 0x113,
  0x11B, 0x125, 0x12C, 0x12F, 0x134, 0x13E, 0x140, 0x159, 0x15C, 0x162, 0x163,
]);

/** THE INDEX TRAP, closed. Both tables are indexed by `holidayID`
 *  as GetHolidayId's LOOP COUNTER runs it - 0..52 - and the enum
 *  value it returns is that index PLUS ONE. So the day of
 *  HOLIDAYS.Hearts_Day (10) is row 9, not row 10; reading the table
 *  with the enum value directly is off by one and lands on the NEXT
 *  holiday's day, which is a silent wrong answer rather than an
 *  error. U39 made exactly that mistake writing the tavern's tests,
 *  so the accessor exists to make it unavailable. */
export const holidayDayOfYear = (holidayId) =>
  (holidayId >= 1 && holidayId <= HOLIDAY_DAYS_OF_YEAR.length
    ? HOLIDAY_DAYS_OF_YEAR[holidayId - 1] : null);

/** The region that celebrates it, same offset (0xFF = everywhere). */
export const holidayRegion = (holidayId) =>
  (holidayId >= 1 && holidayId <= REGION_CELEBRATING_HOLIDAY.length
    ? REGION_CELEBRATING_HOLIDAY[holidayId - 1] : null);

/** The `while (holidayID < 53)` bound. Both tables are exactly 53
 *  rows, so this covers all of them; the enum's 54th member has no row
 *  and cannot be returned. */
export const HOLIDAY_SEARCH_LIMIT = 53;
/** `if (dayOfYear <= 355)` - the last five days of the year are never
 *  a holiday. */
export const HOLIDAY_LAST_DAY = 355;
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
