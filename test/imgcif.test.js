import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ImgFile,
  UNSUPPORTED_IMG_FILENAMES,
  getHeaderlessFileImageDimensions,
} from '../src/formats/imgFile.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function artPal() {
  const p = new DFPalette();
  p.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  return p;
}

const sum = (d) => d.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('img: headerless dimension table and filename gating', () => {
  assert.deepEqual(getHeaderlessFileImageDimensions(64000), { width: 320, height: 200 });
  assert.deepEqual(getHeaderlessFileImageDimensions(289), { width: 17, height: 17 });
  assert.deepEqual(getHeaderlessFileImageDimensions(12345), { width: 0, height: 0 });

  const t = new ImgFile();
  assert.equal(t.load(new Uint8Array(64), 'NOPE.CIF'), false);
  for (const bad of UNSUPPORTED_IMG_FILENAMES) {
    assert.equal(t.load(new Uint8Array(64), bad), false, bad);
  }
});

test('img: headered synthetic file decodes and reports offsets', () => {
  // 12-byte IMG header (x=3, y=4, w=2, h=2, uncompressed, len=4) + 4 pixels.
  const bytes = new Uint8Array(16);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, 3, true);
  v.setInt16(2, 4, true);
  v.setInt16(4, 2, true);
  v.setInt16(6, 2, true);
  v.setUint16(8, 0, true);
  v.setUint16(10, 4, true);
  bytes.set([9, 8, 7, 6], 12);

  const t = new ImgFile();
  assert.equal(t.load(bytes, 'SYNTH0I0.IMG'), true);
  assert.equal(t.recordCount, 1);
  assert.deepEqual(t.getSize(0), { width: 0, height: 0 }); // before decode - DFU behaviour
  const b = t.getDFBitmap();
  assert.deepEqual(Array.from(b.data), [9, 8, 7, 6]);
  assert.deepEqual(t.getSize(0), { width: 2, height: 2 });
  assert.deepEqual(t.imageOffset, { x: 3, y: 4 });
  assert.equal(t.isPalettized, false);
  assert.equal(t.paletteName, 'ART_PAL.COL');
  assert.equal(t.getFrameCount(0), 1);
  assert.equal(t.getDFBitmap(1, 0).data, null);
});

test('img: palette name routing', () => {
  const mk = (name, len = 289) => {
    const t = new ImgFile();
    t.load(new Uint8Array(len), name);
    return t.paletteName;
  };
  assert.equal(mk('FMAP0I05.IMG'), 'FMAP_PAL.COL');
  assert.equal(mk('NITE00I0.IMG'), 'NIGHTSKY.COL');
  assert.equal(mk('DANK02I0.IMG'), 'DANKBMAP.COL');
  assert.equal(mk('TMAP00I0.IMG'), 'MAP.PAL');
  assert.equal(mk('MAIN00I0.IMG'), 'ART_PAL.COL');
});

test('cifrci: plain CIF walks contiguous IMG records; classic RLE decodes', () => {
  // Two records: uncompressed 2x1, then RleCompressed 2x1.
  const bytes = new Uint8Array(12 + 2 + 12 + 3);
  const v = new DataView(bytes.buffer);
  // Record 0 header.
  v.setInt16(4, 2, true); // width
  v.setInt16(6, 1, true); // height
  v.setUint16(8, 0x0000, true);
  v.setUint16(10, 2, true); // pixelDataLength
  bytes.set([5, 6], 12);
  // Record 1 header at 14.
  v.setInt16(14 + 4, 2, true);
  v.setInt16(14 + 6, 1, true);
  v.setUint16(14 + 8, 0x0002, true); // RleCompressed
  v.setUint16(14 + 10, 3, true); // compressed length on disk
  bytes.set([129, 7], 26); // run of 2 x 7

  const t = new CifRciFile();
  assert.equal(t.load(bytes, 'SYNTH.CIF'), true);
  assert.equal(t.recordCount, 2);
  assert.deepEqual(Array.from(t.getDFBitmap(0, 0).data), [5, 6]);
  assert.deepEqual(Array.from(t.getDFBitmap(1, 0).data), [7, 7]);
  assert.equal(t.description, 'CIF File');
  assert.equal(t.load(new Uint8Array(8), 'NOPE.IMG'), false);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

test('img: full corpus decodes with documented rejects and palettized set', { skip: skipReal }, () => {
  const pal = artPal();
  const files = readdirSync(ARENA2).filter((f) => f.endsWith('.IMG')).sort();
  assert.equal(files.length, 263);

  let loaded = 0;
  const palettized = [];
  for (const f of files) {
    const t = new ImgFile();
    const ok = t.load(new Uint8Array(readFileSync(join(ARENA2, f))), f, pal.clone());
    if (UNSUPPORTED_IMG_FILENAMES.includes(f)) {
      assert.equal(ok, false, `${f} must be rejected`);
      continue;
    }
    assert.equal(ok, true, `${f} must load`);
    loaded++;
    const b = t.getDFBitmap();
    assert.ok(b.data, `${f} has data`);
    assert.equal(b.data.length, b.width * b.height, `${f} size`);
    assert.ok(b.width > 0 && b.height > 0, `${f} dims`);
    if (t.isPalettized) palettized.push(f);
  }
  assert.equal(loaded, 260);
  assert.deepEqual(palettized, [
    'CHGN00I0.IMG', 'DIE_00I0.IMG', 'PICK02I0.IMG',
    'PICK03I0.IMG', 'PRIS00I0.IMG', 'TITL00I0.IMG',
  ]);
});

test('img: TITL00I0 pinned - embedded palette multiplied x4', { skip: skipReal }, () => {
  const t = new ImgFile();
  t.load(new Uint8Array(readFileSync(join(ARENA2, 'TITL00I0.IMG'))), 'TITL00I0.IMG', artPal());
  const b = t.getDFBitmap();
  assert.equal(`${b.width}x${b.height}`, '320x200');
  assert.equal(sum(b.data), 11162155);
  assert.equal(t.isPalettized, true);
  assert.equal(t.paletteName, '');
  assert.deepEqual(t.palette.get(10), { r: 220, g: 180, b: 56 });
});

test('cifrci: full corpus decodes', { skip: skipReal }, () => {
  const pal = artPal();
  const files = readdirSync(ARENA2)
    .filter((f) => f.endsWith('.CIF') || f.endsWith('.RCI'))
    .sort();
  assert.equal(files.length, 76);

  let records = 0;
  let frames = 0;
  for (const f of files) {
    const t = new CifRciFile();
    assert.equal(t.load(new Uint8Array(readFileSync(join(ARENA2, f))), f, pal), true, f);
    records += t.recordCount;
    for (let r = 0; r < t.recordCount; r++) {
      for (let fr = 0; fr < t.getFrameCount(r); fr++) {
        const b = t.getDFBitmap(r, fr);
        assert.ok(b.data, `${f} r${r} f${fr}`);
        assert.equal(b.data.length, b.width * b.height, `${f} r${r} f${fr} size`);
        frames++;
      }
    }
  }
  assert.equal(records, 1172);
  assert.equal(frames, 1610);
});

test('cifrci: pinned weapon, faces, and TFAC records', { skip: skipReal }, () => {
  const pal = artPal();

  // WEAPON01: wield record + anim records.
  const w1 = new CifRciFile();
  w1.load(new Uint8Array(readFileSync(join(ARENA2, 'WEAPON01.CIF'))), 'WEAPON01.CIF', pal);
  assert.equal(w1.recordCount, 7);
  assert.equal(w1.getFrameCount(0), 1); // wielding image
  assert.equal(w1.getFrameCount(1), 5);
  assert.deepEqual(w1.getSize(1), { width: 103, height: 200 });
  assert.equal(sum(w1.getDFBitmap(1, 0).data), 1459732);
  assert.deepEqual(w1.getOffset(1), { x: 0, y: 0 }); // animated records report 0,0

  // WEAPON09 (bow) has no wielding image.
  const w9 = new CifRciFile();
  w9.load(new Uint8Array(readFileSync(join(ARENA2, 'WEAPON09.CIF'))), 'WEAPON09.CIF', pal);
  assert.equal(w9.recordCount, 1);
  assert.equal(w9.getFrameCount(0), 7);

  // FACES.CIF routes through the RCI path.
  const faces = new CifRciFile();
  faces.load(new Uint8Array(readFileSync(join(ARENA2, 'FACES.CIF'))), 'FACES.CIF', pal);
  assert.equal(faces.recordCount, 61);
  assert.deepEqual(faces.getSize(0), { width: 64, height: 64 });
  assert.equal(sum(faces.getDFBitmap(0, 0).data), 445599);

  // TFAC00I0.RCI: the file DFU sizes its array to 503 for.
  const tfac = new CifRciFile();
  tfac.load(new Uint8Array(readFileSync(join(ARENA2, 'TFAC00I0.RCI'))), 'TFAC00I0.RCI', pal);
  assert.equal(tfac.recordCount, 503);
});
