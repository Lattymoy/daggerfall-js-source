// TESA15 (2026-10-24; the owner, of the held map past the Bay against the network's own picture: "I think the map itself
// ingame doesnt match the image you just sent me. Like the fidelity of it", then "You make the best decision. No band
// aids"; bible/03-World/Arena-Provinces.md TESA15) - THE MAP PAST THE BAY AT THE WORLD'S FIDELITY, pinned. One roll: a
// region's places in its answer, kept a bin at a time and read by the map whole (world/pastBayPlaces.js), none on an
// Arena place's or a capital's pixel and an Arena dungeon routed round. The roads' ink a tile at a time, made again only
// where an install moved it (world/arenaRoads.js arenaRoadTiles, ui/tamrielInk.js arenaRoadInkAt). The paint kept on tiles
// at the view's level (ui/tamrielTiles.js), painted again where its word or its key moved, under a frame's budget. The
// tracks a hair at far. The window's and the world's wiring. Synthetic layers, places and canvases.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  setArenaRoads, arenaRoadTiles, arenaRoadTilePixels, arenaRoadsVersion, roadTileKey, roadTileOfKey, beyondKey, ROAD_TILE,
} from '../src/world/arenaRoads.js';
import {
  resetPastBayPlaces, addPastBayPlaces, pastBayPlacesIn, pastBayPlacesStamp, pastBayPlacesVersion, packPastBayPlaces, unpackPastBayPlaces,
} from '../src/world/pastBayPlaces.js';
import { arenaRoadInkAt, arenaRoadsIn, arenaRoadInk, arenaRoadSteps, pastBayStamp, paintPastBay, MARK_REACH_PX, DOTS_BELOW } from '../src/ui/tamrielInk.js';
import { createTamrielTiles, levelOf, TILE_PX, LEVEL_STEPS, TILES_KEPT, TILE_BUDGET_MS } from '../src/ui/tamrielTiles.js';
import { buildTamrielRegion, regionLattice, regionOf } from '../src/world/tamrielRoads.js';
import { createRoadsWorkerState } from '../src/world/tamrielRoadsWorker.js';
import { createTamrielRoadsHost } from '../src/scenes/tamrielRoadsHost.js';
import { TerrainGenClient } from '../src/world/terrain/terrainGenClient.js';
import { DIR } from '../src/world/road/roadNetwork.js';
import { toPaper, FAR_TRACK_PEN } from '../src/ui/ink/inkMap.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { rollSpec } from '../src/world/tamrielRoads.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const T = LOCATION_TYPES;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setArenaRoads(null); resetPastBayPlaces(); });
/** A road east-west from x0 to x1 along y. */
function run(map, x0, x1, y) {
  for (let x = x0; x <= x1; x++) map.set(beyondKey(x, y), (x > x0 ? DIR.W : 0) | (x < x1 ? DIR.E : 0));
  return map;
}
const layerOf = (runs) => { const l = { roads: new Map(), tracks: new Map(), join: new Map() }; for (const [k, x0, x1, y] of runs) run(l[k], x0, x1, y); return l; };

// ── THE ROADS' INK, A TILE AT A TIME ────────────────────────────

test('TESA15 the layer\'s tiles: a whole install stamps every tile holding a pixel; an add merged into the installed layer moves only the tiles it touches; another layer, or none, every tile (mutant: the add unread, the merge unchecked)', () => {
  assert.equal(ROAD_TILE, 64);
  assert.equal(roadTileOfKey(beyondKey(-1, -1)), roadTileKey(-1, -1), 'either side of nought');
  assert.equal(roadTileOfKey(beyondKey(64, 0)), roadTileKey(1, 0));
  const layer = layerOf([['roads', 10, 20, -30], ['tracks', 200, 210, -30]]);
  setArenaRoads(layer);
  const v1 = arenaRoadsVersion();
  assert.deepEqual([...arenaRoadTiles()].sort(), [[roadTileKey(0, -1), v1], [roadTileKey(3, -1), v1]].sort());
  const add = { roads: run(new Map(), 300, 310, -100), tracks: new Map() };
  for (const [k, b] of add.roads) layer.roads.set(k, b);
  setArenaRoads(layer, add);
  const v2 = arenaRoadsVersion();
  assert.equal(arenaRoadTiles().get(roadTileKey(0, -1)), v1, 'a tile the add misses keeps its stamp');
  assert.equal(arenaRoadTiles().get(roadTileKey(4, -2)), v2, 'the add\'s own tile, stamped');
  setArenaRoads({ ...layer }, add);
  assert.equal(arenaRoadTiles().get(roadTileKey(0, -1)), arenaRoadsVersion(), 'another layer: every tile');
  // the first add into a layer works its tiles out whole, unasked - the map's first read walks nothing
  const fresh = layerOf([['roads', 10, 20, -30]]);
  setArenaRoads(fresh);
  for (const [k, b] of add.roads) fresh.roads.set(k, b);
  setArenaRoads(fresh, add);
  const first = arenaRoadsVersion();
  const later = { roads: run(new Map(), 600, 601, -100), tracks: new Map() };
  for (const [k, b] of later.roads) fresh.roads.set(k, b);
  setArenaRoads(fresh, later);
  assert.equal(arenaRoadTilePixels(0, -1).size, 11, 'the tile the adds missed, its pixels with it');
  assert.deepEqual([arenaRoadTiles().get(roadTileKey(0, -1)), arenaRoadTiles().get(roadTileKey(9, -2))], [first, arenaRoadsVersion()], 'stamped by the first add, kept through the second');
  setArenaRoads(null);
  assert.equal(arenaRoadTiles().size, 0, 'none');
});

test('TESA15 the roads\' ink a tile at a time: each tile walked once and kept while its stamp stands - an add re-inks the tiles it reaches and no other; a rectangle\'s chains its tiles\' and its rim\'s; the whole layer\'s every tile\'s (mutant: the stamp unread, the rim)', () => {
  const layer = layerOf([['roads', 10, 20, -30], ['roads', 200, 210, -30]]);
  setArenaRoads(layer);
  const a = arenaRoadInkAt(0, -1), b = arenaRoadInkAt(3, -1);
  assert.equal(a.roads.length, 1);
  assert.equal(arenaRoadInkAt(0, -1), a, 'kept');
  const add = { roads: run(new Map(), 195, 199, -30), tracks: new Map() };
  for (const [k, bits] of add.roads) layer.roads.set(k, (layer.roads.get(k) ?? 0) | bits);
  layer.roads.set(beyondKey(199, -30), layer.roads.get(beyondKey(199, -30)) | DIR.E);
  layer.roads.set(beyondKey(200, -30), layer.roads.get(beyondKey(200, -30)) | DIR.W);
  setArenaRoads(layer, add);
  assert.equal(arenaRoadInkAt(0, -1), a, 'the tile the add missed: its ink as it was');
  assert.notEqual(arenaRoadInkAt(3, -1), b, 'the add\'s: walked again');
  assert.deepEqual(arenaRoadInkAt(3, -1).roads.flat().map((p) => p.x).sort((p, q) => p - q).at(0), 195.5, 'the longer road');
  assert.deepEqual(arenaRoadInkAt(9, 9), { roads: [], tracks: [] }, 'a tile with none');
  assert.equal(arenaRoadsIn(64, -64, 127, -1).roads.length, 1, 'tile (1, -1) holds none, its rim\'s (0, -1) does');
  assert.equal(arenaRoadsIn(192, -64, 255, -1).roads.length, 1);
  const whole = arenaRoadInk(layer);
  assert.equal(whole.roads.length, 2, 'the whole layer: every tile\'s');
});

test('TESA15 the far view: the pixels\' steps as they lie, two-point chains centre to centre, each once - from the end it leaves east or south of, or the one end that holds it - a straight run one chain; the tiles\' own pixels kept with their stamps (mutant: the forward set, the one-sided step, the run, the pixels)', () => {
  const layer = { roads: new Map(), tracks: new Map(), join: new Map() };
  run(layer.roads, 10, 12, -30);   // two steps east
  layer.roads.set(beyondKey(12, -31), DIR.S); layer.roads.set(beyondKey(12, -30), layer.roads.get(beyondKey(12, -30)) | DIR.N);   // a step north
  layer.tracks.set(beyondKey(100, -30), DIR.W);   // one-sided, west: a gate's step into its city
  setArenaRoads(layer);
  assert.deepEqual([...arenaRoadTilePixels(0, -1)].sort((a, b) => a - b), [beyondKey(10, -30), beyondKey(11, -30), beyondKey(12, -31), beyondKey(12, -30)].sort((a, b) => a - b));
  const steps = arenaRoadSteps(0, -64, 127, -1);
  const seg = (c) => `${c[0].x},${c[0].y}>${c[1].x},${c[1].y}`;
  assert.deepEqual(steps.roads.map(seg).sort(), ['10.5,-29.5>12.5,-29.5', '12.5,-30.5>12.5,-29.5'].sort(), 'each step once, the run east one chain');
  assert.deepEqual(steps.tracks.map(seg), ['100.5,-29.5>99.5,-29.5'], 'the one-sided step, from the end that holds it');
  const add = { roads: run(new Map(), 300, 301, -100), tracks: new Map() };
  for (const [k, b] of add.roads) layer.roads.set(k, b);
  setArenaRoads(layer, add);
  assert.equal(arenaRoadTilePixels(4, -2).size, 2, 'an add\'s pixels with its tile');
  assert.equal(arenaRoadTilePixels(0, -1).size, 4);
  setArenaRoads(null);
  assert.deepEqual(arenaRoadSteps(0, -64, 127, -1), { roads: [], tracks: [] });
});

test('TESA15 the paint\'s word over a rectangle: the greatest road install and the greatest place add over its tiles and its rim - a landing far off moves no word (mutant: the rim, the places)', () => {
  setArenaRoads(layerOf([['roads', 10, 20, -30]]));
  const w = pastBayStamp(0, -64, 63, -1);
  assert.equal(pastBayStamp(0, -64, 63, -1), w);
  addPastBayPlaces([{ x: 2000, y: -900, type: T.HomeFarms }]);
  assert.equal(pastBayStamp(0, -64, 63, -1), w, 'a place far off');
  addPastBayPlaces([{ x: 70, y: -10, type: T.HomeFarms }]);
  assert.notEqual(pastBayStamp(0, -64, 63, -1), w, 'a place on the rim');
  const w2 = pastBayStamp(0, -64, 63, -1);
  const layer = layerOf([['roads', 10, 20, -30]]), add = { roads: run(new Map(), 130, 140, -30), tracks: new Map() };
  setArenaRoads(layer);
  const w3 = pastBayStamp(0, -64, 63, -1);
  assert.notEqual(w3, w2, 'a whole install');
  for (const [k, b] of add.roads) layer.roads.set(k, b);
  setArenaRoads(layer, add);
  assert.equal(pastBayStamp(0, -64, 63, -1), w3, 'an add two tiles off');
});

// ── ONE ROLL: THE REGIONS' PLACES ───────────────────────────────

test('TESA15 the places the regions laid: kept a bin at a time, read by a rectangle, each bin its last add\'s stamp; a reset none; packed and back either side of nought (mutant: the bin, the rectangle\'s edge)', () => {
  const v = pastBayPlacesVersion();
  addPastBayPlaces([{ x: -1, y: -1, type: T.HomeFarms }, { x: 63, y: -64, type: T.Tavern }, { x: 64, y: -64, type: T.TownVillage }]);
  assert.equal(pastBayPlacesVersion(), v + 1);
  assert.deepEqual(pastBayPlacesIn(-1, -64, 64, 0).map((p) => p.type).sort(), [T.HomeFarms, T.Tavern].sort(), 'x1 and y1 not in');
  assert.deepEqual(pastBayPlacesIn(64, -64, 65, -63), [{ x: 64, y: -64, type: T.TownVillage }]);
  assert.deepEqual(pastBayPlacesIn(-1, -64, 63, 0).map((p) => p.type), [T.HomeFarms], 'x1 not in, its bin read');
  assert.deepEqual(pastBayPlacesIn(5, 5, 5, 9), []);
  assert.equal(pastBayPlacesStamp(-1, -1), v + 1);
  assert.equal(pastBayPlacesStamp(5, 5), 0);
  resetPastBayPlaces();
  assert.deepEqual(pastBayPlacesIn(-100, -100, 100, 100), []);
  const places = [{ x: -862, y: 2500, type: T.HomeFarms }, { x: 4200, y: -3100, type: T.DungeonKeep }];
  assert.deepEqual(unpackPastBayPlaces(packPastBayPlaces(places)), places);
  assert.deepEqual(unpackPastBayPlaces(null), []);
});

test('TESA15 a region\'s places: the rolled ones its core holds, none on the Bay, an Arena place\'s or a capital\'s pixel - a gate\'s pixel the countryside may stand on; an Arena place that is no node is routed round; in one order (mutant: the core, the held, the order)', () => {
  const region = regionOf(regionLattice({ x0: 0, y0: -1000, w: 1600, h: 600 }), 0, 0);   // core x 0..800, y -1000..-700
  const lair = { x: 330, y: -900 };
  const places = [
    { x: 100, y: -900, type: T.HomeFarms }, { x: 790, y: -720, type: T.Tavern }, { x: 850, y: -900, type: T.HomeFarms },   // the last in the apron
    { x: 400, y: -850, type: T.HomeFarms },   // a capital's pixel
    { x: lair.x, y: lair.y, type: T.TownVillage },   // an Arena dungeon's
    { x: 600, y: -800, type: T.TownVillage },   // a gate's
  ];
  const out = buildTamrielRegion({
    region, places: [...places].reverse(), heightAt: () => 30,
    nodes: [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -900, type: T.TownCity }, { x: 600, y: -800, type: T.TownCity }],
    obstacles: [{ x: 400, y: -850 }], gates: [{ x: 600, y: -800, into: [1, 0] }], held: [lair],
  });
  assert.deepEqual(out.places, [
    { x: 100, y: -900, type: T.HomeFarms }, { x: 600, y: -800, type: T.TownVillage }, { x: 790, y: -720, type: T.Tavern },
  ], 'the core\'s, north then west, none on a capital\'s or an Arena place\'s pixel');
  assert.equal(out.roads.get(beyondKey(lair.x, lair.y)) ?? 0, 0, 'the road from (300, -900) to (360, -900) goes round the Arena dungeon');
  assert.ok(out.roads.size > 0);
});

test('TESA15 the roads\' worker answers a region\'s places beside its layer, packed; the host keeps them as each lands, before its roads, and resets them as a build starts, the held pixels in its inputs (mutant: the places unposted, the order, the reset)', async () => {
  const state = createRoadsWorkerState();
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 1600, h: 600 });
  const EMPTY = rollSpec({ countryRates: new Map(), countryTemplates: new Map(), lairRates: new Map(), lairTemplates: new Map(), lairPools: new Map() });
  const W = 1000, H = 500, offsetsStart = 32 + 28 * 4, cellsStart = offsetsStart + W * H * 4, hm = cellsStart + 2 * (22 + 25);
  const bytes = new Uint8Array(hm + W * H), dv = new DataView(bytes.buffer);
  dv.setUint32(0, W * H * 4, true); dv.setUint32(4, W, true); dv.setUint32(8, H, true); dv.setUint32(16, cellsStart, true); dv.setUint32(28, hm, true);
  for (let i = 0; i < W * H; i++) dv.setUint32(offsetsStart + i * 4, cellsStart, true);
  const tw = 320, th = 200, landMask = new Uint8Array(tw * th).fill(1);   // all land but the picture's rim
  for (let x = 0; x < tw; x++) { landMask[x] = 0; landMask[(th - 1) * tw + x] = 0; }
  for (let y = 0; y < th; y++) { landMask[y * tw] = 0; landMask[y * tw + tw - 1] = 0; }
  const nodes = [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -900, type: T.TownCity }];
  const wall = Array.from({ length: 121 }, (_, k) => ({ x: 330, y: -960 + k }));   // Arena's places, a wall of them across the way
  state.handle({ t: 'init', woodsBytes: bytes, trace: { w: tw, h: th, land: landMask, province: new Uint8Array(tw * th).fill(3) }, fit: null, spec: EMPTY, nodes, obstacles: [], gates: [], held: wall, lattice }, () => {});
  let got = null;
  state.handle({ t: 'build', id: 1, i: 0, j: 0 }, (m, xfer) => { got = { m, xfer }; });
  assert.ok(got.m.places?.keys instanceof Float64Array && got.m.places.types instanceof Uint8Array, 'packed beside the layer');
  assert.ok(got.xfer.includes(got.m.places.keys.buffer), 'and handed over, not copied');
  const roads = new Map(); for (let i = 0; i < got.m.layer.keys.length; i++) if (got.m.layer.roads[i]) roads.set(got.m.layer.keys[i], got.m.layer.roads[i]);
  assert.ok(roads.size > 0 && wall.every((p) => !roads.has(beyondKey(p.x, p.y))), 'the held pixels routed round');

  const order = [], starts = [];
  const terrainGen = { addArenaRoads: (layer, on, o = {}) => order.push(o.reset ? 'reset' : `roads:${pastBayPlacesIn(-9999, -9999, 9999, 9999).length}`), roads: () => null, hasRoads: false };
  const client = { start: (o) => { starts.push(o); return Promise.resolve(); }, near() {}, pending: () => 0, dispose() {} };
  addPastBayPlaces([{ x: 5, y: -5, type: T.HomeFarms }]);
  const host = createTamrielRoadsHost({ terrainGen, woodsBytes: new Uint8Array(3), heightAt: () => 30, joinLand: () => false, onLanded() {}, client, log: { log() {}, warn() {} },
    standing: { pixels: () => ({ stood: [] }), towns: () => [], spec: () => EMPTY, capitals: () => false, held: () => [{ x: 7, y: -7 }] } });
  host.frame(null);
  assert.deepEqual(pastBayPlacesIn(-9999, -9999, 9999, 9999), [], 'a build starting: none');
  assert.deepEqual(starts[0].inputs.held, [{ x: 7, y: -7 }], 'the held pixels in its inputs');
  starts[0].onRegion(starts[0].regions[0], { roads: new Map(), tracks: new Map() }, { cached: true }, [{ x: 1, y: -1, type: T.Tavern }, { x: 2, y: -1, type: T.Tavern }]);
  assert.deepEqual(order, ['reset', 'roads:2'], 'the places kept before the roads go on');
});

test('TESA15 the roads\' client hands a built region\'s places on and keeps them with its layer (mutant: the answer\'s places dropped)', async () => {
  const { createTamrielRoadsClient } = await import('../src/world/tamrielRoadsClient.js');
  const { packArenaRoads } = await import('../src/world/arenaRoads.js');
  let w = null;
  const client = createTamrielRoadsClient({ makeWorker: () => (w = { onmessage: null, onerror: null, terminate() {}, posted: [], postMessage(m) { this.posted.push(m); } }), workers: 1, store: null });
  const got = [];
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 800, h: 300 });
  await client.start({ inputs: {}, print: 'p', regions: [regionOf(lattice, 0, 0)], onRegion: (r, layer, stats, places) => got.push(places) });
  const ask = w.posted.find((m) => m.t === 'build');
  const places = [{ x: 3, y: -900, type: T.HomeFarms }];
  w.onmessage({ data: { t: 'region', id: ask.id, i: 0, j: 0, layer: packArenaRoads({ roads: new Map(), tracks: new Map(), join: new Map() }), places: packPastBayPlaces(places), stats: {}, ms: 1 } });
  assert.deepEqual(got, [places]);
  client.dispose();
});

test('TESA15 the terrain client: a region\'s add moves only the tiles it reaches; a reset, every one (mutant: the add not handed to the install)', () => {
  const c = new TerrainGenClient({ woods: null });
  c.addArenaRoads({ roads: run(new Map(), 10, 20, -30), tracks: new Map() }, null, { reset: true });
  const v = arenaRoadTiles().get(roadTileKey(0, -1));
  c.addArenaRoads({ roads: run(new Map(), 300, 310, -100), tracks: new Map() });
  assert.equal(arenaRoadTiles().get(roadTileKey(0, -1)), v, 'a tile far from the add');
  assert.equal(arenaRoadTiles().get(roadTileKey(4, -2)), arenaRoadsVersion());
  c.addArenaRoads(null, null, { reset: true });
  assert.equal(arenaRoadTiles().size, 0);
});

// ── THE KEPT TILES ──────────────────────────────────────────────

/** A canvas whose context records what is painted on it - and a sheet that records the tiles drawn on it. */
function fakeCanvas() {
  const calls = [];
  const c = { width: 0, height: 0, calls, getContext: () => ({ setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, drawImage: (...a) => calls.push(a) }) };
  return c;
}
function rig({ stampOf = () => 'w', clock = null, kept } = {}) {
  const painted = [];
  let t = 0;
  const tiles = createTamrielTiles({
    paint: (ctx, view, w, h, opts) => { painted.push({ view, w, h, opts }); if (clock) t += clock; },
    stamp: (x0, y0, x1, y1) => stampOf(x0, y0, x1, y1),
    make: fakeCanvas, now: () => t, ...(kept ? { kept } : {}),
  });
  const sheet = fakeCanvas().getContext();
  const drawn = [];
  sheet.drawImage = (...a) => drawn.push(a);
  return { tiles, painted, sheet, drawn };
}

test('TESA15 the tiles: a level a quarter of a doubling; a view\'s tiles painted at its level once and drawn after, edge to edge on whole device pixels; a tile\'s word or the paint\'s key moving paints it again and no other (mutant: the level, the word, the key, the snap)', () => {
  assert.deepEqual([TILE_PX, LEVEL_STEPS, TILES_KEPT, TILE_BUDGET_MS], [256, 4, 160, 8]);
  assert.equal(levelOf(1), 1);
  assert.equal(levelOf(2.1), 2);
  assert.ok(Math.abs(levelOf(1.2) - 2 ** 0.25) < 1e-12);
  assert.ok(Math.abs(levelOf(0.2) - 2 ** -2.25) < 1e-12);
  let moved = null;
  const r = rig({ stampOf: (x0, y0) => (moved && x0 === moved[0] && y0 === moved[1] ? 'moved' : 'w') });
  const view = { ox: 10, oy: -300, scale: 1 };
  const o = { paperW: 600, paperH: 300, dpr: 1, key: 'k', paint: { band: 'far' } };
  assert.equal(r.tiles.draw(r.sheet, view, o), false, 'nothing owed: one paints at the least, the clock never moves');
  const n = r.painted.length;
  assert.equal(n, 3 * 2, 'x 0..767 and y -512..-1 - the six tiles the view reaches');
  assert.deepEqual(r.painted[0].opts, { band: 'far' }, 'the paint\'s options through');
  assert.deepEqual([r.painted[0].w, r.painted[0].h, r.painted[0].view.scale], [256, 256, 1]);
  assert.equal(r.drawn.length, 6);
  for (const d of r.drawn) assert.ok(d.slice(1).every((v) => Number.isInteger(v)), 'on whole pixels');
  r.drawn.length = 0;
  r.tiles.draw(r.sheet, { ...view, ox: 12.3, oy: -300.7 }, o);
  assert.equal(r.painted.length, n, 'a pan: kept, drawn again');
  for (const d of r.drawn) assert.ok(d.slice(1).every((v) => Number.isInteger(v)), 'a pan off whole pixels: the tiles still on them');
  const xs = r.drawn.map((d) => [d[1], d[1] + d[3]]).sort((a, b) => a[0] - b[0]);
  assert.ok(xs.some((a, i) => i && a[0] === xs[i - 1][1]), 'a tile starts where its neighbour ends');
  moved = [256, -512];
  r.tiles.draw(r.sheet, view, o);
  assert.equal(r.painted.length, n + 1, 'the tile whose word moved, alone');
  assert.deepEqual([r.painted.at(-1).view.ox, r.painted.at(-1).view.oy], [256, -512]);
  r.tiles.draw(r.sheet, view, { ...o, key: 'other' });
  assert.equal(r.painted.length, n + 1 + 6, 'the key moved: all of them');
  const at2 = rig();
  at2.tiles.draw(at2.sheet, view, { ...o, dpr: 2 });
  assert.equal(at2.painted[0].w, 128, 'twice the pixels: a tile half the paper, the paint at its dpr');
});

test('TESA15 the tiles: a frame paints the tiles nearest the middle first until its budget is spent, one at the least; one owed shows its last paint, else a neighbouring level\'s, and says so once (mutant: the budget, the order, the stand-in, the flag)', () => {
  const r = rig({ clock: 5 });
  const view = { ox: 0, oy: -512, scale: 1 };
  const o = { paperW: 768, paperH: 512, dpr: 1, key: 'k' };
  assert.equal(r.tiles.draw(r.sheet, view, o), true, 'owed');
  assert.equal(r.painted.length, 2, 'five milliseconds a tile: two in eight');
  const mid = (p) => [p.view.ox + 128, p.view.oy + 128];
  assert.deepEqual(mid(r.painted[0]), [384, -384], 'the middle\'s tile first');
  assert.equal(r.tiles.takePending(), true);
  assert.equal(r.tiles.takePending(), false, 'said once');
  for (let k = 0; k < 5; k++) r.tiles.draw(r.sheet, view, o);
  assert.equal(r.painted.length, 6, 'the rest over the next frames');
  r.tiles.takePending();
  r.tiles.draw(r.sheet, view, o);
  assert.equal(r.tiles.takePending(), false, 'none owed');
  // the zoom a level in: nothing at it yet - what is drawn is the kept level, clipped to each tile owed
  r.drawn.length = 0;
  const zin = { ox: 0, oy: -512, scale: 2 ** 0.25 };
  const before = r.painted.length;
  r.tiles.draw(r.sheet, zin, { ...o, budgetMs: 0 });
  assert.equal(r.painted.length, before + 1, 'a spent budget paints one all the same');
  assert.ok(r.drawn.length > 1, 'the others stood in for by the level below');
  r.drawn.length = 0;
  const jump = r.painted.length;
  r.tiles.draw(r.sheet, { ox: 0, oy: -512, scale: 2 ** 1.75 }, { ...o, budgetMs: 0 });   // seven levels in
  assert.equal(r.painted.length, jump + 1);
  assert.ok(r.drawn.length > 1, 'a zoom\'s jump of seven levels stood in for too');

  const hold = rig({ clock: 5, kept: 4 });
  hold.tiles.draw(hold.sheet, view, o);
  for (let k = 0; k < 5; k++) hold.tiles.draw(hold.sheet, view, o);
  assert.equal(hold.tiles.kept(), 4, 'kept to its count, the one drawn longest ago let go');
  hold.tiles.clear();
  assert.equal(hold.tiles.kept(), 0);
});

test('TESA15 the tiles: where a canvas gives no 2D context the view is painted straight onto the sheet, as the window\'s kept layer is (mutant: the check)', () => {
  const painted = [];
  const tiles = createTamrielTiles({ paint: (ctx, view, w, h) => painted.push([ctx, view, w, h]), stamp: () => 'w', make: () => ({}) });
  const sheet = {};
  assert.equal(tiles.draw(sheet, { ox: 1, oy: 2, scale: 3 }, { paperW: 40, paperH: 50 }), false);
  assert.deepEqual(painted, [[sheet, { ox: 1, oy: 2, scale: 3 }, 40, 50]]);
});

test('TESA15 the painter: at far each pixel\'s steps, in to the Bay\'s scale the walked chains; a mark whose glyph reaches the view from just outside it is painted too, so a tile\'s edge cuts no glyph (mutant: the band\'s choice, the pad)', () => {
  const layer = { roads: run(new Map(), 0, 40, -30), tracks: new Map(), join: new Map() };
  setArenaRoads(layer);
  const lines = (band) => { const c = []; const g = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 0 }) : (...a) => c.push([k, a])), set: () => true }); paintPastBay(g, { ox: -10, oy: -60, scale: 4 }, { paperW: 400, paperH: 400, band }); return c.filter(([k]) => k === 'lineTo').length; };
  assert.equal(lines('far'), 1, 'far: the straight run one chain of its steps');
  assert.equal(lines('near'), 1, 'near: one walked chain');
  const zig = { roads: new Map(), tracks: new Map(), join: new Map() };   // a stair: east, south-east, east
  zig.roads.set(beyondKey(0, -30), DIR.E); zig.roads.set(beyondKey(1, -30), DIR.W | DIR.SE); zig.roads.set(beyondKey(2, -29), DIR.NW | DIR.E); zig.roads.set(beyondKey(3, -29), DIR.W);
  setArenaRoads(zig);
  assert.equal(arenaRoadSteps(0, -64, 63, -1).roads.length, 3, 'a turn ends a run');
  const pens = (band) => { const c = []; const g = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 0 }) : (...a) => c.push(k)), set: () => true }); paintPastBay(g, { ox: -10, oy: -60, scale: 4 }, { paperW: 400, paperH: 400, band }); return c.filter((k) => k === 'moveTo').length; };
  assert.deepEqual([pens('far'), pens('near')], [3, 1], 'the stair at far its three runs, in near one walked chain');
  setArenaRoads(layer);
  // out on the continent: a dot a pixel, the far pen's width, a kind's dots one path
  assert.deepEqual([DOTS_BELOW, FAR_TRACK_PEN], [0.7, 0.6]);
  const dots = []; let fills = 0;
  const g = new Proxy({}, { get: (_, k) => (k === 'rect' ? (...a) => dots.push(a) : k === 'fill' ? () => fills++ : () => {}), set: () => true });
  paintPastBay(g, { ox: -10, oy: -60, scale: 0.4 }, { paperW: 400, paperH: 400, band: 'far' });
  assert.equal(dots.length, 41, 'the road\'s forty-one pixels');
  assert.deepEqual(dots[0].slice(2), [1, 1], 'the road\'s pen');
  const [px] = toPaper({ ox: -10, oy: -60, scale: 0.4 }, 0.5, -29.5);
  assert.ok(dots.some((d) => Math.abs(d[0] + 0.5 - px) < 1e-9), 'on the pixel\'s centre');
  dots.length = 0;
  paintPastBay(g, { ox: -10, oy: -60, scale: 0.4 }, { paperW: 400, paperH: 400, band: 'far', filters: { roads: true } });
  assert.equal(dots.length, 0, 'the Roads filter');
  assert.equal(lines('far'), 1, 'at the line itself, steps');
  setArenaRoads({ roads: new Map(), tracks: run(new Map(), 0, 3, -30), join: new Map() });
  paintPastBay(g, { ox: -10, oy: -60, scale: 0.4 }, { paperW: 400, paperH: 400, band: 'far' });
  assert.deepEqual([dots.length, dots[0][2]], [4, FAR_TRACK_PEN], 'a track\'s dot the far track\'s hair');
  const asked = [];
  const placesIn = (x0, y0, x1, y1) => { asked.push([x0, y0, x1, y1]); return [{ x: 99, y: -50, type: T.ReligionTemple }]; };
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 0 }) : (...a) => calls.push([k, a])), set: () => true });
  const view = { ox: 100, oy: -100, scale: 4 };
  paintPastBay(ctx, view, { paperW: 400, paperH: 400, band: 'near', placesIn });
  const pad = MARK_REACH_PX / view.scale;
  assert.deepEqual(asked[0], [Math.floor(100 - pad), Math.floor(-100 - pad), Math.ceil(100 + 400 / 4 + pad), Math.ceil(-100 + 400 / 4 + pad)]);
  const [x] = toPaper(view, 99.5, -49.5);
  assert.ok(calls.some(([k, a]) => k === 'moveTo' && Math.abs(a[0] - x) < 1e-9), 'the temple just west of the view, painted - its glyph reaches in');
});

// ── THE WIRING ──────────────────────────────────────────────────

test('TESA15 the window and the world: the kept tiles over paintPastBay and the word, at the sheet\'s dpr, painted again while owed, let go on close; the static key moves with the places; the hover\'s name off the one roll; the build handed the held pixels (mutant: each seam)', () => {
  const H = read('src/ui/heldMap.js'), W = hostText('src/scenes/world.js'), I = read('src/ui/tamrielInk.js');
  assert.match(H, /tiles: \(this\._pastBayTiles \?\?= createTamrielTiles\(\{ paint: \(c, v, w, h, o\) => paintPastBay\(c, v, \{ \.\.\.o, paperW: w, paperH: h \}\), stamp: pastBayStamp \}\)\), dpr: env\.dpr \}\);/);
  assert.match(H, /if \(this\._pastBayTiles\?\.takePending\(\)\) \{ this\._staticKey = ''; this\._dirty = true; \}/);
  assert.match(H, /this\._pastBayTiles\?\.clear\(\);/);
  assert.match(H, /pastBayPlacesVersion\(\),   \/\/ TESA15/);
  assert.match(I, /if \(opts\.tiles\) opts\.tiles\.draw\(ctx, view, \{ paperW, paperH, dpr: opts\.dpr \?\? 1, key: `\$\{band\}\|\$\{continent \? 1 : 0\}\|\$\{JSON\.stringify\(past\.filters\)\}\|\$\{JSON\.stringify\(past\.inks\)\}`, paint: past \}\);/, 'the key: the band, the continent, the filters, the hues');
  assert.match(W, /const tamrielRoadHeld = \(\) => \(_arenaTemplates \? arenaPixels\(\)\?\.stood\.filter\(\(p\) => arenaTemplateOf\(_arenaTemplates, p\)\)\.map\(\(p\) => \(\{ x: p\.bx, y: p\.by \}\)\) : null\) \?\? \[\];/);
  assert.match(W, /window\.__tesaPlaces = \(x0, y0, x1, y1\) => pastBayPlacesIn\(x0, y0, x1, y1\);/);
  assert.match(W, /tamrielPlacesIn: tamrielLand \? pastBayPlacesIn : null,/, 'the map seam: the regions\' places');
});
