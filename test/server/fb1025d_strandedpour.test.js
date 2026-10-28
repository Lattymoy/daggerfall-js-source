// FIELD BUGS 2026-10-25d HOME-STRANDED (bible/01-Overview/bugs/Field-Bugs-2026-10-25d.md). A save the old pour left goods
// in under the building's scene still had them there when its chest was shared again: the share took them into the bin
// from every scene, but the client's cache kept its copy and the next checkpoint wrote it back. Set back to private, the
// pour counted that ghost as already poured: the bin's row was deleted, the good stood under the building's scene alone,
// and the next world move cleared it. These pins run the real Worker over such a record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { realmAt, recordOf, layRecord } from '../realmSeat.mjs';
import { homeSceneName } from '../../src/net/homeScene.js';
import { createSceneCache, restoreSceneCache, clearSceneCache, restoreCachedScene, interiorSceneName } from '../../src/systems/sceneCache.js';

const HOME = { mapId: 1291010263, buildingKey: 0x10203, region: 17, price: 42000 };
const AT = { mapId: HOME.mapId, buildingKey: HOME.buildingKey };
const CHEST = { id: 'p1', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 180 };
const RUBY = { uid: '0123456789abcdef', name: 'Ruby', stackCount: 1 };
const GEM = { uid: 'abcdef0123456789', name: 'Gem', stackCount: 1 };
const OTHER = { uid: '3333333333333333', name: 'Other', stackCount: 1 };
const OWN_SCENE = homeSceneName(HOME.mapId, HOME.buildingKey);
const BUILDING = interiorSceneName(HOME.mapId, HOME.buildingKey);

async function ownerWithChest(svc) {
  const owner = await svc.registered('Aldric');
  const claimed = await svc.seatHome(owner, HOME);
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  const placed = await svc.call('/v1/homes/decor/place', { ...AT, character: claimed.character, realm: realmAt(svc.env, claimed.character), piece: CHEST }, owner.secret);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  return { owner, character: claimed.character };
}

const setChest = (svc, who, character, mode) => svc.call('/v1/homes/decor/use', { ...AT, character, realm: realmAt(svc.env, character), op: 'set', id: 'p1', kind: 'storage', mode, names: [] }, who.secret);

/** A chest that stood stranded is shared again (its goods into the bin), and the client's next checkpoint writes the
 *  building's scene back as its cache still held it: `ghosts` under the building's scene. */
async function sharedWithGhosts(svc, owner, character, ghosts) {
  const save = recordOf(svc.env, character);
  save.sceneCache = { permanentScenes: [OWN_SCENE], scenes: [{ sceneName: OWN_SCENE, decorItems: {} }, { sceneName: BUILDING, decorItems: { p1: [{ ...RUBY }, { ...GEM }] } }] };
  layRecord(svc.env, character, save);
  const shared = await setChest(svc, owner, character, 'friends');
  assert.equal(shared.body.moved, true, JSON.stringify(shared.body));
  const after = recordOf(svc.env, character);
  after.sceneCache.scenes.find((s) => s.sceneName === BUILDING).decorItems = { p1: ghosts.map((it) => ({ ...it })) };
  layRecord(svc.env, character, after);
}

/** What the owner's client finds in the chest, and under the building's scene, after a world move. */
function afterWorldMove(save) {
  const cache = createSceneCache();
  restoreSceneCache(cache, save.sceneCache);
  clearSceneCache(cache, { start: false });
  const building = cache.scenes.get(BUILDING)?.decorItems?.p1 ?? [];
  return { chest: restoreCachedScene(cache, OWN_SCENE)?.decorItems?.p1 ?? [], building };
}

const uids = (list) => list.map((it) => it.uid).sort();

test('HOME-STRANDED a chest whose bin goods have ghosts under the building\'s scene pours them all into the home\'s own scene when set back to private, and the ghosts go', async () => {
  const svc = await standService();
  const { owner, character } = await ownerWithChest(svc);
  await sharedWithGhosts(svc, owner, character, [RUBY, GEM]);

  const back = await setChest(svc, owner, character, 'private');
  assert.equal(back.status, 200, JSON.stringify(back.body));
  const record = recordOf(svc.env, character);
  assert.equal(record.sceneCache.scenes.find((s) => s.sceneName === BUILDING)?.decorItems?.p1, undefined, 'no ghost under the building\'s scene');
  assert.deepEqual(uids(afterWorldMove(record).chest), uids([RUBY, GEM]), 'the owner\'s chest holds both after a world move');
});

test('HOME-STRANDED the pour takes out only the bin\'s own goods: anything else under the building\'s scene stays for the client to bring home', async () => {
  const svc = await standService();
  const { owner, character } = await ownerWithChest(svc);
  await sharedWithGhosts(svc, owner, character, [RUBY, OTHER]);

  const back = await setChest(svc, owner, character, 'private');
  assert.equal(back.status, 200, JSON.stringify(back.body));
  const record = recordOf(svc.env, character);
  assert.deepEqual(uids(record.sceneCache.scenes.find((s) => s.sceneName === BUILDING).decorItems.p1), [OTHER.uid]);
  assert.deepEqual(uids(afterWorldMove(record).chest), uids([RUBY, GEM]));
});
