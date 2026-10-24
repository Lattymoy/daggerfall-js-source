// @ts-check
// SOUNDSCAPE (2026-10-24, the owner: "enhancing sound and ambience, different music and ambience sounds for sailing ...
// and whatever else we could improve"): THE BEDS THE PORT MAKES - the sea's swell, the water past a hull, the wind in
// the rigging and the surf on a shore, each a few seconds of seeded noise cut by a chain of filters, made the way
// FIELD-WIND1 made the wind's (systems/wind/windAudio.js windBedSamples) and for its reason: Daggerfall has no water bed
// to loop (DAGGER.SND's WaterGentle is a one-shot lap, AmbientRaining the rain's), and a recording looped end to end is
// a loop an ear finds. Noise repeats nowhere an ear can find, and what makes a sea of it - the swell rising and falling,
// a wave breaking - is the gain the driver moves live (systems/soundscape/seaAir.js, worldAir.js), never baked in. They
// are made and registered by soundJobs.js, off the main thread (AUDIT SOUNDSCAPE W4).
//
// SEAMLESS: each layer's chain is run over the noise TWICE and the second pass kept, so every section's state at the
// period's end is where the period itself leaves it and the last sample runs into the first as any sample into the
// next (a filter's steady answer to a periodic input is periodic) - the engine's native loop (audio.setBed) has no seam.
// A bed may sum LAYERS, each the same noise through its own chain at its own gain (the surf's body and its hiss), and
// is levelled to its RMS last, so a driver's gain law means the same number whatever the bed is made of.
// Pure and deterministic: the same seed is the same bed every boot. Not a DFU member. Ledger A (SOUNDSCAPE).
import { section, mulberry32 } from './bedDsp.js';

/** The rate a bed is made at: 22050 Hz holds all a wash or a surf has (the brightest, the surf's spray, is gone past
 *  7 kHz), at half the memory of 44.1; a bed with nothing over 2.5 kHz (the swell, the rigging, the lap) is made at
 *  half that again - DAGGER.SND's own 11025 - for half the work and half the memory. */
export const BED_RATE = 22050;
export const BED_RATE_LOW = 11025;

/** @typedef {['lowpass' | 'bandpass' | 'highpass', number, number]} BedSection */
/** @typedef {{ chain: ReadonlyArray<BedSection>, gain: number }} BedLayer */
/** @typedef {{ seconds: number, seed: number, rms: number, rate: number, layers: ReadonlyArray<BedLayer> }} BedSpec */

/** @param {number} seconds @param {number} seed @param {number} rms @param {number} rate @param {Array<[ReadonlyArray<BedSection>, number]>} layers @returns {BedSpec} */
const bed = (seconds, seed, rms, rate, layers) => Object.freeze({
  seconds, seed, rms, rate,
  layers: Object.freeze(layers.map(([chain, gain]) => Object.freeze({ chain: Object.freeze(chain.map((s) => /** @type {BedSection} */ (Object.freeze([...s])))), gain }))),
});

/**
 * THE BEDS, by key: `seconds` long at `rate`, levelled to `rms`, each `layers` [{ chain: [[type, Hz, Q], ...], gain }] - every
 * section in series, `type` 'lowpass' | 'bandpass' | 'highpass' (windAudio.js section).
 *   sea:swell    the open sea's body: a deep wash under 500 Hz, the roll a swell makes against a hull and itself
 *   sea:wash     the water running past a hull under way: a hiss about 1.5 kHz, gone past 5
 *   sea:rigging  a strong wind in the rigging: two narrow resonances a fifth apart, a moan in the lines
 *   shore:surf   a wave breaking on a shore: a low body and a brighter spray over it
 *   shore:lap    quiet water at the edge of a sand or a quay: a soft band about 700 Hz
 *   wild:marsh   a marsh's air: a low insect drone under a thin high whine
 */
export const SOUND_BEDS = Object.freeze({
  'sea:swell': bed(12, 0x5ea5e11, 0.05, BED_RATE_LOW, [[[['lowpass', 520, 0.7], ['lowpass', 380, 0.8], ['highpass', 40, 0.7]], 1], [[['bandpass', 160, 0.9]], 0.5]]),
  'sea:wash': bed(9, 0x5eaa45a, 0.04, BED_RATE, [[[['bandpass', 1500, 0.55], ['lowpass', 4800, 0.707]], 1]]),
  'sea:rigging': bed(10, 0x51661a6, 0.03, BED_RATE_LOW, [[[['bandpass', 410, 14], ['bandpass', 410, 14]], 1], [[['bandpass', 615, 16], ['bandpass', 615, 16]], 0.6], [[['bandpass', 900, 1.2]], 0.25]]),
  'shore:surf': bed(12, 0x5a0f5e1, 0.05, BED_RATE, [[[['lowpass', 700, 0.7], ['highpass', 45, 0.7]], 1], [[['highpass', 1800, 0.6], ['lowpass', 7000, 0.707]], 0.45]]),
  'shore:lap': bed(8, 0x1a91a9, 0.03, BED_RATE_LOW, [[[['bandpass', 700, 0.9], ['lowpass', 2400, 0.707]], 1]]),
  'wild:marsh': bed(10, 0x3a125b, 0.025, BED_RATE, [[[['bandpass', 240, 3], ['lowpass', 900, 0.707]], 1], [[['bandpass', 4200, 6]], 0.35]]),
});

/**
 * A bed's samples: `spec.seconds` of white noise from `spec.seed` at `sampleRate` (the bed's own), each layer's chain run over it twice
 * (the second pass kept - the seam's law, above), the layers summed at their gains and the whole levelled to `spec.rms`.
 * Mono floats. Pure.
 * @param {BedSpec} spec
 * @param {number} [sampleRate]
 */
export function bedSamples(spec, sampleRate = spec.rate) {
  const n = Math.max(1, Math.round(sampleRate * spec.seconds));
  const next = mulberry32(spec.seed);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = next() * 2 - 1;
  const sum = new Float64Array(n);
  const y = new Float64Array(n);
  for (const { chain, gain } of spec.layers) {
    // section by section over the whole buffer: each section's last two inputs and outputs (direct form I) carried
    // sample to sample and from the first pass into the second; a section's input is the one before it's output
    const st = chain.map(() => new Float64Array(4));
    for (let pass = 0; pass < 2; pass++) {
      y.set(x);
      chain.forEach(([type, f0, q], k) => {
        const [c0, c1, c2, c3, c4] = section(type, f0, q, sampleRate), s = st[k];
        let x1 = s[0], x2 = s[1], y1 = s[2], y2 = s[3];
        for (let i = 0; i < n; i++) {
          const v = y[i], o = c0 * v + c1 * x1 + c2 * x2 - c3 * y1 - c4 * y2;
          x2 = x1; x1 = v; y2 = y1; y1 = o;
          y[i] = o;
        }
        s[0] = x1; s[1] = x2; s[2] = y1; s[3] = y2;
      });
    }
    for (let i = 0; i < n; i++) sum[i] += y[i] * gain;
  }
  let acc = 0;
  for (let i = 0; i < n; i++) acc += sum[i] * sum[i];
  const k = acc > 0 ? spec.rms / Math.sqrt(acc / n) : 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sum[i] * k;
  return out;
}

/** @type {Map<string, Float32Array>} */
const _beds = new Map();
/** A bed by its key, made once (the tests' door - the game's are made by soundJobs.js ensureBed, off the main thread);
 *  null for a key there is no bed of. */
export function bedOf(/** @type {string} */ key) {
  const spec = /** @type {Record<string, BedSpec>} */ (SOUND_BEDS)[key];
  if (!spec) return null;
  let s = _beds.get(key);
  if (!s) _beds.set(key, (s = bedSamples(spec)));
  return s;
}
