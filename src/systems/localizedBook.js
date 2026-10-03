// L10N3f (2026-09-28): A BOOK IN A TRANSLATION'S OWN WORDS - LocalizedBook.cs (MIT, Daggerfall Workshop). A translation
// keeps its books beside the classic ones: `Text/Books/BOK00042-LOC.txt`, a header of keywords and then the book's
// text in the string importer's markup ([/center], [/font=N] ...). DFU reads the -LOC file first wherever it reads a
// book, and the classic BOK file only where there is none:
//   - the reader: DaggerfallBookReaderWindow.OpenBook (:155-176) opens LocalizedBook.OpenBookFile (:61-72) - the -LOC
//     file, else OpenClassicBookFile (:115-146) - and lays its Content out (CreateBookLabels :208-261);
//   - the title: ItemHelper.GetBookTitle (:567-586), which a book's item name (ResolveItemName :279-280), the item
//     list's tooltip (ItemListScroller.cs:464-465) and the bookshelf (DaggerfallBookshelf.cs:34, :59) all show;
//   - the author: %ba, DaggerfallUnityItemMCP.BookAuthor (:162-183);
//   - the random draw: ItemHelper.GetRandomBookID (:618-641) through LocalizedBookMeetsConditions (:648-665).
// The item keeps its canonical identity - `message`, the book id - and never a title: every one of those reads the
// title where it shows it.
//
// The port's -LOC file is the one the player's pack holds (the text core's documents, PACK_KIND.BOOK, read along the
// locale's chain). English reads no document, so every English book is its classic BOK file, byte for byte, as
// before. (DFU's own English build ships 93 -LOC books of its own in StreamingAssets/Text/Books, which the port does
// not carry - recorded, not changed here.)

import { localeDocument } from './textManager.js';
import { PACK_KIND } from './translationPacks.js';

/** The kind a pack's -LOC book is kept under. */
export const BOOK_DOCUMENT = PACK_KIND.BOOK;
const LOC_SUFFIX = '-LOC';   // localizedFilenameSuffix (:27)

/** The document name for a classic or -LOC book file: GetFileNameWithoutExtension, with the -LOC the classifier keeps
 *  off (systems/translationPacks.js: `Text/Books/<BOOK>-LOC.txt` is kept as <BOOK>, upper-cased). */
export function localizedBookName(filename) {
  if (!filename) return null;
  const base = String(filename).replace(/\\/g, '/').split('/').pop().replace(/\.[^.]*$/, '');
  return (base.endsWith(LOC_SUFFIX) ? base.slice(0, -LOC_SUFFIX.length) : base).toUpperCase();
}

/** File.ReadAllLines over a document's text: split at \r\n, \r or \n, a line terminator at the very end ending the
 *  last line rather than opening an empty one - so "" reads no lines at all. */
export function readAllLines(text) {
  const lines = String(text ?? '').split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const startsWithCI = (line, keyword) => line.slice(0, keyword.length).toLowerCase() === keyword.toLowerCase();
/** bool.TryParse: True or False in any case, whitespace allowed; null when it is neither. */
const tryParseBool = (s) => (/^\s*true\s*$/i.test(s) ? true : /^\s*false\s*$/i.test(s) ? false : null);
/** int.TryParse (NumberStyles.Integer): an optional sign and digits, whitespace allowed, inside Int32; else null. */
function tryParseInt(s) {
  if (!/^\s*[+-]?\d+\s*$/.test(s)) return null;
  const n = Number(s.trim());
  return n >= -2147483648 && n <= 2147483647 ? n : null;
}

/**
 * OpenLocalizedBookFile's read loop (LocalizedBook.cs:190-248), verbatim: every line up to and including `Content:`
 * is header, trimmed and read by its keyword (any case) - Title:, Author:, IsNaughty:, Price:, IsUnique:, WhenVarSet:;
 * everything after `Content:` is the book, each line kept whole with the newline ReadAllLines took off added back.
 * A bool or an int that will not parse is said and reads false or 0, as TryParse leaves it. The fields a file does not
 * set keep C#'s defaults: Title, Author and WhenVarSet null, Content empty.
 */
export function parseLocalizedBook(lines) {
  const book = { title: null, author: null, isNaughty: false, price: 0, isUnique: false, whenVarSet: null, content: '' };
  let readingContent = false;
  for (const raw of lines ?? []) {
    if (readingContent) { book.content += `${raw}\n`; continue; }
    const line = raw.trim();
    let v;
    if (startsWithCI(line, 'Title:')) book.title = line.slice(6).trim();
    else if (startsWithCI(line, 'Author:')) book.author = line.slice(7).trim();
    else if (startsWithCI(line, 'IsNaughty:')) {
      v = line.slice(10).trim();
      book.isNaughty = tryParseBool(v) ?? false;
      if (tryParseBool(v) === null) console.error(`Could not parse IsNaughty bool from '${v}'. Value must be True or False.`);
    } else if (startsWithCI(line, 'Price:')) {
      v = line.slice(6).trim();
      book.price = tryParseInt(v) ?? 0;
      if (tryParseInt(v) === null) console.error(`Could not parse Price int from '${v}'. Value must be numerical.`);
    } else if (startsWithCI(line, 'IsUnique:')) {
      v = line.slice(9).trim();
      book.isUnique = tryParseBool(v) ?? false;
      if (tryParseBool(v) === null) console.error(`Could not parse IsUnique bool from '${v}'. Value must be True or False.`);
    } else if (startsWithCI(line, 'WhenVarSet:')) book.whenVarSet = line.slice(11).trim();
    else if (startsWithCI(line, 'Content:')) readingContent = true;
  }
  return book;
}

/** The current language's -LOC document for a book file, or null (Exists, :89-105). */
const localizedBookDocument = (filename) => {
  const name = localizedBookName(filename);
  return name ? localeDocument(BOOK_DOCUMENT, name) : null;
};

/** LocalizedBook.Exists (:89-105): the current language holds a -LOC file for the book. */
export const localizedBookExists = (filename) => localizedBookDocument(filename) != null;

/**
 * OpenLocalizedBookFile (:155-251): the current language's -LOC book for `filename` ("BOK00042.TXT" or
 * "BOK00042-LOC.txt") - { title, author, isNaughty, price, isUnique, whenVarSet, content } - or null where the
 * language has none, or its file has no lines at all (ReadAllLines' empty answer, :186-187).
 */
export function openLocalizedBookFile(filename) {
  const text = localizedBookDocument(filename);
  if (text == null) return null;
  const lines = readAllLines(text);
  return lines.length ? parseLocalizedBook(lines) : null;
}

// GetBookTitle keeps every localized title it reads ("Localized title will be cached so file is only read once",
// :573-580). Here the header is kept by the document it came from, so a language switched or a pack installed reads
// its own; the book's text is not kept - only the reader asks for it, once an opening.
const _headers = new Map();   // document text -> the parsed book, its content dropped
/** The -LOC book's header for `filename` - its title, author, price and conditions - or null. */
export function localizedBookHeader(filename) {
  const text = localizedBookDocument(filename);
  if (text == null) return null;
  let header = _headers.get(text);
  if (header === undefined) {
    const lines = readAllLines(text);
    header = lines.length ? { ...parseLocalizedBook(lines), content: undefined } : null;
    if (_headers.size >= 256) _headers.clear();
    _headers.set(text, header);
  }
  return header;
}
