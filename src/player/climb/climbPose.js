// CLIMB6 - THE MORROWIND BODY ON THE WALL, THE CLIMB'S HALF (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md;
// Mac: "Definitely want you to use the morrowind model to get correct animations for everything. Be as detailed as
// possible").
//
// The motor climbs a capsule; this is what the body's limbs do about it. A law per body (the own body and its arms
// share one, every peer has its own), fed the climb a frame at a time - the hold (a lip, a face), the move in flight
// (its kind and clock), the grip - and answering, in the WORLD (metres), where each hand and each foot goes, the way the
// fingers point and the palm faces, where the elbows and knees go, how the body leans, swings and fits under its hands,
// and where the head looks. combat/climbRig.js solves that on the skeleton (whatever skeleton: it reads the bones);
// combat/fpArm.js maps it into the rig. Nothing here knows a bone.
//
// WHAT THE BODY DOES (each number below is POSE's; every target is a point on the world the motor proved - the lip it
// holds, the face it climbs - so a hand placed is a hand ON the stone, not a pose that looks about right):
//   - HANGING: both hands on the lip, the wrists just past its edge, the fingers over the top and the palms on it; the
//     arms let out straight under them (the body fitted down to their reach) and the shoulders drawn up; the toes on the
//     wall below, the knees a little bent; the head up at the hands. Still, the body sways a little on its arms.
//   - THE SHIMMY: hand over hand along the lip - the lead hand reaches, lands, and the other follows, never crossing; a
//     hand off the stone lifts clear of it; the feet shuffle after. Each hand's hold stays where it landed.
//   - THE FREE CLIMB: the four limbs climb in a diagonal gait - a hand reaches up the face every FEEL.REACH climbed (the
//     camera's own reach), the other foot half a reach after - each hold fixed to the wall while the body passes it,
//     the hips in to the wall; the head looks up to the next hold.
//   - A CATCH lands both hands on the lip at once and the body swings on them like a pendulum, harder the faster it came.
//   - A PULL-UP (the mantle from a hang or from the ground, the clamber): the hands on the edge while the body rises, the
//     feet scrabbling up the face; then the palms press on the top as the body crests it, the lead knee comes up onto
//     it, and the hands let go as the body stands.
//   - THE VAULT: both hands planted on the top it clears, the knees tucked up past it, the hands off as the body goes
//     over.
//   - THE LOWER: crouched at the edge, the hands go down to it and take it; the body turns to the wall and goes down
//     over it into the hang, the feet finding the wall below.
//   - A CORNER: the lead hand crosses to the other face first, the other after it.
//   - A LEAP: the hands let go as the body pushes off, the arms reach for the hold it flies to all the way across, and
//     take it - and the body swings there.
//   - THE WALL RUN: the feet run up the face, a step every reach; the hands reach up for the lip (or the face) the run
//     ends on.
//   - IN A LEAP'S FLIGHT (the running leap, the eject): the arms come up and forward for the catch.
//   - THE GRIP FAILING: the hands tremble on the stone and the feet scrabble for the wall.
// The weight eases in fast (a catch is a grab) and out slower; a limb's own weight lets it go (a pull-up's hands) or
// take hold (a lower's). The head's look and the shoulders' shrug are shares, never all of the rig.

import { PARKOUR_BODY_RADIUS, PARKOUR_HANG_GAP, PARKOUR_UP_GAP, PARKOUR_HANG_DROP, PARKOUR_GRIP_LOW, PARKOUR_LIP_FOLLOW } from '../parkour.js';
import { FEEL } from './climbFeel.js';   // the reach and the shimmy's span: the body's hands keep the camera's rhythm

/** The constants of the pose. Metres, radians, seconds. */
export const POSE = Object.freeze({
  // where the body hangs off the face (the motor's own: CAPSULE_RADIUS + PARKOUR_HANG_GAP, motor.js _pkFaceOf)
  FACE_BACK: PARKOUR_BODY_RADIUS + PARKOUR_HANG_GAP,
  // the weights
  IN_TAU: 0.05,           // the climb's weight eases in on this (a catch is a grab)...
  OUT_TAU: 0.12,          // ...and out on this
  LIMB_TAU: 0.06,         // a limb's target follows a new hold on this (no pop between states)
  // the hands on a lip
  HANDS_APART: 0.42,      // wrist to wrist across the lip, at rest
  WRIST_OVER: 0.025,      // the wrist above the lip's top...
  WRIST_OUT: 0.035,       // ...and this far out past its edge: the palm on the top, the fingers over it
  FINGER_DIP: 0.18,       // the fingers' way tips down this much past level (over the edge)
  LIP_CURL: 0.35,         // the fingers' curl over the edge
  FACE_CURL: 0.75,        // ...and round a hold on a face
  SHRUG_HANG: 0.4,        // the clavicles' share toward a hand over the head
  SHRUG_CLIMB: 0.25,
  // the shimmy: a hand takes the lip every FEEL.SHIMMY_SPAN of travel (the camera's bob and the ear's grip), the
  // two in turn - a cycle is both hands, each reaching twice the span; square over the hold at its start
  SHIMMY_REACH: 0.8,      // the share of a hand's turn (a span of travel) it is off the stone - both hold the rest of it
  SHIMMY_FOOT_REACH: 0.6, // ...and a foot's
  HAND_LIFT: 0.06,        // a hand off the stone lifts this high...
  HAND_AWAY: 0.05,        // ...and this far out from the wall
  // the hang's body
  HANG_IN: 0.07,          // the body drawn this much nearer the wall than the capsule's axis
  HANG_FIT_DOWN: 0.16,    // the most the body may let down so the arms hang straight (never into a floor under it)
  FLOOR_CLEAR: 0.02,      // ...stopping this far over the floor the snapshot measured
  HANG_FIT_UP: 0.06,      // ...or rise so they reach
  HANG_LEAN: 0.06,        // the chest toward the wall
  HANG_LEG: 0.96,         // a hang's legs let out to this share of their length (the knees a little bent)...
  HANG_FOOT_UP: 0.14,     // ...the ankles' height when the rig cannot say (no leg to measure)...
  HANG_FOOT_OFF: 0.11,    // ...and this far off the face: the toes on the wall
  FEET_APART: 0.24,
  SWAY_PITCH: 0.025,      // a still hang's sway on the arms (at FEEL.SWAY_HZ, the camera's)
  SWAY_ROLL: 0.02,
  // the catch's pendulum
  SWING_BASE: 0.05,       // radians a catch swings the body at a standstill...
  SWING_PER_SPEED: 0.035, // ...and per m/s it came at
  SWING_MAX: 0.32,
  SWING_HZ: 0.9,
  SWING_DAMP: 2.4,        // 1/s
  // the free climb: a reach is the camera's (FEEL.REACH), a cycle is both hands
  CLIMB_DUTY: 0.62,
  CLIMB_HAND_UP: 1.88,    // the hands' rest height over the capsule's feet (the eye is at 1.7)...
  CLIMB_HAND_APART: 0.46,
  CLIMB_FOOT_UP: 0.34,    // ...the feet's
  CLIMB_FOOT_APART: 0.28,
  CLIMB_FOOT_OFF: 0.1,
  CLIMB_IN: 0.13,         // the hips in to the face
  CLIMB_LEAN: 0.1,
  SETTLE_S: 0.18,         // a limb caught mid-reach when the body stops finishes its reach in this long
  // the moves
  MANTLE_PRESS_IN: 0.07,  // over the top, the palms press this far in from the edge
  MANTLE_KNEE_IN: 0.22,   // the lead foot comes up onto the top this far in
  MANTLE_LEAN: 0.5,       // the chest over the top at the crest
  VAULT_TUCK: 0.12,       // the feet tucked this high over the top
  LEAP_REACH_FIT: 0.12,   // a leap's arms stretched for the hold (the body raised to them)
  FLIGHT_REACH: 0.55,     // in a leap's flight, the hands this far ahead...
  FLIGHT_RISE: 0.45,      // ...and this high over the shoulders' height (the capsule's 1.45)
  WALLRUN_STEP: 0.45,     // a foot on the face every this much the run rises
  LOWER_SQUAT: 0.35,      // the lower's squat to the edge, over the drawn body's way down
  // the grip failing
  TREMBLE: 0.012,         // the hands' tremble, metres
  TREMBLE_HZ: 9,
  SCRABBLE: 0.09,         // a foot's slip down the face
  SCRABBLE_HZ: 1.7,
});

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => { const u = clamp01(t); return u * u * (3 - 2 * u); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));
const ease = (v, target, tau, dt) => (tau > 0 ? v + (target - v) * (1 - Math.exp(-dt / tau)) : target);
const UP = Object.freeze([0, 1, 0]);

/** The wall's frame from its normal (out of it, level): `into` the wall, `right` along it to the right of a body facing
 *  it - the world's own handedness (forward [sin, 0, cos], right [cos, 0, -sin]: motor.js, fpArm drawThird). */
export function wallFrame(normal) {
  const n = norm([normal[0], 0, normal[2]]);
  return { n, into: [-n[0], 0, -n[2]], right: [-n[2], 0, n[0]] };
}

/**
 * THE GAIT: a limb on a hold-and-reach cycle over a travel coordinate. A cycle is `stride` of travel; the limb holds
 * its stone for `duty` of it and reaches for the next in the rest. `phase` sets which part of the cycle it is in at
 * travel 0. Answers { anchor, swing }: the travel at which the stone it holds (or is reaching from) was centred under
 * the body, and how far through its reach it is (0 holding). Travel run backward runs the cycle backward - the same
 * stones, taken in the other order. Pure.
 */
export function gait(travel, stride, phase, duty) {
  const u = travel / stride - phase;
  const k = Math.floor(u), f = u - k;
  const centre = (k + duty / 2 + phase) * stride;
  if (f < duty) return { anchor: centre, next: centre, swing: 0, cycle: k };
  return { anchor: centre, next: centre + stride, swing: (f - duty) / (1 - duty), cycle: k };
}

/**
 * THE SHIMMY'S GAIT: a limb's stones on a grid, `stride` apart along the lip, with the body square over stone 0 at
 * travel 0 (the hold just taken). The limb reaches from stone j to stone j+1 while the travel runs over
 * [j * stride + centre - width / 2, j * stride + centre + width / 2], and holds its stone the rest of the way - so the
 * limbs' bands, set apart, take them in turn, the one leading the way the body goes first (run backward, the same
 * stones in the other order, the other limb leading). Answers gait()'s { anchor, next, swing, cycle }. Pure.
 */
export function shimmyGait(travel, stride, centre, width) {
  const v = (travel - (centre - width / 2)) / stride;
  const j = Math.floor(v), f = (v - j) * stride;
  if (f < width) return { anchor: j * stride, next: (j + 1) * stride, swing: f / width, cycle: j };
  return { anchor: (j + 1) * stride, next: (j + 1) * stride, swing: 0, cycle: j };
}

/** A limb's slot in the frame's answer. */
const limb = () => ({ at: null, fingers: null, palm: null, toe: null, w: 0, pole: null, curl: 0, shrug: 0, hang: 0, releaseAtReach: false });

/**
 * The climb, a frame at a time, for one body. `update(dt, c)` takes the climb's snapshot (climbRigInput for the own
 * player, peerClimbInput for a peer - or null off the wall) and answers this.out:
 *   { w, offset, fit:{up,down}, swing:{pitch,roll}, lean:{pitch,roll}, hands:{L,R}, feet:{L,R}, look:{at,w}, frame }
 * in the world (metres, radians), each limb { at, fingers, palm | toe, w, pole, curl, shrug }. `w` 0 is no pose.
 */
export class ClimbPose {
  constructor() { this.reset(); }

  /** Back to rest (a placement, a load, a body rebuilt). */
  reset() {
    this.t = 0;
    this.w = 0;
    this.prevFeet = null;
    this.travel = 0;           // along the lip (signed) or up the face (path length)
    this.travelDir = [0, 1];   // the way the free climb last went, in the wall's (right, up)
    this.still = 0;            // seconds without travel on the wall
    this.swingAmp = 0; this.swingT = 0;
    this.moveRef = null;       // the move in flight, as first seen (a new one - a new object - restarts its anchors)
    this.moveStart = null;     // { L, R, normal } - the hands' points and the wall held when the move began
    this.lastNormal = null;    // the wall the last frame posed on (a corner's first face)
    this.settle = { L: { v: 0, prev: 0, cycle: null }, R: { v: 0, prev: 0, cycle: null }, FL: { v: 0, prev: 0, cycle: null }, FR: { v: 0, prev: 0, cycle: null } };
    this.hangLip = null;       // the lip the shimmy's travel counts from (a new hold starts it square)
    this.prevMode = null;      // last frame's: 'hang', 'climb', 'move', 'flight'
    this.cur = { L: null, R: null, FL: null, FR: null };   // the limbs' eased targets
    this.out = {
      w: 0, offset: [0, 0, 0], fit: { up: 0, down: 0 }, swing: { pitch: 0, roll: 0 }, lean: { pitch: 0, roll: 0 },
      hands: { L: limb(), R: limb() }, feet: { L: limb(), R: limb() }, look: { at: null, w: 0 }, frame: null,
    };
  }

  update(dt, c) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.t += dt;
    const out = this.out;
    const on = !!(c && (c.mode || c.move || c.flight));
    this.w = ease(this.w, on ? 1 : 0, on ? POSE.IN_TAU : POSE.OUT_TAU, dt);
    if (this.w < 1e-3 && !on) { this.reset(); return this.out; }
    out.w = this.w;
    if (!on) {
      // The motor removes a finished move before the renderer sees its final frame. A slow frame can skip the
      // vault's release window altogether; retain the body's ease-out, but never fade an already finished grip.
      if (this.moveRef?.kind === 'vault' && this.moveRef.t >= 1) {
        out.hands.L.w = 0;
        out.hands.R.w = 0;
      }
      return out;   // other exits keep the last frame's targets, fading
    }
    // the body's travel on the wall since the last frame (a teleport is none)
    const feet = c.track ?? c.feet;   // the gait reads the body's own way, never a moving hold's carry
    let d = [0, 0, 0];
    if (this.prevFeet) d = sub(feet, this.prevFeet);
    if (Math.hypot(d[0], d[1], d[2]) > 1) d = [0, 0, 0];
    this.prevFeet = [feet[0], feet[1], feet[2]];
    // reset the slots
    for (const s of ['L', 'R']) { Object.assign(out.hands[s], limb()); Object.assign(out.feet[s], limb()); }
    out.offset = [0, 0, 0]; out.fit = { up: 0, down: 0 }; out.swing = { pitch: 0, roll: 0 }; out.lean = { pitch: 0, roll: 0 };
    out.look = { at: null, w: 0 };
    // the catch's pendulum, ringing down whatever the body does next
    this.swingT += dt;
    const ring = this.swingAmp * Math.exp(-POSE.SWING_DAMP * this.swingT) * Math.cos(2 * Math.PI * POSE.SWING_HZ * this.swingT);
    const mode = c.move ? 'move' : c.mode ?? (c.flight ? 'flight' : null);
    if (c.move) this._move(dt, c, d);
    else if (c.mode === 'hang') this._hang(dt, c, d);
    else if (c.mode === 'climb') this._climb(dt, c, d);
    else if (c.flight) this._flight(dt, c);
    if (c.mode === 'hang' || c.move?.hang) out.swing.pitch += ring;
    // the grip failing: the hands tremble on the stone, the feet scrabble for the wall
    const fail = c.mode && Number.isFinite(c.grip) ? clamp01((PARKOUR_GRIP_LOW - c.grip) / PARKOUR_GRIP_LOW) : 0;
    if (fail > 0) this._failing(fail);
    // the limbs' targets follow a new hold without a pop
    this._ease(dt);
    if (!c.move) { this.moveRef = null; this.moveStart = null; }
    if (out.frame) this.lastNormal = out.frame.n;
    this.prevMode = mode;
    return out;
  }

  // ---- the hang and the shimmy ------------------------------------------------------------------------------------

  /** The lip's point in front of the body, at `along` metres to the right of it. */
  _lipPoint(c, fr, lipY, along) {
    const back = POSE.FACE_BACK;
    return [c.feet[0] + fr.into[0] * back + fr.right[0] * along, lipY, c.feet[2] + fr.into[2] * back + fr.right[2] * along];
  }

  /** A hand on a lip at `along`: the wrist over the top and past the edge, the fingers over it, the palm on it. */
  _handOnLip(h, c, fr, lipY, along, side, lift = 0) {
    const p = this._lipPoint(c, fr, lipY, along);
    h.at = add(p, add(scale(UP, POSE.WRIST_OVER + lift * POSE.HAND_LIFT), scale(fr.n, POSE.WRIST_OUT + lift * POSE.HAND_AWAY)));
    h.fingers = norm(add(fr.into, scale(UP, -POSE.FINGER_DIP)));
    h.palm = [0, -1, 0];
    h.curl = POSE.LIP_CURL * (1 - lift);
    h.shrug = POSE.SHRUG_HANG;
    h.w = 1;
    // the elbows out to the side and back off the wall, a little down
    const lat = side === 'R' ? 1 : -1;
    h.pole = norm(add(add(scale(fr.right, 0.75 * lat), scale(fr.n, 0.45)), scale(UP, -0.25)));
  }

  _hang(dt, c, d) {
    const out = this.out, fr = wallFrame(c.normal);
    out.frame = fr;
    let along = d[0] * fr.right[0] + d[2] * fr.right[2];
    // a hold newly taken (off a move, a leap, another lip) is the shimmy's stone 0: the hands square over it
    // AUDIT CLIMB-HANDS (found on the way): a lip the motor follows (a sloping one, a hull's - re-read every step) is the
    // same hold going on; the shimmy restarted on every new height and the hands never left stone 0
    if (this.prevMode !== 'hang' || !(Math.abs(c.lipY - this.hangLip) <= PARKOUR_LIP_FOLLOW)) {
      this.travel = 0; along = 0;
      for (const k of ['L', 'R', 'FL', 'FR']) this.settle[k] = { v: 0, prev: 0, cycle: null };
    }
    this.hangLip = c.lipY;
    this.travel += along;
    const moving = Math.abs(along) > 1e-5;
    this.still = moving ? 0 : this.still + dt;
    const span = FEEL.SHIMMY_SPAN, stride = 2 * span;
    const half = POSE.HANDS_APART / 2;
    // the hands' turns centred in their spans - the right's first going right, the left's going left - so a grip lands a
    // span apart either way (the ear's, climbSounds)
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const g = shimmyGait(this.travel, stride, s === 'R' ? span / 2 : 1.5 * span, POSE.SHIMMY_REACH * span);
      const sw = this._settled(s, g, moving, dt);
      const at = lerp(g.anchor, g.next, smooth(sw)) - this.travel;   // where along the lip, to the body's right
      this._handOnLip(out.hands[s], c, fr, c.lipY, at + lat * half, s, bump(sw, 0, 1));
    }
    // the feet on the wall below, shuffling with the hands (each foot after its hand going right, before it going left)
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const g = shimmyGait(this.travel, stride, s === 'R' ? 0.65 * span : 1.65 * span, POSE.SHIMMY_FOOT_REACH * span);
      const sw = this._settled('F' + s, g, moving, dt);
      const at = lerp(g.anchor, g.next, smooth(sw)) - this.travel + lat * POSE.FEET_APART / 2;
      this._footOnFace(out.feet[s], c, fr, at, c.feet[1] + POSE.HANG_FOOT_UP + 0.05 * bump(sw, 0, 1), POSE.HANG_FOOT_OFF + 0.06 * bump(sw, 0, 1), lat);
      out.feet[s].hang = POSE.HANG_LEG - 0.06 * bump(sw, 0, 1);
    }
    // the body: in to the wall, let down so the arms hang straight, the chest to the wall, a sway on the arms
    out.offset = scale(fr.into, POSE.HANG_IN);
    out.fit = { up: POSE.HANG_FIT_UP, down: this._fitDown(c) };
    out.lean.pitch = POSE.HANG_LEAN;
    if (!moving) {
      out.swing.pitch += POSE.SWAY_PITCH * Math.sin(2 * Math.PI * FEEL.SWAY_HZ * 1.37 * this.t);
      out.swing.roll += POSE.SWAY_ROLL * Math.sin(2 * Math.PI * FEEL.SWAY_HZ * this.t);
    } else {
      out.swing.roll += 0.04 * Math.sign(along) * Math.abs(Math.sin(Math.PI * this.travel / FEEL.SHIMMY_SPAN));
    }
    out.look = { at: this._lipPoint(c, fr, c.lipY, 0), w: 0.6 };
  }

  /** The most the body may be let down here: the hang's, less what the floor under the feet leaves (a hang over a
   *  low wall's foot would sink the drawn feet into the ground). */
  _fitDown(c, most = POSE.HANG_FIT_DOWN) {
    const gap = Number.isFinite(c.floorGap) ? c.floorGap - POSE.FLOOR_CLEAR : Infinity;
    return Math.max(0, Math.min(most, gap));
  }

  /** A limb's reach finishing on the clock when the body stops mid-reach (the travel would leave it in the air). */
  /** A limb's reach finishing on the clock when the body stops mid-reach (the travel would leave it in the air) - and
   *  once finished, on its new stone until the gait's reach is behind it (going on, it never swings back to finish
   *  again; going back, the gait's own stone takes it). `g` is the gait's answer. */
  _settled(key, g, moving, dt) {
    const st = this.settle[key], sw = g.swing;
    if (sw <= 0) { st.v = 0; st.cycle = null; return 0; }
    if (st.cycle !== g.cycle) { st.cycle = g.cycle; st.v = sw; st.prev = sw; }
    // stopped, the hand finishes onto the nearer stone: most of the way there it lands, barely off it takes it back
    if (!moving) st.v = st.v >= 0.5 ? Math.min(1, st.v + dt / POSE.SETTLE_S) : Math.max(0, st.v - dt / POSE.SETTLE_S);
    // going on (or back), a limb ahead of its gait (or behind it) closes on it by the band's end - never a jump:
    // the share left of the reach scales with the share of the band left
    else if (sw >= st.prev) st.v = st.prev < 1 ? st.v + (1 - st.v) * (sw - st.prev) / (1 - st.prev) : sw;
    else st.v = st.prev > 0 ? st.v * sw / st.prev : sw;
    st.prev = sw;
    return st.v;
  }

  /** A foot on the face: the ankle `off` metres off it, at height `y`, `along` metres to the body's right; the toes
   *  into the wall and a little down, the knee bent the way a knee bends - forward, toward the wall the body faces -
   *  and a little out. */
  _footOnFace(f, c, fr, along, y, off, lat) {
    const back = POSE.FACE_BACK;
    f.at = [c.feet[0] + fr.into[0] * back + fr.right[0] * along + fr.n[0] * off, y, c.feet[2] + fr.into[2] * back + fr.right[2] * along + fr.n[2] * off];
    f.toe = norm(add(fr.into, scale(UP, -0.45)));
    f.pole = norm(add(add(scale(fr.into, 0.9), scale(fr.right, 0.3 * lat)), scale(UP, 0.1)));
    f.hang = 0;
    f.w = 1;
  }

  // ---- the free climb ---------------------------------------------------------------------------------------------

  _climb(dt, c, d) {
    const out = this.out, fr = wallFrame(c.normal);
    out.frame = fr;
    // the travel on the face: its length, and its way in the face's (right, up)
    const a = d[0] * fr.right[0] + d[2] * fr.right[2], u = d[1];
    const step = Math.hypot(a, u);
    if (step > 1e-5) { this.travel += step; this.travelDir = [a / step, u / step]; }
    const moving = step > 1e-5;
    this.still = moving ? 0 : this.still + dt;
    const stride = 2 * FEEL.REACH;
    const [ta, tu] = this.travelDir;
    const back = POSE.FACE_BACK;
    const onFace = (alongR, y, off) => [c.feet[0] + fr.into[0] * back + fr.right[0] * alongR + fr.n[0] * off, y, c.feet[2] + fr.into[2] * back + fr.right[2] * alongR + fr.n[2] * off];
    // the stones: each limb's held point is the body's centre when it took it, plus the limb's rest, plus the lead
    const place = (key, phase, duty, restA, restY) => {
      const g = gait(this.travel, stride, phase, duty);
      const sw = this._settled(key, g, moving, dt);
      const from = g.anchor - this.travel, to = g.next - this.travel;   // the stone's travel, relative to the body now
      const k = smooth(sw);
      const rel = lerp(from, to, k);
      return { along: restA + ta * rel, y: c.feet[1] + restY + tu * rel, lift: bump(sw, 0, 1) };
    };
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const p = place(s, s === 'R' ? 0 : 0.5, POSE.CLIMB_DUTY, lat * POSE.CLIMB_HAND_APART / 2, POSE.CLIMB_HAND_UP);
      const h = out.hands[s];
      h.at = onFace(p.along, p.y, 0.05 + POSE.HAND_AWAY * 1.6 * p.lift);
      h.fingers = norm(add(UP, scale(fr.into, 0.35)));
      h.palm = fr.into;
      h.curl = POSE.FACE_CURL * (1 - 0.7 * p.lift);
      h.shrug = POSE.SHRUG_CLIMB;
      h.w = 1;
      h.pole = norm(add(add(scale(fr.right, 0.6 * lat), scale(UP, -0.65)), scale(fr.n, 0.3)));
    }
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      // the other foot half a reach after its hand: the diagonal pair
      const p = place('F' + s, s === 'R' ? 0.75 : 0.25, POSE.CLIMB_DUTY, lat * POSE.CLIMB_FOOT_APART / 2, POSE.CLIMB_FOOT_UP);
      this._footOnFace(out.feet[s], c, fr, p.along, p.y + 0.06 * p.lift, POSE.CLIMB_FOOT_OFF + 0.08 * p.lift, lat);
      out.feet[s].pole = norm(add(add(scale(fr.into, 0.25), scale(fr.right, 0.9 * lat)), scale(UP, 0.25)));   // a climber's knees turn out
    }
    out.offset = scale(fr.into, POSE.CLIMB_IN);
    out.lean.pitch = POSE.CLIMB_LEAN;
    out.swing.roll = 0.035 * Math.sin(Math.PI * this.travel / FEEL.REACH);
    // the head up to the hand reaching (else between the hands)
    const hi = out.hands.L.at[1] > out.hands.R.at[1] ? out.hands.L.at : out.hands.R.at;
    out.look = { at: hi, w: 0.5 };
  }

  // ---- a move in flight -------------------------------------------------------------------------------------------

  _move(dt, c, d) {
    const m = c.move, out = this.out;
    if (m !== this.moveRef) {   // a new move (the motor's own object, read only): its start is the limbs' where they are
      this.moveRef = m;
      this.moveStart = { L: this.cur.L?.slice() ?? null, R: this.cur.R?.slice() ?? null, normal: this.lastNormal };
      if (m.kind === 'catch' || m.kind === 'reach' || m.kind === 'leap') {
        // the pendulum, harder the faster the body came to the lip
        this.swingAmp = Math.min(POSE.SWING_MAX, POSE.SWING_BASE + POSE.SWING_PER_SPEED * (m.speed ?? 0));
        this.swingT = 0;
      }
    }
    const t = clamp01(m.t ?? 0);
    switch (m.kind) {
      case 'catch': case 'reach': return this._toHang(c, m, t, 0.45);
      case 'leap': return this._leap(c, m, t);
      case 'corner': return this._corner(c, m, t);
      case 'lower': return this._lower(c, m, t);
      case 'vault': return this._vault(c, m, t);
      case 'wallrun': return this._wallrun(c, m, t);
      case 'mantle': default: return this._mantle(c, m, t);
    }
  }

  /** The hang a move ends in, its hands on the lip (the body where the move has it now). `reach` the share of the
   *  move over which the hands come from where they were. */
  _toHang(c, m, t, reach) {
    const out = this.out, fr = wallFrame(m.hang?.normal ?? c.normal ?? [0, 0, 1]);
    out.frame = fr;
    const lipY = m.hang?.lipY ?? c.lipY;
    const end = { ...c, feet: m.to ?? c.feet };
    for (const s of ['L', 'R']) {
      this._handOnLip(out.hands[s], end, fr, lipY, (s === 'R' ? 1 : -1) * POSE.HANDS_APART / 2, s);
      out.hands[s].w = smooth(t / reach) * 0.5 + 0.5;
    }
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      this._footOnFace(out.feet[s], end, fr, lat * POSE.FEET_APART / 2, c.feet[1] + POSE.HANG_FOOT_UP, POSE.HANG_FOOT_OFF + 0.15 * (1 - t), lat);
      out.feet[s].w = smooth(t);
    }
    out.offset = scale(fr.into, POSE.HANG_IN * t);
    out.fit = { up: POSE.HANG_FIT_UP, down: this._fitDown(c) };
    out.lean.pitch = POSE.HANG_LEAN;
    out.look = { at: this._lipPoint(end, fr, lipY, 0), w: 0.6 };
  }

  /** The edge a move climbs over: its height (the top) and its line (the face under the body's rise). */
  _edgeOf(m) {
    const into = norm([m.to[0] - m.up[0], 0, m.to[2] - m.up[2]]);
    const n = [-into[0], 0, -into[2]];
    const back = PARKOUR_BODY_RADIUS + PARKOUR_UP_GAP;
    const y = m.up[1] - PARKOUR_UP_GAP;
    return { fr: wallFrame(n), y, at: [m.up[0] + into[0] * back, y, m.up[2] + into[2] * back] };
  }

  _mantle(c, m, t) {
    const out = this.out;
    if (!m.up || !m.to) return;
    const { fr, y, at: edge } = this._edgeOf(m);
    out.frame = fr;
    const split = clamp01(m.split ?? 0.5);
    const over = t <= split ? 0 : (t - split) / Math.max(1e-6, 1 - split);   // 0 through the rise, then 0..1 over the top
    const clamber = !!m.exit;
    const half = POSE.HANDS_APART / 2;
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const h = out.hands[s];
      // on the edge through the rise; then the palms press on the top just in from it, the arms pushing down
      const grip = add(edge, scale(fr.right, lat * half));
      const press = add(add(edge, scale(fr.into, POSE.MANTLE_PRESS_IN)), scale(fr.right, lat * half * 1.1));
      const k = smooth(over / 0.35);
      h.at = add(lerp3(add(grip, scale(fr.n, POSE.WRIST_OUT)), press, k), scale(UP, POSE.WRIST_OVER));
      h.fingers = norm(add(fr.into, scale(UP, -POSE.FINGER_DIP * (1 - k))));
      h.palm = [0, -1, 0];
      h.curl = POSE.LIP_CURL * (1 - k);
      h.shrug = POSE.SHRUG_HANG * (1 - smooth(over));
      h.pole = norm(add(add(scale(fr.right, 0.7 * lat), scale(fr.n, 0.5 + 0.4 * k)), scale(UP, 0.2 * k - 0.2)));
      // the hands come to the edge over the rise's first part (from a hang they are already on it), and let go as the
      // body stands (a clamber's, as it drops off the far side)
      const take = this.moveStart?.[s] ? 1 : smooth(t / Math.max(0.08, split * 0.4));
      const letGo = clamber ? 1 - smooth((over - 0.45) / 0.3) : 1 - smooth((over - 0.6) / 0.35);
      h.w = take * letGo;
    }
    // the feet: scrabbling up the face through the rise, then the lead knee onto the top and the other after
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1, lead = s === 'R';
      const f = out.feet[s];
      if (t <= split) {
        const rise = t / Math.max(1e-6, split);
        const step = Math.abs(Math.sin(Math.PI * (rise * 2 + (lead ? 0 : 0.5))));
        this._footOnFace(f, c, fr, lat * POSE.FEET_APART / 2, c.feet[1] + 0.25 + 0.15 * step, POSE.HANG_FOOT_OFF + 0.05 * step, lat);
        f.w = 0.85;
      } else {
        const k = smooth((over - (lead ? 0.05 : 0.45)) / 0.4);
        const onTop = add(add(edge, scale(fr.into, POSE.MANTLE_KNEE_IN + (lead ? 0 : 0.1))), add(scale(fr.right, lat * POSE.FEET_APART / 2), scale(UP, 0.1)));
        this._footOnFace(f, c, fr, lat * POSE.FEET_APART / 2, c.feet[1] + 0.25, POSE.HANG_FOOT_OFF, lat);
        f.at = lerp3(f.at, onTop, k);
        f.toe = norm(lerp3(f.toe, add(fr.into, scale(UP, -0.1)), k));
        f.pole = norm(lerp3(f.pole, add(fr.into, scale(UP, 0.6)), k));   // the knee up and forward over the top
        f.w = (1 - smooth((over - 0.75) / 0.25)) * 0.9;
      }
    }
    out.offset = scale(fr.into, POSE.HANG_IN * (1 - smooth(over)));
    out.fit = { up: 0.04, down: t < split ? this._fitDown(c) * (1 - t / split) : 0 };
    const crest = t <= split ? smooth((t / Math.max(1e-6, split) - 0.6) / 0.4) * 0.5 : 0.5 + 0.5 * bump(over, 0, 1.15);
    out.lean.pitch = POSE.HANG_LEAN + POSE.MANTLE_LEAN * crest * (1 - smooth((over - 0.7) / 0.3));
    out.look = { at: add(edge, scale(fr.into, 0.6 * smooth(over))), w: 0.5 * (1 - smooth(over)) };
  }

  _vault(c, m, t) {
    const out = this.out;
    if (!m.up || !m.to) return;
    const { fr, y, at: edge } = this._edgeOf(m);
    out.frame = fr;
    const half = POSE.HANDS_APART / 2 * 0.9;
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const h = out.hands[s];
      h.at = add(add(edge, scale(fr.into, 0.08)), add(scale(fr.right, lat * half), scale(UP, POSE.WRIST_OVER)));
      h.fingers = norm(add(fr.into, scale(fr.right, 0.2 * lat)));
      h.palm = [0, -1, 0];
      h.curl = 0.15;
      h.pole = norm(add(scale(fr.n, 0.8), scale(fr.right, 0.3 * lat)));
      h.w = smooth(t / 0.12) * (1 - smooth((t - 0.55) / 0.25));
      // The capsule rises above the top before this clock lets go. Both modelled views must also release when their
      // own shoulder can no longer reach the world hold; the first-person map retains its distance beside the ray.
      h.releaseAtReach = true;
    }
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const f = out.feet[s];
      // the knees tucked up to the chest as the body passes over its hands: the feet drawn up under the hips (the
      // body's own frame - the top falls away under them), clear of the top, then let down to land
      const tuck = bump(t, 0.12, 0.92);
      f.at = add(c.feet, add(add(scale(fr.into, 0.18 * tuck), scale(fr.right, lat * 0.13)), scale(UP, 0.12 + POSE.VAULT_TUCK * 4 * tuck)));
      f.toe = norm(add(fr.into, scale(UP, -0.35)));
      f.pole = norm(add(fr.into, scale(UP, 0.9)));   // the knees up and forward
      f.w = tuck;
    }
    out.lean.pitch = 0.45 * bump(t, 0, 1);
    out.look = { at: add(edge, scale(fr.into, 1.2)), w: 0.4 };
  }

  _lower(c, m, t) {
    const out = this.out;
    const fr = wallFrame(m.hang?.normal ?? c.normal ?? [0, 0, 1]);
    out.frame = fr;
    const lipY = m.hang?.lipY ?? c.lipY;
    const end = { ...c, feet: m.to ?? c.feet };
    // THE BODY'S OWN WAY DOWN. The capsule goes out over the edge level, then straight down (planLower: a path proven
    // for a standing body); a body doing that would float out over the drop and fall. The drawn body goes down at
    // once instead - squatting to the edge, its legs over, sliding down the face to the hang - by an offset under the
    // capsule that is zero where the two meet (the start, the hang).
    const from = m.from ?? c.feet, to = m.to ?? c.feet;
    const k = smooth(t);
    const drawnY = lerp(from[1], to[1], k) - POSE.LOWER_SQUAT * bump(t, 0, 0.55);
    out.offset = add([0, drawnY - c.feet[1], 0], scale(fr.into, POSE.HANG_IN * smooth((t - 0.5) / 0.5)));
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      this._handOnLip(out.hands[s], end, fr, lipY, lat * POSE.HANDS_APART / 2, s);
      // the hands go down to the edge as the body squats over it, and hold it from then on
      out.hands[s].w = smooth((t - 0.04) / 0.22);
      out.hands[s].shrug = POSE.SHRUG_HANG * smooth((t - 0.4) / 0.4);
    }
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const f = out.feet[s];
      // planted on the top where the move began while the body squats to the edge, then over it and down the face
      const planted = add(from, add(scale(fr.right, lat * POSE.FEET_APART / 2), scale(fr.into, 0.05)));
      this._footOnFace(f, { ...c, feet: [c.feet[0], drawnY, c.feet[2]] }, fr, lat * POSE.FEET_APART / 2, drawnY + POSE.HANG_FOOT_UP, POSE.HANG_FOOT_OFF, lat);
      const over = smooth((t - 0.32) / 0.3);
      f.at = lerp3(planted, f.at, over);
      f.toe = norm(lerp3(fr.into, f.toe, over));
      f.pole = norm(lerp3(add(fr.into, scale(UP, 0.4)), f.pole, over));   // a squat's knees forward, over the toes
      f.hang = over >= 1 ? POSE.HANG_LEG : 0;
      f.w = 1;
    }
    out.fit = { up: 0, down: this._fitDown(c) * smooth((t - 0.6) / 0.4) };
    out.lean.pitch = 0.3 * bump(t, 0, 0.7) + POSE.HANG_LEAN * smooth((t - 0.6) / 0.4);
    // look down over the edge, then at the wall
    out.look = { at: add(this._lipPoint(end, fr, lipY, 0), scale(UP, -1.2 * bump(t, 0, 0.8))), w: 0.6 };
  }

  _corner(c, m, t) {
    const out = this.out;
    // the face held before the corner (the hold's normal as the move began) and the one after
    const was = wallFrame(this.moveStart?.normal ?? c.normal ?? m.hang?.normal ?? [0, 0, 1]);
    const now = wallFrame(m.hang?.normal ?? c.normal ?? [0, 0, 1]);
    out.frame = now;
    const lipY = m.hang?.lipY ?? c.lipY;
    // AUDIT CLIMB-HANDS (found on the way): the way read off the move's own path - the motor sets `way` on the move's
    // EVENT (motor.js _pkMoveEvent), never on the move, so `m.way` was always undefined and the right hand led every corner
    const toward = m.up ?? m.to;
    const way = toward && m.from ? Math.sign((toward[0] - m.from[0]) * was.right[0] + (toward[2] - m.from[2]) * was.right[2]) || 1 : 1;
    const startC = { ...c, feet: m.from ?? c.feet }, endC = { ...c, feet: m.to ?? c.feet };
    const half = POSE.HANDS_APART / 2;
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const lead = lat === way;
      const k = smooth(lead ? t / 0.55 : (t - 0.4) / 0.6);
      const a = {}, b = {};
      this._handOnLip(Object.assign(a, limb()), startC, was, lipY, lat * half, s);
      this._handOnLip(Object.assign(b, limb()), endC, now, lipY, lat * half, s);
      const h = out.hands[s];
      Object.assign(h, b);
      h.at = add(lerp3(a.at, b.at, k), add(scale(UP, POSE.HAND_LIFT * bump(k, 0, 1)), scale(norm(add(was.n, now.n)), POSE.HAND_AWAY * bump(k, 0, 1))));
      h.fingers = norm(lerp3(a.fingers, b.fingers, k));
      h.pole = norm(lerp3(a.pole, b.pole, k));
      h.w = 1;
    }
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      this._footOnFace(out.feet[s], { ...c, feet: c.feet }, t < 0.5 ? was : now, lat * POSE.FEET_APART / 2, c.feet[1] + POSE.HANG_FOOT_UP, POSE.HANG_FOOT_OFF + 0.06 * bump(t, 0, 1), lat);
    }
    out.offset = scale(norm(lerp3(was.into, now.into, t)), POSE.HANG_IN);
    out.fit = { up: POSE.HANG_FIT_UP, down: this._fitDown(c) };
    out.lean.pitch = POSE.HANG_LEAN;
    out.look = { at: this._lipPoint(endC, now, lipY, 0), w: 0.6 };
  }

  _leap(c, m, t) {
    const out = this.out;
    const fr = wallFrame(m.hang?.normal ?? c.normal ?? [0, 0, 1]);
    out.frame = fr;
    const lipY = m.hang?.lipY ?? c.lipY;
    const end = { ...c, feet: m.to ?? c.feet };
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      this._handOnLip(out.hands[s], end, fr, lipY, lat * POSE.HANDS_APART / 2, s);
      const h = out.hands[s];
      // off the stone at the push, reaching for the hold across the flight, on it at the end
      h.w = t < 0.18 ? 1 - 0.6 * smooth(t / 0.18) : 0.4 + 0.6 * smooth((t - 0.18) / 0.62);
      h.curl = POSE.LIP_CURL * smooth((t - 0.8) / 0.2);
    }
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      this._footOnFace(out.feet[s], c, fr, lat * POSE.FEET_APART / 2, c.feet[1] + POSE.HANG_FOOT_UP, POSE.HANG_FOOT_OFF + 0.25 * bump(t, 0.1, 0.9), lat);
      out.feet[s].w = 1 - 0.7 * bump(t, 0.1, 0.9);   // the legs swing free across, and find the wall again
    }
    out.fit = { up: POSE.LEAP_REACH_FIT * bump(t, 0.2, 1.2), down: this._fitDown(c) * smooth((t - 0.8) / 0.2) };
    out.lean.pitch = POSE.HANG_LEAN;
    out.look = { at: this._lipPoint(end, fr, lipY, 0), w: 0.7 };
  }

  _wallrun(c, m, t) {
    const out = this.out;
    const n = m.hang?.normal ?? m.wall?.normal ?? c.normal ?? [0, 0, 1];
    const fr = wallFrame(n);
    out.frame = fr;
    // the feet run up the face: a step every WALLRUN_STEP the body rises, the feet taking turns
    const rise = (c.feet[1] - (m.from?.[1] ?? c.feet[1]));
    const ph = rise / POSE.WALLRUN_STEP;
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const g = gait(rise, 2 * POSE.WALLRUN_STEP, s === 'R' ? 0 : 0.5, 0.5);
      const k = smooth(g.swing);
      const y = (m.from?.[1] ?? c.feet[1]) + lerp(g.anchor, g.next, k) + 0.3;
      this._footOnFace(out.feet[s], c, fr, lat * POSE.FEET_APART / 2, y, 0.08 + 0.12 * bump(k, 0, 1), lat);
      out.feet[s].w = 1 - smooth((t - 0.75) / 0.25) * (m.hang ? 0.6 : 0);
    }
    // the hands reach up for what the run ends on
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const h = out.hands[s];
      if (m.hang) {
        const end = { ...c, feet: m.to ?? c.feet };
        this._handOnLip(h, end, fr, m.hang.lipY, lat * POSE.HANDS_APART / 2, s);
      } else {
        const back = POSE.FACE_BACK;
        h.at = [c.feet[0] + fr.into[0] * back + fr.right[0] * lat * POSE.CLIMB_HAND_APART / 2 + fr.n[0] * 0.05, c.feet[1] + POSE.CLIMB_HAND_UP, c.feet[2] + fr.into[2] * back + fr.right[2] * lat * POSE.CLIMB_HAND_APART / 2 + fr.n[2] * 0.05];
        h.fingers = norm(add(UP, scale(fr.into, 0.35))); h.palm = fr.into; h.curl = POSE.FACE_CURL;
        h.pole = norm(add(scale(fr.right, 0.6 * lat), scale(UP, -0.6)));
      }
      // the arms pump with the steps, then reach
      h.w = 0.2 * Math.abs(Math.sin(Math.PI * (ph + (lat > 0 ? 0 : 0.5)))) * (1 - smooth((t - 0.55) / 0.3)) + smooth((t - 0.55) / 0.4);
    }
    out.offset = scale(fr.into, 0.06);
    out.lean.pitch = -0.08 + 0.15 * smooth((t - 0.6) / 0.4);
    out.fit = { up: m.hang ? POSE.LEAP_REACH_FIT : 0, down: 0 };
    out.look = { at: add(c.feet, add(scale(fr.into, 0.6), scale(UP, 2.4))), w: 0.5 };
  }

  /** A leap's flight off the wall or an edge (no hold, no move): the arms up and forward for the catch. */
  _flight(dt, c) {
    const out = this.out;
    const dir = c.flight?.dir ? norm([c.flight.dir[0], 0, c.flight.dir[2]]) : null;
    if (!dir) return;
    const fr = wallFrame([-dir[0], 0, -dir[2]]);   // the way it flies as the "into"
    out.frame = fr;
    const descending = c.flight.vy != null ? smooth(-c.flight.vy / 3) : 0.5;
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      const h = out.hands[s];
      h.at = add(c.feet, add(add(scale(dir, POSE.FLIGHT_REACH), scale(fr.right, lat * 0.24)), scale(UP, 1.45 + POSE.FLIGHT_RISE)));
      h.fingers = norm(add(dir, scale(UP, 0.4)));
      h.palm = norm(add(scale(dir, 1), scale(UP, -0.3)));
      h.curl = 0.25;
      h.pole = norm(add(scale(fr.right, 0.6 * lat), scale(UP, -0.7)));
      h.w = 0.35 + 0.45 * descending;
    }
    out.look = { at: add(c.feet, add(scale(dir, 2), scale(UP, 1.2))), w: 0.4 };
  }

  // ---- the grip failing and the easing ----------------------------------------------------------------------------

  _failing(k) {
    const out = this.out, t = this.t;
    const tr = (ph) => (Math.sin(t * POSE.TREMBLE_HZ * 6.283 + ph) * 0.6 + Math.sin(t * POSE.TREMBLE_HZ * 15.7 + ph * 2.3) * 0.4);
    for (const s of ['L', 'R']) {
      const h = out.hands[s];
      if (h.at) h.at = add(h.at, [POSE.TREMBLE * k * tr(s === 'R' ? 0 : 1.7), POSE.TREMBLE * k * tr(s === 'R' ? 2.1 : 3.3), POSE.TREMBLE * k * tr(s === 'R' ? 4.2 : 0.6)]);
      const f = out.feet[s];
      if (f.at) {
        // a foot slips down the face and kicks back up for it, the two out of step
        const slip = Math.max(0, Math.sin(2 * Math.PI * POSE.SCRABBLE_HZ * t + (s === 'R' ? 0 : Math.PI)));
        f.at = add(f.at, [0, -POSE.SCRABBLE * k * slip * slip, 0]);
      }
    }
  }

  /** Each limb's target eased onto the frame's (a change of hold is a reach, never a jump); the gait's own motion
   *  passes through untouched (the ease is on the jump between frames, not the motion within one). */
  _ease(dt) {
    const out = this.out;
    for (const [key, slot] of [['L', out.hands.L], ['R', out.hands.R], ['FL', out.feet.L], ['FR', out.feet.R]]) {
      if (!slot.at) { this.cur[key] = null; continue; }
      const prev = this.cur[key];
      if (prev && Math.hypot(prev[0] - slot.at[0], prev[1] - slot.at[1], prev[2] - slot.at[2]) > 0.15) {
        const k = 1 - Math.exp(-dt / POSE.LIMB_TAU);
        slot.at = lerp3(prev, slot.at, k);
      }
      this.cur[key] = slot.at.slice();
    }
  }
}

/**
 * The OWN body's climb this frame, read off the motor (duck-typed: `onWall`, `hanging`, `wallNormal`, `climbMove`,
 * `climbHold` (the hold's lip), `climbFlight`, `grip`, `climb`, `bodyFeetAt`, `bodyYawFor`): null off the wall, out of a
 * move and out of a leap's flight. `viewYaw` is the view's heading (the body's yaw is the motor's, eased to the wall).
 */
export function climbRigInput(player, viewYaw) {
  if (!player) return null;
  const move = player.climbMove ?? null;
  const onWall = !!player.onWall;
  const classic = !onWall && !move && !!player.climb?.isClimbing;
  const flight = !onWall && !move && player.climbFlight ? { dir: player.climbFlight.dir, vy: player.velY ?? null } : null;
  if (!onWall && !move && !classic && !flight) return null;
  const feet = typeof player.bodyFeetAt === 'function' ? player.bodyFeetAt() : player.pos;
  const yaw = typeof player.bodyYawFor === 'function' ? player.bodyYawFor(viewYaw) : viewYaw;
  // the classic climb (DFU's ClimbingMotor) climbs the wall the body faces
  const normal = player.wallNormal ?? (classic ? [-Math.sin(yaw), 0, -Math.cos(yaw)] : null);
  return {
    feet: [feet[0], feet[1], feet[2]], yaw,
    track: typeof player.climbTrackPos === 'function' ? player.climbTrackPos() : null,   // the body's own way (not a carry's)
    floorGap: floorGapAt(player.collider, feet),
    mode: onWall ? (player.hanging ? 'hang' : 'climb') : (classic ? 'climb' : null),
    classic,   // CLIMB-HANDS: DFU's own climb - the sprite lane keeps WeaponManager's empty screen for it (combat/climbHands.js)
    normal, lipY: player.climbHold?.lipY ?? null,
    move,   // the motor's own object, read only - its identity is the move's
    grip: Number.isFinite(player.grip) ? player.grip : 1,
    flight,
  };
}

/** How far the floor is under `feet` (metres, the meshes' and the ground's - collider.surfaceHit's down ray), or
 *  Infinity with none within a metre: the drawn body's let-down stops short of it. */
export function floorGapAt(collider, feet) {
  if (!collider?.surfaceHit || !feet) return Infinity;
  const hit = collider.surfaceHit([feet[0], feet[1] + 0.05, feet[2]], [0, -1, 0], 1.05);
  return Number.isFinite(hit?.dist) ? Math.max(0, hit.dist - 0.05) : Infinity;
}

/** The lip of a peer's hang, as the motor holds every hang: PARKOUR_HANG_DROP over its feet (parkour.js senseGrip). */
export const peerLipY = (feetY) => feetY + PARKOUR_HANG_DROP;
