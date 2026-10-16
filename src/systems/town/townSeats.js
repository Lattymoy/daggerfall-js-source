// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT1a (2026-09-30, Mac: "Finish the seats") — THE SEATS OF THE ILIAC
// BAY, as every client derives them (bible/11-Multiplayer/Seats-Arc.md
// 3.1).
//
// Mac: "So the 3 main castle hubs should be larger capture points, while
// every other location with a palace (must have) will be a lower capture
// point"; asked which palace locations: "Every palace location". So:
//   - a CROWN seat: a location named for one of the three kingdoms'
//     capitals (regionHubs.js HUB_CAPITALS) that stands in the region of
//     that name - Daggerfall (17), Wayrest (23), Sentinel (20);
//   - a PALACE seat: every other location whose building records hold a
//     Palace (buildingType 16, world/buildingNames.js) - read off
//     MAPS.BSA's own building list, no block loaded;
//   - one seat a location however many Palace records it holds; a
//     capital is never also a palace seat; no palace, no seat.
//
// THE GAME'S OWN ROWS ALONE (HUB1's and GATE-SEEN's law): a world-data
// mod's rows are appended where Replace Game Artwork is on, which is each
// client's own switch, so they never count - the host hands this the same
// base rows pickRegionHubs reads. And the servers hold no ARENA2: each
// client reports the seats it derived, and the account service trusts a
// seat only when enough of them agree (net/townSeatLaw.js, 3.2).
//
// Pure: the rows are an argument. tools/seatCount.mjs runs it over a
// player's own ARENA2 (SEAT-COUNT).
// ═══════════════════════════════════════════════════════════════════
import { longitudeLatitudeToMapPixel, REGION_NAMES } from '../../formats/mapsFile.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { HUB_CAPITALS } from '../region/regionHubs.js';
import { kingdomOf, isMarch, isFreeLand } from '../../net/kingdomLaw.js';
import { CROWN_SEAT_REGIONS, seatReportOf } from '../../net/townSeatLaw.js';

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether a location's building records hold a Palace (buildingType 16). */
export const hasPalace = (loc) => (loc?.exterior?.buildings ?? []).some((b) => b?.buildingType === BUILDING_TYPES.Palace);

/**
 * A location's seat, or null - `{ key, name, region, tier, pixel: [x, y], kingdom, isHub }`, `key` its map id unsigned.
 * `regionNameOf` names a region; `isHub(key)` says whether the location is its region's hub (regionHubs.js).
 * @param {any} loc
 * @param {{ regionNameOf?: (r: number) => string, isHub?: (key: number) => boolean }} [opts]
 */
export function seatOfLocation(loc, { regionNameOf = (r) => REGION_NAMES[r] ?? '', isHub = () => false } = {}) {
  if (!loc || !Number.isInteger(loc.regionIndex) || !loc.mapTableData) return null;
  const region = loc.regionIndex;
  const crown = Object.prototype.hasOwnProperty.call(CROWN_SEAT_REGIONS, region)
    && HUB_CAPITALS.some((c) => same(c, loc.name) && same(c, regionNameOf(region)));
  if (!crown && !hasPalace(loc)) return null;
  const px = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
  const seat = seatReportOf({ key: loc.mapTableData.mapId >>> 0, name: String(loc.name ?? '').trim(), region, tier: crown ? 'crown' : 'palace', pixel: [px.x, px.y] });
  if (!seat) return null;
  return Object.freeze({ ...seat, pixel: Object.freeze(seat.pixel), kingdom: kingdomOf(region), isHub: !!isHub(seat.key) });
}

/**
 * THE SEATS over `locations` (the host's own reading of every location, the game's own rows - `isBase`), each once, in
 * key order. Answers `{ list, byMapId }`.
 * @param {Iterable<any>|null|undefined} locations
 * @param {{ regionNameOf?: (r: number) => string, isBase?: (loc: any) => boolean, isHub?: (key: number) => boolean }} [opts]
 */
export function deriveTownSeats(locations, { regionNameOf, isBase = () => true, isHub } = {}) {
  /** @type {Map<number, any>} */
  const byMapId = new Map();
  for (const loc of locations ?? []) {
    if (!loc || !isBase(loc)) continue;
    const seat = seatOfLocation(loc, { regionNameOf, isHub });
    if (seat && !byMapId.has(seat.key)) byMapId.set(seat.key, seat);
  }
  const list = Object.freeze([...byMapId.values()].sort((a, b) => a.key - b.key));
  return Object.freeze({ list, byMapId });
}

/** The seat a location IS, by its map id (signed as MAPS.BSA reads it, or not), or null. */
export const seatAtMapId = (seats, mapId) => (mapId == null || !Number.isFinite(Number(mapId)) ? null : seats?.byMapId?.get(Number(mapId) >>> 0) ?? null);

/** The totals SEAT-COUNT prints: seats, crowns, palaces, hubs among them, and each kingdom's (a March and a Free Land
 *  by their own words). */
export function seatTotals(list) {
  const out = { seats: 0, crown: 0, palace: 0, hubs: 0, kingdoms: /** @type {Record<string, number>} */ ({}) };
  for (const s of list ?? []) {
    out.seats++;
    out[s.tier]++;
    if (s.isHub) out.hubs++;
    const k = s.kingdom ?? (isMarch(s.region) ? 'march' : isFreeLand(s.region) ? 'free' : 'none');
    out.kingdoms[k] = (out.kingdoms[k] ?? 0) + 1;
  }
  return out;
}
