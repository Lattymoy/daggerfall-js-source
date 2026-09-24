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
import { MINUTES_PER_DAY } from '../systems/gameDate.js';   // TTL1: a day is the clock's own, never a second 1440
import { TERRAIN_SIZE } from './terrainSampler.js';   // SPAWNED-DUNGEONS3: a pixel is 819.2 metres on a side
import { getLocationTerrainTileOrigin, WORLD_MAP_TILE_DIM } from './terrainTiles.js';   // SPAWNED-DUNGEONS3: where a location stands in its pixel

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
    && l.exterior?.exteriorData && !isMain(l.mapTableData?.mapId) && !l.spawned
    && spawnClearance(l.exterior.exteriorData.width, l.exterior.exteriorData.height) >= SPAWN_CLEARANCE_M);   // SPAWNED-DUNGEONS3: never one the player could cross into inside 300 m
  const small = dungeons.filter((l) => l.exterior.exteriorData.width * l.exterior.exteriorData.height === 1);
  return small.length ? small : dungeons;
}

// ---------------------------------------------------------------- SPAWNED-DUNGEONS3
//
// THE PLAYER'S OWN PIXEL, AT A DISTANCE (2026-09-24, Mac: "Dungeons that
// currently spawn on the player's exact pixel or up to 2 pixels away
// should now always spawn directly on the player's pixel. Additionally,
// the nearby direction message should display the distance/direction in
// meters. The dungeon has to spawn 300+ meter away from the player in
// the same pixel/chunk.")
//
// WHERE A SPAWN STANDS IN ITS PIXEL is the same place every location
// stands: CENTRED (terrainTiles.js getLocationTerrainTileOrigin -
// TerrainHelper.SetLocationTiles' own law), so the host's layout, its
// doors and its Where-is directory need no second placement. A pixel is
// 819.2 metres on a side and a block 102.4, so a one-block dungeon's
// exterior runs 358.4..460.8 across the pixel on both axes, and a player
// entering at the middle of an edge is 358 metres from its nearest
// edge and 410 from its centre - the "300+ metres" rule holds by
// construction for a walk-in. What COULD break it is the template: an
// exterior three blocks wide leaves 256 metres of clearance, eight
// leaves none. So the clearance is the template gate, and the old
// "no one-block exterior: any real dungeon" fallback is gone - a
// fallback that breaks the rule is not one.

/** The least distance a player entering the pixel may be from the spawn's exterior. */
export const SPAWN_CLEARANCE_M = 300;
/** A block's side, metres: eight to a pixel. */
export const BLOCK_M = TERRAIN_SIZE / 8;
/** Metres from a pixel's edge to the nearest edge of a centred w x h block exterior (the tighter axis). */
export const spawnClearance = (width, height) => (TERRAIN_SIZE - Math.max(width | 0, height | 0) * BLOCK_M) / 2;

/**
 * A location's centre in its pixel's LOCAL frame, metres: [x east, z
 * north] from the pixel's south-west corner - the frame the streaming
 * host's `pixelTranslation` puts at the pixel's origin (scene x runs
 * east; scene z runs NORTH, because that translation negates py, and
 * the layout stands a location at `tilePos * tileSide` on both axes).
 * Tile 0 is the corner; a tile is 6.4 metres.
 */
export function spawnedLocationCentreLocal(loc) {
  const tile = TERRAIN_SIZE / WORLD_MAP_TILE_DIM;
  const o = getLocationTerrainTileOrigin(loc);
  const w = loc.exterior.exteriorData.width, h = loc.exterior.exteriorData.height;
  return [(o.x + w * 8) * tile, (o.y + h * 8) * tile];
}

/** The line, with the distance to the nearest ten metres and the compass word the host resolved. */
export function dungeonSightLine(metres, direction) {
  const m = Math.max(10, Math.round(metres / 10) * 10);
  return `You see a Dungeon ${m} metres to the ${direction}!`;
}

// ---------------------------------------------------------------- TTL1
//
// THE TWO LIVES OF A SPAWNED DUNGEON (2026-09-20, the creator's rule
// relayed by Mac): "Spawned Dungeons should expire/removed after 2
// ingame days when cleared when there is no player in it - and after 7
// ingame days in general when there is no player in it."
//
// So there are TWO clocks and a spawn dies on whichever runs out first:
// a SHORT one that starts when the place is emptied, and a LONG one
// that has been running since it was first seen. Clearing a dungeon
// does not extend its life - a spawn cleared on day 6 of its seven is
// gone on day 7, not day 8 - which is why both are tested and the
// answer is an OR rather than a fork.
//
// THE CLOCK IS THE GAME'S. Everything here is in the same classic
// minutes `playerTicker.classicMinutes` counts, so resting through a
// week expires what a week of walking would.

/** Emptied, and left alone this long: gone. */
export const CLEARED_TTL_DAYS = 2;
/** ...and never more than this from first sight, cleared or not. */
export const GENERAL_TTL_DAYS = 7;
export const CLEARED_TTL_MINUTES = CLEARED_TTL_DAYS * MINUTES_PER_DAY;
export const GENERAL_TTL_MINUTES = GENERAL_TTL_DAYS * MINUTES_PER_DAY;

/**
 * Has this spawn's time run out by `now` (classic minutes)?
 *
 * A record is `{ seen, cleared }` - when the pixel was first built, and
 * when the place was first emptied (absent until it is). Nothing is
 * expired by a clock that has not run: a record with no `seen` is one
 * this ledger has never met.
 *
 * A NEGATIVE ELAPSED IS NEVER EXPIRY. Loading an older save winds the
 * clock BACK, and a spawn whose record outlived the load would
 * otherwise read as astronomically old and vanish on sight.
 */
export function spawnExpired(rec, now) {
  if (!rec || !Number.isFinite(now)) return false;
  if (Number.isFinite(rec.cleared) && now - rec.cleared >= CLEARED_TTL_MINUTES) return true;
  if (Number.isFinite(rec.seen) && now - rec.seen >= GENERAL_TTL_MINUTES) return true;
  return false;
}

/**
 * The ledger of what this client has met and when.
 *
 * WHAT IT IS NOT, said plainly: this is ONE CLIENT'S memory. The roll
 * that puts a dungeon on a pixel is a pure hash every client shares, so
 * every client agrees a spawn is THERE without a word from the relay -
 * but expiry is a fact about TIME PASSING, which their clocks do not
 * share, so two players can disagree about whether one is gone. Making
 * them agree needs the relay to own the ledger, and the relay has no
 * message for it (there is no spawn or clear verb in net/wire.js). Said
 * here rather than left for someone to find.
 */
export function createSpawnLedger() {
  /** @type {Map<string, {seen:number, cleared?:number}>} */
  const rows = new Map();
  return {
    /** First sight starts the long clock; later sights do not restart it. */
    note(key, now) {
      if (!key || !Number.isFinite(now)) return null;
      let r = rows.get(key);
      if (!r) { r = { seen: now }; rows.set(key, r); }
      return r;
    },
    /** Emptied. The FIRST clearing starts the short clock - walking back
     *  into a dungeon you already emptied does not buy it another two
     *  days, or a cleared spawn beside a road would never die. */
    clear(key, now) {
      if (!key || !Number.isFinite(now)) return null;
      const r = rows.get(key) ?? this.note(key, now);
      if (r && !Number.isFinite(r.cleared)) r.cleared = now;
      return r;
    },
    expired: (key, now) => spawnExpired(rows.get(key), now),
    /** Gone for good: the pixel is free to be empty from here. */
    forget(key) { return rows.delete(key); },
    get size() { return rows.size; },
    /** The whole ledger, for a save to carry and a test to read. */
    toJSON: () => [...rows].map(([k, r]) => [k, r.seen, ...(Number.isFinite(r.cleared) ? [r.cleared] : [])]),
    load(rowsIn) {
      rows.clear();
      for (const [k, seen, cleared] of rowsIn ?? []) {
        if (typeof k === 'string' && Number.isFinite(seen)) rows.set(k, Number.isFinite(cleared) ? { seen, cleared } : { seen });
      }
      return rows.size;
    },
  };
}
