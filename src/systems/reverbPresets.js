// BA1: UNITY'S AudioReverbPreset TABLE, the three Better Ambience's ReverbMod
// picks (ReverbMod.cs:41-46: Low = Cave, Medium = Stoneroom, High = Quarry),
// and an impulse response built from each. The numbers are the I3DL2 /
// EAX standard presets Unity's AudioReverbPreset carries (Unity documents
// them on AudioReverbZone: room and roomHF in millibels, decayTime in
// seconds, decayHFRatio, reflections and reverb in millibels with their
// delays in seconds, diffusion and density in percent, HFReference in Hz).
//
// The impulse is the port's own arithmetic on those numbers, not FMOD's
// reverb: an early-reflection cluster at `reflectionsDelay` at the
// `reflections` level, a dense noise tail from `reverbDelay` at the
// `reverb` level decaying by 60 dB over `decayTime`, its high band decaying
// `decayHFRatio` times as fast, the whole scaled by `room` and its high
// band by `roomHF`. What a player hears is a cave, a stone room and a
// quarry in that order of size and brightness; the exact tail is not
// FMOD's and is said so in the record.
export const REVERB_PRESET = Object.freeze({
  Cave: Object.freeze({ room: -1000, roomHF: 0, decayTime: 2.91, decayHFRatio: 1.30, reflections: -602, reflectionsDelay: 0.015, reverb: -302, reverbDelay: 0.022, HFReference: 5000, diffusion: 100, density: 100 }),
  Stoneroom: Object.freeze({ room: -1000, roomHF: -300, decayTime: 2.31, decayHFRatio: 0.64, reflections: -711, reflectionsDelay: 0.012, reverb: 83, reverbDelay: 0.017, HFReference: 5000, diffusion: 100, density: 100 }),
  Quarry: Object.freeze({ room: -1000, roomHF: -1000, decayTime: 1.49, decayHFRatio: 0.83, reflections: -10000, reflectionsDelay: 0.061, reverb: 500, reverbDelay: 0.025, HFReference: 5000, diffusion: 100, density: 100 }),
});
/** millibels to a linear gain (Unity's reverb levels are in mB: -1000 mB = -10 dB). */
export const mbToGain = (mb) => Math.pow(10, mb / 2000);

/** A deterministic noise source for the tail, so the same preset is the same impulse every time. */
function noise(seed) {
  let x = seed | 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) / 4294967296) * 2 - 1; };
}

/** The impulse response for a preset, as stereo samples at the context's rate. */
export function reverbImpulseSamples(p, sampleRate) {
  const length = Math.max(1, Math.ceil((p.reverbDelay + p.decayTime) * sampleRate));
  const out = [new Float32Array(length), new Float32Array(length)];
  const room = mbToGain(p.room), roomHF = mbToGain(p.roomHF);
  const refl = mbToGain(p.reflections) * room, tail = mbToGain(p.reverb) * room;
  // early reflections: a few taps spread over 40 ms after reflectionsDelay, each a little later and quieter
  for (let ch = 0; ch < 2; ch++) {
    const taps = [0, 0.011, 0.019, 0.027, 0.034][Symbol.iterator]();
    let k = 0;
    for (const t of taps) {
      const i = Math.floor((p.reflectionsDelay + t + (ch ? 0.003 : 0)) * sampleRate);
      if (i < length) out[ch][i] += refl * Math.pow(0.75, k);
      k++;
    }
  }
  // the tail: noise decaying to -60 dB over decayTime; the high band (a one-pole split at HFReference)
  // decays decayHFRatio times as fast and is scaled by roomHF
  const start = Math.floor(p.reverbDelay * sampleRate);
  const lowDecay = Math.log(1000) / (p.decayTime * sampleRate);
  const highDecay = Math.log(1000) / ((p.decayTime / Math.max(0.05, p.decayHFRatio)) * sampleRate);
  const alpha = Math.exp(-p.HFReference * Math.PI / (sampleRate / 2));   // e^(-2 pi f / fs), the one-pole coefficient at HFReference
  for (let ch = 0; ch < 2; ch++) {
    const rnd = noise(0x9e3779b9 + ch * 7919);
    let low = 0;
    for (let i = start; i < length; i++) {
      const n = rnd();
      low = low * alpha + n * (1 - alpha);   // the low band, one pole
      const high = n - low;
      const t = i - start;
      out[ch][i] += tail * (low * Math.exp(-lowDecay * t) + high * roomHF * Math.exp(-highDecay * t));
    }
  }
  return out;
}

/** An AudioBuffer of the preset's impulse for `ctx`. */
export function reverbImpulse(ctx, p) {
  const [l, r] = reverbImpulseSamples(p, ctx.sampleRate);
  const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
  buf.getChannelData(0).set(l);
  buf.getChannelData(1).set(r);
  return buf;
}
