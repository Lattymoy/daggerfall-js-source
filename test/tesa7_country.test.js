// TESA7 (2026-10-12, the owner: "Populating the world with unique and smaller towns, farms, etc"; bible/03-World/
// Arena-Provinces.md TESA7) - THE COUNTRYSIDE PAST THE BAY, pinned. Each climate stands what the Bay stands on its land of
// that climate (world/tamrielCountry.js: the game's rows over the Bay's land), a pixel's own hash rolls it, the clone is
// one of the game's own places of its kind under the province's names, its own id, its own index; the world host asks it
// of every pixel past the Bay that Arena's places leave free, never on water, an Arena road or the sea's edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COUNTRY_SALT, COUNTRY_TYPES, COUNTRY_LANE, COUNTRY_LANES, COUNTRY_INDEX_BASE, COUNTRY_GRID, countryOrdinal, countryPlaceId,
  isCountryPlaceId, countryLocationIndex, countryTemplates, countryCounts, bayLand, countryRates, countryRoll, countryPick,
  countryStandsAt, countryName, countryNameSeed, createCountryGround, synthesizeCountryLocation, COUNTRY_NAME_FRAMES, TEMPLE_EPITHETS,
  TEMPLE_NOUNS, TEMPLE_GODS, TAVERN_KINDS,
} from '../src/world/tamrielCountry.js';
import { hash32, spawnedMapId, SPAWN_DRY_ELEVATION, spawnPlateauFloor } from '../src/world/spawnedDungeons.js';
import { arenaPlaceId, ARENA_INDEX_BASE, isArenaPlaceId } from '../src/world/arenaLocations.js';
import { etherPlaceId, isEtherPlaceId } from '../src/world/etherPlaces.js';
import { LOCATION_TYPES, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { BANK_TYPES } from '../src/characters/nameHelper.js';
import { tavernsA, tavernsB } from '../src/world/buildingNames.js';
import { srand, rand, getSeed } from '../src/formats/dfRandom.js';
import { BAY_W, BAY_H, tamrielFrameInBay } from '../src/world/tamriel/tamrielFrame.js';
import { countrysideOn } from '../src/scenes/shared.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = LOCATION_TYPES;

// ── THE ID ──────────────────────────────────────────────────────

test('TESA7 the id: a pixel\'s ordinal on the fixed grid, its lane among the 64 from 0x300, its low 20 bits past every Bay pixel id - one id a pixel, never an Arena place\'s, an isle\'s or a spawn\'s; the index its own negative past Arena\'s', () => {
  assert.equal(COUNTRY_LANE, 0x300);
  assert.equal(COUNTRY_LANES, 64);
  assert.equal(countryOrdinal(-COUNTRY_GRID.x0, -COUNTRY_GRID.y0), 0, 'the grid\'s corner');
  assert.equal(countryOrdinal(-COUNTRY_GRID.x0 - 1, 0), -1, 'west of it');
  assert.equal(countryOrdinal(0, -COUNTRY_GRID.y0 - 1), -1, 'north of it');
  assert.equal(countryOrdinal((1 << COUNTRY_GRID.wBits) - COUNTRY_GRID.x0, 0), -1, 'east of it');
  assert.equal(countryOrdinal(0, COUNTRY_GRID.h - COUNTRY_GRID.y0), -1, 'south of it');
  assert.equal(countryOrdinal(0.5, 0), -1, 'a pixel, never a point');
  assert.equal(countryOrdinal(-COUNTRY_GRID.x0 - 2, 3), -1, 'west of it, -1 and no other');
  assert.equal(countryOrdinal(5, 7), (7 + COUNTRY_GRID.y0) * (1 << COUNTRY_GRID.wBits) + 5 + COUNTRY_GRID.x0, 'row by row, 8192 to a row');
  assert.notEqual(countryOrdinal(4096 - COUNTRY_GRID.x0, 0), countryOrdinal(-COUNTRY_GRID.x0, 1), 'no row overlaps the next');
  const [a, b] = [countryPlaceId(countryOrdinal(0, 0)), countryPlaceId(countryOrdinal(0, 64))];
  assert.equal(a & 0xfffff, b & 0xfffff, 'sixty-four rows on, the same low 20 bits (discovery\'s key - none of its readers reads a country place)');
  assert.equal((b >>> 20) - (a >>> 20), 1, '...in the next lane');
  const f = tamrielFrameInBay();
  assert.ok(countryOrdinal(f.x0, f.y0) >= 0 && countryOrdinal(f.x0 + f.w - 1, f.y0 + f.h - 1) >= 0, 'the continent\'s frame at the shipped fit is on it');
  const ids = new Set();
  for (const [x, y] of [[f.x0, f.y0], [f.x0 + f.w - 1, f.y0 + f.h - 1], [-1, -1], [1000, 0], [0, 500], [2200, -360], [2201, -360], [2200, -359]]) {
    const n = countryOrdinal(x, y), id = countryPlaceId(n);
    assert.ok(n >= 0);
    const lane = id >>> 20;
    assert.ok(lane >= COUNTRY_LANE && lane < COUNTRY_LANE + COUNTRY_LANES, `lane of ${x},${y}`);
    assert.ok((id & 0xfffff) >= 500000, 'past getMapPixelID\'s ceiling: no Bay place found by its discovery');
    assert.ok(isCountryPlaceId(id));
    assert.ok(!isArenaPlaceId(id) && !isEtherPlaceId(id));
    assert.equal(countryLocationIndex(n), -(COUNTRY_INDEX_BASE + n));
    assert.ok(countryLocationIndex(n) < -(ARENA_INDEX_BASE + 432), 'past Arena\'s indices');
    ids.add(id);
  }
  assert.equal(ids.size, 8, 'one id a pixel');
  for (const other of [spawnedMapId(1, 5, 5), spawnedMapId(7, 999, 499), arenaPlaceId({ provinceIndex: 8, id: 47 }), etherPlaceId({ cx: 3, cy: 4 }), 0x60000000 | 1234, 499999, (0x300 << 20) | 5, (0x342 << 20) | 0x80000, (0x340 << 20) | 5, (0x2ff << 20) | 0x80000]) {
    assert.equal(isCountryPlaceId(other), false, `0x${(other >>> 0).toString(16)}`);
  }
});

// ── THE TEMPLATES, THE COUNT, THE LAND, THE RATES ───────────────

const row = (mapId, type, o = {}) => ({ name: `R${mapId}`, mapTableData: { mapId, locationType: type, longitude: 0, latitude: 0, ...o.md }, exterior: { exteriorData: { width: 1, height: 1 } }, hasDungeon: false, ...o });

test('TESA7 the templates: a list a kind, in map-id order - an exterior, no dungeon, never a city, a main-story place nor one the port made', () => {
  assert.deepEqual(COUNTRY_TYPES, [T.TownHamlet, T.TownVillage, T.HomeFarms, T.ReligionTemple, T.Tavern, T.HomeWealthy, T.ReligionCult, T.HomePoor]);
  const rows = [row(9, T.HomeFarms), row(3, T.HomeFarms), row(4, T.TownCity), row(5, T.HomeFarms, { hasDungeon: true }), row(6, T.HomeFarms, { exterior: {} }),
    row(7, T.HomeFarms, { spawned: true }), row(8, T.HomeFarms, { ether: {} }), row(10, T.HomeFarms, { arena: {} }), row(11, T.HomeFarms, { country: {} }), row(12, T.HomeFarms),
    row(13, T.Tavern), row(14, T.DungeonRuin, { hasDungeon: true }), row(15, T.Graveyard)];
  const t = countryTemplates(rows, (id) => id === 12);
  assert.deepEqual([...t.keys()], COUNTRY_TYPES, 'every kind a list');
  assert.deepEqual(t.get(T.HomeFarms).map((l) => l.mapTableData.mapId), [3, 9]);
  assert.deepEqual(t.get(T.Tavern).map((l) => l.mapTableData.mapId), [13]);
  assert.equal(t.get(T.TownHamlet).length, 0);
  assert.ok(![...t.values()].flat().some((l) => [4, 14, 15].includes(l.mapTableData.mapId)), 'no city, no dungeon, no graveyard');
});

test('TESA7 the Bay\'s count and land: each climate\'s templates by kind (the row\'s pixel\'s climate), each climate\'s land pixels over the Bay', () => {
  const ll = (x, y) => mapPixelToLongitudeLatitude(x, y);
  const md = (x, y) => { const p = ll(x, y); return { longitude: p.x, latitude: p.y }; };
  const t = countryTemplates([row(1, T.HomeFarms, { md: md(10, 10) }), row(2, T.HomeFarms, { md: md(600, 10) }), row(3, T.Tavern, { md: md(11, 10) }), row(4, T.HomeFarms, { md: md(12, 11) })]);
  const climateAt = (x) => (x < 500 ? 230 : 226);
  const counts = countryCounts(t, climateAt);
  assert.deepEqual([...counts.get(230)], [[T.HomeFarms, 2], [T.Tavern, 1]]);
  assert.deepEqual([...counts.get(226)], [[T.HomeFarms, 1]]);
  let reads = 0;
  const land = bayLand((x) => { reads++; return x < 500 ? 230 : 226; }, (x, y) => y >= 250);
  assert.equal(reads, BAY_W * BAY_H, 'every Bay pixel, once');
  assert.equal(land.get(230), 500 * 250);
  assert.equal(land.get(226), (BAY_W - 500) * 250);
  assert.equal(land.size, 2);
});

test('TESA7 the rates: a climate\'s kinds as ceilings of the roll, in COUNTRY_TYPES order, its count over its land - none for a climate with no land or no kind', () => {
  const counts = new Map([[230, new Map([[T.Tavern, 30], [T.HomeFarms, 50], [T.TownHamlet, 20]])], [226, new Map([[T.HomeFarms, 4]])], [227, new Map()]]);
  const land = new Map([[230, 1000], [227, 50]]);
  const r = countryRates(counts, land);
  assert.deepEqual(r.get(230).map(([t]) => t), [T.TownHamlet, T.HomeFarms, T.Tavern], 'the roll\'s order, never the count\'s');
  const c = r.get(230).map(([, v]) => v);
  assert.ok(Math.abs(c[0] - 0.02) < 1e-12 && Math.abs(c[1] - 0.07) < 1e-12 && Math.abs(c[2] - 0.1) < 1e-12, 'cumulative');
  assert.equal(r.has(226), false, 'no land of it on the Bay');
  assert.equal(r.has(227), false, 'no kind');
});

test('TESA7 the pick: the pixel\'s roll under its climate\'s ceilings names the kind, its own hash the template - the same pixel the same place; past the climate\'s chance, an unknown climate or an empty kind, none; and the Bay\'s rate is what stands', () => {
  const templates = new Map(COUNTRY_TYPES.map((t) => [t, [row(100 + t, t), row(200 + t, t), row(300 + t, t)]]));
  templates.set(T.HomePoor, []);
  const rates = new Map([[230, [[T.TownHamlet, 0.01], [T.HomeFarms, 0.03], [T.HomePoor, 0.04]]]]);
  let n = 0, hamlet = 0, farm = 0, poor = 0, none = 0;
  for (let y = -400; y < -200; y++) {
    for (let x = 2000; x < 2200; x++) {
      const r = countryRoll(x, y);
      assert.equal(r, hash32(COUNTRY_SALT, x, y, 1) / 4294967296);
      const p = countryPick(rates, templates, 230, x, y);
      n++;
      if (r < 0.01) { assert.equal(p.type, T.TownHamlet); hamlet++; }
      else if (r < 0.03) { assert.equal(p.type, T.HomeFarms); farm++; }
      else if (r < 0.04) { assert.equal(p, null, 'a kind with no template stands none'); poor++; }
      else { assert.equal(p, null); none++; }
      if (p) {
        const list = templates.get(p.type);
        assert.equal(p.template, list[hash32(COUNTRY_SALT, x, y, 2) % list.length]);
        assert.deepEqual(countryPick(rates, templates, 230, x, y), p, 'the same answer every ask');
      }
    }
  }
  assert.ok(Math.abs(hamlet / n - 0.01) < 0.002 && Math.abs(farm / n - 0.02) < 0.003 && Math.abs(poor / n - 0.01) < 0.002, `the rates stand: ${hamlet} ${farm} ${poor} of ${n}`);
  assert.equal(countryPick(rates, templates, 226, 2000, -400), null, 'a climate with no rates');
  assert.equal(countryPick(null, templates, 230, 2000, -400), null);
});

// ── THE NAME ────────────────────────────────────────────────────

test('TESA7 the name: the kind\'s frame round the province\'s stems on DFRandom off the seed - the same seed the same name, the stream\'s state put back; an inn DFU\'s own words, a temple one of the Eight\'s; a Nord\'s stem no son, a Redguard\'s a first name', () => {
  srand(12345);
  const before = getSeed();
  const seen = new Set();
  for (const bank of [BANK_TYPES.Breton, BANK_TYPES.Redguard, BANK_TYPES.Nord, BANK_TYPES.DarkElf, BANK_TYPES.HighElf, BANK_TYPES.WoodElf, BANK_TYPES.Khajiit, BANK_TYPES.Imperial]) {
    for (const type of COUNTRY_TYPES) {
      for (let s = 0; s < 6; s++) {
        const name = countryName(type, bank, countryNameSeed(s, type));
        assert.ok(name && !/%|undefined|null/.test(name), `${bank}/${type}: ${name}`);
        assert.equal(countryName(type, bank, countryNameSeed(s, type)), name, 'deterministic');
        seen.add(name);
      }
    }
  }
  assert.equal(getSeed(), before, 'the global stream untouched');
  assert.equal(rand(), (srand(12345), rand()), 'and its next draw the same');
  assert.ok(seen.size > 250, `names vary (${seen.size} of 384)`);
  assert.equal(countryName(T.TownCity, BANK_TYPES.Breton, 1), '', 'a city has no country frame');
  assert.equal(countryName(T.DungeonRuin, BANK_TYPES.Breton, 1), '');
  for (let s = 0; s < 40; s++) {
    const inn = countryName(T.Tavern, BANK_TYPES.Breton, s);
    assert.ok(tavernsA().some((a) => inn.startsWith(`${a} `)) && tavernsB().some((b) => inn.includes(` ${b} `)) && TAVERN_KINDS.some((k) => inn.endsWith(` ${k}`)), inn);
    const temple = countryName(T.ReligionTemple, BANK_TYPES.Nord, s).split(' ');
    assert.equal(temple.length, 4);
    assert.ok(TEMPLE_EPITHETS.includes(temple[0]) && TEMPLE_NOUNS.includes(temple[1]) && temple[2] === 'of' && TEMPLE_GODS.includes(temple[3]), temple.join(' '));
    const nord = countryName(T.HomeWealthy, BANK_TYPES.Nord, s);
    assert.ok(!/sen (Manor|Hall|Court)$/.test(nord), `a Nord's house is no son's: ${nord}`);
    const village = countryName(T.TownVillage, BANK_TYPES.Redguard, s);
    assert.ok(village.length > 1 && !/\s/.test(village), `a Redguard village a first name: ${village}`);
  }
  const farms = new Set(Array.from({ length: 200 }, (_, s) => countryName(T.HomeFarms, BANK_TYPES.Breton, s).replace(/^The \S+ Farmstead$/, 'F').replace(/^Old \S+'s Farm$/, 'O').replace(/^\S+ Orchard$/, 'R').replace(/^\S+ Grange$/, 'G')));
  assert.deepEqual([...farms].sort(), ['F', 'G', 'O', 'R'], 'every farm frame, and nothing else');
  assert.equal(COUNTRY_NAME_FRAMES[T.HomePoor].length, 6);
});

// ── THE CLONE, THE GROUND ───────────────────────────────────────

test('TESA7 the clone: the template untouched; its own id in the row, the exterior and its record, the pixel\'s longitude and latitude, its name, the region the host says, its own index, no harbour, and `country`; none off the grid', () => {
  const template = { name: 'Old Farm', regionIndex: 17, regionName: 'Daggerfall', politic: 145, climate: { worldClimate: 230 }, hasDungeon: false,
    mapTableData: { mapId: 4242, locationType: T.HomeFarms, longitude: 1, latitude: 2, discovered: false },
    exterior: { buildings: [{ k: 1 }], exteriorData: { locationId: 4242, mapId: 4242, portTownAndUnknown: 1, width: 1, height: 1, blockNames: ['FARMAA01.RMB'] }, recordElement: { header: { locationId: 4242, x: 1 } } } };
  const snap = JSON.stringify(template);
  const loc = synthesizeCountryLocation(template, { px: 2200, py: -360, type: T.HomeFarms, name: 'The Ulfgar Farmstead' }, { regionIndex: 23, regionName: 'Wrothgarian Mountains', politic: 151, climate: { worldClimate: 226 } });
  assert.equal(JSON.stringify(template), snap, 'non-mutating');
  const n = countryOrdinal(2200, -360), id = countryPlaceId(n), ll = mapPixelToLongitudeLatitude(2200, -360);
  assert.equal(loc.name, 'The Ulfgar Farmstead');
  assert.equal(loc.mapTableData.mapId, id);
  assert.equal(loc.mapTableData.locationType, T.HomeFarms);
  assert.equal(loc.mapTableData.longitude, ll.x);
  assert.equal(loc.mapTableData.latitude, ll.y);
  assert.equal(loc.exterior.exteriorData.mapId, id);
  assert.equal(loc.exterior.exteriorData.locationId, id);
  assert.equal(loc.exterior.exteriorData.portTownAndUnknown, 0, 'no harbour, whatever the template\'s');
  assert.equal(loc.exterior.recordElement.header.locationId, id);
  assert.equal(loc.exterior.recordElement.header.x, 1);
  assert.equal(loc.exterior.buildings, template.exterior.buildings, 'the buildings the template\'s, by reference');
  assert.equal(loc.exterior.exteriorData.blockNames, template.exterior.exteriorData.blockNames);
  assert.equal(loc.locationIndex, countryLocationIndex(n));
  assert.deepEqual([loc.regionIndex, loc.regionName, loc.politic, loc.climate.worldClimate], [23, 'Wrothgarian Mountains', 151, 226]);
  assert.deepEqual(loc.country, { px: 2200, py: -360, type: T.HomeFarms, template: 4242 });
  assert.ok(Object.isFrozen(loc.country));
  assert.equal(loc.dungeon, undefined);
  const bare = synthesizeCountryLocation({ ...template, exterior: { exteriorData: {} } }, { px: 0, py: -1, type: T.HomeFarms, name: 'X' });
  assert.equal(bare.exterior.recordElement, undefined, 'no record where the template has none');
  assert.equal(bare.regionIndex, 17, 'the template\'s where the host says nothing');
  assert.equal(synthesizeCountryLocation(template, { px: -5000, py: 0, type: T.HomeFarms, name: 'X' }), null);
});

const woodsOf = (byteAt) => ({
  getHeightMapValue: byteAt,
  getHeightMapValuesRange1Dim(x0, y0, dim) { const d = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = byteAt(x0 + x, y0 + y); return d; },
  getLargeHeightMapValuesRange: (x, y, dim) => new Uint8Array(dim * 3 * dim * 3),
});

test('TESA7 the ground: the spawns\' dry-plateau law (SPAWN-SHORE), kept per pixel under its own key - two pixels past the Bay a Bay key would share answer their own', () => {
  let reads = 0;
  const w = woodsOf((x) => { reads++; return x >= 1000 ? 20 : 0; });
  const dry = createCountryGround(w);
  assert.equal(dry(1000, 0), true, 'high ground');
  assert.equal(spawnPlateauFloor(w, 1000, 0) > SPAWN_DRY_ELEVATION, true);
  assert.equal(dry(0, 1), false, 'the sea - y * 1000 + x the same as (1000, 0)\'s');
  const r = reads;
  assert.equal(dry(1000, 0), true);
  assert.equal(dry(0, 1), false);
  assert.equal(reads, r, 'kept');
});

// ── THE HOST ────────────────────────────────────────────────────

const W = hostText('src/scenes/world.js');
const lift = (head) => { const i = W.indexOf(head); assert.ok(i > 0, head); return W.slice(i, W.indexOf('\n  }\n', i) + 4); };

test('TESA7 the host: the templates and the count off the game\'s rows before they go, the land past the Bay streamed and the door open; the rates at the first ask, the Bay\'s water law; past the Bay Arena\'s place first, else the country\'s', () => {
  assert.equal(countrysideOn('?country=off'), false);
  assert.equal(countrysideOn(''), true);
  assert.equal(countrysideOn('?online&country=on'), true, 'online too');
  assert.match(W, /const _countryTemplates = tamrielLand && countrysideOn\(\) \? countryTemplates\(_classicRows \?\? _hubRows\.map\(classicRow\)\.filter\(Boolean\), isMainStoryDungeon\) : null;/);
  assert.match(W, /const _countryCounts = _countryTemplates \? countryCounts\(_countryTemplates, \(x, y\) => filedClimate\(x, y, maps\.getClimateIndex\(x, y\)\)\) : null;/);   // PIN MOVED (AUDIT FOUNDATION II L1): the Bay's count off the files as they came
  assert.ok(W.indexOf('const _countryCounts = _countryTemplates') < W.indexOf('  _classicRows = null;   // read, let go'), 'before the rows go');
  assert.match(W, /const bayLandNow = \(\) => \(_pastBay\.bayLand \?\?= bayLand\(\(x, y\) => filedClimate\(x, y, maps\.getClimateIndex\(x, y\)\), \(x, y, c\) => isWaterPixel\(c, filedHeight\(x, y, host\.woods\.getHeightMapValue\(x, y\)\)\)\)\);[^\n]*\n\s+const countryRatesNow = \(\) => \(_pastBay\.countryRates \?\?= countryRates\(_countryCounts, bayLandNow\(\)\)\);/);   // PIN MOVED (TESA8): the Bay's land read once for the lairs' rates too
  assert.match(W, /const _countryGround = _countryTemplates \? createCountryGround\(host\.woods\) : null;/);
  // PIN MOVED (AUDIT TESA II P1): online the open zone's hall of the day first - Cyrodiil's lie past the Bay
  assert.match(W, /if \(\(_arenaTemplates \|\| _countryTemplates \|\| _capitalBase\) && !onTheBay\(px, py\)\) return \(locationIndex\.get\(`\$\{px\},\$\{py\}`\)\?\.superTier \? locationIndex\.get\(`\$\{px\},\$\{py\}`\) : null\) \|\| \(params\.has\('online'\) && zoneHalls\.standIn\(cyrodiilMask\(\), px, py\)\) \|\| settle2LocationAt\(px, py\) \|\| host\.capitalLocationAt\(px, py\) \|\| \(_arenaTemplates && host\.arenaLocationAt\(px, py\)\) \|\| host\.countryLocationAt\(px, py\) \|\| host\.lairLocationAt\(px, py\) \|\| spawnPastBayAt\(px, py\);/);   // PIN MOVED (TESA8): then the lair's (tesa8_lairs); PIN MOVED (TESA10): a capital first (tesa10_capitals)   // PIN MOVED (HOST-SPLIT, SPAWN-WORLD 2026-10-26): _locationToBuild is scenes/spawnStandHost.js's, the places' rolls through `host`   // PIN MOVED (SPAWN-WORLD 2026-10-26): online, the spawner's last - never on a place   // PIN MOVED (WW5, bible/03-World/World-Wide.md WW5): a province's Hollow first, as its lane stands it in the index (scenes/superDungeon/sdLanes.js) - carried into scenes/spawnStandHost.js at the packages' merge (AUDIT BAY-LEFT)
  const tp = W.slice(W.indexOf('    window.__tesaPlace = (x, y) => {'), W.indexOf('    window.__arena = () => {'));
  assert.match(tp, /country: loc\?\.country \?\? null,\n\s*type: loc\?\.mapTableData\?\.locationType \?\? null,\n\s*\};/, 'the probe reads it');
  const M = read('src/scenes/worldModes.js');
  // PIN MOVED (BAY-LEFT-B, bible/03-World/Arena-Provinces.md): a country place sells its houses and reads its deed - its
  // province's region's, held to its own map id (banking.js deedHeldIn; test/systems/bayleftb_houses.test.js)
  assert.match(M, /if \(isEtherPlaceId\(dir\.mapId\)\) return \[\];/, 'a house sold in one');
  assert.match(M, /const houseOwnedAt = \(b, key\) => !isEtherPlaceId\(homeTownOf\(b\)\) && isHouseOwned\(/, 'and its deed read there');
});

/** countryLocationAt as the host has it, over stubs: the real pick, name and clone, a pixel's water, road and ground the test's. */
function host({ water = new Set(), roads = new Set(), wet = new Set(), templates = true } = {}) {
  const T5 = new Map(COUNTRY_TYPES.map((t) => [t, [row(1000 + t, t), row(2000 + t, t)]]));
  const rates = new Map([[230, [[T.HomeFarms, 0.5], [T.Tavern, 1]]], [226, [[T.TownHamlet, 1]]]]);
  const d = { index: new Map(), gen: 0, climate: () => 230, asked: 0 };
  const src = `${lift('  function countryRollAt(px, py) {')}\n${lift('  function countryLocationAt(px, py) {')}`;   // PIN MOVED (TESA13): the roll is its own function, the map's read of it too
  const make = new Function('d', 'countryStandsAt', 'countryName', 'countryNameSeed', 'synthesizeCountryLocation', 'T5', 'rates', 'water', 'roads', 'wet', 'templates', `
    const _countryTemplates = templates ? T5 : null, locationIndex = d.index;
    const countryRatesNow = () => { d.asked++; return rates; };
    const maps = { getClimateIndex: (x, y) => d.climate(x, y), getRegionIndexAt: () => 23 };
    const woods = { getHeightMapValue: (x, y) => (water.has(x + ',' + y) ? 0 : 40) };
    const _countryGround = (x, y) => !wet.has(x + ',' + y);
    // TESA14: the world the roll reads, as the host hands it - no road among it
    const _pastBayAt = { climateAt: (x, y) => maps.getClimateIndex(x, y), heightAt: (x, y) => woods.getHeightMapValue(x, y), ground: (x, y) => _countryGround(x, y) };
    const _pastBay = { countryRoll: null };   // PIN MOVED (HOST-SPLIT, at the merge of main): the place law is scenes/tamrielPlacesHost.js's, its live names through host
    const provinceKeyBeyondBay = (x) => (x < 3000 ? 'skyrim' : null), provinceNameBank = (k) => (k === 'skyrim' ? 2 : null), getNameBankOfRegion = () => 0;
    const REGION_NAMES = { 23: 'Wrothgarian Mountains' }, getWorldClimateSettings = (c) => ({ worldClimate: c });
    const townClimateAt = (x, y, settings) => settings;   // PIN MOVED (URBANIZER U1): the province's set laid over the zone's - its own test's (urban1_look)
    const host = { _locIndexGen: 0 };
    const outlineTownLocation = (loc) => loc, blockOf = null, imperialOutskirts = () => false;   // PIN MOVED (TOWN-SHAPES TS3): the clone laid as its outline - its own test's (townoutline); TS5: round in the Imperial City's outskirts
    ${src}
    return { countryLocationAt, gen: () => host._locIndexGen };`);
  return { d, ...make(d, countryStandsAt, countryName, countryNameSeed, synthesizeCountryLocation, T5, rates, water, roads, wet, templates) };
}

test('TESA7 the host\'s ask: the roll\'s place stood once in the index under the province\'s name; the same pixel the same object; water and the sea\'s edge stand none; a climate that moves clones again - TESA14: and a road takes no place\'s pixel', () => {
  const h = host();
  const loc = h.countryLocationAt(2200, -360);
  assert.ok(loc?.country, 'a farm or an inn: every roll stands under ceilings of 1');
  assert.equal(h.d.index.get('2200,-360'), loc);
  assert.equal(h.gen(), 1);
  assert.equal(loc.name, countryName(loc.country.type, BANK_TYPES.Nord, countryNameSeed(2200, -360)), 'a Nord\'s, its province\'s');
  assert.deepEqual([loc.regionIndex, loc.regionName, loc.politic, loc.climate.worldClimate], [23, 'Wrothgarian Mountains', 128 + 23, 230]);
  assert.equal(h.countryLocationAt(2200, -360), loc, 'once');
  assert.equal(h.gen(), 1);
  const west = h.countryLocationAt(3100, -360);
  assert.equal(west.name, countryName(west.country.type, BANK_TYPES.Breton, countryNameSeed(3100, -360)), 'no province: the clamp\'s region\'s bank');
  h.d.climate = () => 226;
  const moved = h.countryLocationAt(2200, -360);
  assert.notEqual(moved, loc);
  assert.equal(moved.country.type, T.TownHamlet, 'the climate moved, the kind with it');
  assert.equal(h.d.index.get('2200,-360'), moved);
  // AUDIT TESA-BIOME P13: a pixel that stops standing a place leaves the index - no stale place stays (a zone's climate with
  // no countryside, the trace landing)
  const genBefore = h.gen();
  h.d.climate = () => 999;
  assert.equal(h.countryLocationAt(2200, -360), null, 'nothing stands there now');
  assert.equal(h.d.index.has('2200,-360'), false, 'the old place gone from the index');
  assert.equal(h.gen(), genBefore + 1, 'and the index\'s generation moved');
  h.d.climate = () => 226;
  assert.ok(h.countryLocationAt(2200, -360), 'stood again');
  for (const [o, what] of [[{ water: new Set(['5,-5']) }, 'water'], [{ wet: new Set(['5,-5']) }, 'the sea\'s edge']]) {
    const g = host(o);
    assert.equal(g.countryLocationAt(5, -5), null, what);
    assert.equal(g.d.index.has('5,-5'), false);
    assert.ok(g.countryLocationAt(6, -5), 'its neighbour stands');
  }
  // PIN MOVED (TESA14): the roads are laid round the places (world/tamrielRoads.js) - a road no longer takes one's pixel
  assert.doesNotMatch(lift('  function countryRollAt(px, py) {'), /arenaPathsAt/, 'the roll reads no road');
  const late = host({ roads: new Set(['7,-7']) });
  const stood = late.countryLocationAt(7, -7);
  assert.ok(stood, 'on a road pixel all the same');
  assert.equal(late.countryLocationAt(7, -7), stood, 'and kept');
  assert.equal(host({ templates: false }).countryLocationAt(7, -7), null, 'the door shut');
  assert.equal(h.d.asked > 0, true);
});

test('TESA7 the build\'s order past the Bay: Arena\'s place where one stands, else the country\'s; on the Bay neither is asked', () => {
  const src = lift('  function _locationToBuild(px, py) {');
  const make = new Function('arena', 'country', `
    const etherSea = false, inEther = () => false, etherPlaceAt = () => null, onTheBay = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500;
    const _arenaTemplates = arena ? {} : null, _countryTemplates = {}, _capitalBase = null, capitalLocationAt = () => null, locationIndex = new Map([['5,5', { name: 'Daggerfall' }]]);
    const arenaLocationAt = (x) => (x === 2000 ? { name: 'Winterhold' } : null), countryLocationAt = () => country;
    const _spawnLedger = { expired: () => false }, _spawnClock = () => 0, _insideSpawn = () => false, spawnedDungeonAt = () => null;
    const params = new URLSearchParams(''), zoneHalls = { standIn: () => null }, cyrodiilMask = () => null;   // PIN MOVED (AUDIT TESA II P1): offline, no zone's hall
    const settle2LocationAt = () => null;   // PIN MOVED (WG2-TOWNS): no World 2.0 town here (scenes/settle2Host.js)
    let _locIndexGen = 0;
    const host = { get _locIndexGen() { return _locIndexGen; }, set _locIndexGen(v) { _locIndexGen = v; }, _spawnClock, capitalLocationAt, arenaLocationAt, countryLocationAt, lairLocationAt: () => null };   // PIN MOVED (HOST-SPLIT, SPAWN-WORLD): scenes/spawnStandHost.js's live names
    ${src}
    return _locationToBuild;`);
  const farm = { name: 'The Ulfgar Farmstead' };
  const b = make(true, farm);
  assert.equal(b(2000, -300).name, 'Winterhold', 'Arena\'s first');
  assert.equal(b(2001, -300), farm, 'else the country\'s');
  assert.equal(b(5, 5).name, 'Daggerfall', 'the Bay its own');
  assert.equal(b(6, 5), null, 'and never the country\'s');
  assert.equal(make(false, farm)(2000, -300), farm, 'no Arena: the countryside alone');
});
