import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  walkSpeed, runSpeed, crouchSpeed, sneakSpeed,
  CLASSIC_TO_UNITY_RATIO, DF_WALK_BASE, DF_CROUCH_BASE,
  JUMP_SPEED, GRAVITY, CAPSULE_HEIGHT, CAPSULE_RADIUS, STEP_OFFSET,
  SLOPE_LIMIT_DEG, PlayerMotor,
} from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const approx = (a, b, eps = 1e-4) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('player: verbatim speed formulas and constants', () => {
  approx(CLASSIC_TO_UNITY_RATIO, 39.5);
  approx(DF_WALK_BASE, 150);
  approx(DF_CROUCH_BASE, 50);
  approx(JUMP_SPEED, 4.5);
  approx(GRAVITY, 20);
  approx(CAPSULE_HEIGHT, 1.8);
  approx(CAPSULE_RADIUS, 0.35);
  approx(STEP_OFFSET, 0.5);
  assert.equal(SLOPE_LIMIT_DEG, 70);

  // Walk = (SPD + 150) / 39.5; SPD 50 -> 5.0633.
  approx(walkSpeed(50), 200 / 39.5);
  // Run = walk * (1.35 + Running/200); Running 30 -> x1.5.
  approx(runSpeed(50, 30), (200 / 39.5) * 1.5);
  approx(runSpeed(50, 100), (200 / 39.5) * 1.85);
  approx(crouchSpeed(50), 100 / 39.5);
  approx(sneakSpeed(walkSpeed(50)), (200 / 39.5) / 2 - 1 / 39.5);
});

test('player: collider grounds, slides, and steps', () => {
  const c = new Collider(() => -100);
  // Floor quad at y = 0 spanning [-10, 10]^2.
  const floorPos = new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]);
  const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  c.addMesh('floor', floorPos, quadIdx, I);
  // Wall at x = 2 (facing -x), y 0..3, z -10..10.
  const wallPos = new Float32Array([2, 0, -10, 2, 0, 10, 2, 3, 10, 2, 3, -10]);
  c.addMesh('wall', wallPos, new Uint32Array([0, 2, 1, 0, 3, 2]), I);
  // Step: a 0.4-high closed ledge from x 4..8 (top + front riser -
  // real RMB geometry is closed; a floating plate's underside is not a
  // walkable case).
  const stepTop = new Float32Array([4, 0.4, -2, 8, 0.4, -2, 8, 0.4, 2, 4, 0.4, 2]);
  c.addMesh('step', stepTop, quadIdx, I);
  const stepRiser = new Float32Array([4, 0, -2, 4, 0, 2, 4, 0.4, 2, 4, 0.4, -2]);
  c.addMesh('step', stepRiser, new Uint32Array([0, 2, 1, 0, 3, 2]), I);

  // Falls onto the floor and grounds.
  const feet = new Float32Array([0, 1.2, 0]);
  let r = { grounded: false };
  for (let i = 0; i < 30; i++) r = c.move(feet, 0, -0.1, 0);
  assert.equal(r.grounded, true);
  approx(feet[1], 0, 0.05);

  // Sliding along the wall: push diagonally into it; z advances, x stops.
  feet.set([1.2, 0, 0]);
  const z0 = feet[2];
  for (let i = 0; i < 10; i++) c.move(feet, 0.2, 0, 0.2);
  assert.ok(feet[0] < 2 - CAPSULE_RADIUS + 0.05, `x pushed out: ${feet[0]}`);
  assert.ok(feet[2] > z0 + 1.5, `slid along z: ${feet[2]}`);

  // Step-up: walking into the 0.4 ledge climbs it (stepOffset 0.5).
  feet.set([3.2, 0, 0]);
  let onStep = { grounded: false };
  for (let i = 0; i < 30; i++) onStep = c.move(feet, 0.12, -0.05, 0);
  assert.ok(feet[0] > 4.2, `crossed the ledge: ${feet[0]}`);
  approx(feet[1], 0.4, 0.08);
  assert.equal(onStep.grounded, true);
});

test('player: motor integrates gravity, jump, and heightAt floor', () => {
  const c = new Collider((x, z) => 2); // flat terrain at y = 2
  const m = new PlayerMotor(c);
  m.spawn(0, 6, 0);
  const dt = 1 / 60;
  for (let i = 0; i < 200; i++) m.update(dt, { forward: 0, strafe: 0, run: false, jump: false }, 0);
  assert.equal(m.grounded, true);
  approx(m.pos[1], 2, 0.05);
  approx(m.eye[1], 2 + 1.7, 0.05);

  // Jump apex ~ v^2 / 2g = 0.506 above ground.
  let peak = 2;
  m.update(dt, { forward: 0, strafe: 0, run: false, jump: true }, 0);
  for (let i = 0; i < 120; i++) {
    m.update(dt, { forward: 0, strafe: 0, run: false, jump: false }, 0);
    peak = Math.max(peak, m.pos[1]);
  }
  approx(peak - 2, (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY), 0.06);
  assert.equal(m.grounded, true);

  // Walking forward at yaw 0 moves +z at walk speed.
  const z0 = m.pos[2];
  for (let i = 0; i < 60; i++) m.update(dt, { forward: 1, strafe: 0, run: false, jump: false }, 0);
  approx(m.pos[2] - z0, walkSpeed(50), 0.05);
});
