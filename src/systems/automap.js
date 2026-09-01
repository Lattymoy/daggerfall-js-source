// A1: THE DUNGEON AUTOMAP - discovery state + the reveal law,
// verbatim from DFU Automap.cs (MIT, Daggerfall Workshop; original
// author Nystul). The Port-Ledger's S-G row: none of this shipped
// before - "automap" appeared in src/ only as settings rows and the
// navgrid's bitmap carve.
//
// SHAPE. DFU duplicates the whole dungeon onto an "Automap" layer and
// encodes discovery in Unity component state: MeshRenderer.enabled =
// discovered ever, the RENDER_IN_GRAYSCALE keyword = NOT visited in
// this run (Automap.cs:60-79). The port's renderer draws explicit
// lists, so the duplicate-scene machinery collapses to DATA: one
// per-dungeon record { revealed:Set, visitedThisRun:Set,
// entranceDiscovered, lastVisited } keyed by the entry keys the
// dungeon layout already mints (`${bi}:${position}` - the stable
// action-key identity), and the map pass filters the LIVE drawList by
// it. No second copy of the geometry exists.
//
// THE REVEAL LAW (CheckForNewlyDiscoveredMeshes, :1149-1275) at DFU's
// own probe set and cadence:
//   - 5 Hz (scanRateGeometryDiscoveryInHertz, :172)
//   - probe 1 DOWN from the eye, 3.0 units (:168 raycastDistanceDown)
//   - probe 2 along the VIEW direction, 30.0 units (:169 - "don't
//     want to make it too easy to discover big halls")
//   - probe 3 the FLOOR MARCH: 1-unit steps from the eye toward the
//     view hit, casting DOWN 3.0 at each step (:1176-1190) - the
//     floor path between you and the wall you look at
// THE THREE-RAY SCAN (ScanWithRaycastInDirectionAndUpdateMeshes-
// AndMaterials, :1021-1144) - restored in full by ROAD-C c2/S1. A1
// shipped a single-ray substitution and recorded it; the machinery it
// dropped is not defensive noise. DFU casts THREE parallel rays (the
// main one, one at `offsetSecondProtectionRaycast`, one at
// `cross(normalize(dir), normalize(offset2)) * |offset2|`), demands
// all three hit the SAME collider, and demands each ray's hit on the
// TRUE level geometry agree with its hit on the automap copy to
// within 0.01. That last test is the one that matters: the automap
// copy has NO ACTION DOORS (RDBLayout.cs:625-627 filters them and
// AddActionDoors is never called on the automap run), so when a
// closed door stands between you and a hall, the true-geometry ray
// stops at the door and the automap ray flies on to the far wall -
// the distances disagree and NOTHING reveals. Without it a closed
// door reveals the room behind it.
// THE PORT'S EQUIVALENT (a substitution, recorded): there is one
// collider, so there is no true-vs-copy pair to compare. Instead the
// three rays must agree pairwise within the same 0.01 (which is what
// DFU's per-ray agreement buys across the trio), they must resolve
// the same MODEL ROW (the stand-in for `hit.collider ==`), and a
// nearest hit whose collider BUCKET is an action door reveals
// nothing. The port gets the door discrimination for free and
// exactly, because action doors are their own collider buckets keyed
// by the action object (world/actionSystem.js addDoor) while dungeon
// geometry is the single 'dungeon' bucket. That is cheaper than
// DFU's second scene AND sharper - but it DEPENDS on action doors
// staying distinct buckets: merge them into the dungeon bucket and
// the door discrimination silently reverts to over-reveal. The pin
// on bucket distinctness is the guard.
// Row identity itself resolves by HIT POINT against the model's AABBs
// (systems/automapModel.js resolveAt - the tightest enclosing box
// wins), because the port's collider answers a bucket, not a mesh.
//
// ENTRANCE DISCOVERY (:1197-1274): while undiscovered, the entrance
// marker looks for a clear line of sight TO THE PLAYER within 100
// units (raycastDistanceEntranceMarkerReveal); the port casts one
// collider ray entrance->player and compares distances - the same
// LOS answer DFU's three parallel rays vote on.
//
// PERSISTENCE (GetState/SetState, :2085-2422): DFU keys the dungeon
// dictionary by "RegionName/Name" and prunes it to the newest
// AutomapNumberOfDungeons by timeInSecondsLastVisited (:2216-2238;
// the Settings default is 5, the code default 1 - the SETTING rules,
// :941). visitedThisRun resets on each fresh ENTRY but survives a
// mid-dungeon load (:2492-2493's initFromLoadingSave arm). The port
// stores minutes (the one clock); the envelope rides snapshotPlayer
// beside snap.discovery, every host for free.
//
// A2 shipped the grayscale presentation (the renderer's uAutomapMode
// - visitedThisRun draws colour, prior-run geometry grayscale) and
// the exterior town map (ui/exteriorAutomapWindow.js). FLAGGED
// residue: user note markers, teleporter portals, the 3D view mode +
// the native AMAP art windows, the render modes (wireframe/
// transparent/cutout), beacon focus cycling, and the
// interior-BUILDING automap arm.

import { getInt } from './settings.js';
import { MINUTES_PER_DAY } from './gameDate.js';
import { buildAutomapModel, restoreMatchesLayout, AABB_TOLERANCE } from './automapModel.js';

export const SCAN_INTERVAL_S = 1 / 5;              // scanRateGeometryDiscoveryInHertz = 5 (:172)
export const RAYCAST_DISTANCE_DOWN = 3.0;          // :168
export const RAYCAST_DISTANCE_VIEW = 30.0;         // :169
export const RAYCAST_DISTANCE_ENTRANCE = 100.0;    // :170
export const FLOOR_MARCH_STEP = 1.0;               // :1180
export const PROTECTION_RAYCAST_OFFSET = 0.1;      // "slight offset of 10cm" (:1160, :1172)
export const HIT_DISTANCE_AGREEMENT = 0.01;        // Math.Abs(...) < 0.01f (:1121-1123)

// ---- the per-dungeon store (module singleton - one player) ---------

let _dungeons = new Map();   // key -> { revealed:Set, visitedThisRun:Set, entranceDiscovered, lastVisited }
let _inside = false;         // GameManager.IsPlayerInside's automap half - the N=0 forget law reads it
let _liveKey = null;         // the dungeon the player stands in - structurally unevictable (see prune)

/** The DFU dictionary key is "RegionName/Name" (:2206); the port
 *  speaks the region INDEX + location name - the same identity, one
 *  lookup earlier. */
export const automapDungeonKey = (regionIndex, name) => `${regionIndex}/${name}`;

/** Enter a dungeon: fetch-or-create its record, and on a REAL entry
 *  stamp the visit clock, reset visitedThisRun and prune. The LOAD
 *  arm (fromLoad - InitWhenInInteriorOrDungeon :2492-2493) does NONE
 *  of that: DFU's load path is a bare dictionary replacement plus a
 *  renderer re-apply (SetState :387-389, RestoreState... :2351-2422);
 *  the stamp and prune belong to SAVE time (:2155, :2216-2238), so a
 *  load must never evict records the save itself carried (A1 review). */
export function enterDungeonAutomap(key, nowMinutes, { fromLoad = false } = {}) {
  let rec = _dungeons.get(key);
  if (!rec) {
    rec = {
      revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: false, lastVisited: 0,
      blockNames: null,   // c2/S1: the layout the discovery was recorded against (the restore guard's input)
    };
    _dungeons.set(key, rec);
  }
  _inside = true;
  _liveKey = key;
  if (!fromLoad) {
    rec.lastVisited = nowMinutes;
    rec.visitedThisRun = new Set();
    pruneAutomapStore();
  }
  return rec;
}

/** Leaving a dungeon (OnTransitionToDungeonExterior's automap half,
 *  :2530-2534 -> SaveStateAutomapDungeon): with the setting at 0 the
 *  whole dictionary CLEARS - vanilla Daggerfall forgets the map the
 *  moment you exit (:2133-2137; the A1 review caught this arm
 *  dropped). dungeonContext.destroy() calls this in both hosts. */
export function exitDungeonAutomap() {
  _inside = false;
  _liveKey = null;
  if (getInt('Map', 'AutomapNumberOfDungeons', 0, 100) === 0) _dungeons = new Map();
}

/** The LRU prune (:2216-2238), DFU's own removal law: everything
 *  whose stamp is STRICTLY OLDER than the N-th newest goes; boundary
 *  ties all survive ('timeInSecondsLastVisited < timeInSecondsLimit',
 *  :2231 - the store can briefly hold more than N, as DFU's can).
 *  N = 0 is treated as 1 while inside (:2145-2149). The LIVE dungeon
 *  never evicts: DFU gets that structurally (the save-time stamp is
 *  always the maximum, :2155); the port's floored world-save clock
 *  can under-stamp a fresh entry, so the protection is explicit
 *  (A1 review - the quickLoad eviction). */
export function pruneAutomapStore() {
  const n = Math.max(1, getInt('Map', 'AutomapNumberOfDungeons', 0, 100));
  if (_dungeons.size <= n) return;
  const stamps = [..._dungeons.values()].map((r) => r.lastVisited).sort((a, b) => b - a);
  const limit = stamps[n - 1];
  for (const [key, rec] of _dungeons) {
    if (rec.lastVisited < limit && key !== _liveKey) _dungeons.delete(key);
  }
}

export const getDungeonAutomap = (key) => _dungeons.get(key) ?? null;

/** The save halves - Sets travel as arrays (plain JSON). DFU's
 *  positional model lists collapse to the entry keys, which are
 *  stable per rebuild (the block-local byte position + the block
 *  instance index, the action system's own identity).
 *  This IS SaveStateAutomapDungeon (GetState :378-382 runs it on
 *  every save): with N = 0 and the player OUTSIDE the whole
 *  dictionary clears - the vanilla forget law (:2133-2137); inside,
 *  the live dungeon's stamp is written NOW (:2155 - which is what
 *  makes it the newest) and the store prunes (:2216-2238). */
export function snapshotAutomap(nowMinutes = null) {
  if (!_inside && getInt('Map', 'AutomapNumberOfDungeons', 0, 100) === 0) {
    _dungeons = new Map();
    return {};
  }
  const live = _liveKey ? _dungeons.get(_liveKey) : null;
  if (live && Number.isFinite(nowMinutes)) {
    live.lastVisited = nowMinutes;
    pruneAutomapStore();
  }
  const out = {};
  for (const [key, rec] of _dungeons) {
    out[key] = {
      revealed: [...rec.revealed],
      visitedThisRun: [...rec.visitedThisRun],
      entranceDiscovered: rec.entranceDiscovered,
      lastVisited: rec.lastVisited,
      // c2/S1: DFU's own record carries `blockName` per block
      // (Automap.cs:78) for exactly one purpose - the restore walk
      // aborts when the live layout disagrees (:2385-2386). The port
      // keeps the same field for the same purpose; it is OPTIONAL on
      // the way back in, so an A1/A2 envelope still restores.
      ...(rec.blockNames ? { blockNames: [...rec.blockNames] } : {}),
    };
  }
  return out;
}
/** SetState (:387-389), with DFU's missing-data arm kept: a save
 *  that carries NO automap field (pre-A1) leaves the session's
 *  in-memory dictionary UNTOUCHED - SaveLoadManager restores the
 *  automap only `if (automapState != null)` (:1503-1509), so loading
 *  an old save never erases the maps explored this session (A1
 *  review - the wipe-on-null arm). */
export function restoreAutomap(snap) {
  if (!snap) return;
  _dungeons = new Map();
  for (const [key, rec] of Object.entries(snap)) {
    _dungeons.set(key, {
      revealed: new Set(rec.revealed ?? []),
      visitedThisRun: new Set(rec.visitedThisRun ?? []),
      entranceDiscovered: rec.entranceDiscovered ?? false,
      lastVisited: rec.lastVisited ?? 0,
      blockNames: Array.isArray(rec.blockNames) ? [...rec.blockNames] : null,
    });
  }
}
export function resetAutomapStore() { _dungeons = new Map(); _inside = false; _liveKey = null; }

// ---- the reveal index + the probe law ------------------------------

/** Build the reveal model over the dungeon's draw entries. The caller
 *  supplies world AABBs plus DFU's block/element/model identity
 *  (dungeonContext owns that walk); the model is also the picker's
 *  broadphase and the map pass's partition. Kept under the A1 name so
 *  no host changes shape to get the repair. */
export const buildRevealIndex = (entries) => buildAutomapModel(entries);

/**
 * Bind a freshly built model to a record. Two jobs, both DFU's:
 *  - stamp the layout the discovery is recorded against (:78's
 *    blockName, per block) when the record does not carry one yet;
 *  - run the restore guard (:2385-2386) when it does, and on a
 *    DISAGREEMENT drop the discovery entirely rather than paint the
 *    wrong models (the departure is argued in automapModel.js).
 * Answers true when the record survived.
 */
export function bindAutomapLayout(rec, model) {
  if (!rec || !model) return false;
  if (!restoreMatchesLayout(model, rec.blockNames)) {
    rec.revealed = new Set();
    rec.visitedThisRun = new Set();
    rec.entranceDiscovered = false;
    rec.blockNames = [...model.blockNames];
    return false;
  }
  rec.blockNames = [...model.blockNames];
  return true;
}

// ---- vector helpers, Unity's semantics ------------------------------
const _cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** Vector3.Normalize: Unity answers the ZERO VECTOR for a zero input
 *  rather than NaN, and the automap leans on that - see the march. */
const _norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};
const _scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const _add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * ScanWithRaycastInDirectionAndUpdateMeshesAndMaterials (:1021-1144).
 * Three parallel rays; all three must resolve the SAME model row and
 * agree pairwise within 0.01, and no ray may be stopped by an action
 * door. On success the row reveals AND marks visited-this-run
 * (DisableKeyword("RENDER_IN_GRAYSCALE"), :1135) and the hit distance
 * comes back - the floor march reads it. On any failure: null, and
 * NOTHING reveals.
 */
function scanWithRaycast(rayStart, rayDir, rayDistance, offsetSecond, ctx, rec) {
  const { collider, model, isDoorBucket, bucketFilter } = ctx;
  // ":1032" - the third offset is the second turned about the ray
  const offsetThird = _scale(
    _cross(_norm(rayDir), _norm(offsetSecond)),
    Math.hypot(offsetSecond[0], offsetSecond[1], offsetSecond[2]),
  );
  const origins = [rayStart, _add(rayStart, offsetSecond), _add(rayStart, offsetThird)];
  const dists = [];
  let key;
  let haveKey = false;
  for (const o of origins) {
    const hit = collider.raycastHit(o, rayDir, rayDistance, bucketFilter);
    ctx.rays++;
    if (!hit || !Number.isFinite(hit.dist) || hit.dist > rayDistance) return null;
    // The port's stand-in for DFU's true-vs-copy distance test: the
    // automap copy has no action doors, so a door hit reveals nothing.
    if (isDoorBucket && hit.key != null && isDoorBucket(hit.key)) return null;
    const p = [o[0] + rayDir[0] * hit.dist, o[1] + rayDir[1] * hit.dist, o[2] + rayDir[2] * hit.dist];
    const row = model.resolveAt(p, AABB_TOLERANCE);
    if (!row) return null;
    if (!haveKey) { key = row.key; haveKey = true; } else if (row.key !== key) return null;   // "hits must have same collider" (:1116-1117)
    dists.push(hit.dist);
  }
  for (let i = 0; i < dists.length; i++) {
    for (let j = i + 1; j < dists.length; j++) {
      if (Math.abs(dists[i] - dists[j]) >= HIT_DISTANCE_AGREEMENT) return null;
    }
  }
  rec.revealed.add(key);          // hitMeshRenderer.enabled = true (:1129)
  rec.visitedThisRun.add(key);    // DisableKeyword("RENDER_IN_GRAYSCALE") (:1135)
  return dists[0];
}

/** The camera's own DOWN, from a roll-free forward - DFU reads
 *  `Camera.main.transform.rotation * Vector3.down` and the port's
 *  camera has no roll, so the basis rebuilds exactly. */
function cameraDownFrom(fwd) {
  let right = _norm(_cross(fwd, [0, 1, 0]));
  if (right[0] === 0 && right[1] === 0 && right[2] === 0) right = [1, 0, 0];   // straight up/down
  const up = _norm(_cross(right, fwd));
  return [-up[0], -up[1], -up[2]];
}

/**
 * CheckForNewlyDiscoveredMeshes (:1149-1194): the DOWN scan from the
 * eye, the VIEW scan, and - only when the VIEW scan SUCCEEDED, which
 * is DFU's `hitForward.HasValue` and not merely "the ray hit
 * something" - the floor march between them. Call at the 5 Hz cadence
 * with the live eye + forward.
 *
 * `isDoorBucket(bucketKey)` names an action door's collider bucket;
 * `bucketFilter` rides through to raycastHit untouched.
 * Answers `{ rays }` - the tick's true ray count, which the budget
 * pin bounds at 3 x (1 + 1 + march steps).
 */
export function automapRevealTick(rec, { eye, fwd, collider, model, index, isDoorBucket = null, bucketFilter = null }) {
  const m = model ?? index;
  if (!rec || !m) return { rays: 0 };
  const ctx = { collider, model: m, isDoorBucket, bucketFilter, rays: 0 };
  const camDown = cameraDownFrom(fwd);

  // (a) DOWN from the head - "3 meters should be enough" (:168). The
  // protection offset is Vector3.left * 0.1 - a WORLD axis, not the
  // camera's (:1160).
  scanWithRaycast(eye, [0, -1, 0], RAYCAST_DISTANCE_DOWN, [-PROTECTION_RAYCAST_OFFSET, 0, 0], ctx, rec);

  // (b) the VIEW direction (:1166-1171)
  const offsetView = _scale(_norm(_cross(camDown, fwd)), PROTECTION_RAYCAST_OFFSET);
  const viewDist = scanWithRaycast(eye, fwd, RAYCAST_DISTANCE_VIEW, offsetView, ctx, rec);

  // (c) the FLOOR MARCH: 1-unit steps from the EYE toward the view
  // hit, casting down at each (:1176-1190) - paints the floor path.
  // QUIRK, verbatim: the march's protection offset is
  // normalize(cross(camera-down, WORLD-down)) * 0.1, which is the ZERO
  // VECTOR whenever the camera is level (Unity normalizes 0 to 0), so
  // a level look casts three coincident rays that agree trivially.
  // That is DFU's behaviour and the port keeps it.
  if (viewDist != null) {
    const offsetMarch = _scale(_norm(_cross(camDown, [0, -1, 0])), PROTECTION_RAYCAST_OFFSET);
    for (let step = FLOOR_MARCH_STEP; step < viewDist; step += FLOOR_MARCH_STEP) {
      const at = [eye[0] + fwd[0] * step, eye[1] + fwd[1] * step, eye[2] + fwd[2] * step];
      scanWithRaycast(at, [0, -1, 0], RAYCAST_DISTANCE_DOWN, offsetMarch, ctx, rec);
    }
  }
  return { rays: ctx.rays };
}

/** The entrance beacon's own discovery (:1197-1274): while
 *  undiscovered, a clear line of sight entrance->player within 100
 *  units reveals it. */
export function automapEntranceTick(rec, entrancePos, playerPos, collider) {
  if (!rec || rec.entranceDiscovered || !entrancePos) return;
  const d = [playerPos[0] - entrancePos[0], playerPos[1] - entrancePos[1], playerPos[2] - entrancePos[2]];
  const dist = Math.hypot(d[0], d[1], d[2]);
  if (dist > RAYCAST_DISTANCE_ENTRANCE || dist < 1e-3) return;
  const dir = [d[0] / dist, d[1] / dist, d[2] / dist];
  const hit = collider.raycast(entrancePos, dir, dist);
  if (!Number.isFinite(hit) || hit >= dist - 0.5) rec.entranceDiscovered = true;
}

/** The window's slice plane (UpdateSlicingPositionY, :1296-1304):
 *  player Y + eye height + the window's bias, or +Infinity when the
 *  AutomapAlwaysMaxOutSliceLevel setting holds (the caller reads it -
 *  this stays pure). defaultSlicingBiasY = 0.2 (the window's :51). */
export const DEFAULT_SLICING_BIAS_Y = 0.2;
export const slicingPositionY = (playerY, eyeHeight, biasY) => playerY + eyeHeight + biasY;

/** The stale-visit clock, for probes: minutes -> days old. */
export const automapDaysSinceVisit = (rec, nowMinutes) => (nowMinutes - (rec?.lastVisited ?? 0)) / MINUTES_PER_DAY;
