// GATE-ROADS (2026-10-28, the owner: "With cities, roads still do not like up properly with gates and pathways in the
// town. Gates can lead to a bunch of buildings and it just doesnt make any sense"; "No band aids or half assed work";
// bible/03-World/Town-Shapes.md GATE-ROADS).
//  - EVERY GATE ON ITS ROAD (world/road/gateRoads.js, the terrain kernel's): from the town's nearest street inside, through
//    the gate, out to the nearest road the painter laid - round every house, never over water or the wall, along the
//    town's own paving where it leads out; the painter's tiles and the town's paving kept as they lie.
//  - A GATE ON A STREET (world/townWalls.js gatesOnStreets): a wall on its outline moves each road's gate along it to where
//    a way in runs onto the town's paving before any house.
//  - THE GATES HANDED ON (world/townGates.js): a wall's gates, or a kept ring's (Daggerfall's, Beautiful Cities'), in the
//    pixel's tiles, with the tiles their roads may not cross; the pixel's build hands them to the kernel on its rect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { layGateRoads, gateWay, GATE_ROAD, GATE_BLOCK } from '../../src/world/road/gateRoads.js';
import { gatesOnStreets, opensOntoStreet, townStreets, townHouses, townWall, standTownWall, setTownWallPaths, townWallPathsReader, townWallBlockName, townWallCells, townWallGatesOf, wallPieces, gateOpening, GATE_WAY, GATE_OPENING, GATE_ARMS_MERGE, WALL_MODELS } from '../../src/world/townWalls.js';
import { townGateRoads, blockGates } from '../../src/world/townGates.js';
import { TOWN_OUTLINE_BLOCK, townOutlineBlockJson } from '../../src/world/townOutline.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { bayRoads } from '../bayRoads.mjs';   // OWN-WORK2

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const D = 128, TD = 129;
const idx = (x, y) => x + y * D;
const tileOf = (i) => [i % D, Math.floor(i / D)];

/** A pixel's ground for the kernel's law: grass corners, no tile painted - and its painter's paths. */
function ground() {
  return { tilemap: new Uint8Array(D * D), paths: new Uint8Array(D * D), tileData: new Uint8Array(TD * TD).fill(2), blocked: new Uint8Array(D * D) };
}
/** Whether tile `i` is a road's: a tile the paths hold, or paving. */
const isRoad = (g, i) => !!g.paths[i] || [46, 47, 55].includes(g.tilemap[i] & 0x3f);
/** Whether a run of road tiles joins tile `from` to one `goal(i)` says. */
function joins(g, from, goal) {
  const road = (i) => isRoad(g, i);
  const seen = new Set([from]), stack = [from];
  while (stack.length) {
    const i = stack.pop();
    if (goal(i)) return true;
    const [x, y] = tileOf(i);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = idx(x + dx, y + dy); if (x + dx >= 0 && y + dy >= 0 && x + dx < D && y + dy < D && !seen.has(j) && road(j)) { seen.add(j); stack.push(j); } }
  }
  return false;
}

test('GATE-ROADS the kernel\'s law: a gate in a wall is joined to the painter\'s road outside round a house, and to the town\'s street inside, its passage through the wall - every tile laid the road\'s own record, the paths holding it; never a house, the wall or water crossed; the painter\'s tiles and the town\'s paving kept as they lie (mutants: the passage uncarved; a house crossed; water crossed; the paving relaid; the paths unmarked)', () => {
  const g = ground();
  for (let x = 0; x < D; x++) { g.tilemap[idx(x, 20)] = 46 | 64; g.paths[idx(x, 20)] = 1; }   // the painter's road, turned
  for (let x = 0; x < D; x++) g.blocked[idx(x, 40)] = GATE_BLOCK.hard;   // the wall
  for (let y = 30; y <= 33; y++) for (let x = 58; x <= 70; x++) g.blocked[idx(x, y)] = GATE_BLOCK.hard;   // a house outside the gate
  for (let y = 46; y <= 80; y++) g.tilemap[idx(64, y)] = 46;   // the town's street
  const before = Uint8Array.from(g.tilemap);
  assert.equal(layGateRoads(g.tilemap, g.paths, g.tileData, { gates: [{ x: 64.5, y: 40.5, ox: 0, oy: -1 }], blocked: g.blocked }), 1);
  assert.ok(joins(g, idx(64, 46), (i) => i < 21 * D && i >= 20 * D), 'the town\'s street joined through the gate to the painter\'s road');
  let laid = 0;
  for (let i = 0; i < D * D; i++) {
    if (g.tilemap[i] === before[i]) continue;
    laid++;
    assert.equal(g.tilemap[i], 46, 'the road\'s own record, unturned');
    assert.equal(g.paths[i], 1, 'the paths hold it');
    assert.ok(g.blocked[i] !== GATE_BLOCK.hard || i === idx(64, 40), `no house nor the wall crossed but the gate's own tile (${tileOf(i)})`);
  }
  assert.ok(laid >= 22 && laid <= 60, `a road round the house, not a field of it (${laid})`);
  for (let x = 0; x < D; x++) assert.equal(g.tilemap[idx(x, 20)], 46 | 64, 'the painter\'s tiles kept, turned as it laid them');
  for (let y = 46; y <= 80; y++) { assert.equal(g.tilemap[idx(64, y)], 46); assert.equal(g.paths[idx(64, y)], 0, 'the town\'s paving its own'); }
  // water: a moat outside the wall - no road over it; with no way round, none laid
  const w = ground();
  for (let x = 0; x < D; x++) { w.tilemap[idx(x, 20)] = 46; w.paths[idx(x, 20)] = 1; w.blocked[idx(x, 40)] = GATE_BLOCK.hard; }
  for (let y = 33; y <= 36; y++) for (let x = 0; x < TD; x++) w.tileData[x + y * TD] = 0;
  const wb = Uint8Array.from(w.tilemap);
  assert.equal(layGateRoads(w.tilemap, w.paths, w.tileData, { gates: [{ x: 64.5, y: 40.5, ox: 0, oy: -1 }], blocked: w.blocked }), 0, 'a moat whole across: no road');
  assert.deepEqual(w.tilemap, wb, '...and nothing laid');
});

test('GATE-ROADS the opening: a gate\'s passage runs across its opening\'s width - an opening on a tile\'s edge opens onto both tiles, a tower before one the way through the other - and stops at water, never laying a tile of it (mutants: the opening\'s width unread; water walked)', () => {
  // a wall along row 61, its gate's opening's middle on the edge of columns 63 and 64; a tower before column 64 outside
  const lay = (half, wetRow = -1) => {
    const g = ground();
    for (let x = 0; x < D; x++) { g.tilemap[idx(x, 90)] = 46; g.paths[idx(x, 90)] = 1; g.blocked[idx(x, 61)] = GATE_BLOCK.hard; if (wetRow >= 0) g.tilemap[idx(x, wetRow)] = 0xff; }
    for (let y = 62; y <= 66; y++) for (let x = 64; x <= 66; x++) g.blocked[idx(x, y)] = GATE_BLOCK.hard;
    const before = Uint8Array.from(g.tilemap), n = layGateRoads(g.tilemap, g.paths, g.tileData, { gates: [{ x: 64, y: 61.5, ox: 0, oy: 1, half }], blocked: g.blocked });
    return { g, before, n };
  };
  const { g, n } = lay(GATE_OPENING.half / 6.4);
  assert.equal(n, 1, 'through the open column');
  assert.ok(joins(g, idx(63, 61), (i) => tileOf(i)[1] === 90), 'the gate joined to the painter\'s road');
  for (let y = 62; y <= 66; y++) for (let x = 64; x <= 66; x++) assert.equal(g.paths[idx(x, y)], 0, `the tower's tiles not laid (${x}, ${y})`);
  assert.equal(lay(0).n, 0, 'its middle\'s line alone meets the tower: the width is the way');
  // a row of water just outside the wall, land past it: the passage stops at it, and nothing is laid
  const w = lay(GATE_OPENING.half / 6.4, 62);
  assert.equal(w.n, 0, 'water before the open ground: no road');
  assert.deepEqual(w.g.tilemap, w.before, 'and no tile of water laid');
});

test('GATE-ROADS the way: the cheapest within GATE_ROAD.reach - along the town\'s paving where it leads out, round a model or a flat where the way round is short, straight where it can; none past the reach (mutants: the reach unread; the paving\'s cost; a flat\'s cost; the turn unread; a corner cut past a house)', () => {
  const free = () => 1;
  // straight where it can: a way 10 tiles south runs one column
  const s = gateWay(idx(30, 40), free, (i) => tileOf(i)[1] === 30);
  assert.ok(s.every((i) => tileOf(i)[0] === 30), 'straight down its column');
  // a goal 10 rows down and 6 over: every order of six diagonal and four straight steps is as short - the turn's cost
  // takes the one with a single bend
  const bent = gateWay(idx(30, 40), free, (i) => i === idx(36, 30)), steps = bent.slice(1).map((i, k) => i - bent[k]);
  assert.equal(steps.filter((d, k) => k && d !== steps[k - 1]).length, 1, 'one bend, not a zigzag');
  // the reach: a goal 41 tiles away is none
  assert.equal(gateWay(idx(30, 80), free, (i) => tileOf(i)[1] === 80 - Math.ceil(GATE_ROAD.reach) - 1), null);
  assert.ok(gateWay(idx(30, 80), free, (i) => tileOf(i)[1] === 80 - Math.floor(GATE_ROAD.reach) + 1), 'inside it, one');
  // a corner never cut between two houses touching at it
  const blockedAt = new Set([idx(31, 40), idx(30, 39)]);
  const corner = gateWay(idx(30, 40), (i) => (blockedAt.has(i) ? Infinity : 1), (i) => i === idx(31, 39));
  assert.ok(corner.length > 2, 'round the corner, not through it');
  // the town's paving out of its gate is the way: a street running out on the diagonal, the road along it
  const g = ground();
  for (let x = 0; x < D; x++) { g.tilemap[idx(x, 10)] = 46; g.paths[idx(x, 10)] = 1; g.blocked[idx(x, 40)] = GATE_BLOCK.hard; }
  for (let k = 0; k < 20; k++) g.tilemap[idx(64 + k, 37 - k)] = 46;   // the town's street out to the east
  layGateRoads(g.tilemap, g.paths, g.tileData, { gates: [{ x: 64.5, y: 40.5, ox: 0, oy: -1 }], blocked: g.blocked });
  let fresh = 0;
  for (let i = 0; i < D * D; i++) if (g.paths[i] && tileOf(i)[1] > 10) fresh++;
  assert.ok(fresh <= 20, `the road along the street, a short join at its end (${fresh} tiles laid)`);
  assert.ok(joins(g, idx(64, 37), (i) => tileOf(i)[1] === 10), 'joined');
  // a field of flats: the way round them when it is short
  const f = ground();
  for (let x = 0; x < D; x++) { f.tilemap[idx(x, 20)] = 46; f.paths[idx(x, 20)] = 1; f.blocked[idx(x, 40)] = GATE_BLOCK.hard; }
  for (let y = 25; y <= 35; y++) for (let x = 62; x <= 66; x++) f.blocked[idx(x, y)] = GATE_BLOCK.soft;
  layGateRoads(f.tilemap, f.paths, f.tileData, { gates: [{ x: 64.5, y: 40.5, ox: 0, oy: -1 }], blocked: f.blocked });
  for (let i = 0; i < D * D; i++) if (f.blocked[i] === GATE_BLOCK.soft) assert.equal(f.paths[i], 0, `round the flats (${tileOf(i)})`);
  assert.ok(GATE_ROAD.flat > 1 && GATE_ROAD.paved < 1 && GATE_ROAD.turn > 0);
});

/** A round town's line (counter-clockwise, metres) about (102.4, 102.4), radius 90, and its tiles: houses within 72 m but
 *  a street running in along bearing PHI (its paving the tiles within 4 m of its line, 20 to 76 m out). */
const PHI = Math.PI / 2 - 0.3;
function streetTown() {
  const W = 32, H = 32, pts = Array.from({ length: 720 }, (_, i) => /** @type {[number, number]} */ ([102.4 + 90 * Math.cos((2 * Math.PI * i) / 720), 102.4 + 90 * Math.sin((2 * Math.PI * i) / 720)]));
  const off = (x, y) => { const dx = x - 102.4, dy = y - 102.4, along = dx * Math.cos(PHI) + dy * Math.sin(PHI); return { along, aside: Math.abs(-dx * Math.sin(PHI) + dy * Math.cos(PHI)) }; };
  const houses = new Uint8Array(W * 4 * H * 4), streets = new Uint8Array(W * H);
  for (let cy = 0; cy < H * 4; cy++) for (let cx = 0; cx < W * 4; cx++) {
    const x = (cx + 0.5) * 1.6, y = (cy + 0.5) * 1.6, o = off(x, y);
    if (Math.hypot(x - 102.4, y - 102.4) < 72 && !(o.aside < 5 && o.along > 0)) houses[cy * W * 4 + cx] = 1;
  }
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { const o = off((tx + 0.5) * 6.4, (ty + 0.5) * 6.4); if (o.aside < 4 && o.along > 20 && o.along < 76) streets[ty * W + tx] = 1; }
  return { pts, town: { W, H, houses, streets } };
}

test('GATE-ROADS a gate on a street: a road\'s crossing moved along its wall, within GATE_WAY.reach, to the nearest point whose way in runs onto the town\'s paving before any house; one with no street near kept; two roads to one street one gate (mutants: the slide unread; the way\'s width unread; the paving\'s run unread; the reach unread; the merge dropped)', () => {
  const { pts, town } = streetTown();
  const north = /** @type {[number, number]} */ ([102.4, 192.4]);
  assert.equal(opensOntoStreet(north, [0, -1], town), false, 'the road\'s crossing faces houses');
  const [g] = gatesOnStreets(pts, [north], town);
  const want = [102.4 + 90 * Math.cos(PHI), 102.4 + 90 * Math.sin(PHI)];
  assert.ok(Math.hypot(g[0] - want[0], g[1] - want[1]) < 5, `moved along the wall to the street's end (${g.map((v) => v.toFixed(1))} for ${want.map((v) => v.toFixed(1))})`);
  const n = [102.4 - g[0], 102.4 - g[1]].map((v, _, a) => v / Math.hypot(...a));
  assert.ok(opensOntoStreet(g, /** @type {[number, number]} */ (n), town), 'and opens onto it');
  // a crossing on the far side: no street within reach - kept where its road comes in
  const south = /** @type {[number, number]} */ ([102.4, 12.4]);
  assert.deepEqual(gatesOnStreets(pts, [south], town), [south]);
  // two roads either side of the street: one gate
  const a = /** @type {[number, number]} */ ([102.4 + 90 * Math.cos(PHI + 0.25), 102.4 + 90 * Math.sin(PHI + 0.25)]), b = /** @type {[number, number]} */ ([102.4 + 90 * Math.cos(PHI - 0.25), 102.4 + 90 * Math.sin(PHI - 0.25)]);
  assert.equal(gatesOnStreets(pts, [a, b], town).length, 1, `merged within ${GATE_ARMS_MERGE} m`);
  // the paving's run: a tile of it and then a house is no street; two tiles of it are
  const lane = (paved) => { const W = 4, H = 5, houses = new Uint8Array(W * 4 * H * 4), streets = new Uint8Array(W * H); for (let t = 1; t <= paved; t++) streets[t * W + 1] = 1; for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) houses[((paved + 1) * 4 + r) * W * 4 + 4 + c] = 1; return { W, H, houses, streets }; };
  assert.deepEqual([opensOntoStreet([9.6, 0], [0, 1], lane(1)), opensOntoStreet([9.6, 0], [0, 1], lane(2))], [false, true]);
  // the way's width: a house a metre beside its middle stands in it
  const tight = lane(3); for (let r = 4; r < 16; r++) tight.houses[r * 16 + 7] = 1;
  assert.equal(opensOntoStreet([9.6, 0], [0, 1], tight), false, 'a house within the way\'s half width');
  assert.deepEqual({ ...GATE_WAY, reach: Math.round(GATE_WAY.reach * 10) / 10 }, { reach: 76.8, half: 2, depth: 48, paved: 12.8 }, 'three lengths of wall either way; a cart\'s way; two tiles of paving');
});

test('GATE-ROADS the gate\'s opening: its middle 3.185 m along the model\'s -x from its origin, 9.73 m wide (ARCH3D 446\'s floor face, x -8.05 to 1.68 m); a wall on its outline stands each gate\'s opening on its point, not its length\'s middle (mutants: the opening at the origin; the line\'s gate unshifted; the shift the wrong way)', () => {
  assert.deepEqual(GATE_OPENING, { along: -3.185, half: 4.865 });
  assert.ok(Math.abs(GATE_OPENING.along - (-8.05 + 1.68) / 2) < 1e-9 && Math.abs(GATE_OPENING.half - (1.68 + 8.05) / 2) < 1e-9, 'the floor face\'s middle and half width');
  // the model's +x is a piece's (out[1], -out[0]) (townWallModel), so a north-facing gate's opening lies to its west
  assert.deepEqual(gateOpening({ at: [100, 50], out: [0, 1] }).at, [100 - 3.185, 50]);
  assert.deepEqual(gateOpening({ at: [100, 50], out: [0, -1] }).at, [100 + 3.185, 50]);
  // a round wall's gates on four crossings: each opening on its crossing (within its chord's sag), its length's middle not
  const pts = Array.from({ length: 64 }, (_, k) => /** @type {[number, number]} */ ([200 + 150 * Math.cos((k / 64) * 2 * Math.PI), 200 + 150 * Math.sin((k / 64) * 2 * Math.PI)]));
  const crossings = /** @type {Array<[number, number]>} */ ([[350, 200], [200, 350], [50, 200], [200, 50]]);
  const gates = wallPieces(pts, [200, 200], crossings, { onLine: true }).filter((p) => p.model === WALL_MODELS.gate);
  assert.equal(gates.length, 4);
  for (const q of crossings) {
    const g = gates.find((p) => Math.hypot(gateOpening(p).at[0] - q[0], gateOpening(p).at[1] - q[1]) < 1);
    assert.ok(g, `an opening on ${q}`);
    assert.ok(Math.hypot(g.at[0] - q[0], g.at[1] - q[1]) > 3, 'its length\'s middle off it, the opening\'s offset');
  }
});

test('GATE-ROADS a town\'s streets and houses off its blocks: the ground tiles Daggerfall paves (46, 47, 55) in the town\'s tile frame, a house\'s and a wall\'s town-map bytes in its cells - its ground flats aside (mutants: the row unflipped; the flats a house)', () => {
  const gt = Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (_, r) => ({ textureRecord: tx === 3 && r === 0 ? 46 : tx === 5 && r === 15 ? 55 : 2 })));
  const am = new Uint8Array(4096); am[0] = 7; am[63 * 64 + 1] = 0xfb;
  const s = townStreets(1, 1, () => ({ fldHeader: { groundData: { groundTiles: gt } } }));
  assert.deepEqual([...s.keys()].filter((i) => s[i]), [5, 15 * 16 + 3], 'a block\'s ground tile (tx, 15 - ty)');
  const h = townHouses(1, 1, () => ({ fldHeader: { autoMapData: am } }));
  assert.deepEqual([...h.keys()].filter((i) => h[i]), [63 * 64], 'the town map\'s row r the cell row 63 - r; a ground flat none');
});

/** A location of 3 x 3 blocks whose ring kept (a town mod's, Daggerfall's): `gates` [x, z, rotation, bx, by, own] - a
 *  subrecord in block (bx, by), its gate model turned by `own` on it; a house in the middle block; a flat in another. */
function ringTown(gates) {
  const names = ['A.RMB', 'B.RMB', 'C.RMB', 'D.RMB', 'H.RMB', 'E.RMB', 'F.RMB', 'G.RMB', 'I.RMB'];
  const house = new Uint8Array(4096); for (let r = 20; r < 40; r++) for (let c = 20; c < 40; c++) house[r * 64 + c] = 9;
  const rmb = (name) => {
    const k = names.indexOf(name), bx = k % 3, by = Math.floor(k / 3);
    const subRecords = gates.filter((q) => q[3] === bx && q[4] === by).map(([x, z, rot, , , own = 0]) => ({ xPos: x, zPos: z, yRotation: rot, exterior: { block3dObjectRecords: [{ modelIdNum: WALL_MODELS.gate, xPos: 0, zPos: 0, yRotation: own }] } }));
    return { fldHeader: { autoMapData: name === 'H.RMB' ? house : null }, subRecords, misc3dObjectRecords: [], miscFlatObjectRecords: name === 'B.RMB' ? [{ xPos: 1024, zPos: -2048 }] : [] };
  };
  const loc = { mapTableData: { mapId: 1 }, exterior: { exteriorData: { width: 3, height: 3, blockNames: names } } };
  const maps = { getRmbBlockName: (l, bx, by) => names[by * 3 + bx] };
  const blocks = { checkName: (n) => n, getBlockIndex: (n) => names.indexOf(n), getBlock: (i) => ({ rmbBlock: rmb(names[i]) }) };
  return { loc, maps, blocks };
}

test('GATE-ROADS the gates handed on: a kept ring\'s gate models\' openings in the pixel\'s tiles, facing out by their subrecord\'s turn and their own, with the opening\'s half width; its houses hard, its flats soft; a capital none, a town with no gate none (mutants: the turn unread; the model\'s own turn unread; the origin unshifted; the houses unmarked; the flats hard)', () => {
  const { loc, maps, blocks } = ringTown([[2048, 3584, 0, 1, 0], [2048, 512, 1024, 1, 2]]);
  const gr = townGateRoads(loc, maps, blocks);
  const o = 40;   // (128 - 3 x 16) / 2
  assert.equal(gr.gates.length, 2);
  const [s, n] = gr.gates;
  const A = GATE_OPENING.along, r2 = (v) => Math.round(v * 100) / 100;
  assert.ok(Math.abs(s.x - (o + (153.6 + A) / 6.4)) < 1e-9 && Math.abs(s.y - (o + 12.8 / 6.4)) < 1e-9 && Math.abs(s.ox) < 1e-9 && s.oy === 1, `a gate in the south block, unturned - its opening west of its origin: ${JSON.stringify(s)}`);
  assert.ok(Math.abs(n.oy + 1) < 1e-9 && Math.abs(n.ox) < 1e-9, 'half turned: facing the other way');
  assert.equal(s.half, GATE_OPENING.half / 6.4, 'the opening\'s half width, in tiles');
  assert.deepEqual(blockGates(3, 3, (bx, by) => blocks.getBlock(by * 3 + bx).rmbBlock).map((g) => g.at.map(r2)), [[153.6 + A, 12.8], [153.6 - A, 294.4]].map((a) => a.map(r2)));
  const own = ringTown([[2048, 2048, 0, 1, 1, 512]]).blocks, [q] = blockGates(3, 3, (bx, by) => own.getBlock(by * 3 + bx).rmbBlock);
  assert.ok(Math.abs(q.out[0] + 1) < 1e-9 && Math.abs(q.out[1]) < 1e-9, `the model turned a quarter on its subrecord: facing west (${q.out})`);
  // the house's cells (block (1, 1), rows 20-39 and columns 20-39) its tiles hard; the flat soft
  const hard = [...gr.blocked.keys()].filter((i) => gr.blocked[i] === GATE_BLOCK.hard).map(tileOf);
  assert.ok(hard.length === 25 && hard.every(([x, y]) => x >= o + 21 && x <= o + 25 && y >= o + 22 && y <= o + 26), `the house's tiles (${hard.length})`);
  const soft = [...gr.blocked.keys()].filter((i) => gr.blocked[i] === GATE_BLOCK.soft).map(tileOf);
  assert.deepEqual(soft, [[o + 16 + 4, o + 8]], 'the flat\'s own tile');
  assert.equal(townGateRoads({ ...loc, capital: { k: 1 } }, maps, blocks), null, 'a capital: its own approaches');
  assert.equal(townGateRoads(ringTown([]).loc, ringTown([]).maps, ringTown([]).blocks), null, 'no gate, no roads');
});

test('GATE-ROADS a wall on its outline hands its gates\' openings as it stands them, and its cells hard; a wall still waiting for its roads hands none (mutants: the wall unread; the wall\'s openings unread; the fabric off the origin; the wall\'s cells unmarked; the wait ignored)', () => {
  const houses = new Uint8Array(4096);
  for (let r = 8; r < 56; r++) for (let c = 8; c < 56; c++) houses[r * 64 + c] = 5;
  const served = { 'H.RMB': { rmbBlock: { fldHeader: { autoMapData: houses }, misc3dObjectRecords: [], miscFlatObjectRecords: [], subRecords: [] } } };
  const template = ['WALLAA02.RMB', 'WALLAA10.RMB', 'WALLAA03.RMB', 'WALLAA07.RMB', 'H.RMB', 'WALLAA05.RMB', 'WALLAA00.RMB', 'WALLAA08.RMB', 'WALLAA01.RMB'];
  const make = (serial, px) => {
    const mapId = ((0xa7 << 20) | serial) >>> 0;
    return { mapTableData: { mapId, longitude: px * 128, latitude: (499 - 200) * 128 }, exterior: { exteriorData: { width: 3, height: 3, blockNames: [townWallBlockName(mapId), ...template.slice(1).map((n) => (n === 'H.RMB' ? n : TOWN_OUTLINE_BLOCK))] } }, outline: { kept: 1, left: 8, walled: true } };
  };
  const maps = { getRmbBlockName: (l, bx, by) => l.exterior.exteriorData.blockNames[by * 3 + bx] };
  const blocks = { checkName: (n) => n, getBlockIndex: (n) => (served[n] ? 0 : -1), getBlock: () => served['H.RMB'] };
  try {
    setTownWallPaths((px) => (px === 301 ? null : { roads: DIR.E | DIR.W, tracks: 0, curved: false }));
    const loc = make(610001, 300);
    const wall = standTownWall(loc, template, (n) => served[n] ?? null, townOutlineBlockJson);
    const gr = townGateRoads(loc, maps, blocks);
    const want = wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map(gateOpening).map((p) => ({ x: 40 + p.at[0] / 6.4, y: 40 + p.at[1] / 6.4, ox: p.out[0], oy: p.out[1], half: GATE_OPENING.half / 6.4 }));
    assert.deepEqual(gr.gates, want, 'the wall\'s own gates\' openings, in the pixel\'s tiles');
    assert.deepEqual(townWallGatesOf(loc), wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map(gateOpening), 'and the town\'s fabric its main streets off the same openings');
    const cells = townWallCells(wall, 3, 3);
    for (let cy = 0; cy < 192; cy += 3) for (let cx = 0; cx < 192; cx += 3) if (cells[cy * 192 + cx]) assert.equal(gr.blocked[40 + Math.floor(cx / 4) + (40 + Math.floor(cy / 4)) * D], GATE_BLOCK.hard, 'the wall hard');
    const waiting = make(610002, 301);
    standTownWall(waiting, template, (n) => served[n] ?? null, townOutlineBlockJson);
    assert.equal(townGateRoads(waiting, maps, blocks), null, 'its roads not known: none (its pixel is built again when they land)');
  } finally { setTownWallPaths(null); }
});

test('GATE-ROADS the wiring: the pixel\'s build hands the town\'s gates on its rect, and the kernel lays their roads after the painter and its smoothing - Basic Roads\' tiles and the ground\'s heights their own; the worker\'s reach under world/ (mutants: the gates never handed; the roads never laid; laid before the painter)', () => {
  assert.match(rd('src/scenes/pixelBuild.js'), /\n {4}if \(groundLocation\) locationRect = setLocationTiles\(groundLocation, maps, blocks, seedTilemap\);\n {4}if \(locationRect\) locationRect\.gateRoads = townGateRoads\(groundLocation, maps, blocks\);/);
  const gen = rd('src/world/terrain/terrainGen.js');
  const paint = gen.indexOf('paintRoads(tileData, tilemap'), smooth = gen.indexOf('if (roads.smooth !== false && classic) smoothRoadHeights('), lay = gen.indexOf('layGateRoads(tilemap, paths, tileData, locationRect.gateRoads, locationRect.mask)');   // PIN MOVED (FB1028): and the town's ground
  assert.ok(paint > 0 && smooth > paint && lay > smooth, 'after the painter and its smoothing');
  assert.match(gen, /\n {4}if \(hasLocation && locationRect\?\.gateRoads\) layGateRoads\(tilemap, paths, tileData, locationRect\.gateRoads, locationRect\.mask\);/);
  assert.doesNotMatch(rd('src/world/road/gateRoads.js'), /from '\.\.\/\.\.\/(scenes|render|ui|systems)\//, 'the worker\'s: no scene, renderer or system');
});

// ── WITH ARENA2: the freeware's cities ──────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['BLOCKS.BSA', 'MAPS.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2, f)));
test('GATE-ROADS with ARENA2: the Bay\'s walled cities on their outline - their gates on streets where a sixth of their roads\' crossings were; one in four of the rest every gate joined to the painter\'s roads where two in five were; past the Bay every sixth city\'s every gate on the road; the gate model\'s floor its opening (mutants: the roads never laid; the slide unread)', { skip: HAVE ? false : 'ARENA2_PATH not set', timeout: 900_000 }, async () => {
  // the gate model's opening (GATE_OPENING): its floor face, every point at the ground, x -8.05 to 1.68 m of its frame
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const floor = arch.getMesh(arch.getRecordIndex(WALL_MODELS.gate)).subMeshes.flatMap((m) => m.planes).filter((f) => f.points.every((q) => q.y === 0));
  const xs = floor.flatMap((f) => f.points.map((q) => q.x / 40)), x0 = Math.min(...xs), x1 = Math.max(...xs);
  assert.ok(floor.length === 1 && Math.abs(x0 - (GATE_OPENING.along - GATE_OPENING.half)) < 0.01 && Math.abs(x1 - (GATE_OPENING.along + GATE_OPENING.half)) < 0.01, `one floor face, ${x0} to ${x1} m`);
  const { wallBayCity } = await import('../../src/world/townOutline.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { isWallCarrier } = await import('../../src/world/townShape.js');
  const { roads: roadsB, tracks: tracksB } = bayRoads();   // OWN-WORK2: the Bay's own network
  const pixelOf = (loc) => ({ px: Math.trunc(loc.mapTableData.longitude / 128), py: 499 - Math.trunc(loc.mapTableData.latitude / 128) });
  // the Bay's cities walled on their outline, their gates where their roads come in and onto a street
  const blocks = new BlocksFile(); blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const maps = new MapsFile(); maps.load(...['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].map((f) => new Uint8Array(readFileSync(join(ARENA2, f))))); maps.autoDiscard = false;
  const rmbOf = (n) => (isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? null : blocks.getBlockByName(n)?.rmbBlock ?? null);
  let gates = 0, onStreet = 0, crossings = 0, crossingOnStreet = 0;
  for (let r = 0; r < 62; r++) {
    const reg = maps.getRegion(r);
    for (let l = 0; reg && l < reg.locationCount; l += 3) {
      const loc = maps.getLocation(r, l);
      if (!loc?.exterior?.exteriorData?.blockNames?.some((x) => /^WALLAA/.test(x)) || !wallBayCity(loc, maps, blocks)) continue;
      const { px, py } = pixelOf(loc), i = py * 1000 + px, ed = loc.exterior.exteriorData, w = ed.width, h = ed.height;
      const wall = townWall(loc, ed.wallTook, rmbOf, { roads: roadsB[i], tracks: tracksB[i], curved: false });
      const at = (bx, by) => rmbOf(ed.blockNames[by * w + bx]), town = { W: w * 16, H: h * 16, houses: townHouses(w, h, at), streets: townStreets(w, h, at) };
      for (const g of wall.pieces.filter((q) => q.model === WALL_MODELS.gate).map(gateOpening)) { gates++; if (opensOntoStreet(g.at, [-g.out[0], -g.out[1]], town)) onStreet++; }
      const L = wall.line;
      for (const q of wall.roads) {
        let k = 0, best = Infinity;
        L.forEach((p, j) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < best) { best = d; k = j; } });
        const a = L[(k + L.length - 1) % L.length], c = L[(k + 1) % L.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        crossings++; if (opensOntoStreet(q, [-(c[1] - a[1]) / len, (c[0] - a[0]) / len], town)) crossingOnStreet++;
      }
    }
  }
  // PIN MOVED (OWN-WORK2): over 400 gates, 85% and more on a street, on Basic Roads' arrays; 241 of 284 on the Bay's own network
  assert.ok(gates > 250 && onStreet / gates > 0.8 && crossingOnStreet / crossings < 0.25, `on their outline: ${onStreet} of ${gates} gates on a street, where ${crossingOnStreet} of ${crossings} crossings were`);
  const { openSweep, sweepClone, ROADS_EVERY_WAY } = await import('../../tools/townBoardsSweep.mjs');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const sw = await openSweep(ARENA2);
  const lay = (loc, px, py, roads, tracks, gates) => { const tm = new Uint8Array(D * D), rect = setLocationTiles(loc, sw.maps, sw.blocks, tm); if (gates) rect.gateRoads = gates; return generatePixelTerrain({ woods: sw.woodsOf(), px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads, tracks, smooth: true } }); };
  // a gate on the road: a road's tile just outside its opening (across its width) joined to the painter's
  const onRoad = (job, painter, g) => {
    const g2 = { tilemap: job.tilemap, paths: job.paths }, h = g.half / 2;
    for (let t = 1; t <= 3.5; t += 0.5) for (const j of [0, -h, h]) {
      const x = Math.floor(g.x + g.ox * t - g.oy * j), y = Math.floor(g.y + g.oy * t + g.ox * j);
      if (x >= 0 && y >= 0 && x < D && y < D && isRoad(g2, idx(x, y)) && joins(g2, idx(x, y), (i) => painter[i] === 1)) return true;
    }
    return false;
  };
  const tally = (cities, roadsOf) => {
    const n = { gates: 0, before: 0, after: 0 };
    for (const loc of cities) {
      const { px, py } = pixelOf(loc), [roads, tracks] = roadsOf(px, py), gr = townGateRoads(loc, sw.maps, sw.blocks);
      if (!gr) continue;
      const plain = lay(loc, px, py, roads, tracks, null), laid = lay(loc, px, py, roads, tracks, gr);
      if (!plain.paths || !roads[py * 1000 + px]) continue;   // OWN-WORK2: a city on the sea's own pixel (Antelibuton) has no road to join
      for (const g of gr.gates) { n.gates++; if (onRoad(plain, plain.paths, g)) n.before++; if (onRoad(laid, plain.paths, g)) n.after++; }
    }
    return n;
  };
  // PIN MOVED (OWN-WORK3): online the Bay stood Beautiful Cities' rings, every sixth one's 250 gates and more on the road where
  // a third were. With the packs retired every Bay city is walled on its outline (the sweep's rows, TS7), its gates where its
  // roads come in (the host's reader). A wall is registered once a city (townWalls.js), so none of those read above: every
  // fourth of the rest.
  const bay = sw.rows.filter((l) => l.outline?.bay && l.locationIndex % 3 !== 0).filter((_, k) => k % 4 === 0);
  setTownWallPaths(townWallPathsReader({ bay: () => ({ roads: roadsB, tracks: tracksB }) }));
  let b;
  try { b = tally(bay, () => [roadsB, tracksB]); } finally { setTownWallPaths(null); }
  // 61 of 151 measured before
  assert.ok(b.gates > 120 && b.after === b.gates && b.before / b.gates < 0.5, `the Bay's gates on the road: ${b.before} of ${b.gates} before, ${b.after} now`);
  // past the Bay: every sixth city template, walled on its outline, a road every way
  setTownWallPaths(() => ({ roads: ROADS_EVERY_WAY, tracks: 0, curved: false }));
  try {
    const past = [];
    for (let j = 0; j < sw.templates['city-state'].length; j += 6) { const loc = sweepClone(sw, 'city-state', j); if (loc.outline?.walled) past.push(loc); }
    const p = tally(past, (px, py) => { const r = new Uint8Array(1000 * 500); r[py * 1000 + px] = ROADS_EVERY_WAY; return [r, new Uint8Array(1000 * 500)]; });
    assert.ok(p.gates > 300 && p.after === p.gates && p.before / p.gates < 0.6, `past the Bay: ${p.before} of ${p.gates} before, ${p.after} now`);
  } finally { setTownWallPaths(null); }
});
