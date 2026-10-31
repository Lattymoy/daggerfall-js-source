// @ts-check
// RMB-CONTRACTS RMBC1 (2026-10-31, bible/03-World/RMB-Contracts.md): the plane geometry a settlement plan is checked with.
// A point is [east, north] in metres. Touching is not overlap: row houses share a wall and terraces share a rim.
// Pure; its one import is exactMath.js, so every engine measures alike. Not a DFU member.
import { dhypot } from './exactMath.js';

/** How near counts as on a line, metres: past the 1.4 cm a point and a line rounded to the centimetre can stand apart. */
export const GEOM_EPS = 0.02;

/** @typedef {readonly [number, number]} Pt */

/** Twice the signed area: positive when the ring runs anticlockwise (east to north). @param {readonly Pt[]} ring */
export function ringArea2(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a;
}

/** @param {Pt} a @param {Pt} b @param {Pt} c */
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Distance from p to the segment a-b. @param {Pt} p @param {Pt} a @param {Pt} b */
export function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0;
  return dhypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

/** Distance from p to the ring's edge. @param {Pt} p @param {readonly Pt[]} ring */
export function edgeDistance(p, ring) {
  let d = Infinity;
  for (let i = 0, n = ring.length; i < n; i++) d = Math.min(d, distanceToSegment(p, ring[i], ring[(i + 1) % n]));
  return d;
}

/** Inside by the even-odd rule; a point on the edge may answer either way. @param {Pt} p @param {readonly Pt[]} ring */
export function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Strictly inside: in the ring and more than eps from its edge. @param {Pt} p @param {readonly Pt[]} ring */
export const strictlyIn = (p, ring, eps = GEOM_EPS) => pointInRing(p, ring) && edgeDistance(p, ring) > eps;
/** Inside or on the edge. @param {Pt} p @param {readonly Pt[]} ring */
export const inOrOn = (p, ring, eps = GEOM_EPS) => pointInRing(p, ring) || edgeDistance(p, ring) <= eps;

/** Which side of the line c-d p stands, by more than eps: 1, -1, or 0 on it. @param {Pt} c @param {Pt} d @param {Pt} p */
const side = (c, d, p) => { const s = cross(c, d, p) / (dhypot(d[0] - c[0], d[1] - c[1]) || 1); return s > GEOM_EPS ? 1 : s < -GEOM_EPS ? -1 : 0; };

/** The two segments cross at a point inside both. An end within GEOM_EPS of the other's line is on it, not across it:
 *  points rounded to the centimetre leave a shared wall a hair off true. @param {Pt} a @param {Pt} b @param {Pt} c @param {Pt} d */
export function segmentsCross(a, b, c, d) {
  return side(c, d, a) * side(c, d, b) < 0 && side(a, b, c) * side(a, b, d) < 0;
}

/** A ring a plan can use: three or more finite points, an area, and no edge meeting another but its neighbours. @param {unknown} ring */
export function ringOk(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  if (!ring.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))) return false;
  if (Math.abs(ringArea2(ring)) <= GEOM_EPS) return false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    if (dhypot(b[0] - a[0], b[1] - a[1]) <= GEOM_EPS) return false;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;   // neighbours across the closing edge
      const c = ring[j], d = ring[(j + 1) % n];
      if (segmentsCross(a, b, c, d) || distanceToSegment(c, a, b) <= GEOM_EPS || distanceToSegment(a, c, d) <= GEOM_EPS) return false;
    }
  }
  return true;
}

/** A point just inside each edge's middle: what tells two rings that share every edge apart from two that only touch. @param {readonly Pt[]} ring */
function innerProbes(ring) {
  const sign = Math.sign(ringArea2(ring)), step = GEOM_EPS * 4;
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const len = dhypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / len) * sign, nz = ((b[0] - a[0]) / len) * sign;   // the inward normal
    return /** @type {Pt} */ ([(a[0] + b[0]) / 2 + nx * step, (a[1] + b[1]) / 2 + nz * step]);
  });
}

/** The rings share ground: an edge crosses an edge, or a vertex or an inner probe of one is strictly in the other. @param {readonly Pt[]} a @param {readonly Pt[]} b */
export function ringsOverlap(a, b) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) if (segmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  }
  return a.some((p) => strictlyIn(p, b)) || b.some((p) => strictlyIn(p, a))
    || innerProbes(a).some((p) => strictlyIn(p, b, 0)) || innerProbes(b).some((p) => strictlyIn(p, a, 0));
}

/** Every part of `inner` is in `outer` or on its edge. @param {readonly Pt[]} inner @param {readonly Pt[]} outer */
export function ringWithin(inner, outer) {
  if (!inner.every((p) => inOrOn(p, outer))) return false;
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i], b = inner[(i + 1) % inner.length];
    for (let j = 0; j < outer.length; j++) if (segmentsCross(a, b, outer[j], outer[(j + 1) % outer.length])) return false;
    if (!inOrOn([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], outer)) return false;
  }
  return innerProbes(inner).every((p) => pointInRing(p, outer));
}

/**
 * The pad a point stands on: the smallest pad that holds it, since a pad may stand inside another (a raised square, a
 * keep's mound) and is then the ground there. Null off every pad.
 * @template {{ poly: readonly Pt[] }} P @param {readonly P[]} pads @param {Pt} p @returns {P|null}
 */
export function padAt(pads, p) {
  let best = null, bestArea = Infinity;
  for (const pad of pads) {
    if (!inOrOn(p, pad.poly)) continue;
    const a = Math.abs(ringArea2(pad.poly));
    if (a < bestArea) { best = pad; bestArea = a; }
  }
  return best;
}
