// SEA-ROWS (bible/01-Overview/bugs/Field-Bugs-2026-10-29f.md; a player: "You get told you're going to the E-O instead").
// The crossing's waters keep out of sight of the sea the world sails - every lane's way and the serpent's ring - on every
// row (systems/naval/etherCrossing.js createCrossSea, world/ethericSea.js crossingWaters): bounded to the Bay's rows they
// left the open ocean past the Bay unasked. And a journey's arrival is counted apart from its other ends
// (systems/travel/travelOptions.js `arrived`), so the crossing asks where a journey arrives and not where it stopped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCrossSea, createCrossLand, crossingWayAt, CROSS_WALK_MS } from '../../../src/systems/naval/etherCrossing.js';
import { crossingWaters, CROSS_X, CROSS_SEA_PX, HOME_WATERS, inEther } from '../../../src/world/ethericSea.js';
import { createWorldLanes } from '../../../src/scenes/naval/worldLanes.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { NATIVE_PIXEL } from '../../../src/systems/seaRaiders.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { rectOf } from '../../../src/systems/travel/travelAutopilot.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
/** A way's native point at a map pixel's middle (x east; z north, row 0 at the top). */
const nat = (px, py) => ({ x: (px + 0.5) * NATIVE_PIXEL, z: (499.5 - py) * NATIVE_PIXEL });
/** A lanes' book of straight ways between map pixels (scenes/naval/worldLanes.js's shape): `near` and `way` counted. */
function book(ways, { settled = true, near = () => true } = {}) {
  const lanes = ways.map(([ax, ay, bx, by], i) => ({ key: `l${i}`, pts: [nat(ax, ay), nat(bx, by)] }));
  const b = { walked: [], pads: [], settled: () => settled, all: () => lanes, near: (l, here, pad) => { b.pads.push(pad); return near(l, here); }, way: (l) => { b.walked.push(l.key); return { pts: l.pts }; } };
  return b;
}

test('SEA-ROWS the sea the world sails: a pixel\'s distance from its middle to the nearest lane\'s way or the serpent\'s ring, Infinity past the reach; none measured before the lanes are settled (mutants: the settling, the ring, the reach)', () => {
  const b = book([[0, 0, 100, 0]]);
  const sea = createCrossSea(() => b, () => null);
  assert.equal(sea(50, 10), 10, 'ten pixels south of the way');
  assert.equal(sea(50, 0), 0, 'on it');
  assert.equal(sea(119, 0), 19, 'past its end, to the end');
  assert.equal(sea(50, 21), Infinity, 'past the reach');
  assert.equal(sea(50, CROSS_SEA_PX), CROSS_SEA_PX, 'at the reach');
  assert.equal(createCrossSea(() => book([]), () => null)(50, 10), Infinity, 'no lane: none in reach');
  assert.equal(createCrossSea(() => book([[0, 0, 100, 0]], { settled: false }), () => null)(50, 10), null, 'the lanes not yet settled: not measured');
  assert.equal(createCrossSea(() => null, () => null)(50, 10), null, 'no book at all');
  const ring = { ring: { cx: 200.5, cy: 50.5, r: 3 } };
  assert.equal(createCrossSea(() => book([]), () => ring)(210, 50), 7, 'the serpent\'s ring, from its edge');
  assert.equal(createCrossSea(() => book([]), () => ring)(201, 51), 0, 'inside it');
});

test('SEA-ROWS the measure\'s cost: only lanes whose bound holds the pixel, padded past the reach (worldLanes near); the ways no check asked for walked CROSS_WALK_MS a check, one at the least - no answer until all are; the last pixel\'s answer kept (mutants: the pad, the half answer)', () => {
  const far = book([[0, 0, 100, 0], [0, 300, 100, 300]], { near: (l) => l.key === 'l0' });
  assert.equal(createCrossSea(() => far, () => null)(50, 10), 10);
  assert.deepEqual(far.walked, ['l0'], 'a lane outside its bound never walked');
  assert.deepEqual(new Set(far.pads), new Set([CROSS_SEA_PX + 1]), 'the bound padded past the reach');
  let t = 0;
  const slow = book([[0, 40, 100, 40], [0, 0, 100, 0], [0, 60, 100, 60]]);
  const sea = createCrossSea(() => slow, () => null, CROSS_SEA_PX, () => (t += CROSS_WALK_MS + 1));
  assert.equal(sea(50, 10), null, 'one way walked, the rest owed: no answer');
  assert.deepEqual(slow.walked, ['l0']);
  assert.equal(sea(50, 10), null);
  assert.equal(sea(50, 10), 10, 'all walked: the nearest');
  assert.deepEqual(slow.walked, ['l0', 'l0', 'l1', 'l0', 'l1', 'l2'], 'each walked once, then read');
  const n = slow.walked.length;
  assert.equal(sea(50, 10), 10);
  assert.equal(slow.walked.length, n, 'the same pixel: its answer kept');
});

test('SEA-ROWS the lanes settled: the Bay\'s directory read, and the picture where the land past the Bay stands - the Bay\'s lanes alone with it off; a lane\'s bound padded by the reach asked, on each arm - the packets\' own pad unchanged (mutants: the settling\'s law, each arm\'s pad)', () => {
  const lanes = createWorldLanes({ mapDict: () => null, maps: { getRegion: () => null, getClimateIndex: () => CLIMATES.Ocean }, portIds: [], ports: { list: () => [], version: () => 'v' }, bayOpen: () => true, bayOpenNative: () => true, water: () => true, beyond: () => true });
  const end = (px, py) => ({ px, py, road: { x: px, y: py } });
  // each point 41 pixels from both ports of a Bay lane (its bound 30 and the pad), or its two ports' distances summed to
  // 820 past the Bay (800 and twice the pad) and 1,240 across its edge (1,216 and twice the pad)
  for (const [name, lane, p] of [['the Bay\'s', { a: end(100, 100), b: end(120, 100) }, { x: 110, y: 140 }],
    ['past the Bay', { a: end(-200, 600), b: end(-100, 600) }, { x: -150, y: 600 + Math.sqrt(410 ** 2 - 50 ** 2) }],
    ['across its edge', { cross: true, a: end(100, 100), b: end(100, 300) }, { x: 100, y: 300 + (1240 - 200) / 2 }]]) {
    assert.equal(lanes.near(lane, p), false, `${name}: past the packets' reach`);
    assert.equal(lanes.near(lane, p, CROSS_SEA_PX + 1), true, `${name}: within the crossing's`);
  }
  const make = (dict, beyond) => createWorldLanes({ mapDict: () => dict, maps: { getRegion: () => null, getClimateIndex: () => CLIMATES.Ocean }, portIds: [], ports: { list: () => [], version: () => 'v' },
    bayOpen: () => true, bayOpenNative: () => true, water: () => true, beyond: () => beyond });
  setTamrielTrace(null);
  assert.equal(make(new Map(), false).settled(), true, 'the land past the Bay off: the Bay\'s lanes are all');
  assert.equal(make(new Map(), true).settled(), false, 'on, its picture still coming');
  assert.equal(make(null, false).settled(), false, 'the directory unread');
});

/** Travel Options as the world host wires it (test/systems/travel/tv8_party_walk.test.js's travelClient): `go` stands the
 *  traveller somewhere and runs the mod's frame. */
function travelClient() {
  const at = (px, py, dx = 16384, dz = 16384) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + dx, z: o.z + dz }; };
  const state = { pos: at(500, 250), pixel: { x: 500, y: 250 } };
  let to = null;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => to?.interruptTravel(), onCancel: () => to?.clearTravelDestination() });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  to = createTravelOptions({
    settings, ui, roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 3200, luck: 50, stealth: 50 }), enemiesNearby: () => false, diseaseCount: () => 0,
    say: () => {}, messageBox: () => {}, setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
  });
  return { to, ui, go: (px, py, dx, dz) => { state.pixel = { x: px, y: py }; state.pos = at(px, py, dx, dz); return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); } };
}

test('SEA-ROWS a journey\'s arrival counted apart from its other ends: the place reached, the spot reached and the pixel reached each count; a stop, an Exit and a forgotten destination do not (mutants: each arrival\'s count)', () => {
  const place = { pixel: { x: 505, y: 250 }, name: 'Ripwych', mapId: 42 };
  const a = travelClient();
  a.to.beginTravelAlongRoute({ legs: [{ x: 505, y: 250, kind: 'road' }], summary: place }, false, { quiet: true });
  a.to.messages.pauseTravel();
  assert.deepEqual([a.to.arrived, a.to.cleared], [0, 0], 'a stop: no end');
  a.to.resumeTravel();
  a.go(505, 250, 16300, 16300); a.go(505, 250, 16300, 16300);
  assert.deepEqual([a.to.isTravelActive, a.to.arrived, a.to.cleared], [false, 1, 1], 'the route\'s place reached: arrived');
  const s = travelClient();
  s.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...mapPixelWorldOrigin(501, 250), x: mapPixelWorldOrigin(501, 250).x + 16384, z: mapPixelWorldOrigin(501, 250).z + 16384 }, false, { quiet: true });
  s.go(501, 250); s.go(501, 250);
  assert.deepEqual([s.to.arrived, s.to.cleared], [1, 1], 'the spot reached: arrived');
  const c = travelClient();
  c.to.beginTravelToCoords({ x: 502, y: 250 });
  c.go(502, 250); c.go(502, 250);
  assert.deepEqual([c.to.arrived, c.to.cleared], [1, 1], 'the pixel reached: arrived');
  const l = travelClient();
  l.to.beginTravel(place);
  l.go(505, 250, 16300, 16300); l.go(505, 250, 16300, 16300);
  assert.deepEqual([l.to.arrived, l.to.cleared], [1, 1], 'the mod\'s own place reached: arrived');
  const e = travelClient();
  e.to.beginTravelAlongRoute({ legs: [{ x: 505, y: 250, kind: 'road' }], summary: place }, false, { quiet: true });
  e.ui.cancelWindow();
  e.to.clearTravelDestination();
  assert.deepEqual([e.to.arrived, e.to.cleared], [0, 2], 'Exit and Forget it: ends, no arrival');
});

test('SEA-ROWS with ARENA2: the crossing\'s waters on the freeware\'s world - no lane\'s way and no serpent site or ring in them on any row, the measure exact against every way, and the open ocean past the Bay crossing water (west of Sumurset, north-west of High Rock) as the Bay\'s mouth is (mutants: the sailed sea unread, the pad)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundWoods, groundMaps, tamrielClimateAt, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { buildMapDict } = await import('../../../src/systems/map/mapDirectory.js');
  const { PORT_LOCATION_IDS } = await import('../../../src/systems/travel/travelPorts.js');
  const { createWorldPorts } = await import('../../../src/world/worldWide/worldPorts.js');
  const { createWorldPlaces } = await import('../../../src/world/worldWide/worldPlaces.js');
  const { arenaPixels, pastBayLakeAt } = await import('../../../src/world/arenaPlaces.js');
  const { arenaPlaceId, ARENA_TEMPLATE_KINDS } = await import('../../../src/world/arenaLocations.js');
  const { findSerpentSite } = await import('../../../src/systems/serpent/serpentSite.js');
  const { SERPENT_EVERY_DAYS } = await import('../../../src/net/serpent/serpentLaw.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = groundWoods((() => { const w = new WoodsFile(); w.load(bytes('WOODS.WLD')); return w; })());
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), woods.getHeightMapValue(x, y));
    const seaPixel = (x, y) => isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y));   // the host's (scenes/world.js seaPixel)
    const bayOpen = (x, y) => inBay(x, y) && seaPixel(x, y) && maps.getClimateIndex(x, y) === CLIMATES.Ocean;
    const places = createWorldPlaces();
    places.register('tesa', arenaPixels().stood.map((p) => ({ mapId: arenaPlaceId(p), name: p.name, px: p.bx, py: p.by, type: ARENA_TEMPLATE_KINDS[p.kind].type, port: !!p.port })));
    const ports = createWorldPorts({ places, openSea: (x, y) => water(x, y) && !pastBayLakeAt(x, y) });
    const dict = buildMapDict(maps);
    const wl = createWorldLanes({ mapDict: () => dict, maps, portIds: PORT_LOCATION_IDS, ports, bayOpen, bayOpenNative: (x, z) => bayOpen(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(z / NATIVE_PIXEL)), water, beyond: () => true });
    assert.equal(wl.settled(), true);
    let site = null;
    const measure = createCrossSea(() => wl, () => site), landPx = createCrossLand(seaPixel);
    const sea = (x, y) => { let d = measure(x, y); for (let k = 0; d === null && k < 400; k++) d = measure(x, y); return d; };
    const way = (x, y) => crossingWayAt(x, y, x < CROSS_X && !inEther(x, y) ? landPx(x, y) : 0, x < CROSS_X && !inEther(x, y) ? sea(x, y) : 0);   // scenes/world.js crossWayHere
    // the measure against a brute force over every way, on a grid west of the Bay's mouth from Skyrim's sea to Sumurset's
    const legs = wl.all().flatMap((l) => { const w = wl.way(l); return w ? w.pts.slice(1).map((b, i) => [w.pts[i], b]) : []; });
    const brute = (px, py) => {
      let d = Infinity;
      for (const [a, b] of legs) {
        const ax = a.x / NATIVE_PIXEL, ay = 500 - a.z / NATIVE_PIXEL, dx = b.x / NATIVE_PIXEL - ax, dy = 500 - b.z / NATIVE_PIXEL - ay;
        const t = dx || dy ? Math.max(0, Math.min(1, ((px + 0.5 - ax) * dx + (py + 0.5 - ay) * dy) / (dx * dx + dy * dy))) : 0;
        d = Math.min(d, Math.hypot(px + 0.5 - ax - t * dx, py + 0.5 - ay - t * dy));
      }
      return d > CROSS_SEA_PX ? Infinity : d;
    };
    let within = 0;
    for (let y = -700; y <= 2100; y += 11) for (let x = -500; x < CROSS_X; x += 11) {
      const b = brute(x, y);
      if (b < Infinity) within++;
      assert.ok(Math.abs(sea(x, y) - b) < 1e-9 || sea(x, y) === b, `(${x},${y}): ${sea(x, y)} against ${b}`);
    }
    assert.ok(within > 300, `${within} points near a way`);
    // every far lane's way: no pixel of it crossing water
    let far = 0;
    for (const lane of [...wl.beyond(), ...wl.cross()]) {
      const w = wl.way(lane);
      if (!w) continue;
      for (let i = 1; i < w.pts.length; i++) {
        const a = w.pts[i - 1], b = w.pts[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / NATIVE_PIXEL) + 1;
        for (let k = 0; k <= n; k++) { const px = Math.floor((a.x + (b.x - a.x) * k / n) / NATIVE_PIXEL), py = 499 - Math.floor((a.z + (b.z - a.z) * k / n) / NATIVE_PIXEL); far++; assert.ok(sea(px, py) < 1, `${lane.key} (${px},${py})`); }
      }
    }
    assert.ok(far > 2000, `${far} pixels of far lanes`);
    // the serpent's sites over a run of its days: no site and no pixel of its ring in the crossing's waters
    let days = 0, past = 0;
    for (let d = 1; d < 600; d += SERPENT_EVERY_DAYS) {
      site = findSerpentSite(d, { lanes: wl.all(), wayOf: wl.way, open: wl.open });
      if (!site) continue;
      days++; if (!inBay(site.px, site.py)) past++;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (Math.hypot(dx, dy) <= 4.2) assert.notEqual(way(site.px + dx, site.py + dy), 'out', `day ${d}: ${site.place} (${site.px + dx},${site.py + dy})`);
    }
    site = null;
    assert.ok(days > 200 && past > 50, `${days} site days, ${past} past the Bay`);
    assert.equal(way(HOME_WATERS.px, HOME_WATERS.py), 'out', 'the Bay\'s mouth');
    assert.equal(way(-300, 1500), 'out', 'west of Sumurset');
    assert.equal(way(100, -200), 'out', 'north-west of High Rock');
    assert.equal(way(62, 1573), null, 'off Sunhold, on its lane');
    assert.equal(crossingWaters(62, 1573, Infinity, sea(62, 1573)), false);
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
