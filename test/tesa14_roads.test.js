// TESA14 (2026-10-24; the owner, of the land past the Bay: "some of the roads cut off the map, theres no pathways like
// daggerfall has and roads intersect with some of the capital cities water sources", then "Full Daggerfall network";
// bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY, THE BAY'S OWN LAW AT ITS OWN SCALE, pinned. The
// builder's two new inputs (a region's own nodes, the pixels no route crosses) and its two faster searches; the regions'
// lattice, their nearness, a region's network - its places in one order, its seams meeting, its capitals' gates; the roll
// carried to a worker as numbers and answering as the host's does; the build's print and key; the roads' worker, its
// client, the terrain client's merge, the world host's module and the world's wiring. Synthetic ground and places; with
// ARENA2 one region of the player's own continent.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildRoadNetwork, nearestWithin, primEdges, MAP_W, MAP_H, DIR, ROAD_DIALS,
} from '../src/world/road/roadNetwork.js';
import {
  TAMRIEL_ROADS_VERSION, GROUND_ROLL_VERSION, regionPrefix, REGION_APRON, REGION_CORE_W, REGION_CORE_H, LAND_LOOK, regionLattice, regionOf, regionAt, inCore, regionHasLand,
  regionsByNearness, buildTamrielRegion, rollSpec, rollTypeAt, regionKey, inputsPrint,
} from '../src/world/tamrielRoads.js';
import { beyondKey, beyondPixel, joinLayer, mergeArenaRoads, arenaRoadsLayer, setArenaRoads, packArenaRoads, unpackArenaRoads } from '../src/world/arenaRoads.js';
import { packPastBayPlaces } from '../src/world/pastBayPlaces.js';
import { CAPITALS, GATE_STEPS, capitalGates, capitalSpanPixels } from '../src/world/tamrielCapitals.js';
import { countryStandsAt, COUNTRY_TYPES } from '../src/world/tamrielCountry.js';
import { lairStandsAt, lairPlanned, lairBlockCount, lairPools, LAIR_TYPES } from '../src/world/tamrielDungeons.js';
import { createTamrielRoadsClient, roadsWorkerCount } from '../src/world/tamrielRoadsClient.js';
import { createRoadsWorkerState } from '../src/world/tamrielRoadsWorker.js';
import { createTamrielRoadsHost } from '../src/scenes/tamrielRoadsHost.js';
import { TerrainGenClient } from '../src/world/terrain/terrainGenClient.js';
import { GENERATOR_VERSION } from '../src/world/roadsCache.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { inBay, setTamrielFit } from '../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { dropGroundCache } from '../src/world/tamriel/tamrielGround.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const T = LOCATION_TYPES;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setArenaRoads(null); setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); });
const STEP = { [DIR.N]: [0, -1], [DIR.NE]: [1, -1], [DIR.E]: [1, 0], [DIR.SE]: [1, 1], [DIR.S]: [0, 1], [DIR.SW]: [-1, 1], [DIR.W]: [-1, 0], [DIR.NW]: [-1, -1] };
/** Does a layer walk from one pixel to another along its bits? */
function walks(map, [ax, ay], [bx, by]) {
  const seen = new Set([beyondKey(ax, ay)]), stack = [[ax, ay]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x === bx && y === by) return true;
    const v = map.get(beyondKey(x, y)) ?? 0;
    for (const bit of Object.keys(STEP).map(Number)) if (v & bit) { const [dx, dy] = STEP[bit], k = beyondKey(x + dx, y + dy); if (!seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); } }
  }
  return false;
}
const rnd = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const both = (layer) => { const m = new Map(layer.roads); for (const [k, b] of layer.tracks) m.set(k, (m.get(k) ?? 0) | b); return m; };
/** A region north of the Bay: its core at x 0..800, y -1000..-700. */
const REGION = regionOf(regionLattice({ x0: 0, y0: -1000, w: 1600, h: 600 }), 0, 0);

// ── THE BUILDER ─────────────────────────────────────────────────

test('TESA14 the builder: an obstacle is crossed by no route - a road between two cities goes round a wall of them through its gap; none given, the Bay\'s build unchanged (mutant: the obstacles unread)', () => {
  const locations = [{ x: 100, y: 100, type: T.TownCity }, { x: 160, y: 100, type: T.TownCity }];
  const wall = [];
  for (let y = 60; y <= 140; y++) if (y !== 130) wall.push({ x: 130, y });
  const net = buildRoadNetwork({ locations, heightAt: () => 30, isWater: () => false, obstacles: wall });
  for (const o of wall) assert.equal(net.roads[o.y * MAP_W + o.x], 0, `no road on the wall at ${o.y}`);
  assert.ok(net.roads[130 * MAP_W + 130], 'through its gap');
  const open = buildRoadNetwork({ locations, heightAt: () => 30, isWater: () => false });
  assert.ok(open.roads[100 * MAP_W + 130], 'no wall: straight across');
  assert.deepEqual(buildRoadNetwork({ locations, heightAt: () => 30, isWater: () => false, obstacles: [] }).roads, open.roads);
});

test('TESA14 the builder: a region routes its own - a road edge whose first end (north, then west) is its own, a spanning edge with either end its own, a track link by its first end, a track\'s spur by its node (mutant: each rule)', () => {
  const heightAt = () => 30, isWater = () => false;
  const a = { x: 100, y: 100, type: T.TownCity }, b = { x: 140, y: 110, type: T.TownCity };
  const mine = (set) => (n) => set.some((m) => m.x === n.x && m.y === n.y);
  assert.ok(buildRoadNetwork({ locations: [a, b], heightAt, isWater, owns: mine([a]) }).stats.roadEdges >= 1, 'a, north of b, owns the edge');
  assert.equal(buildRoadNetwork({ locations: [a, b], heightAt, isWater, owns: mine([b]) }).stats.roadEdges, 0, 'b\'s neighbours\' edge is a\'s, though it is the tree\'s too');
  // a bridge: two towns past a road's reach, joined by the tree alone - either end's
  const c = { x: 100, y: 300, type: T.TownCity };
  assert.equal(buildRoadNetwork({ locations: [a, c], heightAt, isWater, owns: mine([c]) }).stats.roadEdges, 1, 'the bridge: c\'s, though a is first');
  assert.equal(buildRoadNetwork({ locations: [a, c], heightAt, isWater, owns: mine([a]) }).stats.roadEdges, 1);
  const none = buildRoadNetwork({ locations: [a, b], heightAt, isWater, owns: () => false });
  assert.equal(none.roads.some((v) => v), false, 'none of its own: no road');
  // tracks: a village beside the road from a to b, its spur by its own node
  const v = { x: 120, y: 113, type: T.TownVillage };
  assert.equal(buildRoadNetwork({ locations: [a, b, v], heightAt, isWater, owns: mine([a, b]) }).tracks.some((x) => x), false, 'the village not its own: no spur');
  assert.ok(buildRoadNetwork({ locations: [a, b, v], heightAt, isWater, owns: mine([a, b, v]) }).tracks.some((x) => x), 'its own: its spur');
  const v2 = { x: 128, y: 117, type: T.TownVillage };
  const links = buildRoadNetwork({ locations: [v, v2], heightAt, isWater, owns: mine([v]) });
  assert.equal(links.stats.trackLinks, 1, 'a link by its first end (v, north of v2)');
  assert.equal(buildRoadNetwork({ locations: [v, v2], heightAt, isWater, owns: mine([v2]) }).stats.trackLinks, 0);
});

test('TESA14 the builder\'s searches: nearestWithin answers the brute force\'s lists to the tie; Prim\'s tree spans with Kruskal\'s length (mutant: the grid\'s reach, the ties\' order, the walk\'s choice)', () => {
  const r = rnd(5);
  for (const [n, reach, k] of [[300, 24, 2], [500, 70, 2], [200, 10, 3]]) {
    const nodes = Array.from({ length: n }, () => ({ x: Math.floor(r() * 300), y: Math.floor(r() * 200) }));
    nodes.push({ ...nodes[0] }, { x: nodes[1].x + 3, y: nodes[1].y + 4 }, { x: nodes[1].x + 5, y: nodes[1].y });   // a twin, and two at 5
    const brute = nodes.map((a, i) => nodes.map((m, j) => ({ j, dd: Math.hypot(a.x - m.x, a.y - m.y) })).filter((o) => o.j !== i && o.dd <= reach).sort((p, q) => p.dd - q.dd).slice(0, k));
    assert.deepEqual(nearestWithin(nodes, reach, k), brute, `${n} nodes, reach ${reach}, ${k}`);
  }
  const nodes = Array.from({ length: 120 }, () => ({ x: Math.floor(r() * 400), y: Math.floor(r() * 300) }));
  const tree = primEdges(nodes);
  assert.equal(tree.length, nodes.length - 1);
  const parent = nodes.map((_, i) => i), find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [i, j] of tree) parent[find(i)] = find(j);
  assert.equal(new Set(nodes.map((_, i) => find(i))).size, 1, 'one tree');
  // Kruskal's length, by its own law over every pair
  const all = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) all.push([Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y), i, j]);
  all.sort((a, b) => a[0] - b[0]);
  const p2 = nodes.map((_, i) => i), f2 = (x) => (p2[x] === x ? x : (p2[x] = f2(p2[x])));
  let kl = 0;
  for (const [dd, i, j] of all) { const a = f2(i), b = f2(j); if (a !== b) { p2[a] = b; kl += dd; } }
  const pl = tree.reduce((s, [i, j]) => s + Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y), 0);
  assert.ok(Math.abs(pl - kl) < 1e-6, `the least length (${pl} vs ${kl})`);
  assert.deepEqual(primEdges([]), []);
  assert.deepEqual(primEdges([{ x: 0, y: 0 }]), []);
  assert.match(read('src/world/road/roadNetwork.js'), /for \(const \[i, j\] of \(owns \? primEdges\(roadNodes\) : kruskal\(roadNodes, sameLand\)\)\)/, 'the Bay\'s tree Kruskal\'s still - OWN-WORK2: one a land');
});

// ── THE REGIONS ─────────────────────────────────────────────────

test('TESA14 the lattice: cores REGION_CORE_W x REGION_CORE_H from the frame\'s north-west pixel, a grid the builder\'s 1000 x 500 with REGION_APRON round its core - wider than a road\'s and a track\'s reach (mutant: the apron, the core, the lattice\'s count)', () => {
  assert.deepEqual([REGION_APRON, REGION_CORE_W, REGION_CORE_H, LAND_LOOK, TAMRIEL_ROADS_VERSION], [100, 800, 300, 8, 8]);   // TESA15: 2, a region's places in its answer; PIN MOVED (AUDIT TESA II R7, R9): 3; PIN MOVED (VOYAGER1, VOYAGER-CYRODIIL): 4, the land's law and the named roads; PIN MOVED (RIVER-FORDS): 5, the carved rivers crossed as fords; PIN MOVED (ROAD-GAPS): 6, a region's networks linked; PIN MOVED (EXACT-PIECES): 7, a region's land's pieces in its answer; PIN MOVED (ROAD-LOOK): 8, the carved lakes' water no route crosses
  assert.equal(REGION_CORE_W + 2 * REGION_APRON, MAP_W);
  assert.equal(REGION_CORE_H + 2 * REGION_APRON, MAP_H);
  assert.ok(REGION_APRON > ROAD_DIALS.roadReach && REGION_APRON > ROAD_DIALS.trackLink, 'an owned edge\'s far end in view');
  const lat = regionLattice({ x0: -589.5, y0: -883.5, w: 4960, h: 3100 });
  assert.deepEqual(lat, { x0: -590, y0: -884, cols: 7, rows: 11 });
  const r = regionOf(lat, 2, 3);
  assert.deepEqual(r, { i: 2, j: 3, core: { x0: 1010, y0: 16, x1: 1810, y1: 316 }, gx: 910, gy: -84 });
  assert.deepEqual(regionAt(lat, 1010, 16), [2, 3]);
  assert.deepEqual(regionAt(lat, 1009, 315), [1, 3]);
  assert.ok(inCore(r, 1010, 16) && inCore(r, 1809, 315) && !inCore(r, 1810, 100) && !inCore(r, 1500, 316));
});

test('TESA14 the regions to build: those with land past the Bay in their core (a pixel every LAND_LOOK), nearest a point first, ties in the lattice\'s order (mutant: the Bay\'s pixels, the order)', () => {
  const lat = regionLattice({ x0: -300, y0: -100, w: 2400, h: 900 });   // 3 x 3, the middle's core x 500..1300, y 200..500: the Bay's south-east
  const sea = () => 0;
  assert.equal(regionHasLand(regionOf(lat, 1, 1), () => 40), true, 'a core round the Bay with land past it');
  assert.equal(regionHasLand(regionOf(lat, 1, 1), sea), false);
  const bayOnly = (x, y) => (inBay(x, y) ? 40 : 0);
  assert.equal(regionHasLand(regionOf(lat, 1, 1), bayOnly), false, 'the Bay\'s own ground is no region\'s');
  const order = regionsByNearness(lat, () => true, { x: 900, y: 350 }).map((r) => `${r.i},${r.j}`);
  assert.deepEqual(order, ['1,1', '1,0', '1,2', '0,1', '2,1', '0,0', '2,0', '0,2', '2,2'], 'the middle, then by distance, ties north first then west');
  assert.deepEqual(regionsByNearness(lat, (r) => r.i === 0, { x: 100, y: 350 }).map((r) => `${r.i},${r.j}`), ['0,1', '0,0', '0,2']);
});

test('TESA14 a region\'s network: its places in one order whatever order they come in; graded as the Bay\'s (a hamlet a road node, a village a track\'s, a farm and a keep routed round); no path on the Bay; all its own pixels\' keys (mutant: the order, a grade)', () => {
  const r = rnd(11);
  const places = [];
  for (let k = 0; k < 160; k++) places.push({ x: 50 + Math.floor(r() * 700), y: -950 + Math.floor(r() * 200), type: [T.TownHamlet, T.TownVillage, T.HomeFarms, T.DungeonKeep, T.Tavern][k % 5] });
  const shuffled = [...places].sort(() => r() - 0.5);
  const a = buildTamrielRegion({ region: REGION, places, nodes: [], obstacles: [], gates: [], heightAt: () => 30 });
  const b = buildTamrielRegion({ region: REGION, places: shuffled, nodes: [], obstacles: [], gates: [], heightAt: () => 30 });
  assert.deepEqual([...a.roads].sort(), [...b.roads].sort(), 'the same roads');
  assert.deepEqual([...a.tracks].sort(), [...b.tracks].sort(), 'the same tracks');
  assert.equal(a.stats.roadNodes, 32);
  assert.equal(a.stats.trackNodes, 64, 'the villages and the inns');
  const paths = both(a);
  for (const p of places.filter((q) => q.type === T.HomeFarms || q.type === T.DungeonKeep)) {
    const bits = paths.get(beyondKey(p.x, p.y)) ?? 0;
    assert.ok(!bits || [...Object.keys(STEP)].map(Number).filter((bit) => bits & bit).length <= 1, 'a farm or a keep is no step on the way');
  }
  // a region over the Bay's corner: two towns either side of it, the road round it - nothing on the Bay
  const corner = regionOf(regionLattice({ x0: -400, y0: -200, w: 800, h: 300 }), 0, 0);
  const c = buildTamrielRegion({ region: corner, places: [{ x: -30, y: 60, type: T.TownCity }, { x: 60, y: -30, type: T.TownCity }], nodes: [], obstacles: [], gates: [], heightAt: () => 30 });
  assert.ok(walks(c.roads, [-30, 60], [60, -30]), 'joined');
  for (const k of [...c.roads.keys(), ...c.tracks.keys()]) assert.ok(!inBay(...beyondPixel(k)), 'no path on the Bay');
});

test('TESA14 a region\'s seams: two regions either side of a seam each route the edge they own once and whole, and their layers meet (mutant: owns, the core)', () => {
  const lat = regionLattice({ x0: 0, y0: -1000, w: 1600, h: 300 });
  const left = regionOf(lat, 0, 0), right = regionOf(lat, 1, 0);
  const a = { x: 770, y: -900, type: T.TownCity }, b = { x: 830, y: -880, type: T.TownCity };   // a in the left core, north of b in the right
  const args = { places: [], nodes: [a, b], obstacles: [], gates: [], heightAt: () => 30 };
  const L = buildTamrielRegion({ region: left, ...args }), R = buildTamrielRegion({ region: right, ...args });
  assert.ok(L.roads.size > 0, 'the left routes a-b: a is its own and first');
  assert.equal(R.roads.size, 0, 'the right none: the edge is the left\'s');
  const merged = mergeArenaRoads({ roads: new Map(), tracks: new Map() }, L);
  mergeArenaRoads(merged, R);
  assert.ok(walks(merged.roads, [a.x, a.y], [b.x, b.y]), 'over the seam, whole');
  assert.ok([...L.roads.keys()].some((k) => beyondPixel(k)[0] >= right.core.x0), 'into the right\'s core, from the left\'s own build');
});

test('TESA14 a capital: its pixels no route\'s; a road ends at its gate, the step into the city on the gate\'s byte alone; a gate with no road takes none (mutant: the obstacles, the gate\'s step, its core)', () => {
  const cap = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cap.push({ x: 400 + dx, y: -850 + dy });
  const gate = { x: 398, y: -850, into: [1, 0] };
  const nodes = [{ x: 398, y: -850, type: T.TownCity }, { x: 300, y: -850, type: T.TownCity }, { x: 500, y: -850, type: T.TownCity }];
  const out = buildTamrielRegion({ region: REGION, places: [], nodes, obstacles: cap, gates: [gate], heightAt: () => 30 });
  for (const p of cap) assert.equal(out.roads.get(beyondKey(p.x, p.y)) ?? 0, 0, `no road on the city at ${p.x}, ${p.y}`);
  assert.ok(out.roads.get(beyondKey(398, -850)) & DIR.E, 'the gate\'s step east into the city');
  assert.ok(walks(out.roads, [500, -850], [300, -850]), 'the road round the city all the same');
  assert.equal(out.stats.gated, 1);
  const lone = buildTamrielRegion({ region: REGION, places: [], nodes: [], obstacles: cap, gates: [gate], heightAt: () => 30 });
  assert.equal(lone.roads.size, 0, 'no road to it, no step');
});

test('TESA14 the capitals\' gates: each plan\'s own sides, the pixel just past its span at a side\'s middle, the step into the city; a capital\'s span its pixels (mutant: a side, the span)', () => {
  assert.deepEqual(CAPITALS.map((c) => [c.key, c.gates]), [
    ['imperial-city', ['W']], ['solitude', ['S']], ['mournhold', ['N', 'E', 'S', 'W']], ['alinor', ['N', 'E', 'W']],
    ['falinesti', ['N', 'E', 'S', 'W']], ['torval', ['N', 'E', 'W']], ['helstrom', ['N', 'S']],
  ]);
  assert.deepEqual(GATE_STEPS, { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });
  // PIN MOVED (AUDIT TESA II, lane R's R2): the pixel just past the span at the side's middle where the roads walk it, its
  // step into the city one of the city's own pixels - on the authored shape, on open ground everywhere
  CAPITALS.forEach((cap, k) => {
    const span = capitalSpanPixels(k), on = (x, y) => span.some((p) => p.x === x && p.y === y);
    assert.ok(span.length, cap.key);
    const gates = capitalGates(k, { walkable: () => true });
    assert.deepEqual(gates.map((g) => g.side), cap.gates, `${cap.key}: a gate each side`);
    for (const g of gates) {
      assert.deepEqual(g.into, GATE_STEPS[g.side].map((v) => -v), `${cap.key} ${g.side}: its step in`);
      assert.ok(!on(g.x, g.y) && on(g.x + g.into[0], g.y + g.into[1]), `${cap.key} ${g.side}: just past the span`);
    }
  });
  assert.deepEqual(capitalGates(99), []);
  assert.deepEqual(capitalSpanPixels(99), []);
});

// ── THE ROLL, CARRIED ───────────────────────────────────────────

const blk = (name, start = false) => ({ blockName: name, isStartingBlock: start });
const row = (mapId, type) => ({ name: `R${mapId}`, mapTableData: { mapId, locationType: type } });
const dun = (mapId, type, dungeonType, blocks) => ({ ...row(mapId, type), mapTableData: { mapId, locationType: type, dungeonType }, dungeon: { blocks } });

test('TESA14 the roll carried: rollSpec\'s numbers and rollTypeAt answer every pixel as the host\'s own rolls do - the countryside first, else a lair its plan allows (mutant: the counts, a template\'s dungeon type, a pool\'s size)', () => {
  const countryTemplates = new Map(COUNTRY_TYPES.map((t, k) => [t, t === T.HomeFarms ? [] : Array.from({ length: 1 + (k % 3) }, (_, i) => row(100 * t + i, t))]));   // a kind rated with no template stands none
  const full = [blk('N1.RDB', true), blk('N2.RDB'), blk('B1.RDB')];
  const lairTemplates = new Map(LAIR_TYPES.map((t, k) => [t, [dun(1000 + t, t, k, full), dun(2000 + t, t, 9, [blk('N3.RDB', true), blk('B2.RDB')])]]));
  lairTemplates.get(LAIR_TYPES[0]).push(dun(3000, LAIR_TYPES[0], 7, [blk('B3.RDB')]));   // its pool no interior: never laid out
  lairTemplates.get(LAIR_TYPES[1]).push(dun(4000, LAIR_TYPES[1], 1, [blk('B4.RDB')]), dun(4001, LAIR_TYPES[1], 1, [blk('B5.RDB')]));   // a plan of no interior block: none
  const pools = lairPools(lairTemplates);
  const countryRates = new Map([[230, [[T.HomeFarms, 0.02], [T.TownVillage, 0.04], [T.Tavern, 0.05]]], [226, [[T.TownHamlet, 0.06]]]]);
  const lairRates = new Map([[230, [[LAIR_TYPES[0], 0.004], [LAIR_TYPES[1], 0.008]]], [226, [[LAIR_TYPES[2], 0.01], [LAIR_TYPES[3], 0.0156]]]]);
  const world = { climateAt: (x, y) => ((x >> 5) + (y >> 5)) % 2 ? 230 : 226, heightAt: (x, y) => ((x * 7 + y * 3) % 11 ? 40 : 2), ground: (x, y) => (x ^ y) % 13 !== 0 };
  const spec = rollSpec({ countryRates, countryTemplates, lairRates, lairTemplates, lairPools: pools });
  const carried = rollTypeAt(JSON.parse(JSON.stringify(spec)), world);   // plain data: a worker's message
  const country = { rates: countryRates, templates: countryTemplates, ...world }, lair = { rates: lairRates, templates: lairTemplates, ...world };
  let stood = 0;
  for (let y = -400; y < -200; y++) for (let x = 1000; x < 1300; x++) {
    const c = countryStandsAt(country, x, y);
    const l = c ? null : lairStandsAt(lair, x, y);
    const want = c ? c.type : l && lairPlanned(pools.get(l.pick.template.mapTableData.dungeonType), lairBlockCount(l.pick.template)) ? l.pick.type : null;
    assert.equal(carried(x, y), want, `${x}, ${y}`);
    if (want !== null) stood++;
  }
  assert.ok(stood > 1000, `places met (${stood})`);
  assert.deepEqual(spec.lair.pools.find(([dt]) => dt === 7)?.[1], [0, 0, 1], 'a pool with no interior');
});

test('TESA14 the build\'s print and a region\'s key: the law\'s version, the builder\'s, the region and every input - the same inputs the same key, any one moved another (mutant: a term) - PIN MOVED (AUDIT TESA II R6, R10): WOODS.WLD\'s shape, the region first and the laws\' version in the key', () => {
  const woods = syntheticWoods(1000, 500, 20), moved = woods.slice();
  moved[moved.length - 3] = 21;   // a height byte of the map's own section
  const base = { woodsBytes: woods, fit: { ox: 1, oy: 2, ppu: 15.5 }, trace: { land: new Uint8Array([0, 1, 1]), province: new Uint8Array([0, 3, 4]) },
    spec: { country: { rates: [], counts: [] }, lair: { rates: [], templates: [], pools: [] } }, nodes: [{ x: 1, y: 2, type: 0 }], obstacles: [{ x: 3, y: 4 }], gates: [] };
  const p = inputsPrint(base);
  assert.equal(inputsPrint({ ...base }), p);
  for (const [k, v] of [['woodsBytes', moved], ['fit', { ox: 1, oy: 2, ppu: 15 }], ['trace', { land: new Uint8Array([1, 1, 1]), province: new Uint8Array([0, 3, 4]) }],
    ['spec', { ...base.spec, country: { rates: [[1, []]], counts: [] } }], ['nodes', [{ x: 1, y: 3, type: 0 }]], ['obstacles', []], ['gates', [{ x: 0, y: 0, into: [1, 0] }]]]) {
    assert.notEqual(inputsPrint({ ...base, [k]: v }), p, k);
  }
  const key = regionKey({ region: { i: 2, j: 3 }, inputs: p });
  assert.equal(key, `tamriel-roads:2,3:v${TAMRIEL_ROADS_VERSION}:g${GENERATOR_VERSION}:l${GROUND_ROLL_VERSION}:${p}`);
  assert.ok(key.startsWith(regionPrefix({ i: 2, j: 3 })) && !key.startsWith(regionPrefix({ i: 2, j: 33 })), 'the region first, whatever the print');
  assert.notEqual(regionKey({ region: { i: 3, j: 2 }, inputs: p }), key);
});

// ── THE WORKER, THE CLIENT, THE TERRAIN CLIENT ──────────────────

/** WOODS.WLD's shape over a flat height map (test/tesa5_join.test.js's own). */
function syntheticWoods(W, H, v = 60) {
  const offsetsStart = 32 + 28 * 4, cellsStart = offsetsStart + W * H * 4, heightMapOffset = cellsStart + 2 * (22 + 25);
  const bytes = new Uint8Array(heightMapOffset + W * H);
  const dv = new DataView(bytes.buffer);
  dv.setUint32(0, W * H * 4, true); dv.setUint32(4, W, true); dv.setUint32(8, H, true); dv.setUint32(16, cellsStart, true); dv.setUint32(28, heightMapOffset, true);
  for (let i = 0; i < W * H; i++) dv.setUint32(offsetsStart + i * 4, cellsStart, true);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bytes[heightMapOffset + y * W + x] = v;
  return bytes;
}
/** A trace all land but its rim, at the picture's own size: the ground past the Bay land wherever a test looks. */
function landTrace() {
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1);
  for (let x = 0; x < w; x++) { land[x] = 0; land[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { land[y * w] = 0; land[y * w + w - 1] = 0; }
  return { w, h, land, province: new Uint8Array(w * h).fill(3) };
}
const EMPTY_SPEC = rollSpec({ countryRates: new Map(), countryTemplates: new Map(), lairRates: new Map(), lairTemplates: new Map(), lairPools: new Map() });

test('TESA14 the roads\' worker: its inputs once, then a region a message - its layer packed back with its stats; a build before its inputs answers an error, never a throw (mutant: the region read, the pack)', () => {
  const state = createRoadsWorkerState();
  const posts = [];
  state.handle({ t: 'build', id: 1, i: 0, j: 0 }, (m) => posts.push(m));
  assert.equal(posts[0].error, 'no inputs');
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 1600, h: 600 });
  const nodes = [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -880, type: T.TownCity }];
  state.handle({ t: 'init', woodsBytes: syntheticWoods(1000, 500), trace: landTrace(), fit: null, spec: EMPTY_SPEC, nodes, obstacles: [], gates: [], lattice }, () => {});
  state.handle({ t: 'build', id: 2, i: 0, j: 0 }, (m) => posts.push(m));
  const got = posts.at(-1);
  assert.deepEqual([got.t, got.id, got.i, got.j, got.error], ['region', 2, 0, 0, undefined]);
  const layer = unpackArenaRoads(got.layer);
  assert.ok(walks(layer.roads, [300, -900], [360, -880]), 'its two towns joined');
  assert.equal(got.stats.roadNodes, 2);
  assert.ok(got.ms >= 0);
  assert.deepEqual(state.placesIn(0, -1000, 100, -900), [], 'no roll, no places');
});

/** A worker that answers each build at once, through the worker's own state - and what it was asked. */
function fakeWorkers() {
  const made = [];
  const make = () => {
    const state = createRoadsWorkerState(), asked = [];
    const w = { asked, onmessage: null, onerror: null, terminate() { w.dead = true; },
      postMessage(m) { asked.push(m.t); queueMicrotask(() => state.handle(m, (out) => w.onmessage?.({ data: out }))); } };
    made.push(w);
    return w;
  };
  return { make, made };
}
function memStore(seed = new Map()) {
  return { data: seed, get: (k) => seed.get(k) ?? null, set: (k, v) => { seed.set(k, v); } };
}
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setTimeout(r, 0)); };

test('TESA14 the client: every region asked of the cache first - a hit lands without a build, a miss goes to a free worker (its inputs posted first) and into the cache; a new start drops the last one\'s answers (mutant: the cache, the init, the run\'s check)', async () => {
  assert.equal(roadsWorkerCount(8), 4);
  assert.equal(roadsWorkerCount(2), 1);
  assert.equal(roadsWorkerCount(5), 3);
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 2400, h: 300 });
  const nodes = [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -880, type: T.TownCity }, { x: 1100, y: -900, type: T.TownCity }, { x: 1160, y: -880, type: T.TownCity }];
  const inputs = { woodsBytes: syntheticWoods(1000, 500), trace: landTrace(), fit: null, spec: EMPTY_SPEC, nodes, obstacles: [], gates: [], lattice };
  const regions = [regionOf(lattice, 0, 0), regionOf(lattice, 1, 0), regionOf(lattice, 2, 0)];
  const print = inputsPrint(inputs);
  const store = memStore();
  const held = { roads: new Map([[beyondKey(5, -5), DIR.E]]), tracks: new Map(), join: new Map() };
  store.set(regionKey({ region: regions[2], inputs: print }), { layer: packArenaRoads(held), places: packPastBayPlaces([{ x: 5, y: -5, type: T.HomeFarms }]) });   // TESA15: its places beside its layer
  const w = fakeWorkers();
  const client = createTamrielRoadsClient({ makeWorker: w.make, workers: 2, store });
  const landed = [];
  const placed = new Map();
  await client.start({ inputs, print, regions, onRegion: (r, layer, stats, places) => { landed.push([r.i, layer.roads.size, stats.cached]); placed.set(r.i, places); } });
  await settle();
  assert.deepEqual(landed.find(([i]) => i === 2), [2, 1, true], 'the held region from the cache');
  assert.deepEqual(placed.get(2), [{ x: 5, y: -5, type: T.HomeFarms }], 'its places with it (TESA15)');
  assert.ok(Array.isArray(placed.get(0)), 'a built one\'s too');
  assert.equal(landed.length, 3);
  assert.ok(landed.filter(([, , c]) => !c).every(([, n]) => n > 0), 'the others built');
  assert.equal(w.made.length, 2);
  for (const wk of w.made) if (wk.asked.length) assert.equal(wk.asked[0], 'init', 'its inputs before its first build');
  assert.ok(store.data.get(regionKey({ region: regions[0], inputs: print }))?.layer?.keys, 'a fresh region kept, its layer and its places');
  assert.ok(store.data.get(regionKey({ region: regions[0], inputs: print }))?.places?.keys);
  assert.equal(client.pending(), 0);
  // a new start before the last one's cache answered: the last one's answers dropped, the held one too
  const late = [], later = [];
  const a = client.start({ inputs, print, regions, onRegion: (r) => late.push(r.i) });
  const b = client.start({ inputs, print: `${print}x`, regions: [regions[2]], onRegion: (r) => later.push(r.i) });
  await a; await b; await settle();
  assert.deepEqual(late, [], 'superseded: nothing of it lands');
  assert.deepEqual(later, [2], 'the new one\'s own, built');
  const c = client.start({ inputs, print: `${print}y`, regions: [regions[0]], onRegion: (r) => late.push(r.i) });
  client.stop();
  await c; await settle();
  assert.deepEqual(late, [], 'stopped: nothing lands');
  client.dispose();
  assert.ok(w.made.every((wk) => wk.dead));
});

test('TESA14 the client\'s queue: `near` puts the nearest region next; a worker that dies gives its region back to the queue (mutant: the sort, the give-back)', async () => {
  const asked = [];
  let wk = null;
  const make = () => (wk = { onmessage: null, onerror: null, terminate() {}, postMessage(m) { if (m.t === 'build') asked.push(m); } });
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 2400, h: 300 });
  const regions = [regionOf(lattice, 0, 0), regionOf(lattice, 1, 0), regionOf(lattice, 2, 0)];
  const client = createTamrielRoadsClient({ makeWorker: make, workers: 1, store: null });
  await client.start({ inputs: {}, print: 'p', regions, onRegion: () => {} });
  assert.deepEqual(asked.map((m) => m.i), [0], 'one worker: the first');
  client.near(2000, -850);
  const answer = (m) => wk.onmessage({ data: { t: 'region', id: m.id, i: m.i, j: m.j, error: 'none here' } });
  answer(asked[0]);
  assert.deepEqual(asked.map((m) => m.i), [0, 2], 'the nearest the player next');
  assert.equal(client.pending(), 2);
  wk.onerror({ message: 'gone' });
  assert.equal(client.pending(), 2, 'its region back in the queue, no worker to take it');
  client.dispose();
  // a build superseded while a worker was on its region: that answer is the last build's, and lands nowhere
  const asked2 = [], landed = [];
  let w2 = null;
  const two = createTamrielRoadsClient({ makeWorker: () => (w2 = { onmessage: null, onerror: null, terminate() {}, postMessage(m) { asked2.push(m); } }), workers: 1, store: null });
  await two.start({ inputs: {}, print: 'a', regions: [regions[0]], onRegion: () => landed.push('a') });
  await two.start({ inputs: {}, print: 'b', regions: [regions[1]], onRegion: (r) => landed.push(`b${r.i}`) });
  const layer = packArenaRoads({ roads: new Map(), tracks: new Map(), join: new Map() });
  const first = asked2.find((m) => m.t === 'build');
  w2.onmessage({ data: { t: 'region', id: first.id, i: first.i, j: first.j, layer, stats: {}, ms: 1 } });
  assert.deepEqual(landed, [], 'the last build\'s answer dropped');
  assert.deepEqual(asked2.filter((m) => m.t !== 'build').length, 2, 'the new build\'s inputs posted before its region');
  const next = asked2.filter((m) => m.t === 'build').at(-1);
  assert.equal(next.i, 1);
  w2.onmessage({ data: { t: 'region', id: next.id, i: next.i, j: next.j, layer, stats: {}, ms: 1 } });
  assert.deepEqual(landed, ['b1']);
  two.dispose();
});

test('TESA14 the terrain client: each add merged into the one installed and posted on - a reset first drops it - every add an epoch, told as it lands (mutant: the merge, the reset, the epoch)', () => {
  const c = new TerrainGenClient({ woods: null });
  const told = [];
  const on = (epoch, add, reset) => told.push([epoch, add?.roads.size ?? 0, reset]);
  const e1 = c.addArenaRoads(joinLayer([]), on, { reset: true });
  c.addArenaRoads({ roads: new Map([[beyondKey(1, -1), DIR.E]]), tracks: new Map() }, on);
  c.addArenaRoads({ roads: new Map([[beyondKey(1, -1), DIR.W], [beyondKey(2, -1), DIR.W]]), tracks: new Map() }, on);
  assert.equal(arenaRoadsLayer().roads.get(beyondKey(1, -1)), DIR.E | DIR.W, 'two regions\' bits on one pixel, merged');
  assert.equal(arenaRoadsLayer().roads.size, 2);
  assert.deepEqual(told, [[e1, 0, true], [e1 + 1, 1, false], [e1 + 2, 2, false]]);
  assert.equal(c.arenaRoadsEpoch, e1 + 2);
  assert.equal(c.arenaRoadsLanded, e1 + 2);
  c.addArenaRoads(null, null, { reset: true });
  assert.equal(arenaRoadsLayer().roads.size, 0, 'reset: none');
});

// ── THE HOST ────────────────────────────────────────────────────

test('TESA14 the host\'s module: nothing before the trace or while the Bay\'s network is on its way; then the crossings first, the layer reset, and the build with Arena\'s towns, the capitals\' gates on land and the crossings\' gates; each region to the terrain client; a move of the places starts it again (mutant: the waits, a node, the reset, the hand-on)', async () => {
  const adds = [], starts = [];
  let bay = null, hasRoads = true;
  const terrainGen = { addArenaRoads: (layer, on, o = {}) => adds.push({ n: layer?.roads.size ?? 0, reset: !!o.reset, on }), roads: () => bay, get hasRoads() { return hasRoads; } };
  const nears = [];
  const client = { start: (o) => { starts.push(o); return Promise.resolve(); }, near: (x, y) => nears.push([x, y]), pending: () => 0, dispose: () => {} };
  const onLanded = () => {};
  // the Bay's network known before the trace: nothing yet
  const early = { addArenaRoads: () => {}, roads: () => ({}), hasRoads: true };
  const earlyStarts = [];
  const none = { pixels: () => null, towns: () => [], spec: () => EMPTY_SPEC, capitals: () => false };
  createTamrielRoadsHost({ terrainGen: early, woodsBytes: new Uint8Array(3), heightAt: () => 30, joinLand: () => true, onLanded, standing: none, client: { ...client, start: (o) => { earlyStarts.push(o); return Promise.resolve(); } }, log: { log() {}, warn() {} } })
    .frame(null);
  assert.equal(earlyStarts.length, 0, 'no trace, no build');
  const towns = [{ x: 100, y: -300, type: T.TownCity }];
  let pixels = null, asked = 0;
  const standing = { pixels: () => pixels, towns: () => { asked++; return towns; }, spec: () => EMPTY_SPEC, capitals: () => false };
  const host = createTamrielRoadsHost({ terrainGen, woodsBytes: new Uint8Array(3), heightAt: () => 30, joinLand: () => true, onLanded, standing, client, log: { log() {}, warn() {} } });
  host.frame(null);
  assert.equal(starts.length, 0, 'no trace');
  pixels = { stood: [] };
  host.frame(null);
  assert.equal(starts.length, 0, 'the Bay\'s network on its way');
  assert.equal(asked, 0, 'the towns read as a build starts, never before');
  hasRoads = false;
  host.frame({ x: 500, y: 250 });
  assert.equal(starts.length, 1);
  assert.deepEqual(adds[0], { n: 0, reset: true, on: onLanded }, 'the crossings first (none), the layer reset');
  assert.deepEqual(starts[0].inputs.nodes, towns);
  assert.ok(starts[0].regions.length > 0 && starts[0].print.length > 0);
  starts[0].onRegion(starts[0].regions[0], { roads: new Map([[1, 2]]), tracks: new Map() }, { cached: true });
  assert.deepEqual(adds.at(-1), { n: 1, reset: false, on: onLanded }, 'a region handed on');
  host.frame({ x: 500, y: 250 });
  assert.equal(starts.length, 1, 'nothing moved, nothing again');
  assert.equal(asked, 1, 'nor the towns read again');
  assert.deepEqual(nears, [], 'the player in the region the build began from');
  host.frame({ x: 520, y: 260 });
  assert.deepEqual(nears, [], 'nor a step within it');
  host.frame({ x: 2600, y: 260 });
  assert.deepEqual(nears, [[2600, 260]], 'into another region: the queue re-ordered');
  pixels = { stood: [] };
  host.frame(null);
  assert.equal(starts.length, 2, 'the places moved: again');
  const src = read('src/scenes/tamrielRoadsHost.js');
  assert.match(src, /const walkable = \(x, y\) => !inBay\(x, y\) && heightAt\(x, y\) > WATER_BYTE && !capitalOnPixel\(x, y\);\n[^]*?gates\.push\(\.\.\.capitalGates\(k, \{ walkable \}\)\);/, 'a gate on land past the Bay, the host\'s own - PIN MOVED (AUDIT TESA II R2: walked out over it)');
  assert.match(src, /const nodes = \[\.\.\.towns, \.\.\.gates\.map\(\(g\) => \(\{ x: g\.x, y: g\.y, type: LOCATION_TYPES\.TownCity \}\)\), \.\.\.joins\.map/, 'Arena\'s towns, the gates, the crossings\' gates');
});

test('TESA14 the world\'s wiring: the host made where the land past the Bay streams, on the frame with Arena\'s towns (a capital\'s own place its gates while the capitals stand), the roll\'s numbers and the player\'s pixel; the roll reads no road (mutant: the towns\' filter, the spec)', () => {
  const W = hostText('src/scenes/world.js');
  assert.match(W, /const _tamrielRoads = tamrielLand \? createTamrielRoadsHost\(\{ terrainGen, woodsBytes, heightAt: \(x, y\) => host\.woods\.getHeightMapValue\(x, y\), joinLand: arenaJoinLand, onLanded: arenaRoadsLanded,\n\s+standing: \{ pixels: arenaPixels, towns: tamrielRoadTowns, spec: tamrielRoadsSpec, capitals: \(\) => !!_capitalBase, held: tamrielRoadHeld \} \}\) : null;/);
  assert.match(W, /if \(_tamrielRoads\) _tamrielRoads\.frame\(state\.current\);/, 'on the frame, with the player\'s pixel (PERF-V8: what stands read by the host)');
  assert.match(W, /now\.stood\.filter\(\(p\) => !\(p\.pinned && _capitalBase\) && arenaTemplateOf\(_arenaTemplates, p\)\)/, 'a capital\'s place is its gates; a place with no template stands none');
  assert.match(W, /countryRates: countryRatesNow\(\), countryTemplates: _countryTemplates, lairRates: lairRatesNow\(\), lairTemplates: _lairTemplates, lairPools: _lairPools/);
  assert.doesNotMatch(W, /arenaPathsAt/, 'no place\'s roll asks a road');
  assert.doesNotMatch(W, /handArenaRoads|terrainGen\.setArenaRoads/, 'TESA4\'s hand-over retired');
});

// ── WITH ARENA2 ─────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('TESA14 with ARENA2: a region of the player\'s own continent, built twice in two orders the same - no path stops in the open, none crosses water, none on a capital, every hamlet and village on a path - PIN MOVED (AUDIT TESA II R11): every one, counted, the capitals\' gates and pixels in its inputs as the host hands them', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const { setTamrielTrace, tamrielTrace } = await import('../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit, tamrielFit, tamrielFrameInBay } = await import('../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile, MAP_WIDTH } = await import('../src/formats/woodsFile.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { groundWoods } = await import('../src/world/tamriel/tamrielGround.js');
  const { WATER_BYTE } = await import('../src/world/roadsProducer.js');
  const { isWaterPixel } = await import('../src/ui/overworldModel.js');
  const { isMainStoryDungeon } = await import('../src/world/dungeon/dungeonTextures.js');
  const { countryTemplates, countryCounts, bayLand, countryRates } = await import('../src/world/tamrielCountry.js');
  const { lairTemplates } = await import('../src/world/tamrielDungeons.js');
  const { capitalOnPixel } = await import('../src/world/tamrielCapitals.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const g = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const climate = (x, y) => maps.getClimateIndex(x, y);
    const land = bayLand(climate, (x, y, c) => isWaterPixel(c, woods.getHeightMapValue(x, y)));
    const cT = countryTemplates(rows, isMainStoryDungeon), lT = lairTemplates(rows, isMainStoryDungeon);
    const spec = rollSpec({ countryRates: countryRates(countryCounts(cT, climate), land), countryTemplates: cT, lairRates: countryRates(countryCounts(lT, climate), land, LAIR_TYPES), lairTemplates: lT, lairPools: lairPools(lT) });
    const lattice = regionLattice(tamrielFrameInBay());
    const region = regionsByNearness(lattice, (r) => regionHasLand(r, (x, y) => g.getHeightMapValue(x, y)), { x: 500, y: 250 }).find((r) => r.i === 0 && r.j === 4);
    assert.ok(region, 'the region west of the Bay');
    const f = tamrielFit();
    // AUDIT TESA II R11: the capitals' pixels and gates as the host hands them (scenes/tamrielRoadsHost.js start)
    const obstacles = CAPITALS.flatMap((_, k) => capitalSpanPixels(k));
    const gates = CAPITALS.flatMap((_, k) => capitalGates(k)).filter((q) => !inBay(q.x, q.y) && g.getHeightMapValue(q.x, q.y) > WATER_BYTE);
    const inputs = { woodsBytes: bytes('WOODS.WLD'), trace: tamrielTrace(), fit: { ox: f.ox, oy: f.oy, ppu: f.ppu }, spec, nodes: gates.map((q) => ({ x: q.x, y: q.y, type: T.TownCity })), obstacles, gates, lattice };
    const once = createRoadsWorkerState(), twice = createRoadsWorkerState();
    let a = null, b = null;
    once.handle({ t: 'init', ...inputs }, () => {});
    once.handle({ t: 'build', id: 1, i: region.i, j: region.j }, (m) => { a = m; });
    twice.handle({ t: 'init', ...inputs }, () => {});
    twice.handle({ t: 'build', id: 1, i: 0, j: 5 }, () => {});   // another region first: the cache filled in another order
    twice.handle({ t: 'build', id: 2, i: region.i, j: region.j }, (m) => { b = m; });
    assert.ok(!a.error && !b.error, a.error ?? b.error);
    const la = unpackArenaRoads(a.layer), lb = unpackArenaRoads(b.layer);
    assert.deepEqual([[...la.roads].sort(), [...la.tracks].sort()], [[...lb.roads].sort(), [...lb.tracks].sort()], 'the same roads, whatever came first');
    const places = once.placesIn(region.gx, region.gy, region.gx + 1000, region.gy + 500);
    const at = new Set(places.map((p) => `${p.x},${p.y}`));
    const paths = both(la);
    let dead = 0, wet = 0;
    for (const [k, bits] of paths) {
      const [x, y] = beyondPixel(k);
      if ([...Object.keys(STEP)].map(Number).filter((bit) => bits & bit).length === 1 && !at.has(`${x},${y}`)) dead++;
      if (g.getHeightMapValue(x, y) <= WATER_BYTE && !at.has(`${x},${y}`)) wet++;
      assert.equal(capitalOnPixel(x, y), null);
    }
    assert.deepEqual([dead, wet], [0, 0], 'no path stops in the open; none over water');
    const served = places.filter((p) => inCore(region, p.x, p.y) && (p.type === T.TownHamlet || p.type === T.TownVillage));
    assert.ok(served.length > 0);
    const reached = served.filter((p) => paths.has(beyondKey(p.x, p.y)));
    // AUDIT TESA II R11: every one - where the bar was nine in ten, and the beach line's ponds (R1) left one off a path here
    // and thirty-three in (4, 3) under it
    assert.deepEqual(served.filter((p) => !paths.has(beyondKey(p.x, p.y))).map((p) => [p.x, p.y, p.type]), [], `${reached.length} of ${served.length} hamlets and villages on a path`);
    assert.equal(MAP_WIDTH, MAP_W);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
