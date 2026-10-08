// GUIDE1 (2026-09-29, Mac: "How can we set the foundation and improve the quest system substantially? Like really
// modernize it, make it more accessible") - THE QUEST LENS, the Quest Guide arc's foundation (ui/questLens.js,
// bible/06-Systems/Quest-Guide-Arc.md). Its three laws, each over the real producers:
//
//   THE MACHINE NEVER KNOWS - the quiet read over every message of the vendored corpus leaves the quest's latches,
//     the DFRandom seed, the quest's rolls, the talk topics and the quest's save data where they were, and prints what
//     the journal's own read prints from the same state; and a game whose lens looks at every tick is, save for save,
//     popup for popup and topic for topic, the game without one.
//   NOTHING THE JOURNAL HAS NOT SAID - the target is DFU's GetLastPlaceMentionedInMessage over producer-minted Places,
//     and of it only the names the entry says or DFU's find-place box would say.
//   ONE WALK - the lens is questRail's law with a quiet reader, over the bridge's own walk; the logbook's
//     GetLastPlaceMentionedInMessage is the lens's; the urgent line is one number.
//
// And the feed over the real bridge and machine: a baseline says nothing, a step written is `updated`, a step logged
// AGAIN is the latest (the order every "last entry" face reads), a clock crossing a day is `urgent` once, a payout is
// `completed` and a clock run out `ended`, a quest back after losing its entries is not new, and a load is a baseline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuestMachine } from '../src/systems/quest/machine.js';
import { resetUid, ensureUidAtLeast } from '../src/systems/quest/quest.js';
import { createQuestBridge } from '../src/scenes/questBridge.js';
import { REGION_TEMPLES } from '../src/formats/mapsFile.js';
import { REGION, RI, makeWorld, seededRolls } from './guideWorld.mjs';   // the crafted world, the tables loaded
import { getSeed, setSeed, srand } from '../src/formats/dfRandom.js';
import { QuestLens, quietLines, entryTarget, lastPlaceMentionedInMessage } from '../src/ui/questLens.js';
import { questRail, writtenOrder, journalLines, QUEST_URGENT_SECONDS } from '../src/ui/questRail.js';
import { questTimerWords } from '../src/ui/enhancedMenu.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };

const LENS_SRC = [
  'Quest: __GLENS', 'DisplayName: Main Quest - The Lens', 'QRC:',
  'Message:  1010', '%qdt:', ' I agreed to find the ring.', ' I have =timer_ days.', '',   // AUDIT GUIDE H1: a deadline the journal names
  'Message:  1011', '%qdt:', ' I found the ring. I must return it.', '',
  'Message:  1012', '%qdt:', ' The deadline moved.', '',
  'QBN:',
  'Clock _timer_ 2.0:00', '',
  '_timer_ task:', ' end quest', '',
  '_step1_ task:', ' log 1011 step 1', '',
  '_relog_ task:', ' log 1012 step 0', '',
  '_win_ task:', ' give pc nothing', ' end quest', '',
  'log 1010 step 0',
  'start timer _timer_',
];
const SECOND_SRC = [
  'Quest: __GLENS2', 'DisplayName: The Second Lens', 'QRC:',
  'Message:  1010', ' The first entry.', '',
  'Message:  1011', ' The second entry.', '',
  'QBN:',
  'Clock _timer_ 0.12:00', '',
  '_timer_ task:', ' end quest', '',
  '_clear_ task:', ' remove log step 0', '',
  '_back_ task:', ' log 1011 step 1', '',
  'log 1010 step 0',
  'start timer _timer_',
];
const QUIET_SRC = [
  'Quest: __GQUIET', 'DisplayName: The Quiet Read', 'QRC:',
  'Message:  1010', '%qdt:', " _qgiver_ asked me, in %god's name, to find %n at _pub_ in __pub_.", ' I have =timer_ days.', '',   // AUDIT GUIDE H1
  'Message:  1011', '%qdt:', ' %g said to look in ___keep_ of ____keep_.', '',
  'Message:  1020', ' _qgiver_ says: seek _pub_.', '',
  'QBN:',
  'Place _pub_ local tavern',
  'Place _keep_ permanent Llugwych',
  'Person _qgiver_ face 1 group Questor',
  'Clock _timer_ 1.00:00', '',
  '_timer_ task:', ' end quest', '',
  '_next_ task:', ' say 1020', ' log 1011 step 1', '',
  'log 1010 step 0',
  'start timer _timer_',
];
const SOURCES = { __GLENS: LENS_SRC, __GLENS2: SECOND_SRC, __GQUIET: QUIET_SRC };

function makeBridge({ world = null, clock, popups = [], dialogs = [] }) {
  return quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => SOURCES[n] ?? null },
    world,
    classicSeconds: () => clock.now,
    playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Bigtown',
    showPopup: (q, tokens) => popups.push(tokens.map((t) => t.text ?? '').join('|')),
    addDialog: (...a) => dialogs.push(a.join(':')),
  }));
}
const questOf = (b, name) => [...b.machine.quests.values()].find((q) => q.questName === name);
const ticks = (b, n = 2) => quiet(() => { for (let i = 0; i < n; i++) b.machine.tick(); });

// ---------------------------------------------------------------
// THE FEED
// ---------------------------------------------------------------

test('GUIDE1 THE FEED over the real bridge: the first look is a baseline and says nothing; a step written is `updated` (its entry named); a step logged AGAIN is the LATEST - in the lens and in questRail\'s order, so the pause window\'s description and the chronicle\'s newest-first card read the entry the player was given last; a clock is `urgent` when it crosses under a day - not at exactly a day, and once; a quest that pays out is `completed`, with the title its label cut off (mutants: a baseline that speaks; the walk\'s first-logged order; `<=` for `<`; urgent on every look; the verdicts swapped)', () => {
  const clock = { now: 1000 };
  const b = makeBridge({ clock });
  quiet(() => b.machine.startQuestByName('__GLENS', 0, { rolls: seededRolls() }));
  ticks(b);
  const q = questOf(b, '__GLENS');

  let r = b.lens.look();
  assert.deepEqual(r.events, [], 'the baseline: a quest already running is not news');
  assert.equal(r.quests.length, 1);
  const v = r.quests[0];
  assert.equal(v.id, String(q.uid));
  assert.equal(v.title, 'The Lens', 'the kind label cut off, questRail\'s own questTitleOf');
  assert.equal(v.name, 'Main Quest - The Lens');
  assert.equal(v.clockSeconds, 172800, 'the tightest running clock, the bridge\'s own');
  assert.equal(v.urgent, false);
  assert.deepEqual(v.latest.lines, ['Sundas the 1st of Morning Star:', ' I agreed to find the ring.', ' I have 2 days.'], '%qdt answers the step\'s own date - the bracket held through the quiet read (AUDIT GUIDE H1: the clock\'s days, the deadline it names)');
  assert.equal(v.updatedAt, 1000);
  assert.equal(v.target, null, 'an entry that names no Place points nowhere');

  clock.now = 1010; q.startTask({ name: 'step1' }); ticks(b);
  r = b.lens.look();
  assert.deepEqual(r.events, [{ type: 'updated', id: v.id, title: 'The Lens', main: false, entries: [`${v.id}|1|1011|1010`] }]);
  assert.deepEqual(b.lens.look().events, [], 'nothing new, nothing said');

  clock.now = 1020; q.startTask({ name: 'relog' }); ticks(b);
  r = b.lens.look();
  assert.deepEqual(r.events, [{ type: 'updated', id: v.id, title: 'The Lens', main: false, entries: [`${v.id}|0|1012|1020`] }], 'a step logged again is a new entry');
  assert.deepEqual(r.quests[0].entries.map((e) => [e.stepID, e.messageID, e.time]), [[1, 1011, 1010], [0, 1012, 1020]], 'written order: step 0 was written LAST');
  assert.deepEqual(r.quests[0].latest.lines, ['Sundas the 1st of Morning Star:', ' The deadline moved.']);
  const log = b.questLog();
  assert.deepEqual(log.active[0].steps.map((s) => s.stepID), [0, 1], 'the machine\'s own walk still lists step 0 first (the Map keeps its slot)');
  assert.deepEqual(questRail(log).active[0].entries.at(-1), ['Sundas the 1st of Morning Star:', ' The deadline moved.'], 'the pause window\'s "latest" (its last entry) is the latest');

  clock.now = 1000 + 86400; ticks(b);
  r = b.lens.look();
  assert.equal(r.quests[0].clockSeconds, QUEST_URGENT_SECONDS, 'exactly a day left');
  assert.deepEqual(r.events, [], 'a day left is not under a day');
  clock.now = 1000 + 86401; ticks(b);
  r = b.lens.look();
  assert.deepEqual(r.events, [{ type: 'urgent', id: v.id, title: 'The Lens', main: false, clockSeconds: 86399 }]);
  assert.equal(r.quests[0].urgent, true);
  clock.now = 1000 + 90000; ticks(b);
  assert.deepEqual(b.lens.look().events, [], 'urgent is said once, when it is crossed');

  clock.now += 10; q.startTask({ name: 'win' }); ticks(b, 6);
  r = b.lens.look();
  assert.deepEqual(r.events, [{ type: 'completed', id: v.id, title: 'The Lens', main: false }]);
  assert.deepEqual(r.quests, []);
  assert.deepEqual(b.questLog().ended, [{ id: v.id, name: 'Main Quest - The Lens', questName: '__GLENS', success: true }], 'the verdict the notebook files it under');
});

test('GUIDE1 THE FEED - a quest the lens has not seen is `started`; one that lost every entry (`remove log step`) drops out of the journal and, when it writes again, is `updated`, not new; a clock that runs out ends the quest and says `ended`; and a LOAD is a baseline: the bridge\'s restore resets the lens, so a quest the lens saw end and the save brings back is not `started` (mutants: known ids forgotten; restore without the reset; an ending with no verdict said)', () => {
  const clock = { now: 5000 };
  const b = makeBridge({ clock });
  quiet(() => b.machine.startQuestByName('__GLENS', 0, { rolls: seededRolls() }));
  ticks(b);
  assert.deepEqual(b.lens.look().events, []);
  const saved = b.snapshot();

  quiet(() => b.machine.startQuestByName('__GLENS2', 0, { rolls: seededRolls(9) }));
  ticks(b);
  const q2 = questOf(b, '__GLENS2');
  const id2 = String(q2.uid);
  assert.deepEqual(b.lens.look().events, [{ type: 'started', id: id2, title: 'The Second Lens', main: false }]);

  clock.now += 10; q2.startTask({ name: 'clear' }); ticks(b);
  let r = b.lens.look();
  assert.deepEqual(r.events, [], 'a quest with nothing written leaves the journal without an ending');
  assert.equal(r.quests.some((v) => v.id === id2), false);
  clock.now += 10; q2.startTask({ name: 'back' }); ticks(b);
  r = b.lens.look();
  assert.deepEqual(r.events, [{ type: 'updated', id: id2, title: 'The Second Lens', main: false, entries: [`${id2}|1|1011|${clock.now}`] }], 'back, and not new');

  clock.now += 12 * 3600; ticks(b, 6);
  r = b.lens.look();
  assert.deepEqual(r.events, [{ type: 'ended', id: id2, title: 'The Second Lens', main: false }], 'the clock ran out: the notebook\'s other verdict');

  const q1 = questOf(b, '__GLENS');
  clock.now += 10; q1.startTask({ name: 'win' }); ticks(b, 6);
  assert.deepEqual(b.lens.look().events.map((e) => e.type), ['completed']);

  quiet(() => b.restore(saved));
  r = b.lens.look();
  assert.deepEqual(r.events, [], 'the loaded game\'s quests are its baseline');
  assert.deepEqual(r.quests.map((v) => v.title), ['The Lens'], 'the save brought the lens quest back');
  assert.deepEqual(b.lens.look().events, []);
});

// ---------------------------------------------------------------
// THE ORDER
// ---------------------------------------------------------------

test('GUIDE1 THE ORDER - writtenOrder sorts a row\'s messages by the time each step was written, STABLE (two steps of one tick keep the walk\'s order), a step with no time first in walk order; a row whose steps do not line up with its messages - or has none - keeps the walk\'s order whole; questRail READS in the walk\'s order (the logbook\'s, whose loud reads latch from entry to entry) and hands its reader the message, the step and the row (mutants: no sort; the tie reversed; a timeless step last; misaligned steps trusted; read in the written order)', () => {
  const m = (id) => ({ id });
  const row = (times) => ({ id: '7', messages: times.map((_, i) => m(1010 + i)), steps: times.map((time, i) => ({ stepID: i, messageID: 1010 + i, time })) });
  assert.deepEqual(writtenOrder(row([30, 10, 20])), [1, 2, 0]);
  assert.deepEqual(writtenOrder(row([10, 5, 10, 5])), [1, 3, 0, 2], 'ties keep the walk\'s order');
  assert.deepEqual(writtenOrder(row([10, null, 5])), [1, 2, 0], 'a step with no time sorts first');
  assert.deepEqual(writtenOrder({ messages: [m(1), m(2)], steps: [{ time: 9 }] }), [0, 1], 'misaligned steps are not trusted');
  assert.deepEqual(writtenOrder({ messages: [m(1), m(2)] }), [0, 1]);
  assert.deepEqual(writtenOrder(null), []);
  const seen = [];
  const r = row([20, 10]);
  const rail = questRail({ active: [r], finished: [] }, (msg, step, rw) => { seen.push([msg.id, step.stepID, rw.id]); return [`line ${msg.id}`]; });
  assert.deepEqual(seen, [[1010, 0, '7'], [1011, 1, '7']], 'READ in the walk\'s order - DFU\'s logbook\'s, whose loud reads latch for the next entry');
  assert.deepEqual(rail.active[0].entries, [['line 1011'], ['line 1010']]);
  assert.deepEqual(rail.active[0].written.map((e) => e.step.stepID), [1, 0]);
  assert.deepEqual(questRail({ active: [r], finished: [] }, () => null).active, [], 'a reader that answers nothing drops the entry, and a quest with none');
});

// ---------------------------------------------------------------
// THE MACHINE NEVER KNOWS
// ---------------------------------------------------------------

test('GUIDE1 THE MACHINE NEVER KNOWS - every one of the 3,817 messages of the 265-quest corpus: the quiet read leaves the quest\'s three latches, the DFRandom seed, the quest\'s rolls, the talk topics and the quest\'s save data where they were, and prints what the journal\'s own read prints from the same state (%god\'s random arm on the same roll) - while that read, from the same state, moves them (the counts pinned); the fifteen messages that meet DFU\'s %di NRE answer null, none of them a journal entry (mutants: each latch, the seed and the rolls not put back; the reveal left on)', () => {
  const dialogs = [];
  const m = new QuestMachine({ nowSeconds: () => 100000, addDialog: (...a) => dialogs.push(a) });
  let quests = 0, messages = 0;
  const moved = { dialog: 0, resource: 0, place: 0, logId: 0, seed: 0, rolls: 0 };
  const unread = [];
  srand(4242);
  for (const f of readdirSync(join(VENDOR, 'Quests')).filter((f) => f.endsWith('.txt')).sort()) {
    const rolls = seededRolls(quests + 1);
    const q = quiet(() => m.scheduleQuest(read(join(VENDOR, 'Quests', f)).split(/\r\n|\r|\n/), 0, { rolls }));
    quests++;
    const state = () => ({ resource: q.lastResourceReferenced, place: q.lastPlaceReferenced, logId: q.currentLogMessageId, seed: getSeed(), rolls: rolls.calls, rollsFn: q.rolls, dialog: dialogs.length });
    const saved = JSON.stringify(q.getSaveData());
    const heard = new Map();
    for (const msg of q.messages.values()) {
      messages++;
      const before = state();
      const lines = quiet(() => quietLines(msg));
      const after = state();
      for (const k of Object.keys(before)) assert.equal(after[k], before[k], `${f}:${msg.id} moved ${k}`);
      heard.set(msg.id, [lines, before]);
      if (lines === null) unread.push(`${f}:${msg.id}`);
    }
    assert.equal(JSON.stringify(q.getSaveData()), saved, `${f}: the save data moved`);
    for (const msg of q.messages.values()) {
      const [lines, before] = heard.get(msg.id);
      const back = () => { q.lastResourceReferenced = before.resource; q.lastPlaceReferenced = before.place; q.currentLogMessageId = before.logId; setSeed(before.seed); };
      // The journal's read from the same state, drawing %god's random
      // arm off the same roll the quiet read takes (the first divine):
      // DFU's logbook re-rolls that arm on every open, so it is the one
      // word whose value is the roll's, never the state's.
      back();
      q.rolls = () => 0;
      let loud = null;
      try { loud = journalLines(msg.getTextTokens(-1, () => 0, true)); } catch { loud = null; }
      q.rolls = rolls;
      assert.deepEqual(lines, loud, `${f}:${msg.id} reads as the journal reads`);
      // ...and the journal's read as it runs, on the quest's own rolls:
      // what the quiet read keeps from moving.
      back();
      const d0 = dialogs.length, r0 = rolls.calls;
      try { msg.getTextTokens(-1, () => 0, true); } catch { /* the %di trio - it latches, and is counted */ }
      if (dialogs.length > d0) moved.dialog++;
      if (rolls.calls > r0) moved.rolls++;
      if (q.lastResourceReferenced !== before.resource) moved.resource++;
      if (q.lastPlaceReferenced !== before.place) moved.place++;
      if (q.currentLogMessageId !== before.logId) moved.logId++;
      if (getSeed() !== before.seed) moved.seed++;
      back();
    }
  }
  assert.equal(quests, 265);
  assert.equal(messages, 3817);
  // Read from a quest that has not run, every message reaching %di
  // before any Place is referenced throws - DFU's own NRE
  // (LastPlaceReferenced.Scope before the null check; the corpus gate
  // meets three of them because its reads run in sequence and latch).
  // None of the fifteen is ever LOGGED, so no journal entry is one;
  // the quiet read answers null for each and puts the latch back.
  assert.deepEqual(unread, [
    '10C00Y00.txt:1011', '30C00Y00.txt:1011', '40C00Y00.txt:1011', '40C00Y00.txt:1012', '70C00Y00.txt:1012',
    '90C00Y00.txt:1011', 'P0B00L01.txt:1014', 'P0B01L02.txt:1010', 'R0C10Y09.txt:1011', 'R0C11Y03.txt:1011',
    'R0C11Y26.txt:1016', 'T0C00Y00.txt:1011', 'V0C00Y00.txt:1012', 'X0C00Y00.txt:1012', 'Z0C00Y00.txt:1011',
  ]);
  // What the journal's own read moves, from the same states - the
  // quiet read moved none of it. logId is the fifteen: a throwing
  // expansion leaves the id latched (C# has no finally either).
  assert.deepEqual(moved, { dialog: 1895, resource: 1761, place: 846, logId: 15, seed: 7, rolls: 94 });
});

test('GUIDE1 THE MACHINE NEVER KNOWS - a whole game, twice: the same quest (a Place, a questor, %god on the quest\'s rolls, %n on DFRandom, a `say`, a clock that runs out) played once with the lens re-reading and looking at EVERY tick and once without it ends in the same save, the same popups, the same talk topics, the same DFRandom seed, the same draws from the quest\'s rolls - and not one draw from Math.random inside a look; the lens meanwhile saw the quest move and end (mutants: the reveal left on; the rolls not swapped; the seed not put back; the engine roll in the target law)', () => {
  assert.equal(REGION_TEMPLES[RI], 0, 'the fixture\'s premise: no dominant temple, so %god rolls');
  const mr = Math.random;
  let engineDraws = 0;
  const run = (withLens) => {
    srand(99);
    resetUid(); ensureUidAtLeast(1000);   // DaggerfallUnity.NextUID is global and seeds %n: both games mint the same uids
    let s = 12345;
    Math.random = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    try {
      const clock = { now: 20000 };
      const popups = [], dialogs = [];
      const b = makeBridge({ world: makeWorld(), clock, popups, dialogs });
      const rolls = seededRolls(3);
      quiet(() => b.machine.startQuestByName('__GQUIET', 0, { rolls }));
      const events = [];
      let first = null;
      const where = { canFindPlace: () => true, currentLocationName: () => 'Somewhere Else' };
      const step = () => {
        ticks(b, 1);
        if (!withLens) return;
        b.lens.rereadText();
        const engine = Math.random;
        Math.random = () => { engineDraws++; return engine(); };
        try {
          const r = b.lens.look(where);
          first ??= r.quests[0];
          events.push(...r.events.map((e) => e.type));
        } finally { Math.random = engine; }
      };
      for (let i = 0; i < 3; i++) step();
      const q = questOf(b, '__GQUIET');
      clock.now += 60; q.startTask({ name: 'next' });
      for (let i = 0; i < 4; i++) step();
      clock.now += 86400 + 60;
      for (let i = 0; i < 6; i++) step();
      return { save: JSON.stringify(b.snapshot()), popups, dialogs, seed: getSeed(), rolls: rolls.calls, events, first };
    } finally { Math.random = mr; }
  };
  const seen = run(true);
  const unseen = run(false);
  assert.equal(seen.save, unseen.save, 'the same save');
  assert.deepEqual(seen.popups, unseen.popups, 'the same popups');
  assert.ok(seen.popups.length >= 1, 'the `say` was heard');
  assert.deepEqual(seen.dialogs, unseen.dialogs, 'the same talk topics, in the same order');
  assert.ok(seen.dialogs.length >= 1, 'the machine\'s own reads revealed topics - the quiet ones added none');
  assert.equal(seen.seed, unseen.seed, 'the same DFRandom state');
  assert.equal(seen.rolls, unseen.rolls, 'the same draws from the quest\'s rolls');
  assert.equal(engineDraws, 0, 'no look drew from Math.random');
  assert.deepEqual(seen.events, ['urgent', 'updated', 'ended'], 'the lens saw the one-day clock lose its first minute, the step, and the ending');
  assert.match(seen.first.latest.lines.join(' '), /asked me, in Arkay's name, to find .+ at The Feather and Dog in Bigtown\./, 'the quiet read\'s words: the questor, the first divine, a name, the building and the town');
  const { building: firstBuilding, ...firstTarget } = seen.first.target;
  assert.deepEqual(firstTarget, {
    symbol: 'pub', kind: 'building', locationName: 'Bigtown', regionName: REGION, buildingName: 'The Feather and Dog',
    onMap: true, here: false, find: { regionIndex: RI, regionName: REGION, locationName: 'Bigtown' },
  });
  assert.ok(firstBuilding?.buildingKey > 0, 'GUIDE8\'s Town tier (AUDIT DELVE): the building the entry names, by its key');
});

test('GUIDE1 NOTHING THE JOURNAL HAS NOT SAID - the target over producer-minted Places (a local tavern, a fixed town, a questor): the LAST Place an entry names, DFU\'s law, and the logbook\'s through the same export; the building only when the entry names the building; the town when the entry names it, when it is on the player\'s map, or when the player stands in it - and only the target\'s own macros say anything; the region when named that way or through the town; `find` exactly when HandleQuestClicks would offer the box - on the map and not here; a Person names no target; an entry with no Place points nowhere (mutants: the first Place for the last; the building without `_p_`; the town without being said; any symbol\'s macro saying it; `find` off the map or here; the town underfoot unnamed)', () => {
  const world = makeWorld();
  const m = new QuestMachine({ nowSeconds: () => 0, world, addDialog: () => {} });
  const q = quiet(() => m.scheduleQuest([
    'Quest: __GSAY', 'DisplayName: Said', 'QRC:',
    'Message:  1010', ' Find _pub_ in __pub_.', '',
    'Message:  1011', ' Something waits in __pub_.', '',
    'Message:  1012', ' Go to ___keep_ in ____keep_.', '',
    'Message:  1013', ' Visit ____keep_ soon.', '',
    'Message:  1014', ' Speak with _qgiver_, then go to __pub_ and then ___keep_.', '',
    'Message:  1015', ' Nothing to see.', '',
    'Message:  1016', ' Speak with _qgiver_.', '',
    'Message:  1017', ' Look for _keep_.', '',
    'Message:  1018', ' Meet _qgiver_ in ____pub_.', '',
    'QBN:', 'Place _pub_ local tavern', 'Place _keep_ permanent Llugwych', 'Person _qgiver_ face 1 group Questor', '', 'variable _pad_',
  ], 0, { rolls: () => 0.3 }));
  quiet(() => m.tick());
  assert.equal(q.getPlace({ name: 'pub' }).siteDetails.buildingName, 'The Feather and Dog', 'the producer named the tavern');
  const t = (id, onMap = false, here = 'Elsewhere') => entryTarget(q.getMessage(id), { canFindPlace: () => onMap, currentLocationName: () => here });
  const off = { onMap: false, here: false, find: null };
  // GUIDE8's Town tier (AUDIT DELVE): the building the entry NAMES, by its town's map id and key - only then
  const pubSite = q.getPlace({ name: 'pub' }).siteDetails;
  const pubBuilding = { mapId: pubSite.mapId, buildingKey: pubSite.buildingKey };
  assert.ok(pubBuilding.buildingKey > 0);

  // AUDIT GUIDE W1: the town's own name (`__p_`) says the town, never its region - off the map, the region is said only
  // by the entry (`____p_`) or DFU's box
  assert.deepEqual(t(1010), { symbol: 'pub', kind: 'building', locationName: 'Bigtown', regionName: null, buildingName: 'The Feather and Dog', building: pubBuilding, ...off });
  assert.deepEqual(t(1011), { symbol: 'pub', kind: 'building', locationName: 'Bigtown', regionName: null, buildingName: null, building: null, ...off }, '"somewhere in Bigtown" stays somewhere');
  assert.deepEqual(t(1012), { symbol: 'keep', kind: 'town', locationName: 'Llugwych', regionName: REGION, buildingName: null, building: null, ...off });
  assert.deepEqual(t(1013), { symbol: 'keep', kind: null, locationName: null, regionName: REGION, buildingName: null, building: null, ...off }, 'the region said, the town not');
  assert.deepEqual(t(1013, true), { symbol: 'keep', kind: 'town', locationName: 'Llugwych', regionName: REGION, buildingName: null, building: null, onMap: true, here: false, find: { regionIndex: RI, regionName: REGION, locationName: 'Llugwych' } }, 'on the map, DFU\'s find-place box names it');
  assert.deepEqual(t(1013, true, 'Llugwych'), { symbol: 'keep', kind: 'town', locationName: 'Llugwych', regionName: REGION, buildingName: null, building: null, onMap: true, here: true, find: null }, 'standing in it: named, and nothing to travel to');
  assert.deepEqual(t(1013, false, 'Llugwych').locationName, null, 'AUDIT GUIDE W2: the map says no - the Llugwych underfoot is another of the name, and names nothing');
  // the fixed-town route (exterior.js) asks the map nothing: the town the player stands in is named, and its region,
  // by the standing alone - the entry says only `_keep_`
  assert.deepEqual(entryTarget(q.getMessage(1017), { currentLocationName: () => 'Llugwych' }),
    { symbol: 'keep', kind: 'town', locationName: 'Llugwych', regionName: REGION, buildingName: null, building: null, onMap: null, here: true, find: null }, 'standing in it, no map asked: named');
  assert.deepEqual(t(1017), { symbol: 'keep', kind: null, locationName: null, regionName: null, buildingName: null, building: null, ...off }, 'a fixed town has no building name to say, and `_p_` says nothing else');
  assert.deepEqual(t(1018), { symbol: 'pub', kind: null, locationName: null, regionName: REGION, buildingName: null, building: null, ...off }, 'the questor\'s name says nothing of the tavern\'s');
  assert.equal(t(1014).symbol, 'keep', 'the LAST Place the entry names');
  assert.equal(lastPlaceMentionedInMessage(q.getMessage(1014)), q.getPlace({ name: 'keep' }), 'the logbook\'s law, the same export');
  assert.equal(t(1015), null);
  assert.equal(t(1016), null, 'a Person is not a place to go');
  assert.equal(lastPlaceMentionedInMessage(q.getMessage(1016)), null);
});

test('GUIDE1 ONE WALK, ONE HOME - the classic logbook takes GetLastPlaceMentionedInMessage from the lens and keeps no copy; the bridge makes the one lens and a host makes none; Message.getTextTokens still reveals by default (C#\'s literal true) and does not when told; the pause window\'s urgent line is QUEST_URGENT_SECONDS - not urgent at a day, urgent a second under (mutants: the default reveal off; the argument ignored; the literal back)', () => {
  const journal = rd('src/ui/questJournal.js');
  assert.match(journal, /import \{ lastPlaceMentionedInMessage\b[^}]*\} from '\.\/questLens\.js';/);
  assert.doesNotMatch(journal, /getMessageResources|_lastPlaceMentionedInMessage/, 'no private copy of the law');
  assert.match(journal, /const place = lastPlaceMentionedInMessage\(message\);/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(host), /new QuestLens\b/, `${host} builds no lens of its own`);
  }
  assert.equal((rd('src/scenes/questBridge.js').match(/new QuestLens\(/g) ?? []).length, 1);

  const dialogs = [];
  const m = new QuestMachine({ nowSeconds: () => 0, world: makeWorld(), addDialog: (...a) => dialogs.push(a[1]) });
  const q = quiet(() => m.scheduleQuest(['Quest: __GREV', 'QRC:', 'Message:  1010', ' Go to _keep_.', '', 'QBN:', 'Place _keep_ permanent Llugwych', '', 'variable _pad_'], 0, { rolls: () => 0 }));
  q.getMessage(1010).getTextTokens(-1, () => 0, true, false);
  assert.deepEqual(dialogs, [], 'told not to, no topic');
  q.getMessage(1010).getTextTokens();
  assert.deepEqual(dialogs, ['keep'], 'the default is C#\'s literal true');

  const log = (clockSeconds) => ({ active: [{ id: '1', name: 'Q', questName: 'Q', clockSeconds, messages: [{ getTextTokens: () => [{ formatting: 'text', text: 'x' }] }] }], finished: [] });
  assert.equal(QUEST_URGENT_SECONDS, 86400);
  assert.equal(questTimerWords(log(86400), 'a:1').urgent, false);
  assert.equal(questTimerWords(log(86399), 'a:1').urgent, true);
  assert.doesNotMatch(rd('src/ui/enhancedMenu.js'), /clockSeconds < 86400/, 'one number, one home');
});
