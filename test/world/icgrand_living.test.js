// IC-GRAND x THE LIVING WORLD (2026-10-26, bible/03-World/Arena-Provinces.md IC-GRAND, "The living world") - THE IMPERIAL
// CITY ONE TOWN. Profiled in the running game (tools/imperialCityProbe.mjs PROFILE): the first frame over the city's centre
// held 50-88 s of script, all of it the living world's trips (scenes/livingWorld/livingIndex.js -> systems/livingWorld/
// trips.js visitorsOf -> townTrips -> ownTrip -> roadChoices) - the city's 625 slices each a place of a populated type,
// each a city of 64 blocks, all within each other's TRIP_REACH_PX, every one's trips the others' visitors. A family
// capital's slice but its centre is a part of the city, no town of its own; the centre's place is its one town.
// PIN MOVED (IC-GRAND x WW7-11, at the merge into the TESA branch): stream I's WW7-11 had already made a capital one town
// (livingIndex.js capitalStreet - no square, area or town's list names a street, a street sends no traveller), so IC-GRAND's
// own townOf line and its capitalSliceAside retired at the merge; this pin now holds the city once among the towns near and
// a street's own record standing for a reader on it (the soundscape's and the wagon warden's townAt) - WW7-11's law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { createLivingIndex } from '../../src/scenes/livingWorld/livingIndex.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { CAPITALS, capitalPlaceId, capitalDims } from '../../src/world/tamrielCapitals.js';
import { capitalStreet } from '../../src/scenes/livingWorld/livingIndex.js';
import { readFileSync } from 'node:fs';
import { createHouses, allocateHouseToPlayer, isHouseOwned, deedHeldIn } from '../../src/systems/banking.js';
import { imperialSlicePlan } from '../../src/world/imperialCity.js';

const IC = CAPITALS.findIndex((c) => c.family);
const OTHER = CAPITALS.findIndex((c) => !c.family && capitalDims(c).w * capitalDims(c).h > 1);   // a harbour's two slices

test('IC-GRAND THE LIVING WORLD - the Imperial City one town (WW7-11 capitalStreet): its slices but its centre are streets, so its 625 slices never stand 625 cities within each other\'s trip reach; the centre\'s place the town; a street\'s own record stands for a reader on it; every other place as it was', () => {
  assert.ok(IC >= 0 && OTHER >= 0);
  assert.equal(capitalStreet({ mapId: capitalPlaceId(IC, 0) }), false, 'the centre the town');
  assert.equal(capitalStreet({ mapId: capitalPlaceId(IC, 1) }), true);
  assert.equal(capitalStreet({ mapId: capitalPlaceId(IC, 624) }), true);
  assert.equal(capitalStreet({ mapId: 1234 }), false, 'no capital\'s');
  const row = (mapId, px, py) => ({ mapId, name: `P${mapId}`, px, py, type: LOCATION_TYPES.TownCity, region: 17, w: 8, h: 8 });
  const pl = createWorldPlaces();
  const rows = [row(capitalPlaceId(IC, 0), 100, 100)];
  let so = 1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) rows.push(row(capitalPlaceId(IC, so++), 100 + dx, 100 + dy));
  rows.push(row(7, 104, 100), row(capitalPlaceId(OTHER, 1), 106, 100));
  pl.register('bay', rows);
  const idx = createLivingIndex({ places: pl, populated: (t) => t === LOCATION_TYPES.TownCity, peopleAt: () => 0 });
  assert.equal(idx.townAt(100, 100)?.mapId, capitalPlaceId(IC, 0));
  for (const [x, y] of [[99, 99], [101, 100], [100, 101]]) assert.ok(capitalStreet(idx.townAt(x, y)), `${x},${y}: a street of the city, its own record`);
  // the city once among the towns near is WW7-11's own pin (ww7_longer.test.js, past the Bay where a capital stands - this
  // fixture's Bay pixels are no capital's side)
});

// AUDIT RELEASE R2-9 (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md R2-9) - A CAPITAL'S DEED IS ITS SLICE'S. Every
// slice of a capital is a map id over its own eight by eight blocks, and a building key is its block's column and row and
// its record (talk/talkTopics.js makeBuildingKey), so a key names a building in every slice: on the freeware 1,173 of the
// Imperial City's 1,241 residences' keys are a residence's in two slices or more (up to sixteen - measured with the game's
// rows and blocks, 31 s, not pinned here). DFU's (region, key) law owned them all with one deed.
test('AUDIT RELEASE R2-9 A CAPITAL\'S DEED IS ITS SLICE\'S - a deed bought in one of a capital\'s slices owns its key there alone, never the same key in another slice; a Bay town and a question with no town keep DFU\'s (region, key) law; every host that asks names its town (mutants: the town unread; the slot\'s map id unread; every deed held to its town; a host\'s town dropped)', () => {
  // the hazard, by the plan: slices holding a residences' block (RESI) at one sector of their eight by eight
  const at = new Map();
  for (let s = 0; s < 625; s++) imperialSlicePlan(s).forEach((row, y) => row.forEach((cell, x) => { if (cell === 'RESI') at.set(y * 8 + x, (at.get(y * 8 + x) ?? 0) + 1); }));
  assert.ok([...at.values()].filter((n) => n > 1).length > 20, 'many sectors hold a residences\' block in two slices or more');
  const houses = createHouses(80), region = 70, key = 65792;
  const a = capitalPlaceId(IC, 7), b = capitalPlaceId(IC, 23), other = capitalPlaceId(OTHER, 1);
  allocateHouseToPlayer(houses, region, { buildingKey: key, mapId: a, location: 'Market District' });
  assert.equal(isHouseOwned(houses, region, key, a), true, 'its own slice');
  assert.equal(isHouseOwned(houses, region, key, b), false, 'never the same key in another slice');
  assert.equal(isHouseOwned(houses, region, key, other), false, 'nor in another capital\'s');
  assert.equal(isHouseOwned(houses, region, key), true, 'asked with no town: DFU\'s law');
  assert.equal(isHouseOwned(houses, region, key + 1, a), false, 'another key: not owned');
  assert.equal(deedHeldIn(houses[region], b), false);
  // a Bay town: DFU's (region, key) law - a key owned in every town of its region
  const bay = createHouses(80);
  allocateHouseToPlayer(bay, 17, { buildingKey: key, mapId: 1234, location: 'Daggerfall' });
  assert.equal(isHouseOwned(bay, 17, key, 5678), true, 'a Bay town keeps DFU\'s law');
  // the hosts that ask name their town
  const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
  assert.match(read('src/scenes/worldModes.js'), /isHouseOwned\(playerEntity\.houses \?\? \[\], b\?\.regionIndex \?\? 0, key, homeTownOf\(b\)\)/, 'a building where it stands');
  assert.match(read('src/scenes/worldModes.js'), /!deedHeldIn\(playerEntity\.houses\?\.\[bankRegion\(\)\], dir\.mapId\)\) return null;/, 'the bank\'s sale: the town the bank stands in');
  assert.match(read('src/scenes/world.js'), /isHouseOwned\(playerEntity\.houses \?\? \[\], _questRegionIndex\(\), buildingKey, id\); \}/, 'the quest machine\'s');
  assert.match(read('src/scenes/questWorld.js'), /isHouseOwned\(playerEntity\.houses \?\? \[\], _questRegionIndex\(\), buildingKey, _questLoc\(\)\?\.mapTableData\?\.mapId \?\? null\)/, 'the quest world\'s');
  assert.match(read('src/scenes/exterior.js'), /isHouseOwned\(playerEntity\.houses \?\? \[\], dfLocation\.regionIndex, buildingKey, dfLocation\.mapTableData\?\.mapId \?\? null\)/, 'the town\'s locks\'');
});
