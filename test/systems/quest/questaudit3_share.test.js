// QUEST-AUDIT III (2026-10-23, the owner: "Can you do a detailed quest audit, fix any and all outstanding issues. Do not
// worry about DFU parity."; bible/01-Overview/audits/Quest-Audit-III.md). The audit's party-share fixes, each pinned here
// through the real machine and the real share path (prepareQuestShare -> receiveSharedQuest), two or three machines
// passing real envelopes:
//
// - SAME-COPY: a share of another COPY of a quest I keep in step (a member's own copy of a repeatable quest, a
//   stranger's final) is refused - by name it replaced this copy's progress and identity, or ended and paid it.
// - SHARE-MEMORY: a load keeps a running shared copy in step with its party again, and remembers a finished one.
// - SHARER-GONE: a received copy waits at a questline choice for its sharer only while the sharer is in the party.
// - PROGRESS-KEPT: a resync keeps the tasks and the journal steps this copy set, unless the partner's copy cleared them.
// - BUSY-SYNC: an ordinary sync the hub refused as 'busy' is sent again at the next check.
// - GOLD-HOLDERS: a shared quest's gold is split among the copies held, never more than the party; GOLD-ONCE's paid
//   mark is each holder's own.
// - GUARD-HOLDER: GUARD-ONLINE's watch (DailyFrom's guardAnchor, guardAway) is the holder's, never the partner's.
// - KILL-ONCE: a partner's kill an envelope already brought is not counted again when its credit comes.
// - REPUTE-SHARE: REPUTE-GATE's two quests are refused online to a receiver below the standing their headers name.
// - SHARE-WORDS: the receiver's lines and every refusal word go through the text core.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuestMachine } from '../../../src/systems/quest/machine.js';   // PIN MOVED (AUDIT QA3 E1): SHARER_QUIET_TICKS is gone - the wait reads the sharer's seat, not the party's silence
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import * as QS from '../../../src/systems/quest/questShare.js';
import { takeLocalActions, sharedActionMatches } from '../../../src/systems/quest/shareActions.js';
import { ONLINE_REPUTE_GATES } from '../../../src/systems/quest/onlineRepute.js';
import { creditKeptKills, KeptKillLedger } from '../../../src/scenes/quest/questFoeHost.js';
import { questlineActionTemplates } from '../../../src/systems/questlines/qlActions.js';
import { freshState } from '../../../src/systems/questlines/qlState.js';
import { setLocale, patchLocaleTable, clearLocaleTables, parseStringTableCsv } from '../../../src/systems/textManager.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const src = (p) => read(join(ROOT, p));
const W = src('src/scenes/world.js');   // the host's share wiring, read by source and lifted
{
  const VENDOR = join(ROOT, 'vendor', 'dfu-quests', 'Tables');
  const sources = {};
  for (const f of readdirSync(VENDOR)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, f));
  loadQuestTables(sources);
}

const head = (name) => [`Quest: ${name}`, 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:', 'Item _reward_ gold', ''];
const SOURCES = {
  // two deeds, an end that waits on both (the lane's crossing quest)
  __X: [...head('__X'), '_doA_ task:', ' start task _a_', '', '_doB_ task:', ' start task _b_', '', 'variable _a_', 'variable _b_', '',
    '_fin_ task:', ' when _a_ and _b_', ' give pc _reward_', ' end quest'],
  // a deed and a journal step, the partner's undoing of both, and the deed done again (and a deed of the partner's own)
  __P: [...head('__P'), '_doA_ task:', ' start task _a_', ' log 1011 step 0', '', '_doB_ task:', ' start task _b_', '',
    '_doC_ task:', ' start task _c_', '',
    '_undo_ task:', ' clear _a_', ' remove log step 0', '', '_redo_ task:', ' start task _a_', '', 'variable _a_', 'variable _b_',
    'variable _c_', '',
    '_fin_ task:', ' when _a_ and _b_', ' end quest'],
  // a quest's gold, taken by `get item` (GOLD-ONCE), and an end
  __G: [...head('__G'), '_pay_ task:', ' get item _reward_', '', 'variable _a_', '', '_fin_ task:', ' when _a_', ' end quest'],
  // Runaway Pet's kill (keptkill.test.js's), twice
  __KK: ['Quest: __KK', 'QRC:', 'Message:  1030', ' Two tigers.', '', 'QBN:', 'Foe _tiger_ is Sabretooth_tiger', '',
    '_S.03_ task:', ' killed 2 _tiger_', ' say 1030', '', 'variable _pad_'],
};
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
function machine(extra = {}) {
  const m = new QuestMachine({
    nowSeconds: () => 0, showPopup() {}, lastNPCClicked: () => null, getQuestSourceLines: (n) => SOURCES[n] ?? null,
    offerReward: (_q, it) => { (m.offered ??= []).push(it?.stackCount ?? null); },
    addGold: (n) => { m.gold = (m.gold ?? 0) + n; },
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
/** A load of the envelope as a build before AUDIT QA3's share memory wrote it - no `shareMemory`, read from its quests. */
const reloadOld = (m, make = machine) => { const save = JSON.parse(JSON.stringify(m.getSaveData())); delete save.shareMemory; const m2 = make(); quiet(() => m2.restoreSaveData(save)); return m2; };
const itemOf = (q) => [...q.resources.values()].find((r) => r.isItem);

// ---- SAME-COPY ----

test('SAME-COPY: a share of ANOTHER copy of a quest I keep in step is refused as mine - a member\'s own copy of it, a stranger\'s final; my copy, its progress and its identity stand (mutants: the gate)', () => {
  const A = machine(), B = machine(), C = machine();
  const qa = take(A, '__X');
  const first = env(A, qa); A.markQuestShared('__X');
  const qb = receive(B, '__X', first).quest; B.tick();
  task(qa, 'doA').start(); run(A, 2);
  assert.equal(receive(B, '__X', env(A, qa)).resync, true, 'the same copy: kept in step');
  run(B, 2);
  // C took the same repeatable quest at their own hall, and shares THEIR copy with the party
  const qc = take(C, '__X');
  const theirs = env(C, qc); C.markQuestShared('__X');
  assert.notEqual(theirs.shareId, first.shareId);
  for (const [m, q] of [[A, qa], [B, qb]]) {
    assert.deepEqual(receive(m, '__X', theirs), { ok: false, reason: 'active' }, 'another copy: refused as one I have');
    run(m, 4);
    assert.equal(q.shareId, first.shareId, 'my copy keeps its identity');
    assert.equal(task(q, 'a').triggered, true, 'and its progress');
  }
  // a stranger's FINAL ends nothing: D keeps D's own copy in step, A finishes A's
  const A2 = machine(), D = machine();
  const own = take(A2, '__X'); QS.prepareQuestShare(A2, own.uid); A2.markQuestShared('__X');
  const qd = take(D, '__X'); QS.prepareQuestShare(D, qd.uid); D.markQuestShared('__X');
  task(own, 'doA').start(); task(own, 'doB').start(); run(A2, 8);
  const fin = A2.nextFinishedShare();
  assert.ok(fin, 'A\'s final waits to be sent');
  const r = receive(D, '__X', { ...QS.prepareShareData(fin).data, sync: 1, final: 1 });
  run(D, 4);
  assert.deepEqual([r.ok, r.reason, ended(qd), D.offered ?? []], [false, 'active', false, []], 'D\'s copy runs on, and D is paid for nothing');
});

test('SAME-COPY: an envelope with no identity (an older client\'s), or my copy with none (a save from before DISC22-F), is answered by name as before - a resync (mutants: each identity\'s guard)', () => {
  const A = machine(), B = machine();
  const qa = take(A, '__X');
  const first = env(A, qa); A.markQuestShared('__X');
  const qb = receive(B, '__X', first).quest; B.tick();
  const older = env(A, qa); delete older.shareId;
  assert.equal(receive(B, '__X', older).resync, true, 'no identity on the envelope: the name decides');
  qb.shareId = null;
  assert.equal(receive(B, '__X', env(A, qa)).resync, true, 'no identity on my copy: the name decides');
});

// ---- SHARE-MEMORY ----
// PIN MOVED (AUDIT QA3 A6/E6): the share memory is save state now (machine.js shareMemory) and a load reads it - read from
// the quests themselves (a copy's share identity), it put a reclaimed copy back in step and forgot a finished one after its
// tombstone's week. That reading stays for an envelope saved before the field (`reloadOld`), so each law below is held
// through both loads.

test('SHARE-MEMORY: a load keeps a running shared copy in step with its party - the partner\'s sync is taken, and their final ends it and pays once (mutants: the running copy forgotten)', () => {
  for (const load of [reload, reloadOld]) {   // PIN MOVED (AUDIT QA3 A6/E6): the memory saved, and an envelope from before it
    const A = machine();
    let B = machine();
    const qa = take(A, '__X'); A.markQuestShared('__X');
    receive(B, '__X', env(A, qa)); B.tick();
    B = load(B);
    const qb = B.sharedCandidateNamed('__X');
    assert.ok(qb, 'the copy loaded');
    assert.equal(B.hasSharedQuestNamed('__X'), true, 'and is in step with its party again');
    task(qa, 'doA').start(); run(A, 2);
    assert.equal(receive(B, '__X', { ...env(A, qa), sync: 1 }).resync, true, 'the partner\'s sync is taken');
    task(qa, 'doB').start(); run(A, 8);
    const fin = A.nextFinishedShare();
    assert.ok(qa.questComplete && fin);
    assert.equal(receive(B, '__X', { ...QS.prepareShareData(fin).data, sync: 1, final: 1 }).ok, true, 'and their final');
    run(B, 6);
    assert.equal(ended(qb), true, 'which ends the loaded copy');
    assert.equal(B.offered?.length, 1, 'its reward paid once');
  }
});

test('SHARE-MEMORY: a load remembers a shared copy finished - the partner still on it cannot hand it over fresh and pay it again; a copy never shared, or one set aside, is not put in step (mutants: the finished copy forgotten, the guards)', () => {
  const A = machine();
  const qa = take(A, '__X'); A.markQuestShared('__X');
  const first = env(A, qa);
  for (const load of [reload, reloadOld]) {   // PIN MOVED (AUDIT QA3 A6/E6): the memory saved, and an envelope from before it
    let B = machine();
    const qb = receive(B, '__X', first).quest; B.tick();
    task(qb, 'doA').start(); task(qb, 'doB').start(); run(B, 8);
    assert.deepEqual([qb.questTombstoned, B.offered?.length], [true, 1], 'B finished its copy, paid');
    B = load(B);
    assert.deepEqual(receive(B, '__X', { ...env(A, qa), sync: 1 }), { ok: false, reason: 'done' }, 'the same copy, after the load: done');
    assert.equal(B.offered, undefined, 'never paid again');
  }
  // a quest of B's own, never shared, and a shared copy B set aside
  const C = machine();
  take(C, '__X');
  let L = reload(C);
  assert.equal(L.hasSharedQuestNamed('__X'), false, 'never shared: not in step after a load');
  assert.equal(L.finishedShareIds.size, 0);
  const D = machine();
  const qd = receive(D, '__X', env(A, qa)).quest; D.tick();
  assert.equal(D.shelveQuest(qd.uid).ok, true);
  L = reload(D);
  assert.equal(L.hasSharedQuestNamed('__X'), false, 'set aside: it left the party\'s step, and a load does not put it back');
  // PIN MOVED (AUDIT QA3 A6, the fixes' own audit): a copy ever shared writes the memory, so the read from identities
  // is an older save's alone - and there too a copy set aside stays out of step
  assert.equal(reloadOld(D).hasSharedQuestNamed('__X'), false, 'an older save: set aside, out of step');
  assert.equal(L.getQuest(qd.uid)?.shareId, qd.shareId, 'though it keeps its identity');
});

// ---- SHARER-GONE ----

const FLOW = '__QLFLOW';
const FLOW_LINES = [`Quest: ${FLOW}`, 'DisplayName: A Choice Shared', 'QRC:', 'QuestorOffer:  [1000]', '<ce> Will you?', '', 'RefuseQuest:  [1001]', '<ce> No.', '', 'AcceptQuest:  [1002]', '<ce> Yes.', '',
  'Message:  1049', '<ce> The ring was taken.', '', 'Message:  1050', '<ce> Who gets the ring?', '', 'Message:  1051', 'The Guild', '', 'Message:  1052', 'The fence', '',
  'QBN:', '', 'variable _found_', 'variable _guild_', 'variable _fence_', '',
  '_tell_ task:', '\twhen _found_', '\tsay 1049', '\tstart task _ask_', '', '_ask_ task:', '\task 1050 choices 1051 _guild_ 1052 _fence_', '',
  '_g_ task:', '\twhen _guild_', '\tend quest', '', '_f_ task:', '\twhen _fence_', '\tend quest'];
/** `members`: the party's accounts (machine deps.partyHas, the host's `social.inMyParty`); none given, no such word. */
function qlMachine(asks, partySize, members = null) {
  const m = new QuestMachine({ nowSeconds: () => 1000, getQuestSourceLines: (n) => (n === FLOW ? FLOW_LINES : null), questlinesStamp: () => ({ ...freshState(), tier: 1 }),
    showChoice: (q, msg, ch, respond) => asks.push({ q, respond }), partySize: () => partySize, ...(members ? { partyHas: (acct) => members.has(acct) } : {}) });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  return m;
}

// PIN MOVED (AUDIT QA3 E1): the wait read the party's silence - an envelope of the copy within SHARER_QUIET_TICKS - and two
// minutes without a change is a journey: the holder asked under a sharer still there answered the same choice twice. It
// reads the sharer's seat now (machine.js sharerHere: the receipt's `from`, in the party), so this test is re-cut on it.
test('SHARER-GONE: a received copy waits at its choice while its sharer is in the party, however long the party is quiet, and its holder is asked once the sharer has left (mutants: the sharer unread, the receipt\'s sender unkept, the party unread)', () => {
  const members = new Set(['acct-a', 'acct-b']);
  const aAsks = [], bAsks = [];
  const A = qlMachine(aAsks, 2, members), B = qlMachine(bAsks, 2, members);
  const qa = A.startQuestByName(FLOW); A.tick(); A.markQuestShared(FLOW);
  const qb = receive(B, FLOW, env(A, qa), { from: 'acct-a' }).quest;
  assert.equal(qb.ql?.received, true);
  task(qb, 'found').start(); run(B, 6);
  assert.equal(bAsks.length, 0, 'the sharer chooses: the received copy waits');
  run(B, 2500);
  assert.equal(bAsks.length, 0, 'the party quiet for four minutes, the sharer still in it: still waiting');   // PIN MOVED (AUDIT QA3 E1): quiet past SHARER_QUIET_TICKS, it asked
  members.delete('acct-a');   // PIN MOVED (AUDIT QA3 E1): the sharer's leaving, not the quiet, is what asks
  run(B, 2);
  assert.equal(bAsks.length, 1, 'the sharer gone: its holder is asked');
  bAsks[0].respond(1); run(B, 6);
  assert.equal(ended(qb), true, 'and the holder\'s answer ends it');
  assert.equal(aAsks.length, 0);
});

test('SHARER-GONE: the wait reads the party, not the holders heard - a party of two waits before its sharer is named; a party of one asks at once; a copy its holder shared on, and a copy loaded, wait on their sharer (mutants: the party read as the holders, the share-on chooses, the unknown sharer read as gone)', () => {
  // PIN MOVED (AUDIT QA3 E1): a copy its holder shared on asked at once - its holder made a second chooser while the
  // sharer was still in the party; it waits now ([2, true, 0])
  for (const [party, shareOn, asked] of [[2, false, 0], [1, false, 1], [2, true, 0]]) {
    const aAsks = [], bAsks = [];
    const A = qlMachine(aAsks, 2), B = qlMachine(bAsks, party, new Set(['acct-a', 'acct-b']));
    const qa = A.startQuestByName(FLOW); A.tick(); A.markQuestShared(FLOW);
    const qb = receive(B, FLOW, env(A, qa)).quest;   // no `from`: no holder named, no sharer known
    if (shareOn) B.markQuestShared(FLOW);
    task(qb, 'found').start(); run(B, 6);
    assert.equal(bAsks.length, asked, `party ${party}${shareOn ? ', shared on' : ''}`);
  }
  // a load: the copy is in step again (SHARE-MEMORY), and its sharer remembered (AUDIT QA3 E2: machine.js shareMemory)
  const members = new Set(['acct-a', 'acct-b']);
  const aAsks = [], bAsks = [];
  const A = qlMachine(aAsks, 2, members), B = qlMachine(bAsks, 2, members);
  const qa = A.startQuestByName(FLOW); A.tick(); A.markQuestShared(FLOW);
  const qb = receive(B, FLOW, env(A, qa), { from: 'acct-a' }).quest;
  task(qb, 'found').start(); run(B, 6);
  assert.equal(bAsks.length, 0);
  const loaded = [];
  const B2 = qlMachine(loaded, 2, members);
  quiet(() => B2.restoreSaveData(JSON.parse(JSON.stringify(B.getSaveData()))));
  assert.equal(B2.hasSharedQuestNamed(FLOW), true);
  run(B2, 2);
  assert.equal(loaded.length, 0, 'loaded, its sharer in the party: it waits on them');   // PIN MOVED (AUDIT QA3 E2): unheard since the load, it asked - the sharer is save state now
  members.delete('acct-a');
  run(B2, 2);
  assert.equal(loaded.length, 1, 'the sharer gone: asked');
});

// ---- PROGRESS-KEPT ----

test('PROGRESS-KEPT: two members\' deeds at about the same moment - each crossing sync keeps the task the other set, and the quest ends on both copies; a merge that kept anything is sent on (mutants: the task let go, the mark, the baseline)', () => {
  const A = machine(), B = machine();
  const qa = take(A, '__X'); A.markQuestShared('__X');
  const qb = receive(B, '__X', env(A, qa)).quest; B.tick();
  task(qa, 'doA').start(); run(A, 2);
  task(qb, 'doB').start(); run(B, 2);
  const fromA = { ...env(A, qa), sync: 1 }, fromB = { ...env(B, qb), sync: 1 };   // both leave before either lands
  const ra = receive(A, '__X', fromB), rb = receive(B, '__X', fromA);
  assert.deepEqual([task(qa, 'a').triggered, task(qa, 'b').triggered, task(qb, 'a').triggered, task(qb, 'b').triggered], [true, true, true, true], 'each keeps its own deed beside the partner\'s');
  assert.ok(qa._keptLocal > 0 && qb._keptLocal > 0, 'each kept something of its own');
  assert.equal(QS.syncBaselineAfter(qa, ra), '', 'so the host has not seen it: the merge goes back to the party');
  run(A, 6); run(B, 6);
  assert.deepEqual([ended(qa), ended(qb)], [true, true], 'when _a_ and _b_: ended on both');
  // a resync that keeps nothing of mine is what I have seen (AUDIT PARTY8's echo)
  const C = machine(), R = machine();
  const qc = take(C, '__X'); C.markQuestShared('__X');
  receive(R, '__X', env(C, qc)); R.tick();
  task(qc, 'doA').start(); run(C, 2);
  const r = receive(R, '__X', env(C, qc));
  const qr = R.sharedCandidateNamed('__X');
  assert.equal(qr._keptLocal, 0);
  assert.equal(QS.syncBaselineAfter(qr, r), QS.shareSignature(qr));
  // the host's baseline after a receipt is this one (scenes/world.js onQuestShared) - PIN MOVED (AUDIT QA3 E4): handed the
  // baseline it had too, which a held answer (merged by nobody) leaves as it was
  assert.match(W, /if \(q\) _questSyncSeen\.set\(quest\.questName, syncBaselineAfter\(q, result, _questSyncSeen\.get\(quest\.questName\)\)\);/);
});

test('PROGRESS-KEPT: a journal step I logged stays; the partner\'s NEW `clear` and `remove log step` of mine are taken, one already run on both copies is not (mutants: the step let go, the clear unread, the removal unread, the newly)', () => {
  const A = machine(), B = machine();
  const qa = take(A, '__P'); A.markQuestShared('__P');
  const qb = receive(B, '__P', env(A, qa)).quest; B.tick();
  task(qa, 'doA').start(); run(A, 2);
  assert.ok(qa.activeLogMessages.has(0) && task(qa, 'a').triggered);
  // PIN MOVED (AUDIT QA3 E4, the fixes' own audit): B's copy unchanged since it came is a held word, merged by nobody -
  // B does a deed of its own, so its copy from before mine is a real merge
  task(qb, 'doC').start(); run(B, 2);
  receive(A, '__P', env(B, qb));   // B's copy, from before my deed
  assert.equal(qa.activeLogMessages.has(0), true, 'my journal step stays');
  assert.equal(task(qa, 'a').triggered, true, 'my task stays');
  // B undoes it: `clear _a_`, `remove log step 0` - newly run on B's copy
  receive(B, '__P', env(A, qa)); run(B, 2);
  task(qb, 'undo').start(); run(B, 2);
  assert.equal(task(qb, 'a').triggered, false);
  receive(A, '__P', env(B, qb));
  assert.equal(task(qa, 'a').triggered, false, 'the partner cleared it: cleared here');
  assert.equal(qa.activeLogMessages.has(0), false, 'the partner removed the step: removed here');
  // both copies have run the undo; I do the deed again, and B's copy (from before it) lands - its clear is old news
  run(A, 2);
  task(qa, 'redo').start(); run(A, 2);
  assert.equal(task(qa, 'a').triggered, true);
  receive(A, '__P', env(B, qb));
  assert.equal(task(qa, 'a').triggered, true, 'a clear both copies ran before is no new word: my deed stays');
});

// ---- BUSY-SYNC ----

/** A statement out of `text` from `marker` (which ends on its opening brace) to that brace's close, with its `;` -
 *  auditdisc28_quests.test.js's lift. Strings and line comments are skipped. */
function lift(text, marker) {
  const at = text.indexOf(marker);
  assert.ok(at >= 0 && marker.endsWith('{'), `world.js carries ${marker}`);
  let i = at + marker.length - 1, depth = 0, q = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return text.slice(at, i + 1) + ';';
}
test('BUSY-SYNC: an ordinary sync the hub refused as \'busy\' lets its baseline go, so the next check sends it again unchanged; a final goes back on the machine as before (mutants: the baseline kept, the host\'s map unpassed)', () => {
  // the law, pure
  const seen = new Map([['__X', 'sig']]), pended = [];
  const m = { pendFinishedShare: (d) => pended.push(d) };
  QS.questBusyAgain(m, { questName: '__X', data: { sync: 1 } }, seen);
  assert.deepEqual([seen.get('__X'), pended.length], ['', 0], 'a sync: its baseline let go, nothing pended');
  seen.set('__X', 'sig');
  const fin = { sync: 1, final: 1 };
  QS.questBusyAgain(m, { questName: '__X', data: fin }, seen);
  assert.deepEqual([seen.get('__X'), pended], ['sig', [fin]], 'a final: back on the machine');
  // the host: world.js's sync check and its 'busy' arm, lifted verbatim
  const make = new Function('d', `const { questBridge, _questSyncSeen, partyMembersHere, prepareShareData, socialLink, performance, QUEST_SYNC_CHECK_MS,
    shareSignature, prepareQuestShare, link, questBusyAgain } = d;
  let _questSyncCheckAt = -Infinity;
  ${lift(W, 'const questSyncTick = () => {')}
  ${lift(W, 'link.onQuestBusy = (quest) => {')}
  return questSyncTick;`);
  const A = machine();
  const qa = take(A, '__X'); QS.prepareQuestShare(A, qa.uid); A.markQuestShared('__X');
  const clock = { t: 0 }, sent = [], link = {};
  const sync = make({ questBridge: { machine: A }, _questSyncSeen: new Map(), partyMembersHere: () => ['acct-b'], prepareShareData: QS.prepareShareData,
    socialLink: () => ({ shareQuest: (f) => { sent.push(f); return true; } }), performance: { now: () => clock.t }, QUEST_SYNC_CHECK_MS: 2000,
    shareSignature: QS.shareSignature, prepareQuestShare: QS.prepareQuestShare, link, questBusyAgain: QS.questBusyAgain });
  const check = () => { clock.t += 2000; sync(); };
  check();   // first sight: the baseline
  task(qa, 'doA').start(); run(A, 2);
  check();
  assert.equal(sent.length, 1, 'the change left as a sync');
  check();
  assert.equal(sent.length, 1, 'unchanged: nothing more');
  link.onQuestBusy(sent[0]);   // ...and the hub dropped it
  check();
  assert.equal(sent.length, 2, 'the next check sends it again');
  assert.equal(sent[1].data.sync, 1);
  check();
  assert.equal(sent.length, 2, 'once');
});

// ---- GOLD-HOLDERS ----

test('GOLD-HOLDERS: a shared quest\'s gold is split among the copies held - a share nobody took pays its holder whole; a partner\'s copy heard back names them a holder (mutants: the party\'s size, the resync\'s holder, the receipt\'s holder, the new copy\'s answer)', () => {
  // A shares in a party of four; the member it reached already has the quest
  const A = machine({ partySize: () => 4 });
  const qa = take(A, '__X');
  const B0 = machine(); take(B0, '__X');
  assert.equal(receive(B0, '__X', env(A, qa)).reason, 'active');
  A.markQuestShared('__X');
  assert.equal(qa.hooks.rewardShares(qa), 1, 'no copy but mine: one share');
  task(qa, 'doA').start(); task(qa, 'doB').start(); run(A, 8);
  assert.deepEqual(A.offered, [75], 'paid whole');
  // A2 shares; B takes it - B's copy holds A2 as its sharer, and B's first word back names B on A2's
  const A2 = machine({ partySize: () => 4 }), B = machine({ partySize: () => 4 });
  const q2 = take(A2, '__X'); const first = env(A2, q2); A2.markQuestShared('__X');
  const got = receive(B, '__X', first, { from: 'acct-a' });
  const qb = got.quest;
  assert.equal(qb.hooks.rewardShares(qb), 2, 'the sharer holds it');
  assert.equal(QS.syncBaselineAfter(qb, got), '', 'a copy new here answers once, so its sharer hears it is held');
  assert.equal(q2.hooks.rewardShares(q2), 1, 'not heard yet');
  // PIN MOVED (AUDIT QA3 E4, the fixes' own audit): a copy unchanged since it came answers "held" (auditqa3_share's pin);
  // B's copy here has moved on, so its word is a resync - and a resync names its sender a holder too
  task(qb, 'doA').start(); run(B, 2);
  assert.equal(receive(A2, '__X', env(B, qb), { from: 'acct-b' }).resync, true);
  assert.equal(q2.hooks.rewardShares(q2), 2, 'heard: two copies hold it');
  task(q2, 'doA').start(); task(q2, 'doB').start(); run(A2, 8);
  assert.deepEqual(A2.offered, [37], 'two shares of 75');
});

test('GOLD-HOLDERS: never more shares than the party; a holder counted once; a word with no sender names no one (mutants: the party clamp, the sender guard)', () => {
  let party = 2;
  const A = machine({ partySize: () => party });
  const qa = take(A, '__X'); QS.prepareQuestShare(A, qa.uid); A.markQuestShared('__X');
  for (const who of ['acct-b', 'acct-c', 'acct-d', 'acct-b']) A.noteShareHolder('__X', who);
  assert.equal(qa._holdersHeard.size, 3, 'acct-b once');
  assert.equal(qa.hooks.rewardShares(qa), 2, 'three holders heard, a party of two');
  party = 8;
  assert.equal(qa.hooks.rewardShares(qa), 4);
  const B = machine({ partySize: () => 8 });
  const qb = take(B, '__X'); B.markQuestShared('__X');
  B.noteShareHolder('__X', undefined); B.noteShareHolder('__X', null); B.noteShareHolder('__X', '');
  assert.equal(qb._holdersHeard?.size ?? 0, 0, 'no sender: no holder');
  assert.equal(qb.hooks.rewardShares(qb), 1);
  // the host names the sender (world.js onQuestShared)
  assert.match(W, /carriesQuestItem: \(res\) => keepsQuestItem\(playerEntity, res\),[^\n]*\n\s*from: acct,/, 'the receipt carries `from: acct`');
});

test('GOLD-ONCE across a share: a received copy has paid its holder nothing - the sharer\'s paid mark never rides in, and a resync keeps the holder\'s own, either way (mutants: the receipt\'s reset, the resync\'s keep)', () => {
  // A takes its gold (`get item`), then shares: B is paid on its own copy
  const A = machine(), B = machine();
  const qa = take(A, '__G');
  task(qa, 'pay').start(); run(A, 2);
  assert.deepEqual([A.gold, itemOf(qa).goldPaid], [itemOf(qa).daggerfallUnityItem.stackCount, true]);
  A.markQuestShared('__G');
  const data = env(A, qa);
  const qb = receive(B, '__G', data).quest;
  assert.equal(itemOf(qb).goldPaid, false, 'the sharer\'s mark is not mine');
  run(B, 2);
  assert.equal(B.gold, itemOf(qb).daggerfallUnityItem.stackCount, 'B\'s own `get item` pays B, its own roll');
  // C, received before A's pay, takes A's later envelope: paid by it, once
  const A2 = machine(), C = machine();
  const q2 = take(A2, '__G'); A2.markQuestShared('__G');
  const qc = receive(C, '__G', env(A2, q2)).quest; C.tick();
  task(q2, 'pay').start(); run(A2, 2);
  receive(C, '__G', env(A2, q2));
  assert.equal(itemOf(qc).goldPaid, false, 'the envelope\'s mark is the sharer\'s, not mine');
  run(C, 2);
  assert.equal(C.gold, itemOf(qc).daggerfallUnityItem.stackCount, 'the re-armed `get item` paid me, my own roll');
  assert.equal(itemOf(qc).goldPaid, true);
  // and my mark, once paid, stands against a partner's envelope with none
  const A3 = machine(), D = machine();
  const q3 = take(A3, '__G'); A3.markQuestShared('__G');
  const qd = receive(D, '__G', env(A3, q3)).quest; D.tick();
  task(qd, 'pay').start(); run(D, 2);
  receive(D, '__G', env(A3, q3));
  assert.equal(itemOf(qd).goldPaid, true, 'paid here: paid');
});

// ---- GUARD-HOLDER ----

test('GUARD-HOLDER: GUARD-ONLINE\'s watch is the holder\'s - a resync keeps the copy\'s own anchor and away mark, a fresh copy its own parse\'s; a partner\'s is only checked to be one (mutants: the watch back as progress)', () => {
  const daily = (spec) => ({ type: 'DailyFrom', isComplete: false, isTriggerCondition: true, isAlwaysOnTriggerCondition: true, actionSpecific: { minDailySeconds: 0, maxDailySeconds: 10800, ...spec } });
  const shape = (spec) => ({ getSaveData: () => ({ tasks: [{ actions: [daily(spec)] }] }) });
  const local = shape({ guardAnchor: null, guardAway: false });
  const live = shape({ guardAnchor: 100, guardAway: false });   // I stand in the hall, watched since 100
  const theirs = { tasks: [{ actions: [daily({ guardAnchor: 4306, guardAway: true })] }] };   // the partner stepped out
  assert.equal(sharedActionMatches(daily({ guardAnchor: null, guardAway: false }), theirs.tasks[0].actions[0]), true, 'the partner\'s watch is a watch');
  assert.equal(sharedActionMatches(daily({ guardAnchor: null, guardAway: false }), daily({ guardAnchor: 'x', guardAway: true })), false, 'an anchor is a number');
  assert.equal(sharedActionMatches(daily({ guardAnchor: null, guardAway: false }), daily({ guardAnchor: 5, guardAway: 1 })), false, 'away is a flag');
  const resync = takeLocalActions(local, theirs, live).tasks[0].actions[0].actionSpecific;
  assert.deepEqual([resync.guardAnchor, resync.guardAway], [100, false], 'a resync: my watch');
  const fresh = takeLocalActions(local, theirs).tasks[0].actions[0].actionSpecific;
  assert.deepEqual([fresh.guardAnchor, fresh.guardAway], [null, false], 'a fresh copy: no watch begun here');
});

// ---- KILL-ONCE ----

const tigerOf = (q) => [...q.resources.values()].find((r) => r.isFoe);
// PIN MOVED (AUDIT QA3 E3): the kills an envelope brought are learned BY ITS SENDER (Foe.learnedKills, a Map by the
// envelope's `from`; '' for an envelope that names none), and a credit spends only its own owner's - one count for all,
// a kill no holder saw swallowed a third member's credit that no envelope ever corrected. So the receipts here name their
// sender, the credits their owner, and the learned are read by whose
const learned = (foe, who = '') => foe.learnedKills.get(who) ?? 0;
test('KILL-ONCE: a partner\'s kill their envelope already brought is not counted again when its credit comes - one tiger never closes `killed 2`; a credit the envelope never carried counts (mutants: the credit unspent, the learned count, the learned carried, the host\'s credit)', () => {
  const A = machine(), B = machine();
  const qa = take(A, '__KK'); A.markQuestShared('__KK');
  const qb = receive(B, '__KK', env(A, qa), { from: 'acct-a' }).quest; B.tick();
  tigerOf(qa).incrementKills(); run(A, 2);   // A kills one, in A's world
  receive(B, '__KK', env(A, qa), { from: 'acct-a' });   // A's envelope lands first...
  assert.deepEqual([tigerOf(qb).killCount, learned(tigerOf(qb), 'acct-a')], [1, 1], 'the kill, learned - A\'s');   // PIN MOVED (AUDIT QA3 E3)
  const L = new KeptKillLedger();
  assert.equal(creditKeptKills(B, L, 'acct-a', [{ q: '__KK', s: 'tiger', i: 1 }], 0), 1, '...then its fall\'s word');
  run(B, 2);
  assert.deepEqual([tigerOf(qb).killCount, learned(tigerOf(qb), 'acct-a')], [1, 0], 'counted once');   // PIN MOVED (AUDIT QA3 E3)
  assert.equal(task(qb, 'S.03').triggered, false, 'one tiger: `killed 2` waits');
  assert.equal(tigerOf(qb).creditPartnerKill('acct-a'), true, 'a second kill, its word first');
  run(B, 2);
  assert.equal(task(qb, 'S.03').triggered, true, 'two');
  // two envelopes before two credits: both spent (an envelope and credits that name nobody, as an older host's)
  const A2 = machine(), C = machine();
  const q2 = take(A2, '__KK'); A2.markQuestShared('__KK');
  const qc = receive(C, '__KK', env(A2, q2)).quest; C.tick();
  tigerOf(q2).incrementKills(); receive(C, '__KK', env(A2, q2));
  tigerOf(q2).incrementKills(); receive(C, '__KK', env(A2, q2));
  assert.deepEqual([tigerOf(qc).killCount, learned(tigerOf(qc))], [2, 2]);   // PIN MOVED (AUDIT QA3 E3)
  assert.deepEqual([tigerOf(qc).creditPartnerKill(), tigerOf(qc).creditPartnerKill(), tigerOf(qc).killCount], [false, false, 2]);
  // a credit before the envelope: the envelope brings nothing new
  const A3 = machine(), D = machine();
  const q3 = take(A3, '__KK'); A3.markQuestShared('__KK');
  const qd = receive(D, '__KK', env(A3, q3), { from: 'acct-a' }).quest; D.tick();
  tigerOf(q3).incrementKills();
  assert.equal(tigerOf(qd).creditPartnerKill('acct-a'), true);
  receive(D, '__KK', env(A3, q3), { from: 'acct-a' });
  assert.deepEqual([tigerOf(qd).killCount, learned(tigerOf(qd), 'acct-a')], [1, 0]);   // PIN MOVED (AUDIT QA3 E3)
});

// ---- REPUTE-SHARE ----

// PIN MOVED (AUDIT QA3 E7): the faction asked is the catalog row's guild's (guilds.js, by the row's group), never the
// envelope's word - the sender writes it. So the receiver's catalog carries the two quests' rows (QuestList-Classic: the
// Mages Guild's, Member) and the receiver is a member; the envelope's faction no longer decides
const catalog = { ...lists, findQuestMeta: (n) => (n in ONLINE_REPUTE_GATES ? { scope: 'guild', group: 10, quest: { name: n, membership: 'M' } } : null) };
const memberships = { 10: { guild: 'MagesGuild' } };
test('REPUTE-SHARE: online, REPUTE-GATE\'s two quests are refused to a receiver below the standing their headers name - with the quest\'s own faction, its guild\'s in the catalog; offline, and any other quest, as before (mutants: the gate, the page, the bar, the faction)', () => {
  assert.deepEqual(ONLINE_REPUTE_GATES, { N0B10Y03: 10, N0B20Y02: 20 });
  let rep = 0;
  const asked = [];
  const m = new QuestMachine({ nowSeconds: () => 0, getReputation: (fid) => { asked.push(fid); return rep; } });
  const was = globalThis.location;
  try {
    globalThis.location = { search: '?online' };
    assert.deepEqual(QS.canReceiveSharedQuest(m, catalog, 'N0B10Y03', { memberships, factionId: 40 }), { ok: false, reason: 'repute', need: 10 }, 'standing 0 online: refused');
    assert.deepEqual(asked, [40], 'the quest\'s faction');
    rep = 19;
    assert.equal(QS.canReceiveSharedQuest(m, catalog, 'N0B10Y03', { memberships, factionId: 40 }).ok, true, 'standing reached');
    assert.deepEqual(QS.canReceiveSharedQuest(m, catalog, 'N0B20Y02', { memberships, factionId: 40 }), { ok: false, reason: 'repute', need: 20 });
    rep = 20;
    assert.equal(QS.canReceiveSharedQuest(m, catalog, 'N0B20Y02', { memberships, factionId: 40 }).ok, true, 'twenty is twenty');
    rep = 0;
    assert.equal(QS.canReceiveSharedQuest(m, catalog, 'N0B00Y01', { memberships, factionId: 40 }).ok, true, 'any other quest: no bar');
    asked.length = 0;
    assert.deepEqual(QS.receiveSharedQuest(m, catalog, 'N0B10Y03', { questName: 'N0B10Y03', factionId: 41 }, { memberships }), { ok: false, reason: 'repute', need: 10 }, 'the receipt asks it');
    assert.deepEqual(asked, [40], 'of the quest\'s own guild, whatever the envelope says');   // PIN MOVED (AUDIT QA3 E7): it asked the envelope's 41
    globalThis.location = { search: '' };
    assert.equal(QS.canReceiveSharedQuest(m, catalog, 'N0B10Y03', { memberships, factionId: 40 }).ok, true, 'offline: DFU\'s pool, no bar');
  } finally {
    if (was === undefined) delete globalThis.location; else globalThis.location = was;
  }
});

// ---- SHARE-WORDS ----

test('SHARE-WORDS: the receiver\'s lines in English, whole - a share arrived, each refusal after "... but you", a guild named, a build skew, the bare failure (mutants: the lines\' words)', () => {
  const refused = (result, build) => QS.shareRefusedLine(result, 'Tony', 'X', build);
  assert.equal(QS.shareSomeone(), 'A party member');
  assert.equal(QS.shareReceivedLine('Tony', 'X'), 'Tony shared a quest: "X".');
  const lines = {
    active: 'Tony tried to share "X", but you already have this quest.',
    done: 'Tony tried to share "X", but you have already done this quest.',
    unknown: 'Tony tried to share "X", but you do not know this quest.',
    guild: 'Tony tried to share "X", but you are not a member of the guild this quest requires.',
    repute: 'Tony tried to share "X", but you do not yet have the standing with its guild this quest asks for.',
    gone: 'Tony tried to share "X", but you no longer have a copy of it to bring up to date.',
    tooLarge: 'Tony tried to share "X", but you were sent a quest too large to read.',
    mainQuest: 'Tony tried to share "X", but you cannot be given the main quest.',
    restore: 'Tony tried to share "X", but you could not rebuild it in your world.',
    shelved: 'Tony tried to share "X", but you have abandoned it. Reclaim it from the Quests tab of the pause menu to take it up again.',
    questline: 'Tony tried to share "X", but you cannot be given a step of a questline. Each player walks their own.',
  };
  for (const [reason, line] of Object.entries(lines)) assert.equal(refused({ reason }), line, reason);
  assert.equal(refused({ reason: 'guild', guild: 'MagesGuild' }), 'Tony tried to share "X", but you are not a member of the Mages Guild, which this quest requires.');
  const named = { FightersGuild: 'the Fighters Guild', MagesGuild: 'the Mages Guild', ThievesGuild: 'the Thieves Guild', DarkBrotherhood: 'the Dark Brotherhood' };
  for (const [k, v] of Object.entries(named)) assert.equal(QS.SHARE_GUILD_NAMES[k], v);
  assert.equal(refused({ reason: 'mismatch' }, null), 'Tony tried to share "X", but you received a quest that did not match your own copy. Their game is out of date. They should reload the page.');
  assert.equal(refused({ reason: 'mismatch' }, 'not-mine'), 'Tony tried to share "X", but you received a quest that did not match your own copy. You are on different versions of the game. Both of you should reload the page.');
  assert.equal(refused({ reason: 'finished' }), 'Could not receive the quest "X" from Tony.', 'no word for why: the bare failure');
  // the sender's own words (shareQuestWithParty)
  assert.deepEqual([QS.SHARE_REFUSAL_TEXT.gone, QS.SHARE_REFUSAL_TEXT.tooLarge, QS.SHARE_REFUSAL_TEXT.mainQuest],
    ['That quest is no longer active.', 'This quest is too complex to share.', 'The main quest cannot be shared.']);
});

test('SHARE-WORDS: every word goes through the text core - a language\'s table answers each line, and English\'s table says what the code says; the host says the three lines (mutants: a word left in English)', () => {
  const csv = parseStringTableCsv(src('locales/en/Port_Strings.csv'));
  const en = new Map([...(csv instanceof Map ? csv : new Map(csv))].filter(([k]) => String(k).startsWith('quest.share.')));
  assert.ok(en.size >= 25, 'the English rows');
  const rows = [...en.keys()].map((k) => [k, `«${k}»`]);
  for (const k of ['quest.share.refused', 'quest.share.received', 'quest.share.notReceived']) rows.push([k, `«${k}» {who}|{quest}${k.endsWith('refused') ? '|{why}' : ''}`]);
  rows.push(['quest.share.guildNamed', '«guildNamed» {guild}']);
  const english = {
    someone: QS.shareSomeone(), received: QS.shareReceivedLine('{who}', '{quest}'),
    refused: QS.shareRefusedLine({ reason: 'active' }, '{who}', '{quest}').replace('already have this quest.', '{why}'),
    notReceived: QS.shareRefusedLine({ reason: 'finished' }, '{who}', '{quest}'),
  };
  for (const [k, v] of Object.entries(english)) assert.equal(en.get(`quest.share.${k}`), v, `the English row ${k} is the code's`);
  try {
    patchLocaleTable('xx', 'Port_Strings', rows);
    setLocale('xx');
    assert.equal(QS.shareSomeone(), '«quest.share.someone»');
    assert.equal(QS.shareReceivedLine('Tony', 'X'), '«quest.share.received» Tony|X');
    assert.equal(QS.shareRefusedLine({ reason: 'active' }, 'Tony', 'X'), '«quest.share.refused» Tony|X|«quest.share.active»');
    assert.equal(QS.shareRefusedLine({ reason: 'finished' }, 'Tony', 'X'), '«quest.share.notReceived» Tony|X');
    assert.equal(QS.shareRefusalText({ reason: 'guild', guild: 'ThievesGuild' }), '«guildNamed» «quest.share.guildName.thieves»');
    for (const k of ['active', 'done', 'mismatch', 'unknown', 'guild', 'repute', 'gone', 'tooLarge', 'mainQuest']) assert.equal(QS.SHARE_REFUSAL_TEXT[k], `«quest.share.${k}»`, k);
    for (const k of ['gone', 'tooLarge', 'mainQuest', 'restore', 'shelved']) assert.equal(QS.RECEIVER_REFUSAL_TEXT[k], `«quest.share.receiver.${k}»`, k);
    for (const [k, id] of [['FightersGuild', 'fighters'], ['MagesGuild', 'mages'], ['DarkBrotherhood', 'darkBrotherhood']]) assert.equal(QS.SHARE_GUILD_NAMES[k], `«quest.share.guildName.${id}»`);
    assert.equal(QS.shareSkewText(null), ' «quest.share.skewOld»');
    assert.equal(QS.shareSkewText('a', 'b'), ' «quest.share.skewDiffer»');
  } finally {
    setLocale('en');
    clearLocaleTables('xx');
  }
  assert.equal(QS.shareSomeone(), 'A party member', 'English again');
  // the host's three lines are these (scenes/world.js onQuestShared)
  assert.match(W, /const who = name \|\| shareSomeone\(\);/);
  assert.match(W, /if \(!result\.resync\) setMidScreenText\(shareReceivedLine\(who, label\)\);/);
  assert.match(W, /setMidScreenText\(shareRefusedLine\(result, who, label, quest\.data\?\.build \?\? null\)\);/);
});
