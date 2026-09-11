// TI2 - THE PHONE IN HAND, TUNED (2026-09-11, Mac: "enhance the mobile
// element of DFJS in terms of camera movement, character movement and
// a more phone built feel"). The PURE halves of the second touch slice,
// with no DOM and no clock of their own, so test/touchinput2.test.js
// can execute each against its mutant:
//
//   - the LOOK NORMALISATION. TI1 fed the finger's raw CSS pixels to
//     the host's look at a flat TOUCH_LOOK_GAIN, so one thumb's sweep
//     turned the camera twice as far on a short phone as on a tall
//     tablet - the drag was measured in pixels and the pixels were
//     whatever the screen had. A drag is now measured in FRACTIONS OF
//     THE CANVAS HEIGHT, referenced to TOUCH_REF_HEIGHT so the shipped
//     feel is unchanged on the phone TI1b was tuned on, and multiplied
//     by the player's own touchLookSensitivity on top of the mouse
//     sensitivity the host applies.
//   - the ANALOG STICK. TI1's stick was 8-way digital: a key engaged
//     at a quarter throw and Run at four fifths. The throw is now the
//     SPEED - InputManager.Update's joystick arm, where the axis value
//     is the stick's own (`ApplyHorizontalForce(joystick.x)` beside
//     :548's FindKeyboardActions, the scale being the analog reading
//     rather than the keyboard's +/-1) - with a radial dead zone
//     rescaled so the first motion past it is a small speed, not a
//     jump to a quarter.
//   - the GYRO LOOK. A phone turned is a camera turned: the device's
//     rotation rate about its axes, mapped by the screen orientation
//     onto the camera's yaw and pitch, one degree of phone one degree
//     of camera at sensitivity 1. Expressed in the host's look units
//     (the pixels its lookScale multiplies), so it rides the same
//     LookFilter, pitch clamp and pause gate as the drag.

/** The canvas height the TI1b gain was tuned against: a phone held
 *  landscape, roughly 400 CSS px tall. At this height the
 *  normalisation is 1 and the shipped feel is exactly TI1b's. */
export const TOUCH_REF_HEIGHT = 400;

/** The stick's radial dead zone, as a fraction of its radius. TI1's
 *  digital stick engaged a key at 0.25; the analog stick starts moving
 *  there too, from zero. */
export const STICK_DEAD_ZONE = 0.25;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * The drag's height normalisation: what one CSS pixel of finger is
 * worth on THIS canvas, relative to the reference phone.
 * @param {number} canvasHeight the canvas's CSS height in px
 * @param {number} sensitivity the player's touchLookSensitivity
 */
export function lookNormalisation(canvasHeight, sensitivity = 1) {
  const h = canvasHeight > 0 ? canvasHeight : TOUCH_REF_HEIGHT;
  return (TOUCH_REF_HEIGHT / h) * clamp(Number(sensitivity) || 1, 0.25, 4);
}

/**
 * The stick's analog reading from the finger's offset from its origin.
 * @param {number} dx finger offset, px
 * @param {number} dy finger offset, px (screen-down positive)
 * @param {number} radius the stick's radius, px
 * @param {number} [dead] the dead zone fraction
 * @returns {{x:number, y:number, mag:number}} x right +, y FORWARD +
 *   (screen-up), both in -1..1; mag the rescaled throw 0..1
 */
export function analogAxes(dx, dy, radius, dead = STICK_DEAD_ZONE) {
  const len = Math.hypot(dx, dy);
  if (!(radius > 0) || len === 0) return { x: 0, y: 0, mag: 0 };
  const raw = Math.min(1, len / radius);
  if (raw < dead) return { x: 0, y: 0, mag: 0 };
  const mag = (raw - dead) / (1 - dead);   // 0 at the dead zone's edge, 1 at full throw
  return { x: (dx / len) * mag, y: (-dy / len) * mag, mag };
}

/**
 * The gyro's contribution for one motion sample, in the host's look
 * units (the pixels the host's lookScale multiplies into radians).
 *
 * DeviceMotionEvent.rotationRate is degrees per second about the
 * DEVICE's axes: alpha about z (out of the screen), beta about x (the
 * short edge), gamma about y (the long edge). Which device axis is the
 * world's vertical depends on how the phone is held:
 *   landscape-primary:   the long edge is horizontal, the short edge
 *                        vertical - turning left/right is BETA, tilting
 *                        up/down is GAMMA;
 *   landscape-secondary: the same axes, both signs flipped;
 *   portrait-primary:    turning is GAMMA, tilting is BETA;
 *   portrait-secondary:  both flipped.
 * A phone held to look at is near upright, so the axis in the screen's
 * plane that is closest to vertical is taken as the turn axis whole;
 * the small error while the phone is tilted forward is the same one
 * every mobile shooter accepts.
 *
 * @param {{alpha:number, beta:number, gamma:number}|null} rate deg/s
 * @param {string} orientation screen.orientation.type
 * @param {number} dt the sample's interval, seconds
 * @param {number} radPerPx the host's lookScale() - radians per look unit
 * @param {number} [sensitivity] degrees of camera per degree of phone
 * @returns {{dx:number, dy:number}} look units; dx right +, dy DOWN +
 *   (the host negates dy exactly as it does the drag's)
 */
export function gyroLookDelta(rate, orientation, dt, radPerPx, sensitivity = 1) {
  if (!rate || !(dt > 0) || !(radPerPx > 0)) return { dx: 0, dy: 0 };
  const beta = Number(rate.beta) || 0, gamma = Number(rate.gamma) || 0;
  let turn, tilt;
  switch (orientation) {
    case 'landscape-secondary': turn = -beta; tilt = -gamma; break;
    case 'portrait-primary': turn = gamma; tilt = beta; break;
    case 'portrait-secondary': turn = -gamma; tilt = -beta; break;
    default: turn = beta; tilt = gamma; break;   // landscape-primary, the shape a phone is played in
  }
  const s = clamp(Number(sensitivity) || 1, 0.25, 4);
  const toPx = (degPerS) => ((degPerS * dt * Math.PI) / 180) * s / radPerPx;
  // Turning the phone's face to the LEFT (yaw) must turn the camera
  // left: that is a negative look dx, and a leftward turn is a positive
  // rotation about the vertical axis by the right-hand rule, so the
  // sign is flipped. Tilting the phone's face UP is likewise a positive
  // rotation about the horizontal axis and must be a negative dy (the
  // host reads screen-down positive and negates).
  return { dx: -toPx(turn), dy: -toPx(tilt) };
}
