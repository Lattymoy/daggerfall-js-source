// A6 - PlayerMoveScanner.cs (MIT, Daggerfall Workshop), the classic
// half. DFU's own header: "This class detects information about where
// the player is going to step". It is a component on the player, and
// PlayerMotor.FixedUpdate drives three of its probes every step
// (:308-309, :355).
//
// WHAT IS PORTED HERE, AND WHAT IS NOT.
//   FindStep / StepHitDistance (:151-169) - the step probe. Its
//     classic consumer is AcrobatMotor.ApplyGravity's anti-bump term
//     (:190-194), which motor.js spends. (RappelMotor's
//     InitialTooCloseToGround :105-117 reads it too, but rappel is
//     AdvancedClimbing - Ledger A, off-road.)
//   FindHeadHit / HeadHitDistance / HeadRaycastHit (:170-186) - the
//     upward head probe. Its classic consumer is PlayerCrush.cs;
//     HangingMotor's read (:194) casts its own sphere and is off-road.
//   SetHitSomethingInFront / HitSomethingInFront (:307-318) - ported
//     for completeness. BOTH of its consumers are AdvancedClimbing
//     (ClimbingMotor :357 and the :679 advanced block), so nothing on
//     the classic road calls it and the motor does not spend a ray on
//     it per step.
//   FindAdjacentSurface + the AdjacentSurface/AboveBehindWall family
//     (:188-305) - climb/hang/rappel scaffolding only. Ledger A.
//
// The casts are the collider's engine-side approximations (sphereCast
// is capsuleCast with a degenerate axis - see the note there), exactly
// as capsule resolution itself is. What Unity's `hit.distance` means
// is honoured: the distance the sphere's CENTRE travels before contact.

// The import is runtime-only (constructor body), which is what keeps
// the motor.js <-> moveScanner.js edge from being a module-level cycle
// - see motor.js's own note on the enemyMotor back-import.
import { CAPSULE_RADIUS } from './motor.js';

/** FindStep's sphere (:164) and the 0.10 forward displacement of its
 *  origin (:159) - "get the normalized horizontal component of
 *  player's direction". */
export const STEP_PROBE_RADIUS = 0.1;
export const STEP_PROBE_DISPLACEMENT = 0.10;
/** maxRange = height/2 + 2.10 (:157). */
export const STEP_PROBE_RANGE = 2.10;
/** HeadHitRadius = controller.radius * 0.85 (:114); the cast reaches
 *  2f (:174). */
export const HEAD_HIT_RADIUS_FACTOR = 0.85;
export const HEAD_PROBE_RANGE = 2;
/** SetHitSomethingInFront's reach: controller.radius + 0.1 (:317). */
export const IN_FRONT_REACH = 0.1;

export class PlayerMoveScanner {
  constructor(collider, radius = CAPSULE_RADIUS) {
    this.collider = collider;
    this.radius = radius;
    this.headHitRadius = radius * HEAD_HIT_RADIUS_FACTOR;
    // The three public fields, at their C# defaults (0/0/false).
    this.stepHitDistance = 0;
    this.headHitDistance = 0;
    this.hitSomethingInFront = false;
    // HeadRaycastHit's port shape: the bucket the head cast struck
    // (null on a clear cast), which is what IsStaticGeometry and the
    // action lookups downstream actually ask of it.
    this.headHitKey = null;
  }

  /** A collider that carries no sweep API (a facade in a headless
   *  test) leaves every probe at its default, exactly as the motor's
   *  climb probe backs off rather than crashing the step. */
  get _canScan() { return typeof this.collider?.sphereCast === 'function'; }

  /**
   * FindStep (:151-169), verbatim: a 0.1 sphere dropped from the
   * controller centre displaced 0.10 along the horizontal component of
   * moveDirection, reaching height/2 + 2.10. A JUMPING player scans
   * nothing - `!acrobatMotor.Jumping &&` short-circuits the cast - and
   * a miss reports 0, not the range.
   *
   * Unity's `Vector3.normalized` of a zero vector is zero, so a
   * standing player drops the sphere straight down the centre line.
   *
   * @param {ArrayLike<number>} position controller CENTRE, world space
   * @param {ArrayLike<number>} moveDirection this step's velocity
   * @param {number} height the LIVE controller height
   * @param {boolean} jumping AcrobatMotor.Jumping
   */
  findStep(position, moveDirection, height, jumping) {
    if (!this._canScan) { this.stepHitDistance = 0; return; }
    const maxRange = height / 2 + STEP_PROBE_RANGE;
    const hx = moveDirection[0];
    const hz = moveDirection[2];
    const len = Math.hypot(hx, hz);
    const s = len > 0 ? STEP_PROBE_DISPLACEMENT / len : 0;
    const origin = [position[0] + hx * s, position[1], position[2] + hz * s];
    const d = jumping ? Infinity
      : this.collider.sphereCast(origin, STEP_PROBE_RADIUS, [0, -1, 0], maxRange).dist;
    this.stepHitDistance = Number.isFinite(d) ? d : 0;
  }

  /**
   * FindHeadHit (:170-186): a HeadHitRadius sphere cast 2 units along
   * the ray. DFU keeps the hit ONLY when the thing struck carries a
   * MeshCollider - which is how the terrain (a TerrainCollider) and an
   * RMB ground plane (a BoxCollider) are excluded; the port's collider
   * holds nothing but meshes in its buckets (heightAt is not one), so
   * that filter is already the shape of the query.
   *
   * On a rejected hit DFU leaves HeadHitDistance STALE and only
   * HeadRaycastHit is rewritten - so this method never zeroes the
   * distance either; a clear cast clears the key and returns false.
   *
   * @param {ArrayLike<number>} origin the ray's origin (the motor
   *   passes the controller centre - PlayerMotor.cs:308)
   * @returns {boolean} true when a mesh was struck
   */
  findHeadHit(origin) {
    if (!this._canScan) return false;
    const hit = this.collider.sphereCast(origin, this.headHitRadius, [0, 1, 0], HEAD_PROBE_RANGE);
    if (Number.isFinite(hit.dist)) {
      this.headHitDistance = hit.dist;
      this.headHitKey = hit.key;
      return true;
    }
    this.headHitKey = null;
    return false;
  }

  /**
   * SetHitSomethingInFront (:307-318): a plain ray forward for
   * radius + 0.1. DFU picks the climbing motor's WallGrabDirection
   * while climbing and the body's forward otherwise; the caller passes
   * whichever applies.
   *
   * NOTE: nothing on the classic road reads the result - see the
   * header. It is here so the class is whole.
   */
  setHitSomethingInFront(position, direction) {
    if (typeof this.collider?.raycast !== 'function') { this.hitSomethingInFront = false; return false; }
    this.hitSomethingInFront = Number.isFinite(
      this.collider.raycast(position, direction, this.radius + IN_FRONT_REACH));
    return this.hitSomethingInFront;
  }
}
