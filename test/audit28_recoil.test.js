import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CameraRecoiler, recoilTimerStart, recoilRotationScalar, BASE_MAX_RECOIL_SEVERITY, MIN_PERCENT_THRESHOLD, TIMER_SPEED, RECOIL_FRACTION } from '../src/player/cameraRecoiler.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';
import { lastHealthLostPercent } from '../src/ui/hudVitals.js';

// AUDIT 28 - W9: CAMERA RECOIL (CameraRecoiler.cs, whole). The setting
// ships 3 (High) - DFU's camera reels on a hit by default - and the
// port's never did. A loss above 2% of max starts a sway on a random
// unit axis with a timer of (5 + floor(pct*5))*PI falling at 2*PI/s;
// each frame the camera is ROTATED by sin(timer) * scalar * axis
// degrees, the scalar dying with timer/timerStart.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const DEG = Math.PI / 180;

test('AUDIT 28 W9: the constants and the two formulas, verbatim', () => {
  assert.equal(BASE_MAX_RECOIL_SEVERITY, 50); assert.equal(MIN_PERCENT_THRESHOLD, 0.02);
  assert.ok(near(TIMER_SPEED, 2 * Math.PI)); assert.deepEqual([...RECOIL_FRACTION], [0, 0.25, 0.5, 0.75, 1]);
  assert.ok(near(recoilTimerStart(0.1), 5 * Math.PI), '5 + floor(0.5) = 5');
  assert.ok(near(recoilTimerStart(0.5), 7 * Math.PI), '5 + floor(2.5) = 7');
  assert.ok(near(recoilTimerStart(1), 10 * Math.PI));
  // scalar = 50 * fraction * (timer/timerStart) * clamp(hl*0.015, 0.015, 1)
  assert.ok(near(recoilRotationScalar(3, 10, 5 * Math.PI, 5 * Math.PI), 50 * 0.75 * 1 * 0.15));
  assert.ok(near(recoilRotationScalar(4, 200, 1, 2), 50 * 1 * 0.5 * 1), 'the health factor clamps at 1');
  assert.ok(near(recoilRotationScalar(2, 0, 1, 2), 50 * 0.5 * 0.5 * 0.015), 'and at its floor 0.015 - the frames after the hit');
  assert.equal(recoilRotationScalar(0, 10, 1, 1), 0);
});

test('AUDIT 28 W9: the gates - Off, paused, and a loss at or under 2% never start a sway', () => {
  const r = new CameraRecoiler(); const cam = { yaw: 0, pitch: 0 };
  assert.equal(r.update(1 / 60, cam, { healthLost: 50, healthLostPercent: 0.5, setting: 0 }), false);
  assert.equal(r.update(1 / 60, cam, { healthLost: 50, healthLostPercent: 0.5, setting: 3, paused: true }), false);
  assert.equal(r.update(1 / 60, cam, { healthLost: 1, healthLostPercent: 0.02, setting: 3 }), false, 'exactly 2% is not above it');
  assert.equal(r.swaying, false);
  assert.deepEqual(cam, { yaw: 0, pitch: 0 });
});

test('AUDIT 28 W9: a hit starts the sway on a unit axis; the timer falls at 2*PI/s; the rotate is additive on the camera; it dies out at timer 0', () => {
  const r = new CameraRecoiler(); const cam = { yaw: 1, pitch: 0.2 };
  const dt = 1 / 60;
  // rolls 0 -> axis (1, 0): pure pitch.
  const hit = r.update(dt, cam, { healthLost: 10, healthLostPercent: 0.1, setting: 3, rolls: () => 0 });
  assert.equal(hit, true); assert.equal(r.swaying, true);
  assert.deepEqual(r.swayAxis, [1, 0]);
  assert.ok(near(r.timerStart, 5 * Math.PI));
  assert.ok(near(r.timer, 5 * Math.PI - dt * 2 * Math.PI));
  const scalar = recoilRotationScalar(3, 10, r.timer, r.timerStart);
  const xAngle = Math.sin(r.timer) * scalar;
  assert.ok(near(cam.pitch, 0.2 - xAngle * DEG), 'Rotate(+x) pitches DOWN: the port subtracts from +pitch-is-up');
  // And it is an offset: the NEXT frame's rotation replaces it rather than stacking on it.
  r.update(dt, cam, { healthLost: 0, setting: 3 });
  const s2 = recoilRotationScalar(3, 0, r.timer, r.timerStart);
  assert.ok(near(cam.pitch, 0.2 - Math.sin(r.timer) * s2 * DEG), 'this frame\'s offset alone');
  assert.ok(near(cam.yaw, 1), 'axis (1,0) leaves yaw alone');
  // The following frames: healthLost 0 -> the factor is its floor, and the scalar decays with the timer.
  let n = 0;
  while (r.update(dt, cam, { healthLost: 0, healthLostPercent: 0, setting: 3 }) && n++ < 10000) { /* sway */ }
  assert.equal(r.swaying, false);
  assert.ok(r.timer <= 0);
  assert.ok(n >= 148 && n <= 152, `5*PI at 2*PI/s is 2.5 s = 150 frames, took ${n}`);
  // F-D1 (self-audit 4): PlayerMouseLook overwrites the camera's local
  // euler angles every Update (:257), so Rotate is a per-frame OFFSET -
  // when the sway ends the view is EXACTLY the mouselook's again. The
  // first cut accumulated it and its pin said so.
  r.update(dt, cam, { setting: 3 });
  assert.ok(near(cam.pitch, 0.2) && near(cam.yaw, 1), 'back to the mouselook heading');
  // rolls 0.25 -> axis (0, 1): pure yaw, turning right for a positive sin.
  const q = new CameraRecoiler(); const c2 = { yaw: 0, pitch: 0 };
  q.update(dt, c2, { healthLost: 10, healthLostPercent: 0.1, setting: 3, rolls: () => 0.25 });
  assert.ok(near(q.swayAxis[0], 0) && near(q.swayAxis[1], 1));
  assert.ok(near(c2.pitch, 0));
  const yAngle = Math.sin(q.timer) * recoilRotationScalar(3, 10, q.timer, q.timerStart);
  assert.ok(near(c2.yaw, yAngle * DEG));
});

test('AUDIT 28 W9: a second hit RESTARTS the sway (a new axis, a new timer); reset stops it', () => {
  const r = new CameraRecoiler(); const cam = { yaw: 0, pitch: 0 };
  r.update(1 / 60, cam, { healthLost: 10, healthLostPercent: 0.1, setting: 3, rolls: () => 0 });
  for (let i = 0; i < 30; i++) r.update(1 / 60, cam, { setting: 3 });
  const before = r.timer;
  r.update(1 / 60, cam, { healthLost: 30, healthLostPercent: 0.3, setting: 3, rolls: () => 0.5 });
  assert.ok(near(r.timerStart, 6 * Math.PI), 'restarted with the new percent');
  assert.ok(r.timer > before);
  assert.ok(near(r.swayAxis[0], -1), 'a new axis');
  r.reset();
  assert.equal(r.swaying, false);
  assert.equal(r.update(1 / 60, cam, { setting: 3 }), false, 'nothing to pay after a reset');
});

test('AUDIT 28 W9: the setting is the default source (ships 3), LIVE; the three player hosts run it after the look on the same paused gate; the detector exposes the percent', () => {
  resetToDefaults();
  const r = new CameraRecoiler(); const cam = { yaw: 0, pitch: 0 };
  assert.equal(r.update(1 / 60, cam, { healthLost: 10, healthLostPercent: 0.1, rolls: () => 0 }), true, 'High by default');
  setValue('Controls', 'CameraRecoilStrength', 0);
  assert.equal(new CameraRecoiler().update(1 / 60, cam, { healthLost: 10, healthLostPercent: 0.1 }), false, 'read live');
  resetToDefaults();
  assert.equal(LIVE['Controls/CameraRecoilStrength'], 'src/player/cameraRecoiler.js');
  assert.equal(typeof lastHealthLostPercent(), 'number');
  for (const [host, paused] of [['src/scenes/world.js', "townTalk.overlayActive || (modes?.overlayHeld ?? false)"], ['src/scenes/exterior.js', "townTalk.overlayActive || (modes?.overlayHeld ?? false)"], ['src/scenes/dungeon.js', 'ctx.uiOverlayActive']]) {
    const s = read(host);
    const esc = paused.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(s, new RegExp(`cameraRecoiler\\.update\\(dt, cam, \\{ healthLost: lastHealthLost\\(\\), healthLostPercent: lastHealthLostPercent\\(\\), paused: ${esc} \\}\\);`), `${host}: the recoil call`);
    assert.ok(s.indexOf('cameraRecoiler.update(dt, cam') > s.indexOf('else lookFilter.tick(dt, cam);'), `${host}: after the look`);
    assert.match(s, /const cameraRecoiler = new CameraRecoiler\(\);/, `${host}: one recoiler`);
  }
});
