// AUDIT 26 - the UI-windows cluster, second half (F159/F170/F180 the
// scrollers, F160 the journal's inert clicks).
//
// F159: the talk conversation gained its two arrow buttons, a
//       PERSISTENT scroll (pinned to the newest row only when content
//       changes), and the wheel; F170: the item maker's enchantment
//       lists scroll on the wheel with clicks mapping through the
//       offset; F180: the spellbook's scroll-bar trough PAGES on
//       click (the thumb drag stays unported - the UI seam carries no
//       held-button state, the listPicker precedent); F160: journal
//       log clicks move/remove/annotate through the notebook store,
//       the title opens EnterNote, and the remove gesture rides the
//       right button the hosts already deliver.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  NativeTalkWindow, TALK_RECTS, CONVERSATION_ARROW_SCROLL, conversationScroll,
} from '../src/ui/nativeTalk.js';
import {
  ItemMakerWindow, ITEM_RECTS, rowLayout, enchContentH,
  ENCH_SCROLLER_STEP, ROWS_VISIBLE, ROW_START_Y, ROW_H_PLAIN, ROW_GAP,
} from '../src/ui/itemMakerWindow.js';
import { QuestJournalWindow, JOURNAL_RECTS, CONFIRM_TEXT, ENTER_NOTE_PROMPT } from '../src/ui/questJournal.js';
import { PlayerNotebook } from '../src/systems/notebook.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F159 ──────────────────────────────────────────────────────────

test('F159: the conversation arrows exist at DFU\'s rects and step 5', () => {
  // rectButtonConversationUp/Down (:226-227), ScrollIndex -/+= 5
  // (:1442-1452).
  assert.deepEqual([...TALK_RECTS.conversationUp], [303, 64, 9, 16]);
  assert.deepEqual([...TALK_RECTS.conversationDown], [303, 176, 9, 16]);
  assert.equal(CONVERSATION_ARROW_SCROLL, 5);
});

test('F159: the conversation scroll PERSISTS - pinned to the newest row only on new content', () => {
  const w = new NativeTalkWindow('hello', {});
  // draw() has not run; simulate its bookkeeping: content 200 in a
  // 126 panel pins at 74.
  w._conversationContentH = 200;
  assert.equal(w.conversationScroll, null, 'null = pin at the next draw');
  // an arrow click from the pinned bottom scrolls UP and HOLDS
  w._scrollConversationBy(-CONVERSATION_ARROW_SCROLL);
  assert.equal(w.conversationScroll, 74 - 5, 'the player\'s position is kept, not recomputed');
  w._scrollConversationBy(-999);
  assert.equal(w.conversationScroll, 0, 'SetScrollIndex clamps at the top');
  w._scrollConversationBy(999);
  assert.equal(w.conversationScroll, 74, '...and at the bottom');
  assert.equal(conversationScroll(200, 126), 74, 'the pin value is UpdateScrollBarConversation\'s');
  // new content re-pins. ROAD-D D10 folded the two push sites into
  // the ONE _pushQA helper - which is DFU's own shape, since
  // SetQuestionAnswerPairInConversationListbox (:1290-1293) is the
  // single writer both the topic ask and ButtonOkay's Work arm reach.
  const s = src('ui/nativeTalk.js');
  assert.equal((s.match(/this\.conversationScroll = null;\s+\/\/ F159/g) ?? []).length, 1,
    'the one conversation writer resets to the newest row');
  assert.equal((s.match(/this\._pushQA\(/g) ?? []).length, 2, 'and both askers go through it');
  // ...and draw() itself HOLDS the player's position - pin-once on
  // null, clamp otherwise - never a per-frame recompute.
  assert.ok(s.includes('else this.conversationScroll = clampScrollPixels(this.conversationScroll, contentH, R.conversation[3]);'),
    'draw clamps the persistent value instead of re-pinning');
});

test('F159: the wheel routes by panel - one pixel per notch, ListBox\'s own step', () => {
  const w = new NativeTalkWindow('hello', {});
  w._conversationContentH = 200;
  w.conversationScroll = 40;
  const [cx, cy] = [TALK_RECTS.conversation[0] + 2, TALK_RECTS.conversation[1] + 2];
  w.hover(cx, cy);
  w.wheel(1);
  assert.equal(w.conversationScroll, 41, 'ScrollDown is scrollIndex++ (ListBox.cs:799-806)');
  w.wheel(-1);
  assert.equal(w.conversationScroll, 40);
  // over the topic list, the TOPIC scroll moves instead
  w.topics = Array.from({ length: 40 }, (_, i) => ({ text: `t${i}` }));
  w.hover(TALK_RECTS.topicList[0] + 2, TALK_RECTS.topicList[1] + 2);
  const before = w.scroll;
  w.wheel(1);
  assert.equal(w.scroll, before + 1);
  assert.equal(w.conversationScroll, 40, 'the conversation did not move');
});

// ── F170 ──────────────────────────────────────────────────────────

test('F170: rowLayout shifts by the scroll and the wheel drives it, 8 a notch past 7 rows', () => {
  // types unknown to the catalogue have no params - plain 7-high rows
  const list = Array.from({ length: 9 }, (_, i) => ({ type: `nope${i}`, param: -1, parentEnchantment: 0 }));
  const flat = rowLayout(list);
  assert.equal(flat[0].y, ROW_START_Y);
  assert.equal(flat[1].y, ROW_START_Y + ROW_H_PLAIN + ROW_GAP, 'the C# stride');
  const shifted = rowLayout(list, 8);
  assert.equal(shifted[0].y, ROW_START_Y - 8, 'Scroller_OnScroll: origin minus ScrollIndex (:284)');

  const w = new ItemMakerWindow({});
  // nine PLAIN rows fit the 120 panel (9*12+2 = 110) and correctly
  // clamp to 0 - overflow needs the two-line rows (12 + gap 5):
  // 9*17+2 = 155, max scroll 35.
  const tall = Array.from({ length: 9 }, () => ({ type: 'EnhancesSkill', param: 0, parentEnchantment: 0 }));
  w.powers = tall;
  const [px, py] = [ITEM_RECTS.powersList[0] + 2, ITEM_RECTS.powersList[1] + 2];
  w.hover(px, py);
  w.wheel(1);
  assert.equal(ENCH_SCROLLER_STEP, 8, 'the LITERAL, not the port asking itself');
  assert.equal(w.powersScroll, 8, 'scrollerStep = 8 (EnchantmentListPicker.cs:25)');
  const max = Math.max(0, enchContentH(tall) - ITEM_RECTS.powersList[3]);
  for (let i = 0; i < 50; i++) w.wheel(1);
  assert.equal(w.powersScroll, max, 'SetScrollIndex\'s clamp');
  for (let i = 0; i < 50; i++) w.wheel(-1);
  assert.equal(w.powersScroll, 0);
  // ShowScroller (:244-247): seven rows or fewer take no wheel EVEN
  // when they overflow the panel - seven two-line rows are 121 pixels
  // in the 120 panel, so without the count gate this would scroll 1.
  w.sideEffects = tall.slice(0, ROWS_VISIBLE);
  w.hover(ITEM_RECTS.sideEffectsList[0] + 2, ITEM_RECTS.sideEffectsList[1] + 2);
  w.wheel(1);
  assert.equal(w.sideEffectsScroll, 0, 'the gate is the COUNT, not the fit');
});

test('F170: clicks and draw both map through the live offset', () => {
  const s = src('ui/itemMakerWindow.js');
  assert.ok(s.includes('const hit = rowLayout(list, this[scrollKey]).find('),
    'the remove click rides the scrolled layout');
  assert.ok(s.includes('for (const row of rowLayout(list, this[scrollKey])) {'),
    'the draw rides the same offset');
  assert.ok(s.includes('if (row.y + row.h <= 0 || row.y >= rect[3]) continue;'),
    'rows hide only when WHOLLY outside, either end (:289)');
});

// ── F180 ──────────────────────────────────────────────────────────

test('F180: the spellbook trough pages by displayUnits on click', () => {
  // VerticalScrollBar.MouseClick (:142-150): above the thumb pages
  // up, below pages down.
  //
  // ROAD-D2 moved the arithmetic itself into ui/verticalScrollBar.js,
  // where the thumb art already lived, so the trough and the paint can
  // never disagree: this pins the DELEGATION (and road_d2's own pins
  // drive the two arms through the live window).
  //
  // ROAD-G G4 took the delegation one step further and the last clause
  // of this pin with it. The window used to call the two PURE helpers
  // (thumbSpan + scrollBarClick) and own the drag's absence - "the drag
  // stays unported - no held-button state reaches an overlay window (the
  // listPicker.js precedent)", which had been false since ROAD-A7. It
  // holds a live `VerticalScrollBar` now, and `press()` IS MouseClick's
  // two arms plus Update's latch, so what is pinned is that the window
  // states neither arm itself. The paging behaviour is driven end to end
  // in test/road_d2_scrollbar_thumbs.test.js and the drag and its
  // release in test/roadg_g4_dragrelease.test.js.
  const s = src('ui/spellbookWindow.js');
  const arm = s.slice(s.indexOf('F180 CLOSED'));
  assert.ok(arm.includes('if (this._syncScrollBar().contains(vx - PANEL_X, vy - PANEL_Y)) {'),
    'the press is tested against the component\'s own rect');
  assert.ok(arm.includes('this.scrollBar.press(vx - PANEL_X, vy - PANEL_Y);'),
    'and MouseClick\'s two arms + Update\'s latch are the component\'s press()');
  assert.equal(/scrollBarClick|thumbSpan\(/.test(s), false,
    'the window states none of the bar\'s own arithmetic any more');
});

// ── F160 ──────────────────────────────────────────────────────────

const journal = (mode = 'notebook') => {
  const nb = new PlayerNotebook({ now: () => 0, location: () => 'Testville' });
  nb.addNote('alpha');
  nb.addNote('beta');
  const w = new QuestJournalWindow({ notebook: () => nb, mode });
  w._font = { fnt: { fixedHeight: 7 } };   // draw() would set this; pitch = trunc(7*0.8) = 5
  return { nb, w };
};
const lineY = (w, line) => JOURNAL_RECTS.log[1] + line * w.lineHeight + 1;

test('F160: the gap between notebook entries carries a NEGATIVE boundary', () => {
  const { w } = journal();
  w.pageLines();
  // two 2-line notes: [0,0,-1,1,1,-2] (SetTextWithListEntries :673-674)
  assert.deepEqual([...w.entryLineMap], [0, 0, -1, 1, 1, -2]);
});

test('F160: a right-click removes through the confirm box; No leaves the note', () => {
  const { nb, w } = journal();
  const [lx, ly] = [JOURNAL_RECTS.log[0] + 4, lineY(w, 0)];
  w.click(lx, ly, true);
  assert.ok(w.moveRemoveBox, 'confirmRemove opens');
  assert.equal(w.moveRemoveBox.remove, true);
  assert.equal(w.moveRemoveBox.rows[0].text, CONFIRM_TEXT.removeHead);
  w.answerMoveRemove(MB_BUTTONS.No);
  assert.equal(nb.getNotes().length, 2, 'No removes nothing');
  assert.equal(w.selectedEntry, null, 'and the pick clears');
  w.click(lx, ly, true);
  w.answerMoveRemove(MB_BUTTONS.Yes);
  assert.equal(nb.getNotes().length, 1, 'Yes deletes');
  assert.equal(nb.getNotes()[0][2].text, ' beta', 'the FIRST note went');
});

test('F160: a move takes TWO clicks - confirm arms, the next click lands it', () => {
  const { nb, w } = journal();
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(w, 0), false);
  assert.ok(w.moveRemoveBox, 'confirmMove opens');
  assert.equal(w.moveRemoveBox.remove, false);
  assert.equal(w.moveRemoveBox.rows[0].text, CONFIRM_TEXT.moveHead);
  w.answerMoveRemove(MB_BUTTONS.Yes);
  assert.equal(w.selectedEntry, 0, 'Yes leaves the pick ARMED (:346-351)');
  // second click on the gap AFTER the second note: boundary -2
  // decodes to -(-2) + 0 = 2 - move note 0 to before position 2.
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(w, 5), false);
  assert.equal(w.selectedEntry, null, 'the move consumed the pick');
  assert.equal(nb.getNotes()[0][2].text, ' beta', 'alpha moved below beta');
  assert.equal(nb.getNotes()[1][2].text, ' alpha');
});

test('F160: a click on the gap adds a note there; the title adds at the page top', () => {
  const { nb, w } = journal();
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(w, 2), false);   // boundary -1
  assert.ok(w.noteBox, 'EnterNote opens between entries');
  assert.equal(w.selectedEntry, 1, '-(-1) + 0 - before the next entry');
  for (const ch of 'gamma') w.input(`char:${ch}`);
  w.input('confirm');
  assert.equal(nb.getNotes().length, 3);
  assert.equal(nb.getNotes()[1][2].text, ' gamma', 'inserted between alpha and beta');
  assert.equal(w.noteBox, null);
  assert.equal(w.selectedEntry, null);
  // TitlePanel_OnMouseClick (:297-300) - EnterNote(0)
  w.click(JOURNAL_RECTS.title[0] + 4, JOURNAL_RECTS.title[1] + 4, false);
  assert.ok(w.noteBox);
  w.input('back');
  assert.equal(w.noteBox, null, 'Escape cancels');
  assert.equal(w.selectedEntry, null);
  assert.equal(nb.getNotes().length, 3, 'and adds nothing');
});

test('F160: EnterNote is the NOTEBOOK\'s alone (:509); finished quests still move and remove', () => {
  const { w } = journal('finishedQuests');
  w.click(JOURNAL_RECTS.title[0] + 4, JOURNAL_RECTS.title[1] + 4, false);
  assert.equal(w.noteBox, null, 'no note door outside the notebook');
  assert.equal(ENTER_NOTE_PROMPT, 'Enter your note:');
  // the dispatchers cover finishedQuests through the store
  const s = src('ui/questJournal.js');
  assert.ok(s.includes("if (this.mode === 'finishedQuests') return nb?.getFinishedQuest(i) ?? null;"));
  assert.ok(s.includes("if (this.mode === 'finishedQuests') nb?.moveFinishedQuest(src, dst);"));
});

test('F160: switching category disarms a pending move (:267)', () => {
  const { w } = journal();
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(w, 0), false);
  w.answerMoveRemove(MB_BUTTONS.Yes);
  assert.equal(w.selectedEntry, 0, 'armed');
  w.nextCategory();
  assert.equal(w.selectedEntry, null, 'a stale pick must not arm a move in the next mode');
});
