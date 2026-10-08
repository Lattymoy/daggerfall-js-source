// WINDFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These should be
// on by default and integrate into our enhanced environments seamlessly") - WINDFALL 1.0.0 (demifiend000, vendored at
// vendor/windfall/), ported off its assembly: WindNaturalPlanner and WindRecordWeights whole, and WindMod's state -
// its settings, the day's context and plan, the presentation state, the gusts and the profile the flora sway by, its
// save record and its console command. Pure: the hosts hand it the frame, the renderer draws what it answers (render/
// renderer.js BB_VS's Windfall law), and systems/windfallEffects.js is WindEnvironmentEffects (the sound and the
// leaves) it drives.
//
// THE LAW (WindMod.TryUpdateEnvironmentalState, every frame):
//   - THE DAY'S CONTEXT: StableHash(year, month, day, map x / 8, map y / 8, the climate) - a new key rebuilds the
//     day: System.Random(key & 0x7FFFFFFF) for its gusts, the natural plan (WindNaturalPlanner.Build), its heading;
//   - THE NATURAL EVENT: the plan's daily roll under the effective chance (the season's authored chance times the
//     geography's, capped 0.35, times the frequencies and the cooldown) and the minute inside its window - a windy
//     period, or one in 8% (NaturalWindstormFrequency) a windstorm; stamped for the cooldown when it is met outside;
//   - THE PRESENTATION: Thunder is a storm; else the natural event's (windstorm a storm, windy period windy), else
//     normal - a change cancels the gust and schedules the next;
//   - THE GUSTS: scheduled by the state (InitialEventDelay, NextEventDelay, a 15% pair), each a rise over its first
//     quarter, a hold to 0.45 and a fall; its peak and its heading's swing by the state;
//   - THE PROFILE the flora sway by (Normal, Windy Day, Storm; rain 1.15x and snow 1.1x the strength off a storm),
//     lerped toward Gust by the gust and eased 1 - e^(-3 dt) a frame; the sway's and the shiver's phases run on its
//     frequencies.
// Single precision as the C# runs it (Math.fround at every float operation the assembly makes in float) - pinned
// against the reference harness's trace (test/windfall1_model.test.js).
//
// ENHANCED ENVIRONMENTS (Mac: "integrate into our enhanced environments seamlessly"): Windfall is the enhanced
// outdoors' - the hosts tick it under the enhanced sky only (sky.enhanced), as WIND1's wind and every consumer of it
// are - and it does not stand beside the port's own sway, it IS the sway while it is on (render/renderer.js BB_VS
// takes one law or the other, never both). ONE WIND, ONE WAY: the heading the trees lean and the leaves blow is the
// outdoors' own wind's (systems/windDrive.js `dir` - the wisps', the rain's, the clouds'), Windfall's slow wander and
// its gusts' swing turned about it; the mod's daily heading (HashUnit x 360 + WindDirectionDegrees) stands only where
// the host hands no wind (a test, a frame with none). The port's eighth weather, the sandstorm (WEATHER2d, a gale's
// wind - WIND1's VIOLENCE 0.95), is a storm here as Thunder is; DFU has no such word.

import { modSetting } from './modSettings.js';
import { NetRandom } from '../formats/netRuntime.js';
import { pageParam } from './pageQuery.js';
import { WEATHER_TYPES } from '../world/weather.js';
import { lerpF } from './mathf.js';   // Mathf.Lerp in float

export const WINDFALL_VENDOR = 'windfall';
/** The nature archives a batch must be in for the mod to patch it (TryPatchBatch: 500..511). */
export const WINDFALL_NATURE = Object.freeze({ first: 500, last: 511 });
/** NaturalEventSource. */
export const NATURAL = Object.freeze({ none: 0, windyPeriod: 1, windstorm: 2 });
/** WindMod.PresentationState. */
export const PRESENTATION = Object.freeze({ normal: 0, windy: 1, storm: 2 });
/** WindMod.DebugWindMode. */
export const DEBUG_MODE = Object.freeze({ auto: 0, normal: 1, windy: 2, storm: 3 });
/** DFU's WeatherType, as the mod reads it - the port's words in their enum order (world/weather.js `WEATHER_TYPES`, its
 *  one home), by word. */
const WEATHER = Object.freeze(Object.fromEntries(WEATHER_TYPES.map((w, i) => [w, i])));

const f32 = Math.fround;
const INT_MIN = -2147483648;
const PI_F = f32(Math.PI);
const TWO_PI_F = f32(PI_F * 2);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampF = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Mathf.MoveTowards. */
const moveTowards = (c, t, d) => (Math.abs(f32(t - c)) <= d ? t : f32(c + Math.sign(f32(t - c)) * d));
/** Mathf.Repeat. */
const repeatF = (t, length) => clampF(f32(t - f32(f32(Math.floor(f32(t / length))) * length)), 0, length);

// ---- the word the host hands -----------------------------------------------------------------------------------
const WORD_TO_WEATHER = Object.freeze({ ...WEATHER, sandstorm: WEATHER.thunder });
/** The weather the mod reads: DFU's WeatherType number, or the port's word (the sandstorm a storm, as Thunder). */
export const windfallWeather = (w) => (typeof w === 'number' ? w : (WORD_TO_WEATHER[w] ?? 0));

// ---- WindRecordWeights -------------------------------------------------------------------------------------------
/** The three response bytes (Low, Medium, Full). */
export const RESPONSE = Object.freeze({ low: 89, medium: 166, full: 255 });
/** Weights[archive - 500][record], verbatim. */
export const RECORD_WEIGHTS = Object.freeze([
  [0, 166, 89, 255, 0, 89, 89, 89, 89, 166, 166, 255, 255, 255, 255, 255, 255, 0, 255, 89, 166, 166, 166, 89, 166, 255, 89, 166, 0, 0, 255, 0],
  [0, 166, 89, 0, 0, 0, 0, 89, 89, 89, 0, 255, 255, 255, 255, 255, 255, 255, 89, 0, 255, 89, 0, 0, 0, 89, 89, 89, 89, 89, 255, 166],
  [0, 0, 0, 0, 0, 0, 0, 89, 89, 0, 0, 0, 255, 255, 255, 0, 255, 255, 255, 0, 166, 89, 0, 166, 0, 0, 89, 89, 89, 89, 0, 89],
  [0, 0, 0, 0, 0, 255, 0, 0, 89, 0, 0, 0, 0, 255, 0, 0, 0, 89, 0, 0, 0, 0, 0, 0, 89, 255, 89, 166, 0, 89, 0, 89],
  [0, 166, 89, 0, 0, 0, 0, 89, 89, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 89, 89, 0, 0, 255, 89, 166, 166, 89, 0, 0],
  [0, 166, 89, 0, 0, 0, 0, 89, 89, 0, 0, 255, 255, 255, 255, 255, 0, 255, 255, 0, 0, 89, 89, 0, 0, 255, 89, 166, 166, 89, 0, 0],
  [0, 0, 89, 0, 0, 255, 0, 89, 89, 166, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 89, 89, 89, 0, 255, 89, 166, 0, 89, 255, 89],
  [0, 0, 0, 0, 0, 255, 0, 89, 89, 89, 0, 255, 255, 255, 255, 0, 255, 0, 0, 0, 0, 89, 89, 166, 0, 255, 89, 166, 0, 89, 89, 89],
  [0, 0, 89, 0, 0, 0, 0, 89, 89, 0, 0, 0, 0, 255, 89, 255, 0, 0, 0, 0, 0, 89, 0, 0, 0, 0, 89, 166, 166, 89, 0, 0],
  [0, 0, 89, 0, 0, 0, 0, 89, 89, 0, 0, 0, 0, 0, 89, 0, 0, 0, 0, 0, 0, 89, 0, 0, 0, 0, 89, 166, 166, 89, 0, 0],
  [0, 0, 89, 0, 0, 255, 0, 89, 89, 89, 0, 255, 255, 255, 0, 255, 0, 0, 0, 0, 0, 255, 89, 89, 0, 255, 89, 0, 0, 89, 255, 0],
  [0, 0, 0, 0, 0, 255, 0, 89, 89, 89, 0, 255, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255, 89, 166, 0, 255, 89, 89, 0, 89, 89, 0],
].map((row) => Object.freeze(row)));
/** The tables for Seasons of the Iliac Bay's own atlases (the mod's seasonal repaints stand other pictures at a
 *  record), verbatim. */
const SIB_WEIGHTS = Object.freeze({
  hauntedFall: [0, 0, 0, 89, 0, 0, 0, 0, 89, 89, 89, 255, 0, 0, 255, 89, 255, 0, 0, 255, 0, 0, 89, 0, 0, 0, 0, 89, 166, 166, 89, 255],
  hauntedSpringWinter: [255, 255, 0, 89, 0, 0, 0, 0, 89, 89, 89, 255, 0, 0, 255, 89, 255, 0, 0, 255, 0, 0, 89, 0, 0, 0, 0, 89, 166, 166, 89, 255],
  hillsFall: [255, 255, 0, 89, 0, 0, 255, 0, 89, 166, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 89, 0, 255, 89, 166, 0, 89, 255, 89, 255, 89],
  hillsSpring: [255, 255, 0, 89, 0, 0, 255, 0, 89, 89, 166, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 89, 89, 89, 0, 255, 89, 166, 0, 89, 255],
  hillsWinter: [255, 255, 0, 255, 0, 0, 255, 0, 89, 89, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 89, 0, 166, 0, 255, 89, 166, 0, 89, 89, 255],
  mountainFall: [0, 0, 0, 89, 0, 0, 255, 0, 89, 89, 89, 255, 255, 255, 255, 0, 255, 0, 0, 0, 0, 0, 255, 89, 89, 0, 255, 89, 0, 0, 89, 255],
  mountainSpring: [255, 255, 0, 89, 0, 0, 255, 0, 89, 89, 89, 255, 255, 255, 255, 0, 255, 0, 0, 0, 0, 0, 255, 89, 89, 0, 255, 89, 0, 0, 89, 255],
  temperateFall: [255, 255, 166, 89, 0, 0, 0, 0, 0, 89, 89, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 89, 89, 0, 0, 0, 89, 166, 166, 89, 255],
  temperateSpring: [89, 89, 166, 89, 0, 0, 0, 0, 89, 0, 166, 255, 255, 255, 255, 255, 255, 255, 255, 255, 89, 89, 89, 89, 0, 89, 255, 89, 166, 166, 89, 89],
  temperateWinter: [255, 255, 0, 0, 0, 0, 0, 89, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 255, 89, 166, 166, 89, 255, 0, 255, 255, 255],
});
/** GetSeasonsOfIliacBayWeights: the atlas SeasonHelper names "SeasonHelper <prefix> TEXTURE.<archive>" - its prefix
 *  for the archive in that season (systems/seasonsIliacBay.js archivePrefix) - to its table, else none. */
const SIB_ATLAS = Object.freeze({
  '504I': 'temperateFall', '504J': 'temperateSpring', '505K': 'temperateWinter',
  '506D': 'hillsFall', '506E': 'hillsSpring', '507F': 'hillsWinter',
  '508A': 'hauntedFall', '508B': 'hauntedSpringWinter', '509C': 'hauntedSpringWinter',
  '510G': 'mountainFall', '510H': 'mountainSpring',
});
/** The name SeasonHelper gives the atlas it builds for `archive` under `prefix`, as the mod's table reads it. */
export const seasonHelperAtlasName = (prefix, archive) => `SeasonHelper ${prefix} TEXTURE.${archive}`;

/** WindRecordWeights.GetResponseByte. */
export function responseByte(archive, record) {
  const row = RECORD_WEIGHTS[archive - 500];
  if (!row || record < 0 || record >= row.length) return 0;
  return row[record];
}
/** WindRecordWeights.GetResponseByteForAtlas - the atlas by its name, as the mod's material reads it. */
export function responseByteForAtlas(archive, record, atlasName) {
  const m = /^SeasonHelper ([A-Z]) TEXTURE\.(\d+)$/.exec(String(atlasName ?? ''));
  const table = m && Number(m[2]) === archive ? SIB_WEIGHTS[SIB_ATLAS[`${archive}${m[1]}`]] : null;
  if (!table) return responseByte(archive, record);
  return record < 0 || record >= table.length ? 0 : table[record];
}
/** The batch's share of the mod's lean - its wind mask's byte at the record, over 255 (TryPatchBatch's BuildMask:
 *  every frame of a record filled with its response, read back by the shader's `.w` of an Alpha8 texture). 0 off the
 *  nature archives, where the mod patches nothing. `seasonPrefix`: Seasons of the Iliac Bay's prefix while it stands
 *  its own atlas for the archive (its picture of the record), else null. */
export function windfallResponse(archive, record, seasonPrefix = null) {
  if (!(archive >= WINDFALL_NATURE.first && archive <= WINDFALL_NATURE.last)) return 0;
  const b = seasonPrefix ? responseByteForAtlas(archive, record, seasonHelperAtlasName(seasonPrefix, archive)) : responseByte(archive, record);
  return b / 255;
}

// ---- WindNaturalPlanner ------------------------------------------------------------------------------------------
/** WindNaturalPlanner.StableHash(params int[]): FNV-1a's offset and prime, a 13-bit xorshift after each multiply. */
export function plannerStableHash(...values) {
  let h = 2166136261;
  for (const v of values) {
    h = (h ^ (v >>> 0)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
  }
  return h | 0;
}
/** HashUnit: the low 31 bits over 2^31, in float. */
export const hashUnit = (value) => f32(value & 0x7fffffff) / 2147483648;
/** RangeInclusive. */
function rangeInclusive(minimum, maximum, unit) {
  if (maximum <= minimum) return minimum;
  const n = maximum - minimum + 1;
  return minimum + Math.min(n - 1, Math.floor(f32(clamp01(unit) * n)));
}
const WINDSTORM_CHANCE = f32(0.08);
/** Build(contextKey, windstormFrequency, minutesPerDay) -> the day's plan. */
export function buildNaturalPlan(contextKey, windstormFrequency, minutesPerDay = 1440) {
  const dailyRoll = hashUnit(plannerStableHash(contextKey, 1327217884));
  const escalationRoll = hashUnit(plannerStableHash(contextKey, 998940193));
  const storm = clamp01(f32(WINDSTORM_CHANCE * Math.max(0, windstormFrequency)));
  const source = escalationRoll < storm ? NATURAL.windstorm : NATURAL.windyPeriod;
  const lo = source === NATURAL.windstorm ? 60 : 180, hi = source === NATURAL.windstorm ? 180 : 360;
  let length = rangeInclusive(lo, hi, hashUnit(plannerStableHash(contextKey, 1819596163, source)));
  length = Math.max(1, Math.min(Math.max(1, minutesPerDay), length));
  const start = rangeInclusive(0, Math.max(0, minutesPerDay - length), hashUnit(plannerStableHash(contextKey, 433440687, source)));
  return Object.freeze({ contextKey, dailyRoll, escalationRoll, plannedSource: source, startMinute: start, endMinute: start + length });
}
/** ComputeEffectiveChance: the product in double, cast to float, clamped. */
export function effectiveChance(authored, overall, season, geography, weather, cooldown) {
  return clamp01(f32(Math.max(0, authored) * Math.max(0, overall) * Math.max(0, season) * Math.max(0, geography) * Math.max(0, weather) * Math.max(0, cooldown)));
}
/** CooldownMultiplier: none the day after a natural event (nor the same day under another context), half the day
 *  after that. */
export function cooldownMultiplier(currentDay, contextKey, lastDay, lastContext) {
  if (lastDay < 0 || currentDay < lastDay) return 1;
  switch (currentDay - lastDay) {
    case 0: return contextKey !== lastContext ? 0 : 1;
    case 1: return 0;
    case 2: return 0.5;
    default: return 1;
  }
}
/** IsWithinWindow. */
export const isWithinWindow = (plan, minuteOfDay) => minuteOfDay >= plan.startMinute && minuteOfDay < plan.endMinute;
/** ScaleAutomaticDelay: a frequency of 0 is never. */
export const scaleAutomaticDelay = (delay, frequency) => (frequency <= 0 ? Infinity : f32(Math.max(0, delay) / frequency));
/** ScaleGust. */
export const scaleGust = (strength, multiplier) => clamp01(f32(Math.max(0, strength) * Math.max(0, multiplier)));

// ---- WindMod's tables -----------------------------------------------------------------------------------------------
const SEASON_CHANCE = Object.freeze({ 1: f32(0.11), 2: f32(0.07), 0: f32(0.16), 3: f32(0.18) });
/** SeasonWindChance. */
export const seasonWindChance = (season) => SEASON_CHANCE[season] ?? 0;
const GEOGRAPHY = Object.freeze([1.5, 1.3, 1.3, 1.7, 0.6, 0.7, 1, 1.2, 0.9, 0.9].map(f32));
/** GeographyWindMultiplier - Ocean (223) through HauntedWoodlands (232). */
export const geographyWindMultiplier = (climate) => GEOGRAPHY[climate - 223] ?? 1;
const REGION_KEYS = Object.freeze(['ocean', 'desert', 'desert', 'mountain', 'rainforest', 'swamp', 'subtropical', 'mountainWoods', 'woodlands', 'hauntedWoodlands']);
const AUTHORED_CAP = f32(0.35);
const RAIN_STRENGTH = f32(1.15), SNOW_STRENGTH = f32(1.1);
const ONE_PERCENT = f32(0.01);

// ---- the settings -------------------------------------------------------------------------------------------------
const readF = (read, k) => f32(Number(read(k)));
/** LoadPercentage. */
const percentage = (read, k) => clampF(f32(readF(read, k) * ONE_PERCENT), 0, 2);
/** LoadProfile. */
function profileOf(read, section) {
  return Object.freeze({
    strength: clampF(readF(read, `${section}.Strength`), 0, 1.5),
    swayAmplitude: clampF(f32(readF(read, `${section}.SwayAmountPercent`) * ONE_PERCENT), 0, f32(0.08)),
    swayFrequency: clampF(readF(read, `${section}.SwaySpeed`), f32(0.05), 1.5),
    shiverAmplitude: clampF(f32(readF(read, `${section}.ShiverAmountPercent`) * ONE_PERCENT), 0, f32(0.03)),
    shiverFrequency: clampF(readF(read, `${section}.ShiverSpeed`), 0.5, 8),
  });
}
/** WindMod.LoadSettings: the mod's keys, clamped as it clamps them (the presentation's go to windfallEffects.js). */
export function windfallSettings(read = (k) => modSetting(WINDFALL_VENDOR, k)) {
  return Object.freeze({
    enabled: read('Enabled') === true,
    windDirectionDegrees: readF(read, 'General.WindDirectionDegrees'),
    overallFrequency: percentage(read, 'General.OverallWindyPeriodFrequency'),
    naturalWindstormFrequency: percentage(read, 'General.NaturalWindstormFrequency'),
    gustFrequency: percentage(read, 'General.GustFrequency'),
    gustStrength: percentage(read, 'General.GustStrength'),
    normal: profileOf(read, 'Normal'), windy: profileOf(read, 'Windy Day'), gust: profileOf(read, 'Gust'), storm: profileOf(read, 'Storm'),
    season: Object.freeze([percentage(read, 'Season Frequency.FallFrequency'), percentage(read, 'Season Frequency.SpringFrequency'), percentage(read, 'Season Frequency.SummerFrequency'), percentage(read, 'Season Frequency.WinterFrequency')]),
    region: Object.freeze({
      ocean: percentage(read, 'Regional Frequency.OceanFrequency'), desert: percentage(read, 'Regional Frequency.DesertFrequency'),
      mountain: percentage(read, 'Regional Frequency.MountainFrequency'), rainforest: percentage(read, 'Regional Frequency.RainforestFrequency'),
      swamp: percentage(read, 'Regional Frequency.SwampFrequency'), subtropical: percentage(read, 'Regional Frequency.SubtropicalFrequency'),
      mountainWoods: percentage(read, 'Regional Frequency.MountainWoodsFrequency'), woodlands: percentage(read, 'Regional Frequency.WoodlandsFrequency'),
      hauntedWoodlands: percentage(read, 'Regional Frequency.HauntedWoodlandsFrequency'), unknown: percentage(read, 'Regional Frequency.UnknownFrequency'),
    }),
    weather: Object.freeze({
      sunny: percentage(read, 'Weather Frequency.SunnyFrequency'), cloudy: percentage(read, 'Weather Frequency.CloudyFrequency'),
      overcast: percentage(read, 'Weather Frequency.OvercastFrequency'), fog: percentage(read, 'Weather Frequency.FogFrequency'),
      rain: percentage(read, 'Weather Frequency.RainFrequency'), snow: percentage(read, 'Weather Frequency.SnowFrequency'),
    }),
    presentation: Object.freeze({
      audioEnabled: read('Presentation.AudioEnabled') === true,
      audioVolume: clamp01(readF(read, 'Presentation.AudioVolume')),
      regularWindVolume: percentage(read, 'Presentation.RegularWindVolume'),
      gustVolume: percentage(read, 'Presentation.GustVolume'),
      ruffleVolume: percentage(read, 'Presentation.FoliageRuffleVolume'),
      leavesEnabled: read('Presentation.LeavesEnabled') === true,
      leafAmount: clampF(readF(read, 'Presentation.LeafAmount'), 0, 3),
      ambientLeafAmount: clampF(readF(read, 'Presentation.AmbientLeafAmount'), 0, 3),
      snowFlurriesEnabled: read('Presentation.SnowFlurriesEnabled') === true,
      snowFlurryAmount: clampF(readF(read, 'Presentation.SnowFlurryAmount'), 0, 3),
    }),
  });
}
/** The mod's built-in profiles (WindMod's field initialisers) - what stands before its settings are read. */
const BUILT_IN = Object.freeze({
  normal: Object.freeze({ strength: f32(0.2), swayAmplitude: f32(0.014), swayFrequency: f32(0.2), shiverAmplitude: f32(0.006), shiverFrequency: f32(0.6) }),
  windy: Object.freeze({ strength: f32(0.2), swayAmplitude: f32(0.026), swayFrequency: f32(0.6), shiverAmplitude: f32(0.012), shiverFrequency: f32(1.1) }),
  gust: Object.freeze({ strength: f32(0.6), swayAmplitude: f32(0.026), swayFrequency: f32(0.8), shiverAmplitude: f32(0.012), shiverFrequency: f32(1.7) }),
  storm: Object.freeze({ strength: f32(0.6), swayAmplitude: f32(0.026), swayFrequency: f32(0.8), shiverAmplitude: f32(0.012), shiverFrequency: f32(1.7) }),
});
/** WindMod's own defaults, read as the settings are (every frequency 1, the built-in profiles) - a test's, and the
 *  mod's before LoadSettings. */
export const WINDFALL_BUILT_IN = Object.freeze({
  enabled: true, windDirectionDegrees: 35, overallFrequency: 1, naturalWindstormFrequency: 1, gustFrequency: 1, gustStrength: 1,
  ...BUILT_IN,
  season: Object.freeze([1, 1, 1, 1]),
  region: Object.freeze({ ocean: 1, desert: 1, mountain: 1, rainforest: 1, swamp: 1, subtropical: 1, mountainWoods: 1, woodlands: 1, hauntedWoodlands: 1, unknown: 1 }),
  weather: Object.freeze({ sunny: 1, cloudy: 1, overcast: 1, fog: 1, rain: 1, snow: 1 }),
  presentation: Object.freeze({ audioEnabled: true, audioVolume: f32(0.5), regularWindVolume: 1, gustVolume: 1, ruffleVolume: 1, leavesEnabled: true, leafAmount: f32(2.4), ambientLeafAmount: 1, snowFlurriesEnabled: true, snowFlurryAmount: 1 }),
});
const settingsKey = (s) => JSON.stringify(s);

/** WindProfile.Lerp. */
function lerpProfile(a, b, t) {
  t = clamp01(t);
  return {
    strength: lerpF(a.strength, b.strength, t), swayAmplitude: lerpF(a.swayAmplitude, b.swayAmplitude, t), swayFrequency: lerpF(a.swayFrequency, b.swayFrequency, t),
    shiverAmplitude: lerpF(a.shiverAmplitude, b.shiverAmplitude, t), shiverFrequency: lerpF(a.shiverFrequency, b.shiverFrequency, t),
  };
}
const smooth01 = (v) => { v = clamp01(v); return f32(f32(v * v) * f32(3 - f32(2 * v))); };
/** FloorDivide. */
const floorDivide = (value, divisor) => Math.floor(value / divisor);
/** Mathf.Sin, cast. */
const sinF = (v) => f32(Math.sin(v));
const DIRECTION_WANDER_RATE = f32(0.011), CONTEXT_PHASE = f32(0.0001);
const DEG = f32(Math.PI / 180);

/**
 * WindMod, ticked by the host. `tick(frame)` takes
 *   { dt, outside, weather, date: { year, month, day }, minuteOfDay, absoluteDay, season, climate, mapPixel: { x, y },
 *     heading: [x, z] | null, settings }
 * - `dt` the frame's game seconds (Time.deltaTime: none while the game is paused, the travel's time scale over them),
 * `weather` DFU's number or the port's word, `season` DFU's Seasons, `climate` the map's
 * climate index, `heading` the outdoors' wind's unit direction in scene x, z (null: the mod's own daily heading) - and
 * answers the frame:
 *   { on, outside, strength, gust, currentGust, profile, swayPhase, shiverPhase, direction: [x, z], presentation, windyDay,
 *     storm, events } - `strength` and `gust` the shader's (0 indoors), `currentGust` the gust as the presentation
 *     reads it (easing to nothing indoors), `events` the gusts this frame started
 *     ({ peak, windy, storm } - WindEnvironmentEffects.PlayWindEvent's).
 * An `on` false frame is the mod's switch off (Update's else: the shader's strength and gust 0, the presentation
 * suppressed).
 */
export function createWindfall({ settings: initial = WINDFALL_BUILT_IN } = {}) {
  let s = initial, sKey = settingsKey(initial);
  let current = { ...s.normal };   // LoadSettings: currentProfile = normalProfile, profileInitialized
  let windTime = 0, swayPhase = 0, shiverPhase = 0;
  let contextKey = INT_MIN, plan = null, naturalSource = NATURAL.none;
  let presentation = PRESENTATION.normal, presentationKnown = false;
  let lastNaturalDay = -1, lastNaturalContext = INT_MIN;
  let baseDirection = 0, direction = 0, baseline = 0, gust = 0;
  let nextGustTime = Infinity, gustStart = 0, gustDuration = 0, gustPeak = 0, gustOffset = 0;
  let gustActive = false, pairPending = false, nextIsPair = false, wasOutside = false;
  let random = null, debugMode = DEBUG_MODE.auto;
  let events = [];
  let status = {};
  let lastHeading = null, lastOutside = false;

  const randomRange = (lo, hi) => { random ??= new NetRandom(1); return lerpF(f32(lo), f32(hi), f32(random.nextDouble())); };
  const cancelGust = () => { gustActive = false; pairPending = false; nextIsPair = false; gust = 0; gustOffset = 0; };
  const scheduleNextGust = (minimum, paired) => {
    const d = scaleAutomaticDelay(minimum, s.gustFrequency);
    if (d === Infinity) { nextGustTime = Infinity; nextIsPair = false; } else { nextGustTime = f32(windTime + d); nextIsPair = paired; }
  };
  const initialEventDelay = () => (presentation === PRESENTATION.storm ? 2 : presentation !== PRESENTATION.windy ? randomRange(20, 45) : 5);
  const nextEventDelay = () => (presentation === PRESENTATION.storm ? randomRange(6, 16) : presentation === PRESENTATION.windy ? randomRange(14, 35) : randomRange(45, 105));
  function startGust(isPaired) {
    nextIsPair = false; gustActive = true; gustStart = windTime;
    const storm = presentation === PRESENTATION.storm, windy = presentation === PRESENTATION.windy, normal = !windy && !storm;
    gustDuration = normal ? randomRange(3, 6) : storm ? randomRange(5, 10) : randomRange(4, 9);
    gustPeak = normal ? randomRange(0.12, 0.27) : storm ? randomRange(0.72, 1) : randomRange(0.55, 1);
    gustOffset = normal ? randomRange(-5, 5) : randomRange(storm ? -20 : -10, storm ? 20 : 10);
    pairPending = !normal && !isPaired && randomRange(0, 1) < f32(0.15);
    events.push({ peak: scaleGust(gustPeak, s.gustStrength), windy, storm });
  }
  function updateGust(outside, rawDt) {
    if (!outside) { gust = moveTowards(gust, 0, f32(rawDt * 0.5)); return; }
    if (!gustActive && windTime >= nextGustTime) startGust(nextIsPair);
    if (!gustActive) { gust = 0; return; }
    const t = clamp01(f32(f32(windTime - gustStart) / gustDuration));
    const env = t < 0.25 ? smooth01(f32(t / 0.25)) : !(t < f32(0.45)) ? f32(1 - smooth01(f32(f32(t - f32(0.45)) / f32(0.55)))) : 1;
    gust = scaleGust(f32(env * gustPeak), s.gustStrength);
    if (t >= 1) {
      gustActive = false; gust = 0; gustOffset = 0;
      if (pairPending) { pairPending = false; scheduleNextGust(randomRange(2, 6), true); } else scheduleNextGust(nextEventDelay(), false);
    }
  }
  function rebuildDailyContext(key) {
    contextKey = key;
    random = new NetRandom(key & 0x7fffffff);
    plan = buildNaturalPlan(key, s.naturalWindstormFrequency, 1440);
    baseDirection = f32(f32(hashUnit(plannerStableHash(key, 747796405)) * 360) + s.windDirectionDegrees);
    direction = baseDirection;
    naturalSource = NATURAL.none;
    presentationKnown = false;
    cancelGust();
  }
  const regionFrequency = (climate) => s.region[REGION_KEYS[climate - 223] ?? 'unknown'];
  function weatherFrequency(weather) {
    switch (weather - 1) {
      case 0: return s.weather.cloudy;
      case 1: return s.weather.overcast;
      case 2: return s.weather.fog;
      case 3: return s.weather.rain;
      case 5: return s.weather.snow;
      case 4: return 1;
      default: return s.weather.sunny;
    }
  }
  function resolveNaturalEvent(f, weather, outside) {
    const seasonChance = seasonWindChance(f.season), geography = geographyWindMultiplier(f.climate);
    const authored = Math.min(AUTHORED_CAP, f32(seasonChance * geography));
    const seasonFreq = s.season[f.season] ?? 1, regionFreq = regionFrequency(f.climate), weatherFreq = weatherFrequency(weather);
    const cooldown = cooldownMultiplier(f.absoluteDay, contextKey, lastNaturalDay, lastNaturalContext);
    const chance = effectiveChance(authored, s.overallFrequency, seasonFreq, regionFreq, weatherFreq, cooldown);
    const qualifies = plan.dailyRoll < chance;
    const src = qualifies && isWithinWindow(plan, f.minuteOfDay) ? plan.plannedSource : NATURAL.none;
    status = { weather, season: f.season, climate: f.climate, absoluteDay: f.absoluteDay, minuteOfDay: f.minuteOfDay, seasonChance, geography, authored, seasonFreq, regionFreq, weatherFreq, cooldown, chance, qualifies };
    if (debugMode !== DEBUG_MODE.auto) return NATURAL.none;
    if (outside && weather !== WEATHER.thunder && src !== NATURAL.none && (lastNaturalDay !== f.absoluteDay || lastNaturalContext !== contextKey)) {
      lastNaturalDay = f.absoluteDay; lastNaturalContext = contextKey;
    }
    return src;
  }
  function resolvePresentation(weather, src) {
    if (debugMode !== DEBUG_MODE.auto) return debugMode === DEBUG_MODE.windy ? PRESENTATION.windy : debugMode === DEBUG_MODE.storm ? PRESENTATION.storm : PRESENTATION.normal;
    if (weather === WEATHER.thunder) return PRESENTATION.storm;
    return src === NATURAL.windstorm ? PRESENTATION.storm : src === NATURAL.windyPeriod ? PRESENTATION.windy : PRESENTATION.normal;
  }
  /** LoadSettings's side: a change re-reads the day (contextKey reset) and the presentation. */
  function configure(next) {
    if (next === s) return;
    const k = settingsKey(next);
    if (k === sKey) return;
    s = next; sKey = k;
    contextKey = INT_MIN;
    presentationKnown = false;
  }
  const off = (outside) => ({ on: false, outside, strength: 0, gust: 0, currentGust: gust, profile: current, swayPhase, shiverPhase, direction: [1, 0], presentation, windyDay: false, storm: false, events: [] });

  return {
    configure,
    tick(frame) {
      const { dt: rawDt = 0, outside = true, settings = s } = frame;
      configure(settings);
      events = [];
      const dt = Math.max(0, f32(rawDt));
      windTime = f32(windTime + dt);
      lastOutside = outside;
      if (!s.enabled) return off(outside);
      const weather = windfallWeather(frame.weather);
      const { year = 0, month = 0, day = 0 } = frame.date ?? {};
      const px = frame.mapPixel ?? { x: 0, y: 0 };
      const key = plannerStableHash(year, month, day, floorDivide(px.x, 8), floorDivide(px.y, 8), frame.climate);
      if (key !== contextKey) rebuildDailyContext(key);
      naturalSource = resolveNaturalEvent(frame, weather, outside);
      const state = resolvePresentation(weather, naturalSource);
      if (!presentationKnown || state !== presentation) {
        presentation = state; presentationKnown = true;
        cancelGust();
        scheduleNextGust(outside ? initialEventDelay() : 10, false);
      }
      if (outside && !wasOutside) { cancelGust(); scheduleNextGust(initialEventDelay(), false); }
      wasOutside = outside;
      updateGust(outside, f32(rawDt));
      const storm = presentation === PRESENTATION.storm, windy = presentation === PRESENTATION.windy;
      let target = { ...(storm ? s.storm : windy ? s.windy : s.normal) };
      if (!storm && weather === WEATHER.rain) target.strength = f32(target.strength * RAIN_STRENGTH);
      else if (!storm && weather === WEATHER.snow) target.strength = f32(target.strength * SNOW_STRENGTH);
      target.strength = clampF(target.strength, 0, 1.5);
      if (gust > 0) target = lerpProfile(target, s.gust, gust);
      current = lerpProfile(current, target, f32(1 - f32(Math.exp(f32(-dt * 3)))));
      baseline = current.strength;
      swayPhase = repeatF(f32(swayPhase + f32(f32(f32(dt * current.swayFrequency) * PI_F) * 2)), TWO_PI_F);
      shiverPhase = repeatF(f32(shiverPhase + f32(f32(f32(dt * current.shiverFrequency) * PI_F) * 2)), TWO_PI_F);
      const wander = f32(sinF(f32(f32(windTime * DIRECTION_WANDER_RATE) + f32(f32(contextKey) * CONTEXT_PHASE))) * 10);
      direction = f32(f32(baseDirection + wander) + f32(gustOffset * gust));
      // ONE WIND, ONE WAY: the outdoors' heading in place of the mod's daily one, the wander and the swing about it
      const h = frame.heading;
      lastHeading = h;
      let dir;
      if (h && (h[0] !== 0 || h[1] !== 0)) {
        const turn = (direction - baseDirection) * (Math.PI / 180), c = Math.cos(turn), sn = Math.sin(turn);
        const l = Math.hypot(h[0], h[1]);
        dir = [(h[0] * c - h[1] * sn) / l, (h[0] * sn + h[1] * c) / l];
      } else {
        const a = f32(direction * DEG);
        dir = [f32(Math.cos(a)), f32(Math.sin(a))];   // the scene is Unity's frame (x east, z north)
      }
      const started = events;
      events = [];   // AUDIT ENVIRONS I8: the frame's gusts are handed over with it - the console's (triggerGust) start a list of their own
      return {
        on: true, outside, strength: outside ? baseline : 0, gust: outside ? gust : 0, currentGust: gust, profile: current, swayPhase, shiverPhase, direction: dir,
        presentation, windyDay: windy || storm, storm, events: started,
      };
    },
    // ---- IHasModSaveData ----
    newSaveData: () => ({ version: 1, lastNaturalWindAbsoluteDay: -1, lastNaturalWindContextKey: INT_MIN }),
    getSaveData: () => ({ version: 1, lastNaturalWindAbsoluteDay: lastNaturalDay, lastNaturalWindContextKey: lastNaturalContext }),
    /** RestoreSaveData: a record that is not version 1, or names a day with no context, is no record. */
    restoreSaveData(d) {
      const ok = d && d.version === 1 && Number.isInteger(d.lastNaturalWindAbsoluteDay) && d.lastNaturalWindAbsoluteDay >= -1
        && Number.isInteger(d.lastNaturalWindContextKey) && !(d.lastNaturalWindAbsoluteDay >= 0 && d.lastNaturalWindContextKey === INT_MIN);
      lastNaturalDay = ok ? d.lastNaturalWindAbsoluteDay : -1;
      lastNaturalContext = ok ? d.lastNaturalWindContextKey : INT_MIN;
      contextKey = INT_MIN;
      presentationKnown = false;
      cancelGust();
    },
    // ---- the console's (ExecuteDebugCommand) ----
    setDebugMode(mode) { debugMode = mode; cancelGust(); nextGustTime = Infinity; presentationKnown = false; },
    get debugMode() { return debugMode; },
    /** TriggerDebugGust: a gust now, as the state stands (the host checks the player is outside). */
    triggerGust() { cancelGust(); startGust(false); return { peak: scaleGust(gustPeak, s.gustStrength), duration: gustDuration, normal: presentation === PRESENTATION.normal }; },
    /** Take the gusts the console started since the last frame (the host hands them to the presentation). */
    takeEvents() { const e = events; events = []; return e; },
    /** GetDebugStatus's numbers. */
    status() {
      return { ...status, debugMode, contextKey, plan, naturalSource, presentation, lastNaturalDay, lastNaturalContext, baseline, gust, gustFrequency: s.gustFrequency, gustStrength: s.gustStrength, overallFrequency: s.overallFrequency, direction, nextGustIn: nextGustTime === Infinity ? Infinity : Math.max(0, nextGustTime - windTime), heading: lastHeading, outside: lastOutside };
    },
    /** For the tests: the state the trace reads. */
    _peek: () => ({ windTime, swayPhase, shiverPhase, contextKey, presentation, gust, current, direction, nextGustTime, lastNaturalDay, lastNaturalContext, naturalSource, baseline }),
  };
}

// ---- the console command (RegisterDebugCommand) ----------------------------------------------------------------------
export const WINDFALL_COMMAND = Object.freeze({
  name: 'windfall',
  description: 'Windfall support and diagnostic controls.',
  usage: 'windfall <auto|normal|windy|storm|gust|bright|ruffle|leaves|status>',
});
const MODE_NAMES = Object.freeze(['auto', 'normal', 'windy', 'storm']);
const NATURAL_NAMES = Object.freeze(['None', 'WindyPeriod', 'NaturalWindstorm']);
const PRESENTATION_NAMES = Object.freeze(['Normal', 'Windy', 'Storm']);
const WEATHER_NAMES = Object.freeze(['Sunny', 'Cloudy', 'Overcast', 'Fog', 'Rain', 'Thunder', 'Snow']);
const SEASON_NAMES = Object.freeze(['Fall', 'Spring', 'Summer', 'Winter']);
const CLIMATE_NAMES = Object.freeze({ 223: 'Ocean', 224: 'Desert', 225: 'Desert2', 226: 'Mountain', 227: 'Rainforest', 228: 'Swamp', 229: 'Subtropical', 230: 'MountainWoods', 231: 'Woodlands', 232: 'HauntedWoodlands' });
/** C#'s {0:P1} / {0:P0}: a percentage with a space before the sign (the invariant culture's "n %" pattern). */
const pct = (v, d) => `${(v * 100).toFixed(d)} %`;
const minuteText = (m) => { m = Math.max(0, Math.min(1440, m)); return m === 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/** GetDebugStatus, line for line. */
export function windfallStatusText(st) {
  const since = st.lastNaturalDay < 0 ? 'none' : String(st.absoluteDay - st.lastNaturalDay);
  const next = st.nextGustIn === Infinity ? 'disabled' : `${st.nextGustIn.toFixed(1)}s`;
  const p = st.plan ?? { dailyRoll: 0, plannedSource: 0, startMinute: 0, endMinute: 0, escalationRoll: 0 };
  return [
    `override=${MODE_NAMES[st.debugMode]} weather=${WEATHER_NAMES[st.weather] ?? st.weather} season=${SEASON_NAMES[st.season] ?? st.season} geography=${CLIMATE_NAMES[st.climate] ?? st.climate}`,
    `context=${st.contextKey} absoluteDay=${st.absoluteDay} minute=${st.minuteOfDay} authoredSeason=${pct(st.seasonChance ?? 0, 1)} geographyMultiplier=${(st.geography ?? 0).toFixed(2)} authoredChance=${pct(st.authored ?? 0, 1)}`,
    `frequency overall=${pct(st.overallFrequency, 0)} season=${pct(st.seasonFreq ?? 1, 0)} region=${pct(st.regionFreq ?? 1, 0)} weather=${pct(st.weatherFreq ?? 1, 0)} cooldown=${(st.cooldown ?? 1).toFixed(2)}`,
    `effectiveChance=${pct(st.chance ?? 0, 1)} dailyRoll=${p.dailyRoll.toFixed(4)} qualifies=${st.qualifies ? 'True' : 'False'}`,
    `planned=${NATURAL_NAMES[p.plannedSource]} window=${minuteText(p.startMinute)}-${minuteText(p.endMinute)} escalationRoll=${p.escalationRoll.toFixed(4)} currentNatural=${NATURAL_NAMES[st.naturalSource]} presentation=${PRESENTATION_NAMES[st.presentation]}`,
    `lastNaturalDay=${st.lastNaturalDay} lastNaturalContext=${st.lastNaturalContext} daysSince=${since}`,
    `baseline=${st.baseline.toFixed(2)} gust=${st.gust.toFixed(2)} gustFrequency=${pct(st.gustFrequency, 0)} gustStrength=${pct(st.gustStrength, 0)} direction=${Math.round(st.direction)} nextGust=${next}`,
  ].join('\n');
}
/** The mod's switch and the kill door beside it (`?windfall=off`) - the hosts read this once a frame. */
export const windfallOn = (search = globalThis.location?.search ?? '') => modSetting(WINDFALL_VENDOR, 'Enabled') === true && pageParam('windfall', search) !== 'off';
