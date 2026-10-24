// QL4 (bible/06-Systems/Questlines-Arc.md section 2.3): THE QUESTLINES' FIVE ACTIONS - `ask` (a choice in the player's
// own words), `outcome` (where a script decides how it ended), `ql act` (a trigger on what the player did, QL11), `ql
// paid` (the quest paid, without GivePc's box) and `ql name` (a giver by their own name, QL12). They are registered by
// the quest bridge after DFU's 82: a first-match scan, so the pins here are that no DFU template claims a questlines
// line, that the questlines' templates claim no line of the shipped corpus, and that each acts as it says through a real
// machine - saved and restored mid-flight. (AUDIT QUESTLINES DOC-29: this said three.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine, TICKS_PER_SECOND } from '../../../src/systems/quest/machine.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { questlineActionTemplates, QlAsk, QlOutcome, QlAct, QlPaid, QlName, ASK_AGAIN_TICKS } from '../../../src/systems/questlines/qlActions.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { freshState } from '../../../src/systems/questlines/qlState.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}

const LINES = {
  ask: '\task 1050 choices 1051 _guild_ 1052 _fence_',
  ask4: 'ask 1050 choices 1051 _a_ 1052 _b_ 1053 _c_ 1054 _d_',
  outcome: '\toutcome _loyal_',
  act: '\tql act fish-caught 2',
  paid: '\tql paid',
  name: '\tql name _giver_ Ysolde_Marnhel',
};

test('QL4 the scan: each questlines line is claimed by its own template, and no DFU template claims one', () => {
  const dfuOnly = new QuestMachine({ nowSeconds: () => 0 });
  for (const [k, line] of Object.entries(LINES)) assert.equal(dfuOnly.getActionTemplate(line), null, `${k}: no DFU template claims "${line.trim()}"`);
  const m = new QuestMachine({ nowSeconds: () => 0 });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  assert.ok(m.getActionTemplate(LINES.ask) instanceof QlAsk);
  assert.ok(m.getActionTemplate(LINES.ask4) instanceof QlAsk);
  assert.ok(m.getActionTemplate(LINES.outcome) instanceof QlOutcome);
  assert.ok(m.getActionTemplate(LINES.act) instanceof QlAct);
  assert.ok(m.getActionTemplate(LINES.paid) instanceof QlPaid);
  assert.ok(m.getActionTemplate(LINES.name) instanceof QlName);
  // the forms that are not a line of theirs
  assert.equal(m.getActionTemplate('ask 1050 choices 1051 _a_'), null, 'one choice is no choice');
  assert.equal(m.getActionTemplate('ask 1050 choices 1051 _a_ 1052 _b_ 1053 _c_ 1054 _d_ 1055 _e_'), null, 'five is too many');
  assert.equal(m.getActionTemplate('ql act Fish 1'), null, 'a kind is lower-case');
});

test('QL4 the corpus: registered after DFU\'s 82, the questlines\' templates claim no line of any shipped quest', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const ours = questlineActionTemplates();
  for (const t of ours) m.registerAction(t);
  const claimed = [];
  for (const f of readdirSync(join(VENDOR, 'Quests'))) {
    let inQbn = false;
    for (const line of read(join(VENDOR, 'Quests', f)).split(/\r?\n/)) {
      if (/^\s*QBN:/i.test(line)) { inQbn = true; continue; }
      if (!inQbn || !line.trim() || /^\s*-/.test(line)) continue;
      const t = m.getActionTemplate(line);
      if (t && ours.includes(t)) claimed.push(`${f}: ${line.trim()}`);
    }
  }
  assert.deepEqual(claimed, []);
});

const ASK_QUEST = [
  'Quest: __QLASK',
  'DisplayName: A Choice',
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
  '\task 1050 choices 1051 _guild_ 1052 _fence_',
  '',
  'variable _guild_',
  'variable _fence_',
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

function machineWith(showChoice) {
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: (n) => (n === '__QLASK' ? ASK_QUEST : null), questlinesStamp: () => freshState(), showChoice });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  return m;
}

test('QL4 ask and outcome, run: the question and its choices\' own words go to the host, the choice taken sets its task, and the script\'s outcome is written - once', () => {
  let asked = null;
  const m = machineWith((q, message, choices, respond) => { asked = { q, message, choices, respond }; });
  const quest = m.startQuestByName('__QLASK');
  assert.equal(quest.tasks.get('g').actions.length, 2, 'every line claimed');
  m.tick();
  assert.ok(asked, 'asked');
  assert.equal(asked.message.id, 1050);
  assert.deepEqual(asked.choices.map((c) => c.id), [1051, 1052]);
  asked.respond(1);   // the fence
  m.tick(); m.tick();
  assert.equal(quest.getTask({ name: 'fence' }).getTriggerValue(), true);
  assert.equal(quest.getTask({ name: 'guild' }).getTriggerValue(), false);
  assert.equal(quest.ql.outcome, 'sold');
  quest.getTask({ name: 'guild' }).start();
  m.tick(); m.tick();
  assert.equal(quest.ql.outcome, 'sold', 'the first outcome stands');
  // asked once: the startup task does not ask again
  asked = null;
  m.tick();
  assert.equal(asked, null);
});

test('QL4 an unstamped quest: ask still asks (it is the script\'s question), outcome writes nothing, ql act never fires', () => {
  let asked = null;
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: () => ASK_QUEST, questlinesStamp: () => null, showChoice: (q, msg, ch, respond) => { asked = respond; } });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  const quest = m.startQuestByName('__QLASK');
  m.tick();
  asked(0);
  m.tick(); m.tick();
  assert.equal(quest.ql, null);
  assert.equal(quest.getTask({ name: 'guild' }).getTriggerValue(), true);
  assert.equal(quest.getTask({ name: 'hunt' }).getTriggerValue(), false);
});

test('QL4 AUDIT QUESTLINES BRANCH-9 a missing message fails loudly, once, and the quest stays answerable: asked with the choices that have words, complete only on the answer; nothing to ask waits unanswered; no host asks nothing (mutants: a missing message marks the ask complete and asks nothing; said every tick)', () => {
  const swap = (from, to) => ASK_QUEST.map((l) => (l === '\task 1050 choices 1051 _guild_ 1052 _fence_' ? `\task 1050 choices ${from === null ? '1051 _guild_ 1052 _fence_' : from}` : l)).map((l) => (to && l === to[0] ? to[1] : l));
  const run = (lines, ticks = 3) => {
    const asks = [];
    const error = console.error; const errors = [];
    console.error = (s) => errors.push(String(s));
    try {
      const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: () => lines, questlinesStamp: () => freshState(), showChoice: (q, message, choices, respond) => asks.push({ message, choices, respond }) });
      for (const t of questlineActionTemplates()) m.registerAction(t);
      const quest = m.startQuestByName('__QLASK');
      for (let i = 0; i < ticks; i++) m.tick();
      return { m, quest, asks, errors, ask: [...quest.tasks.values()].flatMap((t) => t.actions).find((a) => a instanceof QlAsk) };
    } finally { console.error = error; }
  };
  // a choice's words missing (1052 misspelt 1099): asked with the one that has words, and the answer sets its task
  const one = run(swap('1051 _guild_ 1099 _fence_'));
  assert.equal(one.asks.length, 1, 'asked - the quest is answerable');
  assert.deepEqual(one.asks[0].choices.map((c) => c.id), [1051]);
  assert.equal(one.ask.isComplete, false, 'never complete but on an answer');
  assert.equal(one.errors.length, 1, 'said once, not on every tick');
  assert.ok(one.errors[0].includes('__QLASK') && one.errors[0].includes('ask 1050 names a message') && one.errors[0].includes('1099'), one.errors[0]);
  one.asks[0].respond(0);
  one.m.tick(); one.m.tick();
  assert.equal(one.quest.getTask({ name: 'guild' }).getTriggerValue(), true, 'the choice that had words, taken');
  assert.equal(one.ask.isComplete, true);
  // the question's words missing: the pick alone
  const bare = run(swap(null, ['Message:  1050', 'Message:  1059']));
  assert.equal(bare.asks.length, 1);
  assert.equal(bare.asks[0].message, null, 'no question: the pick alone');
  assert.deepEqual(bare.asks[0].choices.map((c) => c.id), [1051, 1052]);
  // nothing to answer: it waits, said once, never complete
  const none = run(swap('1098 _guild_ 1099 _fence_'), 5);
  assert.equal(none.asks.length, 0);
  assert.equal(none.ask.isComplete, false, 'not complete in silence');
  assert.equal(none.errors.length, 1);
  assert.ok(none.errors[0].includes('1098, 1099') && none.errors[0].includes('nothing to ask'), none.errors[0]);
  const m2 = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: () => ASK_QUEST, questlinesStamp: () => freshState() });
  for (const t of questlineActionTemplates()) m2.registerAction(t);
  m2.startQuestByName('__QLASK');
  assert.doesNotThrow(() => m2.tick(), 'no host: the question idles, as a prompt does');
});

test('QL4 AUDIT QUESTLINES BRANCH-10 `outcome _x_` writes only an outcome its quest\'s sheet has - another is said and left to the sheet\'s own bindings; a quest with no sheet has nothing to hold it to (mutants: an outcome written unchecked)', () => {
  const sheet = sheetFor('M0B50Y09');
  assert.ok(sheet?.outcomes?.some((o) => o.id === 'waived'), 'the fixture: M0B50Y09\'s sheet has `waived`');
  const outcome = (questName, line) => {
    const quest = { questName, ql: freshState() };
    const action = new QlOutcome(null).createNew(line, quest);
    const warn = console.warn; const warned = [];
    console.warn = (s) => warned.push(String(s));
    try { action.update(null); } finally { console.warn = warn; }
    return { quest, action, warned };
  };
  const typo = outcome('M0B50Y09', '\toutcome _waivd_');
  assert.equal(typo.quest.ql.outcome, null, 'no row of its sheet: not written, so the sheet\'s bindings still settle it');
  assert.equal(typo.action.isComplete, true);
  assert.ok(typo.warned.some((s) => s.includes('M0B50Y09') && s.includes('waivd')), typo.warned.join('\n'));
  const right = outcome('M0B50Y09', '\toutcome _waived_');
  assert.equal(right.quest.ql.outcome, 'waived');
  assert.deepEqual(right.warned, []);
  assert.equal(outcome('__QLASK', '\toutcome _sold_').quest.ql.outcome, 'sold', 'no sheet: written as said');
});

test('QL4 ql act: counts from the moment its task first asks, fires at its count, and its start survives a save', () => {
  const m = machineWith(() => {});
  const quest = m.startQuestByName('__QLASK');
  quest.ql.acts['fish-caught'] = 5;   // heard before the task asked: not counted
  m.tick();
  assert.equal(quest.getTask({ name: 'hunt' }).getTriggerValue(), false);
  quest.ql.acts['fish-caught'] = 6;
  m.tick();
  assert.equal(quest.getTask({ name: 'hunt' }).getTriggerValue(), false, 'one of two');
  // saved and restored mid-count
  const data = m.getSaveData();
  const m2 = machineWith(() => {});
  m2.restoreSaveData(data);
  const q2 = m2.quests.get(quest.uid);
  q2.ql.acts['fish-caught'] = 7;
  m2.tick();
  assert.equal(q2.getTask({ name: 'hunt' }).getTriggerValue(), true, 'two of two - counted from 5, not from the load');
});

test('QL4 the bridge registers them, every host\'s machine; and the layer\'s act reaches every running stamped quest', () => {
  setPref(QUESTLINES_PREF, true);
  const bridge = createQuestBridge({ data: { readListTable: () => null, getQuestSourceLines: (n) => (n === '__QLASK' ? ASK_QUEST : null) }, classicSeconds: () => 0, showChoice: () => {} });
  for (const k of Object.keys(LINES)) assert.ok(bridge.machine.getActionTemplate(LINES[k]), k);
  const q = bridge.machine.startQuestByName('__QLASK');
  assert.equal(bridge.questlines.act('fish-caught', 2), 1, 'one quest heard it');
  assert.equal(q.ql.acts['fish-caught'], 2);
  assert.equal(bridge.questlines.act('', 1), 0);
  assert.equal(bridge.questlines.act('fish-caught', 0), 0);
  q.shelvedAt = 5;
  assert.equal(bridge.questlines.act('fish-caught', 1), 0, 'a quest set aside hears nothing');
});

test('QL4 ask is complete only on its answer: a box closed unanswered (null) asks again ASK_AGAIN_TICKS later, not at once, and a save taken under the question asks again on its load (mutants: null asks again on the next tick; null never asks again)', () => {
  const asks = [];
  const m = machineWith((q, message, choices, respond) => asks.push(respond));
  const quest = m.startQuestByName('__QLASK');
  m.tick();
  assert.equal(asks.length, 1);
  m.tick(); m.tick();
  assert.equal(asks.length, 1, 'not asked again while the question is up');
  asks[0](null);   // closed unanswered - AUDIT QUESTLINES BRANCH-3: the host's pick could not be shown
  for (let i = 0; i < 10 * TICKS_PER_SECOND; i++) m.tick();
  assert.equal(asks.length, 1, 'not again at once - the question would come back each time it was clicked away');
  for (let i = 10 * TICKS_PER_SECOND; i <= ASK_AGAIN_TICKS && asks.length === 1; i++) m.tick();
  assert.equal(asks.length, 2, 'asked again, later');
  assert.ok(ASK_AGAIN_TICKS <= 60 * TICKS_PER_SECOND, 'within the minute');
  const data = m.getSaveData();   // saved under the second question
  const m2 = machineWith((q, message, choices, respond) => asks.push(respond));
  m2.restoreSaveData(data);
  m2.tick();
  assert.equal(asks.length, 3, 'the load asks afresh');
  asks[2](0);
  m2.tick(); m2.tick();
  assert.equal(m2.quests.get(quest.uid).ql.outcome, 'loyal');
  m2.tick();
  assert.equal(asks.length, 3, 'answered: never asked again');
});

const NAME_QUEST = ['Quest: __QLNAME', 'DisplayName: A Name', 'QRC:', 'QuestorOffer:  [1000]', '<ce> Will you?', '', 'RefuseQuest:  [1001]', '<ce> No.', '', 'AcceptQuest:  [1002]', '<ce> Yes.', '',
  'QBN:', 'Person _giver_ faction The_Mages_Guild female', '', '\tql name _giver_ Ysolde_Marnhel', '\tql name _nobody_ Anyone'];

test('QL12 AUDIT QUESTLINES DOC-19 `ql name` names the person by the script\'s own words, underscores read as spaces, and the name rides a save; a symbol that is no person warns and is done (mutants: the underscores kept - "Ysolde_Marnhel")', () => {
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: () => NAME_QUEST, questlinesStamp: () => freshState() });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  const quest = m.startQuestByName('__QLNAME');
  const warn = console.warn; const warned = [];
  console.warn = (s) => warned.push(String(s));
  try { m.tick(); } finally { console.warn = warn; }
  assert.equal(quest.getPerson({ name: 'giver' }).displayName, 'Ysolde Marnhel');
  assert.ok(warned.some((s) => s.includes('ql name: no person _nobody_')), warned.join('\n'));
  assert.ok([...quest.tasks.values()].flatMap((t) => t.actions).every((a) => !(a instanceof QlName) || a.isComplete), 'each done');
  const m2 = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: () => NAME_QUEST, questlinesStamp: () => freshState() });
  for (const t of questlineActionTemplates()) m2.registerAction(t);
  m2.restoreSaveData(m.getSaveData());
  assert.equal(m2.quests.get(quest.uid).getPerson({ name: 'giver' }).displayName, 'Ysolde Marnhel', 'the name rides the save');
});
