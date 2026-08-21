import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  VidFile,
  VID_BLOCK_TYPES as T,
  VID_SAMPLE_RATE,
  VID_MIN_FRAME_DELAY,
} from '../src/formats/vidFile.js';
import { VideoPlayer, playVideo } from '../src/ui/videoPlayer.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];

/** 768-byte palette where entry i is (i, i, i) BEFORE the x4 multiplier. */
function rampPalette() {
  const out = [];
  for (let i = 0; i < 256; i++) out.push(i, i, i);
  return out;
}

function buildVid({
  magic = 'VID', unknown1 = 512, frameCount = 1, w = 4, h = 2,
  globalDelay = 4, unknown2 = 14, paletteType = T.Palette,
  paletteData = rampPalette(), blocks = [],
} = {}) {
  const out = [];
  for (const c of magic) out.push(c.charCodeAt(0));
  out.push(...u16(unknown1), ...u16(frameCount), ...u16(w), ...u16(h), ...u16(globalDelay), ...u16(unknown2));
  out.push(paletteType, ...paletteData);
  for (const b of blocks) out.push(...b);
  return new Uint8Array(out);
}

const audioStart = (data, rate = 166) => [T.Audio_StartFrame, ...u16(0), rate, ...u16(data.length), ...data];
const audioInc = (data) => [T.Audio_IncrementalFrame, ...u16(data.length), ...data];
const videoStart = (delay, rle) => [T.Video_StartFrame, ...u16(delay), ...rle];
const videoInc = (delay, rle) => [T.Video_IncrementalFrame, ...u16(delay), ...rle];
const videoRow = (delay, row, rle) => [T.Video_IncrementalRowOffsetFrame, ...u16(delay), ...u16(row), ...rle];
const nullBlock = () => [T.Null];
const eof = () => [T.EndOfFile];
const silence = (n) => new Array(n).fill(128);

/** Palette index of every pixel, recovered from the red channel (index*4). */
const indices = (v) => {
  const out = [];
  for (let i = 0; i < v.frameBuffer.length; i += 4) out.push(v.frameBuffer[i] / 4);
  return out;
};

function fnv1a(buf, h = 0x811c9dc5) {
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Reads to end of file, returning everything the pins care about. */
function sweep(bytes) {
  const v = new VidFile();
  assert.equal(v.open(bytes), true);
  const o = {
    w: v.frameWidth, h: v.frameHeight, frameCount: v.frameCount,
    globalDelay: v.header.globalDelay, blocks: 0, nulls: 0, currentBlock: 0,
    start: 0, inc: 0, rowoff: 0, astart: 0, ainc: 0,
    frameHash: 0, audioHash: 0, audioBytes: 0, minAudio: Infinity,
    lastDelay: 0, minDelay: Infinity, maxDelay: 0, endPos: 0, frames: 0,
  };
  let fh = 0x811c9dc5;
  let ah = 0x811c9dc5;
  while (!v.endOfFile) {
    const before = v.streamPosition;
    v.readNextBlock();
    // Every block a healthy reader reads consumes at least its type byte; a
    // stall here is DFU's swallowed-exception loop, which no real .VID hits.
    assert.ok(v.streamPosition > before, `reader stalled at ${before} on block ${o.blocks}`);
    assert.ok(o.blocks < 5000, 'runaway block count');
    o.blocks++;
    const t = v.lastBlockType;
    if (t === T.Null) o.nulls++;
    if (t === T.Video_StartFrame) o.start++;
    if (t === T.Video_IncrementalFrame) o.inc++;
    if (t === T.Video_IncrementalRowOffsetFrame) o.rowoff++;
    if (t === T.Audio_StartFrame) o.astart++;
    if (t === T.Audio_IncrementalFrame) o.ainc++;
    if (t === T.Video_StartFrame || t === T.Video_IncrementalFrame || t === T.Video_IncrementalRowOffsetFrame) {
      o.frames++;
      fh = fnv1a(v.frameBuffer, fh);
    }
    if (t === T.Audio_StartFrame || t === T.Audio_IncrementalFrame) {
      o.audioBytes += v.audioBuffer.length;
      o.minAudio = Math.min(o.minAudio, v.audioBuffer.length);
      ah = fnv1a(v.audioBuffer, ah);
    }
    if (t !== T.Null) {
      o.minDelay = Math.min(o.minDelay, v.frameDelay);
      o.maxDelay = Math.max(o.maxDelay, v.frameDelay);
    }
  }
  o.frameHash = fh;
  o.audioHash = ah;
  o.lastDelay = v.lastDelay;
  o.currentBlock = v.currentBlock;
  o.endPos = v.streamPosition;
  return o;
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('vid: header, palette x4 and frame buffer sizing', () => {
  const v = new VidFile();
  assert.equal(v.open(buildVid({ frameCount: 7, w: 320, h: 200, globalDelay: 6 })), true);

  assert.deepEqual(v.header, {
    vid: 'VID', unknown1: 512, frameCount: 7, frameWidth: 320,
    frameHeight: 200, globalDelay: 6, unknown2: 14,
  });
  assert.equal(v.frameCount, 7);
  assert.equal(v.frameWidth, 320);
  assert.equal(v.frameHeight, 200);
  assert.equal(v.sampleRate, 11025);
  assert.equal(VID_SAMPLE_RATE, 11025);
  assert.equal(VID_MIN_FRAME_DELAY, 740 / 11025);
  assert.equal(v.frameBuffer.length, 320 * 200 * 4);
  assert.equal(v.streamPosition, 3 + 12 + 1 + 768);   // header + palette block

  // Palette is the raw 6-bit component x4, truncated to a byte.
  assert.deepEqual(Array.from(v.palette.subarray(0, 4)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(v.palette.subarray(4, 8)), [4, 4, 4, 255]);
  assert.deepEqual(Array.from(v.palette.subarray(63 * 4, 63 * 4 + 4)), [252, 252, 252, 255]);
  assert.deepEqual(Array.from(v.palette.subarray(64 * 4, 64 * 4 + 4)), [0, 0, 0, 255]); // 64*4 = 256 -> 0
  assert.deepEqual(Array.from(v.palette.subarray(255 * 4, 255 * 4 + 4)), [252, 252, 252, 255]);

  // Both header guards throw out of open(), as DFU's ReadHeader/ReadPalette do.
  assert.throws(() => new VidFile().open(buildVid({ magic: 'VIX' })), /Invalid VID header/);
  assert.throws(() => new VidFile().open(buildVid({ paletteType: 3 })), /Palette block not encountered/);
  assert.equal(new VidFile().open(new Uint8Array(0)), false);
});

test('vid: full frame RLE - runs, literals and the zero terminator', () => {
  // 4x2. Run of 3 index 5, literal 3 (7,8,9), run of 2 index 1.
  const v = new VidFile();
  v.open(buildVid({
    w: 4, h: 2,
    blocks: [audioStart(silence(740)), videoStart(11, [0x80 + 3, 5, 3, 7, 8, 9, 0x80 + 2, 1]), eof()],
  }));
  v.readNextBlock();
  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Video_StartFrame);
  assert.equal(v.lastDelay, 11);
  assert.deepEqual(indices(v), [5, 5, 5, 7, 8, 9, 1, 1]);

  // A zero byte ends the frame early, leaving the rest of the buffer alone.
  const w = new VidFile();
  w.open(buildVid({
    w: 4, h: 2,
    blocks: [
      audioStart(silence(740)),
      videoStart(1, [0x80 + 8, 9]),
      // The trailing literal run is DEAD: the 0 ends the frame before it.
      videoStart(2, [2, 1, 2, 0, 2, 7, 8]),
      eof(),
    ],
  }));
  w.readNextBlock();
  w.readNextBlock();
  assert.deepEqual(indices(w), [9, 9, 9, 9, 9, 9, 9, 9]);
  const posBefore = w.streamPosition;
  w.readNextBlock();
  assert.deepEqual(indices(w), [1, 2, 9, 9, 9, 9, 9, 9]);
  // ... and the block stops just PAST the zero: 1 type + 2 delay + 4 data
  // bytes (the count, its two literals, the terminator).
  assert.equal(w.streamPosition, posBefore + 7);
});

test('vid: incremental frames skip runs instead of filling them', () => {
  const v = new VidFile();
  v.open(buildVid({
    w: 4, h: 2,
    blocks: [
      audioStart(silence(740)),
      videoStart(1, [0x80 + 8, 9]),
      // skip 2, write 3 literals, skip 1, write 2 literals
      videoInc(2, [0x80 + 2, 3, 4, 5, 6, 0x80 + 1, 2, 7, 8]),
      eof(),
    ],
  }));
  v.readNextBlock();
  v.readNextBlock();
  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Video_IncrementalFrame);
  assert.deepEqual(indices(v), [9, 9, 4, 5, 6, 9, 7, 8]);
});

test('vid: row offset frame starts at row * frameWidth', () => {
  const v = new VidFile();
  v.open(buildVid({
    w: 4, h: 3,
    blocks: [
      audioStart(silence(740)),
      videoStart(1, [0x80 + 12, 9]),
      videoRow(2, 2, [2, 3, 4]),
      eof(),
    ],
  }));
  v.readNextBlock();
  v.readNextBlock();
  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Video_IncrementalRowOffsetFrame);
  assert.deepEqual(indices(v), [9, 9, 9, 9, 9, 9, 9, 9, 3, 4, 9, 9]);
});

test('vid: frame delay is the audio buffer length, clamped to 740 samples', () => {
  const v = new VidFile();
  v.open(buildVid({
    blocks: [
      audioStart(silence(1110)),
      videoStart(1, [0x80 + 8, 9]),
      audioInc(silence(24)),
      videoStart(2, [0x80 + 8, 8]),
      eof(),
    ],
  }));

  v.readNextBlock();
  assert.equal(v.frameDelay, 1110 / 11025);
  // A video block recomputes the delay from the LAST audio buffer (DFU quirk).
  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Video_StartFrame);
  assert.equal(v.frameDelay, 1110 / 11025);
  // 24 samples would be 0.0021s; the 740-sample floor holds it back.
  v.readNextBlock();
  assert.equal(v.audioBuffer.length, 24);
  assert.equal(v.frameDelay, 740 / 11025);
  v.readNextBlock();
  assert.equal(v.frameDelay, 740 / 11025);
});

test('vid: a video block before any audio block throws (DFU null audioBuffer)', () => {
  const v = new VidFile();
  v.open(buildVid({ blocks: [videoStart(1, [0x80 + 8, 9]), eof()] }));
  assert.equal(v.audioBuffer, null);
  assert.throws(() => v.readNextBlock(), TypeError);
  // The frame itself decoded before the throw.
  assert.deepEqual(indices(v), [9, 9, 9, 9, 9, 9, 9, 9]);
});

test('vid: null blocks advance one byte and are not counted', () => {
  const v = new VidFile();
  v.open(buildVid({ blocks: [audioStart(silence(925)), nullBlock(), videoStart(1, [0x80 + 8, 9]), eof()] }));
  v.readNextBlock();
  const pos = v.streamPosition;
  const block = v.currentBlock;
  const delay = v.frameDelay;

  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Null);
  assert.equal(v.streamPosition, pos + 1);
  assert.equal(v.currentBlock, block);        // null blocks do not count
  assert.equal(v.frameDelay, delay);          // and do not recompute the delay
});

test('vid: a bad block type parks the reader in place forever', () => {
  const v = new VidFile();
  v.open(buildVid({ blocks: [[99, 1, 2, 3], eof()] }));
  const pos = v.streamPosition;
  v.readNextBlock();
  assert.equal(v.lastBlockType, 99);
  assert.equal(v.streamPosition, pos);        // catch returns WITHOUT advancing
  assert.equal(v.currentBlock, 0);
  v.readNextBlock();
  assert.equal(v.streamPosition, pos);        // ... and reads the same byte again
  assert.equal(v.currentBlock, 0);
  assert.equal(v.endOfFile, false);
});

test('vid: Audio_StartFrame keeps its buffer even when PlaybackRate is rejected', () => {
  const v = new VidFile();
  v.open(buildVid({ blocks: [audioStart([1, 2, 3, 4], 167), eof()] }));
  const pos = v.streamPosition;
  v.readNextBlock();
  // The data was consumed into audioBuffer BEFORE the rate check threw.
  assert.deepEqual(Array.from(v.audioBuffer), [1, 2, 3, 4]);
  assert.equal(v.streamPosition, pos);
  assert.equal(v.currentBlock, 0);
  assert.equal(v.frameDelay, 0);              // never reached the delay maths
});

test('vid: a mid-stream palette block desyncs the stream (skip is clobbered)', () => {
  const paletteBlock = [T.Palette, ...rampPalette()];
  const v = new VidFile();
  v.open(buildVid({ blocks: [audioStart(silence(740)), paletteBlock, eof()] }));
  v.readNextBlock();
  const pos = v.streamPosition;

  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Palette);
  // streamPosition += 768 is overwritten by streamPosition = stream position,
  // so the extra palette is NOT skipped - only its type byte is consumed.
  assert.equal(v.streamPosition, pos + 1);
  assert.equal(v.currentBlock, 2);

  // Proof of the desync: the next "block type" is the first palette byte (0).
  v.readNextBlock();
  assert.equal(v.lastBlockType, 0);
});

test('vid: a frame buffer overrun aborts the block mid-write', () => {
  // 4x2 = 8 pixels; 4 literals then a run of 8 walks off the end.
  const v = new VidFile();
  v.open(buildVid({
    w: 4, h: 2,
    blocks: [audioStart(silence(740)), videoStart(1, [4, 1, 2, 3, 4, 0x80 + 8, 9]), eof()],
  }));
  v.readNextBlock();
  const pos = v.streamPosition;
  const block = v.currentBlock;

  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Video_StartFrame);
  assert.deepEqual(indices(v), [1, 2, 3, 4, 9, 9, 9, 9]);   // wrote up to the end
  assert.equal(v.streamPosition, pos);                       // then threw: no advance
  assert.equal(v.currentBlock, block);
});

test('vid: EndOfFile latches and later reads are inert', () => {
  const v = new VidFile();
  v.open(buildVid({ blocks: [audioStart(silence(740)), eof()] }));
  v.readNextBlock();
  v.readNextBlock();
  assert.equal(v.lastBlockType, T.EndOfFile);
  assert.equal(v.endOfFile, true);
  assert.equal(v.currentBlock, 2);            // the EOF block itself counts
  const pos = v.streamPosition;
  v.readNextBlock();
  assert.equal(v.currentBlock, 2);
  assert.equal(v.streamPosition, pos);
  assert.equal(v.lastBlockType, T.EndOfFile);
});

// ---------------------------------------------------------------------------
// Player - always run (synthetic renderer, injected clock).
// ---------------------------------------------------------------------------

function stubRenderer() {
  return {
    uploads: [], releases: [], quads: [],
    uploadTexture(archive, record, color32) {
      this.uploads.push({ archive, record, width: color32.width, height: color32.height, colors: color32.colors });
      return { archive, record, n: this.uploads.length };
    },
    releaseTexture(archive, record) { this.releases.push(`${archive}_${record}`); return true; },
    drawScreenQuad(tex, rect) { this.quads.push({ tex, rect }); },
  };
}

function stubAudioContext() {
  const ctx = {
    currentTime: 0, started: [], buffers: [], gains: [],
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      const buf = { channels, length, rate, getChannelData: () => data };
      ctx.buffers.push(buf);
      return buf;
    },
    createBufferSource() {
      const src = { buffer: null, connect: (n) => n, start: (when) => ctx.started.push(when) };
      return src;
    },
    createGain() { const g = { gain: { value: 0 }, connect: (n) => n }; ctx.gains.push(g); return g; },
    destination: {},
  };
  return ctx;
}

const playerVid = () => buildVid({
  w: 4, h: 2, frameCount: 3,
  blocks: [
    audioStart(silence(740)), videoStart(1, [0x80 + 8, 1]),
    audioInc(silence(740)), videoStart(2, [0x80 + 8, 2]),
    audioInc(silence(740)), videoStart(3, [0x80 + 8, 3]),
    eof(),
  ],
});

test('video player: one block per update, gated by time + frameDelay', () => {
  const renderer = stubRenderer();
  let clock = 0;
  const p = new VideoPlayer({ renderer, now: () => clock, audioContext: () => null });
  assert.equal(p.play(playerVid()), true);

  // Frozen clock: audio (advances nextEventTime by 740/11025), then video
  // (rides the same interval because the last block was audio), then the next
  // audio - and there the gate closes.
  for (let i = 0; i < 10; i++) p.update();
  assert.equal(p.vidFile.currentBlock, 3);
  assert.equal(renderer.uploads.length, 1);

  // One frame delay of clock is one more audio+video pair.
  clock = 740 / 11025;
  for (let i = 0; i < 10; i++) p.update();
  assert.equal(p.vidFile.currentBlock, 5);
  assert.equal(renderer.uploads.length, 2);

  clock = 10;
  for (let i = 0; i < 10; i++) p.update();
  assert.equal(p.endOfFile, true);
  assert.equal(renderer.uploads.length, 3);
  assert.equal(p.vidFile.currentBlock, 7);
});

test('video player: a null block is skipped inside the same update', () => {
  const renderer = stubRenderer();
  const p = new VideoPlayer({ renderer, now: () => 0, audioContext: () => null });
  p.play(buildVid({
    w: 4, h: 2,
    blocks: [audioStart(silence(740)), nullBlock(), videoStart(1, [0x80 + 8, 5]), eof()],
  }));

  p.update();                                  // audio
  assert.equal(renderer.uploads.length, 0);
  p.update();                                  // null + video, one update
  assert.equal(p.vidFile.lastBlockType, T.Video_StartFrame);
  assert.equal(renderer.uploads.length, 1);
});

test('video player: frames replace one texture instead of leaking keys', () => {
  const renderer = stubRenderer();
  let clock = 0;
  const p = new VideoPlayer({ renderer, now: () => clock, audioContext: () => null, textureKey: 'k' });
  p.play(playerVid());
  for (let i = 0; i < 4; i++) { p.update(); clock += 1; }

  assert.equal(renderer.uploads.length, 2);
  assert.deepEqual(renderer.uploads.map((u) => u.record), ['k', 'k']);
  assert.deepEqual(renderer.uploads.map((u) => [u.width, u.height]), [[4, 2], [4, 2]]);
  assert.deepEqual(renderer.releases, ['vid_k', 'vid_k']);

  // Drawing puts the frame over the whole 320x200 panel.
  const m = { s: 3, ox: 7, oy: 11 };
  assert.equal(p.draw(m), true);
  assert.deepEqual(renderer.quads.at(-1).rect, { x: 7, y: 11, w: 960, h: 600 });

  p.dispose();
  assert.equal(p.playing, false);
  assert.equal(p.draw(m), false);
});

test('video player: audio clips are padded, signed and scheduled at nextEventTime', () => {
  const renderer = stubRenderer();
  const ctx = stubAudioContext();
  const p = new VideoPlayer({ renderer, now: () => 0, audioContext: () => ctx, soundVolume: 1 });
  p.play(buildVid({
    w: 4, h: 2,
    blocks: [audioStart([0, 128, 255, ...silence(737)]), videoStart(1, [0x80 + 8, 1]), audioInc(silence(740)), eof()],
  }));

  p.update();
  assert.equal(ctx.buffers.length, 1);
  const buf = ctx.buffers[0];
  assert.equal(buf.channels, 1);
  assert.equal(buf.length, 742);               // 740 + one empty sample each end
  assert.equal(buf.rate, 11025);
  const d = buf.getChannelData(0);
  assert.equal(d[0], 0);                       // leading pad
  assert.equal(d[741], 0);                     // trailing pad
  assert.equal(d[1], -1);                      // (0 - 128) / 128
  assert.equal(d[2], 0);                       // (128 - 128) / 128
  assert.equal(d[3], (255 - 128) / 128);
  // Scheduled at the nextEventTime the block INHERITED, before it advanced.
  assert.deepEqual(ctx.started, [0]);

  p.update();                                  // video: no new clip
  assert.equal(ctx.buffers.length, 1);
  p.update();                                  // second audio block
  assert.deepEqual(ctx.started, [0, 740 / 11025]);
});

test('video player: a suspended AudioContext is not the clock and gets no clips', () => {
  // Autoplay policy: a repeat visit boots with the context created but
  // SUSPENDED (no gesture yet), and its currentTime is pinned at 0.
  // Pacing on that frozen clock closed the gate after one frame - and
  // ANIM0001's first frame is solid black, so the splash froze black
  // until the dismiss click. A non-running context is treated as absent:
  // wall clock, silent playback. A stub with no state field still counts
  // as running (every other test in this file).
  const renderer = stubRenderer();
  const ctx = stubAudioContext();
  ctx.state = 'suspended';
  let clock = 0;
  const p = new VideoPlayer({ renderer, now: () => clock, audioContext: () => ctx });
  assert.equal(p._ctx, null, 'a non-running context is treated as absent');
  p.play(playerVid());
  for (let i = 0; i < 10; i++) { p.update(); clock += 740 / 11025; }
  assert.equal(p.endOfFile, true, 'playback runs to EOF on the injected clock');
  assert.equal(ctx.started.length, 0, 'no clip is scheduled against a frozen clock');
  assert.equal(renderer.uploads.length, 3, 'every video frame still draws');
});

test('video player: shouldClose follows DaggerfallVidPlayerWindow', () => {
  const p = new VideoPlayer({ renderer: stubRenderer(), now: () => 0, audioContext: () => null });
  p.play(buildVid({ blocks: [audioStart(silence(740)), eof()] }));
  assert.equal(p.shouldClose(false), false);
  assert.equal(p.shouldClose(true), true);            // end on any key
  assert.equal(p.shouldClose(true, false), false);    // ... unless disabled
  p.update();
  p.update();
  assert.equal(p.endOfFile, true);
  assert.equal(p.shouldClose(false), true);
});

test('video player: playVideo owns the frame loop until the video ends', async () => {
  const renderer = stubRenderer();
  renderer.beginFrame = function () { this.frames = (this.frames || 0) + 1; };
  const canvas = { width: 640, height: 400 };
  let clock = 0;
  let detached = 0;
  let press = null;
  let frames = 0;
  // The pump is capped: playVideo owns the loop, so a reader that stalled
  // would otherwise spin here forever instead of failing.
  const pump = (fn) => {
    clock += 1 / 60;
    assert.ok(++frames < 500, 'playVideo never finished');
    queueMicrotask(fn);
  };
  const opts = {
    now: () => clock,
    audioContext: () => null,
    raf: pump,
    listen: (onAnyKey) => { press = onAnyKey; return () => { detached++; }; },
  };

  assert.equal(await playVideo(canvas, renderer, playerVid(), opts), true);
  assert.equal(renderer.uploads.length, 3);       // every video block drawn
  assert.equal(detached, 1);                      // the key watch is released
  assert.ok(renderer.frames > 3);
  // Drawn over the whole panel: 640x400 is a clean x2 of 320x200.
  assert.deepEqual(renderer.quads.at(-1).rect, { x: 0, y: 0, w: 640, h: 400 });

  // Any key ends it on the very next frame (DaggerfallVidPlayerWindow).
  const r2 = stubRenderer();
  r2.beginFrame = () => {};
  let pressed = false;
  clock = 0;
  await playVideo(canvas, r2, playerVid(), {
    ...opts,
    raf: (fn) => { clock += 1 / 60; if (!pressed) { pressed = true; press(); } queueMicrotask(fn); },
    listen: (onAnyKey) => { press = onAnyKey; return () => {}; },
  });
  assert.equal(r2.uploads.length, 0, 'closed before any video block landed');

  // Bytes that do not open resolve false instead of looping on a dead file.
  assert.equal(await playVideo(canvas, stubRenderer(), new Uint8Array(0), opts), false);
});

// ---------------------------------------------------------------------------
// Real data - the whole .VID corpus.
// ---------------------------------------------------------------------------

// Observed on ARENA2 (17 files). frameHash is FNV-1a chained over the RGBA
// frame buffer after every video block; audioHash the same over every audio
// buffer. `endPos` is pinned to the file size: a decoder that desynced by one
// byte anywhere could not land exactly on the last byte of the file.
const PINS = [
  { name: 'ANIM0000.VID', w: 320, h: 200, frameCount: 633, globalDelay: 4, blocks: 1234, nulls: 0, currentBlock: 1234, start: 1, inc: 0, rowoff: 632, astart: 1, ainc: 599, frameHash: 0xdbe3ada9, audioHash: 0xcda26a93, audioBytes: 475054, minAudio: 159, lastDelay: 1, size: 6849174 },
  { name: 'ANIM0001.VID', w: 320, h: 200, frameCount: 190, globalDelay: 4, blocks: 368, nulls: 0, currentBlock: 368, start: 1, inc: 3, rowoff: 186, astart: 3, ainc: 174, frameHash: 0x9a35cc5d, audioHash: 0x78cafa22, audioBytes: 138655, minAudio: 35, lastDelay: 0, size: 1430898 },
  { name: 'ANIM0002.VID', w: 320, h: 200, frameCount: 47, globalDelay: 4, blocks: 95, nulls: 0, currentBlock: 95, start: 1, inc: 0, rowoff: 46, astart: 1, ainc: 46, frameHash: 0x46c4fee9, audioHash: 0x07a81d8d, audioBytes: 59940, minAudio: 740, lastDelay: 0, size: 1301400 },
  { name: 'ANIM0003.VID', w: 320, h: 200, frameCount: 207, globalDelay: 4, blocks: 415, nulls: 0, currentBlock: 415, start: 1, inc: 0, rowoff: 206, astart: 1, ainc: 206, frameHash: 0xd37a53d1, audioHash: 0xd5b63570, audioBytes: 157620, minAudio: 740, lastDelay: 0, size: 4758737 },
  { name: 'ANIM0004.VID', w: 320, h: 200, frameCount: 77, globalDelay: 7, blocks: 146, nulls: 0, currentBlock: 146, start: 1, inc: 0, rowoff: 76, astart: 1, ainc: 67, frameHash: 0x877ff3b9, audioHash: 0x8dbb4cef, audioBytes: 95302, minAudio: 767, lastDelay: 0, size: 1355971 },
  { name: 'ANIM0005.VID', w: 320, h: 200, frameCount: 590, globalDelay: 4, blocks: 1126, nulls: 0, currentBlock: 1126, start: 1, inc: 0, rowoff: 589, astart: 1, ainc: 534, frameHash: 0xa6eab751, audioHash: 0xed058624, audioBytes: 456049, minAudio: 24, lastDelay: 0, size: 18004713 },
  { name: 'ANIM0006.VID', w: 320, h: 200, frameCount: 204, globalDelay: 5, blocks: 409, nulls: 0, currentBlock: 409, start: 1, inc: 0, rowoff: 203, astart: 1, ainc: 203, frameHash: 0x16410055, audioHash: 0x9c8be116, audioBytes: 188700, minAudio: 925, lastDelay: 0, size: 5182490 },
  { name: 'ANIM0007.VID', w: 320, h: 200, frameCount: 138, globalDelay: 7, blocks: 277, nulls: 0, currentBlock: 277, start: 1, inc: 137, rowoff: 0, astart: 1, ainc: 137, frameHash: 0x00e61401, audioHash: 0xe7e1c876, audioBytes: 178710, minAudio: 1295, lastDelay: 0, size: 3312499 },
  { name: 'ANIM0008.VID', w: 320, h: 200, frameCount: 240, globalDelay: 5, blocks: 476, nulls: 0, currentBlock: 476, start: 1, inc: 239, rowoff: 0, astart: 1, ainc: 234, frameHash: 0xc4f974e5, audioHash: 0x6014b1f5, audioBytes: 216666, minAudio: 216, lastDelay: 0, size: 5492487 },
  { name: 'ANIM0009.VID', w: 320, h: 200, frameCount: 200, globalDelay: 6, blocks: 388, nulls: 1, currentBlock: 387, start: 1, inc: 199, rowoff: 0, astart: 1, ainc: 185, frameHash: 0x97d33621, audioHash: 0x7ffd935c, audioBytes: 205375, minAudio: 25, lastDelay: 0, size: 2428656 },
  { name: 'ANIM0010.VID', w: 320, h: 200, frameCount: 197, globalDelay: 4, blocks: 363, nulls: 0, currentBlock: 363, start: 1, inc: 196, rowoff: 0, astart: 1, ainc: 164, frameHash: 0xc99644a5, audioHash: 0xe3a4d7cc, audioBytes: 140112, minAudio: 67, lastDelay: 0, size: 3227869 },
  { name: 'ANIM0011.VID', w: 320, h: 200, frameCount: 35, globalDelay: 5, blocks: 63, nulls: 0, currentBlock: 63, start: 1, inc: 0, rowoff: 34, astart: 1, ainc: 26, frameHash: 0x51f52655, audioHash: 0x5dc2ec7b, audioBytes: 55297, minAudio: 722, lastDelay: 20, size: 98343 },
  { name: 'ANIM0012.VID', w: 320, h: 200, frameCount: 130, globalDelay: 6, blocks: 261, nulls: 0, currentBlock: 261, start: 1, inc: 0, rowoff: 129, astart: 1, ainc: 129, frameHash: 0xfae400ad, audioHash: 0xfce11f2d, audioBytes: 165390, minAudio: 1110, lastDelay: 18, size: 2953162 },
  { name: 'ANIM0013.VID', w: 320, h: 200, frameCount: 151, globalDelay: 5, blocks: 303, nulls: 0, currentBlock: 303, start: 1, inc: 0, rowoff: 150, astart: 1, ainc: 150, frameHash: 0x915dbbc9, audioHash: 0xd50b1272, audioBytes: 139675, minAudio: 925, lastDelay: 0, size: 1669463 },
  { name: 'ANIM0014.VID', w: 320, h: 200, frameCount: 218, globalDelay: 4, blocks: 427, nulls: 0, currentBlock: 427, start: 1, inc: 217, rowoff: 0, astart: 1, ainc: 207, frameHash: 0x6db7264d, audioHash: 0x09e30f31, audioBytes: 177525, minAudio: 665, lastDelay: 0, size: 2325779 },
  { name: 'ANIM0015.VID', w: 320, h: 200, frameCount: 240, globalDelay: 5, blocks: 481, nulls: 0, currentBlock: 481, start: 1, inc: 239, rowoff: 0, astart: 1, ainc: 239, frameHash: 0x996f41cd, audioHash: 0xdbbb1dba, audioBytes: 242165, minAudio: 925, lastDelay: 0, size: 6115733 },
  { name: 'DAG2.VID', w: 256, h: 200, frameCount: 1164, globalDelay: 6, blocks: 2412, nulls: 83, currentBlock: 2329, start: 1, inc: 1094, rowoff: 69, astart: 1, ainc: 1163, frameHash: 0xbcac4f6d, audioHash: 0x5dcd0f85, audioBytes: 1340176, minAudio: 1110, lastDelay: 56, size: 19685242 },
];

test('vid: every .VID in ARENA2 decodes to its pinned frames', { skip: skipReal }, () => {
  const files = readdirSync(ARENA2).filter((f) => f.toUpperCase().endsWith('.VID')).sort();
  assert.equal(files.length, 17);
  assert.deepEqual(files, PINS.map((p) => p.name));

  for (const pin of PINS) {
    const bytes = new Uint8Array(readFileSync(join(ARENA2, pin.name)));
    assert.equal(bytes.length, pin.size, pin.name);
    const o = sweep(bytes);

    // Every file announces its frame count in the header and delivers exactly
    // that many video blocks; every file ends on an EndOfFile block having
    // consumed the whole file.
    assert.equal(o.frames, pin.frameCount, `${pin.name} frames`);
    assert.equal(o.start + o.inc + o.rowoff, pin.frameCount, `${pin.name} video blocks`);
    assert.equal(o.endPos, pin.size, `${pin.name} endPos`);
    assert.equal(o.blocks - o.nulls, o.currentBlock, `${pin.name} counted blocks`);

    assert.deepEqual({
      w: o.w, h: o.h, frameCount: o.frameCount, globalDelay: o.globalDelay,
      blocks: o.blocks, nulls: o.nulls, currentBlock: o.currentBlock,
      start: o.start, inc: o.inc, rowoff: o.rowoff, astart: o.astart, ainc: o.ainc,
      frameHash: o.frameHash, audioHash: o.audioHash,
      audioBytes: o.audioBytes, minAudio: o.minAudio, lastDelay: o.lastDelay,
    }, {
      w: pin.w, h: pin.h, frameCount: pin.frameCount, globalDelay: pin.globalDelay,
      blocks: pin.blocks, nulls: pin.nulls, currentBlock: pin.currentBlock,
      start: pin.start, inc: pin.inc, rowoff: pin.rowoff, astart: pin.astart, ainc: pin.ainc,
      frameHash: pin.frameHash, audioHash: pin.audioHash,
      audioBytes: pin.audioBytes, minAudio: pin.minAudio, lastDelay: pin.lastDelay,
    }, pin.name);

    // The 740-sample floor: it is engaged on exactly the files whose shortest
    // audio block is under 740 bytes, and never lets a delay below it through.
    assert.ok(o.minDelay >= 740 / 11025, `${pin.name} minDelay floor`);
    if (pin.minAudio < 740) assert.equal(o.minDelay, 740 / 11025, `${pin.name} clamped`);
    else assert.equal(o.minDelay, pin.minAudio / 11025, `${pin.name} unclamped`);
  }
});

test('vid: ANIM0001 is the splash, ANIM0012 the death video', { skip: skipReal }, () => {
  // DaggerfallUI.cs:49-50 - the two files the port needs by name.
  for (const name of ['ANIM0001.VID', 'ANIM0012.VID']) {
    const v = new VidFile();
    assert.equal(v.open(new Uint8Array(readFileSync(join(ARENA2, name)))), true);
    assert.equal(v.frameWidth, 320);
    assert.equal(v.frameHeight, 200);
    assert.equal(v.frameBuffer.length, 320 * 200 * 4);
  }

  // The splash opens on audio, so it never hits the null-audioBuffer throw,
  // and its first video block is a full frame.
  const v = new VidFile();
  v.open(new Uint8Array(readFileSync(join(ARENA2, 'ANIM0001.VID'))));
  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Audio_StartFrame);
  assert.equal(v.audioBuffer.length, 740);
  assert.equal(v.frameDelay, 740 / 11025);
  v.readNextBlock();
  assert.equal(v.lastBlockType, T.Video_StartFrame);
  // Frame 1 of the splash is solid palette index 0 (black) - the logo fades up.
  assert.equal(v.frameBuffer.every((b, i) => (i % 4 === 3 ? b === 255 : b === 0)), true);
});

test('video player: drives ANIM0001 to the last frame', { skip: skipReal }, () => {
  const renderer = stubRenderer();
  let clock = 0;
  const p = new VideoPlayer({ renderer, now: () => clock, audioContext: () => null });
  assert.equal(p.play(new Uint8Array(readFileSync(join(ARENA2, 'ANIM0001.VID')))), true);

  // 60 Hz host loop, wall clock: the player must reach the end of a 190-frame
  // video inside its own running time (~13.6 s) and upload one texture per
  // video block.
  let updates = 0;
  while (!p.endOfFile && updates < 60 * 60) {
    p.update();
    clock += 1 / 60;
    updates++;
  }
  assert.equal(p.endOfFile, true);
  assert.equal(renderer.uploads.length, 190);
  assert.ok(clock > 13 && clock < 15, `runtime ${clock}s`);
  assert.equal(p.vidFile.currentBlock, 368);

  // The last uploaded frame is the reader's final frame buffer.
  const fb = p.vidFile.frameBuffer;
  // AUDIT 19 F7: compare the VIEW's contents and its LENGTH, not the
  // identity of its backing buffer. Reaching through `.buffer` discarded
  // byteOffset and length, so this compared the frame buffer with itself
  // and passed even when the upload handed over a ONE-PIXEL view. The
  // renderer shared exactly the same blind spot, which is why neither
  // caught it - a pin and the code it watches must not be wrong together.
  const up = renderer.uploads.at(-1);
  assert.equal(up.colors.length, up.width * up.height,
    'the uploaded view must span the whole frame, not just its buffer');
  assert.equal(fnv1a(new Uint8Array(up.colors.buffer, up.colors.byteOffset, up.colors.byteLength)),
    fnv1a(fb));
});

// ---------------------------------------------------------------------------
// U22 THE SPLASH LETTERBOX. Caught by the eyeball, not by a pin: the first
// live shot of ANIM0001 had a SKY-BLUE border around it. The renderer clears
// to the pale Iliac Bay sky, which is right behind a world and wrong behind
// anything on the native panel - U21 blacked it for the menu, U21b for
// chargen, and the splash arrived with the same blue frame. Third time, so
// the helper is now shared rather than re-written a fourth time.
// ---------------------------------------------------------------------------

test('U22: the splash blacks its letterbox before the frame goes down', async () => {
  const { playVideo } = await import('../src/ui/videoPlayer.js');
  const { MENU_BACKDROP } = await import('../src/ui/chargenArt.js');

  const quads = [];
  const renderer = {
    beginFrame: () => {},
    drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, rect, color }),
    uploadTexture: () => 'TEX',
    releaseTexture: () => true,
    screenOffset: [0, 0],
  };
  const canvas = { width: 1400, height: 900 };

  // One frame, then end: raf runs the callback once and the any-key watch
  // fires immediately, so the loop draws and closes.
  let frames = 0;
  // Synthetic, so this runs without ARENA2: one audio block to give the
  // reader a frameDelay, one full frame, end of file.
  const bytes = buildVid({
    frameCount: 1, w: 320, h: 200,
    blocks: [audioStart([128, 128, 128, 128]), videoStart(1, [0x80 + 8, 9]), eof()],
  });
  await playVideo(canvas, renderer, bytes, {
    raf: (fn) => { if (frames++ === 0) fn(); },
    listen: (onAnyKey) => { onAnyKey(); return () => {}; },
    audioContext: () => null,
  });

  assert.ok(quads.length >= 1, 'the frame loop drew');
  assert.equal(quads[0].tex, null, 'the FIRST quad is the solid backdrop, not the frame');
  assert.deepEqual(quads[0].rect, { x: 0, y: 0, w: 1400, h: 900 },
    'covering the whole real canvas - a 320x200-sized quad would leave the bars showing');
  assert.deepEqual(quads[0].color, MENU_BACKDROP,
    'and it is the SHARED backdrop constant - one black, not a third hand-written one');
});

// ---------------------------------------------------------------------------
// AUDIT 19 F1(vid): THE ERROR BOUNDARY. The reader throws OUTSIDE ReadBlock's
// try on purpose - end of stream on the block-type byte, a null audioBuffer
// before any audio block. In Unity that logs and the next frame retries. Here
// it killed the rAF chain: the promise NEVER SETTLED, the any-key watch was
// never detached and the frame texture was never released. main.js AWAITS
// playVideo, so a truncated ANIM0001.VID was a permanent black screen - which
// made this file's own "NEVER TRAPS" header a false claim.
// ---------------------------------------------------------------------------

test('U22/AUDIT 19: a throwing video RESOLVES, detaches and disposes', async () => {
  const { playVideo } = await import('../src/ui/videoPlayer.js');

  let released = 0;
  let detached = 0;
  const renderer = {
    beginFrame: () => {}, drawScreenQuad: () => {}, uploadTexture: () => 'TEX',
    releaseTexture: () => { released++; return true; }, screenOffset: [0, 0],
  };

  // A real frame first (so there IS a texture to release), then the stream
  // simply ENDS with no end-of-file block - so the next block-type read
  // runs off the end and throws OUT of readNextBlock. That is one of the
  // two throws that escape ReadBlock's own try, and the exact shape that
  // used to hang the promise forever.
  const bytes = buildVid({
    blocks: [audioStart([128, 128, 128, 128]), videoStart(1, [0x80 + 8, 9])],
  });

  let frames = 0;
  const played = await playVideo({ width: 640, height: 400 }, renderer, bytes, {
    raf: (fn) => { if (frames++ < 40) fn(); },
    listen: () => () => { detached++; },
    audioContext: () => null,
  });

  assert.equal(played, false, 'it resolves FALSE rather than hanging forever');
  assert.equal(detached, 1, 'the any-key watch is detached exactly once');
  // >= 1 rather than == 1: _uploadFrame releases the previous texture
  // before each upload, so the count is frames + the dispose. What matters
  // is that dispose RAN - before the boundary existed it never did.
  assert.ok(released >= 1, `the frame texture is released (saw ${released})`);
});

test('U22/AUDIT 19: the DRAW half is inside the boundary too', async () => {
  const { playVideo } = await import('../src/ui/videoPlayer.js');
  let detached = 0;
  // A renderer that dies mid-frame. The reader is not the only thing that
  // can throw in a frame, so the boundary wraps update AND the draw calls;
  // a boundary around update() alone would still hang here.
  //
  // NOTE on scope: playVideo also carries a `settled` guard against a
  // double resolve. This pin does NOT cover it - the frame loop returns
  // without re-arming raf, so the guard is unreachable from here. It is
  // defensive, and it is not claimed as pinned.
  const renderer = {
    beginFrame: () => { throw new Error('GL is gone'); },
    drawScreenQuad: () => {}, uploadTexture: () => 'TEX',
    releaseTexture: () => true, screenOffset: [0, 0],
  };
  const bytes = buildVid({ blocks: [audioStart([128, 128, 128, 128]), videoStart(1, [0x80 + 8, 9]), eof()] });

  let frames = 0;
  const played = await playVideo({ width: 640, height: 400 }, renderer, bytes, {
    raf: (fn) => { if (frames++ < 10) fn(); },
    listen: () => () => { detached++; },
    audioContext: () => null,
  });
  assert.equal(played, false);
  assert.equal(detached, 1, 'detached, with the failure caught in the draw half');
});

// ---------------------------------------------------------------------------
// AUDIT 19 F2(vid): THE SPLASH WAS UNCONDITIONALLY SILENT, and the reason
// given in the source was the wrong one. videoPlayer resolves its
// AudioContext ONCE at construction - deliberately, so the clock cannot move
// under a running stream - and nothing had booted an AudioEngine by splash
// time, so there was no context to resolve at all. The file blamed the
// browser's gesture rule; the gesture rule gates whether a context RUNS, not
// whether one EXISTS, and a suspended context can be built without one.
// Measured after the fix: 70 audio clips scheduled where it scheduled zero.
// ---------------------------------------------------------------------------

test('U22/AUDIT 19: AudioEngine.ensure leaves a context to resolve', async () => {
  const { AudioEngine } = await import('../src/systems/audio.js');

  const madeContexts = [];
  const savedWindow = globalThis.window;
  try {
    globalThis.window = {
      AudioContext: class { constructor() { this.state = 'suspended'; madeContexts.push(this); } },
      addEventListener: () => {},
    };
    const eng = new AudioEngine();
    await eng.ensure(async () => { throw new Error('no DAGGER.SND in this test'); });
    // Sound EFFECTS are disabled without DAGGER.SND, and that is fine -
    // but the context is not theirs alone. Music and the video player need
    // only a clock, so ensure() must leave one even when the sound archive
    // is missing. Nothing is called by hand here: if ensure() did not
    // build it, this fails.
    assert.equal(eng.enabled, false, 'no DAGGER.SND means no sound effects');
    assert.equal(madeContexts.length, 1, 'and yet a context exists after ensure()');
    assert.ok(eng.ctx, 'exposed as audio.ctx for the video player to resolve');
    assert.equal(eng.ctx.state, 'suspended',
      'and it is SUSPENDED - existing is not the same as making sound before a gesture');
  } finally {
    if (savedWindow === undefined) delete globalThis.window;
    else globalThis.window = savedWindow;
  }
});

test('U22/AUDIT 19: the boot starts audio BEFORE it plays the splash', () => {
  // Ordering, and it is the whole bug: the player resolves its context at
  // construction, so booting audio after playVideo would be exactly as
  // silent as not booting it.
  //
  // NOT awaited anymore, deliberately: audio.ensure creates the context in
  // its SYNCHRONOUS prefix (pinned below), which is all the splash needs -
  // awaiting the whole call parked the splash on black while DAGGER.SND
  // and MIDI.BSA read in. The old pin demanded `await ensureAudio` to
  // close the no-context race; the sync-prefix pin closes it now.
  const main = readFileSync('src/main.js', 'utf8');
  const boot = main.indexOf('ensureAudio(getBytes)');
  const play = main.indexOf('playVideo(canvas, renderer');
  assert.ok(boot > 0, 'main.js must boot audio for the splash');
  assert.ok(play > 0, 'main.js must play the splash');
  assert.ok(boot < play, 'audio must be booted BEFORE the video is constructed');
  assert.doesNotMatch(main.slice(boot - 10, boot + 30), /await ensureAudio/,
    'and NOT awaited - the await parked the splash behind two archive loads');
  // The sync prefix: the context is created before ensure()'s first await,
  // so an un-awaited caller still has a clock by the next statement.
  const audioSrc = readFileSync('src/systems/audio.js', 'utf8');
  const ensureBody = audioSrc.slice(audioSrc.indexOf('async ensure('));
  const ctxAt = ensureBody.indexOf('this._ensureCtx()');
  const awaitAt = ensureBody.indexOf('await ');
  assert.ok(ctxAt > 0 && awaitAt > 0 && ctxAt < awaitAt,
    'audio.ensure must create the context in its synchronous prefix, before any await');
});

test('merge audit: video audio rides the LIVE SoundVolume, read at each clip', () => {
  // DaggerfallVideo.cs:117 assigns
  // `audioSources[flip].volume = DaggerfallUnity.Settings.SoundVolume`
  // as each clip is scheduled. The port had the parameter and never
  // fed it (both call sites - the boot splash at main.js and the D1
  // death video at shared.js - pass no options), so the two videos
  // were the only sounds in the build the volume slider could not
  // touch: gain 1.0 while the shipped default is 0.5 and a muted game
  // is 0.
  const bytes = buildVid({
    w: 4, h: 2,
    blocks: [audioStart([0, 128, 255, ...silence(737)]), videoStart(1, [0x80 + 8, 1]), eof()],
  });
  const play = (opts) => {
    const ctx = stubAudioContext();
    const p = new VideoPlayer({ renderer: stubRenderer(), now: () => 0, audioContext: () => ctx, ...opts });
    p.play(bytes);
    p.update();
    return ctx;
  };
  setValue('Controls', 'SoundVolume', '0.25');
  assert.equal(play({}).gains[0].gain.value, 0.25, 'the setting reaches the clip');
  setValue('Controls', 'SoundVolume', '0');
  assert.equal(play({}).gains[0].gain.value, 0, 'a muted game mutes the video too');
  // An EXPLICIT volume still wins - the parameter is an override, not
  // a default, so the corpus probes and the pins above keep working.
  assert.equal(play({ soundVolume: 1 }).gains[0].gain.value, 1);
  resetToDefaults();
  assert.equal(play({}).gains[0].gain.value, 0.5, 'and the shipped default is 0.5, not 1');
});
