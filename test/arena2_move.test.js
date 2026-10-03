// ARENA2 (2026-10-02): THE FIX FROM ARENA1 - a house the arena displaced moves WHAT WAS IN IT, never its places
// (systems/arenaMove.js emptyArenaScene). ARENA1 renamed the old house's scene onto the new house, and the old room's
// placed pieces stood where it had floor, its chest indices named another house's chests and its furniture marks named
// pieces the new house never had. Now: the owner's own things go back where they live (furniture to the furnishings,
// the rest to the pack - the host's doors), the catalogue's placed pieces are paid back whole into the bank, the marks
// are dropped, and everything the chests, the storage pieces and the floor held waits in the new house's first chest -
// or, in a house with none, in a crate where its owner first walks in (scenes/worldModes.js restoreInteriorScene).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyArenaScene, moveArenaRecords, ARENA_CRATE_KEY } from '../src/systems/arenaMove.js';
import { arenaRecordDisplaced, ARENA_LOCATION_KEY } from '../src/world/arenaCity.js';
import { createSceneCache, cacheScene, addPermanentScene, interiorSceneName, layoutSceneName, restoreCachedScene } from '../src/systems/sceneCache.js';
import { createHouses } from '../src/systems/banking.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const MAP = 1291010263;
const OLD = makeBuildingKey(4, 3, 5);
const keyOfMapId = (m) => (m === MAP ? ARENA_LOCATION_KEY : null);
const FROM = interiorSceneName(MAP, OLD), TO = interiorSceneName(MAP, makeBuildingKey(1, 1, 0));
const bed = { name: 'Fancy Double Bed', group: 'Furniture', templateIndex: 220 };
const sword = { name: 'Longsword', group: 'Weapons', templateIndex: 4 };

function furnished() {
  const scenes = createSceneCache();
  cacheScene(scenes, FROM, {
    decor: [{ id: 1, pos: [1, 2, 3], rot: [0, 0, 0, 1], paid: 120 }, { id: 2, pos: [0, 0, 0], rot: [0, 0, 0, 1], paid: 35 }, { id: 3, pos: [0, 0, 0], rot: [0, 0, 0, 1], item: { own: true } }],
    decorItems: { 1: [{ name: 'Potion of Healing' }] },
    decorOwn: { 3: bed, 4: sword },
    hiddenBase: ['bed:2', 'table:0'],
    lootContainers: [{ key: 'container:0', items: [{ name: 'gold' }] }, { key: 'container:3', items: [{ name: 'Ruby' }, { name: 'Dagger' }] }, { key: 'container:4', items: null }],
    droppedPiles: [{ pos: [4, 0, 4], items: [{ name: 'Torch' }] }, { pos: [1, 0, 1], items: [] }],
    droppedTorches: [{ position: [0, 0, 0], time: 3, itemTemplateIndex: 247 }],
  });
  cacheScene(scenes, layoutSceneName(FROM, 'beautiful-cities@0.5.0'), { lootContainers: [{ key: 'container:1', items: [{ name: 'Emerald' }] }], decor: [{ id: 9, paid: 10 }] });
  addPermanentScene(scenes, FROM);
  addPermanentScene(scenes, layoutSceneName(FROM, 'beautiful-cities@0.5.0'));
  cacheScene(scenes, interiorSceneName(MAP, makeBuildingKey(9, 9, 9)), { lootContainers: [{ key: 'container:0', items: [{ name: 'a stranger\'s' }] }] });
  return scenes;
}

test('ARENA2 move: the old scene emptied - own things answered, placed pieces paid back whole, marks dropped, every item in the new first chest', () => {
  const scenes = furnished();
  const out = emptyArenaScene(scenes, FROM, TO);
  assert.deepEqual(out.own, [bed, sword], 'the owner\'s own things, to give back');
  assert.equal(out.refund, 120 + 35 + 10, 'every placed catalogue piece paid back whole, every layout\'s');
  assert.equal(out.pieces, 3);
  assert.equal(out.hidden, 2);
  assert.deepEqual(out.crate.filter((i) => i.name).map((i) => i.name).sort(), ['Dagger', 'Emerald', 'Potion of Healing', 'Ruby', 'Torch', 'gold'].sort());
  // ARENA-FIX 11: the torch left burning on the old floor, put out and carried - the item picking it up gives
  const lit = out.crate.filter((i) => !i.name);
  assert.equal(out.lights, 1);
  assert.deepEqual(lit.map((i) => [i.group, i.templateIndex, i.currentCondition]), [['UselessItems2', 247, 1]]);
  assert.ok(lit[0].maxCondition > 0, 'its template\'s hit points');
  assert.ok(!scenes.scenes.has(FROM) && !scenes.scenes.has(layoutSceneName(FROM, 'beautiful-cities@0.5.0')), 'nothing of the old house is left');
  assert.ok(scenes.scenes.has(interiorSceneName(MAP, makeBuildingKey(9, 9, 9))), 'nobody else\'s scene is touched');
  const to = scenes.scenes.get(TO);
  assert.equal(to.lootContainers.length, 1);
  assert.equal(to.lootContainers[0].key, ARENA_CRATE_KEY);
  assert.equal(to.lootContainers[0].crate, true);
  assert.equal(to.lootContainers[0].items.length, 7);
  assert.deepEqual([to.decor, to.hiddenBase, to.droppedPiles, to.decorOwn], [[], [], [], {}], 'no place of the old house comes with it');
  assert.equal(to.frame, 'building');
  assert.deepEqual([...scenes.permanent], [TO], 'the house is still the player\'s - permanent - and only its own visit');
  // copies, never the old scene's live arrays
  out.crate[0].name = 'changed';
  assert.notEqual(to.lootContainers[0].items[0].name, 'changed');
  // the restore hands the crate over once
  assert.equal(restoreCachedScene(scenes, TO).lootContainers[0].key, 'container:0');
});

test('ARENA2 move: an empty old house leaves nothing behind it; a house never visited and never permanent writes no scene', () => {
  const s = createSceneCache();
  assert.deepEqual(emptyArenaScene(s, FROM, TO), { own: [], refund: 0, crate: [], pieces: 0, hidden: 0, lights: 0 });
  assert.equal(s.scenes.size, 0);
  const p = createSceneCache();
  addPermanentScene(p, FROM);
  emptyArenaScene(p, FROM, TO);
  assert.deepEqual([...p.permanent], [TO], 'a permanent house moves its permanence even unvisited');
  assert.deepEqual(p.scenes.get(TO).lootContainers, []);
  assert.deepEqual(emptyArenaScene(null, FROM, TO).own, []);
  const odd = createSceneCache();
  cacheScene(odd, FROM, { decor: [{ id: 1, paid: -5 }, { id: 2, paid: 1.5 }], lootContainers: [{ key: 'shelf:0', items: [{ name: 'shop' }] }] });
  const o = emptyArenaScene(odd, FROM, TO);
  assert.equal(o.refund, 0, 'a broken price pays nothing');
  assert.deepEqual(o.crate, [], 'a shelf is no chest of the owner\'s');
});

test('ARENA2 move: the move gives the owner\'s things back and pays the bank through the host\'s doors, and says how much moved', () => {
  const houses = createHouses(62);
  Object.assign(houses[17], { mapId: MAP, buildingKey: OLD });
  const scenes = createSceneCache();
  const from = interiorSceneName(MAP, OLD);
  cacheScene(scenes, from, { decor: [{ id: 1, paid: 70 }], decorOwn: { 1: bed }, lootContainers: [{ key: 'container:2', items: [{ name: 'gold' }] }] });
  addPermanentScene(scenes, from);
  const got = { own: null, refund: 0 };
  const CITY = [{ buildingKey: makeBuildingKey(1, 1, 0), buildingType: BUILDING_TYPES.House2, name: 'House 110' }];
  const r = moveArenaRecords({ houses, summaries: CITY, oldTypeOf: () => BUILDING_TYPES.House2, scenes, displaced: (rec) => arenaRecordDisplaced(rec, keyOfMapId) }, {
    giveOwn: (items) => { got.own = items; }, refund: (g) => { got.refund += g; },
  });
  assert.deepEqual([r.own, r.refund, r.crate], [1, 70, 1]);
  assert.deepEqual(got.own, [bed]);
  assert.equal(got.refund, 70);
  assert.equal(scenes.scenes.get(interiorSceneName(MAP, r.to)).lootContainers[0].items[0].name, 'gold');
});

test('ARENA2 move: the hosts\' doors - furniture to the furnishings, the rest to the pack, the gold to Daggerfall\'s account; a house with no chest gets a crate', () => {
  const w = rd('src/scenes/world.js');
  // ARENA4b (PIN MOVED): the two doors are named once (world.js arenaGiveOwn, arenaRefund) and handed by the offline deed's
  // move and the online home's alike (moveArenaHomesOnline) - the same bodies, a function's now
  assert.match(w, /function arenaGiveOwn\(items\) \{ for \(const it of items\) \{ if \(isFurnishing\(it\)\) \(playerEntity\.furnishings \?\?= \[\]\)\.push\(it\); else addItem\(playerEntity\.items \?\?= \[\], it\); \} \}/);
  assert.match(w, /giveOwn: arenaGiveOwn,\n\s+refund: arenaRefund,/);
  assert.match(w, /const a = playerEntity\.bankAccounts\[goldRegion\(playerEntity\.bankAccounts, ARENA_REGION\)\] \?\? null;/);
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(!target && c\.crate && c\.items\?\.length\) \{\n\s+const o = buildingOrigin\(\), f = player\.pos;\n\s+data\.droppedPiles = \[\.\.\.\(data\.droppedPiles \?\? \[\]\), \{ pos: \[f\[0\] - o\[0\], f\[1\] - o\[1\], f\[2\] - o\[2\]\], items: c\.items\.map\(\(it\) => \(\{ \.\.\.it \}\)\) \}\];/);
  assert.ok(!/renameScene\(/.test(rd('src/systems/arenaMove.js')), 'the old places are never renamed onto the new house');
});
