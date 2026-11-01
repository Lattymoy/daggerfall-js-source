// TESA5 (2026-10-12, the owner: "Do it" - "joining Arena's roads to the Bay's roads at its edge"; TESA5) - THE CROSSINGS, pinned. Where the Bay's own roads come to its edge and the land goes on past
// it (world/arenaRoads.js arenaJoins), a crossing: a gate a little past the edge that Arena's network takes as a road
// node, and the straight run from the Bay's road out to it - the run's Bay pixels the layer's `join`, the one part of it
// a pixel on the Bay reads (the painter, the verge); the host hands them over with the Bay's network.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join as pathJoin } from 'node:path';

import {
  JOIN_DEPTH, JOIN_SPACING, JOIN_OUT, arenaJoins, joinLayer, mergeArenaRoads, beyondKey,
  setArenaRoads, arenaRoadsLayer, arenaJoinByte, layerTouches, packArenaRoads, unpackArenaRoads,
} from '../src/world/arenaRoads.js';
import { buildTamrielRegion, regionLattice, regionOf } from '../src/world/tamrielRoads.js';   // The network past the Bay
import { MAP_W, MAP_H, DIR } from '../src/world/road/roadNetwork.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { roadRoom } from '../src/world/road/roadVerge.js';
import { TerrainGenClient } from '../src/world/terrain/terrainGenClient.js';
import { inBay } from '../src/world/tamriel/tamrielFrame.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js
import { bayRoads } from './bayRoads.mjs';   // The Bay's own network, off the player's ARENA2

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => setArenaRoads(null));
const { TownCity, TownVillage } = LOCATION_TYPES;
const keyXY = (k) => [(k % 65536) - 32768, Math.floor(k / 65536) - 32768];
const STEP = { [DIR.N]: [0, -1], [DIR.NE]: [1, -1], [DIR.E]: [1, 0], [DIR.SE]: [1, 1], [DIR.S]: [0, 1], [DIR.SW]: [-1, 1], [DIR.W]: [-1, 0], [DIR.NW]: [-1, -1] };
function walks(map, [ax, ay], [bx, by]) {
  const seen = new Set([beyondKey(ax, ay)]), stack = [[ax, ay]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x === bx && y === by) return true;
    const v = map.get(beyondKey(x, y)) ?? 0;
    for (const bit of Object.keys(STEP).map(Number)) if (v & bit) { const [dx, dy] = STEP[bit], k = beyondKey(x + dx, y + dy); if (!seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); } }
  }
  return false;
}
const blank = () => new Uint8Array(MAP_W * MAP_H);
function bayWith(points) {
  const roads = blank(), tracks = blank();
  for (const [x, y, v = DIR.E | DIR.W, kind = 'roads'] of points) (kind === 'roads' ? roads : tracks)[y * MAP_W + x] = v;
  return { roads, tracks };
}
const everywhere = () => true;

test('TESA5 the crossings: a Bay road within JOIN_DEPTH of an edge, one crossing a run of the edge (runs nearer than JOIN_SPACING one), at the road nearest the edge - of those the nearest the run\'s middle - its gate JOIN_OUT straight past it, on all four edges; never a track; none where the run crosses water (mutant: the depth, the spacing, the nearest, the middle, the gate\'s reach, the land)', () => {
  assert.deepEqual([JOIN_DEPTH, JOIN_SPACING, JOIN_OUT], [8, 12, 8]);
  const bay = bayWith([
    [300, 3], [310, 2],                                   // one run: the nearer road, at 310
    ...Array.from({ length: 41 }, (_, i) => [400 + i, 1]),   // a road along the edge, 400-440: its middle
    [500, 8],                                             // too deep
    [700, 0, DIR.N | DIR.S, 'tracks'],                    // a track: never a crossing
    [800, 1], [811, 1],                                   // 11 apart: one run (PIN MOVED, ROAD-GAPS: 59 at JOIN_SPACING 60)
    [823, 1],                                             // 12 past 811: its own
    [600, 497],                                           // the south edge
    [3, 100],                                             // the west edge
    [995, 200],                                           // the east edge
  ]);
  const joins = arenaJoins(bay, everywhere);
  assert.deepEqual(joins.map((j) => [j.side, j.meet, j.gate]), [
    ['N', [310, 2], [310, -8]], ['N', [420, 1], [420, -8]], ['N', [800, 1], [800, -8]], ['N', [823, 1], [823, -8]],
    ['S', [600, 497], [600, 507]],
    ['W', [3, 100], [-8, 100]],
    ['E', [995, 200], [1007, 200]],
  ]);
  assert.deepEqual(joins[0].run, [[310, 2], [310, 1], [310, 0], ...Array.from({ length: 8 }, (_, i) => [310, -1 - i])], 'the road, out to the edge, and on past it to the gate');
  assert.deepEqual(joins.find((j) => j.side === 'E').run.map(([x]) => x), [995, 996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]);
  // the land: a crossing whose run crosses water, past the Bay or on it, stands not
  const wet = arenaJoins(bay, (x, y) => !(x === 420 && y === -5) && !(x === 310 && y === 1));
  assert.deepEqual(wet.filter((j) => j.side === 'N').map((j) => j.meet[0]), [800, 823]);
});

test('TESA5 the drawing: a crossing\'s run - its Bay pixels the layer\'s join, the step on both ends of each; its pixels past the Bay the roads\'; no Bay pixel among the roads, none past it in the join (mutant: the join\'s keep, the run unstamped)', () => {
  const [j] = arenaJoins(bayWith([[310, 2]]), everywhere);
  const layer = joinLayer([j]);
  assert.deepEqual([...layer.join].map(([k, v]) => [...keyXY(k), v]).sort((a, b) => b[1] - a[1]), [[310, 2, DIR.N], [310, 1, DIR.N | DIR.S], [310, 0, DIR.N | DIR.S]]);
  assert.deepEqual([...layer.roads].map(([k, v]) => [...keyXY(k), v]).sort((a, b) => b[1] - a[1]), [
    ...Array.from({ length: 7 }, (_, i) => [310, -1 - i, DIR.N | DIR.S]), [310, -8, DIR.S],
  ]);
  assert.ok([...layer.roads.keys()].every((k) => !inBay(...keyXY(k))) && [...layer.join.keys()].every((k) => inBay(...keyXY(k))));
  assert.equal(joinLayer([]).join.size, 0, 'no crossings, no join');
});

test('TESA5 the network: a crossing\'s gate is a road node the network past the Bay reaches - a village standing on it first never takes it from the gate (a road node\'s pixel before a track node\'s) - and the Bay\'s road walks to the town past it (mutant: the grades\' order) - PIN MOVED (TESA14): the region\'s own network', () => {
  const [j] = arenaJoins(bayWith([[310, 2]]), everywhere);
  const nodes = [{ x: j.gate[0], y: j.gate[1], type: TownVillage }, { x: 310, y: -300, type: TownCity }, { x: j.gate[0], y: j.gate[1], type: TownCity }];
  const region = regionOf(regionLattice({ x0: 0, y0: -400, w: 800, h: 300 }), 0, 0);   // the town in its core, the gate in its apron
  const out = buildTamrielRegion({ region, places: [], nodes, obstacles: [], gates: [], heightAt: () => 30 });
  assert.deepEqual([out.stats.roadNodes, out.stats.trackNodes, out.stats.unrouted], [2, 0, 0], 'the gate takes its pixel; the village shares it');
  const layer = mergeArenaRoads(joinLayer([j]), out);
  assert.ok(walks(new Map([...layer.join, ...layer.roads]), [310, 2], [310, -300]), 'from the Bay\'s road to the town past the Bay');
});

/** A WoodsFile's reads over a flat buffer: land everywhere. */
class FlatWoods {
  constructor(v) { this.heightMapBuffer = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(v); this._bytes = new Uint8Array(77); }
  getHeightMapValue(x, y) {
    if (x < 0) x = 0; if (x >= MAP_WIDTH - 1) x = MAP_WIDTH - 1; if (y < 0) y = 0; if (y >= MAP_HEIGHT - 1) y = MAP_HEIGHT - 1;
    return this.heightMapBuffer[y * MAP_WIDTH + x];
  }
  getHeightMapValuesRange1Dim(x0, y0, dim) {
    const d = new Uint8Array(dim * dim);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y);
    return d;
  }
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
const bayNet = () => ({ roads: blank(), tracks: blank(), water: false, smooth: false });
const kernel = (woods, px, py) => generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: 302, roads: bayNet() });
const painted = (o) => o.paths.reduce((n, b) => n + (b ? 1 : 0), 0);
const joinBytes = (entries) => ({ roads: new Map(), tracks: new Map(), join: new Map(entries.map(([x, y, v]) => [beyondKey(x, y), v])) });

test('TESA5 the painter and the verge on the Bay: a Bay pixel paints its join byte and says so, its verge keeps the wild off it; a join byte under a key past the Bay is never read - there the roads\' alone (mutant: the join unread by the painter, by the verge, the flag)', () => {
  const w = new FlatWoods(20);
  setArenaRoads(joinBytes([[200, 100, DIR.N | DIR.S], [500, -30, DIR.N | DIR.S]]));
  assert.equal(arenaJoinByte(200, 100), DIR.N | DIR.S);
  const on = kernel(w, 200, 100);
  assert.ok(painted(on) > 0);
  assert.equal(on.arenaRoads, true);
  const off = kernel(w, 500, -30);
  assert.equal(painted(off), 0, 'past the Bay the join is not read');
  assert.equal(off.arenaRoads, false);
  const half = 819.2 / 2;
  assert.equal(roadRoom(bayNet(), 200, 100, half, half, 30), 0, 'the verge on the join\'s line');
  assert.equal(roadRoom(bayNet(), 500, -30, half, half, 30), 30, 'never past the Bay');
  setArenaRoads(null);
  const none = kernel(w, 200, 100);
  assert.deepEqual([painted(none), none.arenaRoads], [0, false]);
  assert.equal(roadRoom(bayNet(), 200, 100, half, half, 30), 30);
});

test('TESA5 the layer: its join packed and back whole, and a touch on a join pixel or beside it (mutant: the join unpacked, the touch blind to it)', () => {
  const layer = { roads: new Map([[beyondKey(5, -3), DIR.E]]), tracks: new Map(), join: new Map([[beyondKey(200, 0), DIR.N | DIR.S], [beyondKey(200, 1), DIR.N]]) };
  assert.deepEqual(unpackArenaRoads(packArenaRoads(layer)), layer);
  assert.ok(layerTouches(layer, 199, 1) && layerTouches(layer, 200, 0) && layerTouches(layer, 201, 0));
  assert.ok(!layerTouches(layer, 200, 2) && !layerTouches(layer, 202, 0));
});

test('TESA5 the client: the crossings\' layer goes in first, the layer reset - installed here and posted to the worker whole (mutant: the joins dropped on either arm) - PIN MOVED (TESA14): terrainGenClient.js addArenaRoads', () => {
  const [j] = arenaJoins(bayWith([[310, 2]]), everywhere);
  const c = new TerrainGenClient({ woods: new FlatWoods(30) });
  c.addArenaRoads(joinLayer([j]), null, { reset: true });
  assert.equal(arenaRoadsLayer().join.size, 3);
  const posted = [];
  const fake = { postMessage: (m) => posted.push(m), terminate() {}, onmessage: null, onerror: null };
  const d = new TerrainGenClient({ woods: new FlatWoods(30), woodsBytes: new Uint8Array(4), workerFactory: () => fake });
  d.addArenaRoads(joinLayer([j]), null, { reset: true });
  assert.equal(posted.at(-1).reset, true);
  assert.equal(unpackArenaRoads(posted.at(-1).layer).join.size, 3);
});

function syntheticWoods(W, H) {
  const offsetsStart = 32 + 28 * 4, cellsStart = offsetsStart + W * H * 4, heightMapOffset = cellsStart + 2 * (22 + 25);
  const bytes = new Uint8Array(heightMapOffset + W * H);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, W * H * 4, true); v.setUint32(4, W, true); v.setUint32(8, H, true); v.setUint32(16, cellsStart, true); v.setUint32(28, heightMapOffset, true);
  for (let i = 0; i < W * H; i++) v.setUint32(offsetsStart + i * 4, cellsStart, true);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bytes[heightMapOffset + y * W + x] = 60;
  return bytes;
}

test('TESA5 the worker: the crossings\' layer merged into the one it installs - a job on the Bay where a join runs paints it (mutant: the joins unread, unpacked)', async () => {
  const posted = [];
  const prevPost = globalThis.postMessage, prevOn = globalThis.onmessage;
  globalThis.postMessage = (msg) => posted.push(msg);
  try {
    await import('../src/world/terrain/terrainGenWorker.js');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: syntheticWoods(MAP_WIDTH, MAP_HEIGHT) } });
    globalThis.onmessage({ data: { t: 'roads', net: bayNet() } });
    const [j] = arenaJoins(bayWith([[310, 2]]), everywhere);
    globalThis.onmessage({ data: { t: 'arena-roads', epoch: 3, reset: true, layer: packArenaRoads(joinLayer([j])) } });
    globalThis.onmessage({ data: { t: 'job', px: 310, py: 1, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: 302 } });
    const done = posted.at(-1);
    assert.equal(done.t, 'done', done.message ?? '');
    assert.equal(done.arenaRoads, true, 'the Bay pixel paints its join');
    const none = () => packArenaRoads({ roads: new Map(), tracks: new Map(), join: new Map() });
    const job = () => { globalThis.onmessage({ data: { t: 'job', px: 310, py: 1, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: 302 } }); return posted.at(-1); };
    globalThis.onmessage({ data: { t: 'arena-roads', epoch: 4, reset: false, layer: none() } });
    assert.equal(job().arenaRoads, true, 'a region added: the join kept');
    globalThis.onmessage({ data: { t: 'arena-roads', epoch: 5, reset: true, layer: none() } });
    assert.equal(job().arenaRoads, false, 'reset: the join gone (TESA14)');
  } finally {
    globalThis.postMessage = prevPost;
    globalThis.onmessage = prevOn;
  }
});

test('TESA5 the host: the crossings found on the Bay\'s own network with the land\'s two laws, handed over with their gates as road towns once that network is known - never before it lands - and the stale law takes a Bay pixel a join reaches (mutant: the wait, the land, a gate\'s grade) - PIN MOVED (TESA14): scenes/tamrielRoadsHost.js', () => {
  const w = hostText('src/scenes/world.js'), host = read('src/scenes/tamrielRoadsHost.js');
  assert.match(w, /const arenaJoinLand = \(x, y\) => \(onTheBay\(x, y\) \? !isWaterPixel\(maps\.getClimateIndex\(x, y\), host\.woods\.getHeightMapValue\(x, y\)\) : host\.woods\.getHeightMapValue\(x, y\) > WATER_BYTE\);/, 'the Bay\'s water law on it, the beach line past it');
  assert.match(w, /createTamrielRoadsHost\(\{ terrainGen, woodsBytes, heightAt: \(x, y\) => host\.woods\.getHeightMapValue\(x, y\), joinLand: arenaJoinLand, onLanded: arenaRoadsLanded,/);
  assert.match(host, /const pixels = standing\.pixels\(\), bay = terrainGen\.roads\(\);/);
  assert.match(host, /if \(!pixels \|\| \(!bay && terrainGen\.hasRoads\)\) return;/, 'the Bay\'s network on its way: wait for it');
  assert.match(host, /const joins = forBay \? arenaJoins\(forBay, joinLand\) : \[\];/);
  assert.match(host, /\.\.\.joins\.map\(\(j\) => \(\{ x: j\.gate\[0\], y: j\.gate\[1\], type: LOCATION_TYPES\.TownCity \}\)\)\];/, 'a gate a road town');
  assert.match(host, /terrainGen\.addArenaRoads\(joinLayer\(joins\), onLanded, \{ reset: true \}\);/, 'the crossings first, the layer reset');
  assert.match(w, /const arenaRoadsStale = \(p, epoch, layer, reset = true\) => \(p\.arenaRoadsEpoch < epoch && /, 'a Bay pixel too');
  assert.match(read('src/world/terrain/terrainGen.js'), /const join = arena \? 0 : arenaJoinByte\(px, py\);/);
});

const ARENA2 = process.env.ARENA2_PATH;
const [JOINS_N, JOINS_S, JOINS_E, JOIN_PIXELS] = [13, 11, 5, 50];   // The Bay's own network's crossings
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(pathJoin(ARENA2, f)));
test('TESA5 with ARENA2: on the Bay\'s own network the crossings - north, south and east, none west (the Eltheric) - PIN MOVED (OWN-WORK2): fourteen and 47 join pixels on Basic Roads\' retired arrays; PIN MOVED (ROAD-GAPS): seven and 19 at JOIN_SPACING 60', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../src/world/tamriel/tamrielFrame.js');
  const { arenaPixels } = await import('../src/world/arenaPlaces.js');
  const { arenaRoadTowns } = await import('../src/world/arenaLocations.js');
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { groundWoods } = await import('../src/world/tamriel/tamrielGround.js');
  const { WATER_BYTE } = await import('../src/world/roadsProducer.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { isWaterPixel } = await import('../src/ui/overworldModel.js');
  const bytes = (n) => new Uint8Array(readFileSync(pathJoin(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const g = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    const bay = bayRoads();
    const land = (x, y) => (inBay(x, y) ? !isWaterPixel(maps.getClimateIndex(x, y), g.getHeightMapValue(x, y)) : g.getHeightMapValue(x, y) > WATER_BYTE);
    const joins = arenaJoins(bay, land);
    const sides = joins.map((j) => j.side);
    assert.deepEqual([sides.filter((t) => t === 'N').length, sides.filter((t) => t === 'S').length, sides.filter((t) => t === 'E').length, sides.filter((t) => t === 'W').length], [JOINS_N, JOINS_S, JOINS_E, 0], 'measured 2026-10-31');
    assert.equal(joinLayer(joins).join.size, JOIN_PIXELS);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
