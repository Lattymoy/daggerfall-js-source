// WW3 (2026-10-24, bible/03-World/World-Wide.md WW3): THE SEA, WHOLE - the world's ports past the Bay off the registry,
// the packet lanes between them over the continent's sea, the raiders' sea past the Bay, the waters' people naming its
// ships, and the map directory's alias closed. The Bay's every lane, port, packet and name the one it always was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lanePixels, laneNetwork, LANE_SEARCH, LANE_PATH_PX } from '../../../src/systems/naval/seaLanes.js';
import { locationSummaryAt, hasLocation } from '../../../src/systems/map/mapDirectory.js';
import { createWorldPorts, beyondPorts, portIdOf, portIdOfLocation, COMPASS_WAYS, PORT_ID_WORLD } from '../../../src/world/worldWide/worldPorts.js';
import { createWorldLanes, worldLaneWater, bayLanePorts, onWorldSea } from '../../../src/scenes/naval/worldLanes.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { createLivingIndex } from '../../../src/scenes/livingWorld/livingIndex.js';
import { worldPixelKey, areaAt, BAY_AREA_COUNT, THEATRE_KEYS, WORLD_PIXEL_SPAN } from '../../../src/world/worldWide/worldGrid.js';
import { maskMapId } from '../../../src/systems/travel/travelPorts.js';
import { shipNames, classById } from '../../../src/systems/naval/navalShips.js';
import { shipNameBank } from '../../../src/systems/naval/shipNameBank.js';
import { handName } from '../../../src/systems/naval/shipCrew.js';
import { getNameBankOfRegion } from '../../../src/characters/nameHelper.js';
import { nameBankOfArea } from '../../../src/characters/areaNameBank.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES, CLIMATES, longitudeLatitudeToMapPixel } from '../../../src/formats/mapsFile.js';
import { NATIVE_PIXEL } from '../../../src/systems/seaRaiders.js';
import { ETHER_BOX } from '../../../src/world/ethericSea.js';
import { codeOnly } from '../../codeOnly.mjs';

setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the suite

const src = (p) => codeOnly(readFileSync(new URL('../../../' + p, import.meta.url), 'utf8'));

/** The Bay's lane search before WW3, word for word (systems/naval/seaLanes.js at b268ad5b0d). */
function oldLanePixels(from, to, water) {
  const W = 1000, H = 500;
  if (!water(from.x, from.y) || !water(to.x, to.y)) return null;
  const key = (x, y) => y * W + x;
  const g = new Map([[key(from.x, from.y), 0]]), came = new Map(), shut = new Set();
  const h = (x, y) => Math.hypot(x - to.x, y - to.y);
  const heap = [[h(from.x, from.y), from.x, from.y]];
  const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  let expanded = 0;
  while (heap.length && expanded < LANE_SEARCH) {
    const [, x, y] = pop();
    const k = key(x, y);
    if (shut.has(k)) continue;
    shut.add(k);
    const gk = g.get(k);
    if (x === to.x && y === to.y) {
      const path = [{ x, y }];
      for (let c = came.get(k); c != null; c = came.get(c)) path.push({ x: c % W, y: Math.floor(c / W) });
      return path.reverse();
    }
    expanded++;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !water(nx, ny)) continue;
        if (dx && dy && (!water(x + dx, y) || !water(x, y + dy))) continue;
        const ng = gk + (dx && dy ? Math.SQRT2 : 1);
        const nk = key(nx, ny);
        if (ng >= (g.get(nk) ?? Infinity) || ng > LANE_PATH_PX) continue;
        g.set(nk, ng); came.set(nk, k);
        push([ng + h(nx, ny), nx, ny]);
      }
    }
  }
  return null;
}

test('WW3 the map directory names the Bay\'s map alone: off it MapsFile\'s pixel id is another pixel\'s - (1003, 10) was (3, 11)\'s, (-2, 10) was (998, 9)\'s, and a ship past the Bay was told it lay by a Bay port (mutants: the bound dropped, the bound a pixel short)', () => {
  const dict = new Map([[11 * 1000 + 3, { id: 11003 }], [9 * 1000 + 998, { id: 9998 }], [499 * 1000 + 999, { id: 499999 }], [0, { id: 0 }]]);
  assert.equal(locationSummaryAt(dict, 3, 11)?.id, 11003);
  assert.equal(locationSummaryAt(dict, 999, 499)?.id, 499999, 'the map\'s last pixel its own');
  assert.equal(locationSummaryAt(dict, 0, 0)?.id, 0, 'and its first');
  for (const [x, y] of [[1003, 10], [-2, 10], [5, 500], [5, -1], [1000, 499], [3.5, 11]]) {
    assert.equal(locationSummaryAt(dict, x, y), null, `${x},${y}`);
    assert.equal(hasLocation(dict, x, y), false, `${x},${y}`);
  }
  assert.equal(hasLocation(dict, 998, 9), true);
});

test('WW3 a lane\'s pixels on the world\'s grid: every Bay lane the way the Bay\'s search found it, step for step, and a lane past the map\'s edge walked as the Bay\'s are, across its edge where the water joins (mutants: the grid\'s bound, the key, the way back)', () => {
  // an archipelago on the Bay's water: land in blocks on a grid, the Bay's own rectangle
  const bay = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && !((x % 17) < 7 && (y % 13) < 5);
  let paths = 0;
  for (let i = 0; i < 40; i++) {
    const from = { x: 100 + ((i * 37) % 300), y: 105 + ((i * 53) % 200) }, to = { x: from.x + ((i * 11) % 40) - 20, y: from.y + ((i * 7) % 30) - 15 };
    const a = oldLanePixels(from, to, bay), b = lanePixels(from, to, bay);
    assert.deepEqual(b, a, `${from.x},${from.y} to ${to.x},${to.y}`);
    if (a) paths++;
  }
  assert.ok(paths > 20, `${paths} ways`);
  // past the west edge: the sea at x -60..19 (the Bay's own first twenty columns with it), y 100..140
  const world = (x, y) => x >= -60 && x < 20 && y >= 100 && y <= 140 && !(x === -30 && y < 130);
  const w = lanePixels({ x: -40, y: 120 }, { x: 5, y: 120 }, world);
  assert.ok(w && w.length > 30, 'a way past the edge and across it');
  assert.deepEqual([w[0], w.at(-1)], [{ x: -40, y: 120 }, { x: 5, y: 120 }]);
  for (let i = 1; i < w.length; i++) assert.ok(Math.max(Math.abs(w[i].x - w[i - 1].x), Math.abs(w[i].y - w[i - 1].y)) === 1 && world(w[i].x, w[i].y), 'step by step on the water');
  assert.ok(w.some((p) => p.x === -30 && p.y >= 130), 'round the wall, past the map\'s edge');
  assert.equal(lanePixels({ x: -WORLD_PIXEL_SPAN, y: 0 }, { x: -WORLD_PIXEL_SPAN + 3, y: 0 }, () => true)?.length, 4, 'the grid\'s first column walked');
  assert.equal(lanePixels({ x: -WORLD_PIXEL_SPAN, y: 0 }, { x: -WORLD_PIXEL_SPAN - 1, y: 0 }, () => true), null, 'never off the grid');
});

/** A port town past the Bay, as a provider lists one. */
const town = (mapId, px, py, o = {}) => ({ mapId, name: `Port ${mapId}`, px, py, type: LOCATION_TYPES.TownCity, port: true, ...o });
/** The sea west of the map's edge: every pixel with no place on it from x -200 to -1. */
const westSea = (places) => (x, y) => x >= -200 && x < 0 && y >= 0 && y < 500 && !places.at(x, y);

test('WW3 the world\'s ports past the Bay: a place its provider calls a port, of a port town\'s kind, the open sea bearing on it - never a Bay place (the Bay\'s are the game\'s data), never an inland one, never a tomb; its one number the world\'s key, which no Bay id meets (mutants: the port word, the town kind, the sea\'s bearing, the Bay\'s own let in, the key)', () => {
  const places = createWorldPlaces();
  places.register('bay', [town(1, 207, 213, { region: 17 })]);
  places.register('beyond', [
    town(9001, -20, 100), town(9002, -40, 100, { port: false }), town(9003, -60, 100, { type: LOCATION_TYPES.DungeonRuin }),
    town(9004, -80, 100, { name: '' }), town(9005, -100, 100), town(9006, -120, 100),
  ]);
  // the land about 9005: no sea within its ring; and the Bay's own harbour (207, 213) on the sea - the Bay's is the game's data's
  const inland = (x, y) => (westSea(places)(x, y) && !(x >= -110 && x <= -90)) || (x >= 200 && x <= 215 && y >= 205 && y <= 220 && !places.at(x, y));
  const got = beyondPorts(places, inland);
  assert.deepEqual(got.map((p) => p.mapId), [9001, 9006]);
  const p = got[0];
  assert.deepEqual([p.id, p.key, p.name, p.region, p.crown], [PORT_ID_WORLD + worldPixelKey(-20, 100), '-20,100', 'Port 9001', -1, null]);
  assert.equal(p.area, areaAt(-20, 100, () => -1));
  assert.equal(portIdOf({ mapId: 0x701234, px: 207, py: 213 }), maskMapId(0x701234), 'the Bay\'s masked id, as the lanes filed it');
  assert.equal(portIdOf({ mapId: 5, px: -20, py: 100 }), PORT_ID_WORLD + worldPixelKey(-20, 100));
  assert.equal(worldPixelKey(-WORLD_PIXEL_SPAN, -WORLD_PIXEL_SPAN), 0, 'the grid\'s north-west key is the least');
  assert.ok(PORT_ID_WORLD > maskMapId(0xffffffff), 'so a port past the Bay numbers past every masked id');
  assert.ok(portIdOf({ mapId: 0, px: -WORLD_PIXEL_SPAN, py: -WORLD_PIXEL_SPAN }) > 0xfffff);
  const loc = { mapTableData: { mapId: (3 << 20) | 213207, longitude: 0, latitude: 0 } };
  const at = longitudeLatitudeToMapPixel(0, 0);
  assert.equal(portIdOfLocation(loc), portIdOf({ mapId: loc.mapTableData.mapId, px: at.x, py: at.y }));
  assert.equal(portIdOfLocation({}), 0);
});

test('WW3 the world\'s ports kept: by the registry\'s generation and the land\'s picture; a port town past the Bay by its provider\'s word, the Bay\'s none of its; the nearest port\'s distance and its name and way, the Bay\'s and the world\'s; the waters\' people - the Bay\'s region, a province\'s district, at sea the nearest port\'s (mutants: the generation, the picture, the Bay\'s pixel asked, the nearest, the way, the sea\'s area)', () => {
  const places = createWorldPlaces();
  let land = 0;
  const ports = createWorldPorts({ places, openSea: westSea(places), land: () => land, regionAt: () => 17 });
  assert.deepEqual(ports.list(), []);
  const v0 = ports.version();
  places.register('beyond', [town(9001, -20, 100), town(9002, -40, 140, { port: false })]);
  assert.notEqual(ports.version(), v0, 'a register moves it');
  assert.equal(ports.list().length, 1);
  const v1 = ports.version();
  land = 1;
  assert.notEqual(ports.version(), v1, 'a new picture moves it');
  assert.deepEqual([ports.at(-20, 100), ports.at(-40, 140), ports.at(-21, 100)], [true, false, false]);
  places.register('bay', [town(1, 207, 213, { region: 17 })]);
  assert.equal(ports.at(207, 213), false, 'a Bay pixel is the game\'s data\'s, never the registry\'s word');
  assert.equal(ports.nearestPx(-25, 103), 5);
  assert.equal(ports.nearestPx(-20, 100), 0);
  const bay = [{ name: 'Daggerfall', px: 207, py: 213 }, { name: null, px: 5, py: 100 }];
  assert.deepEqual(ports.nearestNamed({ x: -20, y: 105 }, bay), { name: 'Port 9001', way: 'north' });
  assert.deepEqual(ports.nearestNamed({ x: 200, y: 213 }, bay), { name: 'Daggerfall', way: 'east' });
  assert.equal(ports.nearestNamed({ x: 6, y: 100 }, bay), null, 'the nearest unnamed: none');
  assert.deepEqual(COMPASS_WAYS.length, 8);
  // the Bay's list and the world's after it - the same array while neither moves
  const list = [{ key: 'a' }];
  const all = ports.withBay(list);
  assert.deepEqual(all.map((p) => p.key), ['a', '-20,100']);
  assert.equal(ports.withBay(list), all);
  assert.equal(createWorldPorts({ places: createWorldPlaces(), openSea: () => true }).withBay(list), list, 'none past the Bay: the Bay\'s own');
  // the waters' area
  assert.equal(ports.seaAreaAt(207, 213), 17, 'the Bay\'s region');
  const solitude = CITIES.find((c) => c.name === 'Solitude');
  const [sx, sy] = pictureToBay(solitude.at[0], solitude.at[1]).map(Math.floor);
  assert.equal(ports.seaAreaAt(sx, sy), areaAt(sx, sy, () => -1), 'a province\'s district under it');
  assert.ok(ports.seaAreaAt(sx, sy) >= BAY_AREA_COUNT);
  // at sea past the Bay - no province under the pixel - the nearest port's: Solitude's, north of it in the Sea of Ghosts
  const isSea = (x, y) => areaAt(x, y, () => -1) < 0;
  let n = 0;
  while (!isSea(sx, sy - n) && n < 400) n++;
  assert.ok(n > 0 && n < 400, 'the coast north of Solitude');
  const seaPlaces = createWorldPlaces();
  seaPlaces.register('beyond', [town(9100, sx, sy - n + 1)]);   // a port on the last of the land
  const seaPorts = createWorldPorts({ places: seaPlaces, openSea: isSea });
  assert.ok(seaPorts.list().length === 1 && seaPorts.list()[0].area >= BAY_AREA_COUNT, 'a port on the sea, in a province');
  assert.equal(seaPorts.seaAreaAt(sx, sy - n - 2), seaPorts.list()[0].area, 'at sea: the nearest port\'s');
  assert.equal(createWorldPorts({ places: createWorldPlaces(), openSea: () => true }).seaAreaAt(-5000, -5000), -1);
});

test('WW3 the world\'s lane water: the Bay\'s own on the Bay; past it the ocean\'s water where the land past the Bay stands, never the Eltheric Ocean\'s box, never off the grid; a native point by its pixel floored (mutants: the land\'s switch, the climate, the box, the floor)', () => {
  let beyond = true;
  const { open, openNative } = worldLaneWater({ bayOpen: (x, y) => x === 5 && y === 5, water: () => true, climateAt: (x) => (x === -9 ? 1 : CLIMATES.Ocean), beyond: () => beyond });
  assert.deepEqual([open(5, 5), open(6, 5), open(-3, 5), open(-9, 5)], [true, false, true, false]);
  assert.equal(open(ETHER_BOX.x0 + 1, ETHER_BOX.y0 + 1), false, 'the box\'s isles keep their own');
  assert.equal(open(-WORLD_PIXEL_SPAN - 1, 0), false);
  assert.equal(openNative(-1, 494.5 * NATIVE_PIXEL), true, 'a point a hair west of the edge is the pixel west of it');
  assert.equal(openNative(5.5 * NATIVE_PIXEL, 494.5 * NATIVE_PIXEL), true);
  beyond = false;
  assert.deepEqual([open(5, 5), open(-3, 5)], [true, false], 'the land past the Bay off: the Bay\'s alone');
  // the raiders' sea's ground
  assert.deepEqual([onWorldSea(500, 250, false), onWorldSea(-3, 5, false), onWorldSea(-3, 5, true), onWorldSea(-WORLD_PIXEL_SPAN - 1, 5, true)], [true, false, true, false]);
  assert.equal(onWorldSea(ETHER_BOX.x0 + 1, ETHER_BOX.y0 + 1, false), true, 'the box, as ever');
});

test('WW3 THE WORLD\'S LANES: the Bay\'s off its ports and its water alone, made once; the sea\'s past the Bay between the world\'s ports, made again when they move; one book, the Bay\'s first; a Bay lane never leaves the Bay\'s water, a lane past it may cross it; each way kept once (mutants: the Bay\'s water for the world\'s lanes, the world\'s for the Bay\'s, the book unkept, the ports\' version)', () => {
  // the Bay's water: a strait at x 0..3 with a bar of land across it at y 128..132; the world's: the same and a channel
  // west of the edge round the bar
  // (and a Bay harbour at (0, 172) whose only water is the world's, past the edge: no roadstead of the Bay's, no lane)
  const bayW = (x, y) => x >= 0 && x <= 3 && y >= 110 && y <= 150 && !(y >= 128 && y <= 132);
  const worldW = (x, y) => bayW(x, y) || (x >= -6 && x < 0 && y >= 110 && y <= 180);
  const dict = new Map([[115 * 1000 + 1, { id: 115001, regionIndex: 17, mapIndex: 0 }], [145 * 1000 + 1, { id: 145001, regionIndex: 17, mapIndex: 1 }], [172 * 1000, { id: 172000, regionIndex: 17, mapIndex: 2 }]]);
  const maps = { getRegion: () => ({ mapNames: ['North Quay', 'South Quay', 'Edge Wharf'] }), getClimateIndex: () => CLIMATES.Ocean };
  const places = createWorldPlaces();
  const ports = createWorldPorts({ places, openSea: (x, y) => worldW(x, y) && !places.at(x, y) });
  let reads = 0;
  const water = (x, y) => { reads++; return worldW(x, y); };
  const lanes = createWorldLanes({ mapDict: () => dict, maps, portIds: [115001, 145001, 115001, 172000], ports, bayOpen: (x, y) => { reads++; return bayW(x, y); },
    bayOpenNative: (x, z) => bayW(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(z / NATIVE_PIXEL)), water, beyond: () => true });
  assert.deepEqual(lanes.bayPorts().map((p) => [p.id, p.name, p.px, p.py, p.region]), [[115001, 'North Quay', 1, 115, 17], [145001, 'South Quay', 1, 145, 17], [172000, 'Edge Wharf', 0, 172, 17]]);
  const bay = lanes.bay();
  assert.deepEqual(bay.map((l) => l.key), ['115001-145001'], 'the Bay\'s water alone: the edge\'s wharf has no roadstead');
  assert.equal(laneNetwork(lanes.bayPorts(), lanes.open).length, 2, 'the world\'s water would have given it one');
  assert.equal(lanes.bay(), bay, 'made once');
  assert.equal(lanes.all(), bay, 'none past the Bay: the Bay\'s own book');
  assert.equal(lanes.way(bay[0]), null, 'the bar shuts the strait, and a Bay lane never takes the world\'s channel');
  const was = reads;
  assert.equal(lanes.way(bay[0]), null);
  assert.equal(reads, was, 'a way kept once');
  // two ports past the Bay, west of the edge: their lane takes the channel and the strait, round the bar
  places.register('beyond', [town(9001, -5, 116), town(9002, -5, 142)]);
  const beyond = lanes.beyond();
  assert.equal(beyond.length, 1);
  assert.equal(beyond[0].key, `${PORT_ID_WORLD + worldPixelKey(-5, 116)}-${PORT_ID_WORLD + worldPixelKey(-5, 142)}`);
  assert.deepEqual(lanes.all(), [...bay, ...beyond]);
  assert.equal(lanes.all(), lanes.all(), 'the one array while neither moves');
  // AUDIT TESA II P7: no picture here (the authored shape) - WW3's walk at the Bay's scale; on the picture the way is walked
  // at its scale, off the Bay's rectangle (scenes/naval/worldLanes.js beyondLaneWay - test/scenes/audittesa2p_hosts.test.js)
  const way = lanes.way(beyond[0]);
  assert.ok(way && way.pts.length >= 2 && way.len > 18 * 819, 'the sea past the Bay sailed, its way its own');
  places.register('beyond', [town(9003, -5, 116)]);
  assert.deepEqual(lanes.beyond(), [], 'one port: no lane');
  assert.deepEqual(lanes.all(), bay);
  assert.equal(laneNetwork(lanes.bayPorts(), bayW).length, bay.length);
  assert.equal(bayLanePorts(null, maps, [1]), null, 'before the directory stands');
});

test('WW3 the waters\' people: a ship\'s captain and hands named by the waters\' area past the Bay - a Nord in Skyrim\'s - and on the Bay by its region, as always (mutants: the area unread, the Bay\'s area read as a province\'s)', () => {
  const skyrim = CITIES.find((c) => c.name === 'Solitude');
  const [sx, sy] = pictureToBay(skyrim.at[0], skyrim.at[1]).map(Math.floor);
  const area = areaAt(sx, sy, () => -1);
  assert.ok(area >= BAY_AREA_COUNT);
  assert.equal(shipNameBank(17), getNameBankOfRegion(17));
  assert.equal(shipNameBank(17, 17), getNameBankOfRegion(17), 'a Bay area is its region');
  assert.equal(shipNameBank(20, 5), getNameBankOfRegion(20), 'the Bay\'s region whatever area is said');
  assert.equal(shipNameBank(17, area), nameBankOfArea(area));
  assert.equal(shipNameBank(-1), getNameBankOfRegion(17), 'none: Daggerfall\'s');
  assert.notEqual(nameBankOfArea(area), getNameBankOfRegion(17), 'Skyrim\'s people are not the Bay\'s');
  const cls = classById('merchantCog') ?? classById('pirateSloop');
  let differ = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const bayNames = shipNames(cls, seed, { regionIndex: 17 });
    assert.deepEqual(shipNames(cls, seed, { regionIndex: 17, bank: shipNameBank(17, 17) }), bayNames);
    if (shipNames(cls, seed, { regionIndex: 17, bank: shipNameBank(17, area) }).captain !== bayNames.captain) differ++;
    assert.equal(handName(seed, 0, 'male', 17, shipNameBank(17, 3)), handName(seed, 0, 'male', 17));
    if (handName(seed, 0, 'male', 17, shipNameBank(17, area)) !== handName(seed, 0, 'male', 17)) differ++;
  }
  assert.ok(differ > 40, `${differ} names a Nord's`);
});

test('WW3 the living world\'s ports by the one number: a port town past the Bay found by the world\'s key, the Bay\'s by its masked id (mutant: the masked id past the Bay)', () => {
  const places = createWorldPlaces();
  places.register('bay', [town((7 << 20) | 213207, 207, 213, { region: 17 })]);
  places.register('beyond', [town(0x7fffff, -20, 100)]);
  const index = createLivingIndex({ places, populated: () => true, peopleAt: () => 'Breton' });
  assert.equal(index.townOfPort(213207)?.name, `Port ${(7 << 20) | 213207}`);
  assert.equal(index.townOfPort(PORT_ID_WORLD + worldPixelKey(-20, 100))?.mapId, 0x7fffff);
  assert.equal(index.townOfPort(maskMapId(0x7fffff)), null, 'never by a masked id past the Bay');
});

test('WW3 the wiring: the world host stands the world\'s ports off the registry and its lanes off them, asks them for the port test, the nearest port, the board\'s list and the harbour past the Bay, hands the waters\' area to the sea, the world\'s lanes to the serpent (WW7-12) and the sea trade, and the raiders the world\'s sea; the naval host names her by her waters\' people (mutants: the lanes\' book, the port test past the Bay, the board\'s list, the area unsaid, the raiders\' ground)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const worldPorts = createWorldPorts\(\{ places: worldPlaces, openSea, land: tamrielLandVersion, regionAt: \(x, y\) => maps\.getRegionIndexAt\(x, y\),\n {4}crownAt: \(x, y\) => navalCrownOf\(x, y, navalCapitals\(\)\)\.name \}\);/);   // PIN MOVED (BAY-LEFT-SEA): and a port past the Bay keeps the nearest Bay crown's office
  assert.match(w, /const worldLanes = createWorldLanes\(\{ mapDict: \(\) => mapDict, maps, portIds: PORT_LOCATION_IDS, ports: worldPorts, bayOpen: laneOpen, bayOpenNative: laneOpenNative, water: tvWater, beyond: \(\) => tamrielLand, kernel: kernelSea \}\);/);
  assert.match(w, /function laneNet\(\) \{ return worldLanes\.all\(\); \}/);
  // PIN MOVED (WORLD-WIDE folded into TESA, #1184): past the Bay an Arena port answers first (TESA6), then the provider's word
  // PIN MOVED (AUDIT TESA II P7): TESA's places registered (world/pastBayRows.js), the provider's word is the whole of it
  assert.match(w, /if \(!onTheBay\(x, y\)\) return worldPorts\.at\(x, y\);/);
  assert.match(w, /return worldPorts\.nearestNamed\(here, worldLanes\.bayPorts\(\) \?\? \[\]\);/);   // PIN MOVED (AUDIT WW F10): the lanes' book's list
  assert.match(w, /d = Math\.min\(d, worldPorts\.nearestPx\(p\.x, p\.y\) \?\? Infinity\);/);
  assert.match(w, /if \(_navalPortList\) return worldPorts\.withBay\(_navalPortList\);/);
  assert.match(w, /_navalPortList = \[\.\.\.out\.values\(\)\];\n\s*return worldPorts\.withBay\(_navalPortList\);/);
  assert.match(w, /region: _questRegionIndex\(\), area: worldPorts\.seaAreaAt\(p\.x, p\.y\),/);
  assert.match(w, /return worldSerpentSite\(day, worldLanes, serpentLink\.toldAt\);/);   // PIN MOVED (WW7-12): every lane of the world, or the hub's word
  assert.match(w, /portLanes: \(\) => \(_lanesReady && mapDict \? worldLanes\.all\(\) : null\) \}\);/);   // PIN MOVED (WW7-10): the world's lanes, a Bay port's the Bay's (townEconHost.js lanesAt)
  assert.match(w, /if \(!onWorldSea\(px, py, tamrielLand\) \|\| maps\.getClimateIndex\(px, py\) !== CLIMATES\.Ocean\) return false;/);
  assert.match(w, /return onWorldSea\(px, py, tamrielLand\) && squareCornersAll\(tvWater, px, py\) && kernelSea\(x, z\);/);
  assert.match(w, /classId: p\.cls\.id, region: p\.region, area: lane\.a\.area \?\? -1,/);
  assert.match(src('src/scenes/livingWorld/livingLanes.js'), /const id = portIdOf\(town\);/);   // PIN MOVED (AUDIT WW F7): a town's lanes the living lanes' book's
  assert.equal((w.match(/maskMapId\(/g) ?? []).length, 0, 'no port keyed by a masked id in the host');
  const n = src('src/scenes/naval/navalHost.js');
  assert.match(n, /watersShipNames\(cls, spec\.seed, region, crown, area\)/, 'her home port\'s waters, else the waters she is met in - a Bay ship\'s her region\'s');
  assert.match(n, /const namesArea = \(spec, w\) => spec\.area \?\? \(\(spec\.region \?\? -1\) >= 0 \? -1 : w\.area \?\? -1\);/, 'PIN MOVED (WW7-8): the area the module\'s namesArea, kept on her entry for the wire');   // PIN MOVED (AUDIT TESA II K7): the names built beside watersFolk, out of the host's scope
  assert.match(n, /const watersShipNames = \(cls, seed, region, crown, area\) => shipNames\(cls, seed, \{ regionIndex: region, crown, bank: shipNameBank\(region, area\) \}\);/);
  assert.match(n, /\.\.\.watersFolk\(where\(\)\), record: saved\?\.mates \?\? null \}\);/);   // PIN MOVED (AUDIT WW F12): the waters read once
  assert.match(n, /const watersFolk = \(w\) => \(\{ regionIndex: w\.region \?\? 17, bank: shipNameBank\(w\.region \?\? 17, w\.area \?\? -1\) \}\);/);
  assert.equal((n.match(/region: l\.region, area: l\.area,/g) ?? []).length, 2, 'a packet named by her home port\'s waters, at her berth and under way');
  assert.ok(THEATRE_KEYS.length === 10);
});
