// @ts-check
// ═══════════════════════════════════════════════════════════════════
// KETCH-EVERYWHERE (2026-10-26, the owner after the audit "no system left behind in the Bay": "Every single thing here
// needs to be addressed. No exceptions."; bible/11-Multiplayer/Sky-Ketch.md section 22): THE STATIONS PAST THE BAY ON THIS
// SCREEN - where each province's Sky-Ketch keeps station (net/ketch/ketchLaw.js KT_THEATRES, KT_STATION_CITIES), and
// whether this screen stands them.
//
//   WHERE: a station's city is the place of its name in its province among TESA's places (world/arenaPlaces.js
//     arenaPixels - the lore's cities and the capitals pinned on their own pixels, on the room's trace and fit, so every
//     client finds the same pixel); her middle is that pixel's (a town's middle is its pixel's whatever its blocks -
//     world/terrain/terrainTiles.js getLocationTerrainTileOrigin centres every location), and she keeps station KT_STATION
//     off it (world/ketch/ketchModel.js), the Bay's own law over Daggerfall's row. The Bay's station is the ketch client's
//     own read of Daggerfall's row, as it always was.
//   WHETHER: the land past the Bay's places stand (arenaStanding) and the relay keeps a station's ships (net/online.js
//     ktTheatresOk) - the ketch client says so a frame (setKetchStationsStanding), and the Timers read it.
//
// Not a DFU member: Daggerfall has no airship. Ledger A (KETCH).
// ═══════════════════════════════════════════════════════════════════
import { KT_STATION_CITIES, ketchStationOk } from '../../net/ketch/ketchLaw.js';
import { arenaPixels, arenaStanding } from '../../world/arenaPlaces.js';
import { THEATRE_KEYS, BAY_THEATRE } from '../../world/worldWide/worldGrid.js';
export { ketchStationsStanding, setKetchStationsStanding, ketchStationHere } from './ketchStanding.js';   // the light half, the Timers'
import { TERRAIN_SIZE } from '../../world/terrain/terrainSampler.js';

/** How near a station's city (map pixels, either way) this screen frames her ship - as far as she flies from her station
 *  (scenes/ketch/ketchSky.js KT_SKY: `approach` in, `far` out, 12,500 m) and a pixel more: ceil(12500 / 819.2) + 1, pinned
 *  to the sky's own numbers (a literal here, so the Timers' read of this file pulls no renderer in). */
export const KT_STATION_REACH_PX = 17;
/** A station's city's middle within its pixel (metres east and north of its south-west corner). */
export const KT_STATION_MIDDLE = TERRAIN_SIZE / 2;

let _pixels = null;
/** @type {Map<number, { x: number, y: number } | null>} */ let _at = new Map();
/**
 * The map pixel of station `theatre`'s city past the Bay - the place of its name in its province (arenaPixels' stood
 * list), or null: the Bay's (the ketch client's own row), a theatre with no station, the places not standing. Kept while
 * the places stand as they are.
 * @param {number} theatre
 */
export function ketchStationPixel(theatre) {
  if (theatre === BAY_THEATRE || !ketchStationOk(theatre) || !arenaStanding()) return null;
  const ap = arenaPixels();
  if (ap !== _pixels) { _pixels = ap; _at = new Map(); }
  if (!ap) return null;
  if (!_at.has(theatre)) {
    const p = ap.stood.find((q) => q.name === KT_STATION_CITIES[theatre] && q.province === THEATRE_KEYS[theatre]);
    _at.set(theatre, p ? Object.freeze({ x: p.bx, y: p.by }) : null);
  }
  return _at.get(theatre) ?? null;
}
/** Is map pixel (px, py) within KT_STATION_REACH_PX of station `theatre`'s city past the Bay. */
export function ketchStationNear(theatre, px, py) {
  const s = ketchStationPixel(theatre);
  return !!s && Number.isFinite(px) && Number.isFinite(py) && Math.max(Math.abs(s.x - px), Math.abs(s.y - py)) <= KT_STATION_REACH_PX;
}
