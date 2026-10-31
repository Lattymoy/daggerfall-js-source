// @ts-check
// WG2 THE SEAM (bible/03-World/World-2-Canon.md, "The seam"; WG-6): the published regions' ground, asked by the
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
      if (_regions.some((r) => overlaps(r.rect, d.header.rect))) { console.warn(`[wg2] ${d.header.id} overlaps a region; left out`); continue; }
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

/** The region whose rectangle holds a world point, or null. @param {number} x @param {number} y */
export function gen2At(x, y) {
  for (let i = 0; i < _regions.length; i++) if (_regions[i].owns(x, y)) return _regions[i];
  return null;
}
/** Does any region reach a world pixel (its square)? @param {number} px @param {number} py */
export function gen2Touches(px, py) {
  for (const r of _regions) if (overlaps(r.rect, { x: px, y: py, w: 1, h: 1 })) return true;
  return false;
}

/** A pixel's WOODS byte: the region's, eased from the world's own (`law`) across its edge band; undefined outside.
 *  @param {number} px @param {number} py @param {number} law */
export function gen2Byte(px, py, law) {
  if (!_regions.length) return undefined;
  const r = gen2At(px + 0.5, py + 0.5);
  if (!r) return undefined;
  const b = /** @type {number} */ (r.byteAt(px, py)), w = r.weight(px + 0.5, py + 0.5);
  return w >= 1 ? b : Math.round(law + (b - law) * w);
}
/** A pixel's climate where the region holds at least half of it; undefined else. @param {number} px @param {number} py */
export function gen2Climate(px, py) {
  if (!_regions.length) return undefined;
  const r = gen2At(px + 0.5, py + 0.5);
  return r && r.weight(px + 0.5, py + 0.5) >= 0.5 ? r.climateAt(px, py) : undefined;
}
/** The kernel's height (its units) at a world point, eased from the world's own `law` across the edge band; undefined
 *  outside every region. @param {number} x @param {number} y @param {number} law */
export function gen2Units(x, y, law) {
  const r = gen2At(x, y);
  if (!r) return undefined;
  const w = r.weight(x, y);
  if (w <= 0) return undefined;
  const g = kernelUnits(r.heightAt(x, y));
  return w >= 1 ? g : law + (g - law) * w;
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
    if (!r || r.weight(wx, wy) < 1 || !r.waterAt(wx, wy)) continue;
    tileData[y * tdDim + x] = water; n++;
  }
  return n;
}
function pathAt(paths, x, y, span) {
  for (let ty = y - 1; ty <= y; ty++) for (let tx = x - 1; tx <= x; tx++) if (tx >= 0 && ty >= 0 && tx < span && ty < span && paths[ty * span + tx]) return true;
  return false;
}
