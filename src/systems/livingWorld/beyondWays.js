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
// Pure: the layer and the ground in, pixels out. Not a DFU member (DFU's world is the Bay). Ledger A (WW7).
// ═══════════════════════════════════════════════════════════════════
import { planRoute, ROUTE_COST } from '../travel/travelRoute.js';
import { layerByte } from '../../world/arenaRoads.js';
import { inBay } from '../../world/tamriel/tamrielFrame.js';

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
 * @param {{ layer: () => ({ roads: Map<number, number>, tracks: Map<number, number> } | null), dry: (x: number, y: number) => boolean,
 *   plan?: typeof planRoute, tilesPerFrame?: number }} deps -
 *   `layer` the roads past the Bay (world/arenaRoads.js arenaRoadsLayer), `dry` whether a pixel PAST THE BAY is dry ground
 *   (the Bay's own pixels are this planner's water whatever it answers)
 */
export function createBeyondWays({ layer, dry, plan = planRoute, tilesPerFrame = BEYOND_TILES_PER_FRAME }) {
  /** @type {Map<number, { roads: Uint8Array, tracks: Uint8Array, water: Uint8Array }>} */
  const tiles = new Map();
  let budget = tilesPerFrame;
  const T = BEYOND_TILE;
  /** A tile, read now if the frame's budget allows, else undefined. */
  const tileOf = (/** @type {number} */ tx, /** @type {number} */ ty) => {
    const key = tileKey(tx, ty);
    let t = tiles.get(key);
    if (t) return t;
    if (budget <= 0) return undefined;
    budget--;
    const net = layer();
    t = { roads: new Uint8Array(T * T), tracks: new Uint8Array(T * T), water: new Uint8Array(T * T) };
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const X = tx * T + x, Y = ty * T + y, i = y * T + x;
      if (inBay(X, Y)) { t.water[i] = 1; continue; }   // the Bay's own: never a way's past it
      t.water[i] = dry(X, Y) ? 0 : 1;
      if (net) { t.roads[i] = layerByte(net, 'roads', X, Y); t.tracks[i] = layerByte(net, 'tracks', X, Y); }
    }
    tiles.set(key, t);
    return t;
  };
  /** The window x0..x0+w-1, y0..y0+h-1 as the planner's table, or undefined while a tile of it waits. */
  const windowOf = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ w, /** @type {number} */ h) => {
    const tx0 = Math.floor(x0 / T), ty0 = Math.floor(y0 / T), tx1 = Math.floor((x0 + w - 1) / T), ty1 = Math.floor((y0 + h - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (!tiles.has(tileKey(tx, ty))) { if (!tileOf(tx, ty)) return undefined; }
    const roads = new Uint8Array(w * h), tracks = new Uint8Array(w * h), water = new Uint8Array(w * h);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = /** @type {{ roads: Uint8Array, tracks: Uint8Array, water: Uint8Array }} */ (tiles.get(tileKey(tx, ty)));
      const ax = Math.max(x0, tx * T), bx = Math.min(x0 + w, (tx + 1) * T), ay = Math.max(y0, ty * T), by = Math.min(y0 + h, (ty + 1) * T);
      for (let Y = ay; Y < by; Y++) {
        const src = (Y - ty * T) * T + (ax - tx * T), dst = (Y - y0) * w + (ax - x0), n = bx - ax;
        roads.set(t.roads.subarray(src, src + n), dst); tracks.set(t.tracks.subarray(src, src + n), dst); water.set(t.water.subarray(src, src + n), dst);
      }
    }
    return { roads, tracks, water };
  };
  /** One ask of the planner on the window `reach` about the two ends, with `margins`; undefined while a tile waits. */
  const ask = (/** @type {{ x: number, y: number }} */ a, /** @type {{ x: number, y: number }} */ b, /** @type {number} */ reach, /** @type {readonly number[]} */ margins) => {
    const x0 = Math.min(a.x, b.x) - reach, y0 = Math.min(a.y, b.y) - reach;
    const w = Math.max(a.x, b.x) + reach - x0 + 1, h = Math.max(a.y, b.y) + reach - y0 + 1;
    const win = windowOf(x0, y0, w, h);
    if (!win) return undefined;
    const { water } = win;
    const isWater = (/** @type {number} */ x, /** @type {number} */ y) => x < 0 || y < 0 || x >= w || y >= h || water[y * w + x] === 1;
    const got = plan({ x: a.x - x0, y: a.y - y0 }, { x: b.x - x0, y: b.y - y0 }, { roads: win.roads, tracks: win.tracks, isWater, width: w, height: h, margins });
    return got ? { ...got, pixels: got.pixels.map((p) => ({ x: p.x + x0, y: p.y + y0 })) } : null;
  };
  return {
    /** The way from pixel `a` to pixel `b` past the Bay - the plan, null for none, undefined while its ground is read. */
    plan(/** @type {{ x: number, y: number }} */ a, /** @type {{ x: number, y: number }} */ b) {
      const near = ask(a, b, BEYOND_NEAR_PX, BEYOND_NEAR_MARGINS);
      if (near === undefined) return undefined;
      // the planner's own proof (travelRoute.js planRoute): a route costing no more than this is the best there is
      if (near && near.cost <= 2 * (BEYOND_NEAR_MARGINS[BEYOND_NEAR_MARGINS.length - 1] + 1) * ROUTE_COST.road) return near;
      return ask(a, b, BEYOND_FAR_PX, BEYOND_FAR_MARGINS);
    },
    /** A new frame: the tiles' reading renewed. */
    frame(n = tilesPerFrame) { budget = n; },
    /** The roads past the Bay laid again (or the land moved): every tile read again. */
    clear() { tiles.clear(); },
    get tiles() { return tiles.size; },
  };
}
