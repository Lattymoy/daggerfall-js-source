// @ts-check
// WG2 THE RIVER'S LAW ("Water"): a river's width and depth for what it carries, its
// course made from its cells, and the nearest point of any course (a river's, a road's) - one home the bake, the
// decoder, the sampler and the editor all read, so a course is one thing on every thread. A leaf: exact, no imports.

/** A river's width and depth for its discharge, metres - exact (square roots only). @param {number} q */
export const riverWidth = (q) => 2.4 * Math.sqrt(q) + 1.5;
export const riverDepth = (q) => 0.45 * Math.sqrt(Math.sqrt(q)) + 0.3;

/** A river's course from its cells' points ({ x, y, q, s }): Chaikin-smoothed twice, its ends kept, each point given
 *  its width and depth. The bake keeps the cells; this law makes the course again on decode, the same on any machine. */
export function riverCourse(raw) {
  return chaikin(chaikin(raw)).map((p) => ({ ...p, w: riverWidth(p.q), d: riverDepth(p.q) }));
}

/** One pass of Chaikin's corner cutting, ends kept; every number on a point is cut alike (a monotone surface stays so). */
function chaikin(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, q: a.q + (b.q - a.q) * t, s: a.s + (b.s - a.s) * t });
  for (let i = 0; i + 1 < pts.length; i++) { out.push(mix(pts[i], pts[i + 1], 0.25)); out.push(mix(pts[i], pts[i + 1], 0.75)); }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A road's shoulder past its edge, metres: its ease back to the ground. */
export const ROAD_SHOULDER_M = 4;
/** The nearest point of a course ([x, y, z] points, world pixels) to a world point: its distance in world pixels and the
 *  course's z there, or null for an empty course. @param {number[][]} pts @param {number} x @param {number} y */
export function nearCourse(pts, x, y) {
  let best = null, bd = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const dx = x - ax - vx * t, dy = y - ay - vy * t, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = { d: Math.sqrt(d2), z: az + (bz - az) * t }; }
  }
  return best;
}
