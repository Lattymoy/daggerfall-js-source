// TEXT.RSC reader (UI arc, TEXT.RSC slice). Verbatim port of DFU
// TextFile.cs (MIT, Daggerfall Workshop):
//   header: TextRecordHeaderLength u16
//   RecordCount = headerLength / 6 - 1
//   record headers: { TextRecordId u16, Offset u32 } x count
//   a record: raw bytes from its offset up to AND including the
//   0xFE EndOfRecord terminator
// Formatting bytes (the source enum, defined members): text chars
// 0x20..0x7F; NewLine 0x00; SubrecordSeparator 0xFF; EndOfRecord
// 0xFE; EndOfPage 0xF6; InputCursorPositioner 0xF8; FontPrefix 0xF9
// (ONE operand byte); PositionPrefix 0xFB (ONE operand byte);
// JustifyLeft 0xFC; JustifyCenter 0xFD.
// plainText() flattens a record faithfully for message consumers:
// chars pass, NewLine -> '\n', SubrecordSeparator splits VARIANTS,
// the two prefixes consume their operand (so operands never leak
// into text), every other control byte drops. Full token semantics
// (positioning, fonts, pages) pend the book/scroll renderers.

export const RSC = Object.freeze({
  NewLine: 0x00, EndOfPage: 0xf6, InputCursorPositioner: 0xf8,
  FontPrefix: 0xf9, PositionPrefix: 0xfb, JustifyLeft: 0xfc,
  JustifyCenter: 0xfd, EndOfRecord: 0xfe, SubrecordSeparator: 0xff,
  FirstCharacter: 0x20, LastCharacter: 0x7f,
});

export class TextRsc {
  load(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerLength = v.getUint16(0, true);
    const count = Math.floor(headerLength / 6) - 1;
    this._bytes = bytes;
    this._byId = new Map();
    let o = 2;
    for (let i = 0; i < count; i++) {
      const id = v.getUint16(o, true);
      const offset = v.getUint32(o + 2, true);
      o += 6;
      this._byId.set(id, offset);
    }
    return this;
  }

  get recordCount() { return this._byId.size; }
  hasRecord(id) { return this._byId.has(id); }

  /** Raw record bytes INCLUDING the 0xFE terminator (GetBytesById). */
  bytesById(id) {
    const offset = this._byId.get(id);
    if (offset === undefined) return null;
    let end = offset;
    while (end < this._bytes.length && this._bytes[end] !== RSC.EndOfRecord) end++;
    return this._bytes.subarray(offset, Math.min(end + 1, this._bytes.length));
  }

  /** Variants (SubrecordSeparator-split) of a record as plain text. */
  plainText(id) {
    const raw = this.bytesById(id);
    if (!raw) return null;
    const variants = [];
    let cur = '';
    for (let i = 0; i < raw.length; i++) {
      const b = raw[i];
      if (b === RSC.EndOfRecord) break;
      if (b === RSC.SubrecordSeparator) { variants.push(cur); cur = ''; continue; }
      // U11: JustifyLeft (0xFC) and JustifyCenter (0xFD) each BREAK
      // THE LINE - MultiFormatTextLabel.cs:333-345 calls NewLine() for
      // all three, JustifyCenter additionally centring the row it just
      // closed. The port dropped both as "every other control byte",
      // so every record that lays its text out with them (the race
      // descriptions, most centred popups) came back as ONE run-on
      // line with words fused across the break: "Hammerfell.You are".
      if (b === RSC.NewLine || b === RSC.JustifyLeft || b === RSC.JustifyCenter) { cur += '\n'; continue; }
      if (b === RSC.FontPrefix || b === RSC.PositionPrefix) { i++; continue; }   // one operand each, never leaks
      if (b >= RSC.FirstCharacter && b <= RSC.LastCharacter) { cur += String.fromCharCode(b); continue; }
      // every remaining control byte (page, cursor) drops here
    }
    variants.push(cur);
    return variants;
  }

  /** ROWS of ONE VARIANT, chosen by `pick` (GetRandomTokens's
   *  Random.Range over the record's subrecords). AUDIT 22 F2: the
   *  windows all read linesById, which is variant 0 forever - and
   *  DFU fetches nearly every message they show with GetRandomTokens.
   *  Thirteen of the records the guild and inventory windows draw
   *  have more than one; TEXT.RSC 3100 has EIGHT, so the port showed
   *  one of eight rank refusals for good.
   *
   *  This is linesById's job with a variant offset - plainText splits
   *  variants but loses the per-row ALIGNMENT that AUDIT 17g F2
   *  established matters, so neither existing reader could do it. */
  variantLinesById(id, pick = Math.random) {
    const n = this.variantCount(id);
    if (n <= 1) return this.linesById(id);
    const want = Math.min(n - 1, Math.floor(pick() * n));
    const rows = this.linesById(id, want);
    // AUDIT 23 (FTD-1) - TextProvider.cs:231: a record ending 0xFF 0xFE
    // mints an empty trailing stream; DFU steps back one variant when
    // the picked stream has zero tokens, so the roll never shows
    // nothing. The distribution keeps DFU's shape (the last real
    // variant is picked twice as often on such records).
    if (!rows.length && want > 0) return this.linesById(id, want - 1);
    return rows;
  }

  /** How many SubrecordSeparator-delimited variants a record has. */
  variantCount(id) {
    const raw = this.bytesById(id);
    if (!raw) return 0;
    let n = 1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === RSC.EndOfRecord) break;
      if (raw[i] === RSC.SubrecordSeparator) n++;
      if (raw[i] === RSC.FontPrefix || raw[i] === RSC.PositionPrefix) i++;
    }
    return n;
  }

  /** The first variant as ROWS, with the per-row alignment the record
   *  asks for: a row closed by JustifyCenter is centred, one closed by
   *  JustifyLeft or a bare NewLine is left (MultiFormatTextLabel.cs
   *  :333-345). Trailing empties drop - a record almost always ends
   *  with a break. */
  linesById(id, variant = 0) {
    const raw = this.bytesById(id);
    if (!raw) return [];
    const rows = [];
    let cur = '';
    let v = 0;
    for (let i = 0; i < raw.length; i++) {
      const b = raw[i];
      if (b === RSC.EndOfRecord) break;
      if (b === RSC.SubrecordSeparator) {
        if (v === variant) break;
        v++; cur = ''; rows.length = 0;   // start the next variant clean
        continue;
      }
      if (v !== variant) {
        // still skipping to the wanted variant - consume operands so a
        // 0xFF inside one cannot be read as a separator
        if (b === RSC.FontPrefix || b === RSC.PositionPrefix) i++;
        continue;
      }
      if (b === RSC.NewLine || b === RSC.JustifyLeft || b === RSC.JustifyCenter) {
        rows.push({ text: cur, center: b === RSC.JustifyCenter });
        cur = '';
        continue;
      }
      if (b === RSC.FontPrefix || b === RSC.PositionPrefix) { i++; continue; }
      if (b >= RSC.FirstCharacter && b <= RSC.LastCharacter) cur += String.fromCharCode(b);
    }
    if (cur) rows.push({ text: cur, center: false });
    while (rows.length && rows[rows.length - 1].text === '') rows.pop();
    return rows;
  }
}
