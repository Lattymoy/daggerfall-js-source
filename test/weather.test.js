import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEATHER_TYPES, FOG_SETTINGS, fogForWeather, skyOffsetForWeather,
  weatherSunlightScale, windowStyleForWeather, precipitationForWeather,
  isSnowFreeClimate, fogFactor, weatherRng,
} from '../src/world/weather.js';

const approx = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('weather: verbatim tables and SetWeather mapping', () => {
  assert.deepEqual(WEATHER_TYPES,
    ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow']);

  // FogSettings verbatim (WeatherManager defaults).
  assert.deepEqual(FOG_SETTINGS.sunny,
    { mode: 'linear', density: 0, start: 0, end: 2400, excludeSky: true });
  assert.deepEqual(FOG_SETTINGS.rainy,
    { mode: 'exp', density: 0.003, start: 0, end: 0, excludeSky: true });
  assert.deepEqual(FOG_SETTINGS.snowy,
    { mode: 'exp', density: 0.005, start: 0, end: 0, excludeSky: true });
  assert.deepEqual(FOG_SETTINGS.heavy,
    { mode: 'exp', density: 0.05, start: 0, end: 0, excludeSky: false });
  assert.deepEqual(FOG_SETTINGS.interior,
    { mode: 'exp', density: 0.001, start: 0, end: 0, excludeSky: false });
  assert.deepEqual(FOG_SETTINGS.dungeon,
    { mode: 'exp', density: 0.005, start: 0, end: 0, excludeSky: false });

  // SetWeather: Cloudy -> sunny fog; Fog -> heavy; Thunder -> rainy.
  assert.equal(fogForWeather('cloudy'), FOG_SETTINGS.sunny);
  assert.equal(fogForWeather('overcast'), FOG_SETTINGS.overcast);
  assert.equal(fogForWeather('fog'), FOG_SETTINGS.heavy);
  assert.equal(fogForWeather('rain'), FOG_SETTINGS.rainy);
  assert.equal(fogForWeather('thunder'), FOG_SETTINGS.rainy);
  assert.equal(fogForWeather('snow'), FOG_SETTINGS.snowy);

  // Snow-free climates: Desert 224, Desert2 225, Rainforest 227,
  // Subtropical 229.
  for (const c of [224, 225, 227, 229]) assert.equal(isSnowFreeClimate(c), true);
  for (const c of [223, 226, 228, 231]) assert.equal(isSnowFreeClimate(c), false);

  assert.equal(windowStyleForWeather('fog'), 'fog');
  assert.equal(windowStyleForWeather('rain'), null);
  assert.equal(precipitationForWeather('thunder'), 'storm');
  assert.equal(precipitationForWeather('snow'), 'snow');
  assert.equal(precipitationForWeather('overcast'), null);
});

test('weather: sky offsets and sunlight scales verbatim', () => {
  // WeatherStyle: Rain1 4 / Rain2 5 / Snow1 6 / Snow2 7; fog weather uses
  // the RAIN sky (SetRainOvercast inside the Fog case).
  const seen = new Set();
  const rng = weatherRng(1);
  for (let i = 0; i < 32; i++) {
    seen.add(skyOffsetForWeather('rain', rng));
    seen.add(skyOffsetForWeather('snow', rng));
    seen.add(skyOffsetForWeather('fog', rng));
  }
  assert.deepEqual([...seen].sort(), [4, 5, 6, 7]);
  assert.equal(skyOffsetForWeather('sunny', weatherRng(1)), 0);
  assert.equal(skyOffsetForWeather('overcast', weatherRng(1)), 0);
  // Deterministic per seed.
  assert.equal(
    skyOffsetForWeather('rain', weatherRng(7)),
    skyOffsetForWeather('rain', weatherRng(7)));

  // SetSunlightScale: winter first, precipitation overrides.
  approx(weatherSunlightScale('sunny', false), 1);
  approx(weatherSunlightScale('sunny', true), 0.65);
  approx(weatherSunlightScale('overcast', false), 0.65);
  approx(weatherSunlightScale('fog', false), 0.65);
  approx(weatherSunlightScale('rain', true), 0.45);
  approx(weatherSunlightScale('thunder', false), 0.25);
  approx(weatherSunlightScale('snow', true), 0.45);
});

test('weather: fog factor math', () => {
  // Linear (end - d) / (end - start), clamped; density-0 full-range is clear.
  approx(fogFactor(FOG_SETTINGS.sunny, 0), 1);
  approx(fogFactor(FOG_SETTINGS.sunny, 1200), 0.5);
  approx(fogFactor(FOG_SETTINGS.sunny, 2400), 0);
  approx(fogFactor(FOG_SETTINGS.sunny, 9000), 0);

  // Exponential exp(-density * d).
  approx(fogFactor(FOG_SETTINGS.heavy, 20), Math.exp(-1));
  approx(fogFactor(FOG_SETTINGS.rainy, 1000), Math.exp(-3));
  approx(fogFactor(FOG_SETTINGS.dungeon, 0), 1);
});
