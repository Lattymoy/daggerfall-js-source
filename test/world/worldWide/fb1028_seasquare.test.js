// FIELD BUGS 2026-10-28 (bible/01-Overview/bugs/Field-Bugs-2026-10-28.md), three reports of the Tamriel integration:
// SEA-SQUARE - ships went in circles at the coasts past the Bay, and voyages port to port stuck there: DFU's kernel builds
// a map pixel's square between the bytes of columns x - 1 and x and rows y - 1 and y, so a byte is its square's south-east
// corner, and the lanes and the voyages read it as the square's middle; COAST-PORT - coastal cities with no port: only a
// city the lore flags stood one. Synthetic pins first; then the freeware's own world where ARENA2_PATH names it.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { kernelTerms, squareCornersAll } from '../../../src/world/terrain/terrainSampler.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { worldLaneWater, crossLanes, BEYOND_LANE_MAX_PX } from '../../../src/scenes/naval/worldLanes.js';
import { roadsteadOf, laneNetwork } from '../../../src/systems/naval/seaLanes.js';
import { seaLegWindow, seaLegBuiltAt, seaLegMark, SEA_LEG_UNBUILT } from '../../../src/systems/travel/seaMark.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { mapPixelWorldOrigin, MP_WORLD_UNITS } from '../../../src/systems/travel/travelPaths.js';
import { standArenaPixels } from '../../../src/world/arenaPlaces.js';
import { SEA_RING } from '../../../src/net/fortLaw.js';
import { setTamrielTrace, tamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';

afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

/** A woods of the given bytes, its large map flat - DFU's kernel over it. */
function woodsOf(byteAt) {
  const w = Object.create(WoodsFile.prototype);
  w.getHeightMapValue = byteAt;
  w.getLargeMapData = () => Array.from({ length: 5 }, () => new Uint8Array(5));
  return w;
}

test('SEA-SQUARE the kernel\'s square: pixel (x, y) is built between the bytes of columns x - 1 and x and rows y - 1 and y - its south-east corner byte (x, y)\'s own, its south-west (x - 1, y)\'s, its north-east (x, y - 1)\'s; so its ground is its four corners\', and one byte of water among land is no square of water (mutants: a corner unasked; the corners the next square\'s)', () => {
  const at = (x, y) => (x * 7 + y * 13) % 60;   // a byte each, all different
  const { base } = kernelTerms(woodsOf(at), 10, 20);
  assert.ok(Math.abs(base(128, 0) - at(10, 20)) < 1e-9, 'its south-east corner: its own byte');
  assert.ok(Math.abs(base(0, 0) - at(9, 20)) < 1e-9, 'south-west: the west column\'s');
  assert.ok(Math.abs(base(128, 128) - at(10, 19)) < 1e-9, 'north-east: the north row\'s');
  assert.ok(Math.abs(base(0, 128) - at(9, 19)) < 1e-9, 'north-west');
  // one column of water bytes among land: its square's middle sits between land and water
  const channel = (x) => (x === 10 ? 0 : 60);
  const mid = kernelTerms(woodsOf((x) => channel(x)), 10, 20).base(64, 64);
  assert.ok(mid > 20, `the square's middle is no water (${mid.toFixed(1)})`);
  const wet = (x, y) => x >= 9 && x <= 10 && y >= 19 && y <= 20;
  assert.equal(squareCornersAll(wet, 10, 20), true, 'all four corners');
  for (const [x, y] of [[9, 20], [11, 20], [10, 19], [10, 21]]) assert.equal(squareCornersAll(wet, x, y), false, `${x},${y}`);
  for (const [lx, ly] of [[9, 19], [10, 19], [9, 20], [10, 20]]) assert.equal(squareCornersAll((x, y) => !(x === lx && y === ly), 10, 20), false, `its corner ${lx},${ly} land`);
  assert.ok(kernelTerms(woodsOf((x) => (x >= 9 && x <= 10 ? 0 : 60)), 10, 20).base(64, 64) < 1, 'two columns: the square between them water');
});

test('SEA-SQUARE the lanes\' water past the Bay: a pixel is open where its four corner bytes are the sea - a channel one byte wide has no open square, two bytes wide one; the Bay\'s own water is the Bay\'s as it was (mutants: the byte\'s own law; a corner unasked; the Bay\'s read by the corners)', () => {
  const sea = (x, y) => (y < 0 && (x === 2000 || x === 3000 || x === 3001)) || (y >= 0 && y < 500 && x === 500);
  const lw = worldLaneWater({ bayOpen: (x, y) => x === 500 || x === 501, water: sea, climateAt: () => CLIMATES.Ocean, beyond: () => true });
  assert.deepEqual([lw.open(2000, -100), lw.open(2001, -100)], [false, false], 'one byte wide: no square of water');
  assert.deepEqual([lw.open(3000, -100), lw.open(3001, -100), lw.open(3002, -100)], [false, true, false], 'two bytes wide: the square between them');
  assert.equal(lw.open(3001, 0), false, 'its row\'s south corner on the Bay\'s side, land there');
  assert.deepEqual([lw.open(500, 200), lw.open(501, 200)], [true, true], 'the Bay: its own water, pixel by pixel');
  const inland = worldLaneWater({ bayOpen: () => false, water: () => true, climateAt: (x) => (x === 3000 ? CLIMATES.Woodlands : CLIMATES.Ocean), beyond: () => true });
  assert.deepEqual([inland.open(3000, -100), inland.open(3001, -100), inland.open(3002, -100)], [false, false, true], 'a corner off the Ocean\'s climate: no lane water');
  assert.equal(lw.openNative(3001.5 * 32768, (499 - -100 + 0.5) * 32768), true, 'its native twin, the pixel floored');
});

test('SEA-SQUARE a roadstead past the Bay: of a ring\'s open pixels the one with the most open sea about it - the Bay\'s nearest first as it was; the lanes past the Bay and the crossing lanes\' far ports ask it (mutants: the room unread; the Bay roomy; the lanes past the Bay not)', () => {
  // the open sea south of row 100, and one pixel west of the port on its own
  const open = (x, y) => y >= 101 || (x === 99 && y === 100);
  const port = { id: 1, name: 'A', px: 100, py: 100 };
  assert.deepEqual(roadsteadOf(port, open), { x: 99, y: 100 }, 'the Bay\'s: the first nearest in the ring\'s order');
  assert.deepEqual(roadsteadOf(port, open, true), { x: 100, y: 101 }, 'past the Bay: the roomiest');
  const two = [port, { id: 2, name: 'B', px: 300, py: 100 }];
  assert.deepEqual(laneNetwork(two, open, BEYOND_LANE_MAX_PX, true)[0].a.road, { x: 100, y: 101 });
  assert.deepEqual(laneNetwork(two, open, BEYOND_LANE_MAX_PX)[0].a.road, { x: 99, y: 100 });
  // past the Bay's north edge: the sea south of the far port, and one pixel north of it on its own (the first nearest)
  const far = { id: 2 ** 20 + 5, name: 'Far', px: 100, py: -200 };
  const farOpen = (x, y) => y < 0 && (y >= -199 || (x === 100 && y === -201));
  assert.deepEqual(roadsteadOf(far, farOpen), { x: 100, y: -201 });
  const lanes = crossLanes([far], [{ id: 7, name: 'Bay', px: 100, py: 2 }], farOpen, (x, y) => y >= 0 && y <= 1, new Uint8Array(1000 * 500).fill(1));
  assert.deepEqual(lanes[0]?.b.road, { x: 100, y: -199 }, 'a crossing lane\'s far roadstead the roomiest');
});

test('SEA-SQUARE a voyage\'s leg past the Bay is aimed about its byte - its window a pixel wide centred on the square\'s south-east corner, on the Bay its own square as PASSAGE-IN aims it; its ground built when the four squares about that point are; Travel Options\' sea and launch legs aim there (mutants: the window the square\'s; the built asked of one square; the launch\'s the middle)', () => {
  const o = mapPixelWorldOrigin(1200, -40), H = MP_WORLD_UNITS / 2;
  assert.deepEqual(seaLegWindow(1200, -40), { x: o.x + H, z: o.z - H }, 'past the Bay: about the byte');
  assert.deepEqual(seaLegWindow(300, 200), mapPixelWorldOrigin(300, 200), 'the Bay: its own square');
  const w = seaLegWindow(1200, -40), byte = { x: o.x + MP_WORLD_UNITS, z: o.z };
  // the four squares about the byte's point - one of them not built
  const nw = (x, z) => (x < byte.x && z >= byte.z ? null : true);
  assert.equal(seaLegBuiltAt(w, nw), false, 'a square about it unbuilt');
  assert.equal(seaLegMark(w, nw), SEA_LEG_UNBUILT);
  assert.equal(seaLegBuiltAt(w, () => true), true);
  assert.equal(seaLegMark(w, () => true), null, 'it floats her: the window\'s middle, the byte\'s point');
  // the Bay's square: its own middle's built state alone, as it was
  const b = mapPixelWorldOrigin(300, 200);
  assert.equal(seaLegBuiltAt(b, (x) => (x >= b.x + MP_WORLD_UNITS ? null : true)), true, 'the next square unbuilt: no matter');
  const deps = { settings: readTravelOptionsSettings(), setTimeScale: () => {}, pushWindow: (win) => win.show?.(), worldPos: () => ({ x: 0, z: 0 }), mapPixel: () => ({ x: 1199, y: -40 }), yaw: () => 0, seaWaterAt: () => true };
  const aim = (legs) => { const j = createTravelOptions(deps); assert.equal(j.beginTravelAlongRoute({ legs, summary: { pixel: { x: 1300, y: -40 }, name: 'Port' }, name: 'Port' }, false, { quiet: true }), true); return j.state.autopilot.destinationCentre; };
  assert.deepEqual(aim([{ x: 1200, y: -40, kind: 'sea' }, { x: 1201, y: -40, kind: 'landfall' }]), byte, 'a sea leg past the Bay: its byte\'s point');
  assert.deepEqual(aim([{ x: 1200, y: -40, kind: 'embark' }, { x: 1201, y: -40, kind: 'sea' }]), byte, 'a launch past the Bay too');
  const bay = aim([{ x: 300, y: 200, kind: 'sea' }, { x: 301, y: 200, kind: 'landfall' }]);
  assert.deepEqual(bay, { x: b.x + H, z: b.z + H }, 'on the Bay: its middle, as ever');
  // its own square built, the one south-east of its byte not: unbuilt, and never aimed again till that square is
  let se = true;
  const j = createTravelOptions({ ...deps, seaWaterAt: (x, z) => (se && x >= byte.x && z < byte.z ? null : true) });
  assert.equal(j.beginTravelAlongRoute({ legs: [{ x: 1200, y: -40, kind: 'sea' }, { x: 1201, y: -40, kind: 'landfall' }], summary: { pixel: { x: 1300, y: -40 }, name: 'Port' }, name: 'Port' }, false, { quiet: true }), true);
  const rect = j.state.autopilot.destinationWorldRect;
  j.update({ topWindowIsTravelUI: true }); j.update({ topWindowIsTravelUI: true });
  assert.equal(j.state.autopilot.destinationWorldRect, rect, 'not aimed again a frame at a time');
  se = false;
  j.update({ topWindowIsTravelUI: true });
  assert.notEqual(j.state.autopilot.destinationWorldRect, rect, 'built: aimed again');
});

// COAST-PORT: Skyrim's land from picture (110, 20) to (210, 80) at ten Bay pixels a picture pixel, a lake in it; its north
// coast's first row Bay -300, the sea from -301 north
function coastTrace() {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 20; y < 80; y++) for (let x = 110; x < 210; x++) { const lake = x >= 170 && x < 180 && y >= 50 && y < 60; if (!lake) { land[y * w + x] = 1; province[y * w + x] = 3; } }
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  setTamrielTrace({ w, h, land, province });
  return tamrielTrace();
}
const place = (id, kind, name, px, py, port = false) => ({ province: 'Skyrim', provinceIndex: 2, id, kind, name, px, py, snapped: 0, ...(port ? { port: true } : {}) });

test('COAST-PORT a place the open sea bears on is a port, whatever the lore says - a city, a town or a village within SEA_RING of the picture\'s sea, never one past it, never one by a lake; it stands where it stood; the lore\'s port still on its shore (mutants: the ring unread; the lakes the sea; the lore\'s word alone)', () => {
  assert.equal(SEA_RING, 2);
  const trace = coastTrace();
  const s = standArenaPixels({ places: [
    place(0, 'city-state', 'Shore', 150.5, 20.15),     // Bay (1105, -299): the sea two rows north
    place(1, 'city-state', 'Inland', 140.5, 20.35),    // Bay (1005, -297): four rows
    place(16, 'town', 'Strand', 130.5, 20.05),         // a town on the coast's own row
    place(2, 'city-state', 'Lakeside', 169.85, 55.5),  // Bay (1298, 55): the lake a pixel east
    place(3, 'city-state', 'Lore', 190.5, 25.5, true), // the lore's port: onto its shore
  ] }, trace);
  const by = (n) => s.stood.find((p) => p.name === n);
  assert.deepEqual([by('Shore').bx, by('Shore').by, by('Shore').port], [1105, -299, true], 'two rows off the sea: a port, where it stood');
  assert.equal(by('Inland').port, undefined, 'four rows off: none');
  assert.equal(by('Strand').port, true, 'a town too');
  assert.equal(by('Lakeside').port, undefined, 'a lake is no sea');
  assert.deepEqual([by('Lore').by, by('Lore').port], [-300, true], 'the lore\'s port on its shore, as TESA6 stands it');
});

// ── THE FREEWARE'S OWN WORLD ───────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const realSkip = HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
const P = 819.2;

/** The world past the Bay as the game stands it: the trace at the freeware's fit, the composed ground, the places and their
 *  ports, the lanes' water - and the water a hull floats on, the kernel's own tiles a pixel (a tile is record 0). */
async function realWorld() {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundMaps, groundWoods, tamrielClimateAt } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { arenaPixels, pastBayLakeAt } = await import('../../../src/world/arenaPlaces.js');
  const { rumareSeaPixel } = await import('../../../src/world/rumareWaters.js');
  const { createWorldPlaces } = await import('../../../src/world/worldWide/worldPlaces.js');
  const { createWorldPorts } = await import('../../../src/world/worldWide/worldPorts.js');
  const { pastBayPlaceRows } = await import('../../../src/world/pastBayRows.js');
  const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  groundMaps(maps);
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const ground = groundWoods(woods);
  const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
  const places = createWorldPlaces();
  places.register('tesa', pastBayPlaceRows({ pixels: arenaPixels(), templateOf: () => ({ exterior: { exteriorData: { width: 1, height: 1 } } }), capitals: true }));
  const ports = createWorldPorts({ places, openSea: (x, y) => (water(x, y) && !pastBayLakeAt(x, y)) || rumareSeaPixel(x, y) }).list();
  const lw = worldLaneWater({ bayOpen: () => false, water, climateAt: (x, y) => tamrielClimateAt(x, y), beyond: () => true });
  const tiles = new Map();
  /** The tile water at a scene point, metres (x east, z north - native over 40). */
  const floats = (x, z) => {
    const px = Math.floor(x / P), row = Math.floor(z / P), py = 499 - row, k = `${px},${py}`;
    let t = tiles.get(k);
    if (!t) tiles.set(k, t = generatePixelTerrain({ woods: ground, px, py, tilemap: new Uint8Array(16384), climateType: tamrielClimateAt(px, py), landform: true }).tilemapBytes);
    const c = Math.min(127, Math.max(0, Math.trunc((128 * (x - px * P)) / P))), r = Math.min(127, Math.max(0, Math.trunc((128 * (z - row * P)) / P)));
    return (t[r * 128 + c] >> 2) === 0;
  };
  return { maps, ground, water, ports, lw, floats, tamrielClimateAt };
}

test('SEA-SQUARE (ARENA2): every roadstead past the Bay floats a hull at the scale it sails - where the byte\'s law stood 7 of the lore\'s 26 but the capitals\' on land (Gilane\'s 250 m from the water), and 3 of the coast\'s 7 (mutants: the byte\'s own law)', { skip: realSkip }, async () => {
  const w = await realWorld();
  const { capitalOnPixel } = await import('../../../src/world/tamrielCapitals.js');
  const ours = w.ports.filter((p) => !capitalOnPixel(p.px, p.py));
  assert.equal(ours.length, 32, 'the ports past the Bay but the capitals\' (their water their plans\' own)');
  const centre = (r) => w.floats((r.x + 0.5) * P, (499 - r.y + 0.5) * P);
  const byte = (x, y) => w.water(x, y) && w.tamrielClimateAt(x, y) === CLIMATES.Ocean;
  const before = ours.filter((p) => { const r = roadsteadOf(p, byte); return r && !centre(r); }).map((p) => p.name).sort();
  assert.deepEqual(before, ['Elden Root', 'Gilane', 'Haven', 'Lilmoth', 'Necrom', 'Rihad', 'Soulrest', 'Southpoint', 'Tear', 'Thorn'], 'the report: the byte\'s law put these on land - seven of the lore\'s ports, three of COAST-PORT\'s');
  const now = ours.map((p) => ({ p, r: roadsteadOf(p, w.lw.open, true) }));
  assert.ok(now.every(({ r }) => r), 'every port still has its roadstead');
  assert.deepEqual(now.filter(({ r }) => !centre(r)).map(({ p }) => p.name), [], 'every roadstead on water a hull floats on');
});

test('SEA-SQUARE (ARENA2): a voyage port to port past the Bay sails no leg over land - its legs aimed as Travel Options aims them over the ground the kernel builds, where the square\'s middle had them run kilometres ashore (Hegathe to Gilane, Rihad to Taneth, Haven to Southpoint; the landfall\'s own run ashore aside) (mutants: the window the square\'s)', { skip: realSkip }, async () => {
  const w = await realWorld();
  const { planRoute, routeLegs, routeGround } = await import('../../../src/systems/travel/travelRoute.js');
  const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
  const { rumareSeaPixel } = await import('../../../src/world/rumareWaters.js');
  const { SEA_LEG_DRY } = await import('../../../src/systems/travel/seaMark.js');
  const rg = routeGround((x, y) => w.maps.getClimateIndex(x, y), (x, y) => w.ground.getHeightMapValue(x, y), WATER_BYTE, 1000, 500, (x, y) => w.ground.getHeightMapValue(x, y) > WATER_BYTE, undefined, rumareSeaPixel);
  const floatsN = (x, z) => w.floats(x / 40, z / 40);
  const overLand = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 40 / 10)); let run = 0, most = 0; for (let i = 1; i < n; i++) { if (!floatsN(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) most = Math.max(most, run += 10); else run = 0; } return most; };
  const sail = (from, to, windowOf) => {
    const plan = planRoute(from, to, { ...rg, sea: { start: 'sea', again: false, goal: 'land', voyage: true } });
    assert.ok(plan, `a voyage ${from.x},${from.y} to ${to.x},${to.y}`);
    let at = null, worst = 0, legs = 0;
    for (const l of routeLegs(plan.pixels, plan.kinds)) {
      if (l.kind !== 'sea') continue;
      const win = windowOf(l.x, l.y), m = seaLegMark(win, floatsN);
      if (m === SEA_LEG_DRY) continue;
      const mark = m ?? { x: win.x + MP_WORLD_UNITS / 2, z: win.z + MP_WORLD_UNITS / 2 };
      if (at) { worst = Math.max(worst, overLand(at, mark)); legs++; }
      at = mark;
    }
    return { worst, legs };
  };
  const by = (n) => /** @type {any} */ (w.ports.find((p) => p.name === n));
  for (const [a, b] of [['Hegathe', 'Gilane'], ['Rihad', 'Taneth'], ['Haven', 'Southpoint']]) {
    const from = roadsteadOf(by(a), w.lw.open, true), to = { x: by(b).px, y: by(b).py };
    const was = sail(from, to, mapPixelWorldOrigin), now = sail(from, to, seaLegWindow);
    assert.ok(was.worst > 200, `${a} to ${b} at the squares' middles: ${was.worst} m ashore`);
    assert.equal(now.worst, 0, `${a} to ${b}: ${now.legs} legs, none ashore`);
  }
});

test('SEA-SQUARE (ARENA2): the report - a packet bound for Gilane makes her port, where she circled off its coast (her roadstead 250 m inside the land: the lookout swung her off it and the lane brought her back, round and round, never within LINER_PORT_M) (mutants: the byte\'s own law)', { skip: realSkip }, async () => {
  const w = await realWorld();
  const { sea } = await import('../../navalSea.mjs');
  const { packetsAt, pursue } = await import('../../../src/systems/naval/seaLanes.js');
  const { beyondLaneWay } = await import('../../../src/scenes/naval/worldLanes.js');
  const { LINER_PORT_M } = await import('../../../src/scenes/naval/navalHost.js');
  const lane = laneNetwork(w.ports, w.lw.open, BEYOND_LANE_MAX_PX, true).find((l) => [l.a.name, l.b.name].sort().join() === 'Gilane,Hegathe');
  const way = beyondLaneWay(/** @type {any} */ (lane), w.lw.openNative);
  assert.ok(lane && way, 'the lane and its way');
  const toGilane = lane.b.name === 'Gilane';
  const L = (toGilane ? way.pts : [...way.pts].reverse()).map((q) => [q.x / 40, q.z / 40]);
  let len = 0; for (let i = 1; i < L.length; i++) len += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]);
  // stood 3 km short of her port on her leg, her bow along it
  let s = len - 3000, start = null, yaw = 0;
  for (let i = 1; i < L.length && !start; i++) { const d = Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]); if (s <= d) { const k = s / d; start = [L[i - 1][0] + (L[i][0] - L[i - 1][0]) * k, L[i - 1][1] + (L[i][1] - L[i - 1][1]) * k]; yaw = Math.atan2(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]); } else s -= d; }
  const pk = packetsAt(lane, way, 0)[0];
  const h = await sea({ hull: null, settings: { ShipsAtSea: 'some' }, water: (x, z) => w.floats(x, z), seed: 7 });
  const to = toGilane ? lane.b : lane.a, from = toGilane ? lane.a : lane.b;
  const P0 = { id: `${pk.id}.g`, seed: pk.seed, seeds: pk.seeds, classId: pk.cls.id, region: -1, phase: 'sail', pos: [start[0], 0, start[1]], yaw, leg: L, port: null, to: { key: `port:${to.id}`, name: to.name }, from: { key: `port:${from.id}`, name: from.name } };
  h.view.feet = [start[0], 0, start[1]];
  h.host.liners([P0], { now: 0 });
  const e = [...h.host._sea.values()].find((x) => x.liner && !x.owner);
  assert.ok(e, 'stood');
  e.ship.yaw = yaw;
  let t = 0, turn = 0, last = e.ship.yaw, made = null;
  while (t < 1200 && made == null) {
    h.view.feet = [...e.ship.pos];
    h.host.liners([{ ...P0, pos: [...e.ship.pos], yaw: e.ship.yaw }], { now: t });
    for (let k = 0; k < 20; k++) { h.host.frame(0.1); const d = e.ship.yaw - last; turn += Math.atan2(Math.sin(d), Math.cos(d)); last = e.ship.yaw; }
    t += 2;
    if (pursue(L, e.ship.pos[0], e.ship.pos[2], 0).left <= LINER_PORT_M) made = t;
  }
  assert.ok(made != null, `at her port in ${made} s`);
  assert.ok(Math.abs(turn) < Math.PI, `no circle on the way in: ${Math.round((turn * 180) / Math.PI)} degrees`);
});

test('COAST-PORT (ARENA2): the coast\'s cities the lore never flagged are ports - Farrun, Shornhelm, Blacklight, Tear, Thorn, Elden Root and Silinorin, a village of Sumurset - and Ald\'ruhn, three pixels off the sea, is none; Anvil and Leyawiin stay inland on this picture (mutants: the ring unread; the lore\'s word alone)', { skip: realSkip }, async () => {
  const w = await realWorld();
  const { CITIES } = await import('../../../src/world/tamriel/tamrielGeography.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const lore = new Set(CITIES.filter((c) => c.port).map((c) => c.name));
  assert.deepEqual(arenaPixels().stood.filter((p) => p.port && !lore.has(p.name)).map((p) => p.name).sort(), ['Blacklight', 'Elden Root', 'Farrun', 'Shornhelm', 'Silinorin', 'Tear', 'Thorn']);
  const names = new Set(w.ports.map((p) => p.name));
  for (const n of ['Farrun', 'Shornhelm', 'Blacklight', 'Tear', 'Thorn', 'Elden Root', 'Silinorin']) assert.ok(names.has(n), `${n}: a port of the sea`);
  for (const n of ['Ald\'ruhn', 'Anvil', 'Leyawiin']) assert.ok(!names.has(n), `${n}: none`);
  assert.equal(w.ports.length, 36);
});
