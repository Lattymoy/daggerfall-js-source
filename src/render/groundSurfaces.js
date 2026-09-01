// ═══════════════════════════════════════════════════════════════════
// EE4: THE DRAWN GROUND SURFACES.
//
// Enhanced Environments replaces what is INSIDE Daggerfall's ground
// tiles and keeps their SHAPES and their COLOURS. Three laws:
//
// 1. THE SHAPES ARE DAGGERFALL'S. A climate archive is four BASES and
//    fifty-two BLENDS carrying its own hand-drawn transitions. The
//    blends are DERIVED: every original texel is classified to a base
//    by palette distance, that mask is upsampled with a wrapping read,
//    and the new surfaces are composited through it. The world keeps
//    its coastlines and paths at any resolution.
//
// 2. THE COLOURS ARE DAGGERFALL'S. Measured off the archives: base 0 is
//    always water, and bases 1-3 are dirt/grass/stone in temperate,
//    three sands in desert, dark browns and greens in mountain and
//    swamp - and in WINTER all three are near-white snow. So a base is
//    IDENTIFIED from its own mean colour (which surface family it is),
//    DRAWN as that surface, and then COLOUR-MATCHED to the archive's
//    mean, so the climate's own palette is what the player sees and the
//    surface supplies only the detail. A green lawn in a winter town
//    would be a lie the archive never told.
//
// 3. NOTHING SHIPS AS PIXELS. The surfaces are procedural and ours; the
//    shapes and colours are read from the player's own archive at load;
//    the tiles are built on the machine that has the game and stored
//    nowhere. Doctrine forbids a raster of game data in this repo.
//
// Every frequency is a WHOLE NUMBER OF CYCLES PER TILE, PER AXIS. The
// noise wraps on its integer lattice, and a fractional step - the first
// attempt's `P * 0.9` - lands u=0 and u=1 on different corners and
// carries a seam. Whole cycles make the wrap exact by construction.

/** Periodic value noise with a whole-cell period on EACH axis. */
export function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => {
    const u = (h & 1) ? x : y; const v = (h & 2) ? y : x;
    return ((h & 4) ? -u : u) + ((h & 8) ? -v : v);
  };
  return (x, y, px, py = px) => {
    const wx = Math.max(1, Math.round(px)); const wy = Math.max(1, Math.round(py));
    const w = (n, m) => ((n % m) + m) % m;
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const X = w(xi, wx) & 255; const Y = w(yi, wy) & 255;
    const X1 = w(xi + 1, wx) & 255; const Y1 = w(yi + 1, wy) & 255;
    const u = fade(xf); const v = fade(yf);
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(
      lerp(grad(p[(p[X] + Y) & 255], xf, yf), grad(p[(p[X1] + Y) & 255], xf - 1, yf), u),
      lerp(grad(p[(p[X] + Y1) & 255], xf, yf - 1), grad(p[(p[X1] + Y1) & 255], xf - 1, yf - 1), u),
      v) * 0.5 + 0.5;
  };
}

/** Periodic Worley, whole cells per axis. */
export function worley(x, y, px, seed, py = px) {
  const rnd = (i, j) => {
    let h = ((i * 374761393) ^ (j * 668265263) ^ (seed * 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return [(h & 0xffff) / 65536, ((h >>> 16) & 0xffff) / 65536];
  };
  const wx = Math.max(1, Math.round(px)); const wy = Math.max(1, Math.round(py));
  const xi = Math.floor(x); const yi = Math.floor(y);
  let f1 = 9; let f2 = 9;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const ci = xi + di; const cj = yi + dj;
      const w = (n, m) => ((n % m) + m) % m;
      const [ox, oy] = rnd(w(ci, wx), w(cj, wy));
      const d = Math.hypot(ci + ox - x, cj + oy - y);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2 };
}

export const cl = (v, a, b) => Math.min(b, Math.max(a, v));
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sh = (c, k) => [cl(c[0] * k, 0, 255), cl(c[1] * k, 0, 255), cl(c[2] * k, 0, 255)];

/** The blade lattice: cells wrap; each holds a few blades with hashed
 *  angle, length, width and hue; a point is tested against the capsules
 *  of its cell and its neighbours. Turf is thousands of drawn blades
 *  over soil, and the contact shadow each drops is what gives a lawn
 *  depth instead of pattern. */
export function makeBlades({ cells = 30, perCell = 6, len = [0.028, 0.075], wid = [0.0026, 0.0050] } = {}) {
  const h3 = (i, j, k) => {
    let h = ((i * 374761393) ^ (j * 668265263) ^ (k * 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return [(h & 1023) / 1024, ((h >>> 10) & 1023) / 1024, ((h >>> 20) & 1023) / 1024];
  };
  const capsule = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax; const dy = by - ay;
    const t = cl(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9), 0, 1);
    return { d: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
  };
  const visit = (u, v, fn) => {
    const ci = Math.floor(u * cells); const cj = Math.floor(v * cells);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const gi = ci + di; const gj = cj + dj;
        const wi = ((gi % cells) + cells) % cells; const wj = ((gj % cells) + cells) % cells;
        for (let k = 0; k < perCell; k++) {
          const [a, b, c2] = h3(wi, wj, k);
          const [d, e] = h3(wi + 977, wj + 331, k);
          const [, , f] = h3(wi + 331, wj + 977, k);
          const rx = (gi + a) / cells; const ry = (gj + b) / cells;
          const ang = c2 * 6.2832;
          const L = len[0] + d * (len[1] - len[0]);
          fn({ rx, ry, tx: rx + Math.cos(ang) * L, ty: ry + Math.sin(ang) * L, w: wid[0] + e * (wid[1] - wid[0]), hue: f });
        }
      }
    }
  };
  return {
    at(u, v, tuft, bare) {
      let best = null;
      visit(u, v, (bl) => {
        if (bl.hue > 0.62 + tuft * 0.38 - bare * 0.80) return;
        const { d, t } = capsule(u, v, bl.rx, bl.ry, bl.tx, bl.ty);
        if (d < bl.w * (1 - t * 0.7) && (!best || t > best.t)) best = { t, shade: bl.hue };
      });
      return best;
    },
    shadow(u, v) {
      let s2 = 0;
      visit(u + 0.004, v + 0.006, (bl) => {
        const { d } = capsule(u + 0.004, v + 0.006, bl.rx, bl.ry, bl.tx, bl.ty);
        if (d < bl.w * 2.2) s2 = Math.max(s2, 1 - d / (bl.w * 2.2));
      });
      return s2;
    },
  };
}

/** The six surfaces. Each is (u, v) -> { rgb, h }, tileable by
 *  construction, tuned in the Enhanced Environments lab. */
export function makeSurfaces(seed = 0x51ed) {
  const n = makeNoise(seed);
  // F(u, v, cx, cy): a field that completes exactly cx cycles across
  // the tile in x and cy in y - whole numbers, doubled per octave, so
  // the wrap is exact by construction.
  const F = (u, v, cx, cy = cx, oct = 4, gain = 0.5) => {
    let a = 1; let f = 1; let sum = 0; let norm = 0;
    for (let o = 0; o < oct; o++) { sum += a * n(u * cx * f, v * cy * f, cx * f, cy * f); norm += a; a *= gain; f *= 2; }
    return sum / norm;
  };
  const W = (u, v, cells, seed2, cellsY = cells) => worley(u * cells, v * cellsY, cells, seed2, cellsY);
  const blades = makeBlades();
  const TWO_PI = Math.PI * 2;

  const grass = (u, v) => {
    const grain = F(u, v, 240, 240, 3);
    const tone = F(u, v, 11, 11, 4);
    let c = mix3([74, 58, 40], [104, 82, 56], cl((tone - 0.35) * 2.0, 0, 1));
    c = sh(c, 0.86 + grain * 0.3);
    const peb = W(u, v, 88, 17);
    const stone = cl((0.13 - peb.f1) * 11, 0, 1);
    if (stone > 0.01) c = mix3(c, [130, 122, 110], stone * 0.7);
    const t = W(u, v, 25, 91);
    const tuft = cl((t.f2 - t.f1) * 2.6, 0, 1);
    const dry = cl((F(u, v, 4, 4, 3) - 0.5) * 3.4, 0, 1);
    const bare = cl((0.34 - F(u, v, 6, 6, 4)) * 4.5, 0, 1);
    const lit = blades.at(u, v, tuft, bare);
    if (lit) {
      const base = mix3([48, 76, 32], [118, 152, 66], cl(lit.t * 1.15, 0, 1));
      let bc = mix3(base, [152, 146, 84], dry * 0.5);
      bc = sh(bc, 0.78 + tuft * 0.30 + lit.shade * 0.40);
      bc = sh(bc, 0.94 + F(u, v, 560, 560, 2) * 0.14);
      return { rgb: bc, h: 0.45 + lit.t * 0.55 + tuft * 0.18 };
    }
    const sha = blades.shadow(u, v);
    c = sh(c, 0.62 + (1 - sha) * 0.50);
    c = mix3(c, [58, 80, 40], cl(0.35 + tuft * 0.65, 0, 1) * (1 - bare) * 0.62);
    return { rgb: c, h: 0.06 + stone * 0.30 + grain * 0.10 + tuft * 0.10 };
  };

  const dirt = (u, v) => {
    const tone = F(u, v, 7, 7, 4);
    const grain = F(u, v, 240, 240, 3);
    let c = mix3([104, 78, 52], [148, 116, 78], cl((tone - 0.35) * 2.0, 0, 1));
    c = sh(c, 0.84 + grain * 0.34);
    let h = 0.35 + grain * 0.14 + tone * 0.10;
    const rut = cl(1 - Math.abs(F(u, v, 11, 4, 4) - 0.5) * 11, 0, 1);
    c = sh(c, 1 - rut * 0.24); h -= rut * 0.22;
    for (const [cells, seed2, size, tint] of [[45, 17, 0.20, [156, 146, 132]], [90, 71, 0.13, [128, 118, 104]]]) {
      const w = W(u, v, cells, seed2);
      const st = cl((size - w.f1) * (1 / size) * 1.6, 0, 1);
      if (st > 0.01) { c = mix3(c, tint, st * 0.78); c = sh(c, 1 + st * 0.16); h += st * 0.40; }
      const sha = cl((size * 1.7 - w.f1) * (1 / size), 0, 1) - st;
      if (sha > 0.01) c = sh(c, 1 - sha * 0.20);
    }
    const straw = cl((F(u, v, 156, 54, 2) - 0.74) * 7, 0, 1);
    c = mix3(c, [150, 132, 84], straw * 0.6); h += straw * 0.10;
    return { rgb: c, h: cl(h, 0, 1) };
  };

  const stone = (u, v) => {
    const wx = (F(u, v, 5, 5, 3) - 0.5) * 1.1;
    const wy = (F(u + 0.31, v + 0.17, 5, 5, 3) - 0.5) * 1.1;
    const w = worley(u * 13 + wx, v * 13 + wy, 13, 53, 13);
    const dome = cl((Math.sqrt(w.f2) - Math.sqrt(w.f1)) * 3.0, 0, 1);
    const mott = F(u, v, 12, 12, 5);
    const grit = F(u, v, 220, 220, 3);
    const plateTint = F(Math.floor(u * 13) / 13, Math.floor(v * 13) / 13, 13, 13, 2);
    let c = mix3([88, 86, 82], [142, 139, 130], dome * 0.55 + mott * 0.3 + plateTint * 0.15);
    c = sh(c, 0.86 + grit * 0.30);
    let h = 0.25 + dome * 0.62 + grit * 0.08;
    const seam = cl(1 - dome * 8, 0, 1);
    c = mix3(c, [58, 57, 56], seam * 0.6); h -= seam * 0.42;
    const frac = cl(1 - Math.abs(F(u, v, 30, 30, 3) - 0.5) * 16, 0, 1) * dome;
    c = sh(c, 1 - frac * 0.22); h -= frac * 0.12;
    const lich = cl((F(u, v, 18, 18, 4) - 0.60) * 4.5, 0, 1) * dome;
    c = mix3(c, [104, 116, 68], lich * 0.42); h += lich * 0.05;
    return { rgb: c, h: cl(h, 0, 1) };
  };

  const water = (u, v) => {
    const depth = F(u, v, 5, 5, 4);
    let c = mix3([26, 54, 86], [44, 92, 128], cl((depth - 0.35) * 2.2, 0, 1));
    const r1 = Math.sin((u * 3 + v * 1) * TWO_PI);
    const r2 = Math.sin((u * 1 - v * 4) * TWO_PI + 1.7);
    const chop = F(u, v, 10, 10, 3);
    const ridge = cl((r1 * 0.45 + r2 * 0.35) * 0.5 + 0.5 + (chop - 0.5) * 0.4, 0, 1);
    c = sh(c, 0.9 + ridge * 0.24);
    const glint = cl((ridge - 0.88) * 9, 0, 1);
    c = mix3(c, [200, 224, 240], glint * 0.7);
    return { rgb: c, h: 0.20 + ridge * 0.20 };
  };

  const sand = (u, v) => {
    const drift = F(u, v, 4, 4, 4);
    const warp = (F(u, v, 7, 7, 3) - 0.5) * 0.18;
    const ripple = Math.sin((u * 9 + v * 3 + warp) * TWO_PI) * 0.5 + 0.5;
    const fine = F(u, v, 330, 330, 2);
    let c = mix3([196, 168, 118], [226, 202, 152], cl(drift * 0.7 + ripple * 0.3, 0, 1));
    c = sh(c, 0.94 + fine * 0.12);
    let h = 0.30 + ripple * 0.46 + drift * 0.18 + fine * 0.06;
    const st = W(u, v, 48, 29);
    const stn = cl((0.09 - st.f1) * 14, 0, 1);
    if (stn > 0.01) { c = mix3(c, [148, 132, 108], stn * 0.7); h += stn * 0.30; }
    const dark = cl((F(u, v, 420, 420, 2) - 0.72) * 6, 0, 1);
    c = sh(c, 1 - dark * 0.14);
    return { rgb: c, h: cl(h, 0, 1) };
  };

  const snow = (u, v) => {
    const drift = F(u, v, 5, 5, 5);
    const sastrugi = Math.sin((u * 7 + (F(u, v, 8, 8, 3) - 0.5) * 0.5) * TWO_PI) * 0.5 + 0.5;
    const grain = F(u, v, 360, 360, 2);
    let c = mix3([206, 214, 226], [244, 248, 255], cl(drift * 0.6 + sastrugi * 0.4, 0, 1));
    c = sh(c, 0.96 + grain * 0.08);
    let h = 0.34 + drift * 0.40 + sastrugi * 0.22 + grain * 0.06;
    const holl = cl((0.42 - drift) * 3.2, 0, 1);
    c = mix3(c, [166, 186, 214], holl * 0.5); h -= holl * 0.18;
    const sp = cl((F(u, v, 720, 720, 1) - 0.84) * 9, 0, 1);
    c = mix3(c, [255, 255, 255], sp * 0.9); h += sp * 0.10;
    return { rgb: c, h: cl(h, 0, 1) };
  };

  // ROADS 4 (Mac: "use textures we've developed in the grass proto"):
  // THE ROAD. Packed earth, darker and smoother than dirt, with a
  // scatter of embedded stones worn flat and a faint low-frequency
  // camber - the surface a thousand carts make. Orientation-free on
  // purpose: the tilemap rotates and flips road tiles by bits 6/7, so a
  // rut with a direction would run the wrong way on half of them; the
  // road's DIRECTION is the archive's shape, this is only what fills it.
  const road = (u, v) => {
    const tone = F(u, v, 5, 5, 4);
    const grain = F(u, v, 180, 180, 3);
    let c = mix3([88, 70, 50], [122, 100, 72], cl((tone - 0.3) * 1.8, 0, 1));
    c = sh(c, 0.88 + grain * 0.22);
    let h = 0.30 + grain * 0.06 + tone * 0.05;
    // a camber: the middle of the tile sits a touch higher and lighter
    const camber = 1 - Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 1.4);
    c = sh(c, 1 + camber * 0.06); h += camber * 0.08;
    // flat-worn stones, larger and sparser than dirt's pebbles
    for (const [cells, seed2, size, tint] of [[22, 31, 0.26, [140, 132, 120]], [40, 97, 0.17, [118, 110, 98]]]) {
      const w = W(u, v, cells, seed2);
      const st = cl((size - w.f1) * (1 / size) * 1.9, 0, 1);
      if (st > 0.01) { c = mix3(c, tint, st * 0.72); h += st * 0.22; }
      const sha = cl((size * 1.5 - w.f1) * (1 / size), 0, 1) - st;
      if (sha > 0.01) c = sh(c, 1 - sha * 0.14);
    }
    return { rgb: c, h };
  };
  return { water, dirt, grass, stone, sand, snow, road };
}

/**
 * Which surface FAMILY a base tile is, from its own mean colour. This is
 * the reading a person makes looking at the sheet, and it is what lets
 * one builder serve every climate and both seasons:
 *   water  blue-dominant                         (every archive's base 0)
 *   snow   bright and near-neutral               (winter's bases 1-3)
 *   sand   warm, red over green over blue, light (desert)
 *   grass  green-dominant                        (temperate, swamp)
 *   stone  low saturation, mid luminance
 *   dirt   everything else - browns
 */
export function identifySurface([r, g, b]) {
  const lum = (r + g + b) / 3;
  const maxc = Math.max(r, g, b); const minc = Math.min(r, g, b);
  const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
  if (b > r * 1.25 && b > g * 1.1) return 'water';
  if (lum > 175 && sat < 0.12) return 'snow';
  if (g >= r && g > b * 1.1) return 'grass';
  if (r > g && g > b && lum > 130 && sat > 0.25) return 'sand';
  if (sat < 0.12) return 'stone';
  return 'dirt';
}

/**
 * Build the enhanced tile set from the ORIGINAL layers.
 *
 * `layers` is what uploadTileArray receives: [{width, height, colors}]
 * in the archive's record order, RGBA (Uint8Array or Uint8ClampedArray).
 * The first four are the bases; every other record is a blend and its
 * SHAPE is kept. Returns layers at `size`, ready for the same upload.
 * Pure: no GL, no DOM, so it is pinned without a browser and runs
 * against the real archive in a node test.
 */
/** ROADS 4: the tileset's road records - 46 the surface, 47 and 55 its
 *  dirt and grass edges. The same three the painter writes. */
export const ROAD_RECORDS = Object.freeze(new Set([46, 47, 55]));

export function buildEnhancedTiles(layers, { size = 128, surfaces = null, seed = 0x51ed } = {}) {
  if (!layers || layers.length < 4) return layers;
  const S = surfaces ?? makeSurfaces(seed);
  const meanOf = (l) => {
    let r = 0; let g = 0; let b = 0;
    const n = l.width * l.height;
    for (let k = 0; k < n; k++) { r += l.colors[k * 4]; g += l.colors[k * 4 + 1]; b += l.colors[k * 4 + 2]; }
    return [r / n, g / n, b / n];
  };
  const baseMean = [0, 1, 2, 3].map((i) => meanOf(layers[i]));
  const family = baseMean.map(identifySurface);

  // the four bases: DRAWN as their family, then COLOUR-MATCHED to the
  // archive's own mean per channel, so the climate's palette is what
  // shows and the surface supplies the detail
  // EE4: A RECORD MAY CARRY A MATERIAL THAT IS NONE OF THE FOUR BASES.
  // Measured in the winter town: the cobbled streets are a grey stone
  // that the archive's bases (water and three snows) do not include,
  // and "nearest base" classified them as WATER, because grey is nearer
  // to (53,94,143) than to (208,209,216). The streets drew blue.
  //
  // So a texel farther than RESIDUAL_DIST from every base is a
  // RESIDUAL: the record's own material. The residual texels of a
  // record are identified by their own mean - grey cobbles are stone -
  // and drawn as that surface, colour-matched to that mean, exactly as
  // the bases are. A record can therefore be made of up to five
  // surfaces: the four the archive shares, and its own.
  const RESIDUAL_DIST2 = 42 * 42;
  const residualCache = new Map();   // family:r,g,b -> {px, hh}
  const drawBase = (fam, mean) => {
    const fn = S[fam];
    const px = new Uint8Array(size * size * 4);
    const hh = new Float32Array(size * size);
    const raw = new Float32Array(size * size * 3);
    let sr = 0; let sg = 0; let sb = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = fn(x / size, y / size); const o = (y * size + x) * 3;
        raw[o] = r.rgb[0]; raw[o + 1] = r.rgb[1]; raw[o + 2] = r.rgb[2];
        sr += r.rgb[0]; sg += r.rgb[1]; sb += r.rgb[2];
        hh[y * size + x] = r.h;
      }
    }
    const nn = size * size;
    const scale = [mean[0] / Math.max(1, sr / nn), mean[1] / Math.max(1, sg / nn), mean[2] / Math.max(1, sb / nn)];
    for (let k = 0; k < nn; k++) {
      px[k * 4] = cl(raw[k * 3] * scale[0], 0, 255); px[k * 4 + 1] = cl(raw[k * 3 + 1] * scale[1], 0, 255);
      px[k * 4 + 2] = cl(raw[k * 3 + 2] * scale[2], 0, 255); px[k * 4 + 3] = 255;
    }
    return { px, hh };
  };

  const basePx = [0, 1, 2, 3].map((i) => drawBase(family[i], baseMean[i]));

  const out = [];
  for (let rec = 0; rec < layers.length; rec++) {
    const src = layers[rec];
    const w = src.width; const h = src.height;
    const cls = new Uint8Array(w * h);
    let rr = 0; let rg = 0; let rb = 0; let rn = 0;
    for (let k = 0; k < w * h; k++) {
      const r = src.colors[k * 4]; const g = src.colors[k * 4 + 1]; const b = src.colors[k * 4 + 2];
      let best = 0; let bd = Infinity;
      for (let i = 0; i < 4; i++) {
        const d = (r - baseMean[i][0]) ** 2 + (g - baseMean[i][1]) ** 2 + (b - baseMean[i][2]) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (bd > RESIDUAL_DIST2) { cls[k] = 4; rr += r; rg += g; rb += b; rn++; } else cls[k] = best;
    }
    // the record's own material, if it has one
    let fifth = null;
    if (rn > 0) {
      const mean = [rr / rn, rg / rn, rb / rn];
      // ROADS 4: a road record's own material IS the road, whatever its
      // colour would have been called - grey cobbles read as stone and
      // brown ruts as dirt, and both are a road. Keyed by the tileset's
      // own record numbers (46 road, 47 its dirt edge, 55 its grass
      // edge), still colour-matched to the archive's mean, so a snowy
      // climate's road is a pale road and a desert's a sandy one.
      const fam = ROAD_RECORDS.has(rec) ? 'road' : identifySurface(mean);
      const ck = `${fam}:${mean.map((v) => Math.round(v / 8)).join(',')}`;
      if (!residualCache.has(ck)) residualCache.set(ck, drawBase(fam, mean));
      fifth = residualCache.get(ck);
    }
    const surfaceOf = (i) => (i === 4 ? fifth : basePx[i]);
    const colors = new Uint8Array(size * size * 4);
    const heights = new Float32Array(size * size);
    const weightAt = (fx, fy, want) => {
      const gx = fx * w - 0.5; const gy = fy * h - 0.5;
      const x0 = Math.floor(gx); const y0 = Math.floor(gy);
      const tx = gx - x0; const ty = gy - y0;
      let acc = 0;
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const xx = ((x0 + dx) % w + w) % w; const yy = ((y0 + dy) % h + h) % h;
          if (cls[yy * w + xx] === want) acc += (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
        }
      }
      return acc;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size; const v = y / size;
        let r = 0; let g = 0; let b = 0; let hv = 0; let tot = 0;
        for (let i = 0; i < 5; i++) {
          const sp = surfaceOf(i);
          if (!sp) continue;
          const k = weightAt(u, v, i);
          if (k <= 0.001) continue;
          const o = (y * size + x) * 4;
          r += sp.px[o] * k; g += sp.px[o + 1] * k; b += sp.px[o + 2] * k;
          hv += sp.hh[y * size + x] * k;
          tot += k;
        }
        const o2 = (y * size + x) * 4;
        if (tot > 0) { colors[o2] = r / tot; colors[o2 + 1] = g / tot; colors[o2 + 2] = b / tot; }
        colors[o2 + 3] = 255;
        heights[y * size + x] = tot > 0 ? hv / tot : 0;
      }
    }
    out.push({ width: size, height: size, colors, heights });
  }
  out.families = family;
  return out;
}

/**
 * EE6: NORMALS FROM THE SURFACES' OWN HEIGHT. Every drawn tile carries
 * the height its surface reported - a blade stands, a pebble stands, a
 * rut sinks - and a Sobel pass turns that into a tangent-space normal
 * per texel. This is the single term that separates a picture of
 * ground from ground: every blade and pebble gets a lit side and a
 * shaded side, and they move with the sun. Wrapping reads, so a tile's
 * normals are seamless with its neighbours as its colours are.
 *
 * Returns RGBA layers (xyz encoded 0..255, z up) matching the tiles'
 * size and order, ready for the same upload path.
 */
export function buildTileNormals(tiles, { strength = 3.2 } = {}) {
  const out = [];
  for (const t of tiles) {
    const w = t.width; const h = t.height; const hh = t.heights;
    const px = new Uint8Array(w * h * 4);
    if (!hh) { for (let k = 0; k < w * h; k++) { px[k * 4] = 128; px[k * 4 + 1] = 128; px[k * 4 + 2] = 255; px[k * 4 + 3] = 255; } out.push({ width: w, height: h, colors: px }); continue; }
    const at = (x, y) => hh[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
        const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
        let nx = -dx * strength; let ny = -dy * strength; let nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const o = (y * w + x) * 4;
        px[o] = (nx * 0.5 + 0.5) * 255; px[o + 1] = (ny * 0.5 + 0.5) * 255; px[o + 2] = (nz * 0.5 + 0.5) * 255; px[o + 3] = 255;
      }
    }
    out.push({ width: w, height: h, colors: px });
  }
  return out;
}
