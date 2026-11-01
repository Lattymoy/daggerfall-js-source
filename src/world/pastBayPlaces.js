// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA15 (2026-10-24, bible/03-World/Arena-Provinces.md TESA15) - THE PLACES PAST THE BAY THE REGIONS LAID, ONE ROLL.
//
// The roads' workers roll every place past the Bay to lay the roads to them (world/tamrielRoads.js buildTamrielRegion),
// and the held map wanted the same places - so it rolled them a second time on the page's own thread, a frame's budget at
// a time (TESA13's atlas), and a view filled in over seconds. Each region now answers its places with its roads (the ones
// its core holds, none on an Arena place's or a capital's pixel), and they are kept here, a ROAD_TILE bin at a time: the
// map reads the places the roads were laid to, all of them, at once. Each bin keeps the add that last moved it, so the
// map's kept tiles (ui/tamrielTiles.js) paint again where a region landed and nowhere else.
//
// This thread's, as the roads' layer is (world/arenaRoads.js): the world host's roads module resets it as a build starts
// and adds each region's as it lands (scenes/tamrielRoadsHost.js).
// ═══════════════════════════════════════════════════════════════════
import { beyondKey, beyondPixel, ROAD_TILE, roadTileKey } from './arenaRoads.js';

/** @typedef {{ x: number, y: number, type: number }} PastBayPlace */

/** @type {Map<number, { v: number, list: PastBayPlace[] }>} */
let _bins = new Map();
let _version = 0;

/** None - a build starting. */
export function resetPastBayPlaces() {
  _bins = new Map();
  _version++;
}
/** A region's places, kept. @param {PastBayPlace[]} places */
export function addPastBayPlaces(places) {
  _version++;
  for (const p of places) {
    const k = roadTileKey(Math.floor(p.x / ROAD_TILE), Math.floor(p.y / ROAD_TILE));
    let bin = _bins.get(k);
    if (!bin) _bins.set(k, (bin = { v: 0, list: [] }));
    bin.list.push({ x: p.x, y: p.y, type: p.type });
    bin.v = _version;
  }
}
/** TRAVEL-EVERYWHERE: the world's one law of a place past the Bay a journey may go to (scenes/mapPlacesHost.js
 *  tvPlaceSummary: known by its kind, found, or `named` by a quest), set by the host that keeps the places; the held map
 *  asks it as the Bay's map asks discovery. Null with no host. */
let _placeLaw = null;
/** @param {((px: number, py: number, named?: boolean) => any) | null} law */
export const setPastBayPlaceLaw = (law) => {
  _placeLaw = typeof law === 'function' ? law : null;
};
/** The summary a journey to the place on a pixel past the Bay goes by, or null. @param {number} px @param {number} py */
export const pastBayPlaceSummary = (px, py, named = false) => _placeLaw?.(px, py, named) ?? null;
/** Moves on every reset and add. */
export const pastBayPlacesVersion = () => _version;
/** The add that last moved a bin (0: it holds none). */
export const pastBayPlacesStamp = (tx, ty) => _bins.get(roadTileKey(tx, ty))?.v ?? 0;
/** The places on the pixels x0 <= x < x1, y0 <= y < y1. @returns {PastBayPlace[]} */
export function pastBayPlacesIn(x0, y0, x1, y1) {
  const out = [];
  if (x1 <= x0 || y1 <= y0) return out;
  for (let ty = Math.floor(y0 / ROAD_TILE); ty <= Math.floor((y1 - 1) / ROAD_TILE); ty++) {
    for (let tx = Math.floor(x0 / ROAD_TILE); tx <= Math.floor((x1 - 1) / ROAD_TILE); tx++) {
      for (const p of _bins.get(roadTileKey(tx, ty))?.list ?? [])
        if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) out.push(p);
    }
  }
  return out;
}

/** A region's places across a thread and into the roads' cache: each pixel's key and its type. @param {PastBayPlace[]} places */
export function packPastBayPlaces(places) {
  return { keys: Float64Array.from(places, (p) => beyondKey(p.x, p.y)), types: Uint8Array.from(places, (p) => p.type) };
}
/** And back. @param {?{ keys: Float64Array, types: Uint8Array }} packed @returns {PastBayPlace[]} */
export function unpackPastBayPlaces(packed) {
  const out = [];
  for (let i = 0; i < (packed?.keys?.length ?? 0); i++) {
    const [x, y] = beyondPixel(packed.keys[i]);
    out.push({ x, y, type: packed.types[i] });
  }
  return out;
}
