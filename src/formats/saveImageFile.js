// IMAGE.RAW reader (SAV1) - the classic save's 80x50 screenshot. 1:1
// translation of DFU API/Save/SaveImage.cs (MIT, Daggerfall Workshop):
// a headerless raw of ART_PAL.COL indexes, one record, one frame. The
// bitmap data is the file's bytes verbatim (DFU hands the whole
// managed file to DFBitmap.Data - a short or long file passes through
// untouched; GetSize answers 80x50 regardless).

import { BaseImageFile, emptyBitmap } from './baseImageFile.js';

export const SAVE_IMAGE_FILENAME = 'IMAGE.RAW';
export const SAVE_IMAGE_WIDTH = 80;
export const SAVE_IMAGE_HEIGHT = 50;

export class SaveImage extends BaseImageFile {
  constructor() {
    super();
    this._loaded = false;
  }

  get description() {
    return SAVE_IMAGE_FILENAME;
  }

  get paletteName() {
    return 'ART_PAL.COL';
  }

  get recordCount() {
    return 1;
  }

  /**
   * SaveImage.Load - the filename must be IMAGE.RAW (case-insensitive).
   * @param {Uint8Array} bytes - full file contents.
   * @param {string} [fileName]
   * @param {import('./dfPalette.js').DFPalette} [palette]
   * @returns {boolean} true if successful.
   */
  load(bytes, fileName = SAVE_IMAGE_FILENAME, palette = null) {
    if (fileName.toUpperCase() !== SAVE_IMAGE_FILENAME) return false;
    if (palette) this.palette = palette;
    this._setBytes(bytes, fileName);
    this._loaded = true;
    return true;
  }

  getFrameCount(record) {
    return record === 0 ? 1 : 0;
  }

  getSize(record) {
    if (record === 0) return { width: SAVE_IMAGE_WIDTH, height: SAVE_IMAGE_HEIGHT };
    return { width: 0, height: 0 };
  }

  /** The one bitmap (record/frame must be 0 and the file non-empty). */
  getDFBitmap(record = 0, frame = 0) {
    if (record !== 0 || frame !== 0 || !this._loaded || this._bytes.length === 0)
      return emptyBitmap();
    return {
      width: SAVE_IMAGE_WIDTH,
      height: SAVE_IMAGE_HEIGHT,
      data: this._bytes,
      palette: this.palette,
    };
  }
}
