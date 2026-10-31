// @ts-check
// SD2 (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most";
// bible/11-Multiplayer/Super-Dungeons.md sections 3 and 5): WHERE THE HOLLOW STANDS, AND WHAT STANDS THERE - the
// client's half of the site, over the world's own data, the gate's own way (systems/gate/gateSite.js).
//
// The relay chose the REGION (net/superDungeon/sdLaw.js pickSdRegion - the census of its players) and knows nothing more; every
// client then finds the same pixel from the map files it holds alike:
//   1. THE CITY. The region's populated places ranked as its hub is chosen (systems/region/regionHubs.js hubClaim: a city
//      over a town over a village, the one named for its region, then the largest - "where population is at its
//      most" in its second sense). With no region (-1, nobody to count) the candidates are the Bay's first
//      SD_GREAT_CITIES cities by that same claim (one named for its region, then the most blocks, then the most
//      buildings), and the slot's roll picks one.
//   2. THE SITE. Around the city, a pixel the gate's own scan calls suitable (land, no location on it or its eight
//      neighbours, no spawned dungeon rolled there, a province's) whose NEAREST fast-travel town is that city - two to
//      four pixels out (GATE_TOWN_MIN_PX..GATE_TOWN_MAX_PX), a ride from its gates. The slot's roll picks among them;
//      a city with none passes to the next one down the ranking.
//   3. THE TEMPLATE. A real labyrinth or keep of at least SD_TEMPLATE_MIN_BLOCKS blocks, with a spawn's clearance (a
//      one- or two-block exterior - world/spawnedDungeons.js SPAWN_CLEARANCE_M), never the main story's - the slot's
//      roll picks one, so every Hollow is a different deep place.
//   4. THE HOLLOW. The template cloned on the site under the SLOT's own id (sdSalt - never WORLD_SALT's, so a later
//      Hollow on the same pixel is a different dungeon with a different room and a different memory), named
//      (net/superDungeon/sdLaw.js sdNameOf), Super (`superTier`, systems/dungeon/dungeonTier.js), standing centred in its pixel as every
//      spawned dungeon does.
//
// Pure: the locations, the scan and the record are arguments. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { LOCATION_TYPES, REGION_NAMES } from '../../formats/mapsFile.js';
import { hubClaim, outranks } from '../region/regionHubs.js';
import { sdRoll, sdNameOf, sdLaneOf, SD_LANE_SPAN } from '../../net/superDungeon/sdLaw.js';
import { synthesizeDungeonLocation, spawnClearance, SPAWN_CLEARANCE_M, SALT_MAX } from '../../world/spawnedDungeons.js';
import { worldPixelOfKey } from '../../world/worldWide/worldGrid.js'; // WW5: a theatre's pixels are the world's keys
import { inBay } from '../../world/tamriel/tamrielFrame.js';

/** With no region the census could name, the Hollow rises by one of the Bay's first this-many cities by the hubs' own claim
 *  (systems/region/regionHubs.js hubClaim: its kind, named for its region, its blocks, its buildings - AUDIT SD II: "largest"
 *  it is not; a city named for its region outranks a larger one). */
export const SD_GREAT_CITIES = 8;
/** A Hollow's template has at least this many blocks - a deep place, whatever size the world lays it at. */
export const SD_TEMPLATE_MIN_BLOCKS = 12;
/** ...and is a labyrinth or a keep. */
export const SD_TEMPLATE_TYPES = Object.freeze([LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep]);
/** The Hollows' map-id salts sit above this (spawned dungeons roll with salt 1, world/spawnedDungeons.js WORLD_SALT). */
export const SD_SALT_BASE = 2048;
/** A slot's map-id salt: 2049..4095, a slot's own until the 2047th Hollow after it (AUDIT SD II, L4 C4: the period is
 *  2047 - slots 1 and 2048 share 2049). */
export const sdSalt = (s) => SD_SALT_BASE + 1 + ((Math.max(1, s | 0) - 1) % (SALT_MAX - SD_SALT_BASE));

const W = 1000;
/** A location's map pixel, off its MapId's low twenty bits (DFU's own law - systems/map/mapDirectory.js). */
export const pixelOfLoc = (loc) => {
  const id = (Number(loc?.mapTableData?.mapId) >>> 0) & 0xfffff;
  return { px: id % W, py: Math.floor(id / W) };
};
/** AUDIT TAMRIEL-WIDE C4: a Hollow's city's pixel - a registry place's own (a province's Hollow, WW5), else its MapId's. */
export const cityPixelOf = (city) =>
  Number.isInteger(city?.px) && Number.isInteger(city?.py) ? { px: city.px, py: city.py } : pixelOfLoc(city);

/**
 * The cities a Hollow in region `r` may rise by, best first (the hubs' claim, then the lower region): the region's
 * populated places, or with `r` -1 the Bay's first SD_GREAT_CITIES cities by that claim.
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
  rows.sort((a, b) =>
    outranks(a.claim, b.claim) ? -1 : outranks(b.claim, a.claim) ? 1 : a.loc.regionIndex - b.loc.regionIndex,
  );
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
      if (!l) m.set(t, (l = []));
      l.push(p);
    }
  }
  for (const l of m.values()) l.sort((a, b) => a - b); // row-major: the roll's order is the data's
  _byTown.set(scan, m);
  return m;
}

/**
 * THE SITE of a record's Hollow, or null when the world offers none: the first city (`cities`, sdCities' order - for
 * the great cities the slot's roll picks where the list begins) with suitable pixels it is the nearest town to, and
 * the slot's roll among them. `scan` is the gate's (systems/gate/gateSite.js scanGatePixels). AUDIT SD IV (F37): ON DRY
 * GROUND - `ground(px, py)` the spawns' own test (world/spawnedDungeons.js createSpawnGround, SPAWN-SHORE: the plateau the
 * build flattens it to above the beach band), the gate's scan having none: from the roll on through the city's pixels
 * to the first dry one, and a city with none passes to the next (a Hollow stood on a coast's square of sand). The roll's
 * own pixel, where it is dry, as before.
 * @param {{ s:number, r:number }} rec
 * @param {{ byRegion: Map<number, ArrayLike<number>>, towns: Array<{name:string, px:number, py:number, region:number}>, townAt: ArrayLike<number> }} scan
 * @param {any[]} cities
 * @param {(px: number, py: number) => boolean} [ground]
 */
export function findSdSite(rec, scan, cities, ground = () => true) {
  if (!rec || !scan || !cities?.length) return null;
  const byTown = pixelsByTown(scan);
  const start = rec.r < 0 ? sdRoll(rec.s, 5) % cities.length : 0;
  for (let k = 0; k < cities.length; k++) {
    const city = cities[(start + k) % cities.length];
    const { px: cx, py: cy } = pixelOfLoc(city);
    const ti = scan.towns.findIndex((t) => t.px === cx && t.py === cy);
    const pixels = ti >= 0 ? byTown.get(ti) : null;
    if (!pixels?.length) continue;
    const roll = sdRoll(rec.s, 4) % pixels.length;
    for (let j = 0; j < pixels.length; j++) {
      const id = pixels[(roll + j) % pixels.length];
      if (!ground(id % W, Math.floor(id / W))) continue;
      return {
        s: rec.s,
        px: id % W,
        py: Math.floor(id / W),
        city,
        cityName: String(city.name ?? ''),
        cityRegion: city.regionIndex,
        region: rec.r,
      };
    }
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
  return [...(locations ?? [])].filter(
    (l) =>
      l?.hasDungeon &&
      (l.dungeon?.blocks?.length ?? 0) >= SD_TEMPLATE_MIN_BLOCKS &&
      SD_TEMPLATE_TYPES.includes(l.mapTableData?.locationType) &&
      l.exterior?.exteriorData &&
      !l.spawned &&
      !isMain(l.mapTableData?.mapId) &&
      spawnClearance(l.exterior.exteriorData.width, l.exterior.exteriorData.height) >= SPAWN_CLEARANCE_M,
  );
}
/** The slot's template, or null for none. */
export const pickSdTemplate = (s, templates) => (templates?.length ? templates[sdRoll(s, 3) % templates.length] : null);

// ═══ WW5: A HOLLOW PAST THE BAY ═══════════════════════════════════════
//
// (bible/03-World/World-Wide.md WW5) A province's lane raises its own Hollow (net/superDungeon/sdLaw.js): its census its
// province's region, else its great cities - the province's own, off the world's registry of places (TESA's - WW7-1),
// ranked by the hubs' own claim as the Bay's rows are; its site the gate's own suitable pixels of its theatre
// (systems/gate/theatreGateSite.js scanTheatreGate - the registry's places, the land's own water) whose nearest town is
// that city, on dry ground; its template the Bay's own labyrinths and keeps; its map id a lane of the Hollows' own past
// the Bay (MAPS.BSA's 20-bit pixel id holds no pixel past it).

/** WW5: a registry place's claim to its province's first city - the hubs' own order (systems/region/regionHubs.js
 *  hubClaim: a city over a town over a village, the one named for its province, its blocks), the lower map id on a tie. */
const placeClaim = (p, provinceName) => {
  const claim = hubClaim(
    {
      name: p.name,
      locationIndex: 0,
      mapTableData: { locationType: p.type },
      exterior: { exteriorData: { width: p.w, height: p.h } },
    },
    provinceName,
  );
  return claim ? [...claim.slice(0, 4), -(p.mapId >>> 0)] : null;
};
/**
 * WW5: THE CITIES A PROVINCE'S HOLLOW MAY RISE BY, best first - the registry's listed populated places of theatre
 * `theatre` (`places` - world/worldWide/worldPlaces.js), or with `r` -1 its first SD_GREAT_CITIES cities by the claim.
 * Each is a place's record (`{ name, px, py, region, mapId, ... }`).
 * @param {{ inTheatre: (t: number) => Iterable<any> }|null} places @param {number} theatre @param {number} r
 * @param {{ provinceName?: string }} [o]
 */
export function sdTheatreCities(places, theatre, r, { provinceName = '' } = {}) {
  const rows = [];
  for (const p of places?.inTheatre(theatre) ?? []) {
    if (!p || p.theatre !== theatre) continue;
    const claim = placeClaim(p, provinceName);
    if (!claim) continue;
    if (r < 0 && p.type !== LOCATION_TYPES.TownCity) continue;
    rows.push({ p, claim });
  }
  rows.sort((a, b) => (outranks(a.claim, b.claim) ? -1 : outranks(b.claim, a.claim) ? 1 : 0));
  return (r < 0 ? rows.slice(0, SD_GREAT_CITIES) : rows).map((x) => x.p);
}
/** A theatre scan's suitable pixels by their nearest town (index into scan.towns), made once per scan. */
const _theatreByTown = new WeakMap();
function theatrePixelsByTown(scan) {
  let m = _theatreByTown.get(scan);
  if (m) return m;
  m = new Map();
  for (const [k, t] of scan.townOf) {
    let l = m.get(t);
    if (!l) m.set(t, (l = []));
    l.push(k);
  }
  for (const l of m.values()) l.sort((a, b) => a - b); // by the world's key, row by row: the roll's order is the data's
  _theatreByTown.set(scan, m);
  return m;
}
/**
 * WW5: THE SITE of a province lane's Hollow, or null when its theatre offers none - findSdSite's own law over its
 * theatre's scan (systems/gate/theatreGateSite.js TheatreGateScan): the first city (sdTheatreCities' order; the slot's roll
 * picks where the great cities begin) with suitable pixels it is the nearest town to, the slot's roll among them, from
 * there to the first on dry ground (`ground` - the spawns' own SPAWN-SHORE test).
 * @param {{ s: number, r: number }} rec
 * @param {import('../gate/theatreGateSite.js').TheatreGateScan} scan
 * @param {any[]} cities @param {(px: number, py: number) => boolean} [ground]
 */
export function findSdTheatreSite(rec, scan, cities, ground = () => true) {
  if (!rec || !scan?.townOf || !cities?.length) return null;
  const byTown = theatrePixelsByTown(scan);
  const start = rec.r < 0 ? sdRoll(rec.s, 5) % cities.length : 0;
  for (let k = 0; k < cities.length; k++) {
    const city = cities[(start + k) % cities.length];
    const ti = scan.towns.findIndex((t) => t.px === city.px && t.py === city.py);
    const pixels = ti >= 0 ? byTown.get(ti) : null;
    if (!pixels?.length) continue;
    const roll = sdRoll(rec.s, 4) % pixels.length;
    for (let j = 0; j < pixels.length; j++) {
      const [px, py] = worldPixelOfKey(pixels[(roll + j) % pixels.length]);
      if (!ground(px, py)) continue;
      return {
        s: rec.s,
        px,
        py,
        city,
        cityName: String(city.name ?? ''),
        cityRegion: city.region,
        region: rec.r,
        lane: sdLaneOf(rec.s),
      };
    }
  }
  return null;
}
/** WW5: the Hollows' own lane of map ids past the Bay (the high twelve bits - past the countryside's, the lairs' and the
 *  capitals', 0x300..0x341, and every MAPS.BSA row's 0..0x728 holds no id with 0x80000 set: a Bay pixel's 20-bit id is
 *  under 500,000), the slot's lane and its number in its span in the low nineteen. */
export const SD_WORLD_LANE = 0x35d;
/** WW5: a Hollow past the Bay's map id - its slot's own (the 32,768th of a lane after it shares it, as the Bay's Hollows'
 *  salts share theirs every 2,047th). */
export const sdWorldMapId = (s) =>
  ((SD_WORLD_LANE << 20) | 0x80000 | ((sdLaneOf(s) & 0xf) << 15) | ((s % SD_LANE_SPAN) & 0x7fff)) >>> 0;

/**
 * THE HOLLOW: the template cloned on the site under the slot's own map id, named, Super. `where` is what the host's
 * map files say of the site's pixel (region, politic, climate) - spawned dungeons' own law. WW5: a site past the Bay
 * under the Hollows' world lane (sdWorldMapId).
 * @param {{ s:number }} rec
 * @param {{ px:number, py:number, cityName:string }} site
 * @param {any} template
 * @param {{ regionIndex?:number, regionName?:string, politic?:number, climate?:object }} [where]
 */
export function sdHollowLocation(rec, site, template, where = {}) {
  if (!rec || !site || !template) return null;
  const loc = synthesizeDungeonLocation(template, {
    salt: sdSalt(rec.s),
    px: site.px,
    py: site.py,
    where,
    elite: false,
    mapId: inBay(site.px, site.py) ? null : sdWorldMapId(rec.s),
  });
  return { ...loc, name: sdNameOf(rec.s, site.cityName), superTier: true, sdSlot: rec.s };
}
