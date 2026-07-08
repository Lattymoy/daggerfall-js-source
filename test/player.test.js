import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  walkSpeed, runSpeed, crouchSpeed, sneakSpeed,
  CLASSIC_TO_UNITY_RATIO, DF_WALK_BASE, DF_CROUCH_BASE,
  JUMP_SPEED, GRAVITY, CAPSULE_HEIGHT, CAPSULE_RADIUS, STEP_OFFSET,
  SLOPE_LIMIT_DEG, PlayerMotor,
} from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { floorLanding } from '../src/player/enterExit.js';

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

test('player: strafe basis is the true camera-right (D = screen-right)', () => {
  // lookAt (mat4.js): back z = eye - center, right x = up x z. With
  // fwd = (sin yaw, 0, cos yaw), camera-right = (-cos yaw, 0, sin yaw).
  // strafe +1 (D) must move ALONG that vector - the old (+cos, -sin)
  // basis moved screen-left and A/D felt swapped in play.
  const m = new PlayerMotor(new Collider(() => 0));
  for (const yaw of [0, 0.7, Math.PI / 2, 2.4]) {
    m.spawn(0, 0, 0);
    for (let i = 0; i < 30; i++) m.update(1 / 60, { forward: 0, strafe: 1, run: false, jump: false }, yaw);
    const right = [-Math.cos(yaw), 0, Math.sin(yaw)];
    const l = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(l > 0.5, `moved: ${l}`);
    const dot = (m.pos[0] * right[0] + m.pos[2] * right[2]) / l;
    approx(dot, 1, 1e-4); // fully along camera-right
  }
});

test('player: walls cannot be laddered by the step-up retry', () => {
  // Repro of the wall-climb/ceiling-escape bug: pressing into a flat
  // wall (with and without jump spam) accepted jitter-gained step-up
  // retries every frame and climbed any facade, popping through
  // ceilings into building shells. The raised path must be genuinely
  // clear; a wall blocks it at +stepOffset exactly as at 0.
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const c = new Collider(() => -100);
  const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
  c.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), quadIdx, I);
  c.addMesh('ceil', new Float32Array([-10, 2.2, -10, -10, 2.2, 10, 10, 2.2, 10, 10, 2.2, -10]), quadIdx, I);
  c.addMesh('wall', new Float32Array([2, 0, -10, 2, 0, 10, 2, 3, 10, 2, 3, -10]), new Uint32Array([0, 2, 1, 0, 3, 2]), I);
  const m = new PlayerMotor(c);
  m.spawn(0, 0, 0);
  let maxY = 0;
  for (let i = 0; i < 900; i++) {
    m.update(1 / 60, { forward: 1, strafe: 0, run: true, jump: (i % 45) === 0 }, Math.PI / 2);
    maxY = Math.max(maxY, m.pos[1]);
    assert.ok(m.pos[0] <= 2, `through the wall: ${m.pos[0]}`);
    assert.ok(m.pos[1] <= 2.2 - 1.8 + STEP_OFFSET + 0.01, `laddered: ${m.pos[1]}`);
  }
  assert.ok(maxY <= STEP_OFFSET + 0.01, `climbed the wall: ${maxY}`);
});


test('motor: standing still on a flat floor stays grounded every frame (regression: g:0 knife-edge)', () => {
  // Mac's F8 caught grounded:0 while standing perfectly still - feet
  // placed dead on the floor by floorLanding put the lower sphere at
  // exactly floor+radius, right on the old `d2 >= radius*radius`
  // reject boundary, so ground flickered off frame-to-frame. The
  // SKIN-widened contact detection must hold it grounded without
  // sinking the body.
  const c = new Collider(() => -100);
  const FY = 38.40;
  c.addMesh('f', new Float32Array([-50, FY, -50, 50, FY, -50, 50, FY, 50, -50, FY, 50]),
    new Uint16Array([0, 1, 2, 0, 2, 3]), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const landed = floorLanding(c, [0, 38.98 + 1.08, 0]);
  const m = new PlayerMotor(c);
  m.spawn(landed[0], landed[1], landed[2]);
  for (let i = 0; i < 120; i++) {
    m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false }, 0);
    assert.ok(m.grounded, `lost grounding at rest, frame ${i}`);
    assert.ok(Math.abs(m.pos[1] - FY) < 1e-3, `sank through the floor: ${m.pos[1]}`);
  }
});

test('floorLanding: samples the footprint so a marker over a seam still lands (regression: freefall-into-wedge)', () => {
  // Mac spawned stuck in a hole: feet 26.10/38.40 vs marker 28.38/38.98,
  // g:0. Root - floorLanding cast ONE ray from the marker's exact x,z;
  // over a floor seam/grate/tile-edge it MISSED, returned the raw
  // airborne position, and the player free-fell and wedged on a lower
  // ledge off-marker. The footprint ring must find the floor the feet
  // rest on even when the center point is over a gap.
  const c = new Collider(() => -Infinity);
  const add = (v) => c.addMesh('w', new Float32Array(v), new Uint16Array([0, 1, 2, 0, 2, 3]), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  // floor with a narrow gap directly under x=28.38
  add([20, 38.40, 8, 28.30, 38.40, 8, 28.30, 38.40, 18, 20, 38.40, 18]);
  add([28.46, 38.40, 8, 34, 38.40, 8, 34, 38.40, 18, 28.46, 38.40, 18]);
  const landed = floorLanding(c, [28.38, 38.98 + 1.08, 12.40]);
  assert.ok(Math.abs(landed[1] - 38.40) < 1e-3, `should land on the floor via footprint, got ${landed[1]}`);
  // and a genuine void still returns raw for gravity to handle
  const c2 = new Collider(() => -Infinity);
  const raw = floorLanding(c2, [0, 5, 0]);
  assert.equal(raw[1], 5);
});
