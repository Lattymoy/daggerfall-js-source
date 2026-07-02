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

/**
 * Storm lightning, verbatim AmbientEffectsPlayer.PlayLightningEffects:
 * a strike triggers every random.Next(4, 35) seconds; the clip class
 * sets the flash budget (StormLightningShort 4-8, StormLightningThunder
 * 5-10, StormThunderRoll 20-30 with the thunder delayed 1.7 s - sound
 * lands with the Audio arc, the class is exposed for it); each budget
 * slot is TWO frames: maybe-on (Random.value < 0.6 -> the sun light at
 * intensity 2) then off. Frame-quantized exactly as the coroutine's
 * WaitForEndOfFrame pairs. The commented-out SkyColorScale flash is
 * deprecated upstream and skipped. Engine randomness -> umRandom
 * (Port-Ledger A). At night the sun is disabled, so flashes are
 * invisible - verbatim (DFU only touches LightForEffects).
 */
export class LightningPlayer {
  constructor(seed = 1) {
    this._rng = new UMRandom((seed >>> 0) || 1);
    this._wait = this._nextWait();
    this._slots = 0;
    this._phase = 0; // 0 waiting, 1 in-sequence
    this._slotFrame = 0;
    this._on = false;
    this.lastClipClass = null; // 'short' | 'thunder' | 'roll' for audio
  }

  _int(min, max) { // random.Next semantics: max exclusive
    return min + Math.floor(this._rng.nextFloat() * (max - min));
  }

  _nextWait() {
    return this._int(4, 35);
  }

  /** Advance one rendered frame; returns the sun intensity multiplier. */
  tick(dtSeconds) {
    if (this._phase === 0) {
      this._wait -= dtSeconds;
      if (this._wait > 0) return 1;
      // Strike: pick the clip class and its flash budget.
      const pick = this._rng.nextFloat();
      let min;
      let max;
      if (pick < 1 / 3) {
        this.lastClipClass = 'short'; min = 4; max = 8;
      } else if (pick < 2 / 3) {
        this.lastClipClass = 'thunder'; min = 5; max = 10;
      } else {
        this.lastClipClass = 'roll'; min = 20; max = 30;
      }
      this._slots = this._int(min, max);
      this._phase = 1;
      this._slotFrame = 0;
    }
    // In sequence: even frames maybe-on, odd frames off.
    if (this._slotFrame % 2 === 0) {
      this._on = this._rng.nextFloat() < 0.6;
    } else {
      this._on = false;
    }
    this._slotFrame++;
    if (this._slotFrame >= this._slots * 2) {
      this._phase = 0;
      this._wait = this._nextWait();
    }
    return this._on ? 2 : 1;
  }
}

/** 50/50 rng for the sky variant, seedable for deterministic shots. */
export function weatherRng(seed = 1) {
  return new UMRandom((seed >>> 0) || 1);
}
