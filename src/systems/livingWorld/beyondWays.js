// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW7-7 (2026-10-26, the owner: "Yes travellers to need to travel everywhere. Same for ships."; bible/03-World/World-Wide.md
// WW7-7): THE WAYS PAST THE BAY - the road a town's travellers walk to another town past the Bay, on the roads past the Bay
// (TESA14's layer, world/arenaRoads.js - the Bay's own road law laid at the Bay's scale over every place past it) and the
// land past the Bay's ground.
//
// THE ONE PLANNER, ON A WINDOW OF THE WORLD. The Travel Options planner (systems/travel/travelRoute.js planRoute) walks a
// table - the Bay's 1000 x 500, its roads a byte a pixel - and past the table it knows no road (TV-BEYOND: the open ground).
// Past the Bay a pair of towns is planned on a WINDOW of the world's grid about its two ends, the window's origin the
// table's (0, 0): its roads' and tracks' bytes the layer's, its water every pixel that is no dry ground past the Bay - the
// Bay's own pixels among it, so a way past the Bay never walks onto the Bay (the Bay is every client's, the land past it only
// the clients that stand it: a party of the land past the Bay on the Bay's roads would be seen by one player and not the
// next). The planner's own law, unchanged and uncopied (AUDIT 68: no third copy of the step law) - this module only hands it
// the ground.
//
// BOUNDED. A pair asks a window of BEYOND_NEAR_PX about its ends with the planner's first two rungs (6 and 20); only a
// pair with no way there, or one a way outside it could still beat (the planner's own proof: a route costing no more than
// two margins' worth of road is the best there is, travelRoute.js planRoute), asks the window of BEYOND_FAR_PX with its
// third (60). The answer is the one a single ask of the wide window gives, rung for rung - the narrow one only spares its
// tiles. Never the whole map's rung: the continent is no table, and a pair the third rung cannot join has no way (the
// living world's reach is TRIP_REACH_PX, eighteen pixels; a way that must go round sixty pixels of sea is no walk).
//
// THE GROUND KEPT, A TILE AT A TIME. Each BEYOND_TILE x BEYOND_TILE tile of the world's grid is read once - its roads,
// its tracks and its water, three byte tables - and a window is copied out of its tiles. The water costs the ground's
// height a pixel (the composed continent's, ~3 microseconds cold), so a tile is some 12 ms the first time: no more than
// BEYOND_TILES_PER_FRAME are read a frame (`frame()`), and a pair whose tiles are not all read yet answers undefined - it
// waits, as a pair the way book has not asked yet does (systems/livingWorld/ways.js). The tiles are the layer's and the
// ground's as they stand: the way book drops them (`clear`) when the roads past the Bay are laid again.
//
// THE SAME WAY FOR EVERY READER. The window is the two ends' (the lower map id first, the book's own law), the layer the
// roads past the Bay laid whole (the host's epoch: no pair is asked while a region is still to land), the ground the
// land's: every client that stands the land past the Bay walks every pair alike.
//
// WW7-9 (2026-10-26, the coordinator: trips across the Bay's edge, the land past the Bay waking region by region):
//  - ACROSS THE EDGE (`plan(a, b, true)`): a pair of a Bay town and a town past the Bay is planned on the same window,
//    its Bay pixels the Bay's own ground (`bay()` - the drawn network's roads and tracks, the crossings' joins over them as
//    the Travel Options planner reads them, and the Bay's table's water), so its way walks the Bay's roads out to a
//    crossing's gate (TESA5) and on along the roads past the Bay. A tile holding a Bay pixel is read apart for it - the
//    Bay's pixels water for a pair past the Bay, their own ground for a pair across - and keeps the network it read (another
//    network, those tiles read again).
//  - REGION BY REGION: a window is asked only once the land past the Bay it covers is laid whole (`landedIn` - every region
//    of the roads past the Bay whose layer may reach it landed, TESA14's host): until then the pair waits, as for a tile.
//    A tile read before a region its pixels lie in landed is let go when it lands (`drop`), so no window is cut from
//    a layer older than its own.
//
// Pure: the layer and the ground in, pixels out. Not a DFU member (DFU's world is the Bay). Ledger A (WW7).
// ═══════════════════════════════════════════════════════════════════
import { planRoute, ROUTE_COST } from '../travel/travelRoute.js';
import { layerByte } from '../../world/arenaRoads.js';
import { inBay, BAY_W, BAY_H } from '../../world/tamriel/tamrielFrame.js';

/** The ground is read a tile this many pixels a side at a time. */
export const BEYOND_TILE = 64;
/** The most tiles read in one frame (each ~12 ms cold). */
export const BEYOND_TILES_PER_FRAME = 1;
/** The narrow window's reach past the two ends (pixels) and the rungs asked in it; the wide one's and its. */
export const BEYOND_NEAR_PX = 21;
export const BEYOND_FAR_PX = 61;
export const BEYOND_NEAR_MARGINS = Object.freeze([6, 20]);
export const BEYOND_FAR_MARGINS = Object.freeze([6, 20, 60]);

const tileKey = (/** @type {number} */ tx, /** @type {number} */ ty) => (ty + 4096) * 8192 + (tx + 4096);

/**
 * @typedef {{ pixels: { x: number, y: number }[], kinds?: string[], cost?: number }} WayPlan
 * @param {{ layer: () => ({ roads: Map<number, number>, tracks: Map<number, number>, join?: Map<number, number> } | null), dry: (x: number, y: number) => boolean,
 *   bay?: () => ({ roads: ArrayLike<number>|null, tracks: ArrayLike<number>|null, isWater: (x: number, y: number) => boolean } | null),
 *   landedIn?: (x0: number, y0: number, x1: number, y1: number) => boolean, plan?: typeof planRoute, tilesPerFrame?: number }} deps -
 *   `layer` the roads past the Bay (world/arenaRoads.js arenaRoadsLayer), `dry` whether a pixel PAST THE BAY is dry ground
 *   (the Bay's own pixels are this planner's water whatever it answers, but a pair's across the edge); WW7-9 `bay` the
 *   Bay's own ground for a pair across the edge (the drawn network, null till it is built, and the Bay table's water),
 *   `landedIn` whether the land past the Bay on a window is laid whole
 */
export function createBeyondWays({
  layer,
  dry,
  bay = () => null,
  landedIn = () => true,
  plan = planRoute,
  tilesPerFrame = BEYOND_TILES_PER_FRAME,
}) {
  /** @type {Map<number, { roads: Uint8Array, tracks: Uint8Array, water: Uint8Array }>} */
  const tiles = new Map();
  /** WW7-9: the tiles holding a Bay pixel as a pair across the edge reads them - their Bay pixels the Bay's own ground -
   *  and the network they read. */
  /** @type {Map<number, { roads: Uint8Array, tracks: Uint8Array, water: Uint8Array }>} */
  const edgeTiles = new Map();
  /** @type {any} */ let edgeNet = null;
  let budget = tilesPerFrame;
  const T = BEYOND_TILE;
  /** WW7-9: whether tile (tx, ty) holds a pixel of the Bay. */
  const holdsBay = (/** @type {number} */ tx, /** @type {number} */ ty) =>
    tx * T < BAY_W && (tx + 1) * T > 0 && ty * T < BAY_H && (ty + 1) * T > 0;
  /** The book a tile is kept in: one holding a Bay pixel, for a pair across the edge, its own (null while the Bay's
   *  network is unbuilt). */
  const bookOf = (/** @type {number} */ tx, /** @type {number} */ ty, /** @type {boolean} */ cross) => {
    if (!cross || !holdsBay(tx, ty)) return tiles;
    const b = bay();
    if (!b) return null;
    if (b.roads !== edgeNet) {
      edgeTiles.clear();
      edgeNet = b.roads;
    } // another network: its edge read again
    return edgeTiles;
  };
  /** A tile, read now if the frame's budget allows, else undefined. */
  const tileOf = (/** @type {number} */ tx, /** @type {number} */ ty, cross = false) => {
    const key = tileKey(tx, ty),
      book = bookOf(tx, ty, cross);
    if (!book) return undefined;
    let t = book.get(key);
    if (t) return t;
    if (budget <= 0) return undefined;
    budget--;
    const net = layer(),
      b = book === edgeTiles ? bay() : null;
    t = { roads: new Uint8Array(T * T), tracks: new Uint8Array(T * T), water: new Uint8Array(T * T) };
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const X = tx * T + x,
          Y = ty * T + y,
          i = y * T + x;
        if (b && inBay(X, Y)) {
          // WW7-9: across the edge - the Bay's own ground, its roads with the crossings' joins
          const k = Y * BAY_W + X;
          t.water[i] = b.isWater(X, Y) ? 1 : 0;
          t.roads[i] = (b.roads?.[k] ?? 0) | layerByte(net, 'join', X, Y);
          t.tracks[i] = b.tracks?.[k] ?? 0;
          continue;
        }
        if (inBay(X, Y)) {
          t.water[i] = 1;
          continue;
        } // the Bay's own: never a way's past it
        t.water[i] = dry(X, Y) ? 0 : 1;
        if (net) {
          t.roads[i] = layerByte(net, 'roads', X, Y);
          t.tracks[i] = layerByte(net, 'tracks', X, Y);
        }
      }
    book.set(key, t);
    return t;
  };
  /** The window x0..x0+w-1, y0..y0+h-1 as the planner's table, or undefined while a tile of it waits. */
  const windowOf = (
    /** @type {number} */ x0,
    /** @type {number} */ y0,
    /** @type {number} */ w,
    /** @type {number} */ h,
    cross = false,
  ) => {
    const tx0 = Math.floor(x0 / T),
      ty0 = Math.floor(y0 / T),
      tx1 = Math.floor((x0 + w - 1) / T),
      ty1 = Math.floor((y0 + h - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) if (!tileOf(tx, ty, cross)) return undefined;
    const roads = new Uint8Array(w * h),
      tracks = new Uint8Array(w * h),
      water = new Uint8Array(w * h);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = /** @type {{ roads: Uint8Array, tracks: Uint8Array, water: Uint8Array }} */ (tileOf(tx, ty, cross));
        const ax = Math.max(x0, tx * T),
          bx = Math.min(x0 + w, (tx + 1) * T),
          ay = Math.max(y0, ty * T),
          by = Math.min(y0 + h, (ty + 1) * T);
        for (let Y = ay; Y < by; Y++) {
          const src = (Y - ty * T) * T + (ax - tx * T),
            dst = (Y - y0) * w + (ax - x0),
            n = bx - ax;
          roads.set(t.roads.subarray(src, src + n), dst);
          tracks.set(t.tracks.subarray(src, src + n), dst);
          water.set(t.water.subarray(src, src + n), dst);
        }
      }
    return { roads, tracks, water };
  };
  /** One ask of the planner on the window `reach` about the two ends, with `margins`; undefined while a tile waits (or,
   *  WW7-9, while the land past the Bay under the window is still being laid). */
  const ask = (
    /** @type {{ x: number, y: number }} */ a,
    /** @type {{ x: number, y: number }} */ b,
    /** @type {number} */ reach,
    /** @type {readonly number[]} */ margins,
    cross = false,
  ) => {
    const x0 = Math.min(a.x, b.x) - reach,
      y0 = Math.min(a.y, b.y) - reach;
    const w = Math.max(a.x, b.x) + reach - x0 + 1,
      h = Math.max(a.y, b.y) + reach - y0 + 1;
    if (!landedIn(x0, y0, x0 + w, y0 + h)) return undefined;
    const win = windowOf(x0, y0, w, h, cross);
    if (!win) return undefined;
    const { water } = win;
    const isWater = (/** @type {number} */ x, /** @type {number} */ y) =>
      x < 0 || y < 0 || x >= w || y >= h || water[y * w + x] === 1;
    const got = plan(
      { x: a.x - x0, y: a.y - y0 },
      { x: b.x - x0, y: b.y - y0 },
      { roads: win.roads, tracks: win.tracks, isWater, width: w, height: h, margins },
    );
    return got ? { ...got, pixels: got.pixels.map((p) => ({ x: p.x + x0, y: p.y + y0 })) } : null;
  };
  return {
    /** The way from pixel `a` to pixel `b` past the Bay - the plan, null for none, undefined while its ground is read.
     *  WW7-9: `cross` a pair across the Bay's edge (its Bay pixels the Bay's own ground). */
    plan(/** @type {{ x: number, y: number }} */ a, /** @type {{ x: number, y: number }} */ b, cross = false) {
      const near = ask(a, b, BEYOND_NEAR_PX, BEYOND_NEAR_MARGINS, cross);
      if (near === undefined) return undefined;
      // the planner's own proof (travelRoute.js planRoute): a route costing no more than this is the best there is
      if (near && near.cost <= 2 * (BEYOND_NEAR_MARGINS[BEYOND_NEAR_MARGINS.length - 1] + 1) * ROUTE_COST.road)
        return near;
      return ask(a, b, BEYOND_FAR_PX, BEYOND_FAR_MARGINS, cross);
    },
    /** A new frame: the tiles' reading renewed. */
    frame(n = tilesPerFrame) {
      budget = n;
    },
    /** The roads past the Bay laid again (or the land moved): every tile read again. */
    clear() {
      tiles.clear();
      edgeTiles.clear();
    },
    /** WW7-9: a region landed on x0 <= x < x1, y0 <= y < y1 - every tile with a pixel there read again.
     *  @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
    drop(x0, y0, x1, y1) {
      for (const book of [tiles, edgeTiles]) {
        for (const k of [...book.keys()]) {
          const tx = (k % 8192) - 4096,
            ty = Math.floor(k / 8192) - 4096;
          if (tx * T < x1 && (tx + 1) * T > x0 && ty * T < y1 && (ty + 1) * T > y0) book.delete(k);
        }
      }
    },
    get tiles() {
      return tiles.size + edgeTiles.size;
    },
  };
}
