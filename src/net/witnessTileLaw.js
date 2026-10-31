// @ts-check
// AUDIT FB1031 W1 W3 W4 (2026-10-31, WITNESS-MAP's audit; bible/06-Systems/Professions-Arc.md section 61): THE WITNESSED
// GROUND IN TILES - the shape both ends read. The map asked a region's ground, and a region is no unit of ground: a
// province is one region (Morrowind's 2.03M pixels), the sea past the Bay is region 0, and every ask scanned the region's
// witness rows. A TILE is WITNESS_TILE map pixels a side, keyed by the world pixel alone (no region, no Bay bound: the
// world's grid, net/wire.js worldPixelOk), laid once a UTC day by the service (server-account/src/witnessTiles.js) and
// read a tile by its key. A tile's pixels travel as two characters each - the row in the tile, then the column.
// Pure: no clock, no DOM, no network.
import { worldPixelOk, WORLD_PIXEL_BOUND } from './wire.js';

/** A tile's side, in map pixels: 64, so a pixel's place in it is two characters of DIGITS. */
export const WITNESS_TILE = 64;
/** The tiles one ask of the map's names at most - the service reads each by its key. */
export const WITNESS_TILES_ASK = 64;
/** The tiles each side of the Bay's corner on an axis: the world's grid in tiles, [-TILES_SPAN, TILES_SPAN). */
export const TILES_SPAN = WORLD_PIXEL_BOUND / WITNESS_TILE;
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DIGIT_OF = new Map([...DIGITS].map((c, i) => [c, i]));

/** Whether (tx, ty) is a tile of the world's grid. */
export const tileOk = (tx, ty) => Number.isSafeInteger(tx) && Number.isSafeInteger(ty)
  && tx >= -TILES_SPAN && tx < TILES_SPAN && ty >= -TILES_SPAN && ty < TILES_SPAN;
/** The tile a map pixel lies in: [tx, ty]. */
export const tileOf = (x, y) => [Math.floor(x / WITNESS_TILE), Math.floor(y / WITNESS_TILE)];
/** A tile's key in a Map. */
export const tileKey = (tx, ty) => `${tx},${ty}`;

/**
 * A tile's pixels as one string, by row then column, each once - the pixels of `pixels` that lie in tile (tx, ty) and on
 * the world's grid; the rest are not its.
 * @param {number} tx @param {number} ty @param {ReadonlyArray<ReadonlyArray<number>>} pixels
 */
export function packTile(tx, ty, pixels) {
  const x0 = tx * WITNESS_TILE, y0 = ty * WITNESS_TILE;
  const cells = new Set();
  for (const [x, y] of pixels) {
    if (!worldPixelOk(x) || !worldPixelOk(y)) continue;
    const r = y - y0, c = x - x0;
    if (r >= 0 && r < WITNESS_TILE && c >= 0 && c < WITNESS_TILE) cells.add(DIGITS[r] + DIGITS[c]);
  }
  return [...cells].sort((a, b) => (DIGIT_OF.get(a[0]) - DIGIT_OF.get(b[0])) || (DIGIT_OF.get(a[1]) - DIGIT_OF.get(b[1]))).join('');
}

/**
 * A tile's string as its pixels, [[x, y]...] - null for a string no packTile wrote.
 * @param {number} tx @param {number} ty @param {unknown} s
 */
export function unpackTile(tx, ty, s) {
  if (!tileOk(tx, ty) || typeof s !== 'string' || s.length % 2 !== 0) return null;
  const x0 = tx * WITNESS_TILE, y0 = ty * WITNESS_TILE;
  const out = [];
  for (let i = 0; i < s.length; i += 2) {
    const r = DIGIT_OF.get(s[i]), c = DIGIT_OF.get(s[i + 1]);
    if (r === undefined || c === undefined) return null;
    out.push([x0 + c, y0 + r]);
  }
  return out;
}

/**
 * The tiles a box of map pixels touches, `margin` tiles past each side, inside the world's grid: an inclusive range.
 * @param {{ x0: number, y0: number, x1: number, y1: number }} box @param {number} [margin]
 */
export function tileRange(box, margin = 0) {
  const lo = (v) => Math.max(-TILES_SPAN, Math.floor(v / WITNESS_TILE) - margin);
  const hi = (v) => Math.min(TILES_SPAN - 1, Math.ceil(v / WITNESS_TILE) - 1 + margin);
  return { tx0: lo(box.x0), ty0: lo(box.y0), tx1: hi(box.x1), ty1: hi(box.y1) };
}
