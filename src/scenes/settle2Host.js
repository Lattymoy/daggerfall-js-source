// @ts-check
// THE WORLD 2.0 TOWNS IN THE STREAMED WORLD - each
// installed region's town a location on its pixel, stood when the build asks (spawnStandHost.js asks it first past the Bay),
// and a row in the world's places. It stands only where the registry gives it its pixel (a capital or an Arena place listed
// before it keeps its own; the town says so once), and only with the Landforms row on (scenes/shared.js landformsOn, read
// once as world.js reads it): off, its region's ground is not streamed and a town would float, so none stands, none is
// listed, and the world's own places take its pixel. Constructed by tamrielPlacesHost.js after the places past the Bay.
import { getWorldClimateSettings, REGION_NAMES } from '../formats/mapsFile.js';
import { settle2TownAt } from '../world/settle2/settle2Towns.js';
import { synthesizeSettle2Location, settle2PlaceRows } from '../world/settle2/settle2Location.js';
import { installSettle2 } from '../world/settle2/settle2Blocks.js';
import { gen2Stamp } from '../world/gen2/gen2Ground.js';
import { townClimateAt } from '../world/urban/townLook.js';
import { landformsOn } from './shared.js';

/** The towns' source in the world's places. */
export const SETTLE2_SOURCE = 'wg2-settle';
/** @type {?{ locationAt: (px: number, py: number) => any }} */
let _live = null;
/** The town the build stands on a pixel, stood in the index - or null (none there, or no host yet). @param {number} px @param {number} py */
export const settle2LocationAt = (px, py) => _live?.locationAt(px, py) ?? null;

/**
 * @param {{ locationIndex: Map<string, any>, worldPlaces: any, maps: any, base: any, host: { _locIndexGen: number }, landform?: boolean }} deps
 * `base` the template a town's location takes its fields from (null: no town stands); `landform` the Landforms row.
 */
export function createSettle2Places({ locationIndex, worldPlaces, maps, base, host, landform = landformsOn() }) {
  if (!landform) { _live = null; return { locationAt: () => null, peekAt: () => null }; }
  installSettle2();
  worldPlaces?.registerLive(SETTLE2_SOURCE, { stamp: () => [gen2Stamp()], rows: settle2PlaceRows });
  const told = new Set();
  /** The place the registry keeps on a town's pixel instead of it, or null. */
  const heldBy = (px, py, town) => {
    const p = worldPlaces?.at(px, py) ?? null;
    return p && !(p.source === SETTLE2_SOURCE && p.mapId === town.mapId >>> 0) ? p : null;
  };
  const where = (px, py) => {
    const regionIndex = maps.getRegionIndexAt(px, py);
    return { regionIndex, regionName: REGION_NAMES[regionIndex], politic: 128 + regionIndex, climate: townClimateAt(px, py, getWorldClimateSettings(maps.getClimateIndex(px, py))) };
  };
  /** A town's location on (px, py), not stood - null where none stands. */
  function cloneAt(px, py) {
    const at = settle2TownAt(px, py);
    if (!at || !base) return null;
    const p = heldBy(px, py, at.town);
    if (p) {
      if (!told.has(at.town.id)) { told.add(at.town.id); console.warn(`[wg2] ${at.town.name} (${at.town.id}) stands nowhere: ${p.name} (${p.source}) holds its pixel ${px},${py}`); }
      return null;
    }
    return synthesizeSettle2Location(at, base, where(px, py));
  }
  /** The town on (px, py) stood in the index once, and again when its region's bake or its pixel's holder moves. */
  function locationAt(px, py) {
    const key = `${px},${py}`, had = locationIndex.get(key), at = settle2TownAt(px, py);
    if (had?.settle2) {
      if (at && had.settle2.id === at.town.id && had.settle2.print === at.region.print && !heldBy(px, py, at.town)) return had;
      host._locIndexGen += 1;
      locationIndex.delete(key);
    }
    const loc = cloneAt(px, py);
    if (!loc) return null;
    host._locIndexGen += 1;
    locationIndex.set(key, loc);
    return loc;
  }
  _live = { locationAt };
  return { locationAt, peekAt: (px, py) => (locationIndex.get(`${px},${py}`)?.settle2 ? locationIndex.get(`${px},${py}`) : cloneAt(px, py)) };
}
