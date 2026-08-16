import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionSystem, classifyPlacementAction, DOOR_VERB_FLAGS } from '../src/world/actionSystem.js';
import { ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';

// Audit 2026-08-16: DFU's Play() cascades ActivateNext for EVERY action
// flag before the delegate runs, and door-verb delegates act on the door
// their record is attached to. Only move/effect objects were registered,
// so chains died at relays, chained doors were unreachable, and the
// Open/Close/Lock/UnlockDoor verbs did not exist.

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = {
  positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  indices: [0, 1, 2, 0, 2, 3],
};
const stubCollider = () => {
  const buckets = new Set();
  return {
    buckets,
    addMesh: (k) => buckets.add(k),
    removeBucket: (k) => buckets.delete(k),
    removeMesh: () => {},
  };
};
const act = (over = {}) => ({
  actionFlag: ACTION_FLAGS.None, triggerFlag: TRIGGER_FLAGS.None,
  index: 0, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1,
  duration: 0, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 },
  ...over,
});

test('actionchain: a relay carries the cascade through routed flags', () => {
  const a = new ActionSystem(stubCollider());
  const mover = a.addAction(9, CUBE, I, act({ duration: 20, translation: { x: 0, y: 2, z: 0 } }));
  a.addRelay(5, act({ actionFlag: ACTION_FLAGS.Teleport, nextObject: 9 }));
  const lever = a.addAction(1, CUBE, I, act({ duration: 20, rotation: { x: -40, y: 0, z: 0 }, nextObject: 5, triggerFlag: TRIGGER_FLAGS.Direct }));
  a.activate(lever.key);   // lever -> Teleport relay -> mover
  assert.equal(lever.state, 'forward');
  assert.equal(mover.state, 'forward', 'the chain must pass THROUGH the routed Teleport object');
});

test('actionchain: a chained door runs its own verb - OpenDoor unlocks + opens', () => {
  const c = stubCollider();
  const a = new ActionSystem(c);
  const door = a.addDoor(CUBE, I, {
    positionKey: 12,
    action: act({ actionFlag: ACTION_FLAGS.OpenDoor, triggerFlag: TRIGGER_FLAGS.None }),
    startingLockValue: 0x32,
  });
  assert.equal(door.key, 'act:12');
  assert.equal(door.currentLockValue, 0x32);
  const lever = a.addAction(1, CUBE, I, act({ duration: 20, rotation: { x: -40, y: 0, z: 0 }, nextObject: 12, triggerFlag: TRIGGER_FLAGS.Direct }));
  a.activate(lever.key);
  assert.equal(door.state, 'forward', 'chain -> OpenDoor swings the door');
  assert.equal(door.currentLockValue, 0, 'OpenDoor unlocks (verbatim)');
  assert.equal(c.buckets.has(door.key), false, 'opening door goes passable');
});

test('actionchain: CloseDoor closes an OPEN door and re-locks to the starting value', () => {
  const a = new ActionSystem(stubCollider());
  const door = a.addDoor(CUBE, I, {
    positionKey: 12,
    action: act({ actionFlag: ACTION_FLAGS.CloseDoor }),
    startingLockValue: 0x0a,
  });
  // CloseDoor on a CLOSED door does nothing (verbatim: only closes open doors).
  a.receive(door);
  assert.equal(door.state, 'start');
  // Open it by hand, settle, then chain the CloseDoor.
  a.toggleDoor(door);
  for (let i = 0; i < 100; i++) a.update(1.5 / 90);
  assert.equal(door.state, 'end');
  a.receive(door);
  assert.equal(door.state, 'reverse');
  assert.equal(door.currentLockValue, 0x0a, 'CloseDoor re-locks to StartingLockValue');
});

test('actionchain: Lock/UnlockDoor mutate the lock value only', () => {
  const a = new ActionSystem(stubCollider());
  const locked = a.addDoor(CUBE, I, { positionKey: 3, action: act({ actionFlag: ACTION_FLAGS.LockDoor }) });
  a.receive(locked);
  assert.equal(locked.currentLockValue, 16, 'LockDoor sets 16 on an unlocked door');
  assert.equal(locked.state, 'start', 'LockDoor never moves the door');
  locked.currentLockValue = 5;
  a.receive(locked);
  assert.equal(locked.currentLockValue, 5, 'LockDoor skips an already-locked door');
  locked.actionFlag = ACTION_FLAGS.UnlockDoor;
  a.receive(locked);
  assert.equal(locked.currentLockValue, 0);
});

test('actionchain: a special door swings like a hinged door and chains', () => {
  const c = stubCollider();
  const a = new ActionSystem(c);
  const s = a.addSpecialDoor(7, CUBE, I, act({ actionFlag: ACTION_FLAGS.OpenDoor }));
  assert.ok(s.special);
  const lever = a.addAction(1, CUBE, I, act({ duration: 20, rotation: { x: -40, y: 0, z: 0 }, nextObject: 7, triggerFlag: TRIGGER_FLAGS.Direct }));
  a.activate(lever.key);
  assert.equal(s.state, 'forward');
  for (let i = 0; i < 100; i++) a.update(1.5 / 90);
  assert.equal(s.state, 'end');
  const cos = Math.cos((-90 * Math.PI) / 180);
  assert.ok(Math.abs(s.matrix[0] - cos) < 1e-3, 'the -90 self-Y swing');
});

test('actionchain: the player toggle fires the door\'s own record through the Door gate', () => {
  const a = new ActionSystem(stubCollider());
  const mover = a.addAction(9, CUBE, I, act({ duration: 20, translation: { x: 0, y: 2, z: 0 } }));
  // Door trigger accepts 'Door': chain fires on the player toggle.
  const gated = a.addDoor(CUBE, I, { positionKey: 20, action: act({ triggerFlag: TRIGGER_FLAGS.Door, nextObject: 9 }) });
  a.activate(gated.key);
  assert.equal(gated.state, 'forward');
  assert.equal(mover.state, 'forward', 'ExecuteActionOnToggle cascades on the player toggle');
  // Direct trigger REJECTS 'Door': the toggle must not fire the record.
  const mover2 = a.addAction(11, CUBE, I, act({ duration: 20, translation: { x: 0, y: 2, z: 0 } }));
  const wrongGate = a.addDoor(CUBE, I, { positionKey: 21, action: act({ triggerFlag: TRIGGER_FLAGS.Direct, nextObject: 11 }) });
  a.activate(wrongGate.key);
  assert.equal(wrongGate.state, 'forward', 'the door still toggles');
  assert.equal(mover2.state, 'start', 'the Door-gated record does not fire on a Direct-only trigger');
});

test('actionchain: a chained None-flag door cascades but does NOT open (verbatim no delegate)', () => {
  const a = new ActionSystem(stubCollider());
  const mover = a.addAction(9, CUBE, I, act({ duration: 20, translation: { x: 0, y: 2, z: 0 } }));
  const door = a.addDoor(CUBE, I, { positionKey: 12, action: act({ nextObject: 9 }) });
  const lever = a.addAction(1, CUBE, I, act({ duration: 20, rotation: { x: -40, y: 0, z: 0 }, nextObject: 12, triggerFlag: TRIGGER_FLAGS.Direct }));
  a.activate(lever.key);
  assert.equal(door.state, 'start', 'None-flag door has no delegate - it must not swing');
  assert.equal(mover.state, 'forward', 'but the cascade passes through it');
});

test('actionchain: classifyPlacementAction pins the DFU precedence', () => {
  const F = ACTION_FLAGS;
  assert.equal(classifyPlacementAction(F.Translation), 'move');
  assert.equal(classifyPlacementAction(F.Rotation), 'move');
  assert.equal(classifyPlacementAction(F.Hurt22), 'effect');
  assert.equal(classifyPlacementAction(F.CastSpell), 'effect');
  assert.equal(classifyPlacementAction(F.OpenDoor), 'specialDoor');
  assert.equal(classifyPlacementAction(F.OpenDoor, true), 'specialDoor', 'C# precedence: OpenDoor makes a special door out of ANYTHING');
  assert.equal(classifyPlacementAction(F.CloseDoor, false), 'specialDoor');
  assert.equal(classifyPlacementAction(F.CloseDoor, true), 'relay', 'CloseDoor on a real action door is NOT special');
  for (const f of [F.Teleport, F.Activate, F.ShowText, F.SetGlobalVar, F.Dialogue, F.Unknown27, F.Unknown32, F.Unknown50, F.DoorText, F.None]) {
    assert.equal(classifyPlacementAction(f), 'relay');
  }
  assert.equal(DOOR_VERB_FLAGS.size, 4);
});
