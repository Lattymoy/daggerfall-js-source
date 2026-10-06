// LW-SPREAD (2026-10-06, bible/06-Systems/Living-World.md "LW-SPREAD"; Mac: "in towns some NPCs can group up too much
// when talking to each other. Almost like they are all situated in one place"): THE TOWN GATHERS IN MANY PLACES. The
// square was one point, and six in ten of a town kept it for their first social spot; every stall stood there, and a
// mercenary's morning, an adventurer's afternoon, a visitor's and a courtier's talk: on the game's own towns at six
// in the evening 30-64 of a town stood about that one point (Bubyrydata: 64 of the 161 out of doors); the town went out
// for the evening on the hour, and to the morning's market within one hour - a hamlet's every homemaker at its one
// shop's front (Kirkcester: seventy). The square is ground now - its points (places.js `squares`: the most open cells
// about it, apart, seen from it) - and whatever takes one to it takes them to their own point (dayPlan.js squareOf); a
// resident's two social spots are of those nearest their home - the town's corners among them (places.js `corners`) -
// the square among them where it is near, and from anywhere for SQUARE_LIKE of the town; their market of the shops'
// fronts and the square's points nearest home; a stall at the square or at their market; the evening and the market at
// their own minute. The towns are the synthetic ones (test/lwTown.mjs); the game's own where ARENA2_PATH names the data
// (test/lwRealTown.mjs; tools/livingCrowdProbe.mjs measures them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown, closeTown } from './lwTown.mjs';
import { skipReal, hostTown, LOCATION_TYPES } from './lwRealTown.mjs';
import { crowdsOf, sampleTowns } from '../tools/livingCrowdProbe.mjs';
import { townPlaces, SQUARE_REACH, SQUARE_GAP, SQUARE_OPEN, SQUARE_POINTS, SQUARE_WINDOW, CORNER_MARGIN, CORNER_OPEN, CORNER_GAP } from '../src/systems/livingWorld/places.js';
import { favourites, squareOf, dayPlan, DAY_MIN, DAY_START_MIN, SQUARE_LIKE, SOCIAL_NEAR, EVENING_SPREAD_MIN, MARKET_HOURS } from '../src/systems/livingWorld/dayPlan.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const MPM = PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND;
const SYNTH = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });
const SYNTH4 = Object.freeze({ mapId: 24680, blocks: 16, region: 17, people: 3, port: false });
const CLOSE = Object.freeze({ mapId: 777, blocks: 16, region: 17, people: 3, port: false });

/** The town's street cells about a cell in the square's window, read off the net itself. */
const openAt = (places, W, x, y) => {
  let n = 0;
  for (let j = y - SQUARE_WINDOW; j <= y + SQUARE_WINDOW; j++) for (let i = x - SQUARE_WINDOW; i <= x + SQUARE_WINDOW; i++) n += places.net[j * W + i] === places.netId ? 1 : 0;
  return n;
};
/** Every cell the straight line between two cells' middles crosses, a twentieth of a cell apart, on the net. */
const seenOver = (places, W, a, b) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 20));
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(a[0] + 0.5 + ((b[0] - a[0]) * i) / n), y = Math.floor(a[1] + 0.5 + ((b[1] - a[1]) * i) / n);
    if (places.net[y * W + x] !== places.netId) return false;
  }
  return true;
};
const gap = (a, b) => Math.hypot(a.cell[0] - b.cell[0], a.cell[1] - b.cell[1]);
/** A grid laid by hand: its street the cells of the rectangles ([x0, y0, x1, y1], inclusive), the rest built on. */
const laid = (W, H, rects) => ({ width: W, height: H, weightAt: (x, y) => (rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1) ? 1 : 0) });

test('LW-SPREAD the square\'s points: the square\'s own spot first, then the most open street cells about it - each within SQUARE_REACH of it, SQUARE_GAP from every other, at least SQUARE_OPEN as open as the square, seen from it over the street - to SQUARE_POINTS; an open town five of them, a close-built one fewer, none without a square (mutants: the gap, the openness, the reach, the line, the cap)', () => {
  for (const [name, built, least] of [['open', synthTown(), SQUARE_POINTS], ['open 4x4', synthTown({ blocksW: 4, blocksH: 4 }), SQUARE_POINTS], ['close-built', closeTown(), 1]]) {
    const places = townPlaces(built.nav, built.doors, built.buildings);
    const W = built.nav.width, sq = /** @type {any} */ (places.square);
    assert.ok(sq && places.squares[0] === sq, `${name}: the square's own spot first`);
    assert.ok(places.squares.length >= least && places.squares.length <= SQUARE_POINTS, `${name}: ${places.squares.length} points`);
    const open = openAt(places, W, sq.cell[0], sq.cell[1]);
    for (const [i, p] of places.squares.entries()) {
      assert.equal(p.kind, 'square');
      assert.equal(places.net[p.cell[1] * W + p.cell[0]], places.netId, `${name} ${p.key}: on the street`);
      assert.ok(gap(p, sq) <= SQUARE_REACH, `${name} ${p.key}: within reach of the square`);
      assert.ok(openAt(places, W, p.cell[0], p.cell[1]) >= SQUARE_OPEN * open, `${name} ${p.key}: open as the square`);
      assert.ok(seenOver(places, W, sq.cell, p.cell), `${name} ${p.key}: seen from the square over the street`);
      for (const q of places.squares.slice(0, i)) assert.ok(gap(p, q) >= SQUARE_GAP, `${name} ${p.key} and ${q.key}: apart`);
      assert.ok(Math.abs(p.x - (p.cell[0] + 0.5) * 1.6) < 1e-9 && Math.abs(p.z - (p.cell[1] + 0.5) * 1.6) < 1e-9, `${name} ${p.key}: a cell's middle`);
    }
  }
  // the town square's cells all about it walled in but the lanes: none of its points through a wall
  const close = closeTown(), cp = townPlaces(close.nav, close.doors, close.buildings);
  assert.ok(cp.squares.length < SQUARE_POINTS, 'a close-built town\'s crossing holds fewer');
  // a small square, and a broad plaza behind a wall within its reach - as open, on the street by a lane about the wall's end
  const walled = townPlaces(laid(128, 128, [[59, 65, 67, 73], [50, 40, 80, 61], [68, 69, 80, 69], [80, 61, 80, 69]]), [], []);
  const wsq = /** @type {any} */ (walled.square), beyond = [63, 58];
  assert.deepEqual(wsq.cell, [63, 69], 'the small square');
  assert.ok(walled.net[beyond[1] * 128 + beyond[0]] === walled.netId && Math.hypot(beyond[0] - 63, beyond[1] - 69) <= SQUARE_REACH
    && openAt(walled, 128, beyond[0], beyond[1]) >= SQUARE_OPEN * openAt(walled, 128, 63, 69), 'the plaza beyond the wall within reach and as open');
  assert.deepEqual(walled.squares.map((p) => p.key), ['sq'], 'none of the plaza beyond the wall a point of the square');
  assert.deepEqual(townPlaces({ width: 4, height: 4, weightAt: () => 0, grid: new Uint8Array(16) }, [], []).squares, [], 'no street, no square, no points');
});

test('LW-SPREAD the town\'s corners: each block\'s most open street cell inside CORNER_MARGIN, as open as CORNER_OPEN of the square at least, CORNER_GAP from every social spot, every point of the square and every corner before it (the most open first) - one a block at most; a social spot of the neighbourhood (mutants: the gap, the corners before unkept, the openness, the block, the margin)', () => {
  for (const [name, built] of [['open', synthTown({ blocksW: 4, blocksH: 4 })], ['close-built', closeTown()]]) {
    const places = townPlaces(built.nav, built.doors, built.buildings);
    const W = built.nav.width, sq = /** @type {any} */ (places.square);
    const open = openAt(places, W, sq.cell[0], sq.cell[1]);
    assert.ok(places.corners.length >= 3, `${name}: corners (${places.corners.length})`);
    const blocks = new Set();
    for (const [i, c] of places.corners.entries()) {
      assert.equal(c.kind, 'corner');
      assert.equal(places.net[c.cell[1] * W + c.cell[0]], places.netId, `${name} ${c.key}: on the street`);
      assert.ok(openAt(places, W, c.cell[0], c.cell[1]) >= CORNER_OPEN * open, `${name} ${c.key}: open`);
      const bx = Math.floor(c.cell[0] / 64), by = Math.floor(c.cell[1] / 64);
      assert.equal(c.key, `c${bx}.${by}`);
      assert.ok(!blocks.has(c.key), `${name} ${c.key}: one a block`);
      blocks.add(c.key);
      for (const k of [0, 1]) { const o = c.cell[k] - (k ? by : bx) * 64; assert.ok(o >= CORNER_MARGIN && o < 64 - CORNER_MARGIN, `${name} ${c.key}: inside its block's margin`); }
      for (const s of [...places.social, ...places.squares, ...places.corners.slice(0, i)]) assert.ok(gap(c, s) >= CORNER_GAP, `${name} ${c.key}: apart from ${s.key}`);
    }
  }
  // laid by hand: a plaza across the border of the first two blocks (each's most open cell either side of it, as open as
  // the square and fifteen cells apart), the square in the third, and the next block's street a lane
  const W = 192, laidOut = townPlaces(laid(W, 128, [[52, 6, 75, 20], [86, 54, 106, 74], [76, 20, 80, 20], [80, 20, 80, 64], [80, 64, 86, 64], [80, 30, 160, 30]]), [], []);
  const sqOpen = openAt(laidOut, W, laidOut.square?.cell[0] ?? 0, laidOut.square?.cell[1] ?? 0);
  assert.ok(openAt(laidOut, W, 55, 9) === sqOpen && openAt(laidOut, W, 70, 9) === sqOpen, 'either side of the border as open as the square');
  assert.ok(openAt(laidOut, W, 134, 30) < CORNER_OPEN * sqOpen, 'the lane not');
  assert.deepEqual(laidOut.corners.map((c) => `${c.key}@${c.cell}`), ['c0.0@55,9'], 'one corner of the two blocks\' plaza, none of the lane');
});

test('LW-SPREAD a resident\'s own point of the square: their seed\'s alone - the same on every reader, every day - spread over the points (each the own of some of the town), the square\'s own spot where it is the only one, none without a square (mutants: the seed, the points)', () => {
  const built = synthTown();
  const places = townPlaces(built.nav, built.doors, built.buildings), again = townPlaces(built.nav, built.doors, built.buildings);
  const census = townCensus(SYNTH, built.buildings, new Set(places.doors.keys()));
  const per = new Map();
  for (const r of census) {
    const p = /** @type {any} */ (squareOf(r, places));
    assert.ok(places.squares.includes(p), `${r.id}: a point of the square`);
    assert.equal(/** @type {any} */ (squareOf(r, again)).key, p.key, `${r.id}: the same on another reader`);
    per.set(p.key, (per.get(p.key) ?? 0) + 1);
  }
  assert.equal(per.size, places.squares.length, 'every point some one\'s own');
  for (const [k, n] of per) assert.ok(n >= census.length / places.squares.length / 2, `${k}: ${n} of ${census.length}`);
  assert.equal(squareOf(census[0], { ...places, squares: [] }), places.square, 'the square alone: its own spot');
  assert.equal(squareOf(census[0], { ...places, squares: [], square: null }), null, 'no square: none');
});

test('LW-SPREAD the favourites: two social spots of the SOCIAL_NEAR nearest home - the town\'s corners among them, the square where it is near and its point the resident\'s own - and the square from anywhere for SQUARE_LIKE of the town; the market of the SOCIAL_NEAR shops\' fronts and the square\'s points nearest home, the square their own point; the same whatever order the town\'s spots are listed in (the key breaks a tie). The first cut kept 84-85% of a town to the square (mutants: the square everyone\'s, its spot not their own, the corners unread, the market unspread, the near, the corners unranked)', () => {
  for (const [name, built, rec] of [['open', synthTown(), SYNTH], ['open 4x4', synthTown({ blocksW: 4, blocksH: 4 }), SYNTH4], ['close-built', closeTown(), CLOSE]]) {
    const places = townPlaces(built.nav, built.doors, built.buildings);
    const census = townCensus(rec, built.buildings, new Set(places.doors.keys()));
    const d = (a, b) => Math.abs(a.cell[0] - b.cell[0]) + Math.abs(a.cell[1] - b.cell[1]);
    let atSquare = 0, atCorner = 0, n = 0, third = 0, marketSquare = 0;
    const listedBack = { ...places, social: [...places.social].reverse(), corners: [...places.corners].reverse(), market: [...places.market].reverse() };
    for (const r of census) {
      const home = r.home != null ? places.doors.get(r.home) ?? null : null;
      if (!home) continue;
      n++;
      const f = favourites(r, places, home), own = squareOf(r, places);
      const near = [...places.social, ...places.corners].sort((a, b) => d(a, home) - d(b, home) || a.key.localeCompare(b.key));
      // the first of the SOCIAL_NEAR nearest; the second of the SOCIAL_NEAR nearest of the rest (the first left out)
      const limits = [d(near[Math.min(near.length, SOCIAL_NEAR) - 1], home), d(near[Math.min(near.length, SOCIAL_NEAR + 1) - 1], home)];
      if (f.social[0] && !places.squares.includes(f.social[0]) && near.length > 2 && d(f.social[0], home) > d(near[1], home)) third++;   // the third nearest kept to: three drawn from, not two
      for (const [i, s] of f.social.entries()) {
        if (places.squares.includes(s)) { assert.equal(s, own, `${name} ${r.id}: the square their own point`); continue; }
        assert.ok(d(s, home) <= limits[i], `${name} ${r.id}: ${s.key} near home`);
        if (s.kind === 'corner') atCorner++;
      }
      if (f.social.some((s) => places.squares.includes(s))) atSquare++;
      const markets = [...places.market, ...places.squares].sort((a, b) => d(a, home) - d(b, home) || a.key.localeCompare(b.key));
      const far = d(markets[Math.min(markets.length, SOCIAL_NEAR) - 1], home);
      if (places.squares.includes(f.market)) { assert.equal(f.market, own, `${name} ${r.id}: the market at the square their own point`); assert.ok(places.squares.some((p) => d(p, home) <= far), `${name} ${r.id}: the square near home`); marketSquare++; }
      else assert.ok(f.market && d(f.market, home) <= far, `${name} ${r.id}: the market near home`);
      assert.equal(f.square, own);
      // the same favourites whatever order the town's spots stand in its lists
      const g = favourites(r, listedBack, home);
      assert.deepEqual([...g.social.map((s) => s.key), g.market?.key, g.square?.key], [...f.social.map((s) => s.key), f.market?.key, f.square?.key], `${name} ${r.id}: the order of the lists`);
    }
    assert.ok(atSquare / n < 0.45 && atSquare / n > SQUARE_LIKE * 0.6, `${name}: ${(100 * atSquare / n).toFixed(0)}% of the town keep to the square`);
    assert.ok(atCorner > n / 10, `${name}: corners kept to (${atCorner})`);
    assert.ok(third > n / 20, `${name}: the third nearest a first favourite (${third})`);
    assert.ok(marketSquare > n / 20 && n - marketSquare > n / 20, `${name}: the market at the square (${marketSquare} of ${n}) and at the shops' fronts`);
  }
});

test('LW-SPREAD the day: whatever takes one to the square takes them to their own point of it - a stall (a stall-keeper\'s at the square or at their market), the talk, the market, a stroll\'s stop, a labourer\'s job, a visitor\'s afternoon - and the watch\'s beat its own (a pair\'s stops the pair\'s); a stroll by the town\'s corners too; the evening out at their own minute, over EVENING_SPREAD_MIN; the homemaker\'s market at their own hour within MARKET_HOURS (mutants: the square not their own, the watch\'s beat their own, the stall at the square, the corners unstrolled, the evening on the hour, the market on the hour)', () => {
  const built = synthTown({ blocksW: 4, blocksH: 4 });
  const places = townPlaces(built.nav, built.doors, built.buildings);
  const day = 100, D0 = day * DAY_MIN + DAY_START_MIN;
  const tavern = /** @type {any} */ ([...places.doors.values()].find((s) => s.building != null && places.types.get(s.building) === BUILDING_TYPES.Tavern));
  assert.ok(tavern, 'a tavern to lodge at');
  /** @type {Record<string, number>} */
  const seen = {};
  const count = (/** @type {string} */ k) => { seen[k] = (seen[k] ?? 0) + 1; };
  const eveningOut = [], marketAt = [];
  for (const rec of [SYNTH4, { ...SYNTH4, port: true }]) {
    const census = townCensus(rec, built.buildings, new Set(places.doors.keys()));
    for (const r of census) {
      for (const visitor of [false, true]) {
        if (visitor && r.job === 'guard') continue;
        const home = visitor ? tavern : r.home != null ? places.doors.get(r.home) ?? null : null;
        const plan = dayPlan(r, places, day, { mpm: MPM, visitor, home });
        const f = favourites(r, places, home);
        for (const e of plan) {
          if (!e.at || e.kind === 'walk') continue;
          if (e.duty) {   // the watch's beat: its stops the patrol's - the two of a pair at one stop, the square's own spot
            assert.ok(e.at === places.square || !places.squares.includes(e.at), `${r.id}: the watch at the square's own spot (${e.at.key})`);
            if (e.at === places.square) count('the watch at the square');
            continue;
          }
          if (places.squares.includes(e.at)) {
            assert.equal(e.at, f.square, `${r.id}${visitor ? ' (a visitor)' : ''}: ${e.kind} at the square - their own point`);
            count(`${visitor ? 'visitor' : r.job} ${e.kind} at the square`);
          }
          if (e.kind === 'stall' && ['crafter', 'fisher', 'merchant'].includes(r.job)) { assert.ok(e.at === f.square || e.at === f.market, `${r.id}: a stall at the square or their market (${e.at.key})`); if (e.at === f.market && e.at !== f.square) count(`${r.job} stall at their market`); }
          if (e.at.kind === 'corner' && e.kind === 'market') count('a stroll by a corner');
          if (visitor || rec.port) continue;
          if (e.kind === 'social' && e.t0 >= D0 + 14 * 60 && e.t0 < D0 + 16 * 60 && r.job === 'crafter') eveningOut.push(e.t0 - D0 - 14 * 60);   // a crafter's evening from six - their day's only talk (but a lark's stroll)
          if (e.kind === 'market' && r.job === 'homemaker' && e.t0 < D0 + 7 * 60 && e.t1 - e.t0 >= 45) marketAt.push(e.t0 - D0);   // the morning's (a lark's stroll at first light stops a quarter-hour at a market too)
        }
      }
    }
  }
  for (const k of ['crafter stall at the square', 'crafter stall at their market', 'fisher stall at the square', 'fisher stall at their market', 'merchant stall at the square',
    'labourer stall at the square', 'homemaker market at the square', 'homemaker social at the square', 'mercenary social at the square', 'adventurer social at the square',
    'courtier social at the square', 'visitor social at the square', 'beggar beg at the square', 'a stroll by a corner', 'the watch at the square']) assert.ok(seen[k] > 0, `${k} (${JSON.stringify(seen)})`);
  const spread = (/** @type {number[]} */ ts) => Math.max(...ts) - Math.min(...ts);
  assert.ok(eveningOut.length > 20 && spread(eveningOut) >= EVENING_SPREAD_MIN * 0.8, `the evening out over ${spread(eveningOut).toFixed(0)} minutes (${eveningOut.length})`);
  for (const t of eveningOut) assert.ok(t >= 0 && t <= EVENING_SPREAD_MIN + 1e-6, `the evening out within EVENING_SPREAD_MIN of six (${t.toFixed(0)})`);
  assert.ok(marketAt.length > 20 && spread(marketAt) >= (MARKET_HOURS[1] - MARKET_HOURS[0]) * 60 * 0.8, `the market over ${spread(marketAt).toFixed(0)} minutes (${marketAt.length})`);
  for (const t of marketAt) assert.ok(t >= MARKET_HOURS[0] * 60 - DAY_START_MIN - 1e-6 && t <= MARKET_HOURS[1] * 60 - DAY_START_MIN + 1e-6, `the market within its hours (${((t + DAY_START_MIN) / 60).toFixed(2)})`);
});

test('LW-SPREAD the town gathers in many places: the synthetic towns from seven in the morning to ten at night - the most of their people at one spot 11, 16 and 26 (the first cut: 30, 63 and 90, all at the square) (mutants: the square everyone\'s, the corners unread, the evening on the hour, the market on the hour, the market unspread)', () => {
  for (const [name, built, rec, most] of [['open', synthTown(), SYNTH, 15], ['open 4x4', synthTown({ blocksW: 4, blocksH: 4 }), SYNTH4, 22], ['close-built', closeTown(), CLOSE, 32]]) {
    const c = crowdsOf({ ...built, town: rec });
    assert.ok(c.busiest <= most, `${name}: ${c.busiest} at one spot at ${c.busiestAt.toFixed(1)}h of ${c.outThen} out`);
  }
});

test('LW-SPREAD the game\'s own towns (ARENA2): a sample of fourteen cities, ten villages and ten hamlets from seven in the morning to ten at night - the most of a town\'s people at one spot 25 at most and 15 on average (measured at LW-SPREAD: 41.1 on average and 70 at most before - Kirkcester\'s every homemaker at its one shop\'s front at twenty past nine - and 11.6 and 24 after, Kirkcester\'s morning market at its square\'s three points) (mutants: the square everyone\'s, the corners unread, the evening on the hour, the market on the hour, the market unspread)', { skip: skipReal }, () => {
  const rows = sampleTowns([[LOCATION_TYPES.TownCity, 14], [LOCATION_TYPES.TownVillage, 10], [LOCATION_TYPES.TownHamlet, 10]]).map((loc) => ({ name: loc.name, ...crowdsOf(hostTown(loc)) }));
  assert.equal(rows.length, 34);
  for (const r of rows) assert.ok(r.busiest <= 25, `${r.name}: ${r.busiest} at one spot at ${r.busiestAt.toFixed(1)}h of ${r.outThen} out`);
  assert.ok(rows.reduce((n, r) => n + r.busiest, 0) / rows.length <= 15, 'on average');
});
