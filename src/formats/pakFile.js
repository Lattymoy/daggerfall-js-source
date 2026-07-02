// CLIMATE.PAK / POLITIC.PAK reader.
// 1:1 translation of Daggerfall Unity's PakFile.cs (MIT, Daggerfall Workshop /
// Gavin Clayton). A PAK is 500 rows of run-length data expanded to 1001 bytes
// per row: a u32 offset table (one per row) followed by runs of
// {u16 count, u8 value}.

export const PAK_WIDTH = 1001; // Number of bytes per PAK row.
export const PAK_HEIGHT = 500; // Number of PAK rows.

export class PakFile {
  constructor() {
    /** Extracted PAK buffer, PAK_WIDTH * PAK_HEIGHT bytes. */
    this.buffer = new Uint8Array(PAK_WIDTH * PAK_HEIGHT);
    this._loaded = false;
  }

  get pakRowCount() {
    return PAK_HEIGHT;
  }

  get pakRowLength() {
    return PAK_WIDTH;
  }

  get loaded() {
    return this._loaded;
  }

  /**
   * Load and expand PAK contents.
   * @param {Uint8Array} bytes - full PAK file contents.
   * @returns {boolean} true if successful.
   */
  load(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let row = 0; row < PAK_HEIGHT; row++) {
      const offset = v.getUint32(row * 4, true);
      const bufferPos = PAK_WIDTH * row;
      let pos = offset;
      let rowPos = 0;
      // Unroll PAK row into buffer.
      while (rowPos < PAK_WIDTH) {
        const count = v.getUint16(pos, true);
        const value = bytes[pos + 2];
        pos += 3;
        for (let c = 0; c < count; c++) {
          this.buffer[bufferPos + rowPos++] = value;
        }
      }
    }
    this._loaded = true;
    return true;
  }

  /** Extracted PAK data as an indexed bitmap. */
  getDFBitmap() {
    return { width: PAK_WIDTH, height: PAK_HEIGHT, data: this.buffer, palette: null };
  }

  /** Value at world-map position, or -1 if out of range. */
  getValue(x, y) {
    if (x < 0 || x >= PAK_WIDTH) return -1;
    if (y < 0 || y >= PAK_HEIGHT) return -1;
    return this.buffer[y * PAK_WIDTH + x];
  }

  /** Set value at world-map position. Returns false if out of range. */
  setValue(x, y, value) {
    if (x < 0 || x >= PAK_WIDTH) return false;
    if (y < 0 || y >= PAK_HEIGHT) return false;
    this.buffer[y * PAK_WIDTH + x] = value;
    return true;
  }
}
