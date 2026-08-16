// First-person player motor. Speed formulas, gravity, jump, and capsule
// dimensions are 1:1 with Daggerfall Unity's PlayerSpeedChanger /
// AcrobatMotor / PlayerAdvanced controller (MIT, Daggerfall Workshop):
//   - classicToUnitySpeedUnitRatio 39.5 (Allofich's measurement),
//     dfWalkBase 150, dfCrouchBase 50.
//   - Walk = (LiveSpeed + 150 - drag) / 39.5 where drag = 0.5 x
//     (100 - max(30, LiveSpeed)) (audit 2026-08-16e F1 - the drag
//     term was missing); Run = UNDRAGGED base x (1.35 + Running/200)
//     with the crouch base while crouched; Crouch = (LiveSpeed + 50)
//     / 39.5; Sneak = speed / 2 - 1 / 39.5 (input pends).
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
    // P13: PlayerMotor.IsMovingLessThanHalfSpeed - the stealth
    // sneak condition, recomputed each update from the frame's input.
    this.movingLessThanHalfSpeed = true;
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
   *  (GetBaseSpeed - the crouch/walk selection without run). With no
   *  sneak input yet (pends), plain walking never qualifies - the
   *  gate is standing still, exactly as classic feels without Sneak. */
  _trackHalfSpeed(input, appliedSpeed) {
    const standing = !input.forward && !input.strafe && !input.up && !input.down;
    if (standing) { this.movingLessThanHalfSpeed = true; return; }
    // Crouched compares GetWalkSpeed/2; the else compares
    // GetBaseSpeed/2, and GetBaseSpeed NOT crouched is the same
    // dragged walk - both DFU branches collapse to walk/2 here.
    this.movingLessThanHalfSpeed = walkSpeed(this.stats.speed) / 2 >= appliedSpeed;
  }

  update(dt, input, yaw, pitch = 0) {
    this.jumped = false;
    this.landedFallDistance = 0;
    // PlayerMotor.FixedUpdate: time the grounded state FIRST, every
    // frame (the swim/levitate early-return comes after in DFU too).
    this.groundedTime = this.grounded ? this.groundedTime + dt : 0;
    // P12 crouch toggle (edge input; the scene owns the key edge).
    // Standing back up needs headroom: the STANDING capsule must fit
    // at the current feet (PlayerHeightChanger's CanStand probe) -
    // blocked under a low ceiling, the player stays crouched.
    if (input.crouch) {
      if (this.crouching) {
        if (this.collider.penetrationAt(this.pos, CAPSULE_HEIGHT) < 0.03) this.crouching = false;
      } else {
        this.crouching = true;
      }
    }
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
      this._trackHalfSpeed(input, speed);
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

    // GetBaseSpeed + ApplyInputSpeedAdjustment (audit F1): walking
    // crouched = the crouch base; RUNNING crouched = GetRunSpeed's
    // crouch branch (crouch base x the run multiplier - DFU lets you
    // run while crouched); neither applies while swimming (above).
    const speed = this.crouching
      ? (input.run ? runSpeed(this.stats.speed, this.stats.running, true) : crouchSpeed(this.stats.speed))
      : input.run
        ? runSpeed(this.stats.speed, this.stats.running)
        : walkSpeed(this.stats.speed);
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
