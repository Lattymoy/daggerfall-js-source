// L10N3f (2026-09-28): A PACK'S BOOKS AND NAME BANKS, READ AS DFU READS THEM. A DFU translation pack ships a book in
// the language beside each classic one (Text/Books/BOKnnnnn-LOC.txt, LocalizedBook.cs) and its own name banks
// (Text/NameGen.txt, NameHelper.cs). Pinned through the port's real functions, over made-up French text written in the
// pack's formats (no pack's text is committed):
//  - LocalizedBook's reader: the header by its keywords, the content whole, ReadAllLines' lines;
//  - CreateBookLabels over a -LOC book's Content: the font held across blank lines, the alignment reset by them,
//    [/color=] and [/scale=], an image with nothing to show;
//  - the reader opening the language's -LOC book first and the BOK file only where there is none; a label's colour
//    and scale placed, drawn and cut into leaves;
//  - GetBookTitle wherever a title is shown (the item's name, the list's tooltip, the bookshelf, %bt), the item keyed
//    by its id; GetRandomBookID's conditions (IsUnique, WhenVarSet);
//  - NameHelper's banks: FullSerializer's lenient JSON, read once a session, so a language switched after never
//    respells a name something already holds - the Nord suffix with them.
// English (no pack) is byte for byte what it was: the classic BOK file, the mapping's titles, one draw, the vendored
// banks' names.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { PACK_KIND } from '../src/systems/translationPacks.js';
import {
  parseLocalizedBook, readAllLines, localizedBookName, openLocalizedBookFile, localizedBookExists, localizedBookHeader, BOOK_DOCUMENT,
} from '../src/systems/localizedBook.js';
import { bookTitle, getRandomBookID, localizedBookMeetsConditions, setBookGlobalVars, createBook, getBookFileName } from '../src/systems/books.js';
import { BOOK_ID_TITLES } from '../src/systems/booksData.js';
import { bookshelfTitles, populateBookshelf } from '../src/systems/bookshelf.js';
import { resolveItemName, expandItemInfo, getBookAuthor } from '../src/systems/itemInfo.js';
import { scrollerToolTipText } from '../src/ui/itemScroller.js';
import { BookReaderWindow, layoutLocalizedBookLines, placeBookLabels, preloadBookArt, parseBookColor, parseBookScale } from '../src/ui/bookReader.js';
import { makeOpenBookHook } from '../src/ui/bookDoor.js';
import { paginateBook, rowInk, scaledFace, INK, canvasFace } from '../src/ui/enhancedBook.js';
import { RSC } from '../src/formats/textRsc.js';
import { DEFAULT_TEXT_COLOR } from '../src/ui/nativePanel.js';
import { loadQuestTables, resetQuestTables } from '../src/systems/quest/tables.js';
import {
  fullName, surname, monsterName, BANK_TYPES, GENDERS, parseFsJson, nameBanksOf, loadNameGenData, resetNameBanks,
} from '../src/characters/nameHelper.js';
import nameGen from '../src/characters/nameGen.json' with { type: 'json' };
import { staticNpcName } from '../src/characters/staticNpc.js';
import { srand } from '../src/formats/dfRandom.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
beforeEach(() => { tm._resetTextManagerForTests(); resetNameBanks(); setBookGlobalVars(null); resetQuestTables(); });

/** Console lines said while `fn` runs. */
function said(fn, method = 'error') {
  const lines = [];
  const orig = console[method];
  console[method] = (...a) => lines.push(a.join(' '));
  try { fn(); } finally { console[method] = orig; }
  return lines;
}
const quiet = async (fn) => {
  const o = [console.warn, console.log];
  console.warn = () => {}; console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.log] = o; }
};

// ── a made-up -LOC book, in the pack's format (CRLF, the keywords in any case) ──────────────────────────────────────
const LOC_42 = [
  'Title: Le Livre des Essais',
  '  AUTHOR:   Un Scribe Inconnu  ',
  'IsNaughty: False',
  'price: 420',
  'IsUnique: False',
  'WhenVarSet:',
  'Content:',
  '',
  '[/font=2]',
  '',
  '[/center]Le Livre des Essais',
  '',
  '[/center]par un scribe',
  '',
  '[/font=4]',
  '    Il etait une fois un livre qui parlait francais.',
  'Title: pas un en-tete',
  '',
].join('\r\n');
const loc = (title, extra = '') => `Title: ${title}\nAuthor: Quelqu'un\nIsNaughty: False\nPrice: 300\n${extra}Content:\n[/center]${title}\n\nTexte.\n`;
const frBooks = (...pairs) => { tm.setLocaleDocuments('fr', pairs.map(([id, text]) => [`${BOOK_DOCUMENT}:BOK${String(id).padStart(5, '0')}`, text])); tm.setLocale('fr'); };

test('L10N3f books: LocalizedBook\'s reader - the header by its keywords, the content whole after Content:, ReadAllLines\' lines', () => {
  assert.equal(BOOK_DOCUMENT, PACK_KIND.BOOK, 'the kind the pack classifier keeps a -LOC book under');
  // ReadAllLines: a terminator at the very end ends the last line, it does not open one
  assert.deepEqual(readAllLines(''), []);
  assert.deepEqual(readAllLines('a\n'), ['a']);
  assert.deepEqual(readAllLines('a\r\n\r\nb'), ['a', '', 'b']);
  assert.deepEqual(readAllLines('a\rb\n\n'), ['a', 'b', '']);
  // the file name the pack keeps a book under (translationPacks.js: <BOOK>-LOC.txt -> <BOOK>, upper-cased)
  assert.equal(localizedBookName('BOK00042.TXT'), 'BOK00042');
  assert.equal(localizedBookName('bok00042-LOC.txt'), 'BOK00042', '-LOC is added only where missing (:161-164)');
  assert.equal(localizedBookName(null), null);

  const book = parseLocalizedBook(readAllLines(LOC_42));
  assert.deepEqual({ ...book, content: undefined }, {
    title: 'Le Livre des Essais', author: 'Un Scribe Inconnu', isNaughty: false, price: 420, isUnique: false, whenVarSet: '', content: undefined,
  });
  assert.equal(book.content, '\n[/font=2]\n\n[/center]Le Livre des Essais\n\n[/center]par un scribe\n\n[/font=4]\n'
    + '    Il etait une fois un livre qui parlait francais.\nTitle: pas un en-tete\n',
    'every line after Content: kept whole - its indent, and a keyword that is only text now - each with its newline added back');
  // the C# defaults for what a file does not set, and TryParse's failures said and read as false / 0
  const bad = said(() => {
    const b = parseLocalizedBook(['IsNaughty: peut-etre', 'Price: cher', 'IsUnique: TRUE', 'Content:']);
    assert.deepEqual(b, { title: null, author: null, isNaughty: false, price: 0, isUnique: true, whenVarSet: null, content: '' });
  });
  assert.deepEqual(bad, ["Could not parse IsNaughty bool from 'peut-etre'. Value must be True or False.", "Could not parse Price int from 'cher'. Value must be numerical."]);

  // the current language's file: English has none; French reads the pack's; a file of no lines is none (:186-187)
  assert.equal(openLocalizedBookFile('BOK00042.TXT'), null, 'English reads no -LOC book');
  assert.equal(localizedBookExists('BOK00042.TXT'), false);
  frBooks([42, LOC_42], [7, '']);
  assert.equal(openLocalizedBookFile('BOK00042.TXT').title, 'Le Livre des Essais');
  assert.equal(openLocalizedBookFile('BOK00042.TXT').content, book.content);
  assert.equal(localizedBookExists('BOK00042.TXT'), true);
  assert.equal(openLocalizedBookFile('BOK00007.TXT'), null, 'an empty file opens nothing, so the classic book stands');
  assert.equal(openLocalizedBookFile('BOK00009.TXT'), null, 'a book the pack lacks');
  tm.setLocale('fr-CA');
  assert.equal(localizedBookHeader('BOK00042.TXT').title, 'Le Livre des Essais', 'the locale chain: fr-CA reads fr\'s');
});

test('L10N3f books: CreateBookLabels over a -LOC book\'s Content - the font held across blank lines, the alignment reset by them, colour and scale, an image with nothing to show', () => {
  const content = [
    '',                                    // an empty label
    '[/font=2]',                           // FontPrefix: no label
    '',                                    // an empty label, and a reset of alignment, colour and scale - not the font
    '[/center]Le Titre',
    '',
    'Sous-titre',                          // left, and still FONT0001 (:235-237 is the only arm that sets the font)
    '[/font=4]',
    '[/center]Un',
    'deux',                                // a line with tokens resets nothing
    '[/left]trois',
    '[/color=ff0000][/scale=1.5]Rouge',
    '[/image=carte.png]',                  // an ImageLabel with no image: nothing, and no reset
    'encore rouge',
    '',
    'noir[/center]centre',                 // one label a token: the justify reaches only what follows it
    '[/pos:x=1,y=2]',                      // PositionPrefix: the default arm, a label of its (empty) text
    '[/inconnu]',                          // an unhandled markup is text
  ].join('\n') + '\n';
  const red = [1, 0, 0, 1];
  const rows = layoutLocalizedBookLines(content).map((l) => [l.text, l.center, l.font, l.color, l.scale]);
  assert.deepEqual(rows, [
    ['', false, 0, null, 1],
    ['', false, 0, null, 1],
    ['Le Titre', true, 2, null, 1],
    ['', false, 0, null, 1],
    ['Sous-titre', false, 2, null, 1],
    ['Un', true, 4, null, 1],
    ['deux', true, 4, null, 1],
    ['trois', false, 4, null, 1],
    ['Rouge', false, 4, red, 1.5],
    ['encore rouge', false, 4, red, 1.5],
    ['', false, 0, null, 1],
    ['noir', false, 4, null, 1],
    ['centre', true, 4, null, 1],
    ['', true, 4, null, 1],
    ['[/inconnu]', true, 4, null, 1],
    ['', false, 0, null, 1],   // Content's last newline: Split('\n') leaves one empty string after it
  ]);
  assert.deepEqual(parseBookColor('1f0a2b'), [0x1f / 255, 0x0a / 255, 0x2b / 255, 1], 'TryParseColor: RGB hex, opaque');
  assert.equal(parseBookColor('xyz'), null, 'the default colour');
  assert.equal(parseBookScale('0.01'), 0.1, 'TextScale is at least 0.1');
  assert.equal(parseBookScale('huge'), 1, 'a scale that will not parse is 1');
  // the reader lays a LocalizedBook out through it; a classic BookFile still through its tokens
  const w = new BookReaderWindow(parseLocalizedBook(readAllLines(LOC_42)));
  assert.deepEqual(w.lines.filter((l) => l.text).map((l) => [l.text, l.center, l.font]), [
    ['Le Livre des Essais', true, 2], ['par un scribe', true, 2], ['    Il etait une fois un livre qui parlait francais.', false, 4], ['Title: pas un en-tete', false, 4],
  ], 'the title in the [/font=2] set three lines above it, as the pack\'s books are written');
  const classic = new BookReaderWindow({ pageCount: 1, getPageTokens: () => [{ formatting: -1, text: 'Once' }, { formatting: RSC.NewLine }] });
  assert.deepEqual(classic.lines.map((l) => l.text), ['Once']);
});

/** Synthetic BOK bytes (API/BookFile.cs's header, one page). */
function bokBytes(title, author, body) {
  const page = [...body].map((c) => c.charCodeAt(0)).concat([RSC.NewLine, RSC.EndOfPage]);
  const out = new Uint8Array(240 + page.length);
  const put = (s, off) => { for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i); };
  put(title, 0); put(author, 64);
  const v = new DataView(out.buffer);
  v.setUint16(234, 1, true);
  v.setUint32(236, 240, true);
  out.set(page, 240);
  return out;
}

test('L10N3f books: the reader opens the language\'s -LOC book first and the BOK file only where it has none - English is the BOK file, byte for byte', async () => {
  const fetched = [];
  const files = { 'BOK00042.TXT': bokBytes('Classic Title', 'Classic Author', 'Classic body'), 'BOK00007.TXT': bokBytes('Seven', 'Someone', 'Seventh body') };
  const fetchBytes = async (name) => { fetched.push(name); if (files[name]) return files[name]; throw new Error(`no ${name}`); };
  let shown = null, failed = 0;
  const open = makeOpenBookHook({ fetchBytes, showReader: (w) => { shown = w; } });

  await open({ message: 42 }, () => failed++);
  assert.deepEqual(fetched, ['BOK00042.TXT'], 'English opens the classic file');
  assert.equal(shown.book.title, 'Classic Title');
  assert.deepEqual(shown.lines.map((l) => l.text), ['Classic body']);
  assert.equal(getBookAuthor(42), 'Classic Author', 'the file\'s author feeds %ba');

  frBooks([42, LOC_42]);
  fetched.length = 0; shown = null;
  await open({ message: 42 }, () => failed++);
  assert.deepEqual(fetched, [], 'a translated book never fetches the classic one (OpenBookFile :64)');
  assert.equal(shown.book.title, 'Le Livre des Essais', 'the enhanced cover\'s title is the book\'s own');
  assert.ok(shown.lines.some((l) => l.text === 'Le Livre des Essais' && l.center && l.font === 2));
  assert.equal(getBookAuthor(42), 'Un Scribe Inconnu', '%ba reads the -LOC author first (BookAuthor :165-169)');
  await open({ message: 7 }, () => failed++);
  assert.deepEqual(fetched, ['BOK00007.TXT'], 'a book the pack lacks: the classic file');
  assert.deepEqual(shown.lines.map((l) => l.text), ['Seventh body']);

  tm.setLocale('en');
  fetched.length = 0;
  await open({ message: 42 }, () => failed++);
  assert.deepEqual(fetched, ['BOK00042.TXT'], 'English again');
  assert.deepEqual(shown.lines.map((l) => l.text), ['Classic body']);
  assert.equal(failed, 0);
});

test('L10N3f books: a -LOC label\'s colour and scale - placed at MaxWidth / scale and rows x scale, drawn in its colour at its size, cut into leaves with both', async () => {
  const fnt = { fixedWidth: 7, fixedHeight: 10, glyphWidth: () => 6, getGlyphPixels: () => null };
  const face = { fnt, tex: 'FONT' };
  // colour and scale hold until an empty line resets them (:221-228)
  const lines = layoutLocalizedBookLines('[/color=ff0000][/scale=2]aa bb cc\nstill\n\nnoir\n');
  const { placed } = placeBookLabels(lines, () => face, 40);
  assert.deepEqual(placed[0].rows, ['aa', 'bb', 'cc'], 'wrapped at (int)(40 / 2) = 20: one word a row');
  assert.equal(placed[0].rowH, 20);
  assert.equal(placed[0].h, 60, 'rows x GlyphHeight x TextScale (TextLabel.cs:708, :789)');
  assert.deepEqual(placed[0].color, [1, 0, 0, 1]);
  assert.deepEqual([placed[1].text, placed[1].y, placed[1].h, placed[1].color], ['still', 60, 20, [1, 0, 0, 1]], 'the next line keeps them');
  assert.deepEqual([placed[2].text, placed[2].y, placed[2].h], ['', 80, 10], 'an empty line resets them');
  assert.deepEqual([placed[3].text, placed[3].h, placed[3].scale, placed[3].color], ['noir', 10, 1, null]);

  // drawn: the classic window over art (a blank BOOK00I0), its glyph quads recorded
  const quads = [];
  const renderer = { screenOffset: [0, 0], uploadTexture: () => ({}), drawScreenQuad: (tex, dst, uv, color) => { if (tex === 'FONT') quads.push({ h: dst.h, color }); }, setScreenScissor() {}, clearScreenScissor() {} };
  await quiet(() => preloadBookArt({ renderer, fetchBytes: async (n) => { if (n === 'BOOK00I0.IMG') return new Uint8Array(64000); throw new Error(n); } }));
  const w = new BookReaderWindow({ title: 'T', author: null, content: '[/color=ff0000][/scale=2]Rouge\n\nnoir\n' });
  w.draw(renderer, { width: 320, height: 200 }, face);
  const inRed = quads.filter((q) => q.color?.[0] === 1 && q.color?.[1] === 0 && q.color?.[2] === 0);
  assert.equal(inRed.length, 5, 'the five glyphs of Rouge, in red');
  assert.ok(inRed.every((q) => q.h === 20), 'at twice the size');
  const plain = quads.filter((q) => q.color === DEFAULT_TEXT_COLOR);
  assert.equal(plain.length, 4, 'noir in the default colour');
  assert.ok(plain.every((q) => q.h === 10), 'at its own size');

  // the enhanced face's leaves carry both, and paint them
  const rows = paginateBook(placed, 1000).flat();
  const r1 = [1, 0, 0, 1];
  assert.deepEqual(rows.map((r) => [r.text, r.scale, r.color]), [['aa', 2, r1], ['bb', 2, r1], ['cc', 2, r1], ['still', 2, r1], ['', 1, null], ['noir', 1, null], ['', 1, null]]);
  assert.equal(rowInk([1, 0, 0, 1]), 'rgba(255,0,0,1)');
  assert.equal(rowInk(null), INK, 'a row without a colour is the journal\'s ink');
  globalThis.document = { createElement: () => ({ getContext: () => ({ font: '', measureText: (t) => ({ width: 6 * t.length }) }) }) };
  try {
    const base = canvasFace(20, 600);
    assert.equal(scaledFace(base, 1), base, 'a row at 1 keeps its face');
    const big = scaledFace(base, 1.5);
    assert.equal(big.fnt.px, 30);
    assert.equal(big.fnt.font, base.fnt.font.replace('20px', '30px'), 'the same cut, scale times the size');
    assert.equal(scaledFace(base, 1.5), big, 'made once');
  } finally { delete globalThis.document; }
  assert.match(read('src/ui/enhancedBook.js'), /paintRow\(pctx, scaledFace\(row\.face \?\? faces\[0\], row\.scale\), row\.text, [^\n]*color: rowInk\(row\.color\) \}\);/,
    'each leaf row is painted at its scale, in its colour');
});

test('L10N3f books: GetBookTitle - the -LOC title wherever a title is shown (the item\'s name, the list\'s tooltip, the bookshelf, %bt), the item keyed by its id; English is the mapping\'s', () => {
  assert.ok(BOOK_ID_TITLES.has(42) && BOOK_ID_TITLES.has(7) && BOOK_ID_TITLES.has(5));
  const item = createBook(42);
  const english = [bookTitle(42), resolveItemName(item), scrollerToolTipText(item), bookshelfTitles([42, 7]), expandItemInfo('%bt', item)];
  const en42 = BOOK_ID_TITLES.get(42);
  assert.deepEqual(english, [en42, en42, en42, [en42, BOOK_ID_TITLES.get(7)], en42]);

  frBooks([42, LOC_42], [5, loc('Arkay le Dieu')]);
  assert.equal(bookTitle(42), 'Le Livre des Essais');
  assert.equal(resolveItemName(item), 'Le Livre des Essais', 'ResolveItemName\'s Books arm (ItemHelper.cs:279-280)');
  assert.equal(scrollerToolTipText(item), 'Le Livre des Essais', 'the list\'s tooltip (ItemListScroller.cs:464-465)');
  assert.deepEqual(bookshelfTitles([42, 7]), ['Le Livre des Essais', BOOK_ID_TITLES.get(7)], 'the shelf\'s pick; a book the pack lacks keeps the mapping\'s');
  assert.equal(expandItemInfo('%bt', item), 'Le Livre des Essais', 'the info panel\'s %bt');
  assert.equal(bookTitle(10000), 'Arkay le Dieu', 'the legacy 10000 alias reads book 5\'s file');
  assert.equal(bookTitle(9999), null, 'an id outside the mapping has no file and no title');
  assert.equal(item.message, 42, 'the item is keyed by its id');
  assert.equal(item.name, createBook(42).name, 'and keeps the template\'s name - the title is read where it is shown');
  assert.equal(getBookFileName(42), 'BOK00042.TXT');
  // the shelf's Start filter keeps a titled book in any language
  const ids = [...BOOK_ID_TITLES.keys()];
  const onto42 = () => (ids.indexOf(42) + 0.5) / ids.length;
  assert.deepEqual(populateBookshelf(onto42), Array(10).fill(42));
  // a pack replaced: its own title, not one kept from before
  tm.setLocaleDocuments('fr', [[`${BOOK_DOCUMENT}:BOK00042`, LOC_42.replace('Title: Le Livre des Essais', 'Title: Le Second Livre')]]);
  assert.equal(bookTitle(42), 'Le Second Livre');

  tm.setLocale('en');
  assert.deepEqual([bookTitle(42), resolveItemName(item), scrollerToolTipText(item), bookshelfTitles([42, 7]), expandItemInfo('%bt', item)], english, 'English again');
});

test('L10N3f books: GetRandomBookID - a book the language has a -LOC file for is drawn only when it meets its conditions; English draws once', () => {
  const ids = [...BOOK_ID_TITLES.keys()];
  const at = (id) => (ids.indexOf(id) + 0.5) / ids.length;
  const rolls = (...seq) => { let i = 0; const f = () => seq[i++]; f.count = () => i; return f; };
  let r = rolls(at(42));
  assert.equal(getRandomBookID(r), 42);
  assert.equal(r.count(), 1, 'English: one draw, as before');

  frBooks(
    [42, loc('Unique', 'IsUnique: True\n')],
    [5, loc('Apres la malediction', 'WhenVarSet: LiftedCurse\n')],
    [9, loc('Attend autre chose', 'WhenVarSet: NotAGlobalVar\n')],
    [7, loc('Sept')],
  );
  r = rolls(at(42), at(7));
  assert.equal(getRandomBookID(r), 7, 'IsUnique: never drawn (LocalizedBookMeetsConditions :665)');
  assert.equal(r.count(), 2);
  assert.equal(localizedBookMeetsConditions(7), true, 'a -LOC book with no conditions');
  assert.equal(localizedBookMeetsConditions(5), true, 'no quest tables: no variable matches, so none is waited on');
  loadQuestTables({ 'Quests-GlobalVars': read('vendor/dfu-quests/Tables/Quests-GlobalVars.txt') });
  r = rolls(at(5), at(7));
  assert.equal(getRandomBookID(r), 7, 'LiftedCurse (global 0) not set: the book waits');
  setBookGlobalVars((id) => id === 0);
  r = rolls(at(5));
  assert.equal(getRandomBookID(r), 5, 'the host\'s globals say it is set');
  assert.equal(r.count(), 1);
  setBookGlobalVars(null);
  assert.equal(localizedBookMeetsConditions(9), true, 'a variable the table does not name is ignored (:657-659)');
  r = rolls(...Array(6).fill(at(42)));
  assert.equal(getRandomBookID(r), ids[0], 'six misses: the mapping\'s first id (:640)');
  assert.equal(r.count(), 6);
  const lacked = ids.find((i) => ![ids[0], 42, 5, 9, 7].includes(i));
  r = rolls(at(lacked));
  assert.equal(getRandomBookID(r), lacked, 'a book the pack lacks is the classic one, drawn at once');

  tm.setLocale('en');
  r = rolls(at(42));
  assert.equal(getRandomBookID(r), 42, 'English again: one draw');
});

// ── the name banks ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Made-up banks in the pack's shape: every set of every bank one part, so a name is the same whatever the seed. */
function madeUpBanks() {
  const parts = { Breton: [['Jean'], ['-Luc'], ['Mar'], ['ie'], ['Du'], ['pont']], Nord: [['Bjor'], ['n'], ['As'], ['trid'], ['X'], ['Y']] };
  return Object.fromEntries(Object.entries(nameGen).map(([bank, b]) => [bank, {
    setCount: b.setCount,
    sets: b.sets.map((s, i) => ({ setIndex: s.setIndex, parts: parts[bank]?.[i] ?? [`${bank}${i}`] })),
  }]));
}
/** The banks as a pack writes them: FullSerializer's leniencies - a missing comma between two sets, a trailing comma,
 *  a comment. */
function packNameGen(banks = madeUpBanks()) {
  const json = JSON.stringify(banks, null, 4);
  const missing = json.replace(/\}\s*,(\s*)\{\s*"setIndex": 3/, (m, sp) => `}${sp}{ "setIndex": 3`);
  assert.notEqual(missing, json);
  return `// banks for a test\n${missing.replace(/\}\s*$/, ',\n}')}`;
}
const frNames = (text = packNameGen(), rows = []) => {
  tm.setLocaleDocuments('fr', [[`${PACK_KIND.NAMEGEN}:NameGen`, text]]);
  if (rows.length) tm.patchLocaleTable('fr', 'Internal_Strings', rows);
  tm.setLocale('fr');
};

test('L10N3f names: a pack\'s NameGen.txt is read as FullSerializer reads it - commas optional, a trailing one allowed, comments; a file that will not read leaves the game\'s own banks', () => {
  assert.deepEqual(parseFsJson('{ "a": [1 2, 3,], /* x */ "b": { "c": "d\\u00e9\\n" } // y\n "e": true }'), { a: [1, 2, 3], b: { c: 'dé\n' }, e: true });
  assert.throws(() => parseFsJson('{ "a" 1 }'), /Expected :/);
  assert.throws(() => parseFsJson('[1, 2'), /No closing \]/);
  assert.throws(() => parseFsJson('{ "a": @ }'), /Unexpected character/);
  const banks = madeUpBanks();
  assert.deepEqual(nameBanksOf(parseFsJson(packNameGen(banks))), banks, 'the pack\'s file reads back whole');
  assert.deepEqual(nameBanksOf(parseFsJson(read('src/characters/nameGen.json'))), nameGen, 'and the game\'s own');
  const short = madeUpBanks(); short.Nord.sets.pop();
  assert.throws(() => nameBanksOf(short), /Nord is missing or short/);
  const empty = madeUpBanks(); empty.Monster2.sets[1].parts = [];
  assert.throws(() => nameBanksOf(empty), /set without parts/, 'a draw over none is DFU\'s DivideByZeroException');
  assert.throws(() => nameBanksOf([]), /not a dictionary/);

  assert.equal(loadNameGenData(), nameGen, 'English reads the game\'s own banks');
  frNames();
  assert.deepEqual(loadNameGenData(), banks, 'French reads its pack\'s');
  frNames('{ "Breton": ');
  const lines = said(() => assert.equal(loadNameGenData(), nameGen), 'log');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^Could not load or deserialize NameGen\.txt database from StreamingAssets\/Text or internal Resources\. Check file exists and is in correct format\./);
});

test('L10N3f names: the banks are read once a session, at the first name made - a language switched after never respells a name something holds; English is the vendored banks\' names, byte for byte', () => {
  // English, before any pack: the names the port always made (computed at 59a7ceb2)
  const seeded = (seed, f) => { srand(seed); return f(); };
  const ENGLISH = [
    [BANK_TYPES.Breton, GENDERS.Male, 1234, 'Trististair Masterton'],
    [BANK_TYPES.Nord, GENDERS.Female, 777, 'Jytia Bjiksen'],
    [BANK_TYPES.Redguard, GENDERS.Male, 42, 'Caogur'],
    [BANK_TYPES.Redguard, GENDERS.Female, 42, 'Caogba'],
    [BANK_TYPES.Imperial, GENDERS.Male, 99999, 'Antigonandros Andrones'],
    [BANK_TYPES.Nord, GENDERS.Male, 5, 'Erarik Bjeldsen'],
  ];
  for (const [bank, gender, seed, name] of ENGLISH) assert.equal(seeded(seed, () => fullName(bank, gender)), name);
  assert.equal(seeded(314, () => monsterName(GENDERS.Female, () => 0.7)), 'Demululah');
  // ...and held: a pack laid in and French chosen AFTER the first name keeps the session's banks
  frNames(packNameGen(), [['nordSurnameImmutableSuffix', 'sson']]);
  for (const [bank, gender, seed, name] of ENGLISH) assert.equal(seeded(seed, () => fullName(bank, gender)), name, 'the session\'s banks: English');

  // a session begun in French reads the pack's banks and its Nord suffix
  resetNameBanks();
  assert.equal(seeded(1234, () => fullName(BANK_TYPES.Breton, GENDERS.Male)), 'Jean-Luc Dupont');
  assert.equal(seeded(5, () => fullName(BANK_TYPES.Breton, GENDERS.Female)), 'Marie Dupont');
  assert.equal(seeded(5, () => surname(BANK_TYPES.Nord)), 'Bjornsson', 'sets 0+1 and the pack\'s nordSurnameImmutableSuffix (NameHelper.cs:246)');
  // the key case (TalkManager.cs:3159, topicTree.js _dialogPartnerIsSamePerson): a quest Person's name, made from the
  // questor's seed when the quest began and saved, against the static NPC's, made again from that seed at each talk
  const npc = { factionID: 0, nameSeed: 4242, gender: GENDERS.Female };
  const person = seeded(4242, () => fullName(BANK_TYPES.Breton, GENDERS.Female));
  assert.equal(staticNpcName(npc, { nameBank: BANK_TYPES.Breton }), person);
  tm.setLocale('en');
  assert.equal(staticNpcName(npc, { nameBank: BANK_TYPES.Breton }), person, 'a switch in play: the NPC is still the Person');
  assert.equal(seeded(5, () => surname(BANK_TYPES.Nord)), 'Bjornsson', 'the suffix is held with the banks');
  tm.setLocaleDocuments('fr', []);
  tm.setLocale('fr');
  assert.equal(staticNpcName(npc, { nameBank: BANK_TYPES.Breton }), person, 'a pack removed in play: still the Person');

  // a new session (a new page) reads the language standing then
  tm.setLocale('en');
  resetNameBanks();
  for (const [bank, gender, seed, name] of ENGLISH) assert.equal(seeded(seed, () => fullName(bank, gender)), name, 'English again');
});
