// DYNAMIC SKIES (DS1, 2026-09-04, Mac's call: "I want to implement this
// mod 1:1. We received permission from the creator.")
//
// The LOGIC of Dynamic Skies 2.3.4 for Daggerfall Unity, by BadLuckBurt
// and carademono - BLBSkybox.cs and the Scripts/ structs - ported line
// for line, quirks included. Everything here is pure: JSON in, numbers
// out, so node can pin it against the vendored presets. The GL half
// (the BLBProceduralSkybox shader) is render/dynamicSkiesRenderer.js;
// the seam that drives both is scenes/shared.js createSkyController.
//
// The mod's own files are vendored verbatim under vendor/dynamic-skies
// (the seven SkyboxSettings presets, the five FogSettings, the light
// curve, the textures the presets name, the shader sources) with the
// author's permission recorded in its README.
//
// WHAT THE MOD DOES, in the order BLBSkybox.Init does it:
//   1. replaces SunlightManager.LightCurve with LightCurve.json
//      (SetLightCurve) - so the WORLD's daylight curve changes too;
//   2. sets the skybox material's base values and turns the vanilla
//      DaggerfallSky off (dfSky.SetActive(false));
//   3. loads a preset per WeatherType (loadAllSkyboxSettings; the
//      *Night.json variants are NOT in the shipped manifest, so index 1
//      is index 0) and the five fog presets, which REPLACE
//      WeatherManager's fog settings with density / (11 - densitySetting);
//   4. optionally swaps the snow particles' material for PixelSnow;
//   5. per frame (Update, exterior only): the day-part machine,
//      ChangeLunarPhases -> ApplyOrbitCalculations (the moons' orbits from
//      DFU's own phase ladder), UpdateWorldTime (_WorldTime = seconds of
//      the day), and every real second setFogColor (RenderSettings.fogColor
//      and _FogColor from the sun's height);
//   6. on a WeatherManager.OnWeatherChange event: ApplySkyboxSettings for
//      the new weather next frame, and the lightning listener for Thunder
//      (LightningFlash: a point light over the player on each
//      AmbientEffectsPlayer.OnPlayEffect).
//
// QUIRKS KEPT, because "1:1" means the mod as it ships, not as it might
// have been meant (each is marked QUIRK where it lands):
//   - ApplySkyboxSettings writes the Masser tidal angle to
//     `_MasserTidalAngle`, a property the shader does not have; the
//     shader's `_MoonTidalAngle` keeps the material's (0, 300, 0).
//   - `_CloudSunScale` takes the TOP layer's SunColorScale.
//   - `_TwinkleTex`'s offset is the stars' offset, not the twinkle offset.
//   - `_CloudTopColorBoost` is a float3 in the shader fed by a float, so
//     only its red channel is boosted (the readme: "broken on the top
//     layer for some reason").
//   - `_CloudDirection` is the preset's Direction (absent -> 0), so the
//     random wind direction rolled at Init is overwritten on the first
//     apply and the clouds always travel +X.
//   - `firstInit` is set to true inside the branch it guards, so the
//     textures are refreshed on every apply.
//   - MaxParticles is read, logged and never applied (BLBSkybox.maxParticles
//     has no reader).
//   - HandleDawnDusk returns on its first line: the atmosphere lerp never
//     runs and `_AtmosphereLerp` is the preset's value.
//
// DFU FACTS the mod leans on (verified in the DFU tree, 2026-09-04):
//   - SunlightManager.Update: time = (MinuteOfDay - dawn) / dayRange
//     UNCLAMPED, xrot = 180 * time, Euler(xrot, -90, 0) - the sun keeps
//     turning under the horizon all night (the port's worldClock clamps
//     its sunDirection for the WORLD light, which DFU disables at night
//     anyway; the SKY reads the unclamped one). MinuteOfDay is an int.
//   - ProjectSettings m_ActiveColorSpace: 1 - DFU renders in LINEAR
//     colour space. Material.SetColor values are sRGB and are linearised
//     at upload; SetVector/SetFloat are raw; sRGB textures are linearised
//     on sample; the skybox writes linear and the backbuffer encodes.
//   - WeatherType.None == WeatherType.Sunny (Weather.cs:21).
//   - DaggerfallDateTime.Second is a float; RaiseTime adds
//     Time.deltaTime * TimeScale (12) each frame.
//   - AmbientEffectsPlayer raises OnPlayEffect from PlayEffects on every
//     one-shot it plays (the cemetery layer does not raise it).

import { LUNAR_PHASES, lunarPhase, dayOfYear, MONTHS_PER_YEAR, DAYS_PER_MONTH } from './gameDate.js';
import { SUN_RIG_COLOR, SUN_RIG_INTENSITY, evaluateCurve, DAWN_HOUR, DUSK_HOUR, MINUTES_PER_HOUR } from '../world/worldClock.js';

export const DYNAMIC_SKIES_MOD = Object.freeze({
  title: 'Dynamic Skies',
  version: '2.3.4',
  author: 'BadLuckBurt and carademono',
  contact: "Lysandus' Tomb Discord server",
  guid: '53a9b8f5-6271-4f74-9b8b-9220dd105a04',
  vendor: 'dynamic-skies',
});

/** loadAllSkyboxSettings: the preset the mod loads per WeatherType,
 *  keyed by the port's weather names (WeatherType.None == Sunny). */
export const WEATHER_PRESET = Object.freeze({
  sunny: 'SkyboxSunny', cloudy: 'SkyboxCloudy', overcast: 'SkyboxOvercast', fog: 'SkyboxFog',
  rain: 'SkyboxRain', thunder: 'SkyboxThunder', snow: 'SkyboxSnow',
});

/** loadFogSettings' dictionary (BLBSkybox.cs:1100-1108): which of the
 *  five WeatherManager fog settings each weather uses. Cloudy takes the
 *  sunny fog and Thunder the rainy one, as WeatherManager.SetWeather. */
export const FOG_PRESET_FOR_WEATHER = Object.freeze({
  sunny: 'FogSunny', cloudy: 'FogSunny', overcast: 'FogOvercast', fog: 'FogHeavyFog',
  rain: 'FogRainy', thunder: 'FogRainy', snow: 'FogSnowy',
});

/** "Because game runs at timescale 12" - the mod's own constant. */
export const TIMESCALE_FACTOR = 0.0833;

/** UnityEngine.FogMode: Linear 1, Exponential 2, ExponentialSquared 3. */
export const UNITY_FOG_MODES = Object.freeze({ 1: 'linear', 2: 'exp', 3: 'exp2' });

// ── ColorUtility / colour space ───────────────────────────────────

/** ColorUtility.TryParseHtmlString("#" + s) for the mod's "RRGGBBAA"
 *  strings: an sRGB Color, channels /255. null when it would fail. */
export function parseHtmlColor(s) {
  if (typeof s !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(s.trim());
  if (!m) return null;
  const h = m[1] + (m[2] ?? 'FF');
  return [0, 1, 2, 3].map((i) => parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255);
}

/** Mathf.GammaToLinearSpace - the sRGB EOTF, which is what a Material
 *  colour property goes through at upload under linear colour space. */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
/** Mathf.LinearToGammaSpace. */
export function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ── The preset structs (JsonUtility semantics) ─────────────────────

/** JsonUtility.FromJson into a struct: a field absent from the JSON is
 *  its default (0, null), and the flat sub-settings are JSON strings
 *  parsed a second time (ProcessSkyboxSetting). */
const num = (o, k) => (typeof o?.[k] === 'number' ? o[k] : 0);
const str = (o, k) => (typeof o?.[k] === 'string' ? o[k] : null);
const vec4 = (o, k) => {
  const v = o?.[k];
  return v && typeof v === 'object' ? [num(v, 'x'), num(v, 'y'), num(v, 'z'), num(v, 'w')] : [0, 0, 0, 0];
};

function cloudsSetting(o) {   // BLBCloudsSetting
  return {
    CloudsTextureFile: str(o, 'CloudsTextureFile'), CloudsNormalTextureFile: str(o, 'CloudsNormalTextureFile'),
    TilingX: num(o, 'TilingX'), TilingY: num(o, 'TilingY'), OffsetX: num(o, 'OffsetX'), OffsetY: num(o, 'OffsetY'),
    DayColor: str(o, 'DayColor'), NightColor: str(o, 'NightColor'),
    AlphaTreshold: num(o, 'AlphaTreshold'), AlphaMax: num(o, 'AlphaMax'), ColorBoost: num(o, 'ColorBoost'),
    NormalEffect: num(o, 'NormalEffect'), NormalSpeed: num(o, 'NormalSpeed'), Opacity: num(o, 'Opacity'),
    Speed: num(o, 'Speed'), Direction: num(o, 'Direction'), Bending: num(o, 'Bending'),
    BlendSpeed: num(o, 'BlendSpeed'), BlendScale: num(o, 'BlendScale'), BlendLB: num(o, 'BlendLB'), BlendUB: num(o, 'BlendUB'),
    SunColorScale: num(o, 'SunColorScale'), SunColorLerpScale: num(o, 'SunColorLerpScale'), SunColor: str(o, 'SunColor'),
  };
}
function starsSetting(o) {   // BLBStarsSetting
  return {
    StarsTextureFile: str(o, 'StarsTextureFile'),
    StarsTilingX: num(o, 'StarsTilingX'), StarsTilingY: num(o, 'StarsTilingY'),
    StarsOffsetX: num(o, 'StarsOffsetX'), StarsOffsetY: num(o, 'StarsOffsetY'),
    StarBending: num(o, 'StarBending'),
    StarsTwinkleTextureFile: str(o, 'StarsTwinkleTextureFile'), TwinkleTextureFile: str(o, 'TwinkleTextureFile'),
    TwinkleTilingX: num(o, 'TwinkleTilingX'), TwinkleTilingY: num(o, 'TwinkleTilingY'),
    TwinkleOffsetX: num(o, 'TwinkleOffsetX'), TwinkleOffsetY: num(o, 'TwinkleOffsetY'),
    TwinkleBoost: num(o, 'TwinkleBoost'), TwinkleSpeed: num(o, 'TwinkleSpeed'),
  };
}
function moonSetting(o) {   // BLBMoonSetting
  return {
    MoonColor: str(o, 'MoonColor'), MoonTextureFile: str(o, 'MoonTextureFile'),
    TilingX: num(o, 'TilingX'), TilingY: num(o, 'TilingY'), OffsetX: num(o, 'OffsetX'), OffsetY: num(o, 'OffsetY'),
    MinSize: num(o, 'MinSize'), MaxSize: num(o, 'MaxSize'),
    OrbitAngle: vec4(o, 'OrbitAngle'), OrbitOffset: num(o, 'OrbitOffset'), OrbitSpeed: num(o, 'OrbitSpeed'),
    SemiMinAxis: num(o, 'SemiMinAxis'), SemiMajAxis: num(o, 'SemiMajAxis'),
    AutoPhase: num(o, 'AutoPhase'), Phase: vec4(o, 'Phase'), Spin: num(o, 'Spin'),
    TidalAngle: vec4(o, 'TidalAngle'), SpinSpeed: vec4(o, 'SpinSpeed'),
  };
}

/** ProcessSkyboxSetting (BLBSkybox.cs:1470-1481): the outer struct and
 *  its five flattened sub-structs. */
export function parseSkyboxSetting(jsonText) {
  const o = JSON.parse(jsonText);
  const sub = (k) => (typeof o[k] === 'string' ? JSON.parse(o[k]) : {});
  return {
    SunSize: num(o, 'SunSize'), SunSizeConvergence: num(o, 'SunSizeConvergence'),
    AtmosphereLerpDuration: num(o, 'AtmosphereLerpDuration'),
    AtmosphereNormalThickness: num(o, 'AtmosphereNormalThickness'),
    AtmosphereDawnDuskThickness: num(o, 'AtmosphereDawnDuskThickness'),
    AtmosphereLerp: num(o, 'AtmosphereLerp'),
    SkyTint: str(o, 'SkyTint'), GroundColor: str(o, 'GroundColor'),
    AmbientColor: str(o, 'AmbientColor'), AmbientIntensity: num(o, 'AmbientIntensity'),
    Exposure: num(o, 'Exposure'),
    NightStartHeight: num(o, 'NightStartHeight'), NightEndHeight: num(o, 'NightEndHeight'),
    SkyFadeStart: num(o, 'SkyFadeStart'), SkyEndStart: num(o, 'SkyEndStart'),
    stepSize: num(o, 'stepSize'),
    FogDayColor: str(o, 'FogDayColor'), FogNightColor: str(o, 'FogNightColor'), FogDistance: num(o, 'FogDistance'),
    MoonNightColor: str(o, 'MoonNightColor'),
    CloudFadeHeight: num(o, 'CloudFadeHeight'),
    TopClouds: cloudsSetting(sub('TopCloudsFlat')),
    BottomClouds: cloudsSetting(sub('BottomCloudsFlat')),
    Stars: starsSetting(sub('StarsFlat')),
    Masser: moonSetting(sub('MasserFlat')),
    Secunda: moonSetting(sub('SecundaFlat')),
  };
}

/** BLBFogSetting. */
export function parseFogSetting(jsonText) {
  const o = JSON.parse(jsonText);
  return {
    FogModeInt: Math.trunc(num(o, 'FogModeInt')), Density: num(o, 'Density'),
    StartDistance: num(o, 'StartDistance'), EndDistance: num(o, 'EndDistance'),
    ExcludeSkybox: o.ExcludeSkybox === true,
  };
}

/** BLBLightCurve -> AnimationCurve keys. `new Keyframe(time, value)`
 *  leaves both tangents at 0 and AnimationCurve(frames) keeps them, so
 *  the curve is Hermite with FLAT tangents; pre/postWrapMode
 *  ClampForever is worldClock.evaluateCurve's own clamp. */
export function parseLightCurve(jsonText) {
  const o = JSON.parse(jsonText);
  const times = Array.isArray(o.times) ? o.times : [];
  const values = Array.isArray(o.values) ? o.values : [];
  return times.map((t, i) => [Number(t), Number(values[i] ?? 0), 0, 0]);
}

// ── ProcessFogSetting (:1110-1141) ─────────────────────────────────

/** The five WeatherManager fog settings the mod installs, in the port's
 *  FOG_SETTINGS shape (world/weather.js), from the vendored presets and
 *  the FogDensity/densitySetting slider (1..10): density / (11 - x). The
 *  fog MODE is Unity's enum: the mod ships Overcast, Rainy and Snowy as
 *  ExponentialSquared (3), which the port's renderer learnt for it. */
export function fogSettingsFromPresets(fogJsonByName, densitySetting = 1) {
  const fogIntensity = Math.trunc(Number(densitySetting) || 1);
  const conv = (name) => {
    const f = parseFogSetting(fogJsonByName[name]);
    return Object.freeze({
      mode: UNITY_FOG_MODES[f.FogModeInt] ?? 'off',
      density: f.Density / (11 - fogIntensity),
      start: f.StartDistance,
      end: f.EndDistance,
      excludeSky: f.ExcludeSkybox,
    });
  };
  return Object.freeze({
    sunny: conv('FogSunny'),
    overcast: conv('FogOvercast'),
    rainy: conv('FogRainy'),
    snowy: conv('FogSnowy'),
    heavy: conv('FogHeavyFog'),
  });
}

/** fogForWeather over the mod's table (WeatherManager.SetWeather's own
 *  mapping, which is world/weather.js's fogForWeather with a table). */
export function fogPresetKey(weather) {
  switch (FOG_PRESET_FOR_WEATHER[weather] ?? 'FogSunny') {
    case 'FogOvercast': return 'overcast';
    case 'FogHeavyFog': return 'heavy';
    case 'FogRainy': return 'rainy';
    case 'FogSnowy': return 'snowy';
    default: return 'sunny';
  }
}

// ── The material ───────────────────────────────────────────────────

/** BLBSkyboxMaterial.mat as it ships in the bundle: every property the
 *  shader reads, with the value the material carries before any preset
 *  is applied. Colours are sRGB (SetColor); vectors and floats raw.
 *  Keywords: REDUCE_COLOR, _SUNDISK_HIGH_QUALITY, both spin options
 *  TIDAL_LOCK, PHASE_LIGHT off - baked into the shader, not switchable. */
export const MATERIAL_DEFAULTS = Object.freeze({
  _SunSize: 0.1, _SunSizeConvergence: 10,
  _AtmosphereLerpDuration: 0.66, _AtmosphereNormalThickness: 0.75, _AtmosphereDawnDuskThickness: 1.5, _AtmosphereLerp: 1,
  _SkyTint: [0.3803922, 0.4627451, 0.8627451, 1], _GroundColor: [0.2980392, 0.2980392, 0.2980392, 1],
  _Exposure: 1.5,
  _NightStartHeight: 0.01, _NightEndHeight: -0.01, _SkyFadeStart: -0.01, _SkyFadeEnd: -0.04,
  _stepSize: 0.015,
  _FogColor: [0.116297, 0.1280244, 0.1788433, 1],
  _FogDayColor: [0.4666667, 0.5137255, 0.7176471, 1], _FogNightColor: [0, 0, 0, 1], _FogDistance: 1500,
  _MoonNightColor: [0, 0, 0.1529412, 1],
  _CloudFadeHeight: 0.2,
  _CloudTopColor: [0.7803922, 0.7803922, 0.7803922, 1], _CloudTopNightColor: [0.1882353, 0.1882353, 0.1882353, 1],
  _CloudTopAlphaCutoff: 0.02, _CloudTopAlphaMax: 0.757, _CloudTopColorBoost: 0.665, _CloudTopNormalEffect: 0.329,
  _CloudTopOpacity: 0.797, _CloudTopBending: 0, _CloudTopSunScale: 1, _CloudTopSunLerpScale: 1,
  _CloudTopSunColor: [0.09803922, 0.09803922, 0.09803922, 1],
  _CloudColor: [0.7803922, 0.7803922, 0.7803922, 1], _CloudNightColor: [0.1372549, 0.1372549, 0.1607843, 1],
  _CloudAlphaCutoff: 0.02, _CloudAlphaMax: 0.757, _CloudColorBoost: 0.665, _CloudNormalEffect: 0.665,
  _CloudNormalSpeed: 0, _CloudOpacity: 0.557, _CloudSpeed: 0.000104125, _CloudDirection: 0, _CloudBending: 0.15,
  _CloudBlendSpeed: 0, _CloudBlendScale: 0, _CloudBlendLB: 0, _CloudBlendUB: 0,
  _CloudSunScale: 1, _CloudSunLerpScale: 1, _CloudSunColor: [0.1019608, 0.1019608, 0.1019608, 1],
  _StarBending: 1, _TwinkleBoost: 1, _TwinkleSpeed: 0.004165,
  _MoonColor: [0.6705883, 0.6705883, 0.6705883, 1], _MoonMaxSize: 0.11, _MoonMinSize: 0.11,
  _MoonOrbitAngle: [270, 90, 18.21058, 0], _MoonOrbitOffset: 65.57854, _MoonOrbitSpeed: 0.0000725,
  _MoonSemiMajAxis: 1, _MoonSemiMinAxis: 1, _MoonPhaseOption: 0, _MoonPhase: [-114.4215, 0, 0, 0],
  _MoonSpinOption: 0, _MoonTidalAngle: [0, 300, 0, 0], _MoonSpinSpeed: [0.00833, 0, 0, 0],
  _SecundaColor: [0.6705883, 0.6705883, 0.6705883, 1], _SecundaMaxSize: 0.07, _SecundaMinSize: 0.07,
  _SecundaOrbitAngle: [270, 90, 29.38951, 0], _SecundaOrbitOffset: 101.5785, _SecundaOrbitSpeed: 0.0000725,
  _SecundaSemiMajAxis: 0.6, _SecundaSemiMinAxis: 0.9, _SecundaPhaseOption: 0, _SecundaPhase: [-78.42146, 0, 0, 0],
  _SecundaSpinOption: 0, _SecundaTidalAngle: [30, 160, -30, 0], _SecundaSpinSpeed: [0.1, 0, 0, 0],
  _WorldTime: 0,
  // the texture slots and their scale/offset (_ST = tiling.xy, offset.zw)
  _CloudTopDiffuse: 'CdMSunny', _CloudTopDiffuse_ST: [0.2, 0.2, 0, 0],
  _CloudTopNormal: 'CdMCloudsNormal', _CloudTopNormal_ST: [1, 1, 0, 0],
  _CloudDiffuse: 'CdMSunny2', _CloudDiffuse_ST: [0.25, 0.25, 0.5, 0],
  _CloudNormal: 'CdMCloudsNormal', _CloudNormal_ST: [1, 1, 0, 0],
  _StarTex: 'VanillaStars', _StarTex_ST: [0.25, 0.25, 0, 0],
  _StarTwinkleTex: 'VanillaStarsTwinkleMask', _StarTwinkleTex_ST: [0.25, 0.25, 0, 0],
  _TwinkleTex: 'NLstarsHighlight', _TwinkleTex_ST: [1, 1, 0, 0],
  _MoonTex: 'PixelMars', _MoonTex_ST: [0, 0, 0, 0],
  _SecundaTex: 'PixelEnceladus', _SecundaTex_ST: [0, 0, 0, 0],
});

/** The material values Init writes before the first preset (:115-125).
 *  `windDirection` is getWindDirection()'s Random.Range(0, 360). */
export function initMaterial(windDirection = 0) {
  const mat = { ...MATERIAL_DEFAULTS };
  mat._AtmosphereNormalThickness = 0.75;   // Instance.atmosphere
  mat._AtmosphereDawnDuskThickness = 0.75;
  mat._AtmosphereLerp = 0;
  mat._SkyTint = [0.5294118, 0.8078431, 0.9215686, 1];
  mat._SunSize = 0.04;
  mat._SunSizeConvergence = 2;
  mat._SkyFadeStart = -0.01;
  mat._SkyFadeEnd = -0.04;
  mat._NightStartHeight = 0.01;
  mat._NightEndHeight = -0.01;
  mat._CloudDirection = windDirection;
  return mat;
}

/** ApplySkyboxSettings (:1304-1468), refreshTextures and updateMoons
 *  both true (they always are: firstInit never clears, and every caller
 *  passes true). A colour that fails to parse leaves the slot as it was,
 *  exactly as the `if (TryParseHtmlString)` guards do. */
export function applySkyboxSettings(mat, s) {
  const color = (key, hex) => { const c = parseHtmlColor(hex); if (c) mat[key] = c; };
  mat._SunSize = s.SunSize;
  mat._SunSizeConvergence = Math.trunc(s.SunSizeConvergence);   // SetInt
  mat._AtmosphereLerpDuration = s.AtmosphereLerpDuration;
  mat._AtmosphereLerp = s.AtmosphereLerp;
  mat._AtmosphereNormalThickness = s.AtmosphereNormalThickness;
  mat._AtmosphereDawnDuskThickness = s.AtmosphereDawnDuskThickness;
  color('_SkyTint', s.SkyTint);
  color('_GroundColor', s.GroundColor);
  // AmbientColor / AmbientIntensity: parsed and never applied (:1326-1331)
  mat._Exposure = s.Exposure;
  mat._NightStartHeight = s.NightStartHeight;
  mat._NightEndHeight = s.NightEndHeight;
  mat._SkyFadeStart = s.SkyFadeStart;
  mat._SkyFadeEnd = s.SkyEndStart;
  mat._stepSize = s.stepSize;
  color('_FogDayColor', s.FogDayColor);
  color('_FogNightColor', s.FogNightColor);
  mat._FogDistance = s.FogDistance;
  color('_MoonNightColor', s.MoonNightColor);
  mat._CloudFadeHeight = s.CloudFadeHeight;
  color('_CloudTopColor', s.TopClouds.DayColor);
  color('_CloudTopNightColor', s.TopClouds.NightColor);
  mat._CloudTopAlphaCutoff = s.TopClouds.AlphaTreshold;
  mat._CloudTopAlphaMax = s.TopClouds.AlphaMax;
  mat._CloudTopColorBoost = s.TopClouds.ColorBoost;
  mat._CloudTopOpacity = s.TopClouds.Opacity;
  mat._CloudTopNormalEffect = s.TopClouds.NormalEffect;
  mat._CloudTopBending = s.TopClouds.Bending;
  mat._CloudTopSunScale = s.TopClouds.SunColorScale;
  mat._CloudTopSunLerpScale = s.TopClouds.SunColorLerpScale;
  color('_CloudTopSunColor', s.TopClouds.SunColor);
  color('_CloudColor', s.BottomClouds.DayColor);
  color('_CloudNightColor', s.BottomClouds.NightColor);
  mat._CloudAlphaCutoff = s.BottomClouds.AlphaTreshold;
  mat._CloudAlphaMax = s.BottomClouds.AlphaMax;
  mat._CloudColorBoost = s.BottomClouds.ColorBoost;
  mat._CloudNormalEffect = s.BottomClouds.NormalEffect;
  mat._CloudOpacity = s.BottomClouds.Opacity;
  mat._CloudSpeed = s.BottomClouds.Speed * TIMESCALE_FACTOR;
  mat._CloudDirection = s.BottomClouds.Direction;   // QUIRK: the preset's 0 overwrites Init's random wind
  mat._CloudBending = s.BottomClouds.Bending;
  mat._CloudBlendSpeed = s.BottomClouds.BlendSpeed * TIMESCALE_FACTOR;
  mat._CloudBlendScale = s.BottomClouds.BlendScale;
  mat._CloudBlendLB = s.BottomClouds.BlendLB;
  mat._CloudBlendUB = s.BottomClouds.BlendUB;
  mat._CloudSunScale = s.TopClouds.SunColorScale;   // QUIRK: TopClouds, verbatim (:1387)
  mat._CloudSunLerpScale = s.BottomClouds.SunColorLerpScale;
  color('_CloudSunColor', s.BottomClouds.SunColor);
  // refreshTextures
  mat._CloudTopDiffuse = s.TopClouds.CloudsTextureFile;
  mat._CloudTopNormal = s.TopClouds.CloudsNormalTextureFile;
  mat._CloudTopDiffuse_ST = [s.TopClouds.TilingX, s.TopClouds.TilingY, s.TopClouds.OffsetX, s.TopClouds.OffsetY];
  mat._CloudDiffuse = s.BottomClouds.CloudsTextureFile;
  mat._CloudNormal = s.BottomClouds.CloudsNormalTextureFile;
  mat._CloudDiffuse_ST = [s.BottomClouds.TilingX, s.BottomClouds.TilingY, s.BottomClouds.OffsetX, s.BottomClouds.OffsetY];
  mat._StarTex = s.Stars.StarsTextureFile;
  mat._StarTex_ST = [s.Stars.StarsTilingX, s.Stars.StarsTilingY, s.Stars.StarsOffsetX, s.Stars.StarsOffsetY];
  mat._StarTwinkleTex = s.Stars.StarsTwinkleTextureFile;
  mat._StarTwinkleTex_ST = [s.Stars.StarsTilingX, s.Stars.StarsTilingY, s.Stars.StarsOffsetX, s.Stars.StarsOffsetY];
  mat._TwinkleTex = s.Stars.TwinkleTextureFile;
  mat._TwinkleTex_ST = [s.Stars.TwinkleTilingX, s.Stars.TwinkleTilingY, s.Stars.StarsOffsetX, s.Stars.StarsOffsetY];   // QUIRK: the stars' offset (:1415)
  mat._MoonTex = s.Masser.MoonTextureFile;
  mat._MoonTex_ST = [s.Masser.TilingX, s.Masser.TilingY, s.Masser.OffsetX, s.Masser.OffsetY];
  mat._SecundaTex = s.Secunda.MoonTextureFile;
  mat._SecundaTex_ST = [s.Secunda.TilingX, s.Secunda.TilingY, s.Secunda.OffsetX, s.Secunda.OffsetY];
  mat._StarBending = s.Stars.StarBending;
  mat._TwinkleBoost = s.Stars.TwinkleBoost;
  mat._TwinkleSpeed = s.Stars.TwinkleSpeed * TIMESCALE_FACTOR;
  // updateMoons
  color('_MoonColor', s.Masser.MoonColor);
  mat._MoonMinSize = s.Masser.MinSize;
  mat._MoonMaxSize = s.Masser.MaxSize;
  mat._MoonSemiMinAxis = s.Masser.SemiMinAxis;
  mat._MoonSemiMajAxis = s.Masser.SemiMajAxis;
  mat._MoonPhaseOption = s.Masser.AutoPhase;
  mat._MoonSpinOption = s.Masser.Spin;
  mat._MasserTidalAngle = [...s.Masser.TidalAngle];   // QUIRK: not a shader property; _MoonTidalAngle keeps the material's (:1446)
  mat._MoonSpinSpeed = s.Masser.SpinSpeed.map((v) => v * TIMESCALE_FACTOR);
  color('_SecundaColor', s.Secunda.MoonColor);
  mat._SecundaMinSize = s.Secunda.MinSize;
  mat._SecundaMaxSize = s.Secunda.MaxSize;
  mat._SecundaSemiMinAxis = s.Secunda.SemiMinAxis;
  mat._SecundaSemiMajAxis = s.Secunda.SemiMajAxis;
  mat._SecundaSpinOption = s.Secunda.Spin;
  mat._SecundaTidalAngle = [...s.Secunda.TidalAngle];
  mat._SecundaSpinSpeed = [...s.Secunda.SpinSpeed];   // not timescaled (:1464), verbatim
  return mat;
}

/** Every texture slot the shader samples, and the Unity import
 *  settings the bundle carries for each file (Point = NEAREST, Bilinear
 *  = LINEAR; mips as imported; sRGB as flagged; all Repeat). */
export const TEXTURE_SLOTS = Object.freeze([
  '_CloudTopDiffuse', '_CloudTopNormal', '_CloudDiffuse', '_CloudNormal',
  '_StarTex', '_StarTwinkleTex', '_TwinkleTex', '_MoonTex', '_SecundaTex',
]);
export const TEXTURE_IMPORTS = Object.freeze({
  CdMSunny: { filter: 'point', mips: true, srgb: true },
  CdMSunny2: { filter: 'point', mips: true, srgb: true },
  CdMCloudsNormal: { filter: 'bilinear', mips: false, srgb: false, normal: true },
  CdMCloudy: { filter: 'point', mips: true, srgb: true },
  CdMRain: { filter: 'point', mips: true, srgb: true },
  CdMOvercast2: { filter: 'point', mips: true, srgb: true },
  CdMThunder: { filter: 'point', mips: true, srgb: true },
  CdMSnow: { filter: 'point', mips: true, srgb: true },
  VanillaStars: { filter: 'point', mips: true, srgb: true },
  VanillaStarsTwinkleMask: { filter: 'point', mips: true, srgb: true },
  NLstarsHighlight: { filter: 'point', mips: true, srgb: true },
  DefaultStars: { filter: 'point', mips: false, srgb: true },
  DefaultStarsTwinkleMask: { filter: 'point', mips: false, srgb: false },
  DefaultStarsTwinkleNoise: { filter: 'point', mips: true, srgb: true },
  NLStarsBlack: { filter: 'point', mips: true, srgb: true },
  NLStarsThiefTwinkleMask: { filter: 'point', mips: true, srgb: true },
  PixelMars: { filter: 'point', mips: false, srgb: true },
  PixelEnceladus: { filter: 'point', mips: true, srgb: true },
  PixelSnow: { filter: 'point', mips: false, srgb: true },
});
/** The shader's own default for an unassigned slot ("black", "bump",
 *  "white"), as an RGBA byte - what a slot shows until its file lands. */
export const SLOT_DEFAULT_TEXEL = Object.freeze({
  _CloudTopDiffuse: [0, 0, 0, 255], _CloudTopNormal: [128, 128, 255, 128], _CloudDiffuse: [0, 0, 0, 255], _CloudNormal: [128, 128, 255, 128],
  _StarTex: [0, 0, 0, 255], _StarTwinkleTex: [0, 0, 0, 255], _TwinkleTex: [0, 0, 0, 255],
  _MoonTex: [255, 255, 255, 255], _SecundaTex: [255, 255, 255, 255],
});

// ── The day-part machine (:195-280, :417-457) ─────────────────────

export const DAY_PARTS = Object.freeze({
  None: 0, Dawn: 1, DawnEnd: 2, Morning: 3, Midday: 4, Dusk: 5, DuskEnd: 6, Evening: 7, Night: 8,
});
/** isHourDayPart, folded: the part an hour is in, in Update's own
 *  test order (Dawn, DawnEnd, Dusk, DuskEnd, Night, Morning, Midday,
 *  Evening - the order only matters for hours in no band, and every
 *  hour is in exactly one). */
export function dayPartOfHour(hour) {
  if (hour >= 4 && hour < 6) return DAY_PARTS.Dawn;
  if (hour === 6) return DAY_PARTS.DawnEnd;
  if (hour >= 16 && hour < 18) return DAY_PARTS.Dusk;
  if (hour === 18) return DAY_PARTS.DuskEnd;
  if (hour >= 0 && hour < 4) return DAY_PARTS.Night;
  if (hour >= 7 && hour < 12) return DAY_PARTS.Morning;
  if (hour >= 12 && hour < 16) return DAY_PARTS.Midday;
  if (hour >= 19) return DAY_PARTS.Evening;
  return DAY_PARTS.None;
}
/** getWeatherIndex (:518-524): 1 in the Evening and the Night, else 0.
 *  With no *Night.json in the shipped manifest, index 1 IS index 0. */
export function weatherIndexOf(dayPart) {
  return dayPart === DAY_PARTS.Evening || dayPart === DAY_PARTS.Night ? 1 : 0;
}
/** Update's `dayTime` flag per part (unused by anything that reads it
 *  today - setFogColor(day) ignores its argument - carried verbatim). */
export function dayTimeOf(dayPart) {
  return dayPart === DAY_PARTS.DawnEnd || dayPart === DAY_PARTS.Dusk || dayPart === DAY_PARTS.Morning || dayPart === DAY_PARTS.Midday;
}

// ── The moons (:773-1027) ──────────────────────────────────────────

/** LunarPhaseStates: the phase's X angle. */
export const LUNAR_PHASE_X = Object.freeze({
  [LUNAR_PHASES.New]: 180, [LUNAR_PHASES.OneWax]: 135, [LUNAR_PHASES.HalfWax]: 90, [LUNAR_PHASES.ThreeWax]: 45,
  [LUNAR_PHASES.Full]: 0, [LUNAR_PHASES.ThreeWane]: -45, [LUNAR_PHASES.HalfWane]: -90, [LUNAR_PHASES.OneWane]: -135,
});
/** GetLunarPhaseLength (:902-913), in days. */
export function lunarPhaseLength(phase) {
  switch (phase) {
    case LUNAR_PHASES.Full: return 1;
    case LUNAR_PHASES.New: return 1;
    case LUNAR_PHASES.ThreeWane: return 5;
    case LUNAR_PHASES.HalfWane: return 5;
    case LUNAR_PHASES.OneWane: return 5;
    case LUNAR_PHASES.OneWax: return 6;
    case LUNAR_PHASES.HalfWax: return 6;
    case LUNAR_PHASES.ThreeWax: return 3;
    default: return 1;
  }
}
/** GetPhaseDayOffset (:916-931): the day within the phase, from the
 *  same 32-day ratio DFU derives the phase from. */
export function phaseDayOffset(moonRatio) {
  if (moonRatio === 0 || moonRatio === 16) return 0;
  if (moonRatio <= 5) return moonRatio - 1;
  if (moonRatio <= 10) return moonRatio - 6;
  if (moonRatio <= 15) return moonRatio - 11;
  if (moonRatio <= 22) return moonRatio - 17;
  if (moonRatio <= 28) return moonRatio - 23;
  if (moonRatio <= 31) return moonRatio - 29;
  return 0;
}
/** GetNextLunarPhase (:934-945). */
export function nextLunarPhase(phase) {
  switch (phase) {
    case LUNAR_PHASES.New: return LUNAR_PHASES.OneWax;
    case LUNAR_PHASES.OneWax: return LUNAR_PHASES.HalfWax;
    case LUNAR_PHASES.HalfWax: return LUNAR_PHASES.ThreeWax;
    case LUNAR_PHASES.ThreeWax: return LUNAR_PHASES.Full;
    case LUNAR_PHASES.Full: return LUNAR_PHASES.ThreeWane;
    case LUNAR_PHASES.ThreeWane: return LUNAR_PHASES.HalfWane;
    case LUNAR_PHASES.HalfWane: return LUNAR_PHASES.OneWane;
    case LUNAR_PHASES.OneWane: return LUNAR_PHASES.New;
    default: return LUNAR_PHASES.None;
  }
}
/** InterpolateAngle (:889-899): the short way round. */
export function interpolateAngle(startAngle, endAngle, t) {
  let delta = endAngle - startAngle;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  return startAngle + t * delta;
}

/** One moon's half of ChangeLunarPhases (:803-883): the phase, its
 *  progress (offset day * 86400 + second of the day, over the phase's
 *  length) and the interpolated X toward the next phase. `date` is a
 *  gameDate date; `moonRatioOffset` is DFU's own +3 (Masser) / -1
 *  (Secunda), which the mod restates. */
export function lunarPhaseState(date, masser) {
  const phase = lunarPhase(date, { masser });
  const totalSecondsInDay = 24 * 60 * 60;
  const currentSecondOfDay = date.hour * 3600 + date.minute * 60 + Math.trunc(date.second);
  const phaseLength = lunarPhaseLength(phase);
  const moonRatio = (dayOfYear(date) + date.year * MONTHS_PER_YEAR * DAYS_PER_MONTH + (masser ? 3 : -1)) % 32;
  const dayOffset = phaseDayOffset(moonRatio);
  const totalSecondsInPhase = phaseLength * totalSecondsInDay;
  const progress = (dayOffset * totalSecondsInDay + currentSecondOfDay) / totalSecondsInPhase;
  let interpolatedX = 0;
  const x = LUNAR_PHASE_X[phase];
  const nx = LUNAR_PHASE_X[nextLunarPhase(phase)];
  if (x !== undefined && nx !== undefined) interpolatedX = interpolateAngle(x, nx, progress);
  return { phase, progress, interpolatedX, moonRatio };
}

/** ApplyOrbitCalculations (:949-1007): the orbit angle, speed and
 *  offset both moons take for this date, from their phase states. */
export function orbitParameters(masser, secunda) {
  const orbitSpeed = 0.0000725;
  let masserOrbitOffset = masser.interpolatedX + 180;
  let secundaOrbitOffset = secunda.interpolatedX + 180;
  if (masser.phase === LUNAR_PHASES.OneWane) masserOrbitOffset += 15 * masser.progress;
  else if (masser.phase === LUNAR_PHASES.New) masserOrbitOffset -= 5;
  if (secunda.phase === LUNAR_PHASES.OneWane) secundaOrbitOffset += 20 * secunda.progress;
  else if (secunda.phase === LUNAR_PHASES.New) secundaOrbitOffset -= 5;
  const deg2rad = Math.PI / 180;
  let masserZ = -20 * Math.sin(deg2rad * masser.interpolatedX);
  let secundaZ = -30 * Math.sin(deg2rad * secunda.interpolatedX);
  if (masser.phase === LUNAR_PHASES.OneWane) masserZ += 15 * masser.progress;
  if (secunda.phase === LUNAR_PHASES.OneWane) secundaZ += 20 * secunda.progress;
  return {
    _MoonOrbitAngle: [270, 90, masserZ, 0], _MoonOrbitSpeed: orbitSpeed, _MoonOrbitOffset: masserOrbitOffset,
    _SecundaOrbitAngle: [270, 90, secundaZ, 0], _SecundaOrbitSpeed: orbitSpeed, _SecundaOrbitOffset: secundaOrbitOffset,
    _MoonPhase: [masser.interpolatedX, 0, 0, 0], _SecundaPhase: [secunda.interpolatedX, 0, 0, 0],
  };
}

/** ChangeLunarPhases + ApplyOrbitCalculations for one date, written
 *  into the material. */
export function applyLunarPhases(mat, date) {
  const masser = lunarPhaseState(date, true);
  const secunda = lunarPhaseState(date, false);
  Object.assign(mat, orbitParameters(masser, secunda));
  return { masser, secunda };
}

// ── The moons' places, on the CPU (MoonFunctions.cginc) ───────────
// The shader's own orbit maths, twinned here so the WORLD can know
// where a moon is (the port's moonlight term) from the same numbers the
// dome draws it with.

const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** RotateWorldPosition: the cginc's float3x3 is written in ROWS and
 *  mul(rotMat, position) is rows dot position. */
export function rotateWorldPosition(p, rot) {
  const [x, y, z] = rot;
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const r0 = [cy * cz, -cy * sz, sy];
  const r1 = [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy];
  const r2 = [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy];
  return [dot3(r0, p), dot3(r1, p), dot3(r2, p)];
}
/** ElipsePosition. */
export function ellipsePosition(majMin, angle) {
  return norm3([majMin[0] * Math.cos(angle), 0, majMin[1] * Math.sin(angle)]);
}
/** GetOrbitPosition. */
export function orbitPosition(orbitOffsetAngles, majMin, angle) {
  const d = Math.PI / 180;
  return rotateWorldPosition(ellipsePosition(majMin, angle), [orbitOffsetAngles[0] * d, orbitOffsetAngles[1] * d, orbitOffsetAngles[2] * d]);
}
/** RotateArbitraryAxis - the axis-angle matrix, rows again. */
export function rotateArbitraryAxis(v, angleDeg, axis) {
  const r = angleDeg * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r), t = 1 - c;
  const [ax, ay, az] = axis;
  const r0 = [c + ax * ax * t, ax * ay * t - az * s, ax * az * t + ay * s];
  const r1 = [ay * ax * t + az * s, c + ay * ay * t, ay * az * t - ax * s];
  const r2 = [az * ax * t - ay * s, az * ay * t + ax * s, c + az * az * t];
  return [dot3(r0, v), dot3(r1, v), dot3(r2, v)];
}
/** Where a moon is, as the fragment shader places it: `which` is
 *  'Moon' (Masser) or 'Secunda', the material's own property prefix. */
export function moonDirection(mat, which, worldTime = mat._WorldTime) {
  const angle = worldTime * mat[`_${which}OrbitSpeed`];
  const majMin = [mat[`_${which}SemiMajAxis`], mat[`_${which}SemiMinAxis`]];
  const orbit = mat[`_${which}OrbitAngle`];
  const current = orbitPosition(orbit, majMin, angle);
  const prev = orbitPosition(orbit, majMin, angle - 1);
  const up = norm3(cross3(current, prev));
  return norm3(rotateArbitraryAxis(current, mat[`_${which}OrbitOffset`], up));
}

// ── Time, sun, fog colour ──────────────────────────────────────────

/** UpdateWorldTime (:359-368): _WorldTime = the seconds of the day,
 *  DaggerfallDateTime's Hour*3600 + Minute*60 + Second (a float). */
export function worldTimeSeconds(minuteOfDay) {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  return m * 60;
}

/** SunlightManager.Update's sun, UNCLAMPED: time = (MinuteOfDay - dawn)
 *  / dayRange over the INT minute, Euler(180 * time, -90, 0), and
 *  _WorldSpaceLightPos0 is -forward: (cos, sin, 0)(180 * time). The
 *  port's worldClock.sunDirection clamps this for the world light,
 *  which DFU switches off at night; the sky sees the whole turn. */
export function sunLightDirection(minuteOfDay) {
  const dawn = DAWN_HOUR * MINUTES_PER_HOUR;
  const dayRange = DUSK_HOUR * MINUTES_PER_HOUR - dawn;
  const m = Math.floor(((minuteOfDay % 1440) + 1440) % 1440);
  const t = (m - dawn) / dayRange;
  return [Math.cos(Math.PI * t), Math.sin(Math.PI * t), 0];
}

/** SunlightManager's time for the curve, INT minute, unclamped. */
export function sunCurveTime(minuteOfDay) {
  const dawn = DAWN_HOUR * MINUTES_PER_HOUR;
  const dayRange = DUSK_HOUR * MINUTES_PER_HOUR - dawn;
  const m = Math.floor(((minuteOfDay % 1440) + 1440) % 1440);
  return (m - dawn) / dayRange;
}

/** _LightColor0 in the skybox pass: the SunLight's colour (sRGB in the
 *  prefab, linearised under linear colour space) x its intensity, which
 *  SunlightManager sets to keyLightIntensity x LightCurve(time) x
 *  WeatherManager's ScaleFactor while the light is enabled (by day). At
 *  night the light is disabled and keeps its last intensity, which the
 *  mod's own curve makes ~0 by 17:59 - so the curve, clamped, serves the
 *  night too. */
export function sunLightColor(minuteOfDay, lightCurve, weatherScale = 1) {
  const t = Math.max(0, Math.min(1, sunCurveTime(minuteOfDay)));
  const intensity = SUN_RIG_INTENSITY * evaluateCurve(lightCurve, t) * weatherScale;
  return [srgbToLinear(SUN_RIG_COLOR[0]) * intensity, srgbToLinear(SUN_RIG_COLOR[1]) * intensity, srgbToLinear(SUN_RIG_COLOR[2]) * intensity];
}

/** Mathf.SmoothStep(from, to, t). */
export function mathfSmoothStep(from, to, t) {
  t = clamp01(t);
  t = -2 * t * t * t + 3 * t * t;
  return to * t + from * (1 - t);
}

/** setFogColor (:1036-1073): RenderSettings.fogColor, every real
 *  second, from the preset's FogDayColor and the sun's height
 *  (-forward.y, i.e. the direction-to-sun's y):
 *    lerpScale = SmoothStep(_AtmosphereLerpDuration, 0, sunY)
 *    lerpScale = Lerp(0, 1, lerpScale / 0.66)      ("rescale to 0..1")
 *    fog = Color.Lerp(FogDayColor, black, lerpScale^2)
 *  in sRGB, as Unity Colors are. Returns [r, g, b] sRGB, or null when
 *  the day colour does not parse (then RenderSettings.fogColor is left
 *  as it was). The shader's _FogColor is this, linearised. */
export function fogColorNow(setting, atmosphereLerpDuration, sunY) {
  const day = parseHtmlColor(setting.FogDayColor);
  if (!day) return null;
  let lerpScale = mathfSmoothStep(atmosphereLerpDuration, 0, sunY);
  lerpScale = clamp01(lerpScale / 0.66);
  const t = clamp01(lerpScale * lerpScale);
  return [day[0] * (1 - t), day[1] * (1 - t), day[2] * (1 - t)];
}

/** The skybox pass's fog interval: the mod re-colours the fog when
 *  Time.time - lastUpdateTime >= 1.0 (:192-203). */
export const FOG_COLOR_INTERVAL_SECONDS = 1.0;

// ── LightningFlash.cs + LightningFlashListener.cs ─────────────────

/** LightningFlash: a point light over the player, 50% of the time an
 *  ambient effect plays under a Thunder sky (Random.value < 0.5 /
 *  Time.timeScale, timeScale 1), a third of those a double flash.
 *  FlashOnce randomises the colour (0.8..1 per channel), the intensity
 *  (0.5..1.5), the range (500..1000) and the place (player + (-10..10,
 *  20..40, -10..10)), enables the light for the duration and disables
 *  it. Coroutines overlap as they do in Unity: a later flash re-rolls
 *  the light and the earliest routine to end switches it off. */
export class LightningFlash {
  constructor(rng = Math.random, { flashDuration = 0.2, timeScale = 1 } = {}) {
    this.rng = rng;
    this.flashDuration = flashDuration;   // BLBSkybox.Start sets 0.2 (:183)
    this.timeScale = timeScale;
    this.light = { x: 0, y: 0, z: 0, range: 0, color: [1, 1, 1], intensity: 0 };
    this.enabled = false;
    this._routines = [];
  }

  _range(min, max) { return min + this.rng() * (max - min); }

  /** StartFlash(): the player's position is read at the flash. */
  startFlash(playerPos) {
    if (!playerPos) return false;
    if (this.rng() < 0.5 / this.timeScale) {
      if (this.rng() < 0.33 / this.timeScale) {
        const half = this.flashDuration * this.timeScale / 2;
        this._routines.push({ t: 0, steps: [['on', half], ['gap', 0.1 * this.timeScale], ['on', half]], step: -1, playerPos: [...playerPos] });
      } else {
        this._routines.push({ t: 0, steps: [['on', this.flashDuration * this.timeScale]], step: -1, playerPos: [...playerPos] });
      }
      return true;
    }
    return false;
  }

  _flashOnce(playerPos) {
    const l = this.light;
    l.color = [this._range(0.8, 1), this._range(0.8, 1), this._range(0.8, 1)];
    l.intensity = this._range(0.5, 1.5);
    l.range = this._range(500, 1000);
    l.x = playerPos[0] + this._range(-10, 10);
    l.y = playerPos[1] + this._range(20, 40);
    l.z = playerPos[2] + this._range(-10, 10);
    this.enabled = true;
  }

  /** Advance the routines by a frame. Returns the light for the point-
   *  light channel ({x, y, z, range, color = colour x intensity}) while
   *  it is on, else null. */
  tick(dt) {
    for (const r of this._routines) {
      if (r.step === -1) { r.step = 0; r.t = 0; this._enter(r); }
      r.t += dt;
      while (r.step < r.steps.length && r.t >= r.steps[r.step][1]) {
        r.t -= r.steps[r.step][1];
        if (r.steps[r.step][0] === 'on') this.enabled = false;   // "Turn off the light"
        r.step++;
        if (r.step < r.steps.length) this._enter(r);
      }
    }
    this._routines = this._routines.filter((r) => r.step < r.steps.length);
    if (!this.enabled) return null;
    const l = this.light;
    return { x: l.x, y: l.y, z: l.z, range: l.range, color: [l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity] };
  }

  _enter(r) {
    if (r.steps[r.step][0] === 'on') this._flashOnce(r.playerPos);
  }

  /** InteriorTransitionEvent's teardown: StopAllCoroutines and the
   *  light off. */
  stopAll() {
    this._routines.length = 0;
    this.enabled = false;
  }
}

/** getWindDirection (:600-602): Random.Range(0f, 360f). */
export function windDirectionRoll(rng = Math.random) {
  return rng() * 360;
}

/** InitSnow (:1183-1195): the pixel-snow numbers from the mod's own
 *  settings - the sizes are viewport FRACTIONS (ParticleSystemRenderer
 *  min/maxParticleSize), the count x1000 and, verbatim, never applied. */
export function pixelSnowSettings({ MinParticleSize = 100, MaxParticleSize = 300, MaxParticles = 20 } = {}) {
  return {
    minParticleSize: MinParticleSize / 100000,
    maxParticleSize: MaxParticleSize / 100000,
    maxParticles: Math.trunc(MaxParticles * 1000),
  };
}
