// @ts-check
// DRAGON7 (2026-10-29, the owner: "Rare chance of a "shiny" varient to spawn with different colors"; bible/11-Multiplayer/
// Dwarven-Dragon.md section 11): THE AETHERBRIGHT'S COLOURS, ONE HOME. The dragon's pictures are indexed PNGs, so the
// Aetherbright is the same pixels under another palette: each PLTE colour turned at load - the brass and the copper to
// the blue of aetherium, the wings' olive membrane to the violet of its light, the greys cooled - and the chunk's CRC
// written again. No new picture ships: archive 1801 is 1800's pictures so turned, and the saddle's the same.
import { crc32 } from '../systems/save/saveTransfer.js'; // a PNG chunk's CRC, as poi/poiThumb.js takes it

/** Hues (degrees) and the bands they are read in: under WING_LO is the brass, WING_LO to WING_HI the wings' membrane. */
export const AETHER_HUE = 200;
export const AETHER_WING_HUE = 275;
export const WING_LO = 45,
  WING_HI = 75;
/** Under this saturation a colour is a grey (the rivets, the shadows): cooled, never turned. */
export const GREY_SAT = 0.15;

/** @param {number} r @param {number} g @param {number} b 0..1 -> [h 0..360, s, v] */
function hsv(r, g, b) {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, mx > 0 ? d / mx : 0, mx];
}
/** @param {number} h @param {number} s @param {number} v -> [r, g, b] 0..255 */
function rgb(h, s, v) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((q) => Math.max(0, Math.min(255, Math.round((q + m) * 255))));
}

/** One colour of the brass dragon as the Aetherbright wears it. @param {number} r @param {number} g @param {number} b */
export function aetherbrightColour(r, g, b) {
  const [h, s, v] = hsv(r / 255, g / 255, b / 255);
  if (s < GREY_SAT) return rgb(AETHER_HUE + 10, Math.max(s, 0.08), v);
  if (h >= WING_LO && h < WING_HI) return rgb(AETHER_WING_HUE, Math.min(1, s * 1.1), v);
  return rgb(AETHER_HUE, Math.min(1, s * 1.05), Math.min(1, v * 1.08));
}

/** A PLTE chunk's body turned, entry by entry. @param {Uint8Array} plte */
export function aetherbrightPalette(plte) {
  const out = new Uint8Array(plte.length);
  for (let i = 0; i + 2 < plte.length; i += 3) out.set(aetherbrightColour(plte[i], plte[i + 1], plte[i + 2]), i);
  return out;
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const be32 = (/** @type {Uint8Array} */ b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
/** An indexed PNG with its palette turned and the chunk's CRC written again; any other bytes answer as they came (a
 *  truecolour picture has no PLTE to turn, and is drawn brass rather than not at all). @param {Uint8Array} png */
export function aetherbrightPng(png) {
  if (!(png instanceof Uint8Array) || png.length < 8 || PNG_SIG.some((v, i) => png[i] !== v)) return png;
  const out = png.slice();
  for (let i = 8; i + 12 <= out.length;) {
    const n = be32(out, i),
      type = String.fromCharCode(out[i + 4], out[i + 5], out[i + 6], out[i + 7]);
    if (i + 12 + n > out.length) return png;
    if (type === 'PLTE') {
      out.set(aetherbrightPalette(out.subarray(i + 8, i + 8 + n)), i + 8);
      const crc = crc32(out.subarray(i + 4, i + 8 + n));
      out.set([crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255], i + 8 + n);
      return out;
    }
    if (type === 'IDAT' || type === 'IEND') return png; // a palette comes before the pixels, or not at all
    i += 12 + n;
  }
  return png;
}

/** A picture of the dragon's art at `url`, turned, as an object URL a loader fetches (the saddle's): null where it cannot
 *  be had. @param {string} url @param {{ fetchBytes?: (u: string) => Promise<Uint8Array> }} [o] */
export async function aetherbrightUrl(url, { fetchBytes } = {}) {
  try {
    const bytes = fetchBytes ? await fetchBytes(url) : new Uint8Array(await (await fetch(url)).arrayBuffer());
    return URL.createObjectURL(new Blob([new Uint8Array(aetherbrightPng(bytes))], { type: 'image/png' }));
  } catch {
    return null;
  }
}
