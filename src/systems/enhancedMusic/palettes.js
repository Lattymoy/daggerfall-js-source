// ENHANCED MUSIC - the palettes: one record per place, the whole of what
// the composer knows about how a place should sound. Records, not
// modules: a new place is a new record here, never a new branch in the
// composer. (EM1, 2026-08-27.)
//
// Keys are songManager's MUSIC_ENV names, so the director's own answer
// for "what environment is this" is the palette lookup, unchanged. A
// place with no record keeps its classic song under the enhanced skin,
// which is the honest state until its record is written.
//
// Programs are General MIDI numbers, resolved by gmSynth/fmSpec exactly
// as the classic songs' are - the underscore and the archive share one
// bank, so a palette can never ask for a voice the synth lacks.

/** The HMI clock the scheduler runs on: sixty ticks per quarter. */
export const TICKS_PER_BEAT = 60;
export const BEATS_PER_BAR = 4;
export const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;   // 240
export const BARS_PER_SECTION = 8;

/** Chord degrees per mode, 0-based (0 = i). Each row is one 8-bar
 *  section at two bars a chord. */
const DARK_PROGRESSIONS = Object.freeze({
  aeolian:       [[0, 5, 2, 6], [0, 3, 0, 4], [0, 6, 5, 6], [0, 5, 3, 0]],
  phrygian:      [[0, 1, 0, 6], [0, 3, 1, 0], [0, 1, 5, 1], [0, 6, 1, 0]],
  locrian:       [[0, 1, 0, 4], [0, 5, 1, 0], [0, 3, 1, 0]],
  harmonicMinor: [[0, 5, 4, 0], [0, 3, 4, 0], [0, 6, 4, 0]],
  dorian:        [[0, 3, 0, 6], [0, 5, 3, 0], [0, 3, 4, 0]],
});

export const MUSIC_PALETTES = Object.freeze({
  /** THE DUNGEON: the first place every game is heard in. Slow, dark,
   *  spacious - a pad bed two bars a chord, a bass that mostly rests, a
   *  motif that speaks in half the bars and says nothing in the rest,
   *  and one bell at the turn of each section. The silence is a layer. */
  dungeonInterior: Object.freeze({
    id: 'dungeonInterior',
    tempo: [52, 64],
    modes: [
      { value: 'phrygian', weight: 3 }, { value: 'aeolian', weight: 3 },
      { value: 'locrian', weight: 1 }, { value: 'harmonicMinor', weight: 1 },
    ],
    roots: [40, 47],                       // E2..B2: the tonic sits low
    form: ['A', 'A', 'B', 'A2'],           // 32 bars, then the loop
    barsPerChord: 2,
    progressions: DARK_PROGRESSIONS,
    layers: Object.freeze({
      bed:   { channel: 0, program: 89, register: [40, 59], velocity: [66, 78], volume: 96,  pan: 64, seventh: 0.35 },
      bass:  { channel: 1, program: 33, register: [28, 40], velocity: [86, 100], volume: 118, pan: 64, restBeat4: 0.6, fifthBeat4: 0.25 },
      motif: { channel: 2, program: 52, register: [60, 79], velocity: [80, 100], volume: 122, pan: 54, cell: [4, 6], leap: 0.3, dotted: 0.35 },
      color: { channel: 3, program: 14, register: [52, 67], velocity: [74, 90], volume: 104, pan: 74 },
    }),
  }),
});

/** The palette for an environment, or null: no record, classic song. */
export const paletteFor = (environment) => MUSIC_PALETTES[environment] ?? null;
