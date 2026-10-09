// PERF-WAYS1 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"; bible/07-Rendering/Performance-Online.md): THE WAYS ASKED WHILE THE FRAME'S ASKING IS CHEAP. Online, the
// living world's readers planned every trip of every town near again each frame while any way they needed was unasked
// - 14-17 ms of the real game's 37 ms frame on the probe's container - and the ways filled at two a frame. LW3's two
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

/** A book whose planner takes `cost` ms of the test's clock a pair; answers the book and the pairs it planned. */
function timedBook(cost) {
  let clock = 0;
  const asked = [];
  const plan = (a, b) => { clock += cost; asked.push(`${a.x}>${b.x}`); return { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], kinds: ['road'] }; };
  return { book: createWayBook({ roads: () => NET, ground: () => ({}), plan, now: () => clock }), asked };
}
/** How many new pairs one frame asks of `book`, of `n` waiting. */
function oneFrame(book, n, base = 0) {
  book.frame();
  let got = 0;
  for (let i = 0; i < n; i++) if (book.wayOf(town(base + 2 * i, i, 0), town(base + 2 * i + 1, i, 1)) !== undefined) got++;
  return got;
}

test('PERF-WAYS1: a frame asks LW3\'s two at the least, then more while its asking has taken under WAYS_MS_PER_FRAME - a pair of 0.6 ms: four; of 5 ms: the two; of nothing on the clock (a coarse one): WAYS_MAX_PER_FRAME and no more; a new frame renews the time with the count (mutants: no floor past the time; no time past the floor; the time never renewed; no cap)', () => {
  assert.deepEqual([WAYS_PER_FRAME, WAYS_MS_PER_FRAME], [2, 2]);
  assert.ok(WAYS_MAX_PER_FRAME >= 16 && WAYS_MAX_PER_FRAME <= 64, `a cap in reason (${WAYS_MAX_PER_FRAME})`);
  const quick = timedBook(0.6);
  assert.equal(oneFrame(quick.book, 40), 4, '0.6, 1.2 (the floor), 1.8 (under two), 2.4 - then the time is spent');
  assert.equal(oneFrame(quick.book, 40, 1000), 4, 'and a new frame asks four again');
  const slow = timedBook(5);
  assert.equal(oneFrame(slow.book, 40), WAYS_PER_FRAME, 'a dear pair: the floor alone, as LW3');
  assert.equal(oneFrame(slow.book, 40, 1000), WAYS_PER_FRAME);
  const free = timedBook(0);
  assert.equal(oneFrame(free.book, 200), WAYS_MAX_PER_FRAME, 'a clock that reads nothing: the cap');
  // the floor is the floor even when the frame's time went before it (a pair dearer than the whole budget)
  const dear = timedBook(50);
  assert.equal(oneFrame(dear.book, 10), WAYS_PER_FRAME);
  // a pair asked is never asked again, and answers what it answered
  const b = timedBook(0.6);
  oneFrame(b.book, 40);
  const n = b.asked.length;
  b.book.frame();
  for (let i = 0; i < 4; i++) assert.ok(b.book.wayOf(town(2 * i, i, 0), town(2 * i + 1, i, 1)));
  assert.equal(b.asked.length, n, 'the four known: none asked again');
});

test('PERF-WAYS1: THE SAME WAYS, SOONER - over a synthetic region (eighty-one towns, the census\'s own travellers), a town\'s trips and visitors are known in a fraction of the frames LW3\'s two a frame took, and they are the very trips and visitors (every party, every member, every minute); the pairs asked are the same pairs (mutants: the time budget off; a pair planned on another network)', () => {
  const settle = (ms) => {
    const map = synthMap({ n: 9, step: 4 });
    let clock = 0;
    const plan = (a, b) => { clock += 0.1; return map.world.routeOf({ px: a.x, py: a.y }, { px: b.x, py: b.y }); };   // a tenth of a millisecond a pair - the planner's mean on the roads
    const book = createWayBook({ roads: () => NET, ground: () => ({}), plan, now: () => clock });
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
    return { frames, trips, visitors, pairs: book.size };
  };
  const was = settle(0), now = settle(WAYS_MS_PER_FRAME);
  assert.ok(was.trips && was.visitors && now.trips && now.visitors, 'both settle');
  assert.ok(was.frames > 40, `LW3's two a frame took ${was.frames} frames`);
  assert.ok(now.frames * 5 <= was.frames, `now ${now.frames} frames, against ${was.frames}`);
  assert.equal(now.pairs, was.pairs, 'the same pairs asked');
  const shape = (ts) => ts.map((t) => ({ id: t.id, to: t.to.mapId, out: t.outT0, back: t.backT1, party: t.party.map((m) => m.id) }));
  assert.deepEqual(shape(now.trips), shape(was.trips), 'the very trips');
  assert.deepEqual(now.visitors.map((v) => [v.res.id, v.inT, v.outT, v.yaw]), was.visitors.map((v) => [v.res.id, v.inT, v.outT, v.yaw]), 'and the very visitors');
});
