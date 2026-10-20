// @ts-check
// BODY-MOTION (2026-10-18; bible/04-Characters/Body-Motion.md) - THE GAIT. The Morrowind body's walk, run and sneak in
// third person, made from the body's own measurements and the ground the body itself crosses, instead of a clip played
// faster than it was drawn: Morrowind's walk is authored for 2.2 m/s and Daggerfall walks at 3.7 to 6.3, so the clip
// ran at twice and more its own cadence and every foot slid.
//
// THE LAW, in the order the frame asks it (AUDIT BODY-MOTION, 2026-10-19 - bible/01-Overview/audits/Audit-Body-Motion.md
// - rebuilt this law around feet that stand in the world: the first one placed each foot by a formula of the stride's
// phase, which held a foot still only while the body went straight at a steady pace, and slid it under every start, stop,
// turn, strafe, wall and change of key):
//  0. THE GROUND THE BODY CROSSED is the frame's own: the motor's own steps as drawn (player/motor.js travelAt - a wall
//     that stops the capsule stops the stride, a deck's carry and a pin are never a step), a peer's drawn feet's travel
//     (net/peer/peerBodies.js), else - a contact sheet, a pin - the word's pace along its keys. Its way, eased by its
//     angle (a reversal is a reversal at once), is the way of travel; its rise over its run is the ground's slope.
//  1. A FOOT ON THE GROUND STANDS IN THE WORLD: each frame it moves back under the body by exactly the body's own travel
//     and turns by exactly its own turn - it never slides, whatever the body does over it.
//  2. THE STRIDE is Alexander's (R. McN. Alexander, "Estimates of speeds of dinosaurs", Nature 261, 1976): a legged
//     animal's stride, in hip heights, follows its Froude number - lambda = 2.3 h (v^2 / g h)^0.3 - capped at the longest
//     stride the style takes, and at what the rig's own leg reaches (a race drawn slight takes a shorter stride than one
//     drawn tall). The cadence is what is left: the phase advances by the ground crossed over the stride.
//  3. THE DUTY FACTOR (the share of a stride a foot stands) falls with the Froude number: a slow walk stands 0.62 of it,
//     a sprint 0.3 (both feet in the air between steps). The phase lifts a foot as its share ends and sets it down as the
//     next begins.
//  4. A FOOT ON THE GROUND rolls over the heel, stands flat, then rolls over the ball (the three rockers): its ankle is
//     placed by turning the flat print about whichever point touches. IN THE AIR it travels from the print it left to the
//     foothold it will land on - where the body will be when it lands, a stride on - by a minimum-jerk path: it leaves the
//     ground at the ground's own speed (still, in the world) and lands at it, rising early (the heel kicks up behind at a
//     run), at the ground's height there by the slope.
//  5. THE HIPS are held up by the legs that stand - and by the leg about to: never higher than a standing leg reaches,
//     the landing leg's reach taken in as it comes down (so the dip is round, never a drop), swaying over the standing
//     foot, turning with the stride (the swinging leg's hip forward), dropping on the swinging side. The chest turns
//     against them and banks into a turn.
//  6. THE STEER: the body always faces the camera, so a strafe or a backpedal turns the HIPS toward the travel and the
//     chest back - up to 60 degrees - and the swinging foot lands on its own side of the travel's line.
//  7. STANDING, the feet stay where they stand while the body turns, and step back under it - lifted, the foot on the
//     turn's side first, then the other - once they are twisted past TURN.step or stand off their place; a stop steps the
//     trailing foot up, a new carry's stance and a blow's lunge are stepped into. A sneak stands crouched.
//
// Every length is a share of the body's leg (bodyKit.js bodyOf), every pace in metres per second of the world - the
// race's own height decides how long its leg is in metres, and so how it strides. Pure: one state object, stepped.

import { algebra, clamp01, clamp, smooth, RAD, wrapAngle, frac, ease, FOOT } from './bodyKit.js';

const { add, scale, dot, norm, lerp } = algebra;

const G = 9.81;

/**
 * THE STYLES - each a row of the gait's terms, blended by the frame's own shares (walk, run, sneak). Lengths are in the
 * body's legs, angles in degrees, `duty` and `frFull` as the law above. Tuned on the retail biped's measured skeleton
 * (test/fixtures/mw/retailRig.mjs) through the contact sheets tools/bodyMotionSheet.mjs draws; one frozen row each,
 * for Mac to move on his own data.
 *  - strideMax: the longest stride the style takes (legs); duty: [slow, fast] stance share; frFull: the Froude number at
 *    which the fast end is reached;
 *  - height / heightFast: the hips over the ankle (legs; 1 a straight leg), slow and at the style's fast end - a fast
 *    walk rides lower on a flexed knee, so the dip its long stance needs is shallower (AUDIT BODY-MOTION GAIT-3);
 *    bob: their rise and fall; sway: over the standing foot;
 *  - lift / liftFast: the ankle's rise in the swing, slow and fast; land: the share of the ground's speed a landing foot
 *    still has (a sprinter's foot is pulled back to meet the ground - the swing's retraction - so it lands near still);
 *  - heel, toeOff, swingToe: the foot's pitch at the strike (toes up), at the push (toes down), and in the swing;
 *    flat: the stance's shares [flat from, heel rises from];
 *  - width: the feet's track in hip widths; hipYaw, hipList, hipTilt, hipTiltWave: the pelvis's turn, drop, forward
 *    tilt and its wave; chestYaw, chestRoll, lean: the chest's counter-turn, its counter-drop and its forward lean;
 *  - arm: the free arm's swing (forward at the opposite foot's strike), its forward bias, the elbow [back, front] and how
 *    far it is held out (the hand's shape is the clip's - carry.js).
 */
export const GAIT_STYLES = Object.freeze({
  walk: Object.freeze({
    strideMax: 2.0, duty: Object.freeze([0.62, 0.53]), frFull: 2.2,
    height: 0.975, heightFast: 0.93, bob: 0.024, sway: 0.028,
    lift: 0.085, liftFast: 0.12, land: 0.15,
    heel: 16, toeOff: 34, swingToe: 10, flat: Object.freeze([0.16, 0.56]),
    width: 0.82, hipYaw: 8, hipList: 5, hipTilt: 4, hipTiltWave: 1.5,
    chestYaw: 9, chestRoll: 2.5, lean: 5,
    arm: Object.freeze({ swing: 27, bias: 4, elbow: Object.freeze([12, 36]), abduct: 8 }),
  }),
  run: Object.freeze({
    strideMax: 4.1, duty: Object.freeze([0.42, 0.3]), frFull: 7,
    height: 0.925, heightFast: 0.9, bob: 0.035, sway: 0.012,
    lift: 0.18, liftFast: 0.29, land: 0.35,
    heel: 4, toeOff: 50, swingToe: 14, flat: Object.freeze([0.1, 0.32]),
    width: 0.42, hipYaw: 9.5, hipList: 5, hipTilt: 9, hipTiltWave: 2.5,
    chestYaw: 14, chestRoll: 3, lean: 11,
    arm: Object.freeze({ swing: 42, bias: 7, elbow: Object.freeze([74, 96]), abduct: 18 }),
  }),
  sneak: Object.freeze({
    strideMax: 1.3, duty: Object.freeze([0.72, 0.64]), frFull: 0.6,
    height: 0.8, heightFast: 0.78, bob: 0.012, sway: 0.04,
    lift: 0.09, liftFast: 0.1, land: 0.1,
    heel: 8, toeOff: 20, swingToe: 6, flat: Object.freeze([0.22, 0.6]),
    width: 1.05, hipYaw: 5, hipList: 3, hipTilt: 12, hipTiltWave: 1,
    chestYaw: 5, chestRoll: 1.5, lean: 26,
    arm: Object.freeze({ swing: 12, bias: 14, elbow: Object.freeze([40, 58]), abduct: 16 }),
  }),
});

/**
 * THE STANDING BODY: the hips over the ankle (legs), the feet's track (hip widths, the left foot `lead` legs ahead),
 * the trunk's lean and the pelvis's tilt (degrees); the breath (`breath` s a cycle, `breathPitch` degrees of the chest)
 * and the weight's slow shift (`shift` s a cycle, `shiftSway` legs, `shiftList` degrees). `sneak`: AUDIT BODY-MOTION
 * GAIT-5 - crouched while it sneaks standing still (Morrowind's idlesneak is a crouch; the first law stood it bolt
 * upright between two crouched strides).
 */
export const STAND = Object.freeze({
  height: 0.982, width: 1.0, lead: 0.03, lean: 2, hipTilt: 4,
  breath: 4.2, breathPitch: 0.9, shift: 7.5, shiftSway: 0.012, shiftList: 1.4,
  sneak: Object.freeze({ height: 0.84, lean: 20, hipTilt: 10 }),
});

/**
 * THE SKELETON FAMILIES (bodyKit.js bodyKindOf) - each style's terms scaled for its body: the female skeleton's narrower
 * track, more turn and drop in the pelvis and arms held nearer; the beast's springier step, lighter on the ball of its
 * foot (`footBias`, degrees added to the foot's pitch: heel up - standing too), and lower carriage. Multipliers, 1 where
 * unnamed. (A werewolf's body is no family the layer walks - bodyKindOf answers null for it.)
 */
export const BODY_STYLES = Object.freeze({
  male: Object.freeze({}),
  female: Object.freeze({ width: 0.72, hipYaw: 1.3, hipList: 1.35, sway: 1.2, abduct: 0.8, swing: 0.92, chestYaw: 0.85, lean: 0.9 }),
  beast: Object.freeze({ bob: 1.25, lift: 1.15, lean: 1.2, height: 0.985, hipTilt: 1.25, footBias: -6 }),
});

/** THE STEER (degrees): a sideways travel turns the hips `forward` of its angle (at most `max`); past `back` degrees off
 *  the facing (with `hyst` of hysteresis) the body backpedals, the hips turned `backShare` of the way, at most `backMax`. */
export const STEER = Object.freeze({ forward: 0.68, max: 60, back: 105, hyst: 12, backShare: 0.55, backMax: 40 });

/** THE EASES (seconds): the gait coming on and going off, the style's shares, the pace, the steer, the lean, the way
 *  of travel, the backpedal's share of the arms' swing (AUDIT BODY-MOTION GAIT-12 - flipped in one frame, it threw the
 *  free arm 54 degrees), and the ground's slope; and (strides, not seconds) the body's clock catching up the feet's
 *  when a strike or a lift sets it (GAIT-22). */
export const GAIT_EASE = Object.freeze({ moveIn: 0.09, moveOut: 0.16, style: 0.22, speed: 0.08, steer: 0.14, lean: 0.25, dir: 0.06, back: 0.12, slope: 0.25, phase: 0.25 });

/**
 * TURNING AND SETTLING IN PLACE: a standing foot twisted `step` degrees off the body - or standing `dist` legs off its
 * place - steps back under it, over `time` seconds (quicker the faster the body turns, never under `minTime`), lifted
 * `lift` legs; one twisted past `max` steps at once, even while the other is in the air (AUDIT BODY-MOTION GAIT-11: the
 * feet twisted to 177 degrees under a fast turn); a turn of more than `snap` degrees in one frame, or faster than `rate`
 * radians a second (a teleport, a cut, a flick), re-plants both at once. `quick`: a blow's lunge step's time.
 */
export const TURN = Object.freeze({ step: 26, dist: 0.09, time: 0.26, minTime: 0.12, lift: 0.07, max: 70, snap: 90, rate: 9, quick: 0.16 });

/** The gait comes on past `on` m/s of ground crossed and goes off under `off` (a body pushing at a wall stands). A
 *  frame's ground past `placed` m/s is a placement (a teleport, an origin shift missed), never a stride. The slope is
 *  held within `slope` (rise over run). A reversal of the way of travel past `reverse` degrees is taken at once. */
export const GAIT_LIMITS = Object.freeze({ on: 0.2, off: 0.1, placed: 60, slope: 1.2, reverse: 150 });

/** ON A SLOPE (AUDIT BODY-MOTION GAIT-20 - the level's stride on a grade stood the foot down it a half-stance under the
 *  hips, and the walk dipped twice the level's at 10 degrees, three times at 30): the stride shortens by `shorten` of
 *  the grade along the travel (rise over run), and the stance moves `shift` legs a grade up the slope (never past
 *  `shiftMax` of its half) - the foot set further up it, lifted sooner below, as the hip flexes more at the strike
 *  uphill; and the foot that stands down the slope keeps the level's own pitch at that end of its stance (the push
 *  uphill, the strike downhill), the ankle taking the slope up through the flat of the stance. */
export const SLOPE = Object.freeze({ shorten: 0.5, shift: 0.5, shiftMax: 0.75 });

/** THE STRIDE (metres) at `v` metres per second for a leg `h` metres long, in `style` - Alexander's relation, capped at
 *  the style's longest. Zero standing. */
export function strideLength(v, h, style) {
  if (!(v > 0) || !(h > 0)) return 0;
  return Math.min(2.3 * h * Math.pow((v * v) / (G * h), 0.3), style.strideMax * h);
}

/** THE DUTY FACTOR at `v` for a leg `h` metres long, in `style`. */
export function dutyFactor(v, h, style) {
  const fr = h > 0 ? (v * v) / (G * h) : 0;
  return lerp(style.duty[0], style.duty[1], clamp01(fr / style.frFull));
}

/** The swing's lift profile: 0 at both ends, 1 at its top (a third of the way in - the heel rises early). */
const LIFT_A = 1, LIFT_B = 1.7;
const LIFT_MAX = Math.pow(LIFT_A / (LIFT_A + LIFT_B), LIFT_A) * Math.pow(LIFT_B / (LIFT_A + LIFT_B), LIFT_B);
export const liftProfile = (s) => (s <= 0 || s >= 1 ? 0 : (Math.pow(s, LIFT_A) * Math.pow(1 - s, LIFT_B)) / LIFT_MAX);

/** The minimum-jerk path's share at `s` (0..1): still at both ends, unhurried at both - a step in place. */
export const minJerk = (s) => { const x = clamp01(s); return x * x * x * (10 + x * (-15 + 6 * x)); };
/** A stride's flight path's share at `s`: still at both ends (it leaves the ground and lands at the ground's own speed)
 *  without the minimum-jerk path's dwell at the end - which brought the foot near its foothold early, so the body came
 *  over a foot reaching 0.09 of a leg past where it lands, and the hips had to drop to it. */
export const flightPath = (s, m = 0) => { const x = clamp01(s); return x * x * (3 - m + (m - 2) * x); };
/** How far past its foothold (strides) a flight path takes the foot ahead of the hips before it lands, for a flight
 *  `o` of the stride long (1 - the duty factor) landing with `land` of the ground's speed - the body coming over a
 *  foot that is nearly down (a fit of the path's own overshoot, within 4% of it over the styles' range). */
export const flightOvershoot = (o, land) => 0.09 * o * o * Math.pow(Math.max(0, 1 - land), 1.6);

/**
 * THE STRIDE'S SHAPE at the pace now: its length (rig units), its duty factor, its half-stance, the carriage it rides
 * at (legs over the ankle) and the legs' reach. A run's stance is never longer than its leg sweeps at that carriage
 * (AUDIT BODY-MOTION GAIT-3: a sprint's stood 1.2 legs long, so the hips sank to the leading foot in the air) - past it
 * the stride takes more flight, as a sprinter's does; a walk keeps its double support and dips to it instead.
 */
export function strideShape(s, input, body, P) {
  const L = body.leg, h = input.legM, U = input.unitsPerM || 1;
  const grade = s.slope[0] * s.dir[0] + s.slope[1] * s.dir[1];   // along the travel (+ up it)
  const stride = Math.min(strideLength(s.speed, h, P) * U, P.strideMax * L) / (1 + SLOPE.shorten * Math.abs(grade));
  const fr = h > 0 ? (s.speed * s.speed) / (G * h) : 0;
  const frShare = clamp01(fr / P.frFull);
  const carriage = lerp(P.height, P.heightFast, frShare);
  const reach = Math.min(body.legs?.L ?? L, body.legs?.R ?? L) * 0.992;
  const sweep = Math.sqrt(Math.max(0, reach * reach - carriage * carriage * L * L));
  let beta = dutyFactor(s.speed, h, P);
  if (stride > 1e-6) {
    const overshoot = flightOvershoot(1 - beta, P.land) * stride;
    beta = lerp(beta, clamp((2 * Math.max(0, sweep - overshoot)) / stride, 0.12, beta), P.run);
  }
  const A = (stride * beta) / 2;
  const shift = clamp(SLOPE.shift * grade * L, -SLOPE.shiftMax * A, SLOPE.shiftMax * A);
  return { stride, beta, A, frShare, carriage, reach, sweep, m: P.land * (1 - beta), grade, shift };
}

/** A fresh gait state. */
export function createGaitState() {
  return {
    phase: 0, move: 0, run: 0, sneak: 0, speed: 0, dir: [0, 1], th: 0, psi: 0, back: false, backShare: 0, along: 1,
    lean: 0, bank: 0, lastSpeed: 0, yaw: null, yawRate: 0, t: 0, walking: false, air: false, lag: 0, shown: 0,
    travel: null, carried: null, slope: [0, 0], stance: null, stepTime: null,
    feet: { L: null, R: null },
  };
}

/** The style row blended by the frame's shares, the family's multipliers laid on. */
export function blendStyle(run, sneak, kind) {
  const w = GAIT_STYLES.walk, r = GAIT_STYLES.run, k = GAIT_STYLES.sneak;
  const ws = clamp01(sneak), wr = clamp01(run) * (1 - ws), ww = 1 - wr - ws;
  const mix = (f) => f(w) * ww + f(r) * wr + f(k) * ws;
  const fam = BODY_STYLES[kind] ?? BODY_STYLES.male;
  const m = (key) => fam[key] ?? 1;
  return {
    strideMax: mix((s) => s.strideMax), duty: [mix((s) => s.duty[0]), mix((s) => s.duty[1])], frFull: mix((s) => s.frFull),
    height: mix((s) => s.height) * m('height'), heightFast: mix((s) => s.heightFast) * m('height'), bob: mix((s) => s.bob) * m('bob'), sway: mix((s) => s.sway) * m('sway'),
    lift: mix((s) => s.lift) * m('lift'), liftFast: mix((s) => s.liftFast) * m('lift'), land: mix((s) => s.land),
    heel: mix((s) => s.heel), toeOff: mix((s) => s.toeOff), swingToe: mix((s) => s.swingToe),
    flat: [mix((s) => s.flat[0]), mix((s) => s.flat[1])],
    width: mix((s) => s.width) * m('width'),
    hipYaw: mix((s) => s.hipYaw) * m('hipYaw'), hipList: mix((s) => s.hipList) * m('hipList'),
    hipTilt: mix((s) => s.hipTilt) * m('hipTilt'), hipTiltWave: mix((s) => s.hipTiltWave),
    chestYaw: mix((s) => s.chestYaw) * m('chestYaw'), chestRoll: mix((s) => s.chestRoll), lean: mix((s) => s.lean) * m('lean'),
    arm: {
      swing: mix((s) => s.arm.swing) * m('swing'), bias: mix((s) => s.arm.bias),
      elbow: [mix((s) => s.arm.elbow[0]), mix((s) => s.arm.elbow[1])],
      abduct: mix((s) => s.arm.abduct) * m('abduct'),
    },
    footBias: fam.footBias ?? 0, standHeight: m('height'), standLean: m('lean'), standTilt: m('hipTilt'),
    run: wr, sneak: ws,
  };
}

/** The foot's pitch (degrees, toes up) through a stance, `q` its share (0 the strike, 1 the push). */
export function stancePitch(q, P) {
  if (q < P.flat[0]) return P.heel * (1 - smooth(q / P.flat[0]));
  if (q < P.flat[1]) return 0;
  return -P.toeOff * smooth((q - P.flat[1]) / (1 - P.flat[1]));
}
/** ... and through a swing, `s` its share (0 the push, 1 the next strike) - its ends the stance's own, so the foot that
 *  leaves the ground and the one that lands are the stance's last and first. */
export function swingPitch(s, P) {
  if (s < 0.45) return lerp(-P.toeOff, P.swingToe, smooth(s / 0.45));
  return lerp(P.swingToe, P.heel, smooth((s - 0.45) / 0.55));
}

/**
 * THE FOOT'S PLACE for a flat footprint at `flat` ([x, y], the ankle's place over the ground) pitched `pitch` radians
 * (toes up) along `fwd` ([x, y], unit) - turned about the heel when the toes are up, about the ball when the heel is up,
 * so whichever touches stays where it touches. Answers { at, toe, up } in the rig, the ground at z = 0 (the caller lays
 * the ground's own height on).
 */
export function footPlace(flat, pitch, fwd, body) {
  const ankle = [flat[0], flat[1], body.ankle];
  const c = Math.cos(pitch), s = Math.sin(pitch);
  const toe = [fwd[0] * c, fwd[1] * c, s];
  const up = [-fwd[0] * s, -fwd[1] * s, c];
  if (pitch === 0) return { at: ankle, toe, up };
  const pivotLen = pitch > 0 ? -FOOT.heel * body.leg : FOOT.ball * body.leg;
  const pivot = [flat[0] + fwd[0] * pivotLen, flat[1] + fwd[1] * pivotLen, 0];
  // the ankle about the pivot: its offset (along the foot, and up) turned with the foot
  const along = -pivotLen, upAmt = body.ankle;
  return { at: add(pivot, add(scale(toe, along), scale(up, upAmt))), toe, up };
}

/**
 * THE FOOT ON A SLOPE: footPlace's law on ground that rises `grade` (rise over run) along the foot's `fwd` - the sole
 * laid along the ground (its own pitch, atan(grade)), the rockers' pitch on it turned about whichever of the heel or the
 * ball touches, where it meets the ground (AUDIT BODY-MOTION GAIT-13). `flat` [x, y, z]: the print, z the ground's height
 * under the ankle. Answers { at, toe, up } in the rig.
 */
export function footPlaceOn(flat, rocker, grade, fwd, body) {
  const P = rocker + Math.atan(grade);
  const c = Math.cos(P), s = Math.sin(P);
  const toe = [fwd[0] * c, fwd[1] * c, s];
  const up = [-fwd[0] * s, -fwd[1] * s, c];
  const pivotLen = rocker > 0 ? -FOOT.heel * body.leg : rocker < 0 ? FOOT.ball * body.leg : 0;
  // the heel and the ball lie along the ground's own line under the foot
  const cg = 1 / Math.sqrt(1 + grade * grade), sg = grade * cg;
  const pivot = [flat[0] + fwd[0] * cg * pivotLen, flat[1] + fwd[1] * cg * pivotLen, flat[2] + sg * pivotLen];
  return { at: add(pivot, add(scale(toe, -pivotLen), scale(up, body.ankle))), toe, up };
}

const rotXY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
const lerpV = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;
const wrapHalf = (x) => x - Math.round(x);
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const SIDES = /** @type {const} */ (['L', 'R']);
const OFFSET = { L: 0, R: 0.5 };
const LANE = { L: -1, R: 1 };

/** The standing foot's place under the body (rig, [x, y]) - the track a little wider than the hips, the left a
 *  little ahead (the weight's ease) - with a carry's stance laid on (`stance.feet[side]`, legs; `stance.toe[side]`,
 *  degrees of toe turn). Answers { p: [x, y], yaw }. */
export function standingSpot(side, body, stance = null) {
  const sign = LANE[side];
  const w = body.hipWidth * 0.5 * STAND.width;
  let p = [body.restHip[0] + sign * w, body.restHip[1] + (side === 'L' ? STAND.lead * body.leg : 0)];
  const off = stance?.feet?.[side];
  if (off) p = [p[0] + off[0] * body.leg, p[1] + off[1] * body.leg];
  return { p, yaw: (stance?.toe?.[side] ?? 0) * RAD };
}

/** The ground's height (rig) at a rig point, by the slope the body has been crossing (its own feet stand at 0). */
const groundAt = (s, x, y) => s.slope[0] * x + s.slope[1] * y;

/** A foot planted at `p` ([x, y] - the ground's height there by the slope), turned `yaw`. */
function plantAt(s, p, yaw) {
  return { p: [p[0], p[1], groundAt(s, p[0], p[1])], yaw, swing: null, cur: null };
}

/**
 * A FLIGHT: `kind` 'gait' (the stride's - its progress `s` the stride's own, re-based at `s0`) or 'step' (a step in
 * place - on its own clock, `t` of `dur`); `from` the print it left (it stands in the world), `to` its target this frame;
 * `carry` the pitch and the lift the foot had when its flight changed kind (a step become a stride, a stride become a
 * step), eased out so nothing pops.
 */
const flightProgress = (sw) => (sw.kind === 'gait' ? clamp01((sw.s - sw.s0) / Math.max(1e-3, 1 - sw.s0)) : clamp01(sw.t / Math.max(1e-3, sw.dur)));
/** Where a flight is at its own progress: the print it left carried to the target by the minimum-jerk path - bowed
 *  out to the turn's outside by `bow`, the radians the body turns over what is left of it, so the foot swings round
 *  with the hips along their arc (AUDIT BODY-MOTION GAIT-21: on the straight chord between print and foothold, a running
 *  turn's foot passed half a metre inside the hips, past the leg's reach, and dropped them 14 units as it came down). */
function flightAt(sw, sp = flightProgress(sw)) {
  const k = sw.kind === 'gait' ? flightPath(sp, sw.m ?? 0) : minJerk(sp);
  const p = lerpV(sw.from, sw.to, k);
  if (sw.bow) {
    // the circular arc's sagitta, a half-chord's tan of a quarter of the turn, laid on as a parabola over the chord
    const b = 2 * Math.tan(sw.bow / 4) * k * (1 - k);
    p[0] -= (sw.to[1] - sw.from[1]) * b; p[1] += (sw.to[0] - sw.from[0]) * b;
  }
  return { p, yaw: lerpAngle(sw.fromYaw, sw.toYaw, k) };
}
/** Re-base a flight from where it stands now: a target that leaps (a reversal, a change of the way) never jumps the
 *  foot - it turns toward the new one from here, with as much of its flight left as the new way is long (a stride's
 *  way a whole flight: re-based late and landed at once, a reversal's foot leapt 1.6 m in a frame). `to` the new
 *  target, `stride` the stride's length now (a stride's flight only). */
function rebase(sw, to = null, stride = 0) {
  const now = flightAt(sw);
  sw.from = now.p; sw.fromYaw = now.yaw;
  if (sw.kind === 'gait') {
    if (to && stride > 1e-6) sw.s = Math.min(sw.s, Math.max(0, 1 - Math.hypot(to[0] - now.p[0], to[1] - now.p[1]) / stride));
    sw.s0 = sw.s;
  } else { sw.dur = Math.max(TURN.minTime, sw.dur - sw.t); sw.t = 0; }
}

/**
 * ONE FRAME OF THE GAIT. `input`: the frame's own -
 *   travel (the body's own ground, world metres [x, y, z], cumulative - player/motor.js travelAt; null where none: then
 *   speed (m/s) along forward, strafe (the input axes) stand in), running, sneaking, yaw (radians, the body's heading as
 *   drawn), carriedYaw (the turns a deck gave it, cumulative), grounded; `legM` the body's leg in metres (its race's
 *   height on it), `unitsPerM` / `unitsPerMz` the rig's units a metre across and up (the race's build and height on
 *   them); `kind` the skeleton family; `stance` the carry's (feet, toe, hipYaw, lean, hipShift - carry.js CARRY's
 *   `stand`, a blow's step laid on) and `stepTime` (a blow's quick step). Steps `state` in place; answers it.
 */
export function stepGait(state, input, body, dt) {
  const s = state;
  if (!finite(dt) || dt < 0) dt = 0;   // AUDIT BODY-MOTION GAIT-16: a NaN frame is no frame - it poisoned the state for good
  const L = body.leg;
  const uH = finite(input.unitsPerM) && input.unitsPerM > 0 ? input.unitsPerM : 1;
  const uV = finite(input.unitsPerMz) && input.unitsPerMz > 0 ? input.unitsPerMz : uH;
  const grounded = input.grounded !== false;
  s.stance = input.stance ?? null;
  s.stepTime = finite(input.stepTime) ? input.stepTime : null;
  // ---- THE HEADING: the body's own turn - a deck's turn (carriedYaw) is the ground's, so the feet ride it ----
  const yaw = finite(input.yaw) ? input.yaw : (s.yaw ?? 0);
  const carried = finite(input.carriedYaw) ? input.carriedYaw : 0;
  const fresh = s.yaw == null;
  const dYaw = fresh ? 0 : wrapAngle(wrapAngle(yaw - s.yaw) - (s.carried == null ? 0 : carried - s.carried));
  const snap = fresh || Math.abs(dYaw) > TURN.snap * RAD || (dt > 0 && Math.abs(dYaw) / dt > TURN.rate);
  // ---- THE GROUND CROSSED this frame, in the body's frame (rig units) ----
  let dx = 0, dy = 0, dz = 0, dist = 0, placed = false;
  const tr = input.travel;
  if (tr && finite(tr[0]) && finite(tr[1]) && finite(tr[2])) {
    if (s.travel) {
      const wx = tr[0] - s.travel[0], wy = tr[1] - s.travel[1], wz = tr[2] - s.travel[2];
      const h = Math.hypot(wx, wz);
      if (!(h <= GAIT_LIMITS.placed * Math.max(dt, 1 / 240) + 0.05)) placed = true;
      else {
        const y0 = s.yaw ?? yaw, c = Math.cos(y0), sn = Math.sin(y0);
        dx = (wx * c - wz * sn) * uH; dy = (wx * sn + wz * c) * uH; dz = wy * uV; dist = h;
      }
    }
    s.travel = [tr[0], tr[1], tr[2]];
  } else {
    s.travel = null;
    const fwd = Number(input.forward) || 0, side = Number(input.strafe) || 0, v = Number(input.speed) || 0;
    if (Math.hypot(fwd, side) > 1e-3 && v > 0.05 && grounded && finite(v)) {
      const d = norm([side, fwd, 0]);
      dist = Math.min(v, GAIT_LIMITS.placed) * dt;
      dx = d[0] * dist * uH; dy = d[1] * dist * uH;
    }
  }
  // ---- THE PACE and the gait's coming on and going off (with hysteresis - a body pushing at a wall stands) ----
  s.speed = ease(s.speed, dt > 0 ? dist / dt : s.speed, GAIT_EASE.speed, dt);
  if (!finite(s.speed)) s.speed = 0;
  const was = s.walking;
  s.walking = grounded && (s.walking ? s.speed > GAIT_LIMITS.off : s.speed > GAIT_LIMITS.on);
  // the way of travel (clockwise from the facing - a strafe to the right is +90 degrees), eased by its ANGLE: AUDIT
  // BODY-MOTION GAIT-1 - eased as a vector, a key's flip from W to S stayed forward for good (the lerp's midpoint
  // never left the old way), and the legs walked forward under a body going back
  if (dist > 1e-6 && (dx || dy)) {
    const thT = Math.atan2(dx, dy);
    const off = wrapAngle(thT - s.th);
    s.th = !was || Math.abs(off) > GAIT_LIMITS.reverse * RAD ? thT : wrapAngle(s.th + off * (1 - Math.exp(-dt / GAIT_EASE.dir)));
  }
  s.dir = [Math.sin(s.th), Math.cos(s.th)];
  s.move = ease(s.move, s.walking ? 1 : 0, s.walking ? GAIT_EASE.moveIn : GAIT_EASE.moveOut, dt);
  if (!s.walking && s.move < 1e-3) s.move = 0;
  s.run = ease(s.run, s.walking && input.running && !input.sneaking ? 1 : 0, GAIT_EASE.style, dt);
  s.sneak = ease(s.sneak, input.sneaking ? 1 : 0, GAIT_EASE.style, dt);
  // ---- THE STRIDE and its clock: by the ground crossed, never by a clock of its own ----
  const P = blendStyle(s.run, s.sneak, input.kind);
  const shape = strideShape(s, input, body, P);   // rig units - GAIT-3: what the rig's own leg reaches
  const { stride, beta } = shape;
  s.dPhase = s.walking && stride > 1e-6 ? (dist * uH) / stride : 0;
  s.phase = frac(s.phase + s.dPhase);
  // ---- THE STEER: the hips toward the travel, the backpedal past its angle ----
  const offDeg = Math.abs(s.th) / RAD;
  if (s.back) { if (offDeg < STEER.back - STEER.hyst) s.back = false; } else if (offDeg > STEER.back + STEER.hyst) s.back = true;
  const psiWant = !s.walking ? 0 : s.back
    ? -clamp(wrapAngle(s.th - Math.PI) * STEER.backShare, -STEER.backMax * RAD, STEER.backMax * RAD)
    : -clamp(s.th * STEER.forward, -STEER.max * RAD, STEER.max * RAD);
  s.psi = ease(s.psi, psiWant, GAIT_EASE.steer, dt);
  s.backShare = ease(s.backShare, s.walking && s.back ? 1 : 0, GAIT_EASE.back, dt);
  // how much of the travel is along the hips' forward (- a backpedal's: its toe strike, its sway turned about) - eased, so
  // a reversal rolls a foot from its heel onto its toes (GAIT-23: read off the way at once, it flipped every foot's pitch
  // in the frame the way snapped round - a standing foot through 100 degrees - and the hips' sway with it)
  s.along = ease(s.along, Math.cos(s.th + s.psi), GAIT_EASE.back, dt);
  // ---- the lean into a quickening, and the bank INTO a turn (AUDIT BODY-MOTION DOC-1: it leaned out of it - the yaw
  // grows to the right, and a + roll drops the right side) ----
  const accel = dt > 0 ? (s.speed - s.lastSpeed) / dt : 0;
  s.lastSpeed = s.speed;
  if (snap) s.yawRate = 0;   // AUDIT BODY-MOTION RIG-5: a snap is no turn - read as one, it banked a body 8 degrees
  else if (dt > 0) s.yawRate = ease(s.yawRate, dYaw / dt, 0.1, dt);
  s.lean = ease(s.lean, clamp(accel * 0.012, -0.12, 0.16) * s.move, GAIT_EASE.lean, dt);
  s.bank = ease(s.bank, clamp(s.yawRate * s.speed * 0.022, -0.2, 0.2) * s.move, GAIT_EASE.lean, dt);
  s.t += dt;
  // ---- THE GROUND'S SLOPE: the rise the body's own travel made over its run, along the way it went (the rest kept) ----
  if (placed || snap) s.slope = [0, 0];
  else {
    if (dYaw) s.slope = rotXY(s.slope, dYaw);
    const run = Math.hypot(dx, dy);
    if (grounded && run > 1e-4) {
      const along = clamp(dz / run, -GAIT_LIMITS.slope, GAIT_LIMITS.slope);
      const ux = dx / run, uy = dy / run;
      const g = s.slope[0] * ux + s.slope[1] * uy;
      const k = 1 - Math.exp(-dt / GAIT_EASE.slope);
      const ng = g + (along - g) * k;
      s.slope = [s.slope[0] + ux * (ng - g), s.slope[1] + uy * (ng - g)];
    }
  }
  s.yaw = yaw;
  s.carried = carried;
  stepFeet(s, input, body, P, shape, { dt, dx, dy, dz, dYaw, snap: snap || placed || s.air, was });
  s.air = !grounded;
  // the body's own clock (the hips' rise and sway, the arms', a hip lantern's) catches the feet's up when they set it -
  // as the feet's runs, within half its pace either way, so it never stands or runs back (a stop's froze the feet's and
  // ran the body's back a quarter of a stride)
  const catchUp = s.lag * (1 - Math.exp(-s.dPhase / GAIT_EASE.phase));
  s.lag -= clamp(catchUp, -0.5 * s.dPhase, 0.5 * s.dPhase);
  if (!s.walking && s.move === 0) s.lag = 0;
  s.shown = frac(s.phase + s.lag);
  return s;
}

/**
 * THE FEET this frame. Each stands in the world (moved back by the body's own travel, turned by its own turn) until the
 * gait lifts it - or, standing, until it stands too far off its place - and then flies to its foothold (the gait's: a
 * stride on, on its own side of the travel; the stand's: its place under the body), the path re-based from where the
 * foot is whenever its target leaps. Writes each foot's `cur` - its print, its turn, its pitch, its lift, how far
 * through its flight - for gaitPose.
 */
function stepFeet(s, input, body, P, shape, { dt, dx, dy, dz, dYaw, snap, was }) {
  const L = body.leg;
  const { beta, stride, shift, m, frShare } = shape;
  const spots = { L: standingSpot('L', body, s.stance), R: standingSpot('R', body, s.stance) };
  if (snap || !s.feet.L || !s.feet.R) {
    for (const side of SIDES) s.feet[side] = plantAt(s, spots[side].p, spots[side].yaw);
  } else {
    // 1. the world under the body: what stands moves back by the body's own travel and turns by its own turn
    const carry = (p) => { const q = rotXY([p[0] - dx, p[1] - dy], dYaw); return [q[0], q[1], p[2] - dz]; };
    for (const side of SIDES) {
      const f = s.feet[side];
      if (!f.swing) { f.p = carry(f.p); f.yaw += dYaw; continue; }
      f.swing.from = carry(f.swing.from); f.swing.fromYaw += dYaw;
      // a stride's foothold stands in the world too (where the body will be) - only a real change of it is a leap
      if (f.swing.kind === 'gait') { f.swing.to = carry(f.swing.to); f.swing.toYaw += dYaw; }
    }
  }
  const A = (stride * beta) / 2;
  const hf = [-Math.sin(s.psi), Math.cos(s.psi)], hr = [Math.cos(s.psi), Math.sin(s.psi)];
  const d = s.dir;
  // the lane across the travel on each foot's own side: the hips' right with its share along the travel taken out (AUDIT
  // BODY-MOTION GAIT-7: measured across the hips' right, a strafe's lane moved the planted foot through its stance) - its
  // full width while the hips' right stands 30 degrees or more off the travel, narrowing to the travel's own line (a
  // sidestep's) as it turns along it, and out the other side (GAIT-22: the perpendicular on the side the hips' right
  // leaned to swapped the feet's lanes in a frame as a steer swung the hips through a strafe's, and a planted foot stood
  // on in the other's lane, 13 units of the hips' height out of reach)
  const hd = hr[0] * d[0] + hr[1] * d[1];
  const across = 1 / Math.max(0.5, Math.sqrt(Math.max(0, 1 - hd * hd)));
  const perp = [(hr[0] - hd * d[0]) * across, (hr[1] - hd * d[1]) * across];
  const laneW = body.hipWidth * 0.5 * Math.max(P.width, 0.24);
  /** The gait's foothold for `side` at its flight's stride progress `sw`, flown at `rate` of the ground's own pace: a
   *  stride on from where it left - where the body will be when it lands. */
  const gaitTarget = (side, sw, rate = 1) => {
    const n = [body.restHip[0] + perp[0] * LANE[side] * laneW, body.restHip[1] + perp[1] * LANE[side] * laneW];
    const ahead = ((1 - sw) * (1 - beta) * stride) / rate;   // the ground the body crosses before it lands
    // along the body's own arc when it turns (a turn's foothold where the turned body will stand over it - predicted
    // straight, a running turn's landing foot stood half a leg off its hip), the foot turned as the body will be
    const turn = s.speed > 0.05 ? -s.yawRate * (ahead / ((s.speed || 1) * (input.unitsPerM || 1))) : 0;
    let ox = 0, oy = 0;
    const N = Math.abs(turn) > 1e-3 ? 6 : 1;
    for (let k = 0; k < N; k++) { const r = rotXY(d, (turn * (k + 0.5)) / N); ox += (r[0] * ahead) / N; oy += (r[1] * ahead) / N; }
    const land = rotXY([n[0] + d[0] * (A + shift) - body.restHip[0], n[1] + d[1] * (A + shift) - body.restHip[1]], turn);
    const x = body.restHip[0] + ox + land[0], y = body.restHip[1] + oy + land[1];
    return { p: [x, y, groundAt(s, x, y)], yaw: s.psi + turn };
  };
  /** How far along the travel a print stands from its own lane's middle (+ ahead, - behind). */
  const alongOf = (side, p) => {
    const nx = body.restHip[0] + perp[0] * LANE[side] * laneW, ny = body.restHip[1] + perp[1] * LANE[side] * laneW;
    return (p[0] - nx) * d[0] + (p[1] - ny) * d[1];
  };
  // a planted foot behind its lane's middle may hold the hips a twentieth of a leg under the plan's lowest, no more: past
  // where its leg reaches with them there, it lifts (GAIT-23: let stand until it stood past its stance's end or out of
  // reach of the hips' floor, a new key's foot out beside the travel held them down to the floor in two frames, and let
  // them go in three)
  const holdZ = hipPlan(s, body, P, shape).low - 0.06 * L - body.ankle;
  const outOfPlan = (side, p) => {
    const r = (body.legs?.[side] ?? L) * 0.992, h = holdZ - p[2];
    const jx = body.restHip[0] + hr[0] * LANE[side] * body.hipWidth * 0.5, jy = body.restHip[1] + hr[1] * LANE[side] * body.hipWidth * 0.5;
    return Math.hypot(p[0] - jx, p[1] - jy) > Math.sqrt(Math.max(0, r * r - h * h));
  };
  const reachMin = Math.min(body.legs?.L ?? L, body.legs?.R ?? L) * 0.992;
  const farReach = Math.sqrt(Math.max(0, reachMin * reachMin - (HIP_FLOOR * L) ** 2));
  const standTarget = (side) => ({ p: [spots[side].p[0], spots[side].p[1], groundAt(s, spots[side].p[0], spots[side].p[1])], yaw: spots[side].yaw });
  const stepTime = () => s.stepTime ?? clamp(TURN.time / (1 + Math.abs(s.yawRate) / 3), TURN.minTime, TURN.time);
  /** Begin a flight for `f` from where it is now, carrying its pitch and lift into the new one - a stance's too: a foot
   *  the ground lifts before its push (a reversal's, a new key's) leaves at the pitch it stood at (GAIT-23: it took the
   *  push's at once, its ankle thrown up and back 50 degrees in a frame, and the hips 11 units down with it). */
  const fly = (f, kind, s0 = 0, dur = 0) => {
    const prior = f.swing;
    const here = prior ? flightAt(prior) : { p: f.p, yaw: f.yaw };
    const carry = !f.cur ? null : { pitch: f.cur.pitch, lift: f.swing || kind === 'step' ? f.cur.lift : null, s: s0 };
    f.swing = { kind, from: here.p, fromYaw: here.yaw, to: here.p, toYaw: here.yaw, s0, s: s0, t: 0, dur: dur || stepTime(), carry };
    // where a stride's foot left the ground, kept with the body (never carried with the world): a leaving foot asks the
    // hips no more reach than it asked there (gaitPose)
    if (kind === 'gait') f.swing.held = prior?.held ?? [here.p[0], here.p[1]];
  };
  /** Set the feet's clock to `to` - the body's own clock (`lag`) left where it was, to catch up (GAIT_EASE.phase). */
  const resync = (to) => { s.lag = wrapHalf(s.lag + s.phase - to); s.phase = to; };
  // the walk begins from where the feet stand: the foot that trails flies (half its flight's way - its stride's mid-swing),
  // the other stands at mid-stance under the hips, where it is
  if (s.walking && !was) {
    const back = (side) => { const f = s.feet[side], p = f.swing ? flightAt(f.swing).p : f.p; return (p[0] - body.restHip[0]) * d[0] + (p[1] - body.restHip[1]) * d[1]; };
    const lead = back('L') <= back('R') ? 'L' : 'R';
    s.phase = frac(0.5 * beta + OFFSET[lead === 'L' ? 'R' : 'L']);   // from a stand: nothing of the clock showed
    s.lag = 0;
  }
  const swingTime = s.speed > 0.05 && stride > 0 ? ((1 - beta) * stride) / (s.speed * (input.unitsPerM || 1)) : TURN.time;
  for (const side of SIDES) {
    const f = s.feet[side];
    // a standing foot keeps its own stance's clock - begun at its strike, run by the ground crossed - so the other's
    // strike, which sets the stride's (resync), never moves it (AUDIT BODY-MOTION GAIT-25: read off the stride's, a
    // re-based foot's early strike threw the standing one a seventh of a stride on, its pitch 21 degrees toward the push
    // in a frame); a foot in the air flies to the stride's
    const clock = frac(s.phase - OFFSET[side]);
    if (!f.swing) f.u = s.walking && was && f.u != null ? frac(f.u + s.dPhase) : clock;
    const u = f.swing ? clock : f.u;
    const prevU = f.lastU ?? u;
    f.lastU = u;
    if (s.walking) {
      // a foot lifts as its stance's share ends (or one jumped past in a long frame) - the phase's own event - and flies
      // by the ground the body crosses (never re-read off the phase: as the duty factor fell under a quickening body,
      // a flight read off it ran ahead of the body, the foot past the leg's reach); it lands as its flight completes
      // (once a stride: a foot set down is armed again only once its stance has begun - so a duty factor that falls under a
      // quickening body lifts a standing foot that is past its share, and a flight that lands early never lifts again)
      if (!f.swing && u < beta) f.armed = true;
      if (!was) f.armed = true;
      // ... and the ground lifts it too: a foot that stands past its stance's end along the travel (a reversal's, a new
      // key's way), or behind its middle out of the leg's reach with the hips where the gait plans them, or beyond what
      // its leg reaches with the hips at their lowest is lifted now, the clock set to it if the other foot stands (AUDIT
      // BODY-MOTION GAIT-1/GAIT-8 - kept by the clock alone, it stood on until the hips sank to it)
      const along = !f.swing && s.walking ? alongOf(side, f.p) : 0;
      const behind = !f.swing && s.walking && (along < shift - (A + 0.1 * L) || (along < 0 && outOfPlan(side, f.p)) || Math.hypot(f.p[0] - body.restHip[0], f.p[1] - body.restHip[1]) > farReach);
      if (behind) {
        const other = s.feet[side === 'L' ? 'R' : 'L'];
        if (!other.swing) resync(frac(beta + OFFSET[side] + 1e-4));
        f.armed = true;
      }
      const lifts = !f.swing && f.armed && (u >= beta || behind);
      let lifted = false;
      if (lifts || (f.swing && f.swing.kind === 'step' && u >= beta)) {
        // the flight begins where the stance's share ended - this frame's ground past it already flown; a foot lifted
        // late (a walk's start, a duty factor fallen under it, a step become a stride) takes up its flight where the clock
        // has it, so it lands on the clock (GAIT-22)
        const late = u >= beta && !(prevU < beta);
        fly(f, 'gait', late ? clamp01((u - beta) / Math.max(1e-3, 1 - beta)) : 0);
        if (!late) f.swing.s = u >= beta ? clamp01((u - beta) / Math.max(1e-3, 1 - beta)) : 0;
        f.armed = false;
        lifted = true;
      }
      if (f.swing && f.swing.kind === 'gait') {
        const sw = f.swing;
        // ... keeping to the clock: its progress set against where the clock would have it (its stance's end, and the
        // share of the flight since), the gap closed at a quarter of the ground's pace at the most - a run's two feet,
        // which no double support re-times, come back half a stride apart (GAIT-22: thrown a fourteenth of a stride
        // apart, each strike set the clock to itself and the other foot landed off it, for good); by the ground crossed -
        // and by the clock at the least (its own pace then), so a foot in the air under a body that slows to a stop comes
        // down within a slow walk's swing (it hung there until the gait went off)
        const byGround = s.dPhase / Math.max(1e-3, 1 - beta), byClock = dt / FLIGHT_MAX;
        const gap = wrapHalf(u - (beta + (sw.s + (lifted ? 0 : byGround)) * (1 - beta)));   // this frame's clock against this frame's flight
        sw.rate = byGround > byClock ? 1 + clamp(4 * gap, -0.25, 0.25) : 1;
        const inc = lifted ? 0 : Math.max(byGround * sw.rate, byClock);
        // its foothold read again before it may land, and a leap of it re-bases the flight from where the foot is: a
        // flight the travel turns from under (a reversal's, a new key's) flies on to the new way's, never set down where
        // the old way had it (AUDIT BODY-MOTION GAIT-24: read after the strike, a strafe reversed the frame its foot came
        // down landed it on the old way's foothold, 60 units off its hip past the leg's reach - the hips to their floor,
        // 15 units in the frame)
        let t = gaitTarget(side, Math.min(1, sw.s + inc), sw.rate);
        const here = flightAt(sw).p;
        const leap = Math.max(LEAP * L, 0.3 * Math.hypot(t.p[0] - here[0], t.p[1] - here[1]));
        const leapt = Math.hypot(t.p[0] - sw.to[0], t.p[1] - sw.to[1]) > leap && sw.s + inc > sw.s0;
        // re-based, its pitch and lift carried into the new path as a new flight's are (fly) - its stride progress set
        // back, the swing's own were read again from mid-swing, the foot thrown up 8 units and over 40 degrees in a frame
        if (leapt) { rebase(sw, t.p, stride); if (f.cur) sw.carry = { pitch: f.cur.pitch, lift: f.cur.lift, s: sw.s }; }
        const sRaw = sw.s + inc;
        sw.s = Math.min(1, sRaw);
        if (leapt) { t = gaitTarget(side, sw.s, sw.rate); sw.to = t.p; sw.toYaw = t.yaw; }
        if (sw.s >= 1) {
          // the strike: set down on the foothold it flew to (it stands in the world - carried with it this frame) - and
          // a strike begins its stance, on the foot's own clock (GAIT-25), as far on as the frame ran past the strike (set
          // to its start, every stride lost half a frame: a stride 7 per cent long, and a backpedal's push stood 10 units
          // past its end). The stride's clock is the flights' to keep to, never set by a strike (AUDIT BODY-MOTION
          // GAIT-22: two feet a reversal put in the air together kept landing a fifth of a stride apart for good - the
          // flights' lock to it brings them back half a stride apart; set to each strike, an early one jumped it, the
          // flight's pace with it, and its foothold a fifth of its way - re-based, a run's strafe reversed dropped the
          // hips 10 units in a frame)
          const past = inc > 0 ? (clamp01((sRaw - 1) / inc) * s.dPhase) : 0;
          const n = plantAt(s, sw.to, sw.toYaw);
          n.p = [sw.to[0], sw.to[1], sw.to[2]]; n.lastU = past; n.u = past;
          s.feet[side] = n;
          continue;
        }
        sw.to = t.p; sw.toYaw = t.yaw; sw.m = m;
        sw.bow = clamp(s.yawRate * Math.min(swingTime, FLIGHT_MAX) * (1 - sw.s0), -2.4, 2.4);
      }
    } else if (f.swing && f.swing.kind === 'gait') {
      // the gait stopped under a foot in the air: it flies on to its place under the body
      fly(f, 'step', 0, clamp((1 - flightProgress(f.swing)) * swingTime, 0.08, TURN.time));
    }
  }
  if (!s.walking) settle(s, body, spots, fly);
  // each step in place on its own clock, toward its place now
  for (const side of SIDES) {
    const sw = s.feet[side].swing;
    if (!sw || sw.kind !== 'step') continue;
    const t = standTarget(side);
    if (Math.hypot(t.p[0] - sw.to[0], t.p[1] - sw.to[1]) > LEAP * L && sw.t > 0) rebase(sw);
    sw.to = t.p; sw.toYaw = t.yaw;
    sw.t += dt;
    if (sw.t >= sw.dur) { const n = plantAt(s, t.p, t.yaw); n.p = t.p; s.feet[side] = n; }
  }
  // what gaitPose reads: each foot's print and turn, its pitch (the rockers, the flight's) and its lift
  const hfv = [hf[0], hf[1], 0];
  const c = clamp(s.along, -1, 1);   // how much of the travel is along the hips' forward (- a backpedal: a toe strike)
  const bias = P.footBias * RAD;
  const gaitLift = (sg) => lerp(P.lift, P.liftFast, frShare) * L * Math.min(1, stride / (L * 0.6)) * liftProfile(sg);
  // a foot on a slope stands along it: toes up uphill (the ground's own grade along the foot) - but at the end of its
  // stance that stands down the slope (the push up it, the strike down it: a backpedal's the other way about) it keeps
  // the level's own pitch, `push` and `strike` the shares of those ends now (SLOPE)
  const gradeAlong = (yaw) => -s.slope[0] * Math.sin(yaw) + s.slope[1] * Math.cos(yaw);
  const level = (g, push, strike) => -Math.atan(g) * Math.abs(c) * (c * g > 0 ? push : strike);
  // A BACKPEDAL'S FOOT is the walk's played backward (AUDIT BODY-MOTION GAIT-23: its pitch was the walk's turned over -
  // a toe strike as shallow as the walk's heel, a push 34 degrees toes-up, 50 at a run - and stood the ankle 45 degrees
  // up toward the shin): it lands on its toes as the walk leaves them, and leaves on its heel as the walk lands on it.
  // `qe`, `se` the shares the walk's own rockers are read at; the ends' shares at the push and at the strike
  const back = c < 0, ac = Math.abs(c);
  const toeEnd = (qe) => (qe > P.flat[1] ? smooth((qe - P.flat[1]) / (1 - P.flat[1])) : 0), heelEnd = (qe) => (qe < P.flat[0] ? 1 - smooth(qe / P.flat[0]) : 0);
  const leaveEnd = (se) => (se < 0.45 ? 1 - smooth(se / 0.45) : 0), landEnd = (se) => (se >= 0.45 ? smooth((se - 0.45) / 0.55) : 0);
  for (const side of SIDES) {
    const f = s.feet[side];
    const sw = f.swing;
    if (!sw) {
      const u = f.u ?? frac(s.phase - OFFSET[side]);
      const q = s.walking ? Math.min(1, u / Math.max(1e-3, beta)) : null;
      const g = gradeAlong(f.yaw);
      const qe = q == null ? 0 : back ? 1 - q : q;
      const ends = q == null ? 0 : back ? level(g, heelEnd(qe), toeEnd(qe)) : level(g, toeEnd(qe), heelEnd(qe));
      f.cur = { p: f.p, yaw: f.yaw, planted: true, sp: 0, kind: null, pitch: (q != null ? stancePitch(qe, P) * ac * RAD + ends : 0) * s.move + bias, grade: g, lift: 0 };
      continue;
    }
    const sp = flightProgress(sw);
    const at = flightAt(sw, sp);
    let pitch, lift;
    const g = gradeAlong(at.yaw);
    if (sw.kind === 'gait') {
      const se = back ? 1 - sw.s : sw.s;
      const ends = back ? level(g, landEnd(se), leaveEnd(se)) : level(g, leaveEnd(se), landEnd(se));
      pitch = (swingPitch(se, P) * ac * RAD + ends) + bias;
      lift = gaitLift(sw.s);
      if (sw.carry) {
        const k = smooth(clamp01(((sw.s - sw.carry.s) / Math.max(1e-3, 1 - sw.carry.s)) * 2));
        pitch = lerp(sw.carry.pitch, pitch, k);
        if (sw.carry.lift != null) lift = lerp(sw.carry.lift, lift, k);
      }
    } else {
      const k = minJerk(sp);
      const own = TURN.lift * L * Math.sin(Math.PI * sp);
      pitch = sw.carry ? lerp(sw.carry.pitch, bias, k) : bias;
      lift = sw.carry?.lift != null ? Math.max(sw.carry.lift * (1 - k), own) : own;
    }
    f.cur = { p: at.p, yaw: at.yaw, planted: false, sp, kind: sw.kind, pitch, grade: g, lift, held: sw.held ?? null };
  }
}

/**
 * STANDING: the feet that stand off their place - twisted past TURN.step, or TURN.dist legs off it (a stop's split feet,
 * a new carry's stance, a blow's lunge) - step to it one at a time, the foot on the turn's side first, the other after
 * once it is half as far off; a foot twisted past TURN.max steps at once whatever the other does (a pivot).
 */
function settle(s, body, spots, fly) {
  const L = body.leg;
  const off = (side) => {
    const f = s.feet[side];
    if (f.swing) return { d: 0, a: 0 };
    const t = spots[side];
    return { d: Math.hypot(f.p[0] - t.p[0], f.p[1] - t.p[1]) / L, a: Math.abs(wrapAngle(f.yaw - t.yaw)) / RAD };
  };
  const need = (o, k = 1) => o.d > TURN.dist * k || o.a > TURN.step * k;
  const o = { L: off('L'), R: off('R') };
  const flying = SIDES.filter((side) => s.feet[side].swing);
  if (flying.length) {
    for (const side of SIDES) if (!s.feet[side].swing && o[side].a > TURN.max) fly(s.feet[side], 'step');
    return;
  }
  const score = (side) => o[side].d / TURN.dist + o[side].a / TURN.step;
  const turnSide = s.yawRate > 0.05 ? 'R' : s.yawRate < -0.05 ? 'L' : null;
  let pick = null;
  if (need(o.L) || need(o.R)) pick = turnSide && need(o[turnSide]) ? turnSide : score('L') >= score('R') ? 'L' : 'R';
  else {
    // the other foot follows once it stands half as far off as a step's (the stance squared up)
    const last = s.lastStepped;
    const other = last === 'L' ? 'R' : last === 'R' ? 'L' : null;
    if (other && need(o[other], 0.5)) pick = other;
  }
  if (pick) { fly(s.feet[pick], 'step'); s.lastStepped = pick; }
  else if (!need(o.L, 0.5) && !need(o.R, 0.5)) s.lastStepped = null;
}

/**
 * THE HIPS' PLANNED HEIGHT (rig units, over the ground under the body) for the stride's `shape`: the standing or carried
 * height `hipH0`, the walk's `dip` where both feet are down, the run's spring `sink` and its height `runH`, and the
 * plan's `low` - shared by the pose (gaitPose lays the stride's waves on) and the feet (a planted foot lifts once its leg
 * no longer reaches it with the hips at the plan's lowest - GAIT-23).
 *
 * THE HIPS' RISE AND FALL (AUDIT BODY-MOTION GAIT-3 - the legs' reach was the dip's only shape, so it came as an edge:
 * the hips dropped 10 to 14 cm in a frame). A walk dips where both feet are down, as deep as legs a half-stance ahead
 * and behind need it (the foot's own overshoot on): planned over the stride, the reach its floor. A run sinks on the
 * standing leg's spring and rises on the flight's arc - the arc's rise the sink's own, so the two meet at the same speed
 * at every touchdown and push-off.
 */
function hipPlan(s, body, P, shape) {
  const L = body.leg;
  const { stride, beta, frShare, carriage, reach, sweep, grade, shift } = shape;
  const standH = lerp(STAND.height, STAND.sneak.height, s.sneak) * P.standHeight;
  const hipH0 = body.ankle + lerp(standH, carriage, s.move) * L;
  const halfStance = (stride * beta) / 2 + flightOvershoot(1 - beta, P.land) * stride;
  // each end of the stance (`half` along the travel from its middle, the stance `shift` up a slope) stands on the
  // ground's own height there, its ankle where that end's rocker stands it (the strike's and the push's - a backpedal's
  // its own, gaitPose: AUDIT BODY-MOTION GAIT-23, read at the bare ankle over the print, a backpedal's push stood 4
  // units past the hips' plan at every stride): the hips reach the lower of the two
  const ac = Math.min(1, Math.abs(s.along)) * s.move, way = s.along < 0 ? -1 : 1;
  const strikeP = (way > 0 ? P.heel : -P.toeOff) * ac * RAD, pushP = (way > 0 ? -P.toeOff : P.heel) * ac * RAD;
  const top = (x, z, pitch) => {
    const pl = footPlace([0, x * way], pitch, [0, 1], body);
    return z + pl.at[2] + Math.sqrt(Math.max(0, reach * reach - Math.min(reach * 0.98, Math.abs(pl.at[1])) ** 2));
  };
  const ends = (half) => Math.min(top(half + shift, grade * (half + shift), strikeP), top(shift - half, grade * (shift - half), pushP));
  const need = Math.max(0, hipH0 - ends(halfStance));
  const sink = P.bob * L * Math.min(1, frShare * 2 + 0.3);
  const dip = Math.max(sink, need * 1.04);
  // a run rides no higher than its leg reaches its stance's ends (its carriage the sweep's own) - on a slope, the end that
  // stands down it (AUDIT BODY-MOTION GAIT-20: up a 30 degree run the trailing foot stood 7 units under the planned hips)
  const runH = Math.min(hipH0, ends(Math.min(sweep, (stride * beta) / 2)));
  const low = lerp(hipH0 - s.move * dip, lerp(hipH0, runH, s.move) - s.move * sink, P.run);
  return { hipH0, dip, sink, runH, low };
}

/**
 * THE GAIT'S POSE this frame, in the rig: the hips' middle, their turn, drop and tilt; the chest's turn, drop and lean;
 * each foot's ankle, toe and up; and the free arms' swing - for the solver (bodySolve.js) and the carry (carry.js). The
 * carry's stance (stepGait's `stance`) turns the standing hips and leans the trunk; a strike's weight shift is laid on
 * after (bodyMotion.js). Pure.
 */
export function gaitPose(state, input, body) {
  const s = state;
  const P = blendStyle(s.run, s.sneak, input.kind);
  const L = body.leg;
  const shape = strideShape(s, input, body, P);
  const { stride, beta, frShare } = shape;
  const move = s.move;
  const phi = s.shown;
  const psi = s.psi;
  const hf = [-Math.sin(psi), Math.cos(psi), 0];
  const hr = [Math.cos(psi), Math.sin(psi), 0];
  const d = [s.dir[0], s.dir[1], 0];
  const c = clamp(s.along, -1, 1);   // how much of the travel is along the hips' forward (- a backpedal)
  const stance = s.stance;
  // ---- the feet (stepGait placed them: here the ankle over the print, turned and pitched) ----
  const feet = {};
  let twist = 0;
  for (const side of SIDES) {
    const cur = s.feet[side]?.cur;
    if (!cur) { feet[side] = null; continue; }
    const pl = footPlaceOn(cur.p, cur.pitch, cur.grade, [-Math.sin(cur.yaw), Math.cos(cur.yaw)], body);
    feet[side] = { at: [pl.at[0], pl.at[1], pl.at[2] + cur.lift], toe: pl.toe, up: pl.up, stance: cur.planted, lift: cur.lift, sp: cur.sp, kind: cur.kind, held: cur.held ?? null };
    twist += cur.yaw - (stance?.toe?.[side] ?? 0) * RAD;
  }
  // ---- the hips ----
  const idle = 1 - move;
  const sway = P.sway * L * move;
  const midL = beta / 2;
  const swayWave = -Math.cos(2 * Math.PI * (phi - midL));
  const listWave = Math.cos(2 * Math.PI * (phi - midL));
  const walkBob = (1 - Math.cos(4 * Math.PI * (phi - midL))) / 2;   // 0 at mid-stance, 1 between
  const { hipH0, dip, sink, runH } = hipPlan(s, body, P, shape);
  const walkDip = dip * walkBob;
  let runZ = 0;
  if (beta < 0.5) {
    const u = (side) => frac(phi - OFFSET[side]);
    const standing = SIDES.find((side) => u(side) < beta);
    if (standing) runZ = -sink * Math.sin((Math.PI * u(standing)) / beta);
    else {
      const flight = 0.5 - beta, tau = clamp01((frac(phi - beta) % 0.5) / flight);
      runZ = ((Math.PI * sink * flight) / (4 * beta)) * 4 * tau * (1 - tau);
    }
  } else runZ = -sink * (1 + Math.cos(4 * Math.PI * (phi - midL))) / 2;
  const hipH = lerp(hipH0 - move * walkDip, lerp(hipH0, runH, move) + move * runZ, P.run);
  const breathT = (2 * Math.PI * s.t) / STAND.breath, shiftT = (2 * Math.PI * s.t) / STAND.shift;
  const hipShift = stance?.hipShift ? [stance.hipShift[0] * L, stance.hipShift[1] * L] : [0, 0];
  const hipXY = [
    body.restHip[0] + hr[0] * sway * swayWave + idle * STAND.shiftSway * L * Math.sin(shiftT) + hipShift[0] * idle,
    body.restHip[1] + hr[1] * sway * swayWave + hipShift[1] * idle,
  ];
  // standing, the hips follow the feet a quarter of the way (the chest stays with the camera); a stance turns them its own way
  const hipYaw = psi * move + (twist * 0.25 + (stance?.hipYaw ?? 0) * RAD) * idle - P.hipYaw * RAD * Math.cos(2 * Math.PI * phi) * move * c;
  const hipRoll = P.hipList * RAD * listWave * move + idle * STAND.shiftList * RAD * Math.sin(shiftT);
  const standTilt = lerp(STAND.hipTilt, STAND.sneak.hipTilt, s.sneak) * P.standTilt;
  const hipPitch = lerp(standTilt, P.hipTilt, move) * RAD + P.hipTiltWave * RAD * Math.cos(4 * Math.PI * (phi - midL)) * move;
  // the legs hold the hips up: never higher than a standing leg reaches - nor than the swinging one reaches the ground
  // under its own flight (AUDIT BODY-MOTION GAIT-3: left out until it stood, the landing leg dropped the hips 10 to 14
  // cm in the frame it struck; taken in all through its flight - from the print it leaves, where the standing leg's own
  // reach was, to the foothold it lands on - the hips come down to it as it comes forward) - a soft min, so the dip is round
  let hipZ = hipH;
  const limits = { planned: hipH, L: Infinity, R: Infinity };
  for (const side of SIDES) {
    const f = feet[side];
    if (!f) continue;
    const sign = LANE[side];
    const jx = hipXY[0] + Math.cos(hipYaw) * sign * body.hipWidth * 0.5, jy = hipXY[1] + Math.sin(hipYaw) * sign * body.hipWidth * 0.5;
    const dz = -sign * Math.sin(hipRoll) * body.hipWidth * 0.5;   // the joint's height over the middle (the right drops with a + roll)
    const reach = (body.legs?.[side] ?? L) * 0.992;
    const leaving = !f.stance && f.kind === 'gait' && f.sp < 0.35;
    // a foot leaving the ground asks no more reach of its leg than it did as it left (GAIT-23: its flight starts at rest
    // and the body draws away from it - after a new key's lift, half a leg in four frames - and its hold dragged the hips
    // down to their floor after a foot already in the air)
    const dxy = Math.min(Math.hypot(f.at[0] - jx, f.at[1] - jy), leaving && f.held ? Math.hypot(f.held[0] - jx, f.held[1] - jy) : Infinity);
    // a foot in the air past what its leg reaches at the hips' lowest (a reversal's flight, flung ahead) holds the hips to
    // nothing: the leg reaches toward it and falls short a frame - let go over the last fifth of a leg before it, so a
    // flight that comes into reach takes the hips in by degrees (AUDIT BODY-MOTION GAIT-21: taken at once, a running
    // turn's landing foot dropped the hips 14 units in the frame it came within reach; RUN-STIFF: over a tenth, the
    // stiffer run's higher hips - less give in the leg - dropped 12 to 13.5 units in a back run turned fast into a strafe)
    const inReach = f.stance || leaving ? 1 : smooth(clamp01((Math.sqrt(Math.max(0, reach * reach - (HIP_FLOOR * L) ** 2)) - dxy) / (0.2 * L)));
    // a leg asked past its reach asks the hips no lower than a deep knee's bend: the foot falls short instead - a crash to
    // the ground was the reach's answer to a foot it could not reach
    // a stride's foot in the air lets the hips go as it leaves the ground and holds them again as it comes down (a
    // trailing foot just off the ground is no foot to stand on: held to it, a sprinter's hips sank behind it) - leaving,
    // the leg reaches the foot itself, rising, and lets go by its own clock wherever it stood; coming down, the ground it
    // lands on (GAIT-20: the ground under a leaving foot ran on down a slope behind it, and took the hips 15 units down
    // with it in the frames after toe-off)
    const top = Math.max(f.at[2] - (leaving ? 0 : f.lift) + Math.sqrt(Math.max(0, reach * reach - dxy * dxy)) - dz, body.ankle + HIP_FLOOR * L);
    const holds = inReach * (f.stance || f.kind !== 'gait' ? 1 : Math.max(1 - smooth(clamp01(f.sp / 0.25)), smooth(clamp01((f.sp - 0.45) / 0.45))));
    if (!(holds > 0)) continue;
    // held by as much as it holds: the hips go from where they would be to where it lets them, never in a frame
    limits[side] = top;
    hipZ = lerp(hipZ, smin(hipZ, top, L * 0.04), holds);
  }
  // ---- the chest ----
  const breath = Math.sin(breathT) * STAND.breathPitch * RAD * idle;
  const chestYaw = P.chestYaw * RAD * Math.cos(2 * Math.PI * phi) * move * c;
  const counterDrop = -P.chestRoll * RAD * listWave * move;
  const chestRoll = counterDrop + s.bank;
  const standLean = lerp(STAND.lean, STAND.sneak.lean, s.sneak) * P.standLean;
  const chestPitch = lerp(standLean, P.lean, move) * RAD + s.lean - breath + (stance?.lean ?? 0) * RAD * idle;
  // ---- the free arms: a backpedal swings them the other way, eased over (GAIT-12) ----
  const swing = (P.arm.swing * RAD * Math.cos(2 * Math.PI * phi)) * move * (1 - 2 * s.backShare);
  return {
    move, phase: phi, duty: beta, stride, frShare, run: P.run, sneak: P.sneak, back: s.back, speed: s.speed,
    hip: { at: [hipXY[0], hipXY[1], hipZ], yaw: hipYaw, roll: hipRoll, pitch: hipPitch, limits },
    // `wave`: the stride's own share of the chest's turn - the counter-turn and the counter-drop the swinging arms ride
    // (a held weapon's arm takes them by its row's swing share alone - carry.js carryHands, HELD-STEADY)
    chest: { yaw: chestYaw, roll: chestRoll, pitch: chestPitch, breath: Math.sin(breathT) * idle, wave: { yaw: chestYaw, roll: counterDrop } },
    feet,
    arm: { swing, bias: P.arm.bias * RAD * move, elbow: P.arm.elbow, abduct: P.arm.abduct * RAD, phase: phi },
  };
}

/** A flight's target that moves more than this (legs) in a frame - and more than 0.3 of the way it has still to go -
 *  has LEAPT (a reversal, a new place): the flight is re-based from where the foot is; one that drifts (a quickening
 *  stride's, a turning body's) is followed as it goes. */
const LEAP = 0.12;

/** The longest a stride's flight takes (seconds) - a slow walk's swing: a flight advances by the ground crossed, or by
 *  this much of itself a second, whichever is more. */
const FLIGHT_MAX = 0.45;

/** The lowest the legs' reach takes the hips (legs over the ankle): a deep knee's bend. */
const HIP_FLOOR = 0.62;

/** A smooth minimum: min(a, b), rounded over `k` where the two meet. */
function smin(a, b, k) {
  const hh = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - hh * hh * k * 0.25;
}
