// MW-SHOULDER (FIELD BUGS 2026-10-26c, feature-feedback via Mac: "please, add an option to move camera a bit to the side
// (like in the "eye of the beholder" mod) for morrowind 3rd person models ... because crosshair is located on top of
// character's head and it is inconvenient to target something with ranged attacks"; bible/01-Overview/bugs/
// Field-Bugs-2026-10-26c.md) - THE REFERENCE'S VIEW OVER THE SHOULDER, the player's option (player/mwCamera.js).
//
// What is pinned: the reference's numbers (settings.lua:45-46, third_person.lua:27, :110-116); the focal transition,
// camera.cpp:247-294 verbatim; the shoulder's state (third_person.lua:86-127) - the chosen shoulder, the combat offset
// with a weapon or a spell out and in the water, at once on the frame third person or the option begins; the offset in
// the frame (to the strafe's right, MW units, 10 down) and the guard that keeps it off a wall (camera.cpp:177-193); the
// option off is the vanilla camera to the bit; and the wiring - the feature row, its place in Settings, the seam's one
// read of it and of the arm's stance.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createMwCamera, createFocalOffset, MW_UNITS_PER_METER, FOCAL_HEIGHT, SHOULDER_OFFSET, COMBAT_OFFSET,
  FOCAL_TRANSITION_SPEED, SHOULDER_SIDES, FOCAL_OBSTACLE_LIMIT,
} from '../../src/player/mwCamera.js';
import { FEATURES } from '../../src/systems/features.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const U = MW_UNITS_PER_METER;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const feet = [10, 0, -4];
/** A camera out of the head (one wheel notch out lands on the closest ring; three more pull it to 60 units). */
function third() {
  const c = createMwCamera();
  c.wheel(-1);
  c.wheel(-3);
  assert.equal(c.mode(), 'third');
  return c;
}
/** The focal point's offset off the vanilla focal, in MW units, along the strafe's right (cos yaw, 0, -sin yaw) and up. */
function offsetOf(eye, yaw, heightScale = 1) {
  const base = [feet[0], feet[1] + (FOCAL_HEIGHT * heightScale) / U, feet[2]];
  const d = [eye.focal[0] - base[0], eye.focal[1] - base[1], eye.focal[2] - base[2]];
  return { right: (d[0] * Math.cos(yaw) - d[2] * Math.sin(yaw)) * U, up: d[1] * U, along: (d[0] * Math.sin(yaw) + d[2] * Math.cos(yaw)) * U };
}

test('MW-SHOULDER THE REFERENCE\'S NUMBERS: the shoulder 30 right and 10 down (settings.lua:45-46), the combat offset 15 up and centred (third_person.lua:27), the transition 5 into and out of combat and 1 otherwise (:110-116), and the player\'s three sides (mutants: MW-SHOULDER-offset-moved, MW-SHOULDER-combat-centred-low)', () => {
  assert.deepEqual([...SHOULDER_OFFSET], [30, -10]);
  assert.deepEqual([...COMBAT_OFFSET], [0, 15]);
  assert.deepEqual({ ...FOCAL_TRANSITION_SPEED }, { combat: 5.0, normal: 1.0 });
  assert.deepEqual([...SHOULDER_SIDES], ['off', 'right', 'left']);
  assert.equal(FOCAL_OBSTACLE_LIMIT, 10, 'the guard\'s sphere, camera.cpp:173');
});

test('MW-SHOULDER THE FOCAL TRANSITION is camera.cpp:247-294 verbatim: a new target carries the speed the offset moved at, fading at the transition\'s speed; each frame closes dt * (1 + 5 / |delta|) * speed of the way, at most all of it; instantTransition lands on the next step; a frame of no time moves nothing (mutants: MW-SHOULDER-transition-linear, MW-SHOULDER-transition-carries-nothing, MW-SHOULDER-instant-ignored)', () => {
  const f = createFocalOffset();
  f.setTarget([30, -10]); f.instant();
  assert.deepEqual(f.step(0), [0, 0], 'no time, no step - not even the instant one (camera.cpp:256-257)');
  assert.deepEqual(f.step(1 / 60), [30, -10], 'the instant transition lands whole');
  // into combat at speed 5: the first frame the old speed (0) is carried with influence 1, so the closing term is scaled
  // by (1 - influence) after it fades by dt * 5
  f.setSpeed(FOCAL_TRANSITION_SPEED.combat);
  f.setTarget([...COMBAT_OFFSET]);
  const dt = 1 / 60, infl = 1 - dt * 5, d = Math.hypot(30, 25), k = Math.min(1, dt * (1 + 5 / d) * 5 * (1 - infl));
  const first = f.step(dt);
  assert.ok(near(first[0], 30 - 30 * k) && near(first[1], -10 + 25 * k), `the first frame: ${first} against ${[30 - 30 * k, -10 + 25 * k]}`);
  assert.ok(Math.hypot(first[0] - 30, first[1] + 10) < 1, 'eased: the first frame moves under a unit');
  // the speed it now moves at is carried into a retarget - the next frame does not stop dead
  let at = first;
  for (let i = 0; i < 6; i++) at = f.step(dt);
  const moving = [at[0] - first[0], at[1] - first[1]];
  f.setTarget([...COMBAT_OFFSET]);   // the same target again: the influence restarts with the speed it had
  const next = f.step(dt);
  assert.ok((next[0] - at[0]) * moving[0] + (next[1] - at[1]) * moving[1] > 0, 'the carried speed keeps it moving the same way');
  for (let i = 0; i < 120; i++) at = f.step(dt);
  assert.ok(near(at[0], 0, 1e-3) && near(at[1], 15, 1e-3), `combat reached within two seconds (${at})`);
});

test('MW-SHOULDER THE SHOULDER\'S STATE (third_person.lua:86-127, autoSwitchShoulder off): off, no offset; on, the chosen shoulder - the left the right\'s mirror - and the combat offset while a weapon or a spell is out or the actor swims; at once on the frame third person begins or the option changes, eased otherwise, fast into combat (mutants: MW-SHOULDER-left-not-mirrored, MW-SHOULDER-combat-ignored, MW-SHOULDER-swim-ignored, MW-SHOULDER-entry-eased, MW-SHOULDER-setting-change-eased)', () => {
  const c = third();
  const dt = 1 / 60;
  c.stepShoulder(dt, null);
  assert.deepEqual([...c.focalOffset()], [0, 0], 'off: the vanilla camera');
  assert.equal(c.shoulderState(), null);
  c.setShoulder('right');
  c.stepShoulder(dt, null);
  assert.deepEqual([...c.focalOffset()], [30, -10], 'the option turned on lands at once (updateSettings, :41)');
  assert.equal(c.shoulderState(), 'right');
  c.stepShoulder(dt, 'combat');
  assert.equal(c.shoulderState(), 'combat');
  const o = c.focalOffset();
  assert.ok(o[0] < 30 && o[0] > 20 && o[1] > -10, `into combat it eases (${o})`);
  for (let i = 0; i < 90; i++) c.stepShoulder(dt, 'combat');
  assert.ok(near(c.focalOffset()[0], 0, 0.01) && near(c.focalOffset()[1], 15, 0.01), 'centred and raised with a weapon or a spell out');
  // out of combat at speed 5 too (the old state was combat), back to the shoulder
  for (let i = 0; i < 90; i++) c.stepShoulder(dt, null);
  assert.ok(near(c.focalOffset()[0], 30, 0.01), 'back behind the shoulder');
  // the water is the combat offset at the normal speed
  c.stepShoulder(dt, 'swimming');
  assert.equal(c.shoulderState(), 'swimming');
  for (let i = 0; i < 600; i++) c.stepShoulder(dt, 'swimming');
  assert.ok(near(c.focalOffset()[0], 0, 0.01) && near(c.focalOffset()[1], 15, 0.01), 'swimming: centred and raised');
  // the left shoulder, at once on the change
  c.setShoulder('left');
  c.stepShoulder(dt, null);
  assert.deepEqual([...c.focalOffset()], [-30, -10], 'the left shoulder, the right\'s mirror, at once');
  c.setShoulder('sideways');
  assert.equal(c.shoulder(), 'off', 'anything but the three is off');
  c.stepShoulder(dt, null);
  assert.deepEqual([...c.focalOffset()], [0, 0], 'off lands at once');
  // first person, then back out: the shoulder lands at once (noThirdPersonLastFrame, :153-156)
  c.setShoulder('right');
  c.stepShoulder(dt, null);
  c.wheel(1); c.wheel(10);   // all the way in
  assert.equal(c.mode(), 'first');
  c.stepShoulder(dt, 'combat');
  c.wheel(-1);
  c.stepShoulder(dt, 'combat');
  assert.deepEqual([...c.focalOffset()], [0, 15], 'into third person with a weapon out: the combat offset at once');
});

test('MW-SHOULDER THE OFFSET IN THE FRAME: the focal point 30 units to the strafe\'s right (cos yaw, 0, -sin yaw - player/motor.js, the handedness law) and 10 down, the camera behind it along the look - the same eye shifted, the crosshair\'s ray clear of the head; the left the mirror; combat 15 over the head on the actor\'s line (mutants: MW-SHOULDER-right-is-left, MW-SHOULDER-offset-unscaled)', () => {
  const yaw = 0.7, pitch = -0.2, dt = 1 / 60;
  const plain = third().eye({ fpEye: [0, 0, 0], feet, yaw, pitch });
  const c = third();
  c.setShoulder('right'); c.stepShoulder(dt, null);
  const r = c.eye({ fpEye: [0, 0, 0], feet, yaw, pitch });
  const o = offsetOf(r, yaw);
  assert.ok(near(o.right, 30, 1e-4) && near(o.up, -10, 1e-4) && near(o.along, 0, 1e-4), `30 right, 10 down (${o.right}, ${o.up}, ${o.along})`);
  // strafe right moves the body by (cos yaw, -sin yaw) on x and z (motor.js: dx = sin*f + cos*st, dz = cos*f - sin*st)
  const strafe = [Math.cos(yaw), -Math.sin(yaw)];
  const shift = [r.eye[0] - plain.eye[0], r.eye[2] - plain.eye[2]];
  assert.ok(shift[0] * strafe[0] + shift[1] * strafe[1] > 0.4, 'the eye moved toward the strafe\'s right');
  for (let i = 0; i < 3; i++) assert.ok(near(r.eye[i] - r.focal[i], plain.eye[i] - plain.focal[i], 1e-9), 'the same distance and look behind its focal');
  c.setShoulder('left'); c.stepShoulder(dt, null);
  assert.ok(near(offsetOf(c.eye({ fpEye: [0, 0, 0], feet, yaw, pitch }), yaw).right, -30, 1e-4), 'the left: 30 to the left');
  c.stepShoulder(dt, 'combat');
  for (let i = 0; i < 90; i++) c.stepShoulder(dt, 'combat');
  const k = offsetOf(c.eye({ fpEye: [0, 0, 0], feet, yaw, pitch }), yaw);
  assert.ok(near(k.right, 0, 0.01) && near(k.up, 15, 0.01), `combat: centred, 15 over the head (${k.right}, ${k.up})`);
  // a taller race lifts the focal, never the offset
  const tall = third(); tall.setShoulder('right'); tall.stepShoulder(dt, null);
  const t = offsetOf(tall.eye({ fpEye: [0, 0, 0], feet, yaw, pitch, heightScale: 1.1 }), yaw, 1.1);
  assert.ok(near(t.right, 30, 1e-4) && near(t.up, -10, 1e-4));
});

test('MW-SHOULDER THE GUARD (camera.cpp:177-193): a sphere of 10 swept from the actor\'s line, under the focal by the ceiling\'s 10, to the offset focal point - a wall at the shoulder leaves the focal where the sphere touches it, short of the shoulder; open ground leaves it whole; with the option off the guard is the vanilla clause (mutants: MW-SHOULDER-guard-unread, MW-SHOULDER-guard-run-flat)', () => {
  const yaw = 0, pitch = 0, dt = 1 / 60;
  const c = third();
  c.setShoulder('right'); c.stepShoulder(dt, null);
  const casts = [];
  const wallAt = 12 / U;   // the sphere's centre stops 12 units along its run
  const spherecast = (o, r, d, m) => { casts.push({ o, r, d, m }); return casts.length === 1 ? wallAt : null; };
  const e = c.eye({ fpEye: [0, 0, 0], feet, yaw, pitch, spherecast });
  const g = casts[0];
  assert.ok(near(g.r, FOCAL_OBSTACLE_LIMIT / U, 1e-12), 'the focal guard\'s radius');
  const run = Math.hypot(30, 0) / U;   // x 30 right, y -10 + the ceiling's 10 = 0
  assert.ok(near(g.m, run, 1e-9), `its run: the offset with the ceiling's 10 (${g.m * U})`);
  assert.ok(near(g.o[1], feet[1] + (FOCAL_HEIGHT - 10) / U, 1e-9), 'from the actor\'s line, 10 under the focal');
  const o = offsetOf(e, yaw);
  assert.ok(near(o.right, 12, 1e-4) && near(o.up, -10, 1e-4), `left where the sphere touched (${o.right}, ${o.up})`);
  // open ground: whole
  const open = c.eye({ fpEye: [0, 0, 0], feet, yaw, pitch, spherecast: () => null });
  assert.ok(near(offsetOf(open, yaw).right, 30, 1e-4));
  // off: the vanilla clause - a cast straight up from 10 under the focal, 20 long
  const v = third(); v.stepShoulder(dt, null);
  const vc = [];
  v.eye({ fpEye: [0, 0, 0], feet, yaw, pitch, spherecast: (o2, r, d, m) => { vc.push({ d, m }); return null; } });
  assert.deepEqual(vc[0].d, [0, 1, 0]);
  assert.ok(near(vc[0].m, 20 / U, 1e-12));
});

test('MW-SHOULDER OFF IS THE VANILLA CAMERA TO THE BIT: no offset, no cast of its own - the eye, the focal and the distance a camera that never heard of the option gives (mutants: MW-SHOULDER-offset-always)', () => {
  const a = third(), b = third();
  b.setShoulder('off'); b.stepShoulder(1 / 60, 'combat');
  const args = { fpEye: [0, 0, 0], feet, yaw: 1.3, pitch: 0.4, spherecast: (o, r, d, m) => m * 0.75 };
  assert.deepEqual(b.eye(args), a.eye(args));
});

test('MW-SHOULDER THE WIRING: the feature row (off by default, Off / Right / Left, the viewer\'s), its place in Settings beside Eye Of The Beholder, and the seam - player/mwView.js sets the side from the pref and steps the shoulder on the arm\'s stance once a frame before the eye, for all four hosts; the arm answers third_person.lua\'s two questions (mutants: MW-SHOULDER-pref-unread, MW-SHOULDER-stance-unread, MW-SHOULDER-sheathed-is-combat)', () => {
  const row = FEATURES.find((f) => f.id === 'mw-shoulder-camera');
  assert.ok(row, 'the row');
  assert.equal(row.control.store, 'prefs');
  assert.equal(row.control.key, 'mwShoulderCam');
  assert.equal(row.control.initial, 'off', 'off, as the reference ships it (settings.lua:44)');
  assert.equal(row.control.online, 'player');
  assert.deepEqual(row.control.tiers.map((t) => t[0]), ['off', 'right', 'left']);
  assert.match(rd('src/ui/settings/settingsMap.js'), /sec\('camera', 'Camera', \['feat:mw-shoulder-camera', 'feat:mod-eye-of-the-beholder'\]\)/);
  const view = rd('src/player/mwView.js');
  const set = view.indexOf("mwCamera.setShoulder(getPref('mwShoulderCam'));");
  const step = view.indexOf('mwCamera.stepShoulder(state.dt ?? 0, fpArm.shoulderStance());');
  const eye = view.indexOf('const eye = mwCamera.eye({ fpEye, feet, yaw, pitch, heightScale, raycast, spherecast, pivotFloor });');
  assert.ok(set > 0 && step > set && eye > step, 'the side, the step, then the eye');
  const arm = rd('src/combat/fpArm.js');
  assert.match(arm, /shoulderStance: \(\) => \(spellReady \|\| !sheathed \? 'combat' : camera\?\.\(\)\?\.move\?\.swimming \? 'swimming' : null\),/);
});
