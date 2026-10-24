// @ts-check
// KETCH-LOOK KL1 (bible/11-Multiplayer/Sky-Ketch-Look.md section 14, "Her light by the hour"; section 5, below decks):
// HER LIGHT BY THE HOUR AND THE ZONE - pure. Her open decks were lit by a two-point lerp between a night and a noon with the
// sun's colour fixed at every hour, and no grade (scenes/worldModes.js grades the Hour, the Spire and interiors, never
// her): one flat brown at dusk, the decks black at dusk and night (floor mean 0.02), the gun deck and the hold black at
// every hour (p50 0.003-0.005). Now a row an hour and a room, each:
//   ambient   the trilight's sky term (a floor's face); the equator (a wall's, a body's) is KT_TRI.equator of it; the
//             ground (a ceiling's, her belly's) the deck's bounce: KT_TRI.bounce of the sun - warm below decks
//   sun       the key's colour and share (none below); its colour follows its elevation (ketchSunColor) on the day's row
//   key       by night the moons' key in the sun's stead, from the world's moon (render/enhancedSky.js moonlightTerm)
//   fog       the haze's colour and density - thinner by day than she had (0.0028), so the city 800 m off keeps a
//             quarter of its contrast; the lamps' warm close air below
//   lamps     her deck lamps' gain - dim by day, brightest at night
//   grade     the lane's grade (render/renderer.js setSceneGrade - world/superDungeon/sdLook.js SD_HOUR_GRADE's shape)
//   classic   the classic set's own (KETCH-LOOK KL2): it has no eye to open in the dark or close in the noon, and a lamp
//             falls off as (1 - d/r)^2, so its `light` (the ambient, the sun, the key) and its `lamps` carry the eye the
//             lane would open - measured, both lanes held to the one ladder
// The open decks' rows are walked by the world's daylight (world/worldClock.js daylightScale, over its own noon) between
// night and day - full day once it passes KT_DAY_FULL of its noon, the hour the dawn window closes - then toward dawn's or
// dusk's row over its window, the hour the sky itself turns.
//
// Not a DFU member. Ledger A (KETCH).
import { daylightScale, dayFraction } from '../worldClock.js';
import { KT_AIR_FOG, KT_BELOW_FOG, KT_LIGHT } from './ketchShip.js';

const f3 = (a, b, c) => Object.freeze([a, b, c]);
const grade = (adaptKey, adaptMax, bloom, vignette, contrast) => Object.freeze({ adaptKey, adaptMax, bloom, vignette, contrast });
const classic = (light, lamps) => Object.freeze({ light, lamps });

/** THE ROWS. `from`..`to` an open-deck twilight row's window (hours; its peak the window's middle). The night's `key` is the
 *  moons' (by DFU's exterior night floor, PlayerAmbientLight.ExteriorNightAmbientLight 0.25, under her moon's tint); the
 *  cabin is the hour's own row, its ambient `ambientK` of it. */
export const KT_HOURS = Object.freeze({
  dawn: Object.freeze({ from: 5, to: 7, ambient: f3(0.36, 0.33, 0.36), sun: f3(1.0, 0.72, 0.5), share: 0.6, fog: f3(0.66, 0.52, 0.5), density: 0.0020, lamps: 2.0, grade: grade(0.18, 1.6, 0.6, 0.24, 1.04), classic: classic(1.9, 1.9) }),
  day: Object.freeze({ ambient: KT_LIGHT.noon, sun: KT_LIGHT.sun, share: KT_LIGHT.sunScale, fog: KT_AIR_FOG.color, density: KT_AIR_FOG.density, lamps: 0.6, grade: grade(0.16, 1.5, 0.7, 0.26, 1.06), classic: classic(0.85, 1) }),
  dusk: Object.freeze({ from: 17, to: 19.5, ambient: f3(0.34, 0.28, 0.26), sun: f3(1.0, 0.62, 0.36), share: 0.7, fog: f3(0.62, 0.42, 0.36), density: 0.0022, lamps: 2.0, grade: grade(0.17, 1.7, 0.65, 0.26, 1.05), classic: classic(1.9, 1.9) }),
  night: Object.freeze({ ambient: f3(0.25, 0.27, 0.34), key: f3(0.18, 0.2, 0.28), share: 0, fog: f3(0.05, 0.07, 0.12), density: 0.0016, lamps: 1.6, grade: grade(0.16, 2.0, 0.7, 0.30, 1.06), classic: classic(1.1, 1.1) }),
  below: Object.freeze({ ambient: f3(0.26, 0.21, 0.16), ground: f3(0.3, 0.21, 0.12), share: 0, fog: KT_BELOW_FOG.color, density: KT_BELOW_FOG.density, lamps: 1.5, grade: grade(0.14, 1.5, 0.75, 0.34, 1.08), classic: classic(1.6, 1.6) }),
  cabin: Object.freeze({ ambientK: 0.7, lamps: 2.0, grade: grade(0.15, 1.6, 0.7, 0.30, 1.06), classic: classic(1.2, 3.8) }),
});
/** THE DAY'S ROW IS WHOLE once the world's daylight passes this share of its noon (07:00 and 17:00 on DFU's curve, where the
 *  dawn window closes and the dusk one opens). The plan walked the rows by the daylight itself (Sky-Ketch-Look.md section
 *  14), which left the morning a grey between them: at 07:00, the dawn row gone, her haze stood at [0.28, 0.33, 0.40] under
 *  a sky already day's. */
export const KT_DAY_FULL = 0.4;
/** THE TRILIGHT's two shares: the equator of the sky term, the ground (the deck's bounce) of the sun's light. */
export const KT_TRI = Object.freeze({ equator: 0.8, bounce: 0.35 });
/** THE SUN BY ITS ELEVATION (degrees, high to low): the day's colour above 12, easing to a gold at 3 and a red at the
 *  horizon. Its share comes up over the first `rise` degrees, so it never lights her from under the horizon. */
export const KT_SUN_LOW = Object.freeze({ high: 12, low: 3, gold: f3(1.0, 0.72, 0.42), red: f3(0.95, 0.5, 0.3), rise: 6 });

const smooth = (k) => { const x = Math.max(0, Math.min(1, k)); return x * x * (3 - 2 * x); };
/** The sun's colour at `elev` degrees, into `out`. Pure. */
export function ketchSunColor(elev, out = [0, 0, 0]) {
  const S = KT_SUN_LOW, day = KT_HOURS.day.sun;
  if (elev >= S.high) { out[0] = day[0]; out[1] = day[1]; out[2] = day[2]; return out; }
  const a = elev >= S.low ? S.gold : S.red, b = elev >= S.low ? day : S.gold;
  const k = elev >= S.low ? smooth((elev - S.low) / (S.high - S.low)) : smooth(Math.max(0, elev) / S.low);
  for (let i = 0; i < 3; i++) out[i] = a[i] + (b[i] - a[i]) * k;
  return out;
}
/** The sun's elevation (degrees) and its direction toward it (`dir`, written in place) at the world's `minute` - the
 *  clock's own arc (world/worldClock.js sunDirection). */
export function ketchSunAt(minute, dir = [0, 1, 0]) {
  const t = dayFraction(minute), x = Math.PI * Math.max(0, Math.min(1, t));
  dir[0] = Math.cos(x); dir[1] = Math.sin(x); dir[2] = 0;
  return t >= 0 && t <= 1 ? (Math.min(x, Math.PI - x) * 180) / Math.PI : 0;
}
/** How far the open decks stand toward the day (0 night - 1 whole day, KT_DAY_FULL) and toward a twilight row (`w`, and
 *  which: `row` 'dawn' | 'dusk') at the world's `minute`, into `out`. Pure. */
export function ketchHourWeights(minute, out = { day: 0, w: 0, row: 'dawn' }) {
  const noon = daylightScale(720), h = (((minute / 60) % 24) + 24) % 24;
  out.day = noon > 0 ? smooth(daylightScale(minute) / noon / KT_DAY_FULL) : 0;
  const R = h < 12 ? KT_HOURS.dawn : KT_HOURS.dusk, mid = (R.from + R.to) / 2, half = (R.to - R.from) / 2;
  out.w = Math.max(0, 1 - Math.abs(h - mid) / half);
  out.row = h < 12 ? 'dawn' : 'dusk';
  return out;
}

const _w = { day: 0, w: 0, row: 'dawn' }, _sun = [0, 0, 0];
const mix = (a, b, k) => a * (1 - k) + b * k;   // whole at either end (a + (b - a) * k misses b by a rounding)
const lerp3 = (out, a, b, k) => { for (let i = 0; i < 3; i++) out[i] = mix(a[i], b[i], k); return out; };
const GRADE_KEYS = Object.freeze(['adaptKey', 'adaptMax', 'bloom', 'vignette', 'contrast']), CLASSIC_KEYS = Object.freeze(['light', 'lamps']);
const lerpGrade = (out, a, b, k) => { for (const n of GRADE_KEYS) out[n] = mix(a[n], b[n], k); return out; };
/** A light record's shape (ketchHourLight's `out`). */
export function ketchLightRecord() {
  return {
    ambient: [0, 0, 0], tri: { sky: [0, 0, 0], equator: [0, 0, 0], ground: [0, 0, 0] },
    sunColor: [0, 0, 0], sunScale: 0, sunDir: [0, 1, 0], key: { scale: 0, dir: [0, 1, 0], color: [0, 0, 0] },
    fog: { mode: 'exp', density: 0, color: [0, 0, 0] }, lamps: 1, grade: { adaptKey: 0, adaptMax: 0, bloom: 0, vignette: 0, contrast: 0 },
    classic: { light: 1, lamps: 1 },
  };
}
/**
 * HER LIGHT at the world's `minute` in `zone` - 'deck' (her open decks, the tops, the bridge), 'below' (the gun deck,
 * the landing, the hold) or 'cabin' - written into `out` (ketchLightRecord's shape), every array in place. `key.scale` is
 * the night key's share before the moon's own (the caller's: a moon that is new, set or clouded gives none). Pure.
 */
export function ketchHourLight(minute, zone, out = ketchLightRecord()) {
  const H = KT_HOURS, below = zone === 'below';
  const elev = ketchSunAt(minute, out.sunDir);
  if (below) {
    const B = H.below;
    for (let i = 0; i < 3; i++) { out.ambient[i] = B.ambient[i]; out.fog.color[i] = B.fog[i]; out.tri.ground[i] = B.ground[i]; out.sunColor[i] = 0; out.key.color[i] = 0; }
    out.sunScale = 0; out.key.scale = 0; out.fog.density = B.density; out.lamps = B.lamps;
    out.sunDir[0] = 0; out.sunDir[1] = 1; out.sunDir[2] = 0;
    Object.assign(out.grade, B.grade);
    Object.assign(out.classic, B.classic);
  } else {
    const W = ketchHourWeights(minute, _w), T = W.row === 'dawn' ? H.dawn : H.dusk, N = H.night, D = H.day;
    lerp3(lerp3(out.ambient, N.ambient, D.ambient, W.day), out.ambient, T.ambient, W.w);
    lerp3(lerp3(out.fog.color, N.fog, D.fog, W.day), out.fog.color, T.fog, W.w);
    out.fog.density = mix(mix(N.density, D.density, W.day), T.density, W.w);
    out.lamps = mix(mix(N.lamps, D.lamps, W.day), T.lamps, W.w);
    lerpGrade(lerpGrade(out.grade, N.grade, D.grade, W.day), out.grade, T.grade, W.w);
    for (const n of CLASSIC_KEYS) out.classic[n] = mix(mix(N.classic[n], D.classic[n], W.day), T.classic[n], W.w);
    // the sun: the day's colour by its elevation, toward the twilight row's; its share up with it over the horizon
    lerp3(out.sunColor, ketchSunColor(elev, _sun), T.sun, W.w);
    const up = smooth(elev / KT_SUN_LOW.rise), share = D.share * W.day;
    out.sunScale = mix(share, T.share * up, W.w) * up;
    // by night - the sun under the horizon, the twilight gone - the moons' key in its stead
    out.key.scale = (1 - up) * (1 - W.w);
    for (let i = 0; i < 3; i++) { out.key.color[i] = N.key[i]; out.tri.ground[i] = (out.sunColor[i] * out.sunScale + N.key[i] * out.key.scale) * KT_TRI.bounce; }
    if (zone === 'cabin') {
      for (let i = 0; i < 3; i++) out.ambient[i] *= H.cabin.ambientK;
      out.lamps = H.cabin.lamps;
      Object.assign(out.grade, H.cabin.grade);
      Object.assign(out.classic, H.cabin.classic);
    }
  }
  for (let i = 0; i < 3; i++) { out.tri.sky[i] = out.ambient[i]; out.tri.equator[i] = out.ambient[i] * KT_TRI.equator; }
  return out;
}
