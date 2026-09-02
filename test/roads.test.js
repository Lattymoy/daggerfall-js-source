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
    { x: 230, y: 118, type: LT.TownVillage }, // a track node, 8 px off the A-B road (ROADS 15: his reach)
    { x: 150, y: 300, type: LT.DungeonLabyrinth }, // gets nothing - and sits OFF every line, since a road passing a dungeon is fine; a path TO one is not
  ];
  const { roads, tracks, stats } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  assert.equal(stats.roadNodes, 3); assert.equal(stats.trackNodes, 1); assert.equal(stats.unrouted, 0);
  for (const l of locations.filter((l) => l.type === LT.TownCity || l.type === LT.TownHamlet)) {
    assert.ok(roads[l.y * MAP_W + l.x] !== 0, `town at ${l.x},${l.y} has a road`);
  }
  assert.ok(tracks[118 * MAP_W + 230] !== 0, 'the village has a track');
  assert.equal(roads[300 * MAP_W + 150] | tracks[300 * MAP_W + 150], 0, 'the dungeon gets no path');
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
const ORDER8 = [DIR.N, DIR.NE, DIR.E, DIR.SE, DIR.S, DIR.SW, DIR.W, DIR.NW];
// every pair of compass indices at least three points (135 degrees) apart
const wide = (idxs) => idxs.every((a, i) => idxs.every((b, j) => i === j || Math.min(Math.abs(a - b), 8 - Math.abs(a - b)) >= 3));

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
  // AUDIT 45 F4: the row just past the centre takes the EDGE tile as a
  // cap, so the road rounds off rather than ending on a knife edge...
  assert.equal(tilemap[63 * 128 + 63] & 0x3f, TILE.roadGrass, 'the cap');
  assert.equal(tilemap[62 * 128 + 63], 0, '...and stops there');
  assert.equal(tilemap[0 * 128 + 63], 0, 'the south edge is bare');
});

test('ROADS 2: a diagonal is one tile wide on the diagonal, and the location rect is left alone', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  // The rect is setLocationTiles' inclusive {xMin,xMax,yMin,yMax}. The
  // first draft of this pin sent {x,y,w,h}, which the seam never does,
  // and passed against a guard that compared to undefined (ROADS 5).
  paintRoads(tileData, tilemap, DIR.NE, 0, { xMin: 60, xMax: 67, yMin: 60, yMax: 67 });
  assert.equal(tilemap[100 * 128 + 100] & 0x3f, TILE.road, 'on x==y');
  assert.equal(tilemap[100 * 128 + 101] & 0x3f, TILE.roadGrass, 'flanked');
  assert.equal(tilemap[100 * 128 + 102], 0, 'one tile wide');
  assert.equal(tilemap[64 * 128 + 64], 0, 'the location rect is untouched');
  assert.equal(tilemap[67 * 128 + 67], 0, 'to its inclusive far corner');
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
  assert.equal(c.centre, true, 'and F4\'s cap does not steal it - the E arm\'s cap position IS this tile');
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
  assert.match(client, /setRoads\(settlements, onStats = null\)/, 'the client has the door');
  assert.equal((client.match(/roads: this\._roads \?\? null/g) || []).length, 3,
    'every same-thread path - direct, worker-error, and dying-worker drain - carries it');
  // AUDIT ROADS F2: the worker BUILDS; this thread builds only on a
  // fallback path, and every one of the three calls _roadsFallback first.
  assert.equal((client.match(/this\._roadsFallback\(\);/g) || []).length, 4,
    'setRoads-with-no-worker plus all three same-thread paths rebuild lazily');
  assert.match(worker, /buildRoadsFromSettlements\(m\.settlements, woods\)/, 'the worker builds with its own woods');
  const host = fs.readFileSync('src/scenes/world.js', 'utf8');
  assert.match(host, /terrainGen\.setRoads\(settlementsOf\(maps\)/, 'the host enumerates and hands the LIST over - the build never touches the frame');
});

// AUDIT ROADS (2026-09-01): the fixes, each pinned - the sweep found all
// three fixes UNPINNED, which is the vacuous shape this bible keeps
// catching, so the audit's first product is these.
test('AUDIT ROADS F1: a farm gets no track - it sits in the fields it works', async () => {
  const { TRACK_TYPES, ROAD_TYPES } = await import('../src/world/roadNetwork.js');
  assert.ok(!TRACK_TYPES.has(LT.HomeFarms), 'HomeFarms is the most numerous location type on the map');
  // ROADS 16: HomeWealthy is BACK - 74% of them sit on a Basic Roads
  // track, far above the 47% a random location gets from density alone.
  // F1's exclusion was a guess; the answer key overruled it.
  assert.ok(TRACK_TYPES.has(LT.HomeWealthy), 'an estate gets a track - the answer key says so');
  assert.ok(TRACK_TYPES.has(LT.ReligionCult) && TRACK_TYPES.has(LT.Coven), 'cults 63%, covens 71%');
  assert.ok(!TRACK_TYPES.has(LT.DungeonLabyrinth) && !ROAD_TYPES.has(LT.DungeonLabyrinth));
  // And the behaviour: a farm beside a town gets nothing, a village does.
  const locations = [
    { x: 200, y: 100, type: LT.TownCity }, { x: 260, y: 120, type: LT.TownHamlet },
    { x: 230, y: 118, type: LT.HomeFarms }, { x: 250, y: 108, type: LT.TownVillage },
  ];
  const { tracks } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  assert.equal(tracks[118 * MAP_W + 230], 0, 'the farm has no track');
  assert.ok(tracks[108 * MAP_W + 250] !== 0, 'the village does');
});

test('AUDIT ROADS F6: two villages a mile apart share the last mile', () => {
  // Two villages south of one town, side by side: the second track
  // must JOIN the first rather than run a parallel rut to the town.
  const locations = [
    { x: 200, y: 100, type: LT.TownCity }, { x: 300, y: 100, type: LT.TownHamlet },
    { x: 200, y: 130, type: LT.TownVillage }, { x: 203, y: 130, type: LT.TownVillage },
  ];
  const { tracks } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  // Count track pixels on the rows between the villages and the town.
  let cells = 0;
  for (let y = 101; y < 130; y++) for (let x = 190; x < 215; x++) if (tracks[y * MAP_W + x]) cells++;
  // Two independent 29-step tracks would be ~58 cells; a shared last
  // mile is well under that. The bound has slack for the join itself.
  assert.ok(cells <= 40, `the second village joined the first's track (${cells} track cells, not ~58)`);
});

test('AUDIT ROADS F3: the heuristic is scaled by the road discount, so A* still finds the merge', async () => {
  const { route } = await import('../src/world/roadNetwork.js');
  // An existing road runs E-W across y=120. A new route from (250,100)
  // to (250,140) crosses it; a route from (250,100) to (290,120)
  // should RIDE it - the discounted steps along the road are cheaper
  // than the diagonal, but only an admissible heuristic lets A* see
  // that, because Euclidean h over-estimates a half-price step.
  const roads = new Uint8Array(MAP_W * MAP_H);
  const line = []; for (let x = 200; x <= 300; x++) line.push({ x, y: 120 });
  stamp(roads, line);
  const path = route({ x: 250, y: 100 }, { x: 290, y: 120 }, { heightAt: flat, isWater: () => false, existing: roads, d: D });
  const onRoad = path.filter((p) => roads[p.y * MAP_W + p.x] !== 0).length;
  assert.ok(onRoad >= 20, `the route rides the existing road for most of its length (${onRoad} of ${path.length} steps on it)`);
  // RECORDED: an inadmissible heuristic MAY miss the optimum; it does not
  // always, and on this fixture it does not - both h find the same 41
  // steps. So the behaviour above is a regression guard, not the proof.
  // The guarantee is pinned at the source: h carries the discount.
  const src = (await import('node:fs')).readFileSync('src/world/roadNetwork.js', 'utf8');
  assert.match(src, /Math\.hypot\(x - to\.x, y - to\.y\) \* d\.roadDiscount/,
    'h is scaled by the cheapest step, which is what admissibility requires');
});

test('ROADS 5: a town is RINGED, and the arm joins the ring instead of ending in a field', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  const rect = { xMin: 56, xMax: 71, yMin: 56, yMax: 71 };
  paintRoads(tileData, tilemap, DIR.N, 0, rect);
  // inside the rect: nothing
  assert.equal(tilemap[64 * 128 + 64], 0, 'the streets are left alone');
  assert.equal(tilemap[70 * 128 + 58], 0, 'the clearance band too');
  // the ring: two tiles of road just outside, on every side
  for (const [x, y] of [[54, 64], [55, 64], [72, 64], [73, 64], [64, 54], [64, 55], [64, 72], [64, 73], [54, 54], [73, 73]]) {
    assert.equal(tilemap[y * 128 + x] & 0x3f, TILE.road, `ring at ${x},${y}`);
  }
  // an edge tile one further out
  assert.equal(tilemap[64 * 128 + 53] & 0x3f, TILE.roadGrass, 'the ring has an edge');
  assert.equal(tilemap[64 * 128 + 52], 0, 'and stops');
  // the N arm runs from the ring to the north edge, not from the centre
  assert.equal(tilemap[100 * 128 + 63] & 0x3f, TILE.road, 'the arm');
  assert.equal(tilemap[74 * 128 + 63] & 0x3f, TILE.road, 'meets the ring');
  // and a rect that runs off the tile grid rings on the sides that fit
  const t2 = new Uint8Array(128 * 128);
  paintRoads(tileData, t2, DIR.S, 0, { xMin: -4, xMax: 20, yMin: 100, yMax: 130 });
  assert.equal(t2[98 * 128 + 10] & 0x3f, TILE.road, 'the south side rings');
});

// ROADS 5 (2026-09-01, Mac's first real-data look: "the roads are
// extremely jagged"): A ROAD-BUILDER LAYS STRAIGHT STRETCHES. Plain A*
// on an 8-connected grid draws a 1-in-10 slope as nine E and one NE,
// over and over, and the painter turns each change into a 135-degree
// kink at a pixel centre. With the heading in the search state and a
// price on every 45 degrees of change, the route prefers "E for a
// while, then NE for a while" - the same length, a fraction of the
// corners.
test('ROADS 5: the turn cost turns a staircase into stretches', () => {
  const a = { x: 150, y: 250 }, b = { x: 350, y: 270 };   // a 1-in-10 slope
  const turns = (path) => {
    let n = 0; let last = null;
    for (let k = 0; k + 1 < path.length; k++) {
      const dir = `${path[k + 1].x - path[k].x},${path[k + 1].y - path[k].y}`;
      if (last !== null && dir !== last) n++;
      last = dir;
    }
    return n;
  };
  const free = route(a, b, { heightAt: flat, isWater: () => false, existing: blank(), d: { ...D, turnCost: 0 } });
  const paid = route(a, b, { heightAt: flat, isWater: () => false, existing: blank(), d: D });
  assert.ok(turns(free) >= 6, `plain A* staircases a 1-in-10 slope (${turns(free)} turns)`);
  assert.ok(turns(paid) <= 2, `the turn cost lays it as at most two stretches (${turns(paid)} turns)`);
  assert.equal(paid.length, free.length, 'and it is no longer - the same 8-connected length');
  // The dial is a dial: a caller's object that predates it takes the default.
  const legacy = route(a, b, { heightAt: flat, isWater: () => false, existing: blank(), d: { climbCost: 40, descentCost: 10, highCost: 0.08, highAbove: 40, roadDiscount: 0.5 } });
  assert.ok(legacy && legacy.length === paid.length, 'a missing dial defaults rather than poisoning the cost');
});

// ROADS 6, CORRECTED BY ROADS 18 on the real map: HIS ROADS GO THROUGH
// THE TOWNS. 92% of his 1,610 city and hamlet pixels carry road bits -
// 55% two bits, 29% junctions AT the town - and only 122 are empty. The
// 890 "arcs" ROADS 6 measured were around empty pixels that were not
// towns; his map holds three ringed towns in total. So a ROAD-GRADE
// town is a waypoint: a road passes through it and junctions at it.
// What ROADS 6 got right stands: everything else - a village on the
// line between two cities - is walked around, never painted through,
// and no corner is cut past it.
test('ROADS 6/18: a town between two others is passed THROUGH, a village in the way is walked around', () => {
  const A = { x: 200, y: 200, type: LT.TownCity }, B = { x: 230, y: 200, type: LT.TownHamlet }, C = { x: 260, y: 200, type: LT.TownCity };
  const V = { x: 245, y: 200, type: LT.TownVillage };   // on the B-C line
  const { roads } = buildRoadNetwork({ locations: [A, B, C, V], heightAt: flat, isWater: () => false, dials: { neighbours: 3, roadReach: 100 } });
  const at = (x, y) => roads[y * MAP_W + x];
  const bitsB = at(B.x, B.y);
  const idxs = ORDER8.filter((b) => bitsB & b).map((b) => ORDER8.indexOf(b));
  assert.ok(idxs.length >= 2, `B is passed through, not a spur (${idxs.length} bits)`);
  assert.ok(wide(idxs), 'every pair of B\'s bits is at least 135 degrees apart - through, or a gentle bend, never a corner');
  const bitsV = at(V.x, V.y);
  assert.ok(!((bitsV & DIR.E) && (bitsV & DIR.W)), 'the B-C road did not cut across the village pixel');
  assert.ok(at(V.x, V.y - 1) || at(V.x, V.y + 1), 'it went around instead');
  assert.ok(at(V.x - 1, V.y + 1) || at(V.x - 1, V.y - 1) || at(V.x + 1, V.y + 1) || at(V.x + 1, V.y - 1), 'through a corner pixel, no corner cut');
});

// ROADS 7 (2026-09-01, Mac: "always on"): THE MAP DRAWS THE NETWORK. The
// enhanced travel map is the overworld relief, one vertex per map pixel,
// so a road is a tinted vertex and the triangles between neighbours
// draw it as a thread. The arrays live in the worker after Audit 45 F2,
// so they come back ONCE for the map and the window rebuilds its grid
// the first time it opens with them.
test('ROADS 7: a road vertex on the relief is tinted, a track fainter, water never', async () => {
  const { buildOverworldGrid, OVERWORLD_ROAD, OVERWORLD_TRACK, overworldTint } = await import('../src/ui/overworldModel.js');
  const W = 8, H = 4;
  const bytes = new Uint8Array(W * H).fill(40);
  bytes[1 * W + 6] = 0;   // a water pixel
  const path = new Uint8Array(W * H);
  path[1 * W + 2] = 2; path[1 * W + 3] = 1; path[1 * W + 6] = 2;   // road, track, and a road bit on water
  const grid = buildOverworldGrid({ heightBytes: bytes, width: W, height: H, climateAt: () => 227, pathAt: (x, y) => path[y * W + x] });
  const rgb = (x, y) => [0, 1, 2].map((c) => grid.colors[(y * W + x) * 3 + c]);
  const plain = rgb(1, 1), road = rgb(2, 1), track = rgb(3, 1), water = rgb(6, 1);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.ok(dist(road, OVERWORLD_ROAD) < dist(plain, OVERWORLD_ROAD), 'the road vertex leans hard toward the road colour');
  assert.ok(dist(track, OVERWORLD_TRACK) < dist(plain, OVERWORLD_TRACK), 'the track vertex leans toward the track colour');
  assert.ok(dist(road, OVERWORLD_ROAD) < dist(track, OVERWORLD_ROAD), 'and the track is the fainter of the two');
  assert.deepEqual(water, overworldTint(227, 0).map((v) => Math.min(255, v | 0)), 'a road bit on water tints nothing - the map shows the terrain');

  const fs = await import('node:fs');
  const worker = fs.readFileSync('src/world/terrainGenWorker.js', 'utf8');
  assert.match(worker, /net: back/, 'the worker posts the arrays back for the map');
  const client = fs.readFileSync('src/world/terrainGenClient.js', 'utf8');
  assert.match(client, /roads\(\) \{ return this\._roads; \}/, 'and the client exposes them');
  const map = fs.readFileSync('src/ui/overworldMap.js', 'utf8');
  assert.match(map, /grid\.roadsRef !== net/, 'a grid drawn before the network landed is rebuilt with it');
  const host = fs.readFileSync('src/scenes/world.js', 'utf8');
  assert.match(host, /roads: \(\) => terrainGen\.roads\(\)/, 'the host hands the accessor through the door');
});

// ROADS 8 (Audit 45 F7, finished): A STRANDED TOWN IS NAMED. The other
// half landed the pairs with pixels and region; this half puts the
// town's own name on the row and on the pair, so the log reads
// "no route: Daggerfall (207,213) Daggerfall -> ..." and is a place to
// go and look.
test('ROADS 8: settlements carry their names, and an unrouted pair carries both', async () => {
  const { settlementsOf } = await import('../src/world/roadsProducer.js');
  const maps = { regionCount: 1, getRegion: () => ({
    mapNames: ['Daggerfall', 'Ilessan Hills'],
    mapTable: [
      { longitude: 207 * 128, latitude: (499 - 213) * 128, locationType: LT.TownCity },
      { longitude: 700 * 128, latitude: (499 - 213) * 128, locationType: LT.TownCity },
    ],
  }) };
  const rows = settlementsOf(maps);
  assert.deepEqual(rows.map((r) => r.name), ['Daggerfall', 'Ilessan Hills'], 'the name rides the row, by index');
  // An island: the second town is ringed by water, so no route exists.
  const island = (x, y) => Math.hypot(x - 700, y - 213) > 3 && Math.hypot(x - 700, y - 213) < 8;
  const { stats } = buildRoadNetwork({ locations: rows, heightAt: flat, isWater: island, dials: { roadReach: 600 } });
  assert.equal(stats.unrouted, 1);
  assert.deepEqual(stats.unroutedPairs[0].map((l) => l.name).sort(), ['Daggerfall', 'Ilessan Hills'], 'the pair is named at both ends');
  const host = (await import('node:fs')).readFileSync('src/scenes/world.js', 'utf8');
  assert.match(host, /\$\{l\.name \?\? '\?'\}/, 'and the log prints the name');
});

// ROADS 9 (Audit 45 F4): THE CAP. A road that ends - N without S -
// used to stop in a square stub. The two edge tiles on the row the arm
// starts from now turn to meet in a point, and when the road turns
// instead of ending, the same tiles are the outer corner.
test('ROADS 9: a dead-end arm is capped, a through road is not, and a turn wears the corner', () => {
  const grass = () => new Uint8Array(129 * 129).fill(TILE.grass);
  const t = new Uint8Array(128 * 128);
  paintRoads(grass(), t, DIR.N, 0);
  // the cap: row 63, columns 63/64 - edge tiles, rotated on 63, flipped on 64
  assert.equal(t[63 * 128 + 63] & 0x3f, TILE.roadGrass, 'the cap\u2019s left tile');
  assert.equal(t[63 * 128 + 64] & 0x3f, TILE.roadGrass, 'the cap\u2019s right tile');
  assert.ok(t[63 * 128 + 63] & TILE.ROTATE, 'turned on the left');
  assert.ok(!(t[63 * 128 + 63] & TILE.FLIP));
  assert.ok(t[63 * 128 + 64] & TILE.FLIP, 'mirrored on the right');
  assert.equal(t[62 * 128 + 63], 0, 'and nothing below it - the road ends');
  // a through road: those tiles are centre, not cap
  const u = new Uint8Array(128 * 128);
  paintRoads(grass(), u, DIR.N | DIR.S, 0);
  assert.equal(u[63 * 128 + 63] & 0x3f, TILE.road, 'N|S: the same tile is road, not a cap');
  // a turn: N|E - (64,63) is the E arm\u2019s centre, (63,63) the corner\u2019s outer edge
  const v = new Uint8Array(128 * 128);
  paintRoads(grass(), v, DIR.N | DIR.E, 0);
  assert.equal(v[63 * 128 + 64] & 0x3f, TILE.road, 'the turn\u2019s inner tile is road');
  assert.equal(v[63 * 128 + 63] & 0x3f, TILE.roadGrass, 'its outer tile is the corner edge');
});

// ROADS 10 (Audit 45's item 7): THE GROUND UNDER THE ROAD IS SMOOTHED.
// One pass, read from the original heights, only the corners a path
// tile touches. Off-road terrain does not move.
test('ROADS 10: road corners are blurred, the rest of the terrain is untouched, and the switch is honoured', async () => {
  const { smoothRoadHeights } = await import('../src/world/roadPainter.js');
  const H = 129, T = 128;
  // noisy ground: alternating high/low samples
  const mk = () => { const s = new Float32Array(H * H); for (let i = 0; i < s.length; i++) s[i] = (i % 2) ? 50 : 30; return s; };
  const samples = mk();
  const tilemap = new Uint8Array(T * T);
  paintRoads(new Uint8Array(H * H).fill(TILE.grass), tilemap, DIR.N | DIR.S, 0);   // a road down columns 63/64
  const before = Float32Array.from(samples);
  const n = smoothRoadHeights(samples, tilemap);
  assert.ok(n > 0, 'some corners were smoothed');
  // under the road (column 63/64, plus the edge tiles' corners 62..66): flatter
  const spread = (x0, x1, s) => { let lo = Infinity, hi = -Infinity; for (let y = 10; y < 118; y++) for (let x = x0; x <= x1; x++) { const v = s[y * H + x]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  assert.ok(spread(63, 64, samples) < spread(63, 64, before), `the road bed is flatter (${spread(63, 64, samples).toFixed(1)} vs ${spread(63, 64, before)})`);
  // far from the road: byte-identical
  for (let y = 0; y < H; y++) for (let x = 0; x < 50; x++) assert.equal(samples[y * H + x], before[y * H + x], `off-road sample ${x},${y} moved`);
  // no path tiles: nothing happens
  const plain = mk(); const copy = Float32Array.from(plain);
  assert.equal(smoothRoadHeights(plain, new Uint8Array(T * T)), 0);
  assert.deepEqual(plain, copy);
  // the switch rides the network object, default on
  const src = (await import('node:fs')).readFileSync('src/world/terrainGen.js', 'utf8');
  assert.match(src, /if \(roads\.smooth !== false\) smoothRoadHeights\(samples, tilemap\);/, 'default on, off only when the network says so');
});

// ROADS 11 (Audit 45 F5, corrected, and F8): the sweep holds one region
// at a time under autoDiscard and puts back the one it found loaded;
// the painter's tables never hold tile 0, so nothing maps to 0xff.
test('ROADS 11: the settlement sweep restores the region it found loaded', async () => {
  const { settlementsOf } = await import('../src/world/roadsProducer.js');
  const loads = [];
  const maps = {
    regionCount: 3, _lastRegion: 1,
    loadRegion(r) { loads.push(r); this._lastRegion = r; return true; },
    getRegion(r) { this.loadRegion(r); return { mapNames: ['A'], mapTable: [{ longitude: 128, latitude: 128, locationType: LT.TownCity }] }; },
  };
  settlementsOf(maps);
  assert.deepEqual(loads, [0, 1, 2, 1], 'every region once, then the one that was loaded before is put back');
  assert.equal(maps._lastRegion, 1);
  // A painter table never yields 0, so no written tile is ever 0xff.
  const grass = new Uint8Array(129 * 129).fill(TILE.grass), t = new Uint8Array(128 * 128);
  paintRoads(grass, t, 0xff, 0xff);
  for (const v of t) assert.notEqual(v, 0xff, 'no 0xff from the painter');
});

// ROADS 12 (2026-09-02, Mac: "the toggle that attaches to the buttons
// for each type"): a chip for roads and one for tracks, beside DFU's
// four, under the same law - the live store, the classic inversion
// (TRUE hides), saved with the game, absent in an older save meaning
// shown. A chip flips the RELIEF, not the markers, so the terrain step
// is re-run and the grid is keyed on the two flags.
test('ROADS 12: the two chips ride the store, default shown, and the relief is keyed on them', async () => {
  const { travelMapFilters, travelMapSaveData, restoreTravelMapSaveData, resetTravelMapState } = await import('../src/systems/travelMapState.js');
  resetTravelMapState();
  const f = travelMapFilters();
  assert.equal(f.roads, false); assert.equal(f.tracks, false);
  f.tracks = true;
  assert.equal(travelMapSaveData().filterTracks, true, 'a hidden layer saves as hidden');
  restoreTravelMapSaveData({ filterDungeons: true });   // an older save: no road keys
  assert.deepEqual([travelMapFilters().roads, travelMapFilters().tracks], [false, false], 'absent means shown');
  resetTravelMapState();
  const src = (await import('node:fs')).readFileSync('src/ui/overworldMap.js', 'utf8');
  assert.match(src, /'dungeons', 'temples', 'homes', 'towns', 'roads', 'tracks'/, 'six chips');
  assert.match(src, /if \(key === 'roads' \|\| key === 'tracks'\) this\._ensureTerrain\(\);/, 'a road chip re-runs the terrain step');
  assert.match(src, /grid\.roadsKey !== roadsKey/, 'the grid is keyed on the flags');
  assert.match(src, /const i = y \* MAP_WIDTH \+ x;/, 'AUDIT 46 A1: the mask is indexed at the WORLD\'s stride, not the window\'s');
  assert.match(src, /\(showRoads && net\.roads\[i\]\)/, 'and a hidden layer is not drawn');
  // AUDIT 47 A1: the two flags must be READ from the store. The line
  // above proves a hidden layer is not drawn IF showRoads is false; it
  // said nothing about where showRoads comes from, and a mutant that
  // set both to `true` passed every pin with the chips toggling nothing.
  assert.match(src, /const showRoads = !this\.filters\.roads, showTracks = !this\.filters\.tracks;/,
    'showRoads and showTracks are the classic inversion of the live store, not constants');
});

// AUDIT 46 A10: NO CHUNK IS EVER BUILT WITHOUT THE NETWORK. The worker
// handles messages in order - init, then roads (a synchronous build),
// then jobs - so the first terrain job waits for the network as long as
// setRoads is posted in the same synchronous block as the client's
// construction, before the frame loop can post a job. Pinned at the
// source, because a setRoads moved below the first frame would ship
// roadless chunks around the start position with every suite green.
test('AUDIT 46 A10: the network is posted before any terrain job can be', async () => {
  const host = (await import('node:fs')).readFileSync('src/scenes/world.js', 'utf8');
  const made = host.indexOf('new TerrainGenClient({ woods, woodsBytes })');
  const roads = host.indexOf('terrainGen.setRoads(settlementsOf(maps)');
  const firstGen = host.indexOf('terrainGen.generate(');
  assert.ok(made > 0 && roads > made, 'setRoads follows the client\'s construction');
  assert.ok(firstGen < 0 || roads < firstGen, 'and precedes the first generate call in the file');
  const gap = host.slice(made, roads);
  assert.ok(!/await /.test(gap), 'with no await between them - same synchronous block, so no frame can slip in');
});

// ROADS 14: CALIBRATED AGAINST THE ANSWER KEY. Basic Roads' hand-drawn
// network, measured (tools/roadsCalibrate.mjs): a road bends at 30% of
// its through-pixels, 98% of those bends are single 45-degree heading
// changes, 1.7% are right angles, none double back. A linear turn cost
// priced a right angle at two 45s; squared, it is four, and A* lays two
// single-point bends where it used to lay a corner.
test('ROADS 14: a right angle costs more than two single-point bends, so the road takes the two', async () => {
  const { measure } = await import('../tools/roadsCalibrate.mjs');
  // A route that must gain 40 rows over 40 columns then run flat: the
  // cheapest LINEAR shape is a right angle at the corner; the hand's
  // shape is a diagonal into a straight - two 45s.
  const a = { x: 200, y: 200 }, b = { x: 280, y: 240 };
  const wall = (x, y) => x >= 250 && x <= 255 && y < 235;   // forces the climb late
  const path = route(a, b, { heightAt: flat, isWater: wall, existing: blank(), d: D });
  const m = new Uint8Array(MAP_W * MAP_H); stamp(m, path);
  const st = measure(m);
  assert.equal(st.hairpinShare, 0, 'never doubles back');
  assert.ok(st.rightAngleShare <= 0.05, `right angles are rare (${(st.rightAngleShare * 100).toFixed(1)}% of bends) - the hand's 1.7%`);
  // RECORDED: on open ground a chamfered corner is always SHORTER than a
  // right angle, so both the linear and the squared cost choose it here
  // and the two assertions above hold either way - regression guards.
  // Right angles arise only against obstacles, where terrain decides,
  // and the place the shape is seen is the real-map run of
  // tools/roadsCalibrate.mjs printing our right-angle share beside his
  // 1.7%. The guarantee is pinned at the source:
  const src = (await import('node:fs')).readFileSync('src/world/roadNetwork.js', 'utf8');
  assert.match(src, /cost \+= t \* t \* d\.turnCost;/, 'the turn cost is squared in compass points');
});

// ROADS 15 (calibrated from his arrays alone): TRACKS ARE SHORT SPURS.
// Of 2,166 track dead-ends in Basic Roads, the median distance to a
// road pixel is 0, the 95th percentile 9, the max 56. Ours reached 40.
test('ROADS 15: track reach is the answer key\'s, and a far village gets no track', async () => {
  const { ROAD_DIALS } = await import('../src/world/roadNetwork.js');
  assert.ok(ROAD_DIALS.trackReach >= 9 && ROAD_DIALS.trackReach <= 20, `reach ${ROAD_DIALS.trackReach} sits at his 95th percentile, not four times it`);
  const locations = [
    { x: 200, y: 200, type: LT.TownCity }, { x: 260, y: 200, type: LT.TownHamlet },
    { x: 230, y: 208, type: LT.TownVillage },   // 8 px off the road: a spur
    { x: 230, y: 240, type: LT.TownVillage },   // 40 px off: no track at his reach
  ];
  const { tracks, stats } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  assert.ok(tracks[208 * MAP_W + 230] !== 0, 'the near village gets a spur');
  assert.equal(tracks[240 * MAP_W + 230], 0, 'the far one does not');
  assert.equal(stats.trackEdges, 1);
});

// ROADS 17/18: THE JOIN RULE. On the real map every hairpin and 244 of
// 266 right angles were town pixels where two of our roads arrived
// from different sides. A road may enter (or leave) a town only at
// least 135 degrees from every road already there - straight through
// and a wide T pass, a hairpin or a right angle into town does not, and
// the turned-away road joins the existing one outside instead. Real
// map: hairpins 2.9% -> 0.0% (his 0.0), right angles 8.2% -> 1.0%
// (his 1.7). A 90-degree rule was tried and rejected: 9.9% right angles.
test('ROADS 17: a road may not enter a town at a right angle to the road already there', () => {
  const A = { x: 200, y: 200, type: LT.TownCity }, B = { x: 240, y: 200, type: LT.TownCity }, C = { x: 280, y: 200, type: LT.TownCity };
  const Dn = { x: 240, y: 170, type: LT.TownCity };   // due north of B: a right angle into B if it entered
  const { roads, stats } = buildRoadNetwork({ locations: [A, B, C, Dn], heightAt: flat, isWater: () => false, dials: { neighbours: 3, roadReach: 100 } });
  const at = (x, y) => roads[y * MAP_W + x];
  const bitsB = at(B.x, B.y);
  const idxs = ORDER8.filter((b) => bitsB & b).map((b) => ORDER8.indexOf(b));
  assert.ok(idxs.length >= 2, 'B is passed through');
  assert.ok(wide(idxs), 'no two roads meet at B closer than 135 degrees - D\'s road joined outside rather than entering at a right angle');
  assert.ok(at(Dn.x, Dn.y) !== 0 && stats.unrouted === 0, 'D is on the network all the same');
  // The rule gives way rather than stranding a town that can be neither
  // entered nor joined.
  const lone = buildRoadNetwork({ locations: [A, { x: 200, y: 260, type: LT.TownCity }], heightAt: flat, isWater: () => false });
  assert.equal(lone.stats.unrouted, 0);
});

// AUDIT 49: the island skip and the merge, each pinned as what it is.
test('AUDIT 49 A1: a pair on different landmasses is named unrouted without a search', async () => {
  const { landComponents } = await import('../src/world/roadNetwork.js');
  const strait = (x) => x === 300;   // a one-pixel channel splits the map
  const comp = landComponents(strait);
  assert.ok(comp[100 * MAP_W + 200] !== comp[100 * MAP_W + 400], 'two components');
  assert.equal(comp[100 * MAP_W + 300], 0, 'water is 0');
  const locations = [{ x: 200, y: 100, type: LT.TownCity, name: 'West' }, { x: 400, y: 100, type: LT.TownCity, name: 'East' }];
  const t0 = Date.now();
  const { stats } = buildRoadNetwork({ locations, heightAt: flat, isWater: strait, dials: { roadReach: 300 } });
  assert.equal(stats.unrouted, 1);
  assert.deepEqual(stats.unroutedPairs[0].map((l) => l.name), ['West', 'East'], 'named');
  assert.equal(stats.islands, 1, 'skipped as an island - counted, not clocked, because a fast failure looks like a skip to a clock');
  assert.ok(Date.now() - t0 < 1500);
});

test('AUDIT 49 A2: the through-road merge is pinned at the source - no fixture can see it', async () => {
  // RECORDED: on every flat fixture tried, the wide-join rule steers an
  // approach on its own and a route that rides the existing road into
  // town leaves the same pixels whether it stops 3 px early or not. On
  // the REAL map the merge is measurable and small: junctions 7.0% ->
  // 6.5%, 118 duplicate spur pixels removed. The hairpin and right-angle
  // win was the wide join's. The law stays, at the source.
  const src = (await import('node:fs')).readFileSync('src/world/roadNetwork.js', 'utf8');
  assert.match(src, /if \(mergeNear && cell !== sc && existing\[cy \* MAP_WIDTH \+ cx\] !== 0/, 'a road joins the road it meets within mergeNear of its town');
});
