// DYNAMIC SKIES - OUR OWN SKY (OWN-WORK4, 2026-10-31, the owner: "Our goal is no latching onto other mod authors or
// needing permissions. A proper 1 to 1 recreation for everything"). DS1 (2026-09-04) carried BadLuckBurt and
// carademono's mod; OWN-WORK4 retired vendor/dynamic-skies and drew the sky again as ours (bible/07-Rendering/
// Dynamic-Skies.md OWN-WORK4). Pinned here, as literals: the preset rule's tables (the hours, the weathers, the seasons,
// the moons, the stars, the clouds, the fog rows, the light curve), what the rule makes of them, the painted noise
// and flake, the instance's clock and storm, the shader run whole in test/glsl.mjs, and the seam - the switch, the
// settings and every place the sky is wired - unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SKY_HOURS, WEATHER_LOOK, WEATHER_PRESET, SEASON_LEAN, SUN_LOOK, MOON_LOOK, STAR_LOOK, CLOUD_LOOK, SKY_LEVELS,
  SKY_EASE_MINUTES, SKY_JUMP_MINUTES, LIGHT_RULE, DYNAMIC_LIGHT_CURVE, FOG_LOOK, FOG_PRESET_FOR_WEATHER,
  TEXTURE_SLOTS, TEXTURE_IMPORTS, SLOT_DEFAULT_TEXEL, MAX_DELTA_SECONDS,
  srgbToLinear, linearToSrgb, hexLinear, toSrgb3, luminance, weatherRow, easeRow, weatherShow, hourAt, nightWeight, moonNightWeight,
  phasesAt, moonPhaseLight, skyFrame, fogSettingsFromPresets, fogPresetKey, sunLightDirection, sunCurveTime,
  StormFlash, FLASH_LOOK, strokeLevel, pixelSnowSettings,
} from '../../src/systems/dynamicSkies/dynamicSkies.js';
import { DynamicSkies } from '../../src/systems/dynamicSkies/dynamicSkiesRuntime.js';
import { DYNAMIC_SKIES_TEXTURES, SKY_NOISE_CHANNELS, dynamicSkiesAssets, paintSkyNoise, paintSnowflake, loadDynamicSkiesTexture, dynamicSkiesTextureUrl } from '../../src/systems/dynamicSkies/dynamicSkiesAssets.js';
import { FS, UNIFORM_NAMES, DynamicSkiesRenderer } from '../../src/render/dynamicSkiesRenderer.js';
import { dynamicMoonState } from '../../src/render/dynamicSkiesBridge.js';
import { moonSkyDirection, MOONS, STAR_POLE } from '../../src/render/enhancedSky.js';
import { BAYER_MEAN } from '../../src/render/orderedDither.js';   // PS3: the zero-mean Bayer offset
import { SEASONS, MINUTES_PER_DAY, lunarPhaseFractionsFromMinutes } from '../../src/systems/gameDate.js';
import { evaluateCurve, daylightScale, setLightCurve } from '../../src/world/worldClock.js';
import { fogForWeather, fogFactor } from '../../src/world/weather.js';
import { MOD_SETTINGS, modSetting, setModSetting, modSettingsOf, isIntKey, _resetModSettings } from '../../src/systems/modSettings.js';
import { AmbientEffects } from '../../src/systems/ambientEffects.js';
import { Renderer } from '../../src/render/renderer.js';
import { PrecipitationRenderer } from '../../src/render/precipitation.js';   // OWN-WORK4: the pixel snow's count
import { glslFunctions } from '../glsl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const BASE = 405 * 360 * MINUTES_PER_DAY + 10 * MINUTES_PER_DAY;
const WEATHERS = Object.keys(WEATHER_LOOK);

// ── RETIRED ───────────────────────────────────────────────────────
test('OWN-WORK4: vendor/dynamic-skies is gone, nothing reads it, and the sky\'s pictures are painted by our own code', () => {
  assert.equal(existsSync(join(root, 'vendor/dynamic-skies')), false, 'the directory is retired (01-Overview/Own-Work.md)');
  for (const f of ['src/systems/dynamicSkies/dynamicSkies.js', 'src/systems/dynamicSkies/dynamicSkiesRuntime.js', 'src/systems/dynamicSkies/dynamicSkiesAssets.js',
    'src/render/dynamicSkiesRenderer.js', 'src/render/dynamicSkiesBridge.js', 'src/scenes/shared.js', 'src/tools/skyLab.js']) {
    const s = read(f);
    assert.doesNotMatch(s, /vendor\/dynamic-skies/, `${f} names no vendored path`);
    assert.doesNotMatch(s, /import\.meta\.glob/, `${f} globs nothing`);
  }
  assert.deepEqual([...DYNAMIC_SKIES_TEXTURES], ['PixelSnow', 'SkyNoise'], 'two pictures, both painted');
  assert.deepEqual(Object.keys(TEXTURE_IMPORTS), ['SkyNoise']);
  assert.deepEqual([...TEXTURE_SLOTS], ['uSkyNoise'], 'the pass samples our noise alone');
  assert.deepEqual([...SLOT_DEFAULT_TEXEL.uSkyNoise], [128, 128, 128, 128], 'the noise\'s middle until it is painted');
  // the retired mod's preset words and shader names are not ours to carry
  const law = read('src/systems/dynamicSkies/dynamicSkies.js') + read('src/render/dynamicSkiesRenderer.js');
  for (const gone of ['CdMSunny', 'VanillaStars', 'PixelMars', 'BLBProceduralSkybox', '_CloudTopColorBoost', 'MATERIAL_DEFAULTS', 'Scattering', 'kSUN_BRIGHTNESS']) {
    assert.ok(!law.includes(gone), `${gone} is the retired mod's, not ours`);
  }
});

// ── THE PRESET RULE, AS LITERALS ──────────────────────────────────
test('OWN-WORK4 the hours: five anchors on the sun\'s height, navy to blue through an orange horizon - the table as written', () => {
  assert.deepEqual(SKY_HOURS.map((a) => ({ ...a })), [
    { h: -0.3, zenith: '#02050c', horizon: '#060b18', glow: '#000000', glowAmount: 0, sun: '#000000', light: 0.03 },
    { h: -0.12, zenith: '#0a1430', horizon: '#232d4e', glow: '#46304a', glowAmount: 0.35, sun: '#000000', light: 0.1 },
    { h: 0, zenith: '#1e3672', horizon: '#d8844e', glow: '#ff8a3e', glowAmount: 1, sun: '#ffb06a', light: 0.45 },
    { h: 0.16, zenith: '#2c5aa6', horizon: '#e4b68c', glow: '#ffc88c', glowAmount: 0.7, sun: '#ffe0b0', light: 0.8 },
    { h: 0.42, zenith: '#2862b8', horizon: '#a0c2e4', glow: '#fff0d8', glowAmount: 0.35, sun: '#fff8ee', light: 1 },
  ]);
  // walked linearly between anchors, held past the ends
  const mid = hourAt(0.08);
  for (let k = 0; k < 3; k++) assert.ok(near(mid.zenith[k], (hexLinear('#1e3672')[k] + hexLinear('#2c5aa6')[k]) / 2, 1e-12));
  assert.deepEqual(hourAt(-1).zenith, hexLinear('#02050c'));
  assert.deepEqual(hourAt(1).horizon, hexLinear('#a0c2e4'));
  // the rule's words, held: the day horizon is the zenith lifted toward white; the sunset horizon warmer than blue
  const day = SKY_HOURS[4], sunset = SKY_HOURS[2];
  assert.ok(luminance(hexLinear(day.horizon)) > luminance(hexLinear(day.zenith)) * 2, 'the day horizon is lifted toward white');
  const sh = hexLinear(sunset.horizon);
  assert.ok(sh[0] > sh[2] * 2, 'the sun on the horizon: an orange horizon');
  // the warm band - LONGER SUNRISES AND SUNSETS: from 7 degrees under to 9 over, about an hour and ten minutes a side
  assert.ok(near(Math.asin(-0.12) * 180 / Math.PI, -6.89, 0.01) && near(Math.asin(0.16) * 180 / Math.PI, 9.21, 0.01));
});

test('OWN-WORK4 the weathers: one cover and one grey each - snow pale, the storm slate, the sandstorm ochre, the ashfall brown; every word the sim says has its own row', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(WEATHER_LOOK).map(([k, v]) => [k, { ...v }])), {
    sunny: { cover: 0.1, grey: '#a4aeb8' },
    cloudy: { cover: 0.45, grey: '#a4aeb8' },
    overcast: { cover: 0.8, grey: '#8e969f' },
    fog: { cover: 0.92, grey: '#b0b5b9' },
    rain: { cover: 0.85, grey: '#737e8a' },
    thunder: { cover: 0.95, grey: '#4e5866' },
    snow: { cover: 0.85, grey: '#c8d0da' },
    sandstorm: { cover: 0.92, grey: '#b88e5e' },
    ashfall: { cover: 0.9, grey: '#72645c' },
  });
  for (const w of WEATHERS) assert.equal(WEATHER_PRESET[w], w, `${w} wears its own row`);
  const ochre = hexLinear(WEATHER_LOOK.sandstorm.grey), ash = hexLinear(WEATHER_LOOK.ashfall.grey);
  assert.ok(ochre[0] > ochre[2] * 1.5 && ash[0] > ash[2], 'the desert\'s and the ash\'s skies are warm, not the rain\'s blue');
  // the rule: what shows through is (1 - c^2)^2
  assert.ok(near(weatherShow(0.1), 0.9801, 1e-12));
  assert.ok(near(weatherShow(0.95), (1 - 0.9025) ** 2, 1e-12));
  // an unknown word is the sunny row, and an eased row walks each number
  assert.deepEqual(weatherRow('blizzard'), weatherRow('sunny'));
  const half = easeRow(weatherRow('sunny'), weatherRow('thunder'), 0.5);
  assert.ok(near(half.cover, 0.525, 1e-12));
  assert.deepEqual(easeRow(weatherRow('sunny'), weatherRow('thunder'), 2), weatherRow('thunder'), 'k is held to 0..1');
});

test('OWN-WORK4 what the rule makes: clear noon blue, a storm darker and greyer, a night dark, the sun\'s disc and the stars by the cover; the seasons lean the clear day and leave the night', () => {
  const at = (weather, minute, season = SEASONS.Spring) => skyFrame({ minuteOfDay: minute, classicMinutes: BASE + minute, row: weatherRow(weather), season });
  const noon = at('sunny', 720), storm = at('thunder', 720), night = at('sunny', 0), dusk = at('sunny', 18 * 60);
  assert.ok(noon.zenith[2] > noon.zenith[0] * 2, 'a clear noon\'s zenith is blue');
  assert.ok(luminance(storm.horizon) < luminance(noon.horizon) * 0.6, 'a storm\'s horizon is darker');
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
  assert.ok(sat(toSrgb3(storm.zenith)) < sat(toSrgb3(noon.zenith)) / 2, 'and greyer');
  assert.ok(luminance(night.zenith) < 0.003, 'midnight is dark');
  assert.ok(dusk.horizon[0] > dusk.horizon[2], 'the sun on the horizon warms it');
  assert.equal(noon.night, 0, 'no stars at noon');
  assert.ok(near(night.night, nightWeight(-1) * weatherShow(0.1), 1e-12) && night.night > 0.9, 'a clear midnight\'s stars');
  assert.ok(at('thunder', 0).night < 0.02, 'a storm\'s night hides them');
  assert.ok(near(noon.sunDisc[0] / storm.sunDisc[0], weatherShow(0.1) / weatherShow(0.95), 1e-9), 'the disc by what shows through');
  assert.ok(near(noon.sunCos, Math.cos(SUN_LOOK.radius), 1e-15));
  // the night weight: none 3 degrees under, whole 11 under; the world's moonlight a degree either side of the line
  assert.equal(nightWeight(-0.05), 0); assert.equal(nightWeight(-0.19), 1);
  assert.equal(moonNightWeight(0.02), 0); assert.equal(moonNightWeight(-0.02), 1);
  // the seasons: summer's zenith deeper than winter's at noon; the night untouched within the light's share
  const summer = at('sunny', 720, SEASONS.Summer), winter = at('sunny', 720, SEASONS.Winter), fall = at('sunny', 720, SEASONS.Fall);
  assert.ok(winter.zenith[0] > summer.zenith[0] && luminance(winter.zenith) > luminance(summer.zenith), 'winter paler');
  assert.ok(fall.horizon[0] - fall.horizon[2] > noon.horizon[0] - noon.horizon[2], 'autumn golden at the horizon');
  const nightSummer = at('sunny', 0, SEASONS.Summer);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(nightSummer.zenith[k] - night.zenith[k]) < 0.002, 'a night stays a night');
  assert.deepEqual(Object.keys(SEASON_LEAN).map(Number).sort(), [SEASONS.Fall, SEASONS.Spring, SEASONS.Summer, SEASONS.Winter]);
  // TAMRIEL-WIDE: the frame takes no place - the season is the calendar's, the same in every province
  assert.doesNotMatch(read('src/systems/dynamicSkies/dynamicSkies.js'), /\b(worldPixelKey|worldPixelOk|worldPlaces|areaAt|inBay|climateIndex|MapsFile)\b/, 'no rule of the sky reads a place');
});

test('OWN-WORK4 the moons, the stars and the clouds: the tables as written, the moons where the dome puts them, the phase lit from the sun\'s side', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(MOON_LOOK)), { masser: { radius: 0.06, color: '#e2a890' }, secunda: { radius: 0.032, color: '#e3e5ea' }, dayFade: 0.9, earthshine: 0.05 });
  assert.deepEqual(JSON.parse(JSON.stringify(STAR_LOOK)), {
    bright: { cells: 110, chance: 0.12, gain: [0.55, 1] }, dim: { cells: 300, chance: 0.14, gain: [0.12, 0.4] },
    size: 0.11, twinkle: 0.3, band: 0.025, bandPole: [0.3, 0.45, -0.84],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(CLOUD_LOOK)), {
    low: { scale: 0.35, speed: 1 / 300, dir: [1, 0.35] }, high: { scale: 0.15, speed: 1 / 900, dir: [1, -0.1] },
    soft: 0.12, white: '#f2efe8', nightLit: '#151b29', nightShade: '#0a0d15',
  });
  assert.deepEqual({ ...SUN_LOOK }, { radius: 0.035, gain: 2.4 });
  assert.equal(SKY_LEVELS, 48);
  // the moons stand where the port's own dome puts them, on the clock's phase fraction
  const minute = 23 * 60, cm = BASE + 20 * MINUTES_PER_DAY + minute;
  const st = skyFrame({ minuteOfDay: minute, classicMinutes: cm });
  const ph = lunarPhaseFractionsFromMinutes(cm);
  assert.deepEqual(st.masser.dir, moonSkyDirection(minute, ph.masser, MOONS.masser.tilt));
  assert.deepEqual(st.secunda.dir, moonSkyDirection(minute, ph.secunda, MOONS.secunda.tilt));
  assert.deepEqual(phasesAt(cm), { masser: { phase: ph.masser }, secunda: { phase: ph.secunda } });
  // the phase's light: from behind at new, from the eye at full, from the sun's side at a half - waxing or waning
  const m = [0, 0.6, 0.8], sun = [1, 0, 0];
  const toEye = m.map((v) => -v), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  assert.ok(near(dot(moonPhaseLight(m, sun, 0), toEye), -1, 1e-12), 'new: lit from behind');
  assert.ok(near(dot(moonPhaseLight(m, sun, 4), toEye), 1, 1e-12), 'full: lit from the eye');
  for (const half of [2, 6]) {
    const l = moonPhaseLight(m, sun, half);
    assert.ok(Math.abs(dot(l, toEye)) < 1e-12 && dot(l, sun) > 0.99, `a half (${half}): lit across, the limb toward the sun`);
  }
  // the stars turn once a day about the dome's own pole; the clouds drift on the clock, wrapped
  assert.equal(st.starPole, STAR_POLE);
  assert.ok(near(st.starTurn, (minute / 1440) * Math.PI * 2, 1e-12));
  assert.ok(st.cloudOffset.every((v) => v >= 0 && v < 1), 'the drift wrapped to the texture\'s period');
  const later = skyFrame({ minuteOfDay: minute + 30, classicMinutes: cm + 30 });
  assert.ok(near(((later.cloudOffset[2] - st.cloudOffset[2]) % 1 + 1) % 1, (30 * CLOUD_LOOK.low.speed) % 1, 1e-6), 'the low layer travels its speed a game minute');
  // the layers' share of the sky is the cover: the low c, the high 0.3 (1 - c); opaque by c - the high layer's sliver
  // through a deck faded out (OWN-WORK4: a thin cut read as scratches over an overcast sky)
  const storm = skyFrame({ minuteOfDay: 720, row: weatherRow('thunder') });
  assert.deepEqual(storm.cloudLow, [0.95, 0.6 + 0.4 * 0.95, CLOUD_LOOK.low.scale, CLOUD_LOOK.soft]);
  assert.ok(near(storm.cloudHigh[0], 0.3 * 0.05, 1e-12) && storm.cloudHigh[1] === 0);
  const high = (w) => skyFrame({ minuteOfDay: 720, row: weatherRow(w) }).cloudHigh[1];
  assert.deepEqual([high('sunny'), high('cloudy')], [0.55, 0.55], 'a clear or cloudy sky keeps its high streaks whole');
  assert.deepEqual([high('overcast'), high('rain'), high('fog')], [0, 0, 0], 'an overcast, rain or fog sky none');
  const between = skyFrame({ minuteOfDay: 720, row: { ...weatherRow('cloudy'), cover: 0.6 } }).cloudHigh[1];
  assert.ok(between > 0.2 && between < 0.4, `part faded at 12% of the sky: ${between}`);
});

test('OWN-WORK4 the world under the sky: its light curve is the rule\'s, and its fog rows half the light at their d50, thickened by the slider (mutants: the slider\'s law; a row\'s mode)', () => {
  assert.deepEqual({ ...LIGHT_RULE }, { peak: 0.92, power: 0.6 });
  const rule = (t) => 0.92 * Math.pow(Math.sin(Math.PI * t), 0.6);
  assert.equal(DYNAMIC_LIGHT_CURVE[0][1], 0); assert.ok(near(DYNAMIC_LIGHT_CURVE.at(-1)[1], 0, 1e-12));
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) assert.ok(Math.abs(evaluateCurve(DYNAMIC_LIGHT_CURVE, t) - rule(t)) < 0.02, `the curve at ${t} is the rule's`);
  assert.ok(near(evaluateCurve(DYNAMIC_LIGHT_CURVE, 0.5), 0.92, 1e-12), 'noon is the peak');
  const rig = daylightScale(17 * 60 + 30);
  setLightCurve(DYNAMIC_LIGHT_CURVE);
  try {
    assert.ok(daylightScale(17 * 60 + 30) > rig * 1.5, `the longer sunset: at 17:30 ${daylightScale(17 * 60 + 30).toFixed(3)} against the rig's ${rig.toFixed(3)}`);
    assert.equal(daylightScale(0), 0);
  } finally { setLightCurve(null); }
  assert.deepEqual(JSON.parse(JSON.stringify(FOG_LOOK)), {
    sunny: { mode: 'linear', start: 1200, end: 4800, excludeSky: true },
    overcast: { mode: 'linear', start: 600, end: 3600, excludeSky: true },
    rainy: { mode: 'exp2', d50: 700, excludeSky: true },
    snowy: { mode: 'exp2', d50: 450, excludeSky: true },
    heavy: { mode: 'exp2', d50: 120, excludeSky: false },
    sandstorm: { mode: 'exp2', d50: 90, excludeSky: false },
    ashfall: { mode: 'exp2', d50: 400, excludeSky: true },
  });
  const one = fogSettingsFromPresets(FOG_LOOK, 1);
  for (const [name, row] of Object.entries(FOG_LOOK)) {
    if (row.mode === 'exp2') assert.ok(near(fogFactor(one[name], row.d50), 0.5, 1e-9), `${name}: half the light at ${row.d50}`);
    else assert.deepEqual([one[name].start, one[name].end], [row.start, row.end]);
  }
  const ten = fogSettingsFromPresets(FOG_LOOK, 10);
  assert.ok(near(ten.heavy.density, one.heavy.density * 4, 1e-12), 'the slider\'s top is four times as thick');
  assert.ok(near(ten.sunny.end, 1200, 1e-9), 'a linear row closes four times as near');
  assert.deepEqual(fogSettingsFromPresets(FOG_LOOK, 14), ten, 'the slider is held to 1..10');
  // every word the sim says takes a row, through the world's own reader
  assert.deepEqual({ ...FOG_PRESET_FOR_WEATHER }, { sunny: 'sunny', cloudy: 'sunny', overcast: 'overcast', fog: 'heavy', rain: 'rainy', thunder: 'rainy', snow: 'snowy', sandstorm: 'sandstorm', ashfall: 'ashfall' });
  for (const w of WEATHERS) assert.equal(fogForWeather(w, one), one[fogPresetKey(w)], `${w}: world/weather.js fogForWeather reads the sky's row`);
});

// ── THE PICTURES ──────────────────────────────────────────────────
test('OWN-WORK4 the painted noise: three channels, each tiling and equalized (a cut at 1 - c covers c), the same bytes every time; the flake six-armed and premultiplied', async () => {
  assert.deepEqual(SKY_NOISE_CHANNELS.map((c) => ({ ...c })), [
    { seed: 11, cells: 4, octaves: 5, billow: false },
    { seed: 23, cells: 8, octaves: 5, billow: false },
    { seed: 37, cells: 3, octaves: 4, billow: true },
  ]);
  const a = paintSkyNoise(), b = paintSkyNoise();
  assert.deepEqual(a.data, b.data, 'deterministic');
  assert.equal(a.width, 256); assert.equal(a.height, 256);
  for (let k = 0; k < 3; k++) {
    const quarter = [0, 0, 0, 0];
    let edge = 0;
    for (let i = 0; i < 256 * 256; i++) quarter[a.data[i * 4 + k] >> 6]++;
    for (const q of quarter) assert.ok(Math.abs(q - 16384) < 200, `channel ${k}: a quarter of the texture in each quarter of its range (${quarter})`);
    // PIN MOVED (OWN-WORK4 AUDIT): the seam is no larger a step than the texture's own largest between neighbours (the
    // turned octaves are finer than the old bound of 24 assumed)
    let inner = 0;
    const rows = [], cols = [];
    for (let x = 0; x < 256; x++) {
      edge = Math.max(edge, Math.abs(a.data[x * 4 + k] - a.data[(255 * 256 + x) * 4 + k]), Math.abs(a.data[x * 256 * 4 + k] - a.data[(x * 256 + 255) * 4 + k]));
      let r = 0, c = 0;
      for (let y = 0; y < 256; y++) {
        const dy = Math.abs(a.data[(((x + 1) % 256) * 256 + y) * 4 + k] - a.data[(x * 256 + y) * 4 + k]);
        const dx = Math.abs(a.data[(y * 256 + ((x + 1) % 256)) * 4 + k] - a.data[(y * 256 + x) * 4 + k]);
        if (y < 255) inner = Math.max(inner, dy, dx);
        r += dy; c += dx;
      }
      rows.push(r); cols.push(c);
    }
    assert.ok(edge <= inner, `channel ${k} tiles: the far edge meets the near (${edge}, its own steps up to ${inner})`);
    // OWN-WORK4 AUDIT: no lattice crease - no row or column of the texture flat against the rest (aligned octaves made
    // lines a lit cloud showed as streaks)
    const median = (v) => [...v].sort((p, q) => p - q)[128];
    assert.ok(Math.min(...rows) > median(rows) / 3 && Math.min(...cols) > median(cols) / 3, `channel ${k}: no crease`);
  }
  for (let i = 3; i < a.data.length; i += 4) assert.equal(a.data[i], 255);
  const flake = paintSnowflake();
  let ink = 0;
  for (let i = 0; i < flake.data.length; i += 4) {
    if (flake.data[i + 3] === 0) assert.deepEqual([...flake.data.subarray(i, i + 3)], [0, 0, 0], 'a clear texel is black, for the premultiplied blend');
    else ink++;
  }
  assert.ok(ink > 400 && ink < 1600, `a flake, not a blot (${ink} texels)`);
  // six arms: the flake is close to itself turned a sixth of a turn
  let same = 0, inked = 0;
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
    if (!flake.data[(j * 64 + i) * 4 + 3]) continue;
    inked++;
    const x = i - 31.5, y = j - 31.5, c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
    const ri = Math.round(x * c - y * s + 31.5), rj = Math.round(x * s + y * c + 31.5);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ri + di, jj = rj + dj;
      if (ii >= 0 && jj >= 0 && ii < 64 && jj < 64 && flake.data[(jj * 64 + ii) * 4 + 3]) { same++; dj = 2; break; }
    }
  }
  assert.ok(same / inked > 0.95, `six-fold (${(same / inked).toFixed(3)})`);
  // the pass's door: a painted texture, a name we do not paint refused; the snow's URL needs a canvas
  const tex = await loadDynamicSkiesTexture('SkyNoise');
  assert.equal(tex.width, 256);
  await assert.rejects(loadDynamicSkiesTexture('CdMSunny'), /no texture named CdMSunny/);
  assert.equal(dynamicSkiesTextureUrl('PixelSnow'), null, 'node has no canvas');
  assert.deepEqual(dynamicSkiesAssets(), { weathers: WEATHER_LOOK, fog: FOG_LOOK, lightCurve: DYNAMIC_LIGHT_CURVE });
});

// ── THE INSTANCE ──────────────────────────────────────────────────
test('OWN-WORK4 the instance: the first word whole, a new word walked on the game clock, a jump or a clock gone back whole; the fog rows, the light curve and the phases its own', () => {
  const d = new DynamicSkies(dynamicSkiesAssets(), { densitySetting: 4 }, () => 0.25);
  assert.equal(d.currentWeather, 'sunny');
  assert.equal(d.phases, null, 'no clock, no phases until the first frame');
  assert.deepEqual(d.fogSettings, fogSettingsFromPresets(FOG_LOOK, 4), 'the slider\'s rows');
  assert.equal(d.lightCurve, DYNAMIC_LIGHT_CURVE);
  assert.equal(d.pixelSnow, null, 'ActivatePixelSnow off');
  const frame = (minute, weather, extra = {}) => d.tick({ minuteOfDay: minute % 1440, classicMinutes: BASE + minute, weather, seconds: minute, dt: 1 / 60, weatherScale: 1, ...extra });
  const st = frame(720, 'rain');
  assert.equal(st.weather, 'rain');
  assert.deepEqual(d.row, weatherRow('rain'), 'the first word is a load: whole');
  assert.deepEqual(st.sunDir.map((v) => Math.round(v * 1e6) / 1e6), [0, 1, 0]);
  assert.deepEqual(st.clearColor, st.fogColor, 'the sky publishes its fog colour as the horizon the world fogs to');
  assert.equal(d.fogColor, st.fogColor);
  assert.equal(d.state, st);
  assert.deepEqual(d.phases, phasesAt(BASE + 720));
  assert.deepEqual(d.moonDirection('masser'), st.masser.dir);
  assert.equal(d.fogSettingsFor('thunder'), d.fogSettings.rainy);
  // a new word walks: SKY_EASE_MINUTES of game time is 1 - 1/e of the way
  assert.equal(SKY_EASE_MINUTES, 3); assert.equal(SKY_JUMP_MINUTES, 60);
  frame(720 + SKY_EASE_MINUTES, 'sunny');
  assert.ok(near(d.row.cover, 0.85 + (0.1 - 0.85) * (1 - Math.exp(-1)), 1e-12), 'one ease span: 1 - 1/e of the way');
  frame(720 + SKY_EASE_MINUTES, 'thunder');
  const held = d.row.cover;
  frame(720 + SKY_EASE_MINUTES, 'thunder');
  assert.equal(d.row.cover, held, 'a stopped clock holds the sky');
  frame(720 + 200, 'thunder');
  assert.deepEqual(d.row, weatherRow('thunder'), 'a jump past an hour: whole');
  frame(700, 'snow');
  assert.deepEqual(d.row, weatherRow('snow'), 'a clock gone back: whole');
  frame(701, 'sunny');
  d.weatherJump();
  frame(702, 'fog');
  assert.deepEqual(d.row, weatherRow('fog'), 'a load (weatherJump): whole');
  frame(703, 'blizzard');
  assert.equal(d.currentWeather, 'sunny', 'a word the sky does not know wears the clear sky');
  // phases with a clock at birth
  assert.deepEqual(new DynamicSkies({}, {}, Math.random, { classicMinutes: BASE }).phases, phasesAt(BASE));
  assert.deepEqual(new DynamicSkies({}, { ActivatePixelSnow: true, MinParticleSize: 200 }).pixelSnow, pixelSnowSettings({ MinParticleSize: 200 }));
});

test('OWN-WORK4 the storm: the flash listens under a thunderstorm out of doors, rolls once a storm clap, and the door puts it out', () => {
  const d = new DynamicSkies({}, {}, () => 0.25);
  const frame = (weather, dt = 1 / 60) => d.tick({ minuteOfDay: 720, classicMinutes: BASE + 720, weather, seconds: 0, dt, weatherScale: 1, playerPos: [1, 2, 3] });
  frame('rain');
  assert.equal(d.lightningListening, false, 'rain: no flash');
  assert.equal(d.onAmbientEffect([1, 2, 3]), false);
  frame('thunder');
  assert.equal(d.lightningListening, true);
  assert.equal(d.onAmbientEffect([1, 2, 3], false), false, 'a clip that is not the storm\'s rolls nothing');
  let rolls = 0;
  const startFlash = d.lightningFlash.startFlash.bind(d.lightningFlash);
  d.lightningFlash.startFlash = (p) => { rolls++; return startFlash(p); };
  assert.equal(d.onAmbientEffect([1, 2, 3]), true, '0.25 under 0.5: a flash');
  assert.equal(rolls, 1, 'one roll a clap');
  frame('thunder', 0.01);
  assert.ok(d.lightningLight && d.lightningLight.range >= 500 && d.lightningLight.range <= 1000, 'lit');
  d.setInside(true);
  assert.equal(d.lightningLight, null, 'the door puts the light out');
  assert.equal(d.lightningFlash._routines.length, 0, 'and stops the routine');
  assert.equal(d.lightningListening, false, 'nothing rolls indoors');
  assert.equal(d.onAmbientEffect([1, 2, 3]), false);
  frame('thunder', 0.01);
  assert.equal(d.lightningLight, null, 'a frame ticked while inside lights nothing');
  d.setInside(false);
  assert.equal(d.lightningListening, true, 'out again, it listens');
  frame('sunny');
  assert.equal(d.lightningListening, false, 'the storm passed');
  assert.equal(MAX_DELTA_SECONDS, 1 / 3, 'the most real time a frame carries into the flash');
  assert.match(read('src/scenes/shared.js'), /Math\.min\(MAX_DELTA_SECONDS, Math\.max\(0, seconds - weatherAt\)\)/);
});

// ── THE PASS ──────────────────────────────────────────────────────
const NOISE = paintSkyNoise();
const noiseAt = (_name, uv) => {
  const s = NOISE.width, x = (((Math.floor(uv[0] * s)) % s) + s) % s, y = (((Math.floor(uv[1] * s)) % s) + s) % s, i = (y * s + x) * 4;
  return [0, 1, 2, 3].map((k) => NOISE.data[i + k] / 255);
};
/** The pass's whole FS, run in test/glsl.mjs on one frame's state, looking straight along `dir`. */
function shadeAlong(st, dir, extra = {}) {
  const b = {
    uYaw: Math.atan2(dir[0], dir[2]), uPitch: Math.asin(dir[1]), uTanHalfFov: 1, uAspect: 1, uBandDither: 1, uDread: 0, uBrass: 0, uHazeSky: [0, 0, 0, 0],
    uSunDir: st.sunDir, uZenith: st.zenith, uHorizon: st.horizon, uGround: st.ground, uGlow: st.glow, uGlowPower: st.glowPower,
    uSunDisc: st.sunDisc, uSunCos: st.sunCos, uNight: st.night, uStarPole: st.starPole, uStarTurn: st.starTurn, uTwinkle: 1,
    uMasser: [...st.masser.dir, st.masser.radius], uSecunda: [...st.secunda.dir, st.secunda.radius],
    uMasserLight: st.masser.light, uSecundaLight: st.secunda.light, uMasserColor: st.masser.color, uSecundaColor: st.secunda.color,
    uCloudLow: st.cloudLow, uCloudHigh: st.cloudHigh, uCloudOffset: st.cloudOffset, uCloudLit: st.cloudLit, uCloudShade: st.cloudShade,
    uFogColor: [0.5, 0.5, 0.5], uFogMix: 0, vNdc: [0, 0], texture: noiseAt, ...extra,
  };
  const fns = glslFunctions(FS, b);
  fns.main();
  return fns.globals.outColor.slice(0, 3);
}

test('OWN-WORK4 the pass runs whole: every uniform it declares is fetched, and what it draws is the rule\'s - blue overhead at a clear noon, the sun\'s disc white, the stars at a clear midnight, a full Masser rose, a layer at opacity 0 nothing', () => {
  const declared = new Set([...FS.matchAll(/uniform\s+[a-zA-Z0-9]+\s+([^;]+);/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().replace(/\[.*$/, ''))));
  assert.deepEqual([...declared].sort(), [...UNIFORM_NAMES].sort(), 'declared and fetched are one list');
  assert.equal(new Set(UNIFORM_NAMES).size, UNIFORM_NAMES.length);
  assert.doesNotMatch(FS, /#define|\bstruct\b/, 'nothing test/glsl.mjs cannot read');
  const clear = (minute, weather = 'sunny', minutes = BASE + minute) => skyFrame({ minuteOfDay: minute, classicMinutes: minutes, row: weatherRow(weather) });
  const noon = clear(720);
  const north = shadeAlong(noon, [0, 0.6, 0.8]);
  const openSky = shadeAlong({ ...noon, cloudLow: [0, 0, 1, 0.1], cloudHigh: [0, 0, 1, 0.1] }, [0, 0.6, 0.8]);
  assert.ok(openSky[2] > openSky[0] + 0.2, `a clear noon is blue (${openSky.map((v) => v.toFixed(2))})`);
  assert.ok(north.every((v) => v >= 0 && v <= 1));
  const disc = shadeAlong(noon, noon.sunDir);
  assert.ok(disc.every((v) => v > 0.97), `the sun's disc is white at noon (${disc.map((v) => v.toFixed(2))})`);
  // a clear midnight: the sky dark, and somewhere along a sweep a star
  const midnight = clear(0);
  let brightest = 0, darkest = 1;
  for (let i = 0; i < 60; i++) {
    const a = i * 0.137, y = 0.3 + 0.6 * ((i * 0.618) % 1), r = Math.sqrt(1 - y * y);
    const c = shadeAlong({ ...midnight, cloudLow: [0, 0, 1, 0.1], cloudHigh: [0, 0, 1, 0.1] }, [r * Math.cos(a), y, r * Math.sin(a)]);
    brightest = Math.max(brightest, ...c); darkest = Math.min(darkest, Math.max(...c));
  }
  assert.ok(darkest < 0.1, `the night sky is dark (${darkest.toFixed(3)})`);
  // ...the stars: a direction at a star's own centre, found from the hash the pass uses
  const st = { ...midnight, cloudLow: [0, 0, 1, 0.1], cloudHigh: [0, 0, 1, 0.1], starTurn: 0 };
  const fns = glslFunctions(FS, { uTwinkle: 0 });
  let star = null;
  for (let cy = 60; cy < 110 && !star; cy++) for (let cx = 0; cx < 110 && !star; cx++) {
    if (fns.cellHash([cx, cy, 2], 1) > STAR_LOOK.bright.chance) continue;
    const at = [fns.cellHash([cx, cy, 2], 2), fns.cellHash([cx, cy, 2], 3)].map((v) => v * 0.7 + 0.15);
    const u = ((cx + at[0]) / 110) * 2 - 1, v = ((cy + at[1]) / 110) * 2 - 1, l = Math.hypot(u, 1, v);
    star = [u / l, 1 / l, v / l];
  }
  assert.ok(star, 'a bright star on the zenith\'s face');
  const lit = shadeAlong(st, star, { uTwinkle: 0 });
  assert.ok(Math.max(...lit) > 0.3, `a star at its centre is bright (${lit.map((v) => v.toFixed(2))})`);
  // a full Masser at night: rose, where the sky puts it
  const full = { ...midnight, cloudLow: [0, 0, 1, 0.1], cloudHigh: [0, 0, 1, 0.1], night: 0, masser: { ...midnight.masser, dir: [0, 0.8, 0.6], light: [0, -0.8, -0.6], color: hexLinear(MOON_LOOK.masser.color) } };
  const face = shadeAlong(full, [0, 0.8, 0.6]);
  assert.ok(face[0] > 0.45 && face[0] > face[2], `a full Masser is lit and rose (${face.map((v) => v.toFixed(2))})`);
  const newMoon = shadeAlong({ ...full, masser: { ...full.masser, light: [0, 0.8, 0.6] } }, [0, 0.8, 0.6]);
  assert.ok(Math.max(...newMoon) < face[0] / 4, 'a new Masser is dark');
  // a layer at opacity 0 reads nothing (PERF-EXT30, DS2) - test/render/perfextd.test.js holds the colour it hands on
  let reads = 0;
  shadeAlong({ ...noon, cloudLow: [0.9, 0, 0.35, 0.12], cloudHigh: [0.9, 0, 0.15, 0.12] }, [0, 0.6, 0.8], { texture: (n, uv) => { reads++; return noiseAt(n, uv); } });
  assert.equal(reads, 0, 'by day, both layers at opacity 0: no tap at all');
});

test('PS3 THE LEVELS AND THE DITHER: 48 levels a channel, the ordered dither world-fixed and zero-mean, on by default, `?bands=raw` the door to the raw levels (mutants: the dither off; indexed by the screen)', () => {
  const levels = FS.slice(FS.indexOf('// encoded, the host\'s fog over it'), FS.indexOf('outColor = vec4('));
  const code = levels.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(code, /gl_FragCoord/, 'the dither never indexes the screen');
  assert.match(code, /vec2 fineCell; ringSnap\(dir, 0\.00204531, fineCell\); vec2 bandCell = floor\(fineCell\);/);
  assert.match(code, /float bandB = uBandDither \* \(bayer4\(bandCell\) - 0\.46875\);/);
  assert.match(code, /enc = floor\(enc \* SKY_LEVELS \+ 0\.5 \+ bandB\) \/ SKY_LEVELS;/);
  assert.equal(BAYER_MEAN, 0.46875);
  const rend = read('src/render/dynamicSkiesRenderer.js');
  assert.match(rend, /this\.bandDither = true;/, 'the dither is on by default');
  assert.match(rend, /gl\.uniform1f\(u\.uBandDither, this\.bandDither \? 1 : 0\);/, 'and uploaded');
  assert.match(read('src/scenes/shared.js'), /dynamicSky\.bandDither = params\.get\('bands'\) !== 'raw';/, '?bands=raw reaches the game');
  assert.match(read('src/tools/skyLab.js'), /sky\.bandDither = params\.get\('bands'\) !== 'raw';/, 'and the lab');
  // THE RINGS, MEASURED: a halo's falloff through the levels, raw and dithered (a 4x4 cell's mean)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const plateaus = (dither) => {
    let n = 0, prev = null;
    for (let px = 0; px < 900; px++) {
      const enc = 0.25 + 0.7 / (1 + Math.pow((px * 0.1) / 2.2, 1.6));
      let acc = 0;
      for (let cell = 0; cell < 16; cell++) acc += Math.floor(enc * SKY_LEVELS + 0.5 + (dither ? BAYER[cell] / 16 - BAYER_MEAN : 0)) / SKY_LEVELS;
      const v = (acc / 16).toFixed(3);
      if (v !== prev) { n++; prev = v; }
    }
    return n;
  };
  const raw = plateaus(false), dithered = plateaus(true);
  assert.ok(raw <= SKY_LEVELS, `raw, the halo is ${raw} flat bands`);
  assert.ok(dithered > raw * 3, `dithered, ${dithered} steps - the rings dissolve`);
});

test('OWN-WORK4 the pass\'s GL: one painted texture on unit 0, the layers handed opacity 0 under the volumetric clouds, the host\'s fog over it, the colours the state\'s', () => {
  const calls = [];
  const gl = new Proxy({}, { get: (_t, k) => (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : (...args) => { calls.push([k, ...args]); return k === 'getUniformLocation' ? args[1] : k === 'getShaderParameter' || k === 'getProgramParameter' ? true : {}; }) });
  const sky = new DynamicSkiesRenderer(/** @type {any} */ (gl));
  const st = skyFrame({ minuteOfDay: 720, row: weatherRow('cloudy') });
  sky.setState(st);
  assert.deepEqual([...sky.clearColor].map((v) => +v.toFixed(5)), st.clearColor.map((v) => +v.toFixed(5)));
  assert.deepEqual([...sky.fillColor].map((v) => +v.toFixed(5)), st.fillColor.map((v) => +v.toFixed(5)));
  sky.setTexture('SkyNoise', NOISE);
  const up = calls.find((c) => c[0] === 'texImage2D' && c[4] === 256);
  assert.ok(up && up[3] === 'RGBA8' && up[9] === NOISE.data, 'the noise uploaded as data, not colour');
  assert.ok(calls.some((c) => c[0] === 'texParameteri' && c[3] === 'LINEAR_MIPMAP_LINEAR') && calls.some((c) => c[0] === 'generateMipmap'));
  const draw = (external) => {
    sky.cloudsExternal = external; calls.length = 0;
    sky.draw(0, 0.2, 1.1, 16 / 9);
    return Object.fromEntries(calls.filter((c) => /^uniform/.test(c[0])).map((c) => [c[1], c.slice(2)]));
  };
  const own = draw(false), under = draw(true);
  assert.ok(own.uCloudLow[1] > 0 && own.uCloudHigh[1] > 0, '?clouds=off: the layers\' own opacity');
  assert.equal(under.uCloudLow[1], 0); assert.equal(under.uCloudHigh[1], 0, 'under the volumetric clouds: 0, the state keeps its own');
  assert.deepEqual(own.uCloudLow, st.cloudLow, 'the state\'s layer, whole');
  assert.equal(own.uSkyNoise[0], 0, 'unit 0');
  sky.fogMix = 0.7; sky.fogColor = new Float32Array([0.2, 0.3, 0.4]);
  const fogged = draw(false);
  assert.deepEqual(fogged.uFogMix, [0.7], 'the host\'s fog over the sky, as the dome takes it');
  assert.deepEqual([...fogged.uFogColor[0]].map((v) => +v.toFixed(3)), [0.2, 0.3, 0.4]);
  assert.match(FS, /enc = mix\(enc, uFogColor, uFogMix\);/);
  // the hosts write it on whichever pass they hold
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(read(host), /sky\.renderer\.fogMix = fogNow\.excludeSky \? 0 : 1 - fogFactor\(fogNow, 800\);/);
});

// ── THE STORM'S FLASH, OURS (OWN-WORK4 AUDIT): PIN MOVED - the retired mod's routine (its 50% roll, 33% double, 0.2 s
// on and off, the light over the player) is replaced by our strokes; these pin our law, not the mod's numbers ──
test('OWN-WORK4 AUDIT the storm\'s flash: a clap seen at its chance; one to four strokes, each a quick rise and a falling tail, fainter than the last; a cold light at the strike off to one side, riding with the player; gone when the last tail is spent (mutants: the chance unread; the tail a step; the strokes not fainter; the strike over the player)', () => {
  // the dice in order: the clap, the stroke count, the first peak, then a gap and a fade a stroke, the bearing, the
  // distance, the height, the range
  const dice = (clap, count, ...rest) => new StormFlash(seq([clap, count, ...rest]));
  assert.equal(dice(FLASH_LOOK.chance).startFlash([0, 0, 0]), false, 'the chance itself does not flash');
  assert.equal(dice(FLASH_LOOK.chance - 0.01, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5).startFlash([0, 0, 0]), true);
  assert.equal(dice(0.1).startFlash(null), false, 'no player, no flash');
  // one stroke (count die 0): lit at its peak on its first frame, whatever the frame's dt
  const one = dice(0.1, 0, 0.5, 0.5, 0.5, 0.25, 0.5, 0.5, 0.5);
  one.startFlash([10, 0, 20]);
  const peak = (FLASH_LOOK.peak[0] + FLASH_LOOK.peak[1]) / 2;
  const lit = one.tick(0.5, [10, 0, 20]);
  assert.ok(near(one.level, peak), `the first frame at the peak: ${one.level}`);
  assert.deepEqual(lit.color.map((c) => +c.toFixed(6)), FLASH_LOOK.color.map((c) => +(c * peak).toFixed(6)), 'cold white times its level');
  // the strike: a quarter turn round (bearing die 0.25), 100 m off, 90 m up - off to one side, never overhead
  const away = (FLASH_LOOK.away[0] + FLASH_LOOK.away[1]) / 2, up = (FLASH_LOOK.height[0] + FLASH_LOOK.height[1]) / 2;
  assert.ok(near(lit.x, 10, 1e-6) && near(lit.z, 20 + away, 1e-6) && near(lit.y, up, 1e-6), `the strike at (${lit.x}, ${lit.y}, ${lit.z})`);
  assert.ok(lit.range >= FLASH_LOOK.range[0] && lit.range <= FLASH_LOOK.range[1]);
  assert.ok(near(one.tick(0, [110, 0, 20]).x, 110), 'it rides with the player');
  // the tail: a decay later at 1/e of the peak, then spent
  const tail = one.tick(FLASH_LOOK.decay, [10, 0, 20]);
  assert.ok(tail && near(one.level, peak / Math.E, 1e-6), `a decay on: ${one.level}`);
  for (let i = 0; i < 40 && one.tick(1 / 60); i++);
  assert.equal(one.tick(1 / 60), null, 'spent');
  assert.equal(one._routines.length, 0, 'and forgotten');
  // four strokes (count die 0.99): each fainter, each a fresh rise after the last one's gap
  const four = dice(0.1, 0.99, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
  four.startFlash([0, 0, 0]);
  const levels = [];
  for (let t = 0; t < 0.6; t += 0.004) { four.tick(t === 0 ? 0 : 0.004, [0, 0, 0]); levels.push(four.level); }
  const peaks = levels.filter((v, i) => i > 0 && i < levels.length - 1 && v > levels[i - 1] && v >= levels[i + 1]);
  assert.equal(peaks.length + 1, 4, `four strokes: ${peaks.length + 1}`);
  assert.ok([levels[0], ...peaks].every((v, i, a) => i === 0 || v < a[i - 1]), 'each fainter than the last');
  four.stopAll();
  assert.equal(four.tick(0.01), null, 'the door puts it out');
  assert.equal(strokeLevel(-0.01), 0);
  assert.ok(near(strokeLevel(FLASH_LOOK.rise / 2), 0.5), 'the rise, linear');
});

test('OWN-WORK4 AUDIT the flash in the sky: the dome and its clouds take it, the clouds the most - the runtime hands its level to the frame (mutants: the sky unflashed; the clouds unflashed)', () => {
  const at = { minuteOfDay: 1300, classicMinutes: 1300, row: weatherRow('thunder') };
  const dark = skyFrame(at), lit = skyFrame({ ...at, flash: 1.5 });
  assert.ok(luminance(lit.zenith) > luminance(dark.zenith) + 0.05 && luminance(lit.horizon) > luminance(dark.horizon) + 0.05, 'the dome brighter');
  assert.ok(luminance(lit.cloudLit) - luminance(dark.cloudLit) > luminance(lit.zenith) - luminance(dark.zenith), 'the clouds the most');
  assert.ok(lit.zenith[2] - dark.zenith[2] > lit.zenith[0] - dark.zenith[0], 'a cold light');
  const d = new DynamicSkies({}, {}, () => 0.1);
  const frame = () => d.tick({ minuteOfDay: 1300, classicMinutes: BASE + 1300, weather: 'thunder', seconds: 0, dt: 1 / 60, playerPos: [0, 0, 0] });
  const before = frame();
  assert.equal(d.onAmbientEffect([0, 0, 0]), true);
  const during = frame();
  assert.ok(d.lightningLight && luminance(during.zenith) > luminance(before.zenith), 'the frame of a flash: the sky lit');
});

test('DS1 pixel snow: the sliders\' numbers - sizes over 100,000 (fractions of the view), the count in thousands', () => {
  assert.deepEqual(pixelSnowSettings({}), { minParticleSize: 0.001, maxParticleSize: 0.003, maxParticles: 20000 });
  assert.deepEqual(pixelSnowSettings({ MinParticleSize: 800, MaxParticleSize: 100, MaxParticles: 15 }), { minParticleSize: 0.008, maxParticleSize: 0.001, maxParticles: 15000 });
  assert.match(read('src/scenes/shared.js'), /pixelSnow: dynamic\?\.pixelSnow \? \{ \.\.\.dynamic\.pixelSnow, textureUrl: dynamicSkiesTextureUrl\('PixelSnow'\) \} : null,/, 'the flake we paint, as a URL');
});

test('OWN-WORK4 the pixel snow draws at most MaxParticles flakes: 20 the lab\'s own 20,000, 15 a quarter fewer (mutant: the slider unread)', () => {
  const counts = [];
  const gl = new Proxy({}, { get: (o, k) => {
    if (k === 'drawArraysInstanced') return (mode, first, n, count) => counts.push(count);
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
    return () => ({});
  } });
  const r = new PrecipitationRenderer(gl, { enhanced: true });
  r.pixelTex = {};
  r.intensity = 1;
  const M = new Float32Array(16), E = new Float32Array(3);
  for (const n of [20, 15]) {
    r.pixelSnow = pixelSnowSettings({ MaxParticles: n });
    r.draw('snow', M, M, E, E, 1);
  }
  assert.deepEqual(counts, [20000, 15000]);
});

// ── THE SEAM ──────────────────────────────────────────────────────
test('DS1 seam: the controller stands Dynamic Skies beside the dome on the one lane, and both hosts are wired - unchanged by OWN-WORK4', () => {
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /const dynamicOn = enhancedLane && \(skyDoor === 'dynamic' \|\| \(skyDoor === null && modSetting\('dynamic-skies', 'Enabled'\)\)\);/,
    'the mod’s own switch, under the lane; ?sky=dynamic forces it, any other door the dome');
  assert.match(shared, /setLightCurve\(dynamic \? dynamic\.lightCurve : null\);/, 'SetLightCurve for the world while it is the sky');
  assert.match(shared, /fogSettings: dynamic\?\.fogSettings,/);
  assert.match(shared, /onAmbientEffect\(playerPos, storm = true\) \{ dynamic\?\.onAmbientEffect\(playerPos, storm\); \}/);
  assert.match(shared, /setInside\(inside\) \{ dynamic\?\.setInside\(inside\); \}/, 'AUDIT 61: the transition seam on the controller');
  assert.match(shared, /dynamicMoonState\(dynamic, minuteOfDay, weatherRowNow\.cover\)/, 'AUDIT 61: the eased cover stands in for the mod’s clouds');
  assert.match(read('src/render/dynamicSkiesBridge.js'), /vis: dir\[1\] > 0 \? night \* cloud : 0/, 'AUDIT 61: the dome’s cloud factor over the sky’s moons (DS2: in the bridge)');
  assert.match(shared, /lightningLight\(\) \{ return dynamic\?\.lightningLight \?\? null; \}/);
  assert.match(shared, /dynamic\?\.weatherJump\(\);/, 'a load forces the mod’s re-apply');
  assert.match(shared, /weatherScale: extra\?\.sun \?\? weatherSunlightScale\(weatherName, winter\)/, '_LightColor0 takes WeatherManager’s ScaleFactor - the host’s own (AUDIT 61)');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    if (host.endsWith('world.js')) {
      assert.match(s, /let weatherFog = weatherFogRow\(weather\);/, `${host}: the boot fog over the mod’s table (through the EV4 row helper, AUDIT 61)`);
      assert.match(s, /weatherFog = weatherFogRow\(w\);/, `${host}: and every change`);
    } else {
      assert.match(s, /fogForWeather\(weather, sky\.fogSettings\)/, `${host}: the boot fog over the mod’s table`);
      assert.match(s, /fogForWeather\(w, sky\.fogSettings\)/, `${host}: and every change`);
    }
    assert.match(s, /const fogColor = (?:jungle \? jungle\.haze\(\{ fogColor: sky\.fogColorFor\(fogNow\), [^\n]*\}\) : )?sky\.fogColorFor\(fogNow\);/, `${host}: the fog colour through the controller`);   // BANTHA1: the jungle's haze over it, in the streaming host
    assert.match(s, /ambience\.onPlayEffect = \(clip, playerPos\) => sky\.onAmbientEffect\(playerPos, ambientWord === 'thunder'\);/, `${host}: OnPlayEffect reaches the listener, with the word the ambience plays`);
    assert.match(s, /ambientWord = enhancedFront \? soundWeather\(fx, weather\) : weather;/, `${host}: the ambient word is the preset’s`);
    assert.match(s, /if \(!skyInside\) \{ skyInside = true; sky\.setInside\(true\); \}/, `${host}: InteriorTransitionEvent on the modal edge (AUDIT 61)`);
    assert.match(s, /if \(skyInside\) \{ skyInside = false; sky\.setInside\(false\); \}/, `${host}: ExteriorTransitionEvent before the sky’s frame`);
    assert.match(s, /isEnhanced\(\) && !sky\.dynamic \? strobe : 1/, `${host}: one lightning under the mod - the strobe stands down (AUDIT 61)`);
    assert.match(s, /classicMinutes: playerTicker\.classicMinutes, skyMinutes: skyMinutes\(\), sun: wxNow\.sun, flash: flash - 1, pos: [^}]+ \}/, `${host}: the ONE sunlight scale the ground takes rides the sky’s frame (AUDIT 61; WX2’s blend of the host’s SetSunlightScale)`);   // TIME1: and the sky's minute beside the event clock's
    // PIN MOVED (STAR4): the world host's channel takes a fallen star's landing last (scenes/starfall/starfallHost.js flash)
    const starLast = host === 'src/scenes/world.js' ? ' ?? starfall?.flash() ?? null' : '';
    assert.ok(s.includes(`renderer.setFlashLight(sky.lightningLight() ?? boltFrame.flash${starLast});`), `${host}: the flash on the light channel - the mod's first, else a near ground strike's (BOLT)`);
    assert.match(s, /if \(sky\.pixelSnow\) precipOpts\.pixelSnow = sky\.pixelSnow;/, `${host}: the pixel snow`);
    // the flash composes AFTER the lanterns are stored
    assert.ok(s.lastIndexOf('renderer.setPointLights(') < s.indexOf('renderer.setFlashLight(sky.lightningLight() ?? boltFrame.flash'), `${host}: setFlashLight follows setPointLights`);
  }
  // AUDIT 61: the mod's fog rows are installed verbatim - EV4's distance
  // scale is DFU's row's law - and the far ring's ramp starts where the
  // row starts
  const world = read('src/scenes/world.js');
  assert.match(world, /sky\.dynamic \? fogForWeather\(w, sky\.fogSettings\) : scaleFogForDistance\(fogForWeather\(w\), fogDistance\)/);
  assert.match(world, /fogStart: fogNow\.start \?\? 0, fogEnd: fogNow\.end,/);
  const ring = read('src/render/farRing.js');
  assert.match(ring, /uniform float uFogStart;/);
  // PIN MOVED (FAR-SEA1): the ramp is the horizon's one law (render/horizonHaze.js), the ring hands it the fog's start
  assert.match(ring, /horizonHaze\(vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, summitHold\(uHazeHold, vDist\)\)/);   // PIN MOVED (RED-MOUNTAIN): the hold eased over the summits; PIN MOVED (AUDIT RED-MOUNTAIN F6): and by the eye's distance
  assert.match(read('src/render/horizonHaze.js'), /float ramp = clamp\(\(d - fogStart\) \/ max\(fogEnd - fogStart, 1\.0\), 0\.0, 1\.0\);/);
  // the classic pass knows nothing of it
  assert.doesNotMatch(read('src/render/skyRenderer.js'), /dynamic/i);
  // the lab has the door
  assert.match(read('src/tools/skyLab.js'), /params\.get\('sky'\) === 'dynamic'/);
});

test('DS1 renderer: exp2 fog in every world pass, and the flash composes first under the cap of sixteen', () => {
  const r = read('src/render/renderer.js');
  // SEVEN since BLOOD1a: the decal pass is a world pass too - a mark on
  // a floor a hundred units off has to fade into the same fog the floor
  // does, or it hangs in the murk brighter than the ground it is on.
  // AUDIT 68 S17-fog-glsl-dup: ONE fogFactorAt (fogGlsl.js), which all seven interpolate
  const fog = read('src/render/fogGlsl.js');
  assert.equal((fog.match(/if \(uFogMode == 3\) \{ float f = uFogDensity \* d; return exp\(-f \* f\); \}/g) || []).length, 1, 'the exp2 line, once');
  assert.equal((r.match(/^\$\{FOG_GLSL\}$/gm) || []).length, 7, 'every world program takes it');
  assert.ok(!/float fogFactorAt\(/.test(r), 'and none keeps a copy');
  assert.match(r, /mode === 'exp2' \? 3 : 0/);
  assert.match(r, /const FOG_MODE_NAMES = \['off', 'linear', 'exp', 'exp2'\];/);
  // the composition, on a state object with the renderer's fields
  const st = {
    _pointLights: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]), _pointColors: null, _pointColor: new Float32Array([0.5, 0.5, 0.5]),
    _flashLightScratch: new Float32Array(64), _flashColorScratch: new Float32Array(48), _flashLight: null,
    maxPointLights: 16,   // EL1: the installed set's cap (the classic set's here)
  };
  Renderer.prototype.setFlashLight.call(st, { x: 9, y: 8, z: 7, range: 600, color: [1, 0.9, 0.8] });
  assert.deepEqual([...st._pointLights], [9, 8, 7, 600, 1, 2, 3, 4, 5, 6, 7, 8], 'the flash first, the host’s lights behind it');
  assert.deepEqual([...st._pointColors].map((v) => Math.round(v * 1e4) / 1e4), [1, 0.9, 0.8, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 'its own colour, the shared colour splatted behind');
  // sixteen host lights: the last is dropped for the flash
  st._pointLights = new Float32Array(64).map((_, i) => i); st._pointColors = null;
  Renderer.prototype.setFlashLight.call(st, { x: 0, y: 0, z: 0, range: 1, color: [1, 1, 1] });
  assert.equal(st._pointLights.length, 64); assert.equal(st._pointLights[4], 0); assert.equal(st._pointLights[63], 59);
  // per-light host colours ride through
  st._pointLights = new Float32Array([1, 2, 3, 4]); st._pointColors = new Float32Array([0.1, 0.2, 0.3]);
  Renderer.prototype.setFlashLight.call(st, { x: 0, y: 0, z: 0, range: 1, color: [1, 1, 1] });
  assert.deepEqual([...st._pointColors].map((v) => Math.round(v * 1e4) / 1e4), [1, 1, 1, 0.1, 0.2, 0.3]);
  // null is a no-op on the arrays: the next setPointLights replaces them
  const before = st._pointLights;
  Renderer.prototype.setFlashLight.call(st, null);
  assert.equal(st._pointLights, before); assert.equal(st._flashLight, null);
  // the world's fog readers know exp2
  assert.match(read('src/world/weather.js'), /if \(settings\.mode === 'exp2'\)/);
});

test('DS1 ambience: AmbientEffectsPlayer.OnPlayEffect - raised from PlayEffects after every one-shot', () => {
  const played = [];
  const engine = { play3d: () => 1, playOneShot: () => 1, loop: () => ({}) };
  const a = new AmbientEffects({ minWait: 1, maxWait: 2 }, engine, () => 0.5);
  a.onPlayEffect = (clip, pos) => played.push([clip, pos]);
  a.setPreset('storm');
  for (let i = 0; i < 6; i++) a.update(1, { playerPos: [4, 5, 6] });
  assert.ok(played.length >= 1, 'a storm one-shot raised the event');
  assert.deepEqual(played[0][1], [4, 5, 6]);
  assert.ok([348, 349, 350].includes(played[0][0]));
  // the castle gate returns before the raise, as DFU's does
  const b = new AmbientEffects({ minWait: 1, maxWait: 2 }, engine, () => 0.5);
  const got = [];
  b.onPlayEffect = (clip) => got.push(clip);
  b.setPreset('dungeon');
  for (let i = 0; i < 6; i++) b.update(1, { playerPos: [0, 0, 0], inCastle: true });
  assert.equal(got.length, 0);
});

test('DS1 settings: the switch and the five keys as they shipped, the integer keys clamped, the Mods pane renders steppers', () => {
  _resetModSettings();
  try {
    const m = MOD_SETTINGS['dynamic-skies'];
    assert.equal(m.title, 'Dynamic Skies');
    assert.deepEqual(Object.keys(m.keys), ['Enabled', 'densitySetting', 'ActivatePixelSnow', 'MinParticleSize', 'MaxParticleSize', 'MaxParticles']);
    // OWN-WORK4: the five keys as the retired mod's settings shipped them, written out when vendor/dynamic-skies left; the words ours
    const KEYS = {
      densitySetting: { default: 1, min: 1, max: 10, description: 'How thick the fog is in every weather. 1 is the lightest.' },
      ActivatePixelSnow: { default: false, description: 'Snow falls as small square flakes in place of the usual snow.' },
      MinParticleSize: { default: 100, min: 100, max: 800, description: 'Size of the smallest square snowflake.' },
      MaxParticleSize: { default: 300, min: 100, max: 800, description: 'Size of the largest square snowflake.' },
      MaxParticles: { default: 20, min: 15, max: 20, description: 'Most snowflakes drawn, in thousands.' },
    };
    for (const [name, k] of Object.entries(KEYS)) {
      const def = m.keys[name];
      assert.ok(def, `${name} carried`);
      assert.equal(def.default, k.default, `${name} default`);
      if (k.min !== undefined) { assert.equal(def.min, k.min); assert.equal(def.max, k.max); assert.ok(isIntKey(def)); }
      else assert.ok(!isIntKey(def));
      assert.equal(def.description, k.description, `${name}: the pane's words`);
    }
    assert.equal(modSetting('dynamic-skies', 'Enabled'), true, 'VC1 (2026-09-07) made it a choice in the Mods pane; MO1 (Mac, 2026-09-12): every mod is on by default');
    assert.equal(modSetting('dynamic-skies', 'densitySetting'), 1);
    assert.equal(setModSetting('dynamic-skies', 'densitySetting', 14), 10, 'clamped to the slider');
    assert.equal(setModSetting('dynamic-skies', 'densitySetting', 0), 1);
    assert.equal(setModSetting('dynamic-skies', 'MinParticleSize', 250.7), 250, 'an integer');
    assert.equal(modSetting('dynamic-skies', 'ActivatePixelSnow'), false);
    const all = modSettingsOf('dynamic-skies');
    assert.equal(all.MinParticleSize, 250); assert.equal(all.Enabled, true);   // VC1 made the mod a choice; MO1: on by default
    assert.equal(modSetting('roads-hazelnut', 'SmoothRoads'), true, 'the toggles read as before');
    assert.match(read('src/ui/enhanced/enhancedMenu.js'), /if \(isIntKey\(def\)\) \{/, 'the pane steps the integer keys');
  } finally { _resetModSettings(); }
});

// ── MODS AUDIT (2026-09-08): the flash follows the player - PIN MOVED (OWN-WORK4 AUDIT): our strike rides with the
// live player (above); what stays pinned here is that the controller hands the frame's position through ──
test('MODS AUDIT: the controller hands the frame\u2019s position to the flash', () => {
  assert.match(read('src/scenes/shared.js'), /playerPos: extra\?\.pos \?\? null,/, 'the controller hands the frame\u2019s position through');
});

