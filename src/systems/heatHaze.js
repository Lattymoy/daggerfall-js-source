// HAZE1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These should be on
// by default and integrate into our enhanced environments seamlessly") - HEAT HAZE 1.0.1 (demifiend000, vendored at
// vendor/heat-haze/), ported off its assembly: HeatHazeEligibility whole, and HeatHazeMod's state - its settings, the
// ring's place and scale, the strength's ease and the noise it bends the view by. Pure: the host hands it the frame
// (render/heatHaze.js draws what it answers).
//
// THE LAW (HeatHazeEligibility, HeatHazeMod.Update / IsEnvironmentEligible):
//   - outdoors, in the Desert (224) or Desert2 (225) climate - or Subtropical (229) with AllowSubtropical on - by day
//     (DaggerfallDateTime.IsDay: 06:00 to 18:00), under a sunny sky (strength 1) or a cloudy one (0.5);
//   - times the daylight: 0 up to 06:00, a smoothstep up over the next thirty minutes, 1 through the day, down over the
//     thirty before 18:00 (GetDaylightStrength);
//   - the target is Intensity (1.5 screen pixels) times both; the drawn strength eases toward it, 1 - e^(-dt / 0.8 s)
//     of the way a frame, and snaps within 1e-4 - and an ineligible frame drops it to 0 AT ONCE (the mod's Update);
//   - the ring follows the player: its axis the player's x and z, its middle 1.5 m over the capsule's foot, read while
//     grounded (UpdateRingTransform); scaled to FullStrengthDistance across and RingHeight tall.
//
// ENHANCED ENVIRONMENTS (Mac: "integrate into our enhanced environments"): the haze is the enhanced lane's, as the
// port's other outdoor looks are - the hosts build the renderer only under it (sky.enhanced), the mod's own switch
// (MOD_SETTINGS 'heat-haze' Enabled, on by default - MO1) and `?haze=off` the kill door beside it.

import { modSetting } from './modSettings.js';
import { NetRandom } from '../formats/netRuntime.js';
import { pageParam } from './pageQuery.js';

export const HEAT_HAZE_VENDOR = 'heat-haze';
/** Climates (MapsFile climate indices): Desert, Desert2 - and Subtropical behind AllowSubtropical. */
export const HAZE_CLIMATES = Object.freeze({ desert: 224, desert2: 225, subtropical: 229 });
/** HeatHazeMod's constants, verbatim. */
export const HAZE = Object.freeze({
  noiseSize: 64, noiseLattice: 8, noiseSeed: 1212701233,
  cylinderSegments: 128, cylinderHalfHeight: 70, layerHeightOffset: 1.5, fadeSeconds: 0.8,
  transitionMinutes: 30, dawnMinute: 360, duskMinute: 1080,
});

const f32 = Math.fround;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** HeatHazeEligibility.GetWeatherStrength: Sunny 1, Cloudy 0.5, every other weather 0. `weather` is DFU's WeatherType
 *  number or the port's word ('sunny'...; the port's eighth, 'sandstorm', is no sunny sky). */
export function weatherStrength(weather) {
  if (weather === 0 || weather === 'sunny') return 1;
  if (weather === 1 || weather === 'cloudy') return 0.5;
  return 0;
}

/** HeatHazeEligibility.MeetsRules. */
export function meetsRules(isExterior, climate, isDay, weather, allowSubtropical) {
  const desert = climate === HAZE_CLIMATES.desert || climate === HAZE_CLIMATES.desert2 || (allowSubtropical && climate === HAZE_CLIMATES.subtropical);
  return isExterior && desert && isDay ? weatherStrength(weather) > 0 : false;
}

const smoothStep01 = (v) => { const t = v < 0 ? 0 : v > 1 ? 1 : v; return t * t * (3 - 2 * t); };
/** HeatHazeEligibility.GetDaylightStrength(hour, minute, second), over the minute of the day (hour * 60 + minute +
 *  second / 60). */
export function daylightStrength(minuteOfDay) {
  const m = minuteOfDay;
  if (m <= HAZE.dawnMinute || m >= HAZE.duskMinute) return 0;
  const rise = smoothStep01((m - HAZE.dawnMinute) / HAZE.transitionMinutes);
  const fall = smoothStep01((HAZE.duskMinute - m) / HAZE.transitionMinutes);
  return rise < fall ? rise : fall;
}

/** DaggerfallDateTime.IsDay: DawnHour (6) <= hour < DuskHour (18). */
export const isDayMinute = (minuteOfDay) => { const h = Math.floor(minuteOfDay / 60); return h >= 6 && h < 18; };

/** .NET's Math.Round (MidpointRounding.ToEven) - Mathf.RoundToInt. */
const roundHalfEven = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; };
/** HeatHazeMod.CreateNoiseTexture: a 64 x 64 value noise over an 8 x 8 lattice, two channels (R and G), the lattice's
 *  values System.Random(1212701233)'s NextDouble in turn (R's lattice point, G's, the next...). Single precision as
 *  the C# runs it. RGBA bytes, row 0 first (SetPixels32's order - the bottom row, as a texture upload's first row). */
export function hazeNoise() {
  const N = HAZE.noiseSize, L = HAZE.noiseLattice;
  const random = new NetRandom(HAZE.noiseSeed);
  const a = new Float32Array(N), b = new Float32Array(N);
  for (let i = 0; i < N; i++) { a[i] = random.nextDouble(); b[i] = random.nextDouble(); }
  const smooth = (v) => f32(f32(f32(v * v)) * f32(3 - f32(2 * v)));
  const lerp = (x, y, t) => f32(x + f32(f32(y - x) * clamp(t, 0, 1)));
  const lattice = (vals, x0, x1, y0, y1, fx, fy) => lerp(lerp(vals[y0 * L + x0], vals[y0 * L + x1], fx), lerp(vals[y1 * L + x0], vals[y1 * L + x1], fx), fy);
  const out = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) {
    const num = f32(f32(j * L) / N);
    const y0 = Math.floor(num) % L, y1 = (y0 + 1) % L;
    const fy = smooth(f32(num - Math.floor(num)));
    for (let k = 0; k < N; k++) {
      const n3 = f32(f32(k * L) / N);
      const x0 = Math.floor(n3) % L, x1 = (x0 + 1) % L;
      const fx = smooth(f32(n3 - Math.floor(n3)));
      const o = (j * N + k) * 4;
      out[o] = roundHalfEven(f32(lattice(a, x0, x1, y0, y1, fx, fy) * 255));
      out[o + 1] = roundHalfEven(f32(lattice(b, x0, x1, y0, y1, fx, fy) * 255));
      out[o + 2] = 0;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** HeatHazeMod.LoadSettings: the mod's own keys, clamped as it clamps them. */
export function heatHazeSettings(read = (k) => modSetting(HEAT_HAZE_VENDOR, k)) {
  return {
    enabled: read('Enabled') === true,
    allowSubtropical: read('Heat Haze.AllowSubtropical') === true,
    intensity: clamp(Number(read('Heat Haze.Intensity')), 0, 3),
    distance: clamp(Number(read('Heat Haze.FullStrengthDistance')), 50, 3000),
    ringHeight: clamp(Number(read('Heat Haze.RingHeight')), 50, 1500),
    noiseScale: clamp(Number(read('Heat Haze.NoiseScale')), 0.25, 6),
    animationSpeed: clamp(Number(read('Heat Haze.AnimationSpeed')), 0, 4),
  };
}

/** The settings an ineligible frame reads when the mod's switch is off - the strength falls to 0 at once. */
export const HAZE_OFF = Object.freeze({ enabled: false, allowSubtropical: false, intensity: 0, distance: 400.4, ringHeight: 1006, noiseScale: 4.5, animationSpeed: 4 });

/** The mod's switch with the kill door beside it - the hosts read this once a frame. */
export const heatHazeOn = (search = globalThis.location?.search ?? '') => modSetting(HEAT_HAZE_VENDOR, 'Enabled') === true && pageParam('haze', search) !== 'off';

/**
 * HeatHazeMod's per-frame state. `tick(frame)` takes
 *   { dt, exterior, climate, weather, minuteOfDay, foot: [x, y, z], grounded, settings? }
 * - `dt` unscaled seconds, `foot` the player's capsule foot in scene space - and answers
 *   { visible, intensity, center: [x, y, z], radius, halfHeight, noiseScale, animationSpeed }:
 * the ring's world transform (radius = FullStrengthDistance, halfHeight = RingHeight / 2 - the 70-unit half height of
 * the mesh times RingHeight / 140) and the strength to draw it at. `visible` is the renderer's `enabled`
 * (currentIntensity > 1e-4).
 */
export function createHeatHaze() {
  let current = 0;
  let layerY = 0;
  let layerKnown = false;
  return {
    tick({ dt = 0, exterior = false, climate = -1, weather = null, minuteOfDay = 0, foot = [0, 0, 0], grounded = true, settings = heatHazeSettings() } = {}) {
      // UpdateRingTransform: the layer's height is taken while grounded (or the first time)
      if (grounded || !layerKnown) { layerY = foot[1] + HAZE.layerHeightOffset; layerKnown = true; }
      const eligible = meetsRules(exterior, climate, isDayMinute(minuteOfDay), weather, settings.allowSubtropical);
      const strength = eligible ? daylightStrength(minuteOfDay) * weatherStrength(weather) : 0;
      if (!settings.enabled || !eligible) current = 0;
      else {
        const target = settings.intensity * strength;
        const k = 1 - Math.exp(-Math.max(0, dt) / HAZE.fadeSeconds);
        current += (target - current) * k;
        if (Math.abs(current - target) < 0.0001) current = target;
      }
      return {
        visible: current > 0.0001,
        intensity: current,
        center: [foot[0], layerY, foot[2]],
        radius: settings.distance,
        halfHeight: settings.ringHeight / 2,
        noiseScale: settings.noiseScale,
        animationSpeed: settings.animationSpeed,
      };
    },
    /** An ineligible frame the host does not tick (inside, underground): the strength is 0 at once, as the mod's
     *  Update sets it on every frame the rules fail. */
    suppress() { current = 0; },
    /** A new world (a load, a travel's arrival): the layer is read afresh and the strength starts from nothing. */
    reset() { current = 0; layerKnown = false; },
  };
}
