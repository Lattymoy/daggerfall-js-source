// NIBEN-SEA (2026-10-26, the owner, with the lore map: "the ocean that connects to the imperial city is missing from our
// map" and "The port that connects to the imperial city should allow for AI/player ship voyages through this canal";
// bible/03-World/Tamriel.md NIBEN-SEA): Lake Rumare joined to the Topal Bay down the Niben on the trace (ui/tamrielTrace.js
// openNiben), the Imperial City's Waterfront cut through to its lake's arm at the Bay's scale (world/tamriel/tamrielLand.js
// waterfrontCanal), its harbour a port of the sea named for the city (world/tamrielCapitals.js, world/pastBayRows.js,
// world/worldWide/worldPorts.js), its packets' reach its own and their way off the canal (systems/naval/seaLanes.js,
// scenes/naval/worldLanes.js), and the Cyrodiil zone's rings kept by the province's own water (systems/wild/
// cyrodiilZone.js). Pinned on synthetic pictures, and on the player's own files where ARENA2_PATH names them.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NIBEN_COURSE, NIBEN_JOINS, nibenCells, openNiben, pieces } from '../../src/ui/tamrielTrace.js';
import { setTamrielTrace, waterfrontCanal, canalAt, provinceKeyAt, provinceKeyBeyondBay, IMPERIAL_ID } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, bayToPicture, pictureToBay } from '../../src/world/tamriel/tamrielFrame.js';
import { WATERFRONT_CANAL, CITIES } from '../../src/world/tamriel/tamrielGeography.js';
import { IMPERIAL_SPAN } from '../../src/world/imperialCity.js';
import { CAPITALS, capitalHarbourSlice, capitalCanalOpen, capitalCentre, capitalCentrePixel } from '../../src/world/tamrielCapitals.js';
import { tamrielHeightByte, tamrielClimateAt, dropGroundCache } from '../../src/world/tamriel/tamrielGround.js';
import { laneNetwork } from '../../src/systems/naval/seaLanes.js';
import { beyondLaneWay, beyondPathPx, BEYOND_LANE_MAX_PX, BEYOND_LANE_PATH_PX } from '../../src/scenes/naval/worldLanes.js';
import { beyondPorts, CANAL_PORT_REACH_PX } from '../../src/world/worldWide/worldPorts.js';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { provinceWaterAt, PROVINCE_WATER_REACH } from '../../src/systems/wild/cyrodiilZone.js';
import { CLIMATES, LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { NATIVE_PIXEL } from '../../src/systems/seaRaiders.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2, f)));
const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };   // the freeware's fit
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); });

/** A 320 x 200 trace, every pixel the Imperial Province's land but where `sea(x, y)` says water. */
function picture(sea) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!sea(x, y)) { land[y * w + x] = 1; province[y * w + x] = IMPERIAL_ID; }
  return { w, h, land, province };
}

/** A run's own cells, corner to corner. */
const runCells = (run) => {
  const out = [];
  for (let k = 0; k < run.length; k++) {
    const [ax, ay] = run[Math.max(0, k - 1)], [bx, by] = run[k];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) out.push([x, y]);
  }
  return out;
};

test('NIBEN-SEA the course: each run walked corner to corner along its rows and columns, every pixel once; each run beside a join (the picture\'s own water) or another run - three pieces with the picture\'s lakes between them (mutants: a run\'s corner skipped; the walk a corner short)', () => {
  const key = ([x, y]) => `${x},${y}`, cells = nibenCells(), set = new Set(cells.map(key));
  assert.equal(set.size, cells.length, 'each once');
  const runs = NIBEN_COURSE.map(runCells);
  for (const run of NIBEN_COURSE) for (let k = 1; k < run.length; k++) assert.ok(run[k - 1][0] === run[k][0] || run[k - 1][1] === run[k][1], 'a run is rows and columns');
  assert.deepEqual([...new Set(runs.flat().map(key))].sort(), [...set].sort(), 'every corner\'s leg walked');
  const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  runs.forEach((own, k) => {
    const others = runs.filter((_, j) => j !== k).flat();
    assert.ok(own.some((c) => NIBEN_JOINS.some((j) => near(c, j)) || others.some((o) => near(c, o))), `run ${k} joined`);
  });
  const w = 320, h = 200, m = new Uint8Array(w * h);
  for (const [x, y] of [...cells, ...NIBEN_JOINS]) m[y * w + x] = 1;
  assert.equal(pieces(m, w, h).length, 3, 'the city\'s arm, the arc and the outlet, the Lower Niben');
});

test('NIBEN-SEA the opening: on Daggerfall\'s own picture with every join water, the course\'s land opened - sea, of no province - and nothing else; a picture without a join, or of another size, left as it traced (mutants: the guard unread; the province kept)', () => {
  const joins = new Set(NIBEN_JOINS.map(([x, y]) => y * 320 + x));
  const t = picture((x, y) => joins.has(y * 320 + x));
  const before = t.land.reduce((a, v) => a + v, 0);
  assert.equal(openNiben(t.land, t.province, 320, 200), nibenCells().length);
  for (const [x, y] of nibenCells()) assert.ok(!t.land[y * 320 + x] && !t.province[y * 320 + x], `(${x}, ${y}) the sea's`);
  assert.equal(t.land.reduce((a, v) => a + v, 0), before - nibenCells().length, 'nothing else');
  assert.equal(openNiben(t.land, t.province, 320, 200), 0, 'opened once');
  const shut = picture((x, y) => joins.has(y * 320 + x) && !(x === NIBEN_JOINS[2][0] && y === NIBEN_JOINS[2][1]));
  assert.equal(openNiben(shut.land, shut.province, 320, 200), 0, 'a join land: another picture');
  const small = picture(() => false);
  assert.equal(openNiben(small.land, small.province, 160, 400), 0, 'another grid');
});

/** The freeware's fit over a picture whose water is every row from `row` down. */
function lakeBelow(row) {
  setTamrielTrace(picture((x, y) => y >= row));
  setTamrielFit(FIT);
}

test('NIBEN-SEA THE WATERFRONT CANAL: from the row past the Imperial City\'s span to the last before the trace\'s water, its middle column and one either side; null where the water meets the city\'s edge, where none is within reach, where its span is not all its province\'s land, and with no trace (mutants: the span unread; the reach unbounded; the edge\'s own water a canal)', () => {
  assert.equal(WATERFRONT_CANAL.span, IMPERIAL_SPAN, 'the city\'s own span');
  assert.equal(WATERFRONT_CANAL.city, CITIES.find((c) => c.name === 'Imperial City'), 'the Imperial City\'s');
  lakeBelow(100);   // the freeware's own: the city at (2069, 658), the picture's row 100 from Bay row 666
  const c = waterfrontCanal();
  assert.deepEqual([c?.x0, c?.x1, c?.y0, c?.y1], [2068, 2070, 662, 665]);
  for (let y = 660; y <= 667; y++) for (let x = 2066; x <= 2072; x++) {
    const inside = x >= 2068 && x <= 2070 && y >= 662 && y <= 665;
    assert.equal(canalAt(x, y), inside, `(${x}, ${y})`);
    if (y < 666) assert.equal(provinceKeyBeyondBay(x, y), inside ? null : 'Imperial', `(${x}, ${y}) the province's but on the canal`);
  }
  assert.equal(provinceKeyAt(...bayToPicture(2069.5, 663.5)), null, 'the picture point on it the sea');
  assert.equal(provinceKeyAt(...bayToPicture(2071.5, 663.5)), 'Imperial', 'the bank beside it the land\'s');
  // the ground and the climate: the sea's
  assert.equal(tamrielHeightByte(2069, 663), 0);
  assert.equal(tamrielClimateAt(2069, 663), CLIMATES.Ocean);
  assert.ok(tamrielHeightByte(2071, 663) > 0);
  lakeBelow(99);   // the city's own picture pixel water: its span is not all land
  assert.equal(waterfrontCanal(), null, 'no city to cut it to');
  // seven Bay pixels a picture pixel, the city's point a row's middle: its span's last row in the picture's row 99, the next
  // in row 100 - the water at its edge, nothing to cut; the water a row lower, the canal the row 100 under the span
  setTamrielTrace(picture((x, y) => y >= 100));
  setTamrielFit({ ox: 0, oy: 0, ppu: 7 });
  assert.equal(waterfrontCanal(), null, 'the water at its edge: nothing to cut');
  setTamrielTrace(picture((x, y) => y >= 101));
  const d = waterfrontCanal();
  assert.deepEqual([d?.x0, d?.x1, d?.y0, d?.y1], [1199, 1201, 700, 706], 'the canal the row\'s seven pixels under the span');
  setTamrielTrace(picture((x, y) => y >= 101 || (x === 171 && y === 99)));   // the city's own pixel water, the row under it land
  assert.equal(waterfrontCanal(), null, 'its span water: no city, no canal under it');
  lakeBelow(102);   // the water past the reach (picture row 102 from Bay row 697)
  assert.equal(waterfrontCanal(), null, `none within ${WATERFRONT_CANAL.reach}`);
  setTamrielTrace(null);
  assert.equal(waterfrontCanal(), null, 'no trace, no canal');
});

test('NIBEN-SEA THE CITY\'S HARBOUR: the Imperial City\'s port its Waterfront\'s slice, on its span\'s south edge - open where its canal meets it; every other capital\'s its centre, as before (mutants: the harbour the centre; the canal unasked)', () => {
  const ic = CAPITALS.findIndex((c) => c.key === 'imperial-city');
  const n = IMPERIAL_SPAN, r = (n - 1) / 2;
  assert.equal(capitalHarbourSlice(CAPITALS[ic]), (n - 1) * n + r, 'the bottom row\'s middle');
  for (const cap of CAPITALS.filter((c) => c.key !== 'imperial-city')) assert.equal(capitalHarbourSlice(cap), capitalCentre(cap), cap.name);
  lakeBelow(100);
  assert.deepEqual(capitalCentrePixel(ic), { px: 2069, py: 658 });
  assert.equal(capitalCanalOpen(ic), true);
  for (const k of CAPITALS.keys()) if (k !== ic) assert.equal(capitalCanalOpen(k), false, CAPITALS[k].name);
  lakeBelow(102);
  assert.equal(capitalCanalOpen(ic), false, 'no canal, no harbour of the sea');
});

test('NIBEN-SEA THE PORT: a capital\'s harbour named for its capital and running its packets CANAL_PORT_REACH_PX; a town\'s port its own name and the lanes\' reach (mutants: the name the slice\'s; the reach unset)', () => {
  lakeBelow(100);
  const places = createWorldPlaces();
  places.register('t', [
    { mapId: 1, name: 'Waterfront District', px: 2069, py: 661, type: LOCATION_TYPES.TownCity, port: true },
    { mapId: 2, name: 'Some Town', px: 2100, py: 667, type: LOCATION_TYPES.TownCity, port: true },
  ]);
  const ports = beyondPorts(places, (x, y) => canalAt(x, y) || y >= 666);
  assert.deepEqual(ports.map((p) => [p.name, p.reach ?? null]), [['Imperial City', CANAL_PORT_REACH_PX], ['Some Town', null]]);
  assert.ok(CANAL_PORT_REACH_PX > BEYOND_LANE_MAX_PX);
});

test('NIBEN-SEA THE LANES: a port\'s own reach links it past the lanes\' (each pair once); a way runs twice the farther reach of its two ends (mutants: the reach unread; the way\'s cap the lanes\')', () => {
  const open = () => true;
  const ports = [{ id: 1, px: 0, py: 0, reach: 1200 }, { id: 2, px: 900, py: 0 }, { id: 3, px: 1000, py: 0 }];
  assert.deepEqual(laneNetwork(ports, open, 400).map((l) => l.key), ['1-2', '1-3', '2-3']);
  assert.deepEqual(laneNetwork(ports.map(({ reach, ...p }) => p), open, 400).map((l) => l.key), ['2-3'], 'none past the lanes\' reach');
  assert.equal(beyondPathPx({ a: {}, b: {} }), BEYOND_LANE_PATH_PX);
  assert.equal(beyondPathPx({ a: { reach: 1200 }, b: {} }), 2400);
});

test('NIBEN-SEA A WAY OFF THE CANAL: a roadstead on the canal (land on the picture) puts out from the picture\'s sea beside it, the leg to it held by the world\'s water; none where that leg is land (mutants: the roadstead held to the picture; the leg unasked)', () => {
  lakeBelow(100);
  const sea = (x, y) => canalAt(x, y) || y >= 666;
  const native = (x, y) => sea(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(y / NATIVE_PIXEL));
  const lane = { a: { road: { x: 2069, y: 662 } }, b: { road: { x: 2069, y: 760 } } };
  const way = beyondLaneWay(lane, native);
  assert.ok(way, 'a way');
  const first = way.pts[0];
  assert.deepEqual([Math.round(first.x / NATIVE_PIXEL * 2) / 2, Math.round((500 - first.z / NATIVE_PIXEL) * 2) / 2], [2069.5, 662.5], 'from the roadstead itself');
  assert.equal(beyondLaneWay(lane, (x, y) => native(x, y) && !canalAt(Math.floor(x / NATIVE_PIXEL), 499 - Math.floor(y / NATIVE_PIXEL))), null, 'the canal dry: no way');
  assert.equal(beyondLaneWay({ a: { road: { x: 2080, y: 662 } }, b: lane.b }, native), null, 'a roadstead off both');
});

test('NIBEN-SEA THE ZONE\'S WATER: a water pixel with the Imperial Province\'s land its nearest on both sides of a row or a column is the province\'s; one with another province\'s on a side, or none within reach, is not; the canal is (mutants: one bank enough; another province\'s bank the province\'s)', () => {
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1), province = new Uint8Array(w * h).fill(IMPERIAL_ID);
  const wet = (x, y) => { land[y * w + x] = 0; province[y * w + x] = 0; };
  for (let y = 120; y < 130; y++) wet(150, y);   // a river between the province's banks
  for (let y = 120; y < h; y++) { wet(200, y); province[y * w + 199] = 7; }   // one between Elsweyr's and the province's, out to the picture's edge
  for (let y = 30; y < 70; y++) for (let x = 40; x < 80; x++) wet(x, y);   // a sea wider than the reach every way
  setTamrielTrace({ w, h, land, province });
  setTamrielFit(FIT);
  const at = (px, py) => pictureToBay(px + 0.5, py + 0.5).map(Math.floor);
  assert.equal(provinceWaterAt(...at(150, 125)), true, 'the river');
  assert.equal(provinceWaterAt(...at(200, 125)), false, 'the border river');
  assert.ok(20 > PROVINCE_WATER_REACH);
  assert.equal(provinceWaterAt(...at(60, 50)), false, 'the open sea');
  assert.equal(provinceWaterAt(...at(150, 100)), false, 'land is no water');
});

test('NIBEN-SEA (ARENA2): on the player\'s own picture the Niben joins Lake Rumare to the Topal Bay - Hammerfell\'s two lakes the only ones left; the Imperial City\'s Waterfront a port of the sea named for it, with a lane down the Niben to Senchal and a voyage from the Topal Bay landing at it', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../src/ui/overworldModel.js');
  const { createWorldPorts } = await import('../../src/world/worldWide/worldPorts.js');
  const { arenaPixels, pastBayLakeAt, pictureLakes } = await import('../../src/world/arenaPlaces.js');
  const { pastBayPlaceRows } = await import('../../src/world/pastBayRows.js');
  const { worldLaneWater } = await import('../../src/scenes/naval/worldLanes.js');
  const { planSeaLanes } = await import('../../src/systems/travel/travelRoute.js');
  const { WATER_BYTE } = await import('../../src/world/roadsProducer.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  setTamrielTrace(trace);
  setTamrielFit(FIT);
  const lakes = pictureLakes(trace);
  assert.equal(lakes.reduce((a, v) => a + v, 0), 35, 'Hammerfell\'s two (15 and 20)');
  for (const [x, y] of [[170, 95], [171, 104], [185, 120], [187, 140]]) assert.ok(!trace.land[y * trace.w + x] && !lakes[y * trace.w + x], `(${x}, ${y}) the sea's`);
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const ground = groundWoods(woods);
  const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
  const lw = worldLaneWater({ bayOpen: () => false, water, climateAt: (x, y) => tamrielClimateAt(x, y), beyond: () => true });
  const places = createWorldPlaces();
  places.register('tesa', pastBayPlaceRows({ pixels: arenaPixels(), templateOf: () => ({ exterior: { exteriorData: { width: 1, height: 1 } } }), capitals: true }));
  const ports = createWorldPorts({ places, openSea: (x, y) => water(x, y) && !pastBayLakeAt(x, y) }).list();
  const ic = ports.find((p) => p.name === 'Imperial City');
  assert.deepEqual([ic?.px, ic?.py, ic?.reach], [2069, 661, CANAL_PORT_REACH_PX], 'the Waterfront\'s slice');
  const lane = laneNetwork(ports, lw.open, BEYOND_LANE_MAX_PX).find((l) => [l.a.id, l.b.id].includes(ic.id) && [l.a.name, l.b.name].includes('Senchal'));
  assert.ok(lane, 'a lane to Senchal');
  const way = beyondLaneWay(lane, lw.openNative);
  assert.ok(way && way.len > 800_000, `down the Niben (${way ? Math.round(way.len / 1000) : 0} km)`);
  const voyage = planSeaLanes({ x: 2350, y: 1470 }, { x: ic.px, y: ic.py }, { isWater: (x, y) => ground.getHeightMapValue(x, y) <= WATER_BYTE, sea: { start: 'sea', voyage: true } });
  assert.ok(voyage, 'a voyage from the Topal Bay');
  assert.deepEqual(voyage.pixels.at(-1), { x: ic.px, y: ic.py }, 'ashore at the Waterfront');
});
