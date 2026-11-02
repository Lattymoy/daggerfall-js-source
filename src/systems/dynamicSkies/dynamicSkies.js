// DYNAMIC SKIES, OUR OWN (OWN-WORK4, 2026-10-31, the owner: "A proper 1 to 1 recreation for everything"). The sky's
// law, pure: the hour, the weather and the season in; the frame's colours, sun, moons, stars and cloud layers out.
// Every number below is the rule written on bible/07-Rendering/Dynamic-Skies.md (OWN-WORK4), chosen for this
// game - none is the retired mod's. The pass is render/dynamicSkiesRenderer.js, the instance dynamicSkiesRuntime.js,
// the seam scenes/shared.js createSkyController.

import { dateFromClassicMinutes, seasonValue, SEASONS, lunarPhaseFractionsFromMinutes } from '../gameDate.js';
import {
  SUN_RIG_COLOR,
  SUN_RIG_INTENSITY,
  evaluateCurve,
  DAWN_HOUR,
  DUSK_HOUR,
  MINUTES_PER_HOUR,
} from '../../world/worldClock.js';
import { moonSkyDirection, MOONS, STAR_POLE } from '../../render/enhancedSky.js';

// ── Colour space ───────────────────────────────────────────────────

/** The sRGB curve to linear light (IEC 61966-2-1), the one the GPU's SRGB8 decode applies. */
export function srgbToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}
/** And back. */
export function linearToSrgb(channel) {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, share) => a + (b - a) * share;
const mix3 = (a, b, share) => [mix(a[0], b[0], share), mix(a[1], b[1], share), mix(a[2], b[2], share)];
const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (vec) => {
  const len = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  return [vec[0] / len, vec[1] / len, vec[2] / len];
};
/** '#rrggbb' as linear light. */
export const hexLinear = (hex) => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
/** Linear light back to an sRGB triple, 0..1. */
export const toSrgb3 = (rgb) => rgb.map((value) => linearToSrgb(clamp01(value)));
/** The luminance of linear light (Rec. 709). */
export const linearLuminance = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

// ── The preset rule ────────────────────────────────────────────────

/** THE HOUR: five anchors on the sun's height (the sine of its elevation), walked linearly between. `light` is how
 *  much of the day's light the hour has - it scales the weather's grey and the clouds. Night is navy, the blue hour
 *  indigo, the sun on the horizon an orange horizon under a violet-blue zenith, the golden hour a warm horizon, the
 *  day a mid blue whose horizon is lifted toward white. The warm band runs from 7 degrees under to 9 over. */
export const SKY_HOURS = Object.freeze([
  Object.freeze({
    h: -0.3,
    zenith: '#02050c',
    horizon: '#060b18',
    glow: '#000000',
    glowAmount: 0,
    sun: '#000000',
    light: 0.03,
  }),
  Object.freeze({
    h: -0.12,
    zenith: '#0a1430',
    horizon: '#232d4e',
    glow: '#46304a',
    glowAmount: 0.35,
    sun: '#000000',
    light: 0.1,
  }),
  Object.freeze({
    h: 0,
    zenith: '#1e3672',
    horizon: '#d8844e',
    glow: '#ff8a3e',
    glowAmount: 1,
    sun: '#ffb06a',
    light: 0.45,
  }),
  Object.freeze({
    h: 0.16,
    zenith: '#2c5aa6',
    horizon: '#e4b68c',
    glow: '#ffc88c',
    glowAmount: 0.7,
    sun: '#ffe0b0',
    light: 0.8,
  }),
  Object.freeze({
    h: 0.42,
    zenith: '#2862b8',
    horizon: '#a0c2e4',
    glow: '#fff0d8',
    glowAmount: 0.35,
    sun: '#fff8ee',
    light: 1,
  }),
]);
const HOURS_LINEAR = SKY_HOURS.map((a) => ({
  h: a.h,
  zenith: hexLinear(a.zenith),
  horizon: hexLinear(a.horizon),
  glow: hexLinear(a.glow),
  glowAmount: a.glowAmount,
  sun: hexLinear(a.sun),
  light: a.light,
}));

/** THE WEATHER: one number, its cover c, and the grey its sky turns. The rule (`skyWeatherRow`, `skyFrame`): the sky's
 *  colours mix toward the grey by c^1.5 and darken by 0.35 c^2; the sun, the moons and the stars show (1 - c^2)^2;
 *  the low cloud layer covers c, the high one 0.3 (1 - c), fading out from 0.16 to 0.07. Snow's grey is pale, a storm's
 *  slate, the sandstorm ochre and the ashfall a warm brown, so a province's own weather wears its own sky. */
export const WEATHER_LOOK = Object.freeze({
  sunny: Object.freeze({ cover: 0.1, grey: '#a4aeb8' }),
  cloudy: Object.freeze({ cover: 0.45, grey: '#a4aeb8' }),
  overcast: Object.freeze({ cover: 0.8, grey: '#8e969f' }),
  fog: Object.freeze({ cover: 0.92, grey: '#b0b5b9' }),
  rain: Object.freeze({ cover: 0.85, grey: '#737e8a' }),
  thunder: Object.freeze({ cover: 0.95, grey: '#4e5866' }),
  snow: Object.freeze({ cover: 0.85, grey: '#c8d0da' }),
  sandstorm: Object.freeze({ cover: 0.92, grey: '#b88e5e' }),
  ashfall: Object.freeze({ cover: 0.9, grey: '#72645c' }),
});

/** The preset each weather word wears: its own row, and the sunny sky for a word the table does not know. */
export const WEATHER_PRESET = Object.freeze({
  sunny: 'sunny',
  cloudy: 'cloudy',
  overcast: 'overcast',
  fog: 'fog',
  rain: 'rain',
  thunder: 'thunder',
  snow: 'snow',
  sandstorm: 'sandstorm',
  ashfall: 'ashfall',
});

/** THE SEASON leans the clear sky, by the hour's light so a night stays a night: summer deeper, autumn golden at the
 *  horizon, winter paler and colder; spring is the reference. The season is the calendar's, the same in every
 *  province - a place's climate speaks through the weather the sim rolls for it. [target, weight]. */
export const SEASON_LEAN = Object.freeze({
  [SEASONS.Spring]: Object.freeze({}),
  [SEASONS.Summer]: Object.freeze({
    zenith: Object.freeze(['#1c4fae', 0.15]),
    horizon: Object.freeze(['#f0d8b4', 0.06]),
  }),
  [SEASONS.Fall]: Object.freeze({ horizon: Object.freeze(['#e8c48c', 0.12]) }),
  [SEASONS.Winter]: Object.freeze({
    zenith: Object.freeze(['#7896c4', 0.18]),
    horizon: Object.freeze(['#dde6ee', 0.14]),
  }),
});

/** The sun's disc: its angular radius (radians) and how far past white its core is drawn. */
export const SUN_LOOK = Object.freeze({ radius: 0.035, gain: 2.4 });

/** The two moons: an angular radius and a colour each - Masser the large rose moon, Secunda the small silver one.
 *  They stand where the port's own dome puts them (render/enhancedSky.js moonSkyDirection, its tilts), so the
 *  world's moonlight is the same under either sky. `dayFade`: how much of a moon the full day takes away. */
export const MOON_LOOK = Object.freeze({
  masser: Object.freeze({ radius: 0.06, color: '#e2a890' }),
  secunda: Object.freeze({ radius: 0.032, color: '#e3e5ea' }),
  dayFade: 0.9,
  earthshine: 0.05,
});

/** The stars, drawn by the pass from a hash of cube-face cells: a bright sparse layer and a dim dense one, each
 *  cell holding a star at `chance`, its light in `gain`; `size` is a star's radius in cells; `twinkle` the share of
 *  its light that wavers; `band` the gain of the faint river of stars across the sky. They turn once a day about
 *  the dome's own pole. */
export const STAR_LOOK = Object.freeze({
  bright: Object.freeze({ cells: 110, chance: 0.12, gain: Object.freeze([0.55, 1]) }),
  dim: Object.freeze({ cells: 300, chance: 0.14, gain: Object.freeze([0.12, 0.4]) }),
  size: 0.11,
  twinkle: 0.3,
  band: 0.025,
  bandPole: Object.freeze([0.3, 0.45, -0.84]),
});

/** The cloud layers, drawn from our own noise (dynamicSkiesAssets.js paintSkyNoise). `scale` is the noise's tiling
 *  over the sky's plane, `speed` the periods it travels a game minute along `dir` - on the clock, so every player
 *  sees one sky. `soft` is the edge of a cloud's cut. Their colours: white lit, the weather's grey in shade. */
export const CLOUD_LOOK = Object.freeze({
  low: Object.freeze({ scale: 0.35, speed: 1 / 300, dir: Object.freeze([1, 0.35]) }),
  high: Object.freeze({ scale: 0.15, speed: 1 / 900, dir: Object.freeze([1, -0.1]) }),
  soft: 0.12,
  white: '#f2efe8',
  nightLit: '#151b29',
  nightShade: '#0a0d15',
});

/** The colour levels a channel the pass draws in - the sky's retro grain, through PS3's ordered dither. */
export const SKY_LEVELS = 48;

/** The sky's numbers walk to a new weather over this many game minutes (CLK1's one clock); a jump past
 *  SKY_JUMP_MINUTES, a load or a clock gone back takes the new row whole. */
export const SKY_EASE_MINUTES = 3;
export const SKY_JUMP_MINUTES = 60;

/** The easeable numbers of one weather's row. */
export function skyWeatherRow(weather, looks = WEATHER_LOOK) {
  const look = looks[weather] ?? looks.sunny;
  return { cover: look.cover, grey: hexLinear(look.grey) };
}

/** A row walked toward another by `k` (0 none, 1 whole). */
export function easeRow(from, to, k) {
  const share = clamp01(k);
  if (share === 1) return { cover: to.cover, grey: [...to.grey] };
  return { cover: mix(from.cover, to.cover, share), grey: mix3(from.grey, to.grey, share) };
}

/** What shows through a weather of cover c: the sun, the moons, the stars. */
export const weatherShow = (cover) => (1 - cover * cover) ** 2;

/** The hour's anchors at a sun height, walked linearly. */
export function hourAt(height) {
  const anchors = HOURS_LINEAR;
  if (height <= anchors[0].h) return { ...anchors[0] };
  for (let i = 0; i < anchors.length - 1; i++) {
    if (height <= anchors[i + 1].h) {
      const a = anchors[i],
        b = anchors[i + 1],
        share = (height - a.h) / (b.h - a.h);
      return {
        h: height,
        zenith: mix3(a.zenith, b.zenith, share),
        horizon: mix3(a.horizon, b.horizon, share),
        glow: mix3(a.glow, b.glow, share),
        glowAmount: mix(a.glowAmount, b.glowAmount, share),
        sun: mix3(a.sun, b.sun, share),
        light: mix(a.light, b.light, share),
      };
    }
  }
  return { ...anchors[anchors.length - 1] };
}

/** The night's weight on the stars at a sun height: none with the sun 3 degrees under, whole at 11 under. */
export const nightWeight = (height) => clamp01((-0.05 - height) / 0.14);
/** The world's moonlight under this sky: none with the sun a degree up, whole a degree under. */
export const moonNightWeight = (height) => clamp01((0.02 - height) / 0.04);

/** The moons' phases on the clock - the dome's continuous fraction (0 new, 4 full, 8 new again). */
export function phasesAt(classicMinutes) {
  const fractions = lunarPhaseFractionsFromMinutes(classicMinutes);
  return { masser: { phase: fractions.masser }, secunda: { phase: fractions.secunda } };
}

/** The light falling on a moon's face for its phase: from behind it at new, from the eye at full, and from the
 *  sun's side between - the lit limb always toward the sun. */
export function moonPhaseLight(moonDir, sunDir, phase) {
  const phi = (phase / 8) * 2 * Math.PI;
  const toEye = scale3(moonDir, -1);
  let side = add3(sunDir, scale3(moonDir, -dot3(sunDir, moonDir)));
  if (Math.hypot(...side) < 1e-4) side = add3([0, 1, 0], scale3(moonDir, -moonDir[1]));
  if (Math.hypot(...side) < 1e-4) side = [1, 0, 0];
  return norm3(add3(scale3(toEye, -Math.cos(phi)), scale3(norm3(side), Math.abs(Math.sin(phi)))));
}

const lean = (rgb, entry, light) => (entry ? mix3(rgb, hexLinear(entry[0]), entry[1] * light) : rgb);
const wrap = (value) => value - Math.floor(value);

/**
 * One frame of the sky, in the shape the pass and the bridge read.
 * @param {object} f { minuteOfDay, classicMinutes, row (skyWeatherRow, eased), season (SEASONS), seconds,
 *   weatherScale, phases (phasesAt), lightCurve, flash (the storm's flash now, StormFlash's level) }
 */
export function skyFrame({
  minuteOfDay,
  classicMinutes = 0,
  row = skyWeatherRow('sunny'),
  season = SEASONS.Spring,
  seconds = 0,
  weatherScale = 1,
  phases = null,
  lightCurve = DYNAMIC_LIGHT_CURVE,
  flash = 0,
}) {
  const sunDir = sunLightDirection(minuteOfDay);
  const strike = scale3(FLASH_LOOK.color, Math.max(0, flash) * FLASH_LOOK.sky); // the storm's flash in the sky's colours
  const height = sunDir[1];
  const hour = hourAt(height);
  const cover = row.cover;
  const greyMix = cover ** 1.5;
  const dark = 1 - 0.35 * cover * cover;
  const show = weatherShow(cover);
  const leanBy = SEASON_LEAN[season] ?? {};
  const greyNow = scale3(row.grey, Math.max(hour.light, 0.04));
  const zenith = add3(
    scale3(mix3(lean(hour.zenith, leanBy.zenith, hour.light), scale3(greyNow, 0.85), greyMix), dark),
    strike,
  );
  const horizon = add3(scale3(mix3(lean(hour.horizon, leanBy.horizon, hour.light), greyNow, greyMix), dark), strike);
  const glow = scale3(hour.glow, hour.glowAmount * (1 - 0.7 * greyMix));
  const lowSun = 1 - clamp01(height / 0.3);
  const lit = mix3(hexLinear(CLOUD_LOOK.white), row.grey, cover * 0.8);
  // the clouds take the flash whole - the storm's own deck is what it lights
  const cloudLit = add3(
    add3(scale3(mix3(lit, hour.sun, 0.55 * lowSun * (height > -0.05 ? 1 : 0)), hour.light), scale3(strike, 2)),
    hexLinear(CLOUD_LOOK.nightLit),
  );
  const cloudShade = add3(
    add3(scale3(row.grey, (0.5 + 0.2 * (1 - cover)) * hour.light), scale3(horizon, 0.15)),
    add3(hexLinear(CLOUD_LOOK.nightShade), scale3(strike, 1.5)),
  );
  const fractions = phases ?? phasesAt(classicMinutes);
  const moon = (name) => {
    const look = MOON_LOOK[name];
    const dir = moonSkyDirection(minuteOfDay, fractions[name].phase, MOONS[name].tilt);
    const vis = (1 - MOON_LOOK.dayFade * hour.light) * show;
    return {
      dir,
      radius: look.radius,
      phase: fractions[name].phase,
      vis,
      light: moonPhaseLight(dir, sunDir, fractions[name].phase),
      color: scale3(hexLinear(look.color), vis),
    };
  };
  const cloud = (layer, share, opacity) => [share, opacity, CLOUD_LOOK[layer].scale, CLOUD_LOOK.soft];
  const drift = (layer) => {
    const look = CLOUD_LOOK[layer];
    return [wrap(classicMinutes * look.speed * look.dir[0]), wrap(classicMinutes * look.speed * look.dir[1])];
  };
  const fog = add3(horizon, scale3(glow, 0.15));
  const dayShare = Math.max(0, Math.min(1, sunCurveTime(minuteOfDay)));
  const rig = SUN_RIG_INTENSITY * evaluateCurve(lightCurve, dayShare) * weatherScale;
  return {
    sunDir,
    sunHeight: height,
    zenith,
    horizon,
    ground: scale3(horizon, 0.45),
    glow,
    glowPower: mix(6, 48, clamp01(height / 0.42)),
    sunDisc: scale3(hour.sun, SUN_LOOK.gain * show * (0.6 + 0.4 * weatherScale)),
    sunCos: Math.cos(SUN_LOOK.radius),
    night: nightWeight(height) * show,
    starTurn: (minuteOfDay / 1440) * Math.PI * 2,
    starPole: STAR_POLE,
    twinkle: seconds,
    masser: moon('masser'),
    secunda: moon('secunda'),
    cloudLow: cloud('low', cover, 0.6 + 0.4 * cover),
    // a sliver of a high layer cut through a deck reads as scratches: it fades out from 16% of the sky to 7%
    cloudHigh: cloud('high', 0.3 * (1 - cover), 0.55 * smooth(0.07, 0.16, 0.3 * (1 - cover))),
    cloudOffset: [...drift('high'), ...drift('low')],
    cloudLit,
    cloudShade,
    clearColor: toSrgb3(fog),
    fillColor: toSrgb3(zenith),
    fogColor: toSrgb3(fog),
    lightColor: SUN_RIG_COLOR.map((value) => srgbToLinear(value) * rig),
    phases: fractions,
  };
}

// ── The world under this sky: its light curve and its fog rows ─────

/** THE LIGHT: while this sky is up it is the world's daylight curve too (worldClock.setLightCurve). Our rule: the
 *  light follows the sun's height, 0.92 sin(pi t)^0.6 over the day's fraction t - quicker up than the rig's and
 *  slower down, the longer sunrises and sunsets. Keys [t, value, inSlope, outSlope], slopes the rule's own. */
export const LIGHT_RULE = Object.freeze({ peak: 0.92, power: 0.6 });
const lightOf = (dayShare) =>
  dayShare <= 0 || dayShare >= 1 ? 0 : LIGHT_RULE.peak * Math.pow(Math.sin(Math.PI * dayShare), LIGHT_RULE.power);
export const DYNAMIC_LIGHT_CURVE = Object.freeze(
  [0, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 0.95, 0.98, 1].map((dayShare, i, all) => {
    const a = all[Math.max(0, i - 1)],
      b = all[Math.min(all.length - 1, i + 1)];
    const slope = dayShare === 0.5 ? 0 : (lightOf(b) - lightOf(a)) / (b - a);
    return Object.freeze([dayShare, lightOf(dayShare), slope, slope]);
  }),
);

/** THE FOG ROWS this sky installs for the world (world/weather.js fogForWeather reads them). The clear row is linear
 *  and ends at 4,800, the widest Land View's own end; every other row is exponential-squared, named by `d50` - the
 *  distance at which the air has taken half the light - and hides the ground by the far views' nearest edge, so the
 *  fire and the fences fog as the land does. The slider `densitySetting` (1..10) thickens every row by
 *  k = 1 + (x - 1) / 3: a density times k, a linear row's distances over k. */
export const FOG_LOOK = Object.freeze({
  sunny: Object.freeze({ mode: 'linear', start: 1200, end: 4800, excludeSky: true }),
  overcast: Object.freeze({ mode: 'exp2', d50: 1100, excludeSky: true }),
  rainy: Object.freeze({ mode: 'exp2', d50: 700, excludeSky: true }),
  snowy: Object.freeze({ mode: 'exp2', d50: 450, excludeSky: true }),
  heavy: Object.freeze({ mode: 'exp2', d50: 120, excludeSky: false }),
  sandstorm: Object.freeze({ mode: 'exp2', d50: 90, excludeSky: false }),
  ashfall: Object.freeze({ mode: 'exp2', d50: 400, excludeSky: true }),
});

/** Which fog row each weather word takes. */
export const FOG_PRESET_FOR_WEATHER = Object.freeze({
  sunny: 'sunny',
  cloudy: 'sunny',
  overcast: 'overcast',
  fog: 'heavy',
  rain: 'rainy',
  thunder: 'rainy',
  snow: 'snowy',
  sandstorm: 'sandstorm',
  ashfall: 'ashfall',
});

/** The rows in the port's FOG_SETTINGS shape, at a slider's thickness. */
export function fogSettingsFromPresets(rows = FOG_LOOK, densitySetting = 1) {
  const x = Math.max(1, Math.min(10, Math.trunc(Number(densitySetting) || 1)));
  const k = 1 + (x - 1) / 3;
  const conv = (row) =>
    Object.freeze(
      row.mode === 'linear'
        ? { mode: 'linear', density: 0, start: row.start / k, end: row.end / k, excludeSky: row.excludeSky }
        : {
            mode: row.mode,
            density: (Math.sqrt(Math.LN2) / row.d50) * k,
            start: 0,
            end: 0,
            excludeSky: row.excludeSky,
          },
    );
  return Object.freeze(Object.fromEntries(Object.entries(rows).map(([name, row]) => [name, conv(row)])));
}

/** The fog row a weather word takes. */
export function fogPresetKey(weather) {
  return FOG_PRESET_FOR_WEATHER[weather] ?? 'sunny';
}

// ── The pass's one texture ─────────────────────────────────────────

/** The slots the pass samples, bound from unit 0 (render/renderer.js CLOUD_SHADOW_UNIT sits above them). */
export const TEXTURE_SLOTS = Object.freeze(['uSkyNoise']);
/** How each of our painted textures is uploaded. The noise is data, not colour: linear, mipmapped, repeating. */
export const TEXTURE_IMPORTS = Object.freeze({
  SkyNoise: Object.freeze({ filter: 'bilinear', mips: true, srgb: false }),
});
/** What a slot shows until its texture is painted: the noise's middle. */
export const SLOT_DEFAULT_TEXEL = Object.freeze({ uSkyNoise: Object.freeze([128, 128, 128, 128]) });

// ── The sun, on DFU's own clock ────────────────────────────────────

/** SunlightManager.Update's sun, UNCLAMPED (DFU): time = (MinuteOfDay - dawn) / dayRange over the INT minute,
 *  Euler(180 * time, -90, 0), so the direction toward the sun is (cos, sin, 0)(180 * time). The world's
 *  worldClock.sunDirection clamps it for the key light; the sky sees the whole turn, under the horizon all night. */
export function sunLightDirection(minuteOfDay) {
  const dayShare = sunCurveTime(minuteOfDay);
  return [Math.cos(Math.PI * dayShare), Math.sin(Math.PI * dayShare), 0];
}

/** SunlightManager's day fraction for the curve, INT minute, unclamped (DFU). */
export function sunCurveTime(minuteOfDay) {
  const dawn = DAWN_HOUR * MINUTES_PER_HOUR;
  const dayRange = DUSK_HOUR * MINUTES_PER_HOUR - dawn;
  const minute = Math.floor(((minuteOfDay % 1440) + 1440) % 1440);
  return (minute - dawn) / dayRange;
}

/** The rig's sun light (DFU's SunlightRig colour, linear, times its intensity on a curve and the weather's scale). */
export function sunLightColor(minuteOfDay, lightCurve = DYNAMIC_LIGHT_CURVE, weatherScale = 1) {
  const dayShare = Math.max(0, Math.min(1, sunCurveTime(minuteOfDay)));
  const intensity = SUN_RIG_INTENSITY * evaluateCurve(lightCurve, dayShare) * weatherScale;
  return SUN_RIG_COLOR.map((value) => srgbToLinear(value) * intensity);
}

/** The season the sky's clock is in. */
export const seasonAt = (classicMinutes) => seasonValue(dateFromClassicMinutes(classicMinutes));

/** The most real time one frame's clock carries into the flash below: a hitch past it is spread over the frames
 *  that follow, so a flash's strokes are never all spent in one frame. */
export const MAX_DELTA_SECONDS = 1 / 3;

// ── The storm's flash ──────────────────────────────────────────────

/** THE STORM'S FLASH, OURS (OWN-WORK4 AUDIT, 2026-11-01). A storm's clap is seen as well as heard at `chance`. A flash
 *  is a few return strokes - one to four, mostly one or two - each a quick rise and a falling tail, `gap` apart, each
 *  fainter than the last. Its light is a cold point light at the strike, `away` from the player and `height` up, so
 *  the land is lit from one side; the sky and its clouds take `sky` of it (skyFrame's `flash`). */
export const FLASH_LOOK = Object.freeze({
  chance: 0.65,
  rise: 0.012,
  decay: 0.07,
  gap: Object.freeze([0.05, 0.12]),
  fade: Object.freeze([0.55, 0.85]),
  peak: Object.freeze([1.2, 2.2]),
  color: Object.freeze([0.8, 0.86, 1]),
  range: Object.freeze([600, 900]),
  away: Object.freeze([40, 160]),
  height: Object.freeze([60, 120]),
  sky: 0.35,
});
/** Where a stroke's tail is spent: under 2% of its peak. */
const STROKE_END = FLASH_LOOK.rise + FLASH_LOOK.decay * Math.log(50);
/** A stroke's light at `t` seconds from its start, 0..1: a linear rise, then an exponential fall. */
export const strokeLevel = (t) =>
  t < 0 || t > STROKE_END
    ? 0
    : t < FLASH_LOOK.rise
      ? t / FLASH_LOOK.rise
      : Math.exp(-(t - FLASH_LOOK.rise) / FLASH_LOOK.decay);

export class StormFlash {
  constructor(rng = Math.random) {
    this.rng = rng;
    /** the flashes in flight: { t (s since the first stroke; null until its first frame), strokes: [[start, peak]],
     *  offset: the strike from the player, range } */
    this._routines = [];
    this.level = 0;
  }

  _range([min, max]) {
    return min + this.rng() * (max - min);
  }

  /** A storm's clap: a flash at `chance`, its strokes and its strike drawn now. Answers whether it flashes. */
  startFlash(playerPos) {
    if (!playerPos || !(this.rng() < FLASH_LOOK.chance)) return false;
    const count = 1 + Math.floor(this.rng() ** 2 * 4);
    const strokes = [];
    let at = 0,
      peak = this._range(FLASH_LOOK.peak);
    for (let k = 0; k < count; k++) {
      strokes.push([at, peak]);
      at += this._range(FLASH_LOOK.gap);
      peak *= this._range(FLASH_LOOK.fade);
    }
    const bearing = this.rng() * 2 * Math.PI,
      away = this._range(FLASH_LOOK.away);
    this._routines.push({
      t: null,
      strokes,
      offset: [Math.cos(bearing) * away, this._range(FLASH_LOOK.height), Math.sin(bearing) * away],
      range: this._range(FLASH_LOOK.range),
      origin: [...playerPos],
    });
    return true;
  }

  /** A flash's light at its own clock: its strongest stroke's. */
  _levelOf(r) {
    let level = 0;
    for (const [start, peak] of r.strokes) level = Math.max(level, peak * strokeLevel(r.t - start));
    return level;
  }

  /** Advance by a frame. A flash's first frame is its first stroke's peak, whatever the frame's dt. Answers the light
   *  for the point-light channel ({x, y, z, range, color}) while one is lit, else null; `level` is its strength for
   *  the sky. The strike rides with the player (`playerPos`, live), so the floating origin carries it. */
  tick(dt, playerPos = null) {
    let best = null,
      level = 0;
    for (const r of this._routines) {
      r.t = r.t === null ? FLASH_LOOK.rise : r.t + Math.max(0, dt);
      const l = this._levelOf(r);
      if (l > level) {
        level = l;
        best = r;
      }
    }
    this._routines = this._routines.filter((r) => r.t <= r.strokes[r.strokes.length - 1][0] + STROKE_END);
    this.level = level;
    if (!best || level <= 0) return null;
    const at = playerPos ?? best.origin,
      o = best.offset,
      c = FLASH_LOOK.color;
    return {
      x: at[0] + o[0],
      y: at[1] + o[1],
      z: at[2] + o[2],
      range: best.range,
      color: [c[0] * level, c[1] * level, c[2] * level],
    };
  }

  /** The door's teardown: every flash stopped and the light off. */
  stopAll() {
    this._routines.length = 0;
    this.level = 0;
  }
}

/** The pixel snow's numbers from its sliders: a flake's size is the slider over 100,000 of the view (a fraction,
 *  as the snow's pass takes it); the count is the slider in thousands, the most flakes the pass draws (OWN-WORK4: the
 *  retired mod logged it and never applied it). */
export function pixelSnowSettings({ MinParticleSize = 100, MaxParticleSize = 300, MaxParticles = 20 } = {}) {
  return {
    minParticleSize: MinParticleSize / 100000,
    maxParticleSize: MaxParticleSize / 100000,
    maxParticles: Math.trunc(MaxParticles * 1000),
  };
}
