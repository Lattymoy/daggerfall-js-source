// @ts-check
// OWN-WORK4 (2026-10-31; the owner: "A proper 1 to 1 recreation for everything") - OUR OWN TEXTURE TREATMENTS. Each
// rule makes a new picture from the player's own classic record (formats/classicPictures.js); no author's picture is
// read, sampled or measured. Pure, no DOM: the page and the build worker run the same code. enhance: an edge-aware
// upscale, our grain, a gentle grade. road: enhance with the paving's stones raised. desert: the Alik'r's sand, pale and
// rippled. snow: snow laid by slope and exposure. And the snow runtime's masks (snowMask) and albedo (snowAlbedo).

/** @typedef {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray }} Rgba */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lumaOf = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const wrapI = (i, n) => ((i % n) + n) % n;
const clampI = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i);

/** A 32-bit integer hash of a lattice point and a seed, as [0, 1). */
export function hash01(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in [0, 1) over a lattice of `cells` x `cells` that wraps, read at (u, v) in cells - so a picture whose
 *  side is a whole number of cells tiles. */
export function tileNoise(u, v, cells, seed) {
  const i = Math.floor(u),
    j = Math.floor(v);
  const fx = u - i,
    fy = v - j;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const i0 = wrapI(i, cells),
    i1 = wrapI(i + 1, cells),
    j0 = wrapI(j, cells),
    j1 = wrapI(j + 1, cells);
  const a = hash01(i0, j0, seed),
    b = hash01(i1, j0, seed),
    c = hash01(i0, j1, seed),
    d = hash01(i1, j1, seed);
  const top = a + (b - a) * sx;
  return top + (c + (d - c) * sx - top) * sy;
}

/** Octaves of tileNoise across a w x h picture, centred on 0 (about +-1): `cells` the coarsest lattice across the
 *  picture's width, doubled each octave, each half as strong. */
export function grain(w, h, cells, octaves, seed) {
  const out = new Float32Array(w * h);
  let amp = 1,
    total = 0;
  const fy = new Float32Array(h),
    jy = new Int32Array(h),
    fx = new Float32Array(w),
    ix = new Int32Array(w);
  for (let o = 0; o < octaves; o++) {
    const cx = cells << o,
      cy = Math.max(1, Math.round((cx * h) / w));
    // the lattice once (tileNoise's values), then each texel a smoothstep blend of its four corners
    const lat = new Float32Array(cx * cy);
    for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) lat[j * cx + i] = 2 * hash01(i, j, seed + o * 7919) - 1;
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) * cx) / w,
        i = Math.floor(u),
        t = u - i;
      ix[x] = i % cx;
      fx[x] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < h; y++) {
      const v = ((y + 0.5) * cy) / h,
        j = Math.floor(v),
        t = v - j;
      jy[y] = j % cy;
      fy[y] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < h; y++) {
      const r0 = jy[y] * cx,
        r1 = ((jy[y] + 1) % cy) * cx,
        sy = fy[y];
      for (let x = 0; x < w; x++) {
        const i0 = ix[x],
          i1 = (i0 + 1) % cx,
          sx = fx[x];
        const top = lat[r0 + i0] + (lat[r0 + i1] - lat[r0 + i0]) * sx;
        const bottom = lat[r1 + i0] + (lat[r1 + i1] - lat[r1 + i0]) * sx;
        out[y * w + x] += amp * (top + (bottom - top) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** The classic picture with every clear texel's colour taken from its opaque neighbours, so an upscale's blend at a
 *  sprite's edge never pulls in the clear texels' black. The alpha is kept. */
export function bleedClear(src) {
  const { width: w, height: h } = src;
  const data = new Uint8Array(src.data);
  const known = new Uint8Array(w * h);
  let todo = [];
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] === 0) todo.push(i);
    else known[i] = 1;
  }
  for (let pass = 0; pass < 4 && todo.length; pass++) {
    const filled = [],
      left = [];
    for (const i of todo) {
      const x = i % w,
        y = (i / w) | 0;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !known[ny * w + nx]) continue;
          const k = (ny * w + nx) * 4;
          r += data[k];
          g += data[k + 1];
          b += data[k + 2];
          n++;
        }
      if (n) filled.push(i, r / n, g / n, b / n);
      else left.push(i);
    }
    for (let f = 0; f < filled.length; f += 4) {
      const i = filled[f];
      data[i * 4] = filled[f + 1];
      data[i * 4 + 1] = filled[f + 2];
      data[i * 4 + 2] = filled[f + 3];
      known[i] = 1;
    }
    todo = left;
  }
  return { width: w, height: h, data };
}

/** Catmull-Rom's four weights at fraction t. */
function cubicWeights(t, out, o) {
  const t2 = t * t,
    t3 = t2 * t;
  out[o] = -0.5 * t3 + t2 - 0.5 * t;
  out[o + 1] = 1.5 * t3 - 2.5 * t2 + 1;
  out[o + 2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  out[o + 3] = 0.5 * t3 - 0.5 * t2;
}

/**
 * THE EDGE-AWARE UPSCALE. Catmull-Rom, one axis and then the other, each output texel clamped to the range of the four
 * source texels nearest it - a cubic's overshoot past an edge is what draws a halo, and the clamp takes it away while
 * the curve keeps the edge's slope. A tile wraps (`wrap`), a sprite's border is its own edge. The alpha is the same
 * curve cut at half, so a sprite's outline is smoothed and stays a cutout. Smaller than the record: a box filter.
 * @param {Rgba} src @param {number} w @param {number} h @param {boolean} wrap @returns {Rgba}
 */
export function upscaleEdgeAware(src, w, h, wrap) {
  const { width: sw, height: sh } = src;
  if (w <= sw && h <= sh) return boxFit(src, w, h);
  const s = bleedClear(src).data;
  const at = wrap ? wrapI : clampI;
  // each output column's four taps and their weights, and its two nearest source columns (the clamp's range)
  const tap = new Int32Array(w * 4),
    wx = new Float32Array(w * 4),
    near = new Int32Array(w * 2);
  for (let x = 0; x < w; x++) {
    const f = ((x + 0.5) * sw) / w - 0.5,
      i = Math.floor(f);
    cubicWeights(f - i, wx, x * 4);
    for (let k = 0; k < 4; k++) tap[x * 4 + k] = at(i - 1 + k, sw) * 4;
    near[x * 2] = at(i, sw) * 4;
    near[x * 2 + 1] = at(i + 1, sw) * 4;
  }
  // the horizontal pass: sh rows of w texels, four channels, float
  const mid = new Float32Array(sh * w * 4);
  for (let y = 0; y < sh; y++) {
    const row = y * sw * 4;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let k = 0; k < 4; k++) {
        const c = row + tap[x * 4 + k],
          wt = wx[x * 4 + k];
        r += s[c] * wt;
        g += s[c + 1] * wt;
        b += s[c + 2] * wt;
        a += s[c + 3] * wt;
      }
      mid[o] = r;
      mid[o + 1] = g;
      mid[o + 2] = b;
      mid[o + 3] = a;
    }
  }
  const out = new Uint8Array(w * h * 4);
  const wy = new Float32Array(4);
  for (let y = 0; y < h; y++) {
    const f = ((y + 0.5) * sh) / h - 0.5,
      j = Math.floor(f);
    cubicWeights(f - j, wy, 0);
    const m0 = at(j - 1, sh) * w * 4,
      m1 = at(j, sh) * w * 4,
      m2 = at(j + 1, sh) * w * 4,
      m3 = at(j + 2, sh) * w * 4;
    const s1 = at(j, sh) * sw * 4,
      s2 = at(j + 1, sh) * sw * 4;
    const w0 = wy[0],
      w1 = wy[1],
      w2 = wy[2],
      w3 = wy[3];
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4,
        mx = x * 4;
      const a0 = s1 + near[x * 2],
        a1 = s1 + near[x * 2 + 1],
        a2 = s2 + near[x * 2],
        a3 = s2 + near[x * 2 + 1];
      for (let c = 0; c < 4; c++) {
        let v = mid[m0 + mx + c] * w0 + mid[m1 + mx + c] * w1 + mid[m2 + mx + c] * w2 + mid[m3 + mx + c] * w3;
        const p0 = s[a0 + c],
          p1 = s[a1 + c],
          p2 = s[a2 + c],
          p3 = s[a3 + c];
        const lo =
          p0 < p1
            ? p0 < p2
              ? p0 < p3
                ? p0
                : p3
              : p2 < p3
                ? p2
                : p3
            : p1 < p2
              ? p1 < p3
                ? p1
                : p3
              : p2 < p3
                ? p2
                : p3;
        const hi =
          p0 > p1
            ? p0 > p2
              ? p0 > p3
                ? p0
                : p3
              : p2 > p3
                ? p2
                : p3
            : p1 > p2
              ? p1 > p3
                ? p1
                : p3
              : p2 > p3
                ? p2
                : p3;
        v = v < lo ? lo : v > hi ? hi : v;
        out[o + c] = c === 3 ? (v >= 127.5 ? 255 : 0) : v + 0.5;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/** A box filter to a smaller size, alpha-weighted, the cutout kept a cutout. */
function boxFit(src, w, h) {
  const { width: sw, height: sh, data: s } = src;
  if (sw === w && sh === h) return { width: w, height: h, data: new Uint8Array(s) };
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * sw) / w),
        x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / w)),
        y0 = Math.floor((y * sh) / h),
        y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / h));
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) * 4,
            al = s[i + 3];
          r += s[i] * al;
          g += s[i + 1] * al;
          b += s[i + 2] * al;
          a += al;
          n++;
        }
      const o = (y * w + x) * 4;
      if (a) {
        out[o] = r / a + 0.5;
        out[o + 1] = g / a + 0.5;
        out[o + 2] = b / a + 0.5;
      }
      out[o + 3] = a / n >= 127.5 ? 255 : 0;
    }
  return { width: w, height: h, data: out };
}

/** Unsharp masking on the luma, held inside each texel's own 3 x 3 range of it: crisper edges, never a halo past
 *  them. The colour moves with its luma. */
export function sharpenInRange(pic, amount, wrap) {
  const { width: w, height: h, data: d } = pic;
  const at = wrap ? wrapI : clampI;
  const n = w * h;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  // a row's three: sum, least and most; then a column's three of those
  const hs = new Float32Array(n),
    hl = new Float32Array(n),
    hh = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const a = L[r + at(x - 1, w)],
        b = L[r + x],
        c = L[r + at(x + 1, w)];
      hs[r + x] = a + b + c;
      hl[r + x] = a < b ? (a < c ? a : c) : b < c ? b : c;
      hh[r + x] = a > b ? (a > c ? a : c) : b > c ? b : c;
    }
  }
  const out = new Uint8Array(d);
  for (let y = 0; y < h; y++) {
    const u = at(y - 1, h) * w,
      r = y * w,
      v = at(y + 1, h) * w;
    for (let x = 0; x < w; x++) {
      const i = r + x;
      if (d[i * 4 + 3] === 0) continue;
      const mean = (hs[u + x] + hs[i] + hs[v + x]) / 9;
      const lo = Math.min(hl[u + x], hl[i], hl[v + x]),
        hi = Math.max(hh[u + x], hh[i], hh[v + x]);
      let t = L[i] + amount * (L[i] - mean);
      t = t < lo ? lo : t > hi ? hi : t;
      const dl = t - L[i];
      for (let c = 0; c < 3; c++) {
        const q = d[i * 4 + c] + dl;
        out[i * 4 + c] = q < 0 ? 0 : q > 255 ? 255 : q + 0.5;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/** How busy the record is round each texel: the luma's spread over its 3 x 3, 0 (flat) to 1 (a strong pattern). */
function busyness(src, wrap) {
  const { width: w, height: h, data: d } = src;
  const out = new Float32Array(w * h);
  const at = wrap ? wrapI : clampI;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0,
        s2 = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const i = (at(y + dy, h) * w + at(x + dx, w)) * 4;
          const l = lumaOf(d[i], d[i + 1], d[i + 2]);
          s += l;
          s2 += l * l;
        }
      const sd = Math.sqrt(Math.max(0, s2 / 9 - (s / 9) * (s / 9)));
      out[y * w + x] = clamp01(sd / 0.12);
    }
  return out;
}

/**
 * OUR DETAIL: a fine grain laid over the upscale, strongest where the record is busiest (a stony path takes more than a
 * smooth wall), and never on a clear texel. `cells` is the grain's coarsest lattice across the picture.
 */
export function addDetail(pic, src, { strength, cells, seed, wrap }) {
  const { width: w, height: h, data: d } = pic;
  const busy = busyness(src, wrap);
  const n = grain(w, h, cells, 3, seed);
  const sw = src.width,
    sh = src.height;
  const col = new Int32Array(w);
  for (let x = 0; x < w; x++) col[x] = Math.min(sw - 1, Math.floor((x * sw) / w));
  for (let y = 0; y < h; y++) {
    const sr = Math.min(sh - 1, Math.floor((y * sh) / h)) * sw;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (d[o + 3] === 0) continue;
      const k = 1 + strength * (0.35 + 0.65 * busy[sr + col[x]]) * n[y * w + x];
      d[o] = Math.min(255, d[o] * k + 0.5);
      d[o + 1] = Math.min(255, d[o + 1] * k + 0.5);
      d[o + 2] = Math.min(255, d[o + 2] * k + 0.5);
    }
  }
  return pic;
}

/** OUR GRADE: a soft S-curve on the luma about its middle, and the colour widened round it. */
export function grade(pic, { contrast, saturation }) {
  const d = pic.data;
  for (let o = 0; o < d.length; o += 4) {
    if (d[o + 3] === 0) continue;
    const r = d[o],
      g = d[o + 1],
      b = d[o + 2];
    const y = lumaOf(r, g, b);
    const y2 = clamp01(y + contrast * (y - 0.5) * (1 - Math.abs(2 * y - 1)));
    const k = y > 0.001 ? y2 / y : 1;
    const Y = y2 * 255;
    for (let c = 0; c < 3; c++) {
      const v = Y + saturation * (d[o + c] * k - Y);
      d[o + c] = v < 0 ? 0 : v > 255 ? 255 : v + 0.5;
    }
  }
  return pic;
}

/** How a record's edges meet the next texel, for the upscale and the grain: a wall or a dungeon's tile repeats itself
 *  (it wraps); a terrain record meets OTHER records at its edges (a shore's water half meets the water tile), so its
 *  own far edge is no neighbour - it is held at its border, as a flat's sprite is. */
export const wrapsOf = (archive) => {
  const a = archive % 100;
  return archive < 500 && a !== 2 && a !== 3 && a !== 4 && a !== 5 && a !== 6 && !(archive >= 194 && archive <= 195);
};

/** A record's own seed: the same record grows the same grain on every machine. */
export const recordSeed = (archive, record, frame = 0) => (archive * 1009 + record * 97 + frame * 13 + 0x51ed) | 0;

/**
 * THE ENHANCED LOOK. The record upscaled to w x h (edge-aware), sharpened in range, given our grain and graded. A tile
 * that wraps wraps at every step, so it still repeats without a seam; the grain's lattice wraps always.
 * @param {Rgba} src @param {number} w @param {number} h @param {{ wrap: boolean, seed: number }} o @returns {Rgba}
 */
export function enhance(src, w, h, { wrap, seed }) {
  const up = upscaleEdgeAware(src, w, h, wrap);
  const factor = w / src.width;
  const sharp = factor > 1.01 ? sharpenInRange(up, 0.55, wrap) : up;
  const cells = Math.max(2, Math.round(src.width / 4));
  addDetail(sharp, src, { strength: factor > 1.01 ? 0.07 : 0.04, cells, seed, wrap });
  return grade(sharp, { contrast: 0.12, saturation: 1.08 });
}

/** How much a texel is paving: grey (no colour to speak of) and darker than snow. */
const pavingOf = (r, g, b) => {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  const sat = mx ? (mx - mn) / mx : 0;
  return (1 - smooth(0.06, 0.14, sat)) * (1 - smooth(0.7, 0.78, lumaOf(r, g, b)));
};

/** A picture's luma softened over a 3 x 3, held at its border. */
function softLuma(pic) {
  const { width: w, height: h, data: d } = pic;
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = lumaOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let t = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) t += raw[clampI(y + dy, h) * w + clampI(x + dx, w)];
      out[y * w + x] = t / 9;
    }
  return out;
}

/**
 * THE ROAD (Masked Roads' records 46, 47 and 55: Daggerfall's road and its two flanks). The enhanced look, and the
 * paving's own stones raised: the picture's soft luma taken as height, lit from the north-west, so every stone the
 * record draws stands as a cobble and its joint sinks. Where the paving meets the ground a worn verge darkens it, its
 * edge broken by a noise rather than drawn as a line.
 * @param {Rgba} src @param {number} w @param {number} h @param {{ seed: number }} o @returns {Rgba}
 */
export function road(src, w, h, { seed }) {
  const out = enhance(src, w, h, { wrap: false, seed });
  const d = out.data,
    sw = src.width,
    sh = src.height,
    s = src.data;
  const ht = softLuma(out);
  const edge = grain(w, h, 6, 2, seed + 31);
  const relief = 1.4 * (w / sw);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const si = (Math.min(sh - 1, Math.floor((y * sh) / h)) * sw + Math.min(sw - 1, Math.floor((x * sw) / w))) * 4;
      const p0 = pavingOf(s[si], s[si + 1], s[si + 2]);
      const p = p0 > 0.02 ? p0 + 0.22 * edge[y * w + x] : 0; // no grey at all: the enhanced look itself
      const pave = smooth(0.45, 0.7, p),
        verge = smooth(0.2, 0.45, p) * (1 - pave);
      if (pave <= 0 && verge <= 0) continue;
      const gx = ht[y * w + clampI(x + 1, w)] - ht[y * w + clampI(x - 1, w)],
        gy = ht[clampI(y + 1, h) * w + x] - ht[clampI(y - 1, h) * w + x];
      const k = pave * (1 + clamp01(0.5 - (gx + gy) * relief) * 0.5 - 0.25) + verge * 0.88 + (1 - pave - verge);
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) d[o + c] = Math.min(255, d[o + c] * k + 0.5);
    }
  return out;
}

/** A field's mean over the (2r + 1)-square round each texel, held at the border. */
function boxMean(a, w, h, r) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let t = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) t += a[clampI(y + dy, h) * w + clampI(x + dx, w)];
      out[y * w + x] = t / ((2 * r + 1) * (2 * r + 1));
    }
  return out;
}

/**
 * THE ALIK'R'S SAND. A record of the desert's ground at its own size: where the ground is sand (a warm tan, light enough,
 * over its 5 x 5 - so a pale speck in dark dirt is no dune), it is graded toward a pale dune sand that keeps the record's
 * own light and dark (its pebbles and mottles darker sand), and rippled by the wind - crests a few texels apart, bent by
 * a slow noise, whole cycles across the tile so it repeats. Water and green stay the record's, and on a road record so
 * does the paving - darker over its 7 x 7, on a flank (`road` 'flank': 47, 55) only on its paved, lower-right half.
 * @param {Rgba} src @param {{ seed: number, road?: false | 'full' | 'flank' }} o @returns {Rgba}
 */
export function desert(src, { seed, road = false }) {
  const { width: w, height: h, data: s } = src;
  const out = new Uint8Array(s);
  const luma = new Float32Array(w * h),
    own = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = s[i * 4],
      g = s[i * 4 + 1],
      b = s[i * 4 + 2];
    luma[i] = lumaOf(r, g, b);
    const warm = smooth(0.02, 0.1, (r - b) / 255) * smooth(-0.02, 0.06, (g - b) / 255);
    own[i] = warm * smooth(0.3, 0.42, luma[i]);
  }
  const near = boxMean(own, w, h, 2),
    wide = road ? boxMean(luma, w, h, 3) : null;
  const field = new Float32Array(w * h);
  let sum = 0,
    n = 0;
  for (let i = 0; i < w * h; i++) {
    const r = s[i * 4],
      g = s[i * 4 + 1],
      b = s[i * 4 + 2];
    const kept = (1 - waterOf(r, g, b)) * (1 - smooth(0.02, 0.08, (g - Math.max(r, b)) / 255));
    const side = road === 'flank' ? smooth(-0.3, -0.1, ((i % w) + ((i / w) | 0) + 1) / w - 1) : 1;
    const paved = wide ? (1 - smooth(0.49, 0.53, wide[i])) * side : 0;
    field[i] = smooth(0.3, 0.6, near[i]) * kept * (1 - paved);
    sum += own[i] * field[i] * luma[i];
    n += own[i] * field[i];
  }
  const mean = n > 0 ? sum / n : 0.5;
  const warp = grain(w, h, 4, 2, seed);
  const tone = [236, 210, 166];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const m = field[y * w + x] * 0.9;
      if (m <= 0 || s[i + 3] === 0) continue;
      const rel = luma[y * w + x] / mean;
      const ripple = Math.sin(2 * Math.PI * ((7 * x) / w + (3 * y) / h) + 2.4 * warp[y * w + x]);
      const k = Math.min(1.1, Math.max(0.62, 0.86 + 0.7 * (rel - 1))) * (1 + 0.06 * ripple);
      for (let c = 0; c < 3; c++) {
        const v = s[i + c] + m * (tone[c] * k - s[i + c]);
        out[i + c] = v < 0 ? 0 : v > 255 ? 255 : v + 0.5;
      }
    }
  return { width: w, height: h, data: out };
}

/** How much a texel is water: blue well over red, and too dark to be snow in a blue light. */
const waterOf = (r, g, b) =>
  smooth(0.06, 0.16, (b - r) / 255) * smooth(-0.02, 0.06, (b - g) / 255) * (1 - smooth(0.6, 0.7, lumaOf(r, g, b)));

/** A record's pseudo-height (its soft luma) and the slope, the lee and the light there: the snow law's ground. Held at
 *  the record's border - a terrain record's far edge is another record's. */
function snowGround(src) {
  const { width: w, height: h } = src;
  const ht = softLuma(src);
  const slope = new Float32Array(w * h),
    lee = new Float32Array(w * h),
    lit = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx = (ht[y * w + clampI(x + 1, w)] - ht[y * w + clampI(x - 1, w)]) * 4,
        gy = (ht[clampI(y + 1, h) * w + x] - ht[clampI(y - 1, h) * w + x]) * 4;
      const i = y * w + x;
      slope[i] = Math.sqrt(gx * gx + gy * gy);
      // the wind and the light are from the north-west: a face falling to the south-east is the lee, and in shade
      lee[i] = clamp01(0.5 + (gx + gy) * 0.9);
      lit[i] = clamp01(0.92 - 0.25 * (gx + gy));
    }
  return { ht, slope, lee, lit };
}

/**
 * The snow law's coverage of each texel, 0 to 1. A winter record: the snow it draws already (bright over its 3 x 3, not
 * water), crept a texel or two over the flat ground beside it, furthest downwind (the wind is from the north-west). A summer record (`fromSummer`): laid over all
 * but water, full on the flat, thinner on steep ground and on faces to the wind. `joints`: snow sifted into the dark
 * joints of a paving too - the picture's, not the mask's (a dusted joint is no snow to stand in).
 */
function snowCover(src, ground, fromSummer, joints) {
  const { width: w, height: h, data: s } = src;
  const cover = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const water = waterOf(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]);
    const steep = smooth(0.45, 1.4, ground.slope[i]) * (1.2 - 0.6 * ground.lee[i]);
    cover[i] = (1 - water) * (fromSummer ? clamp01(1.02 - 0.75 * steep) : smooth(0.62, 0.71, ground.ht[i]));
  }
  if (fromSummer) return cover;
  const raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = lumaOf(s[i * 4], s[i * 4 + 1], s[i * 4 + 2]);
  const spread = new Float32Array(cover);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (cover[i] >= 0.99) continue;
      // the exposure: snow drifts downwind - a snowy texel to the north-west (the wind's side) reaches further
      let near = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const wind = 0.55 + 0.45 * clamp01((-dx - dy) / 4);
          const v = (cover[clampI(y + dy, h) * w + clampI(x + dx, w)] * wind) / (1 + Math.abs(dx) + Math.abs(dy));
          if (v > near) near = v;
        }
      const r = s[i * 4],
        g = s[i * 4 + 1],
        b = s[i * 4 + 2];
      // the slope: the bare ground's own (a snowy neighbour counts at this texel's height - its brightness is no hill)
      const at = (j) => (cover[j] > 0.5 ? raw[i] : raw[j]);
      const gx = (at(y * w + clampI(x + 1, w)) - at(y * w + clampI(x - 1, w))) * 4,
        gy = (at(clampI(y + 1, h) * w + x) - at(clampI(y - 1, h) * w + x)) * 4;
      const flat = 1 - smooth(0.25, 0.7, Math.sqrt(gx * gx + gy * gy));
      const joint = joints ? pavingOf(r, g, b) * smooth(0.02, 0.08, mean3(ground.ht, x, y, w, h) - ground.ht[i]) : 0;
      // a joint takes snow only near the drift's edge: a whole road hatched white is no snowfall
      spread[i] = Math.max(
        cover[i],
        (1 - waterOf(r, g, b)) * Math.max(near * flat, 0.8 * joint * smooth(0.1, 0.45, near)),
      );
    }
  return spread;
}
const mean3 = (a, x, y, w, h) => {
  let t = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t += a[clampI(y + dy, h) * w + clampI(x + dx, w)];
  return t / 9;
};

/**
 * OUR SNOW LAW. A winter record (Daggerfall's own TEXTURE.103, .303, .403), or a summer one where the player's data has
 * no winter record (`fromSummer`), at its own size: snow laid by slope and exposure (snowCover), and where it lies a
 * cold white shaded by the ground's own relief - lit from the north-west, blue in the hollows - with a rare glint.
 * Water is left as the record has it.
 * @param {Rgba} src @param {{ seed: number, fromSummer?: boolean }} o @returns {Rgba}
 */
export function snow(src, { seed, fromSummer = false }) {
  const { width: w, height: h, data: s } = src;
  const ground = snowGround(src);
  const cover = snowCover(src, ground, fromSummer, true);
  const fine = grain(w, h, Math.max(2, w >> 3), 2, seed);
  const keepOwn = fromSummer ? 0.25 : 0.5; // the record's own grain, kept in the snow: a field of it is never blank
  const out = new Uint8Array(s);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        m = cover[i];
      if (m <= 0) continue;
      const o = i * 4;
      const own = 255 * keepOwn * (lumaOf(s[o], s[o + 1], s[o + 2]) - ground.ht[i]);
      const hollow = clamp01((mean3(ground.ht, x, y, w, h) - ground.ht[i]) * 6);
      const glint = hash01(x, y, seed) > 0.985 ? 1.05 : 1;
      const v = (0.95 + 0.03 * fine[i]) * (0.88 + 0.14 * ground.lit[i]) * glint;
      const tone = [v * (240 - 16 * hollow), v * (244 - 8 * hollow), v * 254];
      for (let c = 0; c < 3; c++) {
        const t = s[o + c] + m * (tone[c] + own - s[o + c]);
        out[o + c] = t < 0 ? 0 : t > 255 ? 255 : t + 0.5;
      }
    }
  return { width: w, height: h, data: out };
}

/** The bytes of one winter record's surface mask - where snow may lie, 0 to 255, in the record's own rows (row 0 its
 *  top: systems/snowfall.js SnowCoverage reads row (1 - v) * 63 at the ground's v, and the ground draws the record's
 *  top row at v = 1) - from our snow law's coverage softened over a 3 x 3. A texel under 2% is bare, one over 96% full. */
export function snowMask(src, { fromSummer = false } = {}) {
  const { width: w, height: h } = src;
  const ground = snowGround(src);
  const cover = snowCover(src, ground, fromSummer, false);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const m = mean3(cover, x, y, w, h);
      out[y * w + x] = m >= 0.96 ? 255 : m < 0.02 ? 0 : Math.round(m * 255);
    }
  return out;
}

/** OUR SNOW'S ALBEDO: a cold white with a soft drift of light and shadow and a few glints, `size` square, repeating -
 *  rows top-down. */
export function snowAlbedo(size = 64, seed = 0x5a0f) {
  const drift = grain(size, size, 4, 3, seed),
    fine = grain(size, size, 16, 2, seed + 11);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = 0.92 + 0.05 * drift[i] + 0.02 * fine[i];
    const cold = clamp01(0.5 - drift[i]) * 0.05;
    const glint = hash01(i % size, (i / size) | 0, seed) > 0.992 ? 0.06 : 0;
    data[i * 4] = Math.min(255, 255 * (v - cold + glint) + 0.5);
    data[i * 4 + 1] = Math.min(255, 255 * (v - cold * 0.5 + glint) + 0.5);
    data[i * 4 + 2] = Math.min(255, 255 * (v + 0.03 + glint) + 0.5);
    data[i * 4 + 3] = 255;
  }
  return { width: size, height: size, data };
}

/** The rules by name, as a spec names them (ownTexturePacks.js). */
export const OWN_RULE_NAMES = Object.freeze(['enhance', 'road', 'desert', 'snow']);

/** The source at the spec's size, where a pack keeps a record at a size of its own. */
const fit = (src, w, h) => (src.width === w && src.height === h ? src : upscaleEdgeAware(src, w, h, false));

/**
 * One picture by its spec: `{ rule, w, h, wrap?, fromSummer?, seed }` over the classic source picture. Answers a new
 * picture; the source is not written.
 * @param {{ rule: string, w: number, h: number, wrap?: boolean, fromSummer?: boolean, road?: false | 'full' | 'flank', seed: number }} spec
 * @param {Rgba} src
 * @returns {Rgba}
 */
export function applyOwnRule(spec, src) {
  switch (spec.rule) {
    case 'enhance':
      return enhance(src, spec.w, spec.h, { wrap: !!spec.wrap, seed: spec.seed });
    case 'road':
      return road(src, spec.w, spec.h, { seed: spec.seed });
    case 'desert':
      return desert(fit(src, spec.w, spec.h), { seed: spec.seed, road: spec.road ?? false });
    case 'snow':
      return snow(fit(src, spec.w, spec.h), { seed: spec.seed, fromSummer: !!spec.fromSummer });
    default:
      throw new Error(`no own texture rule ${spec.rule}`);
  }
}
