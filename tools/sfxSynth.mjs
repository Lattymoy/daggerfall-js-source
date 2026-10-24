// THE SYNTH KIT - the DSP the port's synthesised sounds are built from, shared (NAV-E, 2026-09-28: the naval arc's
// guns joined the gun lab's). Moved out of tools/gunSfx.mjs unchanged, so its three clips come out byte for byte as
// they did; tools/navalSfx.mjs builds the sea fight's six from the same pieces. Everything here synthesises at RATE
// and is baked down to DAGGER.SND's own 11025 Hz 8-bit mono by tools/sndify.mjs.
// GATHER-FEEL (2026-10-13): the climb's pieces (unit, knock, rough, bandSweep, rub, grit) moved here out of
// tools/climbSfx.mjs unchanged - its eleven clips come out byte for byte as they did - so tools/gatherSfx.mjs builds the
// gathering's sounds from them too.

/** Synthesise high, bake down - the bake owns the aliasing. */
export const RATE = 44100;

/** mulberry32 - a seeded PRNG, so a re-run is byte-identical. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seconds = (s) => Math.round(s * RATE);
export const buf = (s) => new Float32Array(seconds(s));

/** Exponential decay, the shape every percussive envelope wants. */
export const decay = (i, tau) => Math.exp(-i / (tau * RATE));
/** A short attack so a transient does not start on a vertical edge -
 *  a step is a click, and a click survives the bake louder than the
 *  sound it belongs to. */
export const attack = (i, ms) => Math.min(1, i / Math.max(1, seconds(ms / 1000)));

/** RBJ biquad, the two shapes used here. */
export function biquad(x, { type, f0, q }) {
  const w = 2 * Math.PI * f0 / RATE, cw = Math.cos(w), sw = Math.sin(w);
  const alpha = sw / (2 * q);
  let b0, b1, b2;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; }
  else { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }   // lowpass
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 / a0) * x[i] + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** A one-pole lowpass whose cutoff MOVES - the sound of a pressure
 *  wave losing its top as it leaves the barrel. A fixed filter gives a
 *  flat "pff"; the sweep is what makes it a gunshot. */
export function sweepLowpass(x, fromHz, toHz, tau) {
  const out = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const f = toHz + (fromHz - toHz) * decay(i, tau);
    const a = Math.exp(-2 * Math.PI * f / RATE);
    y = (1 - a) * x[i] + a * y;
    out[i] = y;
  }
  return out;
}

export const noise = (len, rand) => {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = rand() * 2 - 1;
  return out;
};

/** dst += src * gain, starting at `at` seconds. */
export function mix(dst, src, at = 0, gain = 1) {
  const o = seconds(at);
  for (let i = 0; i < src.length; i++) {
    const j = o + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * gain;
  }
  return dst;
}

/** tanh saturation: the grit a loud sound has, and a limiter that
 *  cannot overshoot into the 8-bit rail. */
export const softClip = (x, drive = 1) => x.map((v) => Math.tanh(v * drive) / Math.tanh(drive));

export const envelope = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i); return x; };

// ---- the climb's pieces (CLIMB4), shared since GATHER-FEEL --------------------------------------------------------

/** Scaled to a peak of 1, so a piece's gain in a mix is its peak there - a narrow band of noise comes out of its
 *  filter a tenth as loud as it went in, and a slap mixed "at 1" beside a sine knock vanished under it. */
export function unit(x) {
  let max = 0;
  for (const v of x) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < x.length; i++) x[i] /= max;
  return x;
}

/** A sine sweep from `from` to `to` Hz over `tau`, enveloped - a knock's body. */
export function knock(len, from, to, tau, decayTau, attackMs = 0.6) {
  const out = buf(len);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const f = to + (from - to) * decay(i, tau);
    phase += (2 * Math.PI * f) / RATE;
    out[i] = Math.sin(phase) * attack(i, attackMs) * decay(i, decayTau);
  }
  return out;
}

/** A slow random wobble, 0..1, `hz` new values a second, joined smoothly (cosine) - a rub's roughness: the grain of
 *  stone under skin or leather is an uneven drag, not a steady hiss. */
export function rough(len, rand, hz) {
  const out = new Float32Array(len);
  const step = Math.max(1, Math.round(RATE / hz));
  let a = rand(), b = rand();
  for (let i = 0; i < len; i++) {
    const k = i % step;
    if (k === 0 && i > 0) { a = b; b = rand(); }
    const s = (1 - Math.cos((Math.PI * k) / step)) / 2;
    out[i] = a + (b - a) * s;
  }
  return out;
}

/** A bandpass whose centre MOVES (`f0(t)` Hz, t in seconds) - coefficients recomputed every 32 samples. */
export function bandSweep(x, f0, q) {
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % 32 === 0) {
      const w = (2 * Math.PI * Math.min(f0(i / RATE), RATE * 0.45)) / RATE, cw = Math.cos(w), sw = Math.sin(w);
      const alpha = sw / (2 * q), a0 = 1 + alpha;
      b0 = alpha / a0; b2 = -alpha / a0; a1 = (-2 * cw) / a0; a2 = (1 - alpha) / a0;
    }
    const y = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** A rub of `len` s: noise through `f0`'s band, dragged unevenly (`rough`), swelling in over `inMs` and dying on `tau`. */
export function rub(rand, len, { f0 = 1800, q = 1.5, hz = 120, inMs = 10, tau = 0.04, depth = 0.85 } = {}) {
  const n = seconds(len);
  const x = biquad(noise(n, rand), { type: 'bandpass', f0, q });
  const r = rough(n, rand, hz);
  for (let i = 0; i < n; i++) x[i] *= (1 - depth + depth * r[i]) * attack(i, inMs) * decay(i, tau);
  return unit(x);
}

/** Short bandpassed ticks at uneven times, loudest first on average - grit coming away, debris. */
export function grit(out, rand, { count, from, to, lo = 2200, hi = 4400, tauLo = 0.0015, tauHi = 0.004, gain = 0.3, q = 1.8 }) {
  for (let k = 0; k < count; k++) {
    const at = from + (to - from) * Math.pow(rand(), 1.5);
    const f0 = lo + (hi - lo) * rand();
    const tau = tauLo + (tauHi - tauLo) * rand();
    const t = biquad(noise(seconds(tau * 8), rand), { type: 'bandpass', f0, q });
    envelope(t, (i) => attack(i, 0.15) * decay(i, tau));
    mix(out, unit(t), at, gain * (0.4 + 0.6 * rand()) * (1 - 0.55 * (at - from) / Math.max(1e-6, to - from)));
  }
  return out;
}
