// AUDIT 68 (2026-09-24), cluster player - src/player: the EOTB sprite
// count, the look filter's zero-length frame, the EOTB settings going
// live (and a new rig not being a settings change), the parked action
// object's box, and the lock-on's owed look. Every pin drives the real
// module through the producers that feed it, and each failed on the base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spriteCount } from '../src/player/eotbSprite.js';
import { createEotbBody } from '../src/player/eotbBody.js';
import { createEotbCamera } from '../src/player/eotbCamera.js';
import { LookFilter, frameRateScaledFraction, frameSmoothing, SMOOTHING_MAX } from '../src/player/lookFilter.js';
import { createLockOn } from '../src/player/lockOn.js';
import { objectAabb } from '../src/player/activate.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';
import { modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const MOD = 'eye-of-the-beholder';

test('AUDIT 68 S15-eotb-spritecount-hot: the sprite count is counted once, not re-walked on every ask (eotbBody.ready asks ~11 times a frame)', () => {
  const keys = Object.keys;
  let walks = 0;
  Object.keys = function spy(o) { walks++; return keys(o); };
  try {
    for (let i = 0; i < 100; i++) spriteCount();
  } finally { Object.keys = keys; }
  assert.equal(walks, 0, 'a table fixed at module load answers from what it counted then');
});

test('AUDIT 68 S15-lookfilter-nan-dt0: a zero-length frame never turns the camera NaN - no smoothing is full progress, no time is none', () => {
  // a repeated rAF timestamp: dt 0 with smoothing 'None' was 0/0
  const f = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  f.add(0.1, 0);
  f.tick(1 / 60, cam, { smoothing: 0 });
  f.add(0.05, 0.02);
  f.tick(0, cam, { smoothing: 0 });
  assert.ok(Number.isFinite(cam.yaw) && Number.isFinite(cam.pitch), `the camera stays a number: ${cam.yaw}, ${cam.pitch}`);
  assert.ok(Math.abs(cam.yaw - 0.15) < 1e-12 && Math.abs(cam.pitch - 0.02) < 1e-12, 'and with no smoothing the look lands whole, at any dt');
  f.tick(1 / 60, cam, { smoothing: 0 });
  assert.ok(Number.isFinite(cam.yaw), 'and it does not go NaN a frame later either');
  assert.equal(frameRateScaledFraction(1, 0), 1, 'fraction 1 is 1 at dt 0 too');
  assert.equal(frameSmoothing(0, 0), 0);
  // a smoothed look on a frame with no time in it makes no progress - and a
  // negative one (a first rAF stamp before the boot's performance.now) none either
  assert.equal(frameRateScaledFraction(0.5, 0), 0);
  assert.equal(frameRateScaledFraction(0.5, -1 / 60), 0, 'the -1/60 frame was -Infinity');
  const g = new LookFilter();
  const c2 = { yaw: 0, pitch: 0 };
  g.add(0.2, 0);
  g.tick(-1 / 60, c2, { smoothing: 0.5 });
  assert.equal(c2.yaw, 0, 'a negative frame pays nothing');
  assert.equal(g.residualYaw, 0.2, 'and the owed look waits whole');
});

test('AUDIT 68 S15-eotb-settings-snapshot: a pane edit reaches the EOTB camera at once, and the rig a building or dungeon builds is not a settings change', () => {
  _resetModSettings();
  try {
    // the rig's own call (weaponRig.js: eotbCamera.loadSettings(modSetting)), then Start
    const c = createEotbCamera();
    c.loadSettings(modSetting);
    c.start();
    assert.equal(c.thirdPerson(), true, 'StartInThirdPerson ships on');
    c.wheel(-1);
    c.tick({});
    assert.equal(c.scroll(), 0.2, 'scrolled one notch out');
    c.toggleAuto();
    assert.equal(c.autoArmed(), true, 'the player armed the table with ToggleInput');
    // entering a dungeon builds a second rig, which loads the same store again
    c.loadSettings(modSetting);
    assert.equal(c.scroll(), 0.2, 'the zoom survives the new rig - nothing changed, so no ToggleOffset');
    assert.equal(c.thirdPerson(), true);
    assert.equal(c.autoArmed(), true, 'and the table stays as the player left it');
    // the Features tile writes the store; the camera reads it on its next frame
    setModSetting(MOD, 'CameraScrolling.ScrollIncrement', 0.5);
    c.tick({});
    assert.equal(c.settings().increment, 0.5, 'a CameraScrolling edit is live');
    assert.equal(c.scroll(), 0.2, 'and, outside the four ToggleOffset sections, leaves the zoom alone');
    setModSetting(MOD, 'Camera.LongitudinalDistance', 5);
    c.tick({});
    assert.equal(c.settings().z, -5, 'the new distance is the camera\'s at once, as the tile says');
    assert.equal(c.scroll(), 0, 'a Camera edit re-runs ToggleOffset(offset), as the mod\'s LoadSettings does (IL_1156-IL_1195)');
    assert.equal(c.thirdPerson(), true);
  } finally { _resetModSettings(); }
});

test('AUDIT 68 S15-eotb-settings-snapshot: the body reads a pane edit on its next frame, with no reload call', () => {
  _resetModSettings();
  try {
    const b = createEotbBody({ count: () => 1, urlFor: () => null });
    b.attach({ uploadTexture() {}, createBillboardBatch() { return { origin: [0, 0, 0] }; }, drawBillboards() {} }, () => ({}));
    assert.equal(b.settings().dontHideWeapon, false);
    setModSetting(MOD, 'Compatibility.Don\'tHideWeapon', true);
    setModSetting(MOD, 'Enabled', false);
    b.ready();   // every lane frame asks here first (mwView.eotbLane)
    assert.equal(b.settings().dontHideWeapon, true, 'the hide follows the switch');
    assert.equal(b.settings().enabled, false);
    setModSetting(MOD, 'Enabled', true);
    b.ready();
    assert.equal(b.settings().enabled, true, 'a mod switched back on is not held off by the attach-time copy');
  } finally { _resetModSettings(); }
});

// the producer: ActionSystem.addAction, as audit63_world_actions.test.js registers a mover
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const QUAD = { positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], indices: [0, 1, 2, 0, 2, 3] };
const stubCollider = () => ({ addMesh: () => {}, removeBucket: () => {}, removeMesh: () => {}, raycast: () => Infinity });
const act = (over = {}) => ({
  actionFlag: ACTION_FLAGS.None, triggerFlag: TRIGGER_FLAGS.None,
  index: 0, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1,
  duration: 0, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 },
  ...over,
});

test('AUDIT 68 S15-objectaabb-vertex-walk: a parked action object is measured once; a pose change is measured again, live', () => {
  const a = new ActionSystem(stubCollider());
  const o = a.addAction(0, 3, QUAD, I, act({ triggerFlag: TRIGGER_FLAGS.Direct, translation: { x: 0, y: 10, z: 0 } }));
  const rest = objectAabb(o);
  assert.equal(objectAabb(o), rest, 'the same pose answers the box it already measured - no vertex walk');
  assert.deepEqual(rest.min, [0, 0, 0]);
  a.receive(o, 'Direct');
  const moved = objectAabb(o);
  assert.notEqual(moved, rest, 'the mover\'s new matrix is a new measurement');
  assert.deepEqual(moved.min, [0, 10, 0], 'AUDIT 63 F37\'s live pose still holds');
  assert.deepEqual(rest.min, [0, 0, 0], 'and the old box was not written into');
  assert.equal(objectAabb(o), moved);
});

test('AUDIT 68 S15-lockon-owed-residual: under the heaviest smoothing the lock settles ON the foe instead of swinging past it', () => {
  const lock = createLockOn();
  const filter = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  const eye = [0, 1.08, 0];
  lock.lock({ ai: { feet: [10, 0, 0], height: 1.8 }, dead: false });   // due +x, chest at eye height
  let maxYaw = 0;
  for (let i = 0; i < 600; i++) {
    // the hosts' order: the filter pays, then the lock adds (world.js, exterior.js, dungeon.js)
    filter.tick(1 / 60, cam, { smoothing: SMOOTHING_MAX });
    lock.tick(1 / 60, cam, eye, filter);
    maxYaw = Math.max(maxYaw, cam.yaw);
  }
  const overshoot = ((maxYaw - Math.PI / 2) * 180) / Math.PI;
  assert.ok(overshoot < 0.1, `no swing past the foe: ${overshoot.toFixed(2)} degrees (19 on the base)`);
  assert.ok(Math.abs(cam.yaw - Math.PI / 2) < 1e-3, 'and it settles facing it');
});
