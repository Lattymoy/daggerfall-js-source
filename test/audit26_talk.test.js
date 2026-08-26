// AUDIT 26, talk wave. Two laws, both of them wiring the port had
// ported and then never reached:
//
//   F094 - MacroHelper.ExpandMacros runs the WHOLE macro table over
//          every talk record (MacroHelper.cs:419-494), and GetValue
//          (:503-528) answers a symbol the table does not carry with
//          symbolStr + "[undefined]". The talk MCP carried sixteen
//          symbols and none of the six GLOBALS the question and
//          greeting records actually name.
//   F087/F091 - PlayerActivate.cs:783 hands a mobile click to
//          TalkManager.TalkToMobileNPC (TalkManager.cs:726-744). The
//          port's only mobile-click path ran a local greeting ladder
//          and left the session's NPCData as the last STATIC NPC set
//          it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  talkMacroHandlers, expandRandomTextRecord, TALK_MACROS,
} from '../src/systems/talkMacros.js';
import { AnswerPipeline, TALK_STRINGS } from '../src/systems/answerPipeline.js';
import { NPCSession, SOCIAL_GROUP, FACTION_TYPE, NPC_TYPE, newNPCData } from '../src/systems/npcSession.js';
import { TopicTree, QUESTION_TYPE, newListItem } from '../src/systems/topicTree.js';
import { createTownTalk } from '../src/scenes/townTalk.js';

// ---------------------------------------------------------------
// F094 - the talk MCP over the six MacroHelper globals.
//
// The record fixtures below stand in for TEXT.RSC (ARENA2 is not on
// this machine); what is pinned is the LAW - which record each macro
// draws (7215/7218/7221 + tone, MacroHelper.cs:44 -> TalkManager.cs:
// 1133-1156) and which source each of the flat five reads.
// ---------------------------------------------------------------
const RECORDS = {
  7226: '%1com. Where is %key?',   // 7225 + tone 1, the where-is question
  7216: 'Hail to thee %n',         // 7215 + tone 1, the PC greeting
  7219: 'Excuse me again',         // 7218 + tone 1, the PC follow-up
  7222: 'stranger',                // 7221 + tone 1, the "not liked" name
  7251: '%pcf of %cn, %hnr, a %ra.',
};

function macroCtx(over = {}) {
  const opt = {
    toneIndex: 1, playerName: 'Mack Cothran', playerGender: 'male',
    playerRace: 'DarkElf', cityName: 'Daggerfall',
    reactionToPlayer: 10, nameNPC: 'Ryn Sethyl', ...over,
  };
  const tree = new TopicTree({ getQuest: () => null });
  const session = new NPCSession({});
  session.reactionToPlayer = opt.reactionToPlayer;
  session.nameNPC = opt.nameNPC;
  let ctx = null;
  const pipeline = new AnswerPipeline({
    tree,
    localizedText: (k) => TALK_STRINGS[k] ?? '',
    // ExpandRandomTextRecord (TalkManager.cs:3580-3587): the record's
    // tokens through the WHOLE macro table. %1com re-enters here, as
    // it does in C#.
    expandRandomTextRecord: (id) => expandRandomTextRecord(id, ctx),
    rolls: () => 0.5,
  });
  ctx = {
    pipeline,
    session,
    randomTokens: (id) => [{ text: RECORDS[id] ?? `record:${id}`, formatting: 1, x: 0, y: 0 }],
    localizedText: (k) => TALK_STRINGS[k] ?? '',
    toneIndex: () => opt.toneIndex,
    cityName: () => opt.cityName,
    playerName: () => opt.playerName,
    playerGender: () => opt.playerGender,
    playerRace: () => opt.playerRace,
  };
  return ctx;
}

test('audit26 talk F094: %1com opens every question with the PC greeting, then the follow-up', () => {
  // The six globals are IN the table ExpandRandomTextRecord runs -
  // MacroHelper.cs:44 (%1com), :151 (%pcf), :152 (%pcn), :67 (%cn),
  // :111 (%hnr), :210 (%ra).
  for (const m of ['%1com', '%pcf', '%pcn', '%cn', '%hnr', '%ra']) {
    assert.ok(TALK_MACROS.includes(m), `${m} is a MacroHelper symbol talk records carry`);
  }

  // GetPCGreetingText (TalkManager.cs:1133-1142): reaction ABOVE zero
  // addresses the NPC by name, and the greeting record is 7215 + tone.
  const liked = macroCtx();
  const item = newListItem({ questionType: QUESTION_TYPE.LocalBuilding, caption: 'The Odd Blades', buildingKey: 7 });
  assert.equal(liked.pipeline.getQuestionText(item, 1),
    'Hail to thee Ryn Sethyl. Where is The Odd Blades?');
  // greetingNameNPC is a LIVE slot: filled before the expansion and
  // cleared straight after (:1136-1140).
  assert.equal(liked.pipeline.greetingNameNPC, '');

  // reaction <= 0 draws the stranger record 7221 + tone instead of
  // the NPC's name.
  const stranger = macroCtx({ reactionToPlayer: 0 });
  assert.equal(stranger.pipeline.getQuestionText(item, 1),
    'Hail to thee stranger. Where is The Odd Blades?');

  // GetPCGreetingOrFollowUpText (:1149-1156): only the FIRST question
  // of a conversation opens with the greeting; later ones take
  // 7218 + tone.
  const later = macroCtx();
  later.pipeline.numQuestionsAsked = 1;
  assert.equal(later.pipeline.getQuestionText(item, 1),
    'Excuse me again. Where is The Odd Blades?');

  // and the tone the window is set to picks the record, all three of
  // them (7225/7215 + TalkToneToIndex)
  const blunt = macroCtx({ toneIndex: 2 });
  assert.equal(blunt.pipeline.getQuestionText(item, 2), 'record:7227');
});

test('audit26 talk F094: %pcf/%pcn/%cn/%hnr/%ra resolve to their MacroHelper sources', () => {
  const ctx = macroCtx();
  const h = talkMacroHandlers(ctx);
  // PlayerFirstname (:784-787) is GetFirstname over PlayerEntity.Name;
  // PlayerName (:779-782) is the whole of it.
  assert.equal(h['%pcf'](), 'Mack');
  assert.equal(h['%pcn'](), 'Mack Cothran');
  // CityName (:566-573)
  assert.equal(h['%cn'](), 'Daggerfall');
  // Honorific (:890-893) -> TalkManager.GetHonoric (:1826-1832)
  assert.equal(h['%hnr'](), TALK_STRINGS.Sir);
  assert.equal(talkMacroHandlers(macroCtx({ playerGender: 'female' }))['%hnr'](), TALK_STRINGS["Ma'am"]);
  // PlayerRace (:942-945) - the BIRTH race template's display name,
  // and the elves are two words
  assert.equal(h['%ra'](), 'Dark Elf');
  assert.equal(talkMacroHandlers(macroCtx({ playerRace: 'Khajiit' }))['%ra'](), 'Khajiit');

  // and a whole record through ExpandRandomTextRecord - no blank slots
  assert.equal(expandRandomTextRecord(7251, ctx), 'Mack of Daggerfall, Sir, a Dark Elf.');
});

// ---------------------------------------------------------------
// F087 / F091 - the mobile click IS TalkToMobileNPC.
// ---------------------------------------------------------------

/** The region's People faction, whose parent is a Province - so
 *  GetNPCGreetingRecord takes the plain reaction ladder (:985-989)
 *  rather than the guild table's random roll. */
const PEOPLE_FACTION = Object.freeze({
  id: 100, parent: 200, type: FACTION_TYPE.People, rep: 0, sgroup: 0, ggroup: 0,
  name: 'People of Daggerfall', ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
});
const PROVINCE_FACTION = Object.freeze({
  id: 200, parent: 0, type: FACTION_TYPE.Province, rep: 0, sgroup: 0, ggroup: 0,
  name: 'Daggerfall', ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
});

function mobileSession(log) {
  return new NPCSession({
    factionData: (id) => (id === 100 ? PEOPLE_FACTION : (id === 200 ? PROVINCE_FACTION : null)),
    peopleOfCurrentRegion: () => 100,
    reactionToPlayer: () => 10,
    expandRandomTextRecord: (id) => `record:${id}`,
    randomTokens: (id) => [{ text: `record:${id}`, formatting: 1, x: 0, y: 0 }],
    resetNPCKnowledge: () => { log.resetKnowledge++; },
    assembleTopicListPerson: () => { log.assemblePerson++; },
    resetQuestionSession: () => { log.resetQuestions++; },
    setupRumorMill: () => { log.setupMill++; },
    resetToneSession: () => {},
    messageBox: (x) => { log.box.push(x); },
    pushTalkWindow: () => { log.pushed++; },
  });
}

async function townTalkWithEngine(session) {
  const tt = createTownTalk({
    renderer: { uploadTexture: () => ({}) },
    canvas: { width: 320, height: 200 },
    fetchBytes: async () => { throw new Error('headless: no ARENA2'); },
    playerEntity: { name: 'Mack Cothran', gender: 'male', race: 'Breton', stats: { personality: 50 } },
    regionIndex: 17,
    palette: null,
    rolls: () => 0.5,
    talkEngine: () => ({ session, pipeline: null, tree: null, mill: null }),
  });
  await tt.ensureLoaded();
  return tt;
}

test('audit26 talk F087/F091: a street click runs TalkToMobileNPC, not a bare greeting', async () => {
  const log = { resetKnowledge: 0, assemblePerson: 0, resetQuestions: 0, setupMill: 0, pushed: 0, box: [] };
  const session = mobileSession(log);
  const tt = await townTalkWithEngine(session);

  // What the LAST static NPC left on the session: a Nobility
  // spymaster whose one tell-me-about answer is already spent
  // (TalkManager.cs:833-865 + :2054).
  session.currentNPCType = NPC_TYPE.Static;
  session.npcData = newNPCData({
    socialGroup: SOCIAL_GROUP.Nobility, guildGroup: 3, race: 'Redguard', isSpyMaster: true,
  });
  session.npcData.numAnswersGivenTellMeAboutOrRumors = 1;
  session.alreadyRejectedOnce = true;

  const person = { nameNPC: 'Ryn Sethyl', personFaceRecordId: 4, pos: [0, 0, 5] };
  assert.equal(tt.tryActivate([0, 1, 0], [0, 0, 1], [{ person, pos: [0, 0, 5] }]), true);
  await new Promise((res) => setTimeout(res, 0));

  // TalkToMobileNPC (:726-744): the region's People faction, a fresh
  // NPCData built by SetTargetNPC's mobile overload (:805-831) -
  // "All mobile NPCs use 'People of' current region faction", every
  // one of them a Commoner of no guild and no spymaster.
  assert.equal(session.currentNPCType, NPC_TYPE.Mobile);
  assert.equal(session.lastTargetMobileNPC, person);
  assert.equal(session.nameNPC, 'Ryn Sethyl');
  assert.equal(session.npcData.socialGroup, SOCIAL_GROUP.Commoners);
  assert.equal(session.npcData.guildGroup, 0);
  assert.equal(session.npcData.isSpyMaster, false);
  assert.equal(session.npcData.factionData, PEOPLE_FACTION);
  // ":742 - Important to reset this here so even if NPC is the same as
  // previous talk session PC will give one correct answer"
  assert.equal(session.npcData.numAnswersGivenTellMeAboutOrRumors, 0);
  // SetTargetNPC clears the standing rejection for a NEW target
  assert.equal(session.alreadyRejectedOnce, false);
  // TalkToNpc (:2652-2654): a new target re-rolls per-topic knowledge,
  // and the window is pushed
  assert.equal(log.resetKnowledge, 1);
  assert.equal(log.pushed, 1);
  // StartNewConversation (:867-878) rides the push
  assert.equal(log.resetQuestions, 1);
  assert.equal(log.setupMill, 1);

  // A REPEAT click on the same walker is SetTargetNPC's no-op arm
  // (:808-812): the NPCData survives - but :742 still lands on it, so
  // the one-answer counter is zeroed again.
  session.npcData.numAnswersGivenTellMeAboutOrRumors = 1;
  const kept = session.npcData;
  tt.keydown({ code: 'Escape', preventDefault() {} });
  tt.tryActivate([0, 1, 0], [0, 0, 1], [{ person, pos: [0, 0, 5] }]);
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(session.sameTalkTargetAsBefore, true);
  assert.equal(session.npcData, kept);
  assert.equal(session.npcData.numAnswersGivenTellMeAboutOrRumors, 0);
  // sameTalkTargetAsBefore, so NO knowledge re-roll this time
  assert.equal(log.resetKnowledge, 1);
});
