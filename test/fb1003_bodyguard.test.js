// BODYGUARD-CLOSE (FIELD BUGS 2026-10-03, AverageDoggo on Discord: "The Bodyguard quest bugged - Assassins killed, gold
// rewarded thanked for my help but quest remains uncompleted"). A0C01Y01 pays on `when _clickqgiver_ and _slain_` and
// its one `end quest` is `_timer_` (1.03:00), started by the start-up block. TIMEFREE reads that clock as a deadline,
// and a deadline the start-up block started was kept frozen through a success (A0C41Y18's 1001 days) - so online the
// paid quest stood open for ever. A start-up closing - the start-up block settles nothing, the end only closes - now
// closes on the short wait once the quest is a success, as T1's task-started closings do. The real machine, ticked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { ONLINE_DELAY_SECONDS } from '../src/systems/quest/clock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
// the AUDIT TIMEFREE II harness: the scripts' map placements want a loaded world, so those lines are left out
const machineFor = (online, now) => new QuestMachine({
  nowSeconds: () => now.s, sharedClock: () => online, questClockStepMax: () => (online ? 1800 : Infinity),
  getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|create npc at)/.test(l)),
  showPopup() {}, isPlayerInTown: () => true, giveItemToPlayer() {},
});
const parse = (name, online) => {
  const lines = rd(`vendor/dfu-quests/Quests/${name}.txt`).split(/\r?\n/);
  return new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: () => lines, sharedClock: () => online }).parseQuestShape(name);
};

/** The Bodyguard, started; `slay` kills the two Assassins and clicks Evelara - the pay. */
function bodyguard(online) {
  const now = { s: 1e6 };
  const m = machineFor(online, now);
  const q = m.startQuestByName('A0C01Y01');
  const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
  const slay = () => { q.resources.get('villains').killCount = 2; q.resources.get('qgiver').hasPlayerClicked = true; };
  return { q, step, slay };
}

test('BODYGUARD-CLOSE: online, the paid Bodyguard closes on the short wait - and not before it is paid: twenty unpaid hours leave it running, and unpaid its day and three hours run out on the world\'s clock (mutants: the start-up closing dropped; closed before the pay)', () => {
  // REST8 (the Rest arc's merge): online a deadline runs on the world's clock again (QCLOCK-WORLD), no longer frozen,
  // so the unpaid hours are inside `_timer_`'s day and three hours - a short wait would have closed it at the first step
  const { q, step, slay } = bodyguard(true);
  step(1800, 40);   // twenty game hours of play, unpaid
  assert.equal(q.questComplete, false, 'an unpaid bodyguard is no loss online - the night has not come');
  assert.equal(q.resources.get('timer').clockFinished, false);
  slay();
  step(60, 3);
  assert.equal(q.questSuccess, true, 'the gold handed over, "You have saved my life"');
  assert.equal(q.questComplete, false, 'not closed in the same breath');
  step(60, Math.ceil(ONLINE_DELAY_SECONDS / 60) + 5);
  assert.equal(q.resources.get('timer').clockFinished, true, '`_timer_` ran on the short wait');
  assert.equal(q.questComplete, true, 'closed - out of the journal, the questor let go');
  const late = bodyguard(true);
  late.step(1800, 60);   // thirty hours, unpaid (the first tick only samples the clock)
  assert.equal(late.q.resources.get('timer').clockFinished, true, 'unpaid, `_timer_` ran out on the world\'s clock, as DFU\'s');
  assert.equal(late.q.questComplete, true, 'and closed the quest, quietly');
});

test('BODYGUARD-CLOSE: offline nothing changes - DFU\'s `_timer_`, a day and three hours from the offer, closes the paid quest, never the short wait (mutant: the start-up closing read offline)', () => {
  const { q, step, slay } = bodyguard(false);
  slay();
  step(60, 30);
  assert.equal(q.questSuccess, true);
  assert.equal(q.questComplete, false, 'thirty minutes on: still open, as DFU keeps it');
  step(1800, 56);   // 28 hours
  assert.equal(q.questComplete, true, 'the day and three hours ran out');
});

test('BODYGUARD-CLOSE: what a start-up closing is NOT - a start-up block that pays (A0C41Y18) keeps its lifetime; an end that costs a standing (R0C10Y01\'s -20) or says a line (A0C10Y05\'s "too late") is a loss even after a success and stays frozen (mutants: the settling guard dropped; the quiet-close guard dropped)', () => {
  const kind = (q, n) => (q.resources.get(n).isDeadline ? 'deadline' : 'delay');
  for (const [name, clock] of [['A0C41Y18', 'S.10'], ['R0C10Y01', 'queston'], ['A0C10Y05', 'traveltime'], ['A0C01Y01', 'timer']]) {
    const q = parse(name, true);
    assert.equal(kind(q, clock), 'deadline', `${name}:${clock} is a deadline before any success`);
  }
  const after = (name, clock) => { const q = parse(name, true); q.questSuccess = true; return kind(q, clock); };
  assert.equal(after('A0C41Y18', 'S.10'), 'deadline', 'the finger and the gold kept their 1001 days');
  assert.equal(after('R0C10Y01', 'queston'), 'deadline', 'paid: the -20 never comes - its own `_delay_` closes it');
  assert.equal(after('A0C10Y05', 'traveltime'), 'deadline', 'paid: no "you were too late" line');
  assert.equal(after('A0C01Y01', 'timer'), 'delay', 'paid: The Bodyguard\'s close');
});
