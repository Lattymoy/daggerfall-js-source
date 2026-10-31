// NO-BETHESDA2 (2026-10-31): a mod's picture that is Daggerfall's own is built from the player's TEXTURE file in the
// palette its spec names (formats/classicPictures.js), and tools/classicDerive.mjs writes that spec. Pinned on a
// TEXTURE file, an RCI file and two palettes made here, so CI needs no ARENA2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClassicPictures, DEFAULT_PALETTE } from '../../src/formats/classicPictures.js';
import { classicRecordRgba } from '../../src/formats/derivedTexture.js';
import { DFPalette } from '../../src/formats/dfPalette.js';
import { specFor, exactIndex, derivedText } from '../../tools/classicDerive.mjs';

/** A one-record, one-frame, uncompressed TEXTURE file: rows on the format's 256-byte stride. */
function textureFile(width, height, pixel) {
  const recordAt = 26 + 20, dataOffset = 28;
  const bytes = new Uint8Array(recordAt + dataOffset + 256 * height);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, 1, true);
  v.setInt32(26 + 2, recordAt, true);
  v.setInt16(recordAt + 4, width, true); v.setInt16(recordAt + 6, height, true);
  v.setInt16(recordAt + 8, 0, true);   // uncompressed
  v.setUint32(recordAt + 14, dataOffset, true);
  v.setUint16(recordAt + 20, 1, true);   // one frame
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) bytes[recordAt + dataOffset + y * 256 + x] = pixel(x, y);
  return bytes;
}
/** A 768-byte palette: entry i is (i, f(i), 255 - i). */
const paletteBytes = (f) => { const b = new Uint8Array(768); for (let i = 0; i < 256; i++) { b[i * 3] = i; b[i * 3 + 1] = f(i) & 255; b[i * 3 + 2] = 255 - i; } return b; };

const W = 12, H = 10;
const index = (x, y) => (x < 2 ? 0 : 1 + ((x * 7 + y * 3) % 200));   // two clear columns, the rest drawn
const FILES = {
  'TEXTURE.210': textureFile(W, H, index),
  'ART_PAL.COL': paletteBytes((i) => i * 3),
  'PAL.PAL': paletteBytes((i) => i * 5),
};
const getBytesOf = (files, asked = []) => async (name) => { asked.push(name); if (!files[name]) throw new Error(`${name}: missing`); return files[name]; };
const pal = (name) => { const p = new DFPalette(); p.load(FILES[name], name); return p; };

test('NO-BETHESDA2: a record comes back in the palette asked for, each file read once', async () => {
  const asked = [];
  const cp = createClassicPictures(getBytesOf(FILES, asked));
  const a = await cp.picture(210, 0, 0);
  const b = await cp.picture(210, 0, 0, 'PAL.PAL');
  assert.equal(a.width, W); assert.equal(a.height, H);
  assert.equal(a.data[3], 0, 'index 0 is clear');
  const at = (p, x, y) => [...p.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];
  const i = index(5, 4);
  assert.deepEqual(at(a, 5, 4), [i, (i * 3) & 255, 255 - i, 255]);
  assert.deepEqual(at(b, 5, 4), [i, (i * 5) & 255, 255 - i, 255]);
  assert.deepEqual(asked.sort(), ['ART_PAL.COL', 'PAL.PAL', 'TEXTURE.210']);
  assert.equal(await cp.picture(210, 3, 0), null, 'no such record');
  assert.equal(DEFAULT_PALETTE, 'ART_PAL.COL');
});

test('NO-BETHESDA2: a failed read is forgotten - the next ask reads again', async () => {
  const files = { ...FILES };
  delete files['TEXTURE.210'];
  const cp = createClassicPictures(getBytesOf(files));
  await assert.rejects(cp.picture(210, 0, 0), /missing/);
  files['TEXTURE.210'] = FILES['TEXTURE.210'];
  assert.equal((await cp.picture(210, 0, 0)).width, W);
});

test('NO-BETHESDA2: the tool\'s spec rebuilds the author\'s picture from the record, in its palette, edits and all', async () => {
  // the author's copy: the record in PAL.PAL, one pixel repainted, laid one pixel right on a picture one wider
  const t = (await import('../../src/formats/textureFile.js')).TextureFile;
  const tf = new t(); tf.load(FILES['TEXTURE.210'], 'TEXTURE.210');
  const bm = tf.getDFBitmap(0, 0);
  const records = ['PAL.PAL', 'ART_PAL.COL'].map((n) => ({ archive: 210, record: 0, frame: 0, rgba: classicRecordRgba(bm, pal(n)), pal: n }));
  const src = records[0].rgba;
  const pic = { width: W + 1, height: H, data: new Uint8Array((W + 1) * H * 4) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pic.data.set(src.data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4), (y * (W + 1) + x + 1) * 4);
  pic.data.set([9, 8, 7, 255], (3 * (W + 1) + 6) * 4);
  const spec = specFor(pic, records, exactIndex(records));
  assert.deepEqual(spec, { from: [210, 0, 0], size: [W + 1, H], at: [1, 0], edits: [[6, 3, '090807ff']], pal: 'PAL.PAL' });
  const built = await createClassicPictures(getBytesOf(FILES)).build(spec);
  assert.deepEqual([...built.data], [...pic.data], 'built from the player\'s record, it is the author\'s picture');
  // an exact copy is found by its key, with no edits; a stranger is the author's own
  assert.deepEqual(specFor(records[1].rgba, records, exactIndex(records)), { from: [210, 0, 0], pal: 'ART_PAL.COL' });
  const own = { width: W, height: H, data: new Uint8Array(W * H * 4).fill(200) };
  assert.equal(specFor(own, records, exactIndex(records)), null);
  assert.equal(derivedText({ b: { from: [1, 0, 0] }, a: { from: [2, 0, 0] } }), '{\n"b": {"from":[1,0,0]},\n"a": {"from":[2,0,0]}\n}\n');
});

test('NO-BETHESDA2: an rci spec is built from the player\'s RCI file - [record, frame], no archive - and the tool writes that form', async () => {
  // BUTTONS.RCI is 32x16 raw records (CifRciFile's table): record 0 all clear, record 1 drawn
  const rci = new Uint8Array(32 * 16 * 2);
  for (let i = 512; i < rci.length; i++) rci[i] = 1 + (i % 200);
  const files = { ...FILES, 'BUTTONS.RCI': rci };
  const asked = [];
  const cp = createClassicPictures(getBytesOf(files, asked));
  const rec = await cp.rciPicture('BUTTONS.RCI', 1, 0, 'PAL.PAL');
  assert.deepEqual([rec.width, rec.height], [32, 16]);
  const i = rci[512 + 4 * 32 + 5];
  assert.deepEqual([...rec.data.subarray((4 * 32 + 5) * 4, (4 * 32 + 5) * 4 + 4)], [i, (i * 5) & 255, 255 - i, 255]);
  assert.equal(await cp.rciPicture('BUTTONS.RCI', 2, 0), null, 'no such record');
  const spec = { rci: 'BUTTONS.RCI', from: [1, 0], edits: [[0, 0, '010203ff']], pal: 'PAL.PAL' };
  const built = await cp.build(spec);
  assert.deepEqual([...built.data.subarray(0, 4)], [1, 2, 3, 255], 'the author\'s pixel');
  assert.deepEqual([...built.data.subarray(4)], [...rec.data.subarray(4)], 'the rest is the record');
  assert.ok(!asked.some((n) => n.startsWith('TEXTURE.')), 'no TEXTURE file is read for an rci spec');
  await assert.rejects(cp.build({ rci: 'NOTE.RCI', from: [0, 0], pal: 'PAL.PAL' }), /missing/, 'the player\'s file is not there');
  // the tool's half: an RCI-tagged record yields the rci form
  const records = [{ rci: 'BUTTONS.RCI', record: 1, frame: 0, rgba: rec, pal: 'PAL.PAL' }];
  const pic = { width: 32, height: 16, data: rec.data.slice() };
  pic.data.set([1, 2, 3, 255], 0);
  assert.deepEqual(specFor(pic, records, exactIndex(records)), spec);
});
