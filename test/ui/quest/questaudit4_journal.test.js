// QUEST-AUDIT IV (2026-10-30, bible/01-Overview/audits/Quest-Audit-IV.md): THE JOURNAL'S OWN DEFECTS, on the real
// bridge. JOURNAL-1: on the classic logbook's Finished Quests a click in a gap armed a move from entry -1, and the next
// click emptied an archived entry and broke every save after it. JOURNAL-2: a bounty's, a hunt's or a Legacy death
// quest's row was let go of when tracked and unhidden when hidden, the bridge judging them by its machine alone.
// JOURNAL-3: the guilds' S00005xx series was filed, heralded and refused for sharing as the main quest. Mutants:
// tools/mutants/questaudit4_journal.json.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { QuestJournalWindow, JOURNAL_RECTS } from '../../../src/ui/quest/questJournal.js';
import { PlayerNotebook } from '../../../src/systems/notebook.js';
import { questTracker } from '../../../src/ui/quest/questTracker.js';
import { questRail } from '../../../src/ui/quest/questRail.js';
import { isMainQuestName } from '../../../src/systems/quest/questLists.js';
import { prepareQuestShare } from '../../../src/systems/quest/questShare.js';
import { GUIDANCE_PREF } from '../../../src/systems/quest/questGuidance.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { ROOT, loadTables, questSource } from '../../qlSources.mjs';

afterEach(() => { _resetForTests(); delete globalThis.location; questTracker.pinned = null; questTracker.forget(); });

function bridge() {
  loadTables();
  const st = { s: 400 * 86400 + 12 * 3600 };
  return createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n, ql) => questSource(n, ql ?? true) },
    classicSeconds: () => st.s, skySeconds: () => st.s, worldSeconds: () => st.s, isPlayerInTown: () => true,
    playerEntity: { name: 'Hero', level: 20, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
    midDateTimeString: () => '13:30 04 Morning Star 3E405', dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405', cityName: () => 'Daggerfall',
    showChoice: () => {}, giveItemToPlayer: () => {}, carriesQuestItem: () => false, addHUDText: () => {}, showPopup: () => {},
  }, { label: 'questaudit4' });
}
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

test('QUEST-AUDIT IV JOURNAL-1 Finished Quests: a click in a gap arms nothing, so the next click on an entry asks to move it as DFU does - the archive whole and the save whole; and the store refuses an index outside its list (mutants: the gap\'s pick kept; the store unguarded)', () => {
  const b = bridge();
  const q = quiet(() => b.machine.startQuestByName('R0C10Y00'));
  quiet(() => { for (let i = 0; i < 4; i++) b.machine.tick(); q.endQuest(); });   // the real filing: endQuest files the log
  const nb = b.notebook;
  assert.equal(nb.getFinishedQuests().length, 1, 'one entry filed');
  const before = JSON.stringify(nb.getFinishedQuests());
  const w = new QuestJournalWindow({ notebook: () => nb, mode: 'finishedQuests' });
  w._font = { fnt: { fixedHeight: 7 } };
  w.pageLines();
  assert.ok(w.entryLineMap.at(-1) < 0, 'the page ends on a gap');
  const [lx, ly, , lh] = JOURNAL_RECTS.log;
  w.click(lx + 4, ly + lh - 2, false);   // the empty space under the list
  assert.equal(w.selectedEntry, null, 'nothing armed');
  w.click(lx + 4, ly + 1, false);   // the first entry
  assert.ok(w.moveRemoveBox, 'the Move box, DFU\'s');
  assert.equal(JSON.stringify(nb.getFinishedQuests()), before, 'the archive untouched');
  assert.doesNotThrow(() => b.snapshot(), 'the save whole');
  // the store: an index outside the list changes nothing (C#'s List throws)
  const store = new PlayerNotebook({});
  store.addNote('one');
  store.addNote('two');
  const notes = JSON.stringify(store.getNotes());
  store.moveNote(-1, 0);
  store.moveNote(5, 0);
  store.removeNote(-1);
  assert.equal(JSON.stringify(store.getNotes()), notes, 'the notes untouched');
  store.addFinishedQuestTokens([{ formatting: 'text', text: 'Jewel Smuggling ended' }]);
  store.addFinishedQuestTokens([{ formatting: 'text', text: 'The Courier completed' }]);
  const filed = JSON.stringify(store.getFinishedQuests());
  store.moveFinishedQuest(-1, 0);
  store.moveFinishedQuest(1, -1);
  store.removeFinishedQuest(-1);
  store.removeFinishedQuest(2);
  assert.equal(JSON.stringify(store.getFinishedQuests()), filed, 'the archive untouched');
});

test('QUEST-AUDIT IV JOURNAL-2 a host\'s row on the walk - tracked, it stays tracked and on screen; hidden, it stays hidden; gone from the walk, both are let go - and the machine\'s own rows keep their law (mutants: the host\'s pin let go each tick; its hidden id pruned; the host\'s rows off the walk; a gone row\'s pin kept)', () => {
  globalThis.location = { search: '?skin=enhanced' };
  _resetForTests();
  setPref(GUIDANCE_PREF, 'exact');   // a face that follows the model (questTracker.js followOn)
  const b = bridge();
  // revenant.js revenantHuntEntries' shape: one entry of text tokens
  let rows = [{ id: 'hunt:abc', name: 'Hunt: Grumradoth', questName: 'HUNT', hunt: true, clockSeconds: null, messages: [[{ formatting: 'text', text: 'Orc, rank II.' }]] }];
  b.addQuestRows(() => rows);
  b.addQuestRows(() => null);   // a host with nothing to lay
  assert.deepEqual(b.questLog({ windows: false }).active.map((r) => r.id), ['hunt:abc'], 'on the lens\'s walk');
  questTracker.toggle('hunt:abc');
  b.tick(0.11);
  assert.equal(questTracker.pinned, 'hunt:abc', 'still tracked after a tick');
  assert.equal(questTracker.shown()?.id, 'hunt:abc', 'on screen');
  rows[0].messages = [[{ formatting: 'text', text: 'Orc, rank III.' }]];   // its words moved (a bounty's kills)
  b.tick(0.11);
  assert.deepEqual(questTracker.shown()?.latest?.lines, ['Orc, rank III.'], 'the card reads its words as they are');
  assert.equal(b.journalClean.hide('hunt:abc'), true);
  const log = b.questLog();
  assert.deepEqual(log.hidden, ['hunt:abc'], 'still hidden after a walk');
  assert.deepEqual(questRail(log).hidden.map((r) => r.id), ['hunt:abc'], 'in the rail\'s Hidden');
  const loaded = bridge();
  loaded.addQuestRows(() => rows);
  quiet(() => loaded.restore(JSON.parse(JSON.stringify(b.snapshot()))));
  assert.deepEqual(loaded.notebook.getHiddenQuests(), ['hunt:abc'], 'a load keeps it hidden - its row not yet read');
  rows = [];   // the hunt abandoned: the row leaves the walk
  b.tick(0.11);
  assert.equal(questTracker.pinned, null, 'a gone row is tracked no more');
  assert.deepEqual(b.questLog().hidden, [], 'and hidden no more');
  // the machine's own: a tracked uid with no quest is let go, faces on or off
  questTracker.pinned = '999';
  b.tick(0.11);
  assert.equal(questTracker.pinned, null);
  // the world host lays its rows through the seam, every look and every window
  const W = readFileSync(`${ROOT}/src/scenes/world.js`, 'utf8');
  assert.match(W, /questBridge\.addQuestRows\(\(\) => \[\.\.\.\(bountyHost\?\.questLogEntries\?\.\(\) \?\? \[\]\), \.\.\.revenantHuntEntries\(rumorHere\(\)\), \.\.\.\(legacyHost\?\.questLogEntries\(\) \?\? \[\]\)\]\);/);
  assert.doesNotMatch(W, /questBridge\.questLog = /, 'no wrapper past the bridge');
});

test('QUEST-AUDIT IV JOURNAL-3 the guilds\' series filed under S (S00005xx) is not the main quest - its row, its herald and its share are a guild quest\'s; the main story, its aftermath and the starts stay the main quest (mutants: the series read as the main quest)', () => {
  for (const n of ['S0000500', 'S0000501', 'S0000502', 'S0000503']) assert.equal(isMainQuestName(n), false, n);
  for (const n of ['S0000001', 'S0000012', 'S0000100', 'S0000999', 'S0000977', '_BRISIEN', '_STARTIB']) assert.equal(isMainQuestName(n), true, n);
  const b = bridge();
  const q = quiet(() => b.machine.startQuestByName('S0000502'));
  assert.ok(q, 'the Former Student\'s second part parses');
  const r = prepareQuestShare(b.machine, q.uid);
  assert.notEqual(r.reason, 'mainQuest', 'not refused as the main quest');
});
