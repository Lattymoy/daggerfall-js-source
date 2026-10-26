// FIELD BUGS 2026-10-25d HOME-POUR ("Disappearing House Storage: Items placed inside house storage randomly disappear";
// bible/01-Overview/bugs/Field-Bugs-2026-10-25d.md). A shared chest set back to private had its goods written into the
// building's scene (`DaggerfallInterior [...]`), which the owner's client never reads for its online home and which the
// next world move clears. The goods go back into the home's own scene now, kept permanent. These pins run the real
// Worker, then read the record back through the client's own scene cache, a world move in between.
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
const OWN_SCENE = homeSceneName(HOME.mapId, HOME.buildingKey);

/** An owner with a home and one chest placed in it. */
async function ownerWithChest(svc) {
  const owner = await svc.registered('Aldric');
  const claimed = await svc.seatHome(owner, HOME);
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  const placed = await svc.call('/v1/homes/decor/place', { ...AT, character: claimed.character, realm: realmAt(svc.env, claimed.character), piece: CHEST }, owner.secret);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  return { owner, character: claimed.character };
}

const setChest = (svc, who, character, mode) => svc.call('/v1/homes/decor/use', { ...AT, character, realm: realmAt(svc.env, character), op: 'set', id: 'p1', kind: 'storage', mode, names: [] }, who.secret);

/** What the owner's client finds in the chest after loading the record and walking across a map pixel. */
function chestAfterWorldMove(save) {
  const cache = createSceneCache();
  restoreSceneCache(cache, save.sceneCache);
  clearSceneCache(cache, { start: false });
  return restoreCachedScene(cache, OWN_SCENE)?.decorItems?.p1 ?? [];
}

test('HOME-POUR a chest shared and set back to private gives its goods back to the home\'s own scene, where its owner\'s client finds them after a world move', async () => {
  const svc = await standService();
  const { owner, character } = await ownerWithChest(svc);
  const save = recordOf(svc.env, character);
  save.sceneCache = { permanentScenes: [OWN_SCENE], scenes: [{ sceneName: OWN_SCENE, decorItems: { p1: [{ ...RUBY }, { ...GEM }] } }] };   // as the client writes it (snapshotSceneCache)
  layRecord(svc.env, character, save);

  const shared = await setChest(svc, owner, character, 'friends');
  assert.equal(shared.body.moved, true, JSON.stringify(shared.body));
  assert.equal(chestAfterWorldMove(recordOf(svc.env, character)).length, 0, 'shared: the goods are the bin\'s, not the save\'s');

  const back = await setChest(svc, owner, character, 'private');
  assert.equal(back.status, 200, JSON.stringify(back.body));
  const record = recordOf(svc.env, character);
  assert.equal(record.sceneCache.scenes.some((s) => s.sceneName === interiorSceneName(HOME.mapId, HOME.buildingKey)), false, 'no goods in the building\'s scene');
  assert.deepEqual(chestAfterWorldMove(record).map((it) => it.uid).sort(), [GEM.uid, RUBY.uid].sort(), 'the owner\'s chest holds both again');
});

test('HOME-POUR goods a friend put in a shared chest come back into the owner\'s save as a permanent scene when its owner has none yet', async () => {
  const svc = await standService();
  const { owner, character } = await ownerWithChest(svc);
  const friend = await svc.seated('Mara', { save: { name: 'Mara', level: 9, goldPieces: 100, items: [{ ...RUBY }] } });
  const named = await svc.call('/v1/homes/decor/use', { ...AT, character, realm: realmAt(svc.env, character), op: 'set', id: 'p1', kind: 'storage', mode: 'chosen_friends', names: ['Mara'] }, owner.secret);
  assert.equal(named.status, 200, JSON.stringify(named.body));
  const put = await svc.call('/v1/homes/decor/use', { ...AT, character: friend.character, realm: realmAt(svc.env, friend.character), op: 'deposit', id: 'p1', item: { ...RUBY } }, friend.secret);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal((recordOf(svc.env, character).sceneCache?.scenes ?? []).some((s) => s.sceneName === OWN_SCENE), false, 'the owner\'s save has no scene for the home yet');

  const back = await setChest(svc, owner, character, 'private');
  assert.equal(back.status, 200, JSON.stringify(back.body));
  const record = recordOf(svc.env, character);
  assert.ok(record.sceneCache.permanentScenes.includes(OWN_SCENE), 'the home\'s scene is kept across a world move');
  assert.deepEqual(chestAfterWorldMove(record).map((it) => it.uid), [RUBY.uid]);
});
