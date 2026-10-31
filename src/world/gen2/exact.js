// @ts-check
// WG2 (bible/03-World/World-2.md, WG-2): THE EXACT KIT. Every gameplay field World 2.0 makes is built from IEEE-754's
// correctly rounded operations alone (+ - * /, Math.sqrt, floor, round, abs, min, max, imul, bit operations), so two
// clients on one revision agree to the bit. Math.sin, exp, pow, the `**` operator and their kin are approximations
// each engine may round its own way; test/world/gen2/wg2_exact.test.js sweeps world/gen2/ for them.
import { hash32 } from '../blockHash.js';

/** The calls a gameplay field may not make (the sweep's list; Math.random and the clocks are not deterministic). */
export const INEXACT_CALLS = Object.freeze(['Math.random', 'Math.sin', 'Math.cos', 'Math.tan', 'Math.asin', 'Math.acos', 'Math.atan',
  'Math.atan2', 'Math.exp', 'Math.expm1', 'Math.log', 'Math.log1p', 'Math.log2', 'Math.log10', 'Math.pow', 'Math.hypot', 'Math.cbrt',
  'Math.sinh', 'Math.cosh', 'Math.tanh', 'Date.now', 'new Date', 'performance.now']);

/** A uniform number in [0, 1) from a seed and whole numbers. @param {number} seed @param {...number} ns */
export const rand01 = (seed, ...ns) => hash32(seed, ...ns) / 4294967296;

/** A child seed: the stage's or the feature's own stream off the world's. @param {number} seed @param {string} salt */
export function seedOf(seed, salt) {
  let h = seed >>> 0;
  for (let i = 0; i < salt.length; i++) h = hash32(h, salt.charCodeAt(i));
  return h;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** 0 below `a`, 1 above `b`, the cubic step between. */
export function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Twelve gradient directions, the octagon's and its diagonals' (exact constants: 0.7071067811865476 is a double, and
// every engine reads the literal the same way).
const D = 0.7071067811865476;
const GX = Float64Array.of(1, -1, 0, 0, D, -D, D, -D, 1, -1, 0, 0);
const GY = Float64Array.of(0, 0, 1, -1, D, D, -D, -D, 0, 0, 1, -1);
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Seeded gradient noise in about [-1, 1], with no period (the lattice is hashed, not tabled). @param {number} seed
 *  @param {number} x @param {number} y */
export function noise2(seed, x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const dot = (i, j) => {
    const g = hash32(seed, ix + i, iy + j) % 12;
    return GX[g] * (fx - i) + GY[g] * (fy - j);
  };
  const u = fade(fx), v = fade(fy);
  const a = lerp(dot(0, 0), dot(1, 0), u), b = lerp(dot(0, 1), dot(1, 1), u);
  return lerp(a, b, v) * 1.4142135623730951;
}

/** Fractal sum of `octaves` noise layers, each twice the frequency and `gain` the weight, normalised to about [-1, 1].
 *  @param {number} seed @param {number} x @param {number} y @param {number} octaves @param {number} [gain] */
export function fbm(seed, x, y, octaves, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(seed + o * 7919, x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/** Ridged fractal noise in [0, 1]: sharp crests where the noise crosses zero, the shape of a ridge's spine.
 *  @param {number} seed @param {number} x @param {number} y @param {number} octaves */
export function ridged(seed, x, y, octaves) {
  let sum = 0, amp = 1, norm = 0, f = 1, weight = 1;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(noise2(seed + o * 104729, x * f, y * f));
    n *= n * weight;
    weight = clamp(n * 2, 0, 1);
    sum += amp * n;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** A value kept to `bits` fractional bits - a field's store is exact, and a float32 field reads the same on every
 *  machine because the quantisation is. @param {number} v @param {number} bits */
export const quantize = (v, bits) => {
  const s = 1 << bits;
  return Math.round(v * s) / s;
};

/** A deterministic stable sort's comparator for (value, index) pairs: lower value, then lower index. */
export const byValueThenIndex = (va, ia, vb, ib) => (va < vb ? -1 : va > vb ? 1 : ia - ib);
