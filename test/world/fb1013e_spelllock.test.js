// SPELL-LOCK (FIELD BUGS 2026-10-13e, Nes: "The current situation where doors lock at shops and inns in Daggerfall
// Capital" - "that's the only entrance. Once you get stuck, there's no way out."; two screenshots from inside, a door
// reading "Lock Level 41" and one "Lock Level 40", the player level 21 and 19).
//
// Nothing in the port locks an interior door: interiorContext adds its doors with no starting lock, as
// DaggerfallInterior.AddActionDoors sets none. A lock of 40 or 41 is a Lock spell's - it locks at its caster's level
// (Lock.cs:116) - and online a building's doors are shared: the act (WORLD3) and the room's memory (WORLD6a, kept
// thirty days) carried that lock to every visitor, magically held (>= 20: no pick, no bash) and past every lower
// level's Open. Daggerfall has one player, who can always Open what they locked. Now a peer's word locks no door past
// what the door's own data can give it (`lockCeiling`); the player's own save keeps its locks but for one past both
// that ceiling and the player's level, which no Lock of theirs could have cast.
//
// Driven through the real ActionSystem (its activate, its spell door verbs, applyRemote, collectSaveData and
// restoreSaveData), the real building memory (world/interior/interiorShared.js) and the real hover plaque.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ActionSystem, lockCeiling, ACTION_LOCK_VALUE, MAGIC_LOCK_THRESHOLD } from '../../src/world/actionSystem.js';
import { ACTION_FLAGS } from '../../src/world/rdbLayout.js';
import { mintInteriorShared, composeInteriorShared, applyInteriorShared, interiorLocationKey } from '../../src/world/interior/interiorShared.js';
import { actionObjectName } from '../../src/systems/worldTooltips.js';
import { codeOnly } from '../codeOnly.mjs';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
const collider = () => ({ addMesh() {}, removeBucket() {}, raycast: () => Infinity });
/** One player's copy of a room: the real graph with one door, added as the producer adds it. */
function room(level, skill = 10, doorOpts = {}) {
  const a = new ActionSystem(collider(), { playerLevel: () => level, lockpickSkill: () => skill, rolls: () => 0.5 });
  const d = a.addDoor(CUBE, I, doorOpts);
  return { a, d };
}
const lockOf = (r) => r.d.currentLockValue;
/** The swing played out, a frame at a time (DOOR_OPEN_DURATION is 1.5 s). */
const settle = (a) => { for (let i = 0; i < 60; i++) a.update(0.05); };

test('SPELL-LOCK 1: a level-41 Lock on a shop door stays its caster\'s - the act and the room\'s memory land the swing, never the lock', () => {
  const A = room(41);
  A.a.activate(A.d.key);                       // A opens the door...
  settle(A.a);
  assert.equal(A.d.state, 'end');
  const wire = [];
  A.a.onChanged = (recs) => wire.push(...recs);
  A.a.activate(A.d.key, { doorSpell: { kind: 'lock', holderLevel: 41 } });   // ...and locks it: swung shut, locked at 41
  assert.equal(lockOf(A), 41, 'the caster\'s own door is locked at their level - DFU\'s Lock, unchanged');
  assert.ok(lockOf(A) >= MAGIC_LOCK_THRESHOLD, 'magically held');
  assert.ok(wire.some((r) => r.key === A.d.key && r.lock === 41), 'the act still says the lock (the room may know where a door stands)');

  // B, level 21, already inside: the act lands the close and not the lock
  const B = room(21);
  B.a.activate(B.d.key);
  settle(B.a);
  assert.equal(B.a.applyRemote(wire), wire.length);
  assert.equal(lockOf(B), 0, 'no lock past the door\'s own data lands from a peer');
  assert.deepEqual(actionObjectName(B.d), { title: 'Door' }, 'the plaque reads a plain door - no "Lock Level: 41"');
  settle(B.a);
  assert.equal(B.d.state, 'start', 'the swing shut landed');
  B.a.activate(B.d.key);
  assert.equal(B.d.state, 'forward', 'and a plain press opens it - the way out');

  // C walks in later: the building's memory, composed from the caster's copy
  const key = interiorLocationKey(1291010263, 4242);
  const memory = composeInteriorShared({ actions: A.a, shelves: [], containers: [] }, mintInteriorShared(key));
  assert.equal(memory.world.actions.find((r) => r.key === A.d.key).lock, 41, 'the memory still carries the caster\'s word');
  const C = room(3);
  C.a.activate(C.d.key);
  settle(C.a);
  assert.equal(C.d.state, 'end');
  assert.ok(applyInteriorShared({ actions: C.a, shelves: [], containers: [] }, memory, mintInteriorShared(key)));
  assert.equal(lockOf(C), 0, 'the room\'s memory lands no Lock spell\'s lock');
  settle(C.a);
  assert.equal(C.d.state, 'start', 'and does land where the door stands');

  // a memory already poisoned on the relay (thirty days of it) is read the same way
  const forged = { locationKey: key, stamp: 'someone', world: { loot: [], actions: [{ key: C.d.key, state: 'start', t: 0, lock: 255 }] } };
  const D = room(60);
  assert.ok(applyInteriorShared({ actions: D.a, shelves: [], containers: [] }, forged, mintInteriorShared(key)));
  assert.equal(lockOf(D), 0, 'not even a byte\'s worth, at any level');
});

test('SPELL-LOCK 2: the ceiling is the door\'s own data - its starting lock, or LockDoor\'s 16 where its own action locks it; a peer may unlock and re-lock to it', () => {
  // a dungeon door the data locks at 50 (RDBLayout LOCK_VALUES 0x32)
  const native = () => room(10, 10, { positionKey: 7, ns: 1, startingLockValue: 50 });
  assert.equal(lockCeiling(native().d), 50);
  const B = native();
  assert.equal(lockOf(B), 50);
  B.a.applyRemote([{ key: B.d.key, state: 'start', t: 0, lock: 0 }]);
  assert.equal(lockOf(B), 0, 'a peer\'s pick is shared, as WORLD3 shares it');
  B.a.applyRemote([{ key: B.d.key, state: 'start', t: 0, lock: 50 }]);
  assert.equal(lockOf(B), 50, 'a re-lock to the door\'s own value lands (CloseDoor re-locks to the starting value)');
  B.a.applyRemote([{ key: B.d.key, state: 'start', t: 0, lock: 51 }]);
  assert.equal(lockOf(B), 50, 'one past it does not - the door keeps the lock it has');

  // a door whose own action is LockDoor can be locked at 16 by its own graph, and no harder
  const lockable = room(10, 10, { positionKey: 8, ns: 1, action: { actionFlag: ACTION_FLAGS.LockDoor } });
  assert.equal(lockable.d.actionFlag, ACTION_FLAGS.LockDoor);
  assert.equal(lockCeiling(lockable.d), ACTION_LOCK_VALUE);
  lockable.a.applyRemote([{ key: lockable.d.key, state: 'start', t: 0, lock: ACTION_LOCK_VALUE }]);
  assert.equal(lockOf(lockable), ACTION_LOCK_VALUE);
  lockable.a.applyRemote([{ key: lockable.d.key, state: 'start', t: 0, lock: 0 }]);
  lockable.a.applyRemote([{ key: lockable.d.key, state: 'start', t: 0, lock: ACTION_LOCK_VALUE + 1 }]);
  assert.equal(lockOf(lockable), 0);
  // the law itself, on the shapes the producer mints
  assert.equal(lockCeiling({ startingLockValue: 0, actionFlag: ACTION_FLAGS.LockDoor }), ACTION_LOCK_VALUE);
  assert.equal(lockCeiling({ startingLockValue: 50, actionFlag: ACTION_FLAGS.LockDoor }), 50);
  assert.equal(lockCeiling({ startingLockValue: 4, actionFlag: ACTION_FLAGS.UnlockDoor }), 4);
  assert.equal(lockCeiling(room(1).d), 0, 'an interior\'s door: nothing');

  // and the door's own graph still locks it, as DFU's LockDoor does - the ceiling binds a peer's word alone
  const own = room(1);
  own.d.actionFlag = ACTION_FLAGS.LockDoor;
  own.a._doorVerb(own.d);
  assert.equal(lockOf(own), ACTION_LOCK_VALUE);
});

test('SPELL-LOCK 3: the player\'s own save keeps its locks - but none past both the ceiling and their level, the peer\'s lock a copy took before the fix', () => {
  const save = (lock) => [{ key: 'door:0', state: 'start', t: 0, lock }];
  // Nes, level 21, whose cached copy of the shop took the level-41 lock
  const stuck = room(21);
  stuck.a.restoreSaveData(save(41), { level: 21 });
  assert.equal(lockOf(stuck), 0, 'a lock no Lock of theirs could have cast is dropped on the load');
  // their own Lock, cast at 15 (a level never drops), stays theirs
  const mine = room(21);
  mine.a.restoreSaveData(save(15), { level: 21 });
  assert.equal(lockOf(mine), 15);
  const atLevel = room(41);
  atLevel.a.restoreSaveData(save(41), { level: 41 });
  assert.equal(lockOf(atLevel), 41, 'at their own level it is theirs');
  // a door the data locks harder than the player's level keeps it: that is the dungeon's, not a spell's
  const deep = room(3, 10, { positionKey: 9, ns: 1, startingLockValue: 128 });
  deep.a.restoreSaveData([{ key: deep.d.key, state: 'start', t: 0, lock: 128 }], { level: 3 });
  assert.equal(lockOf(deep), 128);
  // with no level said, the save is restored whole (every caller that is not a building's or a dungeon's own copy)
  const whole = room(1);
  whole.a.restoreSaveData(save(41));
  assert.equal(lockOf(whole), 41);
  // a peer's word is never lifted by a level: remote is remote
  const peer = room(60);
  peer.a.restoreSaveData(save(41), { remote: true, level: 60 });
  assert.equal(lockOf(peer), 0);
});

test('SPELL-LOCK 4: a placed door not hung yet keeps a peer\'s swing and no lock; the hosts hand the room\'s word in as a peer\'s, and their own copies with the player\'s level', () => {
  const A = room(41);
  const key = 'act:decor:77';
  A.a.applyRemote([{ key, state: 'end', t: 1, lock: 41 }]);   // the act arrives before this client has hung the door
  A.a.restoreSaveData([{ key: 'act:decor:78', state: 'end', t: 1, lock: 41 }], { remote: true });   // a memory's, the same
  const hung = A.a.addDoor(CUBE, I, { ns: 'decor', positionKey: 77 });
  const hung2 = A.a.addDoor(CUBE, I, { ns: 'decor', positionKey: 78 });
  assert.equal(hung.key, key);
  assert.equal(hung.state, 'end', 'the swing lands when the door is hung');
  assert.equal(hung.currentLockValue, 0, 'the lock does not');
  assert.equal(hung2.state, 'end');
  assert.equal(hung2.currentLockValue, 0);
  // the player's own save of a placed door keeps its lock (a home owner's own Lock spell is theirs)
  const own = room(41);
  own.a.restoreSaveData([{ key: 'act:decor:79', state: 'start', t: 0, lock: 30 }]);
  assert.equal(own.a.addDoor(CUBE, I, { ns: 'decor', positionKey: 79 }).currentLockValue, 30);

  // the hosts: the dungeon's room memory is applied as a peer's word, its own save with the player's level; the
  // building's cached copy with the player's level (the building's memory and every act go through
  // applyInteriorShared and applyRemote, driven above)
  const dungeon = codeOnly(readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8'));
  assert.equal(dungeon.match(/actions\.restoreSaveData\(w\.actions, \{ remote: wire, level: playerEntity\.level \}\)/g)?.length, 1);
  assert.ok(/restoreSharedWorld\(shared\)[\s\S]{0,6000}applyWorld\(\{[^}]*actions: acts[^}]*\}, \{ truncate: false, wire: true \}\)/.test(dungeon), 'the room memory is applied with wire: true');
  const modes = codeOnly(readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8'));
  assert.equal(modes.match(/data\.actionDoors\.map\([^\n]*\n\s*\{ level: playerEntity\.level \}\)/g)?.length, 1, 'the building\'s cached copy restores with the player\'s level');
});
