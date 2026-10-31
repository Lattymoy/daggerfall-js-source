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
  PROGRESS_S, GRID_MARGIN, CLEAR_STEP, PATH_NODES, PATH_BUDGET_K, courseVia, waterOf,
} from '../../../src/systems/naval/shipLife.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';
import { SWEEP_WAY } from '../../../src/systems/naval/navalAI.js';
import { holdsLine, laneNetwork, laneWay, wayOffSea, subWay, packetsAt, LANE_PACKETS_MAX } from '../../../src/systems/naval/seaLanes.js';
import { kernelLine, createKernelSea } from '../../../src/world/water/kernelSea.js';
import { mendSeaLegs } from '../../../src/systems/travel/seaLegsMend.js';
import { raiderOf } from '../../../src/systems/seaRaiders.js';
import { bayLaneWater, bayLanePorts, nearWay, beyondPathPx, worldLaneWater, beyondLaneWay } from '../../../src/scenes/naval/worldLanes.js';
import { setTamrielTrace, tamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { undilatedClimateIndex } from '../../../src/world/terrain/terrainHelper.js';
import { NATIVE_PIXEL, pixelOfNative } from '../../../src/systems/seaRaiders.js';
import { TravelAutopilot } from '../../../src/systems/travel/travelAutopilot.js';
import { mapPixelWorldOrigin, MP_WORLD_UNITS } from '../../../src/systems/travel/travelPaths.js';
import { planRoute, routeGround, routeLegs, setSeaLegKernel, DEEP_BYTE } from '../../../src/systems/travel/travelRoute.js';
import { tvMooredDry } from '../../../src/systems/travel/seaAsk.js';
import { seaNoWay, SEA_WAY, createSeaHelm } from '../../../src/systems/seaHelm.js';
import { inEther, ETHER_BOX } from '../../../src/world/ethericSea.js';
import { inBay, setTamrielFit, tamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';

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

test('AUDIT SEA PATHS PL-3: an Eltheric port isle whose town and every pixel within the landfall\'s reach read water is landed on itself; one with land beside it lands on the land (mutants: the isle\'s own landfall gone; the isle by its neighbours alone - AUDIT STARTS V4 its pin)', () => {
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

// ── the follow-ups: the six left open, each closed (O1-O6) ──────────────────────────────────────────────────────────────

const lerpOver = (p, w) => { for (let i = 1; i < p.length; i++) for (let t = 0; t <= 1; t += 0.005) if (!w(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t)) return true; return false; };

test('AUDIT SEA PATHS O1: a way the grid\'s search spends PATH_NODES on is sought again over coarse cells, each step found again in the grid\'s own - round a headland 2 km deep; one way\'s whole spend PATH_BUDGET_K of PATH_NODES (mutants: the coarse search gone; its steps unasked; the spend unbounded)', () => {
  const w = (x, z) => !(x > -100 && x < 100 && z > -1000);
  const g = createWaterGrid({ isWater: w, hull: 2 });
  const p = g.path([-600, 1000], [600, 1000]);
  assert.ok(p, 'round the headland');
  assert.ok(Math.min(...p.map((q) => q[1])) < -1000, 'round its end');
  assert.equal(lerpOver(p, w), false, 'never over land');
  assert.ok(g.expansions <= PATH_NODES * PATH_BUDGET_K + 1, `spent ${g.expansions}`);
  // a way of many coarse steps, each found again: its whole spend held to PATH_BUDGET_K of a small cap (unbounded, 249)
  const islet = (x, z) => Math.hypot(x - 1500, z) > 30;
  const gb = createWaterGrid({ isWater: islet, hull: 1, nodeCap: 50 });
  gb.path([0, 0], [3000, 0]);
  assert.ok(gb.expansions <= 50 * PATH_BUDGET_K + 1, `a small cap's spend ${gb.expansions}`);
  const lake = (x, z) => Math.hypot(x, z - 800) > 60 || Math.hypot(x, z - 800) < 40;   // a ring of land: no way in
  const gl = createWaterGrid({ isWater: lake, hull: 2 });
  assert.equal(gl.path([0, 0], [0, 800]), null);
  assert.ok(gl.expansions <= PATH_NODES * PATH_BUDGET_K + 1, `no way, spent ${gl.expansions}`);
});

test('AUDIT SEA PATHS O3: handed the host\'s tiles, a leg is asked of every tile it crosses - a corner clipped by under a metre is no leg; without them every quarter cell, where it slips by (mutants: the tiles unwalked)', () => {
  const T = 6.4, land = (x, z) => x >= 5 * T && x < 6 * T && z >= 5 * T && z < 6 * T;   // one tile
  const tiled = Object.assign((x, z) => !land(x, z), { tile: () => ({ size: T, x0: 0, z0: 0 }) });
  const a = [20, 44.3], b = [44.3, 20];   // x + z = 64.3: 0.3 across the tile's corner
  assert.equal(createWaterGrid({ isWater: (x, z) => !land(x, z), hull: 0 }).clear(a, b), true, 'the soundings step past it');
  assert.equal(createWaterGrid({ isWater: tiled, hull: 0 }).clear(a, b), false, 'the tile walked');
  assert.equal(createWaterGrid({ isWater: waterOf(() => tiled), hull: 0 }).clear(a, b), false, 'a host\'s reader asked afresh carries its tiles');
  let reader = () => true;
  const lazy = waterOf(() => reader);
  reader = (x, z) => !land(x, z);
  assert.equal(lazy(33, 33, 0), false, 'the reader swapped in is the one read');
  assert.match(WORLD, /navalIsWater\.tile = \(\) => \(\{ size: TERRAIN_SIZE \/ 128, x0: state\.compensation\[0\], z0: state\.compensation\[2\] \}\);/, 'the host hands its tiles');
});

test('AUDIT SEA PATHS O3: a ship sailing for a point of her own (a packet\'s lane, a raider\'s course) sails the grid\'s way to it where the water does not carry her straight, straight where it does, the way kept while the point moves little (mutants: straight over the land; planned again every call)', () => {
  const w = (x, z) => !(x > -60 && x < 60 && z > 200 && z < 400);
  const grid = createWaterGrid({ isWater: w, hull: 2 });
  const ship = shipAt(0, 0, { errand: null });
  const aim = courseVia(grid, ship, [0, 600]);
  assert.notDeepEqual(aim, [0, 600], 'not straight over the islet');
  assert.ok(grid.clear([0, 0], aim), 'her next point one the water carries her to');
  const v = ship.via;
  courseVia(grid, ship, [10, 610]);
  assert.equal(ship.via, v, 'the way kept');
  assert.deepEqual(courseVia(grid, shipAt(300, 0), [300, 600]), [300, 600], 'straight where the water carries her');
  const NH = readFileSync(new URL('../../../src/scenes/naval/navalHost.js', import.meta.url), 'utf8');
  assert.match(NH, /s\.course = courseVia\(gridOf\(s\.hull\), s, \[p\.x, p\.z\]\);/, 'a packet');
  assert.match(NH, /e\.ship\.course = r\?\.ahead \? courseVia\(gridOf\(e\.ship\.hull\), e\.ship, \[r\.ahead\[0\], r\.ahead\[2\]\]\) : null;/, 'a raider');
});

test('AUDIT SEA PATHS O3: a lane\'s way holds on the kernel\'s sea - a corner on an islet let go, a leg across the kernel\'s land sailed through its pixels\' own water (subWay), each of that way\'s steps the kernel\'s (mutants: the kernel unasked; subWay gone; the corner kept; a sub-step unasked)', () => {
  const P = NATIVE_PIXEL;
  const water = (x, y) => y === 0 && x >= 0 && x <= 8;   // a channel one pixel wide: no way round the islet's pixel but through it
  const waterN = (x, z) => { const q = pixelOfNative(x, z); return water(q.x, q.y); };
  const kernel = (x, z) => waterN(x, z) && Math.hypot(x - 3.5 * P, z - 499.5 * P) > 0.2 * P;   // an islet at pixel 3's middle
  const lane = { a: { road: { x: 0, y: 0 } }, b: { road: { x: 8, y: 0 } } };
  const plain = laneWay(lane, water, waterN);
  assert.notEqual(wayOffSea(plain.pts, kernel), null, 'without the kernel: over the islet');
  const way = laneWay(lane, water, waterN, kernel);
  assert.ok(way, 'a way');
  assert.equal(wayOffSea(way.pts, kernel), null, 'every leg the kernel\'s sea');
  // the kernel's land across a channel three pixels wide, no way round within its pixels: no way at all (asked again
  // without each pixel its land stands in), never one over it
  const wide = (x, y) => y >= -1 && y <= 1 && x >= 0 && x <= 8, wideN = (x, z) => { const q = pixelOfNative(x, z); return wide(q.x, q.y); };
  const barred = (x, z) => wideN(x, z) && Math.abs(x - 3.5 * P) > 0.45 * P;
  assert.equal(laneWay(lane, wide, wideN, barred), null, 'barred: no way');
  const sub = subWay({ x: 2.5 * P, z: 499.5 * P }, { x: 4.5 * P, z: 499.5 * P }, waterN, kernel);
  assert.ok(sub && sub.length > 2, 'round it');
  for (let i = 1; i < sub.length; i++) assert.equal(kernelLine(sub[i - 1], sub[i], kernel), true);
  assert.deepEqual(kernelLine({ x: 0, z: 0 }, { x: 4096, z: 0 }, (x) => x < 100, true, true), { x: 512, z: 0 }, 'the first point off its sea (every KERNEL_SEA_STEP), its ends its own');
  // a raider is born only on the sea it is handed
  let some = 0;
  for (let cx = 0; cx < 40; cx++) {
    if (raiderOf({ cx, cy: 1, life: 7, open: () => true })) some++;
    assert.equal(raiderOf({ cx, cy: 1, life: 7, open: () => true, sea: () => false }), null, `cell ${cx}: never ashore`);
  }
  assert.ok(some > 5, `${some} raiders on an open sea`);
});

test('AUDIT SEA PATHS O3 with ARENA2: the kernel\'s sea answers the ground the game builds - the islet at Stuld Hall\'s roadstead its land, the Bay\'s lanes round it, every way the kernel\'s sea; a raider born only on it (mutants: the pixel proven sea by its bound alone; a raider born ashore)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { MapsFile, CLIMATES } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { dilateCoastalClimate, smoothLocationNeighbourhood } = await import('../../../src/world/terrain/terrainHelper.js');
  const { buildMapDict } = await import('../../../src/systems/map/mapDirectory.js');
  const { PORT_LOCATION_IDS } = await import('../../../src/systems/travel/travelPorts.js');
  const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const dict = buildMapDict(maps);
  dilateCoastalClimate(maps, 2);
  smoothLocationNeighbourhood(dict, woods);
  const tvWater = (px, py) => woods.getHeightMapValue(px, py) <= WATER_BYTE;
  const law = bayLaneWater(tvWater, (px, py) => inBay(px, py) && undilatedClimateIndex(maps, px, py) === CLIMATES.Ocean);
  const lawN = (x, z) => { const q = pixelOfNative(x, z); return law(q.x, q.y); };
  const kernel = createKernelSea(() => woods);
  const P = NATIVE_PIXEL, isletAt = { x: (748 + 3.5 / 8) * P, z: (499 - 278 + 1 - 4.5 / 8) * P };
  assert.equal(law(748, 278), true, 'the four-corner law calls its pixel lane water');
  assert.equal(kernel(isletAt.x, isletAt.z), false, 'the kernel stands an islet there');
  assert.equal(kernel(748.05 * P, (499 - 278 + 0.05) * P), true, 'and sea about it');
  const ports = bayLanePorts(dict, maps, PORT_LOCATION_IDS), net = laneNetwork(ports, law);
  const stuld = net.filter((l) => l.a.name === 'Stuld Hall' || l.b.name === 'Stuld Hall');
  assert.ok(stuld.length >= 2);
  for (const l of stuld) {
    const way = laneWay(l, law, lawN, kernel);
    assert.ok(way, `${l.a.name}-${l.b.name}: a way`);
    assert.equal(wayOffSea(way.pts, kernel), null, `${l.a.name}-${l.b.name}: every leg the kernel's sea`);
  }
  assert.ok(stuld.some((l) => wayOffSea(laneWay(l, law, lawN).pts, kernel)), 'without the kernel one ran over the islet');
  let born = 0, ashore = 0;
  for (let cx = 100; cx < 140; cx++) for (let cy = 40; cy < 60; cy++) {
    const open = (px, py) => law(px, py), sea = (x, z) => kernel(x, z);
    const r = raiderOf({ cx, cy, life: 1001, open, sea });
    if (r) { born++; if (!kernel(r.born.x, r.born.z)) ashore++; }
  }
  assert.ok(born > 0 && ashore === 0, `${born} raiders born, ${ashore} ashore`);
});

/** The world's lanes on the freeware's map past the Bay (the picture, its ports, the kernel's sea), made once. */
let _pastBay = null;
const pastBayWorld = () => (_pastBay ??= (async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile, CLIMATES } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
  const { pastBayLakeAt, arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { rumareSeaPixel } = await import('../../../src/world/rumareWaters.js');
  const { createWorldPlaces } = await import('../../../src/world/worldWide/worldPlaces.js');
  const { createWorldPorts } = await import('../../../src/world/worldWide/worldPorts.js');
  const { pastBayPlaceRows } = await import('../../../src/world/pastBayRows.js');
  const { buildMapDict } = await import('../../../src/systems/map/mapDirectory.js');
  const { PORT_LOCATION_IDS } = await import('../../../src/systems/travel/travelPorts.js');
  const { createWorldLanes } = await import('../../../src/scenes/naval/worldLanes.js');
  const { openSeaOf } = await import('../../../src/world/portSites.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const bayWoods = new WoodsFile(); bayWoods.load(bytes('WOODS.WLD'));
  const woods = groundWoods(bayWoods);
  groundMaps(maps);
  const tvWater = (px, py) => woods.getHeightMapValue(px, py) <= WATER_BYTE;
  const laneOpen = bayLaneWater(tvWater, (px, py) => (inBay(px, py) ? undilatedClimateIndex(maps, px, py) : maps.getClimateIndex(px, py)) === CLIMATES.Ocean);
  const laneOpenNative = (x, z) => { const q = pixelOfNative(x, z); return laneOpen(q.x, q.y); };
  const seaPixel = (x, y) => isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y));
  let bayOpenSea = null;
  const openSea = (x, y) => (inBay(x, y) ? (bayOpenSea ??= openSeaOf(seaPixel, 1000, 500))[y * 1000 + x] === 1 : (seaPixel(x, y) && !pastBayLakeAt(x, y)) || rumareSeaPixel(x, y));
  const places = createWorldPlaces();
  places.register('tesa', pastBayPlaceRows({ pixels: arenaPixels(), templateOf: () => ({ exterior: { exteriorData: { width: 1, height: 1 } } }), capitals: true }));
  const ports = createWorldPorts({ places, openSea, regionAt: (x, y) => maps.getRegionIndexAt(x, y) });
  const kernel = createKernelSea(() => woods);
  const wl = createWorldLanes({ mapDict: () => buildMapDict(maps), maps, portIds: PORT_LOCATION_IDS, ports, bayOpen: laneOpen, bayOpenNative: laneOpenNative, water: tvWater, beyond: () => true, kernel });
  return { wl, ports, woods, kernel, laneOpen, tvWater, maps };
})());

test('AUDIT SEA PATHS O2 with ARENA2: past the Bay a channel a picture cell wide on the slant is sailed where the Bay\'s scale holds the step (Vivec to Ebonheart), and a port with none in its reach and no way runs farther to one that has (Necrom); every port past the Bay with a roadstead is served (mutants: the corner unasked at the Bay\'s scale; the lone search gone)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { wl, ports } = await pastBayWorld();
  const past = wl.beyond(), served = new Set();
  for (const l of past) if (wl.way(l)) { served.add(l.a.name); served.add(l.b.name); }
  const byName = (a, b) => past.find((l) => (l.a.name === a && l.b.name === b) || (l.a.name === b && l.b.name === a));
  assert.ok(wl.way(byName('Vivec', 'Ebonheart')), 'Vivec to Ebonheart: the channel sailed');
  assert.ok(served.has('Necrom') && served.has('Blacklight') && served.has('Lilmoth') && served.has('Soulrest'), [...served].join(', '));
  const roadsteaded = ports.list().filter((p) => past.some((l) => l.a.id === p.id || l.b.id === p.id)).map((p) => p.name);
  assert.deepEqual(roadsteaded.filter((n) => !served.has(n)), [], 'every port past the Bay a lane holds is served');
});

test('AUDIT SEA PATHS O4: in the Eltheric Ocean a byte over the sea\'s own height is the planner\'s land (the beach the ground builds), on the Bay and past it water as ever; a journey\'s sailed legs mended round the kernel\'s land where the host registers it (mutants: the beach water; the legs unmended; a mended leg aimed at its window)', () => {
  assert.equal(DEEP_BYTE, 3);
  const g = routeGround(() => 223, () => 10, 5, 4, 4, () => false, undefined, null);
  const heightAt = (x, y) => (x === 5000 ? 4 : x === 5001 ? 3 : 4);
  const g2 = routeGround(() => 223, heightAt, 5, 4, 4, () => false, undefined, null);
  assert.equal(g2.isWater(5000, -5000), false, 'an Eltheric beach: land');
  assert.equal(g2.isWater(5001, -5000), true, 'under the sea\'s height: water');
  assert.equal(g2.isWater(1500, 100), true, 'past the Bay, out of the box: as ever');
  assert.ok(g, 'a ground');
  const P = NATIVE_PIXEL;
  const kernel = (x, z) => Math.hypot(x - 3005.5 * P, z - 5500 * P) > 0.3 * P;   // an islet on the legs' line (their marks the bytes' points, z 5500 pixels)
  const legs = [{ x: 3001, y: -5001, kind: 'sea' }, { x: 3008, y: -5001, kind: 'sea' }];
  const mended = mendSeaLegs(legs, { x: 3000.5 * P, z: (499 + 5001 + 0.5) * P }, kernel, () => true);
  assert.ok(mended.length > legs.length && mended.some((l) => l.at), 'marks of its own round the islet');
  for (const l of mended.filter((q) => q.at)) assert.equal(kernel(l.at.x, l.at.z), true);
  setSeaLegKernel(kernel, () => true);
  try {
    const px = []; for (let x = 3000; x <= 3008; x++) px.push({ x, y: -5001 });
    const viaLegs = routeLegs(px, px.slice(1).map(() => 'sea'));
    assert.ok(viaLegs.some((l) => l.at), 'routeLegs mends where the host registered the kernel');
  } finally { setSeaLegKernel(null, null); }
  assert.match(readFileSync(new URL('../../../src/systems/travel/travelOptions.js', import.meta.url), 'utf8'), /: leg\.kind === 'sea' && leg\.at \? rectOf\(leg\.at\.x - SEA_LEG_SIZE \/ 2, leg\.at\.z - SEA_LEG_SIZE \/ 2, SEA_LEG_SIZE, SEA_LEG_SIZE\)/);
  assert.match(WORLD, /setSeaLegKernel\(kernelSea, tvWater\);/);
});

test('AUDIT SEA PATHS O5: ashore with a boat to hand and an end past the Bay, the plan may walk to the nearest shore and sail the sea lanes from it - where the box\'s search finds none (mutants: the shore\'s lanes unasked)', () => {
  const isWater = (x, y) => x >= 1201 && x < 1600 && !(x >= 1390 && x <= 1410 && y >= 90 && y <= 110);   // one sea between two shores, an isle across the straight way
  const plan = planRoute({ x: 1199, y: 100 }, { x: 1610, y: 100 }, { isWater, sea: { start: 'land', again: false }, margins: [1] });   // a boat left where it lands: no relaunch across the isle
  assert.ok(plan, 'a plan');
  const k = plan.kinds;
  assert.ok(k.includes('embark') && k.includes('sea') && k.includes('landfall'), k.join(' '));
  assert.ok(k.indexOf('embark') < k.indexOf('landfall'));
});

test('AUDIT SEA PATHS O6: a way\'s straightening galloped out and halved back - a zigzag channel of twelve reaches straightened in under 30,000 soundings, its whole search with it (the look back from each end asked 43,777) (mutants: the look back from the end)', () => {
  const segs = []; let x = 0, z = 0;
  for (let i = 0; i < 12; i++) { const nx = x + (i % 2 ? 0 : 300), nz = z + (i % 2 ? 300 : 0); segs.push([x, z, nx, nz]); x = nx; z = nz; }
  const near = (px, pz) => segs.some(([ax, az, bx, bz]) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)); return Math.hypot(px - ax - dx * t, pz - az - dz * t) < 40; });
  let n = 0;
  const g = createWaterGrid({ isWater: (a, b) => { n++; return near(a, b); }, hull: 1, nodeCap: 60000 });
  const p = g.path([0, 0], [x, z]);
  assert.ok(p && p.length <= 30, `a way of ${p?.length} points`);
  assert.ok(n < 30000, `${n} soundings`);
});

test('AUDIT SEA PATHS C1: a lane sails a packet every LANE_HEADWAY_S each way, LANE_PACKETS_MAX at most (its headway widened past it); a long lane is near within its pad of any leg of its way (mutants: the packets uncapped; a leg\'s end alone asked)', () => {
  const lane = { key: '10-20', a: { id: 10, region: 1 }, b: { id: 20, region: 1 } };
  const NP = NATIVE_PIXEL, at = (x, y) => ({ x: x * NP, z: (500 - y) * NP });
  const short = packetsAt(lane, { pts: [at(0, 0), at(300, 0)], len: 300 * 819.2 }, 0).length;
  assert.ok(short > 1 && short < LANE_PACKETS_MAX, `${short} packets on 246 km`);
  assert.equal(packetsAt(lane, { pts: [at(0, 0), at(6000, 0)], len: 6000 * 819.2 }, 0).length, LANE_PACKETS_MAX, 'round the land: the most');
  const pts = [at(0, 0), at(100, 0), at(100, 80)];
  assert.equal(nearWay(pts, { x: 50, y: 3 }, 4), true, 'abreast a leg\'s middle');
  assert.equal(nearWay(pts, { x: 97, y: 40 }, 4), true, 'abreast the second');
  assert.equal(nearWay(pts, { x: 50, y: 5 }, 4), false);
  assert.equal(nearWay(pts, { x: -3, y: 0 }, 4), true, 'off its end');
  assert.equal(nearWay(pts, { x: 50, y: 40 }, 4), false, 'inside the bend');
});

test('AUDIT SEA PATHS C1 with ARENA2: a lane past the Bay whose search finds no way under its cap is sought over the picture\'s whole sea and runs at its own length - Senchal to Torval, Necrom to Vivec and to Ebonheart, Winterhold and Windhelm to the Imperial City round the land; every lane past the Bay sails, each leg on the lane water and the kernel\'s sea; near within its pad of its way (mutants: the long search gone; every lane long; a lone port\'s capped null kept; near by the ellipse; the kernel\'s last pixel kept by its column alone)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { wl, kernel, woods, laneOpen, tvWater, maps } = await pastBayWorld();
  const past = wl.beyond(), name = (l) => [l.a.name, l.b.name].sort().join(' - ');
  assert.deepEqual(past.filter((l) => !wl.way(l)).map(name), [], 'every lane past the Bay sails');
  const long = past.filter((l) => l.long);
  assert.deepEqual(long.map(name).sort(), ['Ebonheart - Necrom', 'Imperial City - Windhelm', 'Imperial City - Winterhold', 'Necrom - Vivec', 'Senchal - Torval']);
  const { openNative } = worldLaneWater({ bayOpen: laneOpen, water: tvWater, climateAt: (x, y) => maps.getClimateIndex(x, y), beyond: () => true });
  for (const l of long) {
    const way = wl.way(l), n = way.pts.length;
    assert.ok(l.path > beyondPathPx({ ...l, path: undefined }), `${name(l)}: past its cap`);
    for (let i = 1; i < n; i++) {
      assert.ok(holdsLine(way.pts[i - 1], way.pts[i], openNative), `${name(l)} leg ${i}: the lane water`);
      assert.equal(kernelLine(way.pts[i - 1], way.pts[i], kernel, i === 1, i === n - 1), true, `${name(l)} leg ${i}: the kernel's sea`);
    }
    const mid = way.pts[n >> 1], here = { x: Math.round(mid.x / NATIVE_PIXEL), y: Math.round(500 - mid.z / NATIVE_PIXEL) };
    assert.equal(wl.near(l, here), true, `${name(l)}: near its way`);
    assert.equal(wl.near(l, { x: here.x + 40, y: here.y + 40 }), false, `${name(l)}: 56 px off it`);
  }
  assert.ok(Math.max(...long.map((l) => wl.way(l).len)) > 4.5e6, 'the Imperial City\'s to Skyrim round the land');
  // the kernel's last pixel kept: a sweep up a column across a coast answers as a reader asked afresh each time
  const sweep = (sea, reset) => { let s = ''; for (let z = 463 * NATIVE_PIXEL; z < 467 * NATIVE_PIXEL; z += NATIVE_PIXEL / 8) { if (reset) sea(0, 0); s += sea(162.5 * NATIVE_PIXEL, z) ? 1 : 0; } return s; };
  const fresh = sweep(createKernelSea(() => woods), true);
  assert.ok(fresh.includes('0') && fresh.includes('1'), fresh);
  assert.equal(sweep(createKernelSea(() => woods), false), fresh);
});

test('AUDIT SEA PATHS C1: the diagonal steps past a picture cell\'s corner are kept each by its own bearing - a wall\'s one gap on the slant the Bay\'s scale refuses stays shut though the cell\'s other slants are open (mutants: the steps kept by their cell alone)', () => {
  const was = [tamrielTrace(), tamrielFit()];
  try {
    const w = 320, h = 200, land = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) land[y * w + 60] = land[y * w + 61] = 1;   // a wall two cells thick, the picture's height
    land[100 * w + 60] = 0; land[101 * w + 61] = 0;   // its one gap: (60, 100) to (61, 101), past two land corners
    setTamrielFit({ ox: 4000, oy: 0, ppu: 4 }); setTamrielTrace({ w, h, land, province: new Uint8Array(w * h) });
    const lane = { a: { road: { x: -3920, y: 400 } }, b: { road: { x: -3600, y: 404 } } };   // picture (20, 100) and (100, 101)
    assert.ok(beyondLaneWay(lane, () => true), 'the gap sailed where the Bay\'s scale holds it');
    const shut = (x, z) => { const mx = Math.floor(x / NATIVE_PIXEL), my = 499 - Math.floor(z / NATIVE_PIXEL); return !(mx >= -3757 && mx <= -3755 && my >= 403 && my <= 405); };
    assert.equal(beyondLaneWay(lane, shut), null, 'the gap\'s corner refused: no way');
  } finally { setTamrielTrace(was[0]); setTamrielFit(was[1]); }
});
