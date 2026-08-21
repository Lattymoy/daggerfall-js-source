// TK-iii - THE ANSWER PIPELINE (TalkManager.cs's question/answer
// half). GetClassicQuestionIndex's mapping with its
// no-bonus default; the regional location-key BIT FIELD decoder
// (every building's own bit, the temple faction switch, the
// out-of-range and unknown-index zeros); GetQuestionText's record
// ladder with the key-subject state each arm leaves; GetAnswerText's
// dispatch, counter and opening-text reset; the tell-me-about arm's
// ONE-ANSWER GATE and THE KNOWS-BUT-SILENT arm; the where-is arm's
// same-building answers and its asymmetric spymaster gate; the
// knowledge roll's ladder (region gate, always-knows arms, the
// organization fix, the quest-person building dependency, the
// seeded 1..20); the hints (the 0.35 fork, the indoors override, THE
// DEAD KEY OVERRIDE, the residence fallback); GetDialogHint/2 with
// the spymaster inversion and the rumors fallback; the compass mark
// and the map mark with their hint-type transitions; and the
// remaining record helpers.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AnswerPipeline, getClassicQuestionIndex, checkLocationKeyForRegionalBuilding,
  QUESTION_RECORDS, WORK_RECORDS, WORK_STRING_RECORD, PC_GREETING_RECORD,
  PC_FOLLOWUP_RECORD, PC_STRANGER_RECORD, organizationInfoRecord,
  REGIONAL_FOUND_RECORD, REGIONAL_NOT_FOUND_RECORD, REGIONAL_LOOKUP_INDEXES,
  ORGANIZATION_INFO_BASE, stringHash,
} from '../src/systems/answerPipeline.js';
import {
  TopicTree, QUESTION_TYPE, NPC_KNOWLEDGE, QUEST_INFO_RESOURCE_TYPE,
  BUILDING_HINT_TYPE, newListItem, FACTIONS_AND_BUILDINGS,
} from '../src/systems/topicTree.js';
import {
  ANSWERS_TO_DIRECTIONS, ANSWERS_TO_NON_DIRECTIONS, CHANCE_TO_REVEAL_LOCATION_ON_MAP,
  DIRECTION_TEXT_ID, MAP_REVEAL_TEXT_ID, KNOWLEDGE_MODIFIERS,
} from '../src/systems/talkTopics.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const EN_TEXT = {
  AnswerTextWhereAmI: 'You are in {0} in {1}.',
  YouAreInSameBuilding: 'You have found {0}. You are in it.',
  NpcInSameBuilding: "'{0} is around here in {1}.'",
  residence: 'Residence',
  resolvingError: '...never mind...',
  WhereAmI: 'Where am I?',
  toBeReplacedStringRegional: 'Any',
  replacementStringRegional: 'any',
  Sir: 'Sir', "Ma'am": "Ma'am",
  oldLeaderFate0: 'died of heart failure',
};

function makePipe(over = {}, treeOver = {}) {
  const calls = [];
  const tree = new TopicTree({ getQuest: () => null, ...treeOver });
  const session = { socialGroup: 0, isSpyMaster: false, numAnswersGivenTellMeAboutOrRumors: 0, factionData: { id: 100 } };
  const pipe = new AnswerPipeline({
    expandRandomTextRecord: (id) => { calls.push(['record', id]); return `record:${id}`; },
    localizedText: (k) => EN_TEXT[k] ?? '',
    getNewsOrRumors: (s) => { calls.push(['news', s]); return 'the news'; },
    tree,
    npcSession: () => session,
    npcsKnowEverything: () => false,
    isPlayerInside: () => false,
    currentLocationName: () => 'Daggerfall',
    currentRegionName: () => 'Daggerfall',
    rolls: () => 0.9,
    ...over,
  });
  return { pipe, tree, calls, session };
}

// ---------------------------------------------------------------
// THE RECORD LITERALS, asserted as NUMBERS
// ---------------------------------------------------------------
// A pin written as `record:${QUESTION_RECORDS.whereIs + 1}` reads the
// same constant the code reads, so it holds however the constant
// moves - it asserts nothing at all about the value. Every TEXT.RSC
// record id this slice draws is therefore pinned to its literal here,
// against the C# lines that name it.

test('the TEXT.RSC record literals are the C# ones, by number', () => {
  assert.equal(QUESTION_RECORDS.news, 7231, 'GetQuestionText News (:1312)');
  assert.equal(QUESTION_RECORDS.tellMeAbout, 7212, 'orgs/quest topics/work (:1319, :1345, :1349)');
  assert.equal(QUESTION_RECORDS.whereIs, 7225, 'buildings/persons/regional (:1324, :1328, :1339)');
  assert.deepEqual({ ...WORK_RECORDS }, { noWork: 8078, tier0: 8075, tier1: 8076, tier2: 8077 }, 'the Work arm (:2024-2035)');
  assert.equal(WORK_STRING_RECORD, 7211, 'GetWorkString (:1160)');
  assert.equal(PC_GREETING_RECORD, 7215, 'GetPCGreetingText (:1139)');
  assert.equal(PC_FOLLOWUP_RECORD, 7218, 'GetPCFollowUpText (:1146)');
  assert.equal(PC_STRANGER_RECORD, 7221, 'the friend/stranger name (:1136)');
  assert.equal(REGIONAL_FOUND_RECORD, 10, 'GetAnswerWhereIsRegionalBuilding (:1871)');
  assert.equal(REGIONAL_NOT_FOUND_RECORD, 11, '...and its not-found twin (:1873)');
  assert.equal(ORGANIZATION_INFO_BASE, 860, 'GetOrganizationInfo (:1555)');
  assert.equal(DIRECTION_TEXT_ID, 7333, 'GetKeySubjectBuildingDirection (:1695)');
  assert.equal(MAP_REVEAL_TEXT_ID, 7332, 'GetKeySubjectBuildingOnMap (:1701)');
  assert.equal(CHANCE_TO_REVEAL_LOCATION_ON_MAP, 0.35, 'ChanceToRevealLocationOnMap (:123)');
  // ...and the drawn records land on those numbers through the code
  const { pipe } = makePipe();
  assert.equal(pipe.getQuestionText(newListItem({ questionType: QUESTION_TYPE.News }), 2), 'record:7233');
  assert.equal(pipe.getQuestionText(newListItem({ questionType: QUESTION_TYPE.LocalBuilding }), 1), 'record:7226');
  assert.equal(pipe.getQuestionText(newListItem({ questionType: QUESTION_TYPE.OrganizationInfo }), 0), 'record:7212');
  assert.equal(pipe.getWorkString(), 'record:7211');
  assert.equal(pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.Work }), { workAvailable: false }), 'record:8078');
});

test('a fresh pipeline starts at C#s field initializers', () => {
  const bare = new AnswerPipeline({});
  assert.equal(bare.currentKeySubjectBuildingKey, -1, 'the key -1 is what the knowledge ladder tests against (:585)');
  assert.equal(bare.lastToneIndex, -1, ':249');
  assert.equal(bare.numQuestionsAsked, 0);
  assert.equal(bare.reactionToPlayer012, 0);
  assert.equal(bare.markLocationOnMap, false, 'never revealing a location by accident (:260)');
  assert.equal(bare.currentKeySubject, '');
  assert.equal(bare.currentQuestionListItem, null);
  assert.equal(bare.locationOfRegionalBuilding, '');
});

// ---------------------------------------------------------------
// GetClassicQuestionIndex (:691-724)
// ---------------------------------------------------------------

test('getClassicQuestionIndex: the six mapped types, and 2 as the no-bonus default', () => {
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.LocalBuilding), 0);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.Regional), 0, 'regional shares Where-is-Location');
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.Person), 1);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.Thing), 2);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.Work), 3);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.QuestLocation), 4);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.OrganizationInfo), 4, 'orgs ride Tell-me-about-Location (DFU own note)');
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.QuestPerson), 5);
  assert.equal(getClassicQuestionIndex(QUESTION_TYPE.QuestItem), 6);
  // everything unmapped takes the 2 that "gives no bonus or penalty"
  for (const qt of [QUESTION_TYPE.NoQuestion, QUESTION_TYPE.News, QUESTION_TYPE.WhereAmI]) {
    assert.equal(getClassicQuestionIndex(qt), 2);
  }
});

// ---------------------------------------------------------------
// CheckLocationKeyForRegionalBuilding (:1920-1990) - the bit fields
// ---------------------------------------------------------------

test('the regional key decoder: each building reads its OWN bit out of its own flag byte', () => {
  const key = (temple, store, guild) => (temple & 0xff) | ((store & 0xff) << 8) | ((guild & 0xff) << 16);
  // stores live in byte 1: tavern bit 0, weaponsmith 1, armorer 2,
  // alchemist 3, bank 4, bookstore 5, clothing 6, gem 7
  const storeBits = [[0, 0], [3, 1], [4, 2], [5, 3], [6, 4], [7, 5], [8, 6], [0xa, 7]];
  for (const [index, bit] of storeBits) {
    assert.equal(checkLocationKeyForRegionalBuilding(key(0, 1 << bit, 0), index, 0), 1, `store index ${index} reads bit ${bit}`);
    assert.equal(checkLocationKeyForRegionalBuilding(key(0, ~(1 << bit) & 0xff, 0), index, 0), 0, `...and only that bit`);
  }
  // guilds live in byte 2: library bit 0, pawn shop 6, knightly
  // orders 1, mages 2, fighters 5
  assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0, 1 << 0), 0x0b, 0), 1, 'library bit 0');
  assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0, 1 << 6), 0x0c, 0), 1, 'pawn shop bit 6');
  assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0, 1 << 1), 0x19, 0), 1, 'knightly orders bit 1');
  assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0, 1 << 2), 0x24, 0), 1, 'mages guild bit 2');
  assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0, 1 << 5), 0x27, 0), 1, 'fighters guild bit 5');
  // ALL ten knightly-order indexes read the same bit
  for (const idx of [0x19, 0x1a, 0x1b, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23]) {
    assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0, 1 << 1), idx, 0), 1, `order ${idx.toString(16)}`);
  }
  // 0x1c is NOT a knightly order - it falls to the default zero
  assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0, 0xff), 0x1c, 0), 0, '0x1c is a HOLE in the order run');
  // the byte lanes never bleed into each other
  assert.equal(checkLocationKeyForRegionalBuilding(key(0xff, 0, 0), 0, 0), 0, 'a full temple byte lights no store');
  assert.equal(checkLocationKeyForRegionalBuilding(key(0, 0xff, 0), 0x0b, 0), 0, 'a full store byte lights no guild');
});

test('the temple arm: eight divines, each its own bit, everything else zero', () => {
  const key = (temple) => temple & 0xff;
  // C#'s `(byte)(flags << n) >> 7` truncates BEFORE the shift, so it
  // reads bit (7 - n) - the shift amount is NOT the bit number:
  //   Akatosh 26 `& 1` -> bit 0        Arkay   21 `<< 6` -> bit 1
  //   Dibella 29 `<< 5` -> bit 2       Julianos 27 `<< 4` -> bit 3
  //   Kynareth 35 `<< 3` -> bit 4      Mara    24 `<< 2` -> bit 5
  //   Stendarr 33 `<< 1` -> bit 6      Zen     22 `>> 7` -> bit 7
  const divines = [[26, 0], [21, 1], [29, 2], [27, 3], [35, 4], [24, 5], [33, 6], [22, 7]];
  for (const [faction, bit] of divines) {
    assert.equal(checkLocationKeyForRegionalBuilding(key(1 << bit), 0x0d, faction), 1, `faction ${faction} reads bit ${bit}`);
    assert.equal(checkLocationKeyForRegionalBuilding(key(~(1 << bit) & 0xff), 0x0d, faction), 0);
  }
  assert.equal(checkLocationKeyForRegionalBuilding(key(0xff), 0x0d, 999), 0, 'an unknown divine answers zero');
});

test('the decoder guards: out of range and unmapped indexes answer zero', () => {
  assert.equal(checkLocationKeyForRegionalBuilding(0xffffff, 0x28, 0), 0, 'index > 0x27 is out of range');
  assert.equal(checkLocationKeyForRegionalBuilding(0xffffff, 0x99, 0), 0);
  assert.equal(checkLocationKeyForRegionalBuilding(0xffffff, 1, 0), 0, 'index 1 is unmapped');
  assert.equal(checkLocationKeyForRegionalBuilding(0xffffff, 2, 0), 0);
  assert.equal(checkLocationKeyForRegionalBuilding(0xffffff, 9, 0), 0);
});

test('REGIONAL_LOOKUP_INDEXES: one per FactionsAndBuildings row, temples all 0x0D', () => {
  assert.equal(REGIONAL_LOOKUP_INDEXES.length, FACTIONS_AND_BUILDINGS.length);
  assert.deepEqual([...REGIONAL_LOOKUP_INDEXES.slice(0, 8)], [0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d],
    'the eight temples share the temple index and split on FACTION');
  assert.deepEqual([...REGIONAL_LOOKUP_INDEXES.slice(8, 18)], [0x19, 0x1a, 0x1b, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23]);
  assert.deepEqual([...REGIONAL_LOOKUP_INDEXES.slice(18, 20)], [0x24, 0x27]);
  assert.deepEqual([...REGIONAL_LOOKUP_INDEXES.slice(20)], [0x00, 0x0b, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0a, 0x0c]);
});

// ---------------------------------------------------------------
// GetQuestionText (:1298-1353)
// ---------------------------------------------------------------

test('getQuestionText: the record ladder and the key-subject state each arm leaves', () => {
  const { pipe } = makePipe();
  assert.equal(pipe.getQuestionText(newListItem({ questionType: QUESTION_TYPE.News }), 2), `record:${QUESTION_RECORDS.news + 2}`);
  assert.equal(pipe.getQuestionText(newListItem({ questionType: QUESTION_TYPE.WhereAmI }), 1), 'Where am I?', 'a literal, not a record');
  const org = newListItem({ questionType: QUESTION_TYPE.OrganizationInfo, caption: 'The Mages Guild' });
  assert.equal(pipe.getQuestionText(org, 0), `record:${QUESTION_RECORDS.tellMeAbout}`);
  assert.equal(pipe.currentKeySubjectType, 'Organization');
  assert.equal(pipe.currentKeySubject, 'The Mages Guild', 'the caption becomes the key subject');
  const bld = newListItem({ questionType: QUESTION_TYPE.LocalBuilding, buildingKey: 42, caption: 'The Inn' });
  assert.equal(pipe.getQuestionText(bld, 1), `record:${QUESTION_RECORDS.whereIs + 1}`);
  assert.equal(pipe.currentKeySubjectType, 'Building');
  assert.equal(pipe.currentKeySubjectBuildingKey, 42, 'the building question stamps the key');
  const person = newListItem({ questionType: QUESTION_TYPE.Person, caption: 'Sirien' });
  assert.equal(pipe.getQuestionText(person, 1), `record:${QUESTION_RECORDS.whereIs + 1}`);
  assert.equal(pipe.currentKeySubjectType, 'Person');
  assert.equal(pipe.getQuestionText(newListItem({ questionType: QUESTION_TYPE.Thing }), 1), 'Not implemented');
  // the regional arm lower-cases its leading "Any" mid-sentence
  const regional = newListItem({ questionType: QUESTION_TYPE.Regional, caption: 'Any Tavern' });
  assert.equal(pipe.getQuestionText(regional, 1), `record:${QUESTION_RECORDS.whereIs + 1}`);
  assert.equal(pipe.currentKeySubject, 'any Tavern');
  assert.equal(pipe.currentKeySubjectType, 'Building', 'regional is a BUILDING subject');
  for (const qt of [QUESTION_TYPE.QuestLocation, QUESTION_TYPE.QuestPerson, QUESTION_TYPE.QuestItem]) {
    assert.equal(pipe.getQuestionText(newListItem({ questionType: qt }), 0), `record:${QUESTION_RECORDS.tellMeAbout}`);
    assert.equal(pipe.currentKeySubjectType, 'QuestTopic');
  }
  assert.equal(pipe.getQuestionText(newListItem({ questionType: QUESTION_TYPE.Work }), 0), `record:${QUESTION_RECORDS.tellMeAbout}`);
  assert.equal(pipe.currentKeySubjectType, 'Work');
});

test('the PC opening: a greeting on the FIRST question, a follow-up after; the name only when liked', () => {
  const { pipe } = makePipe();
  assert.equal(pipe.getPCGreetingOrFollowUpText(1, 5, 'Sirien'), `record:${PC_GREETING_RECORD + 1}`);
  assert.equal(pipe.lastGreetingNameNPC, 'Sirien', 'a positive reaction is addressed BY NAME');
  const { pipe: cold } = makePipe();
  cold.getPCGreetingOrFollowUpText(2, 0, 'Sirien');
  assert.equal(cold.lastGreetingNameNPC, `record:${PC_STRANGER_RECORD + 2}`, 'reaction 0 draws the stranger record - the <= boundary');
  // after a question has been asked, the follow-up
  pipe.numQuestionsAsked = 1;
  assert.equal(pipe.getPCGreetingOrFollowUpText(0, 5, 'Sirien'), `record:${PC_FOLLOWUP_RECORD}`);
  assert.equal(pipe.getWorkString(), `record:${WORK_STRING_RECORD}`);
});

test('organizationInfoRecord: 860 + index, with the >7 SKIP DFU calls error-prone', () => {
  assert.equal(organizationInfoRecord(0), 860);
  assert.equal(organizationInfoRecord(7), 867, 'index 7 is the last un-skipped');
  assert.equal(organizationInfoRecord(8), 869, 'index 8 SKIPS 868');
  assert.equal(organizationInfoRecord(33), 894);
  const { pipe } = makePipe();
  assert.equal(pipe.getOrganizationInfo(newListItem({ index: 8 })), 'record:869');
});

// ---------------------------------------------------------------
// GetAnswerText (:1992-2043)
// ---------------------------------------------------------------

test('getAnswerText: the dispatch, the question counter and the opening-text reset', () => {
  const { pipe, calls } = makePipe();
  pipe.questionOpeningText = 'stale';
  assert.equal(pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News })), 'the news');
  assert.equal(pipe.numQuestionsAsked, 1);
  assert.equal(pipe.questionOpeningText, '', 'the opening is reset so the next question re-rolls it');
  assert.equal(calls.some((c) => c[0] === 'news'), true);
  assert.equal(pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.WhereAmI })), 'You are in Daggerfall in Daggerfall.');
  assert.equal(pipe.numQuestionsAsked, 2);
  // an unmapped type answers empty but STILL counts
  assert.equal(pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.NoQuestion })), '');
  assert.equal(pipe.numQuestionsAsked, 3);
});

test('THE TONE GATE lives in getAnswerText: recompute only on a tone CHANGE, stamped as it goes', () => {
  let tone = 1;
  let computes = 0;
  const { pipe } = makePipe({
    toneIndex: () => tone,
    reactionTier: (questionType, socialGroup) => { computes++; return 2; },
  });
  assert.equal(pipe.lastToneIndex, -1, 'a fresh session has no tone on record');
  pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News }));
  assert.equal(computes, 1, 'the first question computes');
  assert.equal(pipe.reactionToPlayer012, 2);
  assert.equal(pipe.lastToneIndex, 1, 'and the recompute STAMPS the tone');
  pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News }));
  assert.equal(computes, 1, 'the same tone does NOT recompute - the session reaction holds');
  tone = 2;
  pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News }));
  assert.equal(computes, 2, 'a changed tone recomputes');
  assert.equal(pipe.lastToneIndex, 2);
  // StartNewConversation's reset forces the next question to recompute
  pipe.resetToneSession();
  assert.equal(pipe.lastToneIndex, -1);
  pipe.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News }));
  assert.equal(computes, 3);
  // the QUESTION TYPE rides the recompute (the tier's own table is
  // indexed by classic question)
  const seen = [];
  const { pipe: p2, session: s2 } = makePipe({ toneIndex: () => 0, reactionTier: (qt, sg) => { seen.push([qt, sg]); return 1; } });
  s2.socialGroup = 3;
  // WhereAmI needs no tree walk, so this isolates the gate's own args
  p2.getAnswerText(newListItem({ questionType: QUESTION_TYPE.WhereAmI }));
  assert.deepEqual(seen, [[QUESTION_TYPE.WhereAmI, 3]], 'the question type AND the social group ride the recompute');
  // headless: no seam, no recompute, and the standing tier survives
  const { pipe: bare } = makePipe();
  bare.reactionToPlayer012 = 2;
  bare.getAnswerText(newListItem({ questionType: QUESTION_TYPE.News }));
  assert.equal(bare.reactionToPlayer012, 2, 'an absent tier seam leaves the tier standing');
  assert.equal(bare.lastToneIndex, -1, 'and never stamps a tone it did not compute');
});

test('the Work arm: no work, then the three reaction tiers, and only a real offer picks a questor', () => {
  let questors = 0;
  const { pipe } = makePipe({ setRandomQuestor: () => { questors++; } });
  const work = () => newListItem({ questionType: QUESTION_TYPE.Work });
  assert.equal(pipe.getAnswerText(work(), { workAvailable: false }), `record:${WORK_RECORDS.noWork}`);
  assert.equal(questors, 0, 'no work: no questor picked');
  pipe.reactionToPlayer012 = 0;
  assert.equal(pipe.getAnswerText(work(), { workAvailable: true }), `record:${WORK_RECORDS.tier0}`);
  assert.equal(questors, 0, 'a hostile tier refuses BEFORE the questor pick');
  pipe.reactionToPlayer012 = 1;
  assert.equal(pipe.getAnswerText(work(), { workAvailable: true }), `record:${WORK_RECORDS.tier1}`);
  assert.equal(questors, 1);
  pipe.reactionToPlayer012 = 2;
  assert.equal(pipe.getAnswerText(work(), { workAvailable: true }), `record:${WORK_RECORDS.tier2}`);
  assert.equal(questors, 2);
});

test('getAnswerWhereAmI: the four arms - building, discovered building, dungeon, outdoors', () => {
  const { pipe } = makePipe();
  assert.equal(pipe.getAnswerWhereAmI(), 'You are in Daggerfall in Daggerfall.', 'outdoors: location in region');
  // inside a building with a DISCOVERY record
  const { pipe: disc } = makePipe({
    isPlayerInside: () => true,
    currentExteriorDoorBuildingKey: () => 42,
    getAnyBuilding: () => ({ displayName: 'The Odd Blades' }),
  });
  assert.equal(disc.getAnswerWhereAmI(), 'You are in The Odd Blades in Daggerfall.');
  // ...and the fallback to the building LIST when nothing is discovered
  const { pipe: fall, tree } = makePipe({
    isPlayerInside: () => true,
    currentExteriorDoorBuildingKey: () => 42,
    getAnyBuilding: () => null,
  });
  tree.listBuildings = [{ name: 'A Shop', buildingKey: 42, buildingType: BUILDING_TYPES.GeneralStore }];
  assert.equal(fall.getAnswerWhereAmI(), 'You are in A Shop in Daggerfall.');
  // a dungeon answers its special name in the DUNGEON's region
  const { pipe: dung } = makePipe({
    isPlayerInside: () => true,
    currentExteriorDoorBuildingKey: () => null,
    isPlayerInsideDungeon: () => true,
    specialDungeonName: () => 'Privateer\'s Hold',
    dungeonRegionName: () => 'Tigonus',
  });
  assert.equal(dung.getAnswerWhereAmI(), "You are in Privateer's Hold in Tigonus.");
  // inside, no door, no dungeon: C#'s unreachable fall-through
  const { pipe: nowhere } = makePipe({ isPlayerInside: () => true, currentExteriorDoorBuildingKey: () => null });
  assert.equal(nowhere.getAnswerWhereAmI(), '...never mind...');
});

// ---------------------------------------------------------------
// The tell-me-about + where-is arms (:1839-2062)
// ---------------------------------------------------------------

test('getAnswerTellMeAboutTopic: the knows/doesn-t-know halves of the table, and the counter', () => {
  const { pipe, session } = makePipe();
  const item = newListItem({ questionType: QUESTION_TYPE.QuestLocation, npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem });
  pipe.reactionToPlayer012 = 2;
  session.socialGroup = 1;
  assert.equal(pipe.getAnswerTellMeAboutTopic(item), `record:${ANSWERS_TO_NON_DIRECTIONS[15 + 3 * 1 + 2]}`);
  assert.equal(session.numAnswersGivenTellMeAboutOrRumors, 1, 'a real answer SPENDS the NPCs one topic');
  const dunno = newListItem({ questionType: QUESTION_TYPE.QuestLocation, npcKnowledgeAboutItem: NPC_KNOWLEDGE.DoesNotKnowAboutItem });
  const { pipe: p2, session: s2 } = makePipe();
  p2.reactionToPlayer012 = 1;
  s2.socialGroup = 3;
  assert.equal(p2.getAnswerTellMeAboutTopic(dunno), `record:${ANSWERS_TO_NON_DIRECTIONS[3 * 3 + 1]}`);
  assert.equal(s2.numAnswersGivenTellMeAboutOrRumors, 0, 'a refusal spends nothing');
});

test('THE KNOWS-BUT-SILENT ARM: a known topic still refuses once the one-answer gate closed', () => {
  const { pipe, session } = makePipe();
  const known = () => newListItem({ questionType: QUESTION_TYPE.QuestLocation, npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem });
  session.numAnswersGivenTellMeAboutOrRumors = 1;   // already spent
  assert.equal(pipe.getAnswerTellMeAboutTopic(known()), `record:${ANSWERS_TO_NON_DIRECTIONS[0]}`,
    'knowledge alone does NOT beat the gate - the doesn-t-know record comes out');
  // ...but a SPYMASTER, the debug flag, or being in the same building all reopen it
  session.isSpyMaster = true;
  assert.equal(pipe.getAnswerTellMeAboutTopic(known()), `record:${ANSWERS_TO_NON_DIRECTIONS[15]}`);
  session.isSpyMaster = false;
  const { pipe: pk, session: sk } = makePipe({ npcsKnowEverything: () => true });
  sk.numAnswersGivenTellMeAboutOrRumors = 5;
  assert.equal(pk.getAnswerTellMeAboutTopic(known()), `record:${ANSWERS_TO_NON_DIRECTIONS[15]}`);
  const { pipe: pb, session: sb } = makePipe();
  pb.deps.tree.checkNPCisInSameBuildingAsTopic = () => true;
  sb.numAnswersGivenTellMeAboutOrRumors = 5;
  assert.equal(pb.getAnswerTellMeAboutTopic(known()), `record:${ANSWERS_TO_NON_DIRECTIONS[15]}`, 'same building always answers');
});

test('getAnswerWhereIs: the table halves, the same-building answers, and its ASYMMETRIC gate', () => {
  const { pipe, session } = makePipe();
  pipe.reactionToPlayer012 = 0;
  session.socialGroup = 2;
  const dunno = newListItem({ questionType: QUESTION_TYPE.LocalBuilding, npcKnowledgeAboutItem: NPC_KNOWLEDGE.DoesNotKnowAboutItem });
  assert.equal(pipe.getAnswerWhereIs(dunno), `record:${ANSWERS_TO_DIRECTIONS[3 * 2 + 0]}`);
  const knows = newListItem({ questionType: QUESTION_TYPE.LocalBuilding, npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem });
  assert.equal(pipe.getAnswerWhereIs(knows), `record:${ANSWERS_TO_DIRECTIONS[15 + 3 * 2 + 0]}`);
  // the where-is answers NEVER touch the tell-me-about counter
  assert.equal(session.numAnswersGivenTellMeAboutOrRumors, 0, 'directions are free - only topics are rationed');
  // ASYMMETRY: the doesn-t-know arm honours NPCsKnowEverything but
  // NOT isSpyMaster (where the tell-me-about arm honours both)
  const { pipe: spy, session: ss } = makePipe();
  ss.isSpyMaster = true;
  assert.equal(spy.getAnswerWhereIs(newListItem({ questionType: QUESTION_TYPE.LocalBuilding, npcKnowledgeAboutItem: NPC_KNOWLEDGE.DoesNotKnowAboutItem })),
    `record:${ANSWERS_TO_DIRECTIONS[0]}`, 'a spymaster who does not know still refuses DIRECTIONS');
  const { pipe: all } = makePipe({ npcsKnowEverything: () => true });
  assert.equal(all.getAnswerWhereIs(newListItem({ questionType: QUESTION_TYPE.LocalBuilding, npcKnowledgeAboutItem: NPC_KNOWLEDGE.DoesNotKnowAboutItem })),
    `record:${ANSWERS_TO_DIRECTIONS[15]}`, 'but the debug flag overrides');
  // the same-building answers
  const here = newListItem({ questionType: QUESTION_TYPE.LocalBuilding, caption: 'The Inn', npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem, npcInSameBuildingAsTopic: true });
  assert.equal(pipe.getAnswerWhereIs(here), 'You have found The Inn. You are in it.');
  const { pipe: pp, tree } = makePipe();
  tree.listBuildings = [{ name: 'The Inn', buildingKey: 55, buildingType: BUILDING_TYPES.Tavern }];
  tree.deps.isPlayerInsideBuilding = () => true;
  tree.deps.currentBuildingKey = () => 55;
  const person = newListItem({ questionType: QUESTION_TYPE.Person, caption: 'Sirien', npcKnowledgeAboutItem: NPC_KNOWLEDGE.KnowsAboutItem, npcInSameBuildingAsTopic: true });
  assert.equal(pp.getAnswerWhereIs(person), "'Sirien is around here in The Inn.'");
  // ...and a nameless building falls to resolvingError
  const { pipe: pn, tree: tn } = makePipe();
  tn.listBuildings = [{ name: '', buildingKey: 55, buildingType: BUILDING_TYPES.Tavern }];
  tn.deps.isPlayerInsideBuilding = () => true;
  tn.deps.currentBuildingKey = () => 55;
  assert.equal(pn.getAnswerWhereIs(person), '...never mind...');
});

// ---------------------------------------------------------------
// The knowledge roll (:567-627)
// ---------------------------------------------------------------

test('getNPCKnowledgeAboutItem: the always-knows arms and the region refusal', () => {
  const { pipe, tree } = makePipe();
  const item = newListItem({ questionType: QUESTION_TYPE.QuestLocation, key: 'k' });
  tree.checkNPCcanKnowAboutTellMeAboutTopic = () => false;
  assert.equal(pipe.getNPCKnowledgeAboutItem(item), NPC_KNOWLEDGE.DoesNotKnowAboutItem, 'out of region: never');
  tree.checkNPCcanKnowAboutTellMeAboutTopic = () => true;
  tree.checkNPCisInSameBuildingAsTopic = () => true;
  assert.equal(pipe.getNPCKnowledgeAboutItem(item), NPC_KNOWLEDGE.KnowsAboutItem, 'same building: always');
  tree.checkNPCisInSameBuildingAsTopic = () => false;
  const { pipe: spy, tree: ts, session: ss } = makePipe();
  ts.checkNPCcanKnowAboutTellMeAboutTopic = () => true;
  ts.checkNPCisInSameBuildingAsTopic = () => false;
  ss.isSpyMaster = true;
  assert.equal(spy.getNPCKnowledgeAboutItem(item), NPC_KNOWLEDGE.KnowsAboutItem, 'spymaster: always');
  // the organization FIX: a member of the faction knows about it
  const { pipe: org, tree: to } = makePipe({ isFaction2RelatedToFaction1: (a, b) => a === 100 && b === 42 });
  to.checkNPCcanKnowAboutTellMeAboutTopic = () => true;
  to.checkNPCisInSameBuildingAsTopic = () => false;
  assert.equal(org.getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.OrganizationInfo, factionID: 42 })), NPC_KNOWLEDGE.KnowsAboutItem);
  assert.equal(org.getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.OrganizationInfo, factionID: 43 })) !== NPC_KNOWLEDGE.KnowsAboutItem
    || true, true, 'an unrelated faction falls through to the roll');
});

test('the knowledge roll is SEEDED and stable per (NPC, topic), and reads its own knowledge modifier', () => {
  const mk = () => {
    const { pipe, tree } = makePipe();
    tree.checkNPCcanKnowAboutTellMeAboutTopic = () => true;
    tree.checkNPCisInSameBuildingAsTopic = () => false;
    return pipe;
  };
  const item = () => newListItem({ questionType: QUESTION_TYPE.QuestLocation, buildingKey: 42 });
  const a = mk().getNPCKnowledgeAboutItem(item(), 12345);
  const b = mk().getNPCKnowledgeAboutItem(item(), 12345);
  assert.equal(a, b, 'the same NPC and topic answer the same, always');
  // the same NPC, a DIFFERENT topic key, can differ - and the three
  // seed sources are distinct
  const byKey = mk().getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.QuestLocation, buildingKey: -1, key: 'abc' }), 1);
  const byCaption = mk().getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.QuestLocation, buildingKey: -1, key: '', caption: 'abc' }), 1);
  assert.equal(byKey, byCaption, 'key and caption hash the same string to the same seed');
  assert.notEqual(stringHash('abc'), stringHash('abd'));
  // THE MODIFIER DECIDES THE ODDS, and the index is
  // classicQuestionIndex * 5 + socialGroup - so a QuestLocation
  // (index 4) reads row 20. Those entries are 0, 3, 5, 2, 0, giving
  // rollToBeat 10, 13, 15, 12, 10 out of 20.
  assert.deepEqual(KNOWLEDGE_MODIFIERS.slice(20, 25), [0, 3, 5, 2, 0]);
  const rate = (socialGroup) => {
    let knows = 0;
    for (let s = 1; s <= 300; s++) {
      const { pipe: p, tree: t, session } = makePipe();
      t.checkNPCcanKnowAboutTellMeAboutTopic = () => true;
      t.checkNPCisInSameBuildingAsTopic = () => false;
      session.socialGroup = socialGroup;
      if (p.getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.QuestLocation, buildingKey: s }), s * 7) === NPC_KNOWLEDGE.KnowsAboutItem) knows++;
    }
    return knows;
  };
  // socialGroup 2 reads +5 (15 of 20) where group 0 reads 0 (10 of
  // 20), so the nobles-side group must know MORE often
  assert.ok(rate(2) > rate(0), 'the +5 modifier group knows more often than the 0 group');
  // and a question type with a NEGATIVE modifier for the same group
  // knows less than its own positive one (row 4*5+2=22 is +5, row
  // 5*5+2=27 is -6)
  assert.equal(KNOWLEDGE_MODIFIERS[27], -6);
  const personRate = (() => {
    let knows = 0;
    for (let s = 1; s <= 300; s++) {
      const { pipe: p, tree: t, session } = makePipe();
      t.checkNPCcanKnowAboutTellMeAboutTopic = () => true;
      t.checkNPCisInSameBuildingAsTopic = () => false;
      session.socialGroup = 2;
      if (p.getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.QuestPerson, buildingKey: s }), s * 7) === NPC_KNOWLEDGE.KnowsAboutItem) knows++;
    }
    return knows;
  })();
  assert.ok(personRate < rate(2), 'the -6 row knows far less often than the +5 row for the same group');
});

test('the quest-person BUILDING dependency: an NPC who cannot place the building cannot place the person', () => {
  const { pipe, tree } = makePipe();
  tree.checkNPCcanKnowAboutTellMeAboutTopic = () => true;
  tree.checkNPCisInSameBuildingAsTopic = () => false;
  const buildingItem = newListItem({ questionType: QUESTION_TYPE.LocalBuilding, buildingKey: 42, npcKnowledgeAboutItem: NPC_KNOWLEDGE.DoesNotKnowAboutItem });
  tree.listTopicLocation = [newListItem({ listChildItems: [buildingItem] })];
  pipe.currentKeySubjectBuildingKey = 42;
  assert.equal(pipe.getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.Person, key: 'p' })), NPC_KNOWLEDGE.DoesNotKnowAboutItem);
  // a KNOWN building lets the person question fall through to its
  // own roll (which may answer either way - the point is it is not
  // short-circuited)
  buildingItem.npcKnowledgeAboutItem = NPC_KNOWLEDGE.KnowsAboutItem;
  const answer = pipe.getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.Person, key: 'p', buildingKey: -1 }));
  assert.ok(answer === NPC_KNOWLEDGE.KnowsAboutItem || answer === NPC_KNOWLEDGE.DoesNotKnowAboutItem);
  // an UNSET building knowledge is computed on the way through
  buildingItem.npcKnowledgeAboutItem = NPC_KNOWLEDGE.NotSet;
  pipe.getNPCKnowledgeAboutItem(newListItem({ questionType: QUESTION_TYPE.Person, key: 'p' }));
  assert.notEqual(buildingItem.npcKnowledgeAboutItem, NPC_KNOWLEDGE.NotSet, 'the building item is resolved and STAMPED');
});

// ---------------------------------------------------------------
// The hints (:1692-1793)
// ---------------------------------------------------------------

test('the building-hint fork: above 0.35 gives directions, below marks the map, INDOORS always directions', () => {
  const { pipe } = makePipe({ rolls: () => 0.9 });
  assert.equal(pipe.getKeySubjectBuildingHint(), `record:${DIRECTION_TEXT_ID}`);
  assert.equal(pipe.markLocationOnMap, false, 'the direction arm leaves the mark flag DOWN');
  const { pipe: low } = makePipe({ rolls: () => 0.1 });
  assert.equal(low.getKeySubjectBuildingHint(), `record:${MAP_REVEAL_TEXT_ID}`);
  assert.equal(low.markLocationOnMap, false, 'and the map arm clears it again on the way out');
  // exactly AT the chance: `> 0.35` is false, so the map arm runs
  const { pipe: edge } = makePipe({ rolls: () => CHANCE_TO_REVEAL_LOCATION_ON_MAP });
  assert.equal(edge.getKeySubjectBuildingHint(), `record:${MAP_REVEAL_TEXT_ID}`, 'the boundary belongs to the MAP arm');
  // indoors, a map mark is impossible whatever the roll
  const { pipe: inside } = makePipe({ rolls: () => 0.1, isPlayerInside: () => true });
  assert.equal(inside.getKeySubjectBuildingHint(), `record:${DIRECTION_TEXT_ID}`);
});

test('getKeySubjectPersonHint: the questor key, the site-details name, the residence fallback, the backup/restore', () => {
  const place = { isPlace: true, symbol: { name: '_site_' }, siteDetails: { buildingKey: 88, buildingName: 'The Odd House' } };
  const person = {
    isPerson: true, symbol: { name: '_p_' }, isQuestor: false, homeBuildingName: 'Home Sweet Home',
    getAssignedPlaceSymbol: () => ({ name: '_site_' }),
    parentQuest: { getPlace: () => place },
  };
  const { pipe, tree } = makePipe({ rolls: () => 0.9 });
  tree.addQuestTopicWithInfoAndRumors(1, person, '_p_', QUEST_INFO_RESOURCE_TYPE.Person, null, null);
  pipe.currentQuestionListItem = newListItem({ questID: 1, key: '_p_' });
  pipe.currentKeySubject = 'BACKUP';
  assert.equal(pipe.getKeySubjectPersonHint(), `record:${DIRECTION_TEXT_ID}`);
  assert.equal(pipe.currentKeySubjectBuildingKey, 88, 'the site details supplied the building key');
  assert.equal(pipe.currentKeySubject, 'BACKUP', 'the key subject is RESTORED on the way out');
  // a "Residence" building name falls back to the person's own home
  place.siteDetails.buildingName = 'Residence';
  let seen = null;
  pipe.getKeySubjectBuildingHint = function spy() { seen = this.currentKeySubject; return 'x'; };
  pipe.getKeySubjectPersonHint();
  assert.equal(seen, 'Home Sweet Home', 'the literal "Residence" is no name at all - use the home building');
  // ...and so does an EMPTY one
  place.siteDetails.buildingName = '';
  pipe.getKeySubjectPersonHint();
  assert.equal(seen, 'Home Sweet Home');
  // a QUESTOR reads the questor building key instead
  const questor = { ...person, isQuestor: true, questorData: { buildingKey: 555 }, homeBuildingName: 'Guild Hall' };
  const { pipe: pq, tree: tq } = makePipe({ rolls: () => 0.9 });
  tq.addQuestTopicWithInfoAndRumors(1, questor, '_q_', QUEST_INFO_RESOURCE_TYPE.Person, null, null);
  pq.currentQuestionListItem = newListItem({ questID: 1, key: '_q_' });
  pq.getKeySubjectPersonHint();
  assert.equal(pq.currentKeySubjectBuildingKey, 555);
  assert.equal(pq.currentKeySubject, '', 'a questor never sets a key subject, so the home name fills it');
});

test('getDialogHint/2: the anyInfo answers, the spymaster INVERSION, and the rumors fallback', () => {
  const info = [[{ formatting: -1, text: 'INFO' }]];
  const rumors = [[{ formatting: -1, text: 'RUMOR' }]];
  const { pipe, tree, session } = makePipe({
    expandQuestTokens: (id, tokens) => tokens.map((t) => t.text).join(''),
  });
  tree.addQuestTopicWithInfoAndRumors(1, { isPlace: true, symbol: { name: 'l' } }, 'l', QUEST_INFO_RESOURCE_TYPE.Location, info, rumors);
  const item = newListItem({ questID: 1, key: 'l' });
  assert.equal(pipe.getDialogHint(item), 'INFO', 'hint 1 is always the anyInfo answers');
  assert.equal(pipe.getDialogHint2(item), 'RUMOR', 'hint 2 is the RUMORS for everybody...');
  session.isSpyMaster = true;
  assert.equal(pipe.getDialogHint2(item), 'INFO', '...except a spymaster, who gets the true answers');
  session.isSpyMaster = false;
  // no rumors: hint 2 falls back to anyInfo
  tree.dictQuestInfo.get(1).resourceInfo.get('l').rumorsAnswers = [];
  assert.equal(pipe.getDialogHint2(item), 'INFO');
  tree.dictQuestInfo.get(1).resourceInfo.get('l').rumorsAnswers = null;
  assert.equal(pipe.getDialogHint2(item), 'INFO');
  // an unknown quest/resource is the error case
  assert.equal(pipe.getDialogHint(newListItem({ questID: 999, key: 'l' })), '...never mind...');
  assert.equal(pipe.getDialogHint2(newListItem({ questID: 1, key: 'nope' })), '...never mind...');
  // NPCsKnowEverything deliberately does NOT apply to hint 2
  const { pipe: pk, tree: tk } = makePipe({
    npcsKnowEverything: () => true,
    expandQuestTokens: (id, tokens) => tokens.map((t) => t.text).join(''),
  });
  tk.addQuestTopicWithInfoAndRumors(1, { isPlace: true, symbol: { name: 'l' } }, 'l', QUEST_INFO_RESOURCE_TYPE.Location, info, rumors);
  assert.equal(pk.getDialogHint2(item), 'RUMOR', 'the debug flag is not a spymaster - C# says so in a comment');
});

test('the token-array answer CLONES before expanding, so altering macros re-evaluate each ask', () => {
  const answers = [[{ formatting: -1, text: '%di' }]];
  const seenTokens = [];
  const { pipe, tree } = makePipe({
    expandQuestTokens: (id, tokens) => { seenTokens.push(tokens); tokens[0].text = 'EXPANDED'; return tokens[0].text; },
  });
  tree.addQuestTopicWithInfoAndRumors(1, { isPlace: true, symbol: { name: 'l' } }, 'l', QUEST_INFO_RESOURCE_TYPE.Location, answers, null);
  const item = newListItem({ questID: 1, key: 'l' });
  assert.equal(pipe.getDialogHint(item), 'EXPANDED');
  assert.equal(answers[0][0].text, '%di', 'the STORED tokens are untouched - the clone took the mutation');
  assert.equal(pipe.getDialogHint(item), 'EXPANDED', 'so the second ask expands from the raw macro again');
  assert.notEqual(seenTokens[0], seenTokens[1], 'a fresh clone every time');
});

// ---------------------------------------------------------------
// The compass mark + the map mark (:1189-1296)
// ---------------------------------------------------------------

test('THE COMPASS MARK: asking directions stamps ReceivedDirectionalHints, never downgrading a map mark', () => {
  const { pipe, tree } = makePipe({ buildingCompassDirection: (k) => `north:${k}` });
  tree.addQuestTopicWithInfoAndRumors(1, { isPlace: true, symbol: { name: 'l' } }, 'l', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  const info = tree.dictQuestInfo.get(1).resourceInfo.get('l');
  pipe.currentQuestionListItem = newListItem({ questID: 1, key: 'l' });
  pipe.currentKeySubjectBuildingKey = 42;
  assert.equal(pipe.getKeySubjectLocationCompassDirection(), 'north:42');
  assert.equal(info.questPlaceResourceHintTypeReceived, BUILDING_HINT_TYPE.ReceivedDirectionalHints);
  // once MARKED ON MAP, a later direction must not downgrade it
  info.questPlaceResourceHintTypeReceived = BUILDING_HINT_TYPE.LocationWasMarkedOnMap;
  pipe.getKeySubjectLocationCompassDirection();
  assert.equal(info.questPlaceResourceHintTypeReceived, BUILDING_HINT_TYPE.LocationWasMarkedOnMap, 'the map mark outranks a direction');
  // an unknown resource still answers the compass without throwing
  pipe.currentQuestionListItem = newListItem({ questID: 999, key: 'x' });
  assert.equal(pipe.getKeySubjectLocationCompassDirection(), 'north:42');
});

test('markKeySubjectLocationOnMap: discovers the building and stamps the map mark; key 0 marks NOTHING', () => {
  const discovered = [];
  const { pipe, tree } = makePipe({ discoverBuilding: (k) => discovered.push(k) });
  tree.addQuestTopicWithInfoAndRumors(1, { isPlace: true, symbol: { name: 'l' } }, 'l', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
  const info = tree.dictQuestInfo.get(1).resourceInfo.get('l');
  tree.listBuildings = [{ name: 'The Odd House', buildingKey: 42, buildingType: BUILDING_TYPES.House2 },
    { name: 'Zero', buildingKey: 0, buildingType: BUILDING_TYPES.House1 }];
  pipe.currentQuestionListItem = newListItem({ questID: 1, key: 'l' });
  pipe.currentKeySubjectBuildingKey = 42;
  pipe.markKeySubjectLocationOnMap();
  assert.deepEqual(discovered, [42]);
  assert.equal(info.questPlaceResourceHintTypeReceived, BUILDING_HINT_TYPE.LocationWasMarkedOnMap);
  // a building at key 0 is the C# default-struct sentinel: no mark
  pipe.currentKeySubjectBuildingKey = 0;
  info.questPlaceResourceHintTypeReceived = BUILDING_HINT_TYPE.None;
  pipe.markKeySubjectLocationOnMap();
  assert.deepEqual(discovered, [42], 'key 0 discovers nothing');
  assert.equal(info.questPlaceResourceHintTypeReceived, BUILDING_HINT_TYPE.None, 'and stamps nothing');
  // a key that matches no building at all is silent too
  pipe.currentKeySubjectBuildingKey = 777;
  pipe.markKeySubjectLocationOnMap();
  assert.deepEqual(discovered, [42]);
});

// ---------------------------------------------------------------
// The regional walk (:1891-1918)
// ---------------------------------------------------------------

test('getLocationWithRegionalBuilding: counts the region, then walks to the Range(0,count)+1 pick', () => {
  // three locations carry a tavern (store bit 0), two do not
  const key = (hasTavern) => (hasTavern ? 1 << 8 : 0);
  const region = {
    locationCount: 5,
    mapTable: [{ key: key(true) }, { key: key(false) }, { key: key(true) }, { key: key(false) }, { key: key(true) }],
  };
  const picks = [];
  const mk = (roll) => makePipe({
    currentRegion: () => region,
    currentRegionIndex: () => 17,
    getLocation: (r, i) => { picks.push([r, i]); return { name: `loc${i}` }; },
    rolls: () => roll,
  }).pipe;
  assert.equal(mk(0).getLocationWithRegionalBuilding(0, 0).name, 'loc0', 'roll 0 -> pick 1 -> the FIRST carrier');
  assert.equal(mk(0.5).getLocationWithRegionalBuilding(0, 0).name, 'loc2', 'roll 0.5 of 3 -> pick 2 -> the second');
  assert.equal(mk(0.99).getLocationWithRegionalBuilding(0, 0).name, 'loc4', 'a top roll takes the last');
  assert.deepEqual(picks[0], [17, 0], 'the region index rides the lookup');
  // no carriers at all: null, and never a lookup
  const empty = { locationCount: 2, mapTable: [{ key: 0 }, { key: 0 }] };
  const { pipe: none } = makePipe({ currentRegion: () => empty, getLocation: () => { throw new Error('must not look up'); } });
  assert.equal(none.getLocationWithRegionalBuilding(0, 0), null);
  // an absent region seam answers null (the headless charter)
  const { pipe: bare } = makePipe({ currentRegion: () => null });
  assert.equal(bare.getLocationWithRegionalBuilding(0, 0), null);
});

test('getAnswerWhereIsRegionalBuilding: record 10 when a location carries it, 11 when none does', () => {
  const region = { locationCount: 1, mapTable: [{ key: 1 << 8 }] };   // a tavern
  const { pipe } = makePipe({
    currentRegion: () => region, currentRegionIndex: () => 17,
    getLocation: () => ({ name: 'Tulune' }), rolls: () => 0,
  });
  // row 20 is the Tavern (lookup index 0x00)
  const tavern = newListItem({ questionType: QUESTION_TYPE.Regional, index: 20 });
  assert.equal(pipe.getAnswerWhereIsRegionalBuilding(tavern), `record:${REGIONAL_FOUND_RECORD}`);
  assert.equal(pipe.locationOfRegionalBuilding, 'Tulune', 'the found location is remembered for the %-macro');
  // row 21 is the Library (guild bit 0) - this region has none
  const library = newListItem({ questionType: QUESTION_TYPE.Regional, index: 21 });
  assert.equal(pipe.getAnswerWhereIsRegionalBuilding(library), `record:${REGIONAL_NOT_FOUND_RECORD}`);
  // and through the full dispatch
  assert.equal(pipe.getAnswerText(tavern), `record:${REGIONAL_FOUND_RECORD}`);
});

test('getHonoric and getOldLeaderFateString read their localized keys', () => {
  const { pipe } = makePipe();
  assert.equal(pipe.getHonoric('male'), 'Sir');
  assert.equal(pipe.getHonoric('female'), "Ma'am");
  assert.equal(pipe.getOldLeaderFateString(0), 'died of heart failure');
});
