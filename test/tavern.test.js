// U39: the tavern law against DaggerfallTavernWindow.cs +
// FormulaHelper.CalculateRoomCost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOO_MANY_DAYS_ID, OFFER_PRICE_ID, NOT_ENOUGH_GOLD_ID,
  HOW_MANY_DAYS_ID, HOW_MANY_ADDITIONAL_DAYS_ID,
  TAVERN_MENU, TAVERN_PRICES, MAX_RENTAL_DAYS, HEARTS_DAY,
  ROOM_COST_PER_DAY, EAT_INTERVAL_MINUTES,
  calculateRoomCost, removeExpiredRooms, findRentedRoom, daysAlreadyRented, roomRemainingHours,
  rentalDecision, rentRoom, canEat, eatOrDrink,
} from '../src/systems/tavern.js';
import { HOLIDAYS, holidayDayOfYear, getHolidayId } from '../src/systems/holidays.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import {
  createSceneCache, containsPermanentScene, interiorSceneName,
  cacheScene, clearSceneCache,
} from '../src/systems/sceneCache.js';

/** A date whose dayOfYear is `n` (month*30 + day+1). */
const dateOfYearDay = (n) => ({ year: 405, month: Math.floor((n - 1) / 30), day: (n - 1) % 30 });

test('U39: the constants and the menu are DFU\'s (:37-50, :188, :1869)', () => {
  assert.equal(TOO_MANY_DAYS_ID, 16);
  assert.equal(OFFER_PRICE_ID, 262);
  assert.equal(NOT_ENOUGH_GOLD_ID, 454);
  assert.equal(HOW_MANY_DAYS_ID, 5102);
  assert.equal(HOW_MANY_ADDITIONAL_DAYS_ID, 5100);
  assert.equal(MAX_RENTAL_DAYS, 350);
  assert.equal(ROOM_COST_PER_DAY, 7);
  assert.equal(EAT_INTERVAL_MINUTES, 240);
  assert.deepEqual([...TAVERN_PRICES], [1, 1, 2, 3, 1, 1, 2, 3, 2, 2, 3]);
  // the menu carries its prices IN the words, so the two tables must
  // agree - a mismatch is the bug where Stew says 3 and charges 2
  assert.equal(TAVERN_MENU.length, TAVERN_PRICES.length);
  TAVERN_MENU.forEach((label, i) => {
    const said = Number(/\((\d+) gold\)/.exec(label)?.[1]);
    assert.equal(said, TAVERN_PRICES[i], `${label} charges what it says`);
  });
  // and Heart's Day really is the day the formula names
  assert.equal(HEARTS_DAY, 46);
  // NOTE the accessor: the tables are indexed by enum-1 (GetHolidayId
  // returns its loop counter PLUS ONE), so reading them with the enum
  // value lands on the NEXT holiday. holidayDayOfYear exists because
  // this test made that mistake first.
  assert.equal(holidayDayOfYear(HOLIDAYS.Hearts_Day), HEARTS_DAY,
    'the holiday table and the room formula name the same day');
});

test('U39: CalculateRoomCost - the Heart\'s Day arm is a SPAN, not a "today is" (:1858-1875)', () => {
  const after = dateOfYearDay(100);
  assert.deepEqual(calculateRoomCost(3, after), { cost: 21, freeForHeartsDay: false });
  // starting the day BEFORE and running past it loses one day's charge
  assert.equal(calculateRoomCost(3, dateOfYearDay(45)).cost, 14);
  // ...but a stay that ENDS exactly on Heart's Day does not span it
  assert.equal(calculateRoomCost(1, dateOfYearDay(45)).cost, 7,
    '45 + 1 = 46 is not > 46 - the strict inequality is the law');
  // renting ONLY Heart's Day is free, and DFU says so with its own line
  assert.deepEqual(calculateRoomCost(1, dateOfYearDay(HEARTS_DAY)), { cost: 0, freeForHeartsDay: true });
  // a long stay starting well before still only loses the ONE day
  assert.equal(calculateRoomCost(10, dateOfYearDay(40)).cost, 7 * 9);
  // the accepted { dayOfYear } shape works too (the guild law's idiom)
  assert.equal(calculateRoomCost(3, { year: 405, dayOfYear: 45 }).cost, 14);
});

test('U39: the rental ceiling counts days ALREADY rented, and never credits an expired room', () => {
  const now = 1000 * MINUTES_PER_DAY;
  const room = { mapId: 1, buildingKey: 7, expiryMinutes: now + 300 * MINUTES_PER_DAY };
  assert.equal(daysAlreadyRented(room, now), 300);
  assert.equal(daysAlreadyRented(null, now), 0);
  // an EXPIRED room clamps to 0 rather than crediting negative days
  // against the ceiling (:183-184)
  const expired = { expiryMinutes: now - 50 * MINUTES_PER_DAY };
  assert.equal(daysAlreadyRented(expired, now), 0);
  // 300 already + 50 more is exactly 350 - allowed; 51 is not
  assert.equal(rentalDecision('50', { room, nowMinutes: now, date: dateOfYearDay(100) }).kind, 'offer');
  assert.equal(rentalDecision('51', { room, nowMinutes: now, date: dateOfYearDay(100) }).kind, 'tooMany');
});

test('U39: the decision ladder, in DFU\'s ORDER (:172-207)', () => {
  const date = dateOfYearDay(100), now = 0;
  // unparseable or under a day does NOTHING - not an error box
  for (const bad of ['', 'abc', '0', '-3']) {
    assert.equal(rentalDecision(bad, { date, nowMinutes: now }).kind, 'ignore', `"${bad}"`);
  }
  // a knight's room is free
  assert.deepEqual(rentalDecision('2', { date, nowMinutes: now, free: true }), { kind: 'free', days: 2 });
  // THE ORDER IS LOAD-BEARING: the 350-day ceiling is tested BEFORE
  // the knightly exemption, so even a free room cannot be booked past
  // it. Swapping the two arms is the mutant this kills.
  assert.equal(rentalDecision('400', { date, nowMinutes: now, free: true }).kind, 'tooMany');
  // otherwise an offer, priced through the shop quality
  const offer = rentalDecision('2', { date, nowMinutes: now, quality: 10 });
  assert.equal(offer.kind, 'offer');
  assert.equal(offer.days, 2);
  assert.ok(offer.price > 0);
  // quality moves the price (CalculateTradePrice reads it)
  const posh = rentalDecision('2', { date, nowMinutes: now, quality: 20 });
  assert.notEqual(posh.price, offer.price, 'a better inn charges differently');
});

test('U39: renting mints a record; renewing only extends it (:225-260)', () => {
  const rooms = [];
  const now = 500 * MINUTES_PER_DAY;
  const fresh = rentRoom(rooms, {
    room: null, days: 3, nowMinutes: now, mapId: 2, buildingKey: 9,
    name: 'The Odd Blades', bedCount: 4, rolls: () => 0.5,
  });
  assert.equal(rooms.length, 1);
  assert.equal(fresh.expiryMinutes, now + 3 * MINUTES_PER_DAY);
  assert.equal(fresh.allocatedBedIndex, 2, 'the bed is picked from the marker COUNT');
  assert.equal(fresh.name, 'The Odd Blades');
  // a renewal extends the SAME record - no second room at one inn
  const again = rentRoom(rooms, { room: fresh, days: 2, nowMinutes: now });
  assert.equal(rooms.length, 1);
  assert.equal(again, fresh);
  assert.equal(fresh.expiryMinutes, now + 5 * MINUTES_PER_DAY);
  // lookup is by map AND building - two inns can be rented at once
  rentRoom(rooms, { room: null, days: 1, nowMinutes: now, mapId: 2, buildingKey: 11, name: 'Other', rolls: () => 0 });
  assert.equal(findRentedRoom(rooms, 2, 9), fresh);
  assert.equal(findRentedRoom(rooms, 2, 11).name, 'Other');
  assert.equal(findRentedRoom(rooms, 3, 9), null, 'a different MAP is a different room');
  // and the expiry sweep drops only what has run out
  const swept = removeExpiredRooms(rooms, now + 2 * MINUTES_PER_DAY);
  assert.deepEqual(swept.map((r) => r.buildingKey), [9], 'the one-day room is gone, the five-day one stays');
});

test('U39: GetRemainingHours CEILS, so a room with minutes left still has an hour (:268-275)', () => {
  const now = 1000 * MINUTES_PER_DAY;
  // the ceiling is the whole point: DFU's sweep drops a room whose
  // remaining HOURS are < 1, and a ceiling makes that true only when
  // no time at all is left. A floor here would evict a player from
  // the room they are standing in, up to 59 minutes early.
  assert.equal(roomRemainingHours({ expiryMinutes: now + 1 }, now), 1, 'one minute reads as one hour');
  assert.equal(roomRemainingHours({ expiryMinutes: now + 59 }, now), 1);
  assert.equal(roomRemainingHours({ expiryMinutes: now + 60 }, now), 1, 'and exactly an hour is still one');
  assert.equal(roomRemainingHours({ expiryMinutes: now + 61 }, now), 2);
  assert.equal(roomRemainingHours({ expiryMinutes: now }, now), 0, 'nothing left is zero, not one');
  // Math.ceil of a negative fraction is -0, which strict equality
  // tells apart from 0 - so the assertion is the LAW's own test
  // (`< 1`), not an identity that would trip over a signed zero.
  assert.ok(roomRemainingHours({ expiryMinutes: now - 1 }, now) < 1,
    'a room a minute past its expiry is gone');
  assert.ok(roomRemainingHours({ expiryMinutes: now - 5000 }, now) < 1);
  // null is DFU's own -1 sentinel, not 0 - a caller cannot confuse
  // "no room" with "an expired room"
  assert.equal(roomRemainingHours(null, now), -1);
  // the sweep IS that predicate: a room with a single minute survives
  const alive = { buildingKey: 1, expiryMinutes: now + 1 };
  const dead = { buildingKey: 2, expiryMinutes: now };
  assert.deepEqual(removeExpiredRooms([alive, dead], now).map((r) => r.buildingKey), [1]);
});

test('U39: the hunger gate is four game hours (:287)', () => {
  assert.equal(canEat(0, 239), false);
  assert.equal(canEat(0, 240), true, 'exactly four hours is enough - >= is the law');
  assert.equal(canEat(1000, 1000 + EAT_INTERVAL_MINUTES), true);
  assert.equal(canEat(undefined, 240), true, 'never eaten reads as long ago');
});

test('U39: the two HOLIDAY arms, DFU\'s own and neither matching its description (:305-334)', () => {
  // Day FIVE - deliberately not day 1, which is New Life itself and
  // silently made the first draft of this test buy a free meal and
  // still expect to pay for it.
  const ordinaryDay = 4 * MINUTES_PER_DAY + 60;
  // an ordinary day: pay the menu price, heal twice it
  assert.deepEqual(eatOrDrink(3, { gold: 100, gameMinutes: ordinaryDay }), { kind: 'ate', spend: 3, heal: 6 });
  // too poor
  assert.deepEqual(eatOrDrink(3, { gold: 2, gameMinutes: ordinaryDay }), { kind: 'poor' });
  // an out-of-range pick is ignored, not priced as undefined
  assert.equal(eatOrDrink(99, { gold: 100 }).kind, 'ignore');

  // find a minute inside each holiday, from the shipped table
  const minuteOfDay = (doy) => (doy - 1) * MINUTES_PER_DAY + 60;
  assert.equal(getHolidayId(ordinaryDay, 0), HOLIDAYS.None, 'day five really is quiet');
  const newLifeMinute = minuteOfDay(holidayDayOfYear(HOLIDAYS.New_Life));
  const harvestMinute = minuteOfDay(holidayDayOfYear(HOLIDAYS.Harvest_End));

  // NEW LIFE: everything free - the gold test is SKIPPED as well as
  // the charge, so a penniless player still eats
  const nl = eatOrDrink(3, { gold: 0, gameMinutes: newLifeMinute });
  assert.deepEqual(nl, { kind: 'ate', spend: 0, heal: 6 },
    'free, and it heals as if bought - DFU never re-reads price after skipping the charge');

  // HARVEST'S END: half price with a floor of ONE, so a 1-gold ale
  // still costs 1 (`>>= 1` then `if (price == 0) price = 1`)
  assert.deepEqual(eatOrDrink(3, { gold: 100, gameMinutes: harvestMinute }),
    { kind: 'ate', spend: 1, heal: 2 }, 'a 3-gold wine halves to 1');
  assert.deepEqual(eatOrDrink(0, { gold: 100, gameMinutes: harvestMinute }),
    { kind: 'ate', spend: 1, heal: 2 }, 'a 1-gold ale does NOT become free');
  // and the halved price is what the healing doubles - not the menu one
  assert.equal(eatOrDrink(3, { gold: 100, gameMinutes: harvestMinute }).heal, 2);
  assert.equal(eatOrDrink(3, { gold: 100, gameMinutes: ordinaryDay }).heal, 6);
});

test('U39/P1: renting HOLDS the room\'s interior; expiry releases it (:246, PlayerEntity:261)', () => {
  // The flag U39 filed said a rented room's CONTENTS were not
  // preserved because the port had no permanent-scene set. P1 built
  // one, so this is the flag being spent rather than restated.
  const cache = createSceneCache();
  const rooms = [];
  const now = 500 * MINUTES_PER_DAY;
  const scene = interiorSceneName(2, 9);

  rentRoom(rooms, {
    room: null, days: 3, nowMinutes: now, mapId: 2, buildingKey: 9,
    name: 'The Odd Blades', bedCount: 4, rolls: () => 0.5, sceneCache: cache,
  });
  assert.equal(containsPermanentScene(cache, scene), true, 'the room is held while rented');
  // ...so anything left inside survives the world moving on
  cacheScene(cache, scene, { lootContainers: [{ containerType: 5, key: 'container:0', items: ['sword'] }] });
  clearSceneCache(cache, { start: false });
  assert.ok(cache.scenes.has(scene), 'and its contents outlive the clear');

  // a RENEWAL holds it again rather than dropping it
  rentRoom(rooms, { room: rooms[0], days: 2, nowMinutes: now, sceneCache: cache });
  assert.equal(containsPermanentScene(cache, scene), true);

  // and the expiry sweep RELEASES it - the landlord clears the room
  removeExpiredRooms(rooms, now + 10 * MINUTES_PER_DAY, cache);
  assert.equal(containsPermanentScene(cache, scene), false, 'an expired room is no longer held');
  // the sweep still works with no cache handed in - every existing
  // caller passes none
  assert.doesNotThrow(() => removeExpiredRooms([{ mapId: 1, buildingKey: 1, expiryMinutes: 0 }], 100));
});
