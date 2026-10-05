// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE ROADS - the trips (pure), the caravans, the town's away
// windows and visitors, the armed walk, the road's bodies and the roads' layer, and their wiring in the streaming host.
// The map is synthetic (test/lwRoads.mjs: towns on a grid, the straight run of pixels between two as the planner's way);
// the town is the synthetic one (test/lwTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthMap } from './lwRoads.mjs';
import { synthTown } from './lwTown.mjs';
import {
  walkedMinutes, whenWalked, wayOf, wayAt, cycleOf, ownTrip, townTrips, formCaravans, partyAt, awayOf, visitorsOf, partiesNear,
  leavingYaw, arrivingYaw, townTrim, paceScale, NATIVE_PIXEL, NATIVE_PER_M, WALK_FROM_H, WALK_TO_H, CYCLE_DAYS, TRIP_CHANCE,
  TRIP_RANGE_PX, TRIP_PACE, STAY_DAYS, HIRE_MAX, TRIP_REACH_PX, CALENDAR_MPM,
} from '../src/systems/livingWorld/trips.js';
import { createWayBook, WAYS_PER_FRAME } from '../src/systems/livingWorld/ways.js';
import { travellerRoster, travellerCounts } from '../src/systems/livingWorld/census.js';
import { DAY_MIN, DAY_START_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { createTravellerSprites, classLookOf, TRAVELLER_FAR_M } from '../src/world/travellerSprites.js';
import { BAND_SPRITE_FAR_M } from '../src/world/bandSprites.js';
import { createLivingRoads, partyPlaces, partyLabel, FILE_GAP_N, FILE_SIDE_N, CAMP_RING_N, ROADS_PLAY_M, ROAD_GREET_M } from '../src/scenes/livingRoads.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { ROAD_GREETINGS, ROAD_TALKS, CAMP_TALKS, pickScript } from '../src/systems/livingWorld/lines.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { markGroup } from '../src/systems/travelViewFilters.js';
import { TRAVEL_VIEW_MARK_COLORS } from '../src/ui/travelViewHud.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });

test('LW3 the daylight: a party walks WALK_FROM_H to WALK_TO_H of each day and camps the rest - the minutes walked between two minutes, and the minute a walk of so many is done (mutants: the window, a night walked)', () => {
  assert.deepEqual([WALK_FROM_H, WALK_TO_H], [7, 19]);
  assert.equal(walkedMinutes(100 * DAY_MIN + 6 * 60, 101 * DAY_MIN + 8 * 60), 780, 'twelve hours, then one');
  assert.equal(walkedMinutes(100 * DAY_MIN + 20 * 60, 101 * DAY_MIN + 6 * 60), 0, 'a night');
  assert.equal(walkedMinutes(100 * DAY_MIN + 8 * 60, 100 * DAY_MIN + 8 * 60), 0);
  assert.equal(whenWalked(100 * DAY_MIN + 18 * 60, 120), 101 * DAY_MIN + 8 * 60, 'an hour tonight, an hour from seven');
  assert.equal(whenWalked(100 * DAY_MIN + 3 * 60, 30), 100 * DAY_MIN + 7 * 60 + 30, 'set out in the dark: from seven');
  for (const [a, m] of [[100 * DAY_MIN + 9 * 60 + 13, 2000], [100 * DAY_MIN + 22 * 60, 45]]) assert.equal(walkedMinutes(a, whenWalked(a, m)), m, 'the one undoes the other');
});

test('LW3 the way: a planner\'s route as the walked line through its pixels\' centres (native: 32768 a pixel, the road Basic Roads paints), a point along it facing its leg, a town\'s trim its half-width and a block (mutants: the centre, the facing, the trim)', () => {
  const way = wayOf({ pixels: [{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 11, y: 19 }], kinds: ['road', 'track'] });
  assert.deepEqual(way.pts, [[10 * NATIVE_PIXEL + 16384, 479 * NATIVE_PIXEL + 16384], [11 * NATIVE_PIXEL + 16384, 479 * NATIVE_PIXEL + 16384], [11 * NATIVE_PIXEL + 16384, 480 * NATIVE_PIXEL + 16384]]);
  assert.equal(way.len, 2 * NATIVE_PIXEL);
  const p = wayAt(way, NATIVE_PIXEL / 2);
  assert.deepEqual([p.x, p.z], [10 * NATIVE_PIXEL + 16384 + NATIVE_PIXEL / 2, 479 * NATIVE_PIXEL + 16384]);
  assert.ok(Math.abs(p.yaw - Math.PI / 2) < 1e-9, 'east along the first leg');
  assert.ok(Math.abs(wayAt(way, NATIVE_PIXEL * 1.5).yaw) < 1e-9, 'north along the second (a smaller pixel row is north)');
  assert.equal(townTrim({ blocks: 16 }), 4 * 4096 / 2 + 2048);
  assert.equal(townTrim({ blocks: 1 }), 4096);
  assert.deepEqual([NATIVE_PER_M, CALENDAR_MPM], [40, 6.5]);
  assert.equal(paceScale(3.25), 2, 'the sky walks half as far a minute: cycles twice as long');
});

test('LW3 a traveller\'s trip: each cycle (its length the job\'s, scaled by the pace, offset by the traveller\'s seed) they go at TRIP_CHANCE to a town in TRIP_RANGE_PX of their kind, set out of a morning, walk by day and come home inside the cycle; the same for every reader; none for a job that does not travel, undefined while a way is asked (mutants: the range, the cycle fit, the chance, the reader\'s own roll)', () => {
  const { towns, world } = synthMap();
  assert.deepEqual({ ...CYCLE_DAYS }, { merchant: 7, adventurer: 7, pilgrim: 20, courier: 5, pedlar: 6 });
  assert.deepEqual({ ...TRIP_CHANCE }, { merchant: 0.9, adventurer: 0.7, pilgrim: 0.5, courier: 0.9, pedlar: 0.85 });
  assert.deepEqual({ ...TRIP_RANGE_PX }, { merchant: [3, 14], adventurer: [3, 12], pilgrim: [3, 18], courier: [4, 18], pedlar: [2, 6] });
  assert.deepEqual({ ...STAY_DAYS }, { merchant: [1, 2], adventurer: [1, 1], pilgrim: [1, 2], courier: [0, 1], pedlar: [0, 1] });
  let made = 0, none = 0;
  for (const home of towns.slice(20, 50)) {
    for (const res of world.rosterOf(home)) {
      if (!(TRIP_CHANCE[res.job] > 0)) { assert.equal(ownTrip(res, home, 5, world, O()), null, `${res.job} travels with a merchant, never alone`); continue; }
      for (let k = 40; k < 46; k++) {
        const trip = ownTrip(res, home, k, world, O());
        if (!trip) { none++; continue; }
        made++;
        const len = Math.max(2, Math.round(CYCLE_DAYS[res.job]));
        const cyc = cycleOf(res, Math.floor(trip.outT0 / DAY_MIN), 1);
        assert.equal(cyc.k, k, 'set out in its own cycle');
        assert.ok(trip.backT1 <= (cyc.start + len) * DAY_MIN + DAY_START_MIN, 'home inside the cycle');
        const d = Math.max(Math.abs(trip.to.px - home.px), Math.abs(trip.to.py - home.py));
        const [lo, hi] = TRIP_RANGE_PX[res.job];
        assert.ok(d >= lo && d <= hi, `${res.job} to a town in range (${d})`);
        assert.ok(trip.outT0 < trip.outT1 && trip.outT1 <= trip.backT0 && trip.backT0 < trip.backT1);
        const h = (trip.outT0 % DAY_MIN) / 60;
        assert.ok(h >= 6 && h < 9, 'out of a morning');
        assert.deepEqual(ownTrip(res, home, k, world, O()), trip, 'the same trip for every reader');
      }
    }
  }
  assert.ok(made > 100 && none > 10, `trips made and cycles stayed home (${made}/${none})`);
  // the chance: a pedlar with towns in reach goes TRIP_CHANCE of its cycles, no more
  const pedlarHome = towns[40], pedlar = world.rosterOf(pedlarHome).find((r) => r.job === 'pedlar');
  let went = 0;
  for (let k = 40; k < 440; k++) if (ownTrip(pedlar, pedlarHome, k, world, O())) went++;
  assert.ok(went / 400 > TRIP_CHANCE.pedlar - 0.1 && went / 400 < TRIP_CHANCE.pedlar + 0.05, `a pedlar goes ${went / 400} of its cycles`);
  // the range's floor: on a map of towns a pixel apart, nobody goes to the next town but one
  const tight = synthMap({ x0: 200, y0: 200, n: 12, step: 1 });
  for (const home of tight.towns.slice(30, 60)) {
    for (const res of tight.world.rosterOf(home)) {
      if (!(TRIP_CHANCE[res.job] > 0)) continue;
      const trip = ownTrip(res, home, 50, tight.world, O());
      if (trip) assert.ok(Math.max(Math.abs(trip.to.px - home.px), Math.abs(trip.to.py - home.py)) >= TRIP_RANGE_PX[res.job][0], `${res.job} not to the next door`);
    }
  }
  const pending = { ...world, routeOf: () => undefined };
  const merchant = world.rosterOf(towns[40]).find((r) => r.job === 'merchant');
  let sawPending = false;
  for (let k = 40; k < 46; k++) if (ownTrip(merchant, towns[40], k, pending, O()) === undefined) sawPending = true;
  assert.ok(sawPending, 'a way still being asked: no answer yet');
});

test('LW3 caravans: a merchant takes the town\'s sellswords under contract to them (dealt in slot order, the first to the first merchant, round again - their own roll of up to HIRE_MAX), so overlapping trips never share one; a pilgrim, courier or pedlar setting out the same day for the same town joins the first such merchant\'s train; each a law of the trips alone - the train read on its way home is the train that set out; the town\'s trips are each party\'s once (mutants: the contract, the joiners, the window)', () => {
  assert.equal(HIRE_MAX, 3);
  const home = { mapId: 7, px: 50, py: 50, blocks: 36 };
  const roster = travellerRoster(home);
  const swords = roster.filter((r) => r.job === 'mercenary').sort((a, b) => a.slot - b.slot);
  const merchants = roster.filter((r) => r.job === 'merchant').sort((a, b) => a.slot - b.slot);
  assert.ok(swords.length >= 4 && merchants.length >= 3, `a city's sellswords and merchants (${swords.length}, ${merchants.length})`);
  const pilgrim = roster.find((r) => r.job === 'pilgrim');
  const to = { mapId: 9, name: 'Far' }, other = { mapId: 10, name: 'Other' };
  const mk = (leader, kind, outT0, backT1, dest = to) => ({ id: `${leader.id}:0`, kind, leader, party: [leader], from: home, to: dest, way: { pts: [], cum: [], len: 0, kinds: [] }, pace: 1, outT0, outT1: outT0 + 10, backT0: backT1 - 10, backT1, trim0: 0, trim1: 0 });
  const day = 200 * DAY_MIN;
  const all = [mk(merchants[1], 'merchant', day + 600, day + 5000), mk(merchants[0], 'merchant', day + 500, day + 4000), mk(pilgrim, 'pilgrim', day + 700, day + 3000), mk(merchants[2], 'merchant', day + 9000, day + 12000, other)];
  const tripOf = (res) => all.find((t) => t.leader === res) ?? null;
  const made = formCaravans(home, all, roster, tripOf, 1);
  const hired = (t) => t.party.filter((p) => p.job === 'mercenary').map((p) => p.slot);
  merchants.forEach((m, mi) => {
    const t = made.find((x) => x.leader === m);
    if (!t) return;
    const contract = swords.filter((_, i) => i % merchants.length === mi).map((p) => p.slot);
    const got = hired(t);
    assert.ok(got.length <= HIRE_MAX, 'never past HIRE_MAX');
    assert.deepEqual(got, contract.slice(0, got.length), `merchant ${mi}: their own contract's first ${got.length}, in slot order`);
  });
  const first = made.find((t) => t.leader === merchants[0]), second = made.find((t) => t.leader === merchants[1]);
  assert.ok(hired(first).every((s) => !hired(second).includes(s)), 'never in two overlapping trips');
  assert.ok(made.some((t) => hired(t).length > 0), 'someone hires');
  assert.ok(first.party.includes(pilgrim), 'the pilgrim set out that day for the same town: in the first merchant\'s train (slot order)');
  assert.ok(!second.party.includes(pilgrim), 'and in one train alone');
  assert.ok(!made.some((t) => t.leader === pilgrim), 'and has no trip of its own');
  assert.ok(!made.find((t) => t.leader === merchants[2]).party.includes(pilgrim), 'another town, another day: not joined');
  // THE WINDOW: the second merchant's train read without the first in the window (its trip over) is the same train
  const alone = formCaravans(home, [all[0]], roster, tripOf, 1);
  assert.deepEqual(alone[0].party.map((p) => p.id), second.party.map((p) => p.id), 'a train is the trips\' law, not the window\'s');
  const { towns, world } = synthMap();
  const big = towns.filter((t) => t.blocks >= 20);
  let checked = 0;
  for (const town of big) {
    const o = O();
    const real = townTrips(town, 100 * DAY_MIN + 720, world, o);
    const ids = real.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, 'each party once');
    const people = real.flatMap((t) => t.party.map((p) => p.id));
    for (const id of new Set(people)) {
      const windows = real.filter((t) => t.party.some((p) => p.id === id)).map((t) => [t.outT0, t.backT1]);
      for (let i = 0; i < windows.length; i++) for (let j = i + 1; j < windows.length; j++) assert.ok(!(windows[i][0] < windows[j][1] && windows[j][0] < windows[i][1]), `${id} in one party at a time`);
    }
    for (const tr of real.filter((x) => x.party.length > 1)) {
      const at = (m) => townTrips(town, m, world, o).find((x) => x.id === tr.id)?.party.map((p) => p.id);
      assert.deepEqual(at(tr.backT1 - 30), at(tr.outT0 + 30), `${tr.id}: the train home is the train out`);
      checked++;
    }
  }
  assert.ok(checked > 0, `some trains read twice (${checked})`);
});

test('LW3 where a party is: home before and after, out on its way by day and camped by night (its place the last of the day\'s walk), staying at the town it went to, back on the way home facing it - each walk starting and ending at the towns\' trims (mutants: the night walked, the way home faced wrong, the trim)', () => {
  const { towns, world } = synthMap();
  let trip = null;
  for (const home of towns) for (const res of world.rosterOf(home)) for (let k = 0; k < 4 && !trip; k++) { const t = ownTrip(res, home, k, world, O()); if (t && t.outT1 - t.outT0 > DAY_MIN) trip = t; }
  assert.ok(trip, 'a trip of more than a day out');
  assert.deepEqual(partyAt(trip, trip.outT0 - 1), { phase: 'home' });
  assert.deepEqual(partyAt(trip, trip.backT1), { phase: 'home' });
  const start = partyAt(trip, trip.outT0);
  assert.equal(start.phase, 'out'); assert.ok(Math.abs(start.s - trip.trim0) < 1e-6, 'out of the town\'s edge');
  const firstNight = Math.floor(trip.outT0 / DAY_MIN) * DAY_MIN + 22 * 60;
  const dusk = partyAt(trip, Math.floor(trip.outT0 / DAY_MIN) * DAY_MIN + WALK_TO_H * 60);
  const night = partyAt(trip, firstNight);
  assert.equal(night.camp, true, 'camped at night');
  assert.ok(Math.abs(night.s - dusk.s) < 1e-6, 'where the day\'s walk ended');
  const noon = partyAt(trip, Math.floor(trip.outT0 / DAY_MIN) * DAY_MIN + 12 * 60);
  assert.equal(noon.camp, false);
  assert.equal(partyAt(trip, (trip.outT1 + trip.backT0) / 2).phase, 'stay');
  const back = partyAt(trip, trip.backT0 + 60);
  assert.equal(back.phase, 'back');
  const fwd = wayAt(trip.way, back.s);
  assert.ok(Math.abs(Math.atan2(Math.sin(back.yaw - fwd.yaw - Math.PI), Math.cos(back.yaw - fwd.yaw - Math.PI))) < 1e-9, 'home-bound, facing home');
  const end = partyAt(trip, trip.backT1 - 1e-6);
  assert.ok(Math.abs(end.s - trip.trim0) < trip.pace * 0.01 + 1e-3, 'into its own town\'s edge');
  assert.ok(Math.abs(leavingYaw(trip) - wayAt(trip.way, trip.trim0 + 1).yaw) < 1e-12);
  assert.ok(Math.abs(arrivingYaw(trip) - (wayAt(trip.way, trip.way.len - trip.trim1 - 1).yaw + Math.PI)) < 1e-12);
});

test('LW3 the towns see the roads: a home\'s away windows for each of a party (armed where they carry a class), and a town\'s visitors - the parties of the towns within TRIP_REACH_PX staying in it, each member in at the trip\'s arrival and out at its leaving; the parties near a pixel (mutants: a member left home, the reach, the stay window)', () => {
  assert.equal(TRIP_REACH_PX, 18);
  const { towns, world } = synthMap();
  const o = O();
  let checked = 0;
  for (const town of towns) {
    for (let d = 100; d < 104; d++) {
      const vis = visitorsOf(town, d, world, o);
      const D0 = d * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
      for (const v of vis) {
        assert.equal(v.trip.to.mapId, town.mapId);
        assert.ok(v.inT < D1 && v.outT > D0, 'staying that day');
        assert.ok(v.trip.party.includes(v.res));
        assert.ok(Math.max(Math.abs(v.trip.from.px - town.px), Math.abs(v.trip.from.py - town.py)) <= TRIP_REACH_PX);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, 'visitors somewhere');
  const home = towns.find((t) => t.blocks >= 20);
  const trips = townTrips(home, 100 * DAY_MIN + 720, world, o);
  const caravan = trips.find((t) => t.party.length > 1) ?? trips[0];
  for (const m of caravan.party) {
    const w = awayOf(m, trips);
    assert.ok(w.some((x) => x.t0 === caravan.outT0 && x.t1 === caravan.backT1), `${m.id} away with the party`);
    assert.equal(w[0].armed, m.cls != null);
  }
  const near = partiesNear(home.px, home.py, 100 * DAY_MIN + 12 * 60, world, o, 6);
  assert.equal(near.pending, false);
  for (const p of near.parties) {
    const ppx = Math.floor(p.at.x / NATIVE_PIXEL), ppy = 499 - Math.floor(p.at.z / NATIVE_PIXEL);
    assert.ok(Math.max(Math.abs(ppx - home.px), Math.abs(ppy - home.py)) <= 6);
    assert.ok(p.at.phase === 'out' || p.at.phase === 'back');
  }
});

test('LW3 a party in file and at its fire: by day each FILE_GAP_N behind the one before along the way they walk, to either side by FILE_SIDE_N, facing the way; at night in a ring CAMP_RING_N about the camp, facing in; the labels (mutants: the file behind, the ring, the facing)', () => {
  assert.deepEqual([FILE_GAP_N, FILE_SIDE_N, CAMP_RING_N], [72, 22, 90]);
  const way = wayOf({ pixels: [{ x: 10, y: 20 }, { x: 20, y: 20 }] });
  const party = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const trip = { id: 't', way, party, kind: 'merchant', to: { name: 'Far' } };
  const out = partyPlaces(trip, { phase: 'out', s: 5 * NATIVE_PIXEL, x: 0, z: 0, yaw: Math.PI / 2, camp: false });
  assert.ok(out[1].x < out[0].x && out[2].x < out[1].x, 'behind the leader, eastbound');
  assert.ok(Math.abs((out[0].x - out[2].x) - 2 * FILE_GAP_N) < 1e-6);
  assert.ok(Math.abs(out[1].z - out[0].z) === FILE_SIDE_N && Math.abs(out[2].z - out[0].z) === FILE_SIDE_N && out[1].z !== out[2].z, 'one to each side');
  assert.ok(out.every((m) => Math.abs(m.yaw - Math.PI / 2) < 1e-9 && m.moving));
  const back = partyPlaces(trip, { phase: 'back', s: 5 * NATIVE_PIXEL, camp: false });
  assert.ok(back[1].x > back[0].x, 'behind the leader, westbound home');
  assert.ok(back.every((m) => Math.abs(Math.cos(m.yaw) + 0) < 1e-6 && Math.sin(m.yaw) < 0), 'facing west');
  const camp = partyPlaces(trip, { phase: 'out', s: 0, x: 1000, z: 2000, camp: true });
  for (const m of camp) {
    assert.ok(Math.abs(Math.hypot(m.x - 1000, m.z - 2000) - CAMP_RING_N) < 1e-6, 'about the fire');
    assert.ok(Math.abs(Math.atan2(1000 - m.x, 2000 - m.z) - m.yaw) < 1e-9 && !m.moving, 'facing in, at rest');
  }
  assert.equal(partyLabel(trip), 'Caravan to Far');
  assert.equal(partyLabel({ kind: 'pilgrim', party: [1, 2], to: { name: 'X' } }), 'Pilgrims to X');
  assert.equal(partyLabel({ kind: 'pedlar', party: [1], to: { name: 'Y' } }), 'Pedlar to Y');
});

test('LW3 the town and the roads: a traveller away is geared at home, walks out to the exit facing the road ARMED (the body in their class\'s sprite) and is gone till home; a visitor of another town is in by the exit facing the road it came, lodged at a tavern (mutants: the arm, the exit, the lodging)', () => {
  const { nav, buildings, doors } = synthTown();
  const day = 100;
  const D0 = day * DAY_MIN + DAY_START_MIN;
  const homeTown = { mapId: 12345, blocks: 9, region: 17, people: 3, port: false };
  const adventurer = travellerRoster(homeTown).find((r) => r.job === 'adventurer');
  assert.ok(adventurer?.cls != null);
  const visitor = travellerRoster({ mapId: 999, blocks: 9, region: 17, people: 2 }).find((r) => r.job === 'pedlar');
  const away = new Map([[adventurer.id, [{ t0: D0 + 7 * 60, t1: D0 + 40 * 60, yaw: Math.PI / 2, armed: true }]]]);
  const visitors = [{ res: visitor, inT: D0 + 6 * 60, outT: D0 + 18 * 60, yaw: -Math.PI / 2 }];
  const clock = { t: D0 + 6 * 60 - 40 };
  const armed = [];
  const town = new LivingTown(nav, {
    town: homeTown, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND,
    tripsOf: () => ({ away, visitors }),
    armOf: (res) => { armed.push(res.id); return { ...classLookOf(res), frameCount: () => 4, sex: res.sex }; },
  });
  const own = town.residents.find((r) => r.id === adventurer.id);
  assert.ok(own?.home != null, 'the town gave the traveller a home');
  const plan = town.planOf(own, day);
  const gear = plan.find((e) => e.kind === 'gear');
  const out = plan.find((e) => e.kind === 'walk' && e.armed);
  assert.ok(gear && out, 'geared, then out armed');
  assert.equal(out.to.key, 'xe', 'the exit facing the road (east)');
  assert.equal(plan.find((e) => e.kind === 'away').t0, D0 + 7 * 60);
  const vp = town.planOf(visitor, day);
  assert.equal(vp[0].kind, 'away', 'not yet come');
  const walkIn = vp.find((e) => e.kind === 'walk');
  assert.equal(walkIn.from.key, 'xw', 'in by the exit facing the road it came (west)');
  assert.equal(walkIn.to, town.places.doors.get(1000), 'to the tavern it lodges at');
  assert.ok(town.peopleOf(day).includes(visitor), 'read with the town today');
  // the armed walk: the body takes its class's sprite while it walks out
  clock.t = out.t0 + 1;
  const seats = [];
  for (let i = 0; i < 60; i++) { clock.t += CLASSIC_MINUTES_PER_SECOND / 30; seats.push(...town.update(1 / 30, [out.from.x, 0, out.from.z], 0, [out.from.x, 1.6, out.from.z], true)); }
  const body = town.pool.find((r) => r.res?.id === adventurer.id)?.person;
  assert.ok(body, 'stood walking out of their door');
  assert.equal(body.armed, true, 'armed on the walk out');
  assert.equal(body.archive, classLookOf(adventurer).archive);
  assert.ok(armed.includes(adventurer.id));
  body.moving = false;
  assert.notEqual(body.update(0.1, [0, 1.6, 0], false).record, 5, 'the class sprite\'s own frames, not the outfit\'s idle');
});

test('LW3 the road\'s bodies: an armed traveller in their class\'s sprite (its archive by their sex), the rest in their own outfit; each a talk target in the street\'s shape; a body gone from the list is freed, and clear() frees them all; under the Overworld faded by distance to the bands\' own far edge (mutants: the sex, the free, the fade)', () => {
  const made = [], freed = [];
  const renderer = { textures: new Set(), createBillboardBatch: (archive) => { const b = { archive, origin: null }; made.push(b); return b; }, destroyBillboardBatch: (b) => freed.push(b) };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) };
  const textures = new Map();
  const getTexture = (a) => { textures.set(a, true); return Promise.resolve(tex); };
  const door = { roadside: true };
  const sprites = createTravellerSprites({ renderer, getTexture, uploadRecordFrame: () => {}, living: door });
  const roster = travellerRoster({ mapId: 31, blocks: 36, region: 17, people: 3 });
  const knight = roster.find((r) => r.cls != null && r.sex === 'female') ?? roster.find((r) => r.cls != null);
  const pedlar = roster.find((r) => r.job === 'pedlar');
  const look = classLookOf(knight);
  assert.equal(look.archive, knight.sex === 'female' && ENEMY_BASICS[knight.cls].femaleTexture ? ENEMY_BASICS[knight.cls].femaleTexture : ENEMY_BASICS[knight.cls].maleTexture);
  assert.equal(classLookOf(pedlar), null);
  const list = [{ key: knight.id, res: knight, feet: [1, 0, 2], yaw: 0.5, moving: true, distM: 10 }, { key: pedlar.id, res: pedlar, feet: [3, 0, 4], yaw: 0, moving: true, distM: 12 }];
  sprites.sync(list, { dt: 0.1, eye: [0, 1.6, 0] });   // textures asked
  return Promise.resolve().then(() => Promise.resolve()).then(() => {
    sprites.sync(list, { dt: 0.1, eye: [0, 1.6, 0] });
    assert.equal(sprites.batches().length, 2);
    assert.deepEqual(made.map((b) => b.archive).sort(), [look.archive, pedlar.archive].sort());
    const seats = sprites.persons();
    assert.equal(seats.length, 2);
    for (const s of seats) {
      const res = s.person.living.res;
      assert.equal(s.person.nameNPC, res.name); assert.equal(s.person.personFaceRecordId, res.face);
      assert.equal(s.person.living.town, door, 'the roads answer the talk');
      assert.ok(Number.isInteger(s.person._talkSeed));
    }
    sprites.sync(list.slice(0, 1), { dt: 0.1, eye: [0, 1.6, 0] });
    assert.equal(freed.length, 1, 'the pedlar gone: its batch freed');
    sprites.clear();
    assert.equal(freed.length, 2, 'clear frees every one');
    assert.equal(TRAVELLER_FAR_M, BAND_SPRITE_FAR_M);
    sprites.sync([{ ...list[0], distM: TRAVELLER_FAR_M + 5 }], { dt: 0.5, eye: [0, 1.6, 0], ground: false, grow: 3, fade: 1 });
    assert.equal(sprites.batches().length, 0, 'past the far edge under the Overworld: not drawn');
    for (let i = 0; i < 20; i++) sprites.sync([{ ...list[0], distM: 50 }], { dt: 0.5, eye: [0, 1.6, 0], ground: false, grow: 3, fade: 1 });
    assert.equal(sprites.batches().length, 1, 'near, under the Overworld: drawn, grown');
    assert.equal(sprites.persons().length, 0, 'but nobody to talk to from the sky');
  });
});

test('LW3 the roads\' layer: the parties near the player placed each frame (in play within ROADS_PLAY_M), a word to the player passing within ROAD_GREET_M by regard, a party\'s own talk in rounds (the road\'s words by day, the fire\'s by night), the Overworld\'s marks; the person\'s town notes a word, a caught hand, and refuses an enemy (mutants: the range, the regard\'s pool, the road\'s pools, the marks\' kinds)', () => {
  assert.equal(ROADS_PLAY_M, 360); assert.equal(ROAD_GREET_M, 4);
  const { towns, world } = synthMap();
  const home = towns.find((t) => t.blocks >= 20);
  const rel = createRelations();
  const drawnLists = [];
  const sprites = {
    sync: (list) => { drawnLists.push(list.map((m) => ({ ...m }))); },
    batches: () => [], persons: () => [],
    bodyOf: (id) => ({ person: { pos: [0, 0, 0], nameNPC: 'Ann Bee', living: { id } } }),
    clear: () => {},
  };
  // stand at a party: find one on the road at noon near home
  const t0 = 100 * DAY_MIN + 12 * 60;
  const near = partiesNear(home.px, home.py, t0, world, O(), 6).parties;
  assert.ok(near.length, 'a party on the road');
  const pt = near[0];
  const clock = { t: t0 };
  const roads = createLivingRoads({
    world, mpm: CALENDAR_MPM, clock: () => clock.t, baseRate: () => CLASSIC_MINUTES_PER_SECOND,
    sceneOf: (nx, nz) => [nx / NATIVE_PER_M, 0, nz / NATIVE_PER_M], here: () => ({ x: pt.at.x, z: pt.at.z }),
    sprites, relations: () => rel, playerName: () => 'Mac',
  });
  roads.frame(1 / 30, [pt.at.x / NATIVE_PER_M, 1.6, pt.at.z / NATIVE_PER_M]);
  const list = drawnLists[drawnLists.length - 1];
  assert.ok(list.length >= pt.trip.party.length, 'the party stood');
  assert.ok(list.every((m) => m.distM <= ROADS_PLAY_M));
  const marks = roads.marks();
  const mine = marks.find((m) => m.key === `party:${pt.trip.id}`);
  assert.ok(mine && mine.label === partyLabel(pt.trip) && /^wayfarer/.test(mine.kind));
  for (const m of marks) assert.equal(m.kind, m.trip.kind === 'merchant' ? 'wayfarer caravan' : 'wayfarer');
  // a merchant's train somewhere in a week of the map wears the caravan's mark
  let caravanMark = null;
  for (let h = 0; h < 24 * 7 && !caravanMark; h += 6) {
    clock.t = t0 + h * 60;
    const at = partiesNear(home.px, home.py, clock.t, world, O(), 6).parties.find((p) => p.trip.kind === 'merchant');
    if (!at) continue;
    const r2 = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => clock.t, baseRate: () => CLASSIC_MINUTES_PER_SECOND, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => ({ x: at.at.x, z: at.at.z }), sprites, relations: () => rel });
    r2.frame(1 / 30, [0, 0, 0]);
    caravanMark = r2.marks().find((m) => m.trip.kind === 'merchant');
  }
  assert.equal(caravanMark?.kind, 'wayfarer caravan');
  clock.t = t0;
  // a word to the player passing close, by regard
  const leader = pt.trip.party[0];
  for (let i = 0; i < 2; i++) { roads.frame(1 / 30, [pt.at.x / NATIVE_PER_M, 1.6, pt.at.z / NATIVE_PER_M]); }
  const said = roads.speech([pt.at.x / NATIVE_PER_M, 1.6, pt.at.z / NATIVE_PER_M], 1e9);
  const greet = said.find((l) => l.person.living.id === leader.id && ROAD_GREETINGS.stranger.includes(l.text));
  assert.ok(greet, 'a stranger\'s word');
  // the person's town
  const person = { nameNPC: 'Ann Bee', living: { id: leader.id } };
  assert.equal(roads.talked(person), leader.id);
  assert.equal(rel.regard(leader.id, Math.floor((clock.t - DAY_START_MIN) / DAY_MIN)), 3);
  roads.caught(person);
  assert.equal(rel.regard(leader.id, Math.floor((clock.t - DAY_START_MIN) / DAY_MIN)), 3 - 15);
  assert.equal(roads.refuses(person), null);
  rel.note(leader.id, 'struck', Math.floor((clock.t - DAY_START_MIN) / DAY_MIN));
  assert.equal(roads.refuses(person), 'Ann turns away from you.');
  // the road's pools: a walking party says the road's words, a camped one the fire's
  const walk = new Set(), camp = new Set();
  for (let s = 0; s < 300; s++) { walk.add(pickScript(s, { road: 'walk' })); camp.add(pickScript(s, { road: 'camp' })); }
  assert.ok(ROAD_TALKS.every((x) => walk.has(x)) && ![...walk].some((x) => CAMP_TALKS.includes(x)));
  assert.ok(CAMP_TALKS.every((x) => camp.has(x)) && ![...camp].some((x) => ROAD_TALKS.includes(x)));
  roads.clear();
  assert.equal(roads.parties().length, 0);
});

test('LW3 the Overworld knows a party on the road: the `wayfarer` kind is the travellers\' filter group and wears the road\'s dust - a square, a caravan\'s the larger (mutants: the group, the look)', () => {
  assert.equal(markGroup('wayfarer'), 'travellers');
  assert.equal(markGroup('wayfarer caravan'), 'travellers');
  assert.equal(TRAVEL_VIEW_MARK_COLORS.wayfarer, '#c9a96e');
  const hud = rd('src/ui/travelViewHud.js');
  assert.match(hud, /if \(k === 'wayfarer'\) return k;/);
  assert.match(hud, /\} else if \(look === 'wayfarer'\) \{[^\n]*\n\s*const r = \/\\bcaravan\\b\/\.test\(m\.kind \?\? ''\) \? 5 : 3\.5;\n\s*g\.beginPath\(\); g\.rect\(x - r, y - r, r \* 2, r \* 2\); g\.fill\(\); g\.stroke\(\);/);
});

test('LW3 the ways: the living world\'s own book - a pair of towns asked once, the lower map id first and the other way its reverse; a few new pairs a frame; nothing while the roads are not built; the drawn network, whichever it is, and a new network clears the book (mutants: the direction, the budget, the network)', () => {
  const asked = [];
  let net = null;
  const plan = (a, b, o) => { asked.push([a.x, b.x, o.roads, o.flat]); return { pixels: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], kinds: ['road'] }; };
  const book = createWayBook({ roads: () => net, ground: () => ({ flat: 'ground' }), plan });
  const A = { mapId: 5, px: 10, py: 1 }, B = { mapId: 3, px: 20, py: 2 }, C = { mapId: 9, px: 30, py: 3 };
  assert.equal(book.wayOf(A, B), undefined, 'no roads yet: wait');
  net = { roads: 'R1', tracks: 'T1', source: 'generated' };
  const ab = book.wayOf(A, B);
  assert.deepEqual(asked[0], [20, 10, 'R1', 'ground'], 'asked from the lower map id, on the drawn network and the host\'s ground - whatever its source');
  assert.deepEqual(ab.pixels.map((p) => p.x), [10, 20], 'and walked the other way reversed');
  assert.deepEqual(book.wayOf(B, A).pixels.map((p) => p.x), [20, 10]);
  assert.equal(asked.length, 1, 'once a pair');
  assert.equal(WAYS_PER_FRAME, 2);
  book.wayOf(A, C);
  assert.equal(book.wayOf(B, C), undefined, 'the frame\'s asking spent');
  book.frame();
  assert.ok(book.wayOf(B, C), 'a new frame asks again');
  assert.equal(book.generation, 0);
  net = { roads: 'R2', tracks: 'T2', source: 'basic-roads' };
  book.frame();
  book.wayOf(A, B);
  assert.equal(book.generation, 1, 'a new network: a new generation');
  assert.equal(asked.filter((q) => q[0] === 20 && q[1] === 10).length, 2, 'and the pair asked again on it');
});

test('LW3 the streaming host: the trips\' world is the game\'s own populated rows (blocks, people, region, port) and Hazelnut\'s roads asked one way a pair, a few a frame; a town\'s LivingTown takes its trips and the armed walk\'s sprite; the roads\' layer runs in the open world after the town\'s people and is freed indoors; the road\'s people beside the town\'s for the talk ray and the hover alone; their words through the one layer; the Overworld\'s marks; a caught hand on the road calls no watch (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /for \(const loc of _hubRows\) \{\n\s*const md = loc\.mapTableData;\n\s*if \(!md \|\| !populatesWanderingNpcs\(md\.locationType\)\) continue;/);
  assert.match(w, /const livingWays = createWayBook\(\{\n\s*roads: \(\) => terrainGen\.roads\(\),\n\s*ground: \(\) => \(_livingGround \?\?= routeGround\(\(px, py\) => maps\.getClimateIndex\(px, py\), \(px, py\) => woods\.getHeightMapValue\(px, py\), WATER_BYTE\)\),\n\s*\}\);/, 'the ways: the living world\'s own book, on the drawn roads and the game\'s own ground (no player\'s massifs)');
  assert.match(w, /const livingRouteOf = \(a, b\) => livingWays\.wayOf\(a, b\);/);
  assert.match(w, /tripsOf: \(day\) => livingTripsOf\(livingTown, day\), armOf: livingArmOf,/);
  assert.match(w, /livingWays\.frame\(\); livingMemoFresh\(\);[^\n]*\n(?:\s*livingTurnsFresh\(\);[^\n]*\n)?\s*if \(livingWorldOn\(\) && _mode\(\) === 'exterior'\) \{\n\s*livingRoadsOf\(\)\.frame\(townTalk\.overlayActive \? 0 : dt, cam\.pos, \{ overworld: tvf \? \{ grow: tvf\.grow, blend: tvf\.blend \} : null \}\);\n\s*livePersonBatches\.push\(\.\.\.livingRoads\.batches\(\)\);\n\s*\} else if \(livingRoads\) livingRoads\.clear\(\);/);
  assert.match(w, /indoorRainSource: betterAmbience\.rainPlaying\(\) \}\);\n\s*if \(livingRoads\) livingRoads\.clear\(\);/, 'indoors, underground: the road\'s bodies freed (the modal arm)');
  assert.match(w, /personDistances: _talkPersons\(\)\.map\(\(p\) => rayPersonDistance\(cam\.pos, useFwd, p\.pos\)\),/);
  assert.match(w, /townTalk\.tryActivate\(cam\.pos, useFwd, _talkPersons\(\), _nonPersonRival\)/);
  assert.match(w, /const n = nearestPerson\(eye, dir, _talkPersons\(\)\);/);
  assert.match(w, /const _guardPool = \(\) => \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \? \[\] : _livePersons\.map\(/, 'the watch\'s conversion: the town\'s alone');
  assert.match(w, /for \(const l of livingRoads\.speech\(eye\)\) \{/);
  assert.match(w, /for \(const m of livingRoads\.marks\(\)\) if \(markShown\(\{ kind: m\.kind \}\)\) marks\.push\(/);
  const tt = rd('src/scenes/townTalk.js');
  assert.match(tt, /if \(!r\.success\) \{ livingTalk\?\.caught\?\.\(target\.person\); if \(!target\.person\?\.living\?\.town\?\.roadside\) onCrime\?\.\(\); \}/);
  assert.match(w, /caught: \(p\) => livingRoads\?\.caught\(p\) \?\? null, roadside: true \};/);
  assert.equal(travellerCounts({ mapId: 1, blocks: 1 }).pedlar, 1, 'every town its pedlar');
  assert.deepEqual({ ...TRIP_PACE }, { merchant: 0.85, mercenary: 0.85, adventurer: 1.05, courier: 1.3, pilgrim: 0.9, sailor: 1, pedlar: 0.95 });
});
