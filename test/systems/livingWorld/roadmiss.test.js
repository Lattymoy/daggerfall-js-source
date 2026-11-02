// ROADS-MISS (2026-10-13, a player's Firefox profile walking out of a house): a day whose roads' word is not ready yet
// is asked of the host once a tick, not once for every resident the tick plans - and asked again the next tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from '../../lwTown.mjs';
import { DAY_MIN, DAY_START_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../../../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';

test('ROADS-MISS: an unready roads word is asked once a tick however many residents plan, and the word that comes is kept', () => {
  const { nav, buildings, doors } = synthTown();
  const day = 100;
  const clock = { t: day * DAY_MIN + DAY_START_MIN + 10 * 60 };
  let asks = 0, ready = false;
  const known = new Map();
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND,
    tripsOf: (d) => { asks++; if (ready) known.set(d, (known.get(d) ?? 0) + 1); return ready ? { away: new Map(), visitors: [] } : undefined; },
  });
  assert.ok(town.residents.length > 2, 'a town of several to plan');
  const at = [0, 0, 0], eye = [0, 1.6, 0];
  for (let f = 0; f < 5; f++) {
    const before = asks;
    town.update(0.3, at, 0, eye, true);   // past LIVING_TICK_S: a tick every update
    assert.ok(asks - before <= 1, `tick ${f}: asked ${asks - before} times`);
  }
  assert.ok(asks >= 2, 'asked again on later ticks');
  ready = true;
  for (let f = 0; f < 5; f++) town.update(0.3, at, 0, eye, true);
  assert.ok(known.size > 0, 'the word asked once it was ready');
  for (const [d, n] of known) assert.equal(n, 1, `day ${d}: once known, kept by the day`);
});

test('ROADS-MISS: the miss is the tick\'s alone - a read outside a tick (peopleOf) asks the host again and is answered (mutant: the miss kept past its tick)', () => {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + DAY_START_MIN + 10 * 60 };
  let asks = 0, ready = false;
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND,
    tripsOf: () => { asks++; return ready ? { away: new Map(), visitors: [] } : undefined; },
  });
  town.update(0.3, [0, 0, 0], 0, [0, 1.6, 0], true);
  const before = asks;
  assert.ok(before >= 1, 'the tick asked');
  ready = true;
  town.peopleOf(town.dayOf(clock.t));
  assert.equal(asks, before + 1, 'asked again outside the tick, not answered by the tick\'s miss');
});
