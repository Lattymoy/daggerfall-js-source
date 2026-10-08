// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL2 (2026-10-08, bible/03-World/Tamriel.md) - THE GROUND BEYOND THE BAY: the land mass, streamed.
//
// Mac: "Lets worry about this later and only implement the land mass." The towns, the dungeons, the regions and the
// roads wait; the GROUND does not. Daggerfall's streamed world grows every tile from two bytes a map pixel - WOODS.WLD's
// height and CLIMATE.PAK's climate - through DFU's own kernel (world/terrainSampler.js, world/terrainGen.js), and that
// kernel asks for them through three reads: getHeightMapValue, getHeightMapValuesRange1Dim and
// getLargeHeightMapValuesRange (the large map's 5x5 of detail a pixel). This module answers those reads for any pixel
// of the continent's frame (world/tamrielFrame.js): the Bay's own bytes on the Bay, and the authored continent's past
// it (world/tamrielGeography.js) - so a player who walks off the Bay's edge finds the land going on, textured by its
// province's climate, with the climate's own trees and nothing built on it.
//
// THE BAY IS NOT MOVED BY A BYTE. The kernel reads a 4 x 4 window of small heights round a pixel and a 3 x 3 of large
// ones, and at the Bay's edge that window reaches past the data - where WoodsFile CLAMPS to the edge's own pixel. Any
// other answer there would re-shape the Bay's edge tiles, and every anchor, save and seam that stands on them. So the
// seam band (SEAM_PX pixels past the edge) answers EXACTLY the clamped read, and the authored ground blends in from the
// edge's byte over BLEND_PX pixels after it: test/tamriel2.test.js holds every Bay pixel's samples byte-identical with
// the ground composed and without.
//
// THE HEIGHT LAW is the raster's (world/tamrielRaster.js reads it from here, one home): the sea's byte is 0; land starts
// at SHORE_BYTE and rises with distance from the coast to INLAND_BYTE over PLAIN_REACH picture units; a range lifts its
// band toward SNOW_BYTE by its gain; a lattice hash of ±2 keeps a plain from reading as a contour. Pure, deterministic,
// cached a pixel (the stream asks the same few hundred pixels many times).
// ═══════════════════════════════════════════════════════════════════
import { provinceAt, coastDistance, rangeLift, provinceByKey } from './tamrielGeography.js';
import { bayToPicture, inBay, BAY_W, BAY_H } from './tamrielFrame.js';
import { CLIMATES } from '../formats/mapsTables.js';

/** The height law's bytes (WOODS' own units: byte * 8 metres; the sea at 3 and under). */
export const SHORE_BYTE = 5;
export const INLAND_BYTE = 22;
export const SNOW_BYTE = 112;
/** How far inland (picture units) the plain takes to rise from the shore to INLAND_BYTE. */
export const PLAIN_REACH = 6;
/** The seam: this many pixels past the Bay's edge answer the Bay's own clamped read, so the kernel's windows at the
 *  edge see what they always saw. The kernel's small window reaches 2 past a pixel, its large one 1. */
export const SEAM_PX = 2;
/** The authored ground blends in from the edge's byte over this many pixels after the seam. */
export const BLEND_PX = 12;
/** The ground's cache: pixels remembered before the cache is dropped whole (the stream asks a few hundred). */
export const GROUND_CACHE_MAX = 262144;

/** A small stable lattice hash, 0..1 (the fog's own shape, ui/wildMapInk.js - a hash, not a table). */
export function groundHash(x, y, salt = 0x51ed) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** THE AUTHORED HEIGHT at a picture-grid point, in WOODS bytes: 0 at sea, SHORE_BYTE and up on land. */
export function authoredHeightByte(px, py, noise = 0) {
  if (!provinceAt(px, py)) return 0;
  const inland = Math.min(1, coastDistance(px, py) / PLAIN_REACH);
  let h = SHORE_BYTE + (INLAND_BYTE - SHORE_BYTE) * inland + noise;
  const lift = rangeLift(px, py);
  if (lift > 0) h = Math.max(h, SHORE_BYTE + (SNOW_BYTE - SHORE_BYTE) * lift);
  return Math.max(SHORE_BYTE, Math.min(255, Math.round(h)));
}

/** How far a Bay-coordinate pixel stands past the Bay's edge, in pixels (0 on the Bay): Chebyshev, so the seam is a
 *  square band round the rectangle as the kernel's window is. */
export function bayEdgeDistance(x, y) {
  return Math.max(0, -x, x - (BAY_W - 1), -y, y - (BAY_H - 1));
}

/** @type {Map<number, number>} */
const _bytes = new Map();
const cacheKey = (x, y) => (x + 8192) * 32768 + (y + 8192);
/** For the pins: the cache's size, and a way to drop it. */
export const groundCacheSize = () => _bytes.size;
export const dropGroundCache = () => _bytes.clear();

/** THE AUTHORED HEIGHT at a Bay-coordinate pixel beyond the Bay (integers), with the lattice noise, cached. Asked of
 *  a pixel on the Bay it still answers the authored law - the composition below is what chooses. */
export function tamrielHeightByte(x, y) {
  const k = cacheKey(x, y);
  const hit = _bytes.get(k);
  if (hit !== undefined) return hit;
  const [px, py] = bayToPicture(x + 0.5, y + 0.5);
  const byte = authoredHeightByte(px, py, (groundHash(x, y) - 0.5) * 4);
  if (_bytes.size >= GROUND_CACHE_MAX) _bytes.clear();
  _bytes.set(k, byte);
  return byte;
}

/** The climate at a Bay-coordinate pixel beyond the Bay: the province's, or the Ocean's at sea. */
export function tamrielClimateAt(x, y) {
  const [px, py] = bayToPicture(x + 0.5, y + 0.5);
  const p = provinceAt(px, py);
  return p ? (provinceByKey(p.key)?.climate ?? CLIMATES.Woodlands) : CLIMATES.Ocean;
}

/** The large map's 5 x 5 of detail for a pixel beyond the Bay - data[x][y] as WoodsFile.getLargeMapData shapes it: a
 *  lattice hash of small bytes (0..9; the kernel scales them by NOISE_MAP_SCALE), deterministic in the pixel. */
export function tamrielLargeMap(x, y) {
  const data = [];
  for (let ix = 0; ix < 5; ix++) {
    const col = new Uint8Array(5);
    for (let iy = 0; iy < 5; iy++) col[iy] = Math.floor(groundHash(x * 5 + ix, y * 5 + iy, 0x2545) * 10);
    data.push(col);
  }
  return data;
}

/**
 * THE COMPOSITION: a WoodsFile with the continent round it. A prototype child of the Bay's own reader, so every
 * read WoodsFile builds on these two (the range reads call them through `this`) answers the continent too, and
 * nothing else about the reader changes - its buffer, its header, its writers stay the Bay's.
 *   - on the Bay, and in the SEAM band past its edge: the Bay's own (clamped) read, to the byte
 *   - past the seam: the authored ground, blended in from the edge's byte over BLEND_PX pixels
 * @param {any} woods - a loaded WoodsFile (or the pins' stub with its two reads)
 */
export function groundWoods(woods) {
  const ground = Object.create(woods);
  ground.getHeightMapValue = function (x, y) {
    const d = bayEdgeDistance(x, y);
    if (d <= SEAM_PX) return woods.getHeightMapValue(x, y);
    const edge = woods.getHeightMapValue(x, y);   // the clamp's answer: the nearest edge pixel's byte
    const t = Math.min(1, (d - SEAM_PX) / BLEND_PX);
    return Math.round(edge * (1 - t) + tamrielHeightByte(x, y) * t);
  };
  ground.getLargeMapData = function (x, y) {
    return bayEdgeDistance(x, y) <= SEAM_PX ? woods.getLargeMapData(x, y) : tamrielLargeMap(x, y);
  };
  ground.isTamrielGround = true;
  ground.bay = woods;
  return ground;
}

/** The climate read with the continent round it: the Bay's own on the Bay (the reader's, after the coastal
 *  dilation), the province's past it. */
export function groundClimateIndex(bayClimateIndex) {
  return (x, y) => (inBay(x, y) ? bayClimateIndex(x, y) : tamrielClimateAt(x, y));
}
