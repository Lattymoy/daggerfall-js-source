// @ts-check
// TESA10 (bible/03-World/Arena-Provinces.md TESA10) - THE CAPITALS' LANDMARKS on their doors: every capital's models
// (TESA11: the Imperial City's, world/capitalImperial.js; Solitude's and the rest, their own modules) and their pictures,
// made at boot from noise under a pseudo-archive of the port's own (world/lefayArt.js's law). No game data: nothing of them
// comes from ARENA2 or from any other game. Shapes of the port's own in the spirit of each city's look - never another
// game's mesh.
//
// installCapitals (scenes/modWorldData.js, beside installArena - behind no switch, as the arena's block is): the port
// blocks on the world-data door, the models on the model door (climate-free: the white stone is white in every climate),
// the pictures on the texture door.
import { registerCustomModel, customModelFor } from './customModels.js';
import { MeshBuilder } from './detStandIns.js';
import { registerPortBlock, registerPortBlockOf, installWorldDataReplacement } from '../formats/worldData/worldDataReplacement.js';
import { CASTLE_BLOCKS, castleBlockOf } from './capitalCastles.js';   // WW7-4
import { addVendorTextures } from '../systems/textureReplacement.js';
import { CAPITAL_MODELS, capitalPortBlocks, BLOCK_M } from './tamrielCapitals.js';
import { IMPERIAL_PARTS, imperialSliceRect } from './imperialCity.js';   // TS5: the Imperial City's landmarks carried in parts
import { CAPITAL_ARCHIVE, CAPITAL_ART } from './capitalShapes.js';
import { buildImperialTower, buildPalaceWall, buildEmperorsTombs, buildCityWall, buildDistrictWalls, buildColosseum, buildTempleOfTheOne, buildTalosStatue, buildImperialPrison, buildArcaneUniversity, buildWaterfront, buildTalosBridge, buildNineDivines } from './capitalImperial.js';   // TESA11
import { buildSolitudeArch, buildBluePalace, buildSolitudeWall, buildCastleDour, buildSolitudeDocks } from './capitalSolitude.js';
import { buildMournholdPlaza, buildHighFane, buildMournholdPalace, buildGreatBazaar, buildMournholdWall } from './capitalMournhold.js';
import { buildAlinorPalace, buildAlinorHarbour, buildAlinorWall, buildAlinorBridges } from './capitalAlinor.js';
import { buildGrahtOak } from './capitalFalinesti.js';
import { buildManePalace, buildTwoMoonsTemple, buildTorvalQuay, buildTorvalWall, buildManeEstate } from './capitalTorval.js';
import { buildXanmeer, buildHist, buildHelstromWalks, buildPalisade } from './capitalHelstrom.js';

export { CAPITAL_ARCHIVE, CAPITAL_ART };

// ---------------------------------------------------------------- the pictures

/** A picture's side, texels: Daggerfall's own texel size, the landmarks in the pixel world. */
export const CAPITAL_ART_SIZE = 64;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise(seed, n, S = CAPITAL_ART_SIZE) {
  const r = rng(seed), lat = Float32Array.from({ length: n * n }, () => r());
  const at = (i, j) => lat[((j % n + n) % n) * n + ((i % n + n) % n)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / S) * n, fy = (y / S) * n, i = Math.floor(fx), j = Math.floor(fy), tx = sm(fx - i), ty = sm(fy - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
const mix = (a, b, t) => { const k = Math.min(1, Math.max(0, t)); return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)); };
/** A picture by a texel's colour law - `{width, height, data}` (the texture door's shape, world/ships/galleonArt.js's). */
function picture(fn, S = CAPITAL_ART_SIZE) {
  const img = { width: S, height: S, data: new Uint8Array(S * S * 4) };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = fn(x, y); const i = (y * S + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
  return img;
}
// TESA-LORE (the owner: "ensure all new textures your adding fall in line with the detail of vanilla textures. Same
// resolution and all") - DAGGERFALL'S OWN LOOK, BY ITS OWN NUMBERS. Measured on the freeware's 475 wall and ground
// textures 64 texels wide (TEXTURE.002 to .099): a few dozen colours a picture (median 42, the middle half 27 to 60) and
// every texel apart from its neighbour (the mean |dL| to the next texel: median 10.9, the middle half 7.8 to 14.6) -
// painted pixel art off a palette's ramp, never a smooth gradient. So every picture here is a tone law (0 its ramp's
// dark end, 1 its light) quantized to its material's ramp of 28 shades through a 4 x 4 ordered dither, each texel
// with a grain of its own; masonry is laid stone by stone, each stone lit on its top and left edges and shadowed on its
// bottom and right as Daggerfall's are.

/** The 4 x 4 ordered dither's thresholds. */
const BAYER = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
/** A texel's own grain in [0, 1) - a hash of the picture's seed and the texel, the same on every client. */
function grain01(seed, x, y) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(x + 1, 0xc2b2ae35) ^ Math.imul(y + 1, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** A material's ramp: `n` shades through its stops (each an [r, g, b]), dark to light - a palette's row. */
function ramp(stops, n = 28) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(t));
    return mix(stops[k], stops[k + 1], t - k);
  });
}
/** A painted picture: `tone(x, y)` a value in [0, 1] (or [value, the ramp's index] where it paints from several ramps),
 *  plus the texel's grain, dithered onto its ramp's shades. */
function painted(ramps, tone, { seed = 1, grain = 0.06 } = {}) {
  const R = Array.isArray(ramps[0][0]) ? ramps : [ramps];
  return picture((x, y) => {
    const v = tone(x, y), [t, k] = Array.isArray(v) ? v : [v, 0], shades = R[k];
    const d = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5, g = (grain01(seed, x, y) - 0.5) * 2 * grain;
    return shades[Math.min(shades.length - 1, Math.max(0, Math.floor((t + g) * (shades.length - 1) + 0.5 + d)))];
  });
}
/** Lengths of random size in [lo, hi] that sum to `total` exactly (a course's stones, a wall's courses) - the last
 *  folded into the one before where it would fall short. */
function lengths(r, lo, hi, total = CAPITAL_ART_SIZE) {
  const out = [];
  let sum = 0;
  while (sum < total) { const n = lo + Math.floor(r() * (hi - lo + 1)); out.push(n); sum += n; }
  out[out.length - 1] -= sum - total;
  if (out.length > 1 && out[out.length - 1] < lo) out[out.length - 2] += out.pop();
  return out;
}
/**
 * MASONRY, laid stone by stone and tiling both ways: courses `rows` [lo, hi] texels high, stones `stones` [lo, hi] wide,
 * each course shifted its own way; a joint of `joint` texels; each stone its own shade, mottled, lit on its top and left
 * edges and shadowed on its bottom and right, a chip here and there. Answers the tone law (and `at(x, y)`: the stone a
 * texel is, or null in a joint).
 */
function masonry(seed, { rows = [10, 16], stones = [16, 28], joint = 1, mottle = 0.18, chips = 0.025 } = {}) {
  const r = rng(seed), mot = noise(seed + 7, 8), courses = [];
  let y0 = 0;
  for (const h of lengths(r, rows[0], rows[1])) {
    let x0 = 0;
    const list = lengths(r, stones[0], stones[1]).map((w) => { const st = { x0, w, base: 0.38 + r() * 0.34 }; x0 += w; return st; });
    courses.push({ y0, h, shift: Math.floor(r() * CAPITAL_ART_SIZE), list });
    y0 += h;
  }
  const at = (x, y) => {
    const c = courses.find((q) => y >= q.y0 && y < q.y0 + q.h), xs = (x + c.shift) % CAPITAL_ART_SIZE, st = c.list.find((q) => xs >= q.x0 && xs < q.x0 + q.w);
    return { dy: y - c.y0, h: c.h, dx: xs - st.x0, w: st.w, base: st.base };
  };
  const tone = (x, y) => {
    const { dy, h, dx, w, base } = at(x, y);
    if (dy < joint || dx < joint) return 0.06 + mot(x, y) * 0.08;
    let t = base + (mot(x, y) - 0.5) * 2 * mottle;
    if (dy === joint) t += 0.24;
    if (dx === joint) t += 0.12;
    if (dy === h - 1) t -= 0.2;
    if (dx === w - 1) t -= 0.14;
    if (grain01(seed + 3, x, y) < chips) t -= 0.28;
    return t;
  };
  return { tone, at };
}
/** SHINGLES (slate): rows `h` texels high (a divisor of the picture's side, so they tile), tiles `w` [lo, hi] wide staggered row to row - each its shade, its top lit,
 *  its lower edge in its own shadow, the gaps dark. */
function shingles(seed, { h = 8, w = [9, 14] } = {}) {
  const r = rng(seed), rows = Array.from({ length: CAPITAL_ART_SIZE / h }, () => ({ shift: Math.floor(r() * CAPITAL_ART_SIZE), tiles: (() => { let x0 = 0; return lengths(r, w[0], w[1]).map((tw) => { const t = { x0, w: tw, base: 0.4 + r() * 0.3 }; x0 += tw; return t; }); })() }));
  const mot = noise(seed + 5, 8);
  return (x, y) => {
    const row = rows[Math.floor(y / h)], dy = y % h, xs = (x + row.shift) % CAPITAL_ART_SIZE, t = row.tiles.find((q) => xs >= q.x0 && xs < q.x0 + q.w), dx = xs - t.x0;
    if (dy === 0 || dx === 0) return 0.05;
    let v = t.base + (mot(x, y) - 0.5) * 0.2;
    if (dy === 1) v += 0.2;
    if (dy >= h - 2) v -= 0.16;
    if (dx === t.w - 1) v -= 0.1;
    return v;
  };
}
/** The cyclic distance between two texels' columns or rows, and its signed twin (the nearer way round). */
const wrap = (d) => { const a = Math.abs(d) % CAPITAL_ART_SIZE; return Math.min(a, CAPITAL_ART_SIZE - a); };
const toward = (d) => ((((d + CAPITAL_ART_SIZE / 2) % CAPITAL_ART_SIZE) + CAPITAL_ART_SIZE) % CAPITAL_ART_SIZE) - CAPITAL_ART_SIZE / 2;
/** Cells about `n` seeded points, tiling: each texel's nearest point, its distance and the second nearest's. */
function cells(seed, n) {
  const r = rng(seed), pts = Array.from({ length: n }, () => [r() * CAPITAL_ART_SIZE, r() * CAPITAL_ART_SIZE, r()]);
  return (x, y) => {
    let a = Infinity, b = Infinity, k = 0;
    pts.forEach(([px, py], i) => { const d = Math.hypot(wrap(x + 0.5 - px), wrap(y + 0.5 - py)); if (d < a) { b = a; a = d; k = i; } else if (d < b) b = d; });
    return { d: a, edge: b - a, k, p: pts[k] };
  };
}

/** The pictures, by record. Deterministic (fixed seeds): every client's city is the same stone. Every law tiles: its noise
 *  sampled at whole multiples of the texel, its courses, rows and stripes dividing the picture's side. */
export function capitalArt() {
  const out = new Map();
  const stone = (record, seed, stops, o) => { const m = masonry(seed, o); out.set(record, painted(ramp(stops), m.tone, { seed })); return m; };
  // marble: pale and veined, never a joint (the Tower's, the statues')
  const veins = noise(0x5a11, 6), cloud = noise(0x5a12, 3);
  out.set(CAPITAL_ART.marble, painted(ramp([[164, 160, 152], [204, 200, 190], [232, 228, 218], [248, 246, 238]]), (x, y) => { const v = Math.abs(veins(x, y) - 0.5); return 0.62 + (cloud(x, y) - 0.5) * 0.4 - (v < 0.02 ? 0.42 : v < 0.05 ? 0.18 : 0); }, { seed: 0x5a13, grain: 0.07 }));
  const burnish = noise(0x6a1d, 4);
  out.set(CAPITAL_ART.gold, painted(ramp([[96, 62, 18], [160, 112, 36], [222, 178, 72], [252, 230, 146]]), (x, y) => 0.5 + (burnish(x, y) - 0.5) * 0.7 + Math.sin((y * Math.PI * 12) / CAPITAL_ART_SIZE) * 0.12, { seed: 0x6a1e, grain: 0.1 }));
  stone(CAPITAL_ART.wallStone, 0x3a11, [[70, 64, 54], [118, 110, 96], [176, 168, 150], [212, 204, 188]], { rows: [11, 16], stones: [18, 30], mottle: 0.14 });
  out.set(CAPITAL_ART.roof, painted(ramp([[26, 30, 36], [58, 66, 78], [92, 102, 114], [134, 144, 154]]), shingles(0x7001), { seed: 0x7002 }));
  stone(CAPITAL_ART.bridgeStone, 0x3b22, [[48, 44, 38], [104, 98, 88], [150, 142, 128], [192, 184, 168]], { rows: [14, 21], stones: [24, 38] });
  const murk = noise(0x5d01, 8);
  out.set(CAPITAL_ART.dark, painted(ramp([[10, 9, 8], [22, 20, 18], [36, 33, 30]], 4), (x, y) => 0.35 + murk(x, y) * 0.3, { seed: 0x5d02, grain: 0.25 }));
  const lumps = noise(0x7a01, 5), fine = noise(0x7a02, 16), seam = noise(0x7a03, 4);
  out.set(CAPITAL_ART.rock, painted(ramp([[44, 40, 36], [98, 92, 82], [146, 138, 124], [190, 182, 166]]), (x, y) => (Math.abs(seam(x, y) - 0.5) < 0.022 ? 0.04 : 0.45 + (lumps(x, y) - lumps((x + 2) % 64, (y + 2) % 64)) * 2.2 + (fine(x, y) - 0.5) * 0.3), { seed: 0x7a04, grain: 0.08 }));
  out.set(CAPITAL_ART.blueSlate, painted(ramp([[18, 28, 50], [42, 68, 112], [74, 106, 152], [120, 152, 192]]), shingles(0x7b01, { w: [8, 12] }), { seed: 0x7b02 }));
  const grainT = noise(0x7c01, 4), r7 = rng(0x7c02), planks = (() => { let y0 = 0; return lengths(r7, 7, 10).map((h) => { const p = { y0, h, ends: [Math.floor(r7() * 64), Math.floor(r7() * 64)], base: 0.38 + r7() * 0.26 }; y0 += h; return p; }); })();
  const knots = Array.from({ length: 4 }, () => [r7() * 64, r7() * 64]);
  out.set(CAPITAL_ART.timber, painted(ramp([[38, 24, 14], [84, 56, 34], [128, 92, 58], [170, 128, 84]]), (x, y) => {
    const p = planks.find((q) => y >= q.y0 && y < q.y0 + q.h), dy = y - p.y0;
    if (dy === 0 || p.ends.includes(x)) return 0.04;
    const knot = knots.some(([kx, ky]) => Math.hypot(wrap(x - kx) * 0.6, wrap(y - ky) * 1.4) < 1.8);
    return p.base + (grainT(x, y * 4) - 0.5) * 0.5 + (dy === 1 ? 0.16 : 0) - (dy === p.h - 1 ? 0.14 : 0) - (knot ? 0.3 : 0);
  }, { seed: 0x7c03 }));
  stone(CAPITAL_ART.nordStone, 0x3c33, [[36, 36, 34], [78, 78, 74], [118, 118, 114], [156, 156, 150]], { rows: [9, 14], stones: [14, 26], mottle: 0.2, chips: 0.04 });
  stone(CAPITAL_ART.ochre, 0x3d44, [[90, 62, 34], [156, 114, 66], [200, 154, 96], [234, 196, 138]], { rows: [11, 15], stones: [20, 30] });
  const patina = noise(0x7d01, 6), pit = noise(0x7d02, 16);
  out.set(CAPITAL_ART.bronze, painted([ramp([[46, 30, 16], [102, 66, 34], [146, 98, 52]], 18), ramp([[40, 72, 58], [84, 132, 108], [136, 182, 156]], 14)], (x, y) => [0.5 + (pit(x, y) - 0.5) * 0.7, patina(x * 2, y) > 0.64 ? 1 : 0], { seed: 0x7d03, grain: 0.1 }));
  const fold = noise(0x7d11, 4);
  out.set(CAPITAL_ART.cloth, painted([ramp([[104, 28, 20], [168, 50, 38], [212, 84, 64]], 18), ramp([[146, 112, 44], [196, 160, 80], [228, 200, 124]], 18)], (x, y) => [0.5 + ((x + y) & 1 ? 0.03 : -0.03) + (fold(x, y) - 0.5) * 0.5, Math.floor(x / 16) % 2], { seed: 0x7d12, grain: 0.06 }));
  const facets = cells(0x7e01, 9);
  out.set(CAPITAL_ART.crystal, painted(ramp([[70, 130, 156], [130, 196, 214], [196, 236, 246], [244, 252, 255]]), (x, y) => { const c = facets(x, y); return c.edge < 1.4 ? 0.98 : 0.3 + c.p[2] * 0.5 + (c.d / 24) * 0.15; }, { seed: 0x7e02, grain: 0.05 }));
  const furrow = noise(0x7f01, 4);
  out.set(CAPITAL_ART.bark, painted(ramp([[22, 15, 9], [56, 40, 26], [94, 70, 46], [134, 104, 72]]), (x, y) => { const f = furrow(x * 3, y); return f < 0.3 ? 0.1 : 0.2 + f * 0.6 + (f > 0.72 ? 0.1 : 0); }, { seed: 0x7f04, grain: 0.07 }));
  const leafy = cells(0x7f02, 30);
  out.set(CAPITAL_ART.leaves, painted(ramp([[16, 38, 14], [38, 76, 24], [76, 120, 40], [126, 164, 66], [176, 200, 104]]), (x, y) => { const c = leafy(x, y); return c.d > 5.2 ? 0.06 : 0.42 + c.p[2] * 0.22 + ((toward(c.p[0] - x - 0.5) + toward(c.p[1] - y - 0.5)) / 10) * 0.2; }, { seed: 0x7f03, grain: 0.06 }));
  stone(CAPITAL_ART.sandstone, 0x3e55, [[118, 88, 54], [180, 146, 100], [214, 180, 128], [240, 214, 166]], { rows: [9, 13], stones: [16, 26], mottle: 0.14 });
  const glaze = noise(0x8001, 6), r8 = rng(0x8002), tileShift = Array.from({ length: 8 }, () => Math.floor(r8() * 8));
  out.set(CAPITAL_ART.terracotta, painted(ramp([[78, 30, 14], [150, 66, 32], [200, 104, 56], [234, 150, 96]]), (x, y) => {
    const row = Math.floor(y / 8), dy = y % 8, dx = (x + tileShift[row]) % 8;
    return 0.28 + 0.5 * Math.sin((Math.PI * (dx + 0.5)) / 8) - (dy < 2 ? 0.26 : 0) + (glaze(x, y) - 0.5) * 0.2;
  }, { seed: 0x8003 }));
  const moss = noise(0x8101, 8), mossStone = masonry(0x3f66, { rows: [12, 16], stones: [20, 30], mottle: 0.2 });
  out.set(CAPITAL_ART.mossStone, painted([ramp([[30, 36, 28], [70, 80, 64], [102, 114, 92], [140, 150, 124]]), ramp([[18, 44, 14], [40, 86, 26], [78, 128, 44]], 16)], (x, y) => (moss(x, y) > 0.58 && mossStone.at(x, y).dy >= 1 ? [0.35 + moss(x, y) * 0.6, 1] : [mossStone.tone(x, y), 0]), { seed: 0x3f67 }));
  // TESA-LORE: tanned hide in panels, their seams stitched, wrinkled
  const tan = noise(0x8201, 10), crease = noise(0x8202, 6);
  out.set(CAPITAL_ART.hide, painted(ramp([[70, 48, 28], [130, 96, 60], [176, 138, 92], [210, 176, 128]]), (x, y) => ((x % 16 === 0 && y % 3 !== 0) || (y % 32 === 0 && x % 3 !== 0) ? 0.06 : 0.45 + (tan(x, y) - 0.5) * 0.5 - (Math.abs(crease(x, y) - 0.5) < 0.03 ? 0.18 : 0)), { seed: 0x8203 }));
  // TESA-LORE: sugarcane - close-set stalks, each lit on its left, its nodes ringed
  const stalk = noise(0x8301, 16);
  out.set(CAPITAL_ART.cane, painted(ramp([[24, 48, 18], [70, 110, 42], [128, 168, 78], [192, 206, 128]]), (x, y) => {
    const s = x % 8, k = Math.floor(x / 8), node = (y + k * 7) % 16;
    if (s === 0) return 0.22;
    return 0.62 - Math.abs(s - 3) * 0.05 + (node === 0 ? 0.18 : node === 1 ? -0.16 : 0) + (stalk(x, y) - 0.5) * 0.16;
  }, { seed: 0x8302, grain: 0.05 }));
  return out;
}

/** TESA-LORE: a picture's span on a capital's faces, metres - Daggerfall's own texel density (`vanillaTexels`). */
export const CAPITAL_TEXEL_METRES = 1.6;
/**
 * TESA-LORE: VANILLA'S TEXEL DENSITY. Measured on the freeware's ARCH3D models (34,982 faces, through MeshReader's own
 * law): a wall under a 64 x 128 texture carries 40.9 texels a metre (its 64 texels across 1.6 m), a 64 x 64 wall 22.8, a
 * floor 39 - the middle half of every face 22.5 to 41. The capitals' shapes laid their pictures at repeats of their own:
 * most at 10.7 texels a metre, the White-Gold Tower at 5, the Graht-Oak's leaves at 3.6 - a quarter of the detail of the
 * houses beside them. So every capital model's faces are mapped again as it is installed, each triangle on the axis
 * plane its own face turns to most (a box projection in the world's metres - the MeshBuilder gives every triangle corners
 * of its own), a 64-texel picture every CAPITAL_TEXEL_METRES: 40 texels a metre, and no less than 30.4 on a face tilted
 * from its plane (the shapes' own coordinates stay the stand-in view's). TS5: each coordinate taken from a whole number of
 * pictures nearest the model's middle (`o`, the picture repeats - the same look), so a landmark kilometres from the city's
 * middle keeps its texels in a 32-bit UV (the University 2.4 km out had drifted to 40.5 a metre).
 * @param {{ positions: ArrayLike<number>, indices: ArrayLike<number> }} m @param {number} [metres]
 */
export function vanillaTexels(m, metres = CAPITAL_TEXEL_METRES) {
  const p = m.positions, ix = m.indices, uvs = new Float32Array((p.length / 3) * 2);
  const o = [0, 1, 2].map((k) => { let lo = Infinity, hi = -Infinity; for (let i = k; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); } return p.length ? Math.floor((lo + hi) / 2 / metres) : 0; });
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const ax = Math.abs(uy * vz - uz * vy), ay = Math.abs(uz * vx - ux * vz), az = Math.abs(ux * vy - uy * vx);
    for (const i of [a, b, c]) {
      const [u, w] = ay >= ax && ay >= az ? [p[i] / metres - o[0], p[i + 2] / metres - o[2]] : ax >= az ? [p[i + 2] / metres - o[2], -p[i + 1] / metres + o[1]] : [p[i] / metres - o[0], -p[i + 1] / metres + o[1]];
      uvs[(i / 3) * 2] = u;
      uvs[(i / 3) * 2 + 1] = w;
    }
  }
  return { ...m, uvs };
}

/**
 * A model drawn as a map reads (+z south) turned into the world's frame (+z north - DFU's, Unity's, the block rows'):
 * every z and every normal's z negated, every triangle's winding turned back to face along its normal.
 */
export function northward(m) {
  const positions = m.positions.slice(), normals = m.normals.slice(), indices = m.indices.slice();
  for (let i = 2; i < positions.length; i += 3) { positions[i] = -positions[i]; normals[i] = -normals[i]; }
  for (let t = 0; t < indices.length; t += 3) { const b = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = b; }
  const flip = (v) => ({ ...v, z: -v.z });   // WW7-4: a castle's door (capitalShapes.js entranceDoor) turned with its face
  return { ...m, positions, normals, indices, doors: (m.doors ?? []).map((d) => ({ ...d, vert0: flip(d.vert0), vert1: flip(d.vert1), vert2: flip(d.vert2), normal: flip(d.normal) })) };
}

/**
 * TS5: A LANDMARK'S PART - the triangles of its whole model (`m`, the world's frame: +z north) whose middles stand in a
 * rectangle of the anchor's metres (x east, z south: [x0, z0, x1, z1] - a slice's square, world/imperialCity.js
 * imperialSliceRect), a submesh a picture as the whole's, and its doors whose middles stand there. Every triangle of the
 * whole is in one part (its middle in one square).
 * @param {any} m @param {[number, number, number, number]} rect
 */
export function modelPart(m, [x0, z0, x1, z1]) {
  const p = m.positions, inRect = (x, zNorth) => x >= x0 && x < x1 && -zNorth >= z0 && -zNorth < z1;
  const remap = new Map(), positions = [], normals = [], uvs = [], indices = [], subMeshes = [];
  const vert = (v) => {
    if (remap.has(v)) return remap.get(v);
    const n = positions.length / 3;
    positions.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); normals.push(m.normals[v * 3], m.normals[v * 3 + 1], m.normals[v * 3 + 2]); uvs.push(m.uvs[v * 2], m.uvs[v * 2 + 1]);
    remap.set(v, n);
    return n;
  };
  for (const sm of m.subMeshes) {
    const startIndex = indices.length;
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      if (!inRect((p[a * 3] + p[b * 3] + p[c * 3]) / 3, (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3)) continue;
      indices.push(vert(a), vert(b), vert(c));
    }
    if (indices.length > startIndex) subMeshes.push({ ...sm, startIndex, primitiveCount: (indices.length - startIndex) / 3 });
  }
  const doors = (m.doors ?? []).filter((d) => inRect((d.vert0.x + d.vert1.x + d.vert2.x) / 3, (d.vert0.z + d.vert1.z + d.vert2.z) / 3));
  return { ...m, positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices), subMeshes, doors };
}

// ---------------------------------------------------------------- where the models stand

/** AUDIT-TESA A6-2: the heights over the ground a body stands across - a face of a model crossing one is in its way. */
const BODY_PLANES = Object.freeze([0.5, 1.0, 1.6]);
/** An automap cell's side (world/tamrielCapitals.js autoCentre: 64 to a block). */
const CELL = BLOCK_M / 64;
/**
 * WHERE A CAPITAL'S MODELS STAND (AUDIT-TESA A6-2): the automap cells of the anchor's metres (x east, z south - cells of
 * 1.6 m from the anchor, a grid point, so the blocks' own) a face of its models crosses at a body's height: each
 * triangle steeper than a walkable slope, cut at BODY_PLANES, the cut walked in quarter cells; two cells meeting at a
 * corner alone joined by one between, so no walker slips through a wall's diagonal. `meshOf(id)` a model in the world's
 * frame (+z north: the model door's - customModelFor's, built once and the renderer's too).
 * @param {any} cap a CAPITALS entry @param {(id: number) => any} [meshOf]
 * @returns {(x: number, z: number) => boolean}
 */
export function capitalFootprint(cap, meshOf = (id) => customModelFor(id)) {
  const cells = new Set(), key = (i, j) => (i + 4096) * 8192 + (j + 4096);
  const mark = (x, z) => cells.add(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  for (const id of cap.models) {
    const m = meshOf(id);
    if (!m) continue;
    const p = m.positions, ix = m.indices;
    for (let t = 0; t < ix.length; t += 3) {
      const v = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
      const [a, b, c] = v;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], wx = p[c] - p[a], wy = p[c + 1] - p[a + 1], wz = p[c + 2] - p[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, n = Math.hypot(nx, ny, nz);
      if (!(n > 0) || Math.abs(ny) > 0.7 * n) continue;   // a walkable slope, or nothing
      for (const h of BODY_PLANES) {
        const cut = [];
        for (let e = 0; e < 3; e++) {
          const q = v[e], r = v[(e + 1) % 3], yq = p[q + 1] - h, yr = p[r + 1] - h;
          if ((yq >= 0) === (yr >= 0)) continue;
          const f = yq / (yq - yr);
          cut.push([p[q] + (p[r] - p[q]) * f, -(p[q + 2] + (p[r + 2] - p[q + 2]) * f)]);   // the anchor's z runs south
        }
        if (cut.length !== 2) continue;
        const [[x0, z0], [x1, z1]] = cut, steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL / 4)));
        for (let k = 0; k <= steps; k++) mark(x0 + ((x1 - x0) * k) / steps, z0 + ((z1 - z0) * k) / steps);
      }
    }
  }
  for (const c of [...cells]) {
    const i = Math.floor(c / 8192) - 4096, j = (c % 8192) - 4096;
    for (const dj of [1, -1]) if (cells.has(key(i + 1, j + dj)) && !cells.has(key(i + 1, j)) && !cells.has(key(i, j + dj))) cells.add(key(i + 1, j));
  }
  return (x, z) => cells.has(key(Math.floor(x / CELL), Math.floor(z / CELL)));
}

let _installed = false;
/**
 * ONCE: the capitals' port blocks, models and pictures on their doors (scenes/modWorldData.js, beside installArena).
 * @param {{ addTextures?: (entries: any[]) => number }} [o]
 */
export function installCapitals({ addTextures = addVendorTextures } = {}) {
  if (_installed) return false;
  _installed = true;
  installWorldDataReplacement();
  // AUDIT-TESA A6-2: each block built when first read, its capital's footprint with it - the models it stands under
  for (const b of capitalPortBlocks({ footprint: (cap) => capitalFootprint(cap) })) registerPortBlock(b.name, () => b.json, b.index);
  // WW7-4: every capital's castle's halls, a Bay palace block's copy each, its court stood down (world/capitalCastles.js)
  for (const c of CASTLE_BLOCKS) registerPortBlockOf(c.name, (blocksFile) => castleBlockOf(blocksFile?.getBlockByName(c.from), c), c.index);
  const builds = {
    [CAPITAL_MODELS.whiteGoldTower]: () => buildImperialTower(),   // TESA11: the Imperial City's twelve
    [CAPITAL_MODELS.palaceWall]: () => buildPalaceWall(),
    [CAPITAL_MODELS.tombs]: () => buildEmperorsTombs(),
    [CAPITAL_MODELS.cityWall]: () => buildCityWall(),
    [CAPITAL_MODELS.districtWalls]: () => buildDistrictWalls(),
    [CAPITAL_MODELS.colosseum]: () => buildColosseum(),
    [CAPITAL_MODELS.templeOfTheOne]: () => buildTempleOfTheOne(),
    [CAPITAL_MODELS.talosStatue]: () => buildTalosStatue(),
    [CAPITAL_MODELS.prison]: () => buildImperialPrison(),
    [CAPITAL_MODELS.university]: () => buildArcaneUniversity(),
    [CAPITAL_MODELS.waterfront]: () => buildWaterfront(),
    [CAPITAL_MODELS.talosBridge]: () => buildTalosBridge(),
    [CAPITAL_MODELS.nineDivines]: () => buildNineDivines(),   // TESA-LORE
    [CAPITAL_MODELS.solitudeArch]: () => buildSolitudeArch(),
    [CAPITAL_MODELS.bluePalace]: () => buildBluePalace(),
    [CAPITAL_MODELS.solitudeWall]: () => buildSolitudeWall(),
    [CAPITAL_MODELS.castleDour]: () => buildCastleDour(),
    [CAPITAL_MODELS.solitudeDocks]: () => buildSolitudeDocks(),
    [CAPITAL_MODELS.mournholdPlaza]: () => buildMournholdPlaza(),
    [CAPITAL_MODELS.highFane]: () => buildHighFane(),
    [CAPITAL_MODELS.mournholdPalace]: () => buildMournholdPalace(),
    [CAPITAL_MODELS.greatBazaar]: () => buildGreatBazaar(),
    [CAPITAL_MODELS.mournholdWall]: () => buildMournholdWall(),
    [CAPITAL_MODELS.alinorPalace]: () => buildAlinorPalace(),
    [CAPITAL_MODELS.alinorHarbour]: () => buildAlinorHarbour(),
    [CAPITAL_MODELS.alinorWall]: () => buildAlinorWall(),
    [CAPITAL_MODELS.alinorBridges]: () => buildAlinorBridges(),   // TESA-LORE
    [CAPITAL_MODELS.grahtOak]: () => buildGrahtOak(),
    [CAPITAL_MODELS.manePalace]: () => buildManePalace(),
    [CAPITAL_MODELS.twoMoonsTemple]: () => buildTwoMoonsTemple(),
    [CAPITAL_MODELS.torvalQuay]: () => buildTorvalQuay(),
    [CAPITAL_MODELS.torvalWall]: () => buildTorvalWall(),
    [CAPITAL_MODELS.maneEstate]: () => buildManeEstate(),   // TESA-LORE
    [CAPITAL_MODELS.xanmeer]: () => buildXanmeer(),
    [CAPITAL_MODELS.hist]: () => buildHist(),
    [CAPITAL_MODELS.helstromWalks]: () => buildHelstromWalks(),
    [CAPITAL_MODELS.palisade]: () => buildPalisade(),
  };
  for (const [id, build] of Object.entries(builds)) registerCustomModel(Number(id), () => vanillaTexels(northward(build())), () => true, { climateFree: true });   // TESA-LORE: at vanilla's texel density
  // TS5: the Imperial City's landmarks carried in parts, each its slice's share of the whole (drawn once)
  for (const part of IMPERIAL_PARTS) registerCustomModel(part.id, () => modelPart(customModelFor(part.base), imperialSliceRect(part.s)), () => true, { climateFree: true });
  let made = null;
  const pictureOf = (record) => (made ??= capitalArt()).get(record) ?? null;
  addTextures(Object.values(CAPITAL_ART).map((record) => ({ archive: CAPITAL_ARCHIVE, record, frame: 0, standIn: true, fileName: `capital-${CAPITAL_ARCHIVE}_${record}`, build: async () => pictureOf(record) })));
  return true;
}
/** Test seam. */
export function _resetCapitals() { _installed = false; }
