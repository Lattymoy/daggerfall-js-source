// THE FLIC READER (F1) - API/FlcFile.cs ported whole. Autodesk
// Animator's FLIC format, which is what Daggerfall's .CEL animations
// are (the three chargen constellations ROGUE/MAGE/WARRIOR.CEL) - a
// different format from the .VID movies, which is why the U22 video
// reader could not stand in for it.
//
// Shape: a 128-byte header (size, magic, frame count, dimensions,
// pixel depth, the 1/1000s frame delay, the frame-1 offset), then
// NumOfFrames+1 frame headers - the extra one is the RING FRAME that
// loops the animation back - each carrying sub-chunks. Daggerfall's
// files only ever use COLOR_256, DELTA_FLC, BYTE_RUN and PSTAMP; the
// other chunk types are ported because DFU ports them, and the
// defensive arms are recorded below rather than exercised.
//
// TWO DFU BEHAVIOURS KEPT BUG-FOR-BUG:
//  - THE FRAME BUFFER IS BOTTOM-UP. Every write lands at
//    `x + (Height-1)*Width - y*Width`, so FLIC row 0 is the LAST row
//    of the buffer. That is Unity's texture origin, not the format's,
//    and callers must know it (getFrame() answers a top-down copy).
//  - the unsupported-chunk skip computes an ABSOLUTE position and
//    then seeks RELATIVE to the current one, double-advancing. It is
//    unreachable on the shipping files (their chunk types are all
//    handled) and is preserved rather than quietly corrected.
//
// TWO DEFENSIVE PORT ADDITIONS, both recorded rather than silent:
//  - out-of-range pixel writes THROW (see _put), because C#'s
//    Color32[] indexer throws where a JS typed array drops the write
//    and lets a malformed chunk "succeed" - the same emulation the
//    VID reader already carries.
//  - a missing frame header answers false instead of indexing null
//    (C# would throw); a truncated file still surfaces as a thrown
//    RangeError from the cursor, as C#'s EndOfStreamException does.
//
// The reader is data-only: it decodes into an RGBA frame buffer the
// caller uploads. Palette entries are packed RGBA words, as every
// other image path in the port produces.

const FRAME_HEADER_SIZE = 16;
const CHUNK_HEADER_SIZE = 6;

/** FLIC_Format - the file magic, read as a SIGNED 16-bit value. */
export const FLIC_FORMAT = Object.freeze({ FLI: -20719, FLIC: -20718 });
/** CinematicSpeed - the frame-delay divisor per format. */
export const CINEMATIC_SPEED = Object.freeze({ FLI: 70, FLIC: 1000 });

export const CHUNK_TYPE = Object.freeze({
  None: 0, CEL_DATA: 3, COLOR_256: 4, DELTA_FLC: 7, COLOR_64: 11,
  DELTA_FLI: 12, BLACK: 13, BYTE_RUN: 15, FLI_COPY: 16, PSTAMP: 18,
  DTA_BRUN: 25, DTA_COPY: 26, DTA_LC: 27, LABEL: 31, BMP_MASK: 32,
  MLEV_MASK: 33, SEGMENT: 34, KEY_IMAGE: 35, KEY_PAL: 36, REGION: 37,
  WAVE: 38, USERSTRING: 39, RGN_MASK: 40, LABELEX: 41, SHIFT: 42,
  PATHMAP: 43, PREFIX_TYPE: -3600, FRAME_TYPE: -3590,
});
const CHUNK_VALUES = new Set(Object.values(CHUNK_TYPE));

const rgba = (r, g, b, a) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

/** A little-endian cursor over the file, mirroring BinaryReader. */
class Cursor {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  get length() { return this.bytes.length; }
  seek(p) { this.pos = p; }
  skip(n) { this.pos += n; }
  u8() { return this.bytes[this.pos++]; }
  i8() { const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
  u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  i16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
}

export class FlcFile {
  constructor() {
    this.header = null;
    this.frameHeaders = [];
    this.palette = null;        // Uint32Array, ColorCount entries
    this.frameBuffer = null;    // Uint32Array, Width*Height (BOTTOM-UP)
    this.currentFrame = 0;
    this.colorCount = 0;
    this.frameDelay = 0;        // seconds
    this.flicType = 0;
    this.readyToPlay = false;
    // Transparency (DFU's per-instance switch): a palette entry whose
    // RGB matches becomes fully transparent instead of opaque.
    this.transparency = false;
    this.transparentRed = 0;
    this.transparentGreen = 0;
    this.transparentBlue = 0;
  }

  get width() { return this.header?.width ?? 0; }
  get height() { return this.header?.height ?? 0; }

  /** Load(filePath)'s extension gate + Read(). Name is checked as DFU
   *  checks it: .FLC or .CEL only. */
  load(bytes, name = '') {
    if (name && !/\.(FLC|CEL)$/i.test(name)) return false;
    this._c = new Cursor(bytes);
    return this._read();
  }

  _read() {
    this._readHeader();
    this.flicType = this.header.fileID;
    this.colorCount = 2 ** this.header.pixelDepth;
    this.palette = new Uint32Array(this.colorCount);
    this.frameBuffer = new Uint32Array(this.header.width * this.header.height);
    this.frameHeaders = new Array(this.header.numOfFrames + 1);   // + the ring frame
    if (!this._readFrameHeaders()) {
      console.warn('[flc] Incompatible format, cannot read');
      this.readyToPlay = false;
      return false;
    }
    this.readyToPlay = true;
    const speed = this.header.fileID === FLIC_FORMAT.FLI ? CINEMATIC_SPEED.FLI : CINEMATIC_SPEED.FLIC;
    this.frameDelay = this.header.frameDelay / speed;
    this.bufferNextFrame();
    return this.readyToPlay;
  }

  _readHeader() {
    const c = this._c;
    const h = {};
    h.fileSize = c.i32();
    h.fileID = c.i16();
    h.numOfFrames = c.i16();
    h.width = c.i16();
    h.height = c.i16();
    h.pixelDepth = c.i16();
    h.flags = c.i16();
    h.frameDelay = c.i32();
    c.skip(2);
    h.dateCreated = c.i32();
    h.creatorSN = c.i32();
    h.lastUpdate = c.i32();
    h.updaterSN = c.i32();
    h.xAspect = c.i16();
    h.yAspect = c.i16();
    h.extFlags = c.i16();
    h.keyFrames = c.i16();
    h.totalFrames = c.i16();
    h.reqMemory = c.i32();
    h.maxRegions = c.i16();
    h.transpLevels = c.i16();
    c.skip(24);
    h.frame1Offset = c.i32();
    h.frame2Offset = c.i32();
    c.skip(40);
    this.header = h;
    // A true FLIC jumps to the first frame; an FLI is already there.
    if (h.fileID === FLIC_FORMAT.FLIC) c.seek(h.frame1Offset);
  }

  _readFrameHeaders() {
    const c = this._c;
    for (let i = 0; i <= this.header.numOfFrames; i++) {
      const fh = this._readFrameHeader();
      if (!fh) {
        console.warn('[flc] Invalid frame found, cannot play');
        return false;
      }
      this.frameHeaders[i] = fh;
      // The LAST frame header is followed by no room to seek past -
      // that break is what ends the walk (the ring frame's own size
      // would run past the file).
      if (c.pos + fh.size - FRAME_HEADER_SIZE < c.length) c.skip(fh.size - FRAME_HEADER_SIZE);
      else break;
    }
    return true;
  }

  _readFrameHeader() {
    const c = this._c;
    const fh = { posInFile: c.pos };
    fh.size = c.i32();
    fh.type = c.i16();
    fh.numSubChunks = c.i16();
    c.skip(8);
    if (!CHUNK_VALUES.has(fh.type)) {
      console.warn(`[flc] Invalid frame header type: ${fh.type}`);
      return null;
    }
    return fh;
  }

  _readChunkHeader() {
    const c = this._c;
    const ch = { size: c.i32(), type: c.i16() };
    return CHUNK_VALUES.has(ch.type) ? ch : null;
  }

  /** Decode one frame into frameBuffer and advance CurrentFrame; the
   *  frame after the last wraps to 1, NOT 0 - frame 0 is the full
   *  key frame and the ring frame loops back to the second. */
  bufferNextFrame(frameNum = -1) {
    if (!this.readyToPlay) return false;
    let n = (frameNum >= 0 && frameNum <= this.header.numOfFrames) ? frameNum : this.currentFrame;
    const fh = this.frameHeaders[n];
    if (!fh) return false;
    const c = this._c;
    c.seek(fh.posInFile + FRAME_HEADER_SIZE);   // skip over the frame header
    for (let i = 0; i < fh.numSubChunks; i++) {
      const ch = this._readChunkHeader();
      if (!ch) {
        console.warn('[flc] Invalid chunk type');
        return false;
      }
      switch (ch.type) {
        case CHUNK_TYPE.COLOR_256: this._decodeColor(false); break;
        case CHUNK_TYPE.COLOR_64: this._decodeColor(true); break;
        case CHUNK_TYPE.DELTA_FLC: this._decodeDeltaFlc(); break;
        case CHUNK_TYPE.DELTA_FLI: this._decodeDeltaFli(); break;
        case CHUNK_TYPE.BYTE_RUN: this._decodeByteRun(); break;
        case CHUNK_TYPE.PSTAMP: c.skip(ch.size - CHUNK_HEADER_SIZE); break;   // a thumbnail
        default: {
          // BUG-FOR-BUG (see the header): an ABSOLUTE position is
          // computed and then applied as a RELATIVE skip.
          const skip = c.pos + ch.size - CHUNK_HEADER_SIZE;
          if (skip > this.header.fileSize) {
            console.warn('[flc] Read error - tried to skip past the end of file');
            this.readyToPlay = false;
            return false;
          }
          c.skip(skip);
          break;
        }
      }
    }
    this.currentFrame = (++n <= this.header.numOfFrames) ? n : 1;
    return true;
  }

  _decodeColor(color64) {
    const c = this._c;
    const scale = color64 ? 4 : 1;
    const numOfPackets = c.i16();
    let colorInd = 0;
    for (let i = 0; i < numOfPackets; i++) {
      c.skip(c.u8() * 3);                       // colour skip count
      let numOfColorsToChange = c.u8();
      if (numOfColorsToChange === 0) numOfColorsToChange = 256;
      for (let cc = 0; cc < numOfColorsToChange; cc++) {
        const r = c.u8() * scale, g = c.u8() * scale, b = c.u8() * scale;
        this.palette[colorInd] = (this.transparency
          && r === this.transparentRed && g === this.transparentGreen && b === this.transparentBlue)
          ? rgba(0, 0, 0, 0)
          : rgba(r & 0xff, g & 0xff, b & 0xff, 255);
        colorInd++;
      }
    }
    return true;
  }

  _decodeByteRun() {
    const c = this._c;
    for (let y = 0; y < this.header.height; y++) {
      c.u8();                                   // packet count, unused (as DFU notes)
      let x = 0;
      while (x < this.header.width) {
        let sizeType = c.i8();
        if (sizeType < 0) {                     // negative: a literal run
          sizeType = -sizeType;
          this._screenCopySeg(x, y, sizeType);
        } else if (sizeType > 0) {              // positive: one pixel repeated
          this._screenRepeatOne(x, y, sizeType);
        }
        x += sizeType;
      }
    }
  }

  _decodeDeltaFlc() {
    const c = this._c;
    const lineCount = c.u16();
    let x = 0, y = 0, packetCount = 0;
    for (let i = 0; i < lineCount; i++) {
      for (;;) {
        const opcode = c.i16();
        if ((opcode & (1 << 15)) !== 0) {
          if ((opcode & (1 << 14)) !== 0) y += Math.abs(opcode);   // line skip (DFU's Math.abs, kept)
          else break;                                             // last pixel
        } else if ((opcode & (1 << 14)) === 0) {
          packetCount = opcode;
          break;
        }
      }
      for (let n = 0; n < packetCount; n++) {
        const colSkipCount = c.u8();
        let sizeType = c.i8();
        x += colSkipCount;
        if (sizeType > 0) this._screenCopyTwoSeg(x, y, sizeType);
        else if (sizeType < 0) { sizeType = -sizeType; this._screenRepeatTwo(x, y, sizeType); }
        x += sizeType * 2;
      }
      y++;
      x = 0;
    }
  }

  _decodeDeltaFli() {
    const c = this._c;
    const firstLine = c.i16();
    const numOfLines = c.i16();
    for (let y = firstLine; y < numOfLines; y++) {
      const numOfPackets = c.u8();
      let x = 0;
      for (let p = 0; p < numOfPackets; p++) {
        const colSkip = c.u8();
        let sizeType = c.i8();
        x += colSkip;
        // REVERSED from BYTE_RUN: positive copies a segment here
        if (sizeType > 0) this._screenCopySeg(x, y, sizeType);
        else if (sizeType < 0) { sizeType = -sizeType; this._screenRepeatOne(x, y, sizeType); }
        x += sizeType;
      }
    }
  }

  /** The BOTTOM-UP address (see the header). */
  _pos(x, y) { return x + (this.header.height - 1) * this.header.width - y * this.header.width; }

  /** Writes one pixel, THROWING past the frame buffer as C#'s
   *  Color32[] indexer does (IndexOutOfRangeException). AUDIT F-P1:
   *  without this a JS typed array DROPS the write silently and the
   *  malformed chunk decodes "successfully" - the exact hazard the
   *  VID reader already emulates (vidFile.js _putPixel). */
  _put(pos, color) {
    if (pos < 0 || pos >= this.frameBuffer.length) {
      throw new Error('FlcFile: frame buffer index out of range.');
    }
    this.frameBuffer[pos] = color;
  }

  _screenCopySeg(x, y, count) {
    let pos = this._pos(x, y);
    for (let i = 0; i < count; i++) this._put(pos++, this.palette[this._c.u8()]);
  }

  _screenRepeatOne(x, y, count) {
    const color = this.palette[this._c.u8()];
    let pos = this._pos(x, y);
    for (let i = 0; i < count; i++) this._put(pos++, color);
  }

  _screenRepeatTwo(x, y, count) {
    const c1 = this.palette[this._c.u8()], c2 = this.palette[this._c.u8()];
    let pos = this._pos(x, y);
    for (let i = 0; i < count; i++) {
      this._put(pos, c1);
      this._put(pos + 1, c2);
      pos += 2;
    }
  }

  _screenCopyTwoSeg(x, y, count) {
    let pos = this._pos(x, y);
    for (let i = 0; i < count; i++) {
      this._put(pos, this.palette[this._c.u8()]);
      this._put(pos + 1, this.palette[this._c.u8()]);
      pos += 2;
    }
  }

  /** The frame as the port's image shape. `flip` answers TOP-DOWN,
   *  which is what every other reader here produces. */
  getFrame({ flip = true } = {}) {
    const { width, height } = this.header;
    if (!flip) return { width, height, colors: this.frameBuffer.slice() };
    const colors = new Uint32Array(width * height);
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * width;
      colors.set(this.frameBuffer.subarray(src, src + width), y * width);
    }
    return { width, height, colors };
  }
}
