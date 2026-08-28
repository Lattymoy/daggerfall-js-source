// PX24 - THE CHRONICLE: the logbook and the history as ONE window.
//
// Mac: "with the logbook and history, I want them as one detailed UI."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chronicleModel, chronicleLines, chronicleEntry, CHRONICLE_SECTIONS } from '../src/ui/enhancedChronicle.js';

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
  assert.deepEqual(m.notes.map((e) => e.body), [['a note'], ['another']], 'an empty entry is dropped');
  assert.deepEqual(m.messages.map((e) => e.body), [['first'], ['second']]);
  assert.deepEqual(m.history, ['line one', 'line two'], 'backStory is already lines');
  // No notebook at all is not a crash - a host may open this before one exists.
  assert.deepEqual(chronicleModel({}), { notes: [], messages: [], history: [] });
  assert.deepEqual(m.notes.map((e) => e.head), [null, null], 'no highlight, no head - and that is honest');
  // The token flattener is the journal's own set.
  assert.deepEqual(chronicleLines([T('x'), { formatting: 'nope', text: 'y' }]), ['x']);
  assert.deepEqual(chronicleLines(null), []);
  // MESSAGES newest first (the ring is oldest-first and the last thing
  // you were told is what you opened this for); NOTES keep the
  // player's own order, because MoveNote is a law they arranged.
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /const list = section === 'messages'\n\s*\? rows\.map\(\(e, i\) => \(\{ e, i \}\)\)\.reverse\(\)/,
    'and the index rides along, because remove needs the TRUE position');
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
  // PX24b: the entries are CARDS with dated heads now, not divider-
  // separated paragraphs, so this window no longer draws a divider.
  assert.doesNotMatch(cr, /px-divword/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.cr-shell \.cr-entry \{ max-width: 66ch;[\s\S]{0,120}border: 2px solid/);
  // The history is ONE page: the classic pages because it draws into a
  // fixed 320x200 panel, and a DOM column scrolls.
  assert.match(cr, /ONE PAGE, NOT PAGINATED/);
  assert.doesNotMatch(cr, /pageStartLine|MAX_PAGE_LINES/);
});

// ── PX24b: THE FIRST DRAFT WAS THIN, AND LOST TWO THINGS ──────────
// Mac: "you can do better than this." He was right on both counts.
test('PX24b: an entry keeps its DATED HEAD - the notebook wrote one and the first draft dropped it', () => {
  // PlayerNotebook._createNote puts a HIGHLIGHT token first: the
  // dated header, from the host's own clock and city (notebook.js:106).
  // Flattening every token to a string turned that into just another
  // line, and the window numbered entries 1, 2, 3 instead.
  const H = (text) => ({ formatting: 'highlight', text });
  const e = chronicleEntry([H('11 Frostfall, 3E 405 in Daggerfall:'), T('The smith owes me a favour.')]);
  assert.deepEqual(e, { head: '11 Frostfall, 3E 405 in Daggerfall:', body: ['The smith owes me a favour.'] });
  // A CONTINUATION page files with NO header (notebook.js:97-107) and
  // comes back headless rather than borrowing the previous one.
  assert.deepEqual(chronicleEntry([T('...and the rest of it.')]), { head: null, body: ['...and the rest of it.'] });
  assert.deepEqual(chronicleEntry(null), { head: null, body: [] });
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /el\('span', 'cr-when', e\.head \?\? '\\u2014 continued \\u2014'\)/,
    'and the window says "continued" rather than inventing a date');
  assert.doesNotMatch(cr, /pxDivider\(String\(/, 'the meaningless 1, 2, 3 dividers are gone');
});

test('PX24b: the player may WRITE - the first draft was read-only, which is a loss', () => {
  // The classic notebook has AddNote and RemoveNote. A prettier window
  // that can do less is not an improvement.
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /deps\.notebook\(\)\.addNote\(text\);/, 'the notebook\'s own AddNote - it stamps the date itself');
  assert.match(cr, /deps\.notebook\(\)\.removeNote\(i\);/);
  const nb = read('src/systems/notebook.js');
  assert.match(nb, /addNote\(str, index = -1\) \{/);
  assert.match(nb, /removeNote\(index\) \{ this\.notes\.splice\(index, 1\); \}/);
  // Both arms appear only when there IS a notebook - a host may open
  // this before one exists, and a control that cannot act is the
  // drawn-door bug.
  assert.match(cr, /if \(section === 'notes' && deps\.notebook\?\.\(\)\) \{/);
  assert.match(cr, /if \(section === 'notes' && deps\.notebook\?\.\(\)\) \{\n\s*const rm = el\('button', 'cr-rm'/);
  // The draft survives a re-render, or every keystroke that triggers
  // one would eat what was typed.
  assert.match(cr, /^let draft = '';/m);
  assert.match(cr, /input\.oninput = \(\) => \{ draft = input\.value; \};/);
  // A thumb can reach the remove.
  assert.match(read('src/ui/enhancedStyle.js'), /@media \(pointer: coarse\) \{ \.cr-shell \.cr-rm \{ min-width: 44px; min-height: 44px; \} \}/);
});
