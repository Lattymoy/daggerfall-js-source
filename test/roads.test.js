// ROADS 1+2: the network is OURS and the painter draws it. Pinned on a
// synthetic map because there is no ARENA2 here - the generator is pure
// for exactly this reason - and gated on the real one below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadNetwork, route, stamp, DIR, DIR_DELTA, MAP_W, MAP_H } from '../src/world/roadNetwork.js';
import { paintRoads, classify, TILE } from '../src/world/roadPainter.js';
import { LOCATION_TYPES as LT } from '../src/formats/mapsFile.js';

// A flat continent with a sea to the west and a ridge across the middle.
const flat = () => 20;
const seaWest = (x) => x < 100;
const ridge = (x, y) => (y >= 240 && y <= 260 ? 80 : 20);

test('ROADS 1: every road-grade town is reachable - the spanning tree strands nobody', () => {
  const locations = [
    { x: 200, y: 100, type: LT.TownCity }, { x: 260, y: 120, type: LT.TownHamlet },
    { x: 400, y: 300, type: LT.TownCity },   // far from the others: only the tree reaches it
    { x: 210, y: 130, type: LT.TownVillage }, // a track node
    { x: 205, y: 105, type: LT.DungeonLabyrinth }, // gets nothing
  ];
  const { roads, tracks, stats } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  assert.equal(stats.roadNodes, 3); assert.equal(stats.trackNodes, 1); assert.equal(stats.unrouted, 0);
  for (const l of locations.filter((l) => l.type === LT.TownCity || l.type === LT.TownHamlet)) {
    assert.ok(roads[l.y * MAP_W + l.x] !== 0, `town at ${l.x},${l.y} has a road`);
  }
  assert.ok(tracks[130 * MAP_W + 210] !== 0, 'the village has a track');
  assert.equal(roads[105 * MAP_W + 205] | tracks[105 * MAP_W + 205], 0, 'the dungeon gets no path');
  // Every bit set has its partner: a step's two ends point at each other.
  let steps = 0;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const m = roads[y * MAP_W + x]; if (!m) continue;
    for (const [bit, dx, dy] of DIR_DELTA) {
      if (!(m & bit)) continue; steps++;
      const back = DIR_DELTA.find(([, ex, ey]) => ex === -dx && ey === -dy)[0];
      assert.ok(roads[(y + dy) * MAP_W + x + dx] & back, `${x},${y} bit ${bit} has no partner`);
    }
  }
  assert.ok(steps > 100, 'a real network was drawn');
});

const D = { climbCost: 40, descentCost: 10, highCost: 0.08, highAbove: 40, roadDiscount: 0.5 };
const blank = () => new Uint8Array(MAP_W * MAP_H);

test('ROADS 1: routes refuse water - a lake ON the line is walked around', () => {
  const a = { x: 150, y: 250 }, b = { x: 350, y: 250 };
  const lake = (x, y) => x >= 240 && x <= 260 && y >= 230 && y <= 270;
  const path = route(a, b, { heightAt: flat, isWater: lake, existing: blank(), d: D });
  assert.ok(path, 'a route exists');
  for (const p of path) assert.ok(!lake(p.x, p.y), `never on water (${p.x},${p.y})`);
  // Step count is no measure of a detour on an 8-connected grid - the
  // diagonals cover the lake's height for free - so measure the swing.
  const swing = Math.max(...path.map((p) => Math.abs(p.y - 250)));
  assert.ok(swing >= 21, `and it swung clear of the lake (${swing} rows)`);
});

test('ROADS 1: the climb dial is what moves a road around a hill', () => {
  // A hill UNDER highAbove, so only climbCost can see it - and STEEP:
  // radius 6 rising to 38, three units a step. A gentle bump SHOULD be
  // crossed rather than skirted, and the first draft of this pin asked
  // for the wrong thing; a road-builder skirts the steep one.
  const hill = (x, y) => { const r = Math.hypot(x - 250, y - 250); return r <= 6 ? 38 - r * 3 : 20; };
  const a = { x: 150, y: 250 }, b = { x: 350, y: 250 };
  const free = route(a, b, { heightAt: hill, isWater: () => false, existing: blank(), d: { ...D, climbCost: 0, descentCost: 0 } });
  const paid = route(a, b, { heightAt: hill, isWater: () => false, existing: blank(), d: D });
  const high = (p) => p.filter((q) => hill(q.x, q.y) > 30).length;
  assert.equal(free.length, 201, 'with climb free, the straight line over the top');
  assert.ok(high(free) > 0, 'and that line does cross the bump');
  assert.ok(high(paid) < high(free), `with climb paid, fewer steps on the hill (${high(paid)} vs ${high(free)})`);
});

test('ROADS 1: a track stops the moment it touches the road', () => {
  const roads = new Uint8Array(MAP_W * MAP_H);
  stamp(roads, [{ x: 300, y: 300 }, { x: 301, y: 300 }, { x: 302, y: 300 }, { x: 303, y: 300 }]);
  const path = route({ x: 301, y: 310 }, { x: 303, y: 300 }, { heightAt: flat, isWater: () => false, existing: roads, d: D, stopOn: roads });
  const last = path[path.length - 1];
  assert.ok(roads[last.y * MAP_W + last.x] !== 0, 'ends ON the road');
  assert.ok(path.length <= 11, 'and did not walk along it into town');
});

test('ROADS 2: a straight N-S road is two tiles wide down the centre, with edges', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  const n = paintRoads(tileData, tilemap, DIR.N | DIR.S, 0);
  assert.ok(n > 0);
  for (let y = 0; y < 128; y++) {
    assert.equal(tilemap[y * 128 + 63] & 0x3f, TILE.road, `row ${y} col 63 is road`);
    assert.equal(tilemap[y * 128 + 64] & 0x3f, TILE.road, `row ${y} col 64 is road`);
    assert.equal(tilemap[y * 128 + 62] & 0x3f, TILE.roadGrass, `row ${y} col 62 is the grass edge`);
    assert.equal(tilemap[y * 128 + 65] & 0x3f, TILE.roadGrass, `row ${y} col 65 is the grass edge`);
    assert.equal(tilemap[y * 128 + 61], 0, 'and col 61 is untouched');
  }
  // col 64 carries the FLIP bit so the two halves mirror into one surface.
  assert.ok(tilemap[10 * 128 + 64] & TILE.FLIP);
  assert.ok(!(tilemap[10 * 128 + 63] & TILE.FLIP));
});

test('ROADS 2: N alone paints only the northern half - row 127 is north', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  paintRoads(tileData, tilemap, DIR.N, 0);
  assert.equal(tilemap[127 * 128 + 63] & 0x3f, TILE.road, 'reaches the north edge (row 127)');
  assert.equal(tilemap[64 * 128 + 63] & 0x3f, TILE.road, 'from the centre');
  assert.equal(tilemap[63 * 128 + 63], 0, 'and stops there');
  assert.equal(tilemap[0 * 128 + 63], 0, 'the south edge is bare');
});

test('ROADS 2: a diagonal is one tile wide on the diagonal, and the location rect is left alone', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  paintRoads(tileData, tilemap, DIR.NE, 0, { x: 60, y: 60, w: 8, h: 8 });
  assert.equal(tilemap[100 * 128 + 100] & 0x3f, TILE.road, 'on x==y');
  assert.equal(tilemap[100 * 128 + 101] & 0x3f, TILE.roadGrass, 'flanked');
  assert.equal(tilemap[100 * 128 + 102], 0, 'one tile wide');
  assert.equal(tilemap[64 * 128 + 64], 0, 'the location rect is untouched');
  assert.equal(tilemap[50 * 128 + 50], 0, 'the SW half is bare - NE alone');
});

test('ROADS 2: water is never paved, and a track shows dirt through grass only', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.water);
  const tilemap = new Uint8Array(128 * 128);
  assert.equal(paintRoads(tileData, tilemap, DIR.N | DIR.S, 0), 0, 'a road bit over water paints nothing');
  const grass = new Uint8Array(129 * 129).fill(TILE.grass);
  const t = new Uint8Array(128 * 128);
  paintRoads(grass, t, 0, DIR.E | DIR.W);
  assert.equal(t[63 * 128 + 100] & 0x3f, 11, 'a track on grass is worn dirt');
  const dirt = new Uint8Array(129 * 129).fill(TILE.dirt);
  const t2 = new Uint8Array(128 * 128);
  assert.equal(paintRoads(dirt, t2, 0, DIR.E | DIR.W), 0, 'a track on dirt is invisible and paints nothing');
});

test('ROADS 2: classify - the centre of any arm wins over the edge of another', () => {
  // A crossroads: tile (63,64) is centre of both N and E arms.
  const c = classify(63, 64, DIR.N | DIR.E);
  assert.equal(c.centre, true);
  // (62,64) is the N arm's west edge - and NOT on the E arm.
  assert.equal(classify(62, 64, DIR.N | DIR.E).centre, false);
  assert.equal(classify(10, 10, DIR.N), null, 'far from any arm');
});

test('ROADS: the solo pipeline is byte-for-byte unchanged with no network', async () => {
  const src = (await import('node:fs')).readFileSync('src/world/terrainGen.js', 'utf8');
  assert.match(src, /roads = null/, 'the seam defaults to no network');
  assert.match(src, /if \(roads\) \{/, 'and paints only when one is handed in');
});

// ROADS 3: THE PRODUCER, and the wire. The generator is pure so the
// producer is the only thing that touches the archives; pinned on a
// stub MapsFile and a stub WoodsFile so the enumeration and the water
// threshold are proven here, and on the source for the two kernels.
test('ROADS 3: every region\'s map table becomes settlements, a dead region contributes nothing', async () => {
  const { settlementsOf, WATER_BYTE, buildRoadsFromArchives } = await import('../src/world/roadsProducer.js');
  // longitude/latitude -> pixel is mapsFile's own law: x = lon/128, y = 499 - lat/128.
  const maps = {
    regionCount: 3,
    getRegion: (r) => (r === 1 ? null : {
      mapTable: [
        { longitude: 200 * 128, latitude: (499 - 100) * 128, locationType: LT.TownCity },
        { longitude: 260 * 128, latitude: (499 - 120) * 128, locationType: LT.TownHamlet },
        null,
      ],
    }),
  };
  const s = settlementsOf(maps);
  assert.equal(s.length, 4, 'two rows per live region, the null row skipped, the dead region skipped');
  assert.deepEqual({ x: s[0].x, y: s[0].y, type: s[0].type, region: s[0].region }, { x: 200, y: 100, type: LT.TownCity, region: 0 });

  // WATER is the sampler's beach line, in WOODS units - 5.0 * 8 / 8.
  assert.equal(WATER_BYTE, 5, 'the threshold is the sampler\'s constant divided back, not a second number');
  // A lake BETWEEN the two towns, on the straight line (200,100)-(260,120),
  // so the route has to want to cross it - a sea off to one side is a
  // pin that cannot fail, and the first draft of this one was exactly that.
  const lake = (x, y) => x >= 225 && x <= 235 && y >= 90 && y <= 130;
  // The lake is a FLAT sea, one unit below the shore: a deep pit would
  // be refused by the climb dial alone and the water rule would never
  // be the thing on trial (that mutant survived the first fixture).
  const woods = { getHeightMapValue: (x, y) => (lake(x, y) ? WATER_BYTE : WATER_BYTE + 1) };
  const net = buildRoadsFromArchives(maps, woods);
  assert.ok(net, 'a network builds');
  assert.equal(net.stats.settlements, 4);
  assert.ok(net.stats.roadEdges >= 1, 'the two road-grade towns are joined');
  assert.equal(net.stats.unrouted, 0, 'and the route around the lake was found');
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (lake(x, y)) assert.equal(net.roads[y * MAP_W + x], 0, `no road on the lake at ${x},${y}`);
  }
  // And a producer that cannot read the archive answers null, not a throw.
  assert.equal(buildRoadsFromArchives({ get regionCount() { throw new Error('bad'); } }, woods), null);
});

test('ROADS 3: the network rides both terrain kernels and the world host builds it once', async () => {
  const fs = await import('node:fs');
  const worker = fs.readFileSync('src/world/terrainGenWorker.js', 'utf8');
  assert.match(worker, /m\.t === 'roads'/, 'the worker accepts the network');
  assert.match(worker, /generatePixelTerrain\(\{ \.\.\.m, woods, roads \}\)/, 'and hands it to the kernel on every job');
  const client = fs.readFileSync('src/world/terrainGenClient.js', 'utf8');
  assert.match(client, /setRoads\(net\)/, 'the client has the door');
  assert.equal((client.match(/roads: this\._roads \?\? null/g) || []).length, 3,
    'every same-thread path - direct, post-death drain, and dying-worker fallback - carries it');
  assert.match(client, /\.slice\(\)/, 'the worker gets a COPY (the RA1 law)');
  const host = fs.readFileSync('src/scenes/world.js', 'utf8');
  assert.match(host, /buildRoadsFromArchives\(maps, woods\)/, 'the host builds it from the archives');
  assert.match(host, /terrainGen\.setRoads\(net\)/, 'and hands it over');
});
