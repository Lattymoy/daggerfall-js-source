// BENCH-CAM (2026-10-10, from play - Temegast: "this is what i see when i use my carriage", Eye Of The Beholder's sprite
// filling the screen; asked, "Thirs person view isnt working properly for wagon traversal"). THE CAMERA ON A WAGON'S
// BENCH turns about a pivot over the wagon's roof (bible/06-Systems/Wagons.md BENCH-CAM): the wagon's `shell` (both bench
// wagons' body box - world/wagonModels.js wagonGeometry), the height the pivot rises to (scenes/horseCartPool.js
// cameraFloor), both cameras reading it (player/eotbCamera.js, player/mwCamera.js), the seam that hands it on
// (player/mwView.js) and the two exterior hosts that say it (scenes/world.js, scenes/exterior.js).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld } from './hccWorld.mjs';
import { TRANSPORT } from '../src/systems/horseCartLaw.js';
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';
import { SHELL_CLEAR_M, MEASURED, LIFT, wagonGeometry } from '../src/world/wagonModels.js';
import { SEATED_EYE_HEIGHT } from '../src/player/seatPose.js';
import { createEotbCamera } from '../src/player/eotbCamera.js';
import { createMwCamera, FOCAL_HEIGHT, MW_UNITS_PER_METER } from '../src/player/mwCamera.js';
import { quatAngleAxis, quatRotate } from '../src/world/quat.js';
import { setModSetting } from '../src/systems/modSettings.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bakeOf = (kind) => JSON.parse(rd(`src/assets/wagons/${kind}.json`));
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);
const QUIET = { warn() {}, error() {}, info() {} };
const ART = { ensureStationary: () => true, ensureWalk() {}, hasWalk: () => true };
function fakeRenderer() {
  const r = {};
  r.createMesh = (model) => ({ model }); r.updateMeshVertices = () => {}; r.destroyMesh = () => {}; r.drawMesh = () => {};
  r.uploadTexture = () => {}; r.createBillboardBatch = () => ({ origin: [0, 0, 0] }); r.destroyBillboardBatch = () => {};
  return r;
}
/** Mac's `kind` driven 4 m along +z on the fake flat world, its driver on the bench. */
async function onTheBench(kind) {
  const pool = createHorseCartPool({ renderer: fakeRenderer(), meshes: null, collider: () => null, now: () => 0, wagonKind: () => kind, bakedWagon: async (k) => bakeOf(k), log: QUIET });
  pool.partsOf(kind); await flush();
  const world = makeWorld({ presentation: { ...pool.presentation, horseArt: ART } });
  pool.attach(world.rt);
  world.step(2); world.rt.tryUseTransport(TRANSPORT.Cart); world.step(2);
  for (let i = 0; i < 40; i++) { world.w.pos[2] += 0.1; world.step(); }
  pool.frame(1 / 30, [0, 2, -5], 0);
  return { pool, world, seat: pool.driverSeat() };
}
/** The frame's two casts, as the hosts hand them: the wagon's body the only wall (the fake world stands none). */
const castsOf = (pool) => ({
  raycast: (o, d, m) => { const h = pool.cameraHit(o, d, m); return Number.isFinite(h) ? h : null; },
  spherecast: (o, r, d, m) => { const h = pool.cameraHit(o, d, m, r); return Number.isFinite(h) ? h : null; },
});
/** Eye Of The Beholder's camera out of the head and settled (four seconds of its smoothing) at `pitch`. */
function eotbSettled(seat, casts, pitch, pivotFloor) {
  const cam = createEotbCamera();
  cam.toggleOffset(true);
  const fpEye = [seat.feet[0], seat.feet[1] + SEATED_EYE_HEIGHT, seat.feet[2]];
  let out = null;
  for (let i = 0; i < 120; i++) out = cam.eye({ fpEye, feet: seat.feet, yaw: seat.yaw, pitch, dt: 1 / 30, raycast: casts.raycast, pivotFloor, seated: true });
  return out;
}
function mwThird(seat, casts, pitch, pivotFloor) {
  const cam = createMwCamera();
  cam.restore({ firstPerson: false, baseDistance: 192 });
  return cam.eye({ fpEye: [seat.feet[0], seat.feet[1] + SEATED_EYE_HEIGHT, seat.feet[2]], feet: seat.feet, yaw: seat.yaw, pitch, ...casts, pivotFloor });
}

test('BENCH-CAM THE SHELL AND THE FLOOR: both bench wagons stand their body\'s box as a shell (the caravan\'s room, the open wagon\'s tilt), the Small Cart none; the pivot\'s floor is the shell\'s top where the wagon is drawn and SHELL_CLEAR_M over it - its highest corner on a pitched wagon - over the seated head on both; none parked, none on the Small Cart (mutants: the tilt no shell, the clearance dropped, the roof read level)', async () => {
  for (const kind of ['caravan', 'openWagon']) {
    const shell = wagonGeometry(bakeOf(kind)).shell;
    assert.ok(shell, `${kind}: a shell`);
    assert.ok(MEASURED[kind].bench, `${kind}: a bench`);
    close(shell.max[1], 3.5166 - LIFT, 0.01, `${kind}: its roof the body's top`);
  }
  assert.equal(wagonGeometry(bakeOf('cart')).shell, null, 'the Small Cart: no bench, no shell');
  assert.equal(SHELL_CLEAR_M, 0.35);
  for (const kind of ['caravan', 'openWagon']) {
    const { pool, world, seat } = await onTheBench(kind);
    assert.ok(seat, `${kind}: on the bench`);
    const s = pool.shown(), shell = pool.partsOf(kind).shell;
    const floor = pool.cameraFloor();
    close(floor, s.wagon.position[1] + shell.max[1] + SHELL_CLEAR_M, 1e-9, `${kind}: the shell's top and the clearance`);
    assert.ok(floor > seat.feet[1] + SEATED_EYE_HEIGHT + 0.5, `${kind}: over the seated head (${(floor - seat.feet[1] - SEATED_EYE_HEIGHT).toFixed(2)} m)`);
    // pitched nose-down 8 degrees: the roof's highest corner is its back top edge, raised by the pitch
    const pose = world.rt.view().moving.pose, level = pose.rotation;   // the runtime's own pose, which the pool reads
    pose.rotation = quatAngleAxis(8, [1, 0, 0]);
    let top = -Infinity;
    for (const x of [shell.min[0], shell.max[0]]) for (const y of [shell.min[1], shell.max[1]]) for (const z of [shell.min[2], shell.max[2]]) top = Math.max(top, s.wagon.position[1] + quatRotate(pose.rotation, [x, y, z])[1]);
    close(pool.cameraFloor(), top + SHELL_CLEAR_M, 1e-6, `${kind}: pitched, its highest corner`);
    assert.ok(Math.abs(top - (s.wagon.position[1] + shell.max[1])) > 0.05, `${kind}: which the level box's top is not`);
    pose.rotation = level;
    world.w.mode = TRANSPORT.Foot; world.step(3); pool.frame(1 / 30, [0, 2, -5], 0);
    assert.equal(pool.cameraFloor(), null, `${kind}: parked - no floor`);
  }
  const cart = await onTheBench('cart');
  assert.equal(cart.seat, null, 'the Small Cart: the saddle, no bench');
  assert.equal(cart.pool.cameraFloor(), null, 'the Small Cart: no floor');
});

test('BENCH-CAM THE CAMERA OFF THE DRIVER\'S HEAD: on the caravan\'s bench Eye Of The Beholder\'s camera stood in the sprite\'s head (the room 0.4 m behind the bench met its cast back) - from the pivot over the roof it stands its full distance, level and looking down, and looking up the roof brings it in no lower than the pivot; the Morrowind camera\'s look up went back into its focal, and from the pivot keeps its distance further; first person never reads the floor (mutants: the sprite\'s head unlifted, the focal unlifted)', async () => {
  const { pool, seat } = await onTheBench('caravan');
  const casts = castsOf(pool), floor = pool.cameraFloor();
  // the field bug, measured: no floor, the sprite camera in the head
  const inHead = eotbSettled(seat, casts, 0, null);
  assert.ok(inHead.distance < 0.6, `without the floor: ${inHead.distance.toFixed(2)} m from the head`);
  for (const pitch of [0, -0.3]) {
    const out = eotbSettled(seat, casts, pitch, floor);
    assert.ok(out.distance > 2, `pitch ${pitch}: the mod's whole two metres (${out.distance.toFixed(2)})`);
    close(out.focal[1], floor, 1e-9, `pitch ${pitch}: the casts start from the pivot`);
    assert.ok(out.eye[1] > floor - 1e-9, `pitch ${pitch}: over the roof`);
  }
  const up = eotbSettled(seat, casts, 0.5, floor);
  assert.ok(up.eye[1] >= floor - 0.6, `looking up: the roof stops it (${up.eye[1].toFixed(2)} vs ${floor.toFixed(2)})`);
  // the Morrowind camera: level its focal cleared the roof already; a look up cast it back into its focal
  const FOCAL = FOCAL_HEIGHT / MW_UNITS_PER_METER;
  close(mwThird(seat, casts, 0, null).distance, 192 / MW_UNITS_PER_METER, 1e-6, 'level, unlifted: the base distance');
  const was = mwThird(seat, casts, 0.2, null), now = mwThird(seat, casts, 0.2, floor);
  assert.ok(was.distance < 0.7, `looking up, unlifted: ${was.distance.toFixed(2)} m`);
  assert.ok(now.distance > 1.5, `looking up from the pivot: ${now.distance.toFixed(2)} m`);
  close(now.focal[1], Math.max(seat.feet[1] + FOCAL, floor), 1e-9, 'the focal at the floor');
  const lvl = mwThird(seat, casts, -0.3, floor);
  close(lvl.distance, 192 / MW_UNITS_PER_METER, 1e-6, 'looking down from the pivot: the base distance');
  // first person: the eye is the head's, whatever the floor
  const fp = createMwCamera();
  const fpEye = [seat.feet[0], seat.feet[1] + SEATED_EYE_HEIGHT, seat.feet[2]];
  assert.deepEqual(fp.eye({ fpEye, feet: seat.feet, yaw: 0, pitch: 0, ...casts, pivotFloor: floor }).eye, fpEye, 'Morrowind, first person');
  assert.deepEqual(createEotbCamera().eye({ fpEye, feet: seat.feet, yaw: 0, pitch: 0, dt: 1 / 30, ...casts, pivotFloor: floor }).eye, fpEye, 'the sprite, first person');
  // the open wagon: under its tilt the cast met the front hoop at once; from the pivot over it, the whole distance
  const open = await onTheBench('openWagon');
  const ocasts = castsOf(open.pool);
  assert.ok(eotbSettled(open.seat, ocasts, 0, null).distance < 0.8, 'the open wagon, unlifted: under the tilt, at the head');
  assert.ok(eotbSettled(open.seat, ocasts, 0, open.pool.cameraFloor()).distance > 2, 'the open wagon, from the pivot: the whole distance');
  close(mwThird(open.seat, ocasts, 0, open.pool.cameraFloor()).distance, 192 / MW_UNITS_PER_METER, 1e-6, 'the open wagon, Morrowind: the base distance');
});

test('BENCH-CAM THE SEAM AND THE HOSTS: mwViewFrame hands `pivotFloor` to whichever camera answers (the sprite\'s lane, driven through the seam), and both exterior hosts hand it my wagon\'s floor while I sit its bench - null off it; the interiors and the dungeon drive no wagon (mutants: the seam drops it for either lane, a host hands none)', async () => {
  const mv = await import('../src/player/mwView.js');
  const { eotbCamera } = await import('../src/player/eotbCamera.js');
  const { pool, seat } = await onTheBench('caravan');
  const casts = castsOf(pool), floor = pool.cameraFloor();
  setModSetting('eye-of-the-beholder', 'Enabled', true);
  mv.setEotbBodyReady(() => true);
  try {
    assert.equal(mv.eotbLane(), true, 'the sprite\'s lane (no Morrowind body here)');
    eotbCamera.toggleOffset(true);
    const fpEye = [seat.feet[0], seat.feet[1] + SEATED_EYE_HEIGHT, seat.feet[2]];
    let out = null;
    for (let i = 0; i < 120; i++) out = mv.mwViewFrame({ fpEye, feet: seat.feet, yaw: seat.yaw, pitch: 0, dt: 1 / 30, riding: false, seated: true, stopped: true, raycast: casts.raycast, pivotFloor: floor });
    assert.equal(out.thirdPerson, true);
    assert.ok(out.distance > 2, `through the seam: off the head (${out.distance.toFixed(2)})`);
    eotbCamera.toggleOffset(false);
  } finally {
    mv.setEotbBodyReady(() => false);
    setModSetting('eye-of-the-beholder', 'Enabled', false);
  }
  const src = rd('src/player/mwView.js');
  assert.match(src, /seaReach = 0, pivotFloor = null, \.\.\.state \}\) \{/, 'the seam takes it');
  assert.match(src, /eotbCamera\.eye\(\{ fpEye, feet, yaw, pitch, raycast, pivotFloor, \.\.\.frame \}\);/, 'the sprite\'s camera reads it');
  assert.match(src, /mwCamera\.eye\(\{ fpEye, feet, yaw, pitch, heightScale, raycast, spherecast, pivotFloor \}\);/, 'the Morrowind camera reads it');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /\n\s+pivotFloor: _driverSeat \? hcc\.cameraFloor\(\) : null,   \/\/ BENCH-CAM/, `${host}: the floor while I sit the bench`);
    assert.ok(s.indexOf('pivotFloor: _driverSeat ? hcc.cameraFloor() : null,') > s.indexOf('const mwv') || s.indexOf('pivotFloor: _driverSeat ? hcc.cameraFloor() : null,') > s.indexOf('mwViewFrame({'), `${host}: in the frame's view call`);
  }
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(rd(host), /cameraFloor/, `${host}: no wagon driven here`);
});
