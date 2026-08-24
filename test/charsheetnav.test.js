// U32: THE CHARACTER SHEET'S FOUR NAVIGATION BUTTONS.
//
// Reported from play: "the F5 menu, the ones that have buttons that
// lead to other UI elements, doesn't work." It was exact. click() had
// this, verbatim:
//
//   // The remaining DFU buttons (... inventory/spellbook/logbook/
//   // history) pend their popups; consume the click so it never
//   // escapes the window.
//   return Object.values(R).some((r) => inRect(r, vx, vy));
//
// Hit-tested, consumed, no action - for all four. Two of them
// (inventory, spellbook) were fully built windows with no caller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CharSheet, CHARSHEET_RECTS, NAV_BUTTONS } from '../src/ui/charsheet.js';
import { charSheetHooks } from '../src/ui/charSheetNav.js';
import { QuestJournalWindow, JOURNAL_RECTS, JOURNAL_MODES } from '../src/ui/questJournal.js';
import { PlayerHistoryWindow, HISTORY_RECTS } from '../src/ui/playerHistory.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');
const mid = ([x, y, w, h]) => [x + w / 2, y + h / 2];
const entity = () => ({ name: 'Rhodri', backStory: [], items: [], spells: [] });

test('U32: every navigation button OPENS its window - none is swallowed', () => {
  const opened = [];
  const stub = (tag) => () => ({ done: false, tag, draw: () => true, input() {}, click() {} });
  const sheet = new CharSheet(entity(), charSheetHooks({
    entity: entity(),
    inventory: () => { opened.push('inventory'); return stub('inv')(); },
    spellbook: () => { opened.push('spellbook'); return stub('spb')(); },
    questMessages: () => [],
    notebook: () => null,
  }));
  assert.deepEqual([...NAV_BUTTONS], ['inventory', 'spellbook', 'logbook', 'history']);
  for (const which of NAV_BUTTONS) {
    sheet.child = null;
    assert.equal(sheet.click(...mid(CHARSHEET_RECTS[which])), true, `${which}: the click must be answered`);
    assert.ok(sheet.child, `${which}: the button must PUSH a window - this is the reported bug`);
    assert.equal(sheet.notice, null, `${which}: a window that opened needs no excuse`);
    assert.equal(sheet.done, false, `${which}: opening a child must not close the sheet`);
  }
  assert.deepEqual(opened, ['inventory', 'spellbook'], 'the host-built windows are built by the HOST');
});

test('U32: the pushed window is a STACK - it owns input and draw, and popping reveals the sheet', () => {
  const seen = [];
  const child = { done: false, draw: () => 'CHILD', input: (a) => seen.push(a), click: () => seen.push('click') };
  const sheet = new CharSheet(entity(), { history: () => child });
  sheet.click(...mid(CHARSHEET_RECTS.history));
  assert.equal(sheet.child, child);
  // while it is up the child takes everything
  sheet.input('Escape');
  assert.deepEqual(seen, ['Escape'], 'the child owns the keyboard');
  assert.equal(sheet.done, false, "Escape closed the CHILD's window, not the sheet");
  assert.equal(sheet.draw({}, {}, {}, 1), 'CHILD', 'the child draws on top');
  sheet.click(10, 10);
  assert.deepEqual(seen, ['Escape', 'click'], 'the child owns the pointer');
  // and when it finishes, the sheet is back - not closed with it
  child.done = true;
  sheet.input('x');
  assert.equal(sheet.child, null, 'a finished child POPS');
  assert.equal(sheet.done, false, 'and the sheet is still open underneath (DFU pushes, it does not replace)');
  // now the sheet's own keys work again
  sheet.input('Escape');
  assert.equal(sheet.done, true);
});

test('U32: a window this host cannot open SAYS SO - it is never silently eaten', () => {
  // The whole defect was a silent swallow. A host that cannot build a
  // window must produce a sentence, not nothing.
  const sheet = new CharSheet(entity(), charSheetHooks({ entity: entity() }));
  assert.equal(sheet.click(...mid(CHARSHEET_RECTS.inventory)), true);
  assert.equal(sheet.child, null);
  assert.ok(sheet.notice && /out of reach/.test(sheet.notice), `a refusal must be stated, got: ${sheet.notice}`);
  assert.ok(!/broken|unsupported|not implemented|missing/i.test(sheet.notice), 'and must not disparage the port');
  // a hook that returns null is the same case (art not loaded yet)
  const sheet2 = new CharSheet(entity(), charSheetHooks({ entity: entity(), inventory: () => null }));
  sheet2.click(...mid(CHARSHEET_RECTS.inventory));
  assert.ok(sheet2.notice, 'a hook that refuses must be reported too');
  // the next interaction clears it
  sheet2.input('Escape');
  assert.equal(sheet2.notice, null);
});

test('U32: with NO quest source the logbook is withheld, not shown empty - the anti-lie law', () => {
  // "You have no active quests" told to a player who has three is a
  // lie. The dungeon host has no quest bridge today, so it must get
  // the refusal rather than an empty book.
  const none = charSheetHooks({ entity: entity() });
  assert.equal(none.logbook, undefined, 'no quest source -> no logbook window at all');
  // and with a source, it opens
  const some = charSheetHooks({ entity: entity(), questMessages: () => [], notebook: () => null });
  assert.equal(typeof some.logbook, 'function');
  assert.ok(some.logbook() instanceof QuestJournalWindow);
  // history needs nothing but the entity, so it is always available
  assert.ok(none.history() instanceof PlayerHistoryWindow);
});

test('U32: the spellbook is the ONE that already existed - no second implementation', () => {
  // ONE DFU MEMBER, ONE EXPORT. DaggerfallSpellBookWindow was ported at
  // U4 into ui/inventory.js with delete/swap/sort; wiring the button
  // must not have minted a rival. U42 MOVED that one home onto the
  // classic art (ui/spellbookWindow.js) and DELETED the U4 keyed
  // window rather than leaving two - which is what this pin is for,
  // so it follows the home instead of pinning the old address.
  const files = ['ui/spellbookWindow.js', 'ui/deathScreen.js', 'ui/charsheet.js', 'ui/charSheetNav.js', 'ui/questJournal.js', 'ui/playerHistory.js'];
  const declarers = files.filter((f) => /export class SpellbookWindow/.test(src(f)));
  assert.deepEqual(declarers, ['ui/spellbookWindow.js'], 'SpellbookWindow must be declared exactly once, where it now lives');
  // and the hosts hand the sheet THAT window
  for (const host of ['scenes/exterior.js', 'scenes/world.js', 'scenes/dungeonContext.js']) {
    const s = src(host);
    assert.match(s, /charSheetHooks\(\{/, `${host}: the sheet must be given its navigation hooks`);
    assert.match(s, /spellbook:/, `${host}: including a spellbook hook`);
    assert.match(s, /from '\.\.\/ui\/charSheetNav\.js'/, `${host}: through the one shared factory`);
  }
});

test('U32: the journal is DFU verbatim - rects, the four modes, and stepping by ONE ENTRY', () => {
  assert.deepEqual([...JOURNAL_MODES], ['activeQuests', 'finishedQuests', 'notebook', 'messages']);
  assert.deepEqual(JOURNAL_RECTS.dialog, [32, 187, 68, 10]);
  assert.deepEqual(JOURNAL_RECTS.upArrow, [181, 188, 13, 7]);
  assert.deepEqual(JOURNAL_RECTS.downArrow, [209, 188, 13, 7]);
  assert.deepEqual(JOURNAL_RECTS.exit, [278, 187, 30, 9]);

  const msg = (text) => ({ getTextTokens: () => [{ formatting: 'text', text }] });
  const w = new QuestJournalWindow({ questMessages: () => [msg('a'), msg('b'), msg('c')], notebook: () => null });
  w.pageLines();   // establishes messageCount, as the draw does
  assert.equal(w.messageCount, 3);
  // The arrows step by ONE ENTRY (:271-283), NOT by a page - the thing
  // most likely to be "fixed" into paging by someone tidying up.
  assert.equal(w.currentMessageIndex, 0);
  w.scrollDown();
  assert.equal(w.currentMessageIndex, 1, 'one entry, not one page');
  w.scrollUp();
  assert.equal(w.currentMessageIndex, 0);
  assert.equal(w.scrollUp(), false, 'the top does not wrap');
  // the category button cycles and resets the page (:248-269)
  w.currentMessageIndex = 2;
  w.click(...mid(JOURNAL_RECTS.dialog));
  assert.equal(w.mode, 'finishedQuests');
  assert.equal(w.currentMessageIndex, 0, 'a new category starts at the top');
  for (const expect of ['notebook', 'messages', 'activeQuests']) {
    w.click(...mid(JOURNAL_RECTS.dialog));
    assert.equal(w.mode, expect);
  }
  // the small pages really are smaller (:36 textScale 0.8)
  w.mode = 'notebook';
  assert.equal(w.textScale, 0.8);
  assert.equal(w.maxLines, 28);
  w.mode = 'activeQuests';
  assert.equal(w.textScale, 1);
  assert.equal(w.maxLines, 20);
  // exit closes
  w.click(...mid(JOURNAL_RECTS.exit));
  assert.equal(w.done, true);
});

test('U32: history pages by WHOLE pages of 21, and exit rewinds to the first page', () => {
  assert.deepEqual(HISTORY_RECTS.nextPage, [208, 188, 14, 8]);
  assert.deepEqual(HISTORY_RECTS.exit, [277, 187, 32, 10]);
  // DFU really does write 14x48 for the previous-page button (:64) -
  // ported as written, not silently corrected.
  assert.deepEqual(HISTORY_RECTS.prevPage, [181, 188, 14, 48]);

  const e = { backStory: Array.from({ length: 50 }, (_, i) => `line ${i}`) };
  const w = new PlayerHistoryWindow(e);
  assert.equal(w.pageStartLine, 0);
  w.click(...mid(HISTORY_RECTS.nextPage));
  assert.equal(w.pageStartLine, 21, 'a whole page, unlike the journal');
  w.click(...mid(HISTORY_RECTS.nextPage));
  assert.equal(w.pageStartLine, 42);
  assert.equal(w.nextPage(), false, '42 + 21 > 50, so the last page will not advance');
  w.click(...mid(HISTORY_RECTS.prevPage));
  assert.equal(w.pageStartLine, 21);
  // Exit REWINDS before closing (:127) - reopen and you are at the
  // start, not where you left off.
  w.click(...mid(HISTORY_RECTS.exit));
  assert.equal(w.done, true);
  assert.equal(w.pageStartLine, 0);
  // a character with no backstory gets a sentence, not a blank book
  const empty = new PlayerHistoryWindow({ backStory: [] });
  assert.equal(empty.lines.length, 0);
  assert.equal(empty.nextPage(), false);
});
