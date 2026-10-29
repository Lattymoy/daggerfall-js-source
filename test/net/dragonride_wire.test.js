// DRAGON1 (bible/11-Multiplayer/Dwarven-Dragon.md section 10): the pose's `rd` 3 - a rider on the Dwarven Dragon - kept by
// the wire's pose law, and the one gate that says which relay keeps it. PR #1359 kept its own copy of the gate's number
// (world276) and a merge renumbered the relay past it: a relay that clamps 3 to the cart was told 3, and other players
// saw an Admin on a cart. The first test is that bug's pin: the gate and the law it gates agree at this wire's version.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPose, POSE_RIDE, RELAY_VERSION, DRAGON_RIDE_RELAY_MIN, relaySupportsDragonRide } from '../../src/net/wire.js';
import { noteDragonRelay, dragonPoseRide, mountDragon, _resetDragonRide, DRAGON_POSE_RIDE } from '../../src/systems/staffDragon.js';

const pose = (extra) => ({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1, ...extra });

test('DRAGON1 the gate opens on a relay of this wire, and that wire keeps rd 3 (mutants: the clamp left at the cart; the gate a version early)', () => {
  assert.equal(relaySupportsDragonRide(RELAY_VERSION), true, 'this build\'s relay keeps the dragon');
  assert.equal(validPose(pose({ rd: DRAGON_POSE_RIDE, rv: 0 }))?.rd, POSE_RIDE.Dragon, 'and its pose law says so');
  assert.equal(DRAGON_RIDE_RELAY_MIN, 284);   // PIN MOVED: world284, DRAGON - world281 then world283 on its branch, renumbered past the PvP rework's world281 to world283 at the merges of main
  assert.equal(relaySupportsDragonRide('world280'), false, 'ARMORY\'s relay clamps 3 to the cart');
  assert.equal(relaySupportsDragonRide('world282'), false, 'PVP-FOLLOWUP\'s relay clamps 3 to the cart too');
  assert.equal(relaySupportsDragonRide('world283'), false, 'and PVP-SAFE-HIT\'s');
  assert.equal(relaySupportsDragonRide(`world${DRAGON_RIDE_RELAY_MIN}`), true);
  assert.equal(relaySupportsDragonRide(null), false);
  assert.equal(relaySupportsDragonRide('world'), false);
});

test('DRAGON1 the pose keeps rd 3 and its look, and nothing past it (mutants: the clamp opened past the dragon)', () => {
  assert.equal(POSE_RIDE.Dragon, 3);
  assert.equal(validPose(pose({ rd: 9, rv: 0 }))?.rd, POSE_RIDE.Dragon);
  assert.equal(validPose(pose({ rd: 2, rv: 0 }))?.rd, POSE_RIDE.Cart);
  assert.equal(validPose(pose({ rd: 3, rv: 0, rc: 1 }))?.rc, 1, 'the Aetherbright\'s look rides the horse\'s field');
  assert.equal(validPose(pose({}))?.rd, undefined);
});

test('DRAGON1 the staff ride asks the wire\'s gate, and keeps no number of its own (mutants: a copy of the number back in staffDragon.js)', () => {
  _resetDragonRide();
  mountDragon(false);
  noteDragonRelay(`world${DRAGON_RIDE_RELAY_MIN - 1}`);
  assert.equal(dragonPoseRide(), null);
  noteDragonRelay(RELAY_VERSION);
  assert.equal(dragonPoseRide(), POSE_RIDE.Dragon);
  _resetDragonRide();
  const src = readFileSync(new URL('../../src/systems/staffDragon.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /world\(\\d\+\)|RELAY_MIN\s*=/, 'the gate is the wire\'s alone');
});

test('DRAGON1 other screens stand a dragon\'s rider as the Dwarven Dragon, wearing no body and making no hoof sound (mutants: the kind dropped; the hooves heard; the body kept)', () => {
  const rp = readFileSync(new URL('../../src/net/remotePlayers.js', import.meta.url), 'utf8');
  assert.match(rp, /: peer\.shown\.rd === POSE_RIDE\.Dragon && ENEMY_BASICS\[DWARVEN_DRAGON_ID\] \? DWARVEN_DRAGON_ID : spritesOn/);
  assert.match(rp, /const rd = peer\.shown\?\.rd === POSE_RIDE\.Dragon \? 0 : /);
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const afoot = seen\.filter\(\(d\) => d\.shown\?\.rd !== POSE_RIDE\.Dragon && /);
});
