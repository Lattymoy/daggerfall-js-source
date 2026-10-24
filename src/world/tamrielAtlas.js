// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA13 (2026-10-24, bible/03-World/Arena-Provinces.md TESA13) - THE LAND PAST THE BAY'S SMALL PLACES, READ FOR THE MAP.
//
// The countryside (TESA7) and the lairs (TESA8) are rolled a pixel at a time by the world host as it builds
// (scenes/world.js countryRollAt, lairRollAt): no list of them exists, and the continent holds a few hundred thousand.
// The held map asks for the ones in its view. This keeps the host's own roll, read a tile at a time: a pan reads the
// tiles it has and rolls only the ones it reaches, and the oldest tiles go past ATLAS_TILES_KEPT. A tile is rolled
// again when anything the roll reads moves (atlasStamp): the trace or the fit landing, the places past the Bay standing,
// the capitals (TESA14: no road takes a place's pixel now - the roads are laid round the places).
//
// THE ROLL IS DEAR. A candidate's ground is the terrain kernel's mean (world/spawnedDungeons.js spawnPlateauFloor: a
// 129 x 129 sampling), so a view in to the Bay's scale is seconds of rolling. An ask may carry a budget: the tiles nearest
// the asked rectangle's middle are rolled first until it is spent, what is rolled comes back, and the atlas says more is
// owed (takePending) - the map asks again on its next frame and the marks fill in.
// ═══════════════════════════════════════════════════════════════════
import { inBay, tamrielFit } from './tamrielFrame.js';
import { tamrielLandVersion } from './tamrielLand.js';
import { arenaPlacesVersion } from './arenaPlaces.js';
import { capitalsVersion } from './tamrielCapitals.js';

/** A tile's side, Bay pixels - a few milliseconds of rolling where the land is thick with places. */
export const ATLAS_TILE = 32;
/** How many tiles are kept - the oldest read goes first. Four views in to the Bay's scale. */
export const ATLAS_TILES_KEPT = 2048;
/** The held map's budget an ask, milliseconds (scenes/world.js) - a frame's share. */
export const ATLAS_BUDGET_MS = 6;

/** Everything a tile's roll reads that can move after the boot, as a list compared item by item. */
export const atlasStamp = () => [tamrielLandVersion(), tamrielFit(), arenaPlacesVersion(), capitalsVersion()];
const sameStamp = (a, b) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * The atlas over a host's roll. `placeAt(x, y)` answers the place a pixel past the Bay stands - `{ type, name }`, the
 * type a MAPS.BSA location type - or null; it is asked of no pixel of the Bay.
 * @param {(x: number, y: number) => ?{ type: number, name: string }} placeAt
 * @param {() => any[]} [stamp] @param {() => number} [now] the clock a budget is spent on, milliseconds
 */
export function createTamrielAtlas(placeAt, stamp = atlasStamp, now = () => performance.now()) {
  /** @type {Map<string, Array<{ x: number, y: number, type: number, name: string }>>} */
  const tiles = new Map();
  let kept = null, pending = false;
  function rollTile(tx, ty) {
    const out = [];
    const x0 = tx * ATLAS_TILE, y0 = ty * ATLAS_TILE;
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
    /** The places on the pixels x0 <= x < x1, y0 <= y < y1 (Bay pixels, whole numbers) on the tiles rolled - every tile
     *  with no budget, else those kept and as many more as `budgetMs` rolls, the nearest the middle first. */
    placesIn(x0, y0, x1, y1, budgetMs = Infinity) {
      const s = stamp();
      if (!sameStamp(kept, s)) { tiles.clear(); kept = s; }
      const out = [];
      if (x1 <= x0 || y1 <= y0) return out;
      const had = [], owed = [];
      for (let ty = Math.floor(y0 / ATLAS_TILE); ty <= Math.floor((y1 - 1) / ATLAS_TILE); ty++) {
        for (let tx = Math.floor(x0 / ATLAS_TILE); tx <= Math.floor((x1 - 1) / ATLAS_TILE); tx++) (tiles.has(`${tx},${ty}`) ? had : owed).push([tx, ty]);
      }
      const mx = (x0 + x1) / 2 / ATLAS_TILE - 0.5, my = (y0 + y1) / 2 / ATLAS_TILE - 0.5;
      owed.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));
      const start = now();
      let rolled = 0;
      for (const t of owed) {
        if (now() - start >= budgetMs) break;
        tiles.set(`${t[0]},${t[1]}`, rollTile(t[0], t[1]));
        had.push(t);
        rolled++;
      }
      if (rolled < owed.length) pending = true;
      for (const [tx, ty] of had) {
        const key = `${tx},${ty}`;
        const tile = /** @type {Array<{ x: number, y: number, type: number, name: string }>} */ (tiles.get(key));
        tiles.delete(key);   // read again: to the back of the line
        tiles.set(key, tile);
        for (const p of tile) if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) out.push(p);
      }
      while (tiles.size > ATLAS_TILES_KEPT) tiles.delete(/** @type {string} */ (tiles.keys().next().value));
      return out;
    },
    /** Did an ask since the last call leave tiles unrolled? Answered once: the flag goes with the answer. */
    takePending() { const p = pending; pending = false; return p; },
    /** How many tiles are kept now. */
    tilesKept: () => tiles.size,
  };
}
