// @ts-check
// SD4b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 6): THE RIFT'S SOUND - "a bell
// heard under water". Built at runtime out of the player's own archive (`audio.samplesOf`) and registered on the engine
// (`audio.registerSamples`, the wind's door), as ARENA2's crowd is (systems/arenaSound.js, whose mixer it borrows):
// nothing new ships, and nothing of Daggerfall's is written into the tree.
//
//   THE TOLL - DAGGER.SND's ship's bell (record 107, the naval host's) slowed and pitched down near a sixth, its
//     answer a third of a second behind it, softer: the water's echo.
//   THE WATER - the bubbles (114) under it, faint, wrapped round the loop.
//   THE DEPTH - all of it darkened (a one-pole low-pass) and wavering slowly (the water's swell), made PERIODIC so the
//     engine's own loop has no seam; and the loop played through the engine's low-pass besides (`loop3d`'s `lowpass`).
//
// The synthesis is pure (the voices in, samples out); `startRiftBell` registers it once the archive is read and loops it
// where the Rift stands. Not a DFU member. Ledger A (SUPER-DUNGEONS).

import { SAMPLE_RATE as SND_RATE } from '../formats/sndFile.js';
import { addVoice, lowpass, level } from './arenaSound.js';

/** The made sound's key on the engine. */
export const RIFT_BELL_KEY = 'sd:riftBell';
/** Daggerfall's own voices it is made of (DAGGER.SND records): the ship's bell, the bubbles. */
export const RIFT_BELL_RECORDS = Object.freeze({ bell: 107, bubbles: 114 });
/** The rate it is built at (everything it holds sits under 2 kHz), its length (one toll a loop) and its level (RMS). */
export const RIFT_BELL_RATE = 22050;
export const RIFT_BELL_SECONDS = 6.5;
export const RIFT_BELL_RMS = 0.07;
/** How far it is heard (m) - full within `refDistance`, gone past `maxDistance` - and the engine's low-pass on it (Hz). */
export const RIFT_BELL_RANGE = Object.freeze({ refDistance: 3, maxDistance: 40 });
export const RIFT_BELL_LOWPASS_HZ = 900;
/** The toll's pitch (a ratio), its echo's delay (s) and share, the swell's rate (Hz) and depth. */
export const RIFT_BELL_SHAPE = Object.freeze({ ratio: 0.62, echoS: 0.33, echo: 0.35, swellHz: 0.45, swell: 0.3, darkHz: 1100 });

/**
 * THE BELL UNDER WATER: `bell` and `bubbles` (Float32Arrays at `srcRate`, either may be missing) into one periodic toll of
 * `seconds` at `rate`. Pure.
 * @param {Float32Array | null | undefined} bell
 * @param {Float32Array | null | undefined} bubbles
 */
export function buildRiftBell(bell, bubbles, { srcRate = SND_RATE, rate = RIFT_BELL_RATE, seconds = RIFT_BELL_SECONDS } = {}) {
  const out = new Float32Array(Math.round(rate * seconds));
  const S = RIFT_BELL_SHAPE;
  if (bell?.length) {
    addVoice(out, rate, bell, srcRate, { ratio: S.ratio, offset: 0.05, gain: 1, wrap: true });
    addVoice(out, rate, bell, srcRate, { ratio: S.ratio * 0.995, offset: 0.05 + S.echoS, gain: S.echo, wrap: true });
  }
  if (bubbles?.length) addVoice(out, rate, bubbles, srcRate, { ratio: 0.8, offset: seconds * 0.45, gain: 0.18, wrap: true });
  lowpass(out, rate, S.darkHz);
  // the swell: a whole number of slow waves in the loop, so its end meets its start
  const waves = Math.max(1, Math.round(S.swellHz * seconds));
  for (let i = 0; i < out.length; i++) out[i] *= 1 - S.swell * 0.5 * (1 - Math.cos((2 * Math.PI * waves * i) / out.length));
  return level(out, RIFT_BELL_RMS);
}

/**
 * The toll looped where the Rift stands (`at`, the scene's [x, y, z]) - registered once the archive is read. Answers the
 * engine's loop handle ({ move, setVolume, stop }), or null (no archive yet, no context, no engine).
 * @param {any} audio the engine (systems/audio.js)
 * @param {number[]} at
 */
export function startRiftBell(audio, at) {
  if (!audio?.loop3d || !at) return null;
  try {
    if (!bellOn(audio)) return null;
    return audio.loop3d(RIFT_BELL_KEY, at, 1, { ...RIFT_BELL_RANGE, distanceModel: 'linear', lowpass: RIFT_BELL_LOWPASS_HZ }) ?? null;
  } catch { return null; }   // a sound that cannot stand never costs the Rift
}

/** The toll registered on the engine, once the archive is read - true once it stands. */
function bellOn(audio) {
  if (!audio?.registerSamples || !audio?.samplesOf) return false;
  const bell = audio.samplesOf(RIFT_BELL_RECORDS.bell);
  if (!bell) return false;
  return !!audio.registerSamples(RIFT_BELL_KEY, buildRiftBell(bell, audio.samplesOf(RIFT_BELL_RECORDS.bubbles)), RIFT_BELL_RATE);
}

/** AUDIT SD II (L6 F16): the way home's toll - the Rift's own bell, a fourth higher (the way out, where the Rift is the
 *  way in), heard across the arena, unmuffled. */
export const SD_HOME_TOLL = Object.freeze({ pitch: 4 / 3, refDistance: 6, maxDistance: 70 });

/**
 * AUDIT SD II (L6 F16): ONE TOLL where the way home rises (`at`, the scene's [x, y, z]) - it rose unheard. Answers
 * whether it sounded.
 * @param {any} audio the engine (systems/audio.js)
 * @param {number[]} at
 */
export function tollRiftBell(audio, at) {
  if (!audio?.play3d || !at) return false;
  try {
    if (!bellOn(audio)) return false;
    const T = SD_HOME_TOLL;
    return audio.play3d(RIFT_BELL_KEY, at, 1, { refDistance: T.refDistance, maxDistance: T.maxDistance, distanceModel: 'linear', pitch: T.pitch }) != null;
  } catch { return false; }   // a toll that cannot sound never costs the way home
}
