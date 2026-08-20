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
