// AUDIT TESA II, lane P (2026-10-25; bible/03-World/Arena-Provinces.md, bible/03-World/World-Wide.md,
// bible/11-Multiplayer/Wild-Zone.md) - THE HOSTS PAST THE BAY: the build's hall in the open zone (P1), the zone's halls
// off the places and the rolls and their ground's cost (Z7, Z9), the world's nearest town wired where the rise and
// /unstuck read it (P2, P3), the journey's door (P4), the living world held to the Bay (P7), the lanes past the Bay at
// their own reach and scale (P7), the trace's door (P9) and Arena's nearest port (K15) - each lifted off its host and run,
// or run over the freeware's own world where the law reads it.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createZoneHalls } from '../../src/scenes/zoneHallsHost.js';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { createLivingLanes } from '../../src/scenes/livingWorld/livingLanes.js';
import { livingSide, LIVING_SIDES } from '../../src/scenes/livingWorld/livingIndex.js';   // PIN MOVED (WW7-7): P7's livingRoams lifted
import { portIdOf } from '../../src/world/worldWide/worldPorts.js';
import { createWorldLanes, beyondLaneWay, worldLaneWater, BEYOND_LANE_MAX_PX, BEYOND_LANE_PATH_PX, LANE_NEAR_PX } from '../../src/scenes/naval/worldLanes.js';
import { laneNetwork, LANE_PATH_PX, LANE_MAX_PX, LANE_STRAIGHT_STEPS } from '../../src/systems/naval/seaLanes.js';
import { cyrodiilMask } from '../../src/systems/wild/cyrodiilZone.js';
import { wildInside, maskWorldBox } from '../../src/systems/wild/wildZone.js';
import { plateauDry, spawnGroundDry } from '../../src/world/spawnedDungeons.js';
import { tamrielTraceOn } from '../../src/scenes/shared.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, bayPictureRect, bayToPicture } from '../../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES, DUNGEON_TYPES, MapsFile } from '../../src/formats/mapsFile.js';
import { CLIMATES, regionOfTheatre } from '../../src/formats/mapsTables.js';
import { NATIVE_PIXEL } from '../../src/systems/seaRaiders.js';

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js');
const STAND = rd('src/scenes/spawnStandHost.js');   // PIN MOVED (HOST-SPLIT, SPAWN-WORLD 2026-10-26): _locationToBuild left world.js, its live names read through `host`
const lift = (text, head, end = '\n  }\n') => { const i = text.indexOf(head); assert.ok(i >= 0, head); return text.slice(i, text.indexOf(end, i) + end.length); };
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

/** The Bay's heights clamped at its edges (the zone test's own: a client streaming the Bay alone). */
class BayWoods {
  constructor() { this.heightMapBuffer = new Uint8Array(1000 * 500).fill(3); }
  getHeightMapValue(x, y) { return this.heightMapBuffer[Math.max(0, Math.min(499, y)) * 1000 + Math.max(0, Math.min(999, x))]; }
  getHeightMapValuesRange1Dim(x0, y0, dim) { const d = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y); return d; }
  getLargeMapData() { const d = []; for (let i = 0; i < 5; i++) d.push(new Uint8Array(5).fill(3)); return d; }
  getLargeHeightMapValuesRange(x0, y0, dim) {
    const side = dim * 3, dst = new Uint8Array(side * side);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
      const src = this.getLargeMapData(x0 + x, y0 - y);
      for (let iy = 1; iy < 4; iy++) for (let ix = 1; ix < 4; ix++) dst[(y * 3 + iy - 1) * side + (x * 3 + ix - 1)] = src[ix][4 - iy];
    }
    return dst;
  }
}

test('AUDIT TESA II K15 ARENA\'S NEAREST PORT: of the ports within a pixel, the nearest - never the last the scan finds, nor the first (mutants: nearest -> last; nearest -> first)', () => {
  const near = (ports) => new Function('arenaPortAt', `${lift(rd('src/scenes/tamrielPortsHost.js'), '  const arenaPortNear = (x, y) => {', '\n  };\n')}\nreturn arenaPortNear;`)((x, y) => ports.find((p) => p.x === x && p.y === y) ?? null);
  const a = { x: 10, y: 19, name: 'Near' }, b = { x: 11, y: 21, name: 'Far' };   // a pixel north (scanned early), a corner south-east (scanned last)
  assert.equal(near([a, b])(10, 20), a, 'the nearer, though the scan meets the farther last');
  const c = { x: 9, y: 19, name: 'Corner' }, d = { x: 10, y: 21, name: 'South' };   // the corner first, the nearer later
  assert.equal(near([c, d])(10, 20), d, 'the nearer, though the scan meets the farther first');
  assert.equal(near([])(10, 20), null);
});

test('AUDIT TESA II P1 THE BUILD PAST THE BAY: online, a pixel of the open zone stands the zone\'s hall of the day before any place past the Bay; else the places as before - and offline, or on the Bay, the hall is never asked there (mutants: the hall\'s ask dropped; asked offline; asked after the places)', () => {
  const asked = [];
  const make = (search) => new Function('URLSearchParams', `
    const etherSea = false, inEther = () => false, etherPlaceAt = () => null, onTheBay = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500;
    const _arenaTemplates = {}, _countryTemplates = {}, _capitalBase = {}, params = new URLSearchParams(${JSON.stringify(search)});
    const MASK = { zone: true }, cyrodiilMask = () => MASK, asked = arguments[1];
    const zoneHalls = { standIn: (mask, px, py) => { asked.push(['hall', px, py]); return mask === MASK && px === 2069 && py === 700 ? { name: 'Elite Hall' } : null; } };
    const capitalLocationAt = (px, py) => (px === 2069 && py === 700 ? { name: 'A capital slice' } : null);
    const arenaLocationAt = (px) => (px === 2100 ? { name: 'Bravil' } : null), countryLocationAt = () => null, lairLocationAt = () => null;
    const locationIndex = new Map([['5,5', { name: 'Daggerfall' }]]);
    const _spawnLedger = { expired: () => false }, _spawnClock = () => 0, _insideSpawn = () => false, spawnedDungeonAt = () => null;
    let _locIndexGen = 0;
    const host = { get _locIndexGen() { return _locIndexGen; }, set _locIndexGen(v) { _locIndexGen = v; }, _spawnClock, capitalLocationAt, arenaLocationAt, countryLocationAt, lairLocationAt };
    ${lift(STAND, '  function _locationToBuild(px, py) {')}
    return _locationToBuild;`)(URLSearchParams, asked);
  const online = make('online');
  assert.equal(online(2069, 700).name, 'Elite Hall', 'the zone\'s hall first, where a capital\'s slice would stand');
  assert.equal(online(2100, 700).name, 'Bravil', 'no hall there: the places');
  assert.equal(online(5, 5).name, 'Daggerfall', 'the Bay its own');
  assert.deepEqual(asked, [['hall', 2069, 700], ['hall', 2100, 700]], 'never asked on the Bay (its spawns ask it there)');
  asked.length = 0;
  assert.equal(make('')(2069, 700).name, 'A capital slice', 'offline no zone');
  assert.deepEqual(asked, []);
});

test('AUDIT TESA II Z7 THE ZONE\'S HALLS KEEP OFF THE PLACES: never on or beside a pixel the countryside or a lair may roll (the rolls the places host hands); picked again when the registry\'s places move and when the rolls are handed; a hall never stands over an index entry it did not make; the build\'s hall the zone\'s alone (mutants: the rolls unread; the cache kept past the places; the entry overwritten; standIn outside the mask)', () => {
  const m = cyrodiilMask();
  const places = createWorldPlaces();
  const index = new Map();
  index.set('500,250', { name: 'Old Keep', hasDungeon: true, dungeon: { blocks: [{}] }, exterior: { exteriorData: { width: 1, height: 1 } }, mapTableData: { mapId: 1234, locationType: 7, dungeonType: 0 }, regionIndex: 17 });
  const bayMaps = { getClimateIndex: () => CLIMATES.Ocean, getRegionIndexAt: () => 0, getPoliticIndex: () => 128 };
  const zh = createZoneHalls({ maps: bayMaps, woods: new BayWoods(), places, locationIndex: index, isMainStory: () => false, dayNow: () => 20500, indexMoved: () => {} });
  const halls = zh.activeOf(m);
  const h = halls[0];
  assert.equal(zh.activeOf(m), halls, 'kept while nothing moves');
  // the rolls: a farm may stand beside the hall
  zh.standsToo((x, y) => x === h.x + 1 && y === h.y);
  assert.equal(zh.free(h.x, h.y), false, 'beside a roll: never');
  const again = zh.activeOf(m);
  assert.notEqual(again, halls, 'picked again once the rolls are handed');
  assert.ok(!again.some((g) => Math.abs(g.x - (h.x + 1)) <= 1 && Math.abs(g.y - h.y) <= 1), 'no hall on or beside the roll');
  // the registry's places move: a town past the Bay lands on the next hall
  const g0 = again[0];
  places.register('tesa', [{ mapId: (0x341 << 20) | 0x80000, name: 'A town', px: g0.x, py: g0.y, type: LOCATION_TYPES.TownCity }]);
  const third = zh.activeOf(m);
  assert.notEqual(third, again, 'picked again when the places move');
  assert.ok(!third.some((g) => Math.abs(g.x - g0.x) <= 1 && Math.abs(g.y - g0.y) <= 1), 'none on or beside the town');
  // an index entry it did not make: kept
  const t = third[0], farm = { name: 'The Ulfgar Farmstead', country: { px: t.x, py: t.y } };
  index.set(`${t.x},${t.y}`, farm);
  assert.equal(zh.standOf(m, t.x, t.y), null, 'no hall over it');
  assert.equal(index.get(`${t.x},${t.y}`), farm, 'its entry kept');
  index.delete(`${t.x},${t.y}`);
  const loc = zh.standIn(m, t.x, t.y);
  assert.ok(loc?.wildHall, 'the build\'s hall: the zone\'s on its pixel');
  assert.equal(zh.standIn(m, t.x, t.y), loc, 'stood once a day');
  assert.equal(zh.standIn(null, t.x, t.y), null, 'no zone, no hall');
  const B = maskWorldBox(m);
  let outside = null;
  for (let x = B.x0 - 5; x <= B.x1 + 5 && !outside; x++) if (!wildInside(m, x, B.y0 - 3)) outside = [x, B.y0 - 3];
  assert.equal(zh.standIn(m, outside[0], outside[1]), null, 'outside the zone none');
});

test('AUDIT TESA II Z7/Z9 (ARENA2) THE DAY\'S HALLS ON THE FREEWARE\'S WORLD: through the host over the registry (the Bay\'s rows and the places past the Bay) and the rolls - none on or beside a place over three days; the ground\'s dry plateau by plateauDry is spawnGroundDry\'s answer on every pixel asked, each pixel read once; a roll\'s "may stand" holds wherever it stands (mutants: the early-out\'s bound; the memo; a roll\'s pick tightened)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundWoods, groundMaps } = await import('../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../src/ui/overworldModel.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const C = await import('../../src/world/tamrielCountry.js');
  const D = await import('../../src/world/tamrielDungeons.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../src/world/arenaLocations.js');
  const { arenaPixels } = await import('../../src/world/arenaPlaces.js');
  const { bayPlaceRows, BAY_SOURCE } = await import('../../src/world/worldWide/bayPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../src/world/pastBayRows.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const ground = groundWoods(woods);
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const bayClimate = (x, y) => maps.getClimateIndex(x, y);
  const bayLand = C.bayLand(bayClimate, (x, y, c) => isWaterPixel(c, woods.getHeightMapValue(x, y)));
  const cT = C.countryTemplates(rows, isMainStoryDungeon), lT = D.lairTemplates(rows, isMainStoryDungeon), aT = arenaTemplates(rows, isMainStoryDungeon);
  groundMaps(maps);
  const at = { climateAt: (x, y) => maps.getClimateIndex(x, y), heightAt: (x, y) => ground.getHeightMapValue(x, y), ground: C.createCountryGround(ground) };
  const country = { ...at, rates: C.countryRates(C.countryCounts(cT, bayClimate), bayLand), templates: cT };
  const lair = { ...at, rates: C.countryRates(C.countryCounts(lT, bayClimate), bayLand, D.LAIR_TYPES), templates: lT };
  const places = createWorldPlaces();
  places.register(BAY_SOURCE, bayPlaceRows(rows.filter((l) => l?.exterior?.exteriorData)));
  places.registerLive(PAST_BAY_SOURCE, { stamp: () => [arenaPixels()], rows: () => pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(aT, p), capitals: true }) });
  // the ground as the host reads it, every read counted
  const reads = new Map();
  const counted = Object.create(ground);
  counted.isTamrielGround = true;
  let pixel = null;
  counted.getHeightMapValuesRange1Dim = function (...a) { if (pixel) reads.set(pixel, (reads.get(pixel) ?? 0) + 1); return ground.getHeightMapValuesRange1Dim(...a); };
  let day = 3;
  const zh = createZoneHalls({ maps, woods: counted, places, locationIndex: new Map(), isMainStory: () => false, dayNow: () => day, indexMoved: () => {} });
  zh.standsToo((x, y) => C.countryMayStandAt(country, x, y) || D.lairMayStandAt(lair, x, y));
  const m = cyrodiilMask();
  const free = zh.free;
  const asked = [];
  const zfree = (x, y) => { pixel = `${x},${y}`; asked.push([x, y]); const ok = free(x, y); pixel = null; return ok; };
  let bad = 0, halls = 0;
  for (const d of [3, 4, 5]) {
    day = d;
    for (const h of zh.activeOf(m)) {
      halls++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (places.at(h.x + dx, h.y + dy) || C.countryStandsAt(country, h.x + dx, h.y + dy) || D.lairStandsAt(lair, h.x + dx, h.y + dy)) bad++;
    }
  }
  assert.ok(halls > 60, `${halls} halls`);
  assert.equal(bad, 0, 'no hall on or beside a place');
  // the ground: plateauDry's word is spawnGroundDry's, a pixel read once (the host's memo)
  const { wildHallPicks } = await import('../../src/systems/wild/wildDungeons.js');
  wildHallPicks(m, zfree, 6);
  let same = 0;
  for (const [x, y] of asked) {
    if (C.countryStandsAt(country, x, y)) assert.ok(C.countryMayStandAt(country, x, y), `a farm at ${x},${y} its roll's "may"`);
    if (D.lairStandsAt(lair, x, y)) assert.ok(D.lairMayStandAt(lair, x, y), `a lair at ${x},${y} its roll's "may"`);
    if (plateauDry(ground, x, y) === spawnGroundDry(ground, x, y)) same++;
  }
  assert.ok(asked.length > 300, `${asked.length} asked`);
  assert.equal(same, asked.length, 'the same plateau law to the bit');
  for (const [x, y] of [...asked]) zfree(x, y);   // asked again: the memo's
  assert.ok([...reads.values()].every((n) => n <= 1), 'a pixel\'s plateau read once a session');
});

// PIN MOVED (WW7-7, bible/03-World/World-Wide.md - the owner, 2026-10-26: "Yes travellers to need to travel everywhere. Same
// for ships."): P7 held the living world to the Bay until WW7; WW7-7 lifts it - each trip keeps to its own side of the Bay's
// edge (scenes/livingWorld/livingIndex.js livingSide), and a town past the Bay sails its travellers on the lanes past it
test('AUDIT TESA II P7 -> WW7-7 THE LIVING WORLD ON BOTH SIDES OF THE BAY\'S EDGE: a town past the Bay a lane\'s traveller as a Bay port\'s is - its port\'s lanes past the Bay, a Bay port\'s the Bay\'s; the sides the Bay\'s and the land past it (mutants: the side law; a lane over the edge)', () => {
  const bay = { mapId: 7, px: 200, py: 199, port: true }, windhelm = { mapId: (0x341 << 20), px: 2215, py: -371, port: true };
  assert.deepEqual([livingSide(bay), livingSide(windhelm), livingSide({ px: 999, py: 499 }), livingSide({ px: 1000, py: 0 })], [LIVING_SIDES.bay, LIVING_SIDES.beyond, LIVING_SIDES.bay, LIVING_SIDES.beyond]);
  const lane = (a, b) => ({ key: `${a.id}-${b.id}`, a, b });
  const A = { id: 199200 }, B = { id: 199225 };
  const wh = { mapId: (0x341 << 20) | 0x80000, px: 2215, py: -371, port: true }, so = { mapId: (0x341 << 20) | 0x80001, px: 1700, py: -420, port: true };
  const C = { id: portIdOf(wh) }, E = { id: portIdOf(so) };   // two ports past the Bay, a lane between them (WW3's)
  const towns = new Map([[A.id, { mapId: A.id, px: 200, py: 199 }], [B.id, { mapId: B.id, px: 225, py: 199 }], [C.id, wh], [E.id, so]]);
  const ll = createLivingLanes({ lanes: () => [lane(A, B), lane(C, E)], way: () => ({ len: 5000 }), townOfPort: (id) => towns.get(id) ?? null, sailorsOf: () => [], generation: () => 0 });
  assert.deepEqual(ll.from({ mapId: 199200, px: 200, py: 199 }).map((l) => l.to.mapId), [199225], 'a Bay port\'s lane');
  assert.deepEqual(ll.from(wh).map((l) => l.to.mapId), [so.mapId], 'past the Bay: its own lane, its travellers aboard');
});

test('AUDIT TESA II P7 THE LANES PAST THE BAY: their own reach and their own near - a Bay lane listed within half its longest way and LANE_NEAR_PX of a port, one past the Bay within the ellipse its roadsteads bound for a way of BEYOND_LANE_PATH_PX; the book\'s net past the Bay at BEYOND_LANE_MAX_PX (mutants: the Bay\'s margin; the ellipse\'s; the reach the Bay\'s)', () => {
  assert.deepEqual([LANE_MAX_PX, LANE_PATH_PX, BEYOND_LANE_MAX_PX, BEYOND_LANE_PATH_PX, LANE_NEAR_PX], [30, 60, 400, 800, 4]);
  const ports = { list: () => [], version: () => 0 };
  const wl = createWorldLanes({ mapDict: () => null, maps: { getRegion: () => null, getClimateIndex: () => CLIMATES.Ocean }, portIds: [], ports, bayOpen: () => true, bayOpenNative: () => true, water: () => true, beyond: () => true });
  const bayLane = { a: { px: 100, py: 100, road: { x: 100, y: 100 } }, b: { px: 120, py: 100, road: { x: 120, y: 100 } } };
  assert.equal(wl.near(bayLane, { x: 100 + 34, y: 100 }), true, 'the Bay: within 30 + 4 of a port');
  assert.equal(wl.near(bayLane, { x: 120 + 34, y: 100 }), true);
  assert.equal(wl.near(bayLane, { x: 120 + 35, y: 100 }), false);
  const far = { a: { px: 2000, py: -300, road: { x: 2000, y: -300 } }, b: { px: 2300, py: -300, road: { x: 2300, y: -300 } } };
  // the ellipse: da + db <= 800 + 8 - on the line between them a mid point, far off it none
  assert.equal(wl.near(far, { x: 2150, y: -300 }), true, 'mid way, 150 px from either port');
  const reach = Math.sqrt(((800 + 8) / 2) ** 2 - 150 ** 2);
  assert.equal(wl.near(far, { x: 2150, y: -300 + Math.floor(reach) }), true, 'at the ellipse\'s edge');
  assert.equal(wl.near(far, { x: 2150, y: -300 + Math.ceil(reach) + 1 }), false, 'past it');
  // the reach: two ports past the Bay 300 px apart run a lane, the Bay's 30 would not
  const open = () => true;
  const two = [{ id: 1, name: 'A', px: 2000, py: -300 }, { id: 2, name: 'B', px: 2300, py: -300 }];
  assert.equal(laneNetwork(two, open, BEYOND_LANE_MAX_PX).length, 1);
  assert.equal(laneNetwork(two, open).length, 0, 'the Bay\'s reach: none');
  assert.match(rd('src/scenes/naval/worldLanes.js'), /beyondList = longLanes\(\n\s*loneLanes\(laneNetwork\(ports\.list\(\), worldOpen, BEYOND_LANE_MAX_PX, true, BEYOND_LANE_PATH_PX\)\),\n\s*\);/);
  assert.match(W, /if \(!worldLanes\.near\(lane, here\)\) continue;/, 'the host\'s feed asks the book');
});

test('AUDIT TESA II P7 A WAY PAST THE BAY KEEPS OFF THE BAY\'S RECTANGLE: the Bay\'s water is WOODS.WLD\'s, never the picture\'s - two roadsteads either side of the Bay\'s south-west corner sail round it, never across (mutant: the rectangle sailed)', () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });   // the Bay on the picture from (40, 50) to (140, 100)
  const w = 320, h = 200;
  setTamrielTrace({ w, h, land: new Uint8Array(w * h), province: new Uint8Array(w * h) });   // the sea everywhere
  const lane = { a: { road: { x: -45, y: 400 } }, b: { road: { x: 100, y: 550 } } };   // picture (35, 90) and (50, 105)
  const way = beyondLaneWay(lane, () => true);
  assert.ok(way && way.pts.length >= 3, 'round the corner');
  const r = bayPictureRect();
  for (const p of way.pts) {
    const [qx, qy] = bayToPicture(p.x / NATIVE_PIXEL, 500 - p.z / NATIVE_PIXEL);
    assert.ok(!(qx > r.x0 + 1e-9 && qx < r.x1 && qy > r.y0 && qy < r.y1 - 1e-9), `(${qx.toFixed(2)}, ${qy.toFixed(2)}) off the Bay`);
  }
});

test('AUDIT TESA II P7 (ARENA2) THE WAYS PAST THE BAY on the freeware\'s world, at the picture\'s scale: between the world\'s ports (the places past the Bay registered), 30 of the 31 lanes find a way (PIN MOVED, FIELD BUGS 2026-10-28b COAST-PORT: 19 of 21 before the seven coast ports), each in a second\'s tenth; every leg on the world\'s lane water at the Bay\'s scale, none in the Bay\'s rectangle nor on a lake (mutants: the corner cut; the leg unasked; the lakes the sea; the Bay\'s rectangle sailed)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundWoods, tamrielClimateAt } = await import('../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../src/ui/overworldModel.js');
  const { createWorldPorts } = await import('../../src/world/worldWide/worldPorts.js');
  const { arenaPixels, pastBayLakeAt, pictureLakes } = await import('../../src/world/arenaPlaces.js');
  const { arenaPlaceId, ARENA_TEMPLATE_KINDS } = await import('../../src/world/arenaLocations.js');
  const { tamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const ground = groundWoods(woods);
  const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
  const lw = worldLaneWater({ bayOpen: () => false, water, climateAt: (x, y) => tamrielClimateAt(x, y), beyond: () => true });
  const places = createWorldPlaces();
  places.register('tesa', arenaPixels().stood.map((p) => ({ mapId: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, type: ARENA_TEMPLATE_KINDS[p.kind].type, port: !!p.port })));
  const ports = createWorldPorts({ places, openSea: (x, y) => water(x, y) && !pastBayLakeAt(x, y) });
  const lanes = laneNetwork(ports.list(), lw.open, BEYOND_LANE_MAX_PX, true);   // PIN MOVED (SEA-SQUARE): the host's roomiest roadsteads
  assert.equal(ports.list().length, 35);   // PIN MOVED (COAST-PORT): 28, and the seven places the sea bears on
  assert.ok(ports.list().every((p) => p.region === regionOfTheatre(p.theatre) && p.region >= 62), 'a port\'s region its province\'s (WW-R)');
  assert.equal(lanes.length, 31);
  const t0 = performance.now();
  const ways = lanes.map((l) => beyondLaneWay(l, lw.openNative));
  const ms = performance.now() - t0;
  assert.equal(ways.filter(Boolean).length, 30, 'Senchal-Torval: the picture\'s water joins them at a corner alone');
  assert.ok(ms < 31 * 100, `${ms.toFixed(0)} ms`);
  const tr = tamrielTrace(), lakes = pictureLakes(tr), bay = bayPictureRect();
  let off = 0, inRect = 0, onLake = 0;
  for (const way of ways.filter(Boolean)) {
    for (let i = 1; i < way.pts.length; i++) {
      const a = way.pts[i - 1], b = way.pts[i];
      const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / NATIVE_PIXEL) * LANE_STRAIGHT_STEPS));
      for (let k = 1; k < n; k++) if (!lw.openNative(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n)) { off++; break; }
    }
    for (const p of way.pts) {
      const [qx, qy] = bayToPicture(p.x / NATIVE_PIXEL, 500 - p.z / NATIVE_PIXEL);
      if (qx > bay.x0 && qx < bay.x1 && qy > bay.y0 && qy < bay.y1) inRect++;
      if (lakes[Math.floor(qy) * tr.w + Math.floor(qx)]) onLake++;
    }
  }
  assert.deepEqual([off, inRect, onLake], [0, 0, 0], 'on the lane water, off the Bay, off the lakes');
});

test('AUDIT TESA II P2/P3 THE WORLD\'S NEAREST TOWN, lifted off the places host and run: the registry\'s places and the countryside\'s towns this session stood (the index\'s - never a lair), the nearest a caller takes (mutants: the stood towns unread; a lair a town; the caller\'s accept dropped)', async () => {
  const { nearestSafePlace } = await import('../../src/systems/deathRespawn.js');
  const T = LOCATION_TYPES;
  const make = (rows, index) => new Function('nearestSafePlace', 'worldPlaces', 'locationIndex', `${lift(rd('src/scenes/tamrielPlacesHost.js'), '  const nearestTownOf = ', '\n  };\n')}\nreturn nearestTownOf;`)(nearestSafePlace, { all: () => rows }, index);
  const rows = [{ type: T.TownCity, px: 10, py: 0 }];
  const index = new Map([
    ['1,0', { country: { px: 1, py: 0, dungeon: true }, mapTableData: { locationType: T.Graveyard, dungeonType: DUNGEON_TYPES.Cemetery } }],   // a lair - a graveyard's kind, its monsters' own
    ['5,0', { country: { px: 5, py: 0 }, mapTableData: { locationType: T.TownHamlet } }],                // a farmstead's hamlet
    ['3,0', { name: 'A Bay row', mapTableData: { locationType: T.TownCity } }],                            // no country: the registry's own
  ]);
  const near = make(rows, index);
  assert.deepEqual(near({ x: 0, y: 0 }).mapPixel, { x: 5, y: 0 }, 'the stood town, nearer than the registry\'s');
  assert.deepEqual(near({ x: 0, y: 0 }, (h) => h.mapPixel.x > 6).mapPixel, { x: 10, y: 0 }, 'the caller\'s accept');
  assert.equal(make([], new Map([['1,0', index.get('1,0')]]))({ x: 0, y: 0 }), null, 'a lair is no town');
});

test('AUDIT TESA II P7 THE LIVING INDEX AT THE BAY\'S EDGE: asked from the Bay, a town past the Bay a pixel off is never among its near ones; asked from past the Bay, none (mutants: the places\' filter dropped; the asker\'s guard dropped)', async () => {
  const { createLivingIndex } = await import('../../src/scenes/livingWorld/livingIndex.js');
  const places = createWorldPlaces();
  places.register('bay', [{ mapId: 5, name: 'Edgeport', px: 1, py: 100, type: LOCATION_TYPES.TownCity }]);
  places.register('tesa', [{ mapId: (0x341 << 20) | 0x80000, name: 'Beyond', px: -2, py: 100, type: LOCATION_TYPES.TownCity }]);
  const idx = createLivingIndex({ places, populated: (t) => t === LOCATION_TYPES.TownCity, peopleAt: () => 0 });
  assert.deepEqual(idx.townsNear(0, 100, 4).map((t) => t.name), ['Edgeport'], 'from the Bay: the Bay\'s alone');
  assert.deepEqual(idx.townsNear(-1, 100, 4), [], 'from past the Bay: none');
  assert.equal(idx.townAt(-2, 100)?.name, 'Beyond', 'a record all the same');
});

// PIN MOVED (WW-GATES-EVERYWHERE, bible/03-World/World-Wide.md): the lanes of the eight provinces stand now (net/wire.js
// GATE_LANES_OPEN 0 to 8) - the lane that stays shut is Cyrodiil's, the open zone's, and its theatre is the one never scanned
test('AUDIT TESA II P7 THE GATES PAST THE BAY UNSCANNED WHILE THEIR LANES ARE SHUT: with the places past the Bay on the registry, a theatre whose gate lane does not stand (net/wire.js GATE_LANES_OPEN - Cyrodiil\'s, the open zone\'s) is never scanned - the host\'s scans read the wire\'s law (mutant: the closed lanes scanned)', async () => {
  const { createTheatreGateScans } = await import('../../src/scenes/gate/gateLanes.js');
  const { GATE_LANES_OPEN } = await import('../../src/net/wire.js');
  const { CITIES } = await import('../../src/world/tamriel/tamrielGeography.js');
  const { pictureToBay, inBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { THEATRE_KEYS } = await import('../../src/world/worldWide/worldGrid.js');
  const rows = (province, base) => CITIES.filter((c) => c.province === province).map((c, i) => { const [px, py] = pictureToBay(c.at[0], c.at[1]).map(Math.floor); return { mapId: base + i, name: c.name, px, py, type: LOCATION_TYPES.TownCity }; }).filter((r) => !inBay(r.px, r.py));
  const cyrodiil = THEATRE_KEYS.indexOf('Imperial'), skyrim = THEATRE_KEYS.indexOf('Skyrim');
  const places = createWorldPlaces();
  places.register('tesa', rows('Imperial', 50_000));
  const asked = [];
  const counted = { ...places, inTheatre: (t) => { asked.push(t); return places.inTheatre(t); }, theatres: places.theatres, generation: places.generation, at: places.at };
  assert.deepEqual(GATE_LANES_OPEN, [0, 1, 2, 3, 4, 5, 6, 7, 8], 'the Bay\'s and the eight provinces\' lanes stand; Cyrodiil\'s never');
  assert.deepEqual(createTheatreGateScans({ places: counted, wet: () => false, idle: null }).theatres(), [], 'no lane in the open zone');
  assert.deepEqual(asked, [], 'and its theatre never scanned for one');
  places.register('tesa2', rows('Skyrim', 60_000));
  assert.deepEqual(createTheatreGateScans({ places: counted, wet: () => false, idle: null }).theatres(), [skyrim], 'a province\'s lane: its theatre scanned');
  assert.deepEqual(asked, [skyrim], 'Skyrim\'s alone');
  assert.equal(createTheatreGateScans({ places: counted, wet: () => false, idle: null, open: () => true }).theatres().length, 1, 'opened, the zone\'s theatre is scanned (and the open zone\'s areas stand no gate - theatreGateSite.js)');
  assert.ok(asked.includes(cyrodiil));
});

test('AUDIT TESA II P9 THE TRACE\'S DOOR is offline alone, as the land\'s others: online the land is the room\'s (mutant: the online arm dropped)', () => {
  assert.equal(tamrielTraceOn('?tamrieltrace=off'), false);
  assert.equal(tamrielTraceOn('?online&tamrieltrace=off'), true);
  assert.equal(tamrielTraceOn(''), true);
});

test('AUDIT TESA II P2/P3/P4 THE WIRING: the world\'s nearest town (scenes/tamrielPlacesHost.js nearestTownOf) read by the rise past the Bay, the open zone\'s rise and /unstuck - one law; the places past the Bay registered live and the rolls handed to the zone\'s halls; every journey asked of the door past the Bay (systems/travel/pastBayTravel.js) after the zone\'s own (mutants: each read put back on MAPS.BSA; the door unasked)', () => {
  const P = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(P, /const nearestTownOf = \([^\n]*\) => nearestSafePlace\(\[worldPlaces\?\.all\(\) \?\? \[\], countryTowns\(\)\], px, accept\);/);
  assert.match(P, /if \(worldPlaces && \(_arenaTemplates \|\| _capitalBase\)\) \{\n\s+worldPlaces\.registerLive\(PAST_BAY_SOURCE, \{\n\s+stamp: \(\) => \[_arenaTemplates \? arenaPixels\(\) : null, tamrielFit\(\), tamrielLandVersion\(\)\],\n\s+rows: \(\) => pastBayPlaceRows\(\{ pixels: _arenaTemplates \? arenaPixels\(\) : null, templateOf: \(p\) => arenaTemplateOf\(_arenaTemplates, p\), capitals: !!_capitalBase \}\),/);
  assert.match(P, /if \(_countryTemplates\) zoneHalls\?\.standsToo\(pastBayRolledAt\);/);
  assert.match(W, /for \(const pick of wildRisePicks\(cyrodiilMask\(\), px, \{ inDungeon, kill \}\)\) \{ const at = nearestTownOf\(px, pick\); if \(at\) return at; \}/, 'the zone\'s rise');
  assert.match(W, /const town = etherSea && inEther\(px\.x, px\.y\) \? wildRiseSite\(px\) : nearestTownOf\(px, \(hit\) => hit\.kind === 'city' && !\(_zm && wildNear\(_zm, hit\.mapPixel\.x, hit\.mapPixel\.y\)\)\);/, '/unstuck');
  assert.match(W, /const town = nearestTownOf\(px\);\n\s+if \(town\) land = town\.mapPixel;/, 'the rise past the Bay');
  assert.doesNotMatch(W, /nearestTownPastTheBay|TOWN_RISE_REACH|nearestSafeLocationAnywhere\(maps, px, \(hit\)/, 'no second law');
  // PIN MOVED (PORTAL-BAY, bible/06-Systems/Portal-Stone.md): the gate's law past the Bay is its third argument - a journey's
  // pastBayJourney unless a teleport hands its own (pastBayTravel.js teleportJourney: teleportTo, Recall, a stone's pick and step)
  assert.match(W, /const wildTravelGate = \(to, spoken = 0, law = pastBayJourney\) => \{/, 'every journey\'s gate: the journey\'s law unless told');
  assert.match(W, /const j = law\(playerTravelPixel\(\), to, online\?\.wildOk \? wildMapMask\(\) : null, wildJourney\(\{/, 'asked after the zone\'s own');
  assert.ok(W.indexOf('const zoneHalls = createZoneHalls(') < W.indexOf('createTamrielPlaces('), 'the halls stand before the places host hands them the rolls (BOOT-TDZ)');
});
