// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA15 (2026-10-24, bible/03-World/Arena-Provinces.md TESA15) - THE LAND PAST THE BAY'S PAINT, KEPT A TILE AT A TIME.
//
// The held map paints its static ink again on every frame its view moves (heldMap.js: the kept layer's key is the view).
// Past the Bay that ink is the whole network TESA14 lays - 37,000 road chains and 115,000 track chains on the freeware's
// continent, and every place the regions laid - and stroked whole it is a quarter of a second a frame out on the
// continent. So it is painted once onto TILES of TILE_PX device pixels at the view's LEVEL (its scale, LEVEL_STEPS levels
// a doubling) and the kept tiles are drawn: a pan is a drawImage a tile. A tile is painted again when what it shows moves
// - its word (`stamp`: the roads' installs and the places' adds over its pixels, ui/tamrielInk.js pastBayStamp) or the
// paint's own key (the band, the filters, the hues) - and TILES_KEPT are kept, the one drawn longest ago let go first.
// A frame paints the tiles nearest the view's middle first until TILE_BUDGET_MS is spent (one at the least); a tile still
// owed meanwhile shows what is kept of it - its last paint, else the nearest level's within STAND_IN - and the window paints
// again next frame (takePending). ZOOM-FAST (2026-10-24, the owner: "The map also is slow to load when zooming in and
// out"): a draw told not to `force` paints none while the view still moves (the window's zoom settling), and a stand-in is
// sought under the last key too, so crossing a band or the continent's line keeps the roads up while they are painted
// again. Where a canvas gives no 2D context the view is painted straight onto the sheet, as the
// window's own kept layer is (heldMap.js: `layer.getContext?.('2d')`).
// ═══════════════════════════════════════════════════════════════════

/** A tile's side, device pixels. */
export const TILE_PX = 256;
/** Levels a doubling of the scale - a tile is drawn at most a twelfth larger or smaller than it was painted. */
export const LEVEL_STEPS = 4;
/** How many tiles are kept: three screens at a 1280 x 800 paper and twice the pixels. */
export const TILES_KEPT = 160;
/** A frame's share of painting, milliseconds. */
export const TILE_BUDGET_MS = 8;

/** How many levels either side a tile owed looks for a stand-in - two doublings. */
export const STAND_IN = 2 * LEVEL_STEPS;
const STAND_IN_ORDER = Array.from({ length: STAND_IN }, (_, i) => [-(i + 1), i + 1]).flat();
/** The level a scale is painted at: the nearest of LEVEL_STEPS a doubling. */
export const levelOf = (scale) => 2 ** (Math.round(Math.log2(scale) * LEVEL_STEPS) / LEVEL_STEPS);

/**
 * The tiles over a painter. `paint(ctx, view, paperW, paperH, opts)` paints a view (ui/tamrielInk.js paintPastBay); `stamp`
 * answers the word for a rectangle of Bay pixels; `make` a canvas; `now` the clock a budget is spent on.
 * @param {{ paint: (ctx: any, view: { ox: number, oy: number, scale: number }, paperW: number, paperH: number, opts: any) => void,
 *   stamp: (x0: number, y0: number, x1: number, y1: number) => string, make?: () => any, now?: () => number, kept?: number }} o
 */
export function createTamrielTiles({ paint, stamp, make = () => document.createElement('canvas'), now = () => performance.now(), kept = TILES_KEPT }) {
  /** @type {Map<string, { canvas: any, word: string, x0: number, y0: number, span: number }>} */
  const tiles = new Map();
  const spare = [], SPARE = 16;   // a let-go tile's canvas, painted over by the next new one
  let pending = false, usable = null, curKey = null, prevKey = null;
  const idOf = (key, level, dpr, tx, ty) => `${key}|${level}|${dpr}|${tx}|${ty}`;
  /** A kept tile onto the sheet at its own rectangle - its edges on whole device pixels, so tiles meet without a seam. */
  function place(ctx, view, dpr, t) {
    const s = view.scale, snap = (v) => Math.round(v * dpr) / dpr;
    const x0 = snap((t.x0 - view.ox) * s), y0 = snap((t.y0 - view.oy) * s);
    const x1 = snap((t.x0 + t.span - view.ox) * s), y1 = snap((t.y0 + t.span - view.oy) * s);
    ctx.drawImage(t.canvas, x0, y0, x1 - x0, y1 - y0);
  }
  function paintTile(id, x0, y0, span, level, dpr, word, opts) {
    let t = tiles.get(id);
    if (t) tiles.delete(id);
    const canvas = t?.canvas ?? spare.pop() ?? make();
    if (canvas.width !== TILE_PX) canvas.width = TILE_PX;
    if (canvas.height !== TILE_PX) canvas.height = TILE_PX;
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, TILE_PX, TILE_PX);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(c, { ox: x0, oy: y0, scale: level }, TILE_PX / dpr, TILE_PX / dpr, opts);
    t = { canvas, word, x0, y0, span };
    tiles.set(id, t);
    return t;
  }
  /** What is kept of a tile not yet painted at this level: the nearest level's tiles over it, up to STAND_IN levels either
   *  side (two doublings: a zoom's jump), clipped to it. */
  function stand(ctx, view, dpr, key, level, x0, y0, span) {
    if (standUnder(ctx, view, dpr, key, level, x0, y0, span)) return;
    if (prevKey !== null && prevKey !== key) standUnder(ctx, view, dpr, prevKey, level, x0, y0, span, true);   // ZOOM-FAST: the last key's
  }
  /** A stand-in under one key - its own level too where the key is another's (a band crossed, the level unmoved). */
  function standUnder(ctx, view, dpr, key, level, x0, y0, span, same = false) {
    for (const k of same ? [0, ...STAND_IN_ORDER] : STAND_IN_ORDER) {
      const other = level * 2 ** (k / LEVEL_STEPS), os = TILE_PX / (other * dpr);
      const found = [];
      for (let ty = Math.floor(y0 / os); ty <= Math.floor((y0 + span) / os); ty++) {
        for (let tx = Math.floor(x0 / os); tx <= Math.floor((x0 + span) / os); tx++) { const t = tiles.get(idOf(key, other, dpr, tx, ty)); if (t) found.push(t); }
      }
      if (!found.length) continue;
      const s = view.scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect((x0 - view.ox) * s, (y0 - view.oy) * s, span * s, span * s);
      ctx.clip();
      for (const t of found) place(ctx, view, dpr, t);
      ctx.restore();
      return true;
    }
    return false;
  }
  return {
    /**
     * The view's tiles onto the sheet: kept ones drawn, owed ones painted nearest the middle first under the budget.
     * Answers whether any is still owed.
     * @param {any} ctx @param {{ ox: number, oy: number, scale: number }} view
     * @param {{ paperW: number, paperH: number, dpr?: number, key?: string, paint?: any, budgetMs?: number, force?: boolean }} o
     *   `force` (default) paints one tile at the least; false paints none past the budget (0: none at all)
     */
    draw(ctx, view, { paperW, paperH, dpr = 1, key = '', paint: opts = {}, budgetMs = TILE_BUDGET_MS, force = true }) {
      if (key !== curKey) { prevKey = curKey; curKey = key; }
      if (usable === null) { const c = make(); usable = !!c?.getContext?.('2d'); if (usable) spare.push(c); }
      if (!usable) { paint(ctx, view, paperW, paperH, opts); return false; }
      const level = levelOf(view.scale), span = TILE_PX / (level * dpr);
      const x1 = view.ox + paperW / view.scale, y1 = view.oy + paperH / view.scale;
      const mx = (view.ox + x1) / 2, my = (view.oy + y1) / 2;
      const want = [];
      for (let ty = Math.floor(view.oy / span); ty <= Math.floor((y1 - 1e-9) / span); ty++) {
        for (let tx = Math.floor(view.ox / span); tx <= Math.floor((x1 - 1e-9) / span); tx++) want.push([tx, ty]);
      }
      want.sort((a, b) => Math.hypot((a[0] + 0.5) * span - mx, (a[1] + 0.5) * span - my) - Math.hypot((b[0] + 0.5) * span - mx, (b[1] + 0.5) * span - my));
      const start = now();
      let painted = 0, owed = false;
      for (const [tx, ty] of want) {
        const x0 = tx * span, y0 = ty * span, id = idOf(key, level, dpr, tx, ty);
        const word = stamp(x0, y0, x0 + span, y0 + span);
        let t = tiles.get(id);
        if (!t || t.word !== word) {
          if ((force && painted === 0) || now() - start < budgetMs) { t = paintTile(id, x0, y0, span, level, dpr, word, opts); painted++; } else owed = true;
        } else { tiles.delete(id); tiles.set(id, t); }   // read again: to the back of the line
        if (t) place(ctx, view, dpr, t);
        else stand(ctx, view, dpr, key, level, x0, y0, span);
      }
      while (tiles.size > kept) {
        const [oldest, t] = /** @type {[string, any]} */ (tiles.entries().next().value);
        tiles.delete(oldest);
        if (spare.length < SPARE) spare.push(t.canvas);
      }
      if (owed) pending = true;
      return owed;
    },
    /** Did a draw since the last call leave a tile owed? Answered once: the flag goes with the answer. */
    takePending() { const p = pending; pending = false; return p; },
    /** How many tiles are kept now. */
    kept: () => tiles.size,
    /** None kept - the window shut. */
    clear() { tiles.clear(); spare.length = 0; pending = false; },
  };
}
