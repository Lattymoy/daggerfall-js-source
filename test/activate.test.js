import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activationTargets, pickActivatableHit,
  DOOR_ACTIVATION_DISTANCE, DEFAULT_ACTIVATION_DISTANCE, RAY_DISTANCE,
} from '../src/player/activate.js';

test('activationTargets: effect objects (no cpu) ride their aabb; relays are chain-only', () => {
  // Crash regression (audit 2026-08-16): the scenes called
  // worldAabb(o.cpu.positions, o.matrix) on EVERY action object; effect
  // objects carry aabb only - pressing use in any dungeon with a
  // registered trap threw TypeError.
  const objects = new Map([
    ['door:0', { key: 'door:0', kind: 'door', cpu: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1] }],
    ['act:10', { key: 'act:10', aabb: { min: [1, 1, 1], max: [2, 2, 2] } }],   // effect: precomputed aabb, no cpu
    ['act:11', { key: 'act:11' }],                                             // relay: chain-only, no target
  ]);
  const targets = activationTargets(objects);
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((t) => t.key).sort(), ['act:10', 'door:0']);
  const door = targets.find((t) => t.key === 'door:0');
  assert.equal(door.aabb.min[0], 5);   // cpu path transformed through the matrix
  // AUDIT 65 MC-2 MOVED THIS NUMBER INTO `reach`, and only for the
  // ACTION DOOR. DFU dispatches a door off the ray's own hit
  // (ActionDoorCheck, PlayerActivate.cs:374 -> ActivateActionDoor) and
  // the 128 units are re-tested INSIDE that handler, out loud -
  // `hit.distance > DoorActivationDistance` -> SetMidScreenText
  // (youAreTooFarAway), :686-689 - so the door has to reach the handler
  // to speak at all, which means competing for the one ray at the ray's
  // reach and carrying its own beside it.
  assert.equal(door.distance, RAY_DISTANCE, 'the action door competes for the RAY');
  assert.equal(door.reach, DOOR_ACTIVATION_DISTANCE, '...and carries ActivateActionDoor\'s own gate');
});

test('AUDIT 65 MC-2: an action RECORD keeps the narrow pre-gate, because DFU gives it no line', () => {
  // The two kinds share ONE pool here, and DFU does not gate them
  // alike: the record is tested in the Update ladder itself -
  // `if (ActionCheck(hit, out action) && hit.distance <=
  // DefaultActivationDistance)` (PlayerActivate.cs:380-383), no else
  // and no line - so widening it would make every lever and moving
  // platform speak a refusal the reference never speaks.
  // isActionDoorObject (world/actionSystem.js) is the port's spelling of
  // GetComponent<DaggerfallActionDoor>, and DaggerfallActionDoorSpecial
  // is a SEPARATE component that lookup can never return.
  const objects = new Map([
    ['door:0', { key: 'door:0', kind: 'door', aabb: { min: [0, 0, 0], max: [1, 1, 1] } }],
    ['door:1', { key: 'door:1', kind: 'door', special: true, aabb: { min: [0, 0, 0], max: [1, 1, 1] } }],
    ['act:2', { key: 'act:2', kind: 'model', aabb: { min: [0, 0, 0], max: [1, 1, 1] } }],
  ]);
  const t = Object.fromEntries(activationTargets(objects).map((x) => [x.key, x]));
  assert.equal(t['door:0'].distance, RAY_DISTANCE);
  assert.equal(t['door:0'].reach, DOOR_ACTIVATION_DISTANCE);
  assert.equal(t['act:2'].distance, DOOR_ACTIVATION_DISTANCE);
  assert.equal(t['act:2'].reach, undefined, ':380-383 is silent, so the record is never handed over');
  assert.equal(t['door:1'].distance, DOOR_ACTIVATION_DISTANCE);
  assert.equal(t['door:1'].reach, undefined, 'the special door is not the component :374 looks up');
});

test('AUDIT 65 MC-2: the pick hands a too-far target OVER with its reach, instead of dropping it in silence', () => {
  // DFU casts ONE ray at RayDistance (PlayerActivate.cs:76/:314) and
  // every handler it dispatches into gates the distance itself, out
  // loud. The port pre-gated the PICK - `if (d > target.distance)
  // continue` - so a chest, shelf, ladder, pile or body at 8 units was
  // dropped, no caller could speak, and the click fell through to
  // whatever stood behind it. A widened family therefore carries the
  // ray's reach in `distance` and the handler's in `reach`; the ladder
  // compares the two.
  const eye = [0, 1, 0];
  const dir = [0, 0, 1];
  const collider = { raycast: () => Infinity };   // no wall between
  const aabb = { min: [-0.5, 0.5, 8], max: [0.5, 1.5, 8.6] };
  // the OLD shape - reach in `distance`, and the target never comes back
  assert.equal(pickActivatableHit(eye, dir, [{ key: 'loot:0', aabb, distance: DEFAULT_ACTIVATION_DISTANCE }], collider), null);
  // the law: it wins the pick, and its own reach rides with it
  const hit = pickActivatableHit(eye, dir,
    [{ key: 'loot:0', aabb, distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE }], collider);
  assert.equal(hit.key, 'loot:0');
  assert.ok(Math.abs(hit.distance - 8) < 1e-6, `entered the box at ${hit.distance}`);
  assert.equal(hit.reach, DEFAULT_ACTIVATION_DISTANCE);
  assert.ok(hit.distance > hit.reach, 'which is what the ladder speaks the refusal on');
  // a family that was never widened answers `reach === distance`, which
  // the pre-gate has already enforced - so it can never refuse
  const near = { min: [-0.5, 0.5, 2], max: [0.5, 1.5, 2.6] };
  const plain = pickActivatableHit(eye, dir, [{ key: 'person:0', aabb: near, distance: 6.4 }], collider);
  assert.equal(plain.reach, 6.4);
  assert.ok(plain.distance <= plain.reach);
  // ...and a target with no distance at all falls back to the 128-unit
  // default on BOTH fields, as it did before this field existed
  const bare = pickActivatableHit(eye, dir, [{ key: 'exit:0', aabb: near }], collider);
  assert.equal(bare.reach, DEFAULT_ACTIVATION_DISTANCE);
});
