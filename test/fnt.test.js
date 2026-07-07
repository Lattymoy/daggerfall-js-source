// U2a: the classic FNT reader + text metrics, crafted bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FntFile, FNT_GLYPH_COUNT, FNT_GLYPH_BYTES } from '../src/formats/fntFile.js';
import { buildFontAtlas, measureText, glyphSrc, ATLAS_COLS } from '../src/ui/text.js';

function craftFnt() {
  // header 4 + table 240*4 = 964; glyph data after
  const dataStart = 4 + FNT_GLYPH_COUNT * 4;
  const bytes = new Uint8Array(dataStart + FNT_GLYPH_COUNT * FNT_GLYPH_BYTES);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 6, true);    // fixedWidth
  v.setUint16(2, 9, true);    // fixedHeight
  for (let i = 0; i < FNT_GLYPH_COUNT; i++) {
    const off = dataStart + i * FNT_GLYPH_BYTES;
    v.setUint16(4 + i * 4, off, true);
    v.setUint16(4 + i * 4 + 2, i === 0 ? 3 : 5, true);   // '!' width 3, others 5
  }
  // glyph 0 ('!'): row 0 -> odd byte 0b10000000 (left half MSB = pixel x0),
  // even byte 0b00000001 (right half LSB = pixel x15)
  bytes[dataStart + 1] = 0x80;
  bytes[dataStart + 0] = 0x01;
  return bytes;
}

test('fnt: verbatim layout - header, table, the L/R half swap, MSB-first', () => {
  const f = new FntFile().load(craftFnt());
  assert.equal(f.fixedWidth, 6);
  assert.equal(f.fixedHeight, 9);
  assert.equal(f.glyphWidth(0), 3);
  const px = f.getGlyphPixels(0, 99);
  assert.equal(px[0], 99);                 // x0 from the ODD byte's MSB
  assert.equal(px[15], 99);                // x15 from the EVEN byte's LSB
  assert.equal(px[1], 0);
  assert.equal(px.filter((p) => p).length, 2);
  assert.equal(f.getGlyphPixels(240), null);
});

test('fnt: atlas + metrics (space rule, 1px classic spacing, cell UVs)', () => {
  const f = new FntFile().load(craftFnt());
  const atlas = buildFontAtlas(f);
  assert.equal(atlas.width, 256);
  assert.equal(atlas.height, 240);
  const u8 = new Uint8Array(atlas.colors.buffer);
  assert.equal(u8[3], 255);                // glyph 0's x0 pixel, white+opaque
  assert.equal(u8[7], 0);                  // x1 empty
  // '!' (3) + 1 + space (6) + 1 + '"' (5) = 16
  assert.equal(measureText(f, '! "'), 16);
  assert.equal(measureText(f, ''), 0);
  const s = glyphSrc(ATLAS_COLS);          // first glyph of row 1
  assert.equal(s.u0, 0);
  assert.ok(Math.abs(s.v0 - 16 / 240) < 1e-9);
});
