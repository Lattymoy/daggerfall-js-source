// LW10 (bible/06-Systems/Living-World-II.md "LW10"): THE WAGON TRAIN - who has a team (a merchant's wagon, two from a
// great house; a noble's baggage wagon; a pedlar's or a carter's pack horse), the train in file along its way (the van
// before, the leader at the first horse's head, each wagon on its shafts the mod's hitch behind its horse, the rest
// behind), the park at camp, the cargo by the trip, the wheels by the distance walked; the teams drawn with Horse Cart
// and Cargo's own pieces (the nearest WAGONS_DRAWN, each horse its own batch, a standing wagon's box on the collider,
// every allocation freed); the roads' layer laying them. Pure and synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  teamOf, cargoOf, trainOf, campTeam, wheelAngleAt, GREAT_HOUSE_BLOCKS, WALK_GAP_N, LEAD_N, HITCH_N, WAGON_TAIL_N, CARGO_FULL, CARGO_SOLD,
  CARGO_BOUGHT, CARGO_ROBBED, CAMP_PARK_N, CAMP_HORSE_SIDE_N,
} from '../src/systems/livingWorld/wagons.js';
import { createRoadTeams, WAGONS_DRAWN, wagonBucket } from '../src/world/roadTeams.js';
import { wayAt, wayOf, NATIVE_PER_M, NATIVE_PIXEL, partyAt, townTrips, membersAt, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { HITCHED_HORSE_LOCAL_Z, wheelRotationDegrees, wrapWheelAngle, NORMAL_GROUND_OFFSET } from '../src/systems/horseCartLaw.js';
import { createLivingRoads, CAMP_RING_N } from '../src/scenes/livingRoads.js';
import { synthMap } from './lwRoads.mjs';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const res = (id, cls = null) => ({ id, cls, name: id });
const straight = (len = 20 * NATIVE_PIXEL) => ({ pts: [[0, 0], [0, len]], cum: [0, len], len, kinds: ['road'] });

test('LW10 who has what: a merchant\'s caravan its wagon, two from a great house (GREAT_HOUSE_BLOCKS); a noble\'s procession its baggage wagon; a pedlar\'s or a carter\'s own trip a pack horse; nobody else (mutants: each kind, the great house)', () => {
  assert.equal(GREAT_HOUSE_BLOCKS, 36);
  assert.deepEqual(teamOf({ kind: 'merchant', from: { blocks: 35 } }), { wagons: 1, packs: 0 });
  assert.deepEqual(teamOf({ kind: 'merchant', from: { blocks: 36 } }), { wagons: 2, packs: 0 });
  assert.deepEqual(teamOf({ kind: 'noble', from: { blocks: 64 } }), { wagons: 1, packs: 0 });
  assert.deepEqual(teamOf({ kind: 'pedlar', from: { blocks: 4 } }), { wagons: 0, packs: 1 });
  assert.deepEqual(teamOf({ kind: 'carter', from: { blocks: 1 } }), { wagons: 0, packs: 1 });
  for (const kind of ['adventurer', 'pilgrim', 'courier', 'patrol', 'hunter', 'minstrel']) assert.deepEqual(teamOf({ kind, from: { blocks: 64 } }), { wagons: 0, packs: 0 }, kind);
});

test('LW10 the cargo: full on the way out (CARGO_FULL), home by its trade - sold (half) or bought (three quarters) by the trip\'s seed - and a quarter once robbed (mutants: the tiers, the seed, the robbed)', () => {
  assert.deepEqual([CARGO_FULL, CARGO_SOLD, CARGO_BOUGHT, CARGO_ROBBED], [90, 50, 75, 25]);
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const trip = { id: `L1.t${i}:3`, backT0: 1000 };
    assert.equal(cargoOf(trip, 999), CARGO_FULL);
    const home = cargoOf(trip, 1000);
    assert.ok(home === CARGO_SOLD || home === CARGO_BOUGHT);
    assert.equal(cargoOf({ ...trip }, 1500), home, 'the same for every reader');
    seen.add(home);
    assert.equal(cargoOf({ ...trip, robbed: { t: 500 } }, 600), CARGO_ROBBED);
    assert.equal(cargoOf({ ...trip, robbed: { t: 500 } }, 400), CARGO_FULL, 'before the robbery, full');
  }
  assert.equal(seen.size, 2, 'some sold, some bought');
});

test('LW10 the train in file: the van (the first half of the armed) before the leader, the leader at the first horse\'s head (LEAD_N), each wagon\'s axle the mod\'s hitch (HITCHED_HORSE_LOCAL_Z) behind its horse along the way, a second team a wagon\'s length on, the rest behind - on the way out and home; all moving by day, standing at a halt (mutants: the order, the hitch, the tail, the direction)', () => {
  assert.equal(HITCH_N, HITCHED_HORSE_LOCAL_Z * NATIVE_PER_M);
  const way = straight();
  const leader = res('m'), a = res('a', 144), b = res('b', 141), c = res('c', 145), p = res('p');
  const trip = { id: 'L1.t0:9', kind: 'merchant', from: { blocks: 40 }, leader, party: [leader, a, b, c, p], way, backT0: 1e9 };
  const s0 = 5000;
  const out = trainOf(trip, { phase: 'out', s: s0 }, trip.party, 0);
  const z = (id) => out.people.find((x) => x.res.id === id).z;
  assert.ok(z('a') > s0 && z('b') > s0, 'the van before the leader');
  assert.ok(Math.abs(z('m') - s0) < 1e-6, 'the leader at the party\'s own place');
  assert.equal(out.horses.length, 2); assert.equal(out.wagons.length, 2);
  assert.ok(Math.abs(out.horses[0].z - (s0 - LEAD_N)) < 1e-6, 'the first horse a stride behind its leader');
  assert.ok(Math.abs(out.wagons[0].z - (out.horses[0].z - HITCH_N)) < 1e-6, 'its wagon on its shafts');
  assert.ok(Math.abs(out.horses[1].z - (out.wagons[0].z - WAGON_TAIL_N)) < 1e-6, 'the second team a wagon\'s length on');
  assert.ok(Math.abs(out.wagons[1].z - (out.horses[1].z - HITCH_N)) < 1e-6);
  assert.ok(z('c') < out.wagons[1].z && z('p') < z('c'), 'the rest behind, in order');
  assert.ok(Math.abs(z('p') - z('c') + WALK_GAP_N) < 1e-6);
  assert.ok(out.people.every((x) => x.moving) && out.wagons.every((w) => w.moving), 'all walking by day');
  assert.ok(out.wagons.every((w) => Math.abs(w.yaw) < 1e-9), 'facing the way out');
  const home = trainOf(trip, { phase: 'back', s: s0 }, trip.party, 0);
  assert.ok(home.horses[0].z > s0 && home.wagons[0].z > home.horses[0].z, 'home: behind is the other way');
  assert.ok(home.wagons.every((w) => Math.abs(Math.abs(w.yaw) - Math.PI) < 1e-9), 'facing home');
  const halted = trainOf(trip, { phase: 'out', s: s0, halt: true }, trip.party, 0);
  assert.ok(halted.wagons.every((w) => !w.moving) && halted.horses.every((h) => !h.moving), 'standing at a halt');
  // on a bend the axle stands on the way
  const bend = wayOf({ pixels: [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 1, y: 9 }, { x: 2, y: 9 }] });
  const bt = { ...trip, way: bend, from: { blocks: 4 } };
  for (const s of [10000, 20000, 33000, 40000, 50000, 60000]) {
    const t = trainOf(bt, { phase: 'out', s }, [leader], 0);
    const w = t.wagons[0], on = wayAt(bend, w.s);
    assert.ok(Math.hypot(w.x - on.x, w.z - on.z) < 1e-6, `the axle on the way at ${s}`);
  }
  // a pack horse, no wagon
  const ped = trainOf({ ...trip, kind: 'pedlar', from: { blocks: 4 }, party: [leader] }, { phase: 'out', s: s0 }, [leader], 0);
  assert.equal(ped.horses.length, 1); assert.equal(ped.wagons.length, 0);
});

test('LW10 the park at camp: each wagon CAMP_PARK_N beyond the ring facing the fire, its horse CAMP_HORSE_SIDE_N to its side; a pack horse by itself; standing; the same for every reader (mutants: the reach, the face, the horse)', () => {
  const trip = { id: 'L2.t1:4', kind: 'merchant', from: { blocks: 40 }, backT0: 1e9 };
  const r = 90;
  const c = campTeam(trip, 1000, 2000, r, 0);
  assert.equal(c.wagons.length, 2); assert.equal(c.horses.length, 2);
  for (const w of c.wagons) {
    assert.ok(Math.abs(Math.hypot(w.x - 1000, w.z - 2000) - (r + CAMP_PARK_N)) < 1e-6);
    assert.ok(Math.abs(Math.atan2(1000 - w.x, 2000 - w.z) - w.yaw) < 1e-9, 'facing the fire');
    assert.equal(w.moving, false);
  }
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(Math.hypot(c.horses[i].x - c.wagons[i].x, c.horses[i].z - c.wagons[i].z) - CAMP_HORSE_SIDE_N) < 1e-6);
  assert.deepEqual(campTeam({ ...trip }, 1000, 2000, r, 0), c);
  const ped = campTeam({ ...trip, kind: 'pedlar' }, 0, 0, r, 0);
  assert.equal(ped.wagons.length, 0); assert.equal(ped.horses.length, 1);
});

test('LW10 the wheels turn with the distance walked - the mod\'s own turn by travel, wrapped - so every reader\'s stand at the same spoke (mutants: the metres, the wrap)', () => {
  const r = 0.45;
  for (const s of [0, 40, 400, 12345, 99999]) assert.equal(wheelAngleAt(s, r), wrapWheelAngle(wheelRotationDegrees(s / NATIVE_PER_M, r)));
  assert.notEqual(wheelAngleAt(400, r), wheelAngleAt(440, r));
  assert.ok(Math.abs(wheelAngleAt(1e6, r)) <= 180);
});

test('LW10 the teams drawn: each horse its own billboard batch posed by the pool, freed as it leaves; the nearest WAGONS_DRAWN wagons drawn with the pool\'s own draw, a NORMAL_GROUND_OFFSET up, tilted to the ground; a standing wagon\'s box on the collider in a bucket of its own, taken down when it moves and at clear (mutants: the cap, the box, the frees)', () => {
  assert.equal(WAGONS_DRAWN, 6);
  const made = [], destroyed = [], posed = [], drawnWagons = [], buckets = new Map();
  const renderer = { createBillboardBatch: (a, r, size) => { const b = { a, r, size, origin: null }; made.push(b); return b; }, destroyBillboardBatch: (b) => destroyed.push(b) };
  const pres = {
    horseArt: { ensureStationary: () => true, ensureWalk: () => {}, hasWalk: () => true },
    poseHorse: (b, eye, horse) => { posed.push(horse); b.size = { w: 3, h: 2 }; },
    wagonParts: () => ({ wheelRadius: 0.4, bounds: { min: [-1, 0, -2], max: [1, 1.5, 2] } }),
    drawWagon: (r, tex, pos, rot, tier, angle, grow) => { drawnWagons.push({ pos, rot, tier, angle, grow }); return true; },
  };
  const col = { addMesh: (k) => buckets.set(k, true), removeBucket: (k) => buckets.delete(k) };
  const teams = createRoadTeams({ renderer, presentation: () => pres, collider: () => col });
  const horses = [{ key: 'h1', feet: [0, 0, 0], yaw: 0, moving: true, speed: 1.1, distM: 5 }, { key: 'h2', feet: [5, 0, 0], yaw: 0, moving: false, speed: 0, distM: 9 }];
  const wagons = Array.from({ length: 8 }, (_, i) => ({ key: `w${i}`, feet: [i, 2, 0], front: [i, 3, 2], yaw: 0, moving: i !== 1, tier: 90, s: 400 * i, distM: 10 + i }));
  teams.sync(horses, wagons, { dt: 0.1, eye: [0, 1.6, -5] });
  assert.equal(made.length, 2); assert.equal(teams.batches().length, 2);
  teams.draw({});
  assert.equal(drawnWagons.length, WAGONS_DRAWN, 'the nearest six');
  assert.deepEqual(drawnWagons[0].pos, [0, 2 + NORMAL_GROUND_OFFSET, 0]);
  assert.equal(drawnWagons[2].angle, wheelAngleAt(800, 0.4));
  assert.ok(drawnWagons[0].rot.some((v, i) => i < 3 && Math.abs(v) > 1e-6), 'tilted up the slope');
  assert.deepEqual([...buckets.keys()], [wagonBucket('w1')], 'the standing wagon\'s box');
  // one horse gone, the standing wagon moving
  teams.sync([horses[0]], wagons.map((w) => ({ ...w, moving: true })), { dt: 0.1 });
  assert.equal(destroyed.length, 1, 'its batch freed');
  assert.equal(buckets.size, 0, 'the box taken down as it moves');
  teams.sync(horses, wagons, { dt: 0.1 });
  assert.equal(buckets.size, 1);
  teams.clear();
  assert.equal(buckets.size, 0); assert.equal(destroyed.length, 3, 'every batch freed at clear');
  assert.equal(teams.batches().length, 0);
  // under the Overworld nothing stands on the collider, and the teams are grown
  teams.sync(horses, wagons, { dt: 0.1, grow: 4, ground: false });
  assert.equal(buckets.size, 0);
  drawnWagons.length = 0; teams.draw({});
  assert.ok(drawnWagons.every((w) => w.grow === 4));
  teams.clear();
});

test('LW10 the roads\' layer lays the teams: a caravan on the road its train (its people in the train\'s places, its horse and its wagon handed to the teams), at camp its wagons parked; the teams cleared with the roads; the host hands the pool\'s pieces whatever the mod\'s switch says (mutants: the train, the park, the clear, the seam)', () => {
  const towns = [{ mapId: 1001, px: 100, py: 100, blocks: 40, type: 0, region: 17, people: 3, name: 'A' }, { mapId: 1002, px: 108, py: 100, blocks: 30, type: 0, region: 17, people: 3, name: 'B' }];
  const rosters = new Map();
  const world = {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r),
    routeOf: (a, b) => { const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py)); const pixels = []; for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) }); return { pixels, kinds: pixels.slice(1).map(() => 'road') }; },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
  };
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  let found = null;
  for (let day = 300; day < 360 && !found; day++) {
    for (const h of [10, 23]) {
      const t = day * DAY_MIN + h * 60;
      for (const tr of townTrips(towns[0], t, world, o) ?? []) {
        const at = partyAt(tr, t);
        if (tr.kind === 'merchant' && (at.phase === 'out' || at.phase === 'back') && !at.halt) { found ??= { tr, at, t }; }
      }
      if (found) break;
    }
  }
  assert.ok(found, 'a caravan on the road');
  const synced = [];
  const teams = { sync: (hs, ws) => synced.push({ hs, ws }), batches: () => [], draw: () => 0, clear: () => synced.push('clear') };
  const lists = [];
  const sprites = { sync: (list) => lists.push(list), batches: () => [], persons: () => [], bodyOf: () => null, clear: () => {} };
  const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => found.t, baseRate: () => CLASSIC_MINUTES_PER_SECOND, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => ({ x: found.at.x, z: found.at.z }), sprites: /** @type {any} */ (sprites), relations: () => createRelations(), memo: o.memo, teams: /** @type {any} */ (teams) });
  roads.frame(1 / 30, [found.at.x / 40, 1.6, found.at.z / 40]);
  const last = synced.filter((x) => x !== 'clear').pop();
  assert.ok(last.hs.some((h) => h.key.startsWith(found.tr.id)), 'its horse handed to the teams');
  assert.ok(last.ws.some((w) => w.key.startsWith(found.tr.id)), 'its wagon');
  const w = last.ws.find((x) => x.key.startsWith(found.tr.id));
  assert.equal(w.moving, !found.at.camp);
  roads.clear();
  assert.equal(synced[synced.length - 1], 'clear');
  const host = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(host, /teams: createRoadTeams\(\{ renderer, presentation: \(\) => hcc\.presentation, collider: \(\) => collider \}\)/);
  assert.match(host, /if \(livingRoads && livingWorldOn\(\) && _mode\(\) === 'exterior'\) livingRoads\.drawTeams\(renderer\);/);
  const pool = readFileSync(new URL('../src/scenes/horseCartPool.js', import.meta.url), 'utf8');
  assert.match(pool, /presentation: \{ wagonParts, horseArt, onChanged: \(\) => onChanged\?\.\(\), drawWagon, poseHorse: poseHorseBatch \}/);
});

test('AUDIT LW-II LW10: the wheels turn forward on the way home - the distance walked the way the wagon faces; the roads\' layer lays a train on the march in the train\'s own places, and a camped caravan\'s wagons parked CAMP_PARK_N beyond its ring, facing its fire (mutants: E8 the wheels home, F3 the people in the train, F3 the park)', () => {
  // E8: on the way home the axle's distance grows as the train walks on, so its wheels turn the way it goes
  const way = straight();
  const leader = res('m');
  const trip = { id: 'L1.t0:9', kind: 'merchant', from: { blocks: 4 }, leader, party: [leader], way, backT0: 0 };
  const a = trainOf(trip, { phase: 'back', s: 30000 }, [leader], 1).wagons[0], b = trainOf(trip, { phase: 'back', s: 29000 }, [leader], 1).wagons[0];
  assert.ok(b.s - a.s === 1000, 'a thousand on, a thousand walked');
  const out = trainOf(trip, { phase: 'out', s: 29000 }, [leader], 1).wagons[0], on = trainOf(trip, { phase: 'out', s: 30000 }, [leader], 1).wagons[0];
  assert.ok(on.s - out.s === 1000, 'and on the way out');
  const r = 0.45, step = (x, y) => ((wheelAngleAt(y, r) - wheelAngleAt(x, r) + 540) % 360) - 180;
  assert.ok(Math.sign(step(a.s, b.s)) === Math.sign(step(out.s, on.s)) && step(a.s, b.s) !== 0, 'the wheels turn the same way out and home');
  // F3: the layer, on the synthetic map - a caravan walking and one camped, near the player
  const { towns, world } = synthMap();
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const find = (h, ok) => {
    for (let day = 300; day < 420; day++) {
      const t = day * DAY_MIN + h * 60;
      for (const tn of towns) for (const tr of townTrips(tn, t, world, o) ?? []) { const at = partyAt(tr, t); if (tr.kind === 'merchant' && (at.phase === 'out' || at.phase === 'back') && !at.halt && !at.inn && ok(at, tr)) return { tr, at, t }; }
    }
    return null;
  };
  const lay = ({ t, at }) => {
    const synced = [], lists = [];
    const teams = { sync: (hs, ws) => synced.push({ hs, ws }), batches: () => [], draw: () => 0, clear: () => {} };
    const sprites = { sync: (list) => lists.push(list.map((m) => ({ ...m }))), batches: () => [], persons: () => [], bodyOf: () => null, clear: () => {} };
    const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => t, baseRate: () => CLASSIC_MINUTES_PER_SECOND, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => ({ x: at.x, z: at.z }), sprites: /** @type {any} */ (sprites), relations: () => createRelations(), memo: o.memo, teams: /** @type {any} */ (teams) });
    roads.frame(1 / 30, [at.x / 40, 1.6, at.z / 40]);
    return { list: lists[lists.length - 1], team: synced[synced.length - 1] };
  };
  const walking = find(12, (at, tr) => !at.camp && tr.party.length > 1);
  assert.ok(walking, 'a caravan on the march');
  const w = lay(walking);
  const train = trainOf(walking.tr, walking.at, membersAt(walking.tr, walking.t), walking.t);
  for (const p of train.people) {
    const body = w.list.find((m) => m.key === p.res.id);
    assert.ok(body, `${p.res.id} drawn`);
    assert.ok(Math.abs(body.feet[0] - p.x / 40) < 1e-9 && Math.abs(body.feet[2] - p.z / 40) < 1e-9, `${p.res.id} in the train's place`);
  }
  const camped = find(23, (at) => at.camp);
  assert.ok(camped, 'a caravan camped');
  const c = lay(camped);
  const ws = c.team.ws.filter((x) => x.key.startsWith(`${camped.tr.id}:w`));
  assert.ok(ws.length > 0, 'its wagons handed to the teams');
  const fires = c.list.filter((m) => /^fire:/.test(m.key));
  const people = c.list.filter((m) => camped.tr.party.some((p) => p.id === m.key));
  assert.ok(people.length > 0);
  for (const wg of ws) {
    const fire = fires.reduce((best, f) => (!best || Math.hypot(f.feet[0] - wg.feet[0], f.feet[2] - wg.feet[2]) < Math.hypot(best.feet[0] - wg.feet[0], best.feet[2] - wg.feet[2]) ? f : best), null);
    assert.ok(fire, 'its camp\'s fire');
    const ring = Math.hypot(people[0].feet[0] - fire.feet[0], people[0].feet[2] - fire.feet[2]);
    assert.ok(ring >= CAMP_RING_N / 40 - 1e-9, 'its people on the ring');
    assert.ok(Math.abs(Math.hypot(wg.feet[0] - fire.feet[0], wg.feet[2] - fire.feet[2]) - (ring + CAMP_PARK_N / 40)) < 1e-6, 'parked CAMP_PARK_N beyond the ring');
    assert.equal(wg.moving, false);
  }
});
