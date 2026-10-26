// STALE-PARK: the trailing wagon's cached pose (systems/horse/trailingPoseCache.js) over a fake host - what a dismount
// parks from, and the far-park warning. The runtime's wiring (when the pose is cached and forgotten) is
// hcc_stale_park.test.js's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrailingPoseCache } from '../../../src/systems/horse/trailingPoseCache.js';
import { TELEPORT_DISTANCE } from '../../../src/systems/horse/horseCartLaw.js';

const RATIO = 40;   // natives a metre, StreamingWorld.SceneMapRatio

/** A cache over a player standing at the natives' origin, on a clock the pin moves. */
function makeCache() {
  const h = { t: 0, said: [] };
  h.cache = createTrailingPoseCache({ now: () => h.t, log: { warn: (line) => h.said.push(line) }, playerWorld: () => [0, 0], ratio: () => RATIO });
  return h;
}
/** A park `metres` behind the player, as the runtime's fallback lays it. */
const behind = (metres) => () => ({ wx: 0, wz: -metres * RATIO, heading: [0, 0, 1] });

test('STALE-PARK cache: nothing cached parks behind the player; a cached pose is parked at; a forgotten one is not', () => {
  const { cache } = makeCache();
  assert.deepEqual(cache.captureBestAvailableDeploymentPose(behind(2.5)), { wx: 0, wz: -100, heading: [0, 0, 1] });
  cache.store([40, -124], [1, 0, 0]);
  const p = cache.captureBestAvailableDeploymentPose(behind(2.5));
  assert.deepEqual(p, { wx: 40, wz: -124, heading: [1, 0, 0] });
  p.heading[0] = 9;   // a park's heading is its own copy
  assert.deepEqual(cache.captureBestAvailableDeploymentPose(behind(2.5)).heading, [1, 0, 0]);
  cache.forget();
  assert.deepEqual(cache.captureBestAvailableDeploymentPose(behind(2.5)), { wx: 0, wz: -100, heading: [0, 0, 1] });
});

test('STALE-PARK cache: a dismount past the jump distance is said with its distance and the cached pose\'s age; one inside it is not', () => {
  const h = makeCache();
  h.t = 10;
  h.cache.store([0, TELEPORT_DISTANCE * RATIO], [0, 0, 1]);   // exactly the jump distance: no word
  h.t = 12;
  assert.deepEqual(h.cache.dismountPose(behind(2.5)), { wx: 0, wz: TELEPORT_DISTANCE * RATIO, heading: [0, 0, 1] });
  assert.deepEqual(h.said, []);
  h.cache.store([0, 303.1 * RATIO], [0, 0, 1]);
  h.t = 14;
  h.cache.dismountPose(behind(2.5));
  assert.deepEqual(h.said, ['[TrailingWagon] A dismount parked the wagon 303.1 m from the player, at the trailing pose cached 2.0 s earlier.']);
});

test('STALE-PARK cache: a far park laid behind the player says so', () => {
  const h = makeCache();
  h.cache.dismountPose(behind(25));
  assert.deepEqual(h.said, ['[TrailingWagon] A dismount parked the wagon 25.0 m from the player, behind the player.']);
});
