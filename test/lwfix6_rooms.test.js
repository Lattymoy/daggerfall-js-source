// LW-FIX6 (2026-10-05, bible/06-Systems/Living-World.md "LW-FIX6"): THE ROOMS' SEVEN - the deep audit found the
// player's own house peopled (DFU stands nobody in a house the player owns), the ways never asked indoors (a load made
// in a tavern or below left every trip waiting all visit), the room astir under the talk window, the room laid out from
// the player's feet (a load made upstairs stood the drinkers about the bed; another door or a peer laid it out anew), a
// table empty as the round began dealt mid-round, a greeting's rest kept against a clock gone back, and a quest's people
// stood on. Each pinned here, on mock rooms (test/lwfix1_review.test.js's), the synthetic town and map, and the hosts'
// own lines lifted and run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { synthMap } from './lwRoads.mjs';
import { LivingTown, GREET_REST_MIN } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { partiesNear, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { createLivingIndoors, soundRoom, INDOOR_CLEAR_M, INDOOR_DOOR_M } from '../src/scenes/livingIndoors.js';
import { createLivingRoads, ROAD_GREET_REST_MIN, ROAD_GREET_S } from '../src/scenes/livingRoads.js';
import { ROUND_S, lineMinutes, spotCircles, circleLine } from '../src/systems/livingWorld/meetups.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { ROAD_GREETINGS } from '../src/systems/livingWorld/lines.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lift = (src, re, what) => { const m = src.match(re); assert.ok(m, what); return m[1]; };

/** A mock room - a box, two floors (the ground at 0, an upper at 3) - and the indoor layer over a mock town. */
function rig({ inside = [], clock = 100 * DAY_MIN + 1200, origin = () => null, waysIn = undefined, greeting = () => null } = {}) {
  const st = { inside, clock };
  const collider = { move(q, dx, dy, dz) { q[0] = Math.max(-6.7, Math.min(6.7, q[0] + dx)); q[2] = Math.max(-4.7, Math.min(4.7, q[2] + dz)); q[1] += dy; }, raycast: () => null };
  const floorAt = (x, y) => (y >= 2.9 ? 3 : 0);
  const synced = [];
  const sprites = {
    sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); },
    persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res }, pos: x.feet }, pos: x.feet })),
    batches: () => [], clear() { synced.length = 0; },
  };
  const BEAT = { roundMin: ROUND_S * 2, lineMin: lineMinutes(2) };
  const town = {
    insideAt: () => st.inside.map((x) => ({ res: x, e: { kind: 'tavern', t0: 0, t1: 1e12 } })),
    dayOf: (t) => Math.floor((t - 240) / DAY_MIN), talkBeat: () => BEAT,
    lineCtx: () => ({ weather: null, hour: 20, news: null }), typeOf: () => BUILDING_TYPES.Tavern, greetingFor: (res, t) => greeting(res, t),
    o: { relations: () => createRelations() },
  };
  const layer = createLivingIndoors({
    sprites, building: () => ({ key: 7000, town }), collider: () => collider, floorAt, origin, waysIn,
    staticFeet: () => [], clock: () => st.clock, ready: () => true,
  });
  return { layer, synced, st, BEAT, collider, floorAt };
}
const RES = (i) => ({ id: `L9.${i}`, name: `Res${i} Lane`, job: 'labourer', cls: null });
const DOOR = [0, 0, -4.6];

test('LW-FIX6 a player\'s own room stands nobody of the living world - DFU\'s AddPeople stands nobody in a house the player owns; an online home (anyone\'s), a private room and a cabin likewise - the room\'s answer the people gate\'s own law, kept with the room; the host asks it (mutants: the home, the house, the private room, the answer unread)', () => {
  const m = rd('src/scenes/worldModes.js');
  const owned = lift(m, /\n\s*ctx\.ownedRoom = (!!\(restore\?\.privateRoom[^\n]*\)\)\)\);)\n/, 'the room\'s answer');
  assert.match(m, /isHouseOwned: \(key\) => home !== null \|\| isHouseOwned\(playerEntity\.houses \?\? \[\], building\?\.regionIndex \?\? 0, key\),   \/\/ HOME1/, 'the people gate\'s law, the one it mirrors');
  const houses = [{ region: 17, key: 41 }];
  const isHouseOwned = (list, region, key) => list.some((h) => h.region === region && h.key === key);
  const ask = ({ restore = null, hit = {}, building = { regionIndex: 17, buildingKey: 9 }, home = null }) =>
    new Function('restore', 'hit', 'building', 'home', 'isHouseOwned', 'playerEntity', `return ${owned}`)(restore, hit, building, home, isHouseOwned, { houses });
  assert.equal(ask({}), false, 'a stranger\'s house: theirs');
  assert.equal(ask({ building: { regionIndex: 17, buildingKey: 41 } }), true, 'the player\'s own house');
  assert.equal(ask({ home: { own: false } }), true, 'an online home - anyone\'s');
  assert.equal(ask({ restore: { privateRoom: 'r1' }, building: null }), true, 'a private room');
  assert.equal(ask({ hit: { sailingCabin: { uid: 'b1' } }, building: null }), true, 'a cabin');
  assert.equal(ask({ building: null }), false);
  const w = rd('src/scenes/world.js');
  const building = new Function('modes', 'livingTownOfMap', `return ${lift(w, /\n\s*building: (\(\) => \{ const b = modes\?\.interiorBuilding;[^\n]*?: null; \}),/, 'the host\'s building')}`);
  const town = { mapId: 5 };
  const modes = (ownedRoom) => ({ interiorBuilding: { buildingKey: 41, townMapId: 5 }, interiorCtx: { ownedRoom } });
  assert.deepEqual(building(modes(false), () => town)(), { key: 41, town }, 'another\'s: its residents');
  assert.equal(building(modes(true), () => town)(), null, 'the player\'s own: none');
});

test('LW-FIX6 the room laid out from the landing of the building\'s first door, whichever door was taken - a load made upstairs, another door or a peer lays out the same room, the same people in the same places; from the feet, the room upstairs; every door\'s landing kept clear (mutants: the first door, a floorless one, the landing unread, the ways in unkept, unpassed, unread, a floorless one kept)', () => {
  const m = rd('src/scenes/worldModes.js');
  const first = lift(m, /\n(\s*const waysIn = siblings\.map\([^\n]*\n\s*ctx\.landing = \[\.\.\.\(waysIn\[0\] \?\? landing\)\];\n\s*ctx\.waysIn = waysIn\.filter\(Boolean\);)\n/, 'the landing kept');
  assert.ok(m.indexOf('const waysIn = siblings.map(') > m.indexOf('if (!landing) { abandonContext(ctx); throw new Error(\'no interior landing\'); }') && m.indexOf('const waysIn = siblings.map(') < m.indexOf('      interiorCtx = ctx;'), 'kept with the room as it is published');
  const keep = new Function('siblings', 'interiorLanding', 'doorWorldPosition', 'standsOnFloor', 'ctx', 'landing', `${first}\nreturn ctx;`);
  const doorLanding = (pos) => (pos[0] === 99 ? null : [pos[0], 0, pos[2] + 1]);
  const doors = [{ door: { pos: [2, 0, -5] } }, { door: { pos: [-2, 0, -5] } }];
  assert.deepEqual(keep(doors, doorLanding, (d) => d.pos, () => true, {}, [-2, 0, -4]), { landing: [2, 0, -4], waysIn: [[2, 0, -4], [-2, 0, -4]] }, 'the first door\'s, not the one taken; every door\'s landing');
  assert.deepEqual(keep([{ door: { pos: [99, 0, 0] } }, ...doors], doorLanding, (d) => d.pos, () => true, {}, [-2, 0, -4]), { landing: [-2, 0, -4], waysIn: [[2, 0, -4], [-2, 0, -4]] }, 'a first door with no floor: the one taken, and no way in there');
  const w = rd('src/scenes/world.js');
  const origin = new Function('modes', `return ${lift(w, /\n\s*origin: (\(\) => modes\?\.interiorCtx\?\.landing \?\? null),/, 'the host\'s origin')}`);
  assert.deepEqual(origin({ interiorCtx: { landing: [1, 0, 2] } })(), [1, 0, 2]);
  assert.equal(origin({})(), null);
  const waysIn = new Function('modes', `return ${lift(w, /\n\s*waysIn: (\(\) => modes\?\.interiorCtx\?\.waysIn \?\? \[\]),/, 'the host\'s ways in')}`);
  assert.deepEqual(waysIn({ interiorCtx: { waysIn: [[1, 0, 2]] } })(), [[1, 0, 2]]);
  assert.deepEqual(waysIn({})(), []);
  // every way in clear of the room's places - the layer passes the host's to the sounding
  const box = rig();
  const all = soundRoom(DOOR, box.collider, box.floorAt, []);
  const other = all[all.length - 1];
  assert.ok(soundRoom(DOOR, box.collider, box.floorAt, [], [other]).every((p) => Math.hypot(p[0] - other[0], p[2] - other[2]) >= INDOOR_DOOR_M), 'none at another door');
  const second = rig({ inside: [RES(1)], origin: () => DOOR, waysIn: () => [other] });
  second.layer.frame(0.016, DOOR, 0, [0, 1.6, -4.6]);
  assert.ok(second.layer.spots().length && second.layer.spots().every((p) => Math.hypot(p[0] - other[0], p[2] - other[2]) >= INDOOR_DOOR_M), 'the layer keeps them clear');
  // the same room for the player come in at the door and the player loaded upstairs, once both read the landing
  const people = [RES(1), RES(2), RES(3), RES(4)];
  const placed = (feet, from) => {
    const r = rig({ inside: people, origin: () => from });
    r.layer.frame(0.016, feet, 0, [feet[0], feet[1] + 1.6, feet[2]]);
    return { spots: r.layer.spots(), at: r.layer.stood().map((s) => [s.id, s.at]).sort() };
  };
  const door = placed(DOOR, DOOR), upstairs = placed([3, 3, 2], DOOR);
  assert.ok(door.spots.length >= 4 && door.spots.every((p) => p[1] === 0), 'the ground floor sounded');
  assert.deepEqual(upstairs, door, 'loaded upstairs: the same room, the same people where they were');
  const fromFeet = placed([3, 3, 2], null);
  assert.ok(fromFeet.spots.length && fromFeet.spots.every((p) => p[1] === 3), 'from the feet: the floor upstairs, the drinkers about the bed');
  assert.notDeepEqual(placed([4, 0, 3], null).at, door.at, 'from the feet: another door, another room');
});

test('LW-FIX6 a table nobody stands at as the round begins deals nothing that round - two who come to it mid-round (in their stay since before the round, stood once the player looked away) talk from the next round, never beginning mid-script (mutant: the empty table dealt)', () => {
  const dry = rig({ inside: [RES(1), RES(2)] });
  dry.layer.frame(0.016, DOOR, 0, [0, 1.6, -4.6]);
  const [a, b] = dry.layer.stood();
  assert.equal(a.table, b.table, 'the pair at one table');
  const pair = [a, b].map((s) => ({ who: s.res, t0: 0, t1: 1e12 }));
  const key = `in:7000:${a.table}`, R = dry.BEAT.roundMin;
  // a round the pair would talk - and the next too
  let t = dry.st.clock;
  while (!(spotCircles(key, pair, t, R)[0]?.talks && spotCircles(key, pair, t + R, R)[0]?.talks)) t += R;
  const round0 = Math.floor(t / R) * R;
  const r = rig({ inside: [], clock: round0 + 0.1 });
  r.layer.frame(0.016, DOOR, 0, [0, 1.6, -4.6]);   // in as the round runs: nobody at any table
  r.st.inside = [RES(1), RES(2)];
  r.layer.frame(1, DOOR, Math.PI, [0, 1.6, -4.6]);   // the player looks away: the pair stood, mid-round
  assert.deepEqual(r.layer.stood().map((s) => s.table), [a.table, a.table], 'at the table empty as the round began');
  let heard = 0;
  for (let i = 0; i < 4; i++) {
    const tm = round0 + (i + 0.5) * r.BEAT.lineMin;
    if (tm >= round0 + R) break;
    r.st.clock = tm;
    r.layer.frame(0.016, DOOR, Math.PI, [0, 1.6, -4.6]);
    if (circleLine(spotCircles(key, pair, tm, R)[0], tm, r.BEAT.lineMin, { weather: null, hour: 20, news: null, room: 'tavern' })) heard++;
    assert.deepEqual(r.layer.speech([0, 1.6, -4.6]), [], 'silent till the next round');
  }
  assert.ok(heard > 0, 'a round they would have talked mid-script');
  // the next round: dealt as it begins, their talk
  const next = spotCircles(key, pair, round0 + R + 0.1, R)[0];
  let said = 0;
  for (let i = 0; i < 4; i++) {
    const tm = round0 + R + (i + 0.5) * r.BEAT.lineMin;
    if (tm >= round0 + 2 * R) break;
    r.st.clock = tm;
    r.layer.frame(0.016, DOOR, Math.PI, [0, 1.6, -4.6]);
    const want = circleLine(next, tm, r.BEAT.lineMin, { weather: null, hour: 20, news: null, room: 'tavern' });
    assert.deepEqual(r.layer.speech([0, 1.6, -4.6]).map((l) => l.text), want ? [want.text] : [], 'the next round\'s talk');
    if (want) said++;
  }
  assert.ok(said > 0, 'heard');
});

test('LW-FIX6 a greeting\'s rest is kept by the clock as it runs - a clock gone back (a load of an earlier save) forgets it: the room\'s, the street\'s and the road\'s word said again at once, never held till the clock passes the old one (mutants: each rest\'s clock)', () => {
  // the room's
  const T = 100 * DAY_MIN + 1200;
  const r = rig({ inside: [RES(1)], clock: T, greeting: (res, t) => `Hello at ${Math.floor(t)}.` });
  r.layer.frame(0.016, DOOR, 0, [0, 1.6, -4.6]);
  const at = r.layer.stood()[0].at;
  const by = [at[0] + 0.5, at[1], at[2]];
  r.layer.frame(0.016, by, 0, [by[0], 1.6, by[2]]);
  assert.deepEqual(r.layer.speech([by[0], 1.6, by[2]]).map((l) => l.text), [`Hello at ${T}.`]);
  r.st.clock = T + 30;
  r.layer.frame(5, by, 0, [by[0], 1.6, by[2]]);
  assert.deepEqual(r.layer.speech([by[0], 1.6, by[2]]), [], 'in its rest: no word');
  r.st.clock = T - 500;
  r.layer.frame(0.016, by, 0, [by[0], 1.6, by[2]]);
  assert.deepEqual(r.layer.speech([by[0], 1.6, by[2]]).map((l) => l.text), [`Hello at ${T - 500}.`], 'the clock gone back: said again');
  // the street's
  const { nav, buildings, doors } = synthTown();
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => T, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND,
  });
  const res = town.residents[0], person = { pos: [0, 0, 0] };
  town._now = T; town._greet(res, person, 1, true);
  assert.equal(town._greetings.length, 1);
  town._greetings = []; town._now = T + GREET_REST_MIN - 1; town._greet(res, person, 1, true);
  assert.equal(town._greetings.length, 0, 'in its rest');
  town._now = T - 500; town._greet(res, person, 1, true);
  assert.equal(town._greetings.length, 1, 'the clock gone back: said again');
  // the road's
  const { towns, world } = synthMap();
  const home = towns.find((x) => x.blocks >= 20);
  const t0 = 100 * DAY_MIN + 12 * 60;
  const pt = partiesNear(home.px, home.py, t0, world, { mpm: CALENDAR_MPM, memo: new Map() }, 6).parties[0];
  assert.ok(pt, 'a party on the road');
  const clock = { t: t0 };
  const sprites = { sync() {}, batches: () => [], persons: () => [], bodyOf: (id) => ({ person: { pos: [0, 0, 0], living: { id } } }), clear() {} };
  const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => clock.t, baseRate: () => CLASSIC_MINUTES_PER_SECOND, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: pt.at.x, z: pt.at.z }), sprites, relations: () => createRelations() });
  const eye = [pt.at.x / 40, 1.6, pt.at.z / 40];
  const leader = pt.trip.party[0].id;
  const word = () => roads.speech(eye, 1e9).filter((l) => l.person.living.id === leader && ROAD_GREETINGS.stranger.includes(l.text)).length;
  roads.frame(1 / 30, eye); roads.frame(1 / 30, eye);
  assert.equal(word(), 1, 'a word');
  roads.frame(ROAD_GREET_S + 1, eye);
  assert.equal(word(), 0, 'gone; in its rest');
  assert.ok(ROAD_GREET_REST_MIN > 1);
  clock.t = t0 - 0.01;
  roads.frame(1 / 30, eye);
  assert.equal(word(), 1, 'the clock gone back: said again');
});

test('LW-FIX6 the hosts: the ways asked in the modal frame too (a load made in a tavern or below asked two and never again), the room held under the talk window as the street is, and the quest\'s people kept clear of the room\'s places (mutants: the ways indoors, the hold, the quest\'s feet, the dead quest stand, each read)', () => {
  const w = rd('src/scenes/world.js');
  const at = w.indexOf('    if (modes.frame(dt, now)) {');
  const modal = w.slice(at, w.indexOf('\n      return;\n    }\n', at));
  assert.ok(modal.length > 0 && modal.length < 20000, 'the modal frame');
  const ways = modal.indexOf('      livingWays.frame(); livingMemoFresh();   // AUDIT-E2');
  assert.ok(ways > 0 && ways < modal.indexOf('      livingDiversStep(now);'), 'asked before the deep and the rooms read the trips');
  assert.match(modal, /\n\s*livingIndoorsStep\(townTalk\.overlayActive \? 0 : dt\);/, 'held under a talk');
  assert.match(w, /livingRoadsOf\(\)\.frame\(townTalk\.overlayActive \? 0 : dt, /, 'as the road and the street are');
  // a room stepped at nought runs nothing: nobody stirs, no word runs out
  const r = rig({ inside: [RES(1)] });
  r.layer.frame(0.016, DOOR, 0, [0, 1.6, -4.6]);
  const where = r.layer.stood()[0].at;
  for (let i = 0; i < 400; i++) r.layer.frame(0, DOOR, 0, [0, 1.6, -4.6]);
  assert.deepEqual([r.layer.stood()[0].walking, r.layer.stood()[0].at], [false, where], 'held');
  // the quest's people: the modes' answer and the host's keep-clear
  const m = rd('src/scenes/worldModes.js');
  const questFeet = (mode, questFlats) => new Function('mode', 'questFlats', `return ${lift(m, /\n\s*interiorQuestFeet: (\(\) => \(mode === 'interior' \? questFlats[^\n]*? : \[\]\)),/, 'the modes\' quest feet')}`)(mode, questFlats)();
  const flats = [{ x: 1, y: 0, z: 2, dead: false, active: true }, { x: 5, y: 0, z: 5, dead: true, active: true }, { x: NaN, z: 0 }];
  assert.deepEqual(questFeet('interior', flats), [[1, 0, 2]], 'the standing ones');
  assert.deepEqual(questFeet('exterior', flats), []);
  const staticFeet = new Function('modes', `return ${lift(w, /\n\s*staticFeet: (\(\) => [^\n]*?\.concat\(modes\?\.interiorQuestFeet\?\.\(\) \?\? \[\]\)),/, 'the host\'s static feet')}`);
  const room = rig();
  const spots = soundRoom(DOOR, room.collider, room.floorAt, []);
  const quest = spots[2];
  const feet = staticFeet({ interiorCtx: { people: [{ x: 9, y: 0, z: 9 }, { x: 8, y: 0, z: 8, active: false }] }, interiorQuestFeet: () => [quest] })();
  assert.deepEqual(feet, [[9, 0, 9], quest]);
  const kept = soundRoom(DOOR, room.collider, room.floorAt, feet);
  assert.ok(kept.every((p) => Math.hypot(p[0] - quest[0], p[2] - quest[2]) >= INDOOR_CLEAR_M), 'no place on the quest\'s person');
});
