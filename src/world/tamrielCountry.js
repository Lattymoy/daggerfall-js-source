// @ts-check
// TESA7 (2026-10-12, the owner: "Populating the world with unique and smaller towns, farms, etc"; bible/03-World/
// Arena-Provinces.md TESA7) - THE COUNTRYSIDE PAST THE BAY: the hamlets, villages, farms, homes, inns, temples and shrines
// that stand between Arena's places, as thick on the ground as the Bay's own. Pure: the world host (scenes/world.js
// `_locationToBuild`) asks it of a pixel past the Bay that Arena's places leave free, as the pixel builds, and stands the
// answer in its index.
//
// THE RATE IS THE BAY'S. Each climate stands what the Bay stands on its land of that climate: of every kind here, the
// game's rows of that kind on a pixel of that climate, over the Bay's land pixels of it (MAPS.BSA, CLIMATE.PAK and
// WOODS.WLD as the player's own files hold them - nothing of the count is kept in the port). A pixel's own hash rolls
// it, kind by kind in COUNTRY_TYPES order: the same pixels stand the same places on every client and in every session.
// Never a city (Arena's city-states are the cities), never a place with a dungeon (TESA8's).
//
// THE CLONE is the Etheric Sea's, the spawns' and Arena's law (world/etherPlaces.js, world/spawnedDungeons.js,
// world/arenaLocations.js): a NON-MUTATING clone of one of the game's own places of its kind, as MAPS.BSA holds it, picked
// off the pixel's hash in map-id order; never a main-story place nor one the port made. Its NAME is the province's: a
// frame of the kind's (a farmstead, a manor, a shrine) round a stem drawn from the province's people's bank (world/
// tamrielPeople.js - DFU's NameGen, a Nord's names in Skyrim), an inn's from DFU's own tavern words, a temple's an epithet
// of one of the Eight. Drawn on DFRandom off the pixel's seed with the stream's state put back after (characters/
// nameHelper.js draws on the global stream).
//
// THE ID keeps DFU's law - MapId & 0xfffff the place's number, the high 12 bits its lane - over the pixel's ordinal on a
// fixed grid (COUNTRY_GRID: the continent's frame at the shipped fit and its margin), 19 bits of it a lane and the rest
// the lane's number among COUNTRY_LANES lanes from COUNTRY_LANE (apart from the spawns' 1, the zone halls' 7, Arena's 0xa7,
// the isles' 0xe7, the Ocean Holes' 0x600 and the Abyss Dungeons' 2049-4095). Its low 20 bits always carry 0x80000: past
// every pixel id the Bay has (getMapPixelID's ceiling is 500000), so a country place's discovery (systems/discovery.js
// keys on the low 20) never marks a place of the Bay found. Its LOCATION INDEX is its own negative, past Arena's.
import { mapPixelToLongitudeLatitude, longitudeLatitudeToMapPixel, LOCATION_TYPES } from '../formats/mapsFile.js';
import { hash32, plateauDry } from './spawnedDungeons.js';
import { WATER_BYTE } from './roadsProducer.js';   // TESA14: the beach line a place stands over
import { insideGhostfence } from './tamriel/ghostfence.js';   // GHOSTFENCE: none of it within the Ghostfence
import { srand, rand, getSeed, setSeed } from '../formats/dfRandom.js';
import { firstName, surname, GENDERS, BANK_TYPES, withGameNameBanks } from '../characters/nameHelper.js';   // AUDIT TESA II P10: a place's name on the game's own banks
import { tavernsA, tavernsB } from './buildingNames.js';   // L10N: the tavern words - AUDIT TESA II P10: read in DFU's own English for a place (withBaseText)
import { withBaseText } from '../systems/textManager.js';
import { unwalledLocation } from './townShape.js';   // TS7: a Bay city cloned as it was read
import { BAY_W, BAY_H, tamrielFit } from './tamriel/tamrielFrame.js';
import { tamrielLandVersion } from './tamriel/tamrielLand.js';   // AUDIT-TESA A7-1: the ground's reads kept a land
import { CAPITAL_LANE } from './tamrielCapitals.js';   // TESA10: the capitals' lane, after the lairs'

/** The pixel hash's salt. Changing it moves every place of the countryside. */
export const COUNTRY_SALT = 0xc0c7;
/** The kinds the countryside stands, in the roll's order. */
export const COUNTRY_TYPES = Object.freeze([LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage, LOCATION_TYPES.HomeFarms,
  LOCATION_TYPES.ReligionTemple, LOCATION_TYPES.Tavern, LOCATION_TYPES.HomeWealthy, LOCATION_TYPES.ReligionCult, LOCATION_TYPES.HomePoor]);
/** The id's lanes: the first, and how many. */
/** The countryside's pixel provider's name in the world's registry (scenes/tamrielPlacesHost.js registers it once the land
 *  past the Bay stands; AUDIT DRAGON-CELL D8: a reader of that land waits for it). */
export const COUNTRY_SOURCE = 'tesa-country';
export const COUNTRY_LANE = 0x300;
export const COUNTRY_LANES = 64;
/** The location indices count down from here, past Arena's (-1,000,000 and down 432). */
export const COUNTRY_INDEX_BASE = 2000000;
/** The ordinal's grid: a Bay pixel (x, y) is (x + x0, y + y0) on it, 2^13 wide and 2^12 high - the continent's frame at the
 *  shipped fit (-862..5138 by -975..2775) inside it with room. A pixel off it stands none. */
export const COUNTRY_GRID = Object.freeze({ x0: 1024, y0: 1024, wBits: 13, h: 4096 });

/** A pixel's ordinal on the grid, or -1 off it. */
export function countryOrdinal(px, py) {
  const x = px + COUNTRY_GRID.x0, y = py + COUNTRY_GRID.y0;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 1 << COUNTRY_GRID.wBits || y >= COUNTRY_GRID.h) return -1;
  return (y << COUNTRY_GRID.wBits) | x;
}
/** An ordinal's map id. */
export const countryPlaceId = (n) => (((COUNTRY_LANE + (n >>> 19)) << 20) | 0x80000 | (n & 0x7ffff)) >>> 0;
/** BAY-LEFT-B: a country place's map id read back to its pixel (countryPlaceId's and countryOrdinal's inverse) - a seat
 *  in the countryside is no list's row (scenes/bootStartHost.js stands a birth there by its id); null for any other id. */
export function countryPixelOfId(id) {
  const v = Number(id) >>> 0, lane = (v >>> 20) & 0xfff;
  if (lane < COUNTRY_LANE || lane >= COUNTRY_LANE + COUNTRY_LANES || (v & 0x80000) === 0) return null;
  const n = ((lane - COUNTRY_LANE) << 19) | (v & 0x7ffff);
  return { x: (n & ((1 << COUNTRY_GRID.wBits) - 1)) - COUNTRY_GRID.x0, y: (n >>> COUNTRY_GRID.wBits) - COUNTRY_GRID.y0 };
}
/** TESA8 (world/tamrielDungeons.js): the lairs' one lane, after the country places' - a dungeon an 8 x 8 cell of the
 *  grid at most, its cell's index (19 bits) with 0x80000 set its low 20, none a Bay place's. AUDIT TAMRIEL-WIDE C3: an
 *  isle's ruin can share those 20 bits, so a dungeon's identity past the Bay is its whole id (scenes/dungeonIdentity.js). */
export const LAIR_LANE = COUNTRY_LANE + COUNTRY_LANES;
/** Is a map id a place the port made past the Bay - a country place's (TESA7), a lair's (TESA8) or a capital's (TESA10)?
 *  BAY-LEFT-B: a house is sold in one and its deed read there, held to its own map id (systems/banking.js deedHeldIn over
 *  world/placeIds.js isMadePlaceId - every place the port made) - where none was, each its province's region's one slot. */
export function isCountryPlaceId(id) {
  const v = Number(id) >>> 0, lane = (v >>> 20) & 0xfff;
  return lane >= COUNTRY_LANE && lane <= CAPITAL_LANE && (v & 0x80000) !== 0;
}
/** An ordinal's location index: its own negative. */
export const countryLocationIndex = (n) => -(COUNTRY_INDEX_BASE + n);

const idOf = (l) => (l?.mapTableData?.mapId ?? 0) >>> 0;
/**
 * THE TEMPLATES from the game's rows: a list a kind (COUNTRY_TYPES), each in map-id order - the rows of that location type
 * with an exterior and no dungeon; never a main-story place (`isMain`, by map id) nor one the port made.
 * @param {Iterable<any>} rows @param {(mapId: number) => boolean} [isMain]
 * @returns {Map<number, any[]>}
 */
export function countryTemplates(rows, isMain = () => false) {
  const list = [...(rows ?? [])].map(unwalledLocation).filter((l) => l?.exterior?.exteriorData && !l.hasDungeon && !l.spawned && !l.ether && !l.arena && !l.country && !isMain(idOf(l)));   // TS7
  const out = new Map();
  for (const type of COUNTRY_TYPES) out.set(type, list.filter((l) => l.mapTableData?.locationType === type).sort((a, b) => idOf(a) - idOf(b)));
  return out;
}

/**
 * THE BAY'S COUNT: of each climate, how many templates of each kind stand on a pixel of it.
 * @param {Map<number, any[]>} templates countryTemplates'
 * @param {(x: number, y: number) => number} climateAt the host's climate read
 * @returns {Map<number, Map<number, number>>}
 */
export function countryCounts(templates, climateAt) {
  const out = new Map();
  for (const [type, list] of templates) {
    for (const l of list) {
      const p = longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude);
      const c = climateAt(p.x, p.y);
      if (!out.has(c)) out.set(c, new Map());
      const row = out.get(c);
      row.set(type, (row.get(type) ?? 0) + 1);
    }
  }
  return out;
}

/**
 * THE BAY'S LAND: of each climate, how many of the Bay's pixels are land of it.
 * @param {(x: number, y: number) => number} climateAt @param {(x: number, y: number, climate: number) => boolean} isWater
 * @returns {Map<number, number>}
 */
export function bayLand(climateAt, isWater) {
  const out = new Map();
  for (let y = 0; y < BAY_H; y++) {
    for (let x = 0; x < BAY_W; x++) {
      const c = climateAt(x, y);
      if (!isWater(x, y, c)) out.set(c, (out.get(c) ?? 0) + 1);
    }
  }
  return out;
}

/**
 * THE RATES: of each climate, its kinds' chances as a pixel's roll reads them - [type, the roll's ceiling for it] in
 * `types` order (COUNTRY_TYPES; TESA8's LAIR_TYPES), the last ceiling the climate's whole chance. A climate with no land
 * on the Bay stands none.
 * @param {Map<number, Map<number, number>>} counts @param {Map<number, number>} land @param {readonly number[]} [types]
 * @returns {Map<number, Array<[number, number]>>}
 */
export function countryRates(counts, land, types = COUNTRY_TYPES) {
  const out = new Map();
  for (const [c, row] of counts) {
    const n = land.get(c) ?? 0;
    if (!n) continue;
    let ceiling = 0;
    const steps = [];
    for (const type of types) {
      const k = row.get(type) ?? 0;
      if (!k) continue;
      ceiling += k / n;
      steps.push([type, ceiling]);
    }
    if (steps.length) out.set(c, steps);
  }
  return out;
}

/** A pixel's roll, [0, 1). */
export const countryRoll = (px, py) => hash32(COUNTRY_SALT, px, py, 1) / 4294967296;

/**
 * WHAT A PIXEL STANDS by its roll: its kind (the climate's rates) and the template (its list off the pixel's hash) - or
 * null: the roll past the climate's chance, a climate with none, a kind with no template, a pixel within the Ghostfence.
 * @param {Map<number, Array<[number, number]>>} rates @param {Map<number, any[]>} templates
 * @param {number} climate @param {number} px @param {number} py
 * @returns {?{ type: number, template: any }}
 */
export function countryPick(rates, templates, climate, px, py) {
  const steps = rates?.get(climate);
  if (!steps || insideGhostfence(px, py)) return null;
  const r = countryRoll(px, py);
  const step = steps.find(([, ceiling]) => r < ceiling);
  if (!step) return null;
  const list = templates?.get(step[0]);
  if (!list?.length) return null;
  return { type: step[0], template: list[hash32(COUNTRY_SALT, px, py, 2) % list.length] };
}

/**
 * TESA14: WHAT THE COUNTRYSIDE STANDS ON A PIXEL PAST THE BAY - the one roll the world host's build (scenes/world.js
 * countryRollAt), the held map's atlas and the roads' worker (world/tamrielRoadsWorker.js) all read: the pick
 * (countryPick: the climate's rates, the pixel's hash) on dry ground - over the beach line (roadsProducer.js WATER_BYTE)
 * and its plateau clear of the sea's edge (`ground`, createCountryGround) - or null. No road takes a place's pixel: the
 * places are the network's own nodes and obstacles (world/tamrielRoads.js).
 * @param {{ rates: Map<number, Array<[number, number]>>, templates: Map<number, any[]>, climateAt: (x: number, y: number) => number,
 *   heightAt: (x: number, y: number) => number, ground: (x: number, y: number) => boolean }} at @param {number} px @param {number} py
 */
export function countryStandsAt({ rates, templates, climateAt, heightAt, ground }, px, py) {
  const pick = countryPick(rates, templates, climateAt(px, py), px, py);
  return pick && heightAt(px, py) > WATER_BYTE && ground(px, py) ? pick : null;
}
/** AUDIT TESA II Z7/Z9: MAY the countryside stand on (px, py) - countryStandsAt without its dry plateau (the dear part,
 *  a kernel's sum): every pixel it stands on, and the few it would where its plateau lies under the beach. A neighbour's
 *  test (scenes/zoneHallsHost.js: a hall never beside a place) asks this, so a hall's ground costs no farm's plateau.
 *  @param {{ rates: any, templates: any, climateAt: (x: number, y: number) => number, heightAt: (x: number, y: number) => number }} roll */
export function countryMayStandAt({ rates, templates, climateAt, heightAt }, px, py) {
  return !!countryPick(rates, templates, climateAt(px, py), px, py) && heightAt(px, py) > WATER_BYTE;
}

/** A temple's epithet and its god - one of the Eight. */
export const TEMPLE_EPITHETS = Object.freeze(['Sacred', 'Holy', 'Blessed', 'Eternal', 'Perpetual', 'Singing', 'Weeping', 'Wailing', 'Burning', 'Gentle', 'Silent', 'Shining']);
export const TEMPLE_NOUNS = Object.freeze(['Oracle', 'Omen', 'Relic', 'Idol', 'Prophet', 'Soul', 'Star', 'Rebirth', 'Ascension', 'Flame', 'Vigil', 'Tree']);
export const TEMPLE_GODS = Object.freeze(['Akatosh', 'Arkay', 'Dibella', 'Julianos', 'Kynareth', 'Mara', 'Stendarr', 'Zenithar']);
/** An inn's last word. */
export const TAVERN_KINDS = Object.freeze(['Tavern', 'Inn', 'Pub', 'Hostel', 'Lodge']);
/** The kinds' frames: %s a surname-like stem of the bank (its first name where it has none), %f a first name, %t a town's
 *  stem, %v an inn's name, %e %n %g a temple's epithet, noun and god. */
export const COUNTRY_NAME_FRAMES = Object.freeze({
  [LOCATION_TYPES.TownHamlet]: Object.freeze(['%t']),
  [LOCATION_TYPES.TownVillage]: Object.freeze(['%t']),
  [LOCATION_TYPES.HomeFarms]: Object.freeze(['The %s Farmstead', "Old %f's Farm", '%s Orchard', '%s Grange']),
  [LOCATION_TYPES.ReligionTemple]: Object.freeze(['%e %n of %g']),
  [LOCATION_TYPES.Tavern]: Object.freeze(['%v']),
  [LOCATION_TYPES.HomeWealthy]: Object.freeze(['%s Manor', '%s Hall', '%s Court']),
  [LOCATION_TYPES.ReligionCult]: Object.freeze(['Shrine of %f', 'Altar of %f', 'Reliquary of %f', '%f Lodge', '%f Haven', 'Shelter of %f']),
  [LOCATION_TYPES.HomePoor]: Object.freeze(['The Old %s Place', "Old %f's Place", "Old %f's Hovel", "Old %f's Shack", 'The Old %s Hovel', 'The %s Cabin']),
});

const draw = (list) => list[rand() % list.length];
const gender = () => (rand() & 1 ? GENDERS.Female : GENDERS.Male);
/** The bank's surname-like stem - a Nord's without the 'sen' (a place, not a son), a Redguard's (no surnames) a first name. */
function stem(bank) {
  const s = surname(bank);
  if (!s) return firstName(bank, gender());
  return bank === BANK_TYPES.Nord && s.endsWith('sen') && s.length > 3 ? s.slice(0, -3) : s;
}

/**
 * A COUNTRY PLACE'S NAME: its kind's frame round the province's stems, drawn on DFRandom off `seed` - the stream's state
 * put back after. The empty string for a kind with no frame. AUDIT TESA II P10: on the GAME'S OWN banks and tavern words
 * (characters/nameHelper.js withGameNameBanks, systems/textManager.js withBaseText) - a place's name is the world's, the
 * same on every client whatever NameGen.txt or language a translation installed (TESA12: the places are every client's,
 * and named on the wire).
 * @param {number} type @param {number} bank the province's name bank (characters/nameHelper.js BANK_TYPES) @param {number} seed
 */
export function countryName(type, bank, seed) {
  const frames = COUNTRY_NAME_FRAMES[type];
  if (!frames) return '';
  const saved = getSeed();
  try {
    srand(seed >>> 0);
    return withBaseText(() => withGameNameBanks(() => draw(frames).replace(/%[sftvecng]/g, (m) => {
      switch (m) {
        case '%s': return stem(bank);
        case '%t': return stem(bank);
        case '%f': return firstName(bank, gender());
        case '%v': return `${draw(tavernsA())} ${draw(tavernsB())} ${draw(TAVERN_KINDS)}`;
        case '%e': return draw(TEMPLE_EPITHETS);
        case '%n': return draw(TEMPLE_NOUNS);
        default: return draw(TEMPLE_GODS);
      }
    })));
  } finally {
    setSeed(saved);
  }
}
/** WOULD A PLACE ON (px, py) STAND ON DRY GROUND - the spawns' law (world/spawnedDungeons.js SPAWN-SHORE: the plateau's
 *  noiseless floor above the beach band, so no farm stands on a square of sand in the sea), kept per pixel under the pixel's
 *  own key (the spawns' cache keys a Bay pixel, y * 1000 + x, which past the Bay two pixels share). TESA13: read through
 *  plateauDry - the same answer, the sum stopped once it is known - as the held map asks it of every candidate in view. */
export function createCountryGround(woods) {
  const dry = new Map();
  let fit = null, land = -1;
  return (px, py) => {
    // AUDIT-TESA A7-1: the ground past the Bay is the trace's and the fit's - when either moves, read afresh
    if (fit !== tamrielFit() || land !== tamrielLandVersion()) { dry.clear(); fit = tamrielFit(); land = tamrielLandVersion(); }
    const key = `${px},${py}`;
    let d = dry.get(key);
    if (d === undefined) dry.set(key, d = plateauDry(woods, px, py));
    return d;
  };
}
/** A pixel's name seed. */
export const countryNameSeed = (px, py) => hash32(COUNTRY_SALT, px, py, 3);

/**
 * A COUNTRY PLACE'S LOCATION: the template cloned onto its pixel - its id (the map row's, the exterior's location and map
 * ids, its record's header), the pixel's longitude and latitude, its name, the region the pixel answers for (`where`: the
 * host's), its own location index, no harbour, and `country` (its pixel, its kind and its template's map id). Null off the
 * grid.
 * @param {any} template
 * @param {{ px: number, py: number, type: number, name: string }} place
 * @param {{ regionIndex?: number, regionName?: string, politic?: number, climate?: any }} [where]
 */
export function synthesizeCountryLocation(template, place, where = {}) {
  const n = countryOrdinal(place.px, place.py);
  if (n < 0) return null;
  const mapId = countryPlaceId(n);
  const ll = mapPixelToLongitudeLatitude(place.px, place.py);
  return {
    ...template,
    name: place.name,
    regionIndex: where.regionIndex ?? template.regionIndex,
    regionName: where.regionName ?? template.regionName,
    politic: where.politic ?? template.politic,
    climate: where.climate ?? template.climate,
    locationIndex: countryLocationIndex(n),
    mapTableData: { ...template.mapTableData, mapId, longitude: ll.x, latitude: ll.y },
    exterior: {
      ...template.exterior,
      exteriorData: { ...template.exterior?.exteriorData, locationId: mapId, mapId, portTownAndUnknown: 0 },
      ...(template.exterior?.recordElement ? { recordElement: { ...template.exterior.recordElement, header: { ...template.exterior.recordElement.header, locationId: mapId } } } : {}),
    },
    country: Object.freeze({ px: place.px, py: place.py, type: place.type, template: idOf(template) }),
  };
}
