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

/** The player's own dropped piles, deep-copied. They are the third
 *  thing a scene holds in this port because the port keeps a pile's
 *  position and its items in a nested record, where DFU's
 *  LootContainerData_v1 is flat - so a shallow `{...p}` would share
 *  the live arrays with the scene the caller is about to tear down. */
const copyPiles = (piles) => piles.map((p) => ({
  ...p,
  pos: [...p.pos],
  items: (p.items ?? []).map((it) => ({ ...it })),
}));

/** One scene entry, detached from its caller - AUDIT 68 S31-scenecache-triple-copy: the store, the save and the
 *  load each wrote this copy by hand, and the save's drifted once (TERRAIN-SCALE1: torches and camps gone on load).
 *  A field an older entry never carried reads empty. */
const copySceneEntry = (d) => ({
  lootContainers: (d.lootContainers ?? []).map((c) => ({ ...c })),
  actionDoors: (d.actionDoors ?? []).map((x) => ({ ...x })),
  droppedPiles: copyPiles(d.droppedPiles ?? []),
  // SURV3: the port's own loose objects ride the same hand-off. HT1's torches were HANDED to this door and dropped
  // on the floor - a torch left on a pixel never came back with it. The camps came with the fix.
  droppedTorches: (d.droppedTorches ?? []).map((t) => ({ ...t, position: [...(t.position ?? [])] })),
  camps: (d.camps ?? []).map((c) => ({ ...c, pos: [...(c.pos ?? [])] })),
  // DECOR1c: what an owner placed in the offline house or ship (net/decorLaw.js's pieces, the building's frame -
  // an online home's are the account service's and are not written here), and what the storage pieces hold (by
  // piece id, the online home's too - the owner's things are the owner's save's). A record written before DECOR1
  // carries neither and reads as a room with nothing placed.
  decor: (d.decor ?? []).map((p) => ({
    ...p, pos: [...(p.pos ?? [])], rot: [...(p.rot ?? [])], flat: p.flat ? [...p.flat] : null,
    light: p.light ? { ...p.light, color: [...(p.light.color ?? [])] } : null,
  })),
  decorItems: Object.fromEntries(Object.entries(d.decorItems ?? {}).map(([id, list]) => [id, (list ?? []).map((it) => ({ ...it }))])),
  // DECOR2a: the owner's own items standing in the room, by piece id - the save's in every room, the online home's
  // too (its piece is the service's, the thing itself the owner's). A record written before DECOR2 carries none.
  decorOwn: Object.fromEntries(Object.entries(d.decorOwn ?? {}).map(([id, item]) => [id, { ...item }])),
  // TERRAIN-SCALE1: `frame` names what the positions above are measured from ('building': the interior's own
  // building, as DFU's SerializableLootContainer restores an interior container by its localPosition; null: the
  // writer's own frame), and `terrainScale` the ground an exterior height stood on - absent on an entry written
  // before either was carried, which the restoring host reads as the old raw frame on the prefab's 1.5.
  frame: d.frame ?? null, terrainScale: d.terrainScale ?? null,
});

/** CacheScene (:84-98). DFU caches exactly TWO kinds of thing for a
 *  scene - loot containers and action doors - and explicitly writes
 *  empty arrays for the other two stateful types, which is its own
 *  comment saying so ("Only cache loot containers & action doors").
 *  Enemies are NOT cached, so a shop's occupants are rebuilt fresh
 *  every entry; that is DFU's behaviour and not an omission here.
 *
 *  AUDIT 58 (ID1's missing half): `droppedPiles` is the THIRD field
 *  the interior host builds and this store used to throw away. DFU
 *  has no third field because it needs none - CacheScene stores
 *  GetLootContainerData() (SerializableStateManager.cs:88-96), which
 *  walks EVERY SerializableLootContainers value with ShouldSave
 *  (:343-354), and a player-dropped DaggerfallLoot of
 *  LootContainerTypes.DroppedLoot is one of them. The port keeps its
 *  own dropped-pile pool separate from the interior's shelves, so
 *  the same law reaches it as a third array rather than more rows in
 *  the first. Destructuring only two keys made the port's own
 *  LOOT_CONTAINER_TYPES.DroppedLoot unreachable and cleared the floor
 *  of every shop on the way out. */
export function cacheScene(cache, sceneName, entry = {}) {
  cache.scenes.set(sceneName, copySceneEntry(entry));
}

/** RestoreCachedScene (:100-113). Answers null for a scene never
 *  cached, and DELETES the entry it hands back - see the header. */
export function restoreCachedScene(cache, sceneName) {
  const data = cache.scenes.get(sceneName) ?? null;
  cache.scenes.delete(sceneName);
  return data;
}

/** DECOR1e: A SOLD ROOM'S PLACED PIECES, taken out of its scene and answered as they were - none of them stands again
 *  and none is paid back twice (the offline house's and the ship's live here, DECOR1c). What they held stays in the
 *  scene and goes with it at the next clearing, as a sold house's own containers' things do. */
export function takeSceneDecor(cache, sceneName) {
  const d = cache.scenes.get(sceneName);
  if (!d?.decor?.length) return [];
  const pieces = d.decor;
  d.decor = [];
  return pieces;
}

/** DECOR2a: A SOLD ROOM'S OWN ITEMS - the owner's things that stood in it - taken out of its scene for the pack (Mac:
 *  "Back to pack"), and answered as they were; none comes back twice. */
export function takeSceneOwn(cache, sceneName) {
  const d = cache.scenes.get(sceneName);
  const items = Object.values(d?.decorOwn ?? {});
  if (d) d.decorOwn = {};
  return items;
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
      // `...data` carries droppedPiles through untouched, which is
      // right: a player-dropped pile is not a CorpseMarker, and DFU's
      // filter (:131-140) tests containerType alone - so what you left
      // on your own floor survives the world moving on.
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
    // the same array GetSceneCache writes (:148-172) - the piles are loot containers on DFU's side, so they ride
    // the envelope, and every other field an entry holds rides with them
    scenes: [...cache.scenes.entries()].map(([sceneName, d]) => ({ sceneName, ...copySceneEntry(d) })),
  };
}
export function restoreSceneCache(cache, snap) {
  cache.scenes = new Map((snap?.scenes ?? []).map((e) => [e.sceneName, copySceneEntry(e)]));   // `?? []` inside keeps a pre-ID1 save loadable
  cache.permanent = new Set(snap?.permanentScenes ?? []);
  return cache;
}

// EVERY CALLER OF THIS CACHE IS WIRED. The last one to land was the
// HOUSE deed's AddPermanentScene, which needed the building directory
// to know which building was bought: H1/H2 shipped both halves -
// banking.js:201 calls the hook inside allocateHouseToPlayer with the
// bought building's own mapId and key, and worldModes.js:2720 supplies
// it as addPermanentScene(sceneCache(), interiorSceneName(mapId, key)),
// reached from the bank's buy arm (:2144-2148), the knightly gift
// (:2752) and :4933, with sellHouse dropping the scene again (:2184). The
// tavern's rented room (tavern.js:143) and the ship's two scenes
// (banking.js:310-312) name themselves and were wired before it.
