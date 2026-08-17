// C13: the host arrow flight (exterior/interior hosts - visible
// arrows without the dungeon missile system).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrowFlight, arrowMatrix, ARROW_MODEL_ID } from '../src/combat/arrowFlight.js';
import { MISSILE_SPEED, MISSILE_LIFESPAN_S, MISSILE_COLLIDER_RADIUS } from '../src/systems/spellcast.js';
import { Collider } from '../src/player/collider.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);

test('arrowflight: S5 constants ride the single source + the matrix law', () => {
  // The flight is the dungeon missile's shape: same speed, lifespan,
  // sweep radius (spellcast.js), same 99800 model, same oriented trs.
  assert.equal(ARROW_MODEL_ID, 99800);
  assert.equal(MISSILE_SPEED, 25.0);
  assert.equal(MISSILE_LIFESPAN_S, 8);
  assert.equal(MISSILE_COLLIDER_RADIUS, 0.45);
  // Level flight along +z: no pitch, identity-ish yaw
  const m = arrowMatrix([1, 2, 3], [0, 0, 1]);
  assert.equal(m[12], 1); assert.equal(m[13], 2); assert.equal(m[14], 3);
  // Straight down: pitch +90 (asin(-(-1))) - r12 = -sin(rx) = -1 in
  // the column-major trs (m[9]); the dungeon path shares this law.
  const down = arrowMatrix([0, 0, 0], [0, -1, 0]);
  assert.ok(Math.abs(down[9] + 1) < 1e-5, 'nose-down transform');
});

test('arrowflight: flies at missile speed, dies on geometry (a miss is LOST)', () => {
  const c = new Collider(() => -100);
  // A wall at z=5 facing the archer
  c.addMesh('wall', new Float32Array([-5, -5, 5, 5, -5, 5, 5, 5, 5, -5, 5, 5]), quadIdx, I);
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: c });
  a.fire([0, 0, 0], [0, 0, 1]);
  a.update(0.1);   // 2.5 units: still flying
  assert.equal(a.arrows[0].dead, false);
  assert.ok(Math.abs(a.arrows[0].pos[2] - 2.5) < 1e-6);
  a.update(0.1);   // the sweep reaches the wall inside this step
  assert.equal(a.arrows[0].dead, true);
  // Open air: retires on the 8s lifespan instead
  const open = new ArrowFlight({ getGpuMesh: () => null, collider: new Collider(() => -100) });
  open.fire([0, 50, 0], [0, 0, 1]);
  for (let i = 0; i < 79; i++) open.update(0.1);
  assert.equal(open.arrows[0].dead, false);
  open.update(0.2);
  assert.equal(open.arrows[0].dead, true);
});

test('arrowflight: bare terrain lands it (heightAt floor) + late collider resolve', () => {
  // heightAt = the streaming-world terrain fallback the mesh raycast
  // never sees; an arrow arcing under it has landed.
  const c = new Collider((x) => (x > 10 ? 5 : 0));
  const a = new ArrowFlight({ getGpuMesh: () => null, collider: () => c });   // function form (rebuilding hosts)
  a.fire([0, 1, 0], [Math.SQRT1_2, -0.1, Math.SQRT1_2]);   // shallow dive: -0.042/step, ~24 steps to ground
  for (let i = 0; i < 40 && !a.arrows[0].dead; i++) a.update(1 / 60);
  assert.equal(a.arrows[0].dead, true, 'landed in the ground');
  assert.ok(a.arrows[0].pos[1] <= 0.01);
  // All-dead sweep clears the list
  a.update(1 / 60);
  assert.equal(a.arrows.length, 0);
});
