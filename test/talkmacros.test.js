// TK-v - TALKMANAGERMCP: the macro data source every talk record is
// expanded through, and the reader that finally makes the arc's two
// LIVE SLOTS observable. TK-iii found markLocationOnMap (%loc) and
// greetingNameNPC (%n) filled and cleared around a single expansion,
// and fixed the port to do it at C#'s moments; nothing read them,
// because nothing had ported the reader. This is the reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  talkMacroHandlers, expandTalkMacros, expandRandomTextRecord,
  TALK_MACROS, OATH_BASE_TEXT_ID, MACRO_TERMINATORS,
} from '../src/systems/talkMacros.js';
import { AnswerPipeline, TALK_STRINGS } from '../src/systems/answerPipeline.js';
import { NPCSession } from '../src/systems/npcSession.js';
import { TopicTree, QUESTION_TYPE, newListItem, QUEST_INFO_RESOURCE_TYPE } from '../src/systems/topicTree.js';
import { OATH_RACE_INDEX } from '../src/systems/talkSession.js';

const t = (text) => ({ text, formatting: 1, x: 0, y: 0 });

function makeCtx(over = {}) {
  const tree = new TopicTree({ getQuest: () => null });
  const pipeline = new AnswerPipeline({
    tree,
    localizedText: (k) => TALK_STRINGS[k] ?? '',
    expandRandomTextRecord: (id) => `record:${id}`,
    buildingCompassDirection: (k) => `north:${k}`,
    rolls: () => 0.9,
    ...(over.pipeline ?? {}),
  });
  const session = new NPCSession({});
  return {
    pipeline, session, tree,
    localizedText: (k) => TALK_STRINGS[k] ?? '',
    randomTokens: (id) => [t(`R${id}`)],
    randomText: (id) => `text:${id}`,
    randomFullName: () => 'A Stranger',
    fullName: (gender) => `${gender}-name`,
    raceOfCurrentRegion: () => 'Breton',
    factionRaceId: (race) => OATH_RACE_INDEX[race] ?? 0,
    questorGender: () => 'male',
    bumpSeed: () => {},
    ...over,
  };
}

test('the macro token set is the talk MCP-s thirteen overrides', () => {
  assert.deepEqual([...TALK_MACROS].sort(), [
    '%di', '%fn', '%g', '%g2', '%g3', '%g4', '%hnt', '%hnt2', '%mn', '%n', '%oth', '%pqn', '%pqp',
  ].sort());
  assert.equal(OATH_BASE_TEXT_ID, 201);
});

test('THE %n SLOT, finally read: the greeting name when it is live, a RANDOM name when it is not', () => {
  const ctx = makeCtx();
  const h = talkMacroHandlers(ctx);
  assert.equal(h['%n'](), 'A Stranger', 'an empty slot draws a random full name - never nothing');
  ctx.pipeline.greetingNameNPC = 'Sirien';
  assert.equal(h['%n'](), 'Sirien', 'and a live slot is the NPC');
  // ...which is exactly the moment the greeting record expands
  const seen = [];
  const pipe = new AnswerPipeline({
    expandRandomTextRecord: (id) => {
      seen.push(expandTalkMacros([t('Hail, %n.')], talkMacroHandlers({ ...ctx, pipeline: pipe }))[0].text);
      return `record:${id}`;
    },
  });
  pipe.getPCGreetingOrFollowUpText(0, 1, 'Sirien');
  assert.deepEqual(seen, ['Hail, Sirien.'], 'the greeting expands WITH the name in the slot');
  const after = expandTalkMacros([t('Hail, %n.')], talkMacroHandlers({ ...ctx, pipeline: pipe }));
  assert.equal(after[0].text, 'Hail, A Stranger.', 'and the very next expansion no longer has it');
});

test('%di answers the compass for the two where-is types, and the resolving error for the rest', () => {
  const ctx = makeCtx();
  const h = talkMacroHandlers(ctx);
  ctx.pipeline.currentKeySubjectBuildingKey = 42;
  for (const qt of [QUESTION_TYPE.LocalBuilding, QUESTION_TYPE.Person]) {
    ctx.pipeline.currentQuestionListItem = newListItem({ questionType: qt });
    assert.equal(h['%di'](), 'north:42', `question type ${qt}`);
  }
  for (const qt of [QUESTION_TYPE.QuestLocation, QUESTION_TYPE.News, QUESTION_TYPE.Work, QUESTION_TYPE.OrganizationInfo]) {
    ctx.pipeline.currentQuestionListItem = newListItem({ questionType: qt });
    assert.equal(h['%di'](), '...never mind...', `question type ${qt} has no direction`);
  }
});

test('%hnt and %hnt2 share every arm but the quest one', () => {
  const ctx = makeCtx();
  const h = talkMacroHandlers(ctx);
  // the building fork is identical in both
  ctx.pipeline.currentQuestionListItem = newListItem({ questionType: QUESTION_TYPE.LocalBuilding });
  assert.equal(h['%hnt'](), h['%hnt2'](), 'a building hint is the same macro twice');
  // the organization arm too
  ctx.pipeline.currentQuestionListItem = newListItem({ questionType: QUESTION_TYPE.OrganizationInfo, index: 0 });
  assert.equal(h['%hnt'](), 'record:860');
  assert.equal(h['%hnt2'](), 'record:860');
  // ...and the QUEST arm is where they part: anyInfo vs rumors
  ctx.tree.addQuestTopicWithInfoAndRumors(1, { isPlace: true, symbol: { name: 'l' } }, 'l',
    QUEST_INFO_RESOURCE_TYPE.Location, [[t('the any-info answer')]], [[t('the rumor')]]);
  ctx.pipeline.currentQuestionListItem = newListItem({ questionType: QUESTION_TYPE.QuestLocation, questID: 1, key: 'l' });
  assert.match(h['%hnt'](), /any-info/, '%hnt reads anyInfo');
  assert.match(h['%hnt2'](), /rumor/, '%hnt2 reads the rumors');
  // an unknown type is the resolving error in both
  ctx.pipeline.currentQuestionListItem = newListItem({ questionType: QUESTION_TYPE.News });
  assert.equal(h['%hnt'](), '...never mind...');
  assert.equal(h['%hnt2'](), '...never mind...');
});

test('THE MALE-NAME SEED NUDGE: +3547 before the draw and -3547 after, leaving the stream where it was', () => {
  const bumps = [];
  const ctx = makeCtx({ bumpSeed: (d) => bumps.push(d) });
  const h = talkMacroHandlers(ctx);
  assert.equal(h['%mn'](), 'male-name');
  assert.deepEqual(bumps, [3547, -3547], 'the nudge is undone, so the stream is untouched');
  bumps.length = 0;
  assert.equal(h['%fn'](), 'female-name');
  assert.deepEqual(bumps, [], 'and the FEMALE name does not nudge at all - only the male one does');
});

test('%oth reads the NPC-s FACTION race, falling back to the region-s - DFUs fix for classic', () => {
  const ctx = makeCtx();
  const h = talkMacroHandlers(ctx);
  // FactionRaces (FactionFile.cs:609-623) is Nord 0, Khajiit 1,
  // Redguard 2, Breton 3 - NOT the player-race order
  assert.deepEqual({ ...OATH_RACE_INDEX }, {
    Nord: 0, Khajiit: 1, Redguard: 2, Breton: 3,
    Argonian: 4, WoodElf: 5, HighElf: 6, DarkElf: 7,
  });
  assert.equal(h['%oth'](), 'text:204', 'no NPC race falls back to the region - Breton, faction race 3');
  ctx.session.npcData.race = 'Nord';
  assert.equal(h['%oth'](), 'text:201', 'a Nord swears Nord oaths - 201 + faction race 0');
  ctx.session.npcData.race = 'Khajiit';
  assert.equal(h['%oth'](), 'text:202', 'and a Khajiit the Khajiit ones, which is DFUs whole fix');
  ctx.session.npcData.race = 'DarkElf';
  assert.equal(h['%oth'](), 'text:208');
});

test('the four pronouns are the POTENTIAL QUESTORs gender, and anything but female is he', () => {
  const male = talkMacroHandlers(makeCtx({ questorGender: () => 'male' }));
  const female = talkMacroHandlers(makeCtx({ questorGender: () => 'female' }));
  const none = talkMacroHandlers(makeCtx({ questorGender: () => null }));
  assert.deepEqual(['%g', '%g2', '%g3', '%g4'].map((m) => male[m]()), ['he', 'him', 'his', 'his']);
  assert.deepEqual(['%g', '%g2', '%g3', '%g4'].map((m) => female[m]()), ['she', 'her', 'her', 'hers']);
  assert.deepEqual(['%g', '%g2', '%g3', '%g4'].map((m) => none[m]()), ['he', 'him', 'his', 'his'],
    'C#s `default:` shares the Male case');
});

test('%pqn and %pqp read the questor pool, and answer empty when it is bare', () => {
  const ctx = makeCtx();
  const h = talkMacroHandlers(ctx);
  assert.equal(h['%pqn'](), '', 'no questor, no name');
  assert.equal(h['%pqp'](), '', 'no questor, no location');
  ctx.session.deps.fullName = (bank, gender) => `${bank}/${gender}`;
  ctx.session.npcsWithWork.set(7, { npc: { nameSeed: 7, nameBank: 'Breton', gender: 'female' }, socialGroup: 1, buildingName: 'The Inn' });
  ctx.session.selectedNpcWorkKey = 7;
  assert.equal(h['%pqn'](), 'Breton/female');
  assert.equal(h['%pqp'](), 'The Inn');
  // MacroHelper.cs:162-163 - the questor LOCATION is %pqp, not %pql
  assert.equal(Object.hasOwn(h, '%pql'), false, '%pql is not a DFU macro at all');
});

test('expandTalkMacros is a TERMINATOR SCAN, in place, and leaves plain text alone', () => {
  const ctx = makeCtx();
  ctx.pipeline.currentQuestionListItem = newListItem({ questionType: QUESTION_TYPE.LocalBuilding });
  const tokens = [t('%n says: %g4 and %g.'), t(''), t('no macros here')];
  const out = expandTalkMacros(tokens, talkMacroHandlers(ctx));
  assert.equal(out, tokens, 'the SAME array, as C#s ref is');
  assert.equal(tokens[0].text, 'A Stranger says: his and he.',
    '%g4 and %g are told apart by the terminator scan, not by any ordering');
  assert.equal(tokens[1].text, '', 'a token with no % is skipped');
  assert.equal(tokens[2].text, 'no macros here');
  // the terminator set, from MacroHelper.cs:412
  assert.deepEqual([...MACRO_TERMINATORS], [
    ' ', '%', '.', ',', "'", '?', '!', '/', '(', ')', '{', '}', '[', ']', '"', ';', ':', '|',
  ]);
});

test('THE MACRO CACHE: a macro is evaluated ONCE per call, however often it appears', () => {
  // C#'s own comment: "used to ensure macros are only evaluated once
  // per ExpandMacros() call. Important since some macros evaluate
  // differently each time (e.g. macros with random generated names)".
  // A record naming %fn twice names the SAME woman twice.
  let n = 0;
  const handlers = { '%fn': () => `woman${++n}`, '%mn': () => `man${++n}` };
  const tokens = [t('%fn and %fn'), t('and %fn again, with %mn')];
  expandTalkMacros(tokens, handlers);
  assert.equal(tokens[0].text, 'woman1 and woman1', 'twice in one token is one draw');
  assert.equal(tokens[1].text, 'and woman1 again, with man2',
    'and ACROSS tokens too - the cache is per CALL, not per token');
  // a second call starts a fresh cache
  const more = [t('%fn')];
  expandTalkMacros(more, handlers);
  assert.equal(more[0].text, 'woman3', 'a new expansion draws again');
});

test('THE PIPE IS EATEN: %di|ern becomes southern, and every other terminator survives', () => {
  const handlers = { '%di': () => 'south', '%n': () => 'Sirien' };
  const tokens = [t('%di|ern of here'), t('%di, %n. %n! (%n)')];
  expandTalkMacros(tokens, handlers);
  assert.equal(tokens[0].text, 'southern of here', 'the | terminates the macro AND is swallowed');
  assert.equal(tokens[1].text, 'south, Sirien. Sirien! (Sirien)',
    'a comma, a full stop, a bang and a bracket all terminate and all survive');
});

test('an unknown macro resolves to the empty string, as MacroHelpers missing-handler path does', () => {
  const tokens = [t('a %nosuchmacro b')];
  expandTalkMacros(tokens, { '%n': () => 'x' });
  assert.equal(tokens[0].text, 'a  b', 'the symbol goes, the surrounding text stays');
});

test('expandRandomTextRecord: draw, expand, and convert with NO separator', () => {
  const ctx = makeCtx({ randomTokens: () => [t('You want '), t(''), t('%n.')] });
  assert.equal(expandRandomTextRecord(7215, ctx), 'You want A Stranger.',
    'TokensToString(tokens, FALSE) - an empty token contributes nothing, not a space');
  // and the STORED tokens are not touched: C# draws a fresh random
  // variant each time, so the copy is what gets rewritten
  const stored = [t('%n')];
  const ctx2 = makeCtx({ randomTokens: () => stored });
  expandRandomTextRecord(1, ctx2);
  assert.equal(stored[0].text, '%n', 'the record the provider handed back is left as it was');
});

test('THE MAP-REVEAL SLOT is up while %hnt expands, which is the only moment it exists', () => {
  // markLocationOnMap is TK-iii's other live slot: GetKeySubjectBuildingOnMap
  // raises it, the expansion of the reveal record reads it through
  // %loc, and it is down again the instant the answer is in hand.
  const seen = [];
  const pipeline = new AnswerPipeline({
    expandRandomTextRecord: (id) => { seen.push([id, pipeline.markLocationOnMap]); return `record:${id}`; },
    rolls: () => 0.1,   // below the 0.35 chance: the MAP arm
  });
  const ctx = makeCtx({ pipeline });
  ctx.pipeline = pipeline;
  pipeline.currentQuestionListItem = newListItem({ questionType: QUESTION_TYPE.LocalBuilding });
  const h = talkMacroHandlers(ctx);
  h['%hnt']();
  assert.deepEqual(seen, [[7332, true]], 'the reveal record expands with the flag UP');
  assert.equal(pipeline.markLocationOnMap, false, 'and it is down again immediately');
});

test('the quest-type test is an OR of THREE: each of the three reaches the dialog hint alone', () => {
  const ctx = makeCtx();
  const h = talkMacroHandlers(ctx);
  ctx.tree.addQuestTopicWithInfoAndRumors(1, { isPlace: true, symbol: { name: 'l' } }, 'l',
    QUEST_INFO_RESOURCE_TYPE.Location, [[t('any-info')]], [[t('rumor')]]);
  for (const qt of [QUESTION_TYPE.QuestLocation, QUESTION_TYPE.QuestPerson, QUESTION_TYPE.QuestItem]) {
    ctx.pipeline.currentQuestionListItem = newListItem({ questionType: qt, questID: 1, key: 'l' });
    assert.match(h['%hnt'](), /any-info/, `question type ${qt} reaches GetDialogHint alone`);
    assert.match(h['%hnt2'](), /rumor/, `question type ${qt} reaches GetDialogHint2 alone`);
  }
});

test('an absent factionRaceId seam is race 0 - the Nord oath, not the Khajiit one', () => {
  const ctx = makeCtx({ factionRaceId: undefined });
  const h = talkMacroHandlers(ctx);
  assert.equal(h['%oth'](), 'text:201', 'no seam reads faction race 0, which is Nord');
});

test('a token with NO text is skipped rather than scanned - C#s `tokenText != null` guard', () => {
  // the two halves of the skip are ORed: not a string, OR no % in it.
  // A null-text token must not reach indexOf at all.
  const tokens = [{ text: null }, { text: undefined }, {}, t('plain'), t('%n')];
  expandTalkMacros(tokens, { '%n': () => 'Sirien' });
  assert.equal(tokens[0].text, null, 'a null text is left exactly as it was');
  assert.equal(tokens[1].text, undefined);
  assert.equal(tokens[3].text, 'plain', 'and a string with no % is left alone too');
  assert.equal(tokens[4].text, 'Sirien');
});

test('the scan starts ONE past the %, so a bare % followed by a terminator consumes only itself', () => {
  const tokens = [t('a %. b'), t('50%, and %n')];
  expandTalkMacros(tokens, { '%n': () => 'Sirien' });
  assert.equal(tokens[0].text, 'a . b', 'the % goes, the full stop stays - it TERMINATED the name');
  assert.equal(tokens[1].text, '50, and Sirien', 'and a percent sign in prose eats only itself');
});
