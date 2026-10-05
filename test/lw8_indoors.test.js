// LW8 (2026-10-05, bible/06-Systems/Living-World.md "LW8", Mac: NPCs "dynamically all have tasks ... perform
// activities"): THE DOORS OPEN - the residents whose day has them inside a building stood in its room when the player is
// in it: who (the town's own word), where (the room sounded through its collider), coming and going unseen, talked to
// through the street's own ray. The town is the synthetic one (test/lwTown.mjs); the room a mock collider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown, WITNESS_M } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { isOutdoor, DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations, EVENTS } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { createLivingIndoors, soundRoom, INDOOR_TICK_S, INDOOR_FAN, INDOOR_SPREAD_M, INDOOR_APART_M, INDOOR_CLEAR_M, INDOOR_DOOR_M, INDOOR_MAX, INDOOR_SEEN_M } from '../src/scenes/livingIndoors.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

function makeTown(extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, ...extra,
  });
  return { town, clock, buildings };
}

test('LW8 who is inside: each resident whose day has them in at a building\'s door - the evening\'s drinkers at the tavern, a household at home - never one asleep, never the building\'s own staff at their work where it is no house, never the taken, the gone, the dead or one still in the street; in the order of their ids (mutants: the building, the outdoor, the asleep, the staff, the house, the dead, the late, the order)', () => {
  const { town, buildings } = makeTown();
  const tavern = buildings.find((b) => b.type === BUILDING_TYPES.Tavern).key;
  // an evening of the town's days: who the plans put in at the tavern's door, and who of them are its staff
  let found = null;
  for (let day = 100; day < 130 && !found; day++) {
    for (let h = 18; h < 24 && !found; h += 0.25) {
      const t = day * DAY_MIN + Math.round(h * 60);
      const inn = town.insideAt(tavern, t);
      if (inn.length >= 2) found = { t, inn };
    }
  }
  assert.ok(found, 'an evening at the tavern with two or more inside');
  const { t, inn } = found;
  for (const { res, e } of inn) {
    assert.equal(e.at.building, tavern, `${res.id} at the tavern's door`);
    assert.ok(!isOutdoor(e) && e.kind !== 'walk' && e.kind !== 'sleep', `${res.id}: indoors and awake (${e.kind})`);
    assert.ok(!(e.kind === 'work' && res.work === tavern), `${res.id}: not its staff at work`);
  }
  assert.deepEqual(inn.map((x) => x.res.id), [...inn.map((x) => x.res.id)].sort(), 'in the order of their ids');
  // the staff: the tavern's own at work are left to its static people
  const staff = town.peopleOf(Math.floor((t - 240) / DAY_MIN)).filter((r) => r.work === tavern && town.entryOf(r, t)?.e.kind === 'work');
  for (const r of staff) assert.ok(!inn.some((x) => x.res.id === r.id), `${r.id}: the tavern's staff`);
  // a house's own at home at night: asleep, none; awake at home, there
  const houses = buildings.filter((b) => b.type >= BUILDING_TYPES.House1 && b.type <= BUILDING_TYPES.House6).map((b) => b.key);
  const night = 101 * DAY_MIN + 240 + 60;   // five in the morning
  for (const h of houses) for (const { e } of town.insideAt(h, night)) assert.notEqual(e.kind, 'sleep');
  let home = null;
  for (const h of houses) for (let m = 0; m < DAY_MIN && !home; m += 30) { const got = town.insideAt(h, 101 * DAY_MIN + 240 + m); if (got.length) home = { h, got }; }
  assert.ok(home && home.got.every(({ e }) => e.at.building === home.h), 'a household at home awake');
  // the dead, the taken, the late
  const victim = inn[0].res;
  const d = makeTown({ deadAt: (r, tm) => r.id === victim.id && tm > 0 });
  assert.ok(!d.town.insideAt(tavern, t).some((x) => x.res.id === victim.id), 'a hand\'s dead: never inside');
  const k = makeTown();
  k.town._now = t;
  k.town._take(victim);
  assert.ok(!k.town.insideAt(tavern, t).some((x) => x.res.id === victim.id), 'taken for the day: not inside');
  const l = makeTown();
  const where = l.town.where.bind(l.town);
  l.town.where = (res, tm, search) => (res.id === victim.id ? { x: 0, z: 0, yaw: 0, moving: true } : where(res, tm, search));
  assert.ok(!l.town.insideAt(tavern, t).some((x) => x.res.id === victim.id), 'still in the street, a walk running late');
  assert.ok(l.town.insideAt(tavern, t).length === inn.length - 1);
});

/** A mock room: a box of `w` by `d` metres about the origin, a flat floor at 0 (a hole where `hole` says). */
function room({ w = 12, d = 10, hole = () => false, low = () => false } = {}) {
  const collider = {
    move(q, dx, dy, dz) { q[0] = Math.max(-w / 2 + 0.3, Math.min(w / 2 - 0.3, q[0] + dx)); q[2] = Math.max(-d / 2 + 0.3, Math.min(d / 2 - 0.3, q[2] + dz)); q[1] += dy; },
    raycast: () => null,
  };
  const floorAt = (x, y, z) => (hole(x, z) ? null : low(x, z) ? -2 : 0);
  return { collider, floorAt };
}

test('LW8 the room sounded: from the way in, a fan of INDOOR_FAN directions walked out to INDOOR_SPREAD_M through the collider (never through a wall) and landed on its floor - each spot INDOOR_APART_M from every other, INDOOR_CLEAR_M from the static people and INDOOR_DOOR_M from the way in; no floor, or another floor (a stair\'s foot), no spot (mutants: the fan, the walls, the floor, the apart, the clear, the door, the other floor)', () => {
  assert.equal(INDOOR_FAN, 12);
  assert.deepEqual([...INDOOR_SPREAD_M], [2.4, 3.8, 5.2, 6.6]);
  assert.equal(INDOOR_APART_M, 1.3);
  assert.equal(INDOOR_CLEAR_M, 1.1);
  assert.equal(INDOOR_DOOR_M, 1.8);
  const r = room();
  const statics = [[2, 0, 2], [-3, 0, 1]];
  const spots = soundRoom([0, 0, 0], r.collider, r.floorAt, statics);
  assert.ok(spots.length >= 10, `a room's worth (${spots.length})`);
  for (const p of spots) {
    assert.ok(Math.abs(p[0]) <= 6 && Math.abs(p[2]) <= 5, 'inside the walls');
    assert.equal(p[1], 0, 'on the floor');
    assert.ok(Math.hypot(p[0], p[2]) >= INDOOR_DOOR_M, 'clear of the way in');
    for (const s of statics) assert.ok(Math.hypot(p[0] - s[0], p[2] - s[2]) >= INDOOR_CLEAR_M, 'clear of the static people');
    for (const q of spots) if (q !== p) assert.ok(Math.hypot(p[0] - q[0], p[2] - q[2]) >= INDOOR_APART_M, 'apart');
  }
  const holed = room({ hole: (x) => x > 0 });
  assert.ok(soundRoom([0, 0, 0], holed.collider, holed.floorAt).every((p) => p[0] <= 0), 'no floor, no spot');
  const stair = room({ low: (x, z) => z > 0 });
  assert.ok(soundRoom([0, 0, 0], stair.collider, stair.floorAt).every((p) => p[2] <= 0), 'another floor: no spot');
  const narrow = room({ w: 3, d: 3 });
  assert.deepEqual(soundRoom([0, 0, 0], narrow.collider, narrow.floorAt), [], 'a closet: every spot the walls allow is in the way in');
});

/** An indoors layer over a mock town, room and sprites. */
function indoorRig({ inside = [], clock = 1000 } = {}) {
  const r = room();
  const synced = [];
  const sprites = {
    sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); },
    persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res } }, pos: x.feet })),
    batches: () => synced.map((x) => x.key),
    clear() { synced.length = 0; this.cleared = (this.cleared ?? 0) + 1; },
    cleared: 0,
  };
  const rel = createRelations();
  const st = { inside, building: 7000, clock, ready: true };
  const town = { insideAt: (key) => (key === 7000 ? st.inside.map((res) => ({ res, e: { kind: 'tavern' } })) : []), dayOf: (t) => Math.floor((t - 240) / 1440), o: { relations: () => rel } };
  const layer = createLivingIndoors({
    sprites, building: () => (st.building == null ? null : { key: st.building, town }),
    collider: () => r.collider, floorAt: r.floorAt, origin: () => null, staticFeet: () => [], clock: () => st.clock, ready: () => st.ready,
  });
  return { layer, sprites, synced, st, rel };
}
const RES = (i) => ({ id: `L9.${i}`, name: `Res ${i}`, cls: i % 2 ? 140 : null });

test('LW8 the residents stood: on the way in all the day has inside stand at once, each on its own spot in their own clothes (no class) facing into the room, to INDOOR_MAX; who comes or goes later waits for the player to look away (or be INDOOR_SEEN_M off); read every INDOOR_TICK_S; another building, none, or the room not whole: cleared (mutants: the arrival, the spots, the unarmed, the facing, the cap, the unseen, the tick, the clear)', () => {
  assert.equal(INDOOR_TICK_S, 1);
  assert.equal(INDOOR_MAX, 12);
  assert.equal(INDOOR_SEEN_M, 14);
  const rig = indoorRig({ inside: [RES(1), RES(2), RES(3)] });
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.equal(rig.layer.size, 3, 'all at once on the way in');
  const stood = rig.layer.stood();
  assert.equal(new Set(stood.map((s) => JSON.stringify(s.at))).size, 3, 'each its own spot');
  assert.ok(stood.every((s) => s.res.cls === null), 'in their own clothes');
  assert.equal(rig.synced.length, 3);
  // facing into the room - one alone (LW8b: those at a table face one another, test/lw8b_talk.test.js)
  const lone = indoorRig({ inside: [RES(1)] });
  lone.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const c = lone.layer.spots().reduce((a, p) => [a[0] + p[0], a[1] + p[2]], [0, 0]).map((v) => v / lone.layer.spots().length);
  for (const x of lone.synced) assert.ok(Math.abs(x.yaw - Math.atan2(c[0] - x.feet[0], c[1] - x.feet[2])) < 1e-9, 'facing into the room');
  assert.equal(lone.synced.length, 1);
  // one more comes: the player at the west wall facing the room, every spot in view - it waits; turned to the wall, it stands
  const WALL = [-5.6, 0, 0], EAST = Math.PI / 2, WEST = -Math.PI / 2;
  rig.st.inside = [RES(1), RES(2), RES(3), RES(4)];
  rig.layer.frame(INDOOR_TICK_S, WALL, EAST, [-5.6, 1.6, 0]);
  rig.layer.frame(0.016, WALL, EAST, [-5.6, 1.6, 0]);
  assert.equal(rig.layer.size, 3, 'in view: it waits');
  rig.layer.frame(0.016, WALL, WEST, [-5.6, 1.6, 0]);
  assert.equal(rig.layer.size, 4, 'looked away from: it stands');
  // one goes: in view it stays, looked away from it is gone
  rig.st.inside = [RES(1), RES(2), RES(4)];
  rig.layer.frame(INDOOR_TICK_S, WALL, EAST, [-5.6, 1.6, 0]);
  assert.ok(rig.layer.stood().some((s) => s.id === 'L9.3'), 'in view: the leaver stays');
  rig.layer.frame(0.016, WALL, WEST, [-5.6, 1.6, 0]);
  assert.ok(!rig.layer.stood().some((s) => s.id === 'L9.3'), 'looked away from: gone');
  // the tick: who is inside is not read every frame
  const tick = indoorRig({ inside: [RES(1)] });
  tick.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  tick.st.inside = [RES(1), RES(2)];
  tick.layer.frame(0.1, [0, 0, 0], Math.PI, [0, 1.6, 0]);
  assert.equal(tick.layer.size, 1, 'not read again before INDOOR_TICK_S');
  tick.layer.frame(INDOOR_TICK_S, [0, 0, 0], Math.PI, [0, 1.6, 0]);
  tick.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  tick.layer.frame(0.016, [0, 0, 0], Math.PI / 2, [0, 1.6, 0]);
  tick.layer.frame(0.016, [0, 0, 0], -Math.PI / 2, [0, 1.6, 0]);
  assert.equal(tick.layer.size, 2, 'read on its beat');
  // the cap
  const many = indoorRig({ inside: Array.from({ length: 20 }, (_, i) => RES(i + 10)) });
  many.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.ok(many.layer.spots().length > INDOOR_MAX, 'room for more than the cap');
  assert.equal(many.layer.size, INDOOR_MAX);
  // cleared: another building, none, the room not whole
  rig.st.building = 7001;
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.equal(rig.layer.size, 0, 'another building: its own (none here)');
  rig.st.building = null;
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.ok(rig.sprites.cleared >= 2 && rig.layer.size === 0, 'no building: cleared');
  const nr = indoorRig({ inside: [RES(1)] });
  nr.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  nr.st.ready = false;
  nr.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.equal(nr.layer.size, 0, 'the room not whole: cleared');
});

test('LW8 talk and a caught hand: the bodies are talk seats in the street\'s shape, and a hand caught in a purse here is the crime in the regard of the one robbed and of everyone in the room within WITNESS_M (mutants: the robbed, the room, the reach)', () => {
  const rig = indoorRig({ inside: [RES(1), RES(2), RES(3)] });
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const seats = rig.layer.seats();
  assert.equal(seats.length, 3);
  assert.ok(seats.every((s) => s.person.living.id && Array.isArray(s.pos)));
  // a far one: past the witness reach
  rig.synced[2].feet = [WITNESS_M + 30, 0, 0];
  const robbed = seats[0].person;
  robbed.pos = rig.synced[0].feet;
  assert.equal(rig.layer.caught(robbed), robbed.living.id);
  const day = Math.floor((1000 - 240) / 1440);
  assert.equal(rig.rel.regard(robbed.living.id, day), EVENTS.crime, 'the robbed');
  assert.equal(rig.rel.regard(rig.synced[1].res.id, day), EVENTS.crime, 'one in the room near');
  assert.equal(rig.rel.regard(rig.synced[2].res.id, day), 0, 'one past the reach');
  assert.equal(rig.layer.caught({ living: null }), null);
});

test('LW8 the hosts: the building\'s press offers a resident in the room before the ladder\'s own winner (the street\'s talk ray through townTalk.tryActivate) and its billboard pass draws them; the streaming host stands the layer in a building of a living town (the room\'s collider, its floor, its static people, the sky\'s clock), steps it in the modal frame, frees it in the street, and its door answers the regard (mutants: each seam)', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(_enemyArm\(RAY_DISTANCE, _pick\?\.distance \?\? Infinity\)\) return true;\n\s*if \(host\.livingPersonsAct\?\.\(eye, dir, _pick\?\.distance \?\? Infinity\)\) return true;/);
  assert.match(m, /const livingInside = host\.livingBillboards\?\.\(\) \?\? \[\];[^\n]*\n\s*if \(livingInside\.length\) renderer\.drawBillboards\(livingInside, camRight, UP_Y\);/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /livingBillboards: \(\) => \(livingIndoors\?\.batches\(\) \?\? \[\]\),/);
  assert.match(w, /livingPersonsAct: \(eye, dir, nearer\) => !!livingIndoors\?\.size && townTalk\.tryActivate\(eye, dir, livingIndoors\.seats\(\), nearer\),/);
  assert.match(w, /if \(!livingWorldOn\(\) \|\| _mode\(\) !== 'interior'\) \{ if \(livingIndoors\?\.size \|\| livingIndoors\?\.spots\(\)\.length\) livingIndoors\.clear\(\); return; \}/);   // LW-FIX1: an empty room too
  assert.match(w, /building: \(\) => \{ const b = modes\?\.interiorBuilding; const town = b && !modes\?\.interiorCtx\?\.ownedRoom \? livingTownOfMap\(b\.townMapId \?\? 0\) : null; return b && town \? \{ key: b\.buildingKey, town \} : null; \},/);   // AUDIT-E1: never a player's own room
  assert.match(w, /floorAt: \(x, y, z\) => \{ const d = modes\?\.interiorCollider\?\.raycast\(\[x, y, z\], \[0, -1, 0\], 3\); return Number\.isFinite\(d\) \? y - d : null; \},/);
  assert.match(w, /staticFeet: \(\) => \(modes\?\.interiorCtx\?\.people \?\? \[\]\)\.filter\(\(p\) => p\.active !== false\)\.map\(\(p\) => \[p\.x, p\.y, p\.z\]\)\.concat\(modes\?\.interiorQuestFeet\?\.\(\) \?\? \[\]\),/);   // AUDIT-E7: and the quest's
  assert.match(w, /if \(p\.population instanceof LivingTown && \(p\.population\.o\.town\.mapId >>> 0\) === \(mapId >>> 0\)\) return p\.population;/);
  assert.match(w, /livingIndoorsStep\(townTalk\.overlayActive \? 0 : dt\);   \/\/ LW8/);   // AUDIT-E3: held under a talk
  assert.match(w, /if \(livingIndoors\?\.size \|\| livingIndoors\?\.spots\(\)\.length\) livingIndoors\.clear\(\);   \/\/ LW8: the street again/);   // LW-FIX1: an empty room too
  assert.match(w, /caught: \(p\) => livingIndoors\?\.caught\(p\) \?\? null,/);
  assert.match(w, /refuses: \(p\) => livingIndoors\?\.town\(\)\?\.refuses\(p\) \?\? null,/);
  assert.match(w, /toned: \(p, tone\) => livingIndoors\?\.town\(\)\?\.toned\(p, tone\) \?\? null,/);
});
