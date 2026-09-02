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
    { x: 150, y: 300, type: LT.DungeonLabyrinth }, // gets nothing - and sits OFF every line, since a road passing a dungeon is fine; a path TO one is not
  ];
  const { roads, tracks, stats } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  assert.equal(stats.roadNodes, 3); assert.equal(stats.trackNodes, 1); assert.equal(stats.unrouted, 0);
  for (const l of locations.filter((l) => l.type === LT.TownCity || l.type === LT.TownHamlet)) {
    assert.ok(roads[l.y * MAP_W + l.x] !== 0, `town at ${l.x},${l.y} has a road`);
  }
  assert.ok(tracks[130 * MAP_W + 210] !== 0, 'the village has a track');
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
  assert.ok(!TRACK_TYPES.has(LT.HomeWealthy), 'an estate is off the road');
  assert.ok(!TRACK_TYPES.has(LT.DungeonLabyrinth) && !ROAD_TYPES.has(LT.DungeonLabyrinth));
  // And the behaviour: a farm beside a town gets nothing, a village does.
  const locations = [
    { x: 200, y: 100, type: LT.TownCity }, { x: 260, y: 120, type: LT.TownHamlet },
    { x: 210, y: 140, type: LT.HomeFarms }, { x: 250, y: 90, type: LT.TownVillage },
  ];
  const { tracks } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  assert.equal(tracks[140 * MAP_W + 210], 0, 'the farm has no track');
  assert.ok(tracks[90 * MAP_W + 250] !== 0, 'the village does');
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

// ROADS 6 (2026-09-01): ROADS RING THE TOWNS THEY PASS. Measured on the
// hand-drawn network: five-neighbour ARCS around a location are
// everywhere (890) and full eight-pixel loops essentially never (none).
// A ring is a through-road detouring around a town on one side, and it
// falls out of one rule - a settlement's pixel is never an intermediate
// step. The town on the line between two others gets the arc plus its
// own two spurs, which IS the ring; and a village on the line between
// two cities is walked around rather than cut through.
test('ROADS 6: a town between two others is ringed, and a village in the way is not cut through', () => {
  const A = { x: 200, y: 200, type: LT.TownCity }, B = { x: 230, y: 200, type: LT.TownHamlet }, C = { x: 260, y: 200, type: LT.TownCity };
  const V = { x: 245, y: 200, type: LT.TownVillage };   // on the B-C line
  const { roads } = buildRoadNetwork({ locations: [A, B, C, V], heightAt: flat, isWater: () => false, dials: { neighbours: 3, roadReach: 100 } });
  const at = (x, y) => roads[y * MAP_W + x];
  // B carries only its own spurs: the A-C through-road did not pass across it.
  const bitsB = at(B.x, B.y);
  assert.ok(bitsB !== 0, 'B is on the network');
  // the pixels around B: an arc of road neighbours, five or more
  let ringB = 0;
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) if (at(B.x + dx, B.y + dy)) ringB++;
  // Four is the arc: the side the road came in on, the corner, the far
  // side, the other corner. The hand-drawn data's fifth is the habit of
  // returning to the original line after the bypass, which A* has no
  // reason to do when the destination already sits on the new line.
  assert.ok(ringB >= 4, `B is ringed by an arc (${ringB} of 8 neighbours carry road)`);
  // NO CORNER CUTTING: the road did not squeeze diagonally past B - the
  // arc goes THROUGH a corner pixel (SW or NW) rather than skipping it.
  assert.ok(at(B.x - 1, B.y + 1) || at(B.x - 1, B.y - 1), 'the bypass passes through a corner pixel, not across it');
  // the village: a road passes it but never THROUGH it as an intermediate -
  // its pixel carries at most the bits of its own track (or none).
  const bitsV = at(V.x, V.y);
  const throughV = (bitsV & DIR.E) && (bitsV & DIR.W);
  assert.ok(!throughV, 'the B-C road did not cut across the village pixel');
  assert.ok(at(V.x, V.y - 1) || at(V.x, V.y + 1), 'it went around instead');
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
