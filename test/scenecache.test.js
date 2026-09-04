// P1: the scene cache and the permanent set, against
// SerializableStateManager.cs's scene half.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  interiorSceneName, worldSceneName, LOOT_CONTAINER_TYPES,
  createSceneCache, addPermanentScene, containsPermanentScene, removePermanentScene,
  cacheScene, restoreCachedScene, clearSceneCache,
  snapshotSceneCache, restoreSceneCache,
} from '../src/systems/sceneCache.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const chest = (n) => ({ containerType: LOOT_CONTAINER_TYPES.HouseContainers, id: n, items: [n] });
const corpse = (n) => ({ containerType: LOOT_CONTAINER_TYPES.CorpseMarker, id: n });
const door = (n) => ({ id: n, open: true });

test('P1: the scene NAMES are the cache key, verbatim (:79-82, :133-136)', () => {
  // a reformatting here is a silent cache miss, not an error - which
  // is why these are pinned character for character
  assert.equal(interiorSceneName(1291010263, 65794),
    'DaggerfallInterior [MapID=1291010263, BuildingKey=65794]');
  assert.equal(worldSceneName(2, 2), 'DaggerfallWorld [mapX=2, mapY=2]');
  assert.equal(worldSceneName(5, 5), 'DaggerfallWorld [mapX=5, mapY=5]');
  // the two namespaces cannot collide
  assert.notEqual(interiorSceneName(0, 0), worldSceneName(0, 0));
  // and the enum is carried whole - a partial one is how the next
  // reader gets the numbering wrong
  assert.deepEqual({ ...LOOT_CONTAINER_TYPES },
    { Nothing: 0, RandomTreasure: 1, CorpseMarker: 2, DroppedLoot: 3, ShopShelves: 4, HouseContainers: 5 });
});

test('P1: the permanent set is a membership test, and both edges are no-ops (:68-82)', () => {
  const c = createSceneCache();
  const s = interiorSceneName(1, 2);
  assert.equal(containsPermanentScene(c, s), false);
  addPermanentScene(c, s);
  addPermanentScene(c, s);
  assert.equal(containsPermanentScene(c, s), true);
  assert.equal(c.permanent.size, 1, 'adding twice adds once');
  removePermanentScene(c, s);
  assert.equal(containsPermanentScene(c, s), false);
  // removing one that was never there is not an error - List.Remove
  // answers false and DFU ignores it
  assert.doesNotThrow(() => removePermanentScene(c, 'never cached'));
});

test('P1: RESTORING CONSUMES - the cache is a hand-off, not a store (:100-113)', () => {
  const c = createSceneCache();
  const s = interiorSceneName(1, 2);
  assert.equal(restoreCachedScene(c, s), null, 'a scene never cached answers null');

  cacheScene(c, s, { lootContainers: [chest(1)], actionDoors: [door(9)] });
  const first = restoreCachedScene(c, s);
  assert.equal(first.lootContainers.length, 1);
  assert.equal(first.actionDoors[0].id, 9);
  // ...and the SECOND read finds nothing, because the first deleted it
  assert.equal(restoreCachedScene(c, s), null,
    're-entering twice without leaving finds nothing the second time');
  assert.equal(c.scenes.size, 0);
});

test('P1: the cache DETACHES from the live scene (:84-98)', () => {
  const c = createSceneCache();
  const s = worldSceneName(3, 4);
  const live = [chest(1)];
  cacheScene(c, s, { lootContainers: live });
  // the world moves on and the live objects are mutated or destroyed
  live[0].id = 999;
  live.length = 0;
  const back = restoreCachedScene(c, s);
  assert.equal(back.lootContainers.length, 1, 'the cache kept its own copy');
  assert.equal(back.lootContainers[0].id, 1, 'and it did not follow the live object');
});

test('P1: only loot, doors and the player\'s own piles are cached - enemies are NOT (:88-96)', () => {
  // DFU's own comment says so, and writes empty arrays for the other
  // two stateful types. A shop's occupants are rebuilt every entry.
  // AUDIT 58: the THIRD array is the player's dropped piles, which are
  // LootContainerTypes.DroppedLoot rows inside DFU's own
  // GetLootContainerData (SerializableStateManager.cs:343-354) and a
  // separate pool in this port - so the store carries three, not two.
  const c = createSceneCache();
  const s = interiorSceneName(1, 2);
  cacheScene(c, s, { lootContainers: [chest(1)], actionDoors: [door(2)], enemies: [{ id: 'rat' }] });
  const back = restoreCachedScene(c, s);
  assert.deepEqual(Object.keys(back).sort(), ['actionDoors', 'droppedPiles', 'lootContainers']);
  assert.equal(back.enemies, undefined, 'an enemy list handed in is not carried');
  // an empty cache call is legal and stores empty arrays
  cacheScene(c, s);
  assert.deepEqual(restoreCachedScene(c, s), { lootContainers: [], actionDoors: [], droppedPiles: [] });
});

test('AUDIT 58 (ID1): the player\'s DROPPED PILES ride the store, the save and the world move', () => {
  // The producer (worldModes.currentSceneState) built the list and the
  // consumer (restoreInteriorScene -> restorePiles) read it back, but
  // the STORE between them destructured only two keys - so
  // data.droppedPiles was always undefined and restorePiles(undefined)
  // is a pure CLEAR (droppedLoot.js kills every live pile, then
  // iterates `saved ?? []`). Drop a sword on a shop floor, walk out,
  // walk back in: gone. DFU has no such gap - CacheScene stores
  // GetLootContainerData(), which walks EVERY SerializableLootContainer
  // with ShouldSave, player-dropped DaggerfallLoot included
  // (SerializableStateManager.cs:88-96, :343-354).
  const pile = () => ({ pos: [1, 2, 3], record: 7, items: [{ n: 1 }] });
  const c = createSceneCache();
  const shop = interiorSceneName(1, 2);
  cacheScene(c, shop, { lootContainers: [chest(1)], actionDoors: [], droppedPiles: [pile()] });
  const back = restoreCachedScene(c, shop);
  assert.equal(back.droppedPiles.length, 1, 'the floor is cached with the shelves');
  assert.deepEqual(back.droppedPiles[0].pos, [1, 2, 3]);
  assert.equal(back.droppedPiles[0].record, 7);
  assert.deepEqual(back.droppedPiles[0].items, [{ n: 1 }]);

  // the nested record is DEEP-copied, so tearing the scene down after
  // the cache write cannot reach into it
  const c2 = createSceneCache();
  const live = pile();
  cacheScene(c2, shop, { droppedPiles: [live] });
  live.pos[0] = 999; live.items[0].n = 42; live.items.length = 0;
  const kept = restoreCachedScene(c2, shop);
  assert.deepEqual(kept.droppedPiles[0].pos, [1, 2, 3], 'the pos array is the cache\'s own');
  assert.deepEqual(kept.droppedPiles[0].items, [{ n: 1 }], 'and so are the items');

  // ...and they reach the SAVE envelope, and come back from it
  const c3 = createSceneCache();
  addPermanentScene(c3, shop);
  cacheScene(c3, shop, { lootContainers: [chest(1)], droppedPiles: [pile()] });
  const snap = JSON.parse(JSON.stringify(snapshotSceneCache(c3)));
  assert.equal(snap.scenes[0].droppedPiles.length, 1, 'GetSceneCache writes them (:148-172)');
  const fresh = restoreSceneCache(createSceneCache(), snap);
  assert.equal(restoreCachedScene(fresh, shop).droppedPiles[0].record, 7);
  // a save written before the store carried them stays loadable
  const legacy = restoreSceneCache(createSceneCache(),
    { permanentScenes: [], scenes: [{ sceneName: shop, lootContainers: [], actionDoors: [] }] });
  assert.deepEqual(restoreCachedScene(legacy, shop).droppedPiles, []);

  // a permanent scene keeps its piles across the WORLD MOVE: a pile is
  // not a CorpseMarker, and the filter tests containerType alone
  const c4 = createSceneCache();
  addPermanentScene(c4, shop);
  cacheScene(c4, shop, { lootContainers: [chest(1), corpse(2)], droppedPiles: [pile()] });
  clearSceneCache(c4, { start: false });
  const moved = restoreCachedScene(c4, shop);
  assert.deepEqual(moved.lootContainers.map((l) => l.id), [1], 'sans corpses');
  assert.equal(moved.droppedPiles.length, 1, 'what you left on your own floor survives');
});

test('P1: a NEW GAME clears both; a world move clears only the ordinary (:115-148)', () => {
  const build = () => {
    const c = createSceneCache();
    const home = interiorSceneName(1, 100);
    const shop = interiorSceneName(1, 200);
    addPermanentScene(c, home);
    cacheScene(c, home, { lootContainers: [chest(1)], actionDoors: [door(1)] });
    cacheScene(c, shop, { lootContainers: [chest(2)] });
    return { c, home, shop };
  };

  // start=true is the new-character path: everything goes, including
  // the permanent SET itself
  const a = build();
  clearSceneCache(a.c, { start: true });
  assert.equal(a.c.scenes.size, 0);
  assert.equal(a.c.permanent.size, 0, 'the permanent set is emptied too');
  assert.equal(containsPermanentScene(a.c, a.home), false);

  // start=false keeps the permanent scenes' DATA and drops the rest
  const b = build();
  clearSceneCache(b.c, { start: false });
  assert.equal(b.c.scenes.size, 1);
  assert.ok(b.c.scenes.has(b.home), 'the rented room remembers');
  assert.equal(b.c.scenes.has(b.shop), false, 'the ordinary shop forgets');
  assert.equal(containsPermanentScene(b.c, b.home), true, 'and it is still permanent');
  assert.equal(restoreCachedScene(b.c, b.home).lootContainers[0].id, 1);

  // ...and the default is start=TRUE, which is DFU's own signature
  const d = build();
  clearSceneCache(d.c);
  assert.equal(d.c.permanent.size, 0);
});

test('P1: the permanent clear STRIPS THE CORPSES - and nothing else (:131-140)', () => {
  const c = createSceneCache();
  const home = interiorSceneName(1, 100);
  addPermanentScene(c, home);
  cacheScene(c, home, {
    lootContainers: [chest(1), corpse(2), chest(3), corpse(4)],
    actionDoors: [door(7)],
  });
  clearSceneCache(c, { start: false });
  const back = restoreCachedScene(c, home);
  assert.deepEqual(back.lootContainers.map((l) => l.id), [1, 3],
    'a body left in your own house does not survive the world moving on');
  assert.deepEqual(back.actionDoors.map((d) => d.id), [7], 'but the doors do');
  // and the strip happens ONLY at that clear - a plain cache/restore
  // keeps a corpse, which is how a body survives stepping outside
  const c2 = createSceneCache();
  cacheScene(c2, home, { lootContainers: [corpse(2)] });
  assert.equal(restoreCachedScene(c2, home).lootContainers.length, 1);
});

test('P1: a permanent scene never entered carries nothing (:143-144)', () => {
  const c = createSceneCache();
  const ship = worldSceneName(2, 2);
  addPermanentScene(c, ship);              // bought, never boarded
  clearSceneCache(c, { start: false });
  assert.equal(c.scenes.size, 0, 'nothing cached means nothing to keep');
  assert.equal(containsPermanentScene(c, ship), true, 'but it stays permanent');
  // ...and once it IS entered and cached, it starts surviving
  cacheScene(c, ship, { lootContainers: [chest(1)] });
  clearSceneCache(c, { start: false });
  assert.equal(c.scenes.size, 1);
});

test('P1: the cache round-trips through a save (:150-190)', () => {
  const c = createSceneCache();
  const home = interiorSceneName(1, 100);
  const shop = interiorSceneName(1, 200);
  addPermanentScene(c, home);
  cacheScene(c, home, { lootContainers: [chest(1), corpse(2)], actionDoors: [door(3)] });
  cacheScene(c, shop, { lootContainers: [chest(9)] });

  const snap = snapshotSceneCache(c);
  // DFU writes an ARRAY of named entries, not a dictionary - which is
  // what a JSON round-trip needs anyway
  assert.ok(Array.isArray(snap.scenes));
  assert.deepEqual(snap.permanentScenes, [home]);
  assert.equal(JSON.parse(JSON.stringify(snap)).scenes.length, 2, 'it really is JSON-safe');

  const fresh = restoreSceneCache(createSceneCache(), JSON.parse(JSON.stringify(snap)));
  assert.equal(containsPermanentScene(fresh, home), true);
  assert.equal(fresh.scenes.size, 2);
  assert.deepEqual(restoreCachedScene(fresh, home).lootContainers.map((l) => l.id), [1, 2],
    'the corpse survives a SAVE - only the permanent clear strips it');
  // the snapshot is DETACHED from the live cache
  const c2 = createSceneCache();
  cacheScene(c2, home, { lootContainers: [chest(1)] });
  const s2 = snapshotSceneCache(c2);
  c2.scenes.get(home).lootContainers[0].id = 42;
  assert.equal(s2.scenes[0].lootContainers[0].id, 1, 'the snapshot did not follow the cache');
  // an EMPTY or absent snapshot restores an empty cache rather than throwing
  assert.equal(restoreSceneCache(createSceneCache(), null).scenes.size, 0);
  assert.equal(restoreSceneCache(createSceneCache(), {}).permanent.size, 0);
});

test('P1: the cache rides the PLAYER SAVE, permanent set and all', () => {
  // A cache that survives a walk outside but not a reload is a worse
  // bug than not remembering at all: the room is furnished until you
  // quit and then quietly is not.
  const e = {
    name: 'Rin', stats: {}, skills: [], skillUses: [], items: [],
    spells: [], activeEffects: [],
    sceneCache: createSceneCache(),
  };
  const home = interiorSceneName(1, 100);
  const shop = interiorSceneName(1, 200);
  addPermanentScene(e.sceneCache, home);
  cacheScene(e.sceneCache, home, { lootContainers: [chest(1)], actionDoors: [door(3)] });
  cacheScene(e.sceneCache, shop, { lootContainers: [chest(9)] });

  const snap = snapshotPlayer(e, {});
  const loaded = { stats: {}, items: [] };
  restorePlayer(loaded, JSON.parse(JSON.stringify(snap)));

  assert.equal(containsPermanentScene(loaded.sceneCache, home), true, 'the permanent set came back');
  assert.equal(loaded.sceneCache.scenes.size, 2);
  assert.deepEqual(restoreCachedScene(loaded.sceneCache, home).actionDoors.map((d) => d.id), [3]);
  // it really is a live cache and not a plain object - the Map and Set
  // are rebuilt, so the API works on it straight away
  assert.ok(loaded.sceneCache.scenes instanceof Map);
  assert.ok(loaded.sceneCache.permanent instanceof Set);
  // a PRE-P1 save restores an EMPTY cache rather than throwing
  const old = { ...snap };
  delete old.sceneCache;
  const fresh = { stats: {}, items: [] };
  restorePlayer(fresh, old);
  assert.equal(fresh.sceneCache.scenes.size, 0);
  assert.equal(fresh.sceneCache.permanent.size, 0);
});
