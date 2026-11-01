// @ts-check
// OWN-WORK4 (2026-10-31): THE BOATS' SYNTHESIZER - the few pieces csaClips.js makes Come Sail Away's five clips from:
// a seeded noise, one-pole and biquad filters, envelopes, a resonant body and a loop's seam. Pure functions over
// Float32Array PCM, deterministic on their seeds, no Web Audio. The die is the port's synth's own (audio/synth/dsp.js).
// Not a DFU member.
import { mulberry32 } from '../../../audio/synth/dsp.js';

/** A seeded generator in [0, 1) - the port's synth's die (mulberry32). */
export const seededDie = (/** @type {number} */ seed) => mulberry32(seed >>> 0);
/** `count` samples of white noise in [-1, 1) (xorshift32 on `seed`). */
export function whiteNoise(count, seed) {
  const out = new Float32Array(count);
  let state = seed >>> 0 || 1;
  for (let i = 0; i < count; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out[i] = (state >>> 0) / 2147483648 - 1;
  }
  return out;
}
/** A slow modulation `fn(t)` laid over `pcm` (in place), read once every `block` samples - an LFO's pace. */
export function modulate(pcm, rate, fn, block = 256) {
  for (let start = 0; start < pcm.length; start += block) {
    const gain = fn(start / rate);
    const end = Math.min(pcm.length, start + block);
    for (let i = start; i < end; i++) pcm[i] *= gain;
  }
  return pcm;
}
/** A one-pole low-pass at `hertz` over `pcm` (in place), `hertz` a number or a function of the sample index. */
export function onePoleLowpass(pcm, rate, hertz) {
  let held = 0;
  const share = (freq) => 1 - Math.exp((-2 * Math.PI * freq) / rate);
  if (typeof hertz === 'number') {
    const step = share(hertz);
    for (let i = 0; i < pcm.length; i++) pcm[i] = held += step * (pcm[i] - held);
    return pcm;
  }
  for (let i = 0; i < pcm.length; i++) pcm[i] = held += share(hertz(i)) * (pcm[i] - held);
  return pcm;
}
/** A one-pole high-pass at `hertz` over `pcm` (in place). */
export function onePoleHighpass(pcm, rate, hertz) {
  const keep = Math.exp((-2 * Math.PI * hertz) / rate);
  let lastIn = 0,
    lastOut = 0;
  for (let i = 0; i < pcm.length; i++) {
    const out = keep * (lastOut + pcm[i] - lastIn);
    lastIn = pcm[i];
    lastOut = out;
    pcm[i] = out;
  }
  return pcm;
}
/** A band-pass biquad (constant peak gain) at `hertz`, quality `quality`, over `pcm` (in place). */
export function bandpass(pcm, rate, hertz, quality = 1) {
  const omega = (2 * Math.PI * hertz) / rate,
    alpha = Math.sin(omega) / (2 * quality),
    norm = 1 + alpha;
  const feed0 = alpha / norm,
    feed2 = -alpha / norm,
    back1 = (-2 * Math.cos(omega)) / norm,
    back2 = (1 - alpha) / norm;
  let in1 = 0,
    in2 = 0,
    out1 = 0,
    out2 = 0;
  for (let i = 0; i < pcm.length; i++) {
    const out = feed0 * pcm[i] + feed2 * in2 - back1 * out1 - back2 * out2;
    in2 = in1;
    in1 = pcm[i];
    out2 = out1;
    out1 = out;
    pcm[i] = out;
  }
  return pcm;
}
/** `pcm` times an attack-decay envelope starting at `at` (s): up over `attack`, down by e every `decay` (in place). */
export function strikeEnvelope(pcm, rate, { at = 0, attack = 0.005, decay = 0.2, gain = 1 } = {}) {
  const start = Math.round(at * rate),
    rise = Math.max(1, Math.round(attack * rate));
  const fall = Math.exp(-1 / (decay * rate));
  let level = gain;
  for (let i = 0; i < pcm.length; i++) {
    const since = i - start;
    if (since < 0) pcm[i] = 0;
    else if (since < rise) pcm[i] *= (gain * since) / rise;
    else {
      pcm[i] *= level;
      level *= fall;
    }
  }
  return pcm;
}
/** `src` added into `dst` from sample `at`, times `gain`. */
export function mixInto(dst, src, at = 0, gain = 1) {
  for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain;
  return dst;
}
/** A creak: a sawtooth whose pitch slides from `fromHz` to `toHz` over `length` s, through a resonant body at `body` Hz. */
export function creak(rate, { length = 0.6, fromHz = 90, toHz = 140, body = 420, quality = 6, seed = 1 }) {
  const count = Math.round(length * rate),
    out = new Float32Array(count),
    die = seededDie(seed);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const along = i / count;
    const freq = fromHz + (toHz - fromHz) * along + (die() - 0.5) * 8;
    phase = (phase + freq / rate) % 1;
    out[i] = (phase * 2 - 1) * Math.sin(Math.PI * along) ** 0.6;
  }
  return bandpass(out, rate, body, quality);
}
/** A drop's plip: a short sine falling in pitch from `hertz`, its tail `decay` s. */
export function plip(rate, { hertz = 1400, decay = 0.03, seed = 1 }) {
  const count = Math.round(decay * 6 * rate),
    out = new Float32Array(count);
  const pitch = hertz * (0.85 + seededDie(seed)() * 0.3);
  let turns = 0; // the phase in turns, kept in [0, 1)
  for (let i = 0; i < count; i++) {
    const time = i / rate;
    turns = (turns + (pitch * (1 + 0.6 * Math.exp(-time / decay))) / rate) % 1;
    out[i] = Math.sin(2 * Math.PI * turns) * Math.exp(-time / decay);
  }
  return out;
}
/** `pcm` made to loop: its last `fade` s crossfaded into its first, and cut to `length` samples (the loop's). */
export function seamless(pcm, rate, length, fade = 1) {
  const overlap = Math.min(Math.round(fade * rate), pcm.length - length);
  const out = pcm.slice(0, length);
  for (let i = 0; i < overlap; i++) {
    const along = i / overlap;
    out[i] = out[i] * Math.sqrt(along) + pcm[length + i] * Math.sqrt(1 - along);
  }
  return out;
}
/** `pcm` scaled so its loudest sample stands at `peak` (in place). */
export function normalize(pcm, peak = 0.8) {
  let loudest = 0;
  for (let i = 0; i < pcm.length; i++) loudest = Math.max(loudest, Math.abs(pcm[i]));
  if (loudest > 0) for (let i = 0; i < pcm.length; i++) pcm[i] *= peak / loudest;
  return pcm;
}
