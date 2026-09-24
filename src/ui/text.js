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
import { packFontUrl, packBytes } from '../systems/uiPack.js';   // OVH2: a worn UI pack's SDF face
import { getBool } from '../systems/settings.js';

// ── OVH2: DFU'S SDF ARM (DaggerfallFont.IsSDFCapable) ───────────────────────────────────────────────────────────────
// A classic font with an SDF face draws and MEASURES from that face when GUI/SDFFontRendering is on (:128-131):
// DaggerfallFont.ReplaceTMPFontFromFile (:661-705) builds the face from StreamingAssets/Fonts/FONT000N-SDF.ttf at 45pt,
// and the layout law is DFU's own - a glyph's width is its advance x GlyphHeight/pointSize (GetGlyphWidth :466-478,
// GetSDFGlyphScalingRatio :587-590), SDF glyph spacing is 0 (:41), the baseline sits at GlyphHeight - 2 below the
// label's top (DrawSDFGlyph :264), the text is read as UTF-32 with '?' for a code the face lacks (:195-210), and a
// shadow stands 0.4 of its classic offset away (sdfShadowPositionScale :42). The port has no SDF pass: the face is
// rasterised once at SDF_RASTER px into a white alpha atlas the renderer blends (the pack-art law), which draws the
// same glyph boxes a distance field does at the sizes a classic screen asks for.
export const SDF_POINT_SIZE = 45;       // TMP_FontAsset.CreateFontAsset(font, 45, 6, SDFAA, 4096, 4096) - faceInfo.pointSize
export const SDF_GLYPH_SPACING = 0;     // sdfGlyphSpacing (:41)
export const SDF_SHADOW_SCALE = 0.4;    // sdfShadowPositionScale (:42)
const SDF_RASTER = 90;                  // the atlas's em in texels - twice the point size, for a crisp 4x-6x screen
const SDF_PAD = 3;
/** The codes the face is asked for: DFU seeds the replacement with the source font's character table (:707-716) -
 *  printable ASCII and Latin-1's printable half here. */
export const SDF_CODES = Object.freeze([...Array.from({ length: 95 }, (_, i) => 32 + i), ...Array.from({ length: 96 }, (_, i) => 160 + i)]);

/** The face's layout, or null on the classic arm. Rides the FNT itself, so every measure of the font - measureText is
 *  handed `font.fnt` at a hundred call sites - takes the same arm the draw does. */
export const sdfOf = (fnt) => fnt?.sdf ?? null;
const sdfRatio = (fnt) => fnt.fixedHeight / SDF_POINT_SIZE;   // GetSDFGlyphScalingRatio(1): GlyphHeight / pointSize
const sdfCode = (sdf, code) => (sdf.glyphs.has(code) ? code : FNT_ERROR_CODE);   // HasSDFGlyph, else ErrorCode
/** One glyph's width in classic pixels (GetGlyphWidth's SDF arm, spacing included). */
export const sdfGlyphWidth = (fnt, code) => fnt.sdf.glyphs.get(sdfCode(fnt.sdf, code)).advance * sdfRatio(fnt) + SDF_GLYPH_SPACING;

/** Rasterise a face into the atlas and the glyph table (`measure`/`paint` are the canvas seam; a test hands its own).
 *  Glyph metrics are in POINT-SIZE units, as TMP's are. */
export function buildSdfFace(family, { canvas = null } = {}) {
  const k = SDF_RASTER / SDF_POINT_SIZE;
  const c = canvas ?? new OffscreenCanvas(1, 1);
  let ctx = c.getContext('2d');
  ctx.font = `${SDF_RASTER}px "${family}"`;
  const cell = SDF_RASTER * 2 + SDF_PAD * 2;
  const cols = 16, rows = Math.ceil(SDF_CODES.length / cols);
  c.width = cols * cell; c.height = rows * cell;
  ctx = c.getContext('2d');
  ctx.font = `${SDF_RASTER}px "${family}"`;
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  const glyphs = new Map();
  SDF_CODES.forEach((code, i) => {
    const ch = String.fromCodePoint(code);
    const mt = ctx.measureText(ch);
    const left = mt.actualBoundingBoxLeft ?? 0, right = mt.actualBoundingBoxRight ?? mt.width;
    const ascent = mt.actualBoundingBoxAscent ?? SDF_RASTER * 0.8, descent = mt.actualBoundingBoxDescent ?? 0;
    const gx = (i % cols) * cell + SDF_PAD, gy = Math.floor(i / cols) * cell + SDF_PAD;
    const w = Math.max(0, Math.ceil(left + right)), h = Math.max(0, Math.ceil(ascent + descent));
    if (code !== 32 && w && h) ctx.fillText(ch, gx + left, gy + ascent);
    glyphs.set(code, {
      code, advance: mt.width / k,                                         // horizontalAdvance
      offX: -left / k, offY: ascent / k, w: w / k, h: h / k,               // horizontalBearingX / Y, width, height
      src: { u0: gx / c.width, v0: gy / c.height, u1: (gx + w) / c.width, v1: (gy + h) / c.height },
    });
  });
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return { glyphs, atlas: { width: c.width, height: c.height, colors: new Uint8ClampedArray(img.data.buffer) } };
}

/** Load a pack's SDF face for `fnt` and put it on the FNT once it is ready - until then the classic arm draws. */
async function loadSdfFace(renderer, fnt, name, url) {
  try {
    const family = `dfu-sdf-${name}`;
    const face = new globalThis.FontFace(family, await packBytes(url));
    await face.load();
    globalThis.document?.fonts?.add?.(face);
    const { glyphs, atlas } = buildSdfFace(family);
    for (let i = 0; i < atlas.colors.length; i += 4) { atlas.colors[i] = atlas.colors[i + 1] = atlas.colors[i + 2] = 255; }   // white, tinted per call
    const tex = renderer.uploadTexture('fnt', `${name}#sdf`, atlas, { smooth: true, alpha: true });
    fnt.sdf = { glyphs, tex };
  } catch (e) { console.warn(`[ui pack] the ${name} face did not load - the classic glyphs stand:`, e?.message ?? e); }
}

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
  if (sdfOf(fnt)) {   // OVH2: CalculateTextWidth's SDF arm (:386-398) - UTF-32, '?' for a code the face lacks
    for (const ch of text) w += sdfGlyphWidth(fnt, ch.codePointAt(0));
    return w;
  }
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
  const font = { fnt, tex: renderer.uploadTexture('fnt', name, buildFontAtlas(fnt)) };
  // OVH2: a worn UI pack's face for this font, when DFU would draw one (IsSDFCapable: the setting AND a face)
  const url = packFontUrl(name);
  if (url && typeof globalThis.FontFace === 'function' && getBool('GUI', 'SDFFontRendering')) loadSdfFace(renderer, fnt, name, url);
  return font;
}

/** Draw text at pixel (x, y) top-left, integer scale, RGBA tint. */
export function drawText(renderer, font, text, x, y, scale = 1, color = [1, 1, 1, 1]) {
  let cx = x;
  const { fnt } = font;
  const sdf = sdfOf(fnt);
  if (sdf) {   // OVH2: DrawSDFText (:195-210) - each glyph on its bearing from the classic baseline
    const r = sdfRatio(fnt) * scale;
    const baseline = y + (fnt.fixedHeight - 2) * scale;   // DrawSDFGlyph :264 (faceInfo.baseline 0)
    for (const ch of text) {
      const g = sdf.glyphs.get(sdfCode(sdf, ch.codePointAt(0)));
      if (g.code !== FNT_SPACE_CODE && g.w > 0 && g.h > 0) {
        renderer.drawScreenQuad(sdf.tex, { x: cx + g.offX * r, y: baseline - g.offY * r, w: g.w * r, h: g.h * r }, g.src, color);
      }
      cx += (g.advance * sdfRatio(fnt) + SDF_GLYPH_SPACING) * scale;
    }
    return;
  }
  // PERF-ON (2026-09-15, Mac: "the more people that are online, the
  // worse fps becomes"): ONE DRAW A STRING, not one a glyph.
  //
  // `drawScreenQuad` is a full GL state setup - eight uniforms, a
  // texture bind and a draw - so this loop cost about ten GL calls a
  // LETTER. Fine for a HUD drawn once; not fine for the online name
  // pass, which draws a name over every peer with no cap on peers,
  // measured at about nine quads a peer a frame. The glyphs of one
  // string share a texture and a colour and cannot overlap each other,
  // so they are exactly a RUN: collected here and handed to the
  // renderer in one `drawScreenQuadRun`, issued at the same point in
  // the frame the per-glyph calls were, so nothing about draw ORDER
  // moves. See render/renderer.js drawScreenQuadRun.
  //
  // THE FALLBACK IS NOT DEAD CODE. A run is an OPTIONAL renderer
  // member: the suite's stub renderers, and the glyph-recording font
  // harness that reconstructs painted strings (nativetrade), carry
  // `drawScreenQuad` alone. They take the per-glyph path below and
  // read exactly what they always did.
  const run = typeof renderer?.drawScreenQuadRun === 'function' ? [] : null;
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
      const dst = { x: cx, y, w: gw * scale, h: fnt.fixedHeight * scale };
      const uv = { u0: src.u0, v0: src.v0, u1: src.u0 + cellU * (gw / FNT_GLYPH_DIM), v1: src.v0 + (src.v1 - src.v0) * (fnt.fixedHeight / FNT_GLYPH_DIM) };
      if (run) run.push({ dst, src: uv });
      else renderer.drawScreenQuad(font.tex, dst, uv, color);
    }
    cx += (gw + FNT_GLYPH_SPACING) * scale;
  }
  if (run && run.length) renderer.drawScreenQuadRun(font.tex, run, color);
  return cx - x;
}
