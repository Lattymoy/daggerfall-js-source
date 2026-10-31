// YARD-WALLS (2026-10-31, Discord #feature-feedback, "Feedback Doc 2", handed over by the owner: "Decoration restriction
// need to be looser on the exterior of houses, sure roads are a no go. But I should be able to decorate the walls
// better, and balconies."; bible/06-Systems/Online-Arc.md YARD-WALLS). A yard's piece stands to DECOR_YARD_HIGH (8 m, Mac's
// 4 m raised) on or against its house and no higher than its roof; free of the house Mac's 4 m holds (homeYards.js
// YARD_FREE_HIGH). A catalogue picture set on a wall hangs flat on it (decorPlaceOf `hung`, decorIsMount), where it stood
// off the wall by half its width as a billboard. tools/mutants/yardwalls.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as homeYards from '../../src/scenes/homeYards.js';
import { DECOR_YARD_HIGH, DECOR_MOUNT_LIFT, decorPlaceOf, decorPieceOf, decorYardPieceOf, decorIsMount, decorIsTrophy, decorFlatMirrored } from '../../src/net/decorLaw.js';
import { createDecorPlacer, decorHangs, decorYardEntry, decorHungFoot } from '../../src/systems/decor/decorPlacer.js';
import { createDecorRoom, decorMountQuad, decorMountFloats, decorLightLift } from '../../src/scenes/decor/decorRoom.js';
import { billboardSize } from '../../src/world/rmbFlats.js';
import { localAabb, transformedAabb } from '../../src/render/frustum.js';
import { trs, multiply } from '../../src/world/mat4.js';
import { layoutLocation } from '../../src/world/locationLayout.js';
import { getLocationTerrainTileOrigin } from '../../src/world/terrain/terrainTiles.js';
import { RMB_TILE_SIDE } from '../../src/world/locationEntrance.js';
import * as capitals from '../../src/world/tamrielCapitals.js';
import { standService, T0 } from '../accountDb.mjs';
import { townYards } from '../yardCellsRead.mjs';
import { settle, fakeDoc, fakeWin, townCellsApi, toolRig, placeFrom } from '../decorFakes.mjs';
import { skipReal, game } from '../lwRealTown.mjs';

const {
  modelFootParts, footRectsAt, footGroundAt, yardLot, yardWhyNot, yardLampOf, createHomeYards,
  YARD_MARGIN, YARD_FREE_HIGH, YARD_TOO_HIGH, yardTooHighFree, YARD_IN_HOUSE,
} = homeYards;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** Upright quads `walls` ([x0, z0, x1, z1, y0, y1]) and flat quads `flats` ([x0, z0, x1, z1, y]) facing up - as
 *  test/world/fb1030_yarddeck.test.js builds them. */
function model(walls, flats) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (const [x0, z0, x1, z1, y0, y1] of walls) quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
  for (const [x0, z0, x1, z1, y] of flats) quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}
const ring = ([x0, z0, x1, z1], y0, y1) => [[x0, z0, x1, z0, y0, y1], [x1, z0, x1, z1, y0, y1], [x1, z1, x0, z1, y0, y1], [x0, z1, x0, z0, y0, y1]];
const CHAIR = [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]];
/** A lot from models placed by `places` (one each, at the origin unless given), framed at `at` - as pixelBuild.js frames a home. */
function lotOf(models, places = models.map(() => trs(0, 0, 0, 0, 0, 0)), at = [0, 0, 0]) {
  const boxes = models.map((q, i) => transformedAabb(localAabb(q.positions), places[i]));
  const box = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boxes.map((b) => b[i]))));
  const parts = models.map((q) => modelFootParts(q.positions, q.indices));
  return yardLot(at, box, YARD_MARGIN, parts.flatMap((p, i) => footRectsAt(p.rects, places[i])), { grounds: parts.map((p, i) => footGroundAt(p, places[i])) });
}
/** A 10 x 10 ground floor 3.22 high, its west half's roof a deck; on its east half a storey to 6.45 under a flat roof. */
const TWO_STOREY = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([0, -5, 5, 5], 3.22, 6.45)], [[-5, -5, 0, 5, 3.22], [0, -5, 5, 5, 6.45]]);
const LANTERN = { key: 'f210.27', model: null, flat: [210, 27], name: 'Lantern', kind: 'light', storage: false, light: null };
const SIZE = { w: 0.5, h: 1 };
/** The lantern as a yard places it, set by the eye on `hit` with the surface's `normal`. */
const hang = (hit, normal, entry = decorYardEntry(LANTERN)) => createDecorPlacer(entry, { radius: Math.hypot(SIZE.w, SIZE.h) / 2, flat: SIZE }).pieceAt(hit, [0, 0, 0], 'l1', normal, 0);
const ground = (p) => (p.hung ? decorHungFoot(p, SIZE) : []);

test('YARD-WALLS the height: on or against its house a yard\'s piece stands to DECOR_YARD_HIGH and no higher than the house\'s top - its roof deck, its upper walls; free of it, Mac\'s 4 m; a model by its foot; a lot that knows no top keeps 4 m (mutants: the free bound raised; the free law unasked; the top unread; the box unasked; the lot\'s top its foot; the origin read as the foot)', () => {
  assert.deepEqual([DECOR_YARD_HIGH, YARD_FREE_HIGH], [8, 4]);
  assert.match(yardTooHighFree(), /Above 4 m/);
  assert.ok(yardTooHighFree().split(/\s+/).length <= 25, 'one plain sentence');
  const lot = lotOf([TWO_STOREY]);
  assert.ok(Math.abs(lot.top - 6.45) < 1e-6, 'the house\'s top, from its box');
  assert.equal(yardWhyNot([2.5, 6.45, 0], lot, [], CHAIR), null, 'a chair on the storey\'s roof (4 m refused it)');
  assert.equal(yardWhyNot([2.5, 7.45, 0], lot, [], Object.assign(CHAIR.map(([x, z]) => [x, z]), { bottom: -1 })), null, 'a model whose foot is on the roof, its origin a metre up');
  assert.equal(yardWhyNot([2.5, 7.05, 0], lot, [], CHAIR), yardTooHighFree(), 'a chair stacked on it: over the roof');
  const upper = hang([5, 5.5, 0], [1, 0, 0]);
  assert.equal(upper.hung, true);
  assert.equal(yardWhyNot(upper.pos, lot, [], ground(upper)), null, 'a lantern on the storey\'s east wall at 5.5 m');
  assert.equal(yardWhyNot(hang([5, 6.9, 0], [1, 0, 0]).pos, lot, [], ground(upper)), yardTooHighFree(), 'over the roof');
  assert.equal(yardWhyNot([8, 4.5, 0], lot, [], CHAIR), yardTooHighFree(), 'a chair free in the yard at 4.5 m');
  assert.equal(yardWhyNot([8, 4, 0], lot, [], CHAIR), null, 'at 4 m');
  assert.equal(yardWhyNot([5.31, 5, 0], lot, [], CHAIR), null, 'a chair touching the house\'s wall, up its height');
  assert.equal(yardWhyNot([5.5, 5, 0], lot, [], CHAIR), yardTooHighFree(), 'a hand off it');
  // a tall house: against it, DECOR_YARD_HIGH is the bound
  const tall = lotOf([model(ring([-5, -5, 5, 5], 0, 9.65), [[-5, -5, 5, 5, 9.65]])]);
  assert.equal(yardWhyNot(hang([5, 7.5, 0], [1, 0, 0]).pos, tall, [], ground(upper)), null, 'a lantern at 7.5 m on a 9.65 m wall');
  assert.equal(yardWhyNot(hang([5, 8.5, 0], [1, 0, 0]).pos, tall, [], ground(upper)), YARD_TOO_HIGH, 'at 8.5 m: past the yard\'s height');
  // a lot built by hand knows no top: everything over 4 m is free of it
  assert.equal(yardWhyNot([4.4, 4.5, 0], { house: [-4, -3, 4, 3], lot: [-10, -9, 10, 9], y: 0 }, [], CHAIR), yardTooHighFree());
  assert.equal(yardWhyNot([0, 9, 0], lot, [], CHAIR), YARD_IN_HOUSE, 'a piece inside the storey is the house first');
});

test('YARD-WALLS the hung picture\'s law: a catalogue picture\'s place may say `hung` (a boolean, carried only when true) and then it is a mount, drawn flat on its wall - never a model, one\'s own item or a person; a yard keeps it; no trophy, never mirrored (mutants: the mount unread; the flag dropped; any value taken; a model hung)', () => {
  const pl = { pos: [5.02, 5.5, 0], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 40 };
  assert.deepEqual(decorPlaceOf({ ...pl, hung: true }), { ...pl, hung: true });
  assert.deepEqual(decorPlaceOf({ ...pl, hung: false }), pl, 'false is never written');
  assert.equal(decorPlaceOf({ ...pl, hung: 'yes' }), null);
  const piece = decorPieceOf({ id: 'l1', model: null, flat: [210, 27], ...pl, rot: [180, 0, 0], hung: true });
  assert.ok(piece, 'a lantern hung');
  assert.deepEqual([decorIsMount(piece), decorIsTrophy(piece), decorFlatMirrored(piece)], [true, false, false], 'a mount, no trophy, never mirrored');
  assert.equal(decorIsMount({ ...piece, hung: false }), false, 'unhung, a billboard');
  assert.ok(decorYardPieceOf(piece)?.hung, 'a yard keeps it');
  assert.equal(decorPieceOf({ id: 'm1', model: 41000, flat: null, ...pl, hung: true }), null, 'a model never hangs');
  assert.equal(decorPieceOf({ id: 'o1', model: null, flat: [234, 12], item: { t: 265, g: 9 }, ...pl, paid: 0, hung: true }), null, 'nor one\'s own item');
  assert.equal(decorPieceOf({ id: 'v1', model: null, flat: [182, 3], ...pl, hung: true }), null, 'nor a person');
});

test('YARD-WALLS the placer: a yard\'s catalogue picture set on a wall hangs flat on it a hair off, the turn its spin; on the ground it stands as a billboard; one that does not hang stands off the wall by half its width; moved, it keeps its spin; its ground is its quad seen from above, a line along the wall, where the billboard\'s circle reached into the house (mutants: the wall unhung; the flag unset; the spin lost; the line\'s length; the circle\'s foot)', () => {
  assert.deepEqual([decorHangs(LANTERN), decorHangs({ ...LANTERN, kind: 'own', item: { t: 1 } }), decorHangs({ key: 'f182.3', model: null, flat: [182, 3] }), decorHangs({ key: 'f504.1', model: null, flat: [504, 1] }), decorHangs({ key: 'm41000', model: 41000, flat: null })], [true, false, false, false, false], 'a picture; never one\'s own, a person, a plant or a model');
  assert.deepEqual(decorYardEntry({ ...LANTERN, storage: true, light: { range: 3 }, station: 'cooking' }), { ...LANTERN, storage: false, light: null, station: null, hangs: true });
  assert.equal(decorYardEntry({ key: 'm41000', model: 41000, flat: null }).hangs, undefined);
  const p = hang([0, 1.5, 2], [-1, 0, 0]);
  assert.deepEqual([p.pos, p.rot, p.hung], [[-DECOR_MOUNT_LIFT, 1.5, 2], [-90, 0, 0], true], 'flat on the wall, a hair off it');
  const floor = hang([0, 0, 2], [0, 1, 0]);
  assert.deepEqual([floor.pos, floor.rot, floor.hung], [[0, 0, 2], [0, 0, 0], undefined], 'on the ground, a billboard');
  const off = hang([0, 1.5, 2], [-1, 0, 0], { ...LANTERN, storage: false, light: null, station: null });
  assert.deepEqual([off.pos, off.hung], [[-0.2, 1.5, 2], undefined], 'one that does not hang stands off by half its width (WALL-CLEAR)');
  const placer = createDecorPlacer(decorYardEntry(LANTERN), { radius: 0.56, flat: SIZE, from: { ...p, rot: [-90, 0, 30] } });
  assert.equal(placer.pieceAt([0, 1.5, 2], [0, 0, 0], 'l1', [-1, 0, 0], 0).rot[2], 30, 'moved, its own spin');
  placer.turn(15);
  assert.equal(placer.pieceAt([0, 1.5, 2], [0, 0, 0], 'l1', [-1, 0, 0], 0).rot[2], 45, 'the turn spins it on the wall');
  assert.deepEqual(decorHungFoot(p, SIZE).map(([x, z]) => [Math.round(x * 1000) / 1000 + 0, Math.round(z * 1000) / 1000 + 0]).sort((a, b) => a[1] - b[1]), [[0, -0.25], [0, 0.25]], 'a line along the wall, its width');
  assert.equal(decorHungFoot({ ...p, rot: [-90, 0, 90] }, SIZE).length, 2, 'spun a quarter, still a line');
  // the house of fb1030 (its walls' cells reach 0.15 past x 0): hung on its west wall, the yard's; the circle of half
  // its width, where it hangs, reached into the house
  const house = lotOf([model(ring([0, -5, 6, 5], 0, 3), [[-0.55, -5.55, 6.55, 5.55, 3.5]])]);
  assert.equal(yardWhyNot(p.pos, house, [], decorHungFoot(p, SIZE)), null, 'hung on the wall: the yard');
  const circle = Array.from({ length: 8 }, (_, i) => [0.25 * Math.cos((i * Math.PI) / 4), 0.25 * Math.sin((i * Math.PI) / 4)]);
  assert.equal(yardWhyNot(p.pos, house, [], circle), YARD_IN_HOUSE, 'its billboard\'s ground would be in the house');
});

/** A room as decor2c.test.js stands one, its renderer's decal pass and texture cache faked; `lampOf` the yard's law. */
function hangRoom(lampOf = null) {
  const decals = [], batches = [], lights = [], uploads = [];
  const textures = new Map();
  const tex = { recordCount: 40, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const renderer = {
    textures,
    createBillboardBatch: (a, r) => { const b = { a, r }; batches.push(b); return b; },
    destroyBillboardBatch: () => {},
    drawMesh: () => {},
    createDecalBatch: (cap) => { const b = { cap, writes: [], draws: [], destroyed: false }; decals.push(b); return b; },
    writeDecalSlot: (b, slot, floats) => { b.writes.push([slot, Array.from(floats)]); return true; },
    drawDecals: (b, t) => { b.draws.push(t); },
    destroyDecalBatch: (b) => { b.destroyed = true; },
  };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() }, renderer,
    getTexture: async (a) => (a === 210 ? tex : null),
    uploadRecord: (a, r, opts = {}) => { uploads.push([a, r, opts]); if (opts.mips !== false) return undefined; textures.set(`${a}_${r}#ui`, `tex:${a}.${r}`); return '#ui'; },
    uploadRecordFrame() {}, collider: () => ({ addMesh() {}, removeBucket() {} }), origin: () => [10, 0, 10], roomLights: () => lights,
    ...(lampOf ? { lampOf } : {}),
  });
  return { pool, decals, batches, lights, uploads, tex, renderer };
}

test('YARD-WALLS the yard hangs it: a hung picture stands on the decal pass as its own picture, never a billboard; a hung lantern lights at its flame, from its middle; the yards draw their hung pictures on the world\'s decal pass, as a room draws its mounts (mutants: a billboard stood; the light from its foot; the yards\' pictures undrawn)', async () => {
  const { pool, decals, batches, lights, uploads, tex } = hangRoom(yardLampOf);
  const piece = decorPieceOf({ id: 'l1', model: null, flat: [210, 27], pos: [5.02, 5.5, 0], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 40, hung: true });
  pool.put(piece);
  await settle();
  const size = billboardSize(tex, 27);
  assert.deepEqual(uploads, [[210, 27, { mips: false, removeMask: true, dye: null, dyeTarget: null }]], 'its own picture, undyed');
  assert.equal(decals.length, 1);
  assert.deepEqual(decals[0].writes, [[0, Array.from(decorMountFloats(decorMountQuad(piece, [10, 0, 10], size)))]], 'flat on its wall');
  assert.deepEqual(batches, [], 'never a billboard');
  const flame = decorLightLift({ ...piece, hung: false }, size);
  assert.equal(decorLightLift(piece, size), flame - size.h / 2, 'from its middle');
  assert.ok(Math.abs(lights[0].y - (5.5 + flame - size.h / 2)) < 1e-9, 'lit at its flame');
  // the yards: a stranger's yard with a hung lantern, its picture drawn on the world's decal pass
  const homeFrames = new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const room = hangRoom();
  const pictures = [];
  const yards = createHomeYards({
    api: { yardCells: townCellsApi(async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces: [{ ...piece, pos: [4.02, 2, 0] }] }] } })) },
    homes: { homeAt: (m, k) => (k === 300 ? { owner: 'Tomas', own: false } : null) },
    built: () => built, translation: () => [0, 0, 0], feet: () => [18, 0, 10], outside: () => true, eye: () => [18, 1.6, 10],
    collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: () => null }),
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() },
    renderer: { ...room.renderer, drawDecalPicture: (b, t) => pictures.push(t) },
    getTexture: async (a) => (a === 210 ? tex : null), uploadRecord: (a, r, o = {}) => (o.mips === false ? (room.renderer.textures.set(`${a}_${r}#ui`, `tex:${a}.${r}`), '#ui') : undefined),
    doc: fakeDoc(), win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => 0,
  });
  const cam = { pos: [18, 1.6, 10], yaw: 0, pitch: 0 };
  for (let i = 0; i < 4; i++) { yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); }
  assert.equal(yards.yards().length, 1, 'the yard stands');
  for (let i = 0; i < 4; i++) await settle();   // its picture loaded
  yards.drawDecals();
  assert.deepEqual(pictures, ['tex:210.27'], 'its hung lantern, on the decal pass');
  yards.destroy();
});

test('YARD-WALLS the decorator outside: the ghost of a picture set on a wall is the picture hung there, never the billboard - on the ground the billboard, the hung ghost cleared; the lot is asked of its line along the wall; placed it says `hung` to the service, and a move off the wall says no more (mutants: the ghost a billboard; the hung ghost unwritten; the ghost unasked; the yard\'s entry plain; the lot asked of a circle; the move\'s place unhung)', async () => {
  const placed = [];
  const svc = {
    async place(a) { placed.push(a.piece); return { ok: true, data: { piece: a.piece } }; },
    async move() { return { ok: true, data: {} }; },
    async remove() { return { ok: true, data: {} }; },
  };
  // the house's south wall at z 2 of the frame, its box its walls (no parts measured: meeting it is in it)
  const lot = { house: [-5, 2, 5, 8], walls: [[-5, 2, 5, 8]], lot: [-11, -4, 11, 14], y: 0, top: 6 };
  const rig = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 77, buildingKey: 9 }, homeDecor: svc, placeOk: (p, foot) => yardWhyNot(p.pos, lot, [], foot) });
  await placeFrom(rig, 'f209.0');
  rig.frame();
  await settle();
  rig.state.normal = [0, 0, -1];
  rig.frame();
  const ghost = rig.tool.ghost();
  assert.deepEqual([ghost.pos, ghost.rot, ghost.hung], [[0, 1.6, 2 - DECOR_MOUNT_LIFT], [180, 0, 0], true], 'hung on the wall');
  const size = billboardSize({ getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) }, 0);
  const decal = rig.decals.find((d) => d.cap === 1 && d.writes.length);
  assert.ok(decal, 'the ghost\'s picture');
  assert.deepEqual(decal.writes.at(-1), [0, Array.from(decorMountFloats(decorMountQuad(ghost, [10, 0, 10], size)))], 'where it will hang');
  assert.deepEqual(rig.tool.batches(), [], 'no billboard beside it');
  assert.ok(size.w / 2 > 0.07, 'its circle would reach into the wall');
  assert.equal(rig.tool.why(), null, 'the lot asks its line along the wall: nothing refuses it');
  rig.state.normal = [0, 1, 0];
  rig.frame();
  assert.equal(rig.tool.ghost().hung, undefined, 'on the ground');
  assert.equal(rig.tool.batches().length, 1, 'the billboard');
  assert.deepEqual(decal.writes.at(-1), [0, Array.from(decorMountFloats(null))], 'the hung ghost cleared');
  rig.state.normal = [0, 0, -1];
  rig.frame();
  assert.equal(await rig.tool.commit(), true);
  await settle();
  assert.equal(placed.at(-1)?.hung, true, 'the service is told it hangs');
  assert.equal(src('src/scenes/decor/decorTool.js').match(/const placeOf = \(piece\) => decorPlaceOf\(piece\);/)?.length, 1, 'a move\'s place is the law\'s half');
  assert.equal(decorPlaceOf(placed.at(-1)).hung, true, 'moved on its wall, it says it hangs');
  assert.equal(decorPlaceOf({ ...placed.at(-1), hung: false }).hung, undefined, 'moved off it, it says no more');
});

test('YARD-WALLS the service: a yard\'s hung picture is written and served hung, at 6 m; moved off the wall it is stored unhung; a model sent hung is refused; a Confirm stores it hung (mutants: the flag never stored, by a placement or a Confirm)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (piece) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), piece, yard: true }, owner.secret);
  const lantern = { id: 'l1', model: null, flat: [210, 27], pos: [5.02, 6, 0], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 40, hung: true };
  const r = await place(lantern);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const stored = () => JSON.parse(svc.env.DB._raw.prepare('SELECT place FROM home_decor WHERE id = ?').get('l1').place);
  assert.equal(stored().hung, true, 'stored hung');
  const served = (await townYards(svc.call, 7)).body.yards[0].pieces[0];
  assert.deepEqual([served.hung, served.pos[1]], [true, 6], 'served hung, at 6 m');
  const off = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: o.character, id: 'l1', place: { pos: [7, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 40 } }, owner.secret);
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(stored().hung, undefined, 'moved off the wall: unhung');
  const bad = await place({ ...lantern, id: 'm1', model: 41000, flat: null });
  assert.notEqual(bad.status, 200, 'a model never hangs');
  // the street's Confirm (DECOR-BATCH) writes it hung too
  const rev = Number(svc.env.DB._raw.prepare('SELECT rev FROM decor_rev WHERE map_id = ? AND building_key = ?').get(7, 300)?.rev) || 0;
  const batch = await svc.call('/v1/homes/decor/batch', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), yard: true, rev, txn: 'batch-txn-00000001', put: [{ ...lantern, id: 'l2' }], drop: [] }, owner.secret);
  assert.equal(batch.status, 200, JSON.stringify(batch.body));
  assert.equal(JSON.parse(svc.env.DB._raw.prepare('SELECT place FROM home_decor WHERE id = ?').get('l2').place).hung, true, 'a Confirm stores it hung');
});

/** A home of a laid-out town as pixelBuild.js frames it - test/world/fb1030c_deckroad.test.js's townHome, its lot alone. */
function townLot(loc, blockName, record) {
  const { maps, blocks, modelOf } = game();
  const lay = layoutLocation(loc, maps, blocks, { enhanced: true });
  const tilePos = getLocationTerrainTileOrigin(loc), S = RMB_TILE_SIDE;
  const b = lay.blocks.find((q) => q.blockName === blockName);
  assert.ok(b, `${loc.name}: ${blockName} laid`);
  const mine = b.layout.models.filter((q) => q.recordIndex === record);
  const origin = trs(tilePos.x * S + b.originX, 0, tilePos.y * S + b.originZ, 0, 0, 0);
  const at = [tilePos.x * S + b.originX + mine[0].recordAt[0], mine[0].recordAt[1], tilePos.y * S + b.originZ + mine[0].recordAt[2]];
  return { ids: mine.map((q) => q.modelIdNum), lot: lotOf(mine.map((q) => modelOf(q.modelIdNum)), mine.map((q) => multiply(origin, q.matrix)), at) };
}
/** A lantern hung at `h` on the middle of the longest ground-floor wall of `lot`, facing out of the house. */
function onLongestWall(lot, h) {
  const walls = lot.grounds.flatMap((g) => g.walls);
  const w = walls.reduce((a, q) => (Math.hypot(q[2] - q[0], q[3] - q[1]) > Math.hypot(a[2] - a[0], a[3] - a[1]) ? q : a));
  const mx = (w[0] + w[2]) / 2, mz = (w[1] + w[3]) / 2, L = Math.hypot(w[2] - w[0], w[3] - w[1]);
  let n = [(w[3] - w[1]) / L, -(w[2] - w[0]) / L];
  if ((mx - (lot.house[0] + lot.house[2]) / 2) * n[0] + (mz - (lot.house[1] + lot.house[3]) / 2) * n[1] < 0) n = [-n[0], -n[1]];
  const p = hang([mx, h, mz], [n[0], 0, n[1]]);
  return { p, why: yardWhyNot(p.pos, lot, [], ground(p)) };
}

test('YARD-WALLS on the game\'s own houses: Hammerfell\'s two-storey house (ARCH3D 709) takes a chair on its 6.45 m roof and a lantern on its wall at 6 m, none over its roof, and a free piece keeps 4 m; past the Bay, Solitude\'s one-storey house (BANKBL00 record 0, ARCH3D 560), its roof at 3.22 m, takes a lantern to 4 m and none over it', { skip: skipReal }, () => {
  const g = game();
  const h709 = lotOf([g.modelOf(709)]);
  const roof = h709.grounds[0].decks.find((d) => Math.abs(d[4] - 6.45) < 0.01 && (d[2] - d[0]) * (d[3] - d[1]) >= 1);
  assert.ok(roof, '709\'s roof is a deck');
  assert.equal(yardWhyNot([(roof[0] + roof[2]) / 2, 6.45, (roof[1] + roof[3]) / 2], h709, [], CHAIR), null, 'a chair on its roof');
  assert.deepEqual([onLongestWall(h709, 6).why, onLongestWall(h709, 7).why], [null, yardTooHighFree()], 'a lantern on its wall at 6 m; at 7 m, over its 6.45 m roof');
  const { p } = onLongestWall(h709, 3);
  const n = [Math.sin((p.rot[0] * Math.PI) / 180), Math.cos((p.rot[0] * Math.PI) / 180)];
  assert.deepEqual([yardWhyNot([p.pos[0] + n[0] * 3, 4.5, p.pos[2] + n[1] * 3], h709, [], CHAIR), yardWhyNot([p.pos[0] + n[0] * 3, 4, p.pos[2] + n[1] * 3], h709, [], CHAIR)], [yardTooHighFree(), null], 'three metres out: 4 m');
  const { maps, blocks } = g;
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    let count = 0;
    try { count = maps.baseLocationCount(r); } catch { continue; }
    for (let i = 0; i < count; i++) { try { const l = maps.getLocation(r, i); if (l) rows.push(l); } catch { /* none */ } }
  }
  const k = capitals.CAPITALS.findIndex((c) => c.name === 'Solitude');
  const solitude = capitals.synthesizeCapitalLocation({ cap: capitals.CAPITALS[k], k, s: 0 }, { base: capitals.capitalBase(rows), names: capitals.cityBlockNames(rows), blockOf: (nm) => blocks.getBlockByName(nm) ?? null, px: 1000, py: 1000 });
  const home = townLot(solitude, 'BANKBL00.RMB', 0);
  assert.deepEqual(home.ids, [560], 'Solitude\'s house');
  assert.ok(Math.abs(home.lot.top - 3.22) < 0.01, 'one storey');
  assert.deepEqual([onLongestWall(home.lot, 4).why, onLongestWall(home.lot, 4.5).why], [null, yardTooHighFree()], 'a lantern to 4 m as anywhere; over it none, its roof lower');
});
