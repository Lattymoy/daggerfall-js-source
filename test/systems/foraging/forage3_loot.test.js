// FORAGE3 (2026-09-28, Mac: "Let's do it"): FORAGING 1.7 (Harbinger451),
// THE LOOT HOOKS - ForagingLoot_OnLootSpawned (a shelf, a house
// container), ForagingLoot_OnDungeonLootSpawned (a pile, by its index) and
// ForagingLoot_OnEnemyDeath (a corpse), IL_0520-IL_0b8f; and the two DFU
// events they hang on, each one home now: PlayerActivate.OnLootSpawned
// (systems/containerLoot.js) and LootTables.OnLootSpawned (systems/loot/loot.js,
// raised for every key). The tables are the DLL's
// <PrivateImplementationDetails>, read off it and typed here; every
// Range(0, 1) that is always 0 (Q2) adds nothing over 10,000 draws.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FT, FORAGING_LOOT_TABLES, FORAGING_ITEM_CODES, FORAGING_ITEM_RARITIES, TOOL_TEMPLATES, determineForagingItem,
  foragingItemCount, rollForagingItemUsed, foragingLootItem, containerLootDraw, DUNGEON_LOOT_ARMS, dungeonLootDraw,
  CORPSE_CLASS_CAREERS, CORPSE_MONSTER_CAREERS, CORPSE_COUNTS, corpseLootDraw,
} from '../../../src/systems/foraging/foragingLaw.js';
import {
  onForagingContainerLoot, onForagingPileLoot, onForagingEnemyDeath, installForaging, _resetForagingInstall,
  _setForagingRandomForTests,
} from '../../../src/systems/foraging/foragingInstall.js';
import { raiseContainerLootSpawned, registerContainerLootHandler } from '../../../src/systems/containerLoot.js';
import { addPileLootExtras, registerTabledLootHandler, DUNGEON_LOOT_KEYS } from '../../../src/systems/loot/loot.js';
import { raiseEnemyDeath } from '../../../src/scenes/corpseMarker.js';
import { seedInteriorTreasure } from '../../../src/scenes/interiorContext.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { LOOT_CONTAINER_TYPES } from '../../../src/systems/sceneCache.js';
import { DUNGEON_TYPES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A scripted stream: each value once, then 0.999. */
const seq = (...vals) => { let i = 0; return () => (i < vals.length ? vals[i++] : 0.999); };
/** The draw that picks index `k` of a list of `n`. */
const at = (k, n) => (k + 0.5) / n;
const SHELF = LOOT_CONTAINER_TYPES.ShopShelves;
const HOUSE = LOOT_CONTAINER_TYPES.HouseContainers;

test('FORAGE3: the hooks\' tables are the DLL\'s arrays, and DetermineForagingItem maps the seven codes', () => {
  assert.deepEqual(FORAGING_LOOT_TABLES.common, [1600, 1601, 1602, 1603, 1604, 1606, 1607]);
  assert.deepEqual(FORAGING_LOOT_TABLES.prisonMine, [1600, 1600, 1601, 1601, 1601, 1602, 1603, 1604, 1606, 1606, 1607]);
  assert.deepEqual(FORAGING_LOOT_TABLES.stronghold, [1600, 1600, 1601, 1601, 1602, 1603, 1604, 1604, 1606, 1607]);
  assert.deepEqual(FORAGING_LOOT_TABLES.templeCoven, [1600, 1601, 1602, 1602, 1603, 1606, 1607]);
  assert.equal(FORAGING_LOOT_TABLES.haunt, TOOL_TEMPLATES, 'DCE7 is the console command\'s own array, one home');
  assert.deepEqual(FORAGING_ITEM_CODES, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(FORAGING_ITEM_RARITIES, [10, 10, 10, 10, 10, 10, 10]);
  assert.deepEqual(FORAGING_ITEM_CODES.map(determineForagingItem), [1600, 1601, 1602, 1603, 1604, 1606, 1607]);
  assert.equal(determineForagingItem(0), 0);
  assert.equal(determineForagingItem(8), 0);
  assert.deepEqual(CORPSE_COUNTS, { class: [1, 1, 1, 1, 2], monster: [1, 1, 1, 2] });
  assert.deepEqual(CORPSE_CLASS_CAREERS, [1, 8, 13, 14, 15, 16], 'Spellsword, Rogue, Archer, Ranger, Barbarian, Warrior');
  assert.deepEqual(CORPSE_MONSTER_CAREERS, [7, 12, 16], 'Orc, Orc Sergeant, Giant');
});

test('FORAGE3: RollForagingItemUsed\'s weights by band, and the seven codes weigh the same whatever the luck or quality (Q1)', () => {
  // w = 101 - 5 x rarity: rarity 10 is 51, the middle band
  assert.equal(foragingItemCount(10, 50, 10), 87, 'ceil(51 x 1.5 + 10 + 0)');
  assert.equal(foragingItemCount(10, 50, -1), 77, 'ceil(76.5 + 0): quality -1 drops the quality term');
  assert.equal(foragingItemCount(10, 0, -1), 67, 'ceil(76.5 - 10)');
  assert.equal(foragingItemCount(10, 100, 20), 107, 'ceil(76.5 + 20 + 10)');
  assert.equal(foragingItemCount(5, 50, 10), 210, 'w 76, the top band: ceil(76 x 2.5 + (10 + 0) x 2)');
  assert.equal(foragingItemCount(15, 50, 10), 16, 'w 26, the bottom band: ceil(26 - 10)');
  assert.equal(foragingItemCount(20, 50, 90), 1, 'clamped to 1');
  assert.equal(foragingItemCount(0, 100, 200), 400, 'clamped to 400');
  for (const [luck, quality] of [[50, 10], [5, 20], [95, -1], [0, -1]]) {
    const counts = new Map();
    const n = 7 * foragingItemCount(10, luck, quality);
    for (let k = 0; k < n; k++) {
      const code = rollForagingItemUsed(FORAGING_ITEM_CODES, luck, quality, () => at(k, n));
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    assert.deepEqual([...counts.values()], new Array(7).fill(n / 7), `luck ${luck}, quality ${quality}: a uniform one in seven`);
  }
});

test('FORAGE3: one item is its table\'s id, then the roll - the table decides nothing but the draw it spends', () => {
  const n = 7 * foragingItemCount(10, 50, -1);
  // the Prison's table, drawn at its first entry and at its last: the roll alone picks the item
  assert.equal(foragingLootItem(FORAGING_LOOT_TABLES.prisonMine, 50, -1, seq(at(0, 11), at(4 * 77, n))), FT.WoodBundle);
  assert.equal(foragingLootItem(FORAGING_LOOT_TABLES.prisonMine, 50, -1, seq(at(10, 11), at(0, n))), FT.WoodAxe);
  assert.equal(foragingLootItem([1605], 50, -1, seq(0)), null, 'an id off the gate (the Fish) adds nothing');
});

test('FORAGE3: the shelf and the house container - a General Store 0 or 1, a Pawn Shop and a Palace always 0 (Q2), a house 15% then 0 or 1', () => {
  assert.deepEqual(containerLootDraw({ containerType: SHELF, buildingType: BUILDING_TYPES.GeneralStore }, seq(0.49)).count, 0);
  assert.deepEqual(containerLootDraw({ containerType: SHELF, buildingType: BUILDING_TYPES.GeneralStore }, seq(0.5)).count, 1);
  let calls = 0;
  const counted = () => { calls++; return 0.5; };
  assert.equal(containerLootDraw({ containerType: SHELF, buildingType: BUILDING_TYPES.Armorer }, counted).count, 0);
  assert.equal(calls, 0, 'any other shop draws nothing at all');
  assert.equal(containerLootDraw({ containerType: HOUSE, buildingType: BUILDING_TYPES.House1 }, seq(0.14, 0.5)).count, 1, '14 < 15');
  assert.equal(containerLootDraw({ containerType: HOUSE, buildingType: BUILDING_TYPES.House1 }, seq(0.15, 0.5)).count, 0, '15 is not < 15');
  assert.equal(containerLootDraw({ containerType: LOOT_CONTAINER_TYPES.CorpseMarker, buildingType: BUILDING_TYPES.GeneralStore }, seq(0.9)).count, 0);
  for (let i = 0; i < 10000; i++) {
    assert.equal(containerLootDraw({ containerType: SHELF, buildingType: BUILDING_TYPES.PawnShop }, Math.random).count, 0);
    assert.equal(containerLootDraw({ containerType: HOUSE, buildingType: BUILDING_TYPES.Palace }, Math.random).count, 0);
  }
});

test('FORAGE3: a pile by its index - Prison and Mine 25% 0-4, the Strongholds 20% 0-3, Crypt/Castle/Cemetery 15% 0-2, Temple and Coven 10% 0-1, Haunt and Laboratory never (Q2)', () => {
  const arm = (i) => DUNGEON_LOOT_ARMS[i] && [DUNGEON_LOOT_ARMS[i].chance, DUNGEON_LOOT_ARMS[i].max];
  assert.deepEqual(Object.keys(DUNGEON_LOOT_ARMS).map(Number).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 7, 8, 9, 11, 15, 18]);
  assert.deepEqual([DUNGEON_TYPES.Prison, DUNGEON_TYPES.Mine].map(arm), [[25, 5], [25, 5]]);
  assert.deepEqual([DUNGEON_TYPES.OrcStronghold, DUNGEON_TYPES.HumanStronghold, DUNGEON_TYPES.BarbarianStronghold].map(arm), [[20, 4], [20, 4], [20, 4]]);
  assert.deepEqual([DUNGEON_TYPES.Crypt, DUNGEON_TYPES.RuinedCastle, DUNGEON_TYPES.Cemetery].map(arm), [[15, 3], [15, 3], [15, 3]]);
  assert.deepEqual([DUNGEON_TYPES.DesecratedTemple, DUNGEON_TYPES.Coven].map(arm), [[10, 2], [10, 2]]);
  assert.deepEqual([DUNGEON_TYPES.VampireHaunt, DUNGEON_TYPES.Laboratory].map(arm), [[5, 1], [5, 1]]);
  assert.equal(DUNGEON_LOOT_ARMS[DUNGEON_TYPES.Prison].table, FORAGING_LOOT_TABLES.prisonMine);
  assert.equal(DUNGEON_LOOT_ARMS[DUNGEON_TYPES.Coven].table, FORAGING_LOOT_TABLES.templeCoven);
  assert.equal(dungeonLootDraw(DUNGEON_TYPES.Prison, seq(0.24, 0.99)).count, 4);
  assert.equal(dungeonLootDraw(DUNGEON_TYPES.Prison, seq(0.25, 0.99)).count, 0, 'a failed roll leaves the count 0');
  assert.equal(dungeonLootDraw(DUNGEON_TYPES.Crypt, seq(0.1, 0.99)).count, 2);
  assert.equal(dungeonLootDraw(DUNGEON_TYPES.NaturalCave, seq(0, 0.99)).count, 0);
  assert.equal(dungeonLootDraw(null, seq(0, 0.99)).count, 0, 'no index: no arm');
  for (let i = 0; i < 10000; i++) {
    assert.equal(dungeonLootDraw(DUNGEON_TYPES.VampireHaunt, Math.random).count, 0);
    assert.equal(dungeonLootDraw(DUNGEON_TYPES.Laboratory, Math.random).count, 0);
  }
});

test('FORAGE3: a corpse - a class foe of six careers 5%, an Orc, Orc Sergeant or Giant 2%; the count drawn before the roll', () => {
  assert.equal(corpseLootDraw({ isClass: true, careerIndex: 16 }, seq(at(4, 5), 0.04)).count, 2, 'a Warrior: {1,1,1,1,2}[4], then 4 < 5');
  assert.equal(corpseLootDraw({ isClass: true, careerIndex: 16 }, seq(at(4, 5), 0.05)).count, 0, '5 is not < 5');
  assert.equal(corpseLootDraw({ isClass: false, careerIndex: 7 }, seq(at(3, 4), 0.01)).count, 2, 'an Orc: Floor(5 x 0.5) = 2');
  assert.equal(corpseLootDraw({ isClass: false, careerIndex: 7 }, seq(at(3, 4), 0.02)).count, 0);
  assert.equal(corpseLootDraw({ isClass: false, careerIndex: 16 }, seq(0, 0)).count, 1, 'a Giant');
  assert.equal(corpseLootDraw({ isClass: true, careerIndex: 0 }, seq(0, 0)).count, 0, 'a Mage: no arm');
  assert.equal(corpseLootDraw({ isClass: false, careerIndex: 16 + 128 }, seq(0, 0)).count, 0);
  assert.equal(corpseLootDraw({ isClass: false, careerIndex: 0 }, seq(0, 0)).count, 0, 'a Rat');
});

test('FORAGE3: Foraging\'s three subscribers add the item it mints at the back, and nothing with the switch off', () => {
  _resetModSettings();
  const n = 7 * foragingItemCount(10, 50, 10);
  // a General Store: the count 1, then the table's id and the fourth code - the Fishing-Net
  _setForagingRandomForTests(seq(0.5, 0, at(3 * 87, n)));
  const shelf = [{ group: 'Books', templateIndex: 0 }];
  assert.equal(onForagingContainerLoot({ containerType: SHELF, items: shelf, buildingType: BUILDING_TYPES.GeneralStore, quality: 10, luck: 50 }), 1);
  assert.equal(shelf.length, 2);
  assert.deepEqual({ group: shelf[1].group, templateIndex: shelf[1].templateIndex, condition: shelf[1].currentCondition }, { group: 'UselessItems2', templateIndex: FT.FishingNet, condition: 50 }, 'minted as createForagingItem mints, at the back');
  _setForagingRandomForTests(seq(0, 0.5, 0, 0));
  assert.equal(onForagingContainerLoot({ containerType: HOUSE, items: [], quality: 10 }), 0, '`Interior != null`: a container with no building, nothing - the 15% arm never reached');
  // a Prison's pile: 24 < 25, Range(0, 5) = 2, two items
  const m = 7 * foragingItemCount(10, 50, -1);
  _setForagingRandomForTests(seq(0.24, at(2, 5), 0, at(0, m), 0, at(6 * 77, m)));
  const pile = [];
  assert.equal(onForagingPileLoot({ locationIndex: DUNGEON_TYPES.Prison, key: 'N', items: pile, luck: 50 }), 2);
  assert.deepEqual(pile.map((i) => i.templateIndex), [FT.WoodAxe, FT.Basket]);
  // a Warrior's corpse: the entity's items are the corpse's (UL1)
  _setForagingRandomForTests(seq(0, 0, 0, at(5 * 77, m)));
  const warrior = { isClass: true, careerIndex: 16, isPlayer: false, items: [] };
  assert.equal(onForagingEnemyDeath(warrior, { luck: 50 }), 1);
  assert.deepEqual(warrior.items.map((i) => i.templateIndex), [FT.Spade]);
  // off: the same draws that add an item on add nothing
  setModSetting('foraging', 'Enabled', false);
  const off = [];
  _setForagingRandomForTests(seq(0.5, 0, 0));
  assert.equal(onForagingContainerLoot({ containerType: SHELF, items: off, buildingType: BUILDING_TYPES.GeneralStore }), 0);
  _setForagingRandomForTests(seq(0, 0.99, 0, 0, 0, 0, 0, 0, 0, 0));
  assert.equal(onForagingPileLoot({ locationIndex: DUNGEON_TYPES.Prison, key: 'N', items: off }), 0);
  _setForagingRandomForTests(seq(0, 0, 0, 0));
  assert.equal(onForagingEnemyDeath({ isClass: true, careerIndex: 16, items: off }), 0);
  assert.deepEqual(off, []);
  _resetModSettings();
  _setForagingRandomForTests(seq(0.5, 0, 0));
  assert.equal(onForagingContainerLoot({ containerType: SHELF, items: off, buildingType: BUILDING_TYPES.GeneralStore }), 1, 'and on, the same draws add one');
  _resetModSettings();
  _setForagingRandomForTests(null);
});

test('FORAGE3: PlayerActivate.OnLootSpawned, one home - RRI\'s subscriber first, Foraging\'s after it once installed, a throw never stops the rest', () => {
  _resetModSettings();
  _resetForagingInstall();
  installForaging({ fetchBytes: async () => new Uint8Array() });
  const order = [];
  registerContainerLootHandler('zz-spy', (a) => order.push(['spy', a.items.length]));
  registerContainerLootHandler('zz-throws', () => { throw new Error('a mod broke'); });
  registerContainerLootHandler('zz-after', () => order.push(['after']));
  _setForagingRandomForTests(seq(0.5, 0, 0));
  const warn = console.warn; console.warn = () => {};
  let items;
  try {
    items = raiseContainerLootSpawned({ containerType: SHELF, items: [], buildingType: BUILDING_TYPES.GeneralStore, quality: 10, luck: 50 });
  } finally { console.warn = warn; }
  assert.deepEqual(order, [['spy', 1], ['after']], 'Foraging added its item before the later subscribers ran; the throw was contained');
  assert.equal(items[0].templateIndex, FT.WoodAxe);
  for (const n of ['zz-spy', 'zz-throws', 'zz-after']) registerContainerLootHandler(n, null);
  _setForagingRandomForTests(null);
  _resetForagingInstall();
});

test('FORAGE3: LootTables.OnLootSpawned fires for every key GenerateLoot found - a Coven\'s Q and a Laboratory\'s U too - with the pile\'s index; never for the \'-\' past the table', () => {
  const heard = [];
  registerTabledLootHandler('zz-spy', (a) => heard.push([a.locationIndex, a.key, a.items.length]));
  try {
    addPileLootExtras([], DUNGEON_LOOT_KEYS[DUNGEON_TYPES.Coven], () => 0.999, { locationIndex: DUNGEON_TYPES.Coven });
    addPileLootExtras([], DUNGEON_LOOT_KEYS[DUNGEON_TYPES.Laboratory], () => 0.999, { locationIndex: DUNGEON_TYPES.Laboratory });
    addPileLootExtras([], 'N', () => 0.999, { locationIndex: DUNGEON_TYPES.Prison });
    addPileLootExtras([], '-', () => 0, { locationIndex: 0xffff });
  } finally { registerTabledLootHandler('zz-spy', null); }
  assert.deepEqual(heard, [[7, 'Q', 0], [9, 'U', 0], [3, 'N', 0]]);
});

test('FORAGE3 Q12: a building-interior pile passes its LOCATION type, which Foraging reads as the dungeon type of that number', () => {
  const heard = [];
  registerTabledLootHandler('zz-spy', (a) => heard.push([a.locationIndex, a.key]));
  const pool = { containerSeeded: () => false, seedPile: (items) => items };
  try {
    seedInteriorTreasure({ markers: [[0, 0, 0]], building: { buildingType: BUILDING_TYPES.Tavern }, locationType: LOCATION_TYPES.HomeFarms, pool, level: 1, gender: 'male' });
    seedInteriorTreasure({ markers: [[0, 0, 0]], building: { buildingType: BUILDING_TYPES.Tavern }, locationType: LOCATION_TYPES.TownCity, pool, level: 1, gender: 'male' });
  } finally { registerTabledLootHandler('zz-spy', null); }
  assert.deepEqual(heard, [[LOCATION_TYPES.HomeFarms, 'N'], [LOCATION_TYPES.TownCity, 'K']]);
  assert.equal(DUNGEON_LOOT_ARMS[LOCATION_TYPES.HomeFarms], DUNGEON_LOOT_ARMS[DUNGEON_TYPES.Prison], 'a farm\'s tavern pile rolls as a Prison');
  assert.equal(DUNGEON_LOOT_ARMS[LOCATION_TYPES.TownCity], DUNGEON_LOOT_ARMS[DUNGEON_TYPES.Crypt], 'a city\'s as a Crypt');
  assert.equal(DUNGEON_LOOT_ARMS[LOCATION_TYPES.Tavern], undefined, 'a Tavern location\'s never (a Natural Cave)');
});

test('FORAGE3: the corpse hook rides the death event every pool raises', () => {
  _resetModSettings();
  _resetForagingInstall();
  installForaging({ fetchBytes: async () => new Uint8Array() });
  _setForagingRandomForTests(seq(0, 0, 0, 0));
  const orc = { isClass: false, careerIndex: 7, isPlayer: false, items: [] };
  raiseEnemyDeath(orc, { luck: 50 });
  assert.ok(orc.items.some((i) => i.templateIndex === FT.WoodAxe), 'an Orc at 0 < 2: one Wood-Axe in its body');
  _setForagingRandomForTests(null);
  _resetForagingInstall();
});

test('FORAGE3: the wiring - the install subscribes all three; every host raises the container event at its stock and hands each pile its index', () => {
  const inst = rd('src/systems/foraging/foragingInstall.js');
  assert.match(inst, /registerContainerLootHandler\(FORAGING_VENDOR, onForagingContainerLoot\);\n\s*registerTabledLootHandler\(FORAGING_VENDOR, onForagingPileLoot\);\n\s*registerEnemyDeathHandler\(FORAGING_VENDOR, onForagingEnemyDeath\);/);
  const wm = rd('src/scenes/worldModes.js');
  assert.doesNotMatch(wm, /onShopShelfStocked/, 'no host calls a mod\'s subscriber by name');
  assert.match(wm, /rolled = stockHouseContainer\([^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*raiseContainerLootSpawned\(\{ containerType: LOOT_CONTAINER_TYPES\.HouseContainers, items: rolled, buildingType: b\?\.buildingType, quality: b\?\.quality, luck: liveStat\(playerEntity, 'luck'\) \}\);[\s\S]{0,700}?if \(\(rolled \?\? c\.items\)\.length === 0\) return true;/, 'the house container raises it before "If no contents"');   // PIN MOVED (OUTDOOR-LOOT): the roll is held a moment (rolled), not written to the container, until the Yes
  assert.match(wm, /function shelfLootSpawned\(items, b\) \{\n\s*return raiseContainerLootSpawned\(\{ containerType: LOOT_CONTAINER_TYPES\.ShopShelves, items,/);
  assert.match(rd('src/scenes/dungeonContext.js'), /addPileLootExtras\(items, lootKey, rolls, \{ locationIndex: dfLocation\.mapTableData\.dungeonType, luck, level, where: 'dungeon', quarters \}\);/);   // PIN MOVED (PARTY-LOOT): the roll's own terms (the player's by default)   // AUDIT OH-F B3 (main's, at the merge): and the dungeon's own tag; MERGE 2: REALM P0.4's level beside them
  assert.match(rd('src/scenes/world.js'), /addPileLootExtras\(items, lootKey, Math\.random, \{ locationIndex: WOD_LOOT_LOCATION_INDEX, luck: liveStat\(playerEntity, 'luck'\), level: playerEntity\.level \}\);/);   // MERGE 2: REALM P0.4's level
  assert.match(rd('src/scenes/interiorContext.js'), /addPileLootExtras\(generateLootItems\(lootKey, \{ level, gender \}\), lootKey, Math\.random, \{ locationIndex: locationType, luck, level \}\)/);   // MERGE 2: REALM P0.4's level
});
