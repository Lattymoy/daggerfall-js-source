// @ts-check
// GUILD-SHOP (2026-10-30, the owner: "Guild insignia and sail customization for ships"; bible/11-Multiplayer/Guild-Shop.md):
// A SHIP'S SAILCLOTH - a pattern in two paints and, where her captain flies them, the guild's arms on the sail. Her first
// paint is her livery's sail (shipLivery.js), the second the cloth's own; the arms are her owner's guild's, read by its
// tag (a peer's off their signed token). Bought once as the Guild Sailcloth (guildShopLaw.js `guildsails`), for every ship
// on the account. The cloth rides the livery's own number past its four nibbles (shipLivery.js liveryCode), so a peer
// whose build reads none of it sees her as painted before. Pure. Not a DFU member.

/** The patterns, in the designer's order - a pattern's place is its number on the wire, never renumbered. */
export const SAIL_PATTERNS = Object.freeze(['plain', 'stripes', 'bands', 'quartered', 'chevron', 'cross', 'border', 'saltire']);
/** The last paint a second colour may be (shipLivery.js PAINT_MAX - a pin holds the two equal). */
export const SAIL_SECOND_MAX = 14;
/** The emblem's width, of the sail's. */
export const SAIL_EMBLEM_FRACTION = 0.46;

/**
 * A sailcloth through its door: `{ pattern, second, arms }` - a pattern by name, the second paint's index (the livery's
 * own paints, 0 her canvas), whether her guild's arms fly on it - or null for none (plain, no arms) or a field refused.
 * @param {any} raw
 */
export function sailClothOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pattern = raw.pattern ?? 'plain', second = raw.second ?? 0, arms = raw.arms === true;
  if (!SAIL_PATTERNS.includes(pattern) || !Number.isInteger(second) || second < 0 || second > SAIL_SECOND_MAX) return null;
  return pattern === 'plain' && !arms ? null : { pattern, second: pattern === 'plain' ? 0 : second, arms };   // a plain cloth shows no second paint
}
/** A sailcloth as one byte (0 for none): its pattern's three bits, its second paint's four, its arms' one. */
export const sailClothCode = (/** @type {any} */ raw) => { const c = sailClothOf(raw); return c ? SAIL_PATTERNS.indexOf(c.pattern) | (c.second << 3) | (c.arms ? 128 : 0) : 0; };
/** The byte as a sailcloth, or null. */
export const sailClothOfCode = (/** @type {unknown} */ n) => (Number.isInteger(n) && /** @type {number} */ (n) > 0 && /** @type {number} */ (n) < 256
  ? sailClothOf({ pattern: SAIL_PATTERNS[/** @type {number} */ (n) & 7], second: (/** @type {number} */ (n) >> 3) & 15, arms: (/** @type {number} */ (n) & 128) !== 0 }) : null);

/** Whether the texel at (`u`, `v`) - each 0..1 across the sail and down it - wears the pattern's second paint. Pure. */
export function sailSecond(/** @type {string} */ pattern, /** @type {number} */ u, /** @type {number} */ v) {
  switch (pattern) {
    case 'stripes': return Math.floor(u * 6) % 2 === 1;
    case 'bands': return Math.floor(v * 5) % 2 === 1;
    case 'quartered': return (u < 0.5) !== (v < 0.5);
    case 'chevron': return v > 0.35 + Math.abs(u - 0.5) * 0.9 && v < 0.6 + Math.abs(u - 0.5) * 0.9;
    case 'cross': return Math.abs(u - 0.42) < 0.07 || Math.abs(v - 0.45) < 0.07;
    case 'border': return u < 0.09 || u > 0.91 || v < 0.09 || v > 0.91;
    case 'saltire': return Math.abs(u - v) < 0.08 || Math.abs(u + v - 1) < 0.08;
    default: return false;
  }
}

/**
 * THE SAIL IN ITS CLOTH: picture `pic` (`{ width, height, data }`, top-down RGBA - the sail's canvas, the light of its
 * cloth in it) shaded texel by texel by `first` or `second` (RGB) as `cloth.pattern` lays them, each against `base` (the
 * cloth's own colour - its seams and dirt kept), and `emblem` (a square RGBA picture, `{ width, height, data }`) laid over
 * its middle, a little above it. A new picture; `pic` untouched. Pure.
 * @param {any} pic @param {ArrayLike<number>} first @param {ArrayLike<number>} second @param {any} cloth @param {ArrayLike<number>} base @param {any} [emblem]
 */
export function clothPicture(pic, first, second, cloth, base, emblem = null) {
  const W = pic.width, H = pic.height, data = new Uint8Array(pic.data), baseL = lum(base);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!data[i + 3]) continue;
    const paint = sailSecond(cloth.pattern, (x + 0.5) / W, (y + 0.5) / H) ? second : first;
    const k = lum([data[i], data[i + 1], data[i + 2]]) / baseL;
    for (let c = 0; c < 3; c++) data[i + c] = clamp8(paint[c] * k);
  }
  if (emblem && cloth.arms) {
    const S = Math.max(4, Math.round(W * SAIL_EMBLEM_FRACTION)), x0 = Math.round((W - S) / 2), y0 = Math.round(H * 0.4 - S / 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const ex = Math.floor((x / S) * emblem.width), ey = Math.floor((y / S) * emblem.height), e = (ey * emblem.width + ex) * 4;
      const a = emblem.data[e + 3] / 255, px = x0 + x, py = y0 + y;
      if (a <= 0 || px < 0 || py < 0 || px >= W || py >= H) continue;
      const i = (py * W + px) * 4;
      if (!data[i + 3]) continue;
      const k = Math.min(1.15, lum([pic.data[i], pic.data[i + 1], pic.data[i + 2]]) / baseL);   // the cloth's light through it
      for (let c = 0; c < 3; c++) data[i + c] = clamp8(data[i + c] * (1 - a) + emblem.data[e + c] * k * a);
    }
  }
  return { ...pic, data };
}
const lum = (/** @type {ArrayLike<number>} */ c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] || 1;
const clamp8 = (/** @type {number} */ v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
