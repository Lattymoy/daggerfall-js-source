// WB12c (2026-10-01, Mac: "shops, libraries and the first breach" for the book; then "Btw I want to do all 4"): ON THE
// BURNING DOORS - a Mages Guild conjurer's account of the breaches, the port's own book in the BOK format's own bytes:
// sold and shelved at the odds of any other book, read through the one door before any file is asked for, and handed
// to a character with their first Deadlands Ember (bible/11-Multiplayer/World-Bosses.md section 19 C).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BURNING_DOORS_ID, BOOK_TITLE_FONT, PORT_BOOK_IDS, PORT_BOOKS, portBookBytes, portBookPrice, openPortBook, isPortBook } from '../../src/systems/portBooks.js';
import { BOOK_ID_TITLES } from '../../src/systems/booksData.js';
import { BOOK_TEMPLATE, SHELF_BOOK_IDS, bookTitle, bookValue, createBook, createRandomBook, createShelfBook, getShelfBookID, getRandomBookID } from '../../src/systems/books.js';
import { populateBookshelf } from '../../src/systems/bookshelf.js';
import { stockShopShelf, stockHouseContainer } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { layoutBookLines, bookFontName } from '../../src/ui/bookReader.js';
import { makeOpenBookHook } from '../../src/ui/bookDoor.js';
import { resolveItemName } from '../../src/systems/item/itemInfo.js';
import { getSeed, srand } from '../../src/formats/dfRandom.js';
import { RSC } from '../../src/formats/textRsc.js';
import { breachBookFor, breachBookGiven, BREACH_BOOK_TEXT, BREACH_BOOK_SAVE_VENDOR } from '../../src/systems/breachBook.js';
import { modSaveRecords, restoreModSaveRecords } from '../../src/systems/modSaveData.js';
import { sigilStone, welkyndShards } from '../../src/systems/gate/gateSpoils.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const LAST = () => 0.999999;   // a draw's last id

test('WB12c the book: id 417 - above every classic id, its low byte no classic book\'s, under 0xffff - template 277, its title its name, priced by the classic law for its title (463) without moving the generator (mutants: the generator left moved; the title unknown; the price the template\'s)', () => {
  const classic = [...BOOK_ID_TITLES.keys()];
  assert.equal(BURNING_DOORS_ID, 417);
  assert.deepEqual([...PORT_BOOK_IDS], [417, 418, 419]);   // PIN MOVED (GUN-LORE, KETCH, 2026-10-24): Rourken Thunder (418) and The Ketch That Never Lands (419) after it (test/systems/gunlore.test.js holds them)
  assert.ok(classic.every((id) => id < 417 && (id & 0xff) !== (417 & 0xff)), 'its filename (the low byte\'s) no classic book\'s');
  assert.ok(417 <= 0xffff);
  srand(12345);
  const seed = getSeed();
  assert.equal(portBookPrice(417), 463);
  assert.equal(getSeed(), seed, 'pricing it never moves the classic draws');
  const book = createBook(417);
  assert.equal(book.templateIndex, BOOK_TEMPLATE);
  assert.equal(book.message, 417);
  assert.equal(book.value, 463);
  assert.equal(bookValue(417), 463);
  assert.equal(bookTitle(417), 'On the Burning Doors');
  assert.equal(resolveItemName(book), 'On the Burning Doors');
  assert.equal(isPortBook(417), true);
  assert.equal(isPortBook(5), false);
  assert.equal(portBookBytes(5), null);
});

test('WB12c its bytes are the BOK format\'s: the reader lays out the title in the title page\'s face and the conjurer centred, each section\'s head centred over its paragraph, and every page closed (mutants: a centred row left; a page left open; the title in the body\'s face)', () => {
  const f = openPortBook(417);
  assert.equal(f.title, 'On the Burning Doors');
  assert.equal(f.author, 'Ysolde Marnhel');
  assert.equal(f.pageCount, 8);
  assert.equal(f.price, 463, 'the classic law, as the reader\'s load rolls it');
  const bytes = portBookBytes(417);
  assert.ok(bytes.subarray(f.pageOffsets[0]).every((b) => b < 0x80 || [RSC.EndOfPage, RSC.JustifyLeft, RSC.JustifyCenter, RSC.FontPrefix].includes(b)), 'the pages: plain ASCII and the book\'s own tokens');
  for (let p = 0; p < f.pageCount; p++) {
    const end = f.pageOffsets[p + 1] ?? bytes.length;
    assert.equal(bytes[end - 1], RSC.EndOfPage, `page ${p} closed`);
    assert.equal(bytes[end - 2], RSC.NewLine, `page ${p} ends its last row`);
  }
  const rows = layoutBookLines(f);
  assert.deepEqual(rows.slice(0, 5).map((r) => [r.text, r.center, r.font]), [
    ['On the Burning Doors', true, BOOK_TITLE_FONT], ['', false, 0], ['by Ysolde Marnhel', true, 0], ['Master Conjurer of the Mages Guild, Wayrest', true, 0], ['', false, 0],
  ]);
  assert.equal(bookFontName(BOOK_TITLE_FONT), 'FONT0004', 'the title page\'s large face');
  assert.ok(rows.slice(1).every((r) => r.font === 0), 'the rest in the reader\'s own face');
  const heads = rows.filter((r) => r.center).map((r) => r.text).slice(3);
  assert.deepEqual(heads, ['The Covenant', 'The faithful', 'The Warden', 'Why the doors close', 'The Battlespire', 'The embers', 'Counsel']);
  const body = rows.filter((r) => r.text.length > 80);
  assert.equal(body.length, 8);
  assert.ok(body.every((r) => !r.center), 'the paragraphs left');
});

test('WB12c its text is the bible\'s appendix, word for word (the bible is the truth: a change to one is a change to both)', () => {
  const bible = read('bible/11-Multiplayer/World-Bosses.md');
  const app = bible.slice(bible.indexOf('### Appendix - On the Burning Doors'), bible.indexOf('## 20. '));
  assert.match(app, /^\*By Ysolde Marnhel, Master Conjurer of the Mages Guild, Wayrest\.\*$/m);
  const paras = [];
  let cur = [];
  for (const l of app.split('\n').filter((x) => x.startsWith('>'))) {
    const t = l.replace(/^> ?/, '').trim();
    if (t) cur.push(t);
    else if (cur.length) { paras.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) paras.push(cur.join(' '));
  const book = PORT_BOOKS.get(417).pages.flat().map((r) => (typeof r === 'string' ? r : r.text)).filter((t) => t.length > 80);
  const said = paras.map((p) => p.replace(/^\*\*.+?\.\*\* /, ''));
  assert.deepEqual(book, said);
  const heads = paras.map((p) => /^\*\*(.+?)\.\*\*/.exec(p)?.[1]).filter(Boolean);
  const cards = PORT_BOOKS.get(417).pages.slice(1).map((pg) => pg[0].text);
  assert.deepEqual(cards, heads);
});

test('WB12c on the shelves: a bookseller\'s, a general store\'s and a pawnshop\'s shelves and a library\'s draw it at the odds of any other book; a house, the dungeon\'s loot and a quest keep the classic draw (mutants: the shop\'s draw classic; the house\'s the shelf\'s; the library\'s classic; the port books off the shelf)', () => {
  // PIN MOVED (GUN-LORE, KETCH, 2026-10-24): three port books on the shelf - each its one id's share; the draw's last is the
  // last of them (419), and every one of them is a port book's
  assert.equal(SHELF_BOOK_IDS.length, BOOK_ID_TITLES.size + 3);
  for (const id of [417, 418, 419]) assert.equal(SHELF_BOOK_IDS.filter((x) => x === id).length, 1, `${id}: one id's share`);
  assert.equal(getShelfBookID(LAST), 419, 'its share of the draw is one id\'s');
  assert.ok(!isPortBook(getRandomBookID(LAST)));
  assert.equal(createShelfBook(LAST).message, 419);
  assert.ok(!isPortBook(createRandomBook(LAST).message), 'loot, houses, biographies and quests: the classic draw');
  assert.ok(populateBookshelf(LAST).every((id) => id === 419), 'a library\'s shelf');
  const count = (fn) => { let books = 0, port = 0; for (let s = 1; s <= 200; s++) for (const it of fn(seededRng(s))) if (it.group === 'Books') { books++; if (isPortBook(it.message)) port++; } return [books, port]; };
  for (const t of ['Bookseller', 'GeneralStore', 'PawnShop']) {
    const [books, port] = count((r) => stockShopShelf({ buildingType: BUILDING_TYPES[t], quality: 10 }, { level: 5 }, { rolls: r, torchesFromItems: false }));
    assert.ok(port > 0 && port < (3 * books) / 40, `${t}: ${port} of ${books}`);   // PIN MOVED (GUN-LORE, KETCH): three ids' share
  }
  // a house's container (models 4-10 and 11-14 keep books): some 1,300 books, where the shelf's odds would put it ~14 times
  let books = 0, port = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const r = seededRng(seed);
    for (const it of stockHouseContainer({ buildingType: BUILDING_TYPES.House1, record: 4 }, { level: 5 }, { rolls: r, contRand: () => Math.floor(r() * 32768) })) if (it.group === 'Books') { books++; if (isPortBook(it.message)) port++; }
  }
  assert.ok(books > 1000, `${books} books in the houses`);
  assert.equal(port, 0, 'never in a house');
});

test('WB12c the one door reads it from the registry - no file asked for - and hands the reader over a microtask later, as a fetched file lands, so the pack has closed (mutants: the registry unread; handed over inside the pack\'s hand-off)', async () => {
  const asked = [];
  const shown = [];
  const hook = makeOpenBookHook({ fetchBytes: async (n) => { asked.push(n); throw new Error('no such file'); }, showReader: (w) => shown.push(w) });
  let failed = false;
  const opened = hook({ message: 417 }, () => { failed = true; });
  assert.equal(shown.length, 0, 'not inside the hand-off');
  await opened;
  assert.deepEqual(asked, []);
  assert.equal(failed, false);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].book?.title ?? shown[0].model?.book?.title, 'On the Burning Doors');
});

test('WB12c the first ember brings it, once a character - a courier\'s line, and the record rides the save (mutants: given at every ember; given for any piece; the record not kept)', () => {
  restoreModSaveRecords({});
  assert.equal(breachBookGiven(), false, 'a new character');
  assert.equal(breachBookFor(welkyndShards(1)), null, 'a shard is not an ember');
  assert.equal(breachBookFor(null), null);
  const book = breachBookFor(sigilStone());
  assert.equal(book?.message, 417);
  assert.equal(book?.value, 463);
  assert.equal(breachBookGiven(), true);
  assert.equal(breachBookFor(sigilStone()), null, 'once');
  assert.deepEqual(modSaveRecords()[BREACH_BOOK_SAVE_VENDOR], { given: true });
  restoreModSaveRecords({ [BREACH_BOOK_SAVE_VENDOR]: { given: false } });
  assert.equal(breachBookGiven(), false, 'a save from before it');
  restoreModSaveRecords({ [BREACH_BOOK_SAVE_VENDOR]: { given: true } });
  assert.equal(breachBookFor(sigilStone()), null, 'a save after it');
  assert.equal(BREACH_BOOK_TEXT, "A Mages Guild courier finds you: 'On the Burning Doors', with the Guild's compliments.");
  restoreModSaveRecords({});
});

test('WB12c the breach\'s spoils go into the pack through the book\'s door - the court\'s floor, a receipt outside it and the crash\'s - and a town\'s thanks do not (mutants: the court\'s spoils past it)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const takeGateSpoil = \(p\) => \{\n\s+takeSpoil\(p\);\n\s+const book = p\.kind === 'item' \? breachBookFor\(p\.item\) : null;\n\s+if \(book\) \{ addItem\(playerEntity\.items, book\); chatNotice\(BREACH_BOOK_TEXT\); \}/);
  assert.match(w, /const spoilsPool = createSpoilsPool\(\{[\s\S]{0,600}?take: takeGateSpoil,/);
  assert.match(w, /recoverSpoils\(_spoilsStore, takeGateSpoil, \{ who, saves: enumerateSaves\(\)\.info\.values\(\), onHanded: \(rec\) => spoilsPool\.adopt\(rec\)/);
  assert.match(w, /const raidSpoils = createSpoilsPool\(\{\n\s+ray: \(\) => null, now: \(\) => Date\.now\(\) \+ _sharedOffsetMs, take: takeSpoil,/);
});
