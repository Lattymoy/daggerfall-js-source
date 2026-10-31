// OWN-WORK2 (2026-10-31, the owner: "removing mods from outside authors and instead replacing them with our own work"):
// THE BAY'S NETWORK IS OURS. Hazelnut's four arrays are retired; world/roadsProducer.js builds the Bay's roads and tracks
// by the law the roads past the Bay take, and its rivers and streams by world/road/riverNetwork.js, from the player's own
// MAPS.BSA and WOODS.WLD. Pinned on made-up land here, and on the player's map where ARENA2 is (test/bayRoads.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCATION_TYPES as LT } from '../../../src/formats/mapsFile.js';
import { MAP_W, MAP_H, DIR_DELTA, ROAD_TYPES, TRACK_TYPES, landComponents } from '../../../src/world/road/roadNetwork.js';
import { buildRiverNetwork, riverPrices, reliefNoise, RIVER_DIALS } from '../../../src/world/road/riverNetwork.js';
import { RIVER_FORD } from '../../../src/world/road/roadLand.js';
import { buildRoadsFromSettlements, edgeGates, EDGE_GATE_SPACING, WATER_BYTE } from '../../../src/world/roadsProducer.js';
import { GENERATOR_VERSION, roadsCacheKey } from '../../../src/world/roadsCache.js';
import { arenaJoins } from '../../../src/world/arenaRoads.js';
import { bayRoads, bayArchives, BAY_SKIP } from '../../bayRoads.mjs';

/** Every bit a mask carries has its opposite on the neighbour it names - a path is a chain of steps. */
function lonelyBits(mask, W, H) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % W, y = (i - x) / W;
    DIR_DELTA.forEach(([bit, dx, dy], k) => {
      if (!(mask[i] & bit)) return;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !(mask[ny * W + nx] & DIR_DELTA[(k + 4) % 8][0])) n++;
    });
  }
  return n;
}
const count = (a) => a.reduce((n, v) => n + (v ? 1 : 0), 0);

// A valley running south down the middle of a 60 x 40 grid into a sea along its last rows; its sides climb a byte a pixel.
const W = 60, H = 40;
const valley = () => {
  const heights = new Uint8Array(W * H), water = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (y >= H - 4) { heights[i] = 2; water[i] = 1; continue; }
    heights[i] = 10 + (H - y) / 4 + Math.abs(x - 30) * 1;
  }
  return { heights, water, W, H };
};

test('OWN-WORK2 the rivers: the land drains down its valley to the sea - every step a chain, the mouth on the sea, none off the map but where the land ends, the same every run (mutants: no relief; the area law; the outlets)', () => {
  const g = valley();
  const dials = { riverArea: 400, streamArea: 60 };
  const a = buildRiverNetwork({ ...g, dials }), b = buildRiverNetwork({ ...g, dials });
  assert.deepEqual([a.rivers, a.streams], [b.rivers, b.streams], 'the same every run');
  assert.equal(lonelyBits(a.rivers, W, H), 0, 'a river is a chain of steps');
  assert.equal(lonelyBits(a.streams, W, H), 0, 'a stream too');
  // the river is the valley's floor, near x = 30, down to the sea
  const riverX = [];
  for (let y = 0; y < H - 4; y++) for (let x = 0; x < W; x++) if (a.rivers[y * W + x]) riverX.push(x);
  assert.ok(riverX.length >= 10, `a river runs (${riverX.length} pixels)`);
  assert.ok(riverX.every((x) => Math.abs(x - 30) <= 2), `on the valley's floor: ${[...new Set(riverX)]}`);
  assert.ok(a.stats.mouths >= 1, 'its mouth on the sea');
  assert.ok([...Array(W).keys()].some((x) => a.rivers[(H - 4) * W + x]), 'the sea\'s first row takes the mouth');
  assert.ok(count(a.streams) > 0, 'the sides\' gullies are streams');
  // nothing drains to a pixel that is not there: a river ends in the sea or in its own last pixel at the map's edge
  for (let x = 0; x < W; x++) assert.equal(a.rivers[x] & (128 | 64 | 1), 0, 'no bit off the north edge');
  // a smaller area law: more river
  assert.ok(count(buildRiverNetwork({ ...g, dials: { riverArea: 100, streamArea: 60 } }).rivers) > count(a.rivers));
});

test('OWN-WORK2 the rivers: a flat drains along its relief, less than a byte (mutant: the relief unread); a pond is drained through, the sea is ended in', () => {
  assert.ok(RIVER_DIALS.relief < 1, 'no water climbs a whole byte');
  for (let i = 0; i < 50; i++) { const v = reliefNoise(i * 3.7, i * 1.3, RIVER_DIALS.reliefPx); assert.ok(v >= 0 && v < 1); }
  const flat = { heights: new Uint8Array(W * H).fill(20), water: new Uint8Array(W * H), W, H };
  for (let x = 0; x < W; x++) { flat.water[(H - 1) * W + x] = 1; flat.heights[(H - 1) * W + x] = 2; }
  const dials = { riverArea: 150, streamArea: 40, pond: 5 };
  const bent = buildRiverNetwork({ ...flat, dials }), straight = buildRiverNetwork({ ...flat, dials: { ...dials, relief: 0 } });
  assert.notDeepEqual(bent.rivers, straight.rivers, 'the relief bends the flat\'s drainage');
  // a pond of four pixels in the valley: the river runs through it to the sea
  const g = valley();
  for (const [x, y] of [[30, 10], [31, 10], [30, 11], [31, 11]]) { g.water[y * W + x] = 1; g.heights[y * W + x] = 2; }
  const pond = buildRiverNetwork({ ...g, dials: { riverArea: 400, streamArea: 60, pond: 5 } });
  assert.equal(pond.stats.ponds, 4);
  assert.ok(pond.stats.mouths >= 1, 'the sea still ends it');
  const lake = buildRiverNetwork({ ...g, dials: { riverArea: 400, streamArea: 60, pond: 4 } });
  assert.equal(lake.stats.ponds, 0, 'four pixels of water are a lake at pond 4');
});

test('OWN-WORK2 the price of a crossing: a river two tiles of water, a stream one, as RIVER-FORDS prices a carved one', () => {
  const r = new Uint8Array([8, 0, 0]), s = new Uint8Array([0, 8, 0]);
  const p = riverPrices(r, s, RIVER_FORD);
  assert.ok(Math.abs(p[0] - (RIVER_FORD.cost + RIVER_FORD.perM * 12.8)) < 1e-4);
  assert.ok(Math.abs(p[1] - (RIVER_FORD.cost + RIVER_FORD.perM * 6.4)) < 1e-4);
  assert.equal(p[2], 0);
});

test('OWN-WORK2 the producer on made-up land: no road on the sea, a town on the shore\'s own pixel reached, a road that would run down a river runs beside it and crosses it once (mutants: the price unread; the place\'s pixel wet; the network unwatered)', () => {
  // the whole map dry at 30, a valley down x = 500 into a sea along the last rows, and a town on a wet pixel of the coast
  const h = (x, y) => (y >= 480 ? 2 : (x === 640 && y === 479 ? 3 : 30 + Math.min(12, Math.abs(x - 500)) + (480 - y) / 40));
  const woods = { getHeightMapValue: (x, y) => Math.round(h(x, y)) };
  const towns = [
    { x: 500, y: 100, type: LT.TownCity }, { x: 500, y: 400, type: LT.TownCity },
    { x: 640, y: 479, type: LT.TownHamlet }, { x: 640, y: 400, type: LT.TownHamlet },
  ];
  const net = buildRoadsFromSettlements(towns, woods, { rivers: { riverArea: 2000, streamArea: 600 } });
  assert.ok(net, 'a network builds');
  assert.ok(count(net.rivers) > 300, 'the valley carries a river');
  for (let i = 0; i < net.roads.length; i++) {
    const x = i % MAP_W, y = (i - x) / MAP_W;
    if (woods.getHeightMapValue(x, y) <= WATER_BYTE && !(x === 640 && y === 479)) assert.equal(net.roads[i] | net.tracks[i], 0, `no path on the sea at ${x},${y}`);
  }
  assert.ok(net.roads[479 * MAP_W + 640], 'the shore town\'s own pixel is its land, whatever its byte reads');
  let along = 0;
  for (let y = 110; y < 390; y++) if (net.roads[y * MAP_W + 500] && net.rivers[y * MAP_W + 500]) along++;
  assert.ok(along <= 2, `the road between the valley's towns runs beside the river, not down it (${along} pixels on it)`);
  for (const k of ['roads', 'tracks', 'rivers', 'streams']) assert.equal(lonelyBits(net[k], MAP_W, MAP_H), 0, `${k}: every step a chain`);
  for (let i = 0; i < net.roads.length; i++) assert.equal((net.rivers[i] | net.streams[i]) & (net.roads[i] | net.tracks[i]), 0, 'CANAL-ARM: no arm both a path and water');
  // the source: the network watered as it is built (CANAL-ARM)
  assert.match(readFileSync(new URL('../../../src/world/roadsProducer.js', import.meta.url), 'utf8'), /waterOffPaths\(Object\.assign\(net, \{ rivers, streams \}\)\)/);
});

test('OWN-WORK2 the ways out: a road node each EDGE_GATE_SPACING of an edge, at the dry pixel nearest its stretch\'s middle with three dry pixels in - none on the sea (mutants: the depth unread; the middle unsought)', () => {
  assert.equal(EDGE_GATE_SPACING, 100);
  const W2 = 300, H2 = 200, water = new Uint8Array(W2 * H2);
  for (let y = 0; y < H2; y++) for (let x = 0; x < 20; x++) water[y * W2 + x] = 1;   // the west edge the sea
  water[(H2 - 3) * W2 + 150] = 1;   // a pond three in from the south edge's middle
  const g = edgeGates(water, W2, H2, 100);
  assert.deepEqual(g.map((n) => [n.x, n.y]), [[50, 0], [150, 0], [250, 0], [50, 199], [151, 199], [250, 199], [299, 50], [299, 150]]);
  assert.ok(g.every((n) => n.type === LT.TownCity && n.name === null), 'road nodes, no place\'s name');
});

test('OWN-WORK2 the cache: the rivers ride the build, and the key moves with the land\'s and the rivers\' dials and the version', () => {
  assert.equal(GENERATOR_VERSION, 21);
  const settlements = [{ x: 1, y: 2, type: 0 }];
  const k = roadsCacheKey({ settlements, woodsLength: 9, land: null });
  assert.match(k, /"riverArea":5000/);
  assert.match(k, /"gradeCost":0\.0625/);
  assert.notEqual(roadsCacheKey({ settlements, woodsLength: 9, land: null, dials: { rivers: { riverArea: 1 } } }), k);
});

// ── THE PLAYER'S MAP ────────────────────────────────────────────

test('OWN-WORK2 the Bay\'s network on the player\'s map: four whole planes, every step a chain, no path on the sea - and the counts', { skip: BAY_SKIP }, () => {
  const net = bayRoads();
  const { woods } = bayArchives();
  for (const k of ['roads', 'tracks', 'rivers', 'streams']) {
    assert.equal(net[k].length, MAP_W * MAP_H, k);
    assert.equal(lonelyBits(net[k], MAP_W, MAP_H), 0, `${k}: every step a chain`);
  }
  let wet = 0;
  for (let i = 0; i < net.roads.length; i++) if ((net.roads[i] | net.tracks[i]) && woods.getHeightMapValue(i % MAP_W, Math.floor(i / MAP_W)) <= WATER_BYTE) wet++;
  assert.equal(wet, 0, 'no road or track on the sea');
  // measured 2026-10-31 on the freeware's data; a change to the law moves them, and this pin with it
  assert.deepEqual([count(net.roads), count(net.tracks), count(net.rivers), count(net.streams)], [14965, 28059, 1549, 3036]);
  assert.deepEqual([net.stats.roadNodes, net.stats.gates, net.stats.trackNodes, net.stats.unrouted, net.stats.islands], [1632, 22, 6411, 31, 24], 'the towns and the 22 ways out, the villages; the pairs the sea parts');
});

test('OWN-WORK2 every town is reached: on each land the towns are one network of roads and tracks - a town on its own island, or on the sea\'s own pixel, alone stands apart; the villages on it', { skip: BAY_SKIP }, () => {
  const net = bayRoads();
  const { woods, settlements } = bayArchives();
  const path = (i) => net.roads[i] | net.tracks[i];
  const piece = new Int32Array(MAP_W * MAP_H).fill(-1);
  let pieces = 0;
  for (let s = 0; s < piece.length; s++) {
    if (!path(s) || piece[s] >= 0) continue;
    const stack = [s];
    piece[s] = pieces;
    while (stack.length) {
      const i = stack.pop(), x = i % MAP_W, y = (i - x) / MAP_W;
      for (const [bit, dx, dy] of DIR_DELTA) if (path(i) & bit) { const j = (y + dy) * MAP_W + x + dx; if (piece[j] < 0) { piece[j] = pieces; stack.push(j); } }
    }
    pieces++;
  }
  // a town on a path, or within ROAD_DIALS.mergeNear (3) of one - a road that passes it joins it there (ROADS 17)
  const pieceOf = (t) => {
    for (let r = 0; r <= 3; r++) for (let y = t.y - r; y <= t.y + r; y++) for (let x = t.x - r; x <= t.x + r; x++) if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && piece[y * MAP_W + x] >= 0 && Math.hypot(x - t.x, y - t.y) <= 3) return piece[y * MAP_W + x];
    return -1;
  };
  const land = landComponents((x, y) => woods.getHeightMapValue(x, y) <= WATER_BYTE);
  const towns = settlements.filter((s) => ROAD_TYPES.has(s.type)), byLand = new Map();
  for (const t of towns) { const l = land[t.y * MAP_W + t.x]; byLand.set(l, [...(byLand.get(l) ?? []), t]); }
  let joined = 0, apart = [];
  for (const [l, ts] of byLand) {
    if (l === 0) { apart.push(...ts.map((t) => `${t.name} (on the sea)`)); continue; }
    if (ts.length < 2) continue;
    const ps = new Set(ts.map(pieceOf));
    if (ps.size === 1 && !ps.has(-1)) joined += ts.length; else apart.push(...ts.filter((t) => pieceOf(t) < 0).map((t) => t.name));
  }
  assert.equal(joined, 1601, 'the towns of every land with two or more, each land\'s one network');
  assert.deepEqual(apart.sort(), ['Antelibuton (on the sea)', 'Baghada (on the sea)', 'Millitor (on the sea)', 'Paponirea (on the sea)', 'Wadijerareg (on the sea)']);
  const villages = settlements.filter((s) => TRACK_TYPES.has(s.type));
  assert.ok(villages.filter((v) => pieceOf(v) >= 0).length >= villages.length - 11, 'the villages, inns and temples on the web');
});

test('OWN-WORK2 a probe in the Bay and past it: Daggerfall\'s road runs to Wayrest, Sentinel\'s to Satakalaam and Bergama; the Bay\'s roads reach its north, south and east edges, where the roads past the Bay meet them (TESA5)', { skip: BAY_SKIP }, () => {
  const net = bayRoads();
  const { woods, maps } = bayArchives();
  const at = (x, y) => net.roads[y * MAP_W + x];
  // over the roads alone, from a city's own pixel: the cities its piece reaches (within mergeNear, 3)
  const reach = (x0, y0) => {
    const seen = new Uint8Array(MAP_W * MAP_H), stack = [y0 * MAP_W + x0];
    seen[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % MAP_W, y = (i - x) / MAP_W;
      for (const [bit, dx, dy] of DIR_DELTA) if (at(x, y) & bit) { const j = (y + dy) * MAP_W + x + dx; if (!seen[j]) { seen[j] = 1; stack.push(j); } }
    }
    return (x, y) => { for (let v = y - 3; v <= y + 3; v++) for (let u = x - 3; u <= x + 3; u++) if (seen[v * MAP_W + u]) return true; return false; };
  };
  assert.ok(at(207, 213) && at(397, 343), 'Daggerfall (207, 213) and Sentinel (397, 343) on a road');
  assert.ok(reach(207, 213)(859, 244), 'High Rock: Daggerfall to Wayrest');
  const south = reach(397, 343);
  assert.ok(south(839, 302) && south(431, 472), 'Hammerfell: Sentinel to Satakalaam and Bergama');
  assert.ok(!south(207, 213), 'the Bay between the two shores - a ship\'s way, no road\'s');
  // past the Bay: the crossings stand where its roads reach its edges and the land goes on (here the Bay's own land law)
  const land = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && woods.getHeightMapValue(x, y) > WATER_BYTE;
  const sides = new Set(arenaJoins(net, (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? true : land(x, y))).map((j) => j.side));
  assert.deepEqual([...sides].sort(), ['E', 'N', 'S']);
  assert.ok(maps.regionCount > 0);
});
