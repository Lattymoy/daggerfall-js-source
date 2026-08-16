import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionSystem, DOOR_OPEN_ANGLE, DOOR_OPEN_DURATION,
  ACTION_LOCK_VALUE, MAGIC_LOCK_THRESHOLD, interiorLockpickingChance, lookAtLockText,
} from '../src/world/actionSystem.js';
import { ACTION_FLAGS } from '../src/world/rdbLayout.js';
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
  const platform = a.addAction(0, 7, CUBE, I, {
    duration: 40, rotation: { x: 0, y: 0, z: 0 },
    translation: { x: 0, y: 2, z: 0 }, nextObject: -1, triggerFlag: 0x02,
  });
  const lever = a.addAction(0, 3, CUBE, I, {
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

test('action: P10 locks - refusal text, lock/unlock/open/close delegates, magic hold', () => {
  // The verbatim lock model: > 0 locked, >= 20 magically held; the
  // LockDoor action value is 16; chance = clamp(5*(level-lock)+skill,
  // 5, 95) drives the LookAtInteriorLock text tiers.
  assert.equal(ACTION_LOCK_VALUE, 16);
  assert.equal(MAGIC_LOCK_THRESHOLD, 20);
  assert.equal(interiorLockpickingChance(1, 16, 5), 5);       // floor clamp
  assert.equal(interiorLockpickingChance(30, 0, 95), 95);     // ceiling clamp
  assert.equal(lookAtLockText(20, 10, 50), 'This is a magically held lock...');
  assert.equal(lookAtLockText(16, 1, 5), 'This lock has nothing to fear from you...');      // chance 5 < 30
  assert.equal(lookAtLockText(10, 10, 32), "It'd be a miracle if you picked this lock...");  // chance 32
  assert.equal(lookAtLockText(10, 10, 40), 'This lock looks to be beyond your skills...');   // chance 40
  assert.equal(lookAtLockText(10, 10, 45), 'You doubt your ability to open this lock...');   // chance 45 -> [0]
  assert.equal(lookAtLockText(0, 10, 60), 'This lock is an insult to your abilities...');    // chance 95 -> [9]

  const c = stubCollider();
  const a = new ActionSystem(c);
  let refused = 0;
  a.onLockedDoor = () => refused++;
  // A locked door refuses the player and stays solid.
  const door = a.addDoor(CUBE, I, { ns: 0, position: 40, lock: 12 });
  a.activate(door.key);
  assert.equal(door.state, 'start');
  assert.equal(refused, 1);
  assert.ok(c.buckets.has(door.key));
  // An UnlockDoor action ON the door (lever chain) clears the lock.
  const door2 = a.addDoor(CUBE, I, { ns: 0, position: 41, lock: 12, action: { actionFlag: ACTION_FLAGS.UnlockDoor, nextObject: -1 } });
  const lever = a.addEffect(0, 50, { actionFlag: ACTION_FLAGS.Activate, nextObject: 41, magnitude: 0, index: 0, axisRaw: 0, isFlat: false });
  a.receive(lever);
  assert.equal(door2.lock, 0);
  a.activate(door2.key);
  assert.equal(door2.state, 'forward');   // unlocked: opens
  // LockDoor sets 16 only when unlocked (DFU: if (!door.IsLocked)).
  const door3 = a.addDoor(CUBE, I, { ns: 0, position: 42, lock: 0, action: { actionFlag: ACTION_FLAGS.LockDoor, nextObject: -1 } });
  const lever3 = a.addEffect(0, 51, { actionFlag: ACTION_FLAGS.Activate, nextObject: 42, magnitude: 0, index: 0, axisRaw: 0, isFlat: false });
  a.receive(lever3);
  assert.equal(door3.lock, 16);
  door3.lock = 12;
  a.receive(lever3);
  assert.equal(door3.lock, 12);           // already locked: unchanged
  // OpenDoor unlocks + opens; CloseDoor closes + RESTORES the
  // starting lock.
  const door4 = a.addDoor(CUBE, I, { ns: 0, position: 43, lock: 12, action: { actionFlag: ACTION_FLAGS.OpenDoor, nextObject: -1 } });
  const lever4 = a.addEffect(0, 52, { actionFlag: ACTION_FLAGS.Activate, nextObject: 43, magnitude: 0, index: 0, axisRaw: 0, isFlat: false });
  a.receive(lever4);
  assert.equal(door4.state, 'forward');
  assert.equal(door4.lock, 0);
  for (let i = 0; i < 100; i++) a.update(1.5 / 90);
  assert.equal(door4.state, 'end');
  const door5 = a.addDoor(CUBE, I, { ns: 0, position: 44, lock: 8, action: { actionFlag: ACTION_FLAGS.CloseDoor, nextObject: -1 } });
  door5.lock = 0; door5.state = 'end'; door5.t = 1;   // an opened door (lock cleared by Open)
  const lever5 = a.addEffect(0, 53, { actionFlag: ACTION_FLAGS.Activate, nextObject: 44, magnitude: 0, index: 0, axisRaw: 0, isFlat: false });
  a.receive(lever5);
  assert.equal(door5.state, 'reverse');
  assert.equal(door5.lock, 8);            // StartingLockValue restored
});

test('action: P10 teleport + the block-instance key namespace', () => {
  const c = stubCollider();
  const a = new ActionSystem(c);
  const dests = new Map([['0:99', { pos: [10, 2, 30], yawDeg: 45 }]]);
  a.resolvePosition = (ns, key) => dests.get(`${ns}:${key}`) ?? null;
  const warps = [];
  a.onTeleport = (d) => warps.push(d);
  // Teleport fires to the resolved NEXT object's transform; the
  // destination is an actionless marker, so the chain cascade no-ops.
  const tele = a.addEffect(0, 60, { actionFlag: ACTION_FLAGS.Teleport, nextObject: 99, magnitude: 0, index: 0, axisRaw: 0, isFlat: false });
  a.receive(tele, 'ActionObject');
  assert.deepEqual(warps, [{ pos: [10, 2, 30], yawDeg: 45 }]);
  // A null destination logs and does NOT warp (DFU "next object null").
  const tele2 = a.addEffect(0, 61, { actionFlag: ACTION_FLAGS.Teleport, nextObject: 500, magnitude: 0, index: 0, axisRaw: 0, isFlat: false });
  a.receive(tele2);
  assert.equal(warps.length, 1);
  // The ns keyspace: two block INSTANCES reuse the same RDB position -
  // both objects register and chains stay inside their own block
  // (3108 of 4232 dungeons repeat blocks; un-namespaced keys made the
  // copies overwrite each other).
  const b0 = a.addAction(0, 7, CUBE, I, { duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: -1, triggerFlag: 0x02 });
  const b1 = a.addAction(1, 7, CUBE, I, { duration: 20, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 1, z: 0 }, nextObject: -1, triggerFlag: 0x02 });
  assert.notEqual(b0.key, b1.key);
  assert.equal(a.objects.get(b0.key), b0);
  assert.equal(a.objects.get(b1.key), b1);
  a.activate(b0.key);
  assert.equal(b0.state, 'forward');
  assert.equal(b1.state, 'start');       // the sibling instance is untouched
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
