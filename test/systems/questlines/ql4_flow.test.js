// AUDIT QUESTLINES (2026-10-19, fixer FLOW - bible/06-Systems/Questlines-Arc.md sections 2.3, 2.4, 10.2): THE ASK'S
// FLOW AND A SHARED COPY. A branch's `ask` from the machine to the box chain the player answers through
// (scenes/quest/questBridge.js choiceBoxes in ui/guildServiceWindows.js ServiceFlowWindow) - asked behind the words that
// set it up, never shut without an answer, a pick that cannot be drawn settled and asked again; and a quest shared in a
// party - the sharer chooses, an answer counts once, `ql act` shares, the copy is read with the script its stamp was, its
// tier is its holder's, a questline's step is the holder's own and is never shared; a stamped quest restarted stays
// stamped. Each pin names the mutants it kills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { createQuestBridge, choiceBoxes, tokensToRows } from '../../../src/scenes/quest/questBridge.js';
import { questlineActionTemplates, QlAsk, QlAct } from '../../../src/systems/questlines/qlActions.js';
import { freshState, readState, writeState, receivedState, mergeSharedState, QL_STAMP } from '../../../src/systems/questlines/qlState.js';
import { prepareQuestShare, prepareShareData, canReceiveSharedQuest, receiveSharedQuest, SHARE_REFUSAL_TEXT, shareRefusalText } from '../../../src/systems/quest/questShare.js';
import { ServiceFlowWindow, PICK_UNSHOWN } from '../../../src/ui/guildServiceWindows.js';
import { _setListPickerArtForTests } from '../../../src/ui/listPicker.js';
import { lineQuestNames } from '../../../src/systems/questlines/qlLines.js';
import { hasQuestlinePatch } from '../../../src/systems/questlines/qlPatches.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { loadTables, questSource, packMachine } from '../../qlSources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
loadTables();

const FLOW = '__QLFLOW';
const FLOW_QUEST = [
  `Quest: ${FLOW}`,
  'DisplayName: A Choice Shared',
  'QRC:',
  'QuestorOffer:  [1000]',
  '<ce> Will you?',
  '',
  'RefuseQuest:  [1001]',
  '<ce> No.',
  '',
  'AcceptQuest:  [1002]',
  '<ce> Yes.',
  '',
  'Message:  1049',
  '<ce> The ring was taken from the Guild\'s own vault.',
  '',
  'Message:  1050',
  '<ce> Who gets the ring?',
  '',
  'Message:  1051',
  'The Guild',
  '',
  'Message:  1052',
  'The fence',
  '',
  'QBN:',
  '',
  'variable _found_',
  'variable _guild_',
  'variable _fence_',
  '',
  '_tell_ task:',
  '\twhen _found_',
  '\tsay 1049',
  '\tstart task _ask_',
  '',
  '_ask_ task:',
  '\task 1050 choices 1051 _guild_ 1052 _fence_',
  '',
  '_g_ task:',
  '\twhen _guild_',
  '\toutcome _loyal_',
  '',
  '_f_ task:',
  '\twhen _fence_',
  '\toutcome _sold_',
  '',
  '_hunt_ task:',
  '\tql act fish-caught 2',
];

const LISTS = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };

/** A machine over the fixture: its questions recorded, its party `partySize`, its stamp's tier `tier` (null: the switch off). */
function machineFor({ asks = [], partySize = 2, tier = 1, lines = FLOW_QUEST, deps = {} } = {}) {
  const m = new QuestMachine({
    nowSeconds: () => 1000,
    getQuestSourceLines: (n) => (n === FLOW ? lines : null),
    questlinesStamp: () => (tier == null ? null : { ...freshState(), tier }),
    showChoice: (q, message, choices, respond) => asks.push({ q, message, choices, respond }),
    partySize: () => partySize,
    ...deps,
  });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  return m;
}
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
/** The party's sync, as world.js questSyncTick sends it: the sender's envelope, over the wire, received. */
const sync = (from, quest, to) => quiet(() => receiveSharedQuest(to, LISTS, quest.questName, JSON.parse(JSON.stringify(prepareQuestShare(from, quest.uid).data)), { online: false }));
const task = (q, name) => q.getTask({ name });
const set = (q, name) => task(q, name).getTriggerValue();
const askOf = (q) => task(q, 'ask').actions.find((a) => a instanceof QlAsk);
const actOf = (q) => task(q, 'hunt').actions.find((a) => a instanceof QlAct);

/** A sharer A and a member B: A starts and shares; B holds the received copy. */
function party({ aParty = 2, bParty = 2 } = {}) {
  const aAsks = [], bAsks = [];
  const A = machineFor({ asks: aAsks, partySize: aParty }), B = machineFor({ asks: bAsks, partySize: bParty });
  const qa = A.startQuestByName(FLOW);
  A.tick();
  A.markQuestShared(FLOW);
  const got = sync(A, qa, B);
  assert.ok(got.ok, got.reason);
  return { A, B, qa, qb: got.quest, aAsks, bAsks };
}

// ---- the sharer chooses (BRANCH-1) ----

test('AUDIT QUESTLINES BRANCH-1 a party: the sharer is asked, the member\'s copy is not - its choice arrives on the resync, once; a received copy with no party to resync it asks its holder (mutants: every copy asks; a received copy waits with no party; `received` never marked, or not read back)', () => {
  const { A, B, qa, qb, aAsks, bAsks } = party();
  assert.equal(qa.ql.received, false, 'the sharer\'s own copy');
  assert.equal(qb.ql.received, true, 'the member\'s, received');
  task(qa, 'found').start();
  A.tick(); A.tick();   // `say` breaks its task's tick (Quest.questBreak): the ask is started on the next
  assert.equal(aAsks.length, 1, 'the sharer is asked');
  assert.ok(sync(A, qa, B).resync);
  B.tick(); B.tick();
  assert.equal(bAsks.length, 0, 'the member is not asked the sharer\'s question');
  aAsks[0].respond(1);   // the fence
  A.tick(); A.tick();
  sync(A, qa, B);
  B.tick(); B.tick();
  assert.equal(set(qb, 'fence'), true, 'the sharer\'s choice, carried');
  assert.equal(set(qb, 'guild'), false);
  assert.equal(qb.ql.outcome, 'sold');
  assert.equal(bAsks.length, 0, 'never asked');
  // a received copy whose party is gone (machine.js rewardShares: no party to resync it) is its holder's, and asks
  const alone = party({ bParty: 1 });
  task(alone.qa, 'found').start();
  alone.A.tick(); alone.A.tick();
  sync(alone.A, alone.qa, alone.B);
  alone.B.tick();
  assert.equal(alone.bAsks.length, 1, 'no party: the holder chooses');
});

test('AUDIT QUESTLINES BRANCH-1 an answer counts once, on the ask as it stands: a partner\'s choice carried in under the box, a choice task already set, or the quest ending - the late answer starts nothing (mutants: the answer unguarded - the kept gold and the standing for giving it up both paid; no guard on a choice already set; no guard on the ending)', () => {
  // a partner's answer synced back while the sharer's box is up (a member with no party asked and answered)
  {
    const { A, B, qa, qb, aAsks, bAsks } = party({ bParty: 1 });
    task(qa, 'found').start();
    A.tick(); A.tick();
    sync(A, qa, B);
    B.tick();
    assert.equal(bAsks.length, 1);
    bAsks[0].respond(0);   // the member: the Guild
    B.tick();
    assert.ok(sync(B, qb, A).resync, 'the member\'s copy, back to the sharer');
    assert.equal(set(qa, 'guild'), true);
    aAsks[0].respond(1);   // the sharer's box, still up: the fence
    A.tick(); A.tick();
    assert.equal(set(qa, 'fence'), false, 'the late answer starts nothing - one way paid, not both');
    assert.equal(qa.ql.outcome, 'loyal');
  }
  // a choice task already set under the box (the script's own other road to it)
  {
    const asks = [];
    const m = machineFor({ asks });
    const q = m.startQuestByName(FLOW);
    task(q, 'found').start();
    m.tick(); m.tick();
    task(q, 'guild').start();
    asks[0].respond(1);
    m.tick();
    assert.equal(set(q, 'fence'), false, 'a choice already set: the answer is not a second one');
  }
  // the quest ending under the box
  {
    const asks = [];
    const m = machineFor({ asks });
    const q = m.startQuestByName(FLOW);
    task(q, 'found').start();
    m.tick(); m.tick();
    q.endQuest();
    asks[0].respond(1);
    assert.equal(set(q, 'fence'), false, 'an ending quest takes no answer');
    assert.equal(askOf(q).isComplete, false);
  }
});

test('AUDIT QUESTLINES BRANCH-1 the question stays up across a resync: the rebuilt ask does not ask again over the box, and the answer lands on it (mutants: the latch on the action object; the answer on the action the resync threw away)', () => {
  const { A, B, qa, qb, aAsks, bAsks } = party();
  task(qa, 'found').start();
  A.tick(); A.tick();   // `say` breaks its task's tick (Quest.questBreak): the ask is started on the next
  assert.equal(aAsks.length, 1);
  sync(A, qa, B);
  B.tick();
  const before = askOf(qa);
  assert.ok(sync(B, qb, A).resync, 'a partner\'s step, with nothing chosen');
  assert.notEqual(askOf(qa), before, 'the resync rebuilt the ask');
  A.tick(); A.tick(); A.tick();
  assert.equal(aAsks.length, 1, 'not asked again over the box still up');
  aAsks[0].respond(1);
  A.tick(); A.tick();
  assert.equal(set(qa, 'fence'), true, 'the answer taken');
  assert.equal(askOf(qa).isComplete, true, 'by the ask as it stands');
  for (let i = 0; i < 5; i++) A.tick();
  assert.equal(aAsks.length, 1, 'and never asked again');
  assert.equal(bAsks.length, 0);
});

// ---- `ql act` shares (BRANCH-2) ----

test('AUDIT QUESTLINES BRANCH-2 a quest with `ql act` shares once its trigger has counted, and each copy counts its own acts from its own start - a fresh copy from its parse, a resync keeping the holder\'s (mutants: QlAct not in the share law; `from` taken from the partner)', () => {
  const A = machineFor(), B = machineFor();
  const qa = A.startQuestByName(FLOW);
  qa.ql.acts['fish-caught'] = 5;
  A.tick();
  assert.equal(actOf(qa).from, 5, 'the sharer\'s count began at its five');
  A.markQuestShared(FLOW);
  const got = sync(A, qa, B);
  assert.equal(got.ok, true, got.reason);
  const qb = got.quest;
  assert.deepEqual(qb.ql.acts, {}, 'an act is this world\'s');
  assert.equal(actOf(qb).from, null, 'the member\'s count is its own, from its own parse');
  B.tick();
  assert.equal(actOf(qb).from, 0);
  qb.ql.acts['fish-caught'] = 1;
  B.tick();
  assert.equal(set(qb, 'hunt'), false, 'one of two');
  A.tick();
  assert.equal(sync(A, qa, B).resync, true, 'the resync taken, not refused');
  assert.equal(actOf(qb).from, 0, 'the holder\'s start kept, never the partner\'s');
  qb.ql.acts['fish-caught'] = 2;
  B.tick();
  assert.equal(set(qb, 'hunt'), true, 'two of two, counted from the member\'s own start');
});

// ---- the box chain (BRANCH-11, BRANCH-3, BRANCH-7) ----

const words = (text) => ({ getTextTokens: () => [{ formatting: 'text', text }] });
const Q = { rolls: null };

test('AUDIT QUESTLINES BRANCH-11 choiceBoxes through a real ServiceFlowWindow: the question, then the pick; Escape on the pick shows the question again; the window never closes without an answer; a pick answers once (mutants: Escape closes the chain unanswered; a second pick answers again)', () => {
  _setListPickerArtForTests({ base: {} });
  try {
    const said = [];
    const win = new ServiceFlowWindow([choiceBoxes(Q, words('Who gets the ring?'), [words('The Guild'), words('The fence')], (i) => said.push(i))]);
    const open = () => assert.ok(!win.done || said.length === 1, 'never closed without an answer');
    assert.deepEqual(win.top.rows, ['Who gets the ring?']);
    assert.equal(win.top.picker, undefined);
    win.click(160, 100);
    assert.deepEqual(win.top.picker, ['The Guild', 'The fence'], 'the question read: the pick');
    for (let i = 0; i < 3; i++) {
      win.input('Escape');
      open();
      assert.equal(win.done, false);
      assert.deepEqual(win.top.rows, ['Who gets the ring?'], 'Escape shows the question again');
      win.click(160, 100);
      open();
    }
    const pick = win.top;
    win.input('ArrowDown');
    win.input('Enter');
    assert.deepEqual(said, [1], 'the fence, answered');
    assert.equal(win.done, true);
    pick.onPick(0);
    assert.deepEqual(said, [1], 'answered once');
  } finally { _setListPickerArtForTests(null); }
});

test('AUDIT QUESTLINES BRANCH-3 a pick the window cannot draw (no list art) goes to its onCancel, told why, and choiceBoxes settles the chain with null - asked again later, never held up for the session nor looped (mutants: the pick dropped bare; the unshown pick re-shows the question)', () => {
  _setListPickerArtForTests(null);
  const said = [];
  const win = new ServiceFlowWindow([choiceBoxes(Q, words('Who gets the ring?'), [words('The Guild'), words('The fence')], (i) => said.push(i))]);
  win.click(160, 100);
  assert.ok(win.top.picker);
  win.draw(null, null, null);
  assert.deepEqual(said, [null], 'settled: no answer, said so');
  assert.equal(win.done, true, 'and the window let go');
  // the window's law, for any chain: told PICK_UNSHOWN
  const told = [];
  const plain = new ServiceFlowWindow([{ picker: ['a'], onPick: () => null, onCancel: (why) => { told.push(why); return null; } }]);
  plain.draw(null, null, null);
  assert.deepEqual(told, [PICK_UNSHOWN]);
  // through the machine: the question comes back later, and is answerable then
  const asks = [];
  let win2 = null;
  const m = machineFor({ deps: { showChoice: (q, message, choices, respond) => { asks.push(respond); win2 = new ServiceFlowWindow([choiceBoxes(q, message, choices, respond)]); } } });
  const q = m.startQuestByName(FLOW);
  task(q, 'found').start();
  m.tick(); m.tick();
  win2.click(160, 100);
  win2.draw(null, null, null);
  assert.equal(win2.done, true);
  m.tick();
  assert.equal(asks.length, 1, 'not again at once');
  for (let i = 0; i < 400 && asks.length === 1; i++) m.tick();
  assert.equal(asks.length, 2, 'asked again, later');
  asks[1](0);
  m.tick();
  assert.equal(set(q, 'guild'), true);
});

test('AUDIT QUESTLINES BRANCH-7 the question waits behind the boxes already up - after the words that set it up - where every other box goes in front, newest first (mutants: the question pushed in front; choiceBoxes without `behind`)', () => {
  const win = new ServiceFlowWindow([{ rows: ['The sage reads the Finger.'] }]);
  win.push([choiceBoxes(Q, words('Who gets the ring?'), [words('The Guild'), words('The fence')], () => {})]);
  win.push([{ rows: ['A later word.'] }]);
  assert.deepEqual(win.boxes.map((b) => b.rows?.[0]), ['A later word.', 'The sage reads the Finger.', 'Who gets the ring?']);
  // through the machine: the task says 1049 and starts the ask in one tick - the player reads 1049 first
  let host = null;
  const show = (box) => { if (host && !host.done) host.push([box]); else host = new ServiceFlowWindow([box]); };
  const m = machineFor({ deps: {
    showPopup: (_q, tokens) => { const rows = tokensToRows(tokens); if (rows.length) show({ rows }); },
    showChoice: (q, message, choices, respond) => show(choiceBoxes(q, message, choices, respond)),
  } });
  const q = m.startQuestByName(FLOW);
  m.tick();
  task(q, 'found').start();
  m.tick(); m.tick();
  assert.deepEqual(host.boxes.map((b) => (b.onClick ? 'question' : b.rows.join(' ').trim())), ['The ring was taken from the Guild\'s own vault.', 'question']);
});

// ---- the copy's script (BRANCH-12) and a restart's stamp (BRANCH-14) ----

test('AUDIT QUESTLINES BRANCH-12 a copy is held to the script its stamp read - a flagship quest begun on DFU\'s script shares to a receiver whose switch is on, and a stamped one to a receiver whose switch is off (mutants: the receiver\'s parse follows its own switch - the machine\'s read, or the share\'s word)', () => {
  const NAME = 'A0C01Y01';
  assert.ok(hasQuestlinePatch(NAME), 'the fixture: a flagship quest with its branch');
  let on = false;
  const mk = () => packMachine({ nowSeconds: () => 1000, getQuestSourceLines: (n, ql) => questSource(n, ql ?? on), questlinesStamp: () => (on ? freshState() : null) });
  for (const [senderOn, receiverOn] of [[false, true], [true, false]]) {
    on = senderOn;
    const sender = mk(), receiver = mk();
    const q = quiet(() => sender.startQuestByName(NAME, 0));
    assert.equal(q.ql?.stamp === QL_STAMP, senderOn);
    sender.markQuestShared(NAME);
    on = receiverOn;
    const got = sync(sender, q, receiver);
    assert.equal(got.ok, true, `sender ${senderOn ? 'on' : 'off'}, receiver ${receiverOn ? 'on' : 'off'}: ${got.reason}`);
    assert.equal(got.quest.ql?.stamp === QL_STAMP, senderOn, 'the copy keeps its sharer\'s stamp');
    assert.equal(sync(sender, q, receiver).resync, true, 'and its resync is taken');
  }
});

test('AUDIT QUESTLINES BRANCH-14 a stamped quest restarted with the switch off is read with its branch and starts stamped - its `ql act` hears; an unstamped one restarts as any start, by the switch now (mutants: the restart stamped by the switch now; the restart read by the switch now)', () => {
  let on = true;
  const reads = [];
  const m = machineFor({ deps: { getQuestSourceLines: (n, ql) => { reads.push(ql); return n === FLOW ? FLOW_QUEST : null; }, questlinesStamp: () => (on ? { ...freshState(), tier: 3 } : null) } });
  const q = m.startQuestByName(FLOW);
  assert.equal(q.ql.stamp, QL_STAMP);
  on = false;
  const r = m.restartQuest(q.uid);
  assert.equal(r.ok, true, r.reason);
  assert.equal(reads.at(-1), true, 'read with its branch');
  assert.equal(r.quest.ql?.stamp, QL_STAMP, 'stamped for life');
  assert.equal(r.quest.ql.tier, 3, 'its tier kept where the switch gives none');
  m.tick();
  r.quest.ql.acts['fish-caught'] = 2;
  m.tick();
  assert.equal(set(r.quest, 'hunt'), true, 'its act heard');
  const u = m.startQuestByName(FLOW);
  assert.equal(u.ql, null, 'begun with the switch off');
  on = true;
  const ru = m.restartQuest(u.uid);
  assert.equal(reads.at(-1), undefined, 'an unstamped quest restarts by the switch now');
  assert.equal(ru.quest.ql?.stamp, QL_STAMP);
});

// ---- the tier is the holder's (REWARD-1) ----

test('AUDIT QUESTLINES REWARD-1 a shared copy\'s tier is its holder\'s, as the layer\'s stamp reads it - a level-1 receiver of a level-21 sender\'s social quest is tier 1, and a level-21 receiver of a level-1\'s is tier 4 (mutants: the envelope\'s tier kept; the copy left at the floor)', () => {
  const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
  setPref(QUESTLINES_PREF, true);
  const bridge = (level) => quiet(() => createQuestBridge({
    data: { readListTable: (n) => { try { return readFileSync(join(VENDOR, 'Tables', `QuestList-${n}.txt`), 'utf8'); } catch { return null; } }, getQuestSourceLines: (n, ql) => questSource(n, ql ?? true) },
    classicSeconds: () => 1000, playerEntity: { name: 'P', level, skills: new Array(35).fill(30), career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 } },
  }));
  const NAME = 'R0C10Y10';   // a town errand: a social quest, its tier the level band
  for (const [from, to, want] of [[21, 1, 1], [1, 21, 4]]) {
    const s = bridge(from), r = bridge(to);
    const q = quiet(() => s.machine.startQuestByName(NAME, 0));
    assert.equal(q.ql.tier, from === 21 ? 4 : 1, 'the sender\'s own, at its start');
    s.machine.markQuestShared(NAME);
    const got = quiet(() => receiveSharedQuest(r.machine, r.questLists, NAME, JSON.parse(JSON.stringify(prepareQuestShare(s.machine, q.uid).data)), { online: false }));
    assert.ok(got.ok, got.reason);
    assert.equal(got.quest.ql.tier, want, `a level-${to} holder of a level-${from}'s`);
  }
  // a hand-built envelope's tier is nobody's: the holder's stamp, or the floor where it gives none
  const A = machineFor({ tier: 4 }), B = machineFor({ tier: null });
  const qa = A.startQuestByName(FLOW);
  A.markQuestShared(FLOW);
  const env = JSON.parse(JSON.stringify(prepareQuestShare(A, qa.uid).data));
  assert.equal(env.ql.tier, 4);
  const got = quiet(() => receiveSharedQuest(B, LISTS, FLOW, env, { online: false }));
  assert.equal(got.quest.ql.tier, 1);
  assert.equal(receivedState(env.ql).tier, 1, 'the state arrives at the floor');
});

// ---- a questline's step is the holder's own (REWARD-2) ----

test('AUDIT QUESTLINES REWARD-2 every questline step is refused for sharing at both ends - the sender\'s gate and the receiver\'s, a hand-built envelope too - in the player\'s words (mutants: the sender\'s gate gone; the receiver\'s gate gone)', () => {
  const names = lineQuestNames();
  assert.ok(names.length >= 30, 'the lines\' steps');
  const m = machineFor();
  for (const name of names) {
    assert.equal(prepareShareData({ questName: name, displayName: name, tasks: [], resources: [] }).reason, 'questline', `${name}: not sent`);
    assert.equal(canReceiveSharedQuest(m, LISTS, name).reason, 'questline', `${name}: not received`);
  }
  // a line's last step, its envelope built past the sender's gate: refused on receipt, nothing built
  const sender = packMachine({ nowSeconds: () => 1000 });
  const q = quiet(() => sender.startQuestByName('QLBD05', 0));
  const env = JSON.parse(JSON.stringify(sender.getShareableQuestData(q.uid)));
  const receiver = packMachine({ nowSeconds: () => 1000 });
  assert.equal(receiveSharedQuest(receiver, LISTS, 'QLBD05', env, { online: false }).reason, 'questline');
  assert.equal(receiver.quests.size, 0);
  // the words: the sender's, and the receiver's after "... but you"
  assert.ok(typeof SHARE_REFUSAL_TEXT.questline === 'string' && SHARE_REFUSAL_TEXT.questline.length > 10);
  assert.ok(shareRefusalText({ reason: 'questline' })?.startsWith('cannot'), shareRefusalText({ reason: 'questline' }));
  assert.equal(prepareShareData({ questName: FLOW, displayName: FLOW, tasks: [], resources: [] }).ok, true, 'any other quest still shares');
});

// ---- the state (REWARD-15, BRANCH-1) ----

test('AUDIT QUESTLINES REWARD-15 / BRANCH-1 the state: no `offer` (never written); a received copy is marked so, kept through a save, and a resync never makes the sharer\'s copy a received one (mutants: offer back in the state; received not read back; received not marked)', () => {
  assert.equal('offer' in freshState(), false);
  assert.equal('offer' in readState({ ...freshState(), offer: { pieces: [{}] } }), false, 'an older save\'s offer is read as nothing');
  const got = receivedState(writeState({ ...freshState(), tier: 4, received: false }));
  assert.equal(got.received, true);
  assert.equal(readState(writeState(got)).received, true, 'kept through a save');
  assert.equal(mergeSharedState({ ...freshState() }, writeState(got)).received, false, 'the sharer\'s own stays its own');
});
