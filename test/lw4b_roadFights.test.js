// LW4b (2026-10-05, bible/06-Systems/Living-World.md, Mac: NPCs "can encounter enemies in the overworld ... make friends
// or enemies"): THE FIGHT, STOOD - a beset party near the player on the ground fought for real (its foes the pool's own,
// its armed the player's allies), the end what happens (the fallen, the won with the spared, the lost), the fights let
// go, and the roads drawing none of the bodies the pool holds - over a mock pool and the synthetic map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { livingMap, partiesOver } from './lwRoads.mjs';
import { createRoadFights, LIVE_M, LIVE_KEEP_M, FOE_STAND_M, LIVE_GRACE_MIN } from '../src/scenes/roadFights.js';
import { createLivingRoads } from '../src/scenes/livingRoads.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { partyAt, membersAt, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });

/** A road-fight layer over a mock pool: what it stands, takes out, and the character's turns. */
function fightRig({ owner = true, ready = true, fated = () => false } = {}) {
  const pool = new Set(), spawned = [], removed = [];
  const can = { ready };
  const rel = createRelations();
  const turns = [];
  const fights = createRoadFights({
    spawn: async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {} }; pool.add(rec); spawned.push(rec); return rec; },
    remove: (rec) => { pool.delete(rec); removed.push(rec); },
    inPool: (rec) => pool.has(rec),
    owner: () => owner, ready: () => can.ready,
    sceneOf: (nx, nz) => [nx / 40, 0, nz / 40],
    clock: () => 500 * DAY_MIN, relations: () => rel,
    turnKeyOf: (res) => `${res.id}@K`, dies: (res) => fated(res),
    died: (res, t) => rel.turn('died', `${res.id}@K`, { t, who: res.name }),   // AUDIT-C3: the host's hand turn at the minute
    onTurn: () => turns.push(rel.turnsVersion()),
  });
  return { fights, pool, spawned, removed, rel, turns, can };
}
const fightTrip = () => ({
  id: 'L9.t1:50', kind: 'merchant', leader: { id: 'L9.t1', name: 'Ada Lark' },
  party: [{ id: 'L9.t1', name: 'Ada Lark', cls: null }, { id: 'L9.t4', name: 'Bo Reed', cls: 140, level: 9, sex: 'male' }, { id: 'L9.t5', name: 'Cy Fenn', cls: 135, level: 7, sex: 'female' }],
  enc: { id: 'L9.t1:50:e', foes: [7, 7], level: 6, t0: 1000, t1: 1060, fightEnd: 1025, x: 40000, z: 80000 },
  fallen: [],
});
const settle = () => new Promise((r) => setTimeout(r, 0));

test('LW4b the fight stood: a beset party within LIVE_M of the player on the ground, and this player the one to stand it, is fought for real - its foes the pool\'s own about its place at the encounter\'s level, its armed the player\'s allies (in their class, at their level, by name, no blow of the player\'s reaching them); never from the sky, beyond the reach, for a peer\'s fight or while nothing can stand (mutants: the reach, the election, the sky, the allies, the ring)', async () => {
  assert.equal(LIVE_M, 150);
  assert.equal(LIVE_KEEP_M, 260);
  assert.deepEqual([...FOE_STAND_M], [7, 13]);
  assert.equal(LIVE_GRACE_MIN, 90);
  const trip = fightTrip();
  const at = { x: trip.enc.x, z: trip.enc.z, fight: true };
  const near = { x: at.x + 100 * 40, z: at.z };
  for (const [what, rig, here, o] of [
    ['a peer stands it', fightRig({ owner: false }), near, {}],
    ['nothing can stand', fightRig({ ready: false }), near, {}],
    ['from the sky', fightRig(), near, { ground: false }],
    ['beyond the reach', fightRig(), { x: at.x + (LIVE_M + 5) * 40, z: at.z }, {}],
  ]) {
    rig.fights.frame([{ trip, at }], here, 1001, o);
    await settle();
    assert.equal(rig.spawned.length, 0, `not stood: ${what}`);
  }
  const rig = fightRig();
  rig.fights.frame([{ trip, at }], near, 1001);
  await settle();
  const foes = rig.spawned.filter((r) => !r.o.allied), allies = rig.spawned.filter((r) => r.o.allied);
  assert.deepEqual(foes.map((r) => r.mobileType), [7, 7], 'its foes, each its kind');
  for (const f of foes) {
    const d = Math.hypot(f.feet[0] - at.x / 40, f.feet[2] - at.z / 40);
    assert.ok(d >= FOE_STAND_M[0] - 1e-9 && d <= FOE_STAND_M[1] + 1e-9, `about its place (${d.toFixed(2)} m)`);
    assert.equal(f.o.level, trip.enc.level, 'at the encounter\'s level');
  }
  assert.deepEqual(allies.map((r) => [r.mobileType, r.o.level, r.o.gender]), [[140, 9, 'male'], [135, 7, 'female']], 'its armed, in their class and level');
  for (const a of allies) {
    assert.equal(a.shipmate, true, 'no blow of the player\'s reaches them');
    assert.equal(a.entity.team, 'PlayerAlly');
    assert.ok(a.living?.res && a.entity.name === a.living.res.name, 'by name');
  }
  assert.equal(rig.fights.stood(trip.id), true);
  assert.deepEqual([...rig.fights.alliesOf(trip.id)], ['L9.t4', 'L9.t5']);
  rig.fights.frame([{ trip, at }], near, 1002);
  await settle();
  assert.equal(rig.spawned.length, 4, 'stood once');
});

test('LW4b the end is what happens: an ally cut down FELL; every foe dead, the fight WON - the fated still standing SPARED, every survivor\'s regard moved (saved, helped); every ally down with foes standing, LOST - its foes left to the pool; a fight left (the player gone past LIVE_KEEP_M, LIVE_GRACE_MIN past its halt, nothing able to stand) let go, its bodies taken out; won, its allies taken out when the party walks on; clear() takes out every one; the road draws none of the bodies the pool holds, and no foes of its own for a peer\'s fight (mutants: the fallen, the won, the spared, the regard, the lost, the let-go, the walk on, the roads\' hiding)', async () => {
  const trip = fightTrip();
  const at = { x: trip.enc.x, z: trip.enc.z, fight: true };
  const here = { x: at.x + 50 * 40, z: at.z };
  // won, an ally fallen, the fated leader spared
  const rig = fightRig({ fated: (res) => res.id === 'L9.t1' });
  rig.fights.frame([{ trip, at }], here, 1001);
  await settle();
  const allies = rig.spawned.filter((r) => r.o.allied), foes = rig.spawned.filter((r) => !r.o.allied);
  allies[1].dead = true;
  rig.fights.frame([], here, 1005);
  assert.deepEqual(rig.rel.turns().died.get('L9.t5@K'), { t: 1005, seen: false, who: 'Cy Fenn' }, 'cut down beside the player: died at their side, at that minute (AUDIT-C3)');
  for (const f of foes) f.dead = true;
  rig.fights.frame([], here, 1010);
  assert.ok(rig.rel.turns().won.has(trip.enc.id), 'won');
  assert.ok(rig.rel.turns().spared.has('L9.t1@K'), 'the fated leader, standing: spared');
  assert.ok(!rig.rel.turns().spared.has('L9.t4@K'), 'none spared that was never fated');
  const today = Math.floor((500 * DAY_MIN - 240) / DAY_MIN);   // the living day the fight was won on
  assert.deepEqual([rig.rel.regard('L9.t1', today), rig.rel.regard('L9.t4', today), rig.rel.regard('L9.t5', today)], [35, 20, 0], 'saved, helped - and nothing for the fallen');
  assert.ok(rig.turns.length >= 3, 'the host told of each turn');
  assert.equal(rig.removed.length, 0, 'the allies stand while the party halts');
  rig.fights.frame([], here, trip.enc.t1);
  assert.ok(rig.removed.includes(allies[0]) && !rig.pool.has(allies[0]), 'the party walks on: its allies out');
  assert.ok(rig.pool.has(allies[1]) && !rig.removed.includes(allies[1]), 'the one cut down the pool\'s own - a body to find (AUDIT-C4)');
  assert.equal(rig.fights.size, 0);
  // lost: every ally down, foes standing - the foes left to the pool
  const lost = fightRig();
  lost.fights.frame([{ trip, at }], here, 1001);
  await settle();
  for (const a of lost.spawned.filter((r) => r.o.allied)) a.dead = true;
  lost.fights.frame([], here, 1005);
  assert.ok(lost.rel.turns().lost.has(trip.enc.id), 'lost');
  lost.fights.frame([], { x: here.x + 400 * 40, z: here.z }, 1006);
  assert.ok(lost.spawned.filter((r) => !r.o.allied).every((f) => lost.pool.has(f)), 'its foes the player\'s own trouble now - left to the pool');
  // let go: far, late, unable
  for (const [what, step] of [
    ['far', (f) => f.fights.frame([], { x: here.x + (LIVE_KEEP_M + 10) * 40, z: here.z }, 1005)],
    ['late', (f) => f.fights.frame([], here, trip.enc.t1 + LIVE_GRACE_MIN + 1)],
    ['clear', (f) => f.fights.clear()],
    ['unable', (f) => { f.can.ready = false; f.fights.frame([], here, 1005); }],
  ]) {
    const f = fightRig();
    f.fights.frame([{ trip, at }], here, 1001);
    await settle();
    step(f);
    assert.equal(f.pool.size, 0, `let go (${what}): every body out`);
    assert.equal(f.fights.size, 0);
  }
  // the roads draw none of the pool's bodies, and no foes of their own for a peer's fight
  const map = livingMap();
  const o = O();
  const beset = partiesOver(map, 400, 470, o).find((t) => t.enc && !t.enc.camp && t.party.some((m) => m.cls != null) && t.enc.foes.length);
  const m = beset.enc.t0 + 2;
  const atM = partyAt(beset, m);
  const synced = [];
  const sprites = { sync: (list) => { synced.length = 0; synced.push(...list); }, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} };
  const mkRoads = (fights) => createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => m, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: atM.x, z: atM.z }), sprites, memo: o.memo, fights });
  const stoodRig = fightRig();
  const roads = mkRoads(stoodRig.fights);
  roads.frame(0.1, [0, 0, 0]);
  await settle();
  roads.frame(0.1, [0, 0, 0]);
  const armedIds = membersAt(beset, m).filter((x) => x.cls != null).map((x) => x.id);
  assert.ok(stoodRig.fights.stood(beset.id), 'stood live');
  assert.ok(!synced.some((x) => x.key.startsWith(beset.enc.id)), 'its foes the pool\'s, not the road\'s');
  assert.ok(!synced.some((x) => armedIds.includes(x.key)), 'its armed the pool\'s too');
  const peerRig = fightRig({ owner: false });
  const peerRoads = mkRoads(peerRig.fights);
  peerRoads.frame(0.1, [0, 0, 0]);
  assert.ok(!synced.some((x) => x.key.startsWith(beset.enc.id)), 'a peer\'s fight: no foes of the road\'s own');
  assert.ok(!synced.some((x) => armedIds.includes(x.key)), 'its armed the peer\'s allies, come through the stream - never drawn here too (AUDIT-B6)');
  const unarmedIds = membersAt(beset, m).filter((x) => x.cls == null).map((x) => x.id);
  if (unarmedIds.length) assert.ok(synced.some((x) => unarmedIds.includes(x.key)), 'its unarmed drawn as ever');
  // the host
  const w = rd('src/scenes/world.js');
  assert.match(w, /spawn: \(type, feet, o\) => exteriorFoes\.spawnFoe\(type, feet, \{ yaw: o\.yaw, gender: o\.gender, level: o\.level, allied: o\.allied, loose: true, transient: true \}\),/);
  assert.match(w, /owner: \(feet\) => amGroupRollOwner\(online\?\.id \?\? null, player\.feetAt\(\), \(peersNear\(\) \?\? \[\]\)\.filter\(\(p\) => Math\.hypot\(p\.feet\[0\] - feet\[0\], p\.feet\[2\] - feet\[2\]\) <= LIVE_M\), Infinity\),/, 'AUDIT-B5: the fight\'s own election');
  assert.match(w, /ready: \(\) => !!walkMode && !!playerSpawned && !_loading && !modes\?\.transitioning && _mode\(\) === 'exterior' && !playerAfloat\(\),/);
  assert.match(w, /return turnKey\(place, placeCycle\(place, roster, Math\.floor\(trip\.outT0 \/ 1440\), livingScale\(\)\)\);/);
  assert.match(rd('src/scenes/livingRoads.js'), /clear\(\) \{ deps\.sprites\.clear\(\); deps\.fights\?\.clear\(\);/);
});
