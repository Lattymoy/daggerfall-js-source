// DYNAMIC SKIES - THE INSTANCE (DS1). BLBSkybox's MonoBehaviour life,
// as one object the sky controller ticks: Init's material and preset
// load, the OnWeatherChange event and its one-frame-late apply, the
// day-part machine, the moons' phases and orbits, _WorldTime, the fog
// colour every real second, and the LightningFlashListener. Pure - no
// GL, no DOM - so node runs it against the vendored presets; the
// renderer takes what tick() answers.
//
// The DFU objects it read are the port's: WorldTime.Now is the classic
// minute clock (systems/gameDate.dateFromClassicMinutes), WeatherManager
// is systems/weatherSim's word as the hosts hand it to the sky
// controller, SunLight's rotation is SunlightManager's formula
// (dynamicSkies.sunLightDirection) and AmbientEffectsPlayer.OnPlayEffect
// is AmbientEffects.onPlayEffect.

import {
  WEATHER_PRESET, parseSkyboxSetting, parseLightCurve, fogSettingsFromPresets, fogPresetKey,
  initMaterial, applySkyboxSettings, applyLunarPhases, moonDirection,
  DAY_PARTS, dayPartOfHour, weatherIndexOf, dayTimeOf,
  worldTimeSeconds, sunLightDirection, sunLightColor, fogColorNow, FOG_COLOR_INTERVAL_SECONDS,
  LightningFlash, windDirectionRoll, pixelSnowSettings, parseHtmlColor,
} from './dynamicSkies.js';
import { dateFromClassicMinutes } from './gameDate.js';

export class DynamicSkies {
  /**
   * @param {object} assets { presets: {SkyboxSunny: json, ...}, fogPresets:
   *   {FogSunny: json, ...}, lightCurve: json }
   * @param {object} settings the mod's modsettings values
   *   { densitySetting, ActivatePixelSnow, MinParticleSize, MaxParticleSize, MaxParticles }
   * @param {() => number} rng Unity's Random.value / Random.Range
   */
  constructor(assets, settings = {}, rng = Math.random) {
    this.rng = rng;
    this.settings = settings;
    // loadAllSkyboxSettings: one preset per WeatherType; the *Night.json
    // variants are not in the shipped manifest, so [1] is [0]
    this.skyboxSettings = {};
    for (const [weather, name] of Object.entries(WEATHER_PRESET)) {
      const s = parseSkyboxSetting(assets.presets[name]);
      this.skyboxSettings[weather] = [s, s];
    }
    // loadFogSettings / ProcessFogSetting: WeatherManager's five, replaced
    this.fogSettings = fogSettingsFromPresets(assets.fogPresets, settings.densitySetting ?? 1);
    // SetLightCurve: SunlightManager.LightCurve, replaced
    this.lightCurve = parseLightCurve(assets.lightCurve);
    // Init's material writes, then the vanilla sky is switched off
    this.mat = initMaterial(windDirectionRoll(rng));
    this.currentDayPart = DAY_PARTS.None;
    this.dayTime = false;
    this.hour = 0;
    this.minutes = 0;
    // Weather
    this.currentWeather = 'sunny';   // WeatherType.None == Sunny
    this.forceWeatherUpdate = true;
    this.pendingWeather = false;
    this.pendingWeatherType = 'sunny';
    this.pendingSkyboxSettings = null;
    this.pendingWindDirection = 0;
    this._seenWeather = null;
    // Lightning
    this.lightningFlash = new LightningFlash(rng);   // BLBSkybox.Start: flashDuration 0.2
    this.lightningListening = false;
    // Fog colour (RenderSettings.fogColor), sRGB
    this.fogColor = null;
    this.lastFogUpdate = null;
    this.playerInside = false;
    // InitSnow
    this.pixelSnow = settings.ActivatePixelSnow ? pixelSnowSettings(settings) : null;
    // Init: currentWeather = None, force, OnWeatherChange(None), SetFogDistance
    this.onWeatherChange('sunny');
    this.setFogDistance('sunny');
  }

  /** getWeatherIndex. */
  weatherIndex() { return weatherIndexOf(this.currentDayPart); }

  /** WeatherManager.OnWeatherChange -> BLBSkybox.OnWeatherChange (:534-574). */
  onWeatherChange(weather) {
    if (this.pendingWeather === true) return;
    if (weather !== this.currentWeather || this.forceWeatherUpdate === true) {
      this.forceWeatherUpdate = false;
      this.pendingWeatherType = weather;
      const index = this.weatherIndex();
      this.pendingWindDirection = windDirectionRoll(this.rng);
      this.pendingSkyboxSettings = (this.skyboxSettings[weather] ?? this.skyboxSettings.sunny)[index];
      this.pendingWeather = true;
      // the lightning listener follows the pending type
      if (this.pendingWeatherType === 'thunder') {
        if (!this.lightningListening) this.lightningListening = true;   // StartCoroutine(StartLightningEffect) -> StartListening
      } else if (this.lightningListening) {
        this.lightningListening = false;   // StopCoroutine + StopListening
      }
    }
  }

  /** ApplyPendingWeatherSettings (:587-595). */
  applyPendingWeatherSettings() {
    if (this.pendingWeather === true) {
      applySkyboxSettings(this.mat, this.pendingSkyboxSettings);
      this.currentWeather = this.pendingWeatherType;
      this.setFogColor(this.dayTime);
      this.setFogDistance(this.pendingWeatherType);
      this.pendingWeather = false;
    }
  }

  /** SetFogDistance (:1075-1091): _FogDistance from the preset (the
   *  apply just wrote the same), and WeatherManager's fog end distance,
   *  which the world takes from fogSettingsFor() anyway. */
  setFogDistance(weather) {
    const setting = this.skyboxSettings[weather] ?? this.skyboxSettings.sunny;
    this.mat._FogDistance = setting[this.weatherIndex()].FogDistance;
  }

  /** The world's fog row for a weather - the mod's WeatherManager
   *  settings, in the port's FOG_SETTINGS shape. */
  fogSettingsFor(weather) {
    return this.fogSettings[fogPresetKey(weather)];
  }

  /** setFogColor (:1036-1073): RenderSettings.fogColor and _FogColor
   *  from the current preset's FogDayColor and the sun's height. */
  setFogColor(_day) {
    const setting = this.skyboxSettings[this.currentWeather];
    if (!setting) return;
    const s = setting[this.weatherIndex()];
    this.mat._FogDayColor = parseHtmlColorOr(s.FogDayColor, this.mat._FogDayColor);
    const c = fogColorNow(s, this.mat._AtmosphereLerpDuration, this._sunDir?.[1] ?? 0);
    if (c) this.fogColor = c;
    if (this.fogColor) this.mat._FogColor = [this.fogColor[0], this.fogColor[1], this.fogColor[2], 1];
  }

  /** SaveLoadManager_OnLoad (:303-317): force the loaded weather through
   *  - `pendingWeather` is dropped so the OnWeatherChange guard cannot
   *  swallow it, then raised so the next Update applies it. Without a
   *  weather (the controller's jump, which does not carry the sim's
   *  word) the next tick forces whatever word it brings. */
  weatherJump(weather) {
    if (weather === undefined) { this._seenWeather = null; return; }
    this.forceWeatherUpdate = true;
    this.pendingWeather = false;
    this.onWeatherChange(weather);
    this.forceWeatherUpdate = false;
    this.pendingWeather = true;
  }

  /** LightningFlashListener.HandleOnPlayEffect: an ambient effect
   *  played; outside, under Thunder, the flash rolls. */
  onAmbientEffect(playerPos) {
    if (this.playerInside) return;
    if (!this.lightningListening) return;
    return this.lightningFlash.startFlash(playerPos);
  }

  /** InteriorTransitionEvent / ExteriorTransitionEvent. */
  setInside(inside) {
    this.playerInside = !!inside;
    if (inside && this.pendingWeatherType === 'thunder') {
      this.lightningListening = false;
      this.lightningFlash.stopAll();
    } else if (!inside && this.pendingWeatherType === 'thunder') {
      this.lightningListening = true;
    }
  }

  /**
   * BLBSkybox.Update for one frame (exterior, playing).
   * @param {object} f { minuteOfDay, classicMinutes, weather, seconds (real, monotonic),
   *   dt (real seconds), weatherScale (WeatherManager's sunlight ScaleFactor), playerPos }
   * @returns the renderer's state
   */
  tick(f) {
    const dt = f.dt ?? 0;
    // The WeatherManager event, as the sim's word changes. THE FIRST
    // word (and the word after a jump) is a LOAD: Init leaves its own
    // Sunny apply pending, and OnWeatherChange's `if (pendingWeather)
    // return` swallows any event that lands in that window - in DFU it
    // is SaveLoadManager_OnLoad, firing after Init with the save's
    // weather and dropping the pending flag first, that puts the real
    // weather on the sky. The port has no save event on the sky's
    // frame; the first tick's word is the loaded one and takes that arm.
    if (this._seenWeather === null) {
      this._seenWeather = f.weather;
      this.weatherJump(f.weather);
    } else if (f.weather !== this._seenWeather) {
      this._seenWeather = f.weather;
      this.onWeatherChange(f.weather);
    }
    const minuteOfDay = f.minuteOfDay;
    this._sunDir = sunLightDirection(minuteOfDay);
    if (this.lastFogUpdate === null || f.seconds - this.lastFogUpdate >= FOG_COLOR_INTERVAL_SECONDS) {
      this.setFogColor(this.dayTime);
      this.lastFogUpdate = f.seconds;
    }
    this.hour = Math.floor(((minuteOfDay % 1440) + 1440) % 1440 / 60);
    this.minutes = Math.floor(((minuteOfDay % 1440) + 1440) % 1440 % 60);
    this.forceWeatherUpdate = true;
    const part = dayPartOfHour(this.hour);
    if (part !== DAY_PARTS.None && part !== this.currentDayPart) {
      // each arm: dayTime, OnWeatherChange(currentWeather), currentDayPart
      // (Dawn/DawnEnd/Dusk/DuskEnd also call HandleDawnDusk, which returns)
      this.dayTime = dayTimeOf(part);
      this.currentDayPart = part;
      this.onWeatherChange(this.currentWeather);
    }
    const date = dateFromClassicMinutes(f.classicMinutes ?? 0);
    this.phases = applyLunarPhases(this.mat, date);
    this.mat._WorldTime = worldTimeSeconds(minuteOfDay);
    this.applyPendingWeatherSettings();
    // the lightning light (LightningFlash's coroutines)
    this.lightningLight = this.lightningFlash.tick(dt);
    const lightColor = sunLightColor(minuteOfDay, this.lightCurve, f.weatherScale ?? 1);
    return {
      mat: this.mat,
      sunDir: this._sunDir,
      lightColor,
      clearColor: this.fogColor ?? [0, 0, 0],
      fogColor: this.fogColor,
      weather: this.currentWeather,
      phases: this.phases,
    };
  }

  /** Where a moon is now, on the CPU twin of the shader's orbit. */
  moonDirection(which = 'Moon') {
    return moonDirection(this.mat, which);
  }
}

function parseHtmlColorOr(hex, fallback) {
  return parseHtmlColor(hex) ?? fallback;
}
