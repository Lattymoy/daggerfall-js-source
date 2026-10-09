// PERF-WAYS1 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"; bible/07-Rendering/Performance-Online.md): THE WAYS ASKED WHILE THE FRAME'S ASKING IS CHEAP. Online, the
// living world's readers planned every trip of every town near again each frame while any way they needed was unasked
// - 16.8 ms of the real game's 36.5 ms frame on the probe's container - and the ways filled at two a frame. LW3's two
// stay the floor; past them a frame asks on while its asking has taken under WAYS_MS_PER_FRAME (and never past
// WAYS_MAX_PER_FRAME, whatever a coarse clock reads). The same pairs, planned the same - known in a tenth of the frames.
// Every clock here is the test's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWayBook, WAYS_PER_FRAME, WAYS_MS_PER_FRAME, WAYS_MAX_PER_FRAME } from '../src/systems/livingWorld/ways.js';
import { townTrips, visitorsOf, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { synthMap } from './lwRoads.mjs';

const NET = { roads: 'R', tracks: 'T' };
const town = (id, px, py) => ({ mapId: id, px, py });

const GROUND = { flat: 'G' };
/** A book whose planner takes `cost` ms of the test's clock a pair; answers the book and every call it made of the
 *  planner - [from x, from y, to x, to y, roads, tracks, ground] (AUDIT PERF-ON4, ways lens 1: the direction, the network
 *  and the ground of every pair, past the floor too). */
function timedBook(cost) {
  let clock = 0;
  const asked = [];
  const plan = (a, b, o) => { clock += cost; asked.push([a.x, a.y, b.x, b.y, o.roads, o.tracks, o.flat]); return { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], kinds: ['road'] }; };
  return { book: createWayBook({ roads: () => NET, ground: () => GROUND, plan, now: () => clock }), asked };
}
/** A pair: the lower map id at x 100 + i, the higher at x 500 + i - asked the higher first on every other pair. */
const pairOf = (base, i) => (i % 2 ? [town(base + 2 * i + 1, 500 + i, 1), town(base + 2 * i, 100 + i, 0)] : [town(base + 2 * i, 100 + i, 0), town(base + 2 * i + 1, 500 + i, 1)]);
/** How many new pairs one frame asks of `book`, of `n` waiting - each answer the way from the town asked first. */
function oneFrame(book, n, base = 0) {
  book.frame();
  let got = 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = pairOf(base, i), way = book.wayOf(a, b);
    if (way === undefined) continue;
    got++;
    assert.deepEqual([way.pixels[0].x, way.pixels.at(-1).x], [a.px, b.px], 'the way runs from the town asked first');
  }
  return got;
}

test('PERF-WAYS1: a frame asks LW3\'s two at the least, then more while its asking has taken under WAYS_MS_PER_FRAME - a pair of 0.6 ms: four; of exactly 1 ms: two (two milliseconds is spent, not under); of 5 ms: the two; of nothing on the clock (a coarse one): WAYS_MAX_PER_FRAME and no more; a new frame renews the time with the count; and every pair past the floor planned as the floor\'s are - the lower map id first, on the drawn network, on the ground (mutants: no floor past the time; no time past the floor; the time never renewed; no cap; the cap 16 or 64; the time\'s edge taken; past the floor: the higher id first, no network, no ground)', () => {
  assert.deepEqual([WAYS_PER_FRAME, WAYS_MS_PER_FRAME, WAYS_MAX_PER_FRAME], [2, 2, 32]);
  const quick = timedBook(0.6);
  assert.equal(oneFrame(quick.book, 40), 4, '0.6, 1.2 (the floor), 1.8 (under two), 2.4 - then the time is spent');
  assert.equal(oneFrame(quick.book, 40, 1000), 4, 'and a new frame asks four again');
  assert.equal(oneFrame(timedBook(1).book, 40), 2, '1, 2 (the floor) - and two milliseconds is not under two');
  const slow = timedBook(5);
  assert.equal(oneFrame(slow.book, 40), WAYS_PER_FRAME, 'a dear pair: the floor alone, as LW3');
  assert.equal(oneFrame(slow.book, 40, 1000), WAYS_PER_FRAME);
  const free = timedBook(0);
  assert.equal(oneFrame(free.book, 200), WAYS_MAX_PER_FRAME, 'a clock that reads nothing: the cap');
  // every call the planner took, the floor's and past it: the lower id's town first, the drawn network, the ground
  const calls = [...quick.asked, ...free.asked];
  assert.equal(calls.length, 4 + 4 + WAYS_MAX_PER_FRAME);
  for (const [ax, ay, bx, by, roads, tracks, flat] of calls) assert.deepEqual([ax < 500, ay, bx >= 500, by, roads, tracks, flat], [true, 0, true, 1, 'R', 'T', 'G'], `a call [${ax}, ${ay}] > [${bx}, ${by}] on ${roads}/${tracks}/${flat}`);
  // the floor is the floor even when the frame's time went before it (a pair dearer than the whole budget)
  const dear = timedBook(50);
  assert.equal(oneFrame(dear.book, 10), WAYS_PER_FRAME);
  // a pair asked is never asked again, and answers what it answered
  const b = timedBook(0.6);
  oneFrame(b.book, 40);
  const n = b.asked.length;
  b.book.frame();
  for (let i = 0; i < 4; i++) assert.ok(b.book.wayOf(...pairOf(0, i)));
  assert.equal(b.asked.length, n, 'the four known: none asked again');
});

test('PERF-WAYS1 (AUDIT PERF-ON4, ways lens 2): THE SHIPPED CLOCK - a book built with no clock of its own (as world.js builds it) times its asking by performance.now: a pair of 0.6 ms on it, four a frame; one of 5 ms, the two (mutant: a default clock that reads nothing, under which every frame asks the cap)', () => {
  const real = performance.now;
  let clock = 0;
  performance.now = () => clock;
  try {
    for (const [cost, want] of [[0.6, 4], [5, WAYS_PER_FRAME]]) {
      const book = createWayBook({ roads: () => NET, ground: () => GROUND, plan: (a, b) => { clock += cost; return { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] }; } });
      assert.equal(oneFrame(book, 40), want, `a pair of ${cost} ms`);
    }
  } finally { performance.now = real; }
  assert.notEqual(performance.now(), clock, 'the clock put back');
});

test('PERF-WAYS1: THE SAME WAYS, SOONER - over a synthetic region (eighty-one towns, the census\'s own travellers), a town\'s trips and visitors are known in a fraction of the frames LW3\'s two a frame took, and they are the very trips and visitors (every party, every member, every minute); the planner is asked the very calls - each pair once, the same direction, network and ground (mutants: the time budget off; a pair planned on another network, or the other way, past the floor)', () => {
  const settle = (ms) => {
    const map = synthMap({ n: 9, step: 4 });
    let clock = 0;
    const calls = [];
    const plan = (a, b, o) => { clock += 0.1; calls.push(`${a.x},${a.y}>${b.x},${b.y} ${o.roads}/${o.tracks}/${o.flat}`); return map.world.routeOf({ px: a.x, py: a.y }, { px: b.x, py: b.y }); };   // a tenth of a millisecond a pair - the planner's mean on the roads
    const book = createWayBook({ roads: () => NET, ground: () => GROUND, plan, now: () => clock });
    const world = { ...map.world, routeOf: (a, b) => book.wayOf(a, b) };
    const o = { mpm: CALENDAR_MPM, memo: new Map() };
    const here = map.towns[40];   // the middle of the region
    const day = 20, noon = day * DAY_MIN + 240 + 720;
    let frames = 0, trips, visitors;
    do {
      book.frame(WAYS_PER_FRAME, ms);
      frames++;
      trips = townTrips(here, noon, world, o);
      visitors = visitorsOf(here, day, world, o);
    } while ((trips === undefined || visitors === undefined) && frames < 5000);
    return { frames, trips, visitors, pairs: book.size, calls: calls.sort() };
  };
  const was = settle(0), now = settle(WAYS_MS_PER_FRAME);
  assert.ok(was.trips && was.visitors && now.trips && now.visitors, 'both settle');
  assert.ok(was.frames > 40, `LW3's two a frame took ${was.frames} frames`);
  assert.ok(now.frames * 5 <= was.frames, `now ${now.frames} frames, against ${was.frames}`);
  assert.equal(now.pairs, was.pairs, 'the same pairs asked');
  assert.deepEqual(now.calls, was.calls, 'the very calls of the planner: each pair once, its direction, network and ground');
  const shape = (ts) => ts.map((t) => ({ id: t.id, to: t.to.mapId, out: t.outT0, back: t.backT1, party: t.party.map((m) => m.id) }));
  assert.deepEqual(shape(now.trips), shape(was.trips), 'the very trips');
  assert.deepEqual(now.visitors.map((v) => [v.res.id, v.inT, v.outT, v.yaw]), was.visitors.map((v) => [v.res.id, v.inT, v.outT, v.yaw]), 'and the very visitors');
});
