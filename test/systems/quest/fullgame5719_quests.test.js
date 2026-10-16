import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Symbol as QuestSymbol } from '../../../src/systems/quest/symbol.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { prepareQuestShare, receiveSharedQuest } from '../../../src/systems/quest/questShare.js';
import { sharedActionMatches, takeLocalActions } from '../../../src/systems/quest/shareActions.js';
import { CreateFoe, StartQuest, WorldUpdate, DailyFrom } from '../../../src/systems/quest/actions.js';

const dir = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
loadQuestTables(Object.fromEntries(readdirSync(dir).filter((n) => n.endsWith('.txt')).map((n) =>
  [n.slice(0, -4), readFileSync(new URL(n, dir), 'utf8').replace(/^\uFEFF/, '')])));
const name = '__FIX5719';
const source = [`Quest: ${name}`, 'QRC:', 'Message: 1011', 'audit', '', 'QBN:', '', '_t_ task:', ' legal repute +5', ' start task _finish_', '', 'variable _finish_'];
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const machine = (calls = []) => new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: (n) => n === name ? source : null, changeLegalRep: (n) => calls.push(n) });
function envelope() {
  const m = machine(), q = m.scheduleQuest(source, 0, { rolls: () => 0 });
  m.tick(); q.startTask(new QuestSymbol('_t_'));
  const prepared = prepareQuestShare(m, q.uid); assert.ok(prepared.ok);
  return JSON.parse(JSON.stringify(prepared.data));
}
const actionOf = (data, type) => data.tasks.flatMap((t) => t.actions).find((a) => a.type === type);

test('FG-01: forged action arguments, task targets and trigger semantics never reach the receiver', () => {
  const changes = [
    (d) => { actionOf(d, 'LegalRepute').actionSpecific.amount = -100; },
    (d) => { actionOf(d, 'LegalRepute').isTriggerCondition = true; },
    (d) => { actionOf(d, 'LegalRepute').isAlwaysOnTriggerCondition = true; },
    (d) => { actionOf(d, 'LegalRepute').actionSpecific.unexpected = 1; },
    (d) => { actionOf(d, 'StartTask').actionSpecific.taskSymbol.original = '_other_'; },
  ];
  for (const change of changes) {
    const data = envelope(); change(data);
    const calls = [], m = machine(calls);
    assert.equal(receiveSharedQuest(m, lists, name, data).reason, 'mismatch');
    m.tick(); assert.deepEqual(calls, []); assert.equal(m.quests.size, 0);
  }
  const calls = [], m = machine(calls);
  assert.ok(receiveSharedQuest(m, lists, name, envelope()).ok);
  m.tick(); assert.deepEqual(calls, [5], 'honest local script still executes');
});

test('FG-01: forged resync leaves the live quest unchanged', () => {
  const data = envelope(), m = machine();
  const q = receiveSharedQuest(m, lists, name, data).quest;
  const before = structuredClone(q.getSaveData());
  actionOf(data, 'LegalRepute').actionSpecific.amount = -100;
  assert.equal(receiveSharedQuest(m, lists, name, data).reason, 'mismatch');
  assert.deepEqual(q.getSaveData(), before);
});

test('FG-01: legitimate spawn progress survives; its script parameters cannot be replaced', () => {
  const own = new CreateFoe(null).createNew('create foe _foe_ every 1 minutes 5 times with 50% success msg 1011', null).getActionSaveData();
  const next = structuredClone(own);
  Object.assign(next.actionSpecific, { lastSpawnTime: 99, spawnCounter: 2, msgMessageID: -1 });
  assert.ok(sharedActionMatches(own, next));
  const ref = { getSaveData: () => ({ tasks: [{ actions: [own] }] }) };
  const safe = takeLocalActions(ref, { tasks: [{ actions: [next] }] });
  assert.deepEqual(safe.tasks[0].actions[0].actionSpecific, next.actionSpecific);
  for (const field of ['spawnInterval', 'spawnMaxTimes', 'spawnChance']) {
    const bad = structuredClone(next); bad.actionSpecific[field] = 999;
    assert.equal(sharedActionMatches(own, bad), false, field);
  }
  const bad = structuredClone(next); bad.actionSpecific.spawnCounter = -1;
  assert.equal(sharedActionMatches(own, bad), false);
});

test('FG-01: normalized quest names/variants and guard-window progress remain compatible', () => {
  const start = new StartQuest(null).createNew('start quest 42 0', null).getActionSaveData();
  const executed = structuredClone(start); executed.actionSpecific.questName = 'S0000042'; executed.isComplete = true;
  assert.ok(sharedActionMatches(start, executed));
  executed.actionSpecific.questName = 'S0000099'; assert.equal(sharedActionMatches(start, executed), false);
  const world = new WorldUpdate(null).createNew('worldupdate location at 1 in region 2 variant -', null).getActionSaveData();
  const normalized = structuredClone(world); normalized.actionSpecific.variant = '';
  assert.ok(sharedActionMatches(world, normalized));
  const guard = new DailyFrom(null).createNew('daily from 10:00 to 12:00', null).getActionSaveData();
  const progress = structuredClone(guard); progress.actionSpecific.guardAnchor = 500; progress.actionSpecific.guardAway = true;
  assert.ok(sharedActionMatches(guard, progress));
  progress.actionSpecific.minDailySeconds = 0;
  assert.equal(sharedActionMatches(guard, progress), false);
});
