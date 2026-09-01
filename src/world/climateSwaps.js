// Climate texture swapping: remap texture archives to a location's
// climate and season. 1:1 translation of Daggerfall Unity's
// ClimateSwaps.cs (MIT, Daggerfall Workshop). Verbatim:
//   - applyClimate: door-frame tapestry (archive % 100 == 74, record 3)
//     never swaps; swamp keeps marble floors; deserts have no winter;
//     swamp mages guilds and castle records > 3 have no winter (C#
//     precedence preserved: the castle clause applies in EVERY
//     climate); archive 82 records > 1 and all of 77 have no winter;
//     archives {75, 76, 77, 79, 80, 82, 83} suppress the climate
//     rebase; otherwise archives < 500 rebase to
//     climateBase + (archive % 100) + weather (Winter 1 / Rain 2 when
//     supported), and 500+ keep their archive with the winter bump.
//   - getClimateTextureInfo classifies by archive % 100 (or the archive
//     itself for the 500+ nature sets) into the verbatim
//     exterior/interior/nature tables with winter/rain support flags.
//   - isExteriorWindow is the verbatim per-archive/record window table
//     (consumed later by the window-emission queue item).
//   - getNatureArchive bumps the four wintering woodland sets by 1;
//     getGroundArchive maps climate base -> {2, 102, 302, 402} with
//     Winter +1 / Rain +2.
// EQUIVALENCE (documented, not a departure): DFU routes through the
// Unity-side ClimateBases enum and FromUnityClimateBase; we take the
// API ClimateBaseType values (Desert 0 / Mountain 100 / Temperate 300 /
// Swamp 400) directly - the exact integers DFU's conversion produces.

import { SEASONS, seasonValue, dateFromClassicMinutes } from '../systems/gameDate.js';

export const SEASON = { Summer: 0, Winter: 1, Rain: 2 };

/** THE TEXTURE SEASON IS THE CALENDAR'S (A1). ClimateSeason has three
 *  members and the world clock only ever selects TWO of them: every
 *  production site in the reference writes the same one-line test -
 *  ClimateSwaps.cs:382-386 (the GetNatureArchive overload that takes a
 *  DaggerfallDateTime.Seasons), DaggerfallLocation.ApplyTimeAndSpace
 *  (:135-139), StreamingWorld.cs:812, RuntimeMaterials.cs:169,
 *  DaggerfallBankPurchasePopUp.cs:265. ClimateSeason.Rain is reachable
 *  only by hand (ApplyClimate's `supportsRain` arm and GetGroundArchive
 *  +2 stay ported for it), so it stays a debug choice here too.
 *
 *  DaggerfallLocation.Update (:118-130) re-reads this every frame and
 *  re-skins the standing location when `lastSeason` differs - the
 *  season is LIVE, not a value read once at load. */
export function climateSeasonFromDate(date) {
  return seasonValue(date) === SEASONS.Winter ? SEASON.Winter : SEASON.Summer;
}

/** The same law off the port's one clock (worldTick's classic minute
 *  count) - what DaggerfallUnity.WorldTime.Now.SeasonValue reads. */
export function climateSeasonFromMinutes(classicMinutes) {
  return climateSeasonFromDate(dateFromClassicMinutes(classicMinutes));
}

/** DaggerfallInterior.cs:51 - `ClimateSeason climateSeason =
 *  ClimateSeason.Summer;`, a field the class declares and NEVER
 *  assigns. An interior is summer-skinned in the reference in the
 *  depths of Evening Star, so the season a door carries inside is a
 *  constant, not the weather outside. */
export const INTERIOR_SEASON = SEASON.Summer;
const WEATHER_WINTER = 1; // DFLocation.ClimateWeather.Winter
const WEATHER_RAIN = 2; // DFLocation.ClimateWeather.Rain

const BASE = { Desert: 0, Mountain: 100, Temperate: 300, Swamp: 400 };

// DFLocation.ClimateTextureSet values used by the classifier.
const SET = {
  None: -1,
  Exterior_Terrain: 2,
  Exterior_Ruins: 7,
  Exterior_Castle: 9,
  Exterior_CityA: 12,
  Exterior_CityB: 14,
  Exterior_CityWalls: 17,
  Exterior_Farm: 26,
  Exterior_Fences: 29,
  Exterior_MagesGuild: 35,
  Exterior_Manor: 38,
  Exterior_MerchantHomes: 42,
  Exterior_TavernExteriors: 58,
  Exterior_TempleExteriors: 61,
  Exterior_Village: 64,
  Exterior_Roofs: 69,
  Exterior_CitySpec: 79,
  Exterior_CitySpec_Snow: 80,
  Exterior_CitySpecB: 82,
  Exterior_CitySpecB_Snow: 83,
  Exterior_Doors: 74,
  Interior_CastleInt: 11,
  Interior_CityInt: 16,
  Interior_CryptA: 19,
  Interior_CryptB: 20,
  Interior_DungeonsA: 22,
  Interior_DungeonsB: 23,
  Interior_DungeonsC: 24,
  Interior_DungeonsNEWCs: 25,
  Interior_FarmInt: 28,
  Interior_MagesGuildInt: 37,
  Interior_ManorInt: 40,
  Interior_MarbleFloors: 41,
  Interior_MerchantHomesInt: 44,
  Interior_Mines: 45,
  Interior_Caves: 47,
  Interior_Paintings: 48,
  Interior_TavernInt: 60,
  Interior_TempleInt: 63,
  Interior_VillageInt: 66,
  Interior_Sewer: 68,
  Nature_RainForest: 500,
  Nature_SubTropical: 501,
  Nature_Swamp: 502,
  Nature_Desert: 503,
  Nature_TemperateWoodland: 504,
  Nature_WoodlandHills: 506,
  Nature_HauntedWoodlands: 508,
  Nature_Mountains: 510,
};

export const GROUP = { None: 0, Terrain: 1, Exterior: 2, Interior: 3, Nature: 4 };

const EXTERIOR_SETS = new Set([
  SET.Exterior_Ruins, SET.Exterior_Castle, SET.Exterior_CityA,
  SET.Exterior_CityB, SET.Exterior_CityWalls, SET.Exterior_Farm,
  SET.Exterior_Fences, SET.Exterior_MagesGuild, SET.Exterior_Manor,
  SET.Exterior_MerchantHomes, SET.Exterior_TavernExteriors,
  SET.Exterior_TempleExteriors, SET.Exterior_Village, SET.Exterior_Roofs,
  SET.Exterior_CitySpec, SET.Exterior_CitySpec_Snow,
  SET.Exterior_CitySpecB, SET.Exterior_CitySpecB_Snow,
]);
const INTERIOR_SETS = new Set([
  SET.Interior_CastleInt, SET.Interior_CityInt, SET.Interior_CryptA,
  SET.Interior_CryptB, SET.Interior_DungeonsA, SET.Interior_DungeonsB,
  SET.Interior_DungeonsC, SET.Interior_DungeonsNEWCs, SET.Interior_FarmInt,
  SET.Interior_MagesGuildInt, SET.Interior_ManorInt,
  SET.Interior_MarbleFloors, SET.Interior_MerchantHomesInt,
  SET.Interior_Mines, SET.Interior_Caves, SET.Interior_Paintings,
  SET.Interior_TavernInt, SET.Interior_TempleInt, SET.Interior_VillageInt,
  SET.Interior_Sewer,
]);
const NATURE_WINTER_SETS = new Set([
  SET.Nature_TemperateWoodland, SET.Nature_WoodlandHills,
  SET.Nature_HauntedWoodlands, SET.Nature_Mountains,
]);
const NATURE_SETS = new Set([
  SET.Nature_RainForest, SET.Nature_SubTropical, SET.Nature_Swamp,
  SET.Nature_Desert, ...NATURE_WINTER_SETS,
]);

/** Verbatim ClimateSwaps.GetClimateTextureInfo. */
export function getClimateTextureInfo(archive) {
  const ci = { textureSet: SET.None, textureGroup: GROUP.None, supportsWinter: false, supportsRain: false };
  if (archive > 499) {
    if (NATURE_SETS.has(archive)) {
      ci.textureSet = archive;
      ci.textureGroup = GROUP.Nature;
      if (NATURE_WINTER_SETS.has(archive)) ci.supportsWinter = true;
    }
    return ci;
  }
  const set = archive - Math.trunc(archive / 100) * 100;
  if (set === SET.Exterior_Terrain) {
    ci.textureSet = set;
    ci.textureGroup = GROUP.Terrain;
    ci.supportsWinter = true;
    ci.supportsRain = true;
  } else if (EXTERIOR_SETS.has(set)) {
    ci.textureSet = set;
    ci.textureGroup = GROUP.Exterior;
    ci.supportsWinter = true;
  } else if (set === SET.Exterior_Doors) {
    ci.textureSet = set;
    ci.supportsWinter = false;
  } else if (INTERIOR_SETS.has(set)) {
    ci.textureSet = set;
    ci.textureGroup = GROUP.Interior;
  }
  return ci;
}

/**
 * Verbatim ClimateSwaps.ApplyClimate: remap an archive to climate/season.
 * @param {number} archive - starting texture archive.
 * @param {number} record
 * @param {number} climateBase - API ClimateBaseType (0/100/300/400).
 * @param {number} season - SEASON value.
 * @returns {number} remapped archive.
 */
export function applyClimate(archive, record, climateBase, season) {
  // Do not swap the door-frame tapestry.
  if (archive % 100 === 74 && record === 3) return archive;

  const ci = getClimateTextureInfo(archive);
  if (ci.textureSet === SET.None) return archive;

  // Swamps keep marble floors.
  if (climateBase === BASE.Swamp && ci.textureSet === SET.Interior_MarbleFloors) {
    return archive;
  }
  // Deserts do not support winter.
  if (climateBase === BASE.Desert) ci.supportsWinter = false;
  // Verbatim C# precedence: (swamp && mages guild) OR
  // (castle && record > 3) - the castle clause fires in every climate.
  if ((climateBase === BASE.Swamp && ci.textureSet === SET.Exterior_MagesGuild) ||
      (ci.textureSet === SET.Exterior_Castle && record > 3)) {
    ci.supportsWinter = false;
  }
  if ((archive === 82 && record > 1) || archive === 77) {
    ci.supportsWinter = false;
  }

  let suppressClimateIndex = false;
  switch (archive) {
    case 75: case 76: case 77: case 79: case 80: case 82: case 83:
      suppressClimateIndex = true;
      break;
  }

  let climateIndex;
  if (archive < 500 && !suppressClimateIndex) {
    climateIndex = climateBase + ci.textureSet;
    if (season === SEASON.Winter && ci.supportsWinter) climateIndex += WEATHER_WINTER;
    else if (season === SEASON.Rain && ci.supportsRain) climateIndex += WEATHER_RAIN;
  } else {
    climateIndex = archive;
    if (season === SEASON.Winter && ci.supportsWinter) climateIndex += WEATHER_WINTER;
  }
  return climateIndex;
}

/** Verbatim ClimateSwaps.IsExteriorWindow (colour-changing windows). */
export function isExteriorWindow(archive, record) {
  if ((archive >= 375 && archive <= 379) || archive === 210 || archive === 280) {
    return false;
  }
  if ((archive === 36 && record === 2) ||
      (archive === 151 && record === 3) ||
      (archive === 154 && record === 3) ||
      (archive === 351 && record === 3) ||
      (archive === 171 && record === 2) ||
      (archive === 172 && record === 3) ||
      (archive === 173 && record === 3)) {
    return true;
  }
  archive = archive % 100;
  switch (archive) {
    case 9: case 10: case 12: case 13: case 14: case 15:
    case 26: case 27: case 35: case 36: case 38: case 39:
    case 42: case 43: case 58: case 59: case 61: case 62:
    case 64: case 65:
      if (record === 3) return true;
      break;
    case 75: case 76: case 77:
      return true;
    case 79: case 80:
      if (record === 0 || record === 2) return true;
      break;
    case 82: case 83:
      if (record === 0) return true;
      break;
  }
  return false;
}

/** Verbatim GetNatureArchive: winter bumps the four woodland sets by 1. */
export function getNatureArchive(baseNatureArchive, season) {
  let archive = NATURE_SETS.has(baseNatureArchive)
    ? baseNatureArchive
    : SET.Nature_TemperateWoodland;
  if (season === SEASON.Winter && NATURE_WINTER_SETS.has(archive)) archive += 1;
  return archive;
}

/** Verbatim GetGroundArchive: climate base ground + Winter 1 / Rain 2. */
export function getGroundArchive(climateBase, season) {
  let archive;
  switch (climateBase) {
    case BASE.Desert: archive = 2; break;
    case BASE.Mountain: archive = 102; break;
    case BASE.Temperate: archive = 302; break;
    case BASE.Swamp: archive = 402; break;
    default: archive = 302; break;
  }
  if (season === SEASON.Winter) archive += 1;
  else if (season === SEASON.Rain) archive += 2;
  return archive;
}
