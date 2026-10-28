// DRAGON-RIDE (bible/11-Multiplayer/Staff-Events.md section 12): the pose's `rd` 3 - an Admin riding the Dwarven Dragon -
// kept by the wire's pose law from world276, and the relay that keeps it named.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validPose, POSE_RIDE, POSE_RIDE_DRAGON_KIND, DRAGON_RIDE_RELAY_MIN, relaySupportsDragonRide } from '../../src/net/wire.js';

const pose = (extra) => ({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1, ...extra });

test('DRAGON-RIDE the pose keeps rd 3, and nothing past it (mutants: the clamp left at the cart; the clamp opened past the dragon)', () => {
  assert.equal(POSE_RIDE.Dragon, 3);
  assert.equal(validPose(pose({ rd: 3, rv: 0 }))?.rd, POSE_RIDE.Dragon);
  assert.equal(validPose(pose({ rd: 9, rv: 0 }))?.rd, POSE_RIDE.Dragon);
  assert.equal(validPose(pose({ rd: 2, rv: 0 }))?.rd, POSE_RIDE.Cart);
  assert.equal(validPose(pose({}))?.rd, undefined);
});

test('DRAGON-RIDE the rider is drawn as the Dwarven Dragon, and only a relay from world276 is sent rd 3 (mutants: the gate a version early; the kind not the dragon\'s)', () => {
  assert.equal(POSE_RIDE_DRAGON_KIND, 512);
  assert.equal(DRAGON_RIDE_RELAY_MIN, 276);
  assert.equal(relaySupportsDragonRide('world276'), true);
  assert.equal(relaySupportsDragonRide('world275'), false);
  assert.equal(relaySupportsDragonRide(null), false);
});
