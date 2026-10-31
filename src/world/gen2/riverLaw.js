// @ts-check
// WG2 THE RIVER'S LAW (bible/03-World/World-2-Canon.md, "Water"): a river's width and depth for what it carries, and
// its course made from its cells - one home the bake (hydrology.js) and the decoder (bakeCodec.js) both read, so a
// course decoded on a worker is the course the bake laid. A leaf: exact arithmetic, no imports.

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
