// Dungeon texture tables: which wall/floor archives a dungeon draws.
// 1:1 translation of Daggerfall Unity's DungeonTextureTables.cs (MIT,
// Daggerfall Workshop), classic algorithm (RandomDungeonTextures mode 0,
// DFU's default for main-story dungeons and classic parity). Verbatim:
//   - Table slots remap base archives 119/120/122/123/124/168; archive 74
//     (exit doors) shifts by the climate base type; everything else passes
//     through.
//   - Seed is the dungeon's LocationId fed to the classic LCG (dfRandom).
//   - climateIndices is TravelTimeCalculator's terrain table; Ocean remaps
//     to Swamp before indexing.
//   - Classic bug note kept from DFU: rainforest (archive index 1) in
//     classic skipped the assignment loop entirely and inherited the last
//     dungeon's table; DFU (and we) assign anyway.
//   - Slot 5 is always a sewer archive: Interior_Sewer (68) + 100 * the
//     climate-based archive index.

import { srand, randomRangeInclusive } from '../formats/dfRandom.js';
import { getInt } from '../systems/settings.js';   // AUDIT 28 W3c: RandomDungeonTextures

export const TABLE_LENGTH = 6;

// Default dungeon texture table at linear offset 0x28617C.
export const DEFAULT_TEXTURE_TABLE = [119, 120, 122, 123, 124, 168];   // null-table fallback mirror - the port always computes a table (AUDIT 23 wa-7)

// TravelTimeCalculator.climateIndices, indexed by (climate - Ocean).
const CLIMATE_INDICES = [0, 0, 0, 1, 2, 3, 4, 5, 5, 5];

const CLIMATE_OCEAN = 223;
const CLIMATE_DESERT = 224;
const CLIMATE_SWAMP = 228;
const INTERIOR_SEWER = 68; // DFLocation.ClimateTextureSet.Interior_Sewer

/**
 * Classic per-dungeon texture table.
 * @param {number} seed - the dungeon's LocationId.
 * @param {number} worldClimate - raw climate value (223..232) of the
 *   location (DFU reads this from PlayerGPS.CurrentClimateIndex).
 * @param {number} randomDungeonTextures - DFU settings mode (0 classic,
 *   1 climate-based); default 0.
 * @returns {number[]} six-archive table.
 */
export function randomTextureTableClassic(seed, worldClimate, randomDungeonTextures = 0) {
  const climateTextureArchiveIndices = [0, 0, 1, 4, 4, 0, 3, 3, 3, 0];
  const climateTextureArchives = randomDungeonTextures === 0
    ? [19, 119, 319, 419, 119] // Values from classic, used in classic algorithm
    : [19, 119, 119, 319, 419]; // Climate-based; index 2 (unused) is a dummy

  let climate = worldClimate;
  if (climate === CLIMATE_OCEAN) climate = CLIMATE_SWAMP;

  const classicIndexValue = CLIMATE_INDICES[climate - CLIMATE_OCEAN];
  const climateBasedIndexValue = climate - CLIMATE_DESERT;

  const climateTextureArchiveIndex = randomDungeonTextures === 0
    ? climateTextureArchiveIndices[classicIndexValue]
    : climateTextureArchiveIndices[climateBasedIndexValue];

  srand(seed);
  const textureTable = new Array(TABLE_LENGTH);
  for (let i = 0; i < 5; i++) {
    let textureArchiveOffset = randomRangeInclusive(0, 4);
    if (textureArchiveOffset === 2) textureArchiveOffset = 4; // invalid
    textureTable[i] = climateTextureArchives[climateTextureArchiveIndex] + textureArchiveOffset;
  }
  textureTable[5] = INTERIOR_SEWER + 100 * climateTextureArchiveIndices[climateBasedIndexValue];
  return textureTable;
}

/**
 * Applies the dungeon texture table to a texture archive index, verbatim.
 * @param {number} archive - base texture archive index.
 * @param {number[]} textureTable - six-archive table.
 * @param {number} climateBaseType - DFLocation.ClimateBaseType value
 *   (Desert 0, Mountain 100, Temperate 300, Swamp 400).
 * @returns {number} remapped archive.
 */
export function applyTextureTable(archive, textureTable, climateBaseType) {
  switch (archive) {
    case 74: return archive + climateBaseType;
    case 119: return textureTable[0];
    case 120: return textureTable[1];
    case 122: return textureTable[2];
    case 123: return textureTable[3];
    case 124: return textureTable[4];
    case 168: return textureTable[5];
    default: return archive;
  }
}

/** DaggerfallDungeon.IsMainStoryDungeon (:146-172), the fourteen ids,
 *  keyed on Summary.ID = MapTableData.MapId (raw, :104). */
export const MAIN_STORY_DUNGEON_IDS = Object.freeze(new Set([
  187853213,    // Daggerfall/Privateer's Hold
  630439035,    // Wayrest/Wayrest
  1291010263,   // Daggerfall/Daggerfall
  6634853,      // Sentinel/Sentinel
  19021260,     // Orsinium Area/Orsinium
  728811286,    // Wrothgarian Mountains/Shedungent
  701948302,    // Dragontail Mountains/Scourg Barrow
  83032363,     // Wayrest/Woodborne Hall
  1001,         // High Rock sea coast/Mantellan Crux
  207828842,    // Menevia/Lysandus' Tomb
  9570447,      // Daggerfall/Castle Necromoghan
  2352284,      // Betony/Tristore Laboratory
  336619236,    // Ykalon/Castle Llugwych
  43196334,     // Isle of Balfiera/Direnni Tower
]));
export const isMainStoryDungeon = (mapId) => MAIN_STORY_DUNGEON_IDS.has(mapId);

/** RandomTextureTableAlternate's pool: every climate's six archives. */
export const ALTERNATE_VALID_ARCHIVES = Object.freeze([
  19, 20, 22, 23, 24, 68,
  119, 120, 122, 123, 124, 168,
  319, 320, 322, 323, 324, 368,
  419, 420, 422, 423, 424, 468,
]);
export const VALID_SEWER_ARCHIVES = Object.freeze([68, 168, 368, 468]);

/** AUDIT 28 W3c: the deterministic stand-in for Unity's seeded stream
 *  (Random.InitState(Summary.ID)) - the same xorshift32 shape the
 *  dungeon-enemies slot reroll uses, Range semantics max EXCLUSIVE.
 *  Ledger A: the SEQUENCE differs from Unity's Xorshift128, the
 *  determinism per dungeon does not. */
export function makeSeededRng(seed) {
  let s = (seed >>> 0) || 1;
  return (min, maxExclusive) => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return min + (s % (maxExclusive - min));
  };
}

/**
 * RandomTextureTableAlternate (DungeonTextureTables.cs:44-63) - "the
 * method used in earlier DF Unity builds": six draws from the whole
 * pool, then slot 5 forced onto a sewer archive unless it already is
 * one (`% 100 != 68`).
 * @param {number} seed - Summary.ID, the raw MapId.
 */
export function randomTextureTableAlternate(seed, rng = makeSeededRng(seed)) {
  const textureTable = new Array(TABLE_LENGTH);
  for (let i = 0; i < TABLE_LENGTH; i++) {
    textureTable[i] = ALTERNATE_VALID_ARCHIVES[rng(0, ALTERNATE_VALID_ARCHIVES.length)];
  }
  if ((textureTable[5] % 100) !== 68) {
    textureTable[5] = VALID_SEWER_ARCHIVES[rng(0, VALID_SEWER_ARCHIVES.length)];
  }
  return textureTable;
}

/**
 * UseLocationDungeonTextureTable's fork (DaggerfallDungeon.cs:174-196),
 * the whole law behind Settings.RandomDungeonTextures:
 *   0 : classic (swamp and woodland sets unused)
 *   1 : by climate + classic for main story dungeons
 *   2 : by climate for all dungeons
 *   3 : randomized + classic for main story dungeons
 *   4 : randomized for all dungeons
 * A main-story dungeon takes the PLAIN classic table (mode argument 0)
 * unless the mode is 2 or 4.
 */
export function dungeonTextureTable({ locationId, mapId, worldClimate,
  mode = getInt('Video', 'RandomDungeonTextures', 0, 4) } = {}) {
  if (isMainStoryDungeon(mapId) && mode !== 2 && mode !== 4) {
    return randomTextureTableClassic(locationId, worldClimate);
  }
  if (mode < 3) return randomTextureTableClassic(locationId, worldClimate, mode);
  return randomTextureTableAlternate(mapId);
}
