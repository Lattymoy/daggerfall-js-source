// PROF-FOUND (2026-10-12, Mac: "Ensure all the professions new stores are flagged on the town map and you can ask NPCs
// where they are"; bible/06-Systems/Professions-Arc.md 42). THE STATION SHOPS FOUND AS EVERY SHOP IS: of the shops the
// professions' stations stand in (scenes/worldModes.js forgeHere .. enchantHere), the Furniture Store - the furnisher's
// counter (DECOR2b) and Carpentry's workbench (PROF4) - was the one DFU keeps off the Where-is page (TalkManager
// CheckBuildingTypeInSkipList) and draws in the house colour (ExteriorAutomap.cs:1482-1541), because classic never
// opened it. It is asked after under its own group now (systems/topicTree.js, scenes/townTalk.js's fallback) and drawn
// in the shop's colour on both town maps (ui/town/townQuarters.js), from one law (world/buildingNames.js OPENED_SHOP_TYPES).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_TYPES, OPENED_SHOP_TYPES, OPENED_SHOP_GROUPS } from '../../src/world/buildingNames.js';
import { TOPIC_CATEGORIES, isBuildingTypeSkipped, makeBuildingKey } from '../../src/systems/talk/talkTopics.js';
import { TopicTree, LIST_ITEM_TYPE, QUESTION_TYPE, EN, checkBuildingTypeInSkipList } from '../../src/systems/topicTree.js';
import { AnswerPipeline } from '../../src/systems/answerPipeline.js';
import { buildingCompassDirection, DIRECTION_HINTS } from '../../src/systems/talk/talk.js';
import { yardDirectoryRows } from '../../src/systems/merchantYards.js';
import { quarterOf, quarterOfType, SHOP_SET, HOUSE_SET, OPENED_SHOP_BYTES, CLASSIC_ARGB } from '../../src/ui/town/townQuarters.js';
import { isEnterable } from '../../src/ui/ink/inkTown.js';
import { buildExteriorLayout } from '../../src/ui/exteriorAutomapWindow.js';
import { createTownSheet } from '../../src/ui/town/townSheet.js';
import { hostText } from '../hostText.mjs';

const read = (p) => hostText(p);   // HOST-SPLIT 2: a host read whole - the town map's door lives in scenes/exteriorAutomapToggle.js (STAR0)

/** The shop types the professions' stations stand in, read off the producer: every BUILDING_TYPES member the station
 *  questions of the interior host name (forgeHere through enchantHere; cookFireHere asks a fire, not a shop). */
function stationShopTypes() {
  const src = read('src/scenes/worldModes.js');
  const from = src.indexOf('\n    forgeHere() {'), to = src.indexOf('\n    cookFireHere() {');
  assert.ok(from > 0 && to > from, 'the station questions stand where they did');
  return [...new Set([...src.slice(from, to).matchAll(/BUILDING_TYPES\.(\w+)/g)].map((m) => m[1]))];
}

const FURN_A = { name: 'Gwynara\'s Furniture', buildingKey: makeBuildingKey(0, 0, 3), buildingType: BUILDING_TYPES.FurnitureStore, position: [30, 0, 70] };
const FURN_B = { name: 'The Odd Woodwork', buildingKey: makeBuildingKey(1, 0, 4), buildingType: BUILDING_TYPES.FurnitureStore, position: [150, 0, 20] };
const SHOPS = [
  { name: 'The Odd Blades', buildingKey: makeBuildingKey(0, 0, 1), buildingType: BUILDING_TYPES.WeaponSmith, position: [20, 0, 20] },
  { name: 'The Dented Helm', buildingKey: makeBuildingKey(1, 0, 2), buildingType: BUILDING_TYPES.Tavern, position: [120, 0, 30] },
];
const PALACE = { name: 'Castle Daggerfall', buildingKey: makeBuildingKey(1, 1, 0), buildingType: BUILDING_TYPES.Palace, position: [80, 0, 80] };

function treeOver(list) {
  return new TopicTree({
    getQuest: () => null, getAllActiveQuestIds: () => [], currentRegionIndex: () => 17, currentRegionName: () => 'Daggerfall',
    currentLocationName: () => 'Daggerfall', currentMapId: () => 7, isPlayerInside: () => false, isPlayerInsideBuilding: () => false,
    isPlayerInsideCastle: () => false, currentBuildingKey: () => -1, getBuildingList: () => list, exteriorBuildings: () => [],
    factionName: (id) => `faction:${id}`,
  });
}

test('PROF-FOUND THE LAW: every shop a profession\'s station stands in - read off the interior host\'s station questions - is asked after on the Where-is page and drawn as built, enterable ground on the town map; the Furniture Store is the one shop the port opened past DFU\'s tables, and DFU\'s own skip list and categories stay as they are (mutants: the opened shops emptied, the group misworded)', () => {
  const stations = stationShopTypes();
  assert.deepEqual(stations.sort(), ['Alchemist', 'Armorer', 'ClothingStore', 'FurnitureStore', 'GemStore', 'GeneralStore', 'GuildHall', 'PawnShop', 'WeaponSmith']);
  const asked = new Set([...TOPIC_CATEGORIES.map((c) => c.type), ...OPENED_SHOP_TYPES]);
  for (const name of stations) {
    const t = BUILDING_TYPES[name];
    assert.ok(asked.has(t), `${name}: a Where-is group`);
    assert.ok(isEnterable(t + 1), `${name}: built, enterable ground on the town map`);
    assert.notEqual(quarterOfType(t), 'house', `${name}: never a house's colour`);
  }
  assert.deepEqual(OPENED_SHOP_TYPES, [7]);
  assert.equal(BUILDING_TYPES.FurnitureStore, 7);
  assert.deepEqual(OPENED_SHOP_GROUPS, { 7: 'Furniture stores' });
  // DFU's tables, verbatim: the skip list still names it, the C#-shaped categories still lack it
  assert.equal(checkBuildingTypeInSkipList(BUILDING_TYPES.FurnitureStore), true);
  assert.equal(isBuildingTypeSkipped(BUILDING_TYPES.FurnitureStore), true);
  assert.ok(!TOPIC_CATEGORIES.some((c) => c.type === BUILDING_TYPES.FurnitureStore));
});

test('PROF-FOUND THE WHERE-IS PAGE: the town\'s Furniture Stores one group, "Furniture stores", after DFU\'s shops and before the yards - its Previous List head, each store asked as a building (LocalBuilding, its key), in the list\'s order; a town with none has no group, and the palace still joins General (mutants: the stores ungrouped, the head lost, asked as a region)', () => {
  const yards = yardDirectoryRows([{ kind: 'stable', x: 60, z: 60, keeper: { name: 'Gwynara Moorhart' } }]);
  const tree = treeOver([...SHOPS, FURN_A, ...yards, FURN_B, PALACE]);
  tree.assembleTopicListLocation();
  assert.deepEqual(tree.listTopicLocation.map((g) => g.caption), ['Weapon smiths', 'Taverns', 'Furniture stores', 'Stables', EN.general, EN.regional]);
  const g = tree.listTopicLocation.find((x) => x.caption === 'Furniture stores');
  assert.equal(g.type, LIST_ITEM_TYPE.ItemGroup);
  assert.equal(g.listChildItems[0].type, LIST_ITEM_TYPE.NavigationBack, 'the Previous List head');
  assert.equal(g.listChildItems[0].listParentItems, tree.listTopicLocation);
  assert.deepEqual(g.listChildItems.slice(1).map((c) => [c.caption, c.questionType, c.buildingKey]), [
    [FURN_A.name, QUESTION_TYPE.LocalBuilding, FURN_A.buildingKey],
    [FURN_B.name, QUESTION_TYPE.LocalBuilding, FURN_B.buildingKey],
  ]);
  const general = tree.listTopicLocation.find((x) => x.caption === EN.general);
  assert.deepEqual(general.listChildItems.slice(1).map((c) => c.caption), [PALACE.name], 'the palace in General, as C# lays it');
  const bare = treeOver(SHOPS);
  bare.assembleTopicListLocation();
  assert.deepEqual(bare.listTopicLocation.map((x) => x.caption), ['Weapon smiths', 'Taverns', EN.regional], 'no Furniture Store, no group');
});

test('PROF-FOUND THE ANSWER: asked where a Furniture Store is, the compass reads it off the directory ("%di of here"), the knowledge roll takes its key, and "I\'ll mark it on your map" discovers it by its key - so the town map names it (mutants: the stores ungrouped)', () => {
  const list = [...SHOPS, FURN_A, FURN_B];
  const south = [FURN_B.position[0], 0, FURN_B.position[2] - 40], west = [FURN_B.position[0] - 40, 0, FURN_B.position[2]];
  assert.equal(buildingCompassDirection({ listBuildings: list, playerPos: south }, FURN_B.buildingKey), DIRECTION_HINTS.north, 'south of it: north of here');
  assert.equal(buildingCompassDirection({ listBuildings: list, playerPos: west }, FURN_B.buildingKey), DIRECTION_HINTS.east);
  const found = [];
  const tree = treeOver(list);
  tree.assembleTopicListLocation();
  const pipe = new AnswerPipeline({ tree, discoverBuilding: (k) => found.push(k), session: () => ({ socialGroup: 0, isSpyMaster: false }) });
  const item = tree.listTopicLocation.find((x) => x.caption === 'Furniture stores').listChildItems[2];
  assert.equal(item.buildingKey, FURN_B.buildingKey);
  pipe.currentKeySubjectBuildingKey = item.buildingKey;
  pipe.markKeySubjectLocationOnMap();
  assert.deepEqual(found, [FURN_B.buildingKey], 'marked on the map: the store discovered by its key');
  assert.equal(pipe.getNPCKnowledgeAboutItem(item, 1234), pipe.getNPCKnowledgeAboutItem(item, 1234), 'the roll stable per person and place');
});

test('PROF-FOUND THE TOWN MAP: the Furniture Store\'s byte (8) is in the shop\'s group and out of the house\'s, every other byte where DFU puts it; the classic window paints it the shop\'s colour, and the enhanced sheet letters a discovered one in a shop\'s ink - an undiscovered one stays unnamed, as every shop does (mutants: the byte left a house\'s, the house set unfiltered, the set unsorted)', () => {
  assert.deepEqual(OPENED_SHOP_BYTES, [8]);
  assert.deepEqual(SHOP_SET, [1, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14]);
  assert.deepEqual(HOUSE_SET, [2, 5, 17, 18, 19, 20, 21, 22, 23, 24]);
  assert.equal(quarterOf(8), 'shop');
  assert.equal(quarterOfType(BUILDING_TYPES.FurnitureStore), 'shop');
  assert.equal(isEnterable(8), true);
  assert.equal(quarterOf(2), 'house', 'a house for sale is still a house');
  // the classic window: byte 8 in the shop's colour, a house beside it in the house's
  const autoMap = new Uint8Array(64 * 64);
  autoMap[0] = 8; autoMap[1] = 18; autoMap[2] = 10;
  const colours = { temple: CLASSIC_ARGB.temple, shop: CLASSIC_ARGB.shop, tavern: CLASSIC_ARGB.tavern, house: CLASSIC_ARGB.house };
  const bmp = buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap }], 'original', colours);
  assert.deepEqual([bmp.colors[0], bmp.colors[1], bmp.colors[2]], [colours.shop, colours.house, colours.shop]);
  // the enhanced sheet: the discovery law kept, the ink a shop's
  const store = { ...FURN_A, blockX: 0, blockY: 0, isResidence: false };
  const other = { ...FURN_B, blockX: 0, blockY: 0, isResidence: false };
  const sheet = createTownSheet({
    gridW: 1, gridH: 1, blocks: [{ x: 0, y: 0, autoMap }], buildings: () => [store, other],
    discovered: () => [{ buildingKey: store.buildingKey, displayName: store.name }],
  });
  assert.deepEqual(sheet.names().map((n) => [n.text, n.quarter, n.key]), [[store.name, 'shop', store.buildingKey]]);
});

test('PROF-FOUND THE HOSTS: townTalk\'s own grouping (no engine) lays the opened shops after DFU\'s and before the found places, as the tree does; both exterior hosts build their talk and their town map from the shared modules, and the dungeon opens no town map (mutants: the fallback\'s group dropped)', () => {
  const tt = read('src/scenes/townTalk.js');
  const cats = tt.indexOf('...TOPIC_CATEGORIES.map((c) => ({ label: c.caption, buildings: directory.filter((b) => b.buildingType === c.type) })),');
  const opened = tt.indexOf('...OPENED_SHOP_TYPES.map((t) => ({ label: OPENED_SHOP_GROUPS[t], buildings: directory.filter((b) => b.buildingType === t) })),');
  const found = tt.indexOf('...FOUND_KIND_ORDER.map((k) => ({ label: FOUND_TALK_GROUPS[k], buildings: directory.filter((b) => b.yard === k) })),');
  assert.ok(cats > 0 && opened > cats && found > opened, 'DFU\'s groups, the opened shops, then the found places');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.match(s, /createTownTalk\(\{/, `${host}: the shared talk`);
    // PIN MOVED (FB1020c STREETS-TAB, at the merge of STAR0's move): the streaming host's M key hands the door the bag `townHere` builds for either key
    assert.match(s, host === 'src/scenes/world.js' ? /createTownMapWindow\(here\.deps\)/ : /createTownMapWindow\(\{/, `${host}: the shared town map`);
  }
  assert.doesNotMatch(read('src/scenes/dungeonContext.js'), /createTownMapWindow/, 'the dungeon opens no town map');
});
