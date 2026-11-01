// THE SNOW'S BUILDS ON A WORKER. The middle ring's rebuild and the local window's recentre
// run on systems/snowfall/snowBuildWorker.js over a copy of the ground (snowBuildKernel.js); the main thread posts them
// and takes the finished arrays (snowBuildClient.js). The claim pinned here is the one the change rests on: for the same
// inputs the worker makes the very bytes the main thread's own build makes. The world is snowfallHost.js's own adapter
// over a ground whose laws are systems/snowfall/snowGroundLaw.js's (scenes/snowGround.js's): rolling samples, a pixel at stride 2,
// a shore's carved bed, a carved sea with its floor, Basic Roads' tracks classified for real, a town. The worker is the
// kernel in this process behind a structured clone each way - what crosses must be data, and a transferred array is gone
// from the side that sent it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnowCoverage, snowfallSettings, predictRoadTile, roadCorners } from '../../src/systems/snowfall.js';
import { SnowfallRuntime } from '../../src/systems/snowfallRuntime.js';
import { createSnowfallHost } from '../../src/scenes/snowfallHost.js';
import { SnowBuildKernel, MID_ARRAYS, LOCAL_ARRAYS } from '../../src/systems/snowfall/snowBuildKernel.js';
import { SnowBuildClient, snowThreadDisabled } from '../../src/systems/snowfall/snowBuildClient.js';
import { snowThreadVerify } from '../../src/systems/snowfall/snowBuildVerify.js';
import { snowGroundHeight, snowGroundNormal, snowGroundBare, snowGroundSnapshot, snowPixelX, snowPixelY, snowGlobalOf } from '../../src/systems/snowfall/snowGroundLaw.js';
import { VERTEX_GRID_SIZE } from '../../src/world/deepWater/deepWaterFloor.js';
import { MASKS } from '../snowMasks.mjs';   // Our snow law's masks over a made-up winter set - Snowfall's own are retired

const SIZE = 819.2;
const bytesOf = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

/** A built pixel entry as world.js builds one - the fields snowGroundLaw.js reads, and a TileMap with Basic Roads'
 *  tracks painted where the network's north-south and east-west tracks run (so they classify as tracks). */
function entry(px, py) {
  const stride = px === 501 && py === 249 ? 2 : 1;
  const samples = new Float32Array(129 * 129);
  for (let x = 0; x < 129; x++) for (let z = 0; z < 129; z++) samples[x * 129 + z] = 0.03 + 0.012 * Math.sin((x + px * 128) * 0.07) + 0.009 * Math.cos((z - py * 128) * 0.05 + x * 0.01);
  let groundNormals = null;
  if (stride === 1 && (px + py) % 2 === 0) {
    groundNormals = new Float32Array(129 * 129 * 3);
    for (let i = 0; i < 129 * 129; i++) { const a = Math.sin(i * 0.013) * 0.2, b = Math.cos(i * 0.007) * 0.15, l = Math.hypot(a, 1, b); groundNormals.set([a / l, 1 / l, b / l], i * 3); }
  }
  const tilemapBytes = new Uint8Array(16384);
  const net = { roads: 0, roadCorners: 0, paths: 0x88 | 0x22, pathCorners: roadCorners(0, 0) };
  const rect = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  for (let i = 0; i < 16384; i++) {
    const x = i % 128, z = (i / 128) | 0, track = predictRoadTile(x, z, net.paths, net.pathCorners, 2, false, rect);
    tilemapBytes[i] = track >= 0 ? track : (((i * 7 + px * 13 + py * 5) % 56) << 2) | (i & 3);
  }
  const p = { px, py, samples, _stride: stride, groundNormals, tilemapBytes, net, rect, stamp: 1 };
  if (px === 501 && py === 250) {   // A shore's bed carved under the drawn ground
    const g = 129;
    const depths = new Float32Array(g * g);
    for (let i = 0; i < g * g; i++) depths[i] = (i % 17) * 0.05;
    p._bed = { depths };
  }
  if (px === 500 && py === 251) {   // A carved sea - its floor where the cells are carved (holes 0), bare under the snow
    const holes = new Uint8Array(128 * 128).fill(1);
    for (let z = 40; z < 90; z++) for (let x = 20; x < 100; x++) holes[z * 128 + x] = 0;
    const vertexLocalY = new Float32Array(VERTEX_GRID_SIZE * VERTEX_GRID_SIZE);
    for (let i = 0; i < vertexLocalY.length; i++) vertexLocalY[i] = -4 - (i % 9) * 0.3;
    p.deepWaters = { holes, floor: { vertexLocalY, floorQuadWater: null } };
  }
  return p;
}

/** The streaming world's frame (world.js state.mapOrigin and compensation) and a SnowGround over the entries, in
 *  scenes/snowGround.js's shape: its laws snowGroundLaw.js's, its `data` their snapshot, its `frame` toGlobal's inputs. */
function streamedWorld() {
  const F = { mx: 500, my: 250, cx: 0, cy: 0, cz: 0 };
  const entries = new Map();
  const at = (px, py) => {
    if (px < 497 || px > 504 || py < 246 || py > 254) return null;   // the stream's edge: no pixel loaded past it
    const k = px * 1000 + py;
    if (!entries.has(k)) entries.set(k, entry(px, py));
    return entries.get(k);
  };
  const g = [0, 0];
  const ground = {
    size: SIZE, terrainDistance: 1,
    pixelAt: (x, z) => at(snowPixelX(F.mx, F.cx, SIZE, x), snowPixelY(F.my, F.cz, SIZE, z)),
    pixelOn: (px, py) => at(px, py),
    pixelsNear: (ring) => { const out = []; for (let j = -ring; j <= ring; j++) for (let k = -ring; k <= ring; k++) { const p = at(F.mx + k, F.my + j); if (p) out.push(p); } return out; },
    translation: (p, out) => { out[0] = (p.px - F.mx) * SIZE + F.cx; out[1] = F.cy; out[2] = -(p.py - F.my) * SIZE + F.cz; return out; },
    height: (p, lx, lz) => snowGroundHeight(p, true, lx, lz),
    normal: (p, lx, lz, out) => snowGroundNormal(p, lx, lz, out),
    bare: (p, lx, lz) => snowGroundBare(p, lx, lz),
    data: (p) => snowGroundSnapshot(p, true),
    frame: () => [F.mx, F.my, F.cx, F.cz, SIZE],
    tileMap: (p) => p.tilemapBytes, climate: () => 231, mapPixel: (p) => ({ x: p.px, y: p.py }), stamp: (p) => p.stamp,
    roads: (p) => ({ ...p.net, authored: new Uint8Array(16384), rect: p.rect }),
    toGlobal: (x, z) => snowGlobalOf(F.mx, F.my, F.cx, F.cz, SIZE, x, z, g),
    settlements: () => [{ minX: 500 * SIZE + 200, minZ: 249 * SIZE + 100, maxX: 500 * SIZE + 520, maxZ: 249 * SIZE + 380 },
      { minX: 500 * SIZE + 800, minZ: 249 * SIZE + 474, maxX: 500 * SIZE + 801, maxZ: 249 * SIZE + 475 }],   // a hamlet on the way back: its feather a slope in x and z
  };
  return { F, ground };
}

/** The host's own world adapter over that ground (snowfallHost.js terrainOf: the tiles, their snapshots, terrainOn). */
async function hostWorld() {
  const { F, ground } = streamedWorld();
  const host = createSnowfallHost({ enhanced: true, ground, loadMasks: async () => MASKS });
  host.frame({ now: 1, inside: true, player: null, weather: 'clear', seconds: 3_000_000, winter: true, climate: 231 });
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(host.runtime, 'the host stands its runtime');
  const world = host.runtime.world;
  host.dispose();
  return { F, world };
}

/** The worker: the kernel behind a structured clone each way, its answers held until `flush` (a frame later, as a
 *  worker's are). `twin` (optional) sees each message first, with the runtime's state as it is at the post, and may
 *  answer a check the kernel's reply is put to. `sent` counts the grounds and roads that crossed. */
function fakeWorker(kernel, twin = null) {
  const queue = [];
  const w = {
    onmessage: null, onerror: null, terminated: false, throwOn: null, hang: false, sent: { tiles: 0, roads: 0 },
    postMessage(m, transfer = []) {
      if (w.terminated) return;
      const check = twin?.(m);
      if (m.t === 'tiles') w.sent.tiles += m.tiles.length;
      if (m.t === 'roads') w.sent.roads++;
      const copy = structuredClone(m, { transfer });
      if (w.throwOn === copy.t) { queue.push({ t: 'error', id: copy.id, message: 'a kernel fault' }); return; }
      if (w.hang && (copy.t === 'mid' || copy.t === 'local')) return;   // a worker that never answers and never faults
      const out = kernel.handle(copy);
      check?.(out?.reply);
      if (out?.reply) queue.push(structuredClone(out.reply, { transfer: out.transfer ?? [] }));
    },
    flush() { for (const d of queue.splice(0)) w.onmessage?.({ data: d }); },
    terminate() { w.terminated = true; },
  };
  return w;
}

const playerAt = (x, z) => ({ x, y: 0, z, grounded: true, swimming: false, levitating: false });
const frameOf = (st) => ({ now: st.now, inside: false, enabled: true, player: playerAt(st.x, st.z), winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [] });
/** A flight over the stream: east, then north-east, then back west - at a walk, a ride and 40 m/s - crossing the
 *  stride-2 pixel, the shore, the carved sea and the town; `at(i, st)` the events. */
function fly(n, step, at) {
  const st = { now: 0, sec: 1_000_000, x: 30, z: 30 };
  for (let i = 0; i < n; i++) {
    st.now += 1 / 60; st.sec += 2;
    const speed = i < 300 ? 0.08 : i < 900 ? 0.35 : 0.67;   // 4.8, 21 and 40 m/s at 60 fps
    const dir = i < 1400 ? [1, 0] : i < 2200 ? [0.6, 0.8] : [-1, 0.1];
    st.x += speed * dir[0]; st.z += speed * dir[1];
    at(i, st);
    step(st);
  }
}

test('SNOW-THREAD the ground law (world.js\'s, moved to snowGroundLaw.js): the floor where Deep Waters carved and its switch on, the terrain\'s own off it; bare on a carved cell alone; the bed carved under a shore taken off the drawn surface; the stride\'s surface; the grass\'s normals at stride 1, the samples\' otherwise - and its snapshot answers each the same after a structured clone (mutants: the carved sea snows; the floor read with the switch off; the bed added; the stride dropped; the snapshot losing the floor)', () => {
  const sea = entry(500, 251), shore = entry(501, 250), coarse = entry(501, 249), grassy = entry(500, 250);
  const carved = [20 * 6.4 + 3, 40 * 6.4 + 3], kept = [5 * 6.4, 5 * 6.4];
  assert.equal(snowGroundBare(sea, ...carved), true, 'a carved cell is bare');
  assert.equal(snowGroundBare(sea, ...kept), false, 'a cell the sea left keeps its ground');
  assert.ok(snowGroundHeight(sea, true, ...carved) < -3.9, 'the floor is the ground there');
  assert.ok(snowGroundHeight(sea, false, ...carved) > 10, 'Deep Waters off: the terrain\'s own');
  const flat = { ...shore, _bed: null };
  assert.ok(snowGroundHeight(shore, true, 100.3, 7.1) < snowGroundHeight(flat, true, 100.3, 7.1), 'the bed lowers the drawn ground');
  const fine = { ...coarse, _stride: 1 };
  assert.notEqual(snowGroundHeight(coarse, true, 33.3, 47.7), snowGroundHeight(fine, true, 33.3, 47.7), 'the stride is the drawn surface\'s');
  const n1 = snowGroundNormal(grassy, 40, 40, [0, 0, 0]), n2 = snowGroundNormal({ ...grassy, groundNormals: null }, 40, 40, [0, 0, 0]);
  assert.notDeepEqual(n1, n2, 'the grass\'s normals read where they are kept');
  for (const p of [sea, shore, coarse, grassy]) {
    const copy = structuredClone(snowGroundSnapshot(p, true));
    for (const [x, z] of [carved, kept, [100.3, 7.1], [33.3, 47.7], [818.9, 0.2]]) {
      assert.equal(snowGroundHeight(copy, copy.floors, x, z), snowGroundHeight(p, true, x, z));
      assert.deepEqual(snowGroundNormal(copy, x, z, [0, 0, 0]), snowGroundNormal(p, x, z, [0, 0, 0]));
      assert.equal(snowGroundBare(copy, x, z), snowGroundBare(p, x, z));
    }
  }
});

test('SNOW-THREAD the build worker makes the main thread\'s bytes: every middle ring and every window recentre a same-thread runtime commits along a flight - the stride-2 pixel, the carved bed, the carved sea, the tracks, the town, a floating origin\'s move and a slope limit changed - is, array for array, what the worker answers for the same build posted from that runtime\'s state (mutants: the frame\'s compensation dropped; a pixel\'s origin not the post\'s; the context\'s roads not the prepared ones; the window handed over ignored; step 1\'s copy run past its row, or not written)', async () => {
  const { F, world } = await hostWorld();
  const settings = { ...snowfallSettings(), settlementBoundaryFeather: 32 };   // the mod's widest: a context byte a texel apart differs near a town
  const kernel = new SnowBuildKernel();
  const w = fakeWorker(kernel);
  const client = new SnowBuildClient({ masks: MASKS, settings, workerFactory: () => w });
  assert.ok(client.up, 'the worker is up');
  const A = new SnowfallRuntime({ world, coverage: new SnowCoverage(MASKS), settings, frameBudgetMs: Infinity });
  let midJob = 0, localJob = 0, rings = 0, windows = 0;
  const { _midBegin, _midCommit, _beginRecenter, _commitRecenter } = A;
  A._midBegin = function (p) { _midBegin.call(this, p); midJob = client.postMid(this); w.flush(); };
  let before = null;
  A._beginRecenter = function (...a) {
    before = this.local.context.slice();   // the committed window's context the recentre copies from (step 1's runs)
    _beginRecenter.apply(this, a);
    localJob = client.postLocal(this); w.flush();
  };
  A._midCommit = function () {
    _midCommit.call(this);
    const r = client.take(midJob);
    assert.ok(r?.ok, `ring ${rings}: the worker built it`);
    for (const k of MID_ARRAYS) assert.ok(bytesOf(r.arrays[k]).equals(bytesOf(this.mid[k])), `ring ${rings} round (${this.mid.center}): ${k} the same bytes`);
    assert.deepEqual(r.tiles, this.mid.tiles, `ring ${rings}: the same tiles, in the same order`);
    rings++;
  };
  A._commitRecenter = function () {
    _commitRecenter.call(this);
    const r = client.take(localJob);
    assert.ok(r?.ok, `window ${windows}: the worker built it`);
    for (const k of LOCAL_ARRAYS) assert.ok(bytesOf(r.arrays[k]).equals(bytesOf(this.local[k])), `window ${windows} round (${this.local.center}): ${k} the same bytes`);
    // and both are the window's law, apart from either: each texel the last window held at the shifted place is that
    // texel, every other one a sample of the context there (step 1's copy runs end where the row's in-range stretch does)
    const L = this.local, n = L.sres, dia = this.gridDiameter, [dx, dz] = L.statDelta, ctx = new Uint8Array(4), f32 = Math.fround;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = i * n + j, sj = j + dx, si = i + dz;
        if (sj >= 0 && sj < n && si >= 0 && si < n) ctx.set(before.subarray((si * n + sj) * 4, (si * n + sj) * 4 + 4));
        else this.context.sample(f32(L.statCenter[0] + f32(f32(f32(j / (n - 1)) - 0.5) * dia)), f32(L.statCenter[1] + f32(f32(f32(i / (n - 1)) - 0.5) * dia)), ctx, 0);
        assert.deepEqual([...L.context.subarray(k * 4, k * 4 + 4)], [...ctx], `window ${windows}: texel ${j},${i} (shifted ${dx},${dz})`);
      }
    }
    windows++;
  };
  let shifted = false, sloped = false;
  fly(2600, (st) => A.frame(frameOf(st)), (i, st) => {
    if (!shifted && i === 1200) {   // the floating origin: the scene moves, the world with it
      shifted = true;
      F.cx -= SIZE; F.cz += 0.5 * SIZE; F.cy -= 3;
      A.offsetOrigin([-SIZE, -3, 0.5 * SIZE]); client.offset([-SIZE, -3, 0.5 * SIZE]); w.flush();
      st.x -= SIZE; st.z += 0.5 * SIZE;
    }
    if (!sloped && i === 1800) {
      sloped = true;
      const next = { ...A.settings, maxSnowSlope: Math.fround(28) };
      A.applySettings(next); client.settings(next); w.flush();
    }
  });
  assert.ok(rings >= 12 && windows >= 60, `rings and windows committed along the flight: ${rings}, ${windows}`);
  assert.ok(w.sent.tiles >= 6 && w.sent.roads >= 4, `the stream's grounds and roads crossed: ${w.sent.tiles}, ${w.sent.roads}`);
});

test('SNOW-THREAD a runtime on the worker: its rings and windows come from the worker, a frame after they are posted, and each ring is the bytes a fresh same-thread build makes round its centre; a window recentred from the worker\'s own copy of it is the one recentred from the main thread\'s, and a recentre the player outran leaves the worker\'s copy untrusted (mutants: the mirror trusted after a refused job; the ring left on the main thread)', async () => {
  const { world } = await hostWorld();
  const settings = snowfallSettings();
  const kernel = new SnowBuildKernel(), twinKernel = new SnowBuildKernel();
  let B = null, mirrored = 0;
  const twin = (m) => {   // the same job, handed the window the main thread holds, on a kernel of its own
    if (m.t === 'local' && !m.arrays && !m.full) {
      const L = B.local;
      const out = twinKernel.handle(structuredClone({ ...m, mirror: 0, arrays: { pos: L.pos, nrm: L.nrm, statics: L.statics, context: L.context } }));
      return (mine) => {   // the worker's own answer, from its own copy of the window
        assert.ok(mine.ok && out.reply.ok, 'both built');
        for (const k of LOCAL_ARRAYS) assert.ok(bytesOf(mine.arrays[k]).equals(bytesOf(out.reply.arrays[k])), `the mirror's window: ${k}`);
        mirrored++;
      };
    }
    if (m.t !== 'local' && m.t !== 'mid' && m.t !== 'recycle') twinKernel.handle(structuredClone(m));
    return null;
  };
  const w = fakeWorker(kernel, twin);
  const client = new SnowBuildClient({ masks: MASKS, settings, workerFactory: () => w });
  B = new SnowfallRuntime({ world, coverage: new SnowCoverage(MASKS), settings, frameBudgetMs: Infinity, builds: client });
  let here = 0, rings = 0;
  const { _midProcess, _processRecenter, _midCommit } = B;
  B._midProcess = function (...a) { here++; return _midProcess.apply(this, a); };
  B._processRecenter = function (...a) { here++; return _processRecenter.apply(this, a); };
  B._midCommit = function () {
    _midCommit.call(this);
    const C = new SnowfallRuntime({ world, coverage: new SnowCoverage(MASKS), settings: this.settings, frameBudgetMs: Infinity });
    C._midBegin([this.mid.center[0], this.mid.center[1]]);
    while (C.mid.building) C._midProcess(C.mid.buildCenter, { now: 0 });
    assert.deepEqual(C.mid.center, this.mid.center);
    for (const k of ['pos', 'nrm', 'ctxA', 'ctxB', 'ctxC', 'heights', 'bnrm', 'statics', 'context']) assert.ok(bytesOf(C.mid[k]).equals(bytesOf(this.mid[k])), `ring ${rings}: ${k} a fresh build's bytes`);
    rings++;
  };
  let jumped = 0, nextJump = 399, reset = false;
  fly(2600, (st) => { w.flush(); B.frame(frameOf(st)); }, (i, st) => {
    if (i >= nextJump && B.local.job) { st.x += 30; jumped++; nextJump = i + 400; }   // outrun a recentre that is out: it is refused, and the worker built it
    if (!reset && i > 1500 && B.mid.job && B.mid.building) { reset = true; B.worldReset(); }   // a door, a teleport: the builds out are let go
  });
  assert.ok(reset, 'the world was reset with a ring out');
  const held = [...client._answers.keys()].filter((id) => id !== client._latest.mid && id !== client._latest.local);
  assert.deepEqual(held, [], 'no build let go keeps its answer');
  assert.ok(jumped >= 3, `recentres outrun: ${jumped}`);
  assert.equal(here, 0, 'nothing built on the main thread');
  assert.ok(rings >= 12 && B.local.meshReady && client.taken >= 60, `the worker's rings and windows committed: ${rings}, ${client.taken}`);
  assert.ok(mirrored >= 30, `windows recentred from the worker's own copy: ${mirrored}`);
});

test('SNOW-THREAD the fallback is the old path: ?snowthread=off, no Worker, a factory that throws and a ground the worker cannot copy each build on the main thread; a worker that faults mid-build hands its build back, and one that falls silent is let go at its deadline - the runtime finishes either build there (mutants: a faulted job never answered; a silent worker waited on for ever)', async () => {
  assert.equal(snowThreadDisabled('?world&snowthread=off'), true);
  assert.equal(snowThreadDisabled('?world&snowthread=on'), false);
  const quiet = console.warn;
  console.warn = () => {};
  try {
    assert.equal(new SnowBuildClient({ masks: MASKS, settings: snowfallSettings() }).up, false, 'node: no Worker');
    assert.equal(new SnowBuildClient({ masks: MASKS, settings: snowfallSettings(), workerFactory: () => { throw new Error('no'); } }).up, false);
    const { world } = await hostWorld();
    const w = fakeWorker(new SnowBuildKernel());
    const client = new SnowBuildClient({ masks: MASKS, settings: snowfallSettings(), workerFactory: () => w });
    const B = new SnowfallRuntime({ world, coverage: new SnowCoverage(MASKS), frameBudgetMs: Infinity, builds: client });
    w.throwOn = 'mid';
    let here = 0;
    const { _midProcess } = B;
    B._midProcess = function (...a) { here++; return _midProcess.apply(this, a); };
    fly(700, (st) => { w.flush(); B.frame(frameOf(st)); }, () => {});
    assert.equal(client.up, false, 'the faulted worker is let go');
    assert.ok(here > 0 && B.mid.completed >= 2 && B.local.meshReady, `the ring built here instead: ${B.mid.completed}`);
    let ms = 0;
    const hung = fakeWorker(new SnowBuildKernel());
    hung.hang = true;
    const late = new SnowBuildClient({ masks: MASKS, settings: snowfallSettings(), workerFactory: () => hung, clock: () => ms });
    const H = new SnowfallRuntime({ world, coverage: new SnowCoverage(MASKS), frameBudgetMs: Infinity, builds: late });
    fly(1200, (st) => { ms += 1000 / 60; hung.flush(); H.frame(frameOf(st)); }, () => {});
    assert.equal(late.up, false, 'a worker that hangs is let go at the deadline');
    assert.ok(H.mid.completed >= 1 && H.local.meshReady, 'and the ring and the window are built here');
    const noData = { ...world, frame: undefined };
    const D = new SnowfallRuntime({ world: noData, coverage: new SnowCoverage(MASKS), frameBudgetMs: Infinity, builds: new SnowBuildClient({ masks: MASKS, settings: snowfallSettings(), workerFactory: () => fakeWorker(new SnowBuildKernel()) }) });
    fly(400, (st) => D.frame(frameOf(st)), () => {});
    assert.ok(D.mid.completed >= 1 && D.builds.posted === 0, 'a world with no frame to copy: every build here');
  } finally { console.warn = quiet; }
});

test('SNOW-THREAD VERIFY ?snowthread=verify: off by default and absent (no verifier, nothing kept); on, every answer is compared with the main thread\'s build of the same job from the live ground - none differ along a flight with outrun recentres, a floating origin\'s move, a settings change and a world reset with a ring out, whose build is let go and its answer handed back; and a ground rewritten in place under the worker\'s copy is caught, named by pixel and field (mutants: the copy compared with itself; the answers never compared; the stale pixel not named)', async () => {
  assert.equal(snowThreadVerify('?world&snowthread=verify'), true);
  assert.equal(snowThreadVerify('?world&snowthread=off'), false);
  assert.equal(snowThreadVerify(undefined), false);
  const { F, world } = await hostWorld();
  const off = new SnowBuildClient({ masks: MASKS, settings: snowfallSettings(), workerFactory: () => fakeWorker(new SnowBuildKernel()) });
  assert.equal(off._verify, null, 'off: no verifier');
  const w = fakeWorker(new SnowBuildKernel());
  const client = new SnowBuildClient({ masks: MASKS, settings: snowfallSettings(), workerFactory: () => w, verify: true, clock: () => 0 });   // a slow runner's wall clock must not trip the hang deadline
  const V = client._verify;
  const B = new SnowfallRuntime({ world, coverage: new SnowCoverage(MASKS), settings: snowfallSettings(), frameBudgetMs: Infinity, builds: client });
  let nextJump = 399, reset = false, shifted = false, sloped = false;
  const quiet = console.warn;
  const warned = [];
  console.warn = (...a) => warned.push(a);
  try {
    fly(2600, (st) => { w.flush(); B.frame(frameOf(st)); }, (i, st) => {
      if (i >= nextJump && B.local.job) { st.x += 30; nextJump = i + 400; }
      if (!shifted && i === 1200) {
        shifted = true;
        F.cx -= SIZE; F.cz += 0.5 * SIZE; F.cy -= 3;
        B.offsetOrigin([-SIZE, -3, 0.5 * SIZE]);
        st.x -= SIZE; st.z += 0.5 * SIZE;
      }
      if (!sloped && i === 1800) { sloped = true; B.applySettings({ ...B.settings, maxSnowSlope: Math.fround(28) }); }
      if (!reset && i > 1500 && B.mid.job && B.mid.building) { reset = true; B.worldReset(); }
    });
    w.flush();
    const r = V.report();
    assert.equal(r.mismatches, 0, `no answer differs: ${JSON.stringify(r.mismatchLog[0] ?? null)}`);
    assert.ok(r.compared >= 60 && r.compared === client.posted - r.outstanding, `every answer compared: ${r.compared} of ${client.posted}`);
    assert.ok(r.letGo >= 1 && r.handedBack >= 1, `the reset's build let go (${r.letGo}) and an answer handed back (${r.handedBack})`);
    // a ground rewritten in place: the same arrays, so the worker keeps its copy - which is now stale
    const held = [...V.held.values()];
    assert.ok(held.length >= 4, 'grounds on the worker');
    let rewrote = 0;
    for (let px = 497; px <= 504; px++) for (let py = 246; py <= 254; py++) {
      const p = world.terrainOn?.(px, py)?.snapshot?.()?.ground;
      if (p?.samples) { for (let i = 0; i < p.samples.length; i++) p.samples[i] += 0.5; rewrote++; }
    }
    assert.ok(rewrote >= 4, 'grounds rewritten');
    B.worldReset();
    fly(200, (st) => { w.flush(); B.frame(frameOf(st)); }, () => {});
    w.flush();
    const after = V.report();
    assert.ok(after.mismatches >= 1, 'the stale copy is caught');
    const m = after.mismatchLog[0];
    assert.ok(m.staleCopies.some((c) => c.pixel.length === 2 && c.fields.includes('samples')), `the stale pixel named: ${JSON.stringify(m.staleCopies)}`);
    assert.ok(m.before.length >= 1 && warned.some((a) => /verify/.test(a[0])), 'logged with what came before it');
  } finally { console.warn = quiet; }
});
