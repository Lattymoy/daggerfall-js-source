// WIND3 (2026-09-14, Mac: "wind audio without being too loud or
// overbearing") - THE WIND, HEARD.
//
// Daggerfall's exterior ambience has no wind: WeatherManager.
// SetAmbientEffects picks rain, storm, a sunny day or a clear night
// (systems/ambientEffects.js presetForExterior), and the wind clips in
// DAGGER.SND - AmbientWindMoan, AmbientWindMoanDeep, AmbientWindBlow1
// /1a/1b - are drawn only as DUNGEON one-shots (AMBIENT_SOUNDS.dungeon).
// The port's wind is its own thing (WIND1) and this gives it a voice:
// ONE loop whose gain follows the wind's STRENGTH and breathes with its
// GUSTS, and whose pitch rises a little as the wind gets up. The ceiling
// is WIND_GAIN_MAX, a murmur under the rain loop and the birds - Mac's
// "not too loud" is a number here, pinned - and the gain is slew-limited
// so a front's rise is a rise and a gust never pops.
//
// FIELD-WIND1 (2026-09-29, the Discord through Mac: "A repetitive moaning
// sound in the open world"): THE VOICE IS A BED, NOT A CLIP. WIND3 gave
// the loop those DAGGER.SND clips on the riding loop's shape (audio.
// setLoop: a clip played from its start again each time it ends) - the
// moan under 0.62 of the strength, the blow above. They are DFU's
// dungeon ONE-SHOTS, one every 5 to 28 seconds: short, shaped and
// pitched. AmbientWindMoan is 1.96 s that swells from nothing and falls
// back, a pitch in every fifth of a second of it, wandering from 100 to
// 613 Hz (autocorrelation 0.53 to 0.78 - a voice); AmbientWindBlow1 is a
// 5 s whistle, most of it at 550 to 613 Hz.
// Played end to end, the moan came back every 1.97 s under every breeze
// (measured live at Daggerfall: 45 starts in two minutes) - the moaning
// the players heard. WIND3 was written with no ARENA2 to hear it. There
// is no continuous wind in Daggerfall's data to loop, so the port makes
// one: white noise shaped into a soft whoosh (a band-pass under a
// low-pass), PERIODIC so the engine's native loop (audio.loop, the rain's
// door) has no seam, and levelled to the moan clip's own RMS so the gain
// law and its ceiling mean what they meant. The gusts are the gain's -
// nothing in the bed swells or repeats.
//
// It is NOT AmbientEffects: that module is DFU's AmbientEffectsPlayer
// bug for bug (its indoor carry-over included, AUDIT 26) and stays so.
// The hosts tick this beside it on the exterior frame and STOP it on
// every modal frame (inside a building or a dungeon), as they stop the
// mills' hum - the port's own sounds fall silent indoors. ENHANCED ONLY,
// behind its own row (`wind-sound` on the Features home, the pref
// `windSound`, the player's own online - ES1 folded it into the
// `enhanced-sounds` row, pref `soundEnhancements`); `?windaudio=off` the kill door.

import { audio as defaultAudio } from '../audio.js';
import { enhancedSoundsOn } from '../enhancedSounds.js';   // ES1: the wind rides the one Enhanced sounds switch
import { pageParam } from '../pageQuery.js';   // PERF-URL: the page's query, parsed once a search

/** The loudest the wind ever is, as a loop gain (the rain loop plays at
 *  1, the birds at their clips' own level). */
export const WIND_GAIN_MAX = 0.18;
/** How fast the gain may move, per second: a full rise over ~3 s. */
export const WIND_SLEW_PER_S = 0.06;
/** Below this the loop is stopped rather than left whispering. */
export const WIND_GAIN_FLOOR = 0.004;

/** FIELD-WIND1: the bed's key on the engine (audio.registerSamples), its
 *  rate, its length and its level. 22050 Hz holds everything a whoosh has
 *  (the low-pass stands at 1.8 kHz); eight seconds of noise repeat
 *  nowhere an ear can find; the RMS is AmbientWindMoan's own (DAGGER.SND
 *  record 65, 0.0349) - the level the loop played under every breeze, so
 *  the gain law means what it meant. */
export const WIND_BED_KEY = 'wind:bed';
export const WIND_BED_RATE = 22050;
export const WIND_BED_SECONDS = 8;
export const WIND_BED_RMS = 0.0349;
/** The whoosh: a band-pass about its centre, and a low-pass above it so no
 *  hiss is left. */
export const WIND_BED_SHAPE = Object.freeze({ centreHz: 500, q: 0.6, lowpassHz: 1800 });
/** The noise's seed: the same bed every boot. */
export const WIND_BED_SEED = 0x57494e44;

const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

/** The gain a wind of `strength01` with gust `gust` asks for: nothing in
 *  a calm, the ceiling in a gale, the gust worth a fifth on top. Never
 *  above WIND_GAIN_MAX. Pure. */
export function windGain(strength01, gust = 1) {
  const g = Math.max(0, Math.min(1, gust));
  return Math.min(WIND_GAIN_MAX, WIND_GAIN_MAX * smooth(0.12, 0.85, strength01) * (0.80 + 0.20 * g));
}

/** The pitch: a touch lower in a breeze, a touch higher in a gale. */
export function windPitchFor(strength01) {
  return 0.92 + 0.16 * Math.max(0, Math.min(1, strength01));
}

/** A second-order section's coefficients (the audio EQ cookbook's band-pass at 0 dB peak, or low-pass), a0 divided
 *  out: [b0, b1, b2, a1, a2]. */
function section(type, f0, q, fs) {
  const w0 = (2 * Math.PI * f0) / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
  const b = type === 'bandpass' ? [alpha, 0, -alpha] : [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  return [b[0] / a0, b[1] / a0, b[2] / a0, (-2 * cos) / a0, (1 - alpha) / a0];
}

/** mulberry32: a small seeded generator, [0, 1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FIELD-WIND1: THE BED - `seconds` of wind at `sampleRate`, mono floats. White noise from the seed, through the
 * band-pass and then the low-pass, levelled to WIND_BED_RMS. The noise runs through the two sections TWICE and the
 * second pass is kept: the first leaves every section's state where the period itself leaves it, so the last sample
 * runs into the first as any sample into the next (a filter's steady answer to a periodic input is periodic) and the
 * native loop has no seam.
 */
export function windBedSamples({ sampleRate = WIND_BED_RATE, seconds = WIND_BED_SECONDS, seed = WIND_BED_SEED, rms = WIND_BED_RMS } = {}) {
  const n = Math.max(1, Math.round(sampleRate * seconds));
  const next = mulberry32(seed);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = next() * 2 - 1;
  const { centreHz, q, lowpassHz } = WIND_BED_SHAPE;
  const [p0, p1, p2, p3, p4] = section('bandpass', centreHz, q, sampleRate);
  const [l0, l1, l2, l3, l4] = section('lowpass', lowpassHz, Math.SQRT1_2, sampleRate);
  // direct form I: each section's last two inputs and outputs, carried from sample to sample and from the first pass
  // into the second (the low-pass's inputs are the band-pass's outputs, so their history is one)
  let x1 = 0, x2 = 0, b1 = 0, b2 = 0, y1 = 0, y2 = 0;
  const y = new Float64Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const v = x[i];
      const b = p0 * v + p1 * x1 + p2 * x2 - p3 * b1 - p4 * b2;
      const l = l0 * b + l1 * b1 + l2 * b2 - l3 * y1 - l4 * y2;
      x2 = x1; x1 = v; b2 = b1; b1 = b; y2 = y1; y1 = l;
      y[i] = l;
    }
  }
  let acc = 0;
  for (let i = 0; i < n; i++) acc += y[i] * y[i];
  const k = acc > 0 ? rms / Math.sqrt(acc / n) : 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = y[i] * k;
  return out;
}

let _bed = null;
/** The default bed, made once a page (the two exterior hosts share the engine and its buffer). */
const theBed = () => (_bed ??= windBedSamples());

/** The loop's switch: the enhanced skin and the `soundEnhancements` pref
 *  (ES1: one Enhanced sounds row over the port's own sounds - the wind
 *  loop's own `windSound` row folded into it), and `?windaudio=off` the
 *  kill door. */
export function windSoundOn(search = globalThis.location?.search ?? '') {
  return enhancedSoundsOn() && pageParam('windaudio', search) !== 'off';   // PERF-URL
}

/** The loop's driver: `update(wd, dt, on)` once a frame with
 *  windDrive's answer; `stop()` on a modal frame. The bed is registered on
 *  the engine when the loop is wanted and played through its native loop,
 *  ONE source for the whole blow, its gain and pitch set live; an engine
 *  not running yet answers no loop, and the next frame asks again. */
export function createWindAudio(engine = defaultAudio) {
  let gain = 0;
  let loop = null;   // the bed's loop on the engine (audio.loop's handle), or null
  const release = () => { if (loop) { loop.stop(); loop = null; } };
  return {
    /** the current gain, for the record and the tests */
    get gain() { return gain; },
    get playing() { return loop != null; },
    update(wd, dt, on = true) {
      const target = on && wd?.on ? windGain(wd.strength01, wd.gust) : 0;
      const slew = WIND_SLEW_PER_S * Math.max(0, Number(dt) || 0);
      gain += Math.max(-slew, Math.min(slew, target - gain));
      if (gain < WIND_GAIN_FLOOR && target < WIND_GAIN_FLOOR) {
        gain = 0;
        release();
        return;
      }
      if (!loop) {
        if (!engine.registerSamples?.(WIND_BED_KEY, theBed(), WIND_BED_RATE)) return;   // no context yet
        loop = engine.loop(WIND_BED_KEY, gain) ?? null;
        if (!loop) return;
      } else loop.setVolume(gain);
      loop.setPitch?.(windPitchFor(wd?.strength01 ?? 0));
    },
    stop() {
      gain = 0;
      release();
    },
  };
}
