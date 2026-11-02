// SEASON1 part one (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE SEASONS' LAW - the calendar from the
// week Season 0 begins (four weeks, then eight), the names, the week a Season ends, the once-a-Season floor, a Pact to
// its Season's end, the soft reset's Standing, the Season's titles, a Charter title's Season, the Chronicle's line and
// the Seat tab's (bible/11-Multiplayer/Seats-Arc.md 9.1, 18). Pure: src/net/townSeatLaw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEASON_ZERO_WEEKS, SEASON_WEEKS, SEASON_MONTHS, seasonZeroOf, seasonOf, seatSeasonName, seasonEndingAt, seasonFloor, seasonStanding, seasonTitles,
  seasonLine, pactUntil, seatTitleOf, seatTitleText, chronicleLine, SIEGE_PAIR_WEEKS, STANDING_START,
} from '../../src/net/townSeatLaw.js';

const Z = 100;

test('SEASON1 THE CALENDAR (9.1, 18): Season 0 the four weeks from the configured week, then eight-week Seasons; none before it or with none configured; the switch read as a whole week or nothing (mutants: the beta\'s length; the Seasons\' length; the first; the start; the switch)', () => {
  assert.deepEqual([SEASON_ZERO_WEEKS, SEASON_WEEKS], [4, 8]);
  assert.deepEqual(['', ' 12 ', '12', 'x', '-3', '1.5', '12345678', undefined, null, 7].map(seasonZeroOf), [null, 12, 12, null, null, null, null, null, null, 7]);
  assert.equal(seasonOf(Z - 1, Z), null, 'before Season 0');
  assert.equal(seasonOf(Z, null), null, 'none configured');
  assert.equal(seasonOf(Z + 1.5, Z), null, 'a week is whole');
  assert.deepEqual([Z, Z + 3].map((w) => seasonOf(w, Z)), [{ n: 0, start: Z, end: Z + 4 }, { n: 0, start: Z, end: Z + 4 }]);
  assert.deepEqual([Z + 4, Z + 11].map((w) => seasonOf(w, Z)), [{ n: 1, start: Z + 4, end: Z + 12 }, { n: 1, start: Z + 4, end: Z + 12 }]);
  assert.deepEqual(seasonOf(Z + 12, Z), { n: 2, start: Z + 12, end: Z + 20 });
  assert.deepEqual(seasonOf(Z + 4 + 8 * 99, Z), { n: 100, start: Z + 4 + 8 * 99, end: Z + 4 + 8 * 100 });
  assert.equal(seasonOf(0, 0).n, 0, 'week 0 may begin it');
});

test('SEASON1 THE NAMES (9.1): "Season 0" the beta\'s; then the Tamrielic months in order, "the Season of Morning Star" to "the Season of Evening Star", repeating with a numeral; none for no Season (mutants: the months; the order; the round; the numeral)', () => {
  assert.equal(SEASON_MONTHS.length, 12);
  assert.deepEqual([SEASON_MONTHS[0], SEASON_MONTHS[8], SEASON_MONTHS[11]], ['Morning Star', 'Hearthfire', 'Evening Star']);
  assert.deepEqual([0, 1, 2, 12, 13, 24, 25, 49, 12 * 3 + 1, 12 * 8 + 1].map(seatSeasonName), [
    'Season 0', 'the Season of Morning Star', 'the Season of Sun\'s Dawn', 'the Season of Evening Star', 'the Season of Morning Star II',
    'the Season of Evening Star II', 'the Season of Morning Star III', 'the Season of Morning Star V', 'the Season of Morning Star IV', 'the Season of Morning Star IX',
  ]);
  assert.equal(seatSeasonName(12 * 1999 + 1), 'the Season of Morning Star MM');
  assert.deepEqual([-1, 1.5, null].map(seatSeasonName), [null, null, null]);
});

test('SEASON1 THE RULES THAT READ IT: the week a Season ends (its last); the once-a-Season floor its first week, or the last 8 weeks with none counted; a Pact to its Season\'s end, or the 8-week block; the soft reset\'s Standing halfway to 50, rounded toward it (mutants: the end; the floor; the stand-in; the Pact\'s end; the halfway; the rounding)', () => {
  assert.equal(seasonEndingAt(Z + 2, Z), null);
  assert.deepEqual(seasonEndingAt(Z + 3, Z), { n: 0, start: Z, end: Z + 4 }, 'Season 0\'s last week');
  assert.deepEqual(seasonEndingAt(Z + 11, Z), { n: 1, start: Z + 4, end: Z + 12 });
  assert.equal(seasonEndingAt(Z + 10, Z), null);
  assert.equal(seasonEndingAt(Z + 11, null), null);
  assert.deepEqual([seasonFloor(Z + 11, Z), seasonFloor(Z + 12, Z), seasonFloor(Z + 2, Z)], [Z + 4, Z + 12, Z]);
  assert.deepEqual([seasonFloor(Z + 11, null), seasonFloor(Z - 1, Z)], [Z + 11 - SIEGE_PAIR_WEEKS + 1, Z - 1 - SIEGE_PAIR_WEEKS + 1], 'none counted: the last 8 weeks');
  assert.deepEqual([pactUntil(Z + 5, Z), pactUntil(Z + 11, Z), pactUntil(Z + 1, Z)], [Z + 12, Z + 12, Z + 4]);
  assert.deepEqual([pactUntil(13), pactUntil(13, null), pactUntil(Z - 1, Z)], [16, 16, Math.floor((Z - 1) / 8) * 8 + 8], 'none counted: the 8-week block');
  assert.deepEqual([55, 45, 100, 0, 50, 51, 49, 52, 21].map(seasonStanding), [52, 48, 75, 25, 50, 50, 50, 51, 36]);
  assert.equal(STANDING_START, 50);
});

test('SEASON1 THE SEASON\'S TITLES (9.1): every crown\'s guild "Crowned in Season N", a seat held from the Season\'s first week "Keeper of <Town>, Season N" - a crown both; a seat taken later none; Season 0 crowns no one; a Charter\'s own title carries the Season counted; the words; the Chronicle\'s line; the Seat tab\'s (mutants: the crown; the keeper\'s week; the beta; the order; the Season on the claim; the words)', () => {
  const season = { n: 3, start: 20, end: 28 };
  const holds = [
    { key: 5023, guild: 'OA', tier: 'crown', since: 12 }, { key: 3034, guild: 'SH', tier: 'palace', since: 20 },
    { key: 3021, guild: 'DG', tier: 'palace', since: 21 }, { key: 5017, guild: 'IC', tier: 'crown', since: 25 },
  ];
  assert.deepEqual(seasonTitles(season, holds), [
    { guild: 'SH', title: 'keeper', key: 3034 }, { guild: 'IC', title: 'crowned', key: 5017 },
    { guild: 'OA', title: 'crowned', key: 5023 }, { guild: 'OA', title: 'keeper', key: 5023 },
  ]);
  assert.deepEqual(seasonTitles({ n: 0, start: 20, end: 24 }, holds), [], 'Season 0 crowns no one');
  assert.deepEqual([seasonTitles(null, holds), seasonTitles(season, null)], [[], []]);
  assert.deepEqual(seatTitleOf([{ key: 3034, tier: 'palace', region: 34 }], 3), { title: 'warden', ts: [3034, 3] });
  assert.deepEqual(seatTitleOf([{ key: 5023, tier: 'crown', region: 23 }]), { title: 'protector', ts: [5023, 0] }, 'none counted: 0');
  const place = (k) => (k === 3034 ? { name: 'Alcaire Keep', region: 34 } : null);
  assert.deepEqual([seatTitleText('crowned', [5023, 3], place), seatTitleText('keeper', [3034, 3], place)], ['Crowned in Season 3', 'Keeper of Alcaire Keep, Season 3']);
  const seat = { key: 3034, name: 'Alcaire Keep', tier: 'palace', region: 34 };
  assert.equal(chronicleLine({ kind: 'season-end', week: 27, data: { guild: { name: 'The Silver Hand', tag: 'SH' }, season: 3, kept: true } }, seat),
    'At the end of the Season of First Seed, the Silver Hand <SH> held Alcaire Keep, as it had the whole Season through.');
  assert.equal(chronicleLine({ kind: 'season-end', week: 27, data: { guild: { name: 'Daggers', tag: 'DG' }, season: 3, kept: false } }, seat),
    'At the end of the Season of First Seed, Daggers <DG> held Alcaire Keep.');
  assert.deepEqual([seasonLine(22, season), seasonLine(Z + 1, { n: 0, start: Z, end: Z + 4 }), seasonLine(5, null)], ['Week 3 of 8 of the Season of First Seed.', 'Week 2 of 4 of Season 0.', null]);
});
