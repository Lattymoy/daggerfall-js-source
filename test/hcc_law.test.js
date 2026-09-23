// HCC (2026-09-23, Mac: "Next mod I want to implement 1 to 1 and also enhance its online integration functionality"):
// THE LAW, PINNED BY EXECUTION - systems/horseCartLaw.js is TrailingWagonRuntime's pure arithmetic read off
// TrailingWagon.dll's IL (vendor/horse-cart-and-cargo/il/). Every pin here drives a function with the values the
// IL compares and expects what the IL branches to; a pin that reads the same number twice is a mutant's meal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAGON_MODE, HORSE_MODE, INTERIOR_ACCESS, LAST_MOUNT, STORAGE_CONTEXT, HORSE_ACTIVATION, TRANSPORT, ACTIVATE_MODE,
  WAGON_FOLLOW_DISTANCE, HITCHED_HORSE_LOCAL_Z, ACTIVATION_REACH, WAGON_SAVE_VERSION, HORSE_NAME_MAX, DUNGEON_DOOR_USABLE_RADIUS,
  HORSE_MENU_MOUNT_DISTANCE, HORSE_WAGON_HITCH_DISTANCE, WAGON_INVENTORY_DISTANCE, DEFAULT_HORSE_FOLLOW_DISTANCE, DEFAULT_INTERIOR_ACCESS_DISTANCE,
  sceneToWorld, worldToScene, castWorldCoordinate, applyLocalOffsetToWorld, newSaveData, copySaveData, normalizeSaveData,
  normalizeHorseName, resolveHorseNameInput, reconcileHorseNameOwnership, resolvePersistenceDisabledState, resolvePersistenceEnabledState,
  isHorseTransportAvailable, isCartTransportAvailable, isWagonInventoryAccessible, isDungeonExitWagonAccessAllowed, interiorAccessRequiresMapPixelMatch,
  isUsableDungeonEntranceDoorPosition, isHitchedTeamFollowing, isAutonomousHorseFollowing, isDirectHitchedTeamMount, isPhysicalTeamWithinMountDistances,
  isPhysicalTransportStateValid, canRefreshDirectCartTransport, resolveQuickMountMode, resolveHorseActivation, isHorseCommandMode, isHorseNamingMode,
  resolveInteriorEntryMode, isCartInteriorDeployment, shouldDeployIndependentHorseForInterior, horseTravelsWithFastTravel, resolveFastTravelDepartureModes,
  shouldReconcileAfterTravelOptions, clampHorseFollowDistance, clampInteriorWagonAccessDistance, isWithinInteriorEntranceDistance,
  formatHorseSubject, formatHorseAndWagonSubject, horseTargetLabel, isPreferredGround, pickGround, calculateHorseOrientation, horseViewFor,
  walkFramesPerSecond, idleFrame, stepHorseWalk, freshHorseWalk, signedLongitudinalTravel, wheelRotationDegrees, wrapWheelAngle, wheelRadiusOf,
  cargoTier, CARGO_TIERS, horizontalForward, horizontalRight, normalizeHeading, angleBetween, HCC_TEXT,
} from '../src/systems/horseCartLaw.js';

test('HCC law: the enums are the assembly\'s numbers, and the strings DFU\'s TransportModes', () => {
  assert.deepEqual(WAGON_MODE, { None: 0, WithPlayer: 1, Deployed: 2, FollowingPlayer: 3 });
  assert.deepEqual(HORSE_MODE, { HitchedToWagon: 0, LooseStationary: 1, WithPlayer: 2, None: 3, FollowingPlayer: 4 });
  assert.deepEqual(INTERIOR_ACCESS, { None: 0, Building: 1, Dungeon: 2 });
  assert.deepEqual(LAST_MOUNT, { None: 0, Horse: 1, Cart: 2 });
  assert.deepEqual(STORAGE_CONTEXT, { NormalInventory: 0, Trade: 1, DungeonExitSelection: 2 });
  assert.deepEqual(HORSE_ACTIVATION, { None: 0, Ride: 1, Follow: 2, Wait: 3, FollowHitchedTeam: 4, MountHitchedTeam: 5 });
  assert.deepEqual(TRANSPORT, { Foot: 'Foot', Horse: 'Horse', Cart: 'Cart', Ship: 'Ship' });
  assert.deepEqual(ACTIVATE_MODE, { Steal: 'steal', Grab: 'grab', Info: 'info', Talk: 'dialogue' });
  assert.equal(WAGON_FOLLOW_DISTANCE, 2.5); assert.equal(HITCHED_HORSE_LOCAL_Z, 3.1); assert.equal(ACTIVATION_REACH, 3.2);
  assert.equal(WAGON_SAVE_VERSION, 7); assert.equal(HORSE_NAME_MAX, 31); assert.equal(DUNGEON_DOOR_USABLE_RADIUS, 3.7);
  assert.equal(HORSE_MENU_MOUNT_DISTANCE, 3.5); assert.equal(HORSE_WAGON_HITCH_DISTANCE, 3.5); assert.equal(WAGON_INVENTORY_DISTANCE, 5);
  assert.equal(DEFAULT_HORSE_FOLLOW_DISTANCE, 3); assert.equal(DEFAULT_INTERIOR_ACCESS_DISTANCE, 50);
});

test('HCC law: scene <-> world runs on the player\'s pair and the ratio, truncating to the int32 natives', () => {
  const [wx, wz] = sceneToWorld([12, 5, -3], [10, 0, 0], 100000, 200000, 40);
  assert.deepEqual([wx, wz], [100080, 199880]);
  const [sx, sz] = worldToScene(100080, 199880, 100000, 200000, [10, 7, 0], 40);
  assert.equal(sx, 12); assert.equal(sz, -3);
  assert.deepEqual(sceneToWorld([0.31, 0, -0.31], [0, 0, 0], 0, 0, 40), [12, -12], 'a native is an int, truncated toward zero (12.4 -> 12, -12.4 -> -12)');
  assert.equal(castWorldCoordinate(1.9), 1); assert.equal(castWorldCoordinate(-1.9), -1);
  assert.equal(castWorldCoordinate(1e12), 2147483647); assert.equal(castWorldCoordinate(-1e12), -2147483648);
  assert.throws(() => castWorldCoordinate(NaN), RangeError);
  assert.throws(() => sceneToWorld([0, 0, 0], [0, 0, 0], 0, 0, 0), RangeError);
  assert.throws(() => worldToScene(0, 0, 0, 0, [0, 0, 0], -1), RangeError);
  // ApplyLocalOffsetToWorld: right x, forward z, in natives; facing +Z the right is +X
  assert.deepEqual(applyLocalOffsetToWorld(1000, 2000, [0, 0, 1], 1, 2.5, 40), [1040, 2100]);
  // facing +X the right is -Z
  assert.deepEqual(applyLocalOffsetToWorld(1000, 2000, [1, 0, 0], 1, 0, 40), [1000, 1960]);
});

test('HCC law: the save record - fifteen fields, copied whole, normalised on load (unknown enums to None, unit headings, the version)', () => {
  const d = newSaveData();
  assert.equal(Object.keys(d).length, 15);
  assert.equal(d.Version, 7); assert.equal(d.Mode, WAGON_MODE.None); assert.equal(d.HorseMode, HORSE_MODE.None);
  assert.deepEqual([d.HeadingX, d.HeadingZ, d.HorseHeadingX, d.HorseHeadingZ], [0, 1, 0, 1]);
  const c = copySaveData({ ...d, HorseName: 'Bess', Mode: 2, Junk: 1 });
  assert.equal(c.HorseName, 'Bess'); assert.equal(c.Mode, 2); assert.equal('Junk' in c, false);
  const n = normalizeSaveData({ Version: 3, Mode: 9, HorseMode: 7, HeadingX: 3, HeadingZ: 4, HorseName: '  Bess  ', InteriorAccessMode: 5, LastMount: 4 }, 40);
  assert.equal(n.Mode, WAGON_MODE.None); assert.equal(n.HorseMode, HORSE_MODE.None);
  assert.ok(Math.abs(n.HeadingX - 0.6) < 1e-9 && Math.abs(n.HeadingZ - 0.8) < 1e-9, 'the heading is a unit vector');
  assert.equal(n.HorseName, 'Bess'); assert.equal(n.InteriorAccessMode, INTERIOR_ACCESS.None); assert.equal(n.LastMount, LAST_MOUNT.None);
  assert.equal(normalizeSaveData(null, 40).Version, WAGON_SAVE_VERSION);
  const z = normalizeSaveData({ ...d, HeadingX: 0, HeadingZ: 0 }, 40);
  assert.deepEqual([z.HeadingX, z.HeadingZ], [0, 1], 'a zero heading reads forward');
});

test('HCC law: the horse\'s name - trimmed, at most 31, an empty entry keeps the old, no horse no name', () => {
  assert.equal(normalizeHorseName(null), ''); assert.equal(normalizeHorseName('  Star  '), 'Star');
  assert.equal(normalizeHorseName('x'.repeat(40)).length, 31);
  assert.equal(resolveHorseNameInput('Star', '   '), 'Star'); assert.equal(resolveHorseNameInput('Star', ' Bess '), 'Bess');
  assert.equal(reconcileHorseNameOwnership(' Bess ', true), 'Bess'); assert.equal(reconcileHorseNameOwnership('Bess', false), '');
  assert.equal(horseTargetLabel(''), 'Horse'); assert.equal(horseTargetLabel(' Bess '), 'Bess');
  assert.equal(formatHorseSubject('', true), 'Your horse'); assert.equal(formatHorseSubject('', false), 'your horse');
  assert.equal(formatHorseSubject('Bess', true), 'Bess'); assert.equal(formatHorseAndWagonSubject('', true), 'Your horse and wagon');
  assert.equal(formatHorseAndWagonSubject('Bess', false), 'Bess and your wagon');
  assert.equal(HCC_TEXT.nameYourHorse, 'Name your horse:');
});

test('HCC law: the persistence resolutions, off and on', () => {
  // off: cart owned -> the cart with the player, the horse hitched; no cart, a horse -> the horse with the player
  let r = resolvePersistenceDisabledState(TRANSPORT.Cart, true, true);
  assert.equal(r.WagonMode, WAGON_MODE.WithPlayer); assert.equal(r.HorseMode, HORSE_MODE.WithPlayer, 'off, the horse is simply with the player'); assert.equal(r.TransportMode, TRANSPORT.Cart); assert.equal(r.RequiresHorseMessage, false);
  r = resolvePersistenceDisabledState(TRANSPORT.Cart, false, true);
  assert.equal(r.WagonMode, WAGON_MODE.None); assert.equal(r.HorseMode, HORSE_MODE.WithPlayer); assert.equal(r.TransportMode, TRANSPORT.Foot, 'a cart mode without a cart drops to foot');
  r = resolvePersistenceDisabledState(TRANSPORT.Horse, false, false);
  assert.equal(r.HorseMode, HORSE_MODE.None); assert.equal(r.TransportMode, TRANSPORT.Foot);
  // on: the cart without a horse is a message
  r = resolvePersistenceEnabledState(TRANSPORT.Cart, true, false);
  assert.equal(r.RequiresHorseMessage, true); assert.equal(r.TransportMode, TRANSPORT.Foot);
  r = resolvePersistenceEnabledState(TRANSPORT.Cart, true, true);
  assert.equal(r.RequiresHorseMessage, false); assert.equal(r.TransportMode, TRANSPORT.Cart); assert.equal(r.HorseMode, HORSE_MODE.HitchedToWagon);
});

test('HCC law: the availability predicates', () => {
  assert.equal(isHorseTransportAvailable(true, true, false), false); assert.equal(isHorseTransportAvailable(false, true, false), true); assert.equal(isHorseTransportAvailable(true, false, true), false);
  assert.equal(isCartTransportAvailable(true, true, false, true), false); assert.equal(isCartTransportAvailable(false, true, false, false), true); assert.equal(isCartTransportAvailable(true, true, true, false), false); assert.equal(isCartTransportAvailable(true, true, true, true), true);
  assert.equal(isWagonInventoryAccessible(true, true, false), false); assert.equal(isWagonInventoryAccessible(false, true, false), true); assert.equal(isWagonInventoryAccessible(false, false, true), false);
  assert.equal(isDungeonExitWagonAccessAllowed(true, true, true, false), false); assert.equal(isDungeonExitWagonAccessAllowed(false, true, true, false), true); assert.equal(isDungeonExitWagonAccessAllowed(true, true, false, true), false); assert.equal(isDungeonExitWagonAccessAllowed(true, true, true, true), true);
  assert.equal(interiorAccessRequiresMapPixelMatch(INTERIOR_ACCESS.Building), true); assert.equal(interiorAccessRequiresMapPixelMatch(INTERIOR_ACCESS.Dungeon), false);
  assert.equal(isUsableDungeonEntranceDoorPosition([0, 0, 0], [3.6, 0, 0]), true); assert.equal(isUsableDungeonEntranceDoorPosition([0, 0, 0], [3.8, 0, 0]), false);
  assert.equal(isUsableDungeonEntranceDoorPosition([0, 0, 0], [0, 100, 3]), true, 'horizontal');
  assert.equal(isHitchedTeamFollowing(WAGON_MODE.FollowingPlayer, HORSE_MODE.HitchedToWagon), true); assert.equal(isHitchedTeamFollowing(WAGON_MODE.FollowingPlayer, HORSE_MODE.None), false);
  assert.equal(isAutonomousHorseFollowing({ Mode: WAGON_MODE.None, HorseMode: HORSE_MODE.FollowingPlayer }), true);
  assert.equal(isAutonomousHorseFollowing({ Mode: WAGON_MODE.FollowingPlayer, HorseMode: HORSE_MODE.HitchedToWagon }), true);
  assert.equal(isAutonomousHorseFollowing({ Mode: WAGON_MODE.Deployed, HorseMode: HORSE_MODE.HitchedToWagon }), false);
  assert.equal(isDirectHitchedTeamMount(WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon, true), true); assert.equal(isDirectHitchedTeamMount(WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon, false), false);
  assert.equal(isDirectHitchedTeamMount(WAGON_MODE.WithPlayer, HORSE_MODE.HitchedToWagon, true), false);
  assert.equal(isPhysicalTeamWithinMountDistances([0, 0, 0], [4.9, 0, 0], [3.4, 0, 0]), true, 'the wagon within 5, the horse within 3.5, the horse within 3.5 of the wagon');
  assert.equal(isPhysicalTeamWithinMountDistances([0, 0, 0], [5.1, 0, 0], [3.4, 0, 0]), false, 'the wagon beyond 5');
  assert.equal(isPhysicalTeamWithinMountDistances([0, 0, 0], [4, 0, 0], [3.6, 0, 0]), false, 'the horse beyond 3.5');
  assert.equal(isPhysicalTeamWithinMountDistances([0, 0, 0], [4, 0, 0], [0, 0, 3]), false, 'the horse beyond 3.5 of the wagon');
  assert.equal(isPhysicalTransportStateValid(true, true, WAGON_MODE.WithPlayer, HORSE_MODE.HitchedToWagon, TRANSPORT.Cart), true);
  assert.equal(isPhysicalTransportStateValid(true, false, WAGON_MODE.WithPlayer, HORSE_MODE.HitchedToWagon, TRANSPORT.Cart), false);
  assert.equal(isPhysicalTransportStateValid(true, true, WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon, TRANSPORT.Cart), false);
  assert.equal(isPhysicalTransportStateValid(false, true, WAGON_MODE.None, HORSE_MODE.WithPlayer, TRANSPORT.Horse), true);
  assert.equal(isPhysicalTransportStateValid(false, true, WAGON_MODE.None, HORSE_MODE.LooseStationary, TRANSPORT.Horse), false);
  assert.equal(canRefreshDirectCartTransport(TRANSPORT.Cart, true, true, WAGON_MODE.WithPlayer, HORSE_MODE.HitchedToWagon), true);
  assert.equal(canRefreshDirectCartTransport(TRANSPORT.Cart, true, true, WAGON_MODE.WithPlayer, HORSE_MODE.WithPlayer), false);
});

test('HCC law: quick mount, the horse\'s activation ladder and the two interaction modes', () => {
  assert.equal(resolveQuickMountMode(LAST_MOUNT.Cart, true, true), TRANSPORT.Cart);
  assert.equal(resolveQuickMountMode(LAST_MOUNT.Cart, true, false), TRANSPORT.Horse, 'no cart: the horse');
  assert.equal(resolveQuickMountMode(LAST_MOUNT.Horse, true, true), TRANSPORT.Horse);
  assert.equal(resolveQuickMountMode(LAST_MOUNT.None, false, true), TRANSPORT.Cart, 'no horse: the cart (the mount then refuses for want of a horse)');
  assert.equal(resolveQuickMountMode(LAST_MOUNT.None, false, false), TRANSPORT.Foot);
  assert.equal(resolveQuickMountMode(LAST_MOUNT.None, true, true), TRANSPORT.Horse);
  assert.equal(isHorseCommandMode('dialogue'), true); assert.equal(isHorseCommandMode('grab'), false);
  assert.equal(isHorseNamingMode('info'), true); assert.equal(isHorseNamingMode('steal'), false);
  // Talk (the command mode): a loose horse follows, a following one waits, the hitched deployed team follows
  assert.equal(resolveHorseActivation(WAGON_MODE.None, HORSE_MODE.LooseStationary, false, true), HORSE_ACTIVATION.Follow);
  assert.equal(resolveHorseActivation(WAGON_MODE.None, HORSE_MODE.FollowingPlayer, false, true), HORSE_ACTIVATION.Wait);
  assert.equal(resolveHorseActivation(WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon, true, true), HORSE_ACTIVATION.FollowHitchedTeam);
  assert.equal(resolveHorseActivation(WAGON_MODE.FollowingPlayer, HORSE_MODE.HitchedToWagon, true, true), HORSE_ACTIVATION.Wait);
  // Grab / Steal: a loose horse is ridden, the hitched deployed team mounted
  assert.equal(resolveHorseActivation(WAGON_MODE.None, HORSE_MODE.LooseStationary, false, false), HORSE_ACTIVATION.Ride);
  assert.equal(resolveHorseActivation(WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon, true, false), HORSE_ACTIVATION.MountHitchedTeam);
  assert.equal(resolveHorseActivation(WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon, false, false), HORSE_ACTIVATION.Ride, 'without the cart owned the horse is simply ridden');
  assert.equal(resolveHorseActivation(WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon, false, true), HORSE_ACTIVATION.None, 'and in Talk mode there is nothing to command');
});

test('HCC law: the interior entry mode, the independent horse, fast travel\'s departure and the Travel Options reconcile', () => {
  assert.equal(resolveInteriorEntryMode(TRANSPORT.Cart, true, TRANSPORT.Cart, true, true, true, HORSE_MODE.HitchedToWagon), TRANSPORT.Cart);
  assert.equal(resolveInteriorEntryMode(TRANSPORT.Foot, true, TRANSPORT.Cart, true, true, true, HORSE_MODE.HitchedToWagon), TRANSPORT.Cart, 'the dismount already happened: the previous mode speaks');
  assert.equal(resolveInteriorEntryMode(TRANSPORT.Foot, true, TRANSPORT.Horse, false, false, true, HORSE_MODE.WithPlayer), TRANSPORT.Horse);
  assert.equal(resolveInteriorEntryMode(TRANSPORT.Foot, false, TRANSPORT.Foot, true, true, true, HORSE_MODE.HitchedToWagon), TRANSPORT.Cart, 'the wagon with the player and the horse hitched reads Cart whatever the mode');
  assert.equal(resolveInteriorEntryMode(TRANSPORT.Foot, false, TRANSPORT.Foot, true, true, true, HORSE_MODE.WithPlayer), TRANSPORT.Foot);
  assert.equal(isCartInteriorDeployment(true, TRANSPORT.Cart), true); assert.equal(isCartInteriorDeployment(true, TRANSPORT.Horse), false);
  assert.equal(shouldDeployIndependentHorseForInterior(false, TRANSPORT.Horse, HORSE_MODE.WithPlayer, true), true);
  assert.equal(shouldDeployIndependentHorseForInterior(true, TRANSPORT.Cart, HORSE_MODE.HitchedToWagon, true), false);
  assert.equal(shouldDeployIndependentHorseForInterior(false, TRANSPORT.Foot, HORSE_MODE.WithPlayer, false), false);
  assert.equal(horseTravelsWithFastTravel(WAGON_MODE.None, HORSE_MODE.FollowingPlayer, true), true);
  assert.equal(horseTravelsWithFastTravel(WAGON_MODE.None, HORSE_MODE.FollowingPlayer, false), false);
  assert.equal(horseTravelsWithFastTravel(WAGON_MODE.None, HORSE_MODE.LooseStationary, true), false);
  let r = resolveFastTravelDepartureModes(WAGON_MODE.FollowingPlayer, HORSE_MODE.HitchedToWagon, false);
  assert.equal(r.wagonMode, WAGON_MODE.Deployed); assert.equal(r.horseMode, HORSE_MODE.HitchedToWagon);
  r = resolveFastTravelDepartureModes(WAGON_MODE.None, HORSE_MODE.FollowingPlayer, false);
  assert.equal(r.horseMode, HORSE_MODE.LooseStationary);
  r = resolveFastTravelDepartureModes(WAGON_MODE.None, HORSE_MODE.FollowingPlayer, true);
  assert.equal(r.horseMode, HORSE_MODE.FollowingPlayer, 'travelling with the player: unchanged');
  assert.equal(shouldReconcileAfterTravelOptions(true, false, true, WAGON_MODE.None, HORSE_MODE.FollowingPlayer), true);
  assert.equal(shouldReconcileAfterTravelOptions(false, false, true, WAGON_MODE.None, HORSE_MODE.FollowingPlayer), false);
  assert.equal(shouldReconcileAfterTravelOptions(true, false, false, WAGON_MODE.None, HORSE_MODE.FollowingPlayer), false);
  assert.equal(shouldReconcileAfterTravelOptions(true, false, true, WAGON_MODE.None, HORSE_MODE.LooseStationary), false);
});

test('HCC law: the clamps and the entrance distance', () => {
  assert.equal(clampHorseFollowDistance(1), 2); assert.equal(clampHorseFollowDistance(9), 8); assert.equal(clampHorseFollowDistance(4.5), 4.5); assert.equal(clampHorseFollowDistance('x'), 2);
  assert.equal(clampInteriorWagonAccessDistance(5), 10); assert.equal(clampInteriorWagonAccessDistance(500), 100); assert.equal(clampInteriorWagonAccessDistance(50), 50);
  assert.equal(isWithinInteriorEntranceDistance(50, 50), true); assert.equal(isWithinInteriorEntranceDistance(50.1, 50), false);
  assert.equal(isWithinInteriorEntranceDistance(NaN, 50), false); assert.equal(isWithinInteriorEntranceDistance(101, 500), false, 'the configured value is clamped first');
});

test('HCC law: the ground pick prefers the height nearest the origin, the shorter ray within a millimetre', () => {
  assert.equal(isPreferredGround(10, 0, 5, false, 0, 0), true);
  assert.equal(isPreferredGround(10, 9, 5, true, 0, 1), true);
  assert.equal(isPreferredGround(10, 0, 5, true, 9, 1), false);
  assert.equal(isPreferredGround(10, 9.0005, 3, true, 9, 5), true, 'a millimetre apart: the shorter ray wins');
  assert.equal(isPreferredGround(10, 9.0005, 6, true, 9, 5), false);
  const hits = [{ point: [0, -30, 0], distance: 40 }, { point: [0, 1, 0], distance: 9 }, { point: [0, 1.0004, 0], distance: 7 }, null];
  assert.equal(pickGround(hits, 0.9), hits[2], 'the nearest height, and within a millimetre the shorter ray');
  assert.equal(pickGround(hits, 0.9, (h) => h.distance === 7), hits[1], 'a rejected hit is skipped');
  assert.equal(pickGround([], 0), null);
});

test('HCC law: the horse billboard - eight orientations off the camera, five views and three mirrors, the walk clock', () => {
  const horse = [0, 0, 0], fwd = [0, 0, 1];
  assert.equal(calculateHorseOrientation([0, 0, 10], horse, fwd), 0, 'the camera ahead');
  assert.equal(calculateHorseOrientation([0, 0, -10], horse, fwd), 4, 'behind');
  const right = calculateHorseOrientation([10, 0, 0], horse, fwd), left = calculateHorseOrientation([-10, 0, 0], horse, fwd);
  assert.deepEqual([right, left].sort(), [2, 6], 'the two sides are 2 and 6');
  assert.equal(calculateHorseOrientation([0, 5, 0], horse, fwd), 0, 'over the horse: 0');
  assert.equal(calculateHorseOrientation([1, 0, 1], horse, [0, 0, 0]), 0, 'no forward: 0');
  assert.equal(calculateHorseOrientation([-10, 0, -1e-9], horse, fwd), left, 'a hair behind the side reads the side');
  for (let o = 0; o < 8; o++) {
    const v = horseViewFor(o);
    assert.ok(v && v.view >= 0 && v.view <= 4);
    if (o <= 4) assert.deepEqual(v, { view: o, flip: false }); else assert.deepEqual(v, { view: 8 - o, flip: true });
  }
  assert.equal(horseViewFor(8), null);
  assert.ok(Math.abs(walkFramesPerSecond(2.8) - 6) < 1e-9); assert.equal(walkFramesPerSecond(0.1), 4); assert.equal(walkFramesPerSecond(100), 9); assert.equal(walkFramesPerSecond(-1), 4);
  assert.equal(idleFrame(0), 5); assert.equal(idleFrame(0.5), 6); assert.equal(idleFrame(1.0), 5); assert.equal(idleFrame(-1), 5);
  let s = freshHorseWalk();
  s = stepHorseWalk(s, 0.05, 0.1, true); assert.equal(s.walking, false, 'below the 0.08 start');
  s = stepHorseWalk(s, 0.1, 0.1, true); assert.equal(s.walking, true); assert.equal(s.animationFrame, 0);
  s = stepHorseWalk(s, 2.8, 1 / 6 + 1e-6, true); assert.equal(s.animationFrame, 1, 'a sixth of a second at baseline: one frame');
  s = stepHorseWalk(s, 2.8, 8 / 6, true); assert.equal(s.animationFrame, 1, 'eight frames wrap to the same frame');
  s = stepHorseWalk(s, 0.05, 0.1, true); assert.equal(s.walking, true, 'still walking above the 0.03 stop');
  s = stepHorseWalk(s, 0.02, 0.1, true); assert.equal(s.walking, false); assert.equal(s.animationFrame, 5, 'idle frame A');
  s = stepHorseWalk(s, 0, 0.5, true); assert.equal(s.animationFrame, 6, 'idle frame B at 2 Hz');
  const still = stepHorseWalk(freshHorseWalk(), 3, 1, false);
  assert.equal(still.walking, true); assert.equal(still.animationFrame, 0, 'no walk frames: the frame never moves');
});

test('HCC law: the wheels turn by the longitudinal travel over the radius, wrapped; the cargo tiers', () => {
  assert.ok(Math.abs(signedLongitudinalTravel([0, 0, 2], [0, 0, 1], [0, 0, 1]) - 2) < 1e-9);
  assert.ok(Math.abs(signedLongitudinalTravel([0, 0, -2], [0, 0, 1], [0, 0, 1]) + 2) < 1e-9, 'backwards is negative');
  assert.ok(Math.abs(signedLongitudinalTravel([2, 0, 0], [0, 0, 1], [0, 0, 1])) < 1e-9, 'sideways is none');
  assert.ok(Math.abs(wheelRotationDegrees(Math.PI, 0.5) - 360) < 1e-9, 'a circumference is a turn');
  assert.equal(wheelRotationDegrees(1, 0), 0);
  assert.equal(wrapWheelAngle(370), 10); assert.equal(wrapWheelAngle(-10), -10); assert.equal(wrapWheelAngle(360), 0); assert.equal(wrapWheelAngle(190), -170, 'Mathf.Repeat(a + 180, 360) - 180');
  assert.equal(wheelRadiusOf([0, 1, 1], [0, 1, 1]), 0.5);
  assert.deepEqual([...CARGO_TIERS], [25, 50, 75, 90]);
  assert.equal(cargoTier(0, 750), 0); assert.equal(cargoTier(187.5, 750), 25); assert.equal(cargoTier(187.4, 750), 0);
  assert.equal(cargoTier(375, 750), 50); assert.equal(cargoTier(562.5, 750), 75); assert.equal(cargoTier(675, 750), 90); assert.equal(cargoTier(9999, 750), 90);
  assert.equal(cargoTier(100, 0), 0); assert.equal(cargoTier(NaN, 750), 0);
});

test('HCC law: the vector helpers', () => {
  assert.deepEqual(horizontalForward([0, 5, 0]), [0, 0, 1], 'a vertical forward reads +Z');
  const f = horizontalForward([3, 9, 4]); assert.ok(Math.abs(f[0] - 0.6) < 1e-9 && f[1] === 0 && Math.abs(f[2] - 0.8) < 1e-9);
  const r = horizontalRight([0, 0, 1]); assert.equal(r[0], 1); assert.equal(r[1], 0); assert.equal(Math.abs(r[2]), 0);
  const r2 = horizontalRight([1, 0, 0]); assert.equal(Math.abs(r2[0]), 0); assert.equal(r2[2], -1, '(f.z, 0, -f.x)');
  assert.deepEqual(normalizeHeading([0, 0, 0]), [0, 0, 1]); assert.deepEqual(normalizeHeading([NaN, 0, 1]), [0, 0, 1]);
  const h = normalizeHeading([3, 0, 4]); assert.ok(Math.abs(h[0] - 0.6) < 1e-9 && Math.abs(h[2] - 0.8) < 1e-9);
  assert.ok(Math.abs(angleBetween([1, 0, 0], [0, 0, 1]) - 90) < 1e-9); assert.equal(angleBetween([1, 0, 0], [0, 0, 0]), 0);
});
