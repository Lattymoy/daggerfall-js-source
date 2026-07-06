// Enemy senses + pursuit (C8 E2). Verbatim port of the CLASSIC path
// (EnhancedCombatAI = false) from DFU EnemyMotor.cs / EnemySenses.cs /
// EnemyAttack.cs (MIT, Daggerfall Workshop):
//   - sight = 4096 * MeshReader.GlobalScale, FOV 180, hearing 25
//   - senses re-evaluate when the classic system timer (dt divided by
//     0.0549254, the 0x46C memory-timer divisor) accumulates past 5
//   - decisions gate on the CLASSIC UPDATE (0.0625s); classic turns IN
//     PLACE at 11.25 deg/update (DFU raises to 20 for its agile player;
//     we keep classic per doctrine) behind the 5.625 deg move yaw-gate
//   - moveSpeed = (LiveSpeed + dfWalkBase 150) * GlobalScale - "Monster
//     speed of movement follows the same formula as for when the
//     player walks"
//   - classic stop distance vs the player = MeleeDistance 2.25
//     (vs other AI 1.5); "Classic always moves in for attack", never
//     strafes or backs away
// Departures (documented): eye height = feet + height * 5/6 (DFU:
// transform.position + controller.center + height/3 under Unity CC
// conventions); LOS raycasts the level collider only (entities are
// not solid in it), so "seen" = an unobstructed ray to the target eye
// - open swing doors are transparent for free because opening removes
// their collider bucket (the C3/actionSystem rule). SightModifier /
// HearingModifier are 0 for every entry in current DFU master.
// PENDING E3 (entity layer): per-enemy LiveSpeed from career stats -
// until then callers pass liveSpeed explicitly (class-enemy stub 50,
// flagged at the call site); stealth checks in detection.

import { GLOBAL_SCALE } from '../world/meshReader.js';
import { GRAVITY } from '../player/motor.js';   // the shared fall rule

export const SIGHT_RADIUS = 4096 * GLOBAL_SCALE;
export const HEARING_RADIUS = 25;
export const FIELD_OF_VIEW = 180;                    // deg
export const MELEE_DISTANCE = 2.25;
export const CLASSIC_MELEE_DISTANCE_VS_AI = 1.5;
export const CLASSIC_TURN_DEG = 11.25;               // per classic update
export const CLASSIC_UPDATE_INTERVAL = 0.0625;       // s
export const SYSTEM_TIMER_UPDATES_DIVISOR = 0.0549254;
export const SENSES_INTERVAL_UNITS = 5;              // classicTargetUpdateTimer > 5
export const MOVE_YAW_GATE_DEG = 5.625;
export const DF_WALK_BASE = 150;
export const EYE_FRAC = 5 / 6;

export const enemyMoveSpeed = (liveSpeed) => (liveSpeed + DF_WALK_BASE) * GLOBAL_SCALE;

const DEG = Math.PI / 180;
const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Yaw of a horizontal direction in the engine convention fwd = (sin, 0, cos). */
export const yawOf = (dx, dz) => Math.atan2(dx, dz);

/** Within `deg` of facing dir? (TargetIsWithinYawAngle) */
export function withinYaw(yaw, dx, dz, deg) {
  return Math.abs(norm(yawOf(dx, dz) - yaw)) <= deg * DEG;
}

/** Classic in-place turn: rotate toward dir, clamped to maxDeg. Returns the new yaw. */
export function turnTowards(yaw, dx, dz, maxDeg = CLASSIC_TURN_DEG) {
  const d = norm(yawOf(dx, dz) - yaw);
  const step = maxDeg * DEG;
  return norm(yaw + Math.max(-step, Math.min(step, d)));
}

/**
 * Verbatim CanSeeTarget: range gate, FOV gate against facing, then an
 * eye-to-eye LOS ray against the level collider.
 */
export function canSeeTarget(collider, feet, yaw, height, targetFeet, targetHeight = 1.8) {
  const dx = targetFeet[0] - feet[0], dz = targetFeet[2] - feet[2];
  const dist = Math.hypot(dx, targetFeet[1] - feet[1], dz);
  if (dist >= SIGHT_RADIUS) return false;
  if (!withinYaw(yaw, dx, dz, FIELD_OF_VIEW / 2)) return false;
  const eye = [feet[0], feet[1] + height * EYE_FRAC, feet[2]];
  const tEye = [targetFeet[0], targetFeet[1] + targetHeight * EYE_FRAC, targetFeet[2]];
  const ex = tEye[0] - eye[0], ey = tEye[1] - eye[1], ez = tEye[2] - eye[2];
  const el = Math.hypot(ex, ey, ez) || 1;
  const hit = collider.raycast(eye, [ex / el, ey / el, ez / el], Math.min(SIGHT_RADIUS, el));
  return !Number.isFinite(hit) || hit >= el - 1e-3;
}


/**
 * Per-foe classic AI: senses on the system timer, decisions on the
 * classic update, movement applied continuously at the decided state.
 */
export class EnemyAI {
  constructor(collider, feet, yawRad, { liveSpeed = 50, height = 1.8 } = {}) {
    this.collider = collider;
    this.feet = [feet[0], feet[1], feet[2]];
    this.yaw = yawRad;
    this.height = height;
    this.speed = enemyMoveSpeed(liveSpeed);
    this.velY = 0;
    this.detected = false;
    this.inSight = false;
    this.moving = false;
    this._classicTimer = 0;
    this._dist = Infinity;
  }

  _senses(playerFeet) {
    const dx = playerFeet[0] - this.feet[0], dz = playerFeet[2] - this.feet[2];
    this._dist = Math.hypot(dx, playerFeet[1] - this.feet[1], dz);
    this.inSight = canSeeTarget(this.collider, this.feet, this.yaw, this.height, playerFeet);
    const heard = this._dist < HEARING_RADIUS;
    this.detected = this.inSight || heard;
  }

  _classicTick(playerFeet) {
    if (!this.detected) { this.moving = false; return; }
    const dx = playerFeet[0] - this.feet[0], dz = playerFeet[2] - this.feet[2];
    // classic stop: MeleeDistance vs the player; always moves in for attack
    if (this._dist <= MELEE_DISTANCE) {
      this.moving = false;
      if (!withinYaw(this.yaw, dx, dz, MOVE_YAW_GATE_DEG)) this.yaw = turnTowards(this.yaw, dx, dz);
      return;
    }
    if (!withinYaw(this.yaw, dx, dz, MOVE_YAW_GATE_DEG)) {
      this.yaw = turnTowards(this.yaw, dx, dz);
      this.moving = false;   // classic turns in place
      return;
    }
    this.moving = true;
  }

  update(dt, playerFeet) {
    // DFU recomputes distance/sight every Update; only classic TARGET
    // SWITCHING rides the 5-unit system timer (single-target here, so
    // that timer has nothing to switch - constants stay exported for
    // E3 multi-target). Senses + decisions both run at the classic
    // update rate.
    this._classicTimer += dt;
    while (this._classicTimer >= CLASSIC_UPDATE_INTERVAL) {
      this._classicTimer -= CLASSIC_UPDATE_INTERVAL;
      this._senses(playerFeet);
      this._classicTick(playerFeet);
    }
    // continuous movement at the decided state, grounded via the SAME
    // capsule contract the player walks on
    this.velY -= GRAVITY * dt;
    const dy = this.velY * dt;
    const dxm = this.moving ? Math.sin(this.yaw) * this.speed * dt : 0;
    const dzm = this.moving ? Math.cos(this.yaw) * this.speed * dt : 0;
    const r = this.collider.move(this.feet, dxm, dy, dzm);
    if (r.grounded) this.velY = 0;
  }
}
