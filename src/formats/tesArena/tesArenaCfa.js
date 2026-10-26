// ARN1 (2026-10-26) - TES: ARENA'S *.CFA, the animated sprites its creatures, people and effects are drawn from.
// OpenTESArena (MIT, OpenTESArena/src/Assets/CFAFile.cpp CFAFile::init, "adapted from WinArena") reads it so:
//
//   - a 12-byte header: widthUncompressed, height, widthCompressed, xOffset, yOffset (u16 each), bitsPerPixel and
//     frameCount (u8), then headerSize (u16) - where the pixel data starts;
//   - a look-up table at byte 76: the palette index each packed value stands for;
//   - every frame's rows packed end to end in ONE run of Daggerfall's own RLE (formats/baseImageFile.js
//     readRleData - Compression::decodeRLE is the same law), `widthCompressed * height * frameCount` bytes;
//   - each row `widthCompressed` bytes of `bitsPerPixel`-bit values, most significant bit first (the demux1-demux7
//     routines, which read groups of whole bytes and so see zeros past a row's end), each value looked up in the table
//     - or, at 8 bits, the bytes are the palette indices themselves, untranslated.
//
// Index 0 is the cutout, as in every Daggerfall sprite. Daggerfall's own CFA (formats/cfaFile.js, the horse and cart)
// is the 8-bit case with no table; this reader is Arena's whole format.

import { BaseImageFile } from '../baseImageFile.js';

export const TES_ARENA_CFA_LUT_OFFSET = 76;

export class TesArenaCfaFile extends BaseImageFile {
  constructor() {
    super();
    this.header = null;
    /** @type {Uint8Array[]} one palette-index picture per frame, top-down */
    this.frames = [];
  }

  load(bytes, fileName, palette = null) {
    this._setBytes(bytes, fileName);
    if (palette) this.palette = palette;
    const v = this._view;
    this.header = {
      widthUncompressed: v.getUint16(0, true),
      height: v.getUint16(2, true),
      widthCompressed: v.getUint16(4, true),
      xOffset: v.getUint16(6, true),
      yOffset: v.getUint16(8, true),
      bitsPerPixel: bytes[10],
      frameCount: bytes[11],
      headerSize: v.getUint16(12, true),
    };
    const { widthUncompressed: w, height: h, widthCompressed: wc, bitsPerPixel: bpp, frameCount: n, headerSize } = this.header;
    if (!(bpp >= 1 && bpp <= 8)) throw new Error(`${fileName}: ${bpp} bits a pixel`);
    const packed = new Uint8Array(wc * h * n);
    this.readRleData(headerSize, packed.length, packed);
    const lut = bytes.subarray(TES_ARENA_CFA_LUT_OFFSET, headerSize), mask = (1 << bpp) - 1;
    this.frames = [];
    for (let f = 0; f < n; f++) {
      const px = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const row = (f * h + y) * wc, out = y * w;
        if (bpp === 8) {
          for (let x = 0; x < Math.min(w, wc); x++) px[out + x] = packed[row + x];
          continue;
        }
        let acc = 0, bits = 0, at = 0;
        for (let x = 0; x < w; x++) {
          while (bits < bpp) { acc = (acc << 8) | (at < wc ? packed[row + at] : 0); at++; bits += 8; }   // past the row: the demux's zeros
          bits -= bpp;
          px[out + x] = lut[(acc >> bits) & mask] ?? 0;   // the most significant bits first
          acc &= (1 << bits) - 1;
        }
      }
      this.frames.push(px);
    }
    return this;
  }

  get recordCount() { return 1; }
  getFrameCount() { return this.header?.frameCount ?? 0; }
  getSize() { return this.header ? { width: this.header.widthUncompressed, height: this.header.height } : { width: 0, height: 0 }; }
  getDFBitmap(record = 0, frame = 0) {
    const px = record === 0 ? this.frames[frame] : null;
    if (!px) return { width: 0, height: 0, data: null, palette: null };
    return { width: this.header.widthUncompressed, height: this.header.height, data: px, palette: this.palette };
  }
}
