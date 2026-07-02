// SKY??.DAT reader: day-sky backdrops. 1:1 translation of Daggerfall Unity's
// SkyFile.cs (MIT, Daggerfall Workshop / Gavin Clayton). Layout verbatim:
//   - 32 palettes at offset 0, stride 776, palette data 8 bytes into each
//     block (768 bytes RGB).
//   - 64 raw indexed frames (record * 32 + frame) of 512x220 at offset
//     549120. Record 0 is the EAST half, record 1 the WEST half (the
//     DaggerfallSky consumer maps them so; the file itself has no names).
//   - 32 frames sweep sunrise to noon; afternoon reuses frame 63 - n
//     mirrored, and DFU's top fill color is west pixel 0.
// getColor32 keeps the base convention: bottom-up rows, per-FRAME palette.

import { DFPalette } from './dfPalette.js';

export const SKY_FRAME_WIDTH = 512;
export const SKY_FRAME_HEIGHT = 220;
const FRAME_DATA_LENGTH = SKY_FRAME_WIDTH * SKY_FRAME_HEIGHT;
const PALETTE_DATA_POSITION = 0;
const IMAGE_DATA_POSITION = 549120;

export class SkyFile {
  constructor() {
    this._bytes = null;
    this._fileName = '';
    this._palettes = new Array(32).fill(null);
    this._bitmaps = new Array(64).fill(null);
  }

  /** Always 2 for a SKY file (one animation each for east and west sky). */
  get recordCount() {
    return this._bytes ? 2 : 0;
  }

  get description() {
    return 'SKY File';
  }

  /**
   * Load a SKY??.DAT file.
   * @param {Uint8Array} bytes
   * @param {string} fileName
   * @returns {boolean} true if successful.
   */
  load(bytes, fileName) {
    const fn = fileName.toUpperCase();
    if (!fn.startsWith('SKY') && !fn.endsWith('.DAT')) return false;
    this._bytes = bytes;
    this._fileName = fileName;
    return true;
  }

  /** Palette for specified frame (32 per file), cached. Null if invalid. */
  getDFPalette(frame) {
    if (frame < 0 || frame >= 32) return null;
    if (this._palettes[frame] === null) {
      const p = new DFPalette();
      p.readEmbedded(this._bytes, PALETTE_DATA_POSITION + 776 * frame + 8);
      this._palettes[frame] = p;
    }
    return this._palettes[frame];
  }

  /** Indexed 8-bit bitmap for record (0 east / 1 west) and frame (0-31). */
  getDFBitmap(record, frame) {
    if (record < 0 || record > 1 || frame < 0 || frame > 31) {
      return { width: 0, height: 0, data: new Uint8Array(0) };
    }
    const index = record * 32 + frame;
    if (this._bitmaps[index] === null) {
      const start = IMAGE_DATA_POSITION + FRAME_DATA_LENGTH * index;
      this._bitmaps[index] = {
        width: SKY_FRAME_WIDTH,
        height: SKY_FRAME_HEIGHT,
        data: this._bytes.subarray(start, start + FRAME_DATA_LENGTH),
      };
    }
    return this._bitmaps[index];
  }

  /** Always 32 for SKY files; -1 on invalid record. */
  getFrameCount(record) {
    if (!this._bytes || record < 0 || record >= 2) return -1;
    return 32;
  }

  getSize(record) {
    if (!this._bytes || record < 0 || record >= 2) return { width: 0, height: 0 };
    return { width: SKY_FRAME_WIDTH, height: SKY_FRAME_HEIGHT };
  }

  /**
   * RGBA for record/frame using that frame's palette, bottom-up rows (the
   * base image convention this repo uploads with flipY off).
   * @returns {{colors:Uint8ClampedArray,width:number,height:number}}
   */
  getColor32(record, frame) {
    const bitmap = this.getDFBitmap(record, frame);
    const palette = this.getDFPalette(frame);
    const pal = palette.paletteBuffer;
    const head = palette.headerLength;
    const { width, height, data } = bitmap;
    const colors = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcRow = y * width;
      const dstRow = (height - 1 - y) * width;
      for (let x = 0; x < width; x++) {
        const offset = head + data[srcRow + x] * 3;
        const dst = (dstRow + x) * 4;
        colors[dst] = pal[offset];
        colors[dst + 1] = pal[offset + 1];
        colors[dst + 2] = pal[offset + 2];
        colors[dst + 3] = 255;
      }
    }
    return { colors, width, height };
  }

  /** SKY??.DAT filename for an index; invalid index gives an invalid name. */
  static indexToFileName(skyIndex) {
    return `SKY${String(skyIndex).padStart(2, '0')}.DAT`;
  }
}
