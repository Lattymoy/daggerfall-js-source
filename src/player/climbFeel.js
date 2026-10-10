// CLIMB4 - THE FEEL: THE CAMERA ON THE CLIMB (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "I
// reallty want go to go all in with the detai. Liike proer feel to climbing").
//
// The motor climbs a body; this is what the eye does about it. A pure law: one instance per host view (beside the
// HeadBobber), fed the motor's frame - its climb events (motor.js _pkEmit), its hold and its move in flight, its
// position and its grip - and answering the frame's camera effects:
//   pitch, roll - radians, the view's own (pitch up and roll right positive), applied in the camera's frame;
//   eye         - a world offset of the VIEW only (never cam.pos: the rays, the listener and the eye-lag pins read that);
//   fov         - degrees over the setting's own;
//   yaw         - radians to TURN the view this frame (a heading, not a view-only effect: the motor walks by cam.yaw -
//                 the host pays it into its look filter, LookFilter.turn).
// Every effect is a spring or a curve the frame clock samples - nothing snaps - and every one is the climb's: off the
// wall and out of a move, with nothing in flight, the answer is zero within a few frames.
//
// What the eye does (each number below is FEEL's):
//   - A CATCH lands the hands on a lip with the body's weight: the eye dips and pitches down, harder the faster the
//     body came to it (a fall caught, a leap's end), and springs back.
//   - HANGING, the body sways a little on its arms; failing, the grip trembles.
//   - THE SHIMMY: each hand's reach along the lip rolls the view toward the way it goes and lifts it a little.
//   - THE FREE CLIMB: hand over hand - a reach every FEEL.REACH m climbed, the eye bobbing with it and the view rolling
//     from one hand to the other.
//   - A PULL-UP (the mantle, the clamber) looks up at the lip, then down over it as the body crests it.
//   - THE VAULT pitches down over the top it clears; THE LOWER looks down over the edge as the body goes over, the view
//     turning to face the wall it lowers onto; A CORNER turns the view with the wall.
//   - LEAPS: the launch kicks the field of view and the eject turns the view to face the way it flew; a side leap rolls
//     toward its side, an up leap looks up; the WALL RUN looks up the wall.

import { PARKOUR_GRIP_LOW, PARKOUR_HAND_SPAN } from './parkour.js';
import { ClimbSounds } from './climbSounds.js';   // the ear's half, framed with the eye's
import { stepTechniqueFx, techniqueView, resetTechniqueFx } from '../combat/techniqueFx.js';   // TECH-FX: a technique's camera rides the climb's view step

/** The constants of the feel. Angles in degrees where named _DEG, distances in metres, rates per second. */
export const FEEL = Object.freeze({
  // springs: stiffness (1/s^2), critically damped
  K_EYE: 140,
  K_ANGLE: 110,
  K_FOV: 60,
  // the catch
  DIP_BASE: 0.6,          // m/s of eye drop a catch gives at a standstill...
  DIP_PER_SPEED: 0.16,    // ...and per m/s the body came to the lip at
  DIP_MAX: 2.2,           // the most (a long fall caught)
  CATCH_PITCH_DEG: 4,     // the pitch down a catch adds at the most, per the dip's share of its most
  // hanging
  SWAY_ROLL_DEG: 0.45,
  SWAY_Y: 0.006,
  SWAY_HZ: 0.16,
  // the grip failing
  TREMBLE_DEG: 0.7,
  TREMBLE_Y: 0.004,
  TREMBLE_HZ: 9,
  // the shimmy
  SHIMMY_SPAN: PARKOUR_HAND_SPAN,   // a hand's reach along the lip (AUDIT CLIMB-ARC nit: the parkour law's own, not a copy)
  SHIMMY_ROLL_DEG: 1.6,
  SHIMMY_BOB: 0.012,
  // the free climb
  REACH: 0.45,            // a hand's reach up the wall
  CLIMB_ROLL_DEG: 1.8,
  CLIMB_BOB: 0.02,
  // moves
  MANTLE_LOOK_UP_DEG: 6,
  MANTLE_CREST_DEG: 9,
  VAULT_DIP_DEG: 7,
  LOWER_LOOK_DOWN_DEG: 14,
  LEAP_ROLL_DEG: 6,
  LEAP_UP_DEG: 7,
  WALLRUN_UP_DEG: 12,
  CORNER_ROLL_DEG: 3,
  // the field of view
  LAUNCH_FOV: 7,          // degrees a leap's launch kicks (impulse as a velocity: FOV_KICK_V)
  VAULT_FOV: 3,
  WALLRUN_FOV: 4,
  // view turns
  TURN_TAU: 0.12,         // the turn's time constant (s): most of it within three of them
  EJECT_TURN_S: 0.3,
});

const DEG = Math.PI / 180;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
/** A sine bump over [a, b] of t: 0 outside, 1 at its middle. */
export const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** One critically damped spring step toward `target`: [x, v]. AUDIT CLIMB-ARC F5: the EXACT step (the closed form of
 *  x'' = -k (x - t) - 2 sqrt(k) x'), so a catch dips the eye and a launch kicks the lens the same at 20 Hz and 240 - the
 *  semi-implicit step it replaces dipped nothing at 20 Hz and 63 % of this at 60. */
export function spring(x, v, target, k, dt) {
  const w = Math.sqrt(k), y = x - target, e = Math.exp(-w * dt), c = v + w * y;
  return [target + (y + c * dt) * e, (v - w * c * dt) * e];
}

/** A tremble's noise: three incommensurate sines, -1..1. Deterministic - a pin can read it. */
export const tremble = (t) => (Math.sin(t * 6.283) * 0.5 + Math.sin(t * 15.71 + 1.3) * 0.3 + Math.sin(t * 27.3 + 2.1) * 0.2);

/** A leap's speed at its arrival (m/s): the way it flies over the time it takes - its path's length (the rise and the
 *  way across) over its time. */
const leapArrival = (e) => (e.dur > 0 ? Math.hypot(e.rise ?? 0, ...(e.way ?? [0, 0])) / e.dur : 0);

export class ClimbFeel {
  constructor() { this.reset(); }

  /** Back to rest (a placement, a load, the view leaving first person). */
  reset() {
    this.t = 0;
    this.eyeY = 0; this.eyeV = 0;
    this.pitchS = 0; this.pitchV = 0;
    this.rollS = 0; this.rollV = 0;
    this.fovS = 0; this.fovV = 0;
    this.turnLeft = 0; this.turnTau = FEEL.TURN_TAU;
    this.climbPhase = 0; this.shimmyPhase = 0; this.shimmySide = 0;
    this.bobS = 0; this.bobV = 0;
    this.prev = null;
    this.move = null;   // { kind, dur, rise, turn, way, normal, t } - the move in flight, as its event told it
    this.out = { pitch: 0, roll: 0, eye: [0, 0, 0], fov: 0, yaw: 0 };
  }

  /**
   * One render frame. `m` is the motor: its `climbEvents` (the frame's), `pos`, `onWall`/`hanging`, `climbMove` (the
   * move in flight - its `t`), `wallNormal`, `grip`. `yaw` the view's heading now.
   * Answers this.out.
   */
  update(dt, m, yaw) {
    dt = Math.min(Math.max(dt, 0), 0.25);   // AUDIT CLIMB-ARC nit: the exact springs are stable at any step - only a stall is cut
    this.t += dt;
    const out = this.out;
    out.yaw = 0;
    for (const e of m.climbEvents ?? []) this._event(e, yaw, m);
    // the move in flight, as the motor has it now (its own clock), else none
    const live = m.climbMove;
    if (!live) this.move = null;
    const mv = this.move && live ? { ...this.move, t: live.t } : null;
    // the travel since the last frame, on the wall
    const p = m.climbTrackPos?.() ?? m.pos;   // AUDIT CLIMB-ARC F3/F8: the frame's own way, never a carry's
    let dx = 0, dy = 0, dz = 0;
    if (this.prev && (m.onWall || mv)) { dx = p[0] - this.prev[0]; dy = p[1] - this.prev[1]; dz = p[2] - this.prev[2]; }
    this.prev = [p[0], p[1], p[2]];
    if (Math.hypot(dx, dy, dz) > 1) { dx = dy = dz = 0; }   // a teleport (a recentre, a placement) is no travel
    // the targets: the move's curve, else the hold's rhythm
    let pitchT = 0, rollT = 0, bob = 0, fovT = 0;
    if (mv) {
      const t = mv.t;
      switch (mv.kind) {
        case 'mantle': pitchT = FEEL.MANTLE_LOOK_UP_DEG * DEG * bump(t, 0, 0.5) - FEEL.MANTLE_CREST_DEG * DEG * bump(t, 0.35, 1); break;
        case 'vault': pitchT = -FEEL.VAULT_DIP_DEG * DEG * bump(t, 0.15, 0.95); fovT = FEEL.VAULT_FOV * bump(t, 0, 1); break;
        case 'lower': pitchT = -FEEL.LOWER_LOOK_DOWN_DEG * DEG * bump(t, 0, 0.75); break;
        case 'leap': {
          const right = mv.side ?? 0;
          rollT = FEEL.LEAP_ROLL_DEG * DEG * right * bump(t, 0, 1);
          pitchT = (mv.rise > 0.3 ? FEEL.LEAP_UP_DEG : 0) * DEG * bump(t, 0, 0.8);
          break;
        }
        case 'wallrun': pitchT = FEEL.WALLRUN_UP_DEG * DEG * bump(t, 0, 1.2); fovT = FEEL.WALLRUN_FOV * bump(t, 0, 1); break;
        case 'corner': rollT = FEEL.CORNER_ROLL_DEG * DEG * Math.sign(mv.turn || 0) * bump(t, 0, 1); break;
        default: break;
      }
    } else if (m.onWall) {
      if (m.hanging) {
        // the shimmy's reach, else the sway on the arms
        const along = this._along(m, dx, dz);
        if (Math.abs(along) > 1e-5) {
          this.shimmyPhase += Math.abs(along) / FEEL.SHIMMY_SPAN;
          this.shimmySide = Math.sign(along);
          const s = Math.abs(Math.sin(Math.PI * this.shimmyPhase));
          rollT = FEEL.SHIMMY_ROLL_DEG * DEG * this.shimmySide * s;
          bob = FEEL.SHIMMY_BOB * s;
        } else {
          rollT = FEEL.SWAY_ROLL_DEG * DEG * Math.sin(2 * Math.PI * FEEL.SWAY_HZ * this.t);
          bob = FEEL.SWAY_Y * Math.sin(2 * Math.PI * FEEL.SWAY_HZ * 1.37 * this.t);
        }
      } else {
        // hand over hand: a reach every FEEL.REACH climbed (up, down or across), the hands taking turns
        const travel = Math.hypot(dx, dy, dz);
        if (travel > 1e-5) this.climbPhase += travel / FEEL.REACH;
        const ph = this.climbPhase;
        rollT = FEEL.CLIMB_ROLL_DEG * DEG * Math.sin(Math.PI * ph);   // one hand (+), then the other (-)
        bob = FEEL.CLIMB_BOB * Math.sin(2 * Math.PI * ph);
      }
    }
    // the grip failing: a tremble rising as it runs out - laid over the springs, which would smooth it away
    let shake = 0;
    if (m.onWall && Number.isFinite(m.grip)) {
      const k = clamp01((PARKOUR_GRIP_LOW - m.grip) / PARKOUR_GRIP_LOW);
      if (k > 0) {
        shake = FEEL.TREMBLE_DEG * DEG * k * tremble(this.t * FEEL.TREMBLE_HZ);
        bob += FEEL.TREMBLE_Y * k * tremble(this.t * FEEL.TREMBLE_HZ * 1.3 + 7);
      }
    }
    // the springs
    [this.eyeY, this.eyeV] = spring(this.eyeY, this.eyeV, 0, FEEL.K_EYE, dt);
    [this.pitchS, this.pitchV] = spring(this.pitchS, this.pitchV, pitchT, FEEL.K_ANGLE, dt);
    [this.rollS, this.rollV] = spring(this.rollS, this.rollV, rollT, FEEL.K_ANGLE, dt);
    [this.fovS, this.fovV] = spring(this.fovS, this.fovV, fovT, FEEL.K_FOV, dt);
    // the turn still owed, paid out on its time constant
    if (this.turnLeft) {
      const step = Math.abs(this.turnLeft) < 1e-4 ? this.turnLeft : this.turnLeft * (1 - Math.exp(-dt / this.turnTau));
      out.yaw = step;
      this.turnLeft -= step;
    }
    out.pitch = this.pitchS;
    out.roll = this.rollS + shake;
    // AUDIT CLIMB-ARC nit: the rhythm's bob eased as every effect is - a let-go mid-reach no longer snaps the eye
    [this.bobS, this.bobV] = spring(this.bobS, this.bobV, bob, FEEL.K_EYE, dt);
    out.eye[0] = 0; out.eye[1] = this.eyeY + this.bobS; out.eye[2] = 0;
    out.fov = this.fovS;
    return out;
  }

  /** The motion along the held wall, positive to the wall's right facing it (the shimmy's way). */
  _along(m, dx, dz) {
    const n = m.wallNormal;
    return n ? -n[2] * dx + n[0] * dz : 0;
  }

  _event(e, yaw, m) {
    switch (e.type) {
      case 'move': {
        const way = e.way ?? [0, 0], n = e.normal;
        // a leap's side, facing the wall (+ to its right): the roll's way
        const side = n ? Math.sign(-n[2] * way[0] + n[0] * way[1]) : 0;
        this.move = { kind: e.kind, dur: e.dur, rise: e.rise ?? 0, turn: e.turn ?? 0, side, speed: e.kind === 'leap' ? leapArrival(e) : 0 };
        // AUDIT CLIMB-ARC F9: a leap's dip is its ARRIVAL's (the hold it ends in - 'hold' below), never its push-off's
        if (e.kind === 'catch' || e.kind === 'reach') {
          this._dip(e.speed ?? 0);   // the hands land on a lip with the body's weight: the dip, harder the faster it came
        }
        // the turns finish with the move (a fifth of its time the turn's constant: 99 % in)
        if (e.kind === 'lower' && n) this._turnTo(Math.atan2(-n[0], -n[2]), yaw, Math.max(0.05, e.dur / 5));
        if (e.kind === 'corner' && e.turn) { this.turnLeft += e.turn; this.turnTau = Math.max(0.04, e.dur / 5); }
        if (e.kind === 'leap' || e.kind === 'wallrun') this.fovV += FEEL.LAUNCH_FOV * 6;
        if (e.kind === 'vault') this.fovV += FEEL.VAULT_FOV * 6;
        break;
      }
      case 'launch': {
        this.fovV += FEEL.LAUNCH_FOV * 8;
        const d = e.dir;
        if (d) this._turnTo(Math.atan2(d[0], d[2]), yaw, FEEL.EJECT_TURN_S / 3);
        break;
      }
      case 'hold':
        this.climbPhase = 0; this.shimmyPhase = 0;   // AUDIT CLIMB-ARC nit: every hold restarts the rhythm, as the sounds' does - eye and ear in step
        if (this.move?.kind === 'leap') this._dip(this.move.speed ?? 0);   // AUDIT CLIMB-ARC F9: the leap lands on its hold
        break;
      default: break;
    }
  }

  /** The catch's dip: the eye down and the view pitched, harder the faster the body came to the lip. */
  _dip(speed) {
    const v = Math.min(FEEL.DIP_MAX, FEEL.DIP_BASE + FEEL.DIP_PER_SPEED * speed);
    this.eyeV -= v;
    this.pitchV -= FEEL.CATCH_PITCH_DEG * DEG * 8 * (v / FEEL.DIP_MAX);
  }

  /** Owe the turn from the view's heading to `target` (the shortest way), paid out on `tau`. AUDIT CLIMB-ARC nit: the
   *  heading the view will have once what is still owed is paid is `yaw + turnLeft`, so the owed turn becomes the whole
   *  way from there - landing on the target, never short by what was owed before. */
  _turnTo(target, yaw, tau) {
    this.turnLeft += wrap(target - (yaw + this.turnLeft));
    this.turnTau = tau;
  }
}

// ---- the view's half: applied by the host at its view line, first person only ----------------------------------------

const S = new Float32Array(16);
/** The view matrix `view` (column-major, OpenGL's: the camera down -z) with the feel's pitch and roll applied in the
 *  camera's frame and its eye offset in the world's, in place: view' = Rz(roll) Rx(-pitch) view T(-eye). */
export function applyClimbView(view, fx) {
  if (!fx || (!fx.pitch && !fx.roll && !fx.eye[0] && !fx.eye[1] && !fx.eye[2])) return view;
  // view * T(-eye): the translation column moves by -(R e)
  const e = fx.eye, ex = e[0], ey = e[1], ez = e[2];   // TECH-FX: read by index - a destructure made an iterator a frame (16 B, test/techfx1.test.js)
  view[12] -= view[0] * ex + view[4] * ey + view[8] * ez;
  view[13] -= view[1] * ex + view[5] * ey + view[9] * ez;
  view[14] -= view[2] * ex + view[6] * ey + view[10] * ez;
  // E = Rz(roll) Rx(-pitch), rows of the camera frame mixed
  const cp = Math.cos(fx.pitch), sp = Math.sin(fx.pitch), cr = Math.cos(fx.roll), sr = Math.sin(fx.roll);
  // Rx(-p) = [[1,0,0],[0,cp,sp],[0,-sp,cp]]; Rz(r) = [[cr,-sr,0],[sr,cr,0],[0,0,1]]; E = Rz Rx
  const e00 = cr, e01 = -sr * cp, e02 = -sr * sp;
  const e10 = sr, e11 = cr * cp, e12 = cr * sp;
  const e20 = 0, e21 = -sp, e22 = cp;
  S.set(view);
  for (let c = 0; c < 4; c++) {
    const r0 = S[c * 4], r1 = S[c * 4 + 1], r2 = S[c * 4 + 2];
    view[c * 4] = e00 * r0 + e01 * r1 + e02 * r2;
    view[c * 4 + 1] = e10 * r0 + e11 * r1 + e12 * r2;
    view[c * 4 + 2] = e20 * r0 + e21 * r1 + e22 * r2;
  }
  return view;
}

/** CLIMB4: a host's handle on the feel - the law, the frame's effects, and the three things a frame does with them:
 *  `frame(dt)` after the motor moved (the turn owed to the look filter: a heading, paid out next frame), `view(view,
 *  firstPerson)` at the view line (the pitch, the roll and the eye - first person only, never the travel view's or a
 *  free camera's), and the lens terms every other pass of the frame takes so its horizon stands where the view's does
 *  (`fovRad()` - the kick, any view; `pitch()` - the pitch the view took). `player` is a thunk: hosts build the handle
 *  beside their bobber, before the motor stands. With `audio`, the frame also sounds the climb (player/climbSounds.js -
 *  any view: the ear is the body's), `strain(rolls)` its effort voice (scenes/hostCombat.js playerClimbStrain). */
export function createClimbFeelHost(player, cam, lookFilter, { audio = null, strain = null } = {}) {
  const law = new ClimbFeel();
  const sounds = audio ? new ClimbSounds({ audio, strain }) : null;
  return {
    law,
    sounds,
    fx: null,
    applied: null,
    tech: null,   // TECH-FX: the technique's channel the view took (first person only)
    /** AUDIT CLIMB-ARC F2/F4: `held` - the host holds the motor this frame (a window, the death screen, the season):
     *  the feel stands as it was - no event re-read, no clock, no sound - as a paused game runs no Update. */
    frame(dt, held = false) {
      // TECH-FX: a technique's springs settle on every frame - under a held one too (AUDIT TECH-FX: held with the body, a
      // window or the death screen opened in a blow's first moment kept its tilt and its dip as long as it stood)
      stepTechniqueFx(dt);
      const m = player();
      if (!m || held) return;
      this.fx = law.update(dt, m, cam.yaw);
      if (this.fx.yaw) lookFilter?.turn?.(this.fx.yaw);
      sounds?.update(dt, m);
    },
    view(view, firstPerson) {
      this.applied = firstPerson && this.fx ? this.fx : null;
      if (this.applied) applyClimbView(view, this.applied);
      // TECH-FX (bible/05-Combat/Weapon-Techniques.md THE FEEL): a technique's pitch, roll and eye dip, first person only,
      // folded after the climb's - at rest every term is 0 and applyClimbView returns the view untouched
      this.tech = firstPerson ? techniqueView() : null;
      if (this.tech) applyClimbView(view, this.tech);
      return view;
    },
    fovRad() { return (((this.fx?.fov ?? 0) + techniqueView().fov) * Math.PI) / 180; },   // TECH-FX: and a technique's kick, every lens, as the climb's
    pitch() { return (this.applied?.pitch ?? 0) + (this.tech?.pitch ?? 0); },   // TECH-FX: the sky takes the technique's pitch too
    reset() { law.reset(); sounds?.reset(); resetTechniqueFx(); this.fx = null; this.applied = null; this.tech = null; },   // TECH-FX: a load's or a teleport's frame shows no blow of the moment before (AUDIT TECH-FX: the runner's own reset waited for its next step)
  };
}
