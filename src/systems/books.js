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
import { messageToBookFilename } from '../formats/bookFile.js';

const BOOK_IDS = Object.freeze([...BOOK_ID_TITLES.keys()]);

/** GetBookFileName: mapped ids only; unknown ids warn and answer null
 *  (DFU's "not assigned to any known book"). */
export function getBookFileName(id) {
  if (id === 10000) id = 5;   // legacy save alias
  if (BOOK_ID_TITLES.has(id)) return messageToBookFilename(id);
  console.warn(`[books] ID ${id} is not assigned to any known book`);
  return null;
}

/** GetRandomBookID over the classic mapping. */
export function getRandomBookID(roll = Math.random) {
  return BOOK_IDS[Math.floor(roll() * BOOK_IDS.length)];
}

/** The mapping's title (the item-info %bt fallback; the READER shows
 *  the file's own header title). */
export const bookTitle = (id) => BOOK_ID_TITLES.get(id === 10000 ? 5 : id) ?? null;

export const CLASSIC_BOOK_COUNT = BOOK_IDS.length;
