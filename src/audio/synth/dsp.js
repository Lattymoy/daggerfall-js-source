// @ts-check
// THE SYNTH'S PRIMITIVES. The sounds the port makes of its own - noise, filters, envelopes and resonators - written into
// a Float64Array canvas at any rate, then handed to the engine as Float32 PCM (audio.registerSamples). Pure and seeded:
// one seed, one sound, in node and in the browser. No recording is read. The section and the die are the beds' own
// (systems/soundscape/bedDsp.js).
import { section, mulberry32 } from '../../systems/soundscape/bedDsp.js';

export { section, mulberry32 };

/** @typedef {() => number} Rng a die in [0, 1) */
/** @typedef {['lowpass' | 'bandpass' | 'highpass', number, number]} Stage a filter: type, Hz, Q */

/** FNV-1a over a name: a clip's seed is its name's, so a clip is the same sound every boot. */
export function seedOf(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash >>> 0;
}

/** A value in [lo, hi). @param {Rng} rnd @param {number} lo @param {number} hi */
export const between = (rnd, lo, hi) => lo + rnd() * (hi - lo);
/** A value in [lo, hi) spread evenly over its octaves - a pitch or a band. @param {Rng} rnd @param {number} lo @param
 * {number} hi */
export const logBetween = (rnd, lo, hi) => lo * Math.exp(rnd() * Math.log(hi / lo));
/** A level weighted toward the quiet end, as most grains of a crunch are small. @param {Rng} rnd @param {number} lo
 * @param {number} hi */
export const quietBetween = (rnd, lo, hi) => {
  const roll = rnd();
  return lo + roll * roll * roll * (hi - lo);
};

/** An empty clip `seconds` long at `rate`. @param {number} seconds @param {number} rate */
export const canvas = (seconds, rate) => new Float64Array(Math.max(1, Math.round(seconds * rate)));

/** The floor a sound is made down to: a tail under it is never heard, and is not made. */
const FLOOR = 3e-5;
/** How many samples a level `amp` falling by e every `tau` takes to reach the floor. */
const tailOf = (amp, tau, rate) => Math.max(0, Math.ceil(tau * Math.log(Math.abs(amp) / FLOOR) * rate));

/** The stages' coefficients, five a stage, in one array (the beds' section; Hz held under Nyquist). */
function coefficients(stages, rate) {
  const coef = new Float64Array(stages.length * 5);
  stages.forEach(([type, freq, width], i) => coef.set(section(type, Math.min(freq, rate * 0.45), width, rate), i * 5));
  return coef;
}

/** A chain of stages in series, as a running filter. @param {ReadonlyArray<Stage>} stages @param {number} rate */
export function chain(stages, rate) {
  const coef = coefficients(stages, rate);
  const state = new Float64Array(stages.length * 4); // each stage's last two inputs, then its last two outputs
  const count = stages.length;
  return (/** @type {number} */ x) => {
    let value = x;
    for (let stage = 0, k = 0, j = 0; stage < count; stage++, k += 5, j += 4) {
      const y =
        coef[k] * value +
        coef[k + 1] * state[j] +
        coef[k + 2] * state[j + 1] -
        coef[k + 3] * state[j + 2] -
        coef[k + 4] * state[j + 3];
      state[j + 1] = state[j];
      state[j] = value;
      state[j + 3] = state[j + 2];
      state[j + 2] = y;
      value = y;
    }
    return value;
  };
}

/**
 * `stages` over `x[0..len)` in place, one stage at a time over the whole span - a cascade, made fast. `passes` 2 runs
 * each stage over the span twice and keeps the second: its state at the end is where the period leaves it, so a loop
 * of it has no seam (the beds' way, soundscape/soundBeds.js).
 * @param {Float64Array} x @param {number} len @param {ReadonlyArray<Stage>} stages @param {number} rate
 */
export function filterSpan(x, len, stages, rate, passes = 1) {
  for (const [type, freq, width] of stages) {
    const [ff0, ff1, ff2, fb1, fb2] = section(type, Math.min(freq, rate * 0.45), width, rate);
    let in1 = 0,
      in2 = 0,
      out1 = 0,
      out2 = 0;
    for (let pass = 1; pass < passes; pass++) {
      for (let i = 0; i < len; i++) {
        const y = ff0 * x[i] + ff1 * in1 + ff2 * in2 - fb1 * out1 - fb2 * out2;
        in2 = in1;
        in1 = x[i];
        out2 = out1;
        out1 = y;
      }
    }
    for (let i = 0; i < len; i++) {
      const input = x[i];
      const y = ff0 * input + ff1 * in1 + ff2 * in2 - fb1 * out1 - fb2 * out2;
      in2 = in1;
      in1 = input;
      out2 = out1;
      out1 = y;
      x[i] = y;
    }
  }
  return x;
}

/** A span to work in, kept between calls (a burst is made in it before it is added). */
let _scratch = new Float64Array(4096);
const scratch = (/** @type {number} */ n) => (_scratch.length >= n ? _scratch : (_scratch = new Float64Array(n * 2)));

/**
 * A NOISE BURST: white noise through `stages`, under a linear attack and an exponential decay, added at `at` seconds,
 * until it falls under the floor. Its RMS at the top is half of `amp`, whatever its band. `noise` is the clip's noise
 * die, apart from its parameter die, so a clip made at two rates keeps the same events.
 * @param {Float64Array} buf @param {number} rate @param {Rng} noise
 * @param {{ at: number, amp: number, attack?: number, decay: number, stages: ReadonlyArray<Stage> }} b
 */
export function addBurst(buf, rate, noise, { at, amp, attack = 0.0005, decay, stages }) {
  const start = Math.round(at * rate);
  const att = Math.max(1, Math.round(attack * rate));
  const end = Math.min(att + tailOf(amp, decay, rate), buf.length - start);
  if (end <= 0) return;
  const x = scratch(end);
  for (let i = 0; i < end; i++) x[i] = noise() * 2 - 1;
  filterSpan(x, end, stages, rate);
  // the band's own level divided out: `amp` is the burst's level (its RMS is half of it), however narrow its band
  let power = 0;
  for (let i = 0; i < end; i++) power += x[i] * x[i];
  const norm = power > 0 ? 0.5 / Math.sqrt(power / end) : 0;
  for (let i = 0; i < end; i++) x[i] *= norm;
  const k = Math.exp(-1 / (decay * rate));
  let env = amp;
  for (let i = 0; i < att && i < end; i++) buf[start + i] += x[i] * (i / att) * amp;
  for (let i = att; i < end; i++) buf[start + i] += x[i] * (env *= k);
}

/**
 * A MODE: a damped sine (a resonance of a struck body - a board, a plate, a ring), `freq` Hz, its level falling by e
 * every `tau` seconds. Made by the two-pole recurrence, so it costs no sine a sample.
 * @param {Float64Array} buf @param {number} rate
 * @param {{ at: number, freq: number, tau: number, amp: number, phase?: number }} m
 */
export function addMode(buf, rate, { at, freq, tau, amp, phase = 0 }) {
  if (freq <= 0 || freq >= rate * 0.49) return;
  const w = (2 * Math.PI * freq) / rate;
  const decay = Math.exp(-1 / (tau * rate));
  const turn = 2 * decay * Math.cos(w);
  const decay2 = decay * decay;
  const start = Math.round(at * rate);
  const len = Math.min(buf.length - start, tailOf(amp, tau, rate));
  let last = amp * Math.sin(phase);
  let next = amp * decay * Math.sin(w + phase);
  for (let i = 0; i < len; i++) {
    buf[start + i] += last;
    const after = turn * next - decay2 * last;
    last = next;
    next = after;
  }
}

/**
 * A BUBBLE (the water's voice): a sine whose pitch rises as the bubble closes, its level falling by e every `tau`. A
 * splash is a burst and a scatter of these.
 * @param {Float64Array} buf @param {number} rate
 * @param {{ at: number, freq: number, tau: number, amp: number, rise?: number }} b
 */
export function addBubble(buf, rate, { at, freq, tau, amp, rise = 0.6 }) {
  const start = Math.round(at * rate);
  const turn0 = (2 * Math.PI * freq) / rate;
  const growth = (turn0 * rise) / (tau * rate);
  const below = growth > 0 ? Math.floor((Math.PI * 0.98 - turn0) / growth) : Infinity; // the pitch held under Nyquist
  const len = Math.min(buf.length - start, tailOf(amp, tau, rate), below);
  const k = Math.exp(-1 / (tau * rate));
  const att = 0.0006 * rate;
  // the phase turns by a turn each sample, and the turn grows by `growth`: a phasor turned by a turn itself turned
  let phaseRe = 1,
    phaseIm = 0,
    turnRe = Math.cos(turn0),
    turnIm = Math.sin(turn0),
    env = amp;
  const growRe = Math.cos(growth),
    growIm = Math.sin(growth);
  for (let i = 0; i < len; i++) {
    const real = phaseRe * turnRe - phaseIm * turnIm;
    phaseIm = phaseRe * turnIm + phaseIm * turnRe;
    phaseRe = real;
    const turned = turnRe * growRe - turnIm * growIm;
    turnIm = turnRe * growIm + turnIm * growRe;
    turnRe = turned;
    buf[start + i] += phaseIm * env * (i < att ? i / att : 1);
    env *= k;
  }
}

/**
 * A CREAK (leather, a board): stick-slip - a train of clicks whose rate glides from `fromHz` to `toHz`, rung through a
 * narrow band at `centre`, under a rise and fall over `len` seconds.
 * @param {Float64Array} buf @param {number} rate @param {Rng} rnd
 * @param {{ at: number, len: number, amp: number, fromHz: number, toHz: number, centre: number, bandQ: number }} c
 */
export function addCreak(buf, rate, rnd, { at, len, amp, fromHz, toHz, centre, bandQ }) {
  const start = Math.round(at * rate);
  const n = Math.round(len * rate);
  const ring = chain(
    [
      ['bandpass', centre, bandQ],
      ['bandpass', centre * 1.02, bandQ],
    ],
    rate,
  );
  let next = 0;
  for (let i = 0; i < n + Math.round(0.02 * rate); i++) {
    const along = Math.min(1, i / n);
    let x = 0;
    if (i < n && i >= next) {
      const clicks = fromHz + (toHz - fromHz) * along;
      next = i + Math.max(1, Math.round((rate / clicks) * between(rnd, 0.8, 1.2)));
      x = between(rnd, 0.5, 1);
    }
    const env = Math.sin(Math.PI * along);
    const j = start + i;
    if (j >= 0 && j < buf.length) buf[j] += ring(x) * env * amp * bandQ;
  }
}

/**
 * GRAINS: a crowd of small events between `from` and `to` seconds, `density(time)` of them a second at most `peak`
 * (drawn by thinning, so the crowd follows the curve). `grain(at)` makes each.
 * @param {Rng} rnd @param {{ from: number, to: number, peak: number, density: (time: number) => number, grain: (at:
 * number) => void }} g
 */
export function addGrains(rnd, { from, to, peak, density, grain }) {
  if (peak <= 0) return;
  let time = from;
  for (;;) {
    time += -Math.log(1 - rnd()) / peak;
    if (time >= to) return;
    if (rnd() * peak <= density(time)) grain(time);
  }
}

/** A swell that rises from `at` over `rise` seconds and falls away by e every `fall`: the shape of a press. */
export const pressSwell = (
  /** @type {number} */ time,
  /** @type {number} */ at,
  /** @type {number} */ rise,
  /** @type {number} */ fall,
) => (time < at ? 0 : time < at + rise ? (time - at) / rise : Math.exp(-(time - at - rise) / fall));

/** Every sample through `stages`, in place. @param {Float64Array} buf @param {number} rate @param
 * {ReadonlyArray<Stage>} stages */
export function filterAll(buf, rate, stages) {
  return filterSpan(buf, buf.length, stages, rate);
}

/** The clip's ends taken to nothing over `ms`, so no clip starts or stops on a click. @param {Float64Array} buf @param
 * {number} rate */
export function fadeEnds(buf, rate, inMs = 0.5, outMs = 12) {
  const a = Math.min(buf.length, Math.round((inMs / 1000) * rate));
  const b = Math.min(buf.length, Math.round((outMs / 1000) * rate));
  for (let i = 0; i < a; i++) buf[i] *= i / a;
  for (let i = 0; i < b; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
}

/** The loudest sample brought to `peak` (a silent clip stays silent). @param {Float64Array} buf @param {number} peak */
export function peakTo(buf, peak) {
  let most = 0;
  for (let i = 0; i < buf.length; i++) most = Math.max(most, Math.abs(buf[i]));
  const k = most > 0 ? peak / most : 0;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}

/** A high shelf (the RBJ cookbook's): `gainDb` over `freq`, its `slope`. Five coefficients, as `section` answers. */
function shelf(freq, gainDb, slope, rate) {
  const shelfGain = 10 ** (gainDb / 40),
    w = (2 * Math.PI * freq) / rate,
    cos = Math.cos(w),
    spread = Math.sqrt(shelfGain) * (Math.sin(w) / slope);
  const normaliser = shelfGain + 1 - (shelfGain - 1) * cos + spread;
  return [
    (shelfGain * (shelfGain + 1 + (shelfGain - 1) * cos + spread)) / normaliser,
    (-2 * shelfGain * (shelfGain - 1 + (shelfGain + 1) * cos)) / normaliser,
    (shelfGain * (shelfGain + 1 + (shelfGain - 1) * cos - spread)) / normaliser,
    (2 * (shelfGain - 1 - (shelfGain + 1) * cos)) / normaliser,
    (shelfGain + 1 - (shelfGain - 1) * cos - spread) / normaliser,
  ];
}

/**
 * HOW LOUD A CLIP IS: its loudest 100 ms, K-weighted (ITU-R BS.1770's +4 dB shelf over 1,682 Hz and high-pass at 38 Hz),
 * in dB of full scale. A level by the peak made a thud and a crunch of one peak 8 dB apart to the ear; this is how the
 * clips are set beside Daggerfall's own (DAGGER.SND's stride measures -29 to -37 on it).
 * @param {ArrayLike<number>} buf @param {number} rate
 */
export function loudnessOf(buf, rate) {
  const n = buf.length;
  const stages = [shelf(1681.97, 4, 0.7072, rate), section('highpass', 38.135, 0.5003, rate)];
  const power = new Float64Array(n + 1);
  const state = new Float64Array(8);
  for (let i = 0; i < n; i++) {
    let value = buf[i];
    for (let k = 0, j = 0; k < 2; k++, j += 4) {
      const [ff0, ff1, ff2, fb1, fb2] = stages[k];
      const y = ff0 * value + ff1 * state[j] + ff2 * state[j + 1] - fb1 * state[j + 2] - fb2 * state[j + 3];
      state[j + 1] = state[j];
      state[j] = value;
      state[j + 3] = state[j + 2];
      state[j + 2] = y;
      value = y;
    }
    power[i + 1] = power[i] + value * value;
  }
  const win = Math.max(1, Math.min(n, Math.round(0.1 * rate))),
    hop = Math.max(1, Math.round(0.01 * rate));
  let most = 0;
  for (let at = 0; ; at += hop) {
    const end = Math.min(n, at + win);
    most = Math.max(most, (power[end] - power[at]) / win);
    if (end >= n) break;
  }
  return most > 0 ? 10 * Math.log10(most) : -Infinity;
}

/**
 * The clip brought to `db` of loudness (loudnessOf); a silent clip stays silent.
 * @template {Float64Array | Float32Array} T @param {T} buf @param {number} rate @param {number} db @returns {T}
 */
export function loudnessTo(buf, rate, db) {
  const now = loudnessOf(buf, rate);
  const k = Number.isFinite(now) ? 10 ** ((db - now) / 20) : 0;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}

/** The clip's RMS brought to `db` dBFS (a silent clip stays silent). @param {Float64Array} buf @param {number} db */
export function rmsTo(buf, db) {
  let power = 0;
  for (let i = 0; i < buf.length; i++) power += buf[i] * buf[i];
  const k = power > 0 ? 10 ** (db / 20) / Math.sqrt(power / buf.length) : 0;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}

/** The clip held to `bits` of depth, as an old sound card held it (the retro quality). @param {Float64Array} buf @param
 * {number} bits */
export function crush(buf, bits) {
  const steps = 2 ** (bits - 1);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.round(buf[i] * steps) / steps;
  return buf;
}

/** The clip as the engine takes it. @param {Float64Array} buf */
export function toPcm(buf) {
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = Math.max(-1, Math.min(1, buf[i]));
  return out;
}

/** The clip's RMS level. @param {ArrayLike<number>} buf */
export function rmsOf(buf) {
  let power = 0;
  for (let i = 0; i < buf.length; i++) power += buf[i] * buf[i];
  return buf.length ? Math.sqrt(power / buf.length) : 0;
}

/**
 * MADE IN TURN: one clip a task, so a set of a hundred never stalls the page - each `make()` waits for the one before it
 * and for a turn of the event loop. Answers what `make` answers.
 * @template T @param {() => T} make @returns {Promise<T>}
 */
export function inTurn(make) {
  const run = _queue.then(() => new Promise((res) => setTimeout(res, 0))).then(make);
  _queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
/** @type {Promise<unknown>} */
let _queue = Promise.resolve();
