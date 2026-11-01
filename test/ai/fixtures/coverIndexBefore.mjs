// @ts-check
// COVER-COMPACT (bible/07-Rendering/Performance-Priority.md): the cover index as it stood before its sets became typed
// columns - src/ai/cover.js at perf-base-9aa6bc46, its `createCoverIndex` copied unchanged (the switch's default
// dropped: the caller passes `enabled`). test/ai/coverCompact.test.js fills this and the live index from one fixture and
// holds every answer equal. Not a test file: the suite runs `*.test.js` only. PIN MOVED (AUDIT FB1031 F1): a proxy is
// asked the live ray law (`rayCylinder` - a ray with an end inside meets it at its middle); what is held equal is the index.
import { COVER_CELL, COVER_WIDE, FELLED, rayCylinder } from '../../../src/ai/cover.js';

const ZERO3 = Object.freeze([0, 0, 0]);
const _lo = [0, 0, 0];   // AUDIT TACT D11: the ray in a set's frame - one scratch, not one a call
/** AUDIT TACT D11: a broad-phase cell's key as a number (no string a cell a ray); cells within +-32768 of the frame's
 *  origin - 131 km at 4 m, past any pixel or room. */
const cellKey = (gx, gz) => (gx + 32768) * 65536 + (gz + 32768);
/** MEM-AUDIT (2026-10-23): A CELL IS HELD AT ITS SIZE WHILE IT IS SMALL. The index was the largest thing a streamed world
 *  kept - ~290 MB of the 1.16 GB live heap at Knightstale's 121 pixels (V8's sampling profile, `fill` and the proxies) -
 *  and most of it air: a cell grown by push from [] has seventeen slots from its first (AUDIT C4), and most cells hold
 *  one to three proxies. Below CELL_EXACT a cell is copied one longer, in the same order, so it holds exactly its own; past it, pushed.
 *  A ray, a body's query and the probes read the same proxies in the same order. */
const CELL_EXACT = 16;
function fileIn(grid, k, it) {
  const cell = grid.get(k);
  if (!cell) { grid.set(k, [it]); return; }
  if (cell.length >= CELL_EXACT) { cell.push(it); return; }
  grid.set(k, cell.concat([it]));   // AUDIT MEM-AUDIT C3: packed and exact - one array shape, as the pushed cells were (a holey copy made the ray's loop polymorphic)
}
// MEM-AUDIT: and every proxy's maker gives it the index's `_mark` at birth, last of its keys (coverProxy, coverProxies,
// propBodies.js, the jungle's) - added first by `fill` (which still zeroes it: a proxy may be filed in two indexes), it was
// a map transition and an out-of-line property array a proxy (AUDIT C4), a million and a half of them at Knightstale.

/** TACT1: cover is read with the Enhanced AI switch on - this module is the switch's one reader for it, so a host
 *  stands its index without seeing the switch (enhancedAI4's AUDIT 55 holds who may). */

/**
 * The cover index.
 * @param {{ enabled?: () => boolean }} [opts] `enabled` - is cover read at all (by default the Enhanced AI switch)
 */
export function createCoverIndexBefore({ enabled = () => true } = {}) {
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
        fileIn(set.wide, cellKey(Math.floor(x / COVER_WIDE), Math.floor(z / COVER_WIDE)), it);
        if (it.r > set.wideR) set.wideR = it.r;
        continue;
      }
      for (let gx = Math.floor((x - it.r) / COVER_CELL); gx <= Math.floor((x + it.r) / COVER_CELL); gx++) {
        for (let gz = Math.floor((z - it.r) / COVER_CELL); gz <= Math.floor((z + it.r) / COVER_CELL); gz++) fileIn(set.grid, cellKey(gx, gz), it);
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
      for (let gz = Math.floor((z - it.r) / COVER_CELL); gz <= Math.floor((z + it.r) / COVER_CELL); gz++) fileIn(set.bodies, cellKey(gx, gz), it);
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

