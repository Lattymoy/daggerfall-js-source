// AUDIT FB1031 YARD (2026-10-31, the audit of YARD-WALLS; bible/06-Systems/Online-Arc.md YARD-WALLS). Y1: above Mac's 4 m
// a yard's piece stands by its house only on or against what the house itself covers - its ground and its level roofs -
// never anywhere in the box round it (an L's notch, a courtyard), nor by the owner's other house. Y2: a picture that
// hangs keeps its spin on the wall apart from its heading as a billboard, and its Duplicate hangs as it did. Y6: a tree
// or a plant sent `hung` is no piece, at both ends. tools/mutants/fb1031_yard.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as homeYards from '../../src/scenes/homeYards.js';
import { DECOR_MOUNT_LIFT, decorPieceOf, decorYardPieceOf, decorMountFrame } from '../../src/net/decorLaw.js';
import { createDecorPlacer, decorYardEntry } from '../../src/systems/decor/decorPlacer.js';
import { isNatureArchive as leafNature } from '../../src/world/natureArchives.js';
import { isNatureArchive } from '../../src/world/rmbFlats.js';
import { localAabb, transformedAabb } from '../../src/render/frustum.js';
import { trs, multiply } from '../../src/world/mat4.js';
import { layoutLocation } from '../../src/world/locationLayout.js';
import { getLocationTerrainTileOrigin } from '../../src/world/terrain/terrainTiles.js';
import { RMB_TILE_SIDE } from '../../src/world/locationEntrance.js';
import * as capitals from '../../src/world/tamrielCapitals.js';
import { standService, T0 } from '../accountDb.mjs';
import { settle, toolRig } from '../decorFakes.mjs';
import { skipReal, game } from '../lwRealTown.mjs';

const { modelFootParts, footRectsAt, footGroundAt, yardLot, yardWhyNot, yardJoinLots, yardGapTo, YARD_MARGIN, yardTooHighFree } = homeYards;
const CHAIR = [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]];
const LANTERN = { key: 'f210.27', model: null, flat: [210, 27], name: 'Lantern', kind: 'light', storage: false, light: null };
const SIZE = { w: 0.5, h: 1 };
const placer = (from = null) => createDecorPlacer(decorYardEntry(LANTERN), { radius: Math.hypot(SIZE.w, SIZE.h) / 2, flat: SIZE, from });
const upright = (p) => decorMountFrame(p.rot).up[1] > 0.99;

/** A lot from models placed by `places` (at the origin unless given), framed at `at` - as pixelBuild.js frames a home. */
function lotOf(models, places = models.map(() => trs(0, 0, 0, 0, 0, 0)), at = [0, 0, 0]) {
  const boxes = models.map((q, i) => transformedAabb(localAabb(q.positions), places[i]));
  const box = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boxes.map((b) => b[i]))));
  const parts = models.map((q) => modelFootParts(q.positions, q.indices));
  return yardLot(at, box, YARD_MARGIN, parts.flatMap((p, i) => footRectsAt(p.rects, places[i])), { grounds: parts.map((p, i) => footGroundAt(p, places[i])) });
}
/** Upright quads `walls` ([x0, z0, x1, z1, y0, y1]) and flat quads `flats` ([x0, z0, x1, z1, y]) facing up. */
function model(walls, flats) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (const [x0, z0, x1, z1, y0, y1] of walls) quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
  for (const [x0, z0, x1, z1, y] of flats) quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}
const ring = ([x0, z0, x1, z1], y0, y1) => [[x0, z0, x1, z0, y0, y1], [x1, z0, x1, z1, y0, y1], [x1, z1, x0, z1, y0, y1], [x0, z1, x0, z0, y0, y1]];
/** A home of a laid-out town as pixelBuild.js frames it (test/scenes/yardwalls.test.js townLot). */
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
/** The point of a lot's box farthest from the ground its house stands on (`walls`) where a chair stands on the ground. */
function openGround(lot) {
  const [x0, z0, x1, z1] = lot.house;
  let best = null;
  for (let x = x0 + 0.5; x < x1 - 0.4; x += 0.25) for (let z = z0 + 0.5; z < z1 - 0.4; z += 0.25) {
    const g = yardGapTo(lot.walls, x, z);
    if (g > (best?.g ?? 1) && yardWhyNot([x, 0, z], lot, [], CHAIR) === null) best = { x, z, g };
  }
  return best;
}
/** A lantern hung at `h` on the middle of the longest ground-floor wall of `lot`, facing out of the house. */
function onLongestWall(lot, h) {
  const walls = lot.grounds.flatMap((g) => g.walls);
  const w = walls.reduce((a, q) => (Math.hypot(q[2] - q[0], q[3] - q[1]) > Math.hypot(a[2] - a[0], a[3] - a[1]) ? q : a));
  const mx = (w[0] + w[2]) / 2, mz = (w[1] + w[3]) / 2, L = Math.hypot(w[2] - w[0], w[3] - w[1]);
  let n = [(w[3] - w[1]) / L, -(w[2] - w[0]) / L];
  if ((mx - (lot.house[0] + lot.house[2]) / 2) * n[0] + (mz - (lot.house[1] + lot.house[3]) / 2) * n[1] < 0) n = [-n[0], -n[1]];
  const p = placer().pieceAt([mx, h, mz], [0, 0, 0], 'l1', [n[0], 0, n[1]], 0);
  const { right } = decorMountFrame(p.rot);
  const ground = [[-right[0] * SIZE.w / 2, -right[2] * SIZE.w / 2], [right[0] * SIZE.w / 2, right[2] * SIZE.w / 2]];
  return { p, n, why: yardWhyNot(p.pos, lot, [], ground) };
}

test('AUDIT FB1031 Y1 on the game\'s own houses: open ground in a house\'s box - Newcester\'s courtyard house (THIEAL00 record 3, ARCH3D 213) and past the Bay Solitude\'s L (RESIAL03 record 3, ARCH3D 203) - keeps Mac\'s 4 m, where the box took a chair to the house\'s top; a lantern on its own wall and a chair against it stand above 4 m (mutants: the box asked; the cover\'s cells unread)', { skip: skipReal }, () => {
  const { maps, blocks } = game();
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    let count = 0;
    try { count = maps.baseLocationCount(r); } catch { continue; }
    for (let i = 0; i < count; i++) { try { const l = maps.getLocation(r, i); if (l) rows.push(l); } catch { /* none */ } }
  }
  const k = capitals.CAPITALS.findIndex((c) => c.name === 'Solitude');
  const solitude = capitals.synthesizeCapitalLocation({ cap: capitals.CAPITALS[k], k, s: 0 }, { base: capitals.capitalBase(rows), names: capitals.cityBlockNames(rows), blockOf: (nm) => blocks.getBlockByName(nm) ?? null, px: 1000, py: 1000 });
  for (const [loc, blockName, record, id, top] of [[maps.getLocationByName('Daggerfall', 'Newcester'), 'THIEAL00.RMB', 3, 213, 10.02], [solitude, 'RESIAL03.RMB', 3, 203, 8.45]]) {
    const { ids, lot } = townLot(loc, blockName, record);
    assert.deepEqual(ids, [id], `${loc.name}'s house`);
    assert.ok(Math.abs(lot.top - top) < 0.01, `${loc.name}: its top`);
    const open = openGround(lot);
    assert.ok(open && open.g > 2, `${loc.name}: open ground in its box, ${open?.g.toFixed(2)} m from every face of it`);
    assert.deepEqual([4, 4.5, 6].map((y) => yardWhyNot([open.x, y, open.z], lot, [], CHAIR)), [null, yardTooHighFree(), yardTooHighFree()], `${loc.name}: a chair free over it keeps 4 m`);
    const wall = onLongestWall(lot, 6);
    assert.equal(wall.why, null, `${loc.name}: a lantern on its own wall at 6 m`);
    const out = 0.3 - 0.05 - DECOR_MOUNT_LIFT;   // as the placer stands a chair against it, 5 cm into the wall
    const at = [wall.p.pos[0] + wall.n[0] * out, wall.p.pos[2] + wall.n[1] * out];
    assert.equal(yardWhyNot([at[0], 5, at[1]], lot, [], CHAIR), null, `${loc.name}: a chair against its wall at 5 m`);
    assert.equal(yardWhyNot([at[0] + wall.n[0], 5, at[1] + wall.n[1]], lot, [], CHAIR), yardTooHighFree(), `${loc.name}: a metre off it, free`);
  }
});

test('AUDIT FB1031 Y1 what the house covers: ARCH3D 602\'s flat roof at 6.45 m over the porch in its L, past its ground floor\'s walls, takes a chair - 1.6 m from the house\'s ground, on its level roof; ARCH3D 212\'s gable over its door, 1.6 m from its ground, takes a lantern at 6 m; a chair beside the owner\'s other house is free of this one (mutants: the cover\'s level roofs unread; the flat roofs read as its decks; the sides unread; the joined walls read)', { skip: skipReal }, () => {
  const cottage = lotOf([game().modelOf(212)]);
  const gable = placer().pieceAt([0, 6, -6.4], [0, 0, 0], 'l1', [0, 0, -1], 0);
  assert.ok(yardGapTo(cottage.walls, gable.pos[0], gable.pos[2]) > 1.5, 'over its doorway: off its ground');
  assert.equal(yardWhyNot(gable.pos, cottage, [], [[-SIZE.w / 2, 0], [SIZE.w / 2, 0]]), null, 'a lantern on its gable at 6 m');
  const lot = lotOf([game().modelOf(602)]);
  assert.ok(Math.abs(lot.top - 6.45) < 0.01, 'its top');
  assert.ok(yardGapTo(lot.walls, 1.6, -6.4) > 1.5, 'the porch: off its ground');
  assert.deepEqual([0, 4.5, 6.45, 7].map((y) => yardWhyNot([1.6, y, -6.4], lot, [], CHAIR)), [null, null, null, yardTooHighFree()], 'under its porch roof, on it, and none over the house\'s top');
  // YARD-JOINED: the owner's other house east, its wall 0.6 m off this one's; a chair touching it alone
  const house = lotOf([model(ring([-5, -5, 5, 5], 0, 6), [[-5, -5, 5, 5, 6]])]);
  const joined = yardJoinLots(house, [{ walls: [[5.6, -5, 12, 5]] }]);
  assert.equal(yardWhyNot([5.28, 0, 0], joined, [], [[-0.25, -0.3], [0.25, -0.3], [0.25, 0.3], [-0.25, 0.3]]), null, 'between the two on the ground');
  assert.equal(yardWhyNot([5.28, 4.5, 0], joined, [], [[-0.25, -0.3], [0.25, -0.3], [0.25, 0.3], [-0.25, 0.3]]), null, 'touching its own wall too: by the house');
  assert.equal(yardWhyNot([5.4, 4.5, 0], joined, [], [[-0.15, -0.3], [0.15, -0.3], [0.15, 0.3], [-0.15, 0.3]]), yardTooHighFree(), 'touching the other house alone: free of this one, its top not this lot\'s');
});

test('AUDIT FB1031 Y1 the law on a house built here: a chair touching its ground\'s edge stands to its top, a hand off it does not; beside an upright face of it only as high as the face - a post 2.5 m tall, a band of wall from 6 to 8 m; touching a step outside its walls, free (mutants: the cover\'s touch uncounted; a face over the foot; a face under the foot; the sides\' touch; a face a side alone; the sides unplaced; the sides unframed; the loose ground by the house)', () => {
  // its ground floor 10 x 10 to 3 m under a flat roof, a tower on it to 9 m; outside, a post with no top, a step 0.4 m
  // up and a band of wall
  const post = ring([6.8, -0.2, 7.2, 0.2], 0, 2.5);
  // high on the east, a low band below it in its plane; placed 2 m up, as a block stands a house on a rise
  const lot = lotOf([model([...ring([-5, -5, 5, 5], 0, 3), ...ring([-1, -1, 1, 1], 3, 9), ...post, [5.8, -2, 5.8, 2, 2.5, 3.5], [5.8, -2, 5.8, 2, 6, 8]], [[-5, -5, 5, 5, 3], [-1, -1, 1, 1, 9], [5, 2.2, 6.6, 4.2, 0.4]])], [trs(0, 2, 0, 0, 0, 0)], [0, 2, 0]);
  assert.ok(Math.abs(lot.top - 9) < 1e-6);
  assert.deepEqual([yardWhyNot([5.33, 5, -4], lot, [], CHAIR), yardWhyNot([5.5, 5, -4], lot, [], CHAIR)], [null, yardTooHighFree()], 'touching its ground; a hand off it');
  assert.deepEqual([yardWhyNot([7.5, 2, 0.45], lot, [], CHAIR), yardWhyNot([7.5, 4.5, 0.45], lot, [], CHAIR)], [null, yardTooHighFree()], 'beside the post; over its top');
  assert.deepEqual([yardWhyNot([6.12, 5, 0], lot, [], CHAIR), yardWhyNot([6.12, 6.5, 0], lot, [], CHAIR), yardWhyNot([6.12, 8.2, 0], lot, [], CHAIR)], [yardTooHighFree(), null, yardTooHighFree()], 'the band: under it, beside it, over it');
  assert.deepEqual([yardWhyNot([6, 0, 4.53], lot, [], CHAIR), yardWhyNot([6, 4.5, 4.53], lot, [], CHAIR)], [null, yardTooHighFree()], 'touching the step, the house\'s outside its walls; over it, free');
});

test('AUDIT FB1031 Y2 the placer: a billboard turned half round and moved onto a wall hangs upright, its spin its own; moved back to the ground it keeps its heading; a hung one moved keeps its spin; a turn turns the pose shown (mutants: the heading taken as the spin; the hung spin taken as the heading; the turn turning the billboard on the wall)', () => {
  const flipped = decorPieceOf({ id: 'l1', ...placer().pieceAt([3, 0, 3], [0, 0, 0], 'l1', [0, 1, 0], 0), rot: [180, 0, 0] });
  const moved = placer(flipped);
  const onWall = moved.pieceAt([0, 1.5, 2], [0, 0, 0], 'l1', [-1, 0, 0], 0);
  assert.deepEqual([onWall.hung, onWall.rot], [true, [-90, 0, 0]], 'hung on the wall, unspun');
  assert.ok(upright(onWall), 'upright (it hung at 180, upside down)');
  assert.deepEqual(moved.pieceAt([3, 0, 3], [0, 0, 0], 'l1', [0, 1, 0], 0).rot, [180, 0, 0], 'on the ground again: its own heading');
  const hung = placer({ ...onWall, rot: [-90, 0, 30] });
  assert.equal(hung.pieceAt([0, 1.5, 2], [0, 0, 0], 'l1', [-1, 0, 0], 0).rot[2], 30, 'a hung one moved: its spin');
  assert.deepEqual(hung.pieceAt([3, 0, 3], [0, 0, 0], 'l1', [0, 1, 0], 0).rot, [0, 0, 0], 'set on the ground: a billboard facing as a new one');
  hung.turn(15);
  assert.deepEqual(hung.pieceAt([3, 0, 3], [0, 0, 0], 'l1', [0, 1, 0], 0).rot, [15, 0, 0], 'the turn on the ground turns the billboard');
  assert.equal(hung.pieceAt([0, 1.5, 2], [0, 0, 0], 'l1', [-1, 0, 0], 0).rot[2], 30, 'not its spin on the wall');
  hung.turn(15);
  assert.equal(hung.pieceAt([0, 1.5, 2], [0, 0, 0], 'l1', [-1, 0, 0], 0).rot[2], 45, 'the turn on the wall spins it');
  assert.deepEqual(hung.pieceAt([3, 0, 3], [0, 0, 0], 'l1', [0, 1, 0], 0).rot, [15, 0, 0], 'and leaves the billboard\'s heading');
});

test('AUDIT FB1031 Y2 the decorator: the Duplicate of a lantern hung on a wall facing -z hangs on it as it hung, at its spin, where it hung at 180 - upside down (mutants: the Duplicate unhung)', async () => {
  const svc = { async place(a) { return { ok: true, data: { piece: a.piece } }; }, async move() { return { ok: true, data: {} }; }, async remove() { return { ok: true, data: {} }; } };
  const lot = { house: [-5, 2, 5, 8], walls: [[-5, 2, 5, 8]], lot: [-11, -4, 11, 14], y: 0, top: 6 };
  const rig = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 5000, placeOk: (p, foot) => yardWhyNot(p.pos, lot, [], foot) });
  const stood = decorPieceOf({ id: 'lamphung0001', model: null, flat: [209, 0], pos: [0, 1.6, 2 - DECOR_MOUNT_LIFT], rot: [180, 0, 30], scale: 1, light: null, storage: false, paid: 40, hung: true });
  assert.ok(stood && decorMountFrame(stood.rot).up[1] > 0.8, 'the lantern as it hangs, spun 30');
  rig.standing.push(stood);
  rig.frame();
  rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-open')).fire('click');
  rig.frame();
  assert.equal(rig.tool.act('duplicate', stood.id), true);
  for (let i = 0; i < 3; i++) { rig.frame(); await settle(); }
  rig.state.normal = [0, 0, -1];
  rig.frame();
  const g = rig.tool.ghost();
  assert.ok(g && g.id !== stood.id && g.hung, 'its copy hangs');
  assert.deepEqual(g.rot, [180, 0, 30], 'as it hung, its spin');
  assert.ok(decorMountFrame(g.rot).up[1] > 0.8, 'never upside down');
});

test('AUDIT FB1031 Y6 the law: a tree or a plant (a nature archive, the leaf world/natureArchives.js, rmbFlats.js\'s own) sent `hung` is no piece, in a room or a yard; unhung it is (mutants: a plant hung by the law)', () => {
  assert.equal(isNatureArchive, leafNature, 'one export');
  assert.deepEqual([499, 500, 504, 511, 512].map(leafNature), [false, true, true, true, false]);
  const tree = { id: 'tree00000001', model: null, flat: [504, 1], pos: [3, 2, 3], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 40 };
  assert.ok(decorPieceOf(tree) && decorYardPieceOf(tree), 'a tree stands');
  assert.deepEqual([decorPieceOf({ ...tree, hung: true }), decorYardPieceOf({ ...tree, hung: true })], [null, null], 'hung, none');
  assert.equal(decorPieceOf({ ...tree, flat: [210, 27], hung: true })?.hung, true, 'a lantern hangs');
});

test('AUDIT FB1031 Y6 the service: a crafted placement of a hung tree is refused and stores nothing; the same tree standing is placed; moved onto a wall hung it is refused (mutants: a plant hung by the law)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (piece) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), piece, yard: true }, owner.secret);
  const tree = { id: 't1', model: null, flat: [504, 1], pos: [3, 2, 3], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 40 };
  const hung = await place({ ...tree, hung: true });
  assert.notEqual(hung.status, 200, JSON.stringify(hung.body));
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'nothing stored');
  const r = await place(tree);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const moved = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: o.character, id: 't1', place: { pos: [5.02, 3, 0], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 40, hung: true } }, owner.secret);
  assert.notEqual(moved.status, 200, 'moved onto a wall hung: refused');
  assert.equal(JSON.parse(svc.env.DB._raw.prepare('SELECT place FROM home_decor WHERE id = ?').get('t1').place).hung, undefined, 'it stands as it stood');
});
