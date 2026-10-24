// QUEST-BACKFACE (2026-10-14, Dudey's dev with a spawn debugger: "there isnt even a spawn point ... its just droping the
// spawn location in general instead of find a spot"): placeFoeFreely's env passes through a back-face hit, as Unity's
// raycast does - a floor probe in the rock above a hall never stands a foe on the top of its ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../../src/player/collider.js';
import { placeFoeEnv } from '../../../src/scenes/quest/questFoeHost.js';
import { placeFoeFreely } from '../../../src/systems/quest/sceneMount.js';

const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A hall 10 x 10, floor at y=0 (faces up), ceiling at y=4 (faces DOWN, into the hall) - inside-out, as a dungeon is. */
function hall() {
  const c = new Collider(() => -Infinity);
  const quad = (y, up) => {
    const p = [-5, y, -5, 5, y, -5, 5, y, 5, -5, y, 5];
    return { p: new Float32Array(p), i: new Uint32Array(up ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) };
  };
  const f = quad(0, true), ce = quad(4, false);
  c.addMesh('dungeon', f.p, f.i, I4);
  c.addMesh('dungeon', ce.p, ce.i, I4);
  return c;
}
const env = (c, feet) => placeFoeEnv({ collider: c, playerFeet: feet, playerYawRad: 0, fovDegrees: 60 });

test('QUEST-BACKFACE the floor probe inside the hall lands on its floor', () => {
  const c = hall();
  const h = env(c, [0, 1, 0]).raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, 4);
  assert.ok(h && Math.abs(h.point.y) < 1e-4, 'the floor, a front face');
});

test('QUEST-BACKFACE a probe from the rock above the ceiling passes its back and finds the floor below - never the ceiling top (mutant: back hits kept)', () => {
  const c = hall();
  assert.equal(c.raycastHit([0, 6, 0], [0, -1, 0], 4).back, true, 'the collider sees the ceiling top as a back face');
  assert.equal(env(c, [0, 6, 0]).raycast({ x: 0, y: 6, z: 0 }, { x: 0, y: -1, z: 0 }, 4), null, 'within reach: nothing to stand on');
  const far = env(c, [0, 6, 0]).raycast({ x: 0, y: 6, z: 0 }, { x: 0, y: -1, z: 0 }, 10);
  assert.ok(far && Math.abs(far.point.y) < 1e-4, 'with the reach, the hall\'s own floor');
});

test('QUEST-BACKFACE only the dungeon\'s own geometry: another bucket\'s back face answers as it always did', () => {
  const c = new Collider(() => -Infinity);
  c.addMesh('m0', new Float32Array([-5, 4, -5, 5, 4, -5, 5, 4, 5, -5, 4, 5]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);
  const h = env(c, [0, 6, 0]).raycast({ x: 0, y: 6, z: 0 }, { x: 0, y: -1, z: 0 }, 4);
  assert.ok(h && Math.abs(h.point.y - 4) < 1e-4);
});

test('QUEST-BACKFACE placeFoeFreely from the rock over a hall stands nothing on its ceiling', () => {
  const c = hall();
  for (let i = 0; i < 50; i++) {
    const spot = placeFoeFreely({ ...env(c, [0, 4.5, 0]), rolls: Math.random }, { minDistance: 1, maxDistance: 3, lineOfSightCheck: false });
    if (spot) assert.ok(spot.y < 4, `never on the ceiling top (y ${spot.y})`);
  }
});
