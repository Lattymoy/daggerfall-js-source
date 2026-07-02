import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TextureFile, UNSUPPORTED_FILENAMES, SOLID_TYPES } from '../src/formats/textureFile.js';
import { BaseImageFile } from '../src/formats/baseImageFile.js';
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

function loadTex(name, pal) {
  const t = new TextureFile();
  const ok = t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, pal);
  assert.equal(ok, true, `${name} should load`);
  return t;
}

const sum = (d) => d.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('texture: static helpers and filename gating', () => {
  assert.equal(TextureFile.indexToFileName(7), 'TEXTURE.007');
  assert.equal(TextureFile.indexToFileName(357), 'TEXTURE.357');
  assert.equal(TextureFile.isSpectralArchive(273), true); // Ghost
  assert.equal(TextureFile.isSpectralArchive(278), true); // Wraith
  assert.equal(TextureFile.isSpectralArchive(473), true); // Lysandus
  assert.equal(TextureFile.isSpectralArchive(272), false);

  const t = new TextureFile();
  assert.equal(t.load(new Uint8Array(64), 'NOTATEXTURE.BSA'), false);
  for (const bad of UNSUPPORTED_FILENAMES) {
    assert.equal(t.load(new Uint8Array(64), bad), false, bad);
  }
});

test('base image: readRleData decodes runs and literals', () => {
  const b = new BaseImageFile();
  // code>127: run of (code-127) copies of next byte; else literal copy of code+1 bytes.
  // 130 -> run of 3 x 0x0a; 1 -> literal 2 bytes [7,8]; 128 -> run of 1 x 0x05.
  const src = new Uint8Array([130, 0x0a, 1, 7, 8, 128, 0x05]);
  b._setBytes(src, 'synthetic');
  const dst = new Uint8Array(6);
  const end = b.readRleData(0, 6, dst);
  assert.deepEqual(Array.from(dst), [0x0a, 0x0a, 0x0a, 7, 8, 0x05]);
  assert.equal(end, src.length);
});

test('base image: getColor32 flips vertically, applies cutout/emission alpha and border', () => {
  const b = new BaseImageFile();
  b.palette.set(1, 10, 11, 12);
  b.palette.set(2, 20, 21, 22);
  // 2x2 bitmap: top row [1,2], bottom row [2,1].
  const bmp = { width: 2, height: 2, data: new Uint8Array([1, 2, 2, 1]) };

  const flat = b.getColor32(bmp, 2); // index 2 transparent
  assert.equal(flat.width, 2);
  assert.equal(flat.height, 2);
  // Vertical flip: output row 0 is source bottom row [2,1].
  assert.deepEqual(Array.from(flat.colors.slice(0, 8)), [20, 21, 22, 0, 10, 11, 12, 255]);
  // Output row 1 is source top row [1,2].
  assert.deepEqual(Array.from(flat.colors.slice(8, 16)), [10, 11, 12, 255, 20, 21, 22, 0]);

  // Emission override forces index 2 opaque even while it is the alpha index.
  const em = b.getColor32(bmp, 2, 0, 2);
  assert.equal(em.colors[3], 255);

  // Border pads all sides with zeroes.
  const bord = b.getColor32(bmp, -1, 1);
  assert.equal(bord.width, 4);
  assert.equal(bord.height, 4);
  assert.deepEqual(Array.from(bord.colors.slice(0, 4)), [0, 0, 0, 0]); // border pixel
  // First interior pixel of row 1 = source bottom-left = index 2.
  assert.deepEqual(Array.from(bord.colors.slice((4 + 1) * 4, (4 + 2) * 4)), [20, 21, 22, 255]);

  // Window emission map: white only where index matches.
  b.palette.set(0xff, 1, 2, 3);
  const win = { width: 2, height: 1, data: new Uint8Array([0xff, 0]) };
  const w = b.getWindowColors32(win);
  assert.deepEqual(Array.from(w.colors), [255, 255, 255, 255, 0, 0, 0, 0]);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

test('texture: full corpus decodes - every frame of every record of every file', { skip: skipReal }, () => {
  const pal = artPal();
  const files = readdirSync(ARENA2).filter((f) => f.startsWith('TEXTURE.')).sort();
  assert.equal(files.length, 472);

  let loaded = 0;
  let records = 0;
  let frames = 0;
  for (const f of files) {
    const t = new TextureFile();
    const ok = t.load(new Uint8Array(readFileSync(join(ARENA2, f))), f, pal);
    if (UNSUPPORTED_FILENAMES.includes(f)) {
      assert.equal(ok, false, `${f} must be rejected`);
      continue;
    }
    assert.equal(ok, true, `${f} must load`);
    loaded++;
    records += t.recordCount;
    for (let r = 0; r < t.recordCount; r++) {
      const n = t.getFrameCount(r);
      for (let fr = 0; fr < n; fr++) {
        const bmp = t.getDFBitmap(r, fr);
        assert.ok(bmp.data, `${f} r${r} f${fr} has data`);
        assert.equal(bmp.data.length, bmp.width * bmp.height, `${f} r${r} f${fr} size`);
        assert.ok(bmp.width > 0 && bmp.height > 0, `${f} r${r} f${fr} dims`);
        frames++;
      }
    }
  }
  // Pinned corpus totals from the original data.
  assert.equal(loaded, 469);
  assert.equal(records, 6713);
  assert.equal(frames, 11211);
});

test('texture: solid archives TEXTURE.000/001', { skip: skipReal }, () => {
  const pal = artPal();
  const t0 = loadTex('TEXTURE.000', pal);
  assert.equal(t0.solidType, SOLID_TYPES.SolidColoursA);
  assert.equal(t0.recordCount, 128);
  assert.deepEqual(t0.getSize(0), { width: 32, height: 32 });
  assert.equal(t0.getFrameCount(0), 1);
  assert.ok(t0.getDFBitmap(0, 0).data.every((x) => x === 0));
  assert.ok(t0.getDFBitmap(5, 0).data.every((x) => x === 5));

  const t1 = loadTex('TEXTURE.001', pal);
  assert.equal(t1.solidType, SOLID_TYPES.SolidColoursB);
  assert.ok(t1.getDFBitmap(0, 0).data.every((x) => x === 128));
});

test('texture: pinned decodes per path', { skip: skipReal }, () => {
  const pal = artPal();

  // Uncompressed single-frame (stride-256 rows).
  const terrain = loadTex('TEXTURE.002', pal);
  assert.equal(terrain.description, 'Desert terrain Test');
  assert.equal(terrain.recordCount, 56);
  const tb = terrain.getDFBitmap(0, 0);
  assert.equal(tb.width, 64);
  assert.equal(tb.height, 64);
  assert.equal(sum(tb.data), 432595);

  // Record offsets survive parsing.
  const walls = loadTex('TEXTURE.017', pal);
  assert.equal(walls.description, 'Desert City Walls');
  assert.deepEqual(walls.getOffset(0), { x: 66, y: 66 });

  // Multi-frame transparent-run codec: frames must differ.
  const orc = loadTex('TEXTURE.267', pal);
  assert.equal(orc.description, 'Orc Sergeant');
  assert.equal(orc.recordCount, 20);
  assert.equal(orc.getFrameCount(0), 4);
  assert.deepEqual(orc.getSize(0), { width: 97, height: 109 });
  assert.deepEqual(orc.getScale(0), { width: -70, height: -70 });
  assert.equal(sum(orc.getDFBitmap(0, 0).data), 795245);
  assert.equal(sum(orc.getDFBitmap(0, 1).data), 773556);

  // RecordRle (0x1108) and ImageRle (0x0108) row-header paths.
  const rle = loadTex('TEXTURE.233', pal);
  assert.equal(rle.recordCount, 28);
  const rb = rle.getDFBitmap(0, 0);
  assert.equal(`${rb.width}x${rb.height}`, '47x43');
  assert.equal(sum(rb.data), 44471);

  const irle = loadTex('TEXTURE.253', pal);
  assert.equal(irle.recordCount, 87);
  const ib = irle.getDFBitmap(0, 0);
  assert.equal(`${ib.width}x${ib.height}`, '17x13');
  assert.equal(sum(ib.data), 43221);

  // Lazy cache returns the same decoded object.
  assert.equal(terrain.getDFBitmap(0, 0), tb);
});
