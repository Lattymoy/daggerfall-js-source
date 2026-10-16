// YARD-MERGE (2026-10-12, a capture standing in Daggerfall: 1,878 draw calls a frame, about 360 of them the yards'
// pieces, and 185 of their flats): A YARD'S MODELS ARE ONE MESH, AND ITS FLATS OF ONE PICTURE ONE BATCH, ONCE IT
// SETTLES (bible/07-Rendering/Performance-Priority.md YARD-MERGE).
//
// ONE: the merge is the pieces' own triangles where each piece's own matrix stood them - PERF4's batch, relative to the
// pool's origin and drawn back at it - grouped by each sub-mesh's own texture key, unresolved (the host's remap is the
// draw's, as each piece's was). TWO: a pool its host lets merge draws its pieces on their own until it has stood
// DECOR_MERGE_SETTLE_MS unchanged and the host's budget allows, then one draw a texture by the same verdict and remap -
// a piece landing after it on its own, a merged piece going letting it go at once. THREE: a room merges nothing, a
// door and a model without its normals never join one, and the town's yards spend one merge a frame. FOUR: the flats of
// one picture, size and lean are one batch of many quads, each where it stood, handed to the billboard pass once - a
// figure, a mount, an animated flat or one with a look of its own never in one - let go and made again as the models'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createDecorRoom, decorMatrix, mergeDecorModels, decorMergeable, decorMergeMatrix, decorFlatMergeKey, DECOR_MERGE_SETTLE_MS, DECOR_MERGE_MIN,
  DECOR_DRAW, DECOR_SHADOW, DECOR_SKIP,
} from '../../src/scenes/decor/decorRoom.js';
import { YARD_MERGES_A_FRAME } from '../../src/scenes/homeYards.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
/** A model of two triangles in two textures - normals, texture coordinates and sub-meshes, as dataPipeline keeps one. */
function model(a1, r1, a2 = a1, r2 = r1 + 1) {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
    subMeshes: [
      { textureArchive: a1, textureRecord: r1, startIndex: 0, primitiveCount: 1 },
      { textureArchive: a2, textureRecord: r2, startIndex: 3, primitiveCount: 1 },
    ],
  };
}
const piece = (id, m, x, z, yaw = 0, scale = 1) => ({ id, model: m, flat: null, item: null, pos: [x, 0, z], rot: [yaw, 0, 0], scale, light: null, storage: false, paid: 20 });
const at = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
const near = (a, b, msg) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-4, `${msg}: ${a} vs ${b}`));

function rig({ allow = true, models = null, merge = true } = {}) {
  const cpuModels = models ?? new Map([[100, model(301, 0)], [101, model(301, 0, 44, 3)], [102, model(212, 5)]]);
  const drawn = [], cast = [], made = [], gone = [];
  let o = [10, 2, 30], clock = 0, take = allow, takes = 0;
  const renderer = {
    drawMesh: (g, m, remap) => drawn.push({ g, m: [...m], remap }),
    recordShadowMesh: (g, m, remap) => cast.push({ g, m: [...m], remap }),
    createMesh: (mesh) => { const g = { merged: mesh }; made.push(g); return g; },
    destroyMesh: (g) => gone.push(g),
  };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ id }), cpuModels }, renderer,
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), origin: () => o,
    merge: merge ? { take: () => { takes++; return take; }, now: () => clock } : null,
  });
  return {
    pool, drawn, cast, made, gone, renderer,
    tick: (ms) => { clock += ms; }, move: (to) => { o = to; }, allow: (v) => { take = v; }, takes: () => takes,
    frame: (remap = null, cull = null) => { drawn.length = 0; cast.length = 0; return pool.draw(renderer, remap, cull); },
  };
}

test('YARD-MERGE: the merge is each piece\'s own triangles where its own matrix stands them, relative to the origin and drawn back at it, grouped by each sub-mesh\'s own texture key, unresolved (mutants: the origin not taken off; a piece\'s matrix unread; the keys resolved)', () => {
  const o = [10, 2, 30];
  const cpu = new Map([[100, model(301, 0)], [102, model(212, 5)]]);
  const es = [piece('a', 100, 1, 2, 90, 2), piece('b', 102, -3, 4, 45)].map((p) => ({ piece: p, o, matrix: decorMatrix(p, o), mesh: cpu.get(p.model) }));
  const m = mergeDecorModels(es, o);
  assert.equal(m.models, 2);
  assert.equal(m.triangles, 4);
  const back = decorMergeMatrix(o);
  es.forEach((e, k) => {
    for (let v = 0; v < 6; v++) {
      const local = [...e.mesh.positions.slice(v * 3, v * 3 + 3)];
      near(at(back, [...m.positions.slice((k * 6 + v) * 3, (k * 6 + v) * 3 + 3)]), at(e.matrix, local), `piece ${e.piece.id} vertex ${v} where the piece stood it`);
    }
  });
  assert.deepEqual(m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`), ['301_0', '301_1', '212_5', '212_6'], 'one sub-mesh a texture, keyed as the pieces\' own');
  const shared = mergeDecorModels([0, 1].map((i) => { const p = piece(`s${i}`, 100, i, 0); return { piece: p, o, matrix: decorMatrix(p, o), mesh: cpu.get(100) }; }), o);
  assert.deepEqual(shared.subMeshes.map((s) => [`${s.textureArchive}_${s.textureRecord}`, s.primitiveCount]), [['301_0', 2], ['301_1', 2]], 'two pieces of one model: one draw a texture for both');
});

test('YARD-MERGE: what joins a merge - a model standing with its triangles, normals and texture coordinates, no door, from the origin the merge is made at (mutants: each guard dropped)', () => {
  const o = [1, 2, 3];
  const ok = { gpu: {}, door: null, o: [1, 2, 3], mesh: model(1, 0) };
  assert.equal(decorMergeable(ok, o), true);
  assert.equal(decorMergeable({ ...ok, gpu: null }, o), false, 'no model standing');
  assert.equal(decorMergeable({ ...ok, door: {} }, o), false, 'a door is the room\'s to swing');
  assert.equal(decorMergeable({ ...ok, mesh: null }, o), false, 'no triangles in hand');
  for (const k of ['positions', 'indices', 'normals', 'uvs']) assert.equal(decorMergeable({ ...ok, mesh: { ...ok.mesh, [k]: undefined } }, o), false, `no ${k}`);
  assert.equal(decorMergeable({ ...ok, mesh: { ...ok.mesh, subMeshes: [] } }, o), false, 'no sub-meshes');
  for (let i = 0; i < 3; i++) { const away = [1, 2, 3]; away[i] += 1; assert.equal(decorMergeable({ ...ok, o: away }, o), false, `standing from another origin (axis ${i})`); }
});

test('YARD-MERGE: a pool its host lets merge draws each piece on its own until it has stood DECOR_MERGE_SETTLE_MS unchanged and the host allows, then one draw for them all - through the same remap, its count the pieces\' (mutants: the settle unread; the budget unread; the merged pieces drawn twice; the remap dropped)', async () => {
  const r = rig();
  for (const [i, m] of [100, 101, 102].entries()) r.pool.put(piece(`p${i}`, m, i * 2, 5));
  await settle(); await settle();
  const remap = new Map([['301_0', '302_0']]);
  assert.equal(r.frame(remap), 3, 'three pieces drawn');
  assert.equal(r.drawn.length, 3, 'each on its own before it settles');
  assert.equal(r.made.length, 0, 'nothing merged yet');
  r.tick(DECOR_MERGE_SETTLE_MS - 1);
  r.frame(remap);
  assert.equal(r.made.length, 0, 'not before it has settled');
  r.tick(1);
  r.allow(false);
  r.frame(remap);
  assert.equal(r.made.length, 0, 'nor while the host\'s budget is spent');
  r.allow(true);
  assert.equal(r.frame(remap), 3, 'the count is still the pieces\'');
  assert.equal(r.made.length, 1, 'merged once');
  assert.deepEqual(r.drawn.map((d) => d.g), [r.made[0]], 'one draw: the merge, the pieces not again');
  assert.equal(r.drawn[0].remap, remap, 'through the host\'s remap, as each piece was');
  near(r.drawn[0].m.slice(12, 15), [10, 2, 30], 'drawn back at the origin');
  assert.equal(r.made[0].merged.models, 3);
  const takes = r.takes();
  r.frame(remap);
  assert.equal(r.made.length, 1, 'a settled pool is not merged again');
  assert.equal(r.takes(), takes, 'nor asks the budget again');
});

test('YARD-MERGE: the merge drawn by the host\'s verdict over its whole box - drawn, cast into the maps alone, or neither - and a recentre moves it as one (mutants: the verdict unread; the cast arm drawn; the matrix kept where it stood)', async () => {
  const r = rig();
  r.pool.put(piece('a', 100, 0, 0));
  r.pool.put(piece('b', 102, 4, 0));
  await settle(); await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame();
  assert.equal(r.made.length, 1);
  const boxes = [];
  const verdict = (v) => (b) => { boxes.push([...b]); return v; };
  assert.equal(r.frame(null, verdict(DECOR_SKIP)), 0, 'off screen, out of every reach: nothing');
  assert.equal(r.drawn.length + r.cast.length, 0);
  assert.equal(r.frame(null, verdict(DECOR_SHADOW)), 0, 'off screen in a shadow\'s reach: cast alone');
  assert.deepEqual(r.cast.map((c) => c.g), [r.made[0]]);
  assert.equal(r.drawn.length, 0);
  assert.equal(r.frame(null, verdict(DECOR_DRAW)), 2);
  assert.deepEqual(r.drawn.map((c) => c.g), [r.made[0]]);
  const b = boxes[0];
  assert.ok(b[0] <= 10 && b[3] >= 15 && b[2] <= 30 && b[5] >= 31, `the box spans both pieces where they stand: ${b}`);
  r.move([110, 2, 30]);
  r.pool.restand();
  boxes.length = 0;
  r.frame(null, verdict(DECOR_DRAW));
  near(r.drawn[0].m.slice(12, 15), [110, 2, 30], 'the recentre moved the merge');
  assert.ok(boxes[0][0] >= 109, `and its box: ${boxes[0]}`);
  assert.equal(r.made.length, 1, 'moved, never merged again');
});

test('YARD-MERGE: a merged piece taken out lets the merge go at once - the rest drawn on their own that very frame - and the pool merges again once it settles; a piece landing after the merge draws on its own until then (mutants: the merge kept after its piece went; the flags kept; the late piece hidden; no merge again; the old merge never let go)', async () => {
  const r = rig();
  for (const id of ['a', 'b', 'c']) r.pool.put(piece(id, 100, id.charCodeAt(0), 0));
  await settle(); await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame();
  assert.equal(r.made.length, 1);
  r.pool.put(piece('late', 102, 9, 9));
  await settle(); await settle();
  assert.equal(r.frame(), 4);
  assert.deepEqual(r.drawn.map((d) => d.g.id ?? 'merge'), ['merge', 102], 'the late piece on its own beside the merge');
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame();
  assert.equal(r.made.length, 2, 'settled again: merged afresh');
  assert.equal(r.made[1].merged.models, 4, 'the late piece in it');
  assert.deepEqual(r.gone, [r.made[0]], 'the old merge let go for the new');
  assert.deepEqual(r.drawn.map((d) => d.g), [r.made[1]]);
  r.pool.remove('b');
  assert.deepEqual(r.gone, [r.made[0], r.made[1]], 'the merge let go with its piece');
  assert.equal(r.frame(), 3);
  assert.deepEqual(r.drawn.map((d) => d.g.id).sort(), [100, 100, 102], 'every piece standing drawn on its own, none of the merge');
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame();
  assert.equal(r.made.length, 3, 'merged again, the removal alone asking it');
  assert.equal(r.made[2].merged.models, 3, 'of the three standing - the one taken out not');
  assert.deepEqual(r.drawn.map((d) => d.g), [r.made[2]]);
  r.pool.destroyAll();
  assert.deepEqual(r.gone, [r.made[0], r.made[1], r.made[2]], 'the room going lets its merge go');
});

test('YARD-MERGE: no merge for a room (no `merge`), for fewer than DECOR_MERGE_MIN models, nor of a model without its normals (mutants: a room merged; the floor unread)', async () => {
  const room = rig({ merge: false });
  room.pool.put(piece('a', 100, 0, 0)); room.pool.put(piece('b', 100, 2, 0));
  await settle(); await settle();
  room.tick(DECOR_MERGE_SETTLE_MS);
  room.frame();
  assert.equal(room.made.length, 0, 'a room\'s pieces each their own draw');
  assert.equal(room.drawn.length, 2);
  assert.equal(DECOR_MERGE_MIN, 2);
  const one = rig();
  one.pool.put(piece('a', 100, 0, 0));
  await settle(); await settle();
  one.tick(DECOR_MERGE_SETTLE_MS);
  one.frame();
  assert.equal(one.made.length, 0, 'one piece: nothing to merge');
  const bare = rig({ models: new Map([[100, model(1, 0)], [103, { ...model(2, 0), normals: undefined }]]) });
  bare.pool.put(piece('a', 100, 0, 0)); bare.pool.put(piece('b', 100, 2, 0)); bare.pool.put(piece('c', 103, 4, 0));
  await settle(); await settle();
  bare.tick(DECOR_MERGE_SETTLE_MS);
  assert.equal(bare.frame(), 3);
  assert.equal(bare.made[0].merged.models, 2, 'the model without normals left out');
  assert.deepEqual(bare.drawn.map((d) => d.g.id ?? 'merge'), ['merge', 103], 'and drawn on its own');
});

test('YARD-MERGE: the town\'s yards let their pools merge on one budget a frame - refilled by the yards\' draw before any pool draws (mutants: the budget unrefilled; a room\'s budget; the merge unwired)', () => {
  const y = readFileSync(new URL('../../src/scenes/homeYards.js', import.meta.url), 'utf8');
  assert.equal(YARD_MERGES_A_FRAME, 1);
  assert.ok(y.includes('  const merge = { take: () => (mergesLeft > 0 ? (mergesLeft--, true) : false), now };'), 'the budget: taken while it lasts');
  const made = y.slice(y.indexOf('    y.pool = createDecorRoom({'), y.indexOf('    yards.set(key, y);'));
  assert.ok(made.includes('      merge,   // YARD-MERGE'), 'every yard\'s pool given it');
  const draw = y.slice(y.indexOf('    draw(r = deps.renderer) {'), y.indexOf('      tool.draw(r, cur ? remapOf(cur.yard) : null);'));
  const refill = draw.indexOf('      mergesLeft = YARD_MERGES_A_FRAME;');
  assert.ok(refill > 0 && refill < draw.indexOf('y.pool.draw('), 'refilled each frame before the pools draw');
});

// ── the flats ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A billboard batch as the renderer's createBillboardBatch makes one - its picture, size, quads and centres. */
const bb = (archive, record, size, centers) => ({ archive, record, size, centers, _quads: centers.length, _dyn: false, _scales: null, origin: null, frame: null });
const flatPiece = (id, a, r, x, z, yaw = 0, scale = 1) => ({ id, model: null, flat: [a, r], item: null, pos: [x, 0, z], rot: [yaw, 0, 0], scale, light: null, storage: false, paid: 20 });

test('YARD-MERGE: the group a flat joins - its picture, its drawn size (a mirrored one apart), its lean; none for a figure, a mount, an animated flat, a batch of many quads, a dynamic or per-flat scaled one, any look of its own, nor one from another origin (mutants: each guard dropped; the size or the lean out of the key)', () => {
  const o = [1, 2, 3];
  const flat = (b = {}, e = {}) => ({ piece: flatPiece('f', 211, 4, 0, 0), o: [1, 2, 3], batch: { ...bb(211, 4, { w: 1, h: 2 }, [[0, 0, 0]]), ...b }, anims: null, mount: null, ...e });
  const k = decorFlatMergeKey(flat(), o);
  assert.equal(typeof k, 'string');
  assert.equal(decorFlatMergeKey(flat(), o), k, 'two flats of one picture and size: one group');
  assert.notEqual(decorFlatMergeKey(flat({ record: 5 }), o), k, 'another record');
  assert.notEqual(decorFlatMergeKey(flat({ archive: 212 }), o), k, 'another archive');
  assert.notEqual(decorFlatMergeKey(flat({ size: { w: -1, h: 2 } }), o), k, 'mirrored: its own');
  assert.notEqual(decorFlatMergeKey(flat({ size: { w: 1, h: 3 } }), o), k, 'another height');
  assert.notEqual(decorFlatMergeKey(flat({ sway: 0.6 }), o), k, 'another lean');
  assert.notEqual(decorFlatMergeKey(flat({ windfall: 0.5 }), o), k, 'another share of Windfall');
  assert.equal(decorFlatMergeKey(flat({}, { batch: null }), o), null, 'no batch yet');
  assert.equal(decorFlatMergeKey(flat({}, { anims: {} }), o), null, 'animated: its animator\'s');
  assert.equal(decorFlatMergeKey(flat({}, { mount: {} }), o), null, 'a mount');
  assert.equal(decorFlatMergeKey(flat({}, { piece: flatPiece('p', 184, 0, 0, 0) }), o), null, 'a figure: the people lane\'s');
  assert.equal(decorFlatMergeKey(flat({ _quads: 2 }), o), null, 'more than one quad');
  assert.equal(decorFlatMergeKey(flat({ _dyn: true }), o), null, 'dynamic');
  assert.equal(decorFlatMergeKey(flat({ _scales: [0.5] }), o), null, 'scaled a flat at a time');
  for (const look of ['frame', 'lptProto', 'tint', 'dye', 'conceal', 'hitFlash', 'glint', 'dissolve', 'noShadow', 'selfCard', 'castOnly', 'tip', 'eliteGlow', 'dwColumn']) {
    assert.equal(decorFlatMergeKey(flat({ [look]: 1 }), o), null, `a look of its own: ${look}`);
  }
  for (let i = 0; i < 3; i++) { const away = [1, 2, 3]; away[i] += 1; assert.equal(decorFlatMergeKey(flat({}, { o: away }), o), null, `another origin (axis ${i})`); }
});

function flatRig({ standFlat = null } = {}) {
  const made = [], gone = [];
  let o = [10, 0, 30], clock = 0;
  const tex = { recordCount: 9, getSize: () => ({ width: 64, height: 64 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    drawMesh() {}, recordShadowMesh() {},
    createBillboardBatch: (a, r, size, centers) => { const b = bb(a, r, size, centers); made.push(b); return b; },
    destroyBillboardBatch: (b) => gone.push(b),
  };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() }, renderer, getTexture: async () => tex, uploadRecord() {},
    collider: () => null, origin: () => o, merge: { take: () => true, now: () => clock }, standFlat,
  });
  const settled = async () => { for (let i = 0; i < 4; i++) await settle(); };
  const frame = () => { pool.draw(); return pool.batchesSeen([]); };
  return { pool, made, gone, settled, frame, tick: (ms) => { clock += ms; }, move: (to) => { o = to; } };
}

test('YARD-MERGE: flats of one picture and size are one batch once the pool settles - their centres where each stood, handed once to the billboard pass and none of them again; a picture standing once stays its own (mutants: the flats unmerged; the members handed twice; a group of one; the centres off)', async () => {
  const r = flatRig();
  for (const [i, x] of [0, 2, 4].entries()) r.pool.put(flatPiece(`rose${i}`, 211, 4, x, 1));
  r.pool.put(flatPiece('urn', 211, 7, 6, 1));
  await r.settled();
  const before = r.frame();
  assert.equal(before.length, 4, 'each flat its own batch before it settles');
  const urn = before.find((b) => b.record === 7);
  r.tick(DECOR_MERGE_SETTLE_MS);
  const after = r.frame();
  assert.equal(after.length, 2, 'the three roses one batch, the urn its own');
  const group = after.find((b) => b._quads === 3);
  assert.ok(group, 'a batch of three quads');
  assert.deepEqual(group.centers, [[10, 0, 31], [12, 0, 31], [14, 0, 31]], 'each rose where it stood');
  assert.deepEqual([group.archive, group.record], [211, 4]);
  assert.ok(after.includes(urn), 'the urn, alone: its own batch, as it stood');
  assert.equal(r.made.length, 5, 'one batch made for the merge, none for a picture standing once');
  assert.deepEqual(r.pool.batches(), after, 'batches() hands the same');
});

test('YARD-MERGE: a merged flat taken out lets its group go at once - the rest handed on their own that frame - and they merge again once settled; a recentre carries the group as it carries its flats (mutants: the group kept; the origin unmoved)', async () => {
  const r = flatRig();
  for (const [i, x] of [0, 2, 4].entries()) r.pool.put(flatPiece(`rose${i}`, 211, 4, x, 1));
  await r.settled();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame();
  const group = r.made.at(-1);
  assert.equal(group._quads, 3);
  r.move([110, 0, 30]);
  r.pool.restand();
  assert.deepEqual(group.origin, [100, 0, 0], 'the recentre\'s step');
  r.pool.restand();
  assert.deepEqual(group.origin, [100, 0, 0], 'once: a restand where it stands moves nothing');
  r.pool.remove('rose1');
  assert.ok(r.gone.includes(group), 'the group let go with its flat');
  assert.deepEqual(r.frame().map((b) => b._quads), [1, 1], 'the two left, each its own');
  r.tick(DECOR_MERGE_SETTLE_MS);
  const again = r.frame();
  assert.equal(again.length, 1);
  assert.deepEqual(again[0].centers, [[110, 0, 31], [114, 0, 31]], 'merged again where they stand now');
});

test('YARD-MERGE: a group is handed while any of its flats is big enough to see from the eye, and not once none is (mutant: the size\'s test dropped for a group)', async () => {
  const r = flatRig();
  r.pool.put(flatPiece('a', 211, 4, 0, 0));
  r.pool.put(flatPiece('b', 211, 4, 0, 400));
  await r.settled();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.pool.draw();
  const minAngle = 1 / 300;
  assert.equal(r.pool.batchesSeen([], [10, 0, 40], minAngle).length, 1, 'one flat near: the group handed');
  assert.equal(r.pool.batchesSeen([], [10, 0, 5000], minAngle).length, 0, 'both too small to see: nothing');
});

test('YARD-MERGE: a group leans as its flats were given to - the sway and Windfall\'s share of a picture the host stood its own way (a yard\'s nature) - and a flat the host stands asks the merge as one the room stands does (mutants: the lean dropped from the group; the host\'s flat never asking)', async () => {
  const r = flatRig({ standFlat: (p, at) => Promise.resolve({ batch: Object.assign(bb(301, 2, { w: 1, h: 3 }, [[at[0] + p.pos[0], at[1], at[2] + p.pos[2]]]), { sway: 0.6, windfall: 0.25 }), size: { w: 1, h: 3 } }) });
  r.pool.put(flatPiece('bush0', 301, 2, 0, 0));
  r.pool.put(flatPiece('bush1', 301, 2, 3, 0));
  await r.settled();
  r.tick(DECOR_MERGE_SETTLE_MS);
  const got = r.frame();
  assert.equal(got.length, 1, 'the two bushes one batch');
  assert.equal(got[0].sway, 0.6, 'leaning as they did');
  assert.equal(got[0].windfall, 0.25);
});
