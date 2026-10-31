// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAP-WHOLE (2026-10-26, the owner: "The held map still struggles to load everything at once";
// bible/03-World/Arena-Provinces.md MAP-WHOLE): THE CONTINENT'S DOTS RASTERISED BY HAND.
//
// Out on the continent the held map draws each road's and track's pixel past the Bay as a dot of the far pen's width
// (ui/tamrielInk.js DOTS_BELOW) - on the freeware's continent 300,000 rects in one tile's path, and the canvas's
// rasteriser walked each as a sub-path of its own (a quarter of a second a tile on a CPU canvas, AUDIT TESA II M10;
// measured again here: 300,000 dots 370 to 1,500 ms on a shared machine). Nothing about them needs a path: a dot is a
// square in the one solid pen of its pass, and the pass is laid down whole at the pen's alpha (tamrielInk.js layDown) - a
// union of squares, each pixel's ink its covered share. So the pass is rasterised here into a COVERAGE MASK - SS x SS
// samples a device pixel, a sample inked when its centre is inside a square - and the mask is the pass's alpha, the pen's
// colour solid under it: the union the canvas's non-zero fill makes, to the sample (the same 300,000 dots in 28 ms, the
// alpha within 4.4 of 255 of the canvas's on the inked pixels, mean). Pure (no canvas), pinned in node. The far band's
// runs stay the canvas's strokes: a capsule a sample at a time measured three times slower than its stroke.
// ═══════════════════════════════════════════════════════════════════

/** Samples a device pixel's side - 4: sixteen levels of coverage, a canvas's own anti-aliasing's grain. */
export const RASTER_SS = 4;

/**
 * A coverage mask for a `w` x `h` device-pixel tile: one byte a sample, SS x SS samples a pixel.
 * @param {number} w @param {number} h @param {number} [ss]
 */
export function createCoverage(w, h, ss = RASTER_SS) {
  return { w, h, ss, sw: w * ss, sh: h * ss, mask: new Uint8Array(w * ss * h * ss), any: false };
}

/** The mask cleared for the next pass (its buffer kept). */
export function clearCoverage(cov) {
  if (cov.any) cov.mask.fill(0);
  cov.any = false;
  return cov;
}

/** A square of side `side` device pixels centred on (cx, cy): the samples whose centres it holds. */
export function stampSquare(cov, cx, cy, side) {
  const { ss, sw, sh, mask } = cov,
    h = side / 2;
  // sample (i, j)'s centre is ((i + 0.5) / ss, (j + 0.5) / ss): inside [cx - h, cx + h) when i in [ceil(ss(cx-h) - 0.5), ...)
  const i0 = Math.max(0, Math.ceil((cx - h) * ss - 0.5)),
    i1 = Math.min(sw - 1, Math.ceil((cx + h) * ss - 0.5) - 1);
  const j0 = Math.max(0, Math.ceil((cy - h) * ss - 0.5)),
    j1 = Math.min(sh - 1, Math.ceil((cy + h) * ss - 0.5) - 1);
  if (i1 < i0 || j1 < j0) return;
  for (let j = j0; j <= j1; j++) {
    const row = j * sw;
    for (let i = i0; i <= i1; i++) mask[row + i] = 1;
  }
  cov.any = true;
}

/**
 * The mask as a pass's pixels: RGBA, the pen's solid colour `rgb` under each pixel's covered share as its alpha (0-255) -
 * premultiplied by nothing, as ImageData is. `out` a Uint8ClampedArray of w x h x 4 to fill (made when absent).
 * @param {ReturnType<typeof createCoverage>} cov @param {ArrayLike<number>} rgb @param {Uint8ClampedArray} [out]
 */
export function coveragePixels(cov, rgb, out = new Uint8ClampedArray(cov.w * cov.h * 4)) {
  const { w, h, ss, sw, mask } = cov,
    full = ss * ss,
    r = rgb[0],
    g = rgb[1],
    b = rgb[2];
  // at the default four samples a side a pixel's row of samples is one 32-bit word, and its bytes (each 0 or 1) sum
  // into the top byte of the word times 0x01010101 - four reads a pixel
  const words =
    ss === 4 && mask.byteOffset % 4 === 0 ? new Uint32Array(mask.buffer, mask.byteOffset, mask.length >> 2) : null;
  const ww = sw >> 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      if (words) {
        const k = y * 4 * ww + x;
        n =
          (Math.imul(words[k], 0x01010101) >>> 24) +
          (Math.imul(words[k + ww], 0x01010101) >>> 24) +
          (Math.imul(words[k + 2 * ww], 0x01010101) >>> 24) +
          (Math.imul(words[k + 3 * ww], 0x01010101) >>> 24);
      } else {
        for (let v = 0; v < ss; v++) {
          const row = (y * ss + v) * sw + x * ss;
          for (let u = 0; u < ss; u++) n += mask[row + u];
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = Math.round((n * 255) / full);
    }
  }
  return out;
}

/** An `rgb(r, g, b)` (or `rgba(...)`) pen's channels. */
export function penRgb(style) {
  const m = /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(style);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}
