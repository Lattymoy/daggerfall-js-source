// U45 - THE BSS READER, the twelfth image format. BssFile.cs is the
// simplest file in ARENA2 and the corpus gate is correspondingly
// absolute: `10 + frames * width * height` IS the file size, to the
// byte, for every BSS the game ships.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BssFile, BSS_HEADER_BYTES } from '../src/formats/bssFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const arena2 = process.env.ARENA2_PATH;
const has = (n) => arena2 && existsSync(join(arena2, n));

/** A synthetic BSS: header + frames of a known ramp. */
function makeBss({ x = 1, y = 2, w = 3, h = 2, n = 4 } = {}) {
  const out = new Uint8Array(BSS_HEADER_BYTES + n * w * h);
  const v = new DataView(out.buffer);
  v.setInt16(0, x, true); v.setInt16(2, y, true);
  v.setInt16(4, w, true); v.setInt16(6, h, true); v.setInt16(8, n, true);
  for (let f = 0; f < n; f++) {
    for (let i = 0; i < w * h; i++) out[BSS_HEADER_BYTES + f * w * h + i] = f * 10 + i;
  }
  return out;
}

test('bss: the header is five Int16 and the frames follow it back to back', () => {
  const f = new BssFile();
  assert.equal(f.recordCount, 0, 'zero records before load');
  assert.equal(f.load(makeBss(), 'TEST.BSS'), true);
  assert.equal(f.recordCount, 1, 'ONE record per file, however many frames');
  assert.deepEqual(f.getSize(0), { width: 3, height: 2 });
  assert.equal(f.getFrameCount(0), 4);
  assert.deepEqual(f.screenPosition, { x: 1, y: 2 });
  // frame 2's first byte is 20, which proves the stride
  assert.equal(f.getDFBitmap(0, 2).data[0], 20);
  assert.equal(f.getDFBitmap(0, 3).data[5], 35);
  // MUTATION: BSS_HEADER_BYTES = 8 or a stride of w*h*2 both shift
  // every frame and this fails on the first one.
});

test('bss: the refusals - a wrong extension, a truncated body, an empty header', () => {
  assert.equal(new BssFile().load(makeBss(), 'TEST.IMG'), false, 'the extension test is DFU:114');
  assert.equal(new BssFile().load(makeBss(), 'TEST.bss'), true, 'and it is case-insensitive');
  const short = makeBss().slice(0, 12);
  const f = new BssFile();
  assert.equal(f.load(short, 'TEST.BSS'), false, 'Read() catches and returns false rather than throwing');
  assert.equal(f.recordCount, 0, 'a failed load leaves no record behind');
  assert.equal(new BssFile().load(makeBss({ n: 0 }), 'TEST.BSS'), false);
});

test('bss: the index checks are ASYMMETRIC, which is DFU\'s own', () => {
  // GetDFBitmap (:160-172) tests the RECORD at both ends and the FRAME
  // only against the top - `frame >= GetFrameCount(record)` with no
  // `frame < 0` - so C# would throw IndexOutOfRange on -1 where this
  // answers the empty bitmap. Ported as written, pinned as written.
  const f = new BssFile();
  f.load(makeBss(), 'TEST.BSS');
  // RECORDED EQUIVALENT: dropping the `frame >= getFrameCount` guard
  // survives every pin here, and it genuinely is equivalent - C# throws
  // IndexOutOfRange on a Color32[] where JavaScript answers undefined,
  // which `?? emptyBitmap()` turns into the same empty bitmap the
  // guard returns. The guard stays because it is what DFU wrote and
  // because `frames` is a plain array a later edit could grow.
  assert.equal(f.getDFBitmap(0, 4).width, 0, 'past the top is empty');
  assert.equal(f.getDFBitmap(1, 0).width, 0, 'a second record does not exist');
  assert.equal(f.getDFBitmap(-1, 0).width, 0);
  assert.equal(f.getFrameCount(1), -1, 'an invalid record is -1, never 0');
  assert.deepEqual(f.getSize(9), { width: 0, height: 0 });
});

test('bss corpus: all three compass files decode BYTE-EXACTLY', { skip: !arena2 && 'ARENA2_PATH unset' }, () => {
  const pal = new DFPalette();
  pal.load(readFileSync(join(arena2, 'ART_PAL.COL')));
  // Every BSS in ARENA2 is a compass. CMPA03I0 is an IMG, not a BSS,
  // and is deliberately not in this list.
  const seen = [];
  for (const name of ['CMPA00I0.BSS', 'CMPA01I0.BSS', 'CMPA02I0.BSS']) {
    if (!has(name)) continue;
    const bytes = readFileSync(join(arena2, name));
    const f = new BssFile();
    assert.equal(f.load(bytes, name, pal), true, `${name} loads`);
    const { width, height } = f.getSize(0);
    const frames = f.getFrameCount(0);
    assert.equal(BSS_HEADER_BYTES + frames * width * height, bytes.length,
      `${name}: 10 + n*w*h IS the file size`);
    // every frame is fully in range and carries its palette
    for (let i = 0; i < frames; i++) {
      const b = f.getDFBitmap(0, i);
      assert.equal(b.data.length, width * height);
      assert.equal(b.palette, pal);
    }
    seen.push([name, width, height, frames]);
  }
  // ALL THREE CARRY 32 FRAMES and differ in SIZE - which is why the
  // reader takes both from the header and HUDLarge's hardcoded 32
  // happens to be right for every one of them.
  assert.deepEqual(seen, [
    ['CMPA00I0.BSS', 48, 40, 32],
    ['CMPA01I0.BSS', 34, 28, 32],
    ['CMPA02I0.BSS', 30, 25, 32],
  ]);
  // The header's own screen position, which nothing reads: DFU places
  // the needle at its own (275, 2) inside the bar instead.
  const f = new BssFile();
  f.load(readFileSync(join(arena2, 'CMPA00I0.BSS')), 'CMPA00I0.BSS', pal);
  assert.deepEqual(f.screenPosition, { x: 272, y: 157 });
});
