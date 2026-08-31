import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HeadBobber, bobbingStyle, BOB_STYLE, BOB_SPEED, END_TIMER_MAX, BOUNCE_MAX, BOUNCE_TIMER_MAX } from '../src/player/headBobber.js';
import { WALK_STEP_INTERVAL } from '../src/systems/footsteps.js';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W10: HEAD BOBBING (HeadBobber.cs, whole). Controls/HeadBobbing
// ships True - DFU's camera bobs and nods as you walk - and the port's
// never did. The position is a local offset the motor's eye adds; the
// nod is a per-frame offset on the look, removed before re-applied.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const DEG = Math.PI / 180;
const on = { enabled: true };
const walking = (v = 2) => ({ ...on, velocity: v, moving: true });

test('AUDIT 28 W10: the constants, the style table and its priority (:41, :60-108)', () => {
  assert.ok(near(BOB_SPEED, WALK_STEP_INTERVAL / 2)); assert.equal(BOB_SPEED, 1.25);
  assert.equal(END_TIMER_MAX, 0.5); assert.equal(BOUNCE_MAX, 0.17); assert.equal(BOUNCE_TIMER_MAX, 0.10);
  assert.deepEqual([...BOB_STYLE.Walking], [0.045, 0.062, 0.25, 0.1]);
  assert.deepEqual([...BOB_STYLE.Running], [0.09, 0.11, 0.6, 0.15]);
  assert.deepEqual([...BOB_STYLE.Crouching], [0.08, 0.07, 0.5, 0.2]);
  assert.deepEqual([...BOB_STYLE.Horse], [0.03, 0.115, 0.2, 0.1]);
  assert.deepEqual([...BOB_STYLE.Swimming], [0, 0, 0, 0]);
  assert.equal(bobbingStyle({ swimming: true, running: true, crouching: true, riding: true }), 'Swimming');
  assert.equal(bobbingStyle({ running: true, crouching: true, riding: true }), 'Running');
  assert.equal(bobbingStyle({ crouching: true, riding: true }), 'Crouching');
  assert.equal(bobbingStyle({ riding: true }), 'Horse');
  assert.equal(bobbingStyle({}), 'Walking');
});

test('AUDIT 28 W10: the gates - off, dead, paused, climbing, airborne: no bob, and the look untouched', () => {
  for (const s of [{ enabled: false }, { ...on, health: 0 }, { ...on, paused: true }, { ...on, climbing: true }, { ...on, grounded: false }]) {
    const b = new HeadBobber(); const cam = { yaw: 1, pitch: 0.2 };
    assert.deepEqual(b.update(1 / 60, cam, { ...walking(), ...s }), [0, 0], JSON.stringify(s));
    assert.deepEqual(cam, { yaw: 1, pitch: 0.2 });
  }
});

test('AUDIT 28 W10: walking - the timer starts at the crest and walks at velocity * bobSpeed * dt; the path is cos/|sin|, blended from rest over the first PI', () => {
  const b = new HeadBobber(); const cam = { yaw: 0, pitch: 0 };
  assert.ok(near(b.timer, Math.PI / 2), 'the crest (:31)');
  const dt = 1 / 60, v = 2;
  b.update(dt, cam, walking(v));
  const inc = v * BOB_SPEED * dt;
  assert.ok(near(b.timer, Math.PI / 2 + inc));
  // Inside the begin transition (beginTransitionTimer <= PI) the path is lerp(rest, path, (timer % PI)/PI).
  const [bx, by] = BOB_STYLE.Walking;
  const t = (b.timer % Math.PI) / Math.PI;
  assert.ok(near(b.offset[0], Math.cos(b.timer) * bx * t));
  assert.ok(near(b.offset[1], Math.abs(Math.sin(b.timer) * by) * t));
  // Past PI of begin-timer: the raw path.
  for (let i = 0; i < 200; i++) b.update(dt, cam, walking(v));
  assert.ok(b.beginTransitionTimer > Math.PI);
  assert.ok(near(b.offset[0], Math.cos(b.timer) * bx));
  assert.ok(near(b.offset[1], Math.abs(Math.sin(b.timer) * by)));
  assert.ok(b.offset[1] >= 0, 'the rise is parabolic: |sin|');
  // Running picks the running amounts.
  b.update(dt, cam, { ...walking(v), running: true });
  assert.equal(b.style, 'Running');
  assert.ok(near(b.offset[0], Math.cos(b.timer) * BOB_STYLE.Running[0]));
});

test('AUDIT 28 W10: the nod is a per-frame OFFSET on the look - |sin|*nodX pitches down, -sin*nodY yaws - removed before the next frame\'s is applied', () => {
  const b = new HeadBobber(); const cam = { yaw: 1, pitch: 0.2 };
  for (let i = 0; i < 100; i++) b.update(1 / 60, cam, walking(3));
  const [, , nx, ny] = BOB_STYLE.Walking;
  assert.ok(near(cam.pitch, 0.2 - Math.abs(Math.sin(b.timer) * nx) * DEG), 'this frame\'s nod, and only this frame\'s');
  assert.ok(near(cam.yaw, 1 + (-Math.sin(b.timer) * ny) * DEG));
  // Turn it off: the last nod is taken back and nothing new is applied.
  b.update(1 / 60, cam, { enabled: false });
  assert.ok(near(cam.pitch, 0.2) && near(cam.yaw, 1), 'the look is exactly the mouselook again');
});

test('AUDIT 28 W10: release - a 0.5 s lerp from where the camera IS back to rest while the timer unwinds; then a reset to PI; moving again mid-stop resets the timer to PI', () => {
  const b = new HeadBobber(); const cam = { yaw: 0, pitch: 0 };
  for (let i = 0; i < 100; i++) b.update(1 / 60, cam, walking(3));
  const from = [...b.offset];
  assert.ok(from[0] !== 0 || from[1] !== 0);
  b.update(1 / 60, cam, { ...on, velocity: 3, moving: false });
  assert.ok(near(b.endTransitionTimer, 1 / 60));
  const t = (1 / 60) / END_TIMER_MAX;
  assert.ok(near(b.offset[0], from[0] * (1 - t)) && near(b.offset[1], from[1] * (1 - t)), 'lerp(camPos, rest, t)');
  // Run the stop out: endTimer passes 0.5 -> the reset branch -> timer PI, isStopping false, offset rest.
  for (let i = 0; i < 40; i++) b.update(1 / 60, cam, { ...on, velocity: 0, moving: false });
  assert.equal(b.isStopping, false);
  assert.ok(near(b.timer, Math.PI));
  assert.deepEqual(b.offset, [0, 0]);
  // Moving again DURING the stop: endTransitionTimer > 0 -> timer = PI, then the increment.
  const c = new HeadBobber(); const cam2 = { yaw: 0, pitch: 0 };
  for (let i = 0; i < 50; i++) c.update(1 / 60, cam2, walking(3));
  c.update(1 / 60, cam2, { ...on, velocity: 3, moving: false });
  assert.ok(c.endTransitionTimer > 0);
  c.update(1 / 60, cam2, walking(3));
  assert.ok(near(c.timer, Math.PI + 3 * BOB_SPEED / 60), 're-initialised at PI (:117-121)');
});

test('AUDIT 28 W10: the landing bounce arms in water and plays a 0.17 dip over 0.10 s and back (slower in water); the timer wraps at 2*PI; Mathf.Lerp clamps', () => {
  // ApplySimpleBouncing (:152-192): DFU's Update returns while airborne,
  // so readyToBounce arms only through the swimming arm - verbatim.
  const b = new HeadBobber(); const cam = { yaw: 0, pitch: 0 };
  b.update(1 / 60, cam, { ...on, swimming: true, velocity: 0, moving: false });
  assert.equal(b.readyToBounce, true, 'armed by swimming');
  // Swimming: downSpeed 0.1 -> the dip takes 1 s of frames.
  const r = b.update(1 / 60, cam, { ...on, swimming: true, velocity: 0, moving: false });
  assert.ok(near(r[1], -BOUNCE_MAX * ((1 / 60) * 0.1 / BOUNCE_TIMER_MAX)), `first dip frame ${r[1]}`);
  // Airborne then grounded (a fixture that arms it directly, as a jump would if Update ran airborne):
  const g = new HeadBobber(); const cam2 = { yaw: 0, pitch: 0 };
  g.readyToBounce = true;
  g.update(BOUNCE_TIMER_MAX, cam2, { ...on, velocity: 0, moving: false });   // one long frame = the whole dip
  assert.ok(near(g.offset[1], -BOUNCE_MAX));
  g.update(0.5, cam2, { ...on, velocity: 0, moving: false });   // overshoots the up timer - Mathf.Lerp clamps at rest
  assert.ok(near(g.offset[1], 0));
  g.update(1 / 60, cam2, { ...on, velocity: 0, moving: false });
  assert.equal(g.readyToBounce, false, 'and disarms');
  // Wrap.
  const w = new HeadBobber(); w.timer = Math.PI * 2 - 0.01;
  w.update(1, { yaw: 0, pitch: 0 }, walking(1));
  assert.equal(w.timer, 0, 'past 2*PI resets to 0');
});

test('AUDIT 28 W10: the motor\'s eye adds the world-space bob offset; the setting is live and LIVE; three hosts drive it after the recoil', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const m = new PlayerMotor(col);
  m.spawn(1, 0, 2);
  const rest = m.eye;
  m.bobOffset = [0.1, 0.2, -0.3];
  const e = m.eye;
  assert.ok(near(e[0], rest[0] + 0.1) && near(e[1], rest[1] + 0.2) && near(e[2], rest[2] - 0.3));
  resetToDefaults();
  const b = new HeadBobber(); const cam = { yaw: 0, pitch: 0 };
  b.update(1 / 60, cam, { velocity: 2, moving: true });
  assert.ok(b.offset[1] > 0, 'ships True: the bob is on by default');
  setValue('Controls', 'HeadBobbing', false);
  assert.deepEqual(new HeadBobber().update(1 / 60, cam, { velocity: 2, moving: true }), [0, 0], 'read live');
  resetToDefaults();
  assert.equal(LIVE['Controls/HeadBobbing'], 'src/player/headBobber.js');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = read(host);
    assert.match(s, /const bob = headBobber\.update\(dt, cam, \{/, `${host}: the bobber runs`);
    assert.match(s, /velocity: player\.moveSpeed \|\| 0, moving: !!\(player\.moveForward \|\| player\.moveStrafe\),/, `${host}: MoveDirection.xz and the axes`);
    assert.match(s, /player\.bobOffset = \[cy \* bob\[0\], bob\[1\], -sy \* bob\[0\]\];/, `${host}: the local right/up offset to world (HANDEDNESS: right = (cos, 0, -sin))`);
    assert.ok(s.indexOf('headBobber.update(dt, cam') > s.indexOf('cameraRecoiler.update(dt, cam'), `${host}: after the recoil`);
    assert.match(s, /const headBobber = new HeadBobber\(\);/, `${host}: one bobber`);
  }
});
