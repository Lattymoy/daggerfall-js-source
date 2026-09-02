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

// EVERY CALLER OF THIS CACHE IS WIRED. The last one to land was the
// HOUSE deed's AddPermanentScene, which needed the building directory
// to know which building was bought: H1/H2 shipped both halves -
// banking.js:198 calls the hook inside allocateHouseToPlayer with the
// bought building's own mapId and key, and worldModes.js:1972 supplies
// it as addPermanentScene(sceneCache(), interiorSceneName(mapId, key)),
// reached from the bank's buy arm (:2144-2148), the knightly gift
// (:2752) and :4933, with sellHouse dropping the scene again (:2184). The
// tavern's rented room (tavern.js:143) and the ship's two scenes
// (banking.js:291-293) name themselves and were wired before it.
