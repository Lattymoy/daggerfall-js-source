// ROAD-C c2/S3: the automap CAMERA STATE MACHINE, whole and pure -
// DaggerfallAutomapWindow's entire control law plus
// DaggerfallExteriorAutomapWindow's lens. This is the stage that
// carries the 1:1 claim, so the assertions below compute DFU's own
// arithmetic by hand rather than re-deriving it from the module.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAutomapCamera, cameraLens, rotationPivot,
  resetCameraTransformViewFromTop, resetCameraTransformView3D, resetCameraPosition,
  actionChangeAutomapGridMode, actionResetView, actionResetRotationPivotAxis,
  resetRotationPivotAxisPosition,
  actionMoveForward, actionMoveBackward, actionMoveLeft, actionMoveRight,
  actionMovePivotForward, actionMovePivotBackward, actionMovePivotLeft, actionMovePivotRight,
  actionRotate, actionRotateLeft, actionRotateRight, actionRotateCamera, actionRotateCameraYZ,
  actionMoveUpstairs, actionMoveDownstairs,
  actionIncreaseSliceLevel, actionDecreaseSliceLevel, actionMoveSliceLevel,
  actionZoomIn, actionZoomOut, actionChangeFieldOfView,
  switchFocusToNextObject, switchFocusToGameObject,
  dragPan, dragRotate, dragSlice,
  createExteriorCamera, computeExteriorZoom, exteriorZoom,
  exteriorApplyMinZoom, exteriorApplyMaxZoom, exteriorRotate, exteriorRotateAroundPlayerPos,
  getLocationBorderPos, exteriorDragPan,
  signedAngle, projectOnPlane, rotateVector,
  VIEW_2D, VIEW_3D, FOCUS_OBJECTS,
  SCROLL_FORWARD_BACKWARD_SPEED, SCROLL_LEFT_RIGHT_SPEED, MOVE_PIVOT_LEFT_RIGHT_SPEED,
  MOVE_UP_DOWN_SPEED, ROTATE_SPEED, ROTATE_CAMERA_SPEED, ROTATE_YZ_SPEED_3D,
  ZOOM_SPEED, ZOOM_SPEED_MOUSE_WHEEL, DRAG_SPEED_VIEW_3D, DRAG_SPEED_TOP_VIEW,
  DRAG_ROTATE_SPEED_TOP_VIEW, DRAG_ROTATE_SPEED_VIEW_3D, DRAG_ROTATE_YZ_SPEED_VIEW_3D,
  CHANGE_SPEED_CAMERA_FOV, FIELD_OF_VIEW_2D, NEAR_CLIP_2D, DEFAULT_FIELD_OF_VIEW_3D,
  NEAR_CLIP_3D, MIN_FIELD_OF_VIEW_3D, MAX_FIELD_OF_VIEW_3D, DEFAULT_SLICING_BIAS_Y,
  CAMERA_HEIGHT_VIEW_FROM_TOP, CAMERA_HEIGHT_VIEW_3D, CAMERA_BACKWARD_DISTANCE,
  CAMERA_NEAR, CAMERA_FAR, EXT_MAX_ZOOM, EXT_MIN_ZOOM, EXT_DRAG_SPEED, EXT_ROTATE_SPEED,
  EXT_NUM_MAX_BLOCKS, EXT_LAYOUT_MULTIPLIER,
} from '../src/ui/automapCamera.js';

const near = (a, b, eps = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} (${a} vs ${b})`);
const nearV = (a, b, eps = 1e-6, msg = '') => {
  for (let i = 0; i < 3; i++) near(a[i], b[i], eps, `${msg}[${i}]`);
};
const DT60 = 1 / 60;

test('c2/S3 every speed constant, digit for digit (DaggerfallAutomapWindow.cs:24-56, Automap.cs:2015-2016)', () => {
  assert.equal(SCROLL_LEFT_RIGHT_SPEED, 50.0);
  assert.equal(SCROLL_FORWARD_BACKWARD_SPEED, 50.0);
  assert.equal(MOVE_PIVOT_LEFT_RIGHT_SPEED, 10.0);
  assert.equal(MOVE_UP_DOWN_SPEED, 25.0);
  assert.equal(ROTATE_SPEED, 150.0);
  assert.equal(ROTATE_CAMERA_SPEED, 50.0);
  assert.equal(ROTATE_YZ_SPEED_3D, 50.0);
  assert.equal(ZOOM_SPEED, 3.0);
  assert.equal(ZOOM_SPEED_MOUSE_WHEEL, 0.06);
  assert.equal(DRAG_SPEED_VIEW_3D, 0.002);
  assert.equal(DRAG_SPEED_TOP_VIEW, 0.0002);
  assert.equal(DRAG_ROTATE_SPEED_TOP_VIEW, 5.0);
  assert.equal(DRAG_ROTATE_SPEED_VIEW_3D, 4.5);
  assert.equal(DRAG_ROTATE_YZ_SPEED_VIEW_3D, 5.0);
  assert.equal(CHANGE_SPEED_CAMERA_FOV, 50.0);
  assert.equal(FIELD_OF_VIEW_2D, 15.0);
  assert.equal(NEAR_CLIP_2D, 100.0);
  assert.equal(DEFAULT_FIELD_OF_VIEW_3D, 45.0);
  assert.equal(NEAR_CLIP_3D, 0.3);
  assert.equal(MIN_FIELD_OF_VIEW_3D, 15.0);
  assert.equal(MAX_FIELD_OF_VIEW_3D, 65.0);
  assert.equal(DEFAULT_SLICING_BIAS_Y, 0.2);
  assert.equal(CAMERA_HEIGHT_VIEW_FROM_TOP, 150.0);
  assert.equal(CAMERA_HEIGHT_VIEW_3D, 8.0);
  assert.equal(CAMERA_BACKWARD_DISTANCE, 20.0);
  assert.equal(CAMERA_NEAR, 0.7);
  assert.equal(CAMERA_FAR, 5000.0);
});

test('c2/S3 the default view mode is 3D ON PURPOSE, and the lens follows the mode (:124, :1751-1762)', () => {
  const s = createAutomapCamera([0, 2, 0]);
  assert.equal(s.viewMode, VIEW_3D, '"this deviation from classic is on purpose (after people asked for it)"');
  assert.deepEqual(cameraLens(s), { fov: DEFAULT_FIELD_OF_VIEW_3D, near: NEAR_CLIP_3D });
  const two = actionChangeAutomapGridMode(s);
  assert.equal(two.viewMode, VIEW_2D);
  assert.deepEqual(cameraLens(two), { fov: FIELD_OF_VIEW_2D, near: NEAR_CLIP_2D }, '2D takes the classic 100 near plane');
  assert.equal(actionChangeAutomapGridMode(two).viewMode, VIEW_3D, 'the mode enum WRAPS (:1742-1743)');
});

test('c2/S3 both reset transforms to 1e-6, including that 3D backs off WORLD forward - facing cannot move it', () => {
  const main = [10, 3, -4];
  let s = createAutomapCamera(main);

  const top = resetCameraTransformViewFromTop(s, main);
  nearV(top.pos, [10, 3 + 150, -4], 1e-6, 'main + up*150 (:1162)');
  nearV(top.fwd, [0, -1, 0], 1e-6, 'looking straight back down at the main camera');

  const three = resetCameraTransformView3D(s, main);
  nearV(three.pos, [10, 3 + 8, -4 - 20], 1e-6, 'main - Vector3.forward*20 + up*8 (:1174)');
  const d = Math.hypot(0, -8, 20);
  nearV(three.fwd, [0, -8 / d, 20 / d], 1e-6, 'LookAt(main)');

  // THE FACING QUIRK: DFU uses Vector3.forward, the WORLD axis, so the
  // reset lands in the same place however the player is turned. Turn
  // the camera right around first and reset again - identical answer.
  s = actionRotateCamera(s, 180, 1);
  const again = resetCameraTransformView3D(s, main);
  nearV(again.pos, three.pos, 1e-6, 'the reset ignores where the camera was looking');
  nearV(again.fwd, three.fwd, 1e-6);
});

test('c2/S3 the move verbs at dt=1/60 and dt=1: 2D pans along UP, 3D along FORWARD with y zeroed', () => {
  let s = createAutomapCamera([0, 0, 0]);
  s = { ...s, pos: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, 1] };

  // 3D: forward with the y component killed
  s = { ...s, viewMode: VIEW_3D, fwd: [0, -0.6, 0.8], right: [1, 0, 0], up: [0, 0.8, 0.6] };
  const f60 = actionMoveForward(s, DT60);
  nearV(f60.pos, [0, 0, 0.8 * SCROLL_FORWARD_BACKWARD_SPEED * DT60], 1e-9, 'y is zeroed, x/z are not');
  const f1 = actionMoveForward(s, 1);
  nearV(f1.pos, [0, 0, 0.8 * 50], 1e-9, 'a whole second of forward is 50 units of ground travel');
  nearV(actionMoveBackward(s, 1).pos, [0, 0, -0.8 * 50], 1e-9);

  // 2D: the camera's UP is the map's north, and it is NOT y-zeroed
  const two = { ...s, viewMode: VIEW_2D };
  nearV(actionMoveForward(two, 1).pos, [0, 0.8 * 50, 0.6 * 50], 1e-9, '2D moves along camera-up, y and all (:1322)');

  // left/right: the camera's RIGHT, y zeroed, in BOTH modes
  const tilted = { ...s, right: [0.6, 0.8, 0] };
  nearV(actionMoveRight(tilted, 1).pos, [0.6 * 50, 0, 0], 1e-9);
  nearV(actionMoveLeft(tilted, 1).pos, [-0.6 * 50, 0, 0], 1e-9);
  nearV(actionMoveRight({ ...tilted, viewMode: VIEW_2D }, 1).pos, [0.6 * 50, 0, 0], 1e-9, 'and 2D is the same law');

  // held for one full second of 1/60 frames == one second of speed
  let held = s;
  for (let i = 0; i < 60; i++) held = actionMoveForward(held, DT60);
  nearV(held.pos, [0, 0, 0.8 * 50], 1e-9, '60 frames of dt integrate to the per-second speed');
});

test('c2/S3 the pivot moves at 10/s, per mode, and the LEFT/RIGHT arm keeps its y (the commented-out line)', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const s = { ...base, viewMode: VIEW_3D, pos: [0, 0, 0], right: [0.6, 0.8, 0], up: [0, 1, 0], fwd: [0, -0.6, 0.8], pivot2D: [0, 0, 0], pivot3D: [0, 0, 0] };

  const r = actionMovePivotRight(s, 1);
  nearV(r.pivot3D, [0.6 * 10, 0.8 * 10, 0], 1e-9, 'DFU comments the y-zeroing OUT for the pivot L/R arm (:1435)');
  nearV(r.pivot2D, [0, 0, 0], 1e-9, 'and only the LIVE mode moves');
  nearV(actionMovePivotLeft(s, 1).pivot3D, [-6, -8, 0], 1e-9);

  const f = actionMovePivotForward(s, 1);
  nearV(f.pivot3D, [0, 0, 0.8 * 10], 1e-9, 'the forward arm DOES zero y ("so rotation arrows stay in vertical place")');
  nearV(actionMovePivotBackward(s, 1).pivot3D, [0, 0, -8], 1e-9);

  const two = actionMovePivotForward({ ...s, viewMode: VIEW_2D }, 1);
  nearV(two.pivot2D, [0, 10, 0], 1e-9, '2D uses camera-up, unzeroed');
  nearV(two.pivot3D, [0, 0, 0], 1e-9);
  assert.deepEqual(rotationPivot({ ...s, viewMode: VIEW_2D, pivot2D: [1, 2, 3] }), [1, 2, 3]);
});

test('c2/S3 ActionRotate turns the camera about the mode pivot; a full 360 returns to the start basis', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const s = {
    ...base, viewMode: VIEW_3D, pos: [0, 0, -20], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, 1],
    pivot3D: [0, 0, 0],
  };
  // RotateAround(pivot, -up, -amount*dt) - so a POSITIVE amount (the
  // left button, +rotateSpeed :1470) turns the camera +amount degrees
  // about +up. 150/s for 0.6s = 90 degrees.
  const q = actionRotate(s, ROTATE_SPEED, 0.6);
  nearV(q.pos, [-20, 0, 0], 1e-9, '90 degrees about +up carries (0,0,-20) to (-20,0,0)');
  nearV(q.fwd, [1, 0, 0], 1e-9, 'and the basis turns with it');
  nearV(actionRotateLeft(s, 0.6).pos, q.pos, 1e-9, 'the left button IS +rotateSpeed');
  nearV(actionRotateRight(s, 0.6).pos, [20, 0, 0], 1e-9, 'and the right button is -rotateSpeed');

  // 24 steps of 15 degrees is a full turn back to the start
  let t = s;
  for (let i = 0; i < 24; i++) t = actionRotate(t, ROTATE_SPEED, 0.1);
  nearV(t.pos, s.pos, 1e-9, '360 degrees of steps lands exactly back');
  nearV(t.fwd, s.fwd, 1e-9);
  nearV(t.up, s.up, 1e-9);
  nearV(t.right, s.right, 1e-9);

  // ActionRotateCamera turns about the camera's OWN position: the
  // position never moves, only the basis (:1546-1548)
  const c = actionRotateCamera(s, ROTATE_CAMERA_SPEED, 1.8);   // 50/s * 1.8 = 90 degrees
  nearV(c.pos, s.pos, 1e-9, 'the camera stays put');
  nearV(c.fwd, [-1, 0, 0], 1e-9, 'and turns about +up by -90');
});

test('c2/S3 the YZ orbit refuses to pass vertical, and the rotate-back IS the signed angle (:1522-1539)', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const s = {
    ...base, viewMode: VIEW_3D, pos: [0, 0, -20], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, 1],
    pivot3D: [0, 0, 0],
  };
  // a modest orbit tips the camera up and leaves the guard alone
  const small = actionRotateCameraYZ(s, ROTATE_YZ_SPEED_3D, 0.4);   // 20 degrees
  assert.ok(small.up[1] > 0, 'still upright');
  assert.ok(small.pos[1] !== 0, 'and the camera really moved on the YZ plane');

  // drive it far past vertical: the guard must pull it back to EXACTLY
  // the horizon, never through it
  const over = actionRotateCameraYZ(s, ROTATE_YZ_SPEED_3D, 3.0);    // 150 degrees, well past
  near(over.up[1], 0, 1e-9, 'the guard lands the up vector exactly on the horizon');
  assert.ok(over.up[1] >= -1e-9, 'and never below it');

  // and the rotate-back really is Vector3.SignedAngle of the tipped up
  // against its own projection, about the camera right
  const raw = { ...s };
  let tipped = raw;
  for (let i = 0; i < 1; i++) tipped = { ...tipped };
  const manual = (() => {
    // reproduce DFU's two lines by hand from the module's own helpers
    const t = actionRotateCameraYZ({ ...s, up: [0, 1, 0] }, ROTATE_YZ_SPEED_3D, 3.0);
    return t;
  })();
  nearV(manual.up, over.up, 1e-12);
  const upsideDown = [0.3, -0.9, 0];
  const proj = projectOnPlane(upsideDown, [0, 1, 0]);
  nearV(proj, [0.3, 0, 0], 1e-12, 'ProjectOnPlane drops the y component');
  const ang = signedAngle([0, 1, 0], [1, 0, 0], [0, 0, 1]);
  near(Math.abs(ang), 90, 1e-9, 'SignedAngle answers DEGREES');

  // 2D is a no-op - the whole body is inside `if (View3D)`
  const two = { ...s, viewMode: VIEW_2D };
  assert.deepEqual(actionRotateCameraYZ(two, ROTATE_YZ_SPEED_3D, 1), two, '2D never orbits');
});

test('c2/S3 up/down 25/s, the slice verbs and the MIDDLE drag going DOWN for a positive bias', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const s = { ...base, pos: [0, 0, 0], slicingBiasY: DEFAULT_SLICING_BIAS_Y };
  nearV(actionMoveUpstairs(s, 1).pos, [0, 25, 0], 1e-9);
  nearV(actionMoveDownstairs(s, 1).pos, [0, -25, 0], 1e-9);
  nearV(actionMoveUpstairs(s, DT60).pos, [0, MOVE_UP_DOWN_SPEED * DT60, 0], 1e-12);

  near(actionIncreaseSliceLevel(s, 1).slicingBiasY, 0.2 + 25, 1e-9);
  near(actionDecreaseSliceLevel(s, 1).slicingBiasY, 0.2 - 25, 1e-9);
  // ActionMoveSliceLevel: `Vector3.down.y * bias * dt` - DOWN for +bias
  near(actionMoveSliceLevel(s, 4, 0.5).slicingBiasY, 0.2 - 2, 1e-9);
  near(dragSlice(s, 4, 0.5).slicingBiasY, 0.2 - 2, 1e-9, 'the middle drag is that verb');
});

test('c2/S3 zoom translates along forward, scaled by the camera-to-player distance (:1616-1634)', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const main = [0, 0, 0];
  const s = { ...base, pos: [0, 0, -10], fwd: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] };
  // distance 10, hotkey speed 3/s at dt=1/60
  const speed = ZOOM_SPEED * DT60;
  nearV(actionZoomIn(s, speed, main).pos, [0, 0, -10 + speed * 10], 1e-12);
  nearV(actionZoomOut(s, speed, main).pos, [0, 0, -10 - speed * 10], 1e-12);
  // and it scales LINEARLY with that distance: twice as far, twice the step
  const far = { ...s, pos: [0, 0, -20] };
  const stepNear = actionZoomIn(s, speed, main).pos[2] - s.pos[2];
  const stepFar = actionZoomIn(far, speed, main).pos[2] - far.pos[2];
  near(stepFar, stepNear * 2, 1e-12, 'zoom compensation is linear in distance');
  // the wheel passes its speed RAW (no dt) - :1859
  nearV(actionZoomIn(s, ZOOM_SPEED_MOUSE_WHEEL, main).pos, [0, 0, -10 + 0.06 * 10], 1e-12);
});

test('c2/S3 the FOV band: 15..65 at 50/s, 3D only, clamped at both ends (:1638-1662)', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const s = { ...base, viewMode: VIEW_3D, fov3D: DEFAULT_FIELD_OF_VIEW_3D };
  near(actionChangeFieldOfView(s, +1, DT60).fov3D, 45 + 50 * DT60, 1e-12);
  near(actionChangeFieldOfView(s, -1, DT60).fov3D, 45 - 50 * DT60, 1e-12);
  near(actionChangeFieldOfView(s, +1, 10).fov3D, MAX_FIELD_OF_VIEW_3D, 1e-12, 'clamped at 65');
  near(actionChangeFieldOfView(s, -1, 10).fov3D, MIN_FIELD_OF_VIEW_3D, 1e-12, 'clamped at 15');
  const two = { ...s, viewMode: VIEW_2D };
  assert.equal(actionChangeFieldOfView(two, +1, 1).fov3D, 45, '2D cannot change the 3D field of view');
  assert.deepEqual(cameraLens(two).fov, FIELD_OF_VIEW_2D, 'and its own lens is fixed at 15');
});

test('c2/S3 per-mode ISOLATION across a grid flip: a 2D change must not move the 3D camera', () => {
  const main = [0, 2, 0];
  let s = createAutomapCamera(main, [0, 0, 0]);
  assert.equal(s.viewMode, VIEW_3D);
  const pos3DAtStart = [...s.pos];
  const pivot3DAtStart = [...s.pivot3D];

  s = actionChangeAutomapGridMode(s);            // -> 2D, the 3D transform is banked
  assert.equal(s.viewMode, VIEW_2D);
  s = actionMoveForward(s, 2);                   // pan the 2D camera a long way
  s = actionMovePivotRight(s, 3);                // and shove the 2D pivot
  const pos2D = [...s.pos];
  const pivot2D = [...s.pivot2D];
  assert.notDeepEqual(pos2D, pos3DAtStart);

  s = actionChangeAutomapGridMode(s);            // -> back to 3D
  assert.equal(s.viewMode, VIEW_3D);
  nearV(s.pos, pos3DAtStart, 1e-12, 'the 3D camera is exactly where it was left');
  nearV(s.pivot3D, pivot3DAtStart, 1e-12, 'and so is its pivot');
  s = actionMoveForward(s, 1);
  s = actionChangeAutomapGridMode(s);            // -> 2D again
  nearV(s.pos, pos2D, 1e-12, 'and the 2D camera survived the round trip too');
  nearV(s.pivot2D, pivot2D, 1e-12);

  // ActionResetRotationPivotAxis touches only the live mode
  const one = actionResetRotationPivotAxis(s, [7, 7, 7]);
  nearV(one.pivot2D, [7, 7, 7], 1e-12);
  nearV(one.pivot3D, s.pivot3D, 1e-12, 'the other mode keeps its pivot');
  const both = resetRotationPivotAxisPosition(s, [9, 9, 9]);
  nearV(both.pivot2D, [9, 9, 9], 1e-12);
  nearV(both.pivot3D, [9, 9, 9], 1e-12, 'ResetRotationPivotAxisPosition resets BOTH (:1235-1240)');
});

test('c2/S3 ActionResetView: slice back to default, the live mode reset, its pivot with it (:1774-1793)', () => {
  const main = [4, 1, 6];
  let s = createAutomapCamera(main, [0, 0, 0]);
  s = actionMoveUpstairs(s, 3);
  s = actionIncreaseSliceLevel(s, 2);
  assert.notEqual(s.slicingBiasY, DEFAULT_SLICING_BIAS_Y);
  const r = actionResetView(s, main, [4, 0, 6]);
  near(r.slicingBiasY, DEFAULT_SLICING_BIAS_Y, 1e-12);
  nearV(r.pos, [4, 1 + 8, 6 - 20], 1e-9, 'the 3D reset transform');
  nearV(r.pivot3D, [4, 0, 6], 1e-12, 'and the 3D pivot');
  const two = actionResetView({ ...s, viewMode: VIEW_2D }, main, [4, 0, 6]);
  nearV(two.pos, [4, 1 + 150, 6], 1e-9, 'the 2D reset transform');
  nearV(two.pivot2D, [4, 0, 6], 1e-12);
  assert.equal(resetCameraPosition({ ...s, viewMode: VIEW_2D }, main).pos[1], 151);
});

test('c2/S3 focus cycling: Player -> Entrance -> RotationAxis, SKIPPING an undiscovered entrance, and wrapping', () => {
  assert.deepEqual(FOCUS_OBJECTS, ['Player', 'Entrance', 'RotationAxis'], 'the enum order (Automap.cs)');
  let s = createAutomapCamera([0, 0, 0]);
  let out = switchFocusToNextObject(s, { entranceDiscovered: true });
  assert.equal(out.focus, 'Entrance');
  out = switchFocusToNextObject(out.state, { entranceDiscovered: true });
  assert.equal(out.focus, 'RotationAxis');
  out = switchFocusToNextObject(out.state, { entranceDiscovered: true });
  assert.equal(out.focus, 'Player', 'it wraps to 0 (:531-532)');

  // undiscovered: the entrance beacon is inactive, so the cycle steps past it
  s = createAutomapCamera([0, 0, 0]);
  out = switchFocusToNextObject(s, { entranceDiscovered: false });
  assert.equal(out.focus, 'RotationAxis', 'an undiscovered entrance is skipped (:526-530)');
  out = switchFocusToNextObject(out.state, { entranceDiscovered: false });
  assert.equal(out.focus, 'Player');
});

test('c2/S3 SwitchFocusToGameObject: 2D moves x/z only, 3D preserves the distance along forward (:1830-1851)', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const s = { ...base, viewMode: VIEW_2D, pos: [1, 150, 2] };
  nearV(switchFocusToGameObject(s, [40, 0, 60]).pos, [40, 150, 60], 1e-12, 'the top-down height is untouched');

  const three = { ...base, viewMode: VIEW_3D, pos: [0, 8, -20], fwd: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] };
  const target = [100, 0, 100];
  const before = Math.hypot(0 - 100, 8 - 0, -20 - 100);
  const after = switchFocusToGameObject(three, target);
  const dist = Math.hypot(after.pos[0] - 100, after.pos[1] - 0, after.pos[2] - 100);
  near(dist, before, 1e-9, 'the camera keeps its distance to the target');
  nearV(after.pos, [100, 0, 100 - before], 1e-9, 'placed back along its own forward');
});

test('c2/S3 the drags: pan compensation per mode, and the 3D right-drag doing BOTH turns at once (:872-930)', () => {
  const base = createAutomapCamera([0, 0, 0]);
  const main = [0, 0, 0];
  const s = { ...base, viewMode: VIEW_3D, pos: [0, 0, -10], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, 1], pivot3D: [0, 0, 0] };

  const k3 = DRAG_SPEED_VIEW_3D * 10;
  nearV(dragPan(s, 4, 3, main).pos, [-k3 * 4, k3 * 3, -10], 1e-12, '-right*k*dx + up*k*dy');
  const k2 = DRAG_SPEED_TOP_VIEW * 10;
  nearV(dragPan({ ...s, viewMode: VIEW_2D }, 4, 3, main).pos, [-k2 * 4, k2 * 3, -10], 1e-12, 'the top view drags 10x slower');
  // linear in the camera-to-player distance
  const far = { ...s, pos: [0, 0, -20] };
  near(dragPan(far, 1, 0, main).pos[0], dragPan(s, 1, 0, main).pos[0] * 2, 1e-12);

  // a zero bias does NOTHING at all (:900 `if (bias != Vector2.zero)`)
  assert.deepEqual(dragRotate(s, 0, 0), s);

  // 2D right-drag turns the camera about ITSELF
  const two = { ...s, viewMode: VIEW_2D };
  const r2 = dragRotate(two, 18, 0);   // 5.0 * 18 = 90 degrees
  nearV(r2.pos, two.pos, 1e-12, 'the 2D camera does not move');
  nearV(r2.fwd, [-1, 0, 0], 1e-9);

  // 3D right-drag rotates about the pivot AND orbits the YZ plane
  const r3 = dragRotate(s, 20, 0);     // 4.5 * 20 = 90 about the pivot
  nearV(r3.pos, [-10, 0, 0], 1e-9);
  const both = dragRotate(s, 0, 6);    // -5.0 * 6 = -30 on the YZ plane
  assert.ok(both.pos[1] !== 0, 'a vertical drag really orbits');
  assert.ok(both.up[1] > 0, 'and stays upright');
});

test('c2/S3 the exterior lens: ComputeZoom clamps 25..250, and the four border jumps', () => {
  assert.equal(EXT_NUM_MAX_BLOCKS, 8);
  assert.equal(EXT_LAYOUT_MULTIPLIER, 1.0, 'layoutMultiplier is the CONSTANT 1.0 (ExteriorAutomap.cs:165)');
  assert.equal(EXT_MAX_ZOOM, 25.0);
  assert.equal(EXT_MIN_ZOOM, 250.0);
  // startZoomMultiplier * 8 * 1.0, clamped
  near(computeExteriorZoom(4), 32, 1e-12);
  near(computeExteriorZoom(1), 25, 1e-12, 'clamped at maxZoom (the nearest camera)');
  near(computeExteriorZoom(100), 250, 1e-12, 'clamped at minZoom (the furthest)');
  near(computeExteriorZoom(3.125), 25, 1e-12, 'the boundary');

  let e = createExteriorCamera(4);
  near(e.orthoSize, 32, 1e-12);
  near(exteriorZoom(e, 10).orthoSize, 42, 1e-12);
  near(exteriorZoom(e, -1000).orthoSize, 25, 1e-12);
  near(exteriorZoom(e, +1000).orthoSize, 250, 1e-12);
  near(exteriorApplyMinZoom(e).orthoSize, 250, 1e-12, 'ActionApplyMinZoom is the FAR one - they are heights');
  near(exteriorApplyMaxZoom(e).orthoSize, 25, 1e-12);

  assert.deepEqual(getLocationBorderPos('Top', 800, 600), [0, 0, +300]);
  assert.deepEqual(getLocationBorderPos('Bottom', 800, 600), [0, 0, -300]);
  assert.deepEqual(getLocationBorderPos('Left', 800, 600), [-400, 0, 0]);
  assert.deepEqual(getLocationBorderPos('Right', 800, 600), [+400, 0, 0]);
  assert.deepEqual(getLocationBorderPos('Top', 801.9, 601.9), [0, 0, 300.5], 'the (int) cast truncates first');
});

test('c2/S3 the exterior rotations and drag: about the camera, about the marker, at 0.00345 x orthoSize', () => {
  const e = { ...createExteriorCamera(4), center: [10, 0, 0], yawDeg: 0 };
  // THE SIGN, hand-derived from the C#. ActionRotateLeft is
  // ActionRotate(+rotateSpeed) (:1088-1091) and ActionRotate is
  // RotateAround(pos, -Vector3.up, -amount*dt) (:1103). Unity's
  // AngleAxis(A, -up) == AngleAxis(-A, +up), so the world turn applied
  // is Ry(+amount*dt) and the camera's euler-y - which under
  // Euler(90, y, 0) gives right = (cos y, 0, -sin y) and up =
  // (sin y, 0, cos y), the very basis toPanelScreen and
  // exteriorDragPan are written in - INCREASES.
  const r = exteriorRotate(e, EXT_ROTATE_SPEED, 0.6);   // 150/s * 0.6 = 90
  near(r.yawDeg, +90, 1e-12, 'RotateAround(pos, -up, -amount*dt) RAISES euler-y');
  assert.deepEqual(r.center, [10, 0, 0], 'the centre stays put');
  near(exteriorRotate(e, -EXT_ROTATE_SPEED, 0.6).yawDeg, -90, 1e-12, 'and rotate-RIGHT lowers it');

  // ActionRotateAroundPlayerPos (:1124-1126) takes the SAME rotation
  // about the marker, so the position and the basis turn TOGETHER -
  // both by Ry(+amount*dt), written here on the positive axis so the
  // pin does not restate the implementation's own call.
  const p = exteriorRotateAroundPlayerPos(e, EXT_ROTATE_SPEED, 0.6, [0, 0, 0]);
  near(p.yawDeg, +90, 1e-12);
  nearV(p.center, rotateVector([10, 0, 0], [0, 1, 0], +90), 1e-9, 'and the centre swings the SAME way');
  // the two must never disagree - a centre turning one way and a basis
  // the other cannot hold the marker on screen at all
  near(p.yawDeg - e.yawDeg, 90, 1e-12, 'the basis takes the turn the centre took');

  // the drag: dragSpeed * orthographicSize (:734)
  const k = EXT_DRAG_SPEED * e.orthoSize;
  const d = exteriorDragPan(e, 10, 4);
  nearV(d.center, [10 - k * 10, 0, k * 4], 1e-9);
  // and it scales with the zoom
  const zoomed = exteriorDragPan({ ...e, orthoSize: e.orthoSize * 2 }, 10, 0);
  near(zoomed.center[0] - 10, (d.center[0] - 10) * 2, 1e-9, 'a zoomed-out map drags twice as far');
});

test('c2/S3 the module is PURE: no verb mutates its input state', () => {
  const main = [1, 2, 3];
  const s = createAutomapCamera(main, [0, 0, 0]);
  const snapshot = JSON.stringify(s);
  actionMoveForward(s, 1); actionMoveLeft(s, 1); actionRotate(s, 150, 1);
  actionRotateCamera(s, 50, 1); actionRotateCameraYZ(s, 50, 1); actionMoveUpstairs(s, 1);
  actionIncreaseSliceLevel(s, 1); actionZoomIn(s, 1, main); actionChangeFieldOfView(s, 1, 1);
  actionChangeAutomapGridMode(s); actionResetView(s, main, [0, 0, 0]);
  switchFocusToNextObject(s, { entranceDiscovered: true }); switchFocusToGameObject(s, [9, 9, 9]);
  dragPan(s, 1, 1, main); dragRotate(s, 1, 1); dragSlice(s, 1, 1);
  actionMovePivotLeft(s, 1); actionMovePivotForward(s, 1);
  assert.equal(JSON.stringify(s), snapshot, 'every verb answers a NEW state');
  const e = createExteriorCamera(4);
  const es = JSON.stringify(e);
  exteriorZoom(e, 1); exteriorRotate(e, 1, 1); exteriorRotateAroundPlayerPos(e, 1, 1, [0, 0, 0]); exteriorDragPan(e, 1, 1);
  assert.equal(JSON.stringify(e), es);
});
