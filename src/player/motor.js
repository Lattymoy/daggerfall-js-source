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
// two declarations. Wave 24 made enemyMotor.js the home and imported
// it here; wave 34 turned that edge round. motor.js already owns its
// sibling DF_CROUCH_BASE, enemyMotor.js already imports the capsule
// and gravity constants FROM here, and the back-import closed a cycle
// - which stayed invisible only while every use sat inside a function
// body. The first module-level `CAPSULE_RADIUS / Math.SQRT2` in
// enemyMotor.js turned it into
// `ReferenceError: Cannot access 'CAPSULE_RADIUS' before initialization`
// across twelve test files.
export const DF_WALK_BASE = 150;
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
/** AcrobatMotor.HandleJumpInput (:82-86): a mounted jump takes a FLAT
 *  multiplier - "At least 1.5f to be able to jump over hedges" -
 *  INSTEAD of the Jumping/Athleticism/spell sum, and a cart refuses
 *  the jump outright (:66-70). */
export const HORSE_JUMP_MULTIPLIER = 1.75;
export const SLOWFALL_SPEED = 105;          // AcrobatMotor slowFallSpeed (:9)
/** AUDIT 26 F032: ApplyGravity writes `moveDirection.y =
 *  -slowFallSpeed * Time.deltaTime` (:187) from INSIDE FixedUpdate
 *  (PlayerMotor.cs:275/:357), where Time.deltaTime IS the fixed step
 *  - Unity's 0.02 - and moveDirection is a VELOCITY (spent as
 *  `Move(moveDirection * dt)`, PlayerGroundMotor.cs:86). So DFU's
 *  slow fall is a flat 2.1 m/s. The constant is coupled to Unity's
 *  step, not to ours: multiplying by the port's own 1/60 gave 1.75
 *  and made every buffed descent ~20% slower. */
export const UNITY_FIXED_DT = 0.02;
export const SLOWFALL_VELOCITY = SLOWFALL_SPEED * UNITY_FIXED_DT;   // 2.1 m/s
export const FALL_DAMAGE_THRESHOLD = 5.0;   // AcrobatMotor fallingDamageThreshold (= PlayerHealth's threshold)
export const FALL_HP_PER_METRE = 5;         // PlayerHealth.ApplyPlayerFallDamage HPPerMetre
export const GRAVITY = 20.0;
/** LevitateMotor's overEncumbered threshold (:83): CarriedWeight * 4 > 250. */
export const OVER_ENCUMBERED_LIMIT = 250;
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
/** PlayerHeightChanger.cs:56 - "Height of a horse plus seated rider.
 *  (1.6m + 1m)". The camera sits height/2 - eyeHeight above the
 *  controller's centre (:110-112), so the port's eye level for a rider
 *  is that same 0.09 below the top: 2.6 - 0.09 = 2.51 above the feet,
 *  against 1.8 - 0.1 = 1.7 standing. TR-AUDIT F-E3. */
export const RIDE_HEIGHT = 2.6;
export const RIDE_EYE_HEIGHT = 2.51;
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
export const HEIGHT_TIMER_SLOW = 0.4;      // A6: timerSlow (:72) - the sink/unsink clock, the only user of the slow budget

/** A6 - THE DOORWAY HEAD DIP (FrictionMotor.HeadDipHandling,
 *  :119-156, "Smoothly dips and undips height of player capsule, like
 *  a very tall person ducking through a low doorway"). Two forward
 *  samples over 0.5: one from the very top of the head (the FIXED
 *  standing half-height plus 0.25 above the controller centre - so it
 *  rides the capsule's true top even while already dipped) and one
 *  from the camera. Top blocked + eyes clear + STATIC geometry dips
 *  the standing height by 0.28; anything else undips at once. DFU's
 *  own note says the undip is deliberate ("the player will stand up
 *  again within a frame or two ... it is only required to clear the
 *  initial obstacle"). */
export const HEAD_DIP_RAY_DISTANCE = 0.5;
export const HEAD_DIP_CLEARANCE = -0.28;
export const HEAD_DIP_TOP_MARGIN = 0.25;

/** PlayerHeightChanger.controllerSwimHeight (:57) and its horse
 *  displacement (:58) - the capsule a swimmer on EXTERIOR water sinks
 *  to (DoSinking, :390-434). The eye keeps the port's own
 *  0.1-below-the-top presentation law, exactly as the crouch height
 *  above it does: 0.30 - 0.1 = 0.20 above the feet, and 0.60 - 0.1 =
 *  0.50 in the saddle. */
export const SWIM_HEIGHT = 0.30;
export const SWIM_HORSE_DISPLACEMENT = 0.30;
export const SWIM_EYE_HEIGHT = 0.20;
export const SWIM_RIDE_EYE_HEIGHT = 0.50;

/** DaggerfallAction.Teleport (:594) - the ONE classic writer of
 *  PlayerMotor.FreezeMotor. (ClimbingMotor.RestoreClimbingState :882
 *  writes 1f, but its block is `if (AdvancedClimbing && data.isClimbing)`
 *  - Ledger A, THE `AdvancedClimbing` SCAFFOLDING IS OFF-ROAD, by name.) */
export const TELEPORT_FREEZE_S = 0.5;

/** AcrobatMotor.ApplyGravity's antiBumpFactor (:181). */
export const ANTI_BUMP_FACTOR = 20.75;

/** GameObjectHelper.IsStaticGeometry (:438-446): DFU tags COMBINED
 *  block geometry with staticGeometryTag (RMBLayout.cs:532,
 *  GameObjectHelper.cs:211/:308 under `makeStatic`) and leaves action
 *  models and action doors untagged. The port's collider says the
 *  same thing with its BUCKET KEYS - actionSystem registers every
 *  action record and door under `act:`/`door:` (addAction :493,
 *  addDoor :428), every block/interior/streamed mesh under a plain
 *  world/dungeon/interior/pixel key - so the tag test is a key test.
 *  A missing key (a ray that hit nothing, or the heightAt floor,
 *  which is in no bucket) is not static geometry. */
export function isStaticGeometryKey(key) {
  if (key == null) return false;
  const k = String(key);
  return !k.startsWith('act:') && !k.startsWith('door:');
}

// M3 CLIMBING: the check machine + formulas live in climbing.js; the
// motor owns the capsule work (the wall probe + ClimbMovement's
// classic arm). The import is a cycle with climbing.js's divisor
// import - both are runtime-only references, which ESM live bindings
// resolve.
import { ClimbingState, climbingSpeed } from './climbing.js';
// A6: PlayerMoveScanner is a component on the player object in DFU
// (PlayerMotor.Start :265 GetComponent), so the motor owns one. Same
// runtime-only cycle shape as climbing.js above - moveScanner.js reads
// CAPSULE_RADIUS inside its constructor, never at module level.
import { PlayerMoveScanner } from './moveScanner.js';
import { getBool } from '../systems/settings.js';   // AUDIT 28 W5: Controls/ToggleSneak (StartGameBehaviour :277)
import { TRANSPORT_MODES, isRiding, rideBaseFor, canRunUnlessRiding } from '../systems/transport.js';   // TR1: the mount's speed, run and climb laws

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
export function runSpeed(liveSpeed, runningSkill, crouching = false, rideBase = null) {
  // TR1 (GetRunSpeed :402-408): RIDING HAS NO RUN BASE OF ITS OWN -
  // `baseRunSpeed = baseSpeed`, the ride speed, and the crouch arm is
  // an `else if` below it. The multiplier still applies, so a canter
  // is the ride speed times (1.35 + Running/200).
  const base = rideBase != null
    ? (liveSpeed + rideBase) / CLASSIC_TO_UNITY_RATIO
    : (liveSpeed + (crouching ? DF_CROUCH_BASE : DF_WALK_BASE)) / CLASSIC_TO_UNITY_RATIO;
  return base * (1.35 + runningSkill / 200);
}

/** GetBaseSpeed's riding arm (:156-160): the ride base UNDRAGGED -
 *  the walk drag is walkSpeed's own term and this arm does not take
 *  it, exactly as the crouch arm above it does not. */
export function rideSpeed(liveSpeed, rideBase) {
  return (liveSpeed + rideBase) / CLASSIC_TO_UNITY_RATIO;
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
 * U48 - PlayerMotor.StartRestGroundedCheck (:184-194), verbatim, and
 * the ONE HOME for it.
 *
 * "Standard grounded will pass check immediately"; otherwise a
 * downward ray from the controller CENTRE for height/2 + 0.2, which
 * is DFU's "collision fix for when player is levitating but feet are
 * close enough to ground to rest" - a levitating player's controller
 * never reports grounded because Unity only resolves that collision
 * while moving.
 *
 * TWO LANES EXTRACTED THIS INDEPENDENTLY, to the character, which is
 * some evidence it was the right move. It lives here because this is
 * where DFU puts it, and because the check now has FOUR callers: the dungeon context (which held the
 * only copy and fed it host state), and U48's two above-ground hosts.
 * The exterior page found the third case the raycast covers and the
 * flag `grounded` does not: on a page with no walking player the
 * motor is never stepped, so `grounded` sits at its initialiser
 * `false` forever and the rest key answered "You cannot sleep now."
 * on solid ground. The other lane found the other end of the same
 * divergence: the three hosts that gained rest were passing the raw
 * flag, so a levitating character could sleep below ground and was
 * refused in a shop, a street and a field.
 *
 * @param {boolean} grounded the motor's live flag
 * @param {ArrayLike<number>|null} feet world-space FEET position
 * @param {{raycast:(o:number[],d:number[],max:number)=>number}} collider
 */
export function startRestGroundedCheck(grounded, feet, collider) {
  if (grounded) return true;
  if (!feet || !collider?.raycast) return false;
  return Number.isFinite(collider.raycast(
    [feet[0], feet[1] + CAPSULE_HEIGHT / 2, feet[2]], [0, -1, 0], CAPSULE_HEIGHT / 2 + 0.2));
}

/**
 * Grounded first-person motor. Feeds a wish direction to the collider
 * and integrates AcrobatMotor-style vertical motion.
 */
export class PlayerMotor {
  /** EV1: the longest span one 1/60 step can honestly cover, with
   *  headroom (sprint tops out well under 1 unit/step; 2 units in a
   *  step is a teleport). See eyeAt's snap guard. */
  static SNAP_SPAN = 2;

  constructor(collider, stats = { speed: 50, running: 30, swimming: 30 }, { jumpBoost = null, climbing = null, carriedWeight = null } = {}) {
    this.collider = collider;
    this.stats = stats;
    this.jumpBoost = jumpBoost;    // () => AcrobatMotor jumpSpeedMultiplier (systems/skills owns the formula)
    // AUDIT 26 F027: () => PlayerEntity.CarriedWeight (:184 - the
    // pack's weight PLUS `goldPieces * goldPieceWeightInKg`). E4 made
    // the second term real: gold is a counter now rather than a stack
    // in the bag, so a host hands inventory.carriedWeight, which is
    // that member. A headless motor passes none and is never
    // over-encumbered.
    this.carriedWeight = carriedWeight;
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
    // A6: the step/head probes (PlayerMoveScanner). Always mounted, as
    // the component always is; it backs off on a collider with no
    // sweep API rather than crashing the step.
    this.scanner = new PlayerMoveScanner(collider);
    this.pos = new Float32Array(3); // FEET position
    // EV1: the previous PHYSICS STEP's feet, for render-time
    // interpolation. Captured immediately before each _step (not per
    // update - a frame that runs zero steps must keep the last real
    // span so the eye can continue across it), read only by eyeAt.
    this._prevPos = new Float32Array(3);
    this._alpha = 1;               // _acc / FIXED_DT after the last update
    this.velY = 0;
    this.grounded = false;
    this.groundedTime = 0;         // PlayerMotor.GroundedTime (the 0.1 s jump gate reads it)
    this.jumping = false;          // AcrobatMotor.Jumping: set at jump, cleared on the next grounded frame
    this.falling = false;          // AcrobatMotor.Falling (CheckInitFall / CheckFallingDamage)
    // PlayerMotor.CancelMovement: raised by the swim/levitate edges
    // (and by any host that relocates the player), spent by the block
    // at the top of _step.
    this.cancelMovement = false;
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
    this._swimming = false;
    this._levitating = false;
    this.waterWalking = false;
    this.waterSurfaceY = null;   // the current block's water surface (world y), null when dry
    this.jumped = false;         // set for the frame a jump actually starts (fatigue/tally consumer)
    this.crouching = false;      // P12: toggled via input.crouch (edge); standing needs headroom
    // PlayerHeightChanger.heightAction / camTimer: null | 'crouch' |
    // 'stand'. The pending action lives on the RENDER frame, exactly
    // where DFU decides and applies it.
    this.heightAction = null;
    this.heightTimer = 0;
    // A6 (PlayerHeightChanger.standingHeightAdjustment, :95-100):
    // "Allows for temporary dips in controller standing height to help
    // player clear low doorways ... Does nothing if player is crouched,
    // and crouching/uncrouching will clear this adjustment." The ONE
    // writer is FrictionMotor.HeadDipHandling below.
    this.standingHeightAdjustment = 0;
    // A6 (PlayerHeightChanger.controllerSink, :78): the sunk capsule.
    // toggleSink (:76) is the EDGE tracker DecideHeightAction reads;
    // both are this one flag because the port applies the height at
    // the action's start exactly as ControllerHeightChange does.
    this.sunk = false;
    // PlayerMotor.OnExteriorWater == OnExteriorWaterMethod.Swimming -
    // the sink's ONE trigger (:127). Wave B's exterior-water slice
    // owns the model that raises it; until then it stays false and no
    // host sinks, which is the port's behaviour before this line.
    this.onExteriorWater = false;
    this._camFrom = EYE_HEIGHT;   // PlayerHeightChanger.prevCamLevel / targetCamLevel
    this._camTo = EYE_HEIGHT;
    // PlayerEntity.IsParalyzed, as FrictionMotor.GroundedMovement
    // reads it (:78-93): the hosts already zero the movement INPUT,
    // but the head dip is guarded by the flag itself and holds its
    // last adjustment while paralysed rather than re-probing.
    this.paralyzed = false;
    // PlayerMotor.freezeMotor (:64) - the physics-settle countdown a
    // Teleport action arms; FixedUpdate's block below spends it.
    this.freezeMotor = 0;
    // P15 (PlayerSpeedChanger): the run/sneak STATES - latched from
    // held input only while grounded; airborne keeps the takeoff
    // state (the swim quirk rides it too: waterWalking's Speed read).
    this.isRunning = false;
    this.moveForward = 0;
    this.moveStrafe = 0;
    this.moveSpeed = 0;
    this.isSneaking = false;
    this.bobOffset = [0, 0, 0];   // AUDIT 28 W10: HeadBobber's eye offset, world space
    this.transportMode = TRANSPORT_MODES.Foot;   // TR1: TransportManager.TransportMode - the host owns it
    // AUDIT 28 W5 (PlayerSpeedChanger.CaptureInputSpeedAdjustment
    // :75-78): with Controls/ToggleSneak the sneak MODE is
    // `sneakingMode ^= ActionStarted(Sneak)` - a press flips it - and
    // without it the mode is the held key, as ever. The mode is
    // captured every frame; the grounded latch below still decides
    // when it takes effect (P15).
    this._sneakMode = false;
    this._prevSneakHeld = false;
    // The run half of the same capture (:72-75) plus the AutoRun latch
    // (:82-99). ToggleRun is no setting in DFU either - only AutoRun
    // writes it - so it starts false and the mode is the held key.
    this._runMode = false;
    this._prevRunHeld = false;
    this._toggleRun = false;
    this._autorun = false;          // InputManager.ToggleAutorun
    this._prevAutoRunHeld = false;
    this._prevBackHeld = false;
    // P13: PlayerMotor.IsMovingLessThanHalfSpeed - the stealth
    // sneak condition, recomputed each update from the frame's input.
    this.movingLessThanHalfSpeed = true;
    // A6: AcrobatMotor.ApplyGravity's anti-bump GATE, recomputed each
    // step from the scanner (see the note at the site).
    this.antiBumpInRange = false;
    // PlayerMotor.speed (the `speed` FIELD, not a recomputation):
    // UpdateSpeed writes it, and the swim/levitate early return sits
    // ABOVE UpdateSpeed, so while swimming/levitating it keeps its
    // last GROUNDED value - IsMovingLessThanHalfSpeed reads that
    // stale value, verbatim.
    this.speed = walkSpeed(this.stats.speed);
  }

  /** PlayerMotor.IsRiding (:138) - the one question every consumer
   *  asks of the transport mode. */
  get riding() { return isRiding(this.transportMode); }

  /** LevitateMotor.IsSwimming / IsLevitating are PROPERTY setters
   *  (:34-43): BOTH transitions of BOTH modes raise PlayerMotor
   *  .CancelMovement (SetLevitating :151/:159, SetSwimming :174/:182),
   *  which FixedUpdate's cancel block spends. The hosts rewrite these
   *  every frame, so the edge is the write that CHANGES the value -
   *  without it a fall broken by Levitate (or by a dive into dungeon
   *  water) stays live and is billed in full when the mode ends. */
  get swimming() { return this._swimming; }
  set swimming(v) {
    const b = !!v;
    if (b === this._swimming) return;
    this._swimming = b;
    this.cancelMovement = true;
  }

  get levitating() { return this._levitating; }
  set levitating(v) {
    const b = !!v;
    if (b === this._levitating) return;
    this._levitating = b;
    this.cancelMovement = true;
  }

  get eye() {
    // AUDIT 28 W10: HeadBobber's camera LOCAL offset rides the eye - every
    // camera and every ray in the port reads player.eye, as every DFU
    // ray reads the (bobbed) camera transform. The host's bobber writes
    // bobOffset in WORLD space each frame; [0,0,0] when it is off.
    const b = this.bobOffset;
    return [this.pos[0] + b[0], this.pos[1] + this._eyeLevel() + b[1], this.pos[2] + b[2]];
  }

  /** EV1: the RENDER eye - eye's own math over a position lerped
   *  between the last two physics steps. The motor steps at a fixed
   *  1/60 (the mobile-hotfix accumulator above) while the look
   *  filter, the head bob and the nod all advance at render rate, so
   *  a camera reading the raw stepped `eye` translates in quanta
   *  under a perfectly smooth rotation - the outdoor judder, worst on
   *  high-refresh displays where most frames step zero times. DFU has
   *  the same fixed step and no judder because Unity interpolates
   *  rendered transforms; this is that missing half, read-side only -
   *  no step, no flag, no law above changes, which is what keeps the
   *  fixed-step pins (audit18_player, motorStairs, enemymotor) green.
   *
   *  Rays, activation, audio and every gameplay reader stay on `eye`:
   *  the simulation's own truth. Only cameras read eyeAt.
   *
   *  THE SNAP GUARD: a span longer than SNAP_SPAN means the position
   *  was PLACED, not stepped - a load, a door, a start marker (the
   *  fastest legal step is a fraction of a unit). Lerping across a
   *  teleport would sweep the camera through the world for one frame;
   *  snapping is the honest picture. Recenters never reach this guard
   *  because offsetOrigin shifts both ends of the span. */
  eyeAt(alpha = this._alpha) {
    const p = this.pos, q = this._prevPos;
    const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
    if (dx * dx + dy * dy + dz * dz > PlayerMotor.SNAP_SPAN * PlayerMotor.SNAP_SPAN) return this.eye;
    const a = Math.max(0, Math.min(1, alpha));
    const b = this.bobOffset;
    return [
      q[0] + dx * a + b[0],
      q[1] + dy * a + this._eyeLevel() + b[1],
      q[2] + dz * a + b[2],
    ];
  }

  /** EV1: a floating-origin shift moves BOTH ends of the
   *  interpolation span - the world moved, the player did not - so
   *  the camera never lerps across the 819.2-unit recenter. The
   *  streaming host calls this instead of adding into pos directly. */
  offsetOrigin(offset) {
    for (let i = 0; i < 3; i++) {
      this.pos[i] += offset[i];
      this._prevPos[i] += offset[i];
    }
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
    // PH1 (Pegas-Arc decision 4): in the mod's saddle the motor IS the
    // horse's body and the rider sits `pheight` above its origin at
    // their own eye - the ride hands the height in, the script's
    // `setpos z` for the rider (hr_horse_script :661, :692).
    if (this.pegas) return this.pegas.eyeHeight;
    const t = Math.min(this.heightTimer / (this.heightTimerMax ?? HEIGHT_TIMER_FAST), 1);
    // A6: DoSinking/DoUnsinking (:352-434) are height actions of their
    // own too, and unlike the crouch pair their ENDS depend on the
    // stance they left (crouched, standing or mounted), so the pair of
    // rest eyes is latched at the action's start - which is where DFU
    // latches prevCamLevel/targetCamLevel as well.
    if (this.heightAction === 'sink' || this.heightAction === 'unsink') {
      return this._camFrom + (this._camTo - this._camFrom) * t;
    }
    if (this.sunk) return this.riding ? SWIM_RIDE_EYE_HEIGHT : SWIM_EYE_HEIGHT;
    // F-E3: DoMount/DoDismount are height actions of their own.
    if (this.heightAction === 'mount') return EYE_HEIGHT + (RIDE_EYE_HEIGHT - EYE_HEIGHT) * t;
    if (this.heightAction === 'dismount') return RIDE_EYE_HEIGHT + (EYE_HEIGHT - RIDE_EYE_HEIGHT) * t;
    if (this.riding) return RIDE_EYE_HEIGHT;
    if (this.heightAction === 'crouch') return EYE_HEIGHT + (CROUCH_EYE_HEIGHT - EYE_HEIGHT) * t;
    if (this.heightAction === 'stand' && !this.crouching) return CROUCH_EYE_HEIGHT + (EYE_HEIGHT - CROUCH_EYE_HEIGHT) * t;
    if (this.crouching) return CROUCH_EYE_HEIGHT;
    // A6 - the head dip's half of the eye. ChangeStandingHeightAdjustment
    // (:235-244) spends the adjustment through ControllerHeightChange,
    // which shrinks the capsule AND drops the controller transform by
    // half the change (:477-478) - the feet stay planted and the top
    // falls the full 0.28. The camera is a CHILD of that transform with
    // its own local height untouched (UpdateCameraPosition runs only
    // inside the Do* actions), so the eye falls HALF the dip: DFU's
    // standing eye goes 1.71 -> 1.57 above the feet, ours 1.70 -> 1.56.
    return EYE_HEIGHT + this.standingHeightAdjustment / 2;
  }

  get height() {
    // A6: controllerSwimHeight (:57) - the sunk capsule wins over
    // every other stance (DoSinking clears IsCrouching, :422), and a
    // mounted swimmer carries the horse displacement (:296, :370).
    if (this.sunk) return SWIM_HEIGHT + (this.riding ? SWIM_HORSE_DISPLACEMENT : 0);
    // controllerRideHeight (:56) - a rider's capsule is a horse tall,
    // so what he clears and bumps is the horse's, not his own.
    if (this.riding) return RIDE_HEIGHT;
    // CurrentControllerStandingHeight (:87-90) = controllerStandingHeight
    // + StandingHeightAdjustment; the crouch height takes no adjustment
    // (HeadDipHandling returns while crouched, DoCrouch zeroes it).
    return this.crouching ? CROUCH_HEIGHT : CAPSULE_HEIGHT + this.standingHeightAdjustment;
  }

  /** TransportManager's UpdateMode tells the motor; the height changer
   *  answers with DoMount/DoDismount (:159-170, :287-320): mounting
   *  rises over timerMedium and CLEARS the crouch (:306), dismounting
   *  falls over timerFast. TR-AUDIT F-E3. */
  setTransportMode(mode) {
    const was = this.riding;
    this.transportMode = mode;
    if (this.riding === was) return;
    this.heightAction = this.riding ? 'mount' : 'dismount';
    this.heightTimerMax = this.riding ? HEIGHT_TIMER_MEDIUM : HEIGHT_TIMER_FAST;
    this.heightTimer = 0;
    if (this.riding) this.crouching = false;
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
    // GetBaseSpeed/2. Before TR1 both branches collapsed to walk/2,
    // and this line said so. They no longer do: GetBaseSpeed's RIDING
    // arm returns the ride base, so a mount's half-speed line is half
    // the RIDE speed - which is what TR2's clop swap and its volume
    // halving key off. (TR-AUDIT F-E2: TR1 made the old comment false
    // and the old arithmetic with it.)
    const half = (!this.crouching && isRiding(this.transportMode))
      ? rideSpeed(this.stats.speed, rideBaseFor(this.transportMode))
      : walkSpeed(this.stats.speed);
    this.movingLessThanHalfSpeed = half / 2 >= appliedSpeed;
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
    // AUDIT 26 F028/F029: the two FORCED-STAND arms the port lacked.
    // (1) A crouched LEVITATOR is stood up and DecideHeightAction
    // RETURNS (:137-145) - no other arm runs; and the whole
    // crouch/climb/swim block below is gated `!riding && !onWater &&
    // !levitating` (:171), so a levitating player cannot toggle the
    // 0.9 capsule in mid-air and fit through gaps DFU forbids.
    //
    // A6: onWater is `OnExteriorWater == Swimming` (:127) and
    // LEVITATION FORCES IT FALSE (:144) before the sink arms read it -
    // so floating up off deep water unsinks the capsule. The port
    // carries the flag now; the model that raises it is Wave B's.
    const onWater = !!this.onExteriorWater && !this.levitating;
    if (this.levitating && this.crouching) {
      // (:139-143) the crouched levitator is stood and the method
      // RETURNS - no sink arm, no crouch block.
      this.heightAction = 'stand';   // timerMax is NOT set here, DFU keeps its last
    } else if (onWater && !this.sunk) {
      // DoSinking (:147-152, :390-434) on the SLOW clock.
      this._beginSink();
    } else if (!onWater && this.sunk) {
      // DoUnsinking (:153-158, :352-388), same clock.
      this._beginUnsink();
    } else if (this.levitating || onWater) {
      // The levitating fall-through (nothing left to decide) and
      // :171's `!onWater` half - a swimmer on exterior water cannot
      // toggle the crouch or take the forced-swim arms; the sink owns
      // the capsule until they leave the water.
    } else if (this.riding) {
      // :171's `!riding` half, the other side of the mount. A rider
      // cannot toggle the crouch at all - which is what makes
      // GetBaseSpeed's crouch-before-riding order unreachable - and
      // the climb and forced-swim arms are refused from the saddle
      // with it. setTransportMode owns the mount/dismount actions.
    } else if (input.crouch && (!this.swimming || this.grounded)) {
      this.heightAction = this.crouching ? 'stand' : 'crouch';
      this.heightTimerMax = HEIGHT_TIMER_FAST;
      this.forcedSwimCrouch = false;
    } else if (this.climb?.isClimbing) {
      // (2) CLIMBING forces standing every frame on the medium clock
      // (:184-191) - the timerMax is set whether or not a stand is
      // needed, verbatim - so a crouched climber does not carry the
      // crouched capsule and eye up the wall and past the top. This
      // reads the flag from before this update's _climbStep (:529),
      // which differs from DFU only on a climb's first frame.
      this.heightTimerMax = HEIGHT_TIMER_MEDIUM;
      if (this.crouching) this.heightAction = 'stand';
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
    if (this.heightAction === 'sink' || this.heightAction === 'unsink') {
      // Update's FIRST two arms (:219-222). Both actions did all of
      // their capsule work on the frame they were armed (DFU's
      // `if (!controllerSink)` / `if (controllerSink)` blocks); what
      // is left is the camera clock, and timerResetAction ends it.
      if (this.heightTimer >= max) this._heightReset();
    } else if (this.heightAction === 'crouch') {
      if (this.heightTimer >= max) {
        this.standingHeightAdjustment = 0;   // DoCrouch :256 - the crouch clears any head dip
        this.crouching = true;   // the flip IS the end of DoCrouch
        this._heightReset();
      }
    } else if (this.collider.penetrationAt(this.pos, CAPSULE_HEIGHT) < 0.03) {
      // CanStand: the STANDING capsule must fit at the current feet.
      if (this.crouching) this.standingHeightAdjustment = 0;   // DoStand :271, inside its own `if (IsCrouching)`
      this.crouching = false;    // DoStand flips at the START; the eye keeps lerping
      if (this.heightTimer >= max) this._heightReset();
    } else if (this.heightTimer >= max) {
      this._heightReset();       // the blocked request is forgotten past the budget
    }
  }

  /** DoSinking's arming block (:390-424): the capsule drops to the
   *  swim height AT ONCE (ControllerHeightChange keeps the feet and
   *  takes the top down), the crouch is cleared, and the camera lerps
   *  from the stance's rest eye to the swim eye over timerSlow. DFU's
   *  IsInWaterTile / PlayerEnterExit.IsPlayerSwimming writes are the
   *  host's half of the same edge. */
  _beginSink() {
    this._camFrom = this.crouching ? CROUCH_EYE_HEIGHT : (this.riding ? RIDE_EYE_HEIGHT : EYE_HEIGHT);
    this.crouching = false;      // :422
    this.sunk = true;            // controllerSink = true (:420) - `height` answers the swim capsule from here
    this._camTo = this.riding ? SWIM_RIDE_EYE_HEIGHT : SWIM_EYE_HEIGHT;
    this.heightAction = 'sink';
    this.heightTimerMax = HEIGHT_TIMER_SLOW;   // camTimer is NOT reset here - only timerResetAction (:451-455) does that
  }

  /** DoUnsinking's arming block (:352-378), the mirror: the capsule
   *  regains CurrentControllerStandingHeight (or the ride height) and
   *  the camera climbs back from the swim eye. */
  _beginUnsink() {
    this._camFrom = this.riding ? SWIM_RIDE_EYE_HEIGHT : SWIM_EYE_HEIGHT;
    this.sunk = false;
    this.crouching = false;      // :376
    this._camTo = this.riding ? RIDE_EYE_HEIGHT : EYE_HEIGHT + this.standingHeightAdjustment / 2;
    this.heightAction = 'unsink';
    this.heightTimerMax = HEIGHT_TIMER_SLOW;
  }

  /** timerResetAction (:451-455). */
  _heightReset() {
    this.heightAction = null;
    this.heightTimer = 0;
    this.heightTimerMax = HEIGHT_TIMER_FAST;
  }

  /** CaptureInputSpeedAdjustment (AUDIT 28 W5, PlayerSpeedChanger.cs
   *  :70-99): the run and sneak MODES - each toggled on its press edge
   *  under its toggle flag, the held key without it (:72-78) - plus
   *  the AutoRun latch. The run flag is ToggleRun, which nothing but
   *  that latch ever raises. Called from update(), which is where
   *  DFU calls it (see the note at the call). */
  _captureSpeedAdjustment(input) {
    const runStarted = !!input.run && !this._prevRunHeld;
    this._prevRunHeld = !!input.run;
    if (!this._toggleRun) this._runMode = !!input.run;
    else if (runStarted) this._runMode = !this._runMode;
    const sneakStarted = !!input.sneak && !this._prevSneakHeld;
    this._prevSneakHeld = !!input.sneak;
    if (getBool('Controls', 'ToggleSneak')) {
      if (sneakStarted) this._sneakMode = !this._sneakMode;
    } else {
      this._sneakMode = !!input.sneak;
    }
    // AUTORUN (:82-99): the press flips InputManager.ToggleAutorun and
    // hands it to ToggleRun, and enabling it while NOT already running
    // forces the run mode on ("this allows a player already running to
    // keep running instead of moving to autowalking" - isRunning here
    // is last step's, as DFU's is). The press is refused while
    // MoveBackwards is held, and a MoveBackwards PRESS drops the latch
    // (InputManager.cs:1851 clears ToggleAutorun on the same key).
    // DFU's own forward force under autorun lives in InputManager and
    // is the input layer's half; this is PlayerSpeedChanger's.
    const autoRunStarted = !!input.autoRun && !this._prevAutoRunHeld;
    this._prevAutoRunHeld = !!input.autoRun;
    const backHeld = !!input.back;
    const backStarted = backHeld && !this._prevBackHeld;
    this._prevBackHeld = backHeld;
    if (autoRunStarted && !backHeld) {
      this._autorun = !this._autorun;
      this._toggleRun = this._autorun;
      if (this._toggleRun && !this.isRunning) this._runMode = !this._runMode;   // ^= ToggleAutorun, true in this arm
    }
    if (backStarted) this._toggleRun = false;
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
    // PH1: in the mod's saddle the ride owns the keys - RUN toggles the
    // horse, SNEAK the gait, JUMP nothing (hr_horse_script :607-859) -
    // and the horse walks its own facing at the script's speed. The
    // motor takes that as its input bag; the collider still owns the
    // floor, the walls and the step, which is the whole point.
    if (this.pegas) input = { forward: this.pegas.forward, strafe: 0, run: false, autoRun: false, back: false, sneak: false, jump: false, up: false, down: false, crouch: false };
    this.jumped = false;
    this.landedFallDistance = 0;
    const frameDt = Math.min(dt, MAX_FRAME_DT);
    this._heightAction(frameDt, input);
    // AUDIT 39r: CaptureInputSpeedAdjustment is PlayerMotor.Update's
    // (:363-379), NOT FixedUpdate's, and Update has exactly ONE early
    // return: levitation, with DFU's own note beside it - "Don't
    // return here for swimming because player should still be able to
    // crouch when swimming". It lived inside _step below the
    // swim/levitate return, so a swimmer's run mode, sneak mode and
    // AutoRun latch all froze and their press-edge trackers went
    // stale; and being per-STEP rather than per-FRAME it shared the
    // crouch key's old bug - a render frame that accumulates less
    // than one physics step swallowed the press. Same home as
    // _heightAction (DecideHeightAction, :371) for the same reason.
    if (!this.levitating) this._captureSpeedAdjustment(input);
    this._acc = (this._acc ?? 0) + frameDt;
    while (this._acc >= FIXED_DT) {
      this._acc -= FIXED_DT;
      // EV1: latch the span's START. Per step, so a multi-step frame
      // interpolates across the LAST step only (the standard
      // fix-your-timestep shape) and a zero-step frame keeps the
      // previous span and just advances alpha.
      this._prevPos[0] = this.pos[0]; this._prevPos[1] = this.pos[1]; this._prevPos[2] = this.pos[2];
      this._step(FIXED_DT, input, yaw, pitch);
    }
    this._alpha = Math.min(1, this._acc / FIXED_DT);
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
      riding: isRiding(this.transportMode),   // TR1: ClimbingMotor :398 - no climbing from a saddle
      touchingSides: probe.touching,
      horizontalPos: [this.pos[0], this.pos[2]],
      // ":318-320: ground directly below too close for climbing" -
      // from the capsule center, height/2 + 0.12 down
      tooCloseToGround: () => Number.isFinite(this.collider.raycast(
        [this.pos[0], this.pos[1] + this.height / 2, this.pos[2]], [0, -1, 0], this.height / 2 + 0.12)),
    });
    if (!climbing) return false;
    // :322-326 zeroes moveDirection before the climb/swim/levitate
    // return, and airControl is false - so nothing of the momentum
    // carried into the climb survives it.
    this._airVelX = 0;
    this._airVelZ = 0;
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
      // X3: GetClimbingSpeed reads player.IsEnhancedClimbing LIVE at
      // the move (PlayerSpeedChanger.cs:424-431) - the same flag the
      // skill check doubles - so the Climbing spell's speed half rides
      // the deps thunk per frame, not a value latched at mount.
      const enhanced = !!climb.deps?.inputs?.().enhanced;
      const r = this.collider.move(this.pos,
        wd[0] * this.speed * dt, climbingSpeed(this.speed, enhanced) * dt, wd[2] * this.speed * dt,
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

  /** A6 - FrictionMotor.HeadDipHandling (:119-156), verbatim.
   *
   *  Two forward samples over raySampleDistance 0.5, both along the
   *  BODY's forward (myTransform is the player, which carries yaw
   *  only - PlayerMouseLook :258-259 parks the pitch on the camera):
   *
   *    headRay - myTransform.position + FixedControllerStandingHeight
   *              / 2 + 0.25. FIXED, not Current: the sample stays 0.25
   *              above where an undipped head would be even while the
   *              capsule is already dipped, which is what lets the
   *              probe notice the obstacle is gone.
   *    eyeRay  - the main camera's own position.
   *
   *  Top blocked, eyes clear, and the thing struck is STATIC geometry
   *  (a doorframe, not a swinging door or a moving platform) dips the
   *  standing height by 0.28. Every other combination undips at once;
   *  DFU's comment block at :144-151 defends that bluntness at length
   *  ("the most simple one still yielded the best results").
   *
   *  A collider without the ray API (a facade in a headless test)
   *  never dips, the same guard the climb probe takes. */
  _headDipHandling(sin, cos) {
    // `if (!heightChanger || playerMotor.IsCrouching) return;` (:124)
    if (this.crouching || !this.collider?.raycastHit) return;
    const dir = [sin, 0, cos];
    const centreY = this.pos[1] + this.height / 2;
    const head = this.collider.raycastHit(
      [this.pos[0], centreY + CAPSULE_HEIGHT / 2 + HEAD_DIP_TOP_MARGIN, this.pos[2]],
      dir, HEAD_DIP_RAY_DISTANCE);
    const eyeRayHit = Number.isFinite(this.collider.raycast(this.eye, dir, HEAD_DIP_RAY_DISTANCE));
    const headRayHit = Number.isFinite(head.dist);
    this.standingHeightAdjustment =
      (headRayHit && !eyeRayHit && isStaticGeometryKey(head.key)) ? HEAD_DIP_CLEARANCE : 0;
  }

  _step(dt, input, yaw, pitch = 0) {
    // PlayerMotor.FixedUpdate: time the grounded state FIRST, every
    // frame (the swim/levitate early-return comes after in DFU too).
    this.groundedTime = this.grounded ? this.groundedTime + dt : 0;
    // The cancelMovement block (:286-294), which sits ABOVE the climb
    // and swim/levitate returns: zero the persistent velocity, drop
    // the active platform and run AcrobatMotor.ClearFallingDamage
    // (:239-243) - `falling = false; fallStartLevel = position.y` -
    // then RETURN, one step of no movement. Every swim/levitate edge
    // raises it (the setters above), so Levitate saves a fall in the
    // port as it does in DFU instead of deferring the bill.
    if (this.cancelMovement) {
      this.cancelMovement = false;
      this._airVelX = 0;
      this._airVelZ = 0;
      this.groundKey = null;   // ClearActivePlatform
      this.falling = false;
      this.fallStart = this.pos[1];
      return;
    }
    // A6 - THE FREEZE (PlayerMotor.FixedUpdate :296-307, verbatim and
    // in DFU's own order, directly below the cancel block and above
    // every probe and motor call). A Teleport action arms 0.5 s in
    // which the motor does NOTHING - no gravity, no input, no scan -
    // so the destination's collision settles before the player is let
    // loose in it; the tick that runs the clock out raises
    // CancelMovement, which the block above spends on the NEXT step.
    if (this.freezeMotor > 0) {
      this.freezeMotor -= dt;
      if (this.freezeMotor <= 0) {
        this.freezeMotor = 0;
        this.cancelMovement = true;
      }
      return;
    }
    // A6 - PlayerMoveScanner's OTHER TWO probes belong HERE (:308-309:
    // `playerScanner.FindHeadHit(new Ray(controller.transform.position,
    // Vector3.up)); playerScanner.SetHitSomethingInFront();`), on every
    // FixedUpdate that is neither cancelled nor frozen and above the
    // climb/swim returns. Neither is spent, and both reasons are the
    // ledger's, not an omission:
    //   FindHeadHit - its ONE classic consumer is PlayerCrush.cs (the
    //     crushing-hazard forced crouch and death). That component is
    //     unported and RECORDED; it needs ModelDescription plumbed from
    //     the RDB reader and a per-host mount, which is another slice's
    //     blast radius. `scanner.findHeadHit(centre)` is the whole call
    //     the day it lands.
    //   SetHitSomethingInFront - BOTH of its consumers are
    //     AdvancedClimbing (ClimbingMotor :357's ClimbQuitMoveUnderToHang
    //     and the :679 advanced block), which is THE `AdvancedClimbing`
    //     SCAFFOLDING IS OFF-ROAD, Ledger A, by name.
    // Spending nine DDA rays a step on a field nothing reads is the
    // one thing worse than not having them, so the methods are ported,
    // tested against the law, and called by their consumers.
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
      // `moveDirection = Vector3.zero` before the return (:322-326):
      // with airControl false the airborne arm below spends whatever
      // stands here, so leaving levitation or water in mid-air must
      // drop straight down rather than resume the momentum the player
      // carried into it.
      this._airVelX = 0;
      this._airVelZ = 0;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      let mx = (sin * cp * input.forward + cos * input.strafe) * factor;   // HANDEDNESS (mat4's law): right = (cos, 0, -sin)
      let my = sp * input.forward * factor;
      let mz = (cos * cp * input.forward - sin * input.strafe) * factor;
      // Swimming without levitation: no vertical from the look
      // (AddMovement zeroes y unless a float key drives it).
      if (this.swimming && !this.levitating) my = 0;
      // LevitateMotor's up/down ladder (:81-90), in DFU's order. The
      // FIRST arm is AUDIT 26 F027: an over-encumbered swimmer is
      // dragged DOWN and the sink REPLACES the float keys, so past
      // 62.5 kg the player cannot surface. Climbing or water-walking
      // exempts them; levitation does too, through overEncumbered's
      // own !playerLevitating term. (GodMode has no port counterpart
      // - it is a debug console flag - so that term is absent.)
      const overEncumbered = (this.carriedWeight?.() ?? 0) * 4 > OVER_ENCUMBERED_LIMIT && !this.levitating;
      if (this.swimming && overEncumbered && !this.climb?.isClimbing && !this.waterWalking) my -= 1;
      else if (input.up) my += 1;
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
        // PH1: hr_ridingspell's Slow Fall 300 is on the RIDER - a landing in
        // the mod's saddle reports no distance, so the host applies no damage
        this.landedFallDistance = (this.pegas && this.pegas.fallDamage === false) ? 0 : this.fallStart - this.pos[1];
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
      // TR1: CanRunUnlessRiding (:137-140) - a mount does not sprint.
      this.isRunning = this._runMode && canRunUnlessRiding(this.transportMode);
      this.isSneaking = !this.isRunning && this._sneakMode;
    }
    // F-C3 (self-audit 3, ApplyInputSpeedAdjustment :121-125): running
    // CLEARS sneakingMode - "switch sneaking off if was previously
    // sneaking" - so under ToggleSneak a run ENDS the toggled sneak; it
    // does not come back when the run stops. Held mode re-latches from
    // the key next frame regardless, as DFU's does.
    if (this.isRunning) this._sneakMode = false;
    // GetBaseSpeed + ApplyInputSpeedAdjustment (audit F1): walking
    // crouched = the crouch base; RUNNING crouched = GetRunSpeed's
    // crouch branch (crouch base x the run multiplier - DFU lets you
    // run while crouched); SNEAKING halves the walk/crouch base then
    // subtracts one classic speed unit (P15); none apply while
    // swimming (above).
    let speed;
    // TR1: the mode's base, when there is one. GetBaseSpeed tests
    // CROUCH first and riding second, so the order here is DFU's.
    const rideBase = (!this.crouching && isRiding(this.transportMode)) ? rideBaseFor(this.transportMode) : null;
    if (this.isRunning) {
      speed = runSpeed(this.stats.speed, this.stats.running, this.crouching, rideBase);
    } else {
      // ApplyInputSpeedAdjustment (:127-133): the SNEAK arm subtracts
      // from whatever GetBaseSpeed returned - including the RIDE base.
      // TR-AUDIT F-E4: TR1's first cut put the ride arm beside the
      // sneak instead of under it, so a sneaking rider trotted.
      speed = rideBase != null
        ? rideSpeed(this.stats.speed, rideBase)
        : (this.crouching ? crouchSpeed(this.stats.speed) : walkSpeed(this.stats.speed));
      if (this.isSneaking) speed = sneakSpeed(speed);
    }
    if (this.pegas) speed = this.pegas.speed;   // PH1: the script's speed (trot 10 a frame, gallop horsespeed) in m/s
    this.speed = speed;   // UpdateSpeed writes the field the getter reads
    this._trackHalfSpeed(input, speed);
    // MW-D26: the frame's movement INPUT and applied speed, reported
    // for the Morrowind animation machine - the reference selects its
    // movement state from the movement-settings vector, not from
    // observed velocity (character.cpp:2126-2331), so the input is the
    // honest source. Written on the walk path only; the swim/climb
    // paths leave the last values (their animation families are
    // recorded as deferred).
    this.moveForward = input.forward || 0;
    this.moveStrafe = input.strafe || 0;

    // fwd = (sin, 0, cos); screen-right = (cos, 0, -sin) - Unity's
    // own. HANDEDNESS (mat4's law): the projection now mirrors NDC x,
    // so world +x lands at NDC x > 0 (screen-RIGHT) and D (strafe +1)
    // rides +cos. The comment that used to stand here PROVED the old
    // (-cos, sin) right from the unmirrored projection and reverted a
    // prior flip - the proof was true, and the convention it proved
    // was the mirror image of classic. Text on signage was the tell.
    // GROUNDED recomputes velocity from input; AIRBORNE keeps the
    // liftoff momentum verbatim (airControl false - see constructor).
    let vx, vz;
    if (this.grounded) {
      vx = (sin * input.forward + cos * input.strafe) * factor * speed;
      vz = (cos * input.forward - sin * input.strafe) * factor * speed;
      // A6 - THE DOORWAY HEAD DIP. GroundedMovement's recompute arm
      // ENDS with `if (!IsParalyzed) HeadDipHandling();` (:89-93), and
      // that arm is the only one classic ever takes: the slide arm
      // above it needs slideWhenOverSlopeLimit or slideOnTaggedObjects
      // and BOTH ship false (:15-18).
      if (!this.paralyzed) this._headDipHandling(sin, cos);
    } else {
      vx = this._airVelX;
      vz = this._airVelZ;
    }
    this.moveSpeed = Math.hypot(vx, vz);   // MW-D26: the applied horizontal speed, m/s

    // HandleJumpInput, verbatim gates: 0.1 s of grounded time (the
    // bunny-hop gate - a HELD jump re-fires each landing past it, as
    // classic), slowfall cancels outright; the boost multiplier is
    // the scene's jumpSpeedMultiplier (Jumping skill; athleticism +
    // jump spell pend); crouched jumps scale by crouchingJumpDelta;
    // a MOVING jump adds forward * jumpSpeed * 0.05 of momentum.
    // AUDIT 26 F026: the gate is `if (!WasClimbing && GroundedTime <
    // 0.1f) return;` (:76) - a player who was climbing at the START
    // of the frame BYPASSES the bunny-hop clock, so topping out or
    // aborting a climb onto ground and pressing Jump goes at once.
    // climb.step() has already run this update (:522) and left
    // wasClimbing holding the previous frame's isClimbing, exactly as
    // ClimbingMotor.cs:390 does - and an ACTIVE climb never reaches
    // here, so this reads only on the frame a climb ended. The flag
    // had been written every step with no reader anywhere in src/.
    // TR-AUDIT (AUDIT 39): the transport terms the block never had -
    // a CART cancels the jump outright (:66-70, beside the slowfall
    // cancel), and a HORSE takes the flat 1.75 INSTEAD of the skill
    // sum, which is the multiplier the hedges were sized for.
    if (this.grounded && input.jump && !this.slowFalling
        && this.transportMode !== TRANSPORT_MODES.Cart
        && (this.climb?.wasClimbing || this.groundedTime >= GROUNDED_JUMP_GATE_S)) {
      const boost = this.transportMode === TRANSPORT_MODES.Horse
        ? HORSE_JUMP_MULTIPLIER
        : (this.jumpBoost ? this.jumpBoost() : 1);
      this.velY = JUMP_SPEED * boost;
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

    // A6 - FindStep (PlayerMoveScanner :151-169), called from
    // FixedUpdate :355 with the finished moveDirection: after the
    // grounded/airborne branch AND after HandleJumpInput, so a jump's
    // own frame already has Jumping raised and the probe answers 0.
    this.scanner?.findStep(
      [this.pos[0], this.pos[1] + this.height / 2, this.pos[2]], [vx, 0, vz], this.height, this.jumping);

    // ApplyGravity: slowfall is a CONSTANT 2.1 m/s fall speed with
    // fallStart re-anchored every tick (expiry mid-fall only bills
    // the rest of the drop); otherwise integrate normally.
    if (this.pegas && this.pegas.verticalVelocity != null) {
      // PH1: the jump's rise (hr_horse_script :812-821, under
      // Levitate) - the horse climbs at the script's rate, gravity off
      this.velY = this.pegas.verticalVelocity;
      this.grounded = false;
      this.fallStart = this.pos[1];
    } else if (!this.grounded) {
      if (this.slowFalling && this.falling) {
        this.fallStart = this.pos[1];
        this.velY = -SLOWFALL_VELOCITY;   // F032: DFU's step, not ours
      } else {
        // PH1: Slow Fall as OpenMW reads it - the ride's own scale (1
        // on foot; 0.75 under the jump's Slow Fall 50)
        this.velY -= GRAVITY * dt * (this.pegas ? this.pegas.gravityScale : 1);
      }
    } else this.velY = Math.min(this.velY, 0);
    // A6 - ANTI-BUMP, the step probe's one classic consumer
    // (AcrobatMotor.ApplyGravity :180-194): `if (!IsClimbing &&
    // StepHitDistance > minRange && StepHitDistance < maxRange)
    // moveDirection.y -= antiBumpFactor`, minRange = height/2 - 0.15,
    // maxRange = minRange + 1.10. The GATE is ported verbatim and the
    // flag is live; the 20.75 VELOCITY SPIKE is not spent, and this is
    // deliberate.
    //
    // What the spike is for: Unity's CharacterController BOUNCES off
    // step edges and slope crests, and DFU presses it back down a flat
    // 20.75 (0.42 of travel per Unity step) whenever the probe says
    // ground is within arm's reach. Our collider (engine-side, like
    // the renderer - see this file's header) already answers that with
    // its own two mechanisms: the ground snap, which pulls a
    // descending capsule onto steps and slopes over the same
    // stepOffset reach and is withheld only mid-jump, and the step-up
    // LADDER, which is a multi-FRAME ratchet - it raises the capsule
    // in front of a riser and, in its own words, "the raised height is
    // kept this frame and the snap below settles it onto the tread as
    // forward progress clears the edge" (collider.js _moveStep).
    //
    // Those two are the same law by another road, and the third one on
    // top breaks the second: 0.35 of forced descent per step wipes the
    // ratchet's lift every frame before it can ever clear an edge.
    // Measured on the P14 harness, a 0.3-riser classic staircase went
    // from summited to stopped dead at the first riser (y 0.000, z
    // 1.655, forever). Recorded, not silently dropped: if the collider
    // is ever given Unity's single-Move step semantics, this flag is
    // where the spike goes back.
    this.antiBumpInRange = false;
    if (!this.climb?.isClimbing && this.scanner) {
      const minRange = this.height / 2 - 0.15;
      this.antiBumpInRange = this.scanner.stepHitDistance > minRange
        && this.scanner.stepHitDistance < minRange + 1.10;
    }
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


