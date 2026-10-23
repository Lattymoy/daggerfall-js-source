// HT-WAIST (2026-09-24, Mac: "Let it be a separate animated item on movement with eye of the Beholder sprites
// also"): THE LANTERN AT THE WAIST SWINGS AS YOU MOVE - one law, two bodies.
//
// A lantern hung at the hip is a pendulum on a moving pivot. Neither Daggerfall nor Handheld Torches has one to
// port (the mod's lantern is a first-person hand sprite; DFU has no lantern on any body), so this is the port's
// own, stated once here and fed by both bodies that draw it: the Morrowind third-person body (combat/fpArm.js,
// the lantern mesh at the pelvis) and Eye Of The Beholder's sprite (player/eyeOfTheBeholder/eotbBody.js, the lantern picture at
// the sprite's hip). A second copy in either is how the two would come to swing differently.
//
// THE LAW. Two damped pendulums, one per axis of the body's own frame - FORE (positive: the lantern's foot swings
// forward) and SIDE (positive: out to the body's right) - each
//
//     angle'' = -(g/L) sin(angle) - (a/L) cos(angle) - damping * angle'
//
// where `a` is the PIVOT's acceleration along that axis: the hip speeding up forward throws the lantern back, a
// stop throws it forward, and it settles plumb at rest. The pivot's acceleration is not the motor's - Daggerfall's
// motor reaches walking speed in one frame, which would kick the lantern to its stop at every step off - so the
// hip FOLLOWS the motor's velocity with a short lag (`follow`), and the lantern feels a share of that (`drive`: a
// strap and a hook give, a rigid pivot does not). Walking adds the hip's own sway: a side-to-side push once a
// stride and a fore-aft bob twice (`stride`, the walk cycle's phase, 0..1, from whichever body is walking), in
// proportion to the speed up to a full walk. Turning on the spot swings it outward (the hip's centripetal pull,
// the hip `turnRadius` off the turn's axis). Each angle stops dead at `maxAngle`.
//
// Semi-implicit Euler on fixed sub-steps no longer than `maxStep`, so the swing is the same at 30 and 144 frames a
// second; a frame longer than `maxDt` (a hitch, a tab come back) is cut to it rather than integrated whole.
// Allocation-free: the state object is the caller's, stepped in place.

import { wrapAngle } from '../world/mat4.js';   // BODY-MOTION: the hip lantern's turn (createHipLantern)

export const LANTERN_SWING = Object.freeze({
  length: 0.25,          // m, hook to the lantern's middle: T = 2*pi*sqrt(L/g), about one second
  gravity: 9.81,
  damping: 2.0,          // 1/s: a swing left alone is under a tenth of itself in about two and a half seconds
  drive: 0.3,            // the share of the hip's acceleration the lantern feels
  follow: 0.3,           // s: the hip's lag behind the motor's velocity
  strideSide: 0.6,       // m/s^2: the hip's side sway, once a stride, at full walk
  strideFore: 0.4,       // m/s^2: the hip's fore-aft bob, twice a stride, at full walk
  strideSpeed: 5,        // m/s at which the stride's push is whole - Daggerfall's walk ((50 + 150) / 39.5, PlayerSpeedChanger)
  turnRadius: 0.2,       // m: the hip from the turn's axis (LANTERN_HIP's side)
  maxYawRate: 8,         // rad/s: a mouse flick is not a turn
  maxAngle: 35 * Math.PI / 180,
  maxStep: 1 / 120,
  maxDt: 0.25,
});

/** HT-WAIST-SIZE (2026-10-20, Mac: "the lantern attached to the waist in absolutely gigantic on the morrowind model"):
 *  A LANTERN AT THE WAIST STANDS THIS TALL (metres, ring to foot) on either body - Eye Of The Beholder's picture
 *  (player/eyeOfTheBeholder/eotbLantern.js HIP_LANTERN_SPRITE) and the Morrowind body's mesh, scaled to it about its hook
 *  (combat/fpArm.js hipLanternSize). One height, so the two bodies never hang two sizes of lantern. */
export const HIP_LANTERN_HEIGHT = 0.3;

/** A fresh swing, hanging plumb and still. */
export function createLanternSwing() {
  return { fore: 0, side: 0, foreVel: 0, sideVel: 0, vFore: 0, vSide: 0 };
}

/**
 * One frame of the swing, in place.
 * @param s        the state (createLanternSwing)
 * @param dt       the frame's seconds
 * @param motion   { forward, side } the body's velocity in its own frame (m/s, side positive to the right);
 *                 yawRate (rad/s) the body's turn; stride (0..1 or null) the walk cycle's phase while walking
 */
export function stepLanternSwing(s, dt, { forward = 0, side = 0, yawRate = 0, stride = null } = {}) {
  if (!s || !(dt > 0)) return s;
  const P = LANTERN_SWING;
  const h = Math.min(dt, P.maxDt);
  const n = Math.max(1, Math.ceil(h / P.maxStep));
  const step = h / n;
  const k = 1 - Math.exp(-step / P.follow);
  const w2 = P.gravity / P.length;
  const fw = Number.isFinite(forward) ? forward : 0;
  const sd = Number.isFinite(side) ? side : 0;
  const yr = Math.max(-P.maxYawRate, Math.min(P.maxYawRate, Number.isFinite(yawRate) ? yawRate : 0));
  const walking = stride != null && Number.isFinite(stride);
  const strength = walking ? Math.min(1, Math.hypot(fw, sd) / P.strideSpeed) : 0;
  const phase = walking ? stride * 2 * Math.PI : 0;
  const swayS = strength * P.strideSide * Math.sin(phase);
  const swayF = strength * P.strideFore * Math.sin(2 * phase);
  for (let i = 0; i < n; i++) {
    const pf = s.vFore, ps = s.vSide;
    s.vFore += (fw - s.vFore) * k;
    s.vSide += (sd - s.vSide) * k;
    // the pivot's acceleration: the hip's own change of speed, its pull toward a turn's axis, its stride sway
    const aF = P.drive * (s.vFore - pf) / step + swayF;
    const aS = P.drive * ((s.vSide - ps) / step - yr * yr * P.turnRadius) + swayS;
    s.foreVel += (-w2 * Math.sin(s.fore) - (aF / P.length) * Math.cos(s.fore) - P.damping * s.foreVel) * step;
    s.sideVel += (-w2 * Math.sin(s.side) - (aS / P.length) * Math.cos(s.side) - P.damping * s.sideVel) * step;
    s.fore += s.foreVel * step;
    s.side += s.sideVel * step;
    if (s.fore > P.maxAngle) { s.fore = P.maxAngle; if (s.foreVel > 0) s.foreVel = 0; }
    else if (s.fore < -P.maxAngle) { s.fore = -P.maxAngle; if (s.foreVel < 0) s.foreVel = 0; }
    if (s.side > P.maxAngle) { s.side = P.maxAngle; if (s.sideVel > 0) s.sideVel = 0; }
    else if (s.side < -P.maxAngle) { s.side = -P.maxAngle; if (s.sideVel < 0) s.sideVel = 0; }
  }
  return s;
}

/** The way the lantern hangs, as a unit vector in the body's frame: [right, forward, up]. Plumb is [0, 0, -1]. */
export function lanternSwingDown(s, out = [0, 0, -1]) {
  const cf = Math.cos(s.fore), sf = Math.sin(s.fore), cs = Math.cos(s.side), ss = Math.sin(s.side);
  out[0] = ss; out[1] = sf * cs; out[2] = -cf * cs;
  return out;
}

/** The swing as a row-major 3x3 in a Z-up frame whose +X is the body's right and +Y its forward (a Morrowind
 *  actor's own): Rx(fore) * Ry(-side), which carries the plumb [0, 0, -1] onto `lanternSwingDown`. Written into
 *  `out`, so the per-frame path allocates nothing. */
export function lanternSwingMatrix(s, out = new Float32Array(9)) {
  const cf = Math.cos(s.fore), sf = Math.sin(s.fore), cs = Math.cos(s.side), ss = Math.sin(s.side);
  out[0] = cs; out[1] = 0; out[2] = -ss;
  out[3] = -sf * ss; out[4] = cf; out[5] = -sf * cs;
  out[6] = cf * ss; out[7] = sf; out[8] = cf * cs;
  return out;
}


/**
 * HT-WAIST: THE LANTERN AT THE MORROWIND BODY'S WAIST - the swing and last frame's heading, one per body (combat/fpArm.js
 * keeps one per rig; BODY-MOTION moved it here from the rig's own scope, bible/04-Characters/Body-Motion.md). `step` takes
 * the motor's bag the movement slot already reads (`cam.move`: the input axes and the applied speed), the heading's
 * turn, and the walking body's stride phase (0..1 - the body motion's gait while it walks the legs, else the walk
 * clip's; null standing) - and writes the hang's attitude into `rot` for the pose that follows. At rest it settles plumb.
 * `hipYaw` (radians, the body motion's turn of the hips off the facing - bodyKit.js bodyTurn's sense, + to the left):
 * the hang rides the hips, so the way the body goes is read in theirs (AUDIT BODY-MOTION RIG-7: read in the facing's, a
 * strafe's lantern swung 60 degrees off its own way, the hips turned toward the travel under it).
 */
export function createHipLantern() {
  const swing = createLanternSwing();
  let yaw = null;
  return {
    swing,
    /** Hanging still and plumb again (a new body, a lantern lit afresh). */
    reset() { Object.assign(swing, createLanternSwing()); yaw = null; },
    step(cam, dt, stride, rot, hipYaw = 0) {
      const mv = (cam && cam.move) || null;
      const f0 = mv ? (mv.forward || 0) : 0, s0 = mv ? (mv.strafe || 0) : 0;
      const ch = Math.cos(Number(hipYaw) || 0), sh = Math.sin(Number(hipYaw) || 0);
      const f = f0 * ch - s0 * sh, st = s0 * ch + f0 * sh;   // the hips' forward (-sin, cos) and right (cos, sin) of the turn
      const len = Math.hypot(f, st);
      const speed = len > 0 && mv ? (mv.speed || 0) : 0;
      const y = cam ? (cam.yaw || 0) : 0;
      const yawRate = yaw != null && dt > 0 ? wrapAngle(y - yaw) / dt : 0;
      yaw = y;
      stepLanternSwing(swing, dt, {
        forward: len > 0 ? speed * f / len : 0,
        side: len > 0 ? speed * st / len : 0,
        yawRate,
        stride: speed > 0 && stride != null ? stride : null,
      });
      lanternSwingMatrix(swing, rot);
    },
  };
}
