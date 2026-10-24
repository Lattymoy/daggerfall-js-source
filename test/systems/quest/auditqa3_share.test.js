// AUDIT QA3 (2026-10-23, the owner: "Audit this", of QUEST-AUDIT III; bible/01-Overview/audits/Quest-Audit-III.md): the
// party share, held to the laws the audit found broken. Each pin runs the real machine and the real share path
// (prepareQuestShare -> receiveSharedQuest) over two or three machines passing real envelopes, and each is red on the
// commit the audit read (29624034e) on its own law:
//
// - A1: a question whose box is up on one copy is asked there - the envelope it hands on writes it asked, so a partner's
//   copy never asks it too (A0C00Y10's `no _S.05_`: one No ended both copies).
// - E1: a received copy waits at a questline choice while the player who shared it is in the party, however quiet the
//   party; it asks once they have left. Sharing a received copy on does not make its holder a second chooser.
// - E2: the share memory rides the save - a copy's holders heard (the purse's shares) and its sharer (the wait).
// - E3: a kill an envelope brought is spent only by its own sender's credit - a third member's is never swallowed.
// - E4: a copy new here answers "held" - merged by nobody, so the sharer's act since the share stands; a member who
//   refused the share hears nothing of each answer.
// - A6/E6: a copy set aside and reclaimed stays out of the party's step after a load; a finished copy is remembered by
//   its identity and its name after its tombstone's week.
// - E7: REPUTE-SHARE's faction is the catalog's guild's, never the envelope's word.
// - C1: a copy begun on an earlier build of the port is taken - a bare `make pc ill` writes no `textId`; the Mining
//   quests' old climates are accepted, the receiver's own parse standing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuestMachine, SECONDS_PER_WEEK } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import * as QS from '../../../src/systems/quest/questShare.js';
import { creditKeptKills, KeptKillLedger } from '../../../src/scenes/quest/questFoeHost.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { questlineActionTemplates } from '../../../src/systems/questlines/qlActions.js';
import { freshState } from '../../../src/systems/questlines/qlState.js';
import { packMachine, questSource } from '../../qlSources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const W = read(join(ROOT, 'src/scenes/world.js'));   // the host's share wiring, read by source
{
  const VENDOR = join(ROOT, 'vendor', 'dfu-quests', 'Tables');
  const sources = {};
  for (const f of readdirSync(VENDOR)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, f));
  loadQuestTables(sources);
}

const head = (name) => [`Quest: ${name}`, 'QRC:', 'Message:  1011', ' a reward', '', 'Message:  1012', ' so be it', '', 'QBN:', 'Item _reward_ gold', 'Item _letter_ letter', ''];
const SOURCES = {
  // two deeds and an end that waits on both, paid (questaudit3_share.test.js's)
  __X: [...head('__X'), '_doA_ task:', ' start task _a_', '', '_doB_ task:', ' start task _b_', '', 'variable _a_', 'variable _b_', '',
    '_fin_ task:', ' when _a_ and _b_', ' give pc _reward_', ' end quest'],
  // a question on a click (N0B00Y09's `prompt 1014 yes _S.08_ no _nononono_` shape)
  __PQ: [...head('__PQ'), '_S.07_ task:', ' clicked item _letter_', ' prompt 1011 yes _S.08_ no _no_', '', '_S.08_ task:', ' say 1012', '',
    '_no_ task:', ' say 1012', ''],
  // the sharer hides the NPC it just spoke to (N0B21Y14's `_S.03_`)
  __H: ['Quest: __H', 'QRC:', 'Message:  1011', ' hi', '', 'QBN:', 'Person _oracle_ face 251 named The_Oracle', '',
    '_S.03_ task:', ' start task _went_', ' hide npc _oracle_', '', 'variable _went_', 'variable _pad_'],
  // Runaway Pet's kill, three times
  __KK3: ['Quest: __KK3', 'QRC:', 'Message:  1030', ' Three tigers.', '', 'QBN:', 'Foe _tiger_ is Sabretooth_tiger', '',
    '_S.03_ task:', ' killed 3 _tiger_', ' say 1030', '', 'variable _pad_'],
  // a bare `make pc ill` (C0C00Y10, A0C00Y11, C0B10Y05, Q0C0XY02), and one `saying` its words (S0000007's)
  __ILL: [...head('__ILL'), '_S.01_ task:', ' clicked item _letter_', ' make pc ill with Swamp_Rot', '', 'variable _pad_'],
  __ILLS: [...head('__ILLS'), '_S.01_ task:', ' clicked item _letter_', ' make pc ill with Swamp_Rot saying 1012', '', 'variable _pad_'],
};
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
function machine(extra = {}) {
  const m = new QuestMachine({
    nowSeconds: () => 0, showPopup() {}, lastNPCClicked: () => null, getQuestSourceLines: (n) => SOURCES[n] ?? null,
    offerReward: (_q, it) => { (m.offered ??= []).push(it?.stackCount ?? null); },
    ...extra,
  });
  return m;
}
const take = (m, name) => { const q = m.scheduleQuest(SOURCES[name], 0, { rolls: () => 0 }); m.tick(); return q; };
const env = (m, q) => JSON.parse(JSON.stringify(QS.prepareQuestShare(m, q.uid).data));
const receive = (m, name, data, ctx = {}) => quiet(() => QS.receiveSharedQuest(m, lists, name, data, { online: false, ...ctx }));
const task = (q, name) => q.getTask({ name });
const run = (m, n = 4) => quiet(() => { for (let i = 0; i < n; i++) m.tick(); });
const ended = (q) => !!(q.questComplete || q.questTombstoned || q.ticksToEnd > 0);
const reload = (m, make = machine) => { const save = JSON.parse(JSON.stringify(m.getSaveData())); const m2 = make(); quiet(() => m2.restoreSaveData(save)); return m2; };
const actionsOf = (data, type) => data.tasks.flatMap((t) => t.actions).filter((a) => a.type === type);

// ---- A1 ----

test('QA3 A1: a question whose box is up is asked HERE - the envelope this copy hands on writes it asked, its own save keeps it open, and the partner\'s copy is never asked it; the answer\'s sync carries the choice (mutants: the envelope writes it open, the held places unread)', () => {
  const aBoxes = [], bBoxes = [];
  const A = machine({ showPrompt: (_q, _m, respond) => { aBoxes.push(respond); } });
  const B = machine({ showPrompt: (_q, _m, respond) => { bBoxes.push(respond); } });
  const qa = take(A, '__PQ'); A.markQuestShared('__PQ');
  const qb = receive(B, '__PQ', env(A, qa), { from: 'acct-a' }).quest; B.tick();
  qa.getItem({ name: 'letter' }).setPlayerClicked(); A.tick();   // A's click: A's box comes up
  assert.equal(aBoxes.length, 1, 'A is asked');
  // the host's sync goes out under the box (questSyncTick runs above the modal gate)
  const sent = { ...env(A, qa), sync: 1 };
  assert.equal(receive(B, '__PQ', sent, { from: 'acct-a' }).resync, true);
  run(B, 3);
  assert.equal(bBoxes.length, 0, 'the partner\'s copy is not asked the question A\'s box holds');
  assert.equal(actionsOf(sent, 'Prompt')[0].isComplete, true, 'the envelope: asked');
  assert.equal(actionsOf(JSON.parse(JSON.stringify(qa.getSaveData())), 'Prompt')[0].isComplete, false, 'A\'s own save: open, so a load asks again');
  aBoxes[0](true); run(A, 2);   // A says Yes
  receive(B, '__PQ', { ...env(A, qa), sync: 1 }, { from: 'acct-a' }); run(B, 2);
  const set = (q) => ['S.08', 'no'].filter((n) => task(q, n).triggered);
  assert.deepEqual([set(qa), set(qb)], [['S.08'], ['S.08']], 'one answer, A\'s, on both copies');
  assert.equal(bBoxes.length, 0);
});

// ---- E1 ----

const PAY = '__QLPAY';
// M0B50Y09's patch shape (fightersGuild.json): the ask at the hand-in - 'keep' pays the fee and ends, 'alt' waives it for
// standing and runs on (qa3/lE/p1_sharer_gone.mjs)
const PAY_LINES = [`Quest: ${PAY}`, 'DisplayName: A Choice Shared', 'QRC:', 'QuestorOffer:  [1000]', '<ce> Will you?', '', 'RefuseQuest:  [1001]', '<ce> No.', '', 'AcceptQuest:  [1002]', '<ce> Yes.', '',
  'Message:  1049', '<ce> The ring was taken.', '', 'Message:  1050', '<ce> How will you take your pay?', '', 'Message:  1051', 'The fee', '', 'Message:  1052', 'Waive it', '', 'Message:  1053', 'waived', '',
  'QBN:', 'Item _gold_ gold', '', 'variable _found_', 'variable _keep_', 'variable _alt_', 'variable _standing_', '',
  '_ask_ task:', '\twhen _found_', '\task 1050 choices 1051 _keep_ 1052 _alt_', '',
  '_k_ task:', '\twhen _keep_', '\tgive pc _gold_', '\tend quest', '',
  '_a_ task:', '\twhen _alt_', '\tstart task _standing_', '\tlog 1053 step 1'];
/** A machine over the questline grammar in a party of `party` (a Set of accounts: its size, and who is in it), or with no
 *  word on the party's members at all (`party` null: a host with no `partyHas`). */
function qlMachine(asks, party, size = 2) {
  const m = new QuestMachine({ nowSeconds: () => 1000, getQuestSourceLines: (n) => (n === PAY ? PAY_LINES : null), questlinesStamp: () => ({ ...freshState(), tier: 1 }),
    showChoice: (q, msg, ch, respond) => asks.push({ q, respond }), partySize: () => party?.size ?? size,
    ...(party ? { partyHas: (acct) => party.has(acct) } : {}),
    offerReward: (_q, it) => { (m.paid ??= []).push(it?.stackCount ?? 0); } });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  return m;
}
const choiceOf = (q) => ({ keep: task(q, 'keep').triggered || ended(q), alt: task(q, 'alt').triggered });

test('QA3 E1: a received copy waits at its questline choice while its sharer is in the party - two minutes and more without a change is a journey, not a departure - and its holder is asked once the sharer has left; one choice, the sharer\'s, on both copies (mutants: the sharer unread, the receipt\'s sender, the host\'s word)', () => {
  const party = new Set(['acct-a', 'acct-b']);
  const aAsks = [], bAsks = [];
  const A = qlMachine(aAsks, party), B = qlMachine(bAsks, party);
  const qa = A.startQuestByName(PAY); A.tick(); A.markQuestShared(PAY);
  const qb = receive(B, PAY, env(A, qa), { from: 'acct-a' }).quest;
  receive(A, PAY, { ...env(B, qb), sync: 1 }, { from: 'acct-b' });   // the new copy's answer
  run(A, 1300); run(B, 1300);   // 130 s, the quest unchanged: A rides to the hall, B scouts
  task(qb, 'found').start(); run(B, 3);   // B finds the ring in B's world
  assert.equal(bAsks.length, 0, 'the sharer is in the party: the received copy waits');
  receive(A, PAY, { ...env(B, qb), sync: 1 }, { from: 'acct-b' }); run(A, 3);
  assert.equal(aAsks.length, 1, 'the sharer is asked');
  aAsks[0].respond(1); run(A, 2);   // A waives the fee
  receive(B, PAY, { ...env(A, qa), sync: 1 }, { from: 'acct-a' }); run(B, 6); run(A, 6);
  assert.deepEqual([choiceOf(qa), choiceOf(qb)], [{ keep: false, alt: true }, { keep: false, alt: true }], 'the sharer\'s choice on both copies, and no other');
  assert.deepEqual([A.paid ?? [], B.paid ?? [], bAsks.length], [[], [], 0], 'no fee paid besides the standing: the holder was never a chooser');
  // the sharer leaves before the choice: the holder is asked
  const p2 = new Set(['acct-a', 'acct-b']);
  const cAsks = [], dAsks = [];
  const C = qlMachine(cAsks, p2), D = qlMachine(dAsks, p2);
  const qc = C.startQuestByName(PAY); C.tick(); C.markQuestShared(PAY);
  const qd = receive(D, PAY, env(C, qc), { from: 'acct-a' }).quest;
  task(qd, 'found').start(); run(D, 3);
  assert.equal(dAsks.length, 0, 'waiting on its sharer');
  p2.delete('acct-a'); p2.add('acct-c');   // the sharer leaves; another joins - the party is still two
  run(D, 2);
  assert.equal(dAsks.length, 1, 'the sharer gone: the holder is asked');
  dAsks[0].respond(0); run(D, 6);
  assert.deepEqual([choiceOf(qd), D.paid?.length], [{ keep: true, alt: false }, 1], 'and the holder\'s answer is the copy\'s');
  // a copy whose sharer is not known (an envelope from before the record), or a host with no word on its members, waits
  for (const [who, members] of [[undefined, new Set(['acct-a', 'acct-b'])], ['acct-a', null]]) {
    const asks = [];
    const E = qlMachine([], new Set(['acct-a', 'acct-b'])), F = qlMachine(asks, members);
    const qe = E.startQuestByName(PAY); E.tick(); E.markQuestShared(PAY);
    const qf = receive(F, PAY, env(E, qe), who ? { from: who } : {}).quest;
    task(qf, 'found').start(); run(F, 3);
    assert.equal(asks.length, 0, who ? 'no word on the party: the sharer is read as here' : 'no sharer known: it waits');
  }
  // the host's word: the party's own reader, through the bridge (quiet: a bridge with no host's word reads them here)
  const bridge = (partyHas) => quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: () => null }, classicSeconds: () => 0,
    playerEntity: { name: 'Hero', level: 1, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    ...(partyHas ? { partyHas } : {}),
  }));
  const seen = bridge((acct) => acct === 'acct-a').machine.deps;
  assert.deepEqual([seen.partyHas?.('acct-a'), seen.partyHas?.('acct-z'), bridge(null).machine.deps.partyHas?.('acct-a')], [true, false, true]);
  assert.match(W, /partyHas: \(acct\) => !!social\?\.inMyParty\(acct\),/, 'the world asks its party');
});

test('QA3 E1: sharing a received copy on does not make its holder a second chooser - it waits on the player who shared it while they are in the party, and their answer is the copy\'s (mutants: the share-on clears the receipt)', () => {
  const party = new Set(['acct-a', 'acct-b']);
  const aAsks = [], bAsks = [];
  const A = qlMachine(aAsks, party), B = qlMachine(bAsks, party);
  const qa = A.startQuestByName(PAY); A.tick(); A.markQuestShared(PAY);
  const qb = receive(B, PAY, env(A, qa), { from: 'acct-a' }).quest;
  B.markQuestShared(PAY);   // B presses Share on its received copy, for a member who joined late
  assert.equal(qb.ql?.received, true, 'still a received copy');
  task(qb, 'found').start(); run(B, 3);
  assert.equal(bAsks.length, 0, 'the sharer is in the party: B waits');
  receive(A, PAY, { ...env(B, qb), sync: 1 }, { from: 'acct-b' }); run(A, 3);
  assert.equal(aAsks.length, 1);
  aAsks[0].respond(1); run(A, 2);
  receive(B, PAY, { ...env(A, qa), sync: 1 }, { from: 'acct-a' }); run(B, 6);
  assert.deepEqual([choiceOf(qa), choiceOf(qb), B.paid ?? []], [{ keep: false, alt: true }, { keep: false, alt: true }, []], 'one choice: the fee waived, never taken too');
});

// ---- E2 ----

test('QA3 E2: the share memory rides the save - a copy\'s holders heard come back with a load, so its purse is still split; a received copy\'s sharer comes back, so it still waits on them; a game with nothing shared writes none (mutants: the memory unwritten, the holders unwritten, the sharer unwritten, the holders unread, the sharer unread, the guard)', () => {
  const mk = () => machine({ partySize: () => 2 });
  const A = mk(), B = mk();
  const qa = take(A, '__X'); const first = env(A, qa); A.markQuestShared('__X');
  const qb = receive(B, '__X', first, { from: 'acct-a' }).quest; B.tick();
  receive(A, '__X', { ...env(B, qb), sync: 1 }, { from: 'acct-b' });   // B's answer: B holds it
  assert.equal(qa.hooks.rewardShares(qa), 2);
  const A2 = reload(A, mk);
  const q2 = A2.sharedCandidateNamed('__X');
  assert.equal(q2.hooks.rewardShares(q2), 2, 'after a load: two copies still hold it');
  task(q2, 'doA').start(); task(q2, 'doB').start(); run(A2, 8);
  assert.deepEqual(A2.offered, [37], 'two shares of 75, as before the load - never the whole purse');
  // the record's shape: the port's own field
  assert.deepEqual(JSON.parse(JSON.stringify(A.getSaveData())).shareMemory, { inStep: ['__X'], finishedIds: [], finishedNames: [], holders: [[qa.uid, ['acct-b']]], sharers: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(B.getSaveData())).shareMemory.sharers, [[qb.uid, 'acct-a']], 'B\'s copy: A shared it');
  // the sharer: B's copy, loaded, waits on A while A is in the party
  const party = new Set(['acct-a', 'acct-b']);
  const aAsks = [], bAsks = [];
  const QA = qlMachine(aAsks, party), QB = qlMachine(bAsks, party);
  const qla = QA.startQuestByName(PAY); QA.tick(); QA.markQuestShared(PAY);
  receive(QB, PAY, env(QA, qla), { from: 'acct-a' });
  const QB2 = reload(QB, () => qlMachine(bAsks, party));
  const qlb = QB2.sharedCandidateNamed(PAY);
  assert.equal(QB2.hasSharedQuestNamed(PAY), true);
  task(qlb, 'found').start(); run(QB2, 3);
  assert.equal(bAsks.length, 0, 'loaded: still waiting on its sharer');
  party.delete('acct-a'); party.add('acct-c');   // the sharer leaves, another joins: still a party of two
  run(QB2, 2);
  assert.equal(bAsks.length, 1, 'and asked once they have gone');
  // nothing shared: the envelope is the shape it always was
  const C = machine();
  take(C, '__X');
  assert.equal(Object.hasOwn(C.getSaveData(), 'shareMemory'), false);
});

// ---- E3 ----

const tigerOf = (q) => [...q.resources.values()].find((r) => r.isFoe);
const rowOf = (i) => [{ q: '__KK3', s: 'tiger', i }];
test('QA3 E3: a kill an envelope brought is spent only by its own sender\'s credit - a third member\'s kill, which no envelope carries, is never swallowed by another\'s: three tigers close `killed 3` on both copies (mutants: the credit\'s owner unread, the host\'s owner, the envelope\'s sender, the learned kept by sender)', () => {
  const A = machine(), B = machine();
  const qa = take(A, '__KK3'); A.markQuestShared('__KK3');
  const qb = receive(B, '__KK3', env(A, qa), { from: 'acct-a' }).quest; B.tick();
  // each holder kills one in its own world, the other elsewhere (no fall seen, no credit); each envelope crosses
  tigerOf(qb).incrementKills(); run(B, 2); receive(A, '__KK3', { ...env(B, qb), sync: 1 }, { from: 'acct-b' });
  tigerOf(qa).incrementKills(); run(A, 2); receive(B, '__KK3', { ...env(A, qa), sync: 1 }, { from: 'acct-a' });
  // the third member H holds no copy (KEPT-KILL): H's tiger reaches each holder as a credit alone
  creditKeptKills(A, new KeptKillLedger(), 'acct-h', rowOf(1), 0);
  creditKeptKills(B, new KeptKillLedger(), 'acct-h', rowOf(1), 0);
  run(A, 2); run(B, 2);
  receive(B, '__KK3', { ...env(A, qa), sync: 1 }, { from: 'acct-a' }); receive(A, '__KK3', { ...env(B, qb), sync: 1 }, { from: 'acct-b' }); run(A, 2); run(B, 2);
  assert.deepEqual([tigerOf(qa).killCount, tigerOf(qb).killCount], [3, 3], 'three tigers, three kills');
  assert.deepEqual([task(qa, 'S.03').triggered, task(qb, 'S.03').triggered], [true, true], '`killed 3` closed on both copies');
  // the owner's credit spends the owner's own learned kill, and only it
  const C = machine(), D = machine();
  const qc = take(C, '__KK3'); C.markQuestShared('__KK3');
  const qd = receive(D, '__KK3', env(C, qc), { from: 'acct-c' }).quest; D.tick();
  tigerOf(qc).incrementKills(); tigerOf(qc).incrementKills();
  receive(D, '__KK3', { ...env(C, qc), sync: 1 }, { from: 'acct-c' });   // C's two kills, its envelope first
  assert.equal(tigerOf(qd).killCount, 2);
  assert.equal(tigerOf(qd).creditPartnerKill('acct-e'), true, 'E\'s fall, which no envelope brought: counted');
  assert.equal(tigerOf(qd).killCount, 3);
  assert.equal(creditKeptKills(D, new KeptKillLedger(), 'acct-c', rowOf(1), 0), 1, 'C\'s word for a kill its envelope brought...');
  assert.equal(creditKeptKills(D, new KeptKillLedger(), 'acct-c', rowOf(2), 0), 1);
  assert.equal(tigerOf(qd).killCount, 3, '...spent: neither counted twice');
  assert.match(W, /foe\.creditPartnerKill\?\.\(owner\);/, 'the world names whose fall it is');
});

// ---- E4 ----

test('QA3 E4: a copy new here answers "held" - merged by nobody, so the sharer\'s act since the share stands (a `hide npc` stays done), and its host\'s baseline is what it was; once changed it never answers held again (mutants: the answer unmarked, the mark unread, the held arm, the receipt\'s signature, the baseline, the stale mark)', () => {
  const mk = () => machine({ partySize: () => 3 });
  const A = mk(), B = mk();
  const qa = take(A, '__H'); const share = env(A, qa); A.markQuestShared('__H');
  const qb = receive(B, '__H', share, { from: 'acct-a' }).quest; B.tick();
  task(qa, 'S.03').start(); run(A, 2);   // the sharer acts at once - its own sync cannot leave for QUEST_SEND_MS
  const oracle = (q) => [...q.resources.values()].find((r) => r.isPerson);
  assert.equal(oracle(qa).isHidden, true);
  const answer = { ...env(B, qb), sync: 1 };   // the receiver's host: its first check sends the new copy
  const r = receive(A, '__H', answer, { from: 'acct-b' });
  run(A, 4);
  assert.equal(oracle(qa).isHidden, true, 'the sharer\'s `hide npc` stands');
  assert.equal(task(qa, 'went').triggered, true);
  assert.deepEqual([answer.held, r.ok, r.resync, r.held, r.quest === qa], [1, true, true, true, true], 'a held word: B holds it');
  assert.equal(qa._holdersHeard?.has('acct-b'), true, 'B named a holder');
  assert.equal(QS.syncBaselineAfter(qa, r, 'sig-before'), 'sig-before', 'nothing merged: the host\'s baseline is what it was');
  assert.match(W, /_questSyncSeen\.set\(quest\.questName, syncBaselineAfter\(q, result, _questSyncSeen\.get\(quest\.questName\)\)\);/, 'the host hands it the baseline it had');
  // the copy changed (the sharer's sync), and changed back: no longer the copy as it came
  receive(B, '__H', { ...env(A, qa), sync: 1 }, { from: 'acct-a' }); run(B, 2);
  assert.equal(env(B, qb).held, undefined, 'changed since it came: its sync is a sync');
  const E = mk(), F = mk();
  const qe = take(E, '__X'); E.markQuestShared('__X');
  const qf = receive(F, '__X', env(E, qe), { from: 'acct-e' }).quest; F.tick();
  assert.equal(env(F, qf).held, 1);
  task(qf, 'a').start();
  assert.equal(env(F, qf).held, undefined);
  task(qf, 'a').clear();
  assert.equal(env(F, qf).held, undefined, 'a copy that has changed is never the new copy again');
});

test('QA3 E4: a member who refused the share hears nothing of each held answer - only the share itself is answered, and a deliberate share always (mutants: the refusal not quiet, the quiet unread, a deliberate share read as held)', () => {
  const A = machine(), B = machine(), C = machine();
  const qa = take(A, '__X'); const share = env(A, qa); A.markQuestShared('__X');
  const qb = receive(B, '__X', share, { from: 'acct-a' }).quest; B.tick();
  take(C, '__X');   // C holds a copy of its own
  const said = new Set();
  const copy = (d) => `${d.shareId ?? ''}|${d.build ?? ''}`;
  const refused = receive(C, '__X', share, { from: 'acct-a' });
  assert.equal(QS.sayShareRefusal(said, 'acct-a', '__X', refused, false, copy(share)), true, 'the share: answered');
  const answer = { ...env(B, qb), sync: 1 };
  const r = receive(C, '__X', answer, { from: 'acct-b' });
  assert.deepEqual([r.ok, r.reason, r.quiet], [false, 'active', true]);
  assert.equal(QS.sayShareRefusal(said, 'acct-b', '__X', r, true, copy(answer)), false, 'B\'s held answer: nothing said');
  assert.equal(said.size, 1, 'and nothing counted as said');
  // B shares its copy on, deliberately, unchanged since it came: a share, answered
  const onward = env(B, qb);
  assert.equal(onward.sync, undefined);
  const d = receive(C, '__X', onward, { from: 'acct-b' });
  assert.deepEqual([d.ok, d.reason, d.quiet], [false, 'active', undefined]);
  assert.equal(QS.sayShareRefusal(said, 'acct-b', '__X', d, false, copy(onward)), true, 'a deliberate share is always answered');
});

// ---- A6 / E6 ----

test('QA3 A6/E6: a load keeps what the share memory said - a copy set aside and reclaimed stays out of the party\'s step, its own progress its own; a finished copy is remembered by its identity and by its name after its tombstone\'s week (mutants: the memory unread, the inference run beside it, the in-step unwritten, the identities unwritten or unread, the names unwritten or unread)', () => {
  const A = machine();
  const qa = take(A, '__X'); const first = env(A, qa); A.markQuestShared('__X');
  let B = machine();
  const qb = receive(B, '__X', first, { from: 'acct-a' }).quest; B.tick();
  assert.equal(B.shelveQuest(qb.uid).ok, true);
  assert.equal(B.reclaimQuest(qb.uid).ok, true);
  assert.equal(B.hasSharedQuestNamed('__X'), false, 'reclaimed: out of the party\'s step');
  task(qb, 'doB').start(); run(B, 2);   // B goes on alone
  B = reload(B);
  assert.equal(B.hasSharedQuestNamed('__X'), false, 'a load does not put it back');
  task(qa, 'doA').start(); run(A, 2);
  assert.deepEqual(receive(B, '__X', { ...env(A, qa), sync: 1 }, { from: 'acct-a' }), { ok: false, reason: 'active' }, 'the party\'s sync is not taken');
  const mine = B.sharedCandidateNamed('__X');
  assert.deepEqual([task(mine, 'a').triggered, task(mine, 'b').triggered], [false, true], 'B\'s copy is B\'s');
  // a running copy in step stays in step (SHARE-MEMORY)
  let G = machine();
  receive(G, '__X', env(A, qa), { from: 'acct-a' }); G.tick();
  G = reload(G);
  assert.equal(G.hasSharedQuestNamed('__X'), true);
  // a finished copy, its tombstone's week over, then a load
  const clock = { t: 0 };
  const mk = () => machine({ nowSeconds: () => clock.t });
  const C = mk();
  const qc = take(C, '__X'); const share = env(C, qc); C.markQuestShared('__X');
  let D = mk();
  const qd = receive(D, '__X', share, { from: 'acct-c' }).quest; D.tick();
  task(qd, 'doA').start(); task(qd, 'doB').start(); run(D, 8);
  assert.deepEqual([qd.questTombstoned, D.offered?.length], [true, 1], 'D finished its copy, paid');
  clock.t += SECONDS_PER_WEEK + 60; run(D, 2);
  assert.equal(D.getQuest(qd.uid), null, 'the tombstone\'s week is over');
  D = reload(D, mk);
  assert.deepEqual(receive(D, '__X', { ...env(C, qc), sync: 1 }, { from: 'acct-c' }), { ok: false, reason: 'done' }, 'the same copy: done, by its identity');
  const older = env(C, qc); delete older.shareId;
  assert.deepEqual(receive(D, '__X', older, { from: 'acct-c' }), { ok: false, reason: 'done' }, 'an envelope with none (an older client\'s): done, by its name');
  assert.equal(D.offered, undefined, 'never handed over fresh, never paid again');
  D = reload(D, mk);
  assert.deepEqual(receive(D, '__X', share, { from: 'acct-c' }), { ok: false, reason: 'done' }, 'and the next load remembers it too');
});

// ---- E7 ----

test('QA3 E7: REPUTE-SHARE\'s faction is the catalog\'s - the quest\'s own guild (the Mages Guild for both gated quests), never the faction the envelope names: a forged factionId does not pass the gate (mutants: the envelope\'s word)', () => {
  const catalog = quiet(() => createQuestBridge({
    data: { readListTable: (name) => { try { return read(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`)); } catch { return null; } }, getQuestSourceLines: (n) => questSource(n, false) },
    classicSeconds: () => 0,
    playerEntity: { name: 'Hero', level: 12, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
  })).questLists;
  assert.equal(catalog.findQuestMeta('N0B10Y03')?.quest?.group, 'MagesGuild', 'the real catalog\'s row');
  const asked = [];
  const standing = { 40: 0, 41: 50 };   // a new Mages Guild member, well thought of by the Fighters Guild
  const m = new QuestMachine({ nowSeconds: () => 0, getReputation: (fid) => { asked.push(fid); return standing[fid] ?? 0; } });
  const memberships = { 10: { guild: 'MagesGuild' } };
  const was = globalThis.location;
  try {
    globalThis.location = { search: '?online' };
    for (const name of ['N0B10Y03', 'N0B20Y02']) {
      asked.length = 0;
      assert.equal(QS.canReceiveSharedQuest(m, catalog, name, { memberships, factionId: 41 }).reason, 'repute', `${name}: the envelope says the Fighters Guild - refused all the same`);
      assert.deepEqual(asked, [40], 'the Mages Guild\'s standing is asked');
    }
    asked.length = 0;
    assert.equal(QS.receiveSharedQuest(m, catalog, 'N0B10Y03', { questName: 'N0B10Y03', factionId: 41 }, { memberships, online: true }).reason, 'repute', 'the receipt asks it');
    assert.deepEqual(asked, [40]);
    standing[40] = 10;
    assert.equal(QS.canReceiveSharedQuest(m, catalog, 'N0B10Y03', { memberships, factionId: 0 }).ok, true, 'the guild\'s own standing reached');
  } finally {
    if (was === undefined) delete globalThis.location; else globalThis.location = was;
  }
});

// ---- C1 ----

test('QA3 C1: a copy begun on an earlier build of the port is shared on this one - a bare `make pc ill` writes no `textId`, and an envelope without one is taken; a `saying` keeps its words through a load (mutants: the field written always, the saying unread on restore)', () => {
  const A = machine(), B = machine();
  const qa = take(A, '__ILL'); A.markQuestShared('__ILL');
  const sent = env(A, qa);
  const old = JSON.parse(JSON.stringify(sent));
  for (const a of actionsOf(old, 'MakePcDiseased')) delete a.actionSpecific.textId;   // origin/main's build writes none
  const r = receive(B, '__ILL', old, { from: 'acct-a' });
  assert.equal(r.ok, true, `an envelope without the field is taken (${r.reason})`);
  assert.deepEqual(actionsOf(sent, 'MakePcDiseased').map((a) => Object.keys(a.actionSpecific)), [['diseaseType']], 'a bare one writes the disease alone');
  assert.equal(receive(A, '__ILL', { ...env(B, r.quest), sync: 1 }, { from: 'acct-b' }).resync, true, 'and the copy goes back and forth');
  // `saying N`: its words are save state, and a load keeps them
  const S = machine();
  const qs = take(S, '__ILLS');
  assert.deepEqual(actionsOf(JSON.parse(JSON.stringify(qs.getSaveData())), 'MakePcDiseased')[0].actionSpecific, { diseaseType: actionsOf(sent, 'MakePcDiseased')[0].actionSpecific.diseaseType, textId: 1012 });
  const S2 = reload(S);
  const ill = [...S2.getQuest(qs.uid).tasks.values()].flatMap((t) => t.actions).find((a) => a.typeName === 'MakePcDiseased');
  assert.equal(ill.textId, 1012, 'loaded: the words it says');
  assert.equal(actionsOf(JSON.parse(JSON.stringify(S2.getQuest(qs.uid).getSaveData())), 'MakePcDiseased')[0].actionSpecific.textId, 1012, 'and saved again');
});

test('QA3 C1: a Mining quest copy begun before CLIMATE-NAMES (`climate desert2` read 224, `mountainwoods` 226) is taken, and the receiver\'s own parse stands - 225 and 230; any other number is still a forgery (mutants: the legacy unread, the legacy table, the legacy check)', () => {
  const A = packMachine(), B = packMachine(), C = packMachine();
  const qa = quiet(() => A.startQuestByName('MiningQuest')); quiet(() => A.tick());
  const data = JSON.parse(JSON.stringify(QS.prepareQuestShare(A, qa.uid).data));
  const climates = (d) => actionsOf(d, 'Climate').map((a) => a.actionSpecific.climate);
  assert.deepEqual(climates(data), [224, 225, 226, 230], 'desert, desert2, mountain, mountainwoods - this build\'s read');
  const old = JSON.parse(JSON.stringify(data));
  for (const a of actionsOf(old, 'Climate')) a.actionSpecific.climate = { 225: 224, 230: 226 }[a.actionSpecific.climate] ?? a.actionSpecific.climate;
  assert.deepEqual(climates(old), [224, 224, 226, 226], 'the copy as an earlier build read it');
  const r = receive(B, 'MiningQuest', old, { from: 'acct-a' });
  assert.equal(r.ok, true, `taken (${r.reason})`);
  const own = [...r.quest.tasks.values()].flatMap((t) => t.actions).filter((a) => a.typeName === 'Climate').map((a) => a.climate);
  assert.deepEqual(own, [224, 225, 226, 230], 'the receiver\'s own climates');
  for (const [at, forged] of [[1, 227], [3, 224], [0, 225]]) {
    const bad = JSON.parse(JSON.stringify(data));
    actionsOf(bad, 'Climate')[at].actionSpecific.climate = forged;
    assert.equal(receive(C, 'MiningQuest', bad, { from: 'acct-a' }).reason, 'mismatch', `climate ${forged} where ${climates(data)[at]} stands: refused`);
  }
});

// ---- the share lane's own audit of these fixes ----

test('QA3 A6/E1/E4 (the fixes\' own audit): a copy ever shared writes its memory, so the sharer\'s own copy - nobody heard - set aside and reclaimed stays out of step after a load; an older save\'s received copy is its holder\'s to answer; a deliberate Share of a copy unchanged since it came is a held word to a holder (mutants: the memory written only when full, the older save\'s received kept, the deliberate share merged)', () => {
  const A = machine();
  const qa = take(A, '__X'); env(A, qa); A.markQuestShared('__X');   // shared; every member refused - nobody heard
  assert.equal(A.shelveQuest(qa.uid).ok, true);
  assert.equal(A.reclaimQuest(qa.uid).ok, true);
  assert.equal(A.hasSharedQuestNamed('__X'), false);
  assert.ok(A.getSaveData().shareMemory, 'a copy with a share writes the memory, empty of step');
  assert.equal(reload(A).hasSharedQuestNamed('__X'), false, 'reclaimed, it stays out of step after a load');
  // an older save: its received copy, no memory, no sharer
  const B = machine();
  const S0 = machine(); const q0 = take(S0, '__X');
  const qb = receive(B, '__X', env(S0, q0), { from: 'acct-a' }).quest;
  qb.ql = { ...freshState(), received: true };
  const save = JSON.parse(JSON.stringify(B.getSaveData()));
  delete save.shareMemory;
  const B2 = machine();
  quiet(() => B2.restoreSaveData(save));
  assert.equal(B2.sharedCandidateNamed('__X')?.ql?.received, false, 'loaded from an older save: its holder answers, never a wait on nobody');
  // a deliberate Share, unchanged since it came, to the sharer who acted since
  const mk = () => machine({ partySize: () => 2 });
  const S = mk(), R = mk();
  const qs = take(S, '__H'); const share = env(S, qs); S.markQuestShared('__H');
  const qr = receive(R, '__H', share, { from: 'acct-s' }).quest; R.tick();
  task(qs, 'S.03').start(); run(S, 2);
  const onward = env(R, qr);
  assert.deepEqual([onward.sync, onward.held], [undefined, 1], 'a deliberate share of the copy as it came');
  const r = receive(S, '__H', onward, { from: 'acct-r' });
  run(S, 4);
  assert.deepEqual([r.ok, r.held], [true, true]);
  assert.equal([...qs.resources.values()].find((x) => x.isPerson).isHidden, true, 'the sharer\'s `hide npc` stands');
});
