// START3 (2026-10-25, bible/06-Systems/Alternate-Starts-Arc.md section 12; the owner: "Fix the known gap"): A QUEST'S
// PLACE PAST THE BAY ON THE PLAYER'S MAP. The held map's quest marks, the street compass and the journal's find found a
// quest's place through MAPS.BSA's tables alone, and MAPS.BSA holds no place off the Bay's table - a province's start
// dungeon, an Arena town's guild job, any site TESA stands. A site past the Bay now keeps its own map pixel
// (systems/quest/place.js siteWorldPixel), and every face reads it there: the one "is it on my map" law
// (ui/travel/travelMapWindow.js canFindPlace), the lens's `find` (ui/quest/questLens.js entryTarget), the marks' bound
// (ui/quest/questMarks.js readQuestMarks, the continent's frame), the held map's press and goto (ui/heldMap.js), and the
// host's one pixel reader (scenes/world.js questPixel).
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { siteWorldPixel, SITE_TYPES } from '../../../src/systems/quest/place.js';
import { STARTS, startOfSiteId } from '../../../src/systems/starts/starts.js';
import { mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { canFindPlace } from '../../../src/ui/travel/travelMapWindow.js';
import { entryTarget } from '../../../src/ui/quest/questLens.js';
import { questMapMarks, readQuestMarks } from '../../../src/ui/quest/questMarks.js';
import { pastBayOnMap } from '../../../src/ui/map/mapSkin.js';
import { _resetForTests, setPref } from '../../../src/systems/uiPrefs.js';
import { HeldMapWindow } from '../../../src/ui/heldMap.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { FACTION_TYPES } from '../../../src/formats/factionFile.js';
import { ROOT, packMachine, loadTables } from '../../qlSources.mjs';
import { town, dungeon, rmbBlock, worldOf, SPAWN, ITEM } from '../../fb1004dTowns.mjs';

const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };
afterEach(() => { _resetForTests(); delete globalThis.location; });

/** A lair past the Bay: Skyrim's, north-east of the Bay's table, its row's longitude and latitude where TESA8's clone
 *  writes them (world/tamrielDungeons.js synthesizeLairLocation). */
const LAIR_PX = { x: 1203, y: -88 };
const LAIR_MAP_ID = ((0x340 << 20) | 0x80000 | 12345) >>> 0;
const FLAT = (record, x, y, z) => ({ type: 3, position: record, xPos: x, yPos: y, zPos: z, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
const LAIR_BLOCK = { position: 0, rdbBlock: { objectRootList: [{ rdbObjects: [FLAT(ITEM, 800, -40, 1200), FLAT(SPAWN, 200, -40, 300)] }] } };

function pastBay() {
  loadTables();
  const lair = dungeon({ name: 'The Haunt of Baringon', locationIndex: 99, mapId: LAIR_MAP_ID, dungeonType: 8, block: 'N0000099.RDB', regionIndex: 64, regionName: 'Skyrim' });
  const ll = mapPixelToLongitudeLatitude(LAIR_PX.x, LAIR_PX.y);
  lair.mapTableData = { ...lair.mapTableData, longitude: ll.x, latitude: ll.y };
  const city = town({ name: 'Daggerfall', locationIndex: 0, mapId: 1291010263, grid: ['CITY.RMB'] });
  city.exterior.exteriorData.locationId = 0xc36a;
  const ell = mapPixelToLongitudeLatitude(207, 213);   // the Bay's own row: Daggerfall's pixel
  city.mapTableData = { ...city.mapTableData, longitude: ell.x, latitude: ell.y };
  const hold = dungeon({ name: "Privateer's Hold", locationIndex: 3, mapId: 187853213, dungeonType: 0, block: 'S0000999.RDB' });
  hold.exterior.exteriorData.locationId = 0xc381;
  const locations = [city, town({ name: 'Woodcroft Hall', locationIndex: 1, mapId: 5002, grid: ['INN.RMB'] }), town({ name: 'Ashwick Farm', locationIndex: 2, mapId: 5003, grid: ['FARM.RMB'] }), hold];
  locations[1].exterior.buildings.push({ buildingType: BUILDING_TYPES.Tavern, factionId: 0, nameSeed: 100, quality: 10 });
  const blocks = new Map([['N0000099.RDB', LAIR_BLOCK], ['S0000999.RDB', LAIR_BLOCK], ['CITY.RMB', rmbBlock('CITY.RMB', [{ type: BUILDING_TYPES.Palace }])],
    ['INN.RMB', rmbBlock('INN.RMB', [{ type: BUILDING_TYPES.Tavern }])], ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: BUILDING_TYPES.House1 }])]]);
  const base = worldOf({ locations, blocks });
  const where = { loc: lair, inside: { dungeon: true } };
  const world = {
    ...base,
    getFactionData: (id) => ({ ...base.getFactionData(id), type: FACTION_TYPES.Individual }),
    currentLocation: () => where.loc, playerInside: () => where.inside, isPlayerInLocationRect: () => !where.inside,
    currentLocationIndex: () => locations.indexOf(where.loc),
    discoverLocation: () => {}, mountCurrentSiteQuestResources: () => {},
    startSiteOfId: (id) => (startOfSiteId(id) ? lair : null),
  };
  const now = { s: 1e6 };
  const m = packMachine({ nowSeconds: () => now.s, skySeconds: () => 100 * 86400 + 12 * 3600, world, showPopup: () => {}, isPlayerInTown: () => !where.inside, giveItemToPlayer: () => {}, removeItemFromPlayer: () => {}, carriesQuestItem: () => true });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { now.s += 60; m.tick(); } };
  return { m, tick, lair, city };
}

test('START3 a site past the Bay keeps its own map pixel - the one its row\'s longitude and latitude name, off the Bay\'s table; a Bay site keeps none, its SiteDetails DFU\'s field for field (mutants: the bound; the Bay\'s site given one)', () => {
  const at = (x, y) => { const ll = mapPixelToLongitudeLatitude(x, y); return { mapTableData: { longitude: ll.x, latitude: ll.y } }; };
  assert.deepEqual(siteWorldPixel(at(1203, -88)), { x: 1203, y: -88 }, 'north-east of the table');
  assert.deepEqual(siteWorldPixel(at(-37, 12)), { x: -37, y: 12 }, 'west of it');
  assert.deepEqual(siteWorldPixel(at(1000, 0)), { x: 1000, y: 0 }, 'the first column past it');
  assert.deepEqual(siteWorldPixel(at(400, 500)), { x: 400, y: 500 }, 'the first row south of it');
  for (const [x, y] of [[0, 0], [999, 499], [207, 213]]) assert.equal(siteWorldPixel(at(x, y)), null, `the Bay's (${x}, ${y})`);
  assert.equal(siteWorldPixel({ mapTableData: {} }), null, 'a row without its place');
  assert.equal(siteWorldPixel(null), null);
});

test('START3 a province\'s start, played: its dungeon\'s site carries the pixel the lair stands on, through the save; the order\'s city, a Bay site, carries none (mutants: the fixed site\'s pixel unset)', () => {
  const p = pastBay();
  const q = p.m.startQuestByName(STARTS[1].quest);
  assert.ok(q);
  p.tick(2);
  const lair = q.getPlace({ name: 'lair' });
  assert.equal(lair.siteDetails.siteType, SITE_TYPES.Dungeon);
  assert.deepEqual(lair.siteDetails.worldPixel, LAIR_PX, 'the lair\'s own pixel');
  const city = q.getPlace({ name: 'daggerfall' });
  assert.equal('worldPixel' in city.siteDetails, false, 'a Bay site: DFU\'s SiteDetails, nothing added');
  const saved = structuredClone(lair.getSaveData());
  lair.siteDetails = null;
  lair.restoreSaveData(saved);
  assert.deepEqual(lair.siteDetails.worldPixel, LAIR_PX, 'kept by the save');
});

test('START3 the one "on my map" law: a site past the Bay is on the player\'s map exactly where the map they open shows the land past the Bay - the held sheet, its continent on - and never asks MAPS.BSA; a Bay site asks it as before (mutants: the site unread; the classic map answering yes; the continent\'s switch unread)', () => {
  const asked = [];
  const pixelOf = (_m, r, n) => { asked.push(`${r}/${n}`); return null; };
  const site = { regionName: 'Skyrim', locationName: 'The Haunt of Baringon', worldPixel: LAIR_PX };
  skin('enhanced');
  assert.equal(pastBayOnMap(), true);
  assert.equal(canFindPlace(null, null, site.regionName, site.locationName, pixelOf, site), true, 'the held sheet draws it');
  assert.deepEqual(asked, [], 'MAPS.BSA never asked for a place it cannot hold');
  setPref('tamrielMap', false);
  assert.equal(canFindPlace(null, null, site.regionName, site.locationName, pixelOf, site), false, 'the continent switched off: not on the map');
  skin('enhanced');
  setPref('heldMap', false);
  assert.equal(canFindPlace(null, null, site.regionName, site.locationName, pixelOf, site), false, 'the classic windows chosen: the Bay\'s pages alone');
  skin('classic');
  assert.equal(canFindPlace(null, null, site.regionName, site.locationName, pixelOf, site), false, 'the classic skin: the Bay\'s pages alone');
  skin('enhanced');
  assert.equal(canFindPlace(null, null, 'Daggerfall', 'Daggerfall', pixelOf, { regionName: 'Daggerfall', locationName: 'Daggerfall' }), false);
  assert.deepEqual(asked, ['Daggerfall/Daggerfall'], 'a Bay site: MAPS.BSA asked, as DFU asks it');
  assert.equal(canFindPlace(null, null, 'Daggerfall', 'Daggerfall', pixelOf), false, 'and a caller with no site, as before');
});

test('START3 the lens: a start\'s first entry names its dungeon, on the map past the Bay, and its `find` carries the pixel; the Bay\'s start\'s names Privateer\'s Hold with DFU\'s `find`, nothing added (mutants: the site unpassed; the pixel left off `find`)', () => {
  skin('enhanced');
  const p = pastBay();
  const q = p.m.startQuestByName(STARTS[1].quest);
  p.tick(2);
  const asks = [];
  const where = { canFindPlace: (r, n, site) => { asks.push(site ?? null); return canFindPlace(null, null, r, n, () => null, site); }, currentLocationName: () => '' };
  const t = entryTarget(q.getMessage(1010), where);
  assert.equal(t.onMap, true);
  assert.equal(t.locationName, 'The Haunt of Baringon');
  assert.deepEqual(t.find, { regionIndex: 64, regionName: 'Skyrim', locationName: 'The Haunt of Baringon', worldPixel: LAIR_PX });
  assert.deepEqual(asks[0]?.worldPixel, LAIR_PX, 'the host asked with the site');
  const ib = p.m.startQuestByName(STARTS[0].quest);
  p.tick(2);
  const bay = entryTarget(ib.getMessage(1010), { canFindPlace: () => true, currentLocationName: () => '' });
  assert.deepEqual(bay.find, { regionIndex: 17, regionName: 'Daggerfall', locationName: "Privateer's Hold" }, 'a Bay site\'s find is DFU\'s');
});

test('START3 the marks: a quest\'s place past the Bay is a mark at its own pixel, named; the held map reads it over the continent\'s frame (WW2\'s rings\' bound) and the Bay\'s bound alone drops it (mutants: the frame unread; the bound\'s far edge)', () => {
  const views = [{ id: 'a', title: 'The Haunt', target: { find: { regionName: 'Skyrim', locationName: 'The Haunt of Baringon', worldPixel: LAIR_PX } }, words: {} }];
  const marks = questMapMarks(views, 'a', (find) => find.worldPixel ?? null);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].px, LAIR_PX.x);
  assert.equal(marks[0].py, LAIR_PX.y);
  assert.equal(marks[0].placeName, 'The Haunt of Baringon');
  const size = { width: 1000, height: 500 };
  assert.deepEqual(readQuestMarks(() => marks, size), [], 'the Bay\'s bound: no mark off its table');
  const frame = { x0: -1000, y0: -700, w: 3000, h: 1800 };
  const read = readQuestMarks(() => marks, size, frame);
  assert.equal(read.length, 1, 'over the continent\'s frame');
  assert.equal(read[0].x, LAIR_PX.x + 0.5);
  assert.equal(read[0].placeName, 'The Haunt of Baringon');
  assert.deepEqual(readQuestMarks(() => [{ ...marks[0], px: frame.x0 + frame.w }], size, frame), [], 'its far edge is out');
  assert.deepEqual(readQuestMarks(() => [{ ...marks[0], px: frame.x0 - 1 }], size, frame), [], 'and its near one');
});

/** Just enough document for the held map's chrome (test/ui/heldmap.test.js fakeDocument's shape). */
function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
const heldMap = () => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
  gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
});

test('START3 the held map: a press on a quest\'s diamond past the Bay picks the quest\'s place, named, as a press picks one there (TESA2\'s: no journey on the travel map); the journal\'s find glides to it and picks it; a sheet without the continent picks nothing (mutants: the press\'s place unpicked; the goto by name alone)', () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  try {
    const win = heldMap();
    win._tamriel = true;
    const pick = win._questPlace({ px: LAIR_PX.x, py: LAIR_PX.y, placeName: 'The Haunt of Baringon' });
    assert.deepEqual(pick, { coords: true, x: LAIR_PX.x + 0.5, y: LAIR_PX.y + 0.5, colorIndex: -1, kind: 'coords', name: 'The Haunt of Baringon', summary: null, mapId: null, arena: true, pastBay: true, portal: false, walk: false });   // PIN MOVED (OW-PAST-BAY): no Travel Options here, so no walk (test/ui/owpastbay_walk.test.js)
    win.gotoPlace({ siteDetails: { regionIndex: 64, regionName: 'Skyrim', locationName: 'The Haunt of Baringon', worldPixel: LAIR_PX } });
    win._consumeGotoPlace();
    assert.equal(win._selected?.name, 'The Haunt of Baringon', 'the find picks it');
    assert.equal(win._selected?.x, LAIR_PX.x + 0.5);
    assert.equal(win._selected?.summary, null, 'no record of MAPS.BSA\'s under it');
    assert.equal(win._panel ?? null, null, 'no journey offered (TESA-NO-FAST)');
    win._tamriel = false;
    assert.equal(win._questPlace({ px: LAIR_PX.x, py: LAIR_PX.y, placeName: 'x' }), null, 'no continent on the sheet: nothing to pick');
    win.dispose?.();
  } finally { delete globalThis.document; }
});

test('START3 the wiring, by source: every place builder in place.js stamps the site past the Bay; the host\'s one pixel reader takes the site\'s own first; every host question hands the site on; the held map reads the marks over the continent\'s frame (mutants: a builder unstamped; the host\'s reader by name alone)', () => {
  const P = rd('src/systems/quest/place.js');
  assert.equal([...P.matchAll(/^\s+locationName: location\.name,\n\s+\.\.\.pastBaySite\(location\),/gm)].length, 5, 'the five sites built off a location');
  assert.equal([...P.matchAll(/^\s+locationName: location\.name,$/gm)].length, 5, 'and no sixth site');
  const W = rd('src/scenes/world.js');
  assert.match(W, /const questPixel = \(find\) => find\?\.worldPixel \?\? questPlacePixel\(maps, find\?\.regionName \?\? '', find\?\.locationName \?\? ''\);/);
  assert.equal([...W.matchAll(/\(regionName, name, site\) => canFindPlace\(maps, mapDict, regionName, name, questPlacePixel, site\)/g)].length, 5, 'every host question, the site handed on');
  assert.doesNotMatch(W, /\(regionName, name\) => canFindPlace\(/, 'none without it');
  assert.match(rd('src/ui/heldMap.js'), /const quests = readQuestMarks\(this\.deps\.quests, this\._size, sheet\)/);   // PIN MOVED (BAY-LEFT-MAPS): the sheet's one box (_marksBox), the continent's frame while it is shown
  assert.match(rd('src/ui/quest/questJournal.js'), /this\.deps\.canFindPlace\(site\.regionName, site\.locationName, site\)/, 'the classic journal\'s find');
});
