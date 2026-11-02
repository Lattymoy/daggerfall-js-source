// IC-BACKYARD (2026-10-29, the owner: "not all houses in imperial city are void of yards"): AN IMPERIAL CITY HOUSE'S YARD IS
// THE COURT BEHIND IT (world/imperialBackyards.js) - pinned over the fabric's own cells (the plan is pure: no ARENA2), the
// lot it makes (scenes/homeYards.js lotOfFrame) and the owner opening it at the door; beside a Bay house, whose lot is the
// one it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fabricBackyard, fabricBackyardOf, fabricRecordOrigin, BACKYARD } from '../../../src/world/imperialBackyards.js';
import { fabricCellBuildings, subRecordFrame, fabricDoorModelId } from '../../../src/world/imperialFabricBuildings.js';
import { fabricGroundAt, fabricCell, GROUND, WELL, outwardOf } from '../../../src/world/imperialFabric.js';
import { imperialOwnName, imperialFarName } from '../../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS } from '../../../src/world/imperialCity.js';
import { BLOCK_M } from '../../../src/world/blockHash.js';
import { layoutRmbBlock } from '../../../src/world/rmbLayout.js';
import { lotOfFrame, lotAxes, lotBox, yardLot, yardWhyNot, yardHolds, yardLotEdges, yardRoadsOf, createHomeYards, YARD_MARGIN, YARD_OFF_LOT, YARD_ON_OTHER } from '../../../src/scenes/homeYards.js';
import { RMB_TILE_SIDE } from '../../../src/world/locationEntrance.js';
import { TERRAIN_TILE_DIM } from '../../../src/world/terrain/terrainSurface.js';
import { DECOR_FLY_LEASH } from '../../../src/scenes/decor/decorTool.js';
import { DECOR_YARD_POS_MAX } from '../../../src/net/decorLaw.js';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle, townCellsApi } from '../../decorFakes.mjs';

const HALF = IMPERIAL_CELLS / 2;
/** Two blocks' corner of the city where two neighbourhoods meet (another block's court lies over a court there, and a
 *  garden wall's end stands between the survey's points), and the one house in thousands its door's reach cuts short. */
const PATCH = [[51, 85], [51, 86], [52, 85], [52, 86]];
const REACHED = [63, 72, 17];
/** A row through a block whose back - a street front - stands over another block's court across the street. */
const ROW = [63, 114, 0];
/** AUDIT IC-BACKYARD T1: where two neighbourhoods meet, one's houses standing in the other's court (their back walls 6 to
 *  11 m off its edges); P5: a court whose yard reaches under a well's roof. */
const SEAM = [75, 75], ROOFED = [58, 103];
/** The yards of the PATCH as built - their count and their ground, m2 to the hundredth: a change to the law says what it
 *  does to the pieces already standing in them (AUDIT IC-BACKYARD T2, P3). */
const PATCH_YARDS = { count: 127, area: 6907.76 };
const GROUND_TILES = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, isRotated: false, isFlipped: false })));
/** A yard's point (on its own axes) in the city's metres - its frame's axes x east, z north, from its record's origin. */
const cityOf = (at, y, u, v) => {
  const c = Math.cos(y.turn), s = Math.sin(y.turn), x = u * c - v * s, z = u * s + v * c;
  return [at[0] + x, at[1] - z];
};
const cornersOf = (at, y) => { const [u0, v0, u1, v1] = y.lot; return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => cityOf(at, y, u, v)); };
/** How far apart two convex quads stand along their best separating axis - under 0 where they overlap. */
function quadsApart(a, b) {
  let best = -Infinity;
  for (const q of [a, b]) for (let i = 0; i < 4; i++) {
    const p0 = q[i], p1 = q[(i + 1) & 3], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ax = [(p0[1] - p1[1]) / l, (p1[0] - p0[0]) / l];
    const along = (s) => s.map((p) => p[0] * ax[0] + p[1] * ax[1]);
    best = Math.max(best, Math.min(...along(b)) - Math.max(...along(a)), Math.min(...along(a)) - Math.max(...along(b)));
  }
  return best;
}
const yardsOf = (cells) => cells.flatMap(([r, c]) => fabricCellBuildings(r, c).map((b) => {
  const at = fabricRecordOrigin(r, c, b);
  return { r, c, b, at, y: fabricBackyard(b, at) };
}));

test('IC-BACKYARD: a house with one street front owns the court behind it - all of it court ground, behind its own back wall, under no well\'s roof, within its door\'s reach - and no two yards come within 0.25 m, where two neighbourhoods meet too; a corner house and a row through a block have none; the PATCH\'s yards as built (mutants: one front unasked; the rivals unread; their own side\'s counted; a back range a rival; the gap dropped; the roofs unread; the edges unwalked; the reach unread or halved; the first rectangle kept; the yard unturned)', () => {
  const all = yardsOf([...PATCH, REACHED.slice(0, 2), ROW.slice(0, 2), SEAM, ROOFED]);
  const one = all.filter(({ b }) => (b.plot.out & 15) === 1 << b.door.edge), yards = all.filter((h) => h.y);
  assert.ok(yards.length >= one.length / 2 && yards.length >= 150, `most houses with one street front have a yard (${yards.length} of ${one.length})`);
  for (const { r, c, b, at, y } of all) {
    const id = `${r},${c} #${b.recordIndex}`;
    const fronts = [0, 1, 2, 3].filter((e) => b.plot.out & (1 << e)).length;
    if (fronts !== 1) { assert.equal(y, null, `${id}: ${fronts} street fronts, no court of its own`); continue; }
    if (!y) continue;
    const [u0, v0, u1, v1] = y.lot;
    assert.ok(u1 - u0 >= BACKYARD.min - 1e-9 && v1 - v0 >= BACKYARD.min - 1e-9, `${id}: no side under ${BACKYARD.min} m`);
    const wells = [...new Set([[r, c], ...cornersOf(at, y).map(([x, z]) => [Math.floor(z / BLOCK_M + HALF), Math.floor(x / BLOCK_M + HALF)])].map((k) => k.join(',')))]
      .flatMap((k) => fabricCell(...k.split(',').map(Number)).ground.wells);
    for (let u = u0; u <= u1 + 1e-9; u += 0.1) for (let v = v0; v <= v1 + 1e-9; v += 0.1) {
      const [x, z] = cityOf(at, y, u, v);
      assert.equal(fabricGroundAt(x, z), GROUND.court, `${id}: court ground at ${u.toFixed(2)},${v.toFixed(2)}`);
      assert.ok(!wells.some((w) => Math.abs(x - w[0]) <= WELL.r + WELL.eave && Math.abs(z - w[1]) <= WELL.ridge), `${id}: under no well's roof at ${u.toFixed(2)},${v.toFixed(2)}`);
    }
    // behind its back wall: every corner out past it, and the yard no wider than the house
    const k = (b.door.edge + 2) & 3, A = b.plot.q[k], n = outwardOf(b.plot.q, k), Bq = b.plot.q[(k + 1) & 3];
    const len = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]), t = [(Bq[0] - A[0]) / len, (Bq[1] - A[1]) / len];
    for (const [x, z] of cornersOf(at, y)) {
      const along = (x - A[0]) * t[0] + (z - A[1]) * t[1], out = (x - A[0]) * n[0] + (z - A[1]) * n[1];
      assert.ok(out >= BACKYARD.back - 1e-6 && along >= BACKYARD.side - 1e-6 && along <= len - BACKYARD.side + 1e-6, `${id}: behind its own back wall`);
      assert.ok(Math.hypot(x - at[0], z - at[1]) <= BACKYARD.reach + 1e-6, `${id}: within ${BACKYARD.reach} m of its door`);
    }
  }
  for (let i = 0; i < yards.length; i++) for (let j = i + 1; j < yards.length; j++) {
    const a = yards[i], b = yards[j], gap = quadsApart(cornersOf(a.at, a.y), cornersOf(b.at, b.y));
    assert.ok(gap >= 0.25, `${a.r},${a.c} #${a.b.recordIndex} and ${b.r},${b.c} #${b.b.recordIndex}: ${gap.toFixed(3)} m apart`);
  }
  const reached = yards.find(({ r, c, b }) => r === REACHED[0] && c === REACHED[1] && b.recordIndex === REACHED[2]);
  assert.ok(reached && Math.max(...cornersOf(reached.at, reached.y).map(([x, z]) => Math.hypot(x - reached.at[0], z - reached.at[1]))) > 30, 'the house its reach cuts short reaches past 30 m from its door');
  const row = all.find(({ r, c, b }) => r === ROW[0] && c === ROW[1] && b.recordIndex === ROW[2]);
  assert.ok(row && row.b.plot.out === 0b0101 && row.y === null, 'a row through a block: no yard across the street behind it');
  const patch = yardsOf(PATCH).filter((h) => h.y);
  const area = patch.reduce((sum, { y }) => sum + (y.lot[2] - y.lot[0]) * (y.lot[3] - y.lot[1]), 0);
  assert.deepEqual({ count: patch.length, area: Math.round(area * 100) / 100 }, PATCH_YARDS, 'the PATCH\'s yards as built');
});

test('IC-BACKYARD: the yard stands in its record\'s frame - the origin Daggerfall\'s own layout places the record at (world/rmbLayout.js), x east and z north - and the decorator reaches it: inside the free eye\'s leash and the service\'s bound (mutant: the door for the origin)', () => {
  assert.ok(BACKYARD.reach < DECOR_FLY_LEASH && BACKYARD.reach <= DECOR_YARD_POS_MAX, 'the reach inside the leash and the bound');
  const [r, c] = PATCH[2];
  for (const b of fabricCellBuildings(r, c)) {
    const f = subRecordFrame(r, c, b), door = { modelId: String(fabricDoorModelId(b.donor)), modelIdNum: fabricDoorModelId(b.donor), xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 };
    const block = { rmbBlock: { subRecords: [{ xPos: f.xPos, zPos: f.zPos, yRotation: f.yRotation, exterior: { block3dObjectRecords: [door] } }], misc3dObjectRecords: [], miscFlatObjectRecords: [], fldHeader: { groundData: { groundTiles: GROUND_TILES } } } };
    const placed = layoutRmbBlock(block).models[0];
    // the block's frame: x east and z north of its south-west corner - the city's metres turned back
    const at = [(c - HALF) * BLOCK_M + placed.recordAt[0], (r + 1 - HALF) * BLOCK_M - placed.recordAt[2]];
    const origin = fabricRecordOrigin(r, c, b);
    assert.ok(Math.abs(origin[0] - at[0]) < 1e-5 && Math.abs(origin[1] - at[1]) < 1e-5, `#${b.recordIndex}: the record's own origin (its matrix a float32's)`);
    assert.ok(Math.hypot(origin[0] - b.door.at[0], origin[1] - b.door.at[1]) < 0.03, `#${b.recordIndex}: at its door, to Daggerfall's unit`);
    assert.deepEqual(fabricBackyardOf(imperialOwnName(r, c), b.recordIndex), fabricBackyard(b, origin), `#${b.recordIndex}: by its block's name and record`);
  }
  assert.equal(fabricBackyardOf(imperialFarName(r, c), 0), null, 'a far block: none');
  assert.equal(fabricBackyardOf('BLACAA01.RMB', 0), null, 'a block of Daggerfall\'s: none');
});

test('IC-BACKYARD: the lot is the yard, turned with its house and its own - a piece in it stands, beside another\'s line or not; one at the door or past its edge does not; the lot\'s edge is drawn round it - while a Bay house\'s lot is the one it was (mutants: the turn unread; the yard\'s lot not alone; its marks unturned; its box unturned; a road\'s holes cut on its axes)', () => {
  const turned = yardsOf(PATCH).find(({ y }) => y && Math.abs(Math.sin(2 * y.turn)) > 0.5);
  assert.ok(turned, 'a house turned well off the axes');
  const { r, c, b } = turned;
  const y = fabricBackyard(b, fabricRecordOrigin(r, c, b));
  const frame = { at: [0, 0, 0], box: [-0.9, 0, -0.3, 0.9, 2.8, 0.3], rects: [[-0.9, -0.3, 0.9, 0.3]], terraced: true, block: imperialOwnName(r, c), record: b.recordIndex };
  const lot = lotOfFrame(frame);
  assert.deepEqual(lot.lot, y.lot, 'the yard');
  assert.equal(lot.turn, y.turn, 'turned with its house');
  assert.deepEqual(lot.access, lot.house, 'opened at its door');
  const [u0, v0, u1, v1] = y.lot, back = (u, v) => { const cs = Math.cos(y.turn), sn = Math.sin(y.turn); return [u * cs - v * sn, 0, u * sn + v * cs]; };
  const mid = back((u0 + u1) / 2, (v0 + v1) / 2);
  assert.deepEqual(lotAxes(lot, mid[0], mid[2]).map((v) => +v.toFixed(9)), [(u0 + u1) / 2, (v0 + v1) / 2].map((v) => +v.toFixed(9)), 'a point there and back');
  assert.equal(yardWhyNot(mid, lot), null, 'a piece in the middle of the yard stands');
  const foot = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]];
  assert.equal(yardWhyNot(back(u0 + 0.6, v0 + 0.6), lot, [], foot), null, 'a piece in its corner stands (its foot on the frame\'s axes, turned against the yard\'s)');
  assert.equal(yardWhyNot(back(u0 + 0.3, v0 + 0.3), lot, [], foot), YARD_OFF_LOT, 'its foot\'s corner past the yard\'s edge');
  assert.equal(yardWhyNot([0, 0, 1.5], lot), YARD_OFF_LOT, 'a piece at the door does not');
  assert.equal(yardWhyNot(back(u1 + 0.3, (v0 + v1) / 2), lot), YARD_OFF_LOT, 'a piece past its edge does not');
  // the bounding box of its turned corners - a corner past it on the frame's axes is off the yard's own
  const [bx0, bz0, bx1, bz1] = lotBox(lot);
  for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]) { const [x, , z] = back(u, v); assert.ok(x >= bx0 - 1e-9 && x <= bx1 + 1e-9 && z >= bz0 - 1e-9 && z <= bz1 + 1e-9, 'the box holds its corners'); }
  assert.equal(yardWhyNot([bx0 + 0.05, 0, bz0 + 0.05], lot), YARD_OFF_LOT, 'the box\'s corner is off the turned yard');
  // AUDIT IC-BACKYARD T3: the road under a turned lot is read over its box on the frame's axes - a path tile under the
  // yard itself, past the rectangle its own numbers make on the frame's; and no road square cuts a turned lot's sides
  const S = RMB_TILE_SIDE, N = TERRAIN_TILE_DIM, o = [10 * S, 0, 10 * S], far = back(u1 - 0.5, v1 - 0.5);
  const tx = Math.floor((o[0] + far[0]) / S), tz = Math.floor((o[2] + far[2]) / S), paths = new Uint8Array(N * N);
  paths[tz * N + tx] = 1;
  const roads = yardRoadsOf({ tilemapBytes: new Uint8Array(N * N), paths }, o, lot);
  assert.deepEqual(roads, [[tx * S - o[0], tz * S - o[2], (tx + 1) * S - o[0], (tz + 1) * S - o[2]]], 'the path tile under the turned yard');
  assert.equal(yardLotEdges(lot, [[u0 + 0.5, v0 - 1, u0 + 1.5, v1 + 1]]).length, 4, 'a road square across its own numbers cuts no side');
  // its line is the fabric's: another's ground nearer than its door is no midline to it
  const line = [[mid[0] + 1.5, mid[2] - 0.5, mid[0] + 2.5, mid[2] + 0.5]];
  assert.equal(yardWhyNot(mid, lot, [], [], [], line), null, 'beside another\'s ground, nearer than its own door');
  assert.equal(yardWhyNot(mid, { ...lot, alone: false }, [], [], [], line), YARD_ON_OTHER, 'the midline would have taken it');
  // the marked edge: its four sides, turned back onto the frame - every end a corner of the yard
  const edges = yardLotEdges(lot);
  assert.equal(edges.length, 4, 'four sides');
  const ends = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => back(u, v));
  for (const [ax, az, bx, bz] of edges) for (const [x, z] of [[ax, az], [bx, bz]]) assert.ok(ends.some((e) => Math.hypot(e[0] - x, e[2] - z) < 1e-6), 'each end a corner of the turned yard');
  // a Bay house: as it was - grown round its own ground, unturned, its midline its neighbours'
  const bay = { at: [10, 0, 10], box: [9, 0, 9, 11, 4, 11], rects: [[9, 9, 11, 11]], block: 'BLACAA01.RMB', record: 0 };
  const bayLot = lotOfFrame(bay);
  assert.deepEqual(bayLot, yardLot(bay.at, bay.box, YARD_MARGIN, bay.rects), 'a Bay house\'s lot as before');
  assert.ok(!bayLot.turn && !bayLot.alone && !bayLot.access, 'unturned, its line its neighbours\'');
  // a terraced house with no court of its own: its door's box, where nothing places (AUDIT TAMRIEL-WIDE II W1)
  const corner = fabricCellBuildings(r, c).find((x) => [0, 1, 2, 3].filter((e) => x.plot.out & (1 << e)).length === 2);
  const shut = lotOfFrame({ ...frame, record: corner.recordIndex });
  assert.deepEqual(shut.lot, shut.house, 'a corner house: its door\'s box');
  assert.ok(!shut.alone && !shut.access && !shut.turn);
});

/** A town's yards as the world host stands them (createHomeYards over the decorator's fakes): `frames` its homes' frames by
 *  key, `pieces` each key's yard, `homeAt` whose each is, `feet` where the player stands - and every line said. */
function townYards({ frames, pieces, homeAt, feet }) {
  const said = [];
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames: new Map(frames), homeRegion: 17 }]]);
  const api = {
    yardCells: townCellsApi(async () => ({ ok: true, data: { yards: [...pieces].map(([buildingKey, list]) => ({ buildingKey, pieces: list })) } })),
    place: async (q) => ({ ok: true, data: { piece: q.piece } }), move: async () => ({ ok: true, data: {} }), remove: async () => ({ ok: true, data: {} }),
  };
  const yards = createHomeYards({
    api, homes: { homeAt: (m, k) => homeAt(k), setLook: async () => ({ ok: true }) }, built: () => built, translation: () => [0, 0, 0],
    feet: () => feet, outside: () => true, eye: () => [feet[0], 1.6, feet[2]],
    collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: (o, d) => ({ dist: d[1] < 0 ? o[1] / -d[1] : Infinity, normal: [0, 1, 0] }) }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[41000, { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => 'r0123456789abcdef0123', realm: () => null, wallet: () => ({ gold: 5000, pay() {}, credit() {} }), regionOf: () => 17,
    doc: fakeDoc(), win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say: (l) => said.push(l), refusal: (w) => w, openSlot() {}, now: () => 0, look: { preview() {}, season: () => 0 },
  });
  const cam = { pos: [feet[0], 1.6, feet[2]], yaw: Math.PI, pitch: -0.6 };
  const frame = async () => { yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); };
  return { yards, said, frame };
}
const YARD_BEHIND = 'Your yard is the court behind your house. Fly up over the roof to reach it.';

test('IC-BACKYARD: the owner at the door of an Imperial City house opens its yard - the yard behind it, not the street - told once where it is, and a piece already in it is drawn; a stranger\'s yard beside it is drawn without its court surveyed, and a Bay house says nothing of a court (mutants: the door\'s access unread; the access dropped; the lot made eagerly; the line unsaid; the line said every frame)', async () => {
  const [r, c] = PATCH[0], houses = fabricCellBuildings(r, c).filter((x) => fabricBackyard(x, fabricRecordOrigin(r, c, x)));
  const b = houses[0], y = fabricBackyard(b, fabricRecordOrigin(r, c, b));
  const cs = Math.cos(y.turn), sn = Math.sin(y.turn), inYard = [((y.lot[0] + y.lot[2]) / 2) * cs - ((y.lot[1] + y.lot[3]) / 2) * sn, 0, ((y.lot[0] + y.lot[2]) / 2) * sn + ((y.lot[1] + y.lot[3]) / 2) * cs];
  const piece = (id) => ({ id, model: 41000, flat: null, pos: inYard, rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 });
  const owner = { owner: 'Gwen', own: true, mine: true, character: 'r0123456789abcdef0123', hall: null, look: null };
  const neighbour = { owner: 'Bram', own: false, mine: false, character: 'rfedcba9876543210fedc', hall: null, look: null };
  const at = [10, 0, 10];
  // a stranger's Imperial City house: its frame counts every read of its block - its lot's survey reads it
  let strangerReads = 0;
  const stranger = { at: [30, 0, 10], box: [29.1, 0, 9.7, 30.9, 2.8, 10.3], rects: [], terraced: true, record: houses[1].recordIndex, get block() { strangerReads++; return imperialOwnName(r, c); } };
  const frames = [[300, { at, box: [9.1, 0, 9.7, 10.9, 2.8, 10.3], rects: [[9.1, 9.7, 10.9, 10.3]], terraced: true, block: imperialOwnName(r, c), record: b.recordIndex }], [301, stranger]];
  // the street before the door: its outward way is the frame's (the city's z turned)
  const n = [b.door.n[0], -b.door.n[1]], feet = [at[0] + n[0] * 1.2, 0, at[2] + n[1] * 1.2];
  const { yards, said, frame } = townYards({ frames, pieces: [[300, [piece('yard1')]], [301, [piece('yard2')]]], homeAt: (k) => (k === 300 ? owner : k === 301 ? neighbour : null), feet });
  for (let i = 0; i < 3; i++) await frame();
  assert.deepEqual(yards.yards().map((x) => x.pool.list().map((p) => p.id)).flat().sort(), ['yard1', 'yard2'], 'both yards\' pieces drawn');
  assert.equal(strangerReads, 0, 'a stranger\'s court never surveyed (AUDIT IC-BACKYARD P1)');
  const here = yards.here();
  assert.ok(here, 'the owner at the door: the yard is here');
  assert.deepEqual(here.yard.lot.lot, y.lot, 'the yard behind the house');
  assert.ok(yardHolds(here.yard.lot, at, [at[0] + inYard[0], 0, at[2] + inYard[2]]), 'it holds the court behind');
  assert.ok(!yardHolds(here.yard.lot, at, [at[0] + n[0] * 6, 0, at[2] + n[1] * 6], 2), 'never the street out in front');
  const stand = async (k) => { feet[0] = at[0] + n[0] * k; feet[2] = at[2] + n[1] * k; await frame(); };
  await stand(6);
  assert.equal(yards.here(), null, 'six metres out in the street: no yard');
  await stand(1.2);
  assert.ok(yards.here(), 'back at the door');
  assert.deepEqual(said, [], 'nothing said before the decorator opens');
  assert.equal(yards.tool().openPanel?.(), true, 'the decorator opens');
  for (let i = 0; i < 3; i++) await frame();
  assert.deepEqual(said.filter((l) => l === YARD_BEHIND), [YARD_BEHIND], 'told once where its yard is (AUDIT IC-BACKYARD P2)');
  assert.equal(strangerReads, 0, 'still never surveyed');
  // a Bay house: its yard is round it - nothing said of a court
  const bayFeet = [13, 0, 10];
  const bay = townYards({ frames: [[300, { at: [10, 0, 10], box: [9, 0, 9, 11, 4, 11], rects: [[9, 9, 11, 11]], terraced: false, block: 'BLACAA01.RMB', record: 0 }]], pieces: [[300, [piece('yard3')]]], homeAt: (k) => (k === 300 ? owner : null), feet: bayFeet });
  for (let i = 0; i < 3; i++) await bay.frame();
  assert.equal(bay.yards.tool().openPanel?.(), true, 'a Bay house\'s decorator opens');
  for (let i = 0; i < 3; i++) await bay.frame();
  assert.ok(!bay.said.includes(YARD_BEHIND), 'and says nothing of a court');
});

test('AUDIT IC-BACKYARD L2, L3: the fabric\'s ground reads what stands on it - a garden wall a long block\'s neighbouring cell draws is wall in the cell its court is laid in, and the strip between a ring\'s back walls and its court\'s chord (a polar block\'s outer arc, an organic one\'s warped line) is the court (mutants: the pieces by their block alone; the court on its chords)', () => {
  assert.equal(fabricGroundAt(6015.86, -1535.63), GROUND.wall, 'the wall cell 84,158 draws, read in cell 85,158 (lane L\'s point)');
  for (const [r, c, i] of [[80, 153, 3], [35, 96, 2]]) {
    const b = fabricCellBuildings(r, c)[i], k = (b.door.edge + 2) & 3, A = b.plot.q[k], Bq = b.plot.q[(k + 1) & 3], n = outwardOf(b.plot.q, k);
    for (let d = 0.1; d <= 4; d += 0.3) assert.equal(fabricGroundAt((A[0] + Bq[0]) / 2 + n[0] * d, (A[1] + Bq[1]) / 2 + n[1] * d), GROUND.court, `${r},${c} #${i}: court ${d.toFixed(1)} m behind its back wall`);
    assert.ok(fabricBackyard(b, fabricRecordOrigin(r, c, b)), `${r},${c} #${i}: a yard`);
  }
});

test('IC-BACKYARD by source: the build hands a home\'s frame its block and record, and the lot reads its yard off them (mutant: the frame\'s block dropped)', () => {
  const pb = readFileSync(new URL('../../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(pb, /terraced: isFabricDoorId\(placed\.modelIdNum\), block: b\.blockName, record: placed\.recordIndex \}\);/);
  const hy = readFileSync(new URL('../../../src/scenes/homeYards.js', import.meta.url), 'utf8');
  assert.match(hy, /fabricBackyardOf\(frame\.block, frame\.record\)/);
});
