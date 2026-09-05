// TK-v - TALKMANAGERMCP: the macro data source every talk record is
// expanded through, and the reader that finally makes the arc's two
// LIVE SLOTS observable. TK-iii found markLocationOnMap (%loc) and
// greetingNameNPC (%n) filled and cleared around a single expansion,
// and fixed the port to do it at C#'s moments; nothing read them,
// because nothing had ported the reader. This is the reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, existsSync } from 'node:fs';

import {
  talkMacroHandlers, talkMacroSource, expandTalkMacros, expandRandomTextRecord,
  TALK_MACROS, TALK_SOURCE_METHODS, MACRO_SYMBOLS, OATH_BASE_TEXT_ID, MACRO_TERMINATORS,
} from '../src/systems/talkMacros.js';
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone
import { AnswerPipeline, TALK_STRINGS } from '../src/systems/answerPipeline.js';
import { NPCSession } from '../src/systems/npcSession.js';
import { TopicTree, QUESTION_TYPE, newListItem, QUEST_INFO_RESOURCE_TYPE } from '../src/systems/topicTree.js';
import { OATH_RACE_INDEX, raceDisplayName } from '../src/systems/talkSession.js';

const h2 = (ctx) => talkMacroHandlers(ctx);
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

/** The ONE GameManager the table's GLOBAL rows read - the shape the
 *  host hands in as ctx.hooks (the quest machine's macroContext). */
const HOOKS = {
  playerName: () => 'Wobbles Ironfoot',
  // the host mount's own expression (world.js:5342), so the pin sees
  // the CamelCase entity key travel through RaceTemplate.Name and not
  // a pre-spaced literal
  playerRaceName: () => raceDisplayName('DarkElf'),
  playerGender: () => 'male',
  getGoldPieces: () => 317,
  nowSeconds: () => (1 * 1440 + 65) * 60,   // day 1, 01:05
  world: {
    currentLocation: () => ({ loaded: true, name: 'Daggerfall' }),
    maps: { getRegion: () => ({ name: 'Betony' }) },
    currentRegionIndex: () => 17,
    currentLocationType: () => 0,      // DFRegion.LocationTypes.TownCity
    currentRegionRace: () => 1,        // RaceTemplate id 1 = Breton -> High Rock
    legalRepNow: () => 11,
    factionNPCAlly: () => 'the allies',
    factionNPCEnemy: () => 'the enemies',
    factionPC: () => 'the PC faction',
    factionName: () => 'Kynareth',
  },
};

/** One symbol through the whole walk, as a talk record carries it. */
const expandOne = (ctx, symbol) => {
  const tokens = [t(symbol)];
  expandTalkMacros(tokens, talkMacroHandlers(ctx));
  return tokens[0].text;
};

test('E7: the MCP-s thirteen overrides, and the twenty-three table rows C# points at them', () => {
  // TalkManagerDataSource overrides exactly thirteen methods
  // (TalkManagerMCP.cs:49-199). Everything else the base class throws
  // NotImplementedException for, which is the ladder's
  // [srcDataUnknown] arm - so this list IS the talk MCP's surface.
  assert.deepEqual(Object.keys(talkMacroSource(makeCtx())).sort(), [...TALK_SOURCE_METHODS].sort());
  assert.equal(TALK_SOURCE_METHODS.length, 13);
  // and the rows C# points at them - note the SHARING: Name answers
  // %n/%nam/%bn, FemaleName %fn/%fn2, MaleName %mn/%mn2, and each
  // Pronoun answers its lowercase row AND its CapFirst twin
  // (MacroHelper.cs:236-241). %g2self is deliberately NOT here: the
  // talk source does not override Pronoun2self.
  assert.deepEqual([...TALK_MACROS].sort(), [
    '%n', '%nam', '%bn', '%fn', '%fn2', '%mn', '%mn2',
    '%di', '%hnt', '%hnt2', '%oth',
    '%g', '%g1', '%G', '%G1', '%g2', '%G2', '%g3', '%G3', '%g4', '%G4',
    '%pqn', '%pqp',
  ].sort());
  assert.equal(OATH_BASE_TEXT_ID, 201);
  // ...and the HANDLER TABLE the expansion runs is MacroHelper's
  // whole dictionary, not the twenty-six rows this module used to
  // carry. %pql is still not a DFU macro at all.
  const h = talkMacroHandlers(makeCtx());
  assert.equal(Object.keys(h).length, 217, 'MacroHelper.cs carries 217 rows and so does the talk MCP');
  assert.equal(Object.hasOwn(h, '%pql'), false, '%pql is not a DFU macro at all');
  assert.deepEqual([...MACRO_SYMBOLS].sort(), Object.keys(h).sort());
});

test('E7 GATE: every handler name in MacroHelper.cs-s dictionary is in the talk MCP-s table', (t) => {
  // the SOURCE SWEEP the slice asks for: the C# dictionary itself,
  // extracted row by row and diffed against what talkMacroHandlers
  // hands back. The symbol class is `*` so the bare '%' row
  // ({ "%", Percent }, MacroHelper.cs:243) is caught too.
  const MH = dfuFile('Assets/Scripts/Utility/MacroHelper.cs');
  if (!existsSync(MH)) {
    t.skip('DFU sparse clone absent (tools/parity/prepare.sh) - the sweep needs the source tree');
    return;
  }
  const rows = [...new Set([...readFileSync(MH, 'utf8').matchAll(/\{\s*"(%[a-zA-Z0-9]*)",\s*(\w+)\s*\}/g)].map((m) => m[1]))];
  assert.equal(rows.length, 217);
  const h = talkMacroHandlers(makeCtx());
  assert.deepEqual(rows.filter((r) => !Object.hasOwn(h, r)), [], 'no C# row is missing from the talk table');
  assert.deepEqual(Object.keys(h).filter((k) => !rows.includes(k)), [], 'and the table invents none');
});

test('TK-vi: %key switches on the key-subject TYPE, %loc marks the map, %fcn names the town', () => {
  const ctx = makeCtx();
  const h = talkMacroHandlers(ctx);
  const p = ctx.pipeline;
  p.currentKeySubject = 'The Odd Blades';
  // the four arms that answer the field itself
  for (const t of ['Building', 'Person', 'Thing', 'Organization']) {
    p.currentKeySubjectType = t;
    assert.equal(h['%key'](), 'The Odd Blades', `${t} answers CurrentKeySubject`);
  }
  // Unset - and C#'s shared `default:` - is the empty string
  p.currentKeySubjectType = 'Unset';
  assert.equal(h['%key'](), '');
  p.currentKeySubjectType = 'Nonsense';
  assert.equal(h['%key'](), '', "the default arm C# shares with Unset");
  // Work goes through GetWorkString
  p.currentKeySubjectType = 'Work';
  p.getWorkString = () => 'a job';
  assert.equal(h['%key'](), 'a job');
  // QuestTopic prefers the list item's caption, and falls back
  p.currentKeySubjectType = 'QuestTopic';
  p.currentQuestionListItem = { caption: 'the Sentinel job' };
  assert.equal(h['%key'](), 'the Sentinel job');
  p.currentQuestionListItem = null;
  assert.equal(h['%key'](), 'The Odd Blades', 'no item: the field');

  // %loc answers the key subject EITHER WAY, and marks the map only
  // when the flag the map-reveal record raised is still up.
  let marked = 0;
  p.markKeySubjectLocationOnMap = () => { marked++; };
  p.markLocationOnMap = false;
  assert.equal(h2(ctx)['%loc'](), 'The Odd Blades');
  assert.equal(marked, 0, 'the direction record reveals nothing');
  p.markLocationOnMap = true;
  assert.equal(h2(ctx)['%loc'](), 'The Odd Blades');
  assert.equal(marked, 1, 'the map-reveal record marks it');

  // %fcn is the regional answer's town
  p.locationOfRegionalBuilding = 'Tulune';
  assert.equal(h2(ctx)['%fcn'](), 'Tulune');
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

test('E7: a symbol the table does not carry is `[undefined]`, GetValue-s outermost else', () => {
  // MacroHelper.GetValue (:526-527): `return symbolStr +
  // "[undefined]"`. This walk used to substitute the EMPTY STRING for
  // every symbol its own twenty-six-row table missed - which deleted
  // ~190 macros DFU renders for real out of talk records and made all
  // four of C#-s error shapes unreachable. It was FLAGGED as blocked
  // on exactly that: the shape is only safe to speak once the table
  // is whole. It is.
  const tokens = [t('a %nosuchmacro b')];
  expandTalkMacros(tokens, { '%n': () => 'x' });
  assert.equal(tokens[0].text, 'a %nosuchmacro[undefined] b', 'the symbol stays and says so');
  // and through the real table, where only a genuine non-macro lands here
  const real = [t('a %nosuchmacro b')];
  expandTalkMacros(real, talkMacroHandlers(makeCtx()));
  assert.equal(real[0].text, 'a %nosuchmacro[undefined] b');
});

test('E7: the FOUR SENTINELS of GetValue, each reachable through the talk MCP', () => {
  const h = talkMacroHandlers(makeCtx());
  // 1. the table does not carry it
  assert.equal(expandOne(makeCtx(), '%zzz'), '%zzz[undefined]');
  // 2. the table carries it with a NULL handler (MacroHelper.cs:43 and
  //    the nineteen others) - '[unhandled]'
  assert.equal(h['%hol'](), '%hol[unhandled]');
  assert.equal(h['%wpn'](), '%wpn[unhandled]');
  assert.equal(h['%tcn'](), '%tcn[unhandled]', 'C#-s row IS null; the travel window-s own Replace is not this table');
  // 3. the handler answers null - '[nullMCP]'. %map is
  //    PlayerGPS.LocationRevealedByMapItem and no talk context has one.
  assert.equal(h['%map'](), '%map[nullMCP]');
  // 4. the source method is NotImplemented and the SECOND provider
  //    (null, in an ExpandMacros call) misses too - '[srcDataUnknown]'.
  //    This is the whole of MacroDataSource-s base class seen from a
  //    talk record: the talk source overrides thirteen methods and
  //    the other hundred-odd rows land here.
  assert.equal(h['%str'](), '%str[srcDataUnknown]', 'no Str override on the talk source');
  assert.equal(h['%q7b'](), '%q7b[srcDataUnknown]', 'the biography block');
  assert.equal(h['%wep'](), '%wep[srcDataUnknown]', 'the item block');
  assert.equal(h['%vcn'](), '%vcn[srcDataUnknown]');
  assert.equal(h['%g2self'](), '%g2self[srcDataUnknown]',
    'Pronoun2self is the ONE pronoun TalkManagerDataSource does not override');
  assert.equal(h['%G2self'](), '%G2self[srcDataUnknown]', 'and its CapFirst twin with it');
});

test('E7: %lev and %pct are ONE C# row, so both fall through to the PLAYER-s name', () => {
  // GuildTitle (MacroHelper.cs:1131-1136) opens `if (mcp == null)
  // return GameManager.Instance.PlayerEntity.Name`. The talk source
  // has no GuildTitle override, so GetValue catches the
  // NotImplementedException and re-invokes the handler with the
  // SECOND provider - null - which lands on that very arm. Both rows
  // point at the one handler, so both answer the name; the port had
  // given %lev the bare call-through and it answered a sentinel.
  const h = talkMacroHandlers(makeCtx({ hooks: { playerName: () => 'Wobbles Ironfoot' } }));
  assert.equal(h['%pct'](), 'Wobbles Ironfoot');
  assert.equal(h['%lev'](), 'Wobbles Ironfoot');
});

test('E7: the GLOBAL families answer off the ONE GameManager the host hands in', () => {
  const ctx = makeCtx({ hooks: HOOKS });
  const h = talkMacroHandlers(ctx);
  // the player identity block (PlayerName :779, GetFirstname/GetLastname)
  assert.equal(h['%pcn'](), 'Wobbles Ironfoot');
  assert.equal(h['%pcf'](), 'Wobbles');
  assert.equal(h['%pcl'](), 'Ironfoot', 'GetLastname is parts[1]');
  assert.equal(h['%ra'](), 'Dark Elf');
  // the date/time family (WorldTime.Now)
  assert.equal(h['%tim'](), '01:05', 'MinTimeString');
  assert.equal(h['%year'](), '404');
  assert.match(h['%dat'](), / the \d+(st|nd|rd|th) of \w/, 'Date is a GLOBAL - the world clock, not a quest-s');
  // the region/location family (PlayerGPS)
  assert.equal(h['%cn'](), 'Daggerfall');
  assert.equal(h['%crn'](), 'Betony');
  assert.equal(h['%ct'](), 'city');
  assert.equal(h['%lp'](), 'High Rock');
  // the faction/guild family (the TalkManager getters :1795-1824)
  assert.equal(h['%fa'](), 'the allies');
  assert.equal(h['%fe'](), 'the enemies');
  assert.equal(h['%fae'](), 'the enemies', "C#-s own asymmetry: %fae reads GetFactionNPCEnemy");
  assert.equal(h['%fpc'](), 'the PC faction');
  assert.equal(h['%fpa'](), 'Kynareth');
  // the gold / reputation / legal numbers
  assert.equal(h['%gii'](), '317', 'PlayerEntity.GoldPieces');
  assert.equal(h['%ltn'](), 'respected', "LegalReputation-s bands");
  // and the one-character row, which is not really a macro at all
  assert.equal(h['%'](), '%');
});

test('E7: the four TALK GLOBALS ride the pipeline - the port-s GameManager.TalkManager', () => {
  const ctx = makeCtx({ hooks: HOOKS });
  const p = ctx.pipeline;
  p.locationOfRegionalBuilding = 'Tulune';
  assert.equal(talkMacroHandlers(ctx)['%fcn'](), 'Tulune');
  // Honorific (:890-893) -> GetHonoric by the PLAYER-s gender
  assert.equal(talkMacroHandlers({ ...ctx, playerGender: () => 'male' })['%hnr'](), 'Sir');
  assert.equal(talkMacroHandlers({ ...ctx, playerGender: () => 'female' })['%hnr'](), "Ma'am");
  // GreetingOrFollowUpText (:957-960) - the PC-s own opening line,
  // which every question record 7225/7212/7231 + tone opens with
  assert.match(talkMacroHandlers(ctx)['%1com'](), /^record:/);
  // and with NO pipeline at all the four are simply absent: [nullMCP]
  const bare = talkMacroHandlers({ hooks: HOOKS });
  assert.equal(bare['%fcn'](), '%fcn[nullMCP]');
  assert.equal(bare['%hnr'](), '%hnr[nullMCP]');
  assert.equal(bare['%1com'](), '%1com[nullMCP]');
  assert.equal(bare['%key'](), '%key[nullMCP]');
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

test('E7: the scan starts ONE past the %, and the one-character row PRINTS a percent sign', () => {
  // MacroHelper.cs:243 `{ "%", Percent }` - "Not really a macro, just
  // print %". The scan finds it on its own, because '%' is itself a
  // MACRO_TERMINATOR: `%.` names the one-character symbol and leaves
  // the full stop. The port's table did not carry the row, so the
  // walk substituted the empty string and DELETED every literal
  // percent sign in talk text - "50%" reached the player as "50".
  const tokens = [t('a %. b'), t('50%, and %n')];
  expandTalkMacros(tokens, talkMacroHandlers(makeCtx({ pipeline: { greetingNameNPC: 'x' } })));
  assert.equal(tokens[0].text, 'a %. b', 'the % prints itself, the full stop TERMINATED it');
  assert.equal(tokens[1].text.startsWith('50%, and '), true, 'and a percent sign in prose survives');
  // a handler map without the row still takes the [undefined] arm
  const bare = [t('a %. b')];
  expandTalkMacros(bare, { '%n': () => 'Sirien' });
  assert.equal(bare[0].text, 'a %[undefined]. b');
});
