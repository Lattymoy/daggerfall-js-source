// Enemy senses + pursuit (C8 E2). Verbatim port of the CLASSIC path
// (EnhancedCombatAI = false) from DFU EnemyMotor.cs / EnemySenses.cs /
// EnemyAttack.cs (MIT, Daggerfall Workshop):
//   - sight = 4096 * MeshReader.GlobalScale, FOV 180, hearing 25
//   - senses re-evaluate when the classic system timer (dt divided by
//     0.0549254, the 0x46C memory-timer divisor) accumulates past 5
//   - decisions gate on the CLASSIC UPDATE (0.0625s); turns happen IN
//     PLACE at TurnToTarget's `const float turnSpeed = 20f`
//     (EnemyMotor.cs:1348-1350 - classic's 11.25 survives only in
//     that method's comment, "too slow for Daggerfall Unity's agile
//     player movement", and is NOT the compiled constant) behind the
//     5.625 deg move yaw-gate
//   - moveSpeed = (LiveSpeed + dfWalkBase 150) * GlobalScale - "Monster
//     speed of movement follows the same formula as for when the
//     player walks"
//   - classic stop distance vs the player = MeleeDistance 2.25, vs
//     other AI = ClassicMeleeDistanceVsAI 1.5, picked per pass in
//     TakeAction; "Classic always moves in for attack", never
//     strafes or backs away
// Departures (documented): eye height = feet + height * 5/6 (DFU:
// transform.position + controller.center + height/3 under Unity CC
// conventions); LOS raycasts the level collider only (entities are
// not solid in it), so "seen" = an unobstructed ray to the target eye
// - open swing doors are transparent for free because opening removes
// their collider bucket (the C3/actionSystem rule). SightModifier /
// HearingModifier are 0 for every entry in current DFU master.
// E3 SHIPPED: callers pass each entity's real LiveSpeed (career
// Speed). P13 SHIPPED: the stealth checks in detection - the
// classic flow is sight, hearing GATED ON PRIOR DETECTION ("classic
// stealth mechanics would be interfered with by hearing"), the
// illusion gate per classic update, then the once-per-classic-minute
// StealthCheck (odd minutes skipped while the player moves less than
// half speed; a fast-moving player who has been encountered is
// auto-detected; the Stealth skill tallies once per minute across
// ALL foes via the shared senses context). The S8 half-sight
// chameleon interim is REPLACED by the verbatim illusion gate
// (IsBlending -> an 8%-per-classic-update see-through roll).

import { GLOBAL_SCALE } from '../world/meshReader.js';
import { dice100 } from '../combat/formulas.js';   // PT1: Dice100 has ONE home and this file had written it out twice
import { CLASSIC_UPDATE_INTERVAL } from './weaponStates.js';   // single source (GameManager.cs:42)
import { CAPSULE_HEIGHT, CAPSULE_RADIUS, DF_WALK_BASE } from '../player/motor.js';           // single source
export { CLASSIC_UPDATE_INTERVAL };
export const GIVE_UP_TICKS = 200;   // EnemyMotor.GiveUpTimer refill (classic ticks; ~12.5s)
import { GRAVITY, FIXED_DT, MAX_FRAME_DT, CLASSIC_TO_UNITY_RATIO, FALL_DAMAGE_THRESHOLD } from '../player/motor.js';   // the shared fall rule + the P16 fixed-timestep law; CH3: the fall threshold single-sources with the player's

// C15 knockback (EnemyMotor.KnockbackMovement): classic units through
// the speed ratio. Stored speed clamps at 40; motion caps at 25; the
// hurt anim rides speed > 5; decay is 5 per CLASSIC UPDATE.
const KB = (v) => v / (CLASSIC_TO_UNITY_RATIO / 10);
export const KNOCKBACK_STORE_CAP = 40;
export const KNOCKBACK_MOTION_CAP = 25;
export const KNOCKBACK_HURT_THRESHOLD = 5;
export const KNOCKBACK_DECAY_PER_CLASSIC = 5;

export const SIGHT_RADIUS = 4096 * GLOBAL_SCALE;
export const HEARING_RADIUS = 25;
export const FIELD_OF_VIEW = 180;                    // deg
export const MELEE_DISTANCE = 2.25;
export const CLASSIC_MELEE_DISTANCE_VS_AI = 1.5;
// EnemyAttack.cs:28-29 - the ranged band, 240/2048 classic units at
// MeshReader.GlobalScale (= 6m / 51.2m), STRICT at both ends. AUDIT 24
// (wave 35): declared HERE rather than in enemyAttack.js, because the
// motor needs them for DoRangedAttack's stand-off and enemyAttack.js
// already imports MELEE_DISTANCE from this module - declaring them
// there and importing them here would close the third import cycle in
// three waves. enemyAttack.js re-exports them for its own readers.
export const MIN_RANGED_DISTANCE = 240 * GLOBAL_SCALE;
export const MAX_RANGED_DISTANCE = 2048 * GLOBAL_SCALE;
/** EnemySenses.lastHadLOSTimer (:455), refilled on sight or earshot and
 *  decremented once per classic update. */
export const LAST_HAD_LOS_TICKS = 200;
/** GetDestination's search ramp (:553-556): searchMult climbs by one
 *  per pass while it is <= 10 and the search position is inside the
 *  stop distance, and is reset to 0 the moment the target is reachable
 *  (:551) or the foe stops acting (HandleNoAction :362). */
export const SEARCH_MULT_MAX = 10;
/** ClearPathToPosition's default reach (:667) - GetDestination does NOT
 *  use it, passing the distance to the PREVIOUS destination instead. */
export const CLEAR_PATH_DEFAULT_DIST = 30;
export const CLASSIC_TURN_DEG = 20;                  // per classic update (TurnToTarget's turnSpeed)
// M3 / ONE DFU MEMBER ONE EXPORT: systemTimerUpdatesDivisor is a
// PlayerMotor field in DFU (climbing divides by it too) - moved to
// player/motor.js; re-exported so existing importers keep working.
export { SYSTEM_TIMER_UPDATES_DIVISOR } from '../player/motor.js';
export const SENSES_INTERVAL_UNITS = 5;              // classicTargetUpdateTimer > 5
export const MOVE_YAW_GATE_DEG = 5.625;
// CH4 (the senses verify pass): the STOPPED "just look at target"
// branch turns at a WIDER gate than AttemptMove's 5.625 - EnemyMotor
// .cs:514 TargetIsWithinYawAngle(22.5f). A melee-stopped foe stands
// up to 22.5deg off-face (the attack cone is 35.156, so it still
// swings); the old 5.625 here made stopped foes micro-track.
export const STOP_YAW_GATE_DEG = 22.5;
export { DF_WALK_BASE };   // ONE HOME: player/motor.js, beside DF_CROUCH_BASE (wave 34 turned the import round)
export const EYE_FRAC = 5 / 6;

export const enemyMoveSpeed = (liveSpeed) => (liveSpeed + DF_WALK_BASE) * GLOBAL_SCALE;

// ---- P13: stealth (EnemySenses.StealthCheck + FormulaHelper) ----
/** FormulaHelper.CalculateStealthChance, verbatim: 2 x ((classic
 *  distance units x live Stealth) >> 10) - C# int math. */
export function stealthChance(distance, liveStealth) {
  return 2 * ((Math.trunc(distance / GLOBAL_SCALE) * liveStealth) >> 10);
}
export const STEALTH_MAX_DISTANCE = 1024 * GLOBAL_SCALE;   // 25.6

// The classic spawn/despawn bands (EnemySenses.Start's five distance
// arrays, verbatim - index = MobileUnit.ClassicSpawnDistanceType,
// which is NOT an EnemyBasics field: RDBLayout reads it off the
// enemy marker's FlatResource.SoundIndex (RDBLayout.cs:1353, :1413,
// :1485) and it rides SetEnemy into the mobile). Player-inside
// (dungeons): a foe not yet "spawned" joins inside the SPAWN band,
// an already-spawned foe leaves outside the wider DESPAWN band -
// hysteresis, verbatim. Outdoors there is no band table and NO
// vertical test at all: upperXZ is the flat classicSpawnDespawnExterior.
export const CLASSIC_SPAWN_XZ_BY_TYPE = Object.freeze([1024, 384, 640, 768, 768, 768, 768].map((v) => v * GLOBAL_SCALE));
export const CLASSIC_SPAWN_Y_UPPER_BY_TYPE = Object.freeze([128, 128, 128, 384, 768, 128, 256].map((v) => v * GLOBAL_SCALE));
export const CLASSIC_SPAWN_Y_LOWER_BY_TYPE = Object.freeze([0, 0, 0, 0, -128, -768, 0].map((v) => v * GLOBAL_SCALE));
export const CLASSIC_DESPAWN_XZ_BY_TYPE = Object.freeze([1024, 1024, 1024, 1024, 768, 768, 768].map((v) => v * GLOBAL_SCALE));
export const CLASSIC_DESPAWN_Y_BY_TYPE = Object.freeze([384, 384, 384, 384, 768, 768, 768].map((v) => v * GLOBAL_SCALE));
export const CLASSIC_SPAWN_DESPAWN_EXTERIOR = 4096 * GLOBAL_SCALE;
// Row 0 (the default distance type) kept as named constants - the
// stealth/rest consumers read them.
export const CLASSIC_SPAWN_XZ = CLASSIC_SPAWN_XZ_BY_TYPE[0];
export const CLASSIC_SPAWN_Y_UPPER = CLASSIC_SPAWN_Y_UPPER_BY_TYPE[0];
export const CLASSIC_SPAWN_Y_LOWER = CLASSIC_SPAWN_Y_LOWER_BY_TYPE[0];
export const CLASSIC_DESPAWN_XZ = CLASSIC_DESPAWN_XZ_BY_TYPE[0];
export const CLASSIC_DESPAWN_Y = CLASSIC_DESPAWN_Y_BY_TYPE[0];

/** The wouldBeSpawnedInClassic recompute (per classic update). yDiff
 *  = foeY - playerY (SIGNED: the lower band uses the sign).
 *  distanceType = the marker's ClassicSpawnDistanceType (row into the
 *  five band arrays); playerInside = PlayerEnterExit.IsPlayerInside.
 *  Out-of-range rows are reproduced, not clamped: DFU indexes short[7]
 *  with the marker byte, and RDBLayout.cs:1478 notes fixed markers
 *  "have garbage data in the 8 MSBs" - the corpus carries one such
 *  marker (soundIndex 35). The IndexOutOfRangeException aborts
 *  EnemySenses.Start, leaving all five band fields at their 0f
 *  defaults, i.e. that foe is never spawned in classic indoors. */
export function wouldBeSpawnedInClassic(distanceToPlayer, yDiff, already, distanceType = 0, playerInside = true) {
  if (distanceToPlayer >= 1094 * GLOBAL_SCALE) return false;
  const yAbs = Math.abs(yDiff);
  const xz = Math.sqrt(Math.max(0, distanceToPlayer * distanceToPlayer - yAbs * yAbs));
  if (!playerInside) return xz <= CLASSIC_SPAWN_DESPAWN_EXTERIOR;   // no Y test outdoors
  const row = distanceType >= 0 && distanceType < CLASSIC_SPAWN_XZ_BY_TYPE.length ? distanceType : -1;
  const band = (arr) => (row < 0 ? 0 : arr[row]);
  const upperXZ = already ? band(CLASSIC_DESPAWN_XZ_BY_TYPE) : band(CLASSIC_SPAWN_XZ_BY_TYPE);
  const upperY = already ? band(CLASSIC_DESPAWN_Y_BY_TYPE) : band(CLASSIC_SPAWN_Y_UPPER_BY_TYPE);
  const lowerY = already ? 0 : band(CLASSIC_SPAWN_Y_LOWER_BY_TYPE);
  if (xz > upperXZ) return false;
  if (lowerY === 0) {
    if (yAbs > upperY) return false;
  } else if (yDiff < lowerY || yDiff > upperY) {
    return false;
  }
  return true;
}

/** EnemySenses.BlockedByIllusionEffect, verbatim (rolled per CLASSIC
 *  UPDATE): sees-through enemies are never blocked; an invisible
 *  target always blocks; blending (chameleon) tries an 8% see-through,
 *  a shade 4%; FailedRoll keeps the block. The three flags come from
 *  the TARGET's entity either way - the player's off the senses
 *  context, a foe target's off its candidate's concealment() closure
 *  (A5 built that closure in the three foe pools; the Illusion effect
 *  classes have written the flags entity-blind since S21). */
export function blockedByIllusionEffect(seesThrough, { invisible = false, blending = false, shade = false } = {}, rolls = Math.random) {
  if (seesThrough) return false;
  if (invisible) return true;
  if (!blending && !shade) return false;
  // The roll happens ONLY in this branch (DFU rolls no dice for an
  // unconcealed target - sequences must match).
  const chance = blending ? 8 : 4;
  return !dice100(chance, rolls());   // Dice100.FailedRoll
}

/** EnemySenses.CanHearTarget: inside the 25 radius (+HearingModifier
 *  0 for every current entry), blocked when STATIC geometry sits
 *  between. CH4 (the senses verify pass): the ray runs CENTER to
 *  center - DFU casts from transform.position (the capsule center)
 *  along directionToTarget (:942), not from the eye; the old
 *  eye-origin sat h/3 too high. Departure (documented): our
 *  collider's ray includes closed action doors (they are collider
 *  buckets), which DFU's static-only mask lets sound pass - a
 *  closed door muffles here. */
export function canHearTarget(collider, feet, height, targetFeet, dist) {
  if (dist >= HEARING_RADIUS) return false;
  const center = [feet[0], feet[1] + height / 2, feet[2]];
  const ex = targetFeet[0] - center[0], ey = targetFeet[1] + 0.9 - center[1], ez = targetFeet[2] - center[2];
  const el = Math.hypot(ex, ey, ez) || 1;
  const hit = collider.raycast(center, [ex / el, ey / el, ez / el], el);
  return !Number.isFinite(hit) || hit >= el - 1e-3;
}

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
 * eye-to-eye LOS ray against the level collider. C-slice: `blockerOut`
 * (optional { key }) receives the BUCKET that blocked the ray -
 * EnemySenses.CanSeeTarget:912-918 records an action door the sight
 * ray strikes first, which is what OpenDoors later consumes.
 */
export function canSeeTarget(collider, feet, yaw, height, targetFeet, targetHeight = CAPSULE_HEIGHT, blockerOut = null) {
  const dx = targetFeet[0] - feet[0], dz = targetFeet[2] - feet[2];
  const dist = Math.hypot(dx, targetFeet[1] - feet[1], dz);
  const radius = SIGHT_RADIUS;   // P13: the S8 half-sight chameleon interim retired - concealment is the illusion gate now
  if (dist >= radius) return false;
  if (!withinYaw(yaw, dx, dz, FIELD_OF_VIEW / 2)) return false;
  const eye = [feet[0], feet[1] + height * EYE_FRAC, feet[2]];
  const tEye = [targetFeet[0], targetFeet[1] + targetHeight * EYE_FRAC, targetFeet[2]];
  const ex = tEye[0] - eye[0], ey = tEye[1] - eye[1], ez = tEye[2] - eye[2];
  const el = Math.hypot(ex, ey, ez) || 1;
  if (blockerOut && collider.raycastHit) {
    const h = collider.raycastHit(eye, [ex / el, ey / el, ez / el], Math.min(radius, el));
    const seen = !Number.isFinite(h.dist) || h.dist >= el - 1e-3;
    if (!seen) blockerOut.key = h.key;
    return seen;
  }
  const hit = collider.raycast(eye, [ex / el, ey / el, ez / el], Math.min(radius, el));
  return !Number.isFinite(hit) || hit >= el - 1e-3;
}

// EnemyMotor.cs:34 - the maximum distance to open a door.
export const OPEN_DOOR_DISTANCE = 2;

/** EnemyMotor.OpenDoors (:1425-1442), the classic path: a
 *  CanOpenDoors foe whose LAST KNOWN DOOR (the sight ray's blocker)
 *  is not open, not locked, and closer than 2m - foe to door CENTER
 *  (EnemySenses:917) - toggles it. A MOVING door passes the IsOpen
 *  test and ToggleDoor's own IsMoving gate refuses it, exactly as
 *  DFU. The Enhanced-AI bash arm stays with its setting (unported).
 *  Returns true when the toggle fired. */
export function openDoorsStep(feet, canOpenDoors, door, toggleDoor) {
  if (!canOpenDoors || !door) return false;
  if (door.state === 'end') return false;                 // IsOpen
  if ((door.currentLockValue ?? 0) > 0) return false;     // IsLocked
  const d = Math.hypot(door.center[0] - feet[0], door.center[1] - feet[1], door.center[2] - feet[2]);
  if (d >= OPEN_DOOR_DISTANCE) return false;
  return !!toggleDoor(door);
}


/** Verbatim DaggerfallMobileUnit back-facing: 8 orientations at 45deg
 *  from the angle between the foe's forward and the horizontal
 *  direction TO the viewer; records mirror 5..7 -> 3..1 and
 *  AnimStateRecord % 5 > 2 (records 3, 4) is the back arc. The sign
 *  of the source's cross-product convention only swaps mirrored
 *  diagonals, which land on the SAME records - back-facing is
 *  sign-symmetric, so the |angle| form is exact. Unity's
 *  Mathf.RoundToInt rounds half-to-EVEN (112.5deg -> orientation 2,
 *  NOT back; 157.5 -> 4, back) - preserved. */
export function isBackFacing(foeYaw, foeFeet, viewerPos) {
  const dx = viewerPos[0] - foeFeet[0], dz = viewerPos[2] - foeFeet[2];
  const a = Math.atan2(dx, dz) - foeYaw;
  const deg = Math.abs(((a * 180 / Math.PI + 540) % 360) - 180);   // 0..180 off forward
  const r = deg / 45;
  const base = Math.floor(r), frac = r - base;
  const orientation = frac > 0.5 ? base + 1 : frac < 0.5 ? base : (base % 2 === 0 ? base : base + 1);
  const record = orientation > 4 ? 8 - orientation : orientation;
  return record % 5 > 2;
}

// C12: the behaviour motors (EnemyMotor.cs flies/swims).
export const MOBILE_SLAUGHTERFISH_ID = 11;      // the one swimmer that aims for the face
export const WATER_HEAD_MARGIN = 100 * GLOBAL_SCALE;   // WaterMove: keep 2.5 under the surface
export const FLYER_FLOOR_CLEARANCE = 1;         // FindGroundPosition((height/2) + 1)
export const FLYER_FLOOR_LIFT = 0.1;            // direction.y forced up when skimming

// ---- THE DETOUR MACHINE (AUDIT 24 wave 34) ----------------------------
// EnemyMotor's AttemptMove is not "move": it is probe, then move OR
// detour (EnemyMotor.cs:975-996). None of it was ported, so a foe
// pressed into a wall and slid along it, and walked off any ledge in
// its path. DFU refuses the step and commits to a way around.
/** ObstacleCheck's cast (:1143): `controller.radius / Mathf.Sqrt(2f)` -
 *  "follow walls at 45 degrees incidence". */
export const OBSTACLE_CHECK_DISTANCE = CAPSULE_RADIUS / Math.SQRT2;
/** The cast capsule's radius (:1154) - HALF the controller's. */
export const OBSTACLE_CAST_RADIUS = CAPSULE_RADIUS / 2;
/** :1151-1152. p1 sits `originalHeight * 0.1388` BELOW the controller
 *  centre ("climbable step for the player is around 0.65 of 1.8; the
 *  same ratio for the enemy"), p2 half a crouch-height above it. */
export const OBSTACLE_P1_BELOW_CENTRE = 0.1388;
export const DOOR_CROUCHING_HEIGHT = 1.65;      // :37, "how low enemies dive to pass thru doors"
/** The upward-slope re-cast (:1182-1189): a capsule from 0.25 below
 *  the centre, 0.75 of the height tall, aimed at a point one unit
 *  ahead and one unit UP. Clear = a climbable slope, not an obstacle. */
export const OBSTACLE_SLOPE_P1_BELOW_CENTRE = 0.25;
export const OBSTACLE_SLOPE_P2_ABOVE_P1 = 0.75;
/** FallCheck (:1211-1218): a downward ray from one unit ahead of the
 *  controller centre, reaching `originalHeight * 0.5 + 1.5`. */
export const FALL_CHECK_AHEAD = 1;
export const FALL_CHECK_DROP = 1.5;
/** FindDetour's state (:1010, :1033, :1094, :1133-1136). */
export const DETOUR_VERTICAL_DODGE = 0.3;       // flyers/swimmers try up or down first
export const DETOUR_UNSTUCK_RESET = 2;          // seconds clear before the clockwise choice resets
export const DETOUR_CLOCKWISE_TIMER = 5;        // seconds the chosen hand is committed for
export const DETOUR_SWEEP_STEP_DEG = 45;
export const DETOUR_SWEEP_MAX_TRIES = 7;        // `if (count > 7) break`
export const DETOUR_REACH = 2;                  // detourDestination = position + testMove * 2
export const DETOUR_TIMER = 0.75;               // avoidObstaclesTimer
export const DETOUR_ARRIVAL = 0.3;              // UpdateTimers zeroes the timer inside this

/**
 * Per-foe classic AI: senses on the system timer, decisions on the
 * classic update, movement applied continuously at the decided state.
 * C12: behaviour 'Flying'/'Spectral' = CanFly (3D pursuit at the
 * target's face, no gravity, the floor-skim guard); 'Aquatic' =
 * WaterMove (3D pursuit gated to below the block water surface via
 * waterSurfaceY(x, z), the 2.5 head margin, beached = frozen).
 */
export class EnemyAI {
  constructor(collider, feet, yawRad, { liveSpeed = 50, isHostile = true, height = CAPSULE_HEIGHT, seesThroughInvisibility = false, behaviour = 'General', mobileId = -1, waterSurfaceY = null, spawnDistanceType = 0, playerInside = true, isActionDoor = null, rolls = Math.random, hasBowAttack = false, canCastRangedSpell = null } = {}) {
    this.collider = collider;
    /** ObstacleCheck's DaggerfallActionDoor arm (:1167-1176). The AI
     *  cannot resolve a collider bucket key to an action object - the
     *  HOST owns that registry, exactly as it already does for the
     *  OpenDoors seam - so it asks. A host with no action doors (the
     *  two exterior pools) answers false and the arm is simply never
     *  taken, which is correct for it. */
    this.isActionDoor = isActionDoor ?? (() => false);
    this.rolls = rolls;
    /** IsLevitating (EnemyMotor.cs:89). WRITTEN by the Levitate effect's
     *  enemy arm - Levitate.SetEnemyMotor (:140-154) via
     *  StartLevitating/StopLevitating - which the port folds into
     *  effects.applyEnemyMotorEffectFlags, called by each foe pool
     *  before update() the way the player's own levitate flag is folded
     *  in scenes/shared.js. False for a foe carrying no Levitate. */
    this.levitating = false;
    this.feet = [feet[0], feet[1], feet[2]];
    this.yaw = yawRad;
    this.height = height;
    // CH3 (AUDIT 23 characters-8): EnemyMotor.ApplyFallDamage's
    // tracking pair - LastGroundedY refreshes while grounded, and a
    // landing after a past-threshold drop reports the distance for
    // the host to bill (the enemy shares the player's formula, per
    // the source's own comment).
    this.lastGroundedY = feet[1];
    this.landedFall = 0;   // > 0 for ONE host frame after a damaging landing
    this._airborne = false;
    // AUDIT 39: TakeAction re-derives `moveSpeed` from
    // `entity.Stats.LiveSpeed` EVERY FixedUpdate (:432), so a Drain or
    // Fortify Speed on a foe moves it. A number captured at spawn
    // cannot; callers that own the entity pass a THUNK over
    // liveStat(entity, 'speed') and the read happens per step.
    this._liveSpeed = typeof liveSpeed === 'function' ? liveSpeed : () => liveSpeed;
    this.seesThroughInvisibility = seesThroughInvisibility;
    // MobileUnit.ClassicSpawnDistanceType (the marker's SoundIndex) and
    // PlayerEnterExit.IsPlayerInside - both feed the spawn-band recompute.
    this.spawnDistanceType = spawnDistanceType;
    this.playerInside = playerInside;
    this.giveUpTimer = 0;   // G1: blind-pursuit ticks (EnemyMotor.GiveUpTimer)
    // MT-i: EnemySenses.Target + the SecondaryTarget slot
    // MakeEnemyHostileToAttacker writes (:197). A target is a
    // CANDIDATE descriptor ({ isPlayer } sentinel or { ai, entity })
    // from the host's shared list; null = no target = the :410-414
    // blind arm. The machine (characters/enemyTargets.js) arms only
    // through senses.targeting - unarmed callers keep the
    // player-only path, which is DFU's own behavior with no other
    // enemy in range.
    this.target = null;
    this.secondaryTarget = null;
    this.classicTargetUpdateTimer = 0;   // EnemySenses.cs:74 - the GetTargets cadence
    // EnemySenses.targetSenses (:56) is a persistent FIELD, and the
    // mutual-target write reads it OUTSIDE the spawn-band gate - so
    // it can be a target selected several passes ago.
    this.targetSenses = null;
    this.sawSecondaryTarget = false;   // :62 - written outside the Enhanced guard, read on the classic path
    this._armedTargeting = false;
    this._targetCandidate = null;
    // The detour machine's whole state (wave 34), name-for-name with
    // EnemyMotor's fields so the laws below read against the source.
    this.obstacleDetected = false;
    this.fallDetected = false;
    this.foundUpwardSlope = false;
    this.foundDoor = false;
    this.avoidObstaclesTimer = 0;
    this.detourDestination = [feet[0], feet[1], feet[2]];
    this.destination = [feet[0], feet[1], feet[2]];
    this.checkingClockwise = false;
    this.checkingClockwiseTimer = 0;
    this.didClockwiseCheck = false;
    this.lastTimeWasStuck = -Infinity;
    this._clock = 0;   // Time.time, accumulated on the fixed step
    // EnemySenses' target-position memory (wave 35). null stands in for
    // DFU's ResetPlayerPos sentinel (float.MaxValue on all three axes),
    // which HandleNoAction (:359) reads as "never seen, take no action".
    this.lastKnownTargetPos = null;
    this.oldLastKnownTargetPos = null;
    this.predictedTargetPos = null;
    this.lastPositionDiff = [0, 0, 0];
    this.awareOfTargetForLastPrediction = false;
    this.lastHadLOSTimer = 0;
    this.searchMult = 0;
    /** EnemyMotor.hasBowAttack (:131-137, off the MobileEnemy FLAGS) and
     *  CanCastRangedSpell (:759). The motor needs both for
     *  DoRangedAttack's band; the host owns the attack and cast
     *  components that know the answers. */
    this.hasBowAttack = hasBowAttack;
    this.canCastRangedSpell = canCastRangedSpell ?? (() => false);
    this.flies = behaviour === 'Flying' || behaviour === 'Spectral';   // CanFly, verbatim
    this.swims = behaviour === 'Aquatic';
    // Flyers (and the slaughterfish) aim for the target FACE
    // (PredictedTargetPos + targetHeight/2 above the center = feet +
    // height); other swimmers aim at the center (no ground flatten).
    this._aimY = this.flies || (this.swims && mobileId === MOBILE_SLAUGHTERFISH_ID)
      ? CAPSULE_HEIGHT : CAPSULE_HEIGHT / 2;
    this.waterSurfaceY = waterSurfaceY;
    this.velY = 0;
    this.detected = false;
    this.inSight = false;
    // EnemyMotor.Start:122 `IsHostile = mobile.Enemy.Reactions == Hostile`
    // - a dungeon marker whose action byte is 99 stands down until it is
    // struck (RDBLayout.AddEnemy :1519-1521). Pacification (C-slice)
    // clears it too; damage restores it.
    this.isHostile = isHostile;
    // TakeAction:443-449 sets stopDistance BEFORE GetDestination, and
    // both the approach test (:487) and the search ramp (:552) read it.
    // Seeded here so a caller that drives _getDestination directly has
    // the player value.
    this.stopDistance = MELEE_DISTANCE;
    this.justEncountered = false; // the first-detection EDGE (EnemySenses:504) - the host's pacify check consumes it
    this.moving = false;
    this._classicTimer = 0;
    this._acc = 0;           // P17: the fixed-step accumulator (render dt in, 1/60 steps out)
    this.knockbackSpeed = 0;   // C15: classic-through-ratio units; the scene sets it on landed hits
    this.knockbackDir = null;  // the attack ray direction (3D - flyers take the y)
    this.hurtKnock = false;    // per-step: speed above the hurt threshold (the scene's hurting input)
    this._dist = Infinity;
    // P13 stealth state (EnemySenses fields)
    this.hasEncounteredPlayer = false;
    this.wouldBeSpawned = false;
    this._blocked = false;               // blockedByIllusionEffect, rolled per classic tick
    this._lastStealthMinute = -1;        // timeOfLastStealthCheck (per foe)
  }

  /** TakeAction:432 - `(entity.Stats.LiveSpeed + dfWalkBase) *
   *  GlobalScale`, re-derived on every pass rather than captured. A
   *  READ, not a field, so nothing can freeze it back. */
  get speed() { return enemyMoveSpeed(this._liveSpeed()); }

  /** CH4 (the senses verify pass): the CLASSIC-gated senses halves.
   *  DFU's FixedUpdate runs the spawn-band recompute (:260-310) and
   *  the illusion roll (:444-449, the per-classic re-roll that makes
   *  chameleon matter - the source's own comment) only on
   *  GameManager.ClassicUpdate frames; sight/hearing/detection
   *  resolve every FixedUpdate (see _senses). This half runs per
   *  classic tick. */
  _classicSenses(playerFeet, senses = null) {
    // MT-i (the adversarial re-read): the LOS-timer decrement used to
    // live HERE, at the top of the classic tick. It is NOT there in
    // DFU - it sits at :446-447, in the SECOND ClassicUpdate block,
    // BELOW the `if (target == null) ... return;` at :410-414. So a
    // foe holding no target never decrements it: the timer freezes
    // rather than draining. Unarmed the difference is unobservable
    // (the player is always the target), which is why it survived
    // wave 35 - armed it is not, so it moved to _classicPostTarget
    // where the source keeps it.
    if (!senses) return;
    const dxp = playerFeet[0] - this.feet[0], dzp = playerFeet[2] - this.feet[2];
    const dist = Math.hypot(dxp, playerFeet[1] - this.feet[1], dzp);
    this.wouldBeSpawned = wouldBeSpawnedInClassic(
      dist, this.feet[1] - playerFeet[1], this.wouldBeSpawned, this.spawnDistanceType, this.playerInside);
  }

  /** The illusion re-roll (:444-449), split out of _classicSenses at
   *  MT-i so it runs AFTER the target block, DFU's Update order - and
   *  because BlockedByIllusionEffect reads the TARGET's concealment
   *  (:668-683): the player's flags ride the senses context as ever;
   *  a foe target's ride its candidate's concealment() closure (the
   *  host builds it over effects.js; absent = unconcealed). */
  _classicPostTarget(senses) {
    // EnemySenses.cs:443-449, the SECOND ClassicUpdate block - which
    // the :410-414 null-target return sits ABOVE, so neither of these
    // two runs on a tick that found no target.
    if (this.lastHadLOSTimer > 0) this.lastHadLOSTimer--;
    if (!senses) return;
    const foeTarget = this._armedTargeting && this.target && !this.target.isPlayer;
    const flags = foeTarget
      ? (this.target.concealment?.() ?? {})
      : {
          invisible: senses.playerInvisible ?? false,
          blending: senses.playerBlending ?? false,
          shade: senses.playerShade ?? false,
        };
    this._blocked = blockedByIllusionEffect(this.seesThroughInvisibility, flags, senses.rolls ?? Math.random);
  }

  /** EnemySenses' detection resolution. CH4: runs EVERY fixed step -
   *  DFU resolves sight (:421/:428), the hearing gate (:433-436) and
   *  detection (:451-470) every FixedUpdate, with the illusion block
   *  standing between classic re-rolls (_classicSenses). senses
   *  (optional, P13) = { gameMinutes, playerStealth,
   *  movingLessThanHalfSpeed, playerBlending, playerInvisible,
   *  playerShade, sharedStealth: { minute }, tallyStealth(), rolls }.
   *  Without it (headless/test callers) the pre-P13 sight+proximity
   *  shape applies. */
  _senses(playerFeet, senses = null) {
    const dx = playerFeet[0] - this.feet[0], dz = playerFeet[2] - this.feet[2];
    this._dist = Math.hypot(dx, playerFeet[1] - this.feet[1], dz);
    // C-slice: EnemySenses clears actionDoor at every CanSeeTarget
    // (:879) and records the ray's blocking door; the host resolves
    // the key against its action registry for OpenDoors.
    const _blocker = { key: null };
    // MT-i (the adversarial re-read): the destination eye is the
    // TARGET's own controller height (:896-898), not a constant. It
    // was the default capsule height here, which is exactly right for
    // the player and wrong for every foe target that is not
    // player-sized - a rat's eye sat a metre and a half too high, so
    // a wall that hides it did not.
    const _targetHeight = this._armedTargeting && this._targetCandidate && !this._targetCandidate.isPlayer
      ? (this._targetCandidate.ai?.height ?? undefined) : undefined;
    this.inSight = canSeeTarget(this.collider, this.feet, this.yaw, this.height, playerFeet, _targetHeight, _blocker);
    this.doorKey = _blocker.key;
    // AUDIT 24 (the re-read): DFU's NON-HOSTILE MODE is a TARGET drop,
    // not an action skip. EnemySenses.Update:321-327 nulls `target`
    // (and secondaryTarget) whenever `NoTargetMode || !motor.IsHostile`
    // and the player is it, and a null target takes :410-414 -
    // `targetInSight = false; detectedTarget = false; return;`. So a
    // pacified foe reads BLIND, which is what stops it attacking; the
    // components all keep ticking. The port had left both flags at
    // their geometric values and stopped the attack component at the
    // host instead, which dropped that foe's DFRandom draw off the one
    // shared global stream every classic tick it stood pacified.
    // MT-i: the ARMED exception to the pacified blind - DFU's
    // Update:321-327 drops only the PLAYER as a pacified foe's
    // target; a FOE target survives (a bear that attacks a pacified
    // orc is fought back through MakeEnemyHostileToAttacker), so a
    // pacified foe with a live foe target keeps its senses.
    const foeTarget = this._armedTargeting && this._targetCandidate && !this._targetCandidate.isPlayer;
    if (!this.isHostile && !foeTarget) {
      this.inSight = false;
      this.detected = false;
      return;
    }
    if (!senses) {
      // The port's no-stealth-context path (there is no such mode in DFU).
      // It still owes the target-position memory, or a foe driven this way
      // never has a destination at all and HandleNoAction freezes it.
      this.detected = this.inSight || this._dist < HEARING_RADIUS;
      if (this.detected) {
        this.lastKnownTargetPos = [playerFeet[0], playerFeet[1], playerFeet[2]];
        this.lastHadLOSTimer = LAST_HAD_LOS_TICKS;
        this._encounterEdge();
      }
      this._trackPredictedPos();
      return;
    }
    // hearing only once the target is already detected and unseen -
    // "classic stealth mechanics would be interfered with by hearing"
    const inEarshot = (this.detected && !this.inSight)
      ? canHearTarget(this.collider, this.feet, this.height, playerFeet, this._dist)
      : false;
    // AUDIT 24 (wave 35): the TARGET-POSITION MEMORY, which the port did
    // not have at all - EnemySenses.cs:451-495. Sight or earshot writes
    // the live position and refills lastHadLOSTimer; a bare STEALTH
    // detection writes it only once that timer has run out, and the
    // source says why in as many words: "this gives better pursuit
    // behavior since enemies will go to the last spot they saw the
    // player instead of walking into walls".
    if (!this._blocked && (this.inSight || inEarshot)) {
      this.detected = true;
      this.lastKnownTargetPos = [playerFeet[0], playerFeet[1], playerFeet[2]];
      this.lastHadLOSTimer = LAST_HAD_LOS_TICKS;
    } else if (!this._blocked && this._stealthCheck(senses)) {
      this.detected = true;
      if (this.lastHadLOSTimer <= 0) this.lastKnownTargetPos = [playerFeet[0], playerFeet[1], playerFeet[2]];
    } else this.detected = false;
    if (this.detected) this._encounterEdge();

    this._trackPredictedPos();
  }

  /** The first-encounter edge (EnemySenses:503-505): DFU's guard is
   *  `detectedTarget && !hasEncounteredPlayer && target == player` -
   *  detecting a FOE target (MT-i, armed pools) never spends the
   *  player-encounter edge or the pacification roll it feeds. */
  _encounterEdge() {
    if (this._armedTargeting && this._targetCandidate && !this._targetCandidate.isPlayer) return;
    if (!this.hasEncounteredPlayer) { this.hasEncounteredPlayer = true; this.justEncountered = true; }
  }

  /** EnemySenses.cs:472-495 - the tail of the detection block: the
   *  prediction anchor, and the movement difference taken across two
   *  consecutive prediction passes that both had sight. */
  _trackPredictedPos() {
    if (this.lastKnownTargetPos === null) return;
    if (this.oldLastKnownTargetPos === null) this.oldLastKnownTargetPos = [...this.lastKnownTargetPos];
    // :475-476. In the CLASSIC path the predicted position simply IS the
    // last known one - `predictedTargetPos == ResetPlayerPos ||
    // !EnhancedCombatAI` is true every pass, and PredictNextTargetPos is
    // called only inside the Enhanced guard at :496-501. So the port has
    // no lead prediction to write, and that is verbatim, not a gap.
    this.predictedTargetPos = this.lastKnownTargetPos;
    // :479-495, gated on targetPosPredict - a 0.0625s timer, which is the
    // classic-update interval; the port folds it onto the classic tick.
    // The DIFFERENCE is only taken across two CONSECUTIVE prediction
    // passes that both had sight, which is what awareOfTargetForLast-
    // Prediction is for; it survives the Enhanced guard because only the
    // PredictNextTargetPos call sits inside it.
    if (this._targetPosPredict) {
      if (!this._blocked && this.inSight) {
        if (this.awareOfTargetForLastPrediction) {
          this.lastPositionDiff = [
            this.lastKnownTargetPos[0] - this.oldLastKnownTargetPos[0],
            this.lastKnownTargetPos[1] - this.oldLastKnownTargetPos[1],
            this.lastKnownTargetPos[2] - this.oldLastKnownTargetPos[2],
          ];
        }
        this.oldLastKnownTargetPos = [...this.lastKnownTargetPos];
        this.awareOfTargetForLastPrediction = true;
      } else {
        this.awareOfTargetForLastPrediction = false;
      }
    }
  }

  /** EnemyMotor.MakeEnemyHostileToAttacker (G1): pre-load the give-up
   *  timer so a crime-responding guard pursues without having seen the
   *  player yet (guards get 200 * 3 classic ticks, verbatim). */
  /**
   * EnemyMotor.MakeEnemyHostileToAttacker (:186-211), the part that is
   * not target bookkeeping: refill the give-up timer AND SEED THE
   * REMEMBERED POSITION.
   *
   * AUDIT 24 (wave 36): the seed was missing, and wave 35 turned that
   * from harmless into a freeze. HandleNoAction (:357-366) refuses to
   * act at all while PredictedTargetPos is the ResetPlayerPos sentinel,
   * so a watchman spawned hostile out of sight - which is how the watch
   * arrives - now had a full give-up timer and nowhere to spend it. DFU
   * hands it the attacker's position precisely so it walks to where the
   * attack came from. (Found by the wave-35 scout, in wave 35.)
   *
   * `attackerFeet` is in the port's feet space, like everything else on
   * this class; DFU stores a controller centre and the aim offset in
   * GetDestination carries the difference.
   */
  makeHostileToPlayer(ticks = GIVE_UP_TICKS, attackerFeet = null) {
    this.giveUpTimer = ticks;
    if (!attackerFeet) return;
    const at = [attackerFeet[0], attackerFeet[1], attackerFeet[2]];
    this.lastKnownTargetPos = at;
    this.oldLastKnownTargetPos = [...at];
    this.predictedTargetPos = at;
  }

  /** MT-i: MakeEnemyHostileToAttacker's TARGET bookkeeping
   *  (:193-202), which the method above's own comment called "the
   *  part that is not target bookkeeping" while the port was
   *  single-target. The reassign guard is verbatim: only when there
   *  is no target, the current one is unseen, or it stands more than
   *  2 units off. attacker is a candidate descriptor; the player arm
   *  (:204-213) raises hostility here and the ally TEAM reset is the
   *  entity-side half (enemyTargets.resetAllyTeamOnPlayerAttack -
   *  the motor does not own entities). */
  makeEnemyHostileToAttacker(attacker, attackerFeet = null, ticks = GIVE_UP_TICKS) {
    if (attacker && (this.target == null || !this.inSight || this._dist > 2)) {
      this.target = attacker;
      this.secondaryTarget = attacker;
      if (attackerFeet) {
        const at = [attackerFeet[0], attackerFeet[1], attackerFeet[2]];
        this.oldLastKnownTargetPos = [...at];
        this.lastKnownTargetPos = at;
        this.predictedTargetPos = at;
      }
      this.giveUpTimer = ticks;
    }
    if (attacker?.isPlayer) this.isHostile = true;
  }

  /** EnemySenses.StealthCheck, verbatim: the castle-non-hostile gate
   *  is inert here (no castle detection; foes are hostile-on-sight);
   *  un-spawnable-in-classic foes never stealth-detect; one check per
   *  classic MINUTE (between minutes the standing detection holds);
   *  a slow-moving player skips ODD minutes; a fast-moving player who
   *  has been encountered is detected outright; the Stealth skill
   *  tallies once per minute ACROSS foes (the shared minute rides the
   *  scene's senses context, like PlayerEntity.TimeOfLastStealthCheck). */
  _stealthCheck(senses) {
    if (!this.wouldBeSpawned) return false;
    if (this._dist > STEALTH_MAX_DISTANCE) return false;
    const gameMinutes = senses.gameMinutes ?? 0;
    if (gameMinutes === this._lastStealthMinute) return this.detected;
    // MT-i: StealthCheck's `if (target == player)` half (:633-650) -
    // the half-speed minute skip, the encountered fast-mover
    // auto-detect and the Stealth TALLY are the PLAYER target's; a
    // foe target (armed pools) rolls on its own live Stealth below.
    const foeTarget = this._armedTargeting && this._targetCandidate && !this._targetCandidate.isPlayer;
    if (!foeTarget) {
      if (senses.movingLessThanHalfSpeed) {
        if ((gameMinutes & 1) === 1) return this.detected;
      } else if (this.hasEncounteredPlayer) {
        return true;
      }
      if (senses.sharedStealth && senses.sharedStealth.minute !== gameMinutes) {
        senses.tallyStealth?.();
        senses.sharedStealth.minute = gameMinutes;
      }
    }
    this._lastStealthMinute = gameMinutes;
    // CalculateStealthChance(distanceToTarget, target) reads the
    // TARGET's live Stealth (:654): the foe entity's uniform skill
    // block (skillsLevel) or the candidate's own stealthOf override.
    const liveStealth = foeTarget
      ? (this._targetCandidate.stealthOf?.()
        ?? (typeof this._targetCandidate.entity?.skills === 'number' ? this._targetCandidate.entity.skills : 0))
      : (senses.playerStealth ?? 0);
    const chance = stealthChance(this._dist, liveStealth);
    const rolls = senses.rolls ?? Math.random;
    return !dice100(chance, rolls());   // Dice100.FailedRoll(stealthChance) -> detected on a FAILED stealth roll
  }

  /** The controller CENTRE - DFU's `transform.position` for a
   *  CharacterController, which every probe below is written from. The
   *  port stores FEET. */
  _centre() { return [this.feet[0], this.feet[1] + this.height / 2, this.feet[2]]; }

  /**
   * EnemyMotor.ObstacleCheck (:1140-1201), verbatim, with the two
   * exemptions the port's collider cannot express folded out:
   * entities are not in the collider (canSeeTarget says so), so the
   * "the obstacle is my combat target" arm and the DaggerfallLoot arm
   * can never fire - they are documented here rather than written as
   * dead branches. The DaggerfallActionDoor arm CAN fire: doors are
   * their own collider buckets, keyed by the action object, which is
   * the same key EnemySenses already reads for OpenDoors.
   */
  _obstacleCheck(dir) {
    this.obstacleDetected = false;
    this.foundUpwardSlope = false;
    this.foundDoor = false;
    const c = this._centre();
    const p1 = [c[0], c[1] - this.height * OBSTACLE_P1_BELOW_CENTRE, c[2]];
    const p2 = [p1[0], p1[1] + Math.min(this.height, DOOR_CROUCHING_HEIGHT) / 2, p1[2]];
    const hit = this.collider.capsuleCast(p1, p2, OBSTACLE_CAST_RADIUS, dir, OBSTACLE_CHECK_DISTANCE);
    if (!Number.isFinite(hit.dist)) return;
    this.obstacleDetected = true;
    if (this.isActionDoor(hit.key)) {
      this.obstacleDetected = false;
      this.foundDoor = true;
      // :1170-1175 - the door is only RECORDED as senses.LastKnownDoor
      // when it is within 22.5 degrees of the way the foe is facing.
      // Wave 34 dropped that gate, and FindDetour probes 45, 90, 135
      // degrees off: a foe working its way round an obstacle would
      // record - and the host would then open - a door up to 180
      // degrees behind it. (Found by the wave-35 re-read.)
      if (withinYaw(this.yaw, dir[0], dir[2], STOP_YAW_GATE_DEG)) this.doorKey = hit.key;
      return;
    }
    if (this.swims || this.flies || this.levitating) return;
    // The climbable upward slope: re-cast a TALLER capsule at a point
    // one unit ahead and one unit up. Clear = walk into it.
    const up = [c[0] + dir[0], c[1] + dir[1] + 1, c[2] + dir[2]];
    let ux = up[0] - c[0], uy = up[1] - c[1], uz = up[2] - c[2];
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    const q1 = [c[0], c[1] - this.height * OBSTACLE_SLOPE_P1_BELOW_CENTRE, c[2]];
    const q2 = [q1[0], q1[1] + this.height * OBSTACLE_SLOPE_P2_ABOVE_P1, q1[2]];
    if (!Number.isFinite(this.collider.capsuleCast(q1, q2, OBSTACLE_CAST_RADIUS, [ux, uy, uz], OBSTACLE_CHECK_DISTANCE).dist)) {
      this.obstacleDetected = false;
      this.foundUpwardSlope = true;
    }
  }

  /** EnemyMotor.FallCheck (:1204-1219), verbatim - including the early
   *  return, which is why ObstacleCheck must run FIRST: an obstacle, a
   *  slope or a door all cancel the fall test outright. */
  _fallCheck(dir) {
    if (this.flies || this.levitating || this.swims
      || this.obstacleDetected || this.foundUpwardSlope || this.foundDoor) {
      this.fallDetected = false;
      return;
    }
    const c = this._centre();
    const origin = [c[0] + dir[0] * FALL_CHECK_AHEAD, c[1] + dir[1] * FALL_CHECK_AHEAD, c[2] + dir[2] * FALL_CHECK_AHEAD];
    const reach = this.height * 0.5 + FALL_CHECK_DROP;
    // THE ANALYTIC FLOOR IS GROUND TOO (Mac's playtest: guards ran in
    // place and never chased). The exterior collider holds only the
    // location MODELS as triangles - terrain and the town surface are
    // the collider's heightAt floor, which move() walks but this ray
    // could not see. So on any open ground the probe found no floor
    // ahead, fallDetected latched EVERY step, and every guard and
    // encounter foe stood running against a phantom cliff (the detour
    // sweep fall-detects the same way in all eight directions). In
    // DFU the same Physics.Raycast hits the terrain collider. A
    // heightAt at/above the origin still counts as ground - there is
    // floor there, not a drop.
    const tri = this.collider.raycast(origin, [0, -1, 0], reach);
    const analyticDrop = origin[1] - (this.collider.heightAt?.(origin[0], origin[2]) ?? -Infinity);
    this.fallDetected = !(Number.isFinite(tri) || analyticDrop <= reach);
  }

  /** Rotate a direction about world up by `deg` - Quaternion.AngleAxis
   *  on Vector3.up. Unity is LEFT-handed with +y up, so a positive
   *  angle turns x toward -z... which in this port's yaw convention
   *  (x = sin, z = cos) is the same clockwise-from-above sense. */
  static _rotY(dir, deg) {
    const r = (deg * Math.PI) / 180;
    const cs = Math.cos(r), sn = Math.sin(r);
    return [dir[0] * cs + dir[2] * sn, dir[1], -dir[0] * sn + dir[2] * cs];
  }

  /**
   * EnemyMotor.FindDetour (:1002-1138), verbatim. The order matters and
   * every part of it is load-bearing:
   *   1. flyers and swimmers try a +/-0.3 vertical dodge FIRST, one way
   *      then the other, and skip the whole horizontal sweep if it works;
   *   2. two seconds clear of obstacles resets the committed hand;
   *   3. otherwise, once per five seconds, choose a hand - 45 degrees
   *      one way (picked at random), then the other, and if both are
   *      blocked, by the signed angle from the direction-to-destination;
   *      a SECOND choice inside those five seconds simply flips it;
   *   4. sweep in 45-degree steps in the committed hand until something
   *      is clear, giving up after eight tries and using the last probe
   *      whether it is clear or not.
   * The destination is two units along whatever came out, and the foe
   * is committed to walking at it for 0.75s (which UpdateTimers cuts
   * short on arrival).
   */
  _findDetour(dir2d, rolls = this.rolls) {
    let testMove = [0, 0, 0];
    let foundUpDown = false;
    if (this.flies || this.swims || this.levitating) {
      let mult = rolls() < 0.5 ? DETOUR_VERTICAL_DODGE : -DETOUR_VERTICAL_DODGE;   // Random.Range(0, 2)
      const tryDodge = (m) => {
        const v = [dir2d[0], dir2d[1] + m, dir2d[2]];
        const l = Math.hypot(v[0], v[1], v[2]) || 1;
        return [v[0] / l, v[1] / l, v[2] / l];
      };
      testMove = tryDodge(mult);
      this._obstacleCheck(testMove);
      if (this.obstacleDetected) {
        mult *= -1;
        testMove = tryDodge(mult);
        this._obstacleCheck(testMove);
      }
      if (!this.obstacleDetected) foundUpDown = true;
    }
    if (!foundUpDown && this._clock - this.lastTimeWasStuck > DETOUR_UNSTUCK_RESET) {
      this.checkingClockwiseTimer = 0;
      this.didClockwiseCheck = false;
    }
    if (!foundUpDown && this.checkingClockwiseTimer <= 0) {
      if (!this.didClockwiseCheck) {
        let angle = rolls() < 0.5 ? 45 : -45;   // Random.Range(0, 2)
        testMove = EnemyAI._rotY(dir2d, angle);
        this._obstacleCheck(testMove);
        this._fallCheck(testMove);
        if (!this.obstacleDetected && !this.fallDetected) {
          this.checkingClockwise = angle === 45;
        } else {
          angle *= -1;
          testMove = EnemyAI._rotY(dir2d, angle);
          this._obstacleCheck(testMove);
          this._fallCheck(testMove);
          if (!this.obstacleDetected && !this.fallDetected) {
            this.checkingClockwise = angle === 45;
          } else {
            // Both blocked: pick the hand by the signed angle from the
            // direction to the destination round to the way we are
            // facing (Vector3.SignedAngle(toTarget, direction2d, up)).
            const t = this.destination;
            const c = this._centre();
            const tx = t[0] - c[0], tz = t[2] - c[2];
            const tl = Math.hypot(tx, tz) || 1;
            const signed = (Math.atan2(dir2d[0], dir2d[2]) - Math.atan2(tx / tl, tz / tl)) * (180 / Math.PI);
            const norm = ((signed + 180) % 360 + 360) % 360 - 180;
            this.checkingClockwise = norm > 0;
          }
        }
        this.checkingClockwiseTimer = DETOUR_CLOCKWISE_TIMER;
        this.didClockwiseCheck = true;
      } else {
        this.didClockwiseCheck = false;
        this.checkingClockwise = !this.checkingClockwise;
        this.checkingClockwiseTimer = DETOUR_CLOCKWISE_TIMER;
      }
    }
    if (!foundUpDown) {
      let angle = 0;
      let count = 0;
      do {
        angle += this.checkingClockwise ? DETOUR_SWEEP_STEP_DEG : -DETOUR_SWEEP_STEP_DEG;
        testMove = EnemyAI._rotY(dir2d, angle);
        this._obstacleCheck(testMove);
        this._fallCheck(testMove);
        count++;
        if (count > DETOUR_SWEEP_MAX_TRIES) break;
      } while (this.obstacleDetected || this.fallDetected);
    }
    const c = this._centre();
    this.detourDestination = [
      c[0] + testMove[0] * DETOUR_REACH,
      c[1] + testMove[1] * DETOUR_REACH,
      c[2] + testMove[2] * DETOUR_REACH,
    ];
    if (this.avoidObstaclesTimer <= 0) this.avoidObstaclesTimer = DETOUR_TIMER;
    this.lastTimeWasStuck = this._clock;
  }

  /** EnemyMotor.UpdateTimers (:389-410), the detour half: the timer
   *  decays, and is CUT SHORT the moment the foe is within 0.3 of the
   *  detour destination measured in the horizontal plane only. */
  _updateDetourTimers(dt, canAct) {
    if (this.avoidObstaclesTimer > 0) this.avoidObstaclesTimer -= dt;
    if (this.avoidObstaclesTimer > 0 && canAct) {
      const c = this._centre();
      const dx = this.detourDestination[0] - c[0];
      const dz = this.detourDestination[2] - c[2];
      if (Math.hypot(dx, dz) <= DETOUR_ARRIVAL) this.avoidObstaclesTimer = 0;
    }
    if (this.checkingClockwiseTimer > 0) this.checkingClockwiseTimer -= dt;
  }

  /**
   * EnemyMotor.ClearPathToPosition (:667-693), verbatim: "true if clear
   * or if the combat target is the first obstacle hit".
   *
   * It is ObstacleCheck + FallCheck on the FLATTENED direction, then a
   * sphere cast of half the controller radius along the UNFLATTENED one.
   * The port's collider holds no entities, so DFU's "the first thing hit
   * is my target" arm can never be taken - a sphere cast that hits
   * anything at all here is level geometry, and the answer is false.
   * Note both probes WRITE the detour flags, exactly as DFU's do; the
   * caller re-probes before it moves.
   *
   * `location` is in DFU's `transform.position` space - a CONTROLLER
   * CENTRE, not feet. The caller converts. Passing feet tilts the cast
   * downward by half a body over its whole length and it hits the floor
   * a few metres out, which is how this was found.
   */
  _clearPathToPosition(location, dist = CLEAR_PATH_DEFAULT_DIST) {
    const c = this._centre();
    let dx = location[0] - c[0], dy = location[1] - c[1], dz = location[2] - c[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const flat = [dx, 0, dz];
    const fl = Math.hypot(flat[0], flat[2]);
    if (fl > 1e-9) { flat[0] /= fl; flat[2] /= fl; }
    this._obstacleCheck(flat);
    this._fallCheck(flat);
    if (this.obstacleDetected || this.fallDetected) return false;
    const hit = this.collider.capsuleCast(c, c, OBSTACLE_CAST_RADIUS, [dx, dy, dz], dist);
    return !Number.isFinite(hit.dist);
  }

  /**
   * EnemyMotor.GetDestination (:528-565), all three arms.
   *
   * AUDIT 24 (wave 35). Wave 34 ported the detour override alone, and
   * left the port beelining at the player's LIVE position through walls:
   * no path gate, no memory of where the target was last seen, and no
   * search. The middle arm is the one that makes a foe give up on a
   * player it cannot reach; the last is the one that sends it to the
   * doorway you went through instead of into the wall beside it.
   */
  /** `senses.Target.GetComponent<CharacterController>().height`
   *  (EnemyMotor.cs:532) - the TARGET's own capsule, which
   *  GetDestination measures twice against. Unarmed (and against the
   *  player) it is the one capsule constant the port has always used;
   *  armed, a rat and a giant are not the same height and the source
   *  says so in as many words. */
  _targetHeight() {
    const t = this._armedTargeting ? this._targetCandidate : null;
    return (t && !t.isPlayer && t.ai?.height) || CAPSULE_HEIGHT;
  }

  _getDestination(playerFeet) {
    const c = this._centre();
    const tHeight = this._targetHeight();
    if (this.avoidObstaclesTimer > 0) {
      this.destination = this.detourDestination;
      return;
    }
    // The `dist` argument is the distance to the PREVIOUS destination -
    // GetDestination passes `(destination - transform.position).magnitude`
    // rather than the default 30, so the gate reaches exactly as far as
    // the foe was already heading. Kept.
    const prev = this.destination ?? playerFeet;
    // DFU measures centre-to-centre; both sides of the port's subtraction
    // are feet-space, which is the same difference.
    const prevDist = Math.hypot(prev[0] - this.feet[0], prev[1] - this.feet[1], prev[2] - this.feet[2]);
    const predicted = this.predictedTargetPos ?? playerFeet;
    const predictedCentre = [predicted[0], predicted[1] + tHeight / 2, predicted[2]];
    // ...or the foe is a shooter with the target in sight, in which case
    // it heads for the target whether the path is clear or not (:539-540
    // - `senses.TargetInSight && (hasBowAttack || entity.CurrentMagicka > 0)`).
    if (this._clearPathToPosition(predictedCentre, prevDist)
      || (this.inSight && (this.hasBowAttack || this.canCastRangedSpell()))) {
      const d = [predicted[0], predicted[1], predicted[2]];
      // Flyers, levitators and the slaughterfish aim for the target FACE
      // (:543-544) - `targetController.height * 0.5f`, the TARGET's
      // capsule. _aimY carries the port's who-aims-where split (a
      // flyer at the face, a swimmer at the centre); the HEIGHT it
      // scales is the target's, which only MT-ii made variable.
      if (this.flies || this.levitating || this.swims) d[1] += this._aimY * (tHeight / CAPSULE_HEIGHT);
      this.destination = d;
      this.searchMult = 0;
    } else {
      // The SEARCH (:549-557): walk past the last known position along
      // the direction the target was last moving, further each pass, and
      // only while the search position is still inside the stop distance.
      const diff = this.lastPositionDiff;
      const dl = Math.hypot(diff[0], diff[1], diff[2]);
      const n = dl > 1e-9 ? [diff[0] / dl, diff[1] / dl, diff[2] / dl] : [0, 0, 0];
      const base = this.lastKnownTargetPos ?? playerFeet;
      const search = [
        base[0] + n[0] * this.searchMult,
        base[1] + n[1] * this.searchMult,
        base[2] + n[2] * this.searchMult,
      ];
      const sd = Math.hypot(search[0] - c[0], search[1] - c[1], search[2] - c[2]);
      if (this.searchMult <= SEARCH_MULT_MAX && sd <= this.stopDistance) this.searchMult++;
      this.destination = search;
    }
    // :559-564 - a GROUNDED foe aims at its own height, "otherwise short
    // enemies' vector can aim up towards the target, which could
    // interfere with distance-to-target calculations". The delta is
    // `(targetController.height - originalHeight) / 2`: the TARGET's
    // capsule against this foe's own. It was written as
    // CAPSULE_HEIGHT (the player's) against `this.height` with a
    // comment saying the line was "written for the day they differ" -
    // MT-ii is that day, and a rat hunting a giant is the case.
    if (this.avoidObstaclesTimer <= 0 && !this.flies && !this.levitating && !this.swims) {
      this.destination = [this.destination[0], this.destination[1] - (tHeight - this.height) / 2, this.destination[2]];
    }
  }

  /**
   * EnemyMotor.DoRangedAttack (:568-614), the CLASSIC path - and the
   * `return true` at the end of it, which is the whole point.
   *
   * AUDIT 24 (wave 35): unported, so an archer or a ranged caster walked
   * all the way to melee range and shot you in the face. TakeAction calls
   * this BEFORE the advance/retreat decision (:468-470) and returns on
   * true, so a shooter inside the 6..51.2 band with the target in sight
   * does not pursue AT ALL: it turns to face and rolls its shot.
   *
   * The ROLL is not here. DFU rolls 1/32 for a bow and 1/40 for a spell
   * inside this method; the port's attack and cast components own those
   * (enemyAttack's BOW_SHOT_CHANCE, enemyCasting's decision), and putting
   * a second roll here would draw off the shared stream twice. What the
   * motor owes is the stand-off and the turn.
   */
  _doRangedAttack(dx, dz) {
    const inRange = this._dist > MIN_RANGED_DISTANCE && this._dist < MAX_RANGED_DISTANCE;
    if (!(inRange && this.inSight && this.detected && (this.hasBowAttack || this.canCastRangedSpell()))) return false;
    // Within 22.5 degrees of the destination it shoots (the components'
    // job); outside it, TurnToTarget. Either way it does not advance.
    if (!withinYaw(this.yaw, dx, dz, STOP_YAW_GATE_DEG)) this.yaw = turnTowards(this.yaw, dx, dz);
    this.moving = false;
    return true;
  }

  /** HandleNoAction (:357-366), the UNCONDITIONAL half - no target,
   *  the give-up timer spent, or a position never seen, and the search
   *  ramp resets on EVERY arm. DFU also drops CanAct here; the port's
   *  _classicTick keeps its own early returns for that half.
   *
   *  AUDIT 39r (R14): the first arm is DFU's `senses.Target == null`
   *  (:359), which carries no hostility term. `!isHostile` is the
   *  pacified player-drop half of it - but MT-iii established that a
   *  FOE target survives that drop, so the caller passes the same
   *  foeTarget the canAct/moving sites take, or a pacified foe that
   *  acts and pursues gets its search ramp zeroed underneath it on
   *  every step and searches at multiplier 0 forever. */
  _handleNoAction(foeTarget = false) {
    if ((!this.isHostile && !foeTarget) || this.giveUpTimer <= 0 || this.predictedTargetPos === null) {
      this.searchMult = 0;
    }
  }

  _classicTick(playerFeet) {
    // AUDIT 26 F010/F014: the GiveUpTimer refill/decrement used to live
    // HERE, inside the CanAct-gated decision - fused, exactly what the
    // finding names. It is UpdateTimers work and runs unconditionally
    // now (_step), so a knocked-back or paralyzed foe still runs down
    // its 12.5s blind-pursuit window. What remains here is TakeAction's
    // own guard: by this point a detected foe has been refilled to 200,
    // so `giveUpTimer <= 0` alone is DFU's HandleNoAction arm (:363 -
    // no `!detected` term; the refill has already run).
    if (this.giveUpTimer <= 0) { this.moving = false; return; }
    // HandleNoAction's third arm (:357-366): a position never seen
    // takes no action. The searchMult reset is hoisted with the rest
    // of HandleNoAction (AUDIT 26 F012) - it fires on ALL THREE arms
    // in _step, not just this one.
    if (this.predictedTargetPos === null) { this.moving = false; return; }
    // MT-iii (AUDIT 39) - TakeAction:443-449, the FIRST thing the
    // classic path does, ahead of GetDestination because the search
    // ramp reads it too (:552):
    //   if (senses.Target == PlayerEntityBehaviour) stopDistance = MeleeDistance;
    //   else stopDistance = ClassicMeleeDistanceVsAI;
    // "Classic AI moves only as close as melee range. It uses a
    // different range for the player and for other AI." The port held
    // the 2.25 literal at both sites, so two infighting foes each
    // halted 0.75 outside the 1.5 swing gate enemyAttack.js:154-155
    // already honours - a stand-off that never resolved.
    this.stopDistance = (this._armedTargeting && this.target && !this.target.isPlayer)
      ? CLASSIC_MELEE_DISTANCE_VS_AI : MELEE_DISTANCE;
    // GetDestination (:528-565), all three arms since wave 35.
    const detouring = this.avoidObstaclesTimer > 0;
    this._getDestination(playerFeet);
    const dx = this.destination[0] - this.feet[0], dz = this.destination[2] - this.feet[2];
    // Ranged attacks (:468-470) - the FIRST branch of TakeAction's
    // action ladder, AHEAD of the detour (AUDIT 26 F011: the port took
    // the detour first, so for up to 0.75s after an obstacle probe an
    // archer walked its detour instead of standing off - it shot on
    // the move; DFU's shooter in band with the target in sight stands
    // off and shoots while avoidObstaclesTimer merely decays).
    // DoRangedAttack reads senses.DistanceToTarget itself (:571-572),
    // so the detour state does not change what it measures.
    if (this._doRangedAttack(dx, dz)) return;
    // "If detouring, always attempt to move" (:481-484) - ahead of the
    // stop-distance test, which is why a detouring foe walks past its
    // own melee range to get round.
    if (detouring) {
      if (!withinYaw(this.yaw, dx, dz, MOVE_YAW_GATE_DEG)) {
        this.yaw = turnTowards(this.yaw, dx, dz);
        this.moving = false;   // classic turns in place
        return;
      }
      this.moving = true;
      return;
    }
    // :479-482 - THE DISTANCE THE STOP TEST USES. It is the distance to
    // the TARGET only while the target is in sight and no detour is
    // running; otherwise it is the distance to the DESTINATION, which
    // during a search is the last known position rather than wherever
    // the player has since walked to. Wave 34 and the first cut of
    // wave 35 both measured to the player unconditionally, so a foe
    // searching a room it had lost you in would stop the moment YOU
    // came within 2.25 of it - through the wall it could not see
    // through. (Found by the wave-35 re-read.)
    const distance = (this.avoidObstaclesTimer <= 0 && this.inSight)
      ? this._dist
      : Math.hypot(dx, this.destination[1] - this.feet[1], dz);
    // classic stop: the stopDistance set above; always moves in for
    // attack. CH4: the STOPPED turn rides the 22.5 "just look at
    // target" gate (EnemyMotor.cs:514), NOT AttemptMove's 5.625 -
    // a melee foe stands up to 22.5deg off-face.
    if (distance <= this.stopDistance) {
      this.moving = false;
      if (!withinYaw(this.yaw, dx, dz, STOP_YAW_GATE_DEG)) this.yaw = turnTowards(this.yaw, dx, dz);
      return;
    }
    if (!withinYaw(this.yaw, dx, dz, MOVE_YAW_GATE_DEG)) {
      this.yaw = turnTowards(this.yaw, dx, dz);
      this.moving = false;   // classic turns in place
      return;
    }
    this.moving = true;
  }

  /** P17: the P16 fixed-timestep law, foe-side. DFU's EnemyMotor is a
   *  FixedUpdate body - raw render-dt integration is exactly the
   *  phone-framerate failure P16 root-caused for the player (gravity
   *  error and capsule steps scaling with dt). The render loop hands
   *  us frame dt; we accumulate and step the WHOLE body (senses
   *  cadence + physics) at FIXED_DT, with the MAX_FRAME_DT jank
   *  clamp. The classic-update timer drains identically (it only ever
   *  sees 1/60 chunks now - deterministic at every frame rate).
   *  C12: `paralyzed` mirrors DFU's CanAct=false + flyerFalls -
   *  senses keep running, decisions and pursuit stop, grounded foes
   *  and FLYERS fall ("intentional side-effect: paralyzed flying
   *  enemies fall out of the air"), swimmers freeze in place. */
  update(dt, playerFeet, senses = null, paralyzed = false) {
    this._acc = (this._acc ?? 0) + Math.min(dt, MAX_FRAME_DT);
    while (this._acc >= FIXED_DT) {
      this._acc -= FIXED_DT;
      this._step(FIXED_DT, playerFeet, senses, paralyzed);
    }
  }

  _step(dt, playerFeet, senses, paralyzed = false) {
    // CH4 (the senses verify pass): DFU's cadence split, exactly -
    // sight/hearing/detection resolve EVERY FixedUpdate (the fixed
    // step here); the spawn-band recompute and the illusion re-roll
    // gate on ClassicUpdate (_classicSenses per classic tick); only
    // classic TARGET SWITCHING rides the 5-unit system timer
    // (single-target here, so that timer has nothing to switch -
    // constants stay exported for E3 multi-target). Decisions stay
    // on the classic update, reading the freshly resolved senses
    // (DFU's senses-then-motor component order). senses = the P13
    // stealth context (see _senses).
    // C15: knockback is CanAct=false - decisions skip, senses run.
    const knocked = this.knockbackSpeed > 0;
    // AUDIT 26 F010: CanAct, EXPOSED. HandleParalysis and
    // KnockbackMovement clear it (:255, :317) and the attack/cast
    // components' bow-roll and spell branches live behind
    // `if (CanAct) TakeAction` in DFU (:171-172) - the port's
    // components read this instead of re-deriving it, so a foe in
    // hit-stun stops shooting and casting exactly as DFU's does.
    // (The MELEE decision is CanAct-independent in DFU - EnemyAttack
    // .FixedUpdate rolls it regardless - and stays ungated.)
    // MT-iii (AUDIT 39): the hostility term is HandleNoAction's
    // `senses.Target == null` (:359), not a CanAct term of its own -
    // `grep IsHostile EnemyMotor.cs` finds writes at :122/:206 and no
    // read. A pacified foe stops because EnemySenses:321-327 drops the
    // PLAYER as its target; a FOE target survives that drop (this
    // file's own _senses exception), and DFU's motor then pursues and
    // turns towards it. The port ANDed IsHostile in flat, so a
    // pacified foe another enemy was mauling stood rooted.
    // AUDIT 39r (R15): and it is computed BELOW, after the target
    // machine - reading `_armedTargeting`/`target` here read the
    // PREVIOUS step's targeting state, so a pacified foe stayed frozen
    // for the whole step on which it first acquired a foe target (and
    // could never take the exception on its first armed step at all,
    // the constructor seeding both to null/false). This file's own law,
    // eight lines up: decisions read the freshly resolved senses.
    // EnemyMotor.UpdateTimers runs every FixedUpdate, after
    // HandleParalysis and KnockbackMovement have settled CanAct, and
    // BEFORE TakeAction reads avoidObstaclesTimer (:166-172).
    this._clock += dt;
    this._updateDetourTimers(dt, !paralyzed && !knocked);
    // MT-i: the host's targeting context arms the classic target
    // machine - a closure over the pool's shared candidate list
    // (enemyTargets.runTargetMachine; a hook, not an import, so the
    // senses half stays cycle-free). Unarmed = player-only, as ever.
    const targeting = senses?.targeting ?? null;
    this._armedTargeting = !!targeting;
    let classicTicks = 0;
    this._classicTimer += dt;
    while (this._classicTimer >= CLASSIC_UPDATE_INTERVAL) {
      this._classicTimer -= CLASSIC_UPDATE_INTERVAL;
      classicTicks++;
      // DFU's Update order, per classic tick: the spawn-band block
      // (:260-310), then the target machine (:312-405), then the
      // NULL-TARGET RETURN (:410-414) - and only past it the second
      // ClassicUpdate block with the illusion re-roll and the LOS
      // decrement (:443-449). A tick that ends with no target runs
      // NEITHER, which is why they sit together in one method.
      this._classicSenses(playerFeet, senses);
      if (targeting) targeting(this, playerFeet, dt);
      if (!targeting || this.target != null) this._classicPostTarget(senses);
    }
    // EnemySenses.targetPosPredict (:249-257) is its own 0.0625s timer -
    // the classic-update interval, independently phased. The port reads
    // "a classic tick happened this step" as the same thing, and says so.
    this._targetPosPredict = classicTicks > 0;
    // MT-i: the senses aim at the TARGET's live feet - the player's
    // when unarmed or the player is it, the foe candidate's when a
    // GetTargets pass picked one. No target reads BLIND (:410-414):
    // targetInSight false, detectedTarget false, return - the timers
    // and HandleNoAction below still run, exactly as DFU's early
    // return leaves FixedUpdate's remainder to the motor.
    let targetFeet = playerFeet;
    if (targeting) {
      this._targetCandidate = this.target;
      targetFeet = this.target == null ? null
        : (this.target.isPlayer ? playerFeet : this.target.ai.feet);
    } else this._targetCandidate = null;
    // MT-iii's hostility narrowing, now on THIS step's target machine.
    const foeTarget = this._armedTargeting && this.target != null && !this.target.isPlayer;
    this.canAct = !paralyzed && !knocked && (this.isHostile || foeTarget);
    if (targeting && targetFeet == null) {
      this.inSight = false;
      this.detected = false;
    } else {
      this._senses(targetFeet, senses);
    }
    // AUDIT 26 F014 (UpdateTimers, UNCONDITIONAL - EnemyMotor.cs runs
    // it every FixedUpdate at :170, after the CanAct writers and
    // before the CanAct gate): detection refills GiveUpTimer to 200
    // classic ticks (:419-420, every FixedUpdate); while undetected it
    // counts down on the CLASSIC cadence (:423-424) and the foe keeps
    // pursuing - 12.5s of blind chase. The port had both inside the
    // gated decision, so a paralyzed foe froze its window and woke
    // still hunting where DFU's had given up.
    // AUDIT 26 F012 (HandleNoAction, UNCONDITIONAL - :168, ditto):
    // no target (a pacified foe's equivalent - single-target port),
    // the give-up timer spent, or a position never seen, and
    // searchMult resets on EVERY arm (:357-366) - the port reset it
    // on the third alone, so a foe that ramped its search to 10 and
    // gave up resumed a later pursuit aiming 10 units past the
    // last-known position. HandleNoAction runs BEFORE UpdateTimers'
    // refill in DFU's order, and does here too.
    this._handleNoAction(foeTarget);
    if (this.detected) this.giveUpTimer = GIVE_UP_TICKS;
    for (let i = 0; i < classicTicks; i++) {
      if (!this.detected && this.giveUpTimer > 0) this.giveUpTimer--;
      // C-slice: a pacified foe with NO foe target keeps its senses
      // but takes no action - its senses hold no Target, so
      // HandleNoAction drops CanAct. One with a foe target still acts.
      if (this.canAct) this._classicTick(targetFeet ?? playerFeet);   // MT-i: pursuit aims at the TARGET
    }
    if (paralyzed || !(this.isHostile || foeTarget)) this.moving = false;

    // C15 KnockbackMovement, verbatim: runs INSTEAD of pursuit (and
    // regardless of paralysis - DFU calls it before the CanAct
    // gates). Stored speed clamps at 40; the hurt anim rides
    // speed > 5 (the MobileUnit refuses it mid-attack, the DFU
    // state gate); motion caps at 25 along the attack ray; grounded
    // foes take it via SimpleMove (y DROPPED, gravity applies),
    // flyers take the full 3D ray AND fall (flyerFalls), swimmers
    // ride the WaterMove gates; decay is 5 per classic tick.
    this.hurtKnock = false;
    if (knocked) {
      if (this.knockbackSpeed > KB(KNOCKBACK_STORE_CAP)) this.knockbackSpeed = KB(KNOCKBACK_STORE_CAP);
      this.hurtKnock = this.knockbackSpeed > KB(KNOCKBACK_HURT_THRESHOLD);
      const sp = Math.min(this.knockbackSpeed, KB(KNOCKBACK_MOTION_CAP));
      const d = this.knockbackDir ?? [0, 0, 0];
      const mx = d[0] * sp * dt, myRaw = d[1] * sp * dt, mz = d[2] * sp * dt;
      if (this.swims) {
        const waterY = this.waterSurfaceY ? this.waterSurfaceY(this.feet[0], this.feet[2]) : null;
        const center = this.feet[1] + this.height / 2;
        if (waterY !== null && center < waterY) {
          let my = myRaw;
          if (my > 0 && center + WATER_HEAD_MARGIN >= waterY) my = 0;
          this.collider.move(this.feet, mx, my, mz);
        }
      } else if (this.flies || this.levitating) {
        // :293-298 - `else if (flies || IsLevitating) controller.Move(...)`,
        // the full 3D ray. A LEVITATOR takes no gravity with it:
        // KnockbackMovement raises flyerFalls, but ApplyGravity's
        // flyer arm is `flyerFalls && flies && !IsLevitating`
        // (:347) and its walker arm is `!flies && !swims &&
        // !IsLevitating` (:335) - both refuse a levitating foe, so a
        // knocked-back levitator sails and does not drop.
        if (this.flies && !this.levitating) this.velY -= GRAVITY * dt;   // flyerFalls: a hit knocks them out of the air
        else this.velY = 0;   // no gravity arm claims a levitator: the port's accumulator must not carry one either
        const r = this.collider.move(this.feet, mx, myRaw + this.velY * dt, mz);
        if (r.grounded) this.velY = 0;
        this._trackFall(r.grounded);   // CH3: a knocked-down flyer lands hard
      } else {
        this.velY -= GRAVITY * dt;   // SimpleMove: horizontal motion, gravity applies
        const r = this.collider.move(this.feet, mx, this.velY * dt, mz);
        if (r.grounded) this.velY = 0;
        this._trackFall(r.grounded);
      }
      this.knockbackSpeed -= classicTicks * KB(KNOCKBACK_DECAY_PER_CLASSIC);
      if (this.knockbackSpeed < 0) this.knockbackSpeed = 0;
      this._restGrounded = false;
      return;   // CanAct = false: no pursuit this step
    }

    // C12 aquatic (WaterMove verbatim): movement exists ONLY while
    // the controller center is below the block water surface; a
    // beached (or waterless-block) fish is frozen - no gravity, no
    // pursuit. Rising motion caps 2.5 under the surface. Paralyzed
    // swimmers "just freeze in place".
    if (this.swims) {
      if (paralyzed || !this.moving) return;
      const waterY = this.waterSurfaceY ? this.waterSurfaceY(this.feet[0], this.feet[2]) : null;
      const center = this.feet[1] + this.height / 2;
      if (waterY === null || center >= waterY) return;
      const d = this._dir3(this.destination);
      // AttemptMove's probe (wave 34). A swimmer keeps its y in
      // direction2d - only grounded foes flatten it (:978-979).
      this._obstacleCheck(d);
      this._fallCheck(d);
      if (this.fallDetected || this.obstacleDetected) { this._findDetour(d); return; }
      let my = d[1] * this.speed * dt;
      if (my > 0 && center + WATER_HEAD_MARGIN >= waterY) my = 0;
      this.collider.move(this.feet, d[0] * this.speed * dt, my, d[2] * this.speed * dt);
      return;
    }

    // C12 flying (CanFly = Flying|Spectral): 3D pursuit at the face,
    // NO gravity - except flyerFalls (paralysis) which drops them.
    //
    // A5: a LEVITATING foe rides the same branch, and rides it even
    // while paralyzed. DFU's Move (:1006-1009) sends `flies ||
    // IsLevitating || swims` through controller.Move with the y kept
    // in direction2d (:978-979), and NO arm of ApplyGravity will take
    // a levitator: the walker arm excludes IsLevitating (:335), the
    // slow-fall arm excludes it (:328) and the flyerFalls arm excludes
    // it too (:347). So paralysis, which drops a plain flyer out of
    // the air, leaves a levitator hanging - it simply stops acting
    // (moving is already false above), hovers, and re-anchors
    // lastGroundedY per ApplyFallDamage's second arm (:1416, which
    // names IsLevitating in its own right).
    if ((this.flies && !paralyzed) || this.levitating) {
      this.velY = 0;
      // CH3 (AUDIT 24 characters-1): ApplyFallDamage's SECOND arm -
      // `else if ((flies && !flyerFalls) || IsLevitating ||
      // IsSlowFalling) LastGroundedY = transform.position.y`
      // (EnemyMotor.cs:1414-1417), with the source's own note "for
      // flying enemies, lastGroundedY is really lastAltitudeControlY".
      // A HOVERING flyer re-anchors to its current altitude every
      // FixedUpdate, so the drop a knocked or paralyzed flyer is
      // billed for measures from the altitude at the instant flight
      // stopped - never from the last floor it happened to stand on.
      // The arm runs after TakeAction, so the anchor is the POST-move
      // altitude; `flies && !flyerFalls` is exactly this branch,
      // knockback and paralysis both having returned above.
      if (!this.moving) { this.lastGroundedY = this.feet[1]; return; }   // hover in place (turning included)
      const d = this._dir3(this.destination);
      // "Stop fliers from moving too near the floor during combat":
      // descending with ground inside (height/2 + 1) below the center
      // forces direction.y up to 0.1 (not renormalized, as DFU). Wave
      // 34: the clause is gated on `avoidObstaclesTimer <= 0` (:925) -
      // a flyer working its way round an obstacle is allowed to dive.
      // A5: `flies` ALONE opens it (:925) - a levitator gets no floor
      // lift, which is why the arm is spelled out rather than folded
      // into the branch condition above.
      if (this.flies && this.avoidObstaclesTimer <= 0 && d[1] < 0) {
        const hit = this.collider.raycast(
          [this.feet[0], this.feet[1] + this.height / 2, this.feet[2]], [0, -1, 0],
          this.height / 2 + FLYER_FLOOR_CLEARANCE);
        if (Number.isFinite(hit)) d[1] = FLYER_FLOOR_LIFT;
      }
      // AttemptMove's probe (wave 34): a flyer keeps its y here too.
      this._obstacleCheck(d);
      this._fallCheck(d);
      if (this.fallDetected || this.obstacleDetected) { this._findDetour(d); this.lastGroundedY = this.feet[1]; return; }
      this.collider.move(this.feet, d[0] * this.speed * dt, d[1] * this.speed * dt, d[2] * this.speed * dt);
      this.lastGroundedY = this.feet[1];   // the altitude-control anchor, post-move
      return;
    }

    // Grounded (and falling paralyzed flyers): movement at the
    // decided state via the SAME capsule contract the player walks on.
    // REST FAST PATH (the C11 lag fix): an idle foe standing on
    // solid ground has nothing to integrate - gravity would resolve
    // to the same spot - so the capsule query is skipped entirely
    // until it moves again (29 idle foes x 60Hz x a capsule move was
    // the other half of the live lag). A mover sliding out from
    // under a parked foe leaves it frozen mid-air until it next
    // pursues - accepted: foes never ride movers (pre-C11 statics
    // did not either).
    if (!this.moving && this._restGrounded) return;
    this.velY -= GRAVITY * dt;
    const dy = this.velY * dt;
    let dxm = 0;
    let dzm = 0;
    let blocked = false;
    if (this.moving) {
      // AttemptMove's probe (wave 34). direction2d is the horizontal
      // heading the foe is about to walk (:977-979 flattens y for a
      // grounded foe); the port steers by yaw, which the 5.625 gate in
      // _classicTick has already brought within 5.625 degrees of the
      // direction to the destination.
      const dir2d = [Math.sin(this.yaw), 0, Math.cos(this.yaw)];
      this._obstacleCheck(dir2d);
      this._fallCheck(dir2d);
      if (this.fallDetected || this.obstacleDetected) {
        // The translation is the ELSE arm (:989-996) - a blocked foe
        // does not move this step at all, it picks a way round. Gravity
        // is separate (ApplyGravity, :167) and still applies.
        this._findDetour(dir2d);
        blocked = true;
      } else {
        dxm = dir2d[0] * this.speed * dt;
        dzm = dir2d[2] * this.speed * dt;
      }
    }
    const r = this.collider.move(this.feet, dxm, dy, dzm);
    if (r.grounded) this.velY = 0;
    this._trackFall(r.grounded);   // CH3 (characters-8): walkers and falling paralyzed flyers
    this._restGrounded = !this.moving && r.grounded;
    void blocked;   // the probe's outcome is the detour state; the rest path keys on `moving`
  }

  /** ApplyFallDamage's tracking (EnemyMotor.cs:1383-1414): grounded
   *  refreshes LastGroundedY; the grounded EDGE after airborne
   *  measures the drop and reports a past-threshold landing through
   *  landedFall (the host bills the damage + the clip). A flyer's
   *  hover does not come through here - the hover branch re-anchors
   *  lastGroundedY itself, per ApplyFallDamage's second arm, so a
   *  knocked-down flyer measures from the altitude it was FLYING at,
   *  not from the last floor it stood on. */
  _trackFall(grounded) {
    if (grounded) {
      if (this._airborne) {
        const drop = this.lastGroundedY - this.feet[1];
        if (drop > FALL_DAMAGE_THRESHOLD) this.landedFall = drop;
        this._airborne = false;
      }
      this.lastGroundedY = this.feet[1];
    } else {
      this._airborne = true;
    }
  }

  /** The 3D pursuit direction to the aim point (face for flyers +
   *  the slaughterfish, center for other swimmers), normalized. */
  /** The unit direction to a point, as DFU's
   *  `(destination - transform.position).normalized`.
   *
   *  AUDIT 24 (wave 35): the aim bump used to live HERE, added to
   *  whatever it was handed. GetDestination is where DFU puts it
   *  (:542-545), and once that was ported the flyer got it twice - it
   *  aimed 1.8 above the target's head and stopped 3.6 short instead of
   *  at melee range. One home: _getDestination applies _aimY, this
   *  returns the direction to the point it is given. */
  _dir3(point) {
    const dx = point[0] - this.feet[0];
    const dy = point[1] - this.feet[1];
    const dz = point[2] - this.feet[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    return [dx / l, dy / l, dz / l];
  }
}
