// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GRAHT1 (bible/03-World/Graht-Oaks.md): THE GRAHT-OAK'S PICTURES, PAINTED - the port's own, every texel a function of
// its seed (no file, nobody's picture, nothing of the player's data): its BARK (deep vertical furrows, grey-brown, moss
// in the cracks), its LEAVES (the crown's masses - a mottle of greens, low in contrast so a far crown never sparkles)
// and its CARDS (one picture, two halves: a spray of leaves on twigs, cut by its alpha, and a liana hung with leaves).
// Pixel art at the game's own scale - a handful of shades a picture, nearest-sampled - so a tree of it stands beside
// Daggerfall's and the owner's trees in one look. PURE: RGBA bytes top-down, the mip chain beside them; the host
// (scenes/grahtHost.js) uploads them through the renderer's atlas door (renderer.createAtlasTexture).
// Every picture tiles: its noise wraps at its own size.
// ═══════════════════════════════════════════════════════════════════

/** The pictures' sizes (texels): each a power of two, so its noise wraps whole. */
export const GRAHT_ART = Object.freeze({
  bark: Object.freeze({ w: 64, h: 128 }),
  leaves: Object.freeze({ w: 64, h: 64 }),
  cards: Object.freeze({ w: 128, h: 64 }),
});

/** The palettes (sRGB bytes), dark to light. */
export const GRAHT_PALETTE = Object.freeze({
  bark: Object.freeze([
    [38, 31, 26],
    [58, 47, 38],
    [79, 66, 52],
    [101, 87, 70],
    [126, 112, 92],
    [150, 138, 116],
  ]),
  moss: Object.freeze([
    [46, 60, 30],
    [66, 84, 38],
    [92, 110, 50],
  ]),
  leaves: Object.freeze([
    [30, 56, 26],
    [42, 74, 32],
    [56, 92, 38],
    [72, 110, 44],
    [92, 128, 52],
    [118, 148, 64],
  ]),
  twig: Object.freeze([70, 56, 40]),
});

/** An integer hash of a lattice point, wrapped at `w` x `h`, in [0, 1). */
function hash2(x, y, w, h, salt) {
  const xi = ((x % w) + w) % w,
    yi = ((y % h) + h) % h;
  let n = Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(salt, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Value noise on a lattice of `cx` x `cy` texels a cell, wrapping at the picture's `w` x `h` (each a multiple of its cell).
 *  TESA-LANDS: the landmarks' pictures paint with it too (render/landPropArt.js) - one home. */
export function vnoise(x, y, cx, cy, w, h, salt) {
  const gx = x / cx,
    gy = y / cy,
    ix = Math.floor(gx),
    iy = Math.floor(gy),
    fx = gx - ix,
    fy = gy - iy;
  const nw = w / cx,
    nh = h / cy;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, nw, nh, salt),
    b = hash2(ix + 1, iy, nw, nh, salt),
    c = hash2(ix, iy + 1, nw, nh, salt),
    d = hash2(ix + 1, iy + 1, nw, nh, salt);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const shade = (pal, t) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(t * pal.length)))];

/** THE BARK: deep vertical furrows (a noise stretched up the trunk, cut into ridges), lit ridges and dark cracks, moss
 *  in the cracks' patches. */
export function barkPicture() {
  const { w, h } = GRAHT_ART.bark,
    out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const warp = 3 * (vnoise(x, y, 16, 32, w, h, 7) - 0.5);
      const ridge = Math.abs(vnoise(x + warp, y, 8, 64, w, h, 11) * 2 - 1); // 0 in a furrow, 1 on a ridge
      const fine = vnoise(x, y, 4, 8, w, h, 13),
        plate = vnoise(x, y, 16, 16, w, h, 17);
      let t = 0.15 + 0.6 * Math.pow(ridge, 0.7) + 0.18 * (fine - 0.5) + 0.12 * (plate - 0.5);
      let c = shade(GRAHT_PALETTE.bark, t);
      const moss = vnoise(x, y, 16, 16, w, h, 23) * 0.7 + vnoise(x, y, 4, 4, w, h, 29) * 0.3;
      if (moss > 0.62 && ridge < 0.55) c = shade(GRAHT_PALETTE.moss, (moss - 0.62) / 0.3 + 0.2 * fine);
      const o = (y * w + x) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/** THE LEAVES: the crown's masses - clumps of greens, lighter on their tops, darker in the hollows between. */
export function leavesPicture() {
  const { w, h } = GRAHT_ART.leaves,
    out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const clump = vnoise(x, y, 8, 8, w, h, 31),
        leaf = vnoise(x, y, 2, 2, w, h, 37),
        broad = vnoise(x, y, 32, 32, w, h, 41);
      const t = 0.18 + 0.5 * clump + 0.22 * (leaf - 0.5) + 0.2 * (broad - 0.5);
      const c = shade(GRAHT_PALETTE.leaves, t);
      const o = (y * w + x) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/** THE CARDS: the left half a spray of leaves on twigs fanned up from its foot, the third quarter a liana hung with
 *  leaves (tiling down), the last quarter clear; alpha 255 where it is picture, 0 where it is not. */
export function cardsPicture() {
  const { w, h } = GRAHT_ART.cards,
    out = new Uint8Array(w * h * 4);
  const put = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const o = (y * w + x) * 4;
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = 255;
  };
  /** a leaf: an ellipse of `len` x `wid` texels along angle `a`, lighter toward its tip */
  const leaf = (cx, cy, a, len, wid, base) => {
    const ca = Math.cos(a),
      sa = Math.sin(a);
    for (let v = -len; v <= len; v++) {
      for (let u = -wid; u <= wid; u++) {
        if ((v * v) / (len * len) + (u * u) / (wid * wid) > 1) continue;
        const lit = Math.min(GRAHT_PALETTE.leaves.length - 1, base + (v > len * 0.3 ? 1 : 0) + (u < 0 ? 0 : -1 + 1));
        put(cx + ca * v - sa * u, cy + sa * v + ca * u, GRAHT_PALETTE.leaves[Math.max(0, lit)]);
      }
    }
  };
  // the spray: twigs from the foot of the left half (y = h - 1 the card's foot, top-down), leaves along them
  let seed = 1;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const half = w / 2;
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (k / 8 - 0.5) * 2.2 + (rnd() - 0.5) * 0.2; // up and fanned
    const len = 34 + rnd() * 26;
    let x = half / 2 + (rnd() - 0.5) * 6,
      y = h - 2;
    for (let s = 0; s < len; s++) {
      x += Math.cos(a) * 0.9 + (rnd() - 0.5) * 0.6;
      y += Math.sin(a) * 0.9;
      if (x < 2 || x > half - 3 || y < 2) break;
      if (s < len * 0.7) put(x, y, GRAHT_PALETTE.twig);
      if (s > 6 && s % 3 === 0) {
        const side = (s / 3) % 2 ? 1 : -1;
        leaf(
          x + Math.cos(a + side * 1.2) * 3,
          y + Math.sin(a + side * 1.2) * 3,
          a + side * 0.9,
          3 + rnd() * 2.5,
          1.6 + rnd(),
          1 + Math.floor(rnd() * 4),
        );
      }
    }
  }
  // the liana: a wavy stem down the third quarter, tiling (its waves whole periods of h), leaves off it
  const l0 = half + w / 8;
  for (let y = 0; y < h; y++) {
    const x = l0 + 2.2 * Math.sin((y / h) * 4 * Math.PI);
    put(x, y, GRAHT_PALETTE.twig);
    put(x + 1, y, GRAHT_PALETTE.twig);
    if (y % 8 === 3) leaf(x + ((y / 8) % 2 ? 4 : -4), y + 1, (y / 8) % 2 ? 0.5 : 2.6, 3.2, 1.6, 2 + (y % 3));
  }
  return { width: w, height: h, data: out };
}

/** A picture's mip chain - each level the box of the four under it (alpha as its coverage, kept at its own half cut so
 *  a far spray thins rather than fills), down to 1 x 1; level 0 the picture. */
export function mipChain(pic) {
  const levels = [pic];
  let cur = pic;
  while (cur.width > 1 || cur.height > 1) {
    const w = Math.max(1, cur.width >> 1),
      h = Math.max(1, cur.height >> 1),
      d = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          n = 0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(cur.width - 1, x * 2 + dx),
              sy = Math.min(cur.height - 1, y * 2 + dy),
              o = (sy * cur.width + sx) * 4;
            const al = cur.data[o + 3];
            r += cur.data[o] * al;
            g += cur.data[o + 1] * al;
            b += cur.data[o + 2] * al;
            a += al;
            n++;
          }
        const o = (y * w + x) * 4;
        if (a > 0) {
          d[o] = Math.round(r / a);
          d[o + 1] = Math.round(g / a);
          d[o + 2] = Math.round(b / a);
        }
        d[o + 3] = a / n >= 128 ? 255 : 0;
      }
    }
    cur = { width: w, height: h, data: d };
    levels.push(cur);
  }
  return levels;
}
