// AUDIT HORIZONTAL F3 (HUNTERS-MARK, bible/06-Systems/Bounty-Boards.md 12.10): THE DAY'S CEILING IS MEASURED. The walk
// that measures it (tools/huntPace.mjs) on a drawn map - a pixel's nearest point, a pack's ride, a tour's shortest
// order, the carriage's leg - and, where the game's data is at hand, on the game's own map: no honest day reaches the
// ceiling (huntLaw.js HUNT_CLEARS_DAY_MAX).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { toPixel, tourOf, huntDay, huntPace, huntPaceCities, HUNT_PACE_MPS, HUNT_PACE_PACK_M } from '../../tools/huntPace.mjs';
import { HUNT_CLEARS_DAY_MAX } from '../../src/net/huntLaw.js';
import { PIXEL_M } from '../../src/net/gate/gateLaw.js';
import { runSpeed } from '../../src/player/motor.js';
import { sharedClassicMinutes, ONLINE_MINUTES_PER_MS } from '../../src/net/wire.js';
import { MINUTES_PER_DAY } from '../../src/systems/bounty/bountyBoard.js';

const ARENA2 = process.env.ARENA2_PATH;
const noArena2 = !ARENA2 || !existsSync(ARENA2);

test('AUDIT HORIZONTAL F3 THE WALK on a drawn map: a notice is reached at its pixel\'s nearest point and its pack 60 m on, four in their shortest order; a board\'s notices taken once a game day; the carriage takes a hunter to any board from the nearest city\'s gate (mutants: the pixel\'s far edge; the pack\'s ride; the order not the shortest; the carriage never taken)', () => {
  assert.ok(HUNT_PACE_MPS > runSpeed(100, 185, false, 375), 'the swiftest horse and Fleetfoot past the motor\'s best gallop');
  assert.equal(HUNT_PACE_PACK_M, 60);
  const r = toPixel([100.5, 100.5], 104, 100);
  assert.deepEqual(r.at, [104, 100.5]);
  assert.ok(Math.abs(r.m - 3.5 * PIXEL_M) < 1e-6, 'three and a half pixels to the square\'s near edge');
  // four notices in a row east of the board, given out of order: three and a half pixels out, a pixel each after
  const tour = tourOf([100.5, 100.5], [[106, 100], [104, 100], [107, 100], [105, 100]], 10);
  assert.ok(Math.abs(tour.s - (6.5 * PIXEL_M + 4 * HUNT_PACE_PACK_M) / 10) < 1e-6, `the shortest order: ${tour.s}`);
  assert.equal(tour.legs.length, 4);
  // two cities 40 pixels apart, a third far off with the day's tightest notices: the carriage goes to it
  const near = (px, py) => ({ px, py, targets: () => [[px + 4, py], [px - 4, py], [px, py + 4], [px, py - 4]] });
  const tight = { px: 500, py: 300, targets: () => [[504, 300], [504, 301], [505, 300], [505, 301]] };
  const cities = [near(100, 100), near(140, 100), tight];
  const ridden = huntDay(cities, { start: 0, mps: 30, dayS: 3600, carriageS: null });
  const carried = huntDay(cities, { start: 0, mps: 30, dayS: 3600, carriageS: 0 });
  assert.ok(carried > ridden, `the carriage to the tight board: ${carried} against ${ridden}`);
  assert.ok(ridden >= 8 && ridden <= 12, `two boards' notices, then the third: ${ridden}`);
});

test('AUDIT HORIZONTAL F3 THE CEILING ON THE GAME\'S MAP: a sample of starts on 2026-10-27 - the fastest legal ride, the carriage, no time fighting - stays under HUNT_CLEARS_DAY_MAX (mutants: the ceiling back at four held a game day)',
  noArena2 ? { skip: 'ARENA2_PATH not set or the path does not exist (sh tools/fetch-data.sh)' } : {}, async () => {
    const cities = await huntPaceCities(/** @type {string} */ (ARENA2));
    assert.equal(cities.length, 410, 'every city carries a bounty board');
    const minutes = sharedClassicMinutes(Date.UTC(2026, 9, 27));
    const day0 = Math.floor(minutes / MINUTES_PER_DAY), phaseS = ((minutes % MINUTES_PER_DAY) / ONLINE_MINUTES_PER_MS) / 1000;
    const pace = huntPace(cities, { day0, phaseS, starts: cities.map((_, i) => i).filter((i) => i % 41 === 0) });
    assert.ok(pace.best > 600, `the walk's best day: ${pace.best}`);
    assert.ok(pace.best < HUNT_CLEARS_DAY_MAX, `no honest day reaches the ceiling: ${pace.best} of ${HUNT_CLEARS_DAY_MAX}`);
  });
