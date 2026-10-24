// FIELD BUGS 2026-10-22d SEA-GLIDE (bible/01-Overview/bugs/Field-Bugs-2026-10-22d.md, report 3): Dahazed on the Discord's
// #bug-reports, "huge amount of lag and ship warping during sea boss fight": "lot of time the boss fight turns into dodging
// friendly ships while they randomly speed up / warp in front of you". Another player's boat (Come Sail Away's, CSA-J) is
// drawn from the `sa` word on her foes frames: a delta every 200 ms, a full frame every 2 s (net/online.js FOES_FULL_MS) -
// and a crowded cell's relay drops the deltas past its budget (FOES-FIRST), leaving the full frames. CSA-K led a word's way
// 0.6 s past its arrival and then held the boat, and eased onto the next word at 12 a second: between two full frames she
// stood still 1.4 s and then ran 17 m ahead in a fifth of a second. Driven over the real pool and the real peers' module:
// the sender's true course, words only on the full frames (the relay's floor), each late by up to 300 ms, drawn at 60 fps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers, glideToward, wayOver, CSA_PEER_LEAD_MAX, CSA_PEER_CATCH, CSA_PEER_CATCH_MPS, CSA_PEER_CATCH_SHARE, CSA_PEER_LED_SETTLE_M } from '../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { PREDICT_MAX_S, PUPPET_CATCH, PUPPET_CATCH_MPS, PUPPET_CATCH_SHARE } from '../../src/scenes/naval/navalHost.js';
import { FOES_FULL_MS, FOES_MS } from '../../src/net/online.js';
const { quatAngleAxis } = await import('../../src/world/quat.js');

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const renderer = () => ({
  createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
  drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {}, destroyMesh() {},
});
function pipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const textureFiles = new Map(), cpuModels = new Map(), gpuMeshes = new Map();
  return {
    textureFiles, cpuModels, gpuMeshes,
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, texture()); return textureFiles.get(a); },
    uploadRecord: () => {},
    getGpuMesh: async (id) => { cpuModels.set(id, { positions: new Float32Array([-1, 0, -2, 1, 1.5, 2]) }); const g = { classic: id }; gpuMeshes.set(id, g); return g; },
  };
}
async function readyPool() {
  const pool = createComeSailAwayPool({ renderer: renderer(), pipeline: pipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return pool;
}
const Q0 = [0, 0, 0, 1];
const word = (x) => [1, 0, x, 34, 20, ...Q0, 0, 1, 0];   // a Large Boat at the helm, its place x
/** A small deterministic stream (xorshift) for the arrival's lateness. */
const stream = (seed) => () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 10000) / 10000; };

/** The report's fight, one peer's boat: her true course at `v` m/s along x; a word every `everyMs` of her clock, each
 *  late by 0..`lateMs` (words never overtake); drawn at 60 fps for `seconds`. Answers the drawn speeds and errors. */
async function sail({ v = 12, everyMs = FOES_FULL_MS, lateMs = 300, seconds = 30, seed = 7 } = {}) {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  const late = stream(seed);
  const sends = [];
  let lastAt = -Infinity;
  for (let t = 0; t <= seconds * 1000; t += everyMs) { lastAt = Math.max(lastAt, t + late() * lateMs); sends.push({ t, at: lastAt }); }
  const dt = 1 / 60;
  let next = 0, prev = null;
  const speeds = [], errors = [];
  for (let f = 0; f * dt <= seconds; f++) {
    const now = f * dt * 1000;
    while (next < sends.length && sends[next].at <= now) { const s = sends[next++]; peers.applyOwner('ann', { b: [word(10 + v * s.t / 1000)], m: [[v, 0, 0]] }, (p) => p, s.at); }
    peers.frame(dt);
    const x = pool.peerBoats[0]?.GameObject.position[0];
    if (x == null) continue;
    if (prev != null && now > 3000) { speeds.push((x - prev) / dt); errors.push(Math.abs(x - (10 + v * now / 1000))); }
    prev = x;
  }
  errors.sort((a, b) => a - b);
  return { speeds, p99: errors[Math.floor(errors.length * 0.99)], max: Math.max(...speeds), min: Math.min(...speeds) };
}

test('SEA-GLIDE the numbers: the lead two full frames\' spacing - past the sea\'s own prediction (PREDICT_MAX_S); the catch PUPPET-GLIDE\'s rate and floor with a quarter of her way (AUDIT FB1022d C3) (mutants: the lead back at 0.6; any catch moved)', () => {
  assert.equal(CSA_PEER_LEAD_MAX, 4);
  assert.equal(CSA_PEER_LEAD_MAX * 1000, 2 * FOES_FULL_MS, 'a full frame held for its turn is led over');
  assert.ok(CSA_PEER_LEAD_MAX >= PREDICT_MAX_S);
  assert.deepEqual([CSA_PEER_CATCH, CSA_PEER_CATCH_MPS], [PUPPET_CATCH, PUPPET_CATCH_MPS]);
  assert.equal(CSA_PEER_CATCH_SHARE, 0.25);
  assert.ok(CSA_PEER_CATCH_SHARE > PUPPET_CATCH_SHARE, 'the full frames\' residuals are larger than a relay\'s jitter');
});

test('SEA-GLIDE the take: the water\'s plane at the bounded catch, the level eased; nothing off, nothing taken (mutants: the bound dropped; the share dropped)', () => {
  const g = glideToward([0, 0, 0], [10, 2, 0], 0.1, 12);
  assert.ok(Math.abs(g[0] - (0.3 + 0.25 * 12) * 0.1) < 1e-9, `the bound: ${g[0]}`);
  assert.ok(g[1] > 0 && g[1] < 2, 'the level eased');
  const small = glideToward([0, 0, 0], [0.01, 0, 0], 0.1, 12);
  assert.ok(Math.abs(small[0] - 0.01 * (1 - Math.exp(-0.1))) < 1e-12, 'a small error by the rate');
  assert.deepEqual(glideToward([1, 2, 3], [1, 2, 3], 0.1, 5), [1, 2, 3]);
});

test('SEA-GLIDE the report\'s fight: words on the full frames alone, each up to 300 ms late - she is never drawn stopped, never past her way and the catch, and stays within a few metres of her true place (mutants: the lead back at 0.6; the ease back under way)', async () => {
  const r = await sail();
  const bound = 12 + CSA_PEER_CATCH_MPS + CSA_PEER_CATCH_SHARE * 12;
  assert.ok(r.max <= bound + 1e-3, `never faster than her way and the catch: ${r.max.toFixed(2)} m/s (bound ${bound})`);
  assert.ok(r.min >= 12 - (CSA_PEER_CATCH_MPS + CSA_PEER_CATCH_SHARE * 12) - 1e-3, `never stopped: slowest ${r.min.toFixed(2)} m/s`);
  assert.ok(r.p99 < 4, `within ${r.p99.toFixed(2)} m of her true place (p99)`);
  // every word (a delta each FOES_MS) the same, closer
  const all = await sail({ everyMs: FOES_MS, lateMs: 250 });
  assert.ok(all.max <= bound + 1e-3 && all.p99 < 4, `all words: ${all.max.toFixed(2)} m/s, ${all.p99.toFixed(2)} m`);
  // the full frames held for their turn (FOES-HOLD), up to 1.5 s: still never stopped, never a surge - drawn where her
  // late word puts her, the lateness itself the distance (no word carries the sender's time here)
  const held = await sail({ lateMs: 1500 });
  assert.ok(held.max <= bound + 1e-3, `held: ${held.max.toFixed(2)} m/s`);
  assert.ok(held.min >= 12 - (CSA_PEER_CATCH_MPS + CSA_PEER_CATCH_SHARE * 12) - 1e-3, `held, never stopped: ${held.min.toFixed(2)} m/s`);
  assert.ok(held.p99 < 12 * 1.5 + 1, `held: within her way times the hold (${held.p99.toFixed(2)} m)`);
});

// ─── AUDIT FB1022d (lane C): a stop, a turn, a teleport under way, a slow boat ───────────────────────────────────
/** A course: her place, her way and her turn at `t` seconds. Words on the full frames, `late` s late, drawn at 60 fps; a
 *  passenger aboard when `aboard`. Answers the drawn speeds, the errors past `from`, whether she snapped or her hull was
 *  swapped. */
async function voyage(course, { seconds = 40, everyMs = FOES_FULL_MS, late = () => 0.15, aboard = false, from = 3 } = {}) {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  peers.setKeepAboard(() => aboard);
  const dt = 1 / 60;
  const sends = [];
  let lastAt = -Infinity;
  for (let t = 0; t <= seconds * 1000; t += everyMs) { lastAt = Math.max(lastAt, t + late() * 1000); sends.push({ t, at: lastAt }); }
  let next = 0, prev = null, first = null, snapped = false;
  const speeds = [], errors = [];
  for (let f = 0; f * dt <= seconds; f++) {
    const now = f * dt * 1000;
    while (next < sends.length && sends[next].at <= now) {
      const s = sends[next++], c = course(s.t / 1000);
      const q = quatAngleAxis(c.heading, [0, 1, 0]);
      peers.applyOwner('ann', { b: [[1, 0, c.x, 34, c.z, ...q, 0, 1, 0]], ...(c.vx || c.vz || c.turn ? { m: [[c.vx, c.vz, c.turn]] } : {}) }, (p) => p, s.at);
    }
    peers.frame(dt);
    const b = peers.boatAt('ann', 0);
    if (!b) continue;
    first ??= b;
    if (f * dt > 0.5 && peers.moveOf(b) == null) snapped = true;
    const p = b.GameObject.position, c = course(now / 1000);
    if (prev && now / 1000 > from) { speeds.push(Math.hypot(p[0] - prev[0], p[2] - prev[2]) / dt); errors.push(Math.hypot(p[0] - c.x, p[2] - c.z)); }
    prev = [p[0], p[1], p[2]];
  }
  errors.sort((a, b) => a - b);
  return { max: Math.max(...speeds), p99: errors[Math.floor(errors.length * 0.99)], snapped, same: peers.boatAt('ann', 0) === first, finalErr: (() => { const p = peers.boatAt('ann', 0).GameObject.position, c = course(seconds); return Math.hypot(p[0] - c.x, p[2] - c.z); })() };
}
const straight = (v, stopAt = Infinity) => (t) => { const tt = Math.min(t, stopAt); return { x: 10 + v * tt, z: 20, vx: t < stopAt ? v : 0, vz: 0, turn: 0, heading: 90 }; };
/** A circle at `w` degrees a second, `v` m/s, as the helm turns her (quatAngleAxis's sense: x toward -z). */
const circle = (v, w) => (t) => {
  const om = (w * Math.PI) / 180, h = om * t;
  return { x: 10 + (v * Math.sin(h)) / om, z: 20 - (v * (1 - Math.cos(h))) / om, vx: v * Math.cos(h), vz: -v * Math.sin(h), turn: w, heading: 90 + w * t };
};

test('AUDIT FB1022d C1: she stops dead 0.1 s after a full frame, her words the full frames alone - never snapped, her passenger kept on the one hull, never faster than her way and the catch, and back on her word (mutants: the snap by the word\'s way alone; the glide back by none)', async () => {
  const r = await voyage(straight(12, 30.1), { aboard: true, seconds: 50 });
  const bound = 12 + CSA_PEER_CATCH_MPS + CSA_PEER_CATCH_SHARE * 12;
  assert.equal(r.snapped, false, 'no teleport');
  assert.equal(r.same, true, 'her passenger on the hull that sailed on');
  assert.ok(r.max <= bound + 1e-3, `never past her way and the catch: ${r.max.toFixed(2)}`);
  assert.ok(r.finalErr < CSA_PEER_LED_SETTLE_M, `back on her word: ${r.finalErr.toFixed(2)} m`);
});

test('AUDIT FB1022d C2: circling at 10 and 20 degrees a second, her words the full frames alone - led along the arc, within 4 m of her place (p99) (mutants: led straight; the arc turned the wrong way)', async () => {
  for (const w of [10, 20, -15]) {
    const r = await voyage(circle(12, w));
    assert.ok(r.p99 < 4, `${w} deg/s: within ${r.p99.toFixed(2)} m`);
    assert.equal(r.snapped, false);
  }
  // the arc, by quatAngleAxis's own sense: a way along +x turned 90 degrees runs toward -z
  const [ax, az] = wayOver([1, 0, 0], 90, 1);
  assert.ok(ax > 0 && az < 0, `(${ax}, ${az})`);
  assert.deepEqual(wayOver([3, 0, 4], 0, 2), [6, 8], 'no turn: straight');
});

test('AUDIT FB1022d C5: a teleport under way still snaps; a slow boat glides as any boat under way (mutants: a boat under way never snapped; a way under 3 m/s eased; the led way never settles)', async () => {
  // a jump of 100 m while sailing at 12
  const r = await voyage((t) => ({ ...straight(12)(t), x: 10 + 12 * t + (t >= 20 ? 100 : 0) }), { everyMs: FOES_MS, late: () => 0.05, seconds: 25 });
  assert.equal(r.snapped, true, 'a teleport is one');
  assert.ok(r.finalErr < 2, `and she stands there: ${r.finalErr.toFixed(2)} m off`);
  // C1's led way settles: a boat that stopped, glided back and lies still is a boat at rest again - a 25 m step of hers is
  // past her snap (CSA_PEER_SNAP_M), not glided as if she still sailed at 12
  const rest = await voyage((t) => ({ ...straight(12, 30.1)(t), x: 10 + 12 * 30.1 + (t >= 46 ? 25 : 0) }), { seconds: 50 });
  assert.equal(rest.snapped, true, 'at rest, a 25 m step snaps');
  assert.ok(rest.finalErr < 1, `and she stands there: ${rest.finalErr.toFixed(2)} m off`);
  // a boat at 1 m/s whose word lands 5 m ahead of her: taken up at the catch, never eased there at once
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  peers.applyOwner('bob', { b: [[1, 0, 10, 34, 20, ...Q0, 0, 1, 0]], m: [[1, 0, 0]] }, (p) => p, 0);
  peers.frame(1 / 60);
  const x0 = pool.peerBoats[0].GameObject.position[0];
  peers.applyOwner('bob', { b: [[1, 0, 15, 34, 20, ...Q0, 0, 1, 0]], m: [[1, 0, 0]] }, (p) => p, 20);
  peers.frame(1 / 60);
  const step = pool.peerBoats[0].GameObject.position[0] - x0;
  assert.ok(step <= (1 + CSA_PEER_CATCH_MPS + CSA_PEER_CATCH_SHARE * 1) / 60 + 1e-5, `a slow boat glides: ${step} m in a frame`);
});
