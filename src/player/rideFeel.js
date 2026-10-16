// @ts-check
// RIDE-FEEL (2026-10-16, the owner: "The morrowind horse in first person also needs a better screen animation"): THE
// SADDLE'S VIEW, ANIMATED - pure. COATS3D drew the first-person 3D horse (player/mwView.js mwViewDrawSaddle) locked to
// the view: its heading the camera's every frame - the neck nailed to the screen's middle, a turn of the mouse turning
// the whole horse with it, a strafe sliding it sideways - and the eye bobbing on HeadBobber's own clock (headBobber.js
// Horse style, DFU's, made for a flat riding sprite) while the horse's back rose and fell on its gait's: two motions
// that never met, so the neck bounced against the eye. Now, in first person astride the 3D horse:
//  - THE EYE RIDES THE BACK (`rideEye`): HeadBobber's offset taken out of the eye and the saddle's own put in - the
//    Spine-carried seat's rise and sway off its rest (world/horseRig.js HORSE_SEAT), RIDE_BACK_FOLLOW of it (a rider
//    gives a little). The world rises and falls with the stride the legs are seen to take, and the back stays under
//    the eye;
//  - THE HORSE TURNS UNDER THE RIDER (`stepRide`): its heading follows the view's over RIDE_TURN_TAU, never more than
//    RIDE_TURN_MAX behind, and at a pace bends toward the way it travels (a strafe walks it crabwise, RIDE_CRAB_MAX at
//    most) - the neck swings out on a turn and comes back under the eye;
//  - IT BANKS INTO A TURN (`stepRide`'s `bank`, `leanModel`): at speed, leant toward the turn's inside - half the angle
//    a body turning at that rate and pace leans (atan(v w / g)), RIDE_BANK_MAX at most - about the saddle, so the
//    rider's eye stays where it sits.
// First person only: the third-person rider and its horse are one picture turned with the body, as before. Not a DFU
// member: DFU's horse is a sprite (TransportManager) and its bob HeadBobber's - both kept for the sprite. Ledger A
// (RIDE-FEEL).
import { quatAngleAxis, quatRotate, mat4FromQuatPos } from '../world/quat.js';
import { multiply } from '../world/mat4.js';

/** How much of the saddle's own rise and sway the eye takes (the rest the rider's seat and back give). */
export const RIDE_BACK_FOLLOW = 0.85;
/** HeadBobber's offset is read as the eye less the saddle's height over the feet; past RIDE_BOB_CLEAR of it (metres) the
 *  eye is not the saddle's - mounting, swimming, knocked down - and is let be, wholly so by RIDE_BOB_REACH. The Horse
 *  style reaches 0.12, the Running style 0.14. */
export const RIDE_BOB_CLEAR = 0.18;
export const RIDE_BOB_REACH = 0.3;
/** The heading's ease toward the view's (seconds), and how far behind it may fall (radians, 35 degrees). */
export const RIDE_TURN_TAU = 0.2;
export const RIDE_TURN_MAX = (35 * Math.PI) / 180;
/** The crab: from RIDE_CRAB_FROM m/s to RIDE_CRAB_FULL the heading bends toward the travel's, by at most RIDE_CRAB_MAX
 *  (radians, 30 degrees) - never for a travel more than RIDE_CRAB_REACH off the view's (backing up turns no horse). */
export const RIDE_CRAB_FROM = 0.4;
export const RIDE_CRAB_FULL = 2;
export const RIDE_CRAB_MAX = (30 * Math.PI) / 180;
export const RIDE_CRAB_REACH = (100 * Math.PI) / 180;
/** The bank: RIDE_BANK_SHARE of a turning body's own lean (atan(v w / g)), at most RIDE_BANK_MAX (radians, 7 degrees),
 *  eased over RIDE_BANK_TAU seconds. */
export const RIDE_BANK_SHARE = 0.5;
export const RIDE_BANK_MAX = (7 * Math.PI) / 180;
export const RIDE_BANK_TAU = 0.25;
const GRAVITY = 9.81;

/** An angle in (-pi, pi]. */
export const wrapPi = (a) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A fresh ride: no heading yet (the first step takes the view's), level. */
export const freshRide = () => ({ yaw: /** @type {number | null} */ (null), bank: 0, rate: 0 });

/**
 * One frame of the horse under the rider: `yaw` the view's heading (radians, 0 down +Z - the motor's), `travel` the
 * heading the feet moved along this frame (null standing), `speed` the ground speed (m/s), `dt` seconds. Answers the
 * next ride - `{ yaw, bank, rate }`: the horse's heading, its lean (radians about its forward axis: positive its top
 * to its right) and its turn rate (radians a second, positive toward its right).
 * @param {{ yaw: number | null, bank: number, rate: number }} r
 * @param {{ yaw: number, travel?: number | null, speed?: number, dt?: number }} f
 */
export function stepRide(r, { yaw, travel = null, speed = 0, dt = 0 }) {
  if (r.yaw == null || !Number.isFinite(r.yaw)) return { yaw: wrapPi(yaw), bank: 0, rate: 0 };
  let target = yaw;
  const pace = clamp((speed - RIDE_CRAB_FROM) / (RIDE_CRAB_FULL - RIDE_CRAB_FROM), 0, 1);
  if (travel != null && pace > 0) {
    const d = wrapPi(travel - yaw);
    if (Math.abs(d) <= RIDE_CRAB_REACH) target = yaw + clamp(d, -RIDE_CRAB_MAX, RIDE_CRAB_MAX) * pace;
  }
  const k = dt > 0 ? Math.min(1, dt / RIDE_TURN_TAU) : 0;
  let next = r.yaw + wrapPi(target - r.yaw) * k;
  const behind = wrapPi(target - next);
  if (Math.abs(behind) > RIDE_TURN_MAX) next = target - Math.sign(behind) * RIDE_TURN_MAX;
  const rate = dt > 0 ? wrapPi(next - r.yaw) / dt : 0;
  const want = clamp(Math.atan((Math.max(0, speed) * rate) / GRAVITY) * RIDE_BANK_SHARE, -RIDE_BANK_MAX, RIDE_BANK_MAX);
  const bank = r.bank + (want - r.bank) * (dt > 0 ? Math.min(1, dt / RIDE_BANK_TAU) : 0);
  return { yaw: wrapPi(next), bank, rate };
}

/**
 * The first-person eye astride: `fpEye` the host's (the motor's eye - its feet, the saddle's height RIDE_EYE_HEIGHT and
 * HeadBobber's offset), `feet` the feet it stands on, `eyeHeight` the saddle's eye over them, `yaw` the view's heading,
 * `seat` the saddle's point in the world this frame (horseRig.seat), `seatRest` its height over the horse's feet at rest.
 * HeadBobber's offset out, RIDE_BACK_FOLLOW of the seat's rise and sideways sway in. An eye that is not the saddle's
 * (RIDE_BOB_CLEAR..RIDE_BOB_REACH off it) is handed back as it came, blended in between.
 * @param {number[]} fpEye @param {number[]} feet @param {number} eyeHeight @param {number} yaw @param {number[]} seat @param {number} seatRest
 */
export function rideEye(fpEye, feet, eyeHeight, yaw, seat, seatRest) {
  const bob = [fpEye[0] - feet[0], fpEye[1] - feet[1] - eyeHeight, fpEye[2] - feet[2]];
  const off = Math.hypot(bob[0], bob[1], bob[2]);
  const w = clamp(1 - (off - RIDE_BOB_CLEAR) / (RIDE_BOB_REACH - RIDE_BOB_CLEAR), 0, 1);
  if (!(w > 0)) return [fpEye[0], fpEye[1], fpEye[2]];
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const sway = ((seat[0] - feet[0]) * rx + (seat[2] - feet[2]) * rz) * RIDE_BACK_FOLLOW;
  const rise = (seat[1] - feet[1] - seatRest) * RIDE_BACK_FOLLOW;
  const ride = [feet[0] + rx * sway, feet[1] + eyeHeight + rise, feet[2] + rz * sway];
  return [fpEye[0] + (ride[0] - fpEye[0]) * w, fpEye[1] + (ride[1] - fpEye[1]) * w, fpEye[2] + (ride[2] - fpEye[2]) * w];
}

/**
 * A placed model (`model` column-major) leant `bank` radians about its forward axis (`yaw`'s heading - positive its top
 * to its right) through `pivot` (the saddle), so the pivot stands where it stood. Level: the model itself.
 * @param {Float32Array | number[]} model @param {number} bank @param {number} yaw @param {number[]} pivot
 */
export function leanModel(model, bank, yaw, pivot) {
  if (!bank) return model;
  // a turn about the forward axis by -bank leans the top toward the right (the forward axis's own turn leans it left)
  const q = quatAngleAxis((-bank * 180) / Math.PI, [Math.sin(yaw), 0, Math.cos(yaw)]);
  const rp = quatRotate(q, pivot);
  return multiply(mat4FromQuatPos(q, [pivot[0] - rp[0], pivot[1] - rp[1], pivot[2] - rp[2]]), model);
}
