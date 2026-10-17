// FIELD BUGS 2026-10-04d CULL-SIZE (Discord, "Disappearing Horse? It's there but it gets culled on its right side") -
// A BILLBOARD'S CULL SPHERE REACHES THE QUAD AT THE SIZE IT IS DRAWN AT.
//
// createBillboardBatch adds the half-diagonal of the size a batch is BORN with to its sphere, and every cull of a flat
// (the world host's crowd cull, the billboard pass's own, the shadow replays, the air's emitters) reads that sphere
// through bounds.js batchSphere. A producer that writes its size each frame never re-minted it. Every mobile pool is
// born at { w: 1, h: 1 } - the street's foes (the crew's hands and the sworn ride in it), the watch, the townspeople of
// both exterior hosts, a ship's crew, a dungeon's mobiles - so all of them were culled by a 0.707 sphere whatever they
// drew; and the cart's horse is born on its still picture (121 x 94) and drawn on its walk (121 x 95).
//
// The fixtures are the real producers on the real renderer (a recording GL): scenes/exteriorFoes.js's pool over a
// crafted MONSTER.BSA (audit68_exterior's shape), and scenes/horseCartPool.js's horse over the mod's own sizes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createHorseCartPool, HORSE_BILLBOARD_WIDTH, HORSE_BILLBOARD_HEIGHT, HORSE_WALK_BILLBOARD_HEIGHT } from '../../src/scenes/horseCartPool.js';
import { HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT } from '../../src/systems/horse/horseCartLaw.js';
import { batchSphere, batchVisible, spherePlanes } from '../../src/render/bounds.js';
import { perspective, lookAt, multiply, mirrorProjectionX } from '../../src/world/mat4.js';

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 1600, clientHeight: 900, width: 1600, height: 900 } };
}

// ---- the street's foe pool over crafted data (audit68_exterior.test.js's MONSTER.BSA) ----------------------------
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const MONSTER_BSA = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY002.CFG', craftCfg()]]);
const player = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 });

/** One foe of the street's pool, on the real renderer, drawn at a `px` x `px` record (0.025 a pixel): the batch
 *  `batches()` hands the hosts, its feet the pool's own to move. */
async function streetFoe(px) {
  const { calls, canvas } = recordingGl();
  const renderer = new Renderer(canvas);
  const tex = { getSize: () => ({ width: px, height: px }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
  const pool = createExteriorFoes({
    renderer,
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, move: () => ({ grounded: true }), capsuleCast: () => ({ dist: Infinity }), sphereCast: () => ({ dist: Infinity }) },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return MONSTER_BSA; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => tex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: player(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  });
  const foe = await pool.spawnFoe(2, [0, 0, 10], { feetGiven: true });
  pool.update(1 / 60, [0, 0, 0], [0, 1.7, 0], {});
  const batch = () => pool.batches().find((b) => b === foe.batch);
  return { renderer, calls, pool, foe, batch };
}

// ---- the cart's horse (scenes/horseCartPool.js), its walk set up ----------------------------------------------------
async function cartHorse() {
  const { canvas } = recordingGl();
  const renderer = new Renderer(canvas);
  const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4) });
  const fetchFn = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(8).buffer });
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, fetchFn, decode });
  const horse = { isInteractive: true, position: [10, 0, 10], forward: [0, 0, 1], walk: { animationFrame: 5, walking: false } };
  pool.attach({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse, teamFollowing: false }), lateUpdate() {}, rebase() {} });
  pool.presentation.horseArt.ensureStationary(); pool.presentation.horseArt.ensureWalk();
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  pool.frame(1 / 60, [0, 1.7, 0]);
  return { pool, batch: pool.batches()[0] };
}

/** The four corners of the quad BB_VS draws for one placement (bottom-anchored, `right` along the view, world up). */
const quadCorners = (b, right) => {
  const o = b.origin, w = b.size.w, h = b.size.h, c = [b.bounds[0] + o[0], b.bounds[1] + o[1], b.bounds[2] + o[2]];
  return [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]].map(([x, y]) => [c[0] + right[0] * x * w, c[1] + y * h, c[2] + right[2] * x * w]);
};
/** How far the farthest corner of that quad stands outside the batch's sphere, at any facing (0: inside). */
function overreach(b) {
  const s = batchSphere(b, new Float64Array(4));
  let worst = 0;
  for (let a = 0; a < 360; a += 15) {
    const right = [Math.cos(a * Math.PI / 180), 0, -Math.sin(a * Math.PI / 180)];
    for (const p of quadCorners(b, right)) worst = Math.max(worst, Math.hypot(p[0] - s[0], p[1] - s[1], p[2] - s[2]) - s[3]);
  }
  return worst;
}

const frame = (eye, yaw, pitch = 0) => {
  const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
  return { proj, view, pv: multiply(proj, view, new Float32Array(16)), right: [Math.cos(yaw), 0, -Math.sin(yaw)] };
};
/** Is any of the quad on screen - a grid over it through the clip box, as the rasteriser would see it. */
function onScreen(pv, b, right) {
  const [c0, c1, c2] = quadCorners(b, right);
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const u = i / 8, v = j / 8;
    const x = c0[0] + (c1[0] - c0[0]) * u + (c2[0] - c0[0]) * v, y = c0[1] + (c2[1] - c0[1]) * v, z = c0[2] + (c1[2] - c0[2]) * u;
    const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    if (cw <= 0) continue;
    const nx = (pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / cw, ny = (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / cw;
    if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) return true;
  }
  return false;
}

test('CULL-SIZE: the street\'s foe is born at { w: 1, h: 1 } and drawn at its record\'s size - its sphere now reaches the quad it draws, at every facing', async () => {
  const { batch } = await streetFoe(100);
  const b = batch();
  assert.deepEqual({ w: Math.abs(b.size.w), h: b.size.h }, { w: 2.5, h: 2.5 }, 'a 100 px record draws 2.5 m square');
  assert.ok(Math.abs(b.bounds[3] - Math.SQRT1_2) < 1e-6, `the sphere it was born with is the placeholder's (${b.bounds[3]})`);
  assert.ok(overreach(b) < 1e-9, `every corner of the drawn quad is inside the sphere (overreach ${overreach(b).toFixed(3)} m)`);
  assert.ok(Math.abs(batchSphere(b, new Float64Array(4))[3] - Math.hypot(2.5, 2.5) / 2) < 1e-9, 'exactly the half-diagonal of the size it is drawn at');
});

test('CULL-SIZE: swept past the screen\'s edges, the foe is never dropped while its quad is on screen - by the world host\'s crowd cull nor by the billboard pass\'s own', async () => {
  const { batch, foe, renderer, calls } = await streetFoe(100);
  const first = batch();   // batches() writes the record the pass keys its texture by
  renderer.textures.set(`${first.archive}_${first.record}`, { id: 'foe' });
  let seen = 0, kept = 0;
  const views = [frame([0, 1.7, 0], 0), frame([0, 1.7, 0], 0, -0.6), frame([0, 1.7, 0], 0, 0.5), frame([0, 1.7, 0], 0.7)];
  for (const v of views) {
    const planes = spherePlanes(v.pv, new Float32Array(24));   // world.js: `spherePlanes(multiply(proj, view, _pv), _planes)`
    for (let x = -16; x <= 16; x += 0.25) for (const z of [3, 5, 8, 12]) for (const y of [-3, 0, 3]) {
      foe.ai.feet[0] = x; foe.ai.feet[1] = y; foe.ai.feet[2] = z;
      const b = batch();
      if (!onScreen(v.pv, b, v.right)) continue;
      seen++;
      assert.ok(batchVisible(planes, b), `the host's cull (billboardOutside) dropped a foe on screen at ${[x, y, z]}`);
      renderer.beginFrame(v.proj, v.view, new Float32Array([0, 1, 0]), WORLD_FRAME);
      calls.length = 0;
      renderer.drawBillboards([b], new Float32Array(v.right), new Float32Array([0, 1, 0]));
      if (calls.some((c) => c[0] === 'drawElements')) kept++;
    }
  }
  assert.ok(seen > 400, `the sweep judged ${seen} on-screen placements`);
  assert.equal(kept, seen, 'the billboard pass drew every one of them');
});

test('CULL-SIZE: the cart\'s horse is born on its still picture and drawn on its walk - its sphere reaches the walk\'s quad', async () => {
  const { batch } = await cartHorse();
  assert.ok(batch, 'the horse stands');
  assert.equal(batch.size.h, HORSE_WALK_BILLBOARD_HEIGHT, 'drawn on the walk set (95 px)');
  assert.ok(Math.abs(batch.bounds[3] - Math.hypot(HORSE_BILLBOARD_WIDTH, HORSE_BILLBOARD_HEIGHT) / 2) < 1e-6, 'born on the still set\'s 94 px');
  assert.ok(overreach(batch) < 1e-9, `every corner of the walk frame is inside the sphere (overreach ${overreach(batch).toFixed(4)} m)`);
});

test('CULL-SIZE: a batch drawn at the size it was born with keeps the sphere it was born with, bit for bit - a pixel\'s flats, a single flat - and a size gone smaller never shrinks it', () => {
  const { canvas } = recordingGl();
  const renderer = new Renderer(canvas);
  const out = new Float64Array(4);
  const wood = renderer.createBillboardBatch(504, 3, { w: 3.1, h: 6.7 }, [[0, 0, 0], [40, 2, 7], [-13, 1, 90]]);
  wood.origin = [819.2, 0, -819.2];
  assert.equal(batchSphere(wood, out)[3], wood.bounds[3], 'the pixel\'s wood: the stored float32, untouched');
  for (const [w, h] of [[1, 1], [0.4, 0.7], [1.7, 2.3], [3.025, 2.35], [12.5, 0.3]]) {
    const one = renderer.createBillboardBatch(201, 0, { w, h }, [[5, 0, 5]]);
    assert.equal(batchSphere(one, out)[3], one.bounds[3], `a ${w} x ${h} flat born at its size keeps its stored radius`);
    one.size = { w: w * 0.5, h: h * 0.5 };
    assert.equal(batchSphere(one, out)[3], one.bounds[3], 'drawn smaller: the stored radius, never less');
    one.size = { w: -w, h };
    assert.equal(batchSphere(one, out)[3], one.bounds[3], 'mirrored (a negative width): the same reach');
  }
  assert.equal(batchSphere({ bounds: [0, 0, 0, 0.75], origin: null, size: null }, out)[3], 0.75, 'no size: the stored radius');
});
