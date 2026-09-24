// W1: THE WEATHER SIMULATION - verbatim from DFU WeatherManager.cs +
// Game/Weather/Weather.cs + the PlayerEntity daily tick (MIT,
// Daggerfall Workshop; the table data is Assets/Resources/
// WeatherTable.json, itself the climate and weather table of the
// Daggerfall Chronicles pg. 47 - kept in weatherTable.js). R12 shipped the whole PRESENTATION
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
import { seasonValue, dateFromClassicMinutes } from './gameDate.js';
import { WEATHER_TYPES } from '../world/weather.js';
import { seededRng } from './wind.js';   // CLK2: the evolution's own generator - never the classic lane's sequence
import { isEnhanced } from './uiSkin.js';   // CLK2: the evolution is the enhanced lane's
import { getPref } from './uiPrefs.js';
import { groundIsSnowy, climateSeasonFromMinutes } from '../world/climateSwaps.js';   // WEATHER2a: the terrain's own snow law
import { fieldAt, FIELD_RANGE_M, pixelOfField } from './weatherField.js';   // WEATHER2b: the day's words as places
import { systemsNear, wornAmong, skyCells, approachAt, insideClip } from './weatherMap.js';   // WEATHER3b: the world weather map - systems on the land; WEATHER3c: its sky and its wind

export { WEATHER_TYPES };

// The table, its dispatch and the roll live in weatherTable.js (WEATHER3:
// the world weather map reads the same odds); re-exported whole.
import { WEATHER_ENUM, rollWeather } from './weatherTable.js';
export { WEATHER_ENUM, WEATHER_TABLE, weatherTableFor, rollWeather } from './weatherTable.js';

// ---- the module state ----------------------------------------------

// WORLD5 (Mac: "the shared clock and weather"): ONLINE, THE DAY PICKS THE ROLL. The six-zone array is rolled once per
// game date from Math.random, so two players under one sky rolled two skies. With the shared clock on, every roll of
// the array - the day change's, the boot's, a respawn's - draws from a generator seeded by the DAY (and the climate,
// for a respawn), so every client rolls the same six values for the same date without a frame to carry them. The
// enhanced lane's hourly evolution (CLK2, below) was already seeded by the hour and the zone, so it agrees for free.
let _sharedWeather = false;
export function setSharedWeather(on) { _sharedWeather = !!on; }
export const sharedWeatherOn = () => _sharedWeather;
const SHARED_WEATHER_SEED = 0x57454154;   // 'WEAT'
/** The generator a roll draws from: the day's own under the shared clock, the caller's otherwise. */
const rollsFor = (nowMinutes, rolls, salt = 0) => (_sharedWeather ? seededRng((Math.floor(nowMinutes / 1440) * 31 + salt) ^ SHARED_WEATHER_SEED) : rolls);
/** AUDIT WORLD5 C5: the stamp of a roll of the day's array. Under the shared clock the roll is THE DAY'S, whoever
 *  rolled it and whenever they arrived: stamped at the day's first minute (so a joiner's drain at noon is a jump -
 *  the sky changed hours ago - and a midnight roll's drain is a front, as it is offline), and the hourly evolution
 *  re-anchored at the hour before the day's first, so the next evolve replays every hour of the day up to now and a
 *  client that joined at noon carries the sky the one that stood under it since midnight does. Offline the stamp is
 *  the roll's own minute and the evolution stands where it stood. */
const stampRoll = (nowMinutes) => {
  if (!_sharedWeather) return nowMinutes;
  const day = Math.floor(nowMinutes / 1440);
  _evolveHour = day * 24 - 1;
  return day * 1440;
};

let _climateWeathers = new Uint8Array(6);   // [Desert, Mountain, Rainforest, Swamp, Subtropical, Woodlands] (WeatherManager.cs:421-426)
let _current = WEATHER_ENUM.sunny;          // PlayerWeather.WeatherType - the one persisted value
let _raw = WEATHER_ENUM.sunny;              // WEATHER2a: the table's own word before the ground law (the wind's violence reads it - a storm turned to snow is a blizzard)
let _climateWeathersRolled = false;         // StartGameBehaviour.cs:435-436's one-shot "Randomize weathers"
let _climateWeathersValid = false;          // CLK2 review: the six values came from a real roll or an import - a loaded save stamps ROLLED without rolling (the array is all Sunny), and the evolution must not move off that
let _updateFromClimateArray = false;        // WeatherManager.updateWeatherFromClimateArray (:105)
let _lastClimateBase = CLIMATE_BASE_TYPES.None;   // lastRespawnClimate (WeatherManager.cs:90)
// WX2a (AUDIT 57): A CHANGE THE PLAYER WAS NOT PRESENT FOR IS A JUMP, NOT
// A FRONT. The enhanced sky (WIND1) and the ground (WX2) build a
// three-hour front at every change of the word, and DFU's own paths hand
// them changes that are not weather arriving but the player arriving:
// a load, a fast-travel landing, a teleport's respawn roll, a day's roll
// drained on the first frame back out of a dungeon. Each of those bumps
// this stamp; the hosts read it once a frame and snap instead of
// building. The classic path, which snaps on every change, reads nothing.
let _jumps = 0;
let _crossings = 0;   // WEATHER2b: the count of weather changes that were the player crossing a cell's edge (or a cell drifting over them) - a short front, not the day's three-hour lead
let _fieldCells = [];   // WEATHER2b: the cells near the player at the last sample, in field metres (the clouds' cells)
let _fieldInside = null;
let _rolledAtMinutes = null;                 // when the day's array was rolled, to tell a stale drain from a live one
let _zoneChangedAtMinutes = new Array(6).fill(null);   // CLK2 review: per zone, when the EVOLUTION last moved that slot (null: the day roll's stamp stands) - a zone the player cannot see never moves the stale clock
/** A drain more than this many game minutes after its roll was a day the
 *  player spent inside - the weather changed hours ago, out of sight. */
export const STALE_DRAIN_MINUTES = 30;

export const currentWeather = () => WEATHER_TYPES[_current];
export const currentWeatherEnum = () => _current;
/** WEATHER2a: the sim's word BEFORE the ground law - the wind model's
 *  violence word, so a storm that fell as snow still blows like one. */
export const currentWeatherRaw = () => WEATHER_TYPES[_raw];

// ---- WEATHER2b (2026-09-14): THE WEATHER FIELD -------------------------
// Mac: "a dynamic world space event system where weather can be
// traveled out of and into instead of just starting and stopping in
// your location." systems/weatherField.js is the law (the day's words as
// cells over the land, drifting on the day's wind); this is its seam
// into the sim. On the enhanced lane the player's word is what the
// field says AT THE PLAYER - sampled every exterior frame after the
// drain, at every travel and respawn arrival - and it goes through the
// same `_set` (the ground law included). A change the sample makes on a
// LIVE frame is a CROSSING: the player walked into the cell, or the cell
// drifted over them. It is stamped apart from the jumps so the sky
// builds a SHORT front for it (wind.js `arrive`, the sky eased on the
// same short lead) rather than the day roll's three hours - the storm
// was already in view. Behind Enhanced Environments and its own row on
// the Features home (`weather-events`, the pref `weatherEvents`, forced
// on online so one sky is shared); `?wxfield=off` the door.
let _fieldOverride = null;   // tests: true/false; null reads the lane
let _fieldUrlDoor = null;    // ?wxfield=off, read once (lazily)
export function setWeatherFieldLaw(on) { _fieldOverride = on == null ? null : !!on; }
export function weatherFieldOn() {
  if (_fieldOverride !== null) return _fieldOverride;
  _fieldUrlDoor ??= new URLSearchParams(globalThis.location?.search ?? '').get('wxfield') !== 'off';
  return _fieldUrlDoor && isEnhanced() && !!getPref('enhancedEnvironments') && !!getPref('weatherEvents');
}
/** WEATHER2b: the count of crossings. A host keeps the last value it saw;
 *  a new one means the change on this frame is a crossing - a short front. */
export const weatherCrossingStamp = () => _crossings;
/** WEATHER2b: the cells near the player at the last sample - { x, z, r, word, d }
 *  in field metres, nearest first - for the clouds; and the one the player stands in.
 *  WEATHER3c: on the map's lane, every system's bands, most important first, each
 *  with its `imp` and its word's `rank` (the renderer's pick and draw order). */
export const currentFieldCells = () => _fieldCells;
export const currentFieldCell = () => _fieldInside;
/**
 * The field sampled at the player. `at` is [mx, mz] in field metres,
 * `climateAt(px, py)` the map's climate lookup, `how` what a change
 * would be: 'live' (a crossing), 'drain' (the day's roll changed the
 * words this frame - the drain's own front stands), 'jump' (an arrival).
 * Answers true when the worn word changed. Nothing off the lane.
 */
export function sampleWeatherField(nowMinutes, climateIndex, at, climateAt, how = 'live') {
  if (!weatherFieldOn() || !at || !climateAt) return false;
  if (weatherMapOn()) return sampleWeatherMap(nowMinutes, climateIndex, at, climateAt, how);   // WEATHER3b: the map supersedes the field on its own lane
  if (!_climateWeathersValid && !_climateWeathersRolled) return false;   // no words yet: the drain rolls them first
  const f = fieldAt({ day: Math.floor(nowMinutes / 1440), minuteOfDay: nowMinutes % 1440, at, climateAt, wordOfClimate: (c) => WEATHER_TYPES[weatherForClimate(c)] });
  _fieldCells = f.cells; _fieldInside = f.inside;
  const changed = _set(WEATHER_ENUM[f.word], climateIndex, nowMinutes);
  if (changed && how === 'live') _crossings++;
  else if (changed && how === 'jump') _jumps++;
  return changed;
}

// ---- WEATHER3b (2026-09-22): THE WORLD WEATHER MAP IS THE SKY -----------
// Mac: "imagine a map, one location its sunny, one is cloudy, one has a
// rainstorm, etc." systems/weatherMap.js is the law (systems born on the
// land, drifting, growing, dying; the weather a pure function of place
// and minute); this is its seam into the sim. On its lane - the field's
// own (the enhanced skin, Enhanced Environments, the weather-events row,
// forced on online) unless `?wxmap=off` hands the lane back to WEATHER2b's
// field - the player's word is the map at the player:
//   - every exterior frame, through the same `_set` (the ground law, the
//     raw word kept for the wind's violence);
//   - every arrival (a travel landing, a respawn, a teleport) as a JUMP;
//   - INDOORS, over the place the player is inside (`sampleWeatherIndoors`,
//     the host naming it), so the rain heard through the walls starts and
//     stops with the sky outside - each change a jump, since no one inside
//     saw it come.
// A change is a CROSSING - the storm's edge walked into, or drifting over
// - only on a live frame that follows the last sample closely in time and
// place; across a clock jump (a rest, a load, a sentence, an online join)
// or a teleport's distance it is a jump, whatever the host called it, so
// no host has to know which of its paths moved the clock. The day roll
// still rolls (the classic lane and the save read the array), but the
// drain and CLK2's evolution stand down here: the zones' words reach no
// one. Online needs nothing: every client reads the same map at the
// shared clock's minute.
let _mapOverride = null;   // tests: true/false; null reads the lane
let _mapUrlDoor = null;    // ?wxmap=off, read once (lazily)
export function setWeatherMapLaw(on) { _mapOverride = on == null ? null : !!on; }
export function weatherMapOn() {
  if (_mapOverride !== null) return _mapOverride;
  _mapUrlDoor ??= new URLSearchParams(globalThis.location?.search ?? '').get('wxmap') !== 'off';
  return _mapUrlDoor && weatherFieldOn();
}
/** A sample further than this from the last (field metres) is an arrival, not a walk. */
export const MAP_JUMP_M = 2000;
/** The systems are found once per game minute and whenever the player has
 *  moved this far since; within it the found set still holds every system
 *  over the player (they are gathered this much wider than the sky's reach). */
const MAP_REFIND_M = 250;
let _mapAt = null;   // the last sample's place, for the crossing-or-arrival test
let _mapSampledAt = null;   // its minute
let _mapNear = [], _mapNearAt = null, _mapNearMinute = null, _mapNearLookup = null;
let _mapIntensity = 0;
let _mapApproach = 0;
let _arrivals = 0;
/** AUDIT WEATHER3 R5: the count of map samples that were ARRIVALS - a jump,
 *  a clock jump, a teleport's distance, every indoor frame - whether or not
 *  the word changed. The jump stamp moves only with the word, and a landing
 *  under the same sky is still a landing: the distant storms' thunder on its
 *  way belongs to the place left behind. */
export const weatherArrivalStamp = () => _arrivals;
/** WEATHER3d: the map's systems near the player this minute (field metres, standing where they are), [] off the
 *  map's lane - the distant storms' strikes are read off them. */
export const currentMapSystems = () => (weatherMapOn() ? _mapNear : []);
/** WEATHER3c: the wind of the storms drawing near (wind.js VIOLENCE's scale), 0 off the map's lane. */
export const currentWindApproach = () => (weatherMapOn() ? _mapApproach : 0);
/** WEATHER3c: the sky the clouds' cells stand on - clear air on the map's lane (the player's own system is a cell
 *  like any other, so the blue shows past a deck's edge), null off it (the worn word's, as WEATHER2c has it). */
export const currentCloudBase = () => (weatherMapOn() ? 'sunny' : null);
/** WEATHER3b: the intensity of the worn word at the player, 0..1 (the
 *  system's envelope, falling from its centre out) - the WX2 front's peak
 *  on the map's lane; null off it (the front rolls its own). */
export const currentWeatherIntensity = () => (weatherMapOn() ? _mapIntensity : null);
function sampleWeatherMap(nowMinutes, climateIndex, at, climateAt, how) {
  const minute = Math.floor(nowMinutes);
  if (minute !== _mapNearMinute || climateAt !== _mapNearLookup || !_mapNearAt || Math.hypot(at[0] - _mapNearAt[0], at[1] - _mapNearAt[1]) > MAP_REFIND_M) {
    _mapNear = systemsNear(at[0], at[1], minute, climateAt, FIELD_RANGE_M + MAP_REFIND_M);
    _mapNearAt = [at[0], at[1]]; _mapNearMinute = minute; _mapNearLookup = climateAt;
  }
  // AUDIT-3i: the player's word through the SAME ground law as every other reader's - rain over snow ground is snow
  // BEFORE the strongest is chosen, so the strength the player feels is the one that falls there (resolved raw first,
  // a rain front's intensity was worn under a stronger snow front's word); `raw` keeps the painting system's own word
  // for the sky's violence
  const ground = mapGround(climateAt);
  const worn = wornAmong(_mapNear, at[0], at[1], (w, cx, cz) => ground(w, cx, cz, nowMinutes));
  _mapIntensity = worn.intensity;
  // WEATHER3c: THE SKY IS THE MAP'S. Every system within the sky's reach gives the clouds its bands as nested discs -
  // a fair-weather field, a deck's edge, a fog bank on the low ground, a storm's skirt, rain and tower - each word
  // through the ground law at ITS OWN place (a winter storm is a snow cloud where it stands), ranked by how much of
  // the sky it fills from here; the renderer keeps what its slots hold and draws the lowest priority first
  _fieldCells = skyCells(_mapNear, at[0], at[1], (w, cx, cz) => ground(w, cx, cz, nowMinutes)).filter((c) => c.d - c.r <= FIELD_RANGE_M).sort((a, b) => b.imp - a.imp);
  _fieldInside = _fieldCells.find((c) => c.d < c.r && insideClip(c, at[0], at[1]) && c.word === worn.word) ?? null;   // c.d in the system's own measure (WEATHER3h); a storm cell only inside its front
  _mapApproach = approachAt(_mapNear, at[0], at[1]);
  const away = _mapSampledAt === null || minute < _mapSampledAt || minute - _mapSampledAt > STALE_DRAIN_MINUTES
    || !_mapAt || Math.hypot(at[0] - _mapAt[0], at[1] - _mapAt[1]) > MAP_JUMP_M;
  _mapAt = [at[0], at[1]]; _mapSampledAt = minute;
  const changed = _set(WEATHER_ENUM[worn.raw], climateIndex, nowMinutes);
  if (how === 'jump' || away) _arrivals++;   // AUDIT WEATHER3 R5: an arrival whether or not the word moved
  if (changed && (how === 'jump' || away)) _jumps++;
  else if (changed) _crossings++;
  return changed;
}
/** WEATHER3c / AUDIT WEATHER3 R1: THE GROUND LAW AT A PLACE, for every reader of the map's words - the sky's cells,
 *  the forecast, the distant storms (and the travel map's washes, until DISC17-C took the weather off the map):
 *  `(word, x, z, minutes)` answers the word as it falls at field (x, z) at that minute (WEATHER2a: rain or a storm over
 *  a ground that wears snow is snow). One law, so no reader says "Rain" where the player standing there gets snow. */
export function mapGround(climateAt) {
  return (word, x, z, minutes) => {
    if (word !== 'rain' && word !== 'thunder') return word;
    const px = pixelOfField(x, z);
    return WEATHER_TYPES[overGround(WEATHER_ENUM[word], climateAt(px.x, px.y), minutes)];
  };
}

/** WEATHER3b: the indoor tick's sample - the map over the place the
 *  player is inside (`at` the field position the host answers for it: the
 *  building's or the dungeon's own pixel), so the weather outside goes on
 *  while they are in. A change is a jump: no one inside saw it come.
 *  AUDIT WEATHER3 R3: it used to read the last OUTDOOR sample's place, and
 *  an arrival that went straight in - a load into a dungeon, a recall, a
 *  boot underground - read the old place's sky or none at all. The place
 *  is the host's to say, every indoor frame. Nothing off the lane. */
export function sampleWeatherIndoors(nowMinutes, climateIndex, at, climateAt) {
  if (!weatherMapOn() || !at || !climateAt) return false;
  return sampleWeatherMap(nowMinutes, climateIndex, at, climateAt, 'jump');
}

// ---- WEATHER2a (2026-09-14): NO RAIN OVER SNOW -----------------------
// Mac: "it can rain when there's snow on the ground." The table is the
// Chronicles' and DFU's, digit for digit, and its winter rows carry rain
// and thunder for every climate but the mountains - woodlands 10% rain,
// the jungle 25% rain and 12% thunder, the swamp's spring... - while the
// TERRAIN wears its snow archive for the whole of Winter in every
// climate but a Desert base (climateSwaps.js getTerrainGroundArchive,
// the 2026-09-01 incident's law). DFU draws exactly that: rain streaks
// over snow ground, a storm over a white field. The classic lane keeps
// it, 1:1. The ENHANCED lane funnels every write of the sim's word
// through the ground: rain or thunder over a ground that wears snow
// falls as SNOW (`overGround`), and the word the table rolled is kept
// beside it (`_raw`) so the wind's violence is the storm's - a thunder
// word on a winter ground is a blizzard, not a flurry. Behind Enhanced
// Environments like the evolution (CLK2); `?snowground=off` the door.
// The three writers - the day's drain, the travel arrival, the respawn
// roll - go through ONE `_set`; the save's restore and the ?weather pin
// take a word whole (a saved word was funnelled when it was set; a pin
// is a probe's).
let _snowGroundOverride = null;   // tests: true/false; null reads the lane
let _snowGroundUrlDoor = null;    // ?snowground=off, read once (lazily)
/** Tests and the lab: force the ground law on or off (null: the lane decides). */
export function setSnowGroundLaw(on) { _snowGroundOverride = on == null ? null : !!on; }
export function snowGroundLawOn() {
  if (_snowGroundOverride !== null) return _snowGroundOverride;
  _snowGroundUrlDoor ??= new URLSearchParams(globalThis.location?.search ?? '').get('snowground') !== 'off';
  return _snowGroundUrlDoor && isEnhanced() && !!getPref('enhancedEnvironments');
}
/** The word the sky may wear over THIS ground now: rain or a storm on a
 *  ground that wears snow is snow. Pure over the lane's answer. */
export function overGround(word, climateIndex, nowMinutes) {
  if (!snowGroundLawOn() || (word !== WEATHER_ENUM.rain && word !== WEATHER_ENUM.thunder)) return word;
  if (nowMinutes == null || !Number.isFinite(nowMinutes)) return word;
  return groundIsSnowy(getWorldClimateSettings(climateIndex), climateSeasonFromMinutes(nowMinutes)) ? WEATHER_ENUM.snow : word;   // an unknown climate takes the default's ground, as the terrain does
}
/** The ONE write of the sim's word from a roll or the array: the raw word
 *  kept, the ground law applied. Answers true when the worn word changed. */
function _set(next, climateIndex, nowMinutes) {
  _raw = next;
  const word = overGround(next, climateIndex, nowMinutes);
  if (word === _current) return false;
  _current = word;
  return true;
}

/** SetWeather's state half - the presentation halves (fog, sky
 *  offset, sun scale...) derive from the NAME through world/weather.js
 *  at the host, per frame. Exposed for ?weather overrides and probes. */
export function setWeather(type) {
  const w = typeof type === 'string' ? WEATHER_ENUM[type] : type;
  if (w == null) return false;
  _current = w;
  _raw = w;   // WEATHER2a: a word taken whole is its own violence
  return true;
}

/** The six zones' climates, in the slots' order (WeatherManager.cs:421-426). */
export const ZONE_CLIMATES = Object.freeze([CLIMATES.Desert, CLIMATES.Mountain, CLIMATES.Rainforest, CLIMATES.Swamp, CLIMATES.Subtropical, CLIMATES.Woodlands]);

/** SetClimateWeathers (WeatherManager.cs:419-427): one roll per zone
 *  for the season, into the six classic slots. */
export function setClimateWeathers(season, rolls = Math.random) {
  for (let zone = 0; zone < 6; zone++) _climateWeathers[zone] = rollWeather(ZONE_CLIMATES[zone], season, rolls);   // Desert, Mountain, Rainforest, Swamp, Subtropical, Woodlands - the roll order kept
  _climateWeathersValid = true;
  _zoneChangedAtMinutes.fill(null);   // CLK2: a fresh roll of every zone - the day's stamp is the stamp
}

/** The zone slot a climate reads (TravelTimeCalculator.climateIndices). */
const zoneOf = (climateIndex) => CLIMATE_INDICES[climateIndex - CLIMATES.Ocean];

/** SetWeatherFromWeatherClimateArray (:429-440): the player's climate
 *  picks its zone slot through TravelTimeCalculator.climateIndices. */
export function weatherForClimate(climateIndex) {
  const zone = zoneOf(climateIndex);
  // A bogus climate answers the CURRENT weather unchanged - DFU's
  // :432-434 would throw IndexOutOfRange; the defensive arm is the
  // port's (tickWeather then reports no change), and it rides the
  // same Ledger A row as the arrival law above.
  return zone == null ? _current : _climateWeathers[zone];
}

/** StreamingWorld_OnInitWorld's application half (WeatherManager.cs:
 *  524-543 -> SetWeatherFromWeatherClimateArray): a world re-init
 *  (fast travel arrival) applies the destination climate's ARRAY
 *  slot - no fresh roll. RECORDED DEPARTURE: DFU suppresses this
 *  for the rest of a session once any save has loaded
 *  (startedFromLoadedSaveGame stays true), which exists to keep the
 *  boot-time init from clobbering a loaded sky; the port applies on
 *  every arrival instead of freezing travel weather forever after
 *  the first load. Ledger A carries it as TRAVEL WEATHER IS APPLIED
 *  ON EVERY ARRIVAL, NOT FROZEN AFTER THE FIRST LOAD (AUDIT 58,
 *  seams lane), cited by name because a line number rots. Answers
 *  true when the weather changed. */
export function applyClimateWeather(climateIndex, nowMinutes = null, at = null, climateAt = null) {
  if (at && climateAt && nowMinutes != null && weatherMapOn()) return sampleWeatherMap(nowMinutes, climateIndex, at, climateAt, 'jump');   // WEATHER3b: the map at the destination - the zones' words reach no one on its lane
  let changed = applyFromArray(climateIndex, nowMinutes);   // WEATHER2a: the arrival's minute, for the ground the sky lands over
  if (changed) _jumps++;   // WX2a: a world re-init is the PLAYER arriving, not the weather
  if (at && climateAt && sampleWeatherField(nowMinutes, climateIndex, at, climateAt, changed ? 'drain' : 'jump')) changed = true;   // WEATHER2b: the field at the destination, one jump
  return changed;
}

/** The array slot applied, and nothing said about how it got there: the
 *  drain's half (a front, when live) and the travel arrival's (a jump). */
function applyFromArray(climateIndex, nowMinutes) {
  return _set(weatherForClimate(climateIndex), climateIndex, nowMinutes);   // WEATHER2a: through the ground
}

/** DISC9 (Mac, 2026-09-23: "now it's not raining outside and you can hear it raining inside"): THE WEATHER THE
 *  PLAYER HEARS. On the enhanced lane the sim's word is not what is falling: the front (systems/weatherFront.js)
 *  eases an episode in behind the cloud's arrival and has dry spells inside it, and the street's ear follows the
 *  drops (`soundWeather`), so a 'rain' word over a dry street is a cloudy day. Every reader of "is it raining here"
 *  that the player HEARS must take that same word - Better Ambience's indoor rain read the sim's instead, and played
 *  a shower in the tavern that the street outside did not have. The outdoor frame writes the word it heard; indoors
 *  it holds (the front does not tick there, as DFU's WeatherManager does not). A JUMP - a load, a travel landing, a
 *  respawn - lands the player under the sim's sky whole, so a word heard before it no longer stands. */
let _heard = null;
let _heardGain = 1;
let _heardAtJump = -1;
export function setHeardWeather(word, rainGain = 1) { _heard = word ?? null; _heardGain = Number.isFinite(rainGain) ? Math.max(0, Math.min(1, rainGain)) : 1; _heardAtJump = _jumps; }
export const heardWeather = () => (_heard != null && _heardAtJump === _jumps ? _heard : currentWeather());
/** DISC11 (Mac: "ITS LOUDER ON THE INSIDE COMPARED TO THE OUTSIDE"): the street's rain LEVEL, beside its word - the
 *  front's intensity on the enhanced lane (a light shower is 0.15), 1 on the classic one. Every rain the player hears
 *  indoors is scaled from THIS, so no indoor rain can outplay the street's. After a jump the classic level stands. */
export const heardRainGain = () => (_heard != null && _heardAtJump === _jumps ? _heardGain : 1);

/** WX2a: the count of weather changes that were jumps. A host keeps the
 *  last value it saw; a new one means the change on this frame (if any)
 *  is to be taken whole, not built toward. */
export const weatherJumpStamp = () => _jumps;

/**
 * S41 - THE DAY CHANGE'S WEATHER MEMBER (PlayerEntity.cs:447-448),
 * and ONLY that: roll the six zones for the season, and raise
 * WeatherManager's updateWeatherFromClimateArray so the next
 * exterior frame applies the player's slot.
 *
 * This used to be fused into tickWeather along with its own private
 * `_lastDay` marker, which put a SECOND day-change marker in the port
 * beside PlayerEntity's own - and the fused version only ever ran on
 * an exterior frame. Days spent underground therefore rolled the
 * zones ZERO times: a ten-day crawl came back out to one catch-up
 * roll where DFU's PlayerEntity.Update - which runs wherever the
 * player is - had rolled on each of the ten day boundaries. One day
 * change, one marker, one home: worldTick's day block calls this.
 *
 * The APPLY does not happen here, because it does not happen here in
 * DFU either: PlayerEntity raises the flag and WeatherManager.Update
 * drains it (:146-156 -> :406-415), and that Update RETURNS EARLY while the
 * player is inside. That is what defers a rolled sky to the first
 * frame back outside, and it is a flag rather than a poll so that
 * nothing else - a quest, a spell, a ?weather pin - gets clobbered on
 * the frames in between.
 */
export function rollClimateWeathersForDay(nowMinutes, rolls = Math.random) {
  setClimateWeathers(seasonValue(dateFromClassicMinutes(nowMinutes)), rollsFor(nowMinutes, rolls));   // WORLD5: the day's own roll online
  _climateWeathersRolled = true;
  _updateFromClimateArray = true;
  _rolledAtMinutes = stampRoll(nowMinutes);   // WX2a: the drain measures its lateness from here; AUDIT WORLD5 C5: the day's own minute online
}

/** THE EXTERIOR FRAME'S WEATHER DRAIN - WeatherManager.Update's
 *  UpdateFromClimateArrayCheck (:406-415), plus StartGameBehaviour's
 *  one-shot roll (:435-436).
 *
 *  Call from the exterior frame with the player's raw CLIMATE.PAK
 *  index; answers true when the applied weather CHANGED (the host
 *  re-derives its presentation). Returns false - and does nothing at
 *  all - on every frame where no day change has raised the flag,
 *  which is DFU's `if (updateWeatherFromClimateArray)`.
 *
 *  The boot roll is StartGameBehaviour's "Randomize weathers" at new
 *  game, lazily: the array is all-zero until something rolls it, and
 *  a restore stamps it rolled instead (startedFromLoadedSaveGame,
 *  WeatherManager.cs:524-543) so the loaded sky survives. */
export function tickWeather(nowMinutes, climateIndex, rolls = Math.random) {
  if (!_climateWeathersRolled) {
    setClimateWeathers(seasonValue(dateFromClassicMinutes(nowMinutes)), rollsFor(nowMinutes, rolls));   // WORLD5: the day's own roll online
    _climateWeathersRolled = true;
    _updateFromClimateArray = true;   // OnInitWorld raises it at every non-load start (:534)
    _rolledAtMinutes = stampRoll(nowMinutes);   // AUDIT WORLD5 C5: the day's own minute online
  }
  if (!_updateFromClimateArray) return false;
  // WEATHER3b: the day still rolls (the classic lane and the save read it), but on the map's lane nothing applies it.
  // AUDIT WEATHER3 R4: asked BEFORE the flag is spent - the pending apply waits, so a lane switched off mid-session
  // (the skin, Enhanced Environments) drains the zone's slot on its next frame instead of wearing the map's last word
  if (weatherMapOn()) return false;
  _updateFromClimateArray = false;
  const changed = applyFromArray(climateIndex, nowMinutes);
  // WX2a: a LIVE drain - the day turned while the player stood under the
  // sky - is a front. A STALE one - the roll happened while they were
  // inside, and lands on the first frame back out - is a jump: the
  // weather changed hours ago, and the sky they step out under is
  // already the new one. CLK2: the stamp is the PLAYER'S ZONE's - the
  // evolution's own hour where it moved that slot, else the day roll's.
  const zone = zoneOf(climateIndex);
  const rolledAt = (zone != null ? _zoneChangedAtMinutes[zone] : null) ?? _rolledAtMinutes;
  if (changed && rolledAt != null && nowMinutes - rolledAt > STALE_DRAIN_MINUTES) _jumps++;
  return changed;
}

/** PollWeatherChanges(true) at respawn (WeatherManager.cs:514-522 +
 *  :386-404): a travel/teleport arrival whose climate BASE type
 *  differs from the last one rolls DIRECTLY for the current climate
 *  and season - the immediate "different sky at the destination".
 *  Answers true when the weather changed. */
export function weatherRespawn(nowMinutes, climateIndex, rolls = Math.random, at = null, climateAt = null) {
  const base = getWorldClimateSettings(climateIndex).climateType;
  if (at && climateAt && weatherMapOn()) { _lastClimateBase = base; return sampleWeatherMap(nowMinutes, climateIndex, at, climateAt, 'jump'); }   // WEATHER3b: every respawn lands under the map's sky there, whatever the climate it left
  if (base === _lastClimateBase) return false;
  _lastClimateBase = base;
  // WEATHER2b: under the field the destination's sky is the FIELD's word there - DFU's fresh roll for the
  // climate stands down on the lane (the field is the day's words as places; a roll beside it would be a
  // second sky), and the arrival is a jump either way
  if (at && climateAt && weatherFieldOn()) return sampleWeatherField(nowMinutes, climateIndex, at, climateAt, 'jump');
  const next = rollWeather(climateIndex, seasonValue(dateFromClassicMinutes(nowMinutes)), rollsFor(nowMinutes, rolls, 1 + climateIndex));   // WORLD5: the day's and the climate's roll online
  if (!_set(next, climateIndex, nowMinutes)) return false;   // WEATHER2a: through the ground
  _jumps++;   // WX2a: the respawn's "different sky at the destination" is the player arriving under it
  return true;
}

/** The save halves: DFU persists ONE value (playerPosition.weather,
 *  SerializablePlayer.cs:225) and re-rolls the array on the next date
 *  change; the restore stamps the day so the boot tick does not
 *  clobber the loaded sky. */
export const snapshotWeather = () => currentWeather();
export function restoreWeather(weather) {
  if (weather != null) setWeather(weather);
  // startedFromLoadedSaveGame's else arm (WeatherManager.cs:540-542):
  // "so no weather update from climate array happens in case of
  // loaded savegame". The loaded sky stands until the next DAY
  // CHANGE rolls the array - which is PlayerEntity's marker now, and
  // that marker re-anchors on restore too (SerializablePlayer.cs:339),
  // so a load cannot fire a day change of its own.
  _climateWeathersRolled = true;
  _updateFromClimateArray = false;
  _jumps++;   // WX2a: a load lands the player under the saved sky, whole
  _mapAt = null;   // WEATHER3b: and the map's first word after it is a jump too, wherever the load landed (no place to have come from)
  _evolveHour = null;   // CLK2: the evolution re-anchors on the loaded clock, rolling nothing
  _climateWeathersValid = false;   // CLK2 (AUDIT 65 SL-1): a loaded save's array is not THIS session's - an in-session load leaves the outgoing session's roll standing, and the evolution stays dormant until the next day roll re-rolls it
}

/** SAV3: the classic-save import's weather arm. StartFromClassicSave
 *  hands the converted six-zone array to PlayerWeather.ClimateWeathers
 *  (:644) - the 0x7f mask and 5<->6 swap have ALREADY run in
 *  classicSave.js convertClassicClimateWeathers, this seam only takes
 *  the result. The array is stamped rolled (no catch-up roll on the
 *  boot tick) and the apply flag raised, so the first exterior frame's
 *  drain wears the imported zone's sky - OnInitWorld's own non-load
 *  shape (:534). */
export function importClimateWeathers(converted) {
  if (!converted || converted.length !== 6) return false;
  _climateWeathers = Uint8Array.from(converted);
  _climateWeathersRolled = true;
  _climateWeathersValid = true;   // CLK2: an import is a real array
  _zoneChangedAtMinutes.fill(null);
  _updateFromClimateArray = true;
  return true;
}

// ---- CLK2 (2026-09-08): THE WEATHER EVOLVES WITHIN THE DAY -----------
// Mac: "in sync with the world clock". DFU rolls the six zones ONCE per
// game day (PlayerEntity.cs:447-448) and shipped WeatherManager's hourly
// poll commented out (the W1 row); the classic lane keeps that verbatim
// above. The ENHANCED lane adds an evolution ON THE CLOCK: at every game
// hour boundary, wherever the player is (the tick's place, beside the
// day roll), each zone re-rolls from the same table for its climate and
// the season with EVOLVE_CHANCE_PER_HOUR, by a SEEDED generator keyed on
// the hour and the zone - never the classic lane's sequence (ECV1's
// rule), and replayable: the same hour of the same day evolves the same
// way whoever watches. A changed slot raises DFU's own drain flag, so
// the change lands through the existing machine: a front when the
// player stands under it, a jump when it happened out of sight (the
// stale-drain law, stamped at the HOUR the change belongs to). Behind
// Enhanced Environments; `?evolve=off` the kill switch. A Ledger row.
export const EVOLVE_CHANCE_PER_HOUR = 0.12;   // a zone's sky turns, on average, every eight hours or so on top of the day's roll
const EVOLVE_SEED = 0x5EED;
let _evolveOverride = null;   // tests: true/false; null reads the lane
let _evolveUrlDoor = null;    // ?evolve=off - the one door that cannot change without a reload, read once (lazily: a probe installs location after import)
let _evolveHour = null;       // the absolute game hour the evolution last ran at (null: re-anchor without rolling)

/** Tests and the lab: force the evolution on or off (null: the lane decides). */
export function setWeatherEvolution(on) { _evolveOverride = on == null ? null : !!on; }
export function weatherEvolutionOn() {
  if (_evolveOverride !== null) return _evolveOverride;
  // CLK2 review: the skin and EE1's switch are LIVE (the Enhanced pane
  // flips the pref without a reload), so they are read every call
  _evolveUrlDoor ??= new URLSearchParams(globalThis.location?.search ?? '').get('evolve') !== 'off';
  return _evolveUrlDoor && isEnhanced() && !!getPref('enhancedEnvironments');
}

/**
 * The hourly evolution - from the tick, after the day roll. Walks every
 * hour boundary crossed since the last call, at most the last 24 (a
 * longer jump's earlier hours are the day roll's to have re-rolled);
 * a rewound clock re-anchors and rolls nothing. Answers true when a
 * zone changed.
 */
export function evolveClimateWeathers(nowMinutes) {
  const hour = Math.floor(nowMinutes / 60);
  if (weatherMapOn()) { _evolveHour = hour; return false; }   // WEATHER3b: the map is the lane's weather; the zones' words reach no one
  // CLK2 review: VALID, not merely rolled - a loaded save stamps the
  // array rolled without rolling it (all Sunny), and an evolution off
  // that would hand the drain a slot the save never had; the loaded sky
  // stands until the next day roll, as the W1 restore law says
  if (!weatherEvolutionOn() || !_climateWeathersValid || _evolveHour === null || hour < _evolveHour) { _evolveHour = hour; return false; }
  if (hour === _evolveHour) return false;
  const season = seasonValue(dateFromClassicMinutes(nowMinutes));
  let changedAny = false;
  for (let h = Math.max(_evolveHour + 1, hour - 23); h <= hour; h++) {
    for (let zone = 0; zone < 6; zone++) {
      const r = seededRng((h * 6 + zone) ^ EVOLVE_SEED);
      if (r() >= EVOLVE_CHANCE_PER_HOUR) continue;
      const next = rollWeather(ZONE_CLIMATES[zone], season, r);
      if (next !== _climateWeathers[zone]) {
        _climateWeathers[zone] = next;
        _zoneChangedAtMinutes[zone] = h * 60;   // WX2a: stale by the change's OWN hour, for THIS zone - a distant zone's turn never moves the player's stale clock
        changedAny = true;
      }
    }
  }
  _evolveHour = hour;
  if (!changedAny) return false;
  _updateFromClimateArray = true;    // WeatherManager's own flag: the next exterior frame drains it (a no-op where the player's slot did not move)
  return true;
}

/** Test seam: back to the fresh-boot state. */
export function resetWeatherSim() {
  _sharedWeather = false;   // WORLD5
  _climateWeathers = new Uint8Array(6);
  _current = WEATHER_ENUM.sunny;
  _raw = WEATHER_ENUM.sunny;   // WEATHER2a
  _snowGroundOverride = null; _snowGroundUrlDoor = null;
  _climateWeathersRolled = false;
  _updateFromClimateArray = false;
  _lastClimateBase = CLIMATE_BASE_TYPES.None;
  _jumps = 0;
  _heard = null; _heardGain = 1; _heardAtJump = -1;   // DISC9 / DISC11
  _crossings = 0; _fieldCells = []; _fieldInside = null; _fieldOverride = null; _fieldUrlDoor = null;   // WEATHER2b
  _mapOverride = null; _mapUrlDoor = null; _mapAt = null; _mapSampledAt = null;   // WEATHER3b
  _mapNear = []; _mapNearAt = null; _mapNearMinute = null; _mapNearLookup = null; _mapIntensity = 0; _mapApproach = 0; _arrivals = 0;
  _rolledAtMinutes = null;
  _zoneChangedAtMinutes = new Array(6).fill(null);
  _climateWeathersValid = false;
  _evolveOverride = null;
  _evolveUrlDoor = null;
  _evolveHour = null;
}
