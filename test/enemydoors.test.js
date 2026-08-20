// C-slice (AUDIT 23 characters-3): enemies OPENING DOORS.
// EnemyMotor.OpenDoors (:1425-1442) + the senses half
// (EnemySenses.CanSeeTarget:879,905-918) + the collider's hit
// attribution that carries the blocking door to the motor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Collider } from '../src/player/collider.js';
import { canSeeTarget, openDoorsStep, OPEN_DOOR_DISTANCE } from '../src/characters/enemyMotor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** a vertical quad at z = z0 spanning x in [-w, w], y in [0, h] */
const quad = (z0, w = 3, h = 3) => ({
  positions: new Float32Array([-w, 0, z0, w, 0, z0, w, h, z0, -w, h, z0]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
});

test('enemydoors: raycastHit names the bucket that blocked the ray - and an opened door unblocks it', () => {
  const c = new Collider(() => -Infinity);
  const door = quad(4), wall = quad(8);
  c.addMesh('door:7', door.positions, door.indices, I);
  c.addMesh('level', wall.positions, wall.indices, I);
  const h = c.raycastHit([0, 1, 0], [0, 0, 1], 20);
  assert.ok(Math.abs(h.dist - 4) < 1e-4, 'the door plane is the first hit');
  assert.equal(h.key, 'door:7', 'attributed to the DOOR bucket');
  // the door opens: its bucket goes (MakeTrigger) and the wall is next
  c.removeBucket('door:7');
  const h2 = c.raycastHit([0, 1, 0], [0, 0, 1], 20);
  assert.ok(Math.abs(h2.dist - 8) < 1e-4);
  assert.equal(h2.key, 'level');
  // raycast still returns the plain distance (the old contract)
  assert.ok(Math.abs(c.raycast([0, 1, 0], [0, 0, 1], 20) - 8) < 1e-4);
});

test('enemydoors: the senses record the blocking door; a clear sight line records nothing', () => {
  // EnemySenses.CanSeeTarget:912-918 - the sight ray's FIRST blocker
  // being a door is what OpenDoors later consumes.
  const c = new Collider(() => -Infinity);
  const door = quad(4);
  c.addMesh('door:7', door.positions, door.indices, I);
  const blocked = { key: null };
  const seen = canSeeTarget(c, [0, 0, 0], 0, 1.8, [0, 0, 10], undefined, blocked);
  assert.equal(seen, false, 'the closed door blocks sight');
  assert.equal(blocked.key, 'door:7', 'and is recorded');
  const clear = { key: null };
  assert.equal(canSeeTarget(c, [0, 0, 0], 0, 1.8, [0, 0, 3], undefined, clear), true, 'in front of the door: seen');
  assert.equal(clear.key, null, 'nothing recorded on a clear line');
});

test('enemydoors: OpenDoors - within 2m of a closed unlocked door it toggles; every gate refuses', () => {
  const mk = (over = {}) => ({ state: 'start', currentLockValue: 0, center: [0, 1, 1.5], ...over });
  const runs = [];
  const toggle = () => { runs.push(1); return true; };
  assert.equal(openDoorsStep([0, 0, 0], true, mk(), toggle), true, 'closed + unlocked + 1.8m: toggles');
  assert.equal(runs.length, 1);
  assert.equal(openDoorsStep([0, 0, 0], true, mk({ center: [0, 1, 2.5] }), toggle), false, 'beyond OPEN_DOOR_DISTANCE');
  assert.equal(openDoorsStep([0, 0, 0], true, mk({ currentLockValue: 16 }), toggle), false, 'IsLocked refuses');
  assert.equal(openDoorsStep([0, 0, 0], true, mk({ state: 'end' }), toggle), false, 'IsOpen refuses');
  assert.equal(openDoorsStep([0, 0, 0], false, mk(), toggle), false, 'CanOpenDoors gates the whole law');
  assert.equal(openDoorsStep([0, 0, 0], true, null, toggle), false, 'no known door, no toggle');
  assert.equal(runs.length, 1, 'the refusals never reached the toggle');
  assert.equal(OPEN_DOOR_DISTANCE, 2, 'EnemyMotor.cs:34');
});

test('enemydoors: the dungeon host arm - door-flagged action objects only, behind canOpenDoors', () => {
  const src = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  const i = src.indexOf('foeDeps.openDoorsStep(');
  assert.ok(i > 0, 'the host drives the law');
  const arm = src.slice(Math.max(0, i - 700), i);
  assert.ok(arm.includes('ENEMY_BASICS[f.mobileType]?.canOpenDoors'), 'the mobile flag gates it');
  assert.ok(arm.includes('DOOR_VERB_FLAGS.has(_door.actionFlag)'), 'only DOOR action objects count');
  assert.ok(arm.includes('f.ai.doorKey'), 'the senses key feeds it');
  assert.ok(src.includes('actions.toggleDoor(_door)'), 'the toggle is the ActionSystem door path');
});
