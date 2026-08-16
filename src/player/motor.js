// First-person player motor. Speed formulas, gravity, jump, and capsule
// dimensions are 1:1 with Daggerfall Unity's PlayerSpeedChanger /
// AcrobatMotor / PlayerAdvanced controller (MIT, Daggerfall Workshop):
//   - classicToUnitySpeedUnitRatio 39.5 (Allofich's measurement),
//     dfWalkBase 150, dfCrouchBase 50.
//   - Walk = (LiveSpeed + 150) / 39.5; Run = walk * (1.35 +
//     RunningSkill / 200); Crouch = (LiveSpeed + 50) / 39.5;
//     Sneak = speed / 2 - 1 / 39.5.
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
export const GROUNDED_JUMP_GATE_S = 0.1;   // AcrobatMotor: "grounded for long enough" before a jump
export const GRAVITY = 20.0;
export const CAPSULE_HEIGHT = 1.8;
export const CAPSULE_RADIUS = 0.35;
export const STEP_OFFSET = 0.5;
export const SLOPE_LIMIT_DEG = 70;
export const EYE_HEIGHT = 1.7;

export function walkSpeed(liveSpeed) {
  return (liveSpeed + DF_WALK_BASE) / CLASSIC_TO_UNITY_RATIO;
}

export function runSpeed(liveSpeed, runningSkill) {
  return walkSpeed(liveSpeed) * (1.35 + runningSkill / 200);
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
    this.jumpBoost = jumpBoost;   // () => AcrobatMotor jumpSpeedMultiplier (systems/skills.jumpSpeedMultiplier)
    this.groundedTime = 0;
    this.pos = new Float32Array(3); // FEET position
    this.velY = 0;
    this.grounded = false;
    // P11 modes (the scene owns the toggles): swimming rides the
    // block water level; levitating rides the Levitate effect;
    // waterWalking (S8) restores normal speed in water.
    this.swimming = false;
    this.levitating = false;
    this.waterWalking = false;
    this.waterSurfaceY = null;   // the current block's water surface (world y), null when dry
    this.jumped = false;         // set for the frame a jump actually starts (fatigue/tally consumer)
  }

  get eye() {
    return [this.pos[0], this.pos[1] + EYE_HEIGHT, this.pos[2]];
  }

  spawn(x, y, z) {
    this.pos[0] = x;
    this.pos[1] = y;
    this.pos[2] = z;
    this.velY = 0;
    this.grounded = false;
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
  update(dt, input, yaw, pitch = 0) {
    this.jumped = false;
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
      const r = this.collider.move(this.pos, mx * speed * dt, my * speed * dt, mz * speed * dt);
      this.groundKey = r.grounded ? (r.groundKey ?? null) : null;
      this.grounded = r.grounded;
      return;
    }

    const speed = input.run
      ? runSpeed(this.stats.speed, this.stats.running)
      : walkSpeed(this.stats.speed);

    // fwd = (sin, 0, cos); camera-right = up x back per lookAt =
    // (-cos, 0, sin). Verified to NDC through view x projection: world
    // +x lands at NDC x < 0 (screen-LEFT), so screen-RIGHT is -cos =
    // this camera-right vector. D (strafe +1) rides it. (A prior
    // "fix" flipped this using view-space x WITHOUT the projection,
    // which perspective negates - it would have swapped A/D. Reverted.)
    let dx = (sin * input.forward - cos * input.strafe) * factor * speed * dt;
    let dz = (cos * input.forward + sin * input.strafe) * factor * speed * dt;

    // Verbatim AcrobatMotor.HandleJumpInput (2026-08-16 stairs/jump
    // audit): the jump fires only after 0.1 s of grounded time (the
    // bunny-hop gate) and scales by jumpSpeed * multiplier - the
    // multiplier (1 + JumpingSkill * 0.5 / 100, + athleticism/jump
    // spell) comes from the scene through jumpBoost (systems/skills
    // owns the formula; the engine layer stays entity-free).
    this.groundedTime = this.grounded ? (this.groundedTime ?? 0) + dt : 0;
    if (this.grounded && input.jump && this.groundedTime >= GROUNDED_JUMP_GATE_S) {
      this.velY = JUMP_SPEED * (this.jumpBoost ? this.jumpBoost() : 1);
      this.grounded = false;
      this.groundedTime = 0;
      this.jumped = true;   // P11: the fatigue/tally consumer reads this frame flag
    }
    if (!this.grounded) this.velY -= GRAVITY * dt * (this.fallScale ?? 1);   // S8: slowfall sets fallScale
    else this.velY = Math.min(this.velY, 0);
    const dy = this.velY * dt;

    const r = this.collider.move(this.pos, dx, dy, dz);
    this.groundKey = r.grounded ? (r.groundKey ?? null) : null;   // platform riding: what holds us up
    this.grounded = r.grounded;
    if (r.grounded && this.velY < 0) this.velY = 0;
    if (r.hitCeiling && this.velY > 0) this.velY = 0;
  }
}
