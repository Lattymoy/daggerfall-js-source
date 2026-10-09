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
//                           half-treasure-marker drop and the
//                           half-size raise are the host's. So is the
//                           PARENTING (AddQuestItem :1144-1148): the
//                           dungeon host hands its stand the travel of
//                           the scene marker sceneMarkerMover below
//                           finds by marker.markerID - the
//                           unique-or-null law (GetDaggerfallMarker)
//                           is sceneMarkerOf's, here. TOTEM-CAGE
//                           (FIELD BUGS 2026-10-03b): no host did it,
//                           and the Totem stayed where its cage began.
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
import { isShelved } from './quest.js';   // QUEST-SHELF: a quest set aside
import { GENDERS } from '../../characters/nameHelper.js';
import { RDB_SIDE } from '../../world/rdbLayout.js';
import { MARKER_TYPES } from './place.js';   // TOTEM-CAGE: the two records that carry a DaggerfallMarker

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
  { enableNPCs = true, enableFoes = true, enableItems = true, byName = !!machine?.mountByName } = {}) {
  void enableItems;   // C#'s own dead parameter, kept for the signature
  // QREPAIR: `byName` - the repair's mount (quest/questRepair.js sets machine.mountByName for its pass) matches a
  // standing behaviour by quest and symbol NAME, not identity: see isAlreadyInjected
  const siteLinks = machine.getSiteLinks(siteType, adapter.currentMapId?.(), buildingKey);
  if (!siteLinks || siteLinks.length === 0) return;
  for (const link of siteLinks) {
    const quest = machine.getQuest(link.questUID);
    if (!quest) throw new Error(`Could not find active quest for UID ${link.questUID}`);
    if (isShelved(quest)) continue;   // QUEST-SHELF: a quest set aside mounts nothing (its links are set aside with it)
    const place = quest.getPlace(link.placeSymbol);
    if (!place) throw new Error(`Could not find Place symbol ${link.placeSymbol?.name} in quest UID ${link.questUID}`);
    // One snapshot per link guards the double-inject (slightly
    // expensive in C#, once per layout or "place thing")
    const resourceBehaviours = adapter.findBehaviours?.() ?? [];
    addMarkerResourceObjects(machine, adapter, siteType, enableNPCs, enableFoes, quest,
      resourceBehaviours, place.siteDetails.selectedMarker, byName);
    if (place.siteDetails.questSpawnMarkers) {
      for (const marker of place.siteDetails.questSpawnMarkers) {
        addMarkerResourceObjects(machine, adapter, siteType, enableNPCs, enableFoes, quest,
          resourceBehaviours, marker, byName);
      }
    }
  }
}

/** AddMarkerResourceObjects (:938-971). */
export function addMarkerResourceObjects(machine, adapter, siteType, enableNPCs, enableFoes,
  quest, resourceBehaviours, marker, byName = false) {
  if (!marker?.targetResources) return;
  for (const target of marker.targetResources) {
    const resource = quest.getResource(target);
    if (!resource) continue;
    if (isAlreadyInjected(resourceBehaviours, resource, byName)) continue;
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

/** IsAlreadyInjected (GameObjectHelper.cs:978-991).
 *
 *  AUDIT 24 (the seven-slice sweep): `resourceBehaviour.TargetSymbol ==
 *  resource.Symbol` is a REFERENCE compare, and the comment that used
 *  to sit here - "C# Symbol equality is name equality" - was reading
 *  the wrong member. Symbol overrides Equals and GetHashCode and does
 *  NOT overload operator==, so `==` on it is object identity, and
 *  identity here means THE SAME RESOURCE: CacheTarget assigns
 *  `targetSymbol = questResource.Symbol`, the resource's own instance.
 *
 *  It matters because the snapshot is scene-wide -
 *  `Resources.FindObjectsOfTypeAll<QuestResourceBehaviour>()`, every
 *  quest at once - and the corpus reuses symbol names relentlessly
 *  (_king_, _npc_, _item_). By NAME, a second quest's _king_ collided
 *  with the first's and was silently never stood.
 *
 *  A C# QUIRK RIDES ALONG, kept: a RESTORED behaviour holds a
 *  DESERIALIZED Symbol (RestoreSaveData :285), which is a different
 *  object, so after a load the guard stops recognising its own
 *  resource and DFU stands a duplicate. The port restores the same
 *  way, so it inherits the same hole rather than quietly fixing it. */
export function isAlreadyInjected(resourceBehaviours, resource, byName = false) {
  if (!resourceBehaviours || resourceBehaviours.length === 0) return false;
  for (const behaviour of resourceBehaviours) {
    if (behaviour.targetSymbol === resource.symbol) return true;
    // QREPAIR: the repair's mount closes the load hole above for its own pass - the same quest, the same symbol name,
    // is the same resource standing. DFU's own mounts (the layout, the hot-place) keep the identity match, verbatim.
    if (byName && behaviour.questUID === resource.parentQuest?.uid && behaviour.targetSymbol?.name === resource.symbol?.name) return true;
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

// ---- TOTEM-CAGE: the quest item's scene marker (AddQuestItem :1144-1148, GetDaggerfallMarker :1165-1186) ----
//
// FIELD BUGS 2026-10-03b (Shortstori on Discord: "Im about to end my mainquest but the Totem of Tiber Septim isnt
// here"). DFU stands a quest item at its marker's LAYOUT point and then parents it to the marker's scene object - "This
// ensures mobile quest objects parented to action marker translates correctly" - because an RDB marker can carry an
// action of its own (RDBLayout.cs:403-406 runs AddActionFlatHelper for every flat with Action > 0, editor flats too),
// and DFU's own note names the case: "raising treasure room cage for totem in Daggerfall castle". S0000008 places the
// Totem at DaggerfallCastle2's item marker 5 ("hidden in the treasury", its log says). The port registered an acting
// marker as a moving flat (dungeonContext.js, ActionSystem.addMoveFlat) but stood the quest item at the marker's start
// and left it there, so the cage rose without the Totem. Online the cage's pose is the castle room's memory
// (WORLD3/WORLD34) and never resets - the room never drains - so every player came in to the raised cage, empty. The
// laws below are the parenting as data; the dungeon host (scenes/worldModes.js dungeonQuestAdapter.standItem) hands
// its stand the mover's live offset.

/** GetDaggerfallMarker (GameObjectHelper.cs:1165-1186) over a laid-out dungeon (world/dungeonLayout.js layoutDungeon's
 *  `blocks`): the ONE quest or item marker - archive 199 records 11/18, the two RDBLayout.cs:359-366 gives a
 *  DaggerfallMarker - whose MarkerID is `markerID`. The ID is block position + object position on both sides: the
 *  layout's `loadID` (world/rdbLayout.js) and the quest marker's `markerID` (place.js _enumerateDungeonQuestMarkers).
 *  Null when none is, and null when MORE than one is - DFU's workaround: a block laid twice mints its IDs twice, and
 *  the marker must be unique or null ("to prevent bad parenting behaviour"). A fixed-treasure (216) record carries no
 *  `loadID`, so it never answers. Answers `{ index, marker }`: the block instance and its layout marker record. */
export function sceneMarkerOf(blocks, markerID) {
  let found = null;
  for (let index = 0; index < (blocks?.length ?? 0); index++) {
    for (const marker of blocks[index]?.layout?.markers ?? []) {
      if (marker.record !== MARKER_TYPES.QuestSpawn && marker.record !== MARKER_TYPES.QuestItem) continue;
      if (marker.loadID !== markerID) continue;
      if (found) return null;
      found = { index, marker };
    }
  }
  return found;
}

/** The scene marker's MOTION, which is all the parenting carries: the ActionSystem object the dungeon host registered
 *  for the acting marker (dungeonContext.js registers it under its block instance and object position, the chain's
 *  own key) - answered only when it MOVES (a move-flag flat; its `offset` is the travel, written in place by the
 *  tween, a remote act and a restore alike). A marker with no action, or one that only relays a chain, carries the item
 *  nowhere: null. */
export function sceneMarkerMover(blocks, actions, markerID) {
  const at = sceneMarkerOf(blocks, markerID);
  const o = at ? actions?.objectAt?.(at.index, at.marker.position) ?? null : null;
  return o?.kind === 'moveFlat' ? o : null;
}

/** The parenting itself: `stand` rides `offset`, its scene marker's live travel (sceneMarkerMover's `offset`, which the
 *  ActionSystem writes IN PLACE - the tween, a peer's act and the room memory's restore alike). The stand keeps it as
 *  `off` (questStandBox reads it) and its billboard batch draws through it as its origin uniform - set now, or by the
 *  host's fill when the batch is minted later (the host calls this again then). The array is the mover's: nothing is
 *  allocated, and the stand lets it go when it is freed. A dead stand, or no offset, rides nothing.
 *  The travel is read WHOLE, from the marker's start: DFU's reparent keeps the item's world position at the moment it
 *  is parented, which is the marker's start on every path DFU has but one - the layout stands the item and a load's
 *  action state lands after it. Online the room's word lands in either order (a welcome before a re-mount), so the
 *  whole travel is the only reading that agrees with DFU's entry and load. The one difference: a quest that hot-places
 *  an item onto a marker that ALREADY moved this visit stands it on the marker, where DFU leaves it off by the travel. */
export function rideSceneMarker(stand, offset) {
  if (!stand || stand.dead || !offset) return;
  stand.off = offset;
  if (stand.batch) stand.batch.origin = offset;
}

/** Where a stood quest flat IS now, as its activation box: the billboard's footprint (`width` square, `height` tall,
 *  base-anchored) over its placed base plus `off`, the travel of the scene marker it rides (null for a stand that
 *  rides none). Read live, so the box is wherever the marker is - in whatever order the scene learnt the marker's
 *  pose. */
export function questStandBox(s) {
  const o = s.off;
  const x = o ? s.x + o[0] : s.x, y = o ? s.y + o[1] : s.y, z = o ? s.z + o[2] : s.z;
  return { min: [x - s.width / 2, y, z - s.width / 2], max: [x + s.width / 2, y + s.height, z + s.width / 2] };
}

// ---- FIELD BUGS 2026-10-04d QUEST-MARKERS: the building's backstop ----
//
// A building's quest marker with nothing under it - an author's marker outside the walls or under the floor, a void
// the town packs' curation does not list (markerCuration.js lists every one the packs were measured to hold) - stood
// its person in the air (AlignBillboardToGround finds no floor within 4 m and leaves the billboard where it is,
// GameObjectHelper.cs:1040), its item likewise (AddQuestItem never rays) and its foe falling. The interior host stands it
// at the site's nearest marker with a floor under it instead, else at the room's nearest enter marker; a marker with a
// floor under it stands exactly as DFU stands it. Daggerfall's own blocks hold one such design (WEAPAL02 #1, SENT6 #11:
// three markers over nothing), which no town of the game lays out.

/** AlignBillboardToGround's reach (GameObjectHelper.cs:1040, a distance of 4) - how far under a building's quest marker a
 *  floor must be for the marker to stand anything. */
export const MARKER_FLOOR_REACH = 4;

/** The site's other quest markers where markerScenePosition puts them (the building's own frame), nearest `marker`
 *  first: every spawn and item marker of the site but those standing where it stands. */
export function siteMarkerSpots(siteDetails, marker) {
  const own = marker?.flatPosition ? markerScenePosition(marker) : null;
  if (!own) return [];
  const d2 = (p) => (p.x - own.x) ** 2 + (p.y - own.y) ** 2 + (p.z - own.z) ** 2;
  return [...(siteDetails?.questSpawnMarkers ?? []), ...(siteDetails?.questItemMarkers ?? [])]
    .filter((m) => m?.flatPosition)
    .map(markerScenePosition)
    .filter((p) => d2(p) > 1e-9)
    .sort((a, b) => d2(a) - d2(b));
}

/** THE BACKSTOP'S LAW: where a building's quest resource stands - `own` when `hasFloor(own)`, else the first of
 *  `spots` (in the host's order: the site's other markers nearest first, then the enter markers nearest first) with a
 *  floor, else `own`, as DFU stands it. */
export function standSpot(own, spots, hasFloor) {
  if (hasFloor(own)) return own;
  for (const p of spots ?? []) if (hasFloor(p)) return p;
  return own;
}

// ---- PlaceFoeFreely (CreateFoe.cs:260-345) - the raycast ring ----

/** The ring constants; TryPlacement's wilderness arm widens to 8/25
 *  (:252-257), every other site uses the defaults. */
export const PLACE_FOE_DEFAULTS = Object.freeze({
  minDistance: 5, maxDistance: 20,
  wildernessMinDistance: 8, wildernessMaxDistance: 25,
  overlapSphereRadius: 0.65, separationDistance: 1.25, maxFloorDistance: 4,
});

/** One placement attempt, just outside the player's view unless the
 *  caller clears lineOfSightCheck (DFU's spawner field; SoulBound's
 *  release passes false). env:
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
export function placeFoeFreely(env, { minDistance = PLACE_FOE_DEFAULTS.minDistance, maxDistance = PLACE_FOE_DEFAULTS.maxDistance, lineOfSightCheck = true } = {}) {   // AUDIT 68 S30-placefoe-defaults-dup: the table, not a second copy of it
  const C = PLACE_FOE_DEFAULTS;
  const rolls = env.rolls ?? Math.random;

  // SD1: DFU's rotation has TWO arms (:141-155) and only the first was
  // here. LineOfSightCheck true tries to spawn just outside the
  // player's field of view; false means "don't care" - DFU's own
  // comment says `e.g. at rest` - and takes a bearing anywhere in the
  // circle. It is not a corner case: SoulBound's break release passes
  // FALSE (SoulBound.cs:100), so a released soul is allowed to appear
  // in front of you, which is the whole character of the effect. The
  // quest arm that shipped this law is the LOS one and stays default.
  let yawDegrees;
  if (lineOfSightCheck) {
    // Select a left or right direction outside of camera FOV
    let directionAngle = env.fovDegrees;
    directionAngle += rolls() * 4;
    yawDegrees = (rolls() > 0.5) ? -directionAngle : directionAngle;
  } else {
    // Don't care about player's field of view (e.g. at rest)
    yawDegrees = rolls() * 360;
  }
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
