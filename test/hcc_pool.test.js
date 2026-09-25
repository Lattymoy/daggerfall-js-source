// HCC (2026-09-23): THE PRESENTATION AND THE WIRE, PINNED BY EXECUTION - scenes/horseCartPool.js over a fake
// renderer, collider and mesh pipeline: the wagon's pieces built and drawn with turning wheels and the tier's cargo,
// the horse billboard's view and mirror off the camera, the activation targets and their names, the parked wagon's
// collider box, Physics.RaycastAll over the collider, and HCC-ONLINE's record round trip through validHccRecord.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHorseCartPool, raycastAllOver, boxTriangles, HORSE_ARCHIVE, horseStillRecord, horseWalkRecord, HORSE_BILLBOARD_WIDTH, HORSE_BILLBOARD_HEIGHT, HORSE_WALK_BILLBOARD_HEIGHT, HORSE_BOX_SIZE, WAGON_BUCKET, KEY_WAGON, KEY_FOLLOWING_WAGON, KEY_HORSE, peerKey, WAGON_HOVER_TEXT } from '../src/scenes/horseCartPool.js';
import { hccWireRecord, validHccRecord, hccRecordKey, easeToward, HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { WAGON_MODEL_ID, ACTIVATION_REACH, HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT, HORSE_WALK_SPRITE_HEIGHT } from '../src/systems/horseCartLaw.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';
import { RAY_DISTANCE, GLOBAL_SCALE } from '../src/player/activate.js';
import { syntheticWagon41214 } from './hccModel.mjs';

function fakeRenderer() {
  const r = { textures: new Map(), draws: [], batches: [], destroyed: 0, meshes: 0 };
  r.uploadTexture = (a, rec, px) => { const k = `${a}_${rec}`; r.textures.set(k, { px }); return k; };
  r.createMesh = (model) => { r.meshes++; return { model, tris: model.indices.length / 3 }; };
  r.drawMesh = (gpu, m, remap) => r.draws.push({ gpu, m: [...m], remap });
  r.createBillboardBatch = (archive, record, size, centers) => { const b = { archive, record, size, centers, origin: null, frame: null }; r.batches.push(b); return b; };
  r.destroyBillboardBatch = () => { r.destroyed++; };
  return r;
}
function fakeMeshes() {
  const model = syntheticWagon41214();
  const cpuModels = new Map([[WAGON_MODEL_ID, model]]);
  const gpu = { 41214: { id: 41214 } };
  for (const d of CARGO_DEFINITIONS) gpu[d.modelId] = { id: d.modelId };
  return { getGpuMesh: async (id) => gpu[id] ?? null, cpuModels, model };
}
function fakeCollider({ floor = 0 } = {}) {
  const buckets = new Map();
  return {
    buckets,
    addMesh: (k, p, i, m) => buckets.set(k, { p, i, m }),
    removeBucket: (k) => buckets.delete(k),
    surfaceHit: (o, d, max, filter) => {
      // a mesh roof at y = 5 in the bucket 'roof' (skippable), and the floor
      const hits = [];
      if (d[1] < 0) {
        if (o[1] > 5 && o[1] - 5 <= max && !(filter?.skip?.includes('roof'))) hits.push({ dist: o[1] - 5, key: 'roof', normal: [0, 1, 0] });
        if (o[1] > floor && o[1] - floor <= max) hits.push({ dist: o[1] - floor, key: null, normal: [0, 1, 0] });
      }
      hits.sort((a, b) => a.dist - b.dist);
      return hits[0] ?? { dist: Infinity, key: null, normal: null };
    },
    sphereCast: (o, r, d, max, filter) => ({ dist: filter?.skip?.includes(WAGON_BUCKET) ? Infinity : 1, key: WAGON_BUCKET }),
  };
}
const png = (w, h) => new Uint8Array(8);
const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4) });
const fetchOk = async () => ({ ok: true, arrayBuffer: async () => png().buffer });
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await tick(); };

/** A stand-in runtime whose view the test sets by hand. */
function fakeRuntime(view = {}) {
  const calls = [];
  return {
    calls, view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }),
    lateUpdate: (dt) => calls.push(['lateUpdate', dt]), rebase: (d) => calls.push(['rebase', d]),
    horseTargetLabel: 'Bess', handleDeployedWagonActivation: (d) => { calls.push(['wagon', d]); return true; },
    handleFollowingWagonActivation: (d) => { calls.push(['following', d]); return true; }, handleStationaryHorseActivation: (d) => { calls.push(['horse', d]); return true; },
  };
}
const deployed = (pos = [10, 0, 10], tier = 50) => ({ isGrounded: true, position: pos, rotation: [0, 0, 0, 1], cargoTier: tier });
const moving = (pos = [10, 1, 10], angle = 45) => ({ pose: { active: true, position: pos, rotation: [0, 0, 0, 1] }, wheel: { angle }, cargoTier: 25, interaction: true });
const horse = (pos = [5, 0, 5], fwd = [0, 0, 1], frame = 3, walking = true) => ({ isInteractive: true, position: pos, forward: fwd, walk: { animationFrame: frame, walking } });

test('HCC pool: the sizes and keys are the mod\'s - 121 x 0.025 wide, 94 / 95 high, the 1.1 x 2.2 x 2.6 box, reach 3.2', () => {
  assert.ok(Math.abs(HORSE_BILLBOARD_WIDTH - 121 * 0.025) < 1e-9 && GLOBAL_SCALE === 0.025);
  assert.ok(Math.abs(HORSE_BILLBOARD_HEIGHT - 94 * 0.025) < 1e-9 && Math.abs(HORSE_WALK_BILLBOARD_HEIGHT - HORSE_WALK_SPRITE_HEIGHT * 0.025) < 1e-9);
  assert.deepEqual([...HORSE_BOX_SIZE], [1.1, 2.2, 2.6]);
  assert.equal(horseStillRecord(2), 'h2'); assert.equal(horseWalkRecord(4, 7), 'w4#7'); assert.equal(HORSE_ARCHIVE, 'hcc');
  assert.equal(peerKey('abc', 'h'), 'hccPeer:abc:h');
  assert.equal(WAGON_HOVER_TEXT, 'Wagon');
});

test('HCC pool: RaycastAll walks every surface along the ray, nearest first, the wagon\'s own bucket skipped; the box is twelve triangles', () => {
  const col = fakeCollider();
  const hits = raycastAllOver(col, [0, 10, 0], [0, -1, 0], 40, []);
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((h) => h.point[1]), [5, 0]); assert.deepEqual(hits.map((h) => h.distance), [5, 10]);
  const skipped = raycastAllOver(col, [0, 10, 0], [0, -1, 0], 40, ['roof']);
  assert.equal(skipped.length, 1); assert.equal(skipped[0].point[1], 0);
  assert.equal(raycastAllOver(col, [0, 10, 0], [0, -1, 0], 3).length, 0, 'beyond the reach');
  assert.equal(raycastAllOver(null, [0, 10, 0], [0, -1, 0], 3).length, 0);
  const box = boxTriangles([-1, 0, -2], [1, 1, 2]);
  assert.equal(box.positions.length, 24); assert.equal(box.indices.length, 36);
  assert.ok([...box.indices].every((i) => i >= 0 && i < 8));
});

test('HCC pool: the wagon\'s five pieces and twelve cargo meshes arrive through the pipeline; a draw is body, two shafts, two wheels turned about their pivots, and the tier\'s cargo', async () => {
  const renderer = fakeRenderer(), meshes = fakeMeshes();
  const pool = createHorseCartPool({ renderer, meshes, collider: () => fakeCollider(), now: () => 0 });
  assert.equal(pool.presentation.wagonParts(), null, 'not yet - the build is asynchronous');
  await flush();
  const parts = pool.presentation.wagonParts();
  assert.ok(parts && parts.wheelRadius > 0 && parts.gpu.body);
  assert.equal(renderer.meshes, 5, 'five part meshes uploaded');
  const rt = fakeRuntime({ deployed: deployed([10, 0, 10], 50) });
  pool.attach(rt);
  assert.equal(pool.draw(renderer), 1);
  assert.equal(renderer.draws.length, 5 + 5, 'the five pieces and the 25 + 50 tiers\' five pieces');
  const wheel = renderer.draws.find((d) => d.gpu === parts.gpu.wheelLeft);
  assert.ok(Math.abs(wheel.m[12] - (10 + parts.wheelLeftPivot[0])) < 1e-6, 'the wheel is drawn at its pivot');
  renderer.draws.length = 0;
  pool.attach(fakeRuntime({ moving: moving([10, 1, 10], 90) }));
  pool.draw(renderer);
  const w2 = renderer.draws.find((d) => d.gpu === parts.gpu.wheelLeft);
  assert.ok(Math.abs(w2.m[5] - Math.cos(Math.PI / 2)) < 1e-6 && Math.abs(w2.m[6] - Math.sin(Math.PI / 2)) < 1e-6, 'ninety degrees about the local X');
  assert.equal(renderer.draws.length, 5 + 2, 'the 25 tier alone');
  renderer.draws.length = 0;
  pool.attach(fakeRuntime());
  assert.equal(pool.draw(renderer), 0, 'nothing shown, nothing drawn');
});

test('HCC pool: the horse billboard - the five standing views then the forty walk frames load, the view and the mirror follow the camera, the frame the walk', async () => {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: () => fakeCollider(), now: () => 0, fetchFn: fetchOk, decode });
  assert.equal(pool.presentation.horseArt.ensureStationary(), false, 'loading');
  await flush();
  assert.equal(pool.presentation.horseArt.ensureStationary(), true);
  assert.equal(renderer.textures.size, 5);
  assert.ok(renderer.textures.has('hcc_h0') && renderer.textures.has('hcc_h4'));
  assert.equal(pool.presentation.horseArt.hasWalk(), false);
  pool.presentation.horseArt.ensureWalk(); await flush(12);
  assert.equal(pool.presentation.horseArt.hasWalk(), true); assert.equal(renderer.textures.size, 45);
  assert.ok(renderer.textures.has('hcc_w4#7'));
  const rt = fakeRuntime({ horse: horse([5, 0, 5], [0, 0, 1], 3, true) });
  pool.attach(rt);
  pool.frame(1 / 30, [5, 1, 15]);   // the camera straight ahead of the horse
  assert.deepEqual(rt.calls[0], ['lateUpdate', 1 / 30]);
  let [b] = pool.batches();
  assert.ok(b, 'one batch, mine');
  assert.equal(b.record, 'w0#3'); assert.equal(b.size.w, HORSE_BILLBOARD_WIDTH); assert.equal(b.size.h, HORSE_WALK_BILLBOARD_HEIGHT);
  assert.deepEqual(b.origin, [5, 0, 5]);
  pool.frame(1 / 30, [-5, 1, 5]);   // the camera on the horse's left
  [b] = pool.batches();
  assert.ok(b.record === 'w2#3' || b.record === 'w6#3');
  const leftFlip = b.size.w < 0;
  pool.frame(1 / 30, [15, 1, 5]);   // on its right: the same view, mirrored
  [b] = pool.batches();
  assert.equal(b.size.w < 0, !leftFlip, 'the other side is the mirror');
  assert.equal(renderer.batches.length, 1, 'one batch, moved by its origin');
  pool.attach(fakeRuntime());
  pool.frame(1 / 30, [0, 0, 0]);
  assert.equal(pool.batches().length, 0); assert.equal(renderer.destroyed, 1);
  // AUDIT 68 S27-hcc-walk-fetch-storm: the failure is the POOL's to latch and to say - the runtime's own log of it was
  // unreachable, and `failed()` went with it
  let asked = 0;
  const errors = [];
  const failing = createHorseCartPool({ renderer: fakeRenderer(), meshes: fakeMeshes(), collider: () => fakeCollider(), fetchFn: async () => { asked++; return { ok: false, status: 404 }; }, decode, log: { error: (m) => errors.push(m), warn() {} } });
  failing.presentation.horseArt.ensureStationary(); await flush();
  const once = asked;
  assert.equal(failing.presentation.horseArt.ensureStationary(), false); await flush();
  assert.equal(asked, once, 'a missing file is a failure: TryLoad fails once, nothing is fetched again');
  assert.equal(errors.length, 1, 'and the pool says so once');
});

test('HCC pool: the targets, the names and the press - the parked wagon\'s box, the following team\'s, the horse\'s 1.1 x 2.2 x 2.6 turned with its forward', async () => {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: () => fakeCollider(), now: () => 0 });
  pool.presentation.wagonParts(); await flush();
  const rt = fakeRuntime({ deployed: deployed([10, 0, 10]), horse: horse([5, 0, 5], [1, 0, 0]) });
  pool.attach(rt);
  const t = pool.targets();
  assert.deepEqual(t.map((x) => x.key), [KEY_WAGON, KEY_HORSE]);
  assert.ok(t.every((x) => x.distance === RAY_DISTANCE && x.reach === ACTIVATION_REACH));
  const hb = t[1].aabb;
  assert.ok(Math.abs((hb.max[0] - hb.min[0]) - 2.6) < 1e-6 && Math.abs((hb.max[2] - hb.min[2]) - 1.1) < 1e-6, 'facing +X the 2.6 length lies along X');
  assert.ok(Math.abs(hb.min[1] - 0) < 1e-6 && Math.abs(hb.max[1] - 2.2) < 1e-6);
  assert.equal(t[1].noSurface, true, 'a flat has no collider to meet'); assert.equal(t[0].noSurface, undefined, 'the parked wagon has its box');
  assert.ok(t.every((x) => x.yields === undefined), 'PR-WAGON1: my own team never yields the ray - it is mine, and solid');
  assert.deepEqual(pool.hoverName(KEY_WAGON), { title: 'Wagon' }); assert.deepEqual(pool.hoverName(KEY_HORSE), { title: 'Bess' });
  assert.equal(pool.hoverName(3), null); assert.equal(pool.hoverName('camp:1'), null);
  assert.equal(pool.activate(KEY_WAGON, 2), true); assert.deepEqual(rt.calls.at(-1), ['wagon', 2]);
  assert.equal(pool.activate(KEY_HORSE, 1), true); assert.deepEqual(rt.calls.at(-1), ['horse', 1]);
  pool.attach(fakeRuntime({ moving: moving(), teamFollowing: true }));
  assert.deepEqual(pool.targets().map((x) => x.key), [KEY_FOLLOWING_WAGON]);
  assert.equal(pool.targets()[0].noSurface, true);
  assert.equal(pool.targets()[0].yields, undefined, 'AUDIT BRANCH-0925 P1: my FOLLOWING team holds the ray too - it is mine');
  pool.attach(fakeRuntime({ moving: { ...moving(), interaction: false }, teamFollowing: true }));
  assert.equal(pool.targets().length, 0, 'the trailing wagon without its trigger box is not a target');
  assert.deepEqual(pool.hoverName(KEY_FOLLOWING_WAGON), { title: 'Wagon' });
});

test('HCC pool: the parked wagon stands a collider box under its pose, re-stands when the pose moves, and goes with the wagon; the probes skip it', async () => {
  const col = fakeCollider();
  const pool = createHorseCartPool({ renderer: fakeRenderer(), meshes: fakeMeshes(), collider: () => col, now: () => 0 });
  const view = { deployed: deployed([10, 0, 10]) };
  pool.attach(fakeRuntime(view));
  pool.frame(1 / 30, [0, 0, 0]);
  assert.equal(col.buckets.has(WAGON_BUCKET), false, 'the parts are still building');
  await flush();
  pool.attach(fakeRuntime(view));
  pool.frame(1 / 30, [0, 0, 0]);
  assert.ok(col.buckets.has(WAGON_BUCKET));
  assert.equal(col.buckets.get(WAGON_BUCKET).p.length, 24);
  assert.ok(Math.abs(col.buckets.get(WAGON_BUCKET).m[12] - 10) < 1e-6);
  const first = col.buckets.get(WAGON_BUCKET);
  pool.frame(1 / 30, [0, 0, 0]);
  assert.equal(col.buckets.get(WAGON_BUCKET), first, 'the same pose: not re-stood');
  view.deployed = deployed([12, 0, 10]);
  pool.frame(1 / 30, [0, 0, 0]);
  assert.notEqual(col.buckets.get(WAGON_BUCKET), first, 'a moved pose re-stands');
  pool.offsetAll([1, 0, 0]);
  pool.frame(1 / 30, [0, 0, 0]);
  assert.ok(col.buckets.has(WAGON_BUCKET), 'stood again after the origin moved');
  view.deployed = null;
  pool.frame(1 / 30, [0, 0, 0]);
  assert.equal(col.buckets.has(WAGON_BUCKET), false, 'the wagon gone, the box gone');
  assert.equal(pool.phys.sphereCastClear([0, 0, 0], 0.35, [1, 0, 0], 1), true, 'the sphere cast skips the wagon\'s bucket');
  assert.equal(pool.phys.raycastAll([0, 10, 0], [0, -1, 0], 40).length, 2);
  assert.deepEqual(pool.phys.threats(), []);
});

test('HCC pool: the mod\'s Enabled switch off draws nothing, answers no ray, rides no wire', async () => {
  const renderer = fakeRenderer(), col = fakeCollider();
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: () => col, now: () => 0 });
  pool.presentation.wagonParts(); await flush();
  const rt = fakeRuntime({ deployed: deployed(), horse: horse() });
  pool.attach(rt);
  pool.frame(1 / 30, [0, 0, 0]);
  assert.ok(col.buckets.has(WAGON_BUCKET));
  pool.setEnabled(false);
  assert.equal(pool.enabled, false);
  assert.equal(col.buckets.has(WAGON_BUCKET), false);
  assert.equal(pool.targets().length, 0); assert.equal(pool.draw(renderer), 0); assert.equal(pool.wireRecord(), null);
  const n = rt.calls.length;
  pool.frame(1 / 30, [0, 0, 0]);
  assert.equal(rt.calls.length, n, 'the runtime is not ticked');
  pool.setEnabled(true);
  pool.frame(1 / 30, [0, 0, 0]);
  assert.ok(col.buckets.has(WAGON_BUCKET));
});

test('HCC-ONLINE wire: my word says the wagon shown and the horse shown, rounded, and only when something stands', () => {
  assert.equal(hccWireRecord(null), null);
  assert.equal(hccWireRecord({ wagon: null, horse: null, name: 'Bess' }), null, 'a name alone is nothing');
  const toWire = (p) => [p[0] * 40 + 100000, p[1] - 3, p[2] * 40 + 200000];
  const r = hccWireRecord({ wagon: { kind: HCC_WIRE_KIND.Deployed, position: [1.2345, 1.001, 2], rotation: [0, 0.70710678, 0, 0.70710678], tier: 50, angle: 12.345 }, horse: { position: [5, 0, 6], forward: [0.6, 0, 0.8], frame: 3, walking: true }, name: '  Bess ' }, toWire);
  assert.deepEqual(r.w, [2, 100049.38, -2, 200080, 0, 0.7071, 0, 0.7071, 50, 12.35]);
  assert.deepEqual(r.h, [100200, -3, 200240, 0.6, 0.8, 1], 'AUDIT HCC O5: the walk frame does not ride - only whether it walks');
  assert.equal(r.n, 'Bess');
  assert.equal(hccWireRecord({ wagon: null, horse: { position: [0, 0, 0], forward: [0, 0, 1], frame: 0, walking: false } }).n, undefined);
  assert.notEqual(hccRecordKey(r), hccRecordKey({ ...r, h: [...r.h.slice(0, 5), 0] }), 'the walking bit changed is a changed word');
  const idle = (frame) => hccRecordKey(hccWireRecord({ wagon: null, horse: { position: [1, 0, 1], forward: [0, 0, 1], frame, walking: false } }));
  assert.equal(idle(5), idle(6), 'AUDIT HCC O5: a standing horse\'s idle flicker (frames 5 and 6 at 2 fps) is not a word');
  assert.equal(hccWireRecord({ wagon: null, horse: { position: [0, 0, 0], forward: [0, 0, 1], walking: false }, name: 'Be\u202Ess\nie' }).n, 'Bessie', 'AUDIT HCC O4: the label door - printable ASCII only');
  assert.equal(hccRecordKey(null), '');
});

test('HCC-ONLINE wire: a peer\'s word through the door - shape, bounds, a unit quaternion, a known kind and tier, a frame the walk has, a bounded name', () => {
  const good = { w: [2, 100, 1, 200, 0, 0, 0, 1, 50, 30], h: [5, 0, 6, 3, 4, 1], n: 'Bess' };
  const v = validHccRecord(good);
  assert.deepEqual(v.w.position, [100, 1, 200]); assert.equal(v.w.kind, 2); assert.equal(v.w.tier, 50); assert.equal(v.w.angle, 30);
  assert.deepEqual(v.h.forward, [0.6, 0, 0.8], 'the forward is normalised'); assert.equal(v.h.walking, true); assert.equal(v.n, 'Bess');
  assert.equal(validHccRecord(null), null); assert.equal(validHccRecord([]), null); assert.equal(validHccRecord({}), null, 'neither a wagon nor a horse');
  assert.equal(validHccRecord({ w: [9, 100, 1, 200, 0, 0, 0, 1, 50, 30] }), null, 'an unknown kind');
  assert.equal(validHccRecord({ w: [2, 100, 1, 200, 0, 0, 0, 1, 51, 30] }), null, 'an unknown tier');
  assert.equal(validHccRecord({ w: [2, 100, 1, 200, 0, 0, 0, 0, 50, 30] }), null, 'a zero quaternion');
  assert.equal(validHccRecord({ w: [2, 1e9, 1, 200, 0, 0, 0, 1, 50, 30] }), null, 'out of the world');
  assert.equal(validHccRecord({ w: [2, 100, 1, 200, 0, 0, 0, 1, 50] }), null, 'too short');
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 0, 1] }), null, 'no forward');
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 1, 3, 1] }), null, 'AUDIT HCC O5: the old seven-word horse (a frame riding) is not the word');
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 1, 2] }), null, 'walking is a bit');
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 1, 1], n: 'x'.repeat(200) }), null, 'a name past any bound');
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 1, 1], n: 42 }), null);
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 1, 1], n: 'x'.repeat(40) }).n.length, 31, 'a long one is the mod\'s 31');
  // AUDIT HCC O4: a crafted name is cleaned, never shown raw - no bidi override, no second plaque line, no zero-width
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 1, 1], n: '\u202Eevil\nline\u200B' }).n, 'evilline');
  assert.equal(validHccRecord({ h: [5, 0, 6, 0, 1, 1], n: '\u0000\u0007' }).n, '', 'nothing printable: the horse goes unnamed, not unseen');
  const q = validHccRecord({ w: [1, 0, 0, 0, 0, 1.5, 0, 0, 0, 725] });
  assert.deepEqual(q.w.rotation, [0, 1, 0, 0], 'renormalised'); assert.equal(q.w.angle, 5, 'the angle wrapped');
  assert.equal(validHccRecord({ w: [1, 0, 0, 0, 0, 3, 0, 0, 0, 0] }), null, 'a quaternion twice too long is junk, not a rounding');
});

test('HCC-ONLINE wire: the ease - a step under twenty metres eases, a longer one snaps; a peer\'s word stands, moves, and goes', async () => {
  assert.deepEqual(easeToward(null, [1, 2, 3], 0.1), [1, 2, 3]);
  assert.deepEqual(easeToward([0, 0, 0], [30, 0, 0], 0.1), [30, 0, 0], 'a teleport');
  const e = easeToward([0, 0, 0], [10, 0, 0], 1 / 12);
  assert.ok(e[0] > 5 && e[0] < 7, `most of the way in a twelfth of a second: ${e[0]}`);
  assert.deepEqual(easeToward([0, 0, 0], [10, 0, 0], 0), [0, 0, 0]);
  const renderer = fakeRenderer();
  const names = { p1: 'Ann' };
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: () => fakeCollider(), now: () => 0, fetchFn: fetchOk, decode, selfId: () => 'me', peerName: (id) => names[id] ?? null });
  await flush();
  pool.attach(fakeRuntime());
  const toScene = (p) => [(p[0] - 100000) / 40, p[1] + 3, (p[2] - 200000) / 40];
  assert.equal(pool.applyOwner('me', { h: [100200, -3, 200240, 0, 1, 1] }, toScene, 1), false, 'my own word is not a peer\'s');
  assert.equal(pool.applyOwner('p1', { w: [2, 100400, -3, 200400, 0, 0, 0, 1, 25, 0], h: [100200, -3, 200240, 0, 1, 1], n: 'Bess' }, toScene, 1), true);
  assert.equal(pool.peers.size, 1);
  const p = pool.peers.get('p1');
  assert.deepEqual(p.horse.position, [5, 0, 6]); assert.deepEqual(p.wagon.position, [10, 0, 10]); assert.equal(p.name, 'Bess');
  await flush(12);
  pool.frame(1 / 30, [5, 1, 20]);
  assert.equal(pool.batches().length, 1, 'the peer\'s horse is a batch');
  assert.equal(pool.draw(renderer), 1, 'and the peer\'s wagon is drawn');
  const t = pool.targets();
  assert.deepEqual(t.map((x) => x.key), ['hccPeer:p1:w', 'hccPeer:p1:h']);
  // HCC-TIP: the plaque names the thing as the mod does, and its second row says whose it is
  assert.deepEqual(pool.hoverName('hccPeer:p1:w'), { title: 'Wagon', subs: ['Owned by Ann'] });
  assert.deepEqual(pool.hoverName('hccPeer:p1:h'), { title: 'Bess', subs: ['Owned by Ann'] });
  const said = [];
  assert.equal(pool.activate('hccPeer:p1:h', 1, (l) => said.push(l)), true); assert.equal(said[0], 'Bess - owned by Ann.');
  let far = 0;
  assert.equal(pool.activate('hccPeer:p1:h', ACTIVATION_REACH + 1, (l) => said.push(l), () => far++), true, 'AUDIT HCC O6: a far press is still the press');
  assert.equal(far, 1); assert.equal(said.length, 1, 'past the mod\'s reach: DFU\'s "too far", not the name');
  assert.equal(pool.activate('hccPeer:zz:h', 1, (l) => said.push(l)), false);
  assert.equal(pool.applyOwner('p1', { h: [100200, -3, 200240, 0, 1, 1] }, toScene, 2), true);
  assert.equal(pool.peers.get('p1').wagon, null, 'the wagon left the word: gone');
  assert.deepEqual(pool.hoverName('hccPeer:p1:h'), { title: 'Horse', subs: ['Owned by Ann'] }, 'and the name with it (HorseTargetLabel\'s "Horse")');
  assert.equal(pool.applyOwner('p1', { h: [100200, -3, 200240, 0, 1, 99] }, toScene, 3), false, 'a junk word drops theirs');
  assert.equal(pool.peers.size, 0);
  pool.applyOwner('p1', { h: [100200, -3, 200240, 0, 1, 1] }, toScene, 4);
  assert.equal(pool.applyOwner('p1', null, toScene, 5), true, 'null: none stand');
  assert.equal(pool.peers.size, 0);
  pool.applyOwner('p1', { h: [100200, -3, 200240, 0, 1, 1] }, toScene, 6);
  pool.applyOwner('p2', { h: [100200, -3, 200240, 0, 1, 1] }, toScene, 6);
  pool.sweepOwners(new Set(['p1']), 7, 100);
  assert.deepEqual([...pool.peers.keys()], ['p1'], 'an owner gone from the room is swept');
  pool.sweepOwners(new Set(['p1']), 1000, 100);
  assert.equal(pool.peers.size, 0, 'and one quiet past the stale time');
  pool.applyOwner('p1', { h: [100200, -3, 200240, 0, 1, 1] }, toScene, 6);
  pool.clearPeers(); assert.equal(pool.peers.size, 0);
});

test('AUDIT HCC O1/O3/O7/O8/O9: a peer\'s team is converted every frame, stands no box and yields the ray (O3, reversed by PR-WAGON1), goes when my switch goes, never loads for a disabled viewer, and is not named unseen', async () => {
  const renderer = fakeRenderer();
  const col = fakeCollider();
  let ox = 100000;   // the host's origin: the conversion reads it LIVE, as campToScene does
  const toScene = (p) => [(p[0] - ox) / 40, p[1] + 3, (p[2] - 200000) / 40];
  let changed = 0;
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: () => col, now: () => 0, fetchFn: fetchOk, decode, selfId: () => 'me', peerName: () => 'Ann', onChanged: () => changed++ });
  pool.attach(fakeRuntime({ horse: horse([1, 0, 1], [0, 0, 1], 5, false) }));
  // O9: the word lands before the art: the horse is neither drawn nor named nor pressed
  pool.applyOwner('p1', { w: [HCC_WIRE_KIND.Deployed, 100400, -3, 200400, 0, 0, 0, 1, 25, 0], h: [100200, -3, 200240, 0, 1, 0] }, toScene, 1);
  pool.frame(1 / 30, [0, 1, 0]);
  assert.ok(!pool.targets().some((t) => t.key === 'hccPeer:p1:h'), 'O9: a horse not drawn is not a target');
  await flush(12);
  pool.frame(1 / 30, [0, 1, 0]);
  assert.ok(pool.targets().some((t) => t.key === 'hccPeer:p1:h'), 'and it is, once its art stands');
  // O3, reversed by PR-WAGON1 (Mac: "Others' wagons don't block"): a peer's parked wagon stands no box in my collider,
  // has no surface for the ray to meet, and - with its horse - yields the ray to anything behind it
  assert.deepEqual([...col.buckets.keys()], [], 'PR-WAGON1: another player\'s parked wagon is no wall');
  const pw = pool.targets().find((t) => t.key === 'hccPeer:p1:w');
  assert.equal(pw.noSurface, true, 'PR-WAGON1: no box, no surface'); assert.equal(pw.yields, true);
  assert.equal(pool.targets().find((t) => t.key === 'hccPeer:p1:h').yields, true, 'PR-WAGON1: nor their horse');
  // O1: my floating origin moves (the pool shifts what it shows; the host's conversion now answers the new frame) -
  // the team stays where it stands in the WORLD, with no snap back to a stale scene point
  const before = [...pool.peers.get('p1').shownHorse];
  ox += 819.2 * 40;
  pool.offsetAll([-819.2, 0, 0]);
  pool.frame(1 / 30, [0, 1, 0]);
  const after = pool.peers.get('p1').shownHorse;
  assert.ok(Math.abs(after[0] - (before[0] - 819.2)) < 1e-6 && after[2] === before[2], `O1: shifted with the world, not snapped: ${after}`);
  assert.deepEqual(pool.peers.get('p1').horse.position, toScene([100200, -3, 200240]));
  // and a re-anchor with NO offset (a fast travel's state.init) is answered by the same conversion
  ox += 5000 * 40;
  pool.frame(1 / 30, [0, 1, 0]);
  assert.deepEqual(pool.peers.get('p1').shownHorse, toScene([100200, -3, 200240]), 'O1: past the snap, the new frame\'s point');
  // PR-WAGON1: the wagon rolling on (Following) yields as the parked one did, and parked again it is still no wall;
  // the owner leaves - nothing of theirs stands
  pool.applyOwner('p1', { w: [HCC_WIRE_KIND.Following, 100400, -3, 200400, 0, 0, 0, 1, 25, 0] }, toScene, 2);
  pool.frame(1 / 30, [0, 1, 0]);
  assert.equal(pool.targets().find((t) => t.key === 'hccPeer:p1:w').yields, true, 'PR-WAGON1: a moving team yields');
  pool.applyOwner('p1', { w: [HCC_WIRE_KIND.Deployed, 100400, -3, 200400, 0, 0, 0, 1, 25, 0] }, toScene, 3);
  pool.frame(1 / 30, [0, 1, 0]);
  assert.deepEqual([...col.buckets.keys()], [], 'PR-WAGON1: parked again, still no wall');
  pool.sweepOwners(new Set(), 4);
  assert.equal(pool.peers.size, 0, 'a swept owner takes their team');
  // O7: my switch turned off is a word now, not at my next full frame
  const n = changed;
  pool.setEnabled(false);
  assert.equal(changed, n + 1, 'O7: the peers are told');
  pool.setEnabled(false);
  assert.equal(changed, n + 1, 'once');
  // O8: a disabled viewer stands and loads nothing of a peer's
  assert.equal(pool.applyOwner('p2', { h: [100200, -3, 200240, 0, 1, 0] }, toScene, 5), false);
  assert.equal(pool.peers.size, 0);
});

test('AUDIT HCC O2: the foes pool\'s teardown (a fast travel\'s clearLive) takes the peers\' teams, as clearPuppets does', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('  function destroy() {'), src.indexOf('  /** AUDIT 17e F23'));
  assert.match(body, /_owners\.clear\(\); _pupPending\.clear\(\); _pupIndex\.clear\(\);[^\n]*\n\s*_onHccClear\?\.\(\);/);
});

test('AUDIT HCC O5: the change key is the WIRE\'s - my own floating-origin rebase moves every scene point and is not a word; a real move is', () => {
  let ox = 0;   // the host's origin, as campToWire reads it live
  let changed = 0;
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, now: () => 0, onChanged: () => changed++, toWire: (p) => [p[0] + ox, p[1], p[2]] });
  const h = horse([5, 0, 5], [0, 0, 1], 5, false);
  pool.attach(fakeRuntime({ horse: h }));
  pool.frame(1 / 30, [0, 1, 0]);
  const n = changed;
  // the recentre: every scene point shifts by -819.2 and the origin by +819.2 - the WIRE point stands still
  h.position = [h.position[0] - 819.2, 0, 5]; ox += 819.2;
  pool.frame(1 / 30, [0, 1, 0]);
  assert.equal(changed, n, 'mutant: the key in the scene frame - every recentre a word to the whole cell');
  h.position = [h.position[0] + 1, 0, 5];
  pool.frame(1 / 30, [0, 1, 0]);
  assert.equal(changed, n + 1, 'the horse stepping is');
});
