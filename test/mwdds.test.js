import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDds } from '../src/formats/mwDdsFile.js';

// Every expected pixel below is computed by hand from the S3TC spec, so the
// decoder is checked against the format, not against itself.

/** Minimal DDS container around raw payload bytes. */
function dds({ width, height, fourCC = 0, bitCount = 0, masks = [0, 0, 0, 0], pfFlags }, payload) {
  const out = new Uint8Array(128 + payload.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x20534444, true); // 'DDS '
  v.setUint32(4, 124, true);
  v.setUint32(12, height, true);
  v.setUint32(16, width, true);
  v.setUint32(76, 32, true); // pixelformat.size
  v.setUint32(80, pfFlags, true);
  v.setUint32(84, fourCC, true);
  v.setUint32(88, bitCount, true);
  v.setUint32(92, masks[0], true);
  v.setUint32(96, masks[1], true);
  v.setUint32(100, masks[2], true);
  v.setUint32(104, masks[3], true);
  out.set(payload, 128);
  return out;
}

const FOURCC = { DXT1: 0x31545844, DXT3: 0x33545844, DXT5: 0x35545844 };
// c0=0xF800 (pure red), c1=0x001F (pure blue); index rows 0xE4 = texels 0,1,2,3.
const COLOR_HALF = [0x00, 0xf8, 0x1f, 0x00, 0xe4, 0xe4, 0xe4, 0xe4];

function px(mip, x, y) {
  const o = (y * mip.width + x) * 4;
  return Array.from(mip.rgba.subarray(o, o + 4));
}

test('mwdds: DXT1 four-color mode (c0 > c1)', () => {
  const img = decodeDds(
    dds({ width: 4, height: 4, fourCC: FOURCC.DXT1, pfFlags: 0x4 }, Uint8Array.from(COLOR_HALF)),
  );
  assert.equal(img.width, 4);
  const m = img.mips[0];
  assert.deepEqual(px(m, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(m, 1, 0), [0, 0, 255, 255]);
  assert.deepEqual(px(m, 2, 0), [170, 0, 85, 255]); // (2*c0 + c1 + 1) / 3
  assert.deepEqual(px(m, 3, 0), [85, 0, 170, 255]); // (c0 + 2*c1 + 1) / 3
  assert.deepEqual(px(m, 3, 3), [85, 0, 170, 255]); // rows repeat
});

test('mwdds: DXT1 three-color + transparent mode (c0 <= c1)', () => {
  // Swapped endpoints: c0=0x001F (blue) <= c1=0xF800 (red).
  const block = Uint8Array.from([0x1f, 0x00, 0x00, 0xf8, 0xe4, 0xe4, 0xe4, 0xe4]);
  const m = decodeDds(dds({ width: 4, height: 4, fourCC: FOURCC.DXT1, pfFlags: 0x4 }, block))
    .mips[0];
  assert.deepEqual(px(m, 0, 0), [0, 0, 255, 255]);
  assert.deepEqual(px(m, 1, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(m, 2, 0), [127, 0, 127, 255]); // (c0 + c1) >> 1
  assert.deepEqual(px(m, 3, 0), [0, 0, 0, 0]); // index 3 = transparent
});

test('mwdds: DXT3 explicit alpha nibbles', () => {
  // Row 0 nibbles [0x1, 0xF, 0x0, 0x3] -> u16 0x30F1; rows 1-3 opaque.
  const block = Uint8Array.from([
    0xf1, 0x30, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, ...COLOR_HALF,
  ]);
  const m = decodeDds(dds({ width: 4, height: 4, fourCC: FOURCC.DXT3, pfFlags: 0x4 }, block))
    .mips[0];
  assert.deepEqual(px(m, 0, 0), [255, 0, 0, 0x11]);
  assert.deepEqual(px(m, 1, 0), [0, 0, 255, 0xff]);
  assert.deepEqual(px(m, 2, 0), [170, 0, 85, 0x00]);
  assert.deepEqual(px(m, 3, 0), [85, 0, 170, 0x33]);
  assert.deepEqual(px(m, 1, 2), [0, 0, 255, 255]);
});

test('mwdds: DXT5 interpolated alpha (a0 > a1, 8-entry ramp)', () => {
  // a0=255, a1=0; texel indices 0,1,2,7 -> alphas 255, 0, 219, 36.
  // 3-bit indices packed LSB-first: 0 | 1<<3 | 2<<6 | 7<<9 = 0x000E88.
  const block = Uint8Array.from([255, 0, 0x88, 0x0e, 0x00, 0x00, 0x00, 0x00, ...COLOR_HALF]);
  const m = decodeDds(dds({ width: 4, height: 4, fourCC: FOURCC.DXT5, pfFlags: 0x4 }, block))
    .mips[0];
  assert.deepEqual(px(m, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(m, 1, 0), [0, 0, 255, 0]);
  assert.deepEqual(px(m, 2, 0), [170, 0, 85, 219]); // (6*a0 + 1*a1 + 3) / 7
  assert.deepEqual(px(m, 3, 0), [85, 0, 170, 36]); // (1*a0 + 6*a1 + 3) / 7
  assert.deepEqual(px(m, 0, 1), [255, 0, 0, 255]);
});

test('mwdds: uncompressed A8R8G8B8 via channel masks', () => {
  const payload = new Uint8Array(8);
  new DataView(payload.buffer).setUint32(0, 0x80ff4020, true);
  const m = decodeDds(
    dds(
      {
        width: 2,
        height: 1,
        bitCount: 32,
        masks: [0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000],
        pfFlags: 0x40 | 0x1,
      },
      payload,
    ),
  ).mips[0];
  assert.deepEqual(px(m, 0, 0), [255, 64, 32, 128]);
  assert.deepEqual(px(m, 1, 0), [0, 0, 0, 0]);
});

test('mwdds: rejects junk and unsupported formats', () => {
  assert.throws(() => decodeDds(new Uint8Array(64)), /not a DDS/);
  assert.throws(
    () => decodeDds(dds({ width: 4, height: 4, fourCC: 0x12345678, pfFlags: 0x4 }, new Uint8Array(8))),
    /unsupported fourCC/,
  );
});
