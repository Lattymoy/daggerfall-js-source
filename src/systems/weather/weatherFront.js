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
//   THE ARRIVAL is WIND1's front (systems/wind/wind.js `arrival()`): 0 at the
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

import { seededRng } from '../wind/wind.js';
import { precipitationForWeather } from '../../world/weather.js';
import { precipLawOn, currentSnowShare, systemWordOf } from './weatherSim.js';   // PRECIP1: rain and snow one fall, its phase the air's; AUDIT PRECIP FALL-2: a weather is its system

/** Each mode's peak range, as a fraction of the profile's count: what
 *  a cut into that weather can roll. A rain can be a sprinkle; a storm
 *  never is; snow rarely buries the screen. */
export const PRECIP_PEAK = Object.freeze({ rain: [0.05, 1.0], storm: [0.6, 1.0], snow: [0.05, 0.85], sand: [0.5, 1.0] });   // WEATHER2d: a sandstorm is never thin
/** RAIN-SPRINKLE (FIELD BUGS 2026-10-01 #2, "Rain shouldnt always be a downpour, should sometimes sprinkle"): the roll
 *  is placed in the range by u^skew, so a rain is a sprinkle or a shower far more often than a downpour - on the map's
 *  lane the place's intensity is the roll, so a rain system's edge drizzles and only its heart pours. WX2's floors
 *  (rain 0.25, snow 0.2) under the map's own (WEATHER3i: the core's edge at a fifth) never drew under ~0.4 of the
 *  profile - ten thousand drops in the eye's 42 m box - and the fog and the sun took the whole row whatever fell. */
export const PRECIP_SKEW = Object.freeze({ rain: 2, snow: 1.5, storm: 1, sand: 1 });
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
export const SHOWN_FLOOR = 0.002;

export const lerp = (a, b, t) => a + (b - a) * t;

/** Hermite step, clamped: 0 at or below a, 1 at or above b.
 *  ONE HOME (GRASS2): the law lives in systems/mathf.js now, because the
 *  grass field's host needs the same curve and a weather module is no
 *  place for a render leaf to import arithmetic from. Re-exported here
 *  so this module's own callers are untouched - and IMPORTED, not only
 *  re-exported, because this module calls it itself three times and a
 *  bare `export ... from` never binds the name in the module's scope. */
import { smoothstep } from '../mathf.js';
export { smoothstep };

/** The LOOK a mode has: storm shares the rain's. null for no mode. */
export const precipKind = (mode) => (mode === 'snow' ? 'snow' : mode === 'sand' ? 'sand' : mode ? 'rain' : null);   // WEATHER2d: the sand is its own look
/** PRECIP1: the FALL a mode belongs to, for the taper - under the air's law rain, a storm and snow are one fall whose
 *  phase is the air's (the drops and flakes drawn at its snow share, render/precipitation.js draw), so a phase change
 *  walks the peak across with no gap, as a shower thickening into a storm does; off it, the look (precipKind). */
const fallOf = (mode) => (mode && mode !== 'sand' && precipLawOn() ? 'wet' : precipKind(mode));

/** A roll `u` in 0..1 placed in the mode's peak range, by its skew (RAIN-SPRINKLE). */
export function rollPeak(mode, u) {
  const r = PRECIP_PEAK[mode];
  if (!r) return 0;
  const v = Math.min(1, Math.max(0, u)) ** (PRECIP_SKEW[mode] ?? 1);
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

/** RAIN-SPRINKLE: the intensity band a fall's LOOK crosses - at its foot a rain or a snow looks as an overcast sky
 *  does (the host's `light`), past its top as the weather's own row has it. */
export const FALL_LOOK = Object.freeze([0.05, 0.6]);
/** ...and a sprinkle's fog: this share of its row's exp density. */
export const FALL_FOG_FLOOR = 0.25;
/**
 * RAIN-SPRINKLE: the world's terms under what is FALLING, not under the word. A rain or a snow row is the downpour's
 * look - exp fog (0.003, snow 0.005), the sun at 0.45, the grass dimmed to 0.6 - and every rain wore it whole, a
 * sprinkle too. Under the band the fog thins to FALL_FOG_FLOOR of its density and the sun and the grass come up to
 * `light`'s (never darker than the row). Any other word - a fog bank, a sandstorm, a clear sky with the last of a
 * shower draining - is handed back as it came. The host blends the answer on the front (blendTerms) as before.
 * @param {{sun: number, dim?: number, fog: any}} terms - the weather's row
 * @param {number} intensity - the front's, the share of the profile on screen
 * @param {string} weather - the sim's word
 * @param {{sun: number, dim: number}} light - an overcast sky's sun and grass
 */
export function fallTerms(terms, intensity, weather, light) {
  const mode = precipitationForWeather(weather);
  if (mode !== 'rain' && mode !== 'storm' && mode !== 'snow') return terms;
  const k = smoothstep(FALL_LOOK[0], FALL_LOOK[1], intensity);
  if (k >= 1) return terms;
  const dim = terms.dim ?? 1;
  return {
    sun: Math.max(terms.sun, lerp(light.sun, terms.sun, k)),
    dim: Math.max(dim, lerp(light.dim, dim, k)),
    fog: terms.fog?.mode === 'exp' ? { ...terms.fog, density: terms.fog.density * lerp(FALL_FOG_FLOOR, 1, k) } : terms.fog,
  };
}

/** AUDIT PRECIP FALL-2/3: THE WORLD'S TERMS UNDER A FALL OF TWO PHASES, on the law's lane: the sun and the grass's light
 *  are the DECK's - the system's own row (`rowOf(word)` the host's row for a word: a storm falling as snow is lit as the
 *  storm it is) - and the fog is the FALL's, its rain side's (a storm's, a rain's; a snow system falling as rain the
 *  rain's) walked toward the snow's by the fall's snow `share`. So nothing steps where the phase turns. `own` (the
 *  word's own row) off the lane, for a dry word, or with no share. */
export function phaseTerms(own, word, rowOf, share) {
  if (share == null || !precipLawOn()) return own;
  const sys = systemWordOf(word);
  if (!isWetWord(word) || !isWetWord(sys)) return own;
  const deck = rowOf(sys), wetSide = rowOf(sys === 'snow' ? 'rain' : sys), snowRow = rowOf('snow');
  return { sun: deck.sun, dim: deck.dim, fog: blendFog(wetSide.fog, snowRow.fog, Math.min(1, Math.max(0, share))) };
}
const isWetWord = (w) => w === 'rain' || w === 'thunder' || w === 'snow';

/** The weather the AMBIENCE should hear: what is falling, not the sim's
 *  word. A rain word with nothing down yet is a cloudy day to the ear;
 *  the outgoing rain keeps its loop while it tapers. PRECIP1 (AUDIT PRECIP
 *  FALL-4): on the law's lane the ear hears the DROPS - the rain (a storm's
 *  under a storm) whenever any are drawn (`sample.rain`), at their own level
 *  (the hosts read it), whatever the word rounds to; a fall of flakes alone
 *  is the word's own. */
export function soundWeather(sample, weather) {
  if (sample.rain != null) {
    if (sample.rain >= SHOWN_FLOOR && sample.shown !== 'sand') return sample.shown === 'storm' ? 'thunder' : 'rain';
    if (sample.shown === 'sand') return 'cloudy';
    return weather === 'rain' || weather === 'thunder' || weather === 'sandstorm' ? 'cloudy' : weather;
  }
  if (sample.shown === 'storm') return 'thunder';
  if (sample.shown === 'rain') return 'rain';
  if (sample.shown === 'sand') return 'cloudy';   // WEATHER2d: DFU's ambience has no sand; the wind loop (WIND3) is the storm's voice
  return weather === 'rain' || weather === 'thunder' || weather === 'sandstorm' ? 'cloudy' : weather;
}

/**
 * The front. `tick({ dt, weather, arrival, nowMinutes, tsec, jump, peak })`
 * once a frame: `dt` real seconds, `weather` the sim's current word,
 * `arrival` the wind model's 0..1 (1 under the classic sky, which has no
 * front), `nowMinutes` the classic clock (the episode's seed), `tsec`
 * real seconds (the wander's clock), `peak` the world weather map's
 * intensity at the player (0..1, placed in the mode's range) or null
 * where there is no map (the episode rolls its own). Returns the sample, which `sample()`
 * repeats:
 *   { changed, from, to, t, shown, kind, intensity, peak, snow }
 * `changed` is true on the tick that saw a cut; `t` is the arrival,
 * clamped; `shown` is the mode being drawn (null for none); `intensity`
 * is the fraction of the profile's drops on screen; `peak` is the
 * incoming episode's.
 */
export function createWeatherFront({ seed = 7 } = {}) {
  let last = null;        // the weather (its system, on the law's lane) at the last tick
  let from = null;        // the word the terms blend FROM
  let to = null;          // ...and TO
  let episode = null;     // { mode, peak, phase } for `to`, or null
  let outgoing = null;    // the episode tapering out, or null - on the law's lane with the snow share it fell at (`snow`)
  let intensity = 0;
  let shown = null;
  let drawnSnow = 0;      // the share the fall was last drawn at
  let out = null;

  return {
    tick({ dt = 0, weather = 'sunny', arrival = 1, nowMinutes = 0, tsec = 0, jump = false, peak = null } = {}) {
      const first = last === null;
      const law = precipLawOn();
      // AUDIT PRECIP FALL-2/3: a weather is its SYSTEM on the law's lane - the sim's word rounds the fall's phase, and a
      // phase turning under the same storm is no cut: no new episode, no peak placed in another word's range
      const id = systemWordOf(weather);
      // WX2a (AUDIT 57): a JUMP is a change the player was not present for
      // - a load, a travel landing, a respawn roll, a day rolled while
      // underground. It is taken as a first word is: nothing crosses,
      // nothing tapers, the drops land whole. The arrival is 1 by
      // contract (the wind builds no front for it), whatever the model's
      // last frame still says.
      const whole = first || (jump && id !== last);
      let changed = false;
      if (id !== last) {
        changed = !whole;
        from = whole ? weather : (to ?? last);
        to = weather;
        last = id;
        outgoing = whole ? null : episode && { ...episode, snow: drawnSnow };   // AUDIT PRECIP FALL-1: the outgoing fall keeps the share it fell at
        const mode = precipitationForWeather(id);
        if (mode) {
          // THE EPISODE'S ROLL: seeded on the cut's minute, as WIND1
          // seeds the front's strength, so a replayed day rains alike.
          const r = seededRng(seed * 104729 + Math.floor(nowMinutes));
          episode = { mode, peak: rollPeak(mode, r()), phase: r() * Math.PI * 2 };
        } else {
          episode = null;
        }
      } else {
        to = weather;   // the word itself may turn (its phase) under the same weather
      }
      // WEATHER3b: on the world weather map's lane the PLACE sets the peak - the system's envelope, falling from its
      // heart out (weatherSim currentWeatherIntensity) - and it moves as the player or the storm does: walking in from
      // the edge thickens a drizzle into the downpour; the seeded roll above is only the lanes without a map
      if (episode && peak != null) episode.peak = rollPeak(episode.mode, peak);
      const a = whole && jump ? 1 : Math.min(1, Math.max(0, arrival));
      const inMode = episode?.mode ?? null;
      const outMode = outgoing?.mode ?? null;
      const live = law ? currentSnowShare() : 0;   // the incoming fall's share: the air's at the player, now
      let mode = null;
      let target = 0;
      let snow = live;
      if (inMode && outMode && fallOf(inMode) === fallOf(outMode)) {
        // one look, the peak walks across - a shower thickening into a storm
        mode = a >= 0.5 ? inMode : outMode;
        const k = smoothstep(PRECIP_IN[0], PRECIP_IN[1], a);
        target = lerp(outgoing.peak, episode.peak, k) * wander(tsec, episode.phase);
        snow = lerp(outgoing.snow, live, k);   // ...and its phase walks with it, from the share the old fall fell at
      } else if (outMode && a < PRECIP_OUT[1]) {
        // the old kind thins out first
        mode = outMode;
        target = outgoing.peak * wander(tsec, outgoing.phase) * (1 - smoothstep(PRECIP_OUT[0], PRECIP_OUT[1], a));
        snow = outgoing.snow;
      } else if (inMode) {
        // the new kind fills in when the deck is mostly in
        mode = inMode;
        target = episode.peak * wander(tsec, episode.phase) * smoothstep(PRECIP_IN[0], PRECIP_IN[1], a);
      } else if (outMode) {
        mode = outMode;   // nothing incoming: the last of it drains
        snow = outgoing.snow;   // AUDIT PRECIP FALL-1: at the share it fell at - the last flakes are never a few drops
      }
      // a change of kind mid-fall never relabels the residual - the last
      // few flakes are not a few drops
      if (shown && mode && fallOf(shown) !== fallOf(mode)) intensity = 0;
      if (whole) intensity = target;   // a boot into rain is rain (the sky's own first-call law); so is a load into it
      else intensity += (target - intensity) * (1 - Math.exp(-Math.max(0, dt) / PRECIP_SMOOTH_SECONDS));
      if (intensity < SHOWN_FLOOR && target === 0) intensity = 0;
      shown = intensity >= SHOWN_FLOOR ? mode : null;
      drawnSnow = snow;
      // PRECIP1: `snow` the fall's snow share on the law's lane (null off it - the mode is its own look); AUDIT PRECIP
      // AIR-5/FALL-4: `rain` and `flakes` the levels of its two looks - the drops' the ear, the soak and the water's
      // rings read, the flakes' beside them
      const wet = law && shown !== 'sand' && !!shown;
      out = {
        changed, from, to, t: a, shown, kind: precipKind(shown), intensity, peak: episode?.peak ?? 0,
        snow: law ? snow : null, rain: law ? (wet ? intensity * (1 - snow) : 0) : null, flakes: law ? (wet ? intensity * snow : 0) : null,
      };
      return out;
    },
    /** The last tick's answer. */
    sample() { return out; },
    /** For the record and the tests. */
    state() { return { last, from, to, episode: episode && { ...episode }, outgoing: outgoing && { ...outgoing }, intensity, shown }; },
  };
}
