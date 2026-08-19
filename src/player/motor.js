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
export const DF_WALK_BASE = 150;
export const DF_CROUCH_BASE = 50;
export const JUMP_SPEED = 4.5;
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
  constructor(collider, stats = { speed: 50, running: 30, swimming: 30 }, { jumpBoost = null } = {}) {
    this.collider = collider;
    this.stats = stats;
    this.jumpBoost = jumpBoost;    // () => AcrobatMotor jumpSpeedMultiplier (systems/skills owns the formula)
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
    return [this.pos[0], this.pos[1] + (this.crouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT), this.pos[2]];
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
    const standing = this.grounded && !input.forward && !input.strafe && !input.up && !input.down;
    if (standing) { this.movingLessThanHalfSpeed = true; return; }
    // Crouched compares GetWalkSpeed/2; the else compares
    // GetBaseSpeed/2, and GetBaseSpeed NOT crouched is the same
    // dragged walk - both DFU branches collapse to walk/2 here.
    this.movingLessThanHalfSpeed = walkSpeed(this.stats.speed) / 2 >= appliedSpeed;
  }

  /** PlayerHeightChanger.DecideHeightAction + PlayerHeightChanger
   *  .Update, both of which run on the RENDER frame in DFU.
   *  DecideHeightAction TOGGLES the pending action off the Crouch
   *  press (:174-181); Update applies DoCrouch unconditionally and
   *  DoStand only while CanStand() passes (:223-226), a blocked stand
   *  falling through to the do-nothing DoDismount that clears the
   *  action once camTimer >= timerMax. camTimer is reset ONLY by
   *  timerResetAction, so re-pressing during a blocked stand-up does
   *  not extend the window.
   *  (The 0.10 s controller/camera LERP itself is not ported - our
   *  height change is instant; Ledger row 139 residue.) */
  _heightAction(dt, input) {
    if (input.crouch) this.heightAction = this.crouching ? 'stand' : 'crouch';
    if (this.heightAction === 'crouch') {
      this.crouching = true;
      this.heightAction = null;
      this.heightTimer = 0;
    } else if (this.heightAction === 'stand') {
      // CanStand: the STANDING capsule must fit at the current feet.
      if (this.collider.penetrationAt(this.pos, CAPSULE_HEIGHT) < 0.03) {
        this.crouching = false;
        this.heightAction = null;
        this.heightTimer = 0;
      } else {
        this.heightTimer += dt;
        if (this.heightTimer >= HEIGHT_TIMER_FAST) {
          this.heightAction = null;
          this.heightTimer = 0;
        }
      }
    }
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

  _step(dt, input, yaw, pitch = 0) {
    // PlayerMotor.FixedUpdate: time the grounded state FIRST, every
    // frame (the swim/levitate early-return comes after in DFU too).
    this.groundedTime = this.grounded ? this.groundedTime + dt : 0;
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
      // Cannot swim up out of the water ("he would immediately be
      // pulled back in"): rising stops when the controller CENTER
      // (feet + 0.9) + 50*GlobalScale - 0.93 reaches the surface.
      if (this.swimming && !this.levitating && my > 0 && this.waterSurfaceY != null
          && this.pos[1] + 0.9 + 50 * 0.025 - 0.93 >= this.waterSurfaceY) {
        my = 0;
      }
      let speed;
      if (this.levitating) speed = LEVITATE_MOVE_SPEED;
      else if (this.waterWalking) {
        // S8 waterWalking consumer: normal speed in water.
        speed = input.run ? runSpeed(this.stats.speed, this.stats.running) : walkSpeed(this.stats.speed);
      } else {
        speed = swimSpeed(walkSpeed(this.stats.speed), this.stats.swimming ?? 0);
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

    const r = this.collider.move(this.pos, vx * dt, dy, vz * dt, this.height);
    this.groundKey = r.grounded ? (r.groundKey ?? null) : null;   // platform riding: what holds us up
    this.grounded = r.grounded;
    if (r.grounded && this.velY < 0) this.velY = 0;
    // HitHead, verbatim: rising into a ceiling REVERSES the vertical
    // (DFU bounces the jump downward, not a zero-stop).
    if (r.hitCeiling && this.velY > 0) this.velY = -this.velY;
  }
}
