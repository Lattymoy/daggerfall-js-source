// @ts-check
// HORSE CART AND CARGO - THE LAW (HCC, 2026-09-23, Mac: "Next mod I want to implement 1 to 1 and also enhance its
// online integration functionality").
//
// demifiend000's Horse Cart and Cargo 1.0.0-rc12 for Daggerfall Unity, read off the shipped assembly's IL
// (vendor/horse-cart-and-cargo/il/TrailingWagon.il.txt, `tools/ilDump.py`), every function below naming the method
// it restates and the IL offset it was read at. This file is the PURE half of `TrailingWagonRuntime` and its
// companions: the enums and constants, the save record and its normalisation, the persistence-setting resolutions,
// the availability predicates, the transport and activation decisions, the interior-entry law, the scene/world
// coordinate conversions, the text, the horse's billboard arithmetic, the wheel's, the cargo tiers. Nothing here
// touches a scene: `systems/horseCart.js` is the runtime that holds the state and drives the hosts, and
// `scenes/horseCartPool.js` is the presentation. What DFU says and does is written beside each function; what the
// port does differently is marked DEPARTURE and recorded in bible/06-Systems/Horse-Cart-And-Cargo.md.
//
// Unity's `Mathf.Epsilon` is the denormal 1.4e-45, so `x <= Mathf.Epsilon` is `x <= 0` for every normal float
// (the reader's note 6); it is kept as a named constant so the comparisons read as the IL's.

// ─── ENUMS (the numeric values as compiled - confirmed from the IL's own comparisons) ───────────────────────────

/** WagonLocationMode [runtime-state §0]. */
/** @type {Readonly<Record<string, number>>} */
export const WAGON_MODE = Object.freeze({ None: 0, WithPlayer: 1, Deployed: 2, FollowingPlayer: 3 });
/** HorseMode [§0]. */
/** @type {Readonly<Record<string, number>>} */
export const HORSE_MODE = Object.freeze({ HitchedToWagon: 0, LooseStationary: 1, WithPlayer: 2, None: 3, FollowingPlayer: 4 });
/** WagonInteriorAccessMode [§0]. */
/** @type {Readonly<Record<string, number>>} */
export const INTERIOR_ACCESS = Object.freeze({ None: 0, Building: 1, Dungeon: 2 });
/** LastMountMode [§0]. */
/** @type {Readonly<Record<string, number>>} */
export const LAST_MOUNT = Object.freeze({ None: 0, Horse: 1, Cart: 2 });
/** HorseCartStorageContext [§0]. */
/** @type {Readonly<Record<string, number>>} */
export const STORAGE_CONTEXT = Object.freeze({ NormalInventory: 0, Trade: 1, DungeonExitSelection: 2 });
/** HorseActivationDecision [§0]. */
/** @type {Readonly<Record<string, number>>} */
export const HORSE_ACTIVATION = Object.freeze({ None: 0, Ride: 1, Follow: 2, Wait: 3, FollowHitchedTeam: 4, MountHitchedTeam: 5 });
/** DFU TransportModes, by the port's own names (systems/transport.js TRANSPORT_MODES) - the mod compares the
 *  numbers Foot=0, Horse=1, Cart=2, Ship=3; the port carries the strings and this table is the bridge. */
/** @type {Readonly<Record<string, string>>} */
export const TRANSPORT = Object.freeze({ Foot: 'Foot', Horse: 'Horse', Cart: 'Cart', Ship: 'Ship' });
/** DFU PlayerActivateModes, by the port's interactionMode.js words: Steal=0 'steal', Grab=1 'grab', Info=2 'info',
 *  Talk=3 'dialogue'. */
/** @type {Readonly<Record<string, string>>} */
export const ACTIVATE_MODE = Object.freeze({ Steal: 'steal', Grab: 'grab', Info: 'info', Talk: 'dialogue' });

export const MATHF_EPSILON = 1.401298e-45;

// ─── CONSTANTS (TrailingWagonRuntime's consts, inlined at every use site - the reader's table) ─────────────────

export const LOG_PREFIX = '[TrailingWagon]';
export const WAGON_MODEL_ID = 41214;
export const HORSE_NAME_MAX = 31;
export const WAGON_FOLLOW_DISTANCE = 2.5;
export const SAMPLE_DISTANCE = 0.08;
export const RETAINED_TRAIL_DISTANCE = 7.0;
export const TELEPORT_DISTANCE = 20.0;
export const MAXIMUM_VISUAL_DISTANCE = 30.0;
export const GROUND_RAY_HEIGHT = 8.0;
export const GROUND_RAY_DISTANCE = 40.0;
export const NORMAL_GROUND_OFFSET = 1.0;
export const POSITION_SMOOTHING_RATE = 12.0;
export const ROTATION_SMOOTHING_RATE = 10.0;
export const WHEEL_ROTATION_SIGN = 1.0;
export const DEPLOYED_SPAWN_RETRY_SECONDS = 2.0;
export const DIRECT_CART_AUDIO_REFRESH_DELAY = 0.25;
export const HORSE_MENU_MOUNT_DISTANCE = 3.5;
export const HORSE_WAGON_HITCH_DISTANCE = 3.5;
export const FOLLOWING_TEAM_EMERGENCY_SEPARATION = 15.0;
export const WAGON_INVENTORY_DISTANCE = 5.0;
export const DEFAULT_HORSE_FOLLOW_DISTANCE = 3.0, MIN_HORSE_FOLLOW_DISTANCE = 2.0, MAX_HORSE_FOLLOW_DISTANCE = 8.0;
export const DEFAULT_INTERIOR_ACCESS_DISTANCE = 50.0, MIN_INTERIOR_ACCESS_DISTANCE = 10.0, MAX_INTERIOR_ACCESS_DISTANCE = 100.0;
export const HORSE_DISMOUNT_REAR_OFFSET = 1.0;
export const HITCHED_HORSE_LOCAL_X = 0.0, HITCHED_HORSE_LOCAL_Z = 3.1;
export const LEGACY_LOOSE_HORSE_LOCAL_X = 3.0, LEGACY_LOOSE_HORSE_LOCAL_Z = 0.0;
/** The activation reach every physical activation tests (`hit.distance > 3.2`, an inline literal). */
export const ACTIVATION_REACH = 3.2;
/** The unnamed 3.7 of IsUsableDungeonEntranceDoorPosition [IL_4e47]. */
export const DUNGEON_DOOR_USABLE_RADIUS = 3.7;
/** WagonSaveData.CurrentVersion. */
export const WAGON_SAVE_VERSION = 7;
/** The mid-screen "too far" text's seconds. */
export const TOO_FAR_SECONDS = 1.5;
/** The horse trigger box (StationaryHorseVisual.Initialize [IL_41cb-IL_41f8]) and the billboard's size. */
export const HORSE_BOX_CENTER = Object.freeze([0, 1.1, 0]);
export const HORSE_BOX_SIZE = Object.freeze([1.1, 2.2, 2.6]);
export const HORSE_SPRITE_WIDTH = 121, HORSE_SPRITE_HEIGHT = 94, HORSE_WALK_SPRITE_HEIGHT = 95;
export const HORSE_VIEWS = 5, HORSE_WALK_FRAMES = 8;
/** GroundProbeHeight/Distance of the two stationary presentations (1000 up, 3000 down) and their retry second. */
export const STATIONARY_PROBE_HEIGHT = 1000, STATIONARY_PROBE_DISTANCE = 3000, GROUND_RETRY_SECONDS = 1.0;
/** StationaryHorseVisual's pose tolerances (Tick [IL_3d32-IL_3d4f]): 1e-4 squared metres, 0.1 degrees. */
export const POSE_POSITION_TOLERANCE_SQ = 1e-4, POSE_ANGLE_TOLERANCE_DEG = 0.1;

// ─── VECTORS ───────────────────────────────────────────────────────────────────────────────────────────────────

export const V_FORWARD = Object.freeze([0, 0, 1]);
export const V_ZERO = Object.freeze([0, 0, 0]);
const sqrMag = (v) => v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
const normalized = (v) => { const l = Math.sqrt(sqrMag(v)); return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]; };
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const vdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export { sqrMag as vsqr, normalized as vnorm };

/** GetHorizontalForward [IL_60c0]: the forward projected on the ground plane, or +Z when it has no length. */
export function horizontalForward(v) {
  const p = [v[0], 0, v[2]];
  if (sqrMag(p) <= MATHF_EPSILON) return [...V_FORWARD];
  return normalized(p);
}
/** GetHorizontalRight [IL_7656]: (f.z, 0, -f.x) of the horizontal forward. */
export function horizontalRight(forward) {
  const f = horizontalForward(forward);
  return [f[2], 0, -f[0]];
}
/** HorizontalDistance [IL_7684]. */
export const horizontalDistance = (a, b) => Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[2] - b[2]) * (a[2] - b[2]));
/** IsWithinHorizontalDistance [IL_76ac]: a negative (or NaN) maximum is never within; a NaN distance is not within. */
export function isWithinHorizontalDistance(a, b, max) {
  if (!(max >= 0)) return false;
  return !(horizontalDistance(a, b) > max) && Number.isFinite(horizontalDistance(a, b));
}
/** NormalizeHeading [IL_9640]: NaN/Infinity in x or z, or no length (y included), reads +Z. */
export function normalizeHeading(h) {
  if (!Number.isFinite(h[0]) || !Number.isFinite(h[2])) return [...V_FORWARD];
  if (sqrMag(h) <= MATHF_EPSILON) return [...V_FORWARD];
  return normalized(h);
}
/** Vector3.Angle in degrees. */
export function angleBetween(a, b) {
  const d = Math.sqrt(sqrMag(a) * sqrMag(b));
  if (!(d > 1e-15)) return 0;
  return Math.acos(Math.max(-1, Math.min(1, vdot(a, b) / d))) * 180 / Math.PI;
}

// ─── SCENE <-> WORLD (the mod's own conversions, over DFU's StreamingWorld.SceneMapRatio) ──────────────────────

/** CastWorldCoordinate [IL_8556]: NaN throws; beyond int32 saturates; else truncation toward zero. */
export function castWorldCoordinate(v) {
  if (Number.isNaN(v)) throw new RangeError('value');
  if (v > 2147483647) return 2147483647;
  if (v < -2147483648) return -2147483648;
  return Math.trunc(v);
}
const ratioGuard = (r) => { if (!(r > 0) || !Number.isFinite(r)) throw new RangeError('sceneMapRatio'); };
/** ConvertSceneToWorld [IL_8494]: the scene offset from the player, scaled by the ratio, on the player's native coordinates. */
export function sceneToWorld(scenePos, playerScenePos, playerWorldX, playerWorldZ, ratio) {
  ratioGuard(ratio);
  const dx = (scenePos[0] - playerScenePos[0]) * ratio, dz = (scenePos[2] - playerScenePos[2]) * ratio;
  return [castWorldCoordinate(playerWorldX + dx), castWorldCoordinate(playerWorldZ + dz)];
}
/** ConvertWorldToScene [IL_8504]: the native offset from the player, divided by the ratio, on the player's scene x/z. */
export function worldToScene(worldX, worldZ, playerWorldX, playerWorldZ, playerScenePos, ratio) {
  ratioGuard(ratio);
  return [playerScenePos[0] + (worldX - playerWorldX) / ratio, playerScenePos[2] + (worldZ - playerWorldZ) / ratio];
}
/** ApplyLocalOffsetToWorld [IL_7608]: a local (right, forward) offset in scene metres laid on native coordinates; no ratio guard. */
export function applyLocalOffsetToWorld(originX, originZ, forward, localX, localZ, ratio) {
  const f = horizontalForward(forward);
  const r = horizontalRight(f);
  const off = [r[0] * localX + f[0] * localZ, 0, r[2] * localX + f[2] * localZ];
  return [castWorldCoordinate(originX + off[0] * ratio), castWorldCoordinate(originZ + off[2] * ratio)];
}

// ─── THE SAVE RECORD (WagonSaveData) ───────────────────────────────────────────────────────────────────────────

/** WagonSaveData..ctor [IL_c6c3]: Version 7, the headings +Z, the horse None, an empty name. */
export function newSaveData() {
  return {
    Version: WAGON_SAVE_VERSION, Mode: WAGON_MODE.None, WorldX: 0, WorldZ: 0, HeadingX: 0, HeadingZ: 1,
    HorseMode: HORSE_MODE.None, HorseWorldX: 0, HorseWorldZ: 0, HorseHeadingX: 0, HorseHeadingZ: 1,
    InteriorAccessMode: INTERIOR_ACCESS.None, InteriorAccessId: 0, HorseName: '', LastMount: LAST_MOUNT.None,
  };
}
const SAVE_FIELDS = Object.freeze(Object.keys(newSaveData()));
/** WagonSaveData.Copy [IL_c608]: every one of the fifteen fields. */
export function copySaveData(d) {
  const out = newSaveData();
  for (const k of SAVE_FIELDS) if (d && d[k] !== undefined) out[k] = d[k];
  return out;
}
const isEnumValue = (table, v) => Number.isInteger(v) && Object.values(table).includes(v);

/** NormalizeHorseName [IL_95d4]: null reads ""; trimmed; at most 31 characters. */
export function normalizeHorseName(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  return t.length > HORSE_NAME_MAX ? t.slice(0, HORSE_NAME_MAX) : t;
}
/** ResolveHorseNameInput [IL_9608]: an empty entry keeps the current name. */
export function resolveHorseNameInput(current, input) {
  const n = normalizeHorseName(input);
  return n ? n : normalizeHorseName(current);
}
/** ReconcileHorseNameOwnership [IL_9621]: no horse, no name. */
export const reconcileHorseNameOwnership = (name, hasHorse) => (hasHorse ? normalizeHorseName(name) : '');

/** NormalizeSaveData [IL_93e4]: a loaded record made whole - unknown enum values to None, the headings unit, the
 *  version-1 and version-2 migrations (a loose horse of version 2 stood 3 m to the wagon's right in the wagon's
 *  frame), the interior access dropped unless the wagon is deployed or following, a following wagon with no hitched
 *  horse read as deployed. `ratio` is StreamingWorld.SceneMapRatio, for the version-2 offset. */
export function normalizeSaveData(source, ratio) {
  const d = source ? copySaveData(source) : newSaveData();
  const version = d.Version;
  d.HorseName = normalizeHorseName(d.HorseName);
  if (!isEnumValue(WAGON_MODE, d.Mode)) d.Mode = WAGON_MODE.None;                       // [IL_9427]
  if (!isEnumValue(HORSE_MODE, d.HorseMode)) d.HorseMode = HORSE_MODE.None;             // [IL_944a]
  if (!isEnumValue(LAST_MOUNT, d.LastMount)) d.LastMount = LAST_MOUNT.None;             // [IL_946d]
  if (!isEnumValue(INTERIOR_ACCESS, d.InteriorAccessMode)) { d.InteriorAccessMode = INTERIOR_ACCESS.None; d.InteriorAccessId = 0; }   // [IL_9490]
  const heading = normalizeHeading([Number(d.HeadingX) || 0, 0, Number(d.HeadingZ) || 0]);
  d.HeadingX = heading[0]; d.HeadingZ = heading[2];
  if (!(version >= 2)) {                                                                 // [IL_94d6] version < 2 (a missing one too)
    d.HorseMode = d.Mode === WAGON_MODE.Deployed ? HORSE_MODE.HitchedToWagon : HORSE_MODE.WithPlayer;   // [IL_94e0-IL_94e6]
  } else if (version === 2) {                                                            // [IL_94ef]
    if (d.HorseMode === HORSE_MODE.LooseStationary) {                                    // [IL_94f8]
      const [hx, hz] = applyLocalOffsetToWorld(d.WorldX | 0, d.WorldZ | 0, heading, LEGACY_LOOSE_HORSE_LOCAL_X, LEGACY_LOOSE_HORSE_LOCAL_Z, ratio);   // [IL_9522]
      d.HorseWorldX = hx; d.HorseWorldZ = hz; d.HorseHeadingX = heading[0]; d.HorseHeadingZ = heading[2];
    } else if (d.Mode !== WAGON_MODE.Deployed) d.HorseMode = HORSE_MODE.WithPlayer;     // [IL_9548]
  }
  const hh = normalizeHeading([Number(d.HorseHeadingX) || 0, 0, Number(d.HorseHeadingZ) || 0]);   // [IL_9567]
  d.HorseHeadingX = hh[0]; d.HorseHeadingZ = hh[2];
  if (d.Mode !== WAGON_MODE.Deployed && d.Mode !== WAGON_MODE.FollowingPlayer) { d.InteriorAccessMode = INTERIOR_ACCESS.None; d.InteriorAccessId = 0; }   // [IL_958c-IL_9595]
  if (d.Mode === WAGON_MODE.FollowingPlayer && d.HorseMode !== HORSE_MODE.HitchedToWagon) d.Mode = WAGON_MODE.Deployed;   // [IL_95ac-IL_95b4]
  for (const k of ['WorldX', 'WorldZ', 'HorseWorldX', 'HorseWorldZ', 'InteriorAccessId']) d[k] = Number.isFinite(d[k]) ? Math.trunc(d[k]) : 0;
  d.Version = WAGON_SAVE_VERSION;
  return d;
}

// ─── THE PERSISTENCE-SETTING RESOLUTIONS AND THE PREDICATES ───────────────────────────────────────────────────

/** ResolvePersistenceDisabledState [IL_4ce8]: with the setting off the pair are always with the player, and a
 *  mount whose animal is not owned reads Foot. */
export function resolvePersistenceDisabledState(mode, hasCart, hasHorse) {
  let m = mode;
  if ((m === TRANSPORT.Horse && !hasHorse) || (m === TRANSPORT.Cart && !hasCart)) m = TRANSPORT.Foot;   // [IL_4cea-IL_4cf7]
  return { WagonMode: hasCart ? WAGON_MODE.WithPlayer : WAGON_MODE.None, HorseMode: hasHorse ? HORSE_MODE.WithPlayer : HORSE_MODE.None, TransportMode: m, RequiresHorseMessage: false };
}
/** ResolvePersistenceEnabledState [IL_4d34]: turning the setting on - a cart being ridden needs a horse, which is
 *  then hitched; without one the player is put on foot and told. */
export function resolvePersistenceEnabledState(mode, hasCart, hasHorse) {
  const r = { WagonMode: hasCart ? WAGON_MODE.WithPlayer : WAGON_MODE.None, HorseMode: hasHorse ? HORSE_MODE.WithPlayer : HORSE_MODE.None, TransportMode: mode, RequiresHorseMessage: false };
  if (mode === TRANSPORT.Horse && !hasHorse) r.TransportMode = TRANSPORT.Foot;         // [IL_4d64-IL_4d6c]
  else if (mode === TRANSPORT.Cart) {                                                   // [IL_4d75]
    if (!hasCart) r.TransportMode = TRANSPORT.Foot;                                     // [IL_4d7c]
    else if (hasHorse) r.HorseMode = HORSE_MODE.HitchedToWagon;                         // [IL_4d89]
    else { r.TransportMode = TRANSPORT.Foot; r.RequiresHorseMessage = true; }           // [IL_4d93-IL_4d9c]
  }
  return r;
}
/** IsHorseTransportAvailable [IL_4da4]. */
export const isHorseTransportAvailable = (persistence, hasHorse, horseReachable) => hasHorse && (!persistence || horseReachable);
/** IsCartTransportAvailable [IL_4db1]. */
export const isCartTransportAvailable = (persistence, hasCart, hasHorse, teamReachable) => (!hasCart ? false : !persistence ? true : hasHorse && teamReachable);
/** IsWagonInventoryAccessible [IL_4dc0]. */
export const isWagonInventoryAccessible = (persistence, hasCart, physicallyReachable) => hasCart && (!persistence || physicallyReachable);
/** IsDungeonExitWagonAccessAllowed [IL_4dcd]. */
export const isDungeonExitWagonAccessAllowed = (persistence, hasCart, insideDungeon, entranceMatch) => hasCart && insideDungeon && (!persistence || entranceMatch);
/** InteriorAccessRequiresMapPixelMatch [IL_4ddc]: a building's access needs the wagon on this map pixel; a dungeon's does not. */
export const interiorAccessRequiresMapPixelMatch = (m) => m === INTERIOR_ACCESS.Building;
/** IsUsableDungeonEntranceDoorPosition [IL_4df0]: a finite door within 3.7 m of the player. */
export function isUsableDungeonEntranceDoorPosition(playerPos, doorPos) {
  if (!doorPos || !doorPos.every(Number.isFinite)) return false;
  return horizontalDistance(playerPos, doorPos) <= DUNGEON_DOOR_USABLE_RADIUS;
}
/** IsHitchedTeamFollowing [IL_4fb4]. */
export const isHitchedTeamFollowing = (wagonMode, horseMode) => wagonMode === WAGON_MODE.FollowingPlayer && horseMode === HORSE_MODE.HitchedToWagon;
/** IsAutonomousHorseFollowing [IL_4fc0] over a state record. */
export const isAutonomousHorseFollowing = (s) => s.HorseMode === HORSE_MODE.FollowingPlayer || isHitchedTeamFollowing(s.Mode, s.HorseMode);
/** IsDirectHitchedTeamMount [IL_9033]: the cart is owned and the horse stands hitched to a deployed or following wagon. */
export const isDirectHitchedTeamMount = (wagonMode, horseMode, ownsCart) => ownsCart && (wagonMode === WAGON_MODE.Deployed || wagonMode === WAGON_MODE.FollowingPlayer) && horseMode === HORSE_MODE.HitchedToWagon;
/** IsPhysicalTeamWithinMountDistances [IL_7100]: 5 m to the wagon, 3.5 m to the horse, the horse 3.5 m from the wagon. */
export const isPhysicalTeamWithinMountDistances = (player, wagon, horse) =>
  isWithinHorizontalDistance(player, wagon, WAGON_INVENTORY_DISTANCE) && isWithinHorizontalDistance(player, horse, HORSE_MENU_MOUNT_DISTANCE) && isWithinHorizontalDistance(horse, wagon, HORSE_WAGON_HITCH_DISTANCE);
/** IsPhysicalTransportStateValid [IL_76d0]. */
export function isPhysicalTransportStateValid(hasCart, hasHorse, wm, hm, tmode) {
  if (wm === WAGON_MODE.FollowingPlayer) return hasCart && hasHorse && hm === HORSE_MODE.HitchedToWagon && tmode === TRANSPORT.Foot;   // [IL_76d2-IL_76e3]
  if (!hasHorse) return hm === HORSE_MODE.None && tmode !== TRANSPORT.Horse && tmode !== TRANSPORT.Cart;   // [IL_76e5-IL_76fa]
  if (hm === HORSE_MODE.None) return false;                                              // [IL_76fd-IL_7700]
  if (hm === HORSE_MODE.HitchedToWagon) {                                                // [IL_7702-IL_7714]
    if (!hasCart) return false;
    if (wm !== WAGON_MODE.WithPlayer && wm !== WAGON_MODE.Deployed && wm !== WAGON_MODE.FollowingPlayer) return false;
  }
  if (tmode === TRANSPORT.Cart) return hasCart && hasHorse && wm === WAGON_MODE.WithPlayer && hm === HORSE_MODE.HitchedToWagon;   // [IL_7718-IL_7729]
  if (tmode === TRANSPORT.Horse) return hasHorse && hm === HORSE_MODE.WithPlayer;        // [IL_772d-IL_7738]
  return true;
}
/** CanRefreshDirectCartTransport [IL_679c]. */
export const canRefreshDirectCartTransport = (mode, hasCart, hasHorse, wm, hm) => mode === TRANSPORT.Cart && hasCart && hasHorse && wm === WAGON_MODE.WithPlayer && hm === HORSE_MODE.HitchedToWagon;
/** ResolveQuickMountMode [IL_68cf]: the last mount when it is still owned, else the horse, else the cart. */
export function resolveQuickMountMode(last, hasHorse, hasCart) {
  if (last === LAST_MOUNT.Cart && hasCart) return TRANSPORT.Cart;
  if (last === LAST_MOUNT.Horse && hasHorse) return TRANSPORT.Horse;
  if (hasHorse) return TRANSPORT.Horse;
  if (hasCart) return TRANSPORT.Cart;
  return TRANSPORT.Foot;
}
/** ResolveHorseActivation [IL_9046]: Talk mode commands the horse; any other mode rides (or mounts the team). */
export function resolveHorseActivation(wagonMode, horseMode, ownsCart, talkMode) {
  if (talkMode) {
    if (horseMode === HORSE_MODE.LooseStationary) return HORSE_ACTIVATION.Follow;
    if (horseMode === HORSE_MODE.FollowingPlayer) return HORSE_ACTIVATION.Wait;
    if (isHitchedTeamFollowing(wagonMode, horseMode)) return HORSE_ACTIVATION.Wait;
    if (isDirectHitchedTeamMount(wagonMode, horseMode, ownsCart)) return HORSE_ACTIVATION.FollowHitchedTeam;
    return HORSE_ACTIVATION.None;
  }
  return isDirectHitchedTeamMount(wagonMode, horseMode, ownsCart) ? HORSE_ACTIVATION.MountHitchedTeam : HORSE_ACTIVATION.Ride;
}
/**
 * ACT-MENU (2026-09-23, Mac: "for player interaction and horse interaction, instead of using a keybind toggle, let's
 * reuse the loot scroll menu to select options"): WHAT THE PLAQUE LISTS OVER MY HORSE OR WAGON. The mod picks the verb
 * from DFU's interaction mode (Steal opens the wagon, Info names the horse, Talk commands it, anything else rides) -
 * four keys the player had to set BEFORE the click. On the World Tooltips plaque the verbs are rows instead, the wheel
 * lights one and the activate key presses it: each row carries the MODE the mod reads, so the press runs the mod's
 * own handler in that mode and every refusal, reach test and line stays the mod's. The horse's labels come from the
 * same decision the press makes (ResolveHorseActivation), so its rows name what its click does; a command the horse
 * cannot take here (ResolveHorseActivation's None) is not listed. The wagon's two rows are its two modes whatever the
 * state - the hitch's own refusals (no horse to pull, ride it over first) are said by the handler at the press.
 *
 * `target` is 'horse', 'deployedWagon' or 'followingWagon'.
 * @param {string} target
 * @param {{wagonMode?: number, horseMode?: number, ownsCart?: boolean}} [state]
 * @returns {{id: string, label: string}[]}
 */
export function hccActionRows(target, { wagonMode, horseMode, ownsCart } = {}) {
  // AUDIT DISC7 A10: a team left standing hitched ("Wait here" on a following team) is driven off, not hitched up -
  // the same hitchDeployedWagon the horse's own row calls "Drive the wagon"
  if (target === 'deployedWagon') return [{ id: ACTIVATE_MODE.Grab, label: horseMode === HORSE_MODE.HitchedToWagon ? HCC_ACTION_TEXT.drive : HCC_ACTION_TEXT.hitch }, { id: ACTIVATE_MODE.Steal, label: HCC_ACTION_TEXT.openWagon }];
  if (target === 'followingWagon') return [{ id: ACTIVATE_MODE.Grab, label: HCC_ACTION_TEXT.drive }, { id: ACTIVATE_MODE.Steal, label: HCC_ACTION_TEXT.openWagon }];
  if (target !== 'horse') return [];
  const rows = [];
  const ride = resolveHorseActivation(wagonMode, horseMode, ownsCart, false);
  rows.push({ id: ACTIVATE_MODE.Grab, label: ride === HORSE_ACTIVATION.MountHitchedTeam ? HCC_ACTION_TEXT.drive : HCC_ACTION_TEXT.ride });
  const cmd = resolveHorseActivation(wagonMode, horseMode, ownsCart, true);
  const cmdLabel = cmd === HORSE_ACTIVATION.Follow ? HCC_ACTION_TEXT.follow
    : cmd === HORSE_ACTIVATION.FollowHitchedTeam ? HCC_ACTION_TEXT.followTeam
      : cmd === HORSE_ACTIVATION.Wait ? HCC_ACTION_TEXT.wait : null;
  if (cmdLabel) rows.push({ id: ACTIVATE_MODE.Talk, label: cmdLabel });
  rows.push({ id: ACTIVATE_MODE.Info, label: HCC_ACTION_TEXT.name });
  return rows;
}
/** ACT-MENU: the rows' words - the port's, in the mod's own vocabulary ("follows you", "waits here", the wagon). */
export const HCC_ACTION_TEXT = Object.freeze({
  ride: 'Ride', drive: 'Drive the wagon', hitch: 'Hitch up', openWagon: 'Open the wagon',
  follow: 'Follow me', followTeam: 'Follow me with the wagon', wait: 'Wait here', name: 'Name',
});
/** IsHorseCommandMode [IL_907d] / IsHorseNamingMode [IL_9083]. */
export const isHorseCommandMode = (m) => m === ACTIVATE_MODE.Talk;
export const isHorseNamingMode = (m) => m === ACTIVATE_MODE.Info;
/** ResolveInteriorEntryMode [IL_a294]: the mode the player is in as they go through a door - on foot, the last
 *  observed; a wagon with the player and a horse owned reads Cart when the horse is hitched. */
export function resolveInteriorEntryMode(mode, hasObserved, previous, wagonWithPlayer, hasCart, hasHorse, hm) {
  const resolved = mode !== TRANSPORT.Foot ? mode : (hasObserved ? previous : TRANSPORT.Foot);   // [IL_a295-IL_a2a1]
  if (wagonWithPlayer && hasCart && hasHorse) {                                          // [IL_a2a9]
    if (resolved === TRANSPORT.Cart) return TRANSPORT.Cart;
    if (hm === HORSE_MODE.HitchedToWagon) return TRANSPORT.Cart;
  }
  return resolved;
}
/** IsCartInteriorDeployment [IL_a2b8] / ShouldDeployIndependentHorseForInterior [IL_a2c3]. */
export const isCartInteriorDeployment = (hasPendingWagon, entryMode) => hasPendingWagon && entryMode === TRANSPORT.Cart;
export const shouldDeployIndependentHorseForInterior = (hasPendingWagon, entryMode, hm, hasHorse) => hasHorse && hm === HORSE_MODE.WithPlayer && !isCartInteriorDeployment(hasPendingWagon, entryMode);
/** HorseTravelsWithFastTravel [IL_9089] / ResolveFastTravelDepartureModes [IL_929b] / ShouldReconcileAfterTravelOptions [IL_909d]. */
export const horseTravelsWithFastTravel = (wm, hm, followingTravels) => followingTravels && (hm === HORSE_MODE.FollowingPlayer || isHitchedTeamFollowing(wm, hm));
export function resolveFastTravelDepartureModes(wm, hm, travels) {
  if (travels) return { wagonMode: wm, horseMode: hm };
  if (isHitchedTeamFollowing(wm, hm)) return { wagonMode: WAGON_MODE.Deployed, horseMode: hm };
  if (hm === HORSE_MODE.FollowingPlayer) return { wagonMode: wm, horseMode: HORSE_MODE.LooseStationary };
  return { wagonMode: wm, horseMode: hm };
}
export const shouldReconcileAfterTravelOptions = (wasActive, isActive, persistence, wm, hm) => wasActive && !isActive && persistence && horseTravelsWithFastTravel(wm, hm, true);
/** ShouldMigrateLegacySaveFile [IL_470d]. */
export const shouldMigrateLegacySaveFile = (legacyExists, canonicalExists) => legacyExists && !canonicalExists;

/** ClampHorseFollowDistance [IL_4a1b] / ClampInteriorWagonAccessDistance [IL_4a2d] / IsWithinInteriorEntranceDistance [IL_4a3f]. */
export const clampHorseFollowDistance = (v) => Math.max(MIN_HORSE_FOLLOW_DISTANCE, Math.min(MAX_HORSE_FOLLOW_DISTANCE, Number(v) || 0));
export const clampInteriorWagonAccessDistance = (v) => Math.max(MIN_INTERIOR_ACCESS_DISTANCE, Math.min(MAX_INTERIOR_ACCESS_DISTANCE, Number(v) || 0));
export const isWithinInteriorEntranceDistance = (distance, configured) => !(distance > clampInteriorWagonAccessDistance(configured)) && !Number.isNaN(distance);

// ─── TEXT ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** FormatHorseSubject [IL_85bc] / FormatHorseAndWagonSubject [IL_85e8]. */
export function formatHorseSubject(name, sentenceStart) {
  const n = normalizeHorseName(name);
  return n ? n : (sentenceStart ? 'Your horse' : 'your horse');
}
export function formatHorseAndWagonSubject(name, sentenceStart) {
  const n = normalizeHorseName(name);
  return n ? `${n} and your wagon` : (sentenceStart ? 'Your horse and wagon' : 'your horse and wagon');
}
/** HorseTargetLabel [IL_4570]: the tooltip over the horse. */
export const horseTargetLabel = (name) => (normalizeHorseName(name) ? normalizeHorseName(name) : 'Horse');
/** The mod's HUD lines, verbatim from its string table. */
export const HCC_TEXT = Object.freeze({
  noLongerOwnHorse: 'You no longer own a horse.',
  noLongerOwnWagon: 'You no longer own a wagon.',
  noLongerOwnTeam: 'You no longer own this horse-and-wagon team.',
  needHorseToPull: 'You need a horse to pull the wagon.',
  needHorseWhilePersistence: 'You need a horse to pull the wagon while physical persistence is enabled.',
  notAccessibleFromHere: 'Your wagon is not accessible from here.',
  within5m: 'You must be within 5 metres of your wagon.',
  dungeonExitAccess: 'Access your wagon by activating the dungeon exit with your wagon parked nearby.',
  tooFarFromEntrance: 'Your wagon is too far from the entrance.',
  wagonNotWithYou: 'Your wagon is not with you.',
  wagonAndHorseMustBeWithYou: 'Your wagon and horse must both be with you.',
  wagonNotReadyToUnhitch: 'Your wagon is not ready to unhitch yet.',
  wagonNotReadyToWait: 'Your wagon is not ready to wait yet.',
  doNotOwnHorse: 'You do not own a horse.',
  doNotOwnWagon: 'You do not own a wagon.',
  doNotOwnHorseOrWagon: 'You do not own a horse or wagon.',
  onlyHorseAndCart: 'Only Horse and Cart are supported by Horse Cart and Cargo.',
  onlyHorseAndCartShort: 'Only Horse and Cart are supported.',
  notReady: 'Horse Cart and Cargo is not ready.',
  unknownStorageContext: 'Unknown wagon-storage context.',
  quickMountUnavailable: 'Quick mount is unavailable from this transport mode.',
  mountOutdoorsOnly: 'You can only mount your horse or wagon outdoors.',
  summonOutdoorsOnly: 'You can only summon your horse and wagon outdoors.',
  alreadyWithYou: 'Your owned transport is already with you.',
  summonedBoth: 'Your horse and wagon have been summoned.',
  summonedWagon: 'Your wagon has been summoned.',
  summonedHorse: 'Your horse has been summoned.',
  inventoryUnavailable: 'The inventory window is not available.',
  nameYourHorse: 'Name your horse:',
  horseDefaultLabel: 'Horse',
});

// ─── GROUND SURFACE SELECTION (GroundSurfaceSelection.IsPreferred [IL_1168-IL_11a2]) ──────────────────────────

/** Prefer the hit whose height is closest to the origin's; within a millimetre, the shorter ray. */
export function isPreferredGround(originY, candidateY, candidateDistance, hasBest, bestY, bestDistance) {
  if (!hasBest) return true;
  const dCand = Math.abs(candidateY - originY), dBest = Math.abs(bestY - originY);
  if (dCand < dBest - 0.001) return true;
  if (Math.abs(dCand - dBest) <= 0.001) return candidateDistance < bestDistance;
  return false;
}
/** The reduce every probe runs: over `hits` ({ point, distance, normal }), the preferred one for `referenceY`, or null. */
export function pickGround(hits, referenceY, reject = null) {
  let best = null, bestY = 0, bestDist = Infinity;
  for (const h of hits ?? []) {
    if (!h || !h.point) continue;
    if (reject && reject(h)) continue;
    if (!isPreferredGround(referenceY, h.point[1], h.distance, best !== null, bestY, bestDist)) continue;
    best = h; bestY = h.point[1]; bestDist = h.distance;
  }
  return best;
}

// ─── THE HORSE BILLBOARD'S ARITHMETIC (StationaryHorseBillboard) ───────────────────────────────────────────────

export const ORIENTATION_COUNT = 8, DEGREES_PER_ORIENTATION = 45;
export const BASELINE_FPS = 6, MIN_MOVING_FPS = 4, MAX_MOVING_FPS = 9, IDLE_FPS = 2, IDLE_FRAME_A = 5, IDLE_FRAME_B = 6;
export const BASELINE_MOVEMENT_SPEED = 2.8, START_WALKING_SPEED = 0.08, STOP_WALKING_SPEED = 0.03;

/** CalculateOrientation [IL_39b8]: 0 with the camera straight ahead of the horse, 4 behind; the cross's sign picks
 *  the side; the parallel case with the camera behind reads 180. */
export function calculateHorseOrientation(cameraPos, horsePos, horseForward) {
  const toCamera = [cameraPos[0] - horsePos[0], 0, cameraPos[2] - horsePos[2]];
  const fwd = [horseForward[0], 0, horseForward[2]];
  if (sqrMag(toCamera) <= MATHF_EPSILON) return 0;
  if (sqrMag(fwd) <= MATHF_EPSILON) return 0;
  const tc = normalized(toCamera), f = normalized(fwd);
  let angle = angleBetween(tc, f);
  const crossY = tc[2] * f[0] - tc[0] * f[2];
  if (Math.abs(crossY) > MATHF_EPSILON) angle = angle * -Math.sign(crossY);
  else if (vdot(tc, f) < 0) angle = 180;
  return (-Math.round(angle / DEGREES_PER_ORIENTATION) + ORIENTATION_COUNT) % ORIENTATION_COUNT;
}
/** TryGetView [IL_3a84]: the five drawn views and the three mirrored ones. */
export function horseViewFor(orientation) {
  switch (orientation) {
    case 0: return { view: 0, flip: false };
    case 1: return { view: 1, flip: false };
    case 2: return { view: 2, flip: false };
    case 3: return { view: 3, flip: false };
    case 4: return { view: 4, flip: false };
    case 5: return { view: 3, flip: true };
    case 6: return { view: 2, flip: true };
    case 7: return { view: 1, flip: true };
    default: return null;
  }
}
/** CalculateAnimationFramesPerSecond [IL_3965] / CalculateIdleFrame [IL_398d]. */
export const walkFramesPerSecond = (speed) => Math.max(MIN_MOVING_FPS, Math.min(MAX_MOVING_FPS, BASELINE_FPS * Math.max(0, speed) / BASELINE_MOVEMENT_SPEED));
export const idleFrame = (idleSeconds) => ((Math.floor(Math.max(0, idleSeconds) * IDLE_FPS) & 1) !== 0 ? IDLE_FRAME_B : IDLE_FRAME_A);

/** The billboard's walk clock (StationaryHorseBillboard.LateUpdate [IL_36fc-IL_3837]) as a pure step over its
 *  state `{ walking, animationAccumulator, idleAccumulator, animationFrame }`: the start/stop hysteresis, the frame
 *  advance at the speed's rate, the idle alternation. Returns the next state. */
export function stepHorseWalk(s, speed, dt, hasWalkFrames = true) {
  const wasWalking = s.walking;
  const walking = wasWalking ? speed > STOP_WALKING_SPEED : speed > START_WALKING_SPEED;
  let { animationAccumulator, idleAccumulator, animationFrame } = s;
  if (hasWalkFrames) {
    if (walking) {
      if (!wasWalking) { animationAccumulator = 0; animationFrame = 0; idleAccumulator = 0; }
      const frameDuration = 1 / walkFramesPerSecond(speed);
      animationAccumulator += dt;
      while (animationAccumulator >= frameDuration) { animationAccumulator -= frameDuration; animationFrame = (animationFrame + 1) % HORSE_WALK_FRAMES; }
    } else {
      animationAccumulator = 0;
      if (wasWalking) idleAccumulator = 0; else idleAccumulator += dt;
      animationFrame = idleFrame(idleAccumulator);
    }
  }
  return { walking, animationAccumulator, idleAccumulator, animationFrame };
}
export const freshHorseWalk = () => ({ walking: false, animationAccumulator: 0, idleAccumulator: 0, animationFrame: 0 });

// ─── THE WHEELS ────────────────────────────────────────────────────────────────────────────────────────────────

/** CalculateSignedLongitudinalTravel [IL_5f08]: the 3-D displacement along the mean of the two forwards. */
export function signedLongitudinalTravel(displacement, previousForward, currentForward) {
  let axis = vadd(previousForward, currentForward);
  if (sqrMag(axis) <= MATHF_EPSILON) axis = sqrMag(currentForward) > MATHF_EPSILON ? currentForward : previousForward;
  if (sqrMag(axis) <= MATHF_EPSILON) return 0;
  return vdot(displacement, normalized(axis));
}
/** CalculateWheelRotationDegrees [IL_5f54]. */
export const wheelRotationDegrees = (signedDistance, wheelRadius) => (wheelRadius <= MATHF_EPSILON ? 0 : (WHEEL_ROTATION_SIGN * signedDistance / wheelRadius) * (180 / Math.PI));
/** WrapWheelAngle [IL_5f73]: Mathf.Repeat(a + 180, 360) - 180. */
export const wrapWheelAngle = (a) => { const r = a + 180; return (r - Math.floor(r / 360) * 360) - 180; };
/** CalculateWheelRadius (Wagon41214VisualBuilder [IL_b538]): each wheel (y extent + z extent) / 4, the two averaged. */
export const wheelRadiusOf = (leftSize, rightSize) => (((leftSize[1] + leftSize[2]) * 0.25) + ((rightSize[1] + rightSize[2]) * 0.25)) * 0.5;

// ─── THE CARGO TIERS (WagonCargoVisual.CalculateTier [IL_c180]) ────────────────────────────────────────────────

export const CARGO_TIERS = Object.freeze([25, 50, 75, 90]);
/** The fullness tier of a wagon at `weight` kg under `limit` kg: 0, 25, 50, 75 or 90. */
export function cargoTier(weight, limit) {
  if (!(limit > 0) || Number.isNaN(weight)) return 0;
  const f = Math.max(0, Math.min(1, weight / limit));
  if (f >= 0.9) return 90;
  if (f >= 0.75) return 75;
  if (f >= 0.5) return 50;
  if (f >= 0.25) return 25;
  return 0;
}
