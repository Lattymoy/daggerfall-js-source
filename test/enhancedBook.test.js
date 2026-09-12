// EB1 - THE ENHANCED BOOK (2026-09-12).
//
// Mac: "For the book reader, I was wondering if we could use the
// animated book in my repo project-raum." Then: "Do it."
//
// A Daggerfall book read in project-raum's animated book. The face
// owns no reading law - the classic BookReaderWindow is the model
// under both faces - so the pins are (1) the door and the hook's one
// home, (2) the PAGINATION, the one thing a two-page book adds to a
// scroll, pure, and (3) the vendored book: Mac's own, marked seams
// and nothing else changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { paginateBook, leafSize, uiScale, LEAF_INSET, bookKey, canvasFace, bodySize, FACE_OF_PREFIX, BOOK_FAMILY } from '../src/ui/enhancedBook.js';
import { measureText } from '../src/ui/text.js';
import { wrapText } from '../src/ui/talkWindow.js';
import { placeBookLabels, BookReaderWindow } from '../src/ui/bookReader.js';
import { createBookReaderWindow, makeOpenBookHook } from '../src/ui/bookDoor.js';
import { BOOK, createBook, resizeBook, spreadCount, clampSpread, spreadPages } from '../vendor/raum-book/book.js';
import { TOKEN_TEXT, RSC } from '../src/formats/textRsc.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A face with fixed metrics, in FntFile's shape: every glyph 6 wide,
 *  rows `h` tall - so a row's width is 7 per glyph (spacing included)
 *  and wrapping is arithmetic. */
const face = (h) => ({ fnt: { fixedWidth: 7, fixedHeight: h, glyphWidth: () => 6, getGlyphPixels: () => null } });
const lines = (...texts) => texts.map((t) => (typeof t === 'string' ? { text: t, center: false, font: 0 } : t));

test('EB1 door: the reader has ONE construction site, the hook lives there, and both skins build the classic model', () => {
  const door = read('src/ui/bookDoor.js');
  assert.match(door, /const model = new BookReaderWindow\(bookFile\);\s*\n[\s\S]{0,260}if \(isEnhanced\(\) && typeof document !== 'undefined'\) return enhancedBookOverlay\(model\);\s*\n\s*return model;/, 'one model, two faces');
  assert.match(door, /showReader\(createBookReaderWindow\(bookFile\)\);/, 'the hook opens through the door');
  assert.match(door, /import\('\.\/enhancedBook\.js'\)/, 'dynamic: classic pays nothing');
  assert.match(door, /unregister = registerOverlay\(exit\);/, 'PX28: Tab closes the book');
  assert.match(door, /z-index:14;image-rendering:pixelated/, 'above the enhanced pack (13): the inventory hands over THEN closes');
  assert.match(door, /const relock = \(\) => \{ if \(hostCanvas\) requestLook\(hostCanvas\); \};/, 'MAC1: the relock, on the canvas draw() taught it');
  assert.doesNotMatch(read('src/ui/bookReader.js'), /export function makeOpenBookHook|new BookReaderWindow\(/, 'the window file no longer opens itself');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    assert.match(read(f), /import \{ makeOpenBookHook \} from '\.\.\/ui\/bookDoor\.js';/, `${f} opens through the door`);
  }
  // EB4 (Mac: "tapping use doesn't do anything and then locks me out
  // of pointerclick in inventory"): the pack hands over THEN closes,
  // and the file lands a microtask after `done` and a frame before the
  // slot is dropped - so every host takes the reader over a DONE
  // occupant, and the door raises its canvas only when the host draws.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(f), /showReader: \(w\) => \{ if \(!townTalk\.overlayActive \|\| townTalk\.overlayDone\) townTalk\.showOverlay\(w\); \}/, `${f}: a done pack does not refuse the reader`);
  }
  assert.match(read('src/scenes/dungeonContext.js'), /showReader: \(w\) => \{ if \(!activeOverlay \|\| activeOverlay\.done\) activeOverlay = w; \}/);
  assert.match(read('src/scenes/townTalk.js'), /get overlayDone\(\) \{ return !!overlay\?\.done; \},/);
  assert.match(door, /draw\(renderer, canvas\) \{\s*\n\s*hostCanvas = canvas \?\? hostCanvas;\s*\n\s*if \(!mounted\) mount\(\);/, 'the canvas mounts on the first draw');
  assert.doesNotMatch(door.slice(door.indexOf('function enhancedBookOverlay')).split('const mount = ')[0], /document\.body\.append/, 'and never at construction');
  // the hand-off law (UI-Arc: hand over, THEN close) is the inventory's and untouched
  assert.match(read('src/ui/enhancedInventory.js'), /kind: 'openBook', item: r\.item, failText: r\.failText, closeFirst: false/);
  // headless: the door hands back the classic window, and it is the model
  const fake = { title: 'The Real Barenziah', author: 'Anonymous', pageCount: 1, getPageTokens: () => [{ formatting: TOKEN_TEXT, text: 'Once' }, { formatting: RSC.NewLine }] };
  const w = createBookReaderWindow(fake);
  assert.ok(w instanceof BookReaderWindow);
  assert.deepEqual(w.lines.map((l) => l.text), ['Once']);
  assert.equal(typeof makeOpenBookHook({ fetchBytes: async () => new Uint8Array(0), showReader() {} }), 'function');
});

test('EB1 pagination: rows never straddle a leaf, keep their face and centring, no leaf opens on white, and an empty book is one blank leaf', () => {
  const big = face(12), small = face(6);
  const fontFor = (x) => (x === 5 ? big : small);
  // a heading in the big face, a blank, then prose that wraps
  const placed = placeBookLabels(lines(
    { text: 'THE REAL BARENZIAH', center: true, font: 5 },
    '',
    'word word word word word word word word word word',   // 10 words: 7px a glyph, 4-5 glyphs each -> wraps at 70
    '',
    'end',
  ), fontFor, 70).placed;
  const pages = paginateBook(placed, 30);
  // every row on every leaf lies inside it
  for (const page of pages) {
    for (const row of page) assert.ok(row.y + row.rowH <= 30, `row at ${row.y} h ${row.rowH} overflows`);
    assert.ok(page.length, 'no empty leaf in the middle');
    assert.ok(page[0].text !== '', 'no leaf opens on a blank row');
  }
  // order preserved, nothing lost
  const rows = pages.flat();
  assert.equal(rows[0].text, 'THE REAL', 'the heading wraps at the leaf (BARENZIAH is the next row)');
  assert.equal(rows[1].text, 'BARENZIAH');
  assert.equal(rows[0].center, true);
  assert.equal(rows[0].face, big);
  assert.equal(rows[0].rowH, 12);
  assert.equal(rows.at(-1).text, 'end');
  assert.equal(rows.filter((r) => r.text.startsWith('word')).map((r) => r.text).join(' ').split(' ').length, 10, 'every word is on some leaf');
  assert.ok(pages.length >= 3, 'the book runs to several leaves at 30px');
  // a tall row alone on a leaf, even when it does not fit
  const tall = paginateBook(placeBookLabels(lines('x'), () => face(50), 70).placed, 30);
  assert.deepEqual(tall.map((p) => p.length), [1]);
  // nothing at all
  assert.deepEqual(paginateBook([], 30), [[]]);
  assert.deepEqual(paginateBook(placeBookLabels(lines('', ''), fontFor, 70).placed, 30), [[]], 'two blank rows are still a blank leaf');
});

test('EB1 leaf: sized off the view - tall, half the width at most, never a slab; the scale is integer and reads the short edge', () => {
  const d = leafSize(700, 450);   // a desktop at UIK 2
  assert.ok(d.ph <= 450 * 0.84 && d.ph >= 300, `desktop leaf height ${d.ph}`);
  assert.ok(d.pw * 2 + 16 <= 700, 'two leaves and the gutter fit the width');
  assert.ok(d.ph <= d.pw * 1.6 && d.ph >= d.pw, 'a book, not a slab and not a strip');
  const p = leafSize(292, 633);   // a portrait phone
  assert.ok(p.pw * 2 + 16 <= 292, 'the spread still fits');
  assert.equal(uiScale(1400, 900, 1), 3);
  assert.equal(uiScale(390, 844, 3), 4);
  assert.equal(uiScale(200, 200, 1), 1, 'never below 1');
  assert.deepEqual(LEAF_INSET, { x: 8, y: 10, w: 20, h: 24 }, "Raum's own inset (book.js pageCanvas)");
  // resizeBook clears nothing when nothing changed, sizes when it did
  const b = createBook([{ paint() {} }, null, { paint() {} }]);
  resizeBook(b, 120, 180);
  assert.equal(BOOK.pageW, 120); assert.equal(BOOK.pageH, 180);
  assert.equal(spreadCount(b.pages), 2);
  assert.equal(clampSpread(9, b.pages), 1);
  assert.deepEqual(spreadPages(b.pages, 0).map((p) => !!p), [true, false]);
});

test('EB1 keys and the vendored book: Mac\'s own, its seams marked, its fold untouched', () => {
  // the keys: exit and the two turns; anything else is not the book's
  assert.equal(bookKey('F5'), false);
  const readme = read('vendor/raum-book/README.md');
  assert.match(readme, /project-raum/);
  assert.match(readme, /Mac's own work/);
  assert.match(readme, /commit `7fa7119e`/);
  const book = read('vendor/raum-book/book.js');
  const paper = read('vendor/raum-book/paper.js');
  assert.ok(existsSync(new URL('../vendor/raum-book/rng.js', import.meta.url)));
  // the seams, and only the seams
  assert.match(book, /const drawJournal = \(ctx, str, x, y, opts = \{\}\) => BOOK\.inscribe\?\.\(ctx, str, x, y, opts\);/, 'every inscription goes through the seam');
  assert.match(book, /cover: \{ title: 'RAUM', subtitle: 'FIELD JOURNAL' \},\s*\n\s*inscribe: null,/);
  assert.match(book, /export function resizeBook\(book, pw, ph\)/);
  assert.doesNotMatch(book, /journalFont/, "Raum's hand is not imported");
  assert.match(paper, /import \{ mix32 \} from '\.\/rng\.js';/);
  // the fold is Raum's line for line: the signed chain and the crest
  assert.match(book, /const drawClothLeaf = \(ctx, frontC, backC, spineX, y, dir, t, drag\) => \{/);
  assert.match(book, /const reach = SW \* c; \/\/ signed/);
  assert.match(book, /if \(crestX !== null\) \{ ctx\.fillStyle = css\(PAPER\.bright, 0\.95\);/);
  assert.equal((book.match(/PORT/g) ?? []).length, 9, 'nine PORT marks: the inscription seam (3), resizeBook, and EB2\'s paper scale (the field, pixelLayer, the sheet, the board, the stack)');
  assert.match(book, /paperScale: 1,/);
  assert.match(book, /const pixelLayer = \(ctx, w, h, draw\) => \{/, 'EB2: the paper, the board and the stack at Raum\'s pixel size, blitted up');
  // the face: paint and bones - the model's law is imported, never re-read
  const src = read('src/ui/enhancedBook.js');
  assert.match(src, /import \{ placeBookLabels \} from '\.\/bookReader\.js';/);
  assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ''), /getPageTokens|RSC\.|TOKEN_TEXT/, 'no second reading of the token stream');
  assert.match(src, /placeBookLabels\(model\.lines, \(x\) => faces\[x\] \?\? faces\[0\], wrapW\)/, "LayoutBookLabels over FontPrefix's five cuts, at the leaf's width");
  assert.match(src, /if \(flipBook\(book, dir, now\(\)\)\) audio\.playOneShot\(SOUND\.PageTurn, 1\);/, 'the page turn per leaf');
  assert.match(src, /if \(!model\.done\) model\.input\('Escape'\);\s*\n\s*relock\(\);\s*\n\s*closeBook\(book, now\(\)\);/, "the exit is the classic's arm, the relock rides it, then the cover shuts");
  assert.match(src, /BOOK\.cover = \{ title: model\.book\?\.title \|\| 'A Book'/, "the cover carries the book's own title");
});

test('EB2 type: a canvas face wears FntFile\'s shape, so the classic\'s measure and wrap lay it out; the five prefixes are five cuts', () => {
  // a browser-less measurer: every glyph 6 wide, the space 4
  globalThis.document = { createElement: () => ({ getContext: () => ({ font: '', measureText: (t) => ({ width: t === ' ' ? 4 : 6 * t.length }) }) }) };
  try {
    const f = canvasFace(20, 400).fnt;   // { fnt }: makeFont's shape, the one placeBookLabels reads
    assert.equal(f.canvas, true);
    assert.equal(f.font, `400 20px ${BOOK_FAMILY}`);
    assert.equal(f.fixedHeight, 26, 'the line is 1.3 ems');
    assert.equal(f.fixedWidth, 5, 'the space plus one: spaceGlyphWidth is fixedWidth - 1');
    assert.equal(f.glyphWidth(0), 5, 'the advance less the spacing the measure adds back');
    assert.equal(measureText(f, 'ab'), 12, 'so a word measures as it draws: 6 a glyph');
    assert.equal(measureText(f, 'a b'), 17, '6 + (4 + 1) + 6');
    assert.deepEqual(wrapText(f, 'aa bb cc', 13), ['aa', 'bb', 'cc'], "and the classic's wrap cuts on the measure");
    // the classic's own layout takes the face whole
    const { placed, maxHeight } = placeBookLabels([{ text: 'aa bb cc', center: false, font: 0 }], () => canvasFace(20, 400), 13);
    assert.deepEqual(placed[0].rows, ['aa', 'bb', 'cc']);
    assert.equal(maxHeight, 78);
  } finally { delete globalThis.document; }
  assert.match(BOOK_FAMILY, /^Cormorant, /, "the skin's display face, the system serifs behind it");
  assert.deepEqual(Object.keys(FACE_OF_PREFIX), ['0', '1', '2', '3', '4', '5'], 'no prefix and FONT0000..FONT0004');
  assert.equal(FACE_OF_PREFIX[4].scale, 1, 'FONT0003 is the default face');
  assert.ok(FACE_OF_PREFIX[5].scale > FACE_OF_PREFIX[3].scale && FACE_OF_PREFIX[3].scale > 1, 'FONT0004 is the title cut, FONT0002 the big one');
  assert.equal(bodySize(756, 1), 22, 'about twenty-seven lines a leaf');
  assert.equal(bodySize(300, 3), 39, 'never under thirteen CSS pixels on a phone');
  assert.equal(bodySize(100, 1), 13);
  const src = read('src/ui/enhancedBook.js');
  assert.match(src, /injectEnhancedFonts\(\);/, 'the one web-font request the skin makes');
  assert.match(src, /BOOK\.paperScale = uiScale\(W, H, dpr\);/, 'the paper stays pixel art at the old scale');
  assert.match(src, /ctx\.fillText\(text, Math\.round\(dx\), Math\.round\(y\)\);/, 'the type is drawn by the browser, anti-aliased');
});
