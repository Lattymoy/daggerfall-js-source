// AUDIT TESA II lane R (2026-10-25) - THE ROADS PAST THE BAY, pinned where the audit found them wrong
// (bible/03-World/Arena-Provinces.md TESA14 and TESA15, AUDIT TESA II's lines): the builder a step at a time and the page's
// own thread's build when no worker can (R8); a gate a neighbouring region routes to, stepped (R7); the crossings' runs
// held (R9); the print reading every height byte and relief cell, and the laws' own version beside it (R6); the cache's
// hits landing a budget a task (R3); the workers let go when idle (R4); a dead worker's region, its replacement (R8); one
// print a region in the cache, a failed keep said (R10); and with ARENA2 every capital's road (R2).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildRoadNetwork, roadNetworkSteps, drainSteps, DIR, MAP_H } from '../../src/world/road/roadNetwork.js';
import {
  GROUND_ROLL_VERSION, LEGACY_REGION_KEYS, REGION_STEP_ROWS, regionLattice, regionOf, buildTamrielRegion, tamrielRegionSteps, inputsPrint, regionKey,
  regionPrefix, rollSpec, rollTypeAt,
} from '../../src/world/tamrielRoads.js';
import { beyondKey, joinRunPixels, packArenaRoads, unpackArenaRoads, mergeArenaRoads } from '../../src/world/arenaRoads.js';
import { packPastBayPlaces, unpackPastBayPlaces } from '../../src/world/pastBayPlaces.js';
import { createTamrielRoadsClient, WORKER_DEATHS } from '../../src/world/tamrielRoadsClient.js';
import { createRoadsWorkerState } from '../../src/world/tamrielRoadsWorker.js';
import { createTamrielRoadsHost } from '../../src/scenes/tamrielRoadsHost.js';
import { idbStore } from '../../src/world/roadsCache.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { inBay, setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { groundWoods, tamrielHeightByte, dropGroundCache } from '../../src/world/tamriel/tamrielGround.js';
import { RELIEF_SCALE } from '../../src/world/tamriel/tamrielRelief.js';
import { createCountryGround, COUNTRY_TYPES } from '../../src/world/tamrielCountry.js';
import { lairPools, LAIR_TYPES } from '../../src/world/tamrielDungeons.js';
import { ghostfenceFrame } from '../../src/world/tamriel/ghostfence.js';   // AUDIT RED-MOUNTAIN G3: the fence's law in the print
import { memoryIdb } from '../memoryIdb.mjs';

const T = LOCATION_TYPES;
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); });
const rnd = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const settle = async (n = 20) => { for (let k = 0; k < n; k++) await new Promise((r) => setTimeout(r, 0)); };
/** WOODS.WLD's shape over a flat height map (test/tesa14_roads.test.js's own). */
function syntheticWoods(W, H, v = 60) {
  const offsetsStart = 32 + 28 * 4, cellsStart = offsetsStart + W * H * 4, heightMapOffset = cellsStart + 2 * (22 + 25);
  const bytes = new Uint8Array(heightMapOffset + W * H);
  const dv = new DataView(bytes.buffer);
  dv.setUint32(0, W * H * 4, true); dv.setUint32(4, W, true); dv.setUint32(8, H, true); dv.setUint32(16, cellsStart, true); dv.setUint32(28, heightMapOffset, true);
  for (let i = 0; i < W * H; i++) dv.setUint32(offsetsStart + i * 4, cellsStart, true);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bytes[heightMapOffset + y * W + x] = v;
  return bytes;
}
/** A trace all land but its rim, at the picture's own size. */
function landTrace() {
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1);
  for (let x = 0; x < w; x++) { land[x] = 0; land[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { land[y * w] = 0; land[y * w + w - 1] = 0; }
  return { w, h, land, province: new Uint8Array(w * h).fill(3) };
}
/** test/world/tamrielrelief.test.js's Morrowind in a box, with its relief or none. */
function morrowindTrace({ relief = true } = {}) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 30; y < 100; y++) for (let x = 200; x < 290; x++) { land[y * w + x] = 1; province[y * w + x] = 4; }
  if (!relief) return { w, h, land, province };
  const s = RELIEF_SCALE, cells = new Uint8Array(w * s * h * s);
  for (let j = 0; j < h * s; j++) for (let i = 0; i < w * s; i++) {
    const px = (i + 0.5) / s, py = (j + 0.5) / s;
    if (!land[Math.floor(py) * w + Math.floor(px)]) continue;
    const cone = 120 - 8 * Math.hypot(px - 235, py - 54), ridge = 128 - 8 * Math.hypot(px - 215, py - 88);
    cells[j * w * s + i] = Math.max(6, Math.round(cone), Math.round(ridge), Math.round(6 + 3 * Math.sin(px) * Math.cos(py)));   // lowlands about the shore byte too
  }
  return { w, h, land, province, relief: cells };
}
const EMPTY_SPEC = rollSpec({ countryRates: new Map(), countryTemplates: new Map(), lairRates: new Map(), lairTemplates: new Map(), lairPools: new Map() });
const blk = (name, start = false) => ({ blockName: name, isStartingBlock: start });
const row = (mapId, type) => ({ name: `R${mapId}`, mapTableData: { mapId, locationType: type } });
const dun = (mapId, type, dungeonType, blocks) => ({ ...row(mapId, type), mapTableData: { mapId, locationType: type, dungeonType }, dungeon: { blocks } });
const STEP = { [DIR.N]: [0, -1], [DIR.NE]: [1, -1], [DIR.E]: [1, 0], [DIR.SE]: [1, 1], [DIR.S]: [0, 1], [DIR.SW]: [-1, 1], [DIR.W]: [-1, 0], [DIR.NW]: [-1, -1] };
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

// ── R8: THE BUILDER A STEP AT A TIME ────────────────────────────

test('AUDIT TESA II R8 the builder a step at a time: roadNetworkSteps drained is buildRoadNetwork to the byte - the Bay\'s build and a region\'s - and yields between its routes; a region\'s steps are buildTamrielRegion\'s answer; the worker\'s steps answer as its message does (mutant: a step dropped, the drain short)', () => {
  const r = rnd(9), locations = [];
  for (let k = 0; k < 120; k++) locations.push({ x: 20 + Math.floor(r() * 900), y: 20 + Math.floor(r() * 450), type: [T.TownCity, T.TownHamlet, T.TownVillage, T.Tavern, T.HomeFarms][k % 5] });
  const lake = (x, y) => Math.hypot(x - 500, y - 250) < 60;
  const args = { locations, heightAt: (x, y) => 20 + ((x * 7 + y * 13) % 9), isWater: lake };
  const whole = buildRoadNetwork(args);
  const it = roadNetworkSteps(args);
  let steps = 0, out;
  for (;;) { const s = it.next(); if (s.done) { out = s.value; break; } steps++; }
  assert.ok(steps > whole.stats.roadEdges, `a step a route and more (${steps})`);
  assert.deepEqual([Array.from(out.roads), Array.from(out.tracks), out.stats], [Array.from(whole.roads), Array.from(whole.tracks), whole.stats], 'the same network to the byte');
  assert.deepEqual(drainSteps(roadNetworkSteps({ ...args, owns: (n) => n.x < 500 })).roads, buildRoadNetwork({ ...args, owns: (n) => n.x < 500 }).roads, 'a region\'s build');
  // towns alone: a step for the land's components, then one a road it routes (an island pair none: never searched)
  const towns = { ...args, locations: locations.map((l, k) => ({ ...l, type: k % 2 ? T.TownCity : T.TownHamlet })) };
  const tn = buildRoadNetwork(towns), ti = roadNetworkSteps(towns);
  let ts = 0;
  while (!ti.next().done) ts++;
  assert.equal(ts, 1 + tn.stats.roadEdges - tn.stats.islands, 'a step a road searched');
  // a region's steps, its answer whole
  const region = regionOf(regionLattice({ x0: 0, y0: -1000, w: 800, h: 300 }), 0, 0);
  const places = locations.map((p) => ({ x: p.x - 100 + region.core.x0, y: p.y - 100 + region.core.y0, type: p.type }));
  const o = { region, places, nodes: [], obstacles: [], gates: [], heightAt: () => 30 };
  const a = buildTamrielRegion(o), gen = tamrielRegionSteps(o);
  let n = 0, b;
  for (;;) { const s = gen.next(); if (s.done) { b = s.value; break; } n++; }
  assert.ok(n > 20, `its ground and its routes in steps (${n})`);
  const bare = tamrielRegionSteps({ ...o, places: [] });
  let bn = 0;
  while (!bare.next().done) bn++;
  assert.equal(bn, MAP_H / REGION_STEP_ROWS + 3, 'its ground a step every REGION_STEP_ROWS rows, its land\'s pieces (PIN MOVED (EXACT-PIECES): world/tamrielLandPieces.js labelLand, a step), the land\'s law (PIN MOVED (VOYAGER1): world/road/roadLand.js landForRoutes, a step), then the land\'s components');
  assert.deepEqual([[...b.roads], [...b.tracks], b.places, b.stats], [[...a.roads], [...a.tracks], a.places, a.stats]);
  // the worker: `steps` answers what `handle` posts
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 1600, h: 600 });
  const nodes = [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -880, type: T.TownCity }];
  // a roll that stands places on the land: every climate rated for villages and hamlets
  const rates = new Map(Array.from({ length: 20 }, (_, c) => [220 + c, [[T.TownVillage, 0.003], [T.TownHamlet, 0.001]]]));
  const spec = rollSpec({ countryRates: rates, countryTemplates: new Map([[T.TownVillage, [row(1, T.TownVillage)]], [T.TownHamlet, [row(2, T.TownHamlet)]]]), lairRates: new Map(), lairTemplates: new Map(), lairPools: new Map() });
  const init = { t: 'init', woodsBytes: syntheticWoods(1000, 500), trace: landTrace(), fit: null, spec, nodes, obstacles: [], gates: [], lattice };
  const state = createRoadsWorkerState();
  state.handle(init, () => {});
  let posted = null;
  state.handle({ t: 'build', id: 4, i: 0, j: 0 }, (m) => { posted = m; });
  const stepped = drainSteps(state.steps({ t: 'build', id: 4, i: 0, j: 0 })).msg;
  assert.deepEqual(unpackArenaRoads(stepped.layer), unpackArenaRoads(posted.layer));
  assert.deepEqual([stepped.i, stepped.j, stepped.id, stepped.stats], [posted.i, posted.j, posted.id, posted.stats]);
  const core = regionOf(lattice, 0, 0).core, rolled = state.placesIn(core.x0, core.y0, core.x1, core.y1).map((p) => [p.x, p.y, p.type]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  assert.ok(rolled.length > 50, `places rolled (${rolled.length})`);
  assert.deepEqual(unpackPastBayPlaces(stepped.places).map((p) => [p.x, p.y, p.type]), rolled, 'every place its core holds, rolled a strip at a time');
});

// ── R7: A GATE A NEIGHBOUR ROUTES TO ────────────────────────────

test('AUDIT TESA II R7 a capital\'s gate whose road the neighbouring region routes (the edge\'s first end in its core) is stepped into the city by that region - the merged layer carries the step (mutant: the step its core\'s alone)', () => {
  const lat = regionLattice({ x0: 0, y0: -2000, w: 800, h: 600 });   // two cores stacked
  const north = regionOf(lat, 0, 0), south = regionOf(lat, 0, 1);
  const cap = [{ x: 400, y: -1689 }];
  const gate = { x: 400, y: -1690, into: [0, 1] };   // the north gate, just inside the south core; the step south into the city
  const args = { places: [], nodes: [{ x: 400, y: -1740, type: T.TownCity }, { x: gate.x, y: gate.y, type: T.TownCity }], obstacles: cap, gates: [gate], heightAt: () => 30 };
  const N = buildTamrielRegion({ region: north, ...args }), S = buildTamrielRegion({ region: south, ...args });
  assert.ok(N.roads.size > 0 && S.roads.size === 0, 'the north routes it: its town is the first end');
  assert.equal(N.stats.gated, 1, 'and steps the gate, though the gate is the south\'s');
  const merged = mergeArenaRoads(mergeArenaRoads({ roads: new Map(), tracks: new Map() }, N), S);
  assert.ok((merged.roads.get(beyondKey(gate.x, gate.y)) ?? 0) & DIR.S, 'the road runs on into the city');
  assert.equal(merged.roads.get(beyondKey(cap[0].x, cap[0].y)) ?? 0, 0, 'none on the city');
});

// ── R9: THE CROSSINGS' RUNS HELD ────────────────────────────────

test('AUDIT TESA II R9 the crossings\' runs: their pixels past the Bay but the gate are held - no rolled place stands on one, a route goes round it - and the host hands them with the Arena places\' (mutant: the runs unhanded, the gate held, a Bay pixel held)', async () => {
  const run = [[394, 499], [394, 500], [394, 501], [394, 502], [394, 503], [394, 504], [394, 505], [394, 506], [394, 507]];
  const joins = [{ side: 'S', gate: [394, 507], meet: [394, 499], run }];
  const held = joinRunPixels(joins);
  assert.deepEqual(held, run.slice(1, -1).filter(([x, y]) => !inBay(x, y)).map(([x, y]) => ({ x, y })), 'past the Bay, the gate\'s not');
  assert.deepEqual(held.map((p) => p.y), [500, 501, 502, 503, 504, 505, 506]);
  const region = regionOf(regionLattice({ x0: 0, y0: 400, w: 800, h: 300 }), 0, 0);
  const places = [{ x: 394, y: 503, type: T.TownVillage }, { x: 420, y: 560, type: T.TownVillage }];
  const nodes = [{ x: 394, y: 507, type: T.TownCity }, { x: 394, y: 600, type: T.TownCity }];
  const out = buildTamrielRegion({ region, places, nodes, obstacles: [], gates: [], held, heightAt: () => 30 });
  assert.deepEqual(out.places.map((p) => [p.x, p.y]), [[420, 560]], 'none on the run');
  for (const p of held) assert.equal(out.roads.get(beyondKey(p.x, p.y)) ?? 0, 0, `no route along the run (${p.y})`);
  assert.ok(walks(out.roads, [394, 507], [394, 600]), 'the gate\'s road away from the Bay');
  // the host: the runs with the held pixels
  const starts = [];
  const client = { start: (o) => { starts.push(o); return Promise.resolve(); }, near: () => {}, pending: () => 0, dispose: () => {} };
  const bay = { roads: new Uint8Array(1000 * 500) };
  for (let y = 495; y < 500; y++) bay.roads[y * 1000 + 300] = DIR.N | DIR.S;
  const terrainGen = { addArenaRoads: () => {}, roads: () => bay, hasRoads: true };
  const standing = { pixels: () => ({ stood: [] }), towns: () => [], spec: () => EMPTY_SPEC, capitals: () => false, held: () => [{ x: 7, y: -7 }] };
  createTamrielRoadsHost({ terrainGen, woodsBytes: new Uint8Array(3), heightAt: () => 30, joinLand: () => true, onLanded: () => {}, standing, client, log: { log() {}, warn() {} } }).frame(null);
  assert.equal(starts.length, 1);
  const handed = starts[0].inputs.held.map((p) => `${p.x},${p.y}`);
  assert.deepEqual(handed, ['7,-7', ...[500, 501, 502, 503, 504, 505, 506].map((y) => `300,${y}`)], 'the Arena places\' pixels, then the run past the Bay');
});

test('AUDIT TESA II R2 the host walks a capital\'s gates out over its own ground - the composed height it builds on, where the capitals\' default reads the authored one - and hands every gate it finds, none on a capital\'s pixel (mutant: the default walk, the host\'s height unread)', async () => {
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1), province = new Uint8Array(w * h).fill(4);   // Morrowind: Mournhold stands
  for (let x = 0; x < w; x++) { land[x] = 0; land[(h - 1) * w + x] = 0; province[x] = 0; province[(h - 1) * w + x] = 0; }
  setTamrielTrace({ w, h, land, province });
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const { CAPITALS, capitalGates, capitalSpanPixels, capitalOnPixel } = await import('../../src/world/tamrielCapitals.js');
  const k = CAPITALS.findIndex((c) => c.key === 'mournhold');
  assert.ok(capitalSpanPixels(k).length && capitalGates(k).length === 4, 'Mournhold stands, its four gates on the authored ground');
  const handed = (heightAt) => {
    const starts = [];
    const client = { start: (o) => { starts.push(o); return Promise.resolve(); }, near() {}, pending: () => 0, dispose() {} };
    const standing = { pixels: () => ({ stood: [] }), towns: () => [], spec: () => EMPTY_SPEC, capitals: () => true, held: () => [] };
    createTamrielRoadsHost({ terrainGen: { addArenaRoads() {}, roads: () => null, hasRoads: false }, woodsBytes: new Uint8Array(3), heightAt, joinLand: () => false, onLanded() {}, standing, client, log: { log() {}, warn() {} } }).frame(null);
    return starts[0].inputs;
  };
  const span = capitalSpanPixels(k), c = capitalOnPixel(span[0].x, span[0].y).centre;
  const dry = handed(() => 30);
  assert.deepEqual(dry.gates.map((g) => g.side).sort(), ['E', 'N', 'S', 'W'], 'its own ground land: every gate');
  for (const g of dry.gates) assert.equal(capitalOnPixel(g.x, g.y), null);
  assert.deepEqual(handed(() => 2).gates, [], 'its own ground water: none, whatever the authored height says');
  // the host's ground water west of the city: the west gate walked out past it, the others where they stood
  const wet = handed((x) => (x <= c.px - 1 && x >= c.px - 2 ? 2 : 30));
  const west = wet.gates.find((g) => g.side === 'W'), was = dry.gates.find((g) => g.side === 'W');
  assert.deepEqual([was.x, west?.x, west?.y], [c.px - 1, c.px - 3, c.py], 'walked out past the host\'s water, two pixels');
  assert.deepEqual(wet.gates.filter((g) => g.side !== 'W'), dry.gates.filter((g) => g.side !== 'W'));
  // a gate pixel of land whose one land neighbour is the city itself is sealed (Solitude's, R2): walked past
  const sealed = handed((x, y) => ((x === c.px - 2 && y === c.py) || (x === c.px - 1 && Math.abs(y - c.py) === 1) ? 2 : 30));
  assert.deepEqual(sealed.gates.filter((g) => g.side === 'W').map((g) => [g.x, g.y]), [[c.px - 3, c.py]], 'the city is no way out of its gate');
  assert.deepEqual(wet.nodes.filter((n) => n.type === T.TownCity).map((n) => `${n.x},${n.y}`), wet.gates.map((g) => `${g.x},${g.y}`), 'each a road node');
});

// ── R6: THE PRINT, AND THE LAWS' OWN VERSION ────────────────────

test('AUDIT TESA II R6 the print reads every byte of the height map and every relief cell - one moved anywhere moves it - and a region\'s key carries the laws\' version (mutant: a stride back, the relief unread, the version out of the key)', () => {
  const woods = syntheticWoods(1000, 500, 20), w = new WoodsFile();
  assert.ok(w.load(woods));
  const trace = { ...morrowindTrace(), relief: morrowindTrace().relief.slice() };
  const base = { woodsBytes: woods, fit: { ox: 1, oy: 2, ppu: 15.5 }, trace, spec: EMPTY_SPEC, nodes: [], obstacles: [], gates: [], held: [] };
  const p = inputsPrint(base);
  for (const i of [1, 2, 3, 4, 5, 6, 499_999]) {
    const moved = woods.slice();
    moved[w.header.heightMapOffset + i] = 21;
    assert.notEqual(inputsPrint({ ...base, woodsBytes: moved }), p, `height byte ${i}`);
  }
  for (const i of [123_457, 123_458, 200_001]) {
    const relief = trace.relief.slice();
    relief[i] = relief[i] ^ 1;
    assert.notEqual(inputsPrint({ ...base, trace: { ...trace, relief } }), p, `relief cell ${i}`);
  }
  assert.notEqual(inputsPrint({ ...base, held: [{ x: 1, y: 1 }] }), p, 'the held pixels');
  assert.match(regionKey({ region: { i: 1, j: 2 }, inputs: p }), new RegExp(`^tamriel-roads:1,2:(land[0-9a-z]+:)?v\\d+:g\\d+:l${GROUND_ROLL_VERSION}:`));
});

/** The ground's and the rolls' laws' own answers, a fingerprint: the height law on a trace with its relief and without
 *  (world/tamriel/tamrielGround.js tamrielHeightByte), the seam's blend off the Bay's edge (groundWoods), the dry plateau
 *  (tamrielCountry.js createCountryGround) and the countryside's and the lairs' roll (tamrielRoads.js rollTypeAt over the
 *  hosts' laws). */
function lawsFingerprint() {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = Math.imul(h ^ (v >>> 0), 16777619) >>> 0; };
  const fit = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };
  const w = new WoodsFile();
  w.load(syntheticWoods(1000, 500, 30));
  for (const relief of [true, false]) {
    setTamrielTrace(morrowindTrace({ relief }));
    setTamrielFit(fit);
    dropGroundCache();
    for (let y = -420; y < 700; y += 3) for (let x = 2480; x < 3540; x += 3) mix(tamrielHeightByte(x, y));
    const g = groundWoods(w), dry = createCountryGround(g);
    for (let y = 0; y < 500; y += 7) for (const x of [-20, -9, -3, -1, 1000, 1002, 1008, 1019]) mix(g.getHeightMapValue(x, y));
    for (let k = 0; k < 120; k++) mix(dry(2520 + (k % 12) * 85, -400 + Math.floor(k / 12) * 105) ? 1 : 0);   // the land's every height, its coasts and its peaks
    // AUDIT RED-MOUNTAIN G3: the Ghostfence's line and its gate - what the roads keep off and the rolls refuse
    const fence = ghostfenceFrame();
    mix(fence ? fence.band.size : 0);
    for (const set of fence ? [fence.band, fence.open] : []) for (const k of [...set].sort()) for (const v of k.split(',')) mix(Number(v));
  }
  const countryTemplates = new Map(COUNTRY_TYPES.map((t, k) => [t, t === T.HomeFarms ? [] : Array.from({ length: 1 + (k % 3) }, (_, i) => row(100 * t + i, t))]));
  const full = [blk('N1.RDB', true), blk('N2.RDB'), blk('B1.RDB')];
  const lairTemplates = new Map(LAIR_TYPES.map((t, k) => [t, [dun(1000 + t, t, k, full), dun(2000 + t, t, 9, [blk('N3.RDB', true), blk('B2.RDB')])]]));
  const countryRates = new Map([[230, [[T.HomeFarms, 0.02], [T.TownVillage, 0.04], [T.Tavern, 0.05]]], [226, [[T.TownHamlet, 0.06]]]]);
  const lairRates = new Map([[230, [[LAIR_TYPES[0], 0.004], [LAIR_TYPES[1], 0.008]]], [226, [[LAIR_TYPES[2], 0.01], [LAIR_TYPES[3], 0.0156]]]]);
  const spec = rollSpec({ countryRates, countryTemplates, lairRates, lairTemplates, lairPools: lairPools(lairTemplates) });
  const typeAt = rollTypeAt(spec, { climateAt: (x, y) => ((x >> 5) + (y >> 5)) % 2 ? 230 : 226, heightAt: (x, y) => [40, 5, 40, 6, 4][(x * 7 + y * 3) % 5], ground: (x, y) => (x ^ y) % 13 !== 0 });   // the beach line's byte among them
  for (let y = -400; y < -200; y++) for (let x = 1000; x < 1300; x++) mix(typeAt(x, y) ?? 255);
  return h.toString(36);
}
/** The fingerprint each GROUND_ROLL_VERSION was recorded under. A law above moving what a pixel stands or how high it is
 *  fails the pin: move GROUND_ROLL_VERSION (world/tamrielRoads.js) - every client's cached roads are then laid again -
 *  and record the new fingerprint here under it. */
const LAWS_FINGERPRINT = Object.freeze({ 1: '5e12d5', 2: '14pewtj', 3: '14pewtj', 4: 'ad9cue', 5: 'ad9cue', 6: '1s1uba5' });   // 1: the laws as AUDIT TESA II found them (bf98d29f8d); 2: its lane G's beach-line floor; 3: CYRODIIL-SHORES - the fixture has no Cyrodiil lake, so its print stands, but the freeware's Cyrodiil does: every cached region laid again; 4: SMOOTH-LAND - every coast and border past the Bay the land's smooth law's; 5: RUMARE-WATER - the land let down about the Imperial City at the sea (world/rumareWaters.js rumareBasin, its mouth's pixels the sea's): the fixture has no canal, so its print stands, but the freeware's city does; 6: GHOSTFENCE - its line and gate in the print (AUDIT RED-MOUNTAIN G3: the print was blind to them; 1-5 were recorded before the fence's sets were mixed in)

test('AUDIT TESA II R6 the laws past the Bay a region\'s build runs and no input carries - the ground\'s height, the seam, the plateau, the rolls - answer as they did when GROUND_ROLL_VERSION was recorded: a law moved and the version not, this fails (mutant: the shore\'s floor, the relief\'s ease, the roll\'s water law, the plateau)', () => {
  const now = lawsFingerprint();
  assert.equal(now, LAWS_FINGERPRINT[GROUND_ROLL_VERSION], `the laws past the Bay answer otherwise than under GROUND_ROLL_VERSION ${GROUND_ROLL_VERSION}: move it and record '${now}' under the new number`);
});

// ── R3, R4, R8: THE CLIENT ──────────────────────────────────────

/** Tasks the client asks for, run by hand; a clock the test moves. */
function hand() {
  const tasks = [];
  let t = 0;
  return { defer: (fn) => { tasks.push(fn); }, now: () => t, tick: (ms) => { t += ms; }, run: () => { const fn = tasks.shift(); fn?.(); return !!fn; }, tasks };
}
const lat3 = regionLattice({ x0: 0, y0: -1000, w: 4000, h: 300 });
const regions3 = Array.from({ length: 5 }, (_, i) => regionOf(lat3, i, 0));
function memStore(seed = new Map()) {
  return { data: seed, evicted: [], get: (k) => seed.get(k) ?? null, set: (k, v, o) => { (o?.evict ?? []).forEach((r) => seed.forEach((_, key) => { if (key >= r[0] && key <= r[1]) seed.delete(key); })); seed.set(k, v); return k; } };
}
const someLayer = (x) => ({ layer: packArenaRoads({ roads: new Map([[beyondKey(x, -900), DIR.E]]), tracks: new Map(), join: new Map() }), places: packPastBayPlaces([]) });

test('AUDIT TESA II R3 the cache\'s hits land a budget a task, never all in one: the first task lands until its budget is spent - one at the least - the rest in tasks of their own; a new start drops the last one\'s still to land (mutant: one task for all, the budget unread, a stale hit landing)', async () => {
  const store = memStore(), h = hand();
  for (const r of regions3) store.set(regionKey({ region: r, inputs: 'p' }), someLayer(r.core.x0));
  const landed = [];
  const client = createTamrielRoadsClient({ makeWorker: () => { throw new Error('none'); }, workers: 1, store, defer: h.defer, now: h.now, budgetMs: 8, log: { warn() {} } });
  await client.start({ inputs: {}, print: 'p', regions: regions3, onRegion: (r, layer, stats) => { landed.push([r.i, layer.roads.size, stats.cached]); h.tick(3); } });
  assert.deepEqual(landed, [], 'nothing lands in the task the cache answered in');
  assert.equal(client.pending(), 5);
  h.run();
  assert.deepEqual(landed.map(([i]) => i), [0, 1, 2], 'three cost 9 ms: the budget spent');
  assert.ok(landed.every(([, n, c]) => n === 1 && c));
  h.run();
  assert.deepEqual(landed.map(([i]) => i), [0, 1, 2, 3, 4]);
  assert.equal(h.run(), false, 'nothing more asked');
  assert.equal(client.pending(), 0);
  // one costlier than the budget still lands, one a task
  const slow = [];
  await client.start({ inputs: {}, print: 'p', regions: regions3.slice(0, 2), onRegion: (r) => { slow.push(r.i); h.tick(50); } });
  h.run();
  assert.deepEqual(slow, [0]);
  // superseded with hits still to land: none of them lands
  const late = [];
  await client.start({ inputs: {}, print: 'p', regions: regions3, onRegion: (r) => late.push(r.i) });
  await client.start({ inputs: {}, print: 'q', regions: [], onRegion: () => {} });
  while (h.run());
  assert.deepEqual(late, [], 'superseded');
  assert.deepEqual(slow, [0], 'nor the one before');
});

/** Workers through the worker's own state, each answering on the next microtask - and what each was asked. */
function fakeWorkers() {
  const made = [];
  const make = () => {
    const state = createRoadsWorkerState(), asked = [];
    const w = { asked, dead: false, onmessage: null, onerror: null, terminate() { w.dead = true; },
      postMessage(m) { asked.push(m.t); queueMicrotask(() => { if (!w.dead) state.handle(m, (out) => w.onmessage?.({ data: out })); }); } };
    made.push(w);
    return w;
  };
  return { make, made };
}
const flatInputs = (nodes, lattice) => ({ woodsBytes: syntheticWoods(1000, 500), trace: landTrace(), fit: null, spec: EMPTY_SPEC, nodes, obstacles: [], gates: [], lattice });

test('AUDIT TESA II R4 the workers go once nothing is left to build - every one terminated - and the next start makes them again; a build all from the cache makes none (mutant: the pool kept, the pool never made again)', async () => {
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 1600, h: 300 });
  const nodes = [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -880, type: T.TownCity }, { x: 1100, y: -900, type: T.TownCity }, { x: 1160, y: -880, type: T.TownCity }];
  const inputs = flatInputs(nodes, lattice), regions = [regionOf(lattice, 0, 0), regionOf(lattice, 1, 0)];
  const w = fakeWorkers(), landed = [];
  const client = createTamrielRoadsClient({ makeWorker: w.make, workers: 2, store: null, log: { warn() {} } });
  await client.start({ inputs, print: inputsPrint(inputs), regions, onRegion: (r) => landed.push(r.i) });
  assert.equal(w.made.length, 2);
  await settle();
  assert.deepEqual(landed.sort(), [0, 1]);
  assert.equal(client.workers(), 0, 'nothing left to build: none kept');
  assert.ok(w.made.every((wk) => wk.dead), 'each terminated');
  await client.start({ inputs, print: `${inputsPrint(inputs)}x`, regions: [regions[0]], onRegion: (r) => landed.push(r.i) });
  assert.equal(w.made.length, 4, 'made again for the next build');
  await settle();
  assert.deepEqual(landed.sort(), [0, 0, 1]);
  assert.equal(client.workers(), 0);
  // all from the cache: no worker made at all
  const store = memStore(), h = hand();
  store.set(regionKey({ region: regions[0], inputs: 'c' }), someLayer(5));
  const none = fakeWorkers(), cached = createTamrielRoadsClient({ makeWorker: none.make, workers: 2, store, defer: h.defer, now: h.now });
  await cached.start({ inputs, print: 'c', regions: [regions[0]], onRegion: () => {} });
  while (h.run());
  assert.equal(none.made.length, 0, 'a build all from the cache wants no worker');
});

test('AUDIT TESA II R8 a worker\'s death: the region it held given back only to its own build, the dead worker terminated and another made in its place (mutant: a superseded region given back, the dead kept, no replacement)', async () => {
  const made = [];
  const make = () => { const wk = { onmessage: null, onerror: null, asked: [], dead: false, terminate() { wk.dead = true; }, postMessage(m) { wk.asked.push(m); } }; made.push(wk); return wk; };
  const warned = [];
  const client = createTamrielRoadsClient({ makeWorker: make, workers: 2, store: null, log: { warn: (...a) => warned.push(a.join(' ')) } });
  const reg = (i) => ({ i, j: 0, core: { x0: i * 800, y0: 0, x1: i * 800 + 800, y1: 300 } });
  const layer = () => packArenaRoads({ roads: new Map(), tracks: new Map(), join: new Map() });
  const reply = (wk) => { const b = wk.asked.filter((m) => m.t === 'build').at(-1); wk.onmessage({ data: { t: 'region', id: b.id, i: b.i, j: b.j, layer: layer(), places: packPastBayPlaces([]), stats: {}, ms: 1 } }); return b.i; };
  const landed = [];
  await client.start({ inputs: {}, print: 'old', regions: [reg(0), reg(1)], onRegion: (r) => landed.push(`old ${r.i}`) });
  await client.start({ inputs: {}, print: 'new', regions: [reg(5)], onRegion: (r) => landed.push(`new ${r.i}`) });
  made[0].onerror({ message: 'out of memory' });
  assert.ok(made[0].dead, 'the dead worker terminated');
  assert.equal(made.length, 3, 'another made in its place');
  assert.ok(warned.some((s) => /died/.test(s)));
  const asked = [];
  for (let k = 0; k < 4; k++) { for (const wk of made.slice(1)) if (!wk.dead && wk.asked.some((m) => m.t === 'build') && wk.onmessage) { const b = wk.asked.filter((m) => m.t === 'build').at(-1); if (!asked.includes(b.id)) { asked.push(b.id); reply(wk); } } }
  assert.deepEqual(landed, ['new 5'], 'region 0 was the old build\'s: it lands nowhere');
  assert.equal(client.pending(), 0);
});

test('AUDIT TESA II R8 with no worker that can run - none can start, or WORKER_DEATHS of them died - the page\'s own thread builds each region a budget a task, lands it as a worker\'s would, and says so once; a superseded one drops (mutant: no fallback, the budget unread, the run unchecked)', async () => {
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 1600, h: 300 });
  const nodes = [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -880, type: T.TownCity }, { x: 1100, y: -900, type: T.TownCity }, { x: 1160, y: -880, type: T.TownCity }];
  const inputs = flatInputs(nodes, lattice), regions = [regionOf(lattice, 0, 0), regionOf(lattice, 1, 0)];
  setTamrielTrace(inputs.trace);   // what the host has installed: the page's build reads it, and installs nothing
  setTamrielFit(null);
  for (const how of ['unmakeable', 'dying']) {
    let deaths = 0;
    const makeWorker = how === 'unmakeable' ? () => { throw new Error('no workers here'); }
      : () => { const wk = { onmessage: null, onerror: null, terminate() {}, postMessage(m) { if (m.t === 'init') queueMicrotask(() => { deaths++; wk.onerror({ message: 'gone' }); }); } }; return wk; };
    const warned = [], tasks = [];
    const client = createTamrielRoadsClient({ makeWorker, workers: 2, store: null, defer: (fn) => tasks.push(fn), log: { warn: (...a) => warned.push(a.join(' ')) } });
    const landed = [];
    await client.start({ inputs, print: inputsPrint(inputs), regions, onRegion: (r, layer) => landed.push([r.i, layer]) });
    await settle();
    if (how === 'dying') assert.ok(deaths >= WORKER_DEATHS && deaths < WORKER_DEATHS + 2, `workers made again until WORKER_DEATHS died - the one in flight then too (${deaths})`);
    let n = 0;
    while (tasks.length && n < 100_000) { tasks.shift()(); n++; }
    assert.ok(n > 10, `in many tasks (${n})`);
    assert.deepEqual(landed.map(([i]) => i), [0, 1], `${how}: both built here`);
    assert.ok(walks(landed[0][1].roads, [300, -900], [360, -880]), 'the same law\'s roads');
    assert.equal(warned.filter((s) => /page's own thread/.test(s)).length, 1, 'said once');
    assert.equal(client.pending(), 0);
    // superseded mid-build: the old region drops, the new one builds
    const again = [];
    await client.start({ inputs, print: 'a', regions: [regions[0]], onRegion: (r) => again.push(`a${r.i}`) });
    tasks.shift()?.();
    await client.start({ inputs, print: 'b', regions: [regions[1]], onRegion: (r) => again.push(`b${r.i}`) });
    n = 0;
    while (tasks.length && n < 100_000) { tasks.shift()(); n++; }
    assert.deepEqual(again, ['b1'], `${how}: the superseded one dropped`);
  }
});

// ── R10: ONE PRINT A REGION ─────────────────────────────────────

test('AUDIT TESA II R10 the cache keeps one print a region: a fresh region\'s keep lets go of its entries under every other print and of TESA14\'s and TESA15\'s keys, another region\'s kept; a keep that fails is said once (mutant: no eviction, the region\'s range, the warning)', async () => {
  const keyRange = { bound: (lower, upper) => ({ lower, upper }) };
  const idb = memoryIdb();
  // the in-memory IndexedDB's delete takes a key range as IDBKeyRange's does
  const store = idbStore(idb, { keyRange });
  const r = { i: 2, j: 3 };
  const old = regionKey({ region: r, inputs: 'old' }), other = regionKey({ region: { i: 2, j: 33 }, inputs: 'old' }), legacy = 'tamriel-roads:v2:g20:2,3:abc';
  for (const k of [old, other, legacy]) assert.equal(await store.set(k, { k }), k, 'kept, its key answered');
  const now = regionKey({ region: r, inputs: 'new' });
  assert.equal(await store.set(now, { k: now }, { evict: [[regionPrefix(r), `${regionPrefix(r)}\uffff`], LEGACY_REGION_KEYS] }), now);
  assert.equal(await store.get(old), null, 'the region under another print let go');
  assert.equal(await store.get(legacy), null, 'TESA15\'s key let go');
  assert.deepEqual(await store.get(other), { k: other }, 'another region kept');
  assert.deepEqual(await store.get(now), { k: now });
  // the client asks it so, and says once that a keep failed
  const lattice = regionLattice({ x0: 0, y0: -1000, w: 1600, h: 300 });
  const nodes = [{ x: 300, y: -900, type: T.TownCity }, { x: 360, y: -880, type: T.TownCity }, { x: 1100, y: -900, type: T.TownCity }, { x: 1160, y: -880, type: T.TownCity }];
  const inputs = flatInputs(nodes, lattice), regions = [regionOf(lattice, 0, 0), regionOf(lattice, 1, 0)];
  const sets = [], warned = [];
  const failing = { get: () => null, set: (k, v, o) => { sets.push([k, o]); return null; } };
  const client = createTamrielRoadsClient({ makeWorker: fakeWorkers().make, workers: 2, store: failing, log: { warn: (...a) => warned.push(a.join(' ')) } });
  await client.start({ inputs, print: 'p', regions, onRegion: () => {} });
  await settle();
  assert.equal(sets.length, 2);
  for (const [k, o] of sets) {
    const prefix = k.slice(0, k.indexOf(':v'));
    assert.deepEqual(o.evict, [[`${prefix}:`, `${prefix}:\uffff`], LEGACY_REGION_KEYS], 'its own region\'s range, and the old keys');
  }
  assert.equal(warned.filter((s) => /could not keep/.test(s)).length, 1, 'said once');
});

// ── R2: EVERY CAPITAL'S ROAD, WITH ARENA2 ───────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('AUDIT TESA II R2 with ARENA2: every capital has a road - of its gates on land past the Bay that the host hands the build, at least one a road reaches, stepped into the city - built as its region builds it, with the places, Arena\'s towns and the capitals about it (mutant: the gates unhanded)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { tamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { tamrielFrameInBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WATER_BYTE } = await import('../../src/world/roadsProducer.js');
  const { isWaterPixel } = await import('../../src/ui/overworldModel.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { countryTemplates, countryCounts, bayLand, countryRates } = await import('../../src/world/tamrielCountry.js');
  const { lairTemplates } = await import('../../src/world/tamrielDungeons.js');
  const { CAPITALS, capitalSpanPixels, capitalOnPixel } = await import('../../src/world/tamrielCapitals.js');
  const { arenaPixels } = await import('../../src/world/arenaPlaces.js');
  const { arenaRoadTowns, arenaTemplates, arenaTemplateOf } = await import('../../src/world/arenaLocations.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));   // the relief on it, as the game's
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const g = groundWoods(woods), heightAt = (x, y) => g.getHeightMapValue(x, y);
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const climate = (x, y) => maps.getClimateIndex(x, y);
  const land = bayLand(climate, (x, y, c) => isWaterPixel(c, woods.getHeightMapValue(x, y)));
  const cT = countryTemplates(rows, isMainStoryDungeon), lT = lairTemplates(rows, isMainStoryDungeon);
  const spec = rollSpec({ countryRates: countryRates(countryCounts(cT, climate), land), countryTemplates: cT, lairRates: countryRates(countryCounts(lT, climate), land, LAIR_TYPES), lairTemplates: lT, lairPools: lairPools(lT) });
  // what stands, as scenes/tamrielPlacesHost.js reads it (tamrielRoadTowns, tamrielRoadHeld) - and the build's inputs the
  // roads' host itself makes of it (scenes/tamrielRoadsHost.js start: the capitals' pixels and the gates it walks)
  const tpl = arenaTemplates(rows, isMainStoryDungeon), stood = arenaPixels().stood.filter((p) => arenaTemplateOf(tpl, p));
  const towns = arenaRoadTowns({ stood: stood.filter((p) => !p.pinned) }) ?? [];
  const starts = [];
  const client = { start: (o) => { starts.push(o); return Promise.resolve(); }, near() {}, pending: () => 0, dispose() {} };
  const standing = { pixels: arenaPixels, towns: () => towns, spec: () => spec, capitals: () => true, held: () => stood.map((p) => ({ x: p.bx, y: p.by })) };
  createTamrielRoadsHost({ terrainGen: { addArenaRoads() {}, roads: () => null, hasRoads: false }, woodsBytes: bytes('WOODS.WLD'), heightAt, joinLand: () => false, onLanded() {}, standing, client, log: { log() {}, warn() {} } }).frame(null);
  const { inputs } = starts[0];
  const lattice = inputs.lattice;
  const state = createRoadsWorkerState();
  state.handle({ t: 'init', ...inputs }, () => {});
  /** The capital a gate opens into: the first capital pixel along its step in. */
  const ofGate = (q) => { for (let t = 1; t <= 12; t++) { const at = capitalOnPixel(q.x + q.into[0] * t, q.y + q.into[1] * t); if (at) return at.k; } return -1; };
  const into = (q) => Number(Object.keys(STEP).find((b) => STEP[b][0] === q.into[0] && STEP[b][1] === q.into[1]));
  const answer = [];
  CAPITALS.forEach((cap, k) => {
    const span = capitalSpanPixels(k), c = span.length ? capitalOnPixel(span[0].x, span[0].y)?.centre : null;   // its own pixel
    assert.ok(c && capitalOnPixel(c.px, c.py)?.k === k, `${cap.name} stands`);
    const gates = inputs.gates.filter((q) => ofGate(q) === k);
    const region = regionOf(lattice, Math.floor((c.px - lattice.x0) / 800), Math.floor((c.py - lattice.y0) / 300));
    // its region's own build about the capital: every place, town and gate within a road's reach of it and more
    const near = (p) => Math.abs(p.x - c.px) <= 150 && Math.abs(p.y - c.py) <= 150;
    const places = state.placesIn(c.px - 150, c.py - 150, c.px + 151, c.py + 151);
    const out = buildTamrielRegion({ region, places, nodes: inputs.nodes.filter(near), obstacles: inputs.obstacles, gates: inputs.gates, held: inputs.held.filter(near), heightAt });
    const reached = gates.filter((q) => (out.roads.get(beyondKey(q.x, q.y)) ?? 0) & into(q));
    answer.push([cap.name, gates.length, reached.length]);
  });
  assert.equal(answer.length, CAPITALS.length);
  assert.deepEqual(answer.filter(([, , n]) => !n).map(([name]) => name), [], `a capital no road reaches (${JSON.stringify(answer)})`);
});
