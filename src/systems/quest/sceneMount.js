// THE SCENE MOUNT (Q4-iii) - GameObjectHelper.cs's quest half
// (AddQuestResourceObjects :903-1163, CreateFoeGameObjects' quest
// wiring) + CreateFoe.cs's PlaceFoeFreely ring (:260-345), headless.
// The layout builders call addQuestResourceObjects at build time and
// Place.AssignQuestResource's hot-place calls it again mid-scene; the
// walk finds every SiteLink on the current site, resolves its quest
// and Place, and stands the marker-targeted resources through the
// SCENE ADAPTER - the geometry (billboards, prefabs, colliders,
// ground alignment) is the host's, the routing/gates/flat-pick/
// position law is here, pinned.
//
// THE SCENE ADAPTER (every member optional unless noted):
//   currentMapId()        - PlayerGPS.CurrentMapID (REQUIRED: the
//                           SiteLink filter key)
//   findBehaviours()      - every QuestResourceBehaviour live in the
//                           scene (Resources.FindObjectsOfTypeAll's
//                           snapshot; the double-inject guard)
//   loadInProgress()      - SaveLoadManager.LoadInProgress: foes are
//                           NOT stood during a load so the restore
//                           can land enemy state itself (C#)
//   standNPC({ quest, marker, person, flatData, position, behaviour })
//                         - stand the person billboard; flatData is
//                           the picked { archive, record }; answers
//                           the host handle (resourceBehaviour.js's
//                           contract) or null to skip binding. The
//                           host adds the StaticNPC peer + people
//                           data (SetRMBPeopleData) itself.
//   standFoe({ quest, marker, foe, gender, position, behaviour })
//                         - stand ONE enemy at the marker ('male' |
//                           'female'; C#'s Unspecified init is dead -
//                           a two-value Genders always overwrites it)
//   standItem({ quest, marker, item, position, behaviour })
//                         - stand the item billboard; the dungeon
//                           half-treasure-marker drop, the half-size
//                           raise, and the duplicate-markerID parent
//                           workaround (GetDaggerfallMarker's
//                           unique-or-null law) are the host's, keyed
//                           off marker.markerID
//
// KEPT QUIRKS: enableItems is DEAD - AddQuestResourceObjects takes it
// but never passes it down, so items always stand (C#); the walk
// throws on a dangling quest or Place exactly as C#'s layout does;
// the behaviours snapshot is taken ONCE per link before both marker
// walks (the selected marker's targets and the spawn-marker array are
// independent by the Q3-i STRUCT-COPY law, so the stale snapshot
// cannot double-stand in practice); a Foe stands only while
// killCount < spawnCount.

import { QuestResourceBehaviour } from './resourceBehaviour.js';
import { GENDERS } from '../../characters/nameHelper.js';
import { RDB_SIDE } from '../../world/rdbLayout.js';

/** FactionFile.GetFlatData: archive packs above bit 7. */
export const getFlatData = (flat) => ({ archive: flat >> 7, record: flat & 0x7f });

/** The billboard texture pick (AddQuestNPC :995-1019): individuals
 *  are ALWAYS flat1 whatever their gender; a questor wears the
 *  clicked NPC's saved billboard indices; else male flat1, female
 *  flat2. */
export function questNpcFlatData(person) {
  if (person.isIndividualNPC) return getFlatData(person.factionData.flat1);
  if (person.isQuestor) {
    return { archive: person.questorData.billboardArchiveIndex, record: person.questorData.billboardRecordIndex };
  }
  if (person.gender === GENDERS.Male) return getFlatData(person.factionData.flat1);
  return getFlatData(person.factionData.flat2);
}

/** The classic marker scene position: dungeon block origin
 *  (dungeonX/Z * RDBSide) + the flat position. Building interiors
 *  carry dungeonX/Z = 0 so the flat position stands alone. */
export function markerScenePosition(marker) {
  return {
    x: marker.dungeonX * RDB_SIDE + marker.flatPosition.x,
    y: marker.flatPosition.y,
    z: marker.dungeonZ * RDB_SIDE + marker.flatPosition.z,
  };
}

/** AddQuestResourceObjects (:903-937). */
export function addQuestResourceObjects(machine, adapter, siteType, buildingKey = 0,
  { enableNPCs = true, enableFoes = true, enableItems = true } = {}) {
  void enableItems;   // C#'s own dead parameter, kept for the signature
  const siteLinks = machine.getSiteLinks(siteType, adapter.currentMapId?.(), buildingKey);
  if (!siteLinks || siteLinks.length === 0) return;
  for (const link of siteLinks) {
    const quest = machine.getQuest(link.questUID);
    if (!quest) throw new Error(`Could not find active quest for UID ${link.questUID}`);
    const place = quest.getPlace(link.placeSymbol);
    if (!place) throw new Error(`Could not find Place symbol ${link.placeSymbol?.name} in quest UID ${link.questUID}`);
    // One snapshot per link guards the double-inject (slightly
    // expensive in C#, once per layout or "place thing")
    const resourceBehaviours = adapter.findBehaviours?.() ?? [];
    addMarkerResourceObjects(machine, adapter, siteType, enableNPCs, enableFoes, quest,
      resourceBehaviours, place.siteDetails.selectedMarker);
    if (place.siteDetails.questSpawnMarkers) {
      for (const marker of place.siteDetails.questSpawnMarkers) {
        addMarkerResourceObjects(machine, adapter, siteType, enableNPCs, enableFoes, quest,
          resourceBehaviours, marker);
      }
    }
  }
}

/** AddMarkerResourceObjects (:938-971). */
export function addMarkerResourceObjects(machine, adapter, siteType, enableNPCs, enableFoes,
  quest, resourceBehaviours, marker) {
  if (!marker?.targetResources) return;
  for (const target of marker.targetResources) {
    const resource = quest.getResource(target);
    if (!resource) continue;
    if (isAlreadyInjected(resourceBehaviours, resource)) continue;
    if (resource.isPerson && enableNPCs) {
      addQuestNPC(machine, adapter, siteType, quest, marker, resource);
    } else if (resource.isFoe && enableFoes) {
      if (resource.killCount < resource.spawnCount) {
        addQuestFoe(machine, adapter, siteType, quest, marker, resource);
      }
    } else if (resource.isItem) {
      addQuestItem(machine, adapter, siteType, quest, marker, resource);
    }
  }
}

/** IsAlreadyInjected (:979-992): symbol identity against the scene
 *  snapshot (C# Symbol equality is name equality). */
export function isAlreadyInjected(resourceBehaviours, resource) {
  if (!resourceBehaviours || resourceBehaviours.length === 0) return false;
  for (const behaviour of resourceBehaviours) {
    if (behaviour.targetSymbol?.name === resource.symbol?.name) return true;
  }
  return false;
}

/** AddQuestNPC (:995-1063): the flat pick + the stand; the behaviour
 *  couples both ways. */
function addQuestNPC(machine, adapter, siteType, quest, marker, person) {
  const flatData = questNpcFlatData(person);
  const position = markerScenePosition(marker);
  const behaviour = new QuestResourceBehaviour(machine);
  behaviour.assignResource(person);
  const host = adapter.standNPC?.({ quest, marker, person, flatData, position, behaviour }) ?? null;
  if (host) behaviour.bindHost(host);
  person.questResourceBehaviour = behaviour;
  behaviour.start();
}

/** AddQuestFoe (:1068-1111): never during a load; ONE enemy per call
 *  (the marker stand is a single foe - CreateFoe's waves ride their
 *  own pending chain); the injured trigger REARMS at placement, the
 *  per-wave law. */
function addQuestFoe(machine, adapter, siteType, quest, marker, foe) {
  if (adapter.loadInProgress?.()) return;
  const gender = foe.gender === GENDERS.Female ? 'female' : 'male';
  const position = markerScenePosition(marker);
  const behaviour = new QuestResourceBehaviour(machine);
  behaviour.assignResource(foe);
  const host = adapter.standFoe?.({ quest, marker, foe, gender, position, behaviour }) ?? null;
  if (host) behaviour.bindHost(host);
  foe.questResourceBehaviour = behaviour;
  behaviour.start();
  foe.rearmInjured();
}

/** AddQuestItem (:1116-1160). */
function addQuestItem(machine, adapter, siteType, quest, marker, item) {
  const position = markerScenePosition(marker);
  const behaviour = new QuestResourceBehaviour(machine);
  behaviour.assignResource(item);
  const host = adapter.standItem?.({ quest, marker, item, position, behaviour }) ?? null;
  if (host) behaviour.bindHost(host);
  item.questResourceBehaviour = behaviour;
  behaviour.start();
}

// ---- PlaceFoeFreely (CreateFoe.cs:260-345) - the raycast ring ----

/** The ring constants; TryPlacement's wilderness arm widens to 8/25
 *  (:252-257), every other site uses the defaults. */
export const PLACE_FOE_DEFAULTS = Object.freeze({
  minDistance: 5, maxDistance: 20,
  wildernessMinDistance: 8, wildernessMaxDistance: 25,
  overlapSphereRadius: 0.65, separationDistance: 1.25, maxFloorDistance: 4,
});

/** One placement attempt just outside the player's view. env:
 *   playerPosition {x,y,z}; playerYawRadians (Unity yaw: forward =
 *   (sin yaw, 0, cos yaw)); fovDegrees (MainCamera.fieldOfView);
 *   rolls() - the engine-PRNG seam (Ledger A; C# draws Range(0,4),
 *   then the side coin, then ONE distance roll on whichever arm ran);
 *   raycast(origin, direction, maxDistance) -> { point, normal,
 *   distance } | null; overlapSphere(point, radius) -> occupied count
 *   or boolean.
 *  Answers the spawn position {x,y,z} (the host stands the foe there,
 *  faces it at the player, and FinalizeFoe aligns ground units /
 *  raises flying ones 1.5 - geometry), or null = retry next tick. */
export function placeFoeFreely(env, { minDistance = 5, maxDistance = 20 } = {}) {
  const C = PLACE_FOE_DEFAULTS;
  const rolls = env.rolls ?? Math.random;

  // Select a left or right direction outside of camera FOV
  let directionAngle = env.fovDegrees;
  directionAngle += rolls() * 4;
  const yawDegrees = (rolls() > 0.5) ? -directionAngle : directionAngle;
  const yaw = env.playerYawRadians + yawDegrees * Math.PI / 180;
  const spawnDirection = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };

  // Check for a hit
  let currentPoint;
  const initialHit = env.raycast(env.playerPosition, spawnDirection, maxDistance);
  if (initialHit) {
    const n = normalize(initialHit.normal);
    const cosNormal = -(spawnDirection.x * n.x + spawnDirection.y * n.y + spawnDirection.z * n.z);
    if (cosNormal < 1e-6) return null;
    const separationForward = C.separationDistance / cosNormal;
    // Must be greater than minDistance
    const distanceSlack = initialHit.distance - separationForward - minDistance;
    if (distanceSlack < 0) return null;
    // Separate out from hit point
    const extraDistance = rolls() * Math.min(2, distanceSlack);
    const back = separationForward + extraDistance;
    currentPoint = {
      x: initialHit.point.x - spawnDirection.x * back,
      y: initialHit.point.y - spawnDirection.y * back,
      z: initialHit.point.z - spawnDirection.z * back,
    };
  } else {
    // Open area - a random point along the spawn direction
    const dist = minDistance + rolls() * (maxDistance - minDistance);
    currentPoint = {
      x: env.playerPosition.x + spawnDirection.x * dist,
      y: env.playerPosition.y + spawnDirection.y * dist,
      z: env.playerPosition.z + spawnDirection.z * dist,
    };
  }

  // Must be able to find a surface below
  const floorHit = env.raycast(currentPoint, { x: 0, y: -1, z: 0 }, C.maxFloorDistance);
  if (!floorHit) return null;

  // Ensure this is open space
  const testPoint = { x: floorHit.point.x, y: floorHit.point.y + C.separationDistance, z: floorHit.point.z };
  if (env.overlapSphere?.(testPoint, C.overlapSphereRadius)) return null;

  return testPoint;
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
