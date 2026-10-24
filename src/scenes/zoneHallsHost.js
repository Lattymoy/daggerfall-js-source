// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW-C2 (2026-10-24, bible/03-World/World-Wide.md WW-C; bible/11-Multiplayer/Wild-Zone.md) - THE OPEN ZONE'S HALLS IN
// THE STREAMING WORLD: where a hall may stand (the ground test the halls and the giants share), the day's halls over the
// zone's mask, and a hall stood in the index - out of the world host's bootWorld (HOST-SPLIT), the host keeping the
// wiring.
//
// THE ZONE IS CYRODIIL'S, past the Bay (systems/wild/cyrodiilZone.js), and its halls must be the same on every client:
// so the ground a hall asks is the CONTINENT'S OWN, whatever the player's land switch (TAMRIEL2's groundWoods and the
// province's climate, as the gates' wet ground reads them - WW2) - a client that streams the Bay alone answers past it
// exactly what one that walks the continent does. A place's pixel and its neighbours are never a hall's: the world's
// registry answers them (world/worldWide/worldPlaces.js at - the Bay's MAPS.BSA rows, and every province's places once
// they stand).
// ═══════════════════════════════════════════════════════════════════
import { wildHallPicks, wildHallAt, wildHallTemplateOk } from '../systems/wild/wildDungeons.js';
import { createSpawnGround, spawnTemplates, pickTemplate, synthesizeDungeonLocation } from '../world/spawnedDungeons.js';
import { groundWoods, tamrielClimateAt } from '../world/tamriel/tamrielGround.js';
import { inBay } from '../world/tamriel/tamrielFrame.js';
import { theatreAt } from '../world/worldWide/worldGrid.js';
import { CLIMATES, REGION_NAMES, regionOfTheatre } from '../formats/mapsTables.js';
import { getWorldClimateSettings } from '../formats/mapsFile.js';
import { WDUN_SALT, spawnedHallMapId } from '../net/wire.js';

/**
 * The zone's halls, built once a session.
 * @param {{ maps: any, woods: any, places: { at: (x: number, y: number) => any }, locationIndex: Map<string, any>,
 *   isMainStory: (mapId?: number) => boolean, dayNow: () => number, indexMoved: () => void }} deps
 */
export function createZoneHalls({ maps, woods, places, locationIndex, isMainStory, dayNow, indexMoved }) {
  const ground = createSpawnGround(woods?.isTamrielGround ? woods : groundWoods(woods));   // SPAWN-SHORE: dry ground under the plateau, the continent's
  const climateAt = (x, y) => (inBay(x, y) ? maps.getClimateIndex(x, y) : tamrielClimateAt(x, y));
  const regionAt = (x, y) => (inBay(x, y) ? maps.getRegionIndexAt(x, y) : regionOfTheatre(theatreAt(x, y)));
  /** May a hall stand on world map pixel (x, y): never on a place nor beside one, never the sea, never wet ground. */
  const free = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (places.at(x + dx, y + dy)) return false;
    return climateAt(x, y) !== CLIMATES.Ocean && ground(x, y);
  };
  let cache = /** @type {{ day: number, mask: any, active: any[] }|null} */ (null);
  /** The day's halls `[{ x, y, ring, key }]` over the zone's `mask` (null where there is no zone). */
  const activeOf = (mask) => {
    if (!mask) return null;
    const day = dayNow();
    if (cache?.day === day && cache.mask === mask) return cache.active;
    cache = { day, mask, active: wildHallPicks(mask, free, day) };
    return cache.active;
  };
  let templates = /** @type {any[]|null} */ (null);
  /** The pixels a hall stands on in the index - taken off by the host when the day moves on. */
  const stood = new Set();
  /** The hall on this pixel today over the zone's `mask`, stood in the index (a clone of a real dungeon - never a
   *  graveyard's - on the halls' own lane of map ids, net/wire.js spawnedHallMapId, always elite, its tier on it), or null. */
  const standOf = (mask, px, py) => {
    const hall = wildHallAt(activeOf(mask), px, py);
    if (!hall) return null;
    const key = `${px},${py}`, day = dayNow();
    const had = locationIndex.get(key);
    if (had?.wildHallDay === day) return had;
    templates ??= spawnTemplates(locationIndex.values(), isMainStory).filter(wildHallTemplateOk);
    const template = pickTemplate(templates, WDUN_SALT, px, py);
    if (!template) return null;
    const regionIndex = regionAt(px, py);
    const loc = synthesizeDungeonLocation(template, { salt: WDUN_SALT, px, py, elite: true, mapId: spawnedHallMapId(px, py), where: {
      regionIndex, regionName: REGION_NAMES[regionIndex], politic: inBay(px, py) ? maps.getPoliticIndex(px, py) : 128 + regionIndex, climate: getWorldClimateSettings(climateAt(px, py)),
    } });
    loc.wildHall = { ring: hall.ring, key };
    loc.wildHallDay = day;
    loc.name = `Elite ${template.name} (${px},${py})`;
    locationIndex.set(key, loc);
    stood.add(key);
    indexMoved();
    return loc;
  };
  return { free, activeOf, standOf, keys: stood };
}
