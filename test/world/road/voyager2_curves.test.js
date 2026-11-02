// VOYAGER2 (2026-10-26, KPbICA's spec forwarded by the owner: "Add slight curvatures for intersections and turns of the
// roads to make them more natural"; bible/03-World/Roads.md VOYAGER2) - THE ROADS PAST THE BAY ARE DRAWN AS CURVES
// (world/road/roadCurves.js): a way through a pixel one quadratic curve tangent to its steps, a junction its gentle pairs
// curved and the rest straight in with the centre paved round, painted at the kernel's seam past the Bay alone (the
// Bay's own roads are Basic Roads' painter's to the byte), and measured by the verge from the same curves.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { curvesOf, curveApex, curveDistance, curveField, paintCurvedPaths, CURVE_DIM, ROAD_HALF, ROAD_SHOULDER, TRACK_HALF, JUNCTION_R, LIE } from '../../../src/world/road/roadCurves.js';
import { paintRoads } from '../../../src/world/road/roadPainter.js';
import { DIR, MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads } from '../../../src/world/arenaRoads.js';
import { roadRoom } from '../../../src/world/road/roadVerge.js';
import { generatePixelTerrain } from '../../../src/world/terrain/terrainGen.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../../src/formats/woodsFile.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
afterEach(() => { setArenaRoads(null); });
const T = CURVE_DIM;
/** A pixel painted past the Bay (`curve`) or by Basic Roads' own painter, on grass (or water), its neighbours' bytes `nb`. */
const paint = (road, { track = 0, nb = {}, curve = true, ground = 2, corners = null } = {}) => {
  const td = new Uint8Array(129 * 129).fill(ground), tm = new Uint8Array(T * T), paths = new Uint8Array(T * T);
  const byteAt = (kind, x, y) => nb[`${kind}:${x},${y}`] ?? 0;
  paintRoads(td, tm, road, track, null, 129, { paths, corners: corners ?? {}, curve: curve ? { px: 0, py: 0, byteAt } : null });
  return { td, tm, paths };
};
const isRoad = (t) => (t & 0x3f) === 46;

test('VOYAGER2 the curve law: a way through two bits is one quadratic from edge point to edge point about the centre - straight where they are opposite; a junction curves each pair three or four points apart, takes a bit in no such pair straight in, and paves its centre; an end runs in to the centre (mutants: the control point, the pair\'s spacing, the hub, the end)', () => {
  assert.deepEqual(curvesOf(DIR.W | DIR.E), { curves: [[128, 64, 64, 64, 0, 64]], hub: false }, 'east to west through the centre: Basic Roads\' own line');
  assert.deepEqual(curvesOf(DIR.W | DIR.NE).curves, [[128, 128, 64, 64, 0, 64]]);
  // a T: the through road, the stem straight in, the centre paved
  assert.deepEqual(curvesOf(DIR.N | DIR.E | DIR.W), { curves: [[128, 64, 64, 64, 0, 64], [64, 128, 64, 96, 64, 64]], hub: true });
  // a Y: the branch at 45 degrees curves into the road it joins (west), never back the way it came (east)
  assert.deepEqual(curvesOf(DIR.NE | DIR.E | DIR.W).curves, [[128, 128, 64, 64, 0, 64], [128, 64, 64, 64, 0, 64]]);
  // a fork: north splits to both diagonals behind it
  assert.deepEqual(curvesOf(DIR.N | DIR.SE | DIR.SW).curves, [[64, 128, 64, 64, 128, 0], [64, 128, 64, 64, 0, 0]]);
  assert.deepEqual(curvesOf(DIR.S), { curves: [[64, 0, 64, 32, 64, 64]], hub: false }, 'an end: in to the centre');
  assert.deepEqual(curvesOf(0), { curves: [], hub: false });
  assert.equal(curvesOf(DIR.W | DIR.NE), curvesOf(DIR.W | DIR.NE), 'kept a byte');
  // a 45-degree bend's apex: an eighth of a pixel inside the centre (16 tiles, 102 m); a way straight through, the centre
  assert.deepEqual(curveApex(DIR.W | DIR.NE, DIR.W, DIR.NE), [64, 80]);
  assert.deepEqual(curveApex(DIR.W | DIR.NE, DIR.NE, DIR.W), [64, 80], 'either way along it');
  assert.deepEqual(curveApex(DIR.W | DIR.E, DIR.W, DIR.E), [64, 64]);
  assert.deepEqual(curveApex(DIR.N | DIR.E | DIR.W, DIR.N, DIR.E), [64, 64], 'a T\'s stem turns at the centre');
  assert.deepEqual([ROAD_HALF, ROAD_SHOULDER, TRACK_HALF, JUNCTION_R], [1, 0.9, 0.75, 2.5]);
});

test('VOYAGER2 the distance: zero on the line, the curve\'s and not the arms\' (a bend\'s old corner 14.46 tiles off it), the centre paved at a junction (mutants: the prune, a segment\'s ends, the hub)', () => {
  assert.equal(curveDistance(DIR.W | DIR.NE, 64, 80), 0, 'the apex is on it');
  assert.ok(Math.abs(curveDistance(DIR.W | DIR.NE, 64, 64) - 14.46) < 0.05, `the corner the arms turned at: ${curveDistance(DIR.W | DIR.NE, 64, 64)}`);
  assert.equal(curveDistance(DIR.W | DIR.E, 30, 64), 0);
  assert.ok(Math.abs(curveDistance(DIR.W | DIR.E, 30, 70) - 6) < 1e-9);
  assert.ok(Math.abs(curveDistance(DIR.E, 30, 64) - Math.hypot(34, 0)) < 1e-9, 'an end stops at the centre');
  const hub = DIR.N | DIR.E | DIR.W;
  assert.equal(curveDistance(hub, 65, 63), 0, 'inside the junction\'s paving');
  assert.ok(Math.abs(curveDistance(hub, 65.2, 62.8) - (Math.hypot(1.2, 1.2) - 1.5)) < 1e-9, 'and just past it');
  assert.ok(Math.abs(curveDistance(hub, 64, 60) - (4 - (JUNCTION_R - ROAD_HALF))) < 1e-9, 'south of the T\'s centre: the paving nearer than its line');
  assert.equal(curveDistance(0, 10, 10), Infinity);
});

test('VOYAGER2 the painter: a straight road past the Bay is Basic Roads\' painter\'s to the byte; a diagonal his tiles where his stand, its flanks over the shoulder\'s dirt; a bend paves the curve and not the arms\' corner; never over water (mutants: the half width, a rotation, a flip, the flank\'s side, the water test, the curve unread)', () => {
  for (const bits of [DIR.W | DIR.E, DIR.N | DIR.S]) {
    const a = paint(bits), b = paint(bits, { curve: false });
    assert.deepEqual(Array.from(a.tm), Array.from(b.tm), `${bits}: byte for byte`);
  }
  const d = paint(DIR.NE | DIR.SW), s = paint(DIR.NE | DIR.SW, { curve: false });
  for (let i = 0; i < T * T; i++) {
    assert.equal(!!d.tm[i], !!s.tm[i], `tile ${i}: placed where his is`);
    if (s.tm[i]) assert.equal(d.tm[i] & 0xc0, s.tm[i] & 0xc0, `tile ${i}: rotated and flipped as his`);
    if ((s.tm[i] & 0x3f) === 55) assert.equal(d.tm[i] & 0x3f, 47, 'the flank over the shoulder\'s dirt');
  }
  assert.equal(d.tm[100 * T + 100], 46, 'the diagonal\'s inner tile');
  assert.equal(d.tm[100 * T + 101], 47 + 128, 'its south-east flank flipped');
  assert.equal(d.tm[101 * T + 100], 47, 'its north-west flank not');
  const nw = paint(DIR.NW | DIR.SE);
  assert.equal(nw.tm[100 * T + 27], 46 + 64, 'a north-west run\'s inner tile rotated');
  // the bend: on the curve (x 96, y 100), never on the arms' corner (96, 96)
  const bend = paint(DIR.W | DIR.NE), arms = paint(DIR.W | DIR.NE, { curve: false });
  assert.ok(isRoad(bend.tm[100 * T + 96]) && !isRoad(bend.tm[96 * T + 96]), 'the curve');
  assert.ok(isRoad(arms.tm[96 * T + 96]) && !isRoad(arms.tm[100 * T + 96]), 'his arms');
  assert.ok(isRoad(bend.tm[80 * T + 64]), 'its apex paved');
  assert.equal(bend.paths[80 * T + 64], 1, 'GRASS-PATH1: told');
  // a road's shoulder wears the grass to dirt; a track wears its line alone
  assert.equal(paint(DIR.W | DIR.E).td[40 + 65 * 129], 1, 'the shoulder: dirt a corner past the paving');
  assert.equal(paint(DIR.W | DIR.E).td[40 + 66 * 129], 2, 'two past it, grass');
  assert.equal(paint(DIR.W | DIR.E).td[40 + 62 * 129], 2, 'and south');
  const tr = paint(0, { track: DIR.W | DIR.E });
  assert.deepEqual([tr.td[40 + 63 * 129], tr.td[40 + 64 * 129], tr.td[40 + 65 * 129]], [2, 1, 2], 'a track: its line\'s corners, dirt');
  assert.equal(tr.tm.some((t) => t !== 0), false, 'a track writes no tile - the squares draw it');
  assert.equal(tr.paths[63 * T + 40], 1, 'and is told');
  // water: never paved, never worn - a ford, the banks either side
  const wet = paint(DIR.W | DIR.E, { ground: 0 });
  assert.equal(wet.tm.some((t) => t !== 0), false);
  assert.equal(wet.td.every((g) => g === 0), true);
});

test('VOYAGER2 the band over an edge and a corner: a pixel paints its neighbours\' bands where they spill into it - the corner two diagonal pixels meet at, as Basic Roads\' corner byte does - with no byte of its own (mutants: the neighbour\'s frame, north\'s sign)', () => {
  // the diagonal step between this pixel's north and east neighbours brushes its north-east corner
  const nb = { 'roads:0,-1': DIR.NW | DIR.SE, 'roads:1,0': DIR.NW | DIR.SE };
  const c = paint(0, { nb }), his = paint(0, { curve: false, corners: { road: DIR.NW } });
  assert.equal(c.tm[127 * T + 127], 47 + 64, 'the corner tile: his diagonal flank, rotated (over the shoulder\'s dirt)');
  assert.equal(his.tm[127 * T + 127], 55 + 64, 'his corner byte\'s own');
  assert.equal(c.tm.filter((t) => t).length <= 4, true, `the corner alone: ${c.tm.filter((t) => t).length}`);
  assert.ok(!isRoad(c.tm[0]) && !isRoad(c.tm[127]) && !isRoad(c.tm[127 * T]), 'no other corner');
  // and its own band meets its east neighbour's at the edge: the two rows either side of it paved
  const e = paint(DIR.W | DIR.E, { nb: { 'roads:1,0': DIR.W | DIR.E } });
  assert.ok(isRoad(e.tm[63 * T + 127]) && isRoad(e.tm[64 * T + 127]));
  // the field: a neighbour's curve in this frame - north is +y
  const f = curveField(0, 0, 0, (x, y) => (x === 0 && y === -1 ? DIR.S | DIR.N : 0));
  assert.equal(f.tiles[127 * T + 63], Math.fround(Math.SQRT1_2), 'its line ends at the north edge\'s middle - a tile beside it half a diagonal off');
  assert.equal(f.tiles[126 * T + 63], Math.fround(Math.hypot(0.5, 1.5)), 'and the next row down farther');
  assert.equal(f.lie[127 * T + 64], LIE.NS | LIE.SIDE, 'the east column of a north-south run');
  assert.equal(curveField(0, 0, 0, () => 0), null);
});

test('VOYAGER2 the seam: the kernel paints a pixel past the Bay\'s roads as curves and the Bay\'s with Basic Roads\' painter (mutants: the seam\'s `curve`, the Bay test)', () => {
  const w = new FlatWoods(20);
  const k = (px, py) => generatePixelTerrain({ woods: w, px, py, stride: 1, tilemap: new Uint8Array(T * T), locationRect: null, hasLocation: false, climateType: 302, roads: bayNet() });
  setArenaRoads({ roads: new Map([[beyondKey(1200, 10), DIR.W | DIR.NE]]), tracks: new Map() });
  const o = k(1200, 10);
  assert.ok(isRoad(o.tilemap[100 * T + 96]) && !isRoad(o.tilemap[96 * T + 96]), 'past the Bay, the curve');
  const own = bayNet(); own.roads[100 * MAP_W + 200] = DIR.W | DIR.NE;
  const bay = generatePixelTerrain({ woods: w, px: 200, py: 100, stride: 1, tilemap: new Uint8Array(T * T), locationRect: null, hasLocation: false, climateType: 302, roads: own });
  assert.ok(isRoad(bay.tilemap[96 * T + 96]) && !isRoad(bay.tilemap[100 * T + 96]), 'on the Bay, his arms');
  assert.match(read('src/world/terrain/terrainGen.js'), /curve: arena \? \{ px, py, byteAt: arenaRoadByte \} : null/);
});

test('VOYAGER2 the verge measures the curve past the Bay: a bend\'s apex is on the road and the arms\' corner 86 m off it; the Bay\'s pixels its arms as ever (mutants: the curve unasked, the tile frame)', () => {
  const PIXEL_M = 819.2, tile = PIXEL_M / T, net = bayNet();
  setArenaRoads({ roads: new Map([[beyondKey(500, -30), DIR.W | DIR.NE]]), tracks: new Map() });
  assert.equal(roadRoom(net, 500, -30, 64 * tile, 80 * tile, 200), 0, 'the apex');
  const corner = roadRoom(net, 500, -30, 64 * tile, 64 * tile, 200);
  assert.ok(Math.abs(corner - (14.46 * tile - 6.4)) < 0.5, `the arms' corner: ${corner} m`);
  setArenaRoads({ roads: new Map(), tracks: new Map([[beyondKey(500, -30), DIR.W | DIR.NE]]) });
  assert.equal(roadRoom(net, 500, -30, 64 * tile, 80 * tile, 200), 0, 'a track\'s too');
  setArenaRoads(null);
  const own = bayNet(); own.roads[100 * MAP_W + 200] = DIR.W | DIR.NE;
  assert.equal(roadRoom(own, 200, 100, 64 * tile, 64 * tile, 200), 0, 'the Bay: on his arms\' corner');
});

test('VOYAGER2 paintCurvedPaths answers the tiles it paved and paves a road\'s location rect\'s padding as Basic Roads does (mutant: the rect\'s paving)', () => {
  const td = new Uint8Array(129 * 129).fill(2), tm = new Uint8Array(T * T);
  const rect = { xMin: 40, xMax: 88, yMin: 40, yMax: 88 };
  for (let y = 50; y < 78; y++) for (let x = 50; x < 78; x++) tm[y * T + x] = 7;   // the location's own tiles
  const n = paintCurvedPaths(td, tm, { px: 0, py: 0, road: DIR.W | DIR.E, track: 0, byteAt: () => 0, rect });
  assert.equal(tm[45 * T + 45], 46, 'the padding paved');
  assert.equal(tm[60 * T + 60], 7, 'the location\'s own tile never');
  assert.equal(n, tm.filter((t) => t === 46 || t === 46 + 64 || t === 46 + 64 + 128).length);
});

/** A WoodsFile's reads over a flat buffer (test/tesa4_roads.test.js FlatWoods). */
class FlatWoods {
  constructor(v) { this.heightMapBuffer = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(v); }
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
function bayNet() { return { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H), water: false, smooth: false }; }
