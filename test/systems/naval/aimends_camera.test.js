// AIM-ENDS (2026-10-24, Discord - "Aiming front ship cannons impossible": "the camera should move to the front/back
// accordingly when aiming") - THE AIM CAMERA OVER THE BOW AND THE STERN, alone: scenes/naval/aimCamera.js on a stand-in
// boat, so the walk out past her own canvas is pinned on a sail that stands where the eye was asked to (the galleon's
// and the carrack's stand clear of theirs - test/systems/naval/navaudit_helm.test.js H8 pins the galleon at the helm).
// The law is bible/03-World/Naval-Combat.md AIM-ENDS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAimCamera, reachAlong, AIM_CAM_AHEAD, AIM_CAM_UP, AIM_CAM_CLEAR, AIM_CAM_OUT, AIM_CAM_TAU } from '../../../src/scenes/naval/aimCamera.js';
import { fallArc, segmentBoxEntry } from '../../../src/systems/naval/navalBallistics.js';
import { HULL, batteryOf } from '../../../src/systems/naval/navalShips.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const ID = [0, 0, 0, 1];
/** An axis-aligned box as the naval boxes are shaped: its middle, its unit axes, its half sizes. */
const box = (c, h) => ({ c, ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h });
const centre = (side) => {
  const m = batteryOf(HULL.SmallShip, side).muzzles;
  return m.reduce((s, p) => [s[0] + p[0] / m.length, s[1] + p[1] / m.length, s[2] + p[2] / m.length], [0, 0, 0]);
};
/** The camera on a galleon at the origin, facing north, with `side` laid and `rig` her canvas. */
function camera({ side = 'bow', rig = [], hull = null, alongside = [], wrecked = false, on = true, pose = null } = {}) {
  const boat = { hull: HULL.SmallShip };
  const state = { aiming: true, aim: { side } };
  const cam = createAimCamera({
    setting: (k, d) => (k === 'AimCamera' ? on : d), aiming: () => state.aiming, aim: () => state.aim, boat: () => boat,
    wrecked: () => wrecked, pose: pose ?? (() => ({ position: [0, 0, 0], rotation: ID })), hull: () => hull, rig: () => rig, alongside: () => alongside,
  });
  const settle = (own = [0, 5, 0]) => { let e = own; for (let i = 0; i < 80; i++) e = cam.eye(own, 0.1); return e; };
  return { cam, state, settle };
}

test('AIM-ENDS the ends: with the bow chasers laid the eye stands AIM_CAM_UP over them and AIM_CAM_AHEAD ahead along her keel; with the stern\'s barrels, straight over the rail they roll from - never at the broadside\'s place out over her side (mutants: the ends at the broadside\'s place, the ahead turned aft, the stern astern of its mark)', () => {
  const c = centre('bow');
  const bow = camera().settle();
  for (let i = 0; i < 3; i++) near(bow[i], [c[0], c[1] + AIM_CAM_UP, c[2] + AIM_CAM_AHEAD][i], 1e-6, 'over the bow');
  const s = centre('stern');
  const stern = camera({ side: 'stern' }).settle();
  for (let i = 0; i < 3; i++) near(stern[i], [s[0], s[1] + AIM_CAM_UP, s[2]][i], 1e-6, 'over the stern rail (AUDIT AIM-ENDS A1: the barrel\'s mark 1.5 m astern, under the eye)');
  const b = centre('starboard');
  const broad = camera({ side: 'starboard' }).settle();
  near(broad[0], b[0] + AIM_CAM_OUT, 1e-6, 'a broadside still out over her side');
});

test('AUDIT AIM-ENDS A2/A4 all of her: over the bow the eye stands AIM_CAM_CLEAR past the furthest any box of hers reaches along her keel - her hull (a galley\'s prow 6 m past her guns), a sail set over her bowsprit - when that is further than AIM_CAM_AHEAD; never sideways or up; over the stern it lifts AIM_CAM_CLEAR over any of her it would stand in (mutants: her reach unread; the clearance dropped; the lift unread; the lift over the first box alone)', () => {
  const c = centre('bow');
  const want = [c[0], c[1] + AIM_CAM_UP, c[2] + AIM_CAM_AHEAD];
  const prow = box([0, 2, want[2] - 3], [3, 6, 5]);   // her hull, its stem 2 m past where the eye was asked to stand
  const jib = box([0, want[1] - 2, want[2] + 2], [0.5, 0.5, 4]);   // canvas over her bowsprit, 6 m past it, under the eye
  const eye = camera({ hull: prow, rig: [jib] }).settle();
  near(eye[0], want[0], 1e-9, 'not sideways');
  near(eye[1], want[1], 1e-9, 'not up');
  near(eye[2], reachAlong(jib, [0, 0, 1]) + AIM_CAM_CLEAR, 1e-9, 'AIM_CAM_CLEAR past the furthest of her');
  near(reachAlong(jib, [0, 0, 1]), want[2] + 6, 1e-12, 'a box\'s reach along a way');
  const short = camera({ hull: box([0, 2, 0], [3, 6, 5]) }).settle();
  near(short[2], want[2], 1e-9, 'all of her short of AIM_CAM_AHEAD: AIM_CAM_AHEAD it is');
  const s = centre('stern');
  const castle = box([0, 5, s[2] + 2], [5, s[1] + AIM_CAM_UP - 4, 4]);   // her castle, its roof 1 m over the rail\'s eye
  const yard = box([0, castle.c[1] + castle.h[1] + 1.5, s[2]], [3, 1, 1]);   // and a yard just over that
  const stern = camera({ side: 'stern', hull: castle, rig: [yard] }).settle();
  near(stern[1], reachAlong(yard, [0, 1, 0]) + AIM_CAM_CLEAR, 1e-9, 'lifted over her castle, then over the yard it met');
  near(stern[2], s[2], 1e-9, 'straight over the rail still');
});

test('AUDIT AIM-ENDS A3 one side to the next: a look swung from a broadside past the bow\'s arc eases the eye round (AIM_CAM_TAU a step) - never a jump - and in her own frame, so a ship sailing on never drags it behind her (mutants: the side change unsmoothed; the ease in the world\'s frame)', () => {
  const cam = camera({ side: 'starboard' });
  const at = cam.settle();
  cam.state.aim = { side: 'bow' };
  const next = cam.cam.eye([0, 5, 0], 1 / 60);
  const moved = Math.hypot(next[0] - at[0], next[1] - at[1], next[2] - at[2]);
  const c = centre('bow');
  const far = Math.hypot(c[0] - at[0], c[1] + AIM_CAM_UP - at[1], c[2] + AIM_CAM_AHEAD - at[2]);
  near(moved, far * (1 - Math.exp(-(1 / 60) / AIM_CAM_TAU)), 1e-6, 'one step of the ease');
  assert.ok(moved < 3, `${moved.toFixed(2)} m in a frame`);
  // her frame: the whole ship moved 10 m between two frames, the eye moved with her
  const pose = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };
  const sailing = camera({ side: 'starboard', pose: () => pose });
  const a = sailing.settle();
  pose.position = [0, 0, 10];
  const b = sailing.cam.eye([0, 5, 0], 0.1);
  near(b[2] - a[2], 10, 1e-6, 'carried with her, not left behind');
});

test('AIM-ENDS never: the Broadside camera off, a crippled ship or nothing laid leave the eye its own over the bow and the stern as over a side; a ship ahead stops it AIM_CAM_CLEAR short of her (mutants: the setting unread, the wreck unread)', () => {
  const own = [0, 5, 0];
  assert.equal(camera({ on: false }).settle(own), own, 'switched off');
  assert.equal(camera({ wrecked: true, side: 'stern' }).settle(own), own, 'crippled');
  const idle = camera();
  idle.state.aiming = false;
  assert.equal(idle.settle(own), own, 'nothing laid');
  const c = centre('bow');
  const want = [c[0], c[1] + AIM_CAM_UP, c[2] + AIM_CAM_AHEAD];
  const ahead = box([0, 0, want[2] + 0.5], [6, 20, 0.5]);
  const eye = camera({ alongside: [ahead] }).settle(own);
  const hit = segmentBoxEntry(c, want, ahead, AIM_CAM_CLEAR);
  assert.ok(hit && hit.t > 0 && hit.t < 1);
  for (let i = 0; i < 3; i++) near(eye[i], hit.point[i], 1e-6, 'short of the ship ahead');
});

test('AIM-ENDS the barrel\'s fall: fallArc runs from the stern\'s rail to the barrel\'s mark, its way out even and its height falling with the square of it - no rise (mutants: the fall straight, the way uneven)', () => {
  const pts = fallArc([0, 5, -20], [0, 0, -21.5], 5);
  assert.equal(pts.length, 5);
  assert.deepEqual(pts[0], [0, 5, -20]);
  assert.deepEqual(pts[4], [0, 0, -21.5]);
  near(pts[2][2], -20.75, 1e-12, 'half the way out at the middle point');
  near(pts[2][1], 5 - 5 * 0.25, 1e-12, 'a quarter of the fall at half the way');
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][1] <= pts[i - 1][1], 'never rising');
});
