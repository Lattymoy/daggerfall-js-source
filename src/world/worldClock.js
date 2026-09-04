// Day/night cycle: time-of-day driving sun, ambient, sky frame, window
// style, and city lights. 1:1 with Daggerfall Unity's DaggerfallDateTime
// constants, SunlightManager, PlayerAmbientLight, and DaggerfallLight (MIT,
// Daggerfall Workshop). Verbatim:
//   - DawnHour 6, DuskHour 18, LightsOnHour 17, LightsOffHour 8; IsNight =
//     hour < 6 || >= 18; IsCityLightsOn = hour >= 17 || < 8.
//   - Sun disabled entirely at night. Day fraction t = (minuteOfDay - 360) /
//     720; sun euler (180 * t, -90, 0) gives light forward
//     (-cos, -sin, 0)(180t) - dawn from map east (+X), noon straight down.
//   - daylightScale = LightCurve.Evaluate(t): the SunlightRig prefab's
//     Hermite keys ported verbatim ((0,0), (0.08,0.36, slope 2.8928573),
//     (0.5,0.9), (0.92,0.36, slope -2.8928576), (1,0)); Unity Evaluate
//     clamps outside the key range. Sun rig base intensity 0.6, color
//     (0.816, 0.954, 1).
//   - Exterior ambient = lerp(ExteriorNightAmbientLight 0.25 *
//     NightAmbientLightScale (settings default 1), ExteriorNoonAmbientLight
//     0.9, daylightScale).
//   - Window style: Night when IsNight, else Day (the ChangeClimate call
//     sites' rule; Fog arrives with weather).
//   - City light flicker (DaggerfallLight.AnimateLight): 14 ticks/second,
//     target = Random.Range(startRange - Variance 1, startRange), step
//     Speed 0.4 toward it; per light. Engine Random.Range is replaced by
//     the approved umRandom substitute (Port-Ledger A).
// EQUIVALENCE (documented): DFU's SkyCurve asset was not extracted; sky
// frames advance linearly across daylight (t * 63), night uses the NITE sky.

import { UMRandom } from '../formats/umRandom.js';

export const LIGHTS_ON_HOUR = 17;
export const LIGHTS_OFF_HOUR = 8;
// AUDIT 24 (wave 24): DaggerfallDateTime's calendar constants have
// one home in systems/gameDate.js. V1 moved DAWN_HOUR and DUSK_HOUR
// there too - they are the same class's members, and the vampire
// turn's raise needs dusk from outside the light rig.
import { MINUTES_PER_HOUR, MINUTES_PER_DAY, DAWN_HOUR, DUSK_HOUR } from '../systems/gameDate.js';

export { MINUTES_PER_HOUR, MINUTES_PER_DAY, DAWN_HOUR, DUSK_HOUR };

export const SUN_RIG_INTENSITY = 0.6;
export const SUN_RIG_COLOR = Object.freeze([0.8161765, 0.954361, 1]);
// R12: SunlightRig's IndirectLight - "point light that follows player
// to simulate indirect lighting". Serialized prefab values (git show
// Assets/Prefabs/World/SunlightRig.prefab): type Point, intensity 1,
// range 150, color 0.7058824 gray. (The Ledger's "white 0.6" note
// described the rig's directional FILLS - the prefab is authority.)
export const INDIRECT_LIGHT_COLOR = Object.freeze([0.7058824, 0.7058824, 0.7058824]);
export const INDIRECT_LIGHT_INTENSITY = 1.0;
export const INDIRECT_LIGHT_RANGE = 150;
export const EXTERIOR_NOON_AMBIENT = Object.freeze([0.9, 0.9, 0.9]);
export const EXTERIOR_NIGHT_AMBIENT = Object.freeze([0.25, 0.25, 0.25]);

// SunlightRig LightCurve keys: [time, value, inSlope, outSlope].
const LIGHT_CURVE = [
  [0, 0, 0, 0],
  [0.08, 0.36, 2.8928573, 2.8928573],
  [0.5, 0.9, 0, 0],
  [0.92, 0.36, -2.8928576, -2.8928576],
  [1, 0, 0, 0],
];

/** Unity AnimationCurve.Evaluate: cubic Hermite between keys, clamped. */
export function evaluateCurve(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const [t0, v0, , outSlope] = keys[i];
  const [t1, v1, inSlope] = keys[i + 1];
  const dt = t1 - t0;
  const s = (t - t0) / dt;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return h00 * v0 + h10 * dt * outSlope + h01 * v1 + h11 * dt * inSlope;
}

export function hourOf(minuteOfDay) {
  return Math.floor((((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
}

export function isNight(minuteOfDay) {
  const hour = hourOf(minuteOfDay);
  return hour < DAWN_HOUR || hour >= DUSK_HOUR;
}

export function isCityLightsOn(minuteOfDay) {
  const hour = hourOf(minuteOfDay);
  return hour >= LIGHTS_ON_HOUR || hour < LIGHTS_OFF_HOUR;
}

/** (minuteOfDay - dawn) / dayRange, unclamped - SunlightManager's t. */
export function dayFraction(minuteOfDay) {
  const dawn = DAWN_HOUR * MINUTES_PER_HOUR;
  const dayRange = DUSK_HOUR * MINUTES_PER_HOUR - dawn;
  const m = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return (m - dawn) / dayRange;
}

/** LightCurve at the (clamped) day fraction - 0 through the night. */
export function daylightScale(minuteOfDay) {
  return evaluateCurve(LIGHT_CURVE, Math.max(0, Math.min(1, dayFraction(minuteOfDay))));
}

/**
 * Unit vector TOWARD the sun (shader light dir). Sun euler (180t, -90, 0)
 * points its forward at (-cos, -sin, 0); toward-sun is the negation.
 */
export function sunDirection(minuteOfDay) {
  const x = Math.PI * Math.max(0, Math.min(1, dayFraction(minuteOfDay)));
  return new Float32Array([Math.cos(x), Math.sin(x), 0]);
}

/** Exterior ambient color for the time of day (nightAmbientScale
 *  default 1). AUDIT 23 (wts-2) - PlayerAmbientLight.cs:120-125: the
 *  day lerp factor rides the weather sunlight scale
 *  (WeatherManager.SetSunlightScale's 0.25 storm / 0.45 rain-snow /
 *  0.65 overcast-fog-winter), so a storming noon reads near-night.
 *  AUDIT 39 (#13): TWICE, not once. SunlightManager.Update (:119-127)
 *  writes the scale INTO its own daylightScale field while the key
 *  light is enabled (`daylightScale *= ScaleFactor`) and DaylightScale
 *  returns that already-scaled field, so
 *  CalcDaytimeAmbientLight's `DaylightScale * ScaleFactor` - run from
 *  LateUpdate, after Update - is curve x scale^2. The KEY light is
 *  scaled once (sunScale x weatherScale at the hosts) and stays so.
 *  The night arm needs no branch: the curve is 0 outside dawn-dusk in
 *  both, and DFU skips the *= only where it would multiply zero. */
export function exteriorAmbient(minuteOfDay, nightAmbientScale = 1, weatherScale = 1) {
  const s = daylightScale(minuteOfDay) * weatherScale * weatherScale;
  const out = new Float32Array(3);
  for (let i = 0; i < 3; i++) {
    const night = EXTERIOR_NIGHT_AMBIENT[i] * nightAmbientScale;
    out[i] = night + (EXTERIOR_NOON_AMBIENT[i] - night) * s;
  }
  return out;
}

/** Sun contribution scale: rig intensity * daylight curve, 0 at night. */
export function sunScale(minuteOfDay) {
  return isNight(minuteOfDay) ? 0 : SUN_RIG_INTENSITY * daylightScale(minuteOfDay);
}

/** R12: the indirect light's scale - SunlightManager disables the
 *  whole rig at night and SetLightIntensity multiplies the saved
 *  intensity by the same daylight-curve scale as the key light. */
export function indirectLightScale(minuteOfDay) {
  return isNight(minuteOfDay) ? 0 : INDIRECT_LIGHT_INTENSITY * daylightScale(minuteOfDay);
}

/** Day sky frame 0-63 (linear equivalence); null means use the night sky. */
export function skyFrameForTime(minuteOfDay) {
  if (isNight(minuteOfDay)) return null;
  return Math.max(0, Math.min(63, Math.round(dayFraction(minuteOfDay) * 63)));
}

export function windowStyleForTime(minuteOfDay) {
  return isNight(minuteOfDay) ? 'night' : 'day';
}

/** Parse ?tod=HH:MM (or a bare minute count) to minuteOfDay; null if absent. */
export function parseTimeOfDay(value) {
  if (value === null || value === undefined || value === '') return null;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = Number(value);
  return Number.isFinite(n) ? ((n % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY : null;
}

/**
 * Per-light flicker, verbatim DaggerfallLight.AnimateLight at 14 ticks per
 * second: each light steps its range by 0.4 toward a target drawn from
 * [startRange - 1, startRange].
 */
export class CityLightAnimator {
  /** startRange: uniform number (city lanterns) or per-light array
   * (dungeon radii - each light flickers about its own start range). */
  constructor(count, startRange, seed = 0x9d2c5680) {
    this._starts = new Float32Array(count);
    if (typeof startRange === 'number') this._starts.fill(startRange);
    else this._starts.set(startRange);
    this.variance = 1.0;
    this.speed = 0.4;
    this.framesPerSecond = 14;
    this._accumulator = 0;
    this._rng = new UMRandom(seed >>> 0 || 1);
    this.ranges = new Float32Array(this._starts);
    this._targets = new Float32Array(this._starts);
    this._stepping = new Uint8Array(count);
  }

  tick(dtSeconds) {
    this._accumulator += dtSeconds;
    const step = 1 / this.framesPerSecond;
    while (this._accumulator >= step) {
      this._accumulator -= step;
      for (let i = 0; i < this.ranges.length; i++) {
        if (this._stepping[i]) {
          if (this._targets[i] <= this.ranges[i]) {
            this.ranges[i] -= this.speed;
            if (this.ranges[i] <= this._targets[i]) this._stepping[i] = 0;
          } else {
            this.ranges[i] += this.speed;
            if (this.ranges[i] >= this._targets[i]) this._stepping[i] = 0;
          }
        } else {
          this._targets[i] =
            this._starts[i] - this.variance + this._rng.nextFloat() * this.variance;
          this._stepping[i] = 1;
        }
      }
    }
  }
}
