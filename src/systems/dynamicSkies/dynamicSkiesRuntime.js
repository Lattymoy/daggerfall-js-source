// DYNAMIC SKIES - THE INSTANCE (OWN-WORK4). One object the sky controller ticks: the weather's row walked on the
// game clock, the frame (dynamicSkies.js skyFrame), the world's fog rows and light curve while this sky is up, and the
// storm's flash. Pure - no GL, no DOM - so node runs it; the pass takes what tick() answers.

import {
  WEATHER_LOOK,
  FOG_LOOK,
  DYNAMIC_LIGHT_CURVE,
  SKY_EASE_MINUTES,
  SKY_JUMP_MINUTES,
  weatherRow,
  easeRow,
  skyFrame,
  phasesAt,
  seasonAt,
  fogSettingsFromPresets,
  fogPresetKey,
  LightningFlash,
  pixelSnowSettings,
} from './dynamicSkies.js';

export class DynamicSkies {
  /**
   * @param {object} assets our tables (dynamicSkiesAssets.js dynamicSkiesAssets): { weathers, fog, lightCurve }
   * @param {object} settings the Mods pane's values
   *   { densitySetting, ActivatePixelSnow, MinParticleSize, MaxParticleSize, MaxParticles }
   * @param {() => number} rng the flash's dice
   */
  constructor(assets = {}, settings = {}, rng = Math.random, { classicMinutes = null } = {}) {
    this.settings = settings;
    this.weathers = assets.weathers ?? WEATHER_LOOK;
    this.fogSettings = fogSettingsFromPresets(assets.fog ?? FOG_LOOK, settings.densitySetting ?? 1);
    this.lightCurve = assets.lightCurve ?? DYNAMIC_LIGHT_CURVE;
    this.pixelSnow = settings.ActivatePixelSnow ? pixelSnowSettings(settings) : null;
    this.lightningFlash = new LightningFlash(rng);
    this.lightningLight = null;
    this.playerInside = false;
    this.currentWeather = 'sunny';
    this.row = null;
    this.state = null;
    this.fogColor = null;
    this._sunDir = null;
    this._lastMinutes = null;
    this._whole = true;
    this.phases = classicMinutes === null ? null : phasesAt(classicMinutes);
  }

  /** A load or a jump: the next tick takes its weather's row whole. The word, when given, is taken at once. */
  weatherJump(weather) {
    this._whole = true;
    if (weather !== undefined) this.currentWeather = this.weathers[weather] ? weather : 'sunny';
  }

  /** The world's fog row for a weather while this sky is up. */
  fogSettingsFor(weather) {
    return this.fogSettings[fogPresetKey(weather)];
  }

  /** The flash listens while the sky's word is a thunderstorm and the player is out under it. */
  get lightningListening() {
    return this.currentWeather === 'thunder' && !this.playerInside;
  }

  /** An ambient effect played (AmbientEffects.onPlayEffect); `storm` is the host's word for whether it was a storm
   *  clip. One roll a clap, outside, under a thunderstorm. */
  onAmbientEffect(playerPos, storm = true) {
    if (!this.lightningListening || !storm) return false;
    return this.lightningFlash.startFlash(playerPos);
  }

  /** The door: going in stops every flash in flight and puts the light out; coming out listens again. */
  setInside(inside) {
    this.playerInside = !!inside;
    if (this.playerInside) {
      this.lightningFlash.stopAll();
      this.lightningLight = null;
    }
  }

  /**
   * One frame (exterior, playing).
   * @param {object} f { minuteOfDay, classicMinutes (the sky's clock), weather (the sky's word), seconds (real),
   *   dt (real seconds), weatherScale (the sun's weather scale), playerPos }
   * @returns the pass's state (dynamicSkies.js skyFrame)
   */
  tick(frame) {
    const minutes = frame.classicMinutes ?? 0;
    const word = this.weathers[frame.weather] ? frame.weather : 'sunny';
    const want = weatherRow(word, this.weathers);
    const dtMin = this._lastMinutes === null || minutes < this._lastMinutes ? null : minutes - this._lastMinutes;
    this._lastMinutes = minutes;
    if (this._whole || !this.row || dtMin === null || dtMin > SKY_JUMP_MINUTES) this.row = want;
    else this.row = easeRow(this.row, want, 1 - Math.exp(-dtMin / SKY_EASE_MINUTES));
    this._whole = false;
    this.currentWeather = word;
    this.phases = phasesAt(minutes);
    // the storm's flash first: its light for the land, its level for the sky
    this.lightningLight = this.playerInside ? null : this.lightningFlash.tick(frame.dt ?? 0, frame.playerPos ?? null);
    const state = skyFrame({
      minuteOfDay: frame.minuteOfDay,
      classicMinutes: minutes,
      row: this.row,
      season: seasonAt(minutes),
      seconds: frame.seconds ?? 0,
      weatherScale: frame.weatherScale ?? 1,
      phases: this.phases,
      lightCurve: this.lightCurve,
      flash: this.lightningLight ? this.lightningFlash.level : 0,
    });
    state.weather = word;
    this.state = state;
    this._sunDir = state.sunDir;
    this.fogColor = state.fogColor;
    return state;
  }

  /** Where a moon is now: 'masser' or 'secunda'. Null before the first frame. */
  moonDirection(which = 'masser') {
    return this.state?.[which]?.dir ?? null;
  }
}
