// @ts-check
// WG2 THE SEAM ("The seam"; WG-6): the published regions' ground, asked by the
// world's own readers before their own law - tamrielGround.js's byte and climate, landforms.js's shaper, terrainGen.js's
// water paint. Every thread installs the same bakes (the 'tamriel' message carries them to the workers), so a pixel
// built anywhere is one ground. With none installed every answer is undefined and the world is as it was.
import { decodeBake } from './bakeCodec.js';
import { regionSampler, kernelUnits } from './regionSampler.js';

/** @type {import('./regionSampler.js').RegionSampler[]} */
let _regions = [];
/** @type {Uint8Array[]} */
let _bytes = [];
let _stamp = '';

/**
 * Install the published bakes on this thread. A bake made against another fit than the live one is refused (its
 * pixels would not be the world's) and told once. Answers the regions installed. Passing none clears them.
 * @param {Uint8Array[]} bakes @param {?{ ox: number, oy: number, ppu: number }} fit the live fit
 */
export function gen2Install(bakes, fit) {
  _regions = []; _bytes = []; _stamp = '';
  for (const b of bakes ?? []) {
    try {
      const d = decodeBake(b), f = d.header.fit;
      if (!fit || f.ox !== fit.ox || f.oy !== fit.oy || f.ppu !== fit.ppu) {
        console.warn(`[wg2] ${d.header.id} was baked on another fit; the world's own ground stands there`);
        continue;
      }
      if (_regions.some((r) => overlaps(r.rect, d.header.rect) && !(r.tiling && r.tiling === d.header.tiling && overlaps(r.header.core, d.header.core) === false))) { console.warn(`[wg2] ${d.header.id} overlaps a region; left out`); continue; }   // tiles of one tiling overlap in their bands alone
      _regions.push(regionSampler(d));
      _bytes.push(b);
    } catch (e) { console.warn('[wg2] a bake failed to read:', /** @type {Error} */ (e)?.message ?? e); }
  }
  _stamp = _regions.map((r) => `${r.id}:${r.print}`).join('+');
  return _regions;
}
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** The installed regions. */
export const gen2Regions = () => _regions;
/** The installed bakes' bytes, to post to a worker (copies: a post must not detach this thread's). */
export const gen2Shipped = () => _bytes.map((b) => b.slice());
/** What the installed regions are, for a cache's key: '' for none. */
export const gen2Stamp = () => _stamp;

/** The region whose rectangle holds a world point and whose share there is the greatest, or null. @param {number} x @param {number} y */
export function gen2At(x, y) {
  let best = null, bw = 0;
  for (let i = 0; i < _regions.length; i++) { const r = _regions[i]; if (!r.owns(x, y)) continue; const w = r.weight(x, y); if (!best || w > bw) { best = r; bw = w; } }
  return best;
}
/** Does any region reach a world pixel (its square)? @param {number} px @param {number} py */
export function gen2Touches(px, py) {
  for (const r of _regions) if (overlaps(r.rect, { x: px, y: py, w: 1, h: 1 })) return true;
  return false;
}
/** The world's own `law` with every region's value `of(r)` laid over it by its share - a lone region eased in across its
 *  band, tiles of one tiling crossfaded where they overlap (their shares sum to 1 there). undefined where none reaches. */
function blended(x, y, law, of) {
  let sum = 0, share = 0;
  for (let i = 0; i < _regions.length; i++) {
    const r = _regions[i];
    if (!r.owns(x, y)) continue;
    const w = r.weight(x, y);
    if (w > 0) { sum += w * of(r); share += w; }
  }
  if (share <= 0) return undefined;
  return share >= 1 ? sum / share : law * (1 - share) + sum;
}

/** A pixel's WOODS byte: the regions', eased from the world's own (`law`) across their bands; undefined outside.
 *  @param {number} px @param {number} py @param {number} law */
export function gen2Byte(px, py, law) {
  if (!_regions.length) return undefined;
  const v = blended(px + 0.5, py + 0.5, law, (r) => /** @type {number} */ (r.byteAt(px, py)));
  return v === undefined ? undefined : Math.round(v);
}
/** The regions' summed share of the ground at a world point. @param {number} x @param {number} y */
const shareAt = (x, y) => { let s = 0; for (const r of _regions) if (r.owns(x, y)) s += r.weight(x, y); return s; };
/** A pixel's climate where the regions hold at least half of it (the greatest share's); undefined else. @param {number} px @param {number} py */
export function gen2Climate(px, py) {
  if (!_regions.length) return undefined;
  const r = gen2At(px + 0.5, py + 0.5);
  return r && shareAt(px + 0.5, py + 0.5) >= 0.5 ? r.climateAt(px, py) : undefined;
}
/** The kernel's height (its units) at a world point, eased from the world's own `law`; undefined outside every region.
 *  @param {number} x @param {number} y @param {number} law */
export function gen2Units(x, y, law) {
  if (!_regions.length) return undefined;
  return blended(x, y, law, (r) => kernelUnits(r.heightAt(x, y)));
}

/**
 * THE WATER'S CORNERS in a region (terrainGen.js, beside the Cyrodiil waters' paint): a pixel's 129 x 129 tile data
 * corners (x east, y north) that stand in a region's river channel or lake are water to the marching squares; a
 * location's rect and a road's tiles keep their ground. Answers how many.
 * @param {Uint8Array} tileData @param {number} px @param {number} py @param {?{ xMin: number, xMax: number, yMin: number, yMax: number }} rect
 * @param {number} tdDim @param {?Uint8Array} paths @param {number} water the tile data's water (terrainTiles.js WATER)
 */
export function paintGen2Waters(tileData, px, py, rect, tdDim, paths, water) {
  if (!_regions.length || !gen2Touches(px, py)) return 0;
  const span = tdDim - 1;
  let n = 0;
  for (let y = 0; y < tdDim; y++) for (let x = 0; x < tdDim; x++) {
    if (rect && x > rect.xMin && x < rect.xMax && y > rect.yMin && y < rect.yMax) continue;
    if (paths && pathAt(paths, x, y, span)) continue;
    const wx = px + x / span, wy = py + 1 - y / span, r = gen2At(wx, wy);
    if (!r || r.weight(wx, wy) < 0.5 || shareAt(wx, wy) < 0.999 || !r.waterAt(wx, wy)) continue;   // the greatest share's water, where the regions hold the whole ground
    tileData[y * tdDim + x] = water; n++;
  }
  return n;
}
function pathAt(paths, x, y, span) {
  for (let ty = y - 1; ty <= y; ty++) for (let tx = x - 1; tx <= x; tx++) if (tx >= 0 && ty >= 0 && tx < span && ty < span && paths[ty * span + tx]) return true;
  return false;
}
