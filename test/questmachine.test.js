// Q2 - THE QUEST MACHINE: the tick loop, the action registry, live
// clocks. A crafted quest runs END TO END headlessly: the headless
// startup starts a clock and logs a journal step, world time advances
// the clock to zero which starts its same-named task, say's IMMEDIATE
// popup raises questBreak mid-task (the rest of the task runs next
// tick), end quest takes its two-tick grace, the machine tombstones
// the completed quest and expires the tombstone after one in-game
// week. Plus the WhenTask evaluation law, PickOneOf's seeded draw,
// UnsetTask's permanent drop, the GlobalVarLink store, and THE
// COVERAGE PIN: the registry resolves 7231 of 7235 corpus action
// lines (Q3-iv closed the sweep; the 4 left are DFU's own 'Action
// not found. Ignoring' floor), every line to the action the full DFU
// registry order owns it with - a future change must never move
// resolved silently down, and a pattern hijack shifts a bucket.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine, SECONDS_PER_WEEK, TICKS_PER_SECOND } from '../src/systems/quest/machine.js';
import { WhenTask } from '../src/systems/quest/actions.js';
import { TaskType } from '../src/systems/quest/task.js';

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

const CRAFTED = [
  'Quest: __QTEST',
  'QRC:',
  'Message:  1011',
  ' The clock rang.',
  '',
  'QBN:',
  'Clock _timer_ 0.0:02',
  '',
  'variable _done_',
  '',
  '_timer_ task:',
  ' say 1011',
  ' start task _finish_',
  '',
  '_finish_ task:',
  ' setvar _done_',
  ' end quest',
  '',
  'start timer _timer_',
  'log 1010 step 0',
];

test('quest machine: a crafted quest runs end to end - clock, break, end, tombstone, expiry', () => {
  assert.equal(TICKS_PER_SECOND, 10);   // QuestMachine.cs:45, the host pacing law
  let now = 0;
  const popups = [];
  // wave 21: the hook takes ONE box's already-expanded tokens, not the
  // Message - Quest.cs:785 reads them at queue time.
  const text = (tokens) => tokens.map((t) => t.text ?? '').join('').trim();
  const m = new QuestMachine({ nowSeconds: () => now, showPopup: (q, tk) => popups.push(text(tk)) });
  const q = m.scheduleQuest(CRAFTED, 0, { rolls: () => 0 });
  assert.equal(m.quests.size, 0, 'scheduled, not yet invoked');

  m.tick();   // invoke + first update: startup starts the clock, logs step 0
  assert.equal(m.quests.size, 1);
  const timer = q.resources.get('timer');
  assert.equal(timer.clockEnabled, true, 'start timer armed the clock');
  assert.equal(timer.startingTimeInSeconds, 120, '0.0:02 is two minutes');
  assert.deepEqual(q.getLogMessages().map((l) => [l.stepID, l.messageID]), [[0, 1010]]);
  assert.equal(q.getTask({ name: 'timer' }).getTriggerValue(), false, 'clock task waits');

  // (M18) Clock tick consumes WHOLE seconds only - a fractional
  // advance leaves the remainder untouched.
  now = 0.9;
  m.tick();
  assert.equal(timer.remainingTimeInSeconds, 120, 'fractional world time does not tick the clock');

  now = 121;   // world time passes the clock
  m.tick();    // clock hits zero -> _timer_ task starts -> say breaks the task
  assert.equal(timer.clockFinished, true);
  assert.deepEqual(popups, ['The clock rang.'],
    "say's immediate popup delivered through the hook, ALREADY EXPANDED");
  assert.equal(q.getTask({ name: 'done' }).getTriggerValue(), false, 'break stopped the task before start task ran');
  // (M11) The break bails the TASK too: start task _finish_ has not run
  assert.equal(q.getTask({ name: 'finish' }).getTriggerValue(), false, 'the say-break stops the task mid-body');

  m.tick();    // the broken task resumes: start task _finish_ -> setvar + end quest
  assert.equal(q.getTask({ name: 'done' }).getTriggerValue(), true, 'the variable set');
  assert.equal(q.ticksToEnd, 2, "end quest's two-tick grace");
  assert.equal(q.questComplete, false);

  m.tick(); m.tick();   // the grace elapses; the machine tombstones
  assert.equal(q.questComplete, true);
  assert.equal(q.questTombstoned, true);
  assert.equal(m.quests.size, 1, 'tombstoned quests linger');
  assert.equal(q.getLogMessages(), null, 'a complete quest has no log');

  // (M19, strengthened at Q2b-VERIFY) The expiry is EXACTLY one week,
  // pinned in LITERAL seconds - importing the constant back would let
  // a constant mutation move both sides. The comparison is STRICT >:
  // at exactly one week the tombstone still lingers.
  assert.equal(SECONDS_PER_WEEK, 604800);
  const tombstonedAt = q.questTombstoneTime;
  now = tombstonedAt + 604800;
  m.tick();
  assert.equal(m.quests.size, 1, 'at exactly one week the tombstone still lingers (strict >)');
  now = tombstonedAt + 604801;
  m.tick();
  assert.equal(m.quests.size, 0, 'tombstones expire after one in-game week');
});

test('quest machine: AUDIT pins - secondary always-on triggers, oncePerQuest, popup LIFO', () => {
  // (M10) The SECOND always-on trigger is SECONDARY: it can start the
  // task but never stop it. Primary false + secondary true -> the
  // task holds; a mutant where every always-on is primary would let
  // the last checkTrigger win.
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const src = [
    'Quest: __SEC', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'variable _a_', '', 'variable _b_', '',
    '_watch_ task:',
    ' when _a_',
    ' when _b_',
    '',
    'setvar _b_',
  ];
  const q = m.scheduleQuest(src, 0, { rolls: () => 0 });
  m.tick();   // the startup setvar runs AFTER _watch_ in task order...
  m.tick();   // ...so the secondary trigger reads _b_ on the next tick
  assert.equal(q.getTask({ name: 'watch' }).getTriggerValue(), true,
    'the secondary when _b_ starts the task while the primary when _a_ is false');

  // (M15) oncePerQuest suppresses the second showing.
  const popups = [];
  const text = (tokens) => tokens.map((t) => t.text ?? '').join('').trim();
  q.hooks.showPopup = (_qq, tk) => popups.push(text(tk));
  q.showMessagePopup(1011, false, true);
  q.showMessagePopup(1011, false, true);
  q._showPendingTaskMessages();
  assert.deepEqual(popups, ['x'], 'oncePerQuest shows exactly once');

  // (M25) pendingPopups is a STACK, as DFU pushes and pops one:
  // two queued popups deliver newest-first.
  popups.length = 0;
  q.showMessagePopup(1011);
  q.pendingPopups.push([{ formatting: 'text', text: 'SECOND' }]);
  q._showPendingTaskMessages();
  assert.deepEqual(popups, ['SECOND', 'x'], 'LIFO delivery, the DFU stack order');
});

test('quest machine: WhenTask evaluates when/and/or with not, DFU short-circuits', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const src = [
    'Quest: __WT', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'variable _a_', '', 'variable _b_', '',
    '_watch_ task:',
    ' when _a_ and _b_',
    ' setvar _hit_',
    '',
    'variable _hit_', '',
    'setvar _a_',
  ];
  const q = m.scheduleQuest(src, 0, { rolls: () => 0 });
  m.tick();
  assert.equal(q.getTask({ name: 'hit' }).getTriggerValue(), false, 'a alone is not a and b');
  q.startTask({ name: 'b' });
  m.tick();
  assert.equal(q.getTask({ name: 'hit' }).getTriggerValue(), true, 'a and b triggers the watch');
  // The always-on PRIMARY trigger can also stop the task again
  q.clearTask({ name: 'b' });
  m.tick();
  assert.equal(q.getTask({ name: 'watch' }).getTriggerValue(), false, 'primary always-on un-triggers');

  // The eval table directly: or-not and single-when arms
  const w = new WhenTask(q).createNew('when not _a_ or _b_', q);
  assert.equal(w.evaluations.length, 2);
  assert.deepEqual(w.evaluations.map((e) => e.op), ['whenNot', 'or']);
});

test('quest machine: PickOneOf draws seeded; UnsetTask drops permanently', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const src = [
    'Quest: __PK', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'variable _a_', '', 'variable _b_', '', 'variable _c_', '',
    'pick one of _a_ _b_ _c_',
  ];
  // roll 0.5 -> index 1 of three -> _b_
  const q = m.scheduleQuest(src, 0, { rolls: () => 0.5 });
  m.tick();
  assert.deepEqual(
    ['a', 'b', 'c'].map((n) => q.getTask({ name: n }).getTriggerValue()),
    [false, true, false],
  );

  const src2 = [
    'Quest: __UN', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'variable _a_', '',
    'setvar _a_',
    'unset _a_',
  ];
  const q2 = m.scheduleQuest(src2, 0, { rolls: () => 0 });
  m.tick();
  const a = q2.getTask({ name: 'a' });
  assert.equal(a.dropped, true);
  assert.equal(a.getTriggerValue(), false);
  a.start();
  assert.equal(a.getTriggerValue(), false, 'a dropped task can never re-trigger');
});

test('quest machine: a GlobalVarLink task reads and writes the shared store', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const src = [
    'Quest: __GV', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'LiftedCurse _lift_',   // Quests-GlobalVars id 0
    '',
    'setvar _lift_',
  ];
  const q = m.scheduleQuest(src, 0, { rolls: () => 0 });
  const lift = q.getTask({ name: 'lift' });
  assert.equal(lift.type, TaskType.GlobalVarLink);
  assert.equal(lift.globalVarLink, 0);
  // Q2b-VERIFY: an UNSET global reads false - the store's default,
  // not a pre-lit flag (Task.cs GetTriggerValue's missing-key arm).
  assert.equal(lift.getTriggerValue(), false);
  m.tick();
  assert.equal(m.globalVars.get(0), true, 'the 64-global store carries the state');
  assert.equal(lift.getTriggerValue(), true);
  m.globalVars.set(0, false);
  assert.equal(lift.getTriggerValue(), false, 'the store is the truth, not the local flag');
});

test('quest machine: COVERAGE PIN - the 62-action registry resolves 7231 of 7235 corpus action lines, each to its DFU owner', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  let resolved = 0, pending = 0;
  const tally = new Map();
  for (const f of readdirSync(join(VENDOR, 'Quests')).filter((f) => f.endsWith('.txt')).sort()) {
    // AUDIT quest-2: the factory rides the parse explicitly - a
    // machineless parse pends every line (quest.test.js pins that).
    const q = m.parser.parse(read(join(VENDOR, 'Quests', f)).split(/\r\n|\r|\n/), 0,
      { rolls: () => 0.5, actionFactory: m._actionFactory });
    for (const t of q.tasks.values()) {
      resolved += t.actions.length;
      pending += t.pendingActionLines.length;
      for (const a of t.actions) tally.set(a.constructor.name, (tally.get(a.constructor.name) ?? 0) + 1);
    }
  }
  // Exact against the pinned vendor commit. New action slices move
  // resolved UP and pending DOWN - never the reverse. (AUDIT quest-P2
  // moved 50 lines BACK to pending: the guards stopped Say/WhenTask
  // hijacking lines owned by not-yet-ported DFU triggers; Q2b-i's
  // full-registry mirror then made ownership structural.)
  // The 4 still pending are DFU's OWN floor: vestigial corpus lines
  // no template in RegisterActionTemplates matches either ('Action
  // not found. Ignoring') - permanent by parity.
  assert.equal(resolved, 7231);
  assert.equal(pending, 4);
  // THE OWNERSHIP PIN: per-action resolved counts, each equal to the
  // line count the FULL DFU RegisterActionTemplates order assigns
  // that action over this corpus (independently derived by running
  // the C# patterns in C# order). Any hijack - a pattern claiming a
  // line owned by another action or by a pending guard - shifts a
  // bucket and fails here.
  assert.deepEqual(Object.fromEntries([...tally.entries()].sort((a, b) => a[0].localeCompare(b[0]))), {
    AddAsQuestor: 21,
    AddDialog: 77,
    AddFace: 35,
    CastSpellDo: 3,
    CastSpellOnFoe: 41,
    ChangeReputeWith: 207,
    ClearTask: 209,
    CreateFoe: 241,
    CreateNpc: 48,
    CreateNpcAt: 26,
    ClickedItem: 66,
    ClickedNpc: 268,
    CurePcDisease: 6,
    DailyFrom: 25,
    DestroyNpc: 4,
    DialogLink: 120,
    DroppedItemAtPlace: 8,
    DropAsQuestor: 36,
    DropFace: 37,
    EndQuest: 543,
    // Q2b-ii: GiveItem's 64 was re-derived from the RAW corpus (all 64
    // lines matching its pattern are first-match-owned by GiveItem
    // under the full C# order) - the coverage backlog's 63 was that
    // script's own artifact.
    GetItem: 203,
    GiveItem: 64,
    GivePc: 296,
    HaveItem: 59,
    HideNpc: 89,
    InjuredFoe: 172,
    ItemUsedDo: 80,
    KilledFoe: 222,
    LegalRepute: 14,
    LevelCompleted: 12,
    LogMessage: 409,
    MakePcDiseased: 5,
    MakePermanent: 136,
    MuteNpc: 9,
    PcAt: 95,
    PlaceFoe: 224,
    PlaceItem: 106,
    PlaceNpc: 125,
    PickOneOf: 96,
    PlaySound: 3,
    PlayVideo: 10,
    Prompt: 102,
    RemoveFoe: 22,
    ReputeExceedsDo: 41,
    RevealLocation: 193,
    RemoveLogMessage: 16,
    RestoreNpc: 14,
    RestrainFoe: 33,
    RumorMill: 10,
    Say: 731,
    StartQuest: 40,
    StartStopTimer: 420,
    StartTask: 49,
    TakeItem: 44,
    TeleportPc: 8,
    TotingItemAndClickedNpc: 211,
    UnsetTask: 30,
    WhenNpcIsAvailable: 7,
    WhenPcEntersExits: 8,
    WhenReputeWith: 8,
    WhenTask: 794,
  });
});

test('quest machine: AUDIT parity pins - guards pend hijackable lines, clear rearms actions', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  // (P2, closed at Q3-iv) the when-shapes once pended behind guards
  // so WhenTask could not hijack them; their REAL owners now stand at
  // the same registry positions and claim the same lines - the
  // ownership transfer the guard charter promised.
  const src = [
    'Quest: __GRD', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'Person _qgiver_ group Questor', '',
    '_t_ task:',
    ' clicked npc _qgiver_ say 1011',
    ' when repute with _qgiver_ is at least 20',
    ' when _qgiver_ is available',
    '',
    'variable _a_',
  ];
  const q = m.scheduleQuest(src, 0, { rolls: () => 0 });
  const t = q.getTask({ name: 't' });
  assert.equal(t.actions.length, 3, 'every line claimed by its own action');
  assert.deepEqual(t.actions.map((a) => a.constructor.name),
    ['ClickedNpc', 'WhenReputeWith', 'WhenNpcIsAvailable']);
  assert.equal(t.pendingActionLines.length, 0, 'nothing left behind a guard here');

  // (P1) Clearing a task REARMS its completed actions: a restarted
  // task runs them again (Task.cs SetTriggerValue's rearm-on-false).
  const src2 = [
    'Quest: __RRM', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'variable _x_', '',
    '_t_ task:',
    ' setvar _x_',
    '',
    'variable _a_',
  ];
  const q2 = m.scheduleQuest(src2, 0, { rolls: () => 0 });
  m.tick();
  const t2 = q2.getTask({ name: 't' }), x = q2.getTask({ name: 'x' });
  t2.start(); m.tick();
  assert.equal(x.getTriggerValue(), true, 'first run sets the variable');
  x.clear(); t2.clear();          // clear BOTH; the clear rearms t2's setvar action
  t2.start(); m.tick();
  assert.equal(x.getTriggerValue(), true, 'the restarted task runs its rearmed action again');
});
