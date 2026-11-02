// FIELD BUGS 2026-10-25e HORSE-WAKE ("Broken Mounts: Horses in the inventory become unusable after logging back in"). A
// dungeon door leaves the horse standing outside it (Horse Cart and Cargo's HandlePreTransition), the save taken inside
// keeps it there, and the online page wakes the character at the nearest temple, town or graveyard instead of inside
// (world.js ONLINE-UNDERGROUND-LOAD1). The horse stayed at the door, beyond every mount's reach, with the horse still in
// the pack. A load that lands away from its save now calls the pair to the player (horseCart.js callTeamToLanding).
// All through the real runtime over test/hccWorld.mjs, the save round-tripped as JSON.
// bible/01-Overview/bugs/Field-Bugs-2026-10-25e.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from '../../hccWorld.mjs';
import { WAGON_MODE, HORSE_MODE, TRANSPORT } from '../../../src/systems/horse/horseCartLaw.js';

/** Where the online page wakes the player: 300 m from the dungeon door the save was taken behind. */
const WAKE_POSITION = [0, 0.9, 300];
const NOT_CLOSE_ENOUGH = 'Your horse is not close enough.';

const savedRecord = (harness) => JSON.parse(JSON.stringify(harness.rt.getSaveData()));

/** Through a dungeon door as worldModes.js's dungeonTransition calls the runtime, then the save taken inside. */
function saveInsideDungeon(harness) {
  const { w, rt, step } = harness;
  rt.handlePreTransition({ type: 'ToDungeonInterior', door: [w.pos[0], 0, w.pos[2] + 2] });
  w.mode = TRANSPORT.Foot;   // TransportManager.HandleTransition's dismount
  w.inside = true;
  w.dungeon = true;
  rt.handleSuccessfulInteriorTransition({ type: 'ToDungeonInterior', dungeonId: 99 });
  step(3);
  return savedRecord(harness);
}

/** The load as world.js runs it: OnStartLoad, the player landed, then the record restored with the landing's word. */
function loadAt(record, { position, elsewhere, cart = false, settings = {} }) {
  const harness = makeWorld({ cart, settings });
  harness.w.pos = [...position];
  harness.rt.handleStartLoad();
  harness.rt.restoreSaveData(record, { elsewhere });
  harness.step(10);
  return harness;
}

/** The horse's distance from the player, in scene metres. */
function horseDistance(harness) {
  const state = harness.state();
  const horse = harness.scene(state.HorseWorldX, state.HorseWorldZ);
  return Math.hypot(horse[0] - harness.w.pos[0], horse[2] - harness.w.pos[2]);
}

function rideIntoDungeon({ cart = false } = {}) {
  const harness = makeWorld({ cart });
  harness.step();
  assert.equal(harness.rt.tryUseTransport(TRANSPORT.Horse).succeeded, true);
  harness.step(3);
  return saveInsideDungeon(harness);
}

test('HORSE-WAKE the report: a horse ridden into a dungeon, the save taken inside, the online wake 300 m away - the horse comes to the player and is ridden; a load where the save stood leaves it waiting at the door (mutants: no call on the word, the word not passed)', () => {
  const record = rideIntoDungeon();
  assert.equal(record.HorseMode, HORSE_MODE.LooseStationary, 'the door leaves the horse standing outside it');

  const before = loadAt(record, { position: WAKE_POSITION, elsewhere: false });
  assert.equal(before.rt.canMountHorseFromTransportWindow(), false, 'the fault: the Transport window\'s horse row is dark');
  assert.equal(before.rt.tryUseTransport(TRANSPORT.Horse).denialMessage, NOT_CLOSE_ENOUGH);

  const woken = loadAt(record, { position: WAKE_POSITION, elsewhere: true });
  assert.equal(woken.state().HorseMode, HORSE_MODE.FollowingPlayer, 'the horse is called to follow');
  assert.ok(horseDistance(woken) < 5, `it stands behind the player: ${horseDistance(woken)} m`);
  assert.equal(woken.rt.canMountHorseFromTransportWindow(), true);
  assert.equal(woken.rt.tryUseTransport(TRANSPORT.Horse).succeeded, true);
  assert.equal(woken.w.mode, TRANSPORT.Horse);

  const atTheDoor = loadAt(record, { position: [0, 0.9, 0], elsewhere: false });
  assert.equal(atTheDoor.state().HorseMode, HORSE_MODE.LooseStationary, 'a load at the save is the mod\'s own: the horse waits where it was left');
  assert.deepEqual([atTheDoor.state().HorseWorldX, atTheDoor.state().HorseWorldZ], [record.HorseWorldX, record.HorseWorldZ]);
});

test('HORSE-WAKE a team driven into a dungeon - the wagon parked at the door with its horse hitched - comes to the player whole, and its horse is ridden from there', () => {
  const harness = makeWorld();
  harness.step();
  assert.equal(harness.rt.tryUseTransport(TRANSPORT.Cart).succeeded, true);
  harness.step(3);
  const record = saveInsideDungeon(harness);
  assert.deepEqual([record.Mode, record.HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon]);

  const woken = loadAt(record, { position: WAKE_POSITION, elsewhere: true, cart: true });
  assert.deepEqual([woken.state().Mode, woken.state().HorseMode], [WAGON_MODE.FollowingPlayer, HORSE_MODE.HitchedToWagon], 'the hitched team follows');
  const wagon = woken.scene(woken.state().WorldX, woken.state().WorldZ);
  assert.ok(Math.hypot(wagon[0] - woken.w.pos[0], wagon[2] - woken.w.pos[2]) < 15, 'the wagon stands behind the player, not at the door');
  assert.equal(woken.rt.canMountHorseFromTransportWindow(), true);

  const parked = loadAt(record, { position: WAKE_POSITION, elsewhere: false, cart: true });
  assert.equal(parked.rt.canMountHorseFromTransportWindow(), false, 'the fault, for the team');
  assert.equal(parked.rt.canUseCartFromTransportWindow(), false);
});

test('HORSE-WAKE a horse following its owner on foot into a dungeon comes to the player too', () => {
  const harness = makeWorld({ cart: false });
  harness.step();
  harness.rt.summonTransport();
  harness.step(3);
  harness.w.activateMode = 'dialogue';
  assert.equal(harness.rt.handleStationaryHorseActivation(2), true);
  assert.equal(harness.state().HorseMode, HORSE_MODE.FollowingPlayer);
  harness.walk(10);
  const record = saveInsideDungeon(harness);
  assert.equal(record.HorseMode, HORSE_MODE.FollowingPlayer, 'it waits at the door, still following');

  const before = loadAt(record, { position: WAKE_POSITION, elsewhere: false });
  assert.equal(before.rt.tryUseTransport(TRANSPORT.Horse).denialMessage, NOT_CLOSE_ENOUGH, 'the fault: a following horse is left at the door as well');

  const woken = loadAt(record, { position: WAKE_POSITION, elsewhere: true });
  assert.ok(horseDistance(woken) < 5, `it stands behind the player: ${horseDistance(woken)} m`);
  assert.equal(woken.rt.tryUseTransport(TRANSPORT.Horse).succeeded, true);
});

test('HORSE-WAKE only the pair the respawn would call comes: a wagon parked alone stays where it was left, and a pair sent to the stable stays at the stable', () => {
  // the wagon parked where its horse was mounted, the horse then ridden into the dungeon
  const record = rideIntoDungeon({ cart: true });
  assert.deepEqual([record.Mode, record.HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.LooseStationary]);
  const woken = loadAt(record, { position: WAKE_POSITION, elsewhere: true, cart: true });
  assert.equal(woken.state().Mode, WAGON_MODE.Deployed, 'the wagon stays parked');
  assert.deepEqual([woken.state().WorldX, woken.state().WorldZ], [record.WorldX, record.WorldZ], 'where it was left');
  assert.ok(horseDistance(woken) < 5, 'the horse comes');

  const stabled = makeWorld({ cart: false });
  stabled.step();
  assert.equal(stabled.rt.sendTransportAway().ok, true);
  const stabledRecord = saveInsideDungeon(stabled);
  const fromTheStable = loadAt(stabledRecord, { position: WAKE_POSITION, elsewhere: true });
  assert.deepEqual([fromTheStable.state().HorseMode, fromTheStable.state().HorseStabled], [HORSE_MODE.WithPlayer, true], 'still at the stable');
});

test('HORSE-WAKE the call is the load\'s alone: with Follow Fast Travel off, the next journey after it leaves the horse waiting at its departure (mutant: the forced journey left armed)', () => {
  const record = rideIntoDungeon();
  const woken = loadAt(record, { position: WAKE_POSITION, elsewhere: true, settings: { followFastTravel: false } });
  assert.equal(woken.state().HorseMode, HORSE_MODE.FollowingPlayer, 'the load called it, Follow Fast Travel or not');
  woken.rt.handlePreFastTravel();
  woken.rt.handlePostFastTravel();
  assert.equal(woken.state().HorseMode, HORSE_MODE.LooseStationary, 'an ordinary journey: the horse waits where it stood');
});
