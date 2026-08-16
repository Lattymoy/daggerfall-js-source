import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activationTargets, DOOR_ACTIVATION_DISTANCE } from '../src/player/activate.js';

test('activationTargets: effect objects (no cpu) ride their aabb; relays are chain-only', () => {
  // Crash regression (audit 2026-08-16): the scenes called
  // worldAabb(o.cpu.positions, o.matrix) on EVERY action object; effect
  // objects carry aabb only - pressing use in any dungeon with a
  // registered trap threw TypeError.
  const objects = new Map([
    ['door:0', { key: 'door:0', cpu: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1] }],
    ['act:10', { key: 'act:10', aabb: { min: [1, 1, 1], max: [2, 2, 2] } }],   // effect: precomputed aabb, no cpu
    ['act:11', { key: 'act:11' }],                                             // relay: chain-only, no target
  ]);
  const targets = activationTargets(objects);
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((t) => t.key).sort(), ['act:10', 'door:0']);
  const door = targets.find((t) => t.key === 'door:0');
  assert.equal(door.aabb.min[0], 5);   // cpu path transformed through the matrix
  assert.equal(door.distance, DOOR_ACTIVATION_DISTANCE);
});
