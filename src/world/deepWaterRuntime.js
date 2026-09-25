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
// ═══════════════════════════════════════════════════════════════════

export const LOAD_GRACE_SECONDS = 1.5;
export const LOCATION_LOAD_STUCK_SECONDS = 12;

let resumeAt = 0;             // heavyWorkResumeTime (Infinity while a load is in progress)
let locationLoads = 0;        // activeLocationLoads
let lastLocationLoadAt = 0;   // lastLocationLoadIncrementTime

/** OnStartLoad: no heavy work until the load lands. */
export function loadStarted() { resetTransition(Infinity); }
/** OnLoad: 1.5 s more. */
export function loadFinished(realSeconds) { resumeAt = realSeconds + LOAD_GRACE_SECONDS; }
/** OnTeleportToCoordinates. */
export function teleported(realSeconds) { resetTransition(realSeconds + LOAD_GRACE_SECONDS); }
/** OnCreateLocationGameObject / OnUpdateLocationGameObject: a location begins and ends its load. */
export function locationLoadBegan(realSeconds) { locationLoads++; lastLocationLoadAt = realSeconds; }
export function locationLoadEnded() { if (locationLoads > 0) locationLoads--; }

function resetTransition(at) { locationLoads = 0; resumeAt = at; }

/** IsLoadGraceActive: heavy work paused, or a location still loading. */
export function loadGraceActive(realSeconds) {
  if (realSeconds < resumeAt) return true;
  if (locationLoads <= 0) return false;
  if (realSeconds - lastLocationLoadAt > LOCATION_LOAD_STUCK_SECONDS) { locationLoads = 0; return false; }
  return true;
}

/** Tests: the clock back to its boot state. */
export function resetDeepWaterRuntime() { resumeAt = 0; locationLoads = 0; lastLocationLoadAt = 0; }
