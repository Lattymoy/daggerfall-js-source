// Base image handling for all Daggerfall image files.
// 1:1 translation of Daggerfall Unity's BaseImageFile.cs (MIT, Daggerfall
// Workshop / Gavin Clayton). Inherited by TextureFile, ImgFile, CifRciFile.
//
// Departures (documented, structure-only):
//   - Unity Color32[] becomes a flat RGBA Uint8ClampedArray ready for
//     GL/canvas upload. The vertical flip in getColor32 is kept verbatim
//     (DFU flips because Unity textures are bottom-up); renderer decides
//     how to consume it.
//   - GetSpectralEmissionColors32 / GetFireWallColors32 not ported: they are
//     Unity material-side effects (Color.RGBToHSV, Lerp), owned by our
//     Rendering arc when spectral enemies land.
//   - File-path plumbing dropped; loaders take byte buffers.

import { DFPalette } from './dfPalette.js';

export const COMPRESSION_FORMATS = Object.freeze({
  Uncompressed: 0x0000,
  RleCompressed: 0x0002,
  ImageRle: 0x0108,
  RecordRle: 0x1108,
});

/** Empty bitmap, matching DFU's `new DFBitmap()` returned on invalid access. */
export function emptyBitmap() {
  return { width: 0, height: 0, data: null, palette: null };
}

export class BaseImageFile {
  constructor() {
    /** Palette for building image data. */
    this.palette = new DFPalette();
    /** @type {Uint8Array|null} raw file bytes. */
    this._bytes = null;
    /** @type {DataView|null} */
    this._view = null;
    this._fileName = '';
  }

  get fileName() {
    return this._fileName;
  }

  _setBytes(bytes, fileName) {
    this._bytes = bytes;
    this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this._fileName = fileName;
  }

  /**
   * Reads a standard IMG file header at `position`. This header is found in
   * multiple image files, which is why it lives here in the base.
   * @returns {{position:number,xOffset:number,yOffset:number,width:number,height:number,compression:number,pixelDataLength:number,frameCount:number,dataPosition:number}}
   */
  readImgFileHeader(position) {
    const v = this._view;
    return {
      position,
      xOffset: v.getInt16(position, true),
      yOffset: v.getInt16(position + 2, true),
      width: v.getInt16(position + 4, true),
      height: v.getInt16(position + 6, true),
      compression: v.getUint16(position + 8, true),
      pixelDataLength: v.getUint16(position + 10, true),
      frameCount: 1,
      dataPosition: position + 12,
    };
  }

  /**
   * Decodes classic RLE data (code > 127 = run of next byte, else literal
   * copy of code+1 bytes) from `srcPos` into `dst` until `length` bytes
   * written. Ports ReadRleData. Returns the source position after the last
   * byte consumed.
   */
  readRleData(srcPos, length, dst, dstPos = 0) {
    const src = this._bytes;
    let pos = 0;
    do {
      const code = src[srcPos++];
      if (code > 127) {
        const pixel = src[srcPos++];
        for (let i = 0; i < code - 127; i++) {
          dst[dstPos++] = pixel;
          pos++;
        }
      } else {
        for (let i = 0; i < code + 1; i++) {
          dst[dstPos++] = src[srcPos++];
        }
        pos += code + 1;
      }
    } while (pos < length);
    return srcPos;
  }

  /**
   * Converts an indexed bitmap to flat RGBA using this file's palette.
   * Verbatim port of the full GetColor32 overload, including the vertical
   * flip and the double alpha assignment (cutout alpha then emissive
   * override).
   * @param {{width:number,height:number,data:Uint8Array}} srcBitmap
   * @param {number} [alphaIndex] palette index rendered transparent (-1 none).
   * @param {number} [border] pixels of empty border added around the image.
   * @param {number} [emissionIndex] index forced fully opaque (-1 none).
   * @param {number} [customAlphaValue] alpha for non-cutout pixels.
   * @returns {{colors:Uint8ClampedArray,width:number,height:number}}
   */
  getColor32(srcBitmap, alphaIndex = -1, border = 0, emissionIndex = -1, customAlphaValue = 255) {
    const srcWidth = srcBitmap.width;
    const srcHeight = srcBitmap.height;
    const dstWidth = srcWidth + border * 2;
    const dstHeight = srcHeight + border * 2;

    const colors = new Uint8ClampedArray(dstWidth * dstHeight * 4);
    const paletteData = this.palette.paletteBuffer;
    const headerLength = this.palette.headerLength;

    for (let y = 0; y < srcHeight; y++) {
      const srcRow = y * srcWidth;
      const dstRow = (dstHeight - 1 - border - y) * dstWidth;
      for (let x = 0; x < srcWidth; x++) {
        const index = srcBitmap.data[srcRow + x];
        const offset = headerLength + index * 3;
        let a = alphaIndex === index ? 0 : customAlphaValue; // General cutout alpha with custom alpha output
        a = emissionIndex === index ? 255 : a; // Make emissive parts fully non-transparent alpha
        const dst = (dstRow + border + x) * 4;
        colors[dst] = paletteData[offset];
        colors[dst + 1] = paletteData[offset + 1];
        colors[dst + 2] = paletteData[offset + 2];
        colors[dst + 3] = a;
      }
    }

    return { colors, width: dstWidth, height: dstHeight };
  }

  /**
   * Emission map for window textures: white where the bitmap holds
   * `emissionIndex`, transparent black elsewhere. Ports GetWindowColors32
   * (same vertical flip).
   * @returns {{colors:Uint8ClampedArray,width:number,height:number}}
   */
  getWindowColors32(srcBitmap, emissionIndex = 0xff) {
    const { width, height } = srcBitmap;
    const colors = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcRow = y * width;
      const dstRow = (height - 1 - y) * width;
      for (let x = 0; x < width; x++) {
        if (srcBitmap.data[srcRow + x] === emissionIndex) {
          const dst = (dstRow + x) * 4;
          colors[dst] = 255;
          colors[dst + 1] = 255;
          colors[dst + 2] = 255;
          colors[dst + 3] = 255;
        }
      }
    }
    return { colors, width, height };
  }
}
