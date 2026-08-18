// *.GFX reader. 1:1 translation of Daggerfall Unity's GfxFile.cs
// (MIT, Daggerfall Workshop / Gavin Clayton). The only GFX files in
// Daggerfall are SCRL00I0.GFX and SCRL01I0.GFX - combined they make
// 16 frames of scrolling parchment used exclusively by the class
// questions UI (the DFU class comment, kept because it is the whole
// story of this format).
//
// Layout (GfxFile.cs):
//   header (14 bytes): FrameCount i16 (always 8), Width i16 (320),
//     Height i16 (80), PixelDataLength i16 (25600), Unknown2 i16 (1),
//     Unknown3 4 bytes (zeros)
//   row table: Height*FrameCount entries of { RowOffset u16,
//     RowEncoding u16 } - offsets are FROM THE START OF THE FILE
//   rows: RLE rows (0x8000 flag) use the TEXTURE-file RLE - a u16
//     row width, then i16 probes: negative = run of -probe copies of
//     the next byte, positive = probe raw bytes; non-RLE rows are
//     Width raw bytes.

const IS_RLE_ENCODED = 0x8000;

export class GfxFile {
  /** Loads a GFX file. Returns true if successful. */
  load(bytes, fileName = '') {
    if (!fileName.toUpperCase().endsWith('.GFX')) return false;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.frameCount = v.getInt16(0, true);
    this.width = v.getInt16(2, true);
    this.height = v.getInt16(4, true);
    this.pixelDataLength = v.getInt16(6, true);

    // Row table follows the 14-byte header.
    const rowCount = this.height * this.frameCount;
    const rows = new Array(rowCount);
    let o = 14;
    for (let i = 0; i < rowCount; i++, o += 4) {
      rows[i] = { offset: v.getUint16(o, true), rle: (v.getUint16(o + 2, true) & IS_RLE_ENCODED) !== 0 };
    }

    // Read all frames (ReadRleImage per frame).
    this.frames = [];
    for (let frame = 0; frame < this.frameCount; frame++) {
      const data = new Uint8Array(this.pixelDataLength);
      let dst = 0;
      const rowStart = this.height * frame;
      for (let rowIndex = 0; rowIndex < this.height; rowIndex++) {
        const row = rows[rowStart + rowIndex];
        let p = row.offset;
        if (row.rle) {
          let rowPos = 0;
          const rowWidth = v.getUint16(p, true);
          p += 2;
          do {
            let probe = v.getInt16(p, true);
            p += 2;
            if (probe < 0) {
              probe = -probe;
              const pixel = bytes[p++];
              for (let i = 0; i < probe; i++) { data[dst++] = pixel; rowPos++; }
            } else if (probe > 0) {
              data.set(bytes.subarray(p, p + probe), dst);
              dst += probe; p += probe; rowPos += probe;
            }
          } while (rowPos < rowWidth);
        } else {
          data.set(bytes.subarray(p, p + this.width), dst);
          dst += this.width;
        }
      }
      this.frames.push({ width: this.width, height: this.height, data });
    }
    return true;
  }

  getFrameCount() { return this.frameCount; }
  getDFBitmap(record = 0, frame = 0) { return record === 0 ? this.frames[frame] : null; }
}
