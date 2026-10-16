// @ts-check
// DF-LOOK (2026-10-15, Mac: "we recently took away custom textures for certain models. Is there any way to revert those
// changes and instead make those textures more daggerfall-esq"; asked, every model DF-ART dressed - the ships, the wagons
// and the caravan, the yards and the port, the LeFay monument, the town's hangings - and the look, "Palette + grain"):
// THE PORT'S OWN PAINTED PICTURES, IN DAGGERFALL'S OWN COLOURS.
//
// DF-ART (bible/01-Overview/DF-Art.md) had those models wear Daggerfall's records in place of their painted art. DF-LOOK
// gives them their painted art back - every livery, board, emblem and charge - and lays Daggerfall's look over it at
// the upload: each texel GRAINED (its light jittered, half by the texel and half by its 2 x 2 block - the clumped grain
// a classic wall carries where the painted noise ran smooth) and then SNAPPED to the nearest colour of the player's own
// ART_PAL.COL - the 255 colours every TEXTURE record is drawn in (index 0 is a record's clear texel, never a colour),
// nearest in OKLab with hue weighed above light. So a painted gradient falls into Daggerfall's own steps, and each hue
// onto the ramp Daggerfall paints it with.
//
// The palette is the player's (Port-Doctrine: nothing of Daggerfall's ships): the data pipeline hands over the one it
// loaded (`setDfLookPalette` - scenes/dataPipeline.js), and with none (no pipeline up, or a test's) a picture goes up as
// painted. A texel's grain is a hash of its picture's seed and its place, so every client's galleon is the same ship,
// a tiling picture's grain has no seam, and a picture's alpha is never touched (a cut-out keeps its holes).

/** How far a texel's light is jittered either way, in 0-255 steps of each channel: measured against TEXTURE.050, .054
 *  and .067, whose texels step 3-15 in light from their neighbours (bible/01-Overview/DF-Art.md, DF-LOOK). Half of it is
 *  the texel's own and half its 2 x 2 block's - a classic wall's grain comes in clumps, not single texels. */
export const DF_GRAIN = 10;

/** @type {{ getRed(i: number): number, getGreen(i: number): number, getBlue(i: number): number } | null} */
let _palette = null;
/** @type {Int16Array | null} */
let _lut = null;   // a 6-bit-a-channel colour -> its nearest palette index, filled as asked (-1 not yet)
/** @type {Uint8Array | null} */
let _rgb = null;   // the palette's 256 colours, flat
/** @type {Float32Array | null} */
let _lab = null;   // the palette in OKLab, flat

/** The palette DF-LOOK snaps to - the data pipeline's ART_PAL.COL (a DFPalette), or null to paint as painted. */
export function setDfLookPalette(/** @type {any} */ palette) {
  if (palette === _palette) return;
  _palette = palette ?? null;
  _lut = null; _rgb = null; _lab = null;
  if (!_palette) return;
  _rgb = new Uint8Array(256 * 3); _lab = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    _rgb[i * 3] = _palette.getRed(i); _rgb[i * 3 + 1] = _palette.getGreen(i); _rgb[i * 3 + 2] = _palette.getBlue(i);
    _lab.set(oklab(_rgb[i * 3], _rgb[i * 3 + 1], _rgb[i * 3 + 2]), i * 3);
  }
  _lut = new Int16Array(1 << 18).fill(-1);
}
/** Whether a palette is set (the look is laid on). */
export const dfLookOn = () => _palette != null;

/** A colour in OKLab (Ottosson's: L its lightness, a and b its hue and chroma, each step about as far to the eye). */
export function oklab(r, g, b) {
  const lin = (/** @type {number} */ c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
/** How much farther a step in hue counts than a step in light: the grain moves a texel along its own hue's ramp, so a
 *  sail stays canvas and an oxblood strake oxblood rather than hopping to the next hue the palette holds (at 3, 3% of a
 *  cream canvas's texels still went to the palette's pale mint, 202,221,196; at 4, none - DF-LOOK, measured). */
export const HUE_WEIGHT = 4;
/** The palette index nearest a colour (1-255 - index 0 is a record's clear texel, never a colour), in OKLab, hue weighed
 *  HUE_WEIGHT. All 255: the tans a cream canvas needs (16-31) are rare on Daggerfall's walls, and without them a sail
 *  breaks into peach, mint and grey (DF-LOOK, measured). */
export function nearestIndex(/** @type {Float32Array} */ lab, r, g, b) {
  const [L, A, B] = oklab(r, g, b);
  let best = 1, bestD = Infinity;
  for (let i = 1; i < 256; i++) {
    const dl = L - lab[i * 3], da = A - lab[i * 3 + 1], db = B - lab[i * 3 + 2];
    const d = dl * dl + HUE_WEIGHT * HUE_WEIGHT * (da * da + db * db);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** A texel's grain, -1..1: a hash of the picture's seed and the texel's place (no stream - a texel's grain is its own). */
export function texelGrain(seed, x, y) {
  let h = Math.imul(seed ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(x + 1, 0xC2B2AE35) ^ Math.imul(y + 1, 0x27D4EB2F);
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D);
  h = Math.imul(h ^ (h >>> 12), 0x297A2D39);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

/** A picture's seed from its archive and record - each record its own grain. */
export const lookSeed = (archive, record) => (Math.imul(archive | 0, 1000003) + (record | 0)) | 0;

/**
 * THE DAGGERFALL LOOK: a painted picture grained and snapped to the palette - a new picture of the same shape (`data`, a
 * picture's RGBA, or `colors`, the port rows' - world/portArt.js), its alpha untouched; a clear texel (alpha 0) is left
 * as it is. With no palette set, the picture itself, unchanged.
 * @template P - a picture's shape, as its host holds it (the art lists' pairs are untyped: their caller's own type)
 * @param {P} pic
 * @param {number} seed - lookSeed(archive, record)
 * @returns {P}
 */
export function dfLook(pic, seed) {
  /** @type {{ width: number, height: number, data?: Uint8Array, colors?: Uint8Array }} */
  const p = /** @type {any} */ (pic);
  if (!_rgb || !_lut || !_lab || !p) return pic;
  const src = p.data ?? p.colors;
  if (!src) return pic;
  const out = new Uint8Array(src.length), rgb = _rgb, lab = _lab, lut = _lut, w = p.width;
  for (let i = 0, t = 0; i < src.length; i += 4, t++) {
    out[i + 3] = src[i + 3];
    if (src[i + 3] === 0) { out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; continue; }
    const x = t % w, y = (t / w) | 0;
    const j = DF_GRAIN * 0.5 * (texelGrain(seed, x, y) + texelGrain(~seed, x >> 1, y >> 1));
    const r = Math.max(0, Math.min(255, src[i] + j)), g = Math.max(0, Math.min(255, src[i + 1] + j)), b = Math.max(0, Math.min(255, src[i + 2] + j));
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let idx = lut[key];
    if (idx < 0) { idx = nearestIndex(lab, (r >> 2) * 4 + 2, (g >> 2) * 4 + 2, (b >> 2) * 4 + 2); lut[key] = idx; }
    out[i] = rgb[idx * 3]; out[i + 1] = rgb[idx * 3 + 1]; out[i + 2] = rgb[idx * 3 + 2];
  }
  return /** @type {P} */ (/** @type {any} */ (p.data ? { ...p, data: out } : { ...p, colors: out }));
}
