// L10N2 (2026-09-27, Mac: "for as many languages as we possibly can and do this right"): A FACE THAT GROWS - DFU's
// dynamic SDF font asset. DaggerfallFont builds a replacement face with TMP_FontAsset.CreateFontAsset(font, 45, 6,
// SDFAA, 4096, 4096, AtlasPopulationMode.Dynamic) and asks it for a glyph the first time a label needs one:
// HasSDFGlyph (DaggerfallFont.cs:424-435) falls to TryAddCharacter (:801-830), and a code the font cannot give is
// remembered as missing and never asked again. The port has no SDF pass (OVH2, ui/text.js): a glyph is rasterised
// once through canvas, white on clear, into a page of the face's atlas - shelf-packed, the page uploaded before its
// first draw and again only after it gained glyphs. Metrics are TMP's, in point-size units, so ui/text.js measures and
// draws a grown glyph exactly as it does a seeded one. A face serves every classic font that registers it: the
// glyphs scale by each font's own GlyphHeight / 45.

/** TMP's point size, the unit of every glyph metric (DaggerfallFont's SDF faces are made at 45). */
export const FACE_POINT_SIZE = 45;
/** The em in texels. OVH2's pack face rasterised at 90 for its 191 seeded glyphs; a language's face may hold
 *  thousands, so it keeps them smaller - still above the 4x-6x a classic screen draws a 7-11 px font at. */
export const FACE_RASTER = 64;
/** A page's side in texels: about two hundred CJK glyphs, 4 MB to upload again when it grows. */
export const FACE_PAGE = 1024;
const PAD = 2;

/** A code no face draws: the C0 and C1 controls and DEL. They are missing, as TMP finds them. */
export const isControlCode = (code) => code < 32 || (code >= 0x7f && code < 0xa0);

/** A canvas of the given size: OffscreenCanvas where there is one, else a document canvas; null under bare node. */
export function defaultCanvas(w, h) {
  if (typeof globalThis.OffscreenCanvas === 'function') return new globalThis.OffscreenCanvas(w, h);
  const c = globalThis.document?.createElement?.('canvas');
  if (!c) return null;
  c.width = w; c.height = h;
  return c;
}

/** Whether this runtime can rasterise a face at all. */
export const canRasterise = () => typeof globalThis.OffscreenCanvas === 'function' || !!globalThis.document?.createElement;

/**
 * A face over a CSS font family (a single loaded FontFace's family, or a fallback list), growing as it is asked.
 * `makeCanvas(w, h)` is the canvas seam (a test hands its own); `name` keys its pages' textures; `lang` is told to
 * the canvas where it listens (Han characters take their region's forms). `weight` is the CSS font weight.
 * @returns {{ family: string, name: string, glyphs: Map<number, object>, missing: Set<number>, pages: object[],
 *   add: (code: number) => boolean, flush: (renderer: any) => number, texOf: (g: object) => any }}
 */
export function createGlyphFace(family, { raster = FACE_RASTER, page = FACE_PAGE, makeCanvas = defaultCanvas, name = family, lang = null, weight = 400 } = {}) {
  const k = raster / FACE_POINT_SIZE;
  const font = `${weight} ${raster}px ${family}`;
  const glyphs = new Map();
  const missing = new Set();
  const pages = [];
  let measurer = null;
  const dress = (ctx) => {
    ctx.font = font;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    if (lang && 'lang' in ctx) ctx.lang = lang;
  };
  const measure = (ch) => {
    if (!measurer) { const c = makeCanvas(1, 1); measurer = c?.getContext('2d') ?? null; if (measurer) dress(measurer); }
    return measurer?.measureText(ch) ?? null;
  };
  const newPage = () => {
    const canvas = makeCanvas(page, page);
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });   // FIELD 2026-09-27 (main's buildSdfFace): the page is read back at each upload
    if (!ctx) return null;
    dress(ctx);
    const p = { canvas, ctx, x: PAD, y: PAD, rowH: 0, dirty: false, tex: null, uploads: 0 };
    pages.push(p);
    return p;
  };

  /** TryAddCharacter: the glyph for `code` rasterised into the atlas, or false (and remembered) when it cannot be. */
  function add(code) {
    if (glyphs.has(code)) return true;
    if (missing.has(code)) return false;
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff || isControlCode(code)) { missing.add(code); return false; }
    const ch = String.fromCodePoint(code);
    const mt = measure(ch);
    if (!mt) { missing.add(code); return false; }
    const left = mt.actualBoundingBoxLeft ?? 0, right = mt.actualBoundingBoxRight ?? mt.width;
    const ascent = mt.actualBoundingBoxAscent ?? raster * 0.8, descent = mt.actualBoundingBoxDescent ?? 0;
    const w = Math.max(0, Math.ceil(left + right)), h = Math.max(0, Math.ceil(ascent + descent));
    let src = { u0: 0, v0: 0, u1: 0, v1: 0 }, at = -1;
    if (w > 0 && h > 0) {
      if (w + 2 * PAD > page || h + 2 * PAD > page) { missing.add(code); return false; }
      let p = pages[pages.length - 1] ?? newPage();
      if (p && p.x + w + PAD > page) { p.x = PAD; p.y += p.rowH + PAD; p.rowH = 0; }   // the next shelf
      if (p && p.y + h + PAD > page) p = newPage();                                    // the next page
      if (!p) { missing.add(code); return false; }
      p.ctx.fillText(ch, p.x + left, p.y + ascent);
      src = { u0: p.x / page, v0: p.y / page, u1: (p.x + w) / page, v1: (p.y + h) / page };
      at = pages.indexOf(p);
      p.x += w + PAD;
      p.rowH = Math.max(p.rowH, h);
      p.dirty = true;
    }
    glyphs.set(code, {
      code, advance: mt.width / k,                                   // horizontalAdvance
      offX: -left / k, offY: ascent / k, w: w / k, h: h / k,         // horizontalBearingX / Y, width, height
      page: at, src,
    });
    return true;
  }

  /** Upload every page that gained glyphs since its last upload (white, the alpha the canvas drew - tinted per draw).
   *  Answers how many pages went up. A renderer without a release door keeps its old copy until it is replaced. */
  function flush(renderer) {
    let n = 0;
    pages.forEach((p, i) => {
      if (!p.dirty || typeof renderer?.uploadTexture !== 'function') return;
      const img = p.ctx.getImageData(0, 0, page, page);
      const colors = new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength);
      for (let o = 0; o < colors.length; o += 4) colors[o] = colors[o + 1] = colors[o + 2] = 255;   // no dark fringe under LINEAR
      const key = `${name}#p${i}`;
      if (p.tex) renderer.releaseTexture?.('fnt', key);
      p.tex = renderer.uploadTexture('fnt', key, { width: page, height: page, colors }, { smooth: true, alpha: true });
      p.dirty = false;
      p.uploads++;
      n++;
    });
    return n;
  }

  const texOf = (g) => (g && g.page >= 0 ? pages[g.page]?.tex ?? null : null);
  return { family, name, raster, glyphs, missing, pages, add, flush, texOf };
}
