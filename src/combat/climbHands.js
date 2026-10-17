// @ts-check
// CLIMB-HANDS (2026-10-02, Mac: "Here are two textures for the first person view (not morrowind)" - the raised fist
// "needs to be mirrored, thumbs inside so we can utilize 2 arms ... for hanging on a ledge, climbing, etc"; the reaching
// arm "for when you're climbing and look around for a place to jump to" - "whenever you look away from the wall your
// climbing or ledge you are hanging from", "mirrored", and "Definitely animate the arms for when you are climbing, or
// shifting left to right climbing/on a ledge"). THE CLASSIC LANE'S HANDS ON THE WALL. Design: bible/03-World/Parkour-Arc.md
// (CLIMB-HANDS, AUDIT CLIMB-HANDS).
//
// CLIMB4 lowered the classic sprite out of the screen for the climb (WeaponManager's climbing return) and left the screen
// empty; CLIMB6 gave the Morrowind arms a pose on the stone. This is the sprite lane's: Mac's two paintings,
// public/art/climb-grip.png (a fist, the back of the hand to the eye, its thumb on the painting's right - a left hand:
// drawn as it is on the left and mirrored on the right, so both thumbs are inside) and public/art/climb-reach.png (an arm
// up from the bottom-left reaching to the right, the back of its open hand to the eye and its thumb under the fingers - a
// left arm: drawn as it is from the left, mirrored from the right).
//
// THE LAW (`ClimbHands`, pure: no renderer, no clock but the `dt` it is handed) reads the climb's snapshot
// (player/climb/climbPose.js climbRigInput) and the view, and answers each sprite's rect on DFU's 320x200 design surface. The
// hands do what the climbing body does (AUDIT CLIMB-HANDS: ClimbPose is the one choreography - its gaits, its moves'
// windows - drawn here as a hand's way on the wall relative to the body, GAIT_PX to the metre):
//   - THE HOLD: both fists up, the arms running off the bottom of the screen; a still hang sways on the arms, the two
//     hands as one (one lip), as the body sways under them.
//   - THE SHIMMY: ClimbPose's shimmyGait - the hand the body goes toward reaches first, the other closes up after it, a
//     grip every PARKOUR_HAND_SPAN along the lip (the ear's, the 3D body's); a hand on the lip goes with the wall,
//     against the way the body goes. Stopped mid-reach, the hand finishes onto the nearer stone (ClimbPose._settled).
//   - THE FREE CLIMB: ClimbPose's gait - hand over hand, the left first, a grip every FEEL.REACH climbed (up, down or
//     across); a held hand goes down the view as the body climbs past it.
//   - THE MOVES, from where the hands were when each began (a hand not up comes from FROM_BELOW): a catch and a reach
//     onto the hold by 0.45 of the clock, a leap pushed off by 0.18 and on the new hold by 0.8, then the weight landing
//     (the arms straighten, ClimbPose's pendulum); a mantle down the view as the body rises past the hands, a press over
//     the top, let go on the pose's clock; a vault planted by 0.12, gone by 0.8; a lower onto the edge by 0.26, then up
//     to the hang as the body drops; a corner the leading hand first; a wall run's arms pumping with its steps, then up.
//   - THE GRIP FAILING: the hands tremble on the stone, harder the lower the grip (the feel's noise, the pose's rate).
//   - LOOKING AWAY: turned off the wall's face, the hand on the side looked to lets go of the stone and becomes the
//     reaching arm, up from that side of the screen and open toward the middle of the view, the way the eye looks - the
//     right arm looked right, the left looked left (Mac, 2026-10-13: "The single arm out is also inverted for both
//     directions"); the other hand stays on the stone (Mac, 2026-10-02: "For look right/left dont use the hand aiming
//     straight up. Only use the angled arm" - turned that far, the wall it holds is out of the view).
// THE HANDS ON THE WALL, NOT ON THE SCREEN (Mac, 2026-10-13: "the hands should stay on whatever your climbing and not
// rotate with the screen. The only one that should rotate with the screen is the single arm out"): every place above is
// the picture with the view square to the body's facing on the climb and level; the fists are pinned there through the
// world's own lens (`climbLens`, `pinToView`), so turning the view carries them across the screen with the stone they
// hold, and looking up takes them down it. Up the view they go only as far as the sleeve's slack (the paintings' arms end
// there): looked down, they rise with the wall to the slack and wait, and steeply down they go out of the view. The
// reaching arm alone is the screen's.
// No pop: a change of state (a new hold, the hang to the free climb, the climb turned, a move's end) carries the hands
// from where they were onto the new place over POSE.LIMB_TAU, as ClimbPose eases its limbs; off the wall they leave from
// where they were. Every sprite's arm runs off the bottom edge with BOTTOM_SLACK to spare, so no lift shows its sleeve.
//
// The enhanced climb only (the motor's hold, a move in flight): DFU's own climb keeps WeaponManager's empty screen.

import { FEEL, tremble } from '../player/climb/climbFeel.js';
import { PARKOUR_GRIP_LOW, PARKOUR_HANG_DROP, PARKOUR_LIP_FOLLOW } from '../player/parkour.js';
import { POSE, gait, shimmyGait, wallFrame } from '../player/climb/climbPose.js';
import { decodePng } from '../systems/textureReplacement.js';
import { toScreenOrder } from '../formats/color32Order.js';
import { APP_ROOT } from '../systems/appRoot.js';
import { wrapAngle } from '../world/mat4.js';   // the one home for an angle into (-PI, PI] (audit24's ratchet)
import { weaponOffsetHeight } from '../ui/hud/hudLarge.js';   // AUDIT CLIMB-HANDS: the large HUD's bar, the classic sprite's own lift
import { worldRectPx } from '../player/tapRay.js';   // CLIMB-HANDS II: the world's strip in canvas pixels (ROAD-E E5's one home)
import { SETTINGS_DEFAULTS } from '../systems/settings/settingsDefaults.js';   // CLIMB-HANDS II: DFU's own FieldOfView, the lens a bare law sees through

/** DFU's design surface (FPSWeapon's 320x200) - module-local: ui/native/nativePanel.js exports the names (audit24's ratchet). */
const NATIVE_W = 320;
const NATIVE_H = 200;
const DEG = Math.PI / 180;

/** The two paintings, their own pixels (the drawn boxes keep these aspects). */
export const GRIP_ART = Object.freeze({ file: 'art/climb-grip.png', w: 105, h: 152 });
export const REACH_ART = Object.freeze({ file: 'art/climb-reach.png', w: 183, h: 114 });

/** The layout and the motion, in design pixels, seconds and degrees. */
export const HANDS = Object.freeze({
  GRIP_H: 150,             // a fist's drawn height
  GRIP_APART: 93,          // each fist's centre from the screen's middle - the 3D body's wrists on the lip (POSE.HANDS_APART,
                           // FACE_BACK less WRIST_OUT ahead) through DFU's own lens on this surface (Mac, 2026-10-13: "The
                           // sprite hands should be spread out more" - at 52 the two fists' boxes met in the middle)
  GRIP_AT: 0.35,           // the grip: the point of a fist held on the wall, its share of the drawn height down from the top
  BOTTOM_SLACK: 34,        // the sleeve under the screen's bottom edge at rest: no lift may exceed it
  REACH_W: 190,            // the reaching arm's drawn width, anchored at its own side of the screen (Mac: "it needs to sit on the
                           // left/right side of the screen respectively"; then "they need to be the originasl size" - 150 shrank it)
  REACH_X_IN: 4,           // the reaching arm's box in from its edge
  REACH_SLACK: 16,         // the reaching arm's sleeve under the bottom edge
  // the gaits: a hand's way on the wall relative to the body, design pixels a metre - the free climb's highest reach
  // (half POSE.CLIMB_DUTY's stride) inside BOTTOM_SLACK
  GAIT_PX: 110,
  SHIMMY_LIFT: 12,         // a hand off the lip lifts this much at the top of its reach (the pose's HAND_LIFT and HAND_AWAY)
  FROM_BELOW: 90,          // a hand that was not up when a move began comes from this far under its place
  RING: 14,                // the catch's landing: the arms straightening under the body's swing, at its hardest
  // the moves
  MANTLE_SINK: 45,         // a pull-up's hands down the view by the crest (the body risen past them)...
  MANTLE_PRESS: 22,        // ...pressed on the top...
  MANTLE_APART: 26,        // ...and out to the sides
  VAULT_PLANT: 52,         // a vault's top at the waist: the hands planted this far under the hold's place...
  VAULT_SINK: 34,          // ...and down as the body passes over them...
  VAULT_APART: 12,
  LOWER_LOW: 60,           // a lower's hands on the edge, low in the view as the body squats over it
  LEAP_DROP: 70,           // a leap's push: the hands down off the hold...
  LEAP_LEAD: 26,           // ...and leading toward the leap's side across the flight...
  LEAP_FULL: 0.5,          // ...all of it for a leap this far across or more (metres), as much less as it goes less
  CORNER_REACH: 22,        // a corner's hand reaching round, the way it goes...
  CORNER_LIFT: 12,         // ...lifted off the lip
  WALLRUN_PUMP: 16,        // a wall run's arms pumping with its steps
  // the still hang's sway (the pose's: its pitch at FEEL.SWAY_HZ x 1.37, its roll at FEEL.SWAY_HZ), in and out on this
  SWAY_Y: 2.2,
  SWAY_X: 1.2,
  SWAY_TAU: 0.25,
  // the grip failing
  TREMBLE: 2.4,
  // looking away from the wall
  LOOK_FROM_DEG: 40,       // turned this far off the wall's face, the reach begins...
  LOOK_FULL_DEG: 75,       // ...and is whole here
  LOOK_TAU: 0.09,
  LOOK_BACK_DEG: 170,      // turned past this (straight back), the reaching arm keeps the side it is on
  SEARCH_X: 5,             // the reaching arm feeling for a hold
  SEARCH_Y: 4,
  SEARCH_HZ: 0.6,
  // the free climb's way, eased: the stones turn with it and mirror through the body when it turns back
  WAY_TAU: 0.12,
  // looking straight down off the wall
  DOWN_FROM_DEG: 50,
  DOWN_FULL_DEG: 80,
});

/** A sprite out of the view under the bottom edge: a fist's height and its sleeve's slack. */
const OUT = HANDS.GRIP_H + HANDS.BOTTOM_SLACK;
const SIDES = /** @type {const} */ (['L', 'R']);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const s = clamp01(x); return s * s * (3 - 2 * s); };
const bump = (x) => Math.sin(Math.PI * clamp01(x));
const lerp = (a, b, t) => a + (b - a) * t;
/** @returns {{L: number[], R: number[]}} */
const pair = (lx = 0, ly = 0, rx = 0, ry = 0) => ({ L: [lx, ly], R: [rx, ry] });
const copyPair = (p) => ({ L: [p.L[0], p.L[1]], R: [p.R[0], p.R[1]] });

/** The heading that faces into a wall whose face points out along `normal` (the view's yaw convention: forward is
 *  [sin yaw, 0, cos yaw]). */
export const wallYawOf = (normal) => Math.atan2(-normal[0], -normal[2]);

/** Which climbs the sprite lane draws hands for: the motor's hold (a hang or the free climb) or a move in flight. DFU's
 *  own climb (`classic`) and a leap's free flight draw none. */
export function climbHandsWanted(c) {
  if (!c || c.classic) return false;
  return !!c.move || c.mode === 'hang' || c.mode === 'climb';
}

/** How far the view is turned off the wall's face (radians, + to the right), or 0 with no wall. */
export function lookOffWall(c, viewYaw) {
  if (!c?.normal || !Number.isFinite(viewYaw)) return 0;
  return wrapAngle(viewYaw - wallYawOf(c.normal));
}

/** How far a move goes along the wall it began on (metres, + to the right facing it) to `to` (its first leg's end, else
 *  its end), read off its own path - the motor sets its way on the move's event alone, never on the move. */
export function moveAcross(m, normal, to = m?.up ?? m?.to) {
  if (!m?.from || !normal || !to) return 0;
  const fr = wallFrame(normal);
  return (to[0] - m.from[0]) * fr.right[0] + (to[2] - m.from[2]) * fr.right[2];
}

/** The way a move goes along the wall it began on: +1 to the right facing it, -1 left, 0 straight in or up. */
export function moveSide(m, normal) {
  const a = moveAcross(m, normal);
  return Math.abs(a) > 1e-4 ? Math.sign(a) : 0;
}

/**
 * CLIMB-HANDS II: A LENS on the design surface - `{ tanX, tanY, cx, cy, hx, hy }`: the design point (x, y) is the eye's
 * ray ((x - cx) / hx * tanX, (cy - y) / hy * tanY, 1) in the view's own frame (right, up, forward). DESIGN_LENS is DFU's
 * own (defaults.ini's Video/FieldOfView, vertical) over the whole surface: what a law handed no lens pins through.
 */
const DFU_FOV = Number(SETTINGS_DEFAULTS.Video.FieldOfView) * DEG;
export const DESIGN_LENS = Object.freeze({
  tanX: Math.tan(DFU_FOV / 2) * (NATIVE_W / NATIVE_H), tanY: Math.tan(DFU_FOV / 2),
  cx: NATIVE_W / 2, cy: NATIVE_H / 2, hx: NATIVE_W / 2, hy: NATIVE_H / 2,
});

/**
 * The frame's world lens on the design surface, where the hands are laid out: the strip the world was drawn into (a
 * docked large HUD's shorter one, read where the arrow's muzzle reads it - FIELD-GUN19) brought back through the draw's
 * own scale and lift (`offsetHeight`, the bar the hands stand on) and, under retro mode's pillarbox, the layer's place
 * (`uiRect`); and its tangents - `fov` vertical (radians), the strip's own aspect unless the projection says another
 * (RETRO1's lens, muzzleRay's law). Null for a canvas or a strip with no size. Pure.
 * @param {any} canvas
 * @param {{ fov?: number, viewport?: any, aspect?: number | null, offsetHeight?: number }} [opts]
 */
export function climbLens(canvas, { fov, viewport = null, aspect = null, offsetHeight = 0 } = {}) {
  const W = canvas?.width, H = canvas?.height;
  if (!(W > 0) || !(H > 0) || !(fov > 0)) return null;
  const real = canvas.canvas ?? canvas, at = canvas.uiRect ?? { x: 0, y: 0 };
  const r = worldRectPx(viewport, real.width, real.height);
  if (!(r.w > 0) || !(r.h > 0)) return null;
  const sx = W / NATIVE_W, sy = H / NATIVE_H, tanY = Math.tan(fov / 2);
  return {
    tanX: tanY * (aspect > 0 ? aspect : r.w / r.h), tanY,
    cx: (r.x - at.x + r.w / 2) / sx, cy: (r.y - at.y + r.h / 2 + offsetHeight) / sy,
    hx: r.w / 2 / sx, hy: r.h / 2 / sy,
  };
}

/**
 * Where the eye finds a point of the picture - (`x`, `y`) in design pixels as seen with the view square to the climb's
 * frame and level - once the view has turned `turn` off that frame (radians, + to the right) and pitched `pitch` (+ up):
 * the eye's own turn, which moves a point the same whatever its distance. The turn is exact, and so is the pitch up and
 * down the screen; across, the pitch leaves the point on the column the level view has it on - the true picture spreads
 * a point toward the sides as it nears the top or the bottom of the view, where the paintings' arms cannot follow it,
 * and a hand slid sideways by a look down would be one more thing the screen did to it. Null for a point the turn puts
 * behind the eye (it has no column to keep) or the pitch takes past straight up or down. Pure.
 */
export function pinToView(x, y, lens, turn, pitch) {
  const a = ((x - lens.cx) / lens.hx) * lens.tanX, b = ((lens.cy - y) / lens.hy) * lens.tanY;
  const z = a * Math.sin(turn) + Math.cos(turn);   // its depth along the turned view
  if (!(z > 1e-3)) return null;
  const up = Math.atan2(b, z) - pitch;   // its height off the view's own level
  if (!(Math.abs(up) < Math.PI / 2 - 1e-3)) return null;
  return [lens.cx + ((a * Math.cos(turn) - Math.sin(turn)) / z / lens.tanX) * lens.hx, lens.cy - (Math.tan(up) / lens.tanY) * lens.hy];
}

/**
 * The law. `update(dt, climb, view)` with the frame's climb snapshot (or null) and the view ({ yaw, pitch }); `out`
 * then holds the frame's sprites: `grips` (each { side, x, y, w, h, flip }) and `reach` (the same, or null), in design
 * pixels, and `present` (0..1, the hands on the screen at all).
 */
export class ClimbHands {
  constructor() { this.reset(); }

  /** Back to rest: the hands off the wall and out of the view. */
  reset() {
    this.present = 0;
    this.t = 0;
    this.prev = null;          // the body's last point on the wall (its own way, the snapshot's `track`)
    this.src = null;           // what places the hands: a move (the motor's own object) or a hold (its mode)
    this.lipY = null;          // the hold's lip as last read: one moved past the motor's follow is another hold
    this.travel = 0;           // the gaits' travel from the hold's start: along the lip (signed) or up the face (path)
    this.travelDir = [0, 1];   // the way the free climb goes, in the wall's (right, up), eased (WAY_TAU)
    this.settle = { L: { v: 0, prev: 0, cycle: null }, R: { v: 0, prev: 0, cycle: null } };
    this.moveStart = null;     // the hands' offsets when the move in flight began (null: they were not up)
    this.moveNormal = null;    // ...and the wall it began on
    this.base = null;          // last frame's offsets, the carry in them (the start of the next change)
    this.carry = pair();       // what a change of state still owes the new place, eased out on POSE.LIMB_TAU
    this.ringT = Infinity;     // seconds since the hands landed on a hold from a catch, a reach or a leap...
    this.ringA = 0;            // ...and how hard (0..1)
    this.ringArmed = false;
    this.swayW = 0;            // the still hang's sway, eased in and out
    this.drawn = pair();       // the frame's offsets, everything in them: off the wall the hands leave from here
    this.faceYaw = null;       // CLIMB-HANDS II: the frame the hands are pinned in - the body's facing on the climb, else its wall's
    this.look = 0;             // how far the view is turned off the wall (0..1, eased)...
    this.side = 'R';           // ...the side the reaching arm is on...
    this.arm = 0;              // ...and how far it is up (0..1, eased): it changes sides down off one and up the other...
    this.letGo = { L: 0, R: 0 };   // ...each hand's let-go of the stone for it (0..1, eased): the arm's own side's, with the look
    this.out = { present: 0, grips: [], reach: null };
  }

  update(dt, c, view = {}) {
    dt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
    this.t += dt;
    const want = climbHandsWanted(c);
    // the hands onto the wall and off it on the pose's own weights (a catch is a grab)
    const tau = want ? POSE.IN_TAU : POSE.OUT_TAU;
    this.present += ((want ? 1 : 0) - this.present) * (1 - Math.exp(-dt / tau));
    if (Math.abs(this.present - (want ? 1 : 0)) < 0.005) this.present = want ? 1 : 0;
    if (!want && this.present <= 0) { this.reset(); return this.out; }
    // the body's travel since the last frame, read whenever the climb says where it is - a teleport is none, and nothing is
    // read across a frame with no climb
    const p = c?.track ?? c?.feet ?? null;
    let d = [0, 0, 0];
    if (p && this.prev) d = [p[0] - this.prev[0], p[1] - this.prev[1], p[2] - this.prev[2]];
    if (Math.hypot(d[0], d[1], d[2]) > 1) d = [0, 0, 0];
    this.prev = p ? [p[0], p[1], p[2]] : null;
    if (want) this._place(dt, c, d, view);
    // off the wall: the hands leave from where they were, the look as it was (`drawn` and `look` stand)
    return this._layout(view);
  }

  /** The frame's offsets for each hand (`drawn`) and the look off the wall. */
  _place(dt, c, d, view) {
    const m = c.move ?? null;
    // what places the hands: a move (each its own object), else the hold - a new mode starts the gaits square, and so does
    // a lip past the one the motor follows (AUDIT CLIMB-HANDS, second round: a sloping lip, or a hull's, is re-read every
    // step - the same hold going on, as a face followed round a bend is)
    const lip = Number.isFinite(c.lipY) ? c.lipY : null;
    const lipJump = !m && lip != null && this.lipY != null && Math.abs(lip - this.lipY) > PARKOUR_LIP_FOLLOW;
    this.lipY = lip;
    const src = m ?? c.mode;
    const changed = src !== this.src || lipJump;
    if (changed) {
      this.src = src;
      if (m) {
        this.moveStart = this.present >= 0.5 && this.base ? copyPair(this.base) : null;
        this.moveNormal = c.normal ?? m.hang?.normal ?? null;
        this.ringArmed = false;
      } else {
        // square over the hold just taken - the frame that took it moves no stone (ClimbPose: `along = 0` there)
        this.travel = 0;
        this.travelDir = [0, 1];
        for (const s of SIDES) this.settle[s] = { v: 0, prev: 0, cycle: null };
        d = [0, 0, 0];
      }
    }
    const base = m ? this._move(m, c) : c.mode === 'hang' ? this._hang(dt, c, d) : this._climb(dt, c, d);
    // a change of state carries the hands from where they were onto the new place (ClimbPose._ease's law)
    const k = Math.exp(-dt / POSE.LIMB_TAU);
    for (const s of SIDES) {
      for (const i of [0, 1]) {
        this.carry[s][i] = changed ? (this.base && this.present > 0 ? this.base[s][i] - base[s][i] : 0) : this.carry[s][i] * k;
        base[s][i] += this.carry[s][i];
      }
    }
    this.base = base;
    // laid over it: the landing's swing, the still hang's sway, the failing grip's tremble
    const off = copyPair(base);
    if (Number.isFinite(this.ringT)) {
      this.ringT += dt;
      const ring = -HANDS.RING * this.ringA * Math.exp(-POSE.SWING_DAMP * this.ringT) * Math.sin(2 * Math.PI * POSE.SWING_HZ * this.ringT);
      for (const s of SIDES) off[s][1] += ring;
      if (this.ringT > 4) this.ringT = Infinity;
    }
    const still = !m && c.mode === 'hang' && Math.hypot(d[0], d[2]) < 1e-5;
    this.swayW += ((still ? 1 : 0) - this.swayW) * (1 - Math.exp(-dt / HANDS.SWAY_TAU));
    if (this.swayW > 1e-4) {
      const swayX = this.swayW * HANDS.SWAY_X * Math.sin(2 * Math.PI * FEEL.SWAY_HZ * this.t);
      const swayY = this.swayW * HANDS.SWAY_Y * Math.sin(2 * Math.PI * FEEL.SWAY_HZ * 1.37 * this.t);
      for (const s of SIDES) { off[s][0] += swayX; off[s][1] += swayY; }
    }
    const fail = c.mode && Number.isFinite(c.grip) ? clamp01((PARKOUR_GRIP_LOW - c.grip) / PARKOUR_GRIP_LOW) : 0;
    if (fail > 0) {
      const ft = this.t * POSE.TREMBLE_HZ;
      off.L[0] += HANDS.TREMBLE * fail * tremble(ft); off.L[1] += HANDS.TREMBLE * fail * tremble(ft * 1.3 + 7);
      off.R[0] += HANDS.TREMBLE * fail * tremble(ft + 3.1); off.R[1] += HANDS.TREMBLE * fail * tremble(ft * 1.3 + 11);
    }
    this.drawn = off;
    // CLIMB-HANDS II: the frame the hands are pinned in - the body's facing on the climb (the snapshot's yaw: into the wall
    // held, the wall a move ends on, eased - motor.js bodyYawFor), else the wall's own; none known, the screen's
    const wall = c.normal ?? m?.hang?.normal ?? m?.wall?.normal ?? null;
    this.faceYaw = Number.isFinite(c.yaw) ? c.yaw : wall ? wallYawOf(wall) : null;
    // looking away from the wall: how far, eased (a move in flight keeps the hold's hands) - and the reaching arm's side.
    // AUDIT CLIMB-HANDS (second round): the arm changes sides by going down off the one and up on the other, the fists
    // staying down; turned past LOOK_BACK_DEG (straight back) it keeps its side, where the look's sign flipped at 180
    // degrees and the fists flashed up between the two arms
    const turn = lookOffWall(c, view.yaw);
    const deep = !m ? smooth((Math.abs(turn) / DEG - HANDS.LOOK_FROM_DEG) / (HANDS.LOOK_FULL_DEG - HANDS.LOOK_FROM_DEG)) : 0;
    const kl = 1 - Math.exp(-dt / HANDS.LOOK_TAU);
    this.look += (deep - this.look) * kl;
    if (Math.abs(this.look - deep) < 0.002) this.look = deep;
    const toSide = Math.abs(turn) > HANDS.LOOK_BACK_DEG * DEG ? this.side : turn >= 0 ? 'R' : 'L';
    if (toSide !== this.side && this.arm < 0.2) this.side = toSide;   // under the screen's edge by then: over it goes
    const armT = toSide === this.side ? this.look : 0;
    this.arm += (armT - this.arm) * kl;
    if (Math.abs(this.arm - armT) < 0.002) this.arm = armT;
    // CLIMB-HANDS II: the hand on the arm's side lets go of the stone as the look goes (it is the arm now); the other holds
    // on - each eased, so a hand comes back onto the wall from where it went when the arm goes over to the other side
    for (const s of SIDES) {
      const t = s === this.side ? this.look : 0;
      this.letGo[s] += (t - this.letGo[s]) * kl;
      if (Math.abs(this.letGo[s] - t) < 0.002) this.letGo[s] = t;
    }
  }

  /** The sprites from the offsets, the presence, the look and the view: its turn off the climb's frame, its pitch and
   *  the world's lens (`view.lens`, DESIGN_LENS when none). */
  _layout(view) {
    const out = this.out;
    out.present = this.present;
    out.grips = [];
    out.reach = null;
    const side = this.side;
    // looking straight down off the wall: the hands are over the head, out of the view
    const pitch = Number.isFinite(view.pitch) ? view.pitch : 0;
    const gone = smooth((-pitch / DEG - HANDS.DOWN_FROM_DEG) / (HANDS.DOWN_FULL_DEG - HANDS.DOWN_FROM_DEG)) * OUT;
    const gh = HANDS.GRIP_H, gw = gh * GRIP_ART.w / GRIP_ART.h;
    const enter = (1 - smooth(this.present)) * OUT;
    // CLIMB-HANDS II: THE FISTS ARE ON THE WALL. Each one's place is the picture square to the climb's frame and level;
    // its grip is pinned through the view's turn off that frame and its pitch (pinToView). Up the view it goes no further
    // than the sleeve's slack - so a hand gone under the edge (a let-go, a press over the top) stays under it whatever the
    // look - and the hands' own comings and goings (onto the wall, steeply down, let go for the reach) are the screen's.
    const pinned = this.faceYaw != null && Number.isFinite(view.yaw);
    const turn = pinned ? wrapAngle(view.yaw - this.faceYaw) : 0, tilt = pinned ? pitch : 0;
    const lens = view.lens ?? DESIGN_LENS;
    const gripY = NATIVE_H - gh + HANDS.BOTTOM_SLACK + HANDS.GRIP_AT * gh;   // the grip's height at rest, square and level
    for (const s of SIDES) {
      const lat = s === 'R' ? 1 : -1;
      const gripX = NATIVE_W / 2 + lat * HANDS.GRIP_APART + this.drawn[s][0];   // ...and where along the wall it is now
      const at = turn || tilt ? pinToView(gripX, gripY, lens, turn, tilt) : [gripX, gripY];
      if (!at) continue;   // behind the eye
      const x = at[0] - gw / 2;
      let y = NATIVE_H - gh + HANDS.BOTTOM_SLACK + this.drawn[s][1] + Math.max(at[1] - gripY, -HANDS.BOTTOM_SLACK);
      y = Math.max(y, NATIVE_H - gh);   // never lifted past the sleeve's slack
      y += enter + gone + smooth(this.letGo[s]) * OUT;   // looked away: the hand on the arm's side has let go of the stone
      if (y >= NATIVE_H || x >= NATIVE_W || x + gw <= 0) continue;
      out.grips.push({ side: s, x, y, w: gw, h: gh, flip: s === 'R' });   // the painting is the left hand: the right is its mirror
    }
    if (this.arm > 0.001) {
      const rw = HANDS.REACH_W, rh = rw * REACH_ART.h / REACH_ART.w;
      const sx = HANDS.SEARCH_X * Math.sin(2 * Math.PI * HANDS.SEARCH_HZ * this.t);
      const sy = HANDS.SEARCH_Y * Math.sin(2 * Math.PI * HANDS.SEARCH_HZ * 1.6 * this.t + 0.7);
      // the arm on the side looked to, up from that side and reaching in across the view: looked right, the right arm (the
      // painting mirrored) from the right edge; looked left, the left arm as painted from the left edge (Mac, 2026-10-13:
      // "The single arm out is also inverted for both directions" - it was the other hand's arm, from the other side)
      const xl = HANDS.REACH_X_IN + sx;
      const x = side === 'R' ? NATIVE_W - xl - rw : xl;
      const y = Math.max(NATIVE_H - rh, NATIVE_H - rh + HANDS.REACH_SLACK + sy + (1 - smooth(this.arm)) * (rh + HANDS.REACH_SLACK) + enter + gone);
      if (y < NATIVE_H) out.reach = { side, x, y, w: rw, h: rh, flip: side === 'R' };
    }
    return out;
  }

  /** ClimbPose._settled: a limb's reach finishing on the clock when the body stops mid-reach, and once finished on its
   *  new stone until the gait's reach is behind it. `g` is the gait's answer. */
  _settled(key, g, moving, dt) {
    const st = this.settle[key], sw = g.swing;
    if (sw <= 0) { st.v = 0; st.cycle = null; return 0; }
    if (st.cycle !== g.cycle) { st.cycle = g.cycle; st.v = sw; st.prev = sw; }
    if (!moving) st.v = st.v >= 0.5 ? Math.min(1, st.v + dt / POSE.SETTLE_S) : Math.max(0, st.v - dt / POSE.SETTLE_S);
    else if (sw >= st.prev) st.v = st.prev < 1 ? st.v + (1 - st.v) * (sw - st.prev) / (1 - st.prev) : sw;
    else st.v = st.prev > 0 ? st.v * sw / st.prev : sw;
    st.prev = sw;
    return st.v;
  }

  /** The hang: ClimbPose's shimmy - each hand's stone along the lip relative to the body, lifted while it reaches. */
  _hang(dt, c, d) {
    const fr = wallFrame(c.normal ?? [0, 0, 1]);
    const along = d[0] * fr.right[0] + d[2] * fr.right[2];
    this.travel += along;
    const moving = Math.abs(along) > 1e-5;
    const span = FEEL.SHIMMY_SPAN, stride = 2 * span;
    const out = pair();
    for (const s of SIDES) {
      const g = shimmyGait(this.travel, stride, s === 'R' ? span / 2 : 1.5 * span, POSE.SHIMMY_REACH * span);
      const sw = this._settled(s, g, moving, dt);
      const atLip = lerp(g.anchor, g.next, smooth(sw)) - this.travel;   // metres along the lip, to the body's right
      out[s] = [atLip * HANDS.GAIT_PX, -HANDS.SHIMMY_LIFT * bump(sw)];
    }
    return out;
  }

  /** The free climb: ClimbPose's gait - each hand's stone on the face relative to the body, the way it climbs. */
  _climb(dt, c, d) {
    const fr = wallFrame(c.normal ?? [0, 0, 1]);
    const a = d[0] * fr.right[0] + d[2] * fr.right[2], u = d[1];
    const step = Math.hypot(a, u);
    if (step > 1e-5) {
      // AUDIT CLIMB-HANDS (second round): the way eased, never a change of state - a diagonal over mouldings, a pad's
      // stick, wavers every frame, and carrying each wobble over pinned both fists; turned back, the stones mirror
      // through the body
      const k = 1 - Math.exp(-dt / HANDS.WAY_TAU);
      this.travelDir = [this.travelDir[0] + (a / step - this.travelDir[0]) * k, this.travelDir[1] + (u / step - this.travelDir[1]) * k];
      this.travel += step;
    }
    const moving = step > 1e-5;
    const [ta, tu] = this.travelDir;
    const out = pair();
    for (const s of SIDES) {
      const g = gait(this.travel, 2 * FEEL.REACH, s === 'R' ? 0 : 0.5, POSE.CLIMB_DUTY);
      const sw = this._settled(s, g, moving, dt);
      const rel = lerp(g.anchor - this.travel, g.next - this.travel, smooth(sw));   // the stone, relative to the body now
      out[s] = [ta * rel * HANDS.GAIT_PX, -tu * rel * HANDS.GAIT_PX];
    }
    return out;
  }

  /** The landing's swing begins: the arms straighten under the body, harder the faster it came (ClimbPose's pendulum). */
  _land(speed) {
    if (this.ringArmed) return;
    this.ringArmed = true;
    this.ringT = 0;
    this.ringA = 0.5 + 0.5 * clamp01((POSE.SWING_BASE + POSE.SWING_PER_SPEED * speed) / POSE.SWING_MAX);
  }

  /** A move in flight, by its kind and its clock, from where the hands were when it began - ClimbPose's windows. */
  _move(m, c) {
    const t = clamp01(m.t ?? 0);
    const start = this.moveStart;
    const from = (s) => start?.[s] ?? [0, HANDS.FROM_BELOW];
    const out = pair();
    switch (m.kind) {
      case 'catch': case 'reach': {
        // ClimbPose._toHang: the hands onto the hold over the first 0.45, where the swing begins
        const k = smooth(t / 0.45);
        for (const s of SIDES) out[s] = [lerp(from(s)[0], 0, k), lerp(from(s)[1], 0, k)];
        if (t >= 0.45) this._land(m.speed ?? 0);   // the pace the body came to it at (the motor's, on the move)
        break;
      }
      case 'leap': {
        // ClimbPose._leap: off the stone at the push (0.18), reaching for the hold across the flight, on it at 0.8
        // AUDIT CLIMB-HANDS (second round): the lead as much as the leap goes across - straight up, none
        const across = Math.max(-1, Math.min(1, moveAcross(m, this.moveNormal, m.to) / HANDS.LEAP_FULL));
        const push = smooth(t / 0.18), reach = smooth((t - 0.18) / 0.62);
        const lead = across * HANDS.LEAP_LEAD * bump((t - 0.18) / 0.62);
        for (const s of SIDES) {
          const f = from(s);
          out[s] = t < 0.18 ? [lerp(f[0], 0, push), lerp(f[1], HANDS.LEAP_DROP, push)] : [lead, lerp(HANDS.LEAP_DROP, 0, reach)];
        }
        if (t >= 0.8) {
          const way = m.to && m.from ? Math.hypot(m.to[0] - m.from[0], m.to[1] - m.from[1], m.to[2] - m.from[2]) : 0;
          this._land(m.dur > 0 ? way / m.dur : 0);   // the flight's arrival (the feel's leap dip is its arrival's too)
        }
        break;
      }
      case 'mantle': {
        // ClimbPose._mantle: on the edge through the rise - the body rising past the hands takes them down the view - then
        // the palms press on the top and let go as the body stands (a clamber's as it drops off the far side)
        const split = clamp01(m.split ?? 0.5);
        const over = t <= split ? 0 : (t - split) / Math.max(1e-6, 1 - split);
        const rise = m.to && m.from ? m.to[1] - m.from[1] : PARKOUR_HANG_DROP;
        const edge = HANDS.MANTLE_SINK * clamp01((PARKOUR_HANG_DROP - rise) / 1.2);   // a step-up's edge low in the view
        const sink = HANDS.MANTLE_SINK * clamp01(rise / PARKOUR_HANG_DROP) * smooth(t / Math.max(1e-6, split));
        const take = start ? 1 : smooth(t / Math.max(0.08, split * 0.4));
        const press = smooth(over / 0.35);
        const letGo = m.exit ? smooth((over - 0.45) / 0.3) : smooth((over - 0.6) / 0.35);
        for (const s of SIDES) {
          const lat = s === 'R' ? 1 : -1, f = from(s);
          const y0 = start ? f[1] : lerp(f[1], edge, take);
          const x0 = start ? f[0] * (1 - smooth(t / Math.max(1e-6, split))) : 0;
          out[s] = [x0 + lat * HANDS.MANTLE_APART * press, y0 + sink + HANDS.MANTLE_PRESS * press + OUT * letGo];
        }
        break;
      }
      case 'vault': {
        // ClimbPose._vault: planted on the top by 0.12, the body passing over them, let go 0.55-0.8
        const plant = smooth(t / 0.12), pass = smooth((t - 0.12) / 0.43), letGo = smooth((t - 0.55) / 0.25);
        for (const s of SIDES) {
          const lat = s === 'R' ? 1 : -1, f = from(s);
          out[s] = [lerp(f[0], 0, plant) + lat * HANDS.VAULT_APART * pass, lerp(f[1], HANDS.VAULT_PLANT, plant) + HANDS.VAULT_SINK * pass + OUT * letGo];
        }
        break;
      }
      case 'lower': {
        // ClimbPose._lower: the hands to the edge as the body squats over it (0.04-0.26), then holding it as the body
        // goes down the face to the hang - the edge rising up the view
        const onEdge = smooth((t - 0.04) / 0.22), drop = smooth((t - 0.32) / 0.68);
        for (const s of SIDES) {
          const f = from(s);
          out[s] = [lerp(f[0], 0, onEdge) * (1 - drop), lerp(lerp(f[1], HANDS.LOWER_LOW, onEdge), 0, drop)];
        }
        break;
      }
      case 'corner': {
        // ClimbPose._corner: the hand on the side the corner goes first (0-0.55), the other after it (0.4-1), each lifted
        // off the lip and reaching round the way it goes
        const way = moveSide(m, this.moveNormal) || 1;
        for (const s of SIDES) {
          const lead = (s === 'R' ? 1 : -1) === way;
          const k = lead ? smooth(t / 0.55) : smooth((t - 0.4) / 0.6), f = from(s);
          out[s] = [lerp(f[0], 0, k) + way * HANDS.CORNER_REACH * bump(k), lerp(f[1], 0, k) - HANDS.CORNER_LIFT * bump(k)];
        }
        break;
      }
      case 'wallrun': {
        // ClimbPose._wallrun: the arms pump with the steps (a foot every POSE.WALLRUN_STEP the body rises), then reach
        // for what the run ends on (0.55-0.95)
        const rose = (c.feet?.[1] ?? 0) - (m.from?.[1] ?? c.feet?.[1] ?? 0);
        const up = smooth((t - 0.55) / 0.4), pumping = 1 - smooth((t - 0.55) / 0.3);
        for (const s of SIDES) {
          const f = from(s);
          const pump = Math.abs(Math.sin(Math.PI * (rose / POSE.WALLRUN_STEP + (s === 'R' ? 0 : 0.5)))) * pumping;
          out[s] = [lerp(f[0], 0, up), lerp(f[1], 0, up) - HANDS.WALLRUN_PUMP * pump];
        }
        break;
      }
      default:
        for (const s of SIDES) out[s] = [...from(s)];
        break;
    }
    return out;
  }
}

/** The paintings' address beside the page (APP_ROOT: the site root, not /play/ - AUDIT-THUNDERLOCK F7). */
export const climbArtUrl = (file) => new URL(file, APP_ROOT ?? globalThis.document?.baseURI ?? 'https://invalid.invalid/').href;

/**
 * The draw: the law plus the two textures, loaded once on first need (a promise in flight draws nothing). `fetchBytes`
 * is the door a test comes through; by default the paintings are fetched from the build beside the page.
 * @param {{ renderer?: any, fetchBytes?: ((file: string) => Promise<any>) | null, decode?: (bytes: any) => Promise<any> }} [opts]
 */
export function createClimbHands({ renderer, fetchBytes = null, decode = decodePng } = {}) {
  const law = new ClimbHands();
  /** @type {Map<string, any>} */
  const tex = new Map();
  const load = (art) => {
    if (tex.has(art.file) || !renderer) return tex.get(art.file) ?? null;
    tex.set(art.file, null);
    (async () => {
      const bytes = fetchBytes ? await fetchBytes(art.file) : await (async () => {
        const r = await fetch(climbArtUrl(art.file));
        if (!r.ok) throw new Error(`${art.file}: ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      })();
      const img = await decode(bytes);
      if (img?.width) tex.set(art.file, renderer.uploadTexture('img', `climbhands:${art.file}`, toScreenOrder(img)));   // a PNG's rows are top-first: a screen quad wants them so (HT3)
    })().catch((e) => console.warn('[climb hands] texture load failed', art.file, e));
    return null;
  };
  return {
    law,
    update(dt, climb, view) { return law.update(dt, climb, view); },
    /** Whether a hand is on the screen this frame (the weapon stays lowered while one is). */
    showing() { return law.out.present > 0 && (law.out.grips.length > 0 || !!law.out.reach); },
    /** `offsetHeight`: the large HUD's bar the hands stand on, as the classic sprite does (FPSWeapon.cs:146-155). */
    draw(canvas, { tint = null, offsetHeight = weaponOffsetHeight() } = {}) {
      const out = law.out;
      if (!canvas || !renderer || out.present <= 0) return false;
      const sx = canvas.width / NATIVE_W, sy = canvas.height / NATIVE_H;
      const quad = (t, b) => renderer.drawScreenQuad(t, { x: b.x * sx, y: b.y * sy - offsetHeight, w: b.w * sx, h: b.h * sy },
        b.flip ? { u0: 1, v0: 0, u1: 0, v1: 1 } : undefined, tint ?? undefined);
      let drew = false;
      if (out.reach) { const t = load(REACH_ART); if (t) { quad(t, out.reach); drew = true; } }
      if (out.grips.length) { const t = load(GRIP_ART); if (t) { for (const g of out.grips) quad(t, g); drew = true; } }
      return drew;
    },
  };
}
