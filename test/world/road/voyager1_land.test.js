// VOYAGER1 (2026-10-26, KPbICA's spec forwarded by the owner: "Roads should rely on landscape and should not be just
// 100km straights. Roads should circle around rivers, on the shoreline, around tall mountains and not through all
// this"; bible/03-World/Roads.md VOYAGER1) - THE LAND'S LAW the routes past the Bay pay (world/road/roadNetwork.js
// VOYAGER_DIALS, landForRoutes, landStep, landGrain): the grade squared on the smoothed height, the height, the shore,
// the fords, the land's grain - handed by the regions' build (world/tamrielRoads.js) and never by the Bay's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildRoadNetwork, route, MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';
import { VOYAGER_DIALS, FORD_SPAN, GRAIN_PX, GRAIN_EDGE, landForRoutes, landStep, landGrain } from '../../../src/world/road/roadLand.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { TAMRIEL_ROADS_VERSION, buildTamrielRegion, regionLattice, regionOf, inputsPrint } from '../../../src/world/tamrielRoads.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { TownCity } = LOCATION_TYPES;
const N = MAP_W * MAP_H;
/** The land's law over a synthetic grid: `h(x, y)` its heights, `wet(x, y)` its water. */
const landOf = (h, wet = () => false, grain = false) => {
  const heights = new Uint8Array(N), water = new Uint8Array(N);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { heights[y * MAP_W + x] = h(x, y); water[y * MAP_W + x] = wet(x, y) ? 1 : 0; }
  const land = landForRoutes(heights, water, null, MAP_W, MAP_H, VOYAGER_DIALS, grain ? (u, v) => landGrain(u, v) : null);
  return { heights, water, land, terrain: land,
    heightAt: (x, y) => heights[y * MAP_W + x], isWater: (x, y) => water[y * MAP_W + x] === 1 && land.ford[y * MAP_W + x] === 0 };
};

test('VOYAGER1 the dials, one place: the grade 1/16 per (byte a pixel)^2, the height 3% a byte over 40, the shore 0.85, a ford 12 a step, the grade read over 5 x 5, a rough patch\'s heart 2.5 more, the wider box past twice the straight length, a ford two pixels across at the widest (mutant: any one)', () => {
  assert.deepEqual({ ...VOYAGER_DIALS }, { gradeCost: 1 / 16, highCost: 0.03, highAbove: 40, shoreCost: 0.85, fordCost: 12, smoothR: 2, grainCost: 2.5, widenAbove: 2 });
  assert.equal(FORD_SPAN, 2);
  assert.ok(Object.isFrozen(VOYAGER_DIALS));
});

test('VOYAGER1 the land a route is costed on: the height averaged over its 5 x 5 (the edge\'s box clipped), the shore beside water, a ford where water runs no more than two pixels between land - along a row, a column or a diagonal - and never against the kept ground; the grain on land alone (mutants: the box\'s reach, the clip, the shore\'s ring, the span, the far bank, the keep)', () => {
  const W = 9, H = 7, heights = new Uint8Array(W * H), water = new Uint8Array(W * H), keep = new Uint8Array(W * H);
  heights[3 * W + 4] = 25;
  let l = landForRoutes(heights, water, null, W, H);
  assert.equal(l.height[3 * W + 4], 1, 'a 25 alone over its 25');
  assert.equal(l.height[2 * W + 2], 1, 'two off, one down: inside its box');
  assert.equal(l.height[1 * W + 2], 25 / 20, 'a row from the edge: its box clipped to 5 x 4');
  assert.equal(l.height[3 * W + 7], 0, 'three off, outside');
  heights.fill(0); heights[0] = 9;
  l = landForRoutes(heights, water, null, W, H);
  assert.equal(l.height[0], 1, 'a corner\'s box clipped to its 3 x 3: 9 over 9');
  assert.equal(l.height[2 * W + 2], Math.fround(9 / 25));
  assert.equal(l.grain, null, 'no grain without its reader');
  // a river two wide down columns 3 and 4: a ford on every row, the shore beside it
  heights.fill(10);
  for (let y = 0; y < H; y++) { water[y * W + 3] = 1; water[y * W + 4] = 1; }
  l = landForRoutes(heights, water, null, W, H);
  assert.deepEqual([...l.ford.slice(2 * W, 3 * W)], [0, 0, 0, 1, 1, 0, 0, 0, 0]);
  assert.deepEqual([...l.shore.slice(2 * W, 3 * W)], [0, 0, 1, 0, 0, 1, 0, 0, 0]);
  // three wide is no ford
  for (let y = 0; y < H; y++) water[y * W + 5] = 1;
  l = landForRoutes(heights, water, null, W, H);
  assert.equal(l.ford.some((f) => f), false, 'three across: none, nor on a diagonal through it');
  // a narrows against the kept ground (the Bay): no ford - its far bank is no land a road walks
  water.fill(0); keep.fill(0);
  for (let y = 0; y < H; y++) { water[y * W + 1] = 1; keep[y * W + 0] = 1; water[y * W + 0] = 1; }
  l = landForRoutes(heights, water, keep, W, H);
  assert.equal(l.ford.some((f) => f), false);
  // the kept ground is no water a shore runs beside: land beside the Bay alone is no shore
  water.fill(0); for (let y = 0; y < H; y++) water[y * W] = 1;
  l = landForRoutes(heights, water, keep, W, H);
  assert.equal(l.shore[2 * W + 1], 0, 'beside the kept ground');
  assert.equal(landForRoutes(heights, water, null, W, H).shore[2 * W + 1], 1, 'beside water');
  // a single water pixel in a field: a ford every way across
  water.fill(0); water[3 * W + 4] = 1;
  l = landForRoutes(heights, water, null, W, H, VOYAGER_DIALS, (u, v) => (u + v) / 100);
  assert.equal(l.ford[3 * W + 4], 1);
  assert.equal(l.grain[3 * W + 4], 0, 'no grain on water');
  assert.equal(l.grain[2 * W + 1], Math.fround(0.03));
});

test('VOYAGER1 the land\'s grain: rough patches - the lattice\'s eased field where it runs over 0.5, whole from 0.65 - nought over half the land and whole over a quarter, the same numbers on every client (mutants: the hash, the ease, the edges, the lattice)', () => {
  assert.equal(GRAIN_PX, 10);
  assert.deepEqual([...GRAIN_EDGE], [0.5, 0.65]);
  assert.deepEqual([[26, 7], [30, 7], [40, 40], [-37, 113], [205, -58]].map(([x, y]) => Math.round(landGrain(x, y) * 1e9)), [279855683, 1e9, 1e9, 1e9, 0]);
  let n = 0, none = 0, whole = 0;
  for (let y = -500; y < 500; y += 3) for (let x = -500; x < 500; x += 3) { const g = landGrain(x, y); n++; if (g === 0) none++; if (g === 1) whole++; }
  assert.ok(Math.abs(none / n - 0.514) < 0.01 && Math.abs(whole / n - 0.256) < 0.01, `nought ${none / n}, whole ${whole / n}`);
  // smooth: no step in it between neighbouring points
  for (let x = 0; x < 200; x += 0.05) assert.ok(Math.abs(landGrain(x + 0.05, 33) - landGrain(x, 33)) < 0.1, `smooth at ${x}`);
});

test('VOYAGER1 a step\'s price: its length; the grade squared, the same up as down; the height over 40; the shore; the grain; a ford\'s crossing on top (mutants: the square, the sign, the length\'s share, each factor)', () => {
  const W = MAP_W, at = (x, y) => y * W + x;
  const t = { height: new Float32Array(N), shore: new Uint8Array(N), ford: new Uint8Array(N), grain: null, d: VOYAGER_DIALS };
  t.height[at(1, 0)] = 4;
  assert.equal(landStep(t, 0, 0, 1, 1, Math.SQRT2), Math.SQRT2, 'flat: its length');
  assert.equal(landStep(t, 0, 0, 1, 0, 1), 2, 'a rise of 4 a pixel: twice');
  assert.equal(landStep(t, 1, 0, 0, 0, 1), 2, 'the same down');
  t.height[at(2, 1)] = 4 + 8 * Math.SQRT2;
  assert.ok(Math.abs(landStep(t, 1, 0, 2, 1, Math.SQRT2) - Math.SQRT2 * 5) < 1e-5, 'a diagonal: its rise a pixel of its length');
  t.height[at(3, 0)] = 50; t.height[at(4, 0)] = 50;
  assert.ok(Math.abs(landStep(t, 3, 0, 4, 0, 1) - 1.3) < 1e-12, '10 over 40: 30% more');
  t.shore[at(6, 0)] = 1;
  assert.equal(landStep(t, 5, 0, 6, 0, 1), 0.85);
  t.ford[at(7, 0)] = 1;
  assert.equal(landStep(t, 8, 0, 7, 0, 1), 13, 'a ford: its length and twelve');
  t.grain = new Float32Array(N); t.grain[at(9, 0)] = 0.5;
  assert.equal(landStep(t, 8, 0, 9, 0, 1), 2.25, 'half a patch: 2.5 x 0.5 more');
});

test('VOYAGER1 the routes: round a steep hill the Bay\'s law climbs, through the pass in a ridge, across a narrow river once by a ford, round a lake (mutants: the terrain unread, the ford\'s water passed, the grade)', () => {
  // a mountain 100 high and some 40 pixels across (33 km) between two towns 80 apart: round its foot, never over it - the
  // climb's price is its grade squared on the smoothed height, and its height above 40
  const H1 = landOf((x, y) => 10 + Math.round(100 * Math.exp(-((x - 160) ** 2 + (y - 200) ** 2) / 200)));
  const land = route({ x: 120, y: 200 }, { x: 200, y: 200 }, { heightAt: H1.heightAt, isWater: () => false, existing: new Uint8Array(N), d: {}, terrain: H1.terrain });
  const top = Math.max(...land.map((q) => H1.heightAt(q.x, q.y))), near = Math.min(...land.map((q) => Math.hypot(q.x - 160, q.y - 200)));
  assert.ok(top < 75 && near > 10, `round the mountain, on its flank: its highest step ${top} of 110, ${near.toFixed(1)} pixels from the summit`);
  // a ridge 120 high across the grid with a pass at y 200 (height 30): the route takes the pass
  const R = landOf((x, y) => (Math.abs(x - 300) <= 3 ? (Math.abs(y - 200) <= 2 ? 30 : 120) : 20));
  const over = route({ x: 280, y: 150 }, { x: 320, y: 150 }, { heightAt: R.heightAt, isWater: () => false, existing: new Uint8Array(N), d: {}, terrain: R.terrain });
  const crossing = over.find((q) => q.x === 300);
  assert.ok(crossing && Math.abs(crossing.y - 200) <= 2, `through the pass: ${JSON.stringify(crossing)}`);
  // a track (`stopOn`) asks no wider box: a village's way climbs the ridge where it stands
  const track = route({ x: 280, y: 150 }, { x: 320, y: 150 }, { heightAt: R.heightAt, isWater: () => false, existing: new Uint8Array(N), stopOn: new Uint8Array(N), d: {}, terrain: R.terrain });
  assert.ok(Math.abs(track.find((q) => q.x === 300).y - 150) <= 12, 'over the ridge, inside the first box');
  // a river one pixel wide down column 500: two towns either side are joined, the river crossed once
  const V = landOf(() => 20, (x) => x === 500);
  const net = buildRoadNetwork({ locations: [{ x: 490, y: 250, type: TownCity }, { x: 510, y: 250, type: TownCity }], heightAt: V.heightAt, isWater: V.isWater, terrain: V.terrain });
  assert.equal(net.stats.unrouted, 0);
  let wet = 0;
  for (let y = 0; y < MAP_H; y++) if (net.roads[y * MAP_W + 500]) wet++;
  assert.equal(wet, 1, 'one ford');
  const dry = buildRoadNetwork({ locations: [{ x: 490, y: 250, type: TownCity }, { x: 510, y: 250, type: TownCity }], heightAt: V.heightAt, isWater: (x) => x === 500 });
  assert.equal(dry.stats.islands, 1, 'without the land\'s law the river parts them');
  // a lake 12 wide between two towns: round it, never in it
  const L = landOf(() => 20, (x, y) => Math.abs(x - 700) <= 6 && Math.abs(y - 250) <= 30);
  const lake = route({ x: 680, y: 250 }, { x: 720, y: 250 }, { heightAt: L.heightAt, isWater: L.isWater, existing: new Uint8Array(N), d: {}, terrain: L.terrain });
  assert.ok(lake && lake.every((q) => !L.water[q.y * MAP_W + q.x]), 'dry all the way');
});

test('VOYAGER1 the shore: a route between two towns on a lake\'s shore keeps to it where the way inland is no shorter (mutant: the shore\'s price)', () => {
  // a straight shore two pixels south of the chord between two towns: the shore's 0.85 a step pays for the two steps down
  // and the two back
  const L = landOf(() => 20, (x, y) => y >= 262 && y < 300 && x > 380 && x < 480);
  const r = route({ x: 400, y: 259 }, { x: 460, y: 259 }, { heightAt: L.heightAt, isWater: L.isWater, existing: new Uint8Array(N), d: {}, terrain: L.terrain });
  const onShore = r.filter((q) => L.land.shore[q.y * MAP_W + q.x]).length;
  assert.ok(onShore / r.length > 0.8, `on the shore: ${onShore} of ${r.length}`);
});

test('VOYAGER1 the regions build on the land\'s law - a pixel of the Bay water and never a ford, the grain at the pixel\'s own place - and their key moves with it (mutants: the terrain unhanded, the Bay a ford, the grain\'s origin, the version, the dials unprinted)', () => {
  assert.equal(TAMRIEL_ROADS_VERSION, 5);   // PIN MOVED (RIVER-FORDS): 5, the carved rivers crossed as fords
  const src = read('src/world/tamrielRoads.js');
  assert.match(src, /landForRoutes\(heights, water, bay, MAP_W, MAP_H, VOYAGER_DIALS, \(u, v\) => landGrain\(gx \+ u, gy \+ v\)\)/);
  assert.match(src, /terrain: land, trunks: legs/);
  const base = { woodsBytes: new Uint8Array(4), fit: null, trace: null, spec: {}, nodes: [], obstacles: [], gates: [] };
  assert.notEqual(inputsPrint(base), inputsPrint({ ...base, trunks: { roads: [] } }), 'the named roads are in the print');
  // a region: a one-wide river past the Bay crossed by a ford, its towns joined
  const lattice = regionLattice({ x0: 1000, y0: 0, w: 1600, h: 600 }), region = regionOf(lattice, 0, 0);
  const out = buildTamrielRegion({ region, places: [], nodes: [{ x: 1150, y: 120, type: TownCity }, { x: 1170, y: 120, type: TownCity }], obstacles: [], gates: [], heightAt: (x) => (x === 1160 ? 2 : 30) });
  assert.equal(out.stats.unrouted, 0);
  assert.ok(out.roads.size > 0);
});
