// @ts-check
// TACT1 - COVER (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "Proper line of sight with billboard props";
// his call: billboards block "Sight and missiles" - real cover, both ways).
//
// DFU's flats are billboards: a sprite with no collider, so a foe sees through a tree, a crate or a statue and an arrow
// flies through them. With the Enhanced AI switch on, every flat that reads as solid stands a COVER PROXY - an
// upright cylinder of its drawn footprint and height - in an index kept BESIDE the collider, never in it: walking, the
// navmesh and every ground probe are unchanged. A foe's sight ray, its clear-shot test and every missile (the player's
// and the foes', arrow and spell bolt) ask the index after the collider. With the switch off nothing reads it.
//
// The index rides its collider (`collider.cover`) and its sets are keyed like the collider's buckets, so a pixel, a
// building or a dungeon that leaves takes its cover with it (Collider.removeBucket). PROP-BODIES: a set holds a flat's
// BODY beside its cover - a proxy marked `body` (world/propBodies.js), filed in a grid of its own that no sight ray or
// missile reads and only the player's clamp asks (`near`, player/bodyClamp.js) - so a body rides every set's lifecycle
// as its cover does, whatever the Enhanced AI switch. A set's points are the flats'
// own [x, y, z] base arrays, by reference, in the set's own frame; `t()` is the frame's translation (a streaming
// pixel's), so a recentre moves the cover as it moves the meshes, and a felled tree sunk in its batch sinks its
// cover with it.

import { getPref } from '../systems/uiPrefs.js';

/** A flat lower than this, or narrower, is clutter, not cover (grass, flowers, a bottle, a candle). Metres. */
export const COVER_MIN_H = 1.2;
export const COVER_MIN_W = 0.5;
/** The proxy's radius as a share of the sprite's drawn width (a sprite's own edges are mostly air), and its height as
 *  a share of the drawn height (a crown's ragged top). */
export const COVER_RADIUS_FRAC = 0.35;
export const COVER_HEIGHT_FRAC = 0.9;
/** Archives that are never cover whatever their size: the editor's markers (199), the town animals (201, they walk
 *  about in DFU's own reading), the lights (210 - a lamp post's pole is thin and its lamp is light) and treasure (216). */
export const NOT_COVER_ARCHIVES = Object.freeze(new Set([199, 201, 210, 216]));
/** The broad phase's cell, metres. */
export const COVER_CELL = 4;
/** AUDIT BANTHA1 TREE-1: a proxy wider than a cell (a jungle tree's crown, up to 15 m) is filed ONCE, under its centre's
 *  cell of this wide grid, beside the fine one - filed in every 4 m cell it touched, a jungle pixel's 10,500 proxies
 *  were 148,000 references in 43,000 cells, 26-99 ms of the main thread and 11 MB a pixel - and a ray searches the wide
 *  cells within its set's widest such radius of it. Metres. */
export const COVER_WIDE = 32;

/** Is this flat cover? `size` is its drawn { w, h } (rmbFlats billboardSize). */
export function isCoverFlat(archive, record, size) {
  if (NOT_COVER_ARCHIVES.has(archive)) return false;
  const w = size?.w ?? 0, h = size?.h ?? 0;
  return h >= COVER_MIN_H && w >= COVER_MIN_W;
}

/** The proxy of one flat: `base` its [x, y, z] (the billboard's BASE, bottom-anchored), by reference. */
export function coverProxy(base, size) {
  return { c: base, r: size.w * COVER_RADIUS_FRAC, h: size.h * COVER_HEIGHT_FRAC, lift: 0 };
}
/** AUDIT TACT B2: a TREE is its trunk and its crown, not one fat column - the design's "a tree: its trunk's width to
 *  its crown's height". The trunk a body's width (COVER_TRUNK_R) up to where the crown starts, the crown the drawn
 *  width from there to the top: a player beside a trunk is beside it, never inside a 1 m pillar of air. */
export const COVER_TRUNK_R = 0.3;
export const COVER_CROWN_FROM = 0.45;
export function coverProxies(base, size, { tree = false } = {}) {
  if (!tree) return [coverProxy(base, size)];
  const h = size.h * COVER_HEIGHT_FRAC, from = size.h * COVER_CROWN_FROM;
  return [
    { c: base, r: Math.min(size.w * COVER_RADIUS_FRAC, COVER_TRUNK_R), h: from, lift: 0 },
    { c: base, r: size.w * COVER_RADIUS_FRAC, h: h - from, lift: from },
  ];
}

/** The first distance along a unit ray from `o` (in the cylinder's frame) at which it meets the upright cylinder
 *  { c: base, r, h, lift }, within `maxDist`; Infinity for none. A ray that STARTS inside a proxy is not blocked by it
 *  (a foe in a thicket still sees out of it, an arrow loosed from beside a trunk still flies). AUDIT TACT B2: and a
 *  SIGHT ray (`endAt`, its length) that ENDS inside one is not either - the law is two-way: one in a crown sees out of it AND
 *  is seen in it, never the one-way hiding place it was. A felled tree (FELLED) and a person (`c.noCover`) are no
 *  cover at all. */
export function rayCylinder(o, d, cyl, maxDist, endAt = null) {
  const c0 = cyl.c;
  if (FELLED.has(c0) || c0.noCover) return Infinity;
  const cx = c0[0], cy = c0[1] + (cyl.lift ?? 0), cz = c0[2], r = cyl.r, top = cy + cyl.h;
  const ox = o[0] - cx, oz = o[2] - cz;
  if (ox * ox + oz * oz <= r * r && o[1] >= cy && o[1] <= top) return Infinity;
  if (endAt != null) {   // the sight ray's own end (its target's eye), however short the search has been cut
    const ex = ox + d[0] * endAt, ey = o[1] + d[1] * endAt, ez = oz + d[2] * endAt;
    if (ex * ex + ez * ez <= r * r && ey >= cy && ey <= top) return Infinity;
  }
  let best = Infinity;
  // the side
  const a = d[0] * d[0] + d[2] * d[2];
  if (a > 1e-12) {
    const b = ox * d[0] + oz * d[2], c = ox * ox + oz * oz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const s = (-b - Math.sqrt(disc)) / a;
      if (s >= 0 && s <= maxDist) {
        const y = o[1] + d[1] * s;
        if (y >= cy && y <= top) best = s;
      }
    }
  }
  // the caps (a ray from above into a crown, from below into a ledge's bush)
  if (Math.abs(d[1]) > 1e-12) {
    for (let k = 0; k < 2; k++) {   // AUDIT TACT D11: no array a test
      const s = ((k ? cy : top) - o[1]) / d[1];
      if (s < 0 || s > maxDist || s >= best) continue;
      const x = ox + d[0] * s, z = oz + d[2] * s;
      if (x * x + z * z <= r * r) best = s;
    }
  }
  return best;
}

const ZERO3 = Object.freeze([0, 0, 0]);
/** AUDIT TACT B1: the felled trees' base arrays (scenes/treeHost.js sinkFelled marks them) - a WeakSet, so the batch's own
 *  arrays carry no extra member a reader could trip on, and a tree regrown with the day is cover again. */
export const FELLED = new WeakSet();
const _lo = [0, 0, 0];   // AUDIT TACT D11: the ray in a set's frame - one scratch, not one a call
/** AUDIT TACT D11: a broad-phase cell's key as a number (no string a cell a ray); cells within +-32768 of the frame's
 *  origin - 131 km at 4 m, past any pixel or room. */
const cellKey = (gx, gz) => (gx + 32768) * 65536 + (gz + 32768);

/** TACT1: cover is read with the Enhanced AI switch on - this module is the switch's one reader for it, so a host
 *  stands its index without seeing the switch (enhancedAI4's AUDIT 55 holds who may). */
export const coverSwitchOn = () => getPref('enhancedAI') === true;

/**
 * The cover index.
 * @param {{ enabled?: () => boolean }} [opts] `enabled` - is cover read at all (by default the Enhanced AI switch)
 */
export function createCoverIndex({ enabled = coverSwitchOn } = {}) {
  /** @type {Map<any, { items: any[], t: () => number[], grid: Map<number, any[]>, wide: Map<number, any[]>, wideR: number, min: number[], max: number[], bodies: Map<number, any[]>, bodyN: number }>} */
  const sets = new Map();
  let stamp = 0;

  /** A set of no proxies yet, `t` its frame's translation - in the index once placed (add, place). */
  const fresh = (t) => ({ items: [], t: t || (() => ZERO3), grid: new Map(), wide: new Map(), wideR: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], bodies: new Map(), bodyN: 0 });
  /** Add proxies to the set `key` (appended to what it holds); `t` its frame's translation. */
  function add(key, items, t = null) {
    let set = sets.get(key);
    if (!set) sets.set(key, (set = fresh(t)));
    return fill(set, items);
  }
  /** Proxies into a set, placed or not. */
  function fill(set, items) {
    for (const it of items) {
      if (!(it?.r > 0) || !(it.h > 0) || !it.c || it.c.noCover) continue;   // AUDIT TACT B3: a person is no cover
      it._mark = 0;
      if (it.body) { fileBody(set, it); continue; }   // PROP-BODIES: a body, never cover
      set.items.push(it);
      const [x, y, z] = it.c;
      set.min[0] = Math.min(set.min[0], x - it.r); set.max[0] = Math.max(set.max[0], x + it.r);
      set.min[1] = Math.min(set.min[1], y - 64); set.max[1] = Math.max(set.max[1], y + (it.lift ?? 0) + it.h + 64);   // slack, not a bound
      set.min[2] = Math.min(set.min[2], z - it.r); set.max[2] = Math.max(set.max[2], z + it.r);
      if (it.r > COVER_CELL) {   // TREE-1: a wide proxy, once, under its centre
        const k = cellKey(Math.floor(x / COVER_WIDE), Math.floor(z / COVER_WIDE));
        let cell = set.wide.get(k);
        if (!cell) set.wide.set(k, cell = []);
        cell.push(it);
        if (it.r > set.wideR) set.wideR = it.r;
        continue;
      }
      for (let gx = Math.floor((x - it.r) / COVER_CELL); gx <= Math.floor((x + it.r) / COVER_CELL); gx++) {
        for (let gz = Math.floor((z - it.r) / COVER_CELL); gz <= Math.floor((z + it.r) / COVER_CELL); gz++) {
          const k = cellKey(gx, gz);
          let cell = set.grid.get(k);
          if (!cell) set.grid.set(k, cell = []);
          cell.push(it);
        }
      }
    }
    return set.items.length;
  }

  /** PROP-BODIES: a body into its set's own grid - every cell its foot circle touches, so a query reaching the circle
   *  meets one of them. */
  function fileBody(set, it) {
    const [x, , z] = it.c;
    set.bodyN += 1;
    for (let gx = Math.floor((x - it.r) / COVER_CELL); gx <= Math.floor((x + it.r) / COVER_CELL); gx++) {
      for (let gz = Math.floor((z - it.r) / COVER_CELL); gz <= Math.floor((z + it.r) / COVER_CELL); gz++) {
        const k = cellKey(gx, gz);
        let cell = set.bodies.get(k);
        if (!cell) set.bodies.set(k, cell = []);
        cell.push(it);
      }
    }
  }

  /** PROP-BODIES: every body whose foot circle, widened by `reach`, holds the point `p` (x and z), handed to `visit`
   *  with its foot in the world's frame (x, the bottom of its span, z) - once each; a felled tree's and a person's none. */
  function near(p, reach, visit) {
    for (const set of sets.values()) {
      if (!set.bodyN) continue;
      const t = set.t(), x = p[0] - t[0], z = p[2] - t[2];
      stamp += 1;
      for (let gx = Math.floor((x - reach) / COVER_CELL); gx <= Math.floor((x + reach) / COVER_CELL); gx++) {
        for (let gz = Math.floor((z - reach) / COVER_CELL); gz <= Math.floor((z + reach) / COVER_CELL); gz++) {
          const cell = set.bodies.get(cellKey(gx, gz));
          if (!cell) continue;
          for (const it of cell) {
            if (it._mark === stamp) continue;
            it._mark = stamp;
            const c = it.c;
            if (FELLED.has(c) || c.noCover) continue;
            const dx = x - c[0], dz = z - c[2], R = it.r + reach;
            if (dx * dx + dz * dz < R * R) visit(it, c[0] + t[0], c[1] + t[1] + (it.lift ?? 0), c[2] + t[2]);
          }
        }
      }
    }
  }

  function remove(key) { sets.delete(key); }
  /** AUDIT PRECIP HOST-7: a set built aside (`staged`, filled a slice at a time with `fill`) put in for `key` in one
   *  step, whatever it held before - a pixel re-skinned in place trades its cover as it trades its flats, never a frame
   *  with neither or both. */
  function place(key, set) { sets.set(key, set); }

  /** The nearest cover along the unit ray `dir` from `origin` within `maxDist`; Infinity for none. `sight`: the ray
   *  is a line of sight to a target at `maxDist`, which a proxy holding that end does not hide (AUDIT TACT B2). */
  function hit(origin, dir, maxDist, sight = false) {
    if (!(maxDist > 0) || !sets.size) return Infinity;
    let best = Infinity;
    const lo = _lo;
    const endAt = sight ? maxDist : null;
    for (const set of sets.values()) {
      const t = set.t();
      lo[0] = origin[0] - t[0]; lo[1] = origin[1] - t[1]; lo[2] = origin[2] - t[2];
      const reach = Math.min(maxDist, best);
      const ex = lo[0] + dir[0] * reach, ez = lo[2] + dir[2] * reach;
      if (Math.max(lo[0], ex) < set.min[0] || Math.min(lo[0], ex) > set.max[0]) continue;
      if (Math.max(lo[2], ez) < set.min[2] || Math.min(lo[2], ez) > set.max[2]) continue;
      stamp += 1;
      const gx0 = Math.floor(Math.min(lo[0], ex) / COVER_CELL), gx1 = Math.floor(Math.max(lo[0], ex) / COVER_CELL);
      const gz0 = Math.floor(Math.min(lo[2], ez) / COVER_CELL), gz1 = Math.floor(Math.max(lo[2], ez) / COVER_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const cell = set.grid.get(cellKey(gx, gz));
          if (!cell) continue;
          for (const it of cell) {
            if (it._mark === stamp) continue;
            it._mark = stamp;
            const s = rayCylinder(lo, dir, it, Math.min(maxDist, best), endAt);
            if (s < best) best = s;
          }
        }
      }
      if (set.wideR > 0) {   // TREE-1: the wide proxies whose centre stands within the widest radius of the ray's box
        const R = set.wideR;
        const wx0 = Math.floor((Math.min(lo[0], ex) - R) / COVER_WIDE), wx1 = Math.floor((Math.max(lo[0], ex) + R) / COVER_WIDE);
        const wz0 = Math.floor((Math.min(lo[2], ez) - R) / COVER_WIDE), wz1 = Math.floor((Math.max(lo[2], ez) + R) / COVER_WIDE);
        for (let gx = wx0; gx <= wx1; gx++) {
          for (let gz = wz0; gz <= wz1; gz++) {
            const cell = set.wide.get(cellKey(gx, gz));
            if (!cell) continue;
            for (const it of cell) {
              const s = rayCylinder(lo, dir, it, Math.min(maxDist, best), endAt);
              if (s < best) best = s;
            }
          }
        }
      }
    }
    return best;
  }

  return {
    add, remove, hit, fill, place, near,
    /** AUDIT PRECIP HOST-7: a set of no proxies, outside the index until it is placed. */
    staged: (t = null) => fresh(t),
    /** Is cover read at all (the Enhanced AI switch). */
    on: () => !!enabled(),
    /** How many proxies, over every set (tests, probes). */
    size: () => { let n = 0; for (const s of sets.values()) n += s.items.length; return n; },
    /** AUDIT BANTHA1 TREE-1: how many references the grids hold, over every set (tests, probes) - a wide proxy is one. */
    refs: () => { let n = 0; for (const s of sets.values()) for (const g of [s.grid, s.wide]) for (const cell of g.values()) n += cell.length; return n; },
    has: (key) => sets.has(key),
    /** PROP-BODIES: how many bodies, over every set (tests, probes). */
    bodies: () => { let n = 0; for (const s of sets.values()) n += s.bodyN; return n; },
  };
}

/**
 * The one question every reader asks: how far along the unit ray `dir` from `origin` does the collider's `cover`
 * stop it, within `maxDist` - Infinity when the collider has no cover, cover is off (the Enhanced AI switch), or
 * nothing stands in the way.
 */
export function coverDistance(collider, origin, dir, maxDist, sight = false) {
  const cover = collider?.cover;
  if (!cover || !cover.on()) return Infinity;
  return cover.hit(origin, dir, maxDist, sight);   // AUDIT TACT B2: `sight` - a line of sight to a target at maxDist
}

/**
 * AUDIT TACT B5: A MISSILE MEETS COVER AS IT MEETS A BODY - BY TOUCH. A wall is met at the step's whole reach (DFU's
 * own sweep); cover answered the same way ate every shot at someone standing in front of a trunk whenever a frame's
 * step crossed both (a 20 fps arrow never struck a player half a metre before a tree). So: the missile stops on cover
 * only when its own radius touches it (`cov <= radius`); short of that, it is advanced only as far as the touch (the
 * step's `along`, in the step's own units), and the body tests run there first.
 * `cov` the cover's distance along the unit ray, `wall` the collider's, `reach` the step's reach (its length in unit
 * terms plus `radius`), `stepLen` |dir| x step. Answers { stop } - the distance it stops at (Infinity: it does not) -
 * and { advance } - the share of the step to take (1: all of it).
 */
export function coverStep(cov, wall, reach, radius, stepLen) {
  if (Number.isFinite(wall) && wall <= reach && !(cov < wall)) return { stop: wall, advance: 1 };
  if (!(cov <= reach)) return { stop: Number.isFinite(wall) && wall <= reach ? wall : Infinity, advance: 1 };
  if (cov <= radius + 1e-6) return { stop: cov, advance: 1 };
  return { stop: Infinity, advance: stepLen > 1e-9 ? Math.min(1, (cov - radius) / stepLen) : 1 };
}

/**
 * Stand a pool of flat groups as cover in `collider.cover` under `key`: `groups` maps "archive_record" (or
 * entries giving { archive, record }) to base [x, y, z] arrays, `sizeOf(archive, record)` answers the drawn { w, h }
 * (null for unknown). Answers how many proxies went in.
 */
export function standCover(collider, key, groups, sizeOf, t = null) {
  const cover = collider?.cover;
  if (!cover) return 0;
  const items = [];
  for (const [k, centers] of groups) {
    const [archive, record] = String(k).split('_').map(Number);
    const size = sizeOf(archive, record);
    if (!size || !isCoverFlat(archive, record, size)) continue;
    for (const c of centers) items.push(coverProxy(c, size));
  }
  if (!items.length) return 0;
  return cover.add(key, items, t);
}
