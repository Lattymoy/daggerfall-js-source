// FIELD BUGS 2026-10-20h QUESTOR-HELD and QUESTOR-SHE (Ballvald Steel-Hewer, in the chat of a crash screenshot on the
// Discord's #bug-reports: "there are many instances where insert here names are not appearing. meaning when i ask about
// the work they say go to talk to 'insert name here'").
//
// The Work answer (TEXT.RSC 8076/8077) names the questor the pool's selection points at, through %pqn/%pqp, and picks
// the next one AFTER it is expanded - DFU's own order (TalkManager.cs:2033-2036). The offer window spends the questor
// it was opened for (DaggerfallQuestOfferWindow.cs:33-35), and a load brings a pool in without its selection
// (TalkManager.cs:2541-2542). When either took the questor the selection named, the readers answered '' and the player
// read "Go to a place called  and talk to someone named ." DFU throws KeyNotFoundException there instead, and its Work
// topic stays dead until the pool is rebuilt. QUESTOR-HELD keeps the selection on a questor the pool holds. QUESTOR-SHE:
// the pronouns compared the questor's gender with the string 'female' while the pool carries the Genders enum, so every
// woman with work was "him".
//
// Every fixture from its producer (TEST THE SHAPE THE PRODUCER MINTS): the town's people by questorCandidateBuildings over
// an RMB block with interior people (fb1003b_questor.test.js's shape), the pool by NPCSession.buildQuestorPool, the offer
// by QuestOfferFlow.offerSocialQuest (its constructor half is the removal), the save by composeSessionState /
// restoreSessionState, the answer by AnswerPipeline.getAnswerText over talkMacros' expandRandomTextRecord. The record's
// tokens are a stand-in carrying the three macros - the law is the macros' - and the last pin reads Daggerfall's own
// records where ARENA2_PATH has them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { questorCandidateBuildings } from '../../../src/systems/talk/talkTopics.js';
import { NPCSession } from '../../../src/systems/npcSession.js';
import { AnswerPipeline, TALK_STRINGS, WORK_RECORDS } from '../../../src/systems/answerPipeline.js';
import { expandRandomTextRecord } from '../../../src/systems/talk/talkMacros.js';
import { QUESTION_TYPE, LIST_ITEM_TYPE } from '../../../src/systems/topicTree.js';
import { QuestOfferFlow } from '../../../src/systems/quest/offerFlow.js';
import { composeSessionState, restoreSessionState } from '../../../src/systems/save/save.js';
import { GENDERS } from '../../../src/characters/nameHelper.js';
import { TextRsc, TOKEN_TEXT } from '../../../src/formats/textRsc.js';

const src = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');

// ---- one town: a tavern and a library, two candidates in each, of the three social groups that offer work ----

const TAVERN = 15, LIBRARY = 10, MERCHANTS = 510, COMMONERS = 511, MAP = 111, LOC_INDEX = 7;
const FACTIONS = new Map([
  [MERCHANTS, { id: MERCHANTS, type: 2, sgroup: 1, name: 'The Merchants', parent: 0 }],
  [COMMONERS, { id: COMMONERS, type: 2, sgroup: 0, name: 'The Commoners', parent: 0 }],
]);
/** A block person record; flags bit 32 is the gender staticNpcData reads (StaticNPC.SetLayoutData). */
const person = (position, factionID, female = false) => ({
  xPos: position, yPos: 0, zPos: position, position, factionID, flags: female ? 32 : 0, textureArchive: 182, textureRecord: 3,
});
const BLOCK = {
  position: 5000,
  rmbBlock: {
    fldHeader: {
      numBlockDataRecords: 2, otherNames: null,
      buildingDataList: [{ buildingType: TAVERN, factionId: 0, nameSeed: 11 }, { buildingType: LIBRARY, factionId: 0, nameSeed: 22 }],
    },
    subRecords: [
      { interior: { blockFlatObjectRecords: [], blockPeopleRecords: [person(100, MERCHANTS), person(200, COMMONERS, true)] } },
      { interior: { blockFlatObjectRecords: [], blockPeopleRecords: [person(300, MERCHANTS, true), person(400, COMMONERS)] } },
    ],
  },
};
const EXTERIOR = [
  { buildingType: TAVERN, factionId: 0, nameSeed: 11, locationId: 0, sector: 0, quality: 9 },
  { buildingType: LIBRARY, factionId: 0, nameSeed: 22, locationId: 0, sector: 0, quality: 9 },
];
/** townTalk's rebuildDirectory feed - the candidates the pool is built from. */
const buildings = () => questorCandidateBuildings(EXTERIOR, [{ dfBlock: BLOCK, x: 0, y: 0 }], {
  locationIndex: LOC_INDEX, mapId: MAP, nameOpts: { locationName: 'Shesterwick', regionName: 'Testshire' },
  getFaction: (id) => FACTIONS.get(id) ?? null,
});

const WORK_TOKENS = [{ text: '%pqn works at %pqp; ask %g2.', formatting: TOKEN_TEXT }];
const workItem = () => ({ type: LIST_ITEM_TYPE.Item, questionType: QUESTION_TYPE.Work, caption: '' });

/** The talk trio as world.js mounts it, over the pool's deps. `tokens(id)` is GetRandomTokens. */
function makeTalk({ tokens = () => WORK_TOKENS, rolls = () => 0.9 } = {}) {
  let pipeline = null;
  const session = new NPCSession({
    factionData: (id) => FACTIONS.get(id) ?? null,
    currentLocationIndex: () => LOC_INDEX,
    nameBankOfCurrentRegion: () => 0,
    fullName: (bank, gender) => `name(${bank},${gender})`,   // the seam's two-argument form (world.js), as it is handed
    rolls,   // Range(0, 4) === 3 at 0.9: every candidate joins the pool
  });
  const mcp = () => ({
    pipeline, session,
    randomTokens: (id) => tokens(id),
    localizedText: (k) => TALK_STRINGS[k] ?? '',
    // world.js talkMcp's questorGender, restated (its text is held by the last pin and by audit26_talk's F097)
    questorGender: () => {
      const q = pipeline.currentQuestionListItem;
      if (q?.questionType !== QUESTION_TYPE.Work || !session.workAvailable) return null;
      return session.getQuestorGender();
    },
  });
  pipeline = new AnswerPipeline({
    expandRandomTextRecord: (id) => expandRandomTextRecord(id, mcp()),
    setRandomQuestor: () => session.setRandomQuestor(),
    localizedText: (k) => TALK_STRINGS[k] ?? '',
  });
  const offers = new QuestOfferFlow(
    { isLastNPCClickedAnActiveQuestor: () => false, deps: {}, createMessagePrompt: () => null },
    { getSocialQuest: () => null },
    { isPlayerInsideCastle: () => false, removeNpcQuestor: (seed) => session.removeNpcQuestor(seed) });
  /** townTalk's askWork at reaction tier 2 (8077). */
  const work = () => {
    pipeline.reactionToPlayer012 = 2;
    return pipeline.getAnswerText(workItem(), { workAvailable: session.workAvailable });
  };
  /** A click on a pool member: TalkToStaticNPC's questor door, then the offer window. */
  const offer = (seed) => {
    const door = session.talkToStaticNPC({ data: { nameSeed: seed, factionID: 0 }, isChildNPC: false });
    assert.equal(door.kind, 'questOffer', 'a pool member opens the offer');
    offers.offerSocialQuest(door.npc, door.socialGroup, door.menu);
  };
  return { session, pipeline, work, offer };
}
const lastKey = (s) => [...s.npcsWithWork.keys()].at(-1);
/** The answer the stand-in record gives for a questor of the pool. */
const answerFor = (s, seed) => {
  const e = s.npcsWithWork.get(seed);
  return `name(0,${e.npc.gender}) works at ${e.buildingName}; ask ${e.npc.gender === GENDERS.Female ? 'her' : 'him'}.`;
};
const stub = { getSaveData: () => ({}), restoreSaveData() {}, removeOrphanedQuestRumors() {} };

test('QUESTOR-HELD: the build selects the last questor added, and the first answer names them (TalkManager.cs:2869)', () => {
  const { session, work } = makeTalk();
  session.buildQuestorPool(buildings());
  assert.equal(session.npcsWithWork.size, 4, 'all four candidates offer work');
  assert.equal(session.selectedNpcWorkKey, lastKey(session));
  assert.equal(work(), answerFor(session, lastKey(session)), 'the answer names the selection standing BEFORE the ask');
});

test('QUESTOR-HELD: the offer spends the questor the selection names, and the next answer names the last one standing', () => {
  const { session, work, offer } = makeTalk();
  session.buildQuestorPool(buildings());
  const named = session.selectedNpcWorkKey;
  offer(named);
  assert.equal(session.npcsWithWork.has(named), false, 'the offer window spent the questor');
  assert.equal(session.selectedNpcWorkKey, lastKey(session));
  assert.equal(work(), answerFor(session, lastKey(session)), 'never "someone named " at "a place called "');
});

test('QUESTOR-HELD: an offer from another questor leaves the selection where it stood', () => {
  const { session, offer } = makeTalk();
  session.buildQuestorPool(buildings());
  const selected = session.selectedNpcWorkKey;
  offer([...session.npcsWithWork.keys()][0]);
  assert.equal(session.selectedNpcWorkKey, selected);
});

test('QUESTOR-HELD: the pool spent to its last questor answers the no-work record', () => {
  const { session, pipeline, offer } = makeTalk();
  session.buildQuestorPool(buildings());
  for (const seed of [...session.npcsWithWork.keys()]) offer(seed);
  assert.equal(session.workAvailable, false);
  const asked = [];
  pipeline.deps.expandRandomTextRecord = (id) => { asked.push(id); return ''; };
  pipeline.getAnswerText(workItem(), { workAvailable: session.workAvailable });
  assert.deepEqual(asked, [WORK_RECORDS.noWork]);
});

test('QUESTOR-HELD: a load whose pool lacks the standing selection selects the last questor it carries', () => {
  const before = makeTalk();
  before.session.buildQuestorPool(buildings());
  before.offer(before.session.selectedNpcWorkKey);   // the save's pool is one questor short
  const saved = JSON.parse(JSON.stringify(composeSessionState({ talk: { mill: stub, tree: stub, session: before.session } })));
  const now = makeTalk();
  now.session.buildQuestorPool(buildings());   // this session's selection is the questor the save spent
  assert.equal(saved.talk.npcsWithWork.some(([k]) => k === now.session.selectedNpcWorkKey), false);
  restoreSessionState(saved, { talk: { mill: stub, tree: stub, session: now.session } });
  assert.equal(now.session.selectedNpcWorkKey, lastKey(now.session));
  assert.equal(now.work(), answerFor(now.session, lastKey(now.session)));
});

test('QUESTOR-SHE: a woman with work is "her" - the Genders enum staticNpcData mints, handed through by the world host', () => {
  const { session, work } = makeTalk();
  session.buildQuestorPool(buildings());
  const [female] = [...session.npcsWithWork].find(([, e]) => e.npc.gender === GENDERS.Female);
  session.selectedNpcWorkKey = female;
  const said = work();
  assert.equal(said, answerFor(session, female));
  assert.match(said, /; ask her\.$/);
  // the world host's seam hands the pool's own value on - no vocabulary of its own between them
  const w = src('scenes/world.js');
  const at = w.indexOf('    questorGender: () => {');
  assert.ok(at > 0, 'the world host mounts the questor gender');
  const arm = w.slice(at, w.indexOf('    bumpSeed: (delta) => bumpSeed(delta),', at));
  assert.match(arm, /\n {6}return npcSession\.getQuestorGender\(\);\n/);
});

// ---- Daggerfall's own records, every variant, where the player's data is to hand ----

const ARENA2 = process.env.ARENA2_PATH;
const RSC = ARENA2 ? join(ARENA2, 'TEXT.RSC') : null;
const SKIP = RSC && existsSync(RSC) ? false : 'ARENA2_PATH not set - the real Work records need TEXT.RSC';

test('QUESTOR-HELD: after the offer, every variant of 8076 and 8077 names the held questor and their building', { skip: SKIP }, () => {
  const rsc = new TextRsc().load(new Uint8Array(readFileSync(RSC)));
  for (const [tier, id] of [[1, WORK_RECORDS.tier1], [2, WORK_RECORDS.tier2]]) {
    const n = rsc.plainText(id).length;
    for (let v = 0; v < n; v++) {
      let pick = 0.9;   // the build: every candidate joins
      const t = makeTalk({ tokens: (rid) => rsc.variantTokensById(rid, () => pick), rolls: () => pick });
      t.session.buildQuestorPool(buildings());
      t.offer(t.session.selectedNpcWorkKey);
      const held = t.session.npcsWithWork.get(t.session.selectedNpcWorkKey);   // before the ask: the pick runs after it
      pick = (v + 0.5) / n;   // GetRandomTokens lands on variant v
      t.pipeline.reactionToPlayer012 = tier;
      const said = t.pipeline.getAnswerText(workItem(), { workAvailable: t.session.workAvailable });
      assert.ok(held, `${id}[${v}] names nobody the pool holds: ${JSON.stringify(said)}`);
      assert.ok(said.includes(`name(0,${held.npc.gender})`) && said.includes(held.buildingName), `${id}[${v}]: ${said}`);
    }
  }
});
