// DFMOD1/DFMOD2 - a box filter for RGBA pictures. Pure, no DOM: the paperdoll fits a mod's hi-res sprite into its
// classic rect with it, and the bundle worker (unityBundle.js) shrinks a picture past the chosen texture detail with it
// when the mod carries no smaller mip.

/** VE4: the size a mip chain reaches under `maxSize` on its longer side - halved until it fits, the level
 *  unityBundle.mipLevelFor picks - so a picture that carries no mips (a shipped PNG) is fitted to the texture detail at
 *  the size an attached bundle's would be. Pure: the page and the shipped pack's decode worker both read it. */
export function mipFitSize(width, height, maxSize = Infinity) {
  let w = width, h = height;
  while (Math.max(w, h) > maxSize && (w > 1 || h > 1)) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
  return [w, h];
}

/** Box-filter an RGBA picture to w x h (alpha-weighted, so a sprite's clear edge does not bleed dark). */
export function resampleRgba(img, w, h) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const { width: sw, height: sh, data: src } = img;
  if (sw === w && sh === h) return { width: w, height: h, data: src };
  const out = new Uint8ClampedArray(w * h * 4);
  const fx = sw / w, fy = sh / h;
  for (let y = 0; y < h; y++) {
    const y0 = y * fy, y1 = y0 + fy;
    for (let x = 0; x < w; x++) {
      const x0 = x * fx, x1 = x0 + fx;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let sy = Math.floor(y0); sy < Math.min(sh, Math.ceil(y1)); sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        for (let sx = Math.floor(x0); sx < Math.min(sw, Math.ceil(x1)); sx++) {
          const wgt = wy * (Math.min(sx + 1, x1) - Math.max(sx, x0));
          const i = (sy * sw + sx) * 4, al = src[i + 3] * wgt;
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; area += wgt;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
      const alpha = area ? a / area : 0;
      out[o + 3] = alpha >= 127.5 ? 255 : alpha < 8 ? 0 : alpha;
    }
  }
  return { width: w, height: h, data: out };
}
