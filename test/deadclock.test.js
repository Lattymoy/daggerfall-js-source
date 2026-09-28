// DEAD-CLOCK (2026-09-26, KimNix on the Discord, N0B20Y02 "Protect an Honored Mage": "the quest keeps resting its
// time" - 35 minutes left, then 4 days 22 hours): the journal's "Time remains" counts down the tightest running clock,
// and N0B20Y02 runs three - the trance's three hours (`_S.12_`, the quest's own deadline), a day and three hours that
// nothing reads (`_oneday_`: `variable _oneday_`, no `when`, no `until`), and the seven days after the guild's mage is
// killed (`_S.09_`). Between the first and the last the line counted the leftover down: the time seemed to reset. A
// clock whose end can change nothing is no deadline, and the line does not count it. The real script, parsed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { clockCounts } from '../src/systems/quest/clock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const parse = (name) => {
  const lines = rd(`vendor/dfu-quests/Quests/${name}.txt`).split(/\r?\n/);
  return new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: () => lines }).parseQuestShape(name);
};

test('DEAD-CLOCK: N0B20Y02\'s trance and punishment clocks are deadlines - a task acts on the one, a `when` reads the other - and its day-and-three-hours is read by nothing', () => {
  const q = parse('N0B20Y02');
  assert.ok(q, 'the vendored quest parses');
  const clock = (n) => q.resources.get(n);
  assert.ok(clock('S.12') && clock('S.09') && clock('oneday'), 'its three clocks');
  assert.equal(clockCounts(q, clock('S.12')), true, '_S.12_ task: hide npc - the trance ends');
  assert.equal(clockCounts(q, clock('S.09')), true, '_talisman_ task: when _S.07_ and _S.09_ - the punishment ends the quest');
  assert.equal(clockCounts(q, clock('oneday')), false, 'variable _oneday_, and nothing reads it');
});

test('DEAD-CLOCK: an `until ... performed` waiting on a clock makes it a deadline too, and a clock with no task of its name is none', () => {
  const q = parse('N0B20Y02');
  const until = [...q.tasks.values()].find((t) => t.targetSymbol?.name === 'S.12');
  assert.ok(until, 'until _S.12_ performed waits on the trance');
  const onlyUntil = { symbol: { name: 'S.12' } };
  const probe = { tasks: new Map([['S.12', { actions: [], pendingActionLines: [] }], ['u', { actions: [], targetSymbol: { name: 'S.12' } }]]) };
  assert.equal(clockCounts(probe, onlyUntil), true, 'waited on by an until');
  assert.equal(clockCounts({ tasks: new Map() }, onlyUntil), false, 'no task of its name: its end sets nothing');
  const acts = { tasks: new Map([['S.12', { actions: [{ isTriggerCondition: false }], pendingActionLines: [] }]]) };
  assert.equal(clockCounts(acts, onlyUntil), true, 'its own task acts when it ends');
  const onlyCondition = { tasks: new Map([['S.12', { actions: [{ isTriggerCondition: true }], pendingActionLines: [] }]]) };
  assert.equal(clockCounts(onlyCondition, onlyUntil), false, 'a condition is not an act');
  const pending = { tasks: new Map([['S.12', { actions: [], pendingActionLines: ['some action the registry cannot read'] }]]) };
  assert.equal(clockCounts(pending, onlyUntil), true, 'an action the registry could not read counts as an action');
});

test('DEAD-CLOCK by source: the journal\'s "Time remains" counts only a clock that counts', () => {
  const b = rd('src/scenes/questBridge.js');
  assert.match(b, /if \(r\.clockEnabled && !r\.clockFinished && Number\.isFinite\(r\.remainingTimeInSeconds\) && clockCounts\(q, r\)\) \{/);
});
