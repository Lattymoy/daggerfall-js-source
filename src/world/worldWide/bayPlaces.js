// @ts-check
// WW1 (2026-10-24, bible/03-World/World-Wide.md): THE BAY'S PROVIDER - the game's own MAPS.BSA rows as the registry's
// places (world/worldWide/worldPlaces.js). The rows are HUB1's: the base rows of each region, never a world-data mod's
// addition (it stands on one client and not another - systems/region/regionHubs.js), so every client's registry holds
// the same Bay. Each row's pixel is its own longitude and latitude (MapsFile.LongitudeLatitudeToMapPixel), its area its
// region, its port Travel Options' own list (systems/travel/travelPorts.js hasPort) as the living world always read it.
import { longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';

/** The registry's name for the Bay's own places. */
export const BAY_SOURCE = 'bay';

/**
 * The Bay's rows as registry rows.
 * @param {Iterable<any>} locs MAPS.BSA locations (MapsFile.getLocation's), the game's own rows
 * @param {{ hasPort?: (mapId: number) => boolean }} [o]
 * @returns {import('./worldPlaces.js').PlaceRow[]}
 */
export function bayPlaceRows(locs, { hasPort = () => false } = {}) {
  const rows = [];
  for (const loc of locs) {
    const md = loc?.mapTableData;
    if (!md) continue;
    const p = longitudeLatitudeToMapPixel(md.longitude, md.latitude);
    const ed = loc.exterior?.exteriorData;
    rows.push({
      mapId: md.mapId >>> 0,
      name: String(loc.name ?? ''),
      px: p.x,
      py: p.y,
      type: md.locationType,
      region: loc.regionIndex,
      w: Math.max(1, ed?.width ?? 1),
      h: Math.max(1, ed?.height ?? 1),
      port: !!hasPort(md.mapId),
      dungeonType: md.dungeonType ?? 0,
      hasDungeon: !!loc.hasDungeon,
    });
  }
  return rows;
}
