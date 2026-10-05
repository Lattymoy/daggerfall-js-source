// LW-FIX4 (2026-10-05, bible/06-Systems/Living-World.md "LW-FIX4"): THE TURNS' ELEVEN - the deep audit found the
// character's turns re-rolling the pure world (a spare took a trip off the road, moved its fight, met its company again
// below), a won fight stood twice, a fated ally fighting beside the player never spared and their body drawn beside
// them, one struck down drawing on the player again a second later, the fight's election centred on each player, a peer's
// fight's allies doubled, a halt running past its leg's arrival, the trips' memo unbounded below, and the dead of a
// fight or a dive at the deep's hour, not theirs (stood again alive; their bodies taken). Each pinned here, on the
// synthetic map (test/lwRoads.mjs - the host's composition, `diced` among it) and mock pools.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { livingMap, partiesOver } from './lwRoads.mjs';
import { placeAt, turnKey } from '../src/systems/livingWorld/lives.js';
import { troubleOf, troubledTrip, HALT_MIN, FIGHT_MIN } from '../src/systems/livingWorld/trouble.js';
import { placeCycle, membersAt, partyAt, remainsNear, CALENDAR_MPM, NATIVE_PIXEL, TRIP_REACH_PX } from '../src/systems/livingWorld/trips.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { createRoadFights, ENDED_MAX } from '../src/scenes/roadFights.js';
import { createRoadStands } from '../src/scenes/roadStands.js';
import { createDungeonDivers } from '../src/scenes/dungeonDivers.js';
import { createLivingRoads, ROADS_TOWNS_PER_FRAME, ROADS_VIEW_PX } from '../src/scenes/livingRoads.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));

test('LW-FIX4 a turn never re-rolls the pure world: `diced` the dice\'s own death of a cycle (the turns of it aside); a fated party the player spares keeps its trip and its trouble\'s whole shape - the leg, the hour, the place, the foes, the halt - and only its end moves (the spared alive, a spared leader\'s party standing) (mutants: diced read through the turns, the shape off the turned dead, a spare taking the trip)', () => {
  const adv = { id: 'L7.t1', town: 7, slot: 1, job: 'adventurer', roll: 't' };
  const key = turnKey(adv, 37);
  assert.deepEqual([placeAt(adv, 37, {}).dies, placeAt(adv, 37, {}).diced], [true, true], 'the dice: cycle 37');
  const spared = placeAt(adv, 37, { spared: new Set([key]) });
  assert.deepEqual([spared.dies, spared.diced], [false, true], 'spared: the road takes them not; the dice still say what they said');
  // a fated party on the map, and the same map with the fated spared
  const map = livingMap();
  const all = partiesOver(map, 400, 470);
  const trip = all.find((t) => t.enc && t.enc.dead.length && t.enc.dead.includes(t.leader.id) && !t.enc.camp);
  assert.ok(trip, 'a party whose leader the road takes');
  const roster = map.world.rosterOf(map.byId.get(trip.leader.town));
  const place = roster.find((r) => r.slot === trip.leader.slot) ?? trip.leader;
  const k = placeCycle(place, roster, Math.floor(trip.outT0 / DAY_MIN), 1);
  const turned = livingMap({ turns: { spared: new Set([turnKey(place, k)]) } });
  const raw = { ...trip, enc: undefined, halt: undefined, fallen: undefined, turned: undefined };
  const was = troubleOf(raw, map.trouble), now = troubleOf(raw, turned.trouble);
  for (const f of ['id', 'leg', 'camp', 't0', 't1', 'fightEnd', 's', 'level', 'shape']) assert.deepEqual(now[f], was[f], `the trouble's ${f} unmoved`);
  assert.deepEqual(now.foes, was.foes, 'the same foes');
  assert.ok(!now.dead.includes(trip.leader.id), 'the leader alive');
  assert.deepEqual([was.kind, now.kind], ['fell', 'won'], 'and the party stood');
  assert.equal(now.t1 - now.t0, HALT_MIN.fell, 'its halt the dice\'s');
  // the trip itself: a fated slot sets out whatever its chance said - a spare never takes the trip away
  assert.equal(turned.world.fated(place, k), true, 'still fated by the dice');
});

test('LW-FIX4 the deep\'s shape the dice\'s too: a dive whose fated leader the player spared comes out at the fight\'s end all the same - never diving on to be met a second time; a company that made for the surface is not met again this visit (mutants: the dive\'s end off the turned kind, the ended company met again)', async () => {
  const trip = { id: 'L5.t2:60', leader: { id: 'L5.t2', name: 'Ada Lark' }, party: [{ id: 'L5.t2', name: 'Ada Lark', cls: 140 }], way: { len: 1000, pixels: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    trim0: 0, trim1: 0, pace: 10, outT0: 0, outT1: 100, backT0: 900, backT1: 1000, dive: { t0: 100, t1: 900 }, to: { dungeonType: 3 } };
  const enc = { id: 'L5.t2:60:e', leg: 'dive', t0: 400, t1: 400 + HALT_MIN.fell, fightEnd: 400 + FIGHT_MIN.fell, s: 0, kind: 'won', shape: 'fell', dead: [], foes: [] };
  const out = troubledTrip(trip, enc);
  assert.equal(out.backT0, enc.t1, 'out at the fight\'s end, the spared leader with them');
  assert.equal(troubledTrip(trip, { ...enc, shape: 'won' }).backT0, 900, 'a dive the dice never cut runs its hours');
  // the company met, made for the surface, still listed: not met again till the next visit
  const pool = new Set(), spawned = [];
  const rel = createRelations();
  const divers = createDungeonDivers({
    spawn: async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {}, ai: {} }; pool.add(rec); spawned.push(rec); return rec; },
    remove: (rec) => pool.delete(rec), inPool: (rec) => pool.has(rec), leader: () => ({ feet: [0, 0, 0], yaw: 0 }), spot: (f, dx, dz) => [f[0] + dx, 0, f[2] + dz],
    owner: () => true, relations: () => rel, turnKeyOf: (res) => `${res.id}@K`, dies: () => false, day: () => 1,
  });
  const company = { trip: { ...trip, backT0: 500 }, members: trip.party };
  divers.frame([company], 450);
  await settle();
  assert.equal(spawned.length, 1);
  divers.frame([company], 500);
  assert.equal(divers.size, 0, 'made for the surface');
  divers.frame([company], 501);
  await settle();
  assert.equal(spawned.length, 1, 'not met again this visit');
  divers.clear();
  divers.frame([company], 502);
  await settle();
  assert.equal(spawned.length, 2, 'a new visit meets what the dive lists');
});

/** A fight layer over a mock pool (LW4b's rig). */
function fightRig({ fated = () => false } = {}) {
  const pool = new Set(), spawned = [], removed = [], died = [];
  const rel = createRelations();
  const fights = createRoadFights({
    spawn: async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {} }; pool.add(rec); spawned.push(rec); return rec; },
    remove: (rec) => { pool.delete(rec); removed.push(rec); }, inPool: (rec) => pool.has(rec),
    owner: () => true, ready: () => true, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], clock: () => 500 * DAY_MIN, relations: () => rel,
    turnKeyOf: (res) => `${res.id}@K`, dies: (res) => fated(res), died: (res, t) => died.push([res.id, t]),
  });
  return { fights, pool, spawned, removed, rel, died };
}
const fightTrip = (extra = {}) => ({
  id: 'L9.t1:50', leader: { id: 'L9.t1', name: 'Ada Lark' },
  party: [{ id: 'L9.t1', name: 'Ada Lark', cls: null }, { id: 'L9.t4', name: 'Bo Reed', cls: 140, level: 9, sex: 'male' }, { id: 'L9.t5', name: 'Cy Fenn', cls: 135, level: 7, sex: 'female' }],
  enc: { id: 'L9.t1:50:e', foes: [7, 7], level: 6, t0: 1000, t1: 1060, fightEnd: 1025, x: 40000, z: 80000 }, fallen: [], ...extra,
});

test('LW-FIX4 a fight ENDED here is never stood again (a re-read halt running past the one it stood on stood it twice); one cut down beside the player DIED at their side at that minute (the host\'s hand turn) and their body stays the pool\'s; a fated ally standing at the win is spared though the road had them fall before it - and their remains are not drawn beside them while they fight (mutants: the ended unread, the bound, the hand turn, the dead taken out, the standing allies unread, the remains drawn)', async () => {
  assert.equal(ENDED_MAX, 64);
  const trip = fightTrip();
  const at = { x: trip.enc.x, z: trip.enc.z, fight: true };
  const here = { x: at.x + 50 * 40, z: at.z };
  const rig = fightRig();
  rig.fights.frame([{ trip, at }], here, 1001);
  await settle();
  const foes = rig.spawned.filter((r) => !r.o.allied), allies = rig.spawned.filter((r) => r.o.allied);
  allies[1].dead = true;
  rig.fights.frame([], here, 1004);
  assert.deepEqual(rig.died, [['L9.t5', 1004]], 'died at the player\'s side, at that minute');
  for (const f of foes) f.dead = true;
  rig.fights.frame([], here, 1010);
  rig.fights.frame([], here, trip.enc.t1);
  assert.equal(rig.fights.size, 0, 'walked on');
  assert.ok(rig.pool.has(allies[1]), 'the one cut down: the pool\'s own');
  const n = rig.spawned.length;
  rig.fights.frame([{ trip, at }], here, trip.enc.t1 + 1);   // the re-read trip says it fights on
  await settle();
  assert.equal(rig.spawned.length, n, 'never stood twice');
  // a fated ally the road has fall at 1003, stood alive at the win at 1010: spared
  const fatedRig = fightRig({ fated: (res) => res.id === 'L9.t4' });
  const doomed = fightTrip({ fallen: [{ res: { id: 'L9.t4', name: 'Bo Reed', cls: 140 }, t: 1003, s: 0 }] });
  assert.ok(!membersAt(doomed, 1010).some((m) => m.id === 'L9.t4'), 'the road\'s minute for their fall is past');
  fatedRig.fights.frame([{ trip: doomed, at }], here, 1001);
  await settle();
  for (const f of fatedRig.spawned.filter((r) => !r.o.allied)) f.dead = true;
  fatedRig.fights.frame([], here, 1010);
  assert.ok(fatedRig.rel.turns().spared.has('L9.t4@K'), 'standing at the win: spared');
  // the roads: a stood ally's remains not drawn beside them
  const map = livingMap();
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const beset = partiesOver(map, 400, 470, o).find((t) => t.enc && !t.enc.camp && t.enc.foes.length && t.enc.dead.some((id) => t.party.find((m) => m.id === id)?.cls != null));
  assert.ok(beset, 'a beset party with an armed member the road takes');
  const fallen = beset.fallen.find((f) => f.res.cls != null);
  const clock = { t: beset.enc.t0 + 0.1 };   // the fight stood before the road's minute for their fall
  assert.ok(clock.t < fallen.t && fallen.t + 0.5 < beset.enc.fightEnd);
  const atM = partyAt(beset, clock.t);
  const synced = [];
  const sprites = { sync: (list) => { synced.length = 0; synced.push(...list); }, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} };
  const roadRig = fightRig();
  const roads = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => clock.t, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: atM.x, z: atM.z }), sprites, memo: o.memo, fights: roadRig.fights });
  roads.frame(1.1, [0, 0, 0]);
  await settle();
  assert.ok(roadRig.fights.alliesOf(beset.id).has(fallen.res.id), 'stood alive in the fight');
  clock.t = fallen.t + 0.5;   // the road's minute for their fall passes while they fight
  const [px, py] = [Math.floor(atM.x / NATIVE_PIXEL), 499 - Math.floor(atM.z / NATIVE_PIXEL)];
  assert.ok(remainsNear(px, py, clock.t, map.world, o, ROADS_VIEW_PX).remains.some((r) => r.res.id === fallen.res.id),
    'the road lays them now - the skip alone keeps their body off');
  // LW-PERF reads the roads over a few frames (ROADS_TOWNS_PER_FRAME towns a frame, the last read standing till the new
  // one is done): the pin waits for the read that holds their remains - two frames read the old one, which drew no body
  // with the skip gone (LW-FIX4-remains-drawn survived it)
  roads.frame(1.1, [0, 0, 0]);
  const frames = Math.ceil(map.world.townsNear(px, py, ROADS_VIEW_PX + TRIP_REACH_PX).length / ROADS_TOWNS_PER_FRAME);
  for (let f = 0; f < frames; f++) roads.frame(0.01, [0, 0, 0]);
  assert.ok(roadRig.fights.alliesOf(beset.id).has(fallen.res.id), 'still standing');
  assert.ok(!synced.some((x) => x.key === `rem:${fallen.res.id}`), 'no body of theirs drawn beside them');
});

test('LW-FIX4 one struck down on the road is never stood again (the roads\' parties are read once a second: they drew on the player again, and their party was turned twice) - the host\'s `deadAt` (mutant: the dead unread)', () => {
  const pool = new Set(), slain = new Set();
  let spawned = 0;
  const rel = createRelations();
  const stands = createRoadStands({
    spawn: (type, feet, o) => { spawned++; const rec = { dead: false, entity: {}, o }; pool.add(rec); return rec; },
    remove: (rec) => pool.delete(rec), inPool: (rec) => pool.has(rec), ready: () => true, sceneOf: (x, z) => [x / 40, 0, z / 40],
    relations: () => rel, slay: (res) => slain.add(res.id), died: () => {}, deadAt: (res) => slain.has(res.id), fighting: () => false,
  });
  const res = { id: 'L9.t4', name: 'Bo Reed', cls: 140, level: 9 };
  rel.note(res.id, 'slain', Math.floor((5000 - 240) / 1440));
  const cands = [{ res, trip: { party: [res] }, x: 40, z: 40 }];
  stands.frame(cands, { x: 0, z: 0 }, 5000);
  return Promise.resolve().then(() => {
    assert.equal(spawned, 1, 'drew on the player');
    stands.stands()[0].rec.dead = true;
    stands.frame(cands, { x: 0, z: 0 }, 5001);
    assert.ok(slain.has(res.id), 'struck down');
    stands.frame(cands, { x: 0, z: 0 }, 5001.1);
    assert.equal(spawned, 1, 'never again');
  });
});

test('LW-FIX4 a halt that runs past its leg\'s arrival holds it - never halted on the road and lodged in town at once; a way home\'s halt never cut by the party\'s being home (mutants: the arrival unheld, the homecoming unheld)', () => {
  const trip = { id: 'x', party: [{ id: 'a' }], leader: { id: 'a' }, way: { len: 100 }, trim0: 0, trim1: 0, pace: 1, outT0: 0, outT1: 100, backT0: 300, backT1: 400 };
  const out = troubledTrip(trip, { id: 'x:e', leg: 'out', t0: 90, t1: 150, fightEnd: 115, s: 90, kind: 'won', dead: [] });
  assert.deepEqual([out.outT1, out.halt.t1], [150, 150], 'arrives as the halt ends');
  assert.equal(troubledTrip(trip, { id: 'x:e', leg: 'out', t0: 20, t1: 80, fightEnd: 45, s: 20, kind: 'won', dead: [] }).outT1, 100, 'a halt inside its leg moves nothing');
  assert.equal(troubledTrip(trip, { id: 'x:e', leg: 'out', t0: 90, t1: 350, fightEnd: 115, s: 90, kind: 'won', dead: [] }).outT1, 300, 'never past the stay\'s end');
  const back = troubledTrip(trip, { id: 'x:e', leg: 'back', t0: 380, t1: 440, fightEnd: 405, s: 20, kind: 'won', dead: [] });
  assert.equal(back.backT1, 440, 'home once the halt is done');
});

test('LW-FIX4 the streaming host: the trips\' fate the dice\'s (`fated`, the trouble\'s `diced`), the hands\' turns for the fights and the dives (`died`) and the stands\' `deadAt`, the fight\'s own election (those within LIVE_M of it), the memo kept to its bound by every reader (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /livingTripWorld\.fated = \(res, k\) => livingPlaceOf\(res, k\)\.diced;/);
  assert.match(w, /diced: \(res, trip\) => livingTripPlace\(res, trip\)\.diced,/);
  assert.equal((w.match(/died: livingDied,/g) ?? []).length, 3, 'the stands\', the fights\' and the dives\'');
  assert.match(w, /slay: livingSlay, died: livingDied,\n\s*deadAt: livingDeadAt,/, 'the stands ask the hands\' dead');
  assert.match(w, /owner: \(feet\) => amGroupRollOwner\(online\?\.id \?\? null, player\.feetAt\(\), \(peersNear\(\) \?\? \[\]\)\.filter\(\(p\) => Math\.hypot\(p\.feet\[0\] - feet\[0\], p\.feet\[2\] - feet\[2\]\) <= LIVE_M\), Infinity\),/);
  assert.match(w, /const livingMemoFresh = \(\) => \{ if \(_livingTripMemo\.size > 40000 \|\| livingWays\.generation !== _livingWaysSeen\) \{ _livingTripMemo\.clear\(\); _livingWaysSeen = livingWays\.generation; \} \};/);
  assert.equal((w.match(/livingMemoFresh\(\);/g) ?? []).length, 5, 'the towns\', the roads\' frame, the rooms\' frame (AUDIT-E2), the divers\' and the remains\'');
  // the election, run: those within LIVE_M of the fight decide it - the lowest id among them
  const m = /owner: (\(feet\) => amGroupRollOwner\([^\n]*\)),\n/.exec(w);
  return import('../src/systems/campEncounters.js').then(({ amGroupRollOwner }) => {
    const owner = (me, peers) => new Function('amGroupRollOwner', 'online', 'player', 'peersNear', 'LIVE_M', `return ${m[1]};`)(amGroupRollOwner, { id: me }, { feetAt: () => [0, 0, 0] }, () => peers, 150);
    const fight = [100, 0, 0];
    assert.equal(owner('b', [{ id: 'a', feet: [400, 0, 0] }])(fight), true, 'a lower id too far from the fight to stand it defers to me');
    assert.equal(owner('b', [{ id: 'a', feet: [120, 0, 0] }])(fight), false, 'one beside it with a lower id stands it');
  });
});
