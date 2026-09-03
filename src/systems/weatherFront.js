// WX2 - THE FRONT REACHES THE GROUND.
//
// Mac: "Instead of rain/snow starting and stopping immediately, I want
// it to fade in and out slowly, how the grass prototype handles it. For
// example snow and rain shouldn't always be a downpour. It can sprinkle,
// or lightly snow, etc."
//
// Before this slice the sim flipped its word between two ticks -
// Daggerfall's own once-a-day cut, WeatherManager's law, untouched here -
// and the enhanced SKY eased toward the new row over WIND1's three-hour
// lead, while everything UNDER the sky snapped on the frame of the cut:
// the whole 26,000 drops, the sun scale (x0.45), the fog row, the grass
// dim and the rain loop, a quarter of an hour before the deck had
// darkened. The prototype never did that. Its front eases the world's
// terms with the sky (`fog: lerp(wxF.fog, wxT.fog, ft), dim: ...`) and
// holds the particles off "until the front is mostly in - the rain
// starts when the sky already looks like rain, not with it", scaling the
// DRAWN COUNT by the front (`Math.round(wx.n * wsky.fall)`,
// grass-proto.html's frame()). This module is that law on the game's own
// front rather than the lab's slider:
//
//   THE ARRIVAL is WIND1's front (systems/wind.js `arrival()`): 0 at the
//   sim's cut, rising over the lead to 1 when the front arrives, and 1
//   from then on - unlike frontProgress, which falls again as the WIND
//   rolls away while the weather stays. The sky's ease is stretched onto
//   the same lead (WIND2), so the terms here and the deck overhead cross
//   together, by construction.
//
//   THE TERMS - the sun scale, the fog row, the grass dim - blend from
//   what was ON SCREEN at the cut toward the incoming weather's, on the
//   arrival. From what was on screen, not from the outgoing row: a second
//   cut inside a front (a climate crossing) starts from the half-crossed
//   value and never snaps. A fog row that changes MODE (the linear haze
//   to an exponential rain) cannot be blended without a shader of its
//   own, so it switches at the front's midpoint - under a deck that is
//   already half turned, where the cut used to put it under a clear one.
//
//   THE DROPS fill in over the arrival's last stretch (PRECIP_IN) and,
//   when the incoming weather has none, thin out over its first
//   (PRECIP_OUT) - so the rain tapers under a sky that is still opening,
//   and a sunny word does not stop it dead. A change of KIND (rain to
//   snow) tapers the old kind out before the new fills in; a change
//   within a kind (rain to storm) walks the peak across with no gap. A
//   real-seconds smoothing rides on top so a jump in the front's clock
//   (a load, a fast travel) never steps the count in one frame.
//
//   THE EPISODE: each precipitating weather the sim rolls draws a PEAK
//   from its range - a sprinkle at a quarter of the profile, a downpour
//   at all of it; storms bias heavy, snow light - seeded on the cut's
//   minute so a replayed day rains the same, and the intensity WANDERS
//   under the peak on two slow periods so a shower is never one number
//   for an hour.
//
// ENHANCED ONLY, and a deliberate DEPARTURE (Port-Ledger, WX2): DFU's
// WeatherManager toggles its particle systems on the frame it sets the
// weather and carries no intensity at all. The classic path keeps that -
// the sim's mode, the whole profile, the row's own terms - and never
// reads this module. Pure and injectable: the front's clock, the sim's
// word and the seconds come in; what is on screen comes out.

import { seededRng } from './wind.js';
import { precipitationForWeather } from '../world/weather.js';

/** Each mode's peak range, as a fraction of the profile's count: what
 *  a cut into that weather can roll. A rain can be a sprinkle; a storm
 *  never is; snow rarely buries the screen. */
export const PRECIP_PEAK = Object.freeze({ rain: [0.25, 1.0], storm: [0.6, 1.0], snow: [0.2, 0.85] });
/** The arrival window the drops fill in over: nothing falls until the
 *  front is past half in, and it is all down just before the front lands. */
export const PRECIP_IN = Object.freeze([0.55, 0.95]);
/** ...and thin out over, when the incoming weather has none: the last
 *  drops are gone before the sky is more than half open. */
export const PRECIP_OUT = Object.freeze([0.15, 0.60]);
/** Real seconds: the smoothing on top of the front's clock. */
export const PRECIP_SMOOTH_SECONDS = 12;
/** The wander never takes the intensity below this share of the peak. */
export const WANDER_FLOOR = 0.6;
const WANDER_SLOW = (2 * Math.PI) / 240;
const WANDER_FAST = (2 * Math.PI) / 73;
/** Below this the drops are not drawn and the mode reads as nothing. */
const SHOWN_FLOOR = 0.002;

export const lerp = (a, b, t) => a + (b - a) * t;

/** Hermite step, clamped: 0 at or below a, 1 at or above b. */
export function smoothstep(a, b, x) {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** The LOOK a mode has: storm shares the rain's. null for no mode. */
export const precipKind = (mode) => (mode === 'snow' ? 'snow' : mode ? 'rain' : null);

/** A roll `u` in 0..1 placed in the mode's peak range. */
export function rollPeak(mode, u) {
  const r = PRECIP_PEAK[mode];
  if (!r) return 0;
  const v = Math.min(1, Math.max(0, u));
  return r[0] * (1 - v) + r[1] * v;   // the two-term form lands the ends exactly
}

/** The intensity's wander under its peak, 0.6..1.0: two slow periods
 *  (four minutes and a little over one) so a shower breathes. */
export function wander(tsec, phase = 0) {
  return 0.80 + 0.12 * Math.sin(tsec * WANDER_SLOW + phase) + 0.08 * Math.sin(tsec * WANDER_FAST + 2.1 * phase);
}

/** A fog row on the front: the same mode lerps its numbers, a change of
 *  mode switches at the midpoint. `to` itself at 1 (so a settled front
 *  hands the hosts the table's own frozen row, as before), `from` at 0. */
export function blendFog(from, to, t) {
  if (!from || t >= 1) return to;
  if (t <= 0) return from;
  if (from.mode !== to.mode) return t < 0.5 ? from : to;
  return {
    mode: to.mode,
    density: lerp(from.density, to.density, t),
    start: lerp(from.start, to.start, t),
    end: lerp(from.end, to.end, t),
    excludeSky: t < 0.5 ? from.excludeSky : to.excludeSky,
  };
}

/** The world's terms on the front: `{ sun, dim, fog }`. `to` itself at 1. */
export function blendTerms(from, to, t) {
  if (!from || t >= 1) return to;
  if (t <= 0) return from;
  return {
    sun: lerp(from.sun, to.sun, t),
    dim: lerp(from.dim ?? 1, to.dim ?? 1, t),
    fog: blendFog(from.fog, to.fog, t),
  };
}

/** The weather the AMBIENCE should hear: what is falling, not the sim's
 *  word. A rain word with nothing down yet is a cloudy day to the ear;
 *  the outgoing rain keeps its loop while it tapers. */
export function soundWeather(sample, weather) {
  if (sample.shown === 'storm') return 'thunder';
  if (sample.shown === 'rain') return 'rain';
  return weather === 'rain' || weather === 'thunder' ? 'cloudy' : weather;
}

/**
 * The front. `tick({ dt, weather, arrival, nowMinutes, tsec })` once a
 * frame: `dt` real seconds, `weather` the sim's current word, `arrival`
 * the wind model's 0..1 (1 under the classic sky, which has no front),
 * `nowMinutes` the classic clock (the episode's seed), `tsec` real
 * seconds (the wander's clock). Returns the sample, which `sample()`
 * repeats:
 *   { changed, from, to, t, shown, kind, intensity, peak }
 * `changed` is true on the tick that saw a cut; `t` is the arrival,
 * clamped; `shown` is the mode being drawn (null for none); `intensity`
 * is the fraction of the profile's drops on screen; `peak` is the
 * incoming episode's.
 */
export function createWeatherFront({ seed = 7 } = {}) {
  let last = null;        // the sim's word at the last tick
  let from = null;        // the word the terms blend FROM
  let to = null;          // ...and TO
  let episode = null;     // { mode, peak, phase } for `to`, or null
  let outgoing = null;    // the episode tapering out, or null
  let intensity = 0;
  let shown = null;
  let out = null;

  return {
    tick({ dt = 0, weather = 'sunny', arrival = 1, nowMinutes = 0, tsec = 0 } = {}) {
      const first = last === null;
      let changed = false;
      if (weather !== last) {
        changed = !first;
        from = first ? weather : last;
        to = weather;
        last = weather;
        outgoing = first ? null : episode;
        const mode = precipitationForWeather(weather);
        if (mode) {
          // THE EPISODE'S ROLL: seeded on the cut's minute, as WIND1
          // seeds the front's strength, so a replayed day rains alike.
          const r = seededRng(seed * 104729 + Math.floor(nowMinutes));
          episode = { mode, peak: rollPeak(mode, r()), phase: r() * Math.PI * 2 };
        } else {
          episode = null;
        }
      }
      const a = Math.min(1, Math.max(0, arrival));
      const inMode = episode?.mode ?? null;
      const outMode = outgoing?.mode ?? null;
      let mode = null;
      let target = 0;
      if (inMode && outMode && precipKind(inMode) === precipKind(outMode)) {
        // one look, the peak walks across - a shower thickening into a storm
        mode = a >= 0.5 ? inMode : outMode;
        target = lerp(outgoing.peak, episode.peak, smoothstep(PRECIP_IN[0], PRECIP_IN[1], a)) * wander(tsec, episode.phase);
      } else if (outMode && a < PRECIP_OUT[1]) {
        // the old kind thins out first
        mode = outMode;
        target = outgoing.peak * wander(tsec, outgoing.phase) * (1 - smoothstep(PRECIP_OUT[0], PRECIP_OUT[1], a));
      } else if (inMode) {
        // the new kind fills in when the deck is mostly in
        mode = inMode;
        target = episode.peak * wander(tsec, episode.phase) * smoothstep(PRECIP_IN[0], PRECIP_IN[1], a);
      } else if (outMode) {
        mode = outMode;   // nothing incoming: the last of it drains
      }
      // a change of kind mid-fall never relabels the residual - the last
      // few flakes are not a few drops
      if (shown && mode && precipKind(shown) !== precipKind(mode)) intensity = 0;
      if (first) intensity = target;   // a boot into rain is rain (the sky's own first-call law)
      else intensity += (target - intensity) * (1 - Math.exp(-Math.max(0, dt) / PRECIP_SMOOTH_SECONDS));
      if (intensity < SHOWN_FLOOR && target === 0) intensity = 0;
      shown = intensity >= SHOWN_FLOOR ? mode : null;
      out = { changed, from, to, t: a, shown, kind: precipKind(shown), intensity, peak: episode?.peak ?? 0 };
      return out;
    },
    /** The last tick's answer. */
    sample() { return out; },
    /** For the record and the tests. */
    state() { return { last, from, to, episode: episode && { ...episode }, outgoing: outgoing && { ...outgoing }, intensity, shown }; },
  };
}
