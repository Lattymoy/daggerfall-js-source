// BAY-LEFT-B (2026-10-27, the audit "no system left behind in the Bay" B3-B7; bible/06-Systems/Quest-Arc.md and
// Talk-Arc.md BAY-LEFT-B): THE QUEST LAYER'S TABLES PAST THE BAY, READ WHERE THE HOST READ MAPS.BSA. %di, the talk's
// regional "Where is", the map item's and the guilds' reveals and the Mages Guild's scrying each read the host's raw
// MAPS.BSA reader - null for a province's region (62..70) - and answered "...never mind...", "not found", nothing and
// "nowhere" past the Bay; %lp said "Hammerfell". Each now reads the quest layer's maps (scenes/questWorld.js), a
// province's region its table of the places past the Bay (scenes/quest/questProvinceSites.js), each row with its
// location's MapTable key (world/locationKey.js). The ARENA2 halves stand the world past the Bay over the freeware
// (test/systems/quest/r25World.mjs, the quest layer as the world host wires it).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { longitudeLatitudeToMapPixel, DUNGEON_TYPES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { locationCompassDirection } from '../../../src/systems/talk/talk.js';
import { AnswerPipeline, REGIONAL_LOOKUP_INDEXES, checkLocationKeyForRegionalBuilding } from '../../../src/systems/answerPipeline.js';
import { FACTIONS_AND_BUILDINGS } from '../../../src/systems/topicTree.js';
import { locationKeyOf } from '../../../src/world/locationKey.js';
import { scryRows, scryRefusal, nearestHidden, familyKinds } from '../../../src/systems/loot/lootScry.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { discoverRandomLocation, hasDiscoveredLocationId, restoreDiscovery } from '../../../src/systems/discovery.js';
import { getMacroValue } from '../../../src/systems/quest/questMacros.js';
import { provinceRow } from '../../../src/scenes/quest/questProvinceSites.js';
import { CAPITALS } from '../../../src/world/tamrielCapitals.js';
import { fabricSliceSites } from '../../../src/world/imperialFabricBuildings.js';
import { LAIR_LANE } from '../../../src/world/tamrielCountry.js';

const ARENA2 = process.env.ARENA2_PATH;
const NO_DATA = ARENA2 ? false : 'ARENA2_PATH unset (sh tools/fetch-data.sh)';
const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const SOLITUDE = Object.freeze({ x: 1569, y: -430 }), SKYRIM = 64;
const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

let _w = null;
async function world() {
  if (_w) return _w;
  const { standWorldPastBay, questLayerAt } = await import('./r25World.mjs');
  const { loadTables } = await import('../../qlSources.mjs');
  loadTables();
  const w = await standWorldPastBay(ARENA2);
  const sol = w.places.provinceQuestPlaces.standAt(SOLITUDE.x, SOLITUDE.y);
  const bay = w.maps.getLocationByName('Daggerfall', 'Daggerfall');
  _w = { ...w, sol, bay, bayPx: longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude), questLayerAt: (pixel, location) => questLayerAt(w, { pixel, location }) };
  return _w;
}
/** A guild quest offered at `location`, started, its places' %di as the quest layer answers it (the macro's remote arm). */
async function directions(pixel, location, name, factionID) {
  const w = await world();
  const { questSource } = await import('../../qlSources.mjs');
  const { QUEST_REACH_TUNING } = await import('../../../src/systems/quest/questReach.js');
  const { createProvinceWarm } = await import('../../../src/scenes/quest/questProvinceWarm.js');
  QUEST_REACH_TUNING.override = true;
  const L = await w.questLayerAt(pixel, location);
  if (L.questWorld.provinceSites) {
    const warm = createProvinceWarm({ provinces: L.questWorld.provinceSites, regionNow: () => w.maps.getRegionIndexAt(pixel.x, pixel.y), origin: () => pixel });
    for (let n = 0; !warm.done() && n < 4000; n++) warm.tick();
  }
  L.machine.setLastNPCClicked({ hash: 1, mapID: location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID, gender: 0 });
  const quest = quiet(() => L.machine.parseQuestForLists(questSource(name, true), factionID, { rolls: seeded(name.length * 31 + pixel.x) }));
  quiet(() => { L.machine.startQuestImmediate(quest); quest.update(); });
  return Object.fromEntries([...quest.resources.values()].filter((x) => x.isPlace && x.scope === 'remote').map((p) => [p.symbol.name, [p.siteDetails?.locationName, L.questWorld.locationCompassDirection(p)]]));
}

test('BAY-LEFT-B B3: %di names the direction of a site past the Bay - the quest layer\'s province table, the regions bounded by the world\'s 71 - and the Bay\'s are as they were (mutants: the raw maps; the Bay\'s 62 bound)', { skip: NO_DATA }, async () => {
  const w = await world();
  assert.deepEqual(await directions(SOLITUDE, w.sol, 'M0B00Y07', 41), { house: ['Fenrarik Manor', 'northeast'], newdung: ['The Citadel of Alarne', 'east'] });
  assert.deepEqual(await directions(SOLITUDE, w.sol, 'N0B00Y06', 40), { mondung: ['Ruins of The Citadel of Hararke', 'east'] });
  assert.deepEqual(await directions(w.bayPx, w.bay, 'M0B00Y07', 41), { house: ['Uplech', 'northwest'], newdung: ['Greenfield\'s Hold', 'northwest'] });
});

test('BAY-LEFT-B B3: talk.js locationCompassDirection bounds the politic region by the world\'s regions (REGION_NAMES), a province\'s read off the maps it is handed (mutant: MapFileReader.RegionCount)', () => {
  const at = { x: 1700, y: -400 };
  const ll = { longitude: 0, latitude: 0 };
  const table = { mapNames: ['Riverwood'], mapNameLookup: new Map([['Riverwood', 0]]), mapTable: [{ ...ll }] };
  const maps = { regionCount: 62, getPoliticIndex: () => 128 + SKYRIM, getRegion: (r) => (r === SKYRIM ? table : null) };
  const p = longitudeLatitudeToMapPixel(0, 0);
  const want = locationCompassDirection({ playerMapPixel: () => at, maps: { ...maps, getPoliticIndex: () => 128 + 17, getRegion: (r) => (r === 17 ? table : null) } }, 'Riverwood');
  assert.equal(locationCompassDirection({ playerMapPixel: () => at, maps }, 'Riverwood'), want, `a province's region as a Bay region (${p.x},${p.y})`);
  assert.notEqual(want, '...never mind...');
  assert.equal(locationCompassDirection({ playerMapPixel: () => at, maps: { ...maps, getPoliticIndex: () => 128 + REGION_NAMES.length } }, 'Riverwood'), '...never mind...', 'past the world\'s regions, none');
});

test('BAY-LEFT-B B4: a province\'s table carries each place\'s MapTable key - its location\'s, its buildings\' directory - read without standing it, and once stood the stood one\'s (mutants: the row\'s key; the template\'s read; the stood read; the capital\'s own key)', { skip: NO_DATA }, async () => {
  const w = await world();
  const L = await w.questLayerAt(SOLITUDE, w.sol);
  const sky = L.questWorld.maps.getRegion(SKYRIM);
  const before = sky.mapTable.map((row) => row.key);
  let checked = 0, capital = 0;
  for (let i = 0; i < sky.mapTable.length; i++) {
    const loc = L.questWorld.provinceSites.getLocation(SKYRIM, i);
    if (!loc) continue;
    const own = locationKeyOf(CAPITALS[loc.capital?.k]?.family ? [...loc.exterior.buildings, ...fabricSliceSites(loc.capital.s)] : loc.exterior?.buildings ?? []);
    assert.equal(loc.mapTableData.key >>> 0, own, `${loc.name}: its key is its buildings'`);
    assert.equal(before[i], own, `${loc.name}: read off its template (a capital: its stood slice), the stood one's`);
    if (loc.capital) capital++; else checked++;
  }
  assert.ok(checked >= 40, `${checked} places past the Bay checked`);
  assert.equal(capital, 1, 'Solitude (stood by the suite before its table)');
  // a capital's slice not yet stood reads none; stood, its own buildings' and its fabric's
  const P = w.places.provinceQuestPlaces;
  // an Arena town and a country place no test stood (Elsweyr's - far from every questor here) read their template's key
  // without standing - the key their location carries once stood, a key of buildings (never none)
  const unstood = (p) => !w.locationIndex.has(`${p.px},${p.py}`) && !(CAPITALS.some((c) => c.name === p.name));
  const town = w.worldPlaces.inTheatre(7).find((p) => w.maps.getRegionIndexAt(p.px, p.py) === 68 && p.type === LOCATION_TYPES.TownCity && unstood(p));
  assert.ok(town, 'an Elsweyr Arena town not stood');
  const country = P.countryNear(town.px, town.py, 40, 8, 400).find((c) => unstood(c) && c.type !== LOCATION_TYPES.TownCity);
  assert.ok(country, 'a country place near it, not stood');
  for (const p of [town, country]) {
    const read = P.tableKeyAt(p.px, p.py);
    const stood = P.standAt(p.px, p.py);
    assert.equal(read, stood.mapTableData.key >>> 0, `${p.name}: its template's key, read before it stood`);
    assert.equal(read, locationKeyOf(stood.exterior?.buildings ?? []), `${p.name}: its buildings'`);
  }
  assert.ok(P.tableKeyAt(town.px, town.py) > 0, `${town.name}: a town's key names its buildings`);
  const ic = w.worldPlaces.inTheatre(9).find((p) => w.maps.getRegionIndexAt(p.px, p.py) === 70 && CAPITALS[0].family && !w.locationIndex.has(`${p.px},${p.py}`) && /quarter|District/.test(p.name));
  assert.ok(ic, 'an Imperial City slice not stood');
  assert.equal(P.tableKeyAt(ic.px, ic.py), null);
  const icLoc = P.standAt(ic.px, ic.py);
  assert.equal(P.tableKeyAt(ic.px, ic.py), locationKeyOf([...icLoc.exterior.buildings, ...fabricSliceSites(icLoc.capital.s)]));
  // a table made after (another pixel): every row the stood one's - Solitude's own buildings', never its base city's
  const L2 = await w.questLayerAt({ x: SOLITUDE.x + 1, y: SOLITUDE.y }, w.sol);
  const sky2 = L2.questWorld.maps.getRegion(SKYRIM);
  const i = sky2.mapNameLookup.get('Solitude');
  assert.equal(sky2.mapTable[i].key, w.sol.mapTableData.key >>> 0);
  assert.notEqual(w.sol.mapTableData.key >>> 0, 23138624, 'never the base city\'s key (lane B\'s probe read 23138624, Solitude\'s base\'s)');
  assert.equal(sky2.mapTable[i].key, locationKeyOf(w.sol.exterior.buildings));
});

test('BAY-LEFT-B B4: the talk\'s regional "Where is" past the Bay names a town of the province that holds the building, through the answer pipeline over the quest layer\'s table (mutants: the host\'s raw region; the province\'s getLocation)', { skip: NO_DATA }, async () => {
  const w = await world();
  const L = await w.questLayerAt(SOLITUDE, w.sol);
  const pipe = new AnswerPipeline({
    currentRegion: () => L.questWorld.maps.getRegion(SKYRIM), currentRegionIndex: () => SKYRIM,
    getLocation: (r, i) => L.questWorld.provinceSites.getLocation(r, i), rolls: seeded(5),
  });
  let found = 0;
  for (let index = 0; index < FACTIONS_AND_BUILDINGS.length; index++) {
    const loc = pipe.getLocationWithRegionalBuilding(REGIONAL_LOOKUP_INDEXES[index], FACTIONS_AND_BUILDINGS[index]);
    if (!loc) continue;
    found++;
    assert.equal(checkLocationKeyForRegionalBuilding(locationKeyOf(loc.exterior.buildings), REGIONAL_LOOKUP_INDEXES[index], FACTIONS_AND_BUILDINGS[index]), 1, `${loc.name} holds row ${index}'s building`);
    assert.equal(w.maps.getRegionIndexAt(longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude).x, longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude).y), SKYRIM);
  }
  assert.ok(found >= 15, `${found} of the 30 Regional rows answered in Skyrim`);
  assert.equal(pipe.getRegionalLocationCityName({ index: 20 }), true, 'any tavern');
  assert.notEqual(pipe.locationOfRegionalBuilding, '');
  // the host wires it: the quest layer's region, a province's location its table's
  const W = rd('src/scenes/world.js');
  assert.match(W, /currentRegion: \(\) => questWorld\.maps\.getRegion\(_questRegionIndex\(\)\) \?\? null,/);
  assert.match(W, /getLocation: \(r, i\) => \(isProvinceRegion\(r\) \? questWorld\.provinceSites\?\.getLocation\(r, i\) \?\? null : maps\.getLocation\(r, i\)\),/);
  assert.match(rd('src/scenes/questWorld.js'), /\{ playerMapPixel: playerTravelPixel, maps: questWorld\.maps \},/, '%di\'s remote arm over the same maps');
});

test('BAY-LEFT-B B4: provinceRow - its location\'s key, and a place with no dungeon NoDungeon as MAPS.BSA\'s towns (mutants: the key\'s default; the town\'s dungeon type)', () => {
  const town = provinceRow({ mapId: 5, name: 'T', px: 1700, py: -400, type: LOCATION_TYPES.TownCity, dungeonType: 0, hasDungeon: false, tableKey: 0x01611140 });
  assert.deepEqual([town.key, town.dungeonType], [0x01611140, DUNGEON_TYPES.NoDungeon]);
  const country = provinceRow({ mapId: 6, name: 'C', px: 1700, py: -400, type: LOCATION_TYPES.TownHamlet });
  assert.deepEqual([country.key, country.dungeonType], [0, DUNGEON_TYPES.NoDungeon]);
  const lair = provinceRow({ mapId: 7, name: 'L', px: 1700, py: -400, type: LOCATION_TYPES.DungeonRuin, dungeonType: 0 });
  assert.equal(lair.dungeonType, 0, 'a lair\'s own type - a crypt');
});

test('BAY-LEFT-B B5: the map item\'s and the guilds\' reveal reads the politic region\'s table - past the Bay its places, and on the Bay\'s road and sea as on its towns (mutants: the location\'s region; the raw maps)', { skip: NO_DATA }, async () => {
  const w = await world();
  const W = rd('src/scenes/world.js');
  const from = W.indexOf('  const revealLocation = (noteKey) => {');
  const to = W.indexOf('  let _locationRevealedByMapItem = null;', from);
  assert.ok(from > 0 && to > from, 'world.js\'s reveal moved');
  const body = W.slice(from, to);
  assert.match(body, /const region = questWorld\.maps\.getRegion\(_questRegionIndex\(\)\);/);
  const run = (questWorld, region) => {
    restoreDiscovery(null);
    const notes = [];
    const fn = new Function('questWorld', '_questRegionIndex', 'discoverRandomLocation', 'getLocalizedLocationName', 'questBridge', 'REVEAL_NOTE_TEXT', `let _locationRevealedByMapItem = null; ${body} return revealLocation('readMap');`);
    return { got: fn(questWorld, () => region, (rows) => discoverRandomLocation(rows, seeded(3)), (id, n) => n, { notebook: { addNote: (t) => notes.push(t) } }, { readMap: 'map to %map' }), notes };
  };
  const L = await w.questLayerAt(SOLITUDE, w.sol);
  const far = run(L.questWorld, SKYRIM);
  assert.ok(far.got?.name, 'a place past the Bay revealed');
  const row = L.questWorld.maps.getRegion(SKYRIM).mapTable.find((r) => r.mapId === far.got.mapId);
  assert.ok(row, 'one of Skyrim\'s table');
  assert.equal(hasDiscoveredLocationId(far.got.mapId), true, 'discovered by its whole id');
  assert.deepEqual(far.notes, [`map to ${far.got.shown}`]);
  // the Bay's wilderness: a road pixel off any town (Daggerfall's region) reveals one of its region's rows
  const wild = { x: w.bayPx.x + 3, y: w.bayPx.y + 3 };
  const Lb = await w.questLayerAt(wild, w.bay);
  const r = w.maps.getRegionIndexAt(wild.x, wild.y);
  const bay = run(Lb.questWorld, r);
  assert.ok(bay.got?.name && w.maps.getRegion(r).mapTable.some((x) => x.mapId === bay.got.mapId), `the Bay's region ${r} (${REGION_NAMES[r]})`);
  restoreDiscovery(null);
});

test('BAY-LEFT-B B6: the Mages Guild\'s scrying past the Bay reads its province\'s table - a lair of the family nearest, never a town read as a crypt (mutants: the raw maps; the town\'s dungeon type)', { skip: NO_DATA }, async () => {
  const w = await world();
  setPref('lootRarity', true);   // the scrying is the loot-rarity row's (OFF IS DFU EXACTLY)
  restoreDiscovery(null);
  const L = await w.questLayerAt(SOLITUDE, w.sol);
  const where = { rows: scryRows(L.questWorld.maps.getRegion(SKYRIM)), at: { ...SOLITUDE } };
  assert.equal(scryRefusal({ items: [] }, 'undead', where), 'shards', 'past the gate a region stands: only the price refuses');
  const pick = nearestHidden(where.rows, 'undead', where.at);
  assert.ok(pick && familyKinds('undead').includes(pick.dungeonType));
  assert.equal((pick.mapId >>> 20) & 0xfff, LAIR_LANE, `${pick.name}: a lair past the Bay`);
  assert.ok(where.rows.filter((r) => r.dungeonType === DUNGEON_TYPES.NoDungeon).length >= 30, 'the towns no dungeon');
  assert.match(rd('src/scenes/world.js'), /const region = questWorld\.maps\.getRegion\(maps\.getRegionIndexAt\(at\.x, at\.y\)\);\n\s+return region \? \{ rows: scryRows\(region\), at: \{ x: at\.x, y: at\.y \} \} : null;/);
});

test('BAY-LEFT-B B7: %lp past the Bay is the province\'s own name (Skyrim, Cyrodiil, ...), the Bay\'s DFU\'s two (mutant: the province\'s arm)', async () => {
  const { REGION_RACES } = await import('../../../src/formats/mapsTables.js');
  const lp = (r) => getMacroValue('%lp', null, { world: { currentRegionIndex: () => r, currentRegionRace: () => REGION_RACES[r] + 1 } });
  assert.deepEqual([17, 20, 62, 63, 64, 65, 66, 67, 68, 69, 70].map(lp),
    ['High Rock', 'Hammerfell', 'High Rock', 'Hammerfell', 'Skyrim', 'Morrowind', 'Sumurset Isle', 'Valenwood', 'Elsweyr', 'Black Marsh', 'Cyrodiil']);
});
