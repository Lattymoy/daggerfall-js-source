// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAP-WATERS (2026-10-26, the coordinator: "The held map should draw G's Cyrodiil rivers and smoothed lake shores";
// bible/03-World/Arena-Provinces.md MAP-WATERS): THE MAP'S COPY OF STREAM G'S WATERS - each river's centre line and its
// widths, each lake's ring (world/tamriel/tamrielWaters.js tamrielWaters), made where the law is already compiled - the
// terrain worker, which carves with it (world/terrain/terrainGenWorker.js 'waters') - and installed here for the held map
// to ink (ui/tamrielInk.js), so the law's compile (some 0.6 s on the freeware's trace) never lands on the map's open.
// Pure: a store and a packing, worker-safe.
// ═══════════════════════════════════════════════════════════════════

import { tamrielWaters } from './tamrielWaters.js';

/** @typedef {{ key: string, n: number, pts: Float32Array, width: Float32Array }} InkRiver */
/** @typedef {{ rivers: InkRiver[], lakes: Float32Array[] }} WatersInk */

/** @type {?WatersInk} */
let _ink = null;
let _version = 0;

/** The waters the map inks, or null (none installed: no trace, no answer yet). */
export const watersInk = () => _ink;
/** Moves on every install: the map's tiles' word reads it (ui/tamrielInk.js pastBayStamp). */
export const watersInkVersion = () => _version;
/** Install (or, null, drop) the map's waters. */
export function setWatersInk(ink) {
  _ink = ink;
  _version++;
}

/**
 * The law's rivers and lakes packed for the map - Float32 points (Bay coordinates; a river's metres of width a point),
 * a lake's ring - and the transfer list that moves them.
 * @param {?{ rivers: Array<{ key: string, n: number, pts: ArrayLike<number>, width: ArrayLike<number> }>, lakes: Array<{ ring: ArrayLike<number> }> }} law
 * @returns {{ ink: ?WatersInk, transfer: ArrayBuffer[] }}
 */
export function packWatersInk(law) {
  if (!law) return { ink: null, transfer: [] };
  const rivers = law.rivers.map((r) => ({
    key: r.key,
    n: r.n,
    pts: Float32Array.from(r.pts),
    width: Float32Array.from(r.width),
  }));
  const lakes = law.lakes.map((l) => Float32Array.from(l.ring));
  return {
    ink: { rivers, lakes },
    transfer: [...rivers.flatMap((r) => [r.pts.buffer, r.width.buffer]), ...lakes.map((l) => l.buffer)],
  };
}

/** The live law's waters packed (the worker's answer to 'waters'; the main thread's own with no worker). */
export const lawWatersInk = () => packWatersInk(tamrielWaters());
