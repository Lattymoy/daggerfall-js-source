// CREW-COMPANIONS (2026-09-30, Mac: take the crew "along as companions in the world that travel with you and can fight
// by your side" - "Up to 2", "Knocked out", through every door) - the party (systems/naval/crewCompanions.js), the
// follow brain (characters/enemyMotor.js `follow`, ai/enhancedMotor.js's route), the targets (enemyTargets.js), the
// companion layer (scenes/crewAshore.js), the deck without them (crewLife.js `away`), and the wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCompanions, companionRows, companionSlot, COMPANION_MAX, REST_MIN, COMPANION_WHY, COMPANION_TEXT,
} from '../src/systems/naval/crewCompanions.js';
import { createCrewAshore, CATCH_UP_M, HEEL_M, HEEL_STEP_M } from '../src/scenes/crewAshore.js';
import { ENCOUNTER_CULL_DISTANCE } from '../src/scenes/exteriorFoes.js';
import { EnemyAI, FOLLOW_STOP, FOLLOW_SLACK, FOLLOW_LEASH } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { bakeNavFromCollider } from '../src/ai/navBake.js';
import { EnhancedEnemyAI, makeNavWorld } from '../src/ai/enhancedMotor.js';
import { runTargetMachine, getTargets } from '../src/characters/enemyTargets.js';
import { createCrewLife } from '../src/systems/naval/crewLife.js';
import { MORALE_EVENT, createShipCrew } from '../src/systems/naval/shipCrew.js';
import { boatMenuRows, BOAT_VERB } from '../src/systems/csaBoatMenu.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const hand = (name, role = 'Bosun', mobile = 144, gender = 'male') => ({ name, role, mobile, gender });

test('CREW-COMPANIONS the party: two ashore at most, by name; one ashore sent back; a resting hand refused', () => {
  assert.equal(COMPANION_MAX, 2, 'Mac: "Up to 2"');
  const p = createCompanions();
  assert.ok(p.take(7, hand('Aldric Wayrest'), 0), 'the first comes ashore');
  assert.equal(p.take(7, hand('Aldric Wayrest'), 0), null, 'never twice');
  assert.ok(p.take(9, hand('Sela Dunmoor', 'Gunner', 150, 'female'), 0), 'a hand of another boat of mine too');
  assert.equal(p.why(7, hand('Brand'), 0), COMPANION_WHY.full);
  assert.equal(p.take(7, hand('Brand'), 0), null, 'a third is refused');
  assert.equal(p.why(7, hand('Aldric Wayrest'), 0), null, 'one ashore is never "full" - he is the one to send back');
  assert.equal(p.why(7, hand('Brand'), 0, false), COMPANION_WHY.uncrewed);
  assert.deepEqual(p.party.map((c) => [c.boat, c.name, c.gender]), [[7, 'Aldric Wayrest', 'male'], [9, 'Sela Dunmoor', 'female']]);
  assert.ok(p.sendBack(7, 'Aldric Wayrest'));
  assert.equal(p.sendBack(7, 'Aldric Wayrest'), false, 'answers whether he was ashore');
  assert.ok(p.take(7, hand('Brand'), 0), 'room again');
  assert.deepEqual([...p.awayOf(7)], ['Brand']);
  assert.deepEqual([...p.awayOf(9)], ['Sela Dunmoor']);
});

test('CREW-COMPANIONS knocked out: carried back aboard, rests REST_MIN of the world\'s minutes, then may come again', () => {
  assert.equal(REST_MIN, 8 * 60);
  const p = createCompanions();
  p.take(7, hand('Aldric Wayrest'), 100);
  assert.equal(p.knock(7, 'Aldric Wayrest', 1000), true);
  assert.equal(p.knock(7, 'Aldric Wayrest', 1000), false, 'only one ashore is knocked');
  assert.equal(p.party.length, 0, 'out of the party');
  assert.deepEqual(p.resting, [{ boat: 7, name: 'Aldric Wayrest', until: 1000 + REST_MIN }]);
  assert.equal(p.why(7, hand('Aldric Wayrest'), 1000 + REST_MIN - 1), COMPANION_WHY.resting);
  assert.equal(p.take(7, hand('Aldric Wayrest'), 1000 + REST_MIN - 1), null, 'not before his rest is out');
  assert.deepEqual(p.wake(1000 + REST_MIN - 1), [], 'nobody fit yet');
  assert.equal(p.wake(1000 + REST_MIN).length, 1, 'fit again');
  assert.equal(p.resting.length, 0);
  assert.ok(p.take(7, hand('Aldric Wayrest'), 1000 + REST_MIN));
  assert.equal(MORALE_EVENT.knocked, -4, 'his crew\'s spirits take it');
  const crew = createShipCrew({ seed: 3 });
  const before = crew.morale;
  crew.event('knocked');
  assert.equal(crew.morale, before + MORALE_EVENT.knocked);
});

test('CREW-COMPANIONS health rides through every door; the fallen leave; the save round-trips and drops a bad record', () => {
  const p = createCompanions();
  p.take(7, hand('Aldric Wayrest'), 0);
  p.take(7, hand('Brand'), 0);
  p.hurt(7, 'Aldric Wayrest', 12, 40);
  assert.equal(p.of(7, 'Aldric Wayrest').health, 12);
  assert.equal(p.of(7, 'Aldric Wayrest').maxHealth, 40);
  p.hurt(7, 'Aldric Wayrest', 40, 40);
  assert.equal(p.of(7, 'Aldric Wayrest').health, null, 'whole is null');
  p.hurt(7, 'Aldric Wayrest', -3, 40);
  assert.equal(p.of(7, 'Aldric Wayrest').health, 1, 'never carried at nothing');
  p.knock(7, 'Brand', 50);
  const snap = p.snapshot();
  const q = createCompanions(JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(q.snapshot(), snap, 'the save round-trips');
  const bad = createCompanions({
    party: [null, { boat: -1, name: 'x' }, { boat: 7, name: '' }, { boat: 7, name: 'A', health: 'x' }, { boat: 7, name: 'A' }, { boat: 7, name: 'B' }, { boat: 7, name: 'C' }],
    resting: [{ boat: 7, name: 'A', until: 5 }, { boat: 7, name: 'D', until: 'x' }, { boat: 8, name: 'E', until: 9 }],
  });
  assert.deepEqual(bad.party.map((c) => c.name), ['A', 'B'], 'the good, never past COMPANION_MAX, never twice');
  assert.equal(bad.party[0].health, null);
  assert.deepEqual(bad.resting.map((r) => r.name), ['E'], 'one ashore is not resting too; a rest with no minute is dropped');
  const gone = q.prune((boat, name) => name !== 'Aldric Wayrest');
  assert.deepEqual(gone.map((c) => c.name), ['Aldric Wayrest'], 'a hand fallen from her roster leaves the party');
  assert.equal(q.party.length, 0);
  q.prune(() => false);
  assert.equal(q.resting.length, 0, 'and the rest');
  assert.equal(createCompanions(null).party.length, 0);
});

test('CREW-COMPANIONS the picker: take ashore, send back, a resting hand refused with his hours', () => {
  const p = createCompanions();
  p.take(7, hand('Aldric Wayrest'), 0);
  p.knock(7, 'Aldric Wayrest', 0);
  p.take(7, hand('Brand', 'Gunner'), 0);
  const rows = companionRows({ boat: 7, crewed: true, hands: [hand('Aldric Wayrest'), hand('Brand', 'Gunner'), hand('Cale', 'Cook')], now: 60, companions: p });
  assert.deepEqual(rows[0], { id: 'Aldric Wayrest', label: 'Aldric Wayrest, Bosun', disabled: true, why: `${COMPANION_TEXT.resting}, 7 hours` });
  assert.deepEqual(rows[1], { id: 'Brand', label: `${COMPANION_TEXT.back}: Brand, Gunner`, back: true });
  assert.deepEqual(rows[2], { id: 'Cale', label: `${COMPANION_TEXT.take}: Cale, Cook` });
  p.take(9, hand('Dunn'), 0);
  assert.deepEqual(companionRows({ boat: 7, crewed: true, hands: [hand('Cale', 'Cook')], now: 60, companions: p })[0], { id: 'Cale', label: 'Cale, Cook', disabled: true, why: COMPANION_WHY.full });
});

test('CREW-COMPANIONS the slots: behind the leader, the two either side of his line', () => {
  const one = companionSlot(0, 0, 1);
  assert.ok(one[1] < -1 && Math.abs(one[0]) < 1e-9, 'straight behind, facing +z');
  const [a, b] = [companionSlot(0, 0, 2), companionSlot(0, 1, 2)];
  assert.ok(a[1] < 0 && b[1] < 0, 'both behind');
  assert.ok(a[0] * b[0] < 0, 'on either side');
  const turned = companionSlot(Math.PI / 2, 0, 1);
  assert.ok(turned[0] < -1 && Math.abs(turned[1]) < 1e-9, 'behind a leader facing +x is -x');
});

// ── the follow brain ──────────────────────────────────────────────────────────────────────────────────────────────

const walkCollider = () => ({
  raycast: (o, d) => (d[1] < -0.5 ? Math.max(0, o[1]) + 0.5 : Infinity),   // a floor under every step (the fall probe's)
  capsuleCast: () => ({ dist: Infinity, key: null }),
  move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true }; },
});
const mkSenses = (extra = {}) => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, ...extra });
function mkBody(feet, { team = 'PlayerEnemy', hostile = true, yaw = 0, companion = null } = {}) {
  const ai = new EnemyAI(walkCollider(), feet, yaw);
  ai.isHostile = hostile;
  return { ai, entity: { team, mobileTeam: team, health: 20, basics: { team } }, companion };
}
const armed = (pool, infighting = true) => (ai, pf, dt) => runTargetMachine(pool.find((c) => c.ai === ai), pool, pf, dt, { infighting, playerEntity: { health: 100 } });
const run = (pool, playerFeet, seconds, infighting = true) => {
  const targeting = armed(pool, infighting);
  for (let t = 0; t < seconds; t += 1 / 60) for (const f of pool) f.ai.update(1 / 60, playerFeet, mkSenses({ targeting }));
};

test('CREW-COMPANIONS follow: a companion with no foe walks to its leader and stands within `stop`; with no `follow` it stays put', () => {
  assert.deepEqual([FOLLOW_STOP, FOLLOW_SLACK, FOLLOW_LEASH], [3, 1.5, 20]);
  const leader = [20, 0, 0];
  const mate = mkBody([0, 0, 0], { team: 'PlayerAlly', companion: 'k' });
  mate.ai.follow = { feet: () => leader, stop: 2.5 };
  run([mate], leader, 12);
  const d = Math.hypot(leader[0] - mate.ai.feet[0], leader[2] - mate.ai.feet[2]);
  assert.ok(d <= 2.5 + 0.5, `he came to heel (${d.toFixed(2)} m)`);
  assert.ok(d > 1, 'and stopped short of the leader');
  assert.equal(mate.ai.moving, false, 'standing');
  assert.equal(mate.ai.target, null, 'an ally never takes the player');
  // the slack: a leader stepping a little away is not followed at once
  leader[0] += 1.2;
  const was = [...mate.ai.feet];
  run([mate], leader, 0.5);
  assert.ok(Math.hypot(mate.ai.feet[0] - was[0], mate.ai.feet[2] - was[2]) < 1e-6, 'inside stop + FOLLOW_SLACK he waits where he stands');
  leader[0] += 10;
  run([mate], leader, 0.5);
  assert.equal(mate.ai.moving, true, 'past it, he sets off');
  const idle = mkBody([0, 0, 0], { team: 'PlayerAlly' });
  run([idle], [20, 0, 0], 4);
  assert.deepEqual(idle.ai.feet, [0, 0, 0], 'no follow, no following (a summon stands as it did)');
});

test('CREW-COMPANIONS fight, then heel: a companion fights a hostile before following, and breaks off past the leash', () => {
  const leader = [0, 0, 0];
  const mate = mkBody([0, 0, 0], { team: 'PlayerAlly', companion: 'k' });
  mate.ai.follow = { feet: () => leader, stop: 2.5 };
  const orc = mkBody([0, 0, 4], { team: 'Orcs', yaw: Math.PI });
  run([mate, orc], leader, 1.3);
  assert.equal(mate.ai.target, orc, 'the foe first');
  assert.equal(mate.ai._following, false, 'not following while it fights at hand');
  // the orc far off: past the leash the companion drops it and turns home
  orc.ai.feet[2] = 60; mate.ai.feet[2] = FOLLOW_LEASH + 5;
  mate.ai.update(1 / 60, leader, mkSenses({ targeting: armed([mate, orc]) }));
  assert.equal(mate.ai._following, true, 'drawn past the leash: home');
  // past the leash himself, though his foe stands by the leader: home first, the foe let go
  const m2 = mkBody([0, 0, FOLLOW_LEASH + 5], { team: 'PlayerAlly', companion: 'k' });
  m2.ai.follow = { feet: () => leader, stop: 2.5 };
  m2.ai.target = orc; orc.ai.feet[2] = -3;
  m2.ai.predictedTargetPos = [0, 0, -3]; m2.ai.giveUpTimer = 200;
  assert.equal(m2.ai._followWanted(), true, 'he is past the leash');
  assert.equal(m2.ai.target, null);
});

test('CREW-COMPANIONS targets: with infighting off a hostile still fights a companion; a companion never takes another ally', () => {
  const playerFeet = [0, 0, 30];
  const mate = mkBody([0, 0, 3], { team: 'PlayerAlly', yaw: Math.PI, companion: 'k' });
  const orc = mkBody([0, 0, 0], { team: 'Orcs' });
  const summon = mkBody([0, 0, 0], { team: 'PlayerAlly' });
  assert.equal(getTargets(orc, [orc, mate], playerFeet, { infighting: false }).target, mate, 'the else-arm lets a hostile take a companion');
  assert.notEqual(getTargets(orc, [orc, summon], playerFeet, { infighting: false }).target, summon, 'a plain summon stays DFU\'s: unfought with infighting off');
  const watch = mkBody([0, 0, 3], { team: 'PlayerAlly', yaw: Math.PI });
  const mate2 = mkBody([0, 0, 0], { team: 'PlayerAlly', companion: 'j' });
  assert.equal(getTargets(mate2, [mate2, watch], playerFeet, { infighting: false }).target, null, 'a companion takes no ally for its foe');
  assert.equal(getTargets(watch, [watch, mate2], playerFeet, { infighting: false }).target, null, 'nor an ally a companion');
});

/** enhancedAI4.test.js's room: 12 x 12, a wall down x = 6 with its gap at the south end (z > 9). */
function dividedRoom() {
  const QUAD = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const c = new Collider(() => -1000);
  const quad = (key, ...v) => c.addMesh(key, new Float32Array(v.flat()), QUAD, Id);
  quad('floor', [0, 0, 0], [12, 0, 0], [12, 0, 12], [0, 0, 12]);
  quad('n', [0, 0, 0], [12, 0, 0], [12, 3, 0], [0, 3, 0]);
  quad('s', [12, 0, 12], [0, 0, 12], [0, 3, 12], [12, 3, 12]);
  quad('w', [0, 0, 12], [0, 0, 0], [0, 3, 0], [0, 3, 12]);
  quad('e', [12, 0, 0], [12, 0, 12], [12, 3, 12], [12, 3, 0]);
  quad('divA', [5.8, 0, 0], [6.2, 0, 0], [6.2, 3, 0], [5.8, 3, 0]);
  quad('divB', [6.2, 0, 0], [6.2, 0, 9], [6.2, 3, 9], [6.2, 3, 0]);
  quad('divC', [6.2, 0, 9], [5.8, 0, 9], [5.8, 3, 9], [6.2, 3, 9]);
  quad('divD', [5.8, 0, 9], [5.8, 0, 0], [5.8, 3, 0], [5.8, 3, 9]);
  return c;
}

test('CREW-COMPANIONS follow on the navmesh: the pathing motor takes a companion ROUND the wall to its leader', () => {
  const c = dividedRoom();
  const bake = bakeNavFromCollider(c, { anchor: [2, 0, 2] });
  const leader = [10, 0, 2];
  const walk = (Cls, nav) => {
    const ai = new Cls(c, [2, 0, 2], Math.PI / 2, { liveSpeed: 50, rolls: () => 0.5, nav: () => nav, navWorld: makeNavWorld(), navSeed: 7 });
    const mate = { ai, entity: { team: 'PlayerAlly', mobileTeam: 'PlayerAlly', health: 20, basics: { team: 'PlayerAlly' } }, companion: 'k' };
    ai.follow = { feet: () => leader, stop: 2.5 };
    const targeting = armed([mate]);
    let gap = Infinity, south = -Infinity, at = Infinity;
    for (let n = 0; n < 60 * 16; n++) {
      ai.update(1 / 60, leader, mkSenses({ targeting }), false);
      gap = Math.min(gap, Math.hypot(ai.feet[0] - leader[0], ai.feet[2] - leader[2]));
      if (at === Infinity && gap <= 2.5 + FOLLOW_SLACK) at = n / 60;
      south = Math.max(south, ai.feet[2]);
    }
    return { gap, south, at, ai };
  };
  const routed = walk(EnhancedEnemyAI, bake.chf);
  assert.ok(routed.gap <= 2.5 + FOLLOW_SLACK, `came to heel on the far side (${routed.gap.toFixed(2)} m)`);
  assert.ok(routed.south > 9, 'by the gap at the south end');
  assert.ok(routed.ai.navStats.repaths > 0, 'on a route');
  // FIELD BUGS 2026-10-04b COMPANION-TRAIL: the follower's wider walk gate lets the classic motor's detour work its way
  // round this one wall in the end (it pinned him at 6.87 m before) - the route is the way straight there
  const straight = walk(EnemyAI, null);
  assert.ok(straight.at > routed.at + 1.5, `the classic motor gropes along the wall (heel at ${straight.at.toFixed(2)} s, the route ${routed.at.toFixed(2)} s) - the route did the work`);
});

// ── the companion layer ───────────────────────────────────────────────────────────────────────────────────────────

function world() {
  const party = createCompanions();
  const state = { place: null, leader: { feet: [0, 0, 0], yaw: 0 }, now: 0, knocked: [] };
  // A place as the pools are: a live list a body is in while it stands (`has`), a remove that marks it dead, and a
  // SWEEP the way exteriorFoes' clearLive does one - the list emptied, nobody marked (AUDIT CC-A1)
  const mkPlace = (key, { maxHealth = 40 } = {}) => {
    const pool = { key, bodies: [], removed: [], live: [] };
    pool.spawn = (mobile, feet, o) => {
      const rec = { mobile, gender: o.gender, ai: { feet: [...feet], yaw: o.yaw }, entity: { health: maxHealth, maxHealth }, dead: false };
      pool.bodies.push(rec);
      pool.live.push(rec);
      return Promise.resolve(rec);
    };
    pool.remove = (rec) => { rec.dead = true; pool.removed.push(rec); pool.live = pool.live.filter((r) => r !== rec); };
    pool.has = (rec) => pool.live.includes(rec);
    pool.sweep = () => { pool.live.length = 0; };
    return pool;
  };
  const layer = createCrewAshore({
    party: () => party, place: () => state.place, leader: () => state.leader, now: () => state.now,
    onKnocked: (c) => state.knocked.push(c.name),
  });
  return { party, state, mkPlace, layer };
}
const settle = () => new Promise((r) => setImmediate(r));

test('CREW-COMPANIONS the layer: the party stood behind the player as allies none of the player\'s blows reach, following', async () => {
  const { party, state, mkPlace, layer } = world();
  party.take(7, hand('Aldric Wayrest'), 0);
  party.take(7, hand('Sela', 'Gunner', 150, 'female'), 0);
  const street = mkPlace('street');
  state.place = street;
  layer.frame();
  layer.frame();   // a stand in flight is never stood twice
  await settle();
  assert.equal(street.bodies.length, 2);
  const [a, b] = street.bodies;
  assert.deepEqual([a.companion, a.shipmate, a.entity.name], ['7:Aldric Wayrest', true, 'Aldric Wayrest']);
  assert.equal(b.gender, 'female');
  assert.ok(a.ai.feet[2] < 0 && b.ai.feet[2] < 0, 'behind a player facing +z');
  assert.equal(a.ai.follow.stop, HEEL_M);
  assert.equal(b.ai.follow.stop, HEEL_M + HEEL_STEP_M, 'the second a pace further');
  assert.deepEqual(a.ai.follow.feet(), [0, 0, 0], 'the leader\'s live feet');
  assert.deepEqual(layer.bodies(), [a, b]);
});

test('CREW-COMPANIONS through a door: lifted out of the old place with their health, stood in the new', async () => {
  const { party, state, mkPlace, layer } = world();
  party.take(7, hand('Aldric Wayrest'), 0);
  const street = mkPlace('street');
  state.place = street;
  layer.frame(); await settle();
  street.bodies[0].entity.health = 15;
  layer.frame();
  const shop = mkPlace('shop');
  state.place = shop;
  layer.frame(); await settle();
  assert.deepEqual(street.removed, [street.bodies[0]], 'out of the street (its pool stands frozen while I am in)');
  assert.equal(shop.bodies.length, 1);
  assert.equal(shop.bodies[0].entity.health, 15, 'hurt as he left');
  // a door in flight: nowhere to stand, nobody stood - and a stand landing after the place moved is taken back
  state.place = null;
  layer.frame();
  assert.equal(shop.removed.length, 1);
  const dungeon = mkPlace('dungeon');
  state.place = dungeon;
  layer.frame();
  state.place = mkPlace('street2');
  layer.frame();
  await settle();
  assert.deepEqual(dungeon.removed, dungeon.bodies, 'the stand that landed in a place already left goes');
});

test('CREW-COMPANIONS knocked out, swept, sent back, left behind', async () => {
  const { party, state, mkPlace, layer } = world();
  party.take(7, hand('Aldric Wayrest'), 0);
  const street = mkPlace('street');
  state.place = street;
  layer.frame(); await settle();
  // swept by the place (a fast travel's clearLive - the list emptied, nobody marked dead: AUDIT CC-A1): stood again, no knock
  street.sweep();
  layer.frame(); await settle();
  assert.equal(street.bodies.length, 2, 'stood again');
  assert.equal(state.knocked.length, 0);
  // left behind: stood behind the player again
  const rec = street.bodies[1];
  rec.ai.feet[0] = CATCH_UP_M + 10;
  rec.ai.target = {};
  layer.frame();
  assert.ok(Math.hypot(rec.ai.feet[0], rec.ai.feet[2]) < 3, 'caught up');
  assert.equal(rec.ai.target, null);
  rec.ai.feet[1] = 20;
  layer.frame();
  assert.ok(rec.ai.feet[1] < 1, 'a floor away is left behind too');
  // knocked out (the pool's death arm held him at 1 and marked him)
  state.now = 500;
  rec._knockedOut = true;
  layer.frame();
  assert.deepEqual(state.knocked, ['Aldric Wayrest']);
  assert.ok(street.removed.includes(rec), 'no corpse - out of the place');
  assert.equal(party.party.length, 0);
  assert.equal(party.resting[0].until, 500 + REST_MIN);
  // sent back - one of two, the other walking on
  party.take(7, hand('Brand'), 0);
  party.take(7, hand('Cale', 'Cook'), 0);
  layer.frame(); await settle();
  const [brand, cale] = street.bodies.slice(-2);
  party.sendBack(7, 'Brand');
  layer.frame();
  assert.ok(street.removed.includes(brand), 'he goes');
  assert.deepEqual(layer.bodies(), [cale], 'his mate stays');
  party.sendBack(7, 'Cale');
  layer.frame();
  assert.deepEqual(layer.bodies(), [], 'nobody ashore, nobody stands');
});

// ── the deck without them ─────────────────────────────────────────────────────────────────────────────────────────

test('CREW-COMPANIONS the deck: a hand ashore is off her deck (no talk, no muster), home again he stands on it', () => {
  const deck = { walkable: () => true, nearest: () => [0, 0, 0], clamp: (x, z) => [x, 0, z], path: () => null, heightAt: () => 0, spots: (n) => Array.from({ length: n }, (_, i) => [i, 0, 3]), count: 1 };
  const roster = [{ mobile: 144, gender: 'male' }, { mobile: 145, gender: 'male' }, { mobile: 150, gender: 'female' }];
  const life = createCrewLife({ deck, roster, seed: 1, places: [[0, 0, 0], [1, 0, 0], [2, 0, 0]] });
  assert.equal(life.standing(), 3);
  assert.equal(life.away(new Set([1])), 1);
  assert.equal(life.standing(), 2);
  life.restore(3, roster);
  assert.equal(life.standing(), 2, 'the mending never brings a man ashore back');
  assert.deepEqual(life.take(3).map((m) => m.mobile), [144, 150], 'nor sends him to a boarding');
  const life2 = createCrewLife({ deck, roster, seed: 1, places: [[0, 0, 0], [1, 0, 0], [2, 0, 0]] });
  life2.away(new Set([2]));
  assert.equal(life2.away(new Set()), 0, 'home');
  assert.equal(life2.standing(), 3, 'and standing on her deck');
});

test('CREW-COMPANIONS the boat\'s menu: a crewed boat of mine lists Companions with the naval arc on', () => {
  const boxes = new Set(['drive']);
  const ids = (s) => boatMenuRows({ boxes, packable: true, ...s }).map((r) => r.id);
  assert.ok(ids({ naval: true, crewed: true }).includes(BOAT_VERB.companions));
  assert.ok(!ids({ naval: true, crewed: false }).includes(BOAT_VERB.companions), 'no crew, nobody to take');
  assert.ok(!ids({ naval: false, crewed: true }).includes(BOAT_VERB.companions), 'the arc off, none');
});

// ── the wiring, by source ─────────────────────────────────────────────────────────────────────────────────────────

test('CREW-COMPANIONS by source: both pools knock a companion out before every death arm; the dungeon spares him my blows and never saves him', () => {
  const x = rd('src/scenes/exteriorFoes.js');
  // PIN MOVED (RVN10, bible/12-Enhanced-AI/Feud-Arc.md 21.1): the arm notes the striker whose blow knocked him down
  const knockX = x.indexOf("if (f.companion != null) { f.entity.health = 1; if (!f._knockedOut) f._knockedBy = striker; f._knockedOut = true; return; }");
  assert.ok(knockX > 0 && knockX < x.indexOf('attemptSoulTrap(f.entity', knockX), 'the street: before the trap, the notice and the corpse');
  assert.ok(CATCH_UP_M < ENCOUNTER_CULL_DISTANCE, 'the street\'s cull never reaches a companion - the layer stands him at the player first (and re-stands a swept one)');
  const d = rd('src/scenes/dungeonContext.js');
  const knockD = d.indexOf("if (foe.companion != null) { foe.entity.health = 1; if (!foe._knockedOut) foe._knockedBy = striker; foe._knockedOut = true; return; }");   // PIN MOVED (RVN10): its twin
  assert.ok(knockD > 0 && knockD < d.indexOf('attemptSoulTrap(foe.entity', knockD), 'the dungeon: before the trap and the corpse');
  assert.match(d, /if \(foe\.dead \|\| \(fromPlayer && !peer && foe\.companion != null\)\) return;/, 'no blow of mine reaches him');
  assert.match(d, /const live = (?:dropFateHeld\()?foes\.filter\(\(f\) => !f\.dead && f\.companion == null\)\)?;/, 'nor my swing');   // PIN MOVED (the revenant audit): and one held by its fate
  assert.match(d, /foes: foes\.filter\(\(f\) => f\._ownFrom == null && f\.companion == null\)/, 'the room\'s save holds none');
  assert.match(d, /function removeLooseFoe\(f\) \{\n\s*if \(!f \|\| f\._gone \|\| !foes\.includes\(f\)\) return false;\n\s*dropOwnPuppet\(null, f\);/, 'the out door');
});

test('CREW-COMPANIONS by source: the world stands the party in every place and every mode, and the naval save keeps it', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(mode === 'exterior'\) return \{ key: exteriorFoes, spawn: standIn\(exteriorFoes\)/);
  assert.match(w, /if \(mode === 'interior'\) \{\n\s*const pool = modes\?\.interiorPool\?\.\(\);/);
  assert.match(w, /spawn: \(mobile, feet, o\) => d\.spawnLooseFoe\(mobile, feet, \{ yawRad: o\.yaw, allied: true, gender: o\.gender \}\),/, 'PIN MOVED (AUDIT CC-E1): a companion rides the room\'s own lane, named in its `cp`');
  assert.match(w, /allied: true, loose: true, transient: true \}\)/);
  assert.match(w, /crewAshoreTick\(\);   \/\/ CREW-COMPANIONS: the party stood indoors and underground too/);
  assert.match(w, /crewAshoreTick\(\);   \/\/ CREW-COMPANIONS: the party stood on the street/);
  assert.match(w, /onKnocked: \(c, by\) => \{ naval\?\.companionKnocked\?\.\(c\); felledBy\(by, c\.name\); \},/);   // PIN MOVED (RVN10, Feud-Arc.md 21.1): and the felling's deed on the striker
  assert.match(w, /else navalCompanions\(pick\.boat\);/);
  assert.match(w, /away: naval\?\.awayOf\?\.\(boat\) \?\? NO_HANDS_AWAY \}\);/);
  const m = rd('src/scenes/worldModes.js');
  assert.equal((m.match(/host\.drawCompanionBars\?\.\(\{ proj, view, eye: mwv\.eye \}\);/g) ?? []).length, 3, 'the bars indoors and underground - and under a dungeon window (AUDIT CC-A6)');
  const n = rd('src/scenes/navalHost.js');
  assert.match(n, /raids: \[\.\.\.raidUids\], party: companions\.snapshot\(\) \};/);
  assert.match(n, /companions = createCompanions\(r\?\.party \?\? null, deps\.packedItems \?\? null\);/);
  assert.match(n, /const live = boatState\.get\(c\.boat\);\n\s*if \(live\) live\.crew\.event\('knocked'\);/);
});
