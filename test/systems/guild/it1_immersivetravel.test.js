// IT1 (2026-10-04, the owner: "Actually lets let this be the next mod we integrate 1:1"): IMMERSIVE TRAVEL 1.5, by
// kkgobkk - carriages at the city gates, a driver's Fast Travel, a ship captain's passage. The port's law is the
// release's assembly's IL (Immersive Travel 1.5's, IL_xxxx); every pin here names the offsets it holds the port to, and
// the mod's own bugs are pinned as it ships them (bible/06-Systems/Immersive-Travel.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  IMMERSIVE_TRAVEL_VENDOR, IT_FACTIONS, CARRIAGE_DRIVERS_FACTION_ID, SAILORS_FACTION_ID, IT_SERVICE_LABEL, IT_TEXT, IT_POPUP,
  readImmersiveTravelSettings, isDestinationValid, borderingRegionIndex, isCapital, carriageRefusal, carriageLocationLarge,
  carriageTripCost, hasDock, nearDock, isPlayerInTownForShips, seafarerRefusal, seafarerLocationLarge, seafarerDiscovered,
  seafarerTravelTime, seafarerTripCost, itPopUpDefaults, playerPopUpRefusal, itTogglePress, itTrip, itMapRefusal, itMapPaths,
  immersiveTravelService, installImmersiveTravel, _resetImmersiveTravel, CAPITAL_MAP_IDS, LARGE_DOCK_MAP_IDS, DOCK_PIXEL_IDS,
} from '../../../src/systems/immersiveTravel.js';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings, onlineModSetting } from '../../../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_WHOLE_MODS } from '../../../src/systems/online/onlineLane.js';
import { LOCATION_TYPES as T } from '../../../src/formats/mapsFile.js';
import { customFactions, _resetCustomFactions } from '../../../src/formats/factionFile.js';
import { getCustomMerchantService, getCustomMerchantServiceLabel, hasCustomMerchantService, _resetMerchantServices } from '../../../src/systems/guild/guildServices.js';
import { calculateTripCost, calculateTravelTime } from '../../../src/systems/travel/travel.js';
import { guildFastTravel } from '../../../src/systems/guild/guildVariants.js';
import { TravelPopUpWindow } from '../../../src/ui/travel/travelPopUp.js';
import { staticNpcRoute } from '../../../src/systems/guild/guildServiceFlow.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** OWN-WORK2 (2026-10-31): Immersive Travel 1.5's modsettings.json, written out - its copy left the tree. Each key:
 *  [section.name, the shipped value, the author's description as shipped, a slider's [min, max]]. */
const SHIPPED = [
  ['General.DisableNormalTravel', true, 'If this option is eabled, you will no longer be able to travel from the map and you will have to use ONLY carriages and ships.'],
  ['General.DailyCarriageFee', 1, 'The fee you must pay to travel with a carriage for every day of travel', [0, 99]],
  ['General.ClearerMapDots', true, 'Draws larger dots depending on town size in the travel map.'],
  ['General.DrawRoads', true, 'Draw roads on the map (if the BasicRoads mod is installed and enabled).'],
  ['General.DrawTracks', true, 'Draw dirt tracks on the map (if the BasicRoads mod is installed and enabled).'],
  ['General.RegionLockedCarriages', false, 'Prevent carriages from travelling to a different region. You must travel from the capital city to leave the region.'],
  ['ShipTravel.DisableShipTravelOutsideDocks', true, 'Prevents you from choosing ship transport mode during land travel'],
  ['ShipTravel.DailyShipCost', 15, 'Daily cost of renting a ship. Only applies if the player doesn\'t own their own ship', [0, 99]],
  ['ShipTravel.DailyCaptainFee', 10, 'Daily cost of hiring a ship captain and his crew to man a ship. You will have to pay a captain even if you own the ship.', [0, 99]],
  ['ShipTravel.LimitedRangeInSmallDocks', true, 'Ships in smaller locations will only take you to ports in the same region. To travel to a different region you\'ll need to sail from a city'],
  ['ShipTravel.ShowLargerDocks', true, 'Uses larger dots on the map for loactions with a dock'],
  ['ShipTravel.ShowOnlyDocks', false, 'Hides every location on the map except those that have a dock'],
  ['AllowedDestinations.Cities', true], ['AllowedDestinations.Covens', false], ['AllowedDestinations.Dungeons', false],
  ['AllowedDestinations.Graveyards', false], ['AllowedDestinations.Farms', false], ['AllowedDestinations.Hamlets', true],
  ['AllowedDestinations.Homes', false], ['AllowedDestinations.Temples', false], ['AllowedDestinations.Taverns', false],
  ['AllowedDestinations.Villages', true],
];
/** Settings as the port ships them (the mod's own but Disable Normal Travel), with `over` laid on - no store. */
function settings(over = {}) {
  const base = Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_TRAVEL_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const all = { ...base, ...over };
  return readImmersiveTravelSettings((v, k) => (v === 'roads-hazelnut' ? all['basicRoads'] ?? true : all[k]));
}
const online = (fn) => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { search: '?online=1' };
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
};

test('IT1 the record: the settings as the release ships them, every key restated under the vendor in our own words - Disable Normal Travel shipped OFF, the one recorded departure', () => {
  const keys = MOD_SETTINGS[IMMERSIVE_TRAVEL_VENDOR].keys;
  const restated = Object.keys(keys).filter((k) => k !== 'Enabled');
  assert.deepEqual(restated, SHIPPED.map(([n]) => n), 'every key, in the file\'s order');
  // OWN-WORK4 (2026-11-01): every line the author wrote, in our own words - ours, exactly
  const PLAIN = {
    'General.DisableNormalTravel': 'Turns off travel from the map. Carriages and ships become your only fast travel.',
    'General.DailyCarriageFee': 'Gold a carriage driver charges for each day on the road.',
    'General.ClearerMapDots': 'On the carriage map, cities and hamlets get big dots and smaller places small ones.',
    'General.DrawRoads': 'The carriage map marks the roads. Needs Basic Roads.',
    'General.DrawTracks': 'The carriage map marks the dirt tracks. Needs Basic Roads.',
    'General.RegionLockedCarriages': 'A carriage keeps to its own region, unless you board it in the region’s capital.',
    'ShipTravel.DisableShipTravelOutsideDocks': 'A carriage trip is always by land. To go by sea, find a sailor at a dock.',
    'ShipTravel.DailyShipCost': 'Gold per day at sea to hire a ship. You pay nothing if you own one.',
    'ShipTravel.DailyCaptainFee': 'Gold per day at sea for a captain and crew. You pay it even on your own ship.',
    'ShipTravel.LimitedRangeInSmallDocks': 'A sailor in a small port sails only within its region. Large port cities sail anywhere.',
    'ShipTravel.ShowLargerDocks': 'On the sailor’s map, every place with a dock gets a big dot.',
    'ShipTravel.ShowOnlyDocks': 'The sailor’s map shows only places with a dock.',
  };
  for (const [name, value, words, range] of SHIPPED) {
    const def = keys[name];
    assert.equal(def.description, words ? PLAIN[name] : '', `${name}: our own words in place of the author's`);
    if (name === 'General.DisableNormalTravel') { assert.equal(value, true, 'the mod ships it on'); assert.equal(def.default, false, 'IT1: the port ships it off'); continue; }
    assert.equal(def.default, value, `${name}: the shipped default`);
    if (range) assert.deepEqual([def.min, def.max], range, `${name}: the slider's range`);
  }
  assert.equal(keys.Enabled.default, true);
});

test('IT1 the tables: the 40 capitals, the 15 large docks and the 382 dock pixels, every value held - each table\'s int32 bytes by their sha256, taken while the assembly was in the tree and found there whole, once (OWN-WORK2: its copy left it); the docks in order, each large dock a dock (mutant: a dock id moved)', () => {
  const DIGESTS = [
    ['capitals', CAPITAL_MAP_IDS, 160, 82263135, 374370979, 'fb1c608d3e254bf7cfac5b6864ecff4a228c01bb5718f583505ecba0155eeffc'],
    ['large docks', LARGE_DOCK_MAP_IDS, 60, 1306739903, 6570357, 'ad59727ec85514bb213a746bbaa516e9967f15e4865bd52cf9fb778e2b18f6c3'],
    ['docks', DOCK_PIXEL_IDS, 1528, 5222, 495141, '64b7f1c832e05db524de8ea8baf75025bd3c1bcb41b0f8e3b5289061bfc0af20'],
  ];
  for (const [name, table, bytes, first, last, sha] of DIGESTS) {
    assert.equal(table.length * 4, bytes, `${name}: the InitializeArray size (.cctor)`);
    assert.deepEqual([table[0], table.at(-1)], [first, last], `${name}: its ends`);
    assert.equal(createHash('sha256').update(Buffer.from(Int32Array.from(table).buffer)).digest('hex'), sha, `${name}: every value`);
  }
  assert.ok(DOCK_PIXEL_IDS.every((v, i, a) => i === 0 || a[i - 1] < v), 'the dock pixels ascending, each once');
  assert.ok(LARGE_DOCK_MAP_IDS.every((id) => DOCK_PIXEL_IDS.includes(id & 0xfffff)), 'a large dock\'s pixel is a dock');
});

test('IT1 Init: Carriage Drivers (8642) and Sailors (8643) as the IL writes them, and a Fast Travel service each, gated on the mod - a driver routes to the merchant popup', () => {
  assert.deepEqual(IT_FACTIONS.map((f) => [f.id, f.parent, f.type, f.name, f.summon, f.region, f.power, f.face, f.race, f.sgroup, f.ggroup]), [
    [8642, 0, 15, 'Carriage Drivers', -1, -1, 100, -1, -1, 1, 16],
    [8643, 8642, 15, 'Sailors', -1, -1, 100, -1, -1, 1, 16],
  ]);
  _resetModSettings(); _resetCustomFactions(); _resetMerchantServices(); _resetImmersiveTravel();
  try {
    assert.equal(installImmersiveTravel(), true);
    assert.equal(installImmersiveTravel(), false, 'once');
    assert.equal(customFactions().get(CARRIAGE_DRIVERS_FACTION_ID)?.name, 'Carriage Drivers');
    assert.equal(customFactions().get(SAILORS_FACTION_ID)?.parent, CARRIAGE_DRIVERS_FACTION_ID);
    for (const id of [CARRIAGE_DRIVERS_FACTION_ID, SAILORS_FACTION_ID]) {
      assert.equal(hasCustomMerchantService(id), true);
      assert.equal(getCustomMerchantServiceLabel(id), IT_SERVICE_LABEL);
    }
    // StaticNPCClick's routing: sgroup 1 is Merchants, so the custom service answers - outdoors too (no building)
    const route = staticNpcRoute({ npcFactionId: 8642, npcFaction: customFactions().get(8642), insideBuilding: false, hasCustomMerchantService });
    assert.deepEqual(route, { kind: 'merchant', service: 'sell' });
    // AUDIT IT1 W4 (PIN MOVED): the mod is loaded for the game - a switch flipped mid-game waits for the next start
    // (the dictionary took the factions once); off AT THE START, nothing (auditit1.test.js)
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', false);
    assert.equal(hasCustomMerchantService(8642), true);
    // the service body: enemies near say the line; otherwise the driver's or the captain's map
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', true);
    const said = [], opened = [];
    const door = (near) => ({ enemiesNearby: () => near, enemiesText: 'You cannot travel with enemies nearby.', messageBox: (t) => said.push(t), openImmersiveMap: (k) => { opened.push(k); return {}; } });
    getCustomMerchantService(8642)(door(true));
    assert.deepEqual([said, opened], [['You cannot travel with enemies nearby.'], []]);
    getCustomMerchantService(8642)(door(false));
    getCustomMerchantService(8643)(door(false));
    assert.deepEqual(opened, ['carriage', 'seafarer']);
    assert.equal(immersiveTravelService({ openImmersiveMap: () => null }, 'carriage'), false, 'a host with no map answers none');
  } finally { _resetModSettings(); _resetCustomFactions(); _resetMerchantServices(); _resetImmersiveTravel(); }
});

test('IT1 IsDestinationValid (IL_0a58-0b61): each type answers its own setting - and the three homes read "Dungeons", never "Homes" (the mod\'s own bug, carried)', () => {
  const none = { cities: false, covens: false, dungeons: false, graveyards: false, farms: false, hamlets: false, homes: false, temples: false, taverns: false, villages: false };
  const only = (k) => ({ ...none, [k]: true });
  const cases = [
    [T.TownCity, 'cities'], [T.TownHamlet, 'hamlets'], [T.TownVillage, 'villages'], [T.HomeFarms, 'farms'],
    [T.DungeonLabyrinth, 'dungeons'], [T.DungeonKeep, 'dungeons'], [T.DungeonRuin, 'dungeons'],
    [T.ReligionTemple, 'temples'], [T.ReligionCult, 'temples'], [T.Tavern, 'taverns'], [T.Graveyard, 'graveyards'], [T.Coven, 'covens'],
    [T.HomePoor, 'dungeons'], [T.HomeWealthy, 'dungeons'], [T.HomeYourShips, 'dungeons'],
  ];
  for (const [type, key] of cases) {
    assert.equal(isDestinationValid(type, none), false, `${type}: nothing allowed`);
    assert.equal(isDestinationValid(type, only(key)), true, `${type}: ${key} on`);
    for (const other of Object.keys(none).filter((k) => k !== key)) assert.equal(isDestinationValid(type, only(other)), false, `${type}: ${other} alone`);
  }
  assert.equal(isDestinationValid(T.HomePoor, only('homes')), false, 'Homes admits nothing');
  assert.equal(isDestinationValid(T.None, { ...none, cities: true, villages: true }), false);
  // as shipped: cities, hamlets, villages
  const s = settings();
  assert.deepEqual(Object.values(T).filter((t) => isDestinationValid(t, s.allowed)), [T.TownCity, T.TownHamlet, T.TownVillage]);
});

test('IT1 BorderingRegionIndex (IL_1398-1466): (x, y+1) asked twice, then (x+1, y), (x, y-1), (x-1, y); 31 and every region at or below 0 passed over; -1 when none answers - the player\'s own pixel never asked', () => {
  const at = (map) => (x, y) => (map[`${x},${y}`] ?? 64);   // 64: the ocean's politic, -64 as a region
  assert.equal(borderingRegionIndex(10, 10, at({ '10,11': 128 + 17, '11,10': 128 + 23 })), 17, 'y+1 first');
  assert.equal(borderingRegionIndex(10, 10, at({ '10,11': 128 + 31, '11,10': 128 + 23 })), 23, '31 is passed over');
  assert.equal(borderingRegionIndex(10, 10, at({ '10,11': 128, '10,9': 128 + 5 })), 5, 'region 0 (Alik\'r Desert) is never an answer');
  assert.equal(borderingRegionIndex(10, 10, at({ '9,10': 128 + 40 })), 40, 'x-1 last');
  assert.equal(borderingRegionIndex(10, 10, at({ '10,10': 128 + 17 })), -1, 'its own pixel is never asked');
  const asked = [];
  borderingRegionIndex(10, 10, (x, y) => { asked.push(`${x},${y}`); return 64; });
  assert.deepEqual(asked, ['10,11', '10,11', '11,10', '10,9', '9,10']);
});

test('IT1 the carriage\'s refusals (CarriageMap.CreatePopUpWindow IL_08f9-0a49): the type, then - region-locked - capital to capital, or the bordering region; the two words by where the player stands', () => {
  const capA = CAPITAL_MAP_IDS[0], capB = CAPITAL_MAP_IDS[1];
  assert.equal(isCapital(capA), true);
  assert.equal(isCapital((capA & 0xfffff) | (7 << 20)), true, 'compared masked (IL_14d0, IL_1fc8)');
  assert.equal(isCapital(12345), false);
  const politic = (r) => () => 128 + r;
  const town = { locationType: T.TownCity, mapId: 999999, regionIndex: 17 };
  const off = settings();
  const locked = settings({ 'General.RegionLockedCarriages': true });
  const ask = (s, here, dest, r) => carriageRefusal(s, { here: { x: 5, y: 5, ...here }, dest, politicAt: politic(r) });
  assert.equal(ask(off, { mapId: 1 }, { ...town, locationType: T.DungeonKeep }, 17), 'wrongType');
  assert.equal(ask(off, { mapId: 1 }, { ...town, regionIndex: 40 }, 17), null, 'not locked: anywhere');
  assert.equal(ask(locked, { mapId: 1 }, town, 17), null, 'locked: the bordering region');
  assert.equal(ask(locked, { mapId: 1 }, { ...town, regionIndex: 40 }, 17), 'regionLocked');
  assert.equal(ask(locked, { mapId: capA }, { ...town, mapId: capB, regionIndex: 40 }, 17), null, 'capital to capital');
  assert.equal(ask(locked, { mapId: capA }, { ...town, regionIndex: 40 }, 17), 'capitalOnly');
  assert.equal(ask(locked, { mapId: 1 }, { ...town, mapId: capB, regionIndex: 40 }, 17), 'regionLocked', 'to a capital, from no capital');
  assert.equal(IT_TEXT.capitalOnly, 'To reach that location, you must travel to the capital of that region and take a carriage from there.');
  assert.equal(IT_TEXT.wrongType, 'The driver won\'t take you to this type of location.');
  // the same question through the one door both skins ask
  const summary = { locationType: T.TownCity, mapID: 1, regionIndex: 40 };
  assert.equal(itMapRefusal(IT_POPUP.carriage, locked, { here: { x: 5, y: 5, mapId: 1 }, summary, politicAt: politic(17) }), 'regionLocked');
});

test('IT1 ImmersiveTravelCalculator.CalculateTripCost (IL_1d44-1e46): DFU\'s inn nights, then the fee by the day off the ocean plus one, and by ship the ship and her captain by the sea day plus one', () => {
  const s = settings();   // fee 1, ship 15, captain 10
  // no fee, no ship: exactly DFU's own bill
  for (const [mins, ocean, inns] of [[60, 0, true], [3000, 0, true], [10000, 30, true], [10000, 30, false], [1, 0, false]]) {
    const dfu = calculateTripCost(mins, ocean, { sleepModeInn: inns });
    assert.deepEqual(carriageTripCost(mins, ocean, { sleepModeInn: inns }, { ...s, dailyCarriageFee: 0 }), dfu, `${mins}/${ocean}/${inns}`);
  }
  // 3000 minutes is 50 hours: 2 days -> inns 5*2+5 = 15, fee 1*2+1 = 3
  assert.deepEqual(carriageTripCost(3000, 0, { sleepModeInn: true }, s), { piecesCost: 15, totalCost: 18 });
  assert.deepEqual(carriageTripCost(3000, 0, { sleepModeInn: false }, s), { piecesCost: 0, totalCost: 3 }, 'camping out pays the driver alone');
  assert.deepEqual(carriageTripCost(3000, 0, { sleepModeInn: true, freeTavernRooms: true }, s), { piecesCost: 0, totalCost: 3 }, 'a knight sleeps free (GetGuild(9).FreeTavernRooms)');
  // by ship, 48 ocean pixels: sea days 48/24+1 = 3 -> ship 45, captain 30; owning the ship pays the captain alone
  assert.deepEqual(carriageTripCost(3000, 48, { travelShip: true }, s), { piecesCost: 0, totalCost: 1 * 0 + 1 + 45 + 30 });
  assert.deepEqual(carriageTripCost(3000, 48, { travelShip: true, hasShip: true }, s), { piecesCost: 0, totalCost: 1 + 30 });
  assert.deepEqual(carriageTripCost(3000, 48, { travelShip: false }, s), { piecesCost: 0, totalCost: 1 }, 'no ship toggle, no sea fare');
  assert.deepEqual(carriageTripCost(0, 0, {}, { ...s, dailyCarriageFee: 7 }), { piecesCost: 0, totalCost: 7 }, 'the plus one');
});

test('IT1 the ship captain (SeafarersMap, SeafarersCalculator): the dock pixels and their four neighbours, the small dock\'s region, 51 minutes a pixel, the ship and captain by the day', () => {
  const dock = DOCK_PIXEL_IDS[0];
  assert.equal(hasDock(dock), true);
  assert.equal(hasDock(dock | (3 << 20)), true, 'the map id is masked, the table is not');
  for (const d of [0, -1000, 1, 1000, -1]) assert.equal(nearDock(dock - d), true, `a place ${d} off a dock`);
  assert.equal(nearDock(dock + 2), DOCK_PIXEL_IDS.some((p) => [dock + 2, dock + 2 - 1000, dock + 3, dock + 1002, dock + 1].includes(p)));
  assert.equal(nearDock(1), DOCK_PIXEL_IDS.some((p) => [1, -999, 2, 1001, 0].includes(p)));
  assert.equal(isPlayerInTownForShips({ locationType: T.TownCity }), true);
  assert.equal(isPlayerInTownForShips({ locationType: T.TownHamlet }), true);
  assert.equal(isPlayerInTownForShips({ locationType: T.TownVillage, mapId: LARGE_DOCK_MAP_IDS[3] }), true, 'a large dock');
  assert.equal(isPlayerInTownForShips({ locationType: T.TownVillage, mapId: 5, regionIndex: 31 }), true, 'region 31');
  assert.equal(isPlayerInTownForShips({ locationType: T.TownVillage, mapId: 5, regionIndex: 17 }), false);
  const s = settings();
  const village = { locationType: T.TownVillage, mapId: 5, regionIndex: 17 };
  const ask = (dest, r, gps = village) => seafarerRefusal(s, { here: { x: 5, y: 5, ...gps }, gps, dest, politicAt: () => r });
  assert.equal(ask({ mapId: 1, regionIndex: 17 }, 128 + 17), nearDock(1) ? null : 'noDock');
  assert.equal(ask({ mapId: dock, regionIndex: 17 }, 128 + 17), null, 'the same region');
  assert.equal(ask({ mapId: dock, regionIndex: 40 }, 128 + 17), 'smallBoat');
  assert.equal(ask({ mapId: dock, regionIndex: 40 }, 64), null, 'no region answers: anywhere (IL_16d0)');
  assert.equal(ask({ mapId: dock, regionIndex: 40 }, 128 + 17, { ...village, locationType: T.TownCity }), null, 'a city sails anywhere');
  assert.equal(seafarerRefusal(settings({ 'ShipTravel.LimitedRangeInSmallDocks': false }), { here: { x: 5, y: 5 }, gps: village, dest: { mapId: dock, regionIndex: 40 }, politicAt: () => 128 + 17 }), null);
  // 51 minutes a step of the longest axis, halved reckless; no ocean counted
  assert.deepEqual(seafarerTravelTime({ x: 10, y: 10 }, { x: 30, y: 15 }, { speedCautious: true }), { minutes: 51 * 20, oceanPixels: 0 });
  assert.deepEqual(seafarerTravelTime({ x: 10, y: 10 }, { x: 13, y: 40 }, { speedCautious: false }), { minutes: (51 * 30) >> 1, oceanPixels: 0 });
  // 1020 minutes: 17 hours, day 0 + 1 -> ship 15 + captain 10; 3060 minutes: 51 hours, 2 + 1 days
  assert.deepEqual(seafarerTripCost(1020, {}, s), { piecesCost: 0, totalCost: 25 });
  assert.deepEqual(seafarerTripCost(3060, {}, s), { piecesCost: 0, totalCost: 75 });
  assert.deepEqual(seafarerTripCost(3060, { hasShip: true }, s), { piecesCost: 0, totalCost: 30 }, 'the captain is paid even on your own ship');
  // the map's dots: larger by a dock, only docks with ShowOnlyDocks
  assert.equal(seafarerLocationLarge({ mapID: dock, locationType: T.HomePoor }, s), true);
  assert.equal(seafarerLocationLarge({ mapID: 1, locationType: T.TownCity }, settings({ 'ShipTravel.ShowLargerDocks': false })), true, 'else the carriage map\'s');
  assert.equal(seafarerDiscovered({ id: 1 }, true, settings({ 'ShipTravel.ShowOnlyDocks': true })), nearDock(1));
  assert.equal(seafarerDiscovered({ id: dock }, true, settings({ 'ShipTravel.ShowOnlyDocks': true })), true);
  assert.equal(seafarerDiscovered({ id: dock }, false, s), false);
  assert.equal(carriageLocationLarge(T.TownVillage, s), false, 'ClearerMapDots: a village is small');
  assert.equal(carriageLocationLarge(T.TownVillage, settings({ 'General.ClearerMapDots': false })), true);
  assert.deepEqual(itMapPaths(s), [true, true, false, false]);
  assert.deepEqual(itMapPaths(settings({ basicRoads: false })), [false, false, false, false], 'BasicRoadsEnabled first (CarriageMap..cctor)');
});

test('IT1 the popups\' toggles (IL_1b07-1b85, IL_1f33-1f93): the carriage refuses a ship and its camp-out drops one; the captain refuses land and inns - and a click on the lit button is heard too', () => {
  const s = settings();
  assert.deepEqual(itPopUpDefaults(IT_POPUP.carriage, s), { speedCautious: true, travelShip: false, sleepModeInn: true });
  assert.deepEqual(itPopUpDefaults(IT_POPUP.carriage, settings({ 'ShipTravel.DisableShipTravelOutsideDocks': false })), { speedCautious: true, travelShip: true, sleepModeInn: true });
  assert.deepEqual(itPopUpDefaults(IT_POPUP.seafarer, s), { speedCautious: true, travelShip: true, sleepModeInn: false });
  // carriage
  let st = itPopUpDefaults(IT_POPUP.carriage, s);
  assert.equal(itTogglePress(IT_POPUP.carriage, st, s, 'transportClick', { ship: true }), 'mustFindShip');
  assert.equal(itTogglePress(IT_POPUP.carriage, st, s, 'transportClick', { ship: false }), 'mustFindShip', 'foot/horse too - the override reads TravelShip, not the button');
  assert.equal(itTogglePress(IT_POPUP.carriage, st, s, 'transportToggle'), 'mustFindShip');
  assert.equal(st.travelShip, false);
  assert.equal(itTogglePress(IT_POPUP.carriage, st, s, 'sleepClick', { inn: false }), null);
  assert.equal(st.sleepModeInn, false);
  const free = settings({ 'ShipTravel.DisableShipTravelOutsideDocks': false });
  st = itPopUpDefaults(IT_POPUP.carriage, free);
  assert.equal(itTogglePress(IT_POPUP.carriage, st, free, 'transportClick', { ship: false }), null);
  assert.equal(st.travelShip, false, 'the base assigns');
  st.travelShip = true;
  assert.equal(itTogglePress(IT_POPUP.carriage, st, s, 'sleepToggle', { campOutButton: true }), null);
  assert.deepEqual([st.travelShip, st.sleepModeInn], [false, false], 'the wheel over camp out drops the ship, then toggles');
  st.travelShip = true;
  itTogglePress(IT_POPUP.carriage, st, s, 'sleepToggle', { campOutButton: false });
  assert.equal(st.travelShip, true, 'N is the inn button\'s: the ship stands');
  // captain
  st = itPopUpDefaults(IT_POPUP.seafarer, s);
  for (const [press, o] of [['transportClick', { ship: false }], ['transportClick', { ship: true }], ['transportToggle', {}]]) {
    assert.equal(itTogglePress(IT_POPUP.seafarer, st, s, press, o), 'cannotDisableShip');
    assert.equal(st.travelShip, true);
  }
  for (const [press, o] of [['sleepClick', { inn: true }], ['sleepClick', { inn: false }], ['sleepToggle', { campOutButton: true }]]) {
    assert.equal(itTogglePress(IT_POPUP.seafarer, st, s, press, o), 'noInnsAtSea');
    assert.equal(st.sleepModeInn, false);
  }
  assert.equal(itTogglePress(IT_POPUP.seafarer, st, s, 'speedToggle'), null);
  assert.equal(IT_TEXT.noInnsAtSea, 'There are no inns in the middle of the sea.');
  // DisableNormalTravel: the player's own map
  assert.equal(playerPopUpRefusal(s, T.TownCity), null, 'the port ships it off');
  const dnt = settings({ 'General.DisableNormalTravel': true });
  assert.equal(playerPopUpRefusal(dnt, T.TownCity), 'mustTakeCarriage');
  assert.equal(playerPopUpRefusal(dnt, T.DungeonKeep), 'cannotTravelType');
  assert.equal(playerPopUpRefusal(dnt, null), null, 'no location summary: logged, the popup stands (IL_1a97)');
  assert.equal(playerPopUpRefusal({ ...dnt, enabled: false }, T.TownCity), null);
});

test('IT1 the trip each popup bills: DFU\'s time and the carriage\'s fare, or the captain\'s time and fare - the guild\'s blessing folded in, never Travel Options\' scaling', () => {
  const s = settings();
  const climate = () => 231;   // Mountains - no ocean
  const calc = { calculateTravelTime, guildFastTravel };
  const opts = { speedCautious: true, sleepModeInn: true, travelShip: false };
  const t = itTrip(IT_POPUP.carriage, s, { start: { x: 100, y: 100 }, end: { x: 130, y: 110 }, opts, getClimateIndex: climate, calc });
  const dfu = calculateTravelTime({ x: 100, y: 100 }, { x: 130, y: 110 }, opts, climate);
  assert.equal(t.minutes, dfu.minutes);
  assert.deepEqual([t.piecesCost, t.totalCost], Object.values(carriageTripCost(dfu.minutes, dfu.oceanPixels, opts, s)));
  const v = itTrip(IT_POPUP.seafarer, s, { start: { x: 100, y: 100 }, end: { x: 130, y: 110 }, opts: { speedCautious: false }, getClimateIndex: climate, calc });
  assert.equal(v.minutes, (51 * 30) >> 1);
  assert.equal(v.totalCost, seafarerTripCost(v.minutes, {}, s).totalCost);
});

test('IT1 the classic popup: a driver\'s is the mod\'s - its defaults, its fare, its refusal boxes; its trip is DFU\'s fast travel and says so to the host; the player\'s own under Disable Normal Travel refuses at once', () => {
  const s = settings();
  const deps = (over = {}) => ({
    getPlayerPixel: () => ({ x: 100, y: 100 }), getClimateIndex: () => 231, gold: () => 1000, goldPieces: () => 1000,
    travelOptions: () => ({ settings: { cautiousTravel: true, stopAtInnsTravel: true } }), ...over,
  });
  const p = new TravelPopUpWindow({ x: 120, y: 100 }, deps({ immersive: { kind: IT_POPUP.carriage, settings: s } }));
  assert.deepEqual([p.speedCautious, p.travelShip, p.sleepModeInn, p.walkedTrip], [true, false, true, false], 'never walked - Travel Options\' fork is not the mod popup\'s');
  assert.equal(p.trip.totalCost, carriageTripCost(p.travelTimeTotalMins, p.trip.oceanPixels, { sleepModeInn: true }, s).totalCost);
  p.input('KeyT');
  assert.equal(p.top, 'itBox', 'T is the foot/horse button\'s toggle - refused');
  p.input('Escape');
  assert.equal(p.top, 'itBox', 'nothing but OK closes it');
  p.input('KeyO');
  assert.equal(p.top, null);
  let went = null;
  const q = new TravelPopUpWindow({ x: 120, y: 100 }, deps({ immersive: { kind: IT_POPUP.carriage, settings: s }, onTravel: (pos, opts, c) => { went = { opts, c }; } }));
  q.begin();
  assert.equal(q.doFastTravel, true, 'the gold check, then DFU\'s countdown');
  for (let i = 0; i < 400 && !q.done; i++) q.tick(0.06);
  assert.equal(went?.opts.immersive, IT_POPUP.carriage);
  assert.equal(went?.c.totalCost, q.trip.totalCost);
  // the captain's
  const c = new TravelPopUpWindow({ x: 120, y: 100 }, deps({ immersive: { kind: IT_POPUP.seafarer, settings: s } }));
  assert.deepEqual([c.travelShip, c.sleepModeInn, c.travelTimeTotalMins], [true, false, 51 * 20]);
  c.input('KeyN');
  assert.equal(c.top, 'itBox');
  // the player's own map, Disable Normal Travel on: the box at once, and its OK closes the popup too
  let exited = false;
  const dnt = settings({ 'General.DisableNormalTravel': true });
  const m = new TravelPopUpWindow({ x: 120, y: 100 }, deps({ immersive: { kind: IT_POPUP.player, settings: dnt }, locationSummary: () => ({ locationType: T.TownCity }), onExit: () => { exited = true; } }));
  assert.equal(m.top, 'itPush');
  assert.equal(m._itText, IT_TEXT.mustTakeCarriage);
  m.input('Enter');
  assert.deepEqual([m.done, exited], [true, true]);
});

test('IT1 online: the mod is the room\'s and Disable Normal Travel is held off - the map stays walked, a driver\'s fare fast travel over land - every fare and rule at the mod\'s value, the map\'s looks the player\'s', () => {
  assert.deepEqual({ ...ONLINE_ROOM_MOD_KEYS[IMMERSIVE_TRAVEL_VENDOR] }, { Enabled: true, 'General.DisableNormalTravel': false });
  assert.deepEqual([...ONLINE_WHOLE_MODS[IMMERSIVE_TRAVEL_VENDOR]], ['General.ClearerMapDots', 'General.DrawRoads', 'General.DrawTracks', 'ShipTravel.ShowLargerDocks', 'ShipTravel.ShowOnlyDocks']);
  _resetModSettings();
  try {
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', false);
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'General.DisableNormalTravel', true);
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'General.DailyCarriageFee', 0);
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'AllowedDestinations.Dungeons', true);
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'General.ClearerMapDots', false);
    online(() => {
      const s = readImmersiveTravelSettings();
      assert.deepEqual([s.enabled, s.disableNormalTravel, s.dailyCarriageFee, s.allowed.dungeons, s.clearerMapDots], [true, false, 1, false, false]);
      assert.equal(onlineModSetting(IMMERSIVE_TRAVEL_VENDOR, 'General.ClearerMapDots', '?online=1'), undefined, 'a look is the player\'s');
    });
    const s = readImmersiveTravelSettings();
    assert.deepEqual([s.enabled, s.disableNormalTravel, s.dailyCarriageFee, s.allowed.dungeons], [false, true, 0, true], 'offline the store is the player\'s');
    assert.equal(modSetting(IMMERSIVE_TRAVEL_VENDOR, 'General.DailyCarriageFee'), 0);
  } finally { _resetModSettings(); }
});

test('IT1 by source: a driver\'s trip goes from its own map to fast travel, never through the travel map\'s online floor (AUDIT IT1 W3), which stands as TRAVEL-ONLINE wrote it; the driver\'s map opens in the street\'s slot and its door reads PlayerGPS', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(isOnlinePage\(\) && !opts\?\.travelShip\) \{ townTalk\.say\(ONLINE_LAND_TRAVEL_REFUSAL\); hudFade\.clearFade\(\); \} else fastTravelTo\(pick, opts, computed\);/);
  assert.match(w, /function openImmersiveMap\(kind\) \{[\s\S]*?immersive: \{ kind, settings \},[\s\S]*?travelOptions: \(\) => null,[\s\S]*?onTravel: \(pick, opts, computed\) => \{ fastTravelTo\(pick, \{ \.\.\.opts, immersive: opts\?\.immersive \?\? kind \}, computed\); \},[\s\S]*?townTalk\.showOverlay\(win\);/);
  assert.match(w, /openImmersiveMap,\n\s+travelEnemiesNearby: \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\) \|\| navalHostileNear\(\),/);
  assert.match(w, /immersiveSettings: immersiveSettingsIfOn,\n\s+itHere,/);
  const m = read('src/scenes/worldModes.js');
  assert.match(m, /openImmersiveMap: \(kind\) => host\.openImmersiveMap\?\.\(kind\) \?\? null,/);
  assert.match(m, /\(mode === 'interior' \? mountInterior : mountServiceWindow\)\(createMerchantServiceWindow\(\{/);
  const sh = read('src/scenes/shared.js');
  assert.ok(sh.indexOf('installImmersiveTravel();') > 0 && sh.indexOf('installImmersiveTravel();') < sh.indexOf('installRoleplayRealism();'));
});
