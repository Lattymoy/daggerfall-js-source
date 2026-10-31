// AUDIT SEA PATHS (2026-10-31, the owner: "Can we audit both player and AI ship pathfinding in the eltheric sea and the
// open waters of tamriel and ensure its perfect") - bible/01-Overview/audits/Audit-Sea-Paths.md. Each pin fails under its
// finding's own mutation (tools/mutants/auditseapaths.json).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createWaterGrid, errandFor, stepErrand, gridClearOf, reachOf, WATER_CELL, WATER_CLEAR, REACH_M, VOYAGE_DIST, OUTBOUND_MIN,
  PROGRESS_S, GRID_MARGIN, CLEAR_STEP,
} from '../../../src/systems/naval/shipLife.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';
import { SWEEP_WAY } from '../../../src/systems/naval/navalAI.js';
import { holdsLine, laneNetwork, laneWay } from '../../../src/systems/naval/seaLanes.js';
import { bayLaneWater, bayLanePorts } from '../../../src/scenes/naval/worldLanes.js';
import { undilatedClimateIndex } from '../../../src/world/terrain/terrainHelper.js';
import { NATIVE_PIXEL, pixelOfNative } from '../../../src/systems/seaRaiders.js';
import { TravelAutopilot } from '../../../src/systems/travel/travelAutopilot.js';
import { mapPixelWorldOrigin, MP_WORLD_UNITS } from '../../../src/systems/travel/travelPaths.js';
import { planRoute } from '../../../src/systems/travel/travelRoute.js';
import { tvMooredDry } from '../../../src/systems/travel/seaAsk.js';
import { seaNoWay, SEA_WAY, createSeaHelm } from '../../../src/systems/seaHelm.js';
import { inEther, ETHER_BOX } from '../../../src/world/ethericSea.js';
import { inBay } from '../../../src/world/tamriel/tamrielFrame.js';

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const grids = (isWater) => { const m = new Map(); return (h) => m.get(h) ?? (m.set(h, createWaterGrid({ isWater, hull: h })), m.get(h)); };
const shipAt = (x, z, o = {}) => ({ pos: [x, 0, z], speed: 3, yaw: 0, hull: 2, seed: 7, clock: 0, cls: { faction: 'merchant' }, ...o });

test('AUDIT SEA PATHS AI-1: a voyage out of the world is drawn where the water carries her straight - its mark water, the leg to it clear by the grid\'s own law, no farther than VOYAGE_DIST; water for under OUTBOUND_MIN on every bearing is no voyage (mutants: the mark 2.6 km out whatever lies there; the run let past the land; the floor dropped)', () => {
  // a strait 1.7 km wide: every bearing but east and west meets a shore inside 2.6 km
  const strait = (x, z) => z < 200 && z > -1500;
  const gridOf = grids(strait);
  let voyages = 0, full = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const e = errandFor({ seed, faction: 'merchant', hull: 2, pos: [0, 0, 0], harbours: [], grid: gridOf(2) });
    assert.ok(e, `seed ${seed}: a strait open east and west is always a voyage`);
    assert.equal(e.kind, 'voyage');
    assert.ok(strait(e.to[0], e.to[1]), `seed ${seed}: her mark on water`);
    assert.ok(gridOf(2).clear([0, 0], e.to), `seed ${seed}: the straight leg to it clear`);
    assert.ok(d2([0, 0], e.to) <= VOYAGE_DIST + 1e-6);
    voyages++;
    if (d2([0, 0], e.to) > VOYAGE_DIST - 1) full++;
  }
  assert.ok(full > 0 && full < voyages, `a draw along the strait sails the whole of it, one across it stops short (${full} of ${voyages})`);
  // a pond 400 m across: nowhere OUTBOUND_MIN of water carries her - no voyage, her own cruise
  const pond = (x, z) => Math.hypot(x, z) < 200;
  assert.equal(errandFor({ seed: 3, faction: 'merchant', hull: 2, pos: [0, 0, 0], harbours: [], grid: grids(pond)(2) }), null);
  assert.equal(OUTBOUND_MIN, 300);
});

test('AUDIT SEA PATHS AI-2: under way and getting nowhere is a stall - a point passed abreast is made when the water carries her on to the next; a mark she cannot fetch for PROGRESS_S takes her detour; a detour is PROGRESS_S at most; a galley reaches a point within half her length (mutants: the pass rule gone; the progress clock gone; the detour chased for good; the reach held to 35 m)', () => {
  const open = () => true;
  const gridOf = grids(open);
  const hb = { mouth: [0, -2000], berths: [], hull: 4 };
  const ctx = { harbour: (k) => (k === 'g' ? hb : null), grid: gridOf, free: () => true, harbours: () => [] };
  // passed abreast: 50 m off point 1 (outside REACH_M), beyond it along the leg into it - on to point 2
  const a = shipAt(50, -130, { errand: { kind: 'voyage', harbour: 'g', to: null, path: [[0, 0], [0, -100], [600, -400], [0, -2000]], i: 1 } });
  stepErrand(a, 0.1, ctx);
  assert.equal(a.errand.i, 2, 'passed abreast, the next straight ahead: made');
  const b = shipAt(50, -60, { errand: { kind: 'voyage', harbour: 'g', to: null, path: [[0, 0], [0, -100], [600, -400], [0, -2000]], i: 1 } });
  stepErrand(b, 0.1, ctx);
  assert.equal(b.errand.i, 1, 'short of it along the leg into it: not made');
  // beyond it along the leg out of it but short along the leg in (a berth's approach, come at from the shore's side): not made
  const c0 = shipAt(-200, -50, { errand: { kind: 'voyage', harbour: 'g', to: null, path: [[-300, 0], [100, 0], [-100, -300], [0, -2000]], i: 1 } });
  stepErrand(c0, 0.1, ctx);
  assert.equal(c0.errand.i, 1, 'short of it along the leg into it, whatever the leg out says: not made');
  // circling a mark she cannot fetch, under way (never a speed's stall): her detour at PROGRESS_S
  const c = shipAt(400, -1500, { errand: { kind: 'voyage', harbour: 'g', to: null, path: [[0, 0], [0, -2000]], i: 1 } });
  let t = 0;
  for (; t < PROGRESS_S + 2 && !c.errand.detour; t += 1) stepErrand(c, 1, ctx);
  assert.ok(c.errand.detour, `getting nowhere under way: a detour (${t} s)`);
  assert.ok(t >= PROGRESS_S - 1, 'not before PROGRESS_S');
  // the detour itself unfetched: let go after PROGRESS_S, her way planned anew
  for (let k = 0; k < PROGRESS_S + 2 && c.errand.detour; k++) stepErrand(c, 1, ctx);
  assert.equal(c.errand.detour, null, 'a detour she cannot fetch is let go');
  // the reach: half her length for the galley, REACH_M for the rest
  const g = hullBuild(3);
  assert.equal(reachOf(3), (g.bowZ - g.aftZ) / 2);
  assert.ok(reachOf(3) > REACH_M + 10);
  assert.equal(reachOf(2), REACH_M);
  const gal = shipAt(0, -1955, { hull: 3, errand: { kind: 'voyage', harbour: 'g', to: null, path: [[0, 0], [0, -2000]], i: 1 } });
  stepErrand(gal, 0.1, ctx);
  assert.notEqual(gal.errand?.harbour, 'g', 'a galley 45 m off the mouth has made it');
});

test('AUDIT SEA PATHS AI-2: a way\'s first point is where she stood - making it is no way made, so her detours still count to DETOUR_GIVEUP (mutants: every point made clears them)', () => {
  const gridOf = grids(() => true);
  const hb = { mouth: [0, -2000], berths: [], hull: 4 };
  const ctx = { harbour: () => hb, grid: gridOf, free: () => true, harbours: () => [] };
  const s = shipAt(0, 0, { errand: { kind: 'voyage', harbour: 'g', to: null, path: [[0, 0], [0, -2000]], i: 0, detours: 2 } });
  stepErrand(s, 0.1, ctx);
  assert.equal(s.errand.i, 1);
  assert.equal(s.errand.detours, 2, 'her own place made: the count kept');
  const m = shipAt(0, -990, { errand: { kind: 'voyage', harbour: 'g', to: null, path: [[0, 0], [0, -1000], [0, -2000]], i: 1, detours: 2 } });
  stepErrand(m, 0.1, ctx);
  assert.equal(m.errand.detours, 0, 'a point of her way made: counted afresh');
});

test('AUDIT SEA PATHS AI-3: a departing ship makes for the nearest harbour THE GRID FINDS A WAY TO, its way kept - a nearer one walled off is passed; none, and she sails out (mutants: the nearest by distance alone)', () => {
  // harbour B 900 m off, inside a ring of land; C 3 km off on the open sea
  const B = [0, -900], C = [0, 3000];
  const isWater = (x, z) => { const r = Math.hypot(x - B[0], z - B[1]); return !(r > 150 && r < 230); };
  const gridOf = grids(isWater);
  const book = { a: { mouth: [0, 0], berths: [], hull: 4 }, b: { mouth: B, berths: [], hull: 4 }, c: { mouth: C, berths: [], hull: 4 } };
  const ctx = { harbour: (k) => book[k] ?? null, grid: gridOf, free: () => true, harbours: () => Object.entries(book).map(([key, harbour]) => ({ key, harbour })) };
  const s = shipAt(0, 0, { errand: { kind: 'depart', harbour: 'a', berth: -1, path: null, i: 0 } });
  stepErrand(s, 0.1, ctx);
  assert.equal(s.errand.kind, 'voyage');
  assert.equal(s.errand.harbour, 'c', 'the harbour the water reaches, not the nearer one walled off');
  assert.ok(Array.isArray(s.errand.path) && s.errand.path.length >= 2, 'her way kept from the choosing');
  const walled = { a: book.a, b: book.b };
  const lone = shipAt(0, 0, { errand: { kind: 'depart', harbour: 'a', berth: -1, path: null, i: 0 } });
  stepErrand(lone, 0.1, { ...ctx, harbours: () => Object.entries(walled).map(([key, harbour]) => ({ key, harbour })) });
  assert.equal(lone.errand?.harbour ?? null, null, 'no harbour reached: out of the world');
});

test('AUDIT SEA PATHS AI-4: a sounding of ground not yet built (null) is never kept - the same grid finds the way once the ground is in (mutants: every cell kept)', () => {
  let built = false;
  const isWater = (x, z) => { if (!built && x > 100) return null; return !(x > 200 && x < 260 && z > -400); };
  const g = createWaterGrid({ isWater, hull: 2 });
  assert.equal(g.path([0, 0], [400, 0]), null, 'unbuilt: no way yet');
  built = true;
  const p = g.path([0, 0], [400, 0]);
  assert.ok(p, 'built: the same grid finds it');
  assert.ok(p.some((q) => q[1] < -400), 'round the wall\'s end');
});

test('AUDIT SEA PATHS AI-5: a hull\'s grid asks her half beam and the lookout\'s margin round a cell, at least WATER_CLEAR of a cell - the galley\'s wider than the rest (mutants: one clearance for every hull)', () => {
  assert.equal(GRID_MARGIN, 4);
  for (const h of [0, 1, 2, 4]) assert.equal(gridClearOf(h), WATER_CELL * WATER_CLEAR, `hull ${h}`);
  assert.equal(gridClearOf(3), hullBuild(3).halfWidth + GRID_MARGIN);
  assert.ok(gridClearOf(3) > WATER_CELL * WATER_CLEAR + 3);
  // land 13.5 m east of cell (0, 0)'s centre (10, 10): open to a carrack's grid, closed to a galley's
  const isWater = (x) => x < 23.5;
  assert.equal(createWaterGrid({ isWater, hull: 4 }).open(0, 0), true);
  assert.equal(createWaterGrid({ isWater, hull: 3 }).open(0, 0), false);
});

test('AUDIT SEA PATHS AI-6: no step of a way crosses a spit one tile thick (6.4 m) - each cell sounds its eight spokes every SPOKE_STEP_M out to its clearance, so the line between two open cells is sounded every 4.3 m at the most (mutants: the clearance ring alone; the spokes sounded too sparsely)', () => {
  const T = 6.4;
  // the longest run of a leg over land (m), sounded every 0.1 m - a corner clipped under a leg's own sounding (CLEAR_STEP of a
  // cell, 5 m) is a point sampler's floor; a step through the spit runs its whole 6.4 m
  const overLand = (p, isW) => {
    let worst = 0;
    for (let i = 1; i < p.length; i++) {
      const L = d2(p[i - 1], p[i]), n = Math.ceil(L / 0.1);
      let run = 0;
      for (let k = 0; k <= n; k++) { const t = k / n; if (isW(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t)) run = 0; else worst = Math.max(worst, run += L / n); }
    }
    return worst;
  };
  let ways = 0;
  for (const diag of [false, true]) for (let off = 0; off < 20; off += 0.8) {
    const isW = diag
      ? (x, z) => { const u = (x + z) / Math.SQRT2; return !(u > off && u < off + T) || (x - z) / Math.SQRT2 > 300; }
      : (x, z) => !(x > off && x < off + T) || z > 300;
    const p = createWaterGrid({ isWater: isW, hull: 2 }).path(diag ? [-120, -120] : [-150, 0], diag ? [150, 150] : [170, 0]);
    if (!p) continue;
    ways++;
    assert.ok(overLand(p, isW) < WATER_CELL * CLEAR_STEP, `${diag ? 'diagonal' : 'straight'} wall at ${off.toFixed(1)}: ${overLand(p, isW).toFixed(1)} m over it, ${JSON.stringify(p.map((q) => q.map(Math.round)))}`);
  }
  assert.ok(ways >= 45, `the ways round the walls' ends found (${ways})`);
  // a lone rock a tile square, wherever it lies between two cells' centres on her line
  for (let ox = 0; ox < 20; ox += 0.8) for (let oz = 0; oz < 20; oz += 2) {
    const rock = (x, z) => !(x > ox && x < ox + T && z > oz && z < oz + T);
    const p = createWaterGrid({ isWater: rock, hull: 2 }).path([-150, 10], [170, 10]);
    assert.ok(p, 'a way past a rock');
    assert.ok(overLand(p, rock) < WATER_CELL * CLEAR_STEP, `a rock at (${ox.toFixed(1)}, ${oz}): ${overLand(p, rock).toFixed(1)} m over it`);
  }
});

test('AUDIT SEA PATHS AI-7: a fishing boat works a ring of points with her grid\'s room about them that the water from her ground reaches, a smack on her sweeps (a skiff pulls her stroke as she is) (mutants: a point ashore kept; the room unasked; the sweeps left in)', () => {
  // the ground 2 m off a headland (x 300..400 north of z = -300)
  const cove = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
  const gridOf = grids(cove);
  const ctx = { harbour: () => ({ mouth: [0, 150], berths: [], hull: 4 }), grid: gridOf, free: () => true, harbours: () => [], lights: false };
  for (const [hull, seed] of [[1, 0], [1, 90], [1, 200], [0, 45]]) {
    const s = shipAt(298, -259, { hull, seed, errand: { kind: 'fish', harbour: 'h', to: [0, 150], at: [298, -259], yaw: 0, path: null, i: 0, ringing: false } });
    const plan = stepErrand(s, 0.1, ctx);
    const g = gridOf(hull);
    assert.ok(s.errand.ringing && s.errand.path.length >= 1);
    for (const q of s.errand.path) assert.ok(d2(q, [298, -259]) < 1 || (g.room(q) && g.clear([298, -259], q)), `seed ${seed}: ring point ${q.map(Math.round)} roomy and reached`);
    if (hull === 1) assert.deepEqual([plan.sweeps, plan.sailable], [SWEEP_WAY, true], 'a smack on her sweeps');
    else assert.equal(plan.sweeps, undefined, 'a skiff pulls her stroke');
  }
});

test('AUDIT SEA PATHS LN-1: the Bay\'s lane water is a square sea at its four corners, each corner water by the byte law and Ocean by CLIMATE.PAK\'s own climate - the dilation\'s buffer never read; off the Bay none (mutants: the pixel\'s own byte alone; the dilated climate read; the Bay\'s bound dropped)', () => {
  const sea = (x, y) => y >= 10;
  const law = bayLaneWater(sea, () => true);
  assert.equal(law(5, 10), false, 'its north corners (row 9) land: no lane water');
  assert.equal(law(5, 11), true, 'all four corners sea');
  assert.equal(law(1200, 50), false, 'past the Bay: the world\'s law, never the Bay\'s');
  const W = 1001, buffer = new Uint8Array(W * 500).fill(223), undilated = buffer.slice();
  buffer[20 * W + 31] = 230;   // pixel (30, 20) dilated to land climate
  const maps = { climatePak: { buffer, undilated } };
  assert.equal(undilatedClimateIndex(maps, 30, 20), 223, 'the file\'s own climate');
  assert.equal(undilatedClimateIndex({ climatePak: { buffer } }, 30, 20), 230, 'no dilation kept: the buffer as read');
  assert.match(WORLD, /const laneOpen = bayLaneWater\(tvWater, \(px, py\) => \(inBay\(px, py\) \? undilatedClimateIndex\(maps, px, py\) : maps\.getClimateIndex\(px, py\)\) === CLIMATES\.Ocean\);/, 'the host\'s lanes read it');
});

test('AUDIT SEA PATHS LN-1 with ARENA2: in the Bay the game builds (the boot\'s coastal dilation and smoothing), Daggerfall, Sentinel and Wayrest each keep a roadstead and run packets, and the book serves 280 ports and more - read through the dilation it served 233, the three capitals none', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { MapsFile, CLIMATES } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { dilateCoastalClimate, smoothLocationNeighbourhood } = await import('../../../src/world/terrain/terrainHelper.js');
  const { buildMapDict } = await import('../../../src/systems/map/mapDirectory.js');
  const { PORT_LOCATION_IDS } = await import('../../../src/systems/travel/travelPorts.js');
  const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
  const { roadsteadOf } = await import('../../../src/systems/naval/seaLanes.js');
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const dict = buildMapDict(maps);
  dilateCoastalClimate(maps, 2);
  smoothLocationNeighbourhood(dict, woods);
  const tvWater = (px, py) => woods.getHeightMapValue(px, py) <= WATER_BYTE;
  const law = bayLaneWater(tvWater, (px, py) => inBay(px, py) && undilatedClimateIndex(maps, px, py) === CLIMATES.Ocean);
  const lawN = (x, z) => { const p = pixelOfNative(x, z); return law(p.x, p.y); };
  const ports = bayLanePorts(dict, maps, PORT_LOCATION_IDS);
  const net = laneNetwork(ports, law);
  for (const name of ['Daggerfall', 'Sentinel', 'Wayrest']) {
    const p = ports.find((q) => q.name === name);
    assert.ok(roadsteadOf(p, law), `${name}: a roadstead`);
    const mine = net.filter((l) => l.a.id === p.id || l.b.id === p.id);
    assert.ok(mine.length >= 1 && mine.some((l) => laneWay(l, law, lawN)), `${name}: a lane with a way`);
  }
  const served = new Set(net.flatMap((l) => [l.a.id, l.b.id]));
  assert.ok(served.size >= 280, `ports served ${served.size}`);
  const dilated = (px, py) => inBay(px, py) && tvWater(px, py) && maps.getClimateIndex(px, py) === CLIMATES.Ocean;
  assert.ok(new Set(laneNetwork(ports, dilated).flatMap((l) => [l.a.id, l.b.id])).size < served.size - 40, 'the dilated read served far fewer');
});

test('AUDIT SEA PATHS LN-2: past the Bay a port with no port within its reach runs to its nearest within the way\'s cap - a port with one in reach keeps its reach (mutants: the far look ignored; every port looking far)', () => {
  const sea = () => true;
  const port = (id, px, py) => ({ id, name: `p${id}`, px, py, region: 0 });
  const ports = [port(1, 1200, 100), port(2, 1300, 100), port(3, 1350, 160), port(4, 1850, 100), port(6, 1000, 400)];   // 4 lies 500 px from 3; 6 has one port in its reach
  const near = laneNetwork(ports, sea, 400, true);
  assert.equal(near.filter((l) => l.a.id === 4 || l.b.id === 4).length, 0, 'within the reach alone: none');
  const far = laneNetwork(ports, sea, 400, true, 800);
  const fours = far.filter((l) => l.a.id === 4 || l.b.id === 4).map((l) => l.key).sort();
  assert.deepEqual(fours, ['2-4', '3-4'], 'its two nearest within the cap');
  assert.deepEqual(far.filter((l) => l.a.id !== 4 && l.b.id !== 4).map((l) => l.key).sort(), near.map((l) => l.key).sort(), 'the rest keep their reach');
  assert.deepEqual(far.filter((l) => l.a.id === 6 || l.b.id === 6).map((l) => l.key), ['1-6'], 'one in its reach: that one alone');
  assert.match(readFileSync(new URL('../../../src/scenes/naval/worldLanes.js', import.meta.url), 'utf8'), /laneNetwork\(ports\.list\(\), worldOpen, BEYOND_LANE_MAX_PX, true, BEYOND_LANE_PATH_PX\)/);
});

test('AUDIT SEA PATHS LN-4: a lane\'s straightened leg holds when every map pixel it crosses is water - one land pixel between four soundings a pixel, or a corner\'s two, is no leg; its two ends\' own pixels are its own (past the Bay as on it) (mutants: four soundings a pixel; the corner let through; the walk stopped short)', () => {
  const P = NATIVE_PIXEL;
  for (const ox of [0, 1500]) {   // on the Bay, and past it
    const at = (i, k) => ({ x: (ox + i + 0.5) * P, z: (k + 0.5) * P });
    const water = (land) => (x, z) => !land.has(`${Math.floor(x / P) - ox},${Math.floor(z / P)}`);
    assert.equal(holdsLine(at(0, 0), at(10, 3), water(new Set())), true);
    assert.equal(holdsLine(at(0, 0), at(10, 3), water(new Set(['3,1']))), false, 'a land pixel the line crosses');
    // the line from (0.5, 0.5) to (10.5, 3.5) crosses pixel (3, 1) for under a quarter of a pixel at its corner
    assert.equal(holdsLine({ x: (ox + 0.5) * P, z: 0.5 * P }, { x: (ox + 10.5) * P, z: 3.2 * P }, water(new Set(['6,1']))), false, 'a pixel crossed near its corner');
    assert.equal(holdsLine(at(0, 0), at(3, 3), water(new Set(['1,0']))), false, 'through a corner, a land pixel beside it');
    assert.equal(holdsLine(at(0, 0), at(3, 3), water(new Set(['0,0', '3,3']))), true, 'its ends\' own pixels its own');
    assert.equal(holdsLine(at(12, 5), at(0, 0), water(new Set(['11,5']))), false, 'walked from its start');
    assert.equal(holdsLine(at(12, 5), at(0, 0), water(new Set(['1,0']))), false, 'walked to its end');
  }
});

test('AUDIT SEA PATHS PL-1: a sailed or launched leg arrives anywhere in its window - past the Bay a window centred on the pixel\'s byte, three quarters of it in the neighbours; a land leg after it keeps the autopilot\'s own law (mutants: the leg\'s own word ignored; the base not restored)', () => {
  const o = mapPixelWorldOrigin(1200, -39), c = { x: o.x + MP_WORLD_UNITS / 2, z: o.z - MP_WORLD_UNITS / 2 };
  const rect = { xMin: c.x - 4000, xMax: c.x + 4000, zMin: c.z - 4000, zMax: c.z + 4000 };
  const at = { worldX: c.x - 1000, worldZ: c.z - 1000, mapPixelX: 1199, mapPixelY: -38 };   // in the window, in a neighbour
  const ap = new TravelAutopilot({ x: 1200, y: -39 }, rect, 1);
  assert.equal(ap.update(at).arrived, false, 'the old law: the neighbour never arrives');
  ap.initTargetRect({ x: 1200, y: -39 }, rect, 1, { edgeArrival: true });
  assert.equal(ap.update(at).arrived, true, 'a sea leg: arrived');
  ap.initTargetRect({ x: 1200, y: -39 }, rect, 1);
  assert.equal(ap.update(at).arrived, false, 'the next land leg: the autopilot\'s own again');
  assert.match(readFileSync(new URL('../../../src/systems/travel/travelOptions.js', import.meta.url), 'utf8'), /const atSea = leg\.kind === 'sea' \|\| leg\.kind === 'embark';\n[^\n]*edgeArrival: atSea \? true : undefined \};/);
});

test('AUDIT SEA PATHS PL-2: the Veil is crossed by the crossing alone - a plan with one end in the Eltheric Ocean\'s box and one out of it is none, and one with both in it keeps to the box (mutants: the refusal gone; the box unheld)', () => {
  const sea = () => true;
  const helm = { isWater: sea, sea: { start: 'sea', again: false, goal: 'sea' } };
  assert.equal(planRoute({ x: 5486, y: -2758 }, { x: 207, y: 213 }, helm), null, 'Veilhaven\'s waters to Daggerfall');
  assert.equal(planRoute({ x: 207, y: 213 }, { x: 5486, y: -2758 }, helm), null, 'and back');
  // both ends by the box's south edge, the box's water walled between them: the way round lies outside the box, refused
  const y1 = ETHER_BOX.y1;
  const wall = (x, y) => !(x === 3000 && y < y1 && y >= y1 - 40);
  const p = planRoute({ x: 2990, y: y1 - 3 }, { x: 3010, y: y1 - 3 }, { isWater: wall, sea: { start: 'sea', again: false, goal: 'sea' } });
  assert.ok(!p || p.pixels.every((q) => inEther(q.x, q.y)), 'never out of the box');
  const inside = planRoute({ x: 2990, y: y1 - 60 }, { x: 3010, y: y1 - 60 }, { isWater: wall, sea: { start: 'sea', again: false, goal: 'sea' } });
  assert.ok(inside && inside.pixels.every((q) => inEther(q.x, q.y)), 'a way inside it found');
});

test('AUDIT SEA PATHS PL-3: an Eltheric port isle whose town and every pixel about it read water is landed on itself; one with land beside it lands on the land (mutants: the isle\'s own landfall gone)', () => {
  const isle = planRoute({ x: 5000, y: -5000 }, { x: 5010, y: -5000 }, { isWater: () => true, sea: { start: 'sea', again: false } });
  assert.equal(isle?.kinds.at(-1), 'landfall');
  assert.deepEqual(isle.pixels.at(-1), { x: 5010, y: -5000 });
  const shore = (x, y) => !(x === 5011 && y === -5000);
  const near = planRoute({ x: 5000, y: -5000 }, { x: 5010, y: -5000 }, { isWater: shore, sea: { start: 'sea', again: false } });
  assert.deepEqual(near.pixels.at(-2), { x: 5011, y: -5000 }, 'ashore on the land beside it, walked in');
});

test('AUDIT SEA PATHS PL-4: a boat to hand that finds no plan is planned again on foot; a booked voyage never (mutants: the moored boat alone replanned; the voyage replanned)', () => {
  const walk = { pixels: [{ x: 0, y: 0 }, { x: 1, y: 0 }], kinds: ['open'], cost: 1 };
  assert.equal(tvMooredDry({ how: 'packed', start: 'land' }, null, () => walk), walk, 'packed parts, no plan: on foot');
  assert.equal(tvMooredDry({ how: 'packed', start: 'land', voyage: true }, null, () => walk), null, 'a passenger is not set walking');
  assert.equal(tvMooredDry(null, null, () => walk), null);
  assert.equal(tvMooredDry({ how: 'packed' }, { kinds: ['open'] }, () => walk), null, 'a plan made: kept');
  assert.equal(tvMooredDry({ how: 'moored' }, { kinds: ['open'] }, () => walk), walk, 'AUDIT OW5 S3 stands');
  assert.match(WORLD, /if \(dry\) \{ plan = dry; seaAsk = null; \}\n {4}if \(!plan\) \{ tvSeaNoWay\(from, pix,/, 'the spot\'s plan asks it before saying no way');
});

test('AUDIT SEA PATHS PL-5: the no-way clock follows her while she steers off land, and the way back counts; the detours\' own clock still ends a dead end (mutants: the clock against her nearest alone; the detours unbounded)', () => {
  const st = { helm: createSeaHelm(), best: Infinity, ref: Infinity, bestS: 0, detourS: 0 };
  assert.equal(seaNoWay(st, 2000, 1), false);
  // rounding a headland: 1.5 km farther, steering off land for 300 s
  st.helm.reach = 200;
  for (let d = 2000, t = 0; t < 300; t++, d += 5) assert.equal(seaNoWay(st, d, 1), false, `detour at ${t} s`);
  st.helm.reach = 0;
  // and back: 400 s of closing that never betters her nearest
  for (let d = 3500, t = 0; t < 300; t++, d -= 5) assert.equal(seaNoWay(st, d, 1), false, `the way back at ${t} s`);
  // no way at all: the plain clock
  const still = { helm: createSeaHelm(), best: Infinity, ref: Infinity, bestS: 0, detourS: 0 };
  seaNoWay(still, 1000, 1);
  let stopped = -1;
  for (let t = 1; t < 400 && stopped < 0; t++) if (seaNoWay(still, 1000, 1)) stopped = t;
  assert.ok(stopped > SEA_WAY.noWayS - 2 && stopped <= SEA_WAY.noWayS + 2, `no way: stopped at ${stopped}`);
  // a dead end, steering off land for ever
  const trap = { helm: { ...createSeaHelm(), reach: 150 }, best: Infinity, ref: Infinity, bestS: 0, detourS: 0 };
  seaNoWay(trap, 1000, 1);
  let ended = -1;
  for (let t = 1; t < 2000 && ended < 0; t++) if (seaNoWay(trap, 1000 + (t % 50), 1)) ended = t;
  assert.ok(ended > SEA_WAY.detourS - 2 && ended <= SEA_WAY.detourS + 2, `a dead end: stopped at ${ended}`);
  assert.match(WORLD, /if \(seaNoWay\(tvSea, dist, gs\)\) \{ tvSeaStop\(TRAVEL_VIEW_TEXT\.noWayAtSea\); return; \}/);
});
