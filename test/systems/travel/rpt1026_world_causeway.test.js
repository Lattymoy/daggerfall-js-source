// RPT1026-WORLD CAUSEWAY (a private report, 2026-10-26, Tulune's Grayidge-Westwall road: on the bridge the guide turned
// off it and left the traveller stuck in the water): A ROAD OVER THE WATER IS THE ROAD'S. Hazelnut's road crosses
// the inlet between Grayidge (72, 133) and Westwall (72, 130) at (72, 131), a pixel whose WOODS byte is at the beach
// line - and his painter paves it, a strip of road tiles across the water (world/road/roadPainter.js ROAD_TILES). The
// Overworld's step law refused every step into the sea, his road's too, so the route left the road at (72, 132) and went
// by (73, 131), across the inlet's east arm. Through the real planner (systems/travel/travelRoute.js planRoute) on his
// vendored bytes, the ground the host hands it (world.js tvRouteGround: routeGround over the player's WOODS.WLD and
// MAPS.BSA), and the tiles the terrain kernel paints there (world/terrain/terrainGen.js generatePixelTerrain).
// OWN-WORK2 (2026-10-31): his arrays are retired and the Bay's own network lays no road on the sea. The law stands - a
// road over the water is the road's - and is pinned on a road of the test's own over the same inlet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { planRoute, routeGround } from '../../../src/systems/travel/travelRoute.js';
import { WATER_BYTE } from '../../../src/world/roadsProducer.js';
import { MapsFile } from '../../../src/formats/mapsFile.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../../../src/world/terrain/terrainGen.js';
import { waterCorners } from '../../../src/world/water/waterCorners.js';
import { convertTile } from '../../../src/world/terrain/terrainSurface.js';
import { DIR_DELTA } from '../../../src/world/road/roadNetwork.js';
import { bayRoads, bayArchives, BAY_SKIP } from '../../bayRoads.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing' : false;
/** A road of the test's own, as his ran: Grayidge (72, 133) north over the inlet's pixel to Westwall (72, 130). */
const NET = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) };
for (let y = 130; y <= 133; y++) NET.roads[y * 1000 + 72] = (y > 130 ? DIR_DELTA[0][0] : 0) | (y < 133 ? DIR_DELTA[4][0] : 0);
let _real = null;
function real() {
  if (_real) return _real;
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const ground = routeGround((x, y) => maps.getClimateIndex(x, y), (x, y) => woods.getHeightMapValue(x, y), WATER_BYTE, 1000, 500, null);
  return (_real = { woods, ground });
}
const GRAYIDGE = { x: 72, y: 133 }, WESTWALL = { x: 72, y: 130 }, INLET = { x: 72, y: 131 };
const at = (p) => (q) => q.x === p.x && q.y === p.y;

test('CAUSEWAY: Grayidge to Westwall walks a road over the inlet - (72, 131) on the route, every step a road\'s; the route by (73, 131) across the inlet\'s east arm is gone; with a boat to hand the road is walked, not sailed (mutants: the sea refused under the road; the corner refused; the boat\'s search launches)', { skip: skipReal }, () => {
  const { ground } = real();
  assert.ok(ground.isWater(INLET.x, INLET.y), 'the inlet\'s pixel is water by the route law\'s byte');
  assert.ok(!ground.isWater(73, 131), 'the pixel beside it is dry');
  const plan = planRoute(GRAYIDGE, WESTWALL, { ...NET, ...ground });
  assert.ok(plan, 'a route');
  assert.ok(plan.pixels.some(at(INLET)), `over the causeway: ${JSON.stringify(plan.pixels)}`);
  assert.ok(!plan.pixels.some(at({ x: 73, y: 131 })), 'never round by the open pixel beside it');
  assert.deepEqual(plan.kinds, ['road', 'road', 'road'], 'the road the whole way');
  // OWS2's search, a boat to hand ashore: the causeway is the road's there too, no launch, no landfall
  const boat = planRoute(GRAYIDGE, WESTWALL, { ...NET, ...ground, sea: { start: 'land', again: true, goal: 'land' } });
  assert.deepEqual(boat?.kinds, ['road', 'road', 'road'], `walked, not sailed: ${JSON.stringify(boat?.kinds)}`);
});

test('CAUSEWAY on the whole map, OWN-WORK2: the Bay\'s own network needs no causeway - no road or track on a pixel the route law calls water, and no step of it through a corner of the sea', { skip: BAY_SKIP }, () => {
  const bay = bayRoads(), { maps, woods } = bayArchives();   // the heights as the world host smooths them, the network's own
  const ground = routeGround((x, y) => maps.getClimateIndex(x, y), (x, y) => woods.getHeightMapValue(x, y), WATER_BYTE, 1000, 500, null);
  let wet = 0, corners = 0;
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) {
    const b = bay.roads[y * 1000 + x] | bay.tracks[y * 1000 + x];
    if (!b) continue;
    if (ground.isWater(x, y)) wet++;
    for (const [bit, dx, dy] of DIR_DELTA) if (dx && dy && (b & bit) && ground.isWater(x + dx, y) && ground.isWater(x, y + dy)) corners++;
  }
  assert.deepEqual([wet, corners], [0, 0], 'his arrays had 42 road pixels on the sea, forty of them a coast road at (515-559, 296-316)');
});

test('CAUSEWAY: the inlet\'s pixel as the terrain kernel builds it with a road over it - a strip of road tiles, none with a water corner, the water either side; ROAD-DRY: every corner of his paving at CAPITAL_LAND, and Deep Waters (its bake, its carve, its water test) leaves the road whole - the sea round it still the sea\'s (what the route walks is ground the feet stand on) (mutants: the lift unwired; the edges unread)', { skip: skipReal, timeout: 600_000 }, async () => {
  const { woods } = real();
  const { buildGlobal, DeepWatersBake } = await import('../../../src/world/deepWater/deepWatersBake.js');
  const { buildDeepWatersPixel } = await import('../../../src/world/deepWater/deepWatersPixel.js');
  const { HOLES_RESOLUTION } = await import('../../../src/world/deepWater/deepWaterFloor.js');
  const { isLocalPointWater } = await import('../../../src/world/deepWater/deepWaterClassification.js');
  const { CAPITAL_LAND } = await import('../../../src/world/terrain/capitalSea.js');
  const { PAVING } = await import('../../../src/world/road/roadDry.js');
  const { MapsFile: Maps } = await import('../../../src/formats/mapsFile.js');
  const maps = new Maps(); maps.load(...['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].map((f) => new Uint8Array(readFileSync(join(ARENA2, f)))));
  const bake = new DeepWatersBake({ woods, global: buildGlobal(woods) }), n = HOLES_RESOLUTION, H = 129;
  for (const [px, py, wide] of [[INLET.x, INLET.y, 256]]) {   // OWN-WORK2: Sentinel's coast road (421, 374) was his arrays' alone
    const tilemap = new Uint8Array(128 * 128);
    const out = generatePixelTerrain({ woods, px, py, tilemap, climateType: 0, roads: { ...NET, smooth: true } });
    let road = 0, water = 0, paving = 0;
    for (let i = 0; i < 128 * 128; i++) {
      const rec = out.tilemapBytes[i] >> 2;
      if (rec === 0) water++;
      if (out.paths[i]) { road++; assert.equal(waterCorners(convertTile(out.tilemapBytes[i])), 0, `a road tile with no water under the feet (${i % 128}, ${Math.floor(i / 128)})`); }
    }
    if (wide) assert.equal(road, wide, 'two tiles wide, the pixel\'s length');
    assert.ok(water > 4000, `the water either side: ${water} tiles`);
    const climates = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) climates.push(maps.getClimateIndex(px + dx, py + dy));
    const dw = buildDeepWatersPixel({ px, py, samples: out.samples, tilemap: out.tilemap, tilemapBytes: out.tilemapBytes, climates, waterDepth: null, spawnSurfaces: true }, bake);
    assert.ok(dw.holes && dw.holes.some((v) => v === 0), `(${px}, ${py}): the sea beside the road carved`);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = y * 128 + x;
      if (!out.paths[i] || !PAVING.has(out.tilemapBytes[i] >> 2)) continue;
      paving++;
      for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) assert.ok(out.samples[cx * H + cy] >= CAPITAL_LAND, `(${px}, ${py}): the paving's corner (${cx}, ${cy}) over the sea's line`);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const fx = (x + (a + 0.5) / 4) / 128, fz = (y + (b + 0.5) / 4) / 128;
        assert.ok(!dw.holes || dw.holes[Math.floor(fz * n) * n + Math.floor(fx * n)] === 1, `(${px}, ${py}): no carve under the road at (${x}, ${y})`);
        assert.ok(!isLocalPointWater({ samples: out.samples, tilemap: out.tilemap }, fx, fz), `(${px}, ${py}): no water drawn over the road at (${x}, ${y})`);
      }
    }
    assert.ok(paving > 200, `(${px}, ${py}): ${paving} paving tiles`);
  }
});

test('CAUSEWAY the law: a step on his road into a water pixel and through a corner of the sea is taken; a track\'s, an open step\'s and a road half-drawn (one end\'s edge) are refused (mutants: the sea refused under the road; the corner refused; a track paved)', () => {
  const W = 9, H = 5;
  const roads = new Uint8Array(W * H), tracks = new Uint8Array(W * H);
  const bit = (dx, dy) => DIR_DELTA.find(([, x, y]) => x === dx && y === dy)[0];
  const join = (net, a, b) => { net[a.y * W + a.x] |= bit(b.x - a.x, b.y - a.y); net[b.y * W + b.x] |= bit(a.x - b.x, a.y - b.y); };
  // a sea column at x = 4, a road across it on row 1 and a track across it on row 3
  const isWater = (x, y) => x === 4 || (x === 5 && y === 0) || (x === 3 && y === 4);
  for (let x = 0; x < W - 1; x++) join(roads, { x, y: 1 }, { x: x + 1, y: 1 });
  for (let x = 0; x < W - 1; x++) join(tracks, { x, y: 3 }, { x: x + 1, y: 3 });
  const opts = { roads, tracks, isWater, width: W, height: H, margins: [W] };
  const road = planRoute({ x: 0, y: 1 }, { x: 8, y: 1 }, opts);
  assert.deepEqual(road?.kinds, Array(8).fill('road'), 'over the sea on his road');
  assert.equal(planRoute({ x: 0, y: 3 }, { x: 8, y: 3 }, { ...opts, roads: new Uint8Array(W * H) }), null, 'a track over it is a ford: no way by land');
  assert.equal(planRoute({ x: 0, y: 1 }, { x: 8, y: 1 }, { ...opts, roads: null, tracks: null }), null, 'open ground: no way by land');
  // a road half-drawn: the west end carries the edge, the water pixel does not
  const half = new Uint8Array(W * H);
  half[1 * W + 3] |= bit(1, 0);
  assert.equal(planRoute({ x: 0, y: 1 }, { x: 8, y: 1 }, { ...opts, roads: half, tracks: null }), null, 'a step on his road needs both ends');
  // his diagonal through a corner of the sea: a road from (3, 0) to (4, 1) passes between (4, 0) and (3, 1), both water
  const diag = new Uint8Array(W * H);
  const corner = (x, y) => (x === 4 && y === 0) || (x === 3 && y === 1);
  join(diag, { x: 3, y: 0 }, { x: 4, y: 1 });
  const cut = planRoute({ x: 3, y: 0 }, { x: 4, y: 1 }, { roads: diag, tracks: null, isWater: corner, width: W, height: H, margins: [W] });
  assert.deepEqual(cut?.kinds, ['road'], 'his diagonal through the corner');
  const round = planRoute({ x: 3, y: 0 }, { x: 4, y: 1 }, { roads: null, tracks: null, isWater: corner, width: W, height: H, margins: [W] });
  assert.ok(round && round.pixels.length > 2 && round.kinds.every((k) => k === 'open'), 'the open diagonal goes round: never through the corner');
});
