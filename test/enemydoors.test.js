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
import { ActionSystem, isActionDoorObject, DOOR_VERB_FLAGS } from '../src/world/actionSystem.js';
import { ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = {
  positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  indices: [0, 1, 2, 0, 2, 3],
};
const stubCollider = () => ({ addMesh: () => {}, removeBucket: () => {}, removeMesh: () => {} });
const act = (over = {}) => ({
  actionFlag: ACTION_FLAGS.None, triggerFlag: TRIGGER_FLAGS.None,
  index: 0, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1,
  duration: 0, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 },
  ...over,
});
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

test('enemydoors: the dungeon host arm - a DaggerfallActionDoor, behind canOpenDoors', () => {
  const src = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  const i = src.indexOf('foeDeps.openDoorsStep(');
  assert.ok(i > 0, 'the host drives the law');
  const arm = src.slice(Math.max(0, i - 700), i);
  assert.ok(arm.includes('ENEMY_BASICS[f.mobileType]?.canOpenDoors'), 'the mobile flag gates it');
  // AUDIT 63 F40: this pin used to assert
  // `DOOR_VERB_FLAGS.has(_door.actionFlag)` - the port's own predicate,
  // not the reference's. DFU asks GetComponent<DaggerfallActionDoor>()
  // (EnemySenses.cs:913 stores the handle, EnemyMotor.cs:1425-1442
  // consumes it with no flag test), which is the shared helper.
  assert.ok(arm.includes('isActionDoorObject(_door)'), 'the COMPONENT test, not the door-verb action family');
  assert.ok(arm.includes('f.ai.doorKey'), 'the senses key feeds it');
  assert.ok(src.includes('actions.toggleDoor(_door)'), 'the toggle is the ActionSystem door path');
  // ObstacleCheck asks the SAME question (EnemyMotor.cs:1159), so the
  // callback the motor consumes must answer it the same way.
  assert.match(src, /const isActionDoor = \(key\) => \{[\s\S]{0,120}?isActionDoorObject\(actions\?\.objects\.get\(key\)\)/,
    'the ObstacleCheck seam asks the component too');
});

test('enemydoors: isActionDoorObject IS GetComponent<DaggerfallActionDoor>() - the record-less door counts', () => {
  const a = new ActionSystem(stubCollider());
  // RDBLayout.cs:247-259: AddActionDoor attaches the component to EVERY
  // action-door model and only `if (HasAction(obj))` is a record added -
  // so the ORDINARY dungeon door has no action record at all and is
  // still a DaggerfallActionDoor. This is the case that matters: the
  // old flag test rejected it, so no foe ever opened a plain door.
  const plain = a.addDoor(CUBE, I, { ns: 0, positionKey: 5 });
  assert.equal(plain.actionFlag, ACTION_FLAGS.None, 'the ordinary door carries no verb');
  assert.equal(isActionDoorObject(plain), true, 'a record-less door IS a DaggerfallActionDoor');
  // A door that also carries a record is one too - the record is the
  // conditional extra, never the qualification.
  const withRecord = a.addDoor(CUBE, I, { ns: 0, positionKey: 6, action: act({ actionFlag: ACTION_FLAGS.OpenDoor }) });
  assert.equal(isActionDoorObject(withRecord), true);
  const moved = a.addDoor(CUBE, I, { ns: 0, positionKey: 8, action: act({ actionFlag: ACTION_FLAGS.Translation }) });
  assert.equal(isActionDoorObject(moved), true, 'a non-verb record does not disqualify a door');
  // DaggerfallActionDoorSpecial (Internal/DaggerfallActionDoorSpecial.cs:24)
  // is a SEPARATE MonoBehaviour attached at RDBLayout.cs:901, so
  // GetComponent<DaggerfallActionDoor> misses it - even though its
  // OpenDoor flag is in the door-verb family the old test used.
  const special = a.addSpecialDoor(0, 7, CUBE, I, act({ actionFlag: ACTION_FLAGS.OpenDoor }));
  assert.equal(DOOR_VERB_FLAGS.has(special.actionFlag), true, 'the old predicate accepted it');
  assert.equal(isActionDoorObject(special), false, 'no DaggerfallActionDoor component on a special door');
  // A LEVER wired to LockDoor is a plain model - classifyPlacementAction
  // mints a relay from it (only OpenDoor, or CloseDoor on a non-door,
  // makes a special door) - yet its actionFlag IS in the door-verb
  // family, so the old predicate called it a door.
  const lever = a.addRelay(0, 9, act({ actionFlag: ACTION_FLAGS.LockDoor }));
  assert.equal(DOOR_VERB_FLAGS.has(lever.actionFlag), true, 'the old predicate accepted a lever');
  assert.equal(isActionDoorObject(lever), false);
  // ...and a mover, which owns a collider bucket and so can be the
  // sight ray's blocker, is not a door either.
  assert.equal(isActionDoorObject(a.addAction(0, 11, CUBE, I, act({ duration: 20, translation: { x: 0, y: 2, z: 0 } }))), false);
  assert.equal(isActionDoorObject(null), false);
  assert.equal(isActionDoorObject(undefined), false);
});
