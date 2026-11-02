// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SMOOTH-LAND (2026-10-26, bible/03-World/Tamriel.md SMOOTH-LAND; the owner: "Whatever is most detailed") - THE LAW'S
// OWN LINES: every coast and every border past the Bay as the land's smooth law (world/tamriel/tamrielLand.js
// landLabelAt) draws it, at the map's own pixel.
//
// A line is where the law's label changes - the sea and a province, or two provinces. Its points lie on the edges between
// map pixels' centres whose labels differ, each found on its edge by halving it LINE_BISECT times against the law itself
// (a coast's by the land's own side, a border's by the two provinces' own distances - so a point is the law's boundary
// to a thousandth of a pixel, never a picture pixel's corner), and joined across each square of four centres as the
// squares' marching cases join them: two labels, the two crossings (a saddle by the law at the square's middle); three or
// more, each crossing to the one point where they meet (`junction`: a border on the coast's own chord where the two
// provinces' distances are equal, so it ends on the coast and the coast runs on straight; three provinces, the
// crossings' middle) - but three whose twice-held label lies on a diagonal the law's middle holds are two lines past
// each other, each cutting its own corner. A square of four picture centres all one label holds no line (the law's bound, tamrielLand.js SMOOTH-LAND),
// so the whole continent's walk visits only the map squares in the picture's squares of mixed centres; and a square is
// made the first time anything asks it (`square`) - Cyrodiil's zone asks its own outline's alone.
//
// THE ONE LINE: the held map's coasts and borders (ui/tamrielInk.js tracedChains), Cyrodiil's zone and its red line
// (systems/wild/cyrodiilZone.js zoneLineOf: the same squares, the same crossings, the same middles) - and a map pixel is
// on a line's side exactly as its centre's label says, the law's own.
// ═══════════════════════════════════════════════════════════════════
import { landLaw, landLabelAt, landSideAt, provinceLeadAt } from './tamrielLand.js';
import { tamrielFit } from './tamrielFrame.js';

/** Halvings of an edge between two centres - its crossing to 1 / 1024 of a map pixel. */
export const LINE_BISECT = 10;

/** A map pixel's key (any of the frame's, negative included); an end's id is the key times four and its kind - 0 the
 *  edge to the pixel's east, 1 the edge to its south, 2 and 3 the points where lines meet in the square it tops-left. */
const pk = (/** @type {number} */ x, /** @type {number} */ y) => (x + 32768) * 65536 + (y + 32768);
const EAST = 0,
  SOUTH = 1,
  MIDDLE = 2,
  SECOND = 3;
/** A square's end ids (its top-left pixel (bx, by)): its four edges', its meeting point's and its second's. */
export const squareEnds = (/** @type {number} */ bx, /** @type {number} */ by) => {
  const k = pk(bx, by) * 4;
  return {
    top: k + EAST,
    right: pk(bx + 1, by) * 4 + SOUTH,
    bottom: pk(bx, by + 1) * 4 + EAST,
    left: k + SOUTH,
    mid: k + MIDDLE,
    second: k + SECOND,
  };
};

/** @typedef {{ x: number, y: number }} Pt */
/** @typedef {{ a: number, b: number, kind: 'coast'|'border'|'water', pair: number, side: number[] }} Seg - its ends' ids (a
 *  crossing's edge, or a square's meeting point), what it divides (NIBEN-SEA: 'water' a zone's dam across one label's
 *  water, systems/wild/cyrodiilZone.js zoneLineSteps), the pair of labels (low * 16 + high; 0 for the zone's own), and
 *  two map pixels it divides (`[x, y, qx, qy]`, one of each label) */
/** @typedef {{ bx: number, by: number, l: number[], segs: Seg[] }} Square */

/** The tiles a map pixel's label and a square's record are kept in: TILE pixels a side. */
const TILE = 64;

/** @type {WeakMap<object, { key: string, value: any }>} */
const _lines = new WeakMap();

/**
 * THE LAW'S LINES on a trace at the live fit (kept while the trace and the fit stand): `label(bx, by)` a map pixel's,
 * `square(bx, by)` a square's record (its labels and its pieces - null where one label holds it) made the first time it
 * is asked, `points` every end's place (map coordinates, by id), and `all()` the whole continent's walk - `{ segs,
 * squares }`, every piece and every square with one, in the walk's order (made once).
 * @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace
 */
export function lawLines(trace) {
  const f = tamrielFit(),
    key = `${f.ox}:${f.oy}:${f.ppu}`;
  const hit = _lines.get(trace);
  if (hit && hit.key === key) return hit.value;
  const L = landLaw(trace),
    ox = f.ox,
    oy = f.oy,
    ppu = f.ppu;
  /** @type {Map<number, { lab: Uint8Array, rec: Int32Array }>} */
  const tiles = new Map();
  let lastKey = -1,
    last = /** @type {{ lab: Uint8Array, rec: Int32Array }|null} */ (null); // the walk asks one tile many times running
  const tileOf = (/** @type {number} */ bx, /** @type {number} */ by) => {
    const tk = pk(Math.floor(bx / TILE), Math.floor(by / TILE));
    if (tk === lastKey) return /** @type {{ lab: Uint8Array, rec: Int32Array }} */ (last);
    let t = tiles.get(tk);
    if (!t)
      tiles.set(tk, (t = { lab: new Uint8Array(TILE * TILE).fill(255), rec: new Int32Array(TILE * TILE).fill(-1) }));
    lastKey = tk;
    last = t;
    return t;
  };
  const inTile = (/** @type {number} */ v) => ((v % TILE) + TILE) % TILE;
  const picX = (/** @type {number} */ x) => (x + ox) / ppu,
    picY = (/** @type {number} */ y) => (y + oy) / ppu;
  const label = (/** @type {number} */ bx, /** @type {number} */ by) => {
    const t = tileOf(bx, by),
      i = inTile(by) * TILE + inTile(bx);
    let v = t.lab[i];
    if (v === 255) t.lab[i] = v = landLabelAt(L, picX(bx + 0.5), picY(by + 0.5));
    return v;
  };
  /** @type {Map<number, Pt>} */
  const points = new Map();
  /** An edge's crossing, from pixel (ax, ay)'s centre (label p) toward its neighbour (dx, dy) away (label q): a coast's by
   *  the land's own side, a border's by the two provinces' own distances. */
  const crossing = (
    /** @type {number} */ id,
    /** @type {number} */ ax,
    /** @type {number} */ ay,
    /** @type {number} */ dx,
    /** @type {number} */ dy,
    /** @type {number} */ p,
    /** @type {number} */ q,
  ) => {
    if (points.has(id)) return;
    const coast = p === 0 || q === 0,
      landFirst = p !== 0;
    let lo = 0,
      hi = 1;
    for (let n = 0; n < LINE_BISECT; n++) {
      const t = (lo + hi) / 2,
        x = picX(ax + 0.5 + dx * t),
        y = picY(ay + 0.5 + dy * t);
      const same = coast ? landSideAt(L, x, y) === landFirst : provinceLeadAt(L, x, y, p, q);
      if (same) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    points.set(id, { x: ax + 0.5 + dx * t, y: ay + 0.5 + dy * t });
  };
  const pairOf = (/** @type {number} */ p, /** @type {number} */ q) => (p < q ? p * 16 + q : q * 16 + p);
  /** WHERE THE LINES MEET in a square of three labels and more (its crossings `E`): where a border meets a coast (two of
   *  the crossings the coast's, a province's land past each), the point on the coast's chord between them where the two
   *  provinces' own distances are equal - found as a crossing is, so the border ends ON the coast's line and the coast
   *  runs on through it straight; three provinces and more, the crossings' middle. */
  const junction = (/** @type {Array<{ id: number, p: number, q: number }>} */ E) => {
    const coast = E.filter((e) => e.p === 0 || e.q === 0);
    const P = E.map((e) => /** @type {Pt} */ (points.get(e.id)));
    if (coast.length === 2 && E.length === 3) {
      const l1 = coast[0].p || coast[0].q,
        l2 = coast[1].p || coast[1].q;
      if (l1 !== l2) return onChord(coast[0].id, coast[1].id, l1, l2);
    }
    return { x: P.reduce((n, p) => n + p.x, 0) / P.length, y: P.reduce((n, p) => n + p.y, 0) / P.length };
  };
  /** The point on the chord between two crossings (ids `i`, `j`) where labels l1's and l2's own distances are equal -
   *  found as a crossing is (l1's side at `i`). */
  const onChord = (
    /** @type {number} */ i,
    /** @type {number} */ j,
    /** @type {number} */ l1,
    /** @type {number} */ l2,
  ) => {
    const A = /** @type {Pt} */ (points.get(i)),
      B = /** @type {Pt} */ (points.get(j));
    let lo = 0,
      hi = 1;
    for (let n = 0; n < LINE_BISECT; n++) {
      const t = (lo + hi) / 2;
      if (provinceLeadAt(L, picX(A.x + (B.x - A.x) * t), picY(A.y + (B.y - A.y) * t), l1, l2)) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
  };
  const kindOf = (/** @type {number} */ p, /** @type {number} */ q) => (p === 0 || q === 0 ? 'coast' : 'border');
  /** @type {Square[]} */
  const records = [];
  /** One square of four map pixels (its top-left (bx, by)): its record - made once - or null where one label holds it. */
  const square = (/** @type {number} */ bx, /** @type {number} */ by) => {
    const t = tileOf(bx, by),
      si = inTile(by) * TILE + inTile(bx),
      r = t.rec[si];
    if (r >= 0) return r ? records[r - 1] : null;
    const a = label(bx, by),
      b = label(bx + 1, by),
      c = label(bx + 1, by + 1),
      d = label(bx, by + 1);
    if (a === b && a === c && a === d) {
      t.rec[si] = 0;
      return null;
    }
    /** @type {Seg[]} */
    const segs = [];
    const { top, right, bottom, left, mid, second } = squareEnds(bx, by);
    // the four edges: top (a-b), right (b-c), bottom (d-c), left (a-d) - each its id, its two labels, its two pixels, its
    // crossing
    const E = [];
    if (a !== b) {
      crossing(top, bx, by, 1, 0, a, b);
      E.push({ id: top, p: a, q: b, side: [bx, by, bx + 1, by] });
    }
    if (b !== c) {
      crossing(right, bx + 1, by, 0, 1, b, c);
      E.push({ id: right, p: b, q: c, side: [bx + 1, by, bx + 1, by + 1] });
    }
    if (d !== c) {
      crossing(bottom, bx, by + 1, 1, 0, d, c);
      E.push({ id: bottom, p: d, q: c, side: [bx, by + 1, bx + 1, by + 1] });
    }
    if (a !== d) {
      crossing(left, bx, by, 0, 1, a, d);
      E.push({ id: left, p: a, q: d, side: [bx, by, bx, by + 1] });
    }
    const edge = (/** @type {number} */ i) =>
      /** @type {{ id: number, p: number, q: number, side: number[] }} */ (E.find((e) => e.id === i));
    const piece = (
      /** @type {number} */ i,
      /** @type {number} */ j,
      /** @type {{ p: number, q: number, side: number[] }} */ e,
    ) => segs.push({ a: i, b: j, kind: kindOf(e.p, e.q), pair: pairOf(e.p, e.q), side: e.side });
    const distinct = 1 + (b !== a ? 1 : 0) + (c !== a && c !== b ? 1 : 0) + (d !== a && d !== b && d !== c ? 1 : 0);
    // three labels, one of them on a diagonal (a and c, or b and d): two lines past each other where the law at the
    // square's middle holds the diagonal's label (each cutting its own corner off), else the three meet
    const twice = distinct === 3 && (a === c || b === d) ? (a === c ? a : b) : -1;
    const m = twice >= 0 || (distinct === 2 && E.length === 4) ? landLabelAt(L, picX(bx + 1), picY(by + 1)) : -1;
    if (twice >= 0 && m === twice) {
      // the twice-held label joined across the middle: the other two each a corner cut off by its own line
      for (const [i, j] of a === c
        ? [
            [top, right],
            [left, bottom],
          ]
        : [
            [top, left],
            [right, bottom],
          ])
        piece(i, j, edge(i));
    } else if (twice >= 0) {
      // the other two joined across the middle, between the twice-held label's two corners: each corner's two lines meet
      // the line between the other two where those two's distances are equal, on the chord between its crossings
      const [y, z, ends] =
        a === c
          ? [
              b,
              d,
              [
                [top, left],
                [right, bottom],
              ],
            ]
          : [
              a,
              c,
              [
                [top, right],
                [left, bottom],
              ],
            ];
      const ids = [mid, second];
      ends.forEach(([i, j], k) => {
        if (!points.has(ids[k])) points.set(ids[k], onChord(i, j, y, z));
        piece(i, ids[k], edge(i));
        piece(j, ids[k], edge(j));
      });
      piece(mid, second, { p: y, q: z, side: a === c ? [bx + 1, by, bx, by + 1] : [bx, by, bx + 1, by + 1] });
    } else if (distinct >= 3) {
      if (!points.has(mid)) points.set(mid, junction(E));
      for (const e of E) piece(e.id, mid, e);
    } else if (E.length === 2) {
      piece(E[0].id, E[1].id, E[0]);
    } else if (m === a) {
      // a saddle (a and c one label, b and d the other): the law at the square's middle says which pair is joined
      piece(top, right, edge(top));
      piece(left, bottom, edge(left));
    } else {
      piece(top, left, edge(top));
      piece(right, bottom, edge(right));
    }
    const rec = { bx, by, l: [a, b, c, d], segs };
    records.push(rec);
    t.rec[si] = records.length;
    return rec;
  };
  /** @type {{ segs: Seg[], squares: Square[] }|null} */
  let whole = null;
  /** AUDIT RELEASE R4-7: the continent's walk as steps - one picture square of mixed centres a step (its map squares
   *  labelled and made, some (ppu + 3)^2 of them), so a caller walks it a budget at a time (ui/tamrielInk.js's idle
   *  job) or whole (`all`); one walk either way, its result the same. */
  function* walkSteps() {
    /** @type {Square[]} */
    const squares = [];
    const seen = new Set();
    const { W, label: plab } = L,
      pad = (W - trace.w) / 2;
    let up = new Uint8Array(0),
      down = new Uint8Array(0);
    for (let sy = -1; sy < trace.h; sy++) {
      for (let sx = -1; sx < trace.w; sx++) {
        const i = (sy + pad) * W + sx + pad,
          a = plab[i];
        if (a === plab[i + 1] && a === plab[i + W] && a === plab[i + W + 1]) continue;
        const x0 = (sx + 0.5) * ppu - ox,
          y0 = (sy + 0.5) * ppu - oy,
          x1 = (sx + 1.5) * ppu - ox,
          y1 = (sy + 1.5) * ppu - oy;
        const bx0 = Math.floor(x0) - 1,
          bx1 = Math.ceil(x1),
          by0 = Math.floor(y0) - 1,
          by1 = Math.ceil(y1),
          n = bx1 - bx0 + 2;
        // two rows of the block's labels at a time: a square of one label is passed by, never made
        if (up.length < n) {
          up = new Uint8Array(n);
          down = new Uint8Array(n);
        }
        for (let i = 0; i < n; i++) up[i] = label(bx0 + i, by0);
        for (let by = by0; by <= by1; by++) {
          for (let i = 0; i < n; i++) down[i] = label(bx0 + i, by + 1);
          for (let bx = bx0, i = 0; bx <= bx1; bx++, i++) {
            const l = up[i];
            if (up[i + 1] === l && down[i] === l && down[i + 1] === l) continue;
            const rec = square(bx, by);
            if (rec && !seen.has(rec)) {
              seen.add(rec);
              squares.push(rec);
            }
          }
          [up, down] = [down, up];
        }
        yield;
      }
    }
    whole = { squares, segs: squares.flatMap((s) => s.segs) };
  }
  /** @type {Generator<undefined, void, unknown>|null} */
  let walker = null;
  /** The walk's steps, one generator a trace and fit: whoever advances it advances it for all. */
  const steps = () => (walker ??= walkSteps());
  const all = () => {
    if (!whole) drain(steps());
    return /** @type {{ segs: Seg[], squares: Square[] }} */ (whole);
  };
  const value = { label, square, points, all, steps, done: () => whole !== null };
  _lines.set(trace, { key, value });
  return value;
}

/** AUDIT RELEASE R4-7: run a generator of steps to its end and hand back what it returns. @template T
 *  @param {Generator<unknown, T, unknown>} gen @returns {T} */
export function drain(gen) {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}
/** AUDIT RELEASE R4-7: how many pieces the linking walks between two steps. */
export const LINK_STEP = 2048;

/** A piece's own key (its two ends, in order). @param {Seg} s */
export const segKey = (s) => (s.a < s.b ? `${s.a}|${s.b}` : `${s.b}|${s.a}`);

/**
 * THE PIECES LINKED INTO CHAINS (map coordinates): each run from an end no other piece continues (a border's end on a
 * coast's middle, a junction) to the next such end, and each closed ring with its first point again last. Deterministic:
 * the pieces' own order.
 * @param {Seg[]} segs @param {Map<number, Pt>} points @returns {Pt[][]}
 */
export function linkPieces(segs, points) {
  return drain(linkSteps(segs, points));
}
/** linkPieces as steps (AUDIT RELEASE R4-7): a step every LINK_STEP pieces indexed or walked - the same chains.
 *  @param {Seg[]} segs @param {Map<number, Pt>} points @returns {Generator<undefined, Pt[][], unknown>} */
export function* linkSteps(segs, points) {
  /** @type {Map<number, number[]>} */
  const at = new Map();
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    for (const id of [s.a, s.b]) {
      const l = at.get(id);
      if (l) l.push(i);
      else at.set(id, [i]);
    }
    if ((i + 1) % LINK_STEP === 0) yield;
  }
  const used = new Uint8Array(segs.length),
    chains = [];
  const walk = (/** @type {number} */ i, /** @type {number} */ from) => {
    const ids = [from];
    let cur = i,
      end = from;
    while (cur >= 0 && !used[cur]) {
      used[cur] = 1;
      const s = segs[cur],
        next = s.a === end ? s.b : s.a;
      ids.push(next);
      end = next;
      const list = at.get(next) ?? [];
      // continue only through an end two pieces share (a junction of three or more ends the run there)
      cur = list.length === 2 ? (list[0] === cur ? list[1] : list[0]) : -1;
    }
    return ids.map((id) => ({ .../** @type {Pt} */ (points.get(id)) }));
  };
  let walked = 0;
  const run = (/** @type {number} */ i, /** @type {number} */ from) => {
    const c = walk(i, from);
    chains.push(c);
    walked += c.length;
  };
  // the open runs first, from every end that is not a plain link (one piece, or three and more)
  for (const [id, list] of at) {
    if (list.length !== 2) for (const i of list) if (!used[i]) run(i, id);
    if (walked >= LINK_STEP) {
      walked = 0;
      yield;
    }
  }
  // then the rings
  for (let i = 0; i < segs.length; i++) {
    if (!used[i]) run(i, segs[i].a);
    if (walked >= LINK_STEP) {
      walked = 0;
      yield;
    }
  }
  return chains;
}
