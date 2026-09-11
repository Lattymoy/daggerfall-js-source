// GP1 - THE GAMEPAD LAYER (2026-09-11). InputManager.cs's joystick
// law, the half the port never had: "AXES + JOYSTICK (AxisActions,
// JoystickUIActions): no gamepad layer in the port" stood flagged at
// inputActions.js since I2. This module is the PURE half - no DOM, no
// Gamepad API, no frame - so test/gamepad.test.js can execute each law
// against its mutant; ui/gamepadInput.js is the poller that feeds it.
//
// WHAT DFU HAS. Unity's Input Manager exposes sixteen joystick axes
// named "Axis1".."Axis16" (ProjectSettings/InputManager.asset: type 2,
// dead 0.19, sensitivity 1; Axis2 and Axis5 - the sticks' Y - carry
// `invert: 1` so up is positive) and twenty buttons JoystickButton0..19.
// InputManager binds four AXIS ACTIONS to axis names (:306-312, the
// defaults at :1034-1037: Axis1/Axis2 the left stick to movement,
// Axis4/Axis5 the right stick to the camera), four JOYSTICK UI ACTIONS
// to buttons (:314-320, :1039-1042: A left-click, Y right-click, X
// middle-click, B back), and any ordinary Action to a joystick BUTTON
// or to an AXIS KEY - a synthetic KeyCode from 5000 up, two per axis,
// "JoystickAxis3Button0" for the positive half and "...Button1" for
// the negative (:33, :1743-1766, polled at :1655-1664).
//
// THE BROWSER'S PAD is the Gamepad API's "standard" mapping: axes 0/1
// the left stick (Y DOWN positive), 2/3 the right stick, buttons 0-3
// the face (A B X Y), 4/5 the bumpers, 6/7 the triggers (analog), 8/9
// back/start, 10/11 the stick clicks, 12-15 the d-pad. Unity on
// Windows lays the same pad out as: Axis1/2 left stick, Axis3 the
// triggers combined, Axis4/5 right stick, Axis6/7 the d-pad, Axis9/10
// the triggers apart, buttons 0-5 as the face and bumpers, 6/7
// back/start, 8/9 the stick clicks. `unityAxes` and `unityButtons`
// are that table, with the asset's dead zone and inversions applied,
// so everything downstream reads Unity's numbers and DFU's law holds
// unchanged.
import { getBool, getFloat } from './settings.js';

export const AXIS_ACTIONS = Object.freeze(['MovementHorizontal', 'MovementVertical', 'CameraHorizontal', 'CameraVertical']);
export const JOYSTICK_UI_ACTIONS = Object.freeze(['LeftClick', 'RightClick', 'MiddleClick', 'Back']);
/** "there are only 16 recognized axes" (:32). */
export const NUM_AXES = 16;
/** startingAxisKeyCode (:33): the synthetic KeyCode of Axis1's positive half. */
export const AXIS_KEY_BASE = 5000;
/** ResetDefaults :1034-1037. */
export const DEFAULT_AXIS_BINDINGS = Object.freeze([
  ['Axis1', 'MovementHorizontal'], ['Axis2', 'MovementVertical'], ['Axis4', 'CameraHorizontal'], ['Axis5', 'CameraVertical'],
]);
/** ResetDefaults :1039-1042. */
export const DEFAULT_JOYSTICK_UI = Object.freeze([
  ['JoystickButton0', 'LeftClick'], ['JoystickButton3', 'RightClick'], ['JoystickButton2', 'MiddleClick'], ['JoystickButton1', 'Back'],
]);
/** The asset's per-axis dead zone (InputManager.asset `dead: 0.19` on
 *  every joystick axis): a reading inside it is 0 before DFU ever sees
 *  it. Unity clips; it does not rescale. */
export const UNITY_AXIS_DEAD = 0.19;
/** controllerCursorHorizontalSpeed / Vertical (:51-52), screen px/s at sensitivity 1. */
export const CURSOR_SPEED = 900;
/** PlayerMouseLook's serialized `sensitivity` (Vector2(2, 2), PlayerMouseLook.cs:38)
 *  - a field, not the MouseLookSensitivity setting, which is the
 *  separate `sensitivityScale` the mouse arm multiplies by (:126). */
export const LOOK_SENSITIVITY_FIELD = 2;

/** The Gamepad API standard button index -> Unity's JoystickButtonN. */
export const STANDARD_TO_UNITY_BUTTON = Object.freeze({ 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 8: 6, 9: 7, 10: 8, 11: 9 });

// ── axis key codes (:1743-1766) ─────────────────────────────────────

/** AxisKeyCodeToInputAxis: the axis a synthetic key reads, '' below the base or past the sixteen. */
export function axisOfKey(key) {
  if (!(key >= AXIS_KEY_BASE)) return '';
  const n = ((key - AXIS_KEY_BASE) >> 1) + 1;
  return n > NUM_AXES ? '' : `Axis${n}`;
}
/** AxisKeyCodeToString: "JoystickAxis3Button0" - Button0 the positive half, Button1 the negative. */
export function axisKeyName(key) {
  const axis = axisOfKey(key);
  return axis ? `Joystick${axis}Button${key % 2}` : '';
}
/** The inverse: the synthetic key of a name, or null for any other string. */
export function parseAxisKeyName(s) {
  const m = /^JoystickAxis(\d{1,2})Button([01])$/.exec(s ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > NUM_AXES) return null;
  return AXIS_KEY_BASE + (n - 1) * 2 + Number(m[2]);
}
export const isAxisKeyName = (s) => parseAxisKeyName(s) !== null;
/** The axis number 1..16 of an axis name "AxisN", or 0. */
export const axisNumber = (axis) => { const m = /^Axis(\d{1,2})$/.exec(axis ?? ''); const n = m ? Number(m[1]) : 0; return n >= 1 && n <= NUM_AXES ? n : 0; };
/** GetAxisKey (:1655-1664): the even key is `axis > 0`, the odd `axis < 0`. */
export function axisKeyDown(axes, key) {
  if (!(key >= AXIS_KEY_BASE)) return false;
  const n = axisNumber(axisOfKey(key));
  if (!n) return false;
  const v = axes[n] ?? 0;
  return key % 2 === 0 ? v > 0 : v < 0;
}

// ── the browser's pad in Unity's frame ──────────────────────────────

/** The asset's dead zone: a clip, not a rescale. */
export const unityDead = (v) => (Math.abs(v) < UNITY_AXIS_DEAD ? 0 : v);

/**
 * Sixteen Unity axes (index 1..16; [0] unused) from a Gamepad-like
 * object ({axes: number[], buttons: {value, pressed}[]}) on the
 * standard mapping. Y axes flipped to up-positive as the asset's
 * `invert: 1` on Axis2/Axis5 does; the d-pad and triggers as axes,
 * which is where Unity puts them.
 */
export function unityAxes(pad, out = new Float32Array(NUM_AXES + 1)) {
  const ax = (i) => Number(pad?.axes?.[i]) || 0;
  const bv = (i) => { const b = pad?.buttons?.[i]; return b == null ? 0 : (Number(b.value) || (b.pressed ? 1 : 0)); };
  out.fill(0);
  out[1] = unityDead(ax(0));
  out[2] = unityDead(-ax(1));
  out[3] = unityDead(bv(6) - bv(7));
  out[4] = unityDead(ax(2));
  out[5] = unityDead(-ax(3));
  out[6] = unityDead(bv(15) - bv(14));
  out[7] = unityDead(bv(12) - bv(13));
  out[9] = unityDead(bv(6));
  out[10] = unityDead(bv(7));
  return out;
}

/** The Unity button names down on a standard-mapping pad. */
export function unityButtons(pad, out = new Set()) {
  out.clear();
  const bs = pad?.buttons ?? [];
  for (let i = 0; i < bs.length; i++) {
    const u = STANDARD_TO_UNITY_BUTTON[i];
    if (u !== undefined && bs[i]?.pressed) out.add(`JoystickButton${u}`);
  }
  return out;
}

// ── the frame's law ─────────────────────────────────────────────────

/**
 * FindInputAxisActions (:1872-1928): the movement stick. Null below the
 * radial dead zone; else each axis is ±dist where dist is the throw over
 * JoystickMovementThreshold capped at 1 (or 1 outright under
 * MaximizeJoystickMovement), with the four move actions raised and
 * MoveBackwards clearing the autorun latch - the diagonal is FULL on
 * both axes, not a unit vector.
 */
export function movementAxes(h, v, { deadzone = 0.1, threshold = 0.9, maximize = false, invertH = false, invertV = false } = {}) {
  if (h === 0 && v === 0) return null;
  if (invertH) h = -h;
  if (invertV) v = -v;
  const jd = Math.hypot(h, v);
  if (jd <= deadzone) return null;
  let dist = jd / threshold;
  if (maximize || dist > 1) dist = 1;
  const actions = [];
  let x = 0, y = 0;
  if (h > 0) { actions.push('MoveRight'); x = dist; } else if (h < 0) { actions.push('MoveLeft'); x = -dist; }
  if (v > 0) { actions.push('MoveForwards'); y = dist; } else if (v < 0) { actions.push('MoveBackwards'); y = -dist; }
  return { x, y, actions, clearsAutorun: v < 0 };
}

/**
 * Update :525-540: the camera stick stands in for the mouse when the
 * mouse is idle - the raw axes past the radial dead zone, each
 * inverted by its own AxisActions flag.
 */
export function cameraAxes(h, v, { deadzone = 0.1, invertH = false, invertV = false } = {}) {
  let x = 0, y = 0;
  if (Math.hypot(h, v) > deadzone) { x = h; y = v; }
  if (invertH) x = -x;
  if (invertV) y = -y;
  return { x, y };
}

/** PlayerMouseLook.ApplyLook :114-122: under a controller the look is
 *  axis * sensitivity(2) * JoystickLookSensitivity * 60 * dt, in
 *  DEGREES - a full stick at 1.0 turns 120 degrees a second, whatever
 *  the frame rate, and the mouse setting plays no part. */
export function controllerLookDegrees(axis, dt, joystickLookSensitivity = 1) {
  return axis * LOOK_SENSITIVITY_FIELD * joystickLookSensitivity * 60 * dt;
}
/** ApplySmoothing :159-160: a controller never smooths below 0.5. */
export const controllerSmoothing = (smoothing) => (smoothing < 0.5 ? 0.5 : smoothing);

/** UpdateControllerCursorPosition :1558-1562: the cursor's step in
 *  screen px, JoystickCursorSensitivity * 900 * axis * dt on each. */
export function cursorStep(h, v, dt, cursorSensitivity = 1) {
  return { dx: cursorSensitivity * CURSOR_SPEED * h * dt, dy: cursorSensitivity * CURSOR_SPEED * v * dt };
}

/** GetUIScrollMovement (:1249-1280): the camera stick as a scroll -
 *  0 inside the dead zone, else horizontal minus vertical (the
 *  vertical flipped so a stick tilted down scrolls down). */
export function uiScrollMovement(h, v, { deadzone = 0.1, invertH = false, invertV = false } = {}) {
  if (invertH) h = -h;
  if (invertV) v = -v;
  if (Math.hypot(h, v) <= deadzone) return 0;
  return h + -v;
}

/** The five Controls keys, read live - the launcher's LIVE tier. */
export function controllerSettings() {
  return {
    enabled: getBool('Controls', 'EnableController'),
    deadzone: getFloat('Controls', 'JoystickDeadzone', 0, 1),
    threshold: getFloat('Controls', 'JoystickMovementThreshold', 0.05, 1),
    lookSensitivity: getFloat('Controls', 'JoystickLookSensitivity', 0.1, 4),
    cursorSensitivity: getFloat('Controls', 'JoystickCursorSensitivity', 0.1, 4),
  };
}
