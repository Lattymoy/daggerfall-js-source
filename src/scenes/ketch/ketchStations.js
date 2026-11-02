// @ts-check
// ═══════════════════════════════════════════════════════════════════
// KETCH-EVERYWHERE (2026-10-26, the owner after the audit "no system left behind in the Bay": "Every single thing here
// needs to be addressed. No exceptions."; bible/11-Multiplayer/Sky-Ketch.md section 22): THE STATIONS ON THIS SCREEN - where
// each province's Sky-Ketch keeps station, at its crown capital (net/ketch/ketchLaw.js KT_THEATRES, KT_STATION_CROWNS,
// KT_STATION_CITIES), and whether this screen stands them.
//
//   WHERE: a Bay crown's station (High Rock's Daggerfall, Hammerfell's Sentinel) is its city's own MAPS.BSA row
//     (KT_BAY_STATION_ROWS - its pixel pinned, the client reading the row for its middle, Daggerfall's as it always did);
//     a province's past the Bay is the place of its seat's name in its province among TESA's places (world/arenaPlaces.js
//     arenaPixels - the capitals pinned on their own pixels, on the room's trace and fit, so every client finds the same
//     pixel), her middle that pixel's (a town's middle is its pixel's whatever its blocks - world/terrain/terrainTiles.js
//     getLocationTerrainTileOrigin centres every location); she keeps station KT_STATION off it (world/ketch/ketchModel.js),
//     the Bay's own law over Daggerfall's row.
//   WHETHER: the relay keeps those stations' ships (net/online.js ktTheatresOk) and, past the Bay, the land's places stand
//     (arenaStanding) - the ketch client says so a frame (setKetchStationsStanding), and the Timers read it.
//
// Not a DFU member: Daggerfall has no airship. Ledger A (KETCH).
// ═══════════════════════════════════════════════════════════════════
import { KT_STATION_CITIES, ketchStationOk } from '../../net/ketch/ketchLaw.js';
import { arenaPixels, arenaStanding } from '../../world/arenaPlaces.js';
import { THEATRE_KEYS } from '../../world/worldWide/worldGrid.js';
export { ketchStationsStanding, setKetchStationsStanding, ketchStationHere } from './ketchStanding.js'; // the light half, the Timers'
import { TERRAIN_SIZE } from '../../world/terrain/terrainSampler.js';
import { ARENA_REGION, ARENA_LOCATION } from '../../world/arena/arenaCity.js'; // Daggerfall's own row (the arena's city)

/** How near a station's city (map pixels, either way) this screen frames her ship - as far as she flies from her station
 *  (scenes/ketch/ketchSky.js KT_SKY: `approach` in, `far` out, 12,500 m) and a pixel more: ceil(12500 / 819.2) + 1, pinned
 *  to the sky's own numbers (a literal here, so the Timers' read of this file pulls no renderer in). */
export const KT_STATION_REACH_PX = 17;
/** A station's city's middle within its pixel past the Bay (metres east and north of its south-west corner). */
export const KT_STATION_MIDDLE = TERRAIN_SIZE / 2;
/** THE BAY'S CROWN STATIONS, by lane: their city's MAPS.BSA row (`region`, `location` - world/arena/arenaCity.js
 *  ARENA_REGION/ARENA_LOCATION for Daggerfall) and its map pixel (formats/mapsFile.js longitudeLatitudeToMapPixel of that
 *  row - pinned against MAPS.BSA, test/net/ketch/ketch_everywhere.test.js). */
export const KT_BAY_STATION_ROWS = Object.freeze({
  0: Object.freeze({ region: ARENA_REGION, location: ARENA_LOCATION, px: Object.freeze({ x: 207, y: 213 }) }), // Daggerfall
  2: Object.freeze({ region: 20, location: 6, px: Object.freeze({ x: 397, y: 343 }) }), // Sentinel
});

let _pixels = null;
/** @type {Map<number, { x: number, y: number } | null>} */ let _at = new Map();
/**
 * The map pixel of station `theatre`'s city (its lane's - KT_THEATRES): a Bay crown's its row's (KT_BAY_STATION_ROWS); a
 * province's past the Bay the place of its seat's name in its province (arenaPixels' stood list), kept while the places
 * stand as they are; null for a lane with no station, or the places past the Bay not standing.
 * @param {number} theatre
 */
export function ketchStationPixel(theatre) {
  if (!ketchStationOk(theatre)) return null;
  const row = /** @type {Record<number, { px: { x: number, y: number } }>} */ (KT_BAY_STATION_ROWS)[theatre];
  if (row) return row.px;
  if (!arenaStanding()) return null;
  const ap = arenaPixels();
  if (ap !== _pixels) {
    _pixels = ap;
    _at = new Map();
  }
  if (!ap) return null;
  if (!_at.has(theatre)) {
    const p = ap.stood.find((q) => q.name === KT_STATION_CITIES[theatre] && q.province === THEATRE_KEYS[theatre]);
    _at.set(theatre, p ? Object.freeze({ x: p.bx, y: p.by }) : null);
  }
  return _at.get(theatre) ?? null;
}
/** Is map pixel (px, py) within KT_STATION_REACH_PX of station `theatre`'s city. */
export function ketchStationNear(theatre, px, py) {
  const s = ketchStationPixel(theatre);
  return (
    !!s &&
    Number.isFinite(px) &&
    Number.isFinite(py) &&
    Math.max(Math.abs(s.x - px), Math.abs(s.y - py)) <= KT_STATION_REACH_PX
  );
}
