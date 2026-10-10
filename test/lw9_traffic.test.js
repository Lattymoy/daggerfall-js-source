// LW9 (bible/06-Systems/Living-World-II.md "LW9"): THE ROAD'S TRAFFIC - the road's new travellers appended to the
// census (a farm's and a village's carters to market, their hunters into the wild, a city's patrol, its noble in
// procession with their retainers, its minstrel), each job's tables, the one a traveller rides with, a carter's market
// day, a hunter's wild, the inn on the road and its guests, the patrol's cover on trouble and its halt of a wanted
// player, the night's camps shared round one fire, the parties passing with a word, the days at home and away, a
// minstrel's song. Pure and synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  travellerRoster, travellerCounts, roadCounts, moreCounts, MORE_JOBS, ROAD_JOBS, TRAVELLER_JOBS, HUNTER_CLASSES, RETAINER_CLASSES, CITY_COURT_BLOCKS,
} from '../src/systems/livingWorld/census.js';
import {
  ownTrip, townTrips, partyAt, leaderOf, placeCycle, cycleOf, marketDay, marketTrip, wildTrip, nightStop, innAhead, innsAlong,
  innGuestsOf, patrolCover, memoTrip, whenWalked, contractOf, roadBound, paceScale, NATIVE_PIXEL, CALENDAR_MPM, ROAD_PACE,
  ROAD_CYCLE_DAYS, ROAD_TRIP_CHANCE, ROAD_RANGE_PX, ROAD_STAY_DAYS, MARKET_IN_H, MARKET_OUT_H, INN_AHEAD_N, INN_TYPE,
  PATROL_RISK, PATROL_COVER_DAYS, WALK_TO_H, WALK_FROM_H, NATIVE_PER_M, TRIP_PACE, newsOf, placeName, wayAt,
} from '../src/systems/livingWorld/trips.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { HAZARD, ROAD_HAZARD, hazardOf, roadHits } from '../src/systems/livingWorld/lives.js';
import { DAY_MIN, dayPlan, MARKET_STALL_H, MINSTREL_PLAY_H } from '../src/systems/livingWorld/dayPlan.js';
import { campGroups, passingPairs, partyPlaces, partyLabel, CAMP_SHARE_N, PASS_N, CAMP_RING_N, CAMP_RING_STEP_N, createLivingRoads } from '../src/scenes/livingRoads.js';
import { createRoadStands } from '../src/scenes/roadStands.js';
import { fillLine, ROAD_PASS_SCRIPTS, ROAD_PASS_WARNINGS, MINSTREL_SONGS, minstrelLine, MINSTREL_EVERY_MIN, MINSTREL_UP_MIN, PATROL_HALT_LINES } from '../src/systems/livingWorld/lines.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { FIRE_FLAT } from '../src/systems/survival/camp.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { synthTown } from './lwTown.mjs';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { synthMap } from './lwRoads.mjs';
import { readFileSync } from 'node:fs';

const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/** A small map of the towns given: the planner's way the straight run of pixels between two (lwRoads.mjs's law). */
function miniWorld(towns, { dry = () => true } = {}) {
  const rosters = new Map();
  const world = {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf: (a, b) => {
      const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
      const pixels = [];
      for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
      return { pixels, kinds: pixels.slice(1).map(() => 'road') };
    },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
    dryAt: dry,
  };
  return world;
}
const town = (mapId, px, py, blocks, type = 0, region = 17) => ({ mapId, px, py, blocks, type, region, people: 3, name: `T${mapId}`, port: false });

test('LW9 the census: the road\'s new traffic APPENDED after the first roster (Living World II decision 9), then more of its pedlars, pilgrims and couriers - every id of the first unchanged, a farm one carter, a hamlet or a village one and one more each four blocks to three and a hunter, a city of CITY_COURT_BLOCKS a patrol of two (one more each thirty-two blocks, to four), a noble and two retainers, a city of nine a minstrel; their classes (mutants: each count, the order, the classes)', () => {
  assert.deepEqual([...ROAD_JOBS], ['carter', 'hunter', 'patrol', 'noble', 'retainer', 'minstrel']);
  assert.equal(CITY_COURT_BLOCKS, 16);
  const rows = [[3, 1], [1, 1], [1, 4], [2, 8], [2, 12], [0, 8], [0, 9], [0, 16], [0, 32], [0, 64], [6, 1], [5, 4]].map(([type, blocks]) => roadCounts({ mapId: 1, type, blocks }));
  assert.deepEqual(rows, [
    { carter: 1, hunter: 1, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
    { carter: 1, hunter: 1, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
    { carter: 2, hunter: 1, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
    { carter: 3, hunter: 1, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
    { carter: 3, hunter: 1, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
    { carter: 0, hunter: 0, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
    { carter: 0, hunter: 0, patrol: 0, noble: 0, retainer: 0, minstrel: 1 },
    { carter: 0, hunter: 0, patrol: 2, noble: 1, retainer: 2, minstrel: 1 },
    { carter: 0, hunter: 0, patrol: 3, noble: 1, retainer: 2, minstrel: 1 },
    { carter: 0, hunter: 0, patrol: 4, noble: 1, retainer: 2, minstrel: 1 },
    { carter: 0, hunter: 0, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
    { carter: 0, hunter: 0, patrol: 0, noble: 0, retainer: 0, minstrel: 0 },
  ]);
  const city = town(900, 100, 100, 36, 0);
  const roster = travellerRoster(city);
  const base = sum(travellerCounts(city));
  const first = travellerRoster({ ...city, type: undefined });
  assert.deepEqual(first.slice(0, base).map((r) => [r.id, r.name, r.job]), roster.slice(0, base).map((r) => [r.id, r.name, r.job]), 'every id before the new traffic unchanged');
  assert.ok(roster.slice(0, base).every((r) => TRAVELLER_JOBS.includes(r.job)));
  assert.deepEqual(roster.slice(base).map((r) => `${r.id}:${r.job}`), ['patrol', 'patrol', 'patrol', 'noble', 'retainer', 'retainer', 'minstrel', 'pedlar', 'pedlar', 'pedlar', 'pedlar', 'pilgrim', 'courier'].map((j, i) => `L900.t${base + i}:${j}`));
  assert.deepEqual(first.slice(base).map((r) => r.job), ['pedlar', 'pedlar', 'pedlar', 'pedlar', 'pilgrim', 'courier'], 'more of the road\'s own after the new traffic, whatever the kind of place');
  assert.deepEqual([...MORE_JOBS], ['pedlar', 'pilgrim', 'courier']);
  assert.deepEqual([[1], [2], [4], [9], [36]].map(([blocks]) => moreCounts({ mapId: 1, blocks })), [
    { pedlar: 0, pilgrim: 0, courier: 0 }, { pedlar: 1, pilgrim: 0, courier: 0 }, { pedlar: 1, pilgrim: 1, courier: 0 },
    { pedlar: 1, pilgrim: 1, courier: 1 }, { pedlar: 4, pilgrim: 1, courier: 1 },
  ]);
  for (const r of roster.slice(base, base + 7)) {
    if (r.job === 'patrol') { assert.equal(r.cls, MOBILE_TYPES.Knight); assert.ok(r.level >= 6 && r.level <= 14); }
    else if (r.job === 'retainer') assert.ok(RETAINER_CLASSES.includes(r.cls));
    else if (r.job === 'minstrel') assert.equal(r.cls, MOBILE_TYPES.Bard);
    else assert.equal(r.cls, null, `${r.job} goes unarmed`);
  }
  const farm = travellerRoster(town(901, 100, 100, 2, 3));
  const hunter = farm.find((r) => r.job === 'hunter');
  assert.ok(hunter && HUNTER_CLASSES.includes(hunter.cls));
  assert.equal(farm.find((r) => r.job === 'carter')?.cls, null);
});

test('LW9 the tables and the lives: the road\'s new traffic\'s own pace, cycle, chance, reach and stay beside the first\'s (which stand whole), and its hazard (mutants: each row)', () => {
  assert.deepEqual({ ...ROAD_PACE }, { carter: 0.8, hunter: 1, patrol: 1, noble: 0.85, retainer: 0.85, minstrel: 0.95 });
  // PIN MOVED (AUDIT LW-II F2): a minstrel's cycle six days - at four no trip of theirs ever fitted at the calendar's pace
  assert.deepEqual({ ...ROAD_CYCLE_DAYS }, { carter: 7, hunter: 4, patrol: 6, noble: 20, minstrel: 6 });
  assert.deepEqual({ ...ROAD_TRIP_CHANCE }, { carter: 0.8, hunter: 0.75, patrol: 0.95, noble: 0.6, minstrel: 0.8 });
  // PIN MOVED (AUDIT LW-II E5): a carter's reach what a morning's walk fits (two pixels; its four were never walked)
  assert.deepEqual({ ...ROAD_RANGE_PX }, { carter: [1, 2], hunter: [1, 3], patrol: [3, 12], noble: [6, 18], minstrel: [3, 8] });
  assert.deepEqual({ ...ROAD_STAY_DAYS }, { carter: [0, 0], hunter: [0, 0], patrol: [0, 1], noble: [1, 2], minstrel: [1, 2] });
  assert.deepEqual({ ...ROAD_HAZARD }, { carter: 0.003, hunter: 0.01, patrol: 0.008, noble: 0.004, retainer: 0.008, minstrel: 0.006 });
  assert.equal(hazardOf('merchant'), HAZARD.merchant);
  assert.equal(hazardOf('hunter'), 0.01);
  assert.equal(hazardOf('beggar'), 0);
  // the hunter's hazard is read: over many cycles some hunter dies
  const hunter = travellerRoster(town(902, 50, 50, 1, 1)).find((r) => r.job === 'hunter');
  let hits = 0;
  for (let k = 0; k < 4000; k++) if (roadHits(hunter, k)) hits++;
  assert.ok(hits > 15 && hits < 70, `a hunter's death about one cycle in a hundred (${hits}/4000)`);
});

test('LW9 the ones who ride with another: a patrol rides as one behind its first, a noble\'s retainers dealt to the nobles in slot order, a sellsword its contract merchant as before - their places\' cycles the leader\'s; a patrol\'s round keeps its region, a noble goes to another court, a minstrel to a town of four blocks (mutants: the leader law, the bounds)', () => {
  const city = town(910, 100, 100, 36, 0, 17);
  const world = miniWorld([city, town(911, 105, 100, 20, 0, 17), town(912, 104, 104, 6, 2, 17), town(913, 108, 100, 24, 0, 21), town(914, 112, 100, 30, 0, 17)]);
  const roster = world.rosterOf(city);
  const patrol = roster.filter((r) => r.job === 'patrol');
  const [noble] = roster.filter((r) => r.job === 'noble');
  const retainers = roster.filter((r) => r.job === 'retainer');
  assert.equal(leaderOf(patrol[0], roster), null, 'the first leads');
  for (const p of patrol.slice(1)) assert.equal(leaderOf(p, roster)?.id, patrol[0].id);
  for (const r of retainers) assert.equal(leaderOf(r, roster)?.id, noble.id);
  for (const r of roster.filter((x) => x.job === 'mercenary')) assert.equal(leaderOf(r, roster)?.id, contractOf(r, roster)?.id);
  for (const d of [400, 401, 433]) {
    for (const p of [...patrol.slice(1), ...retainers]) assert.equal(placeCycle(p, roster, d, 1), cycleOf(leaderOf(p, roster), d, 1).k, 'a rider\'s place lives by its leader\'s cycle');
  }
  assert.equal(ownTrip(patrol[1], city, 5, world, O()), null, 'a patrol\'s second never rides alone');
  assert.ok(roadBound('patrol', city, town(1, 0, 0, 4, 2, 17)) && !roadBound('patrol', city, town(1, 0, 0, 4, 2, 21)));
  assert.ok(roadBound('noble', city, town(1, 0, 0, 16, 0)) && !roadBound('noble', city, town(1, 0, 0, 15, 0)) && !roadBound('noble', city, town(1, 0, 0, 30, 2)));
  assert.ok(roadBound('minstrel', city, town(1, 0, 0, 4, 2)) && !roadBound('minstrel', city, town(1, 0, 0, 3, 0)));
  // the parties: a patrol's round all of the patrol, a noble's procession their retainers
  let patrolTrip = null, nobleTrip = null;
  for (let day = 300; day < 420 && (!patrolTrip || !nobleTrip); day++) {
    for (const tr of townTrips(city, day * DAY_MIN + 720, world, O()) ?? []) {
      if (tr.kind === 'patrol') patrolTrip ??= tr;
      if (tr.kind === 'noble') nobleTrip ??= tr;
    }
  }
  assert.ok(patrolTrip && nobleTrip, 'a round and a procession');
  assert.deepEqual(patrolTrip.party.map((m) => m.id), patrol.map((m) => m.id));
  assert.equal(patrolTrip.to.region, 17, 'a round keeps its region');
  assert.deepEqual(nobleTrip.party.map((m) => m.id), [noble.id, ...retainers.map((m) => m.id)]);
  assert.ok(nobleTrip.to.type === 0 && nobleTrip.to.blocks >= CITY_COURT_BLOCKS, 'to another court');
  assert.equal(partyLabel(patrolTrip), `Patrol to ${patrolTrip.to.name}`);
  assert.equal(partyLabel(nobleTrip), `Procession to ${nobleTrip.to.name}`);
});

test('LW9 a carter\'s day to market: the nearest town in reach that keeps a market (a city or a village of four blocks), on its market day (one in seven, by its map id) - out at first light, in by MARKET_IN_H, at the stall till MARKET_OUT_H, home by nightfall; none with no market in reach, the next nearer where the nearest is too far to be in for the market (mutants: the day, the hours, the nearest, the kind)', () => {
  assert.equal(MARKET_IN_H, 12); assert.equal(MARKET_OUT_H, 13.5);
  const farm = town(920, 100, 100, 1, 3);
  const village = town(921, 102, 100, 4, 2), city = town(922, 101, 103, 30, 0), hamlet = town(923, 101, 100, 3, 1), temple = town(924, 100, 101, 8, 5);
  const world = miniWorld([farm, village, city, hamlet, temple]);
  const carter = world.rosterOf(farm).find((r) => r.job === 'carter');
  let made = 0;
  for (let k = 40; k < 120; k++) {
    const trip = ownTrip(carter, farm, k, world, O());
    if (!trip) continue;
    made++;
    assert.equal(trip.market, true);
    assert.equal(trip.to.mapId, village.mapId, 'the nearest market - never a hamlet or a temple');
    const day = Math.floor(trip.outT0 / DAY_MIN);
    assert.ok(marketDay(village, day), 'on its market day');
    assert.ok(trip.outT1 <= day * DAY_MIN + MARKET_IN_H * 60, 'in for the market');
    assert.equal(trip.backT0, day * DAY_MIN + MARKET_OUT_H * 60);
    assert.ok(trip.backT1 <= day * DAY_MIN + WALK_TO_H * 60, 'home the same day');
    assert.equal(partyLabel(trip), `Farmer to ${village.name}'s market`);
  }
  assert.ok(made > 50, `a carter goes to market most weeks (${made}/80)`);
  let days = 0;
  for (let d = 0; d < 70; d++) if (marketDay(village, d)) days++;
  assert.equal(days, 10, 'one day in seven');
  // no market in reach: none
  const lone = town(930, 300, 300, 1, 3);
  const w2 = miniWorld([lone, town(931, 300, 306, 20, 0)]);
  const c2 = w2.rosterOf(lone).find((r) => r.job === 'carter');
  for (let k = 40; k < 50; k++) assert.equal(ownTrip(c2, lone, k, w2, O()), null);
  // a market too far for the morning: the next nearer
  const slow = (k) => marketTrip(carter, farm, k, world, { start: k * 7, len: 7, pace: 0.25 * NATIVE_PIXEL / 60, rng: () => 0.5 });
  assert.equal(slow(60), null, 'two pixels at a quarter of a pixel an hour is no market day');
  assert.equal(marketTrip(carter, farm, 60, world, { start: 420, len: 7, pace: 0.6 * NATIVE_PIXEL / 60, rng: () => 0.5 })?.to.mapId, village.mapId, 'at a better pace, the market');
  // in by noon: a walk of five and a quarter hours would be home by nightfall (half past one and the walk), but in too late
  const walkN = 2 * NATIVE_PIXEL - (4096 + 6144);   // the two pixels less the farm's and the village's trims
  assert.equal(marketTrip(carter, farm, 60, world, { start: 420, len: 7, pace: walkN / 315, rng: () => 0.5 })?.to.mapId ?? null, null, 'five and a quarter hours: too late in');
  assert.equal(marketTrip(carter, farm, 60, world, { start: 420, len: 7, pace: walkN / 270, rng: () => 0.5 })?.to.mapId, village.mapId, 'four and a half: in by noon');
});

test('LW9 a hunter in the wild: a point one to three map pixels off their town on dry ground off every town\'s pixel, the line to it dry where sounded; out at first light, the hunt\'s camp there (out, camped, at its point) till the next morning, home within the cycle; no road under it (`open`), no town at its end; none where all is wet (mutants: the range, the dry, the town, the camp)', () => {
  const hamlet = town(940, 100, 100, 2, 1);
  const world = miniWorld([hamlet]);
  const hunter = world.rosterOf(hamlet).find((r) => r.job === 'hunter');
  let made = 0;
  for (let k = 40; k < 100; k++) {
    const trip = ownTrip(hunter, hamlet, k, world, O());
    if (!trip) continue;
    made++;
    assert.ok(trip.wild && trip.to.mapId === -1 && trip.to.wild, 'no town');
    const d = Math.hypot(trip.wild.x - trip.way.pts[0][0], trip.wild.z - trip.way.pts[0][1]) / NATIVE_PIXEL;
    assert.ok(d >= 1 && d <= 3, `one to three pixels off (${d})`);
    assert.deepEqual(trip.way.kinds, ['open']);
    assert.equal(trip.trim1, 0);
    const mid = Math.floor((trip.outT1 + trip.backT0) / 2);
    const at = partyAt(trip, mid);
    assert.equal(at.phase, 'out'); assert.equal(at.camp, true);
    assert.ok(Math.hypot(at.x - trip.wild.x, at.z - trip.wild.z) < 1, 'at its point');
    assert.ok(trip.backT0 > trip.outT1 && Math.floor(trip.backT0 / DAY_MIN) > Math.floor(trip.outT1 / DAY_MIN), 'a night out');
    assert.equal(partyLabel(trip), 'Hunter in the wild');
  }
  assert.ok(made > 30, `a hunter goes out most cycles (${made}/60)`);
  const wet = miniWorld([hamlet], { dry: () => false });
  for (let k = 40; k < 60; k++) assert.equal(ownTrip(hunter, hamlet, k, wet, O()), null, 'all wet: none');
  // a town on every pixel about: none
  const crowd = [hamlet];
  for (let y = 96; y <= 104; y++) for (let x = 96; x <= 104; x++) if (x !== 100 || y !== 100) crowd.push(town(10000 + y * 100 + x, x, y, 1, 3));
  const full = miniWorld(crowd);
  for (let k = 40; k < 50; k++) assert.equal(wildTrip(hunter, hamlet, k, full, { start: k * 4, len: 4, pace: 300, rng: () => 0.3 }), null);
});

test('LW9 the inn on the road: a roadside tavern within INN_REACH_PX of a way\'s pixels is an inn on it; at nightfall a party walks on to one within INN_AHEAD_N ahead and lodges (`inn`), else it camps on dry ground; the inn\'s guests are those it lodges, in from nightfall, out as their day\'s walk comes up to it; a night lodged meets no trouble at a camp (mutants: the reach, the ahead, the lodging, the guests\' times, the camp\'s trouble)', () => {
  const inn = { mapId: 5, px: 4, py: 0, blocks: 1, type: INN_TYPE, name: 'The Inn' };
  const way = { pts: [[0, 0], [10 * NATIVE_PIXEL, 0]], cum: [0, 10 * NATIVE_PIXEL], len: 10 * NATIVE_PIXEL, kinds: ['road'], inns: [{ s: 4 * NATIVE_PIXEL, town: inn }] };
  assert.equal(INN_AHEAD_N, NATIVE_PIXEL);
  assert.equal(nightStop(way, 3.5 * NATIVE_PIXEL, 1, 0, way.len), 4 * NATIVE_PIXEL, 'ahead within a pixel: the inn');
  assert.equal(nightStop(way, 2.5 * NATIVE_PIXEL, 1, 0, way.len), 2.5 * NATIVE_PIXEL, 'too far ahead: where it stands');
  assert.equal(nightStop(way, 4.5 * NATIVE_PIXEL, 1, 0, way.len), 4.5 * NATIVE_PIXEL, 'behind: not walked back to');
  assert.equal(nightStop(way, 4.5 * NATIVE_PIXEL, -1, 0, way.len), 4 * NATIVE_PIXEL, 'ahead on the way home');
  assert.equal(innAhead(way, 3.5 * NATIVE_PIXEL, 1, 0, 3.9 * NATIVE_PIXEL), null, 'past the leg\'s end: none');
  // a party a day's walk of 3.7 pixels lodges at the inn the first night
  const pace = (3.7 * NATIVE_PIXEL) / ((WALK_TO_H - WALK_FROM_H) * 60);
  const outT0 = 100 * DAY_MIN + WALK_FROM_H * 60;
  const walk = way.len / pace;
  const trip = { id: 'L1.t0:1', kind: 'merchant', leader: { id: 'L1.t0' }, party: [{ id: 'L1.t0' }], from: { mapId: 1 }, to: { mapId: 2 }, way, pace,
    outT0, outT1: whenWalked(outT0, walk), backT0: whenWalked(outT0, walk) + 2000, backT1: whenWalked(whenWalked(outT0, walk) + 2000, walk), trim0: 0, trim1: 0 };
  const night = 100 * DAY_MIN + 23 * 60;
  const at = partyAt(trip, night);
  assert.equal(at.inn?.mapId, inn.mapId, 'lodged at the inn');
  assert.ok(Math.abs(at.s - 4 * NATIVE_PIXEL) < 1);
  const noInn = { ...trip, way: { ...way, inns: undefined, dry: () => true } };
  assert.equal(partyAt(noInn, night).inn, undefined, 'no inn: a camp');
  assert.equal(partyAt(noInn, night).camp, true);
  // innsAlong reads the plan's pixels
  const plan = { pixels: Array.from({ length: 11 }, (_, i) => ({ x: i, y: 0 })) };
  const w = { pts: plan.pixels.map((p) => [p.x * NATIVE_PIXEL, 0]), cum: plan.pixels.map((p) => p.x * NATIVE_PIXEL), len: 10 * NATIVE_PIXEL, kinds: [] };
  const towns = [{ mapId: 1, px: 0, py: 0, blocks: 4, type: 0 }, { mapId: 2, px: 10, py: 0, blocks: 4, type: 0 }, inn, { mapId: 6, px: 7, py: 2, blocks: 1, type: INN_TYPE }, { mapId: 7, px: 8, py: 1, blocks: 1, type: 0 }];
  const tw = { townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r) };
  innsAlong(w, plan, /** @type {any} */ (tw), towns[0], towns[1]);
  assert.deepEqual(w.inns.map((i) => [i.town.mapId, i.s / NATIVE_PIXEL]), [[5, 3]], 'the inn a pixel off its line, where the way first comes within a pixel; never an inn two off, nor a town');
  // the guests, on a map: a city, an inn on the road, a city past it
  const a = town(950, 100, 100, 30, 0), b = town(951, 110, 100, 30, 0), i2 = { ...town(952, 105, 100, 1, INN_TYPE), name: 'Roadside' };
  const world = miniWorld([a, b, i2]);
  let guests = 0;
  for (let day = 300; day < 360; day++) {
    for (const g of innGuestsOf(i2, day, world, O()) ?? []) {
      guests++;
      assert.ok(g.trip.way.inns.some((x) => x.town.mapId === i2.mapId));
      assert.equal(partyAt(g.trip, g.inT).inn?.mapId, i2.mapId, 'in when it lodges');
      assert.ok(g.inT % DAY_MIN >= WALK_TO_H * 60 || g.inT % DAY_MIN < WALK_FROM_H * 60, 'in from nightfall');
      // PIN MOVED (AUDIT LW-II E2): out as the party leaves - its day's walk come up to the inn, past first light (before,
      // out at first light, and nowhere till the walk came up)
      assert.ok(g.outT % DAY_MIN >= WALK_FROM_H * 60 && g.outT % DAY_MIN < WALK_TO_H * 60, 'out by day');
      assert.equal(partyAt(g.trip, g.outT - 1).inn?.mapId, i2.mapId, 'lodged till it goes');
      assert.notEqual(partyAt(g.trip, g.outT).inn?.mapId, i2.mapId, 'gone when it goes');
    }
  }
  assert.ok(guests > 0, 'the inn has guests');
  // a night lodged meets no trouble at a camp
  const tw2 = { climateAt: () => 230, foesOf: ({ size }) => Array(size).fill(1), dies: () => false };
  let camps = 0;
  for (let day = 300; day < 400; day++) {
    for (const tr of townTrips(a, day * DAY_MIN, world, O()) ?? []) {
      const enc = troubleOf(tr, tw2);
      if (!enc?.camp) continue;
      camps++;
      assert.equal(innAhead(tr.way, enc.s, enc.leg === 'out' ? 1 : -1, tr.trim0, tr.way.len - tr.trim1), null, 'no camp trouble where the night is an inn\'s');
    }
  }
  assert.ok(camps > 0, 'a night camped met trouble somewhere');   // AUDIT LW-II F6: never a vacuous `>= 0`
});

test('LW9 the patrol keeps the road: a trip from or to a town a patrol\'s round went from or to within PATROL_COVER_DAYS of it is covered, its trouble PATROL_RISK as likely - never more of it (mutants: the window, the ends, the risk)', () => {
  assert.equal(PATROL_RISK, 0.5); assert.equal(PATROL_COVER_DAYS, 2);
  const tw = (covered) => ({ climateAt: () => 230, foesOf: ({ size }) => Array(size).fill(1), dies: () => false, covered: () => covered });
  const city = town(960, 100, 100, 36, 0, 17), other = town(961, 106, 100, 12, 0, 17), far = town(962, 140, 140, 12, 0, 17), far2 = town(963, 146, 140, 12, 0, 17);
  const side = town(964, 96, 104, 8, 2, 21);   // within a round's reach of the city, another region's: never its round's
  const world = miniWorld([city, other, far, far2, side]);
  let lowered = 0;
  for (let day = 300; day < 600; day += 3) {
    for (const tr of townTrips(far, day * DAY_MIN, world, O()) ?? []) {
      const open = troubleOf(tr, tw(false)), kept = troubleOf(tr, tw(true));
      if (open && !kept) lowered++;
      assert.ok(!kept || open, 'cover never brings trouble');
    }
  }
  assert.ok(lowered > 0, 'a covered road meets less trouble');
  // the cover itself: a trip from the patrol's own town while its round walks
  const o = O();
  const first = world.rosterOf(city).find((r) => r.job === 'patrol');
  let checked = 0;
  for (let k = 60; k < 90 && checked < 3; k++) {
    const round = memoTrip(first, city, k, world, o);
    if (!round) continue;
    const covered = { id: 'x', from: city, to: other, outT0: round.outT0 + 60, backT1: round.outT0 + 600, party: [] };
    assert.equal(patrolCover(covered, world, o), true, 'from the round\'s own town while it walks');
    const late = { ...covered, outT0: round.backT1 + (PATROL_COVER_DAYS + 1) * DAY_MIN, backT1: round.backT1 + (PATROL_COVER_DAYS + 2) * DAY_MIN };
    const next = memoTrip(first, city, k + 1, world, o);
    if (!next || next.outT0 > late.backT1) assert.equal(patrolCover(late, world, o), false, 'long after the round, and before the next: not');
    const away = { id: 'y', from: far, to: far2, outT0: round.outT0 + 60, backT1: round.outT0 + 600, party: [] };
    assert.equal(patrolCover(away, world, o), false, 'another road: not');
    const beside = { id: 'z', from: side, to: far, outT0: round.outT0 + 60, backT1: round.outT0 + 600, party: [] };
    assert.equal(patrolCover(beside, world, o), false, 'a road the round neither left from nor went to, beside its town: not');
    checked++;
  }
  assert.ok(checked > 0);
});

test('LW9 the night\'s camps shared round one fire: camps within CAMP_SHARE_N one camp at the earliest party\'s place, every one of them a place in its ring in order (the ring grown past four); a fire at every camp, one to a shared camp, none on the march (mutants: the reach, the order, the ring, the fire)', () => {
  assert.equal(CAMP_SHARE_N, 2400);
  const party = (id, n) => ({ id, party: Array.from({ length: n }, (_, i) => ({ id: `${id}.${i}`, cls: null })), way: { pts: [[0, 0], [1, 0]], cum: [0, 1], len: 1, kinds: [] } });
  const A = { trip: party('a', 2), at: { x: 0, z: 0, camp: true } }, B = { trip: party('b', 3), at: { x: 1200, z: 0, camp: true } }, C = { trip: party('c', 1), at: { x: 9000, z: 0, camp: true } };
  const g = campGroups([C, B, A]);
  assert.deepEqual(g.get('a'), { x: 0, z: 0, i0: 0, n: 5, first: true });
  assert.deepEqual(g.get('b'), { x: 0, z: 0, i0: 2, n: 5, first: false });
  assert.deepEqual(g.get('c'), { x: 9000, z: 0, i0: 0, n: 1, first: true });
  const places = [...partyPlaces(A.trip, A.at, g.get('a')), ...partyPlaces(B.trip, B.at, g.get('b'))];
  const r = CAMP_RING_N + 1 * CAMP_RING_STEP_N;
  for (const p of places) assert.ok(Math.abs(Math.hypot(p.x, p.z) - r) < 1e-6, 'on the one ring');
  assert.equal(new Set(places.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`)).size, 5, 'each a place of its own');
  // the roads' layer draws a fire at a camp
  const city = town(970, 100, 100, 30, 0), b = town(971, 108, 100, 30, 0);
  const world = miniWorld([city, b]);
  const lists = [];
  const sprites = { sync: (list) => { lists.push(list.map((m) => ({ ...m }))); }, batches: () => [], persons: () => [], bodyOf: () => null, clear: () => {} };
  let found = false;
  for (let day = 300; day < 340 && !found; day++) {
    const t = day * DAY_MIN + 23 * 60;
    for (const tr of townTrips(city, t, world, O()) ?? []) {
      const at = partyAt(tr, t);
      if ((at.phase !== 'out' && at.phase !== 'back') || !at.camp || at.halt || at.inn) continue;
      const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => t, baseRate: () => CLASSIC_MINUTES_PER_SECOND, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => ({ x: at.x, z: at.z }), sprites: /** @type {any} */ (sprites), relations: () => createRelations() });
      roads.frame(1 / 30, [at.x / 40, 1.6, at.z / 40]);
      const list = lists[lists.length - 1];
      const fire = list.find((m) => m.key === `fire:${tr.id}`) ?? list.find((m) => /^fire:/.test(m.key));
      assert.ok(fire, 'a fire at the camp');
      assert.deepEqual(fire.flat, FIRE_FLAT);
      assert.equal(fire.talk, false);
      found = true;
      break;
    }
  }
  assert.ok(found, 'a camp read');
});

test('LW9 the parties passing: two walking within PASS_N pass with a word each - the road\'s, or a warning where either has met trouble behind it, its foe named; farther, none; the pair dealt once, the lower trip id first (mutants: the reach, the pool, the order)', () => {
  assert.equal(PASS_N, 1000);
  const tr = (id, enc = null) => ({ id, enc, party: [{ id: `${id}.0` }] });
  const pairs = passingPairs([{ trip: tr('b'), at: { x: 800, z: 0 } }, { trip: tr('a'), at: { x: 0, z: 0 } }, { trip: tr('c'), at: { x: 5000, z: 0 } }], 1000);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].a.trip.id, 'a');
  assert.ok(ROAD_PASS_SCRIPTS.includes(pairs[0].script));
  const warned = passingPairs([{ trip: tr('a', { t1: 900, foes: [7] }), at: { x: 0, z: 0 } }, { trip: tr('b'), at: { x: 500, z: 0 } }], 1000);
  assert.ok(ROAD_PASS_WARNINGS.includes(warned[0].script));
  assert.equal(warned[0].warned.trip.id, 'a');
  const before = passingPairs([{ trip: tr('a', { t1: 1100, foes: [7] }), at: { x: 0, z: 0 } }, { trip: tr('b'), at: { x: 500, z: 0 } }], 1000);
  assert.ok(ROAD_PASS_SCRIPTS.includes(before[0].script), 'a trouble not yet met is no warning');
});

test('LW9 the law beyond the walls: a patrol\'s knight the host names wanted draws on the player within DRAW_M with the law\'s word - whatever their regard; nobody else for it (mutants: the halt, the reach)', () => {
  const said = [];
  const spawned = [];
  const stands = createRoadStands({
    spawn: async (type, feet, o) => { spawned.push({ type, o }); return { entity: {}, dead: false }; },
    remove: () => {}, inPool: () => true, ready: () => true, sceneOf: (x, z) => [x, 0, z], relations: () => createRelations(),
    slay: () => {}, died: () => {}, fighting: () => false, say: (t) => said.push(t),
    wanted: (res) => (res.job === 'patrol' ? PATROL_HALT_LINES[0] : null),
  });
  const knight = { id: 'L1.t9', job: 'patrol', cls: MOBILE_TYPES.Knight, level: 8, name: 'Sir Ada Lark' };
  const sword = { id: 'L1.t3', job: 'mercenary', cls: MOBILE_TYPES.Warrior, level: 8, name: 'Bo Fenn' };
  const trip = { id: 'L1.t9:4', party: [knight, sword] };
  stands.frame([{ res: knight, trip, x: 40 * 30, z: 0 }, { res: sword, trip, x: 40 * 30, z: 0 }], { x: 0, z: 0 }, 1000);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].o.allied, false);
  assert.equal(said[0], `Sir: "${PATROL_HALT_LINES[0]}"`);
  const far = createRoadStands({ spawn: async () => { throw new Error('none'); }, remove: () => {}, inPool: () => true, ready: () => true, sceneOf: (x, z) => [x, 0, z], relations: () => createRelations(), slay: () => {}, died: () => {}, fighting: () => false, wanted: () => 'Halt!' });
  far.frame([{ res: knight, trip, x: 40 * 60, z: 0 }], { x: 0, z: 0 }, 1000);
  assert.equal(far.size, 0, 'past DRAW_M: no halt');
});

test('LW9 the days: a carter come to market keeps a stall from MARKET_STALL_H; a minstrel plays a tavern of an evening (MINSTREL_PLAY_H) away and at home; at home a carter and a hunter work the fields, a patrol\'s and a retainer\'s a sellsword\'s day, a noble a courtier\'s; a minstrel\'s song every MINSTREL_EVERY_MIN, up MINSTREL_UP_MIN of it, the same for every reader (mutants: the stall, the evening, the aliases, the song\'s beat)', () => {
  assert.deepEqual([...MARKET_STALL_H], [8, 13.5]);
  assert.deepEqual([...MINSTREL_PLAY_H], [18.5, 23]);
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 9, region: 17, people: 3 }, buildings);
  const home = census.find((r) => r.home != null && places.doors.get(r.home));
  const mpm = CALENDAR_MPM;
  const day = 200;
  const D0 = day * DAY_MIN + 240;
  const as = (job) => ({ ...home, job, cls: null });
  const visit = (job, out = 20) => dayPlan(as(job), places, day, { mpm, visitor: true, home: places.doors.get(home.home), away: [{ t0: D0 - DAY_MIN, t1: D0 + 5.5 * 60, exit: places.exits[0] ?? null, armed: false }, { t0: D0 + out * 60, t1: D0 + 2 * DAY_MIN, exit: places.exits[0] ?? null, armed: false }] });
  const stall = visit('carter', 13).filter((e) => e.kind === 'stall');   // in at half past nine, out at five
  assert.ok(stall.length, 'a carter at market keeps a stall');
  assert.ok(stall[0].t0 <= D0 + 9 * 60 && stall.every((e) => e.t1 <= D0 + 13 * 60), 'from their coming in, till they go');
  const evening = visit('minstrel').filter((e) => e.kind === 'tavern');
  assert.ok(evening.some((e) => e.t0 >= D0 + 14 * 60 && e.t0 <= D0 + 15 * 60), 'a minstrel plays the tavern from half past six');
  const at = (job) => dayPlan(as(job), places, day, { mpm }).map((e) => e.kind);
  assert.ok(at('carter').includes('fields') && at('hunter').includes('fields'), 'a carter and a hunter work the fields at home');
  assert.deepEqual(at('patrol'), dayPlan(as('mercenary'), places, day, { mpm }).map((e) => e.kind), 'a patrol\'s a sellsword\'s day');
  assert.deepEqual(at('noble'), dayPlan(as('courtier'), places, day, { mpm }).map((e) => e.kind), 'a noble a courtier\'s');
  assert.ok(at('minstrel').includes('tavern'));
  // the song
  assert.equal(MINSTREL_EVERY_MIN, 4); assert.equal(MINSTREL_UP_MIN, 1.5);
  const res = { id: 'L1.t20' };
  assert.ok(MINSTREL_SONGS.map((x) => fillLine(x, {})).includes(minstrelLine(res, 400) ?? ''), 'a song at its beat');
  assert.equal(minstrelLine(res, 401.6), null, 'between songs');
  assert.equal(minstrelLine(res, 400), minstrelLine({ id: 'L1.t20' }, 400.5));
  let differ = false;
  for (let k = 0; k < 12 && !differ; k++) differ = minstrelLine(res, k * 4) !== minstrelLine(res, (k + 1) * 4);
  assert.ok(differ, 'another song another beat');
});

test('LW9 the host: the roads\' trouble world reads the patrol\'s cover, the town\'s visitors take the inn\'s guests at a roadside tavern, the stands the patrol\'s halt by the region\'s law; the layer keeps a lodged party out of the open (mutants: each seam)', async () => {
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /covered: \(trip\) => livingCovered\(patrolCover\(trip, livingTripWorld/);   // PIN MOVED (AUDIT LW-II E1): a cover waiting on a round's way waits
  assert.match(w, /town\.type === INN_TYPE \? innGuestsOf\(town, day, livingTripWorld, o\)/);
  assert.match(w, /wanted: \(res, trip\) => \(res\.job === 'patrol' && trip\?\.from\?\.region != null && knownCriminal\(playerEntity, trip\.from\.region/);
  const r = readFileSync(new URL('../src/scenes/livingRoads.js', import.meta.url), 'utf8');
  assert.match(r, /if \(at\.inn\) continue;   \/\/ LW9: lodged at the inn on the road/);
  assert.equal(paceScale(CALENDAR_MPM), 1);
});

// ═══ AUDIT LW-II (2026-10-10): LW9's findings, each pinned ═══

/** The host's trouble as world.js composes it - troubleOf with the patrol's cover, a cover waiting on a round's way no
 *  answer (undefined: townTrips waits), each trip's trouble kept once known (world.js `_livingFates`). */
const hostFate = (world, o, tw) => {
  const kept = new Map();
  return (trip) => {
    let f = kept.get(trip.id);
    if (!f) {
      let pending = false;
      const enc = troubleOf(trip, { ...tw, covered: (tr) => { const c = patrolCover(tr, world, o); if (c === undefined) pending = true; return !!c; } });
      if (pending) return undefined;
      f = troubledTrip(trip, enc);
      kept.set(trip.id, f);
    }
    return f;
  };
};

test('AUDIT LW-II LW9: the patrol\'s cover waits on its rounds\' ways - undefined while one is asked and none known covers, and the trouble that read it is no answer (never kept: townTrips waits as for a way); so every reader\'s trouble is the same however late its rounds were asked; the patrol cities about either end (mutants: E1 the pending, E1 the wait, E10 the far end)', () => {
  const tw = { climateAt: () => 230, foesOf: ({ size }) => Array(size).fill(1), dies: () => false };
  const city = town(960, 100, 100, 36, 0, 17), other = town(961, 106, 100, 12, 0, 17), third = town(965, 103, 105, 12, 0, 17);
  const far = town(962, 140, 140, 12, 0, 17), far2 = town(963, 146, 140, 12, 0, 17);
  const towns = [city, other, third, far, far2];
  const world = miniWorld(towns);
  const patrolPair = (a, b) => a.mapId === city.mapId || b.mapId === city.mapId;
  // the cover itself, its rounds' ways not yet asked: no answer; asked, the answer
  const o = O();
  const first = world.rosterOf(city).find((r) => r.job === 'patrol');
  let round = null;
  for (let k = 60; k < 90 && !round; k++) round = memoTrip(first, city, k, world, o);
  assert.ok(round, 'a round');
  const covered = { id: 'x', from: city, to: other, outT0: round.outT0 + 60, backT1: round.outT0 + 600, party: [] };
  const unasked = { ...world, routeOf: (a, b) => (patrolPair(a, b) ? undefined : world.routeOf(a, b)) };
  assert.equal(patrolCover(covered, unasked, O()), undefined, 'a round\'s way not yet asked: no answer');
  assert.equal(patrolCover(covered, world, O()), true, 'asked: covered');
  assert.equal(patrolCover({ ...covered, id: 'y', from: far, to: far2 }, unasked, O()), false, 'no patrol city about either end: no cover, and nothing to wait on');
  // E10: a trip from beyond a round's reach TO the patrol's own city - its cities read about the far end too
  assert.ok(Math.max(Math.abs(far.px - city.px), Math.abs(far.py - city.py)) > ROAD_RANGE_PX.patrol[1]);
  assert.equal(patrolCover({ ...covered, id: 'w', from: far, to: city }, world, O()), true, 'the round\'s own city at the far end: covered');
  // townTrips waits on a trouble that waits - nothing kept, the trips read once it is known
  let wait = true;
  const waiting = { ...world, fate: (tr) => (wait ? undefined : tr) };
  const ow = O();
  assert.equal(townTrips(other, 320 * DAY_MIN + 720, waiting, ow), undefined, 'a trouble waiting: no trips yet');
  wait = false;
  assert.deepEqual(townTrips(other, 320 * DAY_MIN + 720, waiting, ow)?.map((tr) => tr.id), townTrips(other, 320 * DAY_MIN + 720, world, O())?.map((tr) => tr.id), 'then the trips, none kept from the wait');
  // TWO READERS: one whose rounds' ways come late (the frame's asking spent - the third time a pair is asked), one whose
  // are known; each reads every frame till the town answers, its trouble kept as the host keeps it
  const asks = new Map();
  const late = { ...world, routeOf: (a, b) => { const key = `${a.mapId}>${b.mapId}`; const n = (asks.get(key) ?? 0) + 1; asks.set(key, n); return patrolPair(a, b) && n < 3 ? undefined : world.routeOf(a, b); } };
  const oA = O(), oB = O();
  late.fate = hostFate(late, oA, tw);
  const known = { ...world };
  known.fate = hostFate(known, oB, tw);
  const encOf = (tr) => (tr.enc ? `${tr.enc.kind}@${Math.round(tr.enc.t0)}` : 'none');
  let compared = 0, sensitive = 0;
  for (let day = 300; day < 420; day += 2) {
    for (const tn of [other, third, city]) {
      const t = day * DAY_MIN + 720;
      let a;
      for (let i = 0; i < 40 && (a = townTrips(tn, t, late, oA)) === undefined; i++);
      const b = townTrips(tn, t, known, oB);
      assert.ok(a && b, 'every reader answers in the end');
      const byId = new Map(b.map((tr) => [tr.id, tr]));
      for (const tr of a) {
        const twin = byId.get(tr.id);
        if (!twin) continue;
        compared++;
        assert.equal(encOf(tr), encOf(twin), `${tr.id}: the same trouble for every reader`);
        if (patrolCover(twin, world, O()) && !!troubleOf(twin, { ...tw, covered: () => false }) !== !!troubleOf(twin, { ...tw, covered: () => true })) sensitive++;
      }
    }
  }
  assert.ok(compared > 50 && sensitive > 0, `trips compared ${compared}, of them the cover's to decide ${sensitive}`);
});

test('AUDIT LW-II LW9: the inn\'s guests - every night a party lodges at the inn it is the inn\'s guest, however late it came in (the night sounded from nightfall to first light, the online pace\'s half the calendar\'s), in to the minute it lodged and out to the minute it goes; each guest once, a party lodged two nights (mutants: E2 the night, E2 the minute, E2 the going, E6 the once)', () => {
  const a = town(950, 100, 100, 30, 0), b = town(951, 110, 100, 30, 0), inn = { ...town(952, 105, 100, 1, INN_TYPE), name: 'Roadside' };
  let lateIn = 0, lodgings = 0;
  for (const mpm of [CALENDAR_MPM, CALENDAR_MPM / 2]) {
    const world = miniWorld([a, b, inn]);
    const o = { mpm, memo: new Map() };
    const seen = new Set();
    for (let day = 300; day < 420; day++) {
      for (const from of [a, b]) {
        for (const tr of townTrips(from, day * DAY_MIN + 22 * 60, world, o) ?? []) {
          if (!tr.way.inns?.some((x) => x.town.mapId === inn.mapId) || seen.has(`${tr.id}@${day}`)) continue;
          // the first minute of the night it is at the inn, sounded every ten minutes
          let m = day * DAY_MIN + WALK_TO_H * 60;
          while (m < (day + 1) * DAY_MIN + WALK_FROM_H * 60 && partyAt(tr, m).inn?.mapId !== inn.mapId) m += 10;
          if (m >= (day + 1) * DAY_MIN + WALK_FROM_H * 60) continue;
          seen.add(`${tr.id}@${day}`);
          lodgings++;
          if (m % DAY_MIN >= 23 * 60 || m % DAY_MIN < WALK_FROM_H * 60) lateIn++;
          const living = Math.floor((m - 240) / DAY_MIN);
          const g = (innGuestsOf(inn, living, world, o) ?? []).find((x) => x.trip.id === tr.id);
          assert.ok(g, `${tr.id}: lodged at ${m % DAY_MIN} on day ${day}, the inn's guest`);
          assert.ok(g.inT <= m && g.inT > m - 10, 'in to the minute it lodged');
          assert.equal(partyAt(tr, g.inT).inn?.mapId, inn.mapId);
          assert.notEqual(partyAt(tr, g.inT - 1).inn?.mapId, inn.mapId, 'not a minute before');
          assert.equal(partyAt(tr, g.outT - 1).inn?.mapId, inn.mapId, 'lodged till it goes');
          assert.notEqual(partyAt(tr, g.outT).inn?.mapId, inn.mapId, 'and gone');
        }
      }
      const ids = (innGuestsOf(inn, day, world, o) ?? []).map((x) => x.res.id);
      assert.equal(new Set(ids).size, ids.length, 'each guest once');
    }
  }
  assert.ok(lodgings > 20 && lateIn > 0, `${lodgings} nights lodged, ${lateIn} of them in after eleven`);
  // E6: a party held a whole day by the inn (a halt from first light to nightfall, where it stood) lodges there two nights
  const world = miniWorld([a, b, inn]);
  const half = () => ({ mpm: CALENDAR_MPM / 2, memo: new Map() });
  const o = half();
  let base = null;
  for (let day = 300; day < 420 && !base; day++) {
    for (const tr of townTrips(a, day * DAY_MIN + 22 * 60, world, o) ?? []) {
      if (partyAt(tr, day * DAY_MIN + 23 * 60).inn?.mapId === inn.mapId && tr.outT1 > (day + 2) * DAY_MIN && tr.party.length) { base = { tr, day }; break; }
    }
  }
  assert.ok(base, 'a party lodged at the inn on its way out, a long walk on');
  const { day } = base;
  const s = /** @type {number} */ (partyAt(base.tr, day * DAY_MIN + WALK_TO_H * 60).s);
  const held = { ...base.tr, halt: { t0: (day + 1) * DAY_MIN + WALK_FROM_H * 60, t1: (day + 1) * DAY_MIN + WALK_TO_H * 60, fightEnd: (day + 1) * DAY_MIN + WALK_FROM_H * 60 + 10, s, leg: /** @type {'out'} */ ('out') } };
  assert.equal(partyAt(held, day * DAY_MIN + 23 * 60).inn?.mapId, inn.mapId, 'the first night at the inn');
  assert.equal(partyAt(held, (day + 1) * DAY_MIN + 23 * 60).inn?.mapId, inn.mapId, 'and the second');
  const twice = { ...world, fate: (tr) => (tr.id === held.id ? held : tr) };
  const guests = innGuestsOf(inn, day + 1, twice, half()) ?? [];
  const mine = guests.filter((x) => x.trip.id === held.id);
  assert.equal(mine.length, held.party.length, 'each of the party once');
  assert.equal(new Set(mine.map((x) => x.res.id)).size, mine.length);
  // a party camped just past the inn, turned home by a trouble at its camp at eleven, walks back to it in the dark
  let past = null;
  for (let d = 300; d < 420 && !past; d++) {
    for (const tr of townTrips(a, d * DAY_MIN + 22 * 60, world, o) ?? []) {
      const at = partyAt(tr, d * DAY_MIN + 22 * 60);
      const innS = tr.way.inns?.find((x) => x.town.mapId === inn.mapId)?.s;
      if (at.phase === 'out' && at.camp && !at.inn && innS != null && at.s > innS && at.s - innS < INN_AHEAD_N && tr.party.length) { past = { tr, d, s: at.s }; break; }
    }
  }
  assert.ok(past, 'a party camped a little past the inn');
  const t0 = past.d * DAY_MIN + 23 * 60;
  const turned = { ...past.tr, turned: true, halt: { t0, t1: t0 + 30, fightEnd: t0 + 10, s: past.s, leg: /** @type {'out'} */ ('out') } };
  let back = t0 + 30;
  while (back < (past.d + 1) * DAY_MIN + WALK_FROM_H * 60 && partyAt(turned, back).inn?.mapId !== inn.mapId) back += 5;
  assert.ok(back < (past.d + 1) * DAY_MIN + WALK_FROM_H * 60, 'lodged at the inn behind it before the light');
  const g = (innGuestsOf(inn, Math.floor((back - 240) / DAY_MIN), { ...world, fate: (tr) => (tr.id === turned.id ? turned : tr) }, half()) ?? []).filter((x) => x.trip.id === turned.id);
  assert.equal(g.length, turned.party.length, 'the inn\'s guests, its camp reached first');
  assert.ok(g[0].inT > t0 && g[0].inT <= back);
});

test('AUDIT LW-II LW9: a party setting out before first light is at home till it walks, and walks from the light out of its town\'s edge - no camp, no inn reached in the dark; a carter\'s reach what a morning\'s walk fits; the wild no town of the talk or the news (mutants: E5 the home, E5 the light, E7 the place)', () => {
  // the carters: out at five or six, home till seven, then out of the farm's edge walking
  const farm = town(920, 100, 100, 1, 3), village = town(921, 102, 100, 4, 2);
  const world = miniWorld([farm, village]);
  const carter = world.rosterOf(farm).find((r) => r.job === 'carter');
  let made = 0;
  for (let k = 40; k < 80; k++) {
    const tr = ownTrip(carter, farm, k, world, O());
    if (!tr) continue;
    made++;
    const light = Math.floor(tr.outT0 / DAY_MIN) * DAY_MIN + WALK_FROM_H * 60;
    assert.ok(tr.outT0 < light, 'out before first light');
    for (let t = tr.outT0; t < light; t += 7) assert.deepEqual(partyAt(tr, t), { phase: 'home' }, 'home till the light - no camp at the farm\'s edge');
    const at = partyAt(tr, light);
    assert.equal(at.phase, 'out'); assert.equal(at.camp, false);
    assert.ok(Math.abs(at.s - tr.trim0) < 1e-6, 'from its edge');
  }
  assert.ok(made > 20, `${made} market days`);
  // an inn half a pixel past the town's edge is not reached in the dark: at first light the party sets out from its edge
  const innT = { mapId: 5, px: 1, py: 0, blocks: 1, type: INN_TYPE, name: 'The Inn' };
  const way = { pts: [[0, 0], [10 * NATIVE_PIXEL, 0]], cum: [0, 10 * NATIVE_PIXEL], len: 10 * NATIVE_PIXEL, kinds: ['road'], inns: [{ s: 4096 + NATIVE_PIXEL / 2, town: innT }] };
  const pace = 0.85 * CALENDAR_MPM * NATIVE_PER_M, outT0 = 100 * DAY_MIN + 5 * 60 + 30;
  const trip = { id: 'L1.t0:1', kind: 'merchant', leader: { id: 'L1.t0' }, party: [{ id: 'L1.t0' }], from: { mapId: 1 }, to: { mapId: 2 }, way, pace, trim0: 4096, trim1: 4096,
    outT0, outT1: whenWalked(outT0, (way.len - 8192) / pace), backT0: whenWalked(outT0, (way.len - 8192) / pace) + 2000, backT1: whenWalked(outT0, (way.len - 8192) / pace) + 4000 };
  assert.deepEqual(partyAt(trip, 100 * DAY_MIN + 6 * 60 + 50), { phase: 'home' });
  const dawn = partyAt(trip, 100 * DAY_MIN + WALK_FROM_H * 60 + 5);
  assert.equal(dawn.inn, undefined, 'no inn reached in the dark');
  assert.equal(dawn.camp, false, 'walking');
  assert.ok(Math.abs(dawn.s - (4096 + 5 * pace)) < 1e-6, 'five minutes out of its edge');
  // a carter's reach: the farthest market a morning's walk reaches by MARKET_IN_H at a carter's pace, whatever the towns near
  const all = (towns) => ({ ...miniWorld(towns), townsNear: () => towns });
  const fits = (dx) => {
    const v = town(931, 100 + dx, 100, 4, 2);
    let n = 0;
    for (let k = 40; k < 60; k++) if (marketTrip(carter, farm, k, all([farm, v]), { start: k * 7, len: 7, pace: ROAD_PACE.carter * CALENDAR_MPM * NATIVE_PER_M, rng: () => 0.5 })) n++;
    return n > 0;
  };
  assert.ok(fits(ROAD_RANGE_PX.carter[1]) && !fits(ROAD_RANGE_PX.carter[1] + 1), 'the reach walked, and no farther');
  // the wild: no place of the talk, nor of the news (its town's: '' - the talk's own fallback)
  const hamlet = town(940, 100, 100, 2, 1);
  const hw = miniWorld([hamlet]);
  const hunter = hw.rosterOf(hamlet).find((r) => r.job === 'hunter');
  let wild = null;
  for (let k = 40; k < 80 && !wild; k++) wild = ownTrip(hunter, hamlet, k, hw, O());
  assert.ok(wild?.wild && wild.to.mapId === -1);
  assert.equal(placeName(wild.to), '', 'the wild is no place');
  assert.equal(placeName(hamlet), hamlet.name);
  const enc = { id: `${wild.id}:e`, kind: 'driven', foes: [7], t0: wild.outT1, t1: wild.outT1 + 30 };
  assert.deepEqual(newsOf([{ ...wild, enc }], wild.backT1 + 60).map((n) => n.place), [''], 'nor of the news');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const places = \[\.\.\.new Set\(\[\.\.\.trips, \.\.\.told\]\.map\(\(tr\) => placeName\(tr\.to\)\)\.filter\(Boolean\)\)\]\.sort\(\);/, 'the talk\'s towns of the road');
});

test('AUDIT LW-II LW9: the road\'s new traffic\'s own tables read - each job\'s reach (ROAD_RANGE_PX), stay (ROAD_STAY_DAYS), pace (ROAD_PACE) and cycle (ROAD_CYCLE_DAYS); a minstrel travels at the calendar\'s pace; a rider the road takes sends the patrol\'s round out (mutants: F1 each read, F2 the minstrel\'s cycle, F2 the rider)', () => {
  const home = town(1300, 100, 100, 36, 0, 17);
  const courtNear = town(1301, 104, 100, 20, 0, 17), courtFar = town(1302, 114, 100, 20, 0, 17);
  const v5 = town(1303, 100, 105, 6, 2, 17), v10 = town(1304, 100, 90, 6, 2, 17);
  const world = miniWorld([home, courtNear, courtFar, v5, v10]);
  const roster = world.rosterOf(home);
  const cheb = (t) => Math.max(Math.abs(t.px - home.px), Math.abs(t.py - home.py));
  const seen = { patrolStay0: 0, nobleStay2: 0, nobleFar: 0, minstrel: 0, minstrelStay2: 0, minstrelCal: 0 };
  for (const mpm of [CALENDAR_MPM, CALENDAR_MPM / 2]) {
    const scale = paceScale(mpm);
    for (const res of roster) {
      if (!['patrol', 'noble', 'minstrel'].includes(res.job) || leaderOf(res, roster)) continue;
      const [lo, hi] = ROAD_RANGE_PX[res.job];
      const [sLo, sHi] = ROAD_STAY_DAYS[res.job];
      for (let k = 30; k < 90; k++) {
        const tr = ownTrip(res, home, k, world, { mpm, memo: new Map() });
        if (!tr) continue;
        assert.ok(cheb(tr.to) >= lo && cheb(tr.to) <= hi, `${res.job} to a town in its reach (${cheb(tr.to)})`);
        assert.equal(tr.pace, ROAD_PACE[res.job] * mpm * NATIVE_PER_M, `${res.job} at its own pace`);
        const len = Math.max(2, Math.round(ROAD_CYCLE_DAYS[res.job] * scale));
        const cyc = cycleOf(res, Math.floor(tr.outT0 / DAY_MIN), scale);
        assert.equal(cyc.len, len); assert.equal(cyc.k, k, 'in its own cycle');
        assert.ok(tr.backT1 <= (cyc.start + len) * DAY_MIN + 240, 'home inside it');
        const stay = Math.floor(tr.backT0 / DAY_MIN) - Math.floor(tr.outT1 / DAY_MIN);
        if (tr.backT0 - tr.outT1 === 120) { assert.equal(sLo, 0, 'no stay: the job\'s may be none'); if (res.job === 'patrol') seen.patrolStay0++; }
        else assert.ok(stay >= Math.max(1, sLo) && stay <= sHi, `${res.job} stays ${stay} days`);
        if (res.job === 'noble' && stay === 2) seen.nobleStay2++;
        if (res.job === 'noble' && cheb(tr.to) > 12) seen.nobleFar++;
        if (res.job === 'minstrel') { seen.minstrel++; if (stay === 2) seen.minstrelStay2++; if (mpm === CALENDAR_MPM) seen.minstrelCal++; }
      }
    }
  }
  assert.ok(Object.values(seen).every((n) => n > 0), JSON.stringify(seen));
  // the carter's and the hunter's own laws walk at their own pace too
  const farm = town(920, 100, 100, 1, 3), village = town(921, 102, 100, 4, 2);
  const fw = miniWorld([farm, village]);
  for (const job of ['carter', 'hunter']) {
    const res = fw.rosterOf(farm).find((r) => r.job === job);
    let n = 0;
    for (let k = 40; k < 70; k++) { const tr = ownTrip(res, farm, k, fw, O()); if (tr) { n++; assert.equal(tr.pace, ROAD_PACE[job] * CALENDAR_MPM * NATIVE_PER_M); } }
    assert.ok(n > 5, `${job} trips`);
  }
  assert.notEqual(ROAD_PACE.carter, TRIP_PACE.pedlar ?? 1);
  // F2: a patrol's rider the road takes this cycle sends the round out, whatever its first's chance said
  const patrol = roster.filter((r) => r.job === 'patrol');
  const [firstP, rider] = patrol;
  let sent = 0;
  for (let k = 30; k < 400; k++) {
    if (ownTrip(firstP, home, k, { ...world, fated: () => false }, O())) continue;   // its own chance went, or no town fits
    const forced = ownTrip(firstP, home, k, { ...world, fated: (r) => r.slot === rider.slot }, O());
    if (forced) sent++;
  }
  assert.ok(sent > 3, `${sent} rounds sent out by a fated rider`);
});

test('AUDIT LW-II LW9: the roads\' layer lays each party out once, as it is drawn - the stands stand the armed where their bodies are (a train\'s file, a shared camp\'s ring); a fire one to a shared camp and none on the march; the patrol\'s halt draws on a wanted player whatever their regard - a friend too - and nobody else (mutants: E3 the stands\' places, F4 the shared fire, F4 the march, F4 the halt)', () => {
  // a shared camp near, and a walking train near, on the synthetic map
  const { towns, world } = synthMap();
  const o = O();
  const at22 = (day) => {
    const camped = [];
    for (const tn of towns) for (const tr of townTrips(tn, day * DAY_MIN + 22 * 60, world, o) ?? []) {
      const at = partyAt(tr, day * DAY_MIN + 22 * 60);
      if ((at.phase === 'out' || at.phase === 'back') && at.camp && !at.halt && !at.inn) camped.push({ trip: tr, at, members: tr.party });
    }
    return camped;
  };
  let shared = null;
  for (let day = 300; day < 400 && !shared; day++) {
    const camped = at22(day);
    const g = campGroups(camped);
    const second = camped.find((p) => !g.get(p.trip.id).first && p.trip.party.some((m) => m.cls != null));
    if (second) shared = { day, second, ring: g.get(second.trip.id) };
  }
  assert.ok(shared, 'a shared camp with an armed party at another\'s fire');
  const layer = (t, here) => {
    const lists = [];
    let cands = null;
    const sprites = { sync: (list) => lists.push(list.map((m) => ({ ...m }))), batches: () => [], persons: () => [], bodyOf: () => null, clear: () => {} };
    const stands = { frame: (c) => { cands = c; }, stood: () => false, clear: () => {} };
    const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => t, baseRate: () => CLASSIC_MINUTES_PER_SECOND, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => here, sprites: /** @type {any} */ (sprites), relations: () => createRelations(), memo: o.memo, stands: /** @type {any} */ (stands) });
    roads.frame(1 / 30, [here.x / 40, 1.6, here.z / 40]);
    return { list: lists[lists.length - 1], cands };
  };
  const t = shared.day * DAY_MIN + 22 * 60;
  const night = layer(t, { x: shared.ring.x, z: shared.ring.z });
  const armed = night.cands.filter((c) => c.trip.id === shared.second.trip.id);
  assert.ok(armed.length > 0, 'its armed handed to the stands');
  for (const c of armed) {
    const body = night.list.find((m) => m.key === c.res.id);
    assert.ok(body, 'drawn');
    assert.ok(Math.abs(body.feet[0] - c.x / 40) < 1e-9 && Math.abs(body.feet[2] - c.z / 40) < 1e-9, `${c.res.id}: stood where drawn`);
    assert.ok(Math.abs(Math.hypot(c.x - shared.ring.x, c.z - shared.ring.z) - (CAMP_RING_N + Math.max(0, shared.ring.n - 4) * CAMP_RING_STEP_N)) < 1e-6, 'on the shared ring');
  }
  // one fire to the shared camp - the first party's - and none of the others'
  const fires = night.list.filter((m) => /^fire:/.test(m.key));
  assert.ok(fires.some((f) => Math.abs(f.feet[0] - shared.ring.x / 40) < 1e-9 && Math.abs(f.feet[2] - shared.ring.z / 40) < 1e-9), 'its fire at the first\'s place');
  assert.ok(!fires.some((f) => f.key === `fire:${shared.second.trip.id}`), 'none of its own');
  assert.equal(new Set(fires.map((f) => `${f.feet[0]},${f.feet[2]}`)).size, fires.length, 'one fire to a camp');
  // by day, a train walking near: its armed stood in the train's places, and no fire on the march
  let day = null;
  for (let d = 300; d < 400 && !day; d++) {
    const tt = d * DAY_MIN + 12 * 60;
    for (const tn of towns) for (const tr of townTrips(tn, tt, world, o) ?? []) {
      const at = partyAt(tr, tt);
      if (tr.kind === 'merchant' && at.phase === 'out' && !at.camp && !at.halt && tr.party.some((m) => m.cls != null)) { day = { t: tt, tr, at }; break; }
    }
  }
  assert.ok(day, 'a train with its sellswords on the march');
  const noon = layer(day.t, { x: day.at.x, z: day.at.z });
  assert.equal(noon.list.filter((m) => /^fire:/.test(m.key)).length, 0, 'no fire on the march');
  const train = noon.cands.filter((c) => c.trip.id === day.tr.id);
  assert.ok(train.length > 0);
  for (const c of train) {
    const body = noon.list.find((m) => m.key === c.res.id);
    assert.ok(body && Math.abs(body.feet[0] - c.x / 40) < 1e-9 && Math.abs(body.feet[2] - c.z / 40) < 1e-9, `${c.res.id}: stood in the train's place`);
  }
  // the halt: a wanted player is halted by a knight who counts them a friend; a friend's sellsword stands for nobody
  const knight = { id: 'L1.t9', job: 'patrol', cls: MOBILE_TYPES.Knight, level: 8, name: 'Sir Ada Lark' };
  const sword = { id: 'L1.t3', job: 'mercenary', cls: MOBILE_TYPES.Warrior, level: 8, name: 'Bo Fenn' };
  const rel = createRelations();
  for (const m of [knight, sword]) { rel.note(m.id, 'saved', 0); rel.note(m.id, 'helped', 0); }
  assert.equal(rel.standing(knight.id, 0), 'friend');
  const spawned = [];
  const stands = createRoadStands({
    spawn: async (type, feet, so) => { spawned.push({ type, so }); return { entity: {}, dead: false }; },
    remove: () => {}, inPool: () => true, ready: () => true, sceneOf: (x, z) => [x, 0, z], relations: () => rel,
    slay: () => {}, died: () => {}, fighting: () => false, say: () => {},
    wanted: (res) => (res.job === 'patrol' ? PATROL_HALT_LINES[0] : null),
  });
  const trip = { id: 'L1.t9:4', party: [knight, sword] };
  stands.frame([{ res: knight, trip, x: 40 * 30, z: 0 }, { res: sword, trip, x: 40 * 30, z: 0 }], { x: 0, z: 0 }, 1000);
  assert.equal(spawned.length, 1, 'the knight alone');
  assert.equal(spawned[0].so.allied, false, 'drawn on the player, friend or not');
});
