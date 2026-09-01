// ═══════════════════════════════════════════════════════════════════
// EE5: THE DRAWN GROUND SURFACES.
//
// Enhanced Environments replaces what is INSIDE Daggerfall's ground
// tiles and keeps their SHAPES. That distinction is the whole design:
//
//   A climate archive is not four tiles. TEXTURE.302 carries 56
//   records - four BASES (water, dirt, grass, stone) and fifty-two
//   BLEND tiles holding Daggerfall's own hand-drawn transitions
//   between them. Replacing the four and leaving the rest gives a
//   world with sharp grass and blurry edges, and replacing all 56 by
//   hand means drawing fifty-two transitions that already exist.
//
//   So the blends are DERIVED. Every original texel is classified to
//   the base it belongs to by palette distance; that mask is upsampled
//   smoothly; the new high-resolution surfaces are composited through
//   it. The world keeps its exact coastlines and paths at whatever
//   resolution the bases are drawn at, and any two tiles meet
//   seamlessly because they are made of the same four surfaces.
//
// NOTHING HERE IS SHIPPED AS PIXELS. The surfaces are procedural and
// ours; the shapes are read from the player's own archive at load.
// Doctrine forbids a raster of game data in this repo, and it is
// right to - so the tiles are BUILT on the machine that has the game,
// every time, and stored nowhere.
//
// The surfaces are the ones tuned in the Enhanced Environments lab
// (grass-proto.html), and each returns { rgb, h } - a colour AND a
// height, because the height is what a normal map is made of and a
// surface that cannot say how tall it is can only ever be a picture.

/** Periodic value noise: the lattice wraps at `period`, so anything
 *  sampled over [0, period) repeats without a seam. Tileability is a
 *  property of the noise here rather than a fix applied afterwards. */
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
  return (x, y, period) => {
    // EE5: THE PERIOD MUST BE A WHOLE NUMBER OF LATTICE CELLS. The
    // wrap is applied to the integer lattice coordinate, so a
    // fractional period - 4.5, say, which is what `P * 0.9` gives -
    // wraps cell 4 to cell 4.5 and lands on a DIFFERENT corner. Every
    // surface that scaled its period by a non-integer factor carried a
    // seam, measured at u = 1, and no amount of offsetting could undo
    // it because the lattice itself had no period to wrap on. Rounding
    // here fixes it at the one place that can: the frequency is
    // approximate either way, and a seamless tile is not.
    const p2 = Math.max(1, Math.round(period));
    const w = (n) => ((n % p2) + p2) % p2;
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const X = w(xi) & 255; const Y = w(yi) & 255;
    const X1 = w(xi + 1) & 255; const Y1 = w(yi + 1) & 255;
    const u = fade(xf); const v = fade(yf);
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(
      lerp(grad(p[(p[X] + Y) & 255], xf, yf), grad(p[(p[X1] + Y) & 255], xf - 1, yf), u),
      lerp(grad(p[(p[X] + Y1) & 255], xf, yf - 1), grad(p[(p[X1] + Y1) & 255], xf - 1, yf - 1), u),
      v) * 0.5 + 0.5;
  };
}

/** Periodic Worley: cell centres live on a wrapping lattice, so
 *  pebbles, plates and tufts repeat without a seam either. */
export function worley(x, y, period, seed) {
  const rnd = (i, j) => {
    let h = ((i * 374761393) ^ (j * 668265263) ^ (seed * 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return [(h & 0xffff) / 65536, ((h >>> 16) & 0xffff) / 65536];
  };
  const xi = Math.floor(x); const yi = Math.floor(y);
  let f1 = 9; let f2 = 9;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const ci = xi + di; const cj = yi + dj;
      const w = (n) => ((n % period) + period) % period;
      const [ox, oy] = rnd(w(ci), w(cj));
      const d = Math.hypot(ci + ox - x, cj + oy - y);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2 };
}

export const cl = (v, a, b) => Math.min(b, Math.max(a, v));
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sh = (c, k) => [cl(c[0] * k, 0, 255), cl(c[1] * k, 0, 255), cl(c[2] * k, 0, 255)];

/** A blade lattice: cells wrap, each holds a few blades with hashed
 *  angle, length, width and hue, and a point is tested against the
 *  capsules of its own cell and its neighbours. This is what makes
 *  grass read as GRASS rather than as green noise - turf is thousands
 *  of drawn blades over soil, and the contact shadow each one drops is
 *  what gives a lawn depth instead of pattern. */
export function makeBlades({ cells = 30, perCell = 6, len = [0.028, 0.075], wid = [0.0026, 0.0050] } = {}) {
  const h2 = (i, j, k) => {
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
          const [a, b, c2] = h2(wi, wj, k);
          const [d, e] = h2(wi + 977, wj + 331, k);
          const [, , f] = h2(wi + 331, wj + 977, k);
          const rx = (gi + a) / cells; const ry = (gj + b) / cells;
          const ang = c2 * 6.2832;
          const L = len[0] + d * (len[1] - len[0]);
          fn({ rx, ry, tx: rx + Math.cos(ang) * L, ty: ry + Math.sin(ang) * L,
            w: wid[0] + e * (wid[1] - wid[0]), hue: f });
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
    /** the contact shadow: the same capsules, tested a hair off-axis */
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

/** The four surfaces. Each is (u, v) -> { rgb, h } over [0,1), tileable
 *  by construction. Tuned in the lab; the comments there record why
 *  each term exists, and the shapes are identical here. */
export function makeSurfaces(seed = 0x51ed) {
  const n = makeNoise(seed);
  const fbm = (x, y, period, oct, gain = 0.5) => {
    let a = 1; let f = 1; let sum = 0; let norm = 0;
    for (let o = 0; o < oct; o++) { sum += a * n(x * f, y * f, period * f); norm += a; a *= gain; f *= 2; }
    return sum / norm;
  };
  const blades = makeBlades();

  const grass = (u, v) => {
    const P = 8; const x = u * P; const y = v * P;
    const grain = fbm(x * 30 + 21, y * 30 + 9, P * 30, 3);
    const tone = fbm(x * 1.4 - 4, y * 1.4 + 2, P * 1.4, 4);
    let c = mix3([74, 58, 40], [104, 82, 56], cl((tone - 0.35) * 2.0, 0, 1));
    c = sh(c, 0.86 + grain * 0.3);
    const peb = worley(x * 11 + 0.5, y * 11 + 0.5, P * 11, 17);
    const stone = cl((0.13 - peb.f1) * 11, 0, 1);
    if (stone > 0.01) c = mix3(c, [130, 122, 110], stone * 0.7);
    const t = worley(x * 3.1, y * 3.1, P * 3.1, 91);
    const tuft = cl((t.f2 - t.f1) * 2.6, 0, 1);
    const dry = cl((fbm(x * 0.5 + 11, y * 0.5 - 7, P * 0.5, 3) - 0.5) * 3.4, 0, 1);
    const bare = cl((0.34 - fbm(x * 0.7, y * 0.7, P * 0.7, 4)) * 4.5, 0, 1);
    const lit = blades.at(u, v, tuft, bare);
    if (lit) {
      const base = mix3([48, 76, 32], [118, 152, 66], cl(lit.t * 1.15, 0, 1));
      let bc = mix3(base, [152, 146, 84], dry * 0.5);
      bc = sh(bc, 0.78 + tuft * 0.30 + lit.shade * 0.40);
      bc = sh(bc, 0.94 + fbm(x * 70, y * 70, P * 70, 2) * 0.14);
      return { rgb: bc, h: 0.45 + lit.t * 0.55 + tuft * 0.18 };
    }
    const sha = blades.shadow(u, v);
    c = sh(c, 0.62 + (1 - sha) * 0.50);
    c = mix3(c, [58, 80, 40], cl(0.35 + tuft * 0.65, 0, 1) * (1 - bare) * 0.62);
    return { rgb: c, h: 0.06 + stone * 0.30 + grain * 0.10 + tuft * 0.10 };
  };

  const dirt = (u, v) => {
    const P = 6; const x = u * P; const y = v * P;
    const tone = fbm(x * 1.2 - 4, y * 1.2 + 2, P * 1.2, 4);
    const grain = fbm(x * 40 + 21, y * 40 + 9, P * 40, 3);
    let c = mix3([104, 78, 52], [148, 116, 78], cl((tone - 0.35) * 2.0, 0, 1));
    c = sh(c, 0.84 + grain * 0.34);
    let h = 0.35 + grain * 0.14 + tone * 0.10;
    const rut = cl(1 - Math.abs(fbm(x * 1.9 + 40, y * 0.7, P * 1.9, 4) - 0.5) * 11, 0, 1);
    c = sh(c, 1 - rut * 0.24); h -= rut * 0.22;
    for (const [freq, seed2, size, tint] of [[7.5, 17, 0.20, [156, 146, 132]], [15, 71, 0.13, [128, 118, 104]]]) {
      const w = worley(x * freq + 0.5, y * freq + 0.5, P * freq, seed2);
      const st = cl((size - w.f1) * (1 / size) * 1.6, 0, 1);
      if (st > 0.01) { c = mix3(c, tint, st * 0.78); c = sh(c, 1 + st * 0.16); h += st * 0.40; }
      const sha = cl((size * 1.7 - w.f1) * (1 / size), 0, 1) - st;
      if (sha > 0.01) c = sh(c, 1 - sha * 0.20);
    }
    const straw = cl((fbm(x * 26 + 61, y * 9 - 3, P * 26, 2) - 0.74) * 7, 0, 1);
    c = mix3(c, [150, 132, 84], straw * 0.6); h += straw * 0.10;
    return { rgb: c, h: cl(h, 0, 1) };
  };

  const stone = (u, v) => {
    const P = 5; const x = u * P; const y = v * P;
    const wx = (fbm(x * 0.9, y * 0.9, P * 0.9, 3) - 0.5) * 1.1;
    const wy = (fbm(x * 0.9 + 31, y * 0.9 - 17, P * 0.9, 3) - 0.5) * 1.1;
    const w = worley(x * 2.6 + wx, y * 2.6 + wy, P * 2.6, 53);
    const dome = cl((Math.sqrt(w.f2) - Math.sqrt(w.f1)) * 3.0, 0, 1);
    const mott = fbm(x * 2.4 + 7, y * 2.4 - 3, P * 2.4, 5);
    const grit = fbm(x * 44, y * 44, P * 44, 3);
    const plateTint = fbm(Math.floor(x * 2.6 + wx) * 3.7, Math.floor(y * 2.6 + wy) * 3.7, P * 9, 2);
    let c = mix3([88, 86, 82], [142, 139, 130], dome * 0.55 + mott * 0.3 + plateTint * 0.15);
    c = sh(c, 0.86 + grit * 0.30);
    let h = 0.25 + dome * 0.62 + grit * 0.08;
    const seam = cl(1 - dome * 8, 0, 1);
    c = mix3(c, [58, 57, 56], seam * 0.6); h -= seam * 0.42;
    const frac = cl(1 - Math.abs(fbm(x * 6 + 90, y * 6, P * 6, 3) - 0.5) * 16, 0, 1) * dome;
    c = sh(c, 1 - frac * 0.22); h -= frac * 0.12;
    const lich = cl((fbm(x * 3.6 + 60, y * 3.6 + 12, P * 3.6, 4) - 0.60) * 4.5, 0, 1) * dome;
    c = mix3(c, [104, 116, 68], lich * 0.42); h += lich * 0.05;
    return { rgb: c, h: cl(h, 0, 1) };
  };

  const water = (u, v) => {
    // EE5: WATER IS BUILT WITHOUT A DOMAIN WARP, and that is a
    // deliberate retreat. A warp adds an offset to the lookup, and the
    // warped coordinate is only periodic if the offset is too - which
    // it is not, because the offset is itself noise. Every attempt to
    // scale the warp back into period left a visible seam at u = 1,
    // measured, and a surface with a seam is worse than a surface with
    // slightly less character. The ripples are two crossing periodic
    // trains instead: less interesting than a warped ridge, and they
    // tile, which is the property that is not negotiable.
    const P = 5; const x = u * P; const y = v * P;
    const depth = fbm(x * 0.9, y * 0.9, P * 0.9, 4);
    let c = mix3([26, 54, 86], [44, 92, 128], cl((depth - 0.35) * 2.2, 0, 1));
    const TWO_PI = Math.PI * 2;
    const r1 = Math.sin((x * 3 + y * 1) * TWO_PI / P);
    const r2 = Math.sin((x * 1 - y * 4) * TWO_PI / P + 1.7);
    const chop = fbm(x * 2, y * 2, P * 2, 3);
    const ridge = cl((r1 * 0.45 + r2 * 0.35) * 0.5 + 0.5 + (chop - 0.5) * 0.4, 0, 1);
    c = sh(c, 0.9 + ridge * 0.24);
    const glint = cl((ridge - 0.88) * 9, 0, 1);
    c = mix3(c, [200, 224, 240], glint * 0.7);
    return { rgb: c, h: 0.20 + ridge * 0.20 };
  };

  const sand = (u, v) => {
    const P = 6; const x = u * P; const y = v * P;
    const drift = fbm(x * 0.7 + 3, y * 0.7 - 2, P * 0.7, 4);
    const wx2 = x + (fbm(x * 1.1, y * 1.1, P * 1.1, 3) - 0.5) * 1.6;
    const wy2 = y + (fbm(x * 1.1 + 19, y * 1.1 + 7, P * 1.1, 3) - 0.5) * 1.6;
    const ripple = Math.sin((wx2 * 3.0 + wy2 * 1.1) * Math.PI * 2 / P * 3) * 0.5 + 0.5;
    const fine = fbm(x * 55, y * 55, P * 55, 2);
    let c = mix3([196, 168, 118], [226, 202, 152], cl(drift * 0.7 + ripple * 0.3, 0, 1));
    c = sh(c, 0.94 + fine * 0.12);
    let h = 0.30 + ripple * 0.46 + drift * 0.18 + fine * 0.06;
    const st = worley(x * 8 + 0.5, y * 8 + 0.5, P * 8, 29);
    const stn = cl((0.09 - st.f1) * 14, 0, 1);
    if (stn > 0.01) { c = mix3(c, [148, 132, 108], stn * 0.7); h += stn * 0.30; }
    const dark = cl((fbm(x * 70 + 40, y * 70 + 12, P * 70, 2) - 0.72) * 6, 0, 1);
    c = sh(c, 1 - dark * 0.14);
    return { rgb: c, h: cl(h, 0, 1) };
  };

  return { water, dirt, grass, stone, sand };
}

/** The archive's four base records, in its own order. */
export const BASE_ORDER = Object.freeze(['water', 'dirt', 'grass', 'stone']);

/**
 * Build the enhanced tile set from the ORIGINAL layers.
 *
 * `layers` is what uploadTileArray already receives: [{width, height,
 * colors}] in the archive's own record order, RGBA. The first four are
 * the bases; every other record is a blend of them, and its SHAPE is
 * what we keep.
 *
 * Returns layers of the same length at `size`, ready for the same
 * upload. Pure, so it can be pinned without a GPU.
 */
export function buildEnhancedTiles(layers, { size = 256, surfaces = null } = {}) {
  if (!layers || layers.length < 4) return layers;
  const S = surfaces ?? makeSurfaces();
  const names = BASE_ORDER;

  // the four bases' MEAN colours, from the archive itself - the same
  // reading a human makes looking at the sheet, and the only thing the
  // classification needs
  const meanOf = (l) => {
    let r = 0; let g = 0; let b = 0;
    const n = l.width * l.height;
    for (let k = 0; k < n; k++) { r += l.colors[k * 4]; g += l.colors[k * 4 + 1]; b += l.colors[k * 4 + 2]; }
    return [r / n, g / n, b / n];
  };
  const baseMean = names.map((_, i) => meanOf(layers[i]));

  // the new bases, drawn once and shared by every tile that uses them
  const basePx = names.map((nm) => {
    const px = new Uint8Array(size * size * 4);
    const hh = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = S[nm](x / size, y / size);
        const o = (y * size + x) * 4;
        px[o] = r.rgb[0]; px[o + 1] = r.rgb[1]; px[o + 2] = r.rgb[2]; px[o + 3] = 255;
        hh[y * size + x] = r.h;
      }
    }
    return { px, hh };
  });

  const out = [];
  for (let rec = 0; rec < layers.length; rec++) {
    const src = layers[rec];
    const w = src.width; const h = src.height;
    // classify every original texel to the base it belongs to
    const cls = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) {
      const r = src.colors[k * 4]; const g = src.colors[k * 4 + 1]; const b = src.colors[k * 4 + 2];
      let best = 0; let bd = Infinity;
      for (let i = 0; i < 4; i++) {
        const d = (r - baseMean[i][0]) ** 2 + (g - baseMean[i][1]) ** 2 + (b - baseMean[i][2]) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      cls[k] = best;
    }
    const colors = new Uint8Array(size * size * 4);
    const height = new Float32Array(size * size);
    // bilinear over the 0/1 membership field, sampled with WRAP so a
    // tile's own edges stay seamless with its neighbours
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
        for (let i = 0; i < 4; i++) {
          const k = weightAt(u, v, i);
          if (k <= 0.001) continue;
          const o = (y * size + x) * 4;
          r += basePx[i].px[o] * k; g += basePx[i].px[o + 1] * k; b += basePx[i].px[o + 2] * k;
          hv += basePx[i].hh[y * size + x] * k;
          tot += k;
        }
        const o2 = (y * size + x) * 4;
        if (tot > 0) { colors[o2] = r / tot; colors[o2 + 1] = g / tot; colors[o2 + 2] = b / tot; }
        colors[o2 + 3] = 255;
        height[y * size + x] = tot > 0 ? hv / tot : 0;
      }
    }
    out.push({ width: size, height: size, colors, heights: height });
  }
  return out;
}
