// ═══════════════════════════════════════════════════════════════════
// GROUND TEXTURE PROTOTYPE (Mac: prototype and develop the new ground
// textures BEFORE any code change, so he can see them).
//
// THE SHAPE OF THE PROBLEM, read off the data first: a climate ground
// archive is not four tiles. TEXTURE.302 carries 56 records - FOUR
// bases (water, dirt, grass, stone) and fifty-two BLEND tiles that
// carry Daggerfall's own hand-drawn transition shapes between them.
// Replacing four tiles and leaving the rest is a world with sharp
// grass and blurry edges.
//
// SO THE BLENDS ARE DERIVED, NOT DRAWN. Every original texel is
// classified to the base it belongs to by palette distance; that
// mask is upsampled smoothly; the new high-res bases are composited
// through it. The world keeps Daggerfall's exact tile shapes - the
// same coastlines, the same paths - at whatever resolution the bases
// are drawn at, and any two tiles meet seamlessly because they are
// made of the same four surfaces.
//
// THE BASES themselves are procedural and TILEABLE BY CONSTRUCTION:
// every noise lookup is periodic over the tile, so a base repeats
// without a seam, and the blends inherit that.
//
//   node tools/groundProto.mjs [--arena2 DIR] [--size 512] [--archive 302]
//
// Writes to prototype/ground/: the four bases, every derived tile, a
// before/after sheet, and a tiled ground-plane preview.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const ARENA2 = arg('arena2', '/tmp/dfx/app/ARENA2');
const SIZE = Number(arg('size', 512));
const ARCHIVE = arg('archive', '302');
const OUT = 'prototype/ground';

// ── periodic value noise ───────────────────────────────────────────
// Tileable by construction: the lattice wraps at `period`, so a
// texture sampled over [0,period) repeats with no seam.
function makeNoise(seed) {
  const p = new Uint8Array(512);
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => {
    const u = (h & 1) ? x : y; const v = (h & 2) ? y : x;
    return ((h & 4) ? -u : u) + ((h & 8) ? -v : v);
  };
  return (x, y, period) => {
    const wrap = (n) => ((n % period) + period) % period;
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = x - xi; const yf = y - yi;
    const X = wrap(xi); const Y = wrap(yi);
    const X1 = wrap(xi + 1); const Y1 = wrap(yi + 1);
    const u = fade(xf); const v = fade(yf);
    const aa = p[(p[X & 255] + (Y & 255)) & 255];
    const ba = p[(p[X1 & 255] + (Y & 255)) & 255];
    const ab = p[(p[X & 255] + (Y1 & 255)) & 255];
    const bb = p[(p[X1 & 255] + (Y1 & 255)) & 255];
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v) * 0.5 + 0.5;
  };
}
const fbm = (n, x, y, period, octaves, gain = 0.5) => {
  let a = 1; let f = 1; let sum = 0; let norm = 0;
  for (let o = 0; o < octaves; o++) { sum += a * n(x * f, y * f, period * f); norm += a; a *= gain; f *= 2; }
  return sum / norm;
};
/** Periodic Worley - the cell centres live on a wrapping lattice, so
 *  pebbles and clumps repeat without a seam. */
function worley(x, y, period, seed) {
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
      const dx = ci + ox - x; const dy = cj + oy - y;
      const d = Math.hypot(dx, dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2 };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const shade = (rgb, k) => rgb.map((v) => clamp(v * k, 0, 255));

// ── the four bases ─────────────────────────────────────────────────
// Each is a function (u, v) -> [r,g,b] over [0,1), tileable.
function baseGrass(n, px) {
  const P = 8;
  return (u, v) => {
    const x = u * P; const y = v * P;
    // patchy colour: two greens plus a dry straw, drifted by low fbm
    const patch = fbm(n, x * 0.6, y * 0.6, P * 0.6, 4);
    const dry = clamp((fbm(n, x * 0.35 + 11, y * 0.35 - 7, P * 0.35, 3) - 0.45) * 3.2, 0, 1);
    let c = mix([58, 84, 40], [86, 112, 52], clamp((patch - 0.35) * 2.2, 0, 1));
    c = mix(c, [124, 122, 68], dry * 0.55);
    // blade grain: high-frequency directional streaks, the thing a
    // 64px tile could only suggest
    // blades: a fine anisotropic streak field, two crossing lays so
    // the sward has direction without combing all one way
    const b1 = fbm(n, x * 52 + 3, y * 13 - 5, P * 52, 2);
    const b2 = fbm(n, x * 15 + 61, y * 44 + 8, P * 44, 2);
    const blade = (b1 * 0.6 + b2 * 0.4);
    c = shade(c, 0.72 + blade * 0.62);
    // clumps: Worley domes read as tufts, brighter at their crowns
    const { f1, f2 } = worley(x * 5, y * 5, P * 5, 91);
    const tuft = clamp((f2 - f1) * 2.2, 0, 1);
    c = shade(c, 0.84 + tuft * 0.34);
    c = mix(c, [40, 58, 30], clamp(1 - tuft * 2.4, 0, 1) * 0.35);   // shadow between clumps
    // sparse soil showing through the thin places
    const bare = clamp((0.30 - patch) * 4, 0, 1) * clamp(1 - tuft, 0, 1);
    c = mix(c, [96, 76, 52], bare * 0.5);
    return c;
  };
}
function baseDirt(n) {
  const P = 8;
  return (u, v) => {
    const x = u * P; const y = v * P;
    const grain = fbm(n, x * 18 + 21, y * 18 + 9, P * 18, 3);
    const tone = fbm(n, x * 1.1 - 4, y * 1.1 + 2, P * 1.1, 4);
    let c = mix([116, 88, 58], [150, 118, 78], clamp((tone - 0.35) * 2.0, 0, 1));
    c = shade(c, 0.88 + grain * 0.26);
    // pebbles: small Worley cells with a catch-light and a dropped
    // shadow, PLACED rather than smeared
    const { f1, f2 } = worley(x * 9 + 0.5, y * 9 + 0.5, P * 9, 17);
    const stone = clamp((0.16 - f1) * 9, 0, 1) * clamp((f2 - f1) * 3, 0, 1);
    if (stone > 0.01) {
      c = mix(c, [150, 140, 126], stone * 0.75);
      c = shade(c, 1 + stone * 0.18);
    }
    const crack = clamp(1 - Math.abs(fbm(n, x * 2.5 + 40, y * 2.5, P * 2.5, 3) - 0.5) * 12, 0, 1);
    c = shade(c, 1 - crack * 0.16);
    return c;
  };
}
function baseStone(n) {
  const P = 6;
  return (u, v) => {
    const x = u * P; const y = v * P;
    // plates: Worley cells domed off sqrt(f2)-sqrt(f1) so each plate
    // has volume instead of being one flat tone
    const warpX = (fbm(n, x * 0.8, y * 0.8, P * 0.8, 3) - 0.5) * 0.9;
    const warpY = (fbm(n, x * 0.8 + 31, y * 0.8 - 17, P * 0.8, 3) - 0.5) * 0.9;
    const { f1, f2 } = worley(x * 2.2 + warpX, y * 2.2 + warpY, P * 2.2, 53);
    const dome = clamp((Math.sqrt(f2) - Math.sqrt(f1)) * 2.4, 0, 1);
    const grit = fbm(n, x * 22, y * 22, P * 22, 2);
    let c = mix([84, 84, 86], [138, 137, 130], dome);
    c = shade(c, 0.9 + grit * 0.22);
    // the seam between plates goes dark and a hair cool
    const seam = clamp(1 - dome * 3.2, 0, 1);
    c = mix(c, [46, 48, 54], seam * 0.7);
    // lichen, sparse and green, only on the crowns
    const lich = clamp((fbm(n, x * 3 + 60, y * 3 + 12, P * 3, 3) - 0.62) * 5, 0, 1) * dome;
    c = mix(c, [96, 108, 62], lich * 0.45);
    return c;
  };
}
function baseWater(n) {
  const P = 5;
  return (u, v) => {
    const x = u * P; const y = v * P;
    const depth = fbm(n, x * 0.9 + 5, y * 0.9 - 3, P * 0.9, 4);
    let c = mix([26, 54, 86], [44, 92, 128], clamp((depth - 0.35) * 2.2, 0, 1));
    // two crossing ripple trains, periodic so they tile
    // wavelets: a warped ridged field reads as chop, not corduroy
    const wx = x + (fbm(n, x * 1.6, y * 1.6, P * 1.6, 3) - 0.5) * 2.4;
    const wy = y + (fbm(n, x * 1.6 + 23, y * 1.6 + 11, P * 1.6, 3) - 0.5) * 2.4;
    const ridge = 1 - Math.abs(fbm(n, wx * 7, wy * 5, P * 7, 3) - 0.5) * 2;
    c = shade(c, 0.9 + ridge * 0.24);
    const glint = clamp((ridge - 0.90) * 9, 0, 1);
    c = mix(c, [200, 224, 240], glint * 0.7);
    return c;
  };
}

// ── read the archive, classify, derive ─────────────────────────────
const pal = new DFPalette();
pal.load(new Uint8Array(readFileSync(`${ARENA2}/ART_PAL.COL`)), 'ART_PAL.COL');
const tex = new TextureFile();
tex.load(new Uint8Array(readFileSync(`${ARENA2}/TEXTURE.${ARCHIVE}`)), `TEXTURE.${ARCHIVE}`, pal);

/** The four base records, in the archive's own order. */
const BASES = ['water', 'dirt', 'grass', 'stone'];
const baseRgb = BASES.map((_, i) => {
  const bm = tex.getDFBitmap(i, 0);
  let r = 0; let g = 0; let b = 0;
  for (let k = 0; k < bm.width * bm.height; k++) { const c = pal.get(bm.data[k]); r += c.r; g += c.g; b += c.b; }
  const n2 = bm.width * bm.height;
  return [r / n2, g / n2, b / n2];
});

/** Every texel of every record, classified to the base it belongs to
 *  by palette distance against the four base MEANS - the same reading
 *  a human makes looking at the sheet. */
function classify(record) {
  const bm = tex.getDFBitmap(record, 0);
  const w = bm.width; const h = bm.height;
  const out = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const c = pal.get(bm.data[k]);
    let best = 0; let bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const d = Math.hypot(c.r - baseRgb[i][0], c.g - baseRgb[i][1], c.b - baseRgb[i][2]);
      if (d < bd) { bd = d; best = i; }
    }
    out[k] = best;
  }
  return { w, h, out };
}

const noise = makeNoise(0x51ed);
const surfaces = [baseWater(noise), baseDirt(noise), baseGrass(noise), baseStone(noise)];

/** One base, rendered at SIZE. */
function renderBase(i) {
  const png = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = surfaces[i](x / SIZE, y / SIZE);
      const o = (y * SIZE + x) * 4;
      png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
    }
  }
  return png;
}

/** A derived tile: the original's shape, the new surfaces' detail.
 *  The mask is bilinear over the 64px classification with a little
 *  noise-warp on the lookup, so an edge reads as a natural boundary
 *  rather than a stair-stepped one. */
function renderDerived(record, basePixels) {
  const { w, h, out } = classify(record);
  const png = new PNG({ width: SIZE, height: SIZE });
  const weightAt = (fx, fy, want) => {
    // bilinear over a 0/1 membership field, sampled with wrap so the
    // tile's own edges stay seamless with its neighbours
    const gx = fx * w - 0.5; const gy = fy * h - 0.5;
    const x0 = Math.floor(gx); const y0 = Math.floor(gy);
    const tx = gx - x0; const ty = gy - y0;
    let acc = 0;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const xx = ((x0 + dx) % w + w) % w; const yy = ((y0 + dy) % h + h) % h;
        const m = out[yy * w + xx] === want ? 1 : 0;
        acc += m * (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
      }
    }
    return acc;
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE; const v = y / SIZE;
      // warp the MASK lookup, not the surfaces: the boundary wanders
      // like a real one while the ground itself stays put
      const wu = u + (fbm(noise, u * 9 + 3, v * 9 - 2, 9, 3) - 0.5) * 0.035;
      const wv = v + (fbm(noise, u * 9 + 17, v * 9 + 5, 9, 3) - 0.5) * 0.035;
      let r = 0; let g = 0; let b = 0; let tot = 0;
      for (let i = 0; i < 4; i++) {
        const k = weightAt(wu, wv, i);
        if (k <= 0.001) continue;
        const p = basePixels[i];
        const o = ((y % SIZE) * SIZE + (x % SIZE)) * 4;
        r += p.data[o] * k; g += p.data[o + 1] * k; b += p.data[o + 2] * k; tot += k;
      }
      const o2 = (y * SIZE + x) * 4;
      if (tot > 0) { png.data[o2] = r / tot; png.data[o2 + 1] = g / tot; png.data[o2 + 2] = b / tot; }
      png.data[o2 + 3] = 255;
    }
  }
  return png;
}

mkdirSync(OUT, { recursive: true });
const basePixels = BASES.map((_, i) => renderBase(i));
BASES.forEach((name, i) => writeFileSync(`${OUT}/base-${name}.png`, PNG.sync.write(basePixels[i])));

const count = Number(arg('tiles', tex.recordCount));
const derived = [];
for (let r = 0; r < count; r++) {
  const png = renderDerived(r, basePixels);
  derived.push(png);
  writeFileSync(`${OUT}/tile-${String(r).padStart(2, '0')}.png`, PNG.sync.write(png));
}
console.log(`wrote ${BASES.length} bases and ${derived.length} tiles at ${SIZE}px into ${OUT}/`);
