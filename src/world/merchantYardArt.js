// @ts-check
// MERCHANT-YARDS (2026-10-10): THE YARDS' OWN ART, MADE AT BOOT - every picture the Stable and the Wagon Yard wear
// (world/merchantYardModels.js) is the port's, made here from noise and drawn shapes the moment a host asks
// (world/lefayArt.js's and world/gateArt.js's law: pictures of the port's own under a pseudo-archive far above any
// classic one, no renderer and no GL in this file - pixels and numbers). Nothing of Daggerfall's is read.
//
//   wood    - fence posts and rails: grey-brown weathered timber, its grain along the picture's u. Tileable.
//   plank   - the sheds' walls: upright boards, a dark seam between each, knots here and there. Tileable.
//   shingle - the sheds' roofs: rows of split cedar shingles, staggered, each its own shade. Tileable.
//   hay     - the bales and the pile: pale gold straw, streaked. Tileable.
//   dirt    - the paddock's floor: trodden earth, straw scattered over it. Tileable.
//   gravel  - the wagon yard's floor: packed grey gravel, darker stones in it. Tileable.
//   water   - the trough: dark water, a faint sheen.
//   iron    - brackets and tyres: dark iron, a little rust.
//   the two SIGNBOARDS - a dark-stained board, a painted cream border, an emblem in iron and paint (the Stable's
//   horseshoe, its opening up for luck; the Wagon Yard's wheel) and the yard's word in painted capitals beside it.
//
// Low and square-pixelled, Daggerfall's own texel size: the yards sit in the pixel world, not over it. Deterministic
// (its own mulberry32 on fixed seeds): every client's yard is the same timber.
//
// Not a DFU member. Ledger A (MERCHANT-YARDS).
import { YARD_KINDS } from '../systems/merchantYards.js';

/** The pseudo-archive the yards' pictures stand under (world/lefayMonument.js LEFAY_ARCHIVE's neighbour). */
export const YARD_ARCHIVE = 38221;
/** Its records. */
export const YARD_REC = Object.freeze({
  wood: 0, plank: 1, shingle: 2, hay: 3, dirt: 4, gravel: 5, water: 6, iron: 7, signStable: 8, signTransport: 9,
});
/** A material picture's side, texels. */
export const YARD_ART_SIZE = 64;
/** A signboard's picture, texels (world/merchantYardModels.js SIGN_BOARD is its shape: 1.6 m by 0.7). */
export const SIGN_ART_W = 224;
export const SIGN_ART_H = 96;

/** mulberry32 - the port's seeded rng (world/lefayArt.js's), kept here so the art is the yards' alone. */
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
/** Tileable value noise over an n x m lattice, sampled at (x, y) in texels of a W x H tile. */
function noiseField(seed, n, W = YARD_ART_SIZE, H = W, m = n) {
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
const image = (w, h = w) => ({ width: w, height: h, colors: new Uint8Array(w * h * 4) });
/** @param {{width:number, height:number, colors:Uint8Array}} img @param {number} x @param {number} y @param {ArrayLike<number>} rgb */
const put = (img, x, y, rgb) => {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = 255;
};
/** @param {{width:number, height:number, colors:Uint8Array}} img @param {number} x @param {number} y */
const get = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.colors[i], img.colors[i + 1], img.colors[i + 2]]; };
/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b @param {number} t @returns {number[]} */
const mix = (a, b, t) => { const k = Math.min(1, Math.max(0, t)); return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)); };

/** Fence timber: weathered grey-brown, its grain running along u (the rail's length), a darker check now and then. */
export function yardWoodArt(seed = 0x7d01) {
  const S = YARD_ART_SIZE, img = image(S);
  const grain = noiseField(seed, 2, S, S, 16), blot = noiseField(seed + 1, 4), r = rng(seed + 2);
  const DARK = [78, 64, 50], LIGHT = [142, 126, 104];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = mix(DARK, LIGHT, 0.2 + 0.55 * grain(x, y) + 0.25 * (blot(x, y) - 0.5));
    if (r() < 0.03) c = mix(c, [52, 42, 32], 0.6);
    put(img, x, y, c);
  }
  return img;
}

/** Shed boards: upright planks eight texels wide, a dark seam between them, each board its own shade, a knot or two. */
export function yardPlankArt(seed = 0x91a7) {
  const S = YARD_ART_SIZE, img = image(S);
  const grain = noiseField(seed, 16, S, S, 2), r = rng(seed + 1);
  const shades = Array.from({ length: S / 8 }, () => 0.75 + 0.35 * r());
  const BASE = [118, 88, 58], LIGHT = [160, 124, 84];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const board = Math.floor(x / 8);
    let c = mix(BASE, LIGHT, (0.15 + 0.6 * grain(x, y)) * shades[board]);
    if (x % 8 === 0) c = [58, 40, 26];
    else if (x % 8 === 7) c = mix(c, [70, 50, 32], 0.5);
    put(img, x, y, c);
  }
  for (let k = 0; k < 5; k++) {   // knots
    const kx = Math.floor(r() * S), ky = Math.floor(r() * S);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = (kx + dx + S) % S, y = (ky + dy + S) % S;
      if (x % 8 !== 0) put(img, x, y, mix(get(img, x, y), [62, 42, 24], dx === 0 && dy === 0 ? 0.8 : 0.4));
    }
  }
  return img;
}

/** Roof shingles: split cedar in rows eight texels high, each shingle its own width (five to eleven texels) and shade,
 *  grained along its length (down the roof), its foot ragged and shadowed, the rows staggered. Row 0 is the roof's
 *  ridge side. Tileable: each row's widths are cut to fill the tile exactly. */
export function yardShingleArt(seed = 0x5a1e) {
  const S = YARD_ART_SIZE, img = image(S), r = rng(seed);
  const grain = noiseField(seed + 1, 32, S, S, 4);
  const DARK = [70, 58, 50], LIGHT = [138, 118, 98];
  for (let row = 0; row < S / 8; row++) {
    const cuts = [0];   // each shingle's left edge across the row, then the row turned by a stagger
    while (cuts[cuts.length - 1] < S - 11) cuts.push(cuts[cuts.length - 1] + 5 + Math.floor(r() * 7));
    const shift = Math.floor(r() * S), shade = cuts.map(() => 0.55 + 0.45 * r()), ragged = Array.from({ length: S }, () => (r() < 0.35 ? 1 : 0));
    for (let y = row * 8; y < row * 8 + 8; y++) for (let x0 = 0; x0 < S; x0++) {
      const x = (x0 + shift) % S;
      let k = 0;
      while (k + 1 < cuts.length && cuts[k + 1] <= x0) k++;
      let c = mix(DARK, LIGHT, shade[k] * (0.55 + 0.45 * grain(x, y)));
      const foot = row * 8 + 7 - ragged[x0];
      if (y >= foot) c = mix(c, [28, 22, 18], 0.75);
      else if (x0 === cuts[k]) c = mix(c, [36, 28, 22], 0.7);
      put(img, x, y, c);
    }
  }
  return img;
}

/** Straw: pale gold, streaked along u. */
export function yardHayArt(seed = 0x4a77) {
  const S = YARD_ART_SIZE, img = image(S);
  const streak = noiseField(seed, 2, S, S, 32), blot = noiseField(seed + 1, 4);
  const DEEP = [150, 116, 48], PALE = [222, 194, 112];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix(DEEP, PALE, 0.25 + 0.6 * streak(x, y) + 0.2 * (blot(x, y) - 0.5)));
  return img;
}

/** The paddock's floor: trodden brown earth, a straw scattered over it. */
export function yardDirtArt(seed = 0xd127) {
  const S = YARD_ART_SIZE, img = image(S);
  const n = noiseField(seed, 8), fine = noiseField(seed + 1, 32), r = rng(seed + 2);
  const DARK = [74, 56, 38], LIGHT = [122, 96, 66];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix(DARK, LIGHT, 0.3 + 0.45 * n(x, y) + 0.25 * (fine(x, y) - 0.5)));
  for (let k = 0; k < 40; k++) {   // straws: short pale strokes, any slant
    let x = r() * S, y = r() * S;
    const a = r() * Math.PI, len = 3 + Math.floor(r() * 4);
    for (let i = 0; i < len; i++) { put(img, (Math.floor(x) + S) % S, (Math.floor(y) + S) % S, [196, 168, 92]); x += Math.cos(a); y += Math.sin(a); }
  }
  return img;
}

/** The wagon yard's floor: packed grey gravel, darker stones and lighter ones in it. */
export function yardGravelArt(seed = 0x6a3e) {
  const S = YARD_ART_SIZE, img = image(S);
  const n = noiseField(seed, 8), r = rng(seed + 1);
  const DARK = [92, 88, 80], LIGHT = [140, 134, 122];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = mix(DARK, LIGHT, 0.3 + 0.5 * n(x, y));
    const g = r();
    if (g < 0.12) c = mix(c, [58, 54, 50], 0.6);
    else if (g > 0.9) c = mix(c, [176, 170, 158], 0.5);
    put(img, x, y, c);
  }
  return img;
}

/** The trough's water: dark, a faint sheen across it. */
export function yardWaterArt(seed = 0x3a7e) {
  const S = 32, img = image(S);
  const n = noiseField(seed, 4, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix([28, 40, 44], [74, 98, 102], 0.3 + 0.5 * n(x, y) * (0.6 + 0.4 * Math.sin(((x + y) / S) * Math.PI * 6))));   // a sheen that tiles
  return img;
}

/** Dark iron, a little rust in it. */
const IRON_DARK = [40, 38, 38];
const IRON_LIGHT = [92, 88, 86];
export function yardIronArt(seed = 0x1207) {
  const S = 32, img = image(S);
  const n = noiseField(seed, 4, S), r = rng(seed + 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = mix(IRON_DARK, IRON_LIGHT, 0.3 + 0.5 * n(x, y));
    if (r() < 0.06) c = mix(c, [118, 62, 30], 0.5);
    put(img, x, y, c);
  }
  return img;
}

// ── THE SIGNBOARDS ───────────────────────────────────────────────────────────────────────────────────────────────
/** THE SIGN-PAINTER'S LETTERS: rounded capitals five texels wide and seven high, one row a string, `#` painted. Only the
 *  letters a yard's word needs are drawn; signGlyph answers null for any other (the test holds both words to them). */
export const SIGN_GLYPHS = Object.freeze({
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
});
export const SIGN_GLYPH_W = 5;
export const SIGN_GLYPH_H = 7;
/** A letter's glyph, or null. */
export const signGlyph = (ch) => SIGN_GLYPHS[ch] ?? null;
/** The scale the yard's word is painted at, texels a glyph texel. */
export const SIGN_LETTER_SCALE = 3;
/** The emblem's square on the board's left, texels. */
export const SIGN_EMBLEM = 80;

const BOARD_DARK = [52, 34, 22];
const BOARD_LIGHT = [92, 62, 38];
const PAINT = [232, 214, 166];
const PAINT_SHADOW = [26, 16, 10];

/** The board itself: dark-stained horizontal planks, a seam between each, and the cream border painted round it. */
function board(seed) {
  const W = SIGN_ART_W, H = SIGN_ART_H, img = image(W, H);
  const grain = noiseField(seed, 4, W, H, 24);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = mix(BOARD_DARK, BOARD_LIGHT, 0.2 + 0.6 * grain(x, y));
    if (y % 24 === 0) c = [30, 20, 12];
    put(img, x, y, c);
  }
  const B = 4, IN = 7;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d >= B && d < B + 2) put(img, x, y, PAINT);
    else if (d === IN) put(img, x, y, mix(PAINT, BOARD_DARK, 0.45));   // a thin inner line, half worn
  }
  return img;
}
/** The yard's word, painted in SIGN_GLYPHS at SIGN_LETTER_SCALE, centred in the board's right part, its shadow a texel
 *  down and right. */
function paintWord(img, word) {
  const s = SIGN_LETTER_SCALE, W = img.width, H = img.height;
  const width = (word.length * (SIGN_GLYPH_W + 1) - 1) * s;
  const left = SIGN_EMBLEM + Math.round((W - SIGN_EMBLEM - 8 - width) / 2), top = Math.round((H - SIGN_GLYPH_H * s) / 2);
  const cells = [];
  [...word].forEach((ch, k) => {
    const g = signGlyph(ch);
    if (!g) return;
    for (let gy = 0; gy < SIGN_GLYPH_H; gy++) for (let gx = 0; gx < SIGN_GLYPH_W; gx++) {
      if (g[gy][gx] !== '#') continue;
      for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) cells.push([left + (k * (SIGN_GLYPH_W + 1) + gx) * s + sx, top + gy * s + sy]);
    }
  });
  for (const [x, y] of cells) put(img, x + 1, y + 1, PAINT_SHADOW);
  for (const [x, y] of cells) put(img, x, y, PAINT);
}
/** The Stable's horseshoe, its opening up for luck: a thick iron ring with a gap at its top HORSESHOE_GAP either side of
 *  straight up, lit along its upper left, a painted cream edge round it so it reads on the dark board, and eight nail
 *  holes round its middle. */
export const HORSESHOE_GAP = 0.62;
function paintHorseshoe(img) {
  const cx = SIGN_EMBLEM / 2 + 4, cy = SIGN_ART_H / 2 + 2, R0 = 17, R1 = 31;
  const shoe = (x, y) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r < R0 || r > R1) return false;
    return Math.abs(Math.atan2(dx, -dy)) > HORSESHOE_GAP;   // 0 straight up: the gap
  };
  for (let y = 0; y < SIGN_ART_H; y++) for (let x = 0; x < SIGN_EMBLEM + 8; x++) {
    if (shoe(x, y)) continue;
    if (shoe(x - 1, y) || shoe(x + 1, y) || shoe(x, y - 1) || shoe(x, y + 1)) put(img, x, y, PAINT);   // the painted edge
  }
  for (let y = 0; y < SIGN_ART_H; y++) for (let x = 0; x < SIGN_EMBLEM + 8; x++) {
    if (!shoe(x, y)) continue;
    const dx = x - cx, dy = y - cy, across = (Math.hypot(dx, dy) - R0) / (R1 - R0);
    put(img, x, y, mix([150, 146, 142], IRON_DARK, 0.25 + 0.45 * across + 0.25 * ((dx + dy) / (2 * R1) + 0.5)));
  }
  const MID = (R0 + R1) / 2;
  for (let k = 0; k < 8; k++) {   // the nail holes, four down each side of the shoe
    const side = k < 4 ? -1 : 1, t = (k % 4) / 3;
    const a = side * (HORSESHOE_GAP + 0.45 + t * 1.55);   // from beside the gap round toward the toe
    const hx = Math.round(cx + Math.sin(a) * MID), hy = Math.round(cy - Math.cos(a) * MID);
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(img, hx + ox, hy + oy, [18, 16, 16]);
  }
}
/** The Wagon Yard's wheel: a wooden felloe in an iron tyre, eight spokes, an iron-capped hub. */
function paintWheel(img) {
  const cx = SIGN_EMBLEM / 2 + 4, cy = SIGN_ART_H / 2, R = 32, TYRE = 3, FELLOE = 6, HUB = 8;
  const WOOD = [168, 120, 70], WOOD_DARK = [112, 76, 42];
  for (let y = 0; y < SIGN_ART_H; y++) for (let x = 0; x < SIGN_EMBLEM + 8; x++) {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r > R) continue;
    if (r > R - TYRE) { put(img, x, y, mix(IRON_LIGHT, IRON_DARK, (r - (R - TYRE)) / TYRE)); continue; }
    if (r > R - TYRE - FELLOE) { put(img, x, y, mix(WOOD, WOOD_DARK, (dx + dy) / (2 * R) + 0.4)); continue; }
    if (r <= HUB) { put(img, x, y, r <= HUB - 3 ? IRON_LIGHT : IRON_DARK); continue; }
    const a = Math.atan2(dy, dx), spoke = (Math.abs(Math.sin(a * 4)) * r) / 4;   // eight spokes: about the texels off the nearest
    if (spoke < 1.9) put(img, x, y, mix(WOOD, WOOD_DARK, spoke / 2.4));
  }
}

/** A yard's signboard: the board, its emblem and its word (systems/merchantYards.js YARD_KINDS `sign`). Row 0 is the
 *  board's top (world/merchantYardModels.js maps its faces so). */
export function yardSignArt(kind) {
  const img = board(kind === 'transport' ? 0x51a9 : 0x51a5);
  if (kind === 'transport') paintWheel(img); else paintHorseshoe(img);
  paintWord(img, YARD_KINDS[kind === 'transport' ? 'transport' : 'stable'].sign);
  return img;
}

/** Every picture the yards wear, by record - what a host uploads under YARD_ARCHIVE before it draws. */
export const yardArt = () => [
  [YARD_REC.wood, yardWoodArt()],
  [YARD_REC.plank, yardPlankArt()],
  [YARD_REC.shingle, yardShingleArt()],
  [YARD_REC.hay, yardHayArt()],
  [YARD_REC.dirt, yardDirtArt()],
  [YARD_REC.gravel, yardGravelArt()],
  [YARD_REC.water, yardWaterArt()],
  [YARD_REC.iron, yardIronArt()],
  [YARD_REC.signStable, yardSignArt('stable')],
  [YARD_REC.signTransport, yardSignArt('transport')],
];
