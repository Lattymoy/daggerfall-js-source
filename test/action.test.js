import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionSystem, DOOR_OPEN_ANGLE, DOOR_OPEN_DURATION } from '../src/world/actionSystem.js';
import {
  RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE, DOOR_ACTIVATION_DISTANCE,
  worldAabb, rayAabb, pickActivatable,
} from '../src/player/activate.js';

const approx = (a, b, eps = 1e-4) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

// Collider stub tracking bucket lifecycle.
function stubCollider() {
  const buckets = new Set();
  return {
    buckets,
    addMesh: (key) => buckets.add(key),
    removeBucket: (key) => buckets.delete(key),
    raycast: () => Infinity,
  };
}

test('action: verbatim constants and door lifecycle', () => {
  approx(RAY_DISTANCE, 3072 * 0.025);
  approx(DEFAULT_ACTIVATION_DISTANCE, 128 * 0.025);
  approx(DOOR_ACTIVATION_DISTANCE, 128 * 0.025);
  approx(DOOR_OPEN_ANGLE, -90);
  approx(DOOR_OPEN_DURATION, 1.5);

  const c = stubCollider();
  const a = new ActionSystem(c);
  const door = a.addDoor(CUBE, I);
  assert.ok(c.buckets.has(door.key), 'closed door is solid');

  // Open: trigger (bucket gone) the moment opening starts.
  a.activate(door.key);
  assert.equal(door.state, 'forward');
  assert.equal(c.buckets.has(door.key), false);
  // No-op while moving (ToggleDoor).
  a.activate(door.key);
  assert.equal(door.state, 'forward');

  // 1.5 s later: open; matrix rotated -90 about Y (x axis maps to -z).
  for (let i = 0; i < 100; i++) a.update(1.5 / 90);
  assert.equal(door.state, 'end');
  approx(door.matrix[0], Math.cos((-90 * Math.PI) / 180), 1e-3);
  assert.equal(c.buckets.has(door.key), false, 'open door stays passable');

  // Close: solid ONLY at close-complete.
  a.activate(door.key);
  assert.equal(door.state, 'reverse');
  a.update(0.2);
  assert.equal(c.buckets.has(door.key), false, 'mid-close still passable');
  for (let i = 0; i < 100; i++) a.update(1.5 / 90);
  assert.equal(door.state, 'start');
  assert.equal(c.buckets.has(door.key), true, 'closed again = solid');
});

test('action: move tween, reverse cycle, and chain cascade', () => {
  const c = stubCollider();
  const a = new ActionSystem(c);
  // Lever (rotation, duration 20 ticks = 1 s) linked to a platform
  // (translation +y 2, duration 40 ticks = 2 s).
  const platform = a.addAction(7, CUBE, I, {
    duration: 40, rotation: { x: 0, y: 0, z: 0 },
    translation: { x: 0, y: 2, z: 0 }, nextObject: -1, triggerFlag: 0x02,
  });
  const lever = a.addAction(3, CUBE, I, {
    duration: 20, rotation: { x: -40, y: 0, z: 0 },
    translation: { x: 0, y: 0, z: 0 }, nextObject: 7, triggerFlag: 0x02,
  });

  // Activating the lever cascades to the platform FIRST, then plays.
  a.activate(lever.key);
  assert.equal(lever.state, 'forward');
  assert.equal(platform.state, 'forward');

  // Midpoint: platform at +1 (linear).
  a.update(1);
  approx(platform.matrix[13], 1, 1e-6);
  assert.equal(lever.state, 'end'); // 1 s duration done

  // Receive is gated while the CHAIN is playing: re-activating the lever
  // does nothing until the platform finishes.
  a.activate(lever.key);
  assert.equal(lever.state, 'end');
  a.update(1.01);
  assert.equal(platform.state, 'end');
  approx(platform.matrix[13], 2, 1e-6);

  // Now the cycle reverses back to start.
  a.activate(lever.key);
  assert.equal(lever.state, 'reverse');
  assert.equal(platform.state, 'reverse');
  a.update(3);
  assert.equal(platform.state, 'start');
  approx(platform.matrix[13], 0, 1e-6);
});

test('action: activation picking - reach, nearest, occlusion', () => {
  const aabb = worldAabb(CUBE.positions, I);
  assert.deepEqual(aabb.min, [0, 0, 0]);
  assert.deepEqual(aabb.max, [1, 1, 1]);
  approx(rayAabb([0.5, 0.5, -2], [0, 0, 1], aabb), 2);
  assert.equal(rayAabb([0.5, 0.5, -2], [0, 0, -1], aabb), null);

  const targets = [
    { key: 'near', aabb: { min: [0, 0, 2], max: [1, 1, 3] } },
    { key: 'far', aabb: { min: [0, 0, 4], max: [1, 1, 5] } },
  ];
  const clear = { raycast: () => Infinity };
  assert.equal(pickActivatable([0.5, 0.5, 0], [0, 0, 1], targets, clear), 'near');
  // Out of reach (3.2): a target at 6 is visible but too far.
  assert.equal(pickActivatable([0.5, 0.5, 0], [0, 0, 1],
    [{ key: 'x', aabb: { min: [0, 0, 6], max: [1, 1, 7] } }], clear), null);
  // Occlusion: a wall hit strictly in front rejects the pick.
  const blocked = { raycast: () => 1.0 };
  assert.equal(pickActivatable([0.5, 0.5, 0], [0, 0, 1], targets, blocked), null);
});
