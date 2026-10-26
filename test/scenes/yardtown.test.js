// YARD-TOWN (2026-10-25, measured in Daggerfall's city: the town's answer landing stood every yard in one frame of 108 to
// 208 ms) - A TOWN'S YARDS STAND A FEW A FRAME. Over the real yards and their pools: a town of strangers' yards stands
// YARD_STANDS_A_FRAME of them a frame, frame after frame until it is stood (never half a second apart), and the owner's
// own yard never waits behind them. `06-Systems/Online-Arc.md` YARD-TOWN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHomeYards, YARD_STANDS_A_FRAME, YARD_SYNC_S } from '../../src/scenes/homeYards.js';
import { settle } from '../decorFakes.mjs';

const piece = (id) => ({ id, model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });

/** One town pixel of `strangers` strangers' homes, each with a yard of two pieces, and - listed last - the owner's own. */
function town(strangers) {
  const keys = Array.from({ length: strangers + 1 }, (_, i) => 300 + i);
  const own = keys.at(-1);
  const homeFrames = new Map(keys.map((k, i) => [k, { at: [20 * i, 0, 10], box: [20 * i - 4, 0, 7, 20 * i + 4, 6, 13] }]));
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const api = { yards: async () => ({ ok: true, data: { yards: keys.map((k) => ({ buildingKey: k, pieces: [piece(`a${k}`), piece(`b${k}`)] })) } }) };
  const homes = { homeAt: (m, k) => (keys.includes(k) ? { owner: k === own ? 'Olga' : `Stranger ${k}`, own: k === own, look: null } : null) };
  const yards = createHomeYards({
    api, homes, built: () => built, translation: () => [0, 0, 0], feet: () => [0, 0, 10], outside: () => false, eye: () => [0, 1.6, 10],
    collider: () => ({ addMesh() {}, removeBucket() {} }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[41000, { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    character: () => 'r0123456789abcdef0123', realm: () => null, wallet: () => ({ gold: 0, pay() {}, credit() {} }), regionOf: () => 17,
    doc: null, win: null, canvas: null, touch: false, actionOf: () => null, locked: () => false, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => 0,
  });
  /** The yards standing their pieces now, by key. */
  const stood = () => yards.yards().filter((y) => y.pool.size() > 0).map((y) => y.bk);
  return { yards, stood, own, keys };
}
const cam = { pos: [0, 1.6, 10], yaw: 0, pitch: 0 };
const FRAME_S = 1 / 60;

test('YARD-TOWN a town\'s answer stands YARD_STANDS_A_FRAME strangers\' yards a frame, the next frame syncing again until the town is stood - never half a second apart - and the owner\'s own yard never waits behind them (mutants: the budget unasked; the next frame unsynced; the own yard waiting; the budget never spent)', async () => {
  assert.ok(YARD_STANDS_A_FRAME >= 1 && YARD_STANDS_A_FRAME * FRAME_S < YARD_SYNC_S);
  const strangers = 2 * YARD_STANDS_A_FRAME + 1;
  const w = town(strangers);
  w.yards.frame({ dt: 1, cam, overlayUp: false });   // the town asked
  await settle(); await settle();
  assert.deepEqual(w.stood(), [], 'nothing before the answer');
  const counts = [];
  for (let f = 0; f < 4; f++) {
    w.yards.frame({ dt: f === 0 ? 1 : FRAME_S, cam, overlayUp: false });
    counts.push(w.stood().length);
    if (f === 0) assert.ok(w.stood().includes(w.own), 'the owner\'s own yard in the first frame, listed last');
  }
  assert.deepEqual(counts, [YARD_STANDS_A_FRAME + 1, 2 * YARD_STANDS_A_FRAME + 1, strangers + 1, strangers + 1], 'a few a frame, each frame after the last');
  assert.deepEqual(w.stood().sort(), [...w.keys].sort(), 'the whole town stood');
  for (const y of w.yards.yards()) assert.equal(y.pool.size(), 2, `yard ${y.bk} whole`);
});
