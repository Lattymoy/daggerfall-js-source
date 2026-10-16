// @ts-check
// LEFAY1 (2026-10-08): THE MONUMENT'S OWN ART, MADE AT BOOT - the stone of the monument to Julian LeFay
// (world/lefayMonument.js) is the port's, so it is made here from noise the moment a host asks (world/gateArt.js's
// law: pictures of the port's own under a pseudo-archive far above any classic one, no renderer and no GL in this
// file - pixels and numbers).
//
//   granite - the steps: a cool grey, speckled dark and light. Tileable.
//   marble  - the pedestal and the obelisk: a pale stone, veined faintly grey. Tileable.
//   gilt    - the obelisk's point: a warm gold, burnished in bands.
//   plaque  - bronze, its border bevelled, the inscription (LEFAY_TEXT.plaque) cut into it in square capitals: the
//             name and the years twice the size of the two lines under them.
//   bronze  - the plaque's edges: the plate's own metal, plain.
//
// Low and square-pixelled, Daggerfall's own texel size: the monument sits in the pixel world, not over it.
// Deterministic (its own mulberry32 on fixed seeds): every client's monument is the same stone.
//
// Not a DFU member. Ledger A (LEFAY).
import { LEFAY_GRANITE, LEFAY_MARBLE, LEFAY_GILT, LEFAY_PLAQUE, LEFAY_BRONZE, LEFAY_TEXT } from './lefayMonument.js';

/** A stone picture's side, texels. */
export const LEFAY_ART_SIZE = 64;
/** The plaque's picture, texels (its shape is the plaque's, world/lefayMonument.js PLAQUE: 1.0 m by 0.8). */
export const LEFAY_PLAQUE_W = 160;
export const LEFAY_PLAQUE_H = 128;

/** mulberry32, the port's seeded rng (world/gateArt.js's own), kept here so the art is the monument's alone. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Tileable value noise over an n x n lattice, sampled at (x, y) in texels of an S-texel tile. */
function noiseField(seed, n, S = LEFAY_ART_SIZE) {
  const r = rng(seed);
  const lat = Float32Array.from({ length: n * n }, () => r());
  const at = (i, j) => lat[((j % n + n) % n) * n + ((i % n + n) % n)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / S) * n, fy = (y / S) * n;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = smooth(fx - i), ty = smooth(fy - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
const image = (w, h = w) => ({ width: w, height: h, colors: new Uint8Array(w * h * 4) });
/** @param {{width:number, height:number, colors:Uint8Array}} img @param {number} x @param {number} y @param {ArrayLike<number>} rgb */
const put = (img, x, y, rgb) => {
  const i = (y * img.width + x) * 4;
  img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = 255;
};
/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b @param {number} t @returns {number[]} */
const mix = (a, b, t) => { const k = Math.min(1, Math.max(0, t)); return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)); };

/** The steps' granite: a cool grey, mottled, speckled with dark and light grains. */
export function lefayGraniteArt(seed = 0x1e6a) {
  const S = LEFAY_ART_SIZE, img = image(S);
  const coarse = noiseField(seed, 8), r = rng(seed + 3);
  const DARK = [86, 88, 92], LIGHT = [148, 150, 152];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = mix(DARK, LIGHT, 0.25 + 0.6 * coarse(x, y));
    const g = r();
    if (g < 0.08) c = mix(c, [40, 40, 44], 0.7);
    else if (g > 0.95) c = mix(c, [210, 206, 200], 0.6);
    put(img, x, y, c);
  }
  return img;
}

/** The pedestal's and the obelisk's marble: a warm white, clouded, with faint grey veins wandering across it. */
export function lefayMarbleArt(seed = 0x3a7b) {
  const S = LEFAY_ART_SIZE, img = image(S);
  const cloud = noiseField(seed, 4), vein = noiseField(seed + 1, 8);
  const BASE = [214, 210, 200], SHADE = [186, 182, 174], VEIN = [128, 126, 124];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = mix(BASE, SHADE, cloud(x, y) * 0.8);
    // a vein where the field crosses its middle, thin and broken
    const v = Math.abs(vein(x, y) - 0.5);
    put(img, x, y, v < 0.02 ? mix(c, VEIN, 0.45 - v * 10) : c);
  }
  return img;
}

/** The point's gilt: gold, burnished in bands across it. */
export function lefayGiltArt(seed = 0x9117) {
  const S = 32, img = image(S);
  const n = noiseField(seed, 4, S);
  const DEEP = [150, 104, 30], BRIGHT = [244, 204, 96];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix(DEEP, BRIGHT, 0.5 + 0.35 * Math.sin((y / S) * Math.PI * 4) * 0.6 + 0.4 * (n(x, y) - 0.5)));
  return img;
}

/** The plaque's metal: a dark bronze, faintly mottled (the plate, and its plain edges). */
const BRONZE_DARK = [70, 50, 26];
const BRONZE_LIGHT = [128, 94, 48];
export function lefayBronzeArt(seed = 0xb802) {
  const S = 32, img = image(S);
  const n = noiseField(seed, 4, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix(BRONZE_DARK, BRONZE_LIGHT, 0.35 + 0.5 * n(x, y)));
  return img;
}

/** THE PLAQUE'S LETTERS: square capitals five texels wide and seven high, one row a string, `#` cut. Only the glyphs
 *  an inscription here needs are drawn; lefayGlyph answers null for any other (the test holds the plaque to them). */
export const LEFAY_GLYPHS = Object.freeze({
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
});
export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** A character's glyph, or null. */
export const lefayGlyph = (ch) => LEFAY_GLYPHS[ch] ?? null;
/** A line's width in texels at `scale`: GLYPH_W + one texel between letters, each. */
export const lineWidth = (text, scale) => (text.length * (GLYPH_W + 1) - 1) * scale;

/** The plaque's lines: the first two at twice the size, the last two at the glyphs' own. */
export const PLAQUE_SCALES = Object.freeze([2, 2, 1, 1]);

/**
 * THE PLAQUE: bronze, a bevelled border (light along its top and left, dark along its bottom and right), and the
 * inscription cut into it, each line centred - a cut letter dark at its floor, its lower right lip catching the light.
 * Row 0 is the plaque's top (world/lefayMonument.js maps its face so).
 */
export function lefayPlaqueArt(lines = LEFAY_TEXT.plaque, seed = 0x91a0) {
  const W = LEFAY_PLAQUE_W, H = LEFAY_PLAQUE_H, img = image(W, H);
  const n = noiseField(seed, 8, W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(img, x, y, mix(BRONZE_DARK, BRONZE_LIGHT, 0.45 + 0.35 * n(x, y)));
  const BEVEL = 4, LIT = [176, 138, 76], SHADOW = [44, 30, 14];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d >= BEVEL) continue;
    const lit = x < BEVEL && x <= y && x <= H - 1 - y ? true : y < BEVEL && y <= x && y <= W - 1 - x;
    put(img, x, y, lit ? LIT : SHADOW);
  }
  // the lines, stacked down the plaque's middle with a gap of their height's half between them
  const heights = lines.map((_, i) => GLYPH_H * (PLAQUE_SCALES[i] ?? 1));
  const gaps = heights.slice(1).map((h, i) => Math.round(Math.max(h, heights[i]) / 2) + 2);
  const total = heights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  let top = Math.round((H - total) / 2);
  const cut = new Uint8Array(W * H);
  lines.forEach((text, i) => {
    const s = PLAQUE_SCALES[i] ?? 1, left = Math.round((W - lineWidth(text, s)) / 2);
    [...text].forEach((ch, k) => {
      const g = lefayGlyph(ch);
      if (!g) return;
      for (let gy = 0; gy < GLYPH_H; gy++) for (let gx = 0; gx < GLYPH_W; gx++) {
        if (g[gy][gx] !== '#') continue;
        for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
          const x = left + (k * (GLYPH_W + 1) + gx) * s + sx, y = top + gy * s + sy;
          if (x >= 0 && y >= 0 && x < W && y < H) cut[y * W + x] = 1;
        }
      }
    });
    top += heights[i] + (gaps[i] ?? 0);
  });
  const FLOOR = [34, 22, 10], LIP = [196, 160, 92];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (cut[y * W + x]) put(img, x, y, FLOOR);
    else if ((x > 0 && cut[y * W + x - 1]) || (y > 0 && cut[(y - 1) * W + x])) put(img, x, y, LIP);   // the lip below and right of a cut
  }
  return img;
}

/** Every picture the monument wears, by record - what a host uploads under LEFAY_ARCHIVE before it draws. */
export const lefayArt = () => [
  [LEFAY_GRANITE, lefayGraniteArt()],
  [LEFAY_MARBLE, lefayMarbleArt()],
  [LEFAY_GILT, lefayGiltArt()],
  [LEFAY_PLAQUE, lefayPlaqueArt()],
  [LEFAY_BRONZE, lefayBronzeArt()],
];
