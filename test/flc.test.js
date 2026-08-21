// F1 - THE FLIC READER (API/FlcFile.cs), the port's ELEVENTH format
// reader (GFX was the ninth, VID the tenth). Daggerfall's .CEL
// animations are Autodesk FLICs, a different format from the .VID
// movies - which is why the U22 video reader could not stand in for
// the chargen constellations.
//
// No ARENA2 in CI, so the decoders are pinned over SYNTHETIC FLIC
// bytes built to the format spec (the same method the book reader
// uses), with a whole-corpus sweep gated on ARENA2_PATH below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { FlcFile, FLIC_FORMAT, CINEMATIC_SPEED, CHUNK_TYPE } from '../src/formats/flcFile.js';

const HEADER_SIZE = 128, FRAME_HEADER_SIZE = 16, CHUNK_HEADER_SIZE = 6;
const rgba = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

/** A minimal FLIC: one frame carrying the given sub-chunks. */
function buildFlc({ width = 4, height = 2, frameDelay = 100, frames = 1, chunks = [], fileID = FLIC_FORMAT.FLIC } = {}) {
  const body = [];
  for (const { type, payload } of chunks) {
    const head = new Uint8Array(CHUNK_HEADER_SIZE);
    const hv = new DataView(head.buffer);
    hv.setInt32(0, CHUNK_HEADER_SIZE + payload.length, true);
    hv.setInt16(4, type, true);
    body.push(head, Uint8Array.from(payload));
  }
  const chunkBytes = body.reduce((n, b) => n + b.length, 0);
  const frameSize = FRAME_HEADER_SIZE + chunkBytes;

  const out = new Uint8Array(HEADER_SIZE + frameSize);
  const v = new DataView(out.buffer);
  v.setInt32(0, out.length, true);          // FileSize
  v.setInt16(4, fileID, true);              // FileID
  v.setInt16(6, frames, true);              // NumOfFrames
  v.setInt16(8, width, true);
  v.setInt16(10, height, true);
  v.setInt16(12, 8, true);                  // PixelDepth -> 256 colours
  v.setInt16(14, 3, true);                  // Flags
  v.setInt32(16, frameDelay, true);         // FrameDelay (1/1000s)
  v.setInt32(80, HEADER_SIZE, true);        // Frame1Offset
  // the frame header
  let p = HEADER_SIZE;
  v.setInt32(p, frameSize, true);
  v.setInt16(p + 4, CHUNK_TYPE.FRAME_TYPE, true);
  v.setInt16(p + 6, chunks.length, true);
  p += FRAME_HEADER_SIZE;
  for (const b of body) { out.set(b, p); p += b.length; }
  return out;
}

/** COLOR_256 payload: one packet, `colors` RGB triples from index 0. */
const colorChunk = (colors) => {
  const out = [0x01, 0x00, 0x00, colors.length & 0xff];   // numPackets(i16), skip, count
  for (const [r, g, b] of colors) out.push(r, g, b);
  return out;
};

const PALETTE = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [8, 8, 8]];

test('flc: the header, the format magic and the frame delay', () => {
  const f = new FlcFile();
  assert.equal(f.load(buildFlc({ frameDelay: 250, chunks: [{ type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) }] }), 'ROGUE.CEL'), true);
  assert.equal(f.header.fileID, FLIC_FORMAT.FLIC);
  assert.equal(f.header.fileID, -20718, 'the magic reads SIGNED');
  assert.equal(f.width, 4);
  assert.equal(f.height, 2);
  assert.equal(f.colorCount, 256, '2^PixelDepth');
  assert.equal(f.frameDelay, 250 / CINEMATIC_SPEED.FLIC, 'the delay is 1/1000s for a FLIC');
  assert.equal(f.readyToPlay, true);
  // NumOfFrames + 1: the extra slot is the RING frame that loops back
  assert.equal(f.frameHeaders.length, 2);

  // Load() gates on the extension exactly as DFU does
  assert.equal(new FlcFile().load(buildFlc({}), 'ROGUE.VID'), false);
  assert.equal(new FlcFile().load(buildFlc({}), 'MAGE.FLC'), true);
  assert.equal(new FlcFile().load(buildFlc({}), 'anim.cel'), true, 'case-insensitive');
});

test('flc: COLOR_256 fills the palette, 0 means 256, and transparency blanks a match', () => {
  const f = new FlcFile();
  f.load(buildFlc({ chunks: [{ type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) }] }), 'X.CEL');
  assert.equal(f.palette[0], rgba(255, 0, 0));
  assert.equal(f.palette[1], rgba(0, 255, 0));
  assert.equal(f.palette[2], rgba(0, 0, 255));

  // A count byte of 0 means 256 entries (the format's own quirk)
  const all = [0x01, 0x00, 0x00, 0x00];
  for (let i = 0; i < 256; i++) all.push(i, 0, 0);
  const g = new FlcFile();
  g.load(buildFlc({ chunks: [{ type: CHUNK_TYPE.COLOR_256, payload: all }] }), 'X.CEL');
  assert.equal(g.palette[255], rgba(255, 0, 0), 'a zero count read all 256');

  // Transparency: the matching entry becomes fully transparent
  const t = new FlcFile();
  t.transparency = true;
  t.transparentRed = 0; t.transparentGreen = 255; t.transparentBlue = 0;
  t.load(buildFlc({ chunks: [{ type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) }] }), 'X.CEL');
  assert.equal(t.palette[1], rgba(0, 0, 0, 0));
  assert.equal(t.palette[0], rgba(255, 0, 0), 'only the match is blanked');
});

test('flc: BYTE_RUN decodes runs and literals, and the buffer is BOTTOM-UP', () => {
  // row 0: one pixel (index 0) repeated 4x; row 1: four literals 1,2,3,1
  const byteRun = [
    1, 4, 0,               // packets, size_type +4 (repeat), palette index 0
    1, (-4) & 0xff, 1, 2, 3, 1,   // packets, size_type -4 (literal), four indices
  ];
  const f = new FlcFile();
  f.load(buildFlc({
    chunks: [
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
      { type: CHUNK_TYPE.BYTE_RUN, payload: byteRun },
    ],
  }), 'X.CEL');

  const RED = rgba(255, 0, 0), GREEN = rgba(0, 255, 0), BLUE = rgba(0, 0, 255);
  // THE QUIRK: FLIC row 0 lands at the BOTTOM of the buffer
  assert.deepEqual([...f.frameBuffer], [GREEN, BLUE, rgba(8, 8, 8), GREEN, RED, RED, RED, RED]);
  // getFrame flips to the top-down shape every other reader produces
  assert.deepEqual([...f.getFrame().colors], [RED, RED, RED, RED, GREEN, BLUE, rgba(8, 8, 8), GREEN]);
  assert.deepEqual([...f.getFrame({ flip: false }).colors], [...f.frameBuffer]);
});

test('flc: DELTA_FLC applies a line of paired-pixel packets', () => {
  // A first frame paints everything index 0 (BYTE_RUN), then a delta
  // frame rewrites one line. DELTA_FLC works in PAIRS of pixels.
  const byteRun = [1, 4, 0, 1, 4, 0];
  const delta = [
    1, 0,                 // lineCount = 1
    1, 0,                 // opcode 1 -> packetCount = 1
    0, 2,                 // colSkip 0, size_type +2 -> copy 2 PAIRS
    1, 2, 3, 1,           // four palette indices
  ];
  const f = new FlcFile();
  f.load(buildFlc({
    chunks: [
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
      { type: CHUNK_TYPE.BYTE_RUN, payload: byteRun },
      { type: CHUNK_TYPE.DELTA_FLC, payload: delta },
    ],
  }), 'X.CEL');
  const RED = rgba(255, 0, 0), GREEN = rgba(0, 255, 0), BLUE = rgba(0, 0, 255);
  // The delta wrote FLIC row 0, which lives in the buffer's LAST row
  assert.deepEqual([...f.frameBuffer.slice(4)], [GREEN, BLUE, rgba(8, 8, 8), GREEN]);
  assert.deepEqual([...f.frameBuffer.slice(0, 4)], [RED, RED, RED, RED], 'row 1 untouched');
});

test('flc: a PSTAMP is skipped, and a bad frame type refuses to play', () => {
  const f = new FlcFile();
  f.load(buildFlc({
    chunks: [
      { type: CHUNK_TYPE.PSTAMP, payload: [9, 9, 9, 9] },   // a thumbnail: skipped whole
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
    ],
  }), 'X.CEL');
  assert.equal(f.readyToPlay, true);
  assert.equal(f.palette[0], rgba(255, 0, 0), 'the chunk after the thumbnail still decoded');

  // A frame header whose type is not a known chunk stops the read
  const bad = buildFlc({ chunks: [{ type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) }] });
  new DataView(bad.buffer).setInt16(HEADER_SIZE + 4, 12345, true);
  const g = new FlcFile();
  assert.equal(g.load(bad, 'X.CEL'), false);
  assert.equal(g.readyToPlay, false);
});

test('flc: ARENA2 corpus sweep - every .CEL decodes (gated)', (t) => {
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2 || !existsSync(arena2)) { t.skip('ARENA2_PATH not set'); return; }
  const cels = readdirSync(arena2).filter((f) => /\.CEL$/i.test(f));
  if (!cels.length) { t.skip('no .CEL files in ARENA2'); return; }
  for (const name of cels) {
    const f = new FlcFile();
    assert.equal(f.load(new Uint8Array(readFileSync(join(arena2, name))), name), true, `${name} loads`);
    assert.ok(f.width > 0 && f.height > 0, `${name} has dimensions`);
    assert.equal(f.frameBuffer.length, f.width * f.height);
    // Walk every frame; the ring frame wraps CurrentFrame back to 1
    for (let i = 0; i <= f.header.numOfFrames; i++) {
      assert.equal(f.bufferNextFrame(i), true, `${name} frame ${i} decodes`);
    }
  }
});
