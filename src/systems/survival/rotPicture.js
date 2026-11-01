// NO-BETHESDA3 (2026-10-31; the owner: "Also rebuild the rotten fish ourself"): OUR OWN ROT, drawn over the player's
// own picture of the fresh food. No pixel of a mod's picture is read: the colour is drawn toward a sick green-grey,
// the rim darkened, and mould grown in soft patches where a seeded pattern of ours, the rim and the hollows put it
// (OWN-AUDIT, 2026-11-01). Pure: a top-down RGBA picture in, a new one out, and a clear pixel stays clear (0,0,0,0).

/** The sick green-grey a pixel's light is drawn toward (a share of its luminance per channel), and how far. */
export const ROT_TINT = Object.freeze([0.84, 1, 0.66]);
export const ROT_MIX = 0.75;
/** A pixel's light one and two pixels in from the clear (or the picture's edge); deeper ones keep theirs. */
export const ROT_RIM = Object.freeze([0.55, 0.78]);
/** OWN-AUDIT (2026-11-01): mould's two colours, as a share of a pixel's light per channel - a grey-green and a near white. */
export const MOULD_GREEN = Object.freeze([0.78, 1, 0.74]);
export const MOULD_WHITE = Object.freeze([1, 1, 0.95]);
/** The share of the food mould covers when rotten (MOULDY's first stage covers more). */
export const MOULD_COVER = 0.24;
/** How much more mould the rim takes, as a share of the patches' noise, and how much a hollow in the shading adds. */
export const MOULD_EDGE = 0.3;
export const MOULD_HOLLOW = 0.35;
/** A patch's soft border, and the grain that makes it fuzz, in the density's own units. */
export const MOULD_SOFT = 0.06;
export const MOULD_GRAIN = 0.08;

/** xorshift32 from `seed`, as a share in [0, 1): the same mould every time for one seed. */
function rng(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** Smooth noise in [0, 1]: a seeded lattice every `cell` pixels, eased between its points. */
function valueNoise(w, height, cell, next) {
  const gridWide = Math.ceil(w / cell) + 2, grid = Float32Array.from({ length: gridWide * (Math.ceil(height / cell) + 2) }, next);
  const ease = (share) => share * share * (3 - 2 * share), out = new Float32Array(w * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x / cell), y0 = Math.floor(y / cell), easeX = ease(x / cell - x0), easeY = ease(y / cell - y0);
      const corner = (i, j) => grid[(y0 + j) * gridWide + x0 + i];
      out[y * w + x] = (corner(0, 0) * (1 - easeX) + corner(1, 0) * easeX) * (1 - easeY) + (corner(0, 1) * (1 - easeX) + corner(1, 1) * easeX) * easeY;
    }
  }
  return out;
}

const lumAt = (data, i) => 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

/** How far each drawn pixel is from the clear, in pixels (1 = touching it, 3 = three or more), 0 where clear. */
export function rimDepth(pic) {
  const { width: w, height, data } = pic;
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= height || data[(y * w + x) * 4 + 3] === 0;
  const out = new Uint8Array(w * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (clear(x, y)) continue;
      let near = 3;
      for (let k = 1; k < 3 && near === 3; k++) {
        for (let dy = -k; dy <= k && near === 3; dy++) for (let dx = -k; dx <= k; dx++) if (clear(x + dx, y + dy)) { near = k; break; }
      }
      out[y * w + x] = near;
    }
  }
  return out;
}

/** How thickly mould lies on each pixel of `pic` (the fresh food), 0 where clear: smooth patches of seeded noise, more
 *  of them toward the rim (four pixels in), plus the hollows - a pixel darker than the drawn pixels round it, read in
 *  the food's own shading inside the rim - plus a grain. `tone` picks white or grey-green inside a patch. Pure. */
export function mouldField(pic, seed) {
  const { width: w, height, data } = pic;
  const depth = rimDepth(pic), next = rng(seed), cell = Math.max(2, Math.round(Math.min(w, height) / 4));
  const coarse = valueNoise(w, height, cell * 1.3, next), fine = valueNoise(w, height, Math.max(1.5, cell / 2), next), tone = valueNoise(w, height, cell, next);
  let light = 0;
  for (let i = 0; i < w * height; i++) if (depth[i]) light = Math.max(light, lumAt(data, i));
  const density = new Float32Array(w * height);
  const drawnAt = (x, y) => x >= 0 && y >= 0 && x < w && y < height && depth[y * w + x] > 0;
  for (let i = 0; i < w * height; i++) {
    if (!depth[i]) continue;
    const x = i % w, y = (i / w) | 0;
    let near = 4;
    for (let k = 1; k < 4 && near === 4; k++)
      for (let dy = -k; dy <= k && near === 4; dy++) for (let dx = -k; dx <= k; dx++) if (!drawnAt(x + dx, y + dy)) { near = k; break; }
    let sum = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (drawnAt(x + dx, y + dy)) { sum += lumAt(data, (y + dy) * w + x + dx); n++; }
    const hollow = depth[i] < 2 ? 0 : Math.max(0, Math.min(1, (sum / n - lumAt(data, i)) / (0.2 * light + 1)));
    const rim = 1 - (near - 1) / 3;
    density[i] = (0.6 * coarse[i] + 0.4 * fine[i]) * (1 - MOULD_EDGE + MOULD_EDGE * rim) + MOULD_HOLLOW * hollow + MOULD_GRAIN * (next() - 0.5);
  }
  return { density, tone, depth };
}

/** OWN-WORK4: the first spoiled face, mouldy - less of the sick tint, more mould. Rotten is the default. */
export const MOULDY = Object.freeze({ mix: 0.3, cover: 0.38 });

/** The food, rotten: `pic` is the fresh food's picture (top-down RGBA), `seed` our pattern's; `mix` sets how far the
 *  tint goes and `cover` the share of the food the mould takes (MOULDY for the first stage). OWN-AUDIT (2026-11-01):
 *  mould is soft patches in grey-green and white, lit by the food's own shading and never brighter than its highlight. */
export function rotPicture(pic, { seed = 1, mix = ROT_MIX, cover = MOULD_COVER } = {}) {
  const { width: w, height } = pic;
  const src = pic.data, data = new Uint8Array(w * height * 4);
  const { density, tone, depth } = mouldField(pic, seed);
  const drawn = [];
  let light = 0;
  for (let i = 0; i < w * height; i++) {
    if (!depth[i]) continue;
    const lum = lumAt(src, i);
    const rim = depth[i] < 3 ? ROT_RIM[depth[i] - 1] : 1;
    for (let channel = 0; channel < 3; channel++)
      data[i * 4 + channel] = Math.min(255, Math.round((src[i * 4 + channel] * (1 - mix) + lum * ROT_TINT[channel] * mix) * rim));
    data[i * 4 + 3] = 255;
    drawn.push(i);
    light = Math.max(light, lumAt(data, i));
  }
  if (!drawn.length || cover <= 0) return { width: w, height, data };
  // the patches are the `cover` share of the food where the mould lies thickest, their borders soft
  const sorted = drawn.map((i) => density[i]).sort((a, b) => a - b);
  const edge = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - cover)))];
  for (const i of drawn) {
    const amount = Math.max(0, Math.min(1, (density[i] - edge + MOULD_SOFT) / (2 * MOULD_SOFT)));
    if (!amount) continue;
    const lum = lumAt(data, i);
    const white = Math.max(0, Math.min(1, (density[i] - edge) / (2 * MOULD_SOFT))) * (0.45 + 0.55 * tone[i]);
    const hue = MOULD_GREEN.map((green, channel) => green + (MOULD_WHITE[channel] - green) * white);
    // lifted toward the highlight as the food is lit there: in shadow the mould is shadowed too
    const want = lum + (light - lum) * (0.3 + 0.7 * white) * Math.sqrt(lum / (light || 1));
    const scale = want / (0.299 * hue[0] + 0.587 * hue[1] + 0.114 * hue[2]);
    for (let channel = 0; channel < 3; channel++)
      data[i * 4 + channel] = Math.round(data[i * 4 + channel] * (1 - amount) + Math.min(255, hue[channel] * scale) * amount);
    const brightest = () => [0, 1, 2].reduce((most, channel) => (data[i * 4 + channel] > data[i * 4 + most] ? channel : most), 0);
    while (lumAt(data, i) > light) data[i * 4 + brightest()]--;
  }
  return { width: w, height, data };
}
