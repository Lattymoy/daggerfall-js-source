// ═══════════════════════════════════════════════════════════════════
// DW-C (2026-09-25): HOW ILIAC PUDDLE NO MORE LOOKS, AS NUMBERS. The
// C# that turns the mod's settings, the time of day and the player's
// water into material values (Iliac Puddle No More 1.2.2, jet082):
//
//   DeepWaters.cs            - the sliders' curves (surface alpha, fog
//                              distance multiplier, vision distance, fog
//                              density), the daylight factor, the
//                              underwater fog colour's night lerp;
//   WaterSurfaceResources.cs - the surface tint (light / base / dark by
//                              Darker Surface Water, to night by the
//                              daylight), the top's alpha and its night
//                              boost, the vision distances, the
//                              underside's fades by the player's shallow
//                              factor, the scene tint the floor takes;
//   DeepWaterFloorMaterial.cs - each climate's seafloor texture, its
//                              strength and its four-colour palette, and
//                              the night's ambient boost.
//
// Pure: the renderer's Deep Waters programs (render/deepWatersRender.js)
// read these, and the tests pin them against the C#.
// ═══════════════════════════════════════════════════════════════════

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Mathf.Lerp (t clamped). */
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
const lerpColor = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3] ?? 1, b[3] ?? 1, t)];
/** Mathf.InverseLerp. */
const inverseLerp = (a, b, v) => (a !== b ? clamp01((v - a) / (b - a)) : 0);

// ---- DeepWaters.cs ---------------------------------------------------

export const UNDERWATER_VISION_DISTANCE_AT_DEFAULT = 95;
export const MIN_UNDERWATER_VISION_DISTANCE = 22;
export const MAX_UNDERWATER_VISION_DISTANCE = 360;
const UNDERWATER_FOG_DENSITY_MAX_AT_MIDPOINT = 0.014;
/** NightUnderwaterFogTint. */
export const NIGHT_UNDERWATER_FOG_TINT = Object.freeze([0.035, 0.065, 0.075, 1]);
/** The fog colour when DFU's own UnderwaterFog has none to give: Color32(14, 25, 21, 255). */
export const DEFAULT_UNDERWATER_FOG_COLOR = Object.freeze([14 / 255, 25 / 255, 21 / 255, 1]);

/** SurfaceTransparencySliderToAlpha: 1 - v^2. */
export function surfaceTransparencySliderToAlpha(v) {
  const n = clamp01(v);
  return 1 - n * n;
}

/** FogDistanceSliderToMultiplier: 0.25 .. 1 over the slider's first half, 1 .. 6 over its second. */
export function fogDistanceSliderToMultiplier(v) {
  const n = clamp01(v);
  return n <= 0.5 ? lerp(0.25, 1, n / 0.5) : lerp(1, 6, (n - 0.5) / 0.5);
}

/** GetScaledSliderValue, in the C#'s floats (the decorations' frequency splits into a pass count and a fraction rolled against). */
export function scaledSliderValue(v, valueAtMidpoint) { return Math.fround(clamp01(Math.fround(Number(v) || 0)) * Math.fround(valueAtMidpoint / 0.5)); }

/** UnderwaterVisionDistance. */
export function underwaterVisionDistance(fogDistanceSlider) {
  return clamp(UNDERWATER_VISION_DISTANCE_AT_DEFAULT * fogDistanceSliderToMultiplier(fogDistanceSlider), MIN_UNDERWATER_VISION_DISTANCE, MAX_UNDERWATER_VISION_DISTANCE);
}

/** UnderwaterFogDensityMax. */
export function underwaterFogDensityMax(fogStrengthSlider, fogDistanceSlider) {
  return scaledSliderValue(fogStrengthSlider, UNDERWATER_FOG_DENSITY_MAX_AT_MIDPOINT) / fogDistanceSliderToMultiplier(fogDistanceSlider);
}

/**
 * GetDaylightFactor: 0 at night, else SunlightManager.DaylightScale -
 * the light curve with the weather's scale already in it - clamped.
 */
export function daylightFactor({ night, daylightScale, weatherScale = 1 }) {
  if (night) return 0;
  return clamp01(daylightScale * weatherScale);
}

/** GetUnderwaterFogColor: DFU's water fog colour, to the night tint by the daylight (alpha kept). */
export function underwaterFogColor(daylight, waterFogColor = DEFAULT_UNDERWATER_FOG_COLOR) {
  const night = [NIGHT_UNDERWATER_FOG_TINT[0], NIGHT_UNDERWATER_FOG_TINT[1], NIGHT_UNDERWATER_FOG_TINT[2], waterFogColor[3] ?? 1];
  return lerpColor(night, waterFogColor, daylight);
}

/** The settings a look reads, from the store's own keys (General.*). */
export function lookSettings(get) {
  return {
    waterDepth: Number(get('General.WaterDepth')),
    topAlpha: surfaceTransparencySliderToAlpha(Number(get('General.WaterSurfaceTopTransparency'))),
    bottomAlpha: surfaceTransparencySliderToAlpha(Number(get('General.WaterSurfaceBottomTransparency'))),
    darker: Number(get('General.DarkerSurfaceWater')),
    fogStrength: Number(get('General.UnderwaterFogStrength')),
    fogDistance: Number(get('General.UnderwaterFogDistance')),
    spawnSurfaces: get('General.SpawnWaterSurfaces') === true,
  };
}

// ---- WaterSurfaceResources.cs ----------------------------------------

export const SURFACE_TINT = Object.freeze([0.519, 0.527, 0.467, 1]);
export const NIGHT_SURFACE_TINT = Object.freeze([0.055, 0.105, 0.12, 1]);
export const LIGHT_SURFACE_TINT = Object.freeze([0.72, 0.78, 0.82, 1]);
export const DARK_SURFACE_TINT = Object.freeze([0.21, 0.21, 0.19, 1]);
const NIGHT_TOP_SURFACE_ALPHA_BOOST = 0.18;
const MAXIMUM_TOP_SURFACE_VISION_DISTANCE = 36;
const NEAR_OPAQUE_TOP_SURFACE_ALPHA = 0.95;
const OPAQUE_TOP_SURFACE_VISION_DISTANCE = 10000;
const TOP_SURFACE_OPAQUE_END_VISION_MULTIPLIER = 0.55;
/** SurfaceTextureTiling: the surface texture's repeats across one pixel (a repeat a terrain tile). */
export const SURFACE_TEXTURE_TILING = 128;
/** TransparentWaterSurfaceTop / Underside _ScrollX, _ScrollY: texture repeats a second. */
export const SURFACE_SCROLL = Object.freeze([0.0225, 0.0375]);
/** The surface's texture: TEXTURE.302 record 0. */
export const SURFACE_TEXTURE = Object.freeze({ archive: 302, record: 0 });

/** GetBaseSurfaceTint: light .. base over the slider's first half, base .. dark over its second. */
export function baseSurfaceTint(darker) {
  const n = clamp01(darker);
  return n <= 0.5 ? lerpColor(LIGHT_SURFACE_TINT, SURFACE_TINT, n / 0.5) : lerpColor(SURFACE_TINT, DARK_SURFACE_TINT, (n - 0.5) / 0.5);
}

/** GetTimeAdjustedSurfaceTint. */
export function timeAdjustedSurfaceTint(darker, daylight) { return lerpColor(NIGHT_SURFACE_TINT, baseSurfaceTint(darker), daylight); }

/** GetTimeAdjustedTopSurfaceAlpha: the night makes the top more opaque. */
export function timeAdjustedTopSurfaceAlpha(topAlpha, daylight) { return clamp01(topAlpha + (1 - daylight) * NIGHT_TOP_SURFACE_ALPHA_BOOST); }

/** IsTopSurfaceNearOpaque: the top then writes depth and its vision distance is effectively endless. */
export const isTopSurfaceNearOpaque = (topAlpha) => topAlpha >= NEAR_OPAQUE_TOP_SURFACE_ALPHA;

/** GetTopSurfaceVisionDistance. */
export const topSurfaceVisionDistance = (vision) => Math.min(vision, MAXIMUM_TOP_SURFACE_VISION_DISTANCE);

/** GetTopSurfaceVisionDistanceForMaterial: the top's _WaterSurfaceVisionDistance. */
export const topSurfaceVisionDistanceForMaterial = (topAlpha, vision) => (isTopSurfaceNearOpaque(topAlpha) ? OPAQUE_TOP_SURFACE_VISION_DISTANCE : vision);

/** GetTopSurfaceOpaqueFadeEnd. */
export const topSurfaceOpaqueFadeEnd = (vision) => Math.max(1, vision * TOP_SURFACE_OPAQUE_END_VISION_MULTIPLIER);

/** GetPlayerShallowWaterFactor: 1 in 3 m of water or less, 0 in 12 m or more. */
export const playerShallowWaterFactor = (columnDepth) => (columnDepth == null ? 0 : 1 - inverseLerp(3, 12, columnDepth));

/** ApplyDynamicUndersideSettings' fades: {start, end}. */
export function undersideFades(vision, shallow) {
  const v = topSurfaceVisionDistance(vision);
  return { start: v * lerp(1.7, 4, shallow), end: v * lerp(3.8, 8, shallow) };
}

/** ApplySceneTintGlobal: the time-adjusted tint with alpha 1 while the camera is above the sea, else white and 0. */
export function sceneTint(darker, daylight, cameraAboveSea) {
  if (!cameraAboveSea) return [1, 1, 1, 0];
  const t = timeAdjustedSurfaceTint(darker, daylight);
  return [t[0], t[1], t[2], 1];
}

/**
 * The surfaces' uniform set for a frame, whole.
 * @param {object} s - lookSettings'
 * @param {object} f - {daylight, columnDepth (the player's water, or null), waterFogColor?, undersideFogColor?}
 *   undersideFogColor: the underside material's _UnderwaterFogColor as it was last configured
 *   (ApplySharedWaterProperties runs when a material is configured, never in the frame's refresh) -
 *   absent, this frame's
 */
export function surfaceLook(s, { daylight, columnDepth = null, waterFogColor = DEFAULT_UNDERWATER_FOG_COLOR, undersideFogColor = null }) {
  const vision = underwaterVisionDistance(s.fogDistance);
  const tint = timeAdjustedSurfaceTint(s.darker, daylight);
  const fog = underwaterFogColor(daylight, waterFogColor);
  const fades = undersideFades(vision, playerShallowWaterFactor(columnDepth));
  return {
    topColor: [tint[0], tint[1], tint[2], timeAdjustedTopSurfaceAlpha(s.topAlpha, daylight)],
    topVision: topSurfaceVisionDistanceForMaterial(s.topAlpha, vision),
    topDepthWrite: isTopSurfaceNearOpaque(s.topAlpha),
    undersideColor: [tint[0], tint[1], tint[2], 1],
    undersideAlpha: s.bottomAlpha,
    undersideFadeStart: fades.start,
    undersideFadeEnd: fades.end,
    horizonColor: fog,
    fogColor: undersideFogColor ?? fog,
    columnFogStrength: clamp01(s.fogStrength),
  };
}

// ---- DeepWaterFloorMaterial.cs ---------------------------------------

/** TerrainTextureWorldScale: a texture repeat every 6.4 m. */
export const FLOOR_TEXTURE_WORLD_SCALE = 5 / 32;
const TERRAIN_TEXTURE_STRENGTH = 0.45;
const DFU_GROUND_TEXTURE_STRENGTH = 0.25;
const SWAMP_GROUND_TEXTURE_STRENGTH = 0.9;
const NIGHT_AMBIENT_BOOST = 0.72;
/** The Seafloor shader's own defaults for what the material never sets. */
export const FLOOR_SHADER_DEFAULTS = Object.freeze({
  sand: [0.74, 0.66, 0.49], mid: [0.41, 0.38, 0.31], deep: [0.18, 0.18, 0.2], swamp: [0.3, 0.27, 0.18],
  shelfMix: 0.55, depthGamma: 1.4,
});

/** UsesDfuGroundTexture: the ocean and the swamp take DFU's own ground. */
const usesDfuGroundTexture = (climate) => climate === 223 || climate === 228;

/**
 * ResolveSeafloorTexture: {archive, record}. The DFU ground archive is the
 * climate's own, one up when its ground wears snow (ResolveGroundArchive:
 * off the desert, in winter - climateSwaps.js groundIsSnowy, the one law).
 * @param {number} climate - the biome climate (DeepWaterTileData.BiomeClimateIndex)
 * @param {{groundArchive: number}} climateSettings - MapsFile.GetWorldClimateSettings(climate)
 * @param {boolean} snowy - groundIsSnowy(climateSettings, season)
 */
export function seafloorTexture(climate, climateSettings, snowy) {
  if (usesDfuGroundTexture(climate)) return { archive: climateSettings.groundArchive + (snowy ? 1 : 0), record: 1 };
  switch (climate) {
    case 227: case 229: return { archive: 402, record: 28 };
    case 226: case 230: return { archive: 102, record: 3 };
    case 224: case 225: return { archive: 2, record: 10 };
    case 232: return { archive: 302, record: 3 };
    case 231: return { archive: 302, record: 25 };
    default: return { archive: climateSettings.groundArchive, record: 1 };
  }
}

/** The material's texture strength. */
export function seafloorTextureStrength(climate) {
  return climate === 228 ? SWAMP_GROUND_TEXTURE_STRENGTH : usesDfuGroundTexture(climate) ? DFU_GROUND_TEXTURE_STRENGTH : TERRAIN_TEXTURE_STRENGTH;
}

/** ApplyBiomePalette - or the shader's own defaults, which the ocean keeps. */
export function seafloorPalette(climate) {
  if (usesDfuGroundTexture(climate) && climate !== 228) {
    const d = FLOOR_SHADER_DEFAULTS;
    return { sand: d.sand, mid: d.mid, deep: d.deep, swamp: d.swamp };
  }
  const P = (sand, mid, deep, swamp) => ({ sand, mid, deep, swamp });
  switch (climate) {
    case 227: case 229: return P([0.52, 0.67, 0.49], [0.24, 0.42, 0.32], [0.08, 0.2, 0.2], [0.16, 0.32, 0.22]);
    case 228: return P([0.38, 0.36, 0.21], [0.23, 0.25, 0.15], [0.08, 0.12, 0.09], [0.18, 0.17, 0.09]);
    case 226: case 230: return P([0.58, 0.63, 0.61], [0.34, 0.43, 0.47], [0.12, 0.18, 0.24], [0.24, 0.3, 0.32]);
    case 224: case 225: return P([0.78, 0.65, 0.42], [0.5, 0.39, 0.22], [0.23, 0.18, 0.13], [0.45, 0.34, 0.18]);
    case 231: case 232: return P([0.58, 0.62, 0.45], [0.33, 0.39, 0.28], [0.13, 0.18, 0.15], [0.24, 0.3, 0.19]);
    default: return P([0.3, 0.42, 0.43], [0.16, 0.23, 0.26], [0.06, 0.08, 0.11], [0.12, 0.18, 0.16]);
  }
}

/** UpdateLighting: the floor's ambient boost by the daylight. */
export const seafloorAmbientBoost = (daylight) => lerp(NIGHT_AMBIENT_BOOST, 1, daylight);

// ---- UnderwaterDistanceFogEffect.cs / UnderwaterDistanceFog.shader ---

/** DefaultAbsorption, DefaultScatter, DefaultDeepWaterColor, NightScatter, NightDeepWaterColor. */
export const FOG_ABSORPTION = Object.freeze([1.8, 1.25, 1.05]);
export const FOG_SCATTER = Object.freeze([0.09, 0.165, 0.155, 1]);
export const FOG_DEEP_WATER_COLOR = Object.freeze([0.012, 0.022, 0.026, 1]);
export const FOG_NIGHT_SCATTER = Object.freeze([0.02, 0.04, 0.045, 1]);
export const FOG_NIGHT_DEEP_WATER_COLOR = Object.freeze([0.003, 0.006, 0.009, 1]);
/** DepthDarkeningStart. */
export const DEPTH_DARKENING_START = 6;
/** DepthDarkeningEnd: three quarters of the Water Depth setting, within 55 .. 110. */
export const depthDarkeningEnd = (waterDepth) => clamp(waterDepth * 0.75, 55, 110);

const luminance = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;

/** ConfigureVolumetricRegrade's scatter: a quarter of the way to the fog colour's own grey-green, then to night by the daylight. */
export function distanceFogScatter(daylight, waterFogColor = DEFAULT_UNDERWATER_FOG_COLOR) {
  const l = luminance(underwaterFogColor(daylight, waterFogColor));
  return lerpColor(FOG_NIGHT_SCATTER, lerpColor(FOG_SCATTER, [l * 0.6, l * 0.95, l * 0.85, 1], 0.25), daylight);
}

/** ConfigureVolumetricRegrade's deep colour, to night by the daylight. */
export const distanceFogDeep = (daylight) => lerpColor(FOG_NIGHT_DEEP_WATER_COLOR, FOG_DEEP_WATER_COLOR, daylight);

/**
 * ComputeHorizonAmbientColor: the underside's horizon while the camera is
 * under (UnderwaterDistanceFog.LateUpdate hands it to the material) - the
 * scatter, toward the deep colour by the camera's depth and the strength.
 * @param {object} s - lookSettings'
 * @param {{daylight: number, cameraY: number, oceanY: number, waterFogColor?: number[]}} f
 */
export function horizonAmbientColor(s, { daylight, cameraY, oceanY, waterFogColor = DEFAULT_UNDERWATER_FOG_COLOR }) {
  const strength = clamp01(s.fogStrength);
  const below = Math.max(0, oceanY - cameraY);
  const end = depthDarkeningEnd(s.waterDepth);
  const t = clamp01((below - DEPTH_DARKENING_START) / Math.max(0.001, end - DEPTH_DARKENING_START));
  const k = t * t * (3 - 2 * t);
  return lerpColor(distanceFogScatter(daylight, waterFogColor), distanceFogDeep(daylight), clamp01(k * 0.85 + strength * 0.18));
}

/**
 * The fog's constants for a frame - ConfigureMaterial's values put through
 * the part of UnderwaterDistanceFog.shader that no pixel changes (the
 * camera's depth darkening, the vision distance it shortens, the two
 * extinctions, the colours the bands close to), packed as fogGlsl.js's
 * uDwFog[5]:
 *   [0] 1, the sea's height, V (the darkened vision, at least 1), the strength
 *   [1] absorption per metre (rgb), scatter per metre
 *   [2] the in-scatter colour (rgb), the darkening
 *   [3] the fog colour (rgb), the far band's factor
 *   [4] the far band's start and end, the sky's distance, 0
 * @param {object} s - lookSettings'
 * @param {{daylight: number, cameraY: number, oceanY: number, waterFogColor?: number[]}} f
 * @param {Float32Array} [out]
 */
export function distanceFogUniforms(s, { daylight, cameraY, oceanY, waterFogColor = DEFAULT_UNDERWATER_FOG_COLOR }, out = new Float32Array(20)) {
  const strength = clamp01(s.fogStrength);
  const vision = underwaterVisionDistance(s.fogDistance);
  const scatter = distanceFogScatter(daylight, waterFogColor);
  const deep = distanceFogDeep(daylight);
  const scatterStrength = lerp(0.85, 1.3, strength);
  const end = depthDarkeningEnd(s.waterDepth);
  // the shader's: saturate((max(surface - camera, 0) - start) / (max(start + 0.001, end) - start)), smoothed
  const t = clamp01((Math.max(oceanY - cameraY, 0) - DEPTH_DARKENING_START) / (Math.max(DEPTH_DARKENING_START + 0.001, end) - DEPTH_DARKENING_START));
  const dd = t * t * (3 - 2 * t);
  const darken = dd * -0.45 + 1;
  const v = Math.max(darken * vision, 1);
  const k = strength * 0.9 + 0.55;
  const near = Math.min(dd * 0.65, 1), far = Math.min(strength * 0.18 + dd * 0.85, 1);
  const bandStart = v * (strength * -0.85 + 1.4);
  const bandEnd = Math.max(v * (strength * -2.15 + 3.2), bandStart + 0.1);
  let bandFactor = Math.max((strength - 0.15) * 1.17647052, 0);
  bandFactor = bandFactor * bandFactor * (3 - 2 * bandFactor);
  out[0] = 1; out[1] = oceanY; out[2] = v; out[3] = strength;
  for (let i = 0; i < 3; i++) {
    out[4 + i] = (k * FOG_ABSORPTION[i]) / v;
    out[8 + i] = scatter[i] + (deep[i] - scatter[i]) * near;
    out[12 + i] = scatter[i] + (deep[i] - scatter[i]) * far;
  }
  out[7] = (k * scatterStrength) / v;
  out[11] = darken;
  out[15] = bandFactor;
  out[16] = bandStart; out[17] = bandEnd; out[18] = v * (strength * -2 + 3.6); out[19] = 0;
  return out;
}

/**
 * The shader's per-pixel half on the CPU, for the tests and the probes:
 * a colour seen `d` metres through the water (dwWaterFogAt).
 * @param {number[]} col @param {number} d @param {Float32Array} u - distanceFogUniforms'
 */
export function distanceFogAt(col, d, u) {
  const sm = (a, b, x) => { const q = clamp01((x - a) / (b - a)); return q * q * (3 - 2 * q); };
  const v = u[2];
  const f = Math.max(sm(0.5 * v, 1.45 * v, d), u[15] * sm(u[16], u[17], d));
  const scat = 1 - Math.exp(-d * u[7]);
  const o = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const c = (col[i] * Math.exp(-d * u[4 + i]) + scat * u[8 + i]) * u[11];
    o[i] = c + (u[12 + i] - c) * f;
  }
  return o;
}

/**
 * The distance the fog takes for a ray: its length in the water, capped
 * where it climbs through the surface (the shader's `up` arm); the sky's,
 * which has no depth, is the band's own reach.
 * @param {number[]} dir - the ray, normalised @param {number} length - to the fragment, or Infinity for the sky
 * @param {number} cameraY @param {Float32Array} u
 */
export function distanceFogRayLength(dir, length, cameraY, u) {
  const toSurface = u[1] - cameraY;
  const up = dir[1] > 1e-4 && toSurface > 0;
  const d = Number.isFinite(length) ? length : u[18];
  return up ? Math.min(toSurface / dir[1], d) : d;
}
