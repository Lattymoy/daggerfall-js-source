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

test('ROADS 2/20: a straight N-S road is two tiles wide down the centre, and only two', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  const n = paintRoads(tileData, tilemap, DIR.N | DIR.S, 0);
  assert.ok(n > 0);
  for (let y = 0; y < 128; y++) {
    assert.equal(tilemap[y * 128 + 63] & 0x3f, TILE.road, `row ${y} col 63 is road`);
    assert.equal(tilemap[y * 128 + 64] & 0x3f, TILE.road, `row ${y} col 64 is road`);
    // ROADS 20: two tiles and NOTHING beside them - the mod's cardinal
    // outer is null. The first draft painted 47/55 here and read four
    // tiles across where his read two; Mac saw the difference.
    assert.equal(tilemap[y * 128 + 62], 0, `row ${y} col 62 is untouched - no cardinal edge`);
    assert.equal(tilemap[y * 128 + 65], 0, `row ${y} col 65 is untouched`);
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

test('ROADS 2/AUDIT 51: a diagonal is one tile wide on the diagonal, and a road pixel paves the rect', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  // The rect is setLocationTiles' inclusive {xMin,xMax,yMin,yMax}. The
  // first draft of this pin sent {x,y,w,h}, which the seam never does,
  // and passed against a guard that compared to undefined (ROADS 5).
  paintRoads(tileData, tilemap, DIR.NE, 0, { xMin: 60, xMax: 67, yMin: 60, yMax: 67 });
  assert.equal(tilemap[100 * 128 + 100] & 0x3f, TILE.road, 'on x==y');
  assert.equal(tilemap[100 * 128 + 101] & 0x3f, TILE.roadGrass, 'flanked');
  assert.equal(tilemap[100 * 128 + 102], 0, 'one tile wide');
  // AUDIT 51: the mod paints THROUGH the rect's padding and a road pixel
  // fills what is left of it (the oracle overruled 'untouched').
  assert.equal(tilemap[64 * 128 + 64] & 0x3f, TILE.road, 'the rect\u2019s padding is paved by a road pixel');
  assert.equal(tilemap[67 * 128 + 67] & 0x3f, TILE.road, 'the far corner is on the diagonal, and paved either way');
  assert.equal(tilemap[50 * 128 + 50], 0, 'the SW half is bare - NE alone');
});

test('ROADS 2: water is never paved, and a track shows dirt through grass only', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.water);
  const tilemap = new Uint8Array(128 * 128);
  // AUDIT 51: the mod's road table paves water (46 in column 0); his data
  // never routes a road across it, but the columns are his.
  assert.ok(paintRoads(tileData, tilemap, DIR.N | DIR.S, 0) > 0, 'the mod\u2019s table paves water');
  assert.equal(tilemap[10 * 128 + 63] & 0x3f, TILE.road);
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
  // (62,64) is beside the N arm - and since ROADS 20 a cardinal has no
  // edge column, so it is nothing at all.
  assert.equal(classify(62, 64, DIR.N | DIR.E), null);
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
  assert.match(client, /setRoads\(settlements, onStats = null, switches = null\)/, 'the client has the door (ROADS 24: the switches ride it)');
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

// ROADS 22: THE PAINTER DRAWS NO RING. The mod paints none - its towns
// are ringed by the data (ROADS 6: five-neighbour arcs, never a loop)
// and inside a pixel a road stops at the location rect. The ring that
// ROADS 5 added was the painter's one piece that was ours (Audit 50
// A2); with Hazelnut's data in play, 1:1 has no room for it. This pin
// replaces ROADS 5's: an arm reaches the rect and STOPS.
test('ROADS 22/AUDIT 51: a road pixel paves the rect\u2019s padding, the streets stand, nothing outside', () => {
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass);
  const tilemap = new Uint8Array(128 * 128);
  const rect = { x: 56, y: 56, w: 16, h: 16, xMin: 56, xMax: 71, yMin: 56, yMax: 71 };
  // the location's own tiles are non-zero (seeded by setLocationTiles);
  // here a 4x4 block of "streets" in the middle of the rect
  for (let y = 62; y < 66; y++) for (let x = 62; x < 66; x++) tilemap[y * 128 + x] = 0xff;
  paintRoads(tileData, tilemap, DIR.S, 0, rect);
  assert.equal(tilemap[10 * 128 + 63] & 0x3f, TILE.road, 'the arm');
  assert.equal(tilemap[55 * 128 + 63] & 0x3f, TILE.road, 'reaches the rect');
  // AUDIT 51, by oracle: the mod paints THROUGH the padding and a road
  // pixel fills what is left of it - that band is how his towns ring.
  assert.equal(tilemap[58 * 128 + 63] & 0x3f, TILE.road, 'the arm continues through the padding');
  assert.equal(tilemap[70 * 128 + 58] & 0x3f, TILE.road, 'and the rest of the padding is paved');
  assert.equal(tilemap[63 * 128 + 63], 0xff, 'the streets themselves are untouched');
  // nothing OUTSIDE the rect but the arm: no edge annulus
  for (const [x, y] of [[54, 64], [73, 64], [64, 73], [53, 53], [74, 74]]) assert.equal(tilemap[y * 128 + x], 0, `nothing outside the rect at ${x},${y}`);
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

// ROADS 25 replaced ROADS 7's vertex tint with the first iteration's
// design: the network is LINES over the relief. The relief itself no
// longer knows about roads; the map traces the arrays into chains once
// per network and hands the renderer one set per chain.
test('ROADS 25: the network is traced into chains, simplified, rounded and lifted - not tinted', async () => {
  const { traceChains, simplifyChain, chaikin, roadModel, RELIEF_LIFT, buildOverworldGrid } = await import('../src/ui/overworldModel.js');
  // a straight road of five pixels with a spur: two chains, split at the junction
  const m = new Uint8Array(MAP_W * MAP_H);
  stamp(m, [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }, { x: 14, y: 10 }]);
  stamp(m, [{ x: 12, y: 10 }, { x: 12, y: 11 }, { x: 12, y: 12 }]);
  const chains = traceChains(m, MAP_W, MAP_H);
  assert.equal(chains.length, 3, 'three runs meet at the junction');
  assert.ok(chains.every((c) => c.length >= 2));
  // a staircase simplifies to its two ends; a real corner keeps its point
  const stairs = []; for (let i = 0; i < 24; i++) stairs.push({ x: i, y: Math.floor(i / 3) });
  assert.equal(simplifyChain(stairs).length, 2, 'the grid stairs are an artifact and go');
  const corner = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 10 }];
  assert.equal(simplifyChain(corner).length, 3, 'a genuine corner stays');
  assert.ok(chaikin(corner).length > corner.length, 'and is rounded');
  // the model lifts each class in order: stream < river < track < trunk < route
  assert.ok(RELIEF_LIFT.stream < RELIEF_LIFT.river && RELIEF_LIFT.river < RELIEF_LIFT.track && RELIEF_LIFT.track < RELIEF_LIFT.trunk && RELIEF_LIFT.trunk < RELIEF_LIFT.route);
  const ctx = { heightBytes: new Uint8Array(MAP_W * MAP_H).fill(40), width: MAP_W, height: MAP_H };
  const model = roadModel({ trunk: chains }, ctx);
  assert.equal(model.trunk.length, 3); assert.equal(model.track.length, 0);
  assert.ok(model.trunk[0] instanceof Float32Array && model.trunk[0].length % 3 === 0);
  // the relief no longer tints roads
  const grid = buildOverworldGrid({ heightBytes: ctx.heightBytes, width: 8, height: 4, climateAt: () => 227 });
  assert.ok(grid.colors.length === 8 * 4 * 3, 'a plain relief');
  const fs = await import('node:fs');
  const map = fs.readFileSync('src/ui/overworldMap.js', 'utf8');
  assert.match(map, /this\._ov\.setRoads\(roadModel\(chains, ctx\)\)/, 'the map hands the renderer the chains');
  assert.match(map, /roadLayers: this\._roadLayers/, 'and the chips choose the layers at draw time');
  const r = fs.readFileSync('src/render/overworldRenderer.js', 'utf8');
  assert.match(r, /for \(const \[kind, fallback\] of \[\s*\['stream'/, 'water under the tracks, tracks under the trunk');
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
  assert.match(src, /if \(roads\.smooth !== false\) smoothRoadHeights\(samples, tilemap, 129, hasLocation \? locationRect : null\);/, 'default on, off only when the network says so, and the rect skipped as the mod skips it');
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
  assert.match(src, /if \(key === 'roads' \|\| key === 'tracks' \|\| key === 'rivers' \|\| key === 'streams'\) this\._ensureTerrain\(\);/, 'a road or water chip re-runs the terrain step');
  // AUDIT 47 A1: the two flags must be READ from the store. The line
  // above proves a hidden layer is not drawn IF showRoads is false; it
  // said nothing about where showRoads comes from, and a mutant that
  // set both to `true` passed every pin with the chips toggling nothing.
  // ROADS 25: the flags pick LAYERS at draw time; the relief is not keyed on them.
  assert.match(src, /const showRoads = !this\.filters\.roads, showTracks = !this\.filters\.tracks;/, 'the classic inversion of the live store');
  assert.match(src, /this\._roadLayers = \{ trunk: showRoads, track: showTracks/, 'and they choose the layers');
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

// AUDIT 52 (was 49): the island skip and the merge, each pinned as what it is.
test('AUDIT 52 A1: a pair on different landmasses is named unrouted without a search', async () => {
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

test('AUDIT 52 A2: the through-road merge is pinned at the source - no fixture can see it', async () => {
  // RECORDED: on every flat fixture tried, the wide-join rule steers an
  // approach on its own and a route that rides the existing road into
  // town leaves the same pixels whether it stops 3 px early or not. On
  // the REAL map the merge is measurable and small: junctions 7.0% ->
  // 6.5%, 118 duplicate spur pixels removed. The hairpin and right-angle
  // win was the wide join's. The law stays, at the source.
  const src = (await import('node:fs')).readFileSync('src/world/roadNetwork.js', 'utf8');
  assert.match(src, /if \(mergeNear && cell !== sc && existing\[cy \* MAP_WIDTH \+ cx\] !== 0/, 'a road joins the road it meets within mergeNear of its town');
});

// ROADS 19: THE NETWORK IS BUILT ONCE PER MAP. The cache's law, pinned
// against an in-memory store since node has no IndexedDB: the same
// inputs hit, any change to what shapes the network misses, and a store
// that cannot open is a miss rather than an error.
test('ROADS 19: the cache key covers everything that shapes the network, and a miss builds once', async () => {
  const { roadsCacheKey, cachedNetwork, GENERATOR_VERSION, idbStore } = await import('../src/world/roadsCache.js');
  const S = [{ x: 200, y: 100, type: LT.TownCity }, { x: 260, y: 120, type: LT.TownHamlet }];
  const k = roadsCacheKey({ settlements: S, woodsLength: 500 });
  assert.equal(k, roadsCacheKey({ settlements: S, woodsLength: 500 }), 'same inputs, same key');
  assert.notEqual(k, roadsCacheKey({ settlements: S, woodsLength: 501 }), 'a different heightmap');
  assert.notEqual(k, roadsCacheKey({ settlements: [...S, { x: 1, y: 1, type: LT.Tavern }], woodsLength: 500 }), 'a different map');
  assert.notEqual(k, roadsCacheKey({ settlements: [{ ...S[0], x: 201 }, S[1]], woodsLength: 500 }), 'a town one pixel over');
  assert.notEqual(k, roadsCacheKey({ settlements: S, woodsLength: 500, dials: { turnCost: 0.5 } }), 'a turned dial');
  assert.match(k, new RegExp(`^roads:v${GENERATOR_VERSION}:`), 'the generator version leads the key');
  // build-through: one build, then hits
  const mem = new Map(); const store = { async get(x) { return mem.get(x) ?? null; }, async set(x, v) { mem.set(x, v); } };
  let builds = 0;
  const build = () => { builds++; return buildRoadNetwork({ locations: S, heightAt: flat, isWater: () => false }); };
  const a = await cachedNetwork({ key: k, build, store });
  const b = await cachedNetwork({ key: k, build, store });
  assert.equal(builds, 1, 'built once');
  assert.equal(a.cached, false); assert.equal(b.cached, true);
  assert.deepEqual(Array.from(b.roads), Array.from(a.roads), 'the hit is the build');
  // no store at all: always builds, never throws
  const c = await cachedNetwork({ key: k, build, store: null });
  assert.equal(builds, 2); assert.equal(c.cached, false);
  assert.equal(idbStore(undefined), null, 'no IndexedDB is a null store, not an error');
});

test('ROADS 19: a job that arrives during the cache lookup waits for it - no chunk is ever roadless', async () => {
  const src = (await import('node:fs')).readFileSync('src/world/terrainGenWorker.js', 'utf8');
  assert.match(src, /if \(m\.t === 'job' && pendingRoads\) \{ pendingRoads\.then\(\(\) => handle\(m\)\); return; \}/,
    'a job behind the lookup queues on it, exactly as it queued behind the synchronous build');
  assert.match(src, /roadsCacheKey\(\{ settlements: m\.settlements, woodsLength: woods\._bytes\?\.byteLength \?\? 0 \}\)/, 'the worker keys on the list and the heightmap');
});

// ROADS 20: THE TABLES ARE THE MOD'S. A track's diagonal inner is 51/52
// (not the cardinal's 11/26), and a track's inside 90-degree corner
// takes 10/25 at the inner elbow where a road takes nothing.
test('ROADS 20: a track\u2019s diagonal is 51/52, its inside corner 10/25, and a road has no corner tile', () => {
  const grass = () => new Uint8Array(129 * 129).fill(TILE.grass);
  const t = new Uint8Array(128 * 128);
  paintRoads(grass(), t, 0, DIR.NE);
  assert.equal(t[100 * 128 + 100] & 0x3f, 51, 'the diagonal inner is 51 on grass');
  assert.equal(t[100 * 128 + 101] & 0x3f, 12, 'its flank is 12');
  const c = new Uint8Array(128 * 128);
  paintRoads(grass(), c, 0, DIR.N | DIR.W);
  assert.equal(c[64 * 128 + 63] & 0x3f, 10, 'N+W: the inner elbow (63,64) is the corner tile');
  assert.equal(c[64 * 128 + 63] & (TILE.ROTATE | TILE.FLIP), 0, 'unturned, unmirrored');
  const e = new Uint8Array(128 * 128);
  paintRoads(grass(), e, 0, DIR.N | DIR.E);
  assert.ok(e[64 * 128 + 64] & TILE.ROTATE && e[64 * 128 + 64] & TILE.FLIP, 'N+E: turned and mirrored at (64,64)');
  const r = new Uint8Array(128 * 128);
  paintRoads(grass(), r, DIR.N | DIR.W, 0);
  assert.equal(r[64 * 128 + 63] & 0x3f, TILE.road, 'a road\u2019s elbow stays road - no corner tile');
  // a stone track corner is 25
  const st = new Uint8Array(129 * 129).fill(TILE.stone), s2 = new Uint8Array(128 * 128);
  paintRoads(st, s2, 0, DIR.S | DIR.E);
  assert.equal(s2[63 * 128 + 64] & 0x3f, 25);
});

// ROADS 21: THE TRACKS ARE A WEB. His villages sit ON tracks (84%) and
// his tracks pass through the places they serve, chaining village to
// village to road - 14 px per dead-end, not 3.6 px stubs. Three rules:
// a track may cross a track-grade pixel where a road may not; each
// track node links to its nearest neighbours, shortest-first, and a
// link commits to B's side of the web; and a village is entered wide.
test('ROADS 21: a row of villages chains into one track, and most of them are passed through', async () => {
  const { measure } = await import('../tools/roadsCalibrate.mjs');
  const locations = [{ x: 200, y: 200, type: LT.TownCity }, { x: 300, y: 200, type: LT.TownHamlet }];
  for (let i = 0; i < 6; i++) locations.push({ x: 210 + i * 14, y: 230, type: LT.TownVillage });   // a row, 14 px apart
  const { tracks, stats } = buildRoadNetwork({ locations, heightAt: flat, isWater: () => false });
  assert.ok(stats.trackLinks >= 5, `the villages linked to each other (${stats.trackLinks} links)`);
  const m = measure(tracks);
  assert.ok(m.deadEndRate < 0.2, `a web, not stubs: dead-ends ${(m.deadEndRate * 100).toFixed(0)}% of track pixels`);
  assert.equal(m.hairpinShare, 0, 'no village is left with two links from adjacent directions');
  // the middle villages are passed THROUGH: two bits, not one
  let through = 0;
  for (let i = 1; i < 5; i++) { const v = tracks[230 * MAP_W + 210 + i * 14]; if (v && (v & (v - 1))) through++; }
  assert.ok(through >= 3, `the inner villages sit on the track rather than at the end of one (${through} of 4)`);
});

test('ROADS 21: the web\u2019s two real-map rules, pinned at the source with their readings', async () => {
  // RECORDED: on a straight row of villages every join is collinear and
  // no link needs to cross a village, so neither rule can be seen on a
  // fixture. On the real map, entering villages WIDE took the web's
  // hairpins from 5.3% to 0.0% and its right angles from 12.9% to 1.9%
  // (his 0.0% and 2.4%); letting tracks CROSS track-grade pixels is what
  // lets a chain pass through a village at all (his: 84% of villages on
  // a track).
  const src = (await import('node:fs')).readFileSync('src/world/roadNetwork.js', 'utf8');
  assert.match(src, /for \(const t of trackNodes\) trackBlocked\[t\.y \* MAP_WIDTH \+ t\.x\] = 0;/, 'a track may cross a track-grade pixel');
  assert.match(src, /for \(const t of trackNodes\) trackTowns\[t\.y \* MAP_WIDTH \+ t\.x\] = 1;/, 'and a village is one of the web\u2019s towns');
  assert.match(src, /stopOn: paths, blocked: trackBlocked, towns: trackTowns,\s*\n\s*stopIf:/, 'links are entered wide and commit to B\u2019s side');
});

// ROADS 22: HIS NETWORK, 1:1. The four arrays load byte-exact from the
// vendor folder; the wrong length is no file; a failed fetch is a null
// and the generator takes over. The worker takes the arrays ready-made.
test('ROADS 22: Basic Roads loads byte-exact, refuses the wrong size, and falls back on failure', async () => {
  const { loadModRoads, MOD_ROADS } = await import('../src/world/roadsProducer.js');
  const fs = await import('node:fs');
  const real = (k) => new Uint8Array(fs.readFileSync(`vendor/roads-hazelnut/${k}Data.bytes`));
  const FILE = { roads: 'road', tracks: 'track', rivers: 'river', streams: 'stream' };
  const fetchOk = async (url) => {
    const key = Object.keys(MOD_ROADS).find((k) => MOD_ROADS[k] === url);
    return { ok: true, arrayBuffer: async () => real(FILE[key]).buffer };
  };
  const net = await loadModRoads(fetchOk);
  assert.ok(net, 'loaded');
  assert.equal(net.roads.length, MAP_W * MAP_H); assert.equal(net.tracks.length, MAP_W * MAP_H);
  let n = 0; for (const v of net.roads) if (v) n++;
  assert.equal(n, 21554, 'his 21,554 road pixels, byte-exact');
  assert.equal(net.stats.source, 'basic-roads');
  const fetchShort = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(10).buffer });
  assert.equal(await loadModRoads(fetchShort), null, 'the wrong length is no file');
  const fetch404 = async () => ({ ok: false });
  assert.equal(await loadModRoads(fetch404), null, 'a failed fetch is a null');
  assert.equal(await loadModRoads(undefined), null, 'no fetch at all is a null');
  const worker = fs.readFileSync('src/world/terrainGenWorker.js', 'utf8');
  assert.match(worker, /if \(m\.net\) \{ roads = \{ roads: m\.net\.roads, tracks: m\.net\.tracks, rivers: m\.net\.rivers \?\? null, streams: m\.net\.streams \?\? null, water: !!m\.net\.water \};/, 'the worker takes his arrays ready-made, water included');
  const host = fs.readFileSync('src/scenes/world.js', 'utf8');
  assert.match(host, /loadModRoads\(\)\.then\(\(his\) => \{\s*\n\s*if \(his\) \{ terrainGen\.setRoadsData\(\{ \.\.\.his, \.\.\.roadSwitches \}/, 'his first, with the switches');
  assert.match(host, /terrainGen\.setRoads\(settlementsOf\(maps\), logRoads, roadSwitches\);/, 'ours as the fallback, with the switches');
});

// ROADS 23: THE PAINTER IS A PORT - PaintPath table-driven, his slots,
// his conditions, his order. Three things the old readings never had.
test('ROADS 23: a neighbour\u2019s diagonal paints this pixel\u2019s corner tile', async () => {
  const { pathCorners } = await import('../src/world/roadPainter.js');
  // pixel P at (10,10); its EAST neighbour carries a NW diagonal - the
  // line runs from E to N past P's north-east corner (127,127).
  const m = new Uint8Array(MAP_W * MAP_H);
  m[10 * MAP_W + 11] = DIR.NW;
  assert.equal(pathCorners(m, 10, 10, MAP_W), DIR.NW, 'the east neighbour\u2019s NW bit is P\u2019s NW corner byte');
  const tileData = new Uint8Array(129 * 129).fill(TILE.grass), t = new Uint8Array(128 * 128);
  const n = paintRoads(tileData, t, 0, 0, null, 129, { corners: { road: DIR.NW } });
  assert.equal(n, 1, 'exactly one tile - the corner');
  assert.equal(t[127 * 128 + 127] & 0x3f, TILE.roadGrass, 'P\u2019s (127,127) is the diagonal outer tile');
  assert.ok(t[127 * 128 + 127] & TILE.ROTATE, 'turned, as the mod turns it');
  // the WEST neighbour's SE brushes (0,0), turned and mirrored
  const u = new Uint8Array(128 * 128);
  paintRoads(tileData, u, 0, 0, null, 129, { corners: { road: DIR.SE } });
  assert.equal(u[0] & 0x3f, TILE.roadGrass); assert.ok((u[0] & TILE.ROTATE) && (u[0] & TILE.FLIP));
});

test('ROADS 23: rivers paint water with a bank and streams narrow, only when water is on', () => {
  const grass = () => new Uint8Array(129 * 129).fill(TILE.grass);
  const off = new Uint8Array(128 * 128);
  assert.equal(paintRoads(grass(), off, 0, 0, null, 129, { river: DIR.N | DIR.S, stream: DIR.E | DIR.W, water: false }), 0, 'off by default, as the mod ships it');
  // ...and off INSIDE the loop too: a road makes the loop run, and the
  // river beside it still paints nothing.
  const withRoad = new Uint8Array(128 * 128);
  paintRoads(grass(), withRoad, DIR.N | DIR.S, 0, null, 129, { river: DIR.E | DIR.W, water: false });
  assert.equal(withRoad[63 * 128 + 10], 0, 'the E-W river is not painted while water is off');
  assert.equal(withRoad[10 * 128 + 63] & 0x3f, TILE.road, 'the road is');
  const r = new Uint8Array(128 * 128);
  paintRoads(grass(), r, 0, 0, null, 129, { river: DIR.N | DIR.S, water: true });
  assert.equal(r[10 * 128 + 63], 0xff, 'the river\u2019s centre is water, stored as 0xff so the pipeline reads it as set');
  assert.equal(r[10 * 128 + 64], 128, 'the east column is FLIPPED water: the bits go on before the zero check, as the mod does it');
  assert.equal(r[10 * 128 + 62] & 0x3f, 21, 'a river HAS a cardinal outer - its bank, 21 on grass');
  assert.equal(r[10 * 128 + 65] & 0x3f, 21);
  assert.equal(r[10 * 128 + 61], 0, 'and stops there');
  const st = new Uint8Array(128 * 128);
  paintRoads(grass(), st, 0, 0, null, 129, { stream: DIR.E | DIR.W, water: true });
  assert.equal(st[63 * 128 + 10] & 0x3f, 21, 'a stream\u2019s centre is the bank tile - a narrow watercourse');
  assert.equal(st[62 * 128 + 10], 0, 'with no outer');
  // a road beats water on the same tile: the mod's paint order
  const both = new Uint8Array(128 * 128);
  paintRoads(grass(), both, DIR.N | DIR.S, 0, null, 129, { river: DIR.N | DIR.S, water: true });
  assert.equal(both[10 * 128 + 63] & 0x3f, TILE.road, 'roads first');
});

// ── ROADS 25: THE FIRST PIXELS WERE PAINTED BEFORE THE NETWORK LANDED ──
// Mac: "some roads are missing even though they show on the map."
test('ROADS 25: a pixel says whether a network was present, and the host rebuilds the ones painted without one', async () => {
  const { generatePixelTerrain } = await import('../src/world/terrainGen.js');
  const { readFileSync } = await import('node:fs');
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  // The generator's own word: was a network there when this pixel was painted.
  const gen = read('src/world/terrainGen.js');
  assert.match(gen, /withRoads: !!roads,/);
  assert.equal(typeof generatePixelTerrain, 'function');
  const world = read('src/scenes/world.js');
  // The host keeps it on the pixel entry...
  assert.match(world, /const \{ samples, tilemap, positions, normals, tilemapBytes, avg, nature, withRoads \} = await terrainGen\.generate\(/);
  assert.match(world, /^\s+withRoads,\s+\/\/ ROADS 25/m);
  // ...and when the network lands, tears down every pixel built without
  // one so the stream rebuilds it - on BOTH arrival paths, since the
  // mod-data path returns early.
  assert.match(world, /function rebuildRoadless\(\) \{[\s\S]{0,300}if \(!p\.withRoads\) \{ destroyPixel\(p\.px, p\.py, \{ collectLoose: false \}\); roadless\+\+; \}/);
  assert.match(world, /terrainGen\.setRoadsData\(\{ \.\.\.his, \.\.\.roadSwitches \}[^\n]*rebuildRoadless\(\); return; \}/, 'the mod-data path');
  assert.match(world, /terrainGen\.setRoads\(settlementsOf\(maps\), logRoads, roadSwitches\);\s*\n\s*rebuildRoadless\(\);/, 'our own network');
  // A pixel IN FLIGHT when the network landed arrives roadless after the
  // sweep, and goes straight back.
  // ROADS 25a: the roadless pixel is REBUILT by the builder itself and the
  // entry returned - a caller awaiting the player's pixel (the boot's
  // camera, the teleport landing) never receives undefined. Once: the
  // worker's message order guarantees the second paint has the network.
  assert.match(world, /if \(!withRoads && terrainGen\.hasRoads\) \{\s*\n\s*destroyPixel\(px, py, \{ collectLoose: false \}\);\s*\n\s*if \(roadsRetry\) console\.warn\([^\n]*\);\s*\n\s*else return buildPixelNow\(px, py, \{ roadsRetry: true \}\);\s*\n\s*\}/);
  assert.match(world, /async function buildPixelNow\(px, py, \{ roadsRetry = false \} = \{\}\) \{/);
  assert.doesNotMatch(world, /terrainGen\.hasRoads\) \{ destroyPixel\(px, py, \{ collectLoose: false \}\); return; \}/, 'no path in the builder resolves the player\u2019s pixel to nothing');
  assert.match(read('src/world/terrainGenClient.js'), /get hasRoads\(\) \{ return !!this\._roads \|\| !!this\._settlements; \}/);
  // The map was ALREADY rebuilt on arrival (ROADS 7); the terrain now is too.
  assert.match(read('bible/03-World/Roads.md'), /keys its grid cache on the network it was drawn with/);
});
