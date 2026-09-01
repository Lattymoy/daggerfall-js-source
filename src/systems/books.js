// THE BOOKS SYSTEM (B1) - ItemHelper.cs's book half over the baked
// classic mapping (booksData.js, from vendor/dfu-books). A book ITEM
// carries `message` = its book id; the filename law is
// BOK%05d.TXT of the id's LOW BYTE (BookFile.messageToBookFilename),
// with the legacy 10000 -> 5 alias ("Ark'ay The God") kept for old
// saves. GetRandomBookID draws uniformly from the mapped ids - DFU's
// six-attempt loop only exists to test MOD conditions (localized/
// replacement books), which the port has none of, so one draw is the
// same distribution. The random draw is an injectable roll (Ledger A).

import { BOOK_ID_TITLES } from './booksData.js';
import { messageToBookFilename, BookFile } from '../formats/bookFile.js';
import { templateByIndex, mintCondition } from './itemTemplates.js';

const BOOK_IDS = Object.freeze([...BOOK_ID_TITLES.keys()]);

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
  return BOOK_ID_TITLES.has(key) ? messageToBookFilename(key) : null;
};

/** GetBookFileName: mapped ids only; unknown ids warn and answer null
 *  (DFU's "not assigned to any known book"). */
export function getBookFileName(id) {
  const name = bookFileNameQuiet(id);
  if (name == null) console.warn(`[books] ID ${id} is not assigned to any known book`);
  return name;
}

/** GetRandomBookID over the classic mapping. */
export function getRandomBookID(roll = Math.random) {
  return BOOK_IDS[Math.floor(roll() * BOOK_IDS.length)];
}

/** The mapping's title (the item-info %bt fallback; the READER shows
 *  the file's own header title). */
export const bookTitle = (id) => BOOK_ID_TITLES.get(id === 10000 ? 5 : id) ?? null;

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
export const bookFilePrice = (id) => _bookPrices.get(id === 10000 ? 5 : id) ?? null;

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
export function createRandomBook(rolls = Math.random) {
  const message = getRandomBookID(rolls);
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
