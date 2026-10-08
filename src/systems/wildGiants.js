// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ZONE GIANTS (2026-10-08, the owner: "can you always spawn 2 giants per tier and make em show on the map where they
// wander around? dont use the 15% anymore if this is possible")
//
// The zone's giants are no longer a wanderer's roll. Every tier keeps TWO giants, always - eight in the zone - and each
// one WANDERS: its place at any moment is a pure function of the time (the relay's clock, the same skew the halls read)
// and the zone's mask, so every client sees every giant in the same place on the map, walking the same way.
//
// HOW A GIANT WALKS: each day it keeps a HOME, a free pixel deep in its own tier (the tier's middle band, as the halls
// stand); its day is a chain of LEGS, each WILD_GIANT_LEG_MS long, from one waypoint to the next - every waypoint a free
// pixel of its own tier within WILD_GIANT_ROAM_PX of the day's home. Between two waypoints it walks a straight line. A
// day on, it has a new home.
//
// DEAD: a giant killed is the hub's word (net/wildLaw.js wdunGiantDie - kept with the halls), down for
// WILD_GIANT_RESPAWN_MS for everyone, then it walks again from wherever its path has got to.
// Pure: the mask, a pixel test and a time in; the giants out.
// ═══════════════════════════════════════════════════════════════════
import { WILD_RINGS } from './wildZone.js';

export const WILD_GIANTS_PER_RING = 2;
export const WILD_GIANT_COUNT = WILD_GIANTS_PER_RING * WILD_RINGS;
/** One leg of a giant's walk (real milliseconds). */
export const WILD_GIANT_LEG_MS = 20 * 60_000;
/** How far from its day's home a giant roams (map pixels). */
export const WILD_GIANT_ROAM_PX = 5;
/** A killed giant is down this long for everyone. */
export const WILD_GIANT_RESPAWN_MS = 30 * 60_000;
/** A giant is stood in the world (out of its path, onto the ground) once the player is this near its place (metres). */
export const WILD_GIANT_STAND_M = 320;
const DAY_MS = 24 * 3_600_000;

const mix = (a, b) => { let h = (a ^ Math.imul(b + 0x7f4a7c15, 0x9e3779b1)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const ringOf = (mask, i) => {
  const d = mask.depth?.[i] ?? 0;
  if (!d || !mask.maxDepth) return 0;
  return Math.max(1, Math.min(WILD_RINGS, Math.ceil((d / mask.maxDepth) * WILD_RINGS)));
};

/** A giant's tier (1..4) by its index (0..7): two a tier, the foothills' first. */
export const wildGiantRing = (g) => Math.floor((g | 0) / WILD_GIANTS_PER_RING) + 1;

const _cells = new WeakMap();
/** GIANT-FIELDS (the owner: "make sure the giants dont spawn on top of mounts only in a free field"): of each tier's free
 *  pixels only the LOWER half by the height map walk - the valleys and the open fields, never the peaks and the ridges. */
export const WILD_GIANT_LOW_SHARE = 0.5;
/** Each tier's free pixels `[{x, y}]` a giant may walk - read once a mask. */
function cellsOf(mask, free, heightAt = null) {
  let c = _cells.get(mask);
  if (c && c.free === free) return c;
  const box = mask.box ?? { x0: 0, y0: 0, x1: mask.width - 1, y1: mask.height - 1 };
  const all = Array.from({ length: WILD_RINGS + 1 }, () => []);
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const r = ringOf(mask, y * mask.width + x);
      if (r && free(x, y)) all[r].push({ x, y });
    }
  }
  if (heightAt) {
    for (let r = 1; r <= WILD_RINGS; r++) {
      const list = all[r];
      if (list.length < 8) continue;
      const hs = list.map((p) => heightAt(p.x, p.y)).sort((a, b) => a - b);
      const cut = hs[Math.floor((hs.length - 1) * WILD_GIANT_LOW_SHARE)];
      all[r] = list.filter((p) => heightAt(p.x, p.y) <= cut);
    }
  }
  c = { free, all, legs: new Map(), homes: new Map(), mask };
  _cells.set(mask, c);
  return c;
}

/** The giant's home on a day: a free pixel of its tier (the second of a tier kept apart from the first). */
function homeOf(c, g, day) {
  const key = `${g}:${day}`;
  let h = c.homes.get(key);
  if (h !== undefined) return h;
  const list = c.all[wildGiantRing(g)];
  if (!list.length) { c.homes.set(key, null); return null; }
  h = list[mix(day * 31 + 7, g) % list.length];
  if (g % WILD_GIANTS_PER_RING === 1) {
    const first = homeOf(c, g - 1, day);
    // apart from its twin: the best of a few draws, the farthest
    for (let k = 1; k < 8 && first; k++) {
      const q = list[mix(day * 31 + 7 + k * 101, g) % list.length];
      if (Math.hypot(q.x - first.x, q.y - first.y) > Math.hypot(h.x - first.x, h.y - first.y)) h = q;
    }
  }
  c.homes.set(key, h);
  if (c.homes.size > 256) c.homes.delete(c.homes.keys().next().value);
  return h;
}

/** The giant's waypoint at leg `leg` (a free pixel of its tier near the day's home). */
function waypointOf(c, g, leg) {
  const key = `${g}:${leg}`;
  let w = c.legs.get(key);
  if (w !== undefined) return w;
  const day = Math.floor((leg * WILD_GIANT_LEG_MS) / DAY_MS);
  const home = homeOf(c, g, day);
  if (!home) { c.legs.set(key, null); return null; }
  // GIANT-LEASH2: the day's first leg starts at its home; every next waypoint is one the giant can WALK to from the last
  // in a straight line without leaving the zone (a bay in the border is walked round, never across) - none such, it
  // stands where it is for the leg
  const first = Math.floor(((leg - 1) * WILD_GIANT_LEG_MS) / DAY_MS) !== day;
  const prev = first ? null : waypointOf(c, g, leg - 1);
  const near = c.all[wildGiantRing(g)].filter((p) => Math.abs(p.x - home.x) <= WILD_GIANT_ROAM_PX && Math.abs(p.y - home.y) <= WILD_GIANT_ROAM_PX && (!prev || lineInside(c.mask, prev, p)));
  w = first ? home : near.length ? near[mix(leg, g * 977 + 13) % near.length] : (prev ?? home);
  c.legs.set(key, w);
  if (c.legs.size > 4096) c.legs.delete(c.legs.keys().next().value);
  return w;
}
/** Does the straight walk from pixel `a` to pixel `b` (their middles) stay inside the zone all the way? */
function lineInside(mask, a, b) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
  for (let k = 0; k <= n; k++) {
    const x = Math.floor(a.x + 0.5 + ((b.x - a.x) * k) / n), y = Math.floor(a.y + 0.5 + ((b.y - a.y) * k) / n);
    if (x < 0 || y < 0 || x >= mask.width || y >= mask.height || !ringOf(mask, y * mask.width + x)) return false;
  }
  return true;
}

/**
 * Where every giant walks at `now` (the relay's clock): `[{ g, ring, x, y, heading }]` in map pixels (fractional - the
 * centre of a pixel is +0.5), `heading` the way it walks (radians on the map, 0 east). `dead(g)` a giant down.
 * @param {{ width:number, height:number, depth:ArrayLike<number>, maxDepth:number, box?:object }} mask
 * @param {(x:number, y:number) => boolean} free
 * @param {number} now
 * @param {(g:number) => boolean} [dead]
 * @param {((x:number, y:number) => number)|null} [heightAt] the height map's byte - the giants keep to the low ground
 */
export function wildGiantsAt(mask, free, now, dead = () => false, heightAt = null) {
  if (!mask?.depth || !mask.maxDepth) return [];
  const c = cellsOf(mask, free, heightAt);
  const out = [];
  for (let g = 0; g < WILD_GIANT_COUNT; g++) {
    if (dead(g)) continue;
    const t = now + g * 157_000;   // each giant's legs out of step with the others'
    const leg = Math.floor(t / WILD_GIANT_LEG_MS);
    const f = (t - leg * WILD_GIANT_LEG_MS) / WILD_GIANT_LEG_MS;
    const a = waypointOf(c, g, leg), b = waypointOf(c, g, leg + 1);
    if (!a || !b) continue;
    let x = a.x + 0.5 + (b.x - a.x) * f, y = a.y + 0.5 + (b.y - a.y) * f;
    // GIANT-LEASH (the owner: "giant should not be able to walk out of the zone"): a straight line between two waypoints
    // of its tier that cuts over the zone's edge (a bay in the border) is not walked out there - the giant waits at the
    // nearer waypoint until the line comes back in
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= mask.width || yi >= mask.height || !ringOf(mask, yi * mask.width + xi)) { const p = f < 0.5 ? a : b; x = p.x + 0.5; y = p.y + 0.5; }
    out.push({ g, ring: wildGiantRing(g), x, y, heading: Math.atan2(b.y - a.y, b.x - a.x) });
  }
  return out;
}
