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
/** MOVE-REAL: metres a second no body's own step reaches (a run at 200 with Speed 100 is ~13) - past it a step's move
 *  is a placement, and the odometer skips it. */
export const ODOMETER_MAX_SPEED = 60;
export const MAX_FRAME_DT = 0.25;

/** WW2 (Mac: "the bob movement plays even when idle"): THE ONE MOTION BAG every host hands the weapon rig and the
 *  dungeon's foe pass. It was written out longhand at five sites, and the world-hosted dungeon lane's copy stopped
 *  four fields short - no `standing`, so the Bob's idle gate (`FPSWeaponClone`'s IsStandingStill) never fired and the
 *  rig fell back to a speed ratio of 1: the WALKING stride played at rest, ten times the idle's size and speed (a
 *  crouched or mounted walk lost its halving and a run its ratio the same way). One home, so a sixth host cannot ship
 *  a partial one. `speed` is the frame's moveSpeed; `speedField` the setting (DFU's PlayerMotor.Speed, never zero);
 *  `standing` the motor's own word (grounded and no input) - the mod's idle gate. */
export function motionBagOf(player) {
  return {
    forward: player.moveForward || 0, strafe: player.moveStrafe || 0, running: !!player.isRunning, speed: player.moveSpeed || 0,
    grounded: player.grounded !== false, jumping: !!player.jumping, swimming: !!player.swimming, levitating: !!player.levitating,
    crouching: !!player.crouching, riding: !!player.riding, standing: !!player.standing, speedField: player.speed || 0,
    // AUDIT CLIMB1 F9: the climb - the classic one or a mantle in flight - for what puts the hands away for it (the
    // dungeon host's torch read `climbing` off this bag, which never carried it: no torch stowed on a dungeon wall).
    // CLIMB4: and a hold on the wall (the hang, the free climb) - both hands on the stone: the weapon lowered, the
    // torch stowed, the shield down
    climbing: !!(player.climb?.isClimbing || player.mantling || player.onWall),
    // EOTB-IL: what Eye Of The Beholder's PlayerBillboard reads off PlayerMotor beside the above - the sneak
    // (its frame time doubles), FreezeMotor (a frozen motor is "stopped"), OnExteriorWater == Swimming (the sprite's
    // top at the swim line), and the live capsule height (the billboard's parent is the capsule's centre)
    sneaking: !!player.isSneaking, freeze: player.freezeMotor || 0, onExteriorWater: !!player.onExteriorWater,
    height: Number.isFinite(player.height) ? player.height : 0,
    // AUDIT PRE-MERGE 0929 D1/D2: and the yaw the motor moved by (its own, beside forward and strafe; NaN before a
    // step) - the collision-trigger pass turns forward/strafe into the direction the body presses (actionContact)
    yaw: Number.isFinite(player.moveYaw) ? player.moveYaw : NaN,
  };
}
/** CLIMB5 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md): THE CLIMB ON THE WIRE - `cl` 1 hanging from a
 *  lip, 2 climbing a face (the classic climb too), 3 a move in flight (a mantle, a vault, a lower, a leap, a corner);
 *  `cw` the way the body faces on it (climbFacing - the wall, or the move's way), radians to the millirad. Empty off the
 *  wall: the wire omits both, and a pose on the ground keeps the bytes it always had. */
export function climbPoseOf(player) {
  const cl = player.mantling ? 3 : player.hanging ? 1 : player.onWall || player.climb?.isClimbing ? 2 : 0;
  if (!cl) return {};
  const cw = player.climbFacing;
  const out = Number.isFinite(cw) ? { cl, cw: Math.round(cw * 1000) / 1000 || 0 } : { cl };   // || 0: no negative zero on the wire
  if (cl === 3) Object.assign(out, climbMoveOf(player.climbMove));
  return out;
}
/** CLIMB6: a move in flight on the wire (net/wire.js climbOf): its kind (`ck`, CLIMB_MOVE_KINDS' index + 1), the lip it
 *  climbs (`cy`, cm over the feet it began at - the hang's lip, or a mantle's or a vault's edge, the top less the gap
 *  the rise keeps) and its time (`cd`, cs) - so the others' bodies climb it as the climber's does. */
export function climbMoveOf(m) {
  if (!m || !m.from) return {};
  const k = CLIMB_MOVE_KINDS.indexOf(m.kind) + 1;
  if (!k) return {};
  const lip = m.hang?.lipY ?? (m.up ? m.up[1] - PARKOUR_UP_GAP : null);
  const out = { ck: k };
  if (Number.isFinite(lip)) out.cy = Math.max(-CLIMB_MOVE_RISE_MAX, Math.min(CLIMB_MOVE_RISE_MAX, Math.round((lip - m.from[1]) * 100)));
  if (Number.isFinite(m.dur) && m.dur > 0) out.cd = Math.max(1, Math.min(CLIMB_MOVE_TIME_MAX, Math.round(m.dur * 100)));
  return out;
}
/** CLIMB5: the time constant (s) the body turns to the wall on - and back to the view off it. */
export const BODY_TURN_TAU = 0.08;
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
/** TELL6e (bible/12-Enhanced-AI/Feud-Arc.md 8.2): a blow's push decays at this (m/s/s)... */
export const BLOW_PUSH_DECAY = 12;
/** ...and never carries the body over a drop of more than this (m). */
export const BLOW_PUSH_EDGE = 2;
const PUSH_DOWN = Object.freeze([0, -1, 0]);
/** FALL-KEPT (FIELD BUGS 2026-09-30): the most of a fall a save carries (fallSnapshot / restoreFall) - terrainData
 *  .size.y, MaxTerrainHeight at the game's TerrainScale (DaggerfallTerrain.cs:307), the top of any ground the world
 *  streams. No drop that stands on the world is taller, and one begun above it (a Levitate let go over the peaks)
 *  bills thousands of HP at 5 a metre, so the bound takes nothing a character could live through. It keeps a torn
 *  save's number from standing a fall no world holds. */
export const FALL_CARRY_MAX = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;   // 1923.75
/** ...and the most speed: that same drop's from rest (v^2 = 2gh, 277 m/s), which a real fall reaches. A step at it
 *  moves 4.6 m, well inside the 67.2 the collider sweeps exactly; a torn speed past it would be taken whole and could
 *  carry the capsule through a floor. */
export const FALL_CARRY_MAX_SPEED = Math.sqrt(2 * GRAVITY * FALL_CARRY_MAX);
/** LevitateMotor's overEncumbered threshold (:83): CarriedWeight * 4 > 250. */
export const OVER_ENCUMBERED_LIMIT = 250;
/** AUDIT CLIMB2 H1: a saved move's end is never further than this from the body, each way (a move spans a lip's reach
 *  and a stride; a torn record moves the body no further). */
export const HOLD_CARRY_MAX = 4;
/** PlayerEnterExit.Update's dungeon arm, its afloat line (:395-404): Internal_Strings.csv:18 `cannotFloat`,
 *  handed to AddHUDText for 1.75 s. */
export const CANNOT_FLOAT_TEXT = 'You are carrying too much to stay afloat.';
export const CANNOT_FLOAT_HUD_SECONDS = 1.75;
/**
 * The afloat line's latch, one step of the arm: `CarriedWeight * 4 > 250` - PlayerEnterExit's own test, with none
 * of LevitateMotor's levitation or god-mode terms (:83) - on LevitateMotor.IsSwimming, never while water walking;
 * the latch drops once either the weight or the swim does. It is PlayerEnterExit.displayAfloatMessage (:50), kept
 * on the motor beside the host's other PlayerEnterExit member, and it moves only on a frame the arm runs: inside a
 * dungeon, and at sea while Iliac Puddle No More's forge holds the arm open (DW-D). Returns the line to show, or null.
 */
export function afloatMessageStep(player, waterWalking) {
  const overEncumbered = (player.carriedWeight?.() ?? 0) * 4 > OVER_ENCUMBERED_LIMIT;
  if (overEncumbered && player.swimming && !player.displayAfloatMessage && !waterWalking) {
    player.displayAfloatMessage = true;
    return CANNOT_FLOAT_TEXT;
  }
  if ((!overEncumbered || !player.swimming) && player.displayAfloatMessage) player.displayAfloatMessage = false;
  return null;
}
export const CAPSULE_HEIGHT = 1.8;
export const CAPSULE_RADIUS = 0.35;
export const STEP_OFFSET = 0.5;
/** DISC21: the climb's side contact - radius + the 0.1 skin (M3) - and
 *  the lowest height above the feet at which the capsule's lower cap,
 *  its centre at feet + radius, still reaches a wall its side rests on:
 *  r - sqrt((r + skin)^2 - r^2), about 0.067. */
export const CLIMB_SIDE_REACH = CAPSULE_RADIUS + 0.1;
export const CLIMB_CAP_LOW = CAPSULE_RADIUS - Math.sqrt(CLIMB_SIDE_REACH ** 2 - CAPSULE_RADIUS ** 2);
/** ClimbingMotor.cs:318-320: the ground directly below is "too close for climbing" within this under the feet (a ray
 *  from the capsule's centre, height/2 + this) - the classic climb's abort, and the free climb's (AUDIT CLIMB2 A1). */
export const CLIMB_GROUND_NEAR = 0.12;
/** MAC1: the render eye pays a grounded step out over this many seconds
 *  (see PlayerMotor._noteVerticalStep). */
export const STEP_SMOOTH_TAU = 0.06;
export const SLOPE_LIMIT_DEG = 70;
export const EYE_HEIGHT = 1.7;
// P12 crouch (PlayerHeightChanger): controllerCrouchHeight 0.9.
// DFU parks the camera 0.09 below the capsule top; our standing eye
// sits 0.1 below (the documented 1.7 presentation choice) - the
// crouched eye keeps that same law: 0.9 - 0.1 = 0.8 above the feet.
export const CROUCH_HEIGHT = 0.9;
export const CROUCH_EYE_HEIGHT = 0.8;
/** PlayerHeightChanger.cs:115 - camCrouchToStandDist, the sweep length
 *  CanStand (:525-531) casts UP from the controller centre:
 *  `(controllerStandingHeight - controllerCrouchHeight) / 2f` = 0.45. */
export const CROUCH_TO_STAND_DIST = (CAPSULE_HEIGHT - CROUCH_HEIGHT) / 2;
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
 *  to (DoSinking, :390-434).
 *  SWIM-EYE (FIELD BUGS 2026-10-02c, Discord: "Sinking in water causes
 *  clipping underground ... could see sky and mountains underground"):
 *  THE EYE IS DFU's. DoSinking's camera target is ControllerHeightChange's
 *  answer, `controller.height / 2f` (:417, :477-480) - half the swim
 *  height over the controller's CENTRE - and a controller under
 *  2 * radius is Unity's sphere of that radius, its centre CAPSULE_RADIUS
 *  over the feet (the collider's own clamp, _resolveCapsule). So 0.35 +
 *  0.15 = 0.50 above the feet, and 0.35 + 0.30 = 0.65 in the saddle. The
 *  port had read it as 0.1 under a 0.30 top - 0.20 - an eye inside the
 *  sphere's foot: the swim bounce (headBobber, -0.17) took it to 0.03,
 *  under the drawn ground and the 0.2 near plane, and the one-sided
 *  terrain vanished over the sky; and at the sea's own height under
 *  Deep Waters' 0.25 band it read as underwater. */
export const SWIM_HEIGHT = 0.30;
export const SWIM_HORSE_DISPLACEMENT = 0.30;
export const SWIM_EYE_HEIGHT = CAPSULE_RADIUS + SWIM_HEIGHT / 2;
export const SWIM_RIDE_EYE_HEIGHT = CAPSULE_RADIUS + (SWIM_HEIGHT + SWIM_HORSE_DISPLACEMENT) / 2;

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
import { ClimbingState, climbingSpeed, CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY, START_CLIMB_HORIZONTAL_TOLERANCE } from './climbing.js';
// CLIMB1: the enhanced climb's ledge sensor and its moves (the Enhanced
// Climbing arc). The same runtime-only cycle shape: parkour.js imports
// nothing from here, and every motor constant it needs is handed in.
import {
  senseLedge, senseVault, senseOver, planMantle, planClamber, planVault, movePoint, offsetMove, carryMove,
  parkourSkill, jumpingSkill, parkourReach, parkourCatchHold, parkourRefusal,
  PARKOUR_AIR_REACH, PARKOUR_AIR_LOW, PARKOUR_OVER_DROP, PARKOUR_QUIET_STEPS,
  // CLIMB2: the hang, the shimmy, the grip and the free climb
  senseGrip, senseEaveAhead, senseEaveLedge, catchClear, planCatch, planCorner, moveClear, wallContact, carryHold, gripSeconds, shimmySpeed, freeClimbSpeed, freeStartSeconds,
  bandsClear, capsuleFits, PARKOUR_LEAN, PARKOUR_SIDESTEP_MAX, PARKOUR_SIDESTEP_PROBE, PARKOUR_SIDESTEP_RISE, PARKOUR_SIDESTEP_CLEAR, PARKOUR_HUG_PRESS, PARKOUR_STEP_SCAN, PARKOUR_CORNER_LOOK, PARKOUR_TURN_HOLDS,
  PARKOUR_HANG_DROP, PARKOUR_HANG_GAP, PARKOUR_HANG_LOW, PARKOUR_HAND_SPAN, PARKOUR_GRIP_MIN, PARKOUR_GRIP_LOW,
  PARKOUR_GRIP_LOW_TEXT, PARKOUR_GRIP_REST, PARKOUR_GRIP_REGEN_S,
  PARKOUR_CORNER_PROBE, PARKOUR_FACE_FOLLOW, PARKOUR_ARM_GRACE_S, PARKOUR_CORNER_OFF, PARKOUR_CORNER_IN, PARKOUR_CORNER_CLEAR, PARKOUR_WALL_REACH, PARKOUR_CONTACT,
  // CLIMB-DOWN: the way down
  senseEdge, planLower, senseOverHang, planOverHang,
  // CLIMB3: leaps
  senseLeapHold, planLeap, senseWallRun, planWallRun, senseDrop, ejectLaunch, runLeapLaunch, wallRunHeight,
  leapSideReach, leapUpReach, PARKOUR_LEAP_GRIP, PARKOUR_LEAP_REACH, PARKOUR_COYOTE_S, PARKOUR_RUNLEAP_EDGE, PARKOUR_LIP_FOLLOW, PARKOUR_UP_GAP,
  PARKOUR_RUN_SHARE,   // AUDIT CLIMB-ARC L10: running at pace
  PARKOUR_VAULT_MAX, PARKOUR_VAULT_CLEAR,   // AUDIT CLIMB-ARC D3: the parapet too tall to vault
} from './parkour.js';
// A6: PlayerMoveScanner is a component on the player object in DFU
// (PlayerMotor.Start :265 GetComponent), so the motor owns one. Same
// runtime-only cycle shape as climbing.js above - moveScanner.js reads
// CAPSULE_RADIUS inside its constructor, never at module level.
import { PlayerMoveScanner } from './moveScanner.js';
import { getBool } from '../systems/settings.js';   // AUDIT 28 W5: Controls/ToggleSneak (StartGameBehaviour :277)
import { TRANSPORT_MODES, isRiding, rideBaseFor, canRunUnlessRiding } from '../systems/transport.js';   // TR1: the mount's speed, run and climb laws
import { timeScale } from '../systems/timeScale.js';   // TO1: Unity's Time.fixedDeltaTime rides Time.timeScale (see update())
import { CLIMB_MOVE_KINDS, CLIMB_MOVE_RISE_MAX, CLIMB_MOVE_TIME_MAX } from '../net/wire.js';   // CLIMB6: a move on the wire, its kinds and bounds the wire's
import { clampToRing } from '../net/duelSession.js';   // AUDIT DUEL1 D4: the ring's one clamp
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../world/terrainSampler.js';   // FALL-KEPT: the world's tallest drop bounds a carried fall

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

  constructor(collider, stats = { speed: 50, running: 30, swimming: 30 }, { jumpBoost = null, enhancedJumping = null, climbing = null, carriedWeight = null, parkour = null } = {}) {
    this.collider = collider;
    this.stats = stats;
    this.jumpBoost = jumpBoost;    // () => AcrobatMotor jumpSpeedMultiplier (systems/skills owns the formula)
    // AUDIT 64 F2: () => PlayerEntity.IsEnhancedJumping (DaggerfallEntity
    // .cs:85, raised/cleared by Jumping.cs:84/:94 - the plain Jump
    // spell). CheckAirControl's disjunction (AcrobatMotor.cs:145) reads
    // it; a headless motor passes none and keeps the frozen-momentum
    // path, which is what airControl = false alone gives.
    this.enhancedJumping = enhancedJumping;
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
    // CLIMB1 THE ENHANCED CLIMB: { enabled: () => bool, inputs: () =>
    // ({ climbing, khajiit, enhanced }) } - the host's (scenes/shared.js
    // parkourDeps), mounted like the climb's. No deps, or a switch that
    // answers no, and not one ray is cast: the classic lane is untouched.
    this.parkour = parkour;
    this._pkMove = null;         // the move in flight (player/parkour.js planMantle/planVault), null between moves
    this.parkoured = null;       // 'mantle' | 'vault' for the frame a move starts (the fatigue/tally consumer, as `jumped`)
    this.climbEvents = [];       // CLIMB4: the frame's climb events ({ type, ... }) - the feel's and the sounds' (climbFeel.js, climbSounds.js)
    this._bodyYaw = null;        // CLIMB5: the body's own yaw while it is not the view's (bodyYawFor) - null when it is
    this._bodyYawOff = null;     // AUDIT CLIMB-ARC N4: off the wall, the body's offset from the view, decaying - null when none
    this._pkJumpLatch = false;   // AUDIT CLIMB1 F7: Jump held through a move is spent on it - the next jump is a fresh press
    this._pkArm = null;          // the tap catch: a fresh Jump's catch armed for its jump ({ t, air }) - PARKOUR_ARM_GRACE_S
    this._pkJumpWas = false;     // ...the key's last step, for the press's edge
    this._pkSaid = false;        // AUDIT CLIMB1 F10: a refused climb's line said once a press
    this._pkEdgeSaid = false;    // CLIMB-DOWN: a refused lower's, once a walk to the edge
    this._pkLeap = null;         // CLIMB3: a leap's flight ({ dir }) - its catch looks that way and reaches further
    this._climbCarried = [0, 0, 0];   // AUDIT CLIMB-ARC F8: what a moving hold (a deck, a lift) carried the body, summed
    this._pkOffEdge = null;      // CLIMB3: seconds since running off an edge without a jump (the late press), or null
    this._pkQuiet = 0;           // steps the air catch and the top-out rest after a refused lip (PARKOUR_QUIET_STEPS)
    this._wall = null;           // CLIMB2: on the wall - { mode: 'hang' | 'climb', normal, lipY, key, carrier, warned }
    this.grip = 1;               // CLIMB2: the grip, 0..1 - spent on the wall, back on the ground (parkour.js gripSeconds)
    this._pkDropReq = false;     // CLIMB2: Crouch pressed on the wall - the render frame's press, the step's letting go
    this._fcStart = null;        // CLIMB2: Forward held against a wall - where from and how long (the free climb's start)
    this._wallTally = 0;         // CLIMB2: the Climbing tally's clock on the wall - the classic climb's continue cadence
    this._pkOn = false;          // CLIMB2: this step's switch - the enhanced lane's free climb takes the classic climb's place
    this._pkLeftWall = false;    // CLIMB2: the hands let go on the last step
    this._pkSide = null;         // CLIMB2: Left/Right on the wall, fixed while the key is held ({ key, s })
    this._pkRestore = null;      // AUDIT CLIMB2 H1: a hold a save carried, taken again on the first step it can be
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
    // MOVE-REAL: the ground this body covered under its OWN steps, across (h) and up or down (v) - what the movement
    // skills count past 100 (systems/skillSoftcap.js movementTallyWeight). Hosts hand this live object on.
    this.odometer = { h: 0, v: 0 };
    this._alpha = 1;               // _acc / FIXED_DT after the last update
    this._eyeFeetY = null;         // MAC1: the render eye's LOW-PASSED interpolated feet height (eyeAt); null = not yet primed
    this._eyeSmoothing = true;     // MAC1: the harness's off switch, so a bare walk can be measured beside a smoothed one
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
    // airControl = false (AcrobatMotor.cs:21, the shipped default):
    // airborne horizontal momentum is FROZEN at liftoff - DFU only
    // recomputes x/z from input in the GROUNDED branch (FrictionMotor
    // .GroundedMovement), so a jump carries its takeoff velocity and
    // mid-air steering does nothing. AUDIT 64 F2: except under the
    // Jump spell - CheckAirControl's third disjunct is
    // IsEnhancedJumping (AcrobatMotor.cs:145), which IS on the classic
    // path and is taken below. Only the `rappelMotor.IsRappelling`
    // disjunct still pends, and that one is Ledger A (AdvancedClimbing).
    this._airVelX = 0;
    this._airVelZ = 0;
    // DUEL1: THE DUEL'S RING - { centre: [x, y, z] in THIS scene's frame, radius } while a duel holds the player in it,
    // null otherwise. The host sets it every frame from the live duel (net/duelSession.js); the motor keeps the body
    // inside it after every step (_keepInArena), shifts it with the world (offsetOrigin) and drops it on any placement
    // (spawn) - a teleport is not a walk, and the duel's own law ends a duel whose duellist was carried off.
    this.arena = null;
    // P11 modes (the scene owns the toggles): swimming rides the
    // block water level; levitating rides the Levitate effect;
    // waterWalking (S8) restores normal speed in water.
    this._swimming = false;
    this._levitating = false;
    this.waterWalking = false;
    this.waterSurfaceY = null;   // the current block's water surface (world y), null when dry
    this.swimSpeedScale = 1;     // DW-D: Iliac Puddle No More's swim speed multiplier (a walk speed modifier while swimming - swimSpeedNow)
    this.jumped = false;         // set for the frame a jump actually starts (fatigue/tally consumer)
    this.crouching = false;      // P12: toggled via input.crouch (edge); standing needs headroom
    this._pkCrouchRestore = false; // A low mantle's temporary stance, distinct from the player's crouch toggle.
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
    // toggleSink (:76) is the EDGE tracker DecideHeightAction reads.
    // DW-D (2026-09-25): two flags again. They were one because vanilla
    // DFU moves them together (the decision arms the action and the
    // action flips the capsule the same frame), and Iliac Puddle No More
    // writes the ACTION from outside - HeightAction = DoUnsinking for a
    // swimmer whose head is clear of its sea - which flips the capsule
    // and leaves the edge set, so DecideHeightAction does not sink it
    // again while the swimmer stays on the water (forceUnsink below).
    this.sunk = false;
    this.toggleSink = false;
    // PlayerMotor.OnExteriorWater == OnExteriorWaterMethod.Swimming -
    // the sink's ONE trigger (:127). Wave B's exterior-water slice
    // owns the model that raises it; until then it stays false and no
    // host sinks, which is the port's behaviour before this line.
    this.onExteriorWater = false;   this.isPlayerSwimming = false;   // XL-1: PlayerEnterExit.isPlayerSwimming (:44, :177-178) beside it - DFU's OTHER swim member, the HOST's. A plain FIELD: no setter, written by the hosts alone (UpdateSpeed's swim gate below is the one _step read DFU has, PlayerMotor.cs:387 - on this field since DW-D, which parted it from `sunk`), and it must never arm cancelMovement the way `swimming` (levitateMotor.IsSwimming, PlayerMotor.cs:149-152) does. The split, and which reader takes which member, is exteriorSurface.js's header.
    this.displayAfloatMessage = false;   // PlayerEnterExit.displayAfloatMessage (:50) - afloatMessageStep's latch
    this.levitateMotorEnabled = true;   // LevitateMotor.enabled - a disabled component's Update never runs (DW-D: the frame-spike guard)
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
    // TELL6e (bible/12-Enhanced-AI/Feud-Arc.md 8.2): what a telegraphed blow's landing does to the body - the port's own,
    // set only by systems/blowEffects.js (the Enhanced AI switch's): a push (m/s, decaying), a rattle (a share of the
    // walk for a while), a knockdown (no move, the eye down and up again)
    this._pushX = 0; this._pushZ = 0;
    this._rattleLeft = 0; this._rattleShare = 1;
    this._downLeft = 0; this._downFor = 0; this._downDrop = 0;
    // P15 (PlayerSpeedChanger): the run/sneak STATES - latched from
    // held input only while grounded; airborne keeps the takeoff
    // state (the swim quirk rides it too: waterWalking's Speed read).
    this.isRunning = false;
    this.moveForward = 0;
    this.moveStrafe = 0; this.moveYaw = NaN;   // AUDIT PRE-MERGE 0929 D1/D2: the yaw the walk moved by (motionBagOf's `yaw`)
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
    this._autoRunStarted = false;   // InputManager.ActionStarted(AutoRun), captured per frame
    this._backStarted = false;      // InputManager.ActionStarted(MoveBackwards)
    this._runStarted = false;       // ...and Run / Sneak, the other two ActionStarted reads
    this._sneakStarted = false;
    // P13: PlayerMotor.IsMovingLessThanHalfSpeed - the stealth
    // sneak condition, recomputed each update from the frame's input.
    this.movingLessThanHalfSpeed = true;
    // PlayerMotor.IsStandingStill (:113-125) - grounded over a zero
    // moveDirection. A motor that has not stepped yet has moved
    // nothing, so it starts true (the footstep hosts read it).
    this.standing = true;
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

  /** AUDIT 64 F3: InputManager.ToggleAutorun (InputManager.cs:542-545)
   *  - the latch PlayerSpeedChanger.ToggleRun flips (:85-93) and the
   *  input layer spends on the vertical axis. It lives here because
   *  the port keeps CaptureInputSpeedAdjustment in the motor; the
   *  hosts hand it to MoveAxes, which is InputManager's half. */
  get toggleAutorun() { return this._autorun; }
  /** CSA-D: `InputManager.Instance.ToggleAutorun = false` - Come Sail Away's StopSailing writes the latch. */
  set toggleAutorun(v) { this._autorun = !!v; }

  /** TELL6e: a blow's push - `vx`, `vz` metres a second, decaying at BLOW_PUSH_DECAY, along the collider (a wall
   *  stops it) and never over an edge of more than BLOW_PUSH_EDGE. */
  blowPush(vx, vz) { this._pushX = vx; this._pushZ = vz; }
  /** TELL6e: a rattle - `seconds` at `share` of the walk. */
  blowRattle(seconds, share) { this._rattleLeft = Math.max(this._rattleLeft, seconds); this._rattleShare = share; }
  /** TELL6e: a knockdown - `seconds` with no move, the eye `drop` metres down at once and up again at its end.
   *  AUDIT TELL L4: refused (false) to a body the hands hold (a climb, a hold, a mantle) or the water or the air does
   *  (a swim, a levitation) - nothing there goes down; systems/blowEffects.js pushes it instead. */
  blowKnockDown(seconds, drop) {
    if (this.climb?.isClimbing || this._wall || this._pkMove || this.swimming || this.levitating) return false;
    this._downLeft = seconds; this._downFor = seconds; this._downDrop = drop; this._pushX = 0; this._pushZ = 0;
    return true;
  }
  /** TELL6e: is the body down (a knockdown)? */
  isDown() { return this._downLeft > 0; }
  /** TELL6e: the eye's drop under a knockdown now - down over its first 0.15 s, up over its last 0.3 s. */
  _downEye() {
    if (!(this._downLeft > 0)) return 0;
    const into = this._downFor - this._downLeft;
    return this._downDrop * Math.min(1, into / 0.15, this._downLeft / 0.3);
  }
  /** TELL6e: the push's step - along the collider, stopped by a drop past BLOW_PUSH_EDGE ahead. */
  _pushStep(dt) {
    const v = Math.hypot(this._pushX, this._pushZ);
    if (!(v > 0)) return;
    // AUDIT TELL L3: a body the motor holds (a teleport's settle) or the hands do (a climb, a hold, a mantle) takes no
    // push - it is dropped, never stored for the moment they let go
    if (this.freezeMotor > 0 || this.climb?.isClimbing || this._wall || this._pkMove) { this._pushX = 0; this._pushZ = 0; return; }
    const dx = this._pushX * dt, dz = this._pushZ * dt;
    const o = [this.pos[0] + dx * 4, this.pos[1] + 0.5, this.pos[2] + dz * 4];   // the ground a little ahead of the step
    const below = this.collider.surfaceHit ? this.collider.surfaceHit(o, PUSH_DOWN, BLOW_PUSH_EDGE + 0.5)?.dist : this.collider.raycast?.(o, PUSH_DOWN, BLOW_PUSH_EDGE + 0.5);
    if (!Number.isFinite(below)) { this._pushX = 0; this._pushZ = 0; return; }   // an edge: no cliff takes a push
    this.collider.move(this.pos, dx, 0, dz, this.height, this.grounded && !this.jumping && !this.swimming && !this.levitating);   // AUDIT TELL L3: snapped to the ground only from it - a jump, a swim, a levitation is never pulled down
    const nv = Math.max(0, v - BLOW_PUSH_DECAY * dt);
    this._pushX *= nv / v; this._pushZ *= nv / v;
  }

  /** SEA-RISE (2026-09-27): drop both latches, as a held MoveBackwards does (InputManager.cs:1851's clear, and
   *  PlayerSpeedChanger.cs:96-99's on the press). The online respawn's - the port's own teleport: a player raised
   *  from death came up still running, back into the water that drowned them. */
  stopAutorun() {
    this._autorun = false;
    this._toggleRun = false;
  }

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

  /** PlayerSpeedChanger.RefreshWalkSpeed: GetWalkSpeed through the walk speed modifiers. The one the port carries is
   *  DW-D's swim multiplier (Iliac Puddle No More's AddWalkSpeedMod, held while the player swims) - so it scales
   *  GetBaseSpeed's walk arm wherever DFU reads it, never the crouch, the ride or the run (RefreshRunSpeed has its
   *  own list). */
  _refreshWalkSpeed() {
    return walkSpeed(this.stats.speed) * (this.swimSpeedScale > 0 ? this.swimSpeedScale : 1);
  }
  /** IsMovingLessThanHalfSpeed's base (PlayerMotor.cs:176-180): GetWalkSpeed crouched, else GetBaseSpeed - which,
   *  uncrouched, is the ride base on a mount and RefreshWalkSpeed off one. */
  _halfSpeedBase() {
    if (this.crouching) return walkSpeed(this.stats.speed);
    return isRiding(this.transportMode) ? rideSpeed(this.stats.speed, rideBaseFor(this.transportMode)) : this._refreshWalkSpeed();
  }
  /** GetSwimSpeed(GetBaseSpeed()) - LevitateMotor's swim: GetBaseSpeed skips the crouch arm while it swims. */
  swimSpeedNow() {
    return swimSpeed(this._refreshWalkSpeed(), this.stats.swimming ?? 0);
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
   *  the simulation's own truth. Only cameras read eyeAt - and
   *  feetAt below, its positional half, for the one camera that
   *  builds its own height off the feet instead (AUDIT 65 XL-4).
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
    if (dx * dx + dy * dy + dz * dz > PlayerMotor.SNAP_SPAN * PlayerMotor.SNAP_SPAN) { this._eyeFeetY = null; return this.eye; }   // MAC1: a placement primes the eye filter afresh
    const a = Math.max(0, Math.min(1, alpha));
    const b = this.bobOffset;
    // MAC1: the height is the low-passed interpolated feet (`_smoothEyeFeet`)
    // when the frame's update has primed it; a read before any update,
    // or with an explicit alpha, is the plain interpolation.
    const feetY = (this._eyeFeetY != null && alpha === this._alpha) ? this._eyeFeetY : q[1] + dy * a;
    return [
      q[0] + dx * a + b[0],
      feetY + this._eyeLevel() + b[1] - this._downEye(),   // TELL6e: knocked down, the eye drops and rises
      q[2] + dz * a + b[2],
    ];
  }

  /** AUDIT 65 XL-4: the RENDER FEET - eyeAt's positional half, for a
   *  camera that builds its own height from the feet rather than
   *  reading the eye. The Morrowind third-person camera
   *  (mwCamera.eye, :198-233) takes `feet` and raises FOCAL_HEIGHT off
   *  it; the hosts handed it `player.pos` - the raw, 60 Hz-quantised
   *  stepped feet - while handing first person the smoothed `eyeAt`,
   *  so EV1's interpolation and MAC1's step low-pass were both
   *  bypassed the moment the player scrolled into third person (worst
   *  single-frame rise on the MAC1 staircase: 0.153 raw against
   *  eyeAt's 0.051 at 60 Hz).
   *
   *  The same span lerp, the same SNAP_SPAN guard and the same
   *  `_eyeFeetY` substitution as eyeAt - and deliberately NEITHER
   *  `_eyeLevel()` NOR `bobOffset`: the focal supplies its own height
   *  (FOCAL_HEIGHT, off the SCALED body) and the head bob is a
   *  first-person term, which a camera orbiting the body must not
   *  inherit.
   *
   *  `pos` stays the simulation truth everywhere else - the collider,
   *  the rays, activation - exactly as `eye` stays it for first
   *  person. The focal's ceiling probe (mwCamera.js:233-243) rides
   *  this too and still clears: the filter is never more than
   *  STEP_OFFSET off the raw height and only ever trails heights the
   *  capsule itself just occupied. */
  feetAt(alpha = this._alpha) {
    const p = this.pos, q = this._prevPos;
    const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
    if (dx * dx + dy * dy + dz * dz > PlayerMotor.SNAP_SPAN * PlayerMotor.SNAP_SPAN) { this._eyeFeetY = null; return [p[0], p[1], p[2]]; }   // MAC1: a placement primes the eye filter afresh
    const a = Math.max(0, Math.min(1, alpha));
    const feetY = (this._eyeFeetY != null && alpha === this._alpha) ? this._eyeFeetY : q[1] + dy * a;
    return [q[0] + dx * a, feetY, q[2] + dz * a];
  }

  /** DISC18 (2026-09-24, Mac: "my characterless [character's legs] are in the ground"): THE BODY'S FEET - EV1's span lerp alone,
   *  WITHOUT MAC1's low-pass. feetAt hands a camera the height the eye rides, low-passed over STEP_SMOOTH_TAU so a
   *  rung or a facet does not pop the view, and the hosts handed that same height to the third-person BODY. A
   *  low-pass trails a climb by the climb's vertical speed times its time constant: walking up a 30-degree hill the
   *  body stood 13 cm under the ground (23 running, 33 running up 40 degrees, up to a whole rung on a stair), and it
   *  floated as far over it going down. The body stands where the capsule stands; the camera keeps its smoothing,
   *  and the filter is left alone here. The same snap guard as feetAt. */
  bodyFeetAt(alpha = this._alpha) {
    const p = this.pos, q = this._prevPos;
    const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
    if (dx * dx + dy * dy + dz * dz > PlayerMotor.SNAP_SPAN * PlayerMotor.SNAP_SPAN) return [p[0], p[1], p[2]];
    const a = Math.max(0, Math.min(1, alpha));
    return [q[0] + dx * a, q[1] + dy * a, q[2] + dz * a];
  }

  /** MOVE-REAL: one step's own move onto the odometer - the span _prevPos latched before it to where the step (and
   *  the duel ring's clamp) left the feet, so a run into a wall that slides nowhere adds nothing. A step faster than
   *  any body moves is a placement, never motion. A carry (carryBy), a pin (pinFeet), a spawn and an origin shift
   *  happen outside the steps and are never counted. */
  _countOdometer(step) {
    const p = this.pos, q = this._prevPos;
    const h = Math.hypot(p[0] - q[0], p[2] - q[2]), v = Math.abs(p[1] - q[1]);
    if (!(h + v <= ODOMETER_MAX_SPEED * step)) return;
    this.odometer.h += h;
    this.odometer.v += v;
  }

  /** CSA-D: another script writes the PlayerObject's transform - Come Sail Away's helm pin (`playerObject.transform
   *  .position = DrivePosition`, each frame at the helm, the boat carrying its child after it). The body is put there
   *  and BOTH ends of the render span with it, so the eye does not lerp behind a moving deck; no motion state is
   *  touched (the motor is frozen at the helm, and a write to a transform is no teleport). */
  pinFeet(x, y, z) {
    this._pkMove = null;   // AUDIT CLIMB1 F4: a pin is a placement - the move it interrupts is over, never resumed
    if (this._wall) this._wallEnd();   // CLIMB2: and the hold it takes the body off
    this._pkOffEdge = null; this._pkLeap = null;   // AUDIT CLIMB-ARC L6: and the late press and the flight with it
    this._pkRestore = null;
    this.pos[0] = x; this.pos[1] = y; this.pos[2] = z;
    this._prevPos[0] = x; this._prevPos[1] = y; this._prevPos[2] = z;
    this._eyeFeetY = null;   // MAC1: the smoothing primes afresh on the pinned height
  }

  /** CSA-K: another player's boat carries whoever stands on its deck - the deck's own move put on the body and BOTH
   *  ends of the render span (a moving deck is no lerp across the carry, as the origin's shift is none), the smoothed
   *  eye with it, and a fall's start too, so a deck's rise is no fall. No motion state is touched: the carry is the
   *  deck's, and the body's own walk goes on in the world from where it stands. */
  carryBy(dx, dy, dz) {
    this._climbCarried[0] += dx; this._climbCarried[1] += dy; this._climbCarried[2] += dz;   // AUDIT CLIMB-ARC F8
    if (this._pkMove) offsetMove(this._pkMove, [dx, dy, dz]);   // AUDIT CLIMB1 F5: a move on the deck is carried with it
    if (this._wall?.lipY != null) this._wall.lipY += dy;   // CLIMB2: and a hold on it
    this._reanchor();   // CLIMB2: the deck's motion is carried here - the step's own carry must not take it again
    this.pos[0] += dx; this.pos[1] += dy; this.pos[2] += dz;
    this._prevPos[0] += dx; this._prevPos[1] += dy; this._prevPos[2] += dz;
    if (this._eyeFeetY != null) this._eyeFeetY += dy;
    if (this.falling) this.fallStart += dy;
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
    if (this.arena) this.arena = { ...this.arena, centre: [this.arena.centre[0] + offset[0], this.arena.centre[1] + offset[1], this.arena.centre[2] + offset[2]] };   // DUEL1: the ring is in the world, which moved
    if (this._eyeFeetY != null) this._eyeFeetY += offset[1];   // MAC1: the smoothed height shifts with the world too
    if (this._pkMove) offsetMove(this._pkMove, offset);   // CLIMB1: the move's path is in the world, which moved
    // CLIMB2: a hold's lip too; and a mover's remembered pose moves with the world, or the next step's carry takes the
    // recentre for the mover's own motion and shifts the body twice (a latent CLIMB1 F5 fault on a move)
    if (this._wall?.lipY != null) this._wall.lipY += offset[1];
    for (const c of [this._pkMove?.carrier, this._wall?.carrier]) {
      if (c) { c.t[0] += offset[0]; c.t[1] += offset[1]; c.t[2] += offset[2]; }
    }
  }

  /** CLIMB2: the move's and the hold's movers read afresh - a carry that already moved the body with them. */
  _reanchor() {
    if (this._pkMove?.carrier) this._pkMove.carrier = this.collider.bucketPose?.(this._pkMove.key) ?? this._pkMove.carrier;
    if (this._wall?.carrier) this._wall.carrier = this.collider.bucketPose?.(this._wall.key) ?? this._wall.carrier;
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
    this.arena = null;   // DUEL1: a placement is never a walk out of the ring - the host's duel law decides what it meant
    this._pkMove = null;   // CLIMB1: a placement is never the end of a mantle
    this._pkCrouchRestore = false;
    if (this._wall) this._wallEnd();   // CLIMB2: nor a hold
    this._pkOffEdge = null;   // AUDIT CLIMB-ARC L6: nor a run off an edge (a press after it is no late leap)...
    this._pkLeap = null;      // ...nor a leap's flight (the catch looks no old way)
    this._pkRestore = null;   // AUDIT CLIMB2 H1: a placement's own record follows it (restoreFall), never an older one
    this._pushX = 0; this._pushZ = 0; this._downLeft = 0; this._rattleLeft = 0;   // AUDIT TELL L2: nor a blow's push, knockdown or rattle
    this._heightReset();   // a pending height action does not ride a teleport/load
    this.holdFrame();   // DISC8-G: a landing reported before the warp is not the arrival's
  }

  /** FALL-KEPT (FIELD BUGS 2026-09-30; the report: "you can negate all fall damage by saving while falling right
   *  before you hit ground. once you load your save, you will land safely"; Mac: "Dont worry abour DFU"): A SAVE
   *  CARRIES THE FALL. DFU keeps the position, the yaw, the pitch and the crouch (SerializablePlayer.cs:204-226) and
   *  its load cancels the movement, so a fall saved a metre from the ground loaded a metre from the ground, from rest,
   *  and billed one metre. The fall is kept as how far above the feet it began, which rides the feet through the
   *  floating origin and a terrain re-stand, and the speed the body had. On a jump's rise it began below them, and the
   *  load lands the fall from the takeoff as the jump would have. A body that has touched down is still falling until
   *  the next step bills the landing, and a save in that step keeps the bill. Null when there is no fall. */
  fallSnapshot() {
    // AUDIT CLIMB2 H1: A HOLD IS NO FALL. A save on the wall (or the season's re-anchor) recorded none, and the load put
    // the body where it hung with nothing under it - a quicksave twelve metres up a tower loaded into a twelve-metre
    // fall. The hold is kept instead, and a move in flight as where it ends and the hold it ends in, all against the
    // feet, with the grip (a load is no rest); restoreFall takes the hold again (_pkRetake).
    let m = this._pkMove;
    while (m?.next) m = m.next;   // CLIMB-DOWN: a chained move ends where its last part does (over a parapet: the hang)
    const w = this._wall;
    if (m || w) {
      const end = m ? m.to : this.pos;
      const hold = m ? (m.hang ? { mode: 'hang', normal: m.hang.normal, lipY: m.hang.lipY }
        : m.wall ? { mode: 'climb', normal: m.wall.normal, lipY: null } : null) : w;   // AUDIT CLIMB-ARC L12: a wall run's face
      return {
        to: [end[0] - this.pos[0], end[1] - this.pos[1], end[2] - this.pos[2]],
        hold: hold ? { mode: hold.mode, normal: [hold.normal[0], 0, hold.normal[2]], lipAbove: hold.lipY != null ? hold.lipY - end[1] : null } : null,
        grip: this.grip,
      };
    }
    return this.falling ? { above: this.fallStart - this.pos[1], velY: this.velY } : null;
  }

  /** FALL-KEPT: the load's half, AFTER the placement's spawn has cleared every motion state - the fall begins again
   *  where it began against the feet, at the saved speed, each bounded by the world's tallest drop (FALL_CARRY_MAX).
   *  A torn or absent record carries nothing, so a save without one lands as every save did. */
  restoreFall(fall) {
    if (fall && (fall.hold !== undefined || fall.to !== undefined)) {   // AUDIT CLIMB2 H1: a hold, or a move's end
      const to = fall.to;
      if (Array.isArray(to) && to.length === 3 && to.every(Number.isFinite)) {
        for (let i = 0; i < 3; i++) {
          const d = Math.min(HOLD_CARRY_MAX, Math.max(-HOLD_CARRY_MAX, to[i]));
          this.pos[i] += d; this._prevPos[i] += d;
        }
        this._eyeFeetY = null;
      }
      if (Number.isFinite(fall.grip)) this.grip = Math.min(1, Math.max(0, fall.grip));
      const h = fall.hold, n = h?.normal, l = Array.isArray(n) ? Math.hypot(n[0], n[2]) : 0;
      if ((h?.mode === 'hang' || h?.mode === 'climb') && l > 1e-6 && Number.isFinite(l)) {
        this._pkRestore = { mode: h.mode, normal: [n[0] / l, 0, n[2] / l], lipAbove: Number.isFinite(h.lipAbove) ? h.lipAbove : null };
      }
      return;
    }
    if (!Number.isFinite(fall?.above)) return;
    this.falling = true;
    this.fallStart = this.pos[1] + Math.min(FALL_CARRY_MAX, Math.max(-FALL_CARRY_MAX, fall.above));
    if (Number.isFinite(fall.velY)) this.velY = Math.min(FALL_CARRY_MAX_SPEED, Math.max(-FALL_CARRY_MAX_SPEED, fall.velY));
  }

  /** DUEL1: THE RING'S WALL, as the body meets it. Mac: "a surrounding transparent holographic wall that keeps them
   *  from going outside of the duel space". Not a mesh in the collider - the collider is shared, and a wall there would
   *  stop arrows, foes, the camera and the activation rays, and could be climbed or levitated over - but a clamp on the
   *  ground: the feet kept within the radius less the capsule's own, and whatever of the airborne momentum points out
   *  of the ring taken away (a jump at the wall stops at it; along it, it carries on). Height is never touched, so a
   *  levitating or swimming duellist is held the same. */
  _keepInArena() {
    const a = this.arena;
    const c = a?.centre;
    if (!c || !(a.radius > 0)) return;
    // AUDIT ARENA-LADDER: A CEILING OVER THE SAND (the owner's kit law, 'No cheese spells or potions' - systems/arenaKit.js
    // SAND_CEILING_M): a ring that names one (`ceilAbove`, metres over its centre - the sand) holds the body under it, its
    // rise taken away; the duel's and the gate's rings name none, and their height is never touched
    if (Number.isFinite(a.ceilAbove) && this.pos[1] > c[1] + a.ceilAbove) { this.pos[1] = c[1] + a.ceilAbove; if (this.velY > 0) this.velY = 0; }
    // WB9b: an arena with a clamp of its own - the gate's three courts and the walkways laid between them
    // (world/gateArena.js courtArena, net/gateBrain.js clampToFloor - the relay's law of the floor)
    if (typeof a.clamp === 'function') { this._putBack(a.clamp(this.pos, CAPSULE_RADIUS)); return; }
    // AUDIT DUEL1 D4: THE ONE CLAMP (net/duelSession.js clampToRing), the geometry the duel's own pins drive
    const to = clampToRing(this.pos, c, a.radius, CAPSULE_RADIUS);
    this._putBack(to);
  }

  /** The body put back at `to` ([x, z] - or null, where it already stands), and whatever of its airborne momentum points
   *  out of the floor taken away - outward from where it is put back to where it had got to (a ring's radius, a
   *  walkway's side). */
  _putBack(to) {
    if (!to) return;
    const dx = this.pos[0] - to[0], dz = this.pos[2] - to[1];
    const d = Math.hypot(dx, dz);
    const nx = d > 1e-9 ? dx / d : 1, nz = d > 1e-9 ? dz / d : 0;
    this.pos[0] = to[0];
    this.pos[2] = to[1];
    const out = this._airVelX * nx + this._airVelZ * nz;
    if (out > 0) { this._airVelX -= out * nx; this._airVelZ -= out * nz; }
  }

  /** DISC8-G: a render frame the host HOLDS the motor on (a pausing
   *  window - the death screen, the respawn box, the court - or the
   *  season screen) steps nothing, so it reports nothing. The report
   *  flags are per-frame and only update() cleared them, so a host that
   *  read them on a held frame billed the frame BEFORE the hold again,
   *  once per held frame: a fatal fall charged through the death screen
   *  killed the respawned player at the respawn point, again and again
   *  until a reload built a fresh motor (Discord: "When I die from fall
   *  damage ... I spawn in the air, and fall down and die"). DFU cannot
   *  do this: its FixedUpdate does not run under PauseGame's timeScale
   *  0, and CheckFallingDamage bills a landing once. */
  holdFrame() {
    this.jumped = false;
    this.parkoured = null;
    this.landedFallDistance = 0;
    // AUDIT CLIMB-ARC F2: and the climb's events - the feel and the sounds read them every frame, and a frame the host
    // held on replayed the last step's catch, launch and turn once a frame for as long as the window stood
    if (this.climbEvents.length) this.climbEvents = [];
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
    const half = this._halfSpeedBase();   // DW-D: and the walk arm through RefreshWalkSpeed's modifiers
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
    if (!this.crouching) this._pkCrouchRestore = false;
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
    // AUDIT CLIMB2 C2: and a body the hands hold (on the wall, or in a move they make) is out of the water - the
    // hosts' flag reads deep water up to 2 m under the capsule's centre, and the sink arms above the hold's own sank a
    // hang from a quay to the swimmer's 0.3 m and swallowed the Crouch that lets go
    const onWater = !!this.onExteriorWater && !this.levitating && !this._wall && !this._pkMove;
    if (this.levitating && this.crouching) {
      // (:139-143) the crouched levitator is stood and the method
      // RETURNS - no sink arm, no crouch block.
      this.heightAction = 'stand';   // timerMax is NOT set here, DFU keeps its last
    } else if (onWater && !this.toggleSink) {
      // DoSinking (:147-152, :390-434) on the SLOW clock - the capsule's
      // own change guarded by controllerSink (:392), as DoSinking's is.
      this.toggleSink = true;
      if (!this.sunk) this._beginSink();
      else { this.heightAction = 'sink'; this.heightTimerMax = HEIGHT_TIMER_SLOW; }
    } else if (!onWater && this.toggleSink) {
      // DoUnsinking (:153-158, :352-388), same clock, guarded by :354.
      this.toggleSink = false;
      if (this.sunk) this._beginUnsink();
      else { this.heightAction = 'unsink'; this.heightTimerMax = HEIGHT_TIMER_SLOW; }
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
    } else if (this._pkMove) {
      // AUDIT CLIMB1 F1: a move in flight owns the stance - the sensor proved its
      // path at one height, and a crouch toggled mid-move could stand the body
      // up into the ceiling a crouched mantle passes under. (A pending action
      // below still runs its clock: the crouched move's own eye.)
    } else if (this._wall) {
      // CLIMB2: on the wall Crouch LETS GO (Mac's "Crouch drops") and toggles no
      // stance - the press is the step's to spend; and the body hangs and climbs
      // standing, as the climbing arm below forces it (:184-191).
      if (input.crouch) this._pkDropReq = true;
      this.heightTimerMax = HEIGHT_TIMER_MEDIUM;
      if (this.crouching) this.heightAction = 'stand';
    } else if (input.crouch && (!this.swimming || this.grounded)) {
      this._pkCrouchRestore = false; // An accepted player stance request takes ownership back.
      this.heightAction = this.crouching ? 'stand' : 'crouch';
      this.heightTimerMax = HEIGHT_TIMER_FAST;
      this.forcedSwimCrouch = false;
    } else if (this._pkCrouchRestore && !this.swimming && capsuleFits(this.collider, this.pos, CAPSULE_HEIGHT)) {
      // A mantle may need a short capsule only for its path. Keep it under the ceiling, then restore
      // the original standing stance once the WHOLE capsule fits, not merely the camera's stand sweep.
      this._pkCrouchRestore = false;
      this.heightAction = 'stand';
      this.heightTimer = 0;
      this.heightTimerMax = HEIGHT_TIMER_FAST;
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
    } else if (!Number.isFinite(this.collider.sphereCast(
      [this.pos[0], this.pos[1] + this.height / 2, this.pos[2]],
      CAPSULE_RADIUS, [0, 1, 0], CROUCH_TO_STAND_DIST).dist)) {
      // AUDIT 64 F5 - CanStand, VERBATIM (PlayerHeightChanger.cs
      // :525-531): `Ray(controller.transform.position, Vector3.up)` and
      // `!Physics.SphereCast(ray, controller.radius, distance)` with
      // distance = camCrouchToStandDist (:115) = 0.45. The origin is
      // the LIVE controller CENTRE - ControllerHeightChange (:473-479)
      // keeps the feet planted while the height changes, so it is feet
      // + height/2, which is feet+0.45 on the first tick (still
      // crouched) and feet+0.9 on the retries after the flip below.
      // Crouched, the swept sphere therefore tops out at 0.45 + 0.45 +
      // 0.35 = feet+1.25: DFU clears room for the CAMERA's rise, not
      // for the 1.8 capsule, and DoStand (:265-283) raises the capsule
      // regardless, letting the head clip. The port demanded the whole
      // standing capsule fit at the current feet - 0.55 stricter - so
      // under a ceiling between ~1.25 and 1.8 the crouch key was a
      // one-way trip where DFU pops the player up.
      //
      // The pass condition is `!Number.isFinite(dist)`, not a
      // comparison against the distance: collider.sphereCast
      // (collider.js:1336) returns Infinity ONLY on a clear sweep and a
      // finite dist (0 on a start-overlap) for any hit, which is
      // exactly Unity's boolean. One accepted deviation: Unity's
      // SphereCast ignores colliders overlapping the START sphere, so a
      // ceiling below feet+0.80 would make DFU's CanStand return true
      // while ours refuses - that band is inside the 0.9 crouched
      // capsule and so unreachable.
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

  /** DW-D: `PlayerHeightChanger.HeightAction = DoUnsinking`, written from
   *  outside (Iliac Puddle No More's KeepSurfaceCameraUnsunk,
   *  RequestStandAfterWaterExit and ClearBoatSwimPose - each gated on
   *  IsInWaterTile or a pending DoSinking, and never over a DoUnsinking
   *  already under way). DoUnsinking's capsule work (:354-378) is the
   *  arming block's; toggleSink is DecideHeightAction's and stays. */
  forceUnsink() {
    if (this.heightAction === 'unsink') return;
    if (this.sunk) this._beginUnsink();
  }
  /** DW-D: `HeightAction = DoStanding` from outside (the same mod's stand
   *  after a water exit): Update runs DoStand when CanStand, as the
   *  pending action's own tick does. */
  forceStand() { this.heightAction = 'stand'; }
  /** PlayerHeightChanger.IsInWaterTile - written beside controllerSink by DoSinking/DoUnsinking. */
  get isInWaterTile() { return this.sunk; }

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
    // The HELD reads (:72-78) are HasAction and live here; the two
    // press edges are ActionStarted, captured in _captureInputActions.
    if (!this._toggleRun) this._runMode = !!input.run;
    else if (this._runStarted) this._runMode = !this._runMode;
    if (getBool('Controls', 'ToggleSneak')) {
      if (this._sneakStarted) this._sneakMode = !this._sneakMode;
    } else {
      this._sneakMode = !!input.sneak;
    }
    // AUTORUN (:82-99): the press flips InputManager.ToggleAutorun and
    // hands it to ToggleRun, and enabling it while NOT already running
    // forces the run mode on ("this allows a player already running to
    // keep running instead of moving to autowalking" - isRunning here
    // is last step's, as DFU's is). The press is refused while
    // MoveBackwards is held, and MoveBackwards drops both latches -
    // ToggleRun on the press edge here, ToggleAutorun on the HELD key
    // over in InputManager (:1851) - the second clear, and the press
    // edges this arm reads, live in _captureInputActions below,
    // because InputManager.Update carries no levitation gate.
    // DFU's own forward force under autorun lives in InputManager and
    // is the input layer's half (MoveAxes carries it - AUDIT 64 F3);
    // this is PlayerSpeedChanger's.
    const autoRunStarted = this._autoRunStarted;
    const backHeld = !!input.back;
    if (autoRunStarted && !backHeld) {
      this._autorun = !this._autorun;
      this._toggleRun = this._autorun;
      if (this._toggleRun && !this.isRunning) this._runMode = !this._runMode;   // ^= ToggleAutorun, true in this arm
    }
    if (this._backStarted) this._toggleRun = false;   // PlayerSpeedChanger.cs:96-99 - ActionStarted, the press EDGE
  }

  /** InputManager.Update's own half of the AutoRun law - the part
   *  that is NOT PlayerSpeedChanger's and therefore NOT under
   *  PlayerMotor.Update's levitation return.
   *
   *  Two things live here. (1) The action press EDGES for all four
   *  keys PlayerSpeedChanger reads - AutoRun, MoveBackwards, Run and
   *  Sneak. `ActionStarted` (`InputManager.cs:626-629`) is
   *  `!previousActions.Contains(a) &&
   *  currentActions.Contains(a)` over lists InputManager.Update
   *  rebuilds every frame (:463-464 copies currentActions into
   *  previousActions, FindKeyboardActions refills it) - no levitation
   *  test anywhere on that path. (2) The ToggleAutorun clear
   *  (`InputManager.cs:1850-1852`): MoveBackwards HELD inside
   *  FindKeyboardActions' `if (GetKey(...))` loop zeroes the latch
   *  outright, where PlayerSpeedChanger.cs:96-99 clears only ToggleRun
   *  and only on the press EDGE.
   *
   *  AUDIT 64 review: both had been written into
   *  _captureSpeedAdjustment, which update() calls only `if
   *  (!this.levitating)` - the faithful mirror of PlayerMotor.cs
   *  :371-375, whose early return sits above
   *  `speedChanger.CaptureInputSpeedAdjustment()`. InputManager.Update
   *  has no such gate, so a LEVITATING player holding MoveBackwards
   *  kept the latch and resumed flying forward the moment the key
   *  lifted, and a key held across the levitation window read as a
   *  synthetic press on the frame the gate reopened. Running the
   *  clear ahead of the toggle arm is safe in either script order,
   *  because :82-83 refuses the AutoRun press while MoveBackwards is
   *  held anyway. (:1917 is the joystick mirror; no gamepad lane in
   *  the port.) */
  _captureInputActions(input) {
    this._autoRunStarted = !!input.autoRun && !this._prevAutoRunHeld;
    this._prevAutoRunHeld = !!input.autoRun;
    this._runStarted = !!input.run && !this._prevRunHeld;
    this._prevRunHeld = !!input.run;
    this._sneakStarted = !!input.sneak && !this._prevSneakHeld;
    this._prevSneakHeld = !!input.sneak;
    const backHeld = !!input.back;
    this._backStarted = backHeld && !this._prevBackHeld;
    this._prevBackHeld = backHeld;
    if (backHeld) this._autorun = false;
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
    this.parkoured = null;
    if (this.climbEvents.length) this.climbEvents = [];
    this.landedFallDistance = 0;
    // TO1: MAX_FRAME_DT IS UNITY'S `Time.maximumDeltaTime`, WHICH IS AN
    // UNSCALED BOUND. Unity clamps the REAL frame first and applies the
    // time scale after (`deltaTime = min(unscaledDeltaTime,
    // maximumDeltaTime) * timeScale`), so a x50 journey's frame is fifty
    // times as long as an ordinary one and the jank guard still bites at
    // the same quarter-second of WALL clock. Clamping the scaled number
    // against the unscaled bound instead would silently cap the journey
    // at about x15 on a 60 Hz screen - the clock accelerating while the
    // player did not - which is the shape the field would report as
    // "the estimate never matches the ground covered". At a scale of 1
    // this is exactly MAX_FRAME_DT.
    // ...and the SCALE IS APPLIED HERE, not by the caller. Unity's
    // physics reads `Time.deltaTime` and `Time.fixedDeltaTime` off the
    // global clock; its callers hand it nothing. So every host hands
    // this the REAL frame, as all four always have, and the motor
    // scales it - which is why `player.update(dt, ...)` is unchanged in
    // all four of them and a journey still accelerates the traveller.
    const scale = timeScale();
    const frameDt = Math.min(dt, MAX_FRAME_DT) * scale;
    // InputManager.Update's half of the input capture - press edges
    // and the ToggleAutorun clear - runs BEFORE and OUTSIDE the
    // levitation gate below, because InputManager has none.
    this._captureInputActions(input);
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
    // TO1: THE STEP IS `Time.fixedDeltaTime`, AND IT SCALES WITH THE
    // CLOCK. Travel Options runs an accelerated journey by setting
    // Unity's `Time.timeScale` - and, in the same method and for the
    // reason its own comment gives ("Must set fixed delta time to scale
    // the fixed (physics) updates as well", TravelOptionsMod.cs:386),
    // `Time.fixedDeltaTime = timeScale * baseFixedDeltaTime`. Its host
    // hands this update a dt already multiplied by the scale; without
    // the second half a x50 journey would ask for fifty times the
    // STEPS - three thousand a second - instead of steps fifty times
    // as long, which is a freeze rather than a fast walk. At a scale of
    // 1, which is every frame that is not an accelerated journey, this
    // is exactly FIXED_DT and nothing changes.
    const step = FIXED_DT * scale;
    this._acc = (this._acc ?? 0) + frameDt;
    const moveInput = this._downLeft > 0 ? { ...input, forward: 0, strafe: 0, back: false, jump: false, autoRun: false, up: false, down: false } : input;   // TELL6e: knocked down - no move
    while (this._acc >= step) {
      this._acc -= step;
      if (this._rattleLeft > 0) this._rattleLeft = Math.max(0, this._rattleLeft - step);   // TELL6e
      if (this._downLeft > 0) this._downLeft = Math.max(0, this._downLeft - step);
      // EV1: latch the span's START. Per step, so a multi-step frame
      // interpolates across the LAST step only (the standard
      // fix-your-timestep shape) and a zero-step frame keeps the
      // previous span and just advances alpha.
      this._prevPos[0] = this.pos[0]; this._prevPos[1] = this.pos[1]; this._prevPos[2] = this.pos[2];
      this._step(step, moveInput, yaw, pitch);
      this._pushStep(step);   // TELL6e: a blow's push, after the step's own move
      if (this.arena) this._keepInArena();   // DUEL1: after the collider's move, so both ends of the span stand inside
      this._countOdometer(step);   // MOVE-REAL
    }
    this._alpha = Math.min(1, this._acc / step);
    this._smoothEyeFeet(frameDt);   // MAC1: once per RENDER frame, like the bob and the look
    this._stepBodyYaw(frameDt, yaw);   // CLIMB5: the body turns to the wall it holds, and back
  }

  /** CLIMB5: ease the body's yaw toward the climb's facing (on the wall, in a move), and back to the view's after -
   *  then let go of it (null), so off the wall the body is the view's yaw exactly, as it always was. */
  _stepBodyYaw(dt, viewYaw) {
    const face = this.climbFacing;
    if (face == null && this._bodyYaw == null && this._bodyYawOff == null) return;
    const k = 1 - Math.exp(-Math.max(0, dt) / BODY_TURN_TAU);
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    if (face != null) {
      const from = this._bodyYaw ?? viewYaw + (this._bodyYawOff ?? 0);
      this._bodyYaw = from + wrap(face - from) * k;
      this._bodyYawOff = null;
      return;
    }
    // AUDIT CLIMB-ARC N4: off the wall the body is handed back to the view by an OFFSET from it that decays on the
    // clock alone - the view's own turning never feeds it (a body chasing a turning view trails it by w * tau for as
    // long as it turns); the view's yaw exactly within a few time constants of the let-go
    if (this._bodyYaw != null) { this._bodyYawOff = wrap(this._bodyYaw - viewYaw); this._bodyYaw = null; }
    const off = this._bodyYawOff * (1 - k);
    this._bodyYawOff = Math.abs(off) < 1e-3 ? null : off;
  }

  /** MAC1 (Mac, 2026-09-10: "Fix Jittery hills and stairs"). The step
   *  ladder (collider.js) lifts the feet a whole rung in ONE physics
   *  step and the snap drops them a whole tread, where Unity's
   *  controller slides the same rung across several fixed updates; the
   *  port's camera, riding eyeAt, popped with the feet - and on a
   *  terrain of facets every triangle edge was a small step. This
   *  low-passes the height the RENDER eye rides - EV1's interpolated
   *  feet, the thing eyeAt already reads - over STEP_SMOOTH_TAU, so a
   *  rung is climbed by the eye across a few frames and the feet still
   *  arrive in one. Never more than a rung behind (STEP_OFFSET). A jump
   *  or a fall is not a step: while either is up the filter follows
   *  the raw height exactly, and re-engages from it on landing with no
   *  seam. Only eyeAt carries it - `eye`, the simulation's own eye and
   *  every ray's, is untouched. A placement (eyeAt's snap guard) primes
   *  the filter afresh. */
  _smoothEyeFeet(frameDt) {
    const raw = this._prevPos[1] + (this.pos[1] - this._prevPos[1]) * this._alpha;
    if (!this._eyeSmoothing || this.jumping || this.falling || this._pkMove || this._wall || this._eyeFeetY == null) { this._eyeFeetY = raw; return; }   // CLIMB1: a mantle is not a stair either; CLIMB2: nor a climb up the wall
    const k = 1 - Math.exp(-frameDt / STEP_SMOOTH_TAU);
    let y = this._eyeFeetY + (raw - this._eyeFeetY) * k;
    if (y - raw > STEP_OFFSET) y = raw + STEP_OFFSET;
    else if (raw - y > STEP_OFFSET) y = raw - STEP_OFFSET;
    this._eyeFeetY = y;
  }

  /** M3: the wall probe - CollisionFlags.Sides + GetClimbedWallInfo's
   *  capsule cast (:591), as rays along the wall direction (the
   *  latched ledge direction, else the facing), reach radius + 0.1. A
   *  hit latches myLedgeDirection = the horizontal -normal (:608), so
   *  turning the camera mid-climb keeps the hug on the WALL's plane,
   *  not the look. Documented departure: DFU reads the controller's
   *  side collision flags; the probe asks the same physical question
   *  against our collider.
   *
   *  DISC21 (2026-09-24, "you can climb up walls a bit but you fall
   *  right back down as you reach the top instead of getting over the
   *  edge"): THE SIDES FLAG IS THE WHOLE CAPSULE'S, DOWN TO ITS FEET.
   *  The probe sampled only 0.4h and 0.8h above the feet, so the wall
   *  went "untouched" while the bottom 0.72 m of the body still hugged
   *  it: :396 (`!touchingSides`) stopped the climb with the feet 0.72 m
   *  under the lip, and the player fell back down - the lip is above
   *  the step offset, and a falling body takes no step. DFU's capsule
   *  keeps its Sides contact until its lower cap clears the lip: the
   *  cap's skin shell (radius + 0.1 about the cap's centre, feet + r)
   *  meets a wall its side rests against at CLIMB_CAP_LOW above the
   *  feet, so the lowest ray sits there and reads the wall face exactly
   *  as long as the cap can still touch the lip's corner. Then the hug
   *  - up and into the wall - carries the feet over the lip onto the
   *  top, as ClimbingMotor's own move does (:756-767). */
  _climbWallProbe(yaw) {
    // a facade collider without the ray API disables climbing rather
    // than crashing the step
    if (!this.collider.raycastHit) return { touching: false, wallDir: null };
    const dir = this._climbWallDir ?? [Math.sin(yaw), 0, Math.cos(yaw)];
    const reach = CLIMB_SIDE_REACH;
    for (const y of [this.height * 0.4, this.height * 0.8, CAPSULE_RADIUS, CLIMB_CAP_LOW]) {
      const o = [this.pos[0], this.pos[1] + y, this.pos[2]];
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

  /** ClimbingMotor.cs:318-320's "ground directly below too close for climbing": a ray from the capsule's centre,
   *  height/2 + CLIMB_GROUND_NEAR down. AUDIT CLIMB2 C6: the ground is the terrain's too - Unity's ray meets the
   *  TerrainCollider, and the collider's raycast meets meshes only, so outdoors neither climb ever found the ground
   *  (surfaceHit answers the nearer of the two; a host's stand-in collider without it, the meshes alone). */
  _groundNear() {
    const o = [this.pos[0], this.pos[1] + this.height / 2, this.pos[2]], down = [0, -1, 0], d = this.height / 2 + CLIMB_GROUND_NEAR;
    return Number.isFinite(this.collider.surfaceHit ? this.collider.surfaceHit(o, down, d).dist : this.collider.raycast(o, down, d));
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
      slowFalling: this.slowFalling,   // SLOW-GRASP: no airborne grasp begins on a slow fall (climbing.js)
      grounded: this.grounded,
      levitating: this.levitating,
      riding: isRiding(this.transportMode),   // TR1: ClimbingMotor :398 - no climbing from a saddle
      touchingSides: probe.touching,
      horizontalPos: [this.pos[0], this.pos[2]],
      // ":318-320: ground directly below too close for climbing" -
      // from the capsule center, height/2 + 0.12 down
      tooCloseToGround: () => this._groundNear(),
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
      // CLIMB-PAST: and the live Climbing the check reads, whose points past 100 climb faster (climbing.js)
      const ci = climb.deps?.inputs?.() ?? {};
      const r = this.collider.move(this.pos,
        wd[0] * this.speed * dt, climbingSpeed(this.speed, !!ci.enhanced, ci.climbing ?? 0) * dt, wd[2] * this.speed * dt,
        this.height, false);
      this.grounded = r.grounded;
    } else {
      // slipping: a plain gravity fall against the wall (:760-764).
      // The fall INIT anchors at the slip start; the landing is NOT
      // billed here - the machine sees slippedToGround next step,
      // stops, and the normal grounded bookkeeping bills the drop.
      if (!this.falling) { this.falling = true; this.fallStart = this.pos[1]; this.velY = 0; }
      // SLOW-SLIP (FIELD BUGS 2026-10-01): ApplyGravity's slowfall arm rides the slip too - the flat 2.1 m/s with the
      // fall re-anchored each tick, as the walk arm's below. The slip integrated plain gravity and anchored its fall
      // once, at the let-go: a slip under the spell hit the floor at ~20 m/s and billed the whole slip.
      if (this.slowFalling) { this.fallStart = this.pos[1]; this.velY = -SLOWFALL_VELOCITY; }
      else this.velY -= GRAVITY * dt;
      const r = this.collider.move(this.pos, 0, this.velY * dt, 0, this.height);
      this.grounded = r.grounded;
      if (r.grounded) this.velY = 0;
    }
    // AUDIT 65 XL-5: the two cached fields the swim/levitate branch
    // writes for the SAME reason - the climb is the other disjunct of
    // the very statement that zeroes moveDirection (:322-326), and
    // `this.standing` / `movingLessThanHalfSpeed` are a port-side
    // cache of what DFU answers live. Without them a grounded forward
    // climb start carried the pre-climb `standing = false` into the
    // footstep gate, the townsfolk politeness gate and the stealth
    // senses, because _step's climb return sits above BOTH remaining
    // writers (the cancelMovement block and the swim/levitate branch).
    // The freezeMotor return that sits between the cancel block and
    // the climb call stays bare ON PURPOSE: PlayerMotor.cs:296-307
    // does NOT zero moveDirection, so DFU's getters keep reading the
    // pre-freeze vector there and a write would be the divergence.
    // No departure here: DFU refreshes `grounded` at the top of the
    // next FixedUpdate (PlayerMotor.cs:278) out of the collisionFlags
    // ClimbingMotor.cs:767 writes after its own controller.Move, so the
    // collider's LIVE grounded written above IS DFU's answer, one step
    // lagged on both sides (the SWIM branch is the one that latches: Player-Arc.md:1903).
    this.standing = this.grounded;   // PlayerMotor.cs:325 - moveDirection zeroed, so :113-125 collapses to grounded
    this.movingLessThanHalfSpeed = this.grounded
      ? true
      : this._halfSpeedBase() / 2 >= this.speed;   // :168-181 over the STALE UpdateSpeed field, the same quirk the hug rides
    return true;
  }

  /** CLIMB1: a move is in flight - a mantle, a clamber or a vault; CLIMB2's
   *  catch into a hang and a corner the shimmy turns. (The head bob needs no
   *  read of it - a move is never grounded, and the bob stands still off the
   *  ground; CLIMB4's arms and camera are its first readers.) */
  get mantling() { return !!this._pkMove; }

  /** CLIMB2: on the wall - hanging from a lip, or free-climbing a face. */
  get onWall() { return !!this._wall; }
  /** CLIMB4: the move in flight (read-only: its kind, its clock `t`), or null - the feel's and the sounds'. */
  get climbMove() { return this._pkMove; }
  /** AUDIT CLIMB-ARC F3/F8: the body's OWN way on the wall, a frame at a time: the render-frame feet (bodyFeetAt - the
   *  60 Hz physics point stood still on every other frame of a fast screen, and the rhythm jittered) less what a moving
   *  hold carried it (a lift's rise is no climb). The feel's, the sounds' and the body's rhythm read its change. */
  climbTrackPos() {
    const f = this.bodyFeetAt();
    return [f[0] - this._climbCarried[0], f[1] - this._climbCarried[1], f[2] - this._climbCarried[2]];
  }
  /** CLIMB4: the held wall's normal (out of it, level), or null. */
  get wallNormal() { return this._wall?.normal ?? null; }
  /** CLIMB6: the hold the hands have ({ mode, lipY } - a free climb's lipY null), or null: the body's hands go on it. */
  get climbHold() { return this._wall ? { mode: this._wall.mode, lipY: this._wall.lipY } : null; }
  /** CLIMB6: a leap's flight ({ dir } - the eject's, the running leap's), or null: the body's arms reach for the catch. */
  get climbFlight() { return this._pkLeap; }
  /** CLIMB5: the way the body faces on the climb, in the view's yaw (forward = [sin, 0, cos]) - into the wall held, or
   *  the wall a move ends on, else the move's own way (a mantle, a vault); null off the wall and out of a move. */
  get climbFacing() {
    const m = this._pkMove;
    const n = this._wall?.normal ?? m?.hang?.normal ?? m?.wall?.normal ?? null;
    if (n) return Math.atan2(-n[0], -n[2]);
    if (!m) {
      // AUDIT CLIMB-ARC N3: the classic climb faces its wall too (myLedgeDirection, latched into the wall)
      const d = this.climb?.isClimbing ? this._climbWallDir : null;
      return d ? Math.atan2(d[0], d[2]) : null;
    }
    const dx = m.to[0] - m.from[0], dz = m.to[2] - m.from[2];
    return dx * dx + dz * dz > 1e-6 ? Math.atan2(dx, dz) : null;
  }
  /** CLIMB5: the yaw the body is drawn at (third person) for a view at `viewYaw` - the view's own, except on the climb
   *  and the moment after it, when it turns to the wall and back (BODY_TURN_TAU). */
  bodyYawFor(viewYaw) { return this._bodyYaw ?? (this._bodyYawOff == null ? viewYaw : viewYaw + this._bodyYawOff); }
  /** CLIMB2: hanging from a lip. */
  get hanging() { return this._wall?.mode === 'hang'; }
  /** CLIMB2: the grip the HUD shows ({ amount, low }) - on the wall, and while it comes back after; null otherwise. */
  get gripShown() { return this._wall || this.grip < 1 ? { amount: this.grip, low: this.grip <= PARKOUR_GRIP_LOW } : null; }

  /** CLIMB1/CLIMB2 - THE ENHANCED CLIMB'S STEP (player/parkour.js). A move in
   *  flight owns the step until it ends; a hold on the wall owns it until it
   *  lets go (_wallStep). Otherwise three things can start one, each along the
   *  look:
   *    - JUMP ON THE GROUND, behind the jump's own 0.1 s grounded gate: a
   *      lip in reach is climbed onto (or over, a thin top), or with Forward
   *      held vaulted, INSTEAD of the jump; no lip and the jump below goes as
   *      ever. The Jump a move spent is not pressed again until it is let go
   *      (AUDIT CLIMB1 F7);
   *    - JUMP HELD IN THE AIR (Mac: "Jump is the grab"): a lip coming into
   *      reach while rising or falling is caught - if the fall so far is one
   *      the Climbing skill holds (F6: "Skill scales it") and the grip is not
   *      spent. CLIMB2: a lip at the chest or higher is HELD - the body hangs
   *      from it - unless Forward is held, which climbs straight on over it
   *      (Forward climbs up); a lower one is stepped onto. With Forward held
   *      and no lip to take, the hands take the wall itself: a free climb;
   *    - CLIMB2: FORWARD HELD AGAINST A WALL, still, on the ground or in the
   *      water, for the skill's start time: a free climb (Mac's "Free-climb on
   *      grip") - on this lane in place of the classic climb and its rolls.
   *  Never from a saddle, levitation or paralysis, and nothing but the free
   *  climb from water. Every climb asks Roleplay & Realism's gate first (F10);
   *  a vault does not. The reach and the pace are the Climbing skill's, the
   *  reach less under a heavy pack, a vault's pace the Jumping skill's
   *  (parkourSkill, jumpingSkill - neither gates a move). */
  _parkourStep(dt, input, yaw) {
    const pk = this.parkour;
    this._pkOn = false;
    this._pkLookNow = [Math.sin(yaw), 0, Math.cos(yaw)];   // CORNER-TOP (AUDIT): the look a hold is taken with (_wallBegin)
    if (!pk) return false;
    // THE TAP CATCH (PARKOUR_ARM_GRACE_S): a fresh press arms the air catch for the jump it makes - the body down
    // again (or never off the ground), a move or a let-go ends it (the water asks no catch: mode, below)
    // AUDIT CLIMB-ARC L10: the pace the body really went last step (the applied speed is the input's - a run held into a
    // wall applies the run's speed and goes nowhere)
    const was = this._pkLastPos;
    this._pkPace = was && dt > 0 ? Math.hypot(this.pos[0] - was[0], this.pos[2] - was[2]) / dt : 0;
    this._pkLastPos = [this.pos[0], this.pos[1], this.pos[2]];
    const pressed = !!input.jump && !this._pkJumpWas;
    this._pkJumpWas = !!input.jump;
    if (pressed) this._pkArm = { t: 0, air: !this.grounded };
    else if (this._pkArm) {
      const a = this._pkArm;
      a.t += dt;
      if (!this.grounded) a.air = true;
      else if (a.air || a.t > PARKOUR_ARM_GRACE_S) this._pkArm = null;
    }
    if (!input.jump) { this._pkJumpLatch = false; if (!this._pkArm) this._pkSaid = false; }   // said once a jump, armed or held
    if (this._pkMove) { this._pkOn = true; this._parkourAdvance(dt); return true; }
    // CLIMB3: the late press's clock - running on the ground, then off it without a jump - and a leap's flight, over
    // once the body is down (or held, or in the water)
    // AUDIT CLIMB-ARC L4/L5: the clock keeps the RUN's way and the spot it left the floor from, and is kept only where a
    // Jump at the edge would have leapt - running at pace, standing, off a real drop (senseDrop from the last floor) - so
    // a late press is the at-edge leap, never a turn in the air nor a leap off a step or a crouch
    if (this.grounded) {
      this._pkOffEdge = this.isRunning && input.forward > 0 && !this.crouching && this._pkAtPace()
        ? { t: 0, dir: [Math.sin(yaw), 0, Math.cos(yaw)], at: [this.pos[0], this.pos[1], this.pos[2]], ok: null } : null;
    } else if (this._pkOffEdge != null) {
      const o = this._pkOffEdge;
      if (o.ok == null) o.ok = !this.jumping && senseDrop(this.collider, o.at, o.dir, CAPSULE_RADIUS, PARKOUR_RUNLEAP_EDGE);
      if (!o.ok || this.jumping || (o.t += dt) > PARKOUR_COYOTE_S) this._pkOffEdge = null;
    }
    if (this.grounded || this.swimming || this.sunk || this._wall) this._pkLeap = null;
    const on = this._pkOn = !!pk.enabled?.();
    const unheld = this.levitating || this.riding || this.paralyzed;   // nothing holds a wall from these
    if (this._pkRestore) {   // AUDIT CLIMB2 H1: the hold a save (or a re-anchor) carried, taken again where the body was put
      const r = this._pkRestore;
      this._pkRestore = null;
      if (on && !unheld && !this._wall) this._pkRetake(r);
    }
    if (this._wall) {
      if (!on || unheld) { this._wallEnd(); return false; }
      return this._wallStep(dt, input, yaw, pk);
    }
    this._pkDropReq = false;
    // AUDIT CLIMB2 H2: on the feet, or treading water - the free climb is this lane's only way out of the water, and a
    // spent grip came back only on a floor the swimmer could not reach
    if ((this.grounded || this.swimming || this.sunk) && this.grip < 1) this.grip = Math.min(1, this.grip + dt / PARKOUR_GRIP_REGEN_S);
    if (on && this.climb) this.climb.wasClimbing = !!this._pkLeftWall;   // the hands let go last step: a Jump goes at once, as off the classic climb
    this._pkLeftWall = false;
    if (!on) return false;
    // CLIMB2: the free climb takes the classic climb's place on this lane (_step does not run it here); a classic
    // climb the switch caught under way ends
    if (this.climb?.isClimbing) this.climb.stop();
    if (unheld) { this._fcStart = null; return false; }
    let mode = null;
    if (!this.swimming && !this.sunk && (input.jump || this._pkArm) && !this._pkJumpLatch) {
      if (!this.grounded) mode = 'air';
      else if (input.jump && (this.climb?.wasClimbing || this.groundedTime >= GROUNDED_JUMP_GATE_S)) mode = 'ground';
    }
    if (!mode) return this._pkLowerStart(dt, input, yaw, pk) || this._freeStart(dt, input, yaw, pk);
    this._fcStart = null;
    const air = mode === 'air';
    // CLIMB3: THE LATE PRESS - a fresh Jump a beat after running off an edge leaps as at the edge (PARKOUR_COYOTE_S)
    if (air && pressed && this._pkOffEdge != null && this._pkMayLeap()) {
      const dir = this._pkOffEdge.dir;
      this._pkLaunch(dir, ...this._pkRunLeapSpeeds(pk, dir));
      return false;
    }
    if (air && this._pkQuiet > 0) { this._pkQuiet--; return false; }
    const inputs = pk.inputs?.() ?? {};
    const skill = parkourSkill(inputs);
    if (air && ((this.falling && this.fallStart - this.pos[1] > parkourCatchHold(skill)) || this.grip < PARKOUR_GRIP_MIN)) return false;
    const leap = air ? this._pkLeap : null;   // CLIMB3: a leap's flight looks the way it flew, and reaches further (magnetism)
    const geo = this._pkGeo(air ? PARKOUR_AIR_LOW : STEP_OFFSET, parkourReach(skill, inputs.load ?? 0) + (air ? PARKOUR_AIR_REACH : 0) + (leap ? PARKOUR_LEAP_REACH : 0), !air);
    const look = leap ? [...leap.dir] : [Math.sin(yaw), 0, Math.cos(yaw)];
    const fwd = input.forward > 0;
    const ledge = senseLedge(this.collider, this.pos, look, geo);
    // the tap catch catches (the press armed, the key let go): a lip at the chest or higher, held or with Forward
    // climbed onto - never a low lip stepped onto in the air (a staircase's next tread: AUDIT CLIMB1 G5's "Jump on a
    // staircase is a jump") nor a sheer wall grabbed; those ask the key held, as they always have
    const tapOnly = air && !input.jump;
    let move = null;
    if (ledge.ok && !(tapOnly && ledge.rise < PARKOUR_HANG_LOW)) {
      if (!air && fwd) {
        const vault = senseVault(this.collider, this.pos, ledge, geo);
        if (vault) move = planVault(this.pos, ledge, vault, jumpingSkill(inputs), this.speed);
      }
      const high = air && ledge.rise >= PARKOUR_HANG_LOW;   // a lip the hands can hang from
      if (!move && !(high && !fwd)) move = this._pkOnto(ledge, geo, skill);
      if (!move && high) move = this._pkCatch(ledge);
      if (!move && high && !fwd) move = this._pkOnto(ledge, geo, skill);   // no hang fits there: climbed onto, as at CLIMB1
      // CLIMB-DOWN: a thin top over a drop the clamber will not step down - a parapet walling a roof in, a rail over a
      // street - is climbed over into a hang on its far side, where it was a plain jump that could not clear it
      if (!move && !air) {
        const oh = senseOverHang(this.collider, this.pos, ledge, geo);
        if (oh) move = planOverHang(this.pos, ledge, oh, skill);
        // AUDIT CLIMB-ARC D3 (Forward and Jump at it): a parapet too tall to vault over a drop too far for the clamber's step (1.5 m) and too
        // short for a hang (a floor under the hang's feet) walled the body in: over it, then, as a clamber onto the floor
        // past it - a drop no worse than a hang's let-go (PARKOUR_HANG_DROP and its clearance), never one that hurts
        if (!move && fwd && ledge.rise > PARKOUR_VAULT_MAX) {
          const over = senseOver(this.collider, this.pos, ledge, geo, PARKOUR_HANG_DROP + PARKOUR_VAULT_CLEAR);
          if (over && over.floorY < ledge.lipY - PARKOUR_OVER_DROP) move = planClamber(this.pos, ledge, over, skill);
        }
      }
    }
    // AUDIT CLIMB-FIELD E2: an eave whose wall stands past the grab's reach - no face for the ledge sensor - is caught by
    // its edge (a lip at the chest or higher, as every air catch's hang is)
    if (!move && air && !ledge.ok && !this.crouching) {
      const g = senseEaveAhead(this.collider, this.pos, look, geo);
      if (g && g.lipY - this.pos[1] >= PARKOUR_HANG_LOW && catchClear(this.collider, this.pos, g, CAPSULE_HEIGHT)) move = planCatch(this.pos, g);
    }
    if (!move && air && fwd && !tapOnly && this._pkGrab(look, pk)) return true;
    // CLIMB3: running, Jump at a wall runs up it; at an edge, leaps (the plain jump goes on everywhere else)
    // AUDIT CLIMB-ARC L10: running is running at pace (PARKOUR_RUN_SHARE of the run's speed), not the toggle held
    // against a wall; L15: the wall run's height reads the climb's skill as every move does (the Khajiit's, the spell's)
    if (!move && !air && fwd && this.isRunning && !this.crouching && this._pkAtPace()) {
      const run = senseWallRun(this.collider, this.pos, look, wallRunHeight(skill, inputs.jumping ?? 0), geo.high + PARKOUR_AIR_REACH, geo);
      if (run) move = planWallRun(this.pos, run);
      else if (this._pkMayLeap() && senseDrop(this.collider, this.pos, look, CAPSULE_RADIUS, PARKOUR_RUNLEAP_EDGE)) {
        this._pkLaunch(look, ...this._pkRunLeapSpeeds(pk, look));
        return false;
      }
    }
    if (!move) {
      if (ledge.ok && air) this._pkQuiet = PARKOUR_QUIET_STEPS;
      return false;
    }
    const refusal = move.kind === 'vault' ? null : parkourRefusal();   // (a wall run is a climb: asked)
    if (refusal) {
      if (!this._pkSaid) { pk.say?.(refusal); this._pkSaid = true; }
      if (air) this._pkQuiet = PARKOUR_QUIET_STEPS;
      return false;
    }
    this._parkourBegin(move);
    this._parkourAdvance(dt);
    return true;
  }

  /** AUDIT CLIMB2 H1: a carried hold taken again - the hand-hold at the lip it held, or the wall it climbed. Gone (the
   *  world changed under the save), the body falls from where it was put, as any unheld body does. */
  _pkRetake(r) {
    if (r.mode === 'hang' && r.lipAbove != null) {
      const g = senseGrip(this.collider, this._pkFaceOf(r.normal), r.normal, this.pos[1] + r.lipAbove, this._pkGeo());
      if (g) { this._wallBegin('hang', g.normal, g.lipY, g.key); this._pkHangAt(g); }
      return;
    }
    const c = wallContact(this.collider, this.pos, [-r.normal[0], 0, -r.normal[2]], this.height, CAPSULE_RADIUS, PARKOUR_WALL_REACH);
    if (!c) return;
    this._wallBegin('climb', c.normal, null, c.key);
    // AUDIT FIELD BUGS 2026-10-02: the wall was found at the grab's reach - it is reached for as it was found (a save in a
    // STEP-BACK pass loaded 0.2 m off the face, and the next step's contact let go: a 5.8 m fall)
    this._wall.seek = true;
  }

  /** The ledge sensor's opts for this body: the band, and the stair check. */
  _pkGeo(low = 0, high = 0, footing = false) {
    return { low, high, radius: CAPSULE_RADIUS, stand: CAPSULE_HEIGHT, crouch: CROUCH_HEIGHT, height: this.height, footing };
  }

  /** AUDIT CLIMB2 C2: the hands take the body out of the water - a sunk swimmer is stood whole (DoUnsinking's arming,
   *  as the water's own edge has it) the moment a hold or a move begins, so the way up is planned for a whole body,
   *  and a crouched move begun in the same frame is not stood up by the frame's unsink after it. */
  _pkUnsink() {
    if (!this.sunk) return;
    this._beginUnsink();
    this.toggleSink = false;
  }

  /** CLIMB1: onto the top (a mantle), or over a thin one (the clamber). */
  _pkOnto(ledge, geo, skill) {
    if (ledge.mantle) return planMantle(this.pos, ledge, skill);
    const over = senseOver(this.collider, this.pos, ledge, geo, PARKOUR_OVER_DROP);
    return over ? planClamber(this.pos, ledge, over, skill) : null;
  }

  /** CLIMB2: the catch into a hang - the hand-hold at the lip, the body fitting
   *  under it, and the way there clear. A crouched jump holds nothing: the hang
   *  is the standing body's. */
  _pkCatch(ledge) {
    if (this.crouching) return null;
    const grip = senseGrip(this.collider, ledge.face, ledge.normal, ledge.lipY, this._pkGeo());
    if (!grip || !catchClear(this.collider, this.pos, grip, CAPSULE_HEIGHT)) return null;
    return planCatch(this.pos, grip);
  }

  /** CLIMB2: Forward and Jump held in the air at a wall with no lip to take -
   *  the hands take the wall: a free climb from here, billed as a catch. */
  _pkGrab(look, pk) {
    if (this.crouching) return false;
    const c = wallContact(this.collider, this.pos, look, this.height, CAPSULE_RADIUS);
    if (!c) return false;
    const refusal = parkourRefusal();
    if (refusal) {
      if (!this._pkSaid) { pk.say?.(refusal); this._pkSaid = true; }
      this._pkQuiet = PARKOUR_QUIET_STEPS;
      return false;
    }
    this._pkJumpLatch = true;
    this.parkoured = this.parkoured ? [].concat(this.parkoured, 'catch') : 'catch';   // AUDIT CLIMB-ARC L13
    this._wallBegin('climb', c.normal, null, c.key);
    return true;
  }

  /** CLIMB-DOWN: CROUCH WALKED TO AN EDGE - the floor ending at the body's front over a drop the walk would fall -
   *  lowers the body over it into a hang from its lip (senseEdge), where it walked off and fell: the way down from a
   *  roof, a wall top or a parapet the climb went up. Asks Roleplay & Realism's gate as every climb does (refused, the
   *  body holds at the edge); no lip to hang from there, the walk goes on as ever. */
  _pkLowerStart(dt, input, yaw, pk) {
    // crouched, or the crouch pressed and on its way down (the press is the intent: a body crouching as it steps toward
    // a parapet's outer edge a hand away was over it before the crouch landed)
    const f = input.forward || 0, st = input.strafe || 0;
    if (!this.grounded || !(this.crouching || this.heightAction === 'crouch') || this.swimming || this.sunk || this.grip < PARKOUR_GRIP_MIN || (!f && !st)) {
      this._pkEdgeSaid = false;
      return false;
    }
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const dx = sin * f + cos * st, dz = cos * f - sin * st, l = Math.hypot(dx, dz);
    const edge = senseEdge(this.collider, this.pos, [dx / l, 0, dz / l], this._pkGeo());
    if (!edge) { this._pkEdgeSaid = false; return false; }
    const refusal = parkourRefusal();
    if (refusal) {
      // refused (a weapon out under Roleplay & Realism), the crouched body stops at the edge it meant to climb down -
      // the line said once - rather than walking on off it: sheathed, the next step lowers; stood up, the walk goes on
      if (!this._pkEdgeSaid) { pk.say?.(refusal); this._pkEdgeSaid = true; }
      this.moveForward = 0;
      this.moveStrafe = 0;
      this.moveSpeed = 0;
      this.standing = true;   // the cached pair's writers sit below the return (AUDIT 65 XL-5): held, still, on the floor
      this.movingLessThanHalfSpeed = true;
      return true;
    }
    this._parkourBegin(planLower(this.pos, edge.grip, parkourSkill(pk.inputs?.() ?? {})));
    this._parkourAdvance(dt);
    return true;
  }

  /** CLIMB2: Forward held against a wall - still (the classic start's own
   *  tolerance), on the ground or in the water - for the skill's start time
   *  starts a free climb. No roll: the grip is what runs out. */
  _freeStart(dt, input, yaw, pk) {
    if (!(input.forward > 0) || !(this.grounded || this.swimming || this.sunk)) { this._fcStart = null; return false; }
    // CLIMB-NODE (FIELD BUGS 2026-10-01, Mac: "Hold it at nodes"): a profession's node under the look - its prompt up -
    // or an act playing holds the start, and its count begins again when it lets go: a vein stands at its rock's foot,
    // and walking into the rock to reach it climbed it. A jump's grab and a mantle are a jump's, and are not held.
    if (pk.hold?.()) { this._fcStart = null; return false; }
    const s = this._fcStart;
    if (!s || Math.hypot(this.pos[0] - s.x, this.pos[2] - s.z) >= START_CLIMB_HORIZONTAL_TOLERANCE) {
      this._fcStart = { x: this.pos[0], z: this.pos[2], t: 0 };
      return false;
    }
    s.t += dt;
    if (s.t < freeStartSeconds(parkourSkill(pk.inputs?.() ?? {})) || this.grip < PARKOUR_GRIP_MIN) return false;
    const c = wallContact(this.collider, this.pos, [Math.sin(yaw), 0, Math.cos(yaw)], this.height, CAPSULE_RADIUS);
    if (!c) return false;
    // AUDIT CLIMB2 G3: the body climbs standing (the wall arm of _heightAction stands it) - a crouched one under a slab
    // it cannot stand up in takes no wall; G2: nor one a rail already runs through (the climb would carry it on up)
    if (this.crouching ? !capsuleFits(this.collider, this.pos, CAPSULE_HEIGHT) : !bandsClear(this.collider, this.pos, this.height)) return false;
    const refusal = parkourRefusal();
    if (refusal) {
      pk.say?.(refusal);
      s.t = -Infinity;   // said once: Forward let go and held again asks again
      return false;
    }
    this._wallBegin('climb', c.normal, null, c.key);
    // AUDIT CLIMB-ARC L7: a Jump held as the hands take the wall (out of the water, where Jump is the swim up) is not
    // pressed afresh - it leaps from the climb only once let go and pressed again, as off every other hold
    if (input.jump) this._pkJumpLatch = true;
    return true;
  }

  /** CLIMB2: the body takes the wall - hanging from a lip at `lipY`, or free-
   *  climbing a face (lipY null). Every reader of the climb reads it
   *  (climb.hold: the fatigue band's climbing arm, the bob, the torch, the
   *  shield, the motion bag) with none of the classic machine's rolls. */
  _wallBegin(mode, normal, lipY, key) {
    this._pkUnsink();
    this._wall = { mode, normal: [normal[0], 0, normal[2]], lipY, key: key ?? null, carrier: null, warned: false, upRefused: false, look: this._pkLookNow ?? null };
    this._pkSide = null;   // AUDIT CLIMB2 A3: a new wall asks the look afresh (a corner is no new wall: C7)
    if (key != null) this._wall.carrier = this.collider.bucketPose?.(key) ?? null;
    this._wallTally = 0;
    this._fcStart = null;
    this._pkOffEdge = null;   // AUDIT CLIMB-ARC L6
    this.climb?.hold();
    this._pkHold();
    this._pkEmit('hold', { mode, normal: [normal[0], 0, normal[2]] });
  }

  /** CLIMB2: the body held on the wall - no velocity and no fall: a fall after
   *  it starts where the hands let go. The walk input is none (AUDIT CLIMB1 F9). */
  _pkHold() {
    this.isRunning = false;   // AUDIT CLIMB2 H6: no run on the wall (the Running tally, the peers' run cycle); it latches again on the ground
    this.velY = 0;
    this._airVelX = 0;
    this._airVelZ = 0;
    this.jumping = false;
    this.falling = false;
    this.fallStart = this.pos[1];
    this.grounded = false;
    this.groundKey = null;
    this.moveForward = 0;
    this.moveStrafe = 0;
    this.moveSpeed = 0;
  }

  /** CLIMB2: the hands let go. A Jump still held catches nothing until it is
   *  pressed afresh - it would take back the lip just dropped from. */
  _wallEnd() {
    if (this._wall) this._pkEmit('release', { mode: this._wall.mode, normal: [...this._wall.normal] });
    this._wall = null;
    this._pkArm = null;   // ...and a let-go arms nothing: only a fresh press catches again
    this._pkDropReq = false;
    this._pkLeftWall = true;
    this._pkJumpLatch = true;
    this.climb?.stop();
  }

  /** CLIMB2 - ON THE WALL, one step. A hold on what moves rides it. The hands
   *  let go when Crouch is pressed (Mac's "Crouch drops"), when Roleplay &
   *  Realism refuses the climb (a weapon drawn on the wall - the classic
   *  climb's next roll fails the same way), or when the grip is spent. The
   *  grip drains whole hanging, shimmying and climbing, at half held still on
   *  the wall; the Climbing skill is tallied at the classic climb's continue
   *  cadence. Left and Right are the look's, along the wall. */
  _wallStep(dt, input, yaw, pk) {
    const w = this._wall;
    if (this.climb) this.climb.wasClimbing = true;
    if (w.carrier) {
      const now = this.collider.bucketPose(w.key);
      if (now) {
        const x0 = this.pos[0], y0 = this.pos[1], z0 = this.pos[2];
        carryHold(this.pos, w, w.carrier, now); w.carrier = now;
        this._climbCarried[0] += this.pos[0] - x0; this._climbCarried[1] += this.pos[1] - y0; this._climbCarried[2] += this.pos[2] - z0;
      }
    }
    const refusal = parkourRefusal();
    if (refusal || this._pkDropReq) {
      if (refusal && !this._pkSaid) { pk.say?.(refusal); this._pkSaid = true; }
      this._wallEnd();
      return false;
    }
    const inputs = pk.inputs?.() ?? {};
    const skill = parkourSkill(inputs);
    const n = w.normal;
    // Left and Right are the look's, along the wall - decided when the key goes down and kept while it is held, so a
    // hold carries the hands on round corner after corner the same way (the view does not turn with them: CLIMB4)
    const key = Math.sign(input.strafe || 0);
    if (!key) this._pkSide = null;
    else if (this._pkSide?.key !== key) {
      const along = Math.cos(yaw) * -n[2] - Math.sin(yaw) * n[0];   // the look's right on the wall's right (facing it)
      this._pkSide = { key, s: Math.abs(along) < 0.2 ? 1 : Math.sign(along) };
    }
    const side = key ? (input.strafe || 0) * this._pkSide.s : 0;
    const vert = input.forward || 0;
    const rate = w.mode === 'climb' && !side && !vert ? PARKOUR_GRIP_REST : 1;
    this.grip -= (rate * dt) / gripSeconds(skill, inputs.fatigue ?? 1);
    if (this.grip <= 0) { this.grip = 0; this._wallEnd(); return false; }
    if (!w.warned && this.grip <= PARKOUR_GRIP_LOW) { w.warned = true; pk.say?.(PARKOUR_GRIP_LOW_TEXT); this._pkEmit('gripLow'); }
    this._wallTick(dt);
    const owned = w.mode === 'hang' ? this._hangStep(dt, input, side, vert, skill, inputs.climbing ?? 0)
      : this._freeClimbStep(dt, side, vert, skill, { ...inputs, jumpPressed: !!input.jump && !this._pkJumpLatch });
    if (this._wall) this._pkHold();
    // the climb's own mirror (AUDIT 65 XL-5): the step returns above both writers of the cached pair
    this.standing = this.grounded;
    this.movingLessThanHalfSpeed = this.grounded ? true : this._halfSpeedBase() / 2 >= this.speed;
    return owned;
  }

  /** CLIMB2: the Climbing skill tallied at the classic climb's continue cadence, while the hands hold the wall. */
  _wallTick(dt) {
    this._wallTally += dt;
    if (this._wallTally > SYSTEM_TIMER_UPDATES_DIVISOR * CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY) { this._wallTally = 0; this.parkour?.tally?.(); }
  }

  /** AUDIT CLIMB2 G5: the face a ray met, if it is another face the shimmy turns to - turned from `n` past the follow
   *  (PARKOUR_FACE_FOLLOW) toward the way along the lip (`sign` -1: facing back along it, an inner corner's; 1: facing
   *  on along it, an outer one's) - its normal, level; null otherwise. */
  _pkTurned(hit, n, t, sign) {
    if (!Number.isFinite(hit.dist) || !hit.normal) return null;
    const l = Math.hypot(hit.normal[0], hit.normal[2]);
    if (l < 1e-4) return null;
    const n2 = [hit.normal[0] / l, 0, hit.normal[2] / l];
    if (n2[0] * n[0] + n2[2] * n[2] >= PARKOUR_FACE_FOLLOW) return null;
    return sign * (n2[0] * t[0] + n2[2] * t[2]) > 0 ? n2 : null;
  }

  /** CLIMB2: the face point a body hanging off it stands off. */
  _pkFaceOf(n) {
    const back = CAPSULE_RADIUS + PARKOUR_HANG_GAP;
    return [this.pos[0] - n[0] * back, 0, this.pos[2] - n[2] * back];
  }

  /** CLIMB2: the body hangs from this grip (parkour.js senseGrip). */
  _pkHangAt(g) {
    const w = this._wall;
    this.pos[0] = g.feet[0]; this.pos[1] = g.feet[1]; this.pos[2] = g.feet[2];
    w.normal = g.normal;
    w.lipY = g.lipY;
    if (g.key !== w.key) { w.key = g.key; w.carrier = g.key != null ? (this.collider.bucketPose?.(g.key) ?? null) : null; }
  }

  /** CLIMB2 - THE HANG, one step. The hold is asked again where the body
   *  hangs - gone, the hands let go (a mover's lip is carried with the body,
   *  _wallStep). Forward - or a fresh Jump -
   *  climbs up: onto the top or over a thin one, the whole way proven (a lip
   *  with neither - a sill under a window - holds, and Forward held asks no
   *  more until it is let go or the hands move); Back climbs down the face (a
   *  free climb); Left and Right shimmy. `live` is the LIVE Climbing, the
   *  shimmy's pace past 100 (CLIMB-PAST, parkour.js shimmySpeed). */
  _hangStep(dt, input, side, vert, skill, live = 0) {
    const w = this._wall;
    const geo = this._pkGeo();
    const hold = senseGrip(this.collider, this._pkFaceOf(w.normal), w.normal, w.lipY, geo);
    if (!hold) { this._wallEnd(); return false; }
    const jump = input.jump && !this._pkJumpLatch;
    // CLIMB3: a fresh Jump with Back held ejects off the wall, with Left or Right leaps along it. AUDIT CLIMB-FIELD J1
    // (Mac: "You cant jump from a wall"): no hold that way, the press was spent and the hands held on - it pushes off
    if (jump && (vert < 0 || side)) {
      this._pkJumpLatch = true;
      return this._pkLeapFrom(dt, vert < 0 ? 'back' : 'side', Math.sign(side)) || this._pkLeapFrom(dt, 'back', 0) || true;
    }
    if (vert <= 0) w.upRefused = false;
    if (jump || (vert > 0 && !w.upRefused)) {
      if (jump) this._pkJumpLatch = true;
      const dir = [-w.normal[0], 0, -w.normal[2]];
      const ledge = senseLedge(this.collider, this.pos, dir, this._pkGeo(PARKOUR_HANG_DROP - 0.3, PARKOUR_HANG_DROP + 0.2));
      let move = ledge.ok ? this._pkOnto(ledge, geo, skill) : null;
      // AUDIT CLIMB-FIELD E3: an eave standing out past the grab's reach shows the ledge sensor no face to read it by -
      // the way onto its roof is planned from the hold itself
      if (!move && hold.eave) {
        const el = senseEaveLedge(this.collider, this.pos, hold, geo);
        if (el.mantle) move = planMantle(this.pos, el, skill);
      }
      if (move) {
        this._wallEnd();
        this._parkourBegin(move);
        this._parkourAdvance(dt);
        return true;
      }
      // CLIMB3: no top to climb onto (a sill under a wall) - Jump leaps up to a lip over it in the leap's reach; Forward
      // climbs on up the wall over it (a free climb that passes the sill it held - "A hang on a sill under a climbable
      // wall cannot go on up it", CLIMB2's open item)
      if (jump && this._pkLeapFrom(dt, 'up', 0)) return true;
      if (vert > 0 && this._pkWallAbove(w)) {
        w.mode = 'climb';
        w.past = w.lipY;
        w.lipY = null;
        w.seek = true;
        return true;
      }
      // AUDIT CLIMB-FIELD J1: a Jump with nothing to climb onto or leap to (a sill under a window, an eave with no room
      // over it) pushes off the wall - it did nothing, and Jump on a wall never jumped
      if (jump && this._pkLeapFrom(dt, 'back', 0)) return true;
      w.upRefused = vert > 0;
    } else if (vert < 0) {
      w.mode = 'climb';   // down the face: the free climb takes it from here - seeking the wall under a sill
      w.lipY = null;
      w.seek = true;
      return true;
    }
    if (!side) w.cornerRefused = 0;
    else if (this._pkShimmy(dt, side, skill, geo, live)) { if (this._wall) w.upRefused = false; }
    return true;
  }

  /** CLIMB3: does the wall go on up over the hang's lip - a face within the grab's reach (PARKOUR_WALL_REACH) a body's
   *  height over it, under the hands - for the free climb to take on up past the lip? */
  _pkWallAbove(w) {
    const n = w.normal, at = [this.pos[0], w.lipY + PARKOUR_LIP_FOLLOW, this.pos[2]];
    return !!wallContact(this.collider, at, [-n[0], 0, -n[2]], CAPSULE_HEIGHT, CAPSULE_RADIUS, PARKOUR_WALL_REACH);
  }

  /** CLIMB3: the hold the hands have, as the leap's sensor reads it - the hang's lip and face; the free climb's, a lip
   *  where a hang's would be (the hands' height), its face the wall pressed. */
  _pkHeld() {
    const w = this._wall, face = this._pkFaceOf(w.normal);
    const lipY = w.mode === 'hang' && w.lipY != null ? w.lipY : this.pos[1] + PARKOUR_HANG_DROP;
    return { face: [face[0], lipY, face[2]], normal: w.normal, lipY, feet: [this.pos[0], this.pos[1], this.pos[2]] };
  }

  /** CLIMB3 - A LEAP FROM THE HOLD (Mac's "Parkour leap, skill-scaled"). `way` 'back' ejects off the wall (always: the
   *  leap away is the player's to make); 'side' (with `side` +1/-1, along the wall facing it) or 'up' leaps to a
   *  hand-hold in the leap's reach - the Jumping skill's - as a move into the hang there, the hold going on through it
   *  (a corner's way: the tally, the band, the grip). None in reach, no leap. A leap spends PARKOUR_LEAP_GRIP at once. */
  _pkLeapFrom(dt, way, side) {
    if (this.grip < PARKOUR_GRIP_MIN + PARKOUR_LEAP_GRIP) return false;
    const j = jumpingSkill(this.parkour?.inputs?.() ?? {});
    if (way === 'back') return this._pkEject(j);
    const g = senseLeapHold(this.collider, this.pos, this._pkHeld(), way, way === 'up' ? leapUpReach(j) : leapSideReach(j), this._pkGeo(), side);
    if (!g) return false;
    this.grip -= PARKOUR_LEAP_GRIP;
    this._parkourBegin(planLeap(this.pos, g, j));
    this._parkourAdvance(dt, true);   // AUDIT CLIMB-ARC L16: this step's grip and wall time are the hold's, spent already
    return true;
  }

  /** CLIMB4: a climb event for the frame - what the feel (the camera) and the sounds read: 'hold' (the hands take the
   *  wall), 'release' (they let go), 'move' (a move begins: its kind, time, rise, split, the speed the body came at and
   *  a corner's turn), 'launch' (a leap's flight: its way), 'gripLow' (AUDIT CLIMB-ARC nit: the five there are).
   *  Cleared each update: a host reads the frame's after it. */
  _pkEmit(type, data = null) {
    this.climbEvents.push(data ? { type, ...data } : { type });
  }
  /** CLIMB4: a move's event - its kind and time, its rise and its split (where the hands take the lip: the sounds'), the
   *  speed the body came to it at, the turn a corner makes, its way, and the wall it ends on. */
  _pkMoveEvent(move, speed) {
    this._pkEmit('move', {
      kind: move.kind, dur: move.dur, rise: move.to[1] - move.from[1], split: move.split ?? 0.5, speed, turn: move.turn ?? 0,
      way: [move.to[0] - move.from[0], move.to[2] - move.from[2]], normal: move.hang ? [...move.hang.normal] : move.wall ? [...move.wall.normal] : null,
    });
  }


  /** CLIMB3: the running leap's launch [along, up] for the Jumping skill the deps read. AUDIT CLIMB-ARC L2: never short
   *  of the plain jump it takes the place of - its run carried on along `dir` and its rise the boosted jump's (a fast
   *  runner, a skill past 100, a Jump spell): the leap is at least the jump, with the catch's magnetism. */
  _pkRunLeapSpeeds(pk, dir) {
    const { along, up } = runLeapLaunch(jumpingSkill(pk.inputs?.() ?? {}), GRAVITY);
    const run = dir ? this._airVelX * dir[0] + this._airVelZ * dir[2] : 0;
    const boost = this.jumpBoost ? this.jumpBoost() : 1;
    return [Math.max(along, run + JUMP_SPEED * JUMP_FWD_BOOST), Math.max(up, JUMP_SPEED * boost)];
  }

  /** AUDIT CLIMB-ARC L10: running at pace - the way the body really went last step, PARKOUR_RUN_SHARE of the run's speed or more. */
  _pkAtPace() { return (this._pkPace ?? 0) > 1e-3 && this._pkPace >= PARKOUR_RUN_SHARE * this.speed - 1e-6; }

  /** AUDIT CLIMB-ARC L8: a leap where the plain jump would go - never under slowfall (HandleJumpInput's cancel, which
   *  the leaps had bypassed: a jump on the spot billed, a late press 117 m out) nor wading outdoor water (its other). */
  _pkMayLeap() { return !this.slowFalling && !this.onExteriorWater; }

  /** CLIMB3 - THE EJECT: Jump with Back held pushes off the wall - out along its normal and up, the Jumping skill's
   *  launch (ejectLaunch) - into a flight with the catch armed (a ledge across the way, a wall to grab with Forward and
   *  Jump held), its sensor looking the way it flew (the view turns after it: CLIMB4), clear of the wall it left for the
   *  catch's quiet. The fall it may end in counts from the wall. */
  _pkEject(jumping) {
    const n = this._wall.normal, { out, up } = ejectLaunch(jumping);
    this.grip = Math.max(0, this.grip - PARKOUR_LEAP_GRIP);
    this._wallEnd();
    this._pkLaunch([n[0], 0, n[2]], out, up);
    this._pkQuiet = PARKOUR_QUIET_STEPS;
    return true;
  }

  /** CLIMB3: a flight launched along `dir` (horizontal unit) at `along` m/s and `up` m/s - the eject's or the running
   *  leap's: billed as a leap (a jump's fatigue, the Jumping tally), the catch armed for it (the press is the leap's
   *  and catches as a held Jump would, held or not: PARKOUR_LEAP_REACH, magnetism), the plain jump not fired. */
  _pkLaunch(dir, along, up) {
    this._pkEmit('launch', { dir: [dir[0], 0, dir[2]], along, up });
    this.velY = up;
    this._airVelX = dir[0] * along;
    this._airVelZ = dir[2] * along;
    this.grounded = false;
    this.groundedTime = 0;
    this.groundKey = null;
    this.jumping = true;
    this.falling = false;
    this.fallStart = this.pos[1];
    this.parkoured = this.parkoured ? [].concat(this.parkoured, 'leap') : 'leap';   // AUDIT CLIMB-ARC L13
    this._pkLeap = { dir: [dir[0], 0, dir[2]] };
    this._pkArm = { t: 0, air: true };
    this._pkJumpLatch = false;
    this._pkOffEdge = null;
  }

  /** CLIMB2 - THE SHIMMY. Along the lip at the skill's pace: the lead hand
   *  must find a hold a hand's span ahead (the lip ends, or breaks, and the
   *  hands stop), and the body must fit where it hangs next (a wall across
   *  the lip, a pillar). Each step's hold is the lip's own: its height and
   *  its face's turn followed. Answers whether the body moved. */
  _pkShimmy(dt, side, skill, geo, live = 0) {
    const w = this._wall, n = w.normal;
    const s = Math.sign(side);
    if (w.cornerRefused === s) return false;
    const tx = -n[2] * s, tz = n[0] * s;
    const d = shimmySpeed(skill, live) * dt * Math.min(1, Math.abs(side));
    const face = this._pkFaceOf(n);
    const reach = d + PARKOUR_HAND_SPAN;
    // the body's next hold, and the lead hand a span on from it, felt along the lip in two halves, each along the face
    // the last found - AUDIT CLIMB2 G5: asked along the face the body held, a round tower's curve turned the lead
    // hand's facet past the follow, and the shimmy stopped on an unbroken lip
    const at = senseGrip(this.collider, [face[0] + tx * d, 0, face[2] + tz * d], n, w.lipY, geo);
    let lead = at;
    for (let k = 0; k < 2 && lead; k++) {
      const ln = lead.normal, h = PARKOUR_HAND_SPAN / 2;
      lead = senseGrip(this.collider, [lead.face[0] - ln[2] * s * h, 0, lead.face[2] + ln[0] * s * h], ln, lead.lipY, geo, false);
    }
    const g = lead ? at : null;
    if (g) { this._pkHangAt(g); w.cornerRefused = 0; return true; }
    const move = this._pkCorner(s, reach, skill, geo, live);
    if (!move) { w.cornerRefused = s; return false; }
    this._parkourBegin(move);   // AUDIT CLIMB2 C7: the hands go round - the hold is not let go (_parkourAdvance)
    return true;
  }

  /** CLIMB2 - A CORNER. The shimmy is stopped; is it a corner the hands follow
   *  round? An INNER one is a wall across the lip, square to it, with a lip of
   *  its own at this height: the body turns to it, coming off the first face.
   *  An OUTER one is the lip ending where the face itself ends - found to a
   *  centimetre along the lip - with the other face's lip round the edge: the
   *  body swings round the edge clear of it. The new hold is the hand-hold's
   *  (senseGrip, the body fitting there) and the whole way round is proven.
   *  A lip that merely ends is no corner: past a gap the body does not fit
   *  round the edge, and where the wall runs on in the same face the other
   *  side's hold is sought inside the solid and is none (the first cut asked
   *  the running face as well - the mutation run found it could not decide). */
  _pkCorner(s, reach, skill, geo, live = 0) {
    const w = this._wall, n = w.normal;
    const t = [-n[2] * s, 0, n[0] * s];
    const back = CAPSULE_RADIUS + PARKOUR_HANG_GAP;
    const y = w.lipY - 0.3;
    const face = this._pkFaceOf(n);
    let grip = null, mid = null;
    // the face across the way, at its own turn (AUDIT CLIMB2 G5: not only square) - an inner corner's apex within the
    // old reach, the face itself met as far on as a 30-degree turn puts it from the body off the first face
    const ahead = this.collider.raycastHit([this.pos[0], y, this.pos[2]], t, back + PARKOUR_HAND_SPAN + back / Math.tan(Math.acos(PARKOUR_FACE_FOLLOW)));
    const across = this._pkTurned(ahead, n, t, -1);
    const apex = across ? ahead.dist - (back * (across[0] * n[0] + across[2] * n[2])) / -(across[0] * t[0] + across[2] * t[2]) : Infinity;
    if (across && apex <= back + PARKOUR_HAND_SPAN) {
      const n2 = across;
      const hx = this.pos[0] + t[0] * ahead.dist, hz = this.pos[2] + t[2] * ahead.dist;
      grip = senseGrip(this.collider, [hx + n[0] * PARKOUR_CORNER_OFF, 0, hz + n[2] * PARKOUR_CORNER_OFF], n2, w.lipY, geo);
      if (grip) mid = [(this.pos[0] + grip.feet[0]) / 2, (this.pos[1] + grip.feet[1]) / 2, (this.pos[2] + grip.feet[2]) / 2];
    } else {
      let a = 0, b = reach;   // the lip's end along it: held at a, not at b
      for (let i = 0; i < 5; i++) {
        const m = (a + b) / 2;
        if (senseGrip(this.collider, [face[0] + t[0] * m, 0, face[2] + t[2] * m], n, w.lipY, geo, false)) a = m; else b = m;
      }
      const c = (a + b) / 2;
      const ex = face[0] + t[0] * c, ez = face[2] + t[2] * c;
      // the other face, read just past the edge (AUDIT CLIMB2 G5: a tower's 45 or 60 degrees, not only square); one
      // too sharp to meet there is taken as square
      const px = ex + t[0] * PARKOUR_CORNER_PROBE + n[0] * back, pz = ez + t[2] * PARKOUR_CORNER_PROBE + n[2] * back;
      const n2 = this._pkTurned(this.collider.raycastHit([px, y, pz], [-n[0], 0, -n[2]], back + PARKOUR_HAND_SPAN), n, t, 1) ?? t;
      const along = n2[0] * n[0] + n2[2] * n[2], out = n2[0] * t[0] + n2[2] * t[2];   // the face's way on from the edge: along t, then in
      const dx = t[0] * along - n[0] * out, dz = t[2] * along - n[2] * out;
      grip = senseGrip(this.collider, [ex + dx * PARKOUR_CORNER_IN, 0, ez + dz * PARKOUR_CORNER_IN], n2, w.lipY, geo);
      const bx = n[0] + n2[0], bz = n[2] + n2[2], bl = Math.hypot(bx, bz) || 1, r = back + PARKOUR_CORNER_CLEAR;
      if (grip) mid = [ex + (bx / bl) * r, (this.pos[1] + grip.feet[1]) / 2, ez + (bz / bl) * r];
    }
    if (!grip) return null;
    const move = planCorner(this.pos, mid, grip, skill, live);
    // CLIMB4: the view's turn round it - AUDIT CLIMB-ARC F1: from facing the wall held to facing the next, in the view's
    // own yaw (forward [sin, 0, cos]: facing -n is atan2(-nx, -nz)); the sign was the mirror's, and every corner turned
    // the view away from its wall by twice the turn
    move.turn = Math.atan2(n[2] * grip.normal[0] - n[0] * grip.normal[2], n[0] * grip.normal[0] + n[2] * grip.normal[2]);
    return moveClear(this.collider, move, CAPSULE_HEIGHT) ? move : null;
  }

  /** CLIMB2 - THE FREE CLIMB, one step (Mac's "Free-climb on grip"). The body
   *  keeps to the face (parkour.js wallContact - the wall gone, the hands let
   *  go); Forward climbs up, Back down, Left and Right across, at the skill's
   *  pace on the classic climb's, pressed into the wall as the classic hug
   *  is. Going up, a lip come to the hands is held (the top of the climb) -
   *  and with Forward still held, climbed over. A move the wall does not go on
   *  under is not made (its side edge, its top where no lip was found); a
   *  floor under the body, not going up, ends the climb standing (A1). */
  _freeClimbStep(dt, side, vert, skill, inputs) {
    const w = this._wall;
    // AUDIT FIELD BUGS 2026-10-02: climbing down, the hands reach for the wall under them as far as the grab does (as
    // Back from a hang does, w.seek) - down past a step-back only the lowest ray was still on the wall, and over a
    // recess in it nothing was: the climb froze, or the hands let go 5.4 m up (N0000033)
    w.down = vert < 0;
    const reach = w.seek || w.past != null || w.down ? PARKOUR_WALL_REACH : PARKOUR_CONTACT;
    const c = wallContact(this.collider, this.pos, [-w.normal[0], 0, -w.normal[2]], this.height, CAPSULE_RADIUS, reach);
    if (!c) { this._wallEnd(); return false; }
    if (w.seek && c.dist <= CAPSULE_RADIUS + PARKOUR_CONTACT) w.seek = false;
    // AUDIT CLIMB2 A1: not going up with the floor this near under the feet is standing, not a hold - ClimbingMotor's
    // own "ground directly below too close" abort (:318-320, height/2 + 0.12 from the capsule's centre). A climb begun
    // at the floor and let go of held the body there, on the wall and not on its feet, until the grip ran out.
    if (vert <= 0 && this._groundNear()) {
      this._wallEnd();
      return false;
    }
    const into = [-w.normal[0], 0, -w.normal[2]];
    // AUDIT FIELD BUGS 2026-10-02: the hold turns onto a face its contact met only where the body holds along that face
    // too - one ray on a corner's other face under a leaning top turned it, the next step's contact along it met
    // nothing, and the hands let go 11 m up (the Pit of Sahoth's N0000008; the old deep press had pushed the body on up)
    const turnsTo = c.normal[0] * w.normal[0] + c.normal[2] * w.normal[2] < PARKOUR_TURN_HOLDS
      && !wallContact(this.collider, this.pos, [-c.normal[0], 0, -c.normal[2]], this.height, CAPSULE_RADIUS, reach) ? null : c.normal;
    w.normal = turnsTo ?? w.normal;
    w.gap = c.dist - CAPSULE_RADIUS;   // HUG-TOUCH: how far the face stands off the body (_fcMove's press)
    if (c.key !== w.key) { w.key = c.key; w.carrier = c.key != null ? (this.collider.bucketPose?.(c.key) ?? null) : null; }
    // CLIMB3: a fresh Jump on the free climb leaps - Back off the wall, Left or Right along it, else up it (Mac's
    // "Parkour leap"; until now Jump on a free climb did nothing). AUDIT CLIMB-FIELD J1 (Mac: "You cant jump from a
    // wall"): Jump up the wall climbs onto a top in reach first, as Forward does; and a press with no hold that way
    // pushes off the wall - it was spent, and the climber hung on
    if (inputs.jumpPressed) {
      this._pkJumpLatch = true;
      if (vert >= 0 && !side && this._fcTopOut(dt, skill, inputs, into, true)) return true;
      if (this._pkLeapFrom(dt, vert < 0 ? 'back' : side ? 'side' : 'up', Math.sign(side))) return true;
      if (vert >= 0 && this._pkLeapFrom(dt, 'back', 0)) return true;
    }
    if (vert > 0) {
      if (this._fcTopOut(dt, skill, inputs, into, false)) return true;
      // CORNER-TOP (FIELD BUGS 2026-10-02, the audit): in a corner the hands can hold the side wall, which runs on past
      // the lip of the wall the look is turned to - and the climb went on up it under that top: the turned-to wall's
      // top in reach is climbed onto as the held one's is
      // AUDIT: the side is the look's when the hands took this wall (`w.look`), and kept - a view turned during the climb
      // toward a crate, a garden wall or a fence beside it mantled the climber sideways onto it, or over into the next yard
      w.corner ??= this._fcCornerSide(into, w.look);
      const turned = this._fcCornerWall(into, w.corner);
      if (turned && this._fcTopOut(dt, skill, inputs, turned, false)) return true;
      const face = [this.pos[0] + into[0] * c.dist, 0, this.pos[2] + into[2] * c.dist];
      const g0 = senseGrip(this.collider, face, c.normal, this.pos[1] + PARKOUR_HANG_DROP, this._pkGeo());
      const g = g0 && w.past != null && g0.lipY <= w.past + PARKOUR_LIP_FOLLOW ? null : g0;   // CLIMB3: not the sill climbed past
      const level = !!g && g.lipY - this.pos[1] <= PARKOUR_HANG_DROP + 0.04;
      if (level && !g.eave) {
        w.mode = 'hang';
        w.upRefused = false;
        this._pkHangAt(g);
        return this._hangStep(dt, { jump: false }, 0, vert, skill);
      }
      // AUDIT CLIMB2 G4: a climb that could go no higher - the head under a cornice that stands out from the wall, the
      // lip still over the hands - reaches up round it: the hang is taken by a catch's move, its way proven clear, and
      // the hold goes on (an unbilled move, as a corner is). AUDIT CLIMB-FIELD E1: and an eave's edge come to the hands
      // is reached out to the same way - its hang is a body's width out from the wall, under the edge, never stepped to
      if (g && (w.stuck || (level && g.eave)) && catchClear(this.collider, this.pos, g, CAPSULE_HEIGHT)) {
        const move = planCatch(this.pos, g);
        move.kind = 'reach';
        move.bill = false;
        this._parkourBegin(move);
        return true;
      }
    }
    w.stuck = false;
    if (vert < 0 || (w.past != null && this.pos[1] >= w.past + PARKOUR_UP_GAP)) w.past = null;   // CLIMB3: over the sill (or back down), it is no longer passed
    if (!side && !vert) return true;
    const v = freeClimbSpeed(this.speed, skill, !!inputs.enhanced, inputs.climbing ?? 0) * (side && vert ? DIAGONAL_FACTOR : 1);   // CLIMB-PAST: the live Climbing's points past 100
    const n = c.normal;
    const was = [this.pos[0], this.pos[1], this.pos[2]];
    this._fcMove(was, side, vert, v, n, dt);
    // a move the wall does not go on under is not made - nor one into what the collider's spheres pass between (AUDIT
    // CLIMB2 G2: a moulding or a rail across the wall, which the body leans out past - the hug let go of, out from the
    // face as far as the wall is still at the hands); AUDIT CLIMB2 G6: the way across ending (the wall's side edge) is
    // no end of the way up, which is asked alone before the step is refused. (The floor is A1's, above: the move's own
    // ground was the step ladder's top - gone with G1 - or a sill under the feet's rim, which is no floor, C3.)
    const held = () => this._fcHeld(n, w);
    for (const out of PARKOUR_LEAN) if (!held()) this._fcMove(was, side, vert, v, n, dt, out);
    if (!held() && side && vert) this._fcMove(was, 0, vert, v, n, dt);
    // STEP-BACK (FIELD BUGS 2026-10-02): going up (straight or across), a face that steps back from the hands (a piece set 20 cm behind
    // the one under it, its top too shallow to stand on) is climbed on to as CLIMB3 climbs past a sill - the step's top
    // passed (w.past: straight up in front of it, unpressed, so no press lifts the body onto its edge and leaves it
    // perched there), then the grab's own reach to the face over it (w.seek) - where the climb stopped under the step
    if (!held() && vert > 0 && !w.seek && w.past == null) {
      this._fcMove(was, 0, vert, v, n, dt);
      const s = this.pos[1] - was[1] > 1e-4 && bandsClear(this.collider, this.pos, this.height)
        ? wallContact(this.collider, this.pos, [-n[0], 0, -n[2]], this.height, CAPSULE_RADIUS, PARKOUR_WALL_REACH) : null;
      if (s && s.normal[0] * n[0] + s.normal[2] * n[2] >= PARKOUR_FACE_FOLLOW) {
        w.past = this._fcFaceTop(was, into);
        w.seek = true;
        this._fcMove(was, 0, vert, v, n, dt);
      }
    }
    if (!held()) { this.pos[0] = was[0]; this.pos[1] = was[1]; this.pos[2] = was[2]; }
    w.stuck = vert > 0 && this.pos[1] - was[1] < 1e-4;
    if (vert <= 0 || side || (w.sidestep && this.pos[1] - w.sidestep.y0 >= PARKOUR_SIDESTEP_CLEAR)) w.sidestep = null;
    if (!side && vert > 0 && (w.stuck || (w.sidestep && w.sidestep.gone < w.sidestep.want))) this._fcSidestep(v, n, dt, held);
    return true;
  }

  /** SEAM-STEP (FIELD BUGS 2026-10-02, "A two blocks wall is too high for my character to climb up"): Daggerfall's
   *  dungeon walls are stacked in 3.2 m units, and where the unit above stands a hand's width over to one side - its
   *  corner, a jamb, a pier - the climber's head met its underside 1.4 m up the first unit and the climb went no
   *  higher (the across move's clamp undid the resolve's push out from under it, which carried the classic climb on).
   *  Stuck going straight up, the hands move along the wall to the nearest place the body rises again - the wall still
   *  at them, within PARKOUR_SIDESTEP_MAX - along and up at the climb's diagonal pace until they are there, and the
   *  climb goes on up from it. None that near, it stays stuck as under any top it cannot take. The way is kept until
   *  the climb has risen PARKOUR_SIDESTEP_CLEAR past where it stuck: one obstruction moves the hands that far at most. */
  _fcSidestep(v, n, dt, held) {
    const w = this._wall;
    const t = [-n[2], 0, n[0]];   // the across move's own +1 (_fcMove: -nz * side, nx * side)
    const from = [this.pos[0], this.pos[1], this.pos[2]];
    const into = [-n[0], 0, -n[2]];
    const rises = (s) => {
      const q = [from[0] + t[0] * s, from[1] + PARKOUR_SIDESTEP_RISE, from[2] + t[2] * s];
      return capsuleFits(this.collider, q, this.height) && !!wallContact(this.collider, q, into, this.height, CAPSULE_RADIUS, PARKOUR_CONTACT);
    };
    /** the nearest place within `room` that rises, each of `dirs` asked at every probe: { s, k } or null */
    const search = (dirs, room) => {
      for (let k = 1; k * PARKOUR_SIDESTEP_PROBE <= room + 1e-9; k++) for (const s of dirs) if (rises(s * k * PARKOUR_SIDESTEP_PROBE)) return { s, k };
      return null;
    };
    if (w.sidestep == null) {
      const f = search([1, -1], PARKOUR_SIDESTEP_MAX);
      // AUDIT: a search that found nothing is kept as one (no way), and not asked again every step while the climber
      // stays stuck under the same top - until the climb moves (Back, Left or Right, or a rise clears it)
      w.sidestep = f ? { dir: f.s, want: f.k * PARKOUR_SIDESTEP_PROBE, gone: 0, y0: from[1] } : { dir: 0, want: 0, gone: 0, y0: from[1] };
      if (!f) return false;
    }
    const st = w.sidestep;
    if (st.gone >= st.want) {
      // AUDIT: there and still stuck (the search's fit admits the touch of an edge the resolve then refuses - a jamb
      // over the body's middle): on the same way, the next place that rises, within what is left of the reach
      if (!st.dir || st.gone >= PARKOUR_SIDESTEP_MAX) return false;
      const f = search([st.dir], PARKOUR_SIDESTEP_MAX - st.gone);
      if (!f) { st.want = st.gone = PARKOUR_SIDESTEP_MAX; return false; }
      st.want = st.gone + f.k * PARKOUR_SIDESTEP_PROBE;
    }
    const d = v * DIAGONAL_FACTOR;   // along and up in the one step, at the climb's diagonal pace
    this._fcMove(from, st.dir, 0, Math.min(d, (st.want - st.gone) / dt), n, dt);
    const gone = Math.abs(t[0] * (this.pos[0] - from[0]) + t[2] * (this.pos[2] - from[2]));
    if (gone < 1e-4 || !held()) { this.pos[0] = from[0]; this.pos[1] = from[1]; this.pos[2] = from[2]; st.gone = st.want = PARKOUR_SIDESTEP_MAX; return false; }
    st.gone += gone;
    if (w.stuck) {
      const along = [this.pos[0], this.pos[1], this.pos[2]];
      this._fcMove(along, 0, 1, d, n, dt);
      if (!held()) { this.pos[0] = along[0]; this.pos[1] = along[1]; this.pos[2] = along[2]; }
    }
    return true;
  }

  /** CORNER-TOP: which way along the held wall (+1, -1) the look is turned by PARKOUR_CORNER_LOOK or more, else 0. */
  _fcCornerSide(into, look) {
    if (!look) return 0;
    const a = look[0] * -into[2] + look[2] * into[0];
    return Math.abs(a) < PARKOUR_CORNER_LOOK ? 0 : Math.sign(a);
  }

  /** CORNER-TOP: the way into the corner's other wall - along the held wall, on the `side` the look was turned to as the
   *  hands took it - when a face stands there within the climber's contact; else null. How square that
   *  face must stand is the ledge sensor's own law (its facing test, 50 degrees), asked by the top-out along it. */
  _fcCornerWall(into, side) {
    if (!side) return null;
    const dir = [-into[2] * side, 0, into[0] * side];
    return wallContact(this.collider, this.pos, dir, this.height, CAPSULE_RADIUS, PARKOUR_CONTACT) ? dir : null;
  }

  /** STEP-BACK: the top of the face the hands held, from the feet `at` up - the first level ray along `into` that no
   *  longer meets it within the climber's contact. */
  _fcFaceTop(at, into) {
    const reach = CAPSULE_RADIUS + PARKOUR_CONTACT;
    for (let h = 0; h <= this.height; h += PARKOUR_STEP_SCAN) {
      if (!Number.isFinite(this.collider.raycast([at[0], at[1] + h, at[2]], into, reach))) return at[1] + h;
    }
    return at[1] + this.height;
  }

  /** AUDIT CLIMB2 H5: THE TOP-OUT. A lip coming within the hands' reach is climbed onto or over - CLIMB1's top-out of
   *  the classic climb, which this climb took the place of and lost: a free climb up a wall lower than the hang (a
   *  plinth, a garden wall) never had its lip come to the hands, and stuck under the top with Forward held. Asked only
   *  once the face has ended inside the reach (one ray), and rested after a refusal as the air catch is - unless a fresh
   *  Jump asks (`pressed`, AUDIT CLIMB-FIELD J1). Answers whether a move began. */
  _fcTopOut(dt, skill, inputs, into, pressed) {
    const reach = parkourReach(skill, inputs.load ?? 0) + PARKOUR_AIR_REACH;
    if (Number.isFinite(this.collider.raycast([this.pos[0], this.pos[1] + reach, this.pos[2]], into, CAPSULE_RADIUS + PARKOUR_WALL_REACH))) return false;
    if (!pressed && this._pkQuiet > 0) { this._pkQuiet--; return false; }
    const geo = this._pkGeo(PARKOUR_AIR_LOW, reach);
    const ledge = senseLedge(this.collider, this.pos, into, geo);
    const move = ledge.ok ? this._pkOnto(ledge, geo, skill) : null;
    if (move) {
      this._wallEnd();
      this._parkourBegin(move);
      this._parkourAdvance(dt);
      return true;
    }
    if (ledge.ok) this._pkQuiet = PARKOUR_QUIET_STEPS;
    return false;
  }

  /** CLIMB2: the free climb's move from `was` - across, up or down the face, pressed into it as the classic hug is,
   *  or (`out`, AUDIT CLIMB2 G2) leaning that far out from it instead; never stepping (AUDIT CLIMB2 G1). */
  _fcMove(was, side, vert, v, n, dt, out = null) {
    // CLIMB3: past a sill it held, the body rises straight up in front of it - pressed in, it was shoved down and back off
    // the sill's underside - until the feet are over it and the press takes it on to the wall above
    // HUG-TOUCH (FIELD BUGS 2026-10-02): pressed to the face and a centimetre in, never the classic hug's whole step
    // (Speed x dt, 7 cm a step) - the resolve's push back out of a press that deep leans along the face wherever the
    // body meets a seam between two of its triangles, and Daggerfall's walls are a few great triangles split on the
    // diagonal: up such a seam the push took 1.3 cm a step off the climb, and at Climbing 0 a climber never left the floor
    const press = Math.min(this.speed * dt, Math.max(0, this._wall?.gap ?? Infinity) + PARKOUR_HUG_PRESS);
    const nx = n[0], nz = n[2], hug = out == null ? (this._wall?.past != null ? 0 : -press) : out;
    this.pos[0] = was[0]; this.pos[1] = was[1]; this.pos[2] = was[2];
    this.collider.move(this.pos,
      -nz * side * v * dt + nx * hug, vert * v * dt, nx * side * v * dt + nz * hug,
      this.height, false, false, true);   // AUDIT CLIMB2 G1: no step ladder
    // the hug's press slides a body along a face's own seams (a box's diagonal edge took a climb down 2.8 m sideways):
    // across the wall the body goes as far as it was asked and no further, and no way it was not asked
    const want = side * v * dt, got = -nz * (this.pos[0] - was[0]) + nx * (this.pos[2] - was[2]);
    const keep = want && Math.sign(got) === Math.sign(want) ? Math.sign(want) * Math.min(Math.abs(got), Math.abs(want)) : 0;
    if (Math.abs(got - keep) > 1e-6) {
      const fx = this.pos[0] - nz * (keep - got), fz = this.pos[2] + nx * (keep - got);
      if (this.collider.penetrationAt([fx, this.pos[1], fz], this.height) < 0.03) { this.pos[0] = fx; this.pos[2] = fz; }
    }
  }

  /** CLIMB2: is the free climber where the move put it still on the wall, and clear of everything (bandsClear)? */
  _fcHeld(n, w) {
    return !!wallContact(this.collider, this.pos, [-n[0], 0, -n[2]], this.height, CAPSULE_RADIUS, w.seek || w.past != null || w.down ? PARKOUR_WALL_REACH : PARKOUR_CONTACT)
      && bandsClear(this.collider, this.pos, this.height);
  }

  /** CLIMB1: a move begins (CLIMB2: the climb it came out of has already let
   *  go - _wallEnd - and on this lane the classic climb never runs). The Jump
   *  that started it is spent (F7); the walk input is gone (F9 - the arms, the
   *  body and the peers read it); a move onto what moves notes where that
   *  stands (F5). A crouched move is CROUCHED from its first step (AUDIT
   *  CLIMB1 F1): the sensor proved its path at the crouch's height, and the
   *  first cut only armed the crouch's clock, which ran out a frame after the
   *  move - its last step and its settle were a standing body's, up through
   *  the ceiling over the top. The eye sinks across the rise on the crouch's
   *  own clock, so it is down before the body passes under anything. */
  _parkourBegin(move) {
    // CLIMB4: the move begins - and the speed the body came to it at (a catch's impact: the feel's dip, the sound's weight)
    // AUDIT CLIMB-HANDS (found on the way): and on the move itself - the hands' landing and ClimbPose's pendulum read
    // `m.speed`, and the speed was said on the event alone (every catch swung at a standstill's)
    move.speed = Math.hypot(this.velY, this._airVelX, this._airVelZ);
    this._pkMoveEvent(move, move.speed);
    this._pkUnsink();
    this._pkArm = null;   // the tap catch: the press is spent on the move
    this._pkLeap = null;  // CLIMB3: a leap's flight ends in what it caught
    this._pkOffEdge = null;   // AUDIT CLIMB-ARC L6: a move is no run off an edge (a wall run let go is no late leap)
    this._pkMove = move;
    // CLIMB2: a corner the shimmy turns is no new exertion. AUDIT CLIMB-ARC L13: a frame of several steps can begin two
    // moves (an eject and its catch at 10 fps) - both are billed: the second makes the frame's flag a list
    if (move.bill !== false) this.parkoured = this.parkoured ? [].concat(this.parkoured, move.kind) : move.kind;
    this._pkJumpLatch = true;
    this.moveForward = 0;
    this.moveStrafe = 0;
    this.moveSpeed = 0;
    if (move.crouch && !this.crouching) {
      this._pkCrouchRestore = this.heightAction !== 'crouch';
      this.standingHeightAdjustment = 0;
      this.crouching = true;
      this.heightAction = 'crouch';
      this.heightTimer = 0;
      this.heightTimerMax = move.dur * move.split;
    }
    move.carrier = move.key != null ? (this.collider.bucketPose?.(move.key) ?? null) : null;
  }

  /** CLIMB1: one step of the move in flight. The feet ride the scripted
   *  path (every point of it proven clear before it began), carrying no
   *  velocity and no fall: a catch in the air anchors any later fall at the
   *  catch, as the classic climb's grasp does. A move onto a mover rides it.
   *  A mantle ends settled on the top; a vault or a clamber ends in the air
   *  past the far edge and is handed back to the ballistic arm - a vault with
   *  its momentum and a small rise, a clamber at a step's pace. */
  _parkourAdvance(dt, spent = false) {
    const m = this._pkMove;
    if (m.hang && this.parkour && !spent) {   // AUDIT CLIMB2 H4: a catch and a corner spend the grip as the hang does
      const i = this.parkour.inputs?.() ?? {};
      this.grip = Math.max(0, this.grip - dt / gripSeconds(parkourSkill(i), i.fatigue ?? 1));
    }
    if (this._wall && !spent) this._wallTick(dt);   // AUDIT CLIMB2 C7: time round a corner (or reaching round a cornice) is time on the wall
    if (m.carrier) {
      const now = this.collider.bucketPose(m.key);
      if (now) { carryMove(m, m.carrier, now); m.carrier = now; }
    }
    m.t = Math.min(1, m.t + dt / m.dur);
    if (m.stand && this.crouching && m.t >= m.split) {
      // CLIMB-DOWN: the lower ends hanging, the standing body's hold - stood as the drop begins (the whole path proven
      // at the standing height), the eye rising on the stand's own clock while the feet go down the face
      this.standingHeightAdjustment = 0;
      this.crouching = false;
      this.heightAction = 'stand';
      this.heightTimer = 0;
      this.heightTimerMax = m.dur * (1 - m.split);
    }
    movePoint(m, m.t, this.pos);
    this.velY = 0;
    this._airVelX = 0;
    this._airVelZ = 0;
    this.jumping = false;
    this.falling = false;
    this.fallStart = this.pos[1];
    this.grounded = false;
    this.groundKey = null;
    if (m.t >= 1 && m.next) {
      // CLIMB-DOWN: a move chained on (over a parapet, then down into the hang on its far side) goes on from where this
      // one ended, as one move: no new bill, the body never set down between them
      const nx = m.next;
      nx.carrier = nx.key != null ? (this.collider.bucketPose?.(nx.key) ?? null) : null;
      this._pkMove = nx;
      this._pkMoveEvent(nx, 0);   // CLIMB4: told as its own move - the feel looks down over the edge, not up a second sill
    } else if (m.t >= 1) {
      this._pkMove = null;
      if (m.hang && this._wall) {
        // AUDIT CLIMB2 C7: A CORNER IS THE SAME HOLD GOING ON. Let go of and taken afresh, each corner said the grip's
        // warning again, restarted the Climbing tally (a pillar's faces, each shorter than its cadence, never trained
        // it) and dropped the climb's flag (the fatigue band billed a walk); only the wall held is the next face's.
        // (A reach round a cornice, G4, is the same: the free climb's hold goes on, hanging.)
        const w = this._wall;
        w.mode = 'hang';
        w.normal = [m.hang.normal[0], 0, m.hang.normal[2]];
        w.lipY = m.hang.lipY;
        w.key = m.key ?? null;
        w.carrier = w.key != null ? (this.collider.bucketPose?.(w.key) ?? null) : null;
        w.upRefused = false;
        w.cornerRefused = 0;
        this._pkHold();
        // AUDIT CLIMB-ARC F9: the hands land on the hold the move ends in - told, as a catch is, though the wall goes on
        // (the feel's leap dip is its arrival's; the sounds' is the move's own last cue, flushed)
        this._pkEmit('hold', { mode: 'hang', normal: [w.normal[0], 0, w.normal[2]] });
      } else if (m.hang) {
        this._wallBegin('hang', m.hang.normal, m.hang.lipY, m.key);   // CLIMB2: a catch ends held, under the lip
        // AUDIT CLIMB-ARC D1: the lower was walked into with Forward held, and Forward in the hang climbs up - held on, it
        // mantled the body straight back onto the roof, stood, and walked it off the edge. The hang asks a fresh Forward.
        if (m.kind === 'lower' && this._wall) this._wall.upRefused = true;
      } else if (m.wall) {
        this._wallBegin('climb', m.wall.normal, null, m.key);   // CLIMB3: a wall run with no lip ends on the wall
      } else if (m.exit) {
        this.jumping = true;   // Jumping withholds the floor snap until the landing
        this.velY = m.exitVy ?? 0;
        this._airVelX = m.exit[0];
        this._airVelZ = m.exit[1];
      } else {
        const r = this.collider.move(this.pos, 0, -0.05, 0, this.height, true);
        this.grounded = r.grounded;
        this.groundKey = r.grounded ? (r.groundKey ?? null) : null;
      }
    }
    // the climb's own mirror (AUDIT 65 XL-5): the step returns above both
    // writers of the cached pair, and a move carries no input vector
    this.standing = this.grounded;
    this.movingLessThanHalfSpeed = this.grounded ? true : this._halfSpeedBase() / 2 >= this.speed;
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
      // `moveDirection = Vector3.zero` (:289) is also what
      // IsStandingStill reads (:113-125), so this step is "standing
      // still" exactly while grounded - the footstep hosts' term.
      this.standing = this.grounded;
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
      this._pkMove = null;   // AUDIT CLIMB1 F4: a freeze follows a placement (the helm's, a teleport's) - the move is over
      if (this._wall) this._wallEnd();   // CLIMB2: and the hold
      this._pkOffEdge = null; this._pkLeap = null;   // AUDIT CLIMB-ARC L6: a Jump pressed under the freeze is no late leap after it
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
    // CLIMB1: the enhanced climb's move, or its start - above the classic
    // climb, whose top-out it is (a lip coming within reach of a climber's
    // hands is climbed over, not shoved over).
    if (this._parkourStep(dt, input, yaw)) return;
    // M3 CLIMBING: the check + (while climbing) the movement - before
    // the swim/levitate branch, exactly DFU's order (:319-326; the
    // climb wins the step when active).
    if (!this._pkOn && this._climbStep(dt, input, yaw)) return;   // CLIMB2: the enhanced lane's is the free climb
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
        speed = this.swimSpeedNow();
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
        : this._halfSpeedBase() / 2 >= this.speed;
      // ...and IsStandingStill itself, off the same reasoning: with
      // moveDirection zeroed at :322-326, :113-125 collapses to
      // `grounded`. The footstep hosts read this term (PlayerFootsteps
      // .cs:264-265), and the walk path's _trackHalfSpeed is below
      // this return. (AUDIT 65 XL-5: _climbStep writes the same pair
      // for the same reason - the climb is the other disjunct of
      // :322-326 - so this is no longer the only mirror.)
      this.standing = this.grounded;
      // AUDIT 64 F6 - LevitateMotor.cs:67-69, "Cancel levitate movement
      // if player is paralyzed": the return sits ABOVE the input read
      // (:71-78), above the upDownVector ladder whose first arm is the
      // over-encumbered sink (:81-89) and above the one movement call
      // in the component (groundMotor.MoveWithMovingPlatform, :106).
      // The sink is NOT an input term - it is generated here from
      // carriedWeight - so the hosts' zeroed paralysis bag cannot
      // neutralise it, and a paralyzed over-encumbered swimmer was
      // dragged to the bottom where DFU holds them still.
      //
      // It goes HERE, below the vector zeroing and the half-speed
      // mirror rather than at the top of the branch: PlayerMotor.cs
      // :321-326 (`moveDirection = Vector3.zero; return;`) runs for
      // every swimmer/levitator whether paralyzed or not, and
      // IsMovingLessThanHalfSpeed is a live GETTER (:168-181), not a
      // per-frame write. What DFU's return actually skips is the move
      // - so grounded/groundKey deliberately keep their last values,
      // as Unity's isGrounded does when no Move is issued.
      if (this.paralyzed) return;
      // DW-D: ...and a DISABLED LevitateMotor (Iliac Puddle No More's GuardSwimMotorFrameSpike) runs no Update at all -
      // PlayerMotor's return above still zeroes and mirrors, as it does for every swimmer, and nothing moves.
      if (!this.levitateMotorEnabled) return;
      // DW-D: LevitateMotor moves through groundMotor.MoveWithMovingPlatform - a bare CharacterController.Move, which
      // never pulls the capsule DOWN onto what is under it; the snap is AcrobatMotor's anti-bump, PlayerMotor's
      // grounded path alone. With it here a swimmer (or a levitator) passing within a step of anything under it was
      // dragged onto it - a carved sea's floor wall caught a surface swimmer by the knees at the coast (measured).
      const r = this.collider.move(this.pos, mx * speed * dt, my * speed * dt, mz * speed * dt, this.height, false);
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
        : (this.crouching ? crouchSpeed(this.stats.speed) : this._refreshWalkSpeed());   // DW-D: GetBaseSpeed's walk arm is RefreshWalkSpeed
      if (this.isSneaking) speed = sneakSpeed(speed);
    }
    // AUDIT 64 F0 - UpdateSpeed's THIRD statement (PlayerMotor.cs
    // :383-389): `if (playerEnterExit.IsPlayerSwimming &&
    // !PlayerEntity.IsWaterWalking) speed = GetSwimSpeed(speed)`, over
    // the ALREADY input-adjusted speed (PlayerSpeedChanger.cs:418-422
    // = swimSpeed above), so run/sneak/crouch/ride scale first and the
    // swim law multiplies the result.
    //
    // This arm is the EXTERIOR swimmer's, and it is live: outdoors
    // PlayerEnterExit.cs:414-421 clears levitateMotor.IsSwimming
    // unconditionally but clears isPlayerSwimming only when
    // PlayerTileMapIndex != 0 - and tile 0 is the swim tile - so
    // FixedUpdate's swim/levitate early return (:322-326) is NOT taken
    // and the grounded path carries the swim speed. `sunk` is the
    // port's controllerSink, which DoSinking/DoUnsinking write in
    // lockstep with IsPlayerSwimming (PlayerHeightChanger.cs:419-423,
    // :374-377). Without it a lake was crossed at the full grounded
    // walk/run/sneak speed.
    //
    // It must precede BOTH writes below: DFU scales the `speed` FIELD,
    // and IsMovingLessThanHalfSpeed (PlayerMotor.cs:168-181) compares
    // GetBaseSpeed()/2 against that already-swim-scaled field, so a
    // swimmer under half the walk base reads movingLessThanHalfSpeed
    // true for the stealth and footstep-cadence consumers.
    //
    // XL-1 NOTE: `isPlayerSwimming` is on this motor now, so re-pointing
    // this gate at it makes UpdateSpeed verbatim and closes the <=1-frame
    // gap where a dungeon exit onto open water carries the latch before
    // DoSinking has armed the sink.
    // DW-D (2026-09-25): THE SWAP, because the two stopped moving in
    // lockstep. Iliac Puddle No More forges PlayerEnterExit.IsPlayerSwimming
    // for its sea and unsinks the capsule of a swimmer whose head is clear
    // of the surface (KeepSurfaceCameraUnsunk) - so `sunk` goes false
    // while DFU's own gate, the host flag, stays true, and a proxy on
    // `sunk` would walk the swimmer at the full ground speed.
    if (this.isPlayerSwimming && !this.waterWalking) speed = swimSpeed(speed, this.stats.swimming ?? 0);
    if (this._rattleLeft > 0) speed *= this._rattleShare;   // TELL6e: a slam, a ring or a leap that landed rattles the walk
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
    this.moveStrafe = input.strafe || 0; this.moveYaw = yaw;   // AUDIT PRE-MERGE 0929 D1/D2: and the yaw they were turned by

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
    } else if (this.enhancedJumping?.() && !this._pkLeap) {   // AUDIT CLIMB-ARC L3: a leap's flight keeps its launch
      // AUDIT 64 F2 - AcrobatMotor.CheckAirControl (:130-151), the
      // IsEnhancedJumping disjunct of :145. Its one caller is
      // PlayerMotor.cs:349-353, the airborne arm, with the `speed`
      // UpdateSpeed just wrote - so under a Jump spell the airborne
      // x/z are recomputed from live input instead of replaying the
      // frozen liftoff momentum. The pair is literally the grounded
      // arm's, which is right: `TransformDirection(inputX*f, 0,
      // inputY*f) * speed` under a yaw-only player transform is that
      // same pair (AcrobatMotor.cs:147-149 vs FrictionMotor.cs:84-85),
      // and moveDirection.y is untouched, so no gravity term rotates.
      //
      // Not jump-only: CheckAirControl runs on EVERY airborne frame, so
      // a Jump-buffed player who walks off a ledge steers too. And it
      // ASSIGNS rather than adds, which is what makes HandleJumpInput's
      // moving-jump boost (:113-114) survive only the liftoff frame.
      // frictionMotor.PlayerControl is not modelled: it is sticky-true
      // on the classic path (FrictionMotor.cs:68/:87 with both slide
      // settings false), so a port of it would be a constant.
      // Paralysis needs no guard here either - DFU takes this arm with
      // inputX/inputY ZEROED (:137-141), i.e. the velocity is killed
      // rather than frozen, which the hosts' zeroed bag already gives.
      vx = (sin * input.forward + cos * input.strafe) * factor * speed;
      vz = (cos * input.forward - sin * input.strafe) * factor * speed;
      // SLOW-PRESS (AUDIT part five SP1): the Jump spell's air control re-asks the input every step - a press a face spent
      // stays spent (it re-pressed a slow fall into a face past the slope limit: 72 deg took 19.9 s, 74 deg at a run crept up)
      const n = this.slowFalling ? this._slowPress : null;
      if (n) { const d = vx * n[0] + vz * n[1]; if (d > 0) { vx -= d * n[0]; vz -= d * n[1]; } }
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
    // AUDIT 64 F1: and the SECOND of that same four-clause cancel
    // (AcrobatMotor.cs:64-70) - `OnExteriorWater ==
    // OnExteriorWaterMethod.Swimming`, which is exactly what this flag
    // holds (both exterior hosts write it from that comparison). The
    // clause is live because outdoor water does NOT engage the
    // replacement motor (PlayerEnterExit.cs:414-421 forces
    // levitateMotor.IsSwimming false above ground), so DFU reaches
    // HandleJumpInput while the player wades a record-0 tile and
    // refuses the leap; the port granted the full JUMP_SPEED * boost.
    // (The paralysis clause is covered host-side by the zeroed bag.)
    if (this.grounded && input.jump && !this.slowFalling && !this._pkJumpLatch   // AUDIT CLIMB1 F7: not the Jump a move spent
        && !this.onExteriorWater
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
    if (!this.grounded) {
      if (this.slowFalling && this.falling) {
        this.fallStart = this.pos[1];
        this.velY = -SLOWFALL_VELOCITY;   // F032: DFU's step, not ours
      } else {
        this.velY -= GRAVITY * dt;
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
    // stepOffset reach and is withheld only mid-jump (MAC3: onto the
    // terrain FLOOR too - the mesh-only snap left a hillside walk
    // hopping and landing every dozen steps), and the step-up
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
    const x0 = this.pos[0], y0 = this.pos[1], z0 = this.pos[2];
    const r = this.collider.move(this.pos, vx * dt, dy, vz * dt, this.height, !this.jumping);
    // SLOW-PRESS (FIELD BUGS 2026-10-01): on a slow fall the frozen liftoff momentum keeps only what the collider let it
    // do - the press into a face that HOLDS the body up is spent. Kept, it pinned the body to whatever wall the (five
    // times longer) glide reached, and on a face past the slope limit its push-out lifted the capsule more than the
    // spell's 0.035 m a step lowered it: the body hung there, or crept up it, until the spell ran out.
    if (this.slowFalling && this.falling && !r.grounded) {
      // AUDIT part five SP2: spent only once it has held the body over the spell's line further than a step's rise - a
      // lip in the step band is the step-up's to take (it needs the press the step after the touch; spent on the touch,
      // a glide a step under a lower roof's lip fell into the street); a face past the slope limit is slid down. SP1:
      // the way the face refused is kept, and the Jump spell's air control (above) is refused it until the body leaves
      const lift = this.pos[1] - (y0 + dy);
      if (lift > 1e-6) this._slowHeld = (this._slowHeld ?? 0) + lift;
      else { this._slowHeld = 0; this._slowPress = null; }   // nothing holds it up: off the face, steering is free
      if (this._slowHeld > STEP_OFFSET) {
        const ax = (this.pos[0] - x0) / dt, az = (this.pos[2] - z0) / dt;
        const lx = vx - ax, lz = vz - az, l = Math.hypot(lx, lz);
        if (l > 1e-3) this._slowPress = [lx / l, lz / l];   // the way the face refused - the air control's too
        if (ax * ax + az * az < vx * vx + vz * vz - 1e-6) { this._airVelX = ax; this._airVelZ = az; }
      }
    } else { this._slowHeld = 0; this._slowPress = null; }
    this.groundKey = r.grounded ? (r.groundKey ?? null) : null;   // platform riding: what holds us up
    this.grounded = r.grounded;
    if (r.grounded && this.velY < 0) this.velY = 0;
    // HitHead, verbatim: rising into a ceiling REVERSES the vertical
    // (DFU bounces the jump downward, not a zero-stop).
    if (r.hitCeiling && this.velY > 0) this.velY = -this.velY;
  }
}


