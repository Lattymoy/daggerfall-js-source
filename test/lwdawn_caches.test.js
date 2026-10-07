// LW-DAWN (2026-10-07, a screenshot in Daggerfall - 1 fps, "script 6179.8 ms" - and the ask: "Something is killing CPU
// performance"; bible/06-Systems/Living-World.md "LW-DAWN"): A DAY'S CACHE KEEPS THE DAY BESIDE IT. The town's plans,
// the roads' word, its people and its walks by their door each kept one day; from the day's turn at four a reader asks
// two (WATCH-DAY's morning walk leaves before the turn, and a company's file is read off the day it leaves in; a walker
// owing minutes reads the day they are behind in), and each change of day threw the other away - the whole town planned
// again and the roads read again, every frame from four to six. Pinned here: the two doors that keep a day beside
// another, the town carried across the turn (no plan made and no road read a frame from then on), each cache's other day
// kept and served as it was, a day planned before its roads were known planned again once they are wherever it is kept,
// and a berth no street comes near sounded once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { LivingTown, swapDay, besideDay } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { DAY_MIN, DAY_START_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { HARBOUR_RING } from '../src/systems/livingWorld/places.js';
import { NAV_CELL } from '../src/world/cityNavigation.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const DAY = 100;

/** A synthetic town, its roads' word counted (`reads`, by day) and answered for the days in `known` (all, when null). */
function town({ blocks = 3, at, known = null, harbour = undefined }) {
  const { nav, buildings, doors } = synthTown({ blocksW: blocks, blocksH: blocks });
  const clock = { t: at };
  const reads = [];
  const t = new LivingTown(nav, { town: { mapId: 7400 + blocks, blocks: blocks * blocks, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
    clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, harbour,
    // the host's word as livingTripsOf answers it - its holders read every time, so a town's people read again are a new list
    tripsOf: (day) => { reads.push(day); return !known || known.has(day) ? { away: new Map(), visitors: [], holders: new Map() } : undefined; } });
  return { town: t, clock, reads, nav };
}

test('LW-DAWN the doors that keep a day beside another: the other day brought to the front with the front kept beside it, a new day keeping the one it replaces (a day made again its neighbour), one deep and never a chain (mutants: the swap, the keeping, the chain)', () => {
  const a = { day: 1, other: null };
  const b = { day: 2, other: besideDay(a, 2) };
  assert.deepEqual([b.other === a, a.other], [true, null], 'a new day keeps the one it replaces');
  assert.equal(swapDay(b, 2), null, 'the front is no swap');
  assert.equal(swapDay(b, 3), null, 'nor a day neither holds');
  assert.equal(swapDay(b, 1), a, 'the other day brought to the front');
  assert.deepEqual([a.other === b, b.other], [true, null], 'the front kept beside it in its turn, one deep');
  assert.equal(swapDay(a, 2), b, 'and back');
  assert.deepEqual([b.other === a, a.other], [true, null]);
  const again = { day: 2, other: besideDay(b, 2) };
  assert.deepEqual([again.other === a, a.other], [true, null], 'a day made again keeps its neighbour');
  const c = { day: 3, other: besideDay(again, 3) };
  assert.deepEqual([c.other === again, again.other], [true, null], 'the day before its neighbour let go: never a chain');
  assert.deepEqual([besideDay(null, 3), swapDay(null, 3)], [null, null]);
});

test('LW-DAWN the great city across the day\'s turn: from four the street plans no one again and asks the roads nothing, a frame at a time to the morning walk\'s end - WATCH-DAY\'s walk out read off the day before, the town kept two days (mutants: each cache\'s other day)', () => {
  const { town: t, clock, reads } = town({ blocks: 8, at: DAY * DAY_MIN + 230 });   // ten to four: the living day before DAY's
  const sq = t.places.square, at = [sq?.x ?? 0, 0, sq?.z ?? 0];
  const turn = DAY * DAY_MIN + DAY_START_MIN;
  const frames = [];
  while (clock.t < turn + 40) {
    const gen = t._planGen, read = reads.length;
    clock.t += 0.5;   // half a minute a frame - under ARRIVAL_JUMP_MIN, the census read every frame
    t.update(0.25, at, 0, at, true);
    frames.push({ t: clock.t, plans: t._planGen - gen, reads: reads.length - read });
  }
  const before = frames.filter((f) => f.t < turn), after = frames.filter((f) => f.t >= turn + 5);
  const sum = (fs, k) => fs.reduce((s, f) => s + f[k], 0);
  assert.ok(sum(frames.filter((f) => f.t >= turn && f.t < turn + 5), 'plans') >= t.residents.length, 'the turn plans the new day');
  // the morning walk's company read off the day it leaves in, while the street reads today - the case is met
  const walkers = t.residents.filter((r) => t.planOf(r, DAY).some((e) => e.kind === 'walk' && t.dayOf(e.t0) === DAY - 1));
  assert.ok(walkers.length > 0, 'the great city sends a watchman out before the turn');
  assert.deepEqual({ plans: sum(after, 'plans'), reads: sum(after, 'reads') }, { plans: 0, reads: 0 }, 'from five past four: no plan made, no road read');
  assert.ok(sum(before, 'plans') <= t.residents.length, 'nor before it, the census once');
});

test('LW-DAWN each cache keeps the other day: a plan, the roads\' word, the people and the walks by their door read again for the day before are the ones kept, and today\'s after them too - nothing planned, nothing asked (mutants: each swap, the plan\'s other day forgotten)', () => {
  const { town: t, reads } = town({ at: DAY * DAY_MIN + 600 });
  const res = t.residents[0];
  // both days read once over, as the turn reads them (a day's roads read afresh asks its people again, and a plan made
  // asks every day's walks again: the first read of each after the other's is its own)
  for (const d of [DAY, DAY + 1, DAY, DAY + 1]) { t.peopleOf(d); t.planOf(res, d); t._walksFrom(d); }
  const people0 = t.peopleOf(DAY), plan0 = t.planOf(res, DAY), walks0 = t._walksFrom(DAY);
  const people1 = t.peopleOf(DAY + 1), plan1 = t.planOf(res, DAY + 1), walks1 = t._walksFrom(DAY + 1);
  assert.notEqual(plan1, plan0, 'the next day is its own');
  assert.notEqual(walks1, walks0);
  const gen = t._planGen, read = reads.length;
  for (let i = 0; i < 3; i++) {
    assert.equal(t.peopleOf(DAY), people0, 'the people kept');
    assert.equal(t.planOf(res, DAY), plan0, 'the plan kept');
    assert.equal(t._walksFrom(DAY), walks0, 'the walks by their door kept');
    assert.equal(t.peopleOf(DAY + 1), people1);
    assert.equal(t.planOf(res, DAY + 1), plan1);
    assert.equal(t._walksFrom(DAY + 1), walks1);
  }
  assert.deepEqual({ plans: t._planGen - gen, reads: reads.length - read }, { plans: 0, reads: 0 }, 'a swap plans nothing and asks the roads nothing');
  t.planOf(res, DAY + 2);
  assert.equal(t._plans.get(res.id).other.plan, plan1, 'a third day keeps the one before it');
  assert.equal(t._plans.get(res.id).other.other, null, 'one deep');
});

test('LW-DAWN a day planned before its roads were known is planned again once they are - at the front or kept beside another day - and the other day it kept stays (mutants: the kept day\'s roads unread, the front\'s neighbour dropped)', () => {
  const known = new Set([DAY]);
  const { town: t } = town({ at: DAY * DAY_MIN + 600, known });
  const res = t.residents[0];
  const plan0 = t.planOf(res, DAY);
  // the next day's ways still being asked: planned without them, the day before kept beside it
  t.planOf(res, DAY + 1);
  assert.equal(t._plans.get(res.id).roads, false);
  known.add(DAY + 1);
  t.peopleOf(DAY + 1);   // the roads' word for it read: the plan made without it goes
  assert.equal(t.planOf(res, DAY + 1) && t._plans.get(res.id).roads, true, 'planned again with the roads');
  assert.equal(t.planOf(res, DAY), plan0, 'the day before it kept, not planned again');
  // and one KEPT beside another day: the day after's ways asked, its plan made without them, then today's read again
  t.planOf(res, DAY + 2);
  assert.equal(t._plans.get(res.id).roads, false);
  t.planOf(res, DAY + 1);   // to the front: the day after held beside it
  assert.equal(t._plans.get(res.id).other.day, DAY + 2);
  known.add(DAY + 2);
  t.peopleOf(DAY + 2);
  t.planOf(res, DAY + 2);
  assert.equal(t._plans.get(res.id).roads, true, 'the kept day planned again with its roads, not served as it was');
});

test('LW-DAWN a berth no street comes near is sounded once: asked again at every census and every sailor\'s plan, it searched the whole ring each time - by its cell, a hair off it the same, another cell sounded afresh (mutants: the miss unread, unkept, by the point)', () => {
  const far = { x: -HARBOUR_RING * NAV_CELL - 200, z: -HARBOUR_RING * NAV_CELL - 200 };
  let berth = far;
  const { town: t } = town({ at: DAY * DAY_MIN + 600, harbour: () => berth });
  let searches = 0;
  const net = t.places.net;
  Object.defineProperty(t.places, 'net', { get: () => { searches++; return net; } });   // the search's one read of the street net
  for (let i = 0; i < 3; i++) assert.equal(t.dockSpot(), null);
  assert.equal(searches, 1, 'sounded once');
  berth = { x: far.x + 0.01, z: far.z };
  assert.equal(t.dockSpot(), null);
  assert.equal(searches, 1, 'a hair off it, in its cell: the same miss');
  berth = { x: far.x - 2 * NAV_CELL, z: far.z };
  assert.equal(t.dockSpot(), null);
  assert.equal(searches, 2, 'another cell sounded afresh');
});
