// W1: THE WEATHER SIMULATION - verbatim from DFU WeatherManager.cs +
// Game/Weather/Weather.cs + the PlayerEntity daily tick (MIT,
// Daggerfall Workshop; the table data is Assets/Resources/
// WeatherTable.json, itself the climate and weather table of the
// Daggerfall Chronicles pg. 47). R12 shipped the whole PRESENTATION
// (world/weather.js: fog, sky variants, sun dimming, lightning,
// precipitation, ambience routing) driven by a static ?weather URL
// param; this module is the STATE the param stood in for - the
// per-climate per-season roll, the six-zone climate weather array
// re-rolled on every game-date change (PlayerEntity.cs:440-448), the
// forced re-roll when a respawn lands in a different climate BASE
// type (WeatherManager.cs:514-522), and the one persisted value
// (SerializablePlayer's playerPosition.weather - DFU does NOT persist
// the array; it re-rolls on the next day change).
//
// ONE module-level state, because there is one sky - the worldTick
// clock idiom. The hosts drive it from their exterior frame
// (tickWeather) and their travel/respawn arrivals (weatherRespawn);
// DFU's WeatherManager.Update returns while the player is inside, so
// days that pass indoors apply on the first exterior frame back -
// same visible outcome as DFU's flag, one application per surfacing.
//
// LAW NOTES kept verbatim:
// - The roll is a cumulative walk over Random.Range(0f,100f):
//   rand -= chance until <= 0 (Weather.cs:116-129). DFU compiles the
//   odds in the order Sunny, Cloudy, Overcast, Fog, Rain, SNOW,
//   THUNDER (:94-100 - Snow before Thunder, unlike the enum); the
//   walk's distribution is order-blind, but the table below keeps
//   DFU's compiled order so the same roll sequence answers the same
//   weather.
// - Walking across a climate boundary does NOT re-roll - only a
//   RESPAWN into a different ClimateBaseType does (:514-522), and
//   only the date change re-rolls the array. Weather follows you
//   until the world turns.
// - The classic-save import law (SAVEVARS 6 bytes at 0x17A2, mask
//   0x7f, swap 5<->6 - StartGameBehaviour.cs:634-643) rides the
//   classic .SAV reader's ledger row; no consumer here yet.

import { CLIMATE_INDICES } from './travel.js';   // {0,0,0,1,2,3,4,5,5,5} by (climate - Ocean) - TravelTimeCalculator.cs:30, the same map WeatherManager.cs:432 spends
import { CLIMATES, CLIMATE_BASE_TYPES, getWorldClimateSettings } from '../formats/mapsFile.js';
import { SEASONS, seasonValue, dateFromClassicMinutes, MINUTES_PER_DAY } from './gameDate.js';
import { WEATHER_TYPES } from '../world/weather.js';

export { WEATHER_TYPES };

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

// ---- the module state ----------------------------------------------

let _climateWeathers = new Uint8Array(6);   // [Desert, Mountain, Rainforest, Swamp, Subtropical, Woodlands] (WeatherManager.cs:421-426)
let _current = WEATHER_ENUM.sunny;          // PlayerWeather.WeatherType - the one persisted value
let _lastDay = null;                        // the PlayerEntity daily tick's date memory
let _lastClimateBase = CLIMATE_BASE_TYPES.None;   // lastRespawnClimate (WeatherManager.cs:90)

export const currentWeather = () => WEATHER_TYPES[_current];
export const currentWeatherEnum = () => _current;

/** SetWeather's state half - the presentation halves (fog, sky
 *  offset, sun scale...) derive from the NAME through world/weather.js
 *  at the host, per frame. Exposed for ?weather overrides and probes. */
export function setWeather(type) {
  const w = typeof type === 'string' ? WEATHER_ENUM[type] : type;
  if (w == null) return false;
  _current = w;
  return true;
}

/** SetClimateWeathers (WeatherManager.cs:419-427): one roll per zone
 *  for the season, into the six classic slots. */
export function setClimateWeathers(season, rolls = Math.random) {
  _climateWeathers[0] = rollWeather(CLIMATES.Desert, season, rolls);
  _climateWeathers[1] = rollWeather(CLIMATES.Mountain, season, rolls);
  _climateWeathers[2] = rollWeather(CLIMATES.Rainforest, season, rolls);
  _climateWeathers[3] = rollWeather(CLIMATES.Swamp, season, rolls);
  _climateWeathers[4] = rollWeather(CLIMATES.Subtropical, season, rolls);
  _climateWeathers[5] = rollWeather(CLIMATES.Woodlands, season, rolls);
}

/** SetWeatherFromWeatherClimateArray (:429-440): the player's climate
 *  picks its zone slot through TravelTimeCalculator.climateIndices. */
export function weatherForClimate(climateIndex) {
  const zone = CLIMATE_INDICES[climateIndex - CLIMATES.Ocean];
  // A bogus climate answers the CURRENT weather unchanged - DFU's
  // :432-434 would throw IndexOutOfRange; the defensive arm is the
  // port's, recorded (tickWeather then reports no change).
  return zone == null ? _current : _climateWeathers[zone];
}

/** StreamingWorld_OnInitWorld's application half (WeatherManager.cs:
 *  524-543 -> SetWeatherFromWeatherClimateArray): a world re-init
 *  (fast travel arrival) applies the destination climate's ARRAY
 *  slot - no fresh roll. DEPARTURE (recorded): DFU suppresses this
 *  for the rest of a session once any save has loaded
 *  (startedFromLoadedSaveGame stays true), which exists to keep the
 *  boot-time init from clobbering a loaded sky; the port applies on
 *  every arrival instead of freezing travel weather forever after
 *  the first load. Answers true when the weather changed. */
export function applyClimateWeather(climateIndex) {
  const next = weatherForClimate(climateIndex);
  if (next === _current) return false;
  _current = next;
  return true;
}

/** THE DAILY TICK (PlayerEntity.cs:440-448 + the flag walk): when the
 *  game DATE changes, re-roll all six zones for the season and apply
 *  the player's slot. Call from the exterior frame with the player's
 *  raw CLIMATE.PAK index; answers true when the applied weather
 *  CHANGED (the host re-derives its presentation). The first call
 *  after boot rolls too (StartGameBehaviour.cs:435-436 randomizes at
 *  new game); a restore suppresses that by stamping the day
 *  (startedFromLoadedSaveGame, WeatherManager.cs:524-543). */
export function tickWeather(nowMinutes, climateIndex, rolls = Math.random) {
  const day = Math.floor(nowMinutes / MINUTES_PER_DAY);
  // daysPast > 0 exactly (PlayerEntity.cs:444) - a clock that moves
  // BACKWARD never re-rolls; only the fresh-boot null rolls forward
  // from nothing.
  if (_lastDay !== null && day <= _lastDay) return false;
  _lastDay = day;
  setClimateWeathers(seasonValue(dateFromClassicMinutes(nowMinutes)), rolls);
  const next = weatherForClimate(climateIndex);
  if (next === _current) return false;
  _current = next;
  return true;
}

/** PollWeatherChanges(true) at respawn (WeatherManager.cs:514-522 +
 *  :386-404): a travel/teleport arrival whose climate BASE type
 *  differs from the last one rolls DIRECTLY for the current climate
 *  and season - the immediate "different sky at the destination".
 *  Answers true when the weather changed. */
export function weatherRespawn(nowMinutes, climateIndex, rolls = Math.random) {
  const base = getWorldClimateSettings(climateIndex).climateType;
  if (base === _lastClimateBase) return false;
  _lastClimateBase = base;
  const next = rollWeather(climateIndex, seasonValue(dateFromClassicMinutes(nowMinutes)), rolls);
  if (next === _current) return false;
  _current = next;
  return true;
}

/** The save halves: DFU persists ONE value (playerPosition.weather,
 *  SerializablePlayer.cs:225) and re-rolls the array on the next date
 *  change; the restore stamps the day so the boot tick does not
 *  clobber the loaded sky. */
export const snapshotWeather = () => currentWeather();
export function restoreWeather(weather, nowMinutes) {
  if (weather != null) setWeather(weather);
  _lastDay = Math.floor((nowMinutes ?? 0) / MINUTES_PER_DAY);
}

/** Test seam: back to the fresh-boot state. */
export function resetWeatherSim() {
  _climateWeathers = new Uint8Array(6);
  _current = WEATHER_ENUM.sunny;
  _lastDay = null;
  _lastClimateBase = CLIMATE_BASE_TYPES.None;
}
