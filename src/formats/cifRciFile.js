// *.CIF / *.RCI reader. CIF files contain one or more images, including
// animated weapon records; RCI files contain fixed-size image grids and are
// never animated.
// 1:1 translation of Daggerfall Unity's CifRciFile.cs (MIT, Daggerfall
// Workshop / Gavin Clayton). Quirks kept verbatim:
//   - FACES.CIF is actually an RCI file and is routed accordingly.
//   - RCI dimensions come from a per-filename table; record count is
//     fileLength / (width*height).
//   - WEAPON*.CIF: a standard "wielding" IMG record first (except
//     WEAPON09.CIF, the bow), then animation records with a 31-slot frame
//     offset list where non-zero entries define the frame count.
// Structural simplification only: DFU pre-sizes a fixed 64-record array
// (503 for TFAC00I0.RCI); we grow a plain array, behaviour identical.

import { BaseImageFile, COMPRESSION_FORMATS, emptyBitmap } from './baseImageFile.js';

const RECORD_TYPES = Object.freeze({
  MultiImage: 0,
  WeaponAnim: 1,
});

// Fixed dimensions for RCI-style files.
function rciDimensions(filename) {
  switch (filename) {
    case 'FACES.CIF':
    case 'CHLD00I0.RCI':
      return { width: 64, height: 64 };
    case 'TFAC00I0.RCI':
      return { width: 64, height: 64 };
    case 'BUTTONS.RCI':
      return { width: 32, height: 16 };
    case 'MPOP.RCI':
      return { width: 17, height: 17 };
    case 'NOTE.RCI':
      return { width: 44, height: 9 };
    case 'SPOP.RCI':
      return { width: 22, height: 22 };
    default:
      return null;
  }
}

export class CifRciFile extends BaseImageFile {
  constructor() {
    super();
    this._records = [];
  }

  /** Always ART_PAL.COL for CIF and RCI files. */
  get paletteName() {
    return 'ART_PAL.COL';
  }

  get recordCount() {
    return this._records.length;
  }

  get description() {
    if (this._fileName.endsWith('.CIF')) return 'CIF File';
    if (this._fileName.endsWith('.RCI')) return 'RCI File';
    return 'Unknown';
  }

  /**
   * Loads a CIF or RCI file.
   * @param {Uint8Array} bytes - full file contents.
   * @param {string} fileName - drives RCI/weapon routing.
   * @param {import('./dfPalette.js').DFPalette} [palette]
   * @returns {boolean} true if successful.
   */
  load(bytes, fileName, palette = null) {
    const upper = fileName.toUpperCase();
    if (!upper.endsWith('.CIF') && !upper.endsWith('.RCI')) return false;

    if (palette) this.palette = palette;
    this._setBytes(bytes, fileName);

    try {
      this._readRecords();
    } catch (e) {
      return false;
    }

    return true;
  }

  /** Number of frames in specified record, or 0 if invalid. */
  getFrameCount(record) {
    if (record < 0 || record >= this._records.length) return 0;
    return this._records[record].header.frameCount;
  }

  /** {width,height} of specified record. All frames share dimensions. */
  getSize(record) {
    if (record < 0 || record >= this._records.length) return { width: 0, height: 0 };
    const r = this._records[record];
    if (r.header.frameCount > 1) return { width: r.animHeader.width, height: r.animHeader.height };
    return { width: r.header.width, height: r.header.height };
  }

  /** {x,y} offset of specified record (0,0 for animated records). */
  getOffset(record) {
    if (record < 0 || record >= this._records.length) return { x: 0, y: 0 };
    const r = this._records[record];
    if (r.header.frameCount > 1) return { x: 0, y: 0 };
    return { x: r.header.xOffset, y: r.header.yOffset };
  }

  /**
   * Indexed 8-bit bitmap for specified record and frame:
   * {width, height, data: Uint8Array, palette}. Decoded lazily, cached.
   */
  getDFBitmap(record, frame) {
    if (record < 0 || record >= this._records.length || frame >= this.getFrameCount(record)) {
      return emptyBitmap();
    }
    if (!this._readImageData(record, frame)) return emptyBitmap();
    return this._records[record].frames[frame];
  }

  // --- Readers ---

  _readRecords() {
    const fn = this._fileName;

    // Handle RCI files (FACES.CIF is actually an RCI file).
    if (fn.endsWith('.RCI') || fn === 'FACES.CIF') {
      this._readRci(fn);
      return;
    }

    // Handle WEAPON files.
    if (fn.includes('WEAPO')) {
      this._readWeaponCif(fn);
      return;
    }

    // Plain CIF: a contiguous array of single-frame IMG records.
    let pos = 0;
    do {
      const header = this.readImgFileHeader(pos);
      this._records.push({
        header,
        animHeader: null,
        fileType: RECORD_TYPES.MultiImage,
        animPixelDataPosition: -1,
        frames: [null],
      });
      pos = header.dataPosition + header.pixelDataLength;
    } while (pos < this._bytes.byteLength);
  }

  /** Special handling for RCI files. */
  _readRci(filename) {
    const sz = rciDimensions(filename);
    if (!sz) return;

    // Get image count.
    const count = Math.floor(this._bytes.byteLength / (sz.width * sz.height));

    let pos = 0;
    for (let i = 0; i < count; i++) {
      this._records.push({
        header: {
          position: pos,
          xOffset: 0,
          yOffset: 0,
          width: sz.width,
          height: sz.height,
          compression: COMPRESSION_FORMATS.Uncompressed,
          pixelDataLength: sz.width * sz.height,
          frameCount: 1,
          dataPosition: pos,
        },
        animHeader: null,
        fileType: RECORD_TYPES.MultiImage,
        animPixelDataPosition: -1,
        frames: [null],
      });
      pos += sz.width * sz.height;
    }
  }

  /** Special handling for WEAPON CIF files. */
  _readWeaponCif(filename) {
    const v = this._view;
    let pos = 0;

    // Read "wielding" image, except for WEAPON09.CIF (the bow) which has none.
    if (filename !== 'WEAPON09.CIF') {
      const header = this.readImgFileHeader(pos);
      this._records.push({
        header,
        animHeader: null,
        fileType: RECORD_TYPES.MultiImage,
        animPixelDataPosition: -1,
        frames: [null],
      });
      pos = header.dataPosition + header.pixelDataLength;
    }

    do {
      const animHeader = {
        position: pos,
        width: v.getUint16(pos, true),
        height: v.getUint16(pos + 2, true),
        lastFrameWidth: v.getUint16(pos + 4, true),
        xOffset: v.getInt16(pos + 6, true),
        lastFrameYOffset: v.getInt16(pos + 8, true),
        dataLength: v.getInt16(pos + 10, true),
        frameDataOffsetList: new Array(31),
        totalSize: 0,
      };
      pos += 12;

      // Frame data offset list: non-zero entries define the frame count.
      let frameCount = 0;
      for (let i = 0; i < 31; i++) {
        animHeader.frameDataOffsetList[i] = v.getUint16(pos, true);
        if (animHeader.frameDataOffsetList[i] !== 0) frameCount++;
        pos += 2;
      }

      animHeader.totalSize = v.getUint16(pos, true);
      pos += 2;

      this._records.push({
        header: { frameCount },
        animHeader,
        fileType: RECORD_TYPES.WeaponAnim,
        animPixelDataPosition: pos,
        frames: new Array(frameCount).fill(null),
      });

      // Skip over pixel data.
      pos = animHeader.position + animHeader.totalSize;
    } while (pos < this._bytes.byteLength);
  }

  _readImageData(record, frame) {
    const rec = this._records[record];
    if (rec.frames[frame] !== null) return true; // already decoded

    if (rec.fileType === RECORD_TYPES.WeaponAnim) return this._readWeaponImage(record, frame);

    switch (rec.header.compression) {
      case COMPRESSION_FORMATS.RleCompressed:
        return this._readRleImage(record, frame);
      case COMPRESSION_FORMATS.Uncompressed:
        return this._readImage(record, frame);
      default:
        return false;
    }
  }

  /** Read uncompressed record (raw pixelDataLength bytes). */
  _readImage(record, frame) {
    const rec = this._records[record];
    const data = new Uint8Array(rec.header.pixelDataLength);
    data.set(
      this._bytes.subarray(rec.header.dataPosition, rec.header.dataPosition + data.length)
    );
    rec.frames[frame] = {
      width: rec.header.width,
      height: rec.header.height,
      data,
      palette: this.palette,
    };
    return true;
  }

  /** Read weapon frame: classic RLE at animPosition + frame offset. */
  _readWeaponImage(record, frame) {
    const rec = this._records[record];
    const length = rec.animHeader.width * rec.animHeader.height;
    const data = new Uint8Array(length);
    const position = rec.animHeader.position + rec.animHeader.frameDataOffsetList[frame];
    this.readRleData(position, length, data);
    rec.frames[frame] = {
      width: rec.animHeader.width,
      height: rec.animHeader.height,
      data,
      palette: this.palette,
    };
    return true;
  }

  /** Read a classic-RLE record. */
  _readRleImage(record, frame) {
    const rec = this._records[record];
    const length = rec.header.width * rec.header.height;
    const data = new Uint8Array(length);
    this.readRleData(rec.header.dataPosition, length, data);
    rec.frames[frame] = {
      width: rec.header.width,
      height: rec.header.height,
      data,
      palette: this.palette,
    };
    return true;
  }
}
