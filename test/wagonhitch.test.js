// WAGON-HITCH (2026-10-04, Mac: "the wagon when attached to the horse should show in the overworld if attached and
// currently it sort of rubberbands and doesn't attach to the horse properly"): THE WAGON ON ITS SHAFTS, PINNED BY
// EXECUTION. The mod laid the moving wagon on a trail point and eased it there at 12 per second, so the gap to the
// rider stretched with speed and frame time and sprang back on every stop (measured before the change: 2.5 m standing,
// 3.07 m at the cart's 7.6 m/s, 3.031 / 3.038 on alternating frames; a following team's swung to 0.8 m off its horse
// as it set off). The pins below hold the gap to HITCHED_HORSE_LOCAL_Z at every frame, the drive-off from where the
// wagon stood, the dismount that stands the horse where the rider sat, the height and tilt still eased, the grown draw
// under the Overworld (OW-BIG) and another player's cart wagon held to their rider as drawn here. Mutants:
// tools/mutants/wagonhitch.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld } from './hccWorld.mjs';
import { syntheticWagon41214 } from './hccModel.mjs';
import { TRANSPORT, WAGON_MODE, HORSE_MODE, HITCHED_HORSE_LOCAL_Z, NORMAL_GROUND_OFFSET, WAGON_MODEL_ID, TELEPORT_DISTANCE } from '../src/systems/horseCartLaw.js';
import { hitchedPoseStep, hitchAxle, WagonHitch, hitchJumpReach, HITCH_JUMP_SPEED } from '../src/systems/horseFollow.js';
import { createHorseCartPool, grownHitchedPosition, grownWheelStep } from '../src/scenes/horseCartPool.js';
import { rigGrowOf } from '../src/world/wagonModels.js';   // WAGONS3: a driven rig's grow under the Overworld
import { HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';
import { quatForward, quatRotate, quatLookRotation, UNITY_QUAT_IDENTITY } from '../src/world/quat.js';

const L = HITCHED_HORSE_LOCAL_Z;
const hgap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const flat = (y = 0, normal = [0, 1, 0]) => ({ raycastAll: (o, d, max) => (d[1] < 0 && o[1] >= y && o[1] - y <= max ? [{ point: [o[0], y, o[2]], distance: o[1] - y, normal }] : []) });
const freshPose = () => ({ position: [0, 0, 0], rotation: [...UNITY_QUAT_IDENTITY], active: false, lastValidPosition: [0, 0, 0], lastValidRotation: [...UNITY_QUAT_IDENTITY], hasLastValid: false, up: [0, 1, 0], hitch: null });

test('WAGON-HITCH: riding the cart, the wagon hangs HITCHED_HORSE_LOCAL_Z behind the rider at every frame - at speed, on uneven frames, stopping and through a turn (the rubber band: 2.5 m standing, 3.07 m at 7.6 m/s) (mutant: the horizontal eased again)', () => {
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  assert.equal(w.mode, TRANSPORT.Cart);
  const gaps = [];
  const pose = () => rt.view().moving.pose;
  const frame = (dt) => { w.now += dt; rt.lateUpdate(dt); gaps.push(hgap(pose().position, w.pos)); };
  for (let i = 0; i < 120; i++) { const dt = i % 2 ? 1 / 30 : 1 / 90; w.pos[2] += 7.6 * dt; frame(dt); }   // the ride, on frames that will not keep time
  for (let i = 0; i < 30; i++) frame(1 / 60);   // the stop
  w.yaw = Math.PI / 2;
  for (let i = 0; i < 90; i++) { w.pos[0] += 7.6 / 60; frame(1 / 60); }   // a hard turn onto +x
  for (const g of gaps) assert.ok(Math.abs(g - L) < 1e-9, `the gap held at ${L}: ${g}`);
  // after the turn it stands behind the rider on the new line, facing the rider
  const p = pose();
  assert.ok(w.pos[0] - p.position[0] > L * 0.99, `behind on the new line: rider ${w.pos}, wagon ${p.position}`);
  const f = quatForward(p.rotation);
  const toRider = [w.pos[0] - p.position[0], 0, w.pos[2] - p.position[2]];
  assert.ok(Math.abs(Math.atan2(f[0], f[2]) - Math.atan2(toRider[0], toRider[2])) < 1e-6, 'the shafts point at the rider');
  assert.ok(Math.abs(p.position[1] - NORMAL_GROUND_OFFSET) < 1e-9, 'a metre over the flat ground, as the mod stands it');
});

test('WAGON-HITCH: a following team keeps its wagon HITCHED_HORSE_LOCAL_Z off the horse from the first step - it no longer swings onto the horse as the team sets off (measured before: 0.8 m), nor stretches with the horse\'s pace', () => {
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 60; i++) { w.pos[2] += 0.1; step(); }
  w.mode = TRANSPORT.Foot; step(3);
  w.activateMode = 'dialogue'; rt.handleStationaryHorseActivation(1); step();
  assert.equal(rt.view().teamFollowing, true);
  let n = 0;
  for (let i = 0; i < 300; i++) {
    w.pos[2] += 6 / 30; step();
    const v = rt.view();
    if (!v.moving?.pose.active || !v.horse) continue;
    n++;
    assert.ok(Math.abs(hgap(v.moving.pose.position, v.horse.position) - L) < 1e-9, `frame ${i}: ${hgap(v.moving.pose.position, v.horse.position)}`);
  }
  assert.ok(n > 250, `the team was drawn: ${n}`);
});

test('WAGON-HITCH: mounting a parked team drives the wagon off from where it stood - not re-laid behind the camera (mutant: the drive-off seed dropped)', () => {
  const { w, rt, step, state, scene } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 60; i++) { w.pos[2] += 0.1; step(); }
  w.mode = TRANSPORT.Foot; step(3);
  assert.equal(state().Mode, WAGON_MODE.Deployed); assert.equal(state().HorseMode, HORSE_MODE.HitchedToWagon);
  const parked = scene(state().WorldX, state().WorldZ);
  // walk round to its right-hand side, still facing +z: behind the camera is a spot the wagon never stood on
  w.pos = [parked[0] + 2, 0.9, parked[2] + 1.5]; w.yaw = 0; step(2);
  assert.equal(rt.tryUseTransport(TRANSPORT.Cart).succeeded, true);
  step();
  const p = rt.view().moving.pose.position;
  assert.ok(Math.abs(hgap(p, w.pos) - L) < 1e-9, 'on its shafts');
  assert.ok(hgap(p, parked) < 1, `swung from where it was parked: wagon ${p}, parked ${parked}`);
});

test('WAGON-HITCH: a dismount parks the wagon where it hung, and the hitched horse comes to stand where the rider sat', () => {
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 90; i++) { w.pos[2] += 0.08; w.pos[0] += 0.03; step(); }
  const rider = [...w.pos];
  w.mode = TRANSPORT.Foot; step(3);
  const h = rt.view().horse;
  assert.ok(h?.isInteractive, 'the hitched horse stands');
  assert.ok(hgap(h.position, rider) < 0.05, `the horse where the rider sat: horse ${h.position}, rider ${rider}`);
});

test('WAGON-HITCH: hitchedPoseStep - hidden until it first grounds; kept on its shafts at its last height where the ground is not built; height and tilt eased, facing exact (mutants: the height snapped, the tilt snapped)', () => {
  const hitch = [0, 1, 0];
  let w = hitchedPoseStep({ raycastAll: () => [] }, freshPose(), hitch, [0, 0, 1], L, 1 / 30);
  assert.equal(w.active, false, 'never grounded: not shown (the mod\'s SetActive(false))');
  w = hitchedPoseStep(flat(0), freshPose(), hitch, [0, 0, 1], L, 1 / 30);
  assert.equal(w.active, true);
  assert.deepEqual(w.position.map((v) => +v.toFixed(9)), [0, NORMAL_GROUND_OFFSET, -L], 'laid behind the facing, a metre up');
  assert.deepEqual(w.hitch, hitch);
  // the rider moves on over ground not yet built: still on its shafts, at the height it had
  const lost = hitchedPoseStep({ raycastAll: () => [] }, w, [4, 1, 0], [1, 0, 0], L, 1 / 30);
  assert.equal(lost.active, true);
  assert.ok(Math.abs(hgap(lost.position, [4, 1, 0]) - L) < 1e-9 && lost.position[1] === w.position[1], `kept on its shafts: ${lost.position}`);
  // a step up of a metre under a slope: the height and the tilt ease, the facing does not
  const n = [0, Math.cos(0.3), Math.sin(0.3)];
  const up1 = hitchedPoseStep(flat(1, n), w, [0, 2, 0], [0, 0, 1], L, 1 / 30);
  const posT = 1 - Math.exp(-12 / 30), rotT = 1 - Math.exp(-10 / 30);
  const target = 1 + n[1] * NORMAL_GROUND_OFFSET;   // the slope's ground a metre up its normal
  assert.ok(Math.abs(up1.position[1] - (w.position[1] + (target - w.position[1]) * posT)) < 1e-9, `the height eased by the mod's 12 per second: ${up1.position[1]}`);
  assert.ok(Math.abs(up1.up[2] - rotT * n[2] / Math.hypot(rotT * n[2], 1 - rotT + rotT * n[1])) < 1e-9, `the tilt eased by the mod's 10 per second: ${up1.up}`);
  const f = quatForward(up1.rotation);
  assert.ok(Math.abs(f[0]) < 1e-9 && f[2] > 0, 'still facing the hitch exactly');
  const d = f[0] * up1.up[0] + f[1] * up1.up[1] + f[2] * up1.up[2];
  assert.ok(Math.abs(d) < 1e-9 && Math.abs(f[1]) > 1e-3, `laid along the ground's plane - pitched with it (AUDIT D H12): ${f}`);
});

test('WAGON-HITCH: hitchAxle is the trailer law - the axle on the line from where it was, the length from the hitch; WagonHitch reads a jump past the mod\'s 20 m', () => {
  const a = hitchAxle([0, 0, -10], [3, 5, 0], 2, [1, 0, 0]);
  const d = Math.hypot(3, 10);
  assert.ok(Math.abs(a.axle[0] - (3 - 2 * 3 / d)) < 1e-12 && Math.abs(a.axle[2] - (0 - 2 * 10 / d)) < 1e-12 && a.axle[1] === 5);
  assert.deepEqual(hitchAxle([3, 0, 0], [3, 5, 0], 2, [1, 0, 0]).axle, [1, 5, 0], 'on top of its hitch: behind the facing');
  const j = new WagonHitch();
  assert.equal(j.observe([0, 0, 0]), true, 'nothing observed yet');
  assert.equal(j.observe([0, 0, 19.9]), false);
  assert.equal(j.observe([0, 0, 40]), true, 'a 20.1 m leap');
  j.offset([5, 0, 0]); assert.deepEqual(j.last, [5, 0, 40]);
});

test('WAGON-HITCH x OW-BIG: grownHitchedPosition - the axle g times as far from the hitch on its line, the wheels on the ground found there (mutant: grown about the wagon, not the hitch)', () => {
  const pos = [0, 1, -L], hitch = [0, 1.3, 0];
  assert.equal(grownHitchedPosition(pos, hitch, 1, () => 0), pos, 'off the view: the wagon as it is');
  assert.equal(grownHitchedPosition(pos, null, 8, () => 0), pos, 'no hitch: never grown');
  const asked = [];
  const g8 = grownHitchedPosition(pos, hitch, 8, (q) => { asked.push(q); return 2; });
  assert.deepEqual(g8, [0, 2 + NORMAL_GROUND_OFFSET * 8, -L * 8]);
  assert.deepEqual(asked, [[0, 1.3, -L * 8]], 'the ground sought under the grown axle, near the hitch\'s height');
  assert.deepEqual(grownHitchedPosition(pos, hitch, 8, () => null), [0, 1 - NORMAL_GROUND_OFFSET + NORMAL_GROUND_OFFSET * 8, -L * 8], 'no ground there: the height it had');
});

// ── the pool: a fake renderer and mesh pipeline (test/hcc_pool.test.js's shape)
function fakeRenderer() {
  const r = { draws: [] };
  r.createMesh = (model) => ({ model });
  r.drawMesh = (gpu, m, remap, o) => r.draws.push({ gpu, m: [...m], o });
  r.uploadTexture = () => 'k'; r.createBillboardBatch = () => ({ origin: null }); r.destroyBillboardBatch = () => {};
  return r;
}
function fakeMeshes() {
  const gpu = { [WAGON_MODEL_ID]: { id: WAGON_MODEL_ID } };
  for (const d of CARGO_DEFINITIONS) gpu[d.modelId] = { id: d.modelId };
  return { getGpuMesh: async (id) => gpu[id] ?? null, cpuModels: new Map([[WAGON_MODEL_ID, syntheticWagon41214()]]) };
}
const floorCollider = () => ({ surfaceHit: (o, d, max) => (d[1] < 0 && o[1] > 0 && o[1] <= max ? { dist: o[1], key: null, normal: [0, 1, 0] } : { dist: Infinity }) });
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
const scaleOf = (m) => Math.hypot(m[0], m[1], m[2]);
const runtimeShowing = (view) => ({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }), lateUpdate() {}, horseTargetLabel: '' });

test('WAGON-HITCH x OW-BIG: under the Overworld my cart\'s wagon is drawn grown with the traveller about its hitch, casting no shadow; a following team and a parked wagon stay their size (mutants: grown off the drawn position, the shadow cast)', async () => {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0 });
  const pose = hitchedPoseStep(flat(0), freshPose(), [0, 1.3, 0], [0, 0, 1], L, 1 / 30);   // the producer's own pose (its hitch and axle)
  assert.deepEqual(pose.axle.map((v) => +v.toFixed(9)), [0, 0, -L]);
  const rt = runtimeShowing({ moving: { pose, wheel: { angle: 0 }, cargoTier: 0, interaction: false } });
  pool.attach(rt); pool.frame(1 / 30, [0, 2, 5]); await flush();
  renderer.draws.length = 0; pool.draw(renderer);
  assert.ok(Math.abs(scaleOf(renderer.draws[0].m) - 1) < 1e-9, 'off the view: its own size');
  renderer.draws.length = 0; pool.draw(renderer, null, { selfGrow: 8, grow: () => 99 });
  const body = renderer.draws[0].m;
  // PIN MOVED (WAGONS3, Mac: "All the wagons/carts are oversized in the overworld"): grown by the rig's own law off the
  // traveller's step - a rig read as long as a rider on horseback (world/wagonModels.js rigGrowOf), the classic wagon's
  // hitch its length - not the traveller's eight
  const g = rigGrowOf(8, 'cart', L);
  assert.ok(g > 1 && g < 8, `grown, less than the traveller: ${g}`);
  assert.ok(Math.abs(scaleOf(body) - g) < 1e-5, 'grown with the traveller\'s own step, never the peers\' law');
  const at = [body[12], body[13], body[14]], want = [0, NORMAL_GROUND_OFFSET * g, -L * g];
  assert.ok(at.every((v, i) => Math.abs(v - want[i]) < 1e-5), `its axle g hitch-lengths back, its wheels on the ground: ${at}`);   // the matrix is Float32
  assert.ok(renderer.draws.length > 1 && renderer.draws.every((d) => d.o?.noShadow === true), 'no grown piece casts a giant\'s shadow (AUDIT B2)');
  renderer.draws.length = 0; pool.draw(renderer);
  assert.ok(renderer.draws.every((d) => !d.o?.noShadow), 'at its own size it casts as a wagon does');
  const following = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0 });
  following.attach(runtimeShowing({ teamFollowing: true, moving: { pose, wheel: { angle: 0 }, cargoTier: 0, interaction: true } }));
  following.frame(1 / 30, [0, 2, 5]); await flush();
  renderer.draws.length = 0; following.draw(renderer, null, { selfGrow: 8 });
  assert.ok(Math.abs(scaleOf(renderer.draws[0].m) - 1) < 1e-9, 'a following team\'s wagon beside its own-size horse is not grown');
  const parked = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0 });
  parked.attach(runtimeShowing({ deployed: { isGrounded: true, position: [5, 1, 5], rotation: [...UNITY_QUAT_IDENTITY], cargoTier: 0 } }));
  parked.frame(1 / 30, [0, 2, 5]); await flush();
  renderer.draws.length = 0; parked.draw(renderer, null, { selfGrow: 8 });
  assert.ok(renderer.draws.length && Math.abs(scaleOf(renderer.draws[0].m) - 1) < 1e-9, 'nor is a parked wagon - a wagon in the world');
});

test('WAGON-HITCH: another player\'s cart wagon hangs from their rider as drawn here - on its shafts at every frame, where the eased word ran behind; a parked wagon is never pulled (mutant: the anchor ignored)', async () => {
  const renderer = fakeRenderer();
  let anchor = [0, 0, 0];
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0, selfId: () => 'me', peerAnchor: (id) => (id === 'p1' ? anchor : null) });
  pool.attach(runtimeShowing({}));
  const word = (z) => ({ w: [HCC_WIRE_KIND.Trailing, 0, NORMAL_GROUND_OFFSET, z - L, 0, 0, 0, 1, 0, 0] });
  pool.applyOwner('p1', word(0), (p) => p, 1);
  pool.frame(1 / 30, [0, 2, 5]); await flush();   // a peer's wagon starts the parts' build
  for (let i = 0; i < 60; i++) {
    anchor = [0, 0, i * 0.25];   // their rider, drawn moving at 7.5 m/s
    if (i % 6 === 0) pool.applyOwner('p1', word(anchor[2] - 1), (p) => p, i);   // a word that comes late and lags
    pool.frame(1 / 30, [0, 2, 5]);
    const p = pool.peers.get('p1');
    assert.ok(Math.abs(hgap(p.shownWagon, anchor) - L) < 1e-9, `frame ${i}: ${hgap(p.shownWagon, anchor)}`);
    assert.ok(p.shownWagon[2] < anchor[2], 'behind the rider');
  }
  renderer.draws.length = 0; pool.draw(renderer, null, { selfGrow: 8, grow: (q) => (q === pool.peers.get('p1').hitch ? 6 : 1) });
  assert.ok(Math.abs(scaleOf(renderer.draws[0].m) - rigGrowOf(6, 'cart', L)) < 1e-5, 'grown by the OW-PEERS law at their rider - the rig\'s share of it (PIN MOVED, WAGONS3)');
  // a parked wagon with the same anchor is a wagon in the world: the word's own place
  pool.applyOwner('p1', { w: [HCC_WIRE_KIND.Deployed, 40, NORMAL_GROUND_OFFSET, 40, 0, 0, 0, 1, 0, 0] }, (p) => p, 99);
  for (let i = 0; i < 90; i++) pool.frame(1 / 30, [0, 2, 5]);
  const p = pool.peers.get('p1');
  assert.ok(hgap(p.shownWagon, [40, 0, 40]) < 0.01 && p.hitch === null, `parked where its word stands: ${p.shownWagon}`);
});

test('WAGON-HITCH: the world host hands the pool another player\'s cart rider and the Overworld\'s two grows (THE FOUR HOSTS: exterior.js has no travel view and no peers; worldModes.js and dungeonContext.js draw no wagon)', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /peerAnchor: \(id\) => \{ const sh = _peerMapPoses\.get\(id\); return sh && \(sh\.rd \| 0\) === 2 \? onlineToScene\(sh\) : null; \}/);
  assert.match(world, /hcc\.draw\(renderer, null, tvf \? \{ selfGrow: tvf\.grow, grow: peerGrow \} : undefined\);/);
  for (const host of ['worldModes.js', 'dungeonContext.js']) assert.doesNotMatch(readFileSync(new URL(`../src/scenes/${host}`, import.meta.url), 'utf8'), /hcc\.draw\(/, `${host} draws no wagon`);
});

// ── AUDIT WAGON-HITCH (2026-10-04): the four lenses' findings, each pinned
const sideSlope = (deg) => {
  const t = Math.tan((deg * Math.PI) / 180), n = Math.hypot(t, 1);
  return { raycastAll: (o, d, max) => { const y = -t * o[0]; return d[1] < 0 && o[1] >= y && o[1] - y <= max ? [{ point: [o[0], y, o[2]], distance: o[1] - y, normal: [t / n, 1 / n, 0] }] : []; } };
};
const bearingDeg = (axle, hitch) => (Math.atan2(hitch[0] - axle[0], hitch[2] - axle[2]) * 180) / Math.PI;

test('AUDIT WAGON-HITCH A1: on a side slope the wagon holds its line - the shafts pull from where the WHEELS stand, so the metre up the leaning normal never swings it round its hitch, at any frame rate (the first cut: 75 degrees in two seconds on a 3 degree slope, the rider standing still) (mutant: pulled from the drawn position)', () => {
  // the rider standing still on a 3 degree side slope, ten seconds
  let w = freshPose();
  for (let i = 0; i < 600; i++) w = hitchedPoseStep(sideSlope(3), w, [0, 1.3, 0], [0, 0, 1], L, 1 / 60);
  assert.ok(Math.abs(bearingDeg(w.axle, [0, 1.3, 0])) < 1e-6, `still straight behind: ${bearingDeg(w.axle, [0, 1.3, 0])}`);
  assert.ok(Math.abs(hgap(w.axle, [0, 1.3, 0]) - L) < 1e-9);
  // riding along a 10 degree side slope at 7.6 m/s: the same line at 30, 60 and 144 frames a second
  for (const fps of [30, 60, 144]) {
    let p = freshPose(); const h = [0, 1.3, 0];
    for (let i = 0; i < fps * 10; i++) { h[2] += 7.6 / fps; p = hitchedPoseStep(sideSlope(10), p, h, [0, 0, 1], L, 1 / fps); }
    assert.ok(Math.abs(bearingDeg(p.axle, h)) < 1e-6, `${fps} fps: ${bearingDeg(p.axle, h)}`);
  }
});

test('AUDIT WAGON-HITCH A1: through the runtime on an 8 degree side slope - riding, standing and a dismount that parks the wagon square and stands the horse where the rider sat (mutant: the park read off the drawn position)', () => {
  const { w, rt, step, state, scene } = makeWorld();
  w.slope = 8;
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 90; i++) { w.pos[2] += 7.6 / 30; step(); }
  step(60);   // standing two seconds
  const p = rt.view().moving.pose;
  assert.ok(Math.abs(bearingDeg(p.axle, w.pos)) < 1e-6, `straight behind after the stand: ${bearingDeg(p.axle, w.pos)}`);
  const rider = [...w.pos];
  w.mode = TRANSPORT.Foot; step(3);
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  assert.ok(Math.abs(state().HeadingX) < 1e-6 && state().HeadingZ > 0.999, `parked square to the road: ${state().HeadingX}, ${state().HeadingZ}`);
  const parked = scene(state().WorldX, state().WorldZ);
  assert.ok(Math.abs(parked[0] - rider[0]) < 1e-6, 'parked where its wheels stood, not a lean downhill of them');
  const h = rt.view().horse;
  assert.ok(h?.isInteractive && hgap(h.position, rider) < 0.02, `the horse where the rider sat: ${h?.position} vs ${rider}`);
});

test('AUDIT WAGON-HITCH A3: a Travel Options journey at x100 is no jump - the wagon is not re-laid every frame, its wheels turn; a teleport still re-lays it behind the team (mutants: the flat 20 m, the re-lay kept active)', () => {
  assert.equal(hitchJumpReach(0), TELEPORT_DISTANCE);
  assert.equal(hitchJumpReach(2), TELEPORT_DISTANCE + 2 * HITCH_JUMP_SPEED);
  const j = new WagonHitch();
  j.observe([0, 0, 0]);
  assert.equal(j.observe([0, 0, TELEPORT_DISTANCE], hitchJumpReach(0)), false, 'exactly the reach is no jump');
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  const dt = 100 / 30;   // a 30 fps frame at x100: the host hands the runtime the world's time
  const angles = new Set();
  for (let i = 0; i < 30; i++) {
    w.pos[2] += 7.6 * dt; w.now += 1 / 30; rt.lateUpdate(dt);
    const m = rt.view().moving;
    assert.ok(m.pose.active && Math.abs(hgap(m.pose.axle, w.pos) - L) < 1e-9);
    angles.add(m.wheel.angle.toFixed(3));
  }
  assert.ok(angles.size > 20, `the wheels turn: ${angles.size} angles`);
  // a real leap - 200 m sideways in one ordinary frame, the team facing +z - re-lays it behind the team, not toward
  // where it was
  w.pos[0] += 200; w.now += 1 / 60; rt.lateUpdate(1 / 60);
  const p = rt.view().moving.pose;
  assert.ok(Math.abs(p.axle[0] - w.pos[0]) < 1e-6 && Math.abs(p.axle[2] - (w.pos[2] - L)) < 1e-6, `re-laid behind the facing: ${p.axle} vs ${w.pos}`);
});

test('AUDIT WAGON-HITCH: mounting a FOLLOWING team drives its wagon off from where it stood; a drive-off pending across a recentre moves with the scene (mutants: the following arm dropped, the pending seed not rebased)', () => {
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 60; i++) { w.pos[2] += 0.1; step(); }
  w.mode = TRANSPORT.Foot; step(3);
  w.activateMode = 'dialogue'; rt.handleStationaryHorseActivation(1); step();
  for (let i = 0; i < 90; i++) { w.pos[0] += 0.05; step(); }   // walk off to the side; the team follows
  step(90);
  assert.equal(rt.view().teamFollowing, true);
  const was = [...rt.view().moving.pose.axle];
  // stand beside the wagon, facing away from it, and mount
  w.pos = [was[0] + 1.5, 0.9, was[2] + 1]; w.yaw = Math.PI; step();
  assert.equal(rt.tryUseTransport(TRANSPORT.Cart).succeeded, true);
  rt.rebase([100, 0, 0]); w.pos[0] += 100;   // a recentre before the next frame
  step();
  const now = rt.view().moving.pose.axle;
  assert.ok(hgap(now, [was[0] + 100, 0, was[2]]) < 1.5, `driven off from where it stood (moved with the scene): ${now} vs ${was}`);
});

test('AUDIT WAGON-HITCH M2/B4/B5: another player\'s cart wagon - a leap of their rider starts again from their word; the height is the ground\'s here, eased; the wagon is turned toward the rider; the tilt is eased; the tilt forgotten when the rider is not drawn (mutants: the restart, the height snapped, the word\'s facing, the tilt snapped, the tilt kept)', async () => {
  const renderer = fakeRenderer();
  let anchor = [0, 0, 0], floorY = 0;
  const collider = () => ({ surfaceHit: (o, d, max) => (d[1] < 0 && o[1] > floorY && o[1] - floorY <= max ? { dist: o[1] - floorY, key: null, normal: [0, 1, 0] } : { dist: Infinity }) });
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider, now: () => 0, selfId: () => 'me', peerAnchor: (id) => (id === 'p1' ? anchor : null) });
  pool.attach(runtimeShowing({}));
  const word = (x, z, rot = [0, 0, 0, 1]) => ({ w: [HCC_WIRE_KIND.Trailing, x, NORMAL_GROUND_OFFSET, z, ...rot, 0, 0] });
  pool.applyOwner('p1', word(0, -L), (p) => p, 1);
  for (let i = 0; i < 30; i++) pool.frame(1 / 30, [0, 2, 5]);
  let p = pool.peers.get('p1');
  // turned toward the rider: the rider steps to the side, the word still faces +z
  anchor = [2, 0, 0]; pool.frame(1 / 30, [0, 2, 5]);
  const f = quatForward(p.shownRotation), to = [anchor[0] - p.shownWagon[0], 0, anchor[2] - p.shownWagon[2]];
  assert.ok(Math.abs(Math.atan2(f[0], f[2]) - Math.atan2(to[0], to[2])) < 1e-6, 'facing the rider, not the word');
  // the height: the ground steps up two metres - eased toward it at the mod's 12
  const y0 = p.shownWagon[1];
  floorY = 2; pool.frame(1 / 30, [0, 2, 5]);
  const want = y0 + (2 + NORMAL_GROUND_OFFSET - y0) * (1 - Math.exp(-12 / 30));
  assert.ok(Math.abs(p.shownWagon[1] - want) < 1e-9, `eased toward the ground here: ${p.shownWagon[1]} vs ${want}`);
  // the tilt: a word on a tilted ground eases the wagon's up toward it
  const tilted = quatLookRotation([0, 0, 1], [Math.sin(0.4), Math.cos(0.4), 0]);
  pool.applyOwner('p1', word(2, -L, tilted), (p) => p, 2);
  pool.frame(1 / 30, [0, 2, 5]);
  const wordUp = quatRotate(tilted, [0, 1, 0]);
  assert.ok(p.shownUp[0] > 1e-3 && p.shownUp[0] < wordUp[0] - 1e-3, `the tilt eased: ${p.shownUp[0]} of ${wordUp[0]}`);
  // a leap past 20 m: from the word's place, not from where it was drawn
  anchor = [50, 0, 0];
  pool.applyOwner('p1', word(50, L), (p) => p, 3);
  pool.frame(1 / 30, [0, 2, 5]);
  assert.ok(Math.abs(p.shownWagon[0] - 50) < 1e-6 && Math.abs(p.shownWagon[2] - L) < 1e-6, `started again from the word: ${p.shownWagon}`);
  // the rider not drawn: the tilt is forgotten with the anchor
  anchor = null; pool.frame(1 / 30, [0, 2, 5]);
  p = pool.peers.get('p1');
  assert.equal(p.shownUp, null);
  assert.equal(p.hitch, null);
});

test('AUDIT WAGON-HITCH B1/B7: a grown wagon finds the ground up a hill its own reach tall, and its grown wheels turn slower for the same road (mutants: the probe at the mod\'s fixed height, the wheels at the small wagon\'s pace)', async () => {
  // a 25 degree climb behind a cart going downhill (+z): the ground rises toward -z
  const t = Math.tan((25 * Math.PI) / 180);
  const hill = () => ({ surfaceHit: (o, d, max) => { const y = -t * o[2]; return d[1] < 0 && o[1] > y && o[1] - y <= max ? { dist: o[1] - y, key: null, normal: [0, 1, 0] } : { dist: Infinity }; } });
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: hill, now: () => 0 });
  const pose = hitchedPoseStep({ raycastAll: (o) => [{ point: [o[0], -t * o[2], o[2]], distance: 0, normal: [0, 1, 0] }] }, freshPose(), [0, 1.3, 0], [0, 0, 1], L, 1 / 30);
  pool.attach(runtimeShowing({ moving: { pose, wheel: { angle: 0 }, cargoTier: 0, interaction: false } }));
  pool.frame(1 / 30, [0, 2, 5]); await flush();
  renderer.draws.length = 0; pool.draw(renderer, null, { selfGrow: 12 });
  const m = renderer.draws[0].m;
  const groundThere = -t * m[14];
  assert.ok(Math.abs(m[13] - (groundThere + NORMAL_GROUND_OFFSET * rigGrowOf(12, 'cart', L))) < 1e-3, `on the hill ${groundThere.toFixed(2)} m up, not sunk into it: ${m[13]}`);   // PIN MOVED (WAGONS3): at the rig's grow
  // the wheel clock: the small wagon's wheel turns 80 degrees, the twelve-times wheel a twelfth of it; the step is taken
  // the short way across the wrap
  let s = grownWheelStep(null, 100, 12);
  assert.equal(s.acc, 100);
  s = grownWheelStep(s, 180, 12);
  assert.ok(Math.abs(s.acc - (100 + 80 / 12)) < 1e-9);
  s = grownWheelStep(s, 10, 12);   // 180 -> 10 is -170
  assert.ok(Math.abs(s.acc - (100 + 80 / 12 - 170 / 12)) < 1e-9);
  assert.equal(grownWheelStep({ last: 350, acc: 0 }, 10, 1).acc, 20, 'at its own size the step is the step');
});

test('AUDIT WAGON-HITCH A1 x OW-BIG: on a side slope my grown wagon is grown from where its wheels stand - the drawn position\'s lean downhill is not grown eight times over (mutant: grown off the drawn position)', async () => {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0 });
  const pose = hitchedPoseStep(sideSlope(8), freshPose(), [0, 1.3, 0], [0, 0, 1], L, 1 / 30);
  assert.ok(pose.position[0] > 0.1, `the drawn position leans downhill: ${pose.position[0]}`);
  pool.attach(runtimeShowing({ moving: { pose, wheel: { angle: 0 }, cargoTier: 0, interaction: false } }));
  pool.frame(1 / 30, [0, 2, 5]); await flush();
  renderer.draws.length = 0; pool.draw(renderer, null, { selfGrow: 8 });
  assert.ok(Math.abs(renderer.draws[0].m[12]) < 1e-4, `grown on the axle's line: ${renderer.draws[0].m[12]}`);
});
