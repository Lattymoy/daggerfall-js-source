// @ts-check
// CARDS2b (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 12; Mac: "a sort of table enviroment where you can
// see other players sprites"): THE SEATED BODY'S REQUEST - pure. Morrowind has no sitting animation, so the seat is
// posed the way CLIMB6 poses a climb: a request in the WORLD (metres, Y up, the body facing `yaw`) that
// combat/climbRig.js's climbRequestToRig maps into the rig and applyClimbRig solves on the skeleton's own bones - the
// hips lowered onto the chair, the feet planted on the floor before it with the knees forward, the hands on the table.
// No number here names a bone: the solver reads every length off the skeleton it is handed, and the body's own
// distances scale with its race (AUDIT CARDS D2), so a tall Altmer and a short Bosmer sit as the measured biped does.
// No head turn (AUDIT CARDS D1): the biped's clavicles hang from its neck, so a look solved after the arms carried the
// hands off their marks - and a seat square to its side already faces the table.
//
// THE WIRE carries the seat as `st` (net/wire.js seatOf): the table's top above the sitter's feet in SEAT_TOP_STEP
// steps, 1..POSE_SEAT_TOP_MAX - so every reader poses the hands on the same table the sitter sees, and a pose off the seat
// omits it (validLook's `class` law).
//
// FLAGGED (Tavern-Cards.md section 12, CARDS2c): the seat poses the Morrowind body alone - Eye Of The Beholder has no sitting art, so a sprite body (a peer's walker, their paperdoll) stands at its seat facing the table.
//
// Not a DFU member: Daggerfall Unity has no seat. Ledger A row (TAVERN CARDS).
import { POSE_SEAT_TOP_MAX } from '../net/wire.js';   // the wire's bound - one home
import { EYE_HEIGHT } from './motor.js';   // the standing eye the seated one is lowered from
import { climbRequestToRig } from '../combat/climbRig.js';   // the climb rig's own mapping into the rig

/** The wire's step for the table's top above the feet, metres. */
export const SEAT_TOP_STEP = 0.05;
/** A table's top when the wire names none (an older relay's pose has no `st` at all; this is never sent). */
export const SEAT_TOP_DEFAULT = 0.8;

/** MEASURED (CARDS2b) on retail's biped (Weapon Sheathing's vendored xbase_anim_sh.nif, test/cards2b_seated.test.js):
 *  its pelvis stands at 1.09 m, its thigh is 0.46 m and its shin 0.53 m, so a drop of 0.48 m puts the hips level with
 *  the knees over shins standing straight - a chair's sitter. Scaled by the race's height. */
export const SEAT_HIP_DROP = 0.48;
/** WAGONS3: the measured biped's pelvis over its feet standing (above), and so its seated hips' height over the floor
 *  its feet rest on - a seat's top stands this far over the seated feet (world/wagonModels.js driverSeatFor). */
export const SEAT_PELVIS_HEIGHT = 1.09;
export const SEATED_HIP_HEIGHT = SEAT_PELVIS_HEIGHT - SEAT_HIP_DROP;
/** The seated eye above the floor: the standing eye (motor.js EYE_HEIGHT) lowered by the hips' drop, so the first
 *  person looks from where the measured biped's seated head is (the port's standing eye is one height for every race,
 *  and so is this). */
export const SEATED_EYE_HEIGHT = EYE_HEIGHT - SEAT_HIP_DROP;
/** MEASURED (CARDS2b, AUDIT CARDS D3): how far from a table's edge the sitter's hips are - close enough that the
 *  biped's seated arms lay its hands SEAT_HAND_ON past the edge, the knees under the table's lip. A world distance (the
 *  table's), read by world/cardTables.js where it stands the seats. */
export const SEAT_OUT = 0.35;
/** MEASURED (CARDS2b, AUDIT CARDS D3): how far past the edge the hands lie on the top. On the measured biped they land
 *  to the unit; a race the table does not scale with reaches as far as its arms do - at build 0.9 and height 1.1 the
 *  wrists stop 5 cm short and 4 cm over their marks (test/cards2b_seated.test.js). */
export const SEAT_HAND_ON = 0.1;
/** MEASURED (CARDS2b, the same biped): the feet a thigh's length before the hips (the shins straight down), either side
 *  of the body's middle, the ankle off the floor. The body is drawn with its build (`weight`) across and its height up,
 *  so a level thigh and the feet's ahead and side follow the build, the ankle and the hips' drop the height. */
export const SEAT_FOOT_AHEAD = 0.45;
export const SEAT_FOOT_SIDE = 0.12;
export const SEAT_ANKLE = 0.08;
/** MEASURED (CARDS2b, the same biped): the hands either side of the body's middle (scaled with the race's build), a
 *  forearm's thickness over the top. */
export const SEAT_HAND_SIDE = 0.2;
export const SEAT_HAND_OVER = 0.04;

/** WAGONS3: a body seated on a moving seat (a wagon's bench) is still on it - the motor's bag (player/motor.js
 *  motionBagOf) with its stride taken out, so the third-person body poses the seat and plays no walk under it. */
export const seatedMotion = (bag) => ({ ...bag, forward: 0, strafe: 0, running: false, speed: 0, standing: true, riding: false, jumping: false });

/** The table's top above the feet as the wire's byte. */
export const seatTopByte = (top) => Math.min(POSE_SEAT_TOP_MAX, Math.max(1, Math.round((Number(top) || 0) / SEAT_TOP_STEP)));
/** ...and back. */
export const seatTopOf = (st) => (Number.isInteger(st) && st >= 1 && st <= POSE_SEAT_TOP_MAX ? st * SEAT_TOP_STEP : SEAT_TOP_DEFAULT);

/**
 * The seated body's world request: `{ origin, yaw, req }` - `origin` the feet the body is drawn at (the seat, on the
 * floor), `req` the climb rig's world request (combat/climbRig.js's header names every field). `top` is the table's top
 * above the feet, metres; `race` the body's race scales ({ weight, height } - fpArm's raceScale), which the body's own
 * distances follow while the table's (its edge, its top) stand where they are.
 * @param {number[]} feet
 * @param {number} yaw
 * @param {number} [top]
 * @param {{weight?: number, height?: number}} [race]
 */
export function seatRigInput(feet, yaw, top = SEAT_TOP_DEFAULT, race = {}) {
  const h = race.height ?? 1, w = race.weight ?? 1;
  const f = [Math.sin(yaw), 0, Math.cos(yaw)];
  const r = [Math.cos(yaw), 0, 0 - Math.sin(yaw)];   // `0 -`, never a bare `-`: due south's -0 is no way a request should carry
  const at = (ahead, side, up) => [feet[0] + f[0] * ahead + r[0] * side, feet[1] + up, feet[2] + f[2] * ahead + r[2] * side];
  const elbow = (side) => { const v = [r[0] * side + 0, -1, r[2] * side + 0]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const hand = (side) => ({ at: at(SEAT_OUT + SEAT_HAND_ON, side * SEAT_HAND_SIDE * w, top + SEAT_HAND_OVER), fingers: f.slice(), palm: [0, -1, 0], pole: elbow(side), w: 1, curl: 0.3 });
  const foot = (side) => ({ at: at(SEAT_FOOT_AHEAD * w, side * SEAT_FOOT_SIDE * w, SEAT_ANKLE * h), toe: f.slice(), pole: f.slice(), w: 1 });
  return {
    origin: [feet[0], feet[1], feet[2]],
    yaw,
    req: {
      w: 1,
      offset: [0, -SEAT_HIP_DROP * h, 0],
      hands: { L: hand(-1), R: hand(1) },
      feet: { L: foot(-1), R: foot(1) },
    },
  };
}

/**
 * A seat (`{ feet, yaw, top }` - the host's `camera().seat`, a peer's from its pose) as the RIG's request: the world
 * request at this body's race, mapped by the climb rig's own climbRequestToRig. Null without a seat. fpArm's thirdSeat
 * is this, with the rig's units and the body's race.
 * @param {{feet: number[], yaw: number, top?: number} | null | undefined} seat
 * @param {{unitsPerMetre: number, weight?: number, height?: number}} rig
 */
export function seatRequestFor(seat, { unitsPerMetre, weight = 1, height = 1 }) {
  if (!seat || !seat.feet) return null;
  const s = seatRigInput(seat.feet, seat.yaw, seat.top, { weight, height });
  return climbRequestToRig(s.req, { feet: s.origin, yaw: s.yaw, unitsPerMetre, weight, height });
}
