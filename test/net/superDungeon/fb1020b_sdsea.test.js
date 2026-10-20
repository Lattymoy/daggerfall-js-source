// SD-SEA (FIELD BUGS 2026-10-20b, bible/01-Overview/bugs/Field-Bugs-2026-10-20b.md; the owner: "Abyss Dungeons dont seem to
// be spawning anymore"): A HOLLOW NEVER RISES WHERE NO TOWN STANDS. The director raised a Hollow in the region whose
// channel held the most accounts (net/superDungeon/sdLaw.js pickSdRegion), and every client stood it by that region's
// cities (systems/superDungeon/sdSite.js sdCities). The sea is one region to the port - politic 64, every water pixel,
// reads as High Rock sea coast (formats/mapsFile.js getRegionIndexAt) - and it has no town: a crowd at sea raised a Hollow
// that stood by no city on any client ("[sd] slot N: the world offers no Hollow (no site)"), unseen for its two days and
// the rest after them. The census now never chooses a region with no town (SD_TOWNLESS_REGIONS), and a client stands a
// record that names one (a relay before SD-SEA) by the Bay's great cities, as one whose census counted nobody.
// tools/mutants/fb1020b_sdsea.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { pickSdRegion, SD_TOWNLESS_REGIONS, SD_REGION_COUNT, SD_CENSUS_MIN, sdRise, sdFirst } from '../../../src/net/superDungeon/sdLaw.js';
import { createSdHost } from '../../../src/scenes/superDungeon/sdHost.js';
import { sdCities, findSdSite, sdTemplates, pickSdTemplate, sdHollowLocation } from '../../../src/systems/superDungeon/sdSite.js';
import { scanGatePixels, gateScanner } from '../../../src/systems/gate/gateSite.js';
import { hubClaim } from '../../../src/systems/region/regionHubs.js';
import { MapsFile, LOCATION_TYPES, CLIMATES, REGION_NAMES } from '../../../src/formats/mapsFile.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { createSpawnGround, WORLD_SALT } from '../../../src/world/spawnedDungeons.js';
import { isMainStoryDungeon } from '../../../src/world/dungeon/dungeonTextures.js';
import { SOCIAL_ROOM, chatRegionRoom } from '../../../src/net/wire.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const SEA = 31;
const counts = (o) => Object.assign(new Array(SD_REGION_COUNT).fill(0), o);
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };

test('SD-SEA the regions no Hollow can rise in: the sea\'s (High Rock sea coast, 31), Cybiades\' (one place, no town) and the regions MAPS.BSA gives no place at all - frozen, every one a region the census can name (mutants: the sea dropped from the list)', () => {
  assert.deepEqual([...SD_TOWNLESS_REGIONS], [2, 3, 4, 6, 7, 8, 10, 12, 13, 14, 15, 24, 25, 27, 28, 29, 30, 31, 61]);
  assert.ok(Object.isFrozen(SD_TOWNLESS_REGIONS));
  assert.equal(REGION_NAMES[SEA], 'High Rock sea coast');
  assert.equal(REGION_NAMES[61], 'Cybiades');
  for (const r of SD_TOWNLESS_REGIONS) assert.ok(Number.isInteger(r) && r >= 0 && r < SD_REGION_COUNT, `region ${r}`);
});

test('SD-SEA the census never chooses a region with no town: a crowd at sea gives the Hollow to the fullest region with a town, else to the Bay\'s great cities; the last region\'s rest and the tie\'s roll stand over the rest (mutants: the census\'s filter gone; the sea counted)', () => {
  assert.equal(pickSdRegion(1, counts({ [SEA]: 40, 17: 3 })), 17, 'forty at sea, three in Daggerfall: Daggerfall');
  assert.equal(pickSdRegion(1, counts({ [SEA]: 40 })), -1, 'only the sea: the great cities');
  assert.equal(pickSdRegion(1, counts({ [SEA]: 40, 17: 1 })), -1, 'and a region under the minimum is still no crowd');
  for (const r of SD_TOWNLESS_REGIONS) assert.equal(pickSdRegion(1, counts({ [r]: 50 })), -1, `region ${r} alone`);
  // a tie the sea is in: the tied regions with a town share it, the slot's roll as ever
  const tie = counts({ [SEA]: 5, 9: 5, 17: 5 });
  for (let s = 1; s <= 30; s++) assert.ok([9, 17].includes(pickSdRegion(s, tie)), `slot ${s}`);
  // the last Hollow's region rests while another region with a town qualifies; the sea never stands in for one
  assert.equal(pickSdRegion(2, counts({ [SEA]: 40, 17: 9, 9: 2 }), 17), 9);
  assert.equal(pickSdRegion(2, counts({ [SEA]: 40, 17: 9 }), 17), 17, 'the only crowd with a town is the crowd');
  assert.equal(SD_CENSUS_MIN, 2);
});

test('SD-SEA the hub\'s director: four accounts at sea and two in Daggerfall raise the Hollow in Daggerfall; the sea\'s crowd alone, by the great cities (the relay over the pins\' fake objects - its census of the region channels, then sdRise)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      for (const [crowd, want] of [[{ [SEA]: 4, 17: 2 }, 17], [{ [SEA]: 4 }, -1]]) {
        const world = fakeRooms({ now: () => clock });
        const hub = world.room(SOCIAL_ROOM);
        const h = hub.connect();
        await hub.hello(h, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
        let n = 0;
        for (const [r, k] of Object.entries(crowd)) {
          const room = world.room(chatRegionRoom(Number(r)));
          for (let i = 0; i < k; i++) { const ws = room.connect(); n++; await room.hello(ws, `peer-r${n}`, null, { kind: 'linked', tokenSub: `acct-r${n}` }); }
        }
        await hub.fire();   // the first beat
        clock = hub.room._sdRec.next;
        await hub.fire();   // the rise, after the census
        const rec = hub.room._sdRec;
        assert.equal(rec.ph, 'risen');
        assert.equal(rec.r, want, JSON.stringify(crowd));
        assert.ok(h.sent.some((m) => m.t === 'sd' && m.k === 'ev' && m.r === want), 'and said to the hub');
      }
    });
  } finally { Date.now = realNow; }
});

// ── the client: a record that names a region with no town (a relay before SD-SEA) ──────────────────────────────────

const T = LOCATION_TYPES;
const place = (region, index, px, py, type, { name = `P${region}.${index}`, w = 1, h = 1, buildings = 0, blocks = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: blocks > 0,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
  ...(blocks ? { dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `${i % 3 ? 'N' : 'B'}0000${i}.RDB`, x: i, z: 0, isStartingBlock: !i })), recordElement: { header: { locationId: py * 1000 + px } } } } : {}),
});
/** Two regions: a city and a labyrinth in region 0; region 1, the sea of this world, has none. */
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
const CITY = place(0, 0, 300, 200, T.TownCity, { name: 'Copperham', w: 3, h: 3, buildings: 80 });
const LAB = place(0, 1, 450, 400, T.DungeonLabyrinth, { name: 'The Old Maze', blocks: 14 });
const CITY2 = place(0, 2, 300, 350, T.TownCity, { name: 'Tinmouth', w: 2, h: 2, buildings: 40 });   // a second great city: the slot's roll picks between them
const CITIES = [CITY, CITY2];
const SCAN = scanGatePixels(world([CITY, LAB, CITY2]), { heightAt: () => 90 });
const T0 = 1_800_000_000_000, M = 60_000;

function harness() {
  const s = { asked: [], stands: [], index: new Map() };
  const host = createSdHost({
    now: () => T0,
    scan: () => SCAN,
    cities: (r) => { s.asked.push(r); return sdCities(CITIES, r, { regionNameOf: () => 'Nowhere' }); },
    templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }),
    stand: (key, loc) => { s.index.set(key, loc); s.stands.push(key); },
    unstand: (key) => { s.index.delete(key); },
    inside: () => false,
    door: () => null,
    feet: () => null,
    sendFound: () => true,
    say: () => {},
  });
  return { s, host };
}

test('SD-SEA a record naming a region with no town stands its Hollow by the Bay\'s great cities - on the pixel a record of the census\'s nobody stands it, the same slot\'s, so every client agrees; a region with a town as ever (mutants: the fallback gone - the Hollow stood nowhere; the slot\'s roll not taken for the great cities)', () => {
  const rec = (r, s = 1) => ({ k: 'ev', ...sdRise({ ...sdFirst(T0 - 20 * M), s: s - 1 }, T0 - 10 * M, r) });
  const cityOf = new Set();
  for (let slot = 1; slot <= 8; slot++) {
    // the record as a relay before SD-SEA raised it: region 1, where this world has no town
    const sea = harness();
    sea.host.heard(rec(1, slot));
    sea.host.frame();
    assert.equal(sea.s.stands.length, 1, `slot ${slot}: the Hollow stands - it stood nowhere`);
    assert.deepEqual(sea.s.asked, [1, -1], 'its own region asked first, then the great cities');
    // where a census that counted nobody stands the same slot
    const none = harness();
    none.host.heard(rec(-1, slot));
    none.host.frame();
    assert.deepEqual(sea.s.stands, none.s.stands, `slot ${slot}: the great cities' pixel, by the slot's roll`);
    const site = findSdSite(rec(-1, slot), SCAN, sdCities(CITIES, -1, { regionNameOf: () => 'Nowhere' }));
    assert.deepEqual(sea.s.stands, [`${site.px},${site.py}`]);
    assert.equal(sea.s.index.get(sea.s.stands[0]).superTier, true);
    cityOf.add(sea.host.hollow().site.cityName);
  }
  assert.deepEqual([...cityOf].sort(), ['Copperham', 'Tinmouth'], 'the slots spread over the great cities');
  // a region with a town is its own, as before - asked once
  const land = harness();
  land.host.heard(rec(0));
  land.host.frame();
  assert.deepEqual(land.s.asked, [0]);
  assert.equal(land.s.stands.length, 1);
});

// ── on the freeware's own data ───────────────────────────────────────────────────────────────────────────────────

const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(`${A}/MAPS.BSA`) && existsSync(`${A}/WOODS.WLD`);
let _real = null;
/** MAPS.BSA's own rows (the boot's HUB1 pass, scenes/world.js), the Hollow's cities among them, its templates, the gate's scan and the spawns' ground. */
function real() {
  if (_real) return _real;
  const rd = (n) => new Uint8Array(readFileSync(`${A}/${n}`));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(rd('WOODS.WLD'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), region.locationCount); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); }
  }
  const cityRows = rows.filter((loc) => !!hubClaim(loc, maps.getRegionName(loc.regionIndex)));
  const scanner = gateScanner(maps, { spawnSalt: WORLD_SALT, heightAt: (x, y) => woods.getHeightMapValue(x, y) });
  let scan = null;
  while (!(scan = scanner.step(() => true)));
  _real = { maps, cityRows, templates: sdTemplates(rows, isMainStoryDungeon), scan, ground: createSpawnGround(woods) };
  return _real;
}

test('SD-SEA on the freeware\'s map: the list is exactly the regions MAPS.BSA gives no town; every water pixel (politic 64) reads as the sea\'s region; and every region the census can now choose stands a Hollow by its own cities (mutants: a region with a town written into the list; one without left out)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, () => {
  const { maps, cityRows, templates, scan, ground } = real();
  const regionNameOf = (i) => maps.getRegionName(i);
  const townless = [];
  for (let r = 0; r < SD_REGION_COUNT; r++) if (!sdCities(cityRows, r, { regionNameOf }).length) townless.push(r);
  assert.deepEqual(townless, [...SD_TOWNLESS_REGIONS], 'the regions with no town, MAPS.BSA\'s own');
  let water = 0;
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) if (maps.getPoliticIndex(x, y) === 64) { water++; assert.equal(maps.getRegionIndexAt(x, y), SEA, `pixel ${x},${y}`); }
  assert.ok(water > 100_000, `the sea is the map's widest region (${water} pixels)`);
  for (let r = -1; r < SD_REGION_COUNT; r++) {
    if (SD_TOWNLESS_REGIONS.includes(r)) continue;
    for (let s = 1; s <= 3; s++) {
      const rec = { s, r };
      const site = findSdSite(rec, scan, sdCities(cityRows, r, { regionNameOf }), ground);
      assert.ok(site && sdHollowLocation(rec, site, pickSdTemplate(s, templates)), `region ${r} (${REGION_NAMES[r] ?? 'the great cities'}), slot ${s}`);
    }
  }
});
