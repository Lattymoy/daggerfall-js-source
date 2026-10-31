// @ts-check
// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements"): A WORLD 2.0 TOWN AS THE GAME READS A PLACE - a
// location cloned from a template's fields (as the capitals' and the countryside's are), its grid the town's 64 blocks
// (settle2Blocks.js), its buildings' records its directory, its map id the town's (lane 0x342), its index its own lane;
// and its row for the world's places (world/worldWide/worldPlaces.js). Its ground is the region's: `settle2.ground` tells
// the terrain to stand it on its own plane and blend nothing (terrain/terrainGen.js).
import { mapPixelToLongitudeLatitude, LOCATION_TYPES, REGION_NAMES } from '../../formats/mapsFile.js';
import { regionOfTheatre } from '../../formats/mapsTables.js';
import { theatreAt } from '../worldWide/worldGrid.js';
import { isNamedBuildingType } from '../buildingNames.js';
import { locationKeyOf } from '../locationKey.js';
import { settle2BlockName, settle2LocationIndex, settle2Base, settle2Towns, WORLD_HEIGHT } from './settle2Towns.js';
import { settle2TownRecords } from './settle2Blocks.js';

/** A settlement type's location type: a walled or a market town a hamlet, the rest villages. */
const TOWN_TYPES = Object.freeze({ town: LOCATION_TYPES.TownHamlet, fortifiedTown: LOCATION_TYPES.TownHamlet, riverTown: LOCATION_TYPES.TownHamlet, port: LOCATION_TYPES.TownHamlet });
export const settle2LocationType = (town) => TOWN_TYPES[town.type] ?? LOCATION_TYPES.TownVillage;

/**
 * A TOWN'S LOCATION on its pixel: `base` the template it takes the fields a town carries from (world/tamrielCapitals.js
 * capitalBase's), `where` its region and climate (the pixel's province's, else theatreAt's region and the template's).
 * `settle2.ground` is the terrain's flatten: `own` - no blend, the plane at `avg` (a sample, settle2Base / WORLD_HEIGHT).
 * @param {{ town: any, region: any, px: number, py: number }} at @param {any} base
 * @param {{ regionIndex?: number, regionName?: string, politic?: number, climate?: any }} [where]
 */
export function synthesizeSettle2Location(at, base, where = {}) {
  const { town, px, py } = at, mapId = town.mapId >>> 0, ll = mapPixelToLongitudeLatitude(px, py);
  const blockNames = Array.from({ length: 64 }, (_, i) => settle2BlockName(town.ordinal, i % 8, Math.floor(i / 8)));
  const buildings = settle2TownRecords(at).filter((r) => isNamedBuildingType(r.type))
    .map((r) => ({ nameSeed: r.nameSeed, serviceTimeLimit: 0, unknown: 0, unknown2: 0, unknown3: 0, unknown4: 0, factionId: r.factionId, sector: r.slot[1] * 8 + r.slot[0], locationId: mapId, buildingType: r.type, quality: r.quality }));
  const regionIndex = where.regionIndex ?? regionOfTheatre(theatreAt(px, py));
  const plane = settle2Base(town);
  return {
    ...base,
    name: town.name, regionIndex, regionName: where.regionName ?? REGION_NAMES[regionIndex] ?? '', politic: where.politic ?? 128 + regionIndex,
    climate: where.climate ?? base.climate, locationIndex: settle2LocationIndex(town.ordinal),
    hasDungeon: false, dungeon: { recordElement: null, header: null, blocks: null },
    mapTableData: { ...base.mapTableData, mapId, locationType: settle2LocationType(town), dungeonType: 0, longitude: ll.x, latitude: ll.y, key: locationKeyOf(buildings) },
    exterior: {
      ...base.exterior,
      buildings,
      exteriorData: { ...base.exterior?.exteriorData, width: 8, height: 8, blockNames, blockIndex: null, blockNumber: null, blockCharacter: null, locationId: mapId, mapId, portTownAndUnknown: 0, buildingCount: buildings.length },
      ...(base.exterior?.recordElement ? { recordElement: { ...base.exterior.recordElement, header: { ...base.exterior.recordElement.header, locationId: mapId } } } : {}),
    },
    settle2: Object.freeze({ id: town.id, ordinal: town.ordinal, print: at.region?.print ?? '', px, py, base: plane, ground: Object.freeze({ own: true, avg: plane / WORLD_HEIGHT }) }),
  };
}

/** A town's row in the world's places. @param {{ town: any, px: number, py: number }} at */
export const settle2PlaceRow = ({ town, px, py }) => ({ mapId: town.mapId >>> 0, name: town.name, px, py, type: settle2LocationType(town), w: 8, h: 8, port: false, location: settle2LocationIndex(town.ordinal) });
/** Every installed town's row. */
export const settle2PlaceRows = () => settle2Towns().map(settle2PlaceRow);
