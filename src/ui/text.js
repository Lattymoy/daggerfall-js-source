// Classic text (UI arc, U2a). One WHITE glyph atlas per font (240
// glyphs, 16 columns of 16x16 cells) uploaded once through
// renderer.uploadTexture; drawText tints per call through
// drawScreenQuad's color - so one atlas serves every classic text
// color. Layout is DaggerfallFont's: glyph = charCode - 33; codes
// below 33 advance a space (fixedWidth); classic 1px glyph spacing;
// integer scale keeps the art crisp.

import { FNT_GLYPH_COUNT, FNT_GLYPH_DIM, FNT_ASCII_START, FNT_GLYPH_SPACING } from '../formats/fntFile.js';

export const ATLAS_COLS = 16;
export const ATLAS_ROWS = FNT_GLYPH_COUNT / ATLAS_COLS;   // 15

/** Build the white atlas color32 for uploadTexture. */
export function buildFontAtlas(fnt) {
  const w = ATLAS_COLS * FNT_GLYPH_DIM, h = ATLAS_ROWS * FNT_GLYPH_DIM;
  const colors = new Uint32Array(w * h);
  const u8 = new Uint8Array(colors.buffer);
  for (let gi = 0; gi < FNT_GLYPH_COUNT; gi++) {
    const px = fnt.getGlyphPixels(gi, 255);
    const cx = (gi % ATLAS_COLS) * FNT_GLYPH_DIM, cy = Math.floor(gi / ATLAS_COLS) * FNT_GLYPH_DIM;
    for (let y = 0; y < FNT_GLYPH_DIM; y++) {
      for (let x = 0; x < FNT_GLYPH_DIM; x++) {
        if (!px[y * FNT_GLYPH_DIM + x]) continue;
        const o = ((cy + y) * w + cx + x) * 4;
        u8[o] = u8[o + 1] = u8[o + 2] = u8[o + 3] = 255;
      }
    }
  }
  return { width: w, height: h, colors };
}

/** The source-UV window for one glyph cell. */
export function glyphSrc(glyphIndex) {
  const cx = glyphIndex % ATLAS_COLS, cy = Math.floor(glyphIndex / ATLAS_COLS);
  return {
    u0: (cx * FNT_GLYPH_DIM) / (ATLAS_COLS * FNT_GLYPH_DIM),
    v0: (cy * FNT_GLYPH_DIM) / (ATLAS_ROWS * FNT_GLYPH_DIM),
    u1: ((cx + 1) * FNT_GLYPH_DIM) / (ATLAS_COLS * FNT_GLYPH_DIM),
    v1: ((cy + 1) * FNT_GLYPH_DIM) / (ATLAS_ROWS * FNT_GLYPH_DIM),
  };
}

/** Advance-only pass: the pixel width of a string at scale 1. */
export function measureText(fnt, text) {
  let w = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    w += (code < FNT_ASCII_START ? fnt.fixedWidth : fnt.glyphWidth(code - FNT_ASCII_START)) + FNT_GLYPH_SPACING;
  }
  return Math.max(0, w - FNT_GLYPH_SPACING);
}

/** Prepare a font for drawing: the uploaded white atlas + metrics. */
export function makeFont(renderer, fnt, name) {
  return { fnt, tex: renderer.uploadTexture('fnt', name, buildFontAtlas(fnt)) };
}

/** Draw text at pixel (x, y) top-left, integer scale, RGBA tint. */
export function drawText(renderer, font, text, x, y, scale = 1, color = [1, 1, 1, 1]) {
  let cx = x;
  const { fnt } = font;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < FNT_ASCII_START) { cx += (fnt.fixedWidth + FNT_GLYPH_SPACING) * scale; continue; }
    const gi = code - FNT_ASCII_START;
    const gw = fnt.glyphWidth(gi);
    if (gw > 0) {
      // the cell is 16 wide; the glyph occupies its left gw columns
      const src = glyphSrc(gi);
      const cellU = src.u1 - src.u0;
      renderer.drawScreenQuad(font.tex,
        { x: cx, y, w: gw * scale, h: fnt.fixedHeight * scale },
        { u0: src.u0, v0: src.v0, u1: src.u0 + cellU * (gw / FNT_GLYPH_DIM), v1: src.v0 + (src.v1 - src.v0) * (fnt.fixedHeight / FNT_GLYPH_DIM) },
        color);
    }
    cx += (gw + FNT_GLYPH_SPACING) * scale;
  }
  return cx - x;
}
