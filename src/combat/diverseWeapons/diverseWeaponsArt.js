// OWN-WORK4 (2026-10-31; the owner: "no latching onto other mod authors"): OUR OWN DIVERSE WEAPONS ART. Every frame is
// the player's own classic WEAPON*.CIF frame, reshaped by our look (diverseWeaponsIndex.js LOOKS) and coloured by our
// metal law; the hand and arm stay Daggerfall's. No picture ships and no outside author's pixel is read.
import { CifRciFile } from '../../formats/cifRciFile.js';
import { TextureFile, texName } from '../../formats/textureFile.js';
import { DFPalette } from '../../formats/dfPalette.js';
import { LOOKS, OWN_FILES, shapeOf, DIVERSE_WEAPONS_METALS } from './diverseWeaponsIndex.js';

/** Our metal law: a metal's shadow, middle and light, which the classic metal swatch's shades are mapped onto. */
export const METAL_RAMPS = Object.freeze({
  Iron: [
    [34, 30, 28],
    [104, 97, 90],
    [180, 171, 160],
  ],
  Steel: [
    [36, 42, 52],
    [126, 136, 150],
    [228, 236, 244],
  ],
  Silver: [
    [62, 64, 74],
    [170, 174, 186],
    [252, 252, 255],
  ],
  Elven: [
    [54, 48, 16],
    [162, 148, 70],
    [246, 236, 172],
  ],
  Dwarven: [
    [58, 32, 12],
    [170, 110, 48],
    [252, 214, 140],
  ],
  Mithril: [
    [36, 52, 70],
    [128, 162, 190],
    [228, 244, 255],
  ],
  Adamantium: [
    [24, 36, 34],
    [84, 112, 106],
    [178, 208, 198],
  ],
  Ebony: [
    [8, 6, 14],
    [46, 38, 64],
    [130, 118, 174],
  ],
  Orcish: [
    [22, 32, 14],
    [74, 98, 50],
    [160, 186, 110],
  ],
  Daedric: [
    [22, 4, 4],
    [94, 20, 18],
    [234, 94, 62],
  ],
  chaos: [
    [40, 8, 56],
    [152, 40, 172],
    [246, 198, 66],
  ],
});

/** The classic metal swatch (ChangeDye's WeaponsAndArmor band), the item mask, and a fuller's shade. */
const BAND_LO = 0x70;
const BAND_HI = 0x7f;
const MASK = 0xff;
const isMetal = (i) => i >= BAND_LO && i <= BAND_HI;
export const FULLER_SHADE = 0.68;
const MIN_BLADE = 12; // fewer metal pixels than this is a sliver: coloured, never reshaped
const MIN_ELONGATION = 2; // a blade seen end on (a stab toward the eye) is no longer than this times its width: coloured

const lum = (rgb) => 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
const _rgb = new WeakMap();
/** The palette as 256 [r, g, b] - read once per palette. */
function rgbOf(palette) {
  if (!_rgb.has(palette))
    _rgb.set(
      palette,
      Array.from({ length: 256 }, (_, i) => {
        const entry = palette.get(i);
        return [entry.r, entry.g, entry.b];
      }),
    );
  return _rgb.get(palette);
}
const mix = (a, b, share) => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * share));
/** The ramp at `x` in 0..1: shadow to middle to light. */
export const rampAt = (ramp, x) => (x < 0.5 ? mix(ramp[0], ramp[1], x * 2) : mix(ramp[1], ramp[2], (x - 0.5) * 2));

/** The swatch's sixteen shades in `palette`, each placed on 0..1 by its own light. */
function swatchLight(palette) {
  const lights = [];
  for (let i = BAND_LO; i <= BAND_HI; i++) lights.push(lum(palette.get(i)));
  const lo = Math.min(...lights),
    span = Math.max(...lights) - lo || 1;
  return lights.map((light) => (light - lo) / span);
}

/** A metal's colour for each swatch shade - our dye, by light, never ChangeDye's tables. */
export function metalLut(palette, ramp) {
  return swatchLight(palette).map((x) => rampAt(ramp, x));
}

// ---- the shapes ---------------------------------------------------------------------------------------------------

/** The centroid and first principal axis of `pts` ([x, y, x, y, ...]), and how much longer than wide they lie. */
function principal(pts) {
  const n = pts.length / 2;
  let midX = 0,
    midY = 0;
  for (let i = 0; i < pts.length; i += 2) {
    midX += pts[i] / n;
    midY += pts[i + 1] / n;
  }
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i] - midX,
      dy = pts[i + 1] - midY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const mean = (sxx + syy) / 2,
    spread = Math.hypot((sxx - syy) / 2, sxy);
  return {
    midX,
    midY,
    axisX: Math.cos(ang),
    axisY: Math.sin(ang),
    elongation: Math.sqrt((mean + spread) / Math.max(1e-9, mean - spread)),
  };
}

/** The blade alone: the longest run of metal along its axis (gaps of three pixels or less bridged), so a pommel past
 *  the fist is no part of it. */
function mainRun(pts) {
  const { midX, midY, axisX, axisY } = principal(pts);
  const alongOf = (i) => Math.round((pts[i] - midX) * axisX + (pts[i + 1] - midY) * axisY);
  const count = new Map();
  for (let i = 0; i < pts.length; i += 2) count.set(alongOf(i), (count.get(alongOf(i)) ?? 0) + 1);
  const alongs = [...count.keys()].sort((a, b) => a - b);
  let best = null,
    run = null;
  for (const along of alongs) {
    if (!run || along - run.hi > 4) run = { lo: along, hi: along, n: 0 };
    run.hi = along;
    run.n += count.get(along);
    if (!best || run.n > best.n) best = { ...run };
  }
  const out = [];
  for (let i = 0; i < pts.length; i += 2)
    if (alongOf(i) >= best.lo && alongOf(i) <= best.hi) out.push(pts[i], pts[i + 1]);
  return out;
}

/** The blade's frame: its axis from base to tip, read off the metal pixels, and its centre line and half width as
 *  straight lines along it (fitted where the frame edge cannot clip it), and `mask`, the blade's own pixels. The tip
 *  is the narrow end - or, `held` in a hand, the end away from it. Null for a sliver. */
export function bladeAxis(idx, w, height, { held = false } = {}) {
  let all = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < w; x++) if (isMetal(idx[y * w + x])) all.push(x, y);
  if (all.length / 2 < MIN_BLADE) return null;
  all = mainRun(all);
  if (all.length / 2 < MIN_BLADE) return null;
  const { midX, midY, elongation } = principal(all);
  if (elongation < MIN_ELONGATION) return null;
  let { axisX, axisY } = principal(all);
  const pts = [],
    mask = new Uint8Array(w * height);
  for (let i = 0; i < all.length; i += 2) {
    pts.push(all[i] - midX, all[i + 1] - midY);
    mask[all[i + 1] * w + all[i]] = 1;
  }
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    const along = pts[i] * axisX + pts[i + 1] * axisY;
    lo = Math.min(lo, along);
    hi = Math.max(hi, along);
  }
  // the tip is the narrow end, or the end away from the hand (the drawn pixels that are not metal)
  let handX = 0,
    handY = 0,
    handN = 0;
  if (held)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < w; x++) {
        const i = idx[y * w + x];
        if (i && !isMetal(i)) {
          handX += x;
          handY += y;
          handN++;
        }
      }
  const handSide = handN ? (handX / handN - midX) * axisX + (handY / handN - midY) * axisY : 0;
  let atLo = 0,
    atHi = 0;
  const edge = (hi - lo) * 0.15;
  for (let i = 0; i < pts.length; i += 2) {
    const along = pts[i] * axisX + pts[i + 1] * axisY;
    if (along < lo + edge) atLo++;
    else if (along > hi - edge) atHi++;
  }
  if (handSide ? handSide > 0 : atLo < atHi) {
    axisX = -axisX;
    axisY = -axisY;
    [lo, hi] = [-hi, -lo];
  }
  const normX = -axisY,
    normY = axisX,
    len = Math.max(1, hi - lo);
  const bins = new Map();
  for (let i = 0; i < pts.length; i += 2) {
    const along = Math.round(pts[i] * axisX + pts[i + 1] * axisY),
      across = pts[i] * normX + pts[i + 1] * normY;
    const bin = bins.get(along) ?? [Infinity, -Infinity];
    bins.set(along, [Math.min(bin[0], across), Math.max(bin[1], across)]);
  }
  const rows = [...bins].filter(([along]) => (along - lo) / len >= 0.2 && (along - lo) / len <= 0.9);
  const fit = (val) => line(rows.length >= 4 ? rows : [...bins], val);
  return {
    midX,
    midY,
    axisX,
    axisY,
    normX,
    normY,
    lo,
    len,
    mask,
    centre: fit(([a, b]) => (a + b) / 2),
    half: fit(([a, b]) => Math.max(0.75, (b - a) / 2 + 0.5)),
  };
}

/** A least-squares line through `rows` ([along, [min, max]]) of `val` - answered as along -> value. */
function line(rows, val) {
  const n = rows.length;
  if (!n) return () => 0;
  let sumT = 0,
    sumV = 0,
    sumTT = 0,
    sumTV = 0;
  for (const [along, bin] of rows) {
    const value = val(bin);
    sumT += along;
    sumV += value;
    sumTT += along * along;
    sumTV += along * value;
  }
  const det = n * sumTT - sumT * sumT;
  if (n < 2 || Math.abs(det) < 1e-9) return () => sumV / n;
  const slope = (n * sumTV - sumT * sumV) / det,
    base = (sumV - slope * sumT) / n;
  return (along) => base + slope * along;
}

/** A held blade and what hugs it past the hilt (an enchantment's outline and sparks): they move as one, so a broader
 *  blade carries its glow out with it; the hand and the guard stay where they are. */
function withAura(idx, w, height, axis) {
  const own = Uint8Array.from(axis.mask);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < w; x++) {
      const pixel = y * w + x;
      if (!idx[pixel] || own[pixel]) continue;
      const along = (x - axis.midX) * axis.axisX + (y - axis.midY) * axis.axisY,
        across = (x - axis.midX) * axis.normX + (y - axis.midY) * axis.normY;
      if (
        along > axis.lo + 0.15 * axis.len &&
        along < axis.lo + axis.len + 3 &&
        Math.abs(across - axis.centre(along)) <= axis.half(along) + 3
      )
        own[pixel] = 1;
    }
  return own;
}

/** The pixels a held blade's rule redraws (the blade and what hugs it), or null where the frame has no blade to shape. */
export function heldBladeMask(idx, w, height) {
  const axis = bladeAxis(idx, w, height, { held: true });
  return axis ? withAura(idx, w, height, axis) : null;
}

/** A blade by our look: lengthened or shortened about its base, widened about its centre line, bent toward its tip,
 *  the point cut for a chisel, a fuller grooved. Inverse-mapped, nearest pixel: the art stays pixel art. A long blade
 *  is the whole frame (its enchantment moves with it); with `only`, the blade alone is redrawn, behind the hand that
 *  holds it. Answers the new indices and the fuller's pixels. */
export function reshapeBlade(idx, w, height, blade) {
  const axis = bladeAxis(idx, w, height, { held: !!blade.only });
  const fuller = new Uint8Array(idx.length);
  if (!axis) return { idx: Uint8Array.from(idx), fuller };
  const { midX, midY, axisX, axisY, normX, normY, lo, len, centre, half } = axis;
  const own = blade.only ? withAura(idx, w, height, axis) : null;
  const out = own ? idx.map((i, pixel) => (own[pixel] ? 0 : i)) : new Uint8Array(idx.length);
  const from = new Int32Array(idx.length).fill(-1);
  const stretch = blade.length ?? 1,
    wide = blade.width ?? 1,
    bend = (blade.curve ?? 0) * len;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - midX,
        dy = y - midY;
      const outAlong = dx * axisX + dy * axisY,
        outAcross = dx * normX + dy * normY;
      const along = outAlong < lo ? outAlong : lo + (outAlong - lo) / stretch;
      const share = Math.max(0, (along - lo) / len),
        mid = centre(along),
        edge = Math.max(0.75, half(along));
      // the blade is widened; past its new edge what hugs it (a guard's prong, a glow) moves out with it whole, so a
      // thin line keeps its pixels together
      const off = outAcross - mid - bend * share * share;
      const across = mid + (Math.abs(off) <= edge * wide ? off / wide : off - Math.sign(off) * edge * (wide - 1));
      const rel = (across - mid) / edge;
      if (blade.tip === 'chisel' && share > 0.8 + 0.1 * (1 - rel)) continue;
      const srcX = Math.round(midX + along * axisX + across * normX),
        srcY = Math.round(midY + along * axisY + across * normY);
      if (srcX < 0 || srcY < 0 || srcX >= w || srcY >= height) continue;
      if (own && (!own[srcY * w + srcX] || out[y * w + x])) continue; // the hand stays Daggerfall's
      const i = idx[srcY * w + srcX];
      out[y * w + x] = i;
      from[y * w + x] = srcY * w + srcX;
      if (blade.fuller && isMetal(i) && share > 0.05 && share < 0.78 && Math.abs(rel) < 0.2) fuller[y * w + x] = 1;
    }
  }
  return { idx: unspeckle(out, from, idx, w, height), fuller };
}

/** The drawn 8-neighbours of `pixel` in `idx`. */
function neighbours(idx, w, height, pixel) {
  const x = pixel % w,
    y = (pixel - x) / w;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < height && idx[(y + dy) * w + x + dx]) n++;
  return n;
}

/** A moved pixel left alone (one neighbour or none) whose source sat among three or more is a piece of a thin line the
 *  nearest-pixel map broke: it goes. A spark alone in the source stays. */
export function unspeckle(out, from, idx, w, height) {
  const drop = [];
  for (let pixel = 0; pixel < out.length; pixel++)
    if (out[pixel] && from[pixel] >= 0 && neighbours(out, w, height, pixel) <= 1)
      if (neighbours(idx, w, height, from[pixel]) >= 3) drop.push(pixel);
  for (const pixel of drop) out[pixel] = 0;
  return out;
}

/** One bit of a double axe: the wing on the haft's left goes, its outline and glow with it; the socket, the spike and
 *  the haft stay. The haft gives the side, so a swing keeps the same bit from frame to frame; a haft seen end on stands
 *  upright. With `palette` the haft is its wood (warm and not bright), never an enchantment's glow. */
export function singleBit(idx, w, height, palette = null) {
  const out = Uint8Array.from(idx);
  const rgb = palette && rgbOf(palette);
  const isWood = (i) => !rgb || (rgb[i][0] > rgb[i][2] + 24 && rgb[i][0] >= rgb[i][1] && rgb[i][0] < 235);
  const metal = [],
    wood = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < w; x++) {
      const i = idx[y * w + x];
      if (isMetal(i)) metal.push(x, y);
      else if (i && i !== MASK && isWood(i)) wood.push(x, y);
    }
  if (metal.length / 2 < MIN_BLADE) return out;
  const head = principal(metal),
    haft = wood.length / 2 >= MIN_BLADE ? principal(wood) : null;
  const [woodX, woodY] = haft ? [haft.midX, haft.midY] : [head.midX, head.midY];
  let [dirX, dirY] = haft && haft.elongation >= MIN_ELONGATION ? [haft.axisX, haft.axisY] : [0, -1];
  // a stub of haft across the head's foot is the haft seen end on: the socket stands square to the wings' line
  const toX = head.midX - woodX,
    toY = head.midY - woodY,
    endOn = Math.abs(toX * dirX + toY * dirY) < 0.5 * Math.hypot(toX, toY);
  if (endOn) [dirX, dirY] = [-head.axisY, head.axisX];
  if (toX * dirX + toY * dirY < 0) [dirX, dirY] = [-dirX, -dirY];
  const alongOf = (x, y) => (x - woodX) * dirX + (y - woodY) * dirY,
    acrossOf = (x, y) => (woodX - x) * dirY + (y - woodY) * dirX; // right of the haft, read base to head
  // the socket's half width: the haft's own, measured, and half again (more round a stub the frame's edge cuts)
  const spread = [];
  for (let i = 0; i < wood.length; i += 2) spread.push(Math.abs(acrossOf(wood[i], wood[i + 1])));
  spread.sort((a, b) => a - b);
  const haftHalf = Math.max(1, spread.length ? spread[Math.floor(spread.length * 0.8)] : 1);
  const keep = SOCKET * (endOn ? 1.5 : 1) * haftHalf + 1;
  let headFrom = Infinity;
  for (let i = 0; i < metal.length; i += 2) headFrom = Math.min(headFrom, alongOf(metal[i], metal[i + 1]));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < w; x++)
      if (out[y * w + x] && alongOf(x, y) >= headFrom - GLOW && acrossOf(x, y) < -keep) out[y * w + x] = 0;
  return out;
}
/** The socket's half width in the haft's, and how far an enchantment's glow reaches past the metal. */
const SOCKET = 1.6;
const GLOW = 8;

/** A staff's metal rings: the shaft's drawn pixels whose distance from the tip falls in a band (in shaft widths). */
export function staffBands(idx, w, height, bands) {
  const out = new Uint8Array(idx.length);
  const drawn = [],
    cap = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < w; x++) {
      const i = idx[y * w + x];
      if (!i) continue;
      drawn.push(x, y);
      if (isMetal(i)) cap.push(x, y);
    }
  if (drawn.length / 2 < MIN_BLADE) return out;
  const { midX, midY } = principal(drawn);
  let { axisX, axisY } = principal(drawn);
  // the tip is the capped end - else the end farther from the frame's bottom edge
  const capAt = cap.length ? principal(cap) : null;
  const towardTip = capAt ? (capAt.midX - midX) * axisX + (capAt.midY - midY) * axisY : -axisY;
  if (towardTip < 0) {
    axisX = -axisX;
    axisY = -axisY;
  }
  const normX = -axisY,
    normY = axisX;
  const alongAt = (x, y) => (x - midX) * axisX + (y - midY) * axisY;
  let tip = -Infinity;
  for (let i = 0; i < drawn.length; i += 2) tip = Math.max(tip, alongAt(drawn[i], drawn[i + 1]));
  // the shaft's width near the tip, below its cap: perspective's own measure for the rings' spacing
  const near = new Map();
  for (let i = 0; i < drawn.length; i += 2) {
    const [x, y] = [drawn[i], drawn[i + 1]];
    if (isMetal(idx[y * w + x])) continue;
    const dist = Math.round(tip - alongAt(x, y));
    if (dist > 14) continue;
    const across = (x - midX) * normX + (y - midY) * normY,
      bin = near.get(dist) ?? [Infinity, -Infinity];
    near.set(dist, [Math.min(bin[0], across), Math.max(bin[1], across)]);
  }
  let widthSum = 0;
  for (const [a, b] of near.values()) widthSum += b - a + 1;
  const shaftWidth = Math.max(2, near.size ? widthSum / near.size : 2);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < w; x++) {
      const pixel = y * w + x;
      if (!idx[pixel] || isMetal(idx[pixel])) continue;
      const dist = (tip - alongAt(x, y)) / shaftWidth;
      if (bands.some(([a, b]) => dist >= a && dist < b)) out[pixel] = 1;
    }
  return out;
}

// ---- the colour ---------------------------------------------------------------------------------------------------

/** Indices to a top-down RGBA picture: index 0 and the mask clear (0,0,0,0), the metal swatch by `lut`, a ring by the
 *  ramp at its wood's light, a fuller shaded, every other pixel Daggerfall's own colour. */
function colour(idx, w, height, palette, lut, ramp, { fuller = null, rings = null } = {}) {
  const data = new Uint8Array(w * height * 4),
    rgb = rgbOf(palette);
  const light = (i) => 0.299 * rgb[i][0] + 0.587 * rgb[i][1] + 0.114 * rgb[i][2];
  let lo = Infinity,
    hi = -Infinity;
  if (rings)
    for (let pixel = 0; pixel < idx.length; pixel++)
      if (rings[pixel]) {
        lo = Math.min(lo, light(idx[pixel]));
        hi = Math.max(hi, light(idx[pixel]));
      }
  for (let pixel = 0; pixel < idx.length; pixel++) {
    const i = idx[pixel];
    if (!i || i === MASK) continue;
    const here = rings?.[pixel]
      ? rampAt(ramp, (light(i) - lo) / (hi - lo || 1))
      : isMetal(i)
        ? lut[i - BAND_LO]
        : rgb[i];
    const shade = fuller?.[pixel] ? FULLER_SHADE : 1,
      offset = pixel * 4;
    data[offset] = Math.round(here[0] * shade);
    data[offset + 1] = Math.round(here[1] * shade);
    data[offset + 2] = Math.round(here[2] * shade);
    data[offset + 3] = 255;
  }
  return { width: w, height, data };
}

/** One first-person frame by our look: `bitmap` the classic frame's indices, `metal` a MetalTypes name. */
export function paintFrame(bitmap, palette, lookName, metal) {
  const look = LOOKS[lookName] ?? {};
  const { width: w, height } = bitmap;
  let idx = bitmap.data,
    fuller = null,
    rings = null;
  if (look.blade) ({ idx, fuller } = reshapeBlade(idx, w, height, look.blade));
  if (look.head === 'single') idx = singleBit(idx, w, height, palette);
  if (look.bands) rings = staffBands(idx, w, height, look.bands);
  const ramp = METAL_RAMPS[look.ramp ?? metal] ?? METAL_RAMPS.Steel;
  return colour(idx, w, height, palette, metalLut(palette, ramp), ramp, { fuller, rings });
}

/** An inventory or paper-doll picture: the classic record, mask and index 0 clear, its metal by our law. */
export function paintIcon(bitmap, palette, rampName) {
  const ramp = METAL_RAMPS[rampName] ?? METAL_RAMPS.Silver;
  return colour(bitmap.data, bitmap.width, bitmap.height, palette, metalLut(palette, ramp), ramp);
}

/** Scale2x (EPX): the double-size idle Weapon Widget's DoubleScaleTextures draws - edges kept, never blurred. */
export function scale2x(pic) {
  const { width: w, height, data } = pic;
  const texels = new Uint32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  const out = new Uint32Array(w * height * 4);
  const at = (x, y) => texels[Math.min(height - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < w; x++) {
      const here = at(x, y),
        above = at(x, y - 1),
        right = at(x + 1, y),
        left = at(x - 1, y),
        below = at(x, y + 1);
      const offset = y * 2 * w * 2 + x * 2;
      out[offset] = left === above && left !== below && above !== right ? above : here;
      out[offset + 1] = above === right && above !== left && right !== below ? right : here;
      out[offset + w * 2] = below === left && below !== right && left !== above ? left : here;
      out[offset + w * 2 + 1] = right === below && right !== above && below !== left ? below : here;
    }
  return { width: w * 2, height: height * 2, data: new Uint8Array(out.buffer) };
}

// ---- the reader ---------------------------------------------------------------------------------------------------

const ASK = /^(w_)?(.+\.CIF)_(\d+)-(\d+)_([A-Za-z]+)$/;
/** A first-person name of ours, read: the file, its look and base, the record and frame, the metal, the `w_` size. */
export function parseOwnName(name) {
  const [, wide, file, recordText, frameText, metal] = ASK.exec(name ?? '') ?? [];
  const own = file && OWN_FILES[file];
  if (!own || !DIVERSE_WEAPONS_METALS.includes(metal)) return null;
  const record = Number(recordText),
    frame = Number(frameText);
  if (!(frame < (shapeOf(file)[record] ?? 0)) || (wide && (record || frame))) return null;
  return { wide: !!wide, file, look: own.look, base: own.base, record, frame, metal };
}

/** Our art over `getBytes(name)` (the player's ARENA2): each file and the palette read once, a failed read forgotten.
 *  `frame(name)` and `icon(archive, record, ramp)` answer top-down RGBA pictures, or null where the data has none. */
export function createOwnWeaponArt(getBytes) {
  const files = new Map();
  const once = (key, make) => {
    if (!files.has(key)) {
      const read = make();
      files.set(key, read);
      read.catch(() => files.get(key) === read && files.delete(key));
    }
    return files.get(key);
  };
  const bytes = async (name) => new Uint8Array(await getBytes(name));
  const palette = () =>
    once('ART_PAL.COL', async () => {
      const pal = new DFPalette();
      pal.load(await bytes('ART_PAL.COL'), 'ART_PAL.COL');
      return pal;
    });
  const cif = (name) =>
    once(name, async () => {
      const weaponFile = new CifRciFile();
      if (!weaponFile.load(await bytes(name), name, null)) throw new Error(`${name}: no records`);
      return weaponFile;
    });
  const texture = (archive) =>
    once(texName(archive), async () => {
      const textures = new TextureFile();
      if (!textures.load(await bytes(texName(archive)), texName(archive), null))
        throw new Error(`${texName(archive)}: no records`);
      return textures;
    });
  async function frame(name) {
    const ask = parseOwnName(name);
    if (!ask) return null;
    const [weaponFile, pal] = await Promise.all([cif(ask.base), palette()]);
    const bitmap = weaponFile.getDFBitmap(ask.record, ask.frame);
    if (!bitmap?.width) return null;
    const pic = paintFrame(bitmap, pal, ask.look, ask.metal);
    return ask.wide ? scale2x(pic) : pic;
  }
  async function icon(archive, record, ramp) {
    const [textures, pal] = await Promise.all([texture(archive), palette()]);
    const bitmap = record < textures.recordCount ? textures.getDFBitmap(record, 0) : null;
    return bitmap?.width ? paintIcon(bitmap, pal, ramp) : null;
  }
  return { frame, icon };
}

let _art = null;
/** The session's own: the player's files through scenes/dataSource.js getBytes, imported on first use. */
export const ownWeaponArt = () =>
  (_art ??= createOwnWeaponArt(async (name) => (await import('../../scenes/dataSource.js')).getBytes(name)));
