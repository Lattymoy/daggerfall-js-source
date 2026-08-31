// *.CFA reader - CfaFile.cs (MIT, Daggerfall Workshop), whole. The
// fifth classic image format the port reads, after IMG, CIF/RCI, TEXTURE
// and GFX. One record, N frames, all the same size, RLE-packed
// end-to-end: MRED00I0.CFA is the horse the player rides and
// MRED01I0.CFA the cart, four frames each (TR2).
//
// The header is 14 bytes (:118-127) and the only surprising field is
// WidthCompressed, which is what the RLE run LENGTH is measured in -
// `WidthCompressed * Height * FrameCount` (:133) - while the decoded
// image is WidthUncompressed wide. The two differ because the packed
// rows carry their own run codes; the decoder writes uncompressed
// bytes and stops when it has produced that many.
//
// GetDFBitmap (:83-97) copies one frame out of the flat buffer at
// `width * height * frame`, row by row - the port answers the same
// slice as a subarray, so a frame is a view rather than a copy.

import { BaseImageFile } from './baseImageFile.js';

/** The header, in order (:118-127). */
export const CFA_HEADER_SIZE = 14;

export class CfaFile extends BaseImageFile {
  constructor() {
    super();
    this.header = null;
    this.imageData = null;
  }

  /** Load (:106-120) with the .CFA extension check folded into the
   *  caller's filename, as every port reader has it. */
  load(bytes, fileName, palette = null) {
    this._setBytes(bytes, fileName);
    if (palette) this.palette = palette;
    this._readHeader();
    this._readImageData();
    return this;
  }

  /** ReadHeader (:115-128). */
  _readHeader() {
    const v = this._view;
    this.header = {
      widthUncompressed: v.getInt16(0, true),
      height: v.getInt16(2, true),
      widthCompressed: v.getInt16(4, true),
      unknown1: v.getInt16(6, true),
      unknown2: v.getInt16(8, true),
      bitsPerPixel: this._bytes[10],
      frameCount: this._bytes[11],
      headerSize: v.getInt16(12, true),
    };
  }

  /** ReadImageData (:129-137): one RLE run for the WHOLE file, whose
   *  length is measured in COMPRESSED widths. */
  _readImageData() {
    const h = this.header;
    this.imageData = new Uint8Array(h.widthUncompressed * h.height * h.frameCount);
    this.readRleData(h.headerSize, h.widthCompressed * h.height * h.frameCount, this.imageData);
  }

  /** RecordCount is 1 for a CFA (BaseImageFile's default record). */
  get recordCount() { return 1; }

  /** GetFrameCount (:71-77). */
  getFrameCount(record = 0) {
    if (record < 0 || record >= this.recordCount) return -1;
    return this.header?.frameCount ?? 0;
  }

  /** GetSize (:78-84). */
  getSize(record = 0) {
    if (record < 0 || record >= this.recordCount) return { width: 0, height: 0 };
    return { width: this.header.widthUncompressed, height: this.header.height };
  }

  /** GetDFBitmap (:85-101): the frame's own slice of the flat buffer. */
  getDFBitmap(record = 0, frame = 0) {
    if (record < 0 || record >= this.recordCount || frame < 0 || frame >= this.getFrameCount(record) || !this.imageData) {
      return { width: 0, height: 0, data: null, palette: null };
    }
    const { widthUncompressed: width, height } = this.header;
    const offset = width * height * frame;
    return {
      width, height,
      data: this.imageData.subarray(offset, offset + width * height),
      palette: this.palette,
    };
  }
}
