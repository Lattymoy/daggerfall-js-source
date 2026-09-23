// W1's TABLE, ITS OWN HOME (WEATHER3, 2026-09-22): DFU's weather odds -
// Game/Weather/Weather.cs's roll and dispatch, and WeatherTable.json,
// the climate and weather table of the Daggerfall Chronicles pg. 47
// (MIT, Daggerfall Workshop) - moved whole out of weatherSim.js so the
// sim (the one sky's state) and the world weather map
// (systems/weatherMap.js, the enhanced lane's systems over the land)
// read the SAME table without importing each other. weatherSim.js
// re-exports every name here; nothing about the table, the roll or its
// order changed in the move.

import { CLIMATES } from '../formats/mapsFile.js';
import { SEASONS } from './gameDate.js';
import { WEATHER_TYPES } from '../world/weather.js';

/** WeatherType enum values (Weather.cs:18-30): the index into
 *  WEATHER_TYPES is the enum - Sunny 0, Cloudy 1, Overcast 2, Fog 3,
 *  Rain 4, Thunder 5, Snow 6 ("descending pleasant-ness"). */
export const WEATHER_ENUM = Object.freeze(Object.fromEntries(WEATHER_TYPES.map((w, i) => [w, i])));

// ---- the table (WeatherTable.json, digit for digit) -----------------
// Chances in %, one row per season, in DFU's COMPILED odds order:
// [Sunny, Cloudy, Overcast, Fog, Rain, Snow, Thunder]. Seasons keyed
// by the gameDate enum (Fall 0, Spring 1, Summer 2, Winter 3). Every
// row sums to 100 (Validate() normalizes at a 0.1 tolerance;
// verbatim rows need none - pinned).
const R = (sunny, cloudy, overcast, fog, rain, snow, thunder) => [sunny, cloudy, overcast, fog, rain, snow, thunder];
const WEATHER_TABLE = Object.freeze({
  desert: {
    [SEASONS.Winter]: R(75, 15, 0, 3, 5, 0, 2),
    [SEASONS.Spring]: R(75, 15, 0, 0, 5, 0, 5),
    [SEASONS.Summer]: R(85, 15, 0, 0, 0, 0, 0),
    [SEASONS.Fall]:   R(80, 15, 0, 0, 3, 0, 2),
  },
  mountains: {
    [SEASONS.Winter]: R(18, 20, 25, 2, 0, 35, 0),
    [SEASONS.Spring]: R(30, 23, 15, 2, 20, 0, 10),
    [SEASONS.Summer]: R(45, 25, 15, 0, 10, 0, 5),
    [SEASONS.Fall]:   R(30, 18, 20, 2, 20, 0, 10),
  },
  jungle: {
    [SEASONS.Winter]: R(15, 20, 25, 3, 25, 0, 12),
    [SEASONS.Spring]: R(20, 15, 10, 3, 37, 0, 15),
    [SEASONS.Summer]: R(35, 20, 10, 0, 25, 0, 10),
    [SEASONS.Fall]:   R(20, 20, 20, 0, 25, 0, 15),
  },
  swamp: {
    [SEASONS.Winter]: R(15, 20, 25, 25, 0, 15, 0),
    [SEASONS.Spring]: R(10, 10, 20, 20, 25, 0, 15),
    [SEASONS.Summer]: R(25, 15, 15, 15, 20, 0, 10),
    [SEASONS.Fall]:   R(15, 15, 15, 20, 20, 0, 15),
  },
  subtropical: {
    [SEASONS.Winter]: R(20, 20, 20, 5, 25, 0, 10),
    [SEASONS.Spring]: R(30, 15, 10, 3, 27, 0, 15),
    [SEASONS.Summer]: R(40, 15, 10, 0, 20, 0, 15),
    [SEASONS.Fall]:   R(25, 20, 15, 0, 25, 0, 15),
  },
  woodlands: {
    [SEASONS.Winter]: R(25, 15, 20, 5, 10, 25, 0),
    [SEASONS.Spring]: R(35, 15, 10, 5, 25, 0, 10),
    [SEASONS.Summer]: R(60, 20, 5, 0, 10, 0, 5),
    [SEASONS.Fall]:   R(25, 15, 20, 10, 20, 0, 10),
  },
});
export { WEATHER_TABLE };

/** The compiled-order weather TYPE per column (see the note above -
 *  Snow sits before Thunder, Weather.cs:94-100). */
const COMPILED_TYPES = Object.freeze([
  WEATHER_ENUM.sunny, WEATHER_ENUM.cloudy, WEATHER_ENUM.overcast, WEATHER_ENUM.fog,
  WEATHER_ENUM.rain, WEATHER_ENUM.snow, WEATHER_ENUM.thunder,
]);

/** WeatherTable.GetWeather's climate dispatch (Weather.cs:200-224). */
export function weatherTableFor(climateIndex) {
  switch (climateIndex) {
    case CLIMATES.Desert: case CLIMATES.Desert2: return WEATHER_TABLE.desert;
    case CLIMATES.Mountain: case CLIMATES.MountainWoods: return WEATHER_TABLE.mountains;
    case CLIMATES.Rainforest: return WEATHER_TABLE.jungle;
    case CLIMATES.Ocean: case CLIMATES.Swamp: return WEATHER_TABLE.swamp;
    case CLIMATES.Subtropical: return WEATHER_TABLE.subtropical;
    case CLIMATES.Woodlands: case CLIMATES.HauntedWoodlands: return WEATHER_TABLE.woodlands;
    default:
      console.warn(`[weather] unknown climate ${climateIndex} - Sunny`);   // LogWarning + Sunny (Weather.cs:221-223)
      return null;
  }
}

/** The roll (WeatherClimateSeason.GetWeather, Weather.cs:116-129):
 *  uniform [0,100), subtract each chance in compiled order until
 *  <= 0; Sunny on fall-through. Answers the WeatherType ENUM. */
export function rollWeather(climateIndex, season, rolls = Math.random) {
  const table = weatherTableFor(climateIndex);
  if (!table) return WEATHER_ENUM.sunny;
  const row = table[season];
  if (!row) {
    console.warn(`[weather] unknown season ${season} - Sunny`);   // WeatherClimate.GetWeather's own arm (Weather.cs:167-168)
    return WEATHER_ENUM.sunny;
  }
  let rand = rolls() * 100;
  for (let i = 0; i < row.length; i++) {
    rand -= row[i];
    if (rand <= 0) return COMPILED_TYPES[i];
  }
  return WEATHER_ENUM.sunny;   // fallback with DFU's own warning path
}
