// FIELD BUGS 2026-09-30b (RES-RING, RES-MARK, HOME-PLAQUE) - midijamz, #general: "I have a couple quests that take place
// a <someone>'s residence. People aren't marking it on the map, I've gone in the direction they said but every door looks
// like just a house I can buy. How the hell can I find this place?"
//
// Three faults, driven here over the real QuestMachine (a `Place _house_ local house2` in a crafted town), the real
// TopicTree fed by the machine's hooks, the real AnswerPipeline and talk macros (%hnt -> 7332/7333 -> %loc/%di),
// discovery.js, stampResidenceQuestNames and the Enhanced town sheet:
//  RES-RING: a quest house the player has learned of is override-named at its discovery (AUDIT 63 F49), and the sheet's
//    ring and quest pen read `questName`, which the stamp sets only on the other arm - so the house an NPC had just
//    "marked on your map" was drawn as any house, no ring. The stamp says `questMarked` on either arm now.
//  RES-MARK (a departure): DFU marks the map on 35% of the answers of one who knows (26 questions in 100 from a street
//    commoner) and gives "north of here" otherwise - and a residence has no sign. A quest's own building is always marked
//    now, outdoors, by one who knows; every other building keeps the roll, and indoors never marks.
//  HOME-PLAQUE: a private house has no name, a nameless door drew no plaque, and HOME2's verbs ride the plaque - so the
//    first click at any house fell through to HOME-OFFER's "Buy it?" box. A house with verbs is named "Residence" now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { loadQuestTables } = await import('../../src/systems/quest/tables.js');
const { QuestMachine } = await import('../../src/systems/quest/machine.js');
const { TopicTree, QUEST_INFO_RESOURCE_TYPE, LIST_ITEM_TYPE, BUILDING_HINT_TYPE } = await import('../../src/systems/topicTree.js');
const { AnswerPipeline, TALK_STRINGS } = await import('../../src/systems/answerPipeline.js');
const { expandRandomTextRecord } = await import('../../src/systems/talk/talkMacros.js');
const { discoverBuilding, discoveredBuildings, undiscoverBuilding, restoreDiscovery } = await import('../../src/systems/discovery.js');
const { stampResidenceQuestNames } = await import('../../src/ui/exteriorAutomapWindow.js');
const { createTownSheet } = await import('../../src/ui/town/townSheet.js');
const { BUILDING_TYPES: T, isResidence } = await import('../../src/world/buildingNames.js');
const { makeBuildingKey } = await import('../../src/systems/talk/talkTopics.js');

const TABLES = fileURLToPath(new URL('../../vendor/dfu-quests/Tables', import.meta.url));
loadQuestTables(Object.fromEntries(readdirSync(TABLES).filter((f) => f.endsWith('.txt'))
  .map((f) => [f.replace('.txt', ''), readFileSync(join(TABLES, f), 'utf8').replace(/^﻿/, '')])));

// Bigtown: one block - a tavern, two House2, a House1 (every one with a spawn marker), the questplaces.test.js shapes
const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
const bld = (buildingType) => ({ buildingType, factionId: 0, nameSeed: 777, locationId: 0, sector: 0, quality: 9 });
const TYPES = [T.Tavern, T.House2, T.House2, T.House1];
const block = { position: 5000, rmbBlock: { fldHeader: { buildingDataList: TYPES.map(bld), otherNames: null },
  subRecords: TYPES.map(() => ({ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } })) } };
const MAP_ID = 111, LOC = '0:Bigtown';
const town = { loaded: true, regionIndex: 0, regionName: 'Testshire', name: 'Bigtown', locationIndex: 0, hasDungeon: false,
  mapTableData: { mapId: MAP_ID, locationType: 0, dungeonType: -1 }, dungeon: null,
  exterior: { buildings: [bld(T.Tavern)], recordElement: { header: { x: 0, y: 0 } }, exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] } } };
const world = {
  maps: { regionCount: 1, getRegion: () => ({ name: 'Testshire', locationCount: 1, mapTable: [town.mapTableData] }), getLocation: () => town,
    getLocationByName: () => town, getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: () => 0x400, getClimateIndex: () => 231 },
  getBlock: () => block, currentLocation: () => town, currentRegionIndex: () => 0, currentLocationIndex: () => 0, currentRegionName: () => 'Testshire',
  isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false, playerPixel: () => ({ x: 100, y: 100 }),
  buildingNameOpts: () => ({}), discoverLocation() {}, addNote() {},
};
// TalkManager.listBuildings: BuildingNames names a residence '' (world/buildingNames.js)
const POS = [[10, 0, 10], [100, 0, 300], [300, 0, 300], [200, 0, 50]];
const directory = TYPES.map((t, i) => ({ name: i ? '' : 'The Rusty Mug', buildingType: t, factionId: 0, quality: 9, position: POS[i], buildingKey: makeBuildingKey(0, 0, i) }));
const RECORDS = { 7271: "It's really easy. You'll want to go %hnt.", 7332: '... Let me just mark %loc here on your map', 7333: '%di of here' };

/** A quest with a local house2 Place, the town's talk, one question asked at `roll`; answers what the player then has. */
function ask({ roll, inside = false, row = 'quest' }) {
  restoreDiscovery(null);
  let tree = null;
  const m = new QuestMachine({ nowSeconds: () => 0, world,
    addQuestTopics: (q) => tree.addQuestTopicsForQuest(q),
    dialogLink: (u, n, t, n2, t2) => tree.dialogLinkForQuestInfoResource(u, n, t, n2 ?? null, t2 ?? QUEST_INFO_RESOURCE_TYPE.NotSet),
    addDialog: (u, n, t, i) => tree.addDialogForQuestInfoResource(u, n, t, i),
    undiscoverBuilding: (k, n) => undiscoverBuilding(LOC, k, true, n ?? null), forceTopicListsUpdate: () => tree.forceTopicListsUpdate() });
  tree = new TopicTree({ getQuest: (id) => m.getQuest(id), getAllActiveQuestIds: () => [...m.quests.keys()],
    currentRegionName: () => 'Testshire', currentLocationName: () => 'Bigtown', currentMapId: () => MAP_ID, isPlayerInside: () => inside,
    getBuildingList: () => directory, exteriorBuildings: () => town.exterior.buildings, undiscoverBuilding: (k, n) => undiscoverBuilding(LOC, k, true, n ?? null) });
  const quest = m.scheduleQuest(['Quest: __QP', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _house_ local house2', '', ' log 1011 step 0'], 0, { rolls: () => 0 });
  m.tick();
  const sd = quest.getResource({ name: 'house' }).siteDetails;
  const questSource = { currentMapID: () => MAP_ID, isBuildingQuestResource: (mid, k) => tree.isBuildingQuestResource(mid, k) };
  tree.assembleTopicLists();
  const rows = tree.listTopicLocation.flatMap((g) => (g.listChildItems ?? []).filter((c) => c.type !== LIST_ITEM_TYPE.NavigationBack));
  const item = row === 'quest' ? rows.find((c) => c.buildingKey === sd.buildingKey && c.key) : rows.find((c) => c.caption === 'The Rusty Mug');
  assert.ok(item, `the ${row} row is listed`);
  const session = { socialGroup: 0, isSpyMaster: false, numAnswersGivenTellMeAboutOrRumors: 0 };
  const ctx = { randomTokens: (id) => [{ text: RECORDS[id] ?? '' }], localizedText: (k) => TALK_STRINGS[k] ?? '', hooks: { world: {} } };
  const pipeline = new AnswerPipeline({ tree, npcSession: () => session, npcsKnowEverything: () => true, localizedText: (k) => TALK_STRINGS[k] ?? '',
    expandRandomTextRecord: (id) => expandRandomTextRecord(id, ctx), isPlayerInside: () => inside, buildingCompassDirection: () => 'north',
    // world.js's discoverBuilding seam, shape for shape (the quest name-override arm, PlayerGPS.cs:945-959)
    discoverBuilding: (k) => discoverBuilding(LOC, tree.listBuildings.find((b) => b.buildingKey === k) ?? { buildingKey: k }, null, questSource),
    rolls: () => roll, toneIndex: () => 1, reactionTier: () => 1 });
  ctx.pipeline = pipeline;
  pipeline.getQuestionText(item, 1);
  const answer = pipeline.getAnswerText(item, { npcSeed: 1 });
  // the M key (world.js toggleExteriorAutomap): the stamp at open, then the Enhanced sheet
  const summaries = directory.map((d, i) => ({ buildingKey: d.buildingKey, blockX: 0, blockY: 0, position: POS[i], buildingType: d.buildingType, isResidence: isResidence(d.buildingType), name: d.name }));
  stampResidenceQuestNames(summaries, discoveredBuildings(LOC), { getAllActiveQuestIds: () => [quest.uid], getQuest: () => quest, isBuildingQuestResource: questSource.isBuildingQuestResource }, MAP_ID);
  const sheet = createTownSheet({ gridW: 1, gridH: 1, blocks: [], buildings: () => summaries, discovered: () => discoveredBuildings(LOC) });
  const out = { answer, sd, summaries, names: sheet.names().map((n) => ({ text: n.text, quest: n.quest })), rings: sheet.quests().length,
    flag: tree.dictQuestInfo.get(quest.uid).resourceInfo.get('house').questPlaceResourceHintTypeReceived, found: discoveredBuildings(LOC).map((r) => r.displayName) };
  restoreDiscovery(null);
  return out;
}

test('RES-RING: a quest residence an NPC marked is RUNG and inked as the quest\'s on the Enhanced town map (mutants: the ring keyed on questName alone; the pen left off the override arm)', () => {
  const r = ask({ roll: 0.1 });   // <= 0.35: DFU's 7332 map arm
  assert.equal(r.answer, `It's really easy. You'll want to go ... Let me just mark ${r.sd.buildingName} here on your map.`);
  assert.equal(r.flag, BUILDING_HINT_TYPE.LocationWasMarkedOnMap);
  assert.deepEqual(r.names, [{ text: r.sd.buildingName, quest: true }], 'the NPC said it was marked: the name in the quest\'s pen, proud of the rest');
  assert.equal(r.rings, 1, 'and the ring the sheet draws round a quest\'s residence');
  // the classic town map's ladder (ExteriorAutomap.cs:676-682) is DFU's and unchanged: an override-named residence takes
  // the display-name arm, and its questName is never stamped (automap_ext's pin)
  assert.equal(r.summaries.find((b) => b.buildingKey === r.sd.buildingKey).questName, undefined);
});

test('RES-MARK: a townsperson who knows where a quest\'s residence is marks it on the map, whatever the 35% roll; every other building keeps DFU\'s directions (mutants: the roll kept for the quest row; the map arm for a plain building; the map arm indoors)', () => {
  const r = ask({ roll: 0.9 });   // > 0.35: DFU's 7333 direction arm
  assert.match(r.answer, /Let me just mark The .+ Residence here on your map/, `answered: ${r.answer}`);
  assert.deepEqual(r.found, [r.sd.buildingName], 'discovered under the quest\'s name');
  assert.equal(r.flag, BUILDING_HINT_TYPE.LocationWasMarkedOnMap);
  assert.equal(r.rings, 1);
  const shop = ask({ roll: 0.9, row: 'shop' });
  assert.equal(shop.answer, "It's really easy. You'll want to go north of here.", 'a tavern is still DFU\'s 65% directions');
  assert.deepEqual(shop.found, []);
  const indoors = ask({ roll: 0.1, inside: true });
  assert.equal(indoors.answer, "It's really easy. You'll want to go north of here.", 'never a mark indoors (TalkManager.cs:1713)');
  assert.deepEqual(indoors.found, []);
});

test('HOME-PLAQUE: a nameless house whose door has verbs is a "Residence" - its plaque stands and lists them; a named building keeps its name; no verbs, no name (mutants: the word dropped; the verbs read after the name)', async () => {
  const { homeDoorName, homeBuyRows } = await import('../../src/systems/online/onlineHomes.js');
  const { staticDoorName } = await import('../../src/systems/worldTooltips.js');
  assert.equal(homeDoorName('', true), 'Residence');
  assert.equal(homeDoorName('The Mosrey Residence', true), 'The Mosrey Residence', 'the quest\'s own name stands');
  assert.equal(homeDoorName('', false), '', 'a house with nothing to list stays DFU\'s nameless door');
  assert.equal(staticDoorName('building', { displayName: homeDoorName('', false) }), null, 'no plaque, as before');
  const plaque = staticDoorName('building', { displayName: homeDoorName('', !!homeBuyRows(4000)) });
  assert.ok(plaque, 'a plaque stands for a house for sale');
  assert.match(JSON.stringify(plaque), /Residence/);
  const m = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(m, /const houseVerbs = homeDoorVerbs\(bd, home\);\n\s*_doorText = staticDoorName\('building', \{\n\s*displayName: home \? homeDoorTitle\(home, questSiteHere\(bd\) && db\.isOverrideName \? db\.displayName : null\) : homeDoorName\(shownBuildingName\(db, bd\.name\), !!houseVerbs\),/);   // PIN MOVED (QUEST-RESIDENCE, FIELD BUGS 2026-10-15c): a quest's home says the quest's name - homeDoorTitle's second word
  assert.match(m, /const verbs = _doorText \? houseVerbs : null;/);
});
