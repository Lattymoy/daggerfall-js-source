// AUDIT 28 W10 - HEAD BOBBING: HeadBobber.cs (MIT, Daggerfall Workshop),
// whole. Controls/HeadBobbing ships True: DFU's camera bobs and nods as
// you walk, dips and rises on a landing, and the port's never did.
//
// Every Update (:44-58) - off, dead, cursor-active, paused, climbing or
// airborne returns. Else the style (Swimming > Running > Crouching >
// Horse > Walking) picks the four amounts, and getNewPos (:110-150)
// walks a timer at velocity * bobSpeed (= WalkStepInterval / 2 = 1.25):
// moving - a cos/|sin| path (side sway, parabolic rise) blended from
// rest across the first PI of timer; released - a 0.5 s lerp from where
// the camera is back to rest while the timer unwinds; then the landing
// bounce (:152-192) - a 0.17 dip over 0.10 s and back, slower in water.
// The camera's LOCAL position is set and its rotation is Rotate()d by
// the nod, |sin|*nodX down and -sin*nodY yaw, degrees.
//
// The port applies the position as an offset the motor's eye adds
// (every camera and every ray in the port reads player.eye, as every
// DFU ray reads the camera transform) and the nod as a per-frame
// OFFSET on the look: PlayerMouseLook writes absolute angles each Update
// and the bobber Rotates on top, so the nod does not accumulate; the
// port removes last frame's nod before adding this frame's.

import { getBool } from '../systems/settings.js';
import { WALK_STEP_INTERVAL } from '../systems/footsteps.js';

/** bobSpeed = WalkStepInterval / 2 (:41). */
export const BOB_SPEED = WALK_STEP_INTERVAL / 2;
export const END_TIMER_MAX = 0.5;
export const BOUNCE_MAX = 0.17;
export const BOUNCE_TIMER_MAX = 0.10;
const DEG = Math.PI / 180;

/** SetParamsForBobbingStyle (:73-108): [bobX, bobY, nodX, nodY]. */
export const BOB_STYLE = Object.freeze({
  Crouching: Object.freeze([0.08, 0.07, 0.5, 0.2]),
  Walking: Object.freeze([0.045, 0.062, 0.25, 0.1]),
  Running: Object.freeze([0.09, 0.11, 0.6, 0.15]),
  Horse: Object.freeze([0.03, 0.115, 0.2, 0.1]),
  Swimming: Object.freeze([0, 0, 0, 0]),
});

/** GetBobbingStyle (:60-71), in its priority order. */
export function bobbingStyle({ swimming, running, crouching, riding }) {
  if (swimming) return 'Swimming';
  if (running) return 'Running';
  if (crouching) return 'Crouching';
  if (riding) return 'Horse';
  return 'Walking';
}

/** Mathf.Lerp clamps t to [0, 1]. */
const lerp = (a, b, t) => a + (b - a) * Math.min(Math.max(t, 0), 1);

export class HeadBobber {
  constructor() {
    this.timer = Math.PI / 2;   // the crest: a bob UP as the foot pushes off (:31)
    this.beginTransitionTimer = 0;
    this.endTransitionTimer = 0;
    this.isStopping = false;
    this.readyToBounce = false;
    this.bounceTimerDown = 0;
    this.bounceTimerUp = 0;
    /** The camera's current local offset from rest: [right, up]. */
    this.offset = [0, 0];
    /** Last frame's applied nod [pitchDownDeg, yawDeg], removed first. */
    this.nod = [0, 0];
    this.style = 'Walking';
  }

  /**
   * One Update. Applies the nod to `cam` as an offset and returns the
   * eye offset [right, up] in metres (also kept as this.offset).
   * @param {number} dt
   * @param {{yaw:number, pitch:number}} cam
   * @param {object} s - the frame's state (see the destructure)
   */
  update(dt, cam, {
    enabled = getBool('Controls', 'HeadBobbing'),
    health = 1, paused = false, climbing = false, grounded = true,
    swimming = false, running = false, crouching = false, riding = false, levitating = false,
    velocity = 0, moving = false,
  } = {}) {
    // Take last frame's nod back off the look (Rotate is per-frame on
    // top of PlayerMouseLook's absolute write).
    cam.pitch += this.nod[0] * DEG;
    cam.yaw -= this.nod[1] * DEG;
    this.nod = [0, 0];
    if (!enabled || health < 1 || paused || climbing || !grounded) return this.offset;
    this.style = bobbingStyle({ swimming, running, crouching, riding });
    const [bobX, bobY, nodX, nodY] = BOB_STYLE[this.style];
    // getNewPos (:110-150); positions here are relative to rest.
    let posX = 0, posY = 0;
    let rotX = 0, rotY = 0;
    const timeIncrement = velocity * BOB_SPEED * dt;
    const plotPath = () => [Math.cos(this.timer) * bobX, Math.abs(Math.sin(this.timer) * bobY)];
    const plotRotation = () => [Math.abs(Math.sin(this.timer) * nodX), -Math.sin(this.timer) * nodY];
    if (moving) {
      if (this.endTransitionTimer > 0) { this.endTransitionTimer = 0; this.timer = Math.PI; }
      this.timer += timeIncrement;
      this.beginTransitionTimer += timeIncrement;
      [posX, posY] = plotPath();
      [rotX, rotY] = plotRotation();
      if (this.beginTransitionTimer <= Math.PI) {
        // InterpolateBeginTransition (:220-224): rest -> path over (timer % PI) / PI
        const t = (this.timer % Math.PI) / Math.PI;
        posX = lerp(0, posX, t); posY = lerp(0, posY, t);
      }
      this.isStopping = true;
      this.endTransitionTimer = 0;
    } else if (this.isStopping && this.endTransitionTimer <= END_TIMER_MAX) {
      if (this.timer > 0) this.timer = Math.max(this.timer - timeIncrement, 0);
      this.beginTransitionTimer = 0;
      this.endTransitionTimer += dt;
      // InterpolateEndTransition (:214-219): from where the camera IS to rest
      const t = this.endTransitionTimer / END_TIMER_MAX;
      posX = lerp(this.offset[0], 0, t); posY = lerp(this.offset[1], 0, t);
      [rotX, rotY] = plotRotation();
    } else if (this.isStopping) {
      this.endTransitionTimer = 0;
      this.timer = Math.PI;
      this.isStopping = false;
    }
    if (this.timer > Math.PI * 2) this.timer = 0;
    posY = this._applySimpleBouncing(dt, posY, { grounded, swimming, climbing, levitating });
    this.offset = [posX, posY];
    // Rotate(newRotation): x pitches down in Unity's frame, y turns right.
    this.nod = [rotX, rotY];
    cam.pitch -= rotX * DEG;
    cam.yaw += rotY * DEG;
    return this.offset;
  }

  /** ApplySimpleBouncing (:152-192): the y only (the x term is a no-op,
   *  `newPosition.x - newPosition.x`). */
  _applySimpleBouncing(dt, posY, { grounded, swimming, climbing, levitating }) {
    if (climbing || levitating) return posY;
    let upSpeed = 1, downSpeed = 1;
    if (swimming) { upSpeed = 0.40; downSpeed = 0.1; }
    if ((!grounded || swimming) && !this.readyToBounce) {
      this.readyToBounce = true;
      this.bounceTimerUp = 0;
      this.bounceTimerDown = 0;
    } else if (this.readyToBounce && (grounded || swimming)) {
      if (this.bounceTimerDown < BOUNCE_TIMER_MAX) {
        this.bounceTimerDown += dt * downSpeed;
        const t = this.bounceTimerDown / BOUNCE_TIMER_MAX;
        return lerp(0, -BOUNCE_MAX, t);
      } else if (this.bounceTimerUp < BOUNCE_TIMER_MAX) {
        this.bounceTimerUp += dt * upSpeed;
        const t = this.bounceTimerUp / BOUNCE_TIMER_MAX;
        return lerp(-BOUNCE_MAX, 0, t);
      } else {
        this.readyToBounce = false;
      }
    }
    return posY;
  }
}
