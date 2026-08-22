// First-person player motor. Speed formulas, gravity, jump, and capsule
// dimensions are 1:1 with Daggerfall Unity's PlayerSpeedChanger /
// AcrobatMotor / PlayerAdvanced controller (MIT, Daggerfall Workshop):
//   - classicToUnitySpeedUnitRatio 39.5 (Allofich's measurement),
//     dfWalkBase 150, dfCrouchBase 50.
//   - Walk = (LiveSpeed + 150 - drag) / 39.5 where drag = 0.5 x
//     (100 - max(30, LiveSpeed)) (audit 2026-08-16e F1 - the drag
//     term was missing); Run = UNDRAGGED base x (1.35 + Running/200)
//     with the crouch base while crouched; Crouch = (LiveSpeed + 50)
//     / 39.5; Sneak = speed / 2 - 1 / 39.5 on the walk/crouch base
//     (P15 - held input; running beats sneaking, and both states
//     re-latch only while GROUNDED, verbatim "you can't switch
//     running on/off while in mid air"; swim ignores both, the
//     LevitateMotor path uses the raw base).
//   - jumpSpeed 4.5, gravity 20 (AcrobatMotor defaults).
//   - P11 swimming/levitation (LevitateMotor): camera-directed
//     movement with no gravity; levitate at the 4.0 constant; swim =
//     base * (Swimming/200) + base/4 with the look's vertical zeroed
//     (float keys drive it), the can't-surface clamp, and the S8
//     waterWalking normal-speed consumer. limitDiagonalSpeed .7071
//     applies on both paths (the grounded path had skipped it - P11
//     parity fix).
//   - Capsule height 1.8, radius 0.35, stepOffset 0.5, slopeLimit 70
//     degrees (PlayerAdvanced CharacterController).
// Collision resolution itself is engine-side (ours - collider.js), like
// the renderer. EYE_HEIGHT 1.7 above the feet is a documented
// presentation choice (the prefab camera hierarchy is ambiguous;
// classic sits the eye just under the head).
// Stats default to SPD 50 / Running 30 until the Characters arc supplies
// the real entity.

export const CLASSIC_TO_UNITY_RATIO = 39.5;
// AUDIT 24 (wave 24): the classic walk base is one DFU constant with
// two declarations; enemyMotor.js is the home the enemy AI already
// reads it from.
import { DF_WALK_BASE } from '../characters/enemyMotor.js';

export { DF_WALK_BASE };
export const DF_CROUCH_BASE = 50;
export const JUMP_SPEED = 4.5;
// PlayerMotor.systemTimerUpdatesDivisor (the 0x46C memory-timer
// divisor) - the ONE member both EnemySenses' target timer and
// ClimbingMotor's check cadences divide by. M3: moved to its DFU
// home (a PlayerMotor field); characters/enemyMotor.js re-exports.
export const SYSTEM_TIMER_UPDATES_DIVISOR = 0.0549254;
// P14 jump/fall parity (AcrobatMotor + PlayerMotor.GroundedTime,
// verbatim): the jump fires only after 0.1 s of grounded time (the
// bunny-hop gate), a crouched jump scales by crouchingJumpDelta 0.8,
// a MOVING jump gains forward * jumpSpeed * 0.05 of momentum (DFU's
// own classic-momentum hack), slowfall is a CONSTANT -105 * dt fall
// speed with the fall-start reset each tick (no accumulation, no
// fall damage below the loss point), and a fall reports its distance
// on landing (CheckFallingDamage: damage past 5, a hard-fall alert
// past 2.5 - the HOST applies HP/sounds; PlayerHealth does in DFU).
export const GROUNDED_JUMP_GATE_S = 0.1;
// HOTFIX 2026-08-17 (live mobile report: "jumping has me go in the
// air but instantly snaps me to the ground"): the motor integrated
// with RAW RENDER dt - DFU's physics runs in Unity's FixedUpdate at
// a fixed timestep no matter the render rate, and every law here
// assumes that. At a phone's 10-15 fps the jump's same-frame gravity
// subtraction (velY -= g*dt) scaled with the frame: dt 0.2 stole 4.0
// of the 4.5 takeoff velocity and the apex collapsed from ~0.5 to
// ~0.1. update() now ACCUMULATES render dt and steps the physics at
// FIXED_DT (1/60 - the rate all shipped pins were derived at; Unity
// defaults to 50 Hz, the choice is ours and documented). MAX_FRAME_DT
// clamps jank spikes exactly as Unity's maximumDeltaTime does (time
// slows instead of the integrator exploding).
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.25;
export const CROUCH_JUMP_DELTA = 0.8;
export const JUMP_FWD_BOOST = 0.05;
export const SLOWFALL_SPEED = 105;          // AcrobatMotor slowFallSpeed (x dt = the constant fall velocity)
export const FALL_DAMAGE_THRESHOLD = 5.0;   // AcrobatMotor fallingDamageThreshold (= PlayerHealth's threshold)
export const FALL_HP_PER_METRE = 5;         // PlayerHealth.ApplyPlayerFallDamage HPPerMetre
export const GRAVITY = 20.0;
export const CAPSULE_HEIGHT = 1.8;
export const CAPSULE_RADIUS = 0.35;
export const STEP_OFFSET = 0.5;
export const SLOPE_LIMIT_DEG = 70;
export const EYE_HEIGHT = 1.7;
// P12 crouch (PlayerHeightChanger): controllerCrouchHeight 0.9.
// DFU parks the camera 0.09 below the capsule top; our standing eye
// sits 0.1 below (the documented 1.7 presentation choice) - the
// crouched eye keeps that same law: 0.9 - 0.1 = 0.8 above the feet.
export const CROUCH_HEIGHT = 0.9;
export const CROUCH_EYE_HEIGHT = 0.8;
// PlayerHeightChanger.timerFast - the crouch/stand action's camTimer
// budget. AUDIT 18: a BLOCKED stand-up is not dropped on the spot.
// PlayerHeightChanger.Update's chain is `else if (heightAction ==
// DoStanding && CanStand()) DoStand(); ... else DoDismount();`, so a
// blocked stand falls through to DoDismount, which (already
// dismounted) does nothing but tick camTimer and calls
// timerResetAction() once camTimer >= timerMax - the request RETRIES
// every frame for 0.10 s and is only then forgotten.
export const HEIGHT_TIMER_FAST = 0.10;
export const HEIGHT_TIMER_MEDIUM = 0.25;   // AUDIT 23 (motor-2): the forced swim-crouch clock (PlayerHeightChanger.cs:71)

// M3 CLIMBING: the check machine + formulas live in climbing.js; the
// motor owns the capsule work (the wall probe + ClimbMovement's
// classic arm). The import is a cycle with climbing.js's divisor
// import - both are runtime-only references, which ESM live bindings
// resolve.
import { ClimbingState, climbingSpeed } from './climbing.js';

/** PlayerSpeedChanger.GetWalkSpeed, verbatim (audit 2026-08-16e F1):
 *  drag = 0.5 x (100 - max(30, LiveSpeed)) rides the WALK base only -
 *  the pre-audit port dropped the term and walked ~14% fast at SPD
 *  50 ((50+150)/39.5 vs DFU's (50+150-25)/39.5). */
export function walkSpeed(liveSpeed) {
  const drag = 0.5 * (100 - (liveSpeed >= 30 ? liveSpeed : 30));
  return (liveSpeed + DF_WALK_BASE - drag) / CLASSIC_TO_UNITY_RATIO;
}

/** GetRunSpeed, verbatim: the run base is UNDRAGGED - (LiveSpeed +
 *  150) / 39.5, or the CROUCH base while crouched (and not swimming)
 *  - x (1.35 + Running / 200). Decoupled from walkSpeed in the F1
 *  audit fix (the old walk-x-mult shape only matched DFU because
 *  walk lacked its drag). */
export function runSpeed(liveSpeed, runningSkill, crouching = false) {
  const base = (liveSpeed + (crouching ? DF_CROUCH_BASE : DF_WALK_BASE)) / CLASSIC_TO_UNITY_RATIO;
  return base * (1.35 + runningSkill / 200);
}

export function crouchSpeed(liveSpeed) {
  return (liveSpeed + DF_CROUCH_BASE) / CLASSIC_TO_UNITY_RATIO;
}

export function sneakSpeed(speed) {
  return speed / 2 - 1 / CLASSIC_TO_UNITY_RATIO;
}

// ---- P11: swimming + levitation (LevitateMotor / PlayerSpeedChanger) ----
export const LEVITATE_MOVE_SPEED = 4.0;      // LevitateMotor standardLevitateMoveSpeed
/** PlayerMotor.limitDiagonalSpeed factor, verbatim (.7071 when both
 *  axes are live - the pre-P11 grounded path skipped it and moved
 *  sqrt(2) fast on diagonals; parity fix). */
export const DIAGONAL_FACTOR = 0.7071;

/** PlayerSpeedChanger.GetSwimSpeed, verbatim:
 *  base * (liveSwimming / 200) + base / 4. */
export function swimSpeed(baseSpeed, swimmingSkill) {
  return baseSpeed * (swimmingSkill / 200) + baseSpeed / 4;
}

/**
 * Grounded first-person motor. Feeds a wish direction to the collider
 * and integrates AcrobatMotor-style vertical motion.
 */
export class PlayerMotor {
  constructor(collider, stats = { speed: 50, running: 30, swimming: 30 }, { jumpBoost = null, climbing = null } = {}) {
    this.collider = collider;
    this.stats = stats;
    this.jumpBoost = jumpBoost;    // () => AcrobatMotor jumpSpeedMultiplier (systems/skills owns the formula)
    // M3 CLIMBING (ClimbingMotor, classic path): the check machine -
    // mounted ONLY when the host passes deps, exactly as the
    // component is a mount in DFU (headless/test motors stay
    // climbless, and the wall probe never runs on mock colliders).
    // The water forgiveness reads the motor's own water surface -
    // ClimbingSkillCheck :837-843's foot position collapses to
    // feetY - 0.25 (center + 76*GS - 0.95, minus height/2 + 1.20).
    this.climb = climbing ? new ClimbingState({
      ...climbing,
      waterForgiven: () => this.waterSurfaceY != null && this.pos[1] - 0.25 < this.waterSurfaceY,
    }) : null;
    this._climbWallDir = null;   // myLedgeDirection (latched while a wall is in reach)
    this.pos = new Float32Array(3); // FEET position
    this.velY = 0;
    this.grounded = false;
    this.groundedTime = 0;         // PlayerMotor.GroundedTime (the 0.1 s jump gate reads it)
    this.jumping = false;          // AcrobatMotor.Jumping: set at jump, cleared on the next grounded frame
    this.falling = false;          // AcrobatMotor.Falling (CheckInitFall / CheckFallingDamage)
    this.fallStart = 0;            // fallStartLevel
    this.landedFallDistance = 0;   // set for the frame a fall LANDS (the host applies damage/sounds)
    this.slowFalling = false;      // IsSlowFalling (the S8 buff; hosts feed it per frame)
    // airControl = false (AcrobatMotor default): airborne horizontal
    // momentum is FROZEN at liftoff - DFU only recomputes x/z from
    // input in the GROUNDED branch (FrictionMotor.GroundedMovement),
    // so a jump carries its takeoff velocity and mid-air steering
    // does nothing (enhanced-jump/rappel air control pends its slice).
    this._airVelX = 0;
    this._airVelZ = 0;
    // P11 modes (the scene owns the toggles): swimming rides the
    // block water level; levitating rides the Levitate effect;
    // waterWalking (S8) restores normal speed in water.
    this.swimming = false;
    this.levitating = false;
    this.waterWalking = false;
    this.waterSurfaceY = null;   // the current block's water surface (world y), null when dry
    this.jumped = false;         // set for the frame a jump actually starts (fatigue/tally consumer)
    this.crouching = false;      // P12: toggled via input.crouch (edge); standing needs headroom
    // PlayerHeightChanger.heightAction / camTimer: null | 'crouch' |
    // 'stand'. The pending action lives on the RENDER frame, exactly
    // where DFU decides and applies it.
    this.heightAction = null;
    this.heightTimer = 0;
    // P15 (PlayerSpeedChanger): the run/sneak STATES - latched from
    // held input only while grounded; airborne keeps the takeoff
    // state (the swim quirk rides it too: waterWalking's Speed read).
    this.isRunning = false;
    this.isSneaking = false;
    // P13: PlayerMotor.IsMovingLessThanHalfSpeed - the stealth
    // sneak condition, recomputed each update from the frame's input.
    this.movingLessThanHalfSpeed = true;
    // PlayerMotor.speed (the `speed` FIELD, not a recomputation):
    // UpdateSpeed writes it, and the swim/levitate early return sits
    // ABOVE UpdateSpeed, so while swimming/levitating it keeps its
    // last GROUNDED value - IsMovingLessThanHalfSpeed reads that
    // stale value, verbatim.
    this.speed = walkSpeed(this.stats.speed);
  }

  get eye() {
    return [this.pos[0], this.pos[1] + this._eyeLevel(), this.pos[2]];
  }

  /** The presentation eye across the height actions (P18): DoCrouch
   *  sinks it standing->crouched BEFORE the stance flips, DoStand
   *  raises it crouched->standing AFTER, both across DFU's
   *  clamp(camTimer/timerMax) (:246-287). The path itself is ours - a
   *  straight lerp between the two rest eyes (the 0.1-below-top
   *  presentation law), where DFU lerps the camera inside its Unity
   *  transform parenting (DoCrouch runs from prevHeight/2, 0.09 above
   *  the standing rest, and sits 0.45 high until the height change
   *  drops the transform - scaffolding, not law). A BLOCKED stand
   *  holds the crouched rest: DFU's DoDismount fallback lerps stale
   *  prev/target fields there, which is the same scaffolding. */
  _eyeLevel() {
    const t = Math.min(this.heightTimer / (this.heightTimerMax ?? HEIGHT_TIMER_FAST), 1);
    if (this.heightAction === 'crouch') return EYE_HEIGHT + (CROUCH_EYE_HEIGHT - EYE_HEIGHT) * t;
    if (this.heightAction === 'stand' && !this.crouching) return CROUCH_EYE_HEIGHT + (EYE_HEIGHT - CROUCH_EYE_HEIGHT) * t;
    return this.crouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
  }

  get height() {
    return this.crouching ? CROUCH_HEIGHT : CAPSULE_HEIGHT;
  }

  spawn(x, y, z) {
    this.pos[0] = x;
    this.pos[1] = y;
    this.pos[2] = z;
    this.velY = 0;
    this.grounded = false;
    // Teleports/loads clear all motion state (DFU: CancelMovement +
    // ClearFallingDamage on teleport actions, enter/exit, and load) -
    // a downward warp must not bill the drop as a fall.
    this.groundedTime = 0;
    this.jumping = false;
    this.falling = false;
    this.fallStart = y;
    this._airVelX = 0;
    this._airVelZ = 0;
    this._acc = 0;   // the fixed-step accumulator restarts clean
    this._heightReset();   // a pending height action does not ride a teleport/load
  }

  /**
   * @param {number} dt seconds
   * @param {{forward:number,strafe:number,run:boolean,jump:boolean,up:boolean,down:boolean}} input
   *   (up/down: the Jump/FloatUp and Crouch/FloatDown keys, HELD -
   *   only the swim/levitate path reads them)
   * @param {number} yaw camera yaw (fwd = (sin, 0, cos))
   * @param {number} pitch camera pitch (the swim/levitate path moves
   *   along the LOOK, TransformDirection-style)
   */
  /** PlayerMotor.IsMovingLessThanHalfSpeed, verbatim shape:
   *  standing still is always true; crouched compares HALF THE WALK
   *  speed against the applied speed; otherwise half the BASE speed
   *  (GetBaseSpeed - the crouch/walk selection without run). Sneaking
   *  (P15: base/2 - one classic unit) lands UNDER the half line -
   *  that final subtracted unit is exactly what makes a moving sneak
   *  qualify for the P13 stealth checks. */
  _trackHalfSpeed(input, appliedSpeed) {
    // IsStandingStill runs its zero-magnitude test ONLY inside
    // `if (grounded)` and returns false otherwise (PlayerMotor.cs:
    // 113-125), so an AIRBORNE player is never "standing still" no
    // matter how empty the input is.
    // AUDIT 23 (motor-1) - PlayerMotor.cs:121: IsStandingStill reads
    // moveDirection.x/z only - Jump/FloatUp/FloatDown are not movement,
    // so holding Jump in place keeps the stealth half-speed benefit.
    const standing = this.grounded && !input.forward && !input.strafe;
    this.standing = standing;   // the hosts' IsRunning && !IsStandingStill read
    if (standing) { this.movingLessThanHalfSpeed = true; return; }
    // Crouched compares GetWalkSpeed/2; the else compares
    // GetBaseSpeed/2, and GetBaseSpeed NOT crouched is the same
    // dragged walk - both DFU branches collapse to walk/2 here.
    this.movingLessThanHalfSpeed = walkSpeed(this.stats.speed) / 2 >= appliedSpeed;
  }

  /** PlayerHeightChanger.DecideHeightAction + PlayerHeightChanger
   *  .Update, both of which run on the RENDER frame in DFU.
   *  DecideHeightAction TOGGLES the pending action off the Crouch
   *  press (:174-181) - it reads IsCrouching, which a pending crouch
   *  has not flipped yet, so a re-press mid-window re-arms the SAME
   *  action; Update applies DoCrouch unconditionally and DoStand only
   *  while CanStand() passes (:223-226), a blocked stand falling
   *  through to the do-nothing DoDismount. camTimer is reset ONLY by
   *  timerResetAction (:451-455), at COMPLETION - neither a re-press
   *  nor an action switch mid-window restarts the clock.
   *
   *  THE TIMED TRANSITION (P18, the P12 residue). DoCrouch (:246-262,
   *  "first lower camera, Controller height last") flips IsCrouching
   *  and the controller height only once camTimer >= timerMax - the
   *  player is mechanically STANDING (speed base, capsule, jump
   *  delta, the stealth half-speed compare) for the whole 0.10 s.
   *  DoStand (:265-287, "adjust height first, camera last") is the
   *  reverse order: height + IsCrouching flip on the FIRST tick
   *  CanStand passes, and only the camera lags, its lerp T fed by the
   *  SAME accumulated camTimer - a stand that spent 0.08 s blocked
   *  gets a nearly instant camera, DFU's own arithmetic. The eye path
   *  lives in _eyeLevel. */
  _heightAction(dt, input) {
    // DecideHeightAction's arm ORDER (:173-207). AUDIT 23 (motor-2):
    // the crouch press only toggles out of water or on solid ground
    // ((!swimming || IsGrounded) && pressedCrouch), and a free swim
    // FORCES the crouched capsule on the medium clock - DFU always
    // shrinks a swimmer; surfacing un-forces it the same way.
    if (input.crouch && (!this.swimming || this.grounded)) {
      this.heightAction = this.crouching ? 'stand' : 'crouch';
      this.heightTimerMax = HEIGHT_TIMER_FAST;
      this.forcedSwimCrouch = false;
    } else if (this.swimming && !this.forcedSwimCrouch && !this.grounded) {
      if (!this.crouching) { this.heightAction = 'crouch'; this.heightTimerMax = HEIGHT_TIMER_MEDIUM; }
      this.forcedSwimCrouch = true;
    } else if (!this.swimming && this.forcedSwimCrouch) {
      if (this.crouching) { this.heightAction = 'stand'; this.heightTimerMax = HEIGHT_TIMER_MEDIUM; }
      this.forcedSwimCrouch = false;
    }
    if (!this.heightAction) return;
    this.heightTimer += dt;   // timerTick (:442-447): every pending action runs the one clock
    const max = this.heightTimerMax ?? HEIGHT_TIMER_FAST;
    if (this.heightAction === 'crouch') {
      if (this.heightTimer >= max) {
        this.crouching = true;   // the flip IS the end of DoCrouch
        this._heightReset();
      }
    } else if (this.collider.penetrationAt(this.pos, CAPSULE_HEIGHT) < 0.03) {
      // CanStand: the STANDING capsule must fit at the current feet.
      this.crouching = false;    // DoStand flips at the START; the eye keeps lerping
      if (this.heightTimer >= max) this._heightReset();
    } else if (this.heightTimer >= max) {
      this._heightReset();       // the blocked request is forgotten past the budget
    }
  }

  /** timerResetAction (:451-455). */
  _heightReset() {
    this.heightAction = null;
    this.heightTimer = 0;
    this.heightTimerMax = HEIGHT_TIMER_FAST;
  }

  /** The RENDER-frame entry: accumulates dt and runs fixed physics
   *  steps (see the FIXED_DT note). Per-frame report flags (jumped,
   *  landedFallDistance) reset here and OR/carry across the steps.
   *  The crouch key is decided and applied HERE, not inside a step:
   *  DFU reads it in PlayerMotor.Update (:371 heightChanger
   *  .DecideHeightAction) and never in FixedUpdate, so a render frame
   *  that accumulates less than one physics step must not swallow the
   *  press (AUDIT 18 - at 120 Hz that dropped every other crouch). */
  update(dt, input, yaw, pitch = 0) {
    this.jumped = false;
    this.landedFallDistance = 0;
    const frameDt = Math.min(dt, MAX_FRAME_DT);
    this._heightAction(frameDt, input);
    this._acc = (this._acc ?? 0) + frameDt;
    while (this._acc >= FIXED_DT) {
      this._acc -= FIXED_DT;
      this._step(FIXED_DT, input, yaw, pitch);
    }
  }

  /** M3: the wall probe - CollisionFlags.Sides + GetClimbedWallInfo's
   *  capsule cast (:591), as two rays at 0.4h/0.8h along the wall
   *  direction (the latched ledge direction, else the facing), reach
   *  radius + 0.1. A hit latches myLedgeDirection = the horizontal
   *  -normal (:608), so turning the camera mid-climb keeps the hug on
   *  the WALL's plane, not the look. Documented departure: DFU reads
   *  the controller's side collision flags; the probe asks the same
   *  physical question against our collider. */
  _climbWallProbe(yaw) {
    // a facade collider without the ray API disables climbing rather
    // than crashing the step
    if (!this.collider.raycastHit) return { touching: false, wallDir: null };
    const dir = this._climbWallDir ?? [Math.sin(yaw), 0, Math.cos(yaw)];
    const reach = CAPSULE_RADIUS + 0.1;
    for (const frac of [0.4, 0.8]) {
      const o = [this.pos[0], this.pos[1] + this.height * frac, this.pos[2]];
      const h = this.collider.raycastHit(o, dir, reach);
      if (Number.isFinite(h.dist)) {
        if (h.normal) {
          const nx = -h.normal[0], nz = -h.normal[2];
          const l = Math.hypot(nx, nz);
          if (l > 1e-4) this._climbWallDir = [nx / l, 0, nz / l];
        }
        return { touching: true, wallDir: this._climbWallDir ?? dir };
      }
    }
    if (!this.climb.isClimbing) this._climbWallDir = null;   // the not-climbing cleanup (:483-486)
    return { touching: false, wallDir: null };
  }

  /** M3 CLIMBING: ClimbingCheck + the classic ClimbMovement arm
   *  (:754-764), per fixed step - DFU calls the check from the
   *  motor's own flow and early-returns while climbing (:319-326).
   *  Returns true when climbing owned this step's movement. */
  _climbStep(dt, input, yaw) {
    const climb = this.climb;
    if (!climb) return false;   // no deps, no ClimbingMotor component
    const forward = input.forward > 0;
    // the probe only runs when the machine could care (the abort
    // ladder short-circuits it away otherwise)
    const probe = (climb.isClimbing || forward || this.falling)
      ? this._climbWallProbe(yaw) : { touching: false, wallDir: null };
    const climbing = climb.step(dt, {
      forward,
      back: input.forward < 0,
      anyMove: input.forward !== 0 || input.strafe !== 0,
      falling: this.falling,
      grounded: this.grounded,
      levitating: this.levitating,
      riding: false,   // TransportManager.IsOnFoot - the transport arc pends
      touchingSides: probe.touching,
      horizontalPos: [this.pos[0], this.pos[2]],
      // ":318-320: ground directly below too close for climbing" -
      // from the capsule center, height/2 + 0.12 down
      tooCloseToGround: () => Number.isFinite(this.collider.raycast(
        [this.pos[0], this.pos[1] + this.height / 2, this.pos[2]], [0, -1, 0], this.height / 2 + 0.12)),
    });
    if (!climbing) return false;
    this.jumping = false;   // StartClimbing resets Jumping (:539)
    if (!climb.isSlipping) {
      // the hug: horizontal press at Speed (the STALE UpdateSpeed
      // field - the early return sits above UpdateSpeed, the same
      // quirk the swim path rides) + up at Speed/3. Falling stays
      // false with the fall anchor HERE - releasing the wall starts
      // any fall at the release height (acrobat.Falling = isSlipping).
      this.falling = false;
      this.fallStart = this.pos[1];
      this.velY = 0;
      const wd = probe.wallDir ?? [Math.sin(yaw), 0, Math.cos(yaw)];
      const r = this.collider.move(this.pos,
        wd[0] * this.speed * dt, climbingSpeed(this.speed) * dt, wd[2] * this.speed * dt,
        this.height, false);
      this.grounded = r.grounded;
    } else {
      // slipping: a plain gravity fall against the wall (:760-764).
      // The fall INIT anchors at the slip start; the landing is NOT
      // billed here - the machine sees slippedToGround next step,
      // stops, and the normal grounded bookkeeping bills the drop.
      if (!this.falling) { this.falling = true; this.fallStart = this.pos[1]; this.velY = 0; }
      this.velY -= GRAVITY * dt;
      const r = this.collider.move(this.pos, 0, this.velY * dt, 0, this.height);
      this.grounded = r.grounded;
      if (r.grounded) this.velY = 0;
    }
    return true;
  }

  _step(dt, input, yaw, pitch = 0) {
    // PlayerMotor.FixedUpdate: time the grounded state FIRST, every
    // frame (the swim/levitate early-return comes after in DFU too).
    this.groundedTime = this.grounded ? this.groundedTime + dt : 0;
    // M3 CLIMBING: the check + (while climbing) the movement - before
    // the swim/levitate branch, exactly DFU's order (:319-326; the
    // climb wins the step when active).
    if (this._climbStep(dt, input, yaw)) return;
    // (P12 crouch is decided and applied by _heightAction on the
    // RENDER frame, exactly as PlayerHeightChanger is.)
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // limitDiagonalSpeed, verbatim: .7071 when both axes are live.
    const factor = input.forward !== 0 && input.strafe !== 0 ? DIAGONAL_FACTOR : 1;

    if (this.levitating || this.swimming) {
      // LevitateMotor.Update: camera-directed movement, NO gravity.
      this.velY = 0;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      let mx = (sin * cp * input.forward - cos * input.strafe) * factor;
      let my = sp * input.forward * factor;
      let mz = (cos * cp * input.forward + sin * input.strafe) * factor;
      // Swimming without levitation: no vertical from the look
      // (AddMovement zeroes y unless a float key drives it).
      if (this.swimming && !this.levitating) my = 0;
      if (input.up) my += 1;
      else if (input.down) my -= 1;
      // AddMovement's THREE arms, in DFU's own order (LevitateMotor.cs
      // :116-140). AUDIT 24 player: the port had a different ladder -
      // levitation short-circuited the water-walking arm, and the
      // surface clamp was applied to a water-walking swimmer that DFU
      // returns above.
      let speed;
      if (this.swimming && this.waterWalking) {
        // ":116-122 - "Swimming with water walking on makes player move
        // at normal speed in water": moveSpeed is PlayerMotor.Speed,
        // the FIELD, and this arm RETURNS - no surface clamp, and it
        // wins over levitation. AUDIT 24 player: the port recomputed
        // the speed from the raw run input every step; the field is
        // frozen at its last GROUNDED value because FixedUpdate's
        // swim/levitate return (:322-326) sits above UpdateSpeed
        // (:335), so crouch, sneak and the grounded-only run latch are
        // all baked into it.
        speed = this.speed;
      } else if (this.swimming && !this.levitating) {
        // Cannot swim up out of the water ("he would immediately be
        // pulled back in"): rising stops when the controller CENTER
        // + 50*GlobalScale - 0.93 reaches the surface.
        // AUDIT 24 player: LevitateMotor.cs:126 reads
        // `controller.transform.position.y`, the centre of the LIVE
        // capsule - and ControllerHeightChange (PlayerHeightChanger.cs
        // :477-478) keeps the feet planted while the height changes, so
        // the centre is feet + controller.height/2. A free swimmer is
        // force-crouched (:192-198), so that is feet + 0.45, not the
        // standing feet + 0.9 this line used to hardcode: the swimmer
        // was pinned 0.45 below DFU's float height, eyes under water.
        if (my > 0 && this.waterSurfaceY != null
            && this.pos[1] + this.height / 2 + 50 * 0.025 - 0.93 >= this.waterSurfaceY) {
          my = 0;
        }
        speed = swimSpeed(walkSpeed(this.stats.speed), this.stats.swimming ?? 0);
      } else {
        // neither swim arm: the field's resting value, levitateMoveSpeed
        speed = LEVITATE_MOVE_SPEED;
      }
      // IsMovingLessThanHalfSpeed while swimming/levitating: DFU's
      // FixedUpdate zeroes moveDirection and RETURNS at :322-326,
      // above UpdateSpeed - so IsStandingStill is the grounded test
      // over a zero moveDirection, and the comparison runs against
      // the STALE land `speed`, never the swim speed computed here.
      this.movingLessThanHalfSpeed = this.grounded
        ? true
        : walkSpeed(this.stats.speed) / 2 >= this.speed;
      const r = this.collider.move(this.pos, mx * speed * dt, my * speed * dt, mz * speed * dt, this.height);
      this.groundKey = r.grounded ? (r.groundKey ?? null) : null;
      this.grounded = r.grounded;
      return;
    }

    // AcrobatMotor fall bookkeeping, in PlayerMotor.FixedUpdate's own
    // order: the grounded branch clears Jumping and LANDS a live fall
    // (CheckFallingDamage - the distance is reported to the host,
    // which applies the HP/sound laws); the airborne branch is
    // CheckInitFall (fall start = here; a non-jump fall begins its y
    // movement at 0). P14.
    if (this.grounded) {
      this.jumping = false;
      if (this.falling) {
        this.falling = false;
        this.landedFallDistance = this.fallStart - this.pos[1];
      }
    } else if (!this.falling) {
      this.falling = true;
      this.fallStart = this.pos[1];
      if (!this.jumping) this.velY = 0;
    }

    // ApplyInputSpeedAdjustment (P15): the run/sneak states re-latch
    // only while GROUNDED - "you can't switch running on/off while in
    // mid air" - and running beats sneaking.
    if (this.grounded) {
      this.isRunning = !!input.run;
      this.isSneaking = !this.isRunning && !!input.sneak;
    }
    // GetBaseSpeed + ApplyInputSpeedAdjustment (audit F1): walking
    // crouched = the crouch base; RUNNING crouched = GetRunSpeed's
    // crouch branch (crouch base x the run multiplier - DFU lets you
    // run while crouched); SNEAKING halves the walk/crouch base then
    // subtracts one classic speed unit (P15); none apply while
    // swimming (above).
    let speed;
    if (this.isRunning) {
      speed = runSpeed(this.stats.speed, this.stats.running, this.crouching);
    } else {
      speed = this.crouching ? crouchSpeed(this.stats.speed) : walkSpeed(this.stats.speed);
      if (this.isSneaking) speed = sneakSpeed(speed);
    }
    this.speed = speed;   // UpdateSpeed writes the field the getter reads
    this._trackHalfSpeed(input, speed);

    // fwd = (sin, 0, cos); camera-right = up x back per lookAt =
    // (-cos, 0, sin). Verified to NDC through view x projection: world
    // +x lands at NDC x < 0 (screen-LEFT), so screen-RIGHT is -cos =
    // this camera-right vector. D (strafe +1) rides it. (A prior
    // "fix" flipped this using view-space x WITHOUT the projection,
    // which perspective negates - it would have swapped A/D. Reverted.)
    // GROUNDED recomputes velocity from input; AIRBORNE keeps the
    // liftoff momentum verbatim (airControl false - see constructor).
    let vx, vz;
    if (this.grounded) {
      vx = (sin * input.forward - cos * input.strafe) * factor * speed;
      vz = (cos * input.forward + sin * input.strafe) * factor * speed;
    } else {
      vx = this._airVelX;
      vz = this._airVelZ;
    }

    // HandleJumpInput, verbatim gates: 0.1 s of grounded time (the
    // bunny-hop gate - a HELD jump re-fires each landing past it, as
    // classic), slowfall cancels outright; the boost multiplier is
    // the scene's jumpSpeedMultiplier (Jumping skill; athleticism +
    // jump spell pend); crouched jumps scale by crouchingJumpDelta;
    // a MOVING jump adds forward * jumpSpeed * 0.05 of momentum.
    if (this.grounded && input.jump && this.groundedTime >= GROUNDED_JUMP_GATE_S && !this.slowFalling) {
      this.velY = JUMP_SPEED * (this.jumpBoost ? this.jumpBoost() : 1);
      if (this.crouching) this.velY *= CROUCH_JUMP_DELTA;
      if (input.forward !== 0 || input.strafe !== 0) {
        vx += sin * JUMP_SPEED * JUMP_FWD_BOOST;
        vz += cos * JUMP_SPEED * JUMP_FWD_BOOST;
      }
      this.grounded = false;
      this.groundedTime = 0;
      this.jumping = true;
      this.jumped = true;   // P11: the fatigue/tally consumer reads this frame flag
    }
    this._airVelX = vx;
    this._airVelZ = vz;

    // ApplyGravity: slowfall is a CONSTANT -105 * dt fall speed with
    // fallStart re-anchored every tick (expiry mid-fall only bills
    // the rest of the drop); otherwise integrate normally.
    if (!this.grounded) {
      if (this.slowFalling && this.falling) {
        this.fallStart = this.pos[1];
        this.velY = -SLOWFALL_SPEED * dt;
      } else {
        this.velY -= GRAVITY * dt;
      }
    } else this.velY = Math.min(this.velY, 0);
    const dy = this.velY * dt;

    // Snap is withheld while `jumping` (AcrobatMotor's Jumping: set at
    // takeoff, cleared on the next grounded frame) so the ballistic
    // descent integrates instead of teleporting onto the floor probe.
    const r = this.collider.move(this.pos, vx * dt, dy, vz * dt, this.height, !this.jumping);
    this.groundKey = r.grounded ? (r.groundKey ?? null) : null;   // platform riding: what holds us up
    this.grounded = r.grounded;
    if (r.grounded && this.velY < 0) this.velY = 0;
    // HitHead, verbatim: rising into a ceiling REVERSES the vertical
    // (DFU bounces the jump downward, not a zero-stop).
    if (r.hitCeiling && this.velY > 0) this.velY = -this.velY;
  }
}
