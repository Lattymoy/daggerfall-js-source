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
  OPEN_HOURS, CLOSE_HOURS, classicBuildingOpen, buildingHoursState, onlineReliefBuilding,
  SHOP_STAFFING, isBuildingOpen, buildingIsUnlocked, buildingLockValue,
  LOCKED_EXTERIOR_DOOR_TEXT,
} from '../src/systems/buildingLocks.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { setSharedClock, sharedClockOn } from '../src/systems/worldTick.js';   // OL4 (AUDIT ALL O1): the PRODUCTION default is the shared clock
import { readFileSync } from 'node:fs';
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

  // OL4: the classic primitive remains exactly the same while the
  // effective online schedule adds a staffed shift for SHOPS only.
  assert.equal(classicBuildingOpen(BUILDING_TYPES.Alchemist, 23), false,
    'the preserved DFU law still says the alchemist is closed at 23:00');
  const afterHours = buildingHoursState(BUILDING_TYPES.Alchemist, { hour: 23, online: true });
  assert.deepEqual(afterHours, {
    open: true,
    classicOpen: false,
    staffing: SHOP_STAFFING.ONLINE_SHIFT,
  }, 'online commerce is a layer above classic hours, not a rewritten table');
  assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 23, { online: true }), true,
    'the entry-time shop latch reads the effective online answer');
  assert.equal(isBuildingOpen(BUILDING_TYPES.House2, 23, { online: true }), false,
    'online staffing does not flatten residence hours');
  assert.equal(isBuildingOpen(BUILDING_TYPES.Palace, 23, { online: true }), false,
    'online staffing does not flatten palace hours');

  // OL5 (Mac, 2026-09-20): the guild hall JOINS the relief, and nothing else
  // does. Held as a SWEEP over every building type rather than a list of the
  // ones that changed - an enumeration would go stale the moment a type was
  // added, and the point of the predicate is that it is the only place the
  // membership is written down.
  assert.equal(onlineReliefBuilding(BUILDING_TYPES.GuildHall), true);
  const relieved = [];
  for (let t = 0; t < OPEN_HOURS.length; t++) {
    if (onlineReliefBuilding(t)) relieved.push(t);
    // the thing that actually matters to a player: whichever types are
    // relieved, a relieved one is enterable at 3am online and an unrelieved
    // one answers exactly what classic answers.
    const online3 = isBuildingOpen(t, 3, { online: true });
    if (onlineReliefBuilding(t)) assert.equal(online3, true, `type ${t} is relieved and must open at 3am online`);
    else assert.equal(online3, classicBuildingOpen(t, 3), `type ${t} is not relieved - online must not change its answer at all`);
  }
  assert.ok(relieved.includes(BUILDING_TYPES.GuildHall), 'the guild hall is in the relieved set');
  assert.ok(!relieved.includes(BUILDING_TYPES.House1) && !relieved.includes(BUILDING_TYPES.House2)
    && !relieved.includes(BUILDING_TYPES.Palace) && !relieved.includes(BUILDING_TYPES.Ship),
    'residences, palaces and ships keep R1 whole');

  // The staffing answer follows the widened subject, so a later night-clerk
  // slice can tell a staffed guild hall from a classic one.
  assert.equal(buildingHoursState(BUILDING_TYPES.GuildHall, { hour: 3, online: true }).staffing, SHOP_STAFFING.ONLINE_SHIFT);
  assert.equal(buildingHoursState(BUILDING_TYPES.GuildHall, { hour: 12, online: true }).staffing, SHOP_STAFFING.CLASSIC);
  assert.equal(buildingHoursState(BUILDING_TYPES.GuildHall, { hour: 3, online: true }).classicOpen, false,
    'and the preserved classic answer is still beside it');

  // Suns Rest is a SHOP closure in DFU and stays one - the holiday must not
  // start shutting guild halls just because they joined the relief.
  assert.equal(buildingHoursState(BUILDING_TYPES.GuildHall, { hour: 12, holidayId: HOLIDAYS.Suns_Rest, online: false }).open, true,
    'Suns Rest never shut a guild hall in classic and must not start now');

  // OL5: the GuildHall arm THREADS `online` - it read the module default
  // before, so an explicit `online` handed to buildingIsUnlocked was ignored
  // by this one arm. Pinned by driving the two answers apart.
  const hall = { buildingType: BUILDING_TYPES.GuildHall, factionId: 41, buildingKey: 7, quality: 12 };
  const noAnytime = { guildForBuilding: () => ({ hallAccessAnytime: false, isMember: false }) };
  assert.equal(buildingIsUnlocked(hall, { hour: 3, online: true, ...noAnytime }), true);
  assert.equal(buildingIsUnlocked(hall, { hour: 3, online: false, ...noAnytime }), false);
});

test('R1 unlocked ladder: guild bypasses, the quest override, Suns Rest, ships (PlayerActivate.cs:1258-1312)', () => {
  const b = (buildingType, factionId = 0) => ({ buildingType, factionId, buildingKey: 7, quality: 12 });
  // shops: open by hours, CLOSED on Suns Rest whatever the hour offline
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.Alchemist), { hour: 12, online: false }));
  assert.ok(!buildingIsUnlocked(b(BUILDING_TYPES.Alchemist), { hour: 12, holidayId: HOLIDAYS.Suns_Rest, online: false }));
  assert.ok(!buildingIsUnlocked(b(BUILDING_TYPES.Alchemist), { hour: 3, online: false }), 'offline still has the classic closed hours');
  // OL4: online commerce is continuously staffed, including the classic
  // night and holiday closures. The classic result remains available
  // through buildingHoursState/classicBuildingOpen above.
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.Alchemist), { hour: 3, online: true }), 'the online night shift did not open the shop');
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.Alchemist), { hour: 12, holidayId: HOLIDAYS.Suns_Rest, online: true }), 'Suns Rest shut the shared-world shop for a real-time day');
  // guild hall at 3am OFFLINE: only anytime access opens it. This pin read
  // `online: true` until OL5 and asserted the door stayed shut - OL4 stopped
  // at storefronts deliberately and said so. Mac reversed that on 2026-09-20
  // ("guild services... should all be open at night time online mode"), so the
  // pin is inverted rather than deleted: the classic answer is still held here,
  // and the departure is held beside it.
  assert.ok(!buildingIsUnlocked(b(BUILDING_TYPES.GuildHall, 41), { hour: 3, online: false, guildForBuilding: () => ({ hallAccessAnytime: false, isMember: true }) }));
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.GuildHall, 41), { hour: 3, online: false, guildForBuilding: () => ({ hallAccessAnytime: true, isMember: true }) }));
  // OL5: online the hall keeps the relief shift, with no anytime access and no
  // membership needed to reach the DOOR (what is sold inside is still the
  // guild's own business - canAccessService is rank and membership, untouched).
  assert.ok(buildingIsUnlocked(b(BUILDING_TYPES.GuildHall, 41), { hour: 3, online: true, guildForBuilding: () => ({ hallAccessAnytime: false, isMember: false }) }),
    'OL5: a guild hall is staffed around the clock in the shared world');
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
  // THE WORD ITSELF: PlayerActivate.cs:527 pops `lockedExteriorDoor`
  // verbatim, and the row is Internal_Strings.csv:534 - one word, not
  // a sentence. Asserting the constant against itself would pin
  // nothing, so the row's text is written out here.
  assert.equal(LOCKED_EXTERIOR_DOOR_TEXT, 'Locked.');
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

test('OL4 (AUDIT ALL O1/O2): the PRODUCTION default is the shared clock - no caller passes `online`, so with the clock installed a shop opens at 23:00 through both doors and a residence does not, and with it gone the classic answer returns; the positional hour wins over an `hour` in opts; a restored interior never loses the saved latch and gains the effective hours', () => {
  assert.equal(sharedClockOn(), false);
  const shop = { buildingType: BUILDING_TYPES.Alchemist, factionId: 0, buildingKey: 7, quality: 12 };
  assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 23), false, 'offline: closed at 23:00 (the entry latch and the people pass no opts)');
  assert.equal(buildingIsUnlocked(shop, { hour: 23 }), false, 'offline: the door (worldModes passes no `online`)');
  try {
    setSharedClock(() => 5 * 1440 + 23 * 60);
    assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 23), true, 'the clock standing, the shop is on its shift with no caller saying so');
    assert.equal(buildingIsUnlocked(shop, { hour: 23 }), true, 'and its door opens');
    assert.equal(buildingIsUnlocked(shop, { hour: 12, holidayId: HOLIDAYS.Suns_Rest }), true, 'Suns Rest too');
    assert.equal(isBuildingOpen(BUILDING_TYPES.House2, 23), false, 'a residence keeps R1');
    assert.equal(isBuildingOpen(BUILDING_TYPES.Bank, 23), false, 'the bank keeps its hours online (recorded as a follow-up)');
    assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 23, { hour: 12 }), true, 'the seam\'s contract: the positional hour wins - 23 is the hour asked, open by the shift'); assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 12, { hour: 23, online: false }), true, 'and 12 offline is open by the classic table, whatever opts says');
  } finally { setSharedClock(null); }
  assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 23), false, 'the clock gone, the classic answer');
  const bl = readFileSync(new URL('../src/systems/buildingLocks.js', import.meta.url), 'utf8');
  assert.equal(/isOnlinePage/.test(bl), false, 'the URL is not the predicate: the clock is (one home with RESTX2, OL3, ECON1)');
  assert.equal((bl.match(/online = sharedClockOn\(\)/g) ?? []).length, 2, 'both defaults read the clock');
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.ok(wm.includes("insideOpenShop = !!interiorBuilding?.insideOpenShop\n          || (interiorBuilding?.buildingType != null && isShop(interiorBuilding.buildingType) && isBuildingOpen(interiorBuilding.buildingType, _hour));"), 'O2: a restored interior keeps the saved latch and adds the effective hours - a session that begins inside a closed shop online stands its clerk and sells, not steals');
});
