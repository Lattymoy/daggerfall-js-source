// B1 - THE BOOK READER: BookFile.cs over synthetic BOK bytes (no
// ARENA2 in CI - the shapes are pinned from the format spec, the
// corpus sweep below gates on ARENA2_PATH), the TextFile token
// reader, the id/filename laws over the vendored DFU mapping (the
// baked booksData must equal the vendored books.txt VERBATIM,
// trailing comma tolerated as Unity does), the reader window's
// verbatim scroll law and sounds, the UseItem book arm's new shape,
// and the shop shelf minting real book ids.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BookFile, messageToBookFilename } from '../src/formats/bookFile.js';
import { RSC, readTokens, TOKEN_TEXT } from '../src/formats/textRsc.js';
import { srand, randomRangeInclusive } from '../src/formats/dfRandom.js';
import { BOOK_ID_TITLES } from '../src/systems/booksData.js';
import { getBookFileName, getRandomBookID, bookTitle, CLASSIC_BOOK_COUNT } from '../src/systems/books.js';
import { parseBookMapping } from '../scripts/bakeBooks.mjs';
import { BookReaderWindow, layoutBookLines, SCROLL_AMOUNT, PAGE_PANEL, BOOK_RECTS } from '../src/ui/bookReader.js';
import { useItem } from '../src/systems/useItem.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- synthetic BOK bytes ----
function buildBook({ title = 'Test Book', author = 'A. Author', naughty = false, price = 123, pages = [] } = {}) {
  const head = new Uint8Array(236);
  const put = (s, off, len) => { for (let i = 0; i < Math.min(s.length, len); i++) head[off + i] = s.charCodeAt(i); };
  put(title, 0, 64);
  put(author, 64, 64);
  if (naughty) put('naughty', 128, 8);
  const v = new DataView(head.buffer);
  v.setUint32(224, price, true);
  v.setUint16(234, pages.length, true);
  const offsets = new Uint8Array(pages.length * 4);
  const ov = new DataView(offsets.buffer);
  let pos = 236 + offsets.length;
  const body = [];
  pages.forEach((page, i) => { ov.setUint32(i * 4, pos, true); body.push(page); pos += page.length; });
  const out = new Uint8Array(pos);
  out.set(head, 0);
  out.set(offsets, 236);
  let at = 236 + offsets.length;
  for (const page of body) { out.set(page, at); at += page.length; }
  return out;
}
const text = (s) => [...s].map((c) => c.charCodeAt(0));
// classic centring CLOSES the row it justifies: <text> then 0xFD
const PAGE1 = new Uint8Array([...text('First line'), RSC.NewLine, ...text('Centered'), RSC.JustifyCenter, RSC.EndOfPage]);
const PAGE2 = new Uint8Array([RSC.PositionPrefix, 40, ...text('Offset line'), RSC.NewLine, RSC.FontPrefix, 2, ...text('After font'), RSC.EndOfPage]);

function capturePlays(fn) {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(); } finally { audio.playOneShot = orig; }
  return played;
}

test('books: the baked mapping equals the vendored DFU file, trailing comma and all', () => {
  const vendored = parseBookMapping(readFileSync(join(ROOT, 'vendor', 'dfu-books', 'books.txt'), 'utf8'));
  assert.equal(vendored.length, CLASSIC_BOOK_COUNT);
  assert.equal(CLASSIC_BOOK_COUNT, 92);
  for (const e of vendored) assert.equal(BOOK_ID_TITLES.get(e.id), e.title);
  assert.equal(BOOK_ID_TITLES.get(0), 'The First Scroll of Baan Dar');
  assert.equal(BOOK_ID_TITLES.get(113), 'Bourn in Wood, Part II');   // the entry before the trailing comma
});

test('books: the filename and id laws - low byte, the 10000 alias, unknown null', () => {
  assert.equal(messageToBookFilename(42), 'BOK00042.TXT');
  assert.equal(messageToBookFilename(0x142), 'BOK00066.TXT');   // & 0xFF, verbatim
  assert.equal(getBookFileName(10000), 'BOK00005.TXT');         // Ark'ay The God legacy alias
  assert.equal(getBookFileName(9999), null);                    // unmapped warns and answers null
  assert.equal(bookTitle(10000), bookTitle(5));
  const keys = [...BOOK_ID_TITLES.keys()];
  assert.equal(getRandomBookID(() => 0), keys[0]);
  assert.equal(getRandomBookID(() => 0.999999), keys[keys.length - 1]);
});

test('books: BookFile reads the header and the CLASSIC PRICE LAW seeds DFRandom with the title bytes', () => {
  const bytes = buildBook({ naughty: true, pages: [PAGE1, PAGE2] });
  const bf = new BookFile();
  bf.load(bytes, 'BOK00042.TXT');
  assert.equal(bf.title, 'Test Book');
  assert.equal(bf.author, 'A. Author');
  assert.equal(bf.isNaughty, true);
  assert.equal(bf.pageCount, 2);
  // price = DFRandom seeded with the file's FIRST FOUR BYTES ("Test")
  srand(new DataView(bytes.buffer).getUint32(0, true));
  const expected = randomRangeInclusive(300, 800);
  assert.equal(bf.price, expected);
  assert.ok(bf.price >= 300 && bf.price <= 800);
  // a non-BOK name keeps the header's own price field
  const modded = new BookFile();
  modded.load(buildBook({ price: 123, pages: [PAGE1] }), 'MYBOOK.TXT');
  assert.equal(modded.price, 123);
  // truncation throws, as the C# EndOfStream path reports
  assert.throws(() => new BookFile().load(bytes.slice(0, 100)), /truncated/);
});

test('books: the token reader - text runs, newline, centre, position/font prefixes, end of page', () => {
  const tokens = readTokens(PAGE1, 0, RSC.EndOfPage);
  assert.deepEqual(tokens.map((t) => t.formatting),
    [TOKEN_TEXT, RSC.NewLine, TOKEN_TEXT, RSC.JustifyCenter]);
  assert.equal(tokens[0].text, 'First line');
  const tokens2 = readTokens(PAGE2, 0, RSC.EndOfPage);
  assert.equal(tokens2[0].formatting, RSC.PositionPrefix);
  assert.equal(tokens2[0].x, 40);
  assert.equal(tokens2[3].formatting, RSC.FontPrefix);
  assert.equal(tokens2[3].x, 2);
  // PositionPrefix at the buffer's end survives (the C# peek)
  const tail = readTokens(new Uint8Array([RSC.PositionPrefix]), 0, RSC.EndOfPage);
  assert.equal(tail.length, 1);

  const bf = new BookFile();
  bf.load(buildBook({ pages: [PAGE1, PAGE2] }), 'BOK00000.TXT');
  const lines = layoutBookLines(bf);
  assert.deepEqual(lines.map((l) => [l.text, l.x, l.center]), [
    ['First line', 0, false],
    ['Centered', 0, true],
    ['Offset line', 40, false],
    ['After font', 0, false],
  ]);
  assert.throws(() => bf.getPageTokens(2), /Invalid page index/);
});

test('books: the reader window - open sound, the verbatim scroll clamps, page-turn boundaries, exit', () => {
  const bf = new BookFile();
  // 40 one-line pages -> 400px of book against the 159px panel
  const pages = Array.from({ length: 40 }, (_, i) => new Uint8Array([...text(`Line ${i}`), RSC.NewLine, RSC.EndOfPage]));
  bf.load(buildBook({ pages }), 'BOK00000.TXT');
  let w;
  const opened = capturePlays(() => { w = new BookReaderWindow(bf); });
  assert.deepEqual(opened, [SOUND.OpenBook]);
  assert.equal(w.maxHeight, 400);

  // Up at zero is a no-op (the C# clamp)
  w.scrollBook(SCROLL_AMOUNT);
  assert.equal(w.scrollPosition, 0);
  // Down scrolls by 24 and the page-turn plays when the CENTRE page
  // (scroll / 159 + 0.5) crosses a boundary
  const plays = capturePlays(() => {
    for (let i = 0; i < 4; i++) w.scrollBook(-SCROLL_AMOUNT);   // -96: centre page still 0? -96/159+0.5 = -0.1 -> trunc 0
  });
  assert.equal(w.scrollPosition, -96);
  assert.equal(plays.length, 0, 'no page turn before the centre crossing');
  const plays2 = capturePlays(() => { for (let i = 0; i < 8; i++) w.scrollBook(-SCROLL_AMOUNT); });
  assert.ok(plays2.every((p) => p === SOUND.PageTurn) && plays2.length >= 1, 'crossings play the page turn');

  // The down clamp (ScrollBook verbatim): a step is refused once
  // scrollPosition - 159 + 24 would pass -maxHeight; for the 400px
  // book that rests at exactly -288.
  for (let i = 0; i < 100; i++) w.scrollBook(-SCROLL_AMOUNT);
  assert.equal(w.scrollPosition, -288, 'down rests where the next step would pass -maxHeight');
  const stuck = w.scrollPosition;
  w.scrollBook(-SCROLL_AMOUNT);
  assert.equal(w.scrollPosition, stuck);

  // wheel maps to the buttons; exit clicks and closes
  w.wheel(-1);
  assert.equal(w.scrollPosition, stuck + SCROLL_AMOUNT);
  const exit = capturePlays(() => {
    assert.equal(w.click(BOOK_RECTS.exit[0] + 1, BOOK_RECTS.exit[1] + 1), true);
  });
  assert.deepEqual(exit, [SOUND.ButtonClick]);
  assert.equal(w.done, true);
});

test('books: the UseItem book arm hands the item to the window, with the ruined-book fail text', () => {
  const book = { group: 'Books', templateIndex: 92, message: 42 };
  const r = useItem(book, [book], {});
  assert.equal(r.kind, 'book');
  assert.equal(r.item, book);
  assert.match(r.failText, /ruined/);
  assert.equal(r.pending, undefined, 'no longer a pending destination');
});

test('books: the bookseller shelf mints real classic book ids', () => {
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.Bookseller, quality: 21 }, { level: 1 }, { rolls: () => 0.4 });
  const books = shelf.filter((it) => it.group === 'Books');
  assert.ok(books.length > 0, 'the bookseller stocks books');
  for (const b of books) {
    assert.ok(BOOK_ID_TITLES.has(b.message), `book id ${b.message} is a mapped classic book`);
    assert.equal(getBookFileName(b.message), messageToBookFilename(b.message));
  }
});

test('books: ARENA2 corpus sweep - every classic book parses (gated)', (t) => {
  const arena2 = process.env.ARENA2_PATH;
  const dir = arena2 && join(arena2, 'BOOKS');
  if (!dir || !existsSync(dir)) { t.skip('ARENA2_PATH not set'); return; }
  let count = 0;
  for (const f of readdirSync(dir).filter((f) => /^BOK\d+\.TXT$/i.test(f))) {
    const bf = new BookFile();
    bf.load(new Uint8Array(readFileSync(join(dir, f))), f.toUpperCase());
    assert.ok(bf.title.length > 0, `${f} has a title`);
    assert.ok(bf.pageCount > 0, `${f} has pages`);
    for (let p = 0; p < bf.pageCount; p++) assert.ok(Array.isArray(bf.getPageTokens(p)), `${f} page ${p} tokenizes`);
    count++;
  }
  assert.ok(count > 0, 'books found');
});
