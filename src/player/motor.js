// First-person player motor. Speed formulas, gravity, jump, and capsule
// dimensions are 1:1 with Daggerfall Unity's PlayerSpeedChanger /
// AcrobatMotor / PlayerAdvanced controller (MIT, Daggerfall Workshop):
//   - classicToUnitySpeedUnitRatio 39.5 (Allofich's measurement),
//     dfWalkBase 150, dfCrouchBase 50.
//   - Walk = (LiveSpeed + 150) / 39.5; Run = walk * (1.35 +
//     RunningSkill / 200); Crouch = (LiveSpeed + 50) / 39.5;
//     Sneak = speed / 2 - 1 / 39.5.
//   - jumpSpeed 4.5, gravity 20 (AcrobatMotor defaults).
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

/**
 * Grounded first-person motor. Feeds a wish direction to the collider
 * and integrates AcrobatMotor-style vertical motion.
 */
export class PlayerMotor {
  constructor(collider, stats = { speed: 50, running: 30 }) {
    this.collider = collider;
    this.stats = stats;
    this.pos = new Float32Array(3); // FEET position
    this.velY = 0;
    this.grounded = false;
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
   * @param {{forward:number,strafe:number,run:boolean,jump:boolean}} input
   * @param {number} yaw camera yaw (fwd = (sin, 0, cos))
   */
  update(dt, input, yaw) {
    const speed = input.run
      ? runSpeed(this.stats.speed, this.stats.running)
      : walkSpeed(this.stats.speed);

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // fwd = (sin, 0, cos); camera-right = up x back per lookAt =
    // (-cos, 0, sin). Verified to NDC through view x projection: world
    // +x lands at NDC x < 0 (screen-LEFT), so screen-RIGHT is -cos =
    // this camera-right vector. D (strafe +1) rides it. (A prior
    // "fix" flipped this using view-space x WITHOUT the projection,
    // which perspective negates - it would have swapped A/D. Reverted.)
    let dx = (sin * input.forward - cos * input.strafe) * speed * dt;
    let dz = (cos * input.forward + sin * input.strafe) * speed * dt;

    if (this.grounded && input.jump) {
      this.velY = JUMP_SPEED;
      this.grounded = false;
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
