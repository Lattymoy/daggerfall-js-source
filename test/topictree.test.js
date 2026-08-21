// TK-ii - THE TOPIC TREE (TalkManager.cs's topic-list core). The
// ListItem/QuestResourceInfo shapes with their C# field defaults; the
// quest topic pipeline (both AddQuestTopicWithInfoAndRumors
// overloads, DialogLink, AddDialog, Remove, ForceUpdate) with THE
// DISCARDED FIRST ADD and THE STICKY TELL-ME-ABOUT FLAG; the
// misnamed person-lookup throws; IsBuildingQuestResource; the four
// assemblers with THE SHARED GROUP VARIABLE's flow, the regional
// building tables, the skip list and the caption null test; the
// knowledge/same-building gates; and the conversation-save halves
// with their orphan sweep and three-type relink.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TopicTree, LIST_ITEM_TYPE, QUESTION_TYPE, NPC_KNOWLEDGE,
  QUEST_INFO_RESOURCE_TYPE, BUILDING_HINT_TYPE, INFO_FACTION_IDS,
  FACTIONS_AND_BUILDINGS, KNIGHTLY_ORDER_REGIONS, REGIONAL_BUILDING_NAMES,
  EN, newListItem, newQuestResourceInfo, getQuestInfoResourceType,
  buildingTypeToGroupString, checkBuildingTypeInSkipList,
} from '../src/systems/topicTree.js';
import { QUEST_INFO_RESOURCE_TYPE as ACTIONS_QIRT } from '../src/systems/quest/actions.js';
import { BUILDING_TYPES, isResidence } from '../src/world/buildingNames.js';

const tok = (text) => [{ formatting: -1, text, x: 0, y: 0 }];

/** A place resource stub with the fields the tree reads. */
const mkPlace = (name, over = {}) => ({
  isPlace: true, symbol: { name },
  siteDetails: {
    mapId: 100, buildingKey: 0, buildingName: null, locationName: 'Daggerfall',
    regionName: 'Daggerfall', ...over,
  },
});
const mkPerson = (name, over = {}) => ({
  isPerson: true, symbol: { name }, displayName: over.displayName ?? 'Sirien',
  isQuestor: false, questorData: { mapID: 0, buildingKey: 0, context: null },
  homeRegionName: 'Daggerfall', homeRegionIndex: 17, homeBuildingName: 'The Home',
  getAssignedPlaceSymbol: () => over.assignedPlaceSymbol ?? null,
  getHomePlace: () => over.homePlace ?? null,
  parentQuest: over.parentQuest ?? null,
  ...over,
});
const mkItem = (name, itemName) => ({
  isItem: true, symbol: { name },
  daggerfallUnityItem: itemName == null ? null : { name: itemName },
});

const mkQuest = (uid, resources = [], over = {}) => ({
  uid,
  resources: new Map(resources.map((r) => [r.symbol.name, r])),
  getResource: (symbol) => resources.find((r) => r.symbol.name === symbol?.name) ?? null,
  getPlace: (symbol) => resources.find((r) => r.isPlace && r.symbol.name === symbol?.name) ?? null,
  getMessage: over.getMessage ?? (() => null),
  ...over,
});

function makeTree(over = {}) {
  const calls = [];
  const tree = new TopicTree({
    getQuest: () => null,
    getAllActiveQuestIds: () => [],
    currentRegionIndex: () => 17,
    currentRegionName: () => 'Daggerfall',
    currentLocationName: () => 'Daggerfall',
    currentMapId: () => 100,
    isPlayerInside: () => false,
    isPlayerInsideBuilding: () => false,
    isPlayerInsideCastle: () => false,
    currentBuildingKey: () => -1,
    getBuildingList: () => [],
    exteriorBuildings: () => [],
    factionName: (id) => `faction:${id}`,
    addOrReplaceQuestProgressRumor: (...a) => calls.push(['progressRumor', ...a]),
    undiscoverBuilding: (...a) => calls.push(['undiscover', ...a]),
    talkPartner: () => null,
    onTopicListsUpdated: () => calls.push(['listsUpdated']),
    ...over,
  });
  return { tree, calls };
}

// ---------------------------------------------------------------
// The shapes + tables
// ---------------------------------------------------------------

test('the enums and the C# field defaults', () => {
  assert.deepEqual({ ...LIST_ITEM_TYPE }, { Item: 0, ItemGroup: 1, NavigationBack: 2 });
  assert.equal(QUESTION_TYPE.NoQuestion, 0);
  assert.equal(QUESTION_TYPE.QuestItem, 11, 'the twelve question types in C# order');
  assert.deepEqual({ ...NPC_KNOWLEDGE }, { NotSet: 0, DoesNotKnowAboutItem: 1, KnowsAboutItem: 2 });
  assert.deepEqual({ ...BUILDING_HINT_TYPE }, { None: 0, ReceivedDirectionalHints: 1, LocationWasMarkedOnMap: 2 });
  assert.deepEqual(newListItem(), {
    type: LIST_ITEM_TYPE.Item, caption: 'undefined', key: '', factionID: -1,
    questionType: QUESTION_TYPE.NoQuestion, npcKnowledgeAboutItem: NPC_KNOWLEDGE.NotSet,
    buildingKey: -1, npcInSameBuildingAsTopic: false, questID: 0, index: -1,
    listChildItems: null, listParentItems: null,
  });
  assert.deepEqual(newQuestResourceInfo(), {
    resourceType: QUEST_INFO_RESOURCE_TYPE.NotSet, anyInfoAnswers: null, rumorsAnswers: null,
    availableForDialog: true, hasEntryInTellMeAbout: false, hasEntryInWhereIs: false,
    questPlaceResourceHintTypeReceived: BUILDING_HINT_TYPE.None,
    dialogLinkedLocations: [], dialogLinkedPersons: [], dialogLinkedThings: [], questResource: null,
  });
});

test('QUEST_INFO_RESOURCE_TYPE agrees with the copy actions.js sends over the seam', () => {
  // the machine's dialogLink/addDialog calls carry actions.js's enum;
  // a drift between the two would silently mis-route every link
  assert.deepEqual({ ...QUEST_INFO_RESOURCE_TYPE }, { ...ACTIONS_QIRT });
});

test('getQuestInfoResourceType dispatches on the is-flags, NotSet for anything else', () => {
  assert.equal(getQuestInfoResourceType(mkPerson('p')), QUEST_INFO_RESOURCE_TYPE.Person);
  assert.equal(getQuestInfoResourceType(mkPlace('l')), QUEST_INFO_RESOURCE_TYPE.Location);
  assert.equal(getQuestInfoResourceType(mkItem('i', 'Ring')), QUEST_INFO_RESOURCE_TYPE.Thing);
  assert.equal(getQuestInfoResourceType({ isFoe: true, symbol: { name: 'f' } }), QUEST_INFO_RESOURCE_TYPE.NotSet, 'a Foe is NotSet - C# tests only the three');
  assert.equal(getQuestInfoResourceType(null), QUEST_INFO_RESOURCE_TYPE.NotSet);
});

test('the info-faction list, the regional tables and the skip list are verbatim', () => {
  assert.equal(INFO_FACTION_IDS.length, 34);
  assert.deepEqual(INFO_FACTION_IDS.slice(0, 6), [42, 40, 108, 129, 306, 353]);
  assert.equal(INFO_FACTION_IDS.at(-1), 98);
  assert.equal(FACTIONS_AND_BUILDINGS.length, 30);
  assert.equal(REGIONAL_BUILDING_NAMES.length, 30, 'one caption per FactionsAndBuildings row');
  assert.deepEqual([...KNIGHTLY_ORDER_REGIONS], [0x05, 0x11, 0x12, 0x14, 0x15, 0x16, 0x17, 0x2b, 0x33, 0x37]);
  assert.equal(REGIONAL_BUILDING_NAMES[8], 'Order of the Raven', 'row 8 starts the knightly orders');
  assert.equal(REGIONAL_BUILDING_NAMES[18], 'Mages Guild');
  assert.equal(REGIONAL_BUILDING_NAMES[20], 'Tavern', 'row 20 starts the stores');
  // the FULL skip predicate - AllValid and Special1-4 included
  for (const t of [BUILDING_TYPES.AllValid, BUILDING_TYPES.FurnitureStore, BUILDING_TYPES.House1,
    BUILDING_TYPES.House6, BUILDING_TYPES.HouseForSale, BUILDING_TYPES.Palace, BUILDING_TYPES.Ship,
    BUILDING_TYPES.Special1, BUILDING_TYPES.Special4, BUILDING_TYPES.Town23, BUILDING_TYPES.Town4]) {
    assert.equal(checkBuildingTypeInSkipList(t), true, `type ${t} skips`);
  }
  assert.equal(checkBuildingTypeInSkipList(BUILDING_TYPES.Tavern), false);
  assert.equal(buildingTypeToGroupString(BUILDING_TYPES.Tavern), 'Taverns');
  assert.equal(buildingTypeToGroupString(BUILDING_TYPES.Temple), 'Local temples');
  assert.equal(buildingTypeToGroupString(BUILDING_TYPES.Palace), '', 'an ungrouped type answers the empty string');
  assert.equal(isResidence(BUILDING_TYPES.House4), true);
  assert.equal(isResidence(BUILDING_TYPES.House5), false, 'only House1-House4 are residences');
});

// ---------------------------------------------------------------
// The quest topic pipeline (:2069-2285)
// ---------------------------------------------------------------

test('addQuestTopicsForQuest: the RumorsDuringQuest progress rumor + one topic per resource', () => {
  const place = mkPlace('_home_');
  const person = mkPerson('_qgiver_');
  const msg = { id: 1007 };
  const quest = mkQuest(7, [place, person], { getMessage: (id) => (id === 1007 ? msg : null) });
  for (const r of [place, person]) {
    r.infoMessageID = 1010; r.rumorsMessageID = 1011;
    r.getMessage = (id) => (id === 1010 ? [tok('info')] : id === 1011 ? [tok('rumor')] : null);
  }
  const { tree, calls } = makeTree({ getQuest: () => quest });
  tree.addQuestTopicsForQuest(quest);
  assert.deepEqual(calls.filter((c) => c[0] === 'progressRumor'), [['progressRumor', 7, msg]], 'message 1007 goes to the mill');
  const info = tree.dictQuestInfo.get(7);
  assert.equal(info.resourceInfo.size, 2);
  assert.equal(info.resourceInfo.get('_home_').resourceType, QUEST_INFO_RESOURCE_TYPE.Location);
  assert.equal(info.resourceInfo.get('_qgiver_').hasEntryInTellMeAbout, true);
});

test('THE DISCARDED FIRST ADD: an empty resourceName on a NEW questID leaves no entry at all', () => {
  const { tree } = makeTree();
  tree.addQuestTopicWithInfoAndRumors(9, mkPlace('x'), '', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  assert.equal(tree.dictQuestInfo.has(9), false, 'the bag was created then dropped on the floor - C#s own order');
  tree.addQuestTopicWithInfoAndRumors(9, mkPlace('x'), null, QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  assert.equal(tree.dictQuestInfo.has(9), false, 'null name too');
  // ...and on an EXISTING questID the standing bag survives untouched
  tree.addQuestTopicWithInfoAndRumors(9, mkPlace('real'), 'real', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  tree.addQuestTopicWithInfoAndRumors(9, mkPlace('x'), '', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  assert.deepEqual([...tree.dictQuestInfo.get(9).resourceInfo.keys()], ['real']);
});

test('THE STICKY FLAG: hasEntryInTellMeAbout only ever sets; hasEntryInWhereIs writes both ways', () => {
  const { tree } = makeTree();
  tree.addQuestTopicWithInfoAndRumors(1, mkPerson('p'), 'p', QUEST_INFO_RESOURCE_TYPE.Person, [tok('a')], null);
  const info = tree.dictQuestInfo.get(1).resourceInfo.get('p');
  assert.equal(info.hasEntryInTellMeAbout, true);
  assert.equal(info.hasEntryInWhereIs, true);
  // re-add with NO answers: the tell-me-about flag STAYS true
  tree.addQuestTopicWithInfoAndRumors(1, mkPerson('p'), 'p', QUEST_INFO_RESOURCE_TYPE.Thing, null, null);
  assert.equal(info.hasEntryInTellMeAbout, true, 'never cleared (C# only ever sets it)');
  assert.equal(info.hasEntryInWhereIs, false, 'but the where-is flag is rewritten for the new type');
  // rumors ALONE also raise it
  const { tree: t2 } = makeTree();
  t2.addQuestTopicWithInfoAndRumors(1, mkPlace('l'), 'l', QUEST_INFO_RESOURCE_TYPE.Location, null, [tok('r')]);
  assert.equal(t2.dictQuestInfo.get(1).resourceInfo.get('l').hasEntryInTellMeAbout, true);
});

test('a Location topic undiscovers its matching quest residences; other types never do', () => {
  const place = mkPlace('_house_', { buildingKey: 4242, buildingName: 'The Rat House' });
  const other = mkPlace('_other_', { buildingKey: 99 });
  const quest = mkQuest(5, [place, other]);
  const { tree, calls } = makeTree({ getQuest: () => quest });
  tree.addQuestTopicWithInfoAndRumors(5, place, '_house_', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  assert.deepEqual(calls.filter((c) => c[0] === 'undiscover'), [['undiscover', 4242, 'The Rat House']], 'only the symbol-matching place');
  calls.length = 0;
  tree.addQuestTopicWithInfoAndRumors(5, mkPerson('p'), 'p', QUEST_INFO_RESOURCE_TYPE.Person, null, null);
  assert.equal(calls.filter((c) => c[0] === 'undiscover').length, 0);
});

test('dialogLink: the three linked lists dedupe, NotSet still hides, an unknown type returns BEFORE hiding', () => {
  const { tree } = makeTree();
  tree.addQuestTopicWithInfoAndRumors(1, mkPlace('l'), 'l', QUEST_INFO_RESOURCE_TYPE.Location, [tok('a')], null);
  tree.addQuestTopicWithInfoAndRumors(1, mkPerson('p'), 'p', QUEST_INFO_RESOURCE_TYPE.Person, [tok('a')], null);
  const l = tree.dictQuestInfo.get(1).resourceInfo.get('l');
  const p = tree.dictQuestInfo.get(1).resourceInfo.get('p');
  tree.dialogLinkForQuestInfoResource(1, 'l', QUEST_INFO_RESOURCE_TYPE.Location, 'p', QUEST_INFO_RESOURCE_TYPE.Person);
  assert.deepEqual(l.dialogLinkedPersons, ['p']);
  assert.equal(l.availableForDialog, false, 'the resource hides');
  assert.equal(p.availableForDialog, false, 'and so does the linked one');
  tree.dialogLinkForQuestInfoResource(1, 'l', QUEST_INFO_RESOURCE_TYPE.Location, 'p', QUEST_INFO_RESOURCE_TYPE.Person);
  assert.deepEqual(l.dialogLinkedPersons, ['p'], 'the Contains guard dedupes');
  // NotSet: no list entry, but the hide still lands
  l.availableForDialog = true;
  tree.dialogLinkForQuestInfoResource(1, 'l', QUEST_INFO_RESOURCE_TYPE.Location);
  assert.equal(l.availableForDialog, false);
  assert.deepEqual(l.dialogLinkedLocations, []);
  // an unknown linked type returns before the hide
  l.availableForDialog = true;
  tree.dialogLinkForQuestInfoResource(1, 'l', QUEST_INFO_RESOURCE_TYPE.Location, 'p', 99);
  assert.equal(l.availableForDialog, true, 'the default arm returns first');
  // a missing quest / missing resource are logged no-ops
  assert.doesNotThrow(() => tree.dialogLinkForQuestInfoResource(404, 'l', 1));
  assert.doesNotThrow(() => tree.dialogLinkForQuestInfoResource(1, 'nope', 1));
});

test('dialogLink rebuilds ONLY the tell-me-about list (:2219)', () => {
  const { tree } = makeTree();
  tree.addQuestTopicWithInfoAndRumors(1, mkPlace('l'), 'l', QUEST_INFO_RESOURCE_TYPE.Location, [tok('a')], null);
  tree.listTopicLocation = ['STALE'];
  tree.listTopicPerson = ['STALE'];
  tree.dialogLinkForQuestInfoResource(1, 'l', QUEST_INFO_RESOURCE_TYPE.Location);
  assert.equal(tree.listTopicTellMeAbout[0].questionType, QUESTION_TYPE.News, 'the tell-me-about list rebuilt');
  assert.deepEqual(tree.listTopicLocation, ['STALE'], 'the others are untouched');
  assert.deepEqual(tree.listTopicPerson, ['STALE']);
});

test('addDialog: un-hides, raises the matching instant flags, and the null name still rebuilds', () => {
  const { tree, calls } = makeTree();
  tree.addQuestTopicWithInfoAndRumors(1, mkPlace('l'), 'l', QUEST_INFO_RESOURCE_TYPE.Location, [tok('a')], null);
  const l = tree.dictQuestInfo.get(1).resourceInfo.get('l');
  l.availableForDialog = false;
  tree.addDialogForQuestInfoResource(1, 'l', QUEST_INFO_RESOURCE_TYPE.Location, true);
  assert.equal(l.availableForDialog, true);
  assert.deepEqual(calls.filter((c) => c[0] === 'listsUpdated').length, 1, 'the instant rebuild tail fires the window refresh');
  assert.equal(tree.instantRebuildTopicListTellMeAbout, false, 'the flags clear after the instant pass');
  assert.equal(tree.instantRebuildTopicListLocation, false);
  // NOT instant: the flags stay raised and rebuildTopicLists is set
  l.availableForDialog = false;
  tree.addDialogForQuestInfoResource(1, 'l', QUEST_INFO_RESOURCE_TYPE.Location, false);
  assert.equal(tree.instantRebuildTopicListTellMeAbout, true);
  assert.equal(tree.instantRebuildTopicListLocation, true);
  assert.equal(tree.rebuildTopicLists, true);
  // a null resourceName skips the body but STILL rebuilds (:2270)
  const { tree: t2, calls: c2 } = makeTree();
  t2.addQuestTopicWithInfoAndRumors(1, mkPlace('l'), 'l', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  t2.addDialogForQuestInfoResource(1, null, QUEST_INFO_RESOURCE_TYPE.Location, true);
  assert.equal(c2.filter((c) => c[0] === 'listsUpdated').length, 1);
  // an unknown quest / resource are logged no-ops
  assert.doesNotThrow(() => t2.addDialogForQuestInfoResource(404, 'l', 1));
  assert.doesNotThrow(() => t2.addDialogForQuestInfoResource(1, 'nope', 1));
});

test('removeQuestInfoTopicsForSpecificQuest drops the quest and flags a rebuild', () => {
  const { tree } = makeTree();
  tree.addQuestTopicWithInfoAndRumors(1, mkPlace('l'), 'l', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  tree.rebuildTopicLists = false;
  tree.removeQuestInfoTopicsForSpecificQuest(1);
  assert.equal(tree.dictQuestInfo.has(1), false);
  assert.equal(tree.rebuildTopicLists, true);
  assert.doesNotThrow(() => tree.removeQuestInfoTopicsForSpecificQuest(404));
});

// ---------------------------------------------------------------
// The person/building lookups (:2287-2374) - THE MISNAMED THROWS
// ---------------------------------------------------------------

test('getPersonResource: the four throw literals verbatim, wrong words included', () => {
  const { tree } = makeTree();
  assert.throws(() => tree.getPersonResource(7, 'p'), { message: 'GetBuildingKeyForPersonResource(): Could not find quest with questID 7' });
  tree.addQuestTopicWithInfoAndRumors(7, mkPerson('p'), 'p', QUEST_INFO_RESOURCE_TYPE.Person, null, null);
  assert.throws(() => tree.getPersonResource(7, ''), { message: 'GetBuildingKeyForPersonResource(): No valid resourceName was provided.' });
  assert.throws(() => tree.getPersonResource(7, 'nope'), { message: 'GetBuildingKeyForPersonResource(): Could not find resource with resourceName nope for quest with questID 7' });
  tree.addQuestTopicWithInfoAndRumors(7, mkPlace('l'), 'l', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  assert.throws(() => tree.getPersonResource(7, 'l'), { message: 'GetBuildingKeyForPersonResource(): Resource is not of type Person but was expected to be' });
  assert.equal(tree.getPersonResource(7, 'p').symbol.name, 'p');
});

test('getPersonBuildingKey: the questor key, the name fallback, the assigned place, the misnamed null throw', () => {
  const { tree } = makeTree();
  const questor = mkPerson('q', { isQuestor: true, questorData: { buildingKey: 555, mapID: 0, context: null } });
  assert.equal(tree.getPersonBuildingKey(questor), 555);
  // key 0 falls back to the HOME BUILDING NAME lookup
  const homeless = mkPerson('q2', { isQuestor: true, questorData: { buildingKey: 0, mapID: 0, context: null }, homeBuildingName: 'The Home' });
  tree.listBuildings = [{ name: 'The Home', buildingKey: 777, buildingType: BUILDING_TYPES.House1 }];
  assert.equal(tree.getPersonBuildingKey(homeless), 777);
  tree.listBuildings = [];
  assert.equal(tree.getPersonBuildingKey(homeless), 0, 'a miss reads C#s default struct zero');
  // a non-questor with no assigned place throws the copy-pasted line
  assert.throws(() => tree.getPersonBuildingKey(mkPerson('p')), { message: 'GetBuildingKeyForPersonResource(): Resource is not of type Person but was expected to be' });
  const place = mkPlace('_site_', { buildingKey: 888 });
  const person = mkPerson('p2', {
    assignedPlaceSymbol: { name: '_site_' },
    parentQuest: mkQuest(1, [place]),
  });
  assert.equal(tree.getPersonBuildingKey(person), 888);
  assert.equal(tree.getPersonSiteDetails(person).buildingKey, 888);
  assert.throws(() => tree.getPersonSiteDetails(mkPerson('p3')), { message: 'GetBuildingKeyForPersonResource(): Resource is not of type Person but was expected to be' });
});

test('getBuildingTypeForBuildingKey: the zero and duplicate throws; the name lookup answers empty on a miss', () => {
  const { tree } = makeTree({
    getBuildingList: () => [
      { name: 'Tavern A', buildingKey: 1, buildingType: BUILDING_TYPES.Tavern },
      { name: 'Dup', buildingKey: 2, buildingType: BUILDING_TYPES.Bank },
      { name: 'Dup2', buildingKey: 2, buildingType: BUILDING_TYPES.Bank },
    ],
  });
  assert.equal(tree.getBuildingTypeForBuildingKey(1), BUILDING_TYPES.Tavern, 'the lazy list builds on first use');
  assert.throws(() => tree.getBuildingTypeForBuildingKey(9), { message: 'GetBuildingTypeForBuildingKey(): No building with the queried key found' });
  assert.throws(() => tree.getBuildingTypeForBuildingKey(2), { message: 'GetBuildingTypeForBuildingKey(): More than one building with the queried key found' });
  assert.equal(tree.getBuildingNameForBuildingKey(1), 'Tavern A');
  assert.equal(tree.getBuildingNameForBuildingKey(9), '');
  assert.equal(tree.getBuildingNameForBuildingKey(2), '', 'an ambiguous key answers empty rather than guessing');
});

test('isBuildingQuestResource: the flags, the override name, and the map/key double gate', () => {
  const place = mkPlace('_site_', { mapId: 100, buildingKey: 42, buildingName: 'The Odd House' });
  const quest = mkQuest(3, [place]);
  const { tree } = makeTree({ getQuest: () => quest, getAllActiveQuestIds: () => [3] });
  assert.equal(tree.isBuildingQuestResource(100, 42).isQuestResource, false, 'no dictQuestInfo entry: not a resource');
  tree.addQuestTopicWithInfoAndRumors(3, place, '_site_', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  let r = tree.isBuildingQuestResource(100, 42);
  assert.equal(r.isQuestResource, true);
  assert.equal(r.overrideBuildingName, 'The Odd House');
  assert.equal(r.pcLearnedAboutExistence, true, 'availableForDialog defaults true');
  assert.equal(r.receivedDirectionalHints, false);
  assert.equal(r.locationWasMarkedOnMapByNPC, false);
  assert.equal(tree.isBuildingQuestResource(101, 42).isQuestResource, false, 'a different mapId never matches');
  assert.equal(tree.isBuildingQuestResource(100, 43).isQuestResource, false, 'nor a different building key');
  const info = tree.dictQuestInfo.get(3).resourceInfo.get('_site_');
  info.questPlaceResourceHintTypeReceived = BUILDING_HINT_TYPE.LocationWasMarkedOnMap;
  info.availableForDialog = false;
  r = tree.isBuildingQuestResource(100, 42);
  assert.equal(r.pcLearnedAboutExistence, false);
  assert.equal(r.receivedDirectionalHints, true, 'the >= comparison catches the marked-on-map level too');
  assert.equal(r.locationWasMarkedOnMapByNPC, true);
});

// ---------------------------------------------------------------
// The assemblers (:3086-3500)
// ---------------------------------------------------------------

test('assembleTopiclistTellMeAbout: the two fixed heads, the quest topics, the 34 org rows', () => {
  const place = mkPlace('_l_', { buildingName: 'The Inn' });
  const noName = mkPlace('_n_', { buildingName: null, locationName: 'Tulune' });
  const empty = mkPlace('_e_', { buildingName: '', locationName: 'Tulune' });
  const person = mkPerson('_p_', { displayName: 'Lady Brisienna' });
  const item = mkItem('_i_', 'A Letter');
  const { tree } = makeTree();
  for (const [name, res, type] of [['_l_', place, 1], ['_n_', noName, 1], ['_e_', empty, 1], ['_p_', person, 2], ['_i_', item, 3]]) {
    tree.addQuestTopicWithInfoAndRumors(1, res, name, type, [tok('info')], null);
  }
  tree.assembleTopiclistTellMeAbout();
  const list = tree.listTopicTellMeAbout;
  assert.equal(list[0].questionType, QUESTION_TYPE.News);
  assert.equal(list[0].caption, EN.anyNews);
  assert.equal(list[1].questionType, QUESTION_TYPE.WhereAmI);
  assert.equal(list[1].caption, EN.whereAmI);
  const byKey = Object.fromEntries(list.filter((i) => i.key).map((i) => [i.key, i]));
  assert.equal(byKey._l_.caption, 'The Inn');
  assert.equal(byKey._l_.questionType, QUESTION_TYPE.QuestLocation);
  assert.equal(byKey._n_.caption, 'Tulune', 'a NULL buildingName falls to the location name');
  assert.equal(byKey._e_.caption, '', 'but an EMPTY one is taken as-is - C# tests null, not emptiness');
  assert.equal(byKey._p_.caption, 'Lady Brisienna');
  assert.equal(byKey._p_.questionType, QUESTION_TYPE.QuestPerson);
  assert.equal(byKey._i_.caption, 'A Letter');
  assert.equal(byKey._i_.questionType, QUESTION_TYPE.QuestItem);
  const orgs = list.filter((i) => i.questionType === QUESTION_TYPE.OrganizationInfo);
  assert.equal(orgs.length, 34);
  assert.equal(orgs[0].factionID, 42);
  assert.equal(orgs[0].index, 0, 'the index IS the row (GetOrganizationInfo reads it)');
  assert.equal(orgs[0].caption, 'faction:42');
  assert.equal(orgs.at(-1).index, 33);
});

test('the tell-me-about gates: hidden by dialog link, no answers, and the same-person partner', () => {
  const person = mkPerson('_p_', { displayName: 'Sirien' });
  const { tree } = makeTree({
    isPlayerInside: () => true,
    currentBuildingKey: () => 55,
    talkPartner: () => ({ isStatic: true, nameNPC: 'Sirien', buildingKey: 55 }),
  });
  tree.addQuestTopicWithInfoAndRumors(1, person, '_p_', QUEST_INFO_RESOURCE_TYPE.Person, [tok('a')], null);
  tree.assembleTopiclistTellMeAbout();
  assert.equal(tree.listTopicTellMeAbout.some((i) => i.key === '_p_'), false, 'you are talking TO them - the topic hides');
  const { tree: t2 } = makeTree();
  t2.addQuestTopicWithInfoAndRumors(1, person, '_p_', QUEST_INFO_RESOURCE_TYPE.Person, null, null);
  t2.assembleTopiclistTellMeAbout();
  assert.equal(t2.listTopicTellMeAbout.some((i) => i.key === '_p_'), false, 'no answers = no tell-me-about entry');
  const { tree: t3 } = makeTree();
  t3.addQuestTopicWithInfoAndRumors(1, person, '_p_', QUEST_INFO_RESOURCE_TYPE.Person, [tok('a')], null);
  t3.dialogLinkForQuestInfoResource(1, '_p_', QUEST_INFO_RESOURCE_TYPE.Person);
  assert.equal(t3.listTopicTellMeAbout.some((i) => i.key === '_p_'), false, 'the dialog link hid it');
  t3.addDialogForQuestInfoResource(1, '_p_', QUEST_INFO_RESOURCE_TYPE.Person, true);
  assert.equal(t3.listTopicTellMeAbout.some((i) => i.key === '_p_'), true, 'and addDialog brought it back');
});

test('assembleTopicListLocation: type groups in enum order, each with a Previous List head', () => {
  const { tree } = makeTree({
    getBuildingList: () => [
      { name: 'The Odd Blades', buildingKey: 1, buildingType: BUILDING_TYPES.WeaponSmith },
      { name: 'The Dented Helm', buildingKey: 2, buildingType: BUILDING_TYPES.Tavern },
      { name: 'The Salty Dog', buildingKey: 3, buildingType: BUILDING_TYPES.Tavern },
      { name: 'A House', buildingKey: 4, buildingType: BUILDING_TYPES.House1 },
    ],
  });
  tree.assembleTopicListLocation();
  const groups = tree.listTopicLocation;
  const captions = groups.map((g) => g.caption);
  assert.ok(captions.includes('Taverns') && captions.includes('Weapon smiths'));
  assert.equal(captions.includes(''), false, 'the House1 group is skipped, never added blank');
  const taverns = groups.find((g) => g.caption === 'Taverns');
  assert.equal(taverns.type, LIST_ITEM_TYPE.ItemGroup);
  assert.equal(taverns.listChildItems[0].type, LIST_ITEM_TYPE.NavigationBack);
  assert.equal(taverns.listChildItems[0].caption, EN.previousList);
  assert.equal(taverns.listChildItems[0].listParentItems, tree.listTopicLocation, 'the back item points at the parent list');
  assert.deepEqual(taverns.listChildItems.slice(1).map((i) => i.caption), ['The Dented Helm', 'The Salty Dog']);
  assert.equal(taverns.listChildItems[1].questionType, QUESTION_TYPE.LocalBuilding);
  assert.equal(taverns.listChildItems[1].buildingKey, 2);
  // the enum walk orders the groups: WeaponSmith (0) before Tavern (5)
  assert.ok(captions.indexOf('Weapon smiths') < captions.indexOf('Taverns'));
  // Regional is ALWAYS last
  assert.equal(groups.at(-1).caption, EN.regional);
});

test('assembleTopicListLocation: the quest General section, its residence gates, and the palace arm', () => {
  const house = mkPlace('_house_', { mapId: 100, buildingKey: 7, buildingName: 'The Rat House' });
  const shop = mkPlace('_shop_', { mapId: 100, buildingKey: 8, buildingName: 'A Shop' });
  const elsewhere = mkPlace('_far_', { mapId: 999, buildingKey: 9, buildingName: 'Far House' });
  const keyless = mkPlace('_key0_', { mapId: 100, buildingKey: 0, buildingName: 'No Key' });
  const { tree } = makeTree({
    getBuildingList: () => [
      { name: 'The Rat House', buildingKey: 7, buildingType: BUILDING_TYPES.House2 },
      { name: 'A Shop', buildingKey: 8, buildingType: BUILDING_TYPES.GeneralStore },
      { name: 'Far House', buildingKey: 9, buildingType: BUILDING_TYPES.House1 },
    ],
  });
  for (const [n, r] of [['_house_', house], ['_shop_', shop], ['_far_', elsewhere], ['_key0_', keyless]]) {
    tree.addQuestTopicWithInfoAndRumors(1, r, n, QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  }
  tree.assembleTopicListLocation();
  const general = tree.listTopicLocation.find((g) => g.caption === EN.general);
  assert.ok(general, 'the General group exists');
  assert.deepEqual(general.listChildItems.map((i) => i.caption), [EN.previousList, 'The Rat House'],
    'only the same-map, keyed, RESIDENCE place lands - the shop, the far house and the keyless one drop');
  assert.equal(general.listChildItems[1].key, '_house_');
  assert.equal(general.listChildItems[1].questID, 1);
  // with a palace and NO quest residence, the palace makes its own General
  const { tree: t2 } = makeTree({
    getBuildingList: () => [{ name: 'Castle Daggerfall', buildingKey: 20, buildingType: BUILDING_TYPES.Palace }],
  });
  t2.assembleTopicListLocation();
  const g2 = t2.listTopicLocation.find((g) => g.caption === EN.general);
  assert.deepEqual(g2.listChildItems.map((i) => i.caption), [EN.previousList, 'Castle Daggerfall'],
    'the palace is a General entry even though its TYPE is skipped from the groups');
  // ...and with BOTH, the palace joins the existing General group
  const { tree: t3 } = makeTree({
    getBuildingList: () => [
      { name: 'The Rat House', buildingKey: 7, buildingType: BUILDING_TYPES.House2 },
      { name: 'Castle Daggerfall', buildingKey: 20, buildingType: BUILDING_TYPES.Palace },
    ],
  });
  t3.addQuestTopicWithInfoAndRumors(1, house, '_house_', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  t3.assembleTopicListLocation();
  const generals = t3.listTopicLocation.filter((g) => g.caption === EN.general);
  assert.equal(generals.length, 1, 'ONE General group - THE SHARED GROUP VARIABLE carries the palace into it');
  assert.deepEqual(generals[0].listChildItems.map((i) => i.caption), [EN.previousList, 'The Rat House', 'Castle Daggerfall']);
});

test('the regional group: knightly orders gate on region, stores search by TYPE, temples by FACTION', () => {
  // nothing local: every non-order row lands, orders only for region 5
  const { tree } = makeTree({ currentRegionIndex: () => 0x05, exteriorBuildings: () => [] });
  tree.assembleTopicListLocation();
  const regional = tree.listTopicLocation.at(-1);
  const captions = regional.listChildItems.slice(1).map((i) => i.caption);
  assert.equal(regional.listChildItems[0].type, LIST_ITEM_TYPE.NavigationBack);
  assert.ok(captions.includes('Any Temple of Akatosh'));
  assert.ok(captions.includes('Any Order of the Raven'), 'region 5 IS the Raven region (row 8)');
  assert.equal(captions.filter((c) => c.startsWith('Any Knights') || c.startsWith('Any Order') || c.startsWith('Any Host')).length, 1,
    'the other nine orders are out of region');
  assert.ok(captions.includes('Any Tavern'));
  assert.equal(regional.listChildItems[1].questionType, QUESTION_TYPE.Regional);
  assert.equal(regional.listChildItems[1].index, 0, 'the index IS the FactionsAndBuildings row');
  // a LOCAL tavern (by type) and a LOCAL Akatosh temple (by faction) drop out
  const { tree: t2 } = makeTree({
    currentRegionIndex: () => 0,
    exteriorBuildings: () => [{ factionId: 0x1a, buildingType: 99 }, { factionId: 0, buildingType: 0x0f }],
  });
  t2.assembleTopicListLocation();
  const c2 = t2.listTopicLocation.at(-1).listChildItems.slice(1).map((i) => i.caption);
  assert.equal(c2.includes('Any Temple of Akatosh'), false, 'the local temple faction removes its regional row');
  assert.equal(c2.includes('Any Tavern'), false, 'and the local tavern TYPE removes its row');
  assert.ok(c2.includes('Any Library'), 'a store type with no local building stays');
  // an unloaded location (null rows) keeps everything
  const { tree: t3 } = makeTree({ currentRegionIndex: () => 0, exteriorBuildings: () => null });
  t3.assembleTopicListLocation();
  assert.ok(t3.listTopicLocation.at(-1).listChildItems.length > 20);
  assert.throws(() => tree.addRegionalBuildingTalkItem(99, regional), { message: 'buildingNames array text not found or idex out of range.' });
});

test('assembleTopicListPerson: the questor mapID gate, the assigned-place gate, and Thing stays empty', () => {
  const questorHere = mkPerson('_q1_', { isQuestor: true, displayName: 'Here', questorData: { mapID: 100, buildingKey: 0, context: null } });
  const questorAway = mkPerson('_q2_', { isQuestor: true, displayName: 'Away', questorData: { mapID: 999, buildingKey: 0, context: null } });
  const place = mkPlace('_site_', { mapId: 100 });
  const placed = mkPerson('_p1_', { displayName: 'Placed', assignedPlaceSymbol: { name: '_site_' } });
  const unplaced = mkPerson('_p2_', { displayName: 'Unplaced' });
  const quest = mkQuest(1, [place]);
  const { tree } = makeTree({ getQuest: () => quest });
  for (const [n, r] of [['_q1_', questorHere], ['_q2_', questorAway], ['_p1_', placed], ['_p2_', unplaced]]) {
    tree.addQuestTopicWithInfoAndRumors(1, r, n, QUEST_INFO_RESOURCE_TYPE.Person, null, null);
  }
  tree.assembleTopicListPerson();
  assert.deepEqual(tree.listTopicPerson.map((i) => i.caption), ['Here', 'Placed'],
    'only the questor in this map cell and the person assigned to a local place');
  assert.equal(tree.listTopicPerson[0].questionType, QUESTION_TYPE.Person);
  assert.equal(tree.listTopicPerson[0].key, '_q1_');
  tree.assembleTopicListThing();
  assert.deepEqual(tree.listTopicThing, [], 'the Thing list is always empty - classic never implemented it');
});

test('assembleTopicLists: the full pass vs the instant pass with its flags', () => {
  const { tree, calls } = makeTree();
  tree.assembleTopicLists();
  assert.equal(tree.listTopicTellMeAbout.length > 0, true);
  assert.equal(calls.filter((c) => c[0] === 'listsUpdated').length, 0, 'the full pass does NOT refresh the window');
  tree.listTopicTellMeAbout = ['STALE'];
  tree.listTopicPerson = ['STALE'];
  tree.instantRebuildTopicListPerson = true;
  tree.assembleTopicLists(true);
  assert.deepEqual(tree.listTopicTellMeAbout, ['STALE'], 'an unflagged list is left alone');
  assert.deepEqual(tree.listTopicPerson, [], 'the flagged one rebuilt');
  assert.equal(calls.filter((c) => c[0] === 'listsUpdated').length, 1, 'and the instant pass refreshes the window');
  assert.equal(tree.instantRebuildTopicListPerson, false);
  // forceTopicListsUpdate is the full pass
  tree.listTopicPerson = ['STALE'];
  tree.forceTopicListsUpdate();
  assert.deepEqual(tree.listTopicPerson, []);
});

// ---------------------------------------------------------------
// The knowledge gates (:2963-3083)
// ---------------------------------------------------------------

test('resetNPCKnowledgeInTopicListRecursively walks into item groups', () => {
  const { tree } = makeTree();
  const child = newListItem({ npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem, npcInSameBuildingAsTopic: true });
  const group = newListItem({ type: LIST_ITEM_TYPE.ItemGroup, listChildItems: [child], npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem });
  const flat = newListItem({ npcKnowledgeAboutItem: NPC_KNOWLEDGE.DoesNotKnowAboutItem });
  tree.resetNPCKnowledgeInTopicListRecursively([group, flat]);
  assert.equal(child.npcKnowledgeAboutItem, NPC_KNOWLEDGE.NotSet);
  assert.equal(child.npcInSameBuildingAsTopic, false);
  assert.equal(group.npcKnowledgeAboutItem, NPC_KNOWLEDGE.NotSet);
  assert.equal(flat.npcKnowledgeAboutItem, NPC_KNOWLEDGE.NotSet);
  assert.doesNotThrow(() => tree.resetNPCKnowledgeInTopicListRecursively(null));
});

test('checkNPCcanKnowAboutTellMeAboutTopic: the region gates, with the -1 home index bypass', () => {
  const place = mkPlace('_l_', { regionName: 'Daggerfall' });
  const far = mkPlace('_f_', { regionName: 'Wayrest' });
  const person = mkPerson('_p_', { homeRegionName: 'Wayrest', homeRegionIndex: 20 });
  const homeless = mkPerson('_h_', { homeRegionName: 'BLANK', homeRegionIndex: -1 });
  const quest = mkQuest(1, [place, far, person, homeless]);
  const { tree } = makeTree({ getQuest: () => quest });
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic(newListItem({ questionType: QUESTION_TYPE.QuestLocation, key: '_l_' })), true);
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic(newListItem({ questionType: QUESTION_TYPE.QuestLocation, key: '_f_' })), false);
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic(newListItem({ questionType: QUESTION_TYPE.QuestPerson, key: '_p_' })), false);
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic(newListItem({ questionType: QUESTION_TYPE.QuestPerson, key: '_h_' })), true,
    'a homeless person (index -1) is knowable anywhere');
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic(newListItem({ questionType: QUESTION_TYPE.News })), true, 'other question types always pass');
});

test('checkNPCisInSameBuildingAsTopic: the outside bail, the local-building compare, the place walk', () => {
  const { tree: outside } = makeTree({ isPlayerInside: () => false });
  assert.equal(outside.checkNPCisInSameBuildingAsTopic(newListItem({ questionType: QUESTION_TYPE.LocalBuilding, buildingKey: 1 })), false);
  const buildings = [{ name: 'The Inn', buildingKey: 55, buildingType: BUILDING_TYPES.Tavern }];
  const { tree } = makeTree({
    isPlayerInside: () => true, isPlayerInsideBuilding: () => true,
    currentBuildingKey: () => 55, getBuildingList: () => buildings,
  });
  tree.getBuildingList();
  assert.equal(tree.checkNPCisInSameBuildingAsTopic(newListItem({ questionType: QUESTION_TYPE.News })), false, 'the wrong question type bails');
  const here = newListItem({ questionType: QUESTION_TYPE.LocalBuilding, buildingKey: 55 });
  assert.equal(tree.checkNPCisInSameBuildingAsTopic(here), true);
  assert.equal(here.npcInSameBuildingAsTopic, true, 'the item is STAMPED, not just answered');
  assert.equal(tree.checkNPCisInSameBuildingAsTopic(newListItem({ questionType: QUESTION_TYPE.LocalBuilding, buildingKey: 56 })), false);
  // a quest person whose place is this very building
  const place = mkPlace('_site_', { buildingKey: 55, locationName: 'Daggerfall', regionName: 'Daggerfall' });
  const person = mkPerson('_p_', { assignedPlaceSymbol: { name: '_site_' } });
  const quest = mkQuest(1, [place, person]);
  const { tree: t2 } = makeTree({
    isPlayerInside: () => true, isPlayerInsideBuilding: () => true,
    currentBuildingKey: () => 55, getBuildingList: () => buildings, getQuest: () => quest,
  });
  t2.getBuildingList();
  assert.equal(t2.checkNPCisInSameBuildingAsTopic(newListItem({ questionType: QUESTION_TYPE.QuestPerson, key: '_p_', questID: 1 })), true);
  // a person with NO place at all (The Underking) answers false
  const nowhere = mkPerson('_u_');
  const q3 = mkQuest(1, [nowhere]);
  const { tree: t3 } = makeTree({
    isPlayerInside: () => true, isPlayerInsideBuilding: () => true,
    currentBuildingKey: () => 55, getBuildingList: () => buildings, getQuest: () => q3,
  });
  t3.getBuildingList();
  assert.equal(t3.checkNPCisInSameBuildingAsTopic(newListItem({ questionType: QUESTION_TYPE.QuestPerson, key: '_u_', questID: 1 })), false);
  // a palace place (buildingKey 0) compares by NAME instead
  const palacePlace = mkPlace('_pal_', { buildingKey: 0, buildingName: 'Castle Daggerfall', locationName: 'Daggerfall', regionName: 'Daggerfall' });
  const royal = mkPerson('_r_', { assignedPlaceSymbol: { name: '_pal_' } });
  const q4 = mkQuest(1, [palacePlace, royal]);
  const { tree: t4 } = makeTree({
    isPlayerInside: () => true, isPlayerInsideBuilding: () => false,
    getBuildingList: () => [{ name: 'Castle Daggerfall', buildingKey: 20, buildingType: BUILDING_TYPES.Palace }],
    getQuest: () => q4,
  });
  t4.getBuildingList();
  assert.equal(t4.checkNPCisInSameBuildingAsTopic(newListItem({ questionType: QUESTION_TYPE.QuestPerson, key: '_r_', questID: 1 })), true,
    'the castle resolves by building TYPE, then the place compares by NAME');
});

// ---------------------------------------------------------------
// The conversation-save halves (:2426-2549)
// ---------------------------------------------------------------

test('the save halves round-trip as a fixed point, with the orphan sweep and the three-type relink', () => {
  const place = mkPlace('_l_', { buildingName: 'The Inn' });
  const person = mkPerson('_p_');
  const item = mkItem('_i_', 'A Letter');
  const quest = mkQuest(1, [place, person, item]);
  const { tree } = makeTree({ getQuest: (id) => (id === 1 ? quest : null) });
  tree.addQuestTopicWithInfoAndRumors(1, place, '_l_', QUEST_INFO_RESOURCE_TYPE.Location, [tok('info')], null);
  tree.addQuestTopicWithInfoAndRumors(1, person, '_p_', QUEST_INFO_RESOURCE_TYPE.Person, null, [tok('rumor')]);
  tree.addQuestTopicWithInfoAndRumors(1, item, '_i_', QUEST_INFO_RESOURCE_TYPE.Thing, [tok('info')], null);
  tree.dialogLinkForQuestInfoResource(1, '_l_', QUEST_INFO_RESOURCE_TYPE.Location, '_p_', QUEST_INFO_RESOURCE_TYPE.Person);
  tree.addQuestTopicWithInfoAndRumors(2, mkPlace('_gone_'), '_gone_', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  const snap = tree.getSaveData();
  assert.equal(snap.dictQuestInfo.length, 2);
  assert.equal(snap.dictQuestInfo[0].resourceInfo[0].questResource, undefined, 'the live reference never travels (C# relinks it anyway)');

  const { tree: fresh } = makeTree({ getQuest: (id) => (id === 1 ? quest : null) });
  fresh.restoreSaveData(structuredClone(snap));
  assert.deepEqual([...fresh.dictQuestInfo.keys()], [1], 'quest 2 is orphaned and swept');
  const l = fresh.dictQuestInfo.get(1).resourceInfo.get('_l_');
  assert.equal(l.questResource, place, 'the Place relinked to the LIVE object');
  assert.equal(fresh.dictQuestInfo.get(1).resourceInfo.get('_p_').questResource, person, 'the Person relinked');
  assert.equal(fresh.dictQuestInfo.get(1).resourceInfo.get('_i_').questResource, item, 'the Item relinked');
  assert.deepEqual(l.dialogLinkedPersons, ['_p_'], 'the links survived');
  assert.equal(l.availableForDialog, false, 'and so did the hide');
  assert.equal(fresh.listTopicTellMeAbout[0].questionType, QUESTION_TYPE.News, 'the restore tail rebuilt the tell-me-about list');
  // the snapshot of the RESTORED tree matches the original's, minus
  // the swept orphan
  const expected = { dictQuestInfo: snap.dictQuestInfo.filter((r) => r.questID === 1) };
  assert.deepEqual(fresh.getSaveData(), expected, 'restore(save) is a fixed point over the surviving quests');
  // detachment
  fresh.dictQuestInfo.get(1).resourceInfo.get('_l_').dialogLinkedPersons.push('MUTANT');
  assert.deepEqual(tree.dictQuestInfo.get(1).resourceInfo.get('_l_').dialogLinkedPersons, ['_p_']);
  // restore(null) empties and still rebuilds
  const { tree: t2 } = makeTree();
  t2.restoreSaveData(null);
  assert.equal(t2.dictQuestInfo.size, 0);
  assert.equal(t2.listTopicTellMeAbout.length, 36, 'two heads + 34 orgs');
});
