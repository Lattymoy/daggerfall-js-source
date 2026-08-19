// *.VID reader. 1:1 translation of Daggerfall Unity's VidFile.cs
// (MIT, Daggerfall Workshop / Gavin Clayton). A VID is an interleaved
// audio+video stream: a 15-byte header, one palette block, then a
// sequence of typed blocks read one at a time by readNextBlock().
// Video blocks decode into ONE persistent frame buffer - full frames
// replace it, incremental frames patch it - so the buffer after each
// video block IS the frame to show. (DFU's class comment: "Unlike most
// API classes, this one uses the UnityEngine namespace to directly
// decode image data to a Color32[] frame buffer for efficiency." Here
// the Color32[] is a flat RGBA Uint8Array of frameWidth*frameHeight.)
//
// Layout (VidFile.cs):
//   header: "VID" (3 bytes), Unknown1 u16 (always 512), FrameCount u16,
//     FrameWidth u16 (256 or 320), FrameHeight u16 (200),
//     GlobalDelay u16, Unknown2 u16 (always 14)
//   palette block: type byte (must be 2) + 768 bytes, each component
//     multiplied by 4 (VGA 6-bit -> 8-bit)
//   blocks: type byte then payload -
//     0   Null                            (rejected, stream advances 1 byte)
//     1   Video_IncrementalFrame          delay u16 + partial RLE from pos 0
//     2   Palette                         (see quirk below)
//     3   Video_StartFrame                delay u16 + full RLE
//     4   Video_IncrementalRowOffsetFrame delay u16 + row u16 + partial RLE
//     20  EndOfFile
//     124 Audio_StartFrame                Unknown1 u16 + PlaybackRate u8 +
//                                         DataLength u16 + data
//     125 Audio_IncrementalFrame          DataLength u16 + data
//
// Quirks kept verbatim (all of them are in VidFile.ReadBlock):
//   - The Palette case does `streamPosition += paletteDataLength` to skip
//     the extra palette, but the tail of ReadBlock then overwrites
//     streamPosition with the stream's own position (one byte past the
//     block type), so the skip is UNDONE. A mid-stream palette block
//     therefore desyncs the stream instead of being skipped. Reproduced
//     exactly; no .VID in ARENA2 contains one.
//   - frameDelay is computed AFTER the block switch from the audio buffer
//     length, whatever block was just read - so a video block inherits the
//     delay of the last audio block. If no audio block has been read yet
//     the C# dereferences a null audioBuffer; this throws out of ReadBlock
//     (the try/catch is above this line), and so does the port. Every
//     ARENA2 .VID opens with an audio block, so it never fires there.
//   - Any exception inside the switch is swallowed and ReadBlock returns 0
//     WITHOUT advancing streamPosition, so the same block is read again on
//     the next call - a bad block type, a short read at end of stream, or a
//     frame-buffer overrun all park the reader in place forever.
//   - An Audio_StartFrame with PlaybackRate != 166 throws AFTER its data has
//     been consumed into audioBuffer, so the buffer is updated by a block
//     that "failed".
//   - The minimum frame delay of 740/11025 s is DFU's fix for the sped-up
//     tails of ANIM0000.VID and ANIM0005.VID, and is applied to every block.

const VID = 'VID';
const SAMPLE_RATE = 11025;
const PALETTE_DATA_LENGTH = 768;
const PALETTE_COLOR_COUNT = 256;
const PALETTE_MULTIPLIER = 4;
const MIN_FRAME_DELAY = 740 / SAMPLE_RATE;

export const VID_SAMPLE_RATE = SAMPLE_RATE;
export const VID_MIN_FRAME_DELAY = MIN_FRAME_DELAY;

export const VID_BLOCK_TYPES = Object.freeze({
  Null: 0,
  Video_IncrementalFrame: 1,
  Palette: 2,
  Video_StartFrame: 3,
  Video_IncrementalRowOffsetFrame: 4,
  EndOfFile: 20,
  Audio_StartFrame: 124,
  Audio_IncrementalFrame: 125,
});

/** BinaryReader over a memory stream: ReadByte/ReadUInt16 throw past the
 *  end (EndOfStreamException), ReadBytes returns a short buffer instead. */
class VidReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.position = 0;
  }

  readByte() {
    if (this.position >= this.bytes.length) throw new Error('VidFile: end of stream.');
    return this.bytes[this.position++];
  }

  readUInt16() {
    const lo = this.readByte();
    const hi = this.readByte();
    return lo | (hi << 8);
  }

  readBytes(count) {
    if (this.position >= this.bytes.length) return new Uint8Array(0);
    const end = Math.min(this.position + count, this.bytes.length);
    const out = this.bytes.subarray(this.position, end);
    this.position = end;
    return out;
  }

  readCString(length) {
    const raw = this.readBytes(length);
    let end = raw.length;
    while (end > 0 && raw[end - 1] === 0) end--;   // TrimEnd('\0')
    return String.fromCharCode(...raw.subarray(0, end));
  }
}

export class VidFile {
  constructor() {
    this.header = null;
    this.reader = null;
    this.palette = null;      // Uint8Array(256*4), RGBA
    this._frameBuffer = null; // Uint8Array(w*h*4), RGBA
    this._audioBuffer = null; // Uint8Array, unsigned 8-bit PCM
    this._lastBlockType = VID_BLOCK_TYPES.Null;
    this._currentBlock = 0;
    this._lastDelay = 0;
    this._frameDelay = 0;
    this.streamPosition = 0;
    this._endOfFileReached = false;
  }

  get frameCount() { return this.header.frameCount; }
  get frameWidth() { return this.header.frameWidth; }
  get frameHeight() { return this.header.frameHeight; }
  get sampleRate() { return SAMPLE_RATE; }
  get audioBuffer() { return this._audioBuffer; }
  get frameBuffer() { return this._frameBuffer; }
  get frameDelay() { return this._frameDelay; }
  get currentBlock() { return this._currentBlock; }
  get lastBlockType() { return this._lastBlockType; }
  get endOfFile() { return this._endOfFileReached; }
  get lastDelay() { return this._lastDelay; }

  /**
   * Open a VID file. Throws if the bytes are not a VID (DFU's ReadHeader /
   * ReadPalette throw out of Open the same way).
   * @param {Uint8Array} bytes
   * @returns {boolean} true if successful.
   */
  open(bytes) {
    if (!bytes || bytes.length === 0) {
      this._endOfFileReached = true;
      return false;
    }

    this.reader = new VidReader(bytes);
    this._readHeader();
    this._readPalette();

    this.streamPosition = this.reader.position;
    this._endOfFileReached = false;
    this._currentBlock = 0;

    return true;
  }

  /**
   * Read next block from VID stream.
   * Daggerfall's VID files are mostly interleaved audio and video streams.
   * Occasionally there is a null block which must be rejected.
   */
  readNextBlock() {
    this._readBlock();
  }

  /** Returns bytes read for this block (DFU's ReadBlock return value). */
  _readBlock() {
    if (this._endOfFileReached) return 0;

    const reader = this.reader;
    reader.position = this.streamPosition;

    // Read next block type. This read is OUTSIDE the try below, so a stream
    // that runs out before an EndOfFile block throws out of readNextBlock().
    const blockType = reader.readByte();
    this._lastBlockType = blockType;

    // Handle null block
    if (blockType === VID_BLOCK_TYPES.Null) {
      this.streamPosition = reader.position;
      return 0;
    }

    try {
      switch (blockType) {
        case VID_BLOCK_TYPES.Palette:
          // Quirk: overwritten by streamPosition = reader.position below.
          this.streamPosition += PALETTE_DATA_LENGTH;
          break;
        case VID_BLOCK_TYPES.Audio_StartFrame:
          this._readAudioStartFrame();
          break;
        case VID_BLOCK_TYPES.Audio_IncrementalFrame:
          this._readAudioIncrementalFrame();
          break;
        case VID_BLOCK_TYPES.Video_StartFrame:
          this._readVideoStartFrame();
          break;
        case VID_BLOCK_TYPES.Video_IncrementalFrame:
          this._readVideoIncrementalFrame();
          break;
        case VID_BLOCK_TYPES.Video_IncrementalRowOffsetFrame:
          this._readVideoRowOffsetFrame();
          break;
        case VID_BLOCK_TYPES.EndOfFile:
          this._endOfFileReached = true;
          break;
        default:
          throw new Error('VidFile: Invalid/Unknown block type encountered.');
      }
    } catch {
      // Swallowed exactly as DFU does: streamPosition is NOT advanced.
      return 0;
    }

    // Calculate delay time for this frame
    // Generally equivalent to audioBuffer.Length / sampleRate
    // Seems to differ mainly at beginning and end of video
    this._frameDelay = this._audioBuffer.length / SAMPLE_RATE;

    // Daggerfall .VID files always have at least an audioBuffer.Length of 740 while in the middle of audio portions.
    // As the audio portion ends, this length can be much shorter, causing frameDelay to become very short
    // and making playback speed up. Enforcing a minimum based on a length of 740 to fix this.
    // This fixes the ends of ANIM0000.VID and ANIM0005.VID.
    if (this._frameDelay < MIN_FRAME_DELAY) {
      this._frameDelay = MIN_FRAME_DELAY;
    }

    const bytesRead = reader.position - this.streamPosition;
    this.streamPosition = reader.position;
    this._currentBlock++;

    return bytesRead;
  }

  // ---- Readers ------------------------------------------------------------

  _readHeader() {
    const reader = this.reader;

    // Verify file starts with VID
    const vid = reader.readCString(3);
    if (vid !== VID) throw new Error('VidFile: Invalid VID header encountered.');

    this.header = {
      vid,
      unknown1: reader.readUInt16(),
      frameCount: reader.readUInt16(),
      frameWidth: reader.readUInt16(),
      frameHeight: reader.readUInt16(),
      globalDelay: reader.readUInt16(),
      unknown2: reader.readUInt16(),
    };

    // Init frame buffer
    this._frameBuffer = new Uint8Array(this.header.frameWidth * this.header.frameHeight * 4);
  }

  _readPalette() {
    const reader = this.reader;
    const blockType = reader.readByte();
    if (blockType !== VID_BLOCK_TYPES.Palette) {
      throw new Error('VidFile: Palette block not encountered after header.');
    }

    let pos = 0;
    const data = reader.readBytes(PALETTE_DATA_LENGTH);
    this.palette = new Uint8Array(PALETTE_COLOR_COUNT * 4);
    for (let i = 0; i < PALETTE_COLOR_COUNT; i++) {
      this.palette[i * 4 + 0] = (data[pos++] * PALETTE_MULTIPLIER) & 0xff;
      this.palette[i * 4 + 1] = (data[pos++] * PALETTE_MULTIPLIER) & 0xff;
      this.palette[i * 4 + 2] = (data[pos++] * PALETTE_MULTIPLIER) & 0xff;
      this.palette[i * 4 + 3] = 255;
    }
  }

  _readAudioStartFrame() {
    const reader = this.reader;
    const block = {
      unknown1: reader.readUInt16(),
      playbackRate: reader.readByte(),
      dataLength: 0,
    };
    block.dataLength = reader.readUInt16();
    this._audioBuffer = reader.readBytes(block.dataLength);

    if (block.playbackRate !== 166) throw new Error('VidFile: Unknown PlaybackRate encountered.');

    return block;
  }

  _readAudioIncrementalFrame() {
    const reader = this.reader;
    const block = { dataLength: reader.readUInt16() };
    this._audioBuffer = reader.readBytes(block.dataLength);

    return block;
  }

  _readVideoStartFrame() {
    this._lastDelay = this.reader.readUInt16();

    this._readVideoFullFrameData();
  }

  _readVideoRowOffsetFrame() {
    this._lastDelay = this.reader.readUInt16();
    const row = this.reader.readUInt16();

    this._readVideoPartialFrameData(row * this.frameWidth);
  }

  _readVideoIncrementalFrame() {
    this._lastDelay = this.reader.readUInt16();

    this._readVideoPartialFrameData(0);
  }

  /** Writes palette[index] at pixel pos, throwing past the end of the frame
   *  buffer as C#'s Color32[] indexer does (IndexOutOfRangeException). */
  _putPixel(pos, index) {
    if (pos < 0 || pos * 4 >= this._frameBuffer.length) {
      throw new Error('VidFile: frame buffer index out of range.');
    }
    const s = index * 4;
    const d = pos * 4;
    this._frameBuffer[d + 0] = this.palette[s + 0];
    this._frameBuffer[d + 1] = this.palette[s + 1];
    this._frameBuffer[d + 2] = this.palette[s + 2];
    this._frameBuffer[d + 3] = this.palette[s + 3];
  }

  _readVideoFullFrameData() {
    const reader = this.reader;
    const length = this._frameBuffer.length / 4;
    let pos = 0;
    let count = 0;
    while (pos < length) {
      let input = reader.readByte();
      if (input >= 0x80) {
        count = input - 0x80;
        input = reader.readByte();
        for (let i = 0; i < count; i++) {
          this._putPixel(pos++, input);
        }
      } else if (input === 0) {
        break;
      } else {
        count = input;
        for (let i = 0; i < count; i++) {
          const index = reader.readByte();
          this._putPixel(pos++, index);
        }
      }
    }
  }

  _readVideoPartialFrameData(pos) {
    const reader = this.reader;
    const length = this._frameBuffer.length / 4;
    let count = 0;
    while (pos < length) {
      const input = reader.readByte();
      if (input >= 0x80) {
        count = input - 0x80;
        pos += count;
      } else if (input === 0) {
        break;
      } else {
        count = input;
        for (let i = 0; i < count; i++) {
          const index = reader.readByte();
          this._putPixel(pos++, index);
        }
      }
    }
  }
}
