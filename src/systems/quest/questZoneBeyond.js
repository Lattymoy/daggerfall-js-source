// @ts-check
// QUEST-ZONE BEYOND (the owner, 2026-10-30, answering bible/01-Overview/audits/Quest-Audit-IV.md's open question: draw
// the dungeon outside the zone): ONLINE, A QUESTOR INSIDE THE OPEN ZONE SENDS THE PLAYER OUT OF IT. The zone seals every
// dungeon in it (quest/place.js _zoneSeal), and since WW-C2 it is a whole province, so its questors found none. The draw
// goes on near the land nearest outside the zone (place.js _beyondZoneSite). DFU has no zone: Port-Ledger A, QUEST-ZONE.
import { wildInside } from '../wild/wildZone.js';
import { theatreAt, inWorldGrid, worldPixelKey } from '../../world/worldWide/worldGrid.js';

/** How far, map pixels (the travel reckoning's longest axis), the land outside the zone is looked for. Cyrodiil's
 *  Imperial City lies 297 from it (measured on the freeware). */
export const ZONE_BEYOND_MAX_PX = 512;

/** Land the Bay or a province holds: no sea, no pixel off the continent. @param {number} x @param {number} y */
const onLand = (x, y) => theatreAt(x, y) >= 0;

/** @type {WeakMap<object, Map<number, ?{ x: number, y: number }>>} */
const _kept = new WeakMap();

/**
 * The land pixel nearest (px, py) outside the zone's mask - the nearest ring, and of it the straightest, a tie the first
 * in its one order, so every client finds the same; null where (px, py) is not inside the zone or no land lies within
 * `max`. Kept by mask and pixel.
 * @param {any} mask @param {number} px @param {number} py
 * @param {{ landAt?: (x: number, y: number) => boolean, max?: number }} [opts]
 */
export function nearestBeyondZone(mask, px, py, { landAt = onLand, max = ZONE_BEYOND_MAX_PX } = {}) {
  if (!mask || !inWorldGrid(px, py) || !wildInside(mask, px, py)) return null;
  const kept = landAt === onLand && max === ZONE_BEYOND_MAX_PX ? (_kept.get(mask) ?? _kept.set(mask, new Map()).get(mask)) : null;
  const key = worldPixelKey(px, py);
  if (kept?.has(key)) return kept.get(key) ?? null;
  let found = null, best = Infinity;
  for (let d = 1; d <= max && !found; d++) {
    for (let y = py - d; y <= py + d; y++) {
      const step = y === py - d || y === py + d ? 1 : 2 * d;   // the top and bottom rows whole, the sides their two ends
      for (let x = px - d; x <= px + d; x += step) {
        // a ring is one travel distance: of its land, the straightest way out (a corner is a diagonal's length)
        const e = (x - px) ** 2 + (y - py) ** 2;
        if (e < best && inWorldGrid(x, y) && !wildInside(mask, x, y) && landAt(x, y)) { found = { x, y }; best = e; }
      }
    }
  }
  kept?.set(key, found);
  return found;
}
