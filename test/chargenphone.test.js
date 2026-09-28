// FIELD 2026-09-27 (michelle!! on the Discord, "unable to add attributes (mobile)": "i can't see the different
// options. i've tried safari and firefox and switching to landscape"). Her screenshot: the Strength description, "What
// these buy you", "12 left to spend", Roll again, Back - and no attribute rows anywhere, under a "CRASH (2) / unknown
// error" box. Reproduced in Chromium at her sizes with the real wizard mounted: the phone block's `grid-template-rows:
// 1fr auto` (written so the race map keeps its room) handed the STATS stage's list the leftover of a ~454px card -
// 0-5px, each part scrolling inside its own box on a page that cannot scroll. The Review stage the same. And a touch
// screen wider than 860px had the stats card's Continue (and the review's Begin) pushed below the screen as a closed
// sheet, because the menu's sheet rule answers a coarse pointer and the wizard's undo only a narrow width. The CRASH
// box was neither: it discarded the error event's own message and said "unknown error". Fixed and re-measured at eight
// sizes (390x664 to 1280x720): every attribute's stepper and the primary are reachable, and a tap lands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crashText } from '../src/ui/crashText.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const body = (src, head) => src.slice(src.indexOf(head), src.indexOf('\nfunction ', src.indexOf(head) + head.length));

test('FIELD 2026-09-27: the stats and review stages are ONE scrolling column on a phone, so no list is handed the leftover of the part beside it (mutants: a stage built without `stacked`; the stacked rule dropped or left scrolling in two boxes)', () => {
  const wiz = rd('src/ui/enhancedChargen.js');
  for (const stage of ['statsStage', 'summaryStage']) {
    assert.match(body(wiz, `function ${stage}() {`), /const pane = el\('div', 'stagebody stacked'\);/, stage);
  }

  const css = rd('src/ui/enhancedStyle.js');
  const phone = css.slice(css.indexOf('@media (max-width: 860px) {\n  /* ONE COLUMN.'), css.indexOf('/* ── THE HELD MAP'));
  assert.ok(phone.length > 0, 'the wizard\'s phone block');
  assert.match(phone, /\.stagebody \{ grid-template-rows: 1fr auto; \}/, 'the race map keeps its rows');
  assert.match(phone, /\.stagebody\.stacked \{ display: block; overflow-y: auto; \}/, 'one column that scrolls');
  assert.match(phone, /\.stagebody\.stacked > \.list, \.stagebody\.stacked > \.detail \{ overflow: visible; \}/, 'and nothing inside it scrolls on its own');
  assert.ok(phone.indexOf('.stagebody.stacked {') > phone.indexOf('.stagebody { grid-template-rows: 1fr auto; }'), 'after the rows it overrides');
});

test('FIELD 2026-09-27: the wizard undoes the menu\'s sheet rule on EVERY screen that rule reaches - a touch screen wider than 860px too (mutant: the reset back under the width alone)', () => {
  const css = rd('src/ui/enhancedStyle.js');
  const menuQuery = '@media (max-width: 860px), (pointer: coarse) {';
  const menuRule = css.indexOf('  .detail {\n    position: fixed;');
  assert.ok(menuRule > 0 && css.lastIndexOf(menuQuery, menuRule) > 0, 'the menu turns .detail into a sheet under the coarse query');
  const reset = css.indexOf('  .stagebody > .detail:not(.wizsheet) {\n    position: static; transform: none; max-height: none; z-index: auto;\n    border-top: 0; padding-bottom: 0;');
  assert.ok(reset > menuRule, 'the wizard\'s reset comes after it');
  assert.equal(css.lastIndexOf('@media', reset), css.lastIndexOf(menuQuery, reset), 'and answers the SAME query');
  assert.match(css.slice(reset, reset + 400), /\.stagebody > \.detail:not\(\.wizsheet\) \.sheet-close \{ display: none; \}/);
});

test('FIELD 2026-09-27: a crash with no error object says the event\'s own message - "Script error.", a worker\'s - not "unknown error" (mutant: the event\'s message discarded again)', () => {
  assert.equal(crashText(null, { message: 'Script error.' }), 'Script error.', 'a muted cross-origin error');
  assert.equal(crashText(undefined, { message: 'Uncaught TypeError: x is null', filename: 'nav.worker.js', lineno: 1, colno: 26 }),
    'Uncaught TypeError: x is null\nat nav.worker.js:1:26', 'a worker\'s error, where it came from');
  assert.equal(crashText(null), 'unknown error', 'nothing to say is still said');
  assert.equal(crashText(null, {}), 'unknown error');
  // an Error object is still its own word, never the event's
  assert.equal(crashText(new TypeError('mesh is null'), { message: 'Uncaught TypeError: mesh is null' }).split('\n')[0], 'TypeError: mesh is null');
});

test('FIELD 2026-09-27 (the pre-merge audit 0927b): the race and class stages are one scrolling column where the screen is SHORT, and only there - in landscape the map had 0-30px (provinces drawn at 10x11px) and the class list 0-8px; stacked on a TALL phone, the class stage\'s "Read about the X" fell under all 19 rows (mutants: race or class built without the class, or stacked on every phone; the short rule dropped, left scrolling in two boxes, on the width alone, or taking a confirm sheet\'s scroll)', () => {
  const wiz = rd('src/ui/enhancedChargen.js');
  for (const stage of ['raceStage', 'classStage']) {
    assert.match(body(wiz, `function ${stage}() {`), /const pane = el\('div', 'stagebody stacked-short'\);/, stage);
  }
  const css = rd('src/ui/enhancedStyle.js');
  const q = '@media (max-width: 860px) and (max-height: 500px) {\n'
    + '  .stagebody.stacked-short { display: block; overflow-y: auto; }\n'
    + '  .stagebody.stacked-short > .list, .stagebody.stacked-short > .detail:not(.wizsheet) { overflow: visible; }\n}';
  assert.ok(css.includes(q), 'one column on a short phone; nothing in it scrolls alone but a confirm sheet');
});

test('FIELD 2026-09-27 (the pre-merge audit 0927b): the review\'s header stops pinning where the screen is short - the face at the real host\'s scale made it 105-175px over a 136-186px landscape stage, and none of the 40 steppers could be reached; a tall phone keeps it pinned (mutants: the header pinned again; the rule on the width, where a tall phone lost it)', () => {
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.reviewhead \{[^}]*position: sticky;/, 'on a desk the header still rides the list');
  const q = '@media (max-height: 500px) {\n  .stagebody.stacked .reviewhead { position: static; }\n}';
  assert.ok(css.includes(q), 'a short screen, phone or wider, scrolls it away');
  assert.ok(css.indexOf(q) > css.indexOf('.reviewhead {'), 'after the rule it overrides');
});

