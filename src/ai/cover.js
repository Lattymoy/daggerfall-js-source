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
// missile reads and only the clamps ask (`near`: the player's, player/bodyClamp.js, and TRUNK-FOES' foes') - so a body
// rides every set's lifecycle as its cover does, whatever the Enhanced AI switch. A set's points are the flats'
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
  const w = size?.w ?? 0,
    h = size?.h ?? 0;
  return h >= COVER_MIN_H && w >= COVER_MIN_W;
}

/** The proxy of one flat: `base` its [x, y, z] (the billboard's BASE, bottom-anchored), by reference. */
export function coverProxy(base, size) {
  return { c: base, r: size.w * COVER_RADIUS_FRAC, h: size.h * COVER_HEIGHT_FRAC, lift: 0, _mark: 0 }; // MEM-AUDIT: born with the index's mark (fileIn, below)
}
/** AUDIT TACT B2: a TREE is its trunk and its crown, not one fat column - the design's "a tree: its trunk's width to
 *  its crown's height". The trunk a body's width (COVER_TRUNK_R) up to where the crown starts, the crown the drawn
 *  width from there to the top: a player beside a trunk is beside it, never inside a 1 m pillar of air. */
export const COVER_TRUNK_R = 0.3;
export const COVER_CROWN_FROM = 0.45;
export function coverProxies(base, size, { tree = false } = {}) {
  if (!tree) return [coverProxy(base, size)];
  const h = size.h * COVER_HEIGHT_FRAC,
    from = size.h * COVER_CROWN_FROM;
  return [
    { c: base, r: Math.min(size.w * COVER_RADIUS_FRAC, COVER_TRUNK_R), h: from, lift: 0, _mark: 0 },
    { c: base, r: size.w * COVER_RADIUS_FRAC, h: h - from, lift: from, _mark: 0 },
  ];
}

/** The first distance along a unit ray from `o` (in the cylinder's frame) at which it meets the upright cylinder
 *  { c: base, r, h, lift }, within `maxDist`; Infinity for none. From outside a ray meets its side or a cap. AUDIT FB1031
 *  F1, II K1: a ray with an end inside it (its start, or a SIGHT ray's end at `endAt`, its length) meets it only where it
 *  crosses its MIDDLE inside it, that end past the middle (COVER_MIDDLE_GRACE) - from inside at the middle, from outside
 *  where it enters; an end in front of the middle (AUDIT TACT B2) opens it. A felled tree (FELLED) and a person
 *  (`c.noCover`) are no cover at all. */
export function rayCylinder(o, d, cyl, maxDist, endAt = null) {
  return rayUpright(o, d, cyl.c, cyl.r, cyl.h, cyl.lift ?? 0, maxDist, endAt);
}
/** AUDIT FB1031 F1: A PROXY'S MIDDLE - where a ray passes nearest its axis, where the flat's picture stands. A body in a
 *  proxy on the far side of its middle from another, the line between them crossing the middle inside it, is behind it
 *  both ways (unseen and blind, unshot and shooting nothing); else it sees and is seen both ways - a line under a crown's
 *  floor at the middle too (AUDIT FB1031 II K1). A hold opened the whole proxy, and a clamp leaves a body inside a wide
 *  flat's cover or a low crown: one pressed behind a rock or a young tree's trunk was shot through it. Within this of
 *  the middle (a body's own radius, motor.js CAPSULE_RADIUS) a body is at it: the near side for both. */
export const COVER_MIDDLE_GRACE = 0.35;
/** COVER-COMPACT: rayCylinder over a proxy's own numbers - the index's columns ask it with no object a proxy. TRUNK-FOES:
 *  `holds` the points (flat x, y, z, in the cylinder's frame) of the bodies a missile's line strikes - a proxy holding one
 *  in front of its middle (AUDIT FB1031 F1) is not in front of it, and one past it is an end in it (II K1), as the sight
 *  law sees. */
function rayUpright(o, d, c0, r, h, lift, maxDist, endAt, holds = null, nHolds = 0) {
  if (FELLED.has(c0) || c0.noCover) return Infinity;
  const cx = c0[0],
    cy = c0[1] + lift,
    cz = c0[2],
    top = cy + h,
    rr = r * r;
  const ox = o[0] - cx,
    oz = o[2] - cz;
  const a = d[0] * d[0] + d[2] * d[2];
  const mid = a > 1e-12 ? -(ox * d[0] + oz * d[2]) / a : Infinity; // AUDIT FB1031 F1: its middle (a ray straight up or down crosses none)
  let endIn = false; // AUDIT FB1031 II K1: an end in it past its middle - read as a start in it is
  if (endAt != null) {
    // the sight ray's own end (its target's eye), however short the search has been cut
    const ex = ox + d[0] * endAt,
      ey = o[1] + d[1] * endAt,
      ez = oz + d[2] * endAt;
    if (ex * ex + ez * ez <= rr && ey >= cy && ey <= top) {
      if (!(endAt - mid > COVER_MIDDLE_GRACE)) return Infinity;
      endIn = true;
    }
  }
  for (let k = 0; k < nHolds; k += 3) {
    const hx = holds[k] - cx,
      hz = holds[k + 2] - cz,
      hy = holds[k + 1];
    if (hx * hx + hz * hz <= rr && hy >= cy && hy <= top) {
      if (!(((hx - ox) * d[0] + (hz - oz) * d[2]) / a - mid > COVER_MIDDLE_GRACE)) return Infinity;
      endIn = true;
    }
  }
  // AUDIT FB1031 II K1: an end in it - either end, alike - hides only where the line crosses the middle inside it. One
  // from outside had stopped at its side whatever the middle, so under a crown's floor a foe in the crown saw and shot a
  // crouched player whose shot back was lost. A line to a body past the middle stops a grace short of it at the latest:
  // at the middle a foe's contact reach (0.45 m, past the grace) struck one whose own shot out was lost.
  const startIn = ox * ox + oz * oz <= rr && o[1] >= cy && o[1] <= top;
  let best = Infinity;
  if (startIn || endIn) {
    const y = o[1] + d[1] * mid,
      mx = ox + d[0] * mid,
      mz = oz + d[2] * mid; // a hold is a body's axis, beside the line
    if (!((!startIn || mid > COVER_MIDDLE_GRACE) && mid >= 0 && y >= cy && y <= top && mx * mx + mz * mz <= rr))
      return Infinity;
    const at = endIn ? Math.max(0, mid - COVER_MIDDLE_GRACE) : mid;
    if (startIn) return at <= maxDist ? at : Infinity;
    if (at <= maxDist) best = at; // from outside: where it enters, if sooner
  }
  // the side
  if (a > 1e-12) {
    const b = ox * d[0] + oz * d[2],
      c = ox * ox + oz * oz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const s = (-b - Math.sqrt(disc)) / a;
      if (s >= 0 && s <= maxDist && s < best) {
        const y = o[1] + d[1] * s;
        if (y >= cy && y <= top) best = s;
      }
    }
  }
  // the caps (a ray from above into a crown, from below into a ledge's bush)
  if (Math.abs(d[1]) > 1e-12) {
    for (let k = 0; k < 2; k++) {
      // AUDIT TACT D11: no array a test
      const s = ((k ? cy : top) - o[1]) / d[1];
      if (s < 0 || s > maxDist || s >= best) continue;
      const x = ox + d[0] * s,
        z = oz + d[2] * s;
      if (x * x + z * z <= r * r) best = s;
    }
  }
  return best;
}

const ZERO3 = Object.freeze([0, 0, 0]);
/** AUDIT TACT B1: the felled trees' base arrays (scenes/treeHost.js sinkFelled marks them) - a WeakSet, so the batch's own
 *  arrays carry no extra member a reader could trip on, and a tree regrown with the day is cover again. */
export const FELLED = new WeakSet();
const _lo = [0, 0, 0]; // AUDIT TACT D11: the ray in a set's frame - one scratch, not one a call
const _holds = []; // TRUNK-FOES: a missile's struck points in a set's frame
/** AUDIT TACT D11: a broad-phase cell's key as a number (no string a cell a ray); cells within +-32768 of the frame's
 *  origin - 131 km at 4 m, past any pixel or room. */
const cellKey = (gx, gz) => (gx + 32768) * 65536 + (gz + 32768);
/** MEM-AUDIT (2026-10-23): a cell below this many proxies was held at its size, copied one longer a proxy. COVER-COMPACT
 *  (below) holds no cell as an array any more; the constant stays for what imports it. */
export const CELL_EXACT = 16;

// COVER-COMPACT (2026-10-26, bible/07-Rendering/Performance-Priority.md): A SET IS COLUMNS. The index was the largest thing a
// streamed world kept (237 MB of ~735 MB live at 121 pixels), a Map entry and a small array a cell. A set holds its cover
// by proxy index: the base array by reference (FELLED and `noCover` key on it), radius, height and lift as Float64
// (Float32 would move an answer), a ray's mark as Int32. A grid is three sorted typed lists: cell keys, where each
// cell's references start, and the references. A build merges new references behind old ones, so a cell keeps filing order.
// A `fill` builds when what waits is at least half of what is built; a read builds the rest. Building at every fill made
// grouped adds quadratic (300 adds of 40 flats: 5 -> 185 ms); building only at a read left unread sets as plain arrays.
const NO_F64 = new Float64Array(0),
  NO_I32 = new Int32Array(0);
/** A grid of no cells; `pk`/`pi` are the keys and indices filed since its lists were built. */
const freshCells = () => ({ keys: NO_F64, off: new Int32Array(1), idx: NO_I32, pk: [], pi: [] });
function fileIn(cells, k, i) {
  cells.pk.push(k);
  cells.pi.push(i);
}
/** The first cell whose key is `k` or past it. */
function firstAt(keys, k) {
  let lo = 0,
    hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (keys[mid] < k) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
/** The references' positions sorted by cell, a cell's own in the order filed. Each is one number - its key past the
 *  least, times the count, plus its position - so a typed sort orders them with no comparator; a spread too wide for
 *  that to stay exact takes the comparator (Array's sort is stable). */
function filingOrder(pk) {
  const added = pk.length;
  let least = Infinity,
    most = -Infinity;
  for (const k of pk) {
    if (k < least) least = k;
    if (k > most) most = k;
  }
  if ((most - least + 1) * added >= Number.MAX_SAFE_INTEGER)
    return Array.from({ length: added }, (_, j) => j).sort((a, b) => pk[a] - pk[b]);
  const packed = new Float64Array(added);
  for (let j = 0; j < added; j++) packed[j] = (pk[j] - least) * added + j;
  packed.sort();
  const order = new Int32Array(added);
  for (let j = 0; j < added; j++) order[j] = packed[j] % added;
  return order;
}
/** The grid's lists rebuilt with the references filed since: those sorted by cell (a stable sort keeps a cell's own in
 *  the order filed) and merged behind the old, a cell's old references first. */
function buildCells(cells) {
  const pk = cells.pk,
    pi = cells.pi,
    added = pk.length;
  if (!added) return;
  const order = filingOrder(pk);
  const keys = cells.keys,
    off = cells.off,
    idx = cells.idx,
    total = idx.length + added;
  const refKeys = new Float64Array(total),
    refs = new Int32Array(total);
  let c = 0,
    j = 0,
    m = 0;
  while (c < keys.length || j < added) {
    if (j >= added || (c < keys.length && keys[c] <= pk[order[j]])) {
      for (let q = off[c]; q < off[c + 1]; q++) {
        refKeys[m] = keys[c];
        refs[m++] = idx[q];
      }
      c++;
    } else {
      refKeys[m] = pk[order[j]];
      refs[m++] = pi[order[j]];
      j++;
    }
  }
  let cellCount = 0;
  for (let q = 0; q < total; q++) if (q === 0 || refKeys[q] !== refKeys[q - 1]) cellCount++;
  const newKeys = new Float64Array(cellCount),
    newOff = new Int32Array(cellCount + 1);
  for (let q = 0, u = -1; q < total; q++) {
    if (q === 0 || refKeys[q] !== refKeys[q - 1]) {
      newKeys[++u] = refKeys[q];
      newOff[u] = q;
    }
  }
  newOff[cellCount] = total;
  cells.keys = newKeys;
  cells.off = newOff;
  cells.idx = refs;
  cells.pk = [];
  cells.pi = [];
}
/** A Float64 column of `n` slots holding `a`'s first ones. */
function resized(a, n) {
  const b = new Float64Array(n);
  b.set(a.length > n ? a.subarray(0, n) : a);
  return b;
}
/** A set's next ray stamp for `mark` - wrapped before the Int32 runs out, every mark cleared with it. */
function nextStamp(set, stampKey, markKey) {
  if (set[stampKey] === 0x7fffffff) {
    set[markKey].fill(0);
    set[stampKey] = 0;
  }
  return ++set[stampKey];
}

/** TACT1: cover is read with the Enhanced AI switch on - this module is the switch's one reader for it, so a host
 *  stands its index without seeing the switch (enhancedAI4's AUDIT 55 holds who may). */
export const coverSwitchOn = () => getPref('enhancedAI') === true;

/**
 * @typedef {{ keys: Float64Array, off: Int32Array, idx: Int32Array, pk: number[], pi: number[] }} CoverCells
 * @typedef {{ n: number, bases: any[], r: Float64Array, h: Float64Array, lift: Float64Array, mark: Int32Array,
 *   stamp: number, t: () => number[], grid: CoverCells, wide: CoverCells, wideR: number, min: number[], max: number[],
 *   bodies: any[], bodyN: number, bodyCells: CoverCells, bodyMark: Int32Array, bodyStamp: number, bodyBox: number[],
 *   dirty: boolean }} CoverSet
 */

/** The cover index. `enabled` - is cover read at all (by default the Enhanced AI switch). @param {{ enabled?: () => boolean }} [opts] */
export function createCoverIndex({ enabled = coverSwitchOn } = {}) {
  /** @type {Map<any, CoverSet>} */
  const sets = new Map();
  /** IC-SWAP-BEHIND (scenes/swapBehind.js): the keys whose sets are HELD - filled but in no query - and those sets, until
   *  `wake` puts them in under their pixel's own key. @type {Set<any>} */
  const holding = new Set();
  /** @type {Map<any, any>} */
  const held = new Map();
  const setsOf = (/** @type {any} */ key) => (holding.has(key) ? held : sets);

  /** A set of no proxies yet, `t` its frame's translation - in the index once placed (add, place).
   *  @returns {CoverSet} */
  const fresh = (t) => ({
    n: 0,
    bases: [],
    r: NO_F64,
    h: NO_F64,
    lift: NO_F64,
    mark: NO_I32,
    stamp: 0,
    t: t || (() => ZERO3),
    grid: freshCells(),
    wide: freshCells(),
    wideR: 0,
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    bodies: [],
    bodyN: 0,
    bodyCells: freshCells(),
    bodyMark: NO_I32,
    bodyStamp: 0,
    bodyBox: [Infinity, Infinity, -Infinity, -Infinity],
    dirty: false,
  });
  /** Add proxies to the set `key` (appended to what it holds); `t` its frame's translation. */
  function add(key, items, t = null) {
    const into = setsOf(key);
    let set = into.get(key);
    if (!set) into.set(key, (set = fresh(t)));
    return fill(set, items);
  }
  /** Proxies into a set, placed or not. */
  function fill(set, items) {
    for (const it of items) {
      if (!(it?.r > 0) || !(it.h > 0) || !it.c || it.c.noCover) continue; // AUDIT TACT B3: a person is no cover
      set.dirty = true;
      if (it.body) {
        fileBody(set, it);
        continue;
      } // PROP-BODIES: a body, never cover
      const i = set.n++;
      if (i >= set.r.length) {
        const room = Math.max(16, i + (i >> 1));
        set.r = resized(set.r, room);
        set.h = resized(set.h, room);
        set.lift = resized(set.lift, room);
      }
      set.bases.push(it.c);
      set.r[i] = it.r;
      set.h[i] = it.h;
      set.lift[i] = it.lift ?? 0;
      const [x, y, z] = it.c;
      set.min[0] = Math.min(set.min[0], x - it.r);
      set.max[0] = Math.max(set.max[0], x + it.r);
      set.min[1] = Math.min(set.min[1], y - 64);
      set.max[1] = Math.max(set.max[1], y + (it.lift ?? 0) + it.h + 64); // slack, not a bound
      set.min[2] = Math.min(set.min[2], z - it.r);
      set.max[2] = Math.max(set.max[2], z + it.r);
      if (it.r > COVER_CELL) {
        // TREE-1: a wide proxy, once, under its centre
        fileIn(set.wide, cellKey(Math.floor(x / COVER_WIDE), Math.floor(z / COVER_WIDE)), i);
        if (it.r > set.wideR) set.wideR = it.r;
        continue;
      }
      for (let gx = Math.floor((x - it.r) / COVER_CELL); gx <= Math.floor((x + it.r) / COVER_CELL); gx++) {
        for (let gz = Math.floor((z - it.r) / COVER_CELL); gz <= Math.floor((z + it.r) / COVER_CELL); gz++)
          fileIn(set.grid, cellKey(gx, gz), i);
      }
    }
    if (set.dirty && 2 * waiting(set) >= built(set)) seal(set);
    return set.n;
  }

  /** PROP-BODIES: a body into its set's own grid - every cell its foot circle touches, so a query reaching the circle
   *  meets one of them. */
  function fileBody(set, it) {
    const [x, , z] = it.c;
    const i = set.bodyN++,
      box = set.bodyBox;
    set.bodies.push(it);
    box[0] = Math.min(box[0], x - it.r);
    box[1] = Math.min(box[1], z - it.r);
    box[2] = Math.max(box[2], x + it.r);
    box[3] = Math.max(box[3], z + it.r);
    for (let gx = Math.floor((x - it.r) / COVER_CELL); gx <= Math.floor((x + it.r) / COVER_CELL); gx++) {
      for (let gz = Math.floor((z - it.r) / COVER_CELL); gz <= Math.floor((z + it.r) / COVER_CELL); gz++)
        fileIn(set.bodyCells, cellKey(gx, gz), i);
    }
  }

  /** COVER-COMPACT: the references a set holds waiting for its next build, and those built. */
  const waiting = (set) => set.grid.pk.length + set.wide.pk.length + set.bodyCells.pk.length;
  const built = (set) => set.grid.idx.length + set.wide.idx.length + set.bodyCells.idx.length;

  /** COVER-COMPACT: a set filled since its last build, made readable - its columns cut to their length, its grids'
   *  lists built, its marks one a proxy. */
  function seal(set) {
    set.dirty = false;
    const n = set.n;
    if (set.r.length !== n) {
      set.r = resized(set.r, n);
      set.h = resized(set.h, n);
      set.lift = resized(set.lift, n);
    }
    set.bases = set.bases.slice(); // an exact copy: a pushed array keeps up to half again in slack
    set.bodies = set.bodies.slice();
    if (set.mark.length !== n) set.mark = new Int32Array(n);
    if (set.bodyMark.length !== set.bodyN) set.bodyMark = new Int32Array(set.bodyN);
    buildCells(set.grid);
    buildCells(set.wide);
    buildCells(set.bodyCells);
  }

  /** PROP-BODIES: every body whose foot circle, widened by `reach`, holds the point `p` (x and z), handed to `visit`
   *  with its foot in the world's frame (x, the bottom of its span, z) - once each; a felled tree's and a person's none. */
  function near(p, reach, visit) {
    for (const set of sets.values()) {
      if (!set.bodyN) continue;
      if (set.dirty) seal(set);
      const t = set.t(),
        x = p[0] - t[0],
        z = p[2] - t[2];
      const box = set.bodyBox; // TRUNK-FOES: each foe asks every set a frame - one nowhere near is passed
      if (x + reach < box[0] || x - reach > box[2] || z + reach < box[1] || z - reach > box[3]) continue;
      const stamp = nextStamp(set, 'bodyStamp', 'bodyMark'),
        mark = set.bodyMark;
      const { keys, off, idx } = set.bodyCells;
      const gz0 = Math.floor((z - reach) / COVER_CELL),
        gz1 = Math.floor((z + reach) / COVER_CELL);
      for (let gx = Math.floor((x - reach) / COVER_CELL); gx <= Math.floor((x + reach) / COVER_CELL); gx++) {
        const last = cellKey(gx, gz1);
        for (let cell = firstAt(keys, cellKey(gx, gz0)); cell < keys.length && keys[cell] <= last; cell++) {
          for (let q = off[cell]; q < off[cell + 1]; q++) {
            const i = idx[q];
            if (mark[i] === stamp) continue;
            mark[i] = stamp;
            const it = set.bodies[i],
              c = it.c;
            if (FELLED.has(c) || c.noCover) continue;
            const dx = x - c[0],
              dz = z - c[2],
              R = it.r + reach;
            if (dx * dx + dz * dz < R * R) visit(it, c[0] + t[0], c[1] + t[1] + (it.lift ?? 0), c[2] + t[2]);
          }
        }
      }
    }
  }

  function remove(key) {
    sets.delete(key);
    held.delete(key);
  } // IC-SWAP-BEHIND: a held set too
  /** AUDIT PRECIP HOST-7: a set built aside (`staged`, filled a slice at a time with `fill`) put in for `key` in one
   *  step, whatever it held before - a pixel re-skinned in place trades its cover as it trades its flats, never a frame
   *  with neither or both. */
  function place(key, set) {
    setsOf(key).set(key, set);
  }
  /** IC-SWAP-BEHIND: every set put in under `key` from now is held - in no query - until `wake`. */
  function hold(key) {
    holding.add(key);
  }
  /** IC-SWAP-BEHIND: the held set under `from` (if one was filled) answers as `to`'s from now, in one step. */
  function wake(from, to) {
    holding.delete(from);
    const set = held.get(from);
    held.delete(from);
    if (set) sets.set(to, set);
  }
  /** IC-SWAP-BEHIND: a held key let go, its set with it (a build behind that failed). */
  function unhold(key) {
    holding.delete(key);
    held.delete(key);
  }

  /** The nearest cover along the unit ray `dir` from `origin` within `maxDist`; Infinity for none. `sight`: the ray
   *  is a line of sight to a target at `maxDist`, which a proxy holding that end does not hide (AUDIT TACT B2).
   *  TRUNK-FOES: `holds` a missile's struck bodies' points (world frame, flat x, y, z - systems/spellcast.js struckPoints). */
  function hit(origin, dir, maxDist, sight = false, holds = null) {
    if (!(maxDist > 0) || !sets.size) return Infinity;
    let best = Infinity;
    const lo = _lo;
    const endAt = sight ? maxDist : null;
    for (const set of sets.values()) {
      if (set.dirty) seal(set);
      const t = set.t();
      lo[0] = origin[0] - t[0];
      lo[1] = origin[1] - t[1];
      lo[2] = origin[2] - t[2];
      const nHolds = holds?.length ?? 0;
      for (let k = 0; k < nHolds; k++) _holds[k] = holds[k] - t[k % 3];
      const reach = Math.min(maxDist, best);
      const ex = lo[0] + dir[0] * reach,
        ez = lo[2] + dir[2] * reach;
      if (Math.max(lo[0], ex) < set.min[0] || Math.min(lo[0], ex) > set.max[0]) continue;
      if (Math.max(lo[2], ez) < set.min[2] || Math.min(lo[2], ez) > set.max[2]) continue;
      const stamp = nextStamp(set, 'stamp', 'mark'),
        mark = set.mark;
      const bases = set.bases,
        rs = set.r,
        hs = set.h,
        lifts = set.lift;
      const gx0 = Math.floor(Math.min(lo[0], ex) / COVER_CELL),
        gx1 = Math.floor(Math.max(lo[0], ex) / COVER_CELL);
      const gz0 = Math.floor(Math.min(lo[2], ez) / COVER_CELL),
        gz1 = Math.floor(Math.max(lo[2], ez) / COVER_CELL);
      const grid = set.grid;
      for (let gx = gx0; gx <= gx1; gx++) {
        const last = cellKey(gx, gz1);
        for (
          let cell = firstAt(grid.keys, cellKey(gx, gz0));
          cell < grid.keys.length && grid.keys[cell] <= last;
          cell++
        ) {
          for (let q = grid.off[cell]; q < grid.off[cell + 1]; q++) {
            const i = grid.idx[q];
            if (mark[i] === stamp) continue;
            mark[i] = stamp;
            const s = rayUpright(
              lo,
              dir,
              bases[i],
              rs[i],
              hs[i],
              lifts[i],
              Math.min(maxDist, best),
              endAt,
              _holds,
              nHolds,
            );
            if (s < best) best = s;
          }
        }
      }
      if (set.wideR > 0) {
        // TREE-1: the wide proxies whose centre stands within the widest radius of the ray's box
        const R = set.wideR,
          wide = set.wide;
        const wx0 = Math.floor((Math.min(lo[0], ex) - R) / COVER_WIDE),
          wx1 = Math.floor((Math.max(lo[0], ex) + R) / COVER_WIDE);
        const wz0 = Math.floor((Math.min(lo[2], ez) - R) / COVER_WIDE),
          wz1 = Math.floor((Math.max(lo[2], ez) + R) / COVER_WIDE);
        for (let gx = wx0; gx <= wx1; gx++) {
          const last = cellKey(gx, wz1);
          for (
            let cell = firstAt(wide.keys, cellKey(gx, wz0));
            cell < wide.keys.length && wide.keys[cell] <= last;
            cell++
          ) {
            for (let q = wide.off[cell]; q < wide.off[cell + 1]; q++) {
              const i = wide.idx[q];
              const s = rayUpright(
                lo,
                dir,
                bases[i],
                rs[i],
                hs[i],
                lifts[i],
                Math.min(maxDist, best),
                endAt,
                _holds,
                nHolds,
              );
              if (s < best) best = s;
            }
          }
        }
      }
    }
    return best;
  }

  return {
    add,
    remove,
    hit,
    fill,
    place,
    near,
    hold,
    wake,
    unhold,
    /** AUDIT PRECIP HOST-7: a set of no proxies, outside the index until it is placed. */
    staged: (t = null) => fresh(t),
    /** Is cover read at all (the Enhanced AI switch). */
    on: () => !!enabled(),
    /** How many proxies, over every set (tests, probes). */
    size: () => {
      let n = 0;
      for (const s of sets.values()) n += s.n;
      return n;
    },
    /** AUDIT BANTHA1 TREE-1: how many references the grids hold, over every set (tests, probes) - a wide proxy is one. */
    refs: () => {
      let n = 0;
      for (const s of sets.values()) for (const g of [s.grid, s.wide]) n += g.idx.length + g.pk.length;
      return n;
    },
    has: (key) => sets.has(key),
    /** PROP-BODIES: how many bodies, over every set (tests, probes). */
    bodies: () => {
      let n = 0;
      for (const s of sets.values()) n += s.bodyN;
      return n;
    },
  };
}

/**
 * The one question every reader asks: how far along the unit ray `dir` from `origin` does the collider's `cover`
 * stop it, within `maxDist` - Infinity when the collider has no cover, cover is off (the Enhanced AI switch), or
 * nothing stands in the way.
 */
export function coverDistance(collider, origin, dir, maxDist, sight = false, holds = null) {
  const cover = collider?.cover;
  if (!cover || !cover.on()) return Infinity;
  return cover.hit(origin, dir, maxDist, sight, holds); // AUDIT TACT B2: `sight` - a line of sight to a target at maxDist; TRUNK-FOES: `holds`
}

/**
 * AUDIT TACT B5: A MISSILE MEETS COVER AS IT MEETS A BODY - BY TOUCH. A wall is met at the step's whole reach (`swept`: by touch; DFU's
 * own sweep); cover answered the same way ate every shot at someone standing in front of a trunk whenever a frame's
 * step crossed both (a 20 fps arrow never struck a player half a metre before a tree). So: the missile stops on cover
 * only when its own radius touches it (`cov <= radius`); short of that, it is advanced only as far as the touch (the
 * step's `along`, in the step's own units), and the body tests run there first.
 * `cov` the cover's distance along the unit ray, `wall` the collider's, `reach` the step's reach (its length in unit
 * terms plus `radius`), `stepLen` |dir| x step. Answers { stop } - the distance it stops at (Infinity: it does not) -
 * and { advance } - the share of the step to take (1: all of it).
 */
export function coverStep(cov, wall, reach, radius, stepLen, swept = false) {
  if (swept) return coverStep(Math.min(cov, wall), Infinity, reach, radius, stepLen); // WALL-SHAFT: a swept shaft meets a wall by touch too
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
