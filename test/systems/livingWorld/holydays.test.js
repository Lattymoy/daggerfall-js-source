// HOLY-DAYS (2026-10-11, a profile of a player's live client entering the world: a 14.5 s and a 5.1 s frozen frame,
// ~10 s of them the Living World planning its roads' day; bible/07-Rendering/Performance-Priority.md HOLY-DAYS) - THE
// PILGRIMS' HOLY DAY, THE SAME ANSWER FOR LESS. Every pilgrim of every town the roads asked built its town's temples again
// (a filter and a sort of the towns near) and asked getHolidayId of every day of its cycle at every one of them - a
// day-of-year sum and 53 rows each. The temples are kept by the trip world and the town; the holy day is read a day at a
// time off the tables (holidays.js holidayOn, holidayKeptIn). Every answer is the old one: the old law is restated here and the
// two compared over every day of the year, every region and thousands of drawn cycles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHolidayId, holidayRegion, holidayOn, holidayKeptIn, HOLIDAY_DAYS_OF_YEAR, HOLIDAY_LAST_DAY, MINUTES_PER_YEAR } from '../../../src/systems/holidays.js';
import { holyDayOf } from '../../../src/systems/livingWorld/companies.js';
import { templesNear, TRIP_RANGE_PX } from '../../../src/systems/livingWorld/trips.js';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';

/** The law as it stood (companies.js before HOLY-DAYS): getHolidayId of each day at each temple, a regional answer wins. */
function holyDayOfAsItWas(temples, day0, days) {
  for (let d = day0 + 1; d < day0 + days - 1; d++) {
    for (const t of temples) {
      const id = getHolidayId(d * DAY_MIN + 12 * 60, t.region ?? -1);
      if (id && holidayRegion(id) !== 0xFF) return { town: t, day: d, id };
    }
  }
  return null;
}
/** mulberry32 */
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('HOLY-DAYS holidayOn and holidayKeptIn are getHolidayId on every day of the year in every region (and -1, a town with none) - every region\'s days and a region\'s own; no two rows share a day, every row\'s day inside the 355 gate (mutants: every region\'s day not kept, the region one off)', () => {
  assert.equal(new Set(HOLIDAY_DAYS_OF_YEAR).size, HOLIDAY_DAYS_OF_YEAR.length, 'one row a day');
  assert.ok(HOLIDAY_DAYS_OF_YEAR.every((d) => d >= 1 && d <= HOLIDAY_LAST_DAY));
  const wrong = [];
  let everyones = 0, own = 0;
  for (let doy = 1; doy <= MINUTES_PER_YEAR / DAY_MIN; doy++) {
    const row = holidayOn(doy);
    for (let region = -1; region <= 70; region++) {
      const want = getHolidayId((doy - 1) * DAY_MIN + 12 * 60, region);
      const got = row && holidayKeptIn(row, region) ? row.id : 0;
      if (got !== want) wrong.push(`day ${doy} region ${region}: ${got} != ${want}`);
      if (want && holidayRegion(want) === 0xFF) everyones++; else if (want) own++;
    }
  }
  assert.deepEqual(wrong, []);
  assert.ok(everyones > 300 && own > 30, `both kinds reached (${everyones} every region's, ${own} a region's own)`);
});

test('HOLY-DAYS holyDayOf answers as it did - the same town, day and id or none - over 4,000 drawn cycles of a pilgrim\'s length and shorter, across the year\'s turn, and over temple lists of every size with towns in no region (mutants: the region one off, a day nobody keeps ending the search)', () => {
  const r = rng(0x686f6c79);
  let hits = 0;
  for (let n = 0; n < 4000; n++) {
    const temples = Array.from({ length: Math.floor(r() * 7) }, (_, i) => ({ mapId: i, region: r() < 0.1 ? undefined : Math.floor(r() * 62) }));
    const day0 = Math.floor(r() * 360 * 4) - 30, days = 2 + Math.floor(r() * 30);
    const was = holyDayOfAsItWas(temples, day0, days), now = holyDayOf(temples, day0, days);
    assert.deepEqual(now, was, `temples ${JSON.stringify(temples)} from day ${day0} for ${days}`);
    if (was) hits++;
  }
  assert.ok(hits > 150, `holy days were found (${hits})`);
});

test('HOLY-DAYS templesNear is the old filter and sort - the temple towns in a pilgrim\'s ring, not its own, the nearer first then the lower id - asked of the world once a town and kept by the world (mutants: never kept, kept for the wrong town)', () => {
  const [rMin, rMax] = TRIP_RANGE_PX.pilgrim;
  const towns = [];
  for (let i = 0; i < 60; i++) towns.push({ mapId: 100 + i, px: 50 + ((i * 7) % 41) - 20, py: 50 + ((i * 13) % 37) - 18, temple: i % 3 === 0 });
  let asked = 0;
  const world = { townsNear: (px, py, r) => { asked++; return towns.filter((t) => Math.abs(t.px - px) <= r && Math.abs(t.py - py) <= r).sort((a, b) => a.mapId - b.mapId); }, templeTown: (t) => t.temple };
  const asItWas = (home) => {
    const dist = (t) => Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
    return world.townsNear(home.px ?? 0, home.py ?? 0, rMax)
      .filter((t) => t.mapId !== home.mapId && Math.max(Math.abs((t.px ?? 0) - (home.px ?? 0)), Math.abs((t.py ?? 0) - (home.py ?? 0))) >= rMin && !!world.templeTown?.(t))
      .sort((a, b) => dist(a) - dist(b) || a.mapId - b.mapId);
  };
  const homes = [towns[1], towns[2], towns[30]];
  const want = homes.map(asItWas);
  assert.ok(want.every((l) => l.length > 1), 'each home has temples in reach');
  asked = 0;
  for (let round = 0; round < 3; round++) homes.forEach((h, i) => assert.deepEqual(templesNear(h, world), want[i], `home ${h.mapId}`));
  assert.equal(asked, homes.length, 'the world asked once a town');
  const other = { ...world };
  asked = 0;
  assert.deepEqual(templesNear(homes[0], other), want[0]);
  assert.equal(asked, 1, 'another world asks for itself');
});
