// RIDE-FEEL (2026-10-16, the owner: "The morrowind horse in first person also needs a better screen animation"):
// player/rideFeel.js's law - the eye rides the horse's back, the horse turns under the rider and banks into a turn -
// and player/mwView.js's wiring of it into the first-person saddle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  freshRide, stepRide, rideEye, leanModel, wrapPi, RIDE_BACK_FOLLOW, RIDE_BOB_CLEAR, RIDE_BOB_REACH, RIDE_TURN_TAU, RIDE_TURN_MAX,
  RIDE_CRAB_FROM, RIDE_CRAB_FULL, RIDE_CRAB_MAX, RIDE_CRAB_REACH, RIDE_BANK_SHARE, RIDE_BANK_MAX, RIDE_BANK_TAU,
} from '../src/player/rideFeel.js';
import { identity, transformPoint } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DEG = Math.PI / 180;
const run = (frames, f) => { let r = freshRide(); r = stepRide(r, { yaw: 0, dt: 1 / 60 }); for (let k = 0; k < frames; k++) r = stepRide(r, f(k, r)); return r; };

test('RIDE-FEEL the numbers: the eye takes most of the back\'s stride; the turn\'s ease, its lag and its crab; the bank half a turning body\'s lean, capped (mutants: a number moved)', () => {
  assert.deepEqual([RIDE_BACK_FOLLOW, RIDE_BOB_CLEAR, RIDE_BOB_REACH, RIDE_TURN_TAU, RIDE_CRAB_FROM, RIDE_CRAB_FULL, RIDE_BANK_SHARE, RIDE_BANK_TAU], [0.85, 0.18, 0.3, 0.2, 0.4, 2, 0.5, 0.25]);
  assert.deepEqual([RIDE_TURN_MAX, RIDE_CRAB_MAX, RIDE_CRAB_REACH, RIDE_BANK_MAX].map((v) => +(v / DEG).toFixed(9)), [35, 30, 100, 7]);
  assert.ok(RIDE_BOB_CLEAR > 0.14, 'HeadBobber\'s Running style (0.09 across, 0.11 up) is still the saddle\'s eye');
  assert.equal(wrapPi(Math.PI), Math.PI); assert.equal(wrapPi(-Math.PI), Math.PI); assert.ok(Math.abs(wrapPi(3 * Math.PI / 2) + Math.PI / 2) < 1e-12);
});

test('RIDE-FEEL the horse turns under the rider: the first step takes the view\'s heading; a turn of the view leaves it behind - never past RIDE_TURN_MAX - and it comes round within a second; standing still it turns too (mutants: the ease dropped, the lag uncapped, the first step not taken)', () => {
  assert.deepEqual(stepRide(freshRide(), { yaw: 2, dt: 1 / 60 }), { yaw: 2, bank: 0, rate: 0 });
  // a snap of the view by 90 degrees, standing
  let r = stepRide(freshRide(), { yaw: 0, dt: 1 / 60 });
  r = stepRide(r, { yaw: Math.PI / 2, dt: 1 / 60 });
  assert.ok(Math.abs(wrapPi(Math.PI / 2 - r.yaw) - RIDE_TURN_MAX) < 1e-9, `held RIDE_TURN_MAX behind (${r.yaw / DEG})`);
  for (let k = 0; k < 60; k++) r = stepRide(r, { yaw: Math.PI / 2, dt: 1 / 60 });
  assert.ok(Math.abs(r.yaw - Math.PI / 2) < 0.01, `round in a second (${r.yaw / DEG})`);
  // a steady turn: behind, by about the rate times the ease
  const t = run(60, (k) => ({ yaw: 0.02 * (k + 1), dt: 1 / 60 }));
  const behind = wrapPi(0.02 * 60 - t.yaw);
  assert.ok(behind > 0.15 && behind < 0.3, `a steady 1.2 rad/s turn leaves it ${behind / DEG} degrees behind`);
  assert.ok(t.rate > 1.1 && t.rate < 1.25, `turning at the view's rate (${t.rate})`);
  // across the seam at pi
  let s = stepRide(freshRide(), { yaw: 3.1, dt: 1 / 60 });
  for (let k = 0; k < 60; k++) { s = stepRide(s, { yaw: -3.1, dt: 1 / 60 }); assert.ok(Math.abs(s.yaw) > 3, `the short way round the seam (${s.yaw})`); }
  assert.ok(Math.abs(wrapPi(s.yaw + 3.1)) < 1e-3, 'and there');
});

test('RIDE-FEEL the crab: at a pace the heading bends toward the way the feet go - a strafe walks it crabwise, never past RIDE_CRAB_MAX; at a stand, or backing up, it does not (mutants: the crab uncapped, the pace unread, backing turned)', () => {
  const strafe = (speed, travel) => run(120, () => ({ yaw: 0, travel, speed, dt: 1 / 60 })).yaw;
  assert.ok(Math.abs(strafe(5, Math.PI / 2) - RIDE_CRAB_MAX) < 1e-3, `a full-pace strafe right: crabwise by RIDE_CRAB_MAX (${strafe(5, Math.PI / 2) / DEG})`);
  assert.ok(Math.abs(strafe(5, 0.2) - 0.2) < 1e-3, 'a small bend followed whole');
  assert.equal(strafe(0.3, Math.PI / 2), 0, 'under RIDE_CRAB_FROM: straight');
  const half = (RIDE_CRAB_FROM + RIDE_CRAB_FULL) / 2;
  assert.ok(Math.abs(strafe(half, Math.PI / 2) - RIDE_CRAB_MAX / 2) < 1e-3, 'half the pace, half the bend');
  assert.equal(strafe(5, Math.PI), 0, 'backing up turns no horse');
  assert.ok(Math.abs(strafe(5, -Math.PI / 2) + RIDE_CRAB_MAX) < 1e-3, 'a strafe left, the other way');
});

test('RIDE-FEEL the bank: into the turn - a right turn leans the top right - half a turning body\'s lean at that pace, never past RIDE_BANK_MAX, eased; none at a stand or going straight (mutants: the sign, the cap, the pace unread)', () => {
  const turning = (speed, rate) => run(120, (k) => ({ yaw: rate * (k + 1) / 60, travel: rate * (k + 1) / 60, speed, dt: 1 / 60 }));
  const slow = turning(4, 0.3);
  const want = Math.atan((4 * slow.rate) / 9.81) * RIDE_BANK_SHARE;
  assert.ok(slow.bank > 0 && Math.abs(slow.bank - want) < 0.01, `a right turn at 4 m/s leans right by ${slow.bank / DEG} (want ${want / DEG})`);
  assert.ok(turning(4, -0.3).bank < 0, 'a left turn, left');
  const hard = turning(10.8, 1.2).bank;
  assert.ok(hard <= RIDE_BANK_MAX && RIDE_BANK_MAX - hard < 1e-3, `a gallop's hard turn: capped (${hard / DEG})`);
  assert.equal(turning(0, 1.2).bank, 0, 'turning on the spot: upright');
  assert.equal(run(60, () => ({ yaw: 0, travel: 0, speed: 10, dt: 1 / 60 })).bank, 0, 'straight: upright');
  let r = turning(10.8, 1.2);
  r = stepRide(r, { yaw: r.yaw, travel: r.yaw, speed: 10.8, dt: 1 / 60 });
  assert.ok(r.bank > 0 && r.bank < RIDE_BANK_MAX, 'eased out, not dropped');
});

test('RIDE-FEEL leanModel: the model leant about its forward axis through the saddle - the pivot stands, the top goes right for a positive bank, at any heading; level is the model itself (mutants: the sign, the pivot)', () => {
  const I = identity();
  assert.equal(leanModel(I, 0, 1, [1, 2, 3]), I);
  for (const yaw of [0, 1, -2.5]) {
    const pivot = [3, 1.7, -2], m = leanModel(I, 0.1, yaw, pivot);
    const p = transformPoint(m, ...pivot);
    assert.ok(Math.hypot(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]) < 1e-6, 'the saddle stands');
    const top = transformPoint(m, pivot[0], pivot[1] + 1, pivot[2]);
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const across = (top[0] - pivot[0]) * right[0] + (top[2] - pivot[2]) * right[2];
    assert.ok(Math.abs(across - Math.sin(0.1)) < 1e-6, `yaw ${yaw}: the top to the right by sin(bank) (${across})`);
    const ahead = (top[0] - pivot[0]) * Math.sin(yaw) + (top[2] - pivot[2]) * Math.cos(yaw);
    assert.ok(Math.abs(ahead) < 1e-6, 'about the forward axis: no pitch');
  }
});

test('RIDE-FEEL rideEye: HeadBobber\'s offset out of the eye, the saddle\'s rise and sway in at RIDE_BACK_FOLLOW; an eye that is not the saddle\'s (mounting, swimming) handed back, blended between (mutants: the bob kept, the follow whole, the guard dropped)', () => {
  const feet = [10, 5, -3], yaw = 0.7, H = 2.51, rest = 1.68;
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const bobbed = [feet[0] + right[0] * 0.03, feet[1] + H + 0.1, feet[2] + right[2] * 0.03];   // HeadBobber's Horse style at its height
  const restSeat = [feet[0], feet[1] + rest, feet[2]];
  assert.deepEqual(rideEye(bobbed, feet, H, yaw, restSeat, rest).map((v) => +v.toFixed(9)), [feet[0], feet[1] + H, feet[2]].map((v) => +v.toFixed(9)), 'the seat at rest: the saddle\'s eye, no bob');
  const risen = [feet[0] + right[0] * 0.04, feet[1] + rest + 0.08, feet[2] + right[2] * 0.04];
  const e = rideEye(bobbed, feet, H, yaw, risen, rest);
  assert.ok(Math.abs(e[1] - (feet[1] + H + 0.08 * RIDE_BACK_FOLLOW)) < 1e-9, 'up with the back');
  const side = (e[0] - feet[0]) * right[0] + (e[2] - feet[2]) * right[2];
  assert.ok(Math.abs(side - 0.04 * RIDE_BACK_FOLLOW) < 1e-9, 'over with its sway');
  const mounting = [feet[0], feet[1] + 1.6, feet[2]];   // the eye still rising to the saddle
  assert.deepEqual(rideEye(mounting, feet, H, yaw, risen, rest), mounting, 'not the saddle\'s eye: as it came');
  const mid = [feet[0], feet[1] + H + (RIDE_BOB_CLEAR + RIDE_BOB_REACH) / 2, feet[2]];
  const m = rideEye(mid, feet, H, yaw, restSeat, rest);
  assert.ok(Math.abs(m[1] - (mid[1] + (feet[1] + H - mid[1]) * 0.5)) < 1e-9, 'half way out of the guard: half way');
});

test('RIDE-FEEL wired (player/mwView.js): the ride stepped with the horse off the feet\'s travel, the first-person eye the back\'s, the first-person horse at the ride\'s heading leant about its seat; the ride let go with the horse (mutants: each wire cut)', () => {
  const src = rd('src/player/mwView.js');
  assert.match(src, /ride = stepRide\(ride, \{ yaw, travel, speed: groundSpeed, dt \}\);/);
  assert.match(src, /if \(v > 0\.05 && v < HORSE_TELEPORT\) travel = Math\.atan2\(feet\[0\] - lastFeet\[0\], feet\[2\] - lastFeet\[2\]\);/);
  assert.match(src, /if \(saddled && ownSaddle && !eye\.thirdPerson && fpEye && ground\) eye\.eye = rideEye\(fpEye, ground, RIDE_EYE_HEIGHT, yaw, ownSaddle\.seat, HORSE_SEAT\[2\]\);/);
  assert.match(src, /const ground = feet;[^\n]*\n\s*if \(saddled && ownSaddle\) feet = /, 'the ground\'s feet, before the third person\'s lift');
  assert.match(src, /const heading = ride\.yaw \?\? lastCamera\.yaw;\n\s*horseRig\.place\(ownHorse, horseFeetUnder\(lastCamera\.feet, heading\), heading\);/);
  assert.match(src, /if \(seat\) ownHorse\.model = leanModel\(ownHorse\.model, ride\.bank, heading, seat\);\n\s*return horseRig\.drawFirstPerson\(ownHorse, canvas, lastCamera\);/);
  assert.match(src, /ownHorse = null; ownSaddle = null; lastFeet = null; groundSpeed = 0; ride = freshRide\(\);/);
});
