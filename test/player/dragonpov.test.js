// DRAGON-POV (2026-10-30, mob: "can we get a 3rd person dragon for scrolling its brokewn"): the wheel out of the head on a
// dragon shows the dragon. A tamed dragon is a ride, and RIDE-POV held every ride but the 3D horse in the head; an Admin's
// /dragon left the head onto my own body standing in the air under the saddle's picture. On a dragon (the host's `dragon`)
// the wheel leaves the head, the camera starts at the foot's far end and reaches past it, my body is not drawn, and the
// dragon's sprite with its rider stands at my feet (scenes/dragonViewHost.js) - the saddle over the view in first person alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mwViewFrame, mwViewWheel, mwViewDrawBody, setEotbBodyReady, setEotbDrawBody } from '../../src/player/mwView.js';
import { mwCamera, MAX_DISTANCE, MW_UNITS_PER_METER } from '../../src/player/mwCamera.js';
import { fpArm } from '../../src/combat/fpArm.js';
import { eotbCamera } from '../../src/player/eyeOfTheBeholder/eotbCamera.js';
import { _resetModSettings } from '../../src/systems/modSettings.js';
import { createDragonViewHost, dragonRidden, DRAGON_VIEW_REACH_M, DRAGON_VIEW_SEAT_M } from '../../src/scenes/dragonViewHost.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { DRAGON_MOUNT_TEMPLATE } from '../../src/systems/dragon/dragonMount.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

const EYE = [1, 1.6, 2];
const frame = (riding, dragon = false) => mwViewFrame({ fpEye: EYE, feet: [1, 0, 2], yaw: 0, pitch: 0, dt: 1 / 60, riding, dragon: dragon ? DRAGON_VIEW_SEAT_M : 0 });

/** The seam with a Morrowind third-person body the rig serves (stubbed, as ridepov.test.js does). */
function arm() {
  setEotbBodyReady(null); setEotbDrawBody(null);
  eotbCamera.loadSettings(null); eotbCamera.toggleOffset(false);
  _resetModSettings();
  const real = { canThirdPerson: fpArm.canThirdPerson, setViewMode: fpArm.setViewMode, drawThird: fpArm.drawThird };
  fpArm.canThirdPerson = () => true;
  fpArm.setViewMode = () => true;
  mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  frame(false);
  return () => { Object.assign(fpArm, real); mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() }); frame(false); };
}

test('DRAGON-POV: on a ridden dragon the wheel leaves the head, at the foot\'s far end, and zooms out past it', () => {
  const restore = arm();
  try {
    frame(true, true);
    assert.equal(mwViewWheel(+100), true, 'a tamed dragon\'s rider is not held in the head (RIDE-POV is the saddle\'s, not the dragon\'s)');
    let out = frame(true, true);
    assert.equal(mwCamera.mode(), 'third');
    assert.equal(out.thirdPerson, true);
    assert.equal(mwCamera.baseDistance(), MAX_DISTANCE, 'out of the head the camera stands back from the dragon, not on the closest ring inside it');
    mwViewWheel(+100); frame(true, true);
    assert.ok(mwCamera.baseDistance() > MAX_DISTANCE, 'and a notch out reaches past the foot\'s far end');
    for (let i = 0; i < 30; i++) { mwViewWheel(+100); frame(true, true); }
    assert.equal(mwCamera.baseDistance(), DRAGON_VIEW_REACH_M * MW_UNITS_PER_METER, 'as far as the dragon\'s reach');
    out = frame(true, true);
    assert.ok(out.focal[1] >= DRAGON_VIEW_SEAT_M - 1e-6, 'the camera turns about the rider\'s seat');
    for (let i = 0; i < 40 && mwCamera.thirdPerson(); i++) { mwViewWheel(-100); out = frame(true, true); }
    assert.equal(mwCamera.mode(), 'first', 'the wheel in comes back to the head');
    frame(true, false);
    assert.equal(mwViewWheel(+100), false, 'a horse\'s saddle still holds the head (RIDE-POV)');
  } finally { restore(); }
});

test('DRAGON-POV: in third person on a dragon my body is not drawn - the dragon\'s sprite carries its rider', () => {
  const restore = arm();
  try {
    let drew = 0;
    fpArm.drawThird = () => { drew++; return true; };
    const draw = () => mwViewDrawBody(null, { proj: [], view: [], eye: EYE, feet: [1, 0, 2], yaw: 0 });
    mwCamera.restore({ firstPerson: false, baseDistance: 300 });
    frame(false, false);
    assert.equal(draw(), true, 'on foot the body is drawn');
    frame(false, true);
    assert.equal(draw(), false, 'on an Admin\'s dragon it is not');
    assert.equal(drew, 1);
  } finally { restore(); }
});

test('DRAGON-POV: the dragon ridden - a tamed one\'s look off its item, none on foot or on a horse', () => {
  const tamed = [{ templateIndex: DRAGON_MOUNT_TEMPLATE, dragonLook: 1 }];
  assert.equal(dragonRidden({ riding: false, transportMode: TRANSPORT_MODES.Foot }, tamed), null);
  assert.equal(dragonRidden({ riding: true, transportMode: TRANSPORT_MODES.Horse }, tamed), null);
  assert.deepEqual(dragonRidden({ riding: true, transportMode: TRANSPORT_MODES.Dragon }, tamed), { look: 1 }, 'on the tamed Aetherbright');
  assert.deepEqual(dragonRidden({ riding: true, transportMode: TRANSPORT_MODES.Dragon }, [{ templateIndex: DRAGON_MOUNT_TEMPLATE }]), { look: 0 }, 'on the brass');
});

test('DRAGON-POV: the host stands my dragon only out of the head, and says the seat only on a dragon', () => {
  let third = false;
  const made = [];
  const renderer = { createBillboardBatch: (a, r, size) => { const b = { record: r, size }; made.push(b); return b; }, destroyBillboardBatch: () => {}, textures: { has: () => true } };
  const host = createDragonViewHost(renderer, { getTexture: async () => null, uploadRecordFrame: () => {} }, () => third);
  const foot = { riding: false, transportMode: TRANSPORT_MODES.Foot };
  const mounted = { riding: true, transportMode: TRANSPORT_MODES.Dragon };
  assert.equal(host.ride(foot, []), 0, 'on foot no dragon');
  assert.equal(host.ride(mounted, [{ templateIndex: DRAGON_MOUNT_TEMPLATE }]), DRAGON_VIEW_SEAT_M, 'the seat over my feet until the sprite is up');
  host.frame([0, 0, 0], 0, [0, 1, -5], 1 / 60);
  assert.equal(host.shown(), false, 'in the head nothing stands');
  assert.deepEqual(host.batches(), []);
  third = true;
  host.frame([0, 0, 0], 0, [0, 1, -5], 1 / 60);
  assert.equal(host.shown(), true, 'out of the head my dragon stands');
  third = false;
  host.frame([0, 0, 0], 0, [0, 1, -5], 1 / 60);
  assert.equal(host.shown(), false);
});

test('DRAGON-POV: the saddle over the view is first person\'s alone, on both rides; the host wires the view', () => {
  assert.match(rd('src/player/mountRig.js'), /TRANSPORT_MODES\.Dragon && !ridePaused && !mwViewThirdPerson\(\)\) saddle\.draw/);
  assert.match(rd('src/scenes/staffDragonHost.js'), /paused\(\) \|\| third\(\)\) return;/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /dragon: dragonView\.ride\(player, playerEntity\.items\)/);
  assert.match(w, /dragonView\.frame\(player\.feetAt\(\), cam\.yaw, mwv0\.eye, dt\)/);
  assert.match(w, /dragonView\.drawInto\(allBatches\);/, 'the street\'s billboard pass draws my dragon');
});

test('DRAGON-POV (mob: "saddle over lay is in alot of uis"): the saddle is not painted while a panel covers the view', async () => {
  const { createDragonSaddle, setDragonSaddleCovered } = await import('../../src/player/dragonSaddle.js');
  let drawn = 0;
  const renderer = { uploadTexture: () => ({}), drawScreenQuad: () => { drawn++; } };
  const saddle = createDragonSaddle({ renderer, load: async () => ({ width: 4, height: 2 }) });
  saddle.loadArt();
  await new Promise((r) => setTimeout(r, 0));
  const canvas = { width: 800, height: 600 };
  let covered = true;
  setDragonSaddleCovered(() => covered);
  try {
    saddle.draw(canvas);
    assert.equal(drawn, 0, 'under a chat, a panel or the F-menu: nothing');
    covered = false;
    saddle.draw(canvas);
    assert.equal(drawn, 1, 'the view clear: the saddle');
  } finally { setDragonSaddleCovered(null); }
  assert.match(rd('src/scenes/world.js'), /setDragonSaddleCovered\(\(\) => pointerSurfaces\.size > 0 \|\| !!townTalk\.hudHidden/);
});

test('AURA-SEAT (mob: "aura floating"): a dragon rider\'s aura sits where the art seats the rider, under the camera\'s pivot, lower in the hover', async () => {
  const { dragonAuraLift, dragonSeatOver, dragonRiderSeatShare, DRAGON_AURA_DROP_M, DRAGON_RIDER_SEAT, DRAGON_RIDER_SEAT_HOVER } = await import('../../src/scenes/dragonViewHost.js');
  const h = 262 / 40;   // the pictures' height at Daggerfall's 40 pixels a metre
  assert.equal(dragonRiderSeatShare('0#3'), DRAGON_RIDER_SEAT, 'walking: the walk records seat the rider near 0.6');
  assert.equal(dragonRiderSeatShare('22#5'), DRAGON_RIDER_SEAT_HOVER, 'hovering: records 20-24 sit the rider lower');
  assert.equal(dragonRiderSeatShare(undefined), DRAGON_RIDER_SEAT);
  assert.ok(Math.abs(dragonAuraLift(h, '0#0') - (h * 0.6 - DRAGON_AURA_DROP_M)) < 1e-9);
  assert.ok(dragonAuraLift(h, '20#0') < dragonAuraLift(h, '0#0'), 'the hover sits lower than the walk');
  assert.ok(dragonAuraLift(h, '0#0') + DRAGON_AURA_DROP_M < dragonSeatOver(h) - 0.5, 'never at the camera\'s pivot over the rider\'s head');
  assert.equal(dragonAuraLift(0), DRAGON_VIEW_SEAT_M - DRAGON_AURA_DROP_M, 'before the sprite is up, the stand-in seat');
});
