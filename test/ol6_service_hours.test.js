// OL6 (2026-10-07, bible/06-Systems/Online-Waits.md WAIT1; Mac: "Take care of this", over the sweep of the waits still
// long online): THE BANK, THE LIBRARY AND THE PALACE KEEP THE SHARED WORLD'S HOURS. OL4 gave storefronts the relief
// shift and OL5 the guild hall, for one reason: an online player cannot move the shared clock, so a classic schedule is
// a real-time lockout. Read on the sky's hour (TIME1) and a one-hour sky day (SKY-SLOW), DFU's 8-15 shut the bank
// forty-two and a half minutes of every real hour - deposits, loans, letters of credit, the Marks exchange, a ship's
// sale - the palace's 10-16 its court forty-five, the library's 9-23 twenty-five. OL4's own record named the bank and
// the library as the follow-up; the palace joins them. Offline, DFU's hours whole; residences and the house for sale
// keep R1 online.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPEN_HOURS, CLOSE_HOURS, classicBuildingOpen, buildingHoursState, onlineReliefBuilding, SHOP_STAFFING,
  isBuildingOpen, buildingIsUnlocked,
} from '../src/systems/buildingLocks.js';
import { peopleAreVisible, updateNpcPresence } from '../src/characters/interiorPeople.js';
import { isShop } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { HOLIDAYS } from '../src/systems/holidays.js';
import { setSharedClock } from '../src/systems/worldTick.js';
import { skyMinutesPerMsAt } from '../src/net/skyLaw.js';

afterEach(() => { setSharedClock(null); });

const ADDED = Object.freeze([BUILDING_TYPES.Bank, BUILDING_TYPES.Library, BUILDING_TYPES.Palace]);
const at = (type) => ({ buildingType: type, factionId: 0, buildingKey: 3, quality: 10 });

test('OL6: the relieved set is the shops, the guild hall, the bank, the library and the palace - exactly, swept over every building type', () => {
  const relieved = [];
  const want = [];
  for (let t = 0; t < OPEN_HOURS.length; t++) {
    if (onlineReliefBuilding(t)) relieved.push(t);
    if (isShop(t) || t === BUILDING_TYPES.GuildHall || ADDED.includes(t)) want.push(t);
  }
  assert.deepEqual(relieved, want);
  for (const t of [BUILDING_TYPES.HouseForSale, BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3,
    BUILDING_TYPES.House4, BUILDING_TYPES.Temple, BUILDING_TYPES.Tavern, BUILDING_TYPES.Ship]) {
    assert.equal(onlineReliefBuilding(t), false, `type ${t} keeps R1 online`);
  }
});

test('OL6: at every hour each of the three is open online through both doors - the shift where DFU is shut, the classic answer kept beside it - and offline answers DFU\'s hours (PlayerActivate.cs:91-106) whole', () => {
  for (const type of ADDED) {
    let shut = 0;
    for (let hour = 0; hour < 24; hour++) {
      const classic = classicBuildingOpen(type, hour);
      if (!classic) shut++;
      assert.deepEqual(buildingHoursState(type, { hour, online: true }), {
        open: true, classicOpen: classic, staffing: classic ? SHOP_STAFFING.CLASSIC : SHOP_STAFFING.ONLINE_SHIFT,
      }, `type ${type} at ${hour}:00 online`);
      assert.equal(isBuildingOpen(type, hour, { online: false }), classic, `type ${type} at ${hour}:00 offline`);
      // THREADED: no shared clock is installed here, so the door's `online: true` is the caller's word alone - the ladder's
      // other-structures arm read the module default before OL6 and would answer the classic hours
      assert.equal(buildingIsUnlocked(at(type), { hour, online: true }), true, `the door, type ${type} at ${hour}:00 online`);
      assert.equal(buildingIsUnlocked(at(type), { hour, online: false }), classic, `the door, type ${type} at ${hour}:00 offline`);
    }
    assert.equal(shut, 24 - (CLOSE_HOURS[type] - OPEN_HOURS[type]), `DFU shuts type ${type} ${shut} hours a day`);
  }
  // ...and the other way: the clock standing, an explicit `online: false` is still the classic answer at the door
  setSharedClock(() => 5 * 1440 + 3 * 60);
  for (const type of ADDED) assert.equal(buildingIsUnlocked(at(type), { hour: 3, online: false }), false);
});

test('OL6: the production default is the shared clock - with it standing and no caller saying so, the three open at 03:00 and their people stand (AddPeople\'s tail and UpdateNpcPresence read the effective hours); with it gone, DFU\'s; a residence keeps R1 either way', () => {
  for (const type of ADDED) {
    assert.equal(isBuildingOpen(type, 3), false, `offline: type ${type} shut at 03:00`);
    assert.equal(buildingIsUnlocked(at(type), { hour: 3 }), false);
    assert.equal(peopleAreVisible(at(type), { hour: 3 }), false);
    assert.equal(updateNpcPresence(type, { hour: 3 }), false);
  }
  setSharedClock(() => 5 * 1440 + 3 * 60);
  for (const type of ADDED) {
    assert.equal(isBuildingOpen(type, 3), true, `the clock standing: type ${type} on its shift`);
    assert.equal(buildingIsUnlocked(at(type), { hour: 3 }), true, 'and its door opens');
    assert.equal(peopleAreVisible(at(type), { hour: 3 }), true, 'and its people stand - the clerk, the scholar, the court');
    assert.equal(updateNpcPresence(type, { hour: 3 }), true);
  }
  assert.equal(peopleAreVisible(at(BUILDING_TYPES.House2), { hour: 3 }), false, 'a residence keeps R1 online');
  assert.equal(buildingIsUnlocked(at(BUILDING_TYPES.HouseForSale), { hour: 3 }), false, 'the house for sale keeps R1 online');
});

test('OL6: why - on the sky DFU\'s hours were a real-time lockout of 42.5 minutes in every real hour at the bank, 45 at the palace, 25 at the library', () => {
  const realMinutesPerGameHour = 60 / (skyMinutesPerMsAt(Date.UTC(2026, 9, 7)) * 60_000);   // the sky's rate since SKY-SLOW
  assert.equal(realMinutesPerGameHour, 2.5);
  const lockout = (type) => (24 - (CLOSE_HOURS[type] - OPEN_HOURS[type])) * realMinutesPerGameHour;
  assert.equal(lockout(BUILDING_TYPES.Bank), 42.5);
  assert.equal(lockout(BUILDING_TYPES.Palace), 45);
  assert.equal(lockout(BUILDING_TYPES.Library), 25);
});

test('OL6 (AUDIT WAITS O1): DFU\'s own rows for the three, as PlayerActivate.cs:91-106 has them - the bank 8 to 15, the library 9 to 23, the palace 10 to 16 - and Suns Rest, a SHOP closure, shuts none of them, offline or online', () => {
  assert.deepEqual(ADDED.map((t) => [OPEN_HOURS[t], CLOSE_HOURS[t]]), [[8, 15], [9, 23], [10, 16]]);
  for (const type of ADDED) {
    for (const online of [false, true]) {
      assert.deepEqual(buildingHoursState(type, { hour: OPEN_HOURS[type], holidayId: HOLIDAYS.Suns_Rest, online }),
        { open: true, classicOpen: true, staffing: SHOP_STAFFING.CLASSIC }, `type ${type} on Suns Rest at its opening hour, ${online ? 'online' : 'offline'}`);
    }
    assert.equal(buildingHoursState(type, { hour: CLOSE_HOURS[type], holidayId: HOLIDAYS.Suns_Rest, online: false }).open, false,
      `type ${type} shuts at its own hour on the holiday offline, not before`);
  }
  // a shop beside them: Suns Rest shuts it in DFU, and online the shift covers the holiday as it covers the night (OL4)
  assert.equal(buildingHoursState(BUILDING_TYPES.Alchemist, { hour: 12, holidayId: HOLIDAYS.Suns_Rest, online: false }).open, false);
  assert.deepEqual(buildingHoursState(BUILDING_TYPES.Alchemist, { hour: 12, holidayId: HOLIDAYS.Suns_Rest, online: true }),
    { open: true, classicOpen: false, staffing: SHOP_STAFFING.ONLINE_SHIFT });
});
