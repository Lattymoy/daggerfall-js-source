// @ts-check
// CARDS2b (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 12; Mac: "a sort of table enviroment where you can
// see other players sprites"): THE SEATED BODY'S REQUEST - pure. Morrowind has no sitting animation, so the seat is
// posed the way CLIMB6 poses a climb: a request in the WORLD (metres, Y up, the body facing `yaw`) that
// combat/climbRig.js's climbRequestToRig maps into the rig and applyClimbRig solves on the skeleton's own bones - the
// hips lowered onto the chair, the feet planted on the floor before it with the knees forward, the forearms on the
// table, the head on the table's middle. No number here names a bone: the solver reads every length off the skeleton
// it is handed, so a body too short for a pose takes the nearest it reaches.
//
// THE WIRE carries the seat as `st` (net/wire.js seatOf): the table's top above the sitter's feet in SEAT_TOP_STEP
// steps, 1..POSE_SEAT_TOP_MAX - so every reader poses the hands on the same table the sitter sees, and a pose off the seat
// omits it (validLook's `class` law).
//
// Not a DFU member: Daggerfall Unity has no seat. Ledger A row (TAVERN CARDS).
import { POSE_SEAT_TOP_MAX } from '../net/wire.js';   // the wire's bound - one home
import { EYE_HEIGHT } from './motor.js';   // the standing eye the seated one is lowered from

/** The wire's step for the table's top above the feet, metres. */
export const SEAT_TOP_STEP = 0.05;
/** A table's top when the wire names none (an older relay's pose has no `st` at all; this is never sent). */
export const SEAT_TOP_DEFAULT = 0.8;

/** MEASURED (CARDS2b) on retail's biped (Weapon Sheathing's vendored xbase_anim_sh.nif, test/cards2b_seated.test.js):
 *  its pelvis stands at 1.09 m, its thigh is 0.46 m and its shin 0.53 m, so a drop of 0.48 m puts the hips level with
 *  the knees over shins standing straight - a chair's sitter. */
export const SEAT_HIP_DROP = 0.48;
/** The seated eye above the floor: the standing eye (motor.js EYE_HEIGHT) lowered by the hips' drop, so the first
 *  person looks from where the seated body's head is. */
export const SEATED_EYE_HEIGHT = EYE_HEIGHT - SEAT_HIP_DROP;
/** MEASURED (CARDS2b, the same biped): the feet a thigh's length before the hips (the shins straight down), either side
 *  of the body's middle, the ankle off the floor. */
export const SEAT_FOOT_AHEAD = 0.45;
export const SEAT_FOOT_SIDE = 0.12;
export const SEAT_ANKLE = 0.08;
/** MEASURED (CARDS2b, the same biped): the hands on the table - as far ahead of the hips as its seated arms reach
 *  (cardTables.js SEAT_OUT puts the edge there), either side, a forearm's thickness over the top. */
export const SEAT_HAND_AHEAD = 0.45;
export const SEAT_HAND_SIDE = 0.2;
export const SEAT_HAND_OVER = 0.04;
/** How hard the head turns to the table's middle (the solver caps the turn at 70 degrees off the chest). */
export const SEAT_LOOK_WEIGHT = 0.6;

/** The table's top above the feet as the wire's byte. */
export const seatTopByte = (top) => Math.min(POSE_SEAT_TOP_MAX, Math.max(1, Math.round((Number(top) || 0) / SEAT_TOP_STEP)));
/** ...and back. */
export const seatTopOf = (st) => (Number.isInteger(st) && st >= 1 && st <= POSE_SEAT_TOP_MAX ? st * SEAT_TOP_STEP : SEAT_TOP_DEFAULT);

/**
 * The seated body's request: `{ origin, yaw, req }` - `origin` the feet the body is drawn at (the seat, on the floor),
 * `req` the climb rig's world request (combat/climbRig.js's header names every field). `top` is the table's top above
 * the feet, metres.
 * @param {number[]} feet
 * @param {number} yaw
 * @param {number} [top]
 */
export function seatRigInput(feet, yaw, top = SEAT_TOP_DEFAULT) {
  const f = [Math.sin(yaw), 0, Math.cos(yaw)];
  const r = [Math.cos(yaw), 0, 0 - Math.sin(yaw)];   // `0 -`, never a bare `-`: due south's -0 is no way a request should carry
  const at = (ahead, side, up) => [feet[0] + f[0] * ahead + r[0] * side, feet[1] + up, feet[2] + f[2] * ahead + r[2] * side];
  const elbow = (side) => { const v = [r[0] * side + 0, -1, r[2] * side + 0]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const hand = (side) => ({ at: at(SEAT_HAND_AHEAD, side * SEAT_HAND_SIDE, top + SEAT_HAND_OVER), fingers: f.slice(), palm: [0, -1, 0], pole: elbow(side), w: 1, curl: 0.3 });
  const foot = (side) => ({ at: at(SEAT_FOOT_AHEAD, side * SEAT_FOOT_SIDE, SEAT_ANKLE), toe: f.slice(), pole: f.slice(), w: 1 });
  return {
    origin: [feet[0], feet[1], feet[2]],
    yaw,
    req: {
      w: 1,
      offset: [0, -SEAT_HIP_DROP, 0],
      hands: { L: hand(-1), R: hand(1) },
      feet: { L: foot(-1), R: foot(1) },
      look: { at: at(1, 0, top), w: SEAT_LOOK_WEIGHT },
    },
  };
}
