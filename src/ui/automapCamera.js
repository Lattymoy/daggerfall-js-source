// ROAD-C c2/S3: THE AUTOMAP CAMERA STATE MACHINE - DaggerfallAutomap-
// Window's entire control law (and DaggerfallExteriorAutomapWindow's
// lens) as PURE (state, action, dt) transitions. No GL, no data, no
// settings reads, no clock: hand it a state and an action, take a new
// state. That is what makes ~45 assertions of DFU's own arithmetic
// possible, and it is what A1/A2's stepped stand-ins (PAN_STEP,
// ROTATE_STEP_DEG, ZOOM_FACTOR, SLICE_STEP - "one action per press,
// scaled from DFU's per-second speeds") were standing in FOR.
//
// COORDINATES. Positions are Unity's, unchanged - the port keeps DFU's
// world values and applies its handedness at the projection
// (mirrorProjectionX, mat4's law), so Vector3.up is [0,1,0] and
// Vector3.forward is [0,0,1] here exactly as there. ROTATIONS are in
// DEGREES, as Unity's RotateAround and SignedAngle are.
//
// THE TRANSFORM. Unity carries a position + a quaternion; this module
// carries a position + the three basis vectors that quaternion would
// produce (right/up/fwd). RotateAround(point, axis, angle) turns the
// position about the point AND all three basis vectors about the same
// axis - which is what Unity's does - and LookAt rebuilds the basis
// from a target. Same law, no quaternion type.
//
// TWO DFU FACTS THE PORT MUST NOT "FIX":
//  - the default view mode is View3D, and the comment at
//    DaggerfallAutomapWindow.cs:124 says why: "this deviation from
//    classic is on purpose (after people asked for it)".
//  - ResetCameraTransformView3D backs the camera off along
//    Vector3.forward - the WORLD axis, not the player's facing
//    (:1170-1176) - so the reset camera looks the same way no matter
//    which way the player is turned.

import { DEFAULT_SLICING_BIAS_Y } from '../systems/automap.js';

// ONE HOME (the audit24 ratchet): defaultSlicingBiasY (:51) already
// lives in systems/automap.js, where the slice plane itself does. It
// is re-exported here so a consumer of the control law has the whole
// constant set in one import, without a second declaration of the
// value existing anywhere.
export { DEFAULT_SLICING_BIAS_Y };

const DEG = Math.PI / 180;

// ---- dungeon window constants (DaggerfallAutomapWindow.cs:24-56) ----
export const SCROLL_LEFT_RIGHT_SPEED = 50.0;              // :24
export const SCROLL_FORWARD_BACKWARD_SPEED = 50.0;        // :25
export const MOVE_PIVOT_LEFT_RIGHT_SPEED = 10.0;          // :26
export const MOVE_PIVOT_FORWARD_BACKWARD_SPEED = 10.0;    // :27
export const MOVE_UP_DOWN_SPEED = 25.0;                   // :28
export const ROTATE_SPEED = 150.0;                        // :29
export const ROTATE_CAMERA_SPEED = 50.0;                  // :30
export const ROTATE_YZ_SPEED_3D = 50.0;                   // :31
export const ZOOM_SPEED = 3.0;                            // :32
export const ZOOM_SPEED_MOUSE_WHEEL = 0.06;               // :33
export const DRAG_SPEED_VIEW_3D = 0.002;                  // :35
export const DRAG_SPEED_TOP_VIEW = 0.0002;                // :36
export const DRAG_ROTATE_SPEED_TOP_VIEW = 5.0;            // :37
export const DRAG_ROTATE_SPEED_VIEW_3D = 4.5;             // :38
export const DRAG_ROTATE_YZ_SPEED_VIEW_3D = 5.0;          // :39
export const CHANGE_SPEED_CAMERA_FOV = 50.0;              // :41
export const FIELD_OF_VIEW_2D = 15.0;                     // :43
export const NEAR_CLIP_2D = 100.0;                        // :44 "simulate classic Daggerfall near clip plane"
export const DEFAULT_FIELD_OF_VIEW_3D = 45.0;             // :45
export const NEAR_CLIP_3D = 0.3;                          // :47 "default Unity3D value"
export const MIN_FIELD_OF_VIEW_3D = 15.0;                 // :48
export const MAX_FIELD_OF_VIEW_3D = 65.0;                 // :49
export const CAMERA_HEIGHT_VIEW_FROM_TOP = 150.0;         // :53
export const CAMERA_HEIGHT_VIEW_3D = 8.0;                 // :54
export const CAMERA_BACKWARD_DISTANCE = 20.0;             // :55
/** the automap camera's own clip planes (Automap.cs:2015-2016) */
export const CAMERA_NEAR = 0.7;
export const CAMERA_FAR = 5000.0;

export const VIEW_2D = 'View2D';
export const VIEW_3D = 'View3D';
/** AutomapFocusObject, in the enum's own order (Automap.cs) - the
 *  cycle is Player -> Entrance -> RotationAxis -> Player. */
export const FOCUS_OBJECTS = ['Player', 'Entrance', 'RotationAxis'];

// ---- exterior window constants (DaggerfallExteriorAutomapWindow.cs) --
export const EXT_SCROLL_LEFT_RIGHT_SPEED = 100.0;   // :29
export const EXT_SCROLL_UP_DOWN_SPEED = 100.0;      // :30
export const EXT_ROTATE_SPEED = 150.0;              // :32
export const EXT_ZOOM_SPEED = 50.0;                 // :33
export const EXT_ZOOM_SPEED_MOUSE_WHEEL = 2.0;      // :34
export const EXT_DRAG_SPEED = 0.00345;              // :35
export const EXT_DRAG_ROTATE_SPEED = 5.0;           // :36
export const EXT_MAX_ZOOM = 25.0;                   // :38 "the minimum external automap camera height"
export const EXT_MIN_ZOOM = 250.0;                  // :39
/** numMaxBlocksX/Y = 8 and layoutMultiplier = 1.0f, both constants
 *  (ExteriorAutomap.cs:156-157, :165). */
export const EXT_NUM_MAX_BLOCKS = 8;
export const EXT_LAYOUT_MULTIPLIER = 1.0;
export const LOCATION_BORDERS = ['Top', 'Bottom', 'Left', 'Right'];

// ---- pure vector math, Unity's semantics ---------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const magnitude = (v) => Math.hypot(v[0], v[1], v[2]);
/** Vector3.Normalize - ZERO for a zero input, as Unity's is. */
const normalize = (v) => {
  const l = magnitude(v);
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};

/** Rodrigues: turn `v` about the UNIT axis by `deg` degrees, the
 *  right-hand rule Unity's Quaternion.AngleAxis uses. */
export function rotateVector(v, axis, deg) {
  const a = normalize(axis);
  const r = deg * DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return add(add(mul(v, c), mul(cross(a, v), s)), mul(a, dot(a, v) * (1 - c)));
}

/** Vector3.ProjectOnPlane(v, n). */
export const projectOnPlane = (v, n) => sub(v, mul(n, dot(v, n) / dot(n, n)));

/** Vector3.SignedAngle(from, to, axis) - DEGREES, signed by the axis. */
export function signedAngle(from, to, axis) {
  const f = normalize(from);
  const t = normalize(to);
  const unsigned = Math.acos(Math.min(1, Math.max(-1, dot(f, t)))) / DEG;
  const sign = Math.sign(dot(axis, cross(f, t)));
  return unsigned * (sign === 0 ? 1 : sign);
}

const cloneTransform = (s) => ({ pos: [...s.pos], right: [...s.right], up: [...s.up], fwd: [...s.fwd] });
const withTransform = (s, t) => ({ ...s, pos: [...t.pos], right: [...t.right], up: [...t.up], fwd: [...t.fwd] });

/** Transform.RotateAround(point, axis, angle): the position turns
 *  about the point and the whole basis turns with it. */
function rotateAround(s, point, axis, deg) {
  const off = rotateVector(sub(s.pos, point), axis, deg);
  return {
    ...s,
    pos: add(point, off),
    right: rotateVector(s.right, axis, deg),
    up: rotateVector(s.up, axis, deg),
    fwd: rotateVector(s.fwd, axis, deg),
  };
}

/** Transform.LookAt(target) with Vector3.up as the world up - Unity
 *  rebuilds the basis with zero roll, exactly this. */
function lookAt(s, target) {
  const fwd = normalize(sub(target, s.pos));
  if (magnitude(fwd) === 0) return s;
  let right = normalize(cross([0, 1, 0], fwd));
  if (magnitude(right) === 0) right = [1, 0, 0];   // looking straight up or down
  const up = normalize(cross(fwd, right));
  return { ...s, fwd, right, up };
}

// ---- the dungeon camera state --------------------------------------

/**
 * A fresh dungeon automap camera. `mainPos` is the game camera's
 * position (DFU's Camera.main) and `playerPos` the player's transform
 * (the pivots start there, ResetRotationPivotAxisPosition :1235-1240).
 */
export function createAutomapCamera(mainPos = [0, 0, 0], playerPos = mainPos) {
  let s = {
    viewMode: VIEW_3D,   // :124 - "this deviation from classic is on purpose"
    pos: [...mainPos],
    right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, 1],
    savedViewFromTop: null,
    savedView3D: null,
    pivot2D: [...playerPos],
    pivot3D: [...playerPos],
    fov3D: DEFAULT_FIELD_OF_VIEW_3D,
    slicingBiasY: DEFAULT_SLICING_BIAS_Y,
    focusIndex: 0,
  };
  // both transforms exist from the start (Init resets both, :595-606)
  s = resetCameraTransformViewFromTop(s, mainPos);
  s = resetCameraTransformView3D(s, mainPos);
  s = withTransform(s, s.savedView3D);
  return s;
}

/** the lens the current mode wants (fieldOfView + nearClipPlane, set
 *  together at every switch - :1751-1752 / :1761-1762) */
export const cameraLens = (s) => (s.viewMode === VIEW_2D
  ? { fov: FIELD_OF_VIEW_2D, near: NEAR_CLIP_2D }
  : { fov: s.fov3D, near: NEAR_CLIP_3D });

/** the rotation pivot of the CURRENT mode (GetRotationPivotAxisPosition
 *  :1261-1280) */
export const rotationPivot = (s) => (s.viewMode === VIEW_2D ? s.pivot2D : s.pivot3D);

/** ResetCameraTransformViewFromTop (:1160-1166): main camera position
 *  + up * 150, looking back down at it. Saves the 2D slot. */
export function resetCameraTransformViewFromTop(s, mainPos) {
  let t = { ...s, pos: add(mainPos, mul([0, 1, 0], CAMERA_HEIGHT_VIEW_FROM_TOP)) };
  t = lookAt(t, mainPos);
  return { ...t, savedViewFromTop: cloneTransform(t) };
}

/** ResetCameraTransformView3D (:1170-1177): main camera position
 *  - WORLD forward * 20 + up * 8, looking back at it. Saves the 3D
 *  slot. Vector3.forward, NOT the player's facing - a reset in 3D
 *  always looks the same way. */
export function resetCameraTransformView3D(s, mainPos) {
  let t = {
    ...s,
    pos: add(sub(mainPos, mul([0, 0, 1], CAMERA_BACKWARD_DISTANCE)), mul([0, 1, 0], CAMERA_HEIGHT_VIEW_3D)),
  };
  t = lookAt(t, mainPos);
  return { ...t, savedView3D: cloneTransform(t) };
}

/** ResetCameraPosition (:1143-1156): whichever the mode is. */
export function resetCameraPosition(s, mainPos) {
  return s.viewMode === VIEW_2D
    ? resetCameraTransformViewFromTop(s, mainPos)
    : resetCameraTransformView3D(s, mainPos);
}

export const resetRotationPivotAxisPosition = (s, playerPos) => ({ ...s, pivot2D: [...playerPos], pivot3D: [...playerPos] });

/** ActionResetRotationPivotAxis (:1799-1818): the CURRENT mode's pivot
 *  only - the other mode's stays where the player left it. */
export const actionResetRotationPivotAxis = (s, playerPos) => (s.viewMode === VIEW_2D
  ? { ...s, pivot2D: [...playerPos] }
  : { ...s, pivot3D: [...playerPos] });

/**
 * ActionChangeAutomapGridMode (:1738-1769). The mode advances and
 * WRAPS; on the way out the OUTGOING mode's transform is saved and
 * the incoming one's is restored, so the two cameras are wholly
 * independent - a pan in 2D must not move the 3D camera.
 */
export function actionChangeAutomapGridMode(s) {
  const next = s.viewMode === VIEW_2D ? VIEW_3D : VIEW_2D;
  if (next === VIEW_2D) {
    const saved3D = cloneTransform(s);                                  // SaveCameraTransformView3D (:1749)
    const t = { ...s, viewMode: VIEW_2D, savedView3D: saved3D };
    return s.savedViewFromTop ? withTransform(t, s.savedViewFromTop) : t;
  }
  const savedTop = cloneTransform(s);                                   // SaveCameraTransformViewFromTop (:1759)
  const t = { ...s, viewMode: VIEW_3D, savedViewFromTop: savedTop };
  return s.savedView3D ? withTransform(t, s.savedView3D) : t;
}

/** ActionResetView (:1774-1795): the slice bias goes back to default,
 *  the camera transform resets for the live mode, and THAT mode's
 *  pivot resets with it. */
export function actionResetView(s, mainPos, playerPos) {
  let t = { ...s, slicingBiasY: DEFAULT_SLICING_BIAS_Y };
  t = resetCameraPosition(t, mainPos);
  return s.viewMode === VIEW_2D
    ? { ...t, pivot2D: [...playerPos] }
    : { ...t, pivot3D: [...playerPos], fov3D: t.fov3D };
}

// ---- the move verbs -------------------------------------------------

const translate = (s, v) => ({ ...s, pos: add(s.pos, v) });

/** ActionMoveForward (:1317-1334) - 2D pans along the camera's UP
 *  (the map's north under a top-down lens), 3D along its FORWARD with
 *  the y component ZEROED ("comment this out for movement along
 *  camera optical axis"). */
export function actionMoveForward(s, dt) {
  const v = s.viewMode === VIEW_2D
    ? mul(s.up, SCROLL_FORWARD_BACKWARD_SPEED * dt)
    : [...mul(s.fwd, SCROLL_FORWARD_BACKWARD_SPEED * dt)];
  if (s.viewMode !== VIEW_2D) v[1] = 0;
  return translate(s, v);
}
export function actionMoveBackward(s, dt) {
  const v = s.viewMode === VIEW_2D
    ? mul(s.up, -SCROLL_FORWARD_BACKWARD_SPEED * dt)
    : [...mul(s.fwd, -SCROLL_FORWARD_BACKWARD_SPEED * dt)];
  if (s.viewMode !== VIEW_2D) v[1] = 0;
  return translate(s, v);
}
/** ActionMoveLeft/Right (:1363-1382) - always the camera's RIGHT with
 *  y zeroed, in BOTH modes. */
export function actionMoveLeft(s, dt) {
  const v = mul(s.right, -SCROLL_LEFT_RIGHT_SPEED * dt); v[1] = 0; return translate(s, v);
}
export function actionMoveRight(s, dt) {
  const v = mul(s.right, SCROLL_LEFT_RIGHT_SPEED * dt); v[1] = 0; return translate(s, v);
}

const shiftPivot = (s, v) => (s.viewMode === VIEW_2D
  ? { ...s, pivot2D: add(s.pivot2D, v) }
  : { ...s, pivot3D: add(s.pivot3D, v) });

/** ActionMoveRotationPivotAxisForward/Backward (:1385-1428) - same
 *  shape as the camera move, at the pivot speed, y zeroed in 3D "so
 *  rotation arrows stay in vertical place". */
export function actionMovePivotForward(s, dt) {
  const v = s.viewMode === VIEW_2D
    ? mul(s.up, MOVE_PIVOT_FORWARD_BACKWARD_SPEED * dt)
    : [...mul(s.fwd, MOVE_PIVOT_FORWARD_BACKWARD_SPEED * dt)];
  if (s.viewMode !== VIEW_2D) v[1] = 0;
  return shiftPivot(s, v);
}
export function actionMovePivotBackward(s, dt) {
  const v = s.viewMode === VIEW_2D
    ? mul(s.up, -MOVE_PIVOT_FORWARD_BACKWARD_SPEED * dt)
    : [...mul(s.fwd, -MOVE_PIVOT_FORWARD_BACKWARD_SPEED * dt)];
  if (s.viewMode !== VIEW_2D) v[1] = 0;
  return shiftPivot(s, v);
}
/** ActionMoveRotationPivotAxisLeft/Right (:1431-1450) - and here the
 *  y-zeroing line IS COMMENTED OUT in DFU, deliberately: the pivot
 *  moves along the camera's true right, y and all. */
export const actionMovePivotLeft = (s, dt) => shiftPivot(s, mul(s.right, -MOVE_PIVOT_LEFT_RIGHT_SPEED * dt));
export const actionMovePivotRight = (s, dt) => shiftPivot(s, mul(s.right, MOVE_PIVOT_LEFT_RIGHT_SPEED * dt));

// ---- the rotate verbs -----------------------------------------------

/** ActionRotate (:1499-1517): RotateAround(pivot-of-current-mode,
 *  -Vector3.up, -amount * dt). The two negatives are DFU's own. */
export const actionRotate = (s, amount, dt) => rotateAround(s, rotationPivot(s), [0, -1, 0], -amount * dt);
export const actionRotateLeft = (s, dt) => actionRotate(s, +ROTATE_SPEED, dt);    // :1470
export const actionRotateRight = (s, dt) => actionRotate(s, -ROTATE_SPEED, dt);   // :1493

/** ActionRotateCamera (:1544-1565): the camera turns about ITSELF,
 *  around +Vector3.up, by -amount * dt. */
export const actionRotateCamera = (s, amount, dt) => rotateAround(s, s.pos, [0, 1, 0], -amount * dt);
export const actionRotateCameraLeft = (s, dt) => actionRotateCamera(s, +ROTATE_CAMERA_SPEED, dt);
export const actionRotateCameraRight = (s, dt) => actionRotateCamera(s, -ROTATE_CAMERA_SPEED, dt);

/**
 * ActionrotateCameraOnCameraYZplaneAroundObject (:1522-1539). 3D ONLY
 * - in 2D the whole body is skipped and the state is untouched.
 * Orbits the 3D pivot about the camera's own right axis, then the
 * NEVER-UPSIDE-DOWN GUARD: if the camera's up has tipped below the
 * horizon, rotate back by exactly the signed angle between it and its
 * projection onto the world horizontal, about the same right axis.
 */
export function actionRotateCameraYZ(s, amount, dt) {
  if (s.viewMode !== VIEW_3D) return s;
  const point = s.pivot3D;
  let t = rotateAround(s, point, s.right, -amount * dt);
  const transformedUp = t.up;
  if (transformedUp[1] < 0) {
    const rotateBack = signedAngle(transformedUp, projectOnPlane(transformedUp, [0, 1, 0]), t.right);
    t = rotateAround(t, point, t.right, rotateBack);
  }
  return t;
}

// ---- up/down, slice, zoom, FOV --------------------------------------

export const actionMoveUpstairs = (s, dt) => translate(s, mul([0, 1, 0], MOVE_UP_DOWN_SPEED * dt));     // :1571
export const actionMoveDownstairs = (s, dt) => translate(s, mul([0, -1, 0], MOVE_UP_DOWN_SPEED * dt));  // :1580

/** ActionIncrease/DecreaseSliceLevel (:1589-1604): `SlicingBiasY +=
 *  Vector3.up.y * speed * dt` and `Vector3.down.y * speed * dt` -
 *  +1 and -1 spelled out through the axis constants. */
export const actionIncreaseSliceLevel = (s, dt) => ({ ...s, slicingBiasY: s.slicingBiasY + MOVE_UP_DOWN_SPEED * dt });
export const actionDecreaseSliceLevel = (s, dt) => ({ ...s, slicingBiasY: s.slicingBiasY - MOVE_UP_DOWN_SPEED * dt });
/** ActionMoveSliceLevel (:1607-1611) - the MIDDLE-drag: `Vector3.down.y
 *  * bias * dt`, so a positive bias moves the slice DOWN. */
export const actionMoveSliceLevel = (s, bias, dt) => ({ ...s, slicingBiasY: s.slicingBiasY - bias * dt });

/** ActionZoomIn/Out (:1616-1634): translate along the camera's forward
 *  by speed x the distance between the game camera and this one, so
 *  zoom feels the same near and far. `speed` arrives ALREADY scaled by
 *  dt from the hotkey (:858) or raw from the wheel (:1859). */
export function actionZoomIn(s, speed, mainPos) {
  const compensated = speed * magnitude(sub(mainPos, s.pos));
  return translate(s, mul(s.fwd, compensated));
}
export function actionZoomOut(s, speed, mainPos) {
  const compensated = speed * magnitude(sub(mainPos, s.pos));
  return translate(s, mul(s.fwd, -compensated));
}

/** ActionIncrease/DecreaseCameraFieldOfView (:1638-1662): 3D only,
 *  clamped to [15, 65] at 50 degrees per second. Note DFU's own
 *  spelling, Max(min, Min(max, v)) - the clamp is the same either way. */
export function actionChangeFieldOfView(s, dir, dt) {
  if (s.viewMode !== VIEW_3D) return s;
  const v = s.fov3D + dir * CHANGE_SPEED_CAMERA_FOV * dt;
  return { ...s, fov3D: Math.max(MIN_FIELD_OF_VIEW_3D, Math.min(MAX_FIELD_OF_VIEW_3D, v)) };
}

// ---- focus cycling ---------------------------------------------------

/**
 * SwitchFocusToNextObject (Automap.cs:522-548): Player -> Entrance ->
 * RotationAxis -> Player, skipping the ENTRANCE while it is
 * undiscovered (its beacon is inactive), then wrapping. Answers the
 * new state and the focus object's name.
 */
export function switchFocusToNextObject(s, { entranceDiscovered = false } = {}) {
  let i = s.focusIndex + 1;
  if (!entranceDiscovered && FOCUS_OBJECTS[i] === 'Entrance') i++;
  if (i > FOCUS_OBJECTS.length - 1) i = 0;
  return { state: { ...s, focusIndex: i }, focus: FOCUS_OBJECTS[i] };
}

/**
 * SwitchFocusToGameObject (:1830-1851). 2D moves the camera in X and Z
 * ONLY - the top-down height is left alone. 3D keeps the camera's
 * current DISTANCE to the target and re-places it that far back along
 * its own forward, so the framing survives the jump.
 */
export function switchFocusToGameObject(s, targetPos) {
  if (s.viewMode === VIEW_2D) {
    return { ...s, pos: [targetPos[0], s.pos[1], targetPos[2]] };
  }
  const dist = magnitude(sub(s.pos, targetPos));
  return { ...s, pos: sub(targetPos, mul(s.fwd, dist)) };
}

// ---- the drags (:872-930) --------------------------------------------

/** LEFT drag on the panel: pan by -right*k*dx + up*k*dy, where k is
 *  the per-mode drag speed compensated by the game-camera distance. */
export function dragPan(s, dx, dy, mainPos) {
  const k = (s.viewMode === VIEW_2D ? DRAG_SPEED_TOP_VIEW : DRAG_SPEED_VIEW_3D)
    * magnitude(sub(mainPos, s.pos));
  return translate(s, add(mul(s.right, -k * dx), mul(s.up, k * dy)));
}

/** RIGHT drag on the panel: 2D turns the camera about itself; 3D turns
 *  the map about the pivot AND orbits the YZ plane, both from the one
 *  drag (:906-915). A zero bias does nothing at all. */
export function dragRotate(s, dx, dy) {
  if (dx === 0 && dy === 0) return s;
  if (s.viewMode === VIEW_2D) return actionRotateCamera(s, +DRAG_ROTATE_SPEED_TOP_VIEW * dx, 1);
  let t = actionRotate(s, DRAG_ROTATE_SPEED_VIEW_3D * dx, 1);
  t = actionRotateCameraYZ(t, -DRAG_ROTATE_YZ_SPEED_VIEW_3D * dy, 1);
  return t;
}

/** MIDDLE drag on the panel: the slice, DOWNWARD for a positive bias
 *  (:925-927 -> ActionMoveSliceLevel). */
export const dragSlice = (s, dy, dt) => actionMoveSliceLevel(s, dy, dt);

// ---- the exterior lens ------------------------------------------------
//
// A wholly different camera: ORTHOGRAPHIC, Quaternion.Euler(90,0,0) -
// straight down - and rotated only about -up (ExteriorAutomap.cs:539-543,
// window :1101-1105). So its whole state is a centre, a yaw and an
// orthographic size, and `layoutMultiplier` is the constant 1.0.

/** ComputeZoom (:1004-1015): startZoomMultiplier (the
 *  ExteriorMapDefaultZoomLevel setting) x max(numMaxBlocksX,
 *  numMaxBlocksY) x layoutMultiplier, clamped between maxZoom and
 *  minZoom - which are 25 and 250, and are named the other way round
 *  because they are camera HEIGHTS. */
export function computeExteriorZoom(startZoomMultiplier) {
  const zoom = startZoomMultiplier * EXT_NUM_MAX_BLOCKS * EXT_LAYOUT_MULTIPLIER;
  return Math.min(EXT_MIN_ZOOM * EXT_LAYOUT_MULTIPLIER, Math.max(EXT_MAX_ZOOM * EXT_LAYOUT_MULTIPLIER, zoom));
}

export function createExteriorCamera(startZoomMultiplier = 8, center = [0, 0, 0]) {
  return { center: [...center], yawDeg: 0, orthoSize: computeExteriorZoom(startZoomMultiplier) };
}

/** ActionZoom (:1150-1160): orthographicSize += speed * multiplier,
 *  re-clamped by the same min/max. `speed` arrives already scaled by
 *  dt from the hotkeys (:704) or raw from the wheel. */
export function exteriorZoom(s, speed) {
  const size = s.orthoSize + speed * EXT_LAYOUT_MULTIPLIER;
  return {
    ...s,
    orthoSize: Math.min(EXT_MIN_ZOOM * EXT_LAYOUT_MULTIPLIER, Math.max(EXT_MAX_ZOOM * EXT_LAYOUT_MULTIPLIER, size)),
  };
}
export const exteriorApplyMinZoom = (s) => ({ ...s, orthoSize: EXT_MIN_ZOOM * EXT_LAYOUT_MULTIPLIER });
export const exteriorApplyMaxZoom = (s) => ({ ...s, orthoSize: EXT_MAX_ZOOM * EXT_LAYOUT_MULTIPLIER });

/** ActionRotate (:1101-1107): the camera turns about ITSELF, so the
 *  centre does not move - only the yaw. RotateAround(pos, -up,
 *  -amount*dt) about the camera's own position, under a straight-down
 *  lens, is exactly a yaw change of `-amount * dt`.
 *  SIGN CONVENTION, recorded once for the whole arc: `yawDeg` is the
 *  angle the port's existing map windows already speak - screen-right
 *  is (cos, 0, -sin) and screen-up is (sin, 0, cos), the mirrored
 *  convention automapWindow/exteriorAutomapWindow were written in. So
 *  DFU's "rotate left" button (+rotateSpeed, :1090) DECREASES yawDeg
 *  here. The chrome stage binds the buttons to these verbs rather
 *  than to a sign of its own. */
export const exteriorRotate = (s, amount, dt) => ({ ...s, yawDeg: s.yawDeg - amount * dt });

/** ActionRotateAroundPlayerPos (:1124-1130): the same turn taken about
 *  the PLAYER MARKER, so the centre swings around it too. */
export function exteriorRotateAroundPlayerPos(s, amount, dt, playerPos) {
  const deg = -amount * dt;
  const off = sub(s.center, playerPos);
  const turned = rotateVector(off, [0, -1, 0], deg);
  return { ...s, center: add(playerPos, turned), yawDeg: s.yawDeg + deg };
}

/** GetLocationBorderPos (ExteriorAutomap.cs:347-368): the four jumps
 *  the arrow buttons' RIGHT click takes, at half the layout's own
 *  width/height, with layoutMultiplier folded in as an int cast. */
export function getLocationBorderPos(border, layoutWidth, layoutHeight) {
  const locationWidth = Math.trunc(layoutWidth * EXT_LAYOUT_MULTIPLIER);
  const locationHeight = Math.trunc(layoutHeight * EXT_LAYOUT_MULTIPLIER);
  switch (border) {
    case 'Top': return [0, 0, +locationHeight * 0.5];
    case 'Bottom': return [0, 0, -locationHeight * 0.5];
    case 'Left': return [-locationWidth * 0.5, 0, 0];
    case 'Right': return [+locationWidth * 0.5, 0, 0];
    default: return [0, 0, 0];
  }
}

/** The exterior LEFT drag (:730-740): dragSpeed x the orthographic
 *  size, so a zoomed-out map drags faster. */
export function exteriorDragPan(s, dx, dy) {
  const k = EXT_DRAG_SPEED * s.orthoSize;
  const yaw = s.yawDeg * DEG;
  // the pan is in the ROTATED screen basis: right = (cos, 0, -sin)
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const upXZ = [Math.sin(yaw), 0, Math.cos(yaw)];
  return { ...s, center: add(s.center, add(mul(right, -k * dx), mul(upXZ, k * dy))) };
}
