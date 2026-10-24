// @ts-check
// THE BEDS' DSP, ONE HOME (AUDIT SOUNDSCAPE W4, 2026-10-24): the second-order section and the seeded die FIELD-WIND1 cut the
// wind's bed with (systems/wind/windAudio.js windBedSamples), moved here out of windAudio.js unchanged - the wind's bed
// comes out sample for sample as it did - so the soundscape's beds (systems/soundscape/soundBeds.js) and the worker that
// makes them off the main thread (soundWorker.js) import a leaf with nothing under it. Pure.

/** A second-order section's coefficients (the audio EQ cookbook's band-pass at 0 dB peak, low-pass or high-pass), a0
 *  divided out: [b0, b1, b2, a1, a2]. */
export function section(type, f0, q, fs) {
  const w0 = (2 * Math.PI * f0) / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
  const b = type === 'bandpass' ? [alpha, 0, -alpha] : type === 'highpass' ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2] : [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  return [b[0] / a0, b[1] / a0, b[2] / a0, (-2 * cos) / a0, (1 - alpha) / a0];
}

/** mulberry32: a small seeded generator, [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
