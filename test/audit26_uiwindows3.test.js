// AUDIT 26 - THE UI/WINDOW LEFTOVERS (F150, F151, F163, F164, F165,
// F171, F179). Seven small windows each losing one DFU law at one
// seam: a video that cannot be escaped, a sort that reads a display
// quirk, a colour taken from a default the window overrides, a stat
// warning never drawn, questions never right-aligned, a rename cap
// five characters short, and a book reader that runs consecutive
// centred lines together.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VideoPlayer } from '../src/ui/videoPlayer.js';
import { JOURNAL_COLORS } from '../src/ui/questJournal.js';
import { STAT_DRAINED_COLOR, STAT_INCREASED_COLOR } from '../src/ui/charsheet.js';
import { MAX_ITEM_NAME } from '../src/ui/itemMakerWindow.js';
import { spellPointCost, rawSpellPointCost } from '../src/ui/spellbookWindow.js';
import { LYCANTHROPY_SPELL_TAG } from '../src/systems/lycanthropy.js';
import { layoutBookLines } from '../src/ui/bookReader.js';
import { RSC, TOKEN_TEXT } from '../src/formats/textRsc.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

// ---------------------------------------------------------------
// F151: DaggerfallVidPlayerWindow.Update (:140-142) closes on three
// DISJOINED conditions, and GetBackButtonDown - Escape
// (InputManager.cs:1065-1067) - is checked OUTSIDE the endOnAnyKey
// gate.
// ---------------------------------------------------------------
test('audit26 F151: Escape skips a video even when endOnAnyKey is false', () => {
  // endOfFile is a getter over the VID file, so the probe supplies one
  const probe = (endOfFile, playing) =>
    Object.create(VideoPlayer.prototype, {
      vidFile: { value: { endOfFile } }, playing: { value: playing, writable: true },
    });
  const p = probe(false, true);

  // the endOnAnyKey-false videos: no ordinary key closes them...
  assert.equal(p.shouldClose(true, false, false), false, 'any key does nothing while the gate is shut');
  // ...but the back button does, which is the whole finding.
  assert.equal(p.shouldClose(false, false, true), true, 'Escape closes it anyway');
  assert.equal(p.shouldClose(true, false, true), true);

  // the gate still works for the videos that HAVE it
  assert.equal(p.shouldClose(true, true, false), true);
  assert.equal(p.shouldClose(false, true, false), false);

  // and end-of-file-while-playing is untouched by either
  assert.equal(probe(true, true).shouldClose(false, false, false), true);
  assert.equal(probe(true, false).shouldClose(false, false, false), false, 'EndOfFile AND Playing, both');
});

test('audit26 F151: the frame loop feeds the back button as its own signal', () => {
  const s = src('src/ui/videoPlayer.js');
  // the listener reports WHICH key, and only Escape counts as back
  assert.match(s, /const handler = \(ev\) => onAnyKey\(ev\?\.key === 'Escape'\);/);
  assert.match(s, /listen\(\(back = false\) => \{ anyKey = true; if \(back\) backDown = true; \}\)/);
  assert.match(s, /player\.shouldClose\(anyKey, endOnAnyKey, backDown\)/);
  // ...and the infection call site keeps DFU's endOnAnyKey false -
  // the flag is right, it just never meant unskippable.
  assert.match(src('src/scenes/shared.js'), /\{ endOnAnyKey: false \}/);
});

// ---------------------------------------------------------------
// F179: SortSpellsPointCost (DaggerfallEntity.cs:741-752) orders by
// the raw CalculateTotalEffectCosts value with no tag check. The
// zero-cost quirk lives only in PopulateSpellsList (:264-267), whose
// own comment says it is "so it displays correctly in spellbook".
// ---------------------------------------------------------------
test('audit26 F179: the cost SORT reads the raw cost, the DISPLAY keeps the lycanthropy quirk', () => {
  const lycanthropy = { name: 'Lycanthropy', tag: LYCANTHROPY_SPELL_TAG, cost: 40 };
  const ordinary = { name: 'Spark', cost: 5 };
  const castCost = (sp) => sp.cost;

  // the display still zeroes it - that law is untouched
  assert.equal(spellPointCost(lycanthropy, castCost), 0);
  assert.equal(spellPointCost(ordinary, castCost), 5);
  // ...and the sort does not
  assert.equal(rawSpellPointCost(lycanthropy, castCost), 40);
  assert.equal(rawSpellPointCost(ordinary, castCost), 5);

  // so a lycanthrope's free spell sorts to its REAL position rather
  // than to the front of the book.
  const book = [lycanthropy, ordinary];
  const byRaw = book.slice().sort((a, b) => rawSpellPointCost(a, castCost) - rawSpellPointCost(b, castCost));
  assert.deepEqual(byRaw.map((sp) => sp.name), ['Spark', 'Lycanthropy']);
  const byDisplay = book.slice().sort((a, b) => spellPointCost(a, castCost) - spellPointCost(b, castCost));
  assert.deepEqual(byDisplay.map((sp) => sp.name), ['Lycanthropy', 'Spark'], 'which is what the port used to do');

  // and the window's sort is wired to the raw one
  assert.match(src('src/ui/spellbookWindow.js'),
    /const cost = new Map\(list\.map\(\(sp\) => \[sp, rawSpellPointCost\(sp, this\.deps\.castCost\)\]\)\);/);
});

// ---------------------------------------------------------------
// F163: questLogLabel.HighlightColor = Color.white
// (DaggerfallQuestJournalWindow.cs:152) overrides
// MultiFormatTextLabel's DaggerfallHighlightTextColor default.
// ---------------------------------------------------------------
test('audit26 F163: journal highlight tokens are WHITE, not the label default', () => {
  assert.deepEqual(JOURNAL_COLORS.highlight, [1, 1, 1, 1]);
  assert.notDeepEqual(JOURNAL_COLORS.highlight, [219 / 255, 130 / 255, 40 / 255, 1]);
  // the other three are unaffected, and all four stay distinct
  const set = new Set(Object.values(JOURNAL_COLORS).map((c) => c.join(',')));
  assert.equal(set.size, 4, 'text and newline share the default; the other three differ');
});

// ---------------------------------------------------------------
// F164: UpdatePlayerValues (:414-419) colours each stat label by the
// live value against the permanent one.
// ---------------------------------------------------------------
test('audit26 F164: the stat colours are DFU\'s three, drained below and increased above', () => {
  assert.deepEqual(STAT_DRAINED_COLOR, [190 / 255, 85 / 255, 24 / 255, 1]);
  assert.deepEqual(STAT_INCREASED_COLOR, [178 / 255, 207 / 255, 255 / 255, 1]);
  const s = src('src/ui/charsheet.js');
  // the comparison is live vs PERMANENT, and equal takes neither
  assert.match(s, /const live = liveStat\(e, k\);/);
  assert.match(s, /const permanent = e\.stats\?\.\[k\] \?\? 0;/);
  assert.match(s, /live < permanent \? STAT_DRAINED_COLOR\s*\n\s*: live > permanent \? STAT_INCREASED_COLOR : undefined;/);
  assert.match(s, /label\(live, 141, 17 \+ i \* 24, \{ align: 'center', w: 28, color \}\)/);
});

// ---------------------------------------------------------------
// F165: SetQuestionAnswerPairInConversationListbox places the
// question label Right and the answer Left (:1259, :1270).
// ---------------------------------------------------------------
test('audit26 F165: the question hugs the right margin, the answer the left', () => {
  const s = src('src/ui/nativeTalk.js');
  assert.match(s, /const x = e\.kind === 'question'\s*\n\s*\? R\.conversation\[0\] \+ R\.conversation\[2\] - measureText\(font\.fnt, text\)\s*\n\s*: R\.conversation\[0\];/);
  // each ROW is offset by its own width, not the entry's widest - DFU
  // sets HorizontalTextAlignment Left on both labels, so only the
  // label's placement differs.
  assert.match(s, /e\.lines\.forEach\(\(text, j\) => \{/);
});

// ---------------------------------------------------------------
// F171: TextBox.maxCharacters defaults to 31 (TextBox.cs:26) and
// RenameItem imposes no cap of its own.
// ---------------------------------------------------------------
test('audit26 F171: the rename field takes 31 characters, not 26', () => {
  assert.equal(MAX_ITEM_NAME, 31);
  assert.match(src('src/ui/itemMakerWindow.js'),
    /if \(ch && this\.itemName\.length < MAX_ITEM_NAME\) this\.itemName \+= ch;/);
  assert.equal(/this\.itemName\.length < 26/.test(src('src/ui/itemMakerWindow.js')), false,
    'the old cap is gone, not merely shadowed');
});

// ---------------------------------------------------------------
// F150: CreateBookLabels' `default:` arm adds a SEPARATE label per
// non-formatting token (:253), each its own row through
// LayoutBookLabels' `y += label.Size.y` (:317-328), and the
// alignment applied is the one standing when the label is CREATED
// (:241-245). The port concatenated a line's Text tokens into one
// row and let a justify token reach back over it.
// ---------------------------------------------------------------
// layoutBookLines needs only these two members of a BookFile.
const book = (...tokens) => layoutBookLines({
  pageCount: 1, getPageTokens: () => tokens,
});
const txt = (text) => ({ formatting: TOKEN_TEXT, text });
const fmt = (formatting, x = 0) => ({ formatting, x });

test('audit26 F150: each Text token is its own ROW, and a justify reaches only what FOLLOWS it', () => {
  // the row's own worked example: Text('A'), 0xFD, Text('B'), NewLine
  // is 'A' left and 'B' centred on TWO rows - not one centred 'AB'.
  assert.deepEqual(
    book(txt('A'), fmt(RSC.JustifyCenter), txt('B'), fmt(RSC.NewLine)).map((l) => [l.text, l.center]),
    [['A', false], ['B', true]]);

  // two plain tokens on one line are still two rows
  assert.deepEqual(book(txt('A'), txt('B'), fmt(RSC.NewLine)).map((l) => l.text), ['A', 'B']);

  // ...and a justify token emits NO row of its own: the C# switch
  // consumes it and only `default:` makes a label.
  assert.deepEqual(book(fmt(RSC.JustifyCenter), txt('only'), fmt(RSC.NewLine)).map((l) => [l.text, l.center]),
    [['only', true]]);
});

test('audit26 F150: consecutive centred lines stay separate rows, and the centring does not shift', () => {
  // A classic centred title page: justify once, then three lines.
  // The port ran these together on one over-wide row with the
  // centring a line out of place.
  const rows = book(
    fmt(RSC.JustifyCenter),
    txt('THE TITLE'), fmt(RSC.NewLine),
    txt('by an author'), fmt(RSC.NewLine),
    txt('a subtitle'), fmt(RSC.NewLine),
  );
  assert.deepEqual(rows.map((l) => [l.text, l.center]),
    [['THE TITLE', true], ['by an author', true], ['a subtitle', true]]);
});

test('audit26 F150: the empty-line reset still stands, and a bare justify line is not an empty one', () => {
  // The AUDIT 24 law this batch had to keep working: an empty line
  // adds a Left empty label and resets the alignment (:221-228)...
  assert.deepEqual(
    book(fmt(RSC.JustifyCenter), txt('T'), fmt(RSC.NewLine), fmt(RSC.NewLine), txt('body'), fmt(RSC.NewLine))
      .map((l) => [l.text, l.center]),
    [['T', true], ['', false], ['body', false]]);
  // ...while a line carrying only a justify token converted to real
  // tokens, so it takes the else-arm and resets nothing.
  assert.deepEqual(
    book(fmt(RSC.JustifyCenter), txt('T'), fmt(RSC.NewLine), fmt(RSC.JustifyCenter), fmt(RSC.NewLine), txt('body'), fmt(RSC.NewLine))
      .map((l) => [l.text, l.center]),
    [['T', true], ['body', true]]);
});
