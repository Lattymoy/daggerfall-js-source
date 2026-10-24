// ROAD-BEYOND (2026-10-12, found building TESA's roads; bible/03-World/Roads.md ROAD-BEYOND) - THE BAY'S NETWORK STAYS
// ON THE BAY, pinned. The road arrays are the Bay's 1000 x 500; TAMRIEL2 streams the land past it, and the kernel read a
// pixel there at `py * MAP_W + px` - the next or last row's own Bay pixel, so a Bay road's fragment was painted on the
// continent where no road runs (2712 pixels of Basic Roads' road and track in a 60-pixel strip either side). The corner
// byte read the same wrap one pixel further out. The landforms already clamped (landforms.js armsAbout).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pathCorners } from '../src/world/road/roadPainter.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { MAP_W, MAP_H, DIR } from '../src/world/road/roadNetwork.js';
import { groundWoods, tamrielHeightByte, tamrielClimateAt } from '../src/world/tamriel/tamrielGround.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { getWorldClimateSettings, CLIMATES } from '../src/formats/mapsFile.js';

test('ROAD-BEYOND the corner byte: a neighbour past the mask\'s east or west edge is none, on the Bay\'s rows and off them - where the row wrap read another row\'s pixel; the Bay\'s edge pixels past it read their Bay neighbour, and the Bay\'s own bytes are the mod\'s (mutant: each guard)', () => {
  const m = new Uint8Array(MAP_W * MAP_H);
  m[10 * MAP_W + 999] = DIR.NW | DIR.SW;   // (999, 10): read by (-2, 11)'s east under the wrap
  m[11 * MAP_W + 0] = DIR.NE | DIR.SE;     // (0, 11): read by (1001, 10)'s west under the wrap
  m[6] = DIR.NW;                           // (6, 0): read by (1005, -1)'s east under the wrap
  m[(MAP_H - 1) * MAP_W + 996] = DIR.SW;   // (996, 499): read by (-5, 500)'s east under the wrap
  assert.equal(pathCorners(m, -2, 11, MAP_W), 0, 'east of -2 is -1, past the Bay');
  assert.equal(pathCorners(m, 1001, 10, MAP_W), 0, 'west of 1001 is 1000, past the Bay');
  assert.equal(pathCorners(m, 1005, -1, MAP_W), 0, 'past the east edge, the row above the Bay');
  assert.equal(pathCorners(m, -5, 500, MAP_W), 0, 'past the west edge, the row below it');
  // the Bay's edge: a pixel just past it has one real Bay neighbour, and its diagonal brushes the corner
  assert.equal(pathCorners(m, -1, 11, MAP_W), 0, '(0, 11)\'s NE|SE are its east side\'s corners, not (-1, 11)\'s');
  m[11 * MAP_W + 0] |= DIR.SW;
  assert.equal(pathCorners(m, -1, 11, MAP_W), DIR.SW, 'east of -1 is the Bay\'s (0, 11)');
  assert.equal(pathCorners(m, 1000, 10, MAP_W), 0, '(999, 10)\'s NW|SW face west');
  m[10 * MAP_W + 999] |= DIR.NE;
  assert.equal(pathCorners(m, 1000, 10, MAP_W), DIR.NE, 'west of 1000 is the Bay\'s (999, 10)');
  // on the Bay: the mod's byte, as ROADS 23 pinned it
  assert.equal(pathCorners(m, 998, 10, MAP_W), DIR.NW | DIR.SW);
  assert.equal(pathCorners(m, 1, 11, MAP_W), DIR.NE | DIR.SE);
  assert.equal(pathCorners(m, 5, 0, MAP_W), DIR.NW);
  assert.equal(pathCorners(m, 997, MAP_H - 1, MAP_W), 0, '(996, 499) is its west neighbour, and SW faces it away');
  assert.equal(pathCorners(m, 995, MAP_H - 1, MAP_W), DIR.SW);
});

/** A WoodsFile's reads over a flat buffer, the composition's own shape (test/world/tamriel2.test.js StubWoods). */
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

test('ROAD-BEYOND the kernel: a land pixel past the Bay paints no byte of the Bay\'s network - the Bay pixel its row wrap named paints its road, the pixel past the Bay none, its road, track, river and stream alike; west of the Bay rows 0-499 are the Eltheric\'s sea, which no road paves (mutant: the grid test)', () => {
  const g = groundWoods(new FlatWoods(20));
  // land east of the Bay - Skyrim's and Morrowind's - well inland of the authored coast; west of it, the sea
  const east = [...Array(400).keys()].map((k) => [1100 + k, 120]).find(([x, y]) => tamrielHeightByte(x, y) > 20);
  assert.ok(east, 'land past the Bay\'s east edge');
  for (let y = 0; y < MAP_H; y += 7) for (let x = -2; x > -60; x -= 3) assert.ok(tamrielHeightByte(x, y) <= 12, `(${x}, ${y}) is the sea's`);
  const full = () => new Uint8Array(MAP_W * MAP_H);
  const net = { roads: full(), tracks: full(), rivers: full(), streams: full(), water: true, smooth: false };
  const wrap = east[1] * MAP_W + east[0];   // the Bay index the old read took
  assert.ok(wrap < MAP_W * MAP_H, 'it wraps onto a Bay pixel');
  const [bx, by] = [wrap % MAP_W, Math.floor(wrap / MAP_W)];
  assert.equal(by, east[1] + 1, 'the next row\'s');
  const job = (px, py) => generatePixelTerrain({ woods: g, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false,
    climateType: getWorldClimateSettings(tamrielClimateAt(px, py)).climateType, roads: net });
  const painted = (o) => o.paths.reduce((n, b) => n + (b ? 1 : 0), 0);
  for (const key of ['roads', 'tracks', 'rivers', 'streams']) {
    net[key][wrap] = DIR.N | DIR.S;
    assert.ok(painted(job(bx, by)) > 0, `${key}: the Bay pixel paints its own`);
    const out = job(east[0], east[1]);
    assert.equal(painted(out), 0, `${key}: past the Bay, none`);
    assert.equal(out.withRoads, true, 'a network was present');
    net[key][wrap] = 0;
  }
});

test('ROAD-BEYOND the kernel on all-land ground: past either edge, on the Bay\'s rows and off them, a pixel paints none of the Bay pixel its wrap named - which paints its own (mutant: each edge)', () => {
  const w = new FlatWoods(20);   // land everywhere, its reads clamped to the Bay's edge
  const full = () => new Uint8Array(MAP_W * MAP_H);
  const net = { roads: full(), tracks: full(), water: false, smooth: false };
  const climateType = getWorldClimateSettings(CLIMATES.Woodlands).climateType;
  const job = (px, py) => generatePixelTerrain({ woods: w, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType, roads: net });
  const painted = (o) => o.paths.reduce((n, b) => n + (b ? 1 : 0), 0);
  for (const [px, py, bx, by] of [[-30, 300, 970, 299], [1200, 10, 200, 11], [1005, -1, 5, 0], [-5, 500, 995, 499]]) {
    assert.equal(py * MAP_W + px, by * MAP_W + bx, 'the wrap');
    net.roads[by * MAP_W + bx] = DIR.N | DIR.S;
    assert.ok(painted(job(bx, by)) > 0, `(${bx}, ${by}) paints its own`);
    assert.equal(painted(job(px, py)), 0, `(${px}, ${py}) none`);
    net.roads[by * MAP_W + bx] = 0;
  }
});
