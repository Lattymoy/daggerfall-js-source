// @ts-check
// HORSE CART AND CARGO - THE FOLLOWING (HCC, 2026-09-23): `HorseFollowPath`, `HorseFollowController`, the wagon's
// trail and the grounded pose, read off TrailingWagon.dll's IL (vendor/horse-cart-and-cargo/il/). The mod's horse
// walks a breadcrumb path the player leaves (horizontal, 0.08 m samples, 45 m kept), stays `followDistance`
// behind, speeds up to catch up, steps around obstacles by seven detour angles with a sphere cast, keeps to a
// step's height change, recovers when stuck, and - with the setting on - evades hostile foes that have the player
// as their target, on rings of grounded candidates. The trailing wagon keeps a 3-D trail of its own (0.08 m,
// 7 m kept, 2.5 m behind) and settles onto the ground's normal one metre up, smoothed. Everything here is pure
// over a physics seam the host implements:
//
//   phys = { now() (unscaled seconds), raycastAll(origin, dir, maxDist) -> [{ point, distance, normal }],
//            sphereCastClear(origin, radius, dir, distance) -> bool, threats() -> [[x,y,z], ...] }
//
// `raycastAll` answers every surface along the ray as Unity's Physics.RaycastAll does over the static world (the
// port's collider holds no bodies, so the mod's IsIgnoredCollider - the horse's own root, the player, rigidbodies,
// character controllers - has nothing to reject; its trigger exclusion is the collider's own, which holds none).
// The visual the controller drives is the pool's StationaryHorseVisual (scenes/horseCartPool.js):
//   { isInteractive, tryGetGroundedPose() -> { position, forward } | null, applyFollowingPose(pos, fwd, speed) }

import {
  MATHF_EPSILON, V_FORWARD, V_ZERO, horizontalDistance, vsub, vadd, vscale, vdot, vlerp, vdist, vsqr, vnorm,
  pickGround, horizontalForward, WAGON_FOLLOW_DISTANCE, SAMPLE_DISTANCE, RETAINED_TRAIL_DISTANCE, TELEPORT_DISTANCE,
  MAXIMUM_VISUAL_DISTANCE, GROUND_RAY_HEIGHT, GROUND_RAY_DISTANCE, NORMAL_GROUND_OFFSET, POSITION_SMOOTHING_RATE,
  ROTATION_SMOOTHING_RATE,
} from './horseCartLaw.js';
import { quatLookRotation, quatSlerp, quatForward } from '../world/quat.js';

// ─── CONSTANTS (HorseFollowController's, from the metadata Constant table) ─────────────────────────────────────
export const CATCH_UP_START_DISTANCE = 6.0, STRONG_CATCH_UP_DISTANCE = 12.0;
export const THREAT_CLEARANCE = 15.0;           // compared squared: 225
export const COMBAT_CLEAR_DELAY = 3.0, COMBAT_SCAN_INTERVAL = 0.25, COMBAT_TARGET_REFRESH = 0.4;
export const STUCK_TIMEOUT = 4.5, RECOVERY_MIN_SEPARATION = 8.0, PROGRESS_DISTANCE = 0.5, RECOVERY_TRAIL_DISTANCE = 6.0;
export const STOP_TARGET_DISTANCE = 0.18;
export const GENTLE_SPEED = 1.25, NORMAL_SPEED = 2.8, CATCH_UP_SPEED = 5.0, STRONG_CATCH_UP_SPEED = 7.0, EVASION_SPEED = 6.0;
export const FOLLOW_GROUND_PROBE_HEIGHT = 8.0, FOLLOW_GROUND_PROBE_DISTANCE = 40.0;
export const MAXIMUM_STEP_HEIGHT_CHANGE = 1.5, BODY_PROBE_HEIGHT = 0.9, BODY_PROBE_RADIUS = 0.35;
export const EVADE_COMFORT_DISTANCE = 8.0;
export const ACCEL_MIN_CATCH_UP = 2.0, ACCEL_MAX_CATCH_UP = 12.0, ACCEL_CATCH_UP_GAIN = 0.75, ACCEL_MAX_SUBSTEP = 1.25, ACCEL_MAX_SUBSTEPS = 16;
/** The seven detour angles [static float[7]] and the six evade rings [static float[6]] (FieldRVA blobs). */
export const DETOUR_ANGLES = Object.freeze([0, 30, -30, 60, -60, 90, -90]);
export const EVADE_RINGS = Object.freeze([6, 10, 15, 20, 25, 30]);
/** HorseFollowPath's. */
export const PATH_SAMPLE_DISTANCE = 0.08, PATH_RETAINED_DISTANCE = 45.0, PATH_DISCONTINUITY_DISTANCE = 20.0;
/** Seed's first point stands 4 m behind (an inline literal). */
export const PATH_SEED_BEHIND = 4.0;

const normalizeHorizontal = (v) => { const p = [v[0], 0, v[2]]; return vsqr(p) <= MATHF_EPSILON ? [...V_FORWARD] : vnorm(p); };
const rotateY = (v, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };   // Quaternion.AngleAxis(deg, up) * v

// ─── HorseFollowPath ───────────────────────────────────────────────────────────────────────────────────────────

export class HorseFollowPath {
  constructor() { this.points = []; this.lastPlayerPosition = [...V_ZERO]; this.hasLastPlayerPosition = false; }
  get count() { return this.points.length; }
  /** The floating origin moved the scene (Unity's FloatingOrigin moves every transform; the port's hosts shift by hand). */
  offset(d) { for (const p of this.points) { p[0] += d[0]; p[1] += d[1]; p[2] += d[2]; } if (this.hasLastPlayerPosition) { this.lastPlayerPosition[0] += d[0]; this.lastPlayerPosition[1] += d[1]; this.lastPlayerPosition[2] += d[2]; } }
  /** Clear [IL_2a47]. */
  clear() { this.points.length = 0; this.hasLastPlayerPosition = false; this.lastPlayerPosition = [...V_ZERO]; }
  /** Seed(player, forward) [IL_2a74]: a point 4 m behind and the player. */
  seed(playerPosition, playerForward) {
    const f = normalizeHorizontal(playerForward);
    this.points.length = 0;
    this.points.push(vsub(playerPosition, vscale(f, PATH_SEED_BEHIND)));
    this.points.push([...playerPosition]);
    this.lastPlayerPosition = [...playerPosition]; this.hasLastPlayerPosition = true;
  }
  /** Seed(leader, leaderForward, trailing) [IL_2abf]: the trailing point then the leader (the forward is normalised and unused). */
  seedBehind(leaderPosition, leaderForward, trailingPosition) {
    normalizeHorizontal(leaderForward);
    this.points.length = 0;
    this.points.push([...trailingPosition]);
    this.points.push([...leaderPosition]);
    this.lastPlayerPosition = [...leaderPosition]; this.hasLastPlayerPosition = true;
  }
  /** Record [IL_2b08]: a jump past 20 m re-seeds (false); a step under 0.08 m is not a sample (true). */
  record(playerPosition, playerForward) {
    if (this.hasLastPlayerPosition && horizontalDistance(playerPosition, this.lastPlayerPosition) > PATH_DISCONTINUITY_DISTANCE) { this.seed(playerPosition, playerForward); return false; }
    this.lastPlayerPosition = [...playerPosition];
    if (this.points.length === 0) { this.seed(playerPosition, playerForward); return false; }
    if (horizontalDistance(playerPosition, this.points[this.points.length - 1]) < PATH_SAMPLE_DISTANCE) return true;
    this.points.push([...playerPosition]);
    this.prune();
    return true;
  }
  /** TryGetPointBehind [IL_2b94]: walk back from the player along the path `desiredDistance` (horizontal); the
   *  forward is the direction of travel there. Past the oldest point, that point and the path's first segment. */
  tryGetPointBehind(currentPlayerPosition, desiredDistance) {
    if (this.points.length < 2) return null;
    if (desiredDistance < 0) return null;
    let accumulated = 0, cursor = [...currentPlayerPosition];
    for (let i = this.points.length; i > 0; i--) {
      const p = this.points[i - 1];
      const seg = [cursor[0] - p[0], 0, cursor[2] - p[2]];
      const len = Math.sqrt(vsqr(seg));
      if (len <= MATHF_EPSILON) { cursor = p; continue; }
      if (accumulated + len >= desiredDistance) {
        const remaining = desiredDistance - accumulated;
        return { target: vlerp(cursor, p, remaining / len), pathForward: vscale(seg, 1 / len) };
      }
      accumulated += len; cursor = p;
    }
    return { target: [...this.points[0]], pathForward: normalizeHorizontal(vsub(this.points[1], this.points[0])) };
  }
  /** Prune [IL_2c9c]: keep 45 m of path back from the newest point. */
  prune() {
    let retained = 0, removeCount = this.points.length - 1;
    for (let i = this.points.length - 1; i > 0; i--) {
      retained += horizontalDistance(this.points[i], this.points[i - 1]);
      removeCount = i - 1;
      if (retained >= PATH_RETAINED_DISTANCE) break;
    }
    if (removeCount > 0) this.points.splice(0, removeCount);
  }
}

// ─── HorseFollowController ─────────────────────────────────────────────────────────────────────────────────────

/** CalculateSpeed [IL_28b4]: stop within 0.18 m; evading 6; 7 past 12 m from the player; 5..7 between 6 and 12;
 *  else 1.25..2.8 by how far the target still is against the follow distance. */
export function calculateFollowSpeed(targetDistance, playerDistance, evading, followDistance) {
  if (targetDistance <= STOP_TARGET_DISTANCE) return 0;
  if (evading) return EVASION_SPEED;
  if (playerDistance >= STRONG_CATCH_UP_DISTANCE) return STRONG_CATCH_UP_SPEED;
  if (playerDistance >= CATCH_UP_START_DISTANCE) {
    const t = Math.max(0, Math.min(1, (playerDistance - CATCH_UP_START_DISTANCE) / (STRONG_CATCH_UP_DISTANCE - CATCH_UP_START_DISTANCE)));
    return CATCH_UP_SPEED + (STRONG_CATCH_UP_SPEED - CATCH_UP_SPEED) * t;
  }
  const t = Math.max(0, Math.min(1, targetDistance / Math.max(0.01, followDistance)));
  return GENTLE_SPEED + (NORMAL_SPEED - GENTLE_SPEED) * t;
}
/** CalculateObservedPlayerSpeed [IL_2008]. */
export const observedPlayerSpeed = (previous, current, dt, continuous) => (!continuous || dt <= MATHF_EPSILON ? 0 : horizontalDistance(previous, current) / dt);
/** CalculateAcceleratedFollowSpeed [IL_2030]: under Travel Options' accelerated journey the horse matches the
 *  player's speed plus a catch-up of 2 + 0.75 x the excess distance, 2..12. */
export function acceleratedFollowSpeed(ordinarySpeed, playerSpeed, playerDistance, followDistance) {
  if (playerSpeed <= MATHF_EPSILON) return ordinarySpeed;
  const excess = Math.max(0, playerDistance - followDistance);
  const catchUp = Math.max(ACCEL_MIN_CATCH_UP, Math.min(ACCEL_MAX_CATCH_UP, ACCEL_MIN_CATCH_UP + excess * ACCEL_CATCH_UP_GAIN));
  return Math.max(ordinarySpeed, playerSpeed + catchUp);
}
/** ShouldEnterCombatEvasion [IL_2070] / IsQualifyingThreatState [IL_1fe0] (the host's foe pool answers the five). */
export const shouldEnterCombatEvasion = (avoidanceEnabled, qualifyingThreatCount) => avoidanceEnabled && qualifyingThreatCount > 0;
export const isQualifyingThreatState = (isEnemy, hostile, playerAlly, targetsPlayer, detected) => isEnemy && hostile && !playerAlly && targetsPlayer && detected;

/** TryFindGround [IL_2088]: from 8 m up, 40 m down, the surface nearest the requested height. */
export function tryFindGround(phys, requested) {
  const hits = phys.raycastAll(vadd(requested, [0, FOLLOW_GROUND_PROBE_HEIGHT, 0]), [0, -1, 0], FOLLOW_GROUND_PROBE_DISTANCE);
  const best = pickGround(hits, requested[1]);
  return best ? [...best.point] : null;
}
/** IsStepClear [IL_2778]: a 0.35 sphere from 0.9 up, swept `distance + 0.05` along the direction, meets nothing. */
export const isStepClear = (phys, start, direction, distance) => phys.sphereCastClear(vadd(start, [0, BODY_PROBE_HEIGHT, 0]), BODY_PROBE_RADIUS, direction, distance + 0.05);
/** IsDirectPathClear [IL_27ec]. */
export function isDirectPathClear(phys, start, end) {
  const d = [end[0] - start[0], 0, end[2] - start[2]];
  const len = Math.sqrt(vsqr(d));
  if (len <= MATHF_EPSILON) return true;
  return isStepClear(phys, start, vscale(d, 1 / len), len);
}
/** TryChooseGroundedStep [IL_263c]: the seven detours in order; a clear sweep, a ground within 1.5 m of the start's height. */
export function tryChooseGroundedStep(phys, start, intendedDirection, distance) {
  if (distance <= MATHF_EPSILON) return null;
  for (const deg of DETOUR_ANGLES) {
    const dir = rotateY(intendedDirection, deg);
    if (!isStepClear(phys, start, dir, distance)) continue;
    const g = tryFindGround(phys, vadd(start, vscale(dir, distance)));
    if (!g) continue;
    if (Math.abs(g[1] - start[1]) > MAXIMUM_STEP_HEIGHT_CHANGE) continue;
    return g;
  }
  return null;
}

export class HorseFollowController {
  constructor() {
    this.path = new HorseFollowPath();
    this.threats = [];
    this.position = [...V_ZERO]; this.heading = [...V_FORWARD];
    this.evadeTarget = [...V_ZERO]; this.progressReference = [...V_ZERO]; this.previousPlayerPosition = [...V_ZERO];
    this.nextCombatScanTime = 0; this.nextEvadeTargetTime = 0; this.lastThreatTime = -Infinity; this.progressReferenceTime = 0;
    this.initialized = false; this.combatEvading = false; this.hasEvadeTarget = false; this.hasPreviousPlayerPosition = false;
    this.actualHorizontalSpeed = 0;
  }
  get isInitialized() { return this.initialized; }
  get isCombatEvading() { return this.combatEvading; }
  /** Begin [IL_1b64]. */
  begin(phys, horsePosition, horseHeading, playerPosition, playerForward) {
    this.position = [...horsePosition]; this.heading = normalizeHorizontal(horseHeading);
    this.path.seed(playerPosition, playerForward);
    this.threats.length = 0;
    this.combatEvading = false; this.hasEvadeTarget = false;
    this.nextCombatScanTime = 0; this.nextEvadeTargetTime = 0; this.lastThreatTime = -Infinity;
    this.progressReference = [...this.position]; this.progressReferenceTime = phys.now();
    this.previousPlayerPosition = [...playerPosition]; this.hasPreviousPlayerPosition = true;
    this.actualHorizontalSpeed = 0;
    this.initialized = true;
  }
  /** ResetTransient [IL_1c04]: the position, heading, evade target and progress marks are NOT touched. */
  resetTransient() {
    this.path.clear(); this.threats.length = 0; this.initialized = false; this.combatEvading = false; this.hasEvadeTarget = false;
    this.actualHorizontalSpeed = 0; this.nextCombatScanTime = 0; this.nextEvadeTargetTime = 0; this.lastThreatTime = -Infinity;
    this.previousPlayerPosition = [...V_ZERO]; this.hasPreviousPlayerPosition = false;
  }
  /** ClearCombatEvasion [IL_1c7c]: answers whether anything was active. */
  /** The floating origin moved the scene: every scene point this controller holds moves with it. */
  offset(d) {
    for (const v of [this.position, this.evadeTarget, this.progressReference, this.previousPlayerPosition, ...this.threats]) { v[0] += d[0]; v[1] += d[1]; v[2] += d[2]; }
    this.path.offset(d);
  }
  clearCombatEvasion(phys) {
    const wasActive = this.combatEvading || this.hasEvadeTarget || this.threats.length > 0;
    this.threats.length = 0; this.combatEvading = false; this.hasEvadeTarget = false; this.evadeTarget = [...V_ZERO];
    this.nextCombatScanTime = 0; this.nextEvadeTargetTime = 0; this.lastThreatTime = -Infinity;
    if (this.initialized) this.resetProgress(phys);
    return wasActive;
  }
  resetProgress(phys) { this.progressReference = [...this.position]; this.progressReferenceTime = phys.now(); }

  /** Tick [IL_1d00]: one frame of following. `playerMovement` is `{ position, forward }` (DFU's smoothFollower,
   *  the player object itself when there is none); `visual` the stationary horse visual. Returns false when the
   *  controller could not run (not begun, no interactive visual). The mod's `entered`/`cleared` outputs are unread
   *  by the runtime; `recoveredFromStuck` is answered through `this.recoveredThisTick`. */
  tick(phys, playerMovement, visual, followDistance, avoidCombat, acceleratedTravel, dt) {
    this.recoveredThisTick = false;
    if (!this.initialized || !playerMovement || !visual || !visual.isInteractive) { this.actualHorizontalSpeed = 0; return false; }
    const grounded = visual.tryGetGroundedPose();
    if (grounded && horizontalDistance(grounded.position, this.position) > TELEPORT_DISTANCE) {   // [IL_1d3c-IL_1d81] the visual re-grounded far off
      this.position = [...grounded.position]; this.heading = [...grounded.forward];
      this.path.seed(playerMovement.position, playerMovement.forward);
      this.resetProgress(phys);
    }
    const recorded = this.path.record(playerMovement.position, playerMovement.forward);
    if (!recorded) this.resetProgress(phys);
    const step = Math.max(0, dt);
    const playerSpeed = observedPlayerSpeed(this.previousPlayerPosition, playerMovement.position, step, recorded && this.hasPreviousPlayerPosition);
    this.previousPlayerPosition = [...playerMovement.position]; this.hasPreviousPlayerPosition = true;
    if (avoidCombat && !acceleratedTravel) this.updateCombatState(phys, playerMovement);
    else this.clearCombatEvasion(phys);
    let target, targetForward;
    if (this.combatEvading) {
      target = this.selectOrRetainEvadeTarget(phys, playerMovement.position);
      targetForward = normalizeHorizontal(vsub(target, this.position));
    } else {
      const behind = this.path.tryGetPointBehind(playerMovement.position, followDistance);
      if (!behind) { this.actualHorizontalSpeed = 0; visual.applyFollowingPose(this.position, this.heading, 0); return true; }
      target = behind.target; targetForward = behind.pathForward;
    }
    const startPosition = [...this.position];
    const targetDistance = horizontalDistance(this.position, target);
    const playerDistance = horizontalDistance(this.position, playerMovement.position);
    let speed = calculateFollowSpeed(targetDistance, playerDistance, this.combatEvading, followDistance);
    if (acceleratedTravel && recorded && !this.combatEvading) speed = acceleratedFollowSpeed(speed, playerSpeed, playerDistance, followDistance);
    if (speed > 0 && step > MATHF_EPSILON) {
      const stepDistance = Math.min(targetDistance, speed * step);
      if (acceleratedTravel) this.moveGroundedInSubsteps(phys, target, stepDistance);
      else {
        const direction = normalizeHorizontal(vsub(target, this.position));
        const g = tryChooseGroundedStep(phys, this.position, direction, stepDistance);
        if (g) this.position = g;
      }
      const delta = [this.position[0] - startPosition[0], 0, this.position[2] - startPosition[2]];
      if (vsqr(delta) > 1e-6) this.heading = vnorm(delta);
    }
    this.actualHorizontalSpeed = step > MATHF_EPSILON ? horizontalDistance(startPosition, this.position) / step : 0;
    if (!this.combatEvading) {
      const recovered = this.updateStuckRecovery(phys, playerMovement, targetForward, speed);
      if (recovered) { this.position = recovered; this.recoveredThisTick = true; this.actualHorizontalSpeed = 0; }
    }
    visual.applyFollowingPose(this.position, this.heading, this.actualHorizontalSpeed);
    return true;
  }
  /** UpdateCombatState [IL_2168]: a scan every 0.25 s; evasion enters on any qualifying threat and clears 3 s after the last. */
  updateCombatState(phys, playerMovement) {
    const now = phys.now();
    if (now < this.nextCombatScanTime) return;
    this.nextCombatScanTime = now + COMBAT_SCAN_INTERVAL;
    this.threats = (phys.threats?.() ?? []).map((p) => [...p]);
    if (shouldEnterCombatEvasion(true, this.threats.length)) {
      this.lastThreatTime = now;
      if (this.combatEvading) return;
      this.combatEvading = true; this.hasEvadeTarget = false; this.nextEvadeTargetTime = 0; this.resetProgress(phys);
      return;
    }
    if (this.combatEvading && now - this.lastThreatTime >= COMBAT_CLEAR_DELAY) {
      this.combatEvading = false; this.hasEvadeTarget = false;
      this.path.seed(playerMovement.position, playerMovement.forward);
      this.resetProgress(phys);
    }
  }
  /** IsThreatSafe [IL_2518]: no threat within 15 m (horizontal). */
  isThreatSafe(candidate) {
    for (const t of this.threats) { const dx = candidate[0] - t[0], dz = candidate[2] - t[2]; if (dx * dx + dz * dz < THREAT_CLEARANCE * THREAT_CLEARANCE) return false; }
    return true;
  }
  /** SelectOrRetainEvadeTarget [IL_2334]: stay where safe within 8 m of the player; keep a fresh safe target;
   *  else the nearest grounded, safe, reachable point on the first ring that yields one; else away from the threats. */
  selectOrRetainEvadeTarget(phys, playerPosition) {
    const now = phys.now();
    if (this.isThreatSafe(this.position) && horizontalDistance(this.position, playerPosition) <= EVADE_COMFORT_DISTANCE) { this.evadeTarget = [...this.position]; this.hasEvadeTarget = true; return this.evadeTarget; }
    if (this.hasEvadeTarget && now < this.nextEvadeTargetTime && this.isThreatSafe(this.evadeTarget)) return this.evadeTarget;
    this.nextEvadeTargetTime = now + COMBAT_TARGET_REFRESH;
    let best = [...V_ZERO], found = false;
    for (let ring = 0; ring < EVADE_RINGS.length && !found; ring++) {
      const radius = EVADE_RINGS[ring];
      let bestDist = Infinity;
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI * 2 / 16;
        const candidate = vadd(playerPosition, vscale([Math.cos(angle), 0, Math.sin(angle)], radius));
        const g = tryFindGround(phys, candidate);
        if (!g) continue;
        if (!this.isThreatSafe(g)) continue;
        if (!isDirectPathClear(phys, this.position, g)) continue;
        const d = horizontalDistance(this.position, g);
        if (d < bestDist) { bestDist = d; best = g; found = true; }
      }
    }
    if (!found) {
      let away = [...V_ZERO];
      for (const t of this.threats) away = vadd(away, normalizeHorizontal(vsub(this.position, t)));
      away = normalizeHorizontal(away);
      const g = tryFindGround(phys, vadd(this.position, vscale(away, EVADE_COMFORT_DISTANCE)));
      best = g ?? [...this.position];
    }
    this.evadeTarget = best; this.hasEvadeTarget = true;
    return this.evadeTarget;
  }
  /** UpdateStuckRecovery [IL_2570]: wanting to move, 8 m or more from the player, no progress of 0.5 m for 4.5 s -
   *  jump to the grounded point 6 m behind the player on the path. */
  updateStuckRecovery(phys, playerMovement, targetForward, desiredSpeed) {
    const now = phys.now();
    const playerDistance = horizontalDistance(this.position, playerMovement.position);
    if (desiredSpeed <= 0 || playerDistance < RECOVERY_MIN_SEPARATION) { this.resetProgress(phys); return null; }
    if (horizontalDistance(this.position, this.progressReference) >= PROGRESS_DISTANCE) { this.resetProgress(phys); return null; }
    if (now - this.progressReferenceTime < STUCK_TIMEOUT) return null;
    const behind = this.path.tryGetPointBehind(playerMovement.position, RECOVERY_TRAIL_DISTANCE);
    if (!behind) { this.resetProgress(phys); return null; }
    const g = tryFindGround(phys, behind.target);
    if (!g) { this.resetProgress(phys); return null; }
    this.heading = normalizeHorizontal(targetForward);
    this.path.seed(playerMovement.position, playerMovement.forward);
    this.resetProgress(phys);
    return g;
  }
  /** MoveGroundedInSubsteps [IL_26d4]: the accelerated-travel move, 1.25 m at a time, at most 16, never past the target. */
  moveGroundedInSubsteps(phys, target, totalDistance) {
    let remaining = totalDistance, substeps = 0;
    while (remaining > MATHF_EPSILON) {
      const distanceBefore = horizontalDistance(this.position, target);
      const step = Math.min(remaining, ACCEL_MAX_SUBSTEP);
      const direction = normalizeHorizontal(vsub(target, this.position));
      const g = tryChooseGroundedStep(phys, this.position, direction, step);
      if (!g) return;
      const moved = horizontalDistance(this.position, g);
      this.position = g;
      if (moved <= MATHF_EPSILON) return;
      remaining -= moved;
      if (horizontalDistance(this.position, target) > distanceBefore + 0.01) return;
      substeps++;
      if (substeps >= ACCEL_MAX_SUBSTEPS) return;
    }
  }
}

// ─── THE TRAILING WAGON'S TRAIL (TrailingWagonRuntime's trailPoints) ───────────────────────────────────────────

/** SeedTrail / RecordPlayerMovement / PruneTrail / TryGetTrailingPoint / IsDiscontinuity [IL_5968-IL_5bcf, IL_5910]
 *  - 3-D distances, 0.08 m samples, 7 m kept, the point 2.5 m behind. */
export class WagonTrail {
  constructor() { this.points = []; this.lastObserved = null; }
  /** The floating origin moved the scene. */
  offset(d) { for (const p of this.points) { p[0] += d[0]; p[1] += d[1]; p[2] += d[2]; } if (this.lastObserved) { this.lastObserved[0] += d[0]; this.lastObserved[1] += d[1]; this.lastObserved[2] += d[2]; } }
  /** SeedTrail: 7 m behind the player and the player. */
  seed(playerPosition, playerForward) {
    const f = horizontalForward(playerForward);
    this.points = [vsub(playerPosition, vscale(f, RETAINED_TRAIL_DISTANCE)), [...playerPosition]];
    this.lastObserved = [...playerPosition];
  }
  /** IsDiscontinuity: no observation yet, a jump past 20 m, or the wagon past 30 m from the player. */
  isDiscontinuity(playerPosition, wagonPosition = null) {
    if (!this.lastObserved) return true;
    if (vdist(playerPosition, this.lastObserved) > TELEPORT_DISTANCE) return true;
    if (wagonPosition) return vdist(playerPosition, wagonPosition) > MAXIMUM_VISUAL_DISTANCE;
    return false;
  }
  /** RecordPlayerMovement. */
  record(playerPosition, playerForward) {
    this.lastObserved = [...playerPosition];
    if (this.points.length === 0) { this.seed(playerPosition, playerForward); return; }
    if (vdist(playerPosition, this.points[this.points.length - 1]) < SAMPLE_DISTANCE) return;
    this.points.push([...playerPosition]);
    this.prune();
  }
  prune() {
    let retained = 0, removeCount = this.points.length - 1;
    for (let i = this.points.length - 1; i > 0; i--) {
      retained += vdist(this.points[i], this.points[i - 1]);
      removeCount = i - 1;
      if (retained >= RETAINED_TRAIL_DISTANCE) break;
    }
    if (removeCount > 0) this.points.splice(0, removeCount);
  }
  /** TryGetTrailingPoint: 2.5 m back along the 3-D trail; past the oldest point, that point and the first segment
   *  (null when that segment has no length). */
  trailingPoint(currentPlayerPosition) {
    if (this.points.length < 2) return null;
    let accumulated = 0, cursor = [...currentPlayerPosition];
    for (let i = this.points.length; i > 0; i--) {
      const p = this.points[i - 1];
      const seg = vsub(cursor, p);
      const len = Math.sqrt(vsqr(seg));
      if (len <= MATHF_EPSILON) { cursor = p; continue; }
      if (accumulated + len >= WAGON_FOLLOW_DISTANCE) {
        const remaining = WAGON_FOLLOW_DISTANCE - accumulated;
        return { target: vlerp(cursor, p, remaining / len), pathForward: vscale(seg, 1 / len) };
      }
      accumulated += len; cursor = p;
    }
    const pathForward = vnorm(vsub(this.points[1], this.points[0]));
    if (!(vsqr(pathForward) > MATHF_EPSILON)) return null;
    return { target: [...this.points[0]], pathForward };
  }
  clear() { this.points.length = 0; this.lastObserved = null; }
}

/** ApplyGroundedPose [IL_5bdc], the arithmetic: from 8 m up, 40 m down at the path point, the surface nearest its
 *  height; the wagon a metre up its normal, facing the path forward laid on that plane (the wagon's own forward when
 *  the path's has no length there); the first pose is snapped, later ones smoothed by 1-e^(-12 dt) / 1-e^(-10 dt).
 *  `w` is the wagon's pose state `{ position, rotation, active, lastValidPosition, lastValidRotation, hasLastValid }`;
 *  returns the next state. */
export function groundedPoseStep(phys, w, pathPosition, pathForward, dt) {
  const next = { ...w };
  const hits = phys.raycastAll(vadd(pathPosition, [0, GROUND_RAY_HEIGHT, 0]), [0, -1, 0], GROUND_RAY_DISTANCE);
  const best = pickGround(hits, pathPosition[1]);
  if (best) {
    const n = best.normal ?? [0, 1, 0];
    const normal = vsqr(n) <= MATHF_EPSILON ? [0, 1, 0] : vnorm(n);
    const project = (v) => vsub(v, vscale(normal, vdot(v, normal)));
    let fwd = project(pathForward);
    if (vsqr(fwd) <= MATHF_EPSILON) fwd = project(quatForward(w.rotation));
    if (vsqr(fwd) > MATHF_EPSILON) {
      next.lastValidPosition = vadd(best.point, vscale(normal, NORMAL_GROUND_OFFSET));
      next.lastValidRotation = quatLookRotation(vnorm(fwd), normal);
      next.hasLastValid = true;
    }
  }
  if (!next.hasLastValid) { next.active = false; return next; }
  if (!w.active) { next.position = [...next.lastValidPosition]; next.rotation = [...next.lastValidRotation]; next.active = true; return next; }
  const posT = 1 - Math.exp(-POSITION_SMOOTHING_RATE * dt), rotT = 1 - Math.exp(-ROTATION_SMOOTHING_RATE * dt);
  next.position = vlerp(w.position, next.lastValidPosition, posT);
  next.rotation = quatSlerp(w.rotation, next.lastValidRotation, rotT);
  return next;
}

// ─── WAGON-HITCH: THE WAGON ON ITS SHAFTS (a departure, 2026-10-04) ──────────────────────────────────────────

/** WAGON-HITCH (2026-10-04, Mac: "the wagon when attached to the horse should show in the overworld if attached and
 *  currently it sort of rubberbands and doesn't attach to the horse properly"). The mod lays the moving wagon on a
 *  trail point 2.5 m back (WagonTrail / HorseFollowPath) and then EASES it there at 12 per second
 *  (groundedPoseStep), so the wagon trails its own target by speed / 12: measured on the fake flat world, a cart at
 *  the ride's 7.6 m/s held the wagon 3.07 m behind the rider and sprang it back to 2.5 m inside 0.3 s on every stop;
 *  a following team's ran 2.9 m and swung to 0.8 m off the horse as the team set off; and the gap moved with the
 *  frame time (3.031 / 3.038 on alternating frames). That is the rubber band. A two-wheeled cart is held to its
 *  horse by rigid shafts, so the port holds it the same way: the wheels' axle stays `length` from the hitch (the
 *  rider, or the following horse), turned toward it - the trailer law (a tractrix), with no clock in the horizontal
 *  at all, so no speed, no frame time and no time scale moves the gap. Only what the shafts do not fix is eased:
 *  the height over a step and the tilt off the ground's normal, at the mod's own 12 and 10 per second.
 *
 *  `length` is HITCHED_HORSE_LOCAL_Z (3.1 m), the mod's own distance from a parked wagon to its hitched horse, so the
 *  team stands alike parked, ridden and following: a dismount parks the wagon where it hung and the horse comes to
 *  stand where the rider sat. The IL's trail and ease above stay as the record (test/hcc_follow.test.js pins them);
 *  they no longer place the drawn wagon. Ledger A, WAGON-HITCH. */
/** AUDIT WAGON-HITCH A3: the fastest a hitch may honestly move, metres a second of GAME time - past a cart or a horse
 *  at their quickest (the ride base at speed 100 is 11.8 m/s, a canter under Enhanced Riding x1.85 about 22 m/s;
 *  a following horse catches up at 7, Travel Options' accelerated follow at the player's pace plus 12), short of any
 *  teleport. The port's own number: the mod's jump is a flat 20 m a frame because its frame never spans more than a
 *  frame of game time, and under Travel Options' x100 the port's does (a 30 fps frame is 3.3 game seconds, a cart's
 *  25 m), so a flat 20 m read every frame of a fast journey as a jump - the wagon re-laid each frame, its wheels
 *  frozen, its height and tilt snapped. */
export const HITCH_JUMP_SPEED = 30;
/** How far a hitch may move in one step of `dt` game seconds before it is a JUMP: the mod's 20 m TELEPORT_DISTANCE,
 *  plus what HITCH_JUMP_SPEED covers in the step. */
export const hitchJumpReach = (dt) => TELEPORT_DISTANCE + HITCH_JUMP_SPEED * Math.max(0, Number.isFinite(dt) ? dt : 0);

export class WagonHitch {
  constructor() { this.last = null; }
  /** The floating origin moved the scene. */
  offset(d) { if (this.last) { this.last[0] += d[0]; this.last[1] += d[1]; this.last[2] += d[2]; } }
  /** Where the hitch stands this frame; answers whether it JUMPED there (no observation yet, or past `reach` in one
   *  step - hitchJumpReach of the step's game time: a door, a fast travel, a recentre the host did not shift, a stuck
   *  recovery). */
  observe(hitch, reach = TELEPORT_DISTANCE) {
    const jumped = !this.last || horizontalDistance(hitch, this.last) > reach;
    this.last = [...hitch];
    return jumped;
  }
  clear() { this.last = null; }
}

/** The shafts' one law: where the axle stands `length` from `hitch` on the line from `from` (the axle's own last place,
 *  horizontally), and the way it faces (toward the hitch). A wagon on top of its hitch faces `fallbackForward`. Pure;
 *  the runtime's pose below and the pool's peer wagons (scenes/horseCartPool.js) both stand on it. */
export function hitchAxle(from, hitch, length, fallbackForward) {
  const toHitch = [hitch[0] - from[0], 0, hitch[2] - from[2]];
  const dir = vsqr(toHitch) > 1e-8 ? vnorm(toHitch) : horizontalForward(fallbackForward);
  return { axle: [hitch[0] - dir[0] * length, hitch[1], hitch[2] - dir[2] * length], dir };
}

// ─── WAGONS2: THE FOUR-WHEELER'S TURN (a departure, 2026-10-09) ───────────────────────────────────────────────

/** WAGONS2 (2026-10-09, Mac: "Real wheel movement"): the signed turn (degrees, about +y, Unity's sense - +z toward +x)
 *  from horizontal direction `from` to `to`. `yawed(from, yawBetween(from, to))` points along `to`. Pure. */
export const yawBetween = (from, to) => (Math.atan2(from[2] * to[0] - from[0] * to[2], from[0] * to[0] + from[2] * to[2]) * 180) / Math.PI;
/** `v` turned `deg` degrees about +y (quatAngleAxis(deg, up)'s turn, written out). Pure. */
export function yawed(v, deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
/** A steer held to the bogie's lock (`limit` degrees either way). */
export const clampSteer = (steer, limit) => Math.max(-limit, Math.min(limit, steer));

/**
 * WAGONS2: THE TWO-STAGE TRAILER LAW - a four-wheeled wagon's front axle turns on a kingpin under its body and its pole
 * hangs from that axle, so it is two bars, not one: the KINGPIN follows the hitch on the pole (`length` - the kind's
 * hitch - less the wheelbase) by the trailer law, and the body's REAR AXLE follows the kingpin on the wheelbase by the
 * same law. The steer is the turn from the body's forward to the pole's (`yawBetween`), held to the bogie's lock
 * (`bogie.steerLimit`, measured off the model - world/wagonModels.js steerLimitOf: past it a front wheel's rim would
 * cut into the body beside it); at the lock the pole keeps the hitch's line and the body is laid at the lock off it, as
 * a wagon whose front wheels can turn no further is dragged round as one bent bar. `kingpinFrom` null lays the wagon
 * straight on the line from `axleFrom` to the hitch (an unplaced wagon, a leap) - exactly where the single bar would
 * stand it. Returns `{ axle, kingpin, dir }` (dir the body's facing) and `steer` (degrees). Pure.
 * @param {number[]} axleFrom @param {number[] | null} kingpinFrom @param {number[]} hitch @param {number} length
 * @param {{ wheelbase: number, steerLimit: number }} bogie @param {number[]} fallbackForward
 */
export function bogieAxle(axleFrom, kingpinFrom, hitch, length, bogie, fallbackForward) {
  const wb = bogie.wheelbase, pole = length - wb;
  if (!kingpinFrom) {
    const { axle, dir } = hitchAxle(axleFrom, hitch, length, fallbackForward);
    return { axle, kingpin: [hitch[0] - dir[0] * pole, hitch[1], hitch[2] - dir[2] * pole], dir, steer: 0 };
  }
  const k = hitchAxle(kingpinFrom, hitch, pole, fallbackForward);
  const a = hitchAxle(axleFrom, k.axle, wb, k.dir);
  const steer = yawBetween(a.dir, k.dir);
  const held = clampSteer(steer, bogie.steerLimit);
  if (held === steer) return { axle: a.axle, kingpin: k.axle, dir: a.dir, steer };
  const dir = yawed(k.dir, -held);
  return { axle: [k.axle[0] - dir[0] * wb, k.axle[1], k.axle[2] - dir[2] * wb], kingpin: k.axle, dir, steer: held };
}

/** WAGONS2: the steer of a four-wheeler whose body stands at `axle` facing `forward` and whose pole reaches toward
 *  `hitch` - the turn from its forward to the line from its kingpin (a wheelbase ahead of the axle) to the hitch, held
 *  to the lock. What a wagon drawn off an eased pose (another player's following team) is steered by. Pure. */
export function steerToward(axle, forward, hitch, bogie) {
  const f = horizontalForward(forward);
  const to = [hitch[0] - (axle[0] + f[0] * bogie.wheelbase), 0, hitch[2] - (axle[2] + f[2] * bogie.wheelbase)];
  return vsqr(to) > 1e-8 ? clampSteer(yawBetween(f, to), bogie.steerLimit) : 0;
}

/** The pose a hitched wagon takes this frame. `w` is the wagon's pose state (groundedPoseStep's shape, plus `up`, the
 *  eased ground normal, `hitch`, the point it hangs from, and `axle`, where its wheels stand on the ground); `hitch` where the shafts meet the horse; `hitchForward`
 *  the way the team faces, read only to lay a wagon that has nowhere to be pulled from yet; `seed` where an unplaced
 *  wagon already stands (a parked one being driven off), so it swings into line from there rather than appearing
 *  behind the camera. The axle is `length` from the hitch, horizontally, on the line from where it was; the ground
 *  is sought under it from 8 m above the hitch's height, 40 m down, the surface nearest that height (the mod's own
 *  probe); the wagon stands NORMAL_GROUND_OFFSET up the normal, facing the hitch along the ground's plane. Where no
 *  ground answers yet, a wagon that has stood keeps its last height and stays on its shafts; one that never stood
 *  stays hidden (`active` false), as the mod's SetActive(false). Pure; returns the next state.
 *  WAGONS2: `bogie` (a four-wheeler's - world/wagonModels.js: `{ wheelbase, steerLimit }`) makes it two bars
 *  (`bogieAxle`): the axle is the REAR axle, the facing the body's, and the state carries `steer` (degrees) - its
 *  kingpin is a wheelbase ahead of the axle along the body. Without one - the Small Cart, the classic wagon - the one
 *  bar, as before, its `steer` 0. WAGONS2 (AUDIT): `seedForward` the way the seeded wagon's body faced (a parked one's)
 *  - its kingpin pulled from a wheelbase ahead along it, so the bogie is driven off at the steer it rested at, not
 *  snapped straight with the body swung. */
export function hitchedPoseStep(phys, w, hitch, hitchForward, length, dt, seed = null, bogie = null, seedForward = null) {
  const next = { ...w, hitch: [...hitch] };
  // AUDIT WAGON-HITCH A1: the shafts pull from where the WHEELS stood (`axle`), never from the drawn position - that
  // stands a metre up the ground's normal, which on a slope leans downhill, and fed back it swung the wagon round its
  // hitch frame by frame until it hung straight down the hill (a 3 degree side slope: 75 degrees in two seconds, the
  // rider standing still; and more the higher the frame rate)
  const from = w.active ? (w.axle ?? w.position) : (seed ?? vsub(hitch, vscale(horizontalForward(hitchForward), length)));
  const two = bogie && length > bogie.wheelbase;
  // WAGONS2: the kingpin pulls from where it stood - a wheelbase ahead of the axle along the body (where the two bars
  // left it); an unplaced wagon is laid straight
  const bodyFrom = w.active ? quatForward(w.rotation) : seed && seedForward ? seedForward : null;
  const kingpinFrom = two && bodyFrom ? vadd(from, vscale(horizontalForward(bodyFrom), bogie.wheelbase)) : null;
  const turn = two ? bogieAxle(from, kingpinFrom, hitch, length, bogie, hitchForward) : null;
  const { axle, dir } = turn ?? hitchAxle(from, hitch, length, hitchForward);
  next.steer = turn?.steer ?? 0;
  const best = pickGround(phys.raycastAll(vadd(axle, [0, GROUND_RAY_HEIGHT, 0]), [0, -1, 0], GROUND_RAY_DISTANCE), hitch[1]);
  let ground = null;
  if (best) {
    const n = best.normal ?? [0, 1, 0];
    ground = vsqr(n) <= MATHF_EPSILON ? [0, 1, 0] : vnorm(n);
    next.lastValidPosition = vadd(best.point, vscale(ground, NORMAL_GROUND_OFFSET));
    next.axle = [axle[0], best.point[1], axle[2]];
    next.hasLastValid = true;
  } else if (w.hasLastValid) {
    next.lastValidPosition = [axle[0], w.lastValidPosition[1], axle[2]];
    next.axle = [axle[0], w.axle?.[1] ?? w.lastValidPosition[1] - NORMAL_GROUND_OFFSET, axle[2]];
  } else next.axle = [...axle];
  if (!next.hasLastValid) { next.active = false; return next; }
  const wasUp = w.up ?? [0, 1, 0];
  const targetUp = ground ?? wasUp;
  let up, y;
  if (!w.active) { up = targetUp; y = next.lastValidPosition[1]; next.active = true; }
  else {
    const posT = 1 - Math.exp(-POSITION_SMOOTHING_RATE * dt), rotT = 1 - Math.exp(-ROTATION_SMOOTHING_RATE * dt);
    const u = vlerp(wasUp, targetUp, rotT);
    up = vsqr(u) > MATHF_EPSILON ? vnorm(u) : targetUp;
    y = w.position[1] + (next.lastValidPosition[1] - w.position[1]) * posT;
  }
  let fwd = vsub(dir, vscale(up, vdot(dir, up)));
  if (vsqr(fwd) <= MATHF_EPSILON) fwd = dir;
  next.up = up;
  next.position = [next.lastValidPosition[0], y, next.lastValidPosition[2]];
  next.rotation = quatLookRotation(vnorm(fwd), up);
  next.lastValidRotation = next.rotation;
  return next;
}
