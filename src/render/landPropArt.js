// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "The pictures"): THE LANDMARKS' PICTURES, painted - the port's own, every
// texel a function of its seed, at the game's own scale (a handful of shades, nearest-sampled; grahtOakArt.js's noise and
// mip chain). Most are GREY grain a look tints (landProps.js LAND_LOOKS: its colour over the picture's mean); the reeds
// and the vines' are in their own colours. Every picture tiles; a card is cut by its alpha. Pure: RGBA bytes top-down.
import { vnoise } from './grahtOakArt.js';

/** The pictures' sizes (texels, powers of two) and whether each is grey (its look colours it) or its own colours. */
export const LAND_ART = Object.freeze({
  fibre: Object.freeze({ w: 64, h: 128, grey: true }),
  cap: Object.freeze({ w: 64, h: 64, grey: true }),
  gills: Object.freeze({ w: 64, h: 64, grey: true }),
  rock: Object.freeze({ w: 64, h: 128, grey: true }),
  lichen: Object.freeze({ w: 64, h: 64, grey: true }),
  bark: Object.freeze({ w: 64, h: 128, grey: true }),
  rind: Object.freeze({ w: 64, h: 64, grey: true }),
  leaves: Object.freeze({ w: 64, h: 64, grey: true }),
  spray: Object.freeze({ w: 64, h: 64, grey: true }),
  moss: Object.freeze({ w: 64, h: 128, grey: true }),
  reeds: Object.freeze({ w: 128, h: 128, grey: false }),
  grapes: Object.freeze({ w: 64, h: 64, grey: false }),
});
/** Each kind's pictures, by its submeshes (world/lands/landPropMesh.js LAND_SUBS: body, crown, detail). */
export const LAND_KIND_ART = Object.freeze({
  parasol: Object.freeze(['fibre', 'cap', 'gills']),
  spire: Object.freeze(['rock', 'lichen', 'lichen']),
  hist: Object.freeze(['bark', 'leaves', 'moss']),
  reeds: Object.freeze(['fibre', 'leaves', 'reeds']),
  vines: Object.freeze(['fibre', 'leaves', 'grapes']),
  grove: Object.freeze(['rind', 'leaves', 'spray']),
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** a grey of `t` (0..1) laid in `levels` steps (the game's handful of shades) between `lo` and `hi` */
const steps = (t, lo, hi, levels = 6) => lo + ((hi - lo) * Math.round(clamp01(t) * (levels - 1))) / (levels - 1);

/** A picture of `w` x `h` whose every texel is `fn(x, y)` - a grey (0..1) or [r, g, b, a] bytes - or null (clear). */
function paint(w, h, fn) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = fn(x, y),
        o = (y * w + x) * 4;
      if (v == null) continue;
      if (typeof v === 'number') {
        const g = Math.round(clamp01(v) * 255);
        out[o] = g;
        out[o + 1] = g;
        out[o + 2] = g;
        out[o + 3] = 255;
      } else {
        out[o] = v[0];
        out[o + 1] = v[1];
        out[o + 2] = v[2];
        out[o + 3] = v[3] ?? 255;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/** THE FIBRE: a stalk's, a cane's, a post's grain - long streaks up it, a few darker seams. */
function fibre() {
  const { w, h } = LAND_ART.fibre;
  return paint(w, h, (x, y) => {
    const streak = vnoise(x, y, 2, 32, w, h, 101),
      seam = vnoise(x, y, 8, 64, w, h, 103),
      fine = vnoise(x, y, 1, 4, w, h, 107);
    return steps(0.5 + 0.55 * (streak - 0.5) + 0.2 * (fine - 0.5) - (seam < 0.22 ? 0.3 : 0), 0.62, 0.96);
  });
}
/** THE CAP: a fungus's cap - broad blotches, lighter scales and spots over it, its pores dark. */
function cap() {
  const { w, h } = LAND_ART.cap;
  return paint(w, h, (x, y) => {
    const broad = vnoise(x, y, 16, 16, w, h, 111),
      scale = vnoise(x, y, 4, 4, w, h, 113),
      spot = vnoise(x, y, 8, 8, w, h, 117);
    let t = 0.45 + 0.4 * (broad - 0.5) + 0.25 * (scale - 0.5);
    if (spot > 0.72) t += 0.35;
    if (scale < 0.18) t -= 0.25;
    return steps(t, 0.6, 1);
  });
}
/** THE GILLS: under a cap, its lamellae - fine lines from the rim in (u round it, v in to the stalk), darker inward. */
function gills() {
  const { w, h } = LAND_ART.gills;
  return paint(w, h, (x, y) => {
    const line = (x % 4 === 0 ? -0.3 : x % 4 === 2 ? 0.1 : 0) + 0.15 * (vnoise(x, y, 4, 16, w, h, 121) - 0.5);
    return steps(0.62 + line - 0.25 * (y / h), 0.5, 0.95);
  });
}
/** THE ROCK: strata across it (bands, warped), cracks down it, a grain over all. */
function rock() {
  const { w, h } = LAND_ART.rock;
  return paint(w, h, (x, y) => {
    const warp = 6 * (vnoise(x, y, 32, 32, w, h, 131) - 0.5),
      band = vnoise(x, y + warp, 64, 8, w, h, 133),
      grain = vnoise(x, y, 2, 2, w, h, 137);
    const crack = Math.abs(vnoise(x, y, 8, 32, w, h, 139) * 2 - 1);
    let t = 0.5 + 0.45 * (band - 0.5) + 0.22 * (grain - 0.5);
    if (crack < 0.07) t -= 0.35;
    return steps(t, 0.58, 1);
  });
}
/** THE LICHEN: a rock's top - its grain, crusted with pale blotches. */
function lichen() {
  const { w, h } = LAND_ART.lichen;
  return paint(w, h, (x, y) => {
    const grain = vnoise(x, y, 2, 2, w, h, 141),
      crust = vnoise(x, y, 8, 8, w, h, 143) * 0.7 + vnoise(x, y, 2, 2, w, h, 147) * 0.3;
    return steps(0.5 + 0.25 * (grain - 0.5) + (crust > 0.62 ? 0.3 : 0), 0.6, 1);
  });
}
/** THE BARK: deep furrows up the trunk (grahtOakArt's furrow law, in grey), lit ridges, dark cracks. */
function bark() {
  const { w, h } = LAND_ART.bark;
  return paint(w, h, (x, y) => {
    const warp = 4 * (vnoise(x, y, 16, 32, w, h, 151) - 0.5);
    const ridge = Math.abs(vnoise(x + warp, y, 8, 32, w, h, 153) * 2 - 1),
      fine = vnoise(x, y, 4, 8, w, h, 157);
    return steps(0.2 + 0.7 * Math.pow(ridge, 0.7) + 0.2 * (fine - 0.5), 0.5, 1);
  });
}
/** THE RIND: a smooth bark (a cherry's, an aspen's) - its lenticels and its dark eyes across it. */
function rind() {
  const { w, h } = LAND_ART.rind;
  return paint(w, h, (x, y) => {
    const tone = vnoise(x, y, 16, 32, w, h, 161),
      len = vnoise(x, y, 8, 2, w, h, 163),
      eye = vnoise(x, y, 16, 16, w, h, 167);
    let t = 0.6 + 0.3 * (tone - 0.5);
    if (len > 0.74) t -= 0.25;
    if (eye > 0.8) t -= 0.4;
    return steps(t, 0.6, 1);
  });
}
/** THE LEAVES: a crown's masses - clumps, lighter on their tops, darker in the hollows (grahtOakArt's, in grey). */
function leaves() {
  const { w, h } = LAND_ART.leaves;
  return paint(w, h, (x, y) => {
    const clump = vnoise(x, y, 8, 8, w, h, 171),
      leaf = vnoise(x, y, 2, 2, w, h, 173),
      broad = vnoise(x, y, 32, 32, w, h, 177);
    return steps(0.2 + 0.55 * clump + 0.25 * (leaf - 0.5) + 0.2 * (broad - 0.5), 0.55, 1);
  });
}
/** a seeded draw (an LCG), for the cards' strokes */
const lcg = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
};
/** THE SPRAY: a crown's fringe card - leaves on twigs fanned up from its foot, cut by its alpha. */
function spray() {
  const { w, h } = LAND_ART.spray,
    px = new Float32Array(w * h).fill(-1);
  const put = (x, y, g) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < w && y >= 0 && y < h) px[y * w + x] = g;
  };
  const r = lcg(7);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k / 6 - 0.5) * 2.0 + (r() - 0.5) * 0.25,
      len = 30 + r() * 26;
    let x = w / 2 + (r() - 0.5) * 6,
      y = h - 2;
    for (let s = 0; s < len; s++) {
      x += Math.cos(a) * 0.9;
      y += Math.sin(a) * 0.9;
      if (x < 2 || x > w - 3 || y < 2) break;
      if (s < len * 0.6) put(x, y, 0.45);
      if (s > 4 && s % 2 === 0) {
        const side = (s / 2) % 2 ? 1 : -1,
          cx = x + Math.cos(a + side * 1.3) * 3,
          cy = y + Math.sin(a + side * 1.3) * 3;
        const g = 0.7 + 0.3 * r();
        for (let v = -3; v <= 3; v++)
          for (let u = -2; u <= 2; u++) if ((v * v) / 9 + (u * u) / 4 <= 1) put(cx + u, cy + v, g - (v > 0 ? 0.12 : 0));
      }
    }
  }
  return paint(w, h, (x, y) => (px[y * w + x] < 0 ? null : steps(px[y * w + x], 0.45, 1)));
}
/** THE MOSS: strands hung from a limb (its picture's left half - the right clear), long and ragged, tiling down. */
function moss() {
  const { w, h } = LAND_ART.moss,
    half = w / 2;
  return paint(w, h, (x, y) => {
    if (x >= half) return null;
    const strand = vnoise(x, 0, 2, 1, half, 1, 181),
      len = 0.35 + 0.65 * vnoise(x, 0, 4, 1, half, 1, 183);
    const wave = Math.sin(y * 0.11 + strand * 9) * 1.2,
      cut = vnoise(x + wave, y, 2, 8, half, h, 187);
    if (y / h > len || cut < 0.28 + 0.25 * (y / h)) return null;
    return steps(0.6 + 0.35 * (strand - 0.5) + 0.2 * (vnoise(x, y, 2, 4, half, h, 189) - 0.5), 0.55, 1);
  });
}
/** THE REEDS, in their own colours (quarters across): a reed with its brown head, a bare blade, a cane's leaf; the last
 *  quarter clear. Each blade tapers to its tip at the top. */
function reeds() {
  const { w, h } = LAND_ART.reeds,
    q = w / 4;
  const greens = [
      [74, 92, 46],
      [92, 112, 54],
      [112, 130, 66],
      [138, 150, 84],
    ],
    head = [
      [78, 52, 32],
      [98, 66, 40],
      [118, 82, 50],
    ];
  return paint(w, h, (x, y) => {
    const quarter = Math.floor(x / q),
      u = (x % q) / q - 0.5,
      t = y / h; // t 0 the top
    if (quarter === 3) return null;
    if (quarter === 2) {
      // the cane's leaf: a broad blade, a midrib
      const wid = 0.42 * Math.sin(Math.min(1, (1 - t) * 1.15) * Math.PI * 0.5) * (t < 0.08 ? t / 0.08 : 1);
      if (Math.abs(u) > wid) return null;
      const c = greens[Math.min(3, Math.floor(1 + 2.5 * vnoise(x, y, 2, 8, w, h, 191)))];
      return Math.abs(u) < 0.03 ? [c[0] + 30, c[1] + 26, c[2] + 14, 255] : [c[0], c[1], c[2], 255];
    }
    // a reed: a blade narrowing to its tip; the first quarter's its head (a cattail) on its top fifth
    const wid = 0.32 * (0.25 + 0.75 * t);
    if (quarter === 0 && t > 0.08 && t < 0.3) {
      if (Math.abs(u) > 0.2) return null;
      return [...head[Math.min(2, Math.floor(3 * vnoise(x, y, 2, 2, w, h, 193)))], 255];
    }
    if (Math.abs(u) > wid || (quarter === 0 && t <= 0.08 && Math.abs(u) > 0.05)) return null;
    const c =
      greens[
        Math.min(3, Math.floor(4 * clamp01(0.25 + 0.36 * (1 - t) + 0.5 * (vnoise(x, y, 2, 16, w, h, 197) - 0.5))))
      ];
    return [c[0], c[1], c[2], 255];
  });
}
/** THE GRAPES, in their own colours: the vine's broad leaves hung down its side, bunches of dark grapes among them. */
function grapes() {
  const { w, h } = LAND_ART.grapes,
    px = new Array(w * h).fill(null);
  const put = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < w && y >= 0 && y < h) px[y * w + x] = c;
  };
  const leaf = [
      [52, 82, 34],
      [66, 98, 40],
      [84, 116, 50],
      [104, 132, 62],
    ],
    grape = [
      [58, 30, 64],
      [78, 40, 82],
      [98, 54, 104],
    ];
  const r = lcg(11);
  for (let k = 0; k < 16; k++) {
    const cx = 4 + r() * (w - 8),
      cy = 4 + r() * (h * 0.75),
      R = 5 + r() * 4,
      c = leaf[Math.floor(r() * 4)];
    for (let v = -R; v <= R; v++)
      for (let u = -R; u <= R; u++) {
        const a = Math.atan2(v, u),
          lobe = R * (0.75 + 0.25 * Math.cos(a * 5));
        if (u * u + v * v <= lobe * lobe) put(cx + u, cy + v, (u + v) % 7 === 0 ? leaf[3] : c);
      }
  }
  for (let k = 0; k < 5; k++) {
    const cx = 6 + r() * (w - 12),
      cy = h * 0.4 + r() * h * 0.35;
    for (let i = 0; i < 14; i++) {
      const row = Math.floor(i / 3),
        gx = cx + ((i % 3) - 1) * 3.2 * (1 - row * 0.12),
        gy = cy + row * 2.8;
      for (let v = -1; v <= 1; v++)
        for (let u = -1; u <= 1; u++)
          if (u * u + v * v <= 1) put(gx + u, gy + v, u < 0 && v < 0 ? grape[2] : grape[(i + k) % 2]);
    }
  }
  return paint(w, h, (x, y) => {
    const c = px[y * w + x];
    return c ? [c[0], c[1], c[2], 255] : null;
  });
}

const PAINTERS = Object.freeze({ fibre, cap, gills, rock, lichen, bark, rind, leaves, spray, moss, reeds, grapes });

/** A picture by its name (LAND_ART's): `{ width, height, data }`, RGBA top-down. */
export function landPicture(name) {
  const paintIt = /** @type {any} */ (PAINTERS)[name];
  if (!paintIt) throw new Error(`landPicture: no picture ${name}`);
  return paintIt();
}

/** A picture's MEAN, its opaque texels' (0..1 a channel) - a grey picture's the share its look's colour is read over. */
export function pictureMean(pic) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let o = 0; o < pic.data.length; o += 4) {
    if (pic.data[o + 3] < 128) continue;
    r += pic.data[o];
    g += pic.data[o + 1];
    b += pic.data[o + 2];
    n++;
  }
  return n ? [r / n / 255, g / n / 255, b / n / 255] : [1, 1, 1];
}
