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
// the exterior town map (ui/exteriorAutomapWindow.js). ROAD-C c2/S5
// took the DUNGEON window native - AMAP00I0/AMAP01I0, the nine buttons
// on their own rects with DFU's press-hold speeds, the mouse drags, the
// 3D view mode, the four backgrounds, the map compass, the tooltips and
// beacon focus cycling; c2/S6 added the shader's above-slice half
// (transparent and wireframe, the water tint, Cutout as the absence of
// the second pass); c2/S7 the beacons, the marker meshes and the hover
// picker. c2/S8 the USER-DATA HALF - note markers, teleporter
// connections and the click verbs that mint them. c2/S9 the
// interior-BUILDING arm (the visit-scoped record below); c2/S10 the
// exterior window's own native chrome (AMAP00I0 + TOWN00I0 through the
// shared ui/automapChrome.js tables). This file carries no open flag
// of its own any more - the exterior residue is stated, and only
// stated, at ui/exteriorAutomapWindow.js's header.
//
// ── ROAD-C c2/S8: NOTES AND TELEPORTERS ──────────────────────────────
// AutomapDungeonState carries two more collections (Automap.cs:93-94):
// `SortedList<int, NoteMarker> listUserNoteMarkers` and
// `Dictionary<string, TeleporterConnection> dictTeleporterConnections`.
// Both ride the per-dungeon record here, both ride the existing save
// envelope, and both are therefore subject to the SAME LRU prune - a
// player who set notes in a dungeon not visited in AutomapNumberOf-
// Dungeons dungeons loses them, exactly as DFU's own eviction does.
// That reads as data loss and IS the original's behaviour.
//
// THE TELEPORTER KEY IS THE SAVE KEY, and it is a C# ToString
// (:130-137): `"position: " + teleporterEntrance.position + ", rotation:
// " + teleporterExit.rotation` - the ENTRANCE position (already carrying
// its +up*1.0 offset, because TeleporterTransform applies the offset in
// its constructor) mixed with the EXIT rotation. It is both the runtime
// identity (AddTeleporterMarkerOnMap names its GameObjects with it and
// the hover/jump handlers parse it back out) and the dictionary key that
// is serialized. The port mints a byte-stable equivalent below and
// records the one thing it cannot reproduce.

import { getInt } from './settings.js';
import { MINUTES_PER_DAY } from './gameDate.js';
import { buildAutomapModel, restoreMatchesLayout, AABB_TOLERANCE } from './automapModel.js';
import { registerCommand } from './consoleCommands.js';   // E3: the console command database

export const SCAN_INTERVAL_S = 1 / 5;              // scanRateGeometryDiscoveryInHertz = 5 (:172)
export const RAYCAST_DISTANCE_DOWN = 3.0;          // :168
export const RAYCAST_DISTANCE_VIEW = 30.0;         // :169
export const RAYCAST_DISTANCE_ENTRANCE = 100.0;    // :170
export const FLOOR_MARCH_STEP = 1.0;               // :1180
export const PROTECTION_RAYCAST_OFFSET = 0.1;      // "slight offset of 10cm" (:1160, :1172)
export const HIT_DISTANCE_AGREEMENT = 0.01;        // Math.Abs(...) < 0.01f (:1121-1123)

// ---- the per-dungeon store (module singleton - one player) ---------

let _dungeons = new Map();   // key -> { revealed:Set, visitedThisRun:Set, entranceDiscovered, lastVisited }
let _live = null;            // E3: { rec, model } - the console's `Automap.instance`
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
      // c2/S8: AutomapDungeonState's two user-data collections (:93-94).
      // The SortedList is a Map kept in ASCENDING KEY ORDER - AddNext
      // reads Keys[i] positionally, so the order is part of the law.
      notes: new Map(),        // id -> { position:[x,y,z], note }
      teleporters: new Map(),  // dictKey -> { entrance:{pos,yawDeg}, exit:{pos,yawDeg} }
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
  _live = null;   // E3: Automap.instance goes with the geometry
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
      // c2/S8: :2199 / :2202 - the two user collections are COPIED into
      // the state on every save. Sorted-list order is the law for the
      // notes (AddNext reads Keys positionally), insertion order for the
      // dictionary, and both travel as [key, value] pairs so the shape
      // is JSON-clean and byte-stable across a round trip.
      notes: [...(rec.notes ?? new Map())].map(([id, n]) => [id, { position: [...n.position], note: n.note ?? '' }]),
      teleporters: [...(rec.teleporters ?? new Map())].map(([k, c]) => [k, {
        entrance: { pos: [...c.entrance.pos], yawDeg: c.entrance.yawDeg },
        exit: { pos: [...c.exit.pos], yawDeg: c.exit.yawDeg },
      }]),
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
      // c2/S8's DISCIPLINE ARM, one level down from the shipped
      // missing-field law and DFU's own (:2408-2422): both collections
      // are read `if (loaded != null)`, so a state written BEFORE this
      // stage - which carries neither field - restores with EMPTY
      // collections and never wipes or throws away the record it came
      // with. Ascending key order is rebuilt, not trusted.
      notes: sortedNoteMap(rec.notes),
      teleporters: new Map(Array.isArray(rec.teleporters) ? rec.teleporters : []),
    });
  }
}
export function resetAutomapStore() {
  _dungeons = new Map();
  _inside = false;
  _liveKey = null;
  _live = null;
  _interior = null;   // c2/S9: the visit-scoped interior record dies with the store
}

// ── ROAD-C c2/S9: THE INTERIOR-BUILDING RECORD ───────────────────────
//
// A building interior gets a map too - CheckForNewlyDiscoveredMeshes
// runs on IsPlayerInsideBuilding exactly as it runs in a dungeon
// (:1155) - but the state it writes lives NOWHERE PERSISTENT, and that
// is DFU's own arrangement rather than an omission. Four facts, all
// verified against Automap.cs this stage and all reproduced here:
//
//  (1) ALWAYS COLOUR. The material injection passes
//      `visitedInThisEntering = playerIsInsideBuilding`
//      (AutomapModel.cs:46-72 -> UpdateMaterialsOfMeshRenderer
//      :76-101), so inside a building RENDER_IN_GRAYSCALE is DISABLED
//      on every model and never enabled again. The same branch also
//      skips `meshRenderer.enabled = false`, so the injection leaves a
//      building's geometry nominally DISCOVERED - which the restore
//      below immediately takes back. The window's own always-colour
//      law is the port's half of this (ui/automapWindow.js).
//
//  (2) THE ENTRANCE BEACON IS LIT AND THEN PUT OUT, in that order.
//      CreateIndoorGeometryForAutomap ends in SetupBeacons(door)
//      (:1898), whose building arm parks the beacon at the entered
//      door and `SetActive(true)` - "set do discovered" (:1450-1457).
//      InitWhenInInteriorOrDungeon's very next statement is
//      RestoreStateAutomapDungeon(true) (:2485), which opens with
//      HideAll() (:2355) - and HideAll deactivates the entrance beacon
//      (:2460-2461). So a building's map opens FULLY HIDDEN with an
//      UNDISCOVERED entrance, and the entrance re-lights on the next
//      LOS tick like any other. The sequence is the quirk; a port that
//      only reproduced the end state would look identical for one
//      frame and diverge for ever after (and one that only reproduced
//      SetupBeacons would show the door through the walls at once).
//
//  (3) ...WITH ONE TAIL. After HideAll, RestoreStateAutomapDungeon
//      looks the BUILDING up in the DUNGEON dictionary by the current
//      location's "RegionName/Name" (:2362-2365) - a town and the
//      dungeon under it share that string - and, if a record is there,
//      sets the beacon to ITS entranceDiscovered (:2379) BEFORE the
//      locationName comparison that then returns (:2381). So entering
//      a shop in a town whose dungeon you have mapped lights the
//      shop's own entrance beacon immediately. Reproduced by
//      `dungeonEntranceDiscovered` below; the lookup is a READ and
//      the interior never joins that dictionary.
//
//  (4) NOTHING SURVIVES LEAVING. That same locationName mismatch ends
//      the restore before any discovery is applied, so interior
//      discovery is PER-VISIT: leave and come back and the room is
//      dark again.
//
// DEPARTURE (Port-Ledger, this file): DFU has a FIFTH arm and the port
// declines it. SaveStateAutomapDungeon runs on every save and only
// skips when the player is OUTSIDE (:2139-2143), so a save taken
// inside a shop walks the INTERIOR's hierarchy, writes it into the
// dungeon dictionary under the town's "RegionName/Name" with the
// interior's scene name as its locationName, and then runs the LRU
// prune over the result - evicting a real dungeon map to make room for
// a shop, and shadowing that town's dungeon record until the dungeon
// is next entered. Reload in the same building and (2)'s restore does
// match the locationName, so the interior even comes back. The port
// keeps the interior record OUT of the dungeon dictionary entirely:
// this record is a session object, never snapshot, never restored, and
// its `int:<n>` keys never enter the save's `${bi}:${position}` space.
// Interior discovery is therefore per-visit across a save/load too,
// which is (4)'s behaviour applied to one more door.
//
// AND ONE PIECE OF DFU IS DELIBERATELY ABSENT. SaveStateAutomapInterior
// (:2085-2121) fills `automapGeometryInteriorState` on the way out of a
// building (:2526), and RestoreStateAutomapInterior (:2280-2305) would
// read it back onto fresh geometry - but NOTHING ANYWHERE CALLS
// RestoreStateAutomapInterior. A whole-tree grep of the pinned clone
// finds the definition and no caller. It is dead code, the write half
// feeds nothing, and porting either half would invent a feature DFU
// does not have: interior discovery that survives leaving. There is no
// interior snapshot in this module for that reason.

/** The ONE interior record. Not a dictionary: DFU holds a single
 *  `automapGeometryInteriorState` field (:262) and a single geometry
 *  object, so at most one building is ever mapped. */
let _interior = null;

/**
 * OnTransitionToInterior -> InitWhenInInteriorOrDungeon's building arm
 * (:2482-2487). A FRESH record every time, which is the per-visit
 * lifetime (4) made structural: there is nowhere for the old one to
 * have been kept.
 *
 * `dungeonEntranceDiscovered` is (3)'s tail - the caller looks the
 * current location up in the dungeon dictionary (getDungeonAutomap) and
 * hands over what it found, or false. HideAll runs FIRST here, exactly
 * as it does at :2355, so the beacon is dark unless that lookup lights
 * it.
 */
export function enterInteriorAutomap({ dungeonEntranceDiscovered = false } = {}) {
  const rec = {
    revealed: new Set(),
    visitedThisRun: new Set(),
    entranceDiscovered: false,
    lastVisited: 0,
    blockNames: null,
    notes: new Map(),
    teleporters: new Map(),
  };
  _interior = rec;
  // THE SEQUENCE, statement for statement, in DFU's order. Each step is
  // its own exported function so the ORDER is what a pin drives, rather
  // than a final state that three different orders could produce.
  setupInteriorEntranceBeacon(rec);   // CreateIndoorGeometryForAutomap -> SetupBeacons(door) (:1898, :1450-1457)
  hideAllAutomap(rec);                // InitWhenInInteriorOrDungeon -> RestoreStateAutomapDungeon(true) -> HideAll() (:2485, :2355, :2450-2461)
  // ...and the dictionary tail (3), which is the ONLY thing that can
  // leave the beacon lit before the player has looked at the door.
  if (dungeonEntranceDiscovered) rec.entranceDiscovered = true;   // :2379
  return rec;
}

/** SetupBeacons' building arm (:1450-1457): the beacon is parked at the
 *  door the player walked through and `SetActive(true)` - DFU's own
 *  comment is "set do discovered". The POSITION is the host's (the
 *  window's `startMarker` dep); this is the discovery bit alone. */
export function setupInteriorEntranceBeacon(rec) {
  if (!rec) return false;
  rec.entranceDiscovered = true;
  return true;
}

/** OnTransitionToExterior (:2525-2528): the beacons are destroyed and
 *  the state written to a field nothing reads. The port drops the
 *  record instead - see the dead-restore note above. */
export function exitInteriorAutomap() { _interior = null; _live = null; }

export const getInteriorAutomap = () => _interior;

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
  // E3: `Automap.instance` for the console commands. DFU's Automap is
  // ONE component holding both halves - the state dictionary and the
  // geometry it reveals - and the port split them (the records here,
  // the model in the host that built the room). RevealAll needs both,
  // so the pair is latched at the one moment they meet, which is this
  // bind, and dropped by both exits below.
  _live = { rec, model };
  if (!restoreMatchesLayout(model, rec.blockNames)) {
    rec.revealed = new Set();
    rec.visitedThisRun = new Set();
    rec.entranceDiscovered = false;
    // c2/S8: RestoreStateAutomapDungeon clears BOTH user collections
    // (DestroyUserMarkerNotes + DestroyTeleporterMarkers, :2356-2359)
    // BEFORE it reads the saved state, and every abort arm - a missing
    // dictionary entry (:2373), a location-name mismatch (:2378) and a
    // block-name mismatch (:2385) - `return`s before the load at
    // :2408-2422. So a layout that no longer matches loses the notes and
    // the portals with the discovery, and does not keep half of each.
    rec.notes = new Map();
    rec.teleporters = new Map();
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

// ── ROAD-C c2/S8: USER NOTE MARKERS ──────────────────────────────────

export const NOTE_SPAWN_NORMAL_OFFSET = 0.7;   // hit.point + hit.normal * 0.7f (:773)
export const NOTE_MIN_DISTANCE = 1.0;          // Vector3.Distance(...) < 1.0f (:780)
export const NOTE_MAX_CHARACTERS = 50;         // messageboxUserNote.TextBox.MaxCharacters (:1603)
export const NOTE_WIDTH_OVERRIDE = 306;        // ...TextBox.WidthOverride (:1604)

/** NameGameobjectUserNoteMarkerSubStringStart + id (:164, :1580), read
 *  back the way every one of DFU's five handlers reads it -
 *  `Convert.ToInt32(name.Replace(prefix, ""))`. */
export const USER_NOTE_MARKER_PREFIX = 'UserNoteMarker_';
export function userNoteIdFromName(name) {
  if (typeof name !== 'string' || !name.startsWith(USER_NOTE_MARKER_PREFIX)) return null;
  const id = Number(name.slice(USER_NOTE_MARKER_PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

/** The SortedList's ascending-key order, rebuilt. DFU's
 *  SortedList<int,T> IS ordered by key and AddNext reads `Keys[counter]`
 *  POSITIONALLY, so a Map that merely happened to be in insertion order
 *  would answer a different id. Restores and snapshots both pass here. */
function sortedNoteMap(rows) {
  const out = new Map();
  if (!Array.isArray(rows)) return out;
  const pairs = rows
    .map(([id, n]) => [Number(id), { position: [...(n?.position ?? [0, 0, 0])], note: n?.note ?? '' }])
    .filter(([id]) => Number.isFinite(id))
    .sort((a, b) => a[0] - b[0]);
  for (const [id, n] of pairs) out.set(id, n);
  return out;
}

/**
 * SortedListExtensions.AddNext (:2704-2729), the loop VERBATIM - "we
 * want to reuse id's if list items have been deleted from the list and
 * thus the id is free". The keys are walked in ascending order and the
 * scan stops at the first gap:
 *
 *   key = 0; counter = 0;
 *   do {
 *     if (count == 0) break;
 *     next = Keys[counter++];
 *     if (key != next) break;              // the gap is HERE, at `key`
 *     key = next + 1;
 *     if (count == 1 || counter == count) break;
 *     if (key != Keys[counter]) break;     // the gap is one further on
 *   } while (true);
 *
 * Answers the minted key; the caller supplies the value. Written as the
 * C# loop rather than as "the lowest free integer" on purpose: the two
 * agree over every sequence DFU's add/delete cycle produces, and a pin
 * on the loop is a pin on what DFU runs.
 */
export function sortedListAddNext(map, value) {
  const keys = [...map.keys()].sort((a, b) => a - b);
  const count = keys.length;
  let key = 0;
  let counter = 0;
  for (;;) {
    if (count === 0) break;
    const next = keys[counter++];
    if (key !== next) break;
    key = next + 1;
    if (count === 1 || counter === count) break;
    if (key !== keys[counter]) break;
  }
  map.set(key, value);
  // the SortedList stays sorted, so re-mint the Map in key order - the
  // next AddNext reads Keys[] positionally, exactly as the C# does
  const sorted = sortedNoteMap([...map]);
  map.clear();
  for (const [k, v] of sorted) map.set(k, v);
  return key;
}

/**
 * TryToAddOrEditUserNoteMarkerOnDungeonSegmentAtScreenPosition
 * (:763-799) with the raycast already done - `hit` is the picker's
 * answer, its `name` naming a marker (`UserNoteMarker_<id>`) or not.
 *
 * Three outcomes, all DFU's:
 *  - the hit IS a note marker  -> 'edit' that marker's note;
 *  - the hit is anything else and NO existing marker sits within 1.0
 *    unit of `hit.point + hit.normal * 0.7` -> 'add', with the id from
 *    AddNext's lowest-free-key reuse;
 *  - the hit is anything else and a marker IS within 1.0 -> 'none', and
 *    NO id is minted (the early `return` at :781 is before AddNext).
 *
 * Note which comparison DFU makes: the distance is measured against the
 * SPAWNING position, not against the hit point, so the 0.7 normal
 * offset is inside the test. And it is a STRICT `<`, so a marker at
 * exactly 1.0 does not refuse.
 *
 * `editOnCreation` is DFU's `!Input.GetKey(LeftControl)` (window :1878)
 * and rides out on the answer rather than being decided here. A miss (no
 * hit at all) answers 'none' - the whole body is inside
 * `if (nearestHit.HasValue)`.
 */
export function tryAddOrEditUserNote(rec, hit, { editOnCreation = true } = {}) {
  if (!rec || !hit) return { action: 'none', id: null, edit: false };
  const existingId = userNoteIdFromName(hit.name);
  if (existingId != null) return { action: 'edit', id: existingId, edit: true };
  const n = hit.normal ?? [0, 1, 0];
  const p = hit.point ?? [0, 0, 0];
  const at = [
    p[0] + n[0] * NOTE_SPAWN_NORMAL_OFFSET,
    p[1] + n[1] * NOTE_SPAWN_NORMAL_OFFSET,
    p[2] + n[2] * NOTE_SPAWN_NORMAL_OFFSET,
  ];
  for (const marker of rec.notes.values()) {
    const q = marker.position;
    if (Math.hypot(at[0] - q[0], at[1] - q[1], at[2] - q[2]) < NOTE_MIN_DISTANCE) {
      return { action: 'none', id: null, edit: false };   // :781 - no marker, and no id burned
    }
  }
  const id = sortedListAddNext(rec.notes, { position: at, note: '' });
  return { action: 'add', id, edit: !!editOnCreation };
}

/** TryToRemoveUserNoteMarkerOnDungeonSegmentAtScreenPosition
 *  (:806-820): true ONLY when the hit was a marker, which is what the
 *  window's right double-click reads to decide whether to fall through
 *  to the rotation pivot. */
export function tryRemoveUserNote(rec, hit) {
  if (!rec || !hit) return false;
  const id = userNoteIdFromName(hit.name);
  if (id == null) return false;
  rec.notes.delete(id);   // `if (ContainsKey(id)) Remove(id)`, then Destroy - the object goes either way
  return true;
}

/** UserNote_OnGotUserInput (:1608-1614) writes the note back by id.
 *  MaxCharacters 50 is the TEXT BOX's limit, so it is applied where the
 *  text arrives rather than trusted from the caller. */
export function setUserNote(rec, id, text) {
  const marker = rec?.notes?.get(id);
  if (!marker) return false;
  marker.note = String(text ?? '').slice(0, NOTE_MAX_CHARACTERS);
  return true;
}

// ── ROAD-C c2/S8: TELEPORTER CONNECTIONS ─────────────────────────────

/** TeleporterTransform's two position offsets, applied IN THE
 *  CONSTRUCTOR and therefore already baked into the string key
 *  (OnTeleportAction :2565-2572). */
export const TELEPORTER_ENTRANCE_OFFSET = Object.freeze([0, 1.0, 0]);   // Vector3.up * 1.0f
export const TELEPORTER_EXIT_OFFSET = Object.freeze([0, 0.2, 0]);       // Vector3.up * 0.2f

const addOffset = (p, o) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];

/**
 * .NET's "F1" numeric format: one decimal, rounded HALF AWAY FROM ZERO,
 * with the sign kept even when the magnitude rounds to zero
 * (`(-0.04).ToString("F1")` is `"-0.0"`). JS `toFixed` differs on exact
 * negative ties - it takes the larger n, so -1.25 prints "-1.2" where
 * .NET prints "-1.3" - so the rounding is done on the magnitude.
 */
export function formatF1(v) {
  if (!Number.isFinite(v)) return 'NaN';
  const mag = Math.round(Math.abs(v) * 10) / 10;
  return (v < 0 ? '-' : '') + mag.toFixed(1);
}

/** Unity 2019.4's Vector3.ToString() / Quaternion.ToString():
 *  `"({0:F1}, {1:F1}, {2:F1})"` and the same with a fourth slot. */
export const vector3String = (v) => `(${formatF1(v[0])}, ${formatF1(v[1])}, ${formatF1(v[2])})`;
export const quaternionString = (q) => `(${formatF1(q[0])}, ${formatF1(q[1])}, ${formatF1(q[2])}, ${formatF1(q[3])})`;

/** Quaternion.Euler(0, yaw, 0) - the port's action objects carry a YAW
 *  and nothing else, so this is the whole rotation they can have. */
export function yawQuaternion(yawDeg) {
  const h = (yawDeg ?? 0) * Math.PI / 360;   // half of yaw, in radians
  return [0, Math.sin(h), 0, Math.cos(h)];
}

/**
 * TeleporterConnection.ToString (:130-137) - THE DICTIONARY KEY, and
 * therefore also the SAVE key and the marker GameObjects' names:
 *
 *   "position: " + teleporterEntrance.position + ", rotation: " + teleporterExit.rotation
 *
 * It mixes the ENTRANCE position with the EXIT rotation. That is not a
 * transcription slip - read it twice; it is what the C# says, and both
 * halves are load-bearing (two portals sharing an entrance tile but
 * pointing at differently-turned exits are different connections).
 *
 * DEPARTURE, rowed in the Ledger: the ROTATION component. DFU's exit is
 * a Unity Transform carrying a full quaternion; the port's action
 * objects carry a YAW ALONE (dungeonLayout's `objectPositions` records
 * `yawDeg`), so the port formats Quaternion.Euler(0, yaw, 0) into the
 * same four F1 slots. For every teleporter Daggerfall actually ships -
 * RDB action objects, which are yaw-only - the two agree; a hypothetical
 * pitched exit would key differently. The FORMAT is byte-identical, and
 * that is what matters here, because this string is written into saves:
 * it must round-trip and it must not drift, so both halves are derived
 * from the block's static layout data (never from an accumulated runtime
 * transform) and are quantised to one decimal before they are compared.
 */
export function teleporterDictKey(entrance, exit) {
  return `position: ${vector3String(entrance.pos)}, rotation: ${quaternionString(yawQuaternion(exit.yawDeg))}`;
}

/**
 * OnTeleportAction (:2565-2572). `entrance` / `exit` are the RAW action
 * transforms `{ pos, yawDeg }`; the two offsets are applied here because
 * TeleporterTransform's constructor applies them before ToString ever
 * reads the position. A key already in the dictionary is NOT re-added -
 * walking the same portal twice records it once.
 *
 * Answers the key (whether or not it was new) so the caller can name the
 * marker objects with it, and `added` for the pins.
 */
export function recordTeleporterConnection(rec, entrance, exit) {
  if (!rec || !entrance || !exit) return null;
  const conn = {
    entrance: { pos: addOffset(entrance.pos, TELEPORTER_ENTRANCE_OFFSET), yawDeg: entrance.yawDeg ?? 0 },
    exit: { pos: addOffset(exit.pos, TELEPORTER_EXIT_OFFSET), yawDeg: exit.yawDeg ?? 0 },
  };
  const key = teleporterDictKey(conn.entrance, conn.exit);
  if (rec.teleporters.has(key)) return { key, added: false };
  rec.teleporters.set(key, conn);
  return { key, added: true };
}

// ── ROAD-C c2/S8: THE THREE CONSOLE COMMANDS ─────────────────────────
// AutoMapConsoleCommands (:2596-2688). The port has no in-game console,
// so these are exported as functions and mounted on the standalone
// dungeon host's probe surface (`window.__automapCommand`) - the same
// place every other developer verb in this port lives. The LAWS below
// are DFU's; only the door differs.

/** RevealAll (:2426-2445): every model's MeshRenderer enabled AND its
 *  RENDER_IN_GRAYSCALE keyword disabled - so a revealed-by-command
 *  dungeon draws in COLOUR, not as prior-run geometry - plus the
 *  entrance beacon set active. */
export function revealAllAutomap(rec, model) {
  if (!rec || !model) return false;
  for (const row of model.rows ?? []) {
    rec.revealed.add(row.key);
    rec.visitedThisRun.add(row.key);
  }
  rec.entranceDiscovered = true;
  return true;
}

/** HideAll (:2450-2464): every MeshRenderer DISABLED and the entrance
 *  beacon deactivated - and note what it does NOT touch: the grayscale
 *  keyword is left exactly as it was, so `visitedThisRun` survives here
 *  the way DFU's materials do. `revealed` ALONE is the draw gate,
 *  because `MeshRenderer.enabled` alone is DFU's. */
export function hideAllAutomap(rec) {
  if (!rec) return false;
  rec.revealed = new Set();
  rec.entranceDiscovered = false;
  return true;
}

/** DebugTeleportMode (:2665-2687): a bare toggle on the Automap
 *  component, so it lives at module scope beside the store the same
 *  component owns. Ctrl+Shift+LeftClick on a dungeon segment while it
 *  holds teleports the player there (window :715-731). */
let _debugTeleportMode = false;
export const automapDebugTeleportMode = () => _debugTeleportMode;
export function toggleAutomapDebugTeleportMode() {
  _debugTeleportMode = !_debugTeleportMode;
  return _debugTeleportMode;
}

// ── ROAD-E E3: AutoMapConsoleCommands, ON THE DATABASE ────────────────
// Automap.cs:2596-2688. c2/S8 ported the three LAWS above and mounted
// them on the standalone dungeon host's probe surface because the port
// had no command database; E3 built the database
// (systems/consoleCommands.js), so the commands are registered the way
// C# registers them - name, description, usage, callback - with their
// two gates and their answer strings verbatim. `automapCommand` on the
// dungeon context stays as the probe door and now runs THESE.

/** GameManager.Instance.IsPlayerInside, for the automap's purpose: the
 *  module already tracks both halves - `_inside` is the dungeon's (its
 *  own comment says so) and a non-null `_interior` is the building's,
 *  which is why RevealAll works on a shop's map in DFU too. */
export const automapIsPlayerInside = () => _inside || _interior != null;

/** `Automap.instance` - null outside, and null after either exit. */
export const automapInstance = () => _live;

/** AutoMapConsoleCommands.RegisterCommands (:2598-2612), including the
 *  try/catch DFU wraps it in (a registration that throws must not take
 *  the automap's Start down with it). */
export function registerAutomapConsoleCommands() {
  try {
    registerCommand('map_revealall',
      'Reveals entire map (including disconnected dungeon segments) on automap',
      'map_revealall',
      () => {
        if (!automapIsPlayerInside()) return 'this command only has an effect when inside a dungeon';
        const automap = automapInstance();
        if (automap == null) return 'Automap instance not found';
        revealAllAutomap(automap.rec, automap.model);
        return 'dungeon has been completely revealed on the automap';
      });
    registerCommand('map_hideall', 'Hides entire map', 'map_hideall',
      () => {
        if (!automapIsPlayerInside()) return 'this command only has an effect when inside a dungeon';
        const automap = automapInstance();
        if (automap == null) return 'Automap instance not found';
        hideAllAutomap(automap.rec);
        return 'hide complete on automap';
      });
    // DebugTeleportMode (:2666-2688) has NO inside gate - only the
    // instance one - which is C#'s own asymmetry, kept.
    registerCommand('map_teleportmode',
      'toggles (enables or disables) debug teleport mode (Control+Shift+Left Mouse Click on a dungeon segment will teleport player to it)',
      'map_teleportmode',
      () => {
        const automap = automapInstance();
        if (automap == null) return 'Automap instance not found';
        return toggleAutomapDebugTeleportMode()
          ? 'debug teleport mode has been enabled'
          : 'debug teleport mode has been disabled';
      });
  } catch (ex) {
    console.error(`Error Registering Automap Console commands: ${ex?.message ?? ex}`);
  }
}
