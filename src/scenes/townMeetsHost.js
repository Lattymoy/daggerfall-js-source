// @ts-check
// ACROSS-EDGE (FB1029, bible/01-Overview/bugs/Field-Bugs-2026-10-29c.md): THE TOWNS A PIXEL'S GROUND MEETS - each
// Bay town of its 3 x 3 (a city, a hamlet or a village of MAPS.BSA, never a spawn or a capital) with its outline as that
// pixel's own build stamps it, handed to the kernel (world/terrain/townMeet.js). The build, the records' frame and the
// tools ask the same law, so every one of them meets the same towns.
import { setLocationTiles } from '../world/terrain/terrainTiles.js';
import { inBay } from '../world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';

/** The location types a meet is read for: the Bay's towns. */
export const MEET_TYPES = Object.freeze(
  new Set([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]),
);
/** How many pixels' outlines are kept (2 KB of rect and 16 KB of outline each). */
export const ABOUT_KEPT = 64;

/** Whether a ground location's outline is met across its pixel's edge. @param {any} loc */
export const meetsTown = (loc) =>
  !!loc?.exterior?.exteriorData && MEET_TYPES.has(loc.mapTableData?.locationType) && !loc.spawned && !loc.capital;

/**
 * The towns about each pixel, over `groundLocationAt(px, py)` - the place the pixel's own build stands its ground for -
 * and the files its outline is stamped from. `about(px, py, ownShape)` answers [{ px, py, shape }] (null for none), its
 * own pixel's outline handed (its build has it stamped already).
 * @param {{ groundLocationAt: (px: number, py: number) => any, maps: any, blocks: any }} deps
 */
export function createTownMeets({ groundLocationAt, maps, blocks }) {
  const kept = new Map();
  /** A town's tiles laid out (LEGIBLE 3: the cast on its own call, where the formatter leaves it). */
  const tilesOf = (loc) => /** @type {any} */ (setLocationTiles(loc, maps, blocks, new Uint8Array(128 * 128)));
  /** A Bay pixel's town's outline, kept while the same place stands there. */
  const outlineAt = (x, y) => {
    const loc = groundLocationAt(x, y),
      k = `${x},${y}`,
      had = kept.get(k);
    kept.delete(k);
    const shape = had && had.loc === loc ? had.shape : meetsTown(loc) ? (tilesOf(loc)?.shape ?? null) : null;
    kept.set(k, { loc, shape });
    while (kept.size > ABOUT_KEPT) kept.delete(kept.keys().next().value);
    return shape;
  };
  /** @param {number} px @param {number} py @param {?Uint8Array} [ownShape] the pixel's own town's outline, when it meets one */
  const about = (px, py, ownShape = null) => {
    const out = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx,
          y = py + dy;
        if (!inBay(x, y)) continue;
        const shape = dx || dy ? outlineAt(x, y) : ownShape;
        if (shape) out.push({ px: x, py: y, shape });
      }
    return out.length ? out : null;
  };
  return { about, outlineAt };
}
