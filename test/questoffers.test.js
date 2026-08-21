// Q4-ii - THE OFFER FLOW: the questor click (SetLastNPCClicked /
// IsNPCDataEqual / IsLastNPCClickedAnActiveQuestor), the Yes/No
// offer prompt (CreateMessagePrompt), the social and guild offer
// doors (DaggerfallQuestOfferWindow + the guild popup's GetQuest
// override), the accept/refuse answer half with the three
// TalkManager scrubs, the quest picker with C#'s RemoveAt-by-
// original-index bug, and ExpandLetterSignoff. Every pin asserts DFU
// literals; the flow's steps are the headless window law.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine, QUEST_MESSAGES } from '../src/systems/quest/machine.js';
import { QuestListsManager } from '../src/systems/quest/questLists.js';
import { QuestOfferFlow, FAIL_QUEST_FLAVOUR_ID, GETTING_QUESTS_1, GETTING_QUESTS_2 } from '../src/systems/quest/offerFlow.js';
import { expandLetterSignoff, MACRO_TYPES } from '../src/systems/quest/questMacros.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { GUILD_GROUPS, SOCIAL_GROUPS } from '../src/formats/factionFile.js';
import { GENDERS } from '../src/characters/nameHelper.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

// The offerable quest: the three fixed offer messages + a bare QBN.
const OFFER_SRC = [
  'Quest: __OFR',
  'DisplayName: The Offered Errand',
  'QRC:',
  `QuestorOffer:  [${QUEST_MESSAGES.QuestorOffer}]`,
  '<ce> Would you fetch the thing?',
  '',
  `RefuseQuest:  [${QUEST_MESSAGES.RefuseQuest}]`,
  '<ce> Bah. Off with you.',
  '',
  `AcceptQuest:  [${QUEST_MESSAGES.AcceptQuest}]`,
  '<ce> Good. The thing awaits.',
  '',
  'Message:  1011',
  ' filler',
  '',
  'QBN:',
  'variable _done_',
];

// No QuestorOffer message: the drawn quest can show nothing.
const MUTE_SRC = [
  'Quest: __MUTE', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_',
];

// Header-only parse survives this; the full parse throws on the
// SECOND unrecognized QBN block ('Unknown line signature').
const BADQBN_SRC = [
  'Quest: __BADQBN', 'DisplayName: The Broken Errand', 'QRC:',
  'Message:  1011', ' x', '', 'QBN:',
  'gibberish first block', '', 'gibberish second block',
];

const NPC = Object.freeze({ hash: 11, mapID: 22, nameSeed: 4242, buildingKey: 33, factionID: 510, gender: GENDERS.Male });

const LIST_HEAD = 'schema: *name, group, membership, minReq, flag, notes';
const rowsOf = (...rows) => [LIST_HEAD, ...rows].join('\n');

function makeRig({ rows = rowsOf('__OFR, Commoners, N, 0, 0, x'), sources = { __OFR: OFFER_SRC }, deps = {}, level = 1, rep = 0 } = {}) {
  const calls = [];
  const cap = (name) => (...args) => { calls.push([name, ...args]); };
  let lists;
  const m = new QuestMachine({
    nowSeconds: () => 0,
    playerLevel: () => level,
    getReputation: (fid) => { calls.push(['getReputation', fid]); return rep; },
    removeQuestInfoTopics: cap('removeQuestInfoTopics'),
    removeQuestRumors: cap('removeQuestRumors'),
    removeProgressRumors: cap('removeProgressRumors'),
    onQuestStarted: (q) => { calls.push(['onQuestStarted', q.questName]); lists.noteQuestStarted(q); },
    addQuestTopics: cap('addQuestTopics'),
    lastNPCClicked: deps.lastNPCClicked,
  });
  lists = new QuestListsManager({
    readListTable: (name) => (name === 'Classic' ? rows : null),
    getQuestSourceLines: (name) => sources[name] ?? null,
    parseQuest: (l, f, p) => m.parseQuestForLists(l, f, { rolls: () => 0, partialParse: p }),
    rolls: () => 0,   // SelectQuest picks pool[0]
  });
  const flow = new QuestOfferFlow(m, lists, {
    isPlayerInsideCastle: () => flow.insideCastle,
    removeNpcQuestor: cap('removeNpcQuestor'),
    getGuildFactionId: (g) => { calls.push(['getGuildFactionId', g]); return deps.guildFactionId ?? 777; },
    guildQuestListBox: deps.guildQuestListBox ?? false,
    getLocalizedQuestDisplayName: deps.getLocalizedQuestDisplayName,
  });
  flow.insideCastle = false;
  const of = (name) => calls.filter((c) => c[0] === name);
  return { m, lists, flow, calls, of };
}

/** A live quest carrying a stub questor Person (the Person binding
 *  law itself is questpersons.test.js's charter - the machine's scan
 *  reads only isPerson/isQuestor/questorData/symbol). */
function plantQuestorQuest(m, questorData, { started = true } = {}) {
  const quest = m.parseQuestForLists(MUTE_SRC, 0, { rolls: () => 0 });
  const person = {
    isPerson: true, isQuestor: true, questorData,
    symbol: { name: 'qgiver', original: '_qgiver_' },
    hasPlayerClicked: false,
    setPlayerClicked() { this.hasPlayerClicked = true; },
  };
  quest.resources.set('qgiver', person);
  if (started) m.startQuestImmediate(quest);
  return { quest, person };
}

const makeGuild = (over = {}) => ({
  isMember: () => true, rank: 0, deity: 'Arkay',
  getReputation: () => 0, isSatisfyQuestReqByLevel: () => false,
  ...over,
});

// ---------------------------------------------------------------
// The questor click (QuestMachine.cs:918-985)
// ---------------------------------------------------------------

test('isNPCDataEqual: the four-field struct identity; null reads as the zero struct', () => {
  const m = new QuestMachine();
  const base = { hash: 1, mapID: 2, nameSeed: 3, buildingKey: 4 };
  assert.equal(m.isNPCDataEqual(base, { ...base }), true, 'copy equality, not reference');
  assert.equal(m.isNPCDataEqual(base, { ...base, hash: 9 }), false, 'hash decides');
  assert.equal(m.isNPCDataEqual(base, { ...base, mapID: 9 }), false, 'mapID decides');
  assert.equal(m.isNPCDataEqual(base, { ...base, nameSeed: 9 }), false, 'nameSeed decides');
  assert.equal(m.isNPCDataEqual(base, { ...base, buildingKey: 9 }), false, 'buildingKey decides');
  assert.equal(m.isNPCDataEqual(null, null), true, 'two default structs ARE equal');
  assert.equal(m.isNPCDataEqual(null, { hash: 0, mapID: 0, nameSeed: 0, buildingKey: 0 }), true, 'null is the zero struct');
  assert.equal(m.isNPCDataEqual(null, base), false);
});

test('setLastNPCClicked sweeps every quest for a QuestorData match and marks the click', () => {
  const { m } = makeRig();
  const { person } = plantQuestorQuest(m, { ...NPC });
  const { person: other } = plantQuestorQuest(m, { ...NPC, nameSeed: 1 });
  m.setLastNPCClicked({ ...NPC });
  assert.equal(person.hasPlayerClicked, true, 'a field-equal COPY matches (struct law)');
  assert.equal(other.hasPlayerClicked, false);
  assert.equal(m.getLastNPCClicked().nameSeed, NPC.nameSeed);
});

test("isLastNPCClickedAnActiveQuestor: the incomplete-quest scan stamps the mcp on the ACTIVE quest and skips completed ones", () => {
  const { m } = makeRig();
  const { quest } = plantQuestorQuest(m, { ...NPC });
  m.setLastNPCClicked({ ...NPC });
  const guildMcp = { theGuild: true };
  assert.equal(m.isLastNPCClickedAnActiveQuestor(guildMcp), true);
  assert.equal(quest.externalMCP, guildMcp, "the ACTIVE quest takes the provider - not any offered quest's field");
  quest.externalMCP = null;
  assert.equal(m.isLastNPCClickedAnActiveQuestor(), true, 'no mcp leaves the field alone');
  assert.equal(quest.externalMCP, null);
  quest.questComplete = true;
  assert.equal(m.isLastNPCClickedAnActiveQuestor(guildMcp), false, 'a complete quest is skipped');
});

test("getLastNPCClicked: the machine's own click beats the deps seam, which stays the fallback", () => {
  const depNPC = { ...NPC, nameSeed: 99 };
  const { m } = makeRig({ deps: { lastNPCClicked: () => depNPC } });
  assert.equal(m.getLastNPCClicked(), depNPC, 'unset field falls to deps (the Q3-ii door)');
  m.setLastNPCClicked({ ...NPC });
  assert.equal(m.getLastNPCClicked().nameSeed, NPC.nameSeed, 'the set field wins');
});

test('createMessagePrompt: the YesNo shape, the missing-message null, and the variant draw riding quest.rolls', () => {
  const TWO_VARIANT = [
    'Quest: __VAR', 'QRC:',
    `QuestorOffer:  [${QUEST_MESSAGES.QuestorOffer}]`,
    '<ce> variant a', '<--->', '<ce> variant b', '',
    'QBN:', 'variable _done_',
  ];
  const m = new QuestMachine();
  let draws = 0;
  const quest = m.parseQuestForLists(TWO_VARIANT, 0, { rolls: () => { draws++; return 0.75; } });
  const prompt = m.createMessagePrompt(quest, QUEST_MESSAGES.QuestorOffer);
  assert.equal(draws, 1, "the variant draw is the QUEST's injectable roll, not Math.random");
  assert.equal(prompt.tokens[0].text, 'variant b', 'floor(0.75 * 2) picks variant 1');
  assert.equal(prompt.buttons, 'YesNo');
  assert.equal(prompt.clickAnywhereToClose, false);
  assert.equal(prompt.allowCancel, false);
  assert.equal(m.createMessagePrompt(quest, 999), null, 'no message, no prompt');
});

// ---------------------------------------------------------------
// The social door (DaggerfallQuestOfferWindow.cs)
// ---------------------------------------------------------------

test('social offer: the questor leaves the talk pool, the prompt is QuestorOffer, and Yes starts the quest behind AcceptQuest', () => {
  const { m, flow, of } = makeRig();
  const step = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.deepEqual(of('removeNpcQuestor'), [['removeNpcQuestor', NPC.nameSeed]], "the ctor's pool removal");
  assert.deepEqual(of('getReputation'), [['getReputation', 510]], "the questor NPC's faction rep");
  assert.equal(step.kind, 'offer');
  assert.equal(step.prompt.tokens[0].text, 'Would you fetch the thing?');
  assert.equal(step.prompt.buttons, 'YesNo');
  assert.equal(flow.offeredQuest.externalMCP, null, "the social door sets NO external MCP - C#'s own TODO");

  const res = step.respond(true);
  assert.equal(res.kind, 'accepted');
  assert.equal(res.popup.tokens[0].text, 'Good. The thing awaits.');
  assert.equal(res.popup.exitOnClose, true);
  assert.equal(res.popup.clickAnywhereToClose, true);
  assert.equal(res.popup.allowCancel, true);
  assert.equal(res.popup.mcp, null);
  assert.equal(m.getQuest(flow.offeredQuest.uid), flow.offeredQuest, 'StartQuest ran immediately');
  assert.equal(of('onQuestStarted').length, 1);
  assert.equal(of('addQuestTopics').length, 1);
});

test("social refuse: the three TalkManager scrubs in C#'s order, RefuseQuest with exitOnClose false, and no quest starts", () => {
  const { m, flow, calls } = makeRig();
  const step = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  const before = calls.length;
  const res = step.respond(false);
  const uid = flow.offeredQuest.uid;
  assert.deepEqual(calls.slice(before), [
    ['removeQuestInfoTopics', uid],
    ['removeQuestRumors', uid],
    ['removeProgressRumors', uid],
  ], 'info topics, quest rumors, progress rumors - in that order');
  assert.equal(res.kind, 'refused');
  assert.equal(res.popup.tokens[0].text, 'Bah. Off with you.');
  assert.equal(res.popup.exitOnClose, false, 'the refuse popup keeps the window');
  assert.equal(m.quests.size, 0, 'a refused quest never starts');
});

test('social gates: the castle silences the pool removal AND the fail flavour; outside it the flavour is TEXT.RSC 600', () => {
  const empty = { rows: rowsOf('__OFR, FightersGuild, M, 0, 0, x') };   // no social rows
  const inCastle = makeRig(empty);
  inCastle.flow.insideCastle = true;
  const step1 = inCastle.flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.equal(step1.kind, 'close', 'failed offers stay silent inside castles, as classic');
  assert.equal(inCastle.of('removeNpcQuestor').length, 0, 'the questor stays in the pool inside a castle');

  const outside = makeRig(empty);
  const step2 = outside.flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.equal(step2.kind, 'fail');
  assert.equal(step2.textId, FAIL_QUEST_FLAVOUR_ID);
  assert.equal(FAIL_QUEST_FLAVOUR_ID, 600);
  assert.equal(step2.random, true);
  assert.equal(step2.clickAnywhereToClose, true);
  assert.equal(step2.allowCancel, true);
});

test('the active-questor bail: a live questor blocks the offer - but the pool removal already happened', () => {
  const { m, flow, of } = makeRig();
  plantQuestorQuest(m, { ...NPC });
  m.setLastNPCClicked({ ...NPC });
  const step = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.equal(step.kind, 'close');
  assert.equal(of('removeNpcQuestor').length, 1, 'the ctor half runs BEFORE the bail');
  assert.equal(of('getReputation').length, 0, 'no draw happened');
});

test('no QuestorOffer message: nothing shows and the drawn quest leaks unstarted, verbatim', () => {
  const { m, flow } = makeRig({
    rows: rowsOf('__MUTE, Commoners, N, 0, 0, x'),
    sources: { __MUTE: MUTE_SRC },
  });
  const step = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.equal(step.kind, 'close');
  assert.equal(flow.offeredQuest.questName, '__MUTE', 'the quest WAS drawn');
  assert.equal(m.quests.size, 0, 'and leaks unstarted');
});

test('one-time quests (flag 1) never re-offer once accepted', () => {
  const { flow, lists } = makeRig({ rows: rowsOf('__OFR, Commoners, N, 0, 1, x') });
  const step = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  step.respond(true);
  assert.deepEqual(lists.oneTimeQuestsAccepted, ['__OFR'], 'OnQuestStarted recorded the acceptance');
  const again = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.equal(again.kind, 'fail', 'the pool is empty now - the flavour message answers');
});

// ---------------------------------------------------------------
// The guild door (DaggerfallGuildServicePopupWindow.cs:546-667)
// ---------------------------------------------------------------

test("guild offer: the member's guild becomes the quest's external MCP and the pool clears after ONE offer", () => {
  const { flow, of } = makeRig({ rows: rowsOf('__OFR, FightersGuild, M, 0, 0, x') });
  const guild = makeGuild();
  const step = flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild });
  assert.equal(step.kind, 'offer');
  assert.equal(flow.offeredQuest.externalMCP, guild, "%pct's GuildTitle context rides here");
  assert.deepEqual(of('getGuildFactionId'), [['getGuildFactionId', GUILD_GROUPS.FightersGuild]]);
  assert.equal(flow.offeredQuest.factionId, 777, 'the guild faction homes the reputation change');
  assert.equal(flow.questPool.length, 0, 'questPool.Clear()');
});

test('guild non-member: only N rows offer and the quest carries NO external MCP', () => {
  const { flow } = makeRig({ rows: rowsOf(
    '__MUTE, FightersGuild, M, 0, 0, x',
    '__OFR, FightersGuild, N, 0, 0, x',
  ), sources: { __OFR: OFFER_SRC, __MUTE: MUTE_SRC } });
  const guild = makeGuild({ isMember: () => false });
  const step = flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild });
  assert.equal(step.kind, 'offer');
  assert.equal(flow.offeredQuest.questName, '__OFR', 'the M row filtered out');
  assert.equal(flow.offeredQuest.externalMCP, null, 'non-members lend no MCP');
});

test('the orders home reputation on the BUILDING faction, without consulting the guild manager', () => {
  const { flow, of } = makeRig({ rows: rowsOf('__OFR, KnightlyOrder, M, 0, 0, x') });
  flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.KnightlyOrder, guild: makeGuild(), buildingFactionId: 843 });
  assert.equal(flow.offeredQuest.factionId, 843);
  assert.equal(of('getGuildFactionId').length, 0);
});

test("the Temple deity folds into MembershipStatus: the deity's rows AND plain Member rows offer; an unknown deity throws Enum.Parse's error", () => {
  const rows = rowsOf(
    '__ARK, HolyOrder, A, 0, 0, x',
    '__MEM, HolyOrder, M, 0, 0, x',
    '__DIB, HolyOrder, D, 0, 0, x',
  );
  const { flow, lists } = makeRig({ rows, sources: { __ARK: OFFER_SRC } });
  const seen = [];
  const orig = lists.selectQuest.bind(lists);
  lists.selectQuest = (pool, f) => { seen.push(...pool.map((qd) => qd.name)); return orig(pool, f); };
  flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.HolyOrder, guild: makeGuild({ deity: 'Arkay' }) });
  assert.deepEqual(seen, ['__ARK', '__MEM'], "Arkay admits 'A' rows plus the tplMemb Member fold - never Dibella's");
  assert.equal(flow.offeredQuest.factionId, 0, 'an unpassed buildingFactionId homes the order at faction 0');
  assert.throws(() => flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.HolyOrder, guild: makeGuild({ deity: 'Nocturnal' }) }),
    /Requested value 'Nocturnal' was not found\./);
});

test('the effective rank rides player level only when the guild says IsSatisfyQuestReqByLevel', () => {
  const rows = rowsOf('__OFR, FightersGuild, M, 5, 0, x');   // minReq 5 < 10: a rank gate
  const low = makeRig({ rows, level: 9 });
  const step1 = low.flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: makeGuild({ rank: 2 }) });
  assert.equal(step1.kind, 'fail', 'rank 2 misses the gate; the level does NOT stand in');

  const lifted = makeRig({ rows, level: 9 });
  const step2 = lifted.flow.offerGuildQuest({
    guildGroup: GUILD_GROUPS.FightersGuild,
    guild: makeGuild({ rank: 2, isSatisfyQuestReqByLevel: () => true }),
  });
  assert.equal(step2.kind, 'offer', 'level 9 overrides rank 2 for e.g. Mages/Knights');
});

// ---------------------------------------------------------------
// The quest picker (GuildQuestListBox)
// ---------------------------------------------------------------

test('the picker arm: the wait-box literals, header-only labels, the localization override, and the full parse on pick', () => {
  const rows = rowsOf(
    '__BADQBN, FightersGuild, M, 0, 0, x',
    '__OFR, FightersGuild, M, 0, 0, x',
  );
  const { flow } = makeRig({
    rows,
    sources: { __OFR: OFFER_SRC, __BADQBN: BADQBN_SRC },
    deps: { guildQuestListBox: true, getLocalizedQuestDisplayName: (n) => (n === '__OFR' ? 'Der Auftrag' : null) },
  });
  const wait = flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: makeGuild() });
  assert.equal(wait.kind, 'gettingQuests');
  assert.deepEqual(wait.textLines, [
    'Hmm, let me see what tasks we have available.',
    'Please have patience and wait here a moment, %pcf.',
  ]);
  assert.equal(wait.textLines[0], GETTING_QUESTS_1);
  assert.equal(wait.textLines[1], GETTING_QUESTS_2);
  assert.equal(wait.clickAnywhereToClose, true);

  const pick = wait.onClose();
  assert.equal(pick.kind, 'pickQuest');
  assert.deepEqual(pick.entries, ['The Broken Errand', 'Der Auftrag'],
    'the header-only parse labels even a broken QBN; the localized name overrides DisplayName');

  assert.throws(() => pick.onPick(0), /Unknown line signature/,
    "the pick's FULL parse throws out, as C#'s uncaught LoadQuest");
  const offered = pick.onPick(1);
  assert.equal(offered.kind, 'offer');
  assert.equal(flow.offeredQuest.questName, '__OFR');
  assert.equal(pick.onPick(9), null, 'past the pool answers nothing');
});

test("the picker prune replays C#'s RemoveAt bug: original indices over a shifting list prune the WRONG row", () => {
  const rows = rowsOf(
    '__GONE1, FightersGuild, M, 0, 0, x',   // no source: fails even the partial parse
    '__GONE2, FightersGuild, M, 0, 0, x',
    '__OFR, FightersGuild, M, 0, 0, x',
  );
  const { flow } = makeRig({ rows, deps: { guildQuestListBox: true } });
  const wait = flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: makeGuild() });
  const pick = wait.onClose();
  assert.deepEqual(pick.entries, ['The Offered Errand'], 'only the good row labels');
  // failures [0,1]: RemoveAt(0) drops __GONE1; RemoveAt(1) - the list
  // has shifted - drops __OFR, the GOOD row. __GONE2 survives.
  assert.deepEqual(flow.questPool.map((qd) => qd.name), ['__GONE2']);
});

test('the picker prune throws past the end, mirroring ArgumentOutOfRangeException', () => {
  const rows = rowsOf(
    '__GONE1, FightersGuild, M, 0, 0, x',
    '__GONE2, FightersGuild, M, 0, 0, x',
  );
  const { flow } = makeRig({ rows, deps: { guildQuestListBox: true } });
  const wait = flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: makeGuild() });
  assert.throws(() => wait.onClose(), /Index was out of range/,
    'failures [0,1] over two rows: the second RemoveAt lands past the shrunken list');
});

// ---------------------------------------------------------------
// The service routing
// ---------------------------------------------------------------

test("guildServiceFlow's Quests arm now lands on the offer flow", () => {
  assert.equal(serviceDestination('Quests'), 'questOffer');
});

// ---------------------------------------------------------------
// ExpandLetterSignoff (QuestMacroHelper.cs:176-264)
// ---------------------------------------------------------------

function makeLetterQuest(resources = {}, hooks = {}) {
  return {
    uid: 9, hooks, externalMCP: null,
    lastResourceReferenced: null, lastPlaceReferenced: null,
    getResource: ({ name }) => resources[name] ?? null,
  };
}

test("the signoff is the LAST non-empty line only, prefixed 'Letter: ' and trailing a space", () => {
  const reveals = [];
  const quest = makeLetterQuest({
    npc: { isPerson: true, expandMacro: (t) => (t === MACRO_TYPES.NameMacro1 ? 'Baron Snide' : false) },
  }, { addDialog: (...args) => reveals.push(args) });
  const tokens = [
    { text: 'this line is never read' },
    { text: 'yours truly, _npc_' },
    { text: '' },
  ];
  assert.equal(expandLetterSignoff(quest, tokens), 'Letter: yours truly, Baron Snide ');
  assert.deepEqual(reveals, [[9, 'npc', 'Person', false]], 'NameMacro1 ALWAYS reveals here - no gate');
});

test('location macros swallow their WHOLE word into "..." - attached punctuation included', () => {
  const quest = makeLetterQuest();
  assert.equal(expandLetterSignoff(quest, [{ text: 'meet me at ___dung_, at dusk' }]),
    'Letter: meet me at ... at dusk ', 'the comma on ___dung_, vanished with the word');
});

test('an unknown context macro bakes its error shape into the letter name', () => {
  const quest = makeLetterQuest();
  assert.equal(expandLetterSignoff(quest, [{ text: 'sealed by %zzz' }]),
    'Letter: sealed by %zzz[undefined] ');
});

test('the walk really is last-to-first with a one-line break: earlier lines never expand', () => {
  let touched = 0;
  const quest = makeLetterQuest({
    trap: { isPerson: true, expandMacro: () => { touched++; throw new Error('boom'); } },
  });
  const out = expandLetterSignoff(quest, [
    { text: 'cursed _trap_ line' },
    { text: 'Baron Snide' },
  ]);
  assert.equal(out, 'Letter: Baron Snide ');
  assert.equal(touched, 0, 'the break fired before the earlier line');
});

test("an empty message signs off as bare 'Letter: '", () => {
  assert.equal(expandLetterSignoff(makeLetterQuest(), [{ text: '' }]), 'Letter: ');
});

// ---------------------------------------------------------------
// AUDIT X boundary pins (the campaign's survivors)
// ---------------------------------------------------------------

test('the questor scan compares ONLY questors: a non-questor person never matches, even on a never-clicked machine', () => {
  // The mutant `!isPerson && !isQuestor` slips a non-questor person
  // into the compare, where its null questorData equals the null
  // click as two zero structs. C# gates on IsQuestor first.
  const { m } = makeRig();
  const quest = m.parseQuestForLists(MUTE_SRC, 0, { rolls: () => 0 });
  quest.resources.set('bystander', {
    isPerson: true, isQuestor: false, questorData: null,
    symbol: { name: 'bystander', original: '_bystander_' },
  });
  m.startQuestImmediate(quest);
  assert.equal(m.isLastNPCClickedAnActiveQuestor(), false);
});

test('a signoff line whose FIRST word is a macro expands from word zero', () => {
  const quest = makeLetterQuest({
    npc: { isPerson: true, expandMacro: (t) => (t === MACRO_TYPES.NameMacro1 ? 'Baron Snide' : false) },
  }, { addDialog: () => {} });
  assert.equal(expandLetterSignoff(quest, [{ text: '_npc_ sends regards' }]),
    'Letter: Baron Snide sends regards ');
});

test('letter reveals type every resource: Place -> Location and Item -> Thing, isSpecial false', () => {
  const reveals = [];
  const quest = makeLetterQuest({
    house: { isPlace: true, expandMacro: () => 'The Rusty Ogre' },
    ring: { isItem: true, expandMacro: () => 'a ruby ring' },
  }, { addDialog: (...args) => reveals.push(args) });
  assert.equal(expandLetterSignoff(quest, [{ text: 'leave _ring_ at _house_' }]),
    'Letter: leave a ruby ring at The Rusty Ogre ');
  assert.deepEqual(reveals, [[9, 'ring', 'Thing', false], [9, 'house', 'Location', false]]);
});

test('a ONE-character line still counts as the signoff (the emptiness gate is length > 0)', () => {
  assert.equal(expandLetterSignoff(makeLetterQuest(), [{ text: 'never read' }, { text: 'X' }]),
    'Letter: X ');
});

test("the social gender fold: a male NPC draws 'M' rows, never 'F' rows", () => {
  const rows = rowsOf(
    '__MUTE, Commoners, F, 0, 0, x',
    '__OFR, Commoners, M, 0, 0, x',
  );
  const { flow } = makeRig({ rows, sources: { __OFR: OFFER_SRC, __MUTE: MUTE_SRC } });
  const step = flow.offerSocialQuest({ ...NPC, gender: GENDERS.Male }, SOCIAL_GROUPS.Commoners);
  assert.equal(step.kind, 'offer');
  assert.equal(flow.offeredQuest.questName, '__OFR', "GENDERS.Male landed on the 'M' row");
});

test('the absent player-fact seams read ZERO - rep and level, not any other default', () => {
  // A machine with NO deps: GetReputation of nothing is 0 (the
  // factionRep law) and a level-0 player misses a minReq-1 row on
  // BOTH social gates.
  const m = new QuestMachine();
  const lists = new QuestListsManager({
    readListTable: (name) => (name === 'Classic' ? rowsOf('__OFR, Commoners, N, 1, 0, x') : null),
    getQuestSourceLines: (name) => (name === '__OFR' ? OFFER_SRC : null),
    parseQuest: (l, f, p) => m.parseQuestForLists(l, f, { rolls: () => 0, partialParse: p }),
    rolls: () => 0,
  });
  const flow = new QuestOfferFlow(m, lists, {});
  const step = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.equal(step.kind, 'fail', 'rep 0 < minReq 1 and level 0 < minReq 1');
});

test('the absent guild seams read ZERO: no level override fuel, and the guild-manager faction id falls to 0', () => {
  const m = new QuestMachine();
  const lists = new QuestListsManager({
    readListTable: (name) => (name === 'Classic' ? rowsOf(
      '__GATED, FightersGuild, M, 1, 0, x',
      '__OFR, FightersGuild, N, 0, 0, x',
    ) : null),
    // __GATED must be LOADABLE: a sourceless row would answer the
    // same fail step under a levelful mutant and mask the seam.
    getQuestSourceLines: (name) => (name === '__OFR' || name === '__GATED' ? OFFER_SRC : null),
    parseQuest: (l, f, p) => m.parseQuestForLists(l, f, { rolls: () => 0, partialParse: p }),
    rolls: () => 0,
  });
  const flow = new QuestOfferFlow(m, lists, {});
  const gated = flow.offerGuildQuest({
    guildGroup: GUILD_GROUPS.FightersGuild,
    guild: makeGuild({ rank: 0, isSatisfyQuestReqByLevel: () => true }),
  });
  assert.equal(gated.kind, 'fail', 'a levelless machine lends rank 0 no override');
  const open = flow.offerGuildQuest({
    guildGroup: GUILD_GROUPS.FightersGuild,
    guild: makeGuild({ isMember: () => false }),
  });
  assert.equal(open.kind, 'offer');
  assert.equal(flow.offeredQuest.factionId, 0, 'no getGuildFactionId seam reads faction 0');
});

test('the menu flag is FALSE everywhere but a menu-borne social offer', () => {
  const { flow } = makeRig();
  assert.equal(flow.menu, false, 'the ctor default');
  flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners, true);
  assert.equal(flow.menu, true, 'a talk-menu offer records it');
  flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  assert.equal(flow.menu, false, 'the social default');
  flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: makeGuild({ isMember: () => false }) });
  assert.equal(flow.menu, false, 'the guild door never rides a menu');
});

test('the popup variant draw is -1 (random via quest.rolls), not the explicit-variant zero arm', () => {
  const TWO_REFUSE = [
    'Quest: __OFR', 'QRC:',
    `QuestorOffer:  [${QUEST_MESSAGES.QuestorOffer}]`, '<ce> take it?', '',
    `RefuseQuest:  [${QUEST_MESSAGES.RefuseQuest}]`,
    '<ce> refuse a', '<--->', '<ce> refuse b', '',
    'QBN:', 'variable _done_',
  ];
  const m = new QuestMachine();
  const lists = new QuestListsManager({
    readListTable: (name) => (name === 'Classic' ? rowsOf('__OFR, Commoners, N, 0, 0, x') : null),
    getQuestSourceLines: (name) => (name === '__OFR' ? TWO_REFUSE : null),
    parseQuest: (l, f, p) => m.parseQuestForLists(l, f, { rolls: () => 0.75, partialParse: p }),
    rolls: () => 0,
  });
  const flow = new QuestOfferFlow(m, lists, {});
  const step = flow.offerSocialQuest({ ...NPC }, SOCIAL_GROUPS.Commoners);
  const res = step.respond(false);
  assert.equal(res.popup.tokens[0].text, 'refuse b', 'quest.rolls 0.75 over 2 variants picks the second');
});

test('picking the index exactly one past the pool answers null, not an undefined load', () => {
  const rows = rowsOf('__OFR, FightersGuild, M, 0, 0, x');
  const { flow } = makeRig({ rows, deps: { guildQuestListBox: true } });
  const pick = flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: makeGuild() }).onClose();
  assert.equal(pick.onPick(flow.questPool.length), null, 'the < boundary is strict');
});
