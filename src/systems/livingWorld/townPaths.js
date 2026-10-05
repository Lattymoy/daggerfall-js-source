// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE TOWN'S WAYS - a resident's walk from one place to another,
// on the town's own CityNavigation grid (world/cityNavigation.js, DFU's navgrid: 1.6 m cells, a building's footprint
// weight 0, the ground's weight by its tile). DFU's walkers never path - they seek a neighbour by weight - so this is
// the port's: an A* over the same grid, four neighbours as the walkers step, each step's cost the tile's weight read
// the way DFU reads it ("Roads are great!" - a road the cheapest, stone the dearest), so a resident keeps to the
// streets as DFU's walkers lean to them. Only the STATIC weight is read (`weightAt` drops the walkers' occupancy flag):
// the same grid answers the same way for every reader, and a path is the same path on every client.
//
// PURE but for its scratch: each grid keeps one set of search arrays (a stamp per search, so nothing is cleared), so
// a town's thousand walks a day allocate nothing past the first.
import { NAV_CELL, HALF_CELL } from '../../world/cityNavigation.js';

/** A step's cost by its tile's weight: a road (15) 1, grass (12) 1.3, the average (7) 1.8, dirt (6) 1.9, stone (4) 2.1. */
export const stepCost = (weight) => 1 + (15 - weight) / 10;
/** The most cells one search opens before it gives up (a walk across the largest city opens a few thousand). */
export const PATH_MAX_EXPANSIONS = 120000;

/** LW-PERF: a step's cost by the tile's weight (0: no step), read once - the search's hot loop reads the table. */
const STEP_COST = Float64Array.from({ length: 16 }, (_, w) => (w > 0 ? stepCost(w) : 0));

/** @type {WeakMap<object, { stamp: Int32Array, g: Float32Array, from: Int32Array, closed: Int32Array, heap: Int32Array, f: Float32Array, order: Int32Array, search: number }>} */
const scratchOf = new WeakMap();
function scratch(nav) {
  const n = nav.width * nav.height;
  let s = scratchOf.get(nav);
  if (!s || s.stamp.length !== n) {
    s = { stamp: new Int32Array(n), g: new Float32Array(n), from: new Int32Array(n), closed: new Int32Array(n),
      heap: new Int32Array(n), f: new Float32Array(n), order: new Int32Array(n), search: 0 };
    scratchOf.set(nav, s);
  }
  return s;
}

/**
 * LW-PERF: ONE SEARCH, RUN IN SLICES - the A* of `findTownPath`, resumable: `step(n)` opens at most `n` more cells and
 * answers the cells found (both ends included), null (no way, or past `maxExpansions`), or undefined while it is still
 * under way; `spent` the cells the last step opened. Sliced or whole, the same answer: the same order of cells opened,
 * the same ties broken by the order they were opened in. The grid's scratch is shared - a search another one ran over
 * since its last step begins again (the answer the same, only later).
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number, grid?: Uint8Array }} nav
 * @param {number[]} a - [gx, gy] @param {number[]} b - [gx, gy]
 * @param {{ maxExpansions?: number }} [opts]
 * @returns {{ step: (n: number) => (number[][]|null|undefined), spent: number }}
 */
export function townPathSearch(nav, a, b, { maxExpansions = PATH_MAX_EXPANSIONS } = {}) {
  const W = nav.width, H = nav.height;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  if (!a || !b || !inb(a[0], a[1]) || !inb(b[0], b[1]) || !(nav.weightAt(a[0], a[1]) > 0) || !(nav.weightAt(b[0], b[1]) > 0)) {
    return { step: () => null, spent: 0 };
  }
  const start = a[1] * W + a[0], goal = b[1] * W + b[0];
  if (start === goal) return { step: () => [[a[0], a[1]]], spent: 0 };
  // the grid's own bytes when it has them (CityNavigation: the weight in the high nibble), else its reader
  const grid = nav.grid instanceof Uint8Array && nav.grid.length === W * H ? nav.grid : null;
  const bx = b[0], by = b[1];
  const s = scratch(nav);
  const { stamp, g, from, closed, heap, f, order } = s;
  let id = 0, size = 0, opened = 0, expansions = 0;
  /** @type {number[][]|null|undefined} */
  let answer;
  const begin = () => {
    id = ++s.search;
    size = 0; opened = 0; expansions = 0;
    stamp[start] = id; g[start] = 0; from[start] = -1; f[start] = Math.abs(a[0] - bx) + Math.abs(a[1] - by); order[start] = opened++;
    heap[size++] = start;
  };
  begin();
  const search = {
    spent: 0,
    /** @param {number} n */
    step(n) {
      search.spent = 0;
      if (answer !== undefined) return answer;
      if (s.search !== id) begin();   // another search ran over the scratch: this one again
      let budget = n;
      while (size > 0) {
        // pop: the least f, ties by the order opened
        const cur = heap[0];
        const last = heap[--size];
        if (size > 0) {
          let k = 0;
          const lf = f[last], lo = order[last];
          for (;;) {
            const l = 2 * k + 1;
            if (l >= size) break;
            const r = l + 1;
            let m = l;
            if (r < size && (f[heap[r]] < f[heap[l]] || (f[heap[r]] === f[heap[l]] && order[heap[r]] < order[heap[l]]))) m = r;
            const mi = heap[m];
            if (!(f[mi] < lf || (f[mi] === lf && order[mi] < lo))) break;
            heap[k] = mi; k = m;
          }
          heap[k] = last;
        }
        if (closed[cur] === id) continue;
        closed[cur] = id;
        if (cur === goal) {
          const out = [];
          for (let i = cur; i !== -1; i = from[i]) out.push([i % W, (i / W) | 0]);
          answer = out.reverse();
          return answer;
        }
        if (++expansions > maxExpansions) { answer = null; return null; }
        search.spent++;
        const cx = cur % W, cy = (cur / W) | 0, gc = g[cur];
        // the four neighbours in the walkers' own order: +y, -y, +x, -x
        for (let d = 0; d < 4; d++) {
          const nx = d === 2 ? cx + 1 : d === 3 ? cx - 1 : cx;
          const ny = d === 0 ? cy + 1 : d === 1 ? cy - 1 : cy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          const w = grid ? grid[ni] >> 4 : nav.weightAt(nx, ny);
          if (!(w > 0)) continue;
          if (closed[ni] === id) continue;
          const ng = gc + (grid ? STEP_COST[w] : stepCost(w));
          if (stamp[ni] === id && ng >= g[ni]) continue;
          stamp[ni] = id; g[ni] = ng; from[ni] = cur;
          f[ni] = ng + Math.abs(nx - bx) + Math.abs(ny - by); order[ni] = opened++;
          const fi = f[ni];   // as kept (the scratch's own precision): the order the whole search keeps
          // push: up while less than its parent - the cell pushed is the last opened, so a tie never lifts it
          let k = size++;
          while (k > 0) {
            const p = (k - 1) >> 1;
            const pi = heap[p];
            if (!(fi < f[pi])) break;
            heap[k] = pi; k = p;
          }
          heap[k] = ni;
        }
        if (--budget <= 0) return undefined;
      }
      answer = null;
      return null;
    },
  };
  return search;
}

/**
 * The cheapest four-neighbour way from cell `a` to cell `b` over cells of weight above zero - the cells, both ends
 * included - or null (an end unwalkable, no way between, or the search past `maxExpansions`). Ties break on the order
 * cells were opened, so the answer is one answer. LW-PERF: the whole search at once (`townPathSearch`, unsliced).
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number, grid?: Uint8Array }} nav
 * @param {number[]} a - [gx, gy] @param {number[]} b - [gx, gy]
 * @param {{ maxExpansions?: number }} [opts]
 * @returns {number[][]|null}
 */
export function findTownPath(nav, a, b, opts = {}) {
  return townPathSearch(nav, a, b, opts).step(Infinity) ?? null;
}

/**
 * A path's cells as the walked line: the cell centres where it turns, both ends kept (location-frame metres, the
 * navgrid's own `navToWorld`), and its length.
 * @param {number[][]} cells @returns {{ pts: number[][], len: number, cum: number[] }}
 */
export function pathLine(cells) {
  /** @type {number[][]} */
  const pts = [];
  const at = (c) => [c[0] * NAV_CELL + HALF_CELL, c[1] * NAV_CELL + HALF_CELL];
  for (let i = 0; i < cells.length; i++) {
    if (i === 0 || i === cells.length - 1) { pts.push(at(cells[i])); continue; }
    const p = cells[i - 1], c = cells[i], n = cells[i + 1];
    if ((c[0] - p[0]) !== (n[0] - c[0]) || (c[1] - p[1]) !== (n[1] - c[1])) pts.push(at(c));
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len: cum[cum.length - 1] ?? 0, cum };
}

/**
 * The point `s` metres along a walked line (clamped to its ends), and the way it faces there (a world yaw: 0 is +z,
 * as the walkers' own DIR_YAW reads it).
 * @param {{ pts: number[][], len: number, cum: number[] }} line @param {number} s
 * @returns {{ x: number, z: number, yaw: number }}
 */
export function pointOnLine(line, s) {
  const { pts, cum } = line;
  if (!pts.length) return { x: 0, z: 0, yaw: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], yaw: 0 };
  const d = Math.max(0, Math.min(line.len, s));
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = cum[i] - cum[i - 1];
  const t = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

/** LW-PERF: the most walks waiting to be searched (each asked once: the census asks the same ones every beat). */
export const PATH_QUEUE_MAX = 96;

/**
 * THE TOWN'S PATH BOOK: walks asked once, kept by their two ends (most of a town's day is the same few dozen walks).
 * `get` answers a kept line or null; `want` asks for one and answers it once searched; `budget` how many new walks a
 * frame may ask for - the host spends it so a crowd arriving never costs one frame a hundred searches.
 * LW-PERF: AND HOW MUCH SEARCHING. A walk across a great city's grid opens a hundred thousand cells (~25 ms): counted
 * searches alone let one frame run several (frames of 40-120 ms in a city's morning). `cells(n)` gives a frame the cells
 * its searching may open, and the searching is the book's own: a walk asked is queued - `soon` (a resident on the
 * street, waiting on their next walk) before the rest (the census's walks coming near), each in the order asked - and
 * searched one at a time in slices (`townPathSearch`), the frame's cells spent, the rest on the next frame's (`run`, each
 * frame, spends what the asking left). Without `cells` a search runs whole, as before.
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number }} nav
 * @param {{ max?: number }} [opts]
 */
export function createPathBook(nav, { max = 768 } = {}) {
  /** @type {Map<number, { pts: number[][], len: number, cum: number[] } | null>} - kept in the order searched, the
   *  oldest leaving first past `max` */
  const book = new Map();
  const keyOf = (a, b) => ((a[1] * nav.width + a[0]) * 1048576 + (b[1] * nav.width + b[0]));
  let budget = Infinity;
  /** LW-PERF: the cells this frame's searching may still open, the cells it has, the search under way and the walks
   *  waiting (each queue in the order asked). */
  let cells = Infinity, spent = 0;
  /** @type {{ key: number, search: ReturnType<typeof townPathSearch> } | null} */
  let job = null;
  /** @type {Map<number, number[][]>} */
  const soon = new Map(), later = new Map();
  /** The next walk waiting, the soon first. */
  const nextAsked = () => {
    for (const q of [soon, later]) for (const [key, ends] of q) { q.delete(key); if (!book.has(key)) return { key, ends }; }
    return null;
  };
  /** The searching on this frame's cells: the search under way, then the walks waiting, till the cells are spent. */
  const pump = () => {
    for (;;) {
      if (!(cells > 0)) return;
      if (!job) {
        const n = nextAsked();
        if (!n) return;
        job = { key: n.key, search: townPathSearch(nav, n.ends[0], n.ends[1]) };
      }
      const found = job.search.step(cells);
      cells -= job.search.spent; spent += job.search.spent;
      if (found === undefined) return;
      book.set(job.key, found ? pathLine(found) : null);
      if (book.size > max) book.delete(book.keys().next().value);
      job = null;
    }
  };
  return {
    /** @param {number[]} a @param {number[]} b */
    get: (a, b) => book.get(keyOf(a, b)),
    /**
     * The walk from cell `a` to `b`: its line, null for no way, undefined while it waits to be searched (asked, on the
     * frame's budget; `first` a resident on the street waiting on it - before the rest).
     * @param {number[]} a @param {number[]} b @param {boolean} [first]
     */
    want(a, b, first = false) {
      const k = keyOf(a, b);
      if (book.has(k)) return book.get(k);
      if (job?.key !== k) {
        const waiting = soon.has(k) || later.has(k);
        if (!waiting) {
          if (budget <= 0 || soon.size + later.size >= PATH_QUEUE_MAX) return undefined;
          budget--;
          (first ? soon : later).set(k, [a, b]);
        } else if (first && later.has(k)) { soon.set(k, /** @type {number[][]} */ (later.get(k))); later.delete(k); }
      }
      pump();
      return book.get(k);   // undefined while it waits
    },
    /** This frame's new walks asked. @param {number} n */
    budget(n) { budget = n; },
    /** LW-PERF: a new frame - the cells its searching may open. @param {number} n */
    cells(n) { cells = n; spent = 0; },
    /** LW-PERF: the frame's searching, on what the asking left of its cells (the host calls it once a frame). */
    run() { pump(); },
    /** LW-PERF: the cells this frame's searching opened (the probes; the pins). */
    spent: () => spent,
    /** LW-PERF: the walks under way and waiting. */
    waiting: () => (job ? 1 : 0) + soon.size + later.size,
    size: () => book.size,
  };
}
