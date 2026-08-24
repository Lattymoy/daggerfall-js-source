// BssFile - the twelfth image reader, 1:1 from Daggerfall Unity's
// API/BssFile.cs (MIT, Daggerfall Workshop / Gavin Clayton).
//
// THE SIMPLEST FORMAT IN ARENA2, and the whole file is worth stating:
// a ten-byte header of five signed 16-bit fields, then FrameCount
// frames of Width x Height raw palette indices back to back. No
// compression, no per-frame header, no offsets table. `10 + n*w*h`
// IS the file size, which is the corpus gate below.
//
// THREE FILES USE IT and they are all the compass: CMPA00I0 (the
// standard needle), CMPA01I0 (blue) and CMPA02I0 (red), which DFU's
// own comments mark "unused". All three carry 32 frames, and it is
// the FRAME SIZE that differs - 48x40, 34x28, 30x25 - so a reader
// that hardcoded the standard's dimensions would read two of the
// three files as garbage while consuming exactly the right number of
// bytes. Both come from the header, always. (HUDLarge hardcodes the
// COUNT at 32 in a const of its own and reads only CMPA00I0; the
// count matching all three is the corpus's answer, not DFU's claim.)
//
// THE HEADER CARRIES A SCREEN POSITION THAT NOTHING READS. XPos 272,
// YPos 157 in CMPA00I0 is where classic put the needle, and DFU's
// HUDLarge ignores both, placing the compass at its own (275, 2)
// inside the 320x46 bar. Ported because it is in the file and a
// reader that silently drops two fields cannot be checked against the
// bytes; unused because DFU does not use it. `RecordCount` is 1 for a
// loaded file, exactly as in DFU - a BSS holds one record of many
// frames, not many records.

import { BaseImageFile, emptyBitmap } from './baseImageFile.js';

/** The header's five Int16 fields, in file order. */
export const BSS_HEADER_BYTES = 10;

export class BssFile extends BaseImageFile {
  constructor() {
    super();
    this._loaded = false;
    this._header = { xPos: 0, yPos: 0, width: 0, height: 0, frameCount: 0 };
    /** @type {Array<object>} decoded frames, one bitmap each. */
    this.frames = [];
  }

  /** BSS files are always ART_PAL.COL (PaletteName, :49). */
  get paletteName() {
    return 'ART_PAL.COL';
  }

  /** "BSS File" - the game data carry no text description for this
   *  type, which is DFU's own note. */
  get description() {
    return 'BSS File';
  }

  /** ONE record per file, and 0 before load (:34-42). */
  get recordCount() {
    return this._loaded ? 1 : 0;
  }

  /** The header's own screen position - read, never used. See above. */
  get screenPosition() {
    return { x: this._header.xPos, y: this._header.yPos };
  }

  /**
   * Loads a BSS file. The extension test is DFU's (:114) and it
   * refuses rather than throwing, which is what lets a caller probe.
   * @param {Uint8Array} bytes
   * @param {string} fileName
   * @param {import('./dfPalette.js').DFPalette} [palette]
   * @returns {boolean}
   */
  load(bytes, fileName, palette = null) {
    if (!String(fileName).toUpperCase().endsWith('.BSS')) return false;
    if (palette) this.palette = palette;
    this._setBytes(bytes, fileName);
    try {
      this._readHeader();
      this._readImageData();
    } catch {
      // Read() catches and returns false (:180-190) - a truncated or
      // malformed file is a load failure, never an exception.
      this._loaded = false;
      return false;
    }
    this._loaded = true;
    return true;
  }

  /** GetFrameCount (:127-144): -1 for an invalid record, never 0. */
  getFrameCount(record = 0) {
    if (record < 0 || record >= this.recordCount) return -1;
    return this._header.frameCount;
  }

  /** GetSize (:146-158): every frame of the record shares it. */
  getSize(record = 0) {
    if (record < 0 || record >= this.recordCount) return { width: 0, height: 0 };
    return { width: this._header.width, height: this._header.height };
  }

  /**
   * GetDFBitmap (:160-172). NOTE THE ASYMMETRY, which is DFU's: the
   * frame index is checked against the TOP only (`frame >=
   * GetFrameCount`) and never for being negative, so C# would throw
   * IndexOutOfRange on -1 where this returns the empty bitmap. The
   * record index is checked at both ends.
   */
  getDFBitmap(record = 0, frame = 0) {
    if (record < 0 || record >= this.recordCount) return emptyBitmap();
    if (frame >= this.getFrameCount(record)) return emptyBitmap();
    return this.frames[frame] ?? emptyBitmap();
  }

  // --- Readers ---

  _readHeader() {
    const v = this._view;
    this._header = {
      xPos: v.getInt16(0, true),
      yPos: v.getInt16(2, true),
      width: v.getInt16(4, true),
      height: v.getInt16(6, true),
      frameCount: v.getInt16(8, true),
    };
  }

  _readImageData() {
    const { width, height, frameCount } = this._header;
    const stride = width * height;
    if (stride <= 0 || frameCount <= 0) throw new Error('BssFile: empty header');
    if (BSS_HEADER_BYTES + frameCount * stride > this._bytes.byteLength) {
      throw new Error('BssFile: truncated frame data');
    }
    this.frames = [];
    let pos = BSS_HEADER_BYTES;
    for (let i = 0; i < frameCount; i++) {
      this.frames.push({
        width, height,
        data: this._bytes.subarray(pos, pos + stride),
        palette: this.palette,
      });
      pos += stride;
    }
  }
}
