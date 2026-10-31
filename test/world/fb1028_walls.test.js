// FB1028 (Discord #bug-reports, after #1184, "Daggerfall City Walls are Janky"; bible/03-World/Town-Shapes.md FB1028):
//  - DOORS IN WALLS: Daggerfall's wall pieces carry doors (445 one, 446 two) into the ring blocks' Town23 interiors; a wall
//    on its outline opens into none, and at a bend each length's door stood in its tower. Laid in the face's own stone.
//  - PARTS CLIPPING INTO ITSELF: at a bend two lengths ran on through each other and out of the tower's faces. Each is cut
//    on the tower's middle line, and the tower grown across to hold the cut and stand out of the wall.
//  - ROADS TO NOWHERE: the painter's arms ran on into the wall where GATE-ROADS slid the gate away, and the town's own
//    streets ran into it where no gate stood. A Bay wall's ground takes the arms up and joins them to a gate; a street gets
//    a gate of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { townWalkShut, townWallYardCellsOf, wallDoorless, townWallModel, mitrePlanes, wallPieces, streetGates, townWallCells, standTownWall, setTownWallPaths, townWallPathsReader, townWall, townWallBlockName, gateOpening, WALL_MODELS, TOWN_WALL, TOWER_PROUD, GATE_ARMS_MERGE, GATE_OPENING } from '../../src/world/townWalls.js';
import { layGateRoads, takeUpArms, GATE_BLOCK } from '../../src/world/road/gateRoads.js';
import { townGateRoads } from '../../src/world/townGates.js';
import { TOWN_OUTLINE_BLOCK, townOutlineBlockJson } from '../../src/world/townOutline.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import * as walls from '../../src/world/townWalls.js';   // AUDIT FB1028
import * as ys from '../../src/world/merchantYards/merchantYardSites.js';   // AUDIT FB1028 B5
import { stepsBreathing } from '../../src/world/puddleMask.js';
import { yardRoads } from '../../src/world/road/gateRoads.js';
import { hostText } from '../hostText.mjs';
import { ringAsWas } from '../../src/world/terrain/terrainGen.js';   // FB1028 YARDS Y2
import { townRoadRing, townGroundMask } from '../../src/world/terrain/terrainTiles.js';
import { townGroundMaskBefore } from '../../src/world/terrain/townBlendBefore.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { bayRoads } from '../bayRoads.mjs';   // OWN-WORK2

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const D = 128;

/** Faces to dfMeshToModel's shape: a submesh a picture, its faces in the order given; `uv(p)` a corner's UV. */
function modelOf(faces) {
  const byTex = new Map();
  for (const f of faces) { const k = f.tex.join('/'); if (!byTex.has(k)) byTex.set(k, []); byTex.get(k).push(f); }
  const positions = [], normals = [], uvs = [], subMeshes = [];
  for (const [k, fs] of byTex) {
    const startIndex = positions.length / 3;
    for (const f of fs) for (const i of [0, 1, 2, 0, 2, 3]) { positions.push(...f.q[i]); normals.push(...f.n); uvs.push(...f.uv(f.q[i])); }
    const [a, r] = k.split('/').map(Number);
    subMeshes.push({ textureArchive: a, textureRecord: r, startIndex, primitiveCount: fs.length * 2 });
  }
  const n = positions.length / 3;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: Uint32Array.from({ length: n }, (_, i) => i), subMeshes, doors: [{ type: 1 }] };
}
const stone = (p) => [p[0] / 2.56, -p[1] / 2.56];
/** A length of wall's inner face (z -4.8) cut round a door (x -11.8 to -10.55, to 2.25 m) as 445's is, and its floor - the
 *  floor first, its quads sharing the door's foot corners - in pictures of their own. */
function doorLength() {
  const z = -4.8, n = [0, 0, -1], q = (x0, y0, x1, y1, tex = [317, 0], uv = stone) => ({ q: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], n, tex, uv });
  return modelOf([
    ...[[-12.8, -11.8], [-11.8, -10.55], [-10.55, 12.8]].map(([x0, x1]) => ({ q: [[x0, 0, -4.8], [x1, 0, -4.8], [x1, 0, 4.8], [x0, 0, 4.8]], n: [0, 1, 0], tex: [121, 1], uv: (p) => [p[0] / 7, p[2] / 3] })),
    q(-12.8, 0, -11.8, 10.85), q(-10.55, 0, 12.8, 10.85), q(-11.8, 2.25, -10.55, 10.85),
    q(-11.8, 0, -10.55, 2.25, [74, 2], (p) => [p[0] > -11 ? 1 : 0, p[1] > 1 ? 0 : 1]),
  ]);
}
/** A model's triangles, each its corners and their UVs, with its picture. */
function trianglesOf(m) {
  const out = [];
  for (const s of m.subMeshes) for (let t = 0; t < s.primitiveCount; t++) {
    const v = [0, 1, 2].map((k) => m.indices[s.startIndex + t * 3 + k]);
    out.push({ tex: [s.textureArchive, s.textureRecord], p: v.map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]), uv: v.map((i) => [m.uvs[i * 2], m.uvs[i * 2 + 1]]) });
  }
  return out;
}

test('FB1028 DOORS: a length\'s door laid in its face\'s own stone - no door picture left, the door\'s triangles in the face\'s submesh with the face\'s UV law (not the floor\'s that shares its foot), nothing more or less; a model with no door itself, once a model (mutants: the door kept; its own UVs kept; any face that shares a corner)', () => {
  const m = doorLength(), d = wallDoorless(m);
  assert.equal(wallDoorless(m), d, 'once a model');
  assert.ok(!d.subMeshes.some((s) => s.textureArchive === 74), 'no door picture');
  const before = trianglesOf(m), after = trianglesOf(d);
  assert.equal(after.length, before.length, 'every triangle kept');
  const door = after.filter((t) => t.p.every((p) => Math.abs(p[2] + 4.8) < 1e-5 && p[0] >= -11.8001 && p[0] <= -10.5499 && p[1] <= 2.2501));
  assert.equal(door.length, 2, 'the door\'s two triangles');
  for (const t of door) {
    assert.deepEqual(t.tex, [317, 0], 'in the face\'s picture');
    t.p.forEach((p, k) => assert.ok(Math.abs(t.uv[k][0] - p[0] / 2.56) < 1e-5 && Math.abs(t.uv[k][1] + p[1] / 2.56) < 1e-5, `the face's UV at (${p})`));
  }
  assert.deepEqual(d.doors, [], 'and no door left to open');
  const plain = modelOf([{ q: [[-12.8, 0, 4.8], [12.8, 0, 4.8], [12.8, 8, 4.8], [-12.8, 8, 4.8]], n: [0, 0, 1], tex: [317, 0], uv: stone }]);
  assert.equal(wallDoorless(plain), plain, 'a model with no door as it is');
  // the wall's model lays its lengths doorless, and a tower's as TS8 made it
  const len = townWallModel([{ model: WALL_MODELS.wall, at: [100, 50], out: [0, 1], stretch: 1 }], () => m);
  assert.ok(!len.subMeshes.some((s) => s.textureArchive === 74), 'the wall\'s model has none');
  const tower = townWallModel([{ model: WALL_MODELS.tower, at: [100, 50], out: [0, 1], stretch: 1 }], () => m);   // a tower not 444's measure stands as it is (bendTower)
  assert.ok(!tower.subMeshes.some((s) => s.textureArchive === 74), 'nor a tower\'s');
});

/** A plain length (a closed box of the wall's measure but its ends, as 445's) and a tower's body (9.6 m square). */
const box = (hx, hz, y, tex) => modelOf([
  { q: [[-hx, 0, hz], [hx, 0, hz], [hx, y, hz], [-hx, y, hz]], n: [0, 0, 1], tex, uv: stone },
  { q: [[hx, 0, -hz], [-hx, 0, -hz], [-hx, y, -hz], [hx, y, -hz]], n: [0, 0, -1], tex, uv: stone },
  { q: [[-hx, y, -hz], [-hx, y, hz], [hx, y, hz], [hx, y, -hz]], n: [0, 1, 0], tex, uv: stone },
]);
const LENGTH = box(12.8, 4.8, 10.85, [317, 0]);
const BODY = box(4.8, 4.8, 14, [317, 1]);
/** A piece's triangles in the wall's model of `pieces`: those of the model with it and not of the model without it. */
function pieceTriangles(pieces, p, classic) {
  const key = (t) => t.p.map((q) => q.map((v) => v.toFixed(3)).join(',')).join('|');
  const others = new Set(trianglesOf(townWallModel(pieces.filter((q) => q !== p), classic)).map(key));
  return trianglesOf(townWallModel(pieces, classic)).filter((t) => !others.has(key(t)));
}

test('FB1028 BENDS: two lengths meeting at a bend each cut on its tower\'s middle line - nothing of either past it - and the tower grown across to hold the cut and stand TOWER_PROUD out of the wall, along as it was; a straight run\'s tower TOWER_PROUD out; its cells as wide (mutants: the cut unmade; the cut the wrong side; the tower ungrown; grown along; its cells unwidened)', () => {
  const classic = (id) => (id === WALL_MODELS.tower ? BODY : LENGTH);
  // a line with a 40-degree bend: two straight runs meeting at (0, 0)
  const turn = (40 * Math.PI) / 180, A = { model: WALL_MODELS.wall, at: [-12.8, 0], out: [0, -1], stretch: 1 }, d = [Math.cos(turn), Math.sin(turn)];
  const B = { model: WALL_MODELS.wall, at: [12.8 * d[0], 12.8 * d[1]], out: [d[1], -d[0]], stretch: 1 };
  const nx = A.out[0] + B.out[0], ny = A.out[1] + B.out[1], l = Math.hypot(nx, ny), half = (nx * B.out[0] + ny * B.out[1]) / l;
  const T = { model: WALL_MODELS.tower, at: [0, 0], out: [nx / l, ny / l], stretch: 1, thick: (4.8 / half + TOWER_PROUD) / 4.8 };
  const pieces = [A, T, B];
  assert.equal(TOWER_PROUD, 0.1, 'out of the wall\'s plane, and under what stops a body sliding along it (0.35 m)');
  for (const p of [A, B]) {
    const [pl] = mitrePlanes(p, [T]);
    assert.ok(pl, 'a plane at its tower');
    const tris = pieceTriangles(pieces, p, classic);
    assert.ok(tris.length >= 6, 'the length stands');
    const over = Math.max(...tris.flatMap((t) => t.p.map((q) => -((q[0] - pl.at[0]) * pl.n[0] + (q[2] - pl.at[1]) * pl.n[1]))));
    assert.ok(over < 1e-4, `nothing of it past its tower's middle line (${over.toFixed(3)} m)`);
    const far = Math.max(...tris.flatMap((t) => t.p.map((q) => (q[0] - pl.at[0]) * pl.n[0] + (q[2] - pl.at[1]) * pl.n[1])));
    assert.ok(far > 20, 'and its own side whole');
  }
  // the tower: across 4.8 / cos(half the turn) + TOWER_PROUD, along 4.8
  const tower = trianglesOf(townWallModel([T], classic)).flatMap((t) => t.p), u = [T.out[1], -T.out[0]];   // a tower is never cut
  const across = Math.max(...tower.map((q) => Math.abs(q[0] * T.out[0] + q[2] * T.out[1]))), along = Math.max(...tower.map((q) => Math.abs(q[0] * u[0] + q[2] * u[1])));
  assert.ok(Math.abs(across - (4.8 / Math.cos(turn / 2) + TOWER_PROUD)) < 1e-4 && Math.abs(along - 4.8) < 1e-4, `the tower ${across.toFixed(3)} across, ${along.toFixed(3)} along`);
  // wallPieces stands the bend's tower so, a straight run's TOWER_PROUD out of its wall
  const ring = Array.from({ length: 4 }, (_, k) => /** @type {[number, number]} */ ([200 + 100 * Math.cos((k * Math.PI) / 2 + 0.3), 200 + 100 * Math.sin((k * Math.PI) / 2 + 0.3)]));
  const square = wallPieces(ring, [200, 200], [], { piece: TOWN_WALL.piece });
  const towers = square.filter((p) => p.model === WALL_MODELS.tower), runs = square.filter((p) => p.model !== WALL_MODELS.tower);
  for (const t of towers) {
    const legs = runs.filter((r) => mitrePlanes(r, [t]).length);
    const want = legs.length === 2 ? (4.8 / ((legs[0].out[0] * t.out[0] + legs[0].out[1] * t.out[1])) + TOWER_PROUD) / 4.8 : null;
    if (want) assert.ok(Math.abs(t.thick - want) < 1e-9, `a tower's thick ${t.thick} for its bend (${want})`);
  }
  assert.ok(towers.some((t) => t.thick > 1.05) && towers.some((t) => Math.abs(t.thick - (4.8 + TOWER_PROUD) / 4.8) < 1e-6), 'the corners grown, the straight runs\' towers TOWER_PROUD out');
  // its cells: the tower's square as wide across
  const cells = townWallCells({ pieces: [{ model: WALL_MODELS.tower, at: [51.2, 51.2], out: [0, 1], stretch: 1, thick: 1.25 }] }, 1, 1);
  assert.equal(cells.reduce((a, v) => a + v, 0), 6 * 8, 'six cells along by eight across: 9.6 m by 12');
});

// ── ROADS ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A pixel with a square wall (hard tiles on x or y = 40 or 88, between them), the town's ground x and y 30-98, the
 *  inside 41-87, a gate in the west wall at y 70.5 facing west, the painter's ring round the ground (x or y 28-29 and
 *  99-100) and its arms: `arms` rows [y, tile] painted from x 0 to 63. */
function walledPixel(arms, { ring = true } = {}) {
  const tilemap = new Uint8Array(D * D), paths = new Uint8Array(D * D), tileData = new Uint8Array(129 * 129).fill(2), blocked = new Uint8Array(D * D);
  const ground = new Uint8Array(D * D), inside = new Uint8Array(D * D);
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const i = x + y * D;
    if (x >= 30 && x <= 98 && y >= 30 && y <= 98) ground[i] = 1;
    if (x > 40 && x < 88 && y > 40 && y < 88) inside[i] = 1;
    if ((x === 40 || x === 88) && y >= 40 && y <= 88) blocked[i] = GATE_BLOCK.hard;
    if ((y === 40 || y === 88) && x >= 40 && x <= 88) blocked[i] = GATE_BLOCK.hard;
    const onRing = (x === 28 || x === 29 || x === 99 || x === 100) && y >= 28 && y <= 100 || (y === 28 || y === 29 || y === 99 || y === 100) && x >= 28 && x <= 100;
    if (ring && onRing) { tilemap[i] = 46; paths[i] = 1; }
  }
  for (const [y, t] of arms) for (let x = 0; x < 64; x++) if (!tilemap[x + y * D]) { tilemap[x + y * D] = t; paths[x + y * D] = 1; }   // under the wall too: its tiles unstamped
  for (let x = 41; x < 88; x++) tilemap[x + 70 * D] ||= 46;   // the town's street the gate opens onto
  return { tilemap, paths, tileData, town: { gates: [{ x: 40.5, y: 70.5, ox: -1, oy: 0, half: GATE_OPENING.half / 6.4 }], blocked, inside }, ground };
}
const joins = (g, from, to) => {
  const road = (i) => !!g.paths[i] || [46, 47, 55].includes(g.tilemap[i] & 0x3f);
  const seen = new Set([from]), stack = [from];
  while (stack.length) { const i = stack.pop(); if (i === to) return true; const x = i % D, y = (i - x) / D; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = x + dx + (y + dy) * D; if (x + dx >= 0 && y + dy >= 0 && x + dx < D && y + dy < D && !seen.has(j) && road(j)) { seen.add(j); stack.push(j); } } }
  return false;
};

test('FB1028 ROADS the take-up: on a Bay wall\'s ground the painter\'s arm is taken up - outside the wall, under it, and its stub inside joined to them - and kept as the painter laid it off the ground; a river\'s tile and the town\'s paving kept; the gate\'s road laid on to the ring (mutants: no take-up; the ground unread; the stub left; a river taken)', () => {
  const g = walledPixel([[64, 46]]);
  g.tilemap[35 + 50 * D] = 21; g.paths[35 + 50 * D] = 1;   // a river's bank tile on the ground
  const off = Array.from({ length: 28 }, (_, x) => [g.tilemap[x + 64 * D], g.paths[x + 64 * D]]);
  assert.equal(layGateRoads(g.tilemap, g.paths, g.tileData, g.town, g.ground), 1, 'the gate laid');
  for (let x = 30; x < 64; x++) assert.deepEqual([g.tilemap[x + 64 * D], g.paths[x + 64 * D]], [0, 0], `the arm taken up at (${x}, 64)`);
  assert.deepEqual(Array.from({ length: 28 }, (_, x) => [g.tilemap[x + 64 * D], g.paths[x + 64 * D]]), off, 'off the ground, the painter\'s to the byte');
  assert.deepEqual([g.tilemap[35 + 50 * D], g.paths[35 + 50 * D]], [21, 1], 'the river\'s tile kept');
  for (let x = 41; x < 88; x++) assert.equal(g.tilemap[x + 70 * D], 46, 'the town\'s street kept');
  assert.ok(joins(g, 40 + 70 * D, 0 + 64 * D), 'the gate joined to the arm off the ground, by the ring');
  // the take-up alone, and a town handing no inside (a ring kept, a wall past the Bay): nothing taken
  const h = walledPixel([[64, 46]]), was = Uint8Array.from(h.tilemap);
  layGateRoads(h.tilemap, h.paths, h.tileData, { ...h.town, inside: undefined }, h.ground);
  assert.equal(h.tilemap[39 + 64 * D], was[39 + 64 * D], 'no inside handed: the arm kept');
  const k = walledPixel([[64, 46]]), cut = takeUpArms(k.tilemap, k.paths, k.town.inside, k.ground);
  assert.equal(cut.reduce((a, v) => a + v, 0), 34, 'x 30-63 on row 64: on the ground, under the wall and inside it');
});

test('FB1028 ROADS each arm joined to a gate: a pixel with tracks and no ring - the gate\'s road reaches one track\'s cut end, and the other\'s is joined to it; every arm reaching the ground meets the gate (mutant: the arms unjoined)', () => {
  const g = walledPixel([[64, 11], [50, 11]], { ring: false });
  layGateRoads(g.tilemap, g.paths, g.tileData, g.town, g.ground);
  for (const y of [64, 50]) assert.ok(joins(g, 0 + y * D, 40 + 70 * D), `the track on row ${y} meets the gate`);
});

test('FB1028 ROADS a street into the wall: each run of the line over the town\'s paving GATE_ARMS_MERGE or more along it from every gate is a gate\'s point, on the run\'s middle; one nearer a gate none (mutants: the gates\' distance unread; the paving unread; the run\'s middle its start)', () => {
  // a round line (radius 90 about (102.4, 102.4)) and a street two tiles wide running east out of the town across it
  const W = 32, H = 32, pts = Array.from({ length: 720 }, (_, i) => /** @type {[number, number]} */ ([102.4 + 90 * Math.cos((2 * Math.PI * i) / 720), 102.4 + 90 * Math.sin((2 * Math.PI * i) / 720)]));
  const streets = new Uint8Array(W * H);
  for (let tx = 16; tx < W; tx++) for (const ty of [15, 16]) streets[ty * W + tx] = 1;
  const town = { W, H, houses: new Uint8Array(W * 4 * H * 4), streets };
  const [g, ...more] = streetGates(pts, town, [[102.4, 12.4]]);
  assert.equal(more.length, 0, 'one street, one gate');
  assert.ok(Math.abs(g[1] - 102.4) < 1.6 && Math.abs(g[0] - 192.4) < 1, `on the street's middle (${g.map((v) => v.toFixed(1))})`);
  // a gate already within GATE_ARMS_MERGE along the line: none
  const near = [102.4 + 90 * Math.cos((GATE_ARMS_MERGE * 0.8) / 90), 102.4 + 90 * Math.sin((GATE_ARMS_MERGE * 0.8) / 90)];
  assert.deepEqual(streetGates(pts, town, [/** @type {[number, number]} */ (near)]), []);
  assert.deepEqual(streetGates(pts, { ...town, streets: new Uint8Array(W * H) }, []), [], 'no paving, no gate');
  // a city's wall stands it: a gate where the road comes in (no street within GATE_WAY.reach of it), and one on the street
  const { wall } = streetCity();
  assert.equal(wall.streetWays.length, 1, 'the street\'s gate');
  const [s] = wall.streetWays, open = wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map(gateOpening);
  assert.ok(Math.abs(s[0] - (102.4 + 8 * 6.4)) < 6.4 && s[1] < 102.4 + 6 * 6.4, `on the street, south (${s.map((v) => v.toFixed(1))})`);
  assert.ok(open.some((g) => Math.hypot(g.at[0] - s[0], g.at[1] - s[1]) < 1) && open.length === 2, 'a gate\'s opening on it, beside the road\'s');
});

/** A city's wall: a house in its middle block, a street running south out of it across the line, a road from the north. */
function streetCity(mapId = 7) {
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 40; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const groundTiles = Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (__, r) => ({ textureRecord: (tx === 7 || tx === 8) && r >= 10 ? 46 : 2 })));
  const middle = { fldHeader: { autoMapData: houses, groundData: { groundTiles } }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] };
  const names = [townWallBlockName(mapId), TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, 'H.RMB', TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK];
  const loc = { mapTableData: { mapId }, exterior: { exteriorData: { width: 3, height: 3, blockNames: names } }, outline: { walled: true, bay: true } };
  return { loc, wall: townWall(loc, names, (n) => (n === 'H.RMB' ? middle : null), { roads: DIR.N, tracks: 0, curved: false }) };
}

/** The synthetic walled city of GATE-ROADS' own pin (test/world/gateroads.test.js): a house filling its middle block. */
function walledCity(serial, px, bay) {
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const served = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } } };
  const template = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
  const mapId = ((0xa7 << 20) | serial) >>> 0;
  const loc = { mapTableData: { mapId, longitude: px * 128, latitude: (499 - 200) * 128 }, exterior: { exteriorData: { width: 3, height: 3, blockNames: [townWallBlockName(mapId), ...template.slice(1).map((n) => (n === 'H.RMB' ? n : TOWN_OUTLINE_BLOCK))] } }, outline: { kept: 1, left: 8, walled: true, ...(bay ? { bay: true } : {}) } };
  const maps = { getRmbBlockName: (l, bx, by) => l.exterior.exteriorData.blockNames[by * 3 + bx] };
  const blocks = { checkName: (n) => n, getBlockIndex: (n) => (served[n] ? 0 : -1), getBlock: () => served['H.RMB'] };
  return { loc, template, served, maps, blocks };
}

test('FB1028 ROADS the inside handed on: a Bay wall on its outline hands its tiles inside its inner face - its middle\'s, none under its cells or past its line; a wall past the Bay none (mutants: none handed; handed past the Bay; the wall\'s cells read as inside)', () => {
  try {
    setTownWallPaths(() => ({ roads: DIR.E | DIR.W, tracks: 0, curved: false }));
    const bay = walledCity(610101, 210, true), past = walledCity(610102, 211, false);
    const wall = standTownWall(bay.loc, bay.template, (n) => bay.served[n] ?? null, townOutlineBlockJson);
    standTownWall(past.loc, past.template, (n) => past.served[n] ?? null, townOutlineBlockJson);
    const gr = townGateRoads(bay.loc, bay.maps, bay.blocks);
    assert.ok(gr.inside instanceof Uint8Array, 'a Bay wall hands its inside');
    assert.equal(townGateRoads(past.loc, past.maps, past.blocks).inside, undefined, 'past the Bay none');
    assert.equal(gr.inside[(40 + 24) + (40 + 24) * D], 1, 'the middle inside');
    const cells = townWallCells(wall, 3, 3);
    let wallTiles = 0, outside = 0;
    for (let ty = 0; ty < D; ty++) for (let tx = 0; tx < D; tx++) {
      const cx = Math.floor((tx - 40 + 0.5) * 4), cy = Math.floor((ty - 40 + 0.5) * 4);
      if (cx >= 0 && cy >= 0 && cx < 192 && cy < 192 && cells[cy * 192 + cx]) { wallTiles++; assert.equal(gr.inside[tx + ty * D], 0, 'under the wall: not inside'); }
      if (tx < 40 || ty < 40 || tx >= 88 || ty >= 88) { outside++; assert.equal(gr.inside[tx + ty * D], 0, 'past the grid: outside'); }
    }
    assert.ok(wallTiles > 50 && outside > 1000);
    assert.deepEqual(wall.ways.length, wall.pieces.filter((p) => p.model === WALL_MODELS.gate).length, 'a gate a way');
    assert.ok(gateOpening(wall.pieces.find((p) => p.model === WALL_MODELS.gate)).at, 'gates stood');
  } finally { setTownWallPaths(null); }
});

// ── WITH ARENA2: the Bay's walled cities, the packs off (a town a home pins to Daggerfall's layout stands so online) ──
/** The freeware opened as the door serves it: BLOCKS.BSA, MAPS.BSA (the Arena's and the Bay walls' edits on), ARCH3D. */
async function freeware() {
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const { installTownOutline } = await import('../../src/world/townOutline.js');
  const { installArena } = await import('../../src/world/arena/arenaCity.js');
  const { roads: roadsB, tracks: tracksB } = bayRoads();   // OWN-WORK2: the Bay's own network
  setTownWallPaths(townWallPathsReader({ bay: () => ({ roads: roadsB, tracks: tracksB }) }));   // every wall made on its roads, as the game makes it
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
  installArena({ readBin: async () => { throw new Error('no colosseum in a test'); }, log: null });
  installTownOutline();
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const classic = (id) => { if (!models.has(id)) { const i = arch.getRecordIndex(id); models.set(id, i < 0 ? null : dfMeshToModel(arch.getMesh(i), () => ({ width: 64, height: 64 }))); } return models.get(id); };
  const cities = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc?.outline?.walled && loc.outline.bay) cities.push(loc); } }
  const { isWallCarrier } = await import('../../src/world/townShape.js');
  const { arenaJoinByte } = await import('../../src/world/arenaRoads.js');
  const pixelOf = (loc) => ({ px: Math.trunc(loc.mapTableData.longitude / 128), py: 499 - Math.trunc(loc.mapTableData.latitude / 128) });
  const rmbOf = (n) => (isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? null : blocks.getBlockByName(n)?.rmbBlock ?? null);
  /** A Bay city's wall as the game makes it: on its pixel's roads (the Bay's network and a crossing's join). */
  const wallOf = (loc) => { const { px, py } = pixelOf(loc), i = py * 1000 + px; return townWall(loc, loc.exterior.exteriorData.wallTook, rmbOf, { roads: roadsB[i] | arenaJoinByte(px, py), tracks: tracksB[i], curved: false }); };
  return { maps, blocks, classic, cities, bytes, wallOf, rmbOf, roadsB, tracksB, pixelOf };
}
/** A piece's footprint: its middle, along and across, half sizes - a tower's body as wide across as it stands. */
const rectOf = (p) => ({ c: p.at, u: [p.out[1], -p.out[0]], w: p.out, hl: p.model === WALL_MODELS.tower ? 4.8 : (TOWN_WALL.piece * p.stretch) / 2, ht: p.model === WALL_MODELS.tower ? 4.8 * (p.thick ?? 1) : 4.8 });
/** How far (x, z) stands into a footprint: past 0 inside, metres. */
const depthIn = (r, x, z) => { const dx = x - r.c[0], dz = z - r.c[1]; return Math.min(r.hl - Math.abs(dx * r.u[0] + dz * r.u[1]), r.ht - Math.abs(dx * r.w[0] + dz * r.w[1])); };

test('FB1028 with ARENA2: the game\'s own pieces - 445\'s door and 446\'s two laid in their faces\' stone, every triangle kept; every eighth Bay walled city\'s wall stands no door, no length or gate in another (each its own past its cuts, sampled to 1.6 m), every tower holding its cut ends; and no building of the town within 2 m of it - TS7\'s "no house under it", measured (mutants: the doors kept; the cut unmade; the tower ungrown; the line nearer the houses)', { skip: skipReal, timeout: 900_000 }, async () => {
  const { classic, cities, wallOf, maps, blocks } = await freeware();
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { transformPoint } = await import('../../src/world/mat4.js');
  for (const [id, doors] of [[445, 1], [446, 2]]) {
    const m = classic(id), d = wallDoorless(m), tris = (x) => x.subMeshes.reduce((a, s) => a + s.primitiveCount, 0);
    assert.equal(m.subMeshes.filter((s) => s.textureArchive === 74).reduce((a, s) => a + s.primitiveCount, 0), 2 * doors, `${id}: Daggerfall's doors`);
    assert.ok(!d.subMeshes.some((s) => s.textureArchive === 74) && tris(d) === tris(m), `${id}: none left, every triangle kept`);
  }
  const sample = cities.filter((c, k) => k % 8 === 0 || c.name === 'Daggerfall');
  let runsSeen = 0, buildings = 0;
  for (const loc of sample) {
    const wall = wallOf(loc), towers = wall.pieces.filter((p) => p.model === WALL_MODELS.tower), runs = wall.pieces.filter((p) => p.model !== WALL_MODELS.tower);
    assert.ok(!townWallModel(wall.pieces, classic).subMeshes.some((s) => s.textureArchive === 74), `${loc.name}: no door on its wall`);
    const solid = runs.map((r) => ({ r: rectOf(r), planes: mitrePlanes(r, towers) }));
    const kept = (planes, x, z) => planes.every((pl) => (x - pl.at[0]) * pl.n[0] + (z - pl.at[1]) * pl.n[1] > 0.05);   // past its cut by more than a seam
    for (const [a, A] of runs.entries()) {
      const ends = towers.filter((t) => mitrePlanes(A, [t]).length), key = (t) => t.p.map((q) => q.map((v) => v.toFixed(3)).join(',')).join('|');
      const theirs = new Set(trianglesOf(townWallModel(ends, classic)).map(key)), own = trianglesOf(townWallModel([A, ...ends], classic)).filter((t) => !theirs.has(key(t)));
      for (const t of own) for (let i = 0; i <= 4; i++) for (let j = 0; i + j <= 4; j++) {
        const q = [0, 1, 2].map((c) => t.p[0][c] * (1 - (i + j) / 4) + t.p[1][c] * (i / 4) + t.p[2][c] * (j / 4));
        if (q[1] > 10.8) continue;
        for (const [b, B] of solid.entries()) {
          if (b === a || Math.abs(B.r.w[0] * A.out[0] + B.r.w[1] * A.out[1]) > 0.9999) continue;   // a collinear neighbour meets it end to end
          assert.ok(!(depthIn(B.r, q[0], q[2]) > 0.05 && kept(B.planes, q[0], q[2])), `${loc.name}: a ${A.model} at (${A.at.map((v) => v.toFixed(1))}) runs into a ${runs[b].model} at (${q.map((v) => v.toFixed(1))})`);
        }
      }
      for (const t of ends) {   // the tower holds the cut: its half across past the cut's corner, 4.8 / cos(half the turn)
        const c = Math.abs(t.out[0] * A.out[0] + t.out[1] * A.out[1]);
        assert.ok(4.8 * t.thick >= 4.8 / c + TOWER_PROUD - 1e-6, `${loc.name}: a tower at (${t.at.map((v) => v.toFixed(1))}) holds its lengths' cut`);
      }
      runsSeen++;
    }
    // no building of the town within 2 m of a piece's footprint (its model's every corner, the town's metres)
    const lay = layoutLocation(loc, maps, blocks), rects = wall.pieces.map(rectOf);
    for (const b of lay.blocks) for (const pm of b.layout.models) {
      if (pm.recordIndex === undefined) continue;
      const m = classic(pm.modelIdNum);
      if (!m) continue;
      buildings++;
      for (let v = 0; v < m.positions.length; v += 3) {
        const [x, , z] = transformPoint(pm.matrix, m.positions[v], m.positions[v + 1], m.positions[v + 2]);
        for (const r of rects) assert.ok(depthIn(r, x + b.originX, z + b.originZ) < -2, `${loc.name}: a building of ${b.blockName} within 2 m of its wall`);
      }
    }
  }
  assert.ok(sample.length > 50 && runsSeen > 3000 && buildings > 15000, `${sample.length} cities, ${runsSeen} lengths and gates, ${buildings} building models`);
});

test('FB1028 with ARENA2: every eighth Bay walled city\'s pixel as the game lays it (the Bay\'s roads, its gates\' roads) - no road the painter laid or a gate laid, and none of the town\'s streets, under a length or a tower away from every gate (a street within two lengths of one aside); every gate on a road that runs on past the town\'s ground (mutants: no take-up; the stub left; no street gate)', { skip: skipReal, timeout: 1_800_000 }, async () => {
  const { cities, wallOf, maps, blocks, roadsB, tracksB, pixelOf, bytes } = await freeware();
  const { setLocationTiles, getLocationTerrainTileOrigin } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  let gates = 0, onRoad = 0, streetsNear = 0;
  {
    for (const loc of cities.filter((c, k) => k % 8 === 0 || c.name === 'Daggerfall')) {
      const wall = wallOf(loc), { px, py } = pixelOf(loc), o = getLocationTerrainTileOrigin(loc);
      const tm = new Uint8Array(D * D), rect = setLocationTiles(loc, maps, blocks, tm), own = Uint8Array.from(tm);
      rect.gateRoads = townGateRoads(loc, maps, blocks);
      const job = generatePixelTerrain({ woods, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads: roadsB, tracks: tracksB, smooth: true } });
      const rects = wall.pieces.map(rectOf), openings = wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map(gateOpening);
      const metres = (i) => [((i % D) - o.x + 0.5) * 6.4, (Math.floor(i / D) - o.y + 0.5) * 6.4];
      const paving = (i) => [46, 47, 55].includes(own[i] & 0x3f) && own[i] !== 0xff;
      for (let i = 0; i < D * D; i++) {
        if (!job.paths[i] && !paving(i)) continue;
        const [x, z] = metres(i), gate = Math.min(...openings.map((g) => Math.hypot(g.at[0] - x, g.at[1] - z)));
        if (gate < GATE_OPENING.half + 6.4 || !rects.some((r) => depthIn(r, x, z) > 0.5)) continue;
        assert.ok(!job.paths[i], `${loc.name}: a road laid at (${x.toFixed(1)}, ${z.toFixed(1)}) runs into its wall, ${gate.toFixed(1)} m from a gate`);
        assert.ok(gate < GATE_ARMS_MERGE + TOWN_WALL.piece, `${loc.name}: its street at (${x.toFixed(1)}, ${z.toFixed(1)}) runs into its wall, ${gate.toFixed(1)} m from a gate`);
        streetsNear++;
      }
      // every gate on a road: a tile a step out of its opening a road's, joined by road tiles to the painter's off its ground
      const road = (i) => !!job.paths[i] || paving(i), ground = job.townGround;
      if (!roadsB[py * 1000 + px]) continue;   // OWN-WORK2: a city on the sea's own pixel (Antelibuton) has no road out
      for (const g of openings) {
        gates++;
        const from = [8, 10, 12].map((t) => { const tx = Math.floor((g.at[0] + g.out[0] * t) / 6.4 + o.x), ty = Math.floor((g.at[1] + g.out[1] * t) / 6.4 + o.y); return tx + ty * D; }).find((i) => i >= 0 && i < D * D && road(i));
        if (from === undefined) continue;
        const seen = new Set([from]), stack = [from];
        let out = false;
        while (stack.length && !out) {
          const i = stack.pop(), x = i % D, y = (i - x) / D;
          if (!ground[i] && job.paths[i]) out = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = x + dx + (y + dy) * D; if (x + dx >= 0 && y + dy >= 0 && x + dx < D && y + dy < D && !seen.has(j) && road(j)) { seen.add(j); stack.push(j); } }
        }
        if (out) onRoad++;
      }
    }
  }
  // PIN MOVED (OWN-WORK2): over 150 gates on Basic Roads' arrays; 108, every one on a road out, on the Bay's own network
  assert.ok(gates > 100 && onRoad / gates > 0.97, `${onRoad} of ${gates} gates on a road out (${streetsNear} street tiles within two lengths of a gate)`);
});

/** a779c9c29's yards (the bare law: townGroundOf with no measures, yardSitesOn and craftYardSitesOn) - kind, gx, gy, turn.
 *  PIN MOVED (OWN-WORK2): on the Bay's own network - Aldhope's, Mogandaton's and Newcester's stables moved with its roads. */
const YARDS_1184 = {
  Agogurana: ['stable 316 276 0', 'transport 125 171 3', 'carpenter 167 129 2'],
  Aldhope: ['stable 56 152 1', 'transport 119 274 0', 'carpenter 120 286 1'],
  'Ceranda-Kom': ['stable 276 60 1', 'transport 223 183 0', 'carpenter 119 271 0'],
  Daggerfall: ['stable 88 56 0', 'transport 344 220 3', 'carpenter 212 315 1'],
  Mettula: ['stable 56 91 1', 'transport 314 180 1', 'carpenter 255 148 0'],
  Mogandaton: ['stable 224 56 0', 'transport 165 257 3', 'carpenter 184 271 0'],
  Newcester: ['stable 58 212 0', 'transport 314 211 0', 'carpenter 176 180 2'],
  Tsetono: ['stable 152 56 0', 'transport 136 190 0', 'carpenter 169 187 0'],
};

test('FB1028 YARDS with ARENA2: every yard where #1184 stood it - placed on the paths as #1184 laid them (no arm taken up, its gates\' roads) and its wall as it stood (no street\'s gate, no tower grown), each yard\'s cell a779c9c29\'s; the host hands the yards theirs (mutants: the yards read the new roads; the new wall; the host hands the walkers\' shut)', { skip: skipReal, timeout: 1_800_000 }, async () => {
  const { cities, wallOf, maps, blocks, roadsB, tracksB, pixelOf, bytes } = await freeware();
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const Y = await import('../../src/world/merchantYards/merchantYardSites.js');
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const lay = (loc, gateRoads) => {
    const { px, py } = pixelOf(loc), tm = new Uint8Array(D * D), rect = setLocationTiles(loc, maps, blocks, tm);
    rect.gateRoads = gateRoads;
    return generatePixelTerrain({ woods, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads: roadsB, tracks: tracksB, smooth: true } });
  };
  let differ = 0, n = 0;
  for (const loc of cities.filter((c) => YARDS_1184[c.name])) {
    n++;
    const gr = townGateRoads(loc, maps, blocks), job = lay(loc, gr), was = lay(loc, gr.yard);
    // PIN MOVED (FB1028 YARDS Y2): and today's ring off the yards' ground, as #1184's ran
    assert.deepEqual(job.yardPaths, ringAsWas(was.paths, townRoadRing(job.townGround), job.yardGround), `${loc.name}: the yards' paths #1184's`);
    const wall = wallOf(loc), yl = layoutLocation(loc, maps, blocks), { width: w, height: h } = loc.exterior.exteriorData;
    assert.ok(wall.yardPieces.every((p) => p.thick === 1), `${loc.name}: no tower grown`);
    assert.equal(wall.yardPieces.filter((p) => p.model === WALL_MODELS.gate).length, wall.pieces.filter((p) => p.model === WALL_MODELS.gate).length - wall.streetWays.length, `${loc.name}: no street's gate`);
    const place = (shut) => { const g = Y.townGroundOf(yl, {}, shut); return g ? [...Y.yardSitesOn(g), ...Y.craftYardSitesOn(g)].map((q) => `${q.kind} ${q.gx} ${q.gy} ${q.turn}`) : []; };
    assert.deepEqual(place(townWalkShut(loc, job.yardGround, job.yardPaths, true)), YARDS_1184[loc.name], `${loc.name}: every yard where #1184 stood it`);   // PIN MOVED (Y2): on the yards' ground
    const nav = (yards) => { const m = { width: w * 64, height: h * 64, grid: new Uint8Array(w * 64 * h * 64).fill(0xf0) }; townWalkShut(loc, null, null, yards)(m); return m.grid; };
    const a = nav(true), b = nav(false), cells = townWallCells({ pieces: wall.yardPieces }, w, h);
    assert.deepEqual(townWallYardCellsOf(loc), cells, `${loc.name}: its yards' wall cells #1184's`);
    if (a.some((v, i) => v !== b[i])) differ++;
  }
  assert.equal(n, 8, 'every city of the sample');
  assert.ok(differ > 0, `the yards' wall is not the walkers' (${differ} of ${n})`);
  // PIN MOVED (AUDIT FB1028 YARDS): the host's wiring is read in the unskipped "the host" test below
});

test('FB1028 YARDS with ARENA2: a yard broken by the new wall and roads placed again - Berbemijet\'s Wagon Yard on the new ground (PIN MOVED (OWN-WORK2): Chesterbeth\'s on Basic Roads\' arrays) stands again by its law clear of the new roads and wall and of its town\'s other yards, which keep a779c9c29\'s cells (mutant: a broken yard kept)', { skip: skipReal, timeout: 1_800_000 }, async () => {
  const { cities, maps, blocks, roadsB, tracksB, pixelOf, bytes } = await freeware();
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const Y = await import('../../src/world/merchantYards/merchantYardSites.js');
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const loc = cities.find((c) => c.name === 'Berbemijet'), { px, py } = pixelOf(loc), tm = new Uint8Array(D * D), rect = setLocationTiles(loc, maps, blocks, tm);
  rect.gateRoads = townGateRoads(loc, maps, blocks);
  const job = generatePixelTerrain({ woods, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads: roadsB, tracks: tracksB, smooth: true } });
  const yl = layoutLocation(loc, maps, blocks), str = (q) => `${q.kind} ${q.gx} ${q.gy} ${q.turn}`;
  const was = Y.townGroundOf(yl, {}, townWalkShut(loc, job.townGround, job.yardPaths, true)), sites = [...Y.yardSitesOn(was), ...Y.craftYardSitesOn(was)];
  assert.deepEqual(sites.map(str), ['stable 315 148 0', 'transport 308 330 0', 'carpenter 184 147 3'], 'placed on the yards\' ground');
  const now = () => Y.townGroundOf(yl, {}, townWalkShut(loc, job.townGround, job.paths)), g = now();
  assert.ok(!Y.siteFits(g, sites[1]), 'its Wagon Yard broken on the new ground');
  const run = (gen) => { let r; while (!(r = gen.next()).done); return r.value; };
  const kept = run(Y.keptSitesSteps(now(), sites, []));
  assert.deepEqual([str(kept[0]), str(kept[2])], ['stable 315 148 0', 'carpenter 184 147 3'], 'the others kept');
  assert.notEqual(str(kept[1]), 'transport 308 330 0', 'the Wagon Yard placed again');
  assert.ok(kept.every((s) => Y.siteFits(g, s)), 'every yard fits the new ground');
  const t = kept[1];
  for (const q of [kept[0], kept[2]]) assert.ok(t.gx + t.nx <= q.gx || q.gx + q.nx <= t.gx || t.gy + t.nz <= q.gy || q.gy + q.nz <= t.gy, `clear of its ${q.kind}`);
});

test('AUDIT FB1028 B2: a road\'s gate keeps its template gate\'s things - a street\'s gate nearer that gate\'s bearing takes only what is left, so no road\'s gate stands bare (Naresa, Menakat: two records each went to a street gate with no road out) (mutant: the street\'s gate unread)', () => {
  const boardOf = { rmbBlock: { misc3dObjectRecords: [{ modelId: '41739', modelIdNum: 41739, objectType: 0, xPos: 97 / 0.025, yPos: 0, zPos: 0 / 0.025 - 4096, xRotation: 0, yRotation: 0, zRotation: 0 }], miscFlatObjectRecords: [] } };
  // one frame east; the street's gate on its bearing, the road's 20 degrees off it
  const wall = { middle: [0, 0], frames: [{ name: 'A', block: [0, 0], at: [100, 0], out: [1, 0] }], streetWays: [[100, 2]],
    pieces: [{ model: walls.WALL_MODELS.gate, at: [100, 2], out: [1, 0], stretch: 1 }, { model: walls.WALL_MODELS.gate, at: [94, 34], out: [0.94, 0.34], stretch: 1 }] };
  const [m] = walls.gateFurniture(wall, () => boardOf, () => null).models;
  const x = m.XPos * 0.025, z = (m.ZPos + 4096) * 0.025;
  assert.ok(Math.hypot(x - 94, z - 34) < Math.hypot(x - 100, z - 2), `the road's gate's: (${x.toFixed(1)}, ${z.toFixed(1)})`);
  // with no street's gate the nearest by bearing, as TS7 pairs them
  const [n] = walls.gateFurniture({ ...wall, streetWays: [] }, () => boardOf, () => null).models;
  assert.ok(Math.hypot(n.XPos * 0.025 - 100, (n.ZPos + 4096) * 0.025 - 2) < 10, 'no street\'s gate: the nearest');
});

test('AUDIT FB1028 B5: a kept yard\'s pad may touch a cell only the wall\'s growth since #1184 closed (a tower grown 0.1 m, a street\'s gate) - its own ground never; anything else closed breaks it as before (mutants: the growth unread; the growth let under its own ground)', () => {
  const W = 20, n = W * W, g = { width: W, height: W, blocked: new Uint8Array(n), road: new Uint8Array(n), shut: new Uint8Array(n) };
  const s = { kind: 'stable', gx: 6, gy: 6, nx: 3, nz: 3 }, gained = new Uint8Array(n);
  assert.equal(ys.siteFits(g, s), true, 'clear ground');
  g.blocked[6 * W + 5] = 1; gained[6 * W + 5] = 1;   // its pad's cell, the wall grown into it
  assert.equal(ys.siteFits(g, s, gained), true, 'a pad cell the growth closed: kept');
  assert.equal(ys.siteFits(g, s), false, 'read as any closed cell: broken');
  g.blocked[7 * W + 7] = 1; gained[7 * W + 7] = 1;   // its own cell
  assert.equal(ys.siteFits(g, s, gained), false, 'its own ground the wall\'s: broken');
  g.blocked[7 * W + 7] = 0; gained[7 * W + 7] = 0; g.blocked[9 * W + 6] = 1;   // a pad cell a house closed
  assert.equal(ys.siteFits(g, s, gained), false, 'a pad cell closed by anything else: broken');
});

// ── AUDIT FB1028 YARDS without ARENA2: the yard law and its host wiring on synthetic towns ──────────────────────────
/** A town of `n` x `n` blocks of grass, a street along each block's middle row of tiles. */
function grassTown(n = 3) {
  const tiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: ty === 8 ? 46 : 2 })));
  const blocks = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) blocks.push({ x, y, blockName: 'X.RMB', dfBlock: { rmbBlock: { fldHeader: { autoMapData: new Uint8Array(4096), groundData: { groundTiles: tiles } } } } });
  return { width: n, height: n, blocks };
}
/** A walk shut closing a site's own cells (a new road or wall across it). */
const shutOver = (s) => Object.assign((nav) => { for (let y = s.gy; y < s.gy + s.nz; y++) for (let x = s.gx; x < s.gx + s.nx; x++) nav.grid[y * nav.width + x] = 0; }, { key: `over ${s.gx} ${s.gy}` });
const siteStr = (q) => `${q.kind} ${q.gx} ${q.gy} ${q.turn}`;
const apart = (a, b) => a.gx + a.nx <= b.gx || b.gx + b.nx <= a.gx || a.gy + a.nz <= b.gy || b.gy + b.nz <= a.gy;
const runAll = (gen) => { let r; while (!(r = gen.next()).done); return r.value; };
/** A host's function or lines run on stubs: `src` an expression of its text, `env` the names it reads. */
const runIn = (src, env) => new Function('env', `with (env) { return (${src}); }`)(new Proxy(env, { has: (t, k) => k in t }));

test('AUDIT FB1028 YARDS the law: on the ground as it stands now a yard whose place still fits keeps it, the same site, and a broken one is placed again by its law, clear of the kept ones; nothing broken, the sites as they were (mutant: a broken yard kept)', () => {
  const yl = grassTown(), was = ys.townGroundOf(yl, {}), sites = [...ys.yardSitesOn(was), ...ys.craftYardSitesOn(was)];
  assert.deepEqual(sites.map((q) => q.kind), ['stable', 'transport', 'carpenter'], 'three yards on the grass');
  assert.equal(runAll(ys.keptSitesSteps(ys.townGroundOf(yl, {}), sites, [])), sites, 'nothing broken: the sites as they were');
  const now = () => ys.townGroundOf(yl, {}, shutOver(sites[0])), g = now();
  assert.ok(!ys.siteFits(g, sites[0]) && ys.siteFits(g, sites[1]) && ys.siteFits(g, sites[2]), 'the stable broken, the others not');
  const kept = runAll(ys.keptSitesSteps(now(), sites, []));
  assert.equal(kept[1], sites[1], 'the wagon yard kept');
  assert.equal(kept[2], sites[2], 'the carpenter kept');
  assert.equal(kept[0].kind, 'stable');
  assert.notEqual(siteStr(kept[0]), siteStr(sites[0]), 'the stable placed again');
  assert.ok(kept.every((s) => ys.siteFits(g, s)), 'every yard fits the ground as it stands');
  for (const [i, a] of kept.entries()) for (const b of kept.slice(i + 1)) assert.ok(apart(a, b), `${a.kind} clear of ${b.kind}`);
});

test('AUDIT TAMRIEL-WIDE E5: a yard placed again keeps off a port\'s places - a shipyard standing where the broken stable would go sends the stable elsewhere, clear of it (mutant: the ports\' ground left open)', () => {
  const yl = grassTown(), was = ys.townGroundOf(yl, {}), sites = [...ys.yardSitesOn(was), ...ys.craftYardSitesOn(was)];
  const now = () => ys.townGroundOf(yl, {}, shutOver(sites[0]));
  const alone = runAll(ys.keptSitesSteps(now(), sites, []))[0];
  const port = { kind: 'shipyard', gx: alone.gx, gy: alone.gy, nx: alone.nx, nz: alone.nz, turn: 0 };
  const kept = runAll(ys.keptSitesSteps(now(), sites, [port]));
  assert.equal(kept[0].kind, 'stable', 'the stable placed again');
  assert.ok(apart(kept[0], port), `clear of the shipyard (${siteStr(kept[0])} against ${siteStr(port)})`);
});

test('AUDIT FB1028 YARDS the host: the pixel\'s build hands townPlacesFor the yards\' shut carrying the walkers\' as its `now`; townPlacesFor places the yards on #1184\'s ground and moves only the one the town as it stands breaks - the host\'s own lines run on a synthetic town (mutants: the walkers\' shut not carried; the yards\' shut read as now)', async () => {
  const pb = hostText('src/scenes/pixelBuild.js'), w = hostText('src/scenes/world.js');
  const l0 = pb.indexOf('    const walkShut = dfLocation ?'), l1 = pb.indexOf('\n', pb.indexOf('    const yardShut = dfLocation ?', l0));
  const f0 = w.indexOf('  async function townPlacesFor('), f1 = w.indexOf('\n  }\n', f0);
  assert.ok(l0 > 0 && l1 > l0 && f0 > 0 && f1 > f0, 'the host\'s lines found');
  const yl = grassTown(), first = ys.townGroundOf(yl, {}), sites = [...ys.yardSitesOn(first), ...ys.craftYardSitesOn(first)];
  const was = Object.assign(() => {}, { key: 'was' }), now = shutOver(sites[0]);
  const { walkShut, yardShut } = runIn(`(() => { ${pb.slice(l0, l1)}\nreturn { walkShut, yardShut }; })()`, {
    dfLocation: { mapTableData: { mapId: 9 } }, townGround: null, yardGround: null, paths: null, yardPaths: null, fabricWalkShut: (s) => s,
    townWalkShut: (loc, ground, paths, yards) => (yards ? was : now), yardWalkShut: walls.yardWalkShut,
  });
  assert.equal(walkShut, now, 'the walkers\' shut the town as it stands');
  const warned = [], townPlacesFor = runIn(w.slice(f0, f1 + 4), {
    isEnhanced: () => true, windmillsOn: () => true, stepsBreathing, yardMeasuresSteps: function* () { return {}; },
    walkerRace: () => 'breton', folkOfLocation: () => null, isYardTown: () => true, isPortTown: () => false, portOnSea: () => false, _yardMemo: new Map(),
    townGroundSteps: ys.townGroundSteps, townYardsOf: () => null, yardSitesSteps: ys.yardSitesSteps, craftYardSitesSteps: ys.craftYardSitesSteps,
    keptTownSitesSteps: ys.keptTownSitesSteps, ALL_YARD_KINDS: ['stable', 'transport', 'carpenter'], PORT_SITE_ORDER: [], MONUMENT_KEEP_M: 8,
    portKeeper: () => ({ name: 'k' }), yardKeeper: () => ({ name: 'k' }), portPlaceName: () => 'p', console: { log: () => {}, warn: (...a) => warned.push(a.join(' ')) },
  });
  const placed = await townPlacesFor({ name: 'Grass', mapTableData: { mapId: 9 } }, null, null, yl, yardShut);
  assert.deepEqual(warned, [], 'placed');
  assert.deepEqual(placed.yards.slice(1).map(siteStr), sites.slice(1).map(siteStr), 'the yards #1184\'s ground placed, kept');
  assert.notEqual(siteStr(placed.yards[0]), siteStr(sites[0]), 'the stable the town as it stands breaks placed again');
  assert.ok(ys.siteFits(ys.townGroundOf(yl, {}, now), placed.yards[0]), 'where it fits now');
  // the host's other two wires: the yards' shut on #1184's paths and wall, and the yards' paths laid by #1184's gates
  // PIN MOVED (FB1028 YARDS Y2): the yards' ground #1184's mask, the kernel's `yardGround`
  assert.ok(pb.includes('townWalkShut(dfLocation, yardGround ?? townGround, yardPaths ?? paths, true)'), 'the host shuts the yards\' ground as #1184 stood it');
  assert.ok(pb.includes('climate?.people, loc, yardShut,'), 'and hands the yards that');
  assert.ok(readFileSync(new URL('../../src/world/terrain/terrainGen.js', import.meta.url), 'utf8').includes('if (hasLocation && locationRect?.gateRoads) yardPaths = yardRoads(tilemap, paths, tileData, locationRect.gateRoads);'), 'the kernel lays the yards\' paths');
});

test('AUDIT FB1028 YARDS #1184\'s roads and wall: yardRoads lays the paths by #1184\'s gates on copies, no arm taken up; a wall\'s yardPieces stand no tower grown and no street\'s gate; the yards\' walk shut is shut on those pieces\' cells, not the wall\'s (mutants: the new gates\' roads; the towers grown; the street gates kept; the yards on the new wall)', () => {
  const g = walledPixel([[64, 46]]), yard = { gates: [{ x: 40.5, y: 50.5, ox: -1, oy: 0, half: GATE_OPENING.half / 6.4 }], blocked: g.town.blocked };
  const tm = Uint8Array.from(g.tilemap), paths = Uint8Array.from(g.paths), town = { ...g.town, yard };
  const yp = yardRoads(g.tilemap, g.paths, g.tileData, town);
  assert.deepEqual([g.tilemap, g.paths], [tm, paths], 'the pixel\'s own untouched');
  const lay = (t) => { const p = Uint8Array.from(paths); layGateRoads(Uint8Array.from(tm), p, g.tileData, t); return p; };
  assert.deepEqual(yp, lay(yard), 'laid by #1184\'s gates');
  assert.notDeepEqual(yp, lay({ ...g.town, inside: undefined }), 'not by the new ones');
  for (let x = 30; x < 64; x++) assert.equal(yp[x + 64 * D], 1, `no arm taken up at (${x}, 64)`);
  assert.equal(yardRoads(g.tilemap, g.paths, g.tileData, g.town), null, 'no yard handed: none');
  // a city's wall with a street's gate: its yards' pieces #1184's
  const wall = streetCity().wall, towers = wall.pieces.filter((p) => p.model === WALL_MODELS.tower);
  assert.ok(wall.streetWays.length === 1 && towers.every((p) => p.thick > 1), 'a street\'s gate, every tower grown');
  assert.ok(wall.yardPieces.every((p) => p.thick === 1), 'no tower grown');
  const gatesOf = (ps) => ps.filter((p) => p.model === WALL_MODELS.gate).length;
  assert.equal(gatesOf(wall.yardPieces), gatesOf(wall.pieces) - 1, 'no street\'s gate');
  try {
    setTownWallPaths(() => ({ roads: DIR.E | DIR.W, tracks: 0, curved: false }));
    const c = walledCity(610103, 212, true), stood = standTownWall(c.loc, c.template, (n) => c.served[n] ?? null, townOutlineBlockJson);
    const nav = (yards) => { const m = { width: 192, height: 192, grid: new Uint8Array(192 * 192).fill(0xf0) }; townWalkShut(c.loc, null, null, yards)(m); return m.grid; };
    const cells = townWallCells({ pieces: stood.yardPieces }, 3, 3), a = nav(true);
    assert.deepEqual(Array.from(a, (v) => (v ? 0 : 1)), Array.from(cells), 'the yards\' shut on #1184\'s cells');
    assert.notDeepEqual(a, nav(false), 'not the walkers\'');
  } finally { setTownWallPaths(null); }
});


// ── FB1028 YARDS Y1-Y3 (the owner: every yard where #1184 stood it, unless its place is broken now) ─────────────────
test('FB1028 YARDS Y1: the yards measure the wall\'s carrier as #1184 laid it - its markers and its gates\' things by #1184\'s gates, stood clear of that wall - with the town as it stands as `now`; a block the two share measured once, a town with no wall of its own as it is (mutants: the carrier as it stands; the yards\' layout unread)', () => {
  const id = 30007, { loc, wall } = streetCity(id), name = townWallBlockName(id), gates = (ps) => ps.filter((p) => p.model === WALL_MODELS.gate).length;
  walls.registerTownWall(loc, loc.exterior.exteriorData.blockNames, { servedOf: () => null, classicOf: () => null }, townOutlineBlockJson, wall);
  const dfBlock = blockFromJson(walls.townWallBlockJson(name, walls.townWallModelId(id), wall.markers, townOutlineBlockJson, null), walls.townWallBlockIndex(id));
  const carrier = { x: 0, y: 0, blockName: name, dfBlock, layout: { models: [] }, originX: 0, originZ: 0 }, other = { x: 1, y: 1, blockName: 'H.RMB', dfBlock: null, layout: { models: [] }, originX: 64, originZ: 64 };
  const yl = { width: 3, height: 3, blocks: [carrier, other] }, ylY = walls.townWallYardLayout(yl, loc);
  assert.ok(ylY !== yl && ylY.now === yl && ylY.blocks[1] === other, 'the carrier alone laid again, today\'s layout its `now`');
  assert.equal(gates(wall.yardPieces), gates(wall.pieces) - 1, 'a street\'s gate since #1184');
  const marks = (b) => (b.dfBlock?.rmbBlock?.miscFlatObjectRecords ?? []).filter((f) => f.textureArchive === 199 && f.textureRecord === 10).map((f) => ({ x: f.xPos * 0.025, z: (f.zPos + 4096) * 0.025 }));
  assert.equal(marks(ylY.blocks[0]).length, gates(wall.yardPieces), '#1184\'s gates\' markers');
  const shut = walls.yardWalkShut(Object.assign(() => {}, { key: 'was' }), Object.assign(() => {}, { key: 'now' }), loc);
  assert.equal(marks(shut.yardLayout(yl).blocks[0]).length, gates(wall.yardPieces), 'the yards\' shut hands that layout');
  let read = 0;
  const m = ys.yardMeasuresOf(ylY, { flatsOf: (b) => { read++; return marks(b); } });
  assert.deepEqual([m.flats.length, m.now.flats.length], [gates(wall.yardPieces), gates(wall.pieces)], 'the yards #1184\'s markers, `now` today\'s');
  assert.equal(read, 3, 'the shared block measured once');
  assert.equal(ys.yardMeasuresOf(yl, { flatsOf: marks }).now, undefined, 'a layout as it is: no `now`');
  assert.equal(walls.townWallYardLayout(yl, { mapTableData: { mapId: 30008 }, outline: { walled: true } }), yl, 'no wall of its own: as it is');
});

test('FB1028 YARDS Y1 the host: townPlacesFor measures the layout the yards\' shut hands (its carrier as #1184 laid it) - the host\'s own lines on a stub town (mutant: the yards\' layout unread)', async () => {
  const w = hostText('src/scenes/world.js'), f0 = w.indexOf('  async function townPlacesFor('), f1 = w.indexOf('\n  }\n', f0), seen = [], marker = { blocks: [] };
  const townPlacesFor = runIn(w.slice(f0, f1 + 4), {
    isEnhanced: () => true, windmillsOn: () => true, stepsBreathing, yardMeasuresSteps: function* (l) { seen.push(l); return {}; },
    walkerRace: () => 'breton', folkOfLocation: () => null, isYardTown: () => true, isPortTown: () => false, portOnSea: () => false, _yardMemo: new Map(),
    townGroundSteps: ys.townGroundSteps, townYardsOf: () => null, yardSitesSteps: ys.yardSitesSteps, craftYardSitesSteps: ys.craftYardSitesSteps,
    keptTownSitesSteps: ys.keptTownSitesSteps, ALL_YARD_KINDS: [], PORT_SITE_ORDER: [], MONUMENT_KEEP_M: 8,
    portKeeper: () => ({ name: 'k' }), yardKeeper: () => ({ name: 'k' }), portPlaceName: () => 'p', console: { log: () => {}, warn: () => {} },
  });
  await townPlacesFor({ name: 'Grass', mapTableData: { mapId: 11 } }, null, null, grassTown(), Object.assign(() => {}, { key: 'k', yardLayout: () => marker }));
  assert.equal(seen[0], marker, 'the yards\' layout measured');
});

test('FB1028 YARDS Y1: the kept yards read the town as it stands (`now`) - a gate\'s things moved onto a yard\'s own ground break it; onto its pad alone, a cell they closed only since #1184, it keeps its place (mutants: the keep reads #1184\'s things; their move read as any closed cell)', () => {
  const yl = grassTown(), first = ys.townGroundOf(yl, {}), sites = [...ys.yardSitesOn(first), ...ys.craftYardSitesOn(first)], s = sites[0], C = 1.6;
  const at = (gx, gy) => [gx * C + 0.7, gy * C + 0.7, gx * C + 0.9, gy * C + 0.9];   // a thing closing that cell alone (PROP_CLEAR_M)
  const bare = ys.townGroundOf(yl, {}), pad = [[s.gx - 1, s.gy + 1], [s.gx + s.nx, s.gy + 1], [s.gx + 1, s.gy - 1], [s.gx + 1, s.gy + s.nz]].find(([x, y]) => x >= 0 && y >= 0 && x < bare.width && y < bare.height && !bare.blocked[y * bare.width + x]);
  assert.ok(pad, 'a pad cell open');
  const measures = (now) => ({ buildings: [], props: [], flats: [], closedBlocks: [], keep: [], now: { buildings: [], props: [now], flats: [], closedBlocks: [] } });
  assert.deepEqual(runAll(ys.keptTownSitesSteps(yl, measures(at(...pad)), null, null, sites, [])).map(siteStr), sites.map(siteStr), 'its pad: kept');
  const moved = runAll(ys.keptTownSitesSteps(yl, measures(at(s.gx + 1, s.gy + 1)), null, null, sites, []));
  assert.notEqual(siteStr(moved[0]), siteStr(s), 'its own ground: placed again');
  assert.deepEqual(moved.slice(1).map(siteStr), sites.slice(1).map(siteStr), 'the others kept');
});

test('FB1028 YARDS Y2: the yards\' ground as #1184 drew it - TS2\'s mask with no edge band, its tiles past the sea margin over water off - and the ring as #1184 painted it: today\'s ring on that ground none, every other tile as painted (mutants: the edge band read; the ring left on the yards\' ground; a tile off it cleared)', () => {
  const shape = new Uint8Array(D * D), ground = new Float32Array(129 * 129).fill(0.3);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) shape[x + y * D] = 9;   // two tiles in from the outline, to the pixel's edge
  for (let y = 20; y < 30; y++) for (let x = 20; x < 30; x++) ground[y + x * 129] = 0;   // the sea under a corner
  shape[25 + 25 * D] = 5;   // within the sea margin
  const was = townGroundMaskBefore(shape, ground, 129), now = townGroundMask(shape, ground, 129);
  assert.equal(was[1 + 10 * D], 1, 'the edge band the town\'s');
  assert.equal(now[1 + 10 * D], 0, 'today\'s mask keeps off it');
  assert.equal(was[25 + 22 * D], 0, 'past the margin over the sea: none');
  assert.equal(was[25 + 25 * D], 1, 'within the margin: the town\'s');
  const ring = new Uint8Array(D * D), paths = new Uint8Array(D * D);
  for (const i of [1 + 10 * D, 2 + 10 * D, 40 + 40 * D]) { ring[i] = 1; paths[i] = 1; }
  paths[5 + 5 * D] = 1;
  const out = ringAsWas(paths, ring, was);
  assert.deepEqual([out[1 + 10 * D], out[2 + 10 * D], out[40 + 40 * D], out[5 + 5 * D]], [0, 0, 1, 1], 'today\'s ring on the yards\' ground none; off it and an arm as painted');
  assert.equal(paths[1 + 10 * D], 1, 'a copy');
  const pb = hostText('src/scenes/pixelBuild.js'), tg = readFileSync(new URL('../../src/world/terrain/terrainGen.js', import.meta.url), 'utf8');
  assert.ok(pb.includes('locationRect.shapeWas = shapeBefore(locationRect.shape,'), 'the host hands the outline before its crops');
  assert.ok(tg.includes('yardGround = townGroundMaskBefore(locationRect.shapeWas ?? locationRect.shape, ground, HEIGHTMAP_DIMENSION);'), 'the kernel draws the yards\' ground on it');
  assert.ok(tg.includes('yardPaths = ringAsWas(yardPaths ?? paths, locationRect.ring, yardGround);'), 'and their paths');
});

/** The yards of a Bay city as the world host places them (townPlacesFor), on its pixel - the game's measures. */
async function placedYards(f, loc, { keep = true } = {}) {
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { collectBlockFlats } = await import('../../src/world/rmbFlats.js');
  const { classicModelIdOf } = await import('../../src/world/customModels.js');
  const { flatFieldFor } = await import('../../src/world/flatFields.js');
  const { townYardsOf } = await import('../../src/world/merchantYards/townYards.js');
  const { fabricWalkShut } = await import('../../src/world/urban/townFabricStand.js');
  const { shapeBefore } = await import('../../src/world/terrain/townBlendBefore.js');
  const { hasCustomModel, customModelNeeds, customModelFor } = await import('../../src/world/customModels.js');
  const { BODY } = await import('../../src/world/windmillMesh.js');
  const { localAabb, transformedAabb } = await import('../../src/render/frustum.js');
  const { ARENA_BLOCK } = await import('../../src/world/arena/arenaCity.js');
  const { blockBuildingCount } = await import('../../src/systems/talk/talkTopics.js');
  const { BUILDING_TYPES } = await import('../../src/world/buildingNames.js');
  const palaceIn = (b) => { const list = b.dfBlock?.rmbBlock?.fldHeader?.buildingDataList ?? []; for (let i = 0; i < Math.min(list.length, blockBuildingCount(b.dfBlock)); i++) if (list[i]?.buildingType === BUILDING_TYPES.Palace) return true; return false; };
  f.woods ??= (() => { const w = new WoodsFile(); w.load(f.bytes('WOODS.WLD')); return w; })();
  f.arch ??= (() => { const a = new Arch3dFile(); a.load(f.bytes('ARCH3D.BSA')); return a; })();
  const { px, py } = f.pixelOf(loc), tm = new Uint8Array(D * D), rect = setLocationTiles(loc, f.maps, f.blocks, tm);
  rect.gateRoads = townGateRoads(loc, f.maps, f.blocks);
  rect.shapeWas = shapeBefore(rect.shape, loc.mapTableData.mapId >>> 0);
  const job = generatePixelTerrain({ woods: f.woods, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads: f.roadsB, tracks: f.tracksB, smooth: true } });
  const yl = layoutLocation(loc, f.maps, f.blocks, { enhanced: true, windmills: true });
  const size = (id) => { const i = f.arch.getRecordIndex(id); return i === -1 ? null : f.arch.getMesh(i)?.size ?? null; };
  const shut = walls.yardWalkShut(fabricWalkShut(townWalkShut(loc, job.yardGround, job.yardPaths, true), loc), fabricWalkShut(townWalkShut(loc, job.townGround, job.paths), loc), loc);
  const measures = {
    ...ys.yardMeasuresOf(shut.yardLayout(yl), {
      boxOf: (id, at) => ys.placedModelBox(id, at, { custom: (cid) => (hasCustomModel(cid) && !customModelNeeds(cid).length ? customModelFor(cid)?.positions ?? null : null), classic: (cid) => size(classicModelIdOf(cid)) }),
      fieldOf: flatFieldFor, flatsOf: (b) => collectBlockFlats(b.dfBlock, 0), closedBlock: (b) => b.blockName === ARENA_BLOCK || palaceIn(b),
      millBox: (at) => { const box = transformedAabb(localAabb(BODY.positions), at); return [box[0], box[2], box[3], box[5]]; },
    }),
    keep: [],
  };
  const g = ys.townGroundOf(yl, measures, shut, townYardsOf(loc)), sites = [...ys.yardSitesOn(g), ...ys.craftYardSitesOn(g)];
  return { sites: keep ? runAll(ys.keptTownSitesSteps(yl, measures, shut.now, townYardsOf(loc), sites, [])) : sites, job, yl, measures, shut };
}

test('FB1028 YARDS Y1 with ARENA2: the gates\' things as #1184 laid them - Berbaaqnia\'s, Bubogureg\'s and Atrahaga\'s stables placed on #1184\'s cells (PIN MOVED (OWN-WORK2): Knightsgate\'s, Issaqumbaa\'s and Syra-Kom\'s on Basic Roads\' arrays); Berbaaqnia\'s kept there, the other two placed again (mutants: the carrier as it stands; the keep reads #1184\'s things)', { skip: skipReal, timeout: 1_800_000 }, async () => {
  const f = await freeware();
  const was = { Berbaaqnia: 'stable 380 43 0', Bubogureg: 'stable 228 398 3', Atrahaga: 'stable 88 41 1' };
  for (const loc of f.cities.filter((c) => was[c.name])) {
    const { sites } = await placedYards(f, loc, { keep: false });
    assert.equal(siteStr(sites[0]), was[loc.name], `${loc.name}: its stable on #1184's cells`);
    const kept = (await placedYards(f, loc)).sites[0];
    if (loc.name === 'Berbaaqnia') assert.equal(siteStr(kept), was[loc.name], 'Berbaaqnia\'s kept');
    else assert.notEqual(siteStr(kept), was[loc.name], `${loc.name}'s on today's road: placed again`);
  }
});

test('FB1028 YARDS Y3 with ARENA2: every street gate has a road out - Naresa\'s, Akhahanu\'s and Menakat\'s open onto the town\'s paving, and GATE-ROADS lays on from it to the ring round the ground (the audit\'s probe read the painter\'s tiles alone, 6 to 15 m out)', { skip: skipReal, timeout: 1_800_000 }, async () => {
  const f = await freeware(), isRoadTile = (v) => [46, 47, 55].includes(v & 0x3f) && v !== 0xff;
  const { getLocationTerrainTileOrigin } = await import('../../src/world/terrain/terrainTiles.js');
  for (const loc of f.cities.filter((c) => ['Naresa', 'Akhahanu', 'Menakat'].includes(c.name))) {
    const { job } = await placedYards(f, loc, { keep: false }), wall = walls.townWallOf(loc), o = getLocationTerrainTileOrigin(loc);
    assert.equal(wall.streetWays.length, 1, `${loc.name}: one street's gate`);
    const [sx, sz] = wall.streetWays[0], g = wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map(gateOpening).find((q) => Math.hypot(q.at[0] - sx, q.at[1] - sz) < 8);
    const road = (i) => !!job.paths[i] || isRoadTile(job.tilemap[i]);
    const start = Math.floor(o.x + (g.at[0] + g.out[0] * 9.6) / 6.4) + Math.floor(o.y + (g.at[1] + g.out[1] * 9.6) / 6.4) * D;
    assert.ok(road(start), `${loc.name}: a road just outside its gate`);
    const seen = new Set([start]), q = [start];
    let ring = false;
    while (q.length && !ring && seen.size < 64) {
      const i = q.shift(), x = i % D, y = (i - x) / D;
      if (job.paths[i] && !job.townGround[i]) ring = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const j = x + dx + (y + dy) * D;
        if (x + dx >= 0 && y + dy >= 0 && x + dx < D && y + dy < D && !seen.has(j) && road(j)) { seen.add(j); q.push(j); }
      }
    }
    assert.ok(ring, `${loc.name}: its road reaches the painted road off its ground`);
  }
});
