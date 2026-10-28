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
//   THE EVENTS: GULLS by day in fair weather while land is near (systems/soundscape/soundscapeSfx.js); and the WATCH
//     BELLS each half hour of the world's clock, struck in pairs - one bell at the half hour after a watch begins,
//     eight at its end (`watchBells`) - on Daggerfall's own bell (DAGGER.SND 107).
//   DECK-QUIET (2026-10-26, the owner: "Remove all deck at sea"): the deck's own one-shots - a wave slapping the hull,
//     the timbers and the ropes creaking, the canvas luffing, the spray over the bow - are gone, and their clips with
//     them.
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

/** A gull's call: a gap drawn between these while land is near by day in fair weather; a second call follows so often. */
export const GULL_GAP_S = Object.freeze([7, 26]);
export const GULL_PAIR = 0.3;

/** Whether the gulls are about: land near, by day, out of rain, storm and snow. Pure. */
export const gullsAbout = ({ nearLand, night, weather }) => !!nearLand && !night && weather !== 'rain' && weather !== 'thunder' && weather !== 'snow';

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

const flatOf = (fwd) => { const l = Math.hypot(fwd[0], fwd[2]) || 1; return [fwd[0] / l, 0, fwd[2] / l]; };
const at = (ear, ...parts) => { const p = [...ear]; for (const [v, k] of parts) { p[0] += v[0] * k; p[1] += v[1] * k; p[2] += v[2] * k; } return p; };
const UP = [0, 1, 0];
/** @param {() => number} rand @param {number} a @param {number} b */
const between = (rand, a, b) => a + (b - a) * rand();
/** @template T @param {() => number} rand @param {ReadonlyArray<T>} list @returns {T} */
const pick = (rand, list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

/**
 * @typedef {{ ear: number[], fwd: number[], bow?: number[] | null, way: number, wind: number, gust: number, weather: string,
 *   night: boolean, nearLand: boolean, minute: number, paused: boolean }} SeaFrame
 */

/**
 * The deck's air on the engine: `frame(dt, sea)` once a frame while I stand on a deck in the open (dt real seconds;
 * `sea` a SeaFrame: the ear and its forward, her bow - her heading on the water, flat (AUDIT SOUNDSCAPE S3: the bell is
 * hers, never the camera's; the ear's forward where she gives none) - her way m/s, the wind and its gust 0..1, the
 * weather's word, night, land near, the world's minute and the pause); `stop()` on every other frame - the beds faded,
 * the deck's shots let go, the clocks forgotten.
 * @param {{ engine?: any, rand?: () => number }} [opts]
 */
export function createSeaAir({ engine = defaultAudio, rand = Math.random } = {}) {
  let t = 0, on = false, lastMinute = null, lastBellT = -Infinity, pace = NORMAL_PACE, gullIn = 0;
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
  const reset = () => { lastMinute = null; due = []; gullIn = 0; pace = NORMAL_PACE; };
  /** The gulls' clock as I step aboard: a gap away, never on the first frame. */
  const seed = () => { gullIn = between(rand, 2, GULL_GAP_S[0]); };
  /** Her heading: the bow given, else the ear's forward. @param {SeaFrame} c */
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
      if (!on) seed();
      on = true;
      const state = seaState(s.wind, s.weather);
      bed(SEA_BEDS.swell, swellBed(state, t));
      bed(SEA_BEDS.wash, washBed(s.way, state, t));
      bed(SEA_BEDS.rigging, riggingBed(s.wind, s.gust, s.weather));
      if (s.paused || step === 0) return;
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
