// P1 - THE SCENE CACHE AND THE PERMANENT SET:
// SerializableStateManager's scene half (MIT, Daggerfall Workshop),
// plus the two GetSceneName formats that key it.
//
// The port has had no scene cache at all: every interior is rebuilt
// from the block data on entry, so anything the player changed inside
// one is gone the moment they step out. Drop a sword in a shop, leave,
// come back - the sword never existed. Empty a shelf and it restocks.
// Open a door and it re-closes.
//
// It is also the shared blocker three slices flagged separately: the
// tavern's rented room "keeps its interior loaded across a save"
// (U39), and both of banking's deeds do the same for a bought house
// and a bought ship (B1).
//
// THE TWO-TIER MODEL, which is the whole design:
//
//   the CACHE is keyed by scene NAME and holds what the player
//   changed. It is written on the way OUT of a scene and read on the
//   way back IN - and the read DELETES the entry, so a scene is
//   restored exactly once per caching.
//
//   the PERMANENT SET is a list of scene names that survive
//   ClearSceneCache. Everything else is dropped when the world moves
//   on, which is what makes an ordinary shop forget and a rented room
//   remember.
//
// THREE THINGS WORTH NAMING:
//
// 1. RESTORING CONSUMES (:105). RestoreCachedScene deletes the entry
//    after handing it back, so re-entering a scene twice without
//    leaving it in between finds nothing the second time. The cache is
//    a hand-off, not a store.
//
// 2. A NEW GAME CLEARS BOTH; A WORLD MOVE CLEARS ONLY THE ORDINARY
//    (:114-148). `ClearSceneCache(true)` empties the cache AND the
//    permanent set - it is the new-character path. `false` keeps the
//    permanent scenes' data and throws the rest away.
//
// 3. AND IT STRIPS THE CORPSES (:131-140). A permanent scene keeps its
//    loot across that clear EXCEPT its corpse markers, which are
//    filtered out one by one. So a body left in your own house
//    disappears when the world moves on while the chest beside it does
//    not. DFU's own comment on the line says "sans corpses".

// ONE DFU MEMBER, ONE EXPORT: DaggerfallLootDataTables
// .randomTreasureArchive already lives in systems/loot.js.
import { RANDOM_TREASURE_ARCHIVE } from './loot.js';

/** DaggerfallInterior.GetSceneName (:79-82) and
 *  StreamingWorld.GetSceneName (:133-136), verbatim - the exact
 *  strings are the cache KEY, so a reformatting is a silent cache
 *  miss rather than an error. */
export const interiorSceneName = (mapId, buildingKey) =>
  `DaggerfallInterior [MapID=${mapId}, BuildingKey=${buildingKey}]`;
export const worldSceneName = (mapPixelX, mapPixelY) =>
  `DaggerfallWorld [mapX=${mapPixelX}, mapY=${mapPixelY}]`;

/** LootContainerTypes (DaggerfallUnityEnums.cs:558-566). The port
 *  needs the enum for ONE reason - telling a corpse from a chest at
 *  the permanent-scene clear - but carries it whole, because a
 *  partial enum is how the next reader gets the numbering wrong. */
export const LOOT_CONTAINER_TYPES = Object.freeze({
  Nothing: 0, RandomTreasure: 1, CorpseMarker: 2,
  DroppedLoot: 3, ShopShelves: 4, HouseContainers: 5,
});

/** THE DROPPED PILE, both ways.
 *
 *  GetLootContainerData (:343-354) walks EVERY registered container
 *  whose ShouldSave is true, and SerializableLootContainer.HasChanged
 *  (:223-226) excludes only shop shelves and house containers that
 *  were never stocked - so a pile the player dropped, and a corpse,
 *  are cached with the shelves and ride the save. (That is the whole
 *  reason the permanent-scene clear below has to strip corpses
 *  specifically: they are in there.)
 *
 *  These two are GetSaveData's custom-drop half
 *  (SerializableLootContainer.cs:55-81) and the arm
 *  RestoreLootContainerData takes for a container the rebuilt scene
 *  does NOT own (:445-453): `CreateDroppedLootContainer(player,
 *  loadID, textureArchive, textureRecord)` and then the position and
 *  items off the record. The fields carried are exactly the ones
 *  those two lines read; a host's pile shape ({id, pos, record,
 *  items}) is droppedLoot.js's.
 *
 *  ONE thing DFU keeps that the port does not: the loadID survives
 *  the round trip there, because CreateDroppedLootContainer is handed
 *  the saved key. droppedLoot.restorePiles mints a fresh id, so the
 *  restored pile answers a new activation key - session-local
 *  identity, never persisted or compared, so nothing reads the
 *  difference. */
export function droppedLootRecord(pile) {
  return {
    containerType: LOOT_CONTAINER_TYPES.DroppedLoot,
    key: `droppedLoot:${pile.id}`,
    customDrop: true,
    currentPosition: [pile.pos[0], pile.pos[1], pile.pos[2]],
    textureArchive: RANDOM_TREASURE_ARCHIVE,
    textureRecord: pile.record,
    items: (pile.items ?? []).map((it) => ({ ...it })),
    stockedDate: 0,
  };
}
export function droppedLootPile(rec) {
  return {
    items: (rec.items ?? []).map((it) => ({ ...it })),
    pos: [...(rec.currentPosition ?? [0, 0, 0])],
    // "a restore must not reroll the icon" - the SAVED record, which
    // is what DFU hands CreateDroppedLootContainer (:450).
    record: rec.textureRecord,
  };
}

/** A fresh manager. `scenes` is DFU's sceneDataCache and `permanent`
 *  its permanentScenes; a Set rather than a List because every
 *  operation on it is a membership test and DFU guards its own Add
 *  with Contains anyway (:68-72). */
export function createSceneCache() {
  return { scenes: new Map(), permanent: new Set() };
}

/** AddPermanentScene / ContainsPermanentScene / RemovePermanentScene
 *  (:68-82). Adding twice is a no-op, and removing one that was never
 *  there is not an error - List.Remove answers false and DFU ignores
 *  it. */
export const addPermanentScene = (cache, sceneName) => { cache.permanent.add(sceneName); };
export const containsPermanentScene = (cache, sceneName) => cache.permanent.has(sceneName);
export const removePermanentScene = (cache, sceneName) => { cache.permanent.delete(sceneName); };

/** CacheScene (:84-98). DFU caches exactly TWO kinds of thing for a
 *  scene - loot containers and action doors - and explicitly writes
 *  empty arrays for the other two stateful types, which is its own
 *  comment saying so ("Only cache loot containers & action doors").
 *  Enemies are NOT cached, so a shop's occupants are rebuilt fresh
 *  every entry; that is DFU's behaviour and not an omission here. */
export function cacheScene(cache, sceneName, { lootContainers = [], actionDoors = [] } = {}) {
  cache.scenes.set(sceneName, {
    lootContainers: lootContainers.map((c) => ({ ...c })),
    actionDoors: actionDoors.map((d) => ({ ...d })),
  });
}

/** RestoreCachedScene (:100-113). Answers null for a scene never
 *  cached, and DELETES the entry it hands back - see the header. */
export function restoreCachedScene(cache, sceneName) {
  const data = cache.scenes.get(sceneName) ?? null;
  cache.scenes.delete(sceneName);
  return data;
}

/** ClearSceneCache (:115-148). `start` is DFU's own parameter name
 *  and its default: TRUE is the new-game path and empties everything,
 *  FALSE keeps the permanent scenes' data - minus their corpse
 *  markers - and throws the rest away.
 *
 *  Note the second arm keeps only scenes that are BOTH permanent AND
 *  already cached: a permanent scene the player has never entered has
 *  nothing to carry, and DFU's `sceneData.Count > 0` guard drops it
 *  rather than storing an empty record. */
export function clearSceneCache(cache, { start = true } = {}) {
  if (start) {
    cache.scenes.clear();
    cache.permanent.clear();
    return;
  }
  const kept = new Map();
  for (const sceneName of cache.permanent) {
    const data = cache.scenes.get(sceneName);
    if (!data) continue;
    kept.set(sceneName, {
      ...data,
      // "sans corpses" - a body left in your own house does not
      // survive the world moving on, though the chest beside it does
      lootContainers: data.lootContainers.filter(
        (c) => c.containerType !== LOOT_CONTAINER_TYPES.CorpseMarker,
      ),
    });
  }
  cache.scenes = kept;
}

/** GetSceneCache / RestoreSceneCache (:150-190) - the save shape.
 *  DFU writes the cache as an ARRAY of named entries rather than a
 *  dictionary, which is what a JSON round-trip needs anyway. */
export function snapshotSceneCache(cache) {
  return {
    permanentScenes: [...cache.permanent],
    scenes: [...cache.scenes.entries()].map(([sceneName, d]) => ({
      sceneName,
      lootContainers: d.lootContainers.map((c) => ({ ...c })),
      actionDoors: d.actionDoors.map((x) => ({ ...x })),
    })),
  };
}
export function restoreSceneCache(cache, snap) {
  cache.scenes = new Map((snap?.scenes ?? []).map((e) => [e.sceneName, {
    lootContainers: (e.lootContainers ?? []).map((c) => ({ ...c })),
    actionDoors: (e.actionDoors ?? []).map((d) => ({ ...d })),
  }]));
  cache.permanent = new Set(snap?.permanentScenes ?? []);
  return cache;
}

// FLAGGED, with the slice it waits on:
//  - the HOUSE deed's AddPermanentScene still needs the building
//    directory to know which building was bought; the tavern's rented
//    room and the ship's two scenes name themselves and are wired.
