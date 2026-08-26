// AUDIT 26 (save wave, items 2.1 + 2.2): what an INTERIOR's scene
// cache carries, against SerializableStateManager's scene half.
//
// 2.1 - CacheScene (:88-90) caches GetLootContainerData(), which
//       serialises EVERY registered container whose ShouldSave is
//       true; SerializableLootContainer.HasChanged (:223-226) excludes
//       only un-stocked shop shelves and house containers. So a
//       DROPPED PILE inside a building is cached and rides the save,
//       and the permanent-scene clear's corpse strip (:136-140) only
//       exists because those are cached too. The port built the list
//       from shelves and cupboards ONLY - and worse, the interior
//       host's drop path went through the OUTER host's inventory
//       window, minting into the EXTERIOR pool at the building's
//       footprint: the sword left the pack and landed on the street.
//
// 2.2 - CacheScene's second array is GetActionDoorData(), i.e.
//       ActionDoorData_v1 (SerializableGameObject.cs:329-337) -
//       loadID, currentLockValue, currentRotation, currentState,
//       actionPercentage, lockpickFailedSkillLevel. The port cached
//       `{key, state}`, so a door caught mid-swing re-entered snapped
//       and a lock changed inside did not survive the visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LOOT_CONTAINER_TYPES, droppedLootRecord, droppedLootPile,
  createSceneCache, cacheScene, restoreCachedScene, clearSceneCache,
  addPermanentScene, snapshotSceneCache, restoreSceneCache,
} from '../src/systems/sceneCache.js';
import { RANDOM_TREASURE_ARCHIVE } from '../src/systems/loot.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { ActionSystem, DOOR_OPEN_DURATION } from '../src/world/actionSystem.js';

const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

// --- droppedLoot harness (the audit17e stub shape) ---------------
function lootDeps() {
  const built = [];
  return {
    built,
    deps: {
      renderer: {
        createBillboardBatch: (a, r, size, centers) => {
          const b = { a, r, centers: centers.map((c) => [...c]) }; built.push(b); return b;
        },
        destroyBillboardBatch: (b) => { b.destroyed = true; },
      },
      getTexture: async () => ({ getSize: () => ({ width: 16, height: 10 }), getScale: () => ({ width: 0, height: 0 }) }),
      uploadRecordFrame: () => {},
      pick: () => 1,   // RANDOM_TREASURE_ICONS[1] === 20
    },
  };
}

// --- ActionSystem harness (the action.test.js stub shape) --------
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};
const stubCollider = () => {
  const buckets = new Set();
  return { buckets, addMesh: (k) => buckets.add(k), removeBucket: (k) => buckets.delete(k), raycast: () => Infinity };
};

// ================================================================
// 2.1 - the dropped pile is a cached loot container
// ================================================================

test('2.1: a dropped pile IS a LootContainerData_v1 - the customDrop record, verbatim', () => {
  // SerializableLootContainer.GetSaveData (:55-81) writes
  // containerType/currentPosition/textureArchive/textureRecord/
  // customDrop/items; RestoreLootContainerData's custom-drop arm
  // (:445-453) reads loadID + textureArchive + textureRecord back.
  const rec = droppedLootRecord({ id: 7, pos: [11.5, 2.25, -30], record: 20, items: [{ templateIndex: 277, stackCount: 1 }] });
  assert.deepEqual(rec, {
    containerType: LOOT_CONTAINER_TYPES.DroppedLoot,   // 3, not ShopShelves/HouseContainers
    key: 'droppedLoot:7',
    customDrop: true,
    currentPosition: [11.5, 2.25, -30],
    textureArchive: RANDOM_TREASURE_ARCHIVE,           // DaggerfallLootDataTables.randomTreasureArchive
    textureRecord: 20,
    items: [{ templateIndex: 277, stackCount: 1 }],
    stockedDate: 0,
  });
  assert.equal(RANDOM_TREASURE_ARCHIVE, 216);
  assert.equal(LOOT_CONTAINER_TYPES.DroppedLoot, 3);
  // ...and it DETACHES: the cache must not alias the live pile
  const live = { id: 1, pos: [0, 0, 0], record: 20, items: [{ templateIndex: 1 }] };
  const r2 = droppedLootRecord(live);
  live.pos[0] = 99; live.items[0].templateIndex = 2; live.items.push({ templateIndex: 3 });
  assert.deepEqual(r2.currentPosition, [0, 0, 0]);
  assert.deepEqual(r2.items, [{ templateIndex: 1 }]);
});

test('2.1: pile -> cache -> pile round trip keeps position, icon and items', async () => {
  const { deps } = lootDeps();
  const pool = createDroppedLoot(deps);
  const pile = pool.dropPile([{ templateIndex: 277, stackCount: 2 }], [11.5, 2.25, -30]);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(pile.record, 20, 'the icon rolled off RANDOM_TREASURE_ICONS');

  // CacheScene on the way out...
  const cache = createSceneCache();
  const scene = 'DaggerfallInterior [MapID=1, BuildingKey=2]';
  cacheScene(cache, scene, { lootContainers: [droppedLootRecord(pile)], actionDoors: [] });
  pool.restorePiles([]);   // the interior tears down; the piles leave with it
  assert.equal(pool._piles.length, 0);

  // ...RestoreCachedScene on the way back in
  const data = restoreCachedScene(cache, scene);
  pool.restorePiles(data.lootContainers
    .filter((c) => c.containerType === LOOT_CONTAINER_TYPES.DroppedLoot)
    .map(droppedLootPile));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(pool._piles.length, 1, 'the sword is back in the shop');
  assert.deepEqual(pool._piles[0].pos, [11.5, 2.25, -30], 'at the position it was dropped');
  assert.equal(pool._piles[0].record, 20, 'a restore must not reroll the icon (:450)');
  assert.deepEqual(pool._piles[0].items, [{ templateIndex: 277, stackCount: 2 }]);
  // and it is a real, activatable, drawn pile again
  assert.equal(pool.lootTargets().length, 1);
  assert.equal(pool.batches().length, 1);
});

test('2.1: the permanent clear keeps the dropped pile and strips the corpse (:136-140)', () => {
  // The distinction only means anything once BOTH are in the list -
  // which is the whole point of 2.1: DFU caches them both.
  const cache = createSceneCache();
  const scene = 'DaggerfallInterior [MapID=1, BuildingKey=2]';
  const drop = droppedLootRecord({ id: 1, pos: [1, 0, 2], record: 20, items: [{ templateIndex: 277 }] });
  const corpse = { containerType: LOOT_CONTAINER_TYPES.CorpseMarker, key: 'corpse:0', items: [{ templateIndex: 1 }] };
  const shelf = { containerType: LOOT_CONTAINER_TYPES.ShopShelves, key: 'shelf:0', items: [], stockedDate: 5 };
  addPermanentScene(cache, scene);
  cacheScene(cache, scene, { lootContainers: [drop, corpse, shelf], actionDoors: [] });

  clearSceneCache(cache, { start: false });
  const kept = cache.scenes.get(scene);
  assert.deepEqual(kept.lootContainers.map((c) => c.key), ['droppedLoot:1', 'shelf:0'],
    'the body goes, the pile and the shelf stay');

  // and the whole thing survives the save envelope with its fields
  const round = restoreSceneCache(createSceneCache(), snapshotSceneCache(cache));
  assert.deepEqual(round.scenes.get(scene).lootContainers[0], drop);
});

// ================================================================
// 2.2 - the cached action-door record is ActionDoorData_v1
// ================================================================

test('2.2: the cached door record carries state, PERCENTAGE and lock - not just {key, state}', () => {
  // ActionDoorData_v1 (SerializableGameObject.cs:329-337):
  // loadID / currentLockValue / currentRotation / currentState /
  // actionPercentage / lockpickFailedSkillLevel. The port's ONE
  // writer of that record is the action graph's collectSaveData -
  // {key, state, t} is loadID/currentState/actionPercentage and
  // {lock} is currentLockValue.
  const a = new ActionSystem(stubCollider());
  const door = a.addDoor(CUBE, I, { positionKey: 'p0', startingLockValue: 15 });
  // an Open spell clears the lock and swings the door (X1); the player
  // then steps out with the swing a quarter played
  a.activate(door.key, { doorSpell: { kind: 'open', holderLevel: 20 } });
  a.update(DOOR_OPEN_DURATION / 4);          // caught a quarter of the way through the swing
  assert.equal(door.state, 'forward');

  const rec = a.collectSaveData().find((r) => r.key === door.key);
  // ActionDoorData_v1's members, port-side: loadID=key,
  // currentState=state, actionPercentage=t, currentLockValue=lock,
  // lockpickFailedSkillLevel=failedSkillLevel, plus the record's own
  // Move pair. currentRotation is the one DFU member with no
  // counterpart - the port re-derives the pose from state + t.
  assert.deepEqual(Object.keys(rec).sort(),
    ['failedSkillLevel', 'key', 'lock', 'moveState', 'moveT', 'state', 't']);
  assert.equal(rec.state, 'forward');        // currentState
  assert.ok(Math.abs(rec.t - 0.25) < 1e-6, `actionPercentage rode: ${rec.t}`);
  assert.equal(rec.lock, 0, 'currentLockValue - the open unlocked it (:647)');

  // A SECOND graph, as a re-entered interior is: the block data
  // rebuilds every door closed and locked at its starting value.
  const b = new ActionSystem(stubCollider());
  const rebuilt = b.addDoor(CUBE, I, { positionKey: 'p0', startingLockValue: 15 });
  assert.equal(rebuilt.state, 'start');
  assert.equal(rebuilt.currentLockValue, 15);
  b.restoreSaveData([rec]);
  assert.equal(rebuilt.state, 'forward', 'currentState restored');
  assert.ok(Math.abs(rebuilt.t - 0.25) < 1e-6, 'the swing resumes where it was, not snapped');
  assert.equal(rebuilt.currentLockValue, 0, 'currentLockValue restored - the door stays unlocked');

  // ...and what the OLD `{key, state}` record could not say: with the
  // percentage and the lock dropped, the same door comes back at the
  // base pose and re-locked.
  const c = new ActionSystem(stubCollider());
  const naive = c.addDoor(CUBE, I, { positionKey: 'p0', startingLockValue: 15 });
  c.restoreSaveData([{ key: rec.key, state: rec.state }]);
  assert.equal(naive.t, undefined, 'no actionPercentage in the record, none on the door');
  assert.equal(naive.currentLockValue, 15, 're-locked, because the record never carried the lock');
});

test('2.2: a door open across the visit comes back OPEN and passable', () => {
  // syncRestored is the half a bare `o.state = d.state` skipped: DFU's
  // restore moves the transform and the collider with the state, so a
  // door restored open must not stay solid.
  const a = new ActionSystem(stubCollider());
  const door = a.addDoor(CUBE, I, { positionKey: 'p0' });
  a.activate(door.key);
  for (let i = 0; i < 100; i++) a.update(DOOR_OPEN_DURATION / 90);
  assert.equal(door.state, 'end');

  const cache = createSceneCache();
  const scene = 'DaggerfallInterior [MapID=1, BuildingKey=2]';
  cacheScene(cache, scene, { lootContainers: [], actionDoors: a.collectSaveData() });

  const cB = stubCollider();
  const b = new ActionSystem(cB);
  const rebuilt = b.addDoor(CUBE, I, { positionKey: 'p0' });
  assert.equal(cB.buckets.has(rebuilt.key), true, 'the rebuilt door is closed and solid');
  b.restoreSaveData(restoreCachedScene(cache, scene).actionDoors);
  assert.equal(rebuilt.state, 'end');
  assert.equal(cB.buckets.has(rebuilt.key), false, 'a door left open does not block the doorway on re-entry');
});

// ================================================================
// the host wiring - worldModes.js, which cannot be instantiated here
// ================================================================

test('2.1 wiring: the interior host drops into its OWN pool, not the exterior one', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const interiorLoot = createDroppedLoot\(\{ renderer, getTexture, uploadRecordFrame \}\)/,
    'the interior host mounts a ground-pile pool of its own');
  // THE ONE CONSTRUCTION SEAM: every interior window is built through
  // it, so no arm can fall through to the outer host's exterior pool.
  assert.match(wm, /const makeInteriorInventory = \(extra = \{\}\) => host\.makeInventory\?\.\(\{[\s\S]{0,400}?onDrop: \(items\) => interiorLoot\.dropPile\(items, \[\.\.\.player\.pos\]\)/,
    'the seam overrides onDrop into the INTERIOR pool at the player feet');
  assert.match(wm, /onClose: \(\) => interiorLoot\.releaseEmptied\(\)/);
  const bare = wm.split('\n').filter((l) => /host\.makeInventory\?\.\(/.test(l) && !/makeInteriorInventory/.test(l));
  assert.deepEqual(bare, [], 'no interior arm may reach host.makeInventory directly - it would mint outdoors');
  // the pile is drawn, activatable, and freed with the building
  assert.match(wm, /targets\.push\(\.\.\.interiorLoot\.lootTargets\(\)\)/);
  assert.match(wm, /key\.startsWith\('droppedLoot:'\)[\s\S]{0,400}?interiorLoot\.pileFor\(key\)/);
  assert.match(wm, /interiorLoot\.tickFlats\(dt\)/);
  assert.match(wm, /renderer\.drawBillboards\(_interiorPiles/);
});

test('2.1 wiring: the piles are CACHED, and cached before the teardown reads them', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /interiorLoot\._piles\.filter\(\(p\) => p\.items\.length\)\.map\(droppedLootRecord\)/,
    'currentSceneState builds the DroppedLoot half of GetLootContainerData');
  assert.match(wm, /LOOT_CONTAINER_TYPES\.DroppedLoot\)[\s\S]{0,400}?drops\.push\(droppedLootPile\(c\)\)/,
    'restoreInteriorScene mints the custom drops back (:445-453)');
  assert.match(wm, /if \(drops\.length\) interiorLoot\.restorePiles\(drops\)/);
  // ORDER: CacheScene reads the live scene, so the pool is cleared AFTER
  const exit = wm.slice(wm.indexOf('cacheInteriorScene();\n', wm.indexOf('function tryExit')));
  const iCache = exit.indexOf('cacheInteriorScene();');
  const iClear = exit.indexOf('interiorLoot.restorePiles([]);');
  const iDestroy = exit.indexOf('interiorCtx.destroy();');
  assert.ok(iCache >= 0 && iClear > iCache && iDestroy > iClear,
    'cache, then free the piles, then tear the context down');
  // BOTH doors out of a building do it - the real one and Teleport.cs's
  // "Cache scene before departing" (:145-148).
  assert.equal(wm.split('interiorLoot.restorePiles([]);').length - 1, 2,
    'every path that caches the interior also frees its piles');
});

test('2.2 wiring: the cached door record comes from collectSaveData, doors only', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /\.filter\(\(o\) => o\.kind === 'door'\)\.map\(\(o\) => o\.key\)/,
    "DOORS ONLY - CacheScene writes `new object[0]` into the ActionObject slot (:94)");
  assert.match(wm, /const actionDoors = \(ctx\.actions\?\.collectSaveData\?\.\(\) \?\? \[\]\)\.filter\(\(r\) => doorKeys\.has\(r\.key\)\)/,
    'ONE DFU MEMBER, ONE EXPORT: the record is the action graph\'s own');
  assert.match(wm, /interiorCtx\.actions\?\.restoreSaveData\?\.\(data\.actionDoors\)/,
    'RestoreActionDoorData (:374-387) goes through the same one seam');
  assert.doesNotMatch(wm, /\.map\(\(o\) => \(\{ key: o\.key, state: o\.state \}\)\)/,
    'the {key, state} record is gone');
});
