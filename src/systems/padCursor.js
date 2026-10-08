// @ts-check
// PAD-CURSOR (a recorded departure, Port-Ledger A; the player: "For controllers, where applicable, can we add a sort
// of navigatable cursor? Like destiny? For all the menus"). THE CONTROLLER CURSOR'S FEEL.
//
// DFU's controller cursor (InputManager.UpdateControllerCursorPosition :1558-1562, ported as systems/gamepad.js
// cursorStep) is LINEAR: JoystickCursorSensitivity * 900 px a second times the raw axis, no ramp, no pull - fast
// enough to cross the screen, too fast to stop on a button. Destiny's cursor is the model the player named, and its
// feel is four things, each pure here so the poller (ui/gamepadInput.js) and the front door (ui/menuPad.js) share
// one law:
//
//   1. A RESPONSE CURVE: the throw past the dead zone, rescaled to 0..1 and raised to CURVE - a light lean is a fine
//      move, a full lean the full speed.
//   2. A RAMP: the velocity eases toward what the stick asks over RAMP_S, so a flick does not jump; letting go stops
//      it at once (a cursor that coasts past a button is the thing this exists to fix).
//   3. A BOOST: a full lean held past BOOST_AFTER_S climbs to BOOST times the speed over BOOST_RAMP_S - across a wide
//      screen without a fast setting.
//   4. MAGNETISM: over a control the speed is FRICTION of itself (unless boosting - a long full lean goes through);
//      and with the stick light (under PULL_MAX_STICK) or at rest, the cursor is drawn to the centre of the control
//      it is over - or of one within PULL_RADIUS - at PULL per second, the lighter the stick the stronger. The pull
//      never fights a deliberate push.
//
// The targets are whatever the caller can see: the DOM's controls (ui/plusPad.js interactiveAt/nearestControl), and
// any canvas window that publishes its buttons through `setPadCursorTargets` (none yet - the classic native windows
// are a slice of their own; over them the curve, the ramp and the boost still apply).
//
// `padCursorAssist` (systems/uiPrefs.js, on by default) switches all four off and the step is DFU's cursorStep again.

import { cursorStep, CURSOR_SPEED } from './gamepad.js';
import { getPref } from './uiPrefs.js';

export const PAD_CURSOR = Object.freeze({
  CURVE: 1.7,
  RAMP_S: 0.1,
  BOOST: 1.6,
  BOOST_AFTER_S: 0.45,
  BOOST_RAMP_S: 0.3,
  FULL_LEAN: 0.95,
  FRICTION: 0.4,
  PULL: 10,
  PULL_RADIUS: 28,
  PULL_MAX_STICK: 0.5,
});

/** Whether the assisted feel is in force (the pref; a broken store reads as on - the default). */
export function padCursorAssist() {
  try { return getPref('padCursorAssist') !== false; } catch { return true; }
}

/** A cursor's carried state: its velocity (screen px/s, y down) and how long the stick has been at a full lean. */
export function createPadCursorState() {
  return { vx: 0, vy: 0, full: 0 };
}

/** The throw past the dead zone as 0..1, curved. Pure. */
export function curvedThrow(mag, deadzone, curve = PAD_CURSOR.CURVE) {
  if (!(mag > deadzone)) return 0;
  const m = Math.min(1, (mag - deadzone) / Math.max(1e-6, 1 - deadzone));
  return Math.pow(m, curve);
}

/**
 * One frame of the cursor. `h`, `v` are the stick (Unity axes: +v is UP); `speed` is the full-lean px/s
 * (JoystickCursorSensitivity * 900 * the Plus stick multiplier); `over` is whether the cursor stands on a control;
 * `target` is the control to pull toward ({ x, y } its centre, client px) or null; `at` is the cursor ([x, y]).
 * Answers { dx, dy } in screen px (y DOWN) and advances `state`. Pure apart from `state`.
 */
export function stepPadCursor(state, { h = 0, v = 0, dt = 0, deadzone = 0.1, speed = CURSOR_SPEED, over = false, target = null, at = null } = {}) {
  const P = PAD_CURSOR;
  const mag = Math.hypot(h, v);
  const k = curvedThrow(mag, deadzone);
  const raw = mag > deadzone ? Math.min(1, (mag - deadzone) / Math.max(1e-6, 1 - deadzone)) : 0;
  state.full = raw >= P.FULL_LEAN ? state.full + dt : 0;
  const boost = 1 + (P.BOOST - 1) * Math.min(1, Math.max(0, (state.full - P.BOOST_AFTER_S) / P.BOOST_RAMP_S));
  let tx = 0, ty = 0;
  if (k > 0) {
    const s = speed * k * boost * (over && boost === 1 ? P.FRICTION : 1);
    tx = (h / mag) * s;
    ty = (-v / mag) * s;   // Unity's y is up; the screen's is down
  }
  if (k === 0) { state.vx = 0; state.vy = 0; }   // let go: it stops - nothing coasts past a button
  else {
    const a = Math.min(1, dt / P.RAMP_S);
    state.vx += (tx - state.vx) * a;
    state.vy += (ty - state.vy) * a;
  }
  let dx = state.vx * dt, dy = state.vy * dt;
  if (target && at && raw < P.PULL_MAX_STICK) {
    const ox = target.x - at[0], oy = target.y - at[1];
    const pull = Math.min(1, P.PULL * dt) * (1 - raw / P.PULL_MAX_STICK);
    dx += ox * pull;
    dy += oy * pull;
  }
  return { dx, dy };
}

/** DFU's step, for `padCursorAssist` off - screen px, y DOWN. */
export function linearPadCursorStep(h, v, dt, sensitivity) {
  const st = cursorStep(h, v, dt, sensitivity);
  return { dx: st.dx, dy: -st.dy };
}

// ── The canvas windows' buttons ──────────────────────────────────────
// A canvas-drawn window has no DOM for the pull to find. One that wants the pull hands its buttons here as client-px
// rects ({ x, y, w, h }) through a getter read each frame; the slot holds one source, the window that is up.
let _targets = null;
export function setPadCursorTargets(getter) { _targets = typeof getter === 'function' ? getter : null; }
export function padCursorCanvasTargets() {
  try { return _targets?.() ?? []; } catch { return []; }
}

/** The rect a point is inside, or the nearest whose edge is within `radius` - centre and inside flag - or null. */
export function pullTargetAmong(rects, x, y, radius = PAD_CURSOR.PULL_RADIUS) {
  let best = null, bestD = Infinity;
  for (const r of rects ?? []) {
    if (!r || !(r.w > 0) || !(r.h > 0)) continue;
    const ex = Math.max(r.x - x, 0, x - (r.x + r.w)), ey = Math.max(r.y - y, 0, y - (r.y + r.h));
    const d = Math.hypot(ex, ey);
    if (d > radius || d >= bestD) continue;
    bestD = d;
    best = { x: r.x + r.w / 2, y: r.y + r.h / 2, inside: d === 0 };
  }
  return best;
}

/** The front door's cursor law, handed IN to ui/menuPad.js (a leaf the desktop launcher serves alone - DA12 - so it
 *  imports nothing): the switch, the state, the step, DFU's step, the pull's target, its radius and the full speed. */
export const padDoorCursorLaw = Object.freeze({
  assist: padCursorAssist, createState: createPadCursorState, step: stepPadCursor, linear: linearPadCursorStep,
  pullTarget: pullTargetAmong, PULL_RADIUS: PAD_CURSOR.PULL_RADIUS, SPEED: CURSOR_SPEED,
});
