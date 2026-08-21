// Q3-i - THE PLACE TRANCHE: Place.cs's site-resolution laws over a
// CRAFTED world seam - local/remote/fixed selection with the wildcard
// sets and every exclusion, quest-marker enumeration from the block
// shapes (editor flats 199.11/18), the marker selection/assignment
// law with culling, the player-at-place checks, the SiteLink
// machinery, the eight place actions, and the clock's travel arm
// through the port's real TravelTimeCalculator. The mock world speaks
// the EXACT shapes the port's MapsFile/BlocksFile serve, so the laws
// under test are the ones a running host exercises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { SITE_TYPES, MARKER_TYPES, THE_NAMED_RESIDENCE } from '../src/systems/quest/place.js';
import { READ_MAP_NOTE } from '../src/systems/quest/actions.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

// ---------------------------------------------------------------
// The crafted world - MapsFile/BlocksFile-shaped plain data
// ---------------------------------------------------------------

const flat = (record, x = 40, y = 8, z = 60) => ({ textureArchive: 199, textureRecord: record, xPos: x, yPos: y, zPos: z });
const building = (buildingType, { factionId = 0, nameSeed = 777, locationId = 0, sector = 0, quality = 9 } = {}) =>
  ({ buildingType, factionId, nameSeed, locationId, sector, quality });

/** An RMB block whose FLD list and subrecord interiors line up. */
function rmbBlock(buildings, interiors) {
  return {
    position: 5000,
    rmbBlock: {
      fldHeader: { buildingDataList: buildings, otherNames: null },
      subRecords: buildings.map((_, i) => ({ interior: { blockFlatObjectRecords: interiors[i] ?? [] } })),
    },
  };
}

/** An RDB block: every flat is an editor flat at archive 199. */
function rdbBlock(position, records) {
  return {
    position,
    rdbBlock: {
      objectRootList: [{
        rdbObjects: records.map((record, i) => ({
          type: 3,   // RDB_RESOURCE_TYPES.Flat
          position: 100 + i * 8,
          xPos: 10 + i, yPos: 4, zPos: 20 + i,
          resources: { flatResource: { textureArchive: 199, textureRecord: record } },
        })),
      }],
    },
  };
}

function makeLocation({ index, name, mapId, locationId, locationType, dungeonType = -1, blockNames = [], dungeonBlocks = null, buildings = [], pixel = { x: 100, y: 100 } }) {
  const world = mapPixelToWorldCoord(pixel.x, pixel.y);
  return {
    loaded: true,
    regionIndex: 0,
    regionName: 'Testshire',
    name,
    locationIndex: index,
    hasDungeon: dungeonBlocks !== null,
    mapTableData: { mapId, locationType, dungeonType },
    exterior: {
      buildings,
      recordElement: { header: { x: world.x, y: world.y } },
      exteriorData: { locationId, width: blockNames.length, height: blockNames.length ? 1 : 0, blockNames },
    },
    dungeon: dungeonBlocks ? { blocks: dungeonBlocks } : null,
  };
}

function makeWorld() {
  // Bigtown: one block - a tavern (named type, pool-merged), a house,
  // a Mages guildhall (faction 40), a Dark Brotherhood house-front
  // (faction 108, excluded), and a shop with NO markers (excluded).
  const townBuildings = [
    building(15),                          // tavern       - spawn+item markers
    building(17),                          // house1       - spawn marker
    building(11, { factionId: 40 }),       // guildhall    - spawn marker
    building(15, { factionId: 108 }),      // DB tavern    - excluded by faction
    building(9),                           // generalstore - item marker (the shop wildcards find it)
    building(18),                          // house2       - NO markers, excluded
    building(11, { factionId: 99 }),       // guildhall    - wrong faction for magery
  ];
  const townInteriors = [
    [flat(11), flat(18), flat(18, 41, 8, 61)],
    [flat(11)],
    [flat(11)],
    [flat(11), flat(18)],
    [flat(18)],
    [],
    [flat(11)],
  ];
  // the exterior directory pool for named types (tavern, guildhall,
  // tavern, shop - house types are not pool-named)
  const townExterior = [
    building(15, { nameSeed: 777 }),
    building(11, { factionId: 40, nameSeed: 778 }),
    building(15, { factionId: 108, nameSeed: 779 }),
    building(9, { nameSeed: 780 }),
    building(11, { factionId: 99, nameSeed: 781 }),
  ];
  const blocks = {
    'TESTAA00.RMB': rmbBlock(townBuildings, townInteriors),
    'TESTDA00.RDB': rdbBlock(9000, [11, 18, 18, 10]),   // 2 item + 1 spawn + a start marker (ignored)
    'TESTDB00.RDB': rdbBlock(12000, [11]),
  };
  const locations = [
    makeLocation({ index: 0, name: 'Bigtown', mapId: 111, locationId: 0x400, locationType: 0, blockNames: ['TESTAA00.RMB'], buildings: townExterior, pixel: { x: 100, y: 100 } }),
    makeLocation({ index: 1, name: 'Darkhole', mapId: 222, locationId: 0x401, locationType: 7, dungeonType: 2, dungeonBlocks: [{ x: 0, z: 0, blockName: 'TESTDA00.RDB' }, { x: 1, z: 0, blockName: 'TESTDB00.RDB' }], pixel: { x: 101, y: 100 } }),
    makeLocation({ index: 2, name: 'Smallville', mapId: 333, locationId: 0x402, locationType: 2, blockNames: ['TESTAA00.RMB'], buildings: townExterior, pixel: { x: 102, y: 100 } }),
    // Llugwych: a FIXED town (Quests-Places p1 = 0xc352)
    makeLocation({ index: 3, name: 'Llugwych', mapId: 444, locationId: 0xc352, locationType: 0, blockNames: [], pixel: { x: 103, y: 100 } }),
    // Castle_Faallem: p1 = 0x5d6c resolves only as p1-1 -> DUNGEON
    makeLocation({ index: 4, name: 'Faallem', mapId: 555, locationId: 0x5d6b, locationType: 7, dungeonType: 1, dungeonBlocks: [{ x: 0, z: 0, blockName: 'TESTDA00.RDB' }], pixel: { x: 104, y: 100 } }),
    // Farfort: 200 map pixels out - the travel literal's target
    // Farfort answers the FIXED row Castle_Necromoghan (p1 0x4587)
    makeLocation({ index: 5, name: 'Farfort', mapId: 666, locationId: 0x4587, locationType: 1, blockNames: [], pixel: { x: 300, y: 100 } }),
  ];
  const region = {
    name: 'Testshire',
    locationCount: locations.length,
    mapTable: locations.map((l) => ({ mapId: l.mapTableData.mapId, locationType: l.mapTableData.locationType, dungeonType: l.mapTableData.dungeonType })),
  };
  const calls = [];
  const capture = (name) => (...args) => calls.push([name, ...args]);
  const world = {
    maps: {
      regionCount: 1,
      getRegion: () => region,
      getLocation: (r, l) => locations[l] ?? null,
      getLocationByName: (rn, ln) => locations.find((l) => l.regionName === rn && l.name === ln) ?? null,
      getRmbBlockName: (loc, x, y) => loc.exterior.exteriorData.blockNames[y * loc.exterior.exteriorData.width + x],
      readLocationIdFast: (r, l) => locations[l].exterior.exteriorData.locationId,
      getClimateIndex: () => 231,
    },
    getBlock: (name) => blocks[name] ?? null,
    currentLocation: () => world._current,
    currentRegionIndex: () => 0,
    currentLocationIndex: () => world._currentIndex,
    currentRegionName: () => 'Testshire',
    isPlayerInLocationRect: () => world._inRect,
    playerInside: () => world._inside,
    isHouseOwned: (key) => world._owned.has(key),
    playerPixel: () => ({ x: 100, y: 100 }),
    buildingNameOpts: () => ({}),
    discoverLocation: capture('discoverLocation'),
    addNote: capture('addNote'),
    teleportPc: capture('teleportPc'),
    _current: locations[0],
    _currentIndex: 0,
    _inRect: true,
    _inside: null,
    _owned: new Set(),
    _locations: locations,
    _calls: calls,
  };
  return world;
}

function makeMachine(world, deps = {}) {
  const calls = [];
  const m = new QuestMachine({
    nowSeconds: () => m.now,
    world,
    showPopup: (q, message) => calls.push(['showPopup', message]),
    forceTopicListsUpdate: () => calls.push(['forceTopicListsUpdate']),
    ...deps,
  });
  m.now = 0;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __QP', 'QRC:', 'Message:  1011', ' x', '', 'QBN:'];
const schedule = (m, qbn, { rolls = () => 0 } = {}) => m.scheduleQuest([...HEADER, ...qbn], 0, { rolls });

// ---------------------------------------------------------------
// Site resolution
// ---------------------------------------------------------------

test('local site: the tavern collector walks the blocks, names the building, and excludes DB/markerless sites', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Place _pub_ local tavern', '', 'variable _pad_']);
  const place = q.getResource({ name: 'pub' });
  assert.equal(place.sitePending, false, 'the site resolved AT PARSE');
  const sd = place.siteDetails;
  assert.equal(sd.siteType, SITE_TYPES.Building);
  assert.equal(sd.mapId, 111);
  assert.equal(sd.locationName, 'Bigtown');
  // only ONE eligible tavern: the faction-108 one is excluded
  // (Dark Brotherhood, FactionIDs 108) even though it has markers
  assert.equal(sd.buildingKey, 1 << 24, 'block 0,0 record 0 packs to 0 - the sentinel');
  assert.ok(sd.buildingName.length > 0, 'the tavern drew a generated name');
  assert.equal(sd.questSpawnMarkers.length, 1);
  assert.equal(sd.questItemMarkers.length, 2);
  assert.equal(sd.questSpawnMarkers[0].markerType, MARKER_TYPES.QuestSpawn);
  // marker positions scale (x, -y, z) * GlobalScale 0.025
  assert.deepEqual(sd.questSpawnMarkers[0].flatPosition, { x: 1, y: -0.2, z: 1.5 });
});

test('local site: the house form draws "The %s Residence"; an owned house is excluded', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Place _home_ local house', '', 'variable _pad_']);
  const sd = q.getResource({ name: 'home' }).siteDetails;
  assert.equal(sd.siteType, SITE_TYPES.Building);
  assert.match(sd.buildingName, /^The .+ Residence$/, THE_NAMED_RESIDENCE);
  assert.equal(sd.buildingKey, 1, 'block 0,0 record 1 - only key 0 maps to the sentinel');

  // ...and with that house owned by the player, the collection fails
  // through the house fallback and throws (no other house exists)
  const world2 = makeWorld();
  world2._owned.add(1);
  const m2 = makeMachine(world2);
  assert.throws(() => schedule(m2, ['Place _home_ local house', '', 'variable _pad_']),
    /Could not find local site/);
});

test('local site: the magery guildhall matches ONLY faction 40 halls', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Place _hall_ local magery', '', 'variable _pad_']);
  const sd = q.getResource({ name: 'hall' }).siteDetails;
  assert.equal(sd.buildingKey, 2, 'the faction-40 guildhall record');
});

test('remote site: the dungeon selector filters type, excludes assigned dungeons, and enumerates RDB markers with classic marker ids', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Place _lair_ remote dungeon2', '', 'variable _pad_']);
  const sd = q.getResource({ name: 'lair' }).siteDetails;
  assert.equal(sd.siteType, SITE_TYPES.Dungeon);
  assert.equal(sd.locationName, 'Darkhole', 'the only dungeonType-2 dungeon');
  // TESTDA00: spawn(11) at object 0, items(18) at 1 and 2; TESTDB00: spawn
  assert.equal(sd.questSpawnMarkers.length, 2);
  assert.equal(sd.questItemMarkers.length, 2);
  // markerID = block position + object position, the classic identity
  assert.equal(sd.questSpawnMarkers[0].markerID, 9000 + 100);
  assert.equal(sd.questItemMarkers[0].markerID, 9000 + 108);
  assert.equal(sd.questSpawnMarkers[1].markerID, 12000 + 100);
  assert.equal(sd.questSpawnMarkers[1].dungeonX, 1, 'the second block carries its X');

  // a second quest asking for ANY dungeon must SKIP the assigned one -
  // Darkhole is taken, Faallem (type 1) is the only one left
  const q2 = schedule(m, ['Place _lair2_ remote dungeon', '', 'variable _pad_']);
  m.tick();   // q must be LIVE for getAllActiveQuestSites to see it
  void q2;
  const q3 = schedule(m, ['Place _lair3_ remote dungeon', '', 'variable _pad_']);
  const sd3 = q3.getResource({ name: 'lair3' }).siteDetails;
  assert.equal(sd3.locationName, 'Faallem', 'the machine-wide assigned-dungeon exclusion');
});

test('fixed site: p1 resolves a town directly, p1-1 resolves a dungeon, and 0xfa p2 carries the magic number', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  // Llugwych: Quests-Places p1 = 0xc352 -> the town's own locationId
  const q = schedule(m, ['Place _keep_ permanent Llugwych', '', 'variable _pad_']);
  const sd = q.getResource({ name: 'keep' }).siteDetails;
  assert.equal(sd.siteType, SITE_TYPES.Town);
  assert.equal(sd.locationName, 'Llugwych');
  assert.equal(sd.magicNumberIndex, 0, 'towns carry no magic number');

  // Castle_Faallem: p1 = 0x5d6c misses, p1-1 = 0x5d6b hits a
  // hasDungeon location -> Dungeon site; p2 = 0xfa01 -> index 1
  const q2 = schedule(m, ['Place _castle_ permanent Castle_Faallem', '', 'variable _pad_']);
  const sd2 = q2.getResource({ name: 'castle' }).siteDetails;
  assert.equal(sd2.siteType, SITE_TYPES.Dungeon);
  assert.equal(sd2.locationName, 'Faallem');
  assert.equal(sd2.magicNumberIndex, 1, 'p2 0xfa01 masks to 1');
});

test('headless: with NO world seam every Place pends its site LOUDLY and the corpus parse stands', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = m.scheduleQuest([...HEADER, 'Place _pub_ local tavern', '', 'variable _pad_'], 0, { rolls: () => 0 });
  const place = q.getResource({ name: 'pub' });
  assert.equal(place.sitePending, true);
  assert.equal(place.siteDetails, null);
});

// ---------------------------------------------------------------
// Assignment, SiteLinks, actions
// ---------------------------------------------------------------

test('PlaceNpc/PlaceItem/PlaceFoe: SiteLinks reserve, markers take the right types, the person unhides', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Item _l_ letter', '',
    'Foe _crook_ is Thief', '',
    'Place _pub_ local tavern', '',
    ' place npc _pp_ at _pub_',
    ' place item _l_ at _pub_',
    ' place foe _crook_ at _pub_',
    ' hide npc _pp_',
  ]);
  m.tick(); m.tick();
  const sd = q.getResource({ name: 'pub' }).siteDetails;
  assert.equal(m.siteLinks.length, 1, 'one SiteLink for the one Place');
  assert.equal(m.siteLinks[0].buildingKey, sd.buildingKey);
  assert.equal(m.hasSiteLink(q, q.getResource({ name: 'pub' }).symbol), true);
  // person + foe land on the SELECTED spawn marker; the item follows
  // Item preference to the item markers only when unassigned -
  // GetSiteMarker reuses the selected marker once set (C#'s law)
  const names = sd.selectedMarker.targetResources.map((s) => s.name);
  assert.deepEqual(names, ['pp', 'l', 'crook'], 'the selected-marker reuse law pins all three');
  assert.equal(q.getResource({ name: 'pp' }).assignedPlaceSymbol.name, 'pub');
  assert.equal(m.of('forceTopicListsUpdate').length, 1);
});

test('assignQuestResource: preferred marker types, anymarker pool, and the machine cull on movement', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Item _l_ letter', '',
    'Place _pub_ local tavern', '',
    'Place _lair_ remote dungeon2', '',
    ' place item _l_ at _pub_',
    '',
    '_move_ task:',
    ' place item _l_ at _lair_ marker 1',
    '',
    'variable _pad_',
  ]);
  m.tick();
  const pub = q.getResource({ name: 'pub' });
  assert.deepEqual(pub.siteDetails.selectedMarker.targetResources.map((s) => s.name), ['l']);
  assert.equal(pub.siteDetails.selectedMarker.markerType, MARKER_TYPES.QuestItem, 'an Item prefers item markers');
  // moving the item to the dungeon CULLS it from the tavern marker
  q.getTask({ name: 'move' }).start();
  m.tick();
  assert.deepEqual(pub.siteDetails.selectedMarker.targetResources, [], 'culled from the old site');
  const lair = q.getResource({ name: 'lair' });
  assert.deepEqual(lair.siteDetails.selectedMarker.targetResources.map((s) => s.name), ['l']);
  assert.equal(lair.siteDetails.selectedMarker.markerID, 9000 + 116, 'marker index 1 of the item markers');
});

test('isPlayerHere + PcAt: building/town/dungeon checks and the set/clear toggle with its once-saying', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Place _pub_ local tavern', '',
    ' pc at _pub_ set _seen_ saying 1011',
    '',
    'variable _seen_',
  ]);
  m.tick();
  const pub = q.getResource({ name: 'pub' });
  assert.equal(pub.isPlayerHere(), false, 'outside');
  // inside the WRONG building
  world._inside = { building: { buildingKey: 12345, buildingType: 15, factionId: 0 } };
  m.tick();
  assert.equal(q.getTask({ name: 'seen' }).getTriggerValue(), false);
  // inside the tavern
  world._inside = { building: { buildingKey: pub.siteDetails.buildingKey, buildingType: 15, factionId: 0 } };
  m.tick();
  assert.equal(q.getTask({ name: 'seen' }).getTriggerValue(), true);
  assert.equal(m.of('showPopup').length, 1, 'the saying showed');
  // leaving CLEARS the task, and the saying never repeats
  world._inside = null;
  m.tick();
  assert.equal(q.getTask({ name: 'seen' }).getTriggerValue(), false, 'PcAt clears on leave');
  world._inside = { building: { buildingKey: pub.siteDetails.buildingKey, buildingType: 15, factionId: 0 } };
  m.tick();
  assert.equal(q.getTask({ name: 'seen' }).getTriggerValue(), true);
  assert.equal(m.of('showPopup').length, 1, 'the saying shows ONCE');
});

test('PcAt "any" form: the placeType goes through Quests-Places (house p1=0 p3=1)', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    ' pc at any house set _inhouse_',
    '',
    'variable _inhouse_',
  ]);
  world._inside = { building: { buildingKey: 1, buildingType: 17, factionId: 0 } };   // House1
  m.tick();
  assert.equal(q.getTask({ name: 'inhouse' }).getTriggerValue(), true, 'House1 is a valid house type');
  world._inside = { building: { buildingKey: 1, buildingType: 15, factionId: 0 } };   // Tavern
  m.tick();
  assert.equal(q.getTask({ name: 'inhouse' }).getTriggerValue(), false, 'a tavern is not a house');
});

test('town and dungeon isPlayerHere: rect and mapId gates', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Place _town_ permanent Llugwych', '',
    'Place _lair_ remote dungeon2', '',
    'variable _pad_',
  ]);
  const town = q.getResource({ name: 'town' });
  const lair = q.getResource({ name: 'lair' });
  assert.equal(town.isPlayerHere(), false, 'current location is Bigtown, not Llugwych');
  world._current = world._locations[3];
  assert.equal(town.isPlayerHere(), true, 'outside + in rect + matching mapId');
  world._inRect = false;
  assert.equal(town.isPlayerHere(), false, 'outside the location rect');
  world._inRect = true;
  world._inside = { dungeon: { dungeonType: 2 } };
  assert.equal(town.isPlayerHere(), false, 'a town site needs the player OUTSIDE');
  world._current = world._locations[1];
  assert.equal(lair.isPlayerHere(), true, 'inside the dungeon at its mapId');
});

test('RevealLocation: discovers the location; readmap adds the grounded note', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  schedule(m, [
    'Place _lair_ remote dungeon2', '',
    ' reveal _lair_',
    ' reveal _lair_ readmap',
  ]);
  m.tick();
  assert.deepEqual(world._calls.filter((c) => c[0] === 'discoverLocation').map((c) => c[2]),
    ['Darkhole', 'Darkhole']);
  assert.deepEqual(world._calls.filter((c) => c[0] === 'addNote').map((c) => c[1]),
    [READ_MAP_NOTE.replace('%map', 'Darkhole')]);
});

test('DroppedItemAtPlace: watches the item, gates allowDrop on presence, fires once on the drop', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Item _l_ letter', '',
    'Place _pub_ local tavern', '',
    '_t_ task:', ' dropped _l_ at _pub_ saying 1011', '',
    'variable _pad_',
  ]);
  m.tick();
  const item = q.getResource({ name: 'l' });
  const pub = q.getResource({ name: 'pub' });
  assert.equal(item.actionWatching, true);
  assert.equal(item.allowDrop, false, 'not at the place');
  world._inside = { building: { buildingKey: pub.siteDetails.buildingKey, buildingType: 15, factionId: 0 } };
  m.tick();
  assert.equal(item.allowDrop, true, 'at the place the drop opens');
  item.playerDropped = true;
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true);
  assert.equal(m.of('showPopup').length, 1);
});

test('TeleportPc carries the marker through the world seam; CreateNpcAt is the documented no-op', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Place _lair_ remote dungeon2', '',
    ' teleport pc to _lair_',
    ' create npc at _lair_',
  ]);
  m.tick();
  const tp = world._calls.filter((c) => c[0] === 'teleportPc');
  assert.equal(tp.length, 1);
  assert.equal(tp[0][1], q.getResource({ name: 'lair' }));
  assert.equal(tp[0][2], q.getResource({ name: 'lair' }).siteDetails.questSpawnMarkers[0],
    'the plain form still lands on spawn marker 0 (TeleportPc.cs:126-129)');
  assert.equal(m.siteLinks.length, 1, 'TeleportPc reserved the SiteLink; CreateNpcAt reserves nothing');
});

test('clock travel arm: flag&16 clocks arm from the REAL calculator - the one-day floor and the 2.5x return trip', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  // DFU parses resources in LINE ORDER: a flag&16 clock computes its
  // travel time from the places parsed BEFORE it, so the Place comes
  // first (the corpus convention for travel clocks).
  const q = schedule(m, [
    'Place _lair_ remote dungeon2', '',
    'Clock _c_ flag 16', '',
    '_c_ task:', ' end quest', '',
    'variable _pad_',
  ]);
  const clock = q.getResource({ name: 'c' });
  assert.equal(clock.travelTimePending, false, 'the world seam resolves the arm at parse');
  // one map pixel away -> under a day -> floors to 1440 minutes
  // (86400s) per place, and the return multiplier LANDS ON THE SUM:
  // trunc(86400 * 2.5) = 216000
  assert.equal(clock.startingTimeInSeconds, 216000);
  assert.equal(q.travelSecondsTo(q.getResource({ name: 'lair' })), 86400, 'the _2place_ arm is one-way');
});

// ---------------------------------------------------------------
// Q3-i MUTATION PINS - campaign survivors, each now a law with a pin
// that fails under its one-character mutant.
// ---------------------------------------------------------------

test('MUTATION: the site enums and wildcard sets are DFU literals', async () => {
  const { SITE_TYPES: ST, MARKER_TYPES: MT, MARKER_PREFERENCE: MP,
    VALID_BUILDING_TYPES, VALID_HOUSE_TYPES, VALID_SHOP_TYPES } = await import('../src/systems/quest/place.js');
  assert.deepEqual({ ...ST }, { None: 0, Town: 1, Dungeon: 2, Building: 3 });
  assert.deepEqual({ ...MT }, { None: -1, QuestSpawn: 11, QuestItem: 18 });
  assert.deepEqual({ ...MP }, { Default: 0, UseQuestMarker: 1, AnyMarker: 2 });
  assert.deepEqual([...VALID_BUILDING_TYPES], [0, 2, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 17, 18, 19, 20]);
  assert.deepEqual([...VALID_HOUSE_TYPES], [17, 18, 19, 20]);
  assert.deepEqual([...VALID_SHOP_TYPES], [0, 2, 5, 6, 7, 8, 9, 12, 13]);
});

test('MUTATION: the shop wildcard and the SPECIFIC store form both land on the store, not the ALL_VALID pool', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Place _s_ local shop', '', 'variable _pad_']);
  assert.equal(q.getResource({ name: 's' }).siteDetails.buildingKey, 4, 'ANY_SHOP finds the store record');
  // a SECOND quest (the same-quest exclusion would bar a second claim)
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, ['Place _st_ local generalstore', '', 'variable _pad_']);
  assert.equal(q2.getResource({ name: 'st' }).siteDetails.buildingKey, 4, 'the specific form must NOT widen to AllValid');
});

test('MUTATION: a missing house6 falls back to ANY house; a Fixed place with p1 <= 0x300 still throws', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Place _h6_ local house6', '', 'variable _pad_']);
  assert.equal(q.getResource({ name: 'h6' }).siteDetails.buildingKey, 1, 'the House1..House6 fallback');
  const m2 = makeMachine(makeWorld());
  assert.throws(() => schedule(m2, ['Place _bad_ permanent tavern', '', 'variable _pad_']),
    /Invalid placeType/, "the Fixed gate needs p1 > 0x300 - 'tavern' p1=0 fails it even with a world");
});

test('MUTATION: a location whose ONLY tavern is Dark Brotherhood cannot host a local tavern', () => {
  const world = makeWorld();
  // rebuild Bigtown's block with JUST the DB tavern
  const dbOnly = {
    position: 5000,
    rmbBlock: {
      fldHeader: { buildingDataList: [building(15, { factionId: 108 })], otherNames: null },
      subRecords: [{ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } }],
    },
  };
  world.getBlock = () => dbOnly;
  world._locations[0].exterior.buildings = [building(15, { factionId: 108 })];
  const m = makeMachine(world);
  assert.throws(() => schedule(m, ['Place _pub_ local tavern', '', 'variable _pad_']),
    /Could not find local site/, 'faction 108 is banned however good its markers');
});

test('MUTATION: a missing numbered dungeon type retries as ANY dungeon', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['Place _lair_ remote dungeon9', '', 'variable _pad_']);
  const sd = q.getResource({ name: 'lair' }).siteDetails;
  assert.equal(sd.siteType, SITE_TYPES.Dungeon);
  assert.equal(sd.locationName, 'Darkhole', 'no type-9 dungeons: the -1 retry finds the first by roll 0');
});

test('MUTATION: the dungeon-type collector - graveyards and ruins count, types past 16 never', async () => {
  const { Place } = await import('../src/systems/quest/place.js');
  const region = {
    locationCount: 5,
    mapTable: [
      { mapId: 1, locationType: 7, dungeonType: 2 },    // keep
      { mapId: 2, locationType: 12, dungeonType: 5 },   // graveyard - IS a dungeon type
      { mapId: 3, locationType: 10, dungeonType: 3 },   // ruin - IS a dungeon type
      { mapId: 4, locationType: 7, dungeonType: 17 },   // type 17 - NEVER for quests
      { mapId: 5, locationType: 0, dungeonType: 2 },    // a town - not a dungeon location
    ],
  };
  const stub = Object.create(Place.prototype);
  stub.parentQuest = { hooks: {}, resources: new Map() };
  assert.deepEqual(stub._collectDungeonIndicesOfType(region, -1), [0, 1, 2], 'types 0-16 from dungeon-typed locations only');
  assert.deepEqual(stub._collectDungeonIndicesOfType(region, 5), [1], 'the graveyard by its type');
  assert.deepEqual(stub._collectDungeonIndicesOfType(region, 17), [3], 'a SPECIFIC 17 request still honors it - only the -1 range caps at 16');
});

test('MUTATION: a direct marker index assigns the person to THAT spawn marker slot', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Item _l_ letter', '',
    'Place _pub_ local tavern', '',
    ' place item _l_ at _pub_',
    '',
    '_re_ task:',
    ' place npc _pp_ at _pub_ marker 0',
    '',
    'variable _pad_',
  ]);
  m.tick();
  const sd = q.getResource({ name: 'pub' }).siteDetails;
  q.getTask({ name: 're' }).start();
  m.tick();
  assert.deepEqual(sd.questSpawnMarkers[0].targetResources?.map((s) => s.name) ?? [], ['pp'],
    'selected-marker already set + explicit index -> DIRECT assignment to the spawn slot');
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['l'],
    'the selected marker keeps only the item');
});

test('MUTATION: PlaceNpc UNHIDES a hidden person; "transfer pc inside X marker 0" carries the marker', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Place _pub_ local tavern', '',
    'Place _lair_ remote dungeon2', '',
    ' hide npc _pp_',
    ' place npc _pp_ at _pub_',
    ' transfer pc inside _lair_ marker 0',
  ]);
  m.tick();
  assert.equal(q.getResource({ name: 'pp' }).isHidden, false, 'placing unhides');
  const tp = world._calls.filter((c) => c[0] === 'teleportPc');
  assert.equal(tp.length, 1);
  assert.equal(tp[0][2], q.getResource({ name: 'lair' }).siteDetails.questSpawnMarkers[0],
    'the transfer form passes spawn marker 0');
});

test('MUTATION: getSiteLinks zero-wildcards and the two-resource cull', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  m.addSiteLink({ questUID: 1, placeSymbol: null, siteType: SITE_TYPES.Building, mapId: 111, buildingKey: 5, magicNumberIndex: 0 });
  m.addSiteLink({ questUID: 1, placeSymbol: null, siteType: SITE_TYPES.Dungeon, mapId: 222, buildingKey: 0, magicNumberIndex: 2 });
  assert.equal(m.getSiteLinks(SITE_TYPES.Building, 111, 0, 0).length, 1, 'buildingKey 0 is a wildcard');
  assert.equal(m.getSiteLinks(SITE_TYPES.Building, 111, 5, 0).length, 1, 'exact key matches');
  assert.equal(m.getSiteLinks(SITE_TYPES.Building, 111, 7, 0).length, 0, 'a wrong key filters');
  assert.equal(m.getSiteLinks(SITE_TYPES.Dungeon, 222, 0, 9).length, 0, 'a wrong magic number filters');
  assert.equal(m.getSiteLinks(SITE_TYPES.Dungeon, 222, 0, 2).length, 1, 'the exact magic number matches');
  assert.equal(m.getSiteLinks(SITE_TYPES.Dungeon, 111, 0, 0).length, 0, 'siteType+mapId always gate');

  // two resources on one marker: the cull removes ONLY the moved one
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, [
    'Person _pp_ group Questor', '',
    'Item _l_ letter', '',
    'Place _pub_ local tavern', '',
    'Place _lair_ remote dungeon2', '',
    ' place npc _pp_ at _pub_',
    ' place item _l_ at _pub_',
    '',
    '_mv_ task:',
    ' place item _l_ at _lair_',
    '',
    'variable _pad_',
  ]);
  m2.tick();
  q2.getTask({ name: 'mv' }).start();
  m2.tick();
  const pub2 = q2.getResource({ name: 'pub' }).siteDetails;
  assert.deepEqual(pub2.selectedMarker.targetResources.map((s) => s.name), ['pp'],
    'the person stays; only the moved item leaves');
});

test('MUTATION: the bare clock draw, the _2place_ start arm, and the FAR travel literals', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  // bare "Clock _c_": Random.Range(1 minute, 1 week + 1) at roll 0.5
  const q = schedule(m, [
    'Clock _c_', '',
    '_c_ task:', ' end quest', '',
    'variable _pad_',
  ], { rolls: () => 0.5 });
  assert.equal(q.getResource({ name: 'c' }).startingTimeInSeconds, 60 + Math.floor(0.5 * (604800 + 1 - 60)),
    'fromRange(1 minute, 7 days) seeded');

  // _2place_ arm: a clock named _2lair_ takes the ONE-WAY trip at start
  const m2 = makeMachine(makeWorld());
  const q2 = schedule(m2, [
    'Place _lair_ remote dungeon2', '',
    'Clock _2lair_ 0.0:00', '',
    '_2lair_ task:', ' end quest', '',
    'start timer _2lair_',
  ]);
  m2.tick();
  const c2 = q2.getResource({ name: '2lair' });
  assert.equal(c2.startingTimeInSeconds, 86400, 'the one-way near trip floors to a day');
  assert.equal(c2.clockEnabled, true);

  // FAR: 200 map pixels over uniform climate 231 = 18000 cautious
  // minutes one-way (the REAL calculator); pinned as LITERALS so the
  // argument row, the 2.5x, the floor and the trunc all bite.
  const world3 = makeWorld();
  const m3 = makeMachine(world3);
  const q3 = schedule(m3, ['Place _far_ permanent Castle_Necromoghan', '', 'variable _pad_']);
  assert.equal(q3.travelSecondsTo(q3.getResource({ name: 'far' })), 1080000, 'one-way: 18000 minutes');
  assert.equal(q3.travelSeconds(), 2700000, 'the all-places return trip: trunc(18000*60 * 2.5)');
});

test('MUTATION-2: PlaceFoe "marker N" assigns DIRECTLY to the spawn slot, not the selected marker', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Item _l_ letter', '',
    'Foe _crook_ is Thief', '',
    'Place _pub_ local tavern', '',
    ' place item _l_ at _pub_',
    '',
    '_f_ task:',
    ' place foe _crook_ at _pub_ marker 0',
    '',
    'variable _pad_',
  ]);
  m.tick();
  q.getTask({ name: 'f' }).start();
  m.tick();
  const sd = q.getResource({ name: 'pub' }).siteDetails;
  assert.deepEqual(sd.questSpawnMarkers[0].targetResources?.map((s) => s.name) ?? [], ['crook'],
    'the marker form must survive the alternation - a lost index would dump the foe on the selected ITEM marker');
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['l']);
});

test('MUTATION-2: a plain zero clock arms and fires instantly - only PENDING travel holds a timer', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = m.scheduleQuest([...HEADER,
    'Clock _z_ 0.0:00', '',
    '_z_ task:', ' end quest', '',
    'start timer _z_',
  ], 0, { rolls: () => 0 });
  m.tick();   // the startup's start-timer arms it (resources tick before tasks)
  const z = q.getResource({ name: 'z' });
  assert.equal(z.travelTimePending, false);
  assert.equal(z.clockEnabled, true, 'armed - the HELD arm is for PENDING travel only');
  m.tick();   // the clock resource ticks at zero remaining and fires
  assert.equal(z.clockFinished, true, 'a zero clock fires immediately');
});

// ---------------------------------------------------------------
// Q3-i VERIFY (the adversarial-review fixes, each pinned)
// ---------------------------------------------------------------

test('VERIFY: marker STRUCT-COPY law - the normal path builds the list on the COPY, array slots stay null', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Place _pub_ local tavern', '',
    ' place npc _pp_ at _pub_',
  ]);
  m.tick();
  const sd = q.getResource({ name: 'pub' }).siteDetails;
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['pp']);
  assert.equal(sd.questSpawnMarkers[0].targetResources, null,
    'QuestMarker is a C# struct: selection COPIES, so the pool slot never sees the normal-path list');
});

test('VERIFY: a tombstoned quest takes its SiteLinks with it (RemoveAllQuestSiteLinks)', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Place _pub_ local tavern', '',
    ' place npc _pp_ at _pub_',
    ' end quest',
  ]);
  m.tick();
  assert.equal(m.siteLinks.length, 1);
  m.tick(); m.tick();   // the end-quest grace elapses; the machine tombstones
  assert.equal(q.questTombstoned, true);
  assert.equal(m.siteLinks.length, 0, 'the dead quest cannot make hasSiteLink lie to the next one');
});

test('VERIFY: DroppedItemAtPlace is the PRIMARY always-on trigger - a co-resident when is start-only', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    'Item _l_ letter', '',
    'Place _pub_ local tavern', '',
    'variable _x_', '',
    '_t_ task:',
    ' dropped _l_ at _pub_',
    ' when _x_', '',
    'variable _pad_',
  ]);
  m.tick();
  q.getTask({ name: 'x' }).start();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'the SECONDARY when can START the task');
  q.getTask({ name: 'x' }).clear();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true,
    'but never STOP it - dropped holds the primary slot (DroppedItemAtPlace.cs:34-35)');
});

test('VERIFY: anymarker at a one-type site error-terminates the quest, as C#\'s AddRange NRE does', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  // the house (record 1) has ONLY a spawn marker
  const q = schedule(m, [
    'Item _l_ letter', '',
    'Place _home_ local house', '',
    ' place item _l_ at _home_ anymarker',
  ]);
  m.tick();
  assert.equal(q.questTombstoned, true, 'the AddRange throw error-terminates through the machine catch');
  assert.equal(m.quests.has(q.uid), false);
});

test('VERIFY: customParseInt - int.Parse strictness and the case-sensitive Replace quirk', async () => {
  const { customParseInt } = await import('../src/systems/quest/place.js');
  assert.equal(customParseInt('0xc352'), 0xc352);
  assert.equal(customParseInt(' 42 '), 42, 'int.Parse tolerates surrounding whitespace');
  assert.equal(customParseInt('-7'), -7);
  assert.throws(() => customParseInt('12abc'), /int.Parse failed/, 'trailing garbage throws, never truncates');
  assert.throws(() => customParseInt('12.5'), /int.Parse failed/);
  assert.throws(() => customParseInt('0X1A'), /int.Parse failed/,
    "the C# quirk: StartsWith ignores case but Replace('0x') does not - an uppercase prefix throws");
});
