// BAY-LEFT-B (2026-10-27, the audit "no system left behind in the Bay" item 32; bible/03-World/Arena-Provinces.md
// BAY-LEFT-B): HOUSES FOR SALE PAST THE BAY. No house was sold, no deed read and no rank-9 knight's house given in any
// Arena town, country place or capital - "until TESA3", when every one answered the clamp's region and a key bought in
// one would have owned its twin in all of them. The regions are the provinces' now (WW-R), and AUDIT RELEASE R2-9 held a
// capital's deed to its slice by map id; the law is every place the port made's (systems/banking.js deedHeldIn over
// world/placeIds.js isMadePlaceId), so the gates come down: a house is sold, deeded, entered and owned in its own town
// past the Bay, and a Bay town keeps DFU's (region, key) law byte for byte. Online homes key by map id already (HOME1,
// net/homeLaw.js homeDeedOf): both ends agree. The ARENA2 halves stand the towns past the Bay over the freeware.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHouses, allocateHouseToPlayer, isHouseOwned, deedHeldIn, housesForSale, BANK_REGION_COUNT } from '../../src/systems/banking.js';
import { isMadePlaceId, BAY_PIXEL_IDS } from '../../src/world/placeIds.js';
import { discoveryKeyOf } from '../../src/systems/discovery.js';
import { arenaPlaceId } from '../../src/world/arenaLocations.js';
import { countryPlaceId, countryOrdinal } from '../../src/world/tamrielCountry.js';
import { capitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { etherPlaceId } from '../../src/world/etherPlaces.js';
import { veilhaven } from '../../src/world/ethericSea.js';
import { isEtherPlaceId } from '../../src/world/etherPlaces.js';
import { receiveHouseDecision } from '../../src/systems/knightlyGifts.js';
import { homeDeedOf, homeRegionOk, homeMapIdOk } from '../../src/net/homeLaw.js';
import { MINUTES_PER_DAY, DAYS_PER_MONTH } from '../../src/systems/gameDate.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { locationBuildings } from '../../src/systems/talk/talkTopics.js';
import { layoutLocation } from '../../src/world/locationLayout.js';

const ARENA2 = process.env.ARENA2_PATH;
const NO_DATA = ARENA2 ? false : 'ARENA2_PATH unset (sh tools/fetch-data.sh)';
const rd = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const SKYRIM = 64, KEY = 0x020304;
const ARENA_A = arenaPlaceId({ provinceIndex: 1, id: 3 }), ARENA_B = arenaPlaceId({ provinceIndex: 1, id: 4 });
const COUNTRY = countryPlaceId(countryOrdinal(1700, -398)), CAPITAL = capitalPlaceId(1, 0);

test('BAY-LEFT-B HOUSES: a place the port made is known by its map id alone - its low 20 bits past the Bay\'s pixel ids - the discovery store\'s law (mutant: the bound)', () => {
  for (const id of [ARENA_A, COUNTRY, CAPITAL, lairPlaceId(5), etherPlaceId(veilhaven())]) assert.equal(isMadePlaceId(id), true, id.toString(16));
  for (const id of [7707, 0x12345, (1833 << 20) | 499999, BAY_PIXEL_IDS - 1]) assert.equal(isMadePlaceId(id), false, id.toString(16));
  assert.equal(isMadePlaceId(BAY_PIXEL_IDS), true);
  for (const id of [ARENA_A, 7707, (1833 << 20) | 499999]) assert.equal(discoveryKeyOf(id) === (id >>> 0), isMadePlaceId(id) || (id >>> 0) < 0x100000);
});

test('BAY-LEFT-B HOUSES: a deed past the Bay stands in the town it was bought in alone - never its twin of the same key in another town of the province (an Arena town, the countryside, a capital); a Bay town keeps DFU\'s (region, key) law (mutants: the made-place test; the slot\'s town)', () => {
  const houses = createHouses(BANK_REGION_COUNT);
  allocateHouseToPlayer(houses, SKYRIM, { buildingKey: KEY, mapId: ARENA_A, location: 'Dragonstar' }, { regionName: 'Skyrim' });
  assert.equal(isHouseOwned(houses, SKYRIM, KEY, ARENA_A), true, 'its own town');
  assert.equal(isHouseOwned(houses, SKYRIM, KEY, ARENA_B), false, 'another Arena town, the same key');
  assert.equal(isHouseOwned(houses, SKYRIM, KEY, COUNTRY), false, 'a country place');
  assert.equal(isHouseOwned(houses, SKYRIM, KEY, CAPITAL), false, 'a capital');
  assert.equal(isHouseOwned(houses, SKYRIM, KEY, null), true, 'asked with no town: the region\'s one house');
  const country = createHouses(BANK_REGION_COUNT);
  allocateHouseToPlayer(country, SKYRIM, { buildingKey: KEY, mapId: COUNTRY, location: 'Riverwood' }, { regionName: 'Skyrim' });
  assert.deepEqual([ARENA_A, COUNTRY].map((id) => isHouseOwned(country, SKYRIM, KEY, id)), [false, true]);
  // the Bay: DFU's law, a key in one town reads in another of the region (IsHouseOwned :140-148), unchanged
  const bay = createHouses(BANK_REGION_COUNT);
  allocateHouseToPlayer(bay, 17, { buildingKey: KEY, mapId: 7707, location: 'Ashbury' }, { regionName: 'Daggerfall' });
  assert.deepEqual([7707, 7708, null].map((id) => isHouseOwned(bay, 17, KEY, id)), [true, true, true]);
  assert.equal(deedHeldIn(bay[17], 7708), true);
  assert.equal(deedHeldIn(houses[SKYRIM], ARENA_B), false);
});

/** worldModes.js currentHousesForSale, run off its own text - the gate and the market over a town's directory. */
function currentHousesForSaleOf(dir) {
  const W = rd('src/scenes/worldModes.js');
  const from = W.indexOf('  function currentHousesForSale() {');
  const to = W.indexOf('  /**\n   * H2 - GetHousePrice', from);
  assert.ok(from > 0 && to > from, 'worldModes.js\'s market moved');
  // PIN MOVED (HOUSES-3): the market leaves the player's own deeds off it (houseOwnedAt, the town buildings' one door)
  const fn = new Function('buildingDirectory', 'isEtherPlaceId', 'housesForSale', 'worldMinutes', 'MINUTES_PER_DAY', 'DAYS_PER_MONTH', 'questBridge', 'houseMeshRadius', 'host', 'houseOwnedAt',
    `${W.slice(from, to)} return currentHousesForSale();`);
  return fn(() => dir, isEtherPlaceId, housesForSale, () => 0, MINUTES_PER_DAY, DAYS_PER_MONTH, null, () => 1, { onlineHomes: null }, () => false);
}

/** A town's directory as the world host's buildingDirectory makes it (scenes/world.js): its buildings with their keys, off
 *  its laid blocks (talkTopics.js locationBuildings). */
const directoryOf = (loc) => ({ mapId: loc.mapTableData.mapId >>> 0, locationName: loc.name,
  buildings: locationBuildings(loc.exterior?.buildings ?? [], layoutLocation(loc, _w.maps, _w.blocks).blocks, { locationIndex: loc.locationIndex ?? 0 }) });
let _w = null;
async function world() {
  if (_w) return _w;
  const { standWorldPastBay } = await import('./quest/r25World.mjs');
  _w = await standWorldPastBay(ARENA2);
  return _w;
}

test('BAY-LEFT-B HOUSES: houses are for sale in an Arena town, a country town and a capital past the Bay - the town market\'s own gate (worldModes.js currentHousesForSale) and the rank-9 knight\'s house given there; the isles\' market stays shut (mutants: the Arena gate back; the country gate back)', { skip: NO_DATA }, async () => {
  const w = await world();
  const P = w.places.provinceQuestPlaces;
  const whiterun = w.worldPlaces.all().find((p) => p.name === 'Whiterun' && p.region === SKYRIM);
  const arena = P.standAt(whiterun.px, whiterun.py);
  // a country hamlet as the countryside mints one (world/tamrielCountry.js synthesizeCountryLocation over the game's own
  // template - the suite's world lays no roads, so its roll stands none)
  const { countryTemplates, synthesizeCountryLocation } = await import('../../src/world/tamrielCountry.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const hamlet = countryTemplates(w.rows, isMainStoryDungeon).get(LOCATION_TYPES.TownHamlet)[0];
  const country = synthesizeCountryLocation(hamlet, { px: 1700, py: -398, type: LOCATION_TYPES.TownHamlet, name: 'Riverwood' }, { regionIndex: SKYRIM, regionName: 'Skyrim', politic: 128 + SKYRIM });
  const solitude = P.standAt(1569, -430);
  for (const loc of [arena, country, solitude]) {
    assert.ok(loc, 'a town past the Bay stands');
    assert.equal(isMadePlaceId(loc.mapTableData.mapId), true, loc.name);
    const dir = directoryOf(loc);   // the world host's buildingDirectory: its buildings with their keys
    const forSale = currentHousesForSaleOf(dir);
    assert.ok(forSale.length > 0, `${loc.name}: houses for sale`);
    assert.deepEqual(forSale, housesForSale(dir.buildings, { mapId: dir.mapId, month: 0, isActiveQuestBuilding: () => false, stands: () => true }), 'the one producer\'s list');
    const gift = receiveHouseDecision({ rank: 9, flags: 0 }, { ownsHouse: false, housesForSale: forSale, rolls: () => 0 });
    assert.equal(gift.kind, 'grant', `${loc.name}: a knight's house given`);
    // bought, deeded and owned there - and only there
    const houses = createHouses(BANK_REGION_COUNT);
    allocateHouseToPlayer(houses, SKYRIM, { buildingKey: gift.house.buildingKey, mapId: dir.mapId, location: loc.name }, { regionName: 'Skyrim' });
    assert.equal(isHouseOwned(houses, SKYRIM, gift.house.buildingKey, dir.mapId), true, `${loc.name} key ${gift.house.buildingKey} stands ${JSON.stringify(houses[SKYRIM])}`);
  }
  assert.notEqual(arena.mapTableData.mapId, country.mapTableData.mapId);
  // the isles' (AUDIT CAPTAIN'S SEA P9, recorded): no region's slot of their own
  assert.deepEqual(currentHousesForSaleOf({ ...directoryOf(arena), mapId: etherPlaceId(veilhaven()) }), []);
  // the Bay's town: the same market as ever
  const daggerfall = w.maps.getLocationByName('Daggerfall', 'Daggerfall');
  const bayDir = directoryOf(daggerfall);
  assert.ok(bayDir.buildings.length > 100);
  assert.deepEqual(currentHousesForSaleOf(bayDir), housesForSale(bayDir.buildings, { mapId: bayDir.mapId, month: 0, isActiveQuestBuilding: () => false, stands: () => true }));
});

test('BAY-LEFT-B HOUSES: the deed\'s readers name the town asking - the building where it stands, the quest world\'s residences - and online homes key by the town\'s map id in any region, so both ends agree (mutants: the town dropped at a reader)', () => {
  const M = rd('src/scenes/worldModes.js'), W = rd('src/scenes/world.js');
  assert.match(M, /const houseOwnedAt = \(b, key\) => !isEtherPlaceId\(homeTownOf\(b\)\) && isHouseOwned\(playerEntity\.houses \?\? \[\], b\?\.regionIndex \?\? 0, key, homeTownOf\(b\)\);/);
  assert.match(M, /if \(isEtherPlaceId\(dir\.mapId\)\) return \[\];\n\s+return housesForSale\(dir\.buildings, \{/);
  assert.match(W, /return !isEtherPlaceId\(id\) && isHouseOwned\(playerEntity\.houses \?\? \[\], _questRegionIndex\(\), buildingKey, id\); \},/);
  // PIN MOVED (HOUSES-3): the bank's resolver over the region's three is banking.js townDeeds
  assert.match(M, /const townHouses = \(\) => townDeeds\(playerEntity\.houses \?\? \[\], bankRegion\(\), buildingDirectory\?\.\(\)\);/);
  assert.match(rd('src/systems/banking.js'), /\.filter\(\(deed\) => deedStands\(deed\) && deedHeldIn\(deed, dir\.mapId\)\)/, 'the bank sells it in its own town');
  // HOME1: the account's deed of a knight's house past the Bay - its region's slot, held to its town's map id
  assert.equal(homeRegionOk(SKYRIM), true);
  assert.equal(homeMapIdOk(ARENA_A), true);
  const houses = createHouses(BANK_REGION_COUNT);
  allocateHouseToPlayer(houses, SKYRIM, { buildingKey: KEY, mapId: ARENA_A, location: 'Dragonstar' }, { regionName: 'Skyrim' });
  assert.ok(homeDeedOf(houses, SKYRIM, ARENA_A, KEY));
  assert.equal(homeDeedOf(houses, SKYRIM, ARENA_B, KEY), null, 'the account\'s law: its own town alone, as the client\'s');
});
