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
import { plateauDry, spawnTemplates, pickTemplate, synthesizeDungeonLocation } from '../world/spawnedDungeons.js';   // AUDIT TESA II Z9: the dry plateau's early-out law
import { wildInside } from '../systems/wild/wildZone.js';
import { groundWoods, tamrielClimateAt } from '../world/tamriel/tamrielGround.js';
import { inBay } from '../world/tamriel/tamrielFrame.js';
import { theatreAt, worldPixelKey } from '../world/worldWide/worldGrid.js';
import { CLIMATES, REGION_NAMES, regionOfTheatre } from '../formats/mapsTables.js';
import { getWorldClimateSettings } from '../formats/mapsFile.js';
import { WDUN_SALT, spawnedHallMapId } from '../net/wire.js';

/**
 * The zone's halls, built once a session.
 * @param {{ maps: any, woods: any, places: { at: (x: number, y: number) => any, generation?: () => number }, locationIndex: Map<string, any>,
 *   isMainStory: (mapId?: number) => boolean, dayNow: () => number, indexMoved: () => void }} deps
 */
export function createZoneHalls({ maps, woods, places, locationIndex, isMainStory, dayNow, indexMoved }) {
  const land = woods?.isTamrielGround ? woods : groundWoods(woods);   // the continent's ground, whatever the land switch
  // SPAWN-SHORE: dry ground under the plateau, kept a pixel a session. AUDIT TESA II Z9: by plateauDry - the same answer
  // as the spawns' spawnGroundDry (both are spawnPlateauFloor > SPAWN_DRY_ELEVATION to the bit), read until it is certain
  // either way: the day's picks read about a thousand pixels, and every one of them dry read its whole kernel
  const dry = new Map();
  const ground = (/** @type {number} */ x, /** @type {number} */ y) => {
    const k = worldPixelKey(x, y);
    let d = dry.get(k);
    if (d === undefined) dry.set(k, d = plateauDry(land, x, y));
    return d;
  };
  const climateAt = (x, y) => (inBay(x, y) ? maps.getClimateIndex(x, y) : tamrielClimateAt(x, y));
  const regionAt = (x, y) => (inBay(x, y) ? maps.getRegionIndexAt(x, y) : regionOfTheatre(theatreAt(x, y)));
  /** AUDIT TESA II Z7: the places a pixel stands that no list holds - the countryside's and the lairs' rolls past the Bay
   *  (scenes/tamrielPlacesHost.js hands them, standsToo), and how many times they were handed (a pick kept by it). */
  let rolled = /** @type {((x: number, y: number) => boolean)|null} */ (null), rolledGen = 0;
  /** May a hall stand on world map pixel (x, y): never on a place nor beside one - the registry's (the Bay's rows, the
   *  places past the Bay - AUDIT TESA II P7) and the rolls' (Z7) - never the sea, never wet ground. */
  const free = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (places.at(x + dx, y + dy) || rolled?.(x + dx, y + dy)) return false;
    return climateAt(x, y) !== CLIMATES.Ocean && ground(x, y);
  };
  let cache = /** @type {{ day: number, mask: any, gen: number, rolledGen: number, active: any[] }|null} */ (null);
  /** The day's halls `[{ x, y, ring, key }]` over the zone's `mask` (null where there is no zone) - AUDIT TESA II Z7: and
   *  picked again when the places move under them (the registry's generation: the places past the Bay landing with the
   *  trace), so no hall of a day picked before stands on a town that came after. */
  const activeOf = (mask) => {
    if (!mask) return null;
    const day = dayNow(), gen = places.generation?.() ?? 0;
    if (cache?.day === day && cache.mask === mask && cache.gen === gen && cache.rolledGen === rolledGen) return cache.active;
    cache = { day, mask, gen, rolledGen, active: wildHallPicks(mask, free, day) };
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
    if (had && !had.wildHall) return null;   // AUDIT TESA II Z7: never over a place it did not make (`free` keeps it off every place; one stood since keeps its pixel)
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
  /** AUDIT WW F4: the height map's byte on world map pixel (x, y), the continent's - the giants' low ground
   *  (systems/wild/wildGiants.js), the same on every client as the halls' ground is (one function, kept: their cache's key). */
  const heightAt = (x, y) => land.getHeightMapValue(x, y);
  /** AUDIT TESA II P1 (Z1): the hall the build stands on a pixel - today's over the zone's `mask` where the pixel lies in it,
   *  else none: scenes/world.js _locationToBuild asks it before the places past the Bay (the zone is Cyrodiil's, past it -
   *  its halls had stood only in the Bay's arm the build never reaches there). @param {any} mask */
  const standIn = (mask, px, py) => (mask && wildInside(mask, px, py) ? standOf(mask, px, py) : null);
  /** AUDIT TESA II Z7: the rolls a hall keeps off besides the registry's places. @param {(x: number, y: number) => boolean} fn */
  const standsToo = (fn) => { rolled = fn; rolledGen += 1; };
  return { free, activeOf, standOf, standIn, standsToo, heightAt, keys: stood };
}
