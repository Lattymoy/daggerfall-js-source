// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA15 (2026-10-24, bible/03-World/Arena-Provinces.md TESA15) - THE LAND PAST THE BAY'S PAINT, KEPT A TILE AT A TIME.
//
// The held map paints its static ink again on every frame its view moves (heldMap.js: the kept layer's key is the view).
// Past the Bay that ink is the whole network TESA14 lays - 37,000 road chains and 115,000 track chains on the freeware's
// continent, and every place the regions laid - and stroked whole it is a quarter of a second a frame out on the
// continent. So it is painted once onto TILES of TILE_PX device pixels at the view's own scale (TILE-EXACT, 2026-10-29: it
// was LEVEL_STEPS levels a doubling, drawn up to a twelfth off) and the kept tiles are drawn: a pan is a drawImage a
// tile. A tile is painted again when what it shows moves - its word (`stamp`: the roads' installs and the places' adds
// over its pixels, ui/tamrielInk.js pastBayStamp) or the paint's own key (the band, the filters, the hues) - and TILES_KEPT are kept, the one drawn longest ago let go first.
// A frame paints the tiles nearest the view's middle first until TILE_BUDGET_MS is spent (one at the least); a tile still
// owed meanwhile shows what is kept of it - its last paint, else the nearest level's within STAND_IN - and the window paints
// again next frame (takePending). ZOOM-FAST (2026-10-24, the owner: "The map also is slow to load when zooming in and
// out"): a draw told not to `force` paints none while the view still moves (the window's zoom settling), and a stand-in is
// sought under the last key too, so crossing a band or the continent's line keeps the roads up while they are painted
// again. Where a canvas gives no 2D context the view is painted straight onto the sheet, as the
// window's own kept layer is (heldMap.js: `layer.getContext?.('2d')`).
// ═══════════════════════════════════════════════════════════════════

import { createCoverage } from './inkRaster.js';   // MAP-WHOLE: a job's coverage mask, the far passes rasterised by hand

/** A tile's side, device pixels. */
export const TILE_PX = 256;
/** Levels a doubling of the scale - the base's level, and how far a stand-in is sought (STAND_IN). */
export const LEVEL_STEPS = 4;
/** How many tiles are kept: three screens at a 1280 x 800 paper and twice the pixels. */
export const TILES_KEPT = 160;
/** A frame's share of painting, milliseconds. */
export const TILE_BUDGET_MS = 8;

/** MAP-WHOLE: THE BASE - the whole continent's frame painted once at one coarse level, the stand-in of last resort under
 *  any tile still owed, so the sheet past the Bay has no hole from the first frames of an open, whatever the zoom. Its
 *  scale in paper pixels a Bay pixel at one device pixel a point (the freeware's 6,000-pixel frame 1,500 device pixels
 *  across: 24 tiles, 6 MB); at two device pixels a point half of it, the same pixels. */
export const BASE_SCALE = 0.25;
/** The base's level at a device-pixel ratio. */
export const baseLevelIndex = (dpr = 1) => tileLevelIndex(BASE_SCALE / dpr);

/** How many levels either side a tile owed looks for a stand-in - two doublings. */
export const STAND_IN = 2 * LEVEL_STEPS;
/** AUDIT TESA II M3: a scale's level as its whole number of quarter-doublings - the base's id. TILE-EXACT: the view's
 *  tiles are kept under their own scale, and a stand-in is found by its scale, not by an id. */
export const tileLevelIndex = (scale) => Math.round(Math.log2(scale) * LEVEL_STEPS);
/** The level a scale is painted at: the nearest of LEVEL_STEPS a doubling. */
export const levelOf = (scale) => 2 ** (tileLevelIndex(scale) / LEVEL_STEPS);

/**
 * The tiles over a painter. `paint(ctx, view, paperW, paperH, opts, job)` paints a view (ui/tamrielInk.js paintPastBay):
 * whole, or - AUDIT TESA II M10 - it answers an iterator, and the tile is painted a step of it at a time under the frame's
 * budget, the tile owed and partial until it is done (`job.scratch()` a cleared canvas of the tile's size and transform
 * the painter may lay a translucent pass on, a step at a time, and lay down whole). `stamp` answers the word for a
 * rectangle of Bay pixels; `make` a canvas; `now` the clock a budget is spent on.
 * @param {{ paint: (ctx: any, view: { ox: number, oy: number, scale: number }, paperW: number, paperH: number, opts: any, job?: { scratch: () => any, coverage?: () => any, pixels?: () => Uint8ClampedArray }) => any,
 *   stamp: (x0: number, y0: number, x1: number, y1: number) => string, make?: () => any, now?: () => number, kept?: number }} o
 */
export function createTamrielTiles({ paint, stamp, make = () => document.createElement('canvas'), now = () => performance.now(), kept = TILES_KEPT }) {
  /** A tile: `canvas` its last whole paint (null before the first), `word` that paint's word, `job` a paint under way.
   *  @type {Map<string, { canvas: any, word: ?string, job: any, x0: number, y0: number, span: number, key?: string, level?: number, dpr?: number }>} */
  const tiles = new Map();
  /** MAP-WHOLE: the base's tiles (BASE_SCALE), its own map - never let go while the window is open (clear lets it go),
   *  never counted against TILES_KEPT; `baseFor` the base's key, level and frame it was asked for. */
  const baseTiles = new Map();
  let baseFor = '', baseWordsAt = null;
  const spare = [], SPARE = 16;   // a let-go tile's canvas, painted over by the next new one
  const covSpare = [], COV_SPARE = 4;   // MAP-WHOLE: a finished job's coverage mask (a megabyte), the next job's
  let pixels = null;   // MAP-WHOLE: one tile's RGBA, filled and put at once (a pass's lay), shared by every job
  const releaseCov = (job) => { if (job?.cov && covSpare.length < COV_SPARE) covSpare.push(job.cov); if (job) job.cov = null; };
  let pending = false, usable = null, curKey = null, prevKey = null;
  /** MAP-WHOLE (the probe's read, tools/heldMapLoadProbe.mjs): the last draw's tiles - wanted, painted whole in it, shown
   *  by a stand-in, and HOLES (owed with nothing kept to show) - and whether it left one owed. */
  let last = { want: 0, painted: 0, stood: 0, holes: 0, owed: false };
  const idOf = (key, n, dpr, tx, ty) => `${key}|${n}|${dpr}|${tx}|${ty}`;
  const release = (canvas) => { if (canvas && spare.length < SPARE) spare.push(canvas); };
  /** A canvas of the tile's size, cleared, its context at the tile's transform. */
  const blank = (canvas, dpr) => {
    if (canvas.width !== TILE_PX) canvas.width = TILE_PX;
    if (canvas.height !== TILE_PX) canvas.height = TILE_PX;
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, TILE_PX, TILE_PX);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  };
  /** A kept tile onto the sheet at its own rectangle - its edges on whole device pixels, so tiles meet without a seam.
   *  TILE-EXACT: a tile painted at the view's own scale is laid pixel for pixel, smoothing off - a resample blurred every
   *  line past the Bay against the Bay's own. Its origin is the grid's, so a neighbour starts TILE_PX on exactly. */
  function place(ctx, view, dpr, t) {
    if (t.level === view.scale) {
      const o = view.scale * dpr, tx = Math.round(t.x0 / t.span), ty = Math.round(t.y0 / t.span);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t.canvas, Math.round(tx * TILE_PX - view.ox * o) / dpr, Math.round(ty * TILE_PX - view.oy * o) / dpr, TILE_PX / dpr, TILE_PX / dpr);
      ctx.imageSmoothingEnabled = smooth;
      return;
    }
    const s = view.scale, snap = (v) => Math.round(v * dpr) / dpr;
    const x0 = snap((t.x0 - view.ox) * s), y0 = snap((t.y0 - view.oy) * s);
    const x1 = snap((t.x0 + t.span - view.ox) * s), y1 = snap((t.y0 + t.span - view.oy) * s);
    ctx.drawImage(t.canvas, x0, y0, x1 - x0, y1 - y0);
  }
  /** A tile's paint begun: its own canvas (the last whole paint keeps showing until this one is done) and the painter's
   *  steps, or none where it painted whole. */
  function begin(x0, y0, span, level, dpr, word, opts) {
    const canvas = spare.pop() ?? make();
    const c = blank(canvas, dpr);
    const job = { canvas, scratch: null, cov: null, word, it: null, done: false };
    const it = paint(c, { ox: x0, oy: y0, scale: level }, TILE_PX / dpr, TILE_PX / dpr, opts, {
      scratch: () => blank((job.scratch ??= spare.pop() ?? make()), dpr),
      coverage: () => (job.cov ??= covSpare.pop() ?? createCoverage(TILE_PX, TILE_PX)),   // MAP-WHOLE
      pixels: () => (pixels ??= new Uint8ClampedArray(TILE_PX * TILE_PX * 4)),
    });
    if (it && typeof it.next === 'function') job.it = it; else job.done = true;
    return job;
  }
  /** What is kept of a tile not yet painted at this level: the nearest level's tiles over it, up to STAND_IN levels either
   *  side (two doublings: a zoom's jump), clipped to it - MAP-WHOLE: and past them the base's. */
  function stand(ctx, view, dpr, key, x0, y0, span) {
    if (standUnder(ctx, view, dpr, key, x0, y0, span)) return true;
    if (prevKey !== null && prevKey !== key && standUnder(ctx, view, dpr, prevKey, x0, y0, span)) return true;   // ZOOM-FAST: the last key's
    return standBase(ctx, view, dpr, x0, y0, span);
  }
  /** MAP-WHOLE: the base's tiles over a rectangle, clipped to it - whatever level and key the view is at. */
  function standBase(ctx, view, dpr, x0, y0, span) {
    if (!baseTiles.size) return false;
    let clipped = false;
    for (const t of baseTiles.values()) {
      if (!t.canvas || t.x0 >= x0 + span || t.x0 + t.span <= x0 || t.y0 >= y0 + span || t.y0 + t.span <= y0) continue;
      if (!clipped) {
        const s = view.scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect((x0 - view.ox) * s, (y0 - view.oy) * s, span * s, span * s);
        ctx.clip();
        clipped = true;
      }
      place(ctx, view, dpr, t);
    }
    if (clipped) ctx.restore();
    return clipped;
  }
  /** A stand-in under one key: its kept tiles over the rectangle at the scale nearest the view's, within STAND_IN levels.
   *  TILE-EXACT: found by scale, as tiles are kept at the scale each view rested at. */
  function standUnder(ctx, view, dpr, key, x0, y0, span) {
    let best = [], bd = Infinity;
    for (const t of tiles.values()) {
      if (!t.canvas || t.key !== key || t.dpr !== dpr) continue;
      if (t.x0 >= x0 + span || t.x0 + t.span <= x0 || t.y0 >= y0 + span || t.y0 + t.span <= y0) continue;
      const d = Math.abs(Math.log2(t.level / view.scale));
      if (d > STAND_IN / LEVEL_STEPS || d > bd) continue;
      if (d < bd) { bd = d; best = []; }
      best.push(t);
    }
    if (!best.length) return false;
    const s = view.scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect((x0 - view.ox) * s, (y0 - view.oy) * s, span * s, span * s);
    ctx.clip();
    for (const t of best) place(ctx, view, dpr, t);
    ctx.restore();
    return true;
  }
  return {
    /**
     * The view's tiles onto the sheet: kept ones drawn, owed ones painted nearest the middle first under the budget - a
     * step of a sliced paint at a time (AUDIT TESA II M10). Answers whether any is still owed.
     * @param {any} ctx @param {{ ox: number, oy: number, scale: number }} view
     * @param {{ paperW: number, paperH: number, dpr?: number, key?: string, paint?: any, budgetMs?: number, force?: boolean,
     *   base?: ?{ key: string, paint: any, frame: { x0: number, y0: number, w: number, h: number }, version?: string } }} o
     *   `force` (default) paints one step at the least; false paints none past the budget (0: none at all). MAP-WHOLE:
     *   `base` the base's key and paint over the continent's `frame`, its words read again when `version` moves
     */
    draw(ctx, view, { paperW, paperH, dpr = 1, key = '', paint: opts = {}, budgetMs = TILE_BUDGET_MS, force = true, base = null }) {
      if (key !== curKey) { prevKey = curKey; curKey = key; }
      if (usable === null) { const c = make(); usable = !!c?.getContext?.('2d'); if (usable) spare.push(c); }
      if (!usable) { const it = paint(ctx, view, paperW, paperH, opts); if (it && typeof it.next === 'function') for (const _ of it) { /* whole */ } return false; }
      const level = view.scale, span = TILE_PX / (level * dpr);   // TILE-EXACT: painted at the view's own scale
      const x1 = view.ox + paperW / view.scale, y1 = view.oy + paperH / view.scale;
      const mx = (view.ox + x1) / 2, my = (view.oy + y1) / 2;
      const want = [];
      for (let ty = Math.floor(view.oy / span); ty <= Math.floor((y1 - 1e-9) / span); ty++) {
        for (let tx = Math.floor(view.ox / span); tx <= Math.floor((x1 - 1e-9) / span); tx++) want.push([tx, ty]);
      }
      want.sort((a, b) => Math.hypot((a[0] + 0.5) * span - mx, (a[1] + 0.5) * span - my) - Math.hypot((b[0] + 0.5) * span - mx, (b[1] + 0.5) * span - my));
      const start = now();
      let worked = 0, owed = false, painted = 0, stood = 0, holes = 0;
      const may = () => (force && worked === 0) || now() - start < budgetMs;
      /** A tile's turn: its word read, and its paint begun or carried on a step at a time while the budget lasts. */
      const turn = (t, x0, y0, span, level, word, o) => {
        if (t?.job && t.job.word !== word) { release(t.job.canvas); release(t.job.scratch); releaseCov(t.job); t.job = null; }   // the word moved under a paint: begun again
        if (may()) {
          t ??= { canvas: null, word: null, job: null, x0, y0, span };
          if (!t.job) { t.job = begin(x0, y0, span, level, dpr, word, o); if (t.job.done) worked++; }   // a whole paint is a step
          while (!t.job.done && may()) { if (t.job.it.next().done) t.job.done = true; worked++; }
          if (t.job.done) { release(t.canvas); release(t.job.scratch); releaseCov(t.job); t.canvas = t.job.canvas; t.word = word; t.job = null; painted++; }
        }
        if (!t || t.job || t.word !== word) owed = true;
        return t;
      };
      // MAP-WHOLE: THE BASE FIRST - its tiles painted (a dots pass a tile, rasterised: ui/inkRaster.js) before any of the
      // view's, so a tile owed has a stand-in from the base's first frames; its words read again only when the caller's
      // version of what they read moves (base.version)
      if (base) {
        const bn = baseLevelIndex(dpr), bl = 2 ** (bn / LEVEL_STEPS), bspan = TILE_PX / (bl * dpr), f = base.frame;
        const asked = `${base.key}|${bn}|${dpr}|${f.x0}|${f.y0}|${f.w}|${f.h}`;
        if (asked !== baseFor) { for (const t of baseTiles.values()) { release(t.canvas); if (t.job) { release(t.job.canvas); release(t.job.scratch); releaseCov(t.job); } } baseTiles.clear(); baseFor = asked; baseWordsAt = null; }
        const settled = baseWordsAt !== null && baseWordsAt === base.version && [...baseTiles.values()].every((t) => t.canvas && !t.job);
        if (!settled) {
          let whole = true;
          for (let ty = Math.floor(f.y0 / bspan); ty <= Math.floor((f.y0 + f.h - 1e-9) / bspan); ty++) {
            for (let tx = Math.floor(f.x0 / bspan); tx <= Math.floor((f.x0 + f.w - 1e-9) / bspan); tx++) {
              const x0 = tx * bspan, y0 = ty * bspan, id = `${tx}|${ty}`, word = stamp(x0, y0, x0 + bspan, y0 + bspan);
              let t = baseTiles.get(id);
              if (!t || t.word !== word || t.job) t = turn(t, x0, y0, bspan, bl, word, base.paint);
              if (t) { t.level = bl; baseTiles.set(id, t); }
              if (!t?.canvas || t.job || t.word !== word) whole = false;
            }
          }
          if (whole) baseWordsAt = base.version ?? null;
        }
      }
      for (const [tx, ty] of want) {
        const x0 = tx * span, y0 = ty * span, id = idOf(key, level, dpr, tx, ty);
        const word = stamp(x0, y0, x0 + span, y0 + span);
        let t = tiles.get(id);
        if (!t || t.word !== word || t.job) t = turn(t, x0, y0, span, level, word, opts);
        // AUDIT TESA II M1: every tile the frame draws to the back of the line - a fresh one, a stale one showing its last
        // paint, a partial one - so the let-go below never takes one the view is still drawing
        if (t) { t.key = key; t.level = level; t.dpr = dpr; tiles.delete(id); tiles.set(id, t); }
        if (t?.canvas) place(ctx, view, dpr, t);
        else if (stand(ctx, view, dpr, key, x0, y0, span)) stood++;
        else holes++;
      }
      // AUDIT TESA II M1: kept to TILES_KEPT, or to the view's own count where it wants more - a still view whose tiles
      // outnumbered the count let go of the ones it had just drawn and painted them again every frame, never settling
      while (tiles.size > Math.max(kept, want.length)) {
        const [oldest, t] = /** @type {[string, any]} */ (tiles.entries().next().value);
        tiles.delete(oldest);
        release(t.canvas);
        if (t.job) { release(t.job.canvas); release(t.job.scratch); releaseCov(t.job); }
      }
      if (owed) pending = true;
      last = { want: want.length, painted, stood, holes, owed };
      return owed;
    },
    /** Did a draw since the last call leave a tile owed? Answered once: the flag goes with the answer. */
    takePending() { const p = pending; pending = false; return p; },
    /** The last draw's tiles (MAP-WHOLE's read): wanted, painted, stood in for, holes, and whether one is owed. */
    stats: () => ({ ...last }),
    /** How many tiles are kept now. */
    kept: () => tiles.size,
    /** MAP-WHOLE: the base's tiles kept, and how many of them are painted whole. */
    baseKept: () => ({ tiles: baseTiles.size, whole: [...baseTiles.values()].filter((t) => t.canvas && !t.job).length }),
    /** None kept - the window shut. */
    clear() { tiles.clear(); baseTiles.clear(); baseFor = ''; baseWordsAt = null; spare.length = 0; covSpare.length = 0; pixels = null; pending = false; },
  };
}
