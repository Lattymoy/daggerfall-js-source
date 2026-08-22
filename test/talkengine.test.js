// TK-v - THE TALK ENGINE MOUNTED. The four modules of the arc wired
// to each other exactly as world.js wires them, and driven end to
// end: a click chooses the NPC, the greeting decides whether the
// window opens, the tone gate recomputes on a change and not
// otherwise, the topic tree answers, the mill supplies the news, and
// the one-answer gate closes on the session the click reset.
//
// The browser half of TK-v is probe-verified only where a machine
// with game data exists (this one has none - the quest arc's standing
// caveat). What CAN be held still here is the wiring itself: that the
// four talk to each other, and that the laws each slice fixed survive
// being assembled.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NPCSession, newNPCData } from '../src/systems/npcSession.js';
import { AnswerPipeline, TALK_STRINGS } from '../src/systems/answerPipeline.js';
import { TopicTree, QUESTION_TYPE, newListItem, NPC_KNOWLEDGE } from '../src/systems/topicTree.js';
import { RumorMill, RUMOR_TYPE } from '../src/systems/rumorMill.js';
import { LIST_ITEM_TYPE } from '../src/systems/topicTree.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { readFileSync } from 'node:fs';

const EN_REGIONAL = 'Regional';

const faction = (over = {}) => ({
  id: 0, parent: 0, type: 0, rep: 0, sgroup: 0, ggroup: 0, name: '',
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ...over,
});

/** world.js's mount, in miniature: the same four constructions, the
 *  same cross-wiring, over fixture seams instead of the running
 *  world. */
function mount(over = {}) {
  const records = [];
  const table = over.table ?? { 100: faction({ id: 100, name: 'People of Daggerfall' }) };
  let tone = 1;
  const tiers = [];

  const mill = new RumorMill({
    nowClassicMinutes: () => 0,
    getFactionData: (id) => table[id] ?? null,
    currentRegionIndex: () => 17,
    expandRandomTextRecord: (id) => `record:${id}`,
    rolls: () => 0.5,
  });
  const tree = new TopicTree({
    getQuest: () => null,
    getBuildingList: () => over.buildings ?? [],
    currentRegionIndex: () => 17,
    isPlayerInside: () => false,
  });
  const session = new NPCSession({
    factionData: (id) => table[id] ?? null,
    peopleOfCurrentRegion: () => 100,
    courtOfCurrentRegion: () => 0,
    reactionToPlayer: () => over.reaction ?? 0,
    sgroupReputation: () => 1000,          // the greeting roll cannot lose
    expandRandomTextRecord: (id) => { records.push(id); return `record:${id}`; },
    randomTokens: (id) => [{ text: `tokens:${id}` }],
    messageBox: () => {},
    pushTalkWindow: () => {},
    assembleTopicListPerson: () => tree.assembleTopicListPerson(),
    assembleTopicLists: () => tree.assembleTopicLists(),
    needsTopicListRebuild: () => tree.rebuildTopicLists,
    clearTopicListRebuild: () => { tree.rebuildTopicLists = false; },
    raiseTopicListRebuild: () => { tree.rebuildTopicLists = true; },
    getBuildingList: () => tree.getBuildingList(),
    resetNPCKnowledge: () => tree.resetNPCKnowledge(),
    resetToneSession: () => pipeline.resetToneSession(),
    resetQuestionSession: () => pipeline.startNewConversation(),
    clearQuestInfo: () => tree.dictQuestInfo.clear(),
    clearRumorMill: () => { mill.listRumorMill.length = 0; },
    rolls: () => 0.9,
    ...(over.session ?? {}),
  });
  const pipeline = new AnswerPipeline({
    tree,
    npcSession: () => session.npcData,
    localizedText: (k) => TALK_STRINGS[k] ?? '',
    expandRandomTextRecord: (id) => { records.push(id); return `record:${id}`; },
    getNewsOrRumors: (s) => mill.getNewsOrRumors(s),
    isPlayerInside: () => false,
    currentLocationName: () => 'Daggerfall',
    currentRegionName: () => 'Daggerfall',
    toneIndex: () => tone,
    reactionTier: (questionType, socialGroup) => { tiers.push([questionType, socialGroup]); return 2; },
    rolls: () => 0.9,
  });
  return {
    mill, tree, session, pipeline, records, tiers,
    setTone: (t) => { tone = t; },
  };
}

test('the mount: a mobile click chooses the NPC, opens the window, and starts a clean session', () => {
  const m = mount();
  const out = m.session.talkToMobileNPC({ nameNPC: 'A Passerby' });
  assert.equal(out.kind, 'talk', 'the window road is open');
  assert.equal(m.session.npcData.factionData.id, 100, 'and the region PEOPLE speak for the mobile');
  // TalkToNpc's session reset reached BOTH halves through the mount
  assert.deepEqual(m.session.toneReactionForTalkSession, [0, 0, 0]);
  assert.equal(m.pipeline.lastToneIndex, -1, 'the pipeline half, through the seam');
  // StartNewConversation reaches the pipeline's counter AND the tree
  m.pipeline.numQuestionsAsked = 5;
  m.tree.rebuildTopicLists = true;
  m.session.startNewConversation();
  assert.equal(m.pipeline.numQuestionsAsked, 0, 'the counter is the pipelines, reset from the session');
  assert.equal(m.tree.rebuildTopicLists, false, 'and the deferred rebuild is spent, not shadowed');
});

test('the mount: THE TONE GATE recomputes on a CHANGE and not otherwise, through the assembled seams', () => {
  const m = mount();
  m.session.talkToMobileNPC({ nameNPC: 'A' });
  const ask = () => m.pipeline.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News }));
  ask();
  assert.equal(m.tiers.length, 1, 'the first question computes');
  assert.equal(m.pipeline.reactionToPlayer012, 2, 'and the tier lands on the pipeline');
  ask();
  assert.equal(m.tiers.length, 1, 'the same tone does NOT recompute');
  m.setTone(0);
  ask();
  assert.equal(m.tiers.length, 2, 'a changed tone does');
  assert.deepEqual(m.tiers[1], [QUESTION_TYPE.News, 0], 'the question type and the social group ride it');
  // a NEW click resets the gate, so the next question recomputes
  m.session.talkToMobileNPC({ nameNPC: 'B' });
  ask();
  assert.equal(m.tiers.length, 3, 'a new conversation always recomputes');
});

test('the mount: the mill answers the News arm through the session the click reset', () => {
  const m = mount();
  m.mill.listRumorMill.push({
    rumorType: RUMOR_TYPE.CommonRumor, listRumorVariants: [[{ text: 'word' }]],
    regionID: -1, faction1: 0, faction2: 0, timeLimit: 1e9, flags: 0, npcID: 0, textID: 0, questID: 0,
  });
  m.session.talkToMobileNPC({ nameNPC: 'A' });
  const news = () => m.pipeline.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News }));
  assert.equal(news(), 'word', 'the mill supplies the news');
  assert.equal(m.session.npcData.numAnswersGivenTellMeAboutOrRumors, 1,
    'and it spends the answer on the SESSION the click chose - not a literal of its own');
  assert.equal(news(), 'record:1457', 'so the second ask runs dry');
  // ...and a NEW NPC is owed one again
  m.session.talkToMobileNPC({ nameNPC: 'B' });
  assert.equal(news(), 'word', 'one correct answer per talk session, as in classic');
});

test('the mount: the tree answers a where-is, and the knowledge is FORGOTTEN for a new NPC only', () => {
  const buildings = [{ name: 'The Inn', buildingKey: 55, buildingType: 15 }];
  const m = mount({ buildings });
  m.tree.listTopicLocation = [newListItem({
    questionType: QUESTION_TYPE.LocalBuilding, caption: 'The Inn', buildingKey: 55,
    npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem,
  })];
  m.session.talkToMobileNPC({ nameNPC: 'A' });
  assert.equal(m.tree.listTopicLocation[0].npcKnowledgeAboutItem, NPC_KNOWLEDGE.NotSet,
    'a NEW target forgets what the last NPC knew - ResetNPCKnowledge, through the mount');
  assert.equal(m.tree.rebuildTopicLists, true, 'and asks for a rebuild');
  // the same NPC again keeps it
  m.tree.listTopicLocation[0].npcKnowledgeAboutItem = NPC_KNOWLEDGE.KnowsAboutItem;
  const same = { nameNPC: 'A' };
  m.session.talkToMobileNPC(same);
  m.session.talkToMobileNPC(same);
  assert.equal(m.tree.listTopicLocation[0].npcKnowledgeAboutItem, NPC_KNOWLEDGE.NotSet,
    'the first of those two was still a new target');
});

test('the mount: the questor door and the conversation envelope survive assembly', () => {
  const m = mount();
  m.session.npcsWithWork.set(77, { npc: { nameSeed: 77 }, socialGroup: 1, buildingName: 'The Inn' });
  const out = m.session.talkToStaticNPC({ data: { nameSeed: 77, factionID: 0 } });
  assert.equal(out.kind, 'questOffer', 'the door opens before the conversation');
  // the whole envelope, from all three owners
  const envelope = { ...m.mill.getSaveData(), ...m.tree.getSaveData(), ...m.session.getSaveData() };
  assert.ok('listRumorMill' in envelope, 'the mill half');
  assert.ok('dictQuestInfo' in envelope, 'the tree half');
  assert.ok('npcsWithWork' in envelope && 'castleNPCsSpokenTo' in envelope, 'and the session half');
  const m2 = mount();
  m2.mill.restoreSaveData(envelope);
  m2.tree.restoreSaveData(envelope);
  m2.session.restoreSaveData(envelope);
  assert.equal(m2.session.npcsWithWork.get(77)?.buildingName, 'The Inn', 'one envelope, three readers');
});

test('the mount: the event handlers reach the tree and the mill', () => {
  const m = mount({ buildings: [{ name: 'The Inn', buildingKey: 55, buildingType: 15 }] });
  m.tree.rebuildTopicLists = false;
  m.tree.listBuildings = null;
  m.session.onWorldChanged();
  assert.equal(m.tree.rebuildTopicLists, true, 'the rebuild is asked for');
  assert.equal(m.tree.listBuildings.length, 1, 'and the building list refreshed NOW');
  m.mill.listRumorMill.push({ rumorType: RUMOR_TYPE.CommonRumor, listRumorVariants: [[{ text: 'x' }]] });
  m.tree.dictQuestInfo.set(1n, { resourceInfo: new Map() });
  m.session.onStartGame();
  assert.equal(m.mill.listRumorMill.length, 0, 'a new game inherits no rumors');
  assert.equal(m.tree.dictQuestInfo.size, 0, 'and no quest topics');
});

test('TK-vi: the window\'s Where-is page is the TREE\'s list, and its rows answer through the pipeline', () => {
  // DaggerfallTalkWindow's location page IS listTopicLocation
  // (AssembleTopicListLocation :3200-3353). The port's window drew the
  // T3c directory's flat categories instead, which is not that list:
  // the types walk in ENUM order behind the skip list, each group opens
  // with a NavigationBack row, and a Regional group is appended ALWAYS.
  const buildings = [
    { name: 'The Odd Blades', buildingKey: 11, buildingType: BUILDING_TYPES.WeaponSmith },
    { name: 'The Grey Mare', buildingKey: 12, buildingType: BUILDING_TYPES.Tavern },
    { name: 'The Dusty Flask', buildingKey: 13, buildingType: BUILDING_TYPES.Alchemist },
    { name: 'Someone\'s House', buildingKey: 14, buildingType: BUILDING_TYPES.House1 },
  ];
  const m = mount({ buildings });
  m.session.talkToMobileNPC({ nameNPC: 'A Passerby' });
  m.session.startNewConversation();          // spends the rebuild flag
  const groups = m.tree.listTopicLocation;
  assert.ok(groups.length >= 4, 'three named types plus Regional');
  // ENUM ORDER, not the T3c category order: Alchemist(0) before
  // WeaponSmith(13) before Tavern(15).
  const captions = groups.map((g) => g.caption);
  assert.ok(captions.indexOf('Alchemists') < captions.indexOf('Weapon smiths'), captions.join('|'));
  assert.ok(captions.indexOf('Weapon smiths') < captions.indexOf('Taverns'), captions.join('|'));
  // House1 is in the SKIP LIST - it never appears as a group
  assert.equal(captions.some((c) => /house/i.test(c)), false, 'residences are skipped');
  // ...and the Regional group is last, always
  assert.equal(captions[captions.length - 1], EN_REGIONAL);
  // every group opens with the NavigationBack row - which the window
  // drops, because its own back button is that row
  for (const g of groups) {
    assert.equal(g.listChildItems[0].type, LIST_ITEM_TYPE.NavigationBack, `${g.caption} opens with Back`);
  }
  // a row answers through the PIPELINE, on the ListItem - so the tone
  // gate, %hnt's fork and %loc's map mark all run where C# runs them
  const smiths = groups.find((g) => g.caption === 'Weapon smiths');
  const row = smiths.listChildItems[1];
  assert.equal(row.questionType, QUESTION_TYPE.LocalBuilding);
  assert.equal(row.caption, 'The Odd Blades');
  assert.equal(row.buildingKey, 11);
  m.pipeline.getQuestionText(row, 1);
  assert.equal(m.pipeline.currentKeySubject, 'The Odd Blades', 'the question latched the key subject');
  assert.equal(m.pipeline.currentKeySubjectType, 'Building');
  assert.equal(m.pipeline.currentKeySubjectBuildingKey, 11, '...and the key the map mark reads');
  const answer = m.pipeline.getAnswerText(row, { npcSeed: 7 });
  assert.ok(answer.startsWith('record:'), answer);
});

test('TK-vi: the host builds the window rows off the tree, and keeps the T3c list only as the fallback', () => {
  const src = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(src, /categories: \(\) => treeCategories\(\) \?\? localCategories\(\)/);
  assert.match(src, /child\.type !== LIST_ITEM_TYPE\.NavigationBack/, 'the Back row is dropped');
  assert.match(src, /eng\.pipeline\.getAnswerText\(row\.listItem/, 'the answer is the pipeline\'s');
  assert.match(src, /eng\.pipeline\.getQuestionText\(row\.listItem, tone\)/, 'and so is the question');
  // the fallback survives for a host with no engine (no game data)
  assert.match(src, /function localCategories\(\)/);
});
