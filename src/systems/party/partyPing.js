// @ts-check
import { groundHit } from '../../player/travelPick.js';
import { staticBuildingsHasHit } from '../../world/staticBuildings.js';
// PARTY-PING: a look's point, said to the party and drawn for a moment.
// Not a DFU member. The middle button is DFU's AutoRun (InputManager.cs:995);
// the port's default gives that button to the ping and moves auto-run to F3
// (systems/inputActions.js). Ledger A (PARTY-PING).
//
// A ping is a point in the place the player is standing, kept on the party
// pose as `pg` (net/wire.js validPartyPose). The marker shows for PING_MARK_MS,
// fading in and out. A dotted route is laid only while this player follows a
// mate's mark. An older relay strips `pg` and closes nothing.

/** How long the marker stays up (ms). It fades in and out; it does not cut. */
export const PING_MARK_MS = 5000;
/** How long the floor route to that point stays up (ms). */
export const PING_PATH_MS = 12000;
/** The marker and the route fade in over this, and out over this (ms). */
export const PING_IN_MS = 150;
export const PING_OUT_MS = 300;
/** The look's reach indoors (m). Past it, a click names nothing. */
export const PING_REACH_M = 64;
/** How far a look may name a point on open ground (m). The travel view reaches further. */
export const PING_GROUND_M = 512;
export const PING_TRAVEL_M = 4000;
/** A second ping inside this is the same press settling, not a new point. */
export const PING_COOLDOWN_MS = 350;
/** The route stops once the feet are this close to the point (m). */
export const PING_ARRIVE_M = 1.8;
/** A place key's bound, the death-mark's own (net/wire.js `dd.k`). */
export const PING_PLACE_MAX = 96;
export const PING_PLACE_RE = /^[\w:.,-]{1,96}$/;

export const PING_COLOR_MINE = Object.freeze([1, 0.84, 0.32]);
export const PING_COLOR_MATE = Object.freeze([0.45, 0.95, 0.62]);

/** The dash and the gap of the floor route (m). Short, so a corridor reads as dots and not bars. */
export const PING_DASH_M = 0.14;
export const PING_GAP_M = 0.12;
/** How far a dash sits off the floor (m), and half its width. Flat: an upright reads as a stripe. */
export const PING_LIFT_M = 0.15;
export const PING_HALF_M = 0.04;
/** A face whose normal's Y is under this is a wall, a rock, a tree — not a floor. */
export const PING_WALL_NY = 0.5;
/** How far (m) a wall hit is pulled back toward the eye, past the navmesh's snap into the far side. */
export const PING_WALL_BACK = 0.85;

/**
 * The point a look of length `dist` names, or null when the look missed or
 * reached past PING_REACH_M. `dir` need not be a unit.
 * @param {ArrayLike<number>} eye
 * @param {ArrayLike<number>} dir
 * @param {number} dist
 */
/**
 * Where a look meets open ground. The march follows the height field, so a
 * hill is met on the near side and a tree, which is not the ground, is not
 * a hit. Null when the look stays in the air out to `reach`.
 * @param {ArrayLike<number>} eye
 * @param {ArrayLike<number>} dir
 * @param {(x: number, z: number) => number} ground
 */
export function pingGround(eye, dir, ground, reach = PING_GROUND_M) {
  if (!eye || !dir || typeof ground !== 'function') return null;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(len > 1e-8) || !(reach > 0)) return null;
  const far = reach > 600;
  const hit = groundHit([eye[0], eye[1], eye[2]], [dir[0] / len, dir[1] / len, dir[2] / len], ground, {
    maxDist: reach, stepMin: far ? 2 : 0.4, stepShare: far ? 0.004 : 0.01, refine: 12,
  });
  return hit.point && hit.dist <= reach ? hit.point : null;
}

/**
 * Where a look meets a building, or a city gate. A tree or a rock is the
 * same collider and is not a hit: only a point inside a static building's
 * box, or a gate's own bucket, stops the look. Null when the look meets
 * neither before `reach`.
 * @param {ArrayLike<number>} eye
 * @param {ArrayLike<number>} dir
 * @param {{ raycastHit?: (o: ArrayLike<number>, d: ArrayLike<number>, m: number) => { dist: number, key?: string|null } }|null} col
 * @param {ReadonlyArray<{ aabb: { min: number[], max: number[] } }>|null} buildings
 */
export function buildingStop(eye, dir, col, buildings, reach = PING_GROUND_M) {
  if (!eye || !dir || !col?.raycastHit) return null;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(len > 1e-8) || !(reach > 0)) return null;
  const u = [dir[0] / len, dir[1] / len, dir[2] / len];
  const hit = col.raycastHit(eye, u, reach);
  if (!hit || !Number.isFinite(hit.dist) || hit.dist < 0.15 || hit.dist > reach) return null;
  const at = [eye[0] + u[0] * hit.dist, eye[1] + u[1] * hit.dist, eye[2] + u[2] * hit.dist];
  const gate = typeof hit.key === 'string' && hit.key.startsWith('gate:');
  if (!gate && !staticBuildingsHasHit(buildings ?? [], at)) return null;
  return { dist: hit.dist };
}

/**
 * The mate's icon a look is aimed at, or null. Own marks are not followed.
 * The slack grows with distance, so a far icon is still a click.
 * @param {ArrayLike<number>} eye
 * @param {ArrayLike<number>} dir
 * @param {ReadonlyArray<{ at: number[], mine?: boolean }>} marks
 */
export function markUnderLook(eye, dir, marks) {
  if (!eye || !dir || !marks) return null;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(len > 1e-8)) return null;
  const ux = dir[0] / len, uy = dir[1] / len, uz = dir[2] / len;
  let best = null, bestT = Infinity;
  for (const m of marks) {
    if (!m || m.mine || !m.at) continue;
    const cx = m.at[0], cy = m.at[1], cz = m.at[2];
    const t = (cx - eye[0]) * ux + (cy - eye[1]) * uy + (cz - eye[2]) * uz;
    if (t < 0.4) continue;
    const miss = Math.hypot(eye[0] + ux * t - cx, eye[1] + uy * t - cy, eye[2] + uz * t - cz);
    if (miss <= Math.max(0.45, t * 0.03) && t < bestT) { best = m; bestT = t; }
  }
  return best;
}

export function aimPoint(eye, dir, dist, reach = PING_REACH_M) {
  if (!eye || !dir || !Number.isFinite(dist) || dist < 0.15 || dist > reach) return null;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(len > 1e-8)) return null;
  const s = dist / len;
  const p = [eye[0] + dir[0] * s, eye[1] + dir[1] * s, eye[2] + dir[2] * s];
  return p.every(Number.isFinite) ? p : null;
}

/** A place key the pose will carry. */
export function placeOk(k) {
  return typeof k === 'string' && PING_PLACE_RE.test(k) && k.length <= PING_PLACE_MAX;
}

const safeBit = (v, n = 24) => String(v ?? '').replace(/[^\w.-]/g, '').slice(0, n);

/** The instance, a private room and a cabin, so two copies of one place do not share a ping. */
function placeTag(id) {
  if (!id) return '';
  const bits = [];
  const inst = id.instance;
  if (inst && typeof inst === 'object' && inst.owner != null) {
    const owner = safeBit(inst.owner);
    if (owner) bits.push(`${owner}.${Number(inst.epoch) || 0}`);
  }
  if (id.private && id.privateRoom != null) {
    const room = safeBit(id.privateRoom);
    if (room) bits.push(room);
  }
  if (id.boatUid != null) {
    const boat = safeBit(id.boatUid);
    if (boat) bits.push(`b${boat}`);
  }
  return bits.length ? `:${bits.join('.')}` : '';
}

/**
 * The place a ping belongs to. `id` is the mode host's roomIdentity; `pixel`
 * is the map pixel under the player. Outdoors, that pixel is the place. Null when the
 * room is not named yet.
 * @param {string} mode
 * @param {{ kind?: string, mapId?: number, size?: string, day?: *, s?: *, b?: *, o?: *, buildingKey?: number, instance?: object, private?: boolean, privateRoom?: *, boatUid?: * }|null} id
 * @param {{ x: number, y: number }|null} pixel
 */
export function pingPlace(mode, id, pixel) {
  if (mode === 'exterior' || mode == null) {
    if (pixel && Number.isFinite(pixel.x) && Number.isFinite(pixel.y)) return { k: `w:${pixel.x | 0}.${pixel.y | 0}`, space: 'world' };
    return { k: 'w', space: 'world' };
  }
  let k = null;
  let space = 'world';
  if (mode === 'dungeon' && id) {
    space = 'dungeon';
    if (id.kind === 'dungeon') {
      if (Number.isFinite(id.mapId)) k = `d:${id.mapId >>> 0}${id.size ? `.${id.size}` : ''}`;
    } else if (typeof id.kind === 'string') k = `d:${safeBit(id.kind, 12)}:${safeBit(id.day ?? id.s ?? id.b ?? id.o ?? '', 24)}`;
  } else if (mode === 'interior' && id && Number.isFinite(Number(id.buildingKey)) && pixel && Number.isFinite(pixel.x) && Number.isFinite(pixel.y)) {
    space = 'interior';
    k = `i:${pixel.x | 0}.${pixel.y | 0}.${id.buildingKey >>> 0}`;
  }
  if (!k) return null;
  const full = k + placeTag(id);
  if (placeOk(full)) return { k: full, space };
  return placeOk(k) ? { k, space } : null;
}

const smooth = (t) => { const u = t < 0 ? 0 : t > 1 ? 1 : t; return u * u * (3 - 2 * u); };

/**
 * How bright something born at `born` and gone at `until` is now. In over
 * PING_IN_MS from the start, out over PING_OUT_MS at the end.
 * @param {number} now
 * @param {number} born
 * @param {number} until
 */
export function fadeAlpha(now, born, until, inn = PING_IN_MS, out = PING_OUT_MS) {
  if (!(now >= born) || !(now < until)) return 0;
  let a = 1;
  const since = now - born;
  if (since < inn) a = smooth(since / inn);
  const left = until - now;
  if (left < out) a *= smooth(left / out);
  return a;
}

/**
 * The point a look names. A floor is the surface the look hits. A wall, a
 * rock or a tree is the ground in front of that face (`down` is a ray cast
 * straight down from the pulled-back point), so a route cannot snap through
 * the face onto the far side.
 * @param {ArrayLike<number>} eye
 * @param {ArrayLike<number>} dir
 * @param {{ dist: number, normal?: ArrayLike<number> }|null} hit
 * @param {{ dist: number }|null} down
 */
export function settleAim(eye, dir, hit, down) {
  if (!hit || !Number.isFinite(hit.dist)) return null;
  const n = hit.normal;
  const wall = !!(n && n.length >= 3 && n[1] < PING_WALL_NY);
  const dist = wall ? Math.max(0.2, hit.dist - PING_WALL_BACK) : hit.dist;
  const at = aimPoint(eye, dir, dist);
  if (!at || !wall) return at;
  if (down && Number.isFinite(down.dist) && down.dist > 0.02 && down.dist < 8) return [at[0], at[1] - down.dist, at[2]];
  return at;
}

/**
 * A route over open ground, from the walker's feet to a point. `ground(x, z)`
 * is the surface height. `clear(a, b)` is false when a walker cannot step from
 * a to b (a building, a rock). Straight when the way is open; otherwise a
 * short search around the span. Null when no way exists.
 * @param {ArrayLike<number>} from
 * @param {ArrayLike<number>} to
 * @param {(x: number, z: number) => number} ground
 * @param {(a: number[], b: number[]) => boolean} [clear]
 */
export function groundRoute(from, to, ground, clear) {
  const yAt = (x, z) => {
    const y = ground ? ground(x, z) : from[1];
    return Number.isFinite(y) ? y : null;
  };
  const P = (x, z) => {
    const y = yAt(x, z);
    return y == null ? null : [x, y, z];
  };
  const stepOk = (a, b) => {
    const h = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (!(h > 1e-4) || Math.abs(b[1] - a[1]) / h > 2.5) return false;
    return !clear || clear(a, b) !== false;
  };
  const walk = (a, b) => {
    const h = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(h / 2));
    /** @type {number[][]} */
    const pts = [];
    let prev = a;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = i === 0 ? a : i === n ? b : P(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t);
      if (!p || (i > 0 && !stepOk(prev, p))) return null;
      pts.push(p);
      prev = p;
    }
    return pts;
  };
  const start = P(from[0], from[2]) ?? [from[0], from[1], from[2]];
  const goal = P(to[0], to[2]);
  if (!goal) return null;
  const straight = walk(start, goal);
  if (straight) return straight;
  const cell = 3, margin = 12;
  const x0 = Math.min(start[0], goal[0]) - margin, z0 = Math.min(start[2], goal[2]) - margin;
  const x1 = Math.max(start[0], goal[0]) + margin, z1 = Math.max(start[2], goal[2]) + margin;
  const nx = Math.ceil((x1 - x0) / cell) + 1, nz = Math.ceil((z1 - z0) / cell) + 1;
  if (nx < 2 || nz < 2 || nx * nz > 4000) return null;
  const clamp = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  const sx = clamp(Math.round((start[0] - x0) / cell), nx), sz = clamp(Math.round((start[2] - z0) / cell), nz);
  const gx = clamp(Math.round((goal[0] - x0) / cell), nx), gz = clamp(Math.round((goal[2] - z0) / cell), nz);
  const N = nx * nz, id = (ix, iz) => iz * nx + ix;
  const gScore = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [id(sx, sz)];
  gScore[open[0]] = 0;
  const heur = (ix, iz) => Math.hypot(ix - gx, iz - gz);
  let guard = 0, found = false;
  while (open.length && guard++ < 4000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const ia = open[i], ib = open[bi];
      const fa = gScore[ia] + heur(ia % nx, (ia / nx) | 0), fb = gScore[ib] + heur(ib % nx, (ib / nx) | 0);
      if (fa < fb) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % nx, cz = (cur / nx) | 0;
    if (cx === gx && cz === gz) { found = true; break; }
    const a = P(x0 + cx * cell, z0 + cz * cell);
    if (!a) continue;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const ix = cx + dx, iz = cz + dz;
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
      const q = id(ix, iz);
      if (closed[q]) continue;
      const b = P(x0 + ix * cell, z0 + iz * cell);
      if (!b || !stepOk(a, b)) continue;
      const ng = gScore[cur] + Math.hypot(dx, dz);
      if (ng < gScore[q]) { gScore[q] = ng; prev[q] = cur; if (!open.includes(q)) open.push(q); }
    }
  }
  if (!found) return null;
  /** @type {number[][]} */
  const pts = [start];
  const cells = [];
  for (let c = id(gx, gz); c >= 0; c = prev[c]) cells.push(c);
  cells.reverse();
  for (const c of cells) {
    const p = P(x0 + (c % nx) * cell, z0 + ((c / nx) | 0) * cell);
    if (p) pts.push(p);
  }
  pts.push(goal);
  return pts;
}

/**
 * The floor route as triangles (x,y,z triples): each dash is a short flat
 * on the floor. Empty when there is no span.
 * @param {ReadonlyArray<ReadonlyArray<number>>} points
 */
export function pathRibbon(points, { dash = PING_DASH_M, gap = PING_GAP_M, lift = PING_LIFT_M, half = PING_HALF_M } = {}) {
  /** @type {number[]} */
  const out = [];
  if (!points || points.length < 2) return out;
  const period = dash + gap;
  let carry = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (!(len > 1e-3)) continue;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    let px = -uz, pz = ux;
    const pl = Math.hypot(px, pz) || 1;
    px = (px / pl) * half; pz = (pz / pl) * half;
    let t = 0;
    while (t < len - 1e-6) {
      const into = carry % period;
      const on = into < dash;
      const room = (on ? dash : period) - into;
      const step = Math.min(room, len - t);
      if (!(step > 1e-6)) { t += 1e-4; carry += 1e-4; continue; }
      if (on && step > 0.02) {
        const ax = a[0] + ux * t, ay = a[1] + uy * t + lift, az = a[2] + uz * t;
        const bx = a[0] + ux * (t + step), by = a[1] + uy * (t + step) + lift, bz = a[2] + uz * (t + step);
        out.push(
          ax + px, ay, az + pz, bx + px, by, bz + pz, bx - px, by, bz - pz,
          ax + px, ay, az + pz, bx - px, by, bz - pz, ax - px, ay, az - pz,
        );
      }
      t += step;
      carry += step;
    }
  }
  return out;
}
