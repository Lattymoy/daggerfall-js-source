// THE BOOK READER's format half (B1) - API/BookFile.cs whole. A BOK
// file (ARENA2/BOOKS/BOK%05d.TXT) is: Title/Author as 64-byte
// C-string fields, an 8-byte naughty tag ("naughty" marks adult
// content), 88 null bytes, a u32 price field, three unknown u16s, a
// u16 page count and that many u32 page offsets; each page is a
// TextFile byte-token stream ending at EndOfPage (0xF6). THE PRICE
// LAW is DFU's quirk kept whole: for a classic read the header price
// is OVERWRITTEN by seeding DFRandom with the file's FIRST FOUR BYTES
// (the start of the title!) and rolling random_range_inclusive(300,
// 800) - every copy of a book prices the same, but from its title
// bytes, not its price field.

import { RSC, readTokens } from './textRsc.js';
import { srand, randomRangeInclusive } from './dfRandom.js';

const NAUGHTY = 'naughty';

/** ItemHelper's book filename law: id -> "BOK%05d.TXT" (low byte only,
 *  BookFile.messageToBookFilename). */
export function messageToBookFilename(message) {
  const decodedValue = message & 0xff;
  return 'BOK' + String(decodedValue).padStart(5, '0') + '.TXT';
}

/** ReadCStringSkip(reader, 0, N): read N bytes, string ends at the
 *  first NUL. */
function readCString(bytes, offset, length) {
  let end = offset;
  const stop = Math.min(offset + length, bytes.length);
  while (end < stop && bytes[end] !== 0) end++;
  let s = '';
  for (let i = offset; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

export class BookFile {
  constructor() {
    this.title = '';
    this.author = '';
    this.isNaughty = false;
    this.price = 0;
    this.pageCount = 0;
    this.pageOffsets = [];
    this._bytes = null;
  }

  /** OpenBook(byte[], name): name gates the classic price law - a
   *  BOK-named book rolls the DFRandom price, exactly as C#'s
   *  randomPrice = name.StartsWith("BOK"). Throws on truncation, as
   *  the C# reader's EndOfStreamException path reports. */
  load(bytes, name = 'BOK00000.TXT') {
    this._bytes = bytes;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const need = (pos, n, what) => {
      if (pos + n > bytes.length) throw new Error(`BookFile: truncated reading ${what}`);
    };
    need(0, 64 + 64 + 8 + 88 + 4 + 6 + 2, 'the header');
    this.title = readCString(bytes, 0, 64);
    this.author = readCString(bytes, 64, 64);
    this.isNaughty = readCString(bytes, 128, 8) === NAUGHTY;
    // 88 null-value bytes at 136 (kept unread, as DFU stores-and-ignores)
    this.price = v.getUint32(224, true);
    // three unknown u16s at 228/230/232
    this.pageCount = v.getUint16(234, true);
    this.pageOffsets = [];
    let pos = 236;
    for (let i = 0; i < this.pageCount; i++) {
      need(pos, 4, `page offset ${i} of ${this.pageCount}`);
      this.pageOffsets.push(v.getUint32(pos, true));
      pos += 4;
    }
    if (/^BOK/i.test(name)) {
      // The classic price law: DFRandom seeded with the file's first
      // u32 (the title's first four bytes), 300..800 inclusive.
      srand(v.getUint32(0, true));
      this.price = randomRangeInclusive(300, 800);
    }
    return true;
  }

  /** Page tokens to EndOfPage (TextFile.ReadTokens). */
  getPageTokens(page) {
    if (page < 0 || page >= this.pageCount) throw new Error('BookFile: Invalid page index.');
    return readTokens(this._bytes, this.pageOffsets[page], RSC.EndOfPage);
  }
}
