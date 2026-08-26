// PAINT.DAT reader. Verbatim port of DaggerfallConnect's PaintFile
// (API/PaintFile.cs, MIT, Daggerfall Workshop): the whole file is a
// flat array of fixed 40-byte records, and Read(recordIndex) is
// `GetBytes(recordIndex * recordLength, recordLength)` - no header, no
// count, no index table.
//
// A record is four 10-byte SLOTS of TEXT.RSC record offsets - subject,
// adjective, prefix 1, prefix 2 - each terminated by 0xFF when it holds
// fewer than ten choices. InitPaintingInfo (systems/itemInfo.js) is the
// only reader; GetPaintingRecordPart there is what walks a slot.

/** PaintFile.recordLength (:23). */
export const PAINT_RECORD_LENGTH = 40;

export class PaintFile {
  constructor(bytes = null) {
    this.data = null;
    if (bytes) this.load(bytes);
  }

  /** Load (:75-87). DFU validates the FILENAME and answers false on a
   *  mismatch; the port is handed bytes by a host that already named
   *  the file, so the load is the assignment. */
  load(bytes) {
    this.data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return true;
  }

  /** Read (:96-99). A COPY, because InitPaintingInfo writes into the
   *  record it is handed (the index-70 patch) and DFU's FileProxy hands
   *  out a fresh byte[] there too. Out of range answers null rather
   *  than reading past the buffer - C# throws, and a truncated or
   *  absent PAINT.DAT is a host problem, not a painting's. */
  read(recordIndex) {
    if (!this.data) return null;
    const at = recordIndex * PAINT_RECORD_LENGTH;
    if (at < 0 || at + PAINT_RECORD_LENGTH > this.data.length) return null;
    return this.data.slice(at, at + PAINT_RECORD_LENGTH);
  }
}
