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
import { CLASSIC_UPDATE_INTERVAL } from './weaponStates.js';   // single source (GameManager.cs:42)
import { CAPSULE_HEIGHT } from '../player/motor.js';           // single source
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
export const CLASSIC_TURN_DEG = 20;                  // per classic update (TurnToTarget's turnSpeed)
export const SYSTEM_TIMER_UPDATES_DIVISOR = 0.0549254;
export const SENSES_INTERVAL_UNITS = 5;              // classicTargetUpdateTimer > 5
export const MOVE_YAW_GATE_DEG = 5.625;
export const DF_WALK_BASE = 150;
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
 *  target always blocks (the Invisibility effect pends - inert);
 *  blending (chameleon) tries an 8% see-through, a shade 4% (the
 *  Shade effect pends); FailedRoll keeps the block. */
export function blockedByIllusionEffect(seesThrough, { invisible = false, blending = false, shade = false } = {}, rolls = Math.random) {
  if (seesThrough) return false;
  if (invisible) return true;
  if (!blending && !shade) return false;
  // The roll happens ONLY in this branch (DFU rolls no dice for an
  // unconcealed target - sequences must match).
  const chance = blending ? 8 : 4;
  return Math.floor(rolls() * 100) >= chance;   // Dice100.FailedRoll
}

/** EnemySenses.CanHearTarget: inside the 25 radius (+HearingModifier
 *  0 for every current entry), blocked when STATIC geometry sits
 *  between. Departure (documented): our collider's ray includes
 *  closed action doors (they are collider buckets), which DFU's
 *  static-only mask lets sound pass - a closed door muffles here. */
export function canHearTarget(collider, feet, height, targetFeet, dist) {
  if (dist >= HEARING_RADIUS) return false;
  const eye = [feet[0], feet[1] + height * EYE_FRAC, feet[2]];
  const ex = targetFeet[0] - eye[0], ey = targetFeet[1] + 0.9 - eye[1], ez = targetFeet[2] - eye[2];
  const el = Math.hypot(ex, ey, ez) || 1;
  const hit = collider.raycast(eye, [ex / el, ey / el, ez / el], el);
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

/**
 * Per-foe classic AI: senses on the system timer, decisions on the
 * classic update, movement applied continuously at the decided state.
 * C12: behaviour 'Flying'/'Spectral' = CanFly (3D pursuit at the
 * target's face, no gravity, the floor-skim guard); 'Aquatic' =
 * WaterMove (3D pursuit gated to below the block water surface via
 * waterSurfaceY(x, z), the 2.5 head margin, beached = frozen).
 */
export class EnemyAI {
  constructor(collider, feet, yawRad, { liveSpeed = 50, height = CAPSULE_HEIGHT, seesThroughInvisibility = false, behaviour = 'General', mobileId = -1, waterSurfaceY = null, spawnDistanceType = 0, playerInside = true } = {}) {
    this.collider = collider;
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
    this.speed = enemyMoveSpeed(liveSpeed);
    this.seesThroughInvisibility = seesThroughInvisibility;
    // MobileUnit.ClassicSpawnDistanceType (the marker's SoundIndex) and
    // PlayerEnterExit.IsPlayerInside - both feed the spawn-band recompute.
    this.spawnDistanceType = spawnDistanceType;
    this.playerInside = playerInside;
    this.giveUpTimer = 0;   // G1: blind-pursuit ticks (EnemyMotor.GiveUpTimer)
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
    this.isHostile = true;        // EnemyMotor.IsHostile - pacification (C-slice) clears it; damage restores it
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

  /** EnemySenses' classic detection flow, per classic update. senses
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
    this.inSight = canSeeTarget(this.collider, this.feet, this.yaw, this.height, playerFeet, undefined, _blocker);
    this.doorKey = _blocker.key;
    if (!senses) {
      this.detected = this.inSight || this._dist < HEARING_RADIUS;
      if (this.detected && !this.hasEncounteredPlayer) { this.hasEncounteredPlayer = true; this.justEncountered = true; }
      return;
    }
    const rolls = senses.rolls ?? Math.random;
    // per classic update: the spawn-band recompute + the illusion roll
    this.wouldBeSpawned = wouldBeSpawnedInClassic(
      this._dist, this.feet[1] - playerFeet[1], this.wouldBeSpawned, this.spawnDistanceType, this.playerInside);
    this._blocked = blockedByIllusionEffect(this.seesThroughInvisibility, {
      invisible: senses.playerInvisible ?? false,
      blending: senses.playerBlending ?? false,
      shade: senses.playerShade ?? false,
    }, rolls);
    // hearing only once the target is already detected and unseen -
    // "classic stealth mechanics would be interfered with by hearing"
    const inEarshot = (this.detected && !this.inSight)
      ? canHearTarget(this.collider, this.feet, this.height, playerFeet, this._dist)
      : false;
    if (!this._blocked && (this.inSight || inEarshot)) this.detected = true;
    else if (!this._blocked && this._stealthCheck(senses)) this.detected = true;
    else this.detected = false;
    if (this.detected && !this.hasEncounteredPlayer) { this.hasEncounteredPlayer = true; this.justEncountered = true; }
  }

  /** EnemyMotor.MakeEnemyHostileToAttacker (G1): pre-load the give-up
   *  timer so a crime-responding guard pursues without having seen the
   *  player yet (guards get 200 * 3 classic ticks, verbatim). */
  makeHostileToPlayer(ticks = GIVE_UP_TICKS) { this.giveUpTimer = ticks; }

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
    if (senses.movingLessThanHalfSpeed) {
      if ((gameMinutes & 1) === 1) return this.detected;
    } else if (this.hasEncounteredPlayer) {
      return true;
    }
    if (senses.sharedStealth && senses.sharedStealth.minute !== gameMinutes) {
      senses.tallyStealth?.();
      senses.sharedStealth.minute = gameMinutes;
    }
    this._lastStealthMinute = gameMinutes;
    const chance = stealthChance(this._dist, senses.playerStealth ?? 0);
    const rolls = senses.rolls ?? Math.random;
    return Math.floor(rolls() * 100) >= chance;   // Dice100.FailedRoll(stealthChance) -> detected on a FAILED stealth roll
  }

  _classicTick(playerFeet) {
    // G1 (EnemyMotor verbatim): detection refills GiveUpTimer to 200
    // classic ticks; while undetected it counts down and the foe KEEPS
    // pursuing (12.5s of blind chase toward the target - DFU pursues
    // the predicted last-known position; the live position stands in,
    // FLAGGED, until target prediction ships). At zero the foe stops.
    if (this.detected) this.giveUpTimer = GIVE_UP_TICKS;
    else if (this.giveUpTimer > 0) this.giveUpTimer--;
    if (!this.detected && this.giveUpTimer <= 0) { this.moving = false; return; }
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
    // DFU recomputes distance/sight every Update; only classic TARGET
    // SWITCHING rides the 5-unit system timer (single-target here, so
    // that timer has nothing to switch - constants stay exported for
    // E3 multi-target). Senses + decisions both run at the classic
    // update rate. senses = the P13 stealth context (see _senses).
    // C15: knockback is CanAct=false - decisions skip, senses run.
    const knocked = this.knockbackSpeed > 0;
    let classicTicks = 0;
    this._classicTimer += dt;
    while (this._classicTimer >= CLASSIC_UPDATE_INTERVAL) {
      this._classicTimer -= CLASSIC_UPDATE_INTERVAL;
      classicTicks++;
      this._senses(playerFeet, senses);
      // C-slice: a pacified foe (IsHostile false) keeps its senses
      // but takes no action - DFU's motor only pursues hostiles.
      if (!paralyzed && !knocked && this.isHostile) this._classicTick(playerFeet);
    }
    if (paralyzed || !this.isHostile) this.moving = false;

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
      } else if (this.flies) {
        this.velY -= GRAVITY * dt;   // flyerFalls: a hit knocks them out of the air
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
      const d = this._dir3(playerFeet);
      let my = d[1] * this.speed * dt;
      if (my > 0 && center + WATER_HEAD_MARGIN >= waterY) my = 0;
      this.collider.move(this.feet, d[0] * this.speed * dt, my, d[2] * this.speed * dt);
      return;
    }

    // C12 flying (CanFly = Flying|Spectral): 3D pursuit at the face,
    // NO gravity - except flyerFalls (paralysis) which drops them.
    if (this.flies && !paralyzed) {
      this.velY = 0;
      if (!this.moving) return;   // hover in place (turning included)
      const d = this._dir3(playerFeet);
      // "Stop fliers from moving too near the floor during combat":
      // descending with ground inside (height/2 + 1) below the center
      // forces direction.y up to 0.1 (not renormalized, as DFU).
      if (d[1] < 0) {
        const hit = this.collider.raycast(
          [this.feet[0], this.feet[1] + this.height / 2, this.feet[2]], [0, -1, 0],
          this.height / 2 + FLYER_FLOOR_CLEARANCE);
        if (Number.isFinite(hit)) d[1] = FLYER_FLOOR_LIFT;
      }
      this.collider.move(this.feet, d[0] * this.speed * dt, d[1] * this.speed * dt, d[2] * this.speed * dt);
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
    const dxm = this.moving ? Math.sin(this.yaw) * this.speed * dt : 0;
    const dzm = this.moving ? Math.cos(this.yaw) * this.speed * dt : 0;
    const r = this.collider.move(this.feet, dxm, dy, dzm);
    if (r.grounded) this.velY = 0;
    this._trackFall(r.grounded);   // CH3 (characters-8): walkers and falling paralyzed flyers
    this._restGrounded = !this.moving && r.grounded;
  }

  /** ApplyFallDamage's tracking (EnemyMotor.cs:1383-1414): grounded
   *  refreshes LastGroundedY; the grounded EDGE after airborne
   *  measures the drop and reports a past-threshold landing through
   *  landedFall (the host bills the damage + the clip). A flyer's
   *  hover never touches this - only ground contacts do, so a
   *  knocked-down flyer measures from its LAST ground height,
   *  verbatim. */
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
  _dir3(playerFeet) {
    const dx = playerFeet[0] - this.feet[0];
    const dy = (playerFeet[1] + this._aimY) - this.feet[1];
    const dz = playerFeet[2] - this.feet[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    return [dx / l, dy / l, dz / l];
  }
}
