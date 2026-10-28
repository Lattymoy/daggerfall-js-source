// YARD-BLOCK (2026-10-28, bible/11-Multiplayer/Yard-Cells.md section 12): STRANGERS' YARDS MERGED A BLOCK AT A TIME.
// The yards of one block that are within the yard range share one merge - one mesh a texture and one batch a picture -
// made once their pieces have settled, nearest block first, on a time budget a frame. A merged piece going lets the
// block's merge go at once. A yard crossing the range is merged in or out at the next merge, the old merge drawn until
// then. Each test builds real pools (decorRoom.js createDecorRoom) on the block's door and runs them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecorRoom, DECOR_MERGE_SETTLE_MS, DECOR_DRAW, DECOR_SHADOW } from '../../src/scenes/decor/decorRoom.js';
import { createYardBlockMerge, YARD_BLOCK_MERGE_BUDGET_MS } from '../../src/scenes/yardBlockMerge.js';

const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A model of one triangle in one texture, with what a merge needs. */
function model(archive) {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    subMeshes: [{ textureArchive: archive, textureRecord: 0, startIndex: 0, primitiveCount: 1 }],
  };
}
const piece = (id, modelId, x, z) => ({ id, model: modelId, flat: null, item: null, pos: [x, 0, z], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
const flatPiece = (id, archive, record, x, z) => ({ id, model: null, flat: [archive, record], item: null, pos: [x, 0, z], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
const billboard = (archive, record, size, centers) => ({ archive, record, size, centers, _quads: centers.length, _dyn: false, _scales: null, origin: null, frame: null });

/** The host's side: a renderer that records what it makes and draws, the block merger, and yards on its doors. */
function rig() {
  const made = [];
  const gone = [];
  const drawn = [];
  const cast = [];
  const madeBatches = [];
  let clock = 0;
  let budgetClock = 0;
  let spendPerMerge = 0;
  let pixel = [100, 0, 200];
  const renderer = {
    createMesh: (mesh) => {
      budgetClock += spendPerMerge;
      const gpu = { merged: mesh };
      made.push(gpu);
      return gpu;
    },
    destroyMesh: (gpu) => gone.push(gpu),
    drawMesh: (gpu, matrix, remap) => drawn.push({ gpu, matrix: [...matrix], remap }),
    recordShadowMesh: (gpu, matrix, remap) => cast.push({ gpu, matrix: [...matrix], remap }),
    createBillboardBatch: (archive, record, size, centers) => {
      const batch = billboard(archive, record, size, centers);
      madeBatches.push(batch);
      return batch;
    },
    destroyBillboardBatch: (batch) => gone.push(batch),
  };
  const cpuModels = new Map([[1, model(301)], [2, model(302)]]);
  const texture = { recordCount: 9, getSize: () => ({ width: 64, height: 64 }), getScale: () => ({ width: 0, height: 0 }) };
  const blocks = createYardBlockMerge({ renderer, now: () => clock, clock: () => budgetClock });
  /** A stranger's yard at `at` in the pixel, in block `cell`. */
  function yard(cell, at) {
    const door = blocks.door(`0,0:${cell}`, 0, 0, () => pixel);
    const y = { at, door, pool: null };
    y.pool = createDecorRoom({
      meshes: { getGpuMesh: async (id) => ({ id }), cpuModels }, renderer, getTexture: async () => texture, uploadRecord() {},
      collider: () => null, origin: () => [pixel[0] + at[0], pixel[1] + at[1], pixel[2] + at[2]], merge: door,
    });
    blocks.join(door, y);
    return y;
  }
  /** One frame as the host's draw makes it: the blocks' merges, then each yard's own pool. Answers each pool's count. */
  function frame({ inRange = () => true, distance = () => 0, cull = null } = {}, yards = []) {
    drawn.length = 0;
    cast.length = 0;
    blocks.step(inRange, distance);
    blocks.draw(renderer, cull, () => 'remap');
    return yards.map((y) => y.pool.draw(renderer, 'remap', null));
  }
  return {
    blocks, made, gone, drawn, cast, madeBatches, yard, frame,
    tick: (ms) => { clock += ms; },
    spendPerMerge: (ms) => { spendPerMerge = ms; },
    move: (to) => { pixel = to; },
  };
}

test('YARD-BLOCK: the yards of one block are one merge once their pieces settle - one draw a texture for the block, no piece drawn by its own pool; another block is its own merge (mutants: the block unmerged; the yards not gathered; the pools drawing merged pieces)', async () => {
  const r = rig();
  const a = r.yard(7, [0, 0, 0]);
  const b = r.yard(7, [20, 0, 0]);
  const c = r.yard(8, [200, 0, 0]);
  a.pool.put(piece('a1', 1, 0, 1));
  a.pool.put(piece('a2', 2, 1, 1));
  b.pool.put(piece('b1', 1, 0, 2));
  c.pool.put(piece('c1', 1, 0, 3));
  c.pool.put(piece('c2', 1, 2, 3));
  await settle();
  r.frame({}, [a, b, c]);
  assert.equal(r.made.length, 0, 'nothing merged before the pieces settle');
  assert.equal(r.drawn.length, 5, 'each piece drawn on its own meanwhile');
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame({}, [a, b, c]);
  assert.equal(r.made.length, 2, 'one merge a block');
  const block7 = r.made.find((gpu) => gpu.merged.positions.length === 9 * 3);
  assert.ok(block7, 'block 7 holds both yards\' three pieces');
  assert.equal(block7.merged.subMeshes.length, 2, 'one draw a texture');
  assert.deepEqual(r.drawn.map((d) => d.gpu).sort(), [...r.made].sort(), 'the merges drawn, and no piece on its own');
  assert.ok(r.drawn.every((d) => d.remap === 'remap'), 'through the pixel\'s remap');
});

test('YARD-BLOCK: a merged piece going lets its block\'s merge go at once - every piece drawn on its own that frame - and the block merges again once settled; a piece landing in a merged yard draws on its own until then (mutants: the merge kept after its piece went; the landing unheard)', async () => {
  const r = rig();
  const a = r.yard(7, [0, 0, 0]);
  const b = r.yard(7, [20, 0, 0]);
  a.pool.put(piece('a1', 1, 0, 1));
  b.pool.put(piece('b1', 1, 0, 2));
  await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame({}, [a, b]);
  assert.equal(r.made.length, 1);
  b.pool.put(piece('b2', 2, 3, 2));
  await settle();
  const counts = r.frame({}, [a, b]);
  assert.deepEqual(counts, [0, 1], 'the new piece on its own, the merged ones not');
  assert.equal(r.made.length, 1, 'not merged again before it settles');
  r.tick(DECOR_MERGE_SETTLE_MS);
  assert.deepEqual(r.frame({}, [a, b]), [0, 0], 'the landed piece merged in once settled');
  assert.equal(r.made.length, 2);
  assert.equal(r.made[1].merged.positions.length, 3 * 9);
  a.pool.remove('a1');
  assert.ok(r.gone.includes(r.made[1]), 'the merge let go at once');
  const after = r.frame({}, [a, b]);
  assert.deepEqual(after, [0, 2], 'block 7\'s pieces each drawn on their own that frame');
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame({}, [a, b]);
  assert.equal(r.made.length, 3, 'merged again once settled');
  assert.equal(r.made[2].merged.positions.length, 2 * 9, 'of the two pieces standing');
});

test('YARD-BLOCK: a block merges the yards in range alone; a yard crossing the range is merged in or out at the next merge, the old merge drawn until it is made (mutants: the range unread; the old merge dropped before the new)', async () => {
  const r = rig();
  const a = r.yard(7, [0, 0, 0]);
  const b = r.yard(7, [20, 0, 0]);
  a.pool.put(piece('a1', 1, 0, 1));
  a.pool.put(piece('a2', 1, 1, 1));
  b.pool.put(piece('b1', 1, 0, 2));
  b.pool.put(piece('b2', 1, 1, 2));
  await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  let inRange = (y) => y === a;
  r.frame({ inRange }, [a]);
  assert.equal(r.made.length, 1);
  assert.equal(r.made[0].merged.positions.length, 18, 'only the yard in range');
  inRange = () => true;
  const counts = r.frame({ inRange }, [a, b]);
  assert.equal(r.made.length, 2, 'merged again with the yard come into range');
  assert.equal(r.made[1].merged.positions.length, 36);
  assert.deepEqual(counts, [0, 0], 'no piece drawn on its own in between');
  assert.ok(r.gone.includes(r.made[0]), 'the old merge let go');
  r.frame({ inRange }, [a, b]);
  assert.equal(r.made.length, 2, 'a merge of the yards in range stands');
  // a nearer block takes the frame's budget: block 7's old merge is drawn while it waits
  const near = r.yard(9, [5, 0, 0]);
  near.pool.put(piece('n1', 1, 0, 0));
  near.pool.put(piece('n2', 1, 1, 0));
  await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.spendPerMerge(YARD_BLOCK_MERGE_BUDGET_MS);
  inRange = (y) => y !== a;
  const nearFirst = (block) => (block.key === '0,0:9' ? 0 : 50);
  r.frame({ inRange, distance: nearFirst }, [b, near]);
  assert.equal(r.made.length, 3, 'the nearer block merged');
  assert.ok(r.drawn.some((d) => d.gpu === r.made[1]), 'block 7\'s old merge still drawn while it waits');
  r.frame({ inRange, distance: nearFirst }, [b, near]);
  assert.equal(r.made[3].merged.positions.length, 18, 'then merged without the yard gone out of range');
  inRange = () => false;
  r.frame({ inRange }, []);
  assert.equal(r.drawn.length, 0, 'no yard in range: nothing drawn');
  assert.ok(r.gone.includes(r.made[3]), 'its merge let go');
});

test('YARD-BLOCK: merges are made nearest block first while the frame\'s merging time is under YARD_BLOCK_MERGE_BUDGET_MS, and always one (mutants: the budget unread; the order unsorted)', async () => {
  const r = rig();
  const near = r.yard(1, [0, 0, 0]);
  const far = r.yard(2, [300, 0, 0]);
  const mid = r.yard(3, [100, 0, 0]);
  for (const [i, y] of [near, far, mid].entries()) {
    y.pool.put(piece(`p${i}a`, 1, 0, 0));
    y.pool.put(piece(`p${i}b`, 1, 1, 0));
  }
  await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.spendPerMerge(YARD_BLOCK_MERGE_BUDGET_MS);
  const distance = (block) => ({ '0,0:1': 0, '0,0:2': 300, '0,0:3': 100 })[block.key];
  const merged = () => r.blocks.blocks().filter((block) => block.merged).map((block) => block.key);
  r.frame({ distance }, []);
  assert.deepEqual(merged(), ['0,0:1'], 'one merge spends the frame\'s budget: the nearest block');
  r.frame({ distance }, []);
  assert.deepEqual(merged().sort(), ['0,0:1', '0,0:3'], 'then the next nearest');
  r.frame({ distance }, []);
  assert.equal(merged().length, 3, 'and the last');
  r.spendPerMerge(0);
  for (const [i, y] of [near, far, mid].entries()) y.pool.put(piece(`p${i}c`, 2, 2, 0));
  await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame({ distance }, []);
  assert.equal(r.made.length, 6, 'a budget not spent merges every block due in one frame');
});

test('YARD-BLOCK: the merge is drawn by the host\'s verdict over its whole box and through its pixel\'s remap; a recentre moves it as one (mutants: the verdict unread; the recentre unread)', async () => {
  const r = rig();
  const a = r.yard(7, [0, 0, 0]);
  const b = r.yard(7, [20, 0, 0]);
  a.pool.put(piece('a1', 1, 0, 1));
  b.pool.put(piece('b1', 1, 0, 2));
  await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame({ cull: () => DECOR_SHADOW }, [a, b]);
  assert.equal(r.drawn.length, 0, 'out of view: not drawn');
  assert.equal(r.cast.length, 1, 'in a shadow\'s reach: cast into the maps');
  const boxes = [];
  r.frame({ cull: (box) => { boxes.push(box); return DECOR_DRAW; } }, [a, b]);
  assert.equal(r.drawn.length, 1);
  assert.deepEqual(boxes[0].map(Math.round), [100, 0, 201, 121, 1, 202], 'the box of both yards\' pieces, where they stand');
  assert.deepEqual(r.drawn[0].matrix.slice(12, 15), [100, 0, 200], 'drawn back at the pixel');
  r.move([90, 0, 180]);
  a.pool.restand();
  b.pool.restand();
  r.blocks.rebase();
  r.frame({}, [a, b]);
  assert.deepEqual(r.drawn.map((d) => d.matrix.slice(12, 15)), [[90, 0, 180]], 'moved with the pixel, nothing merged again');
  assert.equal(r.made.length, 1);
});

test('YARD-BLOCK: flats of one picture in a block\'s yards are one batch, each where it stood, handed while any is big enough to see; a yard leaving takes its block\'s merge, and the last one the block (mutants: the flats unmerged; the leave unheard)', async () => {
  const r = rig();
  const a = r.yard(7, [0, 0, 0]);
  const b = r.yard(7, [20, 0, 0]);
  a.pool.put(flatPiece('rose-a', 211, 4, 1, 1));
  b.pool.put(flatPiece('rose-b', 211, 4, 2, 1));
  await settle();
  r.tick(DECOR_MERGE_SETTLE_MS);
  r.frame({}, [a, b]);
  const handed = r.blocks.batches([], null, 0);
  assert.equal(handed.length, 1, 'one batch for the block');
  assert.deepEqual(handed[0].centers, [[101, 0, 201], [122, 0, 201]], 'each rose where it stood');
  assert.deepEqual(a.pool.batchesSeen([]), [], 'no rose handed by its own pool');
  assert.deepEqual(r.blocks.batches([], [100000, 0, 0], 0.1), [], 'none too small to see from the eye');
  a.pool.destroyAll();
  r.blocks.leave(a.door, a);
  assert.ok(r.gone.includes(handed[0]), 'a yard taken down lets its block\'s merge go');
  b.pool.destroyAll();
  r.blocks.leave(b.door, b);
  assert.equal(r.blocks.blocks().length, 0, 'the block goes with its last yard');
});
