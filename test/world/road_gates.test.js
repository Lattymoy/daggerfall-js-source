// ROAD-FOLLOW, the gates (2026-10-27, the owner: "Also, city gates do not line up with the roads"; bible/03-World/
// Town-Shapes.md ROAD-FOLLOW) - A WALLED CITY'S GATES STAND WHERE ITS ROADS COME IN. TS4 and TS7 stood a walled city's gates
// at the bearings of its template's gate blocks (Daggerfall's WALLAA08-11, wherever along their sides Daggerfall put
// them) and the terrain paints each road's arm in from its pixel's edge along its own compass bearing (Basic Roads'
// bands on the Bay, VOYAGER2's curves past it) - the two placed without reading each other: on the freeware's Bay 2,461
// lengths and towers of wall stood where a painted road ran into them, and 73 of 1,640 gates had a road. Now the wall
// reads its pixel's painted roads (world/townWalls.js townWallPathsReader, the host's) and stands a gate where each arm
// crosses its line; its wall waits, unmade, while its pixel's roads are not yet known, and its pixel is built again when
// they land.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { wallPieces, townWall, townWallBlockJson, standTownWall, townWallBlockName, townWallModelId, armLines, roadGatePoints, townWallPathsReader, setTownWallPaths, townWallWaits, townWallReadyAt, townWallGatesOf, townWallCellsOf, gateOpening, WALL_MODELS, TOWN_WALL, GATE_ARMS_MERGE } from '../../src/world/townWalls.js';
import { townOutlineBlockJson, TOWN_OUTLINE_BLOCK } from '../../src/world/townOutline.js';
import { getDFBlockReplacementData, registerPortBlock } from '../../src/formats/worldData/worldDataReplacement.js';
import { hasCustomModel } from '../../src/world/customModels.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { curvesOf } from '../../src/world/road/roadCurves.js';
import { beyondKey } from '../../src/world/arenaRoads.js';
import { CAPITALS, BLOCK_M, CAPITAL_NO_GROUND, capitalDims, capitalGates, capitalCentrePixel, capitalPortBlocks, capitalGardenName, capitalApproachName, capitalBlockNames, planCell } from '../../src/world/tamrielCapitals.js';
import { onCapitalApproach, capitalArrival, capitalApproachCells, capitalGateSlice, APPROACH_TILE, APPROACH_HALF, APPROACH_SKIRT } from '../../src/world/capitalApproaches.js';
import { IMPERIAL_SPAN } from '../../src/world/imperialCity.js';
import { TILE } from '../../src/world/road/roadPainter.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const near = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= d;
/** A ring of radius R about (0, 0), counter-clockwise. */
const ring = (R, n = 360) => Array.from({ length: n }, (_, i) => /** @type {[number, number]} */ ([R * Math.cos((2 * Math.PI * i) / n), R * Math.sin((2 * Math.PI * i) / n)]));

test('ROAD-FOLLOW the arms: the line a pixel\'s painted arm runs in on from its edge - on the Bay Basic Roads\' band to the middle, past the Bay each curve VOYAGER2 draws from that edge (a pair\'s, an end\'s straight run in), its edge first; none for a bit the byte lacks (mutants: the Bay curved; a curve walked from its far end; the bit unread)', () => {
  assert.deepEqual(armLines(DIR.N | DIR.E, DIR.N, false), [[[64, 128], [64, 64]]], 'the Bay: straight in from the north edge');
  assert.deepEqual(armLines(DIR.N | DIR.E, DIR.SW, false), [], 'no such arm');
  const c = armLines(DIR.W | DIR.NE, DIR.NE, true);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0][0], [128, 128], 'from its own corner');
  assert.deepEqual(c[0].at(-1), [0, 64], 'round the bend to the other edge');
  assert.deepEqual(c[0][16], [64, 80], 'by the curve\'s apex, as the painter draws it');
  // a junction: the stem of a T an end's straight run, the through road its two curves
  assert.deepEqual(armLines(DIR.W | DIR.E | DIR.S, DIR.S, true).map((l) => [l[0], l.at(-1)]), [[[64, 0], [64, 64]]]);
  assert.equal(armLines(DIR.W | DIR.E | DIR.NE, DIR.W, true).length, 2, 'the west arm runs on to the east and to the north-east');
  assert.equal(curvesOf(DIR.W | DIR.E | DIR.NE).curves.length, 2);
});

test('ROAD-FOLLOW where the roads come in: each arm walked in from its pixel\'s edge to where it first crosses the wall\'s line, one point an arm; arms nearer than GATE_ARMS_MERGE along the line one gate at their middle (round the line\'s start too); an arm that passes the town by none (a line the arm crosses three times: the outermost) (mutants: the last crossing taken; the arms unmerged; the tracks unread; the frame unshifted)', () => {
  // a round town of radius 150 m whose grid's south-west corner is the pixel's tile (32, 32): the pixel's middle its middle
  const R = 150, pts = ring(R).map(([x, y]) => /** @type {[number, number]} */ ([x + 204.8, y + 204.8]));
  const origin = { x: 32, y: 32 };
  const at = roadGatePoints(pts, origin, { roads: DIR.N | DIR.E, tracks: DIR.W, curved: false });
  assert.equal(at.length, 3);
  for (const want of [[204.8, 354.8], [354.8, 204.8], [54.8, 204.8]]) assert.ok(at.some((q) => near(q, want, 0.5)), `a crossing at ${want}`);
  // a road and a track on one arm cross at one point: one gate
  assert.equal(roadGatePoints(pts, origin, { roads: DIR.N, tracks: DIR.N, curved: false }).length, 1);
  // N and NE on a small town: closer than two lengths along its line - one, between them
  const small = ring(40).map(([x, y]) => /** @type {[number, number]} */ ([x + 204.8, y + 204.8]));
  const two = roadGatePoints(small, origin, { roads: DIR.N | DIR.NE, tracks: 0, curved: false });
  assert.equal(two.length, 1, `merged (${GATE_ARMS_MERGE} m)`);
  assert.ok(Math.atan2(two[0][1] - 204.8, two[0][0] - 204.8) > Math.PI / 4 && Math.atan2(two[0][1] - 204.8, two[0][0] - 204.8) < Math.PI / 2, 'between them');
  // a curve past the Bay: W to NE - its two crossings where the curve meets the line, never the bearings from the middle
  const cur = roadGatePoints(pts, origin, { roads: DIR.W | DIR.NE, tracks: 0, curved: true });
  assert.equal(cur.length, 2);
  const west = cur.find((q) => q[0] < 204.8);
  assert.ok(west[1] > 204.8 + 1, `the west arm's crossing north of the bearing, on its curve (${west[1].toFixed(1)})`);
  for (const q of cur) assert.ok(Math.abs(Math.hypot(q[0] - 204.8, q[1] - 204.8) - R) < 0.6, 'on the line');
  // a town a road passes by: no crossing
  assert.deepEqual(roadGatePoints(small, { x: 32, y: 0 }, { roads: DIR.E | DIR.W, tracks: 0, curved: false }), []);
  // a line the arm crosses three times (a fold in it north of the middle: in at 150 m, out at 100, in again at 50) - the
  // gate where the road first meets it from the edge, never the fold's last crossing by the middle
  const fold = [[-150, -150], [150, -150], [150, 150], [-30, 150], [-30, 100], [30, 100], [30, 50], [-150, 50]].map(([x, y]) => /** @type {[number, number]} */ ([x + 204.8, y + 204.8]));
  const folded = roadGatePoints(fold, origin, { roads: DIR.N, tracks: 0, curved: false });
  assert.equal(folded.length, 1);
  assert.ok(near(folded[0], [204.8, 354.8], 0.01), `the outermost crossing (${folded[0].map((v) => v.toFixed(1))})`);
});

test('ROAD-FOLLOW the gates on the line: a gate\'s opening centred on its road\'s crossing (its length from half a length and the opening\'s offset before it - GATE-ROADS, PIN MOVED), two a length of wall apart at the least, every piece out from the middle; the template\'s bearings as before where none is handed (mutants: the gate begun at the crossing; the old spacing)', () => {
  const pts = ring(150), cross = [[0, 150], [150 * Math.cos(1.0), 150 * Math.sin(1.0)]];
  const gp = wallPieces(pts, [0, 0], cross, { onLine: true }).filter((p) => p.model === WALL_MODELS.gate);
  assert.equal(gp.length, 2);
  for (const q of cross) assert.ok(gp.some((p) => near(gateOpening(p).at, q, 1)), `a gate on its crossing ${q.map((v) => v.toFixed(1))}`);
  // two crossings two lengths apart along the line: both stand, each on its own (the template's spacing slid the second on)
  const a = 0.6, b = a + (2 * TOWN_WALL.piece + 1) / 150;
  const close = [[150 * Math.cos(a), 150 * Math.sin(a)], [150 * Math.cos(b), 150 * Math.sin(b)]];
  const cp = wallPieces(pts, [0, 0], close, { onLine: true }).filter((p) => p.model === WALL_MODELS.gate);
  assert.equal(cp.length, 2);
  for (const q of close) assert.ok(cp.some((p) => near(gateOpening(p).at, q, 1)), 'each on its own crossing');
  const old = wallPieces(pts, [0, 0], close).filter((p) => p.model === WALL_MODELS.gate);
  assert.ok(!close.every((q) => old.some((p) => near(gateOpening(p).at, q, 1))), 'the bearings\' law would have slid one along');
});

/** The synthetic walled city of test/world/townwalls.test.js: one block of houses in the middle of a 3 x 3 ring, its
 *  template's gates north and south - on pixel (px, py). */
function walledCity(serial, px, py) {
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const gate = (z) => ({ subRecords: [{ xPos: 2048, zPos: z, exterior: { block3dObjectRecords: [{ modelIdNum: 446 }] } }] });
  const served = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } }, 'WALLAA08.RMB': { rmbBlock: gate(3584) }, 'WALLAA10.RMB': { rmbBlock: gate(512) } };
  const template = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
  const mapId = ((0xa7 << 20) | serial) >>> 0;
  const loc = { name: `Walled ${serial}`, mapTableData: { mapId, longitude: px * 128, latitude: (499 - py) * 128 }, exterior: { exteriorData: { width: 3, height: 3, blockNames: [townWallBlockName(mapId), ...template.slice(1).map((n) => (n === 'H.RMB' ? n : TOWN_OUTLINE_BLOCK))] } }, outline: { kept: 1, left: 8, walled: true } };
  return { loc, template, served: (n) => served[n] ?? null, rmbOf: (n) => served[n]?.rmbBlock ?? null, mapId };
}
const gatesOf = (wall) => wall.pieces.filter((p) => p.model === WALL_MODELS.gate);

test('ROAD-FOLLOW a city\'s wall on its roads: roads east and west stand its gates east and west, where the template\'s stood north and south - a marker outside each; a pixel with no arm reaching its wall, and no reader, the template\'s as before (mutants: the paths unread; the template\'s kept beside them)', () => {
  const c = walledCity(600101, 300, 200);
  const before = townWall(c.loc, c.template, c.rmbOf);
  assert.equal(gatesOf(before).length, 2);
  assert.ok(gatesOf(before).every((g) => Math.abs(g.at[0] - 153.6) < 13), 'north and south (the template\'s, at x 153.6)');
  const wall = townWall(c.loc, c.template, c.rmbOf, { roads: DIR.E | DIR.W, tracks: 0, curved: false });
  const gp = gatesOf(wall);
  assert.equal(gp.length, 2);
  for (const g of gp.map(gateOpening)) assert.ok(Math.abs(g.at[1] - 153.6) < 0.5 && Math.abs(Math.abs(g.at[0] - 153.6) - Math.abs(wall.line.reduce((m, q) => Math.max(m, q[0]), 0) - 153.6)) < 3, `a gate where a road comes in: ${g.at.map((v) => v.toFixed(1))}`);
  assert.equal(wall.markers.length, 2, 'a start marker outside each');
  assert.deepEqual(gatesOf(townWall(c.loc, c.template, c.rmbOf, { roads: 0, tracks: 0, curved: false })).map((g) => g.at), gatesOf(before).map((g) => g.at), 'no road: the template\'s');
});

test('ROAD-FOLLOW a wall waits for its roads: while the reader says its pixel\'s roads are not known, none made - the carrier provisional (open ground, no model, no marker) and never kept, no cells, no gates, no model registered; when they are, the next read makes it with their gates, and its pixel is told to be built again once (mutants: the waiting wall kept; the provisional carrier kept; the model built off nothing; the pixel never told)', () => {
  const c = walledCity(600102, 310, 210);
  let known = false;
  setTownWallPaths((px, py) => (px === 310 && py === 210 ? (known ? { roads: DIR.E | DIR.W, tracks: 0, curved: false } : null) : { roads: 0, tracks: 0, curved: false }));
  try {
    assert.equal(standTownWall(c.loc, c.template, c.served, townOutlineBlockJson), null, 'not stood yet');
    const name = townWallBlockName(c.mapId);
    const first = getDFBlockReplacementData(null, name);
    assert.equal(first.rmbBlock.misc3dObjectRecords.length, 0, 'no model on the carrier');
    assert.equal(first.rmbBlock.miscFlatObjectRecords.length, 0, 'no marker');
    assert.equal(townWallCellsOf(c.loc), null);
    assert.equal(townWallGatesOf(c.loc), null);
    assert.equal(townWallWaits(c.loc), true);
    assert.equal(hasCustomModel(townWallModelId(c.mapId)), false, 'no model registered off a wall still waiting');
    assert.equal(townWallReadyAt(310, 210), false, 'its roads not known: not yet');
    known = true;
    assert.equal(townWallWaits(c.loc), false);
    assert.equal(townWallReadyAt(310, 210), true, 'its pixel, built with the provisional carrier, built again');
    assert.equal(townWallReadyAt(310, 210), false, 'once');
    const second = getDFBlockReplacementData(null, name);
    assert.notEqual(second, first, 'the provisional carrier was never kept');
    assert.deepEqual(second.rmbBlock.misc3dObjectRecords.map((m) => m.modelIdNum), [townWallModelId(c.mapId)]);
    assert.equal(second.rmbBlock.miscFlatObjectRecords.filter((f) => f.textureArchive === 199).length, 2, 'its two gates\' markers');
    assert.equal(getDFBlockReplacementData(null, name), second, 'kept once made');
    const gates = townWallGatesOf(c.loc);
    assert.ok(gates.every((g) => Math.abs(g.at[1] - 153.6) < 0.5), 'east and west, on its roads');
    assert.ok(hasCustomModel(townWallModelId(c.mapId)), 'its model registered with it');
    // a wall made before its carrier was ever laid owes no build: the carrier laid with it
    const d = walledCity(600103, 311, 211);
    known = false;
    setTownWallPaths((px, py) => (known ? { roads: DIR.N, tracks: 0, curved: false } : null));
    standTownWall(d.loc, d.template, d.served, townOutlineBlockJson);
    assert.equal(townWallCellsOf(d.loc), null, 'waiting');
    known = true;
    assert.ok(townWallCellsOf(d.loc), 'made by its town map\'s ask');
    assert.equal(townWallReadyAt(311, 211), false, 'no carrier laid provisional: no build owed');
  } finally { setTownWallPaths(null); }
});

test('ROAD-FOLLOW the door keeps no provisional block: a port block its maker marks provisional is built at every read until it is not (mutant: kept)', () => {
  let n = 0, final = false;
  registerPortBlock('ROADFOLW.RMB', () => { n++; const j = townOutlineBlockJson(); j.Name = 'ROADFOLW.RMB'; if (!final) j.Provisional = true; return j; }, 1999001);
  getDFBlockReplacementData(null, 'ROADFOLW.RMB'); getDFBlockReplacementData(null, 'ROADFOLW.RMB');
  assert.equal(n, 2);
  final = true;
  const b = getDFBlockReplacementData(null, 'ROADFOLW.RMB');
  assert.equal(getDFBlockReplacementData(null, 'ROADFOLW.RMB'), b);
  assert.equal(n, 3);
});

test('ROAD-FOLLOW the host\'s reader: on the Bay the network\'s bytes and a crossing\'s join, none known until the network lands; past the Bay the layer\'s once its regions have landed, drawn as curves (mutants: the Bay\'s join unread; the regions unasked; the curves on the Bay)', () => {
  let net = null, landed = false;
  const roads = new Uint8Array(500000), tracks = new Uint8Array(500000);
  roads[200 * 1000 + 300] = DIR.N | DIR.S; tracks[200 * 1000 + 300] = DIR.E;
  const layer = new Map([[beyondKey(1500, 300), DIR.W | DIR.NE]]);
  const r = townWallPathsReader({ bay: () => net, landedIn: () => landed, byte: (kind, x, y) => (kind === 'roads' ? layer.get(beyondKey(x, y)) ?? 0 : 0), join: (x, y) => (x === 300 && y === 200 ? DIR.W : 0) });
  assert.equal(r(300, 200), null, 'the network still to land');
  net = { roads, tracks };
  assert.deepEqual(r(300, 200), { roads: DIR.N | DIR.S | DIR.W, tracks: DIR.E, curved: false });
  assert.equal(r(1500, 300), null, 'its region still to land');
  landed = true;
  assert.deepEqual(r(1500, 300), { roads: DIR.W | DIR.NE, tracks: 0, curved: true });
});

test('ROAD-FOLLOW the wiring: the places host hands the walls its reader (the Bay\'s network, the roads host\'s regions; none where it paints no roads), a region landing builds again the pixel of a wall that waited, and a waiting walled town plans no streets (the source)', () => {
  assert.match(rd('src/scenes/tamrielPlacesHost.js'), /setTownWallPaths\(terrainGen \? townWallPathsReader\(\{ bay: \(\) => terrainGen\.roads\(\), landedIn: _tamrielRoads \? \(x0, y0, x1, y1\) => _tamrielRoads\.landedIn\(x0, y0, x1, y1\) : null \}\) : null\);/);
  assert.match(rd('src/scenes/tamrielSweepsHost.js'), /\|\| townWallReadyAt\(p\.px, p\.py\);/);
  assert.match(rd('src/world/urban/townFabricStand.js'), /if \(dfLocation\.outline\?\.walled && townWallWaits\(dfLocation\)\) return null;/);
});

// ── THE CAPITALS: THE ROAD ON FROM THE SPAN'S EDGE TO THE GATE ──

/** The arm's end of a capital's gate pixel - the middle of its side facing the span - in the plan's metres (x east, z south
 *  of the anchor): the pixel's own column or row, measured from the span's first. */
const armEnd = (cap, D, at, g) => {
  const B = BLOCK_M, sx = g.x - (at.px - D.mx), sy = g.y - (at.py - D.my);
  if (g.side === 'N') return [(8 * sx + 4 - cap.anchor[0]) * B, -cap.anchor[1] * B];
  if (g.side === 'S') return [(8 * sx + 4 - cap.anchor[0]) * B, (8 * D.h - cap.anchor[1]) * B];
  if (g.side === 'W') return [-cap.anchor[0] * B, (8 * sy + 4 - cap.anchor[1]) * B];
  return [(8 * D.w - cap.anchor[0]) * B, (8 * sy + 4 - cap.anchor[1]) * B];
};
/** Whether the way from `a` to `b` (the plan's metres) keeps to a capital's approach, a metre at a time - its last metre at
 *  the gate aside (the wall's own opening). */
const keepsTo = (on, a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0.5; s < L - 1; s += 1) if (!on(a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L)) return false; return true; };

test('ROAD-FOLLOW a capital\'s gates: each walled capital\'s plan names the middle of each road gate\'s opening, off the measures its wall is cut at (Mournhold\'s sides\' middles, Alinor\'s and Torval\'s north gate on its lane and their sides\' middles, Helstrom\'s on the anchor\'s line, Solitude\'s main gate, the Imperial City\'s Talos Bridge landing); Falinesti, no wall, none', () => {
  const by = Object.fromEntries(CAPITALS.map((c) => [c.key, c.gateAt ?? null]));
  assert.deepEqual(by.mournhold, { N: [0, -330], E: [330, 0], S: [0, 330], W: [-330, 0] });
  assert.deepEqual(by.alinor, { N: [158, -124.4], E: [329.2, (466 - 124.4) / 2], W: [-329.2, (466 - 124.4) / 2] });
  assert.deepEqual(by.torval, { N: [160, -226.8], E: [329.2, (364 - 226.8) / 2], W: [-329.2, (364 - 226.8) / 2] });
  assert.deepEqual(by.helstrom, { N: [0, -224.8], S: [0, 429.6] });
  assert.deepEqual(by.solitude, { S: [318.4, 416] });
  assert.deepEqual(by['imperial-city'].W.map(Math.round), [-10040, 0]);
  assert.equal(by.falinesti, null);
  for (const c of CAPITALS) if (c.gateAt) assert.deepEqual(Object.keys(c.gateAt).sort(), [...c.gates].sort(), `${c.key}: a gate each road side`);
  // the walls are cut at the same measures
  assert.match(rd('src/world/capitalAlinor.js'), /brokenRun\(mb, ne, nw, W, \[\[W\.east - W\.northGate, W\.gate, W\.gateH\]\]\);/);
  assert.match(rd('src/world/capitalTorval.js'), /gatedRun\(mb, SAND, ne, nw, W\.thick, W\.h, W\.east - W\.northGate, W\.gate, W\.gateH\);/);
  assert.match(rd('src/world/capitalSolitude.js'), /gatedRun\(mb, NORD, sw, stepS, W\.thick, W\.h, W\.southGate - W\.west, W\.gate, W\.gateH\);/);   // PIN MOVED (SOLITUDE-RELIEF): its south run to the terraces' step tower
});

test('ROAD-FOLLOW a capital\'s approaches: the road on from the gate pixel\'s arm - its end the middle of the pixel\'s side - to the plan\'s gate, two tiles of the road\'s own surface: straight in to a gate on its line, in to APPROACH_SKIRT short of the wall, along it and in to a gate off it; every metre of the way on it, over gardens and open ground alone (mutants: the arrival\'s slice, the skirt, the gate\'s depth, the side\'s frame)', () => {
  assert.equal(APPROACH_TILE, TILE.road);
  assert.deepEqual([APPROACH_HALF, APPROACH_SKIRT], [BLOCK_M / 16, 3 * BLOCK_M / 16]);
  let walled = 0;
  CAPITALS.forEach((cap, k) => {
    const D = capitalDims(cap), on = onCapitalApproach(cap, D), at = capitalCentrePixel(k);
    assert.ok(at, cap.key);
    for (const g of capitalGates(k, { walkable: () => true })) {
      const end = armEnd(cap, D, at, g);
      assert.deepEqual(capitalArrival(cap, D, g.side), end, `${cap.key} ${g.side}: the approach begins where the road's arm ends`);
      const gate = cap.gateAt?.[g.side];
      if (!gate) { assert.equal(on(end[0] + 1, end[1] + 1), false, `${cap.key}: no wall, no approach`); continue; }
      walled++;
      const lat = g.side === 'N' || g.side === 'S' ? 0 : 1, n = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[g.side];
      const depth = Math.abs(gate[1 - lat] - end[1 - lat]);
      assert.ok(depth > 70.4, `${cap.key} ${g.side}: its gate past the rim (${depth} m in)`);
      // the way: straight in, or in to the skirt, along the wall and in
      const T = BLOCK_M / 16, ug = Math.round(gate[lat] / T) * T;
      const turn = [end[0] + n[0] * (depth - APPROACH_SKIRT), end[1] + n[1] * (depth - APPROACH_SKIRT)];
      const pts = Math.abs(ug - end[lat]) < T ? [end, gate] : [end, turn, lat === 0 ? [ug, turn[1]] : [turn[0], ug], lat === 0 ? [ug, gate[1]] : [gate[0], ug]];
      assert.ok(!on(end[0] - n[0] * 3, end[1] - n[1] * 3), `${cap.key} ${g.side}: none past the span's edge`);
      // PIN MOVED (SOLITUDE-RELIEF): a capital on its own line (`approach`, Solitude's Gate Road up its slope) - from the arm's
      // end to its gate; test/world/solitude_relief.test.js walks the line
      if (cap.approach) { assert.ok(on(end[0] + n[0], end[1] + n[1]) && on(gate[0], gate[1]), `${cap.key} ${g.side}: its own line, end to gate`); continue; }
      for (let i = 1; i < pts.length; i++) assert.ok(keepsTo(on, pts[i - 1], pts[i]), `${cap.key} ${g.side}: the way from ${pts[i - 1]} to ${pts[i]}`);
      assert.ok(!on(end[0] + n[0] * 30 + (lat === 0 ? 3 * T : 0), end[1] + n[1] * 30 + (lat === 1 ? 3 * T : 0)), `${cap.key} ${g.side}: two tiles wide`);
    }
    // the cells it crosses: gardens, and the open ground past the Imperial City's lake - never its water, never a block of its own
    for (const [r, c] of capitalApproachCells(cap, D)) assert.ok(['G', 'O'].includes(planCell(cap, r, c)), `${cap.key}: cell ${r},${c} ${planCell(cap, r, c)}`);
  });
  assert.equal(walled, 14, 'every walled capital\'s road gates (Falinesti\'s four no wall\'s)');
  // the gate's slice: the one along its side its plan's gate stands in, the capital's own where its plan names none - and
  // the roads' gate pixel stood off it
  const wide = { anchor: [100, 100], gateAt: { N: [3000, -10240], W: [-10240, -4000] } }, D25 = { w: 25, h: 25, mx: 12, my: 12 };
  assert.deepEqual([capitalGateSlice(wide, D25, 'N'), capitalGateSlice(wide, D25, 'W'), capitalGateSlice(wide, D25, 'E')], [16, 7, 12]);
  assert.match(rd('src/world/tamrielCapitals.js'), /const \[dx, dy\] = GATE_STEPS\[side\], sl = capitalGateSlice\(cap, D, side\);\n {4}const base = \[at\.px \+ \(dx > 0 \? D\.w - D\.mx : dx < 0 \? -D\.mx - 1 : sl - D\.mx\), at\.py \+ \(dy > 0 \? D\.h - D\.my : dy < 0 \? -D\.my - 1 : sl - D\.my\)\];/);
});

test('ROAD-FOLLOW a capital lays its approaches: in its gardens over its rim too (the rim\'s no ground beside it, no tree on the road), the open ground the Imperial City\'s crosses a block of its own (the shared open cell elsewhere), its index past every block before it (mutants: the rim over the road; a tree on it; the shared open cell kept; the open block unregistered)', () => {
  const blocks = capitalPortBlocks(), byName = new Map(blocks.map((b) => [b.name, b]));
  const tiles = (json) => json.RmbBlock.FldHeader.GroundData.GroundTiles.map((t) => t.TileBitfield);
  const trees = (json) => json.RmbBlock.FldHeader.GroundData.GroundScenery.map((t) => t.TextureRecord);
  // Mournhold's north gate: the garden cell east of its middle line, the north row - its west column the road 79.6 m in
  const mh = CAPITALS.find((c) => c.key === 'mournhold'), cell = byName.get(capitalGardenName(mh, 4, 0)).json;
  const north = tiles(cell), road = north.map((t, i) => [t, i]).filter(([t]) => t === TILE.road).map(([, i]) => i);
  assert.equal(road.length, 12, 'twelve tiles in, rim and all');
  assert.ok(road.every((i) => i % 16 === 0 && i < 12 * 16), 'the column by the middle line, from the north edge');
  assert.ok(north.some((t) => t === CAPITAL_NO_GROUND), 'the rim\'s no ground beside it');
  assert.ok(trees(cell).every((t, i) => !road.includes(i) || t === -1), 'no tree on the road');
  // ...and none on any capital's approach anywhere - its gardens' trees off every tile of the road, rim or none
  let onRoad = 0, roadTiles = 0, gardenTrees = 0;
  for (const b of blocks) {
    const tl = tiles(b.json), tr = trees(b.json);
    tl.forEach((t, i) => { if (t === TILE.road) { roadTiles++; if (tr[i] !== -1) onRoad++; } if (tr[i] !== -1) gardenTrees++; });
  }
  assert.ok(roadTiles > 500 && gardenTrees > 1000, `the approaches' road (${roadTiles} tiles) among the gardens' trees (${gardenTrees})`);
  assert.equal(onRoad, 0, 'no tree on any approach');
  // the Imperial City's west approach over the open ground past its lake: blocks of its own, the shared one elsewhere
  const ic = CAPITALS[0], cells = capitalApproachCells(ic, capitalDims(ic));
  assert.deepEqual(cells.map(([r, c]) => `${r},${c}`).sort(), ['100,0', '100,1', '99,0', '99,1']);
  const before = Math.max(...blocks.filter((q) => !q.name.startsWith('TESP')).map((q) => q.index));
  for (const [r, c] of cells) {
    const b = byName.get(capitalApproachName(ic, c, r));
    assert.ok(b && b.index > before, `${r},${c}: registered, past every block before it`);
    const t = tiles(b.json);
    assert.equal(t.filter((v) => v === TILE.road).length, c === 0 ? 16 : 15, `${r},${c}: its row of the road's two, to the bridge's landing`);
    assert.ok(t.every((v) => v === TILE.road || v === CAPITAL_NO_GROUND), 'the land\'s own ground about it');
  }
  const names = capitalBlockNames(ic.slicePlan(12 * IMPERIAL_SPAN), 0, new Map([['RESI', ['R.RMB']], ['GENR', ['G.RMB']]]), undefined, [0, 96]);
  assert.ok(names.includes(capitalApproachName(ic, 0, 100)) && names.includes(capitalApproachName(ic, 1, 99)), 'the approach\'s own blocks in its slice');
  assert.ok(names.includes(TOWN_OUTLINE_BLOCK), 'the shared open cell beside them');
});
