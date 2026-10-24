// @ts-check
// OW-FREE-STRAIGHT (moved out of scenes/world.js by GRANT3, HOST-SPLIT - bible/01-Overview/Host-Split.md): the planner
// walks the pixel grid (diagonal, then straight), so a FREE journey bent at a pixel middle on the way - toward the road
// or a place - though the way ahead was clear. In FREE mode an all-open route is pulled taut: each stretch jumps to the
// farthest pixel the line of sight reaches without water or a blocked (mountain) step. The host asks it only in FREE
// mode (world.js tvFreePull: never a road's route).
//
// Pure, but for the route's ground, asked of `ground()` only when the route is one to pull. Not a DFU member.

/** 8-connected pixels a -> b (Bresenham). @param {{x: number, y: number}} a @param {{x: number, y: number}} b */
function line(a, b) {
  const out = [a]; let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    out.push({ x, y });
  }
  return out;
}

/**
 * An all-open route of three pixels or more pulled taut over `ground()`'s water and blocked steps; any other route as it
 * was.
 * @param {any} plan @param {() => { isWater: (x: number, y: number) => boolean, openBlocked: (ax: number, ay: number, bx: number, by: number, fromPeak: boolean) => boolean, peakAt: (x: number, y: number) => boolean }} ground
 */
export function freePull(plan, ground) {
  if (!plan?.pixels || plan.pixels.length < 3 || plan.kinds?.some((k) => k !== 'open')) return plan;
  const g = ground();
  const clear = (a, b) => {
    const pts = line(a, b);
    for (let i = 1; i < pts.length; i++) {
      if (g.isWater(pts[i].x, pts[i].y)) return false;
      if (g.openBlocked(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, i === 1 && g.peakAt(a.x, a.y))) return false;
    }
    return true;
  };
  const px = plan.pixels, keep = [px[0]];
  let i = 0;
  while (i < px.length - 1) {
    let j = px.length - 1;
    while (j > i + 1 && !clear(px[i], px[j])) j--;
    keep.push(px[j]);
    i = j;
  }
  return keep.length >= px.length ? plan : { ...plan, pixels: keep, kinds: keep.slice(1).map(() => 'open') };
}
