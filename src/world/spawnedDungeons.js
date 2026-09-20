// SPAWNED DUNGEONS (Lost, 2026-09-19: "one dungeon per loaded chunk when wandering around with a chance of 30% per
// chunk ... online mode only for now"). The pure law - the roll, the id and the clone. The host (scenes/world.js
// buildPixelNow) owns the ground: it asks `spawnedDungeonAt`'s pieces here and stands the answer in `locationIndex`.
//
// THE ROLL is a hash of (WORLD_SALT, pixel), never a fresh Math.random: a pixel unloads and reloads as the player walks,
// and a roll per LOAD would reroll it (a dungeon that vanishes when you look away). The salt is ONE constant for every
// client, so every player rolls the same pixels, sees the same dungeons and enters the same room - and a pixel holds
// at most one, however many players stand in it. No relay word is needed for any of that.
//
// THE ID keeps DFU's own law: MapId & 0xfffff IS the map pixel (systems/mapDirectory.js, systems/discovery.js key
// on it), so the low 20 bits are this pixel's id and the high 12 are the salt - unique per (salt, pixel), an unsigned
// 32-bit number the relay's room law admits (wire.js WORLD_ROOM, `dungeon:m<1-10 digits>`), and it cannot equal a real
// location's id because a spawn only ever stands on a pixel that has no location.

import { mapPixelToLongitudeLatitude } from '../formats/mapsFile.js';

/** The chance a pixel holds a spawned dungeon. */
export const SPAWN_CHANCE = 0.10;
/** The salt fills the id's high 12 bits; 0 is left out so an id is never below 2^20. */
export const SALT_MAX = 4095;
/** The one salt every client rolls with. Changing it moves every spawned dungeon in the world (and their rooms). */
export const WORLD_SALT = 1;

const PIXEL_ID_MAX = 500 * 1000;   // getMapPixelID's ceiling (y < 500, x < 1000) - under 2^20

/** FNV-1a-ish mix of a few small integers to an unsigned 32-bit. */
export function hash32(...ns) {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h ^= n >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** Does this pixel hold a spawned dungeon? Deterministic in (salt, px, py). */
export const spawnsDungeon = (salt, px, py, chance = SPAWN_CHANCE) => hash32(salt, px, py, 1) / 4294967296 < chance;

/** The spawned dungeon's MapId: salt in the high 12 bits, MapsFile.getMapPixelID in the low 20. */
export function spawnedMapId(salt, px, py) {
  if (!Number.isInteger(salt) || salt < 1 || salt > SALT_MAX) throw new RangeError(`salt ${salt}`);
  const id = py * 1000 + px;
  if (!Number.isInteger(id) || px < 0 || px > 999 || py < 0 || id >= PIXEL_ID_MAX) throw new RangeError(`pixel ${px},${py}`);
  return ((salt << 20) | id) >>> 0;
}

/** Which template this pixel clones - deterministic in (salt, px, py); null for an empty list. */
export const pickTemplate = (templates, salt, px, py) => (templates?.length ? templates[hash32(salt, px, py, 2) % templates.length] : null);

/**
 * A NON-MUTATING clone of a real dungeon location standing on (px, py) under its own id (the locations are cached
 * objects shared with the exterior layout - smallerDungeons.js's own law). What changes: the map row (id, the pixel's
 * longitude/latitude), the two locationIds the dungeon's room key and the save's `dungeon:<id>` read, the name (the
 * automap is keyed by region + name, so two spawns of one template must not share a map), and everything that is a
 * property of WHERE it stands - region, politic, climate (`where`, from the host, which owns the map files).
 * `locationIndex` is -1: the quest machine and the music read it as "a real table row", and this is none.
 * @param {object} template a real, non-main-story location with hasDungeon
 * @param {{salt:number, px:number, py:number, where?:{regionIndex?:number, regionName?:string, politic?:number, climate?:object}}} o
 */
export function synthesizeDungeonLocation(template, { salt, px, py, where = {} }) {
  const mapId = spawnedMapId(salt, px, py);
  const ll = mapPixelToLongitudeLatitude(px, py);
  return {
    ...template,
    name: `${template.name} (${px},${py})`,
    regionIndex: where.regionIndex ?? template.regionIndex,
    regionName: where.regionName ?? template.regionName,
    politic: where.politic ?? template.politic,
    climate: where.climate ?? template.climate,
    locationIndex: -1,
    mapTableData: { ...template.mapTableData, mapId, longitude: ll.x, latitude: ll.y },
    exterior: { ...template.exterior, exteriorData: { ...template.exterior?.exteriorData, locationId: mapId } },
    dungeon: { ...template.dungeon, recordElement: { ...template.dungeon?.recordElement, header: { ...template.dungeon?.recordElement?.header, locationId: mapId } } },
    spawned: true,
  };
}

/**
 * The real locations a spawn may clone: a dungeon with blocks and an exterior, never a main-story one (`isMain`, by
 * MapId - world/dungeonTextures.js), and - to keep every spawned exterior as cheap as the smallest real ones - a
 * one-block exterior when any exist.
 */
export function spawnTemplates(locations, isMain = () => false) {
  const dungeons = [...(locations ?? [])].filter((l) => l?.hasDungeon && l.dungeon?.blocks?.length
    && l.exterior?.exteriorData && !isMain(l.mapTableData?.mapId) && !l.spawned);
  const small = dungeons.filter((l) => l.exterior.exteriorData.width * l.exterior.exteriorData.height === 1);
  return small.length ? small : dungeons;
}
