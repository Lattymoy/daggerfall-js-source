// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA13 (2026-10-24, bible/03-World/Arena-Provinces.md TESA13) - THE LAND PAST THE BAY'S SMALL PLACES, READ A TILE AT A
// TIME.
//
// The countryside (TESA7) and the lairs (TESA8) are rolled a pixel at a time by the world host as it builds
// (scenes/world.js countryRollAt, lairRollAt): no list of them exists, and the continent holds a few hundred thousand.
// This keeps a roll read a tile at a time: an ask reads the tiles it has and rolls only the ones it reaches, and the
// oldest tiles go past ATLAS_TILES_KEPT. A tile is rolled again when anything the roll reads moves (atlasStamp): the
// trace or the fit landing, the places past the Bay standing, the capitals (TESA14: no road takes a place's pixel now -
// the roads are laid round the places). THE ROLL IS DEAR - a candidate's ground is the terrain kernel's mean
// (world/spawnedDungeons.js spawnPlateauFloor: a 129 x 129 sampling).
//
// TESA15: its reader is the roads' worker (world/tamrielRoadsWorker.js: a region's grid, its apron's tiles kept for the
// next region's), off the page's thread. TESA13's own reader, the held map rolling its view a frame's budget at a time,
// is retired: the map reads the places the regions laid (world/pastBayPlaces.js), and the budget went with it.
// ═══════════════════════════════════════════════════════════════════
import { inBay, tamrielFit } from './tamriel/tamrielFrame.js';
import { tamrielLandVersion } from './tamriel/tamrielLand.js';
import { arenaPlacesVersion } from './arenaPlaces.js';
import { capitalsVersion } from './tamrielCapitals.js';

/** A tile's side, Bay pixels - a few milliseconds of rolling where the land is thick with places. */
export const ATLAS_TILE = 32;
/** How many tiles are kept - the oldest read goes first. TESA15: four of the roads worker's regions' grids. */
export const ATLAS_TILES_KEPT = 2048;

/** Everything a tile's roll reads that can move after the boot, as a list compared item by item. */
export const atlasStamp = () => [tamrielLandVersion(), tamrielFit(), arenaPlacesVersion(), capitalsVersion()];
const sameStamp = (a, b) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * The atlas over a roll. `placeAt(x, y)` answers the place a pixel past the Bay stands - `{ type, name }`, the type a
 * MAPS.BSA location type - or null; it is asked of no pixel of the Bay.
 * @param {(x: number, y: number) => ?{ type: number, name: string }} placeAt
 * @param {() => any[]} [stamp]
 */
export function createTamrielAtlas(placeAt, stamp = atlasStamp) {
  /** @type {Map<string, Array<{ x: number, y: number, type: number, name: string }>>} */
  const tiles = new Map();
  let kept = null;
  function rollTile(tx, ty) {
    const out = [];
    const x0 = tx * ATLAS_TILE,
      y0 = ty * ATLAS_TILE;
    for (let y = y0; y < y0 + ATLAS_TILE; y++) {
      for (let x = x0; x < x0 + ATLAS_TILE; x++) {
        if (inBay(x, y)) continue;
        const p = placeAt(x, y);
        if (p) out.push({ x, y, type: p.type, name: p.name });
      }
    }
    return out;
  }
  return {
    /** The places on the pixels x0 <= x < x1, y0 <= y < y1 (Bay pixels, whole numbers) - the tiles kept read, the rest
     *  rolled. */
    placesIn(x0, y0, x1, y1) {
      const s = stamp();
      if (!sameStamp(kept, s)) {
        tiles.clear();
        kept = s;
      }
      const out = [];
      if (x1 <= x0 || y1 <= y0) return out;
      const had = [];
      for (let ty = Math.floor(y0 / ATLAS_TILE); ty <= Math.floor((y1 - 1) / ATLAS_TILE); ty++) {
        for (let tx = Math.floor(x0 / ATLAS_TILE); tx <= Math.floor((x1 - 1) / ATLAS_TILE); tx++) {
          if (!tiles.has(`${tx},${ty}`)) tiles.set(`${tx},${ty}`, rollTile(tx, ty));
          had.push([tx, ty]);
        }
      }
      for (const [tx, ty] of had) {
        const key = `${tx},${ty}`;
        const tile = /** @type {Array<{ x: number, y: number, type: number, name: string }>} */ (tiles.get(key));
        tiles.delete(key); // read again: to the back of the line
        tiles.set(key, tile);
        for (const p of tile) if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) out.push(p);
      }
      while (tiles.size > ATLAS_TILES_KEPT) tiles.delete(/** @type {string} */ (tiles.keys().next().value));
      return out;
    },
    /** How many tiles are kept now. */
    tilesKept: () => tiles.size,
  };
}
