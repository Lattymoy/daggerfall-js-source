// TEXTURE.??? reader. Each texture file contains one or more image records,
// including animated records with multiple frames. Frames are decoded lazily
// and cached, exactly as in the reference.
// 1:1 translation of Daggerfall Unity's TextureFile.cs (MIT, Daggerfall
// Workshop / Gavin Clayton).
//
// Departure (documented): DFU auto-loads ART_PAL.COL from the same directory.
// Browser runtime has no directory access, so the caller assigns `palette`
// (or passes it to load); `paletteName` still reports the correct file.

import { BaseImageFile, COMPRESSION_FORMATS, emptyBitmap } from './baseImageFile.js';

const SOLID_SIZE = 32; // Width and height of solid images.

export const SOLID_TYPES = Object.freeze({
  None: 0,
  SolidColoursA: 1, // TEXTURE.000
  SolidColoursB: 2, // TEXTURE.001
});

// Row encoding used for the SpecialFrameHeader of RecordRle archives.
const ROW_ENCODING_RLE = 0x8000;

// These three texture filenames have no image data or are otherwise invalid.
export const UNSUPPORTED_FILENAMES = Object.freeze([
  'TEXTURE.215',
  'TEXTURE.217',
  'TEXTURE.436',
]);

/** TEXTURE.### - the archive's filename from its number.
 *
 *  It lives HERE, with the reader, because both callers need it and
 *  neither can import the other: scenes/shared.js pulls in the sky
 *  renderer and half the scene layer, which a DOM screen must not
 *  drag in, and ui/textureCanvas.js is imported BY a DOM screen. U54
 *  restated it in the second one and the audit24_onehome ratchet
 *  caught it in the same slice - two modules exporting one name is
 *  the drift that gate exists for. */
export const texName = (archive) => `TEXTURE.${String(archive).padStart(3, '0')}`;

export class TextureFile extends BaseImageFile {
  constructor() {
    super();
    this._solidType = SOLID_TYPES.None;
    this._recordCount = 0;
    this._description = '';
    this._recordHeaders = [];
    this._records = [];
  }

  /** TEXTURE.nnn filename from archive index (3D objects reference by index). */
  static indexToFileName(archiveIndex) {
    return `TEXTURE.${String(archiveIndex).padStart(3, '0')}`;
  }

  /** True if archive is a known spectral texture. */
  static isSpectralArchive(archive) {
    // 273 = Ghost
    // 278 = Wraith
    // 473 = Lysandus
    return archive === 273 || archive === 278 || archive === 473;
  }

  /** Tests if a filename is supported. */
  isFilenameSupported(filename) {
    return !UNSUPPORTED_FILENAMES.includes(filename);
  }

  /** Description string from the file header. */
  get description() {
    return this._description;
  }

  /** Correct palette name for this file (always ART_PAL.COL for texture files). */
  get paletteName() {
    return 'ART_PAL.COL';
  }

  get recordCount() {
    return this._recordCount;
  }

  /** Texture solid type for flat-colour archives (see SOLID_TYPES). */
  get solidType() {
    return this._solidType;
  }

  /**
   * Loads a texture file.
   * @param {Uint8Array} bytes - full file contents.
   * @param {string} fileName - e.g. 'TEXTURE.017'; drives solid-type and
   *   unsupported-file handling exactly as DFU's path checks do.
   * @param {import('./dfPalette.js').DFPalette} [palette] - optional palette
   *   for colour conversion (ART_PAL.COL).
   * @returns {boolean} true if successful.
   */
  load(bytes, fileName, palette = null) {
    if (!fileName.toUpperCase().startsWith('TEXTURE.')) return false;

    // Handle unsupported files
    if (!this.isFilenameSupported(fileName)) return false;

    // Handle solid types
    if (fileName === 'TEXTURE.000') this._solidType = SOLID_TYPES.SolidColoursA;
    else if (fileName === 'TEXTURE.001') this._solidType = SOLID_TYPES.SolidColoursB;
    else this._solidType = SOLID_TYPES.None;

    if (palette) this.palette = palette;
    this._setBytes(bytes, fileName);

    try {
      this._readHeader();
      this._readRecordHeaders();
      this._readRecords();
    } catch (e) {
      return false;
    }

    return true;
  }

  /** Number of frames in specified record, or -1 if invalid. */
  getFrameCount(record) {
    if (record < 0 || record >= this._recordCount) return -1;
    if (this._solidType !== SOLID_TYPES.None) return 1;
    return this._records[record].frameCount;
  }

  /** {width,height} of specified record. All frames share dimensions. */
  getSize(record) {
    if (record < 0 || record >= this._recordCount) return { width: 0, height: 0 };
    if (this._solidType !== SOLID_TYPES.None) return { width: SOLID_SIZE, height: SOLID_SIZE };
    const r = this._records[record];
    return { width: r.width, height: r.height };
  }

  /**
   * Width and height scale applied to the image in scene. Divided by 256 to
   * obtain the pixel scale for enlarging or shrinking the image.
   */
  getScale(record) {
    if (record < 0 || record >= this._recordCount) return { width: 0, height: 0 };
    const r = this._records[record];
    return { width: r.scaleX, height: r.scaleY };
  }

  /** Offset value of record as {x,y}. */
  getOffset(record) {
    if (record < 0 || record >= this._recordCount) return { x: 0, y: 0 };
    const r = this._records[record];
    return { x: r.offsetX, y: r.offsetY };
  }

  getWidth(record) {
    return this.getSize(record).width;
  }

  getHeight(record) {
    return this.getSize(record).height;
  }

  /**
   * Indexed 8-bit bitmap for specified record and frame:
   * {width, height, data: Uint8Array, palette}. Decoded lazily, cached.
   */
  getDFBitmap(record, frame) {
    if (record < 0 || record >= this._recordCount || frame >= this.getFrameCount(record)) {
      return emptyBitmap();
    }
    if (!this._readImageData(record, frame)) return emptyBitmap();
    return this._records[record].frames[frame];
  }

  // --- Readers ---

  _readHeader() {
    const v = this._view;
    this._recordCount = v.getInt16(0, true);
    this._description = this._readCString(2).trim();
  }

  _readRecordHeaders() {
    // Record headers always start at position 26, 20 bytes each.
    const v = this._view;
    this._recordHeaders = [];
    let pos = 26;
    for (let r = 0; r < this._recordCount; r++) {
      this._recordHeaders.push({
        position: pos,
        type1: v.getInt16(pos, true),
        recordPosition: v.getInt32(pos + 2, true),
        type2: v.getInt16(pos + 6, true),
        unknown1: v.getInt32(pos + 8, true),
        // nullValue1: 8 bytes at pos+12, unused.
      });
      pos += 20;
    }
  }

  _readRecords() {
    const v = this._view;
    this._records = [];
    for (let r = 0; r < this._recordCount; r++) {
      const pos = this._recordHeaders[r].recordPosition;
      const rec = {
        position: pos,
        offsetX: v.getInt16(pos, true),
        offsetY: v.getInt16(pos + 2, true),
        width: v.getInt16(pos + 4, true),
        height: v.getInt16(pos + 6, true),
        compression: v.getInt16(pos + 8, true),
        recordSize: v.getUint32(pos + 10, true),
        dataOffset: v.getUint32(pos + 14, true),
        isNormal: v.getInt16(pos + 18, true) !== 0,
        frameCount: v.getUint16(pos + 20, true),
        unknown1: v.getInt16(pos + 22, true),
        scaleX: v.getInt16(pos + 24, true),
        scaleY: v.getInt16(pos + 26, true),
        frames: null,
      };
      if (this._solidType === SOLID_TYPES.None) {
        rec.frames = new Array(rec.frameCount).fill(null);
      } else {
        rec.width = SOLID_SIZE;
        rec.height = SOLID_SIZE;
        rec.frames = [null];
      }
      this._records.push(rec);
    }
  }

  _readImageData(record, frame) {
    const rec = this._records[record];
    if (rec.frames[frame] !== null) return true; // already decoded

    if (this._solidType !== SOLID_TYPES.None) return this._readSolid(record);

    switch (rec.compression) {
      case COMPRESSION_FORMATS.RecordRle:
      case COMPRESSION_FORMATS.ImageRle:
        return this._readRle(record, frame);
      case COMPRESSION_FORMATS.Uncompressed:
      default:
        return this._readImage(record, frame);
    }
  }

  /** Creates a solid 32x32 image. TEXTURE.000 uses index=record, TEXTURE.001 index=128+record. */
  _readSolid(record) {
    const colourIndex =
      this._solidType === SOLID_TYPES.SolidColoursA ? record & 0xff : (128 + record) & 0xff;
    const data = new Uint8Array(SOLID_SIZE * SOLID_SIZE).fill(colourIndex);
    this._records[record].frames[0] = {
      width: SOLID_SIZE,
      height: SOLID_SIZE,
      data,
      palette: this.palette,
    };
    return true;
  }

  /** Reads an uncompressed record (single-frame stride-256 rows, or the multi-frame transparent-run codec). */
  _readImage(record, frame) {
    const rec = this._records[record];
    const data = new Uint8Array(rec.width * rec.height);
    const fileBytes = this._bytes;
    const v = this._view;
    const position = rec.position + rec.dataOffset;

    if (rec.frameCount === 1) {
      // Rows are stored on a fixed 256-byte stride.
      let srcPos = position;
      let dstPos = 0;
      for (let y = 0; y < rec.height; y++) {
        data.set(fileBytes.subarray(srcPos, srcPos + rec.width), dstPos);
        srcPos += rec.width + (256 - rec.width);
        dstPos += rec.width;
      }
    } else if (rec.frameCount > 1) {
      // Frame offset list, then per-frame cx,cy and transparent-run codec.
      const frameOffset = v.getInt32(position + frame * 4, true);
      let srcPos = position + frameOffset;
      const cx = v.getInt16(srcPos, true);
      const cy = v.getInt16(srcPos + 2, true);
      srcPos += 4;

      let dstPos = 0;
      for (let y = 0; y < cy; y++) {
        let x = 0;
        while (x < cx) {
          // Write transparent bytes
          let pixel = fileBytes[srcPos++];
          let run = x + pixel;
          for (; x < run; x++) {
            data[dstPos++] = 0;
          }

          // Write image bytes
          pixel = fileBytes[srcPos++];
          run = x + pixel;
          for (; x < run; x++) {
            pixel = fileBytes[srcPos++];
            data[dstPos++] = pixel;
          }
        }
      }
    } else {
      // No frames
      return false;
    }

    rec.frames[frame] = { width: rec.width, height: rec.height, data, palette: this.palette };
    return true;
  }

  /** Reads a RecordRle/ImageRle record via per-row special headers. */
  _readRle(record, frame) {
    const rec = this._records[record];
    const data = new Uint8Array(rec.width * rec.height);
    const fileBytes = this._bytes;
    const v = this._view;

    // Special row headers for this frame.
    let position = rec.position + rec.dataOffset + rec.height * frame * 4;
    const rowHeaders = [];
    for (let i = 0; i < rec.height; i++) {
      rowHeaders.push({
        rowOffset: v.getInt16(position, true),
        rowEncoding: v.getUint16(position + 2, true),
      });
      position += 4;
    }

    let dstPos = 0;
    for (const h of rowHeaders) {
      let srcPos = rec.position + h.rowOffset;
      if (h.rowEncoding === ROW_ENCODING_RLE) {
        // RLE row: negative probe = run of next byte, positive = literal copy.
        const rowWidth = v.getUint16(srcPos, true);
        srcPos += 2;
        let rowPos = 0;
        do {
          const probe = v.getInt16(srcPos, true);
          srcPos += 2;
          if (probe < 0) {
            const run = -probe;
            const pixel = fileBytes[srcPos++];
            for (let i = 0; i < run; i++) {
              data[dstPos++] = pixel;
              rowPos++;
            }
          } else if (probe > 0) {
            data.set(fileBytes.subarray(srcPos, srcPos + probe), dstPos);
            srcPos += probe;
            dstPos += probe;
            rowPos += probe;
          }
        } while (rowPos < rowWidth);
      } else {
        // Just copy bytes
        data.set(fileBytes.subarray(srcPos, srcPos + rec.width), dstPos);
        dstPos += rec.width;
      }
    }

    rec.frames[frame] = { width: rec.width, height: rec.height, data, palette: this.palette };
    return true;
  }

  _readCString(offset) {
    let end = offset;
    while (end < this._bytes.byteLength && this._bytes[end] !== 0) end++;
    let s = '';
    for (let i = offset; i < end; i++) s += String.fromCharCode(this._bytes[i]);
    return s;
  }
}
