// THE BOOKS SYSTEM (B1) - ItemHelper.cs's book half over the baked
// classic mapping (booksData.js, from vendor/dfu-books). A book ITEM
// carries `message` = its book id; the filename law is
// BOK%05d.TXT of the id's LOW BYTE (BookFile.messageToBookFilename),
// with the legacy 10000 -> 5 alias ("Ark'ay The God") kept for old
// saves. GetRandomBookID draws uniformly from the mapped ids; its
// six-attempt loop exists to test a book's CONDITIONS, which only a
// localized (-LOC) book carries in the port - L10N3f: a translation's
// books (systems/localizedBook.js), so a language without them draws
// once, as before. The random draw is an injectable roll (Ledger A).

import { BOOK_ID_TITLES } from './booksData.js';
import { messageToBookFilename, BookFile } from '../formats/bookFile.js';
import { templateByIndex, mintCondition } from './itemTemplates.js';
import { localizedBookExists, localizedBookHeader } from './localizedBook.js';   // L10N3f: LocalizedBook.cs, a translation's books
import { globalVarsTable } from './quest/tables.js';   // L10N3f: LocalizedBookMeetsConditions reads QuestMachine.GlobalVarsTable
import { PORT_BOOK_IDS, isPortBook, portBookTitle, portBookPrice } from './portBooks.js';   // WB12c: the port's own books

const BOOK_IDS = Object.freeze([...BOOK_ID_TITLES.keys()]);
/** WB12c: the books a bookseller's shelf and a library's draw from - the classic ones and the port's own, each at the
 *  odds of any other. Dungeon loot, houses, biographies and quests keep the classic draw. */
export const SHELF_BOOK_IDS = Object.freeze([...BOOK_IDS, ...PORT_BOOK_IDS]);

/** AUDIT 24 (wave 24): Books.Book0..Book3 ALL resolve to template 277,
 *  so the four enum names are one constant. Its home is here, beside
 *  the rest of the books system; loot.js re-exports it for the loot
 *  tables and shopStock.js re-exports that in turn, so the three
 *  readers still spell it the way they always did. */
export const BOOK_TEMPLATE = 277;

/** The same lookup without the warn - the price warm walks the whole
 *  mapping and a miss there is not news. */
const bookFileNameQuiet = (id) => {
  const key = id === 10000 ? 5 : id;   // legacy save alias
  return BOOK_ID_TITLES.has(key) || isPortBook(key) ? messageToBookFilename(key) : null;   // WB12c: a port book's name is its id's own
};

/** GetBookFileName: mapped ids only; unknown ids warn and answer null
 *  (DFU's "not assigned to any known book"). */
export function getBookFileName(id) {
  const name = bookFileNameQuiet(id);
  if (name == null) console.warn(`[books] ID ${id} is not assigned to any known book`);
  return name;
}

/** GetRandomBookID (ItemHelper.cs:618-641) over the classic mapping:
 *  up to six draws, a book with a -LOC file in the current language
 *  taken only when it meets its conditions ("Localized book conditions
 *  have overriding priority", :628-634) and every other book at once -
 *  a classic book has no replacement entry, so BookMeetsConditions
 *  holds (:636-637). Six misses answer the mapping's first id (:640). */
export function getRandomBookID(roll = Math.random) {
  for (let i = 0; i < 6; i++) {
    const id = BOOK_IDS[Math.floor(roll() * BOOK_IDS.length)];
    if (localizedBookExists(bookFileNameQuiet(id))) {
      if (localizedBookMeetsConditions(id)) return id;
      continue;
    }
    return id;
  }
  return BOOK_IDS[0];
}

/** L10N3f - PlayerEntity.GlobalVars.GetGlobalVar for the draw above:
 *  the host hands the quest machine's globals in (the 64 live on it -
 *  quest/machine.js `globalVars`, link id -> bool). With none handed
 *  in, a book waiting on a global is not drawn: the variable reads as
 *  not yet set. */
let _globalVarSet = null;
export function setBookGlobalVars(fn) { _globalVarSet = typeof fn === 'function' ? fn : null; }

/** LocalizedBookMeetsConditions (ItemHelper.cs:648-665): the current
 *  language's -LOC book is not IsUnique, and its WhenVarSet global -
 *  one the Quests-GlobalVars table names; any other is ignored - is
 *  set. A book without a -LOC file does not meet them. */
export function localizedBookMeetsConditions(id) {
  const book = localizedBookHeader(bookFileNameQuiet(id));
  if (!book) return false;
  let globalVar = -1, globalVarSet = false;
  if (book.whenVarSet) {
    let table = null;
    try { table = globalVarsTable(); } catch { /* no quest tables loaded: no variable matches, so none is waited on */ }
    if (table?.hasValue(book.whenVarSet)) {
      globalVar = Number.parseInt(table.getValue('id', book.whenVarSet), 10);
      globalVarSet = !!_globalVarSet?.(globalVar);
    }
  }
  return !book.isUnique && (globalVar === -1 || globalVarSet);
}

/** WB12c: the shelf's draw - GetRandomBookID's, over the classic books and the port's own. */
export function getShelfBookID(roll = Math.random) {
  return SHELF_BOOK_IDS[Math.floor(roll() * SHELF_BOOK_IDS.length)];
}

/** GetBookTitle (ItemHelper.cs:567-586): the current language's -LOC
 *  title first (L10N3f), else the mapping's - null for an id outside
 *  it, where DFU answers the caller's default (WB12c: the port's own
 *  books answer their own title). Every caller SHOWS it:
 *  an identified book's name (ResolveItemName :279-280), the item
 *  list's tooltip (ItemListScroller.cs:464-465), the bookshelf's pick
 *  (DaggerfallBookshelf.cs:34, :59) and the info panel's %bt; the item
 *  itself is keyed by its id, never by a title. The READER shows the
 *  book's own header title. */
export function bookTitle(id) {
  const key = id === 10000 ? 5 : id;
  const localized = localizedBookHeader(bookFileNameQuiet(key));
  if (localized) return localized.title;
  return BOOK_ID_TITLES.get(key) ?? portBookTitle(id);
}

export const CLASSIC_BOOK_COUNT = BOOK_IDS.length;

// ── A2: THE BOOK PRICE, WHICH IS THE FILE'S AND NOT THE TEMPLATE'S ──
//
// ItemBuilder.CreateBook (:237-251) and CreateRandomBook (:257-270)
// both END on the same line: `value = bookFile.Price`. Every other
// mint in the game keeps SetItem's `value = itemTemplate.basePrice`
// (DaggerfallUnityItem.cs:563), and for Books that basePrice is 2500 -
// so a port that stops at SetItem sells every book in Tamriel for
// 2500 gold when the classic price is a 300..800 roll off the file's
// own bytes. The bookseller was the most mispriced shelf in the game.
//
// THE PRICE IS A FILE READ, and this module is Node-pure, so the read
// is a REGISTRY the host warms - the same module-level-registry idiom
// loot.js uses for the MAGIC.DEF templates (setMagicItemTemplates) and
// for the SPELLS.STD records. `preloadBookPrices` (ui/bookReader.js,
// the one books boot all three hosts already call) fills it from
// BookFile.Price, which is BookFile's own DFRandom law: seed with the
// file's first four bytes, roll random_range_inclusive(300, 800).
//
// DEPARTURE, recorded: DFU on a FAILED open leaves bookFile.Price at
// 0 and prices the book at nothing. An unwarmed registry is a PORT
// condition, not a classic one, so the fallback here is the template
// basePrice with ONE loud line - a shelf of free books would be a
// worse lie than a shelf of dear ones.
const _bookPrices = new Map();
let _warnedNoPrices = false;

/** The registry's write side - the host's book boot calls it per id. */
export function setBookPrice(id, price) {
  if (Number.isFinite(price) && price > 0) _bookPrices.set(id === 10000 ? 5 : id, Math.trunc(price));
}
/** How many book files the host has priced (0 = never warmed). */
export const bookPriceCount = () => _bookPrices.size;
/** Test seam: the registry is module state, so it needs an unwind. */
export function clearBookPrices() { _bookPrices.clear(); _warnedNoPrices = false; }

/** BookFile.Price for a book id, or null when the registry has no
 *  entry for it (no ARENA2 warmed, or a file that would not open -
 *  DFU's own `!TryImportBook && !OpenBook` arm). */
export const bookFilePrice = (id) => (isPortBook(id) ? portBookPrice(id) : _bookPrices.get(id === 10000 ? 5 : id) ?? null);   // WB12c: a port book's is its own bytes'

/** The value a minted book carries: the FILE price, or the template's
 *  basePrice with one loud line when nothing warmed the registry. */
export function bookValue(id) {
  const price = bookFilePrice(id);
  if (price != null) return price;
  if (!_warnedNoPrices) {
    _warnedNoPrices = true;
    console.log('[books] no BOOKS prices registered - book values fall back to the template basePrice (loud interim: warm them with preloadBookPrices)');
  }
  return templateByIndex(BOOK_TEMPLATE)?.basePrice ?? 0;
}

/**
 * ItemBuilder.CreateRandomBook (:257-270), verbatim and in ORDER -
 * the three sites that minted it by hand now share one member:
 *
 *   1. `new DaggerfallUnityItem(Books, IndexOf(Book0))` - template 277;
 *   2. `message = GetRandomBookID()`  - the book's id, and the whole
 *      of its identity (title, reader, and the stacksWith term that
 *      keeps two different books apart);
 *   3. `CurrentVariant = Range(0, book.TotalVariants)` - the
 *      TEMPLATE's variant count (2), not the four Books enum names;
 *   4. `book.value = bookFile.Price` - the file read above.
 *
 * The draw ORDER is load-bearing: id first, variant second. Both sites
 * that had it inline already drew in that order; keep it.
 */
export function createRandomBook(rolls = Math.random, draw = getRandomBookID) {
  const message = draw(rolls);
  const variant = Math.floor(rolls() * (templateByIndex(BOOK_TEMPLATE)?.variants ?? 0));
  return mintCondition({
    group: 'Books',
    templateIndex: BOOK_TEMPLATE,
    name: templateByIndex(BOOK_TEMPLATE)?.name,
    message,
    variant,
    value: bookValue(message),
  });
}

/** WB12c: CreateRandomBook off the shelf's draw - a bookseller's, a general store's and a pawnshop's books. */
export const createShelfBook = (rolls = Math.random) => createRandomBook(rolls, getShelfBookID);

/**
 * ItemBuilder.CreateBook(int id) (:237-251) - the NAMED book, which is
 * the quest/reward path rather than the shelf one. DFU answers null
 * when the file will not open; here that is an id the registry does
 * not know, since an unmapped id has no filename either.
 */
export function createBook(id) {
  if (bookFileNameQuiet(id) == null) return null;
  return mintCondition({
    group: 'Books',
    templateIndex: BOOK_TEMPLATE,
    name: templateByIndex(BOOK_TEMPLATE)?.name,
    message: id,          // `message = id`, verbatim - the 10000 alias is the FILENAME's, not the item's
    value: bookValue(id),
  });
}

/**
 * The host's warm: read every mapped BOOK file's header and register
 * its price. DFU opens the file at each MINT (CreateRandomBook does it
 * inline); the port's mints are synchronous and its data seam is not,
 * so the reads happen once, up front, and the mint reads the registry.
 *
 * A file that will not open is skipped rather than registered at 0 -
 * see the DEPARTURE note above. Returns how many prices landed.
 */
export async function loadBookPrices(fetchBytes) {
  if (typeof fetchBytes !== 'function') return _bookPrices.size;
  await Promise.all(BOOK_IDS.map(async (id) => {
    const name = bookFileNameQuiet(id);
    if (!name) return;
    try {
      const bf = new BookFile();
      bf.load(await fetchBytes(name), name);
      setBookPrice(id, bf.price);
    } catch { /* a missing or truncated book keeps the template price */ }
  }));
  return _bookPrices.size;
}
