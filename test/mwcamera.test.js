// MW-D25: the Morrowind camera machine, pinned against the reference's
// own numbers and sentences:
//   camera.cpp (apps/openmw/mwrender)        - position/mode machine
//   camera.lua (files/data/scripts/omw/camera) - the zoom law
//   third_person.lua                          - the distance law
//   actionbindings.lua (omw/input)            - the wheel's units
//   constants.hpp:10                          - UnitsPerMeter
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createMwCamera, mwCamera,
  MW_UNITS_PER_METER, FOCAL_HEIGHT, BASE_DISTANCE, MIN_DISTANCE, MAX_DISTANCE,
  WHEEL_STEP, CAMERA_OBSTACLE_LIMIT, FOCAL_OBSTACLE_LIMIT,
} from '../src/player/mwCamera.js';

test('MW-D25: the constants are the reference\'s own numbers', () => {
  // constants.hpp:10
  assert.equal(MW_UNITS_PER_METER, 69.99125109);
  // camera.cpp:63
  assert.equal(FOCAL_HEIGHT, 124);
  // third_person.lua:16
  assert.equal(BASE_DISTANCE, 192);
  // camera.lua:137
  assert.equal(MIN_DISTANCE, 30);
  // settings.lua:43
  assert.equal(MAX_DISTANCE, 800);
  // actionbindings.lua:106
  assert.equal(WHEEL_STEP, 10);
  // camera.cpp:172-173
  assert.equal(CAMERA_OBSTACLE_LIMIT, 5);
  assert.equal(FOCAL_OBSTACLE_LIMIT, 10);
});

test('MW-D25: the camera boots in first person and the eye is the host\'s own', () => {
  // camera.cpp:58 - mFirstPersonView(true); camera.cpp:165-169 - first
  // person leaves the position to the tracked node and zeroes distance.
  const cam = createMwCamera();
  assert.equal(cam.mode(), 'first');
  const fpEye = [3, 1.7, -2];
  const r = cam.eye({ fpEye, feet: [3, 0, -2], yaw: 0.4, pitch: -0.2 });
  assert.deepEqual(r.eye, fpEye);
  assert.equal(r.thirdPerson, false);
  assert.equal(cam.cameraDistance(), 0);
});

test('MW-D25: wheel-down leaves the head onto the CLOSEST ring, not the remembered one', () => {
  // camera.lua:155-158 - primaryMode = ThirdPerson; baseDistance = minDistance.
  const cam = createMwCamera();
  cam.wheel(-1);
  assert.equal(cam.mode(), 'third');
  assert.equal(cam.baseDistance(), MIN_DISTANCE);
  // and wheel-up from that ring goes straight back in (camera.lua:147-150)
  cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });   // settle cameraDistance
  cam.wheel(1);
  assert.equal(cam.mode(), 'first');
});

test('MW-D25: the zoom ladder walks 10 units a click between 30 and 800', () => {
  // camera.lua:151-153 - baseDistance = clamp(base - delta - obstacleDelta, 30, 800)
  // with delta = clicks*10 (actionbindings.lua:106).
  const cam = createMwCamera();
  cam.wheel(-1);                     // -> third at 30
  const settle = () => cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  settle();
  cam.wheel(-1); assert.equal(cam.baseDistance(), 40);
  settle();
  cam.wheel(-3); assert.equal(cam.baseDistance(), 70);
  // clamp at the far end (settings.lua:43)
  settle();
  cam.wheel(-200); assert.equal(cam.baseDistance(), MAX_DISTANCE);
  // and back down to the closest ring, never past it while > MIN
  settle();
  cam.wheel(77); assert.equal(cam.baseDistance(), MIN_DISTANCE);
  assert.equal(cam.mode(), 'third');   // the clamp landed ON 30, not through it
  settle();
  cam.wheel(1); assert.equal(cam.mode(), 'first');
});

test('MW-D25: a wall-pinned camera zooms from where it actually is, and out-zoom is pinned with it', () => {
  const cam = createMwCamera();
  cam.wheel(-1);   // third at 30
  const settle = (rc) => cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, raycast: rc });
  settle();
  cam.wheel(-20);  // out to 230
  assert.equal(cam.baseDistance(), 230);
  // A wall 1m behind the focal: the eye pulls in to 1m minus the
  // 5-unit clearance (camera.cpp:200-206)...
  const wall = () => 1.0;
  const r = settle(wall);
  const u = 1 / MW_UNITS_PER_METER;
  assert.ok(Math.abs(r.distance - (1.0 - CAMERA_OBSTACLE_LIMIT * u)) < 1e-9,
    `pulled-in distance backs off the clearance (${r.distance})`);
  const actual = cam.cameraDistance();
  assert.ok(actual < 70 && actual > 60, `actual distance is the pinned one in MW units (${actual})`);
  // ...zooming OUT while pinned is a no-op (camera.lua:151 - the
  // obstacleDelta gate)...
  cam.wheel(-1);
  assert.equal(cam.baseDistance(), 230);
  // ...and zooming IN subtracts the obstacle debt, so one click brings
  // the base to ten units inside the camera's REAL ring (camera.lua:152).
  cam.wheel(1);
  assert.ok(Math.abs(cam.baseDistance() - (actual - WHEEL_STEP)) < 1e-9,
    `base caught up to the pinned camera (${cam.baseDistance()} vs actual ${actual})`);
});

test('MW-D25: the third-person eye is the reference equation in the port\'s meters', () => {
  // camera.cpp:96-97 (focal = tracked + 124*scale up), :196-208
  // (eye = focal + orient*(0,-dist,0)), through constants.hpp:10.
  const cam = createMwCamera();
  cam.wheel(-1);
  const settle = () => cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  settle();
  cam.wheel(-17);   // 30 + 170 -> 200... clamp path: 30->40->... single call: 30+170=200
  const u = 1 / MW_UNITS_PER_METER;
  const feet = [10, 2, -4];
  const yaw = Math.PI / 3; const pitch = 0.3;
  const r = cam.eye({ fpEye: [0, 0, 0], feet, yaw, pitch, heightScale: 1 });
  const focalY = 2 + FOCAL_HEIGHT * u;
  assert.ok(Math.abs(r.focal[1] - focalY) < 1e-9, `focal rides 124 units above the feet (${r.focal[1]})`);
  const dist = 200 * u;
  const cp = Math.cos(pitch);
  const fwd = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(r.eye[i] - (r.focal[i] - fwd[i] * dist)) < 1e-9,
      `eye axis ${i} sits the full distance behind the focal along the pitched forward`);
  }
  // the eye is BEHIND and (looking down-range) the focal is dead centre:
  // looking along fwd from the eye for `dist` lands exactly on the focal -
  // vanilla's centered camera (settings.lua:44 viewOverShoulder false).
  assert.ok(Math.abs((r.eye[0] + fwd[0] * dist) - r.focal[0]) < 1e-9);
});

test('MW-D25: the focal keeps ten units of ceiling clearance and drops at most its own offset', () => {
  // camera.cpp:177-193 with the default zero focal offset: only the +10
  // ceiling term (camera.cpp:180) survives, and adjustmentCoef clamps
  // at -1 so the drop never exceeds the offset length.
  const cam = createMwCamera();
  cam.wheel(-1);
  const u = 1 / MW_UNITS_PER_METER;
  const feet = [0, 0, 0];
  const focalY = FOCAL_HEIGHT * u;
  // ceiling exactly AT the unguarded focal: the focal must sit 10 units
  // beneath it.
  const lowCeiling = (origin, dir) => (dir[1] > 0 ? (focalY - origin[1]) : null);
  const r = cam.eye({ fpEye: [0, 0, 0], feet, yaw: 0, pitch: 0, raycast: lowCeiling });
  assert.ok(Math.abs(r.focal[1] - (focalY - FOCAL_OBSTACLE_LIMIT * u)) < 1e-9,
    `focal dropped to ten units under the ceiling (${r.focal[1]})`);
  // a ceiling far above leaves the focal alone
  const highCeiling = () => null;
  const r2 = cam.eye({ fpEye: [0, 0, 0], feet, yaw: 0, pitch: 0, raycast: highCeiling });
  assert.ok(Math.abs(r2.focal[1] - focalY) < 1e-9, 'an open sky leaves the focal at 124');
});

test('MW-D25: a view change while the upper body is busy QUEUES, and lands when ready', () => {
  // camera.cpp:225-232 ("queue the view change for later") resolved by
  // camera.cpp:135 on the next update once upperBodyReady.
  const cam = createMwCamera();
  cam.wheel(-1, { ready: false });
  assert.equal(cam.mode(), 'first', 'the crossing waits');
  assert.equal(cam.queued(), false, 'queued target is third person');
  cam.update({ ready: false });
  assert.equal(cam.mode(), 'first', 'still waiting');
  cam.update({ ready: true });
  assert.equal(cam.mode(), 'third', 'the queued change lands');
  assert.equal(cam.queued(), null);
  // distance zoom inside third person never queues - it is not a view
  // change (only the FP boundary stops animations, camera.cpp:225).
  cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  cam.wheel(-2, { ready: false });
  assert.equal(cam.baseDistance(), 50);
});

test('MW-D25: state round-trips and restore clamps', () => {
  // Both halves persist: the distance through camera.lua:347-352's
  // onSave, the first/third flag in the REC_CAM_ savegame record
  // (worldimp.cpp:425-427, force-applied at statemanagerimp.cpp:617-618).
  const cam = createMwCamera();
  cam.wheel(-1);
  cam.eye({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  cam.wheel(-5);
  const s = cam.state();
  const cam2 = createMwCamera();
  cam2.restore(s);
  assert.equal(cam2.mode(), 'third');
  assert.equal(cam2.baseDistance(), 80);
  cam2.restore({ firstPerson: false, baseDistance: 99999 });
  assert.equal(cam2.baseDistance(), MAX_DISTANCE);
});

test('MW-D25: one live instance is exported for the hosts, and the module keeps the reference\'s sentences', () => {
  assert.equal(typeof mwCamera.wheel, 'function');
  const src = readFileSync(new URL('../src/player/mwCamera.js', import.meta.url), 'utf8');
  // The zoom law's two gates must stay the reference's own, not a
  // simplification: the min-ring switch and the obstacle-debt gate.
  assert.ok(/baseDistance === MIN_DISTANCE/.test(src), 'the min-ring FP switch gate');
  assert.ok(/obstacleDelta < -delta/.test(src), 'the obstacle-debt out-zoom gate (camera.lua:151)');
  // The bridge literal is MINTED in the format layer (one home) and
  // re-exported here; both facts are load-bearing.
  const fmt = readFileSync(new URL('../src/formats/mwFirstPerson.js', import.meta.url), 'utf8');
  assert.ok(/69\.99125109/.test(fmt), 'the unit bridge literal lives in the format layer');
  assert.ok(!/69\.99125109/.test(src), 'and is not restated here - one home');
});

// ── MW-D25: THE VIEW SYNC's no-data law, on the live singletons ─────
import { mwViewWheel, mwViewFrame } from '../src/player/mwView.js';

test('MW-D25: with no Morrowind body the wheel cannot leave first person, and the eye passes through', () => {
  // A player with no data (or a refused body) has no third person: the
  // wheel does nothing rather than pulling the eye out of an invisible
  // head, and the frame's eye is the host's own.
  assert.equal(mwViewWheel(+120), false, 'scroll-down (leave the head) refuses without a body');
  const fpEye = [1, 1.7, 2];
  const r = mwViewFrame({ fpEye, feet: [1, 0, 2], yaw: 0.3, pitch: -0.1 });
  assert.equal(r.thirdPerson, false);
  assert.deepEqual(r.eye, fpEye);
  assert.equal(mwCamera.mode(), 'first', 'the live camera stayed in the view that exists');
});

// ── MW-D30: PERSISTENCE, THE FRAME-ACCUMULATED WHEEL, THE REAL CLAMP ─

import { PITCH_LIMIT } from '../src/player/mwCamera.js';
import { mwViewPendingClicks, mwViewFrame as mwvf } from '../src/player/mwView.js';

test('MW-D30: the pitch clamp is the reference\'s own, and every host rides it', () => {
  // camera.cpp:323-331 - +/-(PI/2 - 0.000001f). The hand-rolled +/-1.5
  // stopped the look ~4 degrees short of vertical.
  assert.equal(PITCH_LIMIT, Math.PI / 2 - 0.000001);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js']) {
    const src = readFileSync(new URL(`../${host}`, import.meta.url), 'utf8');
    assert.ok(!/Math\.max\(-1\.5, Math\.min\(1\.5,/.test(src), `${host} clamps at PITCH_LIMIT, not 1.5`);
    assert.ok(/PITCH_LIMIT/.test(src), `${host} imports the one clamp`);
  }
});

test('MW-D30: wheel clicks ACCUMULATE and flush once per frame', () => {
  // actionbindings.lua:98-115 - every press sums into zoomInOut and
  // zoom() runs ONCE per frame on the total; the port's DOM events do
  // the same through the pending count.
  assert.equal(mwViewPendingClicks(), 0);
  assert.equal(mwViewWheel(-120), true, 'wheel-up queues even in first person');
  mwViewWheel(-120); mwViewWheel(-120);
  assert.equal(mwViewPendingClicks(), 3, 'three notches, one pending sum');
  mwvf({ fpEye: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  assert.equal(mwViewPendingClicks(), 0, 'the frame flushed them in one zoom() call');
  assert.equal(mwCamera.mode(), 'first', 'zoom-in inside the head is the reference no-op');
});

test('MW-D30: the pose carries the camera and the load FORCES it', () => {
  // worldimp.cpp:425-427 saves the flag; statemanagerimp.cpp:617-618
  // togglePOVs the live camera to match on load; camera.lua:347-352
  // rides the distance. The port's one pose-apply does both through
  // mwCamera.restore, and a pose without a camera (older save, the
  // classic import) leaves the live camera standing.
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(/camera: mwCamera\.state\(\) \}/.test(src), 'the saved pose carries mwCamera.state()');
  assert.ok(/mwCamera\.restore\(pose\.camera\);/.test(src), 'and the one pose-apply restores it');
  // restore(undefined) is the older-save no-op, behaviorally:
  const cam = createMwCamera();
  cam.wheel(-1);
  cam.restore(undefined);
  assert.equal(cam.mode(), 'third', 'a pose without a camera leaves the live camera standing');
});

test('MW-D34: the focal height rides the race HEIGHT through the one seam', () => {
  // adjustScale's z (npc.cpp:1127/1134) scales the actor the camera
  // tracks, so the third-person focal height scales with it. The
  // answer comes from the rig itself, in mwViewFrame - the hosts stay
  // out of the seam (MW-D25's law) and a caller may still pass an
  // explicit value.
  const view = readFileSync(new URL('../src/player/mwView.js', import.meta.url), 'utf8');
  assert.match(view, /heightScale = null/, 'the default is "ask the rig", not 1');
  assert.match(view, /if \(heightScale == null\) heightScale = fpArm\.raceHeightScale\(\);/);
  const arm = readFileSync(new URL('../src/combat/fpArm.js', import.meta.url), 'utf8');
  assert.match(arm, /raceHeightScale: \(\) => \(built && built\.ok && built\.raceScale \? built\.raceScale\.height : 1\)/,
    'and the rig answers its race height, 1 unbuilt');
  // The camera really multiplies it into the focal (mwCamera.js).
  const cam = readFileSync(new URL('../src/player/mwCamera.js', import.meta.url), 'utf8');
  assert.match(cam, /FOCAL_HEIGHT \* heightScale \* u/);
});
