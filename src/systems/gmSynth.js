// A5: the GM voice bank - synthesised, because there is nothing to port.
//
// NO DFU SOURCE, AND NO REUSABLE ASSET. DaggerfallSongPlayer renders its
// 133 pre-converted .mid files with a vendored AudioSynthesis synth and a
// SoundFont loaded from Unity Resources. Both are DFU's OWN assets, not
// the user's ARENA2, so there is neither a synth to port nor an
// instrument set to read. The DATA path stays 1:1 - MIDI.BSA is the
// user's own archive, hmiFile.js decodes it byte-exactly, and
// songManager.js carries DFU's song tables verbatim - but the sound
// itself is ours. Port-Ledger A.
//
// WHY SYNTHESIS AND NOT SAMPLES. The archive needs 52 distinct GM
// programs and 76 of its 131 songs put notes on channel 9, so any
// sample-based answer needs a full GM set plus percussion: either we
// ship megabytes of our own, or we ask the player to supply an SF2.
// Oscillators ship nothing and ask for nothing, which is the only option
// that works the moment the page loads. It is also the least good
// sounding, so the bank is deliberately kept BEHIND AN INTERFACE:
// `voiceSpec` and `percussionSpec` are pure descriptions, and a future
// SF2 or sample bank replaces them without touching the scheduler.
//
// THE SPECS ARE OURS AND ARE NOT PINNED AS TRUTH. There is no source to
// be right against - a pin asserting "program 48 is a sawtooth" would be
// asserting my own taste back at me, which is the vacuous-pin shape this
// project's audits keep finding. What IS pinned is the structure: every
// GM program resolves, families map where General MIDI says they map,
// the envelope is ordered and finite, and nothing returns a value that
// would make the scheduler emit NaN into the audio graph.

/** MIDI note -> Hz. A440 at note 69, the one piece of real law here. */
export function noteToHz(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** GM channel 9 is percussion, always, whatever program is selected. */
export const PERCUSSION_CHANNEL = 9;

/** The 16 General MIDI families, program >> 3. Names are GM's, not ours. */
export const GM_FAMILIES = Object.freeze([
  'piano', 'chromatic', 'organ', 'guitar', 'bass', 'strings', 'ensemble', 'brass',
  'reed', 'pipe', 'synthLead', 'synthPad', 'synthEffects', 'ethnic', 'percussive', 'soundEffects',
]);

/** Family -> our approximation. attack/decay/release in seconds, sustain
 *  a 0..1 level, cutoff in Hz at the note's own pitch multiple. */
const FAMILY_SPECS = Object.freeze({
  piano:        { type: 'triangle', attack: 0.005, decay: 0.35, sustain: 0.25, release: 0.25, cutoff: 6, q: 0.7, gain: 0.75 },
  chromatic:    { type: 'sine',     attack: 0.002, decay: 0.50, sustain: 0.05, release: 0.35, cutoff: 8, q: 0.7, gain: 0.70 },
  organ:        { type: 'square',   attack: 0.010, decay: 0.05, sustain: 0.90, release: 0.10, cutoff: 5, q: 0.6, gain: 0.55 },
  guitar:       { type: 'sawtooth', attack: 0.006, decay: 0.30, sustain: 0.30, release: 0.20, cutoff: 5, q: 0.9, gain: 0.60 },
  bass:         { type: 'triangle', attack: 0.008, decay: 0.25, sustain: 0.55, release: 0.15, cutoff: 3, q: 0.8, gain: 0.90 },
  strings:      { type: 'sawtooth', attack: 0.080, decay: 0.20, sustain: 0.75, release: 0.35, cutoff: 4, q: 0.7, gain: 0.55 },
  ensemble:     { type: 'sawtooth', attack: 0.120, decay: 0.20, sustain: 0.80, release: 0.45, cutoff: 4, q: 0.6, gain: 0.50 },
  brass:        { type: 'sawtooth', attack: 0.040, decay: 0.15, sustain: 0.80, release: 0.20, cutoff: 6, q: 1.0, gain: 0.60 },
  reed:         { type: 'square',   attack: 0.030, decay: 0.15, sustain: 0.80, release: 0.20, cutoff: 5, q: 0.9, gain: 0.50 },
  pipe:         { type: 'sine',     attack: 0.040, decay: 0.10, sustain: 0.85, release: 0.20, cutoff: 7, q: 0.6, gain: 0.55 },
  synthLead:    { type: 'sawtooth', attack: 0.010, decay: 0.20, sustain: 0.70, release: 0.20, cutoff: 6, q: 1.2, gain: 0.55 },
  synthPad:     { type: 'triangle', attack: 0.250, decay: 0.30, sustain: 0.80, release: 0.60, cutoff: 3, q: 0.7, gain: 0.45 },
  synthEffects: { type: 'sine',     attack: 0.100, decay: 0.40, sustain: 0.50, release: 0.50, cutoff: 4, q: 1.0, gain: 0.45 },
  ethnic:       { type: 'triangle', attack: 0.010, decay: 0.30, sustain: 0.40, release: 0.25, cutoff: 5, q: 0.8, gain: 0.60 },
  percussive:   { type: 'triangle', attack: 0.002, decay: 0.25, sustain: 0.05, release: 0.20, cutoff: 8, q: 0.9, gain: 0.70 },
  soundEffects: { type: 'sine',     attack: 0.020, decay: 0.30, sustain: 0.30, release: 0.30, cutoff: 4, q: 0.8, gain: 0.40 },
});

/**
 * The voice for one GM program. Pure - it describes a voice, it does not
 * build one, so the scheduler is testable without an AudioContext and a
 * sample bank can replace this wholesale.
 *
 * Out-of-range programs CLAMP rather than throw: a bad program change in
 * a corpus file must not silence a song, and the reader deliberately
 * hands through whatever the bytes said.
 */
export function voiceSpec(program) {
  const p = Math.max(0, Math.min(127, Math.trunc(Number(program) || 0)));
  return { ...FAMILY_SPECS[GM_FAMILIES[p >> 3]], program: p, family: GM_FAMILIES[p >> 3] };
}

/** GM percussion keys we give a distinct shape. Everything else falls to
 *  the nearest of these by number, so no note is ever silent. */
const DRUMS = Object.freeze([
  { note: 35, kind: 'tone',  hz: 55,  attack: 0.002, decay: 0.28, gain: 1.00 },   // acoustic bass drum
  { note: 36, kind: 'tone',  hz: 60,  attack: 0.002, decay: 0.24, gain: 1.00 },   // bass drum 1
  { note: 38, kind: 'noise', hz: 1800, attack: 0.001, decay: 0.16, gain: 0.75 },  // acoustic snare
  { note: 40, kind: 'noise', hz: 2000, attack: 0.001, decay: 0.14, gain: 0.75 },  // electric snare
  { note: 42, kind: 'noise', hz: 7000, attack: 0.001, decay: 0.06, gain: 0.45 },  // closed hi-hat
  { note: 46, kind: 'noise', hz: 6000, attack: 0.001, decay: 0.32, gain: 0.45 },  // open hi-hat
  { note: 49, kind: 'noise', hz: 4500, attack: 0.002, decay: 0.90, gain: 0.55 },  // crash cymbal
  { note: 51, kind: 'noise', hz: 5500, attack: 0.002, decay: 0.50, gain: 0.40 },  // ride cymbal
  { note: 45, kind: 'tone',  hz: 110, attack: 0.002, decay: 0.24, gain: 0.80 },   // low tom
  { note: 47, kind: 'tone',  hz: 165, attack: 0.002, decay: 0.22, gain: 0.80 },   // mid tom
  { note: 50, kind: 'tone',  hz: 220, attack: 0.002, decay: 0.20, gain: 0.80 },   // high tom
]);

/**
 * The voice for one channel-9 key. Never returns null: an unmapped key
 * takes the nearest mapped one, because a drum track with holes in it
 * reads as a broken song rather than a sparse kit.
 */
export function percussionSpec(note) {
  const n = Math.max(0, Math.min(127, Math.trunc(Number(note) || 0)));
  let best = DRUMS[0];
  let bestDist = Infinity;
  for (const d of DRUMS) {
    const dist = Math.abs(d.note - n);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return { ...best, key: n };
}

/** MIDI velocity -> amplitude. Squared, so quiet notes read as quiet -
 *  a linear map makes everything sound the same loudness. */
export function velocityGain(velocity) {
  const v = Math.max(0, Math.min(127, Number(velocity) || 0)) / 127;
  return v * v;
}

/** CC7 channel volume -> amplitude, same curve. */
export const volumeGain = velocityGain;

/** CC10 pan (0..127, 64 centre) -> the -1..1 a StereoPannerNode wants. */
export function panPosition(value) {
  const v = Math.max(0, Math.min(127, Number(value) || 0));
  return (v - 64) / 63;
}

/** A 14-bit pitch bend (0..16383, 8192 centre) -> cents, +/- 2 semitones,
 *  which is the GM default range and the only one the corpus uses. */
export function bendCents(value, semitoneRange = 2) {
  const v = Math.max(0, Math.min(16383, Number(value) || 0));
  return ((v - 8192) / 8192) * semitoneRange * 100;
}

// --- FM: the voice bank that actually sounds like Daggerfall ----------
//
// A5b. The first bank was subtractive (an oscillator through a lowpass),
// which is cheap and sounds like nothing in particular. Daggerfall in
// 1996 played through an AdLib or SoundBlaster card - OPL2/OPL3, which
// is TWO-OPERATOR FM: one sine modulating another's frequency. That is
// why the archive carries an F*/FM* arrangement of nearly every song.
//
// There is NO OPL patch bank to read. It lived in HMI's sound driver,
// not in the data - ARENA2 has no .AD/.BNK/.OPL and no driver, and the
// song headers carry a device/channel map and zeros where patches would
// be (checked, byte by byte, before writing this). So the RATIOS AND
// INDICES BELOW ARE OURS, exactly like the subtractive specs were, and
// they are pinned for structure rather than asserted as truth.
//
// What is not taste is the METHOD. FM is the synthesis the game was
// scored for, and it gets timbres - struck bells, buzzy brass, hollow
// reeds, plucked strings - that a filtered sawtooth cannot reach at any
// setting. It also subsumes the old bank: modulation index 0 is a bare
// carrier, so nothing is lost.
//
//   ratio  the modulator's frequency as a multiple of the carrier's.
//          Integer ratios are harmonic (tonal); non-integer are
//          inharmonic (bells, metal).
//   index  modulation depth, in multiples of the carrier frequency.
//          This is the timbre control - it is what "brightness" means
//          in FM - and it DECAYS, because a real instrument's bright
//          attack settles into a duller sustain.

const FM_SPECS = Object.freeze({
  //             car ratio  mod ratio  index  idxDecay  attack decay sustain release gain
  piano:        { car: 1, mod: 1,    index: 2.6, idxDecay: 0.30, attack: 0.003, decay: 0.55, sustain: 0.18, release: 0.30, gain: 0.80 },
  chromatic:    { car: 1, mod: 3.5,  index: 4.0, idxDecay: 0.22, attack: 0.002, decay: 0.70, sustain: 0.04, release: 0.50, gain: 0.70 },
  organ:        { car: 1, mod: 2,    index: 1.2, idxDecay: 2.00, attack: 0.012, decay: 0.06, sustain: 0.92, release: 0.10, gain: 0.55 },
  guitar:       { car: 1, mod: 2,    index: 3.2, idxDecay: 0.18, attack: 0.004, decay: 0.45, sustain: 0.16, release: 0.28, gain: 0.70 },
  bass:         { car: 1, mod: 1,    index: 2.0, idxDecay: 0.16, attack: 0.006, decay: 0.35, sustain: 0.45, release: 0.18, gain: 0.95 },
  strings:      { car: 1, mod: 1,    index: 1.1, idxDecay: 1.20, attack: 0.090, decay: 0.30, sustain: 0.78, release: 0.40, gain: 0.60 },
  ensemble:     { car: 1, mod: 1,    index: 1.4, idxDecay: 1.40, attack: 0.130, decay: 0.30, sustain: 0.82, release: 0.50, gain: 0.55 },
  brass:        { car: 1, mod: 1,    index: 3.4, idxDecay: 0.55, attack: 0.045, decay: 0.22, sustain: 0.75, release: 0.22, gain: 0.65 },
  reed:         { car: 1, mod: 2,    index: 2.4, idxDecay: 0.60, attack: 0.030, decay: 0.20, sustain: 0.78, release: 0.20, gain: 0.55 },
  pipe:         { car: 1, mod: 2,    index: 0.8, idxDecay: 1.00, attack: 0.045, decay: 0.15, sustain: 0.85, release: 0.20, gain: 0.60 },
  synthLead:    { car: 1, mod: 1,    index: 2.8, idxDecay: 0.70, attack: 0.010, decay: 0.25, sustain: 0.70, release: 0.20, gain: 0.60 },
  synthPad:     { car: 1, mod: 1,    index: 1.0, idxDecay: 2.00, attack: 0.260, decay: 0.40, sustain: 0.82, release: 0.70, gain: 0.50 },
  synthEffects: { car: 1, mod: 1.41, index: 3.0, idxDecay: 0.80, attack: 0.110, decay: 0.50, sustain: 0.45, release: 0.55, gain: 0.45 },
  ethnic:       { car: 1, mod: 3,    index: 2.6, idxDecay: 0.20, attack: 0.006, decay: 0.40, sustain: 0.20, release: 0.28, gain: 0.65 },
  percussive:   { car: 1, mod: 3.5,  index: 5.0, idxDecay: 0.12, attack: 0.002, decay: 0.40, sustain: 0.02, release: 0.25, gain: 0.75 },
  soundEffects: { car: 1, mod: 1.73, index: 2.0, idxDecay: 0.60, attack: 0.020, decay: 0.40, sustain: 0.25, release: 0.35, gain: 0.45 },
});

/**
 * The FM voice for one GM program. Pure, like voiceSpec, and clamps the
 * same way - the reader hands through whatever the bytes said, and a bad
 * program change must not silence a song or put undefined into a ratio.
 */
export function fmSpec(program) {
  const p = Math.max(0, Math.min(127, Math.trunc(Number(program) || 0)));
  const family = GM_FAMILIES[p >> 3];
  return { ...FM_SPECS[family], program: p, family };
}
