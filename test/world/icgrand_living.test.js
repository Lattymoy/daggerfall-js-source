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

// IC-GRAND x THE LIVING WORLD (2026-10-26, the owner walking the city: "Seems like NPCs arent navigating the entirety of
// the city"; bible/03-World/Arena-Provinces.md IC-GRAND, "The fabric's homes") - THE CITY'S PEOPLE: the living town made
// its people from its slice's buildings, and the city's own blocks stood none (425 of 625 slices nobody but the watch and
// its travellers); and it walked the one street net most doors open onto, where a slice cut from the city holds pieces
// of several (a district wall whose gate stands in the next slice). Each near slice's fabric hands the town homes, shops
// and taverns (world/imperialHomes.js fabricHomesIn), and a capital's slice is a town of quarters (places.js): each
// quarter's people live, work and walk in it.
const SPLIT = 341;   // a slice a district wall splits: its fabric's homes on two street nets
/** A slice's walkers' grid of its own blocks (Daggerfall's cells left shut - the fabric's streets alone). */
async function sliceNav(s) {
  const { installCapitals, imperialSliceFootprint } = await import('../../src/world/capitalModels.js');
  const { imperialBlockJson, imperialOwnName } = await import('../../src/world/imperialBlocks.js');
  const { prebuildDeps } = await import('../../src/world/imperialPrebuild.js');
  const { imperialCodeCell, IMPERIAL_SPAN } = await import('../../src/world/imperialCity.js');
  const { CityNavigation } = await import('../../src/world/city/cityNavigation.js');
  installCapitals({ addTextures: () => 0 });
  const deps = prebuildDeps(imperialSliceFootprint), plan = imperialSlicePlan(s), sx = s % IMPERIAL_SPAN, sy = Math.floor(s / IMPERIAL_SPAN);
  const nav = new CityNavigation(8, 8);
  for (let i = 0; i < 64; i++) {
    const pr = 7 - Math.floor(i / 8), pc = i % 8;
    if (!imperialCodeCell(plan[pr][pc])) continue;
    const fh = imperialBlockJson(imperialOwnName(sy * 8 + pr, sx * 8 + pc), deps).RmbBlock.FldHeader;
    nav.setBlockData(i % 8, Math.floor(i / 8), fh.AutoMapData, (tx, ty) => fh.GroundData.GroundTiles[ty * 16 + tx].TileBitfield & 0x3f);
  }
  return nav;
}

test('IC-GRAND THE FABRIC\'S HOMES - a near slice\'s fabric hands its living town homes, shops and taverns: one plot with a street front in HOMES_EVERY (HOMES_MIN to HOMES_MAX), keyed by the plot\'s own key past Daggerfall\'s keys, each door on open ground before its front in the slice\'s location frame, the same for every reader; a Bay town none; the pixel\'s build hands them in (mutants: a door onto shut ground; the keys in Daggerfall\'s range; the build unwired)', async () => {
  const { fabricHomesIn, cityHomesOf, NO_HOMES, HOMES_MIN, HOMES_MAX, FABRIC_HOME_KEY_MIN, DOOR_OUT } = await import('../../src/world/imperialHomes.js');
  const { fabricGroundAt, fabricClosedOf, _resetFabric } = await import('../../src/world/imperialFabric.js');
  const { imperialClosed, IMPERIAL_SPAN, IMPERIAL_CELLS } = await import('../../src/world/imperialCity.js');
  const { BUILDING_TYPES } = await import('../../src/world/buildingNames.js');
  const h = fabricHomesIn(SPLIT);
  assert.ok(h.buildings.length >= HOMES_MIN && h.buildings.length <= HOMES_MAX, `${h.buildings.length} homes`);
  assert.deepEqual(h.doors.map((d) => d.key), h.buildings.map((b) => b.key), 'a door a building, in the keys\' order');
  assert.equal(new Set(h.buildings.map((b) => b.key)).size, h.buildings.length);
  assert.ok(h.buildings.every((b) => b.key >= FABRIC_HOME_KEY_MIN), 'past every key of a Daggerfall block\'s building');
  // a plot whose key falls in Daggerfall's range is no candidate (the Market's slice 110 has one)
  const { homeCandidates } = await import('../../src/world/imperialHomes.js');
  const { fabricCell } = await import('../../src/world/imperialFabric.js');
  const low = [];
  for (let r = 4 * 8; r < 5 * 8; r++) for (let c = 10 * 8; c < 11 * 8; c++) for (const p of fabricCell(r, c).plots) if (p.out && !p.back && (p.key >>> 0) < FABRIC_HOME_KEY_MIN) low.push(p.key >>> 0);   // slice 110: row 4, column 10
  assert.ok(low.length >= 1, 'a low key in the slice');
  assert.ok(homeCandidates(110).every((p) => (p.key >>> 0) >= FABRIC_HOME_KEY_MIN && !low.includes(p.key >>> 0)), 'none of them a candidate');
  const types = new Set(h.buildings.map((b) => b.type));
  assert.ok(types.has(BUILDING_TYPES.Tavern), 'a tavern');
  assert.ok([...types].some((t) => t >= BUILDING_TYPES.House1 && t <= BUILDING_TYPES.House4), 'houses');
  assert.ok([...types].some((t) => t !== BUILDING_TYPES.Tavern && t < BUILDING_TYPES.House1), 'shops');
  // each door on open ground, before its own front, in the slice's frame (x east, z north of its south-west corner)
  const B = 102.4, sx = SPLIT % IMPERIAL_SPAN, sy = Math.floor(SPLIT / IMPERIAL_SPAN), ox = (sx * 8 - IMPERIAL_CELLS / 2) * B, oz = (sy * 8 + 8 - IMPERIAL_CELLS / 2) * B;
  for (const d of h.doors) {
    assert.ok(d.x >= 0 && d.x <= 8 * B && d.z >= 0 && d.z <= 8 * B, 'in the slice');
    const X = ox + d.x, Z = oz - d.z;
    assert.ok(!fabricClosedOf(fabricGroundAt(X, Z)) && !imperialClosed(X, Z), `${d.key}'s door on open ground`);
    const inX = X - d.nx * (DOOR_OUT + 0.3), inZ = Z + d.nz * (DOOR_OUT + 0.3);   // back through the door: its building
    assert.ok(fabricClosedOf(fabricGroundAt(inX, inZ)), `${d.key}'s door before its own front`);
  }
  assert.equal(fabricHomesIn(SPLIT), h, 'kept');
  // the same for every reader: made again from nothing, the same homes
  const before = JSON.stringify(fabricHomesIn(SPLIT + 1));
  _resetFabric();
  assert.equal(JSON.stringify(fabricHomesIn(SPLIT + 25)) !== '', true);
  assert.equal(before, JSON.stringify(fabricHomesIn(SPLIT + 1)));
  // a capital's slice's location its homes; any other place none
  assert.equal(cityHomesOf({ capital: { k: IC, s: SPLIT } }), h);
  assert.equal(cityHomesOf({ capital: { k: OTHER, s: 0 } }), NO_HOMES);
  assert.equal(cityHomesOf({ mapTableData: { mapId: 1234 } }), NO_HOMES);
  const pb = readFileSync(new URL('../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(pb, /\.map\(\(b\) => \(\{ key: b\.buildingKey, type: b\.buildingType, quality: b\.quality, factionId: b\.factionId \}\)\)\.concat\(cityHomesOf\(dfLocation\)\.buildings\),/);
  assert.match(pb, /\}\)\.concat\(cityHomesOf\(dfLocation\)\.doors\),/);
});

test('IC-GRAND A TOWN OF QUARTERS - a capital\'s slice walks every street net QUARTER_MIN of its buildings open onto, each a quarter of its own: every quarter its people, each living, working and walking in it (every walk of their day from a cell of its net to a cell of the same); the one net alone left a district\'s streets empty; ids unique; a Bay town one net as it was (mutants: no quarters; one census; the town\'s places for every day; a quarter\'s slots the first\'s)', async () => {
  const { LivingTown } = await import('../../src/systems/livingWorld/livingTown.js');
  const { townPlaces, streetNet } = await import('../../src/systems/livingWorld/places.js');
  const { fabricHomesIn } = await import('../../src/world/imperialHomes.js');
  const { PERSON_MOVE_SPEED } = await import('../../src/characters/mobile/mobilePerson.js');
  const { CLASSIC_MINUTES_PER_SECOND } = await import('../../src/systems/worldTick.js');
  const { DAY_MIN, DAY_START_MIN } = await import('../../src/systems/livingWorld/dayPlan.js');
  const nav = await sliceNav(SPLIT), homes = fabricHomesIn(SPLIT), label = streetNet(nav).label;
  const make = (mapId) => new LivingTown(nav, { town: { mapId, blocks: 64, region: 70, people: 3, port: false }, buildings: homes.buildings, doors: homes.doors, makePerson: () => null,
    clock: () => 300 * DAY_MIN + DAY_START_MIN, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND });
  const lt = make(capitalPlaceId(IC, 300));
  const Q = lt.places.quarters;
  assert.ok(Q && Q.length >= 2, 'two street nets at the least');
  const one = townPlaces(nav, homes.doors, homes.buildings);
  const walked = Q.reduce((n, q) => n + q.doors.size, 0);
  assert.ok(walked > one.doors.size + 10, `the quarters' doors ${walked} against the one net's ${one.doors.size}`);
  // every quarter its people; each one's day within it
  const labelOf = (cell) => label[cell[1] * nav.width + cell[0]];
  const people = new Array(Q.length).fill(0);
  for (const res of lt.residents) {
    const home = res.home != null ? lt.places.doors.get(res.home) : null;
    if (home) people[lt.places.quarterAt(home.cell)]++;
    for (const e of lt.planOf(res, 300)) if (e.kind === 'walk' && e.from?.cell && e.to?.cell) assert.equal(labelOf(e.from.cell), labelOf(e.to.cell), `${res.id}'s walk ${e.from.key} -> ${e.to.key} has its way`);
  }
  assert.ok(people.every((n) => n > 0), `every quarter its people: ${people}`);
  assert.equal(new Set(lt.residents.map((r) => r.id)).size, lt.residents.length, 'no two of its people one identity');
  const { QUARTER_SLOTS } = await import('../../src/systems/livingWorld/census.js');
  const others = lt.residents.filter((r) => r.roll === 'q');
  assert.ok(others.length > 0 && others.every((r) => r.slot >= QUARTER_SLOTS), 'another quarter\'s people on slots of their own');
  // a Bay town: one town on one net, as the field's law keeps it
  assert.equal(make(1234).places.quarters, undefined);
});
