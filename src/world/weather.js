// Weather: fog, sky variants, and sunlight dimming per weather type.
// 1:1 with Daggerfall Unity's WeatherManager and DaggerfallSky weather
// styles (MIT, Daggerfall Workshop). Verbatim:
//   - WeatherType {Sunny 0, Cloudy, Overcast, Fog, Rain, Thunder, Snow}.
//   - FogSettings per weather: Sunny/Overcast linear 0..2400 (density 0,
//     sky excluded); Rainy exp 0.003; Snowy exp 0.005; Heavy exp 0.05
//     (sky INCLUDED); Interior exp 0.001 and Dungeon exp 0.005 (both sky
//     included, fog color BLACK - SetFog's interior/dungeon branch).
//   - SetWeather mapping: Cloudy -> sunny fog (skybox TODO upstream);
//     Overcast -> overcast fog; Fog -> RAIN sky + heavy fog; Rain ->
//     rain sky + rainy fog; Thunder -> rain handling (storm); Snow ->
//     snow sky + snowy fog.
//   - WeatherStyle sky offsets: Rain1 4 / Rain2 5 / Snow1 6 / Snow2 7,
//     picked 50/50 (Random.Range > 0.5 - engine PRNG replaced by the
//     approved umRandom, Port-Ledger A). SkyIndex = SkyBase + offset.
//   - Sunlight scales: Overcast 0.65, Rain 0.45, Storm 0.25, Snow 0.45,
//     Winter 0.65 (winter applies first, precipitation overrides -
//     SetSunlightScale order). Fog weather is IsOvercast-only -> 0.65.
//   - IsSnowFreeClimate: Desert 224, Desert2 225, Rainforest 227,
//     Subtropical 229.
// EQUIVALENCES (documented): the Fog WINDOW style (R2) is applied for
// WeatherType.Fog - DFU defines the style but never wires it; outdoor
// fog COLOR is the sky's horizon fill (west pixel 0) - upstream leaves
// it a literal TODO wishing for exactly this; shadowStrength has no
// consumer here (no shadow maps).

import { UMRandom } from '../formats/umRandom.js';

export const WEATHER_TYPES = Object.freeze([
  'sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow',
]);

export const FOG_SETTINGS = Object.freeze({
  sunny: { mode: 'linear', density: 0, start: 0, end: 2400, excludeSky: true },
  overcast: { mode: 'linear', density: 0, start: 0, end: 2400, excludeSky: true },
  rainy: { mode: 'exp', density: 0.003, start: 0, end: 0, excludeSky: true },
  snowy: { mode: 'exp', density: 0.005, start: 0, end: 0, excludeSky: true },
  heavy: { mode: 'exp', density: 0.05, start: 0, end: 0, excludeSky: false },
  interior: { mode: 'exp', density: 0.001, start: 0, end: 0, excludeSky: false },
  dungeon: { mode: 'exp', density: 0.005, start: 0, end: 0, excludeSky: false },
});

const SNOW_FREE_CLIMATES = new Set([224, 225, 227, 229]);

export function isSnowFreeClimate(climateIndex) {
  return SNOW_FREE_CLIMATES.has(climateIndex);
}

/** SetWeather's fog choice per weather type. */
export function fogForWeather(weather) {
  switch (weather) {
    case 'overcast': return FOG_SETTINGS.overcast;
    case 'fog': return FOG_SETTINGS.heavy;
    case 'rain':
    case 'thunder': return FOG_SETTINGS.rainy;
    case 'snow': return FOG_SETTINGS.snowy;
    default: return FOG_SETTINGS.sunny; // sunny, cloudy
  }
}

/**
 * Sky archive offset for the weather (SkyIndex = SkyBase + offset).
 * Rain/fog/thunder pick Rain1/Rain2, snow picks Snow1/Snow2, 50/50.
 */
export function skyOffsetForWeather(weather, rng) {
  if (weather === 'rain' || weather === 'thunder' || weather === 'fog') {
    return rng.nextFloat() > 0.5 ? 4 : 5;
  }
  if (weather === 'snow') {
    return rng.nextFloat() > 0.5 ? 6 : 7;
  }
  return 0;
}

/** Verbatim SetSunlightScale: winter first, precipitation overrides. */
export function weatherSunlightScale(weather, isWinter) {
  let scale = 1;
  if (isWinter) scale = 0.65;
  if (weather === 'rain') scale = 0.45;
  else if (weather === 'thunder') scale = 0.25;
  else if (weather === 'snow') scale = 0.45;
  else if (weather === 'overcast' || weather === 'fog') scale = 0.65;
  return scale;
}

/** Fog window style (R2) applies for heavy-fog weather; else clock rules. */
export function windowStyleForWeather(weather) {
  return weather === 'fog' ? 'fog' : null;
}

/** Precipitation flags for the particles milestone. */
export function precipitationForWeather(weather) {
  if (weather === 'rain') return 'rain';
  if (weather === 'thunder') return 'storm';
  if (weather === 'snow') return 'snow';
  return null;
}

/**
 * Fog factor at a distance: 1 = clear, 0 = fully fogged. Linear is
 * Unity's (end - d) / (end - start); exponential is exp(-density * d).
 */
export function fogFactor(settings, distance) {
  if (settings.mode === 'linear') {
    if (settings.density === 0 && settings.end <= settings.start) return 1;
    const f = (settings.end - distance) / (settings.end - settings.start);
    return Math.max(0, Math.min(1, f));
  }
  return Math.exp(-settings.density * distance);
}

/** 50/50 rng for the sky variant, seedable for deterministic shots. */
export function weatherRng(seed = 1) {
  return new UMRandom((seed >>> 0) || 1);
}
