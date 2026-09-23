// @ts-check
// HORSE CART AND CARGO - THE RUNTIME (HCC, 2026-09-23, Mac: "Next mod I want to implement 1 to 1 and also enhance
// its online integration functionality"). `TrailingWagonRuntime`, `DeployedWagonVisual` and `StationaryHorseVisual`
// of demifiend000's Horse Cart and Cargo 1.0.0-rc12, read off the shipped assembly's IL
// (vendor/horse-cart-and-cargo/il/TrailingWagon.il.txt); every function names the method it restates and the IL
// offset it was read at. The mod is a MonoBehaviour over Unity's scene; this is the same machine over the port's
// hosts, which hand it their seams (`deps`, below) and a presentation (scenes/horseCartPool.js) that draws what
// the machine says and answers its physics. The pure arithmetic is systems/horseCartLaw.js and
// systems/horseFollow.js; this file is the STATE - the save record and the hundred-odd transient fields - and the
// mod's ORDER of operations, frame by frame.
//
// The five modes of the wagon and the five of the horse (horseCartLaw WAGON_MODE / HORSE_MODE) are the whole
// story: with the player (the classic game), deployed (parked where it was left, a physical thing in the world),
// following the player (the horse on its own, or the hitched team), loose (the horse standing where it was told
// to wait), none (not owned). Every command below moves the pair between them and the presentation follows.
//
//   deps = {
//     ready() -> bool                    TryGetGameManager: a game in progress, the player standing, the world up
//     transport: { get(), set(mode), hasCart(), hasHorse(), isOnShip() }      TransportManager
//     player: { position() -> [x,y,z] (the capsule's centre), forward(), movement() -> { position, forward } }
//     gps: { worldX(), worldZ(), scenePosition(), currentMapPixel() -> {x,y} }   PlayerGPS
//     streaming: { isReady(), isInit(), mapPixelX(), mapPixelY(), ratio() }      StreamingWorld
//     enterExit: { isPlayerInside(), isPlayerInsideDungeon(), isPlayerInsideBuilding(), buildingKey(), dungeonId() }
//     entity: { wagonWeight(), wagonKgLimit() }
//     activateMode() -> 'steal'|'grab'|'info'|'dialogue'          PlayerActivate.CurrentMode
//     fadeInProgress() -> bool                                     DaggerfallUI.FadeBehaviour.FadeInProgress
//     say(line), setMidScreenText(text, seconds), tooFarText()    AddHUDText / SetMidScreenText / youAreTooFarAway
//     settings() -> the eight keys (systems/modSettings.js horse-cart-and-cargo)
//     keyDown(keyCodeName) -> bool                                 InputManager.GetKeyDown, this frame
//     now() -> unscaled seconds
//     travelOptionsActive() -> bool | null                         the isTravelActive mod message (null: no mod)
//     worldCoordToMapPixel(wx, wz) -> {x, y}                       MapsFile.WorldCoordToMapPixel
//     openInventoryWithWagon()                                     dfuiOpenInventoryWindow after the selection request
//     openNamePrompt({ label, value, maxCharacters, onSubmit }) -> { isOpen() }   DaggerfallInputMessageBox
//     phys: { raycastAll(origin, dir, max), sphereCastClear(origin, r, dir, d), threats() }   systems/horseFollow.js's seam
//     presentation: scenes/horseCartPool.js - { wagonParts() -> { wheelLeftPivot, wheelRightPivot, wheelRadius, bounds } | null,
//                     horseArt: { ensureStationary() -> bool, ensureWalk() -> void, hasWalk() -> bool },
//                     cameraPosition() -> [x,y,z], onChanged() }
//     log: { warn, error, info }
//   }

import {
  WAGON_MODE, HORSE_MODE, INTERIOR_ACCESS, LAST_MOUNT, STORAGE_CONTEXT, HORSE_ACTIVATION, TRANSPORT, ACTIVATE_MODE, MATHF_EPSILON,
  V_FORWARD, V_ZERO, vadd, vsub, vscale, vsqr, vnorm, vdot, vlerp, horizontalForward, horizontalRight, horizontalDistance, isWithinHorizontalDistance,
  sceneToWorld, worldToScene, applyLocalOffsetToWorld, newSaveData, copySaveData, normalizeSaveData, normalizeHorseName, resolveHorseNameInput,
  reconcileHorseNameOwnership, resolvePersistenceDisabledState, resolvePersistenceEnabledState, isWagonInventoryAccessible, isDungeonExitWagonAccessAllowed,
  interiorAccessRequiresMapPixelMatch, isUsableDungeonEntranceDoorPosition, isHitchedTeamFollowing, isAutonomousHorseFollowing, isDirectHitchedTeamMount,
  isPhysicalTeamWithinMountDistances, isPhysicalTransportStateValid, canRefreshDirectCartTransport, resolveQuickMountMode, resolveHorseActivation,
  isHorseCommandMode, isHorseNamingMode, resolveInteriorEntryMode, isCartInteriorDeployment, shouldDeployIndependentHorseForInterior,
  horseTravelsWithFastTravel, resolveFastTravelDepartureModes, shouldReconcileAfterTravelOptions, clampHorseFollowDistance, clampInteriorWagonAccessDistance,
  isWithinInteriorEntranceDistance, formatHorseSubject, formatHorseAndWagonSubject, horseTargetLabel, HCC_TEXT, pickGround, angleBetween,
  WAGON_FOLLOW_DISTANCE, HORSE_NAME_MAX, DEPLOYED_SPAWN_RETRY_SECONDS, DIRECT_CART_AUDIO_REFRESH_DELAY, HORSE_MENU_MOUNT_DISTANCE, HORSE_WAGON_HITCH_DISTANCE,
  FOLLOWING_TEAM_EMERGENCY_SEPARATION, WAGON_INVENTORY_DISTANCE, DEFAULT_HORSE_FOLLOW_DISTANCE, DEFAULT_INTERIOR_ACCESS_DISTANCE, HORSE_DISMOUNT_REAR_OFFSET,
  HITCHED_HORSE_LOCAL_X, HITCHED_HORSE_LOCAL_Z, ACTIVATION_REACH, WAGON_SAVE_VERSION, TOO_FAR_SECONDS, STATIONARY_PROBE_HEIGHT, STATIONARY_PROBE_DISTANCE,
  GROUND_RETRY_SECONDS, POSE_POSITION_TOLERANCE_SQ, POSE_ANGLE_TOLERANCE_DEG, signedLongitudinalTravel, wheelRotationDegrees, wrapWheelAngle, cargoTier,
  stepHorseWalk, freshHorseWalk, hccActionRows,   // ACT-MENU: the plaque's rows over my three activators
} from './horseCartLaw.js';
import { HorseFollowPath, HorseFollowController, WagonTrail, groundedPoseStep, tryFindGround } from './horseFollow.js';
import { quatLookRotation, quatForward, quatFromBasis, quatRotate, UNITY_QUAT_IDENTITY } from '../world/quat.js';
import { isBindableKeyCode, KEYCODE_NONE } from './keyCodes.js';

export const DEFAULT_QUICK_MOUNT_KEY = 'K', DEFAULT_SUMMON_KEY = 'G';
/** The port ships F7/F10 (HCC-KEYS, modSettings.js); the mod's own fallbacks are what an unparseable entry falls to. */

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const projectOnPlane = (v, n) => vsub(v, vscale(n, vdot(v, n)));
const normalizeHorizontalHeading = (v) => { const p = [v[0], 0, v[2]]; return vsqr(p) <= MATHF_EPSILON ? [...V_FORWARD] : vnorm(p); };

// ─── DeployedWagonVisual [spec-visuals §2], as pure state over the pool's parts and the physics ───────────────

export class DeployedWagonVisual {
  /** Initialize [IL_0828]: the parts must have arrived (the pool's mesh), else the mod's own error. */
  constructor(parts, position, forward, weight, limit, phys, now) {
    if (!parts) throw new Error('DFU returned no object for vanilla wagon model 41214');
    this.parts = parts; this.phys = phys;
    this.position = [...position]; this.rotation = quatLookRotation(normalizeHorizontalHeading(forward));
    this.grounded = false; this.nextGroundRetryTime = 0; this.groundingFailureLogged = false;
    this.cargoTier = cargoTier(weight, limit);
    this.alive = true;
    this.tryApplyGrounding(position, forward, now);
  }
  get isAlive() { return this.alive; }
  get isGrounded() { return this.grounded; }
  /** TryGetGroundedPose [IL_0598]. */
  tryGetGroundedPose() {
    if (!this.alive || !this.grounded) return null;
    return { position: [...this.position], forward: normalizeHorizontalHeading(quatForward(this.rotation)) };
  }
  /** Tick [IL_06ad]: the cargo, and the grounding retried every second until it lands. */
  tick(position, forward, weight, limit, now) {
    this.cargoTier = cargoTier(weight, limit);
    if (this.grounded) return;
    if (now < this.nextGroundRetryTime) return;
    if (this.tryApplyGrounding(position, forward, now)) this.groundingFailureLogged = false;
  }
  worldPivot(local) { return vadd(this.position, quatRotate(this.rotation, local)); }
  /** TryProbeExternalGround [IL_0c14]: from 1000 up, 3000 down, every surface but our own (the pool's raycastAll
   *  never carries the wagon), the one nearest the origin's height. */
  probeExternalGround(origin) {
    const hits = this.phys.raycastAll(vadd(origin, [0, STATIONARY_PROBE_HEIGHT, 0]), [0, -1, 0], STATIONARY_PROBE_DISTANCE);
    return pickGround(hits, origin[1]);
  }
  /** TryApplyGrounding [IL_0a1c]: both wheels on ground - the two-wheel solve; one - the height alone; none - retry in a second. */
  tryApplyGrounding(position, forward, now) {
    if (!this.alive || !this.parts) return false;
    this.grounded = false;
    this.position = [...position]; this.rotation = quatLookRotation(normalizeHorizontalHeading(forward));   // SetProvisionalPose
    const leftHit = this.probeExternalGround(this.worldPivot(this.parts.wheelLeftPivot));
    const rightHit = this.probeExternalGround(this.worldPivot(this.parts.wheelRightPivot));
    let solved = false;
    if (leftHit && rightHit) {
      const wheelMidLocal = vscale(vadd(this.parts.wheelLeftPivot, this.parts.wheelRightPivot), 0.5);
      const s = solveTwoWheelPose(leftHit.point, rightHit.point, normalizeHorizontalHeading(forward), wheelMidLocal, this.parts.wheelRadius);
      if (s) { this.position = s.position; this.rotation = s.rotation; solved = true; }
    } else if (leftHit || rightHit) {
      const pivot = leftHit ? this.parts.wheelLeftPivot : this.parts.wheelRightPivot;
      const hit = leftHit ?? rightHit;
      const pivotY = this.worldPivot(pivot)[1];
      this.position = [this.position[0], this.position[1] + (hit.point[1] + this.parts.wheelRadius) - pivotY, this.position[2]];
      solved = true;
    }
    if (!solved) {
      this.nextGroundRetryTime = now + GROUND_RETRY_SECONDS;
      if (!this.groundingFailureLogged) { this.groundingFailureLogged = true; this.phys.log?.warn?.('[TrailingWagon] deployed wagon grounding found no valid external surface; presentation will retry.'); }
      return false;
    }
    this.grounded = true; this.nextGroundRetryTime = 0;
    return true;
  }
  /** ReleaseOwnedResources [IL_0730]. */
  release() { this.alive = false; this.grounded = false; }
  /** The floating origin moved the scene (Unity's FloatingOrigin moves the root; the port's hosts shift by hand). */
  offset(d) { this.position = vadd(this.position, d); }
}

/** TrySolveTwoWheelPose [IL_0d08]: the axle through the two contacts, the forward laid on its plane, the up their
 *  cross (refused when it leans down), the rotation from that basis, the position placing the wheel midpoint a
 *  radius above the contacts' midpoint. */
export function solveTwoWheelPose(leftContact, rightContact, heading, wheelMidLocal, wheelRadius) {
  if (wheelRadius <= MATHF_EPSILON) return null;
  let axle = vsub(rightContact, leftContact);
  if (vsqr(axle) <= MATHF_EPSILON) return null;
  axle = vnorm(axle);
  let fwd = projectOnPlane(heading, axle);
  if (vsqr(fwd) <= MATHF_EPSILON) return null;
  fwd = vnorm(fwd);
  let up = cross(fwd, axle);
  if (vsqr(up) <= MATHF_EPSILON) return null;
  up = vnorm(up);
  if (vdot(up, [0, 1, 0]) <= 0) return null;
  fwd = vnorm(cross(axle, up));
  const rotation = quatFromBasis(axle, up, fwd);
  const axleCenter = vscale(vadd(vadd(leftContact, vscale(up, wheelRadius)), vadd(rightContact, vscale(up, wheelRadius))), 0.5);
  const position = vsub(axleCenter, quatRotate(rotation, wheelMidLocal));
  return { position, rotation };
}

// ─── StationaryHorseVisual [spec-visuals §3] + StationaryHorseBillboard's clock, as pure state ──────────────────

export class StationaryHorseVisual {
  /** Initialize [IL_400c]: the stationary art must be there (the pool's `horseArt.ensureStationary()`). */
  constructor(hasArt, position, forward, wagonOwner, phys, now) {
    if (!hasArt) throw new Error('horse source textures were unavailable');
    this.phys = phys;
    this.wagonOwner = wagonOwner ?? null;
    this.position = [...position]; this.forward = normalizeHorizontalHeading(forward);
    this.requestedPosition = [...position]; this.requestedForward = [...this.forward]; this.hasRequestedPose = true;
    this.grounded = false; this.nextGroundRetryTime = 0; this.groundingFailureLogged = false;
    this.active = false; this.alive = true;
    this.motionSpeed = 0;
    this.walk = freshHorseWalk();
    this.tryApplyGrounding(now);
  }
  get isAlive() { return this.alive; }
  /** IsInteractive [IL_3be8]: alive, grounded and shown. */
  get isInteractive() { return this.alive && this.grounded && this.active; }
  tryGetGroundedPose() { return this.isInteractive ? { position: [...this.position], forward: normalizeHorizontalHeading(this.forward) } : null; }
  /** Tick [IL_3cdc]: standing still; a new requested pose (moved a centimetre, turned a tenth of a degree, or the
   *  wagon it stands by changed) re-grounds. */
  tick(position, forward, wagonOwner, now) {
    if (!this.alive) return;
    this.motionSpeed = 0;
    const f = normalizeHorizontalHeading(forward);
    const ownerChanged = this.wagonOwner !== (wagonOwner ?? null);
    this.wagonOwner = wagonOwner ?? null;
    let needsPose = !this.hasRequestedPose || ownerChanged;
    if (!needsPose) {
      const dx = position[0] - this.requestedPosition[0], dz = position[2] - this.requestedPosition[2];
      if (dx * dx + dz * dz > POSE_POSITION_TOLERANCE_SQ) needsPose = true;
      else if (angleBetween(f, this.requestedForward) > POSE_ANGLE_TOLERANCE_DEG) needsPose = true;
    }
    if (needsPose) { this.requestedPosition = [...position]; this.requestedForward = f; this.hasRequestedPose = true; this.grounded = false; this.nextGroundRetryTime = 0; }
    if (this.grounded) return;
    if (now < this.nextGroundRetryTime) return;
    if (this.tryApplyGrounding(now)) this.groundingFailureLogged = false;
  }
  /** ApplyFollowingPose [IL_3e90]: the follow controller's grounded pose, shown at once, with the speed for the walk. */
  applyFollowingPose(position, forward, horizontalSpeed) {
    if (!this.alive) return;
    this.wagonOwner = null;
    this.requestedPosition = [...position]; this.requestedForward = normalizeHorizontalHeading(forward); this.hasRequestedPose = true;
    this.grounded = true; this.nextGroundRetryTime = 0;
    this.position = [...position]; this.forward = [...this.requestedForward];
    this.active = true;
    this.motionSpeed = Math.max(0, horizontalSpeed);
  }
  /** TryApplyGrounding [IL_424c]: from 1000 up, 3000 down at the requested spot, the surface nearest its height. */
  tryApplyGrounding(now) {
    if (!this.alive || !this.hasRequestedPose) return false;
    this.grounded = false; this.active = false;
    this.position = [...this.requestedPosition]; this.forward = [...this.requestedForward];
    const hits = this.phys.raycastAll(vadd(this.requestedPosition, [0, STATIONARY_PROBE_HEIGHT, 0]), [0, -1, 0], STATIONARY_PROBE_DISTANCE);
    const best = pickGround(hits, this.requestedPosition[1]);
    if (!best) {
      this.nextGroundRetryTime = now + GROUND_RETRY_SECONDS;
      if (!this.groundingFailureLogged) { this.groundingFailureLogged = true; this.phys.log?.warn?.('[TrailingWagon] stationary horse grounding found no valid external surface; presentation will retry.'); }
      return false;
    }
    this.position = [this.requestedPosition[0], best.point[1], this.requestedPosition[2]];
    this.grounded = true; this.nextGroundRetryTime = 0; this.active = true;
    return true;
  }
  /** StationaryHorseBillboard.LateUpdate's clock [IL_36fc]: the walk frames by the motion speed. */
  stepWalk(dt, hasWalkFrames) { this.walk = stepHorseWalk(this.walk, this.motionSpeed, dt, hasWalkFrames); }
  release() { this.alive = false; this.active = false; this.grounded = false; }
  /** The floating origin moved the scene: the shown pose and the requested one move together, so no re-grounding is asked. */
  offset(d) { this.position = vadd(this.position, d); this.requestedPosition = vadd(this.requestedPosition, d); }
}

// ─── TrailingWagonRuntime ──────────────────────────────────────────────────────────────────────────────────────

export function createHorseCartRuntime(deps) {
  const log = deps.log ?? console;
  const phys = { ...deps.phys, log };
  const now = () => deps.now();

  // .ctor [IL_aa68] - every field the assembly seeds, and the rest at their defaults
  let wagonState = newSaveData();
  const trail = new WagonTrail();
  const hitchedWagonPath = new HorseFollowPath();
  const horseFollower = new HorseFollowController();
  let movingWorldHeading = [...V_FORWARD], pendingInteriorHeading = [...V_FORWARD], pendingInteriorHorseHeading = [...V_FORWARD];
  let pendingInteriorEntranceDistance = Infinity;
  let physicalPersistenceEnabled = true, showTrailingWagon = true, horseFollowDistance = DEFAULT_HORSE_FOLLOW_DISTANCE, avoidCombat = true;
  let interiorWagonAccessDistance = DEFAULT_INTERIOR_ACCESS_DISTANCE, followingTransportFastTravels = true;
  let quickMountHotkey = DEFAULT_QUICK_MOUNT_KEY, summonTransportHotkey = DEFAULT_SUMMON_KEY;
  let settingsInitialized = false, pendingPersistenceSettingTransition = false, pendingPersistenceNormalization = false;
  // the moving (trailing / following) wagon's presentation
  let wagonVisual = null;   // { pose, wheel, cargoTier, interaction } - the port's stand-in for the Unity object
  let hasLastValidGroundState = false;
  let movingWorldX = 0, movingWorldZ = 0, hasMovingWorldPose = false;
  let hitchedWagonPathInitialized = false, followingWagonFailureLogged = false, nextFollowingWagonSpawnRetryTime = 0, horseRecoveredThisFrame = false;
  let spawnFailureLogged = false, cargoFailureLogged = false;
  // the parked wagon and the standing horse
  let deployedVisual = null, stationaryHorseVisual = null;
  let nextDeployedSpawnRetryTime = 0, deployedSpawnFailureLogged = false, nextHorseSpawnRetryTime = 0, horseSpawnFailureLogged = false;
  let horseTextureLoadAttempted = false, horseTextureFailureLogged = false, horseWalkTextureLoadAttempted = false, horseWalkTextureFailureLogged = false;
  // the interior transition
  let pendingInteriorWorldX = 0, pendingInteriorWorldZ = 0, pendingInteriorHorseWorldX = 0, pendingInteriorHorseWorldZ = 0;
  let pendingInteriorTransportMode = TRANSPORT.Foot, hasPendingInteriorDeployment = false, hasPendingInteriorHorseDeployment = false, pendingInteriorEntranceEligible = false;
  // the transport mode
  let previousTransportMode = TRANSPORT.Foot, lastValidNonCartTransportMode = TRANSPORT.Foot, hasObservedTransportMode = false;
  let pendingTransportModeRefresh = TRANSPORT.Foot, pendingTransportModeRefreshTime = 0, hasPendingTransportModeRefresh = false;
  // following, fast travel, Travel Options
  let followingTransitionSuspended = false, fastTravelFollowingSuspended = false, pendingFastTravelHorseRelocation = false;
  let travelOptionsWasActive = false, travelOptionsQueryFailed = false;
  let selectWagonOnNextInventoryOpen = false;
  let horseNameInputBox = null;
  let lastDt = 0;

  const tm = () => deps.transport;
  const pee = () => deps.enterExit;
  const gps = () => deps.gps;
  const ratio = () => deps.streaming.ratio();
  const say = (s) => deps.say?.(s);
  const tooFar = () => deps.setMidScreenText?.(deps.tooFarText?.() ?? 'You are too far away...', TOO_FAR_SECONDS);
  const ready = () => !!deps.ready?.();
  const playerPosition = () => deps.player.position();
  const movement = () => deps.player.movement?.() ?? { position: deps.player.position(), forward: deps.player.forward() };
  const toWorld = (scenePos) => sceneToWorld(scenePos, gps().scenePosition(), gps().worldX(), gps().worldZ(), ratio());
  const toScene = (wx, wz) => { const p = gps().scenePosition(); const [sx, sz] = worldToScene(wx, wz, gps().worldX(), gps().worldZ(), p, ratio()); return [sx, p[1], sz]; };
  const changed = () => deps.presentation?.onChanged?.();

  // ── properties [IL_452a-IL_4586]
  const horseName = () => normalizeHorseName(wagonState.HorseName);
  const hasHorseName = () => !!horseName();
  const horseSubject = (cap) => formatHorseSubject(wagonState.HorseName, cap);
  const horseAndWagonSubject = (cap) => formatHorseAndWagonSubject(wagonState.HorseName, cap);
  const horseObject = () => horseSubject(false);
  const savedHeading = () => horizontalForward([wagonState.HeadingX, 0, wagonState.HeadingZ]);
  const savedHorseHeading = () => horizontalForward([wagonState.HorseHeadingX, 0, wagonState.HorseHeadingZ]);
  const isTeamFollowing = () => isHitchedTeamFollowing(wagonState.Mode, wagonState.HorseMode);
  const isHorseFollowing = () => isAutonomousHorseFollowing(wagonState);

  // ── settings (HandleSettingsChanged [IL_486c]; ParseConfiguredHotkey [IL_4a58])
  function parseConfiguredHotkey(value, fallback, label) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text === KEYCODE_NONE) return KEYCODE_NONE;
    if (text && isBindableKeyCode(text)) return text;
    log.warn?.(`[TrailingWagon] ${label} hotkey '${value}' is not a Unity KeyCode; using ${fallback}.`);
    return fallback;
  }
  function handleSettingsChanged() {
    const s = deps.settings?.() ?? {};
    const persistence = s.physicalPersistence !== false;
    const showTrailing = s.showTrailingWagon !== false;
    const followDist = clampHorseFollowDistance(s.horseFollowDistance ?? DEFAULT_HORSE_FOLLOW_DISTANCE);
    const avoid = s.avoidCombat !== false;
    const followFT = s.followFastTravel !== false;
    const interiorDist = clampInteriorWagonAccessDistance(s.interiorAccessDistance ?? DEFAULT_INTERIOR_ACCESS_DISTANCE);
    const quickKey = parseConfiguredHotkey(s.quickMountKey, DEFAULT_QUICK_MOUNT_KEY, 'Quick Mount / Dismount');
    const summonKey = parseConfiguredHotkey(s.summonKey, DEFAULT_SUMMON_KEY, 'Summon Horse & Wagon');
    const assign = () => { physicalPersistenceEnabled = persistence; showTrailingWagon = showTrailing; horseFollowDistance = followDist; avoidCombat = avoid; interiorWagonAccessDistance = interiorDist; followingTransportFastTravels = followFT; quickMountHotkey = quickKey; summonTransportHotkey = summonKey; };
    if (!settingsInitialized) { assign(); settingsInitialized = true; pendingPersistenceNormalization = !persistence; return; }
    const persistenceChanged = persistence !== physicalPersistenceEnabled;
    const avoidChanged = avoid !== avoidCombat;
    assign();
    if (avoidChanged && !avoidCombat) horseFollower.clearCombatEvasion(phys);
    if (!persistenceChanged) return;
    pendingPersistenceSettingTransition = true; pendingPersistenceNormalization = false;
  }
  handleSettingsChanged();

  // ── the moving wagon's presentation object (CreateWagonVisual [IL_5694] / ClearMovingPresentation [IL_a794])
  function createWagonVisual() {
    const parts = deps.presentation?.wagonParts?.() ?? null;
    if (!parts) {
      if (!spawnFailureLogged) { spawnFailureLogged = true; log.error?.('[TrailingWagon] could not create the temporary wagon visual: DFU returned no object for vanilla wagon model 41214.'); }
      return false;
    }
    wagonVisual = {
      parts,
      pose: { position: [...V_ZERO], rotation: [...UNITY_QUAT_IDENTITY], active: false, lastValidPosition: [...V_ZERO], lastValidRotation: [...UNITY_QUAT_IDENTITY], hasLastValid: false },
      wheel: { has: false, prevPos: [...V_ZERO], prevFwd: [...V_FORWARD], angle: 0 },
      cargoTier: 0, interaction: false,
    };
    cargoFailureLogged = false;
    resetWheelMotionState();
    spawnFailureLogged = false;
    return true;
  }
  function clearMovingPresentation() {
    wagonVisual = null;
    trail.clear(); hitchedWagonPath.clear(); hitchedWagonPathInitialized = false;
    followingWagonFailureLogged = false; horseRecoveredThisFrame = false; nextFollowingWagonSpawnRetryTime = 0;
    hasLastValidGroundState = false;
    spawnFailureLogged = false; cargoFailureLogged = false;
    changed();
  }
  function resetWheelMotionState() { if (wagonVisual) wagonVisual.wheel = { has: false, prevPos: [...V_ZERO], prevFwd: [...V_FORWARD], angle: 0 }; }
  const wagonActive = () => !!wagonVisual?.pose.active;
  const wagonPosition = () => wagonVisual.pose.position;
  const wagonForward = () => quatForward(wagonVisual.pose.rotation);
  function destroyDeployedWagonPresentation() { if (deployedVisual) { deployedVisual.release(); deployedVisual = null; changed(); } nextDeployedSpawnRetryTime = 0; deployedSpawnFailureLogged = false; }
  function destroyStationaryHorsePresentation() { if (stationaryHorseVisual) { stationaryHorseVisual.release(); stationaryHorseVisual = null; changed(); } nextHorseSpawnRetryTime = 0; horseSpawnFailureLogged = false; horseFollower.resetTransient(); }
  function destroyAllStationaryPresentations() { destroyDeployedWagonPresentation(); destroyStationaryHorsePresentation(); }
  function ownsStationaryHorseActivator(a) { return physicalPersistenceEnabled && !!stationaryHorseVisual && stationaryHorseVisual === a; }   // [IL_8591]

  // ── the save record's setters [IL_73f0-IL_75fb, IL_969c, IL_a205, IL_78c0]
  function setHorseLoose(wx, wz, heading) { const h = horizontalForward(heading); wagonState.Version = WAGON_SAVE_VERSION; wagonState.HorseMode = HORSE_MODE.LooseStationary; wagonState.HorseWorldX = wx; wagonState.HorseWorldZ = wz; wagonState.HorseHeadingX = h[0]; wagonState.HorseHeadingZ = h[2]; changed(); }
  function setHorseFollowing(wx, wz, heading) { const h = horizontalForward(heading); wagonState.Version = WAGON_SAVE_VERSION; wagonState.HorseMode = HORSE_MODE.FollowingPlayer; wagonState.HorseWorldX = wx; wagonState.HorseWorldZ = wz; wagonState.HorseHeadingX = h[0]; wagonState.HorseHeadingZ = h[2]; changed(); }
  const zeroHorse = (mode) => { wagonState.Version = WAGON_SAVE_VERSION; wagonState.HorseMode = mode; wagonState.HorseWorldX = 0; wagonState.HorseWorldZ = 0; wagonState.HorseHeadingX = 0; wagonState.HorseHeadingZ = 1; };
  function setHorseWithPlayer() { zeroHorse(HORSE_MODE.WithPlayer); destroyStationaryHorsePresentation(); horseFollower.resetTransient(); changed(); }
  function setHorseHitchedToWagon() { zeroHorse(HORSE_MODE.HitchedToWagon); destroyStationaryHorsePresentation(); horseFollower.resetTransient(); changed(); }
  function setHorseNone() { zeroHorse(HORSE_MODE.None); horseFollower.resetTransient(); changed(); }
  function setHorseLooseAtWagonHitch() {
    const pose = stationaryHorseVisual?.tryGetGroundedPose();
    if (pose) { const [wx, wz] = toWorld(pose.position); setHorseLoose(wx, wz, pose.forward); return; }
    const heading = savedHeading();
    const [hx, hz] = applyLocalOffsetToWorld(wagonState.WorldX, wagonState.WorldZ, heading, HITCHED_HORSE_LOCAL_X, HITCHED_HORSE_LOCAL_Z, ratio());
    setHorseLoose(hx, hz, heading);
  }
  function resetWagonState(mode) { wagonState.Version = WAGON_SAVE_VERSION; wagonState.Mode = mode; wagonState.WorldX = 0; wagonState.WorldZ = 0; wagonState.HeadingX = 0; wagonState.HeadingZ = 1; wagonState.InteriorAccessMode = INTERIOR_ACCESS.None; wagonState.InteriorAccessId = 0; changed(); }
  function clearInteriorAccess() { wagonState.InteriorAccessMode = INTERIOR_ACCESS.None; wagonState.InteriorAccessId = 0; }
  function clearPendingInteriorState() {
    hasPendingInteriorDeployment = false; hasPendingInteriorHorseDeployment = false; pendingInteriorEntranceEligible = false; pendingInteriorEntranceDistance = Infinity;
    pendingInteriorWorldX = 0; pendingInteriorWorldZ = 0; pendingInteriorHeading = [...V_FORWARD];
    pendingInteriorHorseWorldX = 0; pendingInteriorHorseWorldZ = 0; pendingInteriorHorseHeading = [...V_FORWARD];
    pendingInteriorTransportMode = TRANSPORT.Foot;
  }
  /** CommitDeployment [IL_78c0]: the wagon parked at world coordinates with a heading and the horse's mode beside it. */
  function commitDeployment(wx, wz, heading, deployedHorseMode) {
    const h = horizontalForward(heading);
    wagonState.Version = WAGON_SAVE_VERSION; wagonState.Mode = WAGON_MODE.Deployed; wagonState.WorldX = wx; wagonState.WorldZ = wz; wagonState.HeadingX = h[0]; wagonState.HeadingZ = h[2]; wagonState.HorseMode = deployedHorseMode;
    if (deployedHorseMode !== HORSE_MODE.LooseStationary && deployedHorseMode !== HORSE_MODE.FollowingPlayer) { wagonState.HorseWorldX = 0; wagonState.HorseWorldZ = 0; wagonState.HorseHeadingX = 0; wagonState.HorseHeadingZ = 1; }
    clearPendingInteriorState(); hasMovingWorldPose = false; clearMovingPresentation(); destroyDeployedWagonPresentation();
  }
  /** CaptureBestAvailableDeploymentPose [IL_7820]: the trailing wagon's last cached world pose, else 2.5 m behind the player. */
  function captureBestAvailableDeploymentPose() {
    if (hasMovingWorldPose) return { wx: movingWorldX, wz: movingWorldZ, heading: [...movingWorldHeading] };
    const heading = horizontalForward(deps.player.forward());
    const [wx, wz] = toWorld(vsub(playerPosition(), vscale(heading, WAGON_FOLLOW_DISTANCE)));
    return { wx, wz, heading };
  }
  function deployFromBestAvailablePose(horseMode) { const p = captureBestAvailableDeploymentPose(); commitDeployment(p.wx, p.wz, p.heading, horseMode); }
  function captureHorseBehindPlayerPose() { const heading = horizontalForward(deps.player.forward()); const [wx, wz] = toWorld(vsub(playerPosition(), vscale(heading, HORSE_DISMOUNT_REAR_OFFSET))); return { wx, wz, heading }; }
  function deployHorseBehindPlayer() { const p = captureHorseBehindPlayerPose(); setHorseLoose(p.wx, p.wz, p.heading); }
  function deployWagonBeforeHorseTravel() { if (wagonState.Mode === WAGON_MODE.WithPlayer && tm().hasCart() && !pee().isPlayerInside() && !hasPendingInteriorDeployment) deployFromBestAvailablePose(HORSE_MODE.WithPlayer); }

  // ── transport mode [IL_6668-IL_679c]
  function rememberLastMount(mode) { if (mode === TRANSPORT.Horse) wagonState.LastMount = LAST_MOUNT.Horse; else if (mode === TRANSPORT.Cart) wagonState.LastMount = LAST_MOUNT.Cart; }
  function clearPendingTransportModeRefresh() { hasPendingTransportModeRefresh = false; pendingTransportModeRefresh = TRANSPORT.Foot; pendingTransportModeRefreshTime = 0; }
  function setTransportMode(mode) {
    if (hasPendingTransportModeRefresh && mode !== pendingTransportModeRefresh) clearPendingTransportModeRefresh();
    tm().set(mode);
    hasObservedTransportMode = true; previousTransportMode = mode;
    if (mode === TRANSPORT.Foot || mode === TRANSPORT.Horse) lastValidNonCartTransportMode = mode;
    rememberLastMount(mode);
  }
  function rememberValidNonCartMode(mode) { if (mode === TRANSPORT.Foot) { lastValidNonCartTransportMode = TRANSPORT.Foot; return; } if (mode === TRANSPORT.Horse && tm().hasHorse()) lastValidNonCartTransportMode = TRANSPORT.Horse; }
  function rejectTransportChange(fallback, message) {
    let m = fallback;
    if (m === TRANSPORT.Horse && !tm().hasHorse()) m = TRANSPORT.Foot;
    if (m === TRANSPORT.Cart || m === TRANSPORT.Ship) m = (lastValidNonCartTransportMode === TRANSPORT.Horse && tm().hasHorse()) ? TRANSPORT.Horse : TRANSPORT.Foot;
    setTransportMode(m); lastValidNonCartTransportMode = m; say(message);
  }
  function scheduleDirectCartTransportRefresh() { pendingTransportModeRefresh = TRANSPORT.Cart; pendingTransportModeRefreshTime = now() + DIRECT_CART_AUDIO_REFRESH_DELAY; hasPendingTransportModeRefresh = true; }
  function updatePendingTransportModeRefresh() {
    if (!hasPendingTransportModeRefresh) return;
    if (!canRefreshDirectCartTransport(tm().get(), tm().hasCart(), tm().hasHorse(), wagonState.Mode, wagonState.HorseMode)) { clearPendingTransportModeRefresh(); return; }
    if (now() < pendingTransportModeRefreshTime) return;
    const mode = pendingTransportModeRefresh; clearPendingTransportModeRefresh();
    tm().set(mode);   // the direct set: the cart's audio and state refreshed by DFU
    hasObservedTransportMode = true; previousTransportMode = mode;
  }
  function hitchDeployedWagon() {
    resetWagonState(WAGON_MODE.WithPlayer);
    wagonState.HorseMode = HORSE_MODE.HitchedToWagon; wagonState.HorseWorldX = 0; wagonState.HorseWorldZ = 0; wagonState.HorseHeadingX = 0; wagonState.HorseHeadingZ = 1;
    clearPendingInteriorState(); hasMovingWorldPose = false; clearMovingPresentation(); destroyAllStationaryPresentations();
    setTransportMode(TRANSPORT.Cart); scheduleDirectCartTransportRefresh();
  }
  function beginRidingHorse() { setHorseWithPlayer(); setTransportMode(TRANSPORT.Horse); }

  // ── the scene of what is saved [IL_82f8-IL_8250, IL_7df8, IL_71dc, IL_8fa8]
  function tryGetRelevantSavedWorldScene(wx, wz) {
    if (pee().isPlayerInside() || tm().isOnShip() || hasPendingInteriorDeployment || hasPendingInteriorHorseDeployment) return null;
    if (deps.fadeInProgress?.()) return null;
    const sw = deps.streaming;
    if (!sw.isReady() || sw.isInit()) return null;
    const pixel = deps.worldCoordToMapPixel(wx, wz), cur = gps().currentMapPixel();
    if (pixel.x !== cur.x || pixel.y !== cur.y || pixel.x !== sw.mapPixelX() || pixel.y !== sw.mapPixelY()) return null;
    return toScene(wx, wz);
  }
  function tryGetRelevantDeployedScene() {
    if (wagonState.Mode !== WAGON_MODE.Deployed) return null;
    const anchor = tryGetRelevantSavedWorldScene(wagonState.WorldX, wagonState.WorldZ);
    return anchor ? { anchor, heading: savedHeading() } : null;
  }
  function tryGetLiveFollowingWagonPose() {
    if (!isTeamFollowing() || !wagonVisual || !wagonActive() || !hasLastValidGroundState) return null;
    return { position: [...wagonPosition()], heading: horizontalForward(wagonForward()) };
  }
  function tryGetPhysicalWagonScene() {
    if (wagonState.Mode === WAGON_MODE.Deployed) return tryGetRelevantDeployedScene();
    if (!isTeamFollowing()) return null;
    const live = tryGetLiveFollowingWagonPose();
    if (live) return { anchor: live.position, heading: live.heading };
    const anchor = tryGetRelevantSavedWorldScene(wagonState.WorldX, wagonState.WorldZ);
    return anchor ? { anchor, heading: savedHeading() } : null;
  }
  function tryGetFollowingHorseScene() {
    if (pee().isPlayerInside() || tm().isOnShip()) return null;
    if (deps.fadeInProgress?.()) return null;
    const sw = deps.streaming;
    if (!sw.isReady() || sw.isInit()) return null;
    const pose = stationaryHorseVisual?.tryGetGroundedPose();
    if (pose) return { position: pose.position, heading: pose.forward };
    return { position: toScene(wagonState.HorseWorldX, wagonState.HorseWorldZ), heading: savedHorseHeading() };
  }
  function tryGetHorseScenePosition() {
    if (isHorseFollowing()) { const pose = stationaryHorseVisual?.tryGetGroundedPose(); if (pose) return pose.position; }
    if (wagonState.HorseMode === HORSE_MODE.LooseStationary || isHorseFollowing()) return tryGetRelevantSavedWorldScene(wagonState.HorseWorldX, wagonState.HorseWorldZ);
    if (wagonState.HorseMode === HORSE_MODE.HitchedToWagon && wagonState.Mode === WAGON_MODE.Deployed) {
      const d = tryGetRelevantDeployedScene();
      if (!d) return null;
      let pos = d.anchor, heading = d.heading;
      const gp = deployedVisual?.tryGetGroundedPose();
      if (gp) { pos = gp.position; heading = gp.forward; }
      return vadd(vadd(pos, vscale(horizontalRight(heading), HITCHED_HORSE_LOCAL_X)), vscale(heading, HITCHED_HORSE_LOCAL_Z));
    }
    return null;
  }

  // ── caches [IL_7748, IL_53f4, IL_7d4c]
  function cacheMovingWorldPose() {
    if (!wagonVisual || !wagonActive() || !hasLastValidGroundState || pee().isPlayerInside()) return;
    const heading = horizontalForward(wagonForward());
    [movingWorldX, movingWorldZ] = toWorld(wagonPosition());
    movingWorldHeading = heading; hasMovingWorldPose = true;
  }
  function cacheFollowingWagonWorldPose() {
    if (!wagonVisual || !wagonActive() || !hasLastValidGroundState || !isTeamFollowing()) return;
    [wagonState.WorldX, wagonState.WorldZ] = toWorld(wagonPosition());
    const h = horizontalForward(wagonForward()); wagonState.HeadingX = h[0]; wagonState.HeadingZ = h[2]; wagonState.Version = WAGON_SAVE_VERSION;
  }
  function cacheFollowingHorseWorldPose() {
    if (!isHorseFollowing() || !stationaryHorseVisual) return;
    const pose = stationaryHorseVisual.tryGetGroundedPose();
    if (!pose) return;
    const [wx, wz] = toWorld(pose.position);
    wagonState.Version = WAGON_SAVE_VERSION; wagonState.HorseWorldX = wx; wagonState.HorseWorldZ = wz; wagonState.HorseHeadingX = pose.forward[0]; wagonState.HorseHeadingZ = pose.forward[2];
  }

  // ── the persistence setting [IL_4ac4-IL_4cd3]
  function clearPhysicalPersistenceTransientState() {
    destroyAllStationaryPresentations(); clearPendingInteriorState(); clearInteriorAccess(); clearPendingTransportModeRefresh();
    selectWagonOnNextInventoryOpen = false; followingTransitionSuspended = false; fastTravelFollowingSuspended = false; pendingFastTravelHorseRelocation = false;
    travelOptionsWasActive = false; horseFollower.resetTransient(); hasMovingWorldPose = false;
  }
  function applyPersistenceResolution(r, force) {
    if (force || wagonState.Mode !== r.WagonMode) resetWagonState(r.WagonMode); else clearInteriorAccess();
    if (force || wagonState.HorseMode !== r.HorseMode) {
      if (r.HorseMode === HORSE_MODE.WithPlayer) setHorseWithPlayer();
      else if (r.HorseMode === HORSE_MODE.HitchedToWagon) setHorseHitchedToWagon();
      else setHorseNone();
    }
    if (tm().get() !== r.TransportMode) { setTransportMode(r.TransportMode); return; }
    hasObservedTransportMode = true; previousTransportMode = r.TransportMode;
  }
  const disabledResolution = () => resolvePersistenceDisabledState(tm().get(), tm().hasCart(), tm().hasHorse());
  function applyPendingPersistenceWork() {
    if (pendingPersistenceSettingTransition) {
      pendingPersistenceSettingTransition = false;
      if (physicalPersistenceEnabled) {
        clearPhysicalPersistenceTransientState();
        const r = resolvePersistenceEnabledState(tm().get(), tm().hasCart(), tm().hasHorse());
        applyPersistenceResolution(r, true);
        if (r.RequiresHorseMessage) say(HCC_TEXT.needHorseWhilePersistence);
      } else { clearPhysicalPersistenceTransientState(); applyPersistenceResolution(disabledResolution(), true); }
      return;
    }
    if (!physicalPersistenceEnabled && pendingPersistenceNormalization) {
      pendingPersistenceNormalization = false;
      applyPersistenceResolution(disabledResolution(), true);
      clearPhysicalPersistenceTransientState();
      log.info?.('[TrailingWagon] loaded state normalized for disabled physical persistence.');
    }
  }

  // ── ownership [IL_60f4, IL_6274]
  function reconcileCartOwnership(hasCart, hasHorse) {
    if (!physicalPersistenceEnabled) {
      const r = disabledResolution();
      if (wagonState.Mode === r.WagonMode && wagonState.HorseMode === r.HorseMode && tm().get() === r.TransportMode) return;
      applyPersistenceResolution(r, false); return;
    }
    if (hasCart) { if (wagonState.Mode === WAGON_MODE.None) resetWagonState(WAGON_MODE.WithPlayer); return; }
    if (wagonState.Mode === WAGON_MODE.None) {
      if (wagonState.HorseMode === HORSE_MODE.HitchedToWagon) { if (hasHorse) setHorseWithPlayer(); else setHorseNone(); }
      if (tm().get() === TRANSPORT.Cart) setTransportMode(TRANSPORT.Foot);
      return;
    }
    if (hasHorse && isTeamFollowing()) { cacheFollowingHorseWorldPose(); wagonState.HorseMode = HORSE_MODE.FollowingPlayer; horseFollower.resetTransient(); }
    else if (hasHorse && wagonState.HorseMode === HORSE_MODE.HitchedToWagon) { if (wagonState.Mode === WAGON_MODE.Deployed) setHorseLooseAtWagonHitch(); else setHorseWithPlayer(); }
    else if (!hasHorse) setHorseNone();
    resetWagonState(WAGON_MODE.None); clearPendingInteriorState(); hasMovingWorldPose = false; clearMovingPresentation(); destroyDeployedWagonPresentation();
    if (tm().get() === TRANSPORT.Cart) setTransportMode(TRANSPORT.Foot);
  }
  function reconcileHorseOwnership(hasHorse) {
    wagonState.HorseName = reconcileHorseNameOwnership(wagonState.HorseName, hasHorse);
    if (!physicalPersistenceEnabled) return;
    if (hasHorse) { if (wagonState.HorseMode === HORSE_MODE.None) setHorseWithPlayer(); return; }
    if (isTeamFollowing()) {
      const live = tryGetLiveFollowingWagonPose();
      if (live) { const [wx, wz] = toWorld(live.position); commitDeployment(wx, wz, live.heading, HORSE_MODE.None); }
      else { wagonState.Mode = WAGON_MODE.Deployed; wagonState.HorseMode = HORSE_MODE.None; clearMovingPresentation(); }
    }
    if (wagonState.HorseMode !== HORSE_MODE.None) setHorseNone();
    destroyStationaryHorsePresentation();
    const mode = tm().get();
    if (mode === TRANSPORT.Horse || mode === TRANSPORT.Cart) {
      if (mode === TRANSPORT.Cart && wagonState.Mode === WAGON_MODE.WithPlayer && !pee().isPlayerInside()) deployFromBestAvailablePose(HORSE_MODE.None);
      setTransportMode(TRANSPORT.Foot);
    }
  }

  // ── the mount preparations and the transport commands [IL_6a50-IL_70fe, IL_6bfc-IL_6fba]
  function tryPrepareCartMount() {
    if (isTeamFollowing() && canMountNearbyDeployedCart()) { hitchDeployedWagon(); return true; }
    if (!(tm().hasCart() && tm().hasHorse() && wagonState.Mode === WAGON_MODE.WithPlayer && (wagonState.HorseMode === HORSE_MODE.WithPlayer || wagonState.HorseMode === HORSE_MODE.HitchedToWagon))) return false;
    wagonState.HorseMode = HORSE_MODE.HitchedToWagon; wagonState.HorseWorldX = 0; wagonState.HorseWorldZ = 0; wagonState.HorseHeadingX = 0; wagonState.HorseHeadingZ = 1;
    return isPhysicalTransportStateValid(true, true, wagonState.Mode, wagonState.HorseMode, TRANSPORT.Cart);
  }
  function tryPrepareHorseMount(maxDistance) {
    if (!tm().hasHorse()) return false;
    if (isTeamFollowing()) return false;
    if (tm().get() === TRANSPORT.Cart && wagonState.Mode === WAGON_MODE.WithPlayer && wagonState.HorseMode === HORSE_MODE.HitchedToWagon) return true;
    if (wagonState.HorseMode === HORSE_MODE.WithPlayer) return true;
    if (pee().isPlayerInside() || tm().isOnShip()) return false;
    const pos = tryGetHorseScenePosition();
    if (!pos) return false;
    if (!isWithinHorizontalDistance(playerPosition(), pos, maxDistance)) return false;
    setHorseWithPlayer(); destroyStationaryHorsePresentation();
    return true;
  }
  function canMountNearbyDeployedCart() {
    if (!ready()) return false;
    if (wagonState.Mode !== WAGON_MODE.Deployed && wagonState.Mode !== WAGON_MODE.FollowingPlayer) return false;
    if (pee().isPlayerInside() || tm().isOnShip()) return false;
    const w = tryGetPhysicalWagonScene();
    if (!w) return false;
    let wagonPos = w.anchor;
    const gp = deployedVisual?.tryGetGroundedPose();
    if (gp) wagonPos = gp.position;
    let horsePos;
    if (wagonState.HorseMode === HORSE_MODE.WithPlayer && tm().get() === TRANSPORT.Horse) horsePos = playerPosition();
    else { horsePos = tryGetHorseScenePosition(); if (!horsePos) return false; }
    return isPhysicalTeamWithinMountDistances(playerPosition(), wagonPos, horsePos);
  }
  function isHorseCloseEnoughToHitch() {
    const horsePos = tryGetHorseScenePosition();
    if (!horsePos) return false;
    const d = tryGetRelevantDeployedScene();
    if (!d) return false;
    let wagonPos = d.anchor;
    const gp = deployedVisual?.tryGetGroundedPose();
    if (gp) wagonPos = gp.position;
    return isWithinHorizontalDistance(horsePos, wagonPos, HORSE_WAGON_HITCH_DISTANCE);
  }
  function detachFollowingTeamAndRideHorse() {
    const live = tryGetLiveFollowingWagonPose();
    if (!live) return false;
    const [wx, wz] = toWorld(live.position);
    commitDeployment(wx, wz, live.heading, HORSE_MODE.WithPlayer);
    beginRidingHorse();
    return true;
  }
  const allow = () => ({ allowed: true, denialMessage: '' });
  const deny = (m) => ({ allowed: false, denialMessage: m ?? '' });
  const success = () => ({ handled: true, succeeded: true, denialMessage: '' });
  const denied = (m) => ({ handled: true, succeeded: false, denialMessage: m ?? '' });
  const unsupported = (m) => ({ handled: false, succeeded: false, denialMessage: m ?? '' });
  const denyTransportAction = (m) => { say(m); return denied(m); };
  function canUseHorseTransport() {
    if (!ready() || !tm().hasHorse()) return deny(HCC_TEXT.doNotOwnHorse);
    if (!physicalPersistenceEnabled) return allow();
    if (wagonState.HorseMode === HORSE_MODE.WithPlayer) return allow();
    if (tm().get() === TRANSPORT.Cart && wagonState.Mode === WAGON_MODE.WithPlayer && wagonState.HorseMode === HORSE_MODE.HitchedToWagon) return allow();
    const pos = tryGetHorseScenePosition();
    const near = !!pos && isWithinHorizontalDistance(playerPosition(), pos, HORSE_MENU_MOUNT_DISTANCE);
    return near ? allow() : deny(`${horseSubject(true)} is not close enough.`);
  }
  function tryUseHorseTransport() {
    if (!ready()) return unsupported(HCC_TEXT.notReady);
    if (!physicalPersistenceEnabled) { if (tm().hasHorse()) { setTransportMode(TRANSPORT.Horse); return success(); } return denyTransportAction(HCC_TEXT.doNotOwnHorse); }
    if (isTeamFollowing()) {
      if (!canMountHorseFromTransportWindow()) return denyTransportAction(`${horseSubject(true)} is not close enough.`);
      if (!detachFollowingTeamAndRideHorse()) return denyTransportAction(HCC_TEXT.wagonNotReadyToUnhitch);
      return success();
    }
    if (tm().get() === TRANSPORT.Horse) { deployWagonBeforeHorseTravel(); setTransportMode(TRANSPORT.Horse); return success(); }
    if (tm().get() === TRANSPORT.Cart && wagonState.Mode === WAGON_MODE.WithPlayer && wagonState.HorseMode === HORSE_MODE.HitchedToWagon) { deployFromBestAvailablePose(HORSE_MODE.WithPlayer); setTransportMode(TRANSPORT.Horse); return success(); }
    if (!tryPrepareHorseMount(HORSE_MENU_MOUNT_DISTANCE)) return denyTransportAction(`${horseSubject(true)} is not close enough.`);
    deployWagonBeforeHorseTravel(); beginRidingHorse();
    return success();
  }
  function canUseCartTransport() {
    if (!ready() || !tm().hasCart()) return deny(HCC_TEXT.doNotOwnWagon);
    if (!physicalPersistenceEnabled) return allow();
    if (!tm().hasHorse()) return deny(HCC_TEXT.needHorseToPull);
    if (wagonState.Mode === WAGON_MODE.WithPlayer && (wagonState.HorseMode === HORSE_MODE.WithPlayer || wagonState.HorseMode === HORSE_MODE.HitchedToWagon)) return allow();
    if (!canMountNearbyDeployedCart()) return deny(HCC_TEXT.wagonAndHorseMustBeWithYou);
    return allow();
  }
  function tryUseCartTransport() {
    if (!ready()) return unsupported(HCC_TEXT.notReady);
    if (!physicalPersistenceEnabled) { if (tm().hasCart()) { setTransportMode(TRANSPORT.Cart); return success(); } return denyTransportAction(HCC_TEXT.doNotOwnWagon); }
    if (canMountNearbyDeployedCart()) { hitchDeployedWagon(); return success(); }
    if (!tryPrepareCartMount()) return denyTransportAction(HCC_TEXT.wagonAndHorseMustBeWithYou);
    setTransportMode(TRANSPORT.Cart);
    return success();
  }
  function canUseTransport(mode) { if (mode === TRANSPORT.Horse) return canUseHorseTransport(); if (mode === TRANSPORT.Cart) return canUseCartTransport(); return deny(HCC_TEXT.onlyHorseAndCart); }
  function tryUseTransport(mode) { if (mode === TRANSPORT.Horse) return tryUseHorseTransport(); if (mode === TRANSPORT.Cart) return tryUseCartTransport(); return unsupported(HCC_TEXT.onlyHorseAndCart); }
  const canMountHorseFromTransportWindow = () => canUseTransport(TRANSPORT.Horse).allowed;
  const canUseCartFromTransportWindow = () => canUseTransport(TRANSPORT.Cart).allowed;

  // ── ObserveTransportMode [IL_63bc] - the mode the game set (the picker, a save, a script) read and answered
  function observeTransportMode() {
    if (!physicalPersistenceEnabled) {
      const r = disabledResolution();
      if (tm().get() !== r.TransportMode) setTransportMode(r.TransportMode);
      clearPendingTransportModeRefresh(); hasObservedTransportMode = true; previousTransportMode = r.TransportMode; rememberLastMount(r.TransportMode);
      if (r.TransportMode !== TRANSPORT.Cart) rememberValidNonCartMode(r.TransportMode);
      return;
    }
    const mode = tm().get();
    if (!hasObservedTransportMode) {
      hasObservedTransportMode = true; previousTransportMode = mode; rememberLastMount(mode);
      if (mode !== TRANSPORT.Cart) rememberValidNonCartMode(mode);
      if (mode === TRANSPORT.Cart && !tryPrepareCartMount()) { rejectTransportChange(TRANSPORT.Foot, HCC_TEXT.wagonNotWithYou); return; }
      if (mode === TRANSPORT.Horse && !tryPrepareHorseMount(HORSE_MENU_MOUNT_DISTANCE)) { rejectTransportChange(TRANSPORT.Foot, `${horseSubject(true)} is not close enough.`); return; }
      if (mode === TRANSPORT.Horse) deployWagonBeforeHorseTravel();
      return;
    }
    if (mode === previousTransportMode) return;
    const prev = previousTransportMode;
    if (mode === TRANSPORT.Cart && !tryPrepareCartMount()) { rejectTransportChange(prev, HCC_TEXT.wagonNotWithYou); return; }
    if (mode === TRANSPORT.Horse && prev !== TRANSPORT.Cart && !tryPrepareHorseMount(HORSE_MENU_MOUNT_DISTANCE)) { rejectTransportChange(prev, `${horseSubject(true)} is not close enough.`); return; }
    if (mode === TRANSPORT.Horse && prev !== TRANSPORT.Cart) deployWagonBeforeHorseTravel();
    if (prev === TRANSPORT.Cart && wagonState.Mode === WAGON_MODE.WithPlayer && !pee().isPlayerInside() && !hasPendingInteriorDeployment) {
      const hm = mode === TRANSPORT.Horse ? HORSE_MODE.WithPlayer : (tm().hasHorse() ? HORSE_MODE.HitchedToWagon : HORSE_MODE.None);
      deployFromBestAvailablePose(hm);
    } else if (prev === TRANSPORT.Horse && mode === TRANSPORT.Foot && wagonState.HorseMode === HORSE_MODE.WithPlayer && !pee().isPlayerInside() && !hasPendingInteriorHorseDeployment) {
      deployHorseBehindPlayer();
    }
    if (mode !== TRANSPORT.Cart) rememberValidNonCartMode(mode);
    rememberLastMount(mode); previousTransportMode = mode;
  }

  // ── the hotkeys [IL_67c0-IL_6a3e]
  function handleConfiguredHotkeys() {
    if (!deps.keyDown) return;
    if (quickMountHotkey !== KEYCODE_NONE && deps.keyDown(quickMountHotkey)) { handleQuickMountOrDismount(); return; }
    if (summonTransportHotkey !== KEYCODE_NONE && deps.keyDown(summonTransportHotkey)) { handleSummonTransport(); }
  }
  function handleQuickMountOrDismount() {
    const mode = tm().get();
    if (mode === TRANSPORT.Horse || mode === TRANSPORT.Cart) { tm().set(TRANSPORT.Foot); return; }   // the direct set; ObserveTransportMode reads it next frame
    if (mode !== TRANSPORT.Foot) { say(HCC_TEXT.quickMountUnavailable); return; }
    if (pee().isPlayerInside() || tm().isOnShip()) { say(HCC_TEXT.mountOutdoorsOnly); return; }
    const target = resolveQuickMountMode(wagonState.LastMount, tm().hasHorse(), tm().hasCart());
    if (target === TRANSPORT.Foot) { say(HCC_TEXT.doNotOwnHorseOrWagon); return; }
    tryUseTransport(target);
  }
  function handleSummonTransport() {
    if (pee().isPlayerInside() || tm().isOnShip()) { say(HCC_TEXT.summonOutdoorsOnly); return; }
    const hasHorse = tm().hasHorse(), hasCart = tm().hasCart();
    if (!hasHorse && !hasCart) { say(HCC_TEXT.doNotOwnHorseOrWagon); return; }
    if (!physicalPersistenceEnabled) { say(HCC_TEXT.alreadyWithYou); return; }
    const mode = tm().get();
    if (mode === TRANSPORT.Cart || (mode === TRANSPORT.Horse && !hasCart)) { say(HCC_TEXT.alreadyWithYou); return; }
    const fwd = horizontalForward(deps.player.forward());
    if (hasCart) {
      const [wx, wz] = toWorld(vsub(playerPosition(), vscale(fwd, WAGON_FOLLOW_DISTANCE)));
      const hm = hasHorse ? (mode === TRANSPORT.Horse ? HORSE_MODE.WithPlayer : HORSE_MODE.HitchedToWagon) : HORSE_MODE.None;
      commitDeployment(wx, wz, fwd, hm); destroyStationaryHorsePresentation();
    } else { deployHorseBehindPlayer(); destroyStationaryHorsePresentation(); }
    say(hasCart && hasHorse ? HCC_TEXT.summonedBoth : hasCart ? HCC_TEXT.summonedWagon : HCC_TEXT.summonedHorse);
  }

  // ── the interior transitions [IL_98f0-IL_9d26, IL_a18c-IL_a6c0]
  function tryGetWagonScenePositionForEntrance() {
    let wx, wz;
    if (hasPendingInteriorDeployment) { wx = pendingInteriorWorldX; wz = pendingInteriorWorldZ; }
    else if (wagonState.Mode === WAGON_MODE.Deployed) {
      const gp = deployedVisual?.tryGetGroundedPose();
      if (gp) return gp.position;
      wx = wagonState.WorldX; wz = wagonState.WorldZ;
    } else if (isTeamFollowing()) {
      const live = tryGetLiveFollowingWagonPose();
      if (live) return live.position;
      wx = wagonState.WorldX; wz = wagonState.WorldZ;
    } else return null;
    return toScene(wx, wz);
  }
  /** HandlePreTransition [IL_98f0]: `args = { type: 'ToBuildingInterior'|'ToDungeonInterior'|..., door: [x,y,z] | null, buildingKey, dungeonId }`. */
  function handlePreTransition(args) {
    if (!args || (args.type !== 'ToBuildingInterior' && args.type !== 'ToDungeonInterior')) return;
    if (!physicalPersistenceEnabled) { clearPhysicalPersistenceTransientState(); return; }
    if (!ready()) return;
    if (isHorseFollowing()) { cacheFollowingHorseWorldPose(); followingTransitionSuspended = true; horseFollower.resetTransient(); }
    clearPendingInteriorState();
    pendingInteriorTransportMode = resolveInteriorEntryMode(tm().get(), hasObservedTransportMode, previousTransportMode, wagonState.Mode === WAGON_MODE.WithPlayer, tm().hasCart(), tm().hasHorse(), wagonState.HorseMode);
    if (wagonState.Mode === WAGON_MODE.WithPlayer && tm().hasCart()) {
      const p = captureBestAvailableDeploymentPose();
      pendingInteriorWorldX = p.wx; pendingInteriorWorldZ = p.wz; pendingInteriorHeading = p.heading; hasPendingInteriorDeployment = true;
    }
    if (shouldDeployIndependentHorseForInterior(hasPendingInteriorDeployment, pendingInteriorTransportMode, wagonState.HorseMode, tm().hasHorse())) {
      const p = captureHorseBehindPlayerPose();
      pendingInteriorHorseWorldX = p.wx; pendingInteriorHorseWorldZ = p.wz; pendingInteriorHorseHeading = p.heading; hasPendingInteriorHorseDeployment = true;
    }
    const wagonScenePos = tryGetWagonScenePositionForEntrance();
    if (!wagonScenePos) return;
    let door = args.door ?? playerPosition();
    if (args.type === 'ToDungeonInterior' && !isUsableDungeonEntranceDoorPosition(playerPosition(), door)) door = playerPosition();
    pendingInteriorEntranceDistance = horizontalDistance(wagonScenePos, door);
    pendingInteriorEntranceEligible = isWithinInteriorEntranceDistance(pendingInteriorEntranceDistance, interiorWagonAccessDistance);
  }
  function setInteriorAccessFromTransition(args) {
    if (args && args.type === 'ToBuildingInterior') { wagonState.InteriorAccessMode = INTERIOR_ACCESS.Building; wagonState.InteriorAccessId = args.buildingKey | 0; return; }
    if (args && args.type === 'ToDungeonInterior' && args.dungeonId != null) { wagonState.InteriorAccessMode = INTERIOR_ACCESS.Dungeon; wagonState.InteriorAccessId = args.dungeonId | 0; return; }
    clearInteriorAccess();
  }
  function handleSuccessfulInteriorTransition(args) {
    if (!physicalPersistenceEnabled) { clearPhysicalPersistenceTransientState(); return; }
    if (isTeamFollowing()) clearMovingPresentation();
    destroyAllStationaryPresentations();
    const hadWagon = hasPendingInteriorDeployment, hadHorse = hasPendingInteriorHorseDeployment, eligible = pendingInteriorEntranceEligible;
    const wx = pendingInteriorWorldX, wz = pendingInteriorWorldZ, heading = pendingInteriorHeading;
    const hx = pendingInteriorHorseWorldX, hz = pendingInteriorHorseWorldZ, hheading = pendingInteriorHorseHeading;
    const entryMode = pendingInteriorTransportMode;
    if (hadWagon) {
      // AUDIT HCC (branch audit) [IL_9b1a-IL_9b3e]: by CART with a horse the team goes in hitched; otherwise the horse keeps
      // its own mode - a horse waiting down the road, or following, is not teleported to the wagon at the door
      const hm = (entryMode === TRANSPORT.Cart && wagonState.HorseMode !== HORSE_MODE.None) ? HORSE_MODE.HitchedToWagon : wagonState.HorseMode;
      commitDeployment(wx, wz, heading, hm);
    }
    if (hadHorse && !isCartInteriorDeployment(hadWagon, entryMode)) setHorseLoose(hx, hz, hheading);
    if (eligible && (wagonState.Mode === WAGON_MODE.Deployed || isTeamFollowing())) setInteriorAccessFromTransition(args); else clearInteriorAccess();
    clearPendingInteriorState();
    if (ready()) { hasObservedTransportMode = true; previousTransportMode = tm().get(); }
  }
  function handleFailedTransition(args) {
    if (!physicalPersistenceEnabled) { clearPhysicalPersistenceTransientState(); return; }
    if (!hasPendingInteriorDeployment && !hasPendingInteriorHorseDeployment && !pendingInteriorEntranceEligible && !followingTransitionSuspended) return;
    if (args && args.type !== 'ToBuildingInterior' && args.type !== 'ToDungeonInterior') return;
    const hadWagon = hasPendingInteriorDeployment, hadHorse = hasPendingInteriorHorseDeployment, entryMode = pendingInteriorTransportMode;
    clearPendingInteriorState();
    if (isHorseFollowing()) { followingTransitionSuspended = false; horseFollower.resetTransient(); }
    if (hadWagon) resetWagonState(WAGON_MODE.WithPlayer);
    if (hadHorse) setHorseWithPlayer();
    if (ready() && !pee().isPlayerInside()) {
      if (entryMode === TRANSPORT.Cart && tm().hasCart() && tm().hasHorse()) { wagonState.HorseMode = HORSE_MODE.HitchedToWagon; wagonState.HorseWorldX = 0; wagonState.HorseWorldZ = 0; wagonState.HorseHeadingX = 0; wagonState.HorseHeadingZ = 1; setTransportMode(TRANSPORT.Cart); }
      else if (entryMode === TRANSPORT.Horse && tm().hasHorse()) { setHorseWithPlayer(); setTransportMode(TRANSPORT.Horse); }
    }
    log.info?.('[TrailingWagon] failed interior transition rolled back pending physical deployments.');
  }
  function handleExteriorTransition() {
    if (!physicalPersistenceEnabled) { clearPhysicalPersistenceTransientState(); return; }
    clearInteriorAccess(); clearPendingInteriorState();
    if (isHorseFollowing()) { followingTransitionSuspended = false; horseFollower.resetTransient(); }
  }
  function isWagonAtPlayerMapPixel() { const mp = deps.worldCoordToMapPixel(wagonState.WorldX, wagonState.WorldZ), cur = gps().currentMapPixel(); return mp.x === cur.x && mp.y === cur.y; }
  function validateInteriorAccessContext() {
    if (!physicalPersistenceEnabled) { clearInteriorAccess(); return; }
    if (wagonState.Mode !== WAGON_MODE.Deployed && !isTeamFollowing()) { clearInteriorAccess(); return; }
    if (!pee().isPlayerInside()) { clearInteriorAccess(); return; }
    if (interiorAccessRequiresMapPixelMatch(wagonState.InteriorAccessMode) && !isWagonAtPlayerMapPixel()) { clearInteriorAccess(); return; }
    let valid = false;
    if (pee().isPlayerInsideBuilding() && wagonState.InteriorAccessMode === INTERIOR_ACCESS.Building) valid = (pee().buildingKey() | 0) === wagonState.InteriorAccessId;
    else if (pee().isPlayerInsideDungeon() && wagonState.InteriorAccessMode === INTERIOR_ACCESS.Dungeon && pee().dungeonId() != null) valid = (pee().dungeonId() | 0) === wagonState.InteriorAccessId;
    if (!valid) clearInteriorAccess();
  }

  // ── the wagon's storage [IL_a3e8-IL_a6a3]
  function canAccessWagonInventoryCore() {
    let denial = HCC_TEXT.notAccessibleFromHere;
    if (!ready() || !tm().hasCart()) return { ok: false, denial };
    if (!physicalPersistenceEnabled) return { ok: isWagonInventoryAccessible(false, true, false), denial };
    if (wagonState.Mode === WAGON_MODE.None) return { ok: false, denial };
    if (!pee().isPlayerInside()) {
      if (wagonState.Mode === WAGON_MODE.WithPlayer) return { ok: true, denial };
      const w = tryGetPhysicalWagonScene();
      if (w) {
        let pos = w.anchor;
        const gp = deployedVisual?.tryGetGroundedPose();
        if (gp) pos = gp.position;
        else if (isTeamFollowing() && wagonVisual && wagonActive()) pos = wagonPosition();
        if (isWithinHorizontalDistance(playerPosition(), pos, WAGON_INVENTORY_DISTANCE)) return { ok: true, denial };
      }
      return { ok: false, denial: HCC_TEXT.within5m };
    }
    if (pee().isPlayerInsideDungeon()) return { ok: false, denial: HCC_TEXT.dungeonExitAccess };
    if (wagonState.Mode !== WAGON_MODE.Deployed && !isTeamFollowing()) return { ok: false, denial };
    if (pee().isPlayerInsideBuilding() && wagonState.InteriorAccessMode === INTERIOR_ACCESS.Building && (pee().buildingKey() | 0) === wagonState.InteriorAccessId && isWagonAtPlayerMapPixel()) return { ok: true, denial };
    return { ok: false, denial };
  }
  function canAccessWagonFromDungeonExitCore() {
    const denial = HCC_TEXT.tooFarFromEntrance;
    if (!ready()) return { ok: false, denial };
    const entranceMatch = (wagonState.Mode === WAGON_MODE.Deployed || isTeamFollowing()) && wagonState.InteriorAccessMode === INTERIOR_ACCESS.Dungeon && pee().dungeonId() != null && (pee().dungeonId() | 0) === wagonState.InteriorAccessId;
    return { ok: isDungeonExitWagonAccessAllowed(physicalPersistenceEnabled, tm().hasCart(), pee().isPlayerInsideDungeon(), entranceMatch), denial };
  }
  function canAccessWagonStorage(ctx) {
    let r;
    if (ctx === STORAGE_CONTEXT.NormalInventory || ctx === STORAGE_CONTEXT.Trade) r = canAccessWagonInventoryCore();
    else if (ctx === STORAGE_CONTEXT.DungeonExitSelection) r = canAccessWagonFromDungeonExitCore();
    else return deny(HCC_TEXT.unknownStorageContext);
    return r.ok ? allow() : deny(r.denial);
  }
  const canAccessWagonInventory = () => canAccessWagonStorage(STORAGE_CONTEXT.NormalInventory);
  const canAccessWagonFromDungeonExit = () => canAccessWagonStorage(STORAGE_CONTEXT.DungeonExitSelection);
  function consumeWagonSelectionRequest() { const r = selectWagonOnNextInventoryOpen; selectWagonOnNextInventoryOpen = false; return r; }
  function openWagonInventoryFromPhysicalActivation() { selectWagonOnNextInventoryOpen = true; deps.openInventoryWithWagon?.(); }

  // ── the horse's name [IL_8644-IL_87dc]
  function refreshHorseNameInputState() { if (horseNameInputBox && !horseNameInputBox.isOpen()) horseNameInputBox = null; }
  function openHorseNamePrompt() {
    refreshHorseNameInputState();
    if (horseNameInputBox) return;
    const box = deps.openNamePrompt?.({
      label: HCC_TEXT.nameYourHorse, value: horseName(), maxCharacters: HORSE_NAME_MAX,
      onSubmit: (input) => {
        if (horseNameInputBox === box) horseNameInputBox = null;
        const resolved = resolveHorseNameInput(horseName(), input);
        if (!ready() || !tm().hasHorse()) return;
        wagonState.HorseName = resolved; changed();
      },
    });
    horseNameInputBox = box ?? null;
  }
  function closeHorseNameInput() { if (!horseNameInputBox) return; const box = horseNameInputBox; horseNameInputBox = null; box.close?.(); }

  // ── the activations [IL_8828-IL_8bfb]
  // ACT-MENU: `mode` is the plaque row's (horseCartLaw.js hccActionRows) when the player chose a verb there, else the
  // interaction mode the mod has always read - so the one handler serves both doors and says the same refusals.
  function handleDeployedWagonActivation(distance, mode = null) {
    if (!physicalPersistenceEnabled) return false;
    if (!ready() || wagonState.Mode !== WAGON_MODE.Deployed || !deployedVisual) return false;
    if (distance > ACTIVATION_REACH) { tooFar(); return true; }
    if (!tm().hasCart()) { say(HCC_TEXT.noLongerOwnWagon); return true; }
    if (pee().isPlayerInside()) return true;
    if ((mode ?? deps.activateMode()) === ACTIVATE_MODE.Steal) { openWagonInventoryFromPhysicalActivation(); return true; }
    if (!tm().hasHorse()) { say(HCC_TEXT.needHorseToPull); return true; }
    if (isHorseFollowing()) {
      if (!isHorseCloseEnoughToHitch()) { say(`${horseSubject(true)} is too far from the wagon to hitch.`); return true; }
      hitchDeployedWagon(); return true;
    }
    if (wagonState.HorseMode === HORSE_MODE.LooseStationary) { say(`Ride ${horseObject()} to the wagon first.`); return true; }
    if (wagonState.HorseMode === HORSE_MODE.WithPlayer && tm().get() !== TRANSPORT.Horse) { say(`Mount ${horseObject()} first.`); return true; }
    hitchDeployedWagon();
    return true;
  }
  function handleFollowingWagonActivation(distance, mode = null) {
    if (!physicalPersistenceEnabled) return false;
    if (!ready() || !isTeamFollowing() || !wagonVisual?.interaction) return false;
    if (distance > ACTIVATION_REACH) { tooFar(); return true; }
    if (!tm().hasCart() || !tm().hasHorse()) { say(HCC_TEXT.noLongerOwnTeam); return true; }
    if ((mode ?? deps.activateMode()) === ACTIVATE_MODE.Steal) { openWagonInventoryFromPhysicalActivation(); return true; }
    if (!canMountNearbyDeployedCart()) { say(`${horseAndWagonSubject(true)} must both be close enough.`); return true; }
    hitchDeployedWagon();
    return true;
  }
  function handleStationaryHorseActivation(distance, modeOverride = null) {
    if (!physicalPersistenceEnabled) return false;
    if (!ready() || !stationaryHorseVisual) return false;
    if (distance > ACTIVATION_REACH) { tooFar(); return true; }
    if (!tm().hasHorse()) { say(HCC_TEXT.noLongerOwnHorse); return true; }
    if (pee().isPlayerInside()) return true;
    const mode = modeOverride ?? deps.activateMode();
    if (isHorseNamingMode(mode)) { openHorseNamePrompt(); return true; }
    const decision = resolveHorseActivation(wagonState.Mode, wagonState.HorseMode, tm().hasCart(), isHorseCommandMode(mode));
    switch (decision) {
      case HORSE_ACTIVATION.Follow: startFollowingHorse(); return true;
      case HORSE_ACTIVATION.Wait: stopFollowingHorse(); return true;
      case HORSE_ACTIVATION.FollowHitchedTeam: startFollowingHitchedTeam(); return true;
      case HORSE_ACTIVATION.MountHitchedTeam: hitchDeployedWagon(); return true;
      case HORSE_ACTIVATION.Ride: beginRidingHorse(); return true;
      default: say(`This is ${horseObject()}.`); return true;
    }
  }
  /** ACT-MENU: the plaque's rows over one of my three activators (hccActionRows), off the state the press will read. */
  function actionRows(target) {
    if (!physicalPersistenceEnabled || !ready()) return [];
    return hccActionRows(target, { wagonMode: wagonState.Mode, horseMode: wagonState.HorseMode, ownsCart: tm().hasCart() });
  }
  function startFollowingHorse() {
    const pose = stationaryHorseVisual?.tryGetGroundedPose();
    if (!pose) { say(`${horseSubject(true)} is not ready to move yet.`); return; }
    const [wx, wz] = toWorld(pose.position);
    setHorseFollowing(wx, wz, pose.forward);
    const m = movement(); horseFollower.begin(phys, pose.position, pose.forward, m.position, m.forward);
    say(`${horseSubject(true)} follows you.`);
  }
  function stopFollowingHorse() {
    if (isTeamFollowing()) { stopFollowingHitchedTeam(); return; }
    const pose = stationaryHorseVisual?.tryGetGroundedPose();
    if (!pose) { say(`${horseSubject(true)} is not ready to wait yet.`); return; }
    const [wx, wz] = toWorld(pose.position);
    setHorseLoose(wx, wz, pose.forward);
    horseFollower.resetTransient();
    stationaryHorseVisual.tick(pose.position, pose.forward, null, now());
    say(`${horseSubject(true)} waits here.`);
  }
  function startFollowingHitchedTeam() {
    const hp = stationaryHorseVisual?.tryGetGroundedPose(), wp = deployedVisual?.tryGetGroundedPose();
    if (!hp || !wp) { say(`${horseAndWagonSubject(true)} are not ready to move yet.`); return; }
    [wagonState.WorldX, wagonState.WorldZ] = toWorld(wp.position);
    [wagonState.HorseWorldX, wagonState.HorseWorldZ] = toWorld(hp.position);
    const wf = horizontalForward(wp.forward), hf = horizontalForward(hp.forward);
    wagonState.Version = WAGON_SAVE_VERSION; wagonState.Mode = WAGON_MODE.FollowingPlayer; wagonState.HeadingX = wf[0]; wagonState.HeadingZ = wf[2];
    wagonState.HorseMode = HORSE_MODE.HitchedToWagon; wagonState.HorseHeadingX = hf[0]; wagonState.HorseHeadingZ = hf[2];
    clearInteriorAccess(); destroyAllStationaryPresentations();
    hitchedWagonPath.clear(); hitchedWagonPathInitialized = false;
    say(`${horseAndWagonSubject(true)} follow you.`);
  }
  function stopFollowingHitchedTeam() {
    const live = tryGetLiveFollowingWagonPose();
    if (!live) { say(HCC_TEXT.wagonNotReadyToWait); return; }
    const [wx, wz] = toWorld(live.position);
    commitDeployment(wx, wz, live.heading, HORSE_MODE.HitchedToWagon);
    horseFollower.resetTransient();
    say(`${horseAndWagonSubject(true)} wait here.`);
  }

  // ── fast travel and Travel Options [IL_9d68-IL_9f33, IL_7ff8, IL_90c4-IL_926a]
  function handlePreFastTravel() {
    if (!physicalPersistenceEnabled) { fastTravelFollowingSuspended = false; pendingFastTravelHorseRelocation = false; return; }
    if (!horseTravelsWithFastTravel(wagonState.Mode, wagonState.HorseMode, true)) return;
    if (!followingTransportFastTravels) { convertFollowingTransportToWaitAtDeparture(); return; }
    const isTeam = isTeamFollowing();
    if (ready()) { cacheFollowingHorseWorldPose(); if (isTeam) cacheFollowingWagonWorldPose(); }
    fastTravelFollowingSuspended = true; pendingFastTravelHorseRelocation = false; horseFollower.resetTransient(); destroyStationaryHorsePresentation();
    if (isTeam) clearMovingPresentation();
  }
  function handlePostFastTravel() {
    if (!physicalPersistenceEnabled) { fastTravelFollowingSuspended = false; pendingFastTravelHorseRelocation = false; return; }
    if (!horseTravelsWithFastTravel(wagonState.Mode, wagonState.HorseMode, followingTransportFastTravels)) { fastTravelFollowingSuspended = false; pendingFastTravelHorseRelocation = false; return; }
    fastTravelFollowingSuspended = true; pendingFastTravelHorseRelocation = true;
  }
  function convertFollowingTransportToWaitAtDeparture() {
    const isTeam = isTeamFollowing();
    if (ready()) { if (isTeam) cacheFollowingWagonWorldPose(); else cacheFollowingHorseWorldPose(); }
    const r = resolveFastTravelDepartureModes(wagonState.Mode, wagonState.HorseMode, false);
    wagonState.Version = WAGON_SAVE_VERSION; wagonState.Mode = r.wagonMode; wagonState.HorseMode = r.horseMode;
    if (isTeam) { wagonState.HorseWorldX = 0; wagonState.HorseWorldZ = 0; wagonState.HorseHeadingX = 0; wagonState.HorseHeadingZ = 1; }
    clearInteriorAccess(); followingTransitionSuspended = false; fastTravelFollowingSuspended = false; pendingFastTravelHorseRelocation = false; hasMovingWorldPose = false;
    horseFollower.resetTransient(); destroyStationaryHorsePresentation();
    if (isTeam) clearMovingPresentation();
  }
  function tryCompleteFastTravelHorseRelocation() {
    if (!pendingFastTravelHorseRelocation) return;
    if (!isHorseFollowing()) { pendingFastTravelHorseRelocation = false; fastTravelFollowingSuspended = false; return; }
    if (pee().isPlayerInside() || tm().isOnShip() || !deps.streaming.isReady() || deps.streaming.isInit()) return;
    const m = movement(); const fwd = horizontalForward(m.forward);
    const grounded = tryFindGround(phys, vsub(m.position, vscale(fwd, horseFollowDistance)));
    if (!grounded) return;
    const [hx, hz] = toWorld(grounded);
    const wasTeam = isTeamFollowing();
    wagonState.HorseWorldX = hx; wagonState.HorseWorldZ = hz; wagonState.HorseHeadingX = fwd[0]; wagonState.HorseHeadingZ = fwd[2];
    if (!wasTeam) wagonState.HorseMode = HORSE_MODE.FollowingPlayer;
    else {
      const wg = tryFindGround(phys, vsub(grounded, vscale(fwd, WAGON_FOLLOW_DISTANCE)));
      if (!wg) return;   // the flags stay set: retried next frame (the mod's own order - the horse fields already written)
      [wagonState.WorldX, wagonState.WorldZ] = toWorld(wg);
      wagonState.HeadingX = fwd[0]; wagonState.HeadingZ = fwd[2];
    }
    wagonState.Version = WAGON_SAVE_VERSION; pendingFastTravelHorseRelocation = false; fastTravelFollowingSuspended = false; destroyStationaryHorsePresentation();
  }
  function updateTravelOptionsCompatibility() {
    if (travelOptionsQueryFailed) return;
    let isActive;
    try { isActive = deps.travelOptionsActive?.(); } catch (e) { travelOptionsQueryFailed = true; log.warn?.(`[TrailingWagon] Travel Options compatibility was disabled after its active-travel query failed: ${e?.message ?? e}`); return; }
    if (isActive === null || isActive === undefined) return;
    if (typeof isActive !== 'boolean') { travelOptionsQueryFailed = true; log.warn?.('[TrailingWagon] Travel Options compatibility was disabled because isTravelActive did not return a Boolean response.'); return; }
    const should = shouldReconcileAfterTravelOptions(travelOptionsWasActive, isActive, physicalPersistenceEnabled, wagonState.Mode, wagonState.HorseMode);
    travelOptionsWasActive = isActive;
    if (!should) return;
    fastTravelFollowingSuspended = true; pendingFastTravelHorseRelocation = true; horseFollower.resetTransient(); destroyStationaryHorsePresentation();
    if (isTeamFollowing()) clearMovingPresentation();
  }

  // ── the presentations, frame by frame [IL_4ff8-IL_5ef9, IL_7990-IL_7d3e]
  function ensureHorseTextures() {
    if (horseTextureLoadAttempted && !deps.presentation?.horseArt?.ensureStationary?.()) return false;
    horseTextureLoadAttempted = true;
    const ok = !!deps.presentation?.horseArt?.ensureStationary?.();
    if (!ok) { if (!horseTextureFailureLogged && deps.presentation?.horseArt?.failed?.()) { horseTextureFailureLogged = true; log.error?.('[TrailingWagon] stationary horse graphics disabled: the horse art could not be loaded'); } return false; }   // the port's art arrives asynchronously - a load in flight is not a failure (the mod's TryLoad is synchronous and fails once)
    horseTextureFailureLogged = false; return true;
  }
  function ensureHorseWalkTextures() { if (horseWalkTextureLoadAttempted && deps.presentation?.horseArt?.hasWalk?.()) return; horseWalkTextureLoadAttempted = true; deps.presentation?.horseArt?.ensureWalk?.(); }
  function shouldShowMovingWagon() {
    if (!showTrailingWagon) return false;
    const teamOk = physicalPersistenceEnabled ? (wagonState.HorseMode === HORSE_MODE.HitchedToWagon && tm().hasHorse()) : tm().hasCart();
    if (wagonState.Mode !== WAGON_MODE.WithPlayer || !teamOk || tm().get() !== TRANSPORT.Cart || tm().isOnShip() || pee().isPlayerInside()) return false;
    return !deps.fadeInProgress?.();
  }
  function applyGroundedPose(target, pathForward, dt) {
    const next = groundedPoseStep(phys, wagonVisual.pose, target, pathForward, dt);
    if (next.hasLastValid) hasLastValidGroundState = true;
    if (!next.hasLastValid) { wagonVisual.pose = next; resetWheelMotionState(); return; }
    if (!wagonVisual.pose.active) { wagonVisual.pose = next; return; }
    wagonVisual.pose = next;
  }
  function updateWheelAnimation() {
    if (!wagonVisual || !wagonActive() || !wagonVisual.parts) { resetWheelMotionState(); return; }
    const pos = wagonPosition(), fwd = wagonForward();
    const w = wagonVisual.wheel;
    if (!w.has) { w.prevPos = [...pos]; w.prevFwd = [...fwd]; w.has = true; return; }
    const deg = wheelRotationDegrees(signedLongitudinalTravel(vsub(pos, w.prevPos), w.prevFwd, fwd), wagonVisual.parts.wheelRadius);
    w.angle = wrapWheelAngle(w.angle + deg);
    w.prevPos = [...pos]; w.prevFwd = [...fwd];
  }
  function updateCargoFullness(weight, limit) { if (wagonVisual) wagonVisual.cargoTier = cargoTier(weight, limit); }
  /** SeedTrail [IL_5968-IL_59e7] whole: the trail from the player, and EVERYTHING the old one grounded - the ground
   *  state (the pose's own last valid ground, which ApplyGroundedPose reads: AUDIT HCC, the branch audit - a jump left
   *  it standing, so the wagon snapped back to the old ground and a dismount parked it 200 m away), the moving world
   *  pose, the wheels - and the wagon hidden until it grounds again. */
  function seedTrail(playerPos, forward) {
    trail.seed(playerPos, forward);
    hasLastValidGroundState = false; hasMovingWorldPose = false; resetWheelMotionState();
    if (wagonVisual) { wagonVisual.pose.active = false; wagonVisual.pose.hasLastValid = false; }
  }
  function updateMovingPresentation(weight, limit, dt) {
    const m = movement();
    const playerPos = m.position;
    if (!wagonVisual) {
      seedTrail(playerPos, m.forward);
      if (!createWagonVisual()) return;
    }
    updateCargoFullness(weight, limit);
    if (trail.isDiscontinuity(playerPos, wagonVisual ? wagonPosition() : null)) seedTrail(playerPos, m.forward);
    else trail.record(playerPos, m.forward);
    const tp = trail.trailingPoint(playerPos);
    if (!tp) return;
    applyGroundedPose(tp.target, tp.pathForward, dt);
    updateWheelAnimation();
    cacheMovingWorldPose();
  }
  function updateFollowingWagonPresentation(weight, limit, dt) {
    if (followingTransitionSuspended || fastTravelFollowingSuspended || pendingFastTravelHorseRelocation || pee().isPlayerInside() || tm().isOnShip() || !stationaryHorseVisual) { clearMovingPresentation(); return; }
    const horse = stationaryHorseVisual.tryGetGroundedPose();
    if (!horse) { clearMovingPresentation(); return; }
    let wagonSeedPos;
    if (wagonVisual) wagonSeedPos = [...wagonPosition()];
    else { wagonSeedPos = tryGetRelevantSavedWorldScene(wagonState.WorldX, wagonState.WorldZ); if (!wagonSeedPos) { clearMovingPresentation(); return; } }
    if (!wagonVisual) {
      if (now() < nextFollowingWagonSpawnRetryTime) return;
      if (!createWagonVisual()) {
        nextFollowingWagonSpawnRetryTime = now() + DEPLOYED_SPAWN_RETRY_SECONDS;
        if (!followingWagonFailureLogged) { followingWagonFailureLogged = true; log.error?.('[TrailingWagon] hitched-team wagon presentation failed; persistent follow intent was retained.'); }
        return;
      }
      wagonVisual.interaction = true;   // EnsureFollowingWagonInteraction: the trigger box the activator rides
      hasLastValidGroundState = false;
      applyGroundedPose(wagonSeedPos, savedHeading(), dt);
      const trailingSeed = wagonActive() ? [...wagonPosition()] : wagonSeedPos;
      hitchedWagonPath.seedBehind(horse.position, horse.forward, trailingSeed);
      hitchedWagonPathInitialized = true; followingWagonFailureLogged = false; nextFollowingWagonSpawnRetryTime = 0;
    }
    updateCargoFullness(weight, limit);
    const recorded = hitchedWagonPath.record(horse.position, horse.forward);
    if (!recorded || !hitchedWagonPathInitialized) {   // AUDIT HCC (branch audit) [IL_51ef-IL_51f9]: EITHER - a jump Record refused re-seeds from the wagon, not behind the horse's heading
      const trailingSeed = (wagonVisual && wagonActive()) ? [...wagonPosition()] : wagonSeedPos;
      hitchedWagonPath.seedBehind(horse.position, horse.forward, trailingSeed); hitchedWagonPathInitialized = true;
    }
    const behind = hitchedWagonPath.tryGetPointBehind(horse.position, WAGON_FOLLOW_DISTANCE);
    if (!behind) return;
    const wagonTooFar = !!wagonVisual && wagonActive() && horizontalDistance(wagonPosition(), horse.position) > FOLLOWING_TEAM_EMERGENCY_SEPARATION;
    const needsReset = !recorded || (!horseFollower.isCombatEvading && (horseRecoveredThisFrame || wagonTooFar));
    if (needsReset) { wagonVisual.pose.active = false; hasLastValidGroundState = false; wagonVisual.pose.hasLastValid = false; resetWheelMotionState(); hitchedWagonPath.seedBehind(horse.position, horse.forward, behind.target); }
    applyGroundedPose(behind.target, behind.pathForward, dt);
    updateWheelAnimation();
    cacheFollowingWagonWorldPose();
  }
  function updateDeployedPresentation(weight, limit) {
    const d = tryGetRelevantDeployedScene();
    if (!d) { destroyDeployedWagonPresentation(); return; }
    if (deployedVisual && !deployedVisual.isAlive) { deployedVisual.release(); deployedVisual = null; }
    if (!deployedVisual) {
      if (now() < nextDeployedSpawnRetryTime) return;
      try { deployedVisual = new DeployedWagonVisual(deps.presentation?.wagonParts?.() ?? null, d.anchor, d.heading, weight, limit, phys, now()); changed(); }
      catch (e) {
        deployedVisual = null; nextDeployedSpawnRetryTime = now() + DEPLOYED_SPAWN_RETRY_SECONDS;
        if (!deployedSpawnFailureLogged) { deployedSpawnFailureLogged = true; log.error?.(`[TrailingWagon] could not create the deployed wagon presentation: ${e?.message ?? e}`); }
        return;
      }
      deployedSpawnFailureLogged = false; nextDeployedSpawnRetryTime = 0;
    }
    deployedVisual.tick(d.anchor, d.heading, weight, limit, now());
  }
  function updateStationaryHorsePresentation(dt) {
    if (pendingFastTravelHorseRelocation) tryCompleteFastTravelHorseRelocation();
    let pos, fwd, deployedWagon = null;
    if (isHorseFollowing()) {
      if (followingTransitionSuspended || fastTravelFollowingSuspended || pendingFastTravelHorseRelocation) { destroyStationaryHorsePresentation(); return; }
      const s = tryGetFollowingHorseScene();
      if (!s) { destroyStationaryHorsePresentation(); return; }
      pos = s.position; fwd = s.heading;
    } else if (wagonState.HorseMode === HORSE_MODE.LooseStationary) {
      pos = tryGetRelevantSavedWorldScene(wagonState.HorseWorldX, wagonState.HorseWorldZ);
      if (!pos) { destroyStationaryHorsePresentation(); return; }
      fwd = savedHorseHeading();
    } else if (wagonState.HorseMode === HORSE_MODE.HitchedToWagon && wagonState.Mode === WAGON_MODE.Deployed) {
      const d = tryGetRelevantDeployedScene();
      if (!d) { destroyStationaryHorsePresentation(); return; }
      pos = d.anchor; fwd = d.heading;
      const gp = deployedVisual?.tryGetGroundedPose();
      if (gp) { pos = gp.position; fwd = gp.forward; deployedWagon = deployedVisual; }
      pos = vadd(vadd(pos, vscale(horizontalRight(fwd), HITCHED_HORSE_LOCAL_X)), vscale(fwd, HITCHED_HORSE_LOCAL_Z));
    } else { destroyStationaryHorsePresentation(); return; }
    if (!ensureHorseTextures()) { destroyStationaryHorsePresentation(); return; }
    ensureHorseWalkTextures();
    if (stationaryHorseVisual && !stationaryHorseVisual.isAlive) { stationaryHorseVisual.release(); stationaryHorseVisual = null; }
    if (!stationaryHorseVisual) {
      if (now() < nextHorseSpawnRetryTime) return;
      try { stationaryHorseVisual = new StationaryHorseVisual(true, pos, fwd, deployedWagon, phys, now()); changed(); }
      catch (e) {
        stationaryHorseVisual = null; nextHorseSpawnRetryTime = now() + DEPLOYED_SPAWN_RETRY_SECONDS;
        if (!horseSpawnFailureLogged) { horseSpawnFailureLogged = true; log.error?.(`[TrailingWagon] could not create the stationary horse presentation: ${e?.message ?? e}`); }
        return;
      }
      horseSpawnFailureLogged = false; nextHorseSpawnRetryTime = 0;
    }
    if (isHorseFollowing()) { updateFollowingHorse(pos, fwd, dt); }
    else stationaryHorseVisual.tick(pos, fwd, deployedWagon, now());
    stationaryHorseVisual.stepWalk(dt, !!deps.presentation?.horseArt?.hasWalk?.());
  }
  function updateFollowingHorse(savedScenePosition, savedHeading, dt) {
    horseRecoveredThisFrame = false;
    if (!stationaryHorseVisual.isInteractive) { stationaryHorseVisual.tick(savedScenePosition, savedHeading, null, now()); return; }
    const m = movement();
    if (!horseFollower.isInitialized) {
      const pose = stationaryHorseVisual.tryGetGroundedPose();
      if (!pose) return;
      horseFollower.begin(phys, pose.position, pose.forward, m.position, m.forward);
    }
    if (!horseFollower.tick(phys, m, stationaryHorseVisual, horseFollowDistance, avoidCombat, travelOptionsWasActive, dt)) return;
    cacheFollowingHorseWorldPose();
    if (horseFollower.recoveredThisTick) horseRecoveredThisFrame = true;
  }

  // ── LateUpdate [IL_4e60] - the frame
  function lateUpdate(dt) {
    lastDt = dt;
    if (!ready()) { clearPendingTransportModeRefresh(); clearMovingPresentation(); destroyAllStationaryPresentations(); return; }
    refreshHorseNameInputState();
    applyPendingPersistenceWork();
    const ownsCart = tm().hasCart(), ownsHorse = tm().hasHorse();
    reconcileCartOwnership(ownsCart, ownsHorse); reconcileHorseOwnership(ownsHorse);
    observeTransportMode(); updatePendingTransportModeRefresh(); handleConfiguredHotkeys();
    validateInteriorAccessContext(); updateTravelOptionsCompatibility();
    const weight = deps.entity?.wagonWeight?.() ?? 0, limit = deps.entity?.wagonKgLimit?.() ?? 750;
    if (isTeamFollowing()) {
      destroyDeployedWagonPresentation();
      updateStationaryHorsePresentation(dt);
      updateFollowingWagonPresentation(weight, limit, dt);
      return;
    }
    if (wagonState.Mode === WAGON_MODE.Deployed) { clearMovingPresentation(); updateDeployedPresentation(weight, limit); }
    else {
      destroyDeployedWagonPresentation();
      if (!shouldShowMovingWagon()) clearMovingPresentation(); else updateMovingPresentation(weight, limit, dt);
    }
    if (physicalPersistenceEnabled) updateStationaryHorsePresentation(dt); else destroyStationaryHorsePresentation();
  }

  // ── lifecycle [IL_9898, IL_98c0, IL_9354, IL_93ac, IL_a714]
  function clearAllTransientState() {
    closeHorseNameInput(); clearMovingPresentation(); destroyAllStationaryPresentations(); clearPendingInteriorState();
    hasMovingWorldPose = false; hasObservedTransportMode = false; previousTransportMode = TRANSPORT.Foot; lastValidNonCartTransportMode = TRANSPORT.Foot;
    clearPendingTransportModeRefresh(); selectWagonOnNextInventoryOpen = false; followingTransitionSuspended = false; fastTravelFollowingSuspended = false;
    pendingFastTravelHorseRelocation = false; travelOptionsWasActive = false; horseFollower.resetTransient();
  }
  /** FloatingOrigin.OnPositionUpdate's work, by hand: every scene point the machine holds moves with the origin
   *  (the mod's objects are Unity transforms, which the FloatingOrigin shifts; here they are numbers). The saved
   *  record is natives and stands. */
  function rebase(d) {
    if (wagonVisual) {
      const p = wagonVisual.pose;
      p.position = vadd(p.position, d); p.lastValidPosition = vadd(p.lastValidPosition, d);
      if (wagonVisual.wheel.has) wagonVisual.wheel.prevPos = vadd(wagonVisual.wheel.prevPos, d);
    }
    deployedVisual?.offset(d); stationaryHorseVisual?.offset(d);
    trail.offset(d); hitchedWagonPath.offset(d); horseFollower.offset(d);
  }
  function handleStartLoad() { wagonState = newSaveData(); clearAllTransientState(); pendingPersistenceNormalization = !physicalPersistenceEnabled; }
  function handleNewGame() { wagonState = newSaveData(); clearAllTransientState(); pendingPersistenceNormalization = !physicalPersistenceEnabled; }
  function getSaveData() {
    if (!physicalPersistenceEnabled && ready()) applyPersistenceResolution(disabledResolution(), true);
    return copySaveData(wagonState);
  }
  function restoreSaveData(data) { clearAllTransientState(); wagonState = normalizeSaveData(data, ratio()); pendingPersistenceNormalization = !physicalPersistenceEnabled; changed(); }
  /** AUDIT HCC H4: the port's LIVE switch turned off (no IL twin - DFU loads a mod or does not). A mod not loaded
   *  observes nothing, so the machine drops every transient it holds - the presentations, the transport mode it last
   *  saw, the pending work - and keeps its record (the save still carries it). Turned back on, it starts observing
   *  afresh, as a mod loaded into a running game would: what the classic transport window did meanwhile is the
   *  state it finds, not a change it rejects. */
  function suspend() { clearAllTransientState(); }

  return {
    lateUpdate, rebase, handleSettingsChanged,
    handleStartLoad, handleNewGame, getSaveData, restoreSaveData, newSaveData, suspend,
    handlePreTransition, handleSuccessfulInteriorTransition, handleFailedTransition, handleExteriorTransition,
    handlePreFastTravel, handlePostFastTravel,
    canUseTransport, tryUseTransport, canMountHorseFromTransportWindow, canUseCartFromTransportWindow,
    handleHorseTransportButton: () => { tryUseTransport(TRANSPORT.Horse); }, handleCartTransportButton: () => { tryUseTransport(TRANSPORT.Cart); },
    handleQuickMountOrDismount, handleSummonTransport,
    canAccessWagonStorage, canAccessWagonInventory, canAccessWagonFromDungeonExit, consumeWagonSelectionRequest,
    handleDeployedWagonActivation, handleFollowingWagonActivation, handleStationaryHorseActivation, openHorseNamePrompt, actionRows,
    ownsStationaryHorseActivator,
    get physicalPersistenceEnabled() { return physicalPersistenceEnabled; },
    get horseName() { return horseName(); }, get hasHorseName() { return hasHorseName(); }, get horseTargetLabel() { return horseTargetLabel(wagonState.HorseName); },
    get horseFollowDistance() { return horseFollowDistance; }, get showTrailingWagon() { return showTrailingWagon; },
    horseSubject, horseAndWagonSubject,
    /** The presentation's view of the machine - what the pool draws and races. */
    view: () => ({
      state: wagonState, moving: wagonVisual, deployed: deployedVisual, horse: stationaryHorseVisual,
      teamFollowing: isTeamFollowing(), horseFollowing: isHorseFollowing(), persistence: physicalPersistenceEnabled,
    }),
    // exposed for the pins
    _state: () => wagonState, _follower: () => horseFollower, _trail: () => trail,
  };
}
