// JOURNAL-CLEAN (2026-09-30, Discord: "Should there be a way to clean both finished and unfinished quests from your
// journal for a cleaner look?"): the enhanced journal's tidy-ups - remove an archived entry, clear the archive, hide an
// active quest (it keeps running) and unhide it - and the notebook's hidden list riding the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerNotebook } from '../src/systems/notebook.js';
import { questRail } from '../src/ui/questRail.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const filed = (name) => [{ formatting: 'highlight', text: `${name} completed at noon:` }, { formatting: 'nothing', text: '' }, { formatting: 'text', text: `${name} done.` }];

function bookWith(...names) {
  const nb = new PlayerNotebook({});
  for (const n of names) nb.addFinishedQuestTokens(filed(n));
  return nb;
}

test('JOURNAL-CLEAN: an archived entry removes by its notebook index, and the archive clears whole', () => {
  const nb = bookWith('A', 'B', 'C');
  nb.addNote('keep me');
  nb.removeFinishedQuest(1);
  assert.deepEqual(nb.getFinishedQuests().map((e) => e[0].text), ['A completed at noon:', 'C completed at noon:']);
  nb.clearFinishedQuests();
  assert.equal(nb.getFinishedQuests().length, 0, 'the archive is empty');
  assert.equal(nb.getNotes().length, 1, 'the notes are not the archive and stay');
  const back = new PlayerNotebook({});
  back.restoreSaveData(nb.getSaveData());
  assert.equal(back.getFinishedQuests().length, 0, 'a cleared archive saves cleared');
});

test('JOURNAL-CLEAN: hide/unhide keep one string id each and survive snapshot/restore; old saves hide nothing', () => {
  const nb = new PlayerNotebook({});
  assert.equal(nb.hideQuest(7), true);
  assert.equal(nb.hideQuest('7'), false, 'the same quest twice is one entry');
  assert.equal(nb.hideQuest(null), false);
  nb.hideQuest('12');
  assert.deepEqual(nb.getHiddenQuests(), ['7', '12']);
  assert.equal(nb.isQuestHidden(7), true);
  const save = JSON.parse(JSON.stringify(nb.getSaveData()));
  assert.deepEqual(save.hiddenQuestIds, ['7', '12']);
  const back = new PlayerNotebook({});
  back.restoreSaveData(save);
  assert.deepEqual(back.getHiddenQuests(), ['7', '12'], 'the hidden list rides the save');
  assert.equal(back.unhideQuest(7), true);
  assert.equal(back.unhideQuest(7), false, 'unhiding what is not hidden answers false');
  assert.deepEqual(back.getHiddenQuests(), ['12']);
  // an old save (DFU's two fields only) and a malformed list
  back.restoreSaveData({ notebookEntries: [], finishedQuestEntries: [] });
  assert.deepEqual(back.getHiddenQuests(), []);
  back.restoreSaveData({ hiddenQuestIds: ['3', 3, null, { x: 1 }, 4] });
  assert.deepEqual(back.getHiddenQuests(), ['3', '4']);
  // nothing hidden: the save is the shape it always was
  assert.deepEqual(Object.keys(new PlayerNotebook({}).getSaveData()), ['notebookEntries', 'finishedQuestEntries']);
  // a new game hides nothing
  nb.clear();
  assert.deepEqual(nb.getHiddenQuests(), []);
});

test('JOURNAL-CLEAN: a hidden quest that ends is filed to the archive and its hidden id dropped', () => {
  const nb = new PlayerNotebook({ midDateTimeString: () => 'noon' });
  nb.hideQuest('5');
  nb.hideQuest('6');
  const quest = { uid: 5, displayName: 'A Small Debt', questSuccess: true };
  nb.addFinishedQuest([{ parentQuest: quest, getTextTokens: () => [{ formatting: 'text', text: 'Paid.' }] }]);
  assert.equal(nb.getFinishedQuests().length, 1, 'filed normally');
  assert.equal(nb.getFinishedQuests()[0][0].text, 'A Small Debt completed at noon:');
  assert.deepEqual(nb.getHiddenQuests(), ['6'], 'the ended quest is no longer hidden; the live one still is');
});

test('JOURNAL-CLEAN: the rail leaves hidden quests out of `active` and hands them as `hidden`', () => {
  const row = (id) => ({ id, name: `Q${id}`, questName: 'X', messages: [{ id }], steps: [{ time: 1 }] });
  const reader = () => ['line'];
  const log = { active: [row('1'), row('2'), row('3')], finished: [filed('Old')], hidden: ['2', 99] };
  const r = questRail(log, reader);
  assert.deepEqual(r.active.map((q) => q.id), ['1', '3']);
  assert.deepEqual(r.hidden.map((q) => q.id), ['2']);
  assert.equal(r.hidden[0].key, 'a:2', 'a hidden row keeps its key');
  assert.equal(r.finished[0].key, 'f:0');
  // no `hidden` (the lens's call) hides nothing
  assert.deepEqual(questRail({ active: log.active, finished: [] }, reader).active.map((q) => q.id), ['1', '2', '3']);
});

test('JOURNAL-CLEAN: the bridge walk hands `hidden` beside `active` (rows stay for the lens) and journalClean acts on the notebook', () => {
  const src = read('src/scenes/questBridge.js');
  // PIN MOVED (QUEST-SHELF, 2026-10-08): and the quests set aside, beside them
  assert.match(src, /return \{ active, finished: notebook\?\.getFinishedQuests\(\) \?\? \[\], ended, hidden: notebook\?\.getHiddenQuests\?\.\(\) \?\? \[\], shelved \};/);
  assert.match(src, /notebook\?\.unhideQuest\?\.\(q\.uid\);/, 'an ended quest (even one that filed nothing) is unhidden by the walk');
  // journalClean driven off the shipped source over a real notebook
  const start = src.indexOf('    journalClean: {');
  const end = src.indexOf('\n    },', start) + 6;
  const body = src.slice(start, end);
  const make = new Function('notebook', `const o = { ${body} }; return o.journalClean;`);
  const nb = bookWith('A', 'B', 'C');
  const jc = make(nb);
  assert.equal(jc.removeFinished(5), false, 'an index past the archive removes nothing');
  assert.equal(jc.removeFinished(-1), false, 'nor a negative one (splice(-1) would take the last)');
  assert.equal(jc.removeFinished(0), true);
  assert.equal(nb.getFinishedQuests().length, 2);
  assert.equal(jc.hide(4), true);
  assert.deepEqual(nb.getHiddenQuests(), ['4']);
  assert.equal(jc.unhide('4'), true);
  assert.equal(jc.clearFinished(), 2);
  assert.equal(nb.getFinishedQuests().length, 0);
  const none = make(null);
  assert.equal(none.removeFinished(0), false);
  assert.equal(none.clearFinished(), 0);
  assert.equal(none.hide(1), false);
});

test('JOURNAL-CLEAN: every host that hands the pause window questLog hands journalClean beside it', () => {
  const pins = {
    'src/scenes/world.js': [/journalClean: \(\) => questBridge\?\.journalClean \?\? null,/g, 2],
    'src/scenes/exterior.js': [/journalClean: \(\) => questBridge\?\.journalClean \?\? null,/g, 2],
    'src/scenes/dungeonContext.js': [/journalClean: \(\) => opts\.questBridge\?\.journalClean \?\? null,/g, 1],
    'src/scenes/worldModes.js': [/journalClean: \(\) => host\.journalClean\?\.\(\) \?\? null,/g, 1],
  };
  for (const [file, [re, n]] of Object.entries(pins)) {
    assert.equal((read(file).match(re) ?? []).length, n, `${file} wires journalClean ${n}x`);
  }
});

test('JOURNAL-CLEAN: the Quests tab draws Remove (armed twice), Clear archive (armed twice), Hide/Unhide and Show hidden', () => {
  const src = read('src/ui/enhancedMenu.js');
  const start = src.indexOf('function pauseQuests(body) {');
  const tab = src.slice(start, src.indexOf('\nfunction render() {', start));
  assert.match(tab, /const clean = hooks\.journalClean\?\.\(\) \?\? null;/);
  assert.match(tab, /'Click again to remove' : 'Remove'/);
  assert.match(tab, /if \(journalCleanArmed !== sel\.key\) \{ journalCleanArmed = sel\.key; render\(\); return; \}/, 'the first Remove only arms');
  assert.match(tab, /clean\.removeFinished\?\.\(index\);/);
  assert.match(tab, /'Click again to clear archive' : `Clear archive \(\$\{finished\.length\}\)`/);
  assert.match(tab, /if \(journalCleanArmed !== 'clear'\) \{ journalCleanArmed = 'clear'; render\(\); return; \}/, 'the first Clear only arms');
  assert.match(tab, /clean\.clearFinished\?\.\(\);/);
  assert.match(tab, /isHidden \? 'Unhide' : 'Hide from journal'/);
  assert.match(tab, /`Show hidden \(\$\{hidden\.length\}\)`/);
  assert.match(tab, /const shown = questShowHidden \? hidden : \[\];/);
  assert.match(tab, /rows\[0\]\?\.key \?\? null/, 'a journal whose every quest is hidden has no first row to open on');
  // the arming and the toggle never outlive the visit
  assert.match(src, /journalCleanArmed = null;   \/\/ JOURNAL-CLEAN: \.\.\.nor an armed Remove or Clear archive\n  questShowHidden = false;/);
  // the live timer still finds a hidden quest that is shown
  assert.match(src, /\[\.\.\.r\.active, \.\.\.r\.hidden\]\.find\(\(row\) => row\.key === key\)/);
});

test('AUDIT JOURNAL-CLEAN F3: a hidden id whose quest no longer runs is dropped - a reused uid never starts hidden', () => {
  const nb = new PlayerNotebook({});
  nb.hideQuest('7'); nb.hideQuest('9');
  assert.equal(nb.pruneHiddenQuests(['9', '12']), 1);
  assert.deepEqual(nb.getHiddenQuests(), ['9']);
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/scenes/questBridge.js'), 'utf8');
  assert.equal((src.match(/notebook\?\.pruneHiddenQuests\?\.\(/g) ?? []).length, 2, 'the walk and the load both prune');
});
