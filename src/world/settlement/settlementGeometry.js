// @ts-check
// the plane geometry a settlement plan is checked with.
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

/** Distance between two segments: 0 where they cross. @param {Pt} start @param {Pt} end @param {Pt} from @param {Pt} to */
export function segmentGap(start, end, from, to) {
  if (segmentsCross(start, end, from, to)) return 0;
  return Math.min(distanceToSegment(start, from, to), distanceToSegment(end, from, to), distanceToSegment(from, start, end), distanceToSegment(to, start, end));
}

/** Distance from a segment to a ring: 0 where it reaches inside or across it. @param {Pt} start @param {Pt} end @param {readonly Pt[]} ring */
export function segmentRingDistance(start, end, ring) {
  if (pointInRing(start, ring) || pointInRing(end, ring)) return 0;
  return Math.min(...ring.map((corner, i) => segmentGap(start, end, corner, ring[(i + 1) % ring.length])));
}

/**
 * A link's flight as it is drawn and walked: its top on its higher pad's rim, where the link leaves that pad, and its run
 * back toward the lower end. `dir` points from the top toward the lower end; along it the lower pad begins at `enter`
 * (0 where the pads meet, a canal's width between decks) and ends at `room`. Null where the link does not cross into
 * its higher pad. Halving to a nanometre: the same on every engine.
 * @param {Pt} lowEnd @param {Pt} highEnd @param {readonly Pt[]} high @param {readonly Pt[]} low
 */
export function flightOf(lowEnd, highEnd, high, low) {
  const east = highEnd[0] - lowEnd[0], north = highEnd[1] - lowEnd[1], length = dhypot(east, north);
  if (!(length > 0) || !pointInRing(highEnd, high) || pointInRing(lowEnd, high)) return null;
  const halve = (/** @type {(t: number) => boolean} */ inside, /** @type {number} */ out, /** @type {number} */ into) => {
    for (let i = 0; i < 48; i++) { const middle = (out + into) / 2; if (inside(middle)) into = middle; else out = middle; }
    return into;
  };
  const share = halve((along) => pointInRing([lowEnd[0] + east * along, lowEnd[1] + north * along], high), 0, 1);
  /** @type {Pt} */ const top = [lowEnd[0] + east * share, lowEnd[1] + north * share], dir = [-east / length, -north / length];
  const onLow = (/** @type {number} */ away) => pointInRing([top[0] + dir[0] * away, top[1] + dir[1] * away], low);
  let enter = -1, room = 0;
  for (let away = 0.05; away < 80; away += 0.25) {
    if (enter < 0 && onLow(away)) enter = away <= 0.05 ? 0 : halve(onLow, away - 0.25, away);
    else if (enter >= 0 && !onLow(away)) { room = halve((past) => !onLow(past), away - 0.25, away); break; }
  }
  return enter < 0 ? null : { top, dir, enter, room: room || 80 };
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

/** A ring's box, grown by `grow`: [west, south, east, north]. @param {readonly Pt[]} ring @param {number} [grow] */
export function ringBox(ring, grow = 0) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [e, n] of ring) { west = Math.min(west, e); east = Math.max(east, e); south = Math.min(south, n); north = Math.max(north, n); }
  return [west - grow, south - grow, east + grow, north + grow];
}

/** The rings share ground: an edge crosses an edge, or a vertex or an inner probe of one is strictly in the other. Two
 *  whose boxes stand apart share none. @param {readonly Pt[]} a @param {readonly Pt[]} b */
export function ringsOverlap(a, b) {
  const boxA = ringBox(a), boxB = ringBox(b);
  if (boxA[0] > boxB[2] || boxB[0] > boxA[2] || boxA[1] > boxB[3] || boxB[1] > boxA[3]) return false;
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
    const [west, south, east, north] = ringBox(pad.poly, GEOM_EPS);
    if (p[0] < west || p[0] > east || p[1] < south || p[1] > north || !inOrOn(p, pad.poly)) continue;
    const a = Math.abs(ringArea2(pad.poly));
    if (a < bestArea) { best = pad; bestArea = a; }
  }
  return best;
}

/** padAt over pads read once: each one's box and area kept, for a plan asked of many points. Answers as padAt does.
 *  @template {{ poly: readonly Pt[] }} P @param {readonly P[]} pads @returns {(p: Pt) => P|null} */
export function padFinder(pads) {
  const kept = pads.map((pad) => ({ pad, box: ringBox(pad.poly, GEOM_EPS), area: Math.abs(ringArea2(pad.poly)) }));
  return (point) => {
    let best = null, bestArea = Infinity;
    for (const { pad, box, area } of kept) {
      if (point[0] < box[0] || point[0] > box[2] || point[1] < box[1] || point[1] > box[3] || area >= bestArea || !inOrOn(point, pad.poly)) continue;
      best = pad; bestArea = area;
    }
    return best;
  };
}
