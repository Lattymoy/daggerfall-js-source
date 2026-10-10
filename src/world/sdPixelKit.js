// @ts-check
// SD-LOOK (2026-10-08, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md "The pixel law"): THE HOUR'S
// PAINT BOX - what every picture the Hour paints in code is painted with, so all of it reads as one hand's Daggerfall
// pixel art: a seeded rng and tileable noise (the helpers each art module kept a copy of), a ramp sampled through a 4x4
// ordered dither (never a smooth blend - a ramp's steps ARE the picture), 1-px bevels lit top-left, dark outlines, 3x3
// rivets, and a last `quantize` that forces every texel into the ramps the picture was painted from.
//
// Pure: images are the renderer's color32 shape (`{ width, height, colors }`, RGBA rows). The renderer samples NEAREST
// with no mips outside Retro Mode (TEXTURE_MAX_LEVEL 0), so contrast at one texel's scale shimmers: paint the read in
// features 4-8 texels wide.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** @typedef {{ width: number, height: number, colors: Uint8Array }} Img */
/** @typedef {ReadonlyArray<ReadonlyArray<number>>} Ramp */

/** mulberry32 - the port's seeded rng (world/gateArt.js's own). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Value noise over an n x m lattice, tileable over a W x H image, sampled at texel (x, y) - 0..1. */
export function noiseField(seed, n, W = 64, H = W, m = Math.max(1, Math.round((n * H) / W))) {
  const r = rng(seed);
  const lat = Float32Array.from({ length: n * m }, () => r());
  const at = (i, j) => lat[((j % m + m) % m) * n + ((i % n + n) % n)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / W) * n, fy = (y / H) * m;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = smooth(fx - i), ty = smooth(fy - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
/** A blank image, W x H (black, opaque once painted). */
export const image = (W = 64, H = W) => /** @type {Img} */ ({ width: W, height: H, colors: new Uint8Array(W * H * 4) });
/** Paint texel (x, y), wrapping - a tile's edge is its other edge. */
export function putTexel(img, x, y, rgb, a = 255) {
  const W = img.width, H = img.height, i = (((Math.round(y) % H + H) % H) * W + ((Math.round(x) % W + W) % W)) * 4;
  img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = a;
}
/** Texel (x, y), wrapping: [r, g, b]. */
export function texelAt(img, x, y) {
  const W = img.width, H = img.height, i = (((Math.round(y) % H + H) % H) * W + ((Math.round(x) % W + W) % W)) * 4;
  return [img.colors[i], img.colors[i + 1], img.colors[i + 2]];
}
const clamp8 = (v) => Math.round(Math.max(0, Math.min(255, v)));
export const blendRgb = (a, b, t) => [clamp8(a[0] + (b[0] - a[0]) * t), clamp8(a[1] + (b[1] - a[1]) * t), clamp8(a[2] + (b[2] - a[2]) * t)];
export const scale = (c, k) => [clamp8(c[0] * k), clamp8(c[1] * k), clamp8(c[2] * k)];

/** The 4x4 Bayer matrix, 0..15 (render/orderedDither.js BAYER_GLSL's own order). */
export const BAYER4 = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
/** Bayer threshold at texel (x, y), in (0, 1). */
export const bayer = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
/** A ramp at `t` (0 its darkest step, 1 its lightest) through the ordered dither at texel (x, y): always one of its steps,
 *  never a blend between two. */
export function ramp(r, t, x, y) {
  const f = Math.max(0, Math.min(1, t)) * (r.length - 1), i = Math.floor(f);
  if (i >= r.length - 1) return [...r[r.length - 1]];
  return [...r[f - i > bayer(x, y) ? i + 1 : i]];
}
/** A ramp's step `i`, clamped. */
export const step = (r, i) => [...r[Math.max(0, Math.min(r.length - 1, Math.round(i)))]];

/** A raised block's 1-px bevel: its top and left edges a step lighter, its bottom and right a step darker (the light from
 *  the top-left - Daggerfall's own). Rectangle [x0, x0 + w) x [y0, y0 + h), wrapping. */
export function bevel(img, x0, y0, w, h, light, dark) {
  for (let x = x0; x < x0 + w; x++) { putTexel(img, x, y0, light); putTexel(img, x, y0 + h - 1, dark); }
  for (let y = y0; y < y0 + h; y++) { putTexel(img, x0, y, light); putTexel(img, x0 + w - 1, y, dark); }
}
/** A 3x3 rivet centred at (x, y): a lit head, its shadow below-right. */
export function rivet(img, x, y, head, shade, glint) {
  putTexel(img, x - 1, y - 1, head); putTexel(img, x, y - 1, glint); putTexel(img, x - 1, y, head); putTexel(img, x, y, head);
  putTexel(img, x + 1, y, shade); putTexel(img, x, y + 1, shade); putTexel(img, x + 1, y + 1, shade);
}
/** Every colour of `ramps` (each a list of [r, g, b]), flattened - a picture's palette. */
export const paletteOf = (...ramps) => ramps.flat().map((c) => [c[0], c[1], c[2]]);
/** Force every texel of `img` to its nearest colour of `palette` (squared distance in sRGB). The last pass of every
 *  picture: nothing between the steps survives. Returns `img`. */
export function quantize(img, palette) {
  const c = img.colors, cache = new Map();
  for (let i = 0; i < c.length; i += 4) {
    const key = (c[i] << 16) | (c[i + 1] << 8) | c[i + 2];
    let best = cache.get(key);
    if (!best) {
      let d = Infinity;
      for (const p of palette) {
        const e = (p[0] - c[i]) ** 2 + (p[1] - c[i + 1]) ** 2 + (p[2] - c[i + 2]) ** 2;
        if (e < d) { d = e; best = p; }
      }
      cache.set(key, best);
    }
    c[i] = best[0]; c[i + 1] = best[1]; c[i + 2] = best[2];
  }
  return img;
}
/** How many texels of `img` are not in `palette` (the law's own check). */
export function offPalette(img, palette) {
  const keys = new Set(palette.map((p) => (p[0] << 16) | (p[1] << 8) | p[2]));
  let n = 0;
  for (let i = 0; i < img.colors.length; i += 4) if (!keys.has((img.colors[i] << 16) | (img.colors[i + 1] << 8) | img.colors[i + 2])) n++;
  return n;
}
