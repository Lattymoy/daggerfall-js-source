// @ts-check
// THE SAME ANSWER ON EVERY ENGINE. Every client lays
// out a settlement from its own ground, so two browsers must reach the same plan bit for bit. Math.sin, cos, atan2 and hypot
// may differ in their last bit between engines; +, -, *, / and Math.sqrt are rounded exactly by IEEE 754. These are built
// from those alone, in a fixed order, accurate to about 1e-15. Pure, and imports nothing. Not a DFU member.

const PI = 3.141592653589793;
const TAU = 6.283185307179586;
const HALF_PI = 1.5707963267948966;
const QUARTER_PI = 0.7853981633974483;

/** sin on [-pi/4, pi/4], Taylor to x^17. @param {number} x */
function sinCore(x) {
  const x2 = x * x;
  let t = x, s = x;
  for (let n = 1; n <= 8; n++) { t = (-t * x2) / ((2 * n) * (2 * n + 1)); s += t; }
  return s;
}
/** cos on [-pi/4, pi/4], Taylor to x^16. @param {number} x */
function cosCore(x) {
  const x2 = x * x;
  let t = 1, s = 1;
  for (let n = 1; n <= 8; n++) { t = (-t * x2) / ((2 * n - 1) * (2 * n)); s += t; }
  return s;
}
/** x reduced to [-pi/4, pi/4] and its quarter turn. @param {number} x */
function reduce(x) {
  const r = x - Math.round(x / TAU) * TAU;
  const q = Math.round(r / HALF_PI);
  return { r: r - q * HALF_PI, q: ((q % 4) + 4) % 4 };
}

/** @param {number} x */
export function dsin(x) {
  const { r, q } = reduce(x);
  return q === 0 ? sinCore(r) : q === 1 ? cosCore(r) : q === 2 ? -sinCore(r) : -cosCore(r);
}
/** @param {number} x */
export function dcos(x) {
  const { r, q } = reduce(x);
  return q === 0 ? cosCore(r) : q === 1 ? -sinCore(r) : q === 2 ? -cosCore(r) : sinCore(r);
}
/** sqrt(a^2 + b^2), Math.sqrt being exact. @param {number} a @param {number} b */
export const dhypot = (a, b) => Math.sqrt(a * a + b * b);

/** atan on [-1, 1]: halved twice (atan x = 2 atan(x / (1 + sqrt(1 + x^2)))), then Taylor to x^31. @param {number} x */
function atanCore(x) {
  let y = x, k = 1;
  for (let i = 0; i < 2; i++) { y /= 1 + Math.sqrt(1 + y * y); k *= 2; }
  const y2 = y * y;
  let t = y, s = y;
  for (let n = 1; n <= 15; n++) { t *= -y2; s += t / (2 * n + 1); }
  return k * s;
}
/** The angle of (x, y) from the x axis, in (-pi, pi], as Math.atan2(y, x). @param {number} y @param {number} x */
export function datan2(y, x) {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y);
  let a = ay <= ax ? atanCore(ay / ax) : HALF_PI - atanCore(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

export { PI, TAU, HALF_PI, QUARTER_PI };
