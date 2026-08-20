// Q1 - THE QUEST SCRIPT PARSER over the vendored DFU quest pack
// (vendor/dfu-quests, MIT - route (a) of the Ledger's sourcing
// decision, approved 2026-08-20). The corpus gate runs EVERYWHERE:
// the pack is committed, so no ARENA2 and no network is needed -
// every one of the 265 quest sources must parse, exactly as DFU's
// own parser consumes them. Structure pins ride M0B00Y16 ("Giant
// Killing"): messages with fixed-type ids from the static-messages
// table, variants on <--->, the resource roster with table-resolved
// values (Foe Giant -> MobileTypes 16, Place dungeon -> p1 1), task
// types including the NextUID-named headless startup, and the Clock
// flag&16 travel-time arm pending loudly (Q3). Action lines land in
// pendingActionLines until Q2's registry exists - pinned non-empty so
// the registry slice has its work queue.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables, resetQuestTables, staticMessagesTable } from '../src/systems/quest/tables.js';
import { Parser, splitLine, splitField, parseInt as questParseInt } from '../src/systems/quest/parser.js';
import { Symbol as QuestSymbol, getInnerSymbolName } from '../src/systems/quest/symbol.js';
import { Table } from '../src/systems/quest/table.js';
import { Formatting } from '../src/systems/quest/message.js';
import { TaskType } from '../src/systems/quest/task.js';
import { customParseInt, Scopes } from '../src/systems/quest/place.js';
import { matchTimeValue } from '../src/systems/quest/clock.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const readLines = (p) => read(p).split(/\r\n|\r|\n/);

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

test('quest: symbol inner names trim wrappers outside in, never inner characters', () => {
  assert.equal(getInnerSymbolName('_symbol_'), 'symbol');
  assert.equal(getInnerSymbolName('==symbol_'), 'symbol');
  assert.equal(getInnerSymbolName('=symbol_'), 'symbol');
  assert.equal(getInnerSymbolName('#symbol'), 'symbol');
  assert.equal(getInnerSymbolName('_one_day_'), 'one_day');   // inner _ survives
  assert.equal(getInnerSymbolName('___mondung_'), 'mondung');
  // AUDIT (mutation M5): the ORDER is the law - = then # then _, each
  // only at the ends. Reversed order would strip the inner ='s here.
  assert.equal(getInnerSymbolName('_=foo=_'), '=foo=');
  const s = new QuestSymbol('_qtime_');
  assert.equal(s.name, 'qtime');
  assert.equal(s.original, '_qtime_');
  assert.ok(s.equals(s.clone()));
});

test('quest: the data table reads schema/rows and answers as DFU Table does', () => {
  const t = new Table(['- comment', 'schema: id,*name', '0, Apples // inline', '1, Oranges', '']);
  assert.equal(t.rowCount, 2);
  assert.ok(t.hasValue('Apples'));
  assert.equal(t.getValue('id', 'Apples'), '0');
  assert.equal(t.getInt('id', 'Oranges'), 1);
  assert.deepEqual(t.getRow('Oranges'), ['1', 'Oranges']);
  // GetInt's int.TryParse failure answer is -1
  const u = new Table(['schema: id,*name', 'x, Weird']);
  assert.equal(u.getInt('id', 'Weird'), -1);
  // No schema throws
  assert.throws(() => new Table(['0, Apples']), /Schema not found/);
});

test('quest: parser statics - splitLine on whitespace, splitField arity, ParseInt defaults', () => {
  assert.deepEqual(splitLine('  Foe _giant_   is Giant '), ['Foe', '_giant_', 'is', 'Giant']);
  assert.deepEqual(splitField(' Quest:  M0B00Y16 '), ['Quest', 'M0B00Y16']);
  assert.throws(() => splitField('a:b:c'), /invalid number of results/);
  assert.equal(questParseInt(''), 0);
  assert.equal(questParseInt(null), 0);
  assert.equal(questParseInt('17'), 17);
  assert.throws(() => questParseInt('x'), /int.Parse failed/);
  assert.equal(customParseInt('0x300'), 0x300);
  assert.equal(customParseInt('-1'), -1);
  assert.equal(matchTimeValue('1.2:30'), 86400 + 2 * 3600 + 30 * 60);
  assert.equal(matchTimeValue('2:30'), 2 * 3600 + 30 * 60);
  assert.equal(matchTimeValue('45'), 45 * 60);
});

test('quest: CORPUS GATE - all 265 vendored quest sources parse', () => {
  const parser = new Parser();
  const files = readdirSync(join(VENDOR, 'Quests')).filter((f) => f.endsWith('.txt')).sort();
  assert.equal(files.length, 265, 'the vendored pack is complete');
  for (const f of files) {
    const quest = parser.parse(readLines(join(VENDOR, 'Quests', f)), 0, { rolls: () => 0.5 });
    assert.ok(quest.questName, `${f} has a quest name`);
    // (__DEMO01/__DEMO02 legitimately carry zero messages - "No text
    // resources" - so the message floor is tasks only.)
    assert.ok(quest.tasks.size > 0, `${f} parsed tasks`);
  }
});

test('quest: M0B00Y16 structure - messages, resources, tasks, verbatim', () => {
  const parser = new Parser();
  const q = parser.parse(readLines(join(VENDOR, 'Quests', 'M0B00Y16.txt')), 510, { rolls: () => 0.5 });
  assert.equal(q.questName, 'M0B00Y16');
  assert.equal(q.displayName, 'Giant Killing');
  assert.equal(q.factionId, 510);

  // QRC: 20 messages; fixed types take their id FROM the table
  assert.equal(q.messages.size, 20);
  assert.equal(staticMessagesTable().getInt('id', 'QuestorOffer'), 1000);
  for (const id of [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009]) {
    assert.ok(q.messages.has(id), `fixed message ${id} present`);
  }
  // RumorsDuringQuest splits on <---> into two variants; lines centre
  const rumors = q.getMessage(1005);
  assert.equal(rumors.variantCount, 2);
  const tokens = rumors.getTextTokensByVariant(0);
  assert.equal(tokens[0].formatting, Formatting.Text);
  assert.equal(tokens[1].formatting, Formatting.JustifyCenter);
  assert.match(tokens[0].text, /giant in ___mondung_/);

  // QBN resources: the full roster, table-resolved where the table answers
  const kinds = [...q.resources.entries()].map(([k, r]) => [k, r.constructor.name]);
  assert.deepEqual(kinds, [
    ['gold', 'Item'], ['magic', 'Item'],
    ['questgiver', 'Person'], ['dummy', 'Person'], ['villager', 'Person'],
    ['mondung', 'Place'], ['newdung', 'Place'], ['store', 'Place'],
    ['qtime', 'Clock'], ['giant', 'Foe'], ['giantFriends', 'Foe'],
  ]);
  const gold = q.resources.get('gold');
  assert.equal(gold.isGold, true);
  const giant = q.resources.get('giant');
  assert.equal(giant.foeType, 16);          // Quests-Foes: Giant -> MobileTypes 16
  assert.equal(giant.spawnCount, 1);        // no count clamps up to 1
  const mondung = q.resources.get('mondung');
  assert.equal(mondung.scope, Scopes.Remote);
  assert.equal(mondung.name, 'dungeon');
  assert.deepEqual([mondung.p1, mondung.p2, mondung.p3], [1, -1, 0]);   // Quests-Places row
  assert.equal(mondung.sitePending, true);  // Q3: world binding

  // Clock _qtime_ 00:00 0 flag 17 range 0 2 - both times zero, flag&16
  // routes to travel time, which pends Place resolution (Q3), loudly
  const qtime = q.resources.get('qtime');
  assert.equal(qtime.flag, 17);
  assert.deepEqual([qtime.minRange, qtime.maxRange], [0, 2]);
  assert.equal(qtime.startingTimeInSeconds, 0);
  assert.equal(qtime.travelTimePending, true);

  // Tasks: 27 including the NextUID-named headless startup (triggered),
  // five variables, and every body line queued for Q2's action registry
  assert.equal(q.tasks.size, 27);
  const types = [...q.tasks.values()].map((t) => t.type);
  assert.equal(types.filter((t) => t === TaskType.Headless).length, 1);
  assert.equal(types.filter((t) => t === TaskType.Variable).length, 5);   // map/nomap/qtime/noMagicItem/escortComplete
  const headless = [...q.tasks.values()].find((t) => t.type === TaskType.Headless);
  assert.equal(headless.triggered, true);
  assert.ok(headless.pendingActionLines.length >= 7, 'startup actions queued for the Q2 registry');
  assert.ok(q.tasks.has('map') && q.tasks.has('nomap'), 'variable tasks by inner symbol name');
});

test('quest: AUDIT pins - header brackets, <ce> trim, PersistUntil start, duplicate-task merge', () => {
  loadTables();
  const parser = new Parser();
  // (M4) A fixed-type header's id comes FROM the static-messages
  // table; the bracketed number is never read. A mismatched bracket
  // still lands the message at the table's id.
  const q = parser.parse([
    'Quest: __AUD',
    'QRC:',
    'QuestComplete:  [9999]',
    '<ce>   padded   ',
    '   left   ',
    '',
    'QBN:',
    'until _later_ performed:',
    ' setvar _later_',
    '',
    '_t_ task:',
    ' say 1004',
    '',
    '_t_ task:',
    ' start task _later_',
    '',
    'variable _later_',
  ], 0, { rolls: () => 0 });
  assert.ok(q.messages.has(1004), 'table id wins');
  assert.equal(q.messages.has(9999), false, 'the bracket number is never read');
  // (M7) <ce> trims the WHOLE line; a plain line trims the end only.
  const tokens = q.getMessage(1004).getTextTokensByVariant(0);
  assert.equal(tokens[0].text, 'padded');
  assert.equal(tokens[1].formatting, Formatting.JustifyCenter);
  assert.equal(tokens[2].text, '   left');
  // (M9) PersistUntil starts TRIGGERED, like headless.
  const persist = [...q.tasks.values()].find((t) => t.type === TaskType.PersistUntil);
  assert.equal(persist.triggered, true, 'until-performed tasks start triggered');
  // (M24) A duplicate task symbol MERGES its actions into the first.
  const t = q.getTask({ name: 't' });
  assert.equal([...q.tasks.values()].filter((x) => x.symbol.name === 't').length, 1);
  assert.equal(t.pendingActionLines.length + t.actions.length, 2, 'both blocks\' lines carried');
});

test('quest: a Clock with two real times takes the seeded range draw', () => {
  loadTables();
  const parser = new Parser();
  const src = [
    'Quest: __TEST',
    'QRC:',
    'Message:  1011',
    ' one line',
    '',
    'QBN:',
    'Clock _t_ 1:00 2:00',
    '',
    '_t_ task:',
    ' say 1011',
  ];
  // roll 0 -> min of range (3600); roll just under 1 -> max (7200)
  const qMin = parser.parse(src, 0, { rolls: () => 0 });
  assert.equal(qMin.resources.get('t').startingTimeInSeconds, 3600);
  const qMax = parser.parse(src, 0, { rolls: () => 0.999999 });
  assert.equal(qMax.resources.get('t').startingTimeInSeconds, 7200);
  // The unknown 'say 1011' action queues for the registry
  assert.deepEqual(qMin.tasks.get('t').pendingActionLines, [' say 1011']);
});

test('quest: parse failures are DFU failures - no name, no QRC, second headless block', () => {
  const parser = new Parser();
  assert.throws(() => parser.parse(['QRC:', 'Message: 1011', ' x', '', 'QBN:', 'foo'], 0), /Quest has no name/);
  assert.throws(() => parser.parse(['Quest: X', 'QBN:', 'x'], 0), /no QRC section/);
  assert.throws(
    () => parser.parse([
      'Quest: X', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
      'headless one', '', 'headless two', '',
    ], 0),
    /Unknown line signature/,
  );
});

test('quest: tables must be loaded, loudly', () => {
  resetQuestTables();
  try {
    const parser = new Parser();
    assert.throws(
      () => parser.parse(['Quest: X', 'QRC:', 'Message: 1', ' x', '', 'QBN:', 'x'], 0),
      /quest tables not loaded/,
    );
  } finally {
    loadTables();   // restore even on failure (shared-process ordering)
  }
});
