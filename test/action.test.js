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
  // A locked door refuses the PLAYER toggle and stays solid.
  const door = a.addDoor(CUBE, I, { ns: 0, positionKey: 40, startingLockValue: 12 });
  a.activate(door.key);
  assert.equal(door.state, 'start');
  assert.equal(refused, 1);
  assert.ok(c.buckets.has(door.key));
  // An UnlockDoor verb ON the door (lever chain) clears the lock.
  const door2 = a.addDoor(CUBE, I, { ns: 0, positionKey: 41, startingLockValue: 12, action: { actionFlag: ACTION_FLAGS.UnlockDoor, nextObject: -1 } });
  const lever = a.addRelay(0, 50, { actionFlag: ACTION_FLAGS.Activate, nextObject: 41 });
  a.receive(lever);
  assert.equal(door2.currentLockValue, 0);
  a.activate(door2.key);
  assert.equal(door2.state, 'forward');   // unlocked: opens
  // LockDoor sets 16 only when unlocked (DFU: if (!door.IsLocked)).
  const door3 = a.addDoor(CUBE, I, { ns: 0, positionKey: 42, startingLockValue: 0, action: { actionFlag: ACTION_FLAGS.LockDoor, nextObject: -1 } });
  const lever3 = a.addRelay(0, 51, { actionFlag: ACTION_FLAGS.Activate, nextObject: 42 });
  a.receive(lever3);
  assert.equal(door3.currentLockValue, 16);
  door3.currentLockValue = 12;
  a.receive(lever3);
  assert.equal(door3.currentLockValue, 12);   // already locked: unchanged
});

test('action: P10 teleport + the block-instance key namespace', () => {
  const c = stubCollider();
  const a = new ActionSystem(c);
  const dests = new Map([['0:99', { pos: [10, 2, 30], yawDeg: 45 }]]);
  a.resolvePosition = (ns, key) => dests.get(`${ns}:${key}`) ?? null;
  const warps = [];
  a.onTeleport = (d) => warps.push(d);
  // Teleport (a delegated relay) fires to the resolved NEXT object's
  // transform; the destination is an actionless marker, so the chain
  // cascade no-ops.
  const tele = a.addRelay(0, 60, { actionFlag: ACTION_FLAGS.Teleport, nextObject: 99 });
  a.receive(tele, 'ActionObject');
  assert.deepEqual(warps, [{ pos: [10, 2, 30], yawDeg: 45 }]);
  // A null destination logs and does NOT warp (DFU "next object null").
  const tele2 = a.addRelay(0, 61, { actionFlag: ACTION_FLAGS.Teleport, nextObject: 500 });
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

test('action: U6 text actions - ShowText, the input-gated chain, DoorText first-activation door hold', async () => {
  const { TYPE_11_TEXT_INDEX, TYPE_12_TEXT_INDEX, TYPE_99_TEXT_INDEX, TYPE_12_ANSWERS } = await import('../src/world/actionSystem.js');
  assert.equal(TYPE_11_TEXT_INDEX, 8600);
  assert.equal(TYPE_12_TEXT_INDEX, 5400);
  assert.equal(TYPE_99_TEXT_INDEX, 7700);
  assert.deepEqual([...TYPE_12_ANSWERS[5406]], ['one', '1']);   // the blind god
  const c = stubCollider();
  const a = new ActionSystem(c);
  const shown = [], doorTexts = [];
  let trespass = 0, inputCb = null;
  a.onShowText = (id) => shown.push(id);
  a.onDoorText = (id) => doorTexts.push(id);
  a.onTrespass = () => trespass++;
  // ShowText: record = index + 8600
  const st = a.addRelay(0, 70, { actionFlag: ACTION_FLAGS.ShowText, index: 12, nextObject: -1 });
  a.receive(st);
  assert.deepEqual(shown, [8612]);
  // ShowTextWithInput: NO up-front cascade (Play's verbatim
  // exception); only a case-insensitive answer match fires the chain
  let dmg = 0;
  const a2 = new ActionSystem(c, { damagePlayer: (n) => { dmg += n; }, playerLevel: () => 1 });
  a2.onShowTextInput = (id, cb) => { inputCb = cb; };
  const spike2 = a2.addEffect(0, 71, { actionFlag: ACTION_FLAGS.Hurt22, index: 0, magnitude: 10, axisRaw: 0, isFlat: true, nextObject: -1 });
  const riddle = a2.addRelay(0, 72, { actionFlag: ACTION_FLAGS.ShowTextWithInput, index: 6, nextObject: 71 });   // 5400+6 = 5406
  a2.receive(riddle);
  assert.equal(dmg, 0);                    // the chain did NOT cascade at Play
  inputCb('two');
  assert.equal(dmg, 0);                    // wrong answer
  inputCb('ONE');
  assert.equal(dmg, 10);                   // case-insensitive match fires ActivateNext
  assert.ok(spike2 && st && riddle);
  // DoorText on a door: first activation shows the (remapped) text
  // and HOLDS the door; the second toggles and runs the trespass gate
  const door = a.addDoor(CUBE, I, { ns: 0, positionKey: 80, startingLockValue: 0, action: { actionFlag: ACTION_FLAGS.DoorText, index: 1, axisRaw: 9, triggerFlag: 0x0a, nextObject: -1 } });   // TRIGGER_FLAGS.Door
  a.activate(door.key);
  assert.equal(door.state, 'start');       // held on first activation
  assert.deepEqual(doorTexts, [7705]);     // 7701 remaps to 7705 ("allowed" vs "allow")
  a.activate(door.key);
  assert.equal(door.state, 'forward');     // opens from the second on
  assert.equal(trespass, 1);               // axisRaw 9 > 5
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

// ---------------------------------------------------------------------------
// AUDIT 23 (save-load-11): the action-object save record.
// ---------------------------------------------------------------------------

// A collider stub that remembers WHERE each bucket sits, so a restored
// pose can be checked on the collision side too.
function poseCollider() {
  const buckets = new Map();
  return {
    buckets,
    addMesh: (key, _p, _i, m) => buckets.set(key, m),
    removeBucket: (key) => buckets.delete(key),
    raycast: () => Infinity,
  };
}

// A portcullis: an action DOOR whose OWN record is Translation-flagged
// (+y 3.2 over ActionDuration 54 / 20 = 2.7 s), the S0000004 Mantellan
// Crux shape, plus a lock so the P10 field rides along.
const buildPortcullis = () => {
  const collider = poseCollider();
  const a = new ActionSystem(collider);
  const door = a.addDoor(CUBE, I, {
    ns: 0,
    positionKey: 26742,
    startingLockValue: 6,
    action: {
      duration: 54, magnitude: 0, index: 0, axisRaw: 0,
      rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 3.2, z: 0 },
      nextObject: -1, actionFlag: ACTION_FLAGS.Translation, triggerFlag: 0x02,   // TRIGGER_FLAGS.Direct
    },
  });
  return { a, door, collider };
};
// Exact frame count, so the tween fraction under test is not at the
// mercy of float accumulation in the loop guard.
const run = (a, seconds, step = 1 / 60) => {
  const n = Math.round(seconds / step);
  for (let i = 0; i < n; i++) a.update(step);
};

test('action save-load-11: a door saved MID-RISE restores mid-rise and keeps rising', () => {
  // DFU puts TWO serializable components on the one door GameObject -
  // SerializableActionDoor for the swing (:73-89) and, via RDBLayout's
  // AddActionModelHelper -> AddAction (:258, :970-973), a
  // SerializableActionObject for the record's Move (:61-76). Both save
  // their state plus the live tween's Percentage and hand the REMAINING
  // fraction back on restore (RestartTween(1 - percentage)). Before
  // this row the port's record carried only the swing, so a portcullis
  // saved half-risen slammed back to the floor on load.
  const { a, door } = buildPortcullis();
  const baseY = door.base[13];
  a.receive(door, 'Direct');
  assert.equal(door.moveState, 'forward');
  // 0.9 of 2.7 s - deliberately NOT halfway, so an inverted or
  // re-derived fraction cannot pass for the saved one.
  run(a, 0.9);
  approx(door.moveT, 1 / 3, 1e-2);
  approx(door.matrix[13] - baseY, 3.2 / 3, 2e-2);

  const snap = a.collectSaveData();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].key, 'act:0:26742');
  assert.equal(snap[0].moveState, 'forward');
  approx(snap[0].moveT, 1 / 3, 1e-2);
  assert.equal(snap[0].lock, 6);                    // P10 still rides

  // The load path: DFU REBUILDS the location, so restore onto a fresh
  // graph whose door sits at its untouched base pose.
  const fresh = buildPortcullis();
  approx(fresh.door.matrix[13] - baseY, 0, 1e-9);
  assert.equal(fresh.door.activationCount, 0, 'the fresh graph really has not been activated');
  fresh.a.restoreSaveData(snap);
  assert.equal(fresh.door.moveState, 'forward', 'the Move tween survives the round trip');
  // BOTH reviewers of this slice found the same hole: the RESTORE of
  // activationCount was unpinned, and deleting that line left the whole
  // suite green while Testing.md claimed the field round-tripped. It is
  // load-bearing - DoorText's first-activation hold reads
  // `activationCount === 0 && byPlayer` and the Hurt21 relay reads
  // `activationCount % 20`, so a lost counter re-shows a door's text
  // after every load. Discriminating here because `receive` left the
  // saved door at 1 while the fresh one is 0.
  assert.equal(fresh.door.activationCount, 1, "Receive's counter rides the record");
  approx(fresh.door.moveT, 1 / 3, 1e-2);
  // restored mid-rise, not snapped back to the floor
  approx(fresh.door.matrix[13] - baseY, 3.2 / 3, 2e-2);
  // The door never SWUNG, so it is still solid - and its bucket rides
  // the restored pose, not the base.
  approx(fresh.collider.buckets.get(fresh.door.key)[13] - baseY, 3.2 / 3, 2e-2);

  // ...and update() carries it the REMAINING 1.8 s on its own
  // (RestartTween(1 - percentage)) - no more, no less.
  run(fresh.a, 1.7);
  assert.equal(fresh.door.moveState, 'forward', 'still rising at 1.7 s of the 1.8 s left');
  run(fresh.a, 0.2);
  assert.equal(fresh.door.moveState, 'end');
  assert.equal(fresh.door.moveT, 1);
  approx(fresh.door.matrix[13] - baseY, 3.2, 1e-5);
});

test('action save-load-11: the Move pair is PRESENCE-GATED - a pre-fix snapshot restores unchanged', () => {
  // Every field past {state, t, activationCount} is additive: a
  // snapshot written before the pair existed must leave the live Move
  // state alone rather than zero it.
  const { a, door } = buildPortcullis();
  a.receive(door, 'Direct');
  run(a, 0.9);
  const baseY = door.base[13];
  const legacy = a.collectSaveData().map(({ moveState, moveT, ...rest }) => rest);
  assert.equal('moveState' in legacy[0], false);

  // Restored onto a door that is itself mid-rise: the live tween holds.
  const live = buildPortcullis();
  live.a.receive(live.door, 'Direct');
  run(live.a, 0.9);
  live.a.restoreSaveData(legacy);
  assert.equal(live.door.moveState, 'forward');
  approx(live.door.moveT, 1 / 3, 1e-2);
  approx(live.door.matrix[13] - baseY, 3.2 / 3, 2e-2);

  // ...and onto a door that never moved: it stays put, no NaN pose.
  const fresh = buildPortcullis();
  fresh.a.restoreSaveData(legacy);
  assert.equal(fresh.door.moveState, 'start');
  assert.equal(fresh.door.moveT, 0);
  approx(fresh.door.matrix[13] - baseY, 0, 1e-9);
});

test('action save-load-11: the SWING half of the record still round-trips through the same law', () => {
  // The refactor moved {state, t, activationCount, lock} out of the
  // dungeon host and into ActionSystem - the swing must land exactly
  // where it did (a mid-swing door resumes and stays passable, an
  // unlocked door stays unlocked).
  const { a, door } = buildPortcullis();
  door.currentLockValue = 0;
  a.toggleDoor(door);
  run(a, 0.5);                                      // a THIRD of OPEN_DURATION 1.5
  approx(door.t, 1 / 3, 1e-2);
  const snap = a.collectSaveData();
  assert.equal(snap[0].state, 'forward');
  assert.equal(snap[0].lock, 0);
  assert.equal(snap[0].activationCount, 0);         // toggleDoor is not Receive

  const fresh = buildPortcullis();
  assert.equal(fresh.collider.buckets.has(fresh.door.key), true, 'a closed door starts solid');
  fresh.a.restoreSaveData(snap);
  assert.equal(fresh.door.state, 'forward');
  approx(fresh.door.t, 1 / 3, 1e-2);
  assert.equal(fresh.door.currentLockValue, 0, 'the lock restores from the save');
  assert.equal(fresh.collider.buckets.has(fresh.door.key), false, 'a mid-swing door is passable');
  run(fresh.a, 0.9);
  assert.equal(fresh.door.state, 'forward', 'still swinging at 0.9 s of the 1.0 s left');
  run(fresh.a, 0.2);
  assert.equal(fresh.door.state, 'end');
});
