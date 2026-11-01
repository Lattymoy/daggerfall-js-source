// TESA4 (2026-10-12, the owner: "Continue"; bible/03-World/Arena-Provinces.md TESA4) - THE ROADS PAST THE BAY'S LAYER,
// pinned: the grade is the clone's (world/arenaLocations.js arenaRoadTowns), the layer a pixel's byte by its key
// (world/arenaRoads.js), the painter and the verge read it off the Bay (terrainGen.js, roadVerge.js roadRoom), and the
// world host paints a built pixel again when a layer lands. RETIRED by TESA14 (test/tesa14_roads.test.js): TESA4's window
// (a cell of five Bay pixels), its drawing centre to centre, its network, its cache's key, the client's and the worker's
// build of it - the roads past the Bay are laid a region at a time at the Bay's own scale now.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  beyondKey, setArenaRoads, arenaRoadsLayer, arenaRoadsVersion, layerByte, arenaRoadByte, arenaRoadCorners,
  arenaPathsAt, layerTouches, packArenaRoads, unpackArenaRoads,
} from '../src/world/arenaRoads.js';
import { arenaRoadTowns } from '../src/world/arenaLocations.js';
import { MAP_W, MAP_H, DIR, ROAD_TYPES, TRACK_TYPES } from '../src/world/road/roadNetwork.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { roadRoom } from '../src/world/road/roadVerge.js';
import { setTamrielFit, inBay } from '../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setArenaRoads(null); setTamrielFit(null); setTamrielTrace(null); });

const { TownCity, TownHamlet, TownVillage } = LOCATION_TYPES;
const keyXY = (k) => [(k % 65536) - 32768, Math.floor(k / 65536) - 32768];
const OPP = { [DIR.N]: DIR.S, [DIR.NE]: DIR.SW, [DIR.E]: DIR.W, [DIR.SE]: DIR.NW, [DIR.S]: DIR.N, [DIR.SW]: DIR.NE, [DIR.W]: DIR.E, [DIR.NW]: DIR.SE };
const STEP = { [DIR.N]: [0, -1], [DIR.NE]: [1, -1], [DIR.E]: [1, 0], [DIR.SE]: [1, 1], [DIR.S]: [0, 1], [DIR.SW]: [-1, 1], [DIR.W]: [-1, 0], [DIR.NW]: [-1, -1] };
const flat = (h) => ({ heightAt: () => h, isWater: () => false });

test('TESA4 the grade, the clone\'s: a city-state and a town are road nodes, a village a track node, a dungeon none, each at its own pixel; none stood is none (mutant: a grade, the type read)', () => {
  const pixels = { stood: [
    { kind: 'city-state', bx: 10, by: -5 }, { kind: 'town', bx: 20, by: -6 }, { kind: 'village', bx: 30, by: -7 },
    { kind: 'staff-dungeon', bx: 40, by: -8 }, { kind: 'map-dungeon', bx: 50, by: -9 }, { kind: 'dungeon', bx: 60, by: -10 },
  ] };
  assert.deepEqual(arenaRoadTowns(pixels), [{ x: 10, y: -5, type: TownCity }, { x: 20, y: -6, type: TownHamlet }, { x: 30, y: -7, type: TownVillage }]);
  assert.ok(ROAD_TYPES.has(TownCity) && ROAD_TYPES.has(TownHamlet) && TRACK_TYPES.has(TownVillage), 'the network\'s own grades');
  assert.equal(arenaRoadTowns(null), null);
  assert.equal(arenaRoadTowns({ stood: [{ kind: 'staff-dungeon', bx: 1, by: -1 }] }), null, 'a dungeon has no road: none to build');
});

test('TESA4 the layer installed: a pixel\'s byte by its key, its corners as the mod\'s (the east neighbour\'s SW|NW, the west\'s NE|SE), roads and tracks together, a touch on the pixel or the two beside it, the version on every install; packed and back whole (mutant: a corner, the touch\'s reach, the version)', () => {
  assert.notEqual(beyondKey(-1, 0), beyondKey(0, -1));
  assert.deepEqual(keyXY(beyondKey(-32768, 32767)), [-32768, 32767]);
  const layer = { roads: new Map([[beyondKey(5, -3), DIR.E | DIR.W], [beyondKey(6, -3), DIR.SW | DIR.NW | DIR.SE]]), tracks: new Map([[beyondKey(4, -3), DIR.NE | DIR.SE | DIR.N]]) };
  const v = arenaRoadsVersion();
  setArenaRoads(layer);
  assert.equal(arenaRoadsVersion(), v + 1);
  assert.equal(arenaRoadsLayer(), layer);
  assert.equal(arenaRoadByte('roads', 5, -3), DIR.E | DIR.W);
  assert.equal(arenaRoadByte('roads', 5, -2), 0);
  assert.equal(arenaRoadCorners('roads', 5, -3), DIR.SW | DIR.NW, 'the east neighbour\'s SW|NW, never its SE');
  assert.equal(arenaRoadCorners('tracks', 5, -3), DIR.NE | DIR.SE, 'the west neighbour\'s NE|SE, never its N');
  assert.equal(arenaPathsAt(4, -3), DIR.NE | DIR.SE | DIR.N);
  assert.equal(arenaPathsAt(5, -3), DIR.E | DIR.W);
  assert.equal(layerByte(layer, 'tracks', 4, -3), DIR.NE | DIR.SE | DIR.N);
  assert.equal(layerByte(null, 'roads', 5, -3), 0);
  assert.ok(layerTouches(layer, 3, -3) && layerTouches(layer, 7, -3) && layerTouches(layer, 5, -3));
  assert.ok(!layerTouches(layer, 2, -3) && !layerTouches(layer, 8, -3) && !layerTouches(layer, 5, -2) && !layerTouches(layer, 5, -4), 'its row alone - the corners read east and west');
  assert.ok(!layerTouches(null, 5, -3));
  setArenaRoads(null);
  assert.equal(arenaRoadByte('roads', 5, -3), 0);
  assert.equal(arenaRoadsVersion(), v + 2);
  const packed = packArenaRoads(layer);
  assert.ok(packed.keys instanceof Float64Array && packed.keys.length === 3);
  assert.deepEqual(unpackArenaRoads(packed), { ...layer, join: new Map() }, 'TESA5: and an empty join');
});

/** A WoodsFile's reads over a flat buffer (test/roadbeyond.test.js FlatWoods): land everywhere. */
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
const bayNet = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H), water: false, smooth: false });
const kernel = (woods, px, py, roads = bayNet()) => generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: 302, roads });
const painted = (o) => o.paths.reduce((n, b) => n + (b ? 1 : 0), 0);


test('TESA4 the painter: past the Bay - east, west, north and south of it - a pixel paints its Arena road, its track and the corner its neighbour\'s diagonal brushes, and says so; a Bay pixel never reads the layer; without one, nothing (mutant: the Bay test, a byte, a corner, the flag)', () => {
  const w = new FlatWoods(20);
  const mk = (kind, entries) => ({ roads: new Map(), tracks: new Map(), [kind]: new Map(entries.map(([x, y, v]) => [beyondKey(x, y), v])) });
  for (const [x, y] of [[1200, 10], [-30, 300], [500, -30], [500, 530]]) {
    setArenaRoads(mk('roads', [[x, y, DIR.N | DIR.S]]));
    const o = kernel(w, x, y);
    assert.ok(painted(o) > 0, `(${x}, ${y}) paints its road`);
    assert.equal(o.arenaRoads, true);
    setArenaRoads(mk('tracks', [[x, y, DIR.E | DIR.W]]));
    assert.ok(painted(kernel(w, x, y)) > 0, `(${x}, ${y}) paints its track`);
    setArenaRoads(mk('roads', [[x + 1, y, DIR.SW]]));
    const c = kernel(w, x, y);
    assert.ok(painted(c) > 0 && c.arenaRoads, `(${x}, ${y}) paints the corner its east neighbour's diagonal brushes`);
    setArenaRoads(mk('roads', [[x - 1, y, DIR.SE]]));
    assert.ok(painted(kernel(w, x, y)) > 0, `(${x}, ${y}) and its west neighbour's`);
    setArenaRoads(null);
    const none = kernel(w, x, y);
    assert.equal(painted(none), 0);
    assert.equal(none.arenaRoads, false);
  }
  // the Bay's own pixel: a byte under its key is never read - its network is its own
  setArenaRoads(mk('roads', [[200, 100, DIR.N | DIR.S], [201, 100, DIR.SW], [199, 100, DIR.SE]]));
  const bay = kernel(w, 200, 100);
  assert.equal(painted(bay), 0);
  assert.equal(bay.arenaRoads, false);
  const own = bayNet(); own.roads[100 * MAP_W + 200] = DIR.N | DIR.S;
  assert.ok(painted(kernel(w, 200, 100, own)) > 0, 'its own network paints');
});

test('TESA4 the verge: a pixel off the Bay asks Arena\'s layer for the band beside it - on its line no room, beside it some, without a layer all of it; a Bay pixel asks the Bay\'s network alone (mutant: the map test, the layer unasked)', () => {
  const PIXEL_M = 819.2, half = PIXEL_M / 2;
  const net = bayNet();
  setArenaRoads({ roads: new Map([[beyondKey(500, -30), DIR.E | DIR.W]]), tracks: new Map() });
  assert.equal(roadRoom(net, 500, -30, half, half, 30), 0, 'on the road');
  const beside = roadRoom(net, 500, -30, half, half + 20, 30);
  assert.ok(beside > 0 && beside < 30, `beside it: ${beside}`);
  assert.ok(roadRoom(net, 501, -30, 5, half, 30) < 30, 'from the next pixel east, the band its arm reaches');
  setArenaRoads(null);
  assert.equal(roadRoom(net, 500, -30, half, half, 30), 30, 'no layer, no band');
  // the Bay: its network's byte answers, a layer byte under its key does not
  setArenaRoads({ roads: new Map([[beyondKey(200, 100), DIR.E | DIR.W]]), tracks: new Map() });
  assert.equal(roadRoom(net, 200, 100, half, half, 30), 30);
  net.roads[100 * MAP_W + 200] = DIR.E | DIR.W;
  assert.equal(roadRoom(net, 200, 100, half, half, 30), 0);
});

function memStore(seed = new Map()) {
  const mem = seed, sets = [];
  return { mem, sets, get: async (k) => mem.get(k) ?? null, set: async (k, v) => { sets.push(k); mem.set(k, v); return true; } };
}
const TOWNS = [{ x: 100, y: -300, type: TownCity }, { x: 400, y: -300, type: TownCity }];

test('TESA4 the host: each pixel keeps the epoch its job was posted under and whether the roads past the Bay reached it; a landing marks every built pixel posted earlier that the new layer reaches - its paint as well when the layer was reset - a pixel in flight as it publishes, and the sweep builds them again (mutant: the epoch\'s capture, the stale law, the sweep) - PIN MOVED (TESA14): the hand-over is scenes/tamrielRoadsHost.js\'s (test/tesa14_roads.test.js)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /if \(_tamrielRoads\) _tamrielRoads\.frame\(state\.current\);[^\n]*\n\s+if \(_arenaTemplates && !building\) sweepArenaPixels\(\);/, 'on the frame, building or not: the build is the workers\'');
  assert.match(w, /const arenaRoadsAt = terrainGen\.arenaRoadsEpoch;[^\n]*\n\s+const \{ [^}]*, arenaRoads, bridges, meets, settlement \} = await terrainGen\.generate\(\{/, 'the epoch read as the job is posted');   // PIN MOVED (ROAD-LOOK): the pixel's bridges answered beside its roads; PIN MOVED (FB1029 ACROSS-EDGE): and the meets its ground took
  assert.match(w, /arenaSlot: dfLocation\?\.arena \?\? null,\n\s+arenaRoadsEpoch: arenaRoadsAt, arenaRoadsPainted: !!arenaRoads,/);
  // PIN MOVED (ROAD-FOLLOW, 03-World/Town-Shapes.md ROAD-FOLLOW): and a pixel whose walled town's wall waited for its roads, once they are known (townWallReadyAt)
  assert.match(w, /const arenaRoadsStale = \(p, epoch, layer, reset = true\) => \(p\.arenaRoadsEpoch < epoch && \(\(reset && p\.arenaRoadsPainted\) \|\| layerTouches\(layer, p\.px, p\.py\)\)\) \|\| townWallReadyAt\(p\.px, p\.py\);/, 'PIN MOVED (TESA14): a region\'s landing repaints what it reaches; a reset what any roads painted too');
  assert.match(w, /function arenaRoadsLanded\(epoch, layer, reset = false\) \{\n\s+for \(const \[k, p\] of host\.built\) if \(arenaRoadsStale\(p, epoch, layer, reset\)\) _arenaRoadsStale\.add\(k\);/);
  assert.match(w, /if \(built\.has\(pkey\) && arenaRoadsStale\(built\.get\(pkey\), terrainGen\.arenaRoadsLanded, arenaRoadsLayer\(\)\)\) _arenaRoadsStale\.add\(pkey\);/, 'a pixel in flight, as it publishes');   // PIN MOVED (IC-SWAP-BEHIND): the pixel's own key
  const fn = w.slice(w.indexOf('  function sweepArenaRoads() {'), w.indexOf('\n  }\n', w.indexOf('  function sweepArenaRoads() {')) + 4);   // PIN MOVED (HOST-SPLIT, at the merge of main): the sweeps are scenes/tamrielSweepsHost.js's - the function's own end, read whole
  assert.match(fn, /if \(p\) \{ again\.push\(\{ px: p\.px, py: p\.py \}\); _arenaRoadsStale\.delete\(k\); \}\n\s+else if \(!host\.inFlight\.has\(k\)\) _arenaRoadsStale\.delete\(k\);/);
  assert.match(fn, /if \(!again\.length\) return;\n\s+swap\.rebuild\(again\);/);   // PIN MOVED (IC-SWAP-BEHIND): built again behind its view (scenes/swapBehind.js rebuild)
  assert.match(w, /if \(_arenaRoadsStale\.size && !building\) sweepArenaRoads\(\);/);
  assert.match(w, /setArenaStanding\(arenaStands\);\n\s+setArenaRoads\(null\);/, 'a mount starts with none on this thread');
  // the kernel and the verge read it off the Bay
  assert.match(read('src/world/terrain/terrainGen.js'), /const arena = !inBay\(px, py\);/);
  assert.match(read('src/world/road/roadBand.js'), /const onMap = mx >= 0 && my >= 0 && mx < MAP_W && my < MAP_H;\n\s*\/\/ VOYAGER2: past the Bay the band is the curves' \(world\/road\/roadCurves\.js\) - its roads' and its tracks' each\n\s*if \(!onMap\) \{\n\s*const r = arenaRoadByte\('roads', mx, my\),\n\s*t = arenaRoadByte\('tracks', mx, my\);\n\s*if \(!r && !t\) continue;\n\s*const tx = \(x - ix \* PIXEL_M\) \/ TILE_M,\n\s*tz = \(z - iz \* PIXEL_M\) \/ TILE_M; \/\/ the point in that pixel's tile frame\n\s*const d =\n\s*Math\.min\(r \? curveDistance\(r, tx, tz\) : Infinity, t \? curveDistance\(t, tx, tz\) : Infinity\) \* TILE_M -\n\s*PATH_HALF_M;\n\s*if \(d < room\) room = Math\.max\(0, d\);\n\s*continue;\n\s*\}\n\s*const bits = pathsDataPoint\(net, mx, my\) \| arenaJoinByte\(mx, my\);/, 'PIN MOVED (TESA5): and the join on the Bay - PIN MOVED (JUNGLE-ROADSIDE, at the merge of main): the band is world/road/roadBand.js\'s - PIN MOVED (VOYAGER2): past the Bay its roads\' and tracks\' curves');
});
