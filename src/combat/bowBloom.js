// @ts-check
// BOW-BLOOM (2026-10-30: "could we do a accruacy circle", "so if u shoot to fast it way less accuyrat", "like bloom",
// "in a gun"): a player's bow shot flies anywhere inside a circle that each quick shot widens and a rest shrinks. The
// first shot after a rest flies true; a slow archer never blooms. The crosshair draws it (ui/bowBloomRing.js). Pure but
// for its own clock. A departure: DFU's arrows fly true.

/** Degrees a shot adds, the widest the circle grows, degrees a second it shrinks back. */
export const BOW_BLOOM = Object.freeze({ step: 2, most: 8, settle: 3 });

let _deg = 0, _at = 0;
const bloomClock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** The circle's radius now, degrees. */
export const bowBloomNow = (now = bloomClock()) => Math.max(0, _deg - BOW_BLOOM.settle * Math.max(0, now - _at));

/** A shot loosed along `dir` (a unit vector): where it flies inside the circle as it stands, and the circle widened. */
export function bowBloomShot(dir, now = bloomClock(), rand = Math.random) {
  const r = bowBloomNow(now);
  _deg = Math.min(BOW_BLOOM.most, r + BOW_BLOOM.step);
  _at = now;
  if (!(r > 0)) return [dir[0], dir[1], dir[2]];
  const off = (r * Math.sqrt(rand()) * Math.PI) / 180, turn = rand() * 2 * Math.PI;   // a point spread evenly over the disc
  const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = bloomNorm(bloomCross(dir, up)), v = bloomCross(dir, u);
  const s = Math.sin(off), c = Math.cos(off), a = Math.cos(turn) * s, b = Math.sin(turn) * s;
  return bloomNorm([dir[0] * c + u[0] * a + v[0] * b, dir[1] * c + u[1] * a + v[1] * b, dir[2] * c + u[2] * a + v[2] * b]);
}

/** Tests: the circle closed. */
export function _resetBowBloomForTests() { _deg = 0; _at = 0; }

/** @param {number[]} a @param {number[]} b */
const bloomCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {number[]} a */
const bloomNorm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
