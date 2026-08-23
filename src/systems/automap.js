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
// SUBSTITUTION (recorded): DFU resolves WHICH mesh a probe hit by
// raycasting the duplicate geometry with three parallel rays and a
// 0.01 distance agreement (:1021-1144 - machinery that guards Unity
// collider gaps). The port's collider answers one distance for the
// whole dungeon bucket, so identity resolves by the HIT POINT: every
// entry whose world AABB contains the probe's hit point (grown by a
// small tolerance) reveals. Adjacent models sharing the hit corner
// reveal together where DFU reveals the one mesh - a strictly
// bounded over-reveal of the same wall junction, recorded.
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
// A2 FLAGGED residue: the grayscale PRESENTATION of prior-run
// geometry (the state ships here, the mesh pass has no per-draw
// tint), user note markers, teleporter portals, the 3D view mode +
// native AMAP art window, and the exterior automap.

import { getInt } from './settings.js';
import { MINUTES_PER_DAY } from './gameDate.js';

export const SCAN_INTERVAL_S = 1 / 5;              // scanRateGeometryDiscoveryInHertz = 5 (:172)
export const RAYCAST_DISTANCE_DOWN = 3.0;          // :168
export const RAYCAST_DISTANCE_VIEW = 30.0;         // :169
export const RAYCAST_DISTANCE_ENTRANCE = 100.0;    // :170
export const FLOOR_MARCH_STEP = 1.0;               // :1180
const HIT_POINT_TOLERANCE = 0.05;                  // the identity-resolution skin (the substitution's own)

// ---- the per-dungeon store (module singleton - one player) ---------

let _dungeons = new Map();   // key -> { revealed:Set, visitedThisRun:Set, entranceDiscovered, lastVisited }

/** The DFU dictionary key is "RegionName/Name" (:2206); the port
 *  speaks the region INDEX + location name - the same identity, one
 *  lookup earlier. */
export const automapDungeonKey = (regionIndex, name) => `${regionIndex}/${name}`;

/** Enter a dungeon: fetch-or-create its record, stamp the visit
 *  clock, and reset visitedThisRun UNLESS restoring a mid-dungeon
 *  load (InitWhenInInteriorOrDungeon :2492-2493). Prunes the store
 *  to the newest AutomapNumberOfDungeons AFTER the stamp, so the
 *  current dungeon always survives its own entry. */
export function enterDungeonAutomap(key, nowMinutes, { fromLoad = false } = {}) {
  let rec = _dungeons.get(key);
  if (!rec) {
    rec = { revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: false, lastVisited: 0 };
    _dungeons.set(key, rec);
  }
  rec.lastVisited = nowMinutes;
  if (!fromLoad) rec.visitedThisRun = new Set();
  pruneAutomapStore();
  return rec;
}

/** The LRU prune (:2216-2238): keep the newest N by lastVisited.
 *  N = 0 is classic's own forgetfulness - inside a dungeon it is
 *  treated as 1 so the live record survives (:2145-2149); the port
 *  prunes only at entry, so the live record is always the newest. */
export function pruneAutomapStore() {
  const n = Math.max(1, getInt('Map', 'AutomapNumberOfDungeons', 0, 100));
  if (_dungeons.size <= n) return;
  const byTime = [..._dungeons.entries()].sort((a, b) => b[1].lastVisited - a[1].lastVisited);
  _dungeons = new Map(byTime.slice(0, n));
}

export const getDungeonAutomap = (key) => _dungeons.get(key) ?? null;

/** The save halves - Sets travel as arrays (plain JSON). DFU's
 *  positional model lists collapse to the entry keys, which are
 *  stable per rebuild (the block-local byte position + the block
 *  instance index, the action system's own identity). */
export function snapshotAutomap() {
  const out = {};
  for (const [key, rec] of _dungeons) {
    out[key] = {
      revealed: [...rec.revealed],
      visitedThisRun: [...rec.visitedThisRun],
      entranceDiscovered: rec.entranceDiscovered,
      lastVisited: rec.lastVisited,
    };
  }
  return out;
}
export function restoreAutomap(snap) {
  _dungeons = new Map();
  if (!snap) return;   // a pre-A1 save carries none - nothing remembered
  for (const [key, rec] of Object.entries(snap)) {
    _dungeons.set(key, {
      revealed: new Set(rec.revealed ?? []),
      visitedThisRun: new Set(rec.visitedThisRun ?? []),
      entranceDiscovered: rec.entranceDiscovered ?? false,
      lastVisited: rec.lastVisited ?? 0,
    });
  }
}
export function resetAutomapStore() { _dungeons = new Map(); }

// ---- the reveal index + the probe law ------------------------------

/** Build the reveal index over the dungeon's draw entries:
 *  [{ key, aabb: [minX,minY,minZ,maxX,maxY,maxZ] }]. The caller
 *  supplies world AABBs (the entries' cpu extents through their
 *  matrices - dungeonContext owns that walk). */
export function buildRevealIndex(entries) {
  return entries.filter((e) => e.key != null && e.aabb != null);
}

const pointInAabb = (p, a, tol) =>
  p[0] >= a[0] - tol && p[0] <= a[3] + tol
  && p[1] >= a[1] - tol && p[1] <= a[4] + tol
  && p[2] >= a[2] - tol && p[2] <= a[5] + tol;

/** One probe: cast, and mark every entry whose AABB holds the hit
 *  point (the identity substitution). Answers true if the ray hit. */
function probe(origin, dir, maxDist, collider, index, rec) {
  const dist = collider.raycast(origin, dir, maxDist);
  if (!Number.isFinite(dist) || dist > maxDist) return null;
  const hit = [origin[0] + dir[0] * dist, origin[1] + dir[1] * dist, origin[2] + dir[2] * dist];
  for (const e of index) {
    if (!pointInAabb(hit, e.aabb, HIT_POINT_TOLERANCE)) continue;
    rec.revealed.add(e.key);
    rec.visitedThisRun.add(e.key);   // DisableKeyword("RENDER_IN_GRAYSCALE") (:1137)
  }
  return dist;
}

/**
 * CheckForNewlyDiscoveredMeshes (:1149-1194), the port's shape: the
 * DOWN probe from the eye, the VIEW probe, and the floor march
 * between them. Call at the 5 Hz cadence with the live eye + forward.
 */
export function automapRevealTick(rec, { eye, fwd, collider, index }) {
  if (!rec) return;
  // (a) DOWN from the head - "3 meters should be enough" (:168)
  probe(eye, [0, -1, 0], RAYCAST_DISTANCE_DOWN, collider, index, rec);
  // (b) the VIEW direction (:1168)
  const viewDist = probe(eye, fwd, RAYCAST_DISTANCE_VIEW, collider, index, rec);
  // (c) the FLOOR MARCH: 1-unit steps toward the view hit, casting
  // down at each (:1176-1190) - paints the floor path
  if (viewDist != null) {
    for (let step = FLOOR_MARCH_STEP; step < viewDist; step += FLOOR_MARCH_STEP) {
      const at = [eye[0] + fwd[0] * step, eye[1] + fwd[1] * step, eye[2] + fwd[2] * step];
      probe(at, [0, -1, 0], RAYCAST_DISTANCE_DOWN, collider, index, rec);
    }
  }
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
