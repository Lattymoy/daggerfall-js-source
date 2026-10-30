// W1-i: THE MAP DIRECTORY - ContentReader.cs's mapDict half
// (MIT, Daggerfall Workshop): EnumerateMaps (:318-356) builds one
// MapSummary per location keyed by MAP PIXEL ID, and HasLocation
// (:212-252) is the map's only "is there a place here?" question.
// The travel map asks it once per pixel of a region panel, so the
// dict has to exist before the window can draw a single dot.
//
// The port had no ContentReader: world.js indexes FULLY LOADED
// locations by "x,y" (scenes/world.js:"import { Collider }"), which costs a
// getLocation per location and carries the whole DFLocation. The
// window needs the SUMMARY only - type, region, discovery flag -
// so this walks the map TABLES exactly as EnumerateMaps does and
// touches no location record at all.
//
// VERBATIM: the key is `mapId & 0x000fffff`, which is the map
// pixel id (MapsFile.GetMapPixelID) - that identity is what makes
// the dict a spatial index; the summary carries DFU's seven
// fields; and a COLLIDING id is logged and DROPPED, first entry
// winning, because C#'s Dictionary.Add throws and the catch sits
// inside the per-location try (:331-354). A JS Map.set would have
// let the last colliding location win instead.
//
// NOT PORTED (nothing in the port asks): locationIdToMapIdDict -
// the quest system's LocationId -> MapId link, which costs a
// readLocationIdFast per location (~25ms in DFU's own note).

import { getMapPixelID, MAX_MAP_PIXEL_X as MAP_W, MAX_MAP_PIXEL_Y as MAP_H } from '../../formats/mapsFile.js';

/** ContentReader.EnumerateMaps (:318-356). Returns Map<pixelId,
 *  MapSummary>. */
export function buildMapDict(maps) {
  const mapDict = new Map();
  if (!maps) return mapDict;
  for (let region = 0; region < maps.regionCount; region++) {
    const dfRegion = maps.getRegion(region);
    if (!dfRegion) continue;
    for (let location = 0; location < dfRegion.locationCount; location++) {
      const mapTable = dfRegion.mapTable?.[location];
      if (!mapTable) continue;
      const summary = {
        id: mapTable.mapId & 0x000fffff,
        mapID: mapTable.mapId,
        regionIndex: region,
        mapIndex: location,
        locationType: mapTable.locationType,
        dungeonType: mapTable.dungeonType,
        // C#'s own TODO kept: GraveyardForgotten locations that
        // start discovered in classic are not accounted for here.
        discovered: !!mapTable.discovered,
      };
      // Dictionary.Add's ArgumentException arm (:351-354).
      if (mapDict.has(summary.id)) {
        console.error(`Colliding location for MapId:${summary.id} found when enumerating maps!`);
        continue;
      }
      mapDict.set(summary.id, summary);
    }
  }
  return mapDict;
}

/** WW3 (bible/03-World/World-Wide.md WW3): a map pixel of the Bay's map, whose MapsFile pixel id is its own - off it
 *  `y * 1000 + x` names ANOTHER pixel's id ((1003, 10) is (3, 11)'s, (-2, 10) is (998, 9)'s), and a ship past the Bay
 *  was told it lay by a Bay port. DFU asks the directory of its own map alone; the port asks it of the world's. */
const onMap = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

/** ContentReader.HasLocation(x, y, out summary) (:212-230) - the
 *  summary, or null (WW3: null off the Bay's map). */
export function locationSummaryAt(mapDict, mapPixelX, mapPixelY) {
  return onMap(mapPixelX, mapPixelY) ? (mapDict?.get(getMapPixelID(mapPixelX, mapPixelY)) ?? null) : null;
}

/** ContentReader.HasLocation(x, y) (:238-252) - WW3: none off the Bay's map. */
export function hasLocation(mapDict, mapPixelX, mapPixelY) {
  return onMap(mapPixelX, mapPixelY) && !!mapDict?.has(getMapPixelID(mapPixelX, mapPixelY));
}
