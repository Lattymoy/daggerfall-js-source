// @ts-check
// SEA-AIR (2026-10-24, the owner: "different music and ambience sounds for sailing"): WHAT A DECK SOUNDS LIKE AT SEA.
// Design: bible/08-Audio/Audio.md SOUNDSCAPE.
//
// Come Sail Away plays its own two hull loops while a boat is placed (systems/comeSailAway/comeSailAway.js
// UpdateAudioSource - SmallShipAmbience at rest, ShipExteriorAmbience2 under way) and the oars' strokes; the sea fight
// its guns. Nothing answered the sea itself: a flat calm and a gale sounded the same, and a gull never came near a
// coast. This is the sea's air, over the mod's loops and never instead of them, while I stand on a deck in the open:
//
//   THE BEDS (named beds on the engine, made by systems/soundscape/soundBeds.js): the SWELL, the open sea's body, its
//     level the SEA STATE's (the wind and the weather - `seaState`) and its gain rising and falling on the swell's own
//     clock (`seaSwellAt`: three long waves summed, 5 to 13 s, so no two swells are alike); the WASH, the water running
//     past her hull, rising with her way and riding the swell a beat behind; the RIGGING, the wind moaning in the
//     lines, only in a strong wind or a storm, breathing with its gusts.
//   THE EVENTS (one-shots of the port's own, systems/soundscape/soundscapeSfx.js): a wave SLAPPING the hull as a swell
//     crests, port or starboard, a second behind it in a heavy sea; the TIMBERS working and the ROPES creaking in
//     their blocks, more often as the sea gets up (the ropes only with sail set); the canvas LUFFING when she lies
//     head to wind or her sails are set and she carries no way; SPRAY over the bow when she drives into a crest at
//     speed; GULLS by day in fair weather while land is near; and the WATCH BELLS each half hour of the world's
//     clock, struck in pairs - one bell at the half hour after a watch begins, eight at its end (`watchBells`) - on
//     Daggerfall's own bell (DAGGER.SND 107).
//
// Every event aboard is played `far` (systems/audio.js play3d): its offset from the ear held while it sounds, so it rides
// with the deck as she moves. The laws are pure (the clock, the sea and the dice in, levels and events out); the driver
// keeps the clocks and plays them. Behind Enhanced Sounds (ES1) on the enhanced skin; the classic skin hears exactly
// what DFU and the mod play. Not a DFU member - Ledger A (SOUNDSCAPE).
import { audio as defaultAudio } from '../audio.js';
import { ensureBed } from './soundJobs.js';   // AUDIT SOUNDSCAPE W4: made off the main thread
import { SCAPE_SFX } from './soundscapeSfx.js';

/** The beds' names on the engine, their bed (soundBeds.js key) and their laws' numbers. */
export const SEA_BEDS = Object.freeze({
  /** the swell: from `min` in a flat calm to `max` in a full gale, `depth` of it riding the swell's rise and fall.
   *  AUDIT SOUNDSCAPE S6: the first cut's levels (a third of these) sat 16 to 24 dB under Come Sail Away's own hull loops
   *  on the same bus, under 500 Hz where both live - the swell was not heard. A moderate sea now reads about -38 dBFS at
   *  the ear and a gale about -34, beside DFU's rain loop's -40 and still well under the mod's loops (-24 at the helm). */
  swell: Object.freeze({ name: 'sea:swell', bed: 'sea:swell', min: 0.15, max: 0.78, depth: 0.55 }),
  /** the wash past her hull: nothing below `from` m/s of way, all of `max` by `full` */
  wash: Object.freeze({ name: 'sea:wash', bed: 'sea:wash', max: 0.6, from: 0.4, full: 7 }),
  /** the wind in the rigging: nothing below a `from` wind, all of `max` in a full gale */
  rigging: Object.freeze({ name: 'sea:rigging', bed: 'sea:rigging', max: 0.42, from: 0.5 }),
});

/** The name the deck's far shots are played under (audio.js fadeFar lets them go with it). */
export const SEA_FAR = 'seaAir';

/** The swell's three long waves: [period s, share, phase] - their sum's shares are 1. */
export const SWELL_WAVES = Object.freeze([Object.freeze([8.3, 0.55, 0]), Object.freeze([12.7, 0.3, 1.3]), Object.freeze([5.1, 0.15, 0.4])]);
/** A swell CRESTS as `seaSwellAt` rises through this - a slap's moment. */
export const SWELL_CREST = 0.72;

/** What the weather adds to the sea a wind makes: a rain's squalls and a storm's seas. */
export const SEA_WEATHER = Object.freeze({ rain: 0.12, thunder: 0.35, snow: 0.06 });
/** A flat calm still swells: the sea state's floor. */
export const SEA_STATE_FLOOR = 0.15;

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };

/** THE SEA STATE, 0..1: the floor, the wind's (0..1, windDrive strength01) seven tenths, and the weather's own. Pure. */
export function seaState(wind, weather) {
  return clamp01(SEA_STATE_FLOOR + 0.7 * clamp01(wind) + (SEA_WEATHER[/** @type {keyof typeof SEA_WEATHER} */ (weather)] ?? 0));
}

/** The swell at `t` seconds, 0..1: the three waves summed. Pure. */
export function seaSwellAt(t) {
  let v = 0;
  for (const [period, share, phase] of SWELL_WAVES) {
    const omega = (2 * Math.PI) / period;   // the wave's radians a second (ONCRASH1's sweep: no sum stepped by a whole turn)
    v += share * Math.sin(omega * t + phase);
  }
  return clamp01(0.5 + 0.5 * v);
}

/** The swell bed's gain and pitch for a sea of `state` at `t`. Pure. */
export function swellBed(state, t) {
  const { min, max, depth } = SEA_BEDS.swell;
  const s = seaSwellAt(t);
  return { volume: (min + (max - min) * clamp01(state)) * (1 - depth + depth * s), pitch: 0.9 + 0.1 * clamp01(state) + 0.06 * (s - 0.5) };
}

/** The wash bed's gain and pitch for `way` m/s through a sea of `state` at `t` - the swell a beat behind. Pure. */
export function washBed(way, state, t) {
  const { max, from, full } = SEA_BEDS.wash;
  const w = smooth(from, full, way);
  return { volume: max * w * (0.75 + 0.25 * seaSwellAt(t - 1.7)) * (0.8 + 0.2 * clamp01(state)), pitch: 0.85 + 0.3 * clamp01(way / full) };
}

/** The rigging bed's gain and pitch for a `wind` (0..1) gusting `gust` (0..1) in `weather`. Pure. */
export function riggingBed(wind, gust, weather) {
  const { max, from } = SEA_BEDS.rigging;
  const w = clamp01(clamp01(wind) + (weather === 'thunder' ? 0.3 : weather === 'rain' ? 0.1 : 0));
  return { volume: max * smooth(from, 1, w) * (0.6 + 0.4 * clamp01(gust)), pitch: 0.92 + 0.2 * w + 0.06 * (clamp01(gust) - 0.5) };
}

/** THE EVENTS' RATES (a mean gap, seconds, the dice drawing each gap exponentially about it): the timbers from a long
 *  calm's to a storm's, the ropes in their blocks with sail set (AUDIT SOUNDSCAPE S10: and only then - a furled ship's
 *  ropes were a gap never heard, and the first creak after the sails went up waited on it). */
export const CREAK_GAP_S = Object.freeze({ calm: 16, storm: 3.2 });
export const ROPE_GAP_S = Object.freeze({ calm: 12, gale: 3.5 });
/** The luff's flaps: a gap drawn between these while she luffs. */
export const LUFF_GAP_S = Object.freeze([1.2, 3.5]);
/** A gull's call: a gap drawn between these while land is near by day in fair weather; a second call follows so often. */
export const GULL_GAP_S = Object.freeze([7, 26]);
export const GULL_PAIR = 0.3;
/** A luff: sails set with less way than this in more wind than that, or head to wind. */
export const LUFF_WAY = 0.8;
export const LUFF_WIND = 0.25;
/** Spray: at more way than this through a sea over that, a crest may throw it over the bow. */
export const SPRAY_WAY = 2.5;
export const SPRAY_STATE = 0.3;

/** The mean gap between the timbers' creaks for a sea of `state`. Pure. */
export const creakGap = (state) => CREAK_GAP_S.calm + (CREAK_GAP_S.storm - CREAK_GAP_S.calm) * clamp01(state);
/** The mean gap between the ropes' creaks with sail set, from a breeze's to a gale's. Pure. */
export const ropeGap = (wind) => ROPE_GAP_S.calm + (ROPE_GAP_S.gale - ROPE_GAP_S.calm) * clamp01(wind);
/** Whether her canvas luffs: sails set, and head to wind, or no way on her with a wind to shake them. Pure. */
export const luffs = ({ sailsUp, inIrons, way, wind }) => !!sailsUp && (!!inIrons || ((Number(way) || 0) < LUFF_WAY && clamp01(wind) > LUFF_WIND));
/** Whether the gulls are about: land near, by day, out of rain, storm and snow. Pure. */
export const gullsAbout = ({ nearLand, night, weather }) => !!nearLand && !night && weather !== 'rain' && weather !== 'thunder' && weather !== 'snow';
/** The chance a crest throws spray over the bow, for `way` through a sea of `state`. Pure. */
export const sprayChance = (way, state) => ((Number(way) || 0) > SPRAY_WAY && clamp01(state) > SPRAY_STATE ? Math.min(1, ((Number(way) || 0) - SPRAY_WAY) / 6) * clamp01(state) : 0);

/** THE WATCH BELLS (a ship's clock): the bells struck at `minuteOfDay` (0..1439) - one at the half hour after a watch
 *  begins (the watches turning at 0, 4, 8, 12, 16 and 20 o'clock), one more each half hour, eight as it ends. Pure. */
export function watchBells(minuteOfDay) {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  const n = Math.floor((m % 240) / 30);
  return n === 0 ? 8 : n;
}
/** How a ship's bells are struck: in pairs, a pair's two strokes BELL_STROKE_S apart and the pairs BELL_PAIR_S apart,
 *  an odd bell alone at the end. The strokes' times from the first, seconds. Pure. */
export const BELL_STROKE_S = 0.42;
export const BELL_PAIR_S = 1.15;
export const bellStrokes = (n) => Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => Math.floor(i / 2) * BELL_PAIR_S + (i % 2) * BELL_STROKE_S);
/** The bells ring only at the world's own pace - the world's minutes a real second, read off the clock itself (AUDIT
 *  SOUNDSCAPE S9: the time dial was the test, and online a crossing's dial moves no shared clock, so its bells went
 *  silent at a pace the clock never ran): never past BELL_MAX_PACE (two and a half times DFU's 12 to 1 - a dial past x2
 *  would ring them every few seconds), and never sooner than BELL_MIN_REAL_S after the last. */
export const BELL_MIN_REAL_S = 60;
export const NORMAL_PACE = 0.2;
export const BELL_MAX_PACE = 0.5;
/** How fast the pace's reading follows the clock (s): a few seconds of it. */
export const BELL_PACE_TAU_S = 3;
/** Daggerfall's bell (DAGGER.SND 107 - the arena's call and the naval host's struck colours), a little higher: a
 *  ship's bell is a small one. */
export const BELL_CLIP = 107;
export const BELL_PITCH = 1.22;

/** The listener's right on the ground, for a forward `fwd` (the port's handedness: screen-right is (cos, 0, -sin) for a
 *  forward (sin, ., cos) - world.js). */
const rightOf = (fwd) => { const l = Math.hypot(fwd[0], fwd[2]) || 1; return [fwd[2] / l, 0, -fwd[0] / l]; };
const flatOf = (fwd) => { const l = Math.hypot(fwd[0], fwd[2]) || 1; return [fwd[0] / l, 0, fwd[2] / l]; };
const at = (ear, ...parts) => { const p = [...ear]; for (const [v, k] of parts) { p[0] += v[0] * k; p[1] += v[1] * k; p[2] += v[2] * k; } return p; };
const UP = [0, 1, 0];
/** @param {() => number} rand @param {number} a @param {number} b */
const between = (rand, a, b) => a + (b - a) * rand();
/** An exponential gap about `mean`, never under a tenth of it. @param {() => number} rand @param {number} mean */
const expGap = (rand, mean) => Math.max(mean * 0.1, -Math.log(1 - Math.min(0.999, rand())) * mean);
/** @template T @param {() => number} rand @param {ReadonlyArray<T>} list @returns {T} */
const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

/**
 * @typedef {{ ear: number[], fwd: number[], bow?: number[] | null, way: number, sailsUp: boolean, inIrons: boolean, wind: number,
 *   gust: number, weather: string, night: boolean, nearLand: boolean, minute: number, paused: boolean }} SeaFrame
 */

/**
 * The deck's air on the engine: `frame(dt, sea)` once a frame while I stand on a deck in the open (dt real seconds;
 * `sea` a SeaFrame: the ear and its forward, her bow - her heading on the water, flat (AUDIT SOUNDSCAPE S3: the spray, the
 * sides and the bell are hers, never the camera's; the ear's forward where she gives none) - her way m/s, her sails and
 * whether she lies in irons, the wind and its gust 0..1, the weather's word, night, land near, the world's minute and the
 * pause); `stop()` on every other frame - the beds faded, the deck's shots let go, the clocks forgotten.
 * @param {{ engine?: any, rand?: () => number }} [opts]
 */
export function createSeaAir({ engine = defaultAudio, rand = Math.random } = {}) {
  let t = 0, on = false, lastSwell = null, lastMinute = null, lastBellT = -Infinity, pace = NORMAL_PACE;
  let creakIn = 0, ropeIn = 0, luffIn = 0, gullIn = 0, lastLuffT = -Infinity, sailsWere = false;
  /** strokes and shots due later: [{ at, play(frame) }] - played where the ear is when they fall due */
  /** @type {Array<{ at: number, play: (s: SeaFrame) => void }>} */
  let due = [];
  const play = (clip, pos, volume, { pitch = 1, ref = 3, max = 120 } = {}) => {
    try { engine.play3d(clip, pos, volume, { refDistance: ref, maxDistance: max, pitch, far: SEA_FAR }); } catch { /* a sound is never the voyage */ }
  };
  const bed = (spec, v) => {
    if (!ensureBed(engine, spec.bed)) return;
    try { engine.setBed(spec.name, v.volume > 0.002 ? spec.bed : null, v); } catch { /* nothing to play it on yet */ }
  };
  const reset = () => { lastSwell = null; lastMinute = null; due = []; creakIn = ropeIn = luffIn = gullIn = 0; lastLuffT = -Infinity; sailsWere = false; pace = NORMAL_PACE; };
  /** The clocks as I step aboard: every event a gap away, none of them all at once on the first frame. @param {SeaFrame} s */
  const seed = (s) => {
    const state = seaState(s.wind, s.weather);
    creakIn = expGap(rand, creakGap(state));
    ropeIn = expGap(rand, ropeGap(s.wind));
    sailsWere = !!s.sailsUp;
    luffIn = between(rand, 0, LUFF_GAP_S[1]);
    gullIn = between(rand, 2, GULL_GAP_S[0]);
  };
  /** Her heading and her starboard: the bow given, else the ear's forward. @param {SeaFrame} c */
  const headingOf = (c) => flatOf(c.bow ?? c.fwd ?? [0, 0, 1]);
  return {
    get on() { return on; },
    /** @param {number} dt @param {SeaFrame} s */
    frame(dt, s) {
      if (!s || !Array.isArray(s.ear) || s.ear.length !== 3) return;
      const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
      // AUDIT SOUNDSCAPE S1: the events' clock stands with the game - a pause held the queue but ran the clock, and every
      // bell stroke that fell due under it rang on the unpause frame at once (six strokes, 15 dB over one)
      if (!s.paused) t += step;
      if (!on) seed(s);
      on = true;
      const state = seaState(s.wind, s.weather);
      bed(SEA_BEDS.swell, swellBed(state, t));
      bed(SEA_BEDS.wash, washBed(s.way, state, t));
      bed(SEA_BEDS.rigging, riggingBed(s.wind, s.gust, s.weather));
      if (s.paused || step === 0) return;
      const bow = headingOf(s), starboard = rightOf(bow);
      // a swell cresting: a slap port or starboard, a second in a heavy sea, and spray over the bow at speed
      const sw = seaSwellAt(t);
      if (lastSwell != null && lastSwell < SWELL_CREST && sw >= SWELL_CREST) {
        const side = rand() < 0.5 ? -1 : 1;
        play(pick(rand, SCAPE_SFX.seaSlap), at(s.ear, [starboard, side * between(rand, 2.5, 4)], [UP, -1.6]), 0.25 + 0.5 * state, { pitch: between(rand, 0.9, 1.1), ref: 3, max: 60 });
        if (rand() < state) due.push({ at: t + between(rand, 0.15, 0.4), play: (c) => play(pick(rand, SCAPE_SFX.seaSlap), at(c.ear, [rightOf(headingOf(c)), -side * between(rand, 2.5, 4)], [UP, -1.6]), 0.2 + 0.4 * state, { pitch: between(rand, 0.9, 1.1), ref: 3, max: 60 }) });
        if (rand() < sprayChance(s.way, state)) play(pick(rand, SCAPE_SFX.seaSpray), at(s.ear, [bow, 5], [UP, -1]), 0.3 + 0.4 * state, { pitch: between(rand, 0.92, 1.08), ref: 4, max: 80 });
      }
      lastSwell = sw;
      // the timbers, and the ropes in their blocks while sail is set (S10: re-armed as it goes up)
      if ((creakIn -= step) <= 0) {
        play(pick(rand, SCAPE_SFX.seaCreak), at(s.ear, [starboard, between(rand, -5, 5)], [bow, between(rand, -5, 5)], [UP, between(rand, -1, 1)]), 0.2 + 0.35 * state, { pitch: between(rand, 0.88, 1.12), ref: 2.5, max: 40 });
        creakIn = expGap(rand, creakGap(state));
      }
      if (s.sailsUp && !sailsWere) ropeIn = expGap(rand, ropeGap(s.wind));
      sailsWere = !!s.sailsUp;
      if (s.sailsUp && (ropeIn -= step) <= 0) {
        play(pick(rand, SCAPE_SFX.seaRope), at(s.ear, [starboard, between(rand, -3, 3)], [bow, between(rand, -4, 4)], [UP, between(rand, 2, 6)]), 0.18 + 0.3 * clamp01(s.wind), { pitch: between(rand, 0.9, 1.15), ref: 2.5, max: 40 });
        ropeIn = expGap(rand, ropeGap(s.wind));
      }
      // the canvas shaking - never sooner than the shortest gap after the last flap (AUDIT SOUNDSCAPE S8: a law that
      // flickered on and off flapped at once at each return, a burst where a luff is a flap every second or three)
      if (luffs(s)) {
        if ((luffIn -= step) <= 0) {
          play(pick(rand, SCAPE_SFX.seaLuff), at(s.ear, [bow, between(rand, -2, 3)], [UP, between(rand, 4, 7)]), 0.3 + 0.4 * clamp01(s.wind), { pitch: between(rand, 0.9, 1.1), ref: 4, max: 80 });
          lastLuffT = t;
          luffIn = between(rand, LUFF_GAP_S[0], LUFF_GAP_S[1]);
        }
      } else luffIn = Math.max(0, LUFF_GAP_S[0] - (t - lastLuffT));
      // the gulls
      if (gullsAbout(s)) {
        if ((gullIn -= step) <= 0) {
          const az = between(rand, -Math.PI, Math.PI), d = between(rand, 25, 70), h = between(rand, 12, 30);
          /** @param {number[]} ear @param {number} k */
          const gull = (ear, k) => play(pick(rand, SCAPE_SFX.gull), [ear[0] + Math.sin(az) * d * k, ear[1] + h, ear[2] + Math.cos(az) * d * k], between(rand, 0.35, 0.6), { pitch: between(rand, 0.92, 1.08), ref: 18, max: 400 });
          gull(s.ear, 1);
          if (rand() < GULL_PAIR) due.push({ at: t + between(rand, 0.5, 1.6), play: (c) => gull(c.ear, 0.9) });
          gullIn = between(rand, GULL_GAP_S[0], GULL_GAP_S[1]);
        }
      } else gullIn = between(rand, 2, GULL_GAP_S[0]);
      // the watch bells: a half hour of the world's clock crossed at its own pace (a load, a rest or a journey's jump is
      // not a half hour struck), never sooner than BELL_MIN_REAL_S after the last
      const minute = Number(s.minute);
      if (Number.isFinite(minute)) {
        if (lastMinute != null) {
          const dm = ((minute - lastMinute) % 1440 + 1440 + 720) % 1440 - 720;   // the minutes this frame moved, the wrap taken
          if (Math.abs(dm) <= 30) pace += (dm / step - pace) * Math.min(1, step / BELL_PACE_TAU_S);
        }
        const half = Math.floor(minute / 30);
        // the minute of the day wraps at midnight: the half hour after 23:30 is 00:00, struck as the watch's eight
        if (lastMinute != null && ((half - Math.floor(lastMinute / 30)) % 48 + 48) % 48 === 1 && pace <= BELL_MAX_PACE && t - lastBellT >= BELL_MIN_REAL_S) {
          lastBellT = t;
          for (const k of bellStrokes(watchBells((half * 30) % 1440))) due.push({ at: t + k, play: (c) => play(BELL_CLIP, at(c.ear, [headingOf(c), 3], [UP, 2.5]), 0.4, { pitch: BELL_PITCH, ref: 6, max: 300 }) });
        }
        lastMinute = minute;
      }
      if (due.length) {
        const now = due.filter((d) => d.at <= t);
        if (now.length) { due = due.filter((d) => d.at > t); for (const d of now) d.play(s); }
      }
    },
    stop() {
      reset();
      if (!on) return;
      on = false;
      try {
        for (const spec of Object.values(SEA_BEDS)) engine.setBed(spec.name, null);
        engine.fadeFar?.(SEA_FAR);
      } catch { /* nothing left to stop */ }
    },
  };
}
