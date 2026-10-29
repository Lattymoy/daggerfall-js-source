// FIELD BUGS 2026-10-29b DECOR-GHOST (#feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 21: "Allow us to move items we hover the mouse over ... Bonus points if the original part would become
// semi-transparent while we're moving it"). The press on a placed piece already moves it (RPT1026-WORLD DECOR-VERBS); the
// piece where it stood was hidden while it moved. Now it stands as its ghost - a model at DECOR_HELD_SHOWN of its
// fragments through the renderer's dither, a flat dissolved to the same share with a pale edge - lit by nothing, aimed at
// by nothing, and drawn on its own out of a yard's merge (which drew it whole) until it is let go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecorRoom, DECOR_HELD_SHOWN, DECOR_HELD_EDGE, DECOR_MERGE_SETTLE_MS } from '../../src/scenes/decor/decorRoom.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
function model() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
    subMeshes: [{ textureArchive: 301, textureRecord: 0, startIndex: 0, primitiveCount: 2 }],
  };
}
const piece = (id, over = {}) => ({ id, model: 100, flat: null, item: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20, ...over });

function rig({ merge = false } = {}) {
  const calls = [];
  let clock = 0;
  const lights = [];
  const renderer = {
    drawMesh: (g) => calls.push(['draw', g]),
    recordShadowMesh: () => {},
    setDissolve: (k) => calls.push(['dissolve', k]),
    createMesh: (mesh) => ({ merged: mesh }),
    destroyMesh: () => {},
    createBillboardBatch: (a, r, size, centers) => ({ archive: a, record: r, size, centers, _quads: centers.length }),
    destroyBillboardBatch: () => {},
  };
  const tex = { recordCount: 30, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ id }), cpuModels: new Map([[100, model()]]) }, renderer,
    getTexture: async () => tex, uploadRecord() {}, uploadRecordFrame() {},
    collider: () => ({ addMesh() {}, removeBucket() {} }), origin: () => [0, 0, 0], roomLights: () => lights,
    ...(merge ? { merge: { take: () => true, now: () => clock } } : {}),
  });
  return { pool, calls, lights, tick: (ms) => { clock += ms; }, frame: () => { calls.length = 0; return pool.draw(renderer); } };
}

test('DECOR-GHOST a model held: drawn at DECOR_HELD_SHOWN of its fragments, the dither put back whole after it; nothing to point at and no light; let go, whole again (mutants: DECORGHOST-model-hidden, DECORGHOST-dither-left-on, DECORGHOST-held-aimed)', async () => {
  const r = rig();
  r.pool.put(piece('a', { light: { color: [1, 1, 1], range: 5, intensity: 1 } }));
  await settle(); await settle();
  assert.equal(r.frame(), 1);
  assert.deepEqual(r.calls, [['draw', { id: 100 }]], 'whole');
  r.pool.hold('a', true);
  assert.equal(r.frame(), 1, 'still drawn where it stood');
  assert.deepEqual(r.calls, [['dissolve', DECOR_HELD_SHOWN], ['draw', { id: 100 }], ['dissolve', 1]], 'its ghost, the dither put back');
  assert.ok(DECOR_HELD_SHOWN > 0.2 && DECOR_HELD_SHOWN < 0.6, 'seen, and seen through');
  assert.equal(r.pool.targets().length, 0, 'nothing to point at');
  assert.equal(r.pool.lights().length, 0, 'no light');
  r.pool.hold('a', false);
  r.frame();
  assert.deepEqual(r.calls, [['draw', { id: 100 }]], 'let go: whole');
  assert.equal(r.pool.targets().length, 1);
});

test('DECOR-GHOST a flat held: its batch dissolved to the same share with the pale edge and still drawn; let go, whole (mutants: DECORGHOST-flat-hidden, DECORGHOST-flat-undissolved)', async () => {
  const r = rig();
  r.pool.put(piece('f', { model: null, flat: [211, 3] }));
  await settle(); await settle();
  const [batch] = r.pool.batches();
  assert.ok(batch && !batch.dissolve);
  r.pool.hold('f', true);
  assert.deepEqual(r.pool.batches(), [batch], 'still drawn');
  assert.deepEqual(batch.dissolve.slice(0, 4).map((v) => Math.round(v * 1000) / 1000), [1 - DECOR_HELD_SHOWN, ...DECOR_HELD_EDGE]);
  r.pool.hold('f', false);
  assert.equal(batch.dissolve, null, 'whole again');
  assert.deepEqual(r.pool.batches(), [batch]);
});

test('DECOR-GHOST a merged yard\'s piece held: the merge is let go so the ghost draws on its own, and the next merge leaves the held piece out until it is let go (mutants: DECORGHOST-merge-kept, DECORGHOST-held-merged)', async () => {
  const r = rig({ merge: true });
  for (const id of ['a', 'b', 'c', 'd']) r.pool.put(piece(id, { pos: [id.charCodeAt(0) - 96, 0, 1] }));
  await settle(); await settle();
  r.frame();
  r.tick(DECOR_MERGE_SETTLE_MS + 1);
  r.frame();
  const whole = r.calls.filter((c) => c[0] === 'draw');
  assert.equal(whole.length, 1, 'merged: one draw for four');
  r.pool.hold('b', true);
  r.frame();
  assert.ok(r.calls.some((c) => c[0] === 'dissolve' && c[1] === DECOR_HELD_SHOWN), 'the held piece, its ghost on its own');
  r.tick(DECOR_MERGE_SETTLE_MS + 1);
  r.frame();
  const draws = r.calls.filter((c) => c[0] === 'draw');
  assert.equal(draws.length, 2, 'merged again without it, and its ghost');
  assert.ok(draws.some((c) => c[1].merged) && draws.some((c) => c[1].id === 100), 'the three merged, the held one alone');
  r.pool.hold('b', false);
  r.tick(DECOR_MERGE_SETTLE_MS + 1);
  r.frame();
  r.frame();
  assert.equal(r.calls.filter((c) => c[0] === 'draw').length, 1, 'let go: all four merged again');
});
