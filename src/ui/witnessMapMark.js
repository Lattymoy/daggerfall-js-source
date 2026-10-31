// @ts-check
// WITNESS-MAP (2026-10-31, Discord #feature-feedback, Sammy: "Display on the world map 'witnessed areas' for stuff like
// ores and pearls."; bible/06-Systems/Professions-Arc.md section 61): THE HELD MAP'S WITNESSED GROUND. A pixel three
// accounts have vouched for (net/nodeLaw.js witnessedFact) stands the veins past UNCONFIRMED_VEIN_TIER, its region's own
// ore, the gems, the heartwood and the sea's pearls. The map washes each such pixel in view in copper; ORE-MAP's card
// still says what one holds. AUDIT FB1031: the ground is read in the day's tiles (net/witnessTileLaw.js, the book's
// groundTile), every tile the view touches, and washed from a kept bitmap. Not a DFU member: DFU has no witnessed world.
import { t } from '../systems/textManager.js';
import { WITNESS_TILE, tileRange } from '../net/witnessTileLaw.js';

/** The wash over a witnessed pixel - copper, the ore's own colour, apart from every ring's ink and the parchment. */
export const WITNESS_TINT_CSS = 'rgba(184, 98, 36, 0.42)';
/** AUDIT FB1031 W2: the same wash as one texel of the kept bitmap (its alpha of 255). */
export const WITNESS_TINT_RGBA = Object.freeze([184, 98, 36, Math.round(0.42 * 255)]);
/** The legend's swatch: the same copper, whole. */
export const WITNESS_SWATCH_CSS = '#b86224';
export const WITNESS_LEGEND_TEXT = 'Witnessed ground';
export const witnessLegendText = () => t('prof.witness.legend', WITNESS_LEGEND_TEXT);
/** The key's row: its head and its switch's words. */
export const witnessKeyText = () => t('prof.witness.key', 'Ground');
export const witnessTipText = (on) => (on ? t('prof.witness.hide', 'Hide witnessed ground') : t('prof.witness.show', 'Show witnessed ground, where every vein, gem and pearl can appear'));
export const witnessFarText = () => t('prof.witness.far', 'Witnessed ground - zoom in to see');
/** AUDIT FB1031 W2: the tiles past each side of the view a read hands on - its range held while the view stays inside
 *  it, so a pan builds the wash's bitmap again only past them, and a pan between two polls stays washed. */
export const WITNESS_WASH_MARGIN = 2;

/**
 * AUDIT FB1031 W1: EVERY TILE A VIEW TOUCHES, nearest its middle first - the box in world pixels, a province's or the
 * sea's past the Bay as the Bay's. The regions' sample asked six of up to 35 regions in view.
 * @param {{ x0: number, y0: number, x1: number, y1: number }} box
 */
export function tilesInView(box) {
  const r = tileRange(box);
  const cx = (box.x0 + box.x1) / 2 / WITNESS_TILE - 0.5, cy = (box.y0 + box.y1) / 2 / WITNESS_TILE - 0.5;
  const out = [];
  for (let ty = r.ty0; ty <= r.ty1; ty++) for (let tx = r.tx0; tx <= r.tx1; tx++) out.push([tx, ty]);
  return out.sort((a, b) => ((a[0] - cx) ** 2 + (a[1] - cy) ** 2) - ((b[0] - cx) ** 2 + (b[1] - cy) ** 2));
}

/** @typedef {{ tx: number, ty: number, pixels: ReadonlyArray<ReadonlyArray<number>> }} WitnessTile */
/** @typedef {{ key: string, tiles: ReadonlyArray<WitnessTile>, x0: number, y0: number, x1: number, y1: number }} WitnessRead */
/** @type {WitnessRead} */
const NONE = Object.freeze({ key: '', tiles: Object.freeze([]), x0: 0, y0: 0, x1: 0, y1: 0 });

/**
 * THE MAP'S READER over a professions book (net/profBook.js): `open()` whether the professions are open to the account,
 * and `read(box)` the witnessed tiles over the view's box and WITNESS_WASH_MARGIN past it, as `{ key, tiles, x0, y0, x1,
 * y1 }` (the tiles' own box) - every tile in view not heard today asked, nearest first (the book asks one read at a time).
 * `key` moves when a tile lands, a pixel is heard, the day turns or the view leaves the range; '' while none holds any.
 * @param {{ state: { open: boolean|null }, groundTile: (tx: number, ty: number) => any, groundKey: () => string, askGround: (list: number[][]) => Promise<boolean> }} book
 */
export function witnessMapReader(book) {
  /** @type {WitnessRead} */
  let last = NONE;
  let seen = '';
  let range = null;
  return {
    open: () => book?.state?.open === true,
    read(box) {
      if (book?.state?.open !== true || !box) return NONE;
      book.askGround(tilesInView(box)).catch(() => {});
      const v = tileRange(box);
      if (!range || v.tx0 < range.tx0 || v.ty0 < range.ty0 || v.tx1 > range.tx1 || v.ty1 > range.ty1) range = tileRange(box, WITNESS_WASH_MARGIN);
      const r = range;
      const key = `${book.groundKey()}|${r.tx0},${r.ty0},${r.tx1},${r.ty1}`;
      if (key === seen) return last;
      seen = key;
      const tiles = [];
      for (let ty = r.ty0; ty <= r.ty1; ty++) for (let tx = r.tx0; tx <= r.tx1; tx++) {
        const g = book.groundTile(tx, ty);
        if (g?.pixels?.length) tiles.push({ tx, ty, pixels: g.pixels });
      }
      const T = WITNESS_TILE;
      last = tiles.length ? { key, tiles, x0: r.tx0 * T, y0: r.ty0 * T, x1: (r.tx1 + 1) * T, y1: (r.ty1 + 1) * T } : NONE;
      return last;
    },
  };
}

/**
 * AUDIT FB1031 W2: THE WASH KEPT - a read's pixels as texels of `canvas`, one a map pixel over the read's box, painted
 * again only when the read's key moves (the overlay painted every pixel's square each pulse and pan frame: 6,000 pixels
 * some 15 ms, 49,000 some 90). Answers the layer, or null with no 2D context or image data (the caller paints squares).
 * @param {any} prev @param {WitnessRead|null} read @param {any} canvas
 */
export function syncWashLayer(prev, read, canvas) {
  if (!read?.tiles?.length) return null;
  if (prev && prev.key === read.key && prev.canvas === canvas) return prev;
  const lctx = canvas?.getContext?.('2d');
  const w = read.x1 - read.x0, h = read.y1 - read.y0;
  if (!lctx || !(w > 0) || !(h > 0)) return null;
  const img = prev?.canvas === canvas && prev.w === w && prev.h === h && prev.img ? prev.img : lctx.createImageData?.(w, h);
  if (!img?.data) return null;
  const d = img.data;
  if (img === prev?.img) d.fill(0);
  const [cr, cg, cb, ca] = WITNESS_TINT_RGBA;
  for (const tile of read.tiles) {
    for (const [x, y] of tile.pixels) {
      const col = x - read.x0, row = y - read.y0;
      if (col < 0 || row < 0 || col >= w || row >= h) continue;
      const i = 4 * (row * w + col);
      d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = ca;
    }
  }
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  lctx.putImageData(img, 0, 0);
  return { canvas, img, key: read.key, x0: read.x0, y0: read.y0, w, h };
}

/** AUDIT FB1031 W2: the kept wash on the paper - one drawImage, each texel a square of the view's scale (smoothing off,
 *  so a pixel's edge stays a pixel's). `ctx` in paper pixels. */
export function blitWashLayer(ctx, layer, view) {
  const s = view.scale;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer.canvas, (layer.x0 - view.ox) * s, (layer.y0 - view.oy) * s, layer.w * s, layer.h * s);
  ctx.imageSmoothingEnabled = smooth;
}

/**
 * The wash with no bitmap: each witnessed pixel in view a square of WITNESS_TINT_CSS, in one fill, a tile out of view
 * passed over whole. `visible(x, y, pad)` the sheet's own cull.
 * @param {any} ctx @param {{ ox: number, oy: number, scale: number }} view
 * @param {ReadonlyArray<WitnessTile>} tiles @param {(x: number, y: number, pad?: number) => boolean} visible
 */
export function paintWitnessedGround(ctx, view, tiles, visible) {
  if (!tiles?.length) return;
  const s = view.scale, T = WITNESS_TILE;
  ctx.fillStyle = WITNESS_TINT_CSS;
  ctx.beginPath();
  for (const tile of tiles) {
    if (!visible((tile.tx + 0.5) * T, (tile.ty + 0.5) * T, T)) continue;
    for (const [x, y] of tile.pixels) if (visible(x + 0.5, y + 0.5, 1)) ctx.rect((x - view.ox) * s, (y - view.oy) * s, s, s);
  }
  ctx.fill();
}
