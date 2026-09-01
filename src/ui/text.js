// Classic text (UI arc, U2a). One WHITE glyph atlas per font (240
// glyphs, 16 columns of 16x16 cells) uploaded once through
// renderer.uploadTexture; drawText tints per call through
// drawScreenQuad's color - so one atlas serves every classic text
// color. Layout is DaggerfallFont's + TextLabel's: the string is
// folded through Encoding.ASCII first (every code above 127 becomes
// '?'), then glyph = charCode - 33; a code the font has no glyph for
// is drawn as SPACE and MEASURED as '?'; the space glyph's width is
// DaggerfallFont.CreateSpaceGlyph's `fntFile.FixedWidth - 1`
// (DaggerfallFont.cs:623-627); every glyph then advances
// GetGlyphWidth(code) + GlyphSpacing (classic spacing 1), the
// trailing spacing INCLUDED in the measured width exactly as
// CalculateTextWidth (DaggerfallFont.cs:377-383) and TextLabel's
// first pass (TextLabel.cs:526-533) accumulate it; integer scale
// keeps the art crisp.

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

/** The SPACE glyph's width: DaggerfallFont.CreateSpaceGlyph
 *  (DaggerfallFont.cs:623-627) builds ASCII 32 at FixedWidth - 1, and
 *  every code the font has no glyph for is cast to it. */
export const spaceGlyphWidth = (fnt) => fnt.fixedWidth - 1;

/** DaggerfallFont.cs:36-37. */
export const FNT_SPACE_CODE = 32;
export const FNT_ERROR_CODE = 63;   // '?'

/** Encoding.ASCII.GetBytes (DaggerfallFont.cs:304, :373): the string is
 *  folded to BYTES before layout and ASCIIEncoding's replacement
 *  fallback turns every code above 127 into '?', so an accent a player
 *  types on a non-US keyboard reaches the font as a question mark and
 *  never as a raw FNT glyph index. */
export const asciiFold = (code) => (code > 127 ? FNT_ERROR_CODE : code);

/** HasGlyph (:419-422) over the dictionary LoadFont builds (:602-608):
 *  SpaceCode plus the 240 glyphs from asciiStart. */
export const hasGlyph = (code) =>
  code === FNT_SPACE_CODE || (code >= FNT_ASCII_START && code < FNT_ASCII_START + FNT_GLYPH_COUNT);

/** Advance-only pass: the pixel width of a string at scale 1.
 *  Verbatim CalculateTextWidth (DaggerfallFont.cs:377-383): every
 *  glyph contributes GetGlyphWidth(code) + GlyphSpacing, the trailing
 *  spacing kept - that total is TextLabel.Size.x, the width
 *  HorizontalAlignment.Center halves. */
export function measureText(fnt, text) {
  let w = 0;
  for (const ch of text) {
    // AUDIT 39 F129: the two substitutions are DFU's own and they
    // DIFFER by pass - CalculateTextWidth (:378-379) measures a code
    // the font lacks as ErrorCode '?', while DrawText (:313-314) draws
    // it as a space. Both sit behind the same ASCII fold.
    let code = asciiFold(ch.charCodeAt(0));
    if (!hasGlyph(code)) code = FNT_ERROR_CODE;
    w += (code === FNT_SPACE_CODE ? spaceGlyphWidth(fnt) : fnt.glyphWidth(code - FNT_ASCII_START)) + FNT_GLYPH_SPACING;
  }
  return w;
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
    // The fold, then DrawText's own substitution: a code the font has
    // no glyph for is CAST TO A SPACE (:313-314) - never dropped, and
    // never indexed raw into the glyph table.
    let code = asciiFold(ch.charCodeAt(0));
    if (!hasGlyph(code)) code = FNT_SPACE_CODE;
    if (code === FNT_SPACE_CODE) {
      // AUDIT 23 (ui-native-5) - DaggerfallFont.cs:328: the DRAWN space
      // advances by the glyph width alone (no GlyphSpacing), while
      // CalculateTextWidth (:381/:464) adds it for every glyph - the
      // asymmetry is DFU's, so measureText keeps the spacing.
      cx += spaceGlyphWidth(fnt) * scale;
      continue;
    }
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
