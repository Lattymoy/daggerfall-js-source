// WAGONS1 (2026-10-09, Mac: "the ability for players to request to sit in the back of the cart and be transported
// across daggerfall"; asked, "Players and companions"): the seats in the back - the law (systems/wagonSeats.js), the
// runtime both ends of it run (scenes/wagonRiders.js), the companions' seat (scenes/crewAshore.js, characters/
// enemyMotor.js) - and the caravan's room (systems/caravanRoom.js, scenes/caravanRoom.js, the interior host's slot).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createRideBook, validRideWord, rideWord, validPassengers, freeWagonSeat, companionSeats, RIDE_ASK_TTL_MS, RIDE_REASK_MS, RIDE_TEXT, MAX_SEATS, RIDE_ASK_REACH,
} from '../src/systems/wagonSeats.js';
import { createWagonRiders, RIDE_ROW, GO_HOLD_MS, ARRIVE_WAIT_MS } from '../src/scenes/wagonRiders.js';
import { createCrewAshore } from '../src/scenes/crewAshore.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { readCaravanRoom, isCaravanRoom, CARAVAN_BLOCK, CARAVAN_SCENE_NAME, CARAVAN_BUILDING_KEY, CARAVAN_TEXT, CARAVAN_ROOM_MODEL_ID } from '../src/systems/caravanRoom.js';
import { caravanRoomEntry, createCaravanAccess } from '../src/scenes/caravanRoom.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

test('WAGONS1 THE WORDS: a rider asks (`{ a }`) or sits (`{ s: [owner, seat] }`), an owner lists who sits where - one rider a seat, one seat a rider, at most four - anything else refused (mutants: a seat past four, a rider twice)', () => {
  assert.deepEqual(validRideWord({ a: 'ann' }), { ask: 'ann' });
  assert.deepEqual(validRideWord({ s: ['ann', 2] }), { seated: 'ann', seat: 2 });
  for (const bad of [null, [], { a: '' }, { a: 'x y' }, { s: ['ann', 4] }, { s: ['ann', -1] }, { s: ['ann'] }, { s: ['ann', 1.5] }]) assert.equal(validRideWord(bad), null, JSON.stringify(bad));
  assert.deepEqual(rideWord({ owner: 'ann', seat: null }), { a: 'ann' });
  assert.deepEqual(rideWord({ owner: 'ann', seat: 3 }), { s: ['ann', 3] });
  assert.equal(rideWord(null), null);
  assert.deepEqual(validPassengers(undefined), []);
  assert.deepEqual(validPassengers([['a', 0], ['b', 3]]), [['a', 0], ['b', 3]]);
  for (const bad of [[['a', 0], ['a', 1]], [['a', 0], ['b', 0]], [['a', 4]], Array.from({ length: 5 }, (_, i) => [`p${i}`, i % 4]), 'x']) assert.equal(validPassengers(bad), null);
  assert.equal(MAX_SEATS, 4);
  assert.equal(freeWagonSeat(4, [0, 2]), 1); assert.equal(freeWagonSeat(2, [0, 1]), -1);
  // companions take the seats no player holds, in order, and only while the wagon goes with its owner
  assert.deepEqual(companionSeats(4, [1], 4, true), [0, 2, 3, -1]);
  assert.deepEqual(companionSeats(4, [], 2, false), [-1, -1]);
  assert.deepEqual(companionSeats(0, [], 2, true), [-1, -1]);
});

test('WAGONS1 THE OWNER\'S BOOK: an ask heard once, put to the owner; Accept seats the rider in the lowest free seat, Decline turns them away until the re-ask passes; an unanswered ask lapses; a seated rider who stops saying so has got down; the seats fit the wagon (mutants: a re-ask let straight back, an ask never lapsing)', () => {
  const b = createRideBook();
  assert.equal(b.hear('ann', { ask: 'me' }, 'me', 0), 'asked');
  assert.equal(b.hear('ann', { ask: 'me' }, 'me', 10), null, 'once');
  assert.equal(b.hear('bob', { ask: 'someone-else' }, 'me', 0), null, 'not mine');
  assert.deepEqual(b.asks(), [{ rider: 'ann', at: 0 }]);
  assert.ok(b.accept('ann', 4));
  assert.deepEqual(b.passengers(), [['ann', 0]]);
  assert.equal(b.hear('ann', { seated: 'me', seat: 0 }, 'me', 20), null, 'sitting');
  assert.equal(b.hear('ann', null, 'me', 30), 'left');
  assert.deepEqual(b.passengers(), []);
  b.hear('cat', { ask: 'me' }, 'me', 100);
  b.decline('cat', 100);
  assert.equal(b.hear('cat', { ask: 'me' }, 'me', 100 + RIDE_REASK_MS - 1), null, 'turned away a while');
  b.hear('cat', null, 'me', 100 + RIDE_REASK_MS);
  assert.equal(b.hear('cat', { ask: 'me' }, 'me', 100 + RIDE_REASK_MS + 1), 'asked');
  assert.deepEqual(b.lapse(100 + RIDE_REASK_MS + 1 + RIDE_ASK_TTL_MS + 1), ['cat']);
  for (const [r, at] of [['a', 0], ['b', 0], ['c', 0]]) { b.hear(r, { ask: 'me' }, 'me', at); b.accept(r, 4); }
  b.hear('d', { ask: 'me' }, 'me', 0);
  assert.equal(b.accept('d', 3), false, 'no seat free');
  b.fit(2);
  assert.deepEqual(b.passengers().map((e) => e[1]), [0, 1], 'a smaller wagon: the seats past it given up');
  b.fit(0);
  assert.deepEqual([b.passengers(), b.asks()], [[], []]);
});

/** Two clients' halves over one fake pool: the owner's word as the rider's pool shows it. */
function riderRig({ model = 'openWagon', seats = 4 } = {}) {
  const said = [], pins = [], travels = [];
  let now = 1000, jump = false, traveling = false;
  const owner = { passengers: [], go: null, declined: [] };
  const pool = {
    peerRide: (id) => (id === 'olaf' && owner.model !== null ? { model: owner.model ?? model, kind: 1, passengers: owner.passengers, go: owner.go, declined: owner.declined, position: [0, 0, 0], wire: [10, 2, 20] } : null),
    peerSeat: (id, k) => ({ feet: [k, 1, 2], yaw: Math.PI / 2 }),
    mySeat: (k) => ({ feet: [k, 0, 0], yaw: 0 }), mySeatCount: () => seats,
  };
  const r = createWagonRiders({
    selfId: () => 'me', name: (id) => id.toUpperCase(), now: () => now, say: (l) => said.push(l), pool,
    pin: (feet, yaw) => pins.push([feet, yaw]), unpin: (feet) => pins.push(['down', feet]), changed: () => {},
    jumpPressed: () => jump, traveling: () => traveling, canTravel: () => true,
    travel: (to, besideAt, who) => travels.push({ to, beside: besideAt(), who }),
  });
  return { r, owner, said, pins, travels, tick: (ms) => { now += ms; }, setJump: (v) => { jump = v; }, setTraveling: (v) => { traveling = v; } };
}

test('WAGONS1 THE RIDER: "Ask to ride" on a wagon with seats says the ask; the owner\'s word naming me seats me - pinned to the seat each frame, my motor held - and Jump gets me down beside it; a refusal and a silence are told (mutants: seated without the owner\'s word, the seat not pinned, Jump ignored)', () => {
  const g = riderRig();
  assert.deepEqual(g.r.acts('olaf', 'openWagon', false), [{ id: RIDE_ROW.ask, label: RIDE_TEXT.ask }]);
  assert.deepEqual(g.r.acts('olaf', 'cart', false), [], 'no seats in a cart');
  assert.deepEqual(g.r.acts('olaf', 'openWagon', true), [], 'nor in a kept (parked, owner away) wagon');
  assert.ok(g.r.press('olaf', RIDE_ROW.ask, RIDE_ASK_REACH + 1));
  assert.equal(g.r.word(), null, 'too far: no ask');
  g.r.press('olaf', RIDE_ROW.ask, 2);
  assert.deepEqual(g.r.word(), { a: 'olaf' });
  g.r.frame();
  assert.equal(g.r.seated(), false, 'asked, not seated');
  g.owner.passengers = [['me', 2]];
  g.r.frame();
  assert.equal(g.r.seated(), true);
  assert.deepEqual(g.r.word(), { s: ['olaf', 2] });
  assert.deepEqual(g.pins.at(-1), [[2, 1, 2], Math.PI / 2], 'on seat 2 as their wagon is drawn here');
  assert.ok(g.said.includes(RIDE_TEXT.accepted('OLAF')));
  assert.deepEqual(g.r.acts('olaf', 'openWagon', false), [{ id: RIDE_ROW.down, label: RIDE_TEXT.getOff }]);
  g.setJump(true); g.r.frame(); g.setJump(false);
  assert.equal(g.r.seated(), false);
  assert.equal(g.pins.at(-1)[0], 'down');
  assert.ok(Math.abs(g.pins.at(-1)[1][0] - (2 - 1.6)) < 1e-9, 'over the side behind the seat');
  // turned away, and unanswered
  g.owner.passengers = [];
  g.r.press('olaf', RIDE_ROW.ask, 2); g.owner.declined = ['me']; g.r.frame();
  assert.equal(g.r.word(), null); assert.ok(g.said.includes(RIDE_TEXT.declined('OLAF')));
  g.owner.declined = [];
  g.r.press('olaf', RIDE_ROW.ask, 2); g.tick(RIDE_ASK_TTL_MS + 1); g.r.frame();
  assert.equal(g.r.word(), null); assert.ok(g.said.includes(RIDE_TEXT.noAnswer('OLAF')));
  // a full wagon refuses at the press
  g.owner.passengers = [['a', 0], ['b', 1], ['c', 2], ['d', 3]];
  g.r.press('olaf', RIDE_ROW.ask, 2);
  assert.equal(g.r.word(), null); assert.equal(g.said.at(-1), RIDE_TEXT.full);
});

test('WAGONS1 THE JOURNEY: the owner\'s `go` sets me out once, to their pixel, landing beside their wagon (its word\'s place, natives); on the road and for a while at its end I keep my seat; an owner gone otherwise puts me down (mutants: every frame a journey, the seat dropped mid-journey)', () => {
  const g = riderRig();
  g.r.press('olaf', RIDE_ROW.ask, 2); g.owner.passengers = [['me', 0]]; g.r.frame();
  g.owner.go = [12, 34, 1];
  g.r.frame(); g.r.frame();
  assert.equal(g.travels.length, 1, 'once a journey');
  assert.deepEqual(g.travels[0], { to: { x: 12, y: 34 }, beside: { x: 10, y: 2, z: 20 }, who: 'OLAF' });
  // the owner leaves the room first; I am on the road, then at its end awaiting their word
  g.owner.model = null;
  g.setTraveling(true); g.r.frame(); g.setTraveling(false);
  g.tick(ARRIVE_WAIT_MS - 10); g.r.frame();
  assert.equal(g.r.seated(), true, 'still seated, waiting for their word at the far end');
  g.tick(20); g.r.frame();
  assert.equal(g.r.seated(), false);
  assert.ok(g.said.includes(RIDE_TEXT.ownerGone));
  assert.ok(GO_HOLD_MS > ARRIVE_WAIT_MS);
});

test('WAGONS1 THE OWNER: an ask put on the strip; Accept seats them (my word\'s `ps`), Decline says `pn` a moment; a journey of mine with riders says `go` (and only then); my riders who leave the room get down, but not while they follow me (mutants: no `go` with riders aboard, the sweep mid-journey)', () => {
  const g = riderRig();
  g.r.hear('ann', { a: 'me' });
  assert.deepEqual(g.r.asks().map((a) => a.peer), ['ann']);
  assert.equal(g.r.announce({ x: 1, y: 2 }), false, 'no riders: no word, no wait');
  g.r.accept('ann');
  assert.deepEqual(g.r.passengers(), [['ann', 0]]);
  assert.deepEqual(g.r.playerSeats(), [0]);
  g.r.hear('bob', { a: 'me' }); g.r.decline('bob');
  assert.deepEqual(g.r.declined(), ['bob']);
  // my companions take the seats ann does not
  assert.deepEqual(g.r.companionSeat(0, true), { feet: [1, 0, 0], yaw: 0 });
  assert.equal(g.r.companionSeat(0, false), null, 'parked: they walk');
  assert.equal(g.r.announce({ x: 7, y: 8 }), true);
  assert.deepEqual(g.r.go(), [7, 8, 1]);
  g.r.sweep(new Set());
  assert.deepEqual(g.r.passengers(), [['ann', 0]], 'on the road behind me');
  g.tick(GO_HOLD_MS + 1); g.r.frame();
  assert.equal(g.r.go(), null, 'the journey said long enough');
  g.r.sweep(new Set());
  assert.deepEqual(g.r.passengers(), []);
});

test('WAGONS1 THE COMPANIONS\' SEAT: a seated companion\'s motor takes no step - its feet the seat\'s, no fall, no walk - and the layer hands each its seat, catching none up while seated (mutants: the gate gone, the seat handle unset)', () => {
  const ai = Object.create(EnemyAI.prototype);
  Object.assign(ai, { feet: [0, 50, 0], yaw: 0, velY: -3, moving: true, isGrounded: false, _acc: 0.5, seat: () => ({ feet: [4, 1, 5], yaw: 1.25 }) });
  ai.update(1 / 60, [0, 0, 0]);
  assert.deepEqual([ai.feet, ai.yaw, ai.velY, ai.moving, ai.isGrounded, ai._acc], [[4, 1, 5], 1.25, 0, false, true, 0]);
  // the layer: two companions, a seat for the first alone
  const rec = (n) => ({ entity: { health: 10, maxHealth: 10 }, ai: { feet: [100 * n, 0, 0] } });
  const bodies = [rec(1), rec(2)];
  const party = { party: [{ boat: 1, name: 'a' }, { boat: 1, name: 'b' }], wake() {}, hurt() {}, knock() {}, isAshore: () => true };
  let n = 0;
  const layer = createCrewAshore({
    party: () => party, now: () => 0,
    place: () => ({ key: 'street', spawn: async () => bodies[n++], remove() {} }),
    leader: () => ({ feet: [0, 0, 0], yaw: 0 }),
    seat: (i) => (i === 0 ? { feet: [9, 9, 9], yaw: 0 } : null),
  });
  layer.frame();
  return new Promise((done) => setTimeout(() => {
    layer.frame();
    assert.deepEqual(bodies[0].ai.seat(), { feet: [9, 9, 9], yaw: 0 });
    assert.equal(bodies[1].ai.seat(), null);
    assert.deepEqual(bodies[0].ai.feet, [100, 0, 0], 'seated: never caught up by the layer (its motor stands it on the seat)');
    assert.deepEqual(bodies[1].ai.feet.map(Math.round), [bodies[1].ai.feet[0], 0, bodies[1].ai.feet[2]].map(Math.round), 'on foot: caught up behind the leader as ever');
    assert.ok(Math.abs(bodies[1].ai.feet[0]) < 40, 'the walker stood behind the leader again');
    done();
  }, 0));
});

test('WAGONS1 THE CARAVAN\'S ROOM, WAGONS2\'S OWN: the caravan\'s room is its own block and model (no ARENA2 block read), its door the caravan\'s frame at its pose and turned with it, the room the player\'s own (a ship\'s type, the caravan\'s key and name, one scene a character); entered from my parked caravan, out behind its rear door on the ground (mutants: another block, the door\'s landing unground)', async () => {
  assert.equal(CARAVAN_BLOCK, 'CARAVAN [WAGONS2]');
  assert.equal(CARAVAN_SCENE_NAME, 'Caravan [WAGONS1]');
  const room = readCaravanRoom({ v: 2, kind: 'caravan', origin: [1, 2, 3], turn: 90, step: [4, 5, 6], yaw: 2 });
  assert.deepEqual(room, { v: 2, kind: 'caravan', origin: [1, 2, 3], turn: 90, step: [4, 5, 6], yaw: 2 });
  assert.deepEqual(readCaravanRoom({ v: 1, kind: 'caravan', origin: [1, 2, 3], step: [4, 5, 6], yaw: 2 }), { ...room, turn: 0 }, 'a WAGONS1 descriptor reads unturned');
  for (const bad of [null, { ...room, v: 3 }, { ...room, kind: 'ship' }, { ...room, step: [1, 2] }, { ...room, yaw: NaN }, { ...room, turn: Infinity }]) assert.equal(readCaravanRoom(bad), null);
  assert.ok(isCaravanRoom(room)); assert.ok(!isCaravanRoom({ uid: 3, hull: 2 }));
  const e = caravanRoomEntry(room, (p) => [p[0] + 1, p[1], p[2]]);
  assert.equal(e.hit.sailingCabin, e.room, 'the private room\'s one slot');
  assert.equal(e.hit.dfBlock.name, CARAVAN_BLOCK);
  assert.deepEqual(e.hit.dfBlock.rmbBlock.subRecords[0].interior.block3dObjectRecords.map((o) => o.modelIdNum), [CARAVAN_ROOM_MODEL_ID]);
  assert.ok(e.hit.roomModels.get(CARAVAN_ROOM_MODEL_ID)?.positions?.length, 'its model served beside the pipeline\'s');
  assert.deepEqual([e.building.buildingType, e.building.buildingKey, e.building.name], [BUILDING_TYPES.Ship, CARAVAN_BUILDING_KEY, 'Caravan']);
  assert.deepEqual([...e.hit.door.matrix.slice(12, 15)], [2, 2, 3]);
  const z = [e.hit.door.matrix[8], e.hit.door.matrix[9], e.hit.door.matrix[10]];
  assert.ok(Math.abs(z[0] - 1) < 1e-6 && Math.abs(z[2]) < 1e-6, 'turned 90 degrees, the room\'s +z is the world\'s +x - the caravan\'s heading');
  assert.equal(caravanRoomEntry({ ...room, v: 9 }, (p) => p), null, 'no room for a bad descriptor');
  // the access: entered from the parked caravan, turned as it stands, out on the ground behind it
  const said = [];
  let entered = null;
  const quarter = [0, Math.SQRT1_2, 0, Math.SQRT1_2];   // a quarter turn about up: pulled toward +x
  const access = createCaravanAccess({
    available: () => true, mode: () => 'exterior', busy: () => false, say: (l) => said.push(l), ownsCaravan: () => true,
    parked: () => ({ position: [10, 1, 10], rotation: quarter, step: [10, 0, 8], yaw: Math.PI }),
    toNative: (p) => p.map((v) => v * 2), fromNative: (p) => p.map((v) => v / 2), ground: (p) => [p[0], 0.25, p[2]],
    enterInterior: async (r) => { entered = r; return true; },
  });
  assert.equal(await access.enter(), true);
  assert.deepEqual({ ...entered, turn: Math.round(entered.turn) }, { v: 2, kind: 'caravan', origin: [20, 2, 20], turn: 90, step: [20, 0, 16], yaw: Math.PI });
  assert.deepEqual(access.returnToWagon(entered), { position: [10, 0.25, 8], yaw: Math.PI });
  assert.ok(access.canRestore(entered));
  const none = createCaravanAccess({ available: () => true, mode: () => 'exterior', busy: () => false, say: (l) => said.push(l), parked: () => null, toNative: (p) => p, fromNative: (p) => p, enterInterior: async () => true });
  assert.equal(await none.enter(), false);
  assert.equal(said.at(-1), CARAVAN_TEXT.notHere);
});

test('WAGONS1 THE INTERIOR HOST: the caravan rides the cabin\'s private-room slot - its own scene name kept for good, its own save field and restore, furnished as a caravan from the purse, its exit by its own door - and the world host hands it the caravan\'s access (THE FOUR HOSTS: world.js wired; worldModes.js the room; exterior.js, the fixed city, and dungeonContext.js stand no caravan room)', () => {
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /const privateRoomSceneName = \(room\) => \(isCaravanRoom\(room\) \? CARAVAN_SCENE_NAME : cabinSceneName\(room\.uid\)\);/);
  assert.match(wm, /if \(interiorCabin\) return privateRoomSceneName\(interiorCabin\);/);
  assert.match(wm, /isCaravanRoom\(interiorCabin\) \? \{ caravanRoom: readCaravanRoom\(interiorCabin\) \} : \{ sailingCabin: readSailingCabin\(interiorCabin\) \}/);
  assert.match(wm, /if \(isCaravanRoom\(interiorCabin\)\) return \{ kind: 'caravan', where: CARAVAN_TEXT\.where \};[^\n]*\n\s+if \(b\.buildingType === BUILDING_TYPES\.Ship\) return \{ kind: 'ship', where: 'Your ship' \};/);
  assert.match(wm, /caravanOut \? host\.caravanRoom\?\.returnToWagon\(interiorCabin\) : host\.sailingCabin\?\.returnToDeck\(interiorCabin, privateVisitOwner\)/);
  assert.match(wm, /if \(saved\?\.caravanRoom\) \{\n\s+if \(mode !== 'exterior' \|\| !host\.caravanRoom\?\.canRestore\(saved\.caravanRoom, saved\.caravanAt\)\) return false;/);   // WAGONS2 (AUDIT): and on the caravan where it stands
  assert.match(wm, /get sailingCabin\(\) \{ return mode === 'interior' && !isCaravanRoom\(interiorCabin\) \? interiorCabin : null; \}/);
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /caravanRoom: caravanRooms,   \/\/ WAGONS1/);
  assert.match(world, /parked: \(\) => hcc\.parkedDoor\(\), ownsCaravan: \(\) => activeWagonKind\(playerEntity\.items \?\? \[\]\) === 'caravan'/);
  for (const host of ['exterior', 'dungeonContext']) assert.doesNotMatch(readFileSync(new URL(`../src/scenes/${host}.js`, import.meta.url), 'utf8'), /caravanRoom/, `${host}.js stands no caravan room`);
});
