// WAGONS2 (2026-10-09, Mac: "6. Real wheel movement"): EACH WHEEL ROLLS ON ITS OWN, AND THE FOUR-WHEELERS STEER,
// pinned by execution. Horse Cart and Cargo turns both wheels of its wagon by one angle off the wagon's travel and
// stands a parked wagon's at 0; Mac's wagons now turn each wheel by its own contact's travel along its own heading over
// its own radius (systems/horseCart.js wheelContacts / rolledAngles), the open wagon's and the caravan's front axle,
// pole and front pair turn on their kingpin (world/wagonModels.js `bogie`, its lock measured off the bake -
// steerLimitOf), they trail as two bars - the kingpin on the pole, the body on the wheelbase (systems/horseFollow.js
// bogieAxle) - a parked wagon keeps its wheels and its steer, another player's are turned here off the pose drawn
// here, and the Overworld's grown wheels keep a clock each. Mutants: tools/mutants/wagons2_wheels.json.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, PARTS } from './hccWorld.mjs';
import { syntheticWagon41214 } from './hccModel.mjs';
import { TRANSPORT, WAGON_MODE, HORSE_MODE, WAGON_MODEL_ID, NORMAL_GROUND_OFFSET } from '../src/systems/horseCartLaw.js';
import { bogieAxle, steerToward, hitchedPoseStep, yawBetween, yawed } from '../src/systems/horseFollow.js';
import { wheelContacts, rolledAngles } from '../src/systems/horseCart.js';
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';
import { HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';
import { wagonGeometry, buildBakedWagonParts, steerLimitOf, wagonIconModel, MEASURED, LIFT } from '../src/world/wagonModels.js';
import { WAGON_KINDS } from '../src/systems/wagonKinds.js';
import { quatForward, quatRotate, quatAngleAxis, mat4FromQuatPos, UNITY_QUAT_IDENTITY } from '../src/world/quat.js';
import { multiply } from '../src/world/mat4.js';

const bakeOf = (kind) => JSON.parse(readFileSync(new URL(`../src/assets/wagons/${kind}.json`, import.meta.url), 'utf8'));
const id = (g) => g;
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const hgap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** The short way round from angle `b` to angle `a` (degrees). */
const turnOf = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);
const closeAll = (a, b, eps, msg) => { assert.equal(a.length, b.length, `${msg}: ${a} vs ${b}`); a.forEach((v, i) => close(v, b[i], eps, `${msg} [${i}]`)); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const flatDir = (v) => { const l = Math.hypot(v[0], v[2]); return [v[0] / l, 0, v[2] / l]; };
const flat = (y = 0) => ({ raycastAll: (o, d, max) => (d[1] < 0 && o[1] >= y && o[1] - y <= max ? [{ point: [o[0], y, o[2]], distance: o[1] - y, normal: [0, 1, 0] }] : []) });
const freshPose = () => ({ position: [0, 0, 0], rotation: [...UNITY_QUAT_IDENTITY], active: false, lastValidPosition: [0, 0, 0], lastValidRotation: [...UNITY_QUAT_IDENTITY], hasLastValid: false, up: [0, 1, 0], hitch: null });
const floorCollider = () => ({ surfaceHit: (o, d, max) => (d[1] < 0 && o[1] > 0 && o[1] <= max ? { dist: o[1], key: null, normal: [0, 1, 0] } : { dist: Infinity }) });
const QUIET = { warn() {}, error() {}, info() {} };
function fakeRenderer() {
  const r = { draws: [] };
  r.createMesh = (model) => ({ model });
  r.drawMesh = (gpu, m, remap, o) => r.draws.push({ gpu, m: [...m], o });
  r.uploadTexture = () => {}; r.createBillboardBatch = () => ({ origin: [0, 0, 0] }); r.destroyBillboardBatch = () => {};
  return r;
}
const ART = { ensureStationary: () => true, ensureWalk() {}, hasWalk: () => true };
/** The runtime on the fake flat world, drawn by a real pool of Mac's `kind` - the parts as the pool mints them. */
async function wagonWorld(kind, opts = {}) {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, wagonKind: () => kind, bakedWagon: async (k) => bakeOf(k), log: QUIET, ...opts });
  pool.partsOf(kind); await flush();
  const world = makeWorld({ presentation: { ...pool.presentation, horseArt: ART } });
  pool.attach(world.rt);
  return { ...world, pool, renderer, parts: pool.partsOf(kind) };
}
/** One step of the rider along their facing, turned `dyaw` first. */
const rideOn = (w, step, ds, dyaw = 0) => { w.yaw += dyaw; w.pos[0] += Math.sin(w.yaw) * ds; w.pos[2] += Math.cos(w.yaw) * ds; step(); };
/** The drawn turn of a wheel matrix whose wagon is unturned: atan2 of its +y axis's z over its y. */
const wheelTurnOf = (m) => (Math.atan2(m[6], m[5]) * 180) / Math.PI;
/** The bogie's matrix in the wagon's frame - T(k) Ry(steer) T(-k) - built here from its definition. */
const bogieFrame = (k, steer) => multiply(mat4FromQuatPos(quatAngleAxis(steer, [0, 1, 0]), k), mat4FromQuatPos(UNITY_QUAT_IDENTITY, [-k[0], -k[1], -k[2]]));
const wheelFrame = (pivot, angle) => mat4FromQuatPos(quatAngleAxis(angle, [1, 0, 0]), pivot);
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

test('WAGONS2 THE LOCK: the four-wheelers\' front axle turns 6.85 degrees either way - the front-left rim\'s face 0.10 m outside the body\'s side, the chord the side\'s foot cuts across it, turned about the kingpin until its end comes in to the side; a part beside the wheels where no rim reaches, or over their tops, leaves it; a wall whose foot is under the pivot meets the whole radius (mutants: the chord ignored, the kingpin\'s offset ignored, the wall\'s run unread, the whole radius never met)', () => {
  const ow = bakeOf('openWagon'), cv = bakeOf('caravan');
  const kp = ow.parts.find((p) => p.role === 'axleFront').origin;
  assert.deepEqual([...kp], [...MEASURED.openWagon.frontAxle], 'the kingpin is the front axle\'s centre, as measured');
  const lock = steerLimitOf(ow, kp);
  close(lock, 6.849695, 1e-5, 'the open wagon\'s lock');
  close(steerLimitOf(cv, cv.parts.find((p) => p.role === 'axleFront').origin), 6.849695, 1e-5, 'the caravan\'s - the same running gear');
  // the law, from the numbers read here: the body's side and foot, the front-left wheel's inner face, radius, pivot
  const pts = (part) => { const out = []; for (let i = 0; i < part.positions.length; i += 3) out.push(part.positions.slice(i, i + 3)); return out; };
  const body = pts(ow.parts.find((p) => p.role === 'body')), fl = ow.parts.find((p) => p.role === 'wheelFrontLeft');
  const wall = Math.max(...body.map((q) => Math.abs(q[0]))), foot = Math.min(...body.map((q) => q[1]));
  const inner = Math.min(...pts(fl).map((q) => Math.abs(q[0]))), R = fl.origin[1] - Math.min(...pts(fl).map((q) => q[1]));
  assert.deepEqual([wall, foot, inner, R].map((v) => +v.toFixed(4)), [1.3594, 0.9425, 1.4616, 0.7811]);
  const reach = Math.sqrt(R * R - (foot - fl.origin[1]) ** 2) + Math.abs(fl.origin[2] - kp[2]);
  close(lock, ((Math.acos(wall / Math.hypot(inner, reach)) - Math.atan2(reach, inner)) * 180) / Math.PI, 1e-9, 'the rim\'s end comes in to the side');
  // what is not beside the rims leaves the lock; a lower wall meets the whole radius
  const slab = (role, lo, hi) => ({ role, positions: [...lo, ...hi], polygons: [] });
  close(steerLimitOf({ ...ow, parts: [...ow.parts, slab('trim', [-1.45, 0.9, -0.5], [1.45, 1.4, 0.5])] }, kp), lock, 1e-12, 'a trim behind, where no rim reaches');
  close(steerLimitOf({ ...ow, parts: [...ow.parts, slab('rail', [-1.45, 1.6, 2.5], [1.45, 1.7, 5.0])] }, kp), lock, 1e-12, 'a rail over the wheels\' tops');
  const low = steerLimitOf({ ...ow, parts: [...ow.parts, slab('rail', [-1.43, 0.5, 2.5], [1.43, 0.6, 5.0])] }, kp);
  const r2 = R + Math.abs(fl.origin[2] - kp[2]);
  close(low, ((Math.acos(1.43 / Math.hypot(inner, r2)) - Math.atan2(r2, inner)) * 180) / Math.PI, 1e-9, 'a rail low beside them meets the whole radius');
});

test('WAGONS2 THE PARTS: each wheel carries its own radius, a four-wheeler\'s front pair turns with its bogie - the front axle and the pole on the kingpin, the wheelbase from the rear axle; the body keeps no pole; the bounds and the item\'s picture keep the whole wagon (mutants: a wheel\'s radius dropped, every wheel taken for a front one, the pole left on the body, the bogie out of the bounds, the bogie out of the icon)', () => {
  const zs = (g) => { let lo = Infinity, hi = -Infinity; for (let i = 2; i < g.positions.length; i += 3) { lo = Math.min(lo, g.positions[i]); hi = Math.max(hi, g.positions[i]); } return [lo, hi]; };
  for (const kind of ['cart', 'openWagon', 'caravan']) {
    const g = wagonGeometry(bakeOf(kind)), parts = buildBakedWagonParts(g, id);
    assert.deepEqual(parts.wheels.map((w) => [w.role, +w.radius.toFixed(4), w.front]), kind === 'cart'
      ? [['wheelRearLeft', 0.5445, false], ['wheelRearRight', 0.5445, false]]
      : [['wheelRearRight', 0.7811, false], ['wheelRearLeft', 0.7811, false], ['wheelFrontLeft', 0.7811, true], ['wheelFrontRight', 0.7811, true]], kind);
    if (kind === 'cart') { assert.equal(parts.bogie, null, 'the cart has one axle'); continue; }
    assert.deepEqual(parts.bogie.kingpin.map((v) => +v.toFixed(4)), [0, +(MEASURED[kind].frontAxle[1] - LIFT).toFixed(4), 3.8659], `${kind}: the kingpin, lifted`);
    close(parts.bogie.wheelbase, 3.8659, 1e-9, `${kind}: the wheelbase`);
    close(parts.bogie.steerLimit, 6.849695, 1e-5, `${kind}: the lock`);
    const [blo, bhi] = zs(g.bogie.geometry);
    close(bhi, WAGON_KINDS[kind].hitch - 1.25 + 0.25, 1e-5, `${kind}: the bogie reaches the pole's iron at the horse`);
    assert.ok(blo > 3.7 && blo < 3.8, `${kind}: and back to the front axle (${blo})`);
    close(zs(g.statics)[1], MEASURED[kind].frontZ, 1e-2, `${kind}: the body ends at its own front`);
    close(parts.bounds.max[2], bhi, 1e-6, `${kind}: the bounds reach the pole's tip`);
    close(zs(wagonIconModel(g))[1], bhi, 1e-6, `${kind}: the picture draws the pole`);
  }
});

test('WAGONS2 THE TWO BARS: bogieAxle - the kingpin on the pole from the hitch, the rear axle on the wheelbase from the kingpin, each on the line from where it was; the steer the turn from the body to the pole; past the lock the body is laid at the lock off the pole; an unplaced wagon is laid straight where one bar stands it; steerToward reads a drawn wagon\'s (mutants: the kingpin pulled the whole hitch, the body pulled from the hitch, the lock dropped, the lock laid the wrong way, the turn\'s sense flipped, the kingpin at the axle)', () => {
  const b = { wheelbase: 4, steerLimit: 30 };
  assert.deepEqual(bogieAxle([0, 0, -10], null, [0, 0, 0], 7, b, [0, 0, 1]), { axle: [0, 0, -7], kingpin: [0, 0, -3], dir: [0, 0, 1], steer: 0 });
  const t = bogieAxle([0, 0, -7], [0, 0, -3], [1, 0, 0], 7, b, [0, 0, 1]);
  closeAll(t.kingpin, [1 - 3 / Math.sqrt(10), 0, -9 / Math.sqrt(10)], 1e-12, 'the kingpin three metres from the hitch, on its line from where it was');
  closeAll(t.axle, [0.0019056254929997254, 0, -6.845744700699088], 1e-12, 'the axle four metres from the kingpin, on its line');
  closeAll(t.dir, [0.012352769114121627, 0, 0.9999237016368866], 1e-12, 'facing the kingpin');
  close(t.steer, 17.727169286485033, 1e-9, 'steered toward the hitch');
  close(hgap(t.kingpin, [1, 0, 0]), 3, 1e-12, 'the pole'); close(hgap(t.axle, t.kingpin), 4, 1e-12, 'the wheelbase');
  // the hitch swung square to the right of the kingpin: 90 degrees asked, the lock's 30 given
  const lock = bogieAxle([0, 0, -7], [0, 0, -3], [3, 0, -3], 7, b, [0, 0, 1]);
  closeAll(lock.axle, [-2 * Math.sqrt(3), 0, -5], 1e-12, 'the body laid at the lock off the pole');
  closeAll(lock.dir, [Math.sqrt(3) / 2, 0, 0.5], 1e-12, 'sixty degrees round, thirty short of the pole');
  assert.deepEqual([lock.kingpin, lock.steer], [[0, 0, -3], 30]);
  // the turn's sense, written out
  close(yawBetween([0, 0, 1], [Math.sin(0.3), 0, Math.cos(0.3)]), (0.3 * 180) / Math.PI, 1e-12, '+z toward +x is positive');
  closeAll(yawed([0, 0, 1], 30), [0.5, 0, Math.sqrt(3) / 2], 1e-12, 'yawed turns as quatAngleAxis does');
  closeAll(yawed([0, 0, 1], 30), quatRotate(quatAngleAxis(30, [0, 1, 0]), [0, 0, 1]), 1e-12, 'the same turn');
  // a drawn wagon's steer: its kingpin a wheelbase ahead of its axle, toward the hitch, held to the lock
  close(steerToward([0, 5, 0], [0, 0, 2], [1, 0, 7], b), (Math.atan2(1, 3) * 180) / Math.PI, 1e-12, 'within the lock');
  assert.equal(steerToward([0, 5, 0], [0, 0, 2], [9, 0, 7], b), 30, 'at it');
});

test('WAGONS2 hitchedPoseStep: a four-wheeler is laid straight where one bar would stand it, then trails as two bars - at every frame of a curve its kingpin (a wheelbase ahead of its axle) stands the pole from the hitch, its steer the turn from its body to the pole, inside the lock; a bogie its hitch does not reach past is one bar (mutants: the bogie unread, the kingpin laid fresh every frame, a bogie longer than its hitch taken for two bars)', () => {
  const bogie = buildBakedWagonParts(wagonGeometry(bakeOf('openWagon')), id).bogie;
  const L = WAGON_KINDS.openWagon.hitch, wb = bogie.wheelbase;
  const one = hitchedPoseStep(flat(0), freshPose(), [0, 1, 0], [0, 0, 1], L, 1 / 30);
  let p = hitchedPoseStep(flat(0), freshPose(), [0, 1, 0], [0, 0, 1], L, 1 / 30, null, bogie);
  assert.deepEqual([p.axle, p.position, p.rotation, p.steer], [one.axle, one.position, one.rotation, 0], 'laid straight, where the one bar lays it');
  assert.equal(one.steer, 0, 'one bar never steers');
  let h = [0, 1, 0], yaw = 0, most = 0;
  for (let i = 0; i < 120; i++) {
    yaw += 0.025; h = [h[0] + Math.sin(yaw) * 0.2, 1, h[2] + Math.cos(yaw) * 0.2];
    p = hitchedPoseStep(flat(0), p, h, [Math.sin(yaw), 0, Math.cos(yaw)], L, 1 / 30, null, bogie);
    const f = flatDir(quatForward(p.rotation)), k = [p.axle[0] + f[0] * wb, 0, p.axle[2] + f[2] * wb];
    close(hgap(k, h), L - wb, 1e-9, `frame ${i}: the pole`);
    close(yawBetween(f, sub(h, k)), p.steer, 1e-6, `frame ${i}: the steer is the turn from the body to the pole`);
    assert.ok(Math.abs(p.steer) <= bogie.steerLimit + 1e-9, `frame ${i}: inside the lock (${p.steer})`);
    most = Math.max(most, Math.abs(p.steer));
  }
  close(most, bogie.steerLimit, 1e-9, 'a 40 m curve takes it to the lock');
  // the hitch shorter than the wheelbase: the one bar, its gap the hitch
  let q = freshPose(); h = [0, 1, 0]; yaw = 0;
  for (let i = 0; i < 30; i++) {
    yaw += 0.05; h = [h[0] + Math.sin(yaw) * 0.2, 1, h[2] + Math.cos(yaw) * 0.2];
    q = hitchedPoseStep(flat(0), q, h, [Math.sin(yaw), 0, Math.cos(yaw)], 3.1, 1 / 30, null, { wheelbase: 4, steerLimit: 30 });
    close(hgap(q.axle, h), 3.1, 1e-9, `frame ${i}: one bar`);
    assert.equal(q.steer, 0);
  }
});

test('WAGONS2 EACH WHEEL ON ITS OWN: wheelContacts - each wheel\'s contact a radius under its pivot and its heading, a front wheel\'s swung about the kingpin by the steer; rolledAngles - each turns by its own contact\'s travel along its own heading over its own radius, one with no contact last time keeps its angle; the classic wagon\'s pair listed on its one radius (mutants: the wheel\'s own radius unread, the front heading unsteered, the front contact unsteered, a wheel with no contact zeroed, the classic pair not listed)', () => {
  const parts = { wheelRadius: 0.5, bogie: { kingpin: [0, 0, 2] }, wheels: [{ pivot: [-1, 0.5, 0], radius: 0.5, front: false }, { pivot: [1, 0.25, 2], radius: 0.25, front: true }] };
  const at = (z) => wheelContacts(parts, [10, 1, z], UNITY_QUAT_IDENTITY, 30);
  const c0 = at(10), c1 = at(10.5);
  closeAll(c0[0].p, [9, 1, 10], 1e-12, 'the rear wheel under its pivot'); closeAll(c0[0].h, [0, 0, 1], 1e-12, 'rolling along the wagon');
  closeAll(c0[1].p, [10 + Math.sqrt(3) / 2, 1, 11.5], 1e-12, 'the front wheel swung thirty degrees about the kingpin');
  closeAll(c0[1].h, [0.5, 0, Math.sqrt(3) / 2], 1e-12, 'rolling along the bogie');
  const rad = 180 / Math.PI;
  closeAll(rolledAngles([10, 20], c0, c1, parts), [10 + 0.5 / 0.5 * rad, 20 + (0.5 * Math.sqrt(3) / 2) / 0.25 * rad], 1e-9, 'half a metre on: each its own travel over its own radius');
  closeAll(rolledAngles([10, 20], c1, c0, parts), [10 - rad, 20 - (Math.sqrt(3) / 2 / 0.25) * 0.5 * rad], 1e-9, 'backing turns them back');
  assert.deepEqual(rolledAngles([10, 20], null, c1, parts), [10, 20], 'nowhere to have come from: as they stood');
  // the classic model 41214: its pair on its one radius
  const classic = wheelContacts(PARTS, [0, 1, 0], UNITY_QUAT_IDENTITY, 30);
  assert.deepEqual(classic.map((c) => c.p.map((v) => +v.toFixed(9))), [[-0.9, 1, -0.6], [0.9, 1, -0.6]]);
});

test('WAGONS2 THE RUNTIME: riding Mac\'s open wagon every wheel turns 18.338 degrees for 0.25 m straight on and back again; on a right turn at the lock each turns by its own contact\'s travel along its own heading - the left (outer) pair further than the right; a recentre turns none; the classic wagon\'s pair rolls on its own too (mutants: the runtime\'s wheels unrolled, the bogie not handed to the shafts, the steer not given to the wheels, the runtime\'s recentre unshifted)', async () => {
  const { w, rt, step, parts } = await wagonWorld('openWagon');
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  const v = () => rt.view().moving;
  for (let i = 0; i < 60; i++) rideOn(w, step, 0.1);
  let a0 = [...v().wheel.angles];
  for (let i = 0; i < 5; i++) rideOn(w, step, 0.05);
  closeAll(v().wheel.angles.map((a, i) => turnOf(a, a0[i])), [18.338, 18.338, 18.338, 18.338], 1e-3, 'straight on: 0.25 m over 0.7811 m');
  a0 = [...v().wheel.angles];
  for (let i = 0; i < 5; i++) rideOn(w, step, -0.05);
  closeAll(v().wheel.angles.map((a, i) => turnOf(a, a0[i])), [-18.338, -18.338, -18.338, -18.338], 1e-3, 'and back');
  for (let i = 0; i < 300; i++) rideOn(w, step, 0.1, 0.1 / 12);   // a right turn of 12 m
  const pose = (m) => ({ position: [...m.pose.position], rotation: [...m.pose.rotation], steer: m.pose.steer });
  const p0 = pose(v()); a0 = [...v().wheel.angles];
  rideOn(w, step, 0.05, 0.05 / 12);
  const p1 = pose(v());
  close(p1.steer, parts.bogie.steerLimit, 1e-9, 'steered to the lock');
  // what each wheel should have turned, from its definition: its contact (a radius under its pivot, a front one's swung
  // about the kingpin by the steer) moved along its heading, over its radius
  const k = parts.bogie.kingpin;
  const expected = parts.wheels.map((wh) => {
    const local = (s) => { const c = [wh.pivot[0], wh.pivot[1] - wh.radius, wh.pivot[2]]; if (!wh.front) return c; const d = quatRotate(quatAngleAxis(s, [0, 1, 0]), [c[0] - k[0], 0, c[2] - k[2]]); return [k[0] + d[0], c[1], k[2] + d[2]]; };
    const head = (p) => quatRotate(p.rotation, wh.front ? quatRotate(quatAngleAxis(p.steer, [0, 1, 0]), [0, 0, 1]) : [0, 0, 1]);
    const P = (p) => add(p.position, quatRotate(p.rotation, local(p.steer)));
    const ax = add(head(p0), head(p1)), al = Math.hypot(...ax), d = sub(P(p1), P(p0));
    return ((d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]) / al / wh.radius) * (180 / Math.PI);
  });
  const got = v().wheel.angles.map((a, i) => turnOf(a, a0[i]));
  closeAll(got, expected, 1e-6, 'each its own');
  // parts.wheels: rear right, rear left, front left, front right
  assert.ok(got[1] - got[0] > 0.5 && got[2] - got[3] > 0.5, `the outer (left) pair further than the inner: ${got}`);
  // my own recentre moves the scene under the standing wagon along its length: no wheel reads it as travel
  const r0 = [...v().wheel.angles];
  rt.rebase([0, 0, 5]); w.pos[2] += 5; step();
  closeAll(v().wheel.angles, r0, 1e-9, 'a recentre is no travel');
  // the classic wagon (the mod's model, the fallback): its two wheels part on a turn as well
  const c = makeWorld();
  c.step(2); c.rt.tryUseTransport(TRANSPORT.Cart); c.step(2);
  for (let i = 0; i < 30; i++) rideOn(c.w, c.step, 0.1);
  const b0 = [...c.rt.view().moving.wheel.angles];
  for (let i = 0; i < 20; i++) rideOn(c.w, c.step, 0.05, 0.05 / 6);
  const cg = c.rt.view().moving.wheel.angles.map((a, i) => turnOf(a, b0[i]));
  assert.ok(cg.length === 2 && cg[0] - cg[1] > 5, `the classic pair, left outer: ${cg}`);
});

test('WAGONS2 AT REST: a dismount keeps each wheel\'s angle and the bogie\'s steer, and the parked wagon is drawn so - not snapped to 0; its hitched horse stands at its pole\'s end, where the rider sat; driven off, the wheels start where they stood; a leap keeps them; a load forgets them (mutants: nothing kept, the parked draw at 0, the drive-off from 0, a jump zeroes them, the horse straight ahead of the body, a load keeps them)', async () => {
  const { w, rt, step, pool, renderer, parts, state } = await wagonWorld('caravan');
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 60; i++) rideOn(w, step, 0.1);
  for (let i = 0; i < 40; i++) rideOn(w, step, 0.1, -0.01);   // a gentle left turn
  const m = rt.view().moving, angles = [...m.wheel.angles], steer = m.pose.steer, rider = [...m.pose.hitch];
  assert.ok(steer < -1 && angles.some((a, i) => Math.abs(turnOf(a, angles[(i + 1) % 4])) > 1), `turned left, the wheels apart: ${steer}, ${angles}`);
  w.mode = TRANSPORT.Foot; step(3);
  assert.deepEqual([state().Mode, state().HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon]);
  assert.deepEqual(rt.view().rest, { angle: m.wheel.angle, angles, steer }, 'kept as they stood');
  // the parked wagon drawn with them: its body, its bogie at the steer, each wheel at its angle
  const s = pool.shown();
  assert.equal(s.wagon.kind, HCC_WIRE_KIND.Deployed);
  assert.equal(s.wagon.angle, 0, 'the wire\'s word unchanged');
  renderer.draws.length = 0; pool.draw(renderer);
  const M = renderer.draws[0].m, S = bogieFrame(parts.bogie.kingpin, steer);
  closeAll(renderer.draws[1].m, multiply(M, S), 1e-4, 'the bogie at its steer');
  parts.wheels.forEach((wh, i) => closeAll(renderer.draws[2 + i].m, multiply(wh.front ? multiply(M, S) : M, wheelFrame(wh.pivot, angles[i])), 1e-4, `${wh.role} at its angle`));
  // the horse in its shafts stands where the rider sat - the pole's end as the bogie rests - and faces along the pole
  const horse = rt.view().horse;
  assert.ok(horse?.isInteractive && hgap(horse.position, rider) < 0.05, `the horse where the rider sat: ${hgap(horse.position, rider)}`);
  close(yawBetween(quatForward(rt.view().deployed.rotation), horse.forward), steer, 1e-6, 'facing along the pole');
  rt.handleStartLoad();
  assert.equal(rt.view().rest, null, 'a load forgets them');
  // driven off again, the wheels start where they stood (the classic wagon - one the mod's reach can mount again parked)
  const c = makeWorld();
  c.step(2); c.rt.tryUseTransport(TRANSPORT.Cart); c.step(2);
  for (let i = 0; i < 30; i++) rideOn(c.w, c.step, 0.1, 0.01);
  const stood = [...c.rt.view().moving.wheel.angles];
  c.w.mode = TRANSPORT.Foot; c.step(3);
  const parked = c.scene(c.state().WorldX, c.state().WorldZ);
  c.w.pos = [parked[0] + 2, 0.9, parked[2] + 1.5]; c.w.yaw = 0; c.step(2);
  assert.equal(c.rt.tryUseTransport(TRANSPORT.Cart).succeeded, true);
  c.step();
  assert.ok(hgap(c.rt.view().moving.pose.axle, parked) < 1, 'driven off from where it stood');
  closeAll(c.rt.view().moving.wheel.angles, stood, 1e-9, 'from the angles they stood at');
  // a leap re-lays the wagon but neither spins nor zeroes its wheels
  for (let i = 0; i < 10; i++) rideOn(c.w, c.step, 0.1);
  const before = [...c.rt.view().moving.wheel.angles];
  c.w.pos[0] += 200; c.step();
  closeAll(c.rt.view().moving.wheel.angles, before, 1e-9, 'a leap is no travel');
});

test('WAGONS2 THE DRAW: riding, the caravan\'s bogie is drawn turned by the steer about the kingpin - its pole points at the rider - each front wheel on the bogie and each wheel at its own angle; the classic wagon draws each of its pair at its own (mutants: the steer\'s sense flipped in the draw, the bogie unturned, the front wheels unturned, one angle for every wheel, the classic right wheel at the left\'s)', async () => {
  const { w, rt, step, pool, renderer, parts } = await wagonWorld('caravan');
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 60; i++) rideOn(w, step, 0.1);
  for (let i = 0; i < 25; i++) rideOn(w, step, 0.1, 0.008);
  const m = rt.view().moving, steer = m.pose.steer;
  assert.ok(steer > 1, `steered right: ${steer}`);
  renderer.draws.length = 0; pool.draw(renderer);
  const M = renderer.draws[0].m, S = bogieFrame(parts.bogie.kingpin, steer);
  closeAll(renderer.draws[1].m, multiply(M, S), 1e-4, 'the bogie');
  parts.wheels.forEach((wh, i) => closeAll(renderer.draws[2 + i].m, multiply(wh.front ? multiply(M, S) : M, wheelFrame(wh.pivot, m.wheel.angles[i])), 1e-4, wh.role));
  // the pole's tip (its centre line's end, in the wagon's frame) drawn on the line from the kingpin to the rider
  const B = renderer.draws[1].m, kp = apply(M, parts.bogie.kingpin), tip = apply(B, [0, 1.0 - LIFT, WAGON_KINDS.caravan.hitch - 1.25]);
  close(yawBetween(flatDir(sub(tip, kp)), flatDir(sub(m.pose.hitch, kp))), 0, 1e-3, 'the pole points at the horse');
  // the classic wagon: wheel by wheel
  const gpu = { [WAGON_MODEL_ID]: { id: WAGON_MODEL_ID } };
  for (const d of CARGO_DEFINITIONS) gpu[d.modelId] = { id: d.modelId };
  const r = fakeRenderer();
  const classic = createHorseCartPool({ renderer: r, meshes: { getGpuMesh: async (x) => gpu[x] ?? null, cpuModels: new Map([[WAGON_MODEL_ID, syntheticWagon41214()]]) }, collider: () => null, now: () => 0 });
  const pose = hitchedPoseStep(flat(0), freshPose(), [0, 1.3, 0], [0, 0, 1], 3.1, 1 / 30);
  classic.attach({ view: () => ({ state: { HorseName: '' }, moving: { pose, wheel: { angle: 5, angles: [10, 70] }, cargoTier: 0, interaction: false }, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, rest: null }), lateUpdate() {} });
  classic.frame(1 / 30, [0, 2, 5]); await flush();
  r.draws.length = 0; classic.draw(r);
  const cp = classic.parts;
  const turnOfDraw = (g) => wheelTurnOf(r.draws.find((d) => d.gpu === g).m);
  closeAll([turnOfDraw(cp.gpu.wheelLeft), turnOfDraw(cp.gpu.wheelRight)], [10, 70], 1e-4, 'the classic pair, each its own');
});

test('WAGONS2 ANOTHER PLAYER\'S WAGON: their open wagon hangs on its two bars from their rider as drawn here - the pole from the rider at every frame, steered; its wheels turn HERE every frame off the pose drawn here, from the word\'s angle on the first; a leap and my own recentre spin nothing; their following team steers toward their horse as drawn here (mutants: the peer\'s wheels unturned, the word\'s angle not the seed, the peer\'s two bars dropped, a leap rolled, the recentre unshifted, the following steer unread)', async () => {
  let anchor = [0, 0, 0];
  const r = fakeRenderer();
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: floorCollider, now: () => 0, selfId: () => 'me', peerAnchor: (x) => (x === 'p1' ? anchor : null), bakedWagon: async (k) => bakeOf(k), fetchFn: async () => ({ ok: false, status: 404 }), log: QUIET });
  pool.attach({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, rest: null }), lateUpdate() {} });
  const L = WAGON_KINDS.openWagon.hitch;
  const word = (x, z) => ({ w: [HCC_WIRE_KIND.Trailing, x, NORMAL_GROUND_OFFSET, z, 0, 0, 0, 1, 0, 42], wk: 1 });
  pool.applyOwner('p1', word(0, -L), (p) => p, 1);
  pool.frame(1 / 30, [0, 2, 5]); await flush();   // the word starts the bake's build
  pool.applyOwner('p1', word(0, -L), (p) => p, 2);
  pool.frame(1 / 30, [0, 2, 5]);
  const p = pool.peers.get('p1'), parts = pool.partsOf('openWagon'), wb = parts.bogie.wheelbase;
  assert.ok(parts?.bogie && p.turn, 'the open wagon is up');
  assert.deepEqual(p.turn.angles, [42, 42, 42, 42], 'the word\'s angle, the first frame\'s');
  let yaw = 0, most = 0, moved = 0;
  for (let i = 0; i < 60; i++) {
    yaw += 0.02; anchor = [anchor[0] + Math.sin(yaw) * 0.25, 0, anchor[2] + Math.cos(yaw) * 0.25];
    const was = [...p.turn.angles];
    pool.frame(1 / 30, [0, 2, 5]);
    const f = flatDir(quatForward(p.shownRotation)), k = [p.shownWagon[0] + f[0] * wb, 0, p.shownWagon[2] + f[2] * wb];
    close(hgap(k, anchor), L - wb, 1e-9, `frame ${i}: the pole from their rider`);
    most = Math.max(most, Math.abs(p.steer));
    if (p.turn.angles.every((a, j) => Math.abs(turnOf(a, was[j])) > 1)) moved++;
  }
  assert.ok(most > 3, `steered on the curve: ${most}`);
  assert.equal(moved, 60, 'every frame, every wheel - not at the word\'s cadence');
  // a leap of their rider, and a recentre of mine: neither is travel
  let held = [...p.turn.angles];
  anchor = [anchor[0] + 60, 0, anchor[2]];
  pool.applyOwner('p1', word(anchor[0], anchor[2] - L), (q) => q, 3);
  pool.frame(1 / 30, [0, 2, 5]);
  closeAll(p.turn.angles, held, 1e-9, 'a leap');
  pool.frame(1 / 30, [0, 2, 5]);
  held = [...p.turn.angles];
  pool.offsetAll([0, 0, 5]); anchor = [anchor[0], 0, anchor[2] + 5];   // along its length, where a stale contact would read as travel
  pool.frame(1 / 30, [0, 2, 5]);
  closeAll(p.turn.angles, held, 1e-9, 'my recentre');
  // their following team: steered toward their horse as drawn here (wagon at the origin facing +z, the horse a little right)
  pool.applyOwner('p2', { w: [HCC_WIRE_KIND.Following, 0, NORMAL_GROUND_OFFSET, 0, 0, 0, 0, 1, 0, 0], wk: 1, h: [0.3, 0, L, 0, 1, 1] }, (q) => q, 4);
  for (let i = 0; i < 3; i++) pool.frame(1 / 30, [0, 2, 5]);
  close(pool.peers.get('p2').steer, (Math.atan2(0.3, L - wb) * 180) / Math.PI, 1e-9, 'toward their horse');
});

test('WAGONS2 x OW-BIG: under the Overworld each of my grown wheels keeps its own clock - each turns its own step over g (mutant: one clock for every wheel)', async () => {
  const r = fakeRenderer();
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: floorCollider, now: () => 0, wagonKind: () => 'openWagon', bakedWagon: async (k) => bakeOf(k), log: QUIET });
  pool.partsOf('openWagon'); await flush();
  const parts = pool.partsOf('openWagon');
  const pose = hitchedPoseStep(flat(0), freshPose(), [0, 1.3, 0], [0, 0, 1], WAGON_KINDS.openWagon.hitch, 1 / 30, null, parts.bogie);   // the producer's own, straight
  const wheel = { angle: 0, angles: [10, 20, 30, 40] };
  pool.attach({ view: () => ({ state: { HorseName: '' }, moving: { pose, wheel, cargoTier: 0, interaction: false }, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, rest: null }), lateUpdate() {} });
  const drawn = () => { r.draws.length = 0; pool.draw(r, null, { selfGrow: 8 }); return r.draws.slice(2, 6).map((d) => wheelTurnOf(d.m)); };
  closeAll(drawn(), [10, 20, 30, 40], 1e-4, 'grown from where they stood');
  wheel.angles = [10 + 80, 20 + 40, 30 - 16, 40 + 8];
  closeAll(drawn(), [10 + 10, 20 + 5, 30 - 2, 40 + 1], 1e-4, 'each its own step, an eighth of it');
});
