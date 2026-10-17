// THE MERGE (2026-09-28, Mac: "Lets keep moving") - main taken into the professions branch. What the two sides had
// each built once is one thing now, and these pins hold it so (bible/06-Systems/Online-Arc.md THE MERGE):
// LootTables.OnLootSpawned (FORAGE3's named registry and OH-E's add-and-remove door, one list); GetCustomItemsForGroup
// (CSA-H's rows a provider in FORAGE1's one home); PlayerActivate.OnLootSpawned (CSA-H's shelf subscriber by name).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { addPileLootExtras, registerTabledLootHandler, tableLootSpawned } from '../../src/systems/loot/loot.js';
import { customItemsForGroup, registerCustomItemGroup, registerCustomItemsForGroup } from '../../src/systems/item/itemTemplates.js';
import { raiseContainerLootSpawned, registerContainerLootHandler } from '../../src/systems/containerLoot.js';
import { LOOT_CONTAINER_TYPES } from '../../src/systems/sceneCache.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('THE MERGE: LootTables.OnLootSpawned is one list - a named subscriber and an added one hear the same pile, in the order they came, each with both sides\' args; a thrower stops neither; removal is the added one\'s alone', () => {
  const heard = [];
  registerTabledLootHandler('zz-merge-named', (a) => heard.push(['named', a.key, a.locationIndex, a.where]));
  const off = tableLootSpawned.add((a) => { heard.push(['added', a.key, a.luck, a.where]); throw new Error('a subscriber that throws'); });
  registerTabledLootHandler('zz-merge-after', (a) => heard.push(['after', a.key]));
  const warn = console.warn; console.warn = () => {};
  try {
    const pile = [];
    assert.equal(addPileLootExtras(pile, 'K', () => 0.999, { locationIndex: 7, luck: 60, where: 'dungeon' }), pile);
    assert.deepEqual(heard, [['named', 'K', 7, 'dungeon'], ['added', 'K', 60, 'dungeon'], ['after', 'K']]);
    heard.length = 0;
    tableLootSpawned.raise({ key: 'Q', items: [], where: null });
    assert.deepEqual(heard.map((h) => h[0]), ['named', 'added', 'after'], 'OH-E\'s raise is the same list');
    heard.length = 0;
    off();
    addPileLootExtras([], '-', () => 0.999);
    assert.deepEqual(heard, [], 'an index off the table raises nothing (GenerateLoot returns false there)');
    addPileLootExtras([], 'Q', () => 0.999);
    assert.deepEqual(heard.map((h) => h[0]), ['named', 'after'], 'the added one removed, the named ones stand');
  } finally {
    console.warn = warn;
    registerTabledLootHandler('zz-merge-named', null);
    registerTabledLootHandler('zz-merge-after', null);
  }
  assert.match(hostText('src/scenes/world.js'), /const offTable = tableLootSpawned\.add\(\(e\) => ohUpgrade\(e\.key, e\.items, \[\], e\.where, e\.rolls \?\? Math\.random, e\.roller \?\? playerEntity\)\);/, 'OH-E subscribes through the door');   // PIN MOVED (PARTY-LOOT): the raiser's dice and roller ride the event
});

test('THE MERGE: CSA-H\'s rows are a provider in GetCustomItemsForGroup\'s one home - after the providers before its first row, in registration order, a row only while its mod is on, a second registration none', () => {
  const G = 'MergeTestGroup';
  let on = true;
  registerCustomItemsForGroup((g) => (g === G ? [9901] : []));   // a mod's provider registered before the rows
  registerCustomItemGroup(9902, G, () => on);
  registerCustomItemGroup(9903, G);
  registerCustomItemGroup(9902, G, () => true);   // DFU's Contains guard: no second row
  assert.deepEqual(customItemsForGroup(G), [9901, 9902, 9903]);
  on = false;
  assert.deepEqual(customItemsForGroup(G), [9901, 9903], 'a mod switched off has no row');
  assert.doesNotMatch(rd('src/systems/roleplayRealismItems/rriItems.js'), /registerCustomItemGroup|_otherModItems/, 'rriItems.js answers RRI\'s own again');
  // PIN MOVED (SHIPYARDS, 2026-10-11): Come Sail Away's two rows stand on no shelf - a port town's shipyard sells every
  // hull (systems/shipyards.js) - so the fish are the one home's mod rows
  assert.match(rd('src/systems/deepWater/deepWatersFishItems.js'), /import \{[^}]*registerCustomItemGroup[^}]*\} from '\.\.\/item\/itemTemplates\.js';/, 'the fish register into the one home');
  assert.doesNotMatch(rd('src/systems/comeSailAway/comeSailAwayItems.js').replace(/^\s*\/\/.*$/gm, ''), /registerCustomItemGroup/, 'the boats register no shelf row');
});

test('THE MERGE: Come Sail Away\'s shelf subscriber is one of PlayerActivate.OnLootSpawned\'s, by its mod\'s name, after RRI2\'s - a shop shelf\'s alone; both shelf doors raise the one event', () => {
  const heard = [];
  registerContainerLootHandler('zz-merge-shelf', (a) => { if (a.containerType === LOOT_CONTAINER_TYPES.ShopShelves) heard.push(a.items.length); });
  try {
    raiseContainerLootSpawned({ containerType: LOOT_CONTAINER_TYPES.ShopShelves, items: [{}, {}], buildingType: 9, quality: 10 });
    raiseContainerLootSpawned({ containerType: LOOT_CONTAINER_TYPES.HouseContainers, items: [{}], buildingType: 9, quality: 10 });
    assert.deepEqual(heard, [2], 'the shelf, not the house container');
  } finally { registerContainerLootHandler('zz-merge-shelf', null); }
  const w = hostText('src/scenes/world.js');
  assert.match(w, /registerContainerLootHandler\(COME_SAIL_AWAY_VENDOR, \(a\) => \{ if \(a\.containerType === LOOT_CONTAINER_TYPES\.ShopShelves\) csaShelfStocked\(a\.items\); \}\);/);
  assert.doesNotMatch(w, /csaShelfStocked: \(items\)/, 'no host hook beside the event');
  const m = rd('src/scenes/worldModes.js');
  assert.doesNotMatch(m, /host\.csaShelfStocked/, 'no shelf door calls the mod by name');
  assert.equal((m.match(/shelfLootSpawned\(stockShopShelf\(/g) ?? []).length, 3, 'the two doors and the probe');
});
