// @ts-check
// SD2 (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most";
// bible/11-Multiplayer/Super-Dungeons.md sections 3 and 5): WHERE THE HOLLOW STANDS, AND WHAT STANDS THERE - the
// client's half of the site, over the world's own data, the gate's own way (systems/gateSite.js).
//
// The relay chose the REGION (net/sdLaw.js pickSdRegion - the census of its players) and knows nothing more; every
// client then finds the same pixel from the map files it holds alike:
//   1. THE CITY. The region's populated places ranked as its hub is chosen (systems/regionHubs.js hubClaim: a city
//      over a town over a village, the one named for its region, then the largest - "where population is at its
//      most" in its second sense). With no region (-1, nobody to count) the candidates are the Bay's SD_GREAT_CITIES
//      largest cities, and the slot's roll picks one.
//   2. THE SITE. Around the city, a pixel the gate's own scan calls suitable (land, no location on it or its eight
//      neighbours, no spawned dungeon rolled there, a province's) whose NEAREST fast-travel town is that city - two to
//      four pixels out (GATE_TOWN_MIN_PX..GATE_TOWN_MAX_PX), a ride from its gates. The slot's roll picks among them;
//      a city with none passes to the next one down the ranking.
//   3. THE TEMPLATE. A real labyrinth or keep of at least SD_TEMPLATE_MIN_BLOCKS blocks, with a spawn's clearance (a
//      one- or two-block exterior - world/spawnedDungeons.js SPAWN_CLEARANCE_M), never the main story's - the slot's
//      roll picks one, so every Hollow is a different deep place.
//   4. THE HOLLOW. The template cloned on the site under the SLOT's own id (sdSalt - never WORLD_SALT's, so a later
//      Hollow on the same pixel is a different dungeon with a different room and a different memory), named
//      (net/sdLaw.js sdNameOf), Super (`superTier`, systems/dungeonTier.js), standing centred in its pixel as every
//      spawned dungeon does.
//
// Pure: the locations, the scan and the record are arguments. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { LOCATION_TYPES, REGION_NAMES } from '../formats/mapsFile.js';
import { hubClaim, outranks } from './regionHubs.js';
import { sdRoll, sdNameOf } from '../net/sdLaw.js';
import { synthesizeDungeonLocation, spawnClearance, SPAWN_CLEARANCE_M, SALT_MAX } from '../world/spawnedDungeons.js';

/** With no region the census could name, the Hollow rises by one of the Bay's this-many largest cities. */
export const SD_GREAT_CITIES = 8;
/** A Hollow's template has at least this many blocks - a deep place, whatever size the world lays it at. */
export const SD_TEMPLATE_MIN_BLOCKS = 12;
/** ...and is a labyrinth or a keep. */
export const SD_TEMPLATE_TYPES = Object.freeze([LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep]);
/** The Hollows' map-id salts sit above this (spawned dungeons roll with salt 1, world/spawnedDungeons.js WORLD_SALT). */
export const SD_SALT_BASE = 2048;
/** A slot's map-id salt: 2049..4095, a slot's own until the 2048th Hollow after it. */
export const sdSalt = (s) => SD_SALT_BASE + 1 + ((Math.max(1, s | 0) - 1) % (SALT_MAX - SD_SALT_BASE));

const W = 1000;
/** A location's map pixel, off its MapId's low twenty bits (DFU's own law - systems/mapDirectory.js). */
const pixelOfLoc = (loc) => { const id = (Number(loc?.mapTableData?.mapId) >>> 0) & 0xfffff; return { px: id % W, py: Math.floor(id / W) }; };

/**
 * The cities a Hollow in region `r` may rise by, best first (the hubs' claim, then the lower region): the region's
 * populated places, or with `r` -1 the Bay's SD_GREAT_CITIES largest cities.
 * @param {Iterable<any>} locations every location, each with its regionIndex and locationIndex
 * @param {number} r
 * @param {{ isBase?: (loc:any) => boolean, regionNameOf?: (r:number) => string }} [o]
 */
export function sdCities(locations, r, { isBase = () => true, regionNameOf = (i) => REGION_NAMES[i] ?? '' } = {}) {
  const rows = [];
  for (const loc of locations ?? []) {
    if (!loc || !Number.isInteger(loc.regionIndex) || !Number.isInteger(loc.locationIndex) || !isBase(loc)) continue;
    if (r >= 0 && loc.regionIndex !== r) continue;
    const claim = hubClaim(loc, regionNameOf(loc.regionIndex));
    if (!claim) continue;
    if (r < 0 && loc.mapTableData?.locationType !== LOCATION_TYPES.TownCity) continue;
    rows.push({ loc, claim });
  }
  rows.sort((a, b) => (outranks(a.claim, b.claim) ? -1 : outranks(b.claim, a.claim) ? 1 : a.loc.regionIndex - b.loc.regionIndex));
  return (r < 0 ? rows.slice(0, SD_GREAT_CITIES) : rows).map((x) => x.loc);
}

/** The gate scan's suitable pixels by their nearest town (index into scan.towns), made once per scan. */
const _byTown = new WeakMap();
function pixelsByTown(scan) {
  let m = _byTown.get(scan);
  if (m) return m;
  m = new Map();
  for (const list of scan.byRegion.values()) {
    for (const p of list) {
      const t = scan.townAt[p];
      if (t < 0) continue;
      let l = m.get(t);
      if (!l) m.set(t, l = []);
      l.push(p);
    }
  }
  for (const l of m.values()) l.sort((a, b) => a - b);   // row-major: the roll's order is the data's
  _byTown.set(scan, m);
  return m;
}

/**
 * THE SITE of a record's Hollow, or null when the world offers none: the first city (`cities`, sdCities' order - for
 * the great cities the slot's roll picks where the list begins) with suitable pixels it is the nearest town to, and
 * the slot's roll among them. `scan` is the gate's (systems/gateSite.js scanGatePixels).
 * @param {{ s:number, r:number }} rec
 * @param {{ byRegion: Map<number, ArrayLike<number>>, towns: Array<{name:string, px:number, py:number, region:number}>, townAt: ArrayLike<number> }} scan
 * @param {any[]} cities
 */
export function findSdSite(rec, scan, cities) {
  if (!rec || !scan || !cities?.length) return null;
  const byTown = pixelsByTown(scan);
  const start = rec.r < 0 ? sdRoll(rec.s, 5) % cities.length : 0;
  for (let k = 0; k < cities.length; k++) {
    const city = cities[(start + k) % cities.length];
    const { px: cx, py: cy } = pixelOfLoc(city);
    const ti = scan.towns.findIndex((t) => t.px === cx && t.py === cy);
    const pixels = ti >= 0 ? byTown.get(ti) : null;
    if (!pixels?.length) continue;
    const id = pixels[sdRoll(rec.s, 4) % pixels.length];
    return { s: rec.s, px: id % W, py: Math.floor(id / W), city, cityName: String(city.name ?? ''), cityRegion: city.regionIndex, region: rec.r };
  }
  return null;
}

/**
 * The real dungeons a Hollow may clone: a labyrinth or a keep of at least SD_TEMPLATE_MIN_BLOCKS blocks, with an
 * exterior a spawn's clearance allows, never the main story's (`isMain`, by MapId) and never a clone.
 * @param {Iterable<any>} locations
 * @param {(mapId:number) => boolean} [isMain]
 */
export function sdTemplates(locations, isMain = () => false) {
  return [...(locations ?? [])].filter((l) => l?.hasDungeon && (l.dungeon?.blocks?.length ?? 0) >= SD_TEMPLATE_MIN_BLOCKS
    && SD_TEMPLATE_TYPES.includes(l.mapTableData?.locationType) && l.exterior?.exteriorData && !l.spawned
    && !isMain(l.mapTableData?.mapId)
    && spawnClearance(l.exterior.exteriorData.width, l.exterior.exteriorData.height) >= SPAWN_CLEARANCE_M);
}
/** The slot's template, or null for none. */
export const pickSdTemplate = (s, templates) => (templates?.length ? templates[sdRoll(s, 3) % templates.length] : null);

/**
 * THE HOLLOW: the template cloned on the site under the slot's own map id, named, Super. `where` is what the host's
 * map files say of the site's pixel (region, politic, climate) - spawned dungeons' own law.
 * @param {{ s:number }} rec
 * @param {{ px:number, py:number, cityName:string }} site
 * @param {any} template
 * @param {{ regionIndex?:number, regionName?:string, politic?:number, climate?:object }} [where]
 */
export function sdHollowLocation(rec, site, template, where = {}) {
  if (!rec || !site || !template) return null;
  const loc = synthesizeDungeonLocation(template, { salt: sdSalt(rec.s), px: site.px, py: site.py, where, elite: false });
  return { ...loc, name: sdNameOf(rec.s, site.cityName), superTier: true, sdSlot: rec.s };
}
