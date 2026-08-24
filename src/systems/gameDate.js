// S28: THE CALENDAR. 1:1 from Daggerfall Unity's
// Utility/DaggerfallDateTime.cs (MIT, Daggerfall Workshop / Gavin
// Clayton). Daggerfall's calendar is fixed 30-day months, twelve of
// them, so every date is exact integer arithmetic with no leap rules.
//
// WHY IT LANDED HERE. The port has had a clock since the beginning -
// worldTick's classicMinutes - but no DATE, and a surprising number of
// laws are written in days rather than minutes: the guild rank gate is
// 28 DAYS between changes (Guild.cs UpdateRank), shop opening hours
// are a clock hour, the magic-item stock rotates on a day seed, quest
// timers are due-dates. U23 wired the guild service popup and its
// OnPush calls UpdateRank, which needs { year, dayOfYear }; inventing
// one would have made the 28-day gate fiction, so the calendar is
// ported instead.
//
// THE EPOCH IS NOT ZERO. classicEpochInSeconds (:28) converts between
// DFU's own year-zero seconds and the minute counter classic saves
// keep, and classicGameStartTime (:29) is the start of a new game -
// 13:30 on the 4th of Morning Star, 3E405 (:489). The port's
// classicMinutes counts from that start, so a live date is
// dateFromClassicMinutes(classicGameStartTime + elapsed).
//
// FLAGGED, deliberately: the two LUNAR PHASE getters (:134-150,
// GetLunarPhase) are not here - nothing in the port reads a moon yet,
// and DFU's own comment says the logic mirrors the Enhanced Sky mod
// rather than classic. RaiseTime's carry chain is not ported either:
// this module is pure functions over an absolute minute count, so
// there is no mutable clock object to carry.

export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;   // 360

/** :28-29. The epoch conversion and the new-game start, verbatim. */
export const CLASSIC_EPOCH_IN_SECONDS = 12566016000;
export const CLASSIC_GAME_START_TIME = 523530;

/** The class's own field defaults (:57-62) - what a DaggerfallDateTime
 *  holds before anything sets it. Kept because SetClassicGameStartTime
 *  is what a new game actually calls, and the two disagree. */
export const DEFAULT_DATE = Object.freeze({ year: 405, month: 5, day: 0, hour: 12, minute: 0 });

/** The four enums (:223-279), in DFU's declaration order - the value
 *  IS the index, which is what DayValue/MonthValue/BirthSignValue
 *  cast to. Names come from DFU's Internal_Strings lists
 *  ("dayNames", "monthNames", "birthSignNames", "seasonNames"). */
export const DAY_NAMES = Object.freeze(['Sundas', 'Morndas', 'Tirdas', 'Middas', 'Turdas', 'Fredas', 'Loredas']);
export const MONTH_NAMES = Object.freeze(["Morning Star", "Sun's Dawn", 'First Seed', "Rain's Hand",
  'Second Seed', 'Midyear', "Sun's Height", 'Last Seed', 'Hearthfire', 'Frostfall', "Sun's Dusk", 'Evening Star']);
export const BIRTH_SIGN_NAMES = Object.freeze(['The Ritual', 'The Lover', 'The Lord', 'The Mage',
  'The Shadow', 'The Steed', 'The Apprentice', 'The Warrior', 'The Lady', 'The Tower', 'The Atronach', 'The Thief']);
export const SEASON_NAMES = Object.freeze(['Fall', 'Spring', 'Summer', 'Winter']);
export const SEASONS = Object.freeze({ Fall: 0, Spring: 1, Summer: 2, Winter: 3 });

/** ToSeconds (:430-441). Year/month/day are counted from ZERO, and
 *  the month term is SecondsPerMonth * Month - i.e. months are the
 *  same fixed 30 days as everywhere else. */
export function dateToSeconds({ year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0 }) {
  return year * (DAYS_PER_YEAR * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE)
    + month * (DAYS_PER_MONTH * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE)
    + day * (HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE)
    + hour * (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)
    + minute * SECONDS_PER_MINUTE
    + Math.trunc(second);
}

/** FromSeconds (:446-470). DFU walks the years and months off with two
 *  while loops; the division is the same answer and does not spin on a
 *  large epoch. Day is the day OF THE MONTH counted from 0. */
export function dateFromSeconds(time) {
  const secondsPerDay = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
  const dayclock = time % secondsPerDay;
  let dayno = Math.floor(time / secondsPerDay);
  const second = dayclock % SECONDS_PER_MINUTE;
  const minute = Math.floor((dayclock % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) / SECONDS_PER_MINUTE);
  const hour = Math.floor(dayclock / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE));
  const year = Math.floor(dayno / DAYS_PER_YEAR);
  dayno -= year * DAYS_PER_YEAR;
  const month = Math.floor(dayno / DAYS_PER_MONTH);
  const day = dayno - month * DAYS_PER_MONTH;
  return { year, month, day, hour, minute, second };
}

/** ToClassicDaggerfallTime (:475-478) / FromClassicDaggerfallTime
 *  (:483-486) - the minute counter classic saves keep. */
export const dateToClassicMinutes = (date) =>
  Math.floor((dateToSeconds(date) - CLASSIC_EPOCH_IN_SECONDS) / SECONDS_PER_MINUTE);
export const dateFromClassicMinutes = (minutes) =>
  dateFromSeconds(CLASSIC_EPOCH_IN_SECONDS + minutes * SECONDS_PER_MINUTE);

/** SetClassicGameStartTime (:491-494): 13:30 4th Morning Star 3E405. */
export const classicGameStartDate = () => dateFromClassicMinutes(CLASSIC_GAME_START_TIME);


// RETIRED AT THE AUDIT 22 MERGE. S28 shipped
// classicMinutesFromElapsed/dateFromElapsedMinutes because the port's
// hosts each counted ELAPSED minutes from zero, so the epoch had to be
// added back on every read. AUDIT 21 F2 (main) made the world clock a
// single absolute counter that STARTS at CLASSIC_GAME_START_TIME -
// worldTick.worldMinutes() is already a classic minute count - so
// adding the epoch again would land the calendar 363 days out. The
// bridge is gone rather than deprecated: a helper that double-counts
// is worse than no helper. Read a date with
// dateFromClassicMinutes(worldMinutes()).

/** GetDayOfYear (:629-633): `(Month * DaysPerMonth) + (Day + 1)`, so it
 *  is 1-based and the first day of the year is 1. Guild.cs's
 *  CalculateDaySinceZero reads exactly this. */
export const dayOfYear = (date) => (date.month * DAYS_PER_MONTH) + (date.day + 1);
/** The SAME day of year, read off a raw CLASSIC-MINUTES counter
 *  instead of a date record - the arithmetic GetHolidayId does inline
 *  (`(gameMinutes % minutesPerYear) / 1440 + 1`). It lives here rather
 *  than in each caller because two modules deriving a day of year two
 *  ways is how a room's Heart's Day and a meal's holiday end up
 *  disagreeing about what day it is. */
export const dayOfYearFromMinutes = (gameMinutes) =>
  Math.floor((gameMinutes % (DAYS_PER_YEAR * MINUTES_PER_DAY)) / MINUTES_PER_DAY) + 1;
/** GetMonthOfYear (:635-639) and GetDayOfMonth (:623-627): both 1-based. */
export const monthOfYear = (date) => date.month + 1;
export const dayOfMonth = (date) => date.day + 1;
/** GetMinuteOfDay (:618-622). */
export const minuteOfDay = (date) => (date.hour * MINUTES_PER_HOUR) + date.minute;

/** GetDayName (:550-559). The week is the day's position WITHIN its
 *  week, and since 30 divides evenly by neither 7 nor anything useful,
 *  DFU simply takes day mod 7 - written there as day - week*7. */
export const dayName = (date) => DAY_NAMES[date.day - Math.floor(date.day / DAYS_PER_WEEK) * DAYS_PER_WEEK];
export const monthName = (date) => MONTH_NAMES[date.month];
export const birthSignName = (date) => BIRTH_SIGN_NAMES[date.month];

/** GetSeasonValue (:577-607). DFU's own comment admits the boundary is
 *  approximate: "Daggerfall seems to roll over seasons part way
 *  through final month. Using clean month boundaries here for
 *  simplicity." Kept verbatim, quirk included - the port must not be
 *  more accurate than the thing it is a port of. */
export function seasonValue(date) {
  const m = date.month;
  if (m === 11 || m === 0 || m === 1) return SEASONS.Winter;
  if (m === 2 || m === 3 || m === 4) return SEASONS.Spring;
  if (m === 5 || m === 6 || m === 7) return SEASONS.Summer;
  if (m === 8 || m === 9 || m === 10) return SEASONS.Fall;
  return SEASONS.Summer;   // DFU's `default:`
}
export const seasonName = (date) => SEASON_NAMES[seasonValue(date)];

/** DateString (DaggerfallDateTime.cs:417-422) over the en table's
 *  dateFormatString '{0} the {1}{2} of {3:00}' - DayName, the day, its
 *  ordinal suffix, MonthName. The {3:00} spec lands on the STRING
 *  MonthName and string.Format drops it, exactly as it does in
 *  DateTimeString below. There is NO year in this one.
 *  AUDIT 24 systems: the port had invented "Loredas, 4 Morning Star,
 *  3E 405" where DFU renders "Loredas the 4th of Morning Star" - and
 *  every %dat, %qdt and %qdat macro reads this. */
export const dateString = (date) =>
  `${dayName(date)} the ${dayOfMonth(date)}${daySuffix(dayOfMonth(date))} of ${monthName(date)}`;

/** GetSuffix (:641-652): st on 1/21, nd on 2/22, rd on 3/23, else th
 *  (a 30-day month never reaches 31, so DFU never wrote that arm). */
export function daySuffix(dayOfMonth1) {
  if (dayOfMonth1 === 1 || dayOfMonth1 === 21) return 'st';
  if (dayOfMonth1 === 2 || dayOfMonth1 === 22) return 'nd';
  if (dayOfMonth1 === 3 || dayOfMonth1 === 23) return 'rd';
  return 'th';
}
/** AUDIT 24 (wave 22): the `{0:00}` in every one of these format
 *  strings. .NET's custom numeric format ROUNDS (away from zero) - it
 *  does not truncate - and DaggerfallDateTime.Second is a `float`
 *  (:63), not an int. So at 59.5 seconds DFU really does print
 *  `13:29:60`, and the port's Math.floor quietly corrected it to
 *  `:59`. Hour, Minute and the day are ints on both sides, where
 *  rounding and flooring are the same thing. Math.round is half-UP
 *  where .NET's is half-AWAY-FROM-ZERO; a clock component is never
 *  negative, so the two agree everywhere this is reachable. */
const pad2 = (n) => String(Math.round(n)).padStart(2, '0');
/** DateTimeString (:409-414) over the en table's dateTimeFormatString
 *  '{0:00}:{1:00}:{2:00} on {3}{4} of {5:00}, 3E{6}'. QUIRK KEPT: the
 *  {5:00} spec lands on the STRING MonthName - System.String is not
 *  IFormattable, string.Format drops the spec and the name prints
 *  plainly - and the day ({3}) is UNPADDED here. The notebook's D:
 *  note headers read this shape (Q4-v). */
export const dateTimeString = (d) =>
  `${pad2(d.hour)}:${pad2(d.minute)}:${pad2(d.second)} on ${d.day + 1}${daySuffix(d.day + 1)} of ${monthName(d)}, 3E${d.year}`;
/** MidDateTimeString (:390-394) over midDateTimeFormatString
 *  '{0:00}:{1:00}:{2:00} {3:00} {4:00} 3E{5}' - HERE the day IS padded
 *  ({3:00} lands on the int) and the month-name spec drops again. The
 *  notebook's finished-quest headers read this shape (Q4-v). */
export const midDateTimeString = (d) =>
  `${pad2(d.hour)}:${pad2(d.minute)}:${pad2(d.second)} ${pad2(d.day + 1)} ${monthName(d)} 3E${d.year}`;
