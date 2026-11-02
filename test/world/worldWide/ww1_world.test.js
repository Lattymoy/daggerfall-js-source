// WW1 (bible/03-World/World-Wide.md): THE WORLD'S GRID AND ITS PLACES - one key for every pixel the world holds, the
// theatres and the areas every system groups by, the one registry the systems read the world's places through, and the
// living world's towns and dungeons off it. Each law against the shape its producer mints (Home.md, TEST THE SHAPE THE
// PRODUCER MINTS) and each pin mutation-checked (tools/mutants/ww1.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  worldPixelKey, worldPixelOfKey, inWorldGrid, WORLD_PIXEL_SPAN, WORLD_PIXEL_KEYS, BAY_THEATRE, THEATRE_COUNT, THEATRE_KEYS,
  theatreAt, theatreName, BAY_AREA_COUNT, AREA_COUNT, DISTRICT_PX, districtOf, areaOfDistrict, theatreOfArea, districtOfArea,
  isBayArea, areaAt, areaName, areaRace,
} from '../../../src/world/worldWide/worldGrid.js';
import { createWorldPlaces, placeOfRow, PIXEL_PLACES_KEPT } from '../../../src/world/worldWide/worldPlaces.js';
import { bayPlaceRows, BAY_SOURCE } from '../../../src/world/worldWide/bayPlaces.js';
import { createLivingIndex, LIVING_DIVE_TYPES } from '../../../src/scenes/livingWorld/livingIndex.js';
import { WORLD_PIXEL_BOUND } from '../../../src/net/wire.js';
import { PROVINCE_OF_ID, setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { CITIES, PROVINCES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, inBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { REGION_NAMES, REGION_RACES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { getNameBankOfRegion, BANK_TYPES } from '../../../src/characters/nameHelper.js';
import { nameBankOfArea } from '../../../src/characters/areaNameBank.js';
import { walkerRace, raceOfPeople } from '../../../src/characters/mobile/mobilePerson.js';
import { hideoutsOf } from '../../../src/systems/livingWorld/outlaws.js';
import { roadBound } from '../../../src/systems/livingWorld/trips.js';
import { mintResident } from '../../../src/systems/livingWorld/census.js';
import { seededPersonName } from '../../../src/characters/personNames.js';   // REGION-NAMES: PIN MOVED - the bank's draw, the person named off it
import { lwSeed } from '../../../src/systems/livingWorld/seed.js';
import { folkNameBank, PROVINCE_FOLK, folkOfArea, withZone, folkKeyOf } from '../../../src/characters/provinceFolk.js';   // PROVINCE-FOLK: a resident's own people's bank
import { GENDERS } from '../../../src/characters/nameHelper.js';
import { createDryGround } from '../../../src/world/dryGround.js';
import { codeOnly } from '../../codeOnly.mjs';
import { hostText } from '../../hostText.mjs';   // AUDIT TESA II (lane K's K6): the negative reads the host WHOLE (HOST-SPLIT 2, the second read)

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the suite

// ─── 1. THE KEY ─────────────────────────────────────────────────────

test('WW1 the key: one whole number for every pixel the wire carries - the wire\'s own bound, distinct across the whole grid, its own inverse, under WORLD_PIXEL_KEYS; and the Bay\'s `y * 1000 + x` is not it (mutants: the span, the row\'s width)', () => {
  assert.equal(WORLD_PIXEL_SPAN, WORLD_PIXEL_BOUND, 'the wire\'s world, pinned equal (the worker cannot import the wire)');
  const seen = new Map();
  const take = (px, py) => {
    const k = worldPixelKey(px, py);
    assert.ok(Number.isSafeInteger(k) && k >= 0 && k < WORLD_PIXEL_KEYS, `${px},${py} -> ${k}`);
    assert.deepEqual(worldPixelOfKey(k), [px, py]);
    const was = seen.get(k);
    assert.ok(was === undefined || was === `${px},${py}`, `${px},${py} and ${was} share a key`);
    seen.set(k, `${px},${py}`);
  };
  for (let py = -WORLD_PIXEL_SPAN + 1; py < WORLD_PIXEL_SPAN; py += 997) for (let px = -WORLD_PIXEL_SPAN + 1; px < WORLD_PIXEL_SPAN; px += 991) take(px, py);
  for (const [px, py] of [[0, 0], [999, 499], [-1, 0], [0, -1], [1000, 0], [-WORLD_PIXEL_SPAN + 1, -WORLD_PIXEL_SPAN + 1], [WORLD_PIXEL_SPAN - 1, WORLD_PIXEL_SPAN - 1]]) take(px, py);
  // the two the old key folded: a pixel and the one a thousand east and a row north
  assert.notEqual(worldPixelKey(1500, 10), worldPixelKey(500, 11));
  assert.notEqual(worldPixelKey(-200, 30), worldPixelKey(800, 29));
  assert.equal(WORLD_PIXEL_KEYS, (2 * WORLD_PIXEL_SPAN) ** 2);
  assert.ok(inWorldGrid(-WORLD_PIXEL_SPAN + 1, WORLD_PIXEL_SPAN - 1) && !inWorldGrid(WORLD_PIXEL_SPAN, 0) && !inWorldGrid(0.5, 0));
});

// ─── 2. THE THEATRES ────────────────────────────────────────────────

test('WW1 the theatres: the Iliac Bay one, and each province beyond the Bay\'s rectangle another, numbered as the picker numbers them; every authored city past the Bay stands in its own province\'s theatre (mutants: the Bay\'s test, the province\'s number)', () => {
  assert.equal(THEATRE_COUNT, 10);
  assert.deepEqual(THEATRE_KEYS, ['IliacBay', ...Array.from({ length: 9 }, (_, i) => PROVINCE_OF_ID[i + 1])]);
  for (const [px, py] of [[0, 0], [999, 499], [500, 250], [212, 151]]) assert.equal(theatreAt(px, py), BAY_THEATRE, `${px},${py} the Bay's`);
  let past = 0;
  for (const c of CITIES) {
    const [bx, by] = pictureToBay(c.at[0], c.at[1]).map(Math.floor);
    if (inBay(bx, by)) continue;
    past++;
    assert.equal(theatreAt(bx, by), THEATRE_KEYS.indexOf(c.province), `${c.name}, ${c.province}`);
  }
  assert.ok(past > 50, `the authored cities beyond the Bay (${past})`);
  assert.equal(theatreName(BAY_THEATRE), '', 'the Bay\'s names are its regions\'');
  assert.equal(theatreName(THEATRE_KEYS.indexOf('Skyrim')), 'Skyrim');
  assert.equal(theatreAt(-WORLD_PIXEL_SPAN + 1, -WORLD_PIXEL_SPAN + 1), -1, 'off the continent: none');
});

// ─── 3. THE AREAS ───────────────────────────────────────────────────

test('WW1 the areas: on the Bay the region itself, the same number; past it a province\'s district - a square of DISTRICT_PX in the Bay\'s own coordinates, one area a (district, province), its own inverse; named for the province (mutants: the Bay\'s branch, the slot, the district\'s side)', () => {
  assert.equal(BAY_AREA_COUNT, 62);   // PIN MOVED (WW-R): the Bay's regions - REGION_NAMES holds the provinces' after them, never an area
  assert.equal(REGION_NAMES.length, 71);
  assert.equal(DISTRICT_PX, 96);
  for (let r = 0; r < BAY_AREA_COUNT; r++) {
    assert.equal(areaAt(400, 200, () => r), r, 'the region\'s own number');
    assert.ok(isBayArea(r) && theatreOfArea(r) === BAY_THEATRE && districtOfArea(r) === null);
    assert.equal(areaName(r), REGION_NAMES[r]);
  }
  assert.ok(!isBayArea(BAY_AREA_COUNT) && !isBayArea(-1));
  const seen = new Set();
  for (let t = 1; t < THEATRE_COUNT; t++) for (const [cx, cy] of [[0, 0], [5, 9], [93, 77], [170, 170]]) {
    const a = areaOfDistrict(t, cx, cy);
    assert.ok(a >= BAY_AREA_COUNT && a < AREA_COUNT && !seen.has(a), `${t} ${cx},${cy}`);
    seen.add(a);
    assert.equal(theatreOfArea(a), t);
    assert.deepEqual(districtOfArea(a), [cx, cy]);
    assert.equal(areaName(a), theatreName(t));
  }
  assert.equal(areaOfDistrict(BAY_THEATRE, 3, 3), -1);
  assert.equal(areaOfDistrict(3, -1, 0), -1);
  // a pixel past the Bay: its district under the Bay's coordinates, its province's
  const solitude = CITIES.find((c) => c.name === 'Solitude');
  const [sx, sy] = pictureToBay(solitude.at[0], solitude.at[1]).map(Math.floor);
  const a = areaAt(sx, sy, () => 99);
  assert.equal(theatreOfArea(a), THEATRE_KEYS.indexOf('Skyrim'));
  assert.deepEqual(districtOfArea(a), districtOf(sx, sy));
  assert.deepEqual(districtOf(-WORLD_PIXEL_SPAN, -WORLD_PIXEL_SPAN), [0, 0]);
  assert.deepEqual(districtOf(-WORLD_PIXEL_SPAN + DISTRICT_PX, 0), [1, Math.floor(WORLD_PIXEL_SPAN / DISTRICT_PX)]);
  assert.equal(areaName(a), 'Skyrim');
});

test('WW1 an area\'s people: every Bay region FALL.EXE\'s (REGION_RACES), every province beyond its own race, the Imperial Province Imperial; the name bank the region\'s own on the Bay and the people\'s past it, Black Marsh\'s the Imperial by DFU\'s quirk; a walker of Hammerfell beyond the Bay a Redguard (mutants: the Bay\'s table, the Imperial bank, the walker\'s area)', () => {
  for (let r = 0; r < BAY_AREA_COUNT; r++) {   // PIN MOVED (WW-R): the Bay's regions (REGION_RACES holds the provinces' after them)
    assert.equal(areaRace(r), REGION_RACES[r] === 1 ? 'Redguard' : 'Breton');
    assert.equal(nameBankOfArea(r), getNameBankOfRegion(r), 'GetNameBankOfRegion\'s own');
  }
  assert.equal(nameBankOfArea(-1), getNameBankOfRegion(-1));
  const of = (key) => areaOfDistrict(THEATRE_KEYS.indexOf(key), 40, 40);
  for (const p of PROVINCES) assert.equal(areaRace(of(p.key)), p.race ?? 'Imperial', p.key);
  assert.equal(nameBankOfArea(of('Skyrim')), BANK_TYPES.Nord);
  assert.equal(nameBankOfArea(of('Elsweyr')), BANK_TYPES.Khajiit);
  assert.equal(nameBankOfArea(of('Imperial')), BANK_TYPES.Imperial);
  assert.equal(nameBankOfArea(of('BlackMarsh')), BANK_TYPES.Imperial, 'NameHelper.cs:50: Imperial names where one would expect Argonian');
  assert.equal(nameBankOfArea(of('Hammerfell')), BANK_TYPES.Redguard);
  for (const people of [0, 2, 3]) {
    assert.equal(walkerRace(people, of('Hammerfell')), 'Redguard');
    assert.equal(walkerRace(people, of('Skyrim')), raceOfPeople(people), 'the climate\'s, as on the Bay');
  }
});

// ─── 4. THE REGISTRY ────────────────────────────────────────────────

const row = (mapId, px, py, o = {}) => ({ mapId, name: `P${mapId}`, px, py, type: LOCATION_TYPES.TownCity, region: 17, w: 2, h: 3, ...o });

test('WW1 the registry: a list\'s places by their pixel and map id, ONE PLACE A PIXEL (the first list\'s, then a list\'s first row; a held map id the same), a generation that moves on every register and drop, a register of a name replacing its own; each place its area and theatre - the region and the Bay\'s on the Bay, the province\'s district past it, -1 for a region past it (mutants: the held pixel, the held id, the generation, the Bay\'s region)', () => {
  const pl = createWorldPlaces();
  assert.equal(pl.generation(), 0);
  assert.equal(pl.register('bay', [row(1, 10, 10), row(2, 10, 10), row(3, 11, 10), row(1, 12, 10)]), 4);
  assert.equal(pl.generation(), 1);
  assert.deepEqual(pl.all().map((p) => p.mapId), [1, 3], 'the second on a held pixel and the one of a held id stand nowhere');
  assert.equal(pl.shadowed(), 2);
  const solitude = CITIES.find((c) => c.name === 'Solitude');
  const [sx, sy] = pictureToBay(solitude.at[0], solitude.at[1]).map(Math.floor);
  pl.register('beyond', [row(900, sx, sy, { region: 5 }), row(901, 10, 10)]);
  assert.equal(pl.generation(), 2);
  assert.equal(pl.at(10, 10).mapId, 1, 'the first list\'s');
  const s = pl.at(sx, sy);
  // PIN MOVED (WW-R, bible/03-World/World-Wide.md): past the Bay its province's region (the provider's own word for a Bay region refused)
  assert.deepEqual([s.region, s.theatre, s.area], [64, THEATRE_KEYS.indexOf('Skyrim'), areaAt(sx, sy, () => -1)], 'Skyrim\'s region past the Bay');
  assert.deepEqual([pl.at(10, 10).area, pl.at(10, 10).theatre, pl.at(10, 10).region], [17, BAY_THEATRE, 17]);
  assert.deepEqual(pl.areas(), [17, s.area].sort((a, b) => a - b));
  assert.deepEqual(pl.theatres(), [BAY_THEATRE, s.theatre]);
  assert.deepEqual(pl.inArea(17).map((p) => p.mapId), [1, 3]);
  assert.deepEqual(pl.inTheatre(s.theatre).map((p) => p.mapId), [900]);
  assert.equal(pl.byMapId(900), s);
  assert.deepEqual(pl.near(11, 11, 1).map((p) => p.mapId), [1, 3]);
  assert.deepEqual(pl.near(11, 11, 1, (p) => p.mapId !== 1).map((p) => p.mapId), [3]);
  pl.register('beyond', [row(902, sx + 1, sy)]);
  assert.equal(pl.byMapId(900), null, 'a second register of a name replaces its first');
  pl.drop('beyond');
  assert.equal(pl.generation(), 4);
  assert.deepEqual(pl.sources(), ['bay']);
  pl.drop('nobody');
  assert.equal(pl.generation(), 4, 'a drop of nothing moves nothing');
  // a place's record, as the producer mints it
  const p = placeOfRow(row(7, 300, 200, { port: 1, dungeonType: 4, hasDungeon: 1 }), 'bay');
  assert.deepEqual({ ...p }, { key: worldPixelKey(300, 200), mapId: 7, name: 'P7', px: 300, py: 200, type: LOCATION_TYPES.TownCity, region: 17, area: 17, theatre: 0, w: 2, h: 3, blocks: 6, port: true, dungeonType: 4, hasDungeon: true, source: 'bay' , location: null});
  assert.ok(Object.isFrozen(p));
  assert.equal(placeOfRow(row(8, WORLD_PIXEL_SPAN, 0), 'x'), null, 'off the grid: none');
});

test('WW1 a pixel provider: found by place - on its own pixel only, under any list\'s place, never on a list\'s map id - kept a pixel at a time to PIXEL_PLACES_KEPT, its places by map id once found, an area past the Bay its district walked once a generation (mutants: the own pixel, the list first, the walk\'s area)', () => {
  const pl = createWorldPlaces();
  pl.register('bay', [row(1, 10, 10)]);
  const solitude = CITIES.find((c) => c.name === 'Solitude');
  const [sx, sy] = pictureToBay(solitude.at[0], solitude.at[1]).map(Math.floor);
  // a place of another area inside the same district (a provider that knows its area better than the pixel)
  const [dx, dy] = districtOf(sx, sy);
  const ox = dx * DISTRICT_PX - WORLD_PIXEL_SPAN + ((sx - (dx * DISTRICT_PX - WORLD_PIXEL_SPAN) + 40) % DISTRICT_PX), oy = sy;
  let asked = 0;
  pl.registerPixels('country', (px, py) => {
    asked++;
    if (px === ox && py === oy) return row(53, ox, oy, { area: 4242 });
    if (px === 10 && py === 10) return row(50, 10, 10);   // under the Bay's
    if (px === sx && py === sy) return row(51, sx, sy, { type: LOCATION_TYPES.TownHamlet });
    if (px === sx + 1 && py === sy) return row(52, sx + 2, sy);   // another pixel's answer
    if (px === sx + 3 && py === sy) return row(1, sx + 3, sy);   // a list's id
    return null;
  });
  assert.equal(PIXEL_PLACES_KEPT, 65536);
  assert.equal(pl.at(10, 10).mapId, 1, 'the list\'s place first');
  assert.equal(pl.byMapId(51), null, 'not found yet');
  assert.equal(pl.at(sx, sy).mapId, 51);
  assert.equal(pl.byMapId(51).mapId, 51, 'found by its map id once found');
  assert.equal(pl.at(sx + 1, sy), null, 'an answer for another pixel is no answer');
  assert.equal(pl.at(sx + 3, sy), null, 'nor a list\'s map id');
  const n = asked;
  pl.at(sx, sy); pl.at(sx + 1, sy);
  assert.equal(asked, n, 'kept, a pixel at a time');
  assert.deepEqual(pl.all().map((p) => p.mapId), [1], 'a pixel provider\'s places are never listed');
  const area = pl.at(sx, sy).area;
  assert.deepEqual(pl.inArea(area).map((p) => p.mapId), [51], 'its district walked - its own area\'s alone');
  assert.equal(pl.at(ox, oy).area, 4242, 'the other area\'s, in the same district');
  const walked = asked;
  assert.equal(pl.inArea(area), pl.inArea(area), 'kept - the same answer, its district walked once a generation');
  assert.equal(asked, walked, 'nothing asked again');
  assert.ok(walked - n >= DISTRICT_PX * DISTRICT_PX - 4, 'every pixel of the district');
  assert.deepEqual(pl.near(sx, sy, 1).map((p) => p.mapId), [51]);
  pl.register('bay', [row(1, 10, 10)]);
  assert.equal(pl.byMapId(51), null, 'a new generation forgets what it found');
});

test('WW1 the Bay\'s provider: the game\'s own rows as places - each at its own longitude and latitude, its region, its grid, its port Travel Options\' list, its dungeon\'s type (mutants: the port, the grid)', () => {
  const loc = (mapId, lon, lat, o = {}) => ({ name: `L${mapId}`, regionIndex: 23, hasDungeon: true, mapTableData: { mapId, locationType: LOCATION_TYPES.DungeonKeep, longitude: lon, latitude: lat, dungeonType: 6 }, exterior: { exteriorData: { width: 4, height: 5 } }, ...o });
  const rows = bayPlaceRows([loc(77, 300 * 128 + 5, (499 - 200) * 128 + 9), loc(78, 0, 0, { exterior: null }), { mapTableData: null }], { hasPort: (id) => id === 77 });
  assert.deepEqual(rows[0], { mapId: 77, name: 'L77', px: 300, py: 200, type: LOCATION_TYPES.DungeonKeep, region: 23, w: 4, h: 5, port: true, dungeonType: 6, hasDungeon: true });
  assert.deepEqual([rows[1].w, rows[1].h, rows[1].port], [1, 1, false], 'a row with no exterior a 1 x 1 grid');
  assert.equal(rows.length, 2, 'a row with no map table none');
  assert.equal(BAY_SOURCE, 'bay');
});

// ─── 5. THE LIVING WORLD'S INDEX ────────────────────────────────────

test('WW1 the living world\'s index: towns and dungeons off the registry - a town a populated place, a dungeon a diver\'s kind, each one record a generation; near sorted by map id and kept; an area\'s towns; a provider past the Bay\'s towns its records the moment it registers, and every book made again - PIN MOVED (AUDIT TESA II P7): never a trip\'s end nor a band\'s town until WW7 (mutants: the populated filter, the dive kinds, the generation, the area; the Bay\'s theatre alone)', () => {
  const pl = createWorldPlaces();
  pl.register('bay', [
    row(5, 100, 100, { type: LOCATION_TYPES.TownCity }), row(4, 101, 100, { type: LOCATION_TYPES.TownHamlet, region: 18 }),
    row(6, 102, 100, { type: LOCATION_TYPES.HomeFarms }), row(9, 103, 100, { type: LOCATION_TYPES.DungeonRuin, dungeonType: 3 }),
    row(10, 104, 100, { type: LOCATION_TYPES.DungeonLabyrinth }),
  ]);
  const populated = (t) => t === LOCATION_TYPES.TownCity || t === LOCATION_TYPES.TownHamlet;
  const idx = createLivingIndex({ places: pl, populated, peopleAt: (px) => px % 4 });
  assert.deepEqual([...idx.towns().values()].map((t) => t.mapId), [5, 4], 'the populated alone');
  assert.deepEqual({ ...idx.townAt(100, 100) }, { mapId: 5, name: 'P5', px: 100, py: 100, type: LOCATION_TYPES.TownCity, region: 17, area: 17, people: 0, blocks: 6, w: 2, h: 3, port: false });
  assert.equal(idx.townOfId(5), idx.townAt(100, 100), 'one record');
  assert.equal(idx.townAt(102, 100), null, 'a farm no town');
  assert.deepEqual(idx.townsNear(101, 100, 2).map((t) => t.mapId), [4, 5], 'by map id');
  assert.equal(idx.townsNear(101, 100, 2), idx.townsNear(101, 100, 2), 'kept');
  assert.deepEqual(idx.townsIn(18).map((t) => t.mapId), [4]);
  assert.deepEqual([...LIVING_DIVE_TYPES].sort(), [LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep, LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard].sort());
  assert.deepEqual(idx.dungeonsNear(103, 100, 1).map((d) => [d.mapId, d.dungeonType, d.dungeon]), [[9, 3, true], [10, 0, true]]);
  assert.equal(idx.dungeonOfId(9).blocks, 1);
  // a provider past the Bay
  const solitude = CITIES.find((c) => c.name === 'Solitude');
  const [sx, sy] = pictureToBay(solitude.at[0], solitude.at[1]).map(Math.floor);
  pl.register('beyond', [row(700, sx, sy), row(701, sx + 3, sy + 1, { type: LOCATION_TYPES.TownHamlet })]);
  const t = idx.townAt(sx, sy);
  assert.ok(t && t.region === 64 && theatreOfArea(t.area) === THEATRE_KEYS.indexOf('Skyrim'), 'its area a district of Skyrim, its region Skyrim\'s');   // PIN MOVED (WW-R)
  assert.equal(idx.townOfId(701).name, 'P701', 'its records the index\'s');
  // PIN MOVED (AUDIT TESA II P7, then WW7-7 - bible/03-World/World-Wide.md): an index handed no word of the land past the Bay
  // (`beyond`: the roads past the Bay laid whole, and the places they rolled) knows no square past the Bay - a trip there
  // waits on it (test/world/worldWide/ww7_people.test.js: the squares past the Bay once it is said)
  assert.deepEqual(idx.townsNear(sx, sy, 4), [], 'no trip from past the Bay while its roads are unsaid');
  assert.deepEqual(idx.townsNear(101, 100, 2).map((x) => x.mapId), [4, 5], 'the Bay\'s as before');
  assert.deepEqual(idx.townsIn(t.area), [], 'no band\'s town in Skyrim\'s area while its roads are unsaid');
  assert.deepEqual(idx.townsIn(18).map((x) => x.mapId), [4]);
  assert.notEqual(idx.townOfId(5), undefined);
  const g = idx.generation();
  pl.drop('beyond');
  assert.notEqual(idx.generation(), g);
  assert.equal(idx.townAt(sx, sy), null, 'made again: gone');
  assert.deepEqual(idx.townsNear(sx, sy, 4), []);
});

test('WW1 the living world groups by AREA: a patrol keeps its own (a region on the Bay, a district past it); the bands of an area past the Bay keep their hideouts in its own province and a Bay region\'s on the Bay, keyed O<area> (mutants: the patrol\'s area, the hideout\'s theatre; AUDIT WW F9: a band by the border kept on its side)', () => {
  const a = { mapId: 1, area: 17, region: 17, blocks: 4 };
  assert.equal(roadBound('patrol', a, { mapId: 2, area: 17, region: 17, blocks: 4 }), true);
  assert.equal(roadBound('patrol', a, { mapId: 3, area: 18, region: 18, blocks: 4 }), false);
  const beyond = areaOfDistrict(3, 90, 70);
  assert.equal(roadBound('patrol', { mapId: 4, area: beyond, region: -1, blocks: 4 }, { mapId: 5, area: beyond, region: -1, blocks: 4 }), true);
  assert.equal(roadBound('patrol', { mapId: 4, area: beyond, region: -1, blocks: 4 }, { mapId: 6, area: beyond + 16, region: -1, blocks: 4 }), false, 'the next district\'s is not its beat');
  assert.equal(roadBound('patrol', { mapId: 7, region: 17, blocks: 4 }, { mapId: 8, region: 17, blocks: 4 }), true, 'a record with no area its region');
  // a band: two towns on a straight road - its hideout off the road's middle, 1-2 px to a side the seed picks. On the
  // Bay's north edge a side past it is no place for a Bay band; in a province, a side in another none for its band
  // (AUDIT WW F9: High Rock's road one pixel off Skyrim's border, x 1349 | 1350, the authored shape) - across many
  // areas, so both sides are tried
  const world = (towns, line) => ({ townsIn: () => towns, townsNear: () => [], routeOf: () => ({ pixels: line }) });
  const town = (mapId, px, py, area) => ({ mapId, px, py, area, blocks: 9 });
  const along = Array.from({ length: 9 }, (_, i) => ({ x: 100 + i, y: 0 }));
  const skyrim = THEATRE_KEYS.indexOf('Skyrim'), highRock = THEATRE_KEYS.indexOf('HighRock');
  const inSkyrim = Array.from({ length: 9 }, (_, i) => ({ x: 1600, y: -400 + i }));
  const byBorder = Array.from({ length: 9 }, (_, i) => ({ x: 1349, y: -523 + i }));
  for (const p of byBorder) assert.deepEqual([theatreAt(p.x - 2, p.y), theatreAt(p.x, p.y), theatreAt(p.x + 1, p.y), theatreAt(p.x + 2, p.y)], [highRock, highRock, skyrim, skyrim], 'the border the road runs by');
  let bays = 0, beyonds = 0, borders = 0;
  for (let r = 0; r < 40; r++) {
    for (const h of hideoutsOf(r, world([town(1, 100, 0, r), town(2, 108, 0, r)], along))) {
      bays++;
      assert.ok(inBay(h.px, h.py) && h.key === `O${r}.${h.i}` && h.area === r, 'a Bay band on the Bay - its key the region\'s, as a save names it');
    }
    const a = areaOfDistrict(skyrim, 80 + r, 80);
    for (const h of hideoutsOf(a, world([town(1, 1600, -400, a), town(2, 1600, -392, a)], inSkyrim))) {
      beyonds++;
      assert.ok(theatreAt(h.px, h.py) === skyrim && h.key === `O${a}.${h.i}`, 'a band past the Bay in its own province');
    }
    const hr = areaOfDistrict(highRock, 80 + r, 80);
    for (const h of hideoutsOf(hr, world([town(1, 1349, -523, hr), town(2, 1349, -515, hr)], byBorder))) {
      borders++;
      assert.equal(theatreAt(h.px, h.py), highRock, `High Rock's band never over the border (${h.px},${h.py})`);
    }
  }
  assert.ok(bays >= 40 && beyonds >= 40 && borders >= 40, `every area's band stood (${bays}, ${beyonds}, ${borders})`);
});

// PIN MOVED (PROVINCE-FOLK, bible/03-World/World-Wide.md): a resident of Skyrim's district is one of Skyrim's people, named
// from their own people's bank - a Nord's the Nord bank, an Imperial among them the Imperial bank.
test('WW1 a resident past the Bay is named from its area\'s people - a Nord of Skyrim\'s district by the Nord bank, PROVINCE-FOLK: one of its other people by their own - and one of the Bay by its region\'s, as before (mutants: the census\'s bank)', () => {
  const skyrim = areaOfDistrict(THEATRE_KEYS.indexOf('Skyrim'), 90, 70);
  const town = { mapId: 7001, px: 1600, py: -400, type: 0, region: -1, area: skyrim, people: 0, blocks: 9 };
  const races = new Set();
  for (let slot = 0; slot < 40; slot++) {
    const res = mintResident(town, 'h', slot, 'townsperson');
    const seed = lwSeed(7001, 'h'.charCodeAt(0), slot);
    races.add(res.race);
    assert.ok(PROVINCE_FOLK.Skyrim.some(([r]) => r === res.race), res.race);
    assert.equal(res.name, seededPersonName(seed ^ 0x5eed1e55, folkNameBank(res.race), res.gender === GENDERS.Female ? GENDERS.Female : GENDERS.Male, { race: res.race, region: skyrim, home: folkKeyOf(withZone(folkOfArea(skyrim), town.px, town.py)) }));
    if (res.race === 'Nord') assert.equal(folkNameBank(res.race), BANK_TYPES.Nord);
  }
  assert.ok(races.has('Nord') && races.size > 1, `Skyrim's own and its others: ${[...races]}`);
  const bay = { mapId: 7002, px: 300, py: 200, type: 0, region: 20, area: 20, people: 2, blocks: 9 };
  const res = mintResident(bay, 'h', 0, 'townsperson');
  assert.equal(res.name, seededPersonName(lwSeed(7002, 'h'.charCodeAt(0), 0) ^ 0x5eed1e55, getNameBankOfRegion(20), res.gender, { race: res.race, region: 20 }));
});

test('WW1 the dry ground keeps a pixel\'s kernel by the world\'s key - a pixel and the one a thousand east and a row north are two (mutants: the Bay\'s pixel id)', () => {
  const wetAt = [5, 20];
  const woods = {
    getHeightMapValuesRange1Dim: (x, y, d) => new Array(d * d).fill(x + 2 === wetAt[0] && y + 2 === wetAt[1] ? 0 : 200),
    getLargeHeightMapValuesRange: (x, y, n) => new Array(9 * 9).fill(0),
  };
  const dry = createDryGround(woods);
  assert.equal(dry(5, 20, 0.5, 0.5), false, 'the sea');
  assert.equal(dry(1005, 19, 0.5, 0.5), true, 'land a thousand east and a row north - not the sea\'s kernel kept');
});

// ─── 6. THE HOST ────────────────────────────────────────────────────

test('WW1 the host: the game\'s own rows the registry\'s first provider at the boot, the living world\'s index over the registry, its towns, dungeons, area towns, port towns and dungeons by id handed on, the pixel builder\'s town the index\'s; nothing in the living world filed by `y * 1000 + x` (mutants: the index unwired, the pixel builder)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const worldPlaces = gamePlaces\(createWorldPlaces\(\)\);\n\s*worldPlaces\.register\(BAY_SOURCE, bayPlaceRows\(_hubRows, \{ hasPort \}\)\);\n\s*_hubRows\.length = 0;/);   // PIN MOVED (AUDIT RELEASE R2-7): the registry handed to the Staff Panel's picker as it is made (net/staffPlaces.js gamePlaces)
  // PIN MOVED (WW7-7): the index and the trips' world scenes/livingWorld/livingTrips.js's, the host handing the registry
  assert.match(w, /const \{ index: livingIndex, [^\n]*\} = createLivingTrips\(\{ places: worldPlaces, populated: populatesWanderingNpcs,\n\s*peopleAt: /);
  const lt = rd('src/scenes/livingWorld/livingTrips.js');
  assert.match(lt, /const index = createLivingIndex\(\{ places, populated, peopleAt, beyond: /);
  assert.match(lt, /townsNear: index\.townsNear,\n[^]*dungeonsNear: index\.dungeonsNear,/);
  assert.match(w, /const livingTownOfId = livingIndex\.townOfId;/);
  // PIN MOVED (WW7-1): a dungeon by its location's own map id - a lair past the Bay has no MAPS row
  assert.match(w, /const id = loc\.mapTableData\?\.mapId \?\? maps\.getLocation\(loc\.regionIndex, loc\.locationIndex\)\?\.mapTableData\?\.mapId;[^\n]*\n\s*return id != null \? livingIndex\.dungeonOfId\(id >>> 0\) : null;/);
  assert.match(rd('src/scenes/pixelBuild.js'), /const livingTown = livingTownAt\(px, py\) \?\? \{/);
  for (const f of ['src/scenes/livingWorld/livingIndex.js', 'src/systems/livingWorld/trips.js', 'src/systems/livingWorld/outlaws.js', 'src/world/dryGround.js', 'src/scenes/pixelBuild.js']) {
    assert.doesNotMatch(codeOnly(rd(f)), /\by \* 1000 \+ x\b|\bpy \* 1000 \+ px\b|\bp\.y \* 1000 \+ p\.x\b/, `${f} files nothing by the Bay's pixel id`);
  }
  assert.doesNotMatch(hostText('src/scenes/world.js'), /_livingTowns\.set\(p\.y \* 1000 \+ p\.x|_livingDungeons\.set\(p\.y \* 1000 \+ p\.x/);   // PIN MOVED (AUDIT TESA II K6): the host whole
});
