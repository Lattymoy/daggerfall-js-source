// PX24 - THE CHRONICLE: the logbook and the history as ONE window.
//
// Mac: "with the logbook and history, I want them as one detailed UI."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chronicleModel, chronicleLines, CHRONICLE_SECTIONS } from '../src/ui/enhancedChronicle.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = (text) => ({ formatting: 'text', text });

test('PX24: three sections, and QUESTS are deliberately not among them', () => {
  assert.deepEqual(CHRONICLE_SECTIONS.map(([id]) => id), ['notes', 'messages', 'history']);
  // The classic logbook has FOUR modes and two are active/finished
  // quests - which the pause window has carried since PX4, in three
  // named sections since PX22. Carrying them here too would be the two
  // character sheets again, which is the thing the F5 overlay is on the
  // board to resolve.
  const jr = read('src/ui/questJournal.js');
  assert.match(jr, /JOURNAL_MODES = Object\.freeze\(\['activeQuests', 'finishedQuests', 'notebook', 'messages'\]\)/);
  const cr = read('src/ui/enhancedChronicle.js');
  assert.doesNotMatch(cr, /activeQuests|finishedQuests|questLog/, 'the chronicle holds no quest list');
  assert.match(read('src/ui/chronicleDoor.js'), /QUESTS ARE NOT IN IT, and that is deliberate/);
});

test('PX24 model: each section from its own source, and the orders differ on purpose', () => {
  const nb = {
    getNotes: () => [[T('a note')], [T('another')], []],
    getMessages: () => [[T('first')], [T('second')]],
  };
  const m = chronicleModel({ notebook: () => nb, entity: { backStory: ['line one', '', 'line two'] } });
  assert.deepEqual(m.notes, [['a note'], ['another']], 'an empty entry is dropped');
  assert.deepEqual(m.messages, [['first'], ['second']]);
  assert.deepEqual(m.history, ['line one', 'line two'], 'backStory is already lines');
  // No notebook at all is not a crash - a host may open this before one exists.
  assert.deepEqual(chronicleModel({}), { notes: [], messages: [], history: [] });
  // The token flattener is the journal's own set.
  assert.deepEqual(chronicleLines([T('x'), { formatting: 'nope', text: 'y' }]), ['x']);
  assert.deepEqual(chronicleLines(null), []);
  // MESSAGES newest first (the ring is oldest-first and the last thing
  // you were told is what you opened this for); NOTES keep the
  // player's own order, because MoveNote is a law they arranged.
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /const list = section === 'messages' \? \[\.\.\.rows\]\.reverse\(\) : rows;/);
  assert.match(read('src/systems/notebook.js'), /MoveNote/);
});

test('PX24 door: one seam, and the CLASSIC skin keeps its two windows', () => {
  const door = read('src/ui/chronicleDoor.js');
  // The enhanced merge is an ENHANCED idea: the classic windows are
  // different art, different layouts and different laws.
  assert.match(door, /if \(section === 'history'\) \{\s*\n\s*return playerHistoryArtLoaded\(\) \? new PlayerHistoryWindow/);
  assert.match(door, /return new QuestJournalWindow\(\{/);
  assert.match(door, /export const chronicleDoorReady = \(\) => isEnhanced\(\) \|\| questJournalArtLoaded\(\);/);
  assert.match(door, /export const historyDoorReady = \(\) => isEnhanced\(\) \|\| playerHistoryArtLoaded\(\);/,
    'each half keeps its own art gate, so a host that can open one still gets the one');
  // The world questions only a host with a map can answer are passed
  // through, not invented here.
  for (const dep of ['currentLocationName', 'canFindPlace', 'gotoPlace']) assert.ok(door.includes(dep), dep);
});

test('PX24: the window is the family\'s, not a fourth dialect', () => {
  const cr = read('src/ui/enhancedChronicle.js');
  const css = read('src/ui/enhancedStyle.js');
  for (const cls of ['px-journal', 'px-qrail', 'px-qdetail', 'px-qname', 'px-qwing']) {
    assert.ok(cr.includes(cls), `${cls} is the journal's own bones`);
  }
  // The head is the same three-zone bar the spellbook wears - and it is
  // SHARED rather than copied, which is what the first render caught:
  // scoped to .sb-shell alone it left this window's head stacked left.
  assert.match(css, /\.sb-shell \.sb-top, \.cr-shell \.sb-top \{ display: grid; grid-template-columns: 1fr auto 1fr;/);
  assert.match(cr, /d\.append\(el\('span', 'px-gem'\), el\('span', 'px-divword', word\), el\('span', 'px-gem'\)\);/);
  // The history is ONE page: the classic pages because it draws into a
  // fixed 320x200 panel, and a DOM column scrolls.
  assert.match(cr, /ONE PAGE, NOT PAGINATED/);
  assert.doesNotMatch(cr, /pageStartLine|MAX_PAGE_LINES/);
});
