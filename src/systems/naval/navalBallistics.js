// @ts-check
// NAV-A (2026-09-28, Mac: "enhance the newly integrated ships by adding proper naval combat with a huge reference to
// assassins creed black flag. Being able to aim and fire when viewing from the side.") - THE BALLISTICS: where a
// round shot goes, and what it meets. The port's own (DFU has no cannon); pure, so the aim, the flight and the
// pins all read the one law.
//
// A SHOT IS A POINT UNDER GRAVITY ALONE. No drag, so its whole flight is a closed form of its launch -
//
//     p(t) = p0 + v0 t + g t^2 / 2        (g = -SHOT_GRAVITY along up)
//
// - and that one form is the arc the aim draws on the water, the path the ball flies, and the path every other
// client in a room flies from the same launch: a volley travels as its launches and each receiver draws the same
// balls, while the shooter alone resolves what they hit (NAV-G). Nothing integrates it step by step, so no frame
// rate bends a shot and a slow frame cannot tunnel one through a hull: the flight is swept as a segment from where
// the ball stood last frame to where the form puts it now.
//
// A GUN IS LAID, NOT POINTED. A broadside fires square to the hull - the ship is the traverse, as Black Flag's is -
// and the player sets only the range: where the look meets the sea is where the volley should fall, and
// `elevationForRange` finds the low arc that lands there, clamped to what the carriage allows. A ball leaves a
// moving deck at the deck's own speed as well (`launchVelocity`'s carry), so the zone the aim draws is where the
// balls really come down.
//
// DISPERSION IS SEEDED. `volleyRandom(seed)` is the one draw a volley's scatter reads, so the shooter and every
// receiver scatter one volley the same way; `scatter` bends a lay by up to its spread in each axis, the sum of two
// uniform draws (a triangular spread: most shots near the lay, a few at its edge).

import { mulberry32 } from '../../combat/blood/bloodArt.js';   // the port's one leaf mulberry32 (no imports behind it)

/** Unity's Physics.gravity magnitude, the world's metres (DFU's Unity units are metres). */
export const SHOT_GRAVITY = 9.81;
const UP = Object.freeze([0, 1, 0]);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const DEG = Math.PI / 180;

/**
 * The launch velocity of a gun laid `elevation` radians above the horizontal along the unit horizontal `dir`, the
 * deck's own velocity `carry` added.
 * @param {number[]} dir - unit, horizontal (its y ignored and the rest renormalised)
 * @param {number} elevation - radians above the horizontal
 * @param {number} speed - the muzzle speed, m/s
 * @param {number[] | null} [carry] - the deck's velocity, m/s
 * @returns {number[]}
 */
export function launchVelocity(dir, elevation, speed, carry = null) {
  const l = Math.hypot(dir[0], dir[2]) || 1;
  const c = Math.cos(elevation) * speed / l, s = Math.sin(elevation) * speed;
  return [dir[0] * c + (carry?.[0] ?? 0), s + (carry?.[1] ?? 0), dir[2] * c + (carry?.[2] ?? 0)];
}

/** Where a shot launched from `p0` at `v0` stands `t` seconds on. */
export function shotPosition(p0, v0, t, g = SHOT_GRAVITY, out = [0, 0, 0]) {
  out[0] = p0[0] + v0[0] * t;
  out[1] = p0[1] + v0[1] * t - 0.5 * g * t * t;
  out[2] = p0[2] + v0[2] * t;
  return out;
}
/** Its velocity then. */
export function shotVelocity(v0, t, g = SHOT_GRAVITY, out = [0, 0, 0]) {
  out[0] = v0[0]; out[1] = v0[1] - g * t; out[2] = v0[2];
  return out;
}

/**
 * The time a shot from height `y0` rising at `vy` comes DOWN through height `h` - the later root of
 * y0 + vy t - g t^2 / 2 = h - or null when its arc never reaches `h` (or reached it only before the launch).
 */
export function timeToHeight(y0, vy, h, g = SHOT_GRAVITY) {
  const d = vy * vy + 2 * g * (y0 - h);
  if (d < 0) return null;
  const t = (vy + Math.sqrt(d)) / g;
  return t >= 0 ? t : null;
}

/** Where a launch comes down through the sea at height `h`, and when: `{ t, point }`, or null. */
export function landing(p0, v0, h, g = SHOT_GRAVITY) {
  const t = timeToHeight(p0[1], v0[1], h, g);
  return t == null ? null : { t, point: shotPosition(p0, v0, t, g) };
}

/** The horizontal distance a gun `dy` metres over the sea throws at `elevation` radians and `speed` (no carry). */
export function rangeAt(elevation, speed, dy, g = SHOT_GRAVITY) {
  const t = timeToHeight(dy, Math.sin(elevation) * speed, 0, g);
  return t == null ? 0 : Math.cos(elevation) * speed * t;
}

/**
 * The LOW-ARC elevation that lands a shot `range` metres out from `dy` metres above its target, clamped to the
 * carriage's [lo, hi]. Past the gun's reach (the discriminant negative) the answer is `hi`: the gun at its highest,
 * the longest shot it has - the aim then shows the volley falling short, which is the truth.
 *   tan(e) = (v^2 - sqrt(v^4 - g (g x^2 - 2 dy v^2))) / (g x)
 */
export function elevationForRange(range, speed, dy, lo, hi, g = SHOT_GRAVITY) {
  if (!(range > 0)) return lo;
  const v2 = speed * speed;
  const disc = v2 * v2 - g * (g * range * range - 2 * dy * v2);
  if (disc < 0) return hi;
  return clamp(Math.atan((v2 - Math.sqrt(disc)) / (g * range)), lo, hi);
}

/** The farthest a gun `dy` over the sea throws within its carriage (at `hi`, or 45 degrees when the carriage goes
 *  higher - past it the range falls again). */
export function maxRange(speed, dy, hi, g = SHOT_GRAVITY) {
  return rangeAt(Math.min(hi, 45 * DEG), speed, dy, g);
}

/**
 * `n` points along a launch's arc, evenly in time from the muzzle to the sea at `h` - the aim's dotted line. The last
 * is the landing; an arc that never comes down gives the first second of its flight.
 */
export function arcPoints(p0, v0, h, n, g = SHOT_GRAVITY) {
  const end = timeToHeight(p0[1], v0[1], h, g) ?? 1;
  const out = [];
  const k = Math.max(2, n | 0);
  for (let i = 0; i < k; i++) out.push(shotPosition(p0, v0, end * (i / (k - 1)), g, [0, 0, 0]));
  return out;
}

/**
 * AIM-ENDS (2026-10-24, Discord - "trying to aim back cannons does not show projectile path"): `n` points along a
 * barrel's fall from the stern's rail `p0` to where it lands, `land` - rolled off with no lift, so its height falls with
 * the square of the way out (the fall of anything let go with a way of its own and no rise) and its way out is even.
 * The stern's aim drew no arc at all: a barrel is dropped, not laid (navalGunnery.js aimSolution), and the line it
 * falls along was never drawn.
 */
export function fallArc(p0, land, n) {
  const out = [];
  const k = Math.max(2, n | 0);
  for (let i = 0; i < k; i++) {
    const s = i / (k - 1);
    out.push([p0[0] + (land[0] - p0[0]) * s, p0[1] + (land[1] - p0[1]) * s * s, p0[2] + (land[2] - p0[2]) * s]);
  }
  return out;
}

/**
 * An oriented box: a local box (`center`, half `extent`) through a node's world matrix (column-major; its columns
 * carry the node's rotation and scale). Unit axes and the half sizes along them.
 * @returns {{ c: number[], ax: number[], ay: number[], az: number[], h: number[] }}
 */
export function orientedBox(m, center, extent) {
  const col = (i) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
  const cx = col(0), cy = col(1), cz = col(2);
  const lx = Math.hypot(...cx) || 1, ly = Math.hypot(...cy) || 1, lz = Math.hypot(...cz) || 1;
  const c = [
    m[0] * center[0] + m[4] * center[1] + m[8] * center[2] + m[12],
    m[1] * center[0] + m[5] * center[1] + m[9] * center[2] + m[13],
    m[2] * center[0] + m[6] * center[1] + m[10] * center[2] + m[14],
  ];
  return {
    c,
    ax: [cx[0] / lx, cx[1] / lx, cx[2] / lx], ay: [cy[0] / ly, cy[1] / ly, cy[2] / ly], az: [cz[0] / lz, cz[1] / lz, cz[2] / lz],
    h: [Math.abs(extent[0] * lx), Math.abs(extent[1] * ly), Math.abs(extent[2] * lz)],
  };
}

/** A world point in a box's own frame (its axes, from its centre). */
export function toBoxLocal(box, p) {
  const d = [p[0] - box.c[0], p[1] - box.c[1], p[2] - box.c[2]];
  const dot = (a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  return [dot(box.ax), dot(box.ay), dot(box.az)];
}

/**
 * A segment's first entry into an oriented box grown by `radius` (the ball's): the slab test in the box's frame.
 * `{ t, point, local }` - `t` the segment's fraction (0 when `a` starts inside) - or null.
 */
export function segmentBoxEntry(a, b, box, radius = 0) {
  const la = toBoxLocal(box, a), lb = toBoxLocal(box, b);
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const h = box.h[i] + radius, d = lb[i] - la[i];
    if (Math.abs(d) < 1e-9) {
      if (la[i] < -h || la[i] > h) return null;
      continue;
    }
    let u = (-h - la[i]) / d, w = (h - la[i]) / d;
    if (u > w) { const s = u; u = w; w = s; }
    if (u > t0) t0 = u;
    if (w < t1) t1 = w;
    if (t0 > t1) return null;
  }
  const point = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[2] + (b[2] - a[2]) * t0];
  return { t: t0, point, local: [la[0] + (lb[0] - la[0]) * t0, la[1] + (lb[1] - la[1]) * t0, la[2] + (lb[2] - la[2]) * t0] };
}

/** A segment's crossing DOWN through height `h`: its fraction, or null. */
export function segmentCrossesDown(a, b, h) {
  if (!(a[1] >= h && b[1] < h)) return null;
  return (a[1] - h) / (a[1] - b[1]);
}

/** The volley's own draw - every client scatters one volley the same way from its seed. */
export const volleyRandom = (seed) => mulberry32(seed >>> 0);

/**
 * A lay bent by the gun's spread: the horizontal direction turned about up by up to `yawSpreadDeg`, the elevation
 * moved by up to `pitchSpreadDeg`, each the mean of two uniform draws (triangular: most shots near the lay).
 * @param {number[]} dir - unit, horizontal
 * @param {number} elevation - radians
 * @param {() => number} rand
 */
export function scatter(dir, elevation, yawSpreadDeg, pitchSpreadDeg, rand) {
  const tri = () => rand() + rand() - 1;   // in (-1, 1), peaked at 0
  const yaw = tri() * yawSpreadDeg * DEG;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // about +y: x' = x c + z s, z' = -x s + z c (the port's yaw: forward (sin a, 0, cos a))
  return { dir: [dir[0] * c + dir[2] * s, 0, -dir[0] * s + dir[2] * c], elevation: elevation + tri() * pitchSpreadDeg * DEG };
}

/** The unit horizontal of a vector (its y dropped), or null for a vertical one. */
export function flatUnit(v) {
  const l = Math.hypot(v[0], v[2]);
  return l > 1e-9 ? [v[0] / l, 0, v[2] / l] : null;
}

/** Where a ray from `o` along `d` meets the sea at `h` going down, and how far: `{ distance, point }`, or null when
 *  it looks level or up (its answer then is the gun's longest shot, which the caller knows). */
export function raySeaHit(o, d, h) {
  if (!(d[1] < -1e-6)) return null;
  const s = (h - o[1]) / d[1];
  if (!(s >= 0)) return null;
  return { distance: s, point: [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s] };
}

export { UP as NAVAL_UP, DEG as NAVAL_DEG };
