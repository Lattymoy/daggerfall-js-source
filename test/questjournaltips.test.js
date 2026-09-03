// AUDIT 58 - THE QUEST JOURNAL'S FIVE TOOLTIPS.
//
// DaggerfallQuestJournalWindow.cs:103-104 drops the window's tooltip
// delay to 1 second, :120-121 gives the dialog button
// "dialogButtonInfo", :165-166 seeds the title label with
// "activeQuestsInfo", and :571 / :615 / :625 / :635 re-point that same
// label per page. Those five strings (Internal_Strings.csv:784, :786,
// :788, :790, :792) are the ONLY place the game teaches the
// left-click-to-move / right-click-to-delete pair the window's own
// handleClick and removeEntry implement - and the port carried
// neither the strings nor a hover seam to hang them on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuestJournalWindow, JOURNAL_RECTS, JOURNAL_MODES, JOURNAL_TIPS, JOURNAL_TOOLTIP_DELAY } from '../src/ui/questJournal.js';
import { ToolTip, toolTipDelay } from '../src/ui/toolTip.js';

const win = () => new QuestJournalWindow({ questMessages: () => [], notebook: () => null });
/** The centre of a JOURNAL_RECTS entry. */
const mid = ([x, y, w, h]) => [x + Math.floor(w / 2), y + Math.floor(h / 2)];

test('A54 journal: the five strings are Internal_Strings.csv:784-792, verbatim', () => {
  assert.equal(JOURNAL_TIPS.dialog,
    'Switch between: Active Quests; Finished Quests; Notebook; Messages', 'csv:784 dialogButtonInfo');
  assert.equal(JOURNAL_TIPS.activeQuests,
    'Click on an active quest that has a target location to initiate travel.', 'csv:786 activeQuestsInfo');
  assert.equal(JOURNAL_TIPS.finishedQuests,
    'Click on an entry to move it. Right click to delete.', 'csv:788 finishedQuestsInfo');
  assert.equal(JOURNAL_TIPS.notebook,
    'Click a note to move. Right click to delete. Click in-between to add a new note.', 'csv:790 notebookInfo');
  assert.equal(JOURNAL_TIPS.messages,
    'History of messages recently shown on screen', 'csv:792 messagesInfo');
  // one per page, and the keys ARE JournalDisplay's four members
  for (const mode of JOURNAL_MODES) assert.ok(JOURNAL_TIPS[mode], `${mode} has a tip`);
});

test('A54 journal: the title tip follows the page, the dialog tip does not', () => {
  const w = win();
  const [dx, dy] = mid(JOURNAL_RECTS.dialog);
  const [tx, ty] = mid(JOURNAL_RECTS.title);

  // the dialog button carries ONE string for the life of the window
  // (:120-121) - it is not re-pointed by SetText*
  w.hover(dx, dy);
  w.tick(JOURNAL_TOOLTIP_DELAY);
  assert.equal(w.tip.text, JOURNAL_TIPS.dialog);

  // the title label's text is the CURRENT page's (:165-166 seeded,
  // :571/:615/:625/:635 re-pointed)
  for (const mode of JOURNAL_MODES) {
    const v = win();
    v.mode = mode;
    v.hover(tx, ty);
    v.tick(JOURNAL_TOOLTIP_DELAY);
    assert.equal(v.tip.text, JOURNAL_TIPS[mode], `${mode} title tip`);
  }

  // and cycling the pages moves it, which is what the four SetText*
  // re-points mean
  const c = win();
  c.hover(tx, ty);
  c.tick(JOURNAL_TOOLTIP_DELAY);
  assert.equal(c.tip.text, JOURNAL_TIPS.activeQuests);
  c.nextCategory();
  c.hover(tx, ty);
  c.tick(JOURNAL_TOOLTIP_DELAY);
  assert.equal(c.tip.text, JOURNAL_TIPS.finishedQuests);

  // anything off both panels clears it (there is no third tip)
  const off = win();
  off.hover(...mid(JOURNAL_RECTS.log));
  off.tick(JOURNAL_TOOLTIP_DELAY);
  assert.equal(off.tip.text, null);
  off.hover(-1, -1);
  assert.equal(off.tip.text, null);
});

test('A54 journal: ToolTipDelay = 1 is this window\'s OWN override (:103-104)', () => {
  const w = win();
  assert.equal(JOURNAL_TOOLTIP_DELAY, 1);
  assert.equal(w.tip.delaySeconds, 1, 'the per-window override, not the GUI setting');
  // it is a REST of a whole second: half of one shows nothing
  const [dx, dy] = mid(JOURNAL_RECTS.dialog);
  w.hover(dx, dy);
  w.tick(0.5);
  assert.equal(w.tip.text, null);
  w.tick(0.5);
  assert.equal(w.tip.text, JOURNAL_TIPS.dialog);
  // ...and a bare ToolTip still reads GUI/ToolTipDelayInSeconds, which
  // ships well under a second - so the override is doing real work
  const bare = new ToolTip();
  assert.equal(bare.delaySeconds, null);
  assert.ok(toolTipDelay() < 1, 'the shipped setting is shorter than this window asks for');
  bare.show('x', 0, 0);
  bare.update(toolTipDelay());
  assert.equal(bare.text, 'x');
});

test('A54 journal: the tip is DRAWN, last, over the page', () => {
  const w = win();
  const [dx, dy] = mid(JOURNAL_RECTS.dialog);
  w.hover(dx, dy);
  w.tick(JOURNAL_TOOLTIP_DELAY);
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, uv, color }) };
  const font = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 4 }, tex: 'font' };
  w.draw(renderer, { width: 320, height: 200 }, font);
  const before = quads.length;
  assert.ok(before > 0, 'the page drew');
  // the tooltip box is a flat rect (no texture) laid down after the
  // page's glyphs - drawing it first would put the log over it
  const lastFlat = quads.map((q, i) => [q, i]).filter(([q]) => q.tex == null).map(([, i]) => i);
  assert.ok(lastFlat.length > 0, 'the tooltip box painted its background');
  assert.ok(Math.max(...lastFlat) > quads.findIndex((q) => q.tex === 'font'),
    'and it painted AFTER the page text');
});
