import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAYS_PER_MONTH, MONTHS_PER_YEAR, DAYS_PER_YEAR, MINUTES_PER_DAY,
  CLASSIC_EPOCH_IN_SECONDS, CLASSIC_GAME_START_TIME, DEFAULT_DATE,
  DAY_NAMES, MONTH_NAMES, BIRTH_SIGN_NAMES, SEASON_NAMES, SEASONS,
  dateToSeconds, dateFromSeconds, dateToClassicMinutes, dateFromClassicMinutes,
  classicGameStartDate, dateFromElapsedMinutes,
  dayOfYear, monthOfYear, dayOfMonth, minuteOfDay,
  dayName, monthName, birthSignName, seasonValue, seasonName, dateString,
} from '../src/systems/gameDate.js';
import { daySinceZero, DAYS_BETWEEN_RANK_CHANGES } from '../src/systems/guilds.js';

// S28 - DaggerfallDateTime.cs. Every pin here is against a DFU literal
// or a statement DFU makes in its own source comments, never against
// another expression of the port's.

test('S28: the calendar constants are DFU\'s (:31-40)', () => {
  assert.equal(DAYS_PER_MONTH, 30);
  assert.equal(MONTHS_PER_YEAR, 12);
  assert.equal(DAYS_PER_YEAR, 360);
  assert.equal(MINUTES_PER_DAY, 1440);
  assert.equal(CLASSIC_EPOCH_IN_SECONDS, 12566016000);
  assert.equal(CLASSIC_GAME_START_TIME, 523530);
});

test('S28: SetClassicGameStartTime is 13:30 4th Morning Star 3E405 - DFU says so at :489', () => {
  const d = classicGameStartDate();
  // DFU's own docstring for the method it is derived from. Month and
  // Day are ZERO-based fields; the 1-based readers are checked below.
  assert.deepEqual(d, { year: 405, month: 0, day: 3, hour: 13, minute: 30, second: 0 });
  assert.equal(dayOfMonth(d), 4);
  assert.equal(monthOfYear(d), 1);
  assert.equal(monthName(d), 'Morning Star');
  assert.equal(minuteOfDay(d), 13 * 60 + 30);
  assert.equal(dateString(d), 'Middas, 4 Morning Star, 3E 405');
});

test('S28: the class field defaults (:57-62) are NOT the game start', () => {
  // Both exist in DFU and they disagree; keeping only one would lose a
  // real distinction (a fresh DaggerfallDateTime vs a new game).
  assert.deepEqual(DEFAULT_DATE, { year: 405, month: 5, day: 0, hour: 12, minute: 0 });
  assert.notDeepEqual({ ...DEFAULT_DATE, second: 0 }, classicGameStartDate());
});

test('S28: ToSeconds/FromSeconds and the classic-minute pair round-trip', () => {
  for (const m of [0, 1, 59, 60, 1439, 1440, 523530, 523530 + 360 * 1440, 9999999]) {
    assert.equal(dateToClassicMinutes(dateFromClassicMinutes(m)), m, `minute ${m}`);
  }
  for (const d of [{ year: 405, month: 0, day: 3, hour: 13, minute: 30, second: 0 },
    { year: 411, month: 11, day: 29, hour: 23, minute: 59, second: 0 }]) {
    assert.deepEqual(dateFromSeconds(dateToSeconds(d)), d);
  }
});

test('S28: GetDayOfYear is 1-based and spans exactly the year (:629-633)', () => {
  assert.equal(dayOfYear({ year: 405, month: 0, day: 0 }), 1);
  assert.equal(dayOfYear({ year: 405, month: 11, day: 29 }), 360);
  // every (month, day) maps to a distinct day, 1..360, with no gaps
  const seen = new Set();
  for (let mo = 0; mo < 12; mo++) for (let da = 0; da < 30; da++) seen.add(dayOfYear({ month: mo, day: da }));
  assert.equal(seen.size, 360);
  assert.equal(Math.min(...seen), 1);
  assert.equal(Math.max(...seen), 360);
});

test('S28: GetDayName cycles every 7 days of the month (:550-559)', () => {
  assert.deepEqual(DAY_NAMES, ['Sundas', 'Morndas', 'Tirdas', 'Middas', 'Turdas', 'Fredas', 'Loredas']);
  assert.equal(dayName({ day: 0 }), 'Sundas');
  assert.equal(dayName({ day: 6 }), 'Loredas');
  assert.equal(dayName({ day: 7 }), 'Sundas');
  assert.equal(dayName({ day: 29 }), 'Morndas');   // 29 - 28 = 1
});

test('S28: the four name lists are DFU\'s Internal_Strings, verbatim', () => {
  assert.deepEqual(MONTH_NAMES, ["Morning Star", "Sun's Dawn", 'First Seed', "Rain's Hand",
    'Second Seed', 'Midyear', "Sun's Height", 'Last Seed', 'Hearthfire', 'Frostfall',
    "Sun's Dusk", 'Evening Star']);
  assert.deepEqual(BIRTH_SIGN_NAMES, ['The Ritual', 'The Lover', 'The Lord', 'The Mage',
    'The Shadow', 'The Steed', 'The Apprentice', 'The Warrior', 'The Lady', 'The Tower',
    'The Atronach', 'The Thief']);
  assert.deepEqual(SEASON_NAMES, ['Fall', 'Spring', 'Summer', 'Winter']);
  // the birth sign of a month IS its index (BirthSignValue casts Month)
  assert.equal(birthSignName({ month: 0 }), 'The Ritual');
  assert.equal(birthSignName({ month: 11 }), 'The Thief');
});

test('S28: GetSeasonValue keeps DFU\'s clean-month-boundary quirk (:577-607)', () => {
  // DFU: "Daggerfall seems to roll over seasons part way through final
  // month. Using clean month boundaries here for simplicity." The
  // table below is that simplification, month by month.
  const want = [SEASONS.Winter, SEASONS.Winter, SEASONS.Spring, SEASONS.Spring, SEASONS.Spring,
    SEASONS.Summer, SEASONS.Summer, SEASONS.Summer, SEASONS.Fall, SEASONS.Fall,
    SEASONS.Fall, SEASONS.Winter];
  assert.deepEqual([...Array(12).keys()].map((m) => seasonValue({ month: m })), want);
  assert.equal(seasonName({ month: 0 }), 'Winter');
  assert.equal(SEASONS.Fall, 0);   // the enum is ordered Fall,Spring,Summer,Winter (:270-276)
});

test('S28: the guild 28-day gate now has a clock that reaches it', () => {
  // The whole reason the calendar landed: daySinceZero over the port's
  // elapsed-minute counter must move exactly one per game day, so 28
  // days of play crosses DAYS_BETWEEN_RANK_CHANGES and 27 does not.
  const start = daySinceZero(dateFromElapsedMinutes(0));
  assert.equal(daySinceZero(dateFromElapsedMinutes(27 * MINUTES_PER_DAY)) - start, 27);
  assert.equal(daySinceZero(dateFromElapsedMinutes(28 * MINUTES_PER_DAY)) - start, 28);
  assert.ok(27 < DAYS_BETWEEN_RANK_CHANGES && DAYS_BETWEEN_RANK_CHANGES <= 28);
  // and it survives a year boundary, which is what an absolute day
  // number is for
  const eve = dateFromElapsedMinutes(0);
  const nextYear = dateFromElapsedMinutes(DAYS_PER_YEAR * MINUTES_PER_DAY);
  assert.equal(nextYear.year, eve.year + 1);
  assert.equal(daySinceZero(nextYear) - daySinceZero(eve), DAYS_PER_YEAR);
});
