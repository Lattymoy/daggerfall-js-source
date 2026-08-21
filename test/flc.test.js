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
import { FlcPlayer } from '../src/ui/flcPlayer.js';

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

test('flc: DELTA_FLC advances x by PAIRS, so the next packet lands right', () => {
  // AUDIT F-M10: the single-packet pin above could not see the pair
  // advance (`x += size_type * 2`) - nothing followed it. Two packets
  // on one line: the second's position is the first's advance.
  const byteRun = [1, 8, 0, 1, 8, 0];          // an 8x2 field of index 0
  const delta = [
    1, 0,                 // lineCount = 1
    2, 0,                 // packetCount = 2
    0, 1, 1, 2,           // colSkip 0, +1 pair -> indices 1,2 at x=0,1
    0, 1, 3, 1,           // colSkip 0, +1 pair -> indices 3,1 at x=2,3
  ];
  const f = new FlcFile();
  f.load(buildFlc({
    width: 8,
    chunks: [
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
      { type: CHUNK_TYPE.BYTE_RUN, payload: byteRun },
      { type: CHUNK_TYPE.DELTA_FLC, payload: delta },
    ],
  }), 'X.CEL');
  const RED = rgba(255, 0, 0), GREEN = rgba(0, 255, 0), BLUE = rgba(0, 0, 255), GREY = rgba(8, 8, 8);
  // FLIC row 0 is the buffer's LAST row (8 wide, 2 tall)
  assert.deepEqual([...f.frameBuffer.slice(8)], [GREEN, BLUE, GREY, GREEN, RED, RED, RED, RED]);
});

test('flc: an out-of-range pixel write THROWS rather than vanishing', () => {
  // AUDIT F-P1: C#'s Color32[] indexer throws IndexOutOfRangeException;
  // a JS typed array DROPS the write and lets a malformed chunk decode
  // "successfully". The VID reader already emulates this - so does the
  // FLIC reader now. Row 0 repeats 6 pixels across a 4-wide image.
  const f = new FlcFile();
  assert.throws(() => f.load(buildFlc({
    chunks: [
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
      { type: CHUNK_TYPE.BYTE_RUN, payload: [1, 6, 0, 1, 4, 0] },
    ],
  }), 'X.CEL'), /frame buffer index out of range/);
});

test('flc: an unfilled frame slot decodes EMPTY and still ADVANCES (C# value-type array)', () => {
  // AUDIT F-P2: C#'s FrameHeader[] is a VALUE-TYPE array, so a slot
  // the walk never filled is a DEFAULT struct - BufferNextFrame reads
  // zero sub-chunks from it and still advances CurrentFrame. A guard
  // that refused the slot instead STALLED the counter, so a
  // non-looping player never reached NumOfFrames and its OnAnimEnd
  // never fired - an animation that gates input would hang for ever.
  const f = new FlcFile();
  f.load(buildFlc({ frames: 3, chunks: [{ type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) }] }), 'X.CEL');
  assert.equal(f.frameHeaders.length, 4, 'NumOfFrames + the ring slot');
  const before = f.currentFrame;
  assert.equal(f.bufferNextFrame(), true, 'an unfilled slot still decodes');
  assert.equal(f.currentFrame, before + 1, 'and ADVANCES the counter');
  // Out of range falls back to the current frame rather than throwing
  assert.equal(f.bufferNextFrame(99), true);
  assert.equal(f.readyToPlay, true, 'the reader stays usable');
});

test('flcPlayer: the Update ORDER - end check first, display-then-decode, ring frame unseen', () => {
  // Three frames of one pixel each so the walk is countable.
  const px = (i) => [1, 1, i];   // packets, size_type +1 (repeat), palette index
  const f = new FlcFile();
  f.load(buildFlc({
    width: 1, height: 1, frames: 3,
    chunks: [
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
      { type: CHUNK_TYPE.BYTE_RUN, payload: px(0) },
    ],
  }), 'X.CEL');
  // The synthetic file carries ONE frame body, so the walk stops
  // early - what matters here is the PLAYER's law, which reads
  // currentFrame against numOfFrames.
  let ended = 0;
  const p = new FlcPlayer(f, { onAnimEnd: () => ended++ });
  assert.equal(p.frame, null, 'nothing is displayed before the first frame lands');
  assert.equal(p.start(), true);
  assert.equal(p.playing, true);

  // The clock gates: below the frame delay nothing is displayed
  p.tick(f.frameDelay / 2);
  assert.equal(p.frame, null, 'the frame clock gates the first frame');
  p.tick(f.frameDelay / 2);
  assert.ok(p.frame, 'the frame lands once the delay elapses');
  assert.equal(p.frame.width, 1);

  // Run it out: the END CHECK fires once currentFrame reaches
  // numOfFrames, and it raises exactly once.
  for (let i = 0; i < 20; i++) p.tick(f.frameDelay);
  assert.equal(ended, 1, 'OnAnimEnd raises exactly once');
  assert.equal(p.playing, false);

  // A stopped player displays nothing (DFU drops the texture)
  p.stop();
  assert.equal(p.frame, null);
});

test('flcPlayer: a looping player never ends, and start() rewinds', () => {
  const f = new FlcFile();
  f.load(buildFlc({
    width: 1, height: 1, frames: 3,
    chunks: [
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
      { type: CHUNK_TYPE.BYTE_RUN, payload: [1, 1, 0] },
    ],
  }), 'X.CEL');
  let ended = 0;
  const p = new FlcPlayer(f, { loop: true, onAnimEnd: () => ended++ });
  p.start();
  for (let i = 0; i < 30; i++) p.tick(f.frameDelay);
  assert.equal(ended, 0, 'Loop = true never raises the end');
  assert.equal(p.playing, true);
  // start() rewinds to frame 0 and clears what was displayed
  p.start();
  assert.equal(f.currentFrame, 0);
  assert.equal(p.frame, null);
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

test('flcPlayer: the END CHECK RUNS FIRST, and the frame shown is the PREVIOUSLY decoded one', () => {
  // AUDIT F2-T1: the old 20-tick loop proved "it ends eventually" and
  // hid both halves of Update()'s order. Step it one tick at a time.
  const pages = (i) => [1, 1, i];
  const f = new FlcFile();
  f.load(buildFlc({
    width: 1, height: 1, frames: 2,
    chunks: [
      { type: CHUNK_TYPE.COLOR_256, payload: colorChunk(PALETTE) },
      { type: CHUNK_TYPE.BYTE_RUN, payload: pages(1) },
    ],
  }), 'X.CEL');
  const ends = [];
  const p = new FlcPlayer(f, { onAnimEnd: () => ends.push(f.currentFrame) });
  p.start();
  assert.equal(f.currentFrame, 0, 'Start() rewinds to frame 0');

  // Tick 1: the clock opens, the CURRENT buffer is displayed, and only
  // THEN is the next frame decoded - so currentFrame moves to 1.
  p.tick(f.frameDelay);
  const first = p.frame;
  assert.ok(first, 'a frame is displayed');
  assert.equal(f.currentFrame, 1, 'display-then-decode: the counter advanced after showing');

  // Tick 2 reaches currentFrame === numOfFrames(2)... via one more decode
  p.tick(f.frameDelay);
  assert.equal(f.currentFrame, 2);
  assert.equal(ends.length, 0, 'the end has NOT fired on the tick that reached it');

  // Tick 3: the END CHECK RUNS FIRST, so it ends BEFORE any further
  // decode or display - the ring frame is never shown.
  const shown = p.frame;
  p.tick(f.frameDelay);
  assert.deepEqual(ends, [2], 'the end fires on the NEXT tick, from the check at the top');
  assert.equal(p.frame, shown, 'and nothing new was displayed on that tick');
  assert.equal(p.playing, false);
});
