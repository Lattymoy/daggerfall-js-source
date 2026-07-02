// 256-colour Daggerfall palette. Supports .PAL and .COL files.
// 1:1 translation of Daggerfall Unity's DFPalette.cs (MIT, Daggerfall Workshop /
// Gavin Clayton). Unity file plumbing dropped; logic, constants, and quirks kept:
//   - Palette initialised to all red (0xff,0,0) to make an unloaded palette obvious.
//   - 768-byte files are raw RGB; 776-byte files carry an 8-byte header (.COL and PAL.PAL).
//   - MAP.PAL stores 6-bit VGA values and is multiplied by 4 on load (filename-triggered,
//     exactly as in DFU).
//   - readEmbedded ports DFU's Read(ref BinaryReader): 768 palette bytes embedded in
//     another stream (TextureFile uses this later in the arc).

export class DFPalette {
  constructor() {
    this._headerLength = 0;
    // 776 bytes: room for the 8-byte .COL header plus 256x RGB.
    this._buffer = new Uint8Array(776);
    this.fill(0xff, 0, 0);
  }

  /** Raw palette memory buffer (776 bytes, header included when present). */
  get paletteBuffer() {
    return this._buffer;
  }

  /** 0 for raw .PAL data, 8 when a .COL-style header is present. */
  get headerLength() {
    return this._headerLength;
  }

  /**
   * Loads palette bytes (.PAL or .COL contents).
   * @param {Uint8Array} bytes - full file contents (768 or 776 bytes).
   * @param {string} [fileName] - original file name; 'MAP.PAL' triggers the x4
   *   6-bit VGA expansion exactly as DFU does.
   * @returns {boolean} true if successful.
   */
  load(bytes, fileName = '') {
    switch (bytes.byteLength) {
      case 768:
        this._headerLength = 0;
        break;
      case 776:
        this._headerLength = 8;
        break;
      default:
        return false;
    }

    this._buffer.fill(0);
    this._buffer.set(bytes, 0);

    // Multiply MAP.PAL
    if (fileName === 'MAP.PAL') this.multiply(4);

    return true;
  }

  /**
   * Reads a 768-byte palette embedded at an offset inside a larger buffer.
   * Ports DFU's Read(ref BinaryReader); header length becomes 8.
   * @returns {boolean} true if successful.
   */
  readEmbedded(bytes, offset) {
    if (offset + 768 > bytes.byteLength) return false;
    this._buffer.set(bytes.subarray(offset, offset + 768), 8);
    this._headerLength = 8;
    return true;
  }

  /** Fills entire palette with the specified RGB value. */
  fill(r, g, b) {
    let offset = this._headerLength;
    for (let i = 0; i < 256; i++) {
      this._buffer[offset++] = r;
      this._buffer[offset++] = g;
      this._buffer[offset++] = b;
    }
  }

  /** Fills entire palette with grayscale values. */
  makeGrayscale() {
    let offset = this._headerLength;
    for (let i = 0; i < 256; i++) {
      this._buffer[offset++] = i;
      this._buffer[offset++] = i;
      this._buffer[offset++] = i;
    }
  }

  /** Fills entire palette with random values (dev utility, non-deterministic). */
  makeRandom() {
    let offset = this._headerLength;
    for (let i = 0; i < 256; i++) {
      this._buffer[offset++] = (Math.random() * 256) % 255 | 0;
      this._buffer[offset++] = (Math.random() * 256) % 255 | 0;
      this._buffer[offset++] = (Math.random() * 256) % 255 | 0;
    }
  }

  /** Multiplies every channel in place (byte-truncating, matching the C# cast). */
  multiply(scale) {
    let offset = this._headerLength;
    for (let i = 0; i < 256; i++) {
      this._buffer[offset] = (this._buffer[offset] * scale) & 0xff;
      offset++;
      this._buffer[offset] = (this._buffer[offset] * scale) & 0xff;
      offset++;
      this._buffer[offset] = (this._buffer[offset] * scale) & 0xff;
      offset++;
    }
  }

  /**
   * Fills palette with AutoMap colours. The AutoMap colour index is equal to
   * BuildingTypes value + 1.
   */
  makeAutomap() {
    // Fill to most common colour
    this.fill(69, 60, 40);

    // Guild halls
    this.set(12, 69, 125, 195);

    // Temples
    this.set(15, 69, 125, 195);

    // Taverns
    this.set(16, 85, 117, 48);

    // Stores
    this.set(1, 190, 85, 24); // Alchemist
    this.set(3, 190, 85, 24); // Armorer
    this.set(4, 190, 85, 24); // Bank
    this.set(6, 190, 85, 24); // Bookseller
    this.set(7, 190, 85, 24); // Clothing Store
    this.set(8, 190, 85, 24); // Furniture Store
    this.set(9, 190, 85, 24); // Gem Store
    this.set(10, 190, 85, 24); // General Store
    this.set(11, 190, 85, 24); // Library
    this.set(13, 190, 85, 24); // Pawn Shop
    this.set(14, 190, 85, 24); // Weapon Smith

    // Special 1-4 (kept commented out in DFU)
    // this.set(0x75, 255, 0, 0);
    // this.set(0xe0, 255, 0, 0);
    // this.set(0xfa, 255, 0, 0);

    // Ground flats
    this.set(0xfb, 0, 0, 0);
  }

  /** Colour at index as {r,g,b} (DFU returns a DFColor). */
  get(index) {
    const offset = this._headerLength + index * 3;
    return {
      r: this._buffer[offset],
      g: this._buffer[offset + 1],
      b: this._buffer[offset + 2],
    };
  }

  getRed(index) {
    return this._buffer[this._headerLength + index * 3];
  }

  getGreen(index) {
    return this._buffer[this._headerLength + index * 3 + 1];
  }

  getBlue(index) {
    return this._buffer[this._headerLength + index * 3 + 2];
  }

  /** Sets index to specified RGB values. */
  set(index, r, g, b) {
    const offset = this._headerLength + index * 3;
    this._buffer[offset] = r;
    this._buffer[offset + 1] = g;
    this._buffer[offset + 2] = b;
  }

  /**
   * Sets 768-byte palette buffer directly (header length becomes 0).
   * @param {Uint8Array} data - exactly 768 bytes.
   */
  setBuffer(data) {
    if (data.byteLength !== 768) {
      throw new Error('DFPalette: Invalid buffer length. Must be 768 bytes for direct set.');
    }
    this._headerLength = 0;
    this._buffer.set(data, 0);
  }

  /** Finds index with specified RGB values, or -1 if not found. */
  find(r, g, b) {
    let offset = this._headerLength;
    for (let i = 0; i < 256; i++) {
      if (
        this._buffer[offset] === r &&
        this._buffer[offset + 1] === g &&
        this._buffer[offset + 2] === b
      ) {
        return i;
      }
      offset += 3;
    }
    return -1;
  }

  /** Copy of this palette (DFU copy constructor). */
  clone() {
    const p = new DFPalette();
    p._headerLength = this._headerLength;
    p._buffer.set(this._buffer);
    return p;
  }
}
