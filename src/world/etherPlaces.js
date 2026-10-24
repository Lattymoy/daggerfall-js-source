// @ts-check
// ETHER-PLACES (2026-10-11, the owner: "procedural islands with towns, dungeons"; bible/03-World/Eltheric-Ocean.md
// ETHER-PLACES) - THE ISLES' PLACES: a port isle's town and a ruin isle's dungeon, each a NON-MUTATING CLONE of one of the
// game's own places (spawnedDungeons.js's law - the locations are cached objects the exterior layout shares) standing on
// its isle's centre pixel under its own id, name and index. Pure: the world host (scenes/world.js `_locationToBuild`)
// asks it of an isle's pixel as the pixel builds and stands the answer in its index.
//
// THE ID keeps DFU's law - MapId & 0xfffff is the place's own number, the high 12 bits its lane (ETHER_PLACE_SALT, apart
// from the spawns' 1, the zone halls' 7, the Ocean Holes' 0x600 and the Abyss Dungeons' 2049-4095) - and its low 20
// bits are ETHER_PLACE_BASE and more: the isle's cell's own number past every pixel id the Bay has (getMapPixelID's
// ceiling is 500000), so no place of the Eltheric Ocean can share an id - a discovery, a room, a save's key - with any
// place of the Bay. Its LOCATION INDEX is its own negative (the questors' pool and the layout pins key on it; a
// spawn's -1 is shared), never a row of MAPS.BSA.
//
// THE TEMPLATES are the game's own rows (the host hands them as MAPS.BSA holds them - HUB1's law, so a client's mods
// never move what an isle stands): a TOWN a hamlet or a village of a few blocks (Veilhaven a hamlet of more - AUDIT
// CAPTAIN'S SEA P1: MAPS.BSA's villages are 2 or 4 blocks and its cities 30 and more, so the towns of six to twelve are
// its hamlets alone), never a main-story place nor one with a dungeon under it; a RUIN a dungeon whose exterior is one
// block where any is. Picked off the isle's own hash, in the rows' map-id order: the same place on every client.
import { mapPixelToLongitudeLatitude, LOCATION_TYPES } from '../formats/mapsFile.js';
import { CELLS_W, etherHash, etherBandOf, etherDepthAt, ETHER_WORD, isleAt, islesNear } from './ethericSea.js';

/** The places' lane in the id's high 12 bits, and the first low number an isle's place takes. */
export const ETHER_PLACE_SALT = 0xe7;
export const ETHER_PLACE_BASE = 500000;
/** The region the Eltheric Ocean answers for (world/ethericSea.js etherPoliticIndex: its people's name bank, its prices, its
 *  law, the far places its quests send a captain to): Betony, the Bay's westernmost isle and the nearest of its regions
 *  with places of its own to the Veil's way (the Bay's 'Islands in the Western Iliac Bay' hold none). */
export const ETHER_REGION = 19;
/** What the isles' places are called as a region, where a place's words name one. A place's own `regionName` is its
 *  region's (AUDIT CAPTAIN'S SEA P8: the quests resolve and gate a site by it - "the Eltheric Isles" named no region, and
 *  a guild's local job threw on its first tick). */
export const ETHER_REGION_NAME = `the ${ETHER_WORD} Isles`;
/** A town's blocks (its exterior's width x height): a port isle's few, Veilhaven's more - each a town that stands whole on
 *  its small isle (world/ethericSea.js: up to twelve blocks, 410 m by 307, measured dry). */
export const TOWN_BLOCKS = Object.freeze({ port: Object.freeze([2, 6]), haven: Object.freeze([6, 12]) });
/** A ruin is ELITE (dungeonContext.js: three foes a marker, each twice as hard) from this band on. */
export const ELITE_BANDS = Object.freeze(['deep', 'abyss']);

/** An isle's place's id: the lane, and the cell's own number past the Bay's pixel ids. */
export const etherPlaceId = (isle) => (((ETHER_PLACE_SALT << 20) | (ETHER_PLACE_BASE + isle.cy * CELLS_W + isle.cx)) >>> 0);
/** An isle's place's location index: its own negative (never -1, a spawn's). */
export const etherLocationIndex = (isle) => -(1000 + isle.cy * CELLS_W + isle.cx);
/** Is a map id an isle's place's? */
export const isEtherPlaceId = (id) => ((Number(id) >>> 20) & 0xfff) === ETHER_PLACE_SALT && ((Number(id) >>> 0) & 0xfffff) >= ETHER_PLACE_BASE;
/** The isle kinds that stand a place (etherTemplateOf: a port's town, a ruin's dungeon) - a wild isle and a rock none. */
export const PLACE_KINDS = Object.freeze(['port', 'ruin']);
/** ETHER-OW (2026-10-13): the isle whose place stands on this pixel - its centre, a port's or a ruin's - or null. Where
 *  the Overworld's bands are never born (the Bay's places' own law, world.js `_bandPlacePixels`) and its plates stand. */
export function etherPlaceIsle(x, y) {
  const isle = isleAt(x, y);
  return isle && isle.px === x && isle.py === y && PLACE_KINDS.includes(isle.kind) ? isle : null;
}
/** ETHER-OW: the isles of a kind whose places stand within `reach` map pixels of `at` (a circle, as the Overworld's far
 *  lists read the Bay's - systems/travel/travelFarPlaces.js farPlaces, systems/travel/travelDungeons.js nearDungeons), nearest first:
 *  `{ x, y, isle, row: { mapID, regionIndex } }` - a row in MAPS.BSA's own shape (travelDungeons.js dungeonRows), its
 *  map id the place's own. @param {{x:number, y:number}} at @param {number} reach @param {'port'|'ruin'} kind */
export function etherPlaceRows(at, reach, kind) {
  return islesNear(at.x, at.y, Math.ceil(reach)).filter((i) => i.kind === kind && Math.hypot(i.px - at.x, i.py - at.y) <= reach)
    .map((isle) => ({ x: isle.px, y: isle.py, isle, row: { mapID: etherPlaceId(isle), regionIndex: ETHER_REGION } }));
}

const blocksOf = (l) => (l?.exterior?.exteriorData?.width | 0) * (l?.exterior?.exteriorData?.height | 0);
const idOf = (l) => (l?.mapTableData?.mapId ?? 0) >>> 0;
/**
 * THE TEMPLATES from the game's rows: `{ towns, havens, ruins }`, each in map-id order - `towns` hamlets and villages of
 * TOWN_BLOCKS.port blocks, `havens` hamlets and villages of TOWN_BLOCKS.haven (Veilhaven's: the game's are hamlets), neither
 * a main-story place (`isMain`, by map id) nor one with a dungeon; `ruins` dungeons with blocks and an exterior, never
 * main-story, one block where any is. Never an isle's own place (`ether` - AUDIT CAPTAIN'S SEA P3's law: the game's rows).
 * @param {Iterable<any>} rows @param {(mapId: number) => boolean} [isMain]
 */
export function etherTemplates(rows, isMain = () => false) {
  const list = [...(rows ?? [])].filter((l) => l?.exterior?.exteriorData && !l.spawned && !l.ether && !isMain(idOf(l)));
  const type = (l) => l.mapTableData?.locationType;
  const within = (l, range) => blocksOf(l) >= range[0] && blocksOf(l) <= range[1];
  const byId = (a, b) => idOf(a) - idOf(b);
  const towns = list.filter((l) => !l.hasDungeon && (type(l) === LOCATION_TYPES.TownHamlet || type(l) === LOCATION_TYPES.TownVillage) && within(l, TOWN_BLOCKS.port)).sort(byId);
  const havens = list.filter((l) => !l.hasDungeon && (type(l) === LOCATION_TYPES.TownHamlet || type(l) === LOCATION_TYPES.TownVillage) && within(l, TOWN_BLOCKS.haven)).sort(byId);   // AUDIT CAPTAIN'S SEA P1: a city has 30 blocks and more - the list was always empty
  const dungeons = list.filter((l) => l.hasDungeon && l.dungeon?.blocks?.length);
  const small = dungeons.filter((l) => blocksOf(l) === 1);
  const ruins = (small.length ? small : dungeons).sort(byId);
  return { towns, havens, ruins };
}

/** The template an isle's place clones - off its own hash; null where the list is empty or the isle stands none. */
export function etherTemplateOf(templates, isle) {
  if (!templates || !isle) return null;
  const list = isle.kind === 'ruin' ? templates.ruins : isle.kind === 'port' ? (isle.haven && templates.havens?.length ? templates.havens : templates.towns) : null;
  return list?.length ? list[etherHash(isle.seed, 11) % list.length] : null;
}

/**
 * AN ISLE'S PLACE: the template cloned onto the isle's centre pixel - its id (the map row's, the exterior's - its
 * exteriorData's location and map ids, its record's header - and the dungeon's header's), the pixel's longitude and
 * latitude, the isle's name, the region it answers for (`where`: the host's - ETHER_REGION's index, name and politic, the
 * isle's climate's settings), its own location index, and `ether` (the isle's key) and `etherKind`; a ruin past
 * ELITE_BANDS' first is `elite`. Its exterior answers a harbour by its kind (`portTownAndUnknown`: a port's 1, any
 * other's 0 - AUDIT CAPTAIN'S SEA P10: a ruin kept its template's port byte, and read as a port town).
 * @param {any} template @param {any} isle
 * @param {{ regionIndex?: number, regionName?: string, politic?: number, climate?: any }} [where]
 */
export function synthesizeEtherLocation(template, isle, where = {}) {
  const mapId = etherPlaceId(isle);
  const ll = mapPixelToLongitudeLatitude(isle.px, isle.py);
  const port = isle.kind === 'port';
  const loc = {
    ...template,
    name: isle.name,
    regionIndex: where.regionIndex ?? ETHER_REGION,
    regionName: where.regionName ?? ETHER_REGION_NAME,
    politic: where.politic ?? template.politic,
    climate: where.climate ?? template.climate,
    locationIndex: etherLocationIndex(isle),
    mapTableData: { ...template.mapTableData, mapId, longitude: ll.x, latitude: ll.y },
    exterior: {
      ...template.exterior,
      exteriorData: { ...template.exterior?.exteriorData, locationId: mapId, mapId, portTownAndUnknown: port ? 1 : 0 },
      ...(template.exterior?.recordElement ? { recordElement: { ...template.exterior.recordElement, header: { ...template.exterior.recordElement.header, locationId: mapId } } } : {}),   // AUDIT CAPTAIN'S SEA P12
    },
    ether: isle.key,
    etherKind: isle.kind,
  };
  if (template.dungeon) loc.dungeon = { ...template.dungeon, recordElement: { ...template.dungeon?.recordElement, header: { ...template.dungeon?.recordElement?.header, locationId: mapId } } };
  if (isle.kind === 'ruin' && ELITE_BANDS.includes(etherBandOf(etherDepthAt(isle.px)).id)) loc.elite = true;
  return loc;
}
