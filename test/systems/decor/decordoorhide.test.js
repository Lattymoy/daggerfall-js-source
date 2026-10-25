// A homeowner can take out an interior swing door. The opening stays, the door's
// collider goes with the door, and the same record index is still out after the
// scene is cached and read back. An exit, a chained door and a door with an
// action record are not taken out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionSystem } from '../../../src/world/actionSystem.js';
import { createInteriorDoors, interiorDoorIndex, isRemovableInteriorDoor } from '../../../src/systems/decor/decorInteriorDoors.js';
import { cacheScene, createSceneCache, restoreCachedScene } from '../../../src/systems/sceneCache.js';

const cpu = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]) };
const matrix = () => {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};
const action = { actionFlag: 1, duration: 0, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 }, index: 0, magnitude: 0, axisRaw: 0, nextObject: 4, triggerFlag: 0 };

function rig() {
  const buckets = new Map();
  const collider = { addMesh: (key) => buckets.set(key, true), removeBucket: (key) => buckets.delete(key) };
  const actions = new ActionSystem(collider);
  const draws = [];
  const doors = createInteriorDoors({ draws, addDoor: (c, m) => actions.addDoor(c, m), removeDoor: (key) => actions.removeDoor(key) });
  const hang = (index, opts) => {
    draws.push({ gpu: {}, object: actions.addDoor(cpu, matrix(), opts) });
    return doors.adopt(index, cpu, draws[draws.length - 1]);
  };
  return { buckets, actions, draws, doors, hang };
}

test('a room door taken out loses its draw and its collider, and comes back on put back', () => {
  const { buckets, draws, doors, hang } = rig();
  assert.equal(hang(0), true);
  assert.equal(hang(1), true);
  assert.equal(buckets.size, 2);
  assert.equal(doors.hide(0), true);
  assert.equal(buckets.size, 1);
  assert.equal(draws.length, 1);
  assert.deepEqual(doors.hidden(), ['intdoor:0']);
  assert.equal(doors.targets().some((t) => t.key === 'intdoor:0'), false);
  assert.equal(doors.targets().some((t) => t.key === 'intdoor:1'), true);
  assert.equal(doors.show(0), true);
  assert.equal(buckets.size, 2);
  assert.equal(draws.length, 2);
  assert.deepEqual(doors.hidden(), []);
});

test('an exit, a teleport and a door with an action record are not room doors', () => {
  assert.equal(interiorDoorIndex('exit:0'), null);
  assert.equal(interiorDoorIndex('act:1:2'), null);
  assert.equal(interiorDoorIndex('intdoor:2'), 2);
  const { buckets, doors, hang, actions, draws } = rig();
  assert.equal(hang(0), true);
  const quest = actions.addDoor(cpu, matrix(), { action, loadID: 5 });
  draws.push({ gpu: {}, object: quest });
  assert.equal(isRemovableInteriorDoor(quest), false);
  assert.equal(doors.adopt(3, cpu, draws[draws.length - 1]), false);
  assert.equal(doors.hide(3), false);
  assert.equal(buckets.has(quest.key), true);
  assert.equal(doors.apply(['m0:12', 'exit:1', 'act:0:1', 'intdoor:0', 'intdoor:0']), 1);
  assert.deepEqual(doors.hidden(), ['intdoor:0']);
  assert.equal(buckets.has(quest.key), true);
});

test('a removed room door is still removed after the scene is cached and read back', () => {
  const cache = createSceneCache();
  cacheScene(cache, 'house', { hiddenBase: ['m1:41000', 'intdoor:1'] });
  const back = restoreCachedScene(cache, 'house');
  assert.ok(back.hiddenBase.includes('m1:41000'));
  assert.ok(back.hiddenBase.includes('intdoor:1'));
  const { buckets, doors, hang } = rig();
  hang(0);
  hang(1);
  assert.equal(doors.apply(back.hiddenBase), 1);
  assert.deepEqual(doors.hidden(), ['intdoor:1']);
  assert.equal(buckets.size, 1);
});
