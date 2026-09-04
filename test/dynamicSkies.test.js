// DS1 - DYNAMIC SKIES (2026-09-04, Mac: "I want to implement this mod
// 1:1. We received permission from the creator. I also want it to be
// compatible with our current implementation").
//
// What is pinned: the vendored tree is the mod's (manifest, presets,
// textures the presets name); the logic port answers what BLBSkybox.cs
// answers (presets parsed with JsonUtility's defaults, ApplySkyboxSettings
// with its quirks, ProcessFogSetting's density law, the light curve's
// flat tangents, ChangeLunarPhases' interpolation, ApplyOrbitCalculations,
// setFogColor, LightningFlash's rolls); the shader is the mod's (every
// property a uniform of the same name, the baked keywords); and the seam
// (controller, hosts, settings, credits) is wired in both exterior hosts
// with the port's own laws untouched underneath.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DYNAMIC_SKIES_MOD, WEATHER_PRESET, FOG_PRESET_FOR_WEATHER, TIMESCALE_FACTOR,
  parseHtmlColor, srgbToLinear, linearToSrgb, parseSkyboxSetting, parseFogSetting, parseLightCurve,
  fogSettingsFromPresets, fogPresetKey, MATERIAL_DEFAULTS, initMaterial, applySkyboxSettings,
  TEXTURE_IMPORTS, TEXTURE_SLOTS, dayPartOfHour, weatherIndexOf, DAY_PARTS,
  LUNAR_PHASE_X, lunarPhaseLength, phaseDayOffset, nextLunarPhase, interpolateAngle, lunarPhaseState, orbitParameters,
  rotateWorldPosition, orbitPosition, rotateArbitraryAxis, moonDirection,
  worldTimeSeconds, sunLightDirection, sunCurveTime, sunLightColor, mathfSmoothStep, fogColorNow,
  LightningFlash, pixelSnowSettings,
} from '../src/systems/dynamicSkies.js';
import { DynamicSkies } from '../src/systems/dynamicSkiesRuntime.js';
import { FS, COLOR_PROPERTIES, FLOAT_PROPERTIES, UNIFORM_NAMES } from '../src/render/dynamicSkiesRenderer.js';
import { LUNAR_PHASES, lunarPhase, dateFromClassicMinutes, MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { evaluateCurve, daylightScale, setLightCurve, sunDirection } from '../src/world/worldClock.js';
import { FOG_SETTINGS, fogForWeather, fogFactor } from '../src/world/weather.js';
import { MOD_SETTINGS, modSetting, setModSetting, modSettingsOf, isIntKey, _resetModSettings } from '../src/systems/modSettings.js';
import { CREDITS } from '../src/ui/credits.js';
import { AmbientEffects } from '../src/systems/ambientEffects.js';
import { Renderer } from '../src/render/renderer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const V = 'vendor/dynamic-skies';
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const PRESET_NAMES = ['SkyboxSunny', 'SkyboxCloudy', 'SkyboxOvercast', 'SkyboxFog', 'SkyboxRain', 'SkyboxThunder', 'SkyboxSnow'];
const FOG_NAMES = ['FogSunny', 'FogOvercast', 'FogHeavyFog', 'FogRainy', 'FogSnowy'];
const assets = () => ({
  presets: Object.fromEntries(PRESET_NAMES.map((n) => [n, read(`${V}/SkyboxSettings/${n}.json`)])),
  fogPresets: Object.fromEntries(FOG_NAMES.map((n) => [n, read(`${V}/FogSettings/${n}.json`)])),
  lightCurve: read(`${V}/LightCurveSettings/LightCurve.json`),
});
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

// ── THE VENDORED TREE IS THE MOD'S ────────────────────────────────
test('DS1 vendor: the manifest is 2.3.4 by BadLuckBurt and carademono, and every preset and fog file it lists is here', () => {
  const manifest = JSON.parse(read(`${V}/dynamic-skies.dfmod.json`));
  assert.equal(manifest.ModTitle, DYNAMIC_SKIES_MOD.title);
  assert.equal(manifest.ModVersion, DYNAMIC_SKIES_MOD.version);
  assert.equal(manifest.ModAuthor, DYNAMIC_SKIES_MOD.author);
  assert.equal(manifest.GUID, DYNAMIC_SKIES_MOD.guid);
  assert.equal(manifest.ContactInfo, DYNAMIC_SKIES_MOD.contact);
  const listed = manifest.Files.map((f) => f.split('/').pop());
  for (const n of PRESET_NAMES) { assert.ok(listed.includes(`${n}.json`)); assert.ok(existsSync(join(root, V, 'SkyboxSettings', `${n}.json`))); }
  for (const n of FOG_NAMES) { assert.ok(listed.includes(`${n}.json`)); assert.ok(existsSync(join(root, V, 'FogSettings', `${n}.json`))); }
  assert.ok(listed.includes('LightCurve.json'));
  // the *Night.json variants are NOT shipped - index 1 is index 0
  assert.ok(!listed.some((f) => /Night\.json$/.test(f)), 'no night preset in the shipped manifest');
  // modsettings' two sections and their keys are the Mods pane's
  const ms = JSON.parse(read(`${V}/modsettings.json`));
  const keys = ms.Sections.flatMap((s) => s.Keys.map((k) => k.Name));
  assert.deepEqual(keys, ['densitySetting', 'ActivatePixelSnow', 'MinParticleSize', 'MaxParticleSize', 'MaxParticles']);
});

test('DS1 vendor: every texture a shipped preset names is vendored, with an import setting, and nothing unnamed is', () => {
  const named = new Set(['PixelSnow']);   // InitSnow's, not a preset's
  for (const n of PRESET_NAMES) {
    const s = parseSkyboxSetting(read(`${V}/SkyboxSettings/${n}.json`));
    for (const f of [s.TopClouds.CloudsTextureFile, s.TopClouds.CloudsNormalTextureFile, s.BottomClouds.CloudsTextureFile, s.BottomClouds.CloudsNormalTextureFile,
      s.Stars.StarsTextureFile, s.Stars.StarsTwinkleTextureFile, s.Stars.TwinkleTextureFile, s.Masser.MoonTextureFile, s.Secunda.MoonTextureFile]) named.add(f);
  }
  const files = readdirSync(join(root, V, 'Textures')).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')).sort();
  assert.deepEqual(files, [...named].sort(), 'the vendored textures are exactly the named ones');
  for (const f of files) assert.ok(TEXTURE_IMPORTS[f], `${f} has its Unity import settings restated`);
  // the one normal map is the converted one (bilinear, no mips, not sRGB)
  assert.deepEqual(TEXTURE_IMPORTS.CdMCloudsNormal, { filter: 'bilinear', mips: false, srgb: false, normal: true });
  // the shader sources are beside the port for reading
  assert.match(read(`${V}/Shaders/BLBProceduralSkybox.shader`), /^﻿?Shader "BLB\/SkyBox\/BLBProceduralSkybox"/);
  assert.ok(existsSync(join(root, V, 'Shaders/Includes/MoonFunctions.cginc')));
  assert.ok(existsSync(join(root, V, 'Shaders/Includes/Scattering.cginc')));
});

test('DS1 vendor: the README records the permission and the credit row names the folder', () => {
  const readme = read(`${V}/README.md`);
  assert.match(readme, /BadLuckBurt/); assert.match(readme, /carademono/);
  assert.match(readme, /permission/i);
  const row = CREDITS.mods.find((m) => m.title === 'Dynamic Skies');
  assert.ok(row, 'no credit row');
  assert.equal(row.version, '2.3.4');
  assert.equal(row.author, 'BadLuckBurt and carademono');
  assert.deepEqual([...row.vendor], ['dynamic-skies']);
  assert.equal(row.contact, "Lysandus' Tomb Discord server");   // the manifest's own words
});

// ── THE STRUCTS, JsonUtility's way ────────────────────────────────
test('DS1 presets: parsed as JsonUtility parses them - absent fields default, the flat sub-structs are parsed twice', () => {
  const s = parseSkyboxSetting(read(`${V}/SkyboxSettings/SkyboxSunny.json`));
  assert.equal(s.SunSize, 0.10000000149011612);
  assert.equal(s.SunSizeConvergence, 10);
  assert.equal(s.SkyTint, '6176DCFF');
  assert.equal(s.TopClouds.CloudsTextureFile, 'CdMSunny');
  assert.equal(s.BottomClouds.CloudsTextureFile, 'CdMSunny2');
  assert.equal(s.BottomClouds.Speed, 0.0012499999720603228);
  // fields the JSON does not carry are the struct's defaults (0)
  assert.equal(s.BottomClouds.Direction, 0);
  assert.equal(s.BottomClouds.BlendScale, 0);
  assert.equal(s.BottomClouds.BlendLB, 0);
  assert.equal(s.BottomClouds.BlendUB, 0);
  assert.equal(s.BottomClouds.BlendSpeed, 0);
  assert.deepEqual(s.Masser.OrbitAngle, [0, 270, 90, 0]);
  assert.deepEqual(s.Secunda.TidalAngle, [30, 160, -30, 0]);
  // Fog has no MoonNightColor: the struct's null, and the apply leaves the slot
  const f = parseSkyboxSetting(read(`${V}/SkyboxSettings/SkyboxFog.json`));
  assert.equal(f.MoonNightColor, null);
  // colours: "RRGGBBAA" -> sRGB /255
  assert.deepEqual(parseHtmlColor('6176DCFF'), [0x61 / 255, 0x76 / 255, 0xDC / 255, 1]);
  assert.equal(parseHtmlColor('nonsense'), null);
  assert.equal(parseHtmlColor(null), null);
  // the colour space: Mathf.GammaToLinearSpace and back
  assert.ok(near(srgbToLinear(0.5), 0.21404114, 1e-6));
  assert.ok(near(linearToSrgb(srgbToLinear(0.73)), 0.73, 1e-9));
  assert.equal(srgbToLinear(0), 0); assert.equal(srgbToLinear(1), 1);
});

test('DS1 fog: ProcessFogSetting - Unity FogMode ints, density / (11 - densitySetting), the mod ships exp2', () => {
  const f = parseFogSetting(read(`${V}/FogSettings/FogOvercast.json`));
  assert.equal(f.FogModeInt, 3); assert.equal(f.ExcludeSkybox, true); assert.equal(f.EndDistance, 500000);
  const t1 = fogSettingsFromPresets(assets().fogPresets, 1);
  assert.equal(t1.sunny.mode, 'linear'); assert.equal(t1.sunny.start, 2000); assert.equal(t1.sunny.end, 3600);
  assert.equal(t1.overcast.mode, 'exp2'); assert.ok(near(t1.overcast.density, 0.0075000000237487257 / 10));
  assert.equal(t1.rainy.mode, 'exp2'); assert.equal(t1.snowy.mode, 'exp2');
  assert.equal(t1.heavy.mode, 'exp'); assert.ok(near(t1.heavy.density, 0.05000000074505806 / 10)); assert.equal(t1.heavy.excludeSky, false);
  const t10 = fogSettingsFromPresets(assets().fogPresets, 10);
  assert.ok(near(t10.heavy.density, 0.05000000074505806), 'slider 10 divides by 1');
  // the world's readers: fogForWeather over the mod's table, fogFactor's exp2
  assert.equal(fogForWeather('thunder', t1), t1.rainy);
  assert.equal(fogForWeather('cloudy', t1), t1.sunny);
  assert.equal(fogForWeather('fog', t1), t1.heavy);
  assert.equal(fogForWeather('snow'), FOG_SETTINGS.snowy, 'no table: DFU’s own, as before');
  assert.ok(near(fogFactor({ mode: 'exp2', density: 0.002, start: 0, end: 0 }, 500), Math.exp(-1)));
  for (const w of Object.keys(WEATHER_PRESET)) assert.ok(['sunny', 'overcast', 'rainy', 'snowy', 'heavy'].includes(fogPresetKey(w)));
  assert.equal(FOG_PRESET_FOR_WEATHER.thunder, 'FogRainy');
});

test('DS1 light curve: LightCurve.json as Keyframe(time, value) - flat tangents, and it replaces the world’s daylightScale', () => {
  const keys = parseLightCurve(assets().lightCurve);
  assert.deepEqual(keys, [[0, 0, 0, 0], [0.05, 0.8, 0, 0], [0.5, 1, 0, 0], [0.95, 0.8, 0, 0], [1, 0, 0, 0]]);
  // Hermite with zero tangents: halfway between two keys is their mean
  assert.ok(near(evaluateCurve(keys, 0.025), 0.4));
  assert.ok(near(evaluateCurve(keys, 0.5), 1));
  assert.ok(near(evaluateCurve(keys, 0.975), 0.4));
  // the rig's own curve stands until a mod replaces it, and comes back after
  const rig = daylightScale(12 * 60);
  assert.ok(near(rig, 0.9));
  setLightCurve(keys);
  try {
    assert.ok(near(daylightScale(12 * 60), 1), 'the mod’s noon is 1');
    assert.ok(near(daylightScale(6 * 60 + 36), 0.8), 'the mod’s 06:36 is its second key');
  } finally { setLightCurve(null); }
  assert.ok(near(daylightScale(12 * 60), rig));
});

// ── ApplySkyboxSettings, with its quirks ──────────────────────────
test('DS1 apply: every material property a preset sets, the timescale factors, and the four quirks kept', () => {
  const mat = initMaterial(123.4);
  assert.equal(mat._CloudDirection, 123.4, 'Init writes the rolled wind');
  assert.equal(mat._SunSize, 0.04); assert.equal(mat._AtmosphereLerp, 0);
  const s = parseSkyboxSetting(read(`${V}/SkyboxSettings/SkyboxSunny.json`));
  applySkyboxSettings(mat, s);
  assert.equal(mat._SunSize, s.SunSize);
  assert.equal(mat._SunSizeConvergence, 10);
  assert.deepEqual(mat._SkyTint, parseHtmlColor('6176DCFF'));
  assert.equal(mat._SkyFadeEnd, s.SkyEndStart);
  assert.ok(near(mat._CloudSpeed, s.BottomClouds.Speed * TIMESCALE_FACTOR), '"Because game runs at timescale 12"');
  assert.ok(near(mat._TwinkleSpeed, s.Stars.TwinkleSpeed * TIMESCALE_FACTOR));
  assert.deepEqual(mat._MoonSpinSpeed, s.Masser.SpinSpeed.map((v) => v * TIMESCALE_FACTOR));
  assert.deepEqual(mat._SecundaSpinSpeed, s.Secunda.SpinSpeed, 'Secunda’s spin is NOT timescaled (:1464)');
  // QUIRK 1: the preset's Direction (0) overwrites Init's wind
  assert.equal(mat._CloudDirection, 0);
  // QUIRK 2: _CloudSunScale takes the TOP layer's scale
  assert.equal(mat._CloudSunScale, s.TopClouds.SunColorScale);
  // QUIRK 3: the twinkle texture's offset is the STARS' offset
  assert.deepEqual(mat._TwinkleTex_ST, [s.Stars.TwinkleTilingX, s.Stars.TwinkleTilingY, s.Stars.StarsOffsetX, s.Stars.StarsOffsetY]);
  // QUIRK 4: the Masser tidal angle goes to a property the shader lacks;
  // _MoonTidalAngle keeps the material's (0, 300, 0)
  assert.deepEqual(mat._MasserTidalAngle, [0, 300, 0, 0]);
  assert.deepEqual(mat._MoonTidalAngle, MATERIAL_DEFAULTS._MoonTidalAngle);
  assert.deepEqual(mat._SecundaTidalAngle, [30, 160, -30, 0], 'Secunda’s reaches the shader');
  // the texture slots and their _ST
  assert.equal(mat._CloudTopDiffuse, 'CdMSunny'); assert.equal(mat._CloudDiffuse, 'CdMSunny2');
  assert.deepEqual(mat._CloudDiffuse_ST, [0.25, 0.25, 0.5, 0]);
  assert.equal(mat._StarTex, 'VanillaStars'); assert.equal(mat._MoonTex, 'PixelMars'); assert.equal(mat._SecundaTex, 'PixelEnceladus');
  assert.deepEqual(mat._StarTwinkleTex_ST, mat._StarTex_ST, 'the twinkle mask tiles as the stars do');
  // a preset without a colour leaves the slot as it was (the TryParse guard)
  const fog = parseSkyboxSetting(read(`${V}/SkyboxSettings/SkyboxFog.json`));
  const before = mat._MoonNightColor;
  applySkyboxSettings(mat, fog);
  assert.equal(mat._MoonNightColor, before, 'Fog has no MoonNightColor: the previous stays');
  assert.equal(mat._CloudTopDiffuse, 'CdMRain');
  // every preset applies without throwing, over the same material
  for (const n of PRESET_NAMES) applySkyboxSettings(mat, parseSkyboxSetting(read(`${V}/SkyboxSettings/${n}.json`)));
});

test('DS1 day parts: isHourDayPart’s bands and getWeatherIndex', () => {
  assert.equal(dayPartOfHour(0), DAY_PARTS.Night); assert.equal(dayPartOfHour(3), DAY_PARTS.Night);
  assert.equal(dayPartOfHour(4), DAY_PARTS.Dawn); assert.equal(dayPartOfHour(5), DAY_PARTS.Dawn);
  assert.equal(dayPartOfHour(6), DAY_PARTS.DawnEnd);
  assert.equal(dayPartOfHour(7), DAY_PARTS.Morning); assert.equal(dayPartOfHour(11), DAY_PARTS.Morning);
  assert.equal(dayPartOfHour(12), DAY_PARTS.Midday); assert.equal(dayPartOfHour(15), DAY_PARTS.Midday);
  assert.equal(dayPartOfHour(16), DAY_PARTS.Dusk); assert.equal(dayPartOfHour(17), DAY_PARTS.Dusk);
  assert.equal(dayPartOfHour(18), DAY_PARTS.DuskEnd);
  assert.equal(dayPartOfHour(19), DAY_PARTS.Evening); assert.equal(dayPartOfHour(23), DAY_PARTS.Evening);
  assert.equal(weatherIndexOf(DAY_PARTS.Evening), 1); assert.equal(weatherIndexOf(DAY_PARTS.Night), 1);
  assert.equal(weatherIndexOf(DAY_PARTS.Midday), 0); assert.equal(weatherIndexOf(DAY_PARTS.None), 0);
});

// ── THE MOONS ─────────────────────────────────────────────────────
test('DS1 moons: the phase ladder, lengths, day offsets and the short-way interpolation, verbatim', () => {
  assert.equal(LUNAR_PHASE_X[LUNAR_PHASES.New], 180); assert.equal(LUNAR_PHASE_X[LUNAR_PHASES.Full], 0); assert.equal(LUNAR_PHASE_X[LUNAR_PHASES.OneWane], -135);
  assert.equal(lunarPhaseLength(LUNAR_PHASES.OneWax), 6); assert.equal(lunarPhaseLength(LUNAR_PHASES.ThreeWax), 3); assert.equal(lunarPhaseLength(LUNAR_PHASES.Full), 1);
  assert.equal(phaseDayOffset(0), 0); assert.equal(phaseDayOffset(16), 0); assert.equal(phaseDayOffset(5), 4); assert.equal(phaseDayOffset(17), 0); assert.equal(phaseDayOffset(31), 2);
  assert.equal(nextLunarPhase(LUNAR_PHASES.OneWane), LUNAR_PHASES.New); assert.equal(nextLunarPhase(LUNAR_PHASES.ThreeWax), LUNAR_PHASES.Full);
  assert.equal(interpolateAngle(-135, 180, 0.5), -157.5, 'OneWane (-135) to New (180) goes the short way, through -180');
  assert.equal(interpolateAngle(180, 135, 0.5), 157.5);
  // a date: the state agrees with DFU's ladder and progresses through the day
  const date = dateFromClassicMinutes(405 * 360 * MINUTES_PER_DAY + 10 * MINUTES_PER_DAY + 12 * 60);
  const st = lunarPhaseState(date, true);
  assert.equal(st.phase, lunarPhase(date, { masser: true }));
  assert.equal(st.moonRatio, 22); assert.equal(st.phase, LUNAR_PHASES.OneWax);
  assert.ok(near(st.progress, (5 * 86400 + 12 * 3600) / (6 * 86400)), 'day offset 5 of 6, at noon');
  assert.ok(near(st.interpolatedX, interpolateAngle(135, 90, st.progress)));
  const sec = lunarPhaseState(date, false);
  assert.equal(sec.moonRatio, 18);
  // the orbit: 270/90 with a Z from the phase, speed 0.0000725, offset X + 180
  const o = orbitParameters(st, sec);
  assert.deepEqual(o._MoonOrbitAngle.slice(0, 2), [270, 90]);
  assert.ok(near(o._MoonOrbitAngle[2], -20 * Math.sin(st.interpolatedX * Math.PI / 180)));
  assert.ok(near(o._SecundaOrbitAngle[2], -30 * Math.sin(sec.interpolatedX * Math.PI / 180)));
  assert.equal(o._MoonOrbitSpeed, 0.0000725); assert.equal(o._SecundaOrbitSpeed, 0.0000725);
  assert.ok(near(o._MoonOrbitOffset, st.interpolatedX + 180));
  // OneWane and New nudge the offset (the eclipse avoidance)
  const wane = { phase: LUNAR_PHASES.OneWane, progress: 0.5, interpolatedX: -157.5 };
  const nw = { phase: LUNAR_PHASES.New, progress: 0, interpolatedX: 180 };
  const o2 = orbitParameters(wane, nw);
  assert.ok(near(o2._MoonOrbitOffset, -157.5 + 180 + 15 * 0.5));
  assert.ok(near(o2._MoonOrbitAngle[2], -20 * Math.sin(-157.5 * Math.PI / 180) + 15 * 0.5));
  assert.ok(near(o2._SecundaOrbitOffset, 180 + 180 - 5));
});

test('DS1 moons: the CPU twin of MoonFunctions.cginc - rows dot vector, the ellipse, the arbitrary axis', () => {
  // RotateWorldPosition about Y by 90 degrees takes +X to -Z... as the
  // cginc's row matrix does: row0 = (cos y cos z, -cos y sin z, sin y)
  const r = rotateWorldPosition([1, 0, 0], [0, Math.PI / 2, 0]);
  assert.ok(near(r[0], 0, 1e-9) && near(r[1], 0, 1e-9) && near(r[2], -1, 1e-9));
  // the ellipse is normalised; at angle 0 it is the major axis
  assert.deepEqual(orbitPosition([0, 0, 0], [1, 1], 0).map((v) => Math.round(v * 1e9) / 1e9), [1, 0, 0]);
  // an arbitrary-axis rotation of a vector about itself is the vector
  const v = rotateArbitraryAxis([0, 1, 0], 37, [0, 1, 0]);
  assert.ok(near(v[0], 0, 1e-9) && near(v[1], 1, 1e-9) && near(v[2], 0, 1e-9));
  // and 90 about +Y takes +Z to +X (right-hand rule, as the matrix is written)
  const w = rotateArbitraryAxis([0, 0, 1], 90, [0, 1, 0]);
  assert.ok(near(w[0], 1, 1e-9) && near(w[2], 0, 1e-9));
  // a moon's direction is unit length and moves with _WorldTime
  const mat = { ...MATERIAL_DEFAULTS, _WorldTime: 0 };
  const a = moonDirection(mat, 'Moon', 0), b = moonDirection(mat, 'Moon', 20000);
  assert.ok(near(Math.hypot(...a), 1, 1e-9));
  assert.ok(!near(a[0], b[0], 1e-3) || !near(a[1], b[1], 1e-3), 'the moon moves across the day');
  // over one day the orbit turns 86400 * 0.0000725 radians - just under a turn
  assert.ok(near(86400 * 0.0000725, 6.264, 1e-3));
});

// ── TIME, SUN, FOG COLOUR ─────────────────────────────────────────
test('DS1 sun: SunlightManager’s rotation over the INT minute, UNCLAMPED - under the horizon all night', () => {
  const noon = sunLightDirection(12 * 60);
  assert.ok(near(noon[0], 0, 1e-9) && near(noon[1], 1, 1e-9));
  const dawn = sunLightDirection(6 * 60);
  assert.ok(near(dawn[0], 1, 1e-9) && near(dawn[1], 0, 1e-9), 'dawn from map east');
  const midnight = sunLightDirection(0);
  assert.ok(near(midnight[1], -1, 1e-9), 'straight down at midnight - the port’s worldClock clamps this for the world light');
  assert.ok(near(sunDirection(0)[1], 0, 1e-9), 'and the world light’s sunDirection still sits on the horizon');
  // the int minute: 12:00:30 is 12:00
  assert.deepEqual(sunLightDirection(12 * 60 + 0.5), noon);
  assert.equal(sunCurveTime(6 * 60), 0); assert.equal(sunCurveTime(18 * 60), 1); assert.equal(sunCurveTime(0), -0.5);
  // _WorldTime: seconds of the day
  assert.equal(worldTimeSeconds(0), 0); assert.equal(worldTimeSeconds(90.5), 5430); assert.equal(worldTimeSeconds(1440), 0);
  // _LightColor0: the rig's colour linearised x 0.6 x the mod's curve x the weather
  const keys = parseLightCurve(assets().lightCurve);
  const c = sunLightColor(12 * 60, keys, 0.25);
  assert.ok(near(c[2], srgbToLinear(1) * 0.6 * 1 * 0.25));
  assert.deepEqual(sunLightColor(0, keys, 1), [0, 0, 0], 'the curve is 0 outside dawn..dusk');
});

test('DS1 fog colour: setFogColor - SmoothStep(lerpDuration, 0, sunY) rescaled by 0.66, squared, day colour to black', () => {
  assert.ok(near(mathfSmoothStep(0.66, 0, 0), 0.66)); assert.ok(near(mathfSmoothStep(0.66, 0, 1), 0)); assert.ok(near(mathfSmoothStep(0.66, 0, 0.5), 0.33));
  const s = parseSkyboxSetting(read(`${V}/SkyboxSettings/SkyboxSunny.json`));
  const day = parseHtmlColor(s.FogDayColor);
  assert.deepEqual(fogColorNow(s, s.AtmosphereLerpDuration, 1), day.slice(0, 3), 'sun high: the day colour');
  assert.deepEqual(fogColorNow(s, s.AtmosphereLerpDuration, 0), [0, 0, 0], 'sun on the horizon: black');
  assert.deepEqual(fogColorNow(s, s.AtmosphereLerpDuration, -0.5), [0, 0, 0], 'and under it');
  const half = fogColorNow(s, s.AtmosphereLerpDuration, 0.5);
  const t = Math.min(1, 0.33 / 0.66) ** 2;   // lerpScale 0.5, squared
  assert.ok(near(half[0], day[0] * (1 - t)));
  assert.equal(fogColorNow({ FogDayColor: null }, 0.66, 1), null, 'no parse, no write');
});

// ── LIGHTNING ─────────────────────────────────────────────────────
test('DS1 lightning: LightningFlash - the 50% roll, the 33% double, the randomised light, on for 0.2 s then off', () => {
  // rolls: [start < 0.5 -> flash] [double < 0.33? no] then FlashOnce's 8 draws
  const f = new LightningFlash(seq([0.1, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
  assert.equal(f.startFlash([10, 20, 30]), true);
  const on = f.tick(0.05);
  assert.ok(on, 'lit on the first frame');
  assert.ok(near(on.x, 10) && near(on.y, 20 + 30) && near(on.z, 30), 'over the player: (-10..10, 20..40, -10..10) at the midpoint');
  assert.ok(near(on.range, 750), 'range 500..1000');
  assert.ok(near(on.color[0], 0.9 * 1.0), 'colour 0.8..1 x intensity 0.5..1.5');
  assert.ok(f.tick(0.1), 'still on at 0.1 s (the entering frame is not charged)');
  assert.ok(f.tick(0.09), 'still on at 0.19 s');
  assert.equal(f.tick(0.02), null, 'off after 0.2 s');
  // a hitch: the frame that starts a flash is lit whatever its dt
  const hitch = new LightningFlash(seq([0.1, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
  hitch.startFlash([0, 0, 0]);
  assert.ok(hitch.tick(0.25), 'a 0.25 s frame still shows the flash it started');
  assert.equal(hitch.tick(0.25), null);
  // a miss: Random.value >= 0.5
  const g = new LightningFlash(seq([0.7]));
  assert.equal(g.startFlash([0, 0, 0]), false);
  assert.equal(g.tick(0.1), null);
  // a double flash: two halves of 0.1 with a 0.1 gap
  const d = new LightningFlash(seq([0.1, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
  assert.equal(d.startFlash([0, 0, 0]), true);
  assert.ok(d.tick(0.05), 'lit on the entering frame'); assert.ok(d.tick(0.05), 'still lit at 0.05'); assert.equal(d.tick(0.05), null, 'first half over at 0.1');
  assert.equal(d.tick(0.04), null, 'the gap'); assert.ok(d.tick(0.06), 'the second half, at the gap\u2019s end'); assert.equal(d.tick(0.1), null);
  // stopAll: the interior teardown
  const h = new LightningFlash(seq([0.1, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
  h.startFlash([0, 0, 0]); h.tick(0.01); h.stopAll();
  assert.equal(h.tick(0.01), null);
});

test('DS1 pixel snow: InitSnow’s numbers - sizes /100000 (viewport fractions), the count x1000 and unused', () => {
  assert.deepEqual(pixelSnowSettings({}), { minParticleSize: 0.001, maxParticleSize: 0.003, maxParticles: 20000 });
  assert.deepEqual(pixelSnowSettings({ MinParticleSize: 800, MaxParticleSize: 100, MaxParticles: 15 }), { minParticleSize: 0.008, maxParticleSize: 0.001, maxParticles: 15000 });
});

// ── THE INSTANCE ──────────────────────────────────────────────────
test('DS1 runtime: Init, the pending weather applied a frame late, the fog colour every second, the moons every frame', () => {
  const d = new DynamicSkies(assets(), { densitySetting: 2 }, () => 0.25);
  assert.equal(d.currentWeather, 'sunny');
  assert.equal(d.pendingWeather, true, 'Init leaves the first apply pending');
  assert.ok(near(d.fogSettings.heavy.density, 0.05000000074505806 / 9), 'densitySetting 2 divides by 9');
  assert.equal(d.pixelSnow, null, 'ActivatePixelSnow off');
  const base = 405 * 360 * MINUTES_PER_DAY + 10 * MINUTES_PER_DAY;
  const st = d.tick({ minuteOfDay: 12 * 60, classicMinutes: base + 12 * 60, weather: 'sunny', seconds: 0, dt: 1 / 60, weatherScale: 1 });
  assert.equal(d.pendingWeather, false, 'applied');
  assert.equal(st.mat._CloudTopDiffuse, 'CdMSunny');
  assert.equal(st.mat._WorldTime, 12 * 3600);
  assert.deepEqual(st.sunDir.map((v) => Math.round(v * 1e6) / 1e6), [0, 1, 0]);
  assert.ok(st.fogColor, 'the fog colour is written on the apply');
  assert.deepEqual(st.clearColor, st.fogColor, 'the sky publishes its fog colour as the horizon the world fogs to');
  assert.deepEqual(st.mat._MoonOrbitAngle.slice(0, 2), [270, 90], 'ApplyOrbitCalculations ran');
  assert.equal(d.currentDayPart, DAY_PARTS.Midday);
  // the sim's word changes -> OnWeatherChange -> pending -> applied next tick
  d.tick({ minuteOfDay: 12 * 60 + 1, classicMinutes: base + 12 * 60 + 1, weather: 'thunder', seconds: 0.5, dt: 1 / 60, weatherScale: 0.25 });
  assert.equal(d.currentWeather, 'thunder');
  assert.equal(d.mat._CloudTopDiffuse, 'CdMThunder');
  assert.equal(d.lightningListening, true, 'Thunder starts the listener');
  assert.equal(d.mat._FogDistance, 384);
  assert.equal(d.fogSettingsFor('thunder').mode, 'exp2');
  // the fog colour holds for a second of real time (no apply, no day-part
  // change in between), then follows the sun
  const c0 = [...d.fogColor];
  d.tick({ minuteOfDay: 12 * 60 + 2, classicMinutes: base + 12 * 60 + 2, weather: 'thunder', seconds: 0.9, dt: 1 / 60, weatherScale: 0.25 });
  assert.deepEqual([...d.fogColor], c0, 'not yet a second');
  d.tick({ minuteOfDay: 17 * 60 + 50, classicMinutes: base + 17 * 60 + 50, weather: 'thunder', seconds: 1.6, dt: 1 / 60, weatherScale: 0.25 });
  assert.ok(d.fogColor[0] < c0[0], 'a second on, near dusk, the fog is darker');
  // an ambient effect under thunder rolls the flash (rng 0.25 < 0.5 and < 0.33: a double)
  assert.equal(d.onAmbientEffect([1, 2, 3]), true);
  d.tick({ minuteOfDay: 17 * 60 + 50, classicMinutes: base + 17 * 60 + 50, weather: 'thunder', seconds: 1.7, dt: 0.01, weatherScale: 0.25 });
  assert.ok(d.lightningLight, 'the light is on');
  assert.ok(d.lightningLight.range >= 500 && d.lightningLight.range <= 1000);
  // sunny again: the listener stops and the flash never rolls
  d.tick({ minuteOfDay: 17 * 60 + 50, classicMinutes: base + 17 * 60 + 50, weather: 'sunny', seconds: 2, dt: 1 / 60, weatherScale: 1 });
  assert.equal(d.lightningListening, false);
  assert.equal(d.onAmbientEffect([1, 2, 3]), undefined);
  // inside: the flash is torn down and the listener with it
  d.tick({ minuteOfDay: 17 * 60 + 50, classicMinutes: base + 17 * 60 + 50, weather: 'thunder', seconds: 3, dt: 1 / 60, weatherScale: 0.25 });
  d.setInside(true);
  assert.equal(d.lightningListening, false);
  d.setInside(false);
  assert.equal(d.lightningListening, true);
  // a load: weatherJump forces the loaded weather through
  d.weatherJump('snow');
  assert.equal(d.pendingWeather, true);
  d.tick({ minuteOfDay: 2 * 60, classicMinutes: base + 2 * 60, weather: 'snow', seconds: 4, dt: 1 / 60, weatherScale: 0.45 });
  assert.equal(d.currentWeather, 'snow');
  assert.equal(d.currentDayPart, DAY_PARTS.Night);
  assert.equal(d.weatherIndex(), 1, 'night index... which is the day preset, the night file not being shipped');
  assert.equal(d.mat._CloudTopDiffuse, 'CdMThunder', 'SkyboxSnow’s top layer');
  // a moon's direction is the shader's, on the CPU
  const m = d.moonDirection('Moon');
  assert.ok(near(Math.hypot(...m), 1, 1e-9));
});

// ── THE SHADER ────────────────────────────────────────────────────
test('DS1 shader: every property the mod declares is a uniform of the same name, and the material’s keywords are baked', () => {
  const src = read(`${V}/Shaders/BLBProceduralSkybox.shader`);
  const props = [...src.matchAll(/^\s*(?:\[[^\]]+\]\s*)*(_[A-Za-z0-9]+)\s*\(/gm)].map((m) => m[1]);
  assert.ok(props.length > 80, 'the property block read');
  const glslUniforms = new Set([...FS.matchAll(/uniform\s+[a-zA-Z0-9]+\s+([^;]+);/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())));
  for (const p of props) {
    if (['_Lut', '_ReduceColor', '_SunDisk', '_MoonPhaseOption', '_MoonSpinOption', '_SecundaPhaseOption', '_SecundaSpinOption'].includes(p)) continue;   // keywords / the unused LUT
    assert.ok(glslUniforms.has(p), `${p} is not a uniform of the GLSL`);
  }
  for (const s of TEXTURE_SLOTS) { assert.ok(glslUniforms.has(s)); assert.ok(glslUniforms.has(s + '_ST')); }
  // the baked keywords: REDUCE_COLOR's posterise, HQ sun disk, both tidal locks
  assert.match(FS, /ceil\(col\.r \/ \(_stepSize - \(lerpScale_pow \* _stepSize\) \+ 0\.001\)\)/, 'REDUCE_COLOR');
  assert.match(FS, /getMiePhase\(-focusedEyeCos, focusedEyeCos \* focusedEyeCos, SunSize\)/, '_SUNDISK_HIGH_QUALITY');
  assert.match(FS, /moonFragNormal = phaseNormal;\s*\n\s*moonFragNormal = RotateWorldPosition\(moonFragNormal, vec3\(radiansOf\(_MoonTidalAngle\.x\)/, '_MOONSPINOPTION_TIDAL_LOCK');
  assert.match(FS, /SecundaMoonFragNormal = SecundaPhaseNormal;/, '_SECUNDASPINOPTION_TIDAL_LOCK');
  // linear colour space: no sqrt on the colours, the output encoded
  assert.doesNotMatch(FS, /OUT\.skyColor\s*=\s*sqrt/);
  assert.match(FS, /enc = vec3\(linearToSrgb\(lin\.r\), linearToSrgb\(lin\.g\), linearToSrgb\(lin\.b\)\);/);
  // UnpackNormal is the desktop arm (x rides R * A) and BlendNormals is Unity's
  assert.match(FS, /packednormal\.x \*= packednormal\.w;/);
  assert.match(FS, /normalize\(vec3\(n1\.xy \+ n2\.xy, n1\.z \* n2\.z\)\)/);
  // HLSL's smoothstep, spelled out, is the one the clouds use
  assert.match(FS, /cloudsTop = hsmoothstep\(_CloudTopAlphaCutoff, _CloudTopAlphaMax, cloudsTop\);/);
  // the colour lists cover every colour property once
  assert.equal(new Set(COLOR_PROPERTIES).size, COLOR_PROPERTIES.length);
  assert.equal(new Set(FLOAT_PROPERTIES).size, FLOAT_PROPERTIES.length);
  assert.ok(!FLOAT_PROPERTIES.includes('_CloudTopColorBoost'), 'the top boost is the float3 quirk, uploaded apart');
  // ...and every uniform the GLSL declares has its location fetched (the
  // DS1 review: `_CloudTopColorBoost` was read by the shader and fetched
  // by nobody, so its upload was a silent no-op)
  const fetched = new Set(UNIFORM_NAMES);
  for (const u of glslUniforms) assert.ok(fetched.has(u), `${u} is declared by the FS and never fetched`);
  assert.equal(new Set(UNIFORM_NAMES).size, UNIFORM_NAMES.length);
  // the horizon: below it `vert` runs at the mesh's vertex rows, never a hair under the line
  assert.match(FS, /V2F IN = vertAsMesh\(worldPos\);/);
  assert.match(FS, /#define MESH_ROW 0\.0625/);
});

// ── THE SEAM ──────────────────────────────────────────────────────
test('DS1 seam: the controller stands the mod beside the dome on the one lane, and both hosts are wired', () => {
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /const dynamicOn = enhancedLane && \(skyDoor === 'dynamic' \|\| \(skyDoor === null && modSetting\('dynamic-skies', 'Enabled'\)\)\);/,
    'the mod’s own switch, under the lane; ?sky=dynamic forces it, any other door the dome');
  assert.match(shared, /setLightCurve\(dynamic \? dynamic\.lightCurve : null\);/, 'SetLightCurve for the world while it is the sky');
  assert.match(shared, /fogSettings: dynamic\?\.fogSettings,/);
  assert.match(shared, /onAmbientEffect\(playerPos\) \{ dynamic\?\.onAmbientEffect\(playerPos\); \}/);
  assert.match(shared, /lightningLight\(\) \{ return dynamic\?\.lightningLight \?\? null; \}/);
  assert.match(shared, /dynamic\?\.weatherJump\(\);/, 'a load forces the mod’s re-apply');
  assert.match(shared, /weatherScale: weatherSunlightScale\(weatherName, winter\)/, '_LightColor0 takes WeatherManager’s ScaleFactor');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.match(s, /fogForWeather\(weather, sky\.fogSettings\)/, `${host}: the boot fog over the mod’s table`);
    assert.match(s, /fogForWeather\(w, sky\.fogSettings\)/, `${host}: and every change`);
    assert.match(s, /const fogColor = sky\.fogColorFor\(fogNow\);/, `${host}: the fog colour through the controller`);
    assert.match(s, /ambience\.onPlayEffect = \(clip, playerPos\) => sky\.onAmbientEffect\(playerPos\);/, `${host}: OnPlayEffect reaches the listener`);
    assert.match(s, /renderer\.setFlashLight\(sky\.lightningLight\(\)\);/, `${host}: the flash on the light channel`);
    assert.match(s, /if \(sky\.pixelSnow\) precipOpts\.pixelSnow = sky\.pixelSnow;/, `${host}: the pixel snow`);
    // the flash composes AFTER the lanterns are stored
    assert.ok(s.lastIndexOf('renderer.setPointLights(') < s.indexOf('renderer.setFlashLight(sky.lightningLight())'), `${host}: setFlashLight follows setPointLights`);
  }
  // the classic pass knows nothing of it
  assert.doesNotMatch(read('src/render/skyRenderer.js'), /dynamic/i);
  // the lab has the door
  assert.match(read('src/tools/skyLab.js'), /params\.get\('sky'\) === 'dynamic'/);
});

test('DS1 renderer: exp2 fog in every world pass, and the flash composes first under the cap of sixteen', () => {
  const r = read('src/render/renderer.js');
  assert.equal((r.match(/if \(uFogMode == 3\) \{ float f = uFogDensity \* d; return exp\(-f \* f\); \}/g) || []).length, 6, 'every fogFactorAt');
  assert.match(r, /mode === 'exp2' \? 3 : 0/);
  assert.match(r, /const FOG_MODE_NAMES = \['off', 'linear', 'exp', 'exp2'\];/);
  // the composition, on a state object with the renderer's fields
  const st = {
    _pointLights: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]), _pointColors: null, _pointColor: new Float32Array([0.5, 0.5, 0.5]),
    _flashLightScratch: new Float32Array(64), _flashColorScratch: new Float32Array(48), _flashLight: null,
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

test('DS1 settings: the mod’s own keys as modsettings ships them, the integer keys clamped, the Mods pane renders steppers', () => {
  _resetModSettings();
  try {
    const m = MOD_SETTINGS['dynamic-skies'];
    assert.equal(m.title, 'Dynamic Skies');
    assert.deepEqual(Object.keys(m.keys), ['Enabled', 'densitySetting', 'ActivatePixelSnow', 'MinParticleSize', 'MaxParticleSize', 'MaxParticles']);
    const ms = JSON.parse(read(`${V}/modsettings.json`));
    for (const sec of ms.Sections) {
      for (const k of sec.Keys) {
        const def = m.keys[k.Name];
        assert.ok(def, `${k.Name} carried`);
        assert.equal(def.default, k.Value, `${k.Name} default`);
        if (k.Min !== undefined) { assert.equal(def.min, k.Min); assert.equal(def.max, k.Max); assert.ok(isIntKey(def)); }
        else assert.ok(!isIntKey(def));
        assert.ok(def.description.startsWith(k.Description), `${k.Name} description is the mod’s`);
      }
    }
    assert.equal(modSetting('dynamic-skies', 'Enabled'), true, 'on by being installed');
    assert.equal(modSetting('dynamic-skies', 'densitySetting'), 1);
    assert.equal(setModSetting('dynamic-skies', 'densitySetting', 14), 10, 'clamped to the slider');
    assert.equal(setModSetting('dynamic-skies', 'densitySetting', 0), 1);
    assert.equal(setModSetting('dynamic-skies', 'MinParticleSize', 250.7), 250, 'an integer');
    assert.equal(modSetting('dynamic-skies', 'ActivatePixelSnow'), false);
    const all = modSettingsOf('dynamic-skies');
    assert.equal(all.MinParticleSize, 250); assert.equal(all.Enabled, true);
    assert.equal(modSetting('roads-hazelnut', 'SmoothRoads'), true, 'the toggles read as before');
    assert.match(read('src/ui/enhancedMenu.js'), /if \(isIntKey\(def\)\) \{/, 'the pane steps the integer keys');
  } finally { _resetModSettings(); }
});
