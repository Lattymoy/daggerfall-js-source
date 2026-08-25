// MAPS.BSA reader: enumerates the 62 regions and extracts location layouts.
// 1:1 translation of Daggerfall Unity's MapsFile.cs + DFRegion/DFLocation
// structures (MIT, Daggerfall Workshop / Gavin Clayton). Quirks kept verbatim:
//   - Region names, races, and temple faction ids are the FALL.EXE tables.
//   - Each region is four consecutive BSA records: MAPPITEM, MAPDITEM,
//     MAPTABLE, MAPNAMES.
//   - Map names are 32-byte strides; two locations fill all 32 bytes without
//     a terminator and the read overflows into the next record, so names are
//     truncated to 32 chars exactly as DFU does.
//   - Map table longitude/latitude/type/discovered come from bitfields;
//     LocationType uses uint wraparound ((4*bitfield) >> 27).
//   - RMB block-name letter2 uses (byte)(2*blockCharacter) >> 6 - the 8-bit
//     truncation is load-bearing.
//   - Orsinium (dungeon location id 50015) has a border block moved to Z=-2,
//     reverse engineered from classic.
// Not ported (documented): WorldDataReplacement mod hooks (Unity
// AssetInjection), smaller-dungeon generation and PatchRegionIndex (both
// depend on quest/save systems - they belong to the Systems arcs).
// GetNameBankOfRegion SHIPPED with the Characters arc (C2): it lives at
// characters/nameHelper.js getNameBankOfRegion over the REGION_RACES table
// exported from here, and scenes/townTalk.js calls it on every directory
// rebuild.

import { BsaFile, DIRECTORY_TYPES } from './bsaFile.js';
import { PakFile } from './pakFile.js';

// World metrics.
export const WORLD_MAP_TERRAIN_DIM = 32768;
export const WORLD_MAP_TILE_DIM = 128;
export const WORLD_MAP_RMB_DIM = 4096;
export const MAX_MAP_PIXEL_X = 1000;
export const MAX_MAP_PIXEL_Y = 500;

/** All region names (index = region index). */
export const REGION_NAMES = Object.freeze([
  "Alik'r Desert", 'Dragontail Mountains', 'Glenpoint Foothills', 'Daggerfall Bluffs',
  'Yeorth Burrowland', 'Dwynnen', 'Ravennian Forest', 'Devilrock',
  'Malekna Forest', 'Isle of Balfiera', 'Bantha', "Dak'fron",
  'Islands in the Western Iliac Bay', 'Tamarilyn Point', 'Lainlyn Cliffs', 'Bjoulsae River',
  'Wrothgarian Mountains', 'Daggerfall', 'Glenpoint', 'Betony', 'Sentinel', 'Anticlere', 'Lainlyn', 'Wayrest',
  'Gen Tem High Rock village', 'Gen Rai Hammerfell village', 'Orsinium Area', 'Skeffington Wood',
  'Hammerfell bay coast', 'Hammerfell sea coast', 'High Rock bay coast', 'High Rock sea coast',
  'Northmoor', 'Menevia', 'Alcaire', 'Koegria', 'Bhoriane', 'Kambria', 'Phrygias', 'Urvaius',
  'Ykalon', 'Daenia', 'Shalgora', 'Abibon-Gora', 'Kairou', 'Pothago', 'Myrkwasa', 'Ayasofya',
  'Tigonus', 'Kozanset', 'Satakalaam', 'Totambu', 'Mournoth', 'Ephesus', 'Santaki', 'Antiphyllos',
  'Bergama', 'Gavaudon', 'Tulune', 'Glenumbra Moors', 'Ilessan Hills', 'Cybiades',
]);

/** Region races from FALL.EXE (0 = Breton, 1 = Redguard). Used for townsfolk names. */
export const REGION_RACES = Object.freeze([
  1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1,
  0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0,
  0, 1,
]);

/** Region temple faction IDs from FALL.EXE. */
export const REGION_TEMPLES = Object.freeze([
  106, 82, 0, 0, 0, 98, 0, 0, 0, 92,
  0, 106, 0, 0, 0, 84, 36, 36, 84, 88,
  82, 88, 98, 92, 0, 0, 82, 0, 0, 0,
  0, 0, 88, 94, 36, 94, 106, 84, 106, 106,
  88, 98, 82, 98, 84, 94, 36, 88, 94, 36,
  98, 84, 106, 88, 106, 88, 92, 84, 98, 88,
  82, 94,
]);

/** Block file prefixes indexed by blockIndex. */
export const RMB_BLOCK_PREFIXES = Object.freeze([
  'TVRN', 'GENR', 'RESI', 'WEAP', 'ARMR', 'ALCH', 'BANK', 'BOOK',
  'CLOT', 'FURN', 'GEMS', 'LIBR', 'PAWN', 'TEMP', 'TEMP', 'PALA',
  'FARM', 'DUNG', 'CAST', 'MANR', 'SHRI', 'RUIN', 'SHCK', 'GRVE',
  'FILL', 'KRAV', 'KDRA', 'KOWL', 'KMOO', 'KCAN', 'KFLA', 'KHOR',
  'KROS', 'KWHE', 'KSCA', 'KHAW', 'MAGE', 'THIE', 'DARK', 'FIGH',
  'CUST', 'WALL', 'MARK', 'SHIP', 'WITC',
]);

/** Letters forming the second part of an RMB block name. */
const LETTER2_ARRAY = ['A', 'L', 'M', 'S'];

/** RDB block letters indexed by blockIndex. */
const RDB_BLOCK_LETTERS = ['N', 'W', 'L', 'S', 'B', 'M'];

export const LOCATION_TYPES = Object.freeze({
  TownCity: 0, TownHamlet: 1, TownVillage: 2, HomeFarms: 3,
  DungeonLabyrinth: 4, ReligionTemple: 5, Tavern: 6, DungeonKeep: 7,
  HomeWealthy: 8, ReligionCult: 9, DungeonRuin: 10, HomePoor: 11,
  Graveyard: 12, Coven: 13, HomeYourShips: 14, None: 0xffff,
});

/** PlayerGPS.IsPlayerInTown's location-type set (PlayerGPS.cs:507-513)
 *  - SEVEN types, not the three the port's one caller checked. The
 *  three it had (City/Hamlet/Village) are the ones with streets; the
 *  four it dropped are the small settlements and the standalone
 *  tavern/temple, and every rule that keys on "in town" - S40's
 *  camping crime, the quest system's own IsPlayerInTown - applied to
 *  none of them. */
export const TOWN_LOCATION_TYPES = Object.freeze([
  LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage,
  LOCATION_TYPES.HomeFarms, LOCATION_TYPES.HomeWealthy,
  LOCATION_TYPES.Tavern, LOCATION_TYPES.ReligionTemple,
]);
export const isTownLocationType = (t) => TOWN_LOCATION_TYPES.includes(t);

export const DUNGEON_TYPES = Object.freeze({
  Crypt: 0, OrcStronghold: 1, HumanStronghold: 2, Prison: 3,
  DesecratedTemple: 4, Mine: 5, NaturalCave: 6, Coven: 7,
  VampireHaunt: 8, Laboratory: 9, HarpyNest: 10, RuinedCastle: 11,
  SpiderNest: 12, GiantStronghold: 13, DragonsDen: 14,
  BarbarianStronghold: 15, VolcanicCaves: 16, ScorpionNest: 17,
  Cemetery: 18, NoDungeon: 255,
});

export const CLIMATES = Object.freeze({
  Ocean: 223,
  Desert: 224,
  Desert2: 225, // seen in Dak'fron
  Mountain: 226,
  Rainforest: 227,
  Swamp: 228,
  Subtropical: 229,
  MountainWoods: 230,
  Woodlands: 231,
  HauntedWoodlands: 232, // not sure where this is?
});

export const CLIMATE_BASE_TYPES = Object.freeze({
  None: -1, Desert: 0, Mountain: 100, Temperate: 300, Swamp: 400,
});

// ClimateTextureSet nature archives.
const NATURE = Object.freeze({
  RainForest: 500, SubTropical: 501, Swamp: 502, Desert: 503,
  TemperateWoodland: 504, WoodlandHills: 506, HauntedWoodlands: 508,
  Mountains: 510,
});

// FactionFile.FactionRaces values used by climate settings.
export const FACTION_RACES = Object.freeze({
  None: -1, Nord: 0, Khajiit: 1, Redguard: 2, Breton: 3,
});

export const DEFAULT_CLIMATE = 231;

// --- Static coordinate helpers ---

/** Longitude/latitude to map pixel. The world is 1000x500 map pixels. */
export function longitudeLatitudeToMapPixel(longitude, latitude) {
  return { x: Math.trunc(longitude / 128), y: 499 - Math.trunc(latitude / 128) };
}

/** Map pixel to longitude/latitude. */
export function mapPixelToLongitudeLatitude(mapPixelX, mapPixelY) {
  return { x: mapPixelX * 128, y: (499 - mapPixelY) * 128 };
}

/** ID of map pixel; maps to location and quest IDs (mapId & 0xfffff). */
export function getMapPixelID(mapPixelX, mapPixelY) {
  return mapPixelY * 1000 + mapPixelX;
}

export function getPixelFromPixelID(pixelID) {
  const x = pixelID % 1000;
  return { x, y: (pixelID - x) / 1000 };
}

/** Map pixel to world coordinate in native Daggerfall units. */
export function mapPixelToWorldCoord(mapPixelX, mapPixelY) {
  return { x: mapPixelX * 32768, y: (499 - mapPixelY) * 32768 };
}

/** World coordinate to nearest map pixel. */
export function worldCoordToMapPixel(worldX, worldZ) {
  return { x: Math.trunc(worldX / 32768), y: 499 - Math.trunc(worldZ / 32768) };
}

/**
 * Settings for the specified map climate (valid CLIMATE.PAK range 223-232).
 * Verbatim GetWorldClimateSettings.
 */
export function getWorldClimateSettings(worldClimate) {
  const s = { worldClimate };
  switch (worldClimate) {
    case CLIMATES.Ocean:
      s.climateType = CLIMATE_BASE_TYPES.Swamp;
      s.groundArchive = 402;
      s.natureArchive = NATURE.TemperateWoodland;
      s.skyBase = 24;
      s.people = FACTION_RACES.Breton;
      break;
    case CLIMATES.Desert:
    case CLIMATES.Desert2:
      s.climateType = CLIMATE_BASE_TYPES.Desert;
      s.groundArchive = 2;
      s.natureArchive = NATURE.Desert;
      s.skyBase = 8;
      s.people = FACTION_RACES.Redguard;
      break;
    case CLIMATES.Mountain:
      s.climateType = CLIMATE_BASE_TYPES.Mountain;
      s.groundArchive = 102;
      s.natureArchive = NATURE.Mountains;
      s.skyBase = 0;
      s.people = FACTION_RACES.Nord;
      break;
    case CLIMATES.Rainforest:
      s.climateType = CLIMATE_BASE_TYPES.Swamp;
      s.groundArchive = 402;
      s.natureArchive = NATURE.RainForest;
      s.skyBase = 24;
      s.people = FACTION_RACES.Redguard;
      break;
    case CLIMATES.Swamp:
      s.climateType = CLIMATE_BASE_TYPES.Swamp;
      s.groundArchive = 402;
      s.natureArchive = NATURE.Swamp;
      s.skyBase = 24;
      s.people = FACTION_RACES.Breton;
      break;
    case CLIMATES.Subtropical:
      s.climateType = CLIMATE_BASE_TYPES.Desert;
      s.groundArchive = 2;
      s.natureArchive = NATURE.SubTropical;
      s.skyBase = 24;
      s.people = FACTION_RACES.Breton;
      break;
    case CLIMATES.MountainWoods:
      s.climateType = CLIMATE_BASE_TYPES.Temperate;
      s.groundArchive = 102;
      s.natureArchive = NATURE.WoodlandHills;
      s.skyBase = 16;
      s.people = FACTION_RACES.Breton;
      break;
    case CLIMATES.Woodlands:
      s.climateType = CLIMATE_BASE_TYPES.Temperate;
      s.groundArchive = 302;
      s.natureArchive = NATURE.TemperateWoodland;
      s.skyBase = 16;
      s.people = FACTION_RACES.Breton;
      break;
    case CLIMATES.HauntedWoodlands:
      s.climateType = CLIMATE_BASE_TYPES.Temperate;
      s.groundArchive = 302;
      s.natureArchive = NATURE.HauntedWoodlands;
      s.skyBase = 16;
      s.people = FACTION_RACES.Breton;
      break;
    default:
      s.climateType = CLIMATE_BASE_TYPES.Temperate;
      s.groundArchive = 302;
      s.natureArchive = NATURE.TemperateWoodland;
      s.skyBase = 16;
      s.people = FACTION_RACES.Breton;
      break;
  }
  s.natureSet = s.natureArchive;
  return s;
}

export class MapsFile {
  constructor() {
    this._bsa = null;
    this._regions = null;
    this.autoDiscard = true;
    this._lastRegion = -1;
    this.climatePak = new PakFile();
    this.politicPak = new PakFile();
    this._isReady = false;
  }

  static get filename() {
    return 'MAPS.BSA';
  }

  /** Number of regions (four BSA records per region). */
  get regionCount() {
    return this._bsa ? Math.trunc(this._bsa.count / 4) : 0;
  }

  get ready() {
    return this._isReady;
  }

  /**
   * Load MAPS.BSA plus CLIMATE.PAK and POLITIC.PAK contents.
   * @param {Uint8Array} mapsBytes
   * @param {Uint8Array} climateBytes
   * @param {Uint8Array} politicBytes
   * @returns {boolean} true if successful.
   */
  load(mapsBytes, climateBytes, politicBytes) {
    this._isReady = false;
    this.climatePak.load(climateBytes);
    this.politicPak.load(politicBytes);

    this._bsa = new BsaFile(mapsBytes);
    if (this._bsa.directoryType !== DIRECTORY_TYPES.NameRecord) return false;
    this._regions = new Array(this.regionCount).fill(null);
    this._isReady = true;
    return true;
  }

  /** Name of specified region ('' if out of range). */
  getRegionName(region) {
    if (region < 0 || region >= this.regionCount) return '';
    return REGION_NAMES[region];
  }

  /** Index of region with specified name, or -1. */
  getRegionIndex(name) {
    for (let i = 0; i < this.regionCount; i++) {
      if (REGION_NAMES[i] === name) return i;
    }
    return -1;
  }

  /** Load a region into memory and decompose it for use. */
  loadRegion(region) {
    if (region < 0 || region >= this.regionCount) return false;
    if (this._regions[region] !== null) return true;

    if (this.autoDiscard && this._lastRegion !== -1) this.discardRegion(this._lastRegion);

    // Four consecutive records per region.
    const record = region * 4;
    const rec = {
      name: REGION_NAMES[region],
      mapPItem: this._bsa.getRecordBytes(record),
      mapDItem: this._bsa.getRecordBytes(record + 1),
      mapTable: this._bsa.getRecordBytes(record + 2),
      mapNames: this._bsa.getRecordBytes(record + 3),
      dfRegion: null,
    };
    if (
      rec.mapNames.length === 0 || rec.mapTable.length === 0 ||
      rec.mapPItem.length === 0 || rec.mapDItem.length === 0
    ) {
      return false;
    }
    this._regions[region] = rec;

    if (!this._readRegion(region)) {
      this.discardRegion(region);
      return false;
    }

    this._lastRegion = region;
    return true;
  }

  /** Discard a region from memory. */
  discardRegion(region) {
    if (region < 0 || region >= this.regionCount) return;
    this._regions[region] = null;
  }

  /** Discard all regions. */
  discardAllRegions() {
    for (let index = 0; index < this.regionCount; index++) this.discardRegion(index);
  }

  /** DFRegion by index (null on failure). */
  getRegion(region) {
    if (!this.loadRegion(region)) return null;
    return this._regions[region].dfRegion;
  }

  /** DFRegion by name (null on failure). */
  getRegionByName(name) {
    const region = this.getRegionIndex(name);
    if (region === -1) return null;
    return this.getRegion(region);
  }

  /** DFLocation for region/location indices (null on failure). */
  getLocation(region, location) {
    if (!this.loadRegion(region)) return null;

    const dfLocation = this._readLocation(region, location);
    if (!dfLocation) return null;

    dfLocation.regionIndex = region;
    dfLocation.locationIndex = location;
    return dfLocation;
  }

  /** DFLocation by region and location names (null on failure). */
  getLocationByName(regionName, locationName) {
    const region = this.getRegionIndex(regionName);
    if (!this.loadRegion(region)) return null;
    const dfRegion = this._regions[region].dfRegion;
    if (!dfRegion.mapNameLookup.has(locationName)) return null;
    return this.getLocation(region, dfRegion.mapNameLookup.get(locationName));
  }

  /** Block name for exterior block at x,y. */
  getRmbBlockName(dfLocation, x, y) {
    const index = y * dfLocation.exterior.exteriorData.width + x;
    return dfLocation.exterior.exteriorData.blockNames[index];
  }

  /**
   * Resolve block name from raw components. The (byte)(2*blockCharacter)>>6
   * truncation is verbatim.
   */
  resolveRmbBlockName(dfLocation, blockIndex, blockNumber, blockCharacter) {
    const prefix = RMB_BLOCK_PREFIXES[blockIndex];

    // Letter 1.
    let letter1;
    if ((blockCharacter & 0x10) !== 0) {
      letter1 = String.fromCharCode(dfLocation.exterior.exteriorData.letter1ForRMBName);
    } else {
      letter1 = 'A';
    }

    // Letter 2.
    const letter2 = LETTER2_ARRAY[((2 * blockCharacter) & 0xff) >> 6];

    // Block number.
    let numbers;
    if (blockIndex === 13 || blockIndex === 14) {
      // Temple numbers.
      numbers = String.fromCharCode((blockCharacter & 0xf) + 65) + String(blockNumber);
    } else {
      // Numbers are uniform in non-temple blocks.
      numbers = String(blockNumber).padStart(2, '0');
    }

    return prefix + letter1 + letter2 + numbers + '.RMB';
  }

  /** Climate index from CLIMATE.PAK (+1 X to line up with height map). */
  getClimateIndex(mapPixelX, mapPixelY) {
    return this.climatePak.getValue(mapPixelX + 1, mapPixelY);
  }

  /** Politic index from POLITIC.PAK (+1 X to line up with height map). */
  getPoliticIndex(mapPixelX, mapPixelY) {
    return this.politicPak.getValue(mapPixelX + 1, mapPixelY);
  }

  /** PlayerGPS.CurrentRegionIndex (PlayerGPS.cs:165-186) over this
   *  pixel's politic index. AUDIT 24 (the seven-slice sweep): the
   *  region the player is IN is a property of the POLITIC map, which
   *  is defined on every pixel of the world - not of whether that
   *  pixel happens to carry a location. The port had been reading
   *  `currentLocation().regionIndex`, which is -1 across the whole
   *  wilderness, and getNameBankOfRegion(-1) is Breton - so every
   *  quest humanoid named outdoors came out Breton regardless of
   *  province. Where a location DOES exist the two agree
   *  (politic === regionIndex + 128, this file's own law).
   *
   *  NAMED -At, not getRegionIndex: this class already has a
   *  getRegionIndex(NAME) (:297), and AUDIT 24 shipped this one under
   *  that name for a day. A JS class body keeps the LAST definition,
   *  so the by-name lookup vanished and getRegionByName /
   *  getLocationByName started handing a region NAME in as a map pixel
   *  x. The suite stayed green because nothing covered either - the
   *  collision was found by the audit's own bug hunt, not by a test,
   *  and the pin below closes that hole too. */
  getRegionIndexAt(mapPixelX, mapPixelY) {
    const politicIndex = this.getPoliticIndex(mapPixelX, mapPixelY);
    // High Rock sea coast is the one politic value below the +128 band
    let result = politicIndex === 64 ? 31 : politicIndex - 128;
    if (result === 105) result = 16;   // known bad value -> Wrothgarian Mountains
    if (result < 0 || result >= 62) result = 0;   // clamp out of range
    return result;
  }

  /** LocationId with minimal overhead. Region must be loaded. */
  readLocationIdFast(region, location) {
    const rec = this._regions[region];
    const v = new DataView(rec.mapPItem.buffer, rec.mapPItem.byteOffset, rec.mapPItem.byteLength);
    const locationCount = this._readLocationCount(region);
    let pos = v.getUint32(location * 4, true) + locationCount * 4;
    const doorCount = v.getUint32(pos, true);
    pos += 4 + doorCount * 6;
    pos += 33; // Skip to LocationId.
    return v.getUint16(pos, true);
  }

  // --- Readers ---

  _readRegion(region) {
    try {
      const rec = this._regions[region];
      rec.dfRegion = {
        name: REGION_NAMES[region],
        locationCount: 0,
        mapNames: null,
        mapTable: null,
        mapNameLookup: new Map(),
        mapIdLookup: new Map(),
      };
      this._readMapNames(region);
      this._readMapTable(region);
    } catch (e) {
      return false;
    }
    return true;
  }

  _readCStringSkip(bytes, r, stride) {
    // Reads to null terminator (unbounded, as DFU's ReadCStringSkip), then
    // advances exactly stride bytes.
    let end = r.pos;
    while (end < bytes.byteLength && bytes[end] !== 0) end++;
    let s = '';
    for (let i = r.pos; i < end; i++) s += String.fromCharCode(bytes[i]);
    r.pos += stride;
    return s;
  }

  _readMapNames(region) {
    const rec = this._regions[region];
    const bytes = rec.mapNames;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dfRegion = rec.dfRegion;

    dfRegion.locationCount = v.getUint32(0, true);
    dfRegion.mapNames = new Array(dfRegion.locationCount);

    const r = { pos: 4 };
    for (let i = 0; i < dfRegion.locationCount; i++) {
      let mapName = this._readCStringSkip(bytes, r, 32);
      // Two locations fill all 32 bytes with no terminator ("The Unfortunate
      // Porcupine Hostel" in Bhoriane, "The Feather and Barbarian Tavern" in
      // Kambria); cap at 32 chars to prevent overflow into the next record.
      if (mapName.length > 32) mapName = mapName.slice(0, 32);
      dfRegion.mapNames[i] = mapName;
      if (!dfRegion.mapNameLookup.has(mapName)) dfRegion.mapNameLookup.set(mapName, i);
    }
  }

  _readMapTable(region) {
    const rec = this._regions[region];
    const bytes = rec.mapTable;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dfRegion = rec.dfRegion;

    dfRegion.mapTable = new Array(dfRegion.locationCount);
    let pos = 0;
    for (let i = 0; i < dfRegion.locationCount; i++) {
      const mapId = v.getInt32(pos, true);
      const bitfield = v.getUint32(pos + 4, true);
      const entry = {
        mapId,
        longitude: (bitfield & 0x1ffffff) >>> 8,
        // uint wraparound: (4 * bitfield) >> 27 in C# uint arithmetic.
        locationType: (bitfield << 2) >>> 27,
        discovered: ((bitfield >>> 24) & 0x40) !== 0,
        latitude: (v.getInt32(pos + 8, true) & 0xffffff) >>> 8,
        dungeonType: bytes[pos + 12],
        key: v.getUint32(pos + 13, true),
        locationId: 0,
      };
      pos += 17;
      dfRegion.mapTable[i] = entry;
      if (!dfRegion.mapIdLookup.has(entry.mapId)) dfRegion.mapIdLookup.set(entry.mapId, i);
    }
  }

  _readLocationCount(region) {
    const bytes = this._regions[region].mapNames;
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  }

  _readLocation(region, location) {
    try {
      const rec = this._regions[region];
      const dfLocation = {
        loaded: false,
        // Non-localized region name key, exactly as found in MAPS.BSA.
        regionName: REGION_NAMES[region],
        name: '',
        regionIndex: 0,
        locationIndex: 0,
        hasDungeon: false,
        politic: 0,
        climate: null,
        mapTableData: null,
        exterior: {
          recordElement: null,
          buildingCount: 0,
          unknown1: null,
          buildings: null,
          exteriorData: null,
        },
        dungeon: { recordElement: null, header: null, blocks: null },
      };

      this._readMapPItem(region, location, dfLocation);
      this._readMapDItem(region, dfLocation);

      dfLocation.mapTableData = rec.dfRegion.mapTable[location];
      this._readClimatePoliticData(dfLocation);

      dfLocation.loaded = true;
      return dfLocation;
    } catch (e) {
      return null;
    }
  }

  /** Politic should always equal region index + 128. */
  _readClimatePoliticData(dfLocation) {
    const pos = longitudeLatitudeToMapPixel(
      dfLocation.mapTableData.longitude,
      dfLocation.mapTableData.latitude
    );
    dfLocation.politic = this.politicPak.getValue(pos.x, pos.y);
    const worldClimate = this.climatePak.getValue(pos.x, pos.y);
    dfLocation.climate = getWorldClimateSettings(worldClimate);
  }

  _readMapPItem(region, location, dfLocation) {
    const rec = this._regions[region];
    const bytes = rec.mapPItem;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const locationCount = this._readLocationCount(region);

    // Position at location record: offset table entry + end of offset table.
    const r = { pos: v.getUint32(location * 4, true) + locationCount * 4 };

    dfLocation.name = rec.dfRegion.mapNames[location];

    dfLocation.exterior.recordElement = this._readLocationRecordElement(bytes, v, r);

    // BuildingListHeader.
    dfLocation.exterior.buildingCount = v.getUint16(r.pos, true);
    dfLocation.exterior.unknown1 = bytes.slice(r.pos + 2, r.pos + 7);
    r.pos += 7;

    // BuildingData (26 bytes each, same shape as the RMB FLD entries).
    const buildings = new Array(dfLocation.exterior.buildingCount);
    for (let b = 0; b < buildings.length; b++) {
      buildings[b] = {
        nameSeed: v.getUint16(r.pos, true),
        serviceTimeLimit: v.getUint32(r.pos + 2, true),
        unknown: v.getUint16(r.pos + 6, true),
        unknown2: v.getUint16(r.pos + 8, true),
        unknown3: v.getUint32(r.pos + 10, true),
        unknown4: v.getUint32(r.pos + 14, true),
        factionId: v.getUint16(r.pos + 18, true),
        sector: v.getInt16(r.pos + 20, true),
        locationId: v.getUint16(r.pos + 22, true),
        buildingType: bytes[r.pos + 24],
        quality: bytes[r.pos + 25],
      };
      r.pos += 26;
    }
    dfLocation.exterior.buildings = buildings;

    // ExteriorData.
    const ext = {};
    ext.anotherName = this._readCStringSkip(bytes, r, 32);
    ext.mapId = v.getInt32(r.pos, true);
    ext.locationId = v.getUint32(r.pos + 4, true);
    ext.width = bytes[r.pos + 8];
    ext.height = bytes[r.pos + 9];
    ext.unknown2 = bytes.slice(r.pos + 10, r.pos + 14);
    ext.letter1ForRMBName = bytes[r.pos + 14];
    ext.portTownAndUnknown = bytes[r.pos + 15];
    ext.unknown3 = bytes[r.pos + 16];
    r.pos += 17;
    ext.blockIndex = bytes.slice(r.pos, r.pos + 64);
    ext.blockNumber = bytes.slice(r.pos + 64, r.pos + 128);
    ext.blockCharacter = bytes.slice(r.pos + 128, r.pos + 192);
    r.pos += 192;
    ext.unknown4 = bytes.slice(r.pos, r.pos + 34);
    r.pos += 34 + 8 + 1; // unknown4 + nullValue1 (u64) + nullValue2 (byte)
    ext.unknown5 = new Array(22);
    for (let i = 0; i < 22; i++) {
      ext.unknown5[i] = v.getUint32(r.pos, true);
      r.pos += 4;
    }
    r.pos += 40; // nullValue3
    ext.unknown6 = v.getUint32(r.pos, true);
    r.pos += 4;
    dfLocation.exterior.exteriorData = ext;

    // Resolve block names.
    const totalBlocks = ext.width * ext.height;
    ext.blockNames = new Array(totalBlocks);
    for (let i = 0; i < totalBlocks; i++) {
      ext.blockNames[i] = this.resolveRmbBlockName(
        dfLocation,
        ext.blockIndex[i],
        ext.blockNumber[i],
        ext.blockCharacter[i]
      );
    }
  }

  /** LocationRecordElement common to MapPItem and MapDItem. */
  _readLocationRecordElement(bytes, v, r) {
    const doorCount = v.getUint32(r.pos, true);
    r.pos += 4;
    const doors = new Array(doorCount);
    for (let door = 0; door < doorCount; door++) {
      doors[door] = {
        buildingDataIndex: v.getUint16(r.pos, true),
        nullValue: bytes[r.pos + 2],
        mask: bytes[r.pos + 3],
        unknown1: bytes[r.pos + 4],
        unknown2: bytes[r.pos + 5],
      };
      r.pos += 6;
    }

    const header = {
      alwaysOne1: v.getUint32(r.pos, true),
      // nullValue1 u16, nullValue2 byte
      x: v.getInt32(r.pos + 7, true),
      // nullValue3 u32
      y: v.getInt32(r.pos + 15, true),
      isExterior: v.getUint16(r.pos + 19, true),
      // nullValue4 u16
      unknown1: v.getUint32(r.pos + 23, true),
      unknown2: v.getUint32(r.pos + 27, true),
      alwaysOne2: v.getUint16(r.pos + 31, true),
      locationId: v.getUint16(r.pos + 33, true),
      // nullValue5 u32
      isInterior: v.getUint16(r.pos + 39, true),
      exteriorLocationId: v.getUint32(r.pos + 41, true),
      // nullValue6 26 bytes
      locationName: '',
      // unknown3 9 bytes
    };
    r.pos += 45 + 26;
    header.locationName = this._readCStringSkip(bytes, r, 32);
    r.pos += 9;

    return { doorCount, doors, header };
  }

  _readMapDItem(region, dfLocation) {
    const rec = this._regions[region];
    const bytes = rec.mapDItem;
    dfLocation.hasDungeon = false;
    if (bytes.byteLength === 0) return;

    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Find dungeon offset matching this location id.
    const locationId = dfLocation.exterior.recordElement.header.locationId;
    const dungeonCount = v.getUint32(0, true);
    let pos = 4;
    let found = false;
    let offset = 0;
    for (let i = 0; i < dungeonCount; i++) {
      offset = v.getUint32(pos, true);
      const exteriorLocationId = v.getUint16(pos + 6, true);
      pos += 8;
      if (exteriorLocationId === locationId) {
        found = true;
        break;
      }
    }
    if (!found) return;

    // Position at dungeon record: end of offset table + offset.
    const r = { pos: 4 + dungeonCount * 8 + offset };

    dfLocation.dungeon.recordElement = this._readLocationRecordElement(bytes, v, r);

    // DungeonHeader.
    const header = {
      // nullValue1 u16
      unknown1: v.getUint32(r.pos + 2, true),
      unknown2: v.getUint32(r.pos + 6, true),
      blockCount: v.getUint16(r.pos + 10, true),
      unknown3: bytes.slice(r.pos + 12, r.pos + 17),
    };
    r.pos += 17;
    dfLocation.dungeon.header = header;

    // DungeonBlock elements.
    const blocks = new Array(header.blockCount);
    for (let i = 0; i < header.blockCount; i++) {
      const x = v.getInt8(r.pos);
      const z = v.getInt8(r.pos + 1);
      const bitfield = v.getUint16(r.pos + 2, true);
      r.pos += 4;
      const blockNumber = bitfield & 0x3ff;
      const isStartingBlock = (bitfield & 0x400) === 0x400;
      const blockIndex = bitfield >> 11;
      blocks[i] = {
        x,
        z,
        blockNumberStartIndexBitfield: bitfield,
        blockNumber,
        isStartingBlock,
        blockIndex,
        blockName: `${RDB_BLOCK_LETTERS[blockIndex]}${String(blockNumber).padStart(7, '0')}.RDB`,
      };
    }
    dfLocation.dungeon.blocks = blocks;

    // Orsinium hack: move a border block overlapping another one.
    // Reverse engineered from classic.
    if (dfLocation.dungeon.recordElement.header.locationId === 50015) {
      dfLocation.dungeon.blocks[13].z = -2;
    }

    dfLocation.hasDungeon = true;
  }
}
