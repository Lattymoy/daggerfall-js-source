// SD2 (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most";
// bible/11-Multiplayer/Super-Dungeons.md sections 3 and 5): WHERE THE HOLLOW STANDS, AND WHAT STANDS THERE
// (systems/sdSite.js). The relay names a region (the census) and nothing more; every client finds the same city, the
// same pixel and the same template from the map files it holds, and clones the same Hollow under the slot's own id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SD_GREAT_CITIES, SD_TEMPLATE_MIN_BLOCKS, SD_TEMPLATE_TYPES, SD_SALT_BASE, sdSalt, sdCities, findSdSite, sdTemplates,
  pickSdTemplate, sdHollowLocation,
} from '../src/systems/sdSite.js';
import { scanGatePixels, GATE_TOWN_MIN_PX, GATE_TOWN_MAX_PX } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { sdRoll, sdNameOf, sdRise, sdFirst } from '../src/net/sdLaw.js';
import { spawnedMapId, SALT_MAX, WORLD_SALT } from '../src/world/spawnedDungeons.js';
import { dungeonTier } from '../src/systems/dungeonTier.js';
import { dungeonTierLabel } from '../src/world/dungeonLabel.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';

const T = LOCATION_TYPES;
/** A settlement or a dungeon as the hosts read one: a region, a table index, a map row, an exterior. */
const place = (region, index, px, py, type, { name = `P${region}.${index}`, w = 1, h = 1, buildings = 0, blocks = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: blocks > 0,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
  ...(blocks ? { dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `${i % 3 ? 'N' : 'B'}0000${i}.RDB`, x: i, z: 0, isStartingBlock: !i })), recordElement: { header: { locationId: py * 1000 + px } } } } : {}),
});

/** A small world: land east of x = 100, two regions; the towns and villages of `places` its only rows. */
function world(places) {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  for (const p of places) { regions[p.regionIndex].mapTable[p.locationIndex] = { mapId: p.mapTableData.mapId, locationType: p.mapTableData.locationType }; regions[p.regionIndex].mapNames[p.locationIndex] = p.name; }
  return {
    regionCount: 2, getRegion: (r) => regions[r],
    getClimateIndex: (x) => (x < 100 ? CLIMATES.Ocean : 231),
    getPoliticIndex: (x) => (x < 100 ? 0 : 128 + (x < 500 ? 0 : 1)),
    getRegionIndexAt: (x) => (x < 500 ? 0 : 1),
  };
}

test('SD2: the numbers - eight great cities, a template of twelve blocks or more, a labyrinth or a keep, and the slots\' own map-id salts', () => {
  assert.equal(SD_GREAT_CITIES, 8);
  assert.equal(SD_TEMPLATE_MIN_BLOCKS, 12);
  assert.deepEqual([...SD_TEMPLATE_TYPES], [T.DungeonLabyrinth, T.DungeonKeep]);
  assert.equal(SD_SALT_BASE, 2048);
  assert.equal(sdSalt(1), 2049);
  assert.equal(sdSalt(2047), SALT_MAX);
  assert.equal(sdSalt(2048), 2049, 'the 2048th Hollow after one reuses its salt - and stands a different pixel, its own room');
  for (let s = 1; s < 5000; s += 97) assert.ok(sdSalt(s) > SD_SALT_BASE && sdSalt(s) <= SALT_MAX && sdSalt(s) !== WORLD_SALT, `slot ${s}`);
});

test('SD2: the city - a region\'s places ranked as its hub is (a city, the one named for its region, then the largest); with no region the Bay\'s eight largest cities', () => {
  const a = place(0, 0, 200, 100, T.TownVillage, { w: 4, h: 4 });
  const b = place(0, 1, 260, 100, T.TownCity, { w: 2, h: 2, buildings: 40 });
  const c = place(0, 2, 320, 100, T.TownCity, { w: 3, h: 2 });
  const d = place(0, 3, 380, 100, T.TownCity, { name: 'Daggerfall', w: 1, h: 1 });   // region 0 is the Alik'r; a name match needs the region's name
  const e = place(1, 0, 600, 100, T.TownCity, { w: 6, h: 6 });
  const ruin = place(0, 4, 440, 100, T.DungeonRuin, { blocks: 14 });
  const all = [a, b, c, d, e, ruin];
  const names = (list) => list.map((l) => l.name);
  assert.deepEqual(names(sdCities(all, 0, { regionNameOf: () => 'Nowhere' })), [c.name, b.name, d.name, a.name], 'cities over the village, the larger first; no ruin');
  assert.deepEqual(names(sdCities(all, 0, { regionNameOf: () => 'Daggerfall' })), ['Daggerfall', c.name, b.name, a.name], 'the one named for its region before the larger');
  assert.deepEqual(names(sdCities(all, 1)), [e.name]);
  assert.deepEqual(names(sdCities(all, 0, { isBase: (l) => l !== c, regionNameOf: () => 'Nowhere' })), [b.name, d.name, a.name], 'a mod\'s row is not on every client: never counted');
  const many = Array.from({ length: 12 }, (_, i) => place(i % 2, 10 + i, 150 + i * 30, 300, T.TownCity, { w: 1 + (i % 5), h: 1 }));
  const great = sdCities([...many, a], -1, { regionNameOf: () => 'Nowhere' });
  assert.equal(great.length, SD_GREAT_CITIES, 'the Bay\'s eight largest');
  assert.ok(great.every((l) => l.mapTableData.locationType === T.TownCity), 'cities alone');
  assert.deepEqual(great.map((l) => l.exterior.exteriorData.width), [5, 5, 4, 4, 3, 3, 2, 2], 'largest first');
  assert.deepEqual(names(sdCities([b, c, a], -1, { regionNameOf: () => 'Nowhere' })), [c.name, b.name], 'fewer than eight cities: those, and never a village however large');
  assert.deepEqual(sdCities([], 0), []);
});

test('SD2: the site - a pixel the gate\'s scan calls suitable whose nearest town is the city, two to four pixels out, by the slot\'s roll; a city with none passes to the next', () => {
  const city = place(0, 0, 300, 200, T.TownCity, { w: 3, h: 3, buildings: 80 });
  const second = place(0, 1, 400, 300, T.TownCity, { w: 2, h: 2 });
  const maps = world([city, second]);
  const scan = scanGatePixels(maps, { heightAt: () => 90 });
  const cities = sdCities([city, second], 0, { regionNameOf: () => 'Nowhere' });
  const rec = sdRise(sdFirst(0), 10 * 60 * 1000, 0);
  const site = findSdSite(rec, scan, cities);
  assert.ok(site, 'a site');
  assert.equal(site.city, city);
  assert.equal(site.cityName, city.name);
  const d = Math.max(Math.abs(site.px - 300), Math.abs(site.py - 200));
  assert.ok(d >= GATE_TOWN_MIN_PX && d <= GATE_TOWN_MAX_PX, `two to four pixels out (${d})`);
  const p = site.py * 1000 + site.px;
  assert.equal(scan.towns[scan.townAt[p]].px, 300, 'its nearest town is the city');
  assert.ok([...scan.byRegion.values()].some((l) => Array.from(l).includes(p)), 'the scan calls it suitable');
  assert.deepEqual(findSdSite(rec, scan, cities), site, 'the same for every client');
  // the slot's roll moves it among the city's pixels
  const sites = new Set(Array.from({ length: 20 }, (_, i) => { const s = findSdSite({ s: i + 1, r: 0 }, scan, cities); return `${s.px},${s.py}`; }));
  assert.ok(sites.size > 5, `the slots spread over the city's ring (${sites.size})`);
  // a city the scan holds no pixel for passes to the next
  const inland = place(0, 2, 99, 50, T.TownCity, { w: 4, h: 4 });   // at the sea's edge: its ring is water
  const s2 = findSdSite(rec, scan, [inland, ...cities]);
  assert.equal(s2.city, city, 'the next city down the ranking');
  assert.equal(findSdSite(rec, scan, [inland]), null, 'none: no site');
  assert.equal(findSdSite(null, scan, cities), null);
  // with no region, the slot's roll picks where the great cities' list begins
  const g = findSdSite({ s: 5, r: -1 }, scan, cities);
  assert.equal(g.city, cities[sdRoll(5, 5) % cities.length]);
});

test('SD2: the template - a labyrinth or a keep of twelve blocks or more with a spawn\'s clearance, never the main story\'s nor a clone; the slot\'s roll picks', () => {
  const ok1 = place(0, 0, 200, 200, T.DungeonLabyrinth, { blocks: 14 });
  const ok2 = place(0, 1, 210, 200, T.DungeonKeep, { blocks: 12, w: 2, h: 2 });
  const small = place(0, 2, 220, 200, T.DungeonKeep, { blocks: 11 });
  const ruin = place(0, 3, 230, 200, T.DungeonRuin, { blocks: 20 });
  const wide = place(0, 4, 240, 200, T.DungeonLabyrinth, { blocks: 16, w: 3, h: 1 });
  const story = place(0, 5, 200, 100, T.DungeonKeep, { blocks: 20 });
  story.mapTableData.mapId = 187853213;   // Privateer's Hold
  const clone = { ...ok1, spawned: true };
  const list = sdTemplates([ok1, ok2, small, ruin, wide, story, clone], isMainStoryDungeon);
  assert.deepEqual(list, [ok1, ok2]);
  for (let s = 1; s <= 10; s++) assert.equal(pickSdTemplate(s, list), list[sdRoll(s, 3) % 2]);
  assert.equal(pickSdTemplate(1, []), null);
});

test('SD2: the Hollow - the template cloned on the site under the slot\'s own id, named, Super, standing as a spawned dungeon stands', () => {
  const template = place(0, 0, 200, 200, T.DungeonLabyrinth, { name: 'Castle Necromoghan', blocks: 14 });
  const site = { s: 7, px: 412, py: 211, cityName: 'Daggerfall' };
  const rec = { s: 7, r: 17 };
  const h = sdHollowLocation(rec, site, template, { regionIndex: 17, regionName: 'Daggerfall' });
  assert.equal(h.name, sdNameOf(7, 'Daggerfall'));
  assert.equal(h.superTier, true);
  assert.equal(h.sdSlot, 7);
  assert.equal(h.spawned, true, 'a spawned dungeon\'s machinery stands it');
  assert.equal(h.elite, false);
  assert.equal(h.mapTableData.mapId, spawnedMapId(sdSalt(7), 412, 211), 'the slot\'s own id');
  assert.equal((h.mapTableData.mapId >>> 0) & 0xfffff, 211 * 1000 + 412, 'DFU\'s law: its low bits are its pixel');
  assert.notEqual(h.mapTableData.mapId, spawnedMapId(WORLD_SALT, 412, 211), 'never a spawned dungeon\'s id');
  assert.notEqual(sdHollowLocation({ s: 8, r: 17 }, { ...site, s: 8 }, template).mapTableData.mapId, h.mapTableData.mapId, 'a later Hollow on the pixel: another dungeon, another room');
  assert.equal(h.dungeon.recordElement.header.locationId, h.mapTableData.mapId, 'the save\'s `dungeon:<id>` is its own');
  assert.equal(h.regionIndex, 17);
  assert.equal(h.dungeon.blocks.length, 14, 'the template\'s blocks, whatever size the world lays it at');
  assert.equal(template.name, 'Castle Necromoghan', 'the template untouched');
  assert.equal(dungeonTier(h), 'super', 'TIER1 reads it Super');
  assert.equal(dungeonTierLabel(h).text, 'Abyss Dungeon');   // ABYSS-NAME (PIN MOVED)
  assert.equal(sdHollowLocation(null, site, template), null);
  assert.equal(sdHollowLocation(rec, site, null), null);
});
