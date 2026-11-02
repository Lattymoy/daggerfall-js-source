// @ts-check
// AUDIT TAMRIEL-WIDE C3 (2026-10-28, bible/06-Systems/Professions-Arc.md section 23): A DUNGEON AS THE PROFESSIONS NAME
// IT, the law out of buildDungeonContext's profIdentity (HOST-SPLIT). DFU's MapId & 0xfffff is a Bay dungeon's pixel.
// Past the Bay those bits are a lane's count, so an Eltheric ruin and a lair, or two abysses, shared one vein's witnesses
// and one day's slots. A Bay id keeps the mask; a place the port made keys by its whole id (discoveryKeyOf's law).
import { discoveryKeyOf } from '../systems/discovery.js'; // AUDIT TESA II P6: a Bay pixel id's mask, else the whole id
import { worldLaneOf, worldLanePixel, ABYSS_WORLD_LANE } from '../world/worldWide/worldLanes.js';
import { keptMaps } from '../net/staffPlaces.js'; // the game's maps as the world host composed them

/** A dungeon's map id as the professions key it: the Bay's ids as DFU masks them, every other its whole id.
 *  @param {number} mapId */
export const dungeonIdOf = (mapId) => discoveryKeyOf(mapId);

/** A pixel's ground as the gathering reads it (scenes/world.js `pixelInfo`), off the game's maps; null with none.
 *  @param {number} x @param {number} y @returns {{ climate: number, region: number } | null} */
export function keptGround(x, y) {
  const m = keptMaps();
  try {
    return m ? { climate: m.getClimateIndex(x, y), region: m.getRegionIndexAt(x, y) } : null;
  } catch {
    return null;
  }
}

/**
 * `{ id, climate, region }` for a dungeon's location. An abyss past the Bay names its pit's ground: its template is
 * borrowed by hash and by the player's quest sites, so two players could name two grounds for one abyss. The Bay's
 * abyss keeps its template's, the ground its witnessed facts were written under.
 * @param {{ mapTableData: { mapId: number }, climate?: { worldClimate?: number } | null, regionIndex?: number }} loc
 * @param {(x: number, y: number) => ({ climate: number, region: number } | null)} [groundAt]
 */
export function dungeonIdentity(loc, groundAt = keptGround) {
  const mapId = loc.mapTableData.mapId;
  const pit = worldLaneOf(mapId) === ABYSS_WORLD_LANE ? worldLanePixel(mapId) : null;
  const g = pit ? groundAt(pit[0], pit[1]) : null;
  return {
    id: dungeonIdOf(mapId),
    climate: g ? g.climate : (loc.climate?.worldClimate ?? null),
    region: g ? g.region : (loc.regionIndex ?? null),
  };
}
