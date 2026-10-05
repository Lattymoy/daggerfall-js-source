// @ts-check
// ARENA2 (2026-10-02, Mac: "During fights, the crowd is present and can cheer/boo you"): THE CROWD, HEARD. Design:
// bible/11-Multiplayer/Arena.md "4. The crowd" ("Sound").
//
// DAGGER.SND has no cheer, no boo and no applause - its "Arena" clips are TES I's monsters - but it has ten recordings
// of people (AmbientPeople1-10, records 441-450, unused anywhere until now): several voices at once, partly voiced,
// 0.2 to 8.5 seconds. So the crowd is BUILT AT RUNTIME out of the player's own archive (`audio.samplesOf`) and filtered
// noise, and registered on the engine (`audio.registerSamples`, the wind's door - systems/windAudio.js): nothing new
// ships, and nothing of Daggerfall's is ever written into the tree.
//
//   THE BED (`arena:bed`) - the ten voices layered at their own offsets and pitches over a soft murmur of noise, made
//     PERIODIC (each layer wrapped round the loop) so the engine's native loop has no seam: the tiers talking.
//   THE CHEER (`arena:cheer`) - the voices pitched up, many at once, over a band of bright noise, swelling and falling.
//   THE ROAR (`arena:roar`) - the cheer, bigger and longer: more voices, more noise, a slower fall.
//   THE BOO (`arena:boo`) - the voices pitched down and slowed, over low-passed noise, a long falling "oooh".
//   THE APPLAUSE (`arena:applause`) - hundreds of hand claps (short bursts of band-passed noise, gmSynth's clap
//     recipe) thickening and thinning out, a few voices under them.
// The rest is Daggerfall's own, played as it is: the gasps at a crit (386 MaleGasp, 387 FemaleGasp), the groan at a
// knockdown (458), the drums before the call (28 AmbientDrums, 374 SelectClassDrums), the bell (107), and TES I's own
// fanfares - of victory (32 ArenaFanfareLevelUp) and of a title (33 ArenaFanfareStaffOfChaos).
//
// The synthesis is pure (the voices and the seed in, samples out); the driver plays the crowd law's cues
// (systems/arenaCrowd.js crowdHear) and keeps the bed's level with the mood. Not a DFU member. Ledger A (ARENA).

import { SAMPLE_RATE as SND_RATE } from '../formats/sndFile.js';
import { seededRng } from './arenaLadder.js';

/** The voices (DAGGER.SND AmbientPeople1-10). */
export const PEOPLE_RECORDS = Object.freeze([441, 442, 443, 444, 445, 446, 447, 448, 449, 450]);
/** Daggerfall's own clips the crowd plays as they are. */
export const ARENA_CLIPS = Object.freeze({ maleGasp: 386, femaleGasp: 387, groan: 458, drums: 28, drumsCall: 374, bell: 107, fanfare: 32, title: 33 });
/** The made sounds' keys on the engine. */
export const ARENA_SOUND_KEYS = Object.freeze({ bed: 'arena:bed', cheer: 'arena:cheer', roar: 'arena:roar', boo: 'arena:boo', applause: 'arena:applause' });
/** The rate the made sounds are built at (everything they hold sits under 5 kHz). */
export const ARENA_SOUND_RATE = 22050;
/** Each made sound's length, seconds. */
export const ARENA_SOUND_SECONDS = Object.freeze({ bed: 8, cheer: 2.6, roar: 3.6, boo: 2.8, applause: 3.4 });
/** Each made sound's level (RMS) - the bed under everything, the roar over it all. */
export const ARENA_SOUND_RMS = Object.freeze({ bed: 0.05, cheer: 0.11, roar: 0.15, boo: 0.1, applause: 0.09 });
/** HOTFIX 1003 (live: crackling as a match ends): every cue at this share of its volume - the verdict's applause, the
 *  fanfare, the victory music and the roar sounded together past full scale and clipped. */
export const ARENA_CUE_TRIM = 0.8;
/** HOTFIX 1003: how long the bed takes to fall silent when it stops, seconds. */
export const BED_FADE_S = 0.4;
/** HOTFIX 1003: the shouts' top - the layered 8-bit voices hiss above it. */
export const SHOUT_TOP_HZ = 3400;
/** The seed of the made sounds: the same crowd every boot. */
export const ARENA_SOUND_SEED = 0x43524f57;

/** A voice resampled by `ratio` (2 an octave up) into `n` samples at `rate`, read from `src` at `srcRate`, starting at
 *  `offset` seconds into the output and wrapping round it when `wrap` (a periodic layer). Added into `out` at `gain`.
 *  IMPACTFX: the made sounds' ONE mixer - the spell impacts' layers (systems/spellImpactSound.js) cut a voice to its
 *  first `take` seconds and fade it in over `fadeIn` and out over its last `fadeOut`; with neither fade, as before. */
export function addVoice(out, rate, src, srcRate, { ratio = 1, offset = 0, gain = 1, wrap = false, env = null, take = Infinity, fadeIn = 0, fadeOut = 0 } = {}) {
  if (!src?.length) return out;
  const step = (srcRate / rate) * ratio;
  const len = Math.min(Math.floor(src.length / step), Math.floor(take * rate));
  const start = Math.floor(offset * rate);
  const faded = fadeIn > 0 || fadeOut > 0, fi = Math.max(1, fadeIn * rate), fo = Math.max(1, fadeOut * rate);
  for (let i = 0; i < len; i++) {
    let j = start + i;
    if (wrap) j = ((j % out.length) + out.length) % out.length;
    else if (j < 0 || j >= out.length) continue;
    const p = i * step, k = Math.floor(p), f = p - k;
    const s = (src[k] ?? 0) * (1 - f) + (src[k + 1] ?? src[k] ?? 0) * f;
    out[j] += s * gain * (env ? env(j / out.length) : 1) * (faded ? Math.min(1, i / fi, (len - i) / fo) : 1);
  }
  return out;
}

/** White noise, `n` samples, from the seeded die. */
export function noise(n, rng) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
  return out;
}
/** A one-pole low-pass at `hz` (in place). */
export function lowpass(x, rate, hz) {
  const a = 1 - Math.exp(-hz * 2 * Math.PI / rate);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; }
  return x;
}
/** A one-pole high-pass at `hz` (in place). */
export function highpass(x, rate, hz) {
  const a = Math.exp(-hz * 2 * Math.PI / rate);
  let px = 0, y = 0;
  for (let i = 0; i < x.length; i++) { y = a * (y + x[i] - px); px = x[i]; x[i] = y; }
  return x;
}
/** A band of noise between `lo` and `hi` Hz. */
export const band = (n, rate, rng, lo, hi) => lowpass(highpass(noise(n, rng), rate, lo), rate, hi);
/** The RMS of a buffer. */
export function rms(x) { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return x.length ? Math.sqrt(s / x.length) : 0; }
/** Level a buffer to `target` RMS, its peaks held under 0.98 (a soft knee - tanh - over the loudest). */
export function level(x, target) {
  const r = rms(x);
  const k = r > 1e-9 ? target / r : 0;
  for (let i = 0; i < x.length; i++) { const v = x[i] * k; x[i] = Math.abs(v) < 0.7 ? v : Math.sign(v) * (0.7 + 0.28 * Math.tanh((Math.abs(v) - 0.7) / 0.28)); }
  return x;
}
/** An envelope: up over `a` (share of the whole), held, down over `r`. */
export const swell = (a, r) => (t) => (t < a ? t / a : t > 1 - r ? Math.max(0, (1 - t) / r) : 1);

/** The voices as the synthesis takes them: Float32Arrays at `srcRate` (empty ones dropped). */
const usable = (voices) => (voices ?? []).filter((v) => v && v.length > 32);

/** THE BED: the voices layered round the loop, each at its own offset and pitch, over a murmur. Periodic. */
export function synthBed(voices, { rate = ARENA_SOUND_RATE, srcRate = SND_RATE, seed = ARENA_SOUND_SEED } = {}) {
  const rng = seededRng(seed);
  const n = Math.round(ARENA_SOUND_SECONDS.bed * rate);
  const out = band(n, rate, rng, 180, 900);
  for (let i = 0; i < n; i++) out[i] *= usable(voices).length ? 0 : 0.06;   // HOTFIX 1003f (live: "get rid of the static crowd noise"): with the voices, no noise at all - HOTFIX 1003 (live: "the crowd noise is just pure static"): the murmur under the voices, not over them
  // the noise wrapped: the last 50 ms faded into the first, so the loop has no click
  const fade = Math.round(0.05 * rate);
  for (let i = 0; i < fade; i++) { const t = i / fade; out[i] = out[i] * t + out[n - fade + i] * (1 - t); }
  const vs = usable(voices);
  for (let layer = 0; layer < vs.length * 2; layer++) {
    const v = vs[layer % vs.length];
    addVoice(out, rate, v, srcRate, { ratio: 0.88 + rng() * 0.24, offset: rng() * ARENA_SOUND_SECONDS.bed, gain: 0.55 + rng() * 0.3, wrap: true });
  }
  return level(out, ARENA_SOUND_RMS.bed);
}

/** A crowd's shout out of the voices: `count` layers at `pitch` (+- `spread`) under `env`, over a band of noise. */
function shout(voices, { rate, srcRate, seed, seconds, count, pitch, spread, noiseLo, noiseHi, noiseGain, env, target }) {
  const rng = seededRng(seed);
  const n = Math.round(seconds * rate);
  const out = band(n, rate, rng, noiseLo, noiseHi);
  const hiss = usable(voices).length ? 0 : 1; for (let i = 0; i < n; i++) out[i] *= noiseGain * hiss * env(i / n);   // HOTFIX 1003f (live: "get rid of the static crowd noise when cheering and booing"): the voices alone - the noise only stands in for an archive with none
  const vs = usable(voices);
  for (let k = 0; k < (vs.length ? count : 0); k++) {
    const v = vs[Math.floor(rng() * vs.length)];
    addVoice(out, rate, v, srcRate, { ratio: pitch * (1 - spread + rng() * spread * 2), offset: rng() * seconds * 0.35 - 0.2, gain: 0.5 + rng() * 0.5, env });
  }
  return level(lowpass(out, rate, SHOUT_TOP_HZ), target);   // HOTFIX 1003: the layered 8-bit voices' hiss taken off the top
}
/** THE CHEER: the voices up, bright noise, a swell. */
export const synthCheer = (voices, { rate = ARENA_SOUND_RATE, srcRate = SND_RATE, seed = ARENA_SOUND_SEED + 1 } = {}) => shout(voices, {
  rate, srcRate, seed, seconds: ARENA_SOUND_SECONDS.cheer, count: 14, pitch: 1.22, spread: 0.12, noiseLo: 500, noiseHi: 3200, noiseGain: 0.15, env: swell(0.12, 0.45), target: ARENA_SOUND_RMS.cheer,
});
/** THE ROAR: the cheer, bigger and longer. */
export const synthRoar = (voices, { rate = ARENA_SOUND_RATE, srcRate = SND_RATE, seed = ARENA_SOUND_SEED + 2 } = {}) => shout(voices, {
  rate, srcRate, seed, seconds: ARENA_SOUND_SECONDS.roar, count: 26, pitch: 1.15, spread: 0.16, noiseLo: 350, noiseHi: 3600, noiseGain: 0.22, env: swell(0.08, 0.55), target: ARENA_SOUND_RMS.roar,
});
/** THE BOO: the voices down and slowed, over low noise, a long falling oooh. */
export const synthBoo = (voices, { rate = ARENA_SOUND_RATE, srcRate = SND_RATE, seed = ARENA_SOUND_SEED + 3 } = {}) => shout(voices, {
  rate, srcRate, seed, seconds: ARENA_SOUND_SECONDS.boo, count: 16, pitch: 0.66, spread: 0.08, noiseLo: 90, noiseHi: 520, noiseGain: 0.18, env: swell(0.18, 0.5), target: ARENA_SOUND_RMS.boo,
});
/** THE APPLAUSE: many hand claps - each a burst of band-passed noise falling away in a few milliseconds - thickening,
 *  then thinning out, a few voices under them. */
export function synthApplause(voices, { rate = ARENA_SOUND_RATE, srcRate = SND_RATE, seed = ARENA_SOUND_SEED + 4 } = {}) {
  const rng = seededRng(seed);
  const n = Math.round(ARENA_SOUND_SECONDS.applause * rate);
  const out = new Float32Array(n);
  const env = swell(0.15, 0.55);
  const claps = 2200;   // HOTFIX 1003 (live: "crackling at the end of the celebration"): a thinning rain of 900 was single clicks at its tail
  for (let c = 0; c < claps; c++) {
    // claps fall where the envelope is high: a draw against the envelope (rejection)
    let t = rng();
    for (let tries = 0; tries < 4 && rng() > env(t); tries++) t = rng();
    const at = Math.floor(t * n), len = Math.floor((0.008 + rng() * 0.014) * rate), g = 0.4 + rng() * 0.6;
    const hp = 900 + rng() * 1400;
    let y = 0, px = 0;
    const a = Math.exp(-hp * 2 * Math.PI / rate);
    for (let i = 0; i < len && at + i < n; i++) {
      const x = (rng() * 2 - 1) * Math.exp(-i / (len * 0.35));
      y = a * (y + x - px); px = x;
      out[at + i] += y * g;
    }
  }
  const vs = usable(voices);
  for (let k = 0; k < (vs.length ? 5 : 0); k++) addVoice(out, rate, vs[Math.floor(rng() * vs.length)], srcRate, { ratio: 1.1, offset: rng() * 1.5, gain: 0.25, env });
  return level(out, ARENA_SOUND_RMS.applause);
}

/** Every made sound, by key - what the driver registers. Pure. */
export function synthArenaSounds(voices, o = {}) {
  return {
    [ARENA_SOUND_KEYS.bed]: synthBed(voices, o),
    [ARENA_SOUND_KEYS.cheer]: synthCheer(voices, o),
    [ARENA_SOUND_KEYS.roar]: synthRoar(voices, o),
    [ARENA_SOUND_KEYS.boo]: synthBoo(voices, o),
    [ARENA_SOUND_KEYS.applause]: synthApplause(voices, o),
  };
}

/** The bed's gain for a mood (-1..1) and how near the crowd is (0..1): a murmur at rest, louder either way it goes. */
export const BED_GAIN = 0.55;
export const bedGain = (mood, near = 1) => Math.max(0, Math.min(1, near)) * BED_GAIN * (0.55 + 0.45 * Math.min(1, Math.abs(mood) * 1.4));

/**
 * THE DRIVER on the engine (systems/audio.js): `ensure()` builds and registers the made sounds once the archive is read
 * (false until it can), `cue(list, near)` plays the crowd law's cues, `bed(mood, near)` keeps the bed going at its
 * level (`near` 0 stops it), `stop()` silences it.
 */
export function createArenaSound(audio) {
  let made = false, bedLoop = null;
  const flip = { v: false };
  return {
    ensure() {
      if (made) return true;
      if (!audio?.samplesOf || !audio?.registerSamples) return false;
      const voices = PEOPLE_RECORDS.map((i) => audio.samplesOf(i)).filter(Boolean);
      if (!voices.length) return false;   // no archive yet - asked again next frame
      const all = synthArenaSounds(voices);
      for (const [k, x] of Object.entries(all)) if (!audio.registerSamples(k, x, ARENA_SOUND_RATE)) return false;
      made = true;
      return true;
    },
    cue(list, near = 1) {
      if (!(near > 0) || !list?.length) return;
      for (const { s, v } of list) {
        const vol = Math.max(0, Math.min(1, v * near)) * ARENA_CUE_TRIM;
        switch (s) {
          case 'cheer': case 'roar': case 'boo': case 'applause':
            if (this.ensure()) audio.playOneShot(ARENA_SOUND_KEYS[s], vol, 0.94 + Math.random() * 0.12);
            break;
          case 'gasp': flip.v = !flip.v; audio.playOneShot(flip.v ? ARENA_CLIPS.maleGasp : ARENA_CLIPS.femaleGasp, vol); break;
          case 'groan': audio.playOneShot(ARENA_CLIPS.groan, vol); break;
          case 'drums': audio.playOneShot(ARENA_CLIPS.drums, vol); break;
          case 'drumsCall': audio.playOneShot(ARENA_CLIPS.drumsCall, vol); break;
          case 'bell': audio.playOneShot(ARENA_CLIPS.bell, vol); break;
          case 'fanfare': audio.playOneShot(ARENA_CLIPS.fanfare, vol); break;
          case 'title': audio.playOneShot(ARENA_CLIPS.title, vol); break;
          default: break;
        }
      }
    },
    bed(mood, near = 1) {
      if (!(near > 0)) { this.stop(); return; }
      if (!this.ensure()) return;
      if (!bedLoop) bedLoop = audio.loop?.(ARENA_SOUND_KEYS.bed, 0) ?? null;
      bedLoop?.setVolume?.(bedGain(mood, near));
    },
    stop() { if (bedLoop) { if (bedLoop.fadeStop) bedLoop.fadeStop(BED_FADE_S); else bedLoop.stop(); bedLoop = null; } },   // HOTFIX 1003: faded, never cut - a cut bed pops
    get made() { return made; },
  };
}
