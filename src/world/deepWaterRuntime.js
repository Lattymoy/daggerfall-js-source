// ═══════════════════════════════════════════════════════════════════
// DW-D (2026-09-25): ILIAC PUDDLE NO MORE'S LOAD GRACE (DeepWaterRuntime.cs,
// jet082, 1.2.2) - the window in which the mod holds its hand off the
// player: the shore exit does not lift a swimmer and the swim stroke and
// multiplier stand down (OutdoorSwimMovementController). It opens:
//
//   while a save LOADS (OnStartLoad: until OnLoad), and 1.5 s after it
//     lands (heavyWorkResumeTime = realtime + 1.5);
//   1.5 s after a teleport (OnTeleportToCoordinates - a fast travel, a
//     recall, a quest's teleport);
//   while a location is loading (activeLocationLoads > 0 - dropped as
//     stuck after 12 s, as the C# does).
//
// Real time throughout (Time.realtimeSinceStartup): a pause does not
// spend it. One clock for every host - the dungeon's swimmer reads it too.
//
// DW-E1: THE REST OF IT - what the spawners hang off.
//
//   THE TRANSIENT RESET (OnTransientReset): a load starting and a teleport
//     reset the transition state and tell every subscriber - the fish,
//     the foes, the loot and the decorations drop what they hold.
//   THE POST-TRANSITION REFRESH: a load landing or a teleport leaves one
//     pending; the first frame terrain may be touched again
//     (CanMutateTerrainData: no grace, no terrain update running) it runs
//     the decorations' RefreshPlayerArea.
//   THE WORK GATES: light work runs while the game plays and no load is
//     in progress (CanRunLightRuntimeWork); heavy work also waits out the
//     grace's clock (CanRunHeavyRuntimeWork).
//
// NOT PORTED - the peripheral-location skip (SkipPeripheralLocationUpdates,
// PumpDeferredLocationRestore): while the player is in or over deep water,
// or any streamed terrain is ocean-connected, the mod has StreamingWorld
// skip building every location but the player's own pixel's (and an owned
// ship's), and builds them once the player is clear of the sea. It is a
// cost measure for DFU's streamed world; the port's location builds are its
// own pipeline, so a coast's neighbouring towns stand as they do without
// the mod (Port-Ledger A, the Iliac Puddle No More row).
// ═══════════════════════════════════════════════════════════════════

export const LOAD_GRACE_SECONDS = 1.5;
export const LOCATION_LOAD_STUCK_SECONDS = 12;

let resumeAt = 0;             // heavyWorkResumeTime (Infinity while a load is in progress)
let locationLoads = 0;        // activeLocationLoads
let lastLocationLoadAt = 0;   // lastLocationLoadIncrementTime
let refreshPending = false;   // postTransitionRefreshPending
let terrainUpdating = false;  // terrainUpdateEventActive
const transientResetListeners = [];
let postTransitionRefresh = null;

/** OnStartLoad: no heavy work until the load lands; no refresh pending. */
export function loadStarted() { resetTransition(Infinity, false); }
/** OnLoad: 1.5 s more, and the player's area refreshed after. */
export function loadFinished(realSeconds) { resumeAt = realSeconds + LOAD_GRACE_SECONDS; refreshPending = true; }
/** OnTeleportToCoordinates. */
export function teleported(realSeconds) { resetTransition(realSeconds + LOAD_GRACE_SECONDS, true); }
/** OnCreateLocationGameObject / OnUpdateLocationGameObject: a location begins and ends its load. */
export function locationLoadBegan(realSeconds) { locationLoads++; lastLocationLoadAt = realSeconds; }
export function locationLoadEnded() { if (locationLoads > 0) locationLoads--; }
/** OnUpdateTerrainsStart / OnUpdateTerrainsEnd: the streamed world's terrain pass. */
export function terrainUpdateBegan() { terrainUpdating = true; }
export function terrainUpdateEnded() { terrainUpdating = false; }

/**
 * ResetTransitionState: the location count, the heavy-work clock and the
 * refresh flag, then OnTransientReset - every subscriber in the order it
 * subscribed, a multicast delegate's invocation (the cached sea height the
 * C# clears first is no cache here).
 */
function resetTransition(at, pending) {
  locationLoads = 0;
  resumeAt = at;
  refreshPending = pending;
  for (const fn of [...transientResetListeners]) fn();
}

/** `OnTransientReset += fn`; returns the `-=`. */
export function onTransientReset(fn) {
  transientResetListeners.push(fn);
  return () => { const i = transientResetListeners.indexOf(fn); if (i >= 0) transientResetListeners.splice(i, 1); };
}

/** The work PumpPostTransitionRefresh runs (UnderwaterDecorations.RefreshPlayerArea); null for none. */
export function setPostTransitionRefresh(fn) { postTransitionRefresh = fn ?? null; }

/** CanRunLightRuntimeWork: the game playing (IsPlayingGame) and no load in progress. */
export function canRunLightRuntimeWork(playing) { return !!playing && resumeAt !== Infinity; }
/** CanRunHeavyRuntimeWork: light work, and the grace's clock run out. */
export function canRunHeavyRuntimeWork(realSeconds, playing) { return canRunLightRuntimeWork(playing) && realSeconds >= resumeAt; }

/** IsAnyLocationLoading: a location in progress - dropped as stuck after 12 s. */
function anyLocationLoading(realSeconds) {
  if (locationLoads <= 0) return false;
  if (realSeconds - lastLocationLoadAt > LOCATION_LOAD_STUCK_SECONDS) { locationLoads = 0; return false; }
  return true;
}

/**
 * IsLoadGraceActive: heavy work paused, or a location still loading. The
 * swim's own readers run only while the game plays, so `playing` defaults
 * to true for them.
 */
export function loadGraceActive(realSeconds, playing = true) {
  if (!canRunHeavyRuntimeWork(realSeconds, playing)) return true;
  return anyLocationLoading(realSeconds);
}

/** CanMutateTerrainData: no grace and no terrain pass running. */
export function canMutateTerrainData(realSeconds, playing) { return !loadGraceActive(realSeconds, playing) && !terrainUpdating; }

/** Pump's PumpPostTransitionRefresh: the pending refresh, once terrain may be touched. */
export function pumpDeepWaterRuntime(realSeconds, playing) {
  if (!refreshPending || !canMutateTerrainData(realSeconds, playing)) return;
  refreshPending = false;
  postTransitionRefresh?.();
}

/** IsPostTransitionRefreshPending. */
export const postTransitionRefreshPending = () => refreshPending;

/** Tests: the clock back to its boot state (the subscribers stay; each test owns its own). */
export function resetDeepWaterRuntime() {
  resumeAt = 0; locationLoads = 0; lastLocationLoadAt = 0; refreshPending = false; terrainUpdating = false;
}
