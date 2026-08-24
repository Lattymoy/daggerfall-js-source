import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOLIDAYS, REGION_CELEBRATING_HOLIDAY, HOLIDAY_DAYS_OF_YEAR,
  HOLIDAY_SEARCH_LIMIT, HOLIDAY_LAST_DAY, MINUTES_PER_YEAR,
  getHolidayId, FREE_CURE_HOLIDAYS, HALF_PRICE_CURE_HOLIDAY,
  holidayDayOfYear, holidayRegion,
} from '../src/systems/holidays.js';
import { DAYS_PER_YEAR, MINUTES_PER_DAY } from '../src/systems/gameDate.js';

// S29 - FormulaHelper.GetHolidayId. The tables are DFU literals and
// the arithmetic is DFU's, quirks included.

const atDay = (day, region = 0) => getHolidayId((day - 1) * MINUTES_PER_DAY, region);

test('S29: both tables are 53 rows and the loop covers all of them', () => {
  assert.equal(REGION_CELEBRATING_HOLIDAY.length, 53);
  assert.equal(HOLIDAY_DAYS_OF_YEAR.length, 53);
  assert.equal(HOLIDAY_SEARCH_LIMIT, 53);
  // the enum has a 54th member with NO ROW - DFU marks it "Not used"
  assert.equal(HOLIDAYS.Old_Life_Festival, 54);
  assert.equal(HOLIDAYS.Saturalia, 53);
  // ...so it is unreachable from every day of every region
  let seen = new Set();
  for (let d = 1; d <= DAYS_PER_YEAR; d++) for (let r = 0; r < 62; r++) seen.add(atDay(d, r));
  assert.equal(seen.has(HOLIDAYS.Old_Life_Festival), false);
  assert.equal(seen.has(HOLIDAYS.Saturalia), true, 'the LAST row is reachable');
});

test('S29: 518400 is a year of minutes, and the day arithmetic truncates', () => {
  assert.equal(MINUTES_PER_YEAR, DAYS_PER_YEAR * MINUTES_PER_DAY);
  // every minute of day 1 answers New Life, and minute 1440 does not
  assert.equal(getHolidayId(0, 0), HOLIDAYS.New_Life);
  assert.equal(getHolidayId(1439, 0), HOLIDAYS.New_Life);
  assert.equal(getHolidayId(1440, 0), HOLIDAYS.None);
  // and it wraps at the year, so year 2 day 1 is New Life again
  assert.equal(getHolidayId(MINUTES_PER_YEAR, 0), HOLIDAYS.New_Life);
});

test('S29: the last five days of the year are never a holiday (:1837)', () => {
  assert.equal(HOLIDAY_LAST_DAY, 355);
  // the tables END at 355, so the gate is exactly inclusive
  assert.equal(Math.max(...HOLIDAY_DAYS_OF_YEAR), 355);
  for (let d = 356; d <= DAYS_PER_YEAR; d++) {
    for (let r = 0; r < 62; r++) assert.equal(atDay(d, r), HOLIDAYS.None, `day ${d}`);
  }
  // ...and day 355 IS one, in the one region that celebrates it
  assert.equal(REGION_CELEBRATING_HOLIDAY[52], 0x18);
  assert.equal(atDay(355, 0x18 - 1), HOLIDAYS.Saturalia);
  assert.equal(atDay(355, 0), HOLIDAYS.None, 'a region that does not celebrate it gets nothing');
});

test('S29: 0xFF means every region, anything else is regionIndex + 1', () => {
  // Scour_Day (id 2) is region 0x19 = 25, i.e. regionIndex 24
  assert.equal(REGION_CELEBRATING_HOLIDAY[1], 0x19);
  assert.equal(HOLIDAY_DAYS_OF_YEAR[1], 2);
  assert.equal(atDay(2, 24), HOLIDAYS.Scour_Day);
  assert.equal(atDay(2, 25), HOLIDAYS.None);
  assert.equal(atDay(2, 0), HOLIDAYS.None);
  // New Life (id 1) is 0xFF - everywhere
  assert.equal(REGION_CELEBRATING_HOLIDAY[0], 0xFF);
  for (const r of [0, 17, 44, 61]) assert.equal(atDay(1, r), HOLIDAYS.New_Life);
});

test('S29: the four holidays the temple cure window reads', () => {
  assert.deepEqual(FREE_CURE_HOLIDAYS, [4, 13, 21]);
  assert.deepEqual(FREE_CURE_HOLIDAYS,
    [HOLIDAYS.South_Winds_Prayer, HOLIDAYS.First_Harvest, HOLIDAYS.Second_Harvest]);
  assert.equal(HALF_PRICE_CURE_HOLIDAY, HOLIDAYS.North_Winds_Festival);
  // all four are 0xFF holidays, so free curing is not a regional perk
  for (const id of [...FREE_CURE_HOLIDAYS, HALF_PRICE_CURE_HOLIDAY]) {
    assert.equal(REGION_CELEBRATING_HOLIDAY[id - 1], 0xFF, `holiday ${id}`);
  }
  // and they land on the days the tables say
  assert.equal(atDay(HOLIDAY_DAYS_OF_YEAR[3], 0), HOLIDAYS.South_Winds_Prayer);
  assert.equal(atDay(HOLIDAY_DAYS_OF_YEAR[12], 0), HOLIDAYS.First_Harvest);
  assert.equal(atDay(HOLIDAY_DAYS_OF_YEAR[20], 0), HOLIDAYS.Second_Harvest);
  assert.equal(atDay(HOLIDAY_DAYS_OF_YEAR[49], 0), HOLIDAYS.North_Winds_Festival);
});

test('S29: a holiday id is its table row + 1, across the whole year', () => {
  // The ONE structural claim: every reachable id equals its row index
  // plus one, so a shifted table fails rather than silently renaming
  // every festival.
  for (let i = 0; i < HOLIDAY_SEARCH_LIMIT; i++) {
    const region = REGION_CELEBRATING_HOLIDAY[i];
    const r = region === 0xFF ? 0 : region - 1;
    const day = HOLIDAY_DAYS_OF_YEAR[i];
    if (day > HOLIDAY_LAST_DAY) continue;
    // an earlier row on the SAME day in the same region wins the loop
    const first = HOLIDAY_DAYS_OF_YEAR.findIndex((d, j) => d === day
      && (REGION_CELEBRATING_HOLIDAY[j] === 0xFF || REGION_CELEBRATING_HOLIDAY[j] === r + 1));
    assert.equal(atDay(day, r), first + 1, `row ${i} on day ${day}`);
  }
});

test('S29/U39: the tables are indexed by enum MINUS ONE, and the accessor says so', () => {
  // GetHolidayId loops its counter 0..52 over the tables and returns
  // that counter PLUS ONE as the enum value, so the enum and the row
  // are off by one. Reading a table with the enum value lands on the
  // NEXT holiday's row - a silently wrong answer, not an error. U39's
  // tavern tests made exactly that mistake, which is why the accessor
  // exists; this pins both halves of the offset.
  assert.equal(HOLIDAYS.New_Life, 1);
  assert.equal(holidayDayOfYear(HOLIDAYS.New_Life), 1, 'New Life is day ONE');
  assert.equal(HOLIDAY_DAYS_OF_YEAR[HOLIDAYS.New_Life], 2, 'and row 1 is the NEXT holiday - the trap');
  assert.equal(holidayDayOfYear(HOLIDAYS.Hearts_Day), 46);
  assert.equal(holidayRegion(HOLIDAYS.New_Life), 0xFF, 'everywhere');
  // the accessor answers null outside the enum rather than undefined
  assert.equal(holidayDayOfYear(0), null, 'None has no day');
  assert.equal(holidayDayOfYear(54), null, 'and neither has the unreachable 54th');
  assert.equal(holidayRegion(0), null);
  // and it agrees with the live lookup on every row
  for (let id = 1; id <= HOLIDAY_SEARCH_LIMIT; id++) {
    const day = holidayDayOfYear(id);
    const region = holidayRegion(id);
    if (region !== 0xFF) continue;                    // region-gated rows need their own region
    const minutes = (day - 1) * 1440 + 60;
    assert.equal(getHolidayId(minutes, 0), id, `holiday ${id} is found on its own day`);
  }
});
