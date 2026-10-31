// @ts-check
// WITNESS-MAP (2026-10-31, Discord #feature-feedback, Sammy: "Display on the world map 'witnessed areas' for stuff like
// ores and pearls."; bible/06-Systems/Professions-Arc.md section 61): THE HELD MAP'S WITNESSED GROUND. A pixel three
// accounts have vouched for (net/nodeLaw.js witnessedFact) stands the veins past UNCONFIRMED_VEIN_TIER, its region's own
// ore, the gems, the heartwood and the sea's pearls; nothing on the map said where. The map tints each such pixel of the
// regions in view, and ORE-MAP's card still says what one holds. The book keeps a region's ground for its UTC day
// (net/profBook.js ground, the service's /v1/prof/ground); the host hands the map this reader as `witnessed`. Not a DFU
// member: DFU has no witnessed world.
import { t } from '../systems/textManager.js';

/** The wash over a witnessed pixel - copper, the ore's own colour, apart from every ring's ink and the parchment. */
export const WITNESS_TINT_CSS = 'rgba(184, 98, 36, 0.42)';
/** The legend's swatch: the same copper, whole. */
export const WITNESS_SWATCH_CSS = '#b86224';
export const WITNESS_LEGEND_TEXT = 'Witnessed ground';
export const witnessLegendText = () => t('prof.witness.legend', WITNESS_LEGEND_TEXT);
/** The key's row: its head and its switch's words. */
export const witnessKeyText = () => t('prof.witness.key', 'Ground');
export const witnessTipText = (on) => (on ? t('prof.witness.hide', 'Hide witnessed ground') : t('prof.witness.show', 'Show witnessed ground, where every vein, gem and pearl can appear'));
export const witnessFarText = () => t('prof.witness.far', 'Witnessed ground - zoom in to see');
/** How many regions one view asks after, nearest its middle first, and the grid each side it is sampled on. */
export const WITNESS_VIEW_REGIONS = 6;
export const WITNESS_VIEW_GRID = 7;

/**
 * The regions a view holds, nearest its middle first, at most `max` - sampled on a WITNESS_VIEW_GRID grid over the box
 * (world pixels; a province's past the Bay), each point's region the map's own (`regionAt`).
 * @param {{ x0: number, y0: number, x1: number, y1: number }} box
 * @param {(x: number, y: number) => number} regionAt
 */
export function regionsInView(box, regionAt, max = WITNESS_VIEW_REGIONS) {
  const n = WITNESS_VIEW_GRID, w = box.x1 - box.x0, h = box.y1 - box.y0;
  const points = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) points.push([(i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5]);
  points.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2));
  const out = [];
  for (const [u, v] of points) {
    const r = regionAt(Math.floor(box.x0 + (u + 0.5) * w), Math.floor(box.y0 + (v + 0.5) * h));
    if (Number.isInteger(r) && r >= 0 && !out.includes(r)) out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** @typedef {{ key: string, pixels: ReadonlyArray<ReadonlyArray<number>> }} WitnessRead */
/** @type {WitnessRead} */
const NONE = Object.freeze({ key: '', pixels: Object.freeze([]) });

/**
 * THE MAP'S READER over a professions book (net/profBook.js) and the host's maps: `open()` whether the professions are
 * open to the account, and `read(box)` the witnessed pixels of the regions in the view's box as `{ key, pixels }` - each
 * region not yet heard today asked, nearest first (the book starts one read at a time and passes over one waiting out a
 * failure). `key` moves only when a region's ground lands or the regions in view change.
 * @param {{ state: { open: boolean|null }, ground: (region: number) => any, askGround: (region: number) => Promise<boolean> }} book
 * @param {{ getRegionIndexAt: (x: number, y: number) => number }} maps
 */
export function witnessMapReader(book, maps) {
  /** @type {WitnessRead} */
  let last = NONE;
  return {
    open: () => book?.state?.open === true,
    read(box) {
      if (book?.state?.open !== true || !box) return NONE;
      const held = [];
      for (const r of regionsInView(box, (x, y) => maps.getRegionIndexAt(x, y))) {
        const g = book.ground(r);
        if (g) held.push([r, g]);
        else book.askGround(r).catch(() => {});
      }
      const key = held.map(([r, g]) => `${r}:${g.day}:${g.pixels.length}`).join('|');
      if (key !== last.key) last = key ? { key, pixels: held.flatMap(([, g]) => g.pixels) } : NONE;
      return last;
    },
  };
}

/**
 * Paints the witnessed pixels the view shows, each a square of WITNESS_TINT_CSS, in one fill - under every ring and mark
 * (ui/ink/inkMap.js paintInkOverlay). `visible(x, y, pad)` the overlay's own cull.
 * @param {any} ctx @param {{ ox: number, oy: number, scale: number }} view
 * @param {ReadonlyArray<ReadonlyArray<number>>} pixels @param {(x: number, y: number, pad?: number) => boolean} visible
 */
export function paintWitnessedGround(ctx, view, pixels, visible) {
  if (!pixels?.length) return;
  const s = view.scale;
  ctx.fillStyle = WITNESS_TINT_CSS;
  ctx.beginPath();
  for (const [x, y] of pixels) if (visible(x + 0.5, y + 0.5, 1)) ctx.rect((x - view.ox) * s, (y - view.oy) * s, s, s);
  ctx.fill();
}
