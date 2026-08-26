// R1: LOCKPICKING - the interior attempt (DaggerfallActionDoor.
// AttemptLockpicking :147-191), the exterior building arm's laws
// (PlayerActivate.cs :512-568 - formula, anti-grind, mode routing),
// the opening-hours/unlocked ladder (:91-106, :1258-1312), and the
// interaction-mode hoist that lets the dungeon see Steal at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionSystem, MAGIC_LOCK_THRESHOLD,
  interiorLockpickingChance, exteriorLockpickingChance,
} from '../src/world/actionSystem.js';
import {
  OPEN_HOURS, CLOSE_HOURS, isBuildingOpen, buildingIsUnlocked, buildingLockValue,
} from '../src/systems/buildingLocks.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { HOLIDAYS } from '../src/systems/holidays.js';
import { getInteractionMode, setInteractionMode, nextInteractionMode, MODES } from '../src/player/interactionMode.js';
import { MODES as TOWN_MODES } from '../src/scenes/townTalk.js';
import { discoverBuilding, getLastLockpickAttempt, setLastLockpickAttempt } from '../src/systems/discovery.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};
const stubCollider = () => ({ addMesh: () => {}, removeBucket: () => {}, raycast: () => Infinity });

test('R1 formulas: both lockpicking chances, clamped 5..95 (FormulaHelper.cs:232-251)', () => {
  assert.equal(interiorLockpickingChance(5, 4, 30), 35, '5*(level-lock) + skill');
  assert.equal(exteriorLockpickingChance(4, 30), 10, 'skill - 5*lock: NO level term');
  assert.equal(exteriorLockpickingChance(19, 10), 5, 'the 5 floor');
  assert.equal(exteriorLockpickingChance(0, 200), 95, 'the 95 ceiling');
  assert.equal(interiorLockpickingChance(1, 16, 10), 5, 'a LockDoor-verb lock (16) floors a novice');
});

test('R1 interior attempt: tally before the roll, success opens and zeroes, failure records the skill', () => {
  let roll = 0.99, skill = 30;
  const tallies = [], results = [];
  const a = new ActionSystem(stubCollider(), { playerLevel: () => 5, lockpickSkill: () => skill, rolls: () => roll });
  a.onLockpickTally = () => tallies.push(1);
  a.onLockpickResult = (o, ok) => results.push(ok);
  const door = a.addDoor(CUBE, I, { startingLockValue: 4 });   // chance 35 at level 5 / skill 30

  // failure: 99 >= 35 (Dice100.FailedRoll) - the skill is recorded
  assert.equal(a.attemptLockpicking(door), false);
  assert.deepEqual(results, [false]);
  assert.equal(tallies.length, 1, 'TallySkill(Lockpicking, 1) fires BEFORE the roll (:165)');
  assert.equal(door.failedSkillLevel, 30);
  assert.equal(door.currentLockValue, 4, 'the lock holds');

  // the retry gate (:157): same live skill = SILENT return - no
  // tally, no roll, no message
  assert.equal(a.attemptLockpicking(door), false);
  assert.equal(tallies.length, 1);
  assert.equal(results.length, 1);

  // the skill moved - the attempt reopens, and this time succeeds
  skill = 31; roll = 0.3;   // chance 36, roll 30 < 36
  assert.equal(a.attemptLockpicking(door), true);
  assert.deepEqual(results, [false, true]);
  assert.equal(door.currentLockValue, 0, 'success zeroes the lock (:176)');
  assert.equal(door.state, 'forward', 'and OPENS the door (ToggleDoor(true), :184)');
});

test('R1 interior attempt: the magically held arm - failure line, no tally, no roll, no record (:187-190)', () => {
  const tallies = [], results = [];
  const a = new ActionSystem(stubCollider(), { playerLevel: () => 5, lockpickSkill: () => 60, rolls: () => 0 });
  a.onLockpickTally = () => tallies.push(1);
  a.onLockpickResult = (o, ok) => results.push(ok);
  const door = a.addDoor(CUBE, I, { startingLockValue: MAGIC_LOCK_THRESHOLD });
  assert.equal(a.attemptLockpicking(door), false);
  assert.deepEqual(results, [false]);
  assert.equal(tallies.length, 0, 'no skill tally on a magic lock');
  assert.equal(door.failedSkillLevel, 0, 'no failure record either - a later skill never blocks');
  assert.equal(door.currentLockValue, MAGIC_LOCK_THRESHOLD);
});

test('R1 routing: Steal mode on a locked door PICKS; every other mode toggles into the lock gate (PlayerActivate.cs:698-703)', () => {
  const results = [], refused = [];
  const a = new ActionSystem(stubCollider(), { playerLevel: () => 5, lockpickSkill: () => 30, rolls: () => 0 });
  a.onLockpickResult = (o, ok) => results.push(ok);
  a.onLockedDoor = () => refused.push(1);
  const door = a.addDoor(CUBE, I, { startingLockValue: 4 });

  a.activate(door.key);   // grab (default): the toggle refuses through the lock gate
  assert.deepEqual(refused, [1]);
  assert.equal(results.length, 0);
  assert.equal(door.state, 'start');

  a.activate(door.key, { steal: true });   // steal: the pick (roll 0 < 35 succeeds)
  assert.deepEqual(results, [true]);
  assert.equal(door.state, 'forward');

  // an UNLOCKED door in steal mode just toggles (IsLocked gate)
  const door2 = a.addDoor(CUBE, I);
  a.activate(door2.key, { steal: true });
  assert.equal(door2.state, 'forward');
  assert.equal(results.length, 1, 'no attempt ran');
});

test('R1 hours: the verbatim tables and their edge rows (PlayerActivate.cs:91-106)', () => {
  assert.equal(OPEN_HOURS.length, 25);
  assert.equal(CLOSE_HOURS.length, 25);
  assert.ok(isBuildingOpen(BUILDING_TYPES.Tavern, 3), 'taverns never close (0/25)');
  assert.ok(isBuildingOpen(BUILDING_TYPES.Temple, 3), 'temples too');
  assert.ok(!isBuildingOpen(BUILDING_TYPES.House1, 12), 'House1 is 0/0 - NEVER open');
  assert.ok(isBuildingOpen(BUILDING_TYPES.Alchemist, 7) && !isBuildingOpen(BUILDING_TYPES.Alchemist, 22), 'alchemist 7-22, close hour exclusive');
  assert.ok(isBuildingOpen(BUILDING_TYPES.House2, 6) && !isBuildingOpen(BUILDING_TYPES.House2, 18), 'houses 6-18');
});

test('R1 unlocked ladder: guild bypasses, the quest override, Suns Rest, ships (PlayerActivate.cs:1258-1312)', () => {
  const b = (buildingType, factionId = 0) => ({ buildingType, factionId, buildingKey: 7, quality: 12 });
  // shops: open by hours, CLOSED on Suns Rest whatever the hour
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.Alchemist), { hour: 12 }));
  assert.ok(!buildingIsUnlocked(b(BUILDING_TYPES.Alchemist), { hour: 12, holidayId: HOLIDAYS.Suns_Rest }));
  // guild hall at 3am: only anytime access opens it
  assert.ok(!buildingIsUnlocked(b(BUILDING_TYPES.GuildHall, 41), { hour: 3, guildForBuilding: () => ({ hallAccessAnytime: false, isMember: true }) }));
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.GuildHall, 41), { hour: 3, guildForBuilding: () => ({ hallAccessAnytime: true, isMember: true }) }));
  // a factioned House2 (TG/DB) is members-only, hours notwithstanding
  assert.ok(!buildingIsUnlocked(b(BUILDING_TYPES.House2, 42), { hour: 12, guildForBuilding: () => ({ hallAccessAnytime: false, isMember: false }) }));
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.House2, 42), { hour: 3, guildForBuilding: () => ({ hallAccessAnytime: false, isMember: true }) }));
  // an unfactioned House2 falls to the hours arm
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.House2), { hour: 12 }));
  // an active quest building overrides everything below it
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.House1), { hour: 12, isActiveQuestBuilding: () => true }));
  // ships need ownership
  assert.ok(!buildingIsUnlocked(b(BUILDING_TYPES.Ship), { hour: 12 }));
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.Ship), { hour: 12, ownsShip: true }));
  // the lock value is quality/2 (:675 - DFU's own placeholder, cited)
  assert.equal(buildingLockValue(12), 6);
  assert.equal(buildingLockValue(20), 10, 'The Odd Blades stays under the magic-held 20');
});

test('R1 anti-grind: the discovery record blocks a retry until the skill RISES (PlayerGPS.cs:1099-1126)', () => {
  const locId = 'test:LockTown';
  discoverBuilding(locId, { buildingKey: 99, name: 'The Locked House', buildingType: BUILDING_TYPES.House3, quality: 10 });
  assert.equal(getLastLockpickAttempt(locId, 99), 0);
  setLastLockpickAttempt(locId, 99, 34);
  assert.equal(getLastLockpickAttempt(locId, 99), 34);
  // the exterior gate is skill <= lastAttempt - 34 blocks, 35 rolls
  assert.ok(34 <= getLastLockpickAttempt(locId, 99));
  assert.ok(!(35 <= getLastLockpickAttempt(locId, 99)));
  // an undiscovered building answers 0 and refuses the write (:1107, :1121-1122)
  assert.equal(getLastLockpickAttempt(locId, 12345), 0);
  setLastLockpickAttempt(locId, 12345, 50);
  assert.equal(getLastLockpickAttempt(locId, 12345), 0);
});

test('R1 mode: ONE global interaction mode - the singleton, the wrap, and townTalk still re-exports it', () => {
  assert.deepEqual(MODES, ['steal', 'grab', 'info', 'dialogue']);
  assert.equal(TOWN_MODES, MODES, 'townTalk re-exports the one list');
  const before = getInteractionMode();
  try {
    setInteractionMode('grab');
    assert.equal(nextInteractionMode('dialogue'), 'steal', 'Steal > Grab > Info > Talk > wrap');
    setInteractionMode('steal');
    assert.equal(getInteractionMode(), 'steal');
    assert.equal(setInteractionMode('bogus'), false, 'unknown modes refused');
    assert.equal(getInteractionMode(), 'steal');
  } finally { setInteractionMode(before); }
});

test('R1 save: the FAILED skill level rides the door record (SerializableActionDoor.cs:78/:101) - a load cannot retry the pick', () => {
  // ActionDoorData_v1 carries lockpickFailedSkillLevel
  // (SerializableGameObject.cs:329-337); SerializableActionDoor writes
  // it at :78 and restores it at :101. Without it in the port's record
  // a failed pick was retried immediately by loading the save, where
  // DFU makes you wait for the live skill to move.
  const skill = 30;
  const tallies = [], results = [];
  const mk = () => {
    const a = new ActionSystem(stubCollider(), { playerLevel: () => 5, lockpickSkill: () => skill, rolls: () => 0.99 });
    a.onLockpickTally = () => tallies.push(1);
    a.onLockpickResult = (o, ok) => results.push(ok);
    return { a, door: a.addDoor(CUBE, I, { startingLockValue: 4 }) };   // chance 35, roll 99 -> fail
  };

  const { a, door } = mk();
  assert.equal(a.attemptLockpicking(door), false);
  assert.equal(door.failedSkillLevel, 30);

  // the door record, field for field: the swing pair, the P10 lock,
  // the Move pair, and the failed skill level
  const snap = a.collectSaveData();
  assert.deepEqual(snap, [{
    key: door.key, state: 'start', t: 0,
    lock: 4, moveState: 'start', moveT: 0, failedSkillLevel: 30,
  }]);

  // the load REBUILDS the location, so restore onto a fresh graph
  const fresh = mk();
  assert.equal(fresh.door.failedSkillLevel, 0, 'the rebuilt door really starts clean');
  fresh.a.restoreSaveData(snap);
  assert.equal(fresh.door.failedSkillLevel, 30);
  // ...and the gate at :157 is silent again: no tally, no roll, no message
  const talliesBefore = tallies.length, resultsBefore = results.length;
  assert.equal(fresh.a.attemptLockpicking(fresh.door), false);
  assert.equal(tallies.length, talliesBefore, 'save-scumming the load does not buy a second attempt');
  assert.equal(results.length, resultsBefore);
  assert.equal(fresh.door.currentLockValue, 4);
});

test('R1 save: failedSkillLevel is PRESENCE-GATED - a pre-fix snapshot leaves the live record alone', () => {
  // Every field past {state, t} is additive, the shape this save layer
  // uses everywhere: a snapshot written before the field existed must
  // not zero a live failure record and hand back a free retry.
  const a = new ActionSystem(stubCollider(), { playerLevel: () => 5, lockpickSkill: () => 30, rolls: () => 0.99 });
  const door = a.addDoor(CUBE, I, { startingLockValue: 4 });
  a.attemptLockpicking(door);
  assert.equal(door.failedSkillLevel, 30);
  const legacy = a.collectSaveData().map(({ failedSkillLevel, ...rest }) => rest);
  assert.equal('failedSkillLevel' in legacy[0], false);
  a.restoreSaveData(legacy);
  assert.equal(door.failedSkillLevel, 30, 'the live record stands');
});
