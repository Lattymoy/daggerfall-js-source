// @ts-check
// CAPITAL-TREES (2026-10-27, bible/03-World/Arena-Provinces.md CAPITAL-TREES; KPbICA on the game's Discord, forwarded by
// the owner: "The main trees in Falinesti and Mournhold should get some love. They are too draftish for now") - THE
// CAPITALS' TREES' PICTURES: Falinesti's Great Graht-Oak's bark, its leaves and its leaf sprays, Mournhold's garden trees'
// bark, leaves and sprays, and the bed of Mournhold's planters - painted by world/capitalModels.js's own laws (TESA-LORE:
// a tone law dithered onto its material's ramp, every texel its own grain), so they stand in the capitals' one look. No
// game data: every texel is a function of its seed.
//
//   - THE SOLID PICTURES (the bark, the leaves of the crowns' masses, the planters' bed) are vanilla's own wall format,
//     64 x 64 within the freeware's band (TESA-LORE's measures: 16 to 84 colours, a texel 5.4 to 18.4 from the next, a
//     spread of 11.3 to 41.6), every one tiling, laid at 40 texels a metre by vanillaTexels as every capital face is.
//   - THE SPRAYS are a tree's FLAT, cut by their alpha: a texel opaque or clear, nothing between (Daggerfall's flats are
//     palette index 0 or a colour), drawn on cards the trees hang out of their crowns (world/capitalTrees.js) on their own
//     texture coordinates, at the density Daggerfall draws its own trees' flats - measured on the freeware's nature
//     archives (TEXTURE.500-511) at the size a flat is drawn (world/rmbFlats.js scaledBillboardSize - DFU's
//     GetScaledBillboardSize: its texels grown by its record's scale over BlocksFile.ScaleDivisor, at MeshReader.GlobalScale):
//     of its flats 6 m tall and more, 75 of 76 stand at 8 to 20 texels a metre and 45 at 10 (504's 16: 123 x 141 texels at
//     scale 768, 12.3 by 14.1 m). The graht-oak's spray is 128 x 128 (Daggerfall's great trees' flats are 107 to 126
//     wide), its last quarter a liana hung with leaves that tiles down; Mournhold's is 64 x 64.
import { CAPITAL_ART } from './capitalShapes.js';

/** The sprays' sizes, texels (the solid pictures are CAPITAL_ART_SIZE's 64 x 64). */
export const SPRAY_TEXELS = Object.freeze({
  graht: Object.freeze({ w: 128, h: 128 }),
  mournhold: Object.freeze({ w: 64, h: 64 }),
});
/** The graht-oak's spray's liana: the picture's columns from `u0` (a share of its width) to its edge, tiling down. */
export const LIANA_U0 = 0.75;
/** The texels a spray keeps clear at its picture's sides and top (its foot is its bottom row). */
export const SPRAY_MARGIN = 2;

/**
 * THE TREES' PICTURES on `out` (record to picture), painted by the capitals' own kit (world/capitalModels.js capitalArt:
 * `painted(ramps, tone, {seed, grain, w, h})`, `ramp(stops, n)`, `noise(seed, n, S)`, `rng(seed)`).
 * @param {Map<number, any>} out
 * @param {{ painted: Function, ramp: Function, noise: Function, rng: Function }} kit
 */
export function capitalTreeArt(out, kit) {
  out.set(CAPITAL_ART.grahtBark, grahtBark(kit));
  out.set(
    CAPITAL_ART.grahtLeaves,
    canopy(kit, GRAHT_LEAVES, { seed: 0x9a11, n: 150, len: [3.2, 5.2], wid: [1.5, 2.3] }),
  );
  out.set(CAPITAL_ART.grahtSpray, grahtSpray(kit));
  out.set(CAPITAL_ART.mhBark, mournholdBark(kit));
  out.set(
    CAPITAL_ART.mhLeaves,
    canopy(kit, MH_LEAVES, { seed: 0x9b11, n: 92, len: [4.4, 6.6], wid: [2.1, 3.0], spread: 0.5 }),
  );
  out.set(CAPITAL_ART.mhSpray, mournholdSpray(kit));
  out.set(CAPITAL_ART.planterBed, planterBed(kit));
}

// ---------------------------------------------------------------- the colours

/** The graht-oak's bark and leaves in the jungle's graht-oaks' hues (render/grahtOakArt.js GRAHT_PALETTE: grey-brown
 *  bark, moss in its cracks, dark greens), so the Great Graht-Oak is its forest's tree. */
const GRAHT_BARK = [
  [28, 22, 18],
  [52, 43, 35],
  [80, 68, 55],
  [108, 95, 78],
  [140, 128, 106],
  [168, 158, 134],
];
const GRAHT_MOSS = [
  [32, 46, 22],
  [56, 76, 32],
  [88, 108, 46],
  [116, 134, 62],
];
const GRAHT_LEAVES = [
  [20, 38, 16],
  [34, 64, 24],
  [54, 92, 34],
  [78, 118, 44],
  [108, 146, 58],
  [150, 176, 80],
];
const TWIG = [
  [46, 34, 24],
  [74, 56, 38],
  [104, 82, 58],
];
/** Mournhold's garden trees: a pale, smooth bark; a warmer, brighter broadleaf green - a garden's tree of Deshaan's warm,
 *  wet lowlands (world/tamriel/tamrielBiomes.js morrowindDeshaan). */
const MH_BARK = [
  [66, 60, 52],
  [106, 98, 86],
  [146, 136, 118],
  [180, 172, 154],
  [206, 200, 184],
];
const MH_LICHEN = [
  [88, 98, 78],
  [124, 134, 106],
  [158, 166, 134],
];
const MH_LEAVES = [
  [20, 42, 18],
  [38, 74, 24],
  [70, 112, 34],
  [112, 150, 52],
  [160, 186, 84],
  [200, 212, 124],
];

// ---------------------------------------------------------------- the leaf raster

const S = 64;
/** The nearer distance between two columns or rows through the picture's wrap, and its signed twin. */
const wrap = (d, n = S) => {
  const a = ((d % n) + n) % n;
  return Math.min(a, n - a);
};
const signed = (d, n = S) => ((((d + n / 2) % n) + n) % n) - n / 2;

/**
 * A LEAF RASTER, `w` x `h`: a tone (0 its ramp's dark end, 1 its light) and a kind (-1 none, 0 a leaf, 1 a twig) a
 * texel. `leaf` lays an ellipse along its angle - lit on its upper-left half, brighter to its tip, its midrib darker -
 * and `twig` a stem; texels at or past column `wrapX` wrap down (a liana's), and with `wrapAll` every texel wraps both
 * ways (a picture that tiles); `clip(x, y)` the texels a spray may paint (its outline never cut by its picture's edge).
 */
function leafRaster(w, h, { wrapX = w, wrapAll = false, clip = null } = {}) {
  const tone = new Float32Array(w * h),
    kind = new Int8Array(w * h).fill(-1);
  const put = (x, y, t, k) => {
    x = Math.round(x);
    y = Math.round(y);
    if (wrapAll) {
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
    } else if (x >= wrapX) y = ((y % h) + h) % h;
    if (x < 0 || x >= w || y < 0 || y >= h || (clip && !clip(x, y))) return;
    tone[y * w + x] = t;
    kind[y * w + x] = k;
  };
  /** a leaf at (cx, cy) along angle `a` (radians, 0 along +x; y down), `len` by `wid` texels (half-lengths), its shade
   *  `base` in [0, 1] */
  const leaf = (cx, cy, a, len, wid, base) => {
    const ca = Math.cos(a),
      sa = Math.sin(a),
      R = Math.ceil(Math.max(len, wid)) + 1;
    for (let oy = -R; oy <= R; oy++)
      for (let ox = -R; ox <= R; ox++) {
        const v = ox * ca + oy * sa,
          u = -ox * sa + oy * ca,
          along = v / len; // v along the leaf, u across it
        const half = wid * Math.sqrt(Math.max(0, 1 - along * along)) * (along > 0 ? 1 - along * 0.35 : 1); // its taper to its tip
        if (Math.abs(along) > 1 || Math.abs(u) > half) continue;
        const upLeft = -(ox + oy) / (R * 1.4); // a texel's lean toward the light, up and left
        let t = base + upLeft * 0.16 + along * 0.08;
        if (Math.abs(u) < 0.5 && along > -0.75 && along < 0.65) t -= 0.12; // the midrib
        if (Math.abs(u) > half - 0.7) t -= 0.08; // its rim
        put(cx + ox, cy + oy, Math.max(0.05, Math.min(0.98, t)), 0);
      }
  };
  /** a twig from (x, y) along angle a, `len` texels, bending `bend` a texel, drawn where `inside` keeps it; answers its
   *  points [x, y, angle] */
  const twig = (x, y, a, len, bend, rnd, inside = (/** @type {number} */ _x, /** @type {number} */ _y) => true) => {
    const pts = [];
    for (let s = 0; s < len; s++) {
      x += Math.cos(a);
      y += Math.sin(a);
      a += bend + (rnd() - 0.5) * 0.08;
      pts.push([x, y, a]);
      const t = 0.3 + rnd() * 0.4;
      if (!inside(x, y)) continue;
      put(x, y, t, 1);
      if (s < len * 0.3) put(x + 1, y, 0.2, 1); // thicker at its foot
    }
    return pts;
  };
  return { tone, kind, put, leaf, twig };
}
/** A seeded stream for a raster's draws (an LCG: the same leaves on every client). */
const lcg = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
};

// ---------------------------------------------------------------- the solid pictures

/**
 * THE GRAHT-OAK'S BARK: deep fissures wandering up the trunk between long ridged plates, each plate broken across by
 * short cracks into blocks, lit on its left edge and shadowed on its right as the capitals' stones are, its grain streaked
 * up it; moss in the fissures' mouths where the damp sits. Tiles: the fissures' waves are whole periods of the side.
 */
function grahtBark({ painted, ramp, noise, rng }) {
  const r = rng(0x9a01),
    streak = noise(0x9a02, 16),
    damp = noise(0x9a03, 8),
    lump = noise(0x9a04, 8);
  const fissures = Array.from({ length: 6 }, (_, k) => ({
    x: (k + 0.2 + r() * 0.6) * (S / 6),
    amp: 1.2 + r() * 2.2,
    m: 1 + Math.floor(r() * 2),
    ph: r() * 6.283,
    w: 0.7 + r() * 0.7,
  }));
  const at = (k, y) => {
    const f = fissures[k];
    return f.x + f.amp * Math.sin((y / S) * 6.283 * f.m + f.ph);
  };
  // each plate (between fissure k and the next) broken by a few short cracks: a row, the share of the plate it crosses
  // from its left (cracks run in from a fissure and stop)
  const cracks = fissures.map(() =>
    Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({
      y: Math.floor(r() * S),
      reach: 0.35 + r() * 0.5,
      left: r() < 0.5,
    })),
  );
  const shade = fissures.map(() => Array.from({ length: 6 }, () => r() * 0.2 - 0.1));
  return painted(
    [ramp(GRAHT_BARK), ramp(GRAHT_MOSS, 14)],
    (x, y) => {
      let k = 0,
        best = Infinity;
      for (let i = 0; i < fissures.length; i++) {
        const d = wrap(x + 0.5 - at(i, y));
        if (d < best) {
          best = d;
          k = i;
        }
      }
      const side = signed(x + 0.5 - at(k, y)),
        f = fissures[k];
      const plate = side > 0 ? k : (k + fissures.length - 1) % fissures.length,
        next = (plate + 1) % fissures.length;
      const width = wrap(at(next, y) - at(plate, y)) || 1,
        across = wrap(x + 0.5 - at(plate, y)) / width; // 0 at its left fissure, 1 at its right
      if (best < f.w) return damp(x, y) > 0.7 ? [0.12 + damp(x, y) * 0.3, 1] : 0.04 + lump(x, y) * 0.08; // a fissure, damp in places
      const rows = cracks[plate],
        block = rows.filter((c) => c.y <= y).length % shade[plate].length;
      const crack = rows.find((c) => wrap(y - c.y) < 0.6 && (c.left ? across < c.reach : across > 1 - c.reach));
      if (crack) return 0.13 + lump(x, y) * 0.06; // a crack into the plate
      let t = 0.5 + shade[plate][block] + (streak(x * 3, y) - 0.5) * 0.24 + (lump(x, y) - 0.5) * 0.2;
      if (side > 0 && side < f.w + 1.6) t += 0.15; // the plate's left edge, lit
      if (side < 0 && -side < f.w + 1.4) t -= 0.13; // its right, in the fissure's shadow
      if (rows.some((c) => wrap(y - c.y - 1) < 0.6 && (c.left ? across < c.reach : across > 1 - c.reach))) t += 0.12; // lit under its crack
      if (damp(x, y) > 0.78 && best < f.w + 1.6) return [0.3 + damp(x, y) * 0.4, 1]; // moss creeping out of the fissure
      return t;
    },
    { seed: 0x9a05, grain: 0.045 },
  );
}

/**
 * THE LEAVES OF A CROWN'S MASS: `n` leaves over a dark ground of the crown's depth, each its own size, angle and shade,
 * the higher-lit drawn over the darker (a clump's top over its hollows); tiles, every leaf wrapping both ways.
 */
function canopy({ painted, ramp, noise }, stops, { seed, n, len, wid, spread = 0.62 }) {
  const R = leafRaster(S, S, { wrapAll: true }),
    rnd = lcg(seed),
    depth = noise(seed + 1, 4),
    clump = noise(seed + 2, 8);
  const leaves = Array.from({ length: n }, () => ({
    x: rnd() * S,
    y: rnd() * S,
    a: rnd() * 6.283,
    l: len[0] + rnd() * (len[1] - len[0]),
    w: wid[0] + rnd() * (wid[1] - wid[0]),
    k: rnd(),
  }));
  for (const L of leaves) L.k = 0.6 * L.k + 0.4 * clump(Math.floor(L.x), Math.floor(L.y));
  leaves.sort((p, q) => p.k - q.k); // the darker under, the lit over them
  for (const L of leaves) R.leaf(L.x, L.y, L.a, L.l, L.w, 0.22 + L.k * spread);
  return painted(
    ramp(stops),
    (x, y) => {
      const i = y * S + x;
      return R.kind[i] < 0 ? 0.06 + depth(x, y) * 0.18 : R.tone[i];
    },
    { seed: seed + 3, grain: 0.05 },
  );
}

/**
 * MOURNHOLD'S GARDEN TREES' BARK: smooth and pale, faintly streaked up the trunk; dark lenticels across it in short
 * dashes, each over its lit lip; small patches of grey-green lichen.
 */
function mournholdBark({ painted, ramp, noise, rng }) {
  const r = rng(0x9b01),
    streak = noise(0x9b02, 16),
    patch = noise(0x9b03, 8),
    tone = noise(0x9b04, 4);
  const dashes = Array.from({ length: 30 }, () => ({
    x: Math.floor(r() * S),
    y: Math.floor(r() * S),
    w: 2 + Math.floor(r() * 4),
  }));
  return painted(
    [ramp(MH_BARK), ramp(MH_LICHEN, 12)],
    (x, y) => {
      for (const d of dashes) {
        const dx = (((x - d.x) % S) + S) % S;
        if (y === d.y && dx < d.w) return 0.16; // a lenticel
        if (y === (d.y + 1) % S && dx < d.w) return 0.66; // its lit lip under it
      }
      if (patch(x, y) > 0.72) return [0.25 + tone(x, y) * 0.6, 1]; // lichen
      return 0.5 + (streak(x * 4, y) - 0.5) * 0.26 + (tone(x, y) - 0.5) * 0.3;
    },
    { seed: 0x9b05, grain: 0.06 },
  );
}

/**
 * THE BED OF MOURNHOLD'S PLANTERS: dark loam, its pebbles, tufts of meadow rye and Tribunal's flowers in the city's
 * planters (UESP's Tribunal ingredients, "found growing in various planters in Mournhold", Plaza Brindisi Dorom's among
 * them): Noble Sedge purple, Golden Sedge yellow, Timsa-Come-By pink.
 */
function planterBed({ painted, ramp, noise, rng }) {
  const r = rng(0x9c01),
    loam = noise(0x9c02, 8),
    fine = noise(0x9c03, 32);
  const RYE = [
      [60, 70, 30],
      [104, 112, 50],
      [150, 150, 78],
      [190, 180, 112],
    ],
    SOIL = [
      [24, 18, 12],
      [46, 34, 24],
      [72, 56, 38],
      [100, 80, 56],
    ];
  const FLOWERS = [
    [
      [66, 30, 82],
      [116, 62, 140],
      [168, 112, 192],
    ],
    [
      [132, 98, 18],
      [196, 162, 40],
      [236, 214, 98],
    ],
    [
      [134, 52, 74],
      [196, 104, 132],
      [236, 168, 188],
    ],
  ];
  /** @type {Map<number, [number, number]>} a texel's [tone, ramp] where a tuft or a flower is painted over the loam */
  const over = new Map();
  const put = (x, y, t, k) => over.set((((y % S) + S) % S) * S + (((x % S) + S) % S), [t, k]);
  for (let i = 0; i < 22; i++) {
    // the rye: a tuft of blades fanned up from a root
    const x0 = Math.floor(r() * S),
      y0 = Math.floor(r() * S),
      blades = 3 + Math.floor(r() * 3);
    for (let b = 0; b < blades; b++) {
      const lean = (b - (blades - 1) / 2) * 0.55 + (r() - 0.5) * 0.3,
        len = 3 + Math.floor(r() * 3);
      for (let s = 0; s < len; s++) put(Math.round(x0 + lean * s), y0 - s, 0.3 + (s / len) * 0.6, 1);
    }
  }
  for (let i = 0; i < 26; i++) {
    // the flowers: a bloom of a few petals, its heart lit
    const x0 = Math.floor(r() * S),
      y0 = Math.floor(r() * S),
      k = 2 + (i % 3);
    put(x0, y0 + 1, 0.12, 1);
    put(x0, y0 + 2, 0.2, 1); // its stalk
    for (const [dx, dy, t] of [
      [0, 0, 0.95],
      [-1, 0, 0.5],
      [1, 0, 0.6],
      [0, -1, 0.7],
      [0, 1, 0.35],
    ])
      put(x0 + dx, y0 + dy, t, k);
  }
  return painted(
    [ramp(SOIL, 16), ramp(RYE, 12), ...FLOWERS.map((f) => ramp(f, 8))],
    (x, y) => {
      const o = over.get(y * S + x);
      if (o) return o;
      const pebble = fine(x, y) > 0.8;
      return pebble ? 0.62 + fine(x, y) * 0.3 : 0.22 + loam(x, y) * 0.46 + (fine(x, y) - 0.5) * 0.24;
    },
    { seed: 0x9c04, grain: 0.06 },
  );
}

// ---------------------------------------------------------------- the sprays (cut by their alpha)

/** A spray's raster painted by the kit's dither onto the leaves' and the twigs' ramps, every texel opaque or clear. */
function cutPicture({ painted, ramp }, R, w, h, stops, seed) {
  const img = painted(
    [ramp(stops), ramp(TWIG, 10)],
    (x, y) => {
      const i = y * w + x;
      return R.kind[i] < 0 ? 0.5 : [R.tone[i], R.kind[i]];
    },
    { seed, grain: 0.04, w, h },
  );
  for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = R.kind[i] < 0 ? 0 : 255;
  return img;
}

/**
 * A SPRAY's leaves: twigs fanned up from (fx, fy) - the picture's bottom middle, a card's base where it leaves its crown
 * (v 0 is the picture's bottom row) - leaves alternating along each, and a clump at each twig's end and along its outer
 * part: a crown's edge seen close, its outline ragged. `box` [x0, y0, x1, y1] the texels a leaf's middle keeps inside.
 */
function sprayLeaves(R, rnd, { fx, fy, twigs, fan, len, leaf, clump, box }) {
  const [x0, y0, x1, y1] = box,
    inside = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  for (let k = 0; k < twigs; k++) {
    const a = -Math.PI / 2 + (k / (twigs - 1) - 0.5) * fan + (rnd() - 0.5) * 0.18;
    const pts = R.twig(
      fx + (rnd() - 0.5) * 6,
      fy,
      a,
      Math.floor(len[0] + rnd() * (len[1] - len[0])),
      (rnd() - 0.5) * 0.025,
      rnd,
      inside,
    );
    pts.forEach(([x, y, ta], i) => {
      if (!inside(x, y)) return;
      const side = Math.floor(i / 3) % 2 ? 1 : -1;
      if (i > 4 && i % 3 === 0)
        R.leaf(
          x + Math.cos(ta + side * 1.2) * leaf[0] * 0.8,
          y + Math.sin(ta + side * 1.2) * leaf[0] * 0.8,
          ta + side * 0.8,
          leaf[0] + rnd() * leaf[1],
          leaf[2] + rnd() * leaf[3],
          0.28 + rnd() * 0.42,
        );
      if (i === pts.length - 1 || (i > pts.length * 0.6 && i % 5 === 0)) {
        for (let c = 0; c < clump; c++) {
          const ca = rnd() * 6.283,
            d = 1 + rnd() * leaf[0] * 1.3,
            cx = x + Math.cos(ca) * d,
            cy = y + Math.sin(ca) * d;
          if (inside(cx, cy))
            R.leaf(cx, cy, ca, leaf[0] + rnd() * leaf[1], leaf[2] + rnd() * leaf[3], 0.34 + rnd() * 0.5);
        }
      }
    });
  }
}

/**
 * THE GRAHT-OAK'S SPRAY (128 x 128): its first three quarters a spray of oak leaves on twigs fanned up from its foot,
 * crowding to the twigs' ends; its last quarter a liana hung with leaves that tiles down (the lianas' cards repeat it).
 */
function grahtSpray(kit) {
  const { w, h } = SPRAY_TEXELS.graht,
    x1 = Math.round(w * LIANA_U0),
    rnd = lcg(0x9a21);
  const R = leafRaster(w, h, {
    wrapX: x1,
    clip: (x, y) => x >= x1 || (x >= SPRAY_MARGIN && x < x1 - SPRAY_MARGIN && y >= SPRAY_MARGIN),
  });
  sprayLeaves(R, rnd, {
    fx: x1 / 2,
    fy: h - 2,
    twigs: 12,
    fan: 2.4,
    len: [44, 92],
    leaf: [4.2, 2.2, 1.9, 0.9],
    clump: 7,
    box: [6, 6, x1 - 7, h],
  });
  // the liana: a stem waving down the last quarter (whole periods of the side, so it tiles), its leaves alternating
  const lx = x1 + (w - x1) / 2,
    stem = (y) => lx + 3 * Math.sin((y / h) * 4 * Math.PI);
  for (let y = 0; y < h; y++) {
    R.put(stem(y), y, 0.45, 1);
    R.put(stem(y) + 1, y, 0.25, 1);
  }
  for (let y = 4; y < h + 4; y += 11) {
    const side = Math.floor(y / 11) % 2 ? 1 : -1;
    R.leaf(stem(y) + side * 5, y + 2, side > 0 ? 0.6 : Math.PI - 0.6, 5 + (y % 3), 2.3, 0.34 + (y % 5) * 0.08);
  }
  return cutPicture(kit, R, w, h, GRAHT_LEAVES, 0x9a28);
}

/** MOURNHOLD'S SPRAY (64 x 64): broad leaves on a few twigs fanned up from the picture's bottom middle. */
function mournholdSpray(kit) {
  const { w, h } = SPRAY_TEXELS.mournhold,
    rnd = lcg(0x9b21),
    R = leafRaster(w, h, { clip: (x, y) => x >= SPRAY_MARGIN && x < w - SPRAY_MARGIN && y >= SPRAY_MARGIN });
  sprayLeaves(R, rnd, {
    fx: w / 2,
    fy: h - 2,
    twigs: 8,
    fan: 2.2,
    len: [22, 44],
    leaf: [4.6, 1.8, 2.4, 0.8],
    clump: 4,
    box: [4, 4, w - 5, h],
  });
  return cutPicture(kit, R, w, h, MH_LEAVES, 0x9b28);
}
