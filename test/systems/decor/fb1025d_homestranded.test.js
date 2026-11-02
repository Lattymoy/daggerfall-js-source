// FIELD BUGS 2026-10-25d HOME-STRANDED (bible/01-Overview/bugs/Field-Bugs-2026-10-25d.md). Before HOME-POUR's deploy, a
// shared chest set back to private had its goods written under the building's scene (`DaggerfallInterior [...]`). When
// that answer was lost, the goods stayed there, out of the owner's reach, until a world move cleared the scene. These
// pins load a save as the old pour left it and run the client's own doors: the boot's homes sweep (homesBootHost.js),
// then the owner's walk-in, whose grants answer moves the goods back into the room's chest (decorGrants.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteDecorGrants, bindDecorHouse } from '../../../src/systems/decor/decorGrants.js';
import { dropGhosts } from '../../../src/systems/decor/homeStranded.js';
import { createHomesBoot } from '../../../src/scenes/homesBootHost.js';
import { createDecorRoom } from '../../../src/scenes/decor/decorRoom.js';
import { homeSceneName } from '../../../src/net/homeScene.js';
import { createSceneCache, restoreSceneCache, snapshotSceneCache, clearSceneCache, interiorSceneName } from '../../../src/systems/sceneCache.js';

const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
const BUILDING = interiorSceneName(HOME.mapId, HOME.buildingKey);
const OWN = homeSceneName(HOME.mapId, HOME.buildingKey);
const RUBY = { uid: '0123456789abcdef', name: 'Ruby', stackCount: 1 };
const GEM = { uid: 'abcdef0123456789', name: 'Gem', stackCount: 1 };
const PRIVATE = { storage: ['p1'], station: [], bin: [], use: [] };
const flush = () => new Promise((r) => { setTimeout(r, 0); });

/** The save's scene cache as the old pour left it: the home's own scene (permanent, the chest empty) and the goods
 *  under the building's scene, which nothing keeps. */
function strandedCache() {
  return restoreSceneCache(createSceneCache(), {
    permanentScenes: [OWN],
    scenes: [{ sceneName: OWN, decorItems: {} }, { sceneName: BUILDING, decorItems: { p1: [{ ...RUBY }, { ...GEM }] } }],
  });
}

/** The account's homes sweep at the boot, the world standing, over this save. */
async function bootSweep(player) {
  const boot = createHomesBoot({
    homesApi: { mine: async () => ({ ok: true, data: { homes: [{ ...HOME }] } }) },
    onlineHomes: null, realm: {}, player: () => player, loaded: () => true, stands: () => true,
    giveOwn: () => {}, say: () => {},
  });
  return boot.sweepGone();
}

/** The owner walks into the home: the room's pool stands, and the grants door answers `data`. */
async function walkIn(player, data) {
  const said = [];
  const pool = createDecorRoom({});
  const room = restoreCachedHome(player.sceneCache);
  pool.setItems(room?.decorItems);
  bindDecorHouse({ ...HOME, character: () => 'r0123456789abcdef0123', use: async () => ({ ok: true, data: { items: [] } }), items: () => player.items, take() {}, give() {}, realm: () => null, say: (line) => said.push(line) });
  noteDecorGrants({ use: async () => ({ ok: true, data }) }, HOME.mapId, HOME.buildingKey, 'r0123456789abcdef0123', pool, player);
  await flush();
  return { chest: pool.itemsOf('p1'), said, pool };
}

/** The room's restore takes the home's scene out of the cache, as the host does on the way in. */
function restoreCachedHome(cache) {
  const d = cache.scenes.get(OWN) ?? null;
  cache.scenes.delete(OWN);
  return d;
}

const uids = (list) => list.map((it) => it.uid).sort();

test('HOME-STRANDED goods the old pour left under the building come back into the owner\'s chest when the owner walks in, a world move after the boot', async () => {
  const player = { sceneCache: strandedCache(), items: [] };
  await bootSweep(player);
  clearSceneCache(player.sceneCache, { start: false });
  assert.ok(player.sceneCache.scenes.has(BUILDING), 'the boot kept the building\'s scene across the world move');
  const { chest, said } = await walkIn(player, PRIVATE);
  assert.deepEqual(uids(chest), uids([RUBY, GEM]), 'the chest holds both');
  assert.equal(player.sceneCache.scenes.has(BUILDING), false, 'the building\'s scene, emptied, is gone');
  assert.equal(said.length, 1);
  assert.match(said[0], /2 things/);
});

test('HOME-STRANDED a chest the service shares, or holds goods for, takes nothing back: the building\'s scene holds ghosts of the bin', async () => {
  for (const data of [{ ...PRIVATE, use: [{ id: 'p1', mode: 'friends' }] }, { ...PRIVATE, bin: ['p1'] }]) {
    const player = { sceneCache: strandedCache(), items: [] };
    const { chest, said } = await walkIn(player, data);
    assert.deepEqual(chest, []);
    assert.deepEqual(said, []);
    assert.equal(player.sceneCache.scenes.get(BUILDING).decorItems.p1.length, 2, 'left as it was');
  }
});

test('HOME-STRANDED a good the save already holds - in the pack or in the chest - is not put back twice, and a second walk-in moves nothing', async () => {
  const player = { sceneCache: strandedCache(), items: [{ ...RUBY }] };
  const first = await walkIn(player, PRIVATE);
  assert.deepEqual(uids(first.chest), [GEM.uid], 'the Ruby is in the pack');
  player.sceneCache.scenes.set(OWN, { ...player.sceneCache.scenes.get(OWN), decorItems: first.pool.itemsSnapshot() });   // the room's exit caches it
  const second = await walkIn(player, PRIVATE);
  assert.deepEqual(uids(second.chest), [GEM.uid]);
  assert.deepEqual(second.said, []);

  const both = { sceneCache: strandedCache(), items: [] };
  both.sceneCache.scenes.get(OWN).decorItems.p1 = [{ ...GEM }];
  const { chest } = await walkIn(both, PRIVATE);
  assert.deepEqual(uids(chest), uids([RUBY, GEM]), 'the Gem the chest held is not added again');
});

test('HOME-STRANDED the building\'s scene keeps what a piece of the save\'s own holds there, and a chest that is not the room\'s', async () => {
  const player = { sceneCache: strandedCache(), items: [] };
  const b = player.sceneCache.scenes.get(BUILDING);
  b.decor = [{ id: 'own1' }];
  b.decorItems.own1 = [{ uid: '1111111111111111', name: 'Kept' }];
  b.decorItems.p9 = [{ uid: '2222222222222222', name: 'Elsewhere' }];
  await walkIn(player, PRIVATE);
  assert.deepEqual(Object.keys(player.sceneCache.scenes.get(BUILDING).decorItems).sort(), ['own1', 'p9']);

  const house = { sceneCache: restoreSceneCache(createSceneCache(), { permanentScenes: [], scenes: [{ sceneName: BUILDING, decor: [{ id: 'own1' }], decorItems: { own1: [{ uid: '1111111111111111' }] } }] }), items: [] };
  await bootSweep(house);
  assert.equal(house.sceneCache.permanent.has(BUILDING), false, 'a piece standing in the building holds its own goods: nothing stranded, nothing kept');
});

test('HOME-STRANDED a share takes the chest\'s goods out of every cached scene, and a pour the poured ones, so a checkpoint writes no ghost back', () => {
  const cache = strandedCache();
  cache.scenes.get(BUILDING).decorItems.p1.push({ uid: '3333333333333333', name: 'Other' });
  dropGhosts(cache, 'p1', new Set([RUBY.uid, GEM.uid]));
  assert.deepEqual(snapshotSceneCache(cache).scenes.find((s) => s.sceneName === BUILDING).decorItems.p1.map((it) => it.name), ['Other']);
  dropGhosts(cache, 'p1', null);
  assert.equal(cache.scenes.get(BUILDING).decorItems.p1, undefined);
});
