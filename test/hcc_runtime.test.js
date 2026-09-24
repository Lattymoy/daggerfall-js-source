// HCC (2026-09-23): THE RUNTIME, PINNED BY EXECUTION - systems/horseCart.js is TrailingWagonRuntime off the IL,
// driven here over a fake host: a flat world, a player who walks and mounts, the eight settings, the hotkeys, the
// windows' questions, the transitions and the save. Every scenario is a thing a player does with the mod on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHorseCartRuntime, DeployedWagonVisual, StationaryHorseVisual, solveTwoWheelPose, HCC_MOUNT_ACTION, HCC_SUMMON_ACTION } from '../src/systems/horseCart.js';
import { WAGON_MODE, HORSE_MODE, INTERIOR_ACCESS, LAST_MOUNT, STORAGE_CONTEXT, TRANSPORT, HCC_TEXT, WAGON_FOLLOW_DISTANCE, HORSE_DISMOUNT_REAR_OFFSET, HITCHED_HORSE_LOCAL_Z, WAGON_SAVE_VERSION } from '../src/systems/horseCartLaw.js';
import { quatForward } from '../src/world/quat.js';

import { makeWorld, RATIO, WX0, WZ0, PARTS } from './hccWorld.mjs';   // the fake host, one home

test('HCC runtime: the settings read at birth; the hotkeys are the registry\'s two actions, not the mod\'s TextKeys (KB1)', () => {
  // The runtime parsed Hotkeys.QuickMountDismount / SummonTransport at birth and warned on a name that was no KeyCode
  // (ParseConfiguredHotkey, falling to K / G). KB1 moved both keys into the registry as HorseMount and HorseSummon,
  // bound and cleared in Controls like every key: the runtime asks `actionPressed` and parses nothing.
  const { rt, w } = makeWorld({ settings: { quickMountKey: 'NotAKey', summonKey: 'None', horseFollowDistance: 99, interiorAccessDistance: 1 } });
  assert.equal(rt.physicalPersistenceEnabled, true); assert.equal(rt.showTrailingWagon, true);
  assert.equal(rt.horseFollowDistance, 8, 'clamped');
  assert.equal(HCC_MOUNT_ACTION, 'HorseMount'); assert.equal(HCC_SUMMON_ACTION, 'HorseSummon');
  assert.ok(!w.log.some((m) => /hotkey|KeyCode/.test(m)), 'no key is parsed, so none is warned about');
});

test('HCC runtime: ownership - a cart and a horse owned put the wagon and the horse with the player; losing the horse drops it', () => {
  const { rt, step, state, w } = makeWorld();
  step();
  assert.equal(state().Mode, WAGON_MODE.WithPlayer); assert.equal(state().HorseMode, HORSE_MODE.WithPlayer);
  w.items.horse = false; step();
  assert.equal(state().HorseMode, HORSE_MODE.None);
  w.items.cart = false; step();
  assert.equal(state().Mode, WAGON_MODE.None);
  const g = rt.canUseTransport(TRANSPORT.Cart);
  assert.equal(g.allowed, false); assert.equal(g.denialMessage, HCC_TEXT.doNotOwnWagon);
  assert.equal(rt.canUseTransport(TRANSPORT.Ship).denialMessage, HCC_TEXT.onlyHorseAndCart);
  assert.equal(rt.tryUseTransport(TRANSPORT.Ship).handled, false);
});

test('HCC runtime: mounting the cart hitches the horse and shows the trailing wagon behind a moving player; dismounting parks it where it stood', () => {
  const { rt, w, step, walk, state, scene } = makeWorld();
  step();
  const r = rt.tryUseTransport(TRANSPORT.Cart);
  assert.equal(r.succeeded, true); assert.equal(w.mode, TRANSPORT.Cart);
  assert.equal(state().HorseMode, HORSE_MODE.HitchedToWagon); assert.equal(state().LastMount, LAST_MOUNT.Cart, 'SetTransportMode remembers the mount');
  step();
  walk(20);
  const v = rt.view();
  assert.ok(v.moving?.pose.active, 'the trailing wagon is up');
  assert.ok(v.moving.pose.position[2] < w.pos[2] && v.moving.pose.position[2] > w.pos[2] - 6, `behind the player: ${v.moving.pose.position[2]} vs ${w.pos[2]}`);
  assert.ok(Math.abs(v.moving.pose.position[1] - 1) < 0.01, 'a metre over the ground');
  assert.ok(v.moving.wheel.angle !== 0, 'the wheels turned');
  assert.equal(v.moving.cargoTier, 0);
  w.weight = 400; step(); assert.equal(rt.view().moving.cargoTier, 50, 'the cargo tier follows the wagon\'s weight');
  // the game set the mode to Foot (the transport window's foot row, the quick-mount key): the wagon parks where it trailed
  w.mode = TRANSPORT.Foot; step();
  assert.equal(state().Mode, WAGON_MODE.Deployed); assert.equal(state().HorseMode, HORSE_MODE.HitchedToWagon);
  const parked = scene(state().WorldX, state().WorldZ);
  assert.ok(Math.abs(parked[2] - v.moving.pose.position[2]) < 0.2, `parked where it trailed: ${parked[2]} vs ${v.moving.pose.position[2]}`);
  step(2);
  const d = rt.view();
  assert.equal(d.moving, null, 'no trailing wagon on foot');
  assert.ok(d.deployed?.isGrounded, 'the parked wagon stands on the ground');
  assert.ok(d.horse?.isInteractive, 'the hitched horse stands with it');
  assert.ok(Math.abs(d.horse.position[2] - (d.deployed.position[2] + HITCHED_HORSE_LOCAL_Z)) < 0.05, 'ahead of the wagon by the hitch offset');
  assert.equal(rt.horseTargetLabel, 'Horse');
});

test('HCC runtime: the parked team is activated back into a ride, and refused from too far, without the cart, or on a loose horse', () => {
  const { rt, w, step, walk, state } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Cart); step(); walk(10); w.mode = TRANSPORT.Foot; step(3);
  assert.equal(rt.handleDeployedWagonActivation(5), true); assert.equal(w.mid.at(-1), 'You are too far away...');
  w.activateMode = 'steal';
  assert.equal(rt.handleDeployedWagonActivation(2), true); assert.equal(w.openedInv, 1, 'Steal opens the pack with the wagon');
  assert.equal(rt.consumeWagonSelectionRequest(), true); assert.equal(rt.consumeWagonSelectionRequest(), false, 'consumed once');
  w.activateMode = 'grab';
  assert.equal(rt.handleDeployedWagonActivation(2), true);
  assert.equal(w.mode, TRANSPORT.Cart, 'Grab on the hitched team mounts it'); assert.equal(state().Mode, WAGON_MODE.WithPlayer);
  w.mode = TRANSPORT.Foot; step(3);
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  w.items.horse = false; step();
  assert.equal(rt.handleDeployedWagonActivation(2), true); assert.equal(w.said.at(-1), HCC_TEXT.needHorseToPull);
  const { rt: r2, w: w2, step: s2 } = makeWorld({ cart: false });
  s2(); assert.equal(r2.handleDeployedWagonActivation(1), false, 'no parked wagon: not this arm');
  w2.items.cart = true;
});

test('HCC runtime: riding the horse off leaves the wagon parked; dismounting leaves the horse behind the player; Talk makes it follow and wait; Info names it', () => {
  const { rt, w, step, walk, state, scene } = makeWorld();
  step();
  assert.equal(rt.tryUseTransport(TRANSPORT.Horse).succeeded, true);
  assert.equal(w.mode, TRANSPORT.Horse); assert.equal(state().Mode, WAGON_MODE.Deployed, 'the wagon is left where the player stood'); assert.equal(state().HorseMode, HORSE_MODE.WithPlayer);
  step(); walk(30);
  w.mode = TRANSPORT.Foot; step();
  assert.equal(state().HorseMode, HORSE_MODE.LooseStationary, 'dismounting leaves the horse standing');
  const hp = scene(state().HorseWorldX, state().HorseWorldZ);
  assert.ok(Math.abs(hp[2] - (w.pos[2] - HORSE_DISMOUNT_REAR_OFFSET)) < 0.05, 'behind the player');
  step(2);
  assert.ok(rt.view().horse?.isInteractive, 'the loose horse stands');
  w.activateMode = 'dialogue';
  assert.equal(rt.handleStationaryHorseActivation(2), true);
  assert.equal(state().HorseMode, HORSE_MODE.FollowingPlayer); assert.equal(w.said.at(-1), 'Your horse follows you.');
  const before = rt.view().horse.position[2];
  walk(20);
  const after = rt.view().horse.position[2];
  assert.ok(after > before + 5, `the horse followed: ${before} -> ${after}`);
  assert.ok(rt.view().horse.walk.walking, 'and walks');
  assert.equal(rt.handleStationaryHorseActivation(2), true);
  assert.equal(state().HorseMode, HORSE_MODE.LooseStationary); assert.equal(w.said.at(-1), 'Your horse waits here.');
  w.activateMode = 'info';
  assert.equal(rt.handleStationaryHorseActivation(2), true);
  assert.equal(w.prompt.label, HCC_TEXT.nameYourHorse); assert.equal(w.prompt.maxCharacters, 31);
  w.prompt.onSubmit('  Bess  '); w.prompt.open = false;
  assert.equal(rt.horseName, 'Bess'); assert.equal(rt.hasHorseName, true); assert.equal(rt.horseTargetLabel, 'Bess');
  assert.equal(rt.horseSubject(true), 'Bess'); assert.equal(rt.horseAndWagonSubject(false), 'Bess and your wagon');
  w.activateMode = 'grab';
  assert.equal(rt.handleStationaryHorseActivation(4), true); assert.equal(w.mid.at(-1), 'You are too far away...');
  assert.equal(rt.handleStationaryHorseActivation(2), true); assert.equal(w.mode, TRANSPORT.Horse, 'Grab rides it');
});

test('HCC runtime: the transport window\'s rows - the horse row is dark when the horse waits across the map, and the cart row until the team is together', () => {
  const { rt, w, step, walk, state } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Horse); step(); walk(30); w.mode = TRANSPORT.Foot; step(2);
  assert.equal(rt.canMountHorseFromTransportWindow(), true, 'the horse three metres behind');
  walk(20);
  assert.equal(rt.canMountHorseFromTransportWindow(), false, 'twenty metres off');
  assert.equal(rt.tryUseTransport(TRANSPORT.Horse).succeeded, false); assert.equal(w.said.at(-1), 'Your horse is not close enough.');
  assert.equal(rt.canUseCartFromTransportWindow(), false, 'the wagon is parked fifty metres back');
  assert.equal(rt.canUseTransport(TRANSPORT.Cart).denialMessage, HCC_TEXT.wagonAndHorseMustBeWithYou);
  w.mode = TRANSPORT.Horse; step();
  assert.equal(w.mode, TRANSPORT.Foot, 'the game set Horse with the horse far off: rejected back');
  assert.equal(state().HorseMode, HORSE_MODE.LooseStationary);
});

test('HCC runtime: the hotkeys - quick mount rides the last mount and dismounts; summon brings the team to the player', () => {
  const { rt, w, step, state, scene } = makeWorld();   // KB1: the two keys are the registry's actions
  step();
  w.keys.add('HorseMount'); step();
  assert.equal(w.mode, TRANSPORT.Horse, 'nothing mounted before: the horse');
  w.keys.add('HorseMount'); step();
  assert.equal(w.mode, TRANSPORT.Foot);
  step(2);
  assert.equal(state().HorseMode, HORSE_MODE.LooseStationary);
  w.pos[2] += 200; step();
  w.keys.add('HorseSummon'); step();
  assert.equal(w.said.at(-1), HCC_TEXT.summonedBoth);
  assert.equal(state().Mode, WAGON_MODE.Deployed); assert.equal(state().HorseMode, HORSE_MODE.HitchedToWagon);
  const p = scene(state().WorldX, state().WorldZ);
  assert.ok(Math.abs(p[2] - (w.pos[2] - WAGON_FOLLOW_DISTANCE)) < 0.05, 'the wagon 2.5 m behind the player');
  w.inside = true; w.keys.add('HorseSummon'); step();
  assert.equal(w.said.at(-1), HCC_TEXT.summonOutdoorsOnly);
  w.keys.add('HorseMount'); step();
  assert.equal(w.said.at(-1), HCC_TEXT.mountOutdoorsOnly);
  w.inside = false;
  const { rt: r2, w: w2, step: s2 } = makeWorld({ cart: false, horse: false });
  s2(); w2.keys.add('HorseMount'); s2();
  assert.equal(w2.said.at(-1), HCC_TEXT.doNotOwnHorseOrWagon); assert.equal(r2.physicalPersistenceEnabled, true);
});

test('HCC runtime: a building\'s door - the pre-transition captures the pose, the success parks the wagon with the building as its access, the failure undoes it', () => {
  const { rt, w, step, walk, state } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Cart); step(); walk(10);
  rt.handlePreTransition({ type: 'ToBuildingInterior', door: [w.pos[0], 0, w.pos[2] + 2] });
  w.mode = TRANSPORT.Foot;   // TransportManager.HandleTransition's dismount
  rt.handleFailedTransition({ type: 'ToBuildingInterior' });
  assert.equal(state().Mode, WAGON_MODE.WithPlayer, 'a failed entry keeps the wagon with the player'); assert.equal(w.mode, TRANSPORT.Cart, 'and the player back on the cart');
  rt.handlePreTransition({ type: 'ToBuildingInterior', door: [w.pos[0], 0, w.pos[2] + 2] });
  w.mode = TRANSPORT.Foot; w.inside = true; w.building = true;
  rt.handleSuccessfulInteriorTransition({ type: 'ToBuildingInterior', buildingKey: 7 });
  assert.equal(state().Mode, WAGON_MODE.Deployed); assert.equal(state().HorseMode, HORSE_MODE.HitchedToWagon);
  assert.equal(state().InteriorAccessMode, INTERIOR_ACCESS.Building); assert.equal(state().InteriorAccessId, 7);
  step();
  assert.equal(rt.canAccessWagonStorage(STORAGE_CONTEXT.NormalInventory).allowed, true, 'inside the building the wagon parked at its door is reachable');
  assert.equal(rt.canAccessWagonInventory().allowed, true);
  w.buildingKey = 8;
  assert.equal(rt.canAccessWagonStorage(STORAGE_CONTEXT.NormalInventory).allowed, false, 'another building: no');
  assert.equal(rt.canAccessWagonStorage(STORAGE_CONTEXT.NormalInventory).denialMessage, HCC_TEXT.notAccessibleFromHere);
  assert.equal(rt.canAccessWagonStorage(9).denialMessage, HCC_TEXT.unknownStorageContext);
  w.buildingKey = 7; w.inside = false; w.building = false;
  rt.handleExteriorTransition();
  assert.equal(state().InteriorAccessMode, INTERIOR_ACCESS.None, 'stepping out closes the access');
  step(2);
  assert.ok(rt.view().deployed?.isGrounded, 'the wagon stands where it was parked');
});

test('HCC runtime: a dungeon\'s door far from the parked wagon grants no exit access; one within the setting does', () => {
  const { rt, w, step, walk, state } = makeWorld({ settings: { interiorAccessDistance: 10 } });
  step(); rt.tryUseTransport(TRANSPORT.Cart); step(); walk(10);
  rt.handlePreTransition({ type: 'ToDungeonInterior', door: [w.pos[0], 0, w.pos[2] + 3] });
  w.mode = TRANSPORT.Foot; w.inside = true; w.dungeon = true;
  rt.handleSuccessfulInteriorTransition({ type: 'ToDungeonInterior', dungeonId: 99 });
  assert.equal(state().InteriorAccessMode, INTERIOR_ACCESS.Dungeon); assert.equal(state().InteriorAccessId, 99);
  assert.equal(rt.canAccessWagonFromDungeonExit().allowed, true);
  assert.equal(rt.canAccessWagonStorage(STORAGE_CONTEXT.DungeonExitSelection).allowed, true);
  assert.equal(rt.canAccessWagonStorage(STORAGE_CONTEXT.NormalInventory).allowed, false, 'the plain inventory deep in a dungeon: no');
  w.dungeonId = 100;
  assert.equal(rt.canAccessWagonFromDungeonExit().denialMessage, HCC_TEXT.tooFarFromEntrance);
  const { rt: r2, w: w2, step: s2, walk: k2, state: st2 } = makeWorld({ settings: { interiorAccessDistance: 10 } });
  s2(); r2.tryUseTransport(TRANSPORT.Cart); s2(); k2(10);
  r2.handlePreTransition({ type: 'ToDungeonInterior', door: [w2.pos[0] + 30, 0, w2.pos[2] + 30] });   // an unusable door reads the player's own spot, which is within the distance; the eligibility is the wagon's distance to the door read
  w2.mode = TRANSPORT.Foot; w2.inside = true; w2.dungeon = true;
  r2.handleSuccessfulInteriorTransition({ type: 'ToDungeonInterior', dungeonId: 99 });
  assert.equal(st2().InteriorAccessMode, INTERIOR_ACCESS.Dungeon, 'a door beyond 3.7 m reads the player\'s position, which the trailing wagon is within 10 m of');
});

test('HCC runtime: the save record round-trips, a load normalises, a new game starts fresh, and the version is 7', () => {
  const { rt, step, walk, state, w } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Horse); step(); walk(5); w.mode = TRANSPORT.Foot; step(2);
  w.activateMode = 'info'; rt.handleStationaryHorseActivation(1); w.prompt.onSubmit('Bess'); w.prompt.open = false;
  const saved = rt.getSaveData();
  assert.equal(saved.Version, WAGON_SAVE_VERSION); assert.equal(saved.HorseName, 'Bess'); assert.equal(saved.Mode, WAGON_MODE.Deployed); assert.equal(saved.HorseMode, HORSE_MODE.LooseStationary);
  assert.notEqual(saved, state(), 'a copy');
  const { rt: r2, step: s2, state: st2 } = makeWorld();
  r2.restoreSaveData({ ...saved, Mode: 77 });
  assert.equal(st2().Mode, WAGON_MODE.None, 'an unknown mode reads None');
  r2.restoreSaveData(saved);
  assert.equal(st2().HorseName, 'Bess'); assert.equal(st2().Mode, WAGON_MODE.Deployed);
  s2(2);
  assert.ok(r2.view().deployed?.isGrounded && r2.view().horse?.isInteractive, 'the loaded wagon and horse stand');
  r2.handleNewGame();
  assert.equal(st2().HorseName, ''); assert.equal(st2().Mode, WAGON_MODE.None);
  r2.handleStartLoad();
  assert.equal(r2.view().deployed, null);
  assert.equal(r2.newSaveData().Version, 7);
});

test('HCC runtime: fast travel - a following horse is suspended and re-stands behind the player at the arrival; with the setting off it waits at the departure', () => {
  const { rt, w, step, walk, state, scene } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Horse); step(); walk(5); w.mode = TRANSPORT.Foot; step(2);
  w.activateMode = 'dialogue'; rt.handleStationaryHorseActivation(2); walk(5);
  assert.equal(state().HorseMode, HORSE_MODE.FollowingPlayer);
  rt.handlePreFastTravel();
  assert.equal(rt.view().horse, null, 'the horse goes with the traveller');
  w.pos = [500, 0.9, 500];
  rt.handlePostFastTravel();
  step(3);
  const hp = scene(state().HorseWorldX, state().HorseWorldZ);
  assert.ok(Math.abs(hp[2] - (500 - rt.horseFollowDistance)) < 0.1 && Math.abs(hp[0] - 500) < 0.1, `re-stood behind the arrival: ${hp}`);
  assert.equal(state().HorseMode, HORSE_MODE.FollowingPlayer);
  step(2); assert.ok(rt.view().horse?.isInteractive);
  const { rt: r2, w: w2, step: s2, walk: k2, state: st2 } = makeWorld({ settings: { followFastTravel: false } });
  s2(); r2.tryUseTransport(TRANSPORT.Horse); s2(); k2(5); w2.mode = TRANSPORT.Foot; s2(2);
  w2.activateMode = 'dialogue'; r2.handleStationaryHorseActivation(2); k2(5);
  const before = st2().HorseWorldZ;
  r2.handlePreFastTravel();
  assert.equal(st2().HorseMode, HORSE_MODE.LooseStationary, 'waits at the departure');
  assert.ok(Math.abs(st2().HorseWorldZ - before) < RATIO * 2, 'where it was');
  w2.pos = [500, 0.9, 500]; r2.handlePostFastTravel(); s2(3);
  assert.equal(st2().HorseMode, HORSE_MODE.LooseStationary);
});

test('HCC runtime: Travel Options\' accelerated journey ending re-stands a following horse; a failing query disables the compatibility once', () => {
  const { rt, w, step, walk, state, scene } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Horse); step(); walk(5); w.mode = TRANSPORT.Foot; step(2);
  w.activateMode = 'dialogue'; rt.handleStationaryHorseActivation(2); walk(3);
  w.travelOpt = true; step(); w.pos = [300, 0.9, 300]; step(); w.travelOpt = false; step(3);
  const hp = scene(state().HorseWorldX, state().HorseWorldZ);
  assert.ok(Math.abs(hp[0] - 300) < 0.1, `re-stood at the journey's end: ${hp}`);
  const { rt: r2, w: w2, step: s2 } = makeWorld();
  Object.defineProperty(w2, 'travelOpt', { get() { throw new Error('no mod'); } });
  s2(2);
  assert.equal(w2.log.filter((m) => /Travel Options compatibility was disabled/.test(m)).length, 1, 'said once');
  void r2;
});

test('HCC runtime: the persistence setting - off recalls the team to the player and the windows answer as DFU\'s; on again with no horse says so', () => {
  const { rt, w, step, walk, state } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Horse); step(); walk(5); w.mode = TRANSPORT.Foot; step(2);
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  w.settings.physicalPersistence = false; rt.handleSettingsChanged(); step();
  assert.equal(rt.physicalPersistenceEnabled, false);
  assert.equal(state().Mode, WAGON_MODE.WithPlayer); assert.equal(state().HorseMode, HORSE_MODE.WithPlayer);
  assert.equal(rt.view().deployed, null); assert.equal(rt.view().horse, null, 'nothing physical stands');
  assert.equal(rt.canAccessWagonInventory().allowed, true, 'the wagon is simply there');
  assert.equal(rt.canMountHorseFromTransportWindow(), true);
  assert.equal(rt.tryUseTransport(TRANSPORT.Cart).succeeded, true); assert.equal(w.mode, TRANSPORT.Cart);
  step(); walk(5);
  assert.ok(rt.view().moving?.pose.active, 'the trailing wagon still trails');
  w.items.horse = false; step();
  w.settings.physicalPersistence = true; rt.handleSettingsChanged(); step();
  assert.equal(w.said.at(-1), HCC_TEXT.needHorseWhilePersistence); assert.equal(w.mode, TRANSPORT.Foot);
  w.settings.showTrailingWagon = false; w.items.horse = true; rt.handleSettingsChanged(); step(); rt.tryUseTransport(TRANSPORT.Cart); step(); walk(3);
  assert.equal(rt.view().moving, null, 'ShowTrailingWagon off hides the trailing wagon alone');
});

test('HCC runtime: the floating origin - rebase moves every scene point the machine holds and nothing in the record', () => {
  const { rt, w, step, walk, state } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Cart); step(); walk(10);
  const before = [...rt.view().moving.pose.position];
  const rec = { ...state() };
  rt.rebase([100, 0, -50]);
  const after = rt.view().moving.pose.position;
  assert.deepEqual(after, [before[0] + 100, before[1], before[2] - 50]);
  assert.deepEqual(state(), rec, 'the natives stand');
  assert.equal(rt._trail().points[0][0], 100);
});

test('HCC runtime: the visuals - the parked wagon grounds its two wheels and retries every second where there is no ground; the horse stands only when grounded', () => {
  const phys = { now: () => 0, raycastAll: () => [], sphereCastClear: () => true, log: { warn() {} } };
  const dv = new DeployedWagonVisual(PARTS, [0, 5, 0], [0, 0, 1], 0, 750, phys, 10);
  assert.equal(dv.isGrounded, false); assert.equal(dv.nextGroundRetryTime, 11); assert.equal(dv.tryGetGroundedPose(), null);
  const flat = { now: () => 0, raycastAll: (o, d, max) => (d[1] < 0 && o[1] >= 0 && o[1] <= max ? [{ point: [o[0], 0, o[2]], distance: o[1], normal: [0, 1, 0] }] : []), sphereCastClear: () => true };
  const dv2 = new DeployedWagonVisual(PARTS, [0, 5, 0], [0, 0, 1], 600, 750, flat, 0);
  assert.equal(dv2.isGrounded, true); assert.equal(dv2.cargoTier, 75);
  assert.ok(Math.abs(dv2.position[1] - 0) < 1e-6, 'the wheels\' pivots at 0.5 sit a radius (0.5) over the ground: the body at 0');
  assert.throws(() => new DeployedWagonVisual(null, [0, 0, 0], [0, 0, 1], 0, 750, flat, 0), /no object for vanilla wagon model 41214/);
  const slope = { ...flat, raycastAll: (o, d, max) => (d[1] < 0 ? [{ point: [o[0], o[0] * 0.5, o[2]], distance: o[1] - o[0] * 0.5, normal: [0, 1, 0] }] : []) };
  const dv3 = new DeployedWagonVisual(PARTS, [0, 5, 0], [0, 0, 1], 0, 750, slope, 0);
  assert.equal(dv3.isGrounded, true);
  const f = quatForward(dv3.rotation);
  assert.ok(Math.abs(f[2] - 1) < 1e-6, 'a side slope keeps the heading');
  assert.ok(dv3.rotation[2] !== 0, 'and rolls the wagon about its forward');
  const s = solveTwoWheelPose([-1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0.5, 0], 0.5);
  assert.deepEqual(s.position.map((v) => Math.round(v * 1e6) / 1e6), [0, 0, 0]);
  assert.equal(solveTwoWheelPose([-1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0.5, 0], 0), null, 'no radius');
  assert.equal(solveTwoWheelPose([0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 0.5, 0], 0.5), null, 'no axle');
  assert.equal(solveTwoWheelPose([1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0.5, 0], 0.5), null, 'an axle the wrong way round leans the up down: refused');
  const hv = new StationaryHorseVisual(true, [3, 2, 4], [1, 0, 0], null, flat, 0);
  assert.equal(hv.isInteractive, true); assert.deepEqual(hv.position, [3, 0, 4]);
  hv.tick([3.005, 2, 4], [1, 0, 0], null, 1);
  assert.equal(hv.grounded, true, 'half a centimetre is no new pose'); assert.equal(hv.requestedPosition[0], 3, 'the requested pose stands (the centimetre tolerance)');
  hv.tick([3.5, 2, 4], [1, 0, 0], null, 1);
  assert.equal(hv.grounded, true, 'a new pose re-grounds at once when the ground answers');
  assert.deepEqual(hv.position, [3.5, 0, 4]);
  assert.throws(() => new StationaryHorseVisual(false, [0, 0, 0], [0, 0, 1], null, flat, 0), /horse source textures/);
  hv.applyFollowingPose([9, 0, 9], [0, 0, 1], 2);
  assert.equal(hv.motionSpeed, 2); hv.stepWalk(0.5, true); assert.equal(hv.walk.walking, true);
  hv.offset([1, 1, 1]); assert.deepEqual(hv.position, [10, 1, 10]);
  hv.release(); assert.equal(hv.isInteractive, false);
});
